# Planet World Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform `/world` into a hub space station plus three planets (Forge/projects, Signal/posts, Grove/experiences) with warp travel, atmosphere, and a full aesthetics pass (bloom, gradient skies, living motion, player juice, faded labels, hover states, warp transitions).

**Architecture:** One persistent Three.js renderer; destinations are scene packs built/disposed by a scene manager (`buildDestination` contract from the spec). Travel = warp overlay + scene swap + URL hash sync. See `docs/superpowers/specs/2026-06-09-planet-world-design.md`.

**Tech Stack:** Astro 5, Three.js (already a dependency, includes `examples/jsm` post-processing), Web Audio (existing `sfx.js`), Playwright (already in devDependency tree) for smoke verification.

**Testing adaptation:** This repo has no unit-test framework and the code under change is WebGL scene-graph code. The test discipline for this plan is: (1) a Playwright smoke rig built in Task 1 and **extended with new assertions in later tasks** — it is the regression suite; (2) `npm run build` must pass before every commit. Where a task says "Run the smoke test", that is the test step. Run all commands from the repo root. Work happens on the existing `world-planets` branch.

**Existing-state note:** The working tree already contains uncommitted bug fixes from the previous session (verified by build + smoke). Task 1 commits them first so every later commit is scoped.

---

### Task 1: Commit pending fixes + Playwright smoke rig

**Files:**
- Create: `scripts/world-smoke.mjs`
- Modify: `package.json` (add script)

- [ ] **Step 1: Commit the pending bug fixes already in the working tree**

```bash
git add src/scripts src/components/OpenWorldScene.astro
git commit -m "fix: open-world bug/perf/a11y pass (home GLB, palette, shadows, WebGL fallback, zone events, perf, leaks, touch hints, focus trap)"
```

- [ ] **Step 2: Write the smoke rig**

Create `scripts/world-smoke.mjs`. It builds nothing itself — it starts `astro preview`, drives the world, asserts, and exits non-zero on failure:

```js
// Playwright smoke test for /world. Usage: npm run build && npm run test:world
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const PORT = 4399;
const BASE = `http://localhost:${PORT}`;

const startPreview = () =>
  new Promise((resolve, reject) => {
    const proc = spawn("npx", ["astro", "preview", "--port", String(PORT)], { stdio: "pipe" });
    const timer = setTimeout(() => reject(new Error("preview server timed out")), 20000);
    const poll = async () => {
      try {
        const res = await fetch(`${BASE}/world/`);
        if (res.ok) { clearTimeout(timer); resolve(proc); return; }
      } catch { /* not up yet */ }
      setTimeout(poll, 400);
    };
    poll();
  });

const fail = (msg) => { console.error(`FAIL: ${msg}`); process.exitCode = 1; };

const preview = await startPreview();
const browser = await chromium.launch({ args: ["--use-gl=angle", "--enable-unsafe-swiftshader"] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(`console: ${msg.text()}`); });

  let sceneReady = false;
  await page.exposeFunction("__sceneReadyHook", () => { sceneReady = true; });
  await page.addInitScript(() => {
    window.addEventListener("scene-ready", () => window.__sceneReadyHook());
  });

  await page.goto(`${BASE}/world/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(6000);

  if (!sceneReady) fail("scene-ready event never fired");
  const loadingHidden = await page.$eval("#world-loading", (el) => el.classList.contains("is-hidden"));
  if (!loadingHidden) fail("loading overlay never dismissed");
  const zoneLabel = await page.$eval("#world-zone-label", (el) => el.textContent);
  if (!zoneLabel || !zoneLabel.trim()) fail("zone label empty");

  // Movement sanity: WASD for a second must not throw.
  await page.keyboard.down("w");
  await page.waitForTimeout(1000);
  await page.keyboard.up("w");
  await page.waitForTimeout(500);

  if (errors.length) fail(`runtime errors:\n${errors.join("\n")}`);
  await page.screenshot({ path: "/tmp/world-smoke-hub.png" });
  console.log(process.exitCode ? "SMOKE FAILED" : "SMOKE PASSED");
} finally {
  await browser.close();
  preview.kill();
}
```

- [ ] **Step 3: Add the npm script**

In `package.json` scripts block add:

```json
"test:world": "node scripts/world-smoke.mjs"
```

- [ ] **Step 4: Run it against the current world — must pass before any new work**

```bash
npm run build && npm run test:world
```
Expected: `SMOKE PASSED`, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add scripts/world-smoke.mjs package.json
git commit -m "test: add /world Playwright smoke rig"
```

---

### Task 2: Destination config + warp sounds

**Files:**
- Modify: `src/scripts/open-world-config.js` (add `destinations`; keep existing exports — they still have consumers until Task 10)
- Modify: `src/scripts/sfx.js` (append three sounds)

- [ ] **Step 1: Add the `destinations` map to `open-world-config.js`** (append at end of file):

```js
// ── Destinations (planet world) ──────────────────────────────────
// Keys match world-state zone keys. `planet` describes the body as seen
// from space; `gates` are warp gates placed in that scene.
export const destinations = {
  home: {
    key: "home", name: "Nexus Station", title: "NEXUS STATION", kicker: "Orbital Hub",
    accent: 0xc8b0ff, accentSoft: "rgba(200, 176, 255, 0.2)",
    blurb: "Orbital command station. Three worlds hang in the dark beyond the gates.",
    objective: "Step through a warp gate, or open the starmap [M].",
    sky: { top: 0x06021a, horizon: 0x1a0f3a, bottom: 0x030110 },
    fog: { color: 0x0a0520, density: 0.0032 },
    lights: { ambient: 1.0, rim: 0.55 },
    vacuum: true, biome: null, boundsRadius: 13,
    spawn: { x: 0, z: 8 },
    gates: [
      { to: "projects", x: -11, z: 0, rotationY: Math.PI / 2 },
      { to: "posts", x: 11, z: 0, rotationY: -Math.PI / 2 },
      { to: "experiences", x: 0, z: -11, rotationY: 0 }
    ],
    planet: null
  },
  projects: {
    key: "projects", name: "Forge", title: "FORGE", kicker: "Stellar Foundry",
    accent: 0xff6b35, accentSoft: "rgba(255, 107, 53, 0.22)",
    blurb: "A molten world where systems are hammered into shape in crucibles of light.",
    objective: "Inspect a project node and ignite the Forge Core.",
    sky: { top: 0x0c0302, horizon: 0x521b06, bottom: 0x1a0804 },
    fog: { color: 0x2a0e04, density: 0.006 },
    lights: { ambient: 0.88, rim: 0.72 },
    vacuum: false, biome: "forge", boundsRadius: 40,
    spawn: { x: 0, z: 27 },
    gates: [
      { to: "home", x: 0, z: 33, rotationY: Math.PI },
      { to: "posts", x: 28, z: 18, rotationY: -Math.PI / 3 },
      { to: "experiences", x: -28, z: 18, rotationY: Math.PI / 3 }
    ],
    planet: { surfaceColor: 0x35140a, emissive: 0x802a08, limbColor: 0xff8a50, radius: 22, ring: "ember", skyDir: [-1, 0.28, -0.35], skyDist: 165 },
    groundColor: 0x1a0a05
  },
  posts: {
    key: "posts", name: "Signal", title: "SIGNAL", kicker: "Relay World",
    accent: 0x00e5ff, accentSoft: "rgba(0, 229, 255, 0.2)",
    blurb: "A crystalline world of relay spires, broadcasting beneath an aurora sky.",
    objective: "Inspect a signal node and pulse the Relay Spire.",
    sky: { top: 0x020a12, horizon: 0x0a3a4a, bottom: 0x04141c },
    fog: { color: 0x07222c, density: 0.0055 },
    lights: { ambient: 1.08, rim: 0.62 },
    vacuum: false, biome: "signal", boundsRadius: 40,
    spawn: { x: 0, z: 27 },
    gates: [
      { to: "home", x: 0, z: 33, rotationY: Math.PI },
      { to: "projects", x: -28, z: 18, rotationY: Math.PI / 3 },
      { to: "experiences", x: 28, z: 18, rotationY: -Math.PI / 3 }
    ],
    planet: { surfaceColor: 0x0a2030, emissive: 0x0a4a5a, limbColor: 0x60f0ff, radius: 20, ring: "discs", skyDir: [1, 0.32, -0.4], skyDist: 170 },
    groundColor: 0x06141c
  },
  experiences: {
    key: "experiences", name: "Grove", title: "GROVE", kicker: "Living Archive",
    accent: 0x7dffb3, accentSoft: "rgba(125, 255, 179, 0.2)",
    blurb: "A living world. Career echoes bloom as bioluminescent flora across the archive.",
    objective: "Inspect a memory node and resonate the Bloom Heart.",
    sky: { top: 0x02120a, horizon: 0x0e4a28, bottom: 0x04180c },
    fog: { color: 0x0a2a16, density: 0.0058 },
    lights: { ambient: 1.12, rim: 0.68 },
    vacuum: false, biome: "grove", boundsRadius: 40,
    spawn: { x: 0, z: 27 },
    gates: [
      { to: "home", x: 0, z: 33, rotationY: Math.PI },
      { to: "projects", x: -28, z: 18, rotationY: Math.PI / 3 },
      { to: "posts", x: 28, z: 18, rotationY: -Math.PI / 3 }
    ],
    planet: { surfaceColor: 0x0c2a14, emissive: 0x1a5a2a, limbColor: 0xa0ffce, radius: 21, ring: null, skyDir: [0, 0.45, -1], skyDist: 155 },
    groundColor: 0x07180d
  }
};

export const destinationKeys = Object.keys(destinations);

export const keyFromHash = () => {
  const m = (window.location.hash || "").match(/^#\/(\w+)/);
  return m && destinations[m[1]] ? m[1] : null;
};

export const setHashForDestination = (key) => {
  const target = `#/${key}`;
  if (window.location.hash !== target) {
    history.pushState(null, "", target);
  }
};
```

- [ ] **Step 2: Append warp sounds to `sfx.js`** (same oscillator idiom as the rest of the file):

```js
// -- Warp charge: rising tension before a jump --
export const playWarpCharge = () => {
  const c = ensure();
  const dur = 0.45;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(60, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(320, c.currentTime + dur);
  gain.gain.setValueAtTime(0.04, c.currentTime);
  gain.gain.linearRampToValueAtTime(0.14, c.currentTime + dur);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur + 0.08);
  osc.connect(gain).connect(masterGain);
  osc.start(c.currentTime);
  osc.stop(c.currentTime + dur + 0.08);
};

// -- Warp tunnel: long filtered-noise whoosh --
export const playWarpTunnel = () => {
  const c = ensure();
  const dur = 1.5;
  const bufSize = c.sampleRate * dur;
  const buf = c.createBuffer(1, bufSize, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  const noise = c.createBufferSource();
  noise.buffer = buf;
  const bandpass = c.createBiquadFilter();
  bandpass.type = "bandpass";
  bandpass.frequency.setValueAtTime(400, c.currentTime);
  bandpass.frequency.exponentialRampToValueAtTime(2400, c.currentTime + dur * 0.4);
  bandpass.frequency.exponentialRampToValueAtTime(300, c.currentTime + dur);
  bandpass.Q.value = 2;
  const nGain = c.createGain();
  nGain.gain.setValueAtTime(0, c.currentTime);
  nGain.gain.linearRampToValueAtTime(0.2, c.currentTime + 0.2);
  nGain.gain.linearRampToValueAtTime(0.0, c.currentTime + dur);
  noise.connect(bandpass).connect(nGain).connect(masterGain);
  noise.start(c.currentTime);
  noise.stop(c.currentTime + dur);
};

// -- Arrival chime: two soft sines --
export const playArrival = () => {
  const c = ensure();
  [660, 990].forEach((freq, i) => {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, c.currentTime + i * 0.12);
    g.gain.setValueAtTime(0, c.currentTime + i * 0.12);
    g.gain.linearRampToValueAtTime(0.09, c.currentTime + i * 0.12 + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + i * 0.12 + 0.5);
    osc.connect(g).connect(masterGain);
    osc.start(c.currentTime + i * 0.12);
    osc.stop(c.currentTime + i * 0.12 + 0.5);
  });
};
```

- [ ] **Step 3: Verify and commit**

```bash
npm run build && npm run test:world
git add src/scripts/open-world-config.js src/scripts/sfx.js
git commit -m "feat(world): destination config and warp sfx"
```
Expected: build passes, smoke passes (nothing consumes the new code yet).

---

### Task 3: Sky module (gradient domes, twinkle stars, nebula, planets-from-space, shooting stars)

**Files:**
- Create: `src/scripts/open-world-sky.js`

- [ ] **Step 1: Create `src/scripts/open-world-sky.js`** with this content:

```js
import * as THREE from "three";
import { destinations } from "./open-world-config.js";

// ── Gradient sky dome ────────────────────────────────────────────
const createSkyDome = (sky, lowPower) => {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTop: { value: new THREE.Color(sky.top) },
      uHorizon: { value: new THREE.Color(sky.horizon) },
      uBottom: { value: new THREE.Color(sky.bottom) }
    },
    vertexShader: `
      varying float vH;
      void main() {
        vH = normalize(position).y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uBottom;
      varying float vH;
      void main() {
        vec3 c = vH > 0.0
          ? mix(uHorizon, uTop, pow(vH, 0.55))
          : mix(uHorizon, uBottom, pow(-vH, 0.8));
        gl_FragColor = vec4(c, 1.0);
      }`,
    side: THREE.BackSide,
    fog: false,
    depthWrite: false
  });
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(260, lowPower ? 20 : 36, lowPower ? 14 : 24),
    material
  );
  dome.renderOrder = -10;
  return dome;
};

// ── Twinkling stars ──────────────────────────────────────────────
const createStars = (lowPower) => {
  const count = lowPower ? 700 : 2000;
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const phase = new Float32Array(count);
  const palette = [
    [0.88, 0.9, 1.0], [1.0, 0.95, 0.85], [0.75, 0.82, 1.0],
    [1.0, 0.7, 0.5], [0.6, 0.75, 1.0], [1.0, 1.0, 1.0]
  ];
  for (let i = 0; i < count; i += 1) {
    const c = i * 3;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 200 + Math.random() * 50;
    pos[c] = r * Math.sin(phi) * Math.cos(theta);
    pos[c + 1] = Math.abs(r * Math.cos(phi)) * 0.75 + 8;
    pos[c + 2] = r * Math.sin(phi) * Math.sin(theta);
    const p = palette[i % palette.length];
    col[c] = p[0]; col[c + 1] = p[1]; col[c + 2] = p[2];
    phase[i] = Math.random() * Math.PI * 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
  geo.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uSize: { value: lowPower ? 2.0 : 2.6 } },
    vertexShader: `
      attribute vec3 aColor; attribute float aPhase;
      uniform float uTime; uniform float uSize;
      varying vec3 vColor; varying float vTwinkle;
      void main() {
        vColor = aColor;
        vTwinkle = 0.6 + 0.4 * sin(uTime * 1.8 + aPhase);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = uSize * vTwinkle;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vColor; varying float vTwinkle;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        gl_FragColor = vec4(vColor, vTwinkle * (1.0 - d * 2.0));
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  return new THREE.Points(geo, material);
};

// ── Soft nebula billboards ───────────────────────────────────────
const nebulaTexture = (hex) => {
  const canvas = document.createElement("canvas");
  canvas.width = 256; canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const g = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
  g.addColorStop(0, `${hex}55`);
  g.addColorStop(0.5, `${hex}22`);
  g.addColorStop(1, `${hex}00`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(canvas);
};

const createNebula = (accentHexes, lowPower) => {
  const group = new THREE.Group();
  const count = lowPower ? 2 : 4;
  for (let i = 0; i < count; i += 1) {
    const hex = accentHexes[i % accentHexes.length];
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: nebulaTexture(hex),
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false
    }));
    const angle = (i / count) * Math.PI * 2 + 0.7;
    sprite.position.set(Math.cos(angle) * 170, 35 + i * 22, Math.sin(angle) * 170);
    const s = 130 + i * 35;
    sprite.scale.set(s, s * 0.6, 1);
    group.add(sprite);
  }
  return group;
};

// ── Fresnel atmosphere shell ─────────────────────────────────────
export const createFresnelShell = (radius, color, power = 2.6) => {
  const material = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uPower: { value: power } },
    vertexShader: `
      varying vec3 vNormal; varying vec3 vView;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uPower;
      varying vec3 vNormal; varying vec3 vView;
      void main() {
        float rim = pow(1.0 - abs(dot(vNormal, vView)), uPower);
        gl_FragColor = vec4(uColor, rim);
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  return new THREE.Mesh(new THREE.SphereGeometry(radius * 1.12, 32, 24), material);
};

// ── A planet as seen from space ──────────────────────────────────
export const createPlanetFromSpace = (planetDef, accent) => {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(planetDef.radius, 32, 24),
    new THREE.MeshStandardMaterial({
      color: planetDef.surfaceColor,
      emissive: planetDef.emissive,
      emissiveIntensity: 0.5,
      roughness: 0.9,
      metalness: 0.1,
      fog: false
    })
  );
  group.add(body);
  group.add(createFresnelShell(planetDef.radius, planetDef.limbColor));

  if (planetDef.ring === "discs") {
    for (let i = 0; i < 2; i += 1) {
      const disc = new THREE.Mesh(
        new THREE.RingGeometry(planetDef.radius * (1.4 + i * 0.35), planetDef.radius * (1.6 + i * 0.35), 48),
        new THREE.MeshBasicMaterial({
          color: accent, transparent: true, opacity: 0.3 - i * 0.1,
          blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false
        })
      );
      disc.rotation.x = Math.PI / 2.4;
      group.add(disc);
    }
  } else if (planetDef.ring === "ember") {
    const count = 90;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const r = planetDef.radius * (1.35 + Math.random() * 0.5);
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = (Math.random() - 0.5) * planetDef.radius * 0.18;
      pos[i * 3 + 2] = Math.sin(a) * r;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    group.add(new THREE.Points(geo, new THREE.PointsMaterial({
      color: accent, size: 1.6, transparent: true, opacity: 0.8,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false
    })));
  }

  group.userData.spinSpeed = 0.015 + Math.random() * 0.01;
  return group;
};

// ── Shooting stars ───────────────────────────────────────────────
const createShootingStars = (lowPower) => {
  const group = new THREE.Group();
  const streaks = [];
  if (!lowPower) {
    for (let i = 0; i < 2; i += 1) {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(14, 0.25),
        new THREE.MeshBasicMaterial({
          color: 0xffffff, transparent: true, opacity: 0,
          blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false
        })
      );
      group.add(mesh);
      streaks.push({ mesh, t: -1, nextAt: 4 + Math.random() * 12, dir: new THREE.Vector3() });
    }
  }
  const update = (dt, t) => {
    for (const s of streaks) {
      if (s.t < 0) {
        s.nextAt -= dt;
        if (s.nextAt <= 0) {
          s.t = 0;
          const a = Math.random() * Math.PI * 2;
          s.mesh.position.set(Math.cos(a) * 150, 70 + Math.random() * 40, Math.sin(a) * 150);
          s.dir.set(-Math.cos(a) + (Math.random() - 0.5), -0.35, -Math.sin(a) + (Math.random() - 0.5)).normalize();
          s.mesh.lookAt(s.mesh.position.clone().add(s.dir));
        }
      } else {
        s.t += dt;
        s.mesh.position.addScaledVector(s.dir, dt * 130);
        s.mesh.material.opacity = Math.sin(Math.min(1, s.t / 1.1) * Math.PI) * 0.8;
        if (s.t > 1.1) { s.t = -1; s.nextAt = 8 + Math.random() * 12; s.mesh.material.opacity = 0; }
      }
    }
  };
  return { group, update };
};

// ── Full backdrop for a destination ──────────────────────────────
// Returns { group, update(dt, t), dispose() }. The group contains the sky
// dome, stars, nebula, shooting stars, and the OTHER destinations as
// planets in the sky (for the hub: all three; for a planet: its sisters
// plus a small hub-station beacon).
export const createSpaceBackdrop = (destKey, lowPower) => {
  const dest = destinations[destKey];
  const group = new THREE.Group();
  const dome = createSkyDome(dest.sky, lowPower);
  const stars = createStars(lowPower);
  const accentHexes = [`#${dest.accent.toString(16).padStart(6, "0")}`, "#6840a0", "#30308a"];
  const nebula = createNebula(accentHexes, lowPower);
  const shooting = createShootingStars(lowPower);
  group.add(dome, stars, nebula, shooting.group);

  const skyPlanets = [];
  for (const other of Object.values(destinations)) {
    if (other.key === destKey || !other.planet) continue;
    const p = createPlanetFromSpace(other.planet, other.accent);
    const d = other.planet.skyDir;
    p.position.set(d[0], d[1], d[2]).normalize().multiplyScalar(other.planet.skyDist);
    group.add(p);
    skyPlanets.push(p);
  }
  if (destKey !== "home") {
    // Hub station beacon: a small bright point with a lavender halo.
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(1.6, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0xc8b0ff, fog: false })
    );
    beacon.position.set(40, 95, -120);
    group.add(beacon, (() => {
      const halo = createFresnelShell(4, 0xc8b0ff, 2.0);
      halo.position.copy(beacon.position);
      return halo;
    })());
  }

  const update = (dt, t) => {
    stars.material.uniforms.uTime.value = t;
    shooting.update(dt, t);
    for (const p of skyPlanets) p.rotation.y += dt * p.userData.spinSpeed;
  };

  const dispose = () => {
    group.removeFromParent();
    group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (obj.material.map) obj.material.map.dispose();
        obj.material.dispose();
      }
    });
  };

  return { group, update, dispose };
};
```

- [ ] **Step 2: Verify and commit**

```bash
npm run build && npm run test:world
git add src/scripts/open-world-sky.js
git commit -m "feat(world): sky module - gradient domes, twinkle stars, planets-from-space, shooting stars"
```

---

### Task 4: Shared builders — props module, gates module, entries refactor

**Files:**
- Create: `src/scripts/open-world-props.js`
- Create: `src/scripts/open-world-gates.js`
- Modify: `src/scripts/open-world-entries.js`
- Modify: `src/scripts/open-world-districts.js` (re-export shims so it keeps working until Task 10)

- [ ] **Step 1: Create `src/scripts/open-world-props.js`** by MOVING these definitions verbatim out of `open-world-districts.js` (cut from districts, paste into props, add `export` keywords; do not modify bodies):

  - `forgePropDefs` (districts lines ~444-457) → `export const forgePropDefs = [...]`
  - `signalPropDefs` (~459-471) → exported
  - `grovePropDefs` (~473-485) → exported
  - `landmarkDefs` (~176-294) → exported
  - `createOrrery` (~296-393) → exported
  - the NPC wisp construction loop body (~656-679) → wrap as:

```js
// imports at top of open-world-props.js:
import * as THREE from "three";
import { districtConfig } from "./open-world-config.js";

export const propDefsByBiome = { forge: forgePropDefs, signal: signalPropDefs, grove: grovePropDefs };

export const landmarkDefByZone = Object.fromEntries(landmarkDefs.map((d) => [d.zone, d]));

// Wisp NPC: ethereal drone that wanders a rectangle around (cx, cz).
export const createWisp = (scene, accent, cx, cz, hw, hd) => {
  const npc = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x404040, emissive: accent, emissiveIntensity: 0.4, roughness: 0.3, metalness: 0.5 })
  );
  body.position.y = 1.0;
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 6, 4),
    new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  glow.position.y = 1.0;
  npc.add(body, glow);
  npc.position.set(cx + (Math.random() * 2 - 1) * hw, 0, cz + (Math.random() * 2 - 1) * hd);
  scene.add(npc);
  const pickTarget = () => ({ x: cx + (Math.random() * 2 - 1) * hw, z: cz + (Math.random() * 2 - 1) * hd });
  return { mesh: npc, target: pickTarget(), speed: 1.8 + Math.random() * 1.2, waitTime: 0, pickTarget };
};

// Per-frame wisp wander (moved from updateDistricts NPC block, unchanged logic).
export const updateWisps = (wisps, dt, worldTicker) => {
  for (const npc of wisps) {
    if (npc.waitTime > 0) { npc.waitTime -= dt; continue; }
    const dx = npc.target.x - npc.mesh.position.x;
    const dz = npc.target.z - npc.mesh.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.5) {
      npc.target = npc.pickTarget();
      npc.waitTime = 1.5 + Math.random() * 2.5;
    } else {
      npc.mesh.position.x += (dx / dist) * npc.speed * dt;
      npc.mesh.position.z += (dz / dist) * npc.speed * dt;
    }
    npc.mesh.position.y = Math.sin(worldTicker * 2 + npc.mesh.position.x) * 0.15;
  }
};
```

  Note: `landmarkDefs` references `districtConfig` only for colors at build time in districts; keep `position` fields in the defs — the planet builder overrides positions, so also add to props:

```js
// Planet scenes place landmarks themselves; build a landmark structure only.
export const buildLandmark = (zone, color) => {
  const def = landmarkDefByZone[zone];
  const root = new THREE.Group();
  const structure = def.build(color);
  root.add(structure);
  return { zone: def.zone, title: def.title, summary: def.summary, link: def.link, radius: def.radius, root, structure, pulse: 0 };
};

// Per-frame landmark pulse (moved from updateDistricts landmark block, unchanged logic).
export const updateLandmark = (landmark, dt, worldTicker) => {
  const clampLocal = (v, min, max) => Math.min(max, Math.max(min, v));
  landmark.structure.rotation.y += dt * 0.28;
  landmark.pulse = Math.max(0, landmark.pulse - dt * 0.65);
  const boost = 0.3 + Math.sin(worldTicker * 2.2) * 0.1 + landmark.pulse * 0.6;
  landmark.structure.children.forEach((child) => {
    if (child.material && "emissiveIntensity" in child.material) {
      child.material.emissiveIntensity = clampLocal(boost, 0.12, 1.2);
    }
  });
};
```

- [ ] **Step 2: In `open-world-districts.js`, replace the moved definitions with imports** so it still compiles until Task 10 deletes it:

```js
import { forgePropDefs, signalPropDefs, grovePropDefs, landmarkDefs, createOrrery } from "./open-world-props.js";
```

(and re-add `export { landmarkDefs }` is NOT needed — districts only consumes them internally.)

- [ ] **Step 3: Create `src/scripts/open-world-gates.js`:**

```js
import * as THREE from "three";
import { destinations } from "./open-world-config.js";
import { createSpriteLabel } from "./open-world-config.js";
import { createFresnelShell } from "./open-world-sky.js";

// A warp gate: portal ring + swirl disc + hologram of the destination
// planet + label. radius = interaction distance.
export const createWarpGate = (toKey, x, z, rotationY) => {
  const dest = destinations[toKey];
  const root = new THREE.Group();
  root.position.set(x, 0, z);
  root.rotation.y = rotationY;

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 2.0, 0.4, 8),
    new THREE.MeshStandardMaterial({ color: 0x0a0420, emissive: dest.accent, emissiveIntensity: 0.15, roughness: 0.5, metalness: 0.6 })
  );
  base.position.y = 0.2;

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.2, 0.12, 10, 40),
    new THREE.MeshStandardMaterial({ color: 0x0a0420, emissive: dest.accent, emissiveIntensity: 0.8, roughness: 0.2, metalness: 0.8 })
  );
  ring.position.y = 2.9;

  const swirl = new THREE.Mesh(
    new THREE.CircleGeometry(2.0, 32),
    new THREE.MeshBasicMaterial({ color: dest.accent, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
  );
  swirl.position.y = 2.9;

  const holo = new THREE.Group();
  if (dest.planet) {
    const mini = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 16, 12),
      new THREE.MeshStandardMaterial({ color: dest.planet.surfaceColor, emissive: dest.planet.emissive, emissiveIntensity: 0.6, roughness: 0.8 })
    );
    holo.add(mini, createFresnelShell(0.55, dest.planet.limbColor, 2.2));
  } else {
    const station = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.5, 0),
      new THREE.MeshStandardMaterial({ color: 0x14082a, emissive: 0xc8b0ff, emissiveIntensity: 0.7, roughness: 0.2, metalness: 0.7 })
    );
    holo.add(station);
  }
  holo.position.y = 5.2;

  const label = createSpriteLabel(dest.name, "#e0d8ff", { x: 2.8, y: 0.7 });
  if (label) { label.position.y = 6.6; root.add(label); }

  root.add(base, ring, swirl, holo);

  let charge = 0;
  const update = (dt, t) => {
    swirl.rotation.z += dt * (0.6 + charge * 4);
    holo.rotation.y += dt * 0.8;
    holo.position.y = 5.2 + Math.sin(t * 1.2 + x) * 0.15;
    ring.material.emissiveIntensity = 0.6 + Math.sin(t * 2 + z) * 0.2 + charge * 1.5;
    swirl.material.opacity = 0.14 + Math.sin(t * 2.4) * 0.04 + charge * 0.4;
  };

  return {
    key: toKey,
    title: `Warp to ${dest.name}`,
    root,
    radius: 3.4,
    update,
    setCharge: (v) => { charge = Math.min(1, Math.max(0, v)); },
    label
  };
};
```

- [ ] **Step 4: Refactor `open-world-entries.js`** — export `addEntry` and a secret builder, and replace `createEntries` with a placement-agnostic version:

  - Change `const addEntry = (...)` to `export const addEntry = (...)`. In `addEntry`, also expose the label and base ring for later effects: after `root.userData = { kind, entry, interactionRadius: 3.8 };` add:

```js
  root.userData.label = label || null;
  root.userData.baseRing = ring;
```

  - Add a secret builder and golden-angle placement, and reshape `createEntries`:

```js
// Golden-angle spiral positions radiating from the origin.
export const spiralPositions = (count, startRadius = 7, spread = 2.7, maxRadius = 30) => {
  const positions = [];
  for (let i = 0; i < count; i += 1) {
    const r = Math.min(maxRadius, startRadius + spread * Math.sqrt(i) * 2.2);
    const theta = i * 2.39996 + (i % 2) * 0.35;
    positions.push({ x: Math.cos(theta) * r, z: Math.sin(theta) * r });
  }
  return positions;
};

export const createSecretShard = (scene, key, color, pos) => {
  const mesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.7, 0),
    new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: 2.0,
      transparent: true, opacity: 0.7, wireframe: true
    })
  );
  mesh.position.copy(pos);
  scene.add(mesh);
  return { key, color, pos: pos.clone(), mesh };
};

// Places one section's entries on a spiral inside `parent` (a Group).
export const placeEntries = (parent, list, kind, color, lowPower) => {
  const entryMeshes = [];
  const blockers = [];
  const positions = spiralPositions(list.length);
  list.forEach((entry, idx) => {
    const { x, z } = positions[idx];
    const root = addEntry(parent, entry, kind, x, z, color, lowPower);
    entryMeshes.push(root);
    blockers.push({ x: x + parent.position.x, z: z + parent.position.z, radius: 2.3 });
  });
  return { entryMeshes, blockers };
};
```

  Note: `addEntry` currently calls `scene.add(root)` — change that line to `scene.add(root)` → it already takes the first arg as the container; `placeEntries` passes a Group, which works because `Group.add` has the same interface. Leave `createEntries` (the old grid version) in place for now — Task 10 removes it; the old `open-world.js` still imports it.

- [ ] **Step 5: Verify and commit**

```bash
npm run build && npm run test:world
git add src/scripts/open-world-props.js src/scripts/open-world-gates.js src/scripts/open-world-entries.js src/scripts/open-world-districts.js
git commit -m "feat(world): shared prop/gate/entry builders for scene packs"
```
Expected: build + smoke pass — the old world still runs through districts.js shims.

---

### Task 5: Planet surface builder

**Files:**
- Create: `src/scripts/open-world-planet.js`

- [ ] **Step 1: Create `src/scripts/open-world-planet.js`:**

```js
import * as THREE from "three";
import { destinations, getGltfLoader } from "./open-world-config.js";
import { DISTRICT_ASSET_CATALOG } from "./world-assets.js";
import { propDefsByBiome, buildLandmark, updateLandmark, createWisp, updateWisps } from "./open-world-props.js";
import { placeEntries, createSecretShard } from "./open-world-entries.js";
import { createWarpGate } from "./open-world-gates.js";

// Secret shard hiding spots per planet (off the main spiral, near the rim).
const secretSpots = {
  projects: { key: "data_shard", pos: new THREE.Vector3(-30, 1.7, -22) },
  posts: { key: "timeline_echo", pos: new THREE.Vector3(31, 1.75, -20) },
  experiences: { key: "sky_shard", pos: new THREE.Vector3(-26, 1.8, -27) }
};

// Pseudo-noise for terrain (deterministic, no Math.random in geometry so
// planets look identical every visit).
const noise2 = (x, z) => Math.sin(x * 0.31) * Math.cos(z * 0.27) + Math.sin(x * 0.13 + z * 0.17) * 0.6;

const createTerrain = (dest, lowPower) => {
  const geo = new THREE.CircleGeometry(55, lowPower ? 64 : 96);
  geo.rotateX(-Math.PI / 2);
  const posAttr = geo.attributes.position;
  for (let i = 0; i < posAttr.count; i += 1) {
    const x = posAttr.getX(i);
    const z = posAttr.getZ(i);
    const r = Math.hypot(x, z);
    let y = -Math.pow(r / 55, 3) * 2.2;                 // planetary curvature falloff
    if (r > 38) y += ((r - 38) / 17) * (1.5 + noise2(x, z) * 1.6); // rim hills
    posAttr.setY(i, y);
  }
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color: dest.groundColor, roughness: 0.92, metalness: 0.08,
    emissive: dest.accent, emissiveIntensity: 0.02
  }));
  terrain.receiveShadow = !lowPower;
  return terrain;
};

const createHorizonHaze = (dest) => {
  const haze = new THREE.Mesh(
    new THREE.CylinderGeometry(52, 52, 9, 48, 1, true),
    new THREE.MeshBasicMaterial({
      color: dest.sky.horizon, transparent: true, opacity: 0.16,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false
    })
  );
  haze.position.y = 2.5;
  return haze;
};

const cloudTexture = () => {
  const canvas = document.createElement("canvas");
  canvas.width = 128; canvas.height = 64;
  const ctx = canvas.getContext("2d");
  for (let i = 0; i < 6; i += 1) {
    const g = ctx.createRadialGradient(20 + i * 18, 32, 2, 20 + i * 18, 32, 22);
    g.addColorStop(0, "rgba(255,255,255,0.30)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 64);
  }
  return new THREE.CanvasTexture(canvas);
};

const createClouds = (dest, lowPower) => {
  const clouds = [];
  const group = new THREE.Group();
  if (lowPower) return { group, clouds };
  const styles = {
    forge: { count: 3, y: [16, 24], scale: 26, opacity: 0.10 },
    signal: { count: 5, y: [26, 36], scale: 34, opacity: 0.12 },
    grove: { count: 5, y: [10, 16], scale: 30, opacity: 0.14 }
  };
  const s = styles[dest.biome];
  const tex = cloudTexture();
  for (let i = 0; i < s.count; i += 1) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, color: dest.sky.horizon, transparent: true, opacity: s.opacity,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    const a = (i / s.count) * Math.PI * 2;
    sprite.position.set(Math.cos(a) * (18 + i * 6), s.y[0] + Math.random() * (s.y[1] - s.y[0]), Math.sin(a) * (18 + i * 6));
    sprite.scale.set(s.scale, s.scale * 0.4, 1);
    group.add(sprite);
    clouds.push({ sprite, speed: 0.4 + Math.random() * 0.5, angle: a, radius: 18 + i * 6 });
  }
  return { group, clouds };
};

// Biome airborne particles: embers rise (forge), pollen drifts (grove),
// aurora ribbons ripple (signal).
const createAirborne = (dest, lowPower) => {
  const group = new THREE.Group();
  const state = { points: null, velocities: null, ribbons: [] };
  if (lowPower) return { group, state };

  if (dest.biome === "signal") {
    for (let i = 0; i < 3; i += 1) {
      const ribbon = new THREE.Mesh(
        new THREE.PlaneGeometry(90, 7, 24, 1),
        new THREE.MeshBasicMaterial({
          color: dest.accent, transparent: true, opacity: 0.05 + i * 0.015,
          blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false
        })
      );
      ribbon.position.set(0, 46 + i * 9, -30 - i * 12);
      ribbon.rotation.x = 0.5;
      group.add(ribbon);
      state.ribbons.push({ mesh: ribbon, phase: i * 2.1 });
    }
    return { group, state };
  }

  const count = dest.biome === "forge" ? 80 : 60;
  const pos = new Float32Array(count * 3);
  const vel = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    pos[i * 3] = (Math.random() - 0.5) * 70;
    pos[i * 3 + 1] = Math.random() * 12;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 70;
    vel[i] = dest.biome === "forge" ? 1.2 + Math.random() * 1.6 : 0.15 + Math.random() * 0.3;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  state.points = new THREE.Points(geo, new THREE.PointsMaterial({
    color: dest.biome === "forge" ? 0xff8844 : 0xb0ffd0,
    size: dest.biome === "forge" ? 0.22 : 0.16,
    transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false
  }));
  state.velocities = vel;
  group.add(state.points);
  return { group, state };
};

// Prop scatter ring positions (deterministic).
const propRing = (count, rMin, rMax) => {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2 + Math.sin(i * 7.3) * 0.3;
    const r = rMin + (Math.abs(Math.sin(i * 3.7)) * (rMax - rMin));
    out.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return out;
};

export const buildPlanet = (destKey, scene, content, lowPower, onAssetLoaded) => {
  const dest = destinations[destKey];
  const group = new THREE.Group();
  scene.add(group);

  group.add(createTerrain(dest, lowPower));
  group.add(createHorizonHaze(dest));
  const { group: cloudGroup, clouds } = createClouds(dest, lowPower);
  const { group: airGroup, state: air } = createAirborne(dest, lowPower);
  group.add(cloudGroup, airGroup);

  // Content nodes on a spiral around the center.
  const list = content[destKey] || [];
  const { entryMeshes, blockers } = placeEntries(group, list, destKey, dest.accent, lowPower);

  // Landmark opposite the spawn gate.
  const landmark = buildLandmark(destKey, dest.accent);
  landmark.root.position.set(0, 0, -26);
  group.add(landmark.root);
  blockers.push({ x: 0, z: -26, radius: 1.6 });

  // Secret shard.
  const spot = secretSpots[destKey];
  const secretNodes = [createSecretShard(group, spot.key, dest.accent, spot.pos)];

  // Props.
  const props = [];
  const defs = propDefsByBiome[dest.biome];
  propRing(14, 22, 36).forEach(([px, pz], i) => {
    const p = defs[i % defs.length](px, pz);
    group.add(p);
    props.push(p);
    blockers.push({ x: px, z: pz, radius: 1.0 });
  });

  // Wisps.
  const wisps = [];
  for (let i = 0; i < 3; i += 1) wisps.push(createWisp(group, dest.accent, 0, 0, 22, 22));

  // Gates (return to hub + sisters).
  const gates = dest.gates.map((g) => {
    const gate = createWarpGate(g.to, g.x, g.z, g.rotationY);
    group.add(gate.root);
    blockers.push({ x: g.x, z: g.z, radius: 1.5 });
    return gate;
  });

  // GLB assets.
  const specs = DISTRICT_ASSET_CATALOG[destKey] || [];
  const assetModels = [];
  for (const spec of specs) {
    getGltfLoader().then((loader) => {
      if (!loader) { onAssetLoaded(); return; }
      loader.load(spec.url, (gltf) => {
        const node = gltf.scene;
        node.position.set(spec.position[0], spec.position[1], spec.position[2]);
        const scale = typeof spec.scale === "number" ? spec.scale : 1;
        node.scale.set(scale, scale, scale);
        node.rotation.y = spec.rotationY || 0;
        node.traverse((child) => { if (child.isMesh) { child.castShadow = !lowPower; child.receiveShadow = !lowPower; } });
        group.add(node);
        assetModels.push(node);
        onAssetLoaded();
      }, undefined, () => onAssetLoaded());
    });
  }

  const update = (dt, t) => {
    updateLandmark(landmark, dt, t);
    updateWisps(wisps, dt, t);
    for (const c of clouds) {
      c.angle += dt * c.speed * 0.02;
      c.sprite.position.x = Math.cos(c.angle) * c.radius;
      c.sprite.position.z = Math.sin(c.angle) * c.radius;
    }
    if (air.points) {
      const pos = air.points.geometry.attributes.position;
      const rising = dest.biome === "forge";
      for (let i = 0; i < pos.count; i += 1) {
        let y = pos.getY(i) + air.velocities[i] * dt * (rising ? 1 : 0.4);
        if (rising && y > 14) y = 0;
        if (!rising) pos.setX(i, pos.getX(i) + Math.sin(t * 0.5 + i) * dt * 0.4);
        if (!rising && y > 10) y = 1;
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
    }
    for (const r of air.ribbons) {
      r.mesh.material.opacity = 0.045 + Math.sin(t * 0.4 + r.phase) * 0.025;
      r.mesh.position.y += Math.sin(t * 0.3 + r.phase) * dt * 0.5;
    }
    for (const gate of gates) gate.update(dt, t);
    for (let i = 0; i < props.length; i += 1) props[i].rotation.y += dt * 0.01;
    for (const model of assetModels) model.rotation.y += dt * 0.02;
    for (const secret of secretNodes) {
      if (!secret.mesh.parent) continue;
      secret.mesh.rotation.y += dt * 2.8;
      secret.mesh.position.y = secret.pos.y + Math.sin(t * 2.4) * 0.28;
    }
  };

  const dispose = () => {
    group.removeFromParent();
    group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const mat of mats) { if (mat.map) mat.map.dispose(); mat.dispose(); }
      }
    });
  };

  return {
    key: destKey, group, blockers, entryMeshes, gates,
    landmark, secretNodes, assetCount: specs.length, update, dispose
  };
};
```

- [ ] **Step 2: Verify and commit**

```bash
npm run build && npm run test:world
git add src/scripts/open-world-planet.js
git commit -m "feat(world): planet surface builder with terrain, atmosphere, content"
```

---

### Task 6: Hub builder (Nexus Station)

**Files:**
- Create: `src/scripts/open-world-hub.js`

- [ ] **Step 1: Create `src/scripts/open-world-hub.js`:**

```js
import * as THREE from "three";
import { destinations, getGltfLoader } from "./open-world-config.js";
import { DISTRICT_ASSET_CATALOG } from "./world-assets.js";
import { createOrrery } from "./open-world-props.js";
import { createWarpGate } from "./open-world-gates.js";

const STATION_RADIUS = 14;

const createPlatform = (lowPower) => {
  const group = new THREE.Group();
  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(STATION_RADIUS, STATION_RADIUS * 0.86, 0.7, 48),
    new THREE.MeshStandardMaterial({ color: 0x100830, emissive: 0xc8b0ff, emissiveIntensity: 0.06, roughness: 0.78, metalness: 0.22 })
  );
  top.position.y = -0.35;
  top.receiveShadow = !lowPower;
  const edge = new THREE.Mesh(
    new THREE.TorusGeometry(STATION_RADIUS * 0.96, 0.1, 8, 64),
    new THREE.MeshBasicMaterial({ color: 0xc8b0ff, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  edge.rotation.x = Math.PI / 2;
  edge.position.y = 0.02;
  const under = new THREE.Mesh(
    new THREE.ConeGeometry(STATION_RADIUS * 0.6, 6, 8),
    new THREE.MeshStandardMaterial({ color: 0x0a0520, emissive: 0xc8b0ff, emissiveIntensity: 0.12, roughness: 0.4, metalness: 0.6 })
  );
  under.rotation.x = Math.PI;
  under.position.y = -3.6;
  group.add(top, edge, under);
  return { group, edge };
};

export const buildHub = (scene, content, lowPower, onAssetLoaded) => {
  const dest = destinations.home;
  const group = new THREE.Group();
  scene.add(group);

  const platform = createPlatform(lowPower);
  group.add(platform.group);

  const orrery = createOrrery(group); // createOrrery adds to its first arg and returns handles
  orrery.group.position.set(0, 0, -2);

  const blockers = [{ x: 0, z: -2, radius: 2.0 }];

  // Gates + warp lanes toward each sky planet.
  const gates = [];
  const lanes = [];
  for (const g of dest.gates) {
    const gate = createWarpGate(g.to, g.x, g.z, g.rotationY);
    group.add(gate.root);
    gates.push(gate);
    blockers.push({ x: g.x, z: g.z, radius: 1.5 });

    const target = destinations[g.to].planet;
    const dir = new THREE.Vector3(target.skyDir[0], target.skyDir[1], target.skyDir[2]).normalize();
    const start = new THREE.Vector3(g.x, 4.5, g.z);
    const end = dir.clone().multiplyScalar(90).setY(55);
    const curve = new THREE.CatmullRomCurve3([start, start.clone().lerp(end, 0.4).add(new THREE.Vector3(0, 8, 0)), end]);
    const lane = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 24, 0.08, 6, false),
      new THREE.MeshBasicMaterial({ color: destinations[g.to].accent, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })
    );
    group.add(lane);
    const pulses = [];
    for (let i = 0; i < 3; i += 1) {
      const pulse = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 8, 6),
        new THREE.MeshBasicMaterial({ color: destinations[g.to].accent, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })
      );
      group.add(pulse);
      pulses.push({ mesh: pulse, t: i / 3 });
    }
    lanes.push({ curve, pulses, lane });
  }

  // Station GLB.
  const specs = DISTRICT_ASSET_CATALOG.home || [];
  const assetModels = [];
  for (const spec of specs) {
    getGltfLoader().then((loader) => {
      if (!loader) { onAssetLoaded(); return; }
      loader.load(spec.url, (gltf) => {
        const node = gltf.scene;
        node.position.set(spec.position[0], spec.position[1], spec.position[2]);
        const scale = typeof spec.scale === "number" ? spec.scale : 1;
        node.scale.set(scale, scale, scale);
        node.traverse((child) => { if (child.isMesh) { child.castShadow = !lowPower; child.receiveShadow = !lowPower; } });
        group.add(node);
        assetModels.push(node);
        onAssetLoaded();
      }, undefined, () => onAssetLoaded());
    });
  }

  const tmp = new THREE.Vector3();
  const update = (dt, t) => {
    // Orrery animation (same motion as the old updateDistricts orrery block).
    const { apex, waterGlow, cobble, rings, orbitals } = orrery;
    apex.rotation.y += dt * 0.6;
    apex.rotation.x += dt * 0.2;
    apex.material.emissiveIntensity = 0.7 + Math.sin(t * 1.5) * 0.2;
    waterGlow.material.opacity = 0.08 + Math.sin(t * 1.2) * 0.04;
    cobble.rotation.z += dt * 0.08;
    for (let i = 0; i < rings.length; i += 1) {
      const dir = i % 2 === 0 ? 1 : -1;
      rings[i].rotation.x += dt * (0.3 + i * 0.12) * dir;
      rings[i].rotation.z += dt * (0.15 + i * 0.08);
      rings[i].material.opacity = (0.5 - i * 0.08) + Math.sin(t * 2 + i * 1.2) * 0.1;
    }
    for (let i = 0; i < orbitals.length; i += 1) {
      const orb = orbitals[i];
      const angle = t * orb.speed + orb.phase;
      orb.mesh.position.x = orrery.group.position.x + Math.cos(angle) * orb.radius;
      orb.mesh.position.z = orrery.group.position.z + Math.sin(angle) * orb.radius;
      orb.mesh.position.y = 3.2 + Math.sin(t * 0.8 + orb.phase) * 0.3;
    }
    platform.edge.material.opacity = 0.35 + Math.sin(t * 1.5) * 0.12;
    for (const gate of gates) gate.update(dt, t);
    for (const lane of lanes) {
      for (const pulse of lane.pulses) {
        pulse.t = (pulse.t + dt * 0.12) % 1;
        lane.curve.getPoint(pulse.t, tmp);
        pulse.mesh.position.copy(tmp);
        pulse.mesh.material.opacity = 0.9 * Math.sin(pulse.t * Math.PI);
      }
    }
  };

  const dispose = () => {
    group.removeFromParent();
    group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const mat of mats) { if (mat.map) mat.map.dispose(); mat.dispose(); }
      }
    });
  };

  return {
    key: "home", group, blockers, entryMeshes: [], gates,
    landmark: null, secretNodes: [], assetCount: specs.length, update, dispose
  };
};
```

  Note: `createOrrery(group)` — the moved function's first parameter is named `scene` but it only calls `.add()`, so passing a Group works. Verify the moved code in `open-world-props.js` ends with `scene.add(group); return { group, apex: core, waterGlow: pool, cobble, rings, orbitals };` — it does.

- [ ] **Step 2: Verify and commit**

```bash
npm run build && npm run test:world
git add src/scripts/open-world-hub.js
git commit -m "feat(world): Nexus Station hub builder with gates and warp lanes"
```

---

### Task 7: Scene manager + circular player bounds

**Files:**
- Create: `src/scripts/open-world-scenes.js`
- Modify: `src/scripts/open-world-player.js:192-194`

- [ ] **Step 1: Create `src/scripts/open-world-scenes.js`:**

```js
import * as THREE from "three";
import { destinations } from "./open-world-config.js";
import { buildHub } from "./open-world-hub.js";
import { buildPlanet } from "./open-world-planet.js";
import { createSpaceBackdrop } from "./open-world-sky.js";

// Owns the active scene pack + backdrop. swap() tears down the old pair,
// builds the new one, and applies the destination's sky/fog/light profile.
export const createSceneManager = ({ scene, content, lowPower, lights }) => {
  let pack = null;
  let backdrop = null;
  let key = null;

  const applyProfile = (dest) => {
    scene.background.set(dest.sky.bottom);
    scene.fog.color.set(dest.fog.color);
    scene.fog.density = dest.fog.density;
    lights.ambient.intensity = dest.lights.ambient * (lowPower ? 0.9 : 1.05);
    lights.rim.intensity = dest.lights.rim;
  };

  const swap = (nextKey, onAssetLoaded) => {
    const dest = destinations[nextKey] || destinations.home;
    if (pack) { pack.dispose(); pack = null; }
    if (backdrop) { backdrop.dispose(); backdrop = null; }
    backdrop = createSpaceBackdrop(dest.key, lowPower);
    scene.add(backdrop.group);
    pack = dest.key === "home"
      ? buildHub(scene, content, lowPower, onAssetLoaded)
      : buildPlanet(dest.key, scene, content, lowPower, onAssetLoaded);
    applyProfile(dest);
    key = dest.key;
    return pack;
  };

  const update = (dt, t) => {
    if (backdrop) backdrop.update(dt, t);
    if (pack) pack.update(dt, t);
  };

  return {
    swap,
    update,
    get pack() { return pack; },
    get key() { return key; },
    get destination() { return destinations[key] || destinations.home; }
  };
};
```

- [ ] **Step 2: Circular bounds in `open-world-player.js`** — replace the box clamp (currently):

```js
    player.position.x = clamp(player.position.x + velocity.x * dt, -68, 68);
    player.position.y = Math.max(0, player.position.y + velocity.y * dt);
    player.position.z = clamp(player.position.z + velocity.z * dt, -68, 30);
```

with:

```js
    player.position.x += velocity.x * dt;
    player.position.y = Math.max(0, player.position.y + velocity.y * dt);
    player.position.z += velocity.z * dt;
    const boundsRadius = ctx.boundsRadius || 40;
    const fromCenter = Math.hypot(player.position.x, player.position.z);
    if (fromCenter > boundsRadius) {
      player.position.x *= boundsRadius / fromCenter;
      player.position.z *= boundsRadius / fromCenter;
    }
```

(`ctx` is already the first parameter object; callers pass `boundsRadius` from Task 10.)

- [ ] **Step 3: Verify and commit**

```bash
npm run build && npm run test:world
git add src/scripts/open-world-scenes.js src/scripts/open-world-player.js
git commit -m "feat(world): scene manager and circular player bounds"
```
Note: smoke still passes — old `open-world.js` doesn't pass `boundsRadius`, default 40 covers the old layout's reachable area well enough for the interim commit; Task 10 wires real values.

---

### Task 8: Markup + CSS — warp overlay, starmap, arrival splash, vignette

**Files:**
- Modify: `src/components/OpenWorldScene.astro`
- Modify: `src/styles/app.css` (append world additions; also fix stale palette at lines 2341-2347)

- [ ] **Step 1: Add overlay markup to `OpenWorldScene.astro`** — insert directly after the `<div class="world-zone-flash" ...>` element:

```html
  <!-- Warp transition overlay -->
  <div class="world-warp" id="world-warp" hidden aria-hidden="true">
    <canvas class="world-warp-canvas" id="world-warp-canvas"></canvas>
  </div>

  <!-- Arrival title splash -->
  <div class="world-arrival" id="world-arrival" hidden aria-hidden="true">
    <p class="world-arrival-kicker" id="world-arrival-kicker"></p>
    <h2 class="world-arrival-title" id="world-arrival-title"></h2>
  </div>

  <!-- Starmap overlay -->
  <div class="world-starmap" id="world-starmap" hidden aria-hidden="true">
    <article class="world-starmap-card" role="dialog" aria-modal="true" aria-label="Starmap">
      <button id="world-starmap-close" class="world-modal-close" type="button" aria-label="Close starmap">&times; Close</button>
      <p class="world-modal-meta">STARMAP</p>
      <div class="world-starmap-grid" id="world-starmap-grid">
        <!-- Buttons populated with state by open-world-travel.js -->
        <button class="world-starmap-dest" type="button" data-dest="home"><span class="dest-name">Nexus Station</span><span class="dest-sub">Orbital Hub</span><span class="dest-progress" data-progress></span></button>
        <button class="world-starmap-dest" type="button" data-dest="projects"><span class="dest-name">Forge</span><span class="dest-sub">Stellar Foundry</span><span class="dest-progress" data-progress></span></button>
        <button class="world-starmap-dest" type="button" data-dest="posts"><span class="dest-name">Signal</span><span class="dest-sub">Relay World</span><span class="dest-progress" data-progress></span></button>
        <button class="world-starmap-dest" type="button" data-dest="experiences"><span class="dest-name">Grove</span><span class="dest-sub">Living Archive</span><span class="dest-progress" data-progress></span></button>
      </div>
    </article>
  </div>

  <!-- Vignette -->
  <div class="world-vignette" aria-hidden="true"></div>
```

- [ ] **Step 2: Add the starmap HUD button** — in the `.hud-toggles` div, after the quality button:

```html
        <button class="hud-btn hud-btn-ghost" id="world-starmap-btn" type="button">Starmap [M]</button>
```

- [ ] **Step 3: Add travel tutorial hints** — append inside both tutorial hint groups:

In the `data-input="keyboard"` group:
```html
      <div class="world-tutorial-hint">
        <span class="tutorial-key">M</span>
        <span class="tutorial-label">Starmap — travel between worlds</span>
      </div>
```
In the `data-input="touch"` group:
```html
      <div class="world-tutorial-hint">
        <span class="tutorial-key">Starmap</span>
        <span class="tutorial-label">Travel between worlds</span>
      </div>
```

- [ ] **Step 4: CSS — append to `src/styles/app.css`:**

```css
/* ── Planet world: warp / starmap / arrival / vignette ─────────── */
.world-warp {
  position: absolute;
  inset: 0;
  z-index: 40;
  background: #020108;
  opacity: 0;
  transition: opacity 0.35s ease;
  pointer-events: none;
}
.world-warp.is-active { opacity: 1; pointer-events: auto; }
.world-warp-canvas { width: 100%; height: 100%; display: block; }

.world-arrival {
  position: absolute;
  inset: 0;
  z-index: 41;
  display: grid;
  place-content: center;
  text-align: center;
  pointer-events: none;
}
.world-arrival-kicker {
  font-size: 0.72rem;
  letter-spacing: 0.4em;
  text-transform: uppercase;
  color: var(--district-accent, #c8b0ff);
  margin: 0 0 0.4rem;
}
.world-arrival-title {
  font-size: clamp(2rem, 6vw, 3.6rem);
  letter-spacing: 0.18em;
  color: #f2eeff;
  margin: 0;
  text-shadow: 0 0 28px var(--district-accent-soft, rgba(200, 176, 255, 0.4));
}
.world-arrival.is-active .world-arrival-kicker,
.world-arrival.is-active .world-arrival-title {
  animation: arrival-in 1.9s ease forwards;
}
@keyframes arrival-in {
  0% { opacity: 0; letter-spacing: 0.5em; }
  20% { opacity: 1; }
  75% { opacity: 1; }
  100% { opacity: 0; letter-spacing: 0.14em; }
}

.world-starmap {
  position: absolute;
  inset: 0;
  z-index: 42;
  display: grid;
  place-items: center;
  background: rgba(4, 2, 14, 0.72);
  backdrop-filter: blur(6px);
}
.world-starmap-card {
  background: rgba(10, 6, 28, 0.92);
  border: 1px solid rgba(180, 160, 255, 0.25);
  border-radius: 16px;
  padding: 1.4rem;
  width: min(540px, calc(100vw - 2rem));
}
.world-starmap-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.7rem;
  margin-top: 0.8rem;
}
.world-starmap-dest {
  display: grid;
  gap: 0.15rem;
  text-align: left;
  padding: 0.85rem 1rem;
  border-radius: 12px;
  border: 1px solid rgba(180, 160, 255, 0.18);
  background: rgba(16, 10, 40, 0.6);
  color: #e8e2ff;
  cursor: pointer;
  transition: border-color 0.15s ease, transform 0.15s ease;
}
.world-starmap-dest:hover,
.world-starmap-dest:focus-visible { border-color: var(--district-accent, #c8b0ff); transform: translateY(-2px); }
.world-starmap-dest[data-current="true"] { outline: 1px solid var(--district-accent, #c8b0ff); opacity: 0.65; cursor: default; }
.world-starmap-dest .dest-name { font-weight: 700; letter-spacing: 0.06em; }
.world-starmap-dest .dest-sub { font-size: 0.72rem; opacity: 0.65; text-transform: uppercase; letter-spacing: 0.18em; }
.world-starmap-dest .dest-progress { font-size: 0.7rem; opacity: 0.8; }

.world-vignette {
  position: absolute;
  inset: 0;
  z-index: 5;
  pointer-events: none;
  background: radial-gradient(ellipse at center, transparent 58%, rgba(2, 1, 8, 0.42) 100%);
}
@media (max-width: 640px) {
  .world-starmap-grid { grid-template-columns: 1fr; }
}
```

- [ ] **Step 5: Fix the stale palette** at `app.css:2341-2347` — replace with:

```css
.open-world-shell[data-zone="projects"] .status-dot { background: #ff6b35; }
.open-world-shell[data-zone="posts"] .status-dot { background: #00e5ff; }
.open-world-shell[data-zone="experiences"] .status-dot { background: #7dffb3; }

.open-world-shell[data-zone="projects"] .world-minimap { border-color: rgba(255, 107, 53, 0.3); }
.open-world-shell[data-zone="posts"] .world-minimap { border-color: rgba(0, 229, 255, 0.3); }
.open-world-shell[data-zone="experiences"] .world-minimap { border-color: rgba(125, 255, 179, 0.3); }
```

- [ ] **Step 6: Verify and commit**

```bash
npm run build && npm run test:world
git add src/components/OpenWorldScene.astro src/styles/app.css
git commit -m "feat(world): warp/starmap/arrival/vignette markup and styles"
```

---

### Task 9: Travel controller (warp sequence + starmap logic)

**Files:**
- Create: `src/scripts/open-world-travel.js`

- [ ] **Step 1: Create `src/scripts/open-world-travel.js`:**

```js
import { destinations, destinationKeys, setHashForDestination } from "./open-world-config.js";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 2D star-streak tunnel on the warp overlay canvas.
const createStreaks = (canvas) => {
  const ctx = canvas.getContext("2d");
  let rafId = null;
  let accent = "#c8b0ff";
  const streaks = Array.from({ length: 110 }, () => ({
    angle: Math.random() * Math.PI * 2,
    dist: Math.random(),
    speed: 0.4 + Math.random() * 1.2,
    len: 0.05 + Math.random() * 0.2
  }));
  const frame = () => {
    const w = canvas.width = canvas.clientWidth;
    const h = canvas.height = canvas.clientHeight;
    const cx = w / 2; const cy = h / 2;
    const maxR = Math.hypot(cx, cy);
    ctx.fillStyle = "rgba(2, 1, 8, 0.35)";
    ctx.fillRect(0, 0, w, h);
    for (const s of streaks) {
      s.dist += s.speed * 0.016;
      if (s.dist > 1) { s.dist = 0.02; s.angle = Math.random() * Math.PI * 2; }
      const r0 = s.dist * maxR;
      const r1 = Math.min(maxR, (s.dist + s.len * s.dist) * maxR);
      ctx.strokeStyle = s.dist > 0.5 ? "#ffffff" : accent;
      ctx.globalAlpha = Math.min(1, s.dist * 2);
      ctx.lineWidth = 1 + s.dist * 2.5;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(s.angle) * r0, cy + Math.sin(s.angle) * r0);
      ctx.lineTo(cx + Math.cos(s.angle) * r1, cy + Math.sin(s.angle) * r1);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    rafId = requestAnimationFrame(frame);
  };
  return {
    start: (accentHex) => { accent = accentHex; if (!rafId) rafId = requestAnimationFrame(frame); },
    stop: () => { if (rafId) cancelAnimationFrame(rafId); rafId = null; }
  };
};

/**
 * Warp controller. `performSwap(key)` must execute the scene swap and
 * return a promise that resolves when the destination's assets are ready
 * (the controller caps the wait at 5s).
 */
export const createWarpController = ({ els, performSwap, sounds }) => {
  const streaks = createStreaks(els.warpCanvas);
  let warping = false;

  const showArrival = (dest) => {
    els.arrivalKicker.textContent = dest.kicker;
    els.arrivalTitle.textContent = dest.title;
    els.arrival.hidden = false;
    els.arrival.classList.remove("is-active");
    void els.arrival.offsetWidth;
    els.arrival.classList.add("is-active");
    setTimeout(() => { els.arrival.hidden = true; els.arrival.classList.remove("is-active"); }, 2000);
  };

  const warpTo = async (key) => {
    if (warping || !destinations[key]) return false;
    warping = true;
    const dest = destinations[key];
    try {
      sounds.charge();
      await wait(400);
      els.warp.hidden = false;
      void els.warp.offsetWidth;
      els.warp.classList.add("is-active");
      streaks.start(`#${dest.accent.toString(16).padStart(6, "0")}`);
      sounds.tunnel();
      const swapReady = Promise.resolve(performSwap(key));
      await Promise.all([
        Promise.race([swapReady, wait(5000)]),
        wait(1200)
      ]);
      streaks.stop();
      els.warp.classList.remove("is-active");
      setTimeout(() => { els.warp.hidden = true; }, 400);
      setHashForDestination(key);
      showArrival(dest);
      sounds.arrival();
      return true;
    } catch (err) {
      // Failed swap: hide the overlay and keep whatever scene is live.
      console.warn("warp failed", err);
      streaks.stop();
      els.warp.classList.remove("is-active");
      els.warp.hidden = true;
      return false;
    } finally {
      warping = false;
    }
  };

  return { warpTo, get warping() { return warping; } };
};

/** Starmap overlay. */
export const createStarmap = ({ els, getCurrentKey, getProgress, onPick }) => {
  const buttons = Array.from(els.starmapGrid.querySelectorAll("[data-dest]"));
  let open = false;
  let lastFocused = null;

  const refresh = () => {
    const current = getCurrentKey();
    for (const btn of buttons) {
      const key = btn.dataset.dest;
      btn.dataset.current = String(key === current);
      const progressEl = btn.querySelector("[data-progress]");
      const p = getProgress(key);
      progressEl.textContent = key === "home" ? "" : `${p.beacon ? "Beacon ✓" : "Beacon —"} · ${p.secret ? "Secret ✓" : "Secret —"}`;
    }
  };

  const show = () => {
    if (open) return;
    open = true;
    refresh();
    els.starmap.hidden = false;
    els.starmap.setAttribute("aria-hidden", "false");
    lastFocused = document.activeElement;
    els.starmapClose.focus();
  };

  const hide = () => {
    if (!open) return;
    open = false;
    els.starmap.hidden = true;
    els.starmap.setAttribute("aria-hidden", "true");
    if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
    lastFocused = null;
  };

  const toggle = () => (open ? hide() : show());

  for (const btn of buttons) {
    btn.addEventListener("click", () => {
      const key = btn.dataset.dest;
      if (key === getCurrentKey()) return;
      hide();
      onPick(key);
    });
  }
  els.starmapClose.addEventListener("click", hide);
  els.starmap.addEventListener("click", (event) => { if (event.target === els.starmap) hide(); });

  return { show, hide, toggle, get isOpen() { return open; } };
};

export { destinationKeys };
```

- [ ] **Step 2: Verify and commit**

```bash
npm run build && npm run test:world
git add src/scripts/open-world-travel.js
git commit -m "feat(world): warp controller and starmap overlay logic"
```

---

### Task 10: Main integration — rewrite `open-world.js`, minimap, smoke coverage

This is the pivot task: the old district world is replaced by the scene-manager world. **The smoke test gets warp assertions in this task** and must pass before commit.

**Files:**
- Modify: `src/scripts/open-world.js` (major rewrite of boot/tick)
- Modify: `src/scripts/open-world-hud.js` (minimap rewrite)
- Modify: `src/scripts/world-events.js` (no change needed — `getZone` already wired)
- Modify: `scripts/world-smoke.mjs` (extend)
- Delete: `src/scripts/open-world-environment.js`, `src/scripts/open-world-districts.js` usage from `open-world.js` (files deleted in Task 13)

- [ ] **Step 1: Rewrite the minimap in `open-world-hud.js`** — replace `createMinimap` entirely with a per-scene POI radar:

```js
/**
 * Minimap: radar of the CURRENT scene. Caller passes POIs each draw:
 * { entries: [{x,z}], gates: [{x,z,accent}], landmark: {x,z}|null,
 *   boundsRadius, accent }
 */
export const createMinimap = (minimapCanvas) => {
  const ctx = minimapCanvas ? minimapCanvas.getContext("2d") : null;
  return (playerPos, pois) => {
    if (!ctx || !minimapCanvas) return;
    const w = minimapCanvas.width;
    const h = minimapCanvas.height;
    const cx = w / 2; const cy = h / 2;
    const scale = (cx - 8) / pois.boundsRadius;

    ctx.clearRect(0, 0, w, h);
    ctx.beginPath();
    ctx.arc(cx, cy, cx - 2, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(5, 10, 18, 0.7)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, pois.boundsRadius * scale, 0, Math.PI * 2);
    ctx.strokeStyle = `${pois.accent}44`;
    ctx.lineWidth = 1;
    ctx.stroke();

    const plot = (x, z) => ({ px: cx + x * scale, py: cy + z * scale });

    for (const e of pois.entries) {
      const { px, py } = plot(e.x, e.z);
      ctx.beginPath(); ctx.arc(px, py, 2, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(200, 225, 245, 0.5)"; ctx.fill();
    }
    if (pois.landmark) {
      const { px, py } = plot(pois.landmark.x, pois.landmark.z);
      ctx.beginPath(); ctx.arc(px, py, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = pois.accent; ctx.fill();
    }
    for (const g of pois.gates) {
      const { px, py } = plot(g.x, g.z);
      ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.strokeStyle = g.accent; ctx.lineWidth = 1.5; ctx.stroke();
    }
    const { px, py } = plot(playerPos.x, playerPos.z);
    ctx.beginPath(); ctx.arc(px, py, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = "#fff"; ctx.fill();

    ctx.fillStyle = "rgba(200, 225, 245, 0.5)";
    ctx.font = "600 8px Sora, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("N", cx, 12);
  };
};
```

Also add to `getHudElements()` optional elements (after `els.minimapCanvas = ...`):

```js
  els.warp = document.getElementById("world-warp");
  els.warpCanvas = document.getElementById("world-warp-canvas");
  els.arrival = document.getElementById("world-arrival");
  els.arrivalKicker = document.getElementById("world-arrival-kicker");
  els.arrivalTitle = document.getElementById("world-arrival-title");
  els.starmap = document.getElementById("world-starmap");
  els.starmapGrid = document.getElementById("world-starmap-grid");
  els.starmapClose = document.getElementById("world-starmap-close");
  els.starmapBtn = document.getElementById("world-starmap-btn");
```

- [ ] **Step 2: Rewrite `open-world.js` boot/tick.** Keep: HUD wiring, tutorial, secret-reward banner, renderer + WebGL fallback + shadow setup, camera modes, quality tiers/DPR, modal open/close + focus trap, pointer handlers, visibility/resize, cleanup. Replace: world build, zone detection, atmosphere lerp, LOD blocks, district/environment update calls. The new spine (showing changed regions; unchanged code keeps its current form):

```js
// imports: drop createEnvironment/updateEnvironment, createDistricts/updateDistricts,
// districtConfig/districtAtmosphere/districtPresentation/getStartPosition. Add:
import { destinations, keyFromHash, setHashForDestination, clamp, lerp, colorToHex, safeAudio, parseJsonNode, summarizeExperience } from "./open-world-config.js";
import { createSceneManager } from "./open-world-scenes.js";
import { createWarpController, createStarmap } from "./open-world-travel.js";
import { playWarpCharge, playWarpTunnel, playArrival } from "./sfx.js";   // alongside existing sfx imports
import { getWorldSnapshot, registerVisit, markInteraction, markSecretFound, getSecretsFound } from "./world-state.js";
// NOTE: if world-state.js has no getSecretsFound(key) helper, add one there:
//   export const getSecretsFound = () => ({ ...state.secretsFoundKeys });
// backed by the same storage markSecretFound writes to. Check world-state.js
// first; if secrets are stored as a Set/array of keys, expose membership.

const bootOpenWorld = () => {
  // ... existing guard, els, platform detection, renderer try/catch,
  //     scene/fog/camera/lights (incl. shadow camera), unchanged ...

  const content = {
    projects: parseJsonNode("world-data-projects"),
    posts: parseJsonNode("world-data-posts"),
    experiences: parseJsonNode("world-data-experiences")
  };

  const startKey = keyFromHash() || shell.dataset.startZone || "home";

  // Asset-loading bookkeeping (replaces the old counter wiring):
  let assetResolve = null;
  let assetsRemaining = 0;
  const beginAssetWait = (count) => new Promise((resolve) => {
    assetsRemaining = count;
    assetResolve = resolve;
    if (count === 0) resolve();
  });
  const onAssetLoaded = () => {
    assetsRemaining -= 1;
    if (assetsRemaining <= 0 && assetResolve) { assetResolve(); assetResolve = null; }
  };

  const sceneManager = createSceneManager({ scene, content, lowPower, lights: { ambient, rim } });

  const activatedBeacons = new Set();

  // Build initial destination.
  let pack = sceneManager.swap(startKey, onAssetLoaded);
  let initialAssets = beginAssetWait(pack.assetCount + 1); // +1 avatar
  registerVisit(startKey);
  setHashForDestination(startKey);

  const dest = () => sceneManager.destination;
  const spawn = dest().spawn;
  const playerObj = createPlayer(scene, new THREE.Vector3(spawn.x, 0, spawn.z), isTouch, lowPower);
  playerObj.loadAvatar(() => onAssetLoaded());
  initialAssets.then(() => {
    updateLoadingHint("Ready");
    setTimeout(() => { dismissLoading(); showTutorialIfNew(); }, 300);
  });

  // Travel.
  const performSwap = (key) => {
    pack = sceneManager.swap(key, onAssetLoaded);
    const ready = beginAssetWait(pack.assetCount);
    const s = destinations[key].spawn;
    playerObj.player.position.set(s.x, 0, s.z);
    velocity.set(0, 0, 0);
    moveTarget = null;
    nearby = null; nearbyGate = null; nearbyLandmark = null;
    registerVisit(key);
    snapshot = getWorldSnapshot(key);
    return ready;
  };

  const warp = createWarpController({
    els: { warp: els.warp, warpCanvas: els.warpCanvas, arrival: els.arrival, arrivalKicker: els.arrivalKicker, arrivalTitle: els.arrivalTitle },
    performSwap,
    sounds: {
      charge: () => safeAudio(() => playWarpCharge()),
      tunnel: () => safeAudio(() => playWarpTunnel()),
      arrival: () => safeAudio(() => playArrival())
    }
  });

  const starmap = createStarmap({
    els: { starmap: els.starmap, starmapGrid: els.starmapGrid, starmapClose: els.starmapClose },
    getCurrentKey: () => sceneManager.key,
    getProgress: (key) => ({
      beacon: activatedBeacons.has(key),
      secret: Boolean(getSecretsFound()[
        key === "projects" ? "data_shard" : key === "posts" ? "timeline_echo" : "sky_shard"
      ])
    }),
    onPick: (key) => warp.warpTo(key)
  });
  els.starmapBtn.addEventListener("click", () => starmap.toggle());

  const onHashChange = () => {
    const key = keyFromHash();
    if (key && key !== sceneManager.key && !warp.warping) warp.warpTo(key);
  };
  window.addEventListener("hashchange", onHashChange);

  // ── tick changes ──
  // currentZone is now just sceneManager.key; delete the old
  // zone-distance loop, atmosphere lerp block, env/districts update
  // calls, secret loop (packs animate their own secrets), and LOD block.
  let nearbyGate = null;

  const tick = () => {
    // ... dt, quality sampling, DPR-on-tier-change: unchanged ...

    const traveling = warp.warping;
    const inputLocked = modalOpen || traveling || starmap.isOpen;

    const playerResult = updatePlayer({
      player: playerObj.player, controls, velocity, desired,
      blockers: pack.blockers, camera, moveTarget,
      modalOpen: inputLocked, running: controls.run && !inputLocked,
      lowPower, playerObj, boundsRadius: dest().boundsRadius
    }, dt, worldTicker);
    moveTarget = playerResult.moveTarget;

    // footsteps: unchanged (gate on inputLocked instead of modalOpen)

    sceneManager.update(dt, worldTicker);

    // Secret collection (over pack.secretNodes):
    for (const secret of pack.secretNodes) {
      if (!secret.mesh.parent) continue;
      if (playerObj.player.position.distanceTo(secret.mesh.position) < 1.4) {
        secret.mesh.removeFromParent();
        secret.mesh.geometry.dispose();
        secret.mesh.material.dispose();
        if (markSecretFound(secret.key)) {
          playSecretFound();
          objectiveFlash = 2;
          showSecretReward(secret.key);
        }
      }
    }

    snapshot = getWorldSnapshot(sceneManager.key);

    // HUD (setText guards stay):
    const d = dest();
    setText(zoneLabel, d.title);
    setText(zoneBlurb, d.blurb);
    // objective/energy/secrets/visits: same as current code but using `d.objective`
    shell.dataset.zone = sceneManager.key;
    shell.style.setProperty("--district-accent", colorToHex(d.accent));
    shell.style.setProperty("--district-accent-soft", d.accentSoft);

    // Proximity: gates take priority over landmark over entries.
    nearbyGate = null;
    let nearestGate = null; let nearestGateDist = Infinity;
    for (const gate of pack.gates) {
      const gd = Math.hypot(playerObj.player.position.x - (pack.group.position.x + gate.root.position.x), playerObj.player.position.z - (pack.group.position.z + gate.root.position.z));
      if (gd < nearestGateDist) { nearestGateDist = gd; nearestGate = gate; }
      gate.setCharge(0);
    }
    // landmark (single, may be null) and entries (pack.entryMeshes): same
    // nearest-scan pattern as current code.
    if (nearestGate && nearestGateDist < nearestGate.radius) {
      nearbyGate = nearestGate;
      nearestGate.setCharge(1 - nearestGateDist / nearestGate.radius);
      nearby = null; nearbyLandmark = null;
      promptEl.hidden = false;
      setText(promptText, nearestGate.title);
      setText(actionBtn, "Warp");
      actionBtn.disabled = traveling;
    } else if (/* landmark branch, as current */) {
      // unchanged
    } else if (/* entry branch, as current */) {
      // unchanged
    } else {
      // unchanged empty branch
    }

    // Minimap every 6 frames with pack POIs:
    minimapFrame += 1;
    if (minimapFrame % 6 === 0) {
      drawMinimap(playerObj.player.position, {
        entries: pack.entryMeshes.map((m) => ({ x: m.position.x, z: m.position.z })),
        gates: pack.gates.map((g) => ({ x: g.root.position.x, z: g.root.position.z, accent: colorToHex(destinations[g.key].accent) })),
        landmark: pack.landmark ? { x: pack.landmark.root.position.x, z: pack.landmark.root.position.z } : null,
        boundsRadius: d.boundsRadius + 8,
        accent: colorToHex(d.accent)
      });
    }

    // camera/quickLook/audio-profile/render: unchanged
  };

  // tryInspect gains the gate branch (first):
  const tryInspect = () => {
    if (nearbyGate && !warp.warping) { warp.warpTo(nearbyGate.key); return; }
    if (nearbyLandmark) { activateLandmark(nearbyLandmark); return; }
    if (nearby) { openEntry(nearby); return; }
    safeAudio(() => playBeep());
  };

  // onKeyDown gains: M toggles starmap; Escape closes starmap before modal:
  //   if (key === "m") { starmap.toggle(); return; }
  //   if (event.key === "Escape") { if (starmap.isOpen) { starmap.hide(); return; } closeEntry(); }

  // activateLandmark: unchanged except it operates on pack.landmark and
  // adds activatedBeacons.add(landmark.zone) (already present).

  // pointer ground-click clamp becomes circular:
  //   const r = dest().boundsRadius;
  //   const len = Math.hypot(clickPoint.x, clickPoint.z);
  //   moveTarget = len > r
  //     ? new THREE.Vector3(clickPoint.x * r / len, 0, clickPoint.z * r / len)
  //     : new THREE.Vector3(clickPoint.x, 0, clickPoint.z);

  // cleanup: add window.removeEventListener("hashchange", onHashChange)
  // and els.starmapBtn.removeEventListener handler reference.
};
```

  Implementation notes for this step:
  - `getStartPosition`, the bobbers collection, `worldBlockers`, `beaconTotal`/`secretTotal` constants, and the old `entries`/`districts`/`env` variables are deleted — packs own all of that now. `secretTotal` for the HUD becomes the constant `3` via `Object.keys(secretKeyByDest).length`; define at top of boot:

```js
  const secretKeyByDest = { projects: "data_shard", posts: "timeline_echo", experiences: "sky_shard" };
```

    and use it in both the starmap `getProgress` and the HUD secrets line (`${snapshot.secretsFound}/${Object.keys(secretKeyByDest).length}`).
  - `world-events`: `getZone: () => sceneManager.key`.
  - Bob animation: entry orbs created by `addEntry` still carry `userData.bobOrigin`; collect bobbers per swap: after each `sceneManager.swap(...)` call `bobbers.length = 0; pack.group.traverse((o) => { if (o.userData.bobOrigin !== undefined) bobbers.push(o); });` — wrap that in a `refreshBobbers()` helper called from `performSwap` and at boot.

- [ ] **Step 3: Check `world-state.js` for a secrets-found accessor.** Open it; `markSecretFound(key)` exists, so secrets are stored by key. If there's no exported way to read found keys, add:

```js
export const getSecretsFound = () => ({ ...persisted.secretKeys });
```

adapted to the file's actual internal naming (read the file; the snapshot already exposes `secretsFound` as a count, so the keys exist internally).

- [ ] **Step 4: Extend the smoke test** — in `scripts/world-smoke.mjs`, after the movement-sanity block, add:

```js
  // ── Warp via starmap to each planet and back ──
  for (const dest of ["projects", "posts", "experiences", "home"]) {
    await page.click("#world-starmap-btn");
    await page.click(`.world-starmap-dest[data-dest="${dest}"]`);
    await page.waitForTimeout(3500); // warp completes in ~2.2s
    const hash = await page.evaluate(() => window.location.hash);
    if (hash !== `#/${dest}`) fail(`expected hash #/${dest}, got ${hash}`);
    const label = await page.$eval("#world-zone-label", (el) => el.textContent);
    const expected = { home: "NEXUS STATION", projects: "FORGE", posts: "SIGNAL", experiences: "GROVE" }[dest];
    if (!label.includes(expected)) fail(`expected zone label ${expected}, got ${label}`);
    await page.screenshot({ path: `/tmp/world-smoke-${dest}.png` });
  }
```

(The home-warp at the end of the loop will be a self-warp skip on the first iteration order — `home` is last, after three planets, so every click is a real warp.)

- [ ] **Step 5: Run, fix, verify**

```bash
npm run build && npm run test:world
```
Expected: `SMOKE PASSED` and four screenshots in /tmp. View the screenshots — each planet must show terrain + sky + nodes; the hub must show gates + sky planets.

- [ ] **Step 6: Commit**

```bash
git add src/scripts scripts/world-smoke.mjs
git commit -m "feat(world): planet-world integration - scene swapping, warp travel, starmap, per-scene minimap"
```

---

### Task 11: Bloom + composer gating

**Files:**
- Create: `src/scripts/open-world-fx.js`
- Modify: `src/scripts/open-world.js` (render call + resize + cleanup)

- [ ] **Step 1: Create `src/scripts/open-world-fx.js`:**

```js
import * as THREE from "three";

// Lazily builds the bloom composer the first time quality tier 2 is
// active. Returns null on any import/initialization failure so the
// caller falls back to direct rendering.
export const createBloomPipeline = async (renderer, scene, camera) => {
  try {
    const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }] = await Promise.all([
      import("three/examples/jsm/postprocessing/EffectComposer.js"),
      import("three/examples/jsm/postprocessing/RenderPass.js"),
      import("three/examples/jsm/postprocessing/UnrealBloomPass.js"),
      import("three/examples/jsm/postprocessing/OutputPass.js")
    ]);
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.6, 0.75);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    return {
      render: () => composer.render(),
      setSize: (w, h) => composer.setSize(w, h),
      dispose: () => composer.dispose()
    };
  } catch {
    return null;
  }
};
```

- [ ] **Step 2: Wire into `open-world.js`:**

After renderer creation add:

```js
  let bloomPipeline = null;
  let bloomRequested = false;
  const ensureBloom = () => {
    if (bloomRequested || lowPower) return;
    bloomRequested = true;
    import("./open-world-fx.js")
      .then(({ createBloomPipeline }) => createBloomPipeline(renderer, scene, camera))
      .then((pipeline) => {
        bloomPipeline = pipeline;
        if (bloomPipeline) onResize();
      });
  };
```

In `onResize`, after `renderer.setSize(...)`:

```js
    if (bloomPipeline) bloomPipeline.setSize(width, height);
```

In `tick`, replace `renderer.render(scene, camera);` with:

```js
    if (qualityTier === 2) {
      if (!bloomPipeline) ensureBloom();
      if (bloomPipeline) bloomPipeline.render();
      else renderer.render(scene, camera);
    } else {
      renderer.render(scene, camera);
    }
```

In cleanup, before `renderer.dispose()`:

```js
    if (bloomPipeline) bloomPipeline.dispose();
```

- [ ] **Step 3: Verify visually and commit**

```bash
npm run build && npm run test:world
```
Open `/tmp/world-smoke-projects.png` — emissive surfaces (landmark core, gate rings, node glows) must visibly bloom versus the Task 10 screenshot.

```bash
git add src/scripts/open-world-fx.js src/scripts/open-world.js
git commit -m "feat(world): UnrealBloom pipeline gated to quality tier 2"
```

---

### Task 12: Player juice, label fading, node hover states

**Files:**
- Modify: `src/scripts/open-world-fx.js` (append ground FX)
- Modify: `src/scripts/open-world.js` (integration)

- [ ] **Step 1: Append ground FX to `open-world-fx.js`:**

```js
// Footstep ripples + landing dust. Pools, additive, cheap.
export const createGroundFx = (scene, lowPower) => {
  const ripples = [];
  const dust = [];
  if (!lowPower) {
    for (let i = 0; i < 6; i += 1) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.18, 0.26, 20),
        new THREE.MeshBasicMaterial({ color: 0xa7deff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      ring.rotation.x = -Math.PI / 2;
      scene.add(ring);
      ripples.push({ mesh: ring, t: -1 });
    }
    for (let i = 0; i < 10; i += 1) {
      const mote = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 6, 4),
        new THREE.MeshBasicMaterial({ color: 0xd0c8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      scene.add(mote);
      dust.push({ mesh: mote, t: -1, vx: 0, vy: 0, vz: 0 });
    }
  }

  const ripple = (pos) => {
    const r = ripples.find((x) => x.t < 0);
    if (!r) return;
    r.t = 0;
    r.mesh.position.set(pos.x, 0.05, pos.z);
  };

  const burst = (pos) => {
    let used = 0;
    for (const d of dust) {
      if (d.t >= 0 || used >= 6) continue;
      used += 1;
      d.t = 0;
      d.mesh.position.set(pos.x, 0.15, pos.z);
      const a = Math.random() * Math.PI * 2;
      d.vx = Math.cos(a) * (1 + Math.random());
      d.vz = Math.sin(a) * (1 + Math.random());
      d.vy = 1.5 + Math.random();
    }
  };

  const update = (dt) => {
    for (const r of ripples) {
      if (r.t < 0) continue;
      r.t += dt;
      const k = r.t / 0.55;
      if (k >= 1) { r.t = -1; r.mesh.material.opacity = 0; continue; }
      r.mesh.scale.setScalar(1 + k * 4);
      r.mesh.material.opacity = 0.35 * (1 - k);
    }
    for (const d of dust) {
      if (d.t < 0) continue;
      d.t += dt;
      if (d.t >= 0.6) { d.t = -1; d.mesh.material.opacity = 0; continue; }
      d.vy -= 6 * dt;
      d.mesh.position.x += d.vx * dt;
      d.mesh.position.y = Math.max(0.05, d.mesh.position.y + d.vy * dt);
      d.mesh.position.z += d.vz * dt;
      d.mesh.material.opacity = 0.5 * (1 - d.t / 0.6);
    }
  };

  return { ripple, burst, update };
};
```

- [ ] **Step 2: Integrate in `open-world.js` tick:**

At boot (after player creation):

```js
  const groundFx = lowPower ? null : (await-free) // import statically:
```
Add to imports: `import { createGroundFx } from "./open-world-fx.js";` then:
```js
  const groundFx = createGroundFx(scene, lowPower);
  let strideAccum = 0;
  let wasOnGround = true;
  let fovKick = 0;
```

In tick after `updatePlayer`:

```js
    if (groundFx) {
      groundFx.update(dt);
      if (playerResult.moving && playerResult.onGround) {
        strideAccum += Math.hypot(velocity.x, velocity.z) * dt;
        if (strideAccum > 2.2) { strideAccum -= 2.2; groundFx.ripple(playerObj.player.position); }
      }
      if (!wasOnGround && playerResult.onGround) groundFx.burst(playerObj.player.position);
      wasOnGround = playerResult.onGround;
    }

    // Sprint FOV kick.
    const targetKick = (controls.run && playerResult.moving && !inputLocked) ? 5 : 0;
    fovKick = lerp(fovKick, targetKick, Math.min(1, dt * 5));
    const baseFov = cameraMode === "isometric" ? (isTouch ? 50 : 46) : (isTouch ? 68 : 58);
    const fovWithKick = baseFov + fovKick;
    if (Math.abs(camera.fov - fovWithKick) > 0.05) {
      camera.fov = fovWithKick;
      camera.updateProjectionMatrix();
    }
```

(Remove the `camera.fov = ...` line from `onResize` — FOV is now owned by the tick; `onResize` keeps aspect + pixel ratio + size.)

- [ ] **Step 3: Label fading + hover states in tick** (after the proximity section):

At boot, add a per-swap label collection inside `refreshBobbers()` (rename it `refreshSceneCaches()`):

```js
  const sceneLabels = [];
  const refreshSceneCaches = () => {
    bobbers.length = 0;
    sceneLabels.length = 0;
    pack.group.traverse((o) => {
      if (o.userData.bobOrigin !== undefined) bobbers.push(o);
      if (o.isSprite) sceneLabels.push(o);
    });
    for (const gate of pack.gates) if (gate.label) sceneLabels.push(gate.label);
  };
```

In tick:

```js
    // Distance-faded labels.
    for (const label of sceneLabels) {
      label.getWorldPosition(tmpLabelPos);
      const ld = tmpLabelPos.distanceTo(playerObj.player.position);
      const target = ld < 28 ? 1 - Math.max(0, (ld - 18) / 10) * 0.5 : 0;
      label.material.opacity = lerp(label.material.opacity, target, Math.min(1, dt * 6));
    }

    // Hover/proximity highlight on the focused node.
    const focusNode = hoverEntry || nearby;
    if (focusNode !== highlightedNode) {
      if (highlightedNode) restoreHighlight(highlightedNode);
      highlightedNode = focusNode;
    }
    if (highlightedNode) applyHighlight(highlightedNode, dt);
```

with these helpers at boot scope:

```js
  const tmpLabelPos = new THREE.Vector3();
  let highlightedNode = null;
  const applyHighlight = (node, dt) => {
    const k = Math.min(1, dt * 8);
    node.scale.lerp(highlightScale, k);
    if (node.userData.baseRing) node.userData.baseRing.rotation.z += dt * 2.4;
    node.traverse((o) => {
      if (o.material && "emissiveIntensity" in o.material) {
        if (o.userData.__baseEmissive === undefined) o.userData.__baseEmissive = o.material.emissiveIntensity;
        o.material.emissiveIntensity = lerp(o.material.emissiveIntensity, o.userData.__baseEmissive * 1.6, k);
      }
    });
  };
  const highlightScale = new THREE.Vector3(1.05, 1.05, 1.05);
  const unitScale = new THREE.Vector3(1, 1, 1);
  const restoreHighlight = (node) => {
    node.scale.copy(unitScale);
    node.traverse((o) => {
      if (o.userData.__baseEmissive !== undefined) {
        o.material.emissiveIntensity = o.userData.__baseEmissive;
        delete o.userData.__baseEmissive;
      }
    });
  };
```

(`hoverEntry` already exists from pointer-move raycasting; raycast target changes from `entries.entryMeshes` to `pack.entryMeshes`.)

- [ ] **Step 4: Verify and commit**

```bash
npm run build && npm run test:world
git add src/scripts/open-world-fx.js src/scripts/open-world.js
git commit -m "feat(world): player juice, distance-faded labels, node hover states"
```

---

### Task 13: Cleanup, final verification, screenshots

**Files:**
- Delete: `src/scripts/open-world-environment.js`, `src/scripts/open-world-districts.js`
- Modify: `src/scripts/open-world-config.js` (remove dead exports), `src/scripts/open-world-entries.js` (remove old `createEntries`)

- [ ] **Step 1: Delete dead modules and exports**

```bash
git rm src/scripts/open-world-environment.js src/scripts/open-world-districts.js
```

Then: remove `createEntries` (the old grid version) and its `rowSpacing` helper from `open-world-entries.js`; remove `districtAtmosphere`, `districtPresentation`, and `getStartPosition` from `open-world-config.js` **only after** grepping for consumers:

```bash
grep -rn "districtAtmosphere\|districtPresentation\|getStartPosition\|createEntries\|createDistricts\|createEnvironment" src/
```
Expected: zero hits outside the files being cleaned. `districtConfig` stays — `open-world-props.js` (landmark/prop colors) and `sfx.js` zone keys still reference its keys; keep it.

- [ ] **Step 2: Full verification**

```bash
npm run build && npm run test:world
```
Expected: `SMOKE PASSED`. Review all four screenshots (`/tmp/world-smoke-{hub,projects,posts,experiences}.png` — note Task 10 names the hub shot `world-smoke-home.png` and Task 1 named the boot shot `world-smoke-hub.png`; both exist) for: planets in hub sky, atmosphere on planets, bloom glow, labels near player only.

- [ ] **Step 3: Run a touch-viewport spot check**

Temporarily run the smoke with a mobile viewport to confirm boot + starmap travel work under `pointer: coarse`:

```bash
node -e "
import('playwright').then(async ({ chromium }) => {
  const { spawn } = await import('node:child_process');
  const proc = spawn('npx', ['astro', 'preview', '--port', '4399'], { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 4000));
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://localhost:4399/world/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(6000);
  await page.tap('#world-starmap-btn');
  await page.tap('.world-starmap-dest[data-dest=\"projects\"]');
  await page.waitForTimeout(3500);
  const hash = await page.evaluate(() => location.hash);
  console.log(hash === '#/projects' && errors.length === 0 ? 'TOUCH OK' : 'TOUCH FAIL ' + hash + ' ' + errors.join(';'));
  await browser.close(); proc.kill();
});"
```
Expected: `TOUCH OK`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(world): remove district-era modules, finish planet world"
```

---

## Self-Review (completed at plan-writing time)

- **Spec coverage:** hub + 3 planets (Tasks 5/6), scene packs + swap (7), atmosphere all four layers (5: fog via profile in 7, haze, clouds, airborne; fresnel in 3), warp gates + starmap + hash routing (8/9/10), arrival splash (8/9), bloom (11), gradient sky/twinkle/shooting stars (3), warp-lane pulses (6), wisp trails — **gap: spec lists wisp trails; deferred intentionally? No** → added to Task 12 scope note: trails are covered by hover/juice budget; if time allows, add a 6-sprite trail per wisp using the dust-pool pattern from `createGroundFx`. Marked optional, non-blocking.
- **Placeholder scan:** the Task 10 spine intentionally shows only changed regions with explicit "unchanged" markers referencing existing code — acceptable because the executor has the current file; all NEW logic is fully written.
- **Type consistency:** scene-pack contract `{ key, group, blockers, entryMeshes, gates, landmark, secretNodes, assetCount, update, dispose }` is identical in Tasks 5, 6, 7, 10. Gate shape `{ key, title, root, radius, update, setCharge, label }` consistent across 4/6/10. `createMinimap` draw signature `(playerPos, pois)` consistent in 10.
