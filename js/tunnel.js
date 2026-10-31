/* Pipe tunnel — a perspective "inside the pipe" flythrough drawn on 2D canvas.
   Driven by window.Tunnel.state (travel, cruise, alert, fixed, flow, opacity). */
(function () {
  const canvas = document.getElementById("tunnel");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const state = {
    travel: 0,   // scroll-driven distance
    cruise: 1,   // idle forward drift 0..1
    alert: 0,    // red emergency tint 0..1
    fixed: 0,    // repaired blue tint 0..1
    flow: 0.4,   // water particle speed multiplier
    visible: false
  };

  const N = 42;          // rings drawn
  const JOINT = 5;       // coupling every N rings
  let W = 0, H = 0, DPR = 1, F = 0;
  let drift = 0, last = performance.now(), raf = 0, running = false;
  let smoothSpeed = 0, prevZ = 0;

  const drops = Array.from({ length: 140 }, () => newDrop(Math.random() * N));
  function newDrop(z) {
    return { a: Math.PI / 2 + (Math.random() - .5) * 1.5, z, r: .78 + Math.random() * .2, v: .6 + Math.random() * .8 };
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 1.75);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    F = Math.max(W, H) * 0.42;
  }
  window.addEventListener("resize", resize);
  resize();

  // world centerline of the pipe (gentle S-bends)
  const cX = z => Math.sin(z * 0.17) * 0.9 + Math.sin(z * 0.053 + 1.3) * 1.4;
  const cY = z => Math.cos(z * 0.13) * 0.5 + Math.sin(z * 0.041) * 0.7;

  function project(z, camZ, ox = 0, oy = 0) {
    const d = z - camZ;
    const s = F / d;
    return {
      x: W / 2 + (cX(z) - cX(camZ + 2) + ox) * s,
      y: H / 2 + (cY(z) - cY(camZ + 2) + oy) * s,
      s, d
    };
  }

  function mix(a, b, t) { return a + (b - a) * t; }
  function rgb(r, g, b, a = 1) { return `rgba(${r | 0},${g | 0},${b | 0},${a})`; }

  function draw(now) {
    if (!running) return;
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    drift += dt * state.cruise * 0.9;
    const camZ = state.travel + drift;
    const sp = Math.abs(camZ - prevZ) / Math.max(dt, 1e-3); prevZ = camZ;
    smoothSpeed += (sp - smoothSpeed) * .1;

    const A = state.alert, X = state.fixed;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    const first = Math.floor(camZ) + 1;
    // far light at the end of the tunnel
    const far = project(first + N, camZ);
    const lightR = Math.max(far.s * 1.2, 6);
    const lg = ctx.createRadialGradient(far.x, far.y, 0, far.x, far.y, lightR * 6);
    lg.addColorStop(0, rgb(mix(mix(150, 255, A), 190, X), mix(mix(230, 80, A), 245, X), mix(mix(255, 60, A), 255, X), .95));
    lg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = lg;
    ctx.beginPath(); ctx.arc(far.x, far.y, lightR * 6, 0, Math.PI * 2); ctx.fill();

    // pipe wall bands, far -> near
    for (let k = N; k >= 1; k--) {
      const zFar = first + k, zNear = first + k - 1;
      const pF = project(zFar, camZ), pN = project(zNear, camZ);
      if (pN.d < 0.15) continue;
      const fog = Math.pow(Math.max(0, 1 - pN.d / N), 1.6);
      const alt = (zNear % 2 === 0) ? 1 : 0.82;
      // base metal colour shifted by alert / fixed
      const lit = Math.pow(fog, 1.3);
      let r = mix(6, 58, lit) * alt, g = mix(9, 70, lit) * alt, b = mix(20, 104, lit) * alt;
      r = mix(r, mix(30, 190, lit), A * .6); g = mix(g, g * .45, A * .6); b = mix(b, b * .45, A * .6);
      r = mix(r, r * .5, X * .6); g = mix(g, mix(25, 130, lit), X * .55); b = mix(b, mix(50, 200, lit), X * .6);

      ctx.beginPath();
      ctx.arc(pN.x, pN.y, pN.s, 0, Math.PI * 2);
      ctx.arc(pF.x, pF.y, pF.s, 0, Math.PI * 2, true);
      const grad = ctx.createLinearGradient(pN.x, pN.y - pN.s, pN.x, pN.y + pN.s);
      grad.addColorStop(0, rgb(r * 1.6, g * 1.6, b * 1.6));
      grad.addColorStop(.45, rgb(r * .45, g * .45, b * .5));
      grad.addColorStop(1, rgb(r * .8, g * .95, b * 1.25));
      ctx.fillStyle = grad;
      ctx.fill("evenodd");

      // coupling joints
      if (zNear % JOINT === 0) {
        ctx.lineWidth = Math.max(1, pN.s * 0.07);
        ctx.strokeStyle = rgb(mix(60, 200, fog) + A * 60 * fog, mix(70, 215, fog) + X * 20, mix(95, 245, fog), 1);
        ctx.beginPath(); ctx.arc(pN.x, pN.y, pN.s * 0.985, 0, Math.PI * 2); ctx.stroke();
        // specular rim
        ctx.lineWidth = Math.max(.5, pN.s * 0.018);
        ctx.strokeStyle = `rgba(255,255,255,${0.55 * fog})`;
        ctx.beginPath(); ctx.arc(pN.x, pN.y, pN.s * 0.95, Math.PI * 1.1, Math.PI * 1.75); ctx.stroke();
      }
      // water running along the bottom
      const wl = 0.5;
      ctx.beginPath();
      ctx.ellipse(pN.x, pN.y + pN.s * 0.8, pN.s * wl, pN.s * 0.2, 0, 0, Math.PI);
      ctx.fillStyle = `rgba(${mix(40, 255, A * .6)},${mix(150, 90, A * .6)},255,${0.13 * fog + 0.02})`;
      ctx.fill();
    }

    // water droplets / streaks
    const flowV = (state.flow + smoothSpeed * .02);
    for (const d of drops) {
      d.z -= dt * d.v * flowV * 6;
      if (d.z - camZ < .3) Object.assign(d, newDrop(camZ + N * (.4 + Math.random() * .6)));
      if (d.z - camZ > N) d.z = camZ + N * Math.random();
      const ox = Math.cos(d.a) * d.r, oy = Math.sin(d.a) * d.r;
      const p1 = project(d.z, camZ, ox, oy);
      const p2 = project(d.z + .25 + flowV * .5, camZ, ox, oy);
      if (p1.d < .3) continue;
      const fog = Math.max(0, 1 - p1.d / N);
      ctx.strokeStyle = A > .5 && X < .5
        ? `rgba(255,${120 - A * 40},${100 - A * 40},${.7 * fog})`
        : `rgba(${mix(150, 120, X)},${mix(225, 245, X)},255,${.75 * fog})`;
      ctx.lineWidth = Math.max(.6, p1.s * .012);
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    }

    // headlamp vignette
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .15, W / 2, H / 2, Math.max(W, H) * .75);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, `rgba(${A * 60 | 0},0,0,.85)`);
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

    raf = requestAnimationFrame(draw);
  }

  window.Tunnel = {
    state,
    start() { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(draw); },
    stop() { running = false; cancelAnimationFrame(raf); },
    resize
  };
})();
