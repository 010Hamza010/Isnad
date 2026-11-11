import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import { loginSky } from '../../utils/loginSky';

// The login page's isnad: draws itself link by link from me up to the top star, then sparks keep
// climbing. flash() sends a wave of light up the chain (after a successful login).
// variant "panel" (the art side) or "strip" (phones: a thin band, the chain running right to left).
// Lazily loaded; renders nothing when WebGL is unavailable.

const REVEAL_SPEED = 1.6;     // generations per second
const WAVE_SECONDS = 0.9;

const COMMON = `
  uniform float uTime; uniform float uReveal; uniform float uWave; uniform float uPixelRatio; uniform float uScale;
  float waveAt(float depth) { return uWave < 0.0 ? 0.0 : exp(-pow(depth - uWave, 2.0) * 2.5); }
`;
const NODE_VERTEX = `${COMMON}
  attribute float depth; attribute float size; attribute float phase;
  varying float vAlpha; varying float vWave; varying float vTop;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float shown = smoothstep(depth - 0.05, depth + 0.35, uReveal);
    vWave = waveAt(depth);
    vTop = size > 30.0 ? 1.0 : 0.0;
    vAlpha = shown;
    float pop = 1.0 + 0.6 * (1.0 - shown) * shown * 4.0;          // a little pop as it appears
    float twinkle = 1.0 + 0.12 * sin(uTime * 1.6 + phase);
    gl_PointSize = size * pop * twinkle * (1.0 + vWave * 0.9) * uScale * uPixelRatio * (14.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }`;
const NODE_FRAGMENT = `
  varying float vAlpha; varying float vWave; varying float vTop;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float core = smoothstep(0.12, 0.0, d);
    float halo = pow(smoothstep(0.5, 0.0, d), 2.2);
    vec3 gold = mix(vec3(0.85, 0.66, 0.29), vec3(1.0, 0.95, 0.82), vTop);
    vec3 col = mix(gold, vec3(1.0), core * 0.7 + vWave * 0.6);
    gl_FragColor = vec4(col, (halo * 0.9 + core) * vAlpha);
  }`;
// each link draws from the student (t = 0) to the shaykh (t = 1) as uReveal passes its depth
const LINE_VERTEX = `${COMMON}
  attribute float t; attribute float d0;
  varying float vAt; varying float vWave; varying float vT;
  void main() {
    vAt = d0 + t; vT = t;
    vWave = waveAt(d0 + t);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;
const LINE_FRAGMENT = `
  uniform float uReveal;
  varying float vAt; varying float vWave; varying float vT;
  void main() {
    if (vAt > uReveal) discard;
    vec3 col = mix(vec3(0.37, 0.70, 0.66), vec3(0.85, 0.66, 0.29), vT);
    gl_FragColor = vec4(mix(col, vec3(1.0, 0.95, 0.8), vWave), 0.4 + vWave * 0.6);
  }`;
const SPARK_VERTEX = `${COMMON}
  attribute vec3 to; attribute float offset; attribute float d0;
  varying float vAlpha;
  void main() {
    float t = fract(uTime * 0.16 + offset);
    vec4 mv = modelViewMatrix * vec4(mix(position, to, t), 1.0);
    vAlpha = sin(t * 3.14159) * smoothstep(d0 + 1.0, d0 + 1.6, uReveal);
    gl_PointSize = 7.0 * uScale * uPixelRatio * (14.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }`;
const SPARK_FRAGMENT = `
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    gl_FragColor = vec4(1.0, 0.9, 0.65, pow(smoothstep(0.5, 0.0, d), 2.0) * vAlpha);
  }`;

const material = (vertexShader, fragmentShader, uniforms) => new THREE.ShaderMaterial({
  vertexShader, fragmentShader, uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
});

const LoginSky = forwardRef(function LoginSky({ variant = 'panel' }, ref) {
  const hostRef = useRef(null);
  const flashRef = useRef(() => Promise.resolve());

  useImperativeHandle(ref, () => ({ flash: () => flashRef.current() }), []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' }); }
    catch { return undefined; }

    const strip = variant === 'strip';
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const sky = loginSky({ depth: strip ? 7 : 9, widest: strip ? 4 : 6 });
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(pixelRatio);
    renderer.setClearColor(0x000000, 0);
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(strip ? 30 : 38, 1, 0.1, 200);
    const tilt = new THREE.Group();     // follows the mouse
    const world = new THREE.Group();    // the network, centred
    world.position.y = -sky.height / 2;
    tilt.add(world);
    if (strip) tilt.rotation.z = Math.PI / 2;   // rising = right to left, the reading direction
    scene.add(tilt);

    const uniforms = {
      uTime: { value: 0 }, uReveal: { value: still ? sky.height + 2 : -0.3 }, uWave: { value: -1 },
      uPixelRatio: { value: pixelRatio }, uScale: { value: strip ? 0.8 : 1 },
    };
    const disposables = [];
    const keep = x => { disposables.push(x); return x; };
    const attr = (geo, name, array, size) => geo.setAttribute(name, new THREE.BufferAttribute(array, size));

    // persons
    const n = sky.nodes.length;
    const nodeGeo = keep(new THREE.BufferGeometry());
    const position = new Float32Array(n * 3), depth = new Float32Array(n), size = new Float32Array(n), phase = new Float32Array(n);
    sky.nodes.forEach((p, i) => {
      position.set([p.x, p.y, p.z], i * 3);
      depth[i] = p.depth;
      size[i] = p.depth === sky.height ? 40 : p.kind === 'me' ? 24 : 13;
      phase[i] = i * 1.7;
    });
    attr(nodeGeo, 'position', position, 3); attr(nodeGeo, 'depth', depth, 1); attr(nodeGeo, 'size', size, 1); attr(nodeGeo, 'phase', phase, 1);
    world.add(new THREE.Points(nodeGeo, keep(material(NODE_VERTEX, NODE_FRAGMENT, uniforms))));

    // threads and sparks
    const m = sky.links.length;
    const linePos = new Float32Array(m * 6), lineT = new Float32Array(m * 2), lineD0 = new Float32Array(m * 2);
    const from = new Float32Array(m * 3), to = new Float32Array(m * 3), offset = new Float32Array(m), sparkD0 = new Float32Array(m);
    sky.links.forEach(([a, b], i) => {
      const pa = sky.nodes[a], pb = sky.nodes[b];
      linePos.set([pa.x, pa.y, pa.z, pb.x, pb.y, pb.z], i * 6);
      lineT.set([0, 1], i * 2);
      lineD0.set([pa.depth, pa.depth], i * 2);
      from.set([pa.x, pa.y, pa.z], i * 3);
      to.set([pb.x, pb.y, pb.z], i * 3);
      offset[i] = (i * 0.61803) % 1;
      sparkD0[i] = pa.depth;
    });
    const lineGeo = keep(new THREE.BufferGeometry());
    attr(lineGeo, 'position', linePos, 3); attr(lineGeo, 't', lineT, 1); attr(lineGeo, 'd0', lineD0, 1);
    world.add(new THREE.LineSegments(lineGeo, keep(material(LINE_VERTEX, LINE_FRAGMENT, uniforms))));
    if (!still) {
      const sparkGeo = keep(new THREE.BufferGeometry());
      attr(sparkGeo, 'position', from, 3); attr(sparkGeo, 'to', to, 3); attr(sparkGeo, 'offset', offset, 1); attr(sparkGeo, 'd0', sparkD0, 1);
      world.add(new THREE.Points(sparkGeo, keep(material(SPARK_VERTEX, SPARK_FRAGMENT, uniforms))));
    }

    // star dust
    const dustCount = strip ? 120 : 220, dust = new Float32Array(dustCount * 3);
    const rnd = (() => { let s = 11; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
    for (let i = 0; i < dustCount; i++) {
      const r = 7 + rnd() * 12, a = rnd() * Math.PI * 2;
      dust.set([Math.cos(a) * r, (rnd() - 0.5) * (sky.height + 14), Math.sin(a) * r], i * 3);
    }
    const dustGeo = keep(new THREE.BufferGeometry());
    attr(dustGeo, 'position', dust, 3);
    const dustPts = new THREE.Points(dustGeo, keep(new THREE.PointsMaterial({ color: 0xfff1cf, size: 0.05, transparent: true, opacity: 0.5, depthWrite: false })));
    tilt.add(dustPts);

    const radius = Math.hypot(sky.height / 2, 4);
    const fit = () => {
      const w = host.clientWidth || 1, h = host.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // the whole chain in view: by height on the panel, by width on the strip
      const half = THREE.MathUtils.degToRad(camera.fov / 2);
      const distance = strip ? (radius / Math.tan(half)) / camera.aspect * 0.95 : radius / Math.sin(half) * 0.9;
      camera.position.set(0, strip ? 0 : -radius * 0.12, distance);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
    };
    fit();
    const ro = new ResizeObserver(() => { fit(); kick(); });   // a still sky must be drawn again
    ro.observe(host);

    // tilt towards the mouse (panel only)
    const target = { x: 0, y: 0 };
    const onMove = ev => {
      target.y = ((ev.clientX / window.innerWidth) - 0.5) * 0.5;
      target.x = ((ev.clientY / window.innerHeight) - 0.5) * 0.18;
    };
    if (!strip && !still) window.addEventListener('pointermove', onMove);

    // the success wave: up the chain in WAVE_SECONDS, resolving when it reaches the top
    let waveDone = null;
    flashRef.current = () => {
      if (still) return Promise.resolve();
      uniforms.uReveal.value = sky.height + 2;
      uniforms.uWave.value = 0;
      return new Promise(resolve => { waveDone = resolve; kick(); });
    };

    let raf = 0, last = performance.now(), visible = true;
    const frame = now => {
      raf = 0;
      if (!visible || document.hidden) return;
      const dt = Math.min(now - last, 100) / 1000;
      last = now;
      if (!still) {
        uniforms.uTime.value += dt;
        if (uniforms.uReveal.value < sky.height + 2) uniforms.uReveal.value += dt * REVEAL_SPEED;
        world.rotation.y += dt * (strip ? 0.12 : 0.08);
        dustPts.rotation.y -= dt * 0.01;
        if (!strip) {
          tilt.rotation.x += (target.x - tilt.rotation.x) * Math.min(1, dt * 3);
          tilt.rotation.y += (target.y - tilt.rotation.y) * Math.min(1, dt * 3);
        }
      }
      if (uniforms.uWave.value >= 0) {
        uniforms.uWave.value += dt * (sky.height / WAVE_SECONDS);
        if (uniforms.uWave.value > sky.height + 1) {
          uniforms.uWave.value = -1;
          waveDone?.(); waveDone = null;
        }
      }
      renderer.render(scene, camera);
      if (!still || uniforms.uWave.value >= 0) raf = requestAnimationFrame(frame);
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
      window.removeEventListener('pointermove', onMove);
      waveDone?.();
      flashRef.current = () => Promise.resolve();
      disposables.forEach(d => d.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [variant]);

  return <div ref={hostRef} className={`login-sky login-sky-${variant}`} aria-hidden="true" />;
});

export default LoginSky;
