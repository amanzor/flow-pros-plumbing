/* Hero "arcane liquid" WebGL background — domain-warped flowing water
   with electric-blue caustics, wizard-purple veins and ember-orange sparks.
   Exposes window.HeroShader = { start, stop, setIntro(v), splash(x,y) } */
(function () {
  const canvas = document.getElementById("heroGL");
  if (!canvas) return;
  const gl = canvas.getContext("webgl", { antialias: false, alpha: false, premultipliedAlpha: false });
  if (!gl) { canvas.style.background = "radial-gradient(circle at 60% 40%, #12307a, #04060f 70%)"; return; }

  const vert = `attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;
  const frag = `
precision highp float;
uniform vec2 uRes; uniform float uTime; uniform vec2 uMouse; uniform float uIntro;
uniform vec3 uSplash; // x,y (0-1), t since splash

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y);
}
float fbm(vec2 p){
  float v = 0., a = .5;
  mat2 r = mat2(.8,.6,-.6,.8);
  for(int i=0;i<5;i++){ v += a*noise(p); p = r*p*2.02 + 3.1; a *= .5; }
  return v;
}
void main(){
  vec2 uv = gl_FragCoord.xy / uRes.xy;
  vec2 p = (gl_FragCoord.xy - .5*uRes.xy) / uRes.y;
  float t = uTime * .08;

  // mouse swirl
  vec2 m = (uMouse - .5) * vec2(uRes.x/uRes.y, 1.);
  float md = length(p - m);
  p += normalize(p - m + 1e-4) * .06 * exp(-md*4.) * sin(md*18. - uTime*3.);

  // splash ripple
  vec2 sp = (uSplash.xy - .5) * vec2(uRes.x/uRes.y, 1.);
  float sd = length(p - sp);
  float st = uSplash.z;
  float ring = sin(sd*40. - st*14.) * exp(-sd*3.) * exp(-st*1.2) * step(0., st);
  p += normalize(p - sp + 1e-4) * ring * .03;

  vec2 q = vec2(fbm(p*1.6 + vec2(0., t)), fbm(p*1.6 + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(p*1.6 + 3.5*q + vec2(1.7, 9.2) + t*1.5), fbm(p*1.6 + 3.5*q + vec2(8.3, 2.8) - t*1.2));
  float f = fbm(p*1.8 + 4.*r);

  vec3 deep = vec3(.012,.02,.06);
  vec3 navy = vec3(.03,.07,.2);
  vec3 water = vec3(.12,.55,1.);
  vec3 cyan = vec3(.55,.9,1.);
  vec3 arcane = vec3(.45,.2,.9);
  vec3 ember = vec3(1.,.42,.1);

  vec3 col = mix(deep, navy, smoothstep(.2,.8,f));
  col = mix(col, arcane*.55, smoothstep(.45,.95,length(q)) * .55);
  col = mix(col, water*.7, smoothstep(.55,.95,r.x) * .65);
  // caustic highlights
  float c = pow(smoothstep(.62,.98, f + .25*r.y), 3.);
  col += cyan * c * .9;
  // ember sparks in the warps
  float e = pow(smoothstep(.78,1., r.y * q.x * 1.9), 4.);
  col += ember * e * .55;
  // splash glow
  col += cyan * abs(ring) * 1.2;

  // focus glow behind emblem (right side on desktop)
  float aspect = uRes.x/uRes.y;
  vec2 fc = aspect > 1.1 ? vec2(.28*aspect, .02) : vec2(0., .22);
  col += water * .18 * exp(-length(p - fc)*2.2);

  // vignette & intro
  col *= .55 + .45*smoothstep(1.2,.1,length(uv-.5));
  col *= uIntro;
  gl_FragColor = vec4(col, 1.);
}`;

  function sh(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); }
    return s;
  }
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, vert));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(prog);
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const U = {};
  ["uRes", "uTime", "uMouse", "uIntro", "uSplash"].forEach(n => U[n] = gl.getUniformLocation(prog, n));

  const state = { intro: 0, mouse: [.6, .5], target: [.6, .5], splash: [.5, .5, -1], running: false, raf: 0, t0: performance.now() };
  const scale = Math.min(window.devicePixelRatio || 1, 1.5) * (window.innerWidth < 760 ? .5 : .6);

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = Math.max(1, Math.floor(w * scale));
    canvas.height = Math.max(1, Math.floor(h * scale));
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  window.addEventListener("resize", resize);
  resize();

  window.addEventListener("pointermove", e => {
    const r = canvas.getBoundingClientRect();
    state.target = [(e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height];
  }, { passive: true });

  let splashStart = 0;
  function frame(now) {
    if (!state.running) return;
    const t = (now - state.t0) / 1000;
    state.mouse[0] += (state.target[0] - state.mouse[0]) * .05;
    state.mouse[1] += (state.target[1] - state.mouse[1]) * .05;
    gl.uniform2f(U.uRes, canvas.width, canvas.height);
    gl.uniform1f(U.uTime, t);
    gl.uniform2f(U.uMouse, state.mouse[0], state.mouse[1]);
    gl.uniform1f(U.uIntro, state.intro);
    const st = state.splash[2] < 0 ? -1 : (now - splashStart) / 1000;
    gl.uniform3f(U.uSplash, state.splash[0], state.splash[1], st);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    state.raf = requestAnimationFrame(frame);
  }

  window.HeroShader = {
    state,
    start() { if (state.running) return; state.running = true; state.raf = requestAnimationFrame(frame); },
    stop() { state.running = false; cancelAnimationFrame(state.raf); },
    splash(x, y) { state.splash = [x, 1 - y, 0]; splashStart = performance.now(); }
  };
})();
