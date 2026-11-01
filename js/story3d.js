/* =========================================================
   FLOW PROS — "The Wizard's Descent" real-time 3D scene
   Luxury neon bathroom -> whirlpool -> down the drain ->
   pipe network -> leak found -> sealed -> exit flash.
   Driven entirely by window.Story3DState (animated by GSAP in main.js).
   ========================================================= */
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const S = window.Story3DState || (window.Story3DState = {
  camBath: 0, water: 0, glow: 0, vortex: 0, grate: 0, pipe: 0, leakU: .58,
  look: 0, alert: 0, fixed: 0, crack: 1, flow: .5, exit: 0, active: true
});
const canvas = document.getElementById("story3d");
const veilEl = document.getElementById("waterVeil");
const anomalyTag = document.getElementById("anomalyTag");
const leakTag = document.getElementById("leakTag");
const MOBILE = matchMedia("(max-width: 760px), (pointer: coarse)").matches;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: !MOBILE, powerPreference: "high-performance" });
} catch (e) {
  console.warn("WebGL unavailable", e);
}

if (renderer) init();

function init() {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MOBILE ? 1.25 : 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .95;
  renderer.shadowMap.enabled = !MOBILE;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const ANISO = renderer.capabilities.getMaxAnisotropy();

  const scene = new THREE.Scene();
  const BATH_FOG = new THREE.Color(0x050816), PIPE_FOG = new THREE.Color(0x010206), WATER_FOG = new THREE.Color(0x03204a);
  scene.background = new THREE.Color(0x03050d);
  scene.fog = new THREE.FogExp2(BATH_FOG.clone(), 0.028);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.002, 60);
  scene.add(camera);

  /* ---------------- helpers ---------------- */
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp01 = v => Math.min(1, Math.max(0, v));
  const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  function canvasTex(w, h, draw, srgb = true) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d"); draw(g, w, h);
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = ANISO;
    return t;
  }
  function speckle(g, w, h, n, a, light = true) {
    for (let i = 0; i < n; i++) {
      g.fillStyle = light ? `rgba(255,255,255,${Math.random() * a})` : `rgba(0,0,0,${Math.random() * a})`;
      const s = Math.random() * 2 + .5; g.fillRect(Math.random() * w, Math.random() * h, s, s);
    }
  }
  const glowColor = (hex, k) => new THREE.Color(hex).multiplyScalar(k);

  /* ---------------- environment (neon reflections) ---------------- */
  {
    const env = new THREE.Scene();
    env.background = new THREE.Color(0x020308);
    const add = (hex, k, w, h, pos, rot) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: glowColor(hex, k), side: THREE.DoubleSide }));
      m.position.set(...pos); if (rot) m.rotation.set(...rot); env.add(m);
    };
    add(0x2ea8ff, 5, .5, 7, [-3, 0, -9.5]); add(0x2ea8ff, 5, .5, 7, [3, 0, -9.5]);
    add(0x7b3fe4, 3.5, 12, .8, [-9.5, 2.5, 0], [0, Math.PI / 2, 0]);
    add(0xff6a1a, 3, 14, .4, [0, -3.5, 9.5], [0, Math.PI, 0]);
    add(0xcfe6ff, 2.2, 5, 5, [0, 6, 0], [Math.PI / 2, 0, 0]);
    add(0x2a1a5e, 1.2, 10, 6, [9.5, 0, 0], [0, -Math.PI / 2, 0]);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, .03).texture;
    pm.dispose();
  }

  /* ---------------- textures ---------------- */
  const floorTex = canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = "#1c2130"; g.fillRect(0, 0, w, h);
    const gr = 6;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      const l = rnd(5, 8);
      g.fillStyle = `hsl(226, 14%, ${l}%)`;
      g.fillRect(i * w / 2 + gr, j * h / 2 + gr, w / 2 - gr * 2, h / 2 - gr * 2);
      const gg = g.createLinearGradient(i * w / 2, j * h / 2, i * w / 2 + w / 2, j * h / 2 + h / 2);
      gg.addColorStop(0, "rgba(120,140,200,.05)"); gg.addColorStop(.5, "rgba(0,0,0,0)"); gg.addColorStop(1, "rgba(120,140,200,.04)");
      g.fillStyle = gg; g.fillRect(i * w / 2 + gr, j * h / 2 + gr, w / 2 - gr * 2, h / 2 - gr * 2);
    }
    speckle(g, w, h, 9000, .05); speckle(g, w, h, 6000, .2, false);
  });
  const floorRough = canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = "#e0e0e0"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#3c3c3c";
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) g.fillRect(i * w / 2 + 6, j * h / 2 + 6, w / 2 - 12, h / 2 - 12);
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(90,90,90,${rnd(.05, .15)})`; g.beginPath(); g.arc(rnd(0, w), rnd(0, h), rnd(30, 160), 0, 7); g.fill(); }
  }, false);
  floorTex.repeat.set(7, 7); floorRough.repeat.set(7, 7);

  const marbleTex = canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = "#080a10"; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 34; k++) {
      g.strokeStyle = `rgba(${rnd(120, 170)},${rnd(140, 180)},${rnd(190, 230)},${rnd(.03, .13)})`;
      g.lineWidth = rnd(.6, 3);
      g.beginPath();
      let x = rnd(-100, w), y = rnd(-100, 0);
      g.moveTo(x, y);
      for (let s = 0; s < 8; s++) { const nx = x + rnd(-60, 160), ny = y + rnd(80, 200); g.bezierCurveTo(x + rnd(-80, 80), y + rnd(0, 90), nx + rnd(-80, 80), ny - rnd(0, 90), nx, ny); x = nx; y = ny; }
      g.stroke();
    }
    speckle(g, w, h, 5000, .04);
    g.fillStyle = "rgba(0,0,0,.6)";
    for (let i = 1; i < 4; i++) g.fillRect(i * w / 4 - 1, 0, 2, h);
  });
  marbleTex.repeat.set(3, 1.2);

  const skylineTex = canvasTex(2048, 1024, (g, w, h) => {
    const hz = h * .74;
    const sky = g.createLinearGradient(0, 0, 0, hz);
    sky.addColorStop(0, "#04050f"); sky.addColorStop(.45, "#140c33"); sky.addColorStop(.8, "#4a1c55"); sky.addColorStop(1, "#c4513a");
    g.fillStyle = sky; g.fillRect(0, 0, w, hz);
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(255,255,255,${rnd(.1, .8)})`; g.fillRect(rnd(0, w), rnd(0, hz * .6), 1.5, 1.5); }
    const moon = g.createRadialGradient(1560, 210, 0, 1560, 210, 160);
    moon.addColorStop(0, "rgba(255,240,220,1)"); moon.addColorStop(.25, "rgba(255,230,200,.9)"); moon.addColorStop(.3, "rgba(255,180,140,.25)"); moon.addColorStop(1, "rgba(255,120,80,0)");
    g.fillStyle = moon; g.beginPath(); g.arc(1560, 210, 160, 0, 7); g.fill();
    // bay
    const bay = g.createLinearGradient(0, hz, 0, h);
    bay.addColorStop(0, "#2a1640"); bay.addColorStop(1, "#03040a");
    g.fillStyle = bay; g.fillRect(0, hz, w, h - hz);
    // skyline
    let x = 0;
    const lights = ["#ffd58a", "#8fe3ff", "#ffb36b", "#c9a6ff"];
    while (x < w) {
      const bw = rnd(50, 150), bh = rnd(90, 470) * (x > 500 && x < 1300 ? 1.25 : 1);
      g.fillStyle = "#05060d"; g.fillRect(x, hz - bh, bw, bh);
      for (let wy = hz - bh + 10; wy < hz - 6; wy += 13) for (let wx = x + 6; wx < x + bw - 6; wx += 10) {
        if (Math.random() < .32) { g.fillStyle = lights[(Math.random() * lights.length) | 0]; g.globalAlpha = rnd(.35, .95); g.fillRect(wx, wy, 5, 7); g.globalAlpha = 1; }
      }
      if (Math.random() < .3) { g.fillStyle = "#ff3b3b"; g.fillRect(x + bw / 2 - 2, hz - bh - 14, 4, 4); }
      // reflection
      g.fillStyle = "rgba(255,190,120,.06)"; g.fillRect(x + bw * .3, hz + 4, bw * .4, rnd(40, 180));
      x += bw + rnd(4, 26);
    }
    // palms
    const palm = (px, s) => {
      g.strokeStyle = "#010103"; g.fillStyle = "#010103"; g.lineWidth = 14 * s;
      g.beginPath(); g.moveTo(px, h); g.quadraticCurveTo(px + 60 * s, h - 300 * s, px + 30 * s, h - 520 * s); g.stroke();
      const tx = px + 30 * s, ty = h - 520 * s;
      for (let i = 0; i < 9; i++) {
        const a = -Math.PI + (i / 8) * Math.PI + rnd(-.15, .15);
        g.lineWidth = 6 * s; g.beginPath(); g.moveTo(tx, ty);
        g.quadraticCurveTo(tx + Math.cos(a) * 140 * s, ty + Math.sin(a) * 90 * s - 40 * s, tx + Math.cos(a) * 240 * s, ty + Math.sin(a) * 60 * s + 90 * s); g.stroke();
      }
    };
    palm(120, 1.3); palm(330, 1); palm(1900, 1.2);
  });
  skylineTex.wrapS = skylineTex.wrapT = THREE.ClampToEdgeWrapping;

  const dotTex = canvasTex(64, 64, (g) => {
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(.35, "rgba(255,255,255,.45)"); r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  });
  const glowTex = canvasTex(256, 256, (g) => {
    const r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(.4, "rgba(255,255,255,.35)"); r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r; g.fillRect(0, 0, 256, 256);
  });

  // tiling water normal map from summed periodic waves
  const waterNormal = (() => {
    const N = 256, c = document.createElement("canvas"); c.width = c.height = N;
    const g = c.getContext("2d"), img = g.createImageData(N, N);
    const waves = Array.from({ length: 7 }, () => ({ kx: (Math.random() * 8 | 0) - 4 || 1, ky: (Math.random() * 8 | 0) - 4 || 2, p: rnd(0, 6.28), a: rnd(.4, 1) }));
    const H = (x, y) => waves.reduce((s, w) => s + w.a * Math.sin(2 * Math.PI * (w.kx * x + w.ky * y) / N + w.p), 0);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = H(x + 1, y) - H(x - 1, y), dy = H(x, y + 1) - H(x, y - 1);
      let nx = -dx * .9, ny = -dy * .9, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      const i = (y * N + x) * 4; img.data[i] = (nx * .5 + .5) * 255; img.data[i + 1] = (ny * .5 + .5) * 255; img.data[i + 2] = (nz * .5 + .5) * 255; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  })();

  /* ---------------- materials ---------------- */
  const chrome = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: .08, envMapIntensity: 1.4 });
  const neon = hex => new THREE.MeshBasicMaterial({ color: glowColor(hex, 5), toneMapped: false });

  /* =========================================================
     BATHROOM
     ========================================================= */
  const bath = new THREE.Group(); scene.add(bath);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14),
    new THREE.MeshStandardMaterial({ map: floorTex, roughnessMap: floorRough, roughness: .55, metalness: .15, envMapIntensity: .9 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; bath.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({ map: marbleTex, roughness: .3, metalness: .1, envMapIntensity: .5 });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(14, 5), wallMat);
  back.position.set(0, 2.5, -2.2); back.receiveShadow = true; bath.add(back);
  const right = new THREE.Mesh(new THREE.PlaneGeometry(10, 5), wallMat);
  right.position.set(3.4, 2.5, 1); right.rotation.y = -Math.PI / 2; bath.add(right);
  const left = new THREE.Mesh(new THREE.PlaneGeometry(10, 5), wallMat);
  left.position.set(-3.2, 2.5, 1); left.rotation.y = Math.PI / 2; bath.add(left);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshStandardMaterial({ color: 0x05060b, roughness: .9 }));
  ceil.position.y = 3.8; ceil.rotation.x = Math.PI / 2; bath.add(ceil);

  // window with Miami night skyline
  const win = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.1), new THREE.MeshBasicMaterial({ map: skylineTex, color: new THREE.Color(1.15, 1.15, 1.15) }));
  win.position.set(-3.18, 1.65, -.1); win.rotation.y = Math.PI / 2; bath.add(win);
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x0a0b10, metalness: .8, roughness: .35 });
  [[0, 1.05, 3.7, .05], [0, -1.05, 3.7, .05], [-1.8, 0, .05, 2.15], [1.8, 0, .05, 2.15], [-.6, 0, .03, 2.1], [.6, 0, .03, 2.1]].forEach(([z, y, wz, hy]) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(.06, hy, wz), frameMat);
    b.position.set(-3.15, 1.65 + y, -.1 + z); bath.add(b);
  });
  const moonLight = new THREE.PointLight(0xff9a6a, 3, 6, 1.6); moonLight.position.set(-2.6, 1.8, -.1); bath.add(moonLight);

  // neon strips
  [-1.65, 1.65].forEach(x => {
    const s = new THREE.Mesh(new THREE.BoxGeometry(.035, 2.6, .035), neon(0x2ea8ff));
    s.position.set(x, 1.6, -2.17); bath.add(s);
    const l = new THREE.PointLight(0x2ea8ff, 4, 4.5, 1.7); l.position.set(x, 1.4, -1.9); bath.add(l);
  });
  const cove = new THREE.Mesh(new THREE.BoxGeometry(9, .025, .03), neon(0xff6a1a));
  cove.position.set(0, .02, -2.17); bath.add(cove);
  const coveL = new THREE.PointLight(0xff6a1a, 3, 3.5, 1.8); coveL.position.set(0, .15, -1.95); bath.add(coveL);
  const topCove = new THREE.Mesh(new THREE.BoxGeometry(9, .025, .03), neon(0x7b3fe4));
  topCove.position.set(0, 3.5, -2.17); bath.add(topCove);
  const purple = new THREE.PointLight(0x8a4dff, 4, 6, 1.6); purple.position.set(-2.2, 2.6, .8); bath.add(purple);

  // logo neon sign on the back wall
  const logoGroup = new THREE.Group(); logoGroup.position.set(0, 1.78, -2.15); bath.add(logoGroup);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.MeshBasicMaterial({ map: glowTex, color: new THREE.Color(.12, .18, .6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  halo.position.z = .005; logoGroup.add(halo);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.6, .012, 12, 96), neon(0x5fd4ff)); ring.position.z = .02; logoGroup.add(ring);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(.64, .006, 8, 96), neon(0xff6a1a)); ring2.position.z = .02; logoGroup.add(ring2);
  new THREE.TextureLoader().load("assets/logo.webp", t => {
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = ANISO;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.12, 1.12), new THREE.MeshBasicMaterial({ map: t, transparent: true, color: new THREE.Color(1.25, 1.25, 1.25), toneMapped: false }));
    m.position.z = .03; logoGroup.add(m);
  });

  // ---- the tub (lathe, scaled to an oval) ----
  const TUB = new THREE.Vector3(.85, 1, .42);
  const tub = new THREE.Group(); tub.scale.copy(TUB); bath.add(tub);
  const outerPts = [[.001, 0], [.7, 0], [.8, .04], [.92, .18], [.985, .38], [1, .52], [.995, .585], [.965, .605], [.925, .6]].map(([r, y]) => new THREE.Vector2(r, y));
  const innerPts = [[.925, .6], [.905, .5], [.88, .35], [.82, .22], [.68, .13], [.4, .105], [.001, .1]].map(([r, y]) => new THREE.Vector2(r, y));
  const tubOuter = new THREE.Mesh(new THREE.LatheGeometry(outerPts, 128),
    new THREE.MeshPhysicalMaterial({ color: 0x0b0d14, roughness: .22, metalness: .3, clearcoat: 1, clearcoatRoughness: .06, envMapIntensity: 1.3, side: THREE.DoubleSide }));
  tubOuter.castShadow = true; tub.add(tubOuter);
  const tubInner = new THREE.Mesh(new THREE.LatheGeometry(innerPts, 128),
    new THREE.MeshPhysicalMaterial({ color: 0xc9d0dc, roughness: .2, clearcoat: 1, clearcoatRoughness: .04, envMapIntensity: 1, side: THREE.DoubleSide }));
  tubInner.receiveShadow = true; tub.add(tubInner);
  const rimLine = new THREE.Mesh(new THREE.TorusGeometry(.996, .0045, 8, 160), new THREE.MeshStandardMaterial({ color: 0xd9a35c, metalness: 1, roughness: .2 }));
  rimLine.rotation.x = Math.PI / 2; rimLine.position.y = .56; tub.add(rimLine);
  const under = new THREE.Mesh(new THREE.TorusGeometry(.74, .012, 8, 160), neon(0x2ea8ff));
  under.rotation.x = Math.PI / 2; under.position.y = .012; tub.add(under);
  const underL = new THREE.PointLight(0x2ea8ff, 1.4, 1.6, 1.5); underL.position.set(0, .05, .5); bath.add(underL);

  // ---- drain ----
  const DRAIN = new THREE.Vector3(0, .1, 0), DR = .06;
  const drainRing = new THREE.Mesh(new THREE.TorusGeometry(DR, .007, 12, 48), chrome);
  drainRing.rotation.x = -Math.PI / 2; drainRing.position.set(0, .103, 0); bath.add(drainRing);
  const holeMat = new THREE.MeshBasicMaterial({ map: glowTex, color: new THREE.Color(0, 0, 0), toneMapped: false });
  const hole = new THREE.Mesh(new THREE.CircleGeometry(DR, 48), holeMat);
  hole.rotation.x = -Math.PI / 2; hole.position.set(0, .1015, 0); bath.add(hole);
  const holeBack = new THREE.Mesh(new THREE.CircleGeometry(DR, 48), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  holeBack.rotation.x = -Math.PI / 2; holeBack.position.set(0, .1012, 0); bath.add(holeBack);
  const grateAlpha = canvasTex(256, 256, (g) => {
    g.fillStyle = "#000"; g.fillRect(0, 0, 256, 256);
    g.fillStyle = "#fff"; g.beginPath(); g.arc(128, 128, 126, 0, 7); g.fill();
    g.strokeStyle = "#000"; g.lineWidth = 9;
    [34, 58, 82, 106].forEach((r, k) => { for (let a = 0; a < 6; a++) { g.beginPath(); g.arc(128, 128, r, a * 1.047 + k * .3 + .12, a * 1.047 + k * .3 + .9); g.stroke(); } });
  }, false);
  const grateMat = chrome.clone(); grateMat.alphaMap = grateAlpha; grateMat.alphaTest = .5; grateMat.transparent = true;
  const grate = new THREE.Mesh(new THREE.CylinderGeometry(DR * .97, DR * .97, .005, 48), grateMat);
  grate.position.set(0, .105, 0); bath.add(grate);
  const drainLight = new THREE.PointLight(0xff2a1a, 0, .9, 1.4); drainLight.position.set(0, .16, 0); bath.add(drainLight);

  // ---- water (displaced ring mesh: ripples + whirlpool) ----
  const waterGeo = new THREE.RingGeometry(.001, .905, 112, 44); waterGeo.rotateX(-Math.PI / 2);
  const wPos = waterGeo.attributes.position, wBase = Float32Array.from(wPos.array);
  waterNormal.repeat.set(3, 3);
  const waterMat = MOBILE
    ? new THREE.MeshStandardMaterial({ color: 0x2a9be0, roughness: .04, metalness: .25, transparent: true, opacity: .72, normalMap: waterNormal, normalScale: new THREE.Vector2(.35, .35), envMapIntensity: 1.4, side: THREE.DoubleSide })
    : new THREE.MeshPhysicalMaterial({ color: 0xbfeeff, transmission: 1, thickness: .3, roughness: .03, ior: 1.33, metalness: 0, attenuationColor: new THREE.Color(0x1478d4), attenuationDistance: .35, normalMap: waterNormal, normalScale: new THREE.Vector2(.3, .3), envMapIntensity: 1.3, side: THREE.DoubleSide });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.scale.set(TUB.x, 1, TUB.z); bath.add(water);

  // ---- floor-mounted tub filler faucet ----
  const FX = .98;
  const spoutCurve = new THREE.CatmullRomCurve3([[FX, 0, 0], [FX, .85, 0], [FX - .02, 1.0, 0], [FX - .12, 1.06, 0], [FX - .22, 1.0, 0], [FX - .24, .92, 0]].map(p => new THREE.Vector3(...p)));
  const spout = new THREE.Mesh(new THREE.TubeGeometry(spoutCurve, 80, .02, 20), chrome); spout.castShadow = true; bath.add(spout);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(.055, .07, .03, 32), chrome); base.position.set(FX, .015, 0); bath.add(base);
  const lever = new THREE.Mesh(new THREE.BoxGeometry(.012, .012, .1), chrome); lever.position.set(FX, .72, .05); lever.rotation.x = -.4; bath.add(lever);
  const SPOUT_TIP = new THREE.Vector3(FX - .24, .905, 0);
  const drip = new THREE.Mesh(new THREE.SphereGeometry(.009, 16, 12), new THREE.MeshPhysicalMaterial({ color: 0xcff4ff, transmission: MOBILE ? 0 : 1, roughness: 0, thickness: .02, ior: 1.33, transparent: MOBILE, opacity: .8 }));
  drip.position.copy(SPOUT_TIP); bath.add(drip);

  // ---- key light + volumetric beam ----
  const key = new THREE.SpotLight(0xd6e8ff, 22, 9, .48, .8, 1.6);
  key.position.set(.35, 3.6, .55); key.target.position.set(0, .2, 0);
  key.castShadow = !MOBILE; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -.0004; key.shadow.normalBias = .02;
  bath.add(key, key.target);
  const hemi = new THREE.HemisphereLight(0x2a3a7a, 0x05050a, .35); bath.add(hemi);

  const beamH = 3.5;
  const beamMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(0x9fd0ff) }, uOpacity: { value: .1 } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying float vY;
      void main(){ vY = uv.y; vec4 mv = modelViewMatrix * vec4(position,1.); vV = normalize(-mv.xyz); vN = normalize(normalMatrix*normal); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying vec3 vN; varying vec3 vV; varying float vY;
      void main(){ float e = pow(abs(dot(vN, vV)), 2.5); float a = e * smoothstep(0., .9, vY) * uOpacity; gl_FragColor = vec4(uColor, a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
  });
  const beam = new THREE.Mesh(new THREE.ConeGeometry(1.15, beamH, 48, 1, true), beamMat);
  {
    const dir = new THREE.Vector3().subVectors(key.target.position, key.position).normalize();
    beam.position.copy(key.position).addScaledVector(dir, beamH / 2);
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().negate());
  }
  bath.add(beam);

  // ---- atmosphere: dust in the beam, steam over the water ----
  // round, soft additive particles (shader-based so they never render as squares)
  function points(n, fill, size, color, opacity) {
    const geo = new THREE.BufferGeometry(), arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) fill(arr, i * 3, i);
    geo.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color) }, uSize: { value: size }, uOpacity: { value: opacity }, uScale: { value: 400 } },
      vertexShader: `uniform float uSize; uniform float uScale; varying float vFade;
        void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); gl_Position = projectionMatrix * mv;
          float d = -mv.z; gl_PointSize = clamp(uSize * uScale / max(d, .001), 0., 48.); vFade = smoothstep(.0, .02, d); }`,
      fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying float vFade;
        void main(){ float r = length(gl_PointCoord - .5); float a = smoothstep(.5, .0, r); a *= a; gl_FragColor = vec4(uColor, a * uOpacity * vFade); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
    Object.defineProperty(mat, "opacity", { get: () => mat.uniforms.uOpacity.value, set: v => { if (mat.uniforms) mat.uniforms.uOpacity.value = v; } });
    const p = new THREE.Points(geo, mat); p.frustumCulled = false; allPoints.push(mat); return p;
  }
  const allPoints = [];
  const dust = points(MOBILE ? 160 : 360, (a, i) => { a[i] = rnd(-1.6, 1.6); a[i + 1] = rnd(0, 3.3); a[i + 2] = rnd(-1.6, 1.6); }, .012, 0xcfe6ff, .55);
  bath.add(dust);
  const steam = points(70, (a, i) => { a[i] = rnd(-.6, .6); a[i + 1] = rnd(.45, 1.2); a[i + 2] = rnd(-.25, .25); }, .25, 0x9fbfe0, .045);
  bath.add(steam);
  const bubbles = points(140, (a, i) => { a[i] = 0; a[i + 1] = -10; a[i + 2] = 0; }, .012, 0xe6f8ff, 0);
  const bubbleData = Array.from({ length: 140 }, () => ({ ph: Math.random(), a: rnd(0, 6.28), r0: rnd(.25, .8), sp: rnd(.12, .3) }));
  bath.add(bubbles);

  /* =========================================================
     PIPE NETWORK (below the floor)
     ========================================================= */
  const pipeGroup = new THREE.Group(); pipeGroup.visible = false; scene.add(pipeGroup);
  const R = DR;
  const pipeCurve = new THREE.CatmullRomCurve3([
    [0, .1, 0], [0, -.25, -.01], [0, -.7, -.06], [.04, -1.05, -.35], [.25, -1.18, -.95], [.85, -1.24, -1.55],
    [1.6, -1.2, -1.9], [2.2, -1.15, -2.6], [2.4, -1.2, -3.5], [2.1, -1.28, -4.4], [1.4, -1.3, -5.0], [.6, -1.26, -5.6],
    [.2, -1.22, -6.5], [.3, -1.2, -7.5], [.9, -1.25, -8.3], [1.8, -1.3, -8.8], [2.6, -1.3, -9.4]
  ].map(p => new THREE.Vector3(...p)), false, "centripetal");
  const PL = pipeCurve.getLength();

  const pipeTex = canvasTex(512, 384, (g, w, h) => {
    const b = g.createLinearGradient(0, 0, 0, h);
    b.addColorStop(0, "#2b313d"); b.addColorStop(.5, "#3a414f"); b.addColorStop(1, "#262b35");
    g.fillStyle = b; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 220; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? "255,255,255" : "0,0,0"},${rnd(.02, .07)})`; g.fillRect(0, rnd(0, h), w, rnd(1, 3)); }
    for (let i = 0; i < 26; i++) {
      const x = rnd(40, w), y = rnd(0, h), r = rnd(10, 60);
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, `rgba(${rnd(110, 150)},${rnd(55, 75)},30,${rnd(.25, .55)})`); rg.addColorStop(1, "rgba(90,50,20,0)");
      g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
    speckle(g, w, h, 5000, .12, false); speckle(g, w, h, 2500, .06);
    // coupling band + bolts
    const cg = g.createLinearGradient(0, 0, 34, 0);
    cg.addColorStop(0, "#1a1d24"); cg.addColorStop(.3, "#7d8799"); cg.addColorStop(.55, "#aab4c6"); cg.addColorStop(1, "#1a1d24");
    g.fillStyle = cg; g.fillRect(0, 0, 34, h);
    for (let y = 16; y < h; y += 48) { g.fillStyle = "#cfd6e4"; g.beginPath(); g.arc(17, y, 5, 0, 7); g.fill(); g.fillStyle = "#222"; g.beginPath(); g.arc(18, y + 1, 2, 0, 7); g.fill(); }
  });
  pipeTex.repeat.set(PL / .5, 1);
  const pipe = new THREE.Mesh(new THREE.TubeGeometry(pipeCurve, 1100, R, 40, false),
    new THREE.MeshStandardMaterial({ map: pipeTex, bumpMap: pipeTex, bumpScale: 1.2, roughness: .5, metalness: .7, envMapIntensity: .25, side: THREE.BackSide }));
  pipeGroup.add(pipe);

  // precomputed frames: position, tangent, "bottom" (toward gravity), side
  const NS = 900, FP = [], FT = [], FB = [], FS = [];
  {
    const down = new THREE.Vector3(0, -1, 0); let prevB = new THREE.Vector3(0, 0, 1);
    for (let i = 0; i < NS; i++) {
      const u = i / (NS - 1);
      const p = pipeCurve.getPointAt(u), t = pipeCurve.getTangentAt(u);
      let b = down.clone().addScaledVector(t, -t.dot(down));
      if (b.length() < .25) b = prevB.clone().addScaledVector(t, -t.dot(prevB));
      b.normalize(); prevB = b;
      FP.push(p); FT.push(t); FB.push(b); FS.push(new THREE.Vector3().crossVectors(t, b).normalize());
    }
  }
  const frameAt = u => Math.min(NS - 1, Math.max(0, Math.round(u * (NS - 1))));

  // water running along the bottom of the pipe (horizontal runs only)
  {
    const pos = [], uv = [], idx = [];
    let n = 0;
    for (let i = 0; i < NS; i++) {
      if (Math.abs(FT[i].y) > .6) continue;
      const c = FP[i].clone().addScaledVector(FB[i], R * .5), half = R * .86;
      const a = c.clone().addScaledVector(FS[i], half), b = c.clone().addScaledVector(FS[i], -half);
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
      const u = (i / (NS - 1)) * PL / .35; uv.push(u, 0, u, 1);
      if (n > 0) { const k = n * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
      n++;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    var pipeWaterNormal = waterNormal.clone(); pipeWaterNormal.repeat.set(1, 1); pipeWaterNormal.needsUpdate = true;
    var pipeWater = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x1b7fd6, emissive: 0x0a3f78, emissiveIntensity: .7, roughness: .28, metalness: .15, transparent: true, opacity: .85, normalMap: pipeWaterNormal, normalScale: new THREE.Vector2(.25, .25), envMapIntensity: .35, side: THREE.DoubleSide }));
    pipeGroup.add(pipeWater);
  }

  // drifting droplets / bubbles inside the pipe
  const PD = MOBILE ? 260 : 520;
  const pdData = Array.from({ length: PD }, () => ({ u: Math.random(), a: rnd(-1.2, 1.2), r: rnd(.25, .9), v: rnd(.6, 1.4) }));
  const pipeDrops = points(PD, (a, i) => { a[i + 1] = -50; }, .0035, 0xbfeeff, .8);
  pipeGroup.add(pipeDrops);

  // headlamp
  const lamp = new THREE.SpotLight(0xe4f2ff, 0, 2.2, 1.1, 1, 1.1);
  lamp.position.set(0, 0, 0); lamp.target.position.set(0, 0, -1);
  camera.add(lamp, lamp.target);

  // ---- the leak ----
  const crackPts = [[.08, .18], [.3, .32], [.27, .45], [.52, .52], [.47, .65], [.76, .84]];
  const branches = [[[.3, .32], [.5, .26], [.62, .14]], [[.52, .52], [.7, .48], [.86, .56]], [[.47, .65], [.3, .76]]];
  const drawCrack = (g, w, h, lw, blur) => {
    g.strokeStyle = "#fff"; g.lineCap = g.lineJoin = "round"; g.shadowColor = "#fff"; g.shadowBlur = blur;
    g.lineWidth = lw; g.beginPath(); crackPts.forEach(([x, y], i) => i ? g.lineTo(x * w, y * h) : g.moveTo(x * w, y * h)); g.stroke();
    g.lineWidth = lw * .6; branches.forEach(br => { g.beginPath(); br.forEach(([x, y], i) => i ? g.lineTo(x * w, y * h) : g.moveTo(x * w, y * h)); g.stroke(); });
  };
  const crackTex = canvasTex(512, 512, (g, w, h) => { drawCrack(g, w, h, 7, 24); drawCrack(g, w, h, 3, 0); });
  const seamTex = canvasTex(512, 512, (g, w, h) => {
    g.strokeStyle = "#fff"; g.lineCap = g.lineJoin = "round"; g.shadowColor = "#fff"; g.shadowBlur = 30; g.lineWidth = 16;
    g.beginPath(); crackPts.forEach(([x, y], i) => i ? g.lineTo(x * w, y * h) : g.moveTo(x * w, y * h)); g.stroke();
    g.shadowBlur = 0; g.lineWidth = 5; g.stroke();
  });
  crackTex.wrapS = crackTex.wrapT = seamTex.wrapS = seamTex.wrapT = THREE.ClampToEdgeWrapping;

  const LEAK_U = S.leakU + .016, iL = frameAt(LEAK_U);
  const LP = FP[iL], LT = FT[iL], LB = FB[iL], LS = FS[iL];
  const CRACK = LP.clone().addScaledVector(LS, R * .95);
  function wallPatch(rad, tex, color) {
    const g = new THREE.CylinderGeometry(rad, rad, .075, 24, 1, true, -.55, 1.1);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    const x = new THREE.Vector3().crossVectors(LT, LS);
    m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, LT, LS));
    m.position.copy(LP);
    pipeGroup.add(m); return m;
  }
  const crack = wallPatch(R * .985, crackTex, new THREE.Color(4, .35, .2));
  const seam = wallPatch(R * .98, seamTex, new THREE.Color(.5, 2.6, 4));
  seam.material.opacity = 0;
  const leakLight = new THREE.PointLight(0xff2a1a, 0, .7, 1.3);
  leakLight.position.copy(LP).addScaledVector(LS, -R * .2); pipeGroup.add(leakLight);
  const SPN = 180;
  const spData = Array.from({ length: SPN }, () => ({ t: Math.random(), v: rnd(.6, 1.4), s: rnd(-.35, .35), f: rnd(-.25, .45) }));
  const spray = points(SPN, (a, i) => { a[i + 1] = -50; }, .003, 0xd8f4ff, 0);
  pipeGroup.add(spray);

  // light at the end of the pipe
  const endP = pipeCurve.getPointAt(1), endT = pipeCurve.getTangentAt(1);
  const exitDisc = new THREE.Mesh(new THREE.CircleGeometry(R * 1.02, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(.6, 1.4, 2.2), toneMapped: false }));
  exitDisc.position.copy(endP); exitDisc.lookAt(endP.clone().sub(endT)); pipeGroup.add(exitDisc);

  /* =========================================================
     CAMERA PATH
     ========================================================= */
  const P0 = pipeCurve.getPointAt(0), T0 = pipeCurve.getTangentAt(0);
  const keys = [
    // [t, position, target]
    [0.00, [2.7, 1.32, 3.4], [-.3, .95, -.9]],
    [0.18, [1.9, 1.25, 2.3], [-.1, .6, -.4]],
    [0.40, [.98, 1.18, 1.12], [0, .26, 0]],
    [0.62, [.26, .95, .3], [0, .14, 0]],
    [0.80, [.02, .62, .035], [0, .1, 0]],
    [0.92, [.004, .3, .008], [0, .02, 0]],
    [1.00, [P0.x, P0.y, P0.z + .0015], [P0.x + T0.x * .3, P0.y + T0.y * .3, P0.z + T0.z * .3]]
  ];
  const posCurve = new THREE.CatmullRomCurve3(keys.map(k => new THREE.Vector3(...k[1])), false, "centripetal");
  const tgtCurve = new THREE.CatmullRomCurve3(keys.map(k => new THREE.Vector3(...k[2])), false, "centripetal");
  function bathCam(t, outP, outT) {
    let i = 0; while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
    const f = clamp01((t - keys[i][0]) / (keys[i + 1][0] - keys[i][0]));
    const ct = (i + f) / (keys.length - 1);
    posCurve.getPoint(ct, outP); tgtCurve.getPoint(ct, outT);
  }

  const camP = new THREE.Vector3(), camT = new THREE.Vector3(), tmp = new THREE.Vector3(), up = new THREE.Vector3();
  const UP_Y = new THREE.Vector3(0, 1, 0), UP_Z = new THREE.Vector3(0, 0, -1);
  const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
  addEventListener("pointermove", e => { mouse.x = e.clientX / innerWidth - .5; mouse.y = e.clientY / innerHeight - .5; }, { passive: true });

  /* =========================================================
     POST-PROCESSING
     ========================================================= */
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), .55, .5, .92);
  composer.addPass(bloom);
  const lens = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uCA: { value: .0015 }, uVig: { value: 1.1 }, uTime: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uCA; uniform float uVig; uniform float uTime; varying vec2 vUv;
      void main(){
        vec2 d = vUv - .5; float r2 = dot(d,d);
        vec2 off = d * r2 * uCA * 6.;
        vec3 c = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
        c = clamp(c, 0., 60.);
        c *= 1. - r2 * uVig;
        gl_FragColor = vec4(c, 1.);
      }`
  });
  composer.addPass(lens);
  composer.addPass(new OutputPass());

  function resize() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloom.resolution.set(w / 2, h / 2);
    camera.aspect = w / h;
    camera.fov = camera.aspect < .8 ? 62 : camera.aspect < 1.2 ? 52 : 42;
    camera.updateProjectionMatrix();
    const sc = h * renderer.getPixelRatio() / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    allPoints.forEach(m => m.uniforms.uScale.value = sc);
  }
  addEventListener("resize", resize);
  resize();

  /* =========================================================
     FRAME UPDATE
     ========================================================= */
  const project = (v, el, dy = 56) => {
    tmp.copy(v).project(camera);
    if (tmp.z > 1 || Math.abs(tmp.x) > 1.2 || Math.abs(tmp.y) > 1.2) { el.style.visibility = "hidden"; return; }
    el.style.visibility = "";
    const x = (tmp.x * .5 + .5) * canvas.clientWidth, y = (-tmp.y * .5 + .5) * canvas.clientHeight;
    el.style.transform = `translate(${x - el.offsetWidth / 2}px, ${y - el.offsetHeight - dy}px)`;
  };

  let last = performance.now(), time = 0, dripImpact = -10, lastDripCycle = -1;
  function update(dt) {
    time += dt;
    const level = .34 + .13 * S.water;

    /* --- water surface --- */
    water.position.y = level;
    const V = S.vortex;
    const rip = SPOUT_TIP.clone(); const rx = rip.x / TUB.x, rz = rip.z / TUB.z;
    const age = time - dripImpact;
    for (let i = 0; i < wPos.count; i++) {
      const x = wBase[i * 3], z = wBase[i * 3 + 2];
      const d = Math.hypot(x, z), a = Math.atan2(z, x);
      let y = .0035 * Math.sin(x * 13 + time * 1.3) * Math.cos(z * 11 - time * 1.1) + .002 * Math.sin(d * 28 - time * 2.4);
      if (age < 3) { const dd = Math.hypot(x - rx, z - rz); y += .006 * Math.exp(-age * 1.8) * Math.sin(dd * 55 - age * 11) * Math.exp(-dd * 4) * (dd < age * .35 + .02 ? 1 : 0); }
      if (V > 0) {
        y -= V * .1 * Math.exp(-d * d * 30);
        y += V * .005 * Math.sin(3 * a + 22 * d - time * 7) * Math.exp(-d * 2.5);
      }
      wPos.array[i * 3 + 1] = y;
    }
    wPos.needsUpdate = true; waterGeo.computeVertexNormals();
    waterNormal.offset.x += dt * .02; waterNormal.offset.y += dt * .013;
    waterNormal.rotation = V * time * .6;

    /* --- dripping faucet --- */
    const cyc = 2.6, ph = (time % cyc) / cyc, cycN = Math.floor(time / cyc);
    if (S.vortex < .6) {
      if (ph < .35) { const s = ph / .35; drip.position.copy(SPOUT_TIP); drip.position.y -= s * .008; drip.scale.set(s, s * 1.25, s); drip.visible = true; }
      else if (ph < .5) { const f = (ph - .35) / .15; drip.position.y = SPOUT_TIP.y - .008 - f * f * (SPOUT_TIP.y - level); drip.scale.set(1, 1.5, 1); }
      else { drip.visible = false; if (cycN !== lastDripCycle) { dripImpact = time; lastDripCycle = cycN; } }
    } else drip.visible = false;

    /* --- drain glow & grate --- */
    const glow = S.glow * (0.75 + .25 * Math.sin(time * 6));
    holeMat.color.setRGB(glow * 3.2, glow * .25, glow * .12);
    drainLight.intensity = glow * .35;
    const gr = S.grate;
    grate.position.y = .105 + gr * .1; grate.rotation.y = gr * 5; grate.rotation.x = gr * 1.3;
    grate.material.opacity = 1 - gr; grate.visible = gr < .98;

    /* --- bubbles spiralling into the drain --- */
    bubbles.material.opacity = V * .9;
    if (V > .01) {
      const arr = bubbles.geometry.attributes.position.array;
      bubbleData.forEach((b, i) => {
        b.ph += dt * b.sp * (1 + V); if (b.ph > 1) { b.ph = 0; b.r0 = rnd(.25, .85); }
        const r = b.r0 * (1 - b.ph); b.a += dt * (1.5 + 3 / (r + .08)) * V;
        arr[i * 3] = Math.cos(b.a) * r * TUB.x; arr[i * 3 + 2] = Math.sin(b.a) * r * TUB.z;
        arr[i * 3 + 1] = level - .01 - b.ph * (level - .12) * (1 - Math.exp(-r * 0)) - b.ph * .05;
      });
      bubbles.geometry.attributes.position.needsUpdate = true;
    }

    /* --- dust & steam drift --- */
    {
      const a = dust.geometry.attributes.position.array;
      for (let i = 0; i < a.length; i += 3) { a[i + 1] += dt * .03; a[i] += Math.sin(time * .3 + i) * dt * .01; if (a[i + 1] > 3.3) a[i + 1] = 0; }
      dust.geometry.attributes.position.needsUpdate = true;
      const s = steam.geometry.attributes.position.array;
      for (let i = 0; i < s.length; i += 3) { s[i + 1] += dt * .06; s[i] += Math.sin(time * .5 + i) * dt * .02; if (s[i + 1] > 1.4) { s[i + 1] = level + .05; s[i] = rnd(-.6, .6); } }
      steam.geometry.attributes.position.needsUpdate = true;
    }

    /* --- camera --- */
    mouse.sx += (mouse.x - mouse.sx) * .05; mouse.sy += (mouse.y - mouse.sy) * .05;
    const inPipe = S.pipe > .0005;
    if (!inPipe) {
      bathCam(S.camBath, camP, camT);
      const par = 1 - smooth(.3, .8, S.camBath);
      camP.x += mouse.sx * .25 * par; camP.y -= mouse.sy * .12 * par;
    } else {
      const u = Math.min(S.pipe, .996), i = frameAt(u);
      camP.copy(pipeCurve.getPointAt(u)).addScaledVector(FB[i], -R * .22 * smooth(.0, .05, u));
      camT.copy(pipeCurve.getPointAt(Math.min(1, u + .012)));
      if (S.look > 0) {
        const k = S.look * S.look * (3 - 2 * S.look);
        camP.addScaledVector(FS[i], -R * .35 * k);
        camT.lerp(CRACK, k);
      }
      if (S.alert > 0) { camP.x += (Math.random() - .5) * .0009 * S.alert; camP.y += (Math.random() - .5) * .0009 * S.alert; }
    }
    camera.position.copy(camP);
    tmp.subVectors(camT, camP).normalize();
    const k = smooth(.85, .995, Math.abs(tmp.y));
    up.copy(UP_Y).lerp(UP_Z, k).normalize();
    camera.up.copy(up);
    camera.lookAt(camT);

    /* --- scene switching, fog, headlamp, underwater --- */
    const below = camP.y < .1;
    bath.visible = !inPipe && !below;
    pipeGroup.visible = S.camBath > .75;
    const pipeK = inPipe ? 1 : smooth(.16, .1, camP.y) * (S.camBath > .85 ? 1 : 0);
    const underwater = !inPipe && camP.y < level && camP.y > .1 && S.camBath > .7 ? smooth(level, level - .03, camP.y) : 0;
    scene.fog.color.copy(BATH_FOG).lerp(WATER_FOG, underwater * .8).lerp(PIPE_FOG, pipeK);
    scene.fog.density = .028 + underwater * 1.2 + pipeK * 1.4;
    scene.background.copy(scene.fog.color);
    lamp.intensity = (inPipe || below ? 1 : 0) * (.7 + S.fixed * .25);
    lamp.color.setRGB(1, 1 - S.alert * .35, 1 - S.alert * .45);
    veilEl.style.opacity = (underwater * (1 - smooth(.16, .105, camP.y)) * .95).toFixed(3);

    /* --- pipe water & droplets --- */
    if (pipeGroup.visible) {
      pipeWaterNormal.offset.x -= dt * S.flow * .9;
      const arr = pipeDrops.geometry.attributes.position.array;
      for (let n = 0; n < PD; n++) {
        const d = pdData[n];
        d.u += dt * d.v * S.flow * .045 / (PL / 14);
        if (d.u > 1) d.u -= 1;
        const i = frameAt(d.u), P = FP[i];
        const ca = Math.cos(d.a), sa = Math.sin(d.a);
        arr[n * 3] = P.x + (FB[i].x * ca + FS[i].x * sa) * d.r * R;
        arr[n * 3 + 1] = P.y + (FB[i].y * ca + FS[i].y * sa) * d.r * R;
        arr[n * 3 + 2] = P.z + (FB[i].z * ca + FS[i].z * sa) * d.r * R;
      }
      pipeDrops.geometry.attributes.position.needsUpdate = true;

      // leak visuals
      crack.material.opacity = S.crack * (.75 + .25 * Math.sin(time * 9) * S.alert);
      seam.material.opacity = (1 - S.crack) * (1 - S.fixed * .45);
      leakLight.color.setRGB(1 - S.fixed * .7, .16 + S.fixed * .7, .1 + S.fixed * .9);
      leakLight.intensity = (S.alert * .07 + S.fixed * .05 * (1 - smooth(.62, .7, S.pipe))) * (S.pipe > .35 ? 1 : 0);
      const sprayOn = S.crack > .05 && S.pipe > .4;
      spray.material.opacity = sprayOn ? .9 * S.crack : 0;
      if (sprayOn) {
        const sa = spray.geometry.attributes.position.array;
        for (let n = 0; n < SPN; n++) {
          const p = spData[n]; p.t += dt * p.v * 1.4; if (p.t > 1) { p.t = 0; p.s = rnd(-.35, .35); p.f = rnd(-.25, .45); }
          const t = p.t, dist = t * R * 1.6;
          tmp.copy(CRACK).addScaledVector(LS, -dist).addScaledVector(LT, p.f * dist + t * R * .3).addScaledVector(LB, p.s * dist + t * t * R * 1.4);
          sa[n * 3] = tmp.x; sa[n * 3 + 1] = tmp.y; sa[n * 3 + 2] = tmp.z;
        }
        spray.geometry.attributes.position.needsUpdate = true;
      }
      exitDisc.material.color.setRGB(.6 + S.exit * 9, 1.4 + S.exit * 9, 2.2 + S.exit * 9);
    }

    /* --- lens & exposure --- */
    lens.uniforms.uCA.value = .0012 + S.alert * .004 + S.exit * .012 + V * .002;
    lens.uniforms.uVig.value = 1.1 + pipeK * .5;
    bloom.strength = .5 + S.alert * .15 + S.exit * 1.2 + pipeK * .1;
    renderer.toneMappingExposure = .95 + S.exit * .6;

    /* --- tracked HTML tags --- */
    if (+getComputedStyle(anomalyTag).opacity > 0) project(DRAIN, anomalyTag);
    if (+getComputedStyle(leakTag).opacity > 0) project(CRACK, leakTag, 40);
  }

  let running = false, raf = 0;
  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    update(dt);
    composer.render();
    if (S.active) raf = requestAnimationFrame(frame); else running = false;
  }
  window.__s3d = { renderer, scene, camera, composer };
  window.Story3D = {
    wake() { if (running || !S.active) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); },
    resize
  };
  // first frame (so the stage is never blank), then follow scroll activity
  update(0); composer.render();
  window.Story3D.wake();
}
