import{s as ce,r as b,j as ve}from"./index-13d85a68.js";import{W as de,S as ue,P as fe,G as le,B as S,a as N,L as he,b as pe,c as me,A as ge,d as we,M as ye}from"./three.module-fe52a091.js";function Ae(p){let s=p>>>0;return()=>{s=s+1831565813>>>0;let o=s;return o=Math.imul(o^o>>>15,o|1),o^=o+Math.imul(o^o>>>7,o|61),((o^o>>>14)>>>0)/4294967296}}function Me({seed:p=7,depth:s=9,widest:o=6}={}){const x=Ae(p),h=[];let m=1,r=[0];for(let n=1;n<=s;n++){const g=n/s,a=n===s?1:Math.max(1,Math.round(o*Math.sin(Math.PI*Math.min(g*1.15,1)))),u=Array.from({length:a},()=>m++);r.forEach((w,d)=>{const f=u[Math.floor(d/r.length*u.length)];h.push({from_person_id:w,to_person_id:f}),u.length>1&&x()<.45&&h.push({from_person_id:w,to_person_id:u[Math.floor(x()*u.length)]})}),u.forEach(w=>{h.some(d=>d.to_person_id===w)||h.push({from_person_id:r[Math.floor(x()*r.length)],to_person_id:w})}),r=u}return{persons:[],matnEdges:h,quranEdges:[]}}const xe=p=>ce(Me(p)),Ee=1.6,Re=.9,V=`
  uniform float uTime; uniform float uReveal; uniform float uWave; uniform float uPixelRatio; uniform float uScale;
  float waveAt(float depth) { return uWave < 0.0 ? 0.0 : exp(-pow(depth - uWave, 2.0) * 2.5); }
`,_e=`${V}
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
  }`,Pe=`
  varying float vAlpha; varying float vWave; varying float vTop;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float core = smoothstep(0.12, 0.0, d);
    float halo = pow(smoothstep(0.5, 0.0, d), 2.2);
    vec3 gold = mix(vec3(0.85, 0.66, 0.29), vec3(1.0, 0.95, 0.82), vTop);
    vec3 col = mix(gold, vec3(1.0), core * 0.7 + vWave * 0.6);
    gl_FragColor = vec4(col, (halo * 0.9 + core) * vAlpha);
  }`,We=`${V}
  attribute float t; attribute float d0;
  varying float vAt; varying float vWave; varying float vT;
  void main() {
    vAt = d0 + t; vT = t;
    vWave = waveAt(d0 + t);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`,be=`
  uniform float uReveal;
  varying float vAt; varying float vWave; varying float vT;
  void main() {
    if (vAt > uReveal) discard;
    vec3 col = mix(vec3(0.37, 0.70, 0.66), vec3(0.85, 0.66, 0.29), vT);
    gl_FragColor = vec4(mix(col, vec3(1.0, 0.95, 0.8), vWave), 0.4 + vWave * 0.6);
  }`,Fe=`${V}
  attribute vec3 to; attribute float offset; attribute float d0;
  varying float vAlpha;
  void main() {
    float t = fract(uTime * 0.16 + offset);
    vec4 mv = modelViewMatrix * vec4(mix(position, to, t), 1.0);
    vAlpha = sin(t * 3.14159) * smoothstep(d0 + 1.0, d0 + 1.6, uReveal);
    gl_PointSize = 7.0 * uScale * uPixelRatio * (14.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }`,Te=`
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    gl_FragColor = vec4(1.0, 0.9, 0.65, pow(smoothstep(0.5, 0.0, d), 2.0) * vAlpha);
  }`,I=(p,s,o)=>new me({vertexShader:p,fragmentShader:s,uniforms:o,transparent:!0,depthWrite:!1,blending:ge}),ze=b.forwardRef(function({variant:s="panel"},o){const x=b.useRef(null),h=b.useRef(()=>Promise.resolve());return b.useImperativeHandle(o,()=>({flash:()=>h.current()}),[]),b.useEffect(()=>{var se;const m=x.current;if(!m)return;let r;try{r=new de({antialias:!0,alpha:!0,powerPreference:"low-power"})}catch{return}const n=s==="strip",g=(se=window.matchMedia)==null?void 0:se.call(window,"(prefers-reduced-motion: reduce)").matches,a=xe({depth:n?7:9,widest:n?4:6}),u=Math.min(window.devicePixelRatio||1,2);r.setPixelRatio(u),r.setClearColor(0,0),m.appendChild(r.domElement);const w=new ue,d=new fe(n?30:38,1,.1,200),f=new le,E=new le;E.position.y=-a.height/2,f.add(E),n&&(f.rotation.z=Math.PI/2),w.add(f);const l={uTime:{value:0},uReveal:{value:g?a.height+2:-.3},uWave:{value:-1},uPixelRatio:{value:u},uScale:{value:n?.8:1}},j=[],y=e=>(j.push(e),e),v=(e,t,i,c)=>e.setAttribute(t,new we(i,c)),F=a.nodes.length,P=y(new S),O=new Float32Array(F*3),B=new Float32Array(F),D=new Float32Array(F),X=new Float32Array(F);a.nodes.forEach((e,t)=>{O.set([e.x,e.y,e.z],t*3),B[t]=e.depth,D[t]=e.depth===a.height?40:e.kind==="me"?24:13,X[t]=t*1.7}),v(P,"position",O,3),v(P,"depth",B,1),v(P,"size",D,1),v(P,"phase",X,1),E.add(new N(P,y(I(_e,Pe,l))));const M=a.links.length,$=new Float32Array(M*6),q=new Float32Array(M*2),H=new Float32Array(M*2),K=new Float32Array(M*3),U=new Float32Array(M*3),Y=new Float32Array(M),J=new Float32Array(M);a.links.forEach(([e,t],i)=>{const c=a.nodes[e],_=a.nodes[t];$.set([c.x,c.y,c.z,_.x,_.y,_.z],i*6),q.set([0,1],i*2),H.set([c.depth,c.depth],i*2),K.set([c.x,c.y,c.z],i*3),U.set([_.x,_.y,_.z],i*3),Y[i]=i*.61803%1,J[i]=c.depth});const T=y(new S);if(v(T,"position",$,3),v(T,"t",q,1),v(T,"d0",H,1),E.add(new he(T,y(I(We,be,l)))),!g){const e=y(new S);v(e,"position",K,3),v(e,"to",U,3),v(e,"offset",Y,1),v(e,"d0",J,1),E.add(new N(e,y(I(Fe,Te,l))))}const Q=n?120:220,Z=new Float32Array(Q*3),z=(()=>{let e=11;return()=>(e=e*16807%2147483647)/2147483647})();for(let e=0;e<Q;e++){const t=7+z()*12,i=z()*Math.PI*2;Z.set([Math.cos(i)*t,(z()-.5)*(a.height+14),Math.sin(i)*t],e*3)}const ee=y(new S);v(ee,"position",Z,3);const te=new N(ee,y(new pe({color:16773583,size:.05,transparent:!0,opacity:.5,depthWrite:!1})));f.add(te);const L=Math.hypot(a.height/2,4),oe=()=>{const e=m.clientWidth||1,t=m.clientHeight||1;r.setSize(e,t,!1),d.aspect=e/t;const i=ye.degToRad(d.fov/2),c=n?L/Math.tan(i)/d.aspect*.95:L/Math.sin(i)*.9;d.position.set(0,n?0:-L*.12,c),d.lookAt(0,0,0),d.updateProjectionMatrix()};oe();const ae=new ResizeObserver(()=>{oe(),R()});ae.observe(m);const k={x:0,y:0},ne=e=>{k.y=(e.clientX/window.innerWidth-.5)*.5,k.x=(e.clientY/window.innerHeight-.5)*.18};!n&&!g&&window.addEventListener("pointermove",ne);let A=null;h.current=()=>g?Promise.resolve():(l.uReveal.value=a.height+2,l.uWave.value=0,new Promise(e=>{A=e,R()}));let W=0,C=performance.now(),G=!0;const ie=e=>{if(W=0,!G||document.hidden)return;const t=Math.min(e-C,100)/1e3;C=e,g||(l.uTime.value+=t,l.uReveal.value<a.height+2&&(l.uReveal.value+=t*Ee),E.rotation.y+=t*(n?.12:.08),te.rotation.y-=t*.01,n||(f.rotation.x+=(k.x-f.rotation.x)*Math.min(1,t*3),f.rotation.y+=(k.y-f.rotation.y)*Math.min(1,t*3))),l.uWave.value>=0&&(l.uWave.value+=t*(a.height/Re),l.uWave.value>a.height+1&&(l.uWave.value=-1,A==null||A(),A=null)),r.render(w,d),(!g||l.uWave.value>=0)&&(W=requestAnimationFrame(ie))},R=()=>{W||(C=performance.now(),W=requestAnimationFrame(ie))},re=new IntersectionObserver(([e])=>{G=e.isIntersecting,G&&R()});return re.observe(m),document.addEventListener("visibilitychange",R),R(),()=>{cancelAnimationFrame(W),re.disconnect(),ae.disconnect(),document.removeEventListener("visibilitychange",R),window.removeEventListener("pointermove",ne),A==null||A(),h.current=()=>Promise.resolve(),j.forEach(e=>e.dispose()),r.dispose(),r.domElement.remove()}},[s]),ve.jsx("div",{ref:x,className:`login-sky login-sky-${s}`,"aria-hidden":"true"})});export{ze as default};
