import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { skyLayout } from '../../utils/isnadSky';

// «سماء الإسناد»: my network as threads of light rising from me to the highest persons.
// Loaded lazily by the home page (three.js is large); renders nothing when WebGL is unavailable.

const COLORS = {
  me: new THREE.Color('#ffffff'),
  shaykh: new THREE.Color('#ffe2a0'),
  sacred: new THREE.Color('#fff4d6'),
  top: new THREE.Color('#f5c86a'),
  person: new THREE.Color('#d9a94a'),
};
const SIZES = { me: 26, sacred: 30, top: 22, shaykh: 20, person: 13 };
const LABELLED = new Set(['me', 'sacred', 'top', 'shaykh']);
const MAX_LABELS = 9;

const NODE_VERTEX = `
  attribute float size; attribute float phase; attribute vec3 color;
  uniform float uTime; uniform float uPixelRatio; uniform float uHover;
  varying vec3 vColor; varying float vFocus;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float twinkle = 1.0 + 0.14 * sin(uTime * 1.7 + phase);
    vFocus = abs(phase - uHover) < 0.001 ? 1.0 : 0.0;
    gl_PointSize = size * twinkle * (1.0 + vFocus * 0.6) * uPixelRatio * (14.0 / -mv.z);
    vColor = color;
    gl_Position = projectionMatrix * mv;
  }`;
const GLOW_FRAGMENT = `
  varying vec3 vColor; varying float vFocus;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float core = smoothstep(0.12, 0.0, d);
    float halo = pow(smoothstep(0.5, 0.0, d), 2.2);
    gl_FragColor = vec4(mix(vColor, vec3(1.0), core * 0.7 + vFocus * 0.3), halo * 0.9 + core);
  }`;
// one spark per link, climbing from the student to the shaykh
const PULSE_VERTEX = `
  attribute vec3 to; attribute float offset;
  uniform float uTime; uniform float uPixelRatio;
  varying float vAlpha;
  void main() {
    float t = fract(uTime * 0.12 + offset);
    vec4 mv = modelViewMatrix * vec4(mix(position, to, t), 1.0);
    vAlpha = sin(t * 3.14159);
    gl_PointSize = 7.0 * uPixelRatio * (14.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }`;
const PULSE_FRAGMENT = `
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    gl_FragColor = vec4(1.0, 0.9, 0.65, pow(smoothstep(0.5, 0.0, d), 2.0) * vAlpha);
  }`;

const glow = (vertexShader, fragmentShader, uniforms) => new THREE.ShaderMaterial({
  vertexShader, fragmentShader, uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
});

export default function IsnadSky({ data, onPick }) {
  const hostRef = useRef(null);
  const labelsRef = useRef(null);
  const [hover, setHover] = useState(null);   // { name, x, y }
  const pickRef = useRef(onPick);
  pickRef.current = onPick;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' }); }
    catch { return undefined; }    // no WebGL: the hero keeps its plain background

    const sky = skyLayout(data);
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia?.('(pointer: fine)').matches;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(pixelRatio);
    renderer.setClearColor(0x000000, 0);
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
    const world = new THREE.Group();
    world.position.y = -sky.height / 2;
    scene.add(world);
    const uniforms = { uTime: { value: 0 }, uPixelRatio: { value: pixelRatio }, uHover: { value: -1 } };
    const disposables = [];
    const keep = (...xs) => { disposables.push(...xs); return xs[0]; };

    // persons
    const n = sky.nodes.length;
    const position = new Float32Array(n * 3), color = new Float32Array(n * 3);
    const size = new Float32Array(n), phase = new Float32Array(n);
    sky.nodes.forEach((p, i) => {
      position.set([p.x, p.y, p.z], i * 3);
      color.set(COLORS[p.kind].toArray(), i * 3);
      size[i] = SIZES[p.kind];
      phase[i] = i;           // also the node's id in the shader (hover highlight)
    });
    const nodeGeo = keep(new THREE.BufferGeometry());
    nodeGeo.setAttribute('position', new THREE.BufferAttribute(position, 3));
    nodeGeo.setAttribute('color', new THREE.BufferAttribute(color, 3));
    nodeGeo.setAttribute('size', new THREE.BufferAttribute(size, 1));
    nodeGeo.setAttribute('phase', new THREE.BufferAttribute(phase, 1));
    const nodes = new THREE.Points(nodeGeo, keep(glow(NODE_VERTEX, GLOW_FRAGMENT, uniforms)));
    world.add(nodes);

    // links: threads brighter towards the shaykh
    if (sky.links.length) {
      const linePos = new Float32Array(sky.links.length * 6), lineCol = new Float32Array(sky.links.length * 6);
      const from = new Float32Array(sky.links.length * 3), to = new Float32Array(sky.links.length * 3);
      const offset = new Float32Array(sky.links.length);
      const low = new THREE.Color('#5fb3a9'), high = new THREE.Color('#d9a94a');
      sky.links.forEach(([a, b], i) => {
        const pa = sky.nodes[a], pb = sky.nodes[b];
        linePos.set([pa.x, pa.y, pa.z, pb.x, pb.y, pb.z], i * 6);
        lineCol.set([...low.toArray(), ...high.toArray()], i * 6);
        from.set([pa.x, pa.y, pa.z], i * 3);
        to.set([pb.x, pb.y, pb.z], i * 3);
        offset[i] = (i * 0.61803) % 1;
      });
      const lineGeo = keep(new THREE.BufferGeometry());
      lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
      lineGeo.setAttribute('color', new THREE.BufferAttribute(lineCol, 3));
      world.add(new THREE.LineSegments(lineGeo, keep(new THREE.LineBasicMaterial({
        vertexColors: true, transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false,
      }))));
      if (!still) {
        const pulseGeo = keep(new THREE.BufferGeometry());
        pulseGeo.setAttribute('position', new THREE.BufferAttribute(from, 3));
        pulseGeo.setAttribute('to', new THREE.BufferAttribute(to, 3));
        pulseGeo.setAttribute('offset', new THREE.BufferAttribute(offset, 1));
        world.add(new THREE.Points(pulseGeo, keep(glow(PULSE_VERTEX, PULSE_FRAGMENT, uniforms))));
      }
    }

    // faint star dust around everything
    const dustCount = 260, dust = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      const r = 9 + Math.random() * 14, a = Math.random() * Math.PI * 2, y = (Math.random() - 0.5) * (sky.height + 16);
      dust.set([Math.cos(a) * r, y, Math.sin(a) * r], i * 3);
    }
    const dustGeo = keep(new THREE.BufferGeometry());
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dust, 3));
    const dustPts = new THREE.Points(dustGeo, keep(new THREE.PointsMaterial({
      color: 0xfff1cf, size: 0.05, transparent: true, opacity: 0.55, depthWrite: false,
    })));
    scene.add(dustPts);

    // camera: looking slightly up at the whole sky
    const radius = Math.max(2.4, Math.hypot(sky.height / 2, 4.2));
    const distance = radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 0.92;
    camera.position.set(0, -radius * 0.18, distance);
    camera.lookAt(0, 0, 0);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enabled = finePointer;      // on touch screens the hero must still scroll the page
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.autoRotate = !still;
    controls.autoRotateSpeed = 0.45;
    controls.minPolarAngle = Math.PI * 0.32;
    controls.maxPolarAngle = Math.PI * 0.62;
    if (!finePointer) renderer.domElement.style.pointerEvents = 'none';

    // names: me, the sacred persons, the highest and my shaykhs (HTML, so Arabic shapes correctly)
    const labelHost = labelsRef.current;
    const labelled = sky.nodes.map((p, i) => ({ p, i })).filter(({ p }) => LABELLED.has(p.kind))
      .sort((a, b) => ['me', 'sacred', 'top', 'shaykh'].indexOf(a.p.kind) - ['me', 'sacred', 'top', 'shaykh'].indexOf(b.p.kind))
      .slice(0, MAX_LABELS)
      .map(({ p, i }) => {
        const el = document.createElement('span');
        el.className = `sky-label sky-label-${p.kind}`;
        el.textContent = p.name;
        labelHost.appendChild(el);
        return { el, i };
      });

    // size, with the sky beside the greeting on wide screens
    let width = 1, height = 1;
    const resize = () => {
      width = host.clientWidth || 1; height = host.clientHeight || 1;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      if (width > 720) camera.setViewOffset(width, height, width * 0.2, 0, width, height);
      else camera.clearViewOffset();
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    // hover and click
    const ray = new THREE.Raycaster();
    ray.params.Points.threshold = 0.22;
    const mouse = new THREE.Vector2();
    let hovered = -1, downAt = null;
    const pickAt = ev => {
      const r = renderer.domElement.getBoundingClientRect();
      mouse.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(mouse, camera);
      const hit = ray.intersectObject(nodes)[0];
      return hit ? hit.index : -1;
    };
    const onMove = ev => {
      const i = pickAt(ev);
      if (i === hovered) return;
      hovered = i;
      uniforms.uHover.value = i;
      renderer.domElement.style.cursor = i >= 0 && sky.nodes[i].id > 0 ? 'pointer' : '';
      if (i < 0) setHover(null);
    };
    const onLeave = () => { hovered = -1; uniforms.uHover.value = -1; setHover(null); };
    const onDown = ev => { downAt = [ev.clientX, ev.clientY]; };
    const onUp = ev => {
      if (!downAt || Math.hypot(ev.clientX - downAt[0], ev.clientY - downAt[1]) > 5) return;   // a drag, not a click
      const i = pickAt(ev);
      if (i >= 0 && sky.nodes[i].id > 0) pickRef.current?.(sky.nodes[i]);
    };
    const canvas = renderer.domElement;
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointerup', onUp);

    // render loop, paused while the hero is off screen or the tab is hidden
    let visible = true, raf = 0, last = performance.now();
    const v = new THREE.Vector3();
    const place = (el, i) => {
      v.set(position[i * 3], position[i * 3 + 1], position[i * 3 + 2]).applyMatrix4(world.matrixWorld).project(camera);
      const show = v.z < 1;
      el.style.opacity = show ? '' : '0';
      el.style.transform = `translate(${((v.x + 1) / 2) * width}px, ${((1 - v.y) / 2) * height}px) translate(-50%, -150%)`;
    };
    const frame = now => {
      raf = 0;
      if (!visible || document.hidden) return;
      const dt = Math.min(now - last, 100) / 1000;
      last = now;
      if (!still) {
        uniforms.uTime.value += dt;
        dustPts.rotation.y += dt * 0.01;
      }
      controls.update();
      world.updateMatrixWorld();
      renderer.render(scene, camera);
      labelled.forEach(({ el, i }) => place(el, i));
      if (hovered >= 0) {
        v.set(position[hovered * 3], position[hovered * 3 + 1], position[hovered * 3 + 2]).applyMatrix4(world.matrixWorld).project(camera);
        setHover(h => {
          const x = ((v.x + 1) / 2) * width, y = ((1 - v.y) / 2) * height, name = sky.nodes[hovered].name;
          return h && h.name === name && Math.abs(h.x - x) < 0.5 && Math.abs(h.y - y) < 0.5 ? h : { name, x, y };
        });
      }
      raf = requestAnimationFrame(frame);   // also when still: dragging and hovering need frames
    };
    const kick = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) kick(); });
    io.observe(host);
    document.addEventListener('visibilitychange', kick);
    kick();

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', kick);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      controls.dispose();
      disposables.forEach(d => d.dispose());
      labelled.forEach(({ el }) => el.remove());
      renderer.dispose();
      canvas.remove();
    };
  }, [data]);

  return (
    <div className="sky" aria-hidden="true">
      <div ref={hostRef} className="sky-canvas" />
      <div ref={labelsRef} className="sky-labels" />
      <div className="sky-labels">
        {hover && (
          <span className="sky-label sky-label-hover" style={{ transform: `translate(${hover.x}px, ${hover.y}px) translate(-50%, -170%)` }}>
            {hover.name}
          </span>
        )}
      </div>
    </div>
  );
}
