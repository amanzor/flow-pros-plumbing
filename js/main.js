/* =========================================================
   FLOW PROS PLUMBING — main interactions & scroll story
   ========================================================= */
(function () {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isTouch = window.matchMedia("(hover: none), (pointer: coarse)").matches;
  $("#year").textContent = new Date().getFullYear();

  // Fallback: if GSAP failed to load, show everything statically.
  if (!window.gsap || !window.ScrollTrigger) {
    $("#preloader").remove();
    document.body.classList.remove("is-loading");
    window.HeroShader && (window.HeroShader.state.intro = 1, window.HeroShader.start());
    return;
  }

  document.documentElement.classList.add("js");
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  /* ---------------- Smooth scroll ---------------- */
  let lenis = null;
  if (window.Lenis && !reduce) {
    lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
    lenis.stop();
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  window.scrollTo(0, 0);

  // anchor links
  $$('a[href^="#"]').forEach(a => {
    a.addEventListener("click", e => {
      const id = a.getAttribute("href");
      const el = id === "#top" ? document.body : $(id);
      if (!el) return;
      e.preventDefault();
      closeMenu();
      if (lenis) lenis.scrollTo(el, { offset: id === "#story" ? 0 : -20, duration: 1.6 });
      else el.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
    });
  });

  /* ---------------- Mobile menu ---------------- */
  const burger = $("#burger"), menu = $("#mobileMenu");
  function closeMenu() { menu.classList.remove("is-open"); burger.setAttribute("aria-expanded", "false"); lenis && lenis.start(); }
  burger.addEventListener("click", () => {
    const open = !menu.classList.contains("is-open");
    menu.classList.toggle("is-open", open);
    burger.setAttribute("aria-expanded", String(open));
    if (lenis) open ? lenis.stop() : lenis.start();
  });

  /* ---------------- Preloader + Hero intro ---------------- */
  const pre = { v: 0 };
  const pctEl = $("#prePct"), fill = $("#preFill"), wave = $("#preWave");
  const loaded = new Promise(res => (document.readyState === "complete" ? res() : window.addEventListener("load", res)));
  const minTime = new Promise(res => setTimeout(res, reduce ? 200 : 1500));

  gsap.set(".hero__title .word", { yPercent: 115 });
  gsap.set([".hero__eyebrow", ".hero__sub", ".hero__ctas", ".hero__badges", ".hero__scroll"], { y: 30, opacity: 0 });
  gsap.set("#heroEmblem", { scale: .6, opacity: 0, rotate: -25 });
  gsap.set("#nav", { xPercent: -50, yPercent: -160 });
  gsap.set(".hero__scroll", { xPercent: -50 });

  const preTween = gsap.to(pre, {
    v: 92, duration: reduce ? .2 : 1.4, ease: "power2.out",
    onUpdate: updatePre
  });
  function updatePre() {
    const v = Math.round(pre.v);
    pctEl.textContent = v + "%";
    fill.style.clipPath = `inset(${100 - v}% 0 0 0)`;
    wave.style.bottom = `calc(${v}% - 7px)`;
  }

  const hole = { r: 0 };
  Promise.all([loaded, minTime]).then(() => {
    preTween.kill();
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    tl.to(pre, { v: 100, duration: .35, onUpdate: updatePre })
      .to(wave, { opacity: 0, duration: .2 })
      .fromTo("#preDrop", { y: 0, opacity: 1, scaleY: 1 }, { y: () => window.innerHeight / 2 + 30, duration: reduce ? .1 : .55, ease: "power2.in" }, "+=.05")
      .add(() => {
        window.HeroShader && (window.HeroShader.start(), window.HeroShader.splash(.5, .5));
        heroFX.burst(window.innerWidth / 2, window.innerHeight / 2, 60);
      })
      .to("#preDrop", { scaleY: .2, scaleX: 3, opacity: 0, duration: .2 })
      .to(".preloader__orb, .preloader__meta", { scale: 1.15, opacity: 0, duration: .4 }, "<")
      .fromTo(hole, { r: 0 }, {
        r: () => Math.hypot(window.innerWidth, window.innerHeight) / 2 + 40,
        duration: reduce ? .1 : 1.1, ease: "power2.inOut",
        onUpdate() {
          const m = `radial-gradient(circle at 50% 50%, transparent ${hole.r}px, #000 ${hole.r + 2}px)`;
          const el = $("#preloader"); el.style.webkitMaskImage = m; el.style.maskImage = m;
        }
      }, "<")
      .to(window.HeroShader ? window.HeroShader.state : {}, { intro: 1, duration: 1.6, ease: "power2.out" }, "<")
      .add(() => { $("#preloader").remove(); document.body.classList.remove("is-loading"); lenis && lenis.start(); ScrollTrigger.refresh(); })
      .to("#heroEmblem", { scale: 1, opacity: 1, rotate: 0, duration: 1.6, ease: "elastic.out(1, .6)" }, "-=.7")
      .to(".hero__title .word", { yPercent: 0, duration: 1.1, stagger: .12, ease: "expo.out" }, "<+.1")
      .to(".hero__eyebrow", { y: 0, opacity: 1, duration: .8 }, "<")
      .to([".hero__sub", ".hero__ctas", ".hero__badges"], { y: 0, opacity: 1, duration: .9, stagger: .1 }, "<+.35")
      .to("#nav", { yPercent: 0, duration: 1, ease: "expo.out", clearProps: "transform" }, "<")
      .to(".hero__scroll", { y: 0, opacity: 1, duration: .8 }, "<+.3")
      .add(startDrip);
  });

  // drip falling from the wizard's pipe
  function startDrip() {
    if (reduce) return;
    gsap.timeline({ repeat: -1, repeatDelay: 1.4 })
      .fromTo(".emblem__drip", { y: 0, opacity: 0, scale: .3 }, { opacity: 1, scale: 1, duration: .6, ease: "power1.out" })
      .to(".emblem__drip", { y: 140, duration: .7, ease: "power2.in" })
      .to(".emblem__drip", { opacity: 0, scaleX: 2.5, scaleY: .3, duration: .15 });
  }

  /* ---------------- Hero FX: droplet particles ---------------- */
  const heroFX = (function () {
    const c = $("#heroFX"); const x = c.getContext("2d");
    let W, H, DPR, parts = [], running = false;
    function size() { DPR = Math.min(devicePixelRatio || 1, 2); W = c.clientWidth; H = c.clientHeight; c.width = W * DPR; c.height = H * DPR; x.setTransform(DPR, 0, 0, DPR, 0, 0); }
    size(); addEventListener("resize", size);
    function spawn(px, py, n, power = 1) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, s = (Math.random() * 6 + 2) * power;
        parts.push({ x: px, y: py, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 3 * power, r: Math.random() * 3 + 1, life: 1, hue: Math.random() < .12 ? 24 : 200 });
      }
      if (!running) { running = true; requestAnimationFrame(loop); }
    }
    function loop() {
      x.clearRect(0, 0, W, H);
      parts = parts.filter(p => p.life > 0);
      for (const p of parts) {
        p.vy += .22; p.vx *= .985; p.x += p.vx; p.y += p.vy; p.life -= .016;
        x.beginPath();
        x.fillStyle = p.hue === 24 ? `rgba(255,140,50,${p.life})` : `rgba(150,225,255,${p.life})`;
        x.shadowBlur = 10; x.shadowColor = p.hue === 24 ? "#ff6a1a" : "#2ea8ff";
        x.ellipse(p.x, p.y, p.r, p.r * 1.4, Math.atan2(p.vy, p.vx) + Math.PI / 2, 0, Math.PI * 2);
        x.fill();
      }
      if (parts.length) requestAnimationFrame(loop); else { running = false; x.clearRect(0, 0, W, H); }
    }
    let lastSpawn = 0;
    if (!isTouch && !reduce) {
      $("#hero").addEventListener("pointermove", e => {
        const now = performance.now();
        if (now - lastSpawn < 35) return; lastSpawn = now;
        const r = c.getBoundingClientRect();
        spawn(e.clientX - r.left, e.clientY - r.top, 2, .45);
      });
    }
    $("#hero").addEventListener("click", e => {
      const r = c.getBoundingClientRect();
      spawn(e.clientX - r.left, e.clientY - r.top, 26, .9);
      window.HeroShader && window.HeroShader.splash((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    });
    return { burst: (px, py, n) => spawn(px, py, n, 1.4) };
  })();

  // Hero parallax out + pause shader when hidden
  ScrollTrigger.create({
    trigger: "#hero", start: "top top", end: "bottom top",
    onToggle: self => window.HeroShader && (self.isActive ? window.HeroShader.start() : window.HeroShader.stop())
  });
  gsap.to("#heroEmblem", { yPercent: -25, scale: .85, ease: "none", scrollTrigger: { trigger: "#hero", start: "top top", end: "bottom top", scrub: true } });
  gsap.to(".hero__copy", { yPercent: -18, opacity: .2, ease: "none", scrollTrigger: { trigger: "#hero", start: "top top", end: "bottom top", scrub: true } });

  /* =========================================================
     THE WIZARD'S DESCENT — pinned scroll story
     ========================================================= */
  (function story() {
    const T = window.Tunnel ? window.Tunnel.state : { travel: 0, cruise: 1, alert: 0, fixed: 0, flow: .4 };
    const caps = $$(".cap"), dots = $$(".story__progress .dot");
    const hud = $("#hud");
    const el = {
      depth: $("#hudDepth"), psi: $("#hudPsi"), flow: $("#hudFlow"), status: $("#hudStatus"),
      scan: $("#hudScan"), scanPct: $("#hudScanPct")
    };

    // ambient bath animation (independent of scroll)
    if (!reduce) {
      gsap.timeline({ repeat: -1, repeatDelay: .8 })
        .fromTo("#bathDrip", { attr: { cy: 300, ry: 4 }, opacity: 0 }, { attr: { cy: 312, ry: 9 }, opacity: 1, duration: .7 })
        .to("#bathDrip", { attr: { cy: 470 }, duration: .45, ease: "power2.in" })
        .to("#bathDrip", { opacity: 0, duration: .05 });
      gsap.to("#swirl path", { strokeDashoffset: -68, duration: 1.4, ease: "none", repeat: -1 });
      $$("#bubbles circle").forEach((c, i) => {
        gsap.fromTo(c, { attr: { cy: 580 }, opacity: 0 }, { attr: { cy: 470 }, opacity: 1, duration: 2.2, delay: i * .7, repeat: -1, ease: "sine.in", yoyo: false });
      });
    }

    // sparks for the repair spell
    const sparksBox = $("#sparks");
    const sparks = Array.from({ length: 28 }, (_, i) => {
      const s = document.createElement("span"); s.className = "spark"; sparksBox.appendChild(s);
      const a = (i / 28) * Math.PI * 2 + Math.random() * .3, d = 120 + Math.random() * 260;
      return { s, x: Math.cos(a) * d, y: Math.sin(a) * d };
    });
    gsap.set(sparks.map(o => o.s), { opacity: 0 });
    gsap.set(["#leak", "#spell", "#reticle"], { xPercent: -50, yPercent: -50, x: 0, y: 0 });
    gsap.set(".cap--center", { xPercent: -50, x: 0 });

    const tl = gsap.timeline({ defaults: { ease: "none" } });
    const at = (t, fn) => tl.add(fn, t);

    // --- Scene 1: The problem in the tub
    tl.set({}, {}, 100); // timeline length = 100 units
    tl.fromTo(caps[0], { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 4, ease: "power2.out" }, 0)
      .to("#bathWater", { y: -28, duration: 14 }, 0)
      .to("#anomalyTag", { opacity: 1, y: -10, duration: 3 }, 5)
      .fromTo("#drainGlow", { opacity: 0 }, { opacity: 1, duration: 4, repeat: 1, yoyo: true }, 6)
      .to("#drainGlow", { opacity: .9, duration: 2 }, 14)
      .to(caps[0], { autoAlpha: 0, y: -30, duration: 2 }, 14)
      .to("#anomalyTag", { opacity: 0, duration: 2 }, 15)

    // --- Scene 2: Dive into the drain
      .fromTo(caps[1], { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 3, ease: "power2.out" }, 16)
      .fromTo("#bathSVG", { attr: { viewBox: "0 0 1200 800" } }, { attr: { viewBox: "594 582 12 8" }, duration: 14, ease: "power3.in" }, 16)
      .to("#sceneTunnel", { opacity: 1, duration: 3 }, 28)
      .fromTo(T, { travel: 0 }, { travel: 34, duration: 18 }, 28)
      .to(hud, { opacity: 1, duration: 3 }, 32)
      .to(caps[1], { autoAlpha: 0, y: -30, duration: 2 }, 43)

    // --- Scene 3: Detection
      .fromTo(caps[2], { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 3, ease: "power2.out" }, 46)
      .to(T, { cruise: 0, flow: .25, duration: 4 }, 44)
      .to("#sonar", { opacity: 1, duration: 2 }, 46)
      .fromTo(T, { travel: 34 }, { travel: 37, duration: 10, ease: "power2.out", immediateRender: false }, 46)
      .to(T, { alert: 1, duration: 4 }, 51)
      .fromTo("#leak", { scale: .15, opacity: 0 }, { scale: 1, opacity: 1, duration: 7, ease: "power2.out" }, 49)
      .to("#sonar", { opacity: 0, duration: 2 }, 55)
      .fromTo("#reticle", { scale: 2.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 3, ease: "back.out(2)" }, 54)
      .fromTo("#hudAlert", { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.5 }, 56)
      .to(caps[2], { autoAlpha: 0, y: -30, duration: 2 }, 60)

    // --- Scene 4: The fix (a little magic)
      .fromTo(caps[3], { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 3, ease: "power2.out" }, 62)
      .to("#reticle", { opacity: 0, scale: .6, duration: 2 }, 62)
      .to("#hudAlert", { autoAlpha: 0, duration: 1.5 }, 64)
      .fromTo("#spell", { scale: .3, rotate: -90, opacity: 0 }, { scale: 1, rotate: 0, opacity: 1, duration: 5, ease: "back.out(1.4)" }, 62)
      .to(sparks.map(o => o.s), { opacity: 1, duration: .5 }, 66);
    sparks.forEach((o, i) => {
      tl.fromTo(o.s, { x: 0, y: 0, scale: 1.4 }, { x: o.x, y: o.y, scale: 0, duration: 6, ease: "power2.out" }, 66 + (i % 4) * .4);
    });
    tl.to(".leak__seam", { strokeDashoffset: 0, duration: 5, ease: "power1.inOut" }, 66)
      .to(".leak__spray", { opacity: 0, scale: .2, transformOrigin: "50% 50%", duration: 3 }, 66)
      .to(".leak__crack", { opacity: 0, duration: 3 }, 70)
      .to(".leak__glow", { opacity: 0, duration: 3 }, 68)
      .to(".leak__fixglow", { opacity: 1, duration: 3 }, 68)
      .to(T, { alert: 0, fixed: 1, duration: 4 }, 69)
      .to("#hudOk", { opacity: 1, duration: 1.5 }, 72)
      .to(caps[3], { autoAlpha: 0, y: -30, duration: 2 }, 76)
      .to("#spell", { scale: 1.8, opacity: 0, duration: 4, ease: "power2.in" }, 75)
      .to("#leak", { scale: 3, opacity: 0, duration: 5, ease: "power2.in" }, 77)
      .to("#hudOk", { opacity: 0, duration: 2 }, 78)

    // --- Scene 5: Flow restored — rush out the faucet
      .to(T, { cruise: 1, flow: 2.2, duration: 3 }, 77)
      .fromTo(T, { travel: 37 }, { travel: 90, duration: 10, ease: "power2.in", immediateRender: false }, 77)
      .to(hud, { opacity: 0, duration: 2 }, 82)
      .to("#flowBurst", { opacity: 1, duration: 2.5, ease: "power2.in" }, 84.5)
      .set("#sceneFlow", { opacity: 1 }, 87)
      .to("#flowBurst", { opacity: 0, duration: 4, ease: "power2.out" }, 87.2)
      .to(".flow__stream", { strokeDashoffset: 0, duration: 6, ease: "power2.out" }, 88)
      .fromTo(caps[4], { autoAlpha: 0, y: 40, scale: .9 }, { autoAlpha: 1, y: 0, scale: 1, duration: 4, ease: "power3.out" }, 90);

    const marks = [0, 16, 46, 62, 88];
    let lastStage = -1;
    function hudUpdate(p) {
      // p = 0..100 timeline position
      const depth = Math.max(0, T.travel * 0.72);
      el.depth.textContent = depth.toFixed(1) + " FT";
      let psi = 62, gpm = 4.8, status = "DESCENDING", stage = 0;
      if (p >= 46 && p < 62) { const k = gsap.utils.clamp(0, 1, (p - 49) / 7); psi = 62 - 24 * k; gpm = 4.8 - 2.4 * k; status = k < 1 ? "SCANNING…" : "LEAK FOUND"; }
      else if (p >= 62 && p < 72) { const k = gsap.utils.clamp(0, 1, (p - 66) / 6); psi = 38 + 24 * k; gpm = 2.4 + 2.4 * k; status = "REPAIRING"; }
      else if (p >= 72) { status = "FLOW RESTORED"; }
      el.psi.textContent = Math.round(psi) + " PSI";
      el.flow.textContent = gpm.toFixed(1) + " GPM";
      el.status.textContent = status;
      const bad = p >= 52 && p < 70;
      el.psi.style.color = el.flow.style.color = el.status.style.color = bad ? "#ff6b6b" : (p >= 70 ? "#42f5b3" : "");
      const scan = gsap.utils.clamp(0, 1, (p - 46) / 8);
      el.scan.style.width = scan * 100 + "%";
      el.scanPct.textContent = Math.round(scan * 100) + "%";
      hud.classList.toggle("is-alert", bad);
      hud.classList.toggle("is-ok", p >= 70);
      for (let i = marks.length - 1; i >= 0; i--) if (p >= marks[i]) { stage = i; break; }
      if (stage !== lastStage) { dots.forEach((d, i) => d.classList.toggle("is-active", i === stage)); lastStage = stage; }
    }

    window._storyST = ScrollTrigger.create({
      trigger: "#story",
      start: "top top",
      end: () => "+=" + window.innerHeight * (window.innerWidth < 760 ? 6 : 7),
      pin: "#stage",
      scrub: reduce ? true : 1,
      animation: tl,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: () => hudUpdate(tl.time()),
      onToggle: self => { if (!window.Tunnel) return; self.isActive ? window.Tunnel.start() : window.Tunnel.stop(); }
    });
    hudUpdate(0);
  })();

  /* ---------------- Liquid morph words ---------------- */
  (function morph() {
    const a = $("#morphA"), b = $("#morphB");
    if (!a) return;
    const words = ["leaks.", "clogs.", "drains.", "heaters.", "sewers.", "bursts.", "it all."];
    let i = 0, morphT = 0, cool = 1.6, time = performance.now(), active = false;
    const MORPH = 1.0, COOL = 1.6;
    a.textContent = words[0]; b.textContent = words[1];
    function set(f) {
      b.style.filter = `blur(${Math.min(8 / f - 8, 100)}px)`; b.style.opacity = `${Math.pow(f, .4) * 100}%`;
      const g = 1 - f;
      a.style.filter = `blur(${Math.min(8 / g - 8, 100)}px)`; a.style.opacity = `${Math.pow(g, .4) * 100}%`;
    }
    function rest() { b.style.filter = ""; b.style.opacity = "100%"; a.style.filter = ""; a.style.opacity = "0%"; }
    function loop(now) {
      if (!active) return;
      const dt = (now - time) / 1000; time = now;
      cool -= dt;
      if (cool <= 0) {
        if (morphT === 0) { a.textContent = words[i % words.length]; b.textContent = words[(i + 1) % words.length]; }
        morphT += dt;
        let f = morphT / MORPH;
        if (f > 1) { cool = COOL; f = 1; }
        set(f);
        if (f === 1) { i++; morphT = 0; }
      } else rest();
      requestAnimationFrame(loop);
    }
    if (reduce) return;
    a.style.opacity = "100%"; b.style.opacity = "0%";
    ScrollTrigger.create({
      trigger: ".services", start: "top bottom", end: "bottom top",
      onToggle: s => { active = s.isActive; if (active) { time = performance.now(); requestAnimationFrame(loop); } }
    });
  })();

  /* ---------------- Reveals ---------------- */
  ScrollTrigger.batch(".reveal", {
    start: "top 88%",
    once: true,
    onEnter: els => gsap.to(els, { opacity: 1, y: 0, duration: 1, stagger: .08, ease: "power3.out", clearProps: "transform" })
  });

  /* ---------------- Card tilt + glow ---------------- */
  if (!isTouch) {
    $$("[data-tilt]").forEach(card => {
      card.addEventListener("pointermove", e => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        card.style.setProperty("--mx", px * 100 + "%");
        card.style.setProperty("--my", py * 100 + "%");
        card.style.setProperty("--ry", (px - .5) * 10 + "deg");
        card.style.setProperty("--rx", (.5 - py) * 10 + "deg");
      });
      card.addEventListener("pointerleave", () => { card.style.setProperty("--rx", "0deg"); card.style.setProperty("--ry", "0deg"); });
    });
  }

  /* ---------------- Process pipe fill ---------------- */
  const steps = $$(".step");
  gsap.to("#processWater", {
    strokeDashoffset: 0, ease: "none",
    scrollTrigger: {
      trigger: ".process__pipe", start: "top 60%", end: "bottom 60%", scrub: .6,
      onUpdate: self => steps.forEach((s, i) => s.classList.toggle("is-on", self.progress >= (i / steps.length) * .95 + .02))
    }
  });

  /* ---------------- Counters ---------------- */
  $$("[data-count]").forEach(n => {
    const end = +n.dataset.count, o = { v: 0 };
    ScrollTrigger.create({
      trigger: n, start: "top 90%", once: true,
      onEnter: () => gsap.to(o, { v: end, duration: 2, ease: "power2.out", onUpdate: () => (n.textContent = Math.round(o.v)) })
    });
  });

  /* ---------------- Veteran & emergency parallax ---------------- */
  gsap.fromTo(".veteran__shield", { rotate: -8 }, { rotate: 6, ease: "none", scrollTrigger: { trigger: ".veteran", start: "top bottom", end: "bottom top", scrub: true } });
  gsap.fromTo(".emergency__title", { scale: .85 }, { scale: 1, ease: "none", scrollTrigger: { trigger: ".emergency", start: "top bottom", end: "center center", scrub: true } });
  gsap.fromTo(".footer__big", { yPercent: 40 }, { yPercent: 0, ease: "none", scrollTrigger: { trigger: ".footer", start: "top bottom", end: "bottom bottom", scrub: true } });

  /* ---------------- Nav + pipe progress ---------------- */
  const nav = $("#nav"), pipe = $("#pipeWater");
  let lastY = 0;
  ScrollTrigger.create({
    start: 0, end: "max",
    onUpdate: self => {
      const y = self.scroll();
      nav.classList.toggle("is-scrolled", y > 40);
      const inStory = window._storyST && window._storyST.isActive;
      nav.classList.toggle("is-hidden", (y > lastY && y > 300) || inStory);
      lastY = y;
      pipe.style.height = self.progress * 100 + "%";
    }
  });

  /* ---------------- Magnetic buttons ---------------- */
  if (!isTouch) {
    $$(".magnetic").forEach(btn => {
      btn.addEventListener("pointermove", e => {
        const r = btn.getBoundingClientRect();
        const x = e.clientX - r.left, y = e.clientY - r.top;
        btn.style.setProperty("--bx", (x - r.width / 2) * .25 + "px");
        btn.style.setProperty("--by", (y - r.height / 2) * .35 + "px");
        btn.style.setProperty("--mx", (x / r.width) * 100 + "%");
        btn.style.setProperty("--my", (y / r.height) * 100 + "%");
      });
      btn.addEventListener("pointerleave", () => { btn.style.setProperty("--bx", "0px"); btn.style.setProperty("--by", "0px"); });
    });
  }

  /* ---------------- Cursor ---------------- */
  if (!isTouch) {
    const cur = $("#cursor"), dot = $(".cursor__dot"), ring = $(".cursor__ring");
    let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;
    addEventListener("pointermove", e => { mx = e.clientX; my = e.clientY; dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%,-50%)`; }, { passive: true });
    gsap.ticker.add(() => { rx += (mx - rx) * .18; ry += (my - ry) * .18; ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%,-50%)`; });
    document.addEventListener("pointerover", e => cur.classList.toggle("is-hover", !!e.target.closest("a, button, .card, summary, select, input, textarea")));
    addEventListener("pointerdown", e => {
      const r = document.createElement("span"); r.className = "ripple";
      r.style.left = e.clientX + "px"; r.style.top = e.clientY + "px";
      document.body.appendChild(r); setTimeout(() => r.remove(), 900);
    });
  }

  /* ---------------- Quote form -> WhatsApp ---------------- */
  $("#quoteForm").addEventListener("submit", e => {
    e.preventDefault();
    const f = e.target;
    let ok = true;
    ["name", "phone"].forEach(n => {
      const inp = f.elements[n]; const bad = !inp.value.trim();
      inp.parentElement.classList.toggle("is-invalid", bad); if (bad) ok = false;
    });
    if (!ok) { $("#formNote").textContent = "Please add your name and phone so we can reach you."; return; }
    const msg = `Hi Flow Pros! I'd like a free quote.%0A%0AName: ${encodeURIComponent(f.elements.name.value)}%0APhone: ${encodeURIComponent(f.elements.phone.value)}%0ACity: ${encodeURIComponent(f.elements.city.value)}%0AService: ${encodeURIComponent(f.elements.service.value)}%0A%0A${encodeURIComponent(f.elements.message.value)}`;
    window.open(`https://wa.me/17868571560?text=${msg}`, "_blank", "noopener");
    $("#formNote").innerHTML = "Thanks! Your request is ready in WhatsApp. Prefer to call? <a href='tel:+17868571560'>(786) 857-1560</a>";
  });

  addEventListener("resize", () => window.Tunnel && window.Tunnel.resize());
})();
