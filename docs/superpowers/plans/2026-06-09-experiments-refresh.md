# Experiments Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-theme and modernize the two experiment pages to the planet-world aesthetic while keeping them self-contained static HTML.

**Architecture:** Each page is one HTML file in `public/experiments/` with an ESM importmap pinning Three; hand-control adds `@mediapipe/tasks-vision`. Shared theme expressed as duplicated CSS tokens in each file (self-containment beats DRY here — the files must work standalone in an iframe). See `docs/superpowers/specs/2026-06-09-experiments-refresh-design.md`.

**Tech Stack:** Three 0.170.0 (ESM, jsdelivr), `@mediapipe/tasks-vision` 0.10.x, Playwright smoke rig.

**Testing:** No unit framework; the gate per task is `npm run build` + `npm run test:experiments` (built in Task 1) and screenshot review. Work on the `experiments-refresh` branch.

### Shared theme tokens (used by Tasks 2 and 3)

```css
:root {
  --accent: #c8b0ff;
  --accent-soft: rgba(200, 176, 255, 0.2);
  --cyan: #00e5ff; --orange: #ff6b35; --mint: #7dffb3;
  --panel-bg: rgba(10, 6, 28, 0.82);
  --panel-border: rgba(180, 160, 255, 0.25);
  --text: #e8e2ff; --text-dim: rgba(232, 226, 255, 0.6);
}
body { background: #06021a; color: var(--text); font-family: "Sora", sans-serif; }
/* Nebula backdrop */
body::before { content: ""; position: fixed; inset: 0; z-index: 0; background:
  radial-gradient(ellipse at 70% 20%, rgba(90, 16, 64, 0.35), transparent 55%),
  radial-gradient(ellipse at 20% 80%, rgba(12, 56, 88, 0.3), transparent 55%),
  radial-gradient(ellipse at 50% 50%, rgba(58, 24, 104, 0.25), transparent 65%),
  #06021a; }
/* Vignette */
body::after { content: ""; position: fixed; inset: 0; z-index: 50; pointer-events: none;
  background: radial-gradient(ellipse at center, transparent 58%, rgba(2, 1, 8, 0.45) 100%); }
.panel { background: var(--panel-bg); border: 1px solid var(--panel-border);
  border-radius: 14px; backdrop-filter: blur(10px); }
.kicker { font-size: 0.68rem; letter-spacing: 0.32em; text-transform: uppercase; color: var(--accent); }
```

Plus the Sora font link: `<link href="https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700&display=swap" rel="stylesheet">`

Importmap (both pages):

```html
<script type="importmap">
{ "imports": {
  "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js",
  "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/"
} }
</script>
```

---

### Task 1: Experiments smoke rig

**Files:**
- Create: `scripts/experiments-smoke.mjs`
- Modify: `package.json`

- [ ] **Step 1:** Create the rig — same preview-server pattern as `scripts/world-smoke.mjs`. For each of `/experiments/fibonacci-sphere.html` and `/experiments/celestial-hand-control.html` (direct URLs, not the viewer): launch with `permissions: []` (camera denied), collect console/page errors, wait 6s, assert `document.querySelector("canvas")` exists, screenshot to `/tmp/exp-<name>.png`. Known-noise filter: ignore console errors matching `/Tailwind|babel|cdn.tailwindcss/i` (present only until Task 2 lands). For hand-control AFTER Task 3: click `#cam-btn`, wait 4s, assert the page did not throw and `#cam-btn` text is back to its idle state (denied path handled) — guard this assertion behind a check that the page has `data-modern="1"` on `<body>` so the rig passes both before and after the rewrite.
- [ ] **Step 2:** Add `"test:experiments": "node scripts/experiments-smoke.mjs"` to package.json.
- [ ] **Step 3:** `npm run build && npm run test:experiments` → both pages pass against current files.
- [ ] **Step 4:** Commit: `test: add experiments smoke rig`.

### Task 2: Fibonacci Sphere rewrite

**Files:**
- Rewrite: `public/experiments/fibonacci-sphere.html`

- [ ] **Step 1:** Replace the file with a vanilla ESM implementation. Structure: theme CSS (tokens above) + importmap + one `<script type="module">`. Port from the React version verbatim where logic is sound: `generateShapes` (sphere/cube/torus + colors), glow texture, planet physics (instanced icosahedrons, gravity G=0.005, elastic collisions, per-shape containment), audio analyser displacement math, plexus line rebuild. State lives in a plain `params` object mutated by the controls; no framework.
- [ ] **Step 2:** Controls panel (left, `.panel`): audio source (Load file / **Use mic** / play-pause), shape segmented control, sliders (noise, gain, bass boost, size, rotation), numeric point count clamped `Math.max(100, Math.min(10000, v))`, toggles (plexus, planets, rainbow), color input. Header: kicker "EXPERIMENT" + title "Fibonacci Sphere". Hide-UI button top right.
- [ ] **Step 3:** Input: Pointer Events drag-rotate (single pointer), pinch zoom (two pointers — track `pointerdown/move/up` in a Map, zoom on distance delta), wheel zoom clamped [5, 200].
- [ ] **Step 4:** Mic: `navigator.mediaDevices.getUserMedia({ audio: true })` → `createMediaStreamSource` → analyser (NOT connected to destination). Errors → themed toast.
- [ ] **Step 5:** On point-count change dispose old position/color buffers before reallocating.
- [ ] **Step 6:** `npm run test:experiments` (drop the Tailwind noise-filter relevance for this page) + review screenshot. Commit: `feat(experiments): rebuild fibonacci sphere - vanilla ESM, world theme, touch + mic`.

### Task 3: Celestial Hand Control modernization

**Files:**
- Rewrite: `public/experiments/celestial-hand-control.html`

- [ ] **Step 1:** Keep the existing scene/tween/particle/constellation code (it is sound) but convert to ESM: `import * as THREE from "three"; import { OrbitControls } from "three/addons/controls/OrbitControls.js";`. Apply theme CSS; `#4facfe` → `var(--accent)` everywhere; nebula backdrop behind the canvas (canvas alpha: true). `renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5))`. Mark `<body data-modern="1">`.
- [ ] **Step 2:** MediaPipe migration:

```js
import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/+esm";
const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm");
const landmarker = await HandLandmarker.createFromOptions(vision, {
  baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task", delegate: "GPU" },
  runningMode: "VIDEO", numHands: 2
});
```

Camera via `getUserMedia({ video: { width: 640, height: 480 } })` directly (no `camera_utils`); per-frame `landmarker.detectForVideo(video, performance.now())` driven by `requestVideoFrameCallback` (fallback rAF). `result.landmarks` replaces `results.multiHandLandmarks` — the gesture heuristics are unchanged. Landmark overlay drawn manually: lines between the 21-point connection pairs + dots, lavender on the preview canvas.
- [ ] **Step 3:** Error handling: wrap model load + getUserMedia; on failure reset `#cam-btn` to idle text and show themed toast ("Camera unavailable — permission denied" / "Hand-tracking model failed to load"). Buttons wired with `addEventListener`; remove inline `onclick`.
- [ ] **Step 4:** Small screens: gesture guide behind a `?` toggle below 720px width.
- [ ] **Step 5:** `npm run test:experiments` — now includes the denied-camera assertion. Review screenshot. Commit: `feat(experiments): modernize celestial hand control - tasks-vision, world theme, error states`.

### Task 4: Final verification

- [ ] **Step 1:** `npm run build && npm run test:world && npm run test:experiments` — all green (world smoke guards against accidental regressions).
- [ ] **Step 2:** Review both screenshots against the world screenshots for palette consistency.
- [ ] **Step 3:** Commit any straggler fixes; done → finishing-a-development-branch.

## Self-Review

- Spec coverage: theme (T2/T3 step 1), fibonacci rewrite + touch + mic + clamps (T2), tasks-vision migration + all 8 gestures + error states + pixel cap + guide toggle (T3), smoke rig + denied-path (T1/T3), build gate (all). No gaps.
- The `data-modern` guard lets the rig pass before AND after rewrites — no chicken-and-egg.
- Type consistency: n/a across files (self-contained pages); rig selectors `#cam-btn` match Task 3 markup.
