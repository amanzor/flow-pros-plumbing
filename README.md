# Flow Pros Plumbing LLC — Website

Veteran-owned plumbing in Miami-Dade & Broward. Static, no build step.

**Concept: "The Wizard's Descent".** The scroll story drops into a slow-draining tub, dives through the drain into the pipes, scans and finds a leak, seals it with a repair "spell", and rushes out of a faucet as the flow is restored.

**Style: "Arcane Liquid".** Liquid-morph shapes and WebGL water on a dark, cinematic palette taken from the logo: electric blue, wizard purple and fire orange.

## Structure
- `index.html`: all content
- `css/style.css`: design system and layout
- `js/hero-shader.js`: WebGL liquid hero background
- `js/tunnel.js`: canvas pipe-tunnel flythrough
- `js/main.js`: preloader, hero intro, pinned scroll story (GSAP ScrollTrigger), interactions
- `js/vendor/`: GSAP 3.12.5, ScrollTrigger, Lenis (bundled locally)

## Run locally
```bash
python3 -m http.server 8000
```

## Deploy
Works on GitHub Pages (Settings → Pages → Deploy from branch `main`, root), Netlify or Vercel as-is.
