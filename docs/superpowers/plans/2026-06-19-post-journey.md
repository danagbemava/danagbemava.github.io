# Post Journey — In-World Checkpoint Reading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the post node's "open a modal → leave for the article" handoff in the Signal world with an in-world checkpoint journey: walk a glowing trail whose checkpoints map to the post's `##` (H2) sections, reading each section in a themed overlay.

**Architecture:** A new content sectionizer (`post-content.js`) fetches the already-built `/posts/<slug>/` article at runtime and splits it by `<h2>`. A new journey controller (`open-world-journey.js`) builds a linear trail of checkpoint markers + a terminus inside the existing Signal scene, owns journey state, and renders section HTML into a 2D overlay. `open-world.js` routes post interactions into the journey, branches the per-frame proximity/bounds logic while a journey is active, and restores the Signal scene on exit. Completion is persisted in `world-state.js`.

**Tech Stack:** Astro 5, Three.js 0.161 (vanilla ESM, no bund-time framework), Tailwind v4, Playwright smoke tests. No new dependencies.

## Global Constraints

- No new npm dependencies; Three.js is imported as `import * as THREE from "three"`.
- All new client modules are plain ESM under `src/scripts/`, side-effect-free except `open-world.js` (the entry point).
- The flat `/posts/[slug].astro` article is the canonical source of truth and MUST remain untouched and always reachable.
- Signal palette: accent `0x00e5ff`, label color `"#a0f0ff"` (matches `destinations.posts` in `open-world-config.js`).
- The journey is an enhancement; on any fetch/parse failure, fall back to navigating to `/posts/<slug>/` — never a dead end.
- Tests run through the Playwright smoke harness (the repo has no unit-test framework); new behavior is asserted via `scripts/post-journey-smoke.mjs` driven by debug hooks exposed on `window.__wbTest`.
- Article body lives in `.post-content`; article header exposes `<h1>` (title) and `<p class="entry-meta">` (date • tags).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/scripts/post-content.js` *(new)* | Fetch `/posts/<slug>/`, parse, split body into `{ heading, kicker, html }[]` sections by `<h2>`. Pure browser util + per-session cache. |
| `src/scripts/open-world-journey.js` *(new)* | Build/teardown the trail (markers, segments, terminus), own journey state + read tracking, render the overlay, expose `start/update/tryOpen/closeOverlay/leave/dispose` and getters. |
| `src/scripts/world-state.js` *(modify)* | Persist journeyed post slugs (`markPostJourneyed`, `isPostJourneyed`, `getJourneyedPosts`). |
| `src/components/OpenWorldScene.astro` *(modify)* | Journey overlay + journey HUD markup; scoped styles. |
| `src/scripts/open-world.js` *(modify)* | Wire the journey: route posts → journey, Esc handling, per-frame branch, bounds/blockers swap, scene-content hide/restore, node "journeyed" tint, debug hooks. |
| `scripts/post-journey-smoke.mjs` *(new)* | Playwright smoke covering sectionizing, checkpoint count, read-all completion + persistence, leave-restores. |
| `package.json` *(modify)* | Add `test:journey` script. |

---

## Task 1: Content sectionizer

**Files:**
- Create: `src/scripts/post-content.js`
- Test: `scripts/post-journey-smoke.mjs` (new), `package.json` (add script)
- Modify: `src/scripts/open-world.js` (expose debug hook only)

**Interfaces:**
- Produces: `fetchPostSections(slug: string): Promise<{ ok: true, title: string, meta: string, sections: { heading: string, kicker: string, html: string }[] } | { ok: false, error: string }>`

- [ ] **Step 1: Write the failing test (smoke skeleton + sectionizer assertion)**

Create `scripts/post-journey-smoke.mjs`:

```js
// Playwright smoke for the in-world post journey.
// Usage: npm run build && npm run test:journey
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const PORT = 4401;
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

  await page.goto(`${BASE}/world/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(6000);

  // ── Task 1: sectionizer returns sections matching the article's structure ──
  const slug = await page.evaluate(() => window.__wbTest && window.__wbTest.postSlug(0));
  if (!slug) fail("no post slug exposed via __wbTest");

  const expectedCount = await page.evaluate(async (s) => {
    const res = await fetch(`/posts/${s}/`);
    const doc = new DOMParser().parseFromString(await res.text(), "text/html");
    const body = doc.querySelector(".post-content");
    const h2 = body ? body.querySelectorAll(":scope > h2").length : 0;
    // intro present if any element/text precedes the first h2
    let introHasContent = false;
    if (body) {
      for (const node of Array.from(body.childNodes)) {
        if (node.nodeType === 1 && node.tagName === "H2") break;
        if ((node.textContent || "").trim().length) { introHasContent = true; break; }
      }
    }
    if (h2 === 0) return 1;
    return h2 + (introHasContent ? 1 : 0);
  }, slug);

  const data = await page.evaluate((s) => window.__wbTest.fetchSections(s), slug);
  if (!data || !data.ok) fail(`fetchSections not ok for ${slug}: ${data && data.error}`);
  else if (data.sections.length !== expectedCount) {
    fail(`section count ${data.sections.length} != expected ${expectedCount} for ${slug}`);
  }

  if (errors.length) fail(`runtime errors:\n${errors.join("\n")}`);
  console.log(process.exitCode ? "JOURNEY SMOKE FAILED" : "JOURNEY SMOKE PASSED");
} finally {
  await browser.close();
  preview.kill();
}
```

Add to `package.json` scripts (after `"test:experiments"` line):

```json
    "test:journey": "node scripts/post-journey-smoke.mjs",
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npm run build && npm run test:journey`
Expected: FAIL — `no post slug exposed via __wbTest` (the hook doesn't exist yet).

- [ ] **Step 3: Create `src/scripts/post-content.js`**

```js
// Fetches a built post article and splits it into reading checkpoints by <h2>.
// The article at /posts/<slug>/ is the canonical source of truth; the journey
// re-presents its already-rendered HTML (prose, code, images) section by section.

const cache = new Map();

const sectionsFromDoc = (doc, fallbackTitle) => {
  const body = doc.querySelector(".post-content");
  if (!body) return null;

  const sections = [];
  let current = { heading: fallbackTitle, kicker: "Transmission Start", html: "" };

  const pushCurrent = () => {
    if (current.html.trim().length) {
      sections.push({ heading: current.heading, kicker: current.kicker, html: current.html });
    }
  };

  for (const node of Array.from(body.childNodes)) {
    if (node.nodeType === 1 && node.tagName === "H2") {
      pushCurrent();
      current = { heading: (node.textContent || "Section").trim() || "Section", kicker: "Checkpoint", html: "" };
      continue;
    }
    current.html += node.nodeType === 1 ? node.outerHTML : (node.textContent || "");
  }
  pushCurrent();

  if (!sections.length) {
    sections.push({ heading: fallbackTitle, kicker: "Transmission", html: body.innerHTML });
  }
  return sections;
};

export const fetchPostSections = async (slug) => {
  if (cache.has(slug)) return cache.get(slug);
  try {
    const res = await fetch(`/posts/${slug}/`, { credentials: "same-origin" });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const doc = new DOMParser().parseFromString(await res.text(), "text/html");
    const title = (doc.querySelector(".post-page h1") || doc.querySelector("h1"))?.textContent?.trim() || slug;
    const meta = doc.querySelector(".entry-meta")?.textContent?.trim() || "";
    const sections = sectionsFromDoc(doc, title);
    if (!sections) return { ok: false, error: "no .post-content" };
    const result = { ok: true, title, meta, sections };
    cache.set(slug, result); // cache only successful results so failures can retry
    return result;
  } catch (error) {
    return { ok: false, error: String((error && error.message) || error) };
  }
};
```

- [ ] **Step 4: Expose the debug hook in `open-world.js`**

In `src/scripts/open-world.js`, add the import alongside the other `./` imports (after the `getHudElements` import on line 36):

```js
import { fetchPostSections } from "./post-content.js";
```

Then, immediately after the `content` object is built (the block ending at line 89, `  };`), add:

```js
  // Debug/test hook — drives the journey smoke harness; harmless in production.
  window.__wbTest = window.__wbTest || {};
  window.__wbTest.postSlug = (i) => (content.posts[i] || {}).slug || null;
  window.__wbTest.fetchSections = (slug) => fetchPostSections(slug);
```

- [ ] **Step 5: Run the test, verify it passes**

Run: `npm run build && npm run test:journey`
Expected: PASS — "JOURNEY SMOKE PASSED".

- [ ] **Step 6: Commit**

```bash
git add src/scripts/post-content.js src/scripts/open-world.js scripts/post-journey-smoke.mjs package.json
git commit -m "feat(world): post-content sectionizer + journey smoke skeleton"
```

---

## Task 2: Persist journeyed posts in world-state

**Files:**
- Modify: `src/scripts/world-state.js`
- Test: `scripts/post-journey-smoke.mjs`

**Interfaces:**
- Consumes: existing `loadState()`, `scheduleSave()`, `clamp()` internals.
- Produces:
  - `markPostJourneyed(slug: string): boolean` — true if newly marked
  - `isPostJourneyed(slug: string): boolean`
  - `getJourneyedPosts(): Record<string, number>`

- [ ] **Step 1: Write the failing test**

Append before the final `if (errors.length)` check in `scripts/post-journey-smoke.mjs`:

```js
  // ── Task 2: world-state persists journeyed posts ──
  const persistResult = await page.evaluate((s) => {
    const first = window.__wbTest.markPostJourneyed(s);
    const second = window.__wbTest.markPostJourneyed(s);
    return { first, second, isMarked: window.__wbTest.isPostJourneyed(s) };
  }, slug);
  if (persistResult.first !== true) fail("markPostJourneyed should return true on first mark");
  if (persistResult.second !== false) fail("markPostJourneyed should return false on repeat");
  if (persistResult.isMarked !== true) fail("isPostJourneyed should be true after marking");
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npm run build && npm run test:journey`
Expected: FAIL — `window.__wbTest.markPostJourneyed is not a function`.

- [ ] **Step 3: Add `journeyedPosts` to default + load merge**

In `src/scripts/world-state.js`, in `defaultState()` add the field after `interactions: 0` (line 24 — add a comma):

```js
  energyLevel: 0.62,
  interactions: 0,
  journeyedPosts: {}
```

In `loadState()`, extend the merge object (the `cache = { ... }` block around line 46) to include:

```js
    cache = {
      ...fresh,
      ...parsed,
      visits: { ...fresh.visits, ...(parsed.visits || {}) },
      discoveredSecrets: { ...fresh.discoveredSecrets, ...(parsed.discoveredSecrets || {}) },
      journeyedPosts: { ...(parsed.journeyedPosts || {}) }
    };
```

- [ ] **Step 4: Add the exported functions**

In `src/scripts/world-state.js`, after `getSecretsFound` (line 250), add:

```js
export const markPostJourneyed = (slug) => {
  if (!slug) return false;
  const state = loadState();
  if (!state.journeyedPosts) state.journeyedPosts = {};
  if (state.journeyedPosts[slug]) return false;
  state.journeyedPosts[slug] = safeNow();
  state.energyLevel = clamp(state.energyLevel + 0.05, 0.2, 1);
  scheduleSave();
  return true;
};

export const isPostJourneyed = (slug) => {
  const map = loadState().journeyedPosts;
  return Boolean(map && map[slug]);
};

export const getJourneyedPosts = () => ({ ...(loadState().journeyedPosts || {}) });
```

- [ ] **Step 5: Expose test hooks in `open-world.js`**

In `src/scripts/open-world.js`, extend the existing world-state import (line 19) to add the new names:

```js
import { getWorldSnapshot, registerVisit, markInteraction, markSecretFound, getSecretsFound, markPostJourneyed, isPostJourneyed } from "./world-state.js";
```

Then add to the `window.__wbTest` block created in Task 1:

```js
  window.__wbTest.markPostJourneyed = (slug) => markPostJourneyed(slug);
  window.__wbTest.isPostJourneyed = (slug) => isPostJourneyed(slug);
```

- [ ] **Step 6: Run the test, verify it passes**

Run: `npm run build && npm run test:journey`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/scripts/world-state.js src/scripts/open-world.js scripts/post-journey-smoke.mjs
git commit -m "feat(world): persist journeyed posts in world-state"
```

---

## Task 3: Journey overlay + HUD markup and styles

**Files:**
- Modify: `src/components/OpenWorldScene.astro`
- Test: `scripts/post-journey-smoke.mjs`

**Interfaces:**
- Produces DOM ids consumed by Tasks 4–5: `world-journey-overlay`, `world-journey-progress`, `world-journey-close`, `world-journey-title`, `world-journey-body`, `world-journey-prev`, `world-journey-next`, `world-journey-plain`, `world-journey-hud`, `world-journey-hud-progress`, `world-journey-leave`.

- [ ] **Step 1: Write the failing test**

Append before the final `if (errors.length)` check in `scripts/post-journey-smoke.mjs`:

```js
  // ── Task 3: journey overlay + HUD markup present and hidden by default ──
  for (const id of ["world-journey-overlay", "world-journey-body", "world-journey-hud", "world-journey-leave"]) {
    const exists = await page.$(`#${id}`);
    if (!exists) fail(`missing journey element #${id}`);
  }
  const overlayHidden = await page.$eval("#world-journey-overlay", (el) => el.hidden);
  if (!overlayHidden) fail("journey overlay should start hidden");
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npm run build && npm run test:journey`
Expected: FAIL — `missing journey element #world-journey-overlay`.

- [ ] **Step 3: Add the markup**

In `src/components/OpenWorldScene.astro`, immediately after the Detail modal block (the `</div>` closing `#world-detail`, line 187), insert:

```html
  <!-- Post journey overlay -->
  <div class="world-journey-overlay" id="world-journey-overlay" hidden aria-hidden="true">
    <article class="world-journey-card" role="dialog" aria-modal="true" aria-labelledby="world-journey-title">
      <header class="world-journey-head">
        <p class="world-journey-progress" id="world-journey-progress"></p>
        <button id="world-journey-close" class="world-modal-close" type="button" aria-label="Close section">&times; Close</button>
      </header>
      <h2 class="world-journey-title" id="world-journey-title"></h2>
      <div class="world-journey-body post-content" id="world-journey-body"></div>
      <footer class="world-journey-actions">
        <button class="hud-btn" id="world-journey-prev" type="button">&larr; Prev</button>
        <a class="hud-btn hud-btn-ghost" id="world-journey-plain" href="#">Read plain article</a>
        <button class="hud-btn" id="world-journey-next" type="button">Next &rarr;</button>
      </footer>
    </article>
  </div>

  <!-- Journey HUD chip (visible only during a journey) -->
  <div class="world-journey-hud" id="world-journey-hud" hidden aria-hidden="true">
    <span class="world-journey-hud-label">TRANSMISSION</span>
    <span class="world-journey-hud-progress" id="world-journey-hud-progress">0 / 0</span>
    <button class="hud-btn hud-btn-ghost" id="world-journey-leave" type="button">Leave [Esc]</button>
  </div>
```

- [ ] **Step 4: Add scoped styles**

In `src/components/OpenWorldScene.astro`, add a `<style>` block immediately before the closing `</section>` (after the `<VirtualJoystick />` line, line 197):

```html
  <style>
    .world-journey-overlay {
      position: fixed;
      inset: 0;
      z-index: 60;
      display: grid;
      place-items: center;
      padding: clamp(1rem, 4vw, 3rem);
      background: radial-gradient(circle at 50% 30%, rgba(0, 40, 56, 0.55), rgba(2, 8, 14, 0.86));
      backdrop-filter: blur(6px);
    }
    .world-journey-overlay[hidden] { display: none; }
    .world-journey-card {
      width: min(720px, 100%);
      max-height: 84vh;
      overflow-y: auto;
      border-radius: 18px;
      border: 1px solid color-mix(in srgb, var(--district-accent, #00e5ff) 35%, transparent);
      background: linear-gradient(160deg, rgba(6, 22, 30, 0.95), rgba(3, 12, 18, 0.97));
      box-shadow: 0 0 48px color-mix(in srgb, var(--district-accent, #00e5ff) 22%, transparent);
      padding: clamp(1.2rem, 3vw, 2rem);
      color: #d7f6ff;
    }
    .world-journey-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 0.4rem;
    }
    .world-journey-progress {
      font-size: 0.78rem;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--district-accent, #00e5ff);
      margin: 0;
    }
    .world-journey-title { margin: 0 0 1rem; line-height: 1.15; }
    .world-journey-body { font-size: 1rem; line-height: 1.7; }
    .world-journey-body :is(pre, code) { white-space: pre-wrap; word-break: break-word; }
    .world-journey-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.6rem;
      margin-top: 1.4rem;
      justify-content: space-between;
    }
    .world-journey-hud {
      position: fixed;
      top: 1rem;
      left: 50%;
      transform: translateX(-50%);
      z-index: 40;
      display: flex;
      align-items: center;
      gap: 0.8rem;
      padding: 0.5rem 0.9rem;
      border-radius: 999px;
      border: 1px solid color-mix(in srgb, var(--district-accent, #00e5ff) 40%, transparent);
      background: rgba(4, 16, 22, 0.82);
      color: #d7f6ff;
      font-size: 0.8rem;
      letter-spacing: 0.08em;
    }
    .world-journey-hud[hidden] { display: none; }
    .world-journey-hud-label { color: var(--district-accent, #00e5ff); letter-spacing: 0.2em; }
    .world-journey-hud-progress { font-variant-numeric: tabular-nums; }
    @media (prefers-reduced-motion: reduce) {
      .world-journey-overlay { backdrop-filter: none; }
    }
  </style>
```

- [ ] **Step 5: Run the test, verify it passes**

Run: `npm run build && npm run test:journey`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/OpenWorldScene.astro scripts/post-journey-smoke.mjs
git commit -m "feat(world): post journey overlay + HUD markup and styles"
```

---

## Task 4: Journey controller module

**Files:**
- Create: `src/scripts/open-world-journey.js`

**Interfaces:**
- Consumes: `fetchPostSections` (Task 1), `createSpriteLabel` from `open-world-config.js`, a `playerObj` with `.player` (THREE.Group), overlay DOM handles (Task 3), `setText` helper.
- Produces: `createPostJourney(opts): journey` where `journey` exposes:
  - `start(entry: { slug, title }, originMesh: THREE.Object3D | null): Promise<void>`
  - `update(dt: number): void`
  - `tryOpen(): void`
  - `openSectionByIndex(i: number, opts?: { teleport?: boolean }): void`
  - `closeOverlay(): void`
  - `leave(): void`
  - `replay(): void`
  - `dispose(): void`
  - getters: `active`, `overlayOpen`, `blockers` (always `[]`), `boundsRadius`, `currentSlug`, `sectionCount`, `readCount`, `allRead`
- `opts` = `{ scene, playerObj, setText, hud: { promptEl, promptText, actionBtn }, overlay: { root, title, body, progress, closeBtn, prevBtn, nextBtn, plainLink, hud, hudProgress, leaveBtn }, fetchSections, onEnter, onLeave, onComplete, onNextPost, sounds }`
  - `sounds` = `{ start, open, close, complete, leave }` (each a no-arg function)

- [ ] **Step 1: Write the failing test**

Append before the final `if (errors.length)` check in `scripts/post-journey-smoke.mjs`:

```js
  // ── Task 4/5: journey lifecycle (start, read all, complete, leave) ──
  const started = await page.evaluate((i) => window.__wbTest.start(i), 0);
  if (!started || !started.active) fail("journey did not become active on start");
  if (started.sectionCount !== expectedCount) {
    fail(`journey sectionCount ${started.sectionCount} != expected ${expectedCount}`);
  }

  const completed = await page.evaluate(() => window.__wbTest.readAll());
  if (completed.readCount !== completed.sectionCount) fail("readAll did not read every section");
  if (!completed.allRead) fail("allRead should be true after reading every section");
  if (!completed.persisted) fail("completing the journey should persist the slug");

  const left = await page.evaluate(() => window.__wbTest.leave());
  if (left.active) fail("journey should be inactive after leave");
  if (!left.worldVisible) fail("Signal nodes should be visible again after leave");
```

These hooks (`window.__wbTest.start/readAll/leave`) are wired in Task 5; this test will fail at the end of Task 4 (hooks absent) and pass at the end of Task 5. That is expected — Task 4 produces the module, Task 5 integrates and exposes it.

- [ ] **Step 2: Run the test, verify it fails**

Run: `npm run build && npm run test:journey`
Expected: FAIL — `window.__wbTest.start is not a function`.

- [ ] **Step 3: Create `src/scripts/open-world-journey.js`**

```js
import * as THREE from "three";
import { createSpriteLabel } from "./open-world-config.js";

const ACCENT = 0x00e5ff;
const LABEL = "#a0f0ff";
const SPACING = 9;       // world units between checkpoints
const START_Z = 6;       // first checkpoint sits this far in front of the trail head
const NEAR_RADIUS = 3.6; // proximity radius to open a checkpoint/terminus

export const createPostJourney = (opts) => {
  const {
    scene, playerObj, setText, hud, overlay,
    fetchSections, onEnter, onLeave, onComplete, onNextPost, sounds = {}
  } = opts;

  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  let active = false;
  let overlayOpen = false;
  let terminusMode = false;
  let sections = [];
  let checkpoints = [];   // { index, root, spire, ring, teaser, pos, read }
  let segments = [];      // { mesh }
  let terminus = null;    // { root, spire, halo, pos }
  let nearby = null;      // number | "terminus" | null
  let openIndex = null;
  let slug = null;
  let title = "";
  let meta = "";
  let boundsRadius = 40;
  let ticker = 0;
  const returnPos = new THREE.Vector3();

  const point = (i) => new THREE.Vector3(Math.sin(i * 0.6) * 4, 0, START_Z - i * SPACING);
  const markerMat = (emissiveInt) => new THREE.MeshStandardMaterial({
    color: 0x041820, emissive: ACCENT, emissiveIntensity: emissiveInt, roughness: 0.3, metalness: 0.5
  });
  const glowMat = (opacity) => new THREE.MeshBasicMaterial({
    color: ACCENT, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false
  });

  const readCount = () => checkpoints.filter((c) => c.read).length;
  const allRead = () => checkpoints.length > 0 && checkpoints.every((c) => c.read);

  const buildMarker = (i) => {
    const root = new THREE.Group();
    const pos = point(i);
    root.position.copy(pos);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.6, 4.2, 5), markerMat(0.25));
    spire.position.y = 2.1;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.05, 10, 36), glowMat(0.32));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.06;
    root.add(spire, ring);
    const teaser = createSpriteLabel(`${i + 1}. ${sections[i].heading}`, LABEL, { x: 4.4, y: 1.05 });
    if (teaser) { teaser.position.set(0, 5.4, 0); teaser.material.opacity = 0.5; root.add(teaser); }
    group.add(root);
    return { index: i, root, spire, ring, teaser, pos, read: false };
  };

  const buildSegment = (i) => {
    const a = i === 0 ? new THREE.Vector3(0, 0, START_Z + 4) : point(i - 1);
    const b = point(i);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const len = a.distanceTo(b) || 0.0001;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, len), glowMat(0.1));
    mesh.position.set(mid.x, 0.08, mid.z);
    mesh.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
    group.add(mesh);
    return { mesh };
  };

  const buildTerminus = (n) => {
    const root = new THREE.Group();
    const pos = point(n);
    root.position.copy(pos);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(1.1, 7.5, 6), markerMat(0.3));
    spire.position.y = 3.75;
    const halo = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.08, 12, 40), glowMat(0.4));
    halo.rotation.x = Math.PI / 2; halo.position.y = 5.2;
    const baseRing = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.06, 10, 40), glowMat(0.3));
    baseRing.rotation.x = Math.PI / 2; baseRing.position.y = 0.06;
    root.add(spire, halo, baseRing);
    group.add(root);
    return { root, spire, halo, pos };
  };

  const clearTrail = () => {
    for (const child of [...group.children]) {
      group.remove(child);
      child.traverse?.((o) => {
        if (o.geometry) o.geometry.dispose?.();
        if (o.material) {
          if (o.material.map) o.material.map.dispose?.();
          o.material.dispose?.();
        }
      });
    }
    checkpoints = [];
    segments = [];
    terminus = null;
  };

  const updateProgressHud = () => {
    if (overlay.hudProgress) overlay.hudProgress.textContent = `${readCount()} / ${checkpoints.length}`;
  };

  const lightCheckpoint = (c) => {
    c.read = true;
    c.spire.material.emissiveIntensity = 0.85;
    c.ring.material.opacity = 0.75;
    if (c.teaser) c.teaser.material.opacity = 0.85;
    if (segments[c.index]) segments[c.index].mesh.material.opacity = 0.55;
  };

  const markRead = (i) => {
    const c = checkpoints[i];
    if (!c || c.read) return;
    const wasComplete = allRead();
    lightCheckpoint(c);
    updateProgressHud();
    if (!wasComplete && allRead()) {
      if (terminus) {
        terminus.halo.material.opacity = 0.85;
        terminus.spire.material.emissiveIntensity = 0.9;
      }
      sounds.complete && sounds.complete();
      onComplete && onComplete(slug);
    }
  };

  const renderSection = (i) => {
    const s = sections[i];
    overlay.title.textContent = s.heading;
    overlay.body.innerHTML = s.html;
    overlay.progress.textContent = `${i + 1} / ${sections.length}`;
    overlay.prevBtn.textContent = "← Prev";
    overlay.prevBtn.disabled = i === 0;
    overlay.nextBtn.textContent = i < sections.length - 1 ? "Next →" : "To terminus →";
    overlay.nextBtn.disabled = false;
  };

  const renderTerminus = () => {
    const done = allRead();
    overlay.title.textContent = title;
    overlay.body.innerHTML =
      `<p class="entry-meta">${meta}</p>` +
      (done
        ? `<p>Transmission received. You walked the whole signal.</p>`
        : `<p>${readCount()} of ${sections.length} checkpoints read. Keep walking the trail to complete the transmission.</p>`);
    overlay.progress.textContent = `${readCount()} / ${sections.length}`;
    overlay.prevBtn.textContent = "↺ Replay";
    overlay.prevBtn.disabled = false;
    overlay.nextBtn.textContent = "Next post →";
    overlay.nextBtn.disabled = false;
  };

  const showOverlay = () => {
    overlay.root.hidden = false;
    overlay.root.setAttribute("aria-hidden", "false");
    overlayOpen = true;
    if (hud.promptEl) hud.promptEl.hidden = true;
    overlay.closeBtn.focus();
    sounds.open && sounds.open();
  };

  const openSectionByIndex = (i, options = {}) => {
    if (i < 0 || i >= sections.length) return;
    terminusMode = false;
    openIndex = i;
    if (options.teleport) {
      const p = checkpoints[i].pos;
      playerObj.player.position.set(p.x, 0, p.z + 3);
    }
    renderSection(i);
    markRead(i);
    showOverlay();
  };

  const openTerminus = () => {
    terminusMode = true;
    openIndex = null;
    renderTerminus();
    showOverlay();
  };

  const closeOverlay = () => {
    if (!overlayOpen) return;
    overlay.root.hidden = true;
    overlay.root.setAttribute("aria-hidden", "true");
    overlayOpen = false;
    terminusMode = false;
    sounds.close && sounds.close();
  };

  const tryOpen = () => {
    if (overlayOpen) return;
    if (nearby === "terminus") { openTerminus(); return; }
    if (typeof nearby === "number") { openSectionByIndex(nearby); return; }
  };

  const replay = () => {
    for (const c of checkpoints) {
      c.read = false;
      c.spire.material.emissiveIntensity = 0.25;
      c.ring.material.opacity = 0.32;
      if (c.teaser) c.teaser.material.opacity = 0.5;
    }
    for (const seg of segments) seg.mesh.material.opacity = 0.1;
    if (terminus) { terminus.halo.material.opacity = 0.4; terminus.spire.material.emissiveIntensity = 0.3; }
    updateProgressHud();
    closeOverlay();
    playerObj.player.position.set(0, 0, START_Z + 8);
  };

  const start = async (entry, originMesh) => {
    if (active) return;
    slug = entry.slug;
    const data = await fetchSections(slug);
    if (!data || !data.ok || !data.sections.length) {
      window.location.href = `/posts/${slug}/`; // graceful fallback to the article
      return;
    }
    sections = data.sections;
    title = data.title || entry.title || slug;
    meta = data.meta || "";
    returnPos.copy(originMesh ? originMesh.position : playerObj.player.position);

    clearTrail();
    checkpoints = sections.map((_, i) => buildMarker(i));
    segments = sections.map((_, i) => buildSegment(i));
    terminus = buildTerminus(sections.length);
    group.visible = true;

    playerObj.player.position.set(0, 0, START_Z + 8);
    boundsRadius = sections.length * SPACING + 18;
    active = true;

    overlay.plainLink.href = `/posts/${slug}/`;
    if (overlay.hud) { overlay.hud.hidden = false; overlay.hud.setAttribute("aria-hidden", "false"); }
    updateProgressHud();
    onEnter && onEnter();
    sounds.start && sounds.start();
  };

  const leave = () => {
    if (!active) return;
    closeOverlay();
    clearTrail();
    group.visible = false;
    active = false;
    nearby = null;
    playerObj.player.position.set(returnPos.x, 0, returnPos.z);
    if (overlay.hud) { overlay.hud.hidden = true; overlay.hud.setAttribute("aria-hidden", "true"); }
    if (hud.promptEl) hud.promptEl.hidden = true;
    onLeave && onLeave();
    sounds.leave && sounds.leave();
  };

  const update = (dt) => {
    if (!active) return;
    ticker += dt;
    const p = playerObj.player.position;

    let foundNearby = null;
    let nearestDist = Infinity;
    for (const c of checkpoints) {
      const d = Math.hypot(p.x - c.pos.x, p.z - c.pos.z);
      // gentle idle shimmer on unread teasers
      if (c.teaser && !c.read) c.teaser.material.opacity = 0.5 + Math.sin(ticker * 2 + c.index) * 0.08;
      if (d < NEAR_RADIUS && d < nearestDist) { nearestDist = d; foundNearby = c.index; }
    }
    if (terminus) {
      const d = Math.hypot(p.x - terminus.pos.x, p.z - terminus.pos.z);
      terminus.halo.rotation.z += dt * (allRead() ? 1.6 : 0.4);
      if (d < NEAR_RADIUS && d < nearestDist) { nearestDist = d; foundNearby = "terminus"; }
    }
    nearby = foundNearby;

    if (!overlayOpen && hud.promptEl) {
      if (nearby === "terminus") {
        hud.promptEl.hidden = false;
        setText(hud.promptText, allRead() ? "View transmission summary" : "Inspect relay spire");
        if (hud.actionBtn) { setText(hud.actionBtn, "Read"); hud.actionBtn.disabled = false; }
      } else if (typeof nearby === "number") {
        hud.promptEl.hidden = false;
        setText(hud.promptText, `Read: ${sections[nearby].heading}`);
        if (hud.actionBtn) { setText(hud.actionBtn, "Read"); hud.actionBtn.disabled = false; }
      } else {
        hud.promptEl.hidden = true;
        if (hud.actionBtn) hud.actionBtn.disabled = true;
      }
    }
  };

  const onPrev = () => { if (terminusMode) replay(); else if (openIndex > 0) openSectionByIndex(openIndex - 1, { teleport: true }); };
  const onNext = () => {
    if (terminusMode) { onNextPost && onNextPost(); return; }
    if (openIndex < sections.length - 1) openSectionByIndex(openIndex + 1, { teleport: true });
    else openTerminus();
  };

  overlay.closeBtn.addEventListener("click", closeOverlay);
  overlay.prevBtn.addEventListener("click", onPrev);
  overlay.nextBtn.addEventListener("click", onNext);
  if (overlay.leaveBtn) overlay.leaveBtn.addEventListener("click", leave);

  const dispose = () => {
    overlay.closeBtn.removeEventListener("click", closeOverlay);
    overlay.prevBtn.removeEventListener("click", onPrev);
    overlay.nextBtn.removeEventListener("click", onNext);
    if (overlay.leaveBtn) overlay.leaveBtn.removeEventListener("click", leave);
    clearTrail();
    if (group.parent) group.parent.remove(group);
  };

  return {
    start, update, tryOpen, openSectionByIndex, closeOverlay, leave, replay, dispose,
    get active() { return active; },
    get overlayOpen() { return overlayOpen; },
    get blockers() { return []; },
    get boundsRadius() { return boundsRadius; },
    get currentSlug() { return slug; },
    get sectionCount() { return sections.length; },
    get readCount() { return readCount(); },
    get allRead() { return allRead(); }
  };
};
```

- [ ] **Step 4: Build to verify the module parses (still fails the lifecycle assertion)**

Run: `npm run build && npm run test:journey`
Expected: build SUCCEEDS; smoke still FAILS at `window.__wbTest.start is not a function` (integration is Task 5). The module itself must compile without errors.

- [ ] **Step 5: Commit**

```bash
git add src/scripts/open-world-journey.js
git commit -m "feat(world): post journey controller (trail, checkpoints, terminus, overlay)"
```

---

## Task 5: Integrate the journey into open-world.js

**Files:**
- Modify: `src/scripts/open-world.js`
- Test: `scripts/post-journey-smoke.mjs` (the Task 4 lifecycle assertions now pass)

**Interfaces:**
- Consumes: `createPostJourney` (Task 4), `fetchPostSections` (Task 1), `markPostJourneyed`/`isPostJourneyed` (Task 2), overlay DOM ids (Task 3).
- Produces: `window.__wbTest.start/readAll/leave/state` debug hooks.

- [ ] **Step 1: Add the journey import**

In `src/scripts/open-world.js`, after the `import { fetchPostSections } ...` line added in Task 1, add:

```js
import { createPostJourney } from "./open-world-journey.js";
```

- [ ] **Step 2: Grab the journey DOM handles**

After the `tutorialEl`/`secretRewardEl` element lookups (the block ending at line 70), add:

```js
  // Journey overlay + HUD elements
  const journeyEls = {
    root: document.getElementById("world-journey-overlay"),
    title: document.getElementById("world-journey-title"),
    body: document.getElementById("world-journey-body"),
    progress: document.getElementById("world-journey-progress"),
    closeBtn: document.getElementById("world-journey-close"),
    prevBtn: document.getElementById("world-journey-prev"),
    nextBtn: document.getElementById("world-journey-next"),
    plainLink: document.getElementById("world-journey-plain"),
    hud: document.getElementById("world-journey-hud"),
    hudProgress: document.getElementById("world-journey-hud-progress"),
    leaveBtn: document.getElementById("world-journey-leave")
  };
```

- [ ] **Step 3: Create the journey controller (just before `openEntry`)**

In `src/scripts/open-world.js`, immediately before the `// ── Interaction helpers ──` comment (line 431) and the `const openEntry = ...` it precedes, add:

```js
  // ── Post journey ───────────────────────────────────────────────
  const setWorldContentVisible = (visible) => {
    for (const m of pack.entryMeshes) m.visible = visible;
    for (const g of pack.gates) g.root.visible = visible;
    if (pack.landmark) pack.landmark.root.visible = visible;
    for (const s of pack.secretNodes) if (s.mesh) s.mesh.visible = visible;
  };

  const tintJourneyedNode = (mesh) => {
    if (mesh && mesh.userData.baseRing) mesh.userData.baseRing.material.color.set(0x7dffd0);
  };

  const journey = createPostJourney({
    scene, playerObj, setText,
    hud: { promptEl, promptText, actionBtn },
    overlay: journeyEls,
    fetchSections: fetchPostSections,
    onEnter: () => setWorldContentVisible(false),
    onLeave: () => setWorldContentVisible(true),
    onComplete: (s) => {
      markPostJourneyed(s);
      const node = pack.entryMeshes.find((m) => m.userData.kind === "posts" && m.userData.entry.slug === s);
      tintJourneyedNode(node);
    },
    onNextPost: () => {
      const list = content.posts;
      const idx = list.findIndex((p) => p.slug === journey.currentSlug);
      const nextEntry = idx >= 0 ? list[(idx + 1) % list.length] : list[0];
      journey.leave();
      if (nextEntry) journey.start(nextEntry, null);
    },
    sounds: {
      start: () => safeAudio(() => playWarpCharge()),
      open: () => safeAudio(() => playHolodeckActivate()),
      close: () => safeAudio(() => playHolodeckDeactivate()),
      complete: () => safeAudio(() => playSecretFound()),
      leave: () => safeAudio(() => playHolodeckDeactivate())
    }
  });
```

> Note: `setText` is the HUD text helper already defined earlier in this function (used around line 775); `scene`, `playerObj`, `pack`, and `content` are all in scope here.

- [ ] **Step 4: Route post nodes into the journey**

In `openEntry` (line 432), add the posts branch at the very top of the function body, before `const title = ...`:

```js
  const openEntry = (mesh) => {
    if (!mesh) return;
    const kind = mesh.userData.kind;
    const entry = mesh.userData.entry;
    if (kind === "posts") { journey.start(entry, mesh); markInteraction(0.8); return; }
    const title = entry.title || entry.role || "Entry";
```

Then delete the now-dead posts branch inside the existing `if/else` (lines 446-449):

```js
    } else if (kind === "posts") {
      detailSummary.textContent = entry.excerpt || "Open post details.";
      detailLink.textContent = "Read Post";
      detailLink.href = `/posts/${entry.slug}`;
    } else {
```

becomes:

```js
    } else {
```

- [ ] **Step 5: Route inspect + Escape through the journey**

In `tryInspect` (line 501), add the journey branch first:

```js
  const tryInspect = () => {
    if (journey.active) { journey.tryOpen(); return; }
    if (nearbyGate && !warp.warping) { warp.warpTo(nearbyGate.key); return; }
```

In the Escape handler (line 535), extend it:

```js
    if (event.key === "Escape") {
      if (starmap.isOpen) { starmap.hide(); return; }
      if (journey.overlayOpen) { journey.closeOverlay(); return; }
      if (journey.active) { journey.leave(); return; }
      closeEntry();
    }
```

- [ ] **Step 6: Leave the journey on scene swap**

In `performSwap` (line 372), add as the first statement inside the function:

```js
  const performSwap = (key) => {
    if (typeof journey !== "undefined" && journey.active) journey.leave();
    pack = sceneManager.swap(key, onAssetLoaded);
```

After `refreshSceneCaches();` in `performSwap` (line 384), add a pass to tint already-journeyed post nodes:

```js
    refreshSceneCaches();
    for (const m of pack.entryMeshes) {
      if (m.userData.kind === "posts" && isPostJourneyed(m.userData.entry.slug)) tintJourneyedNode(m);
    }
```

- [ ] **Step 7: Branch the per-frame proximity, bounds, and input-lock logic**

(a) Input lock — the `inputLocked` line (706) becomes:

```js
    const inputLocked = modalOpen || traveling || starmap.isOpen || journey.overlayOpen;
```

(b) `updatePlayer` call (lines 710-714) — swap blockers + bounds when a journey is active:

```js
    const playerResult = updatePlayer({
      player: playerObj.player, controls, velocity, desired,
      blockers: journey.active ? journey.blockers : pack.blockers,
      camera, moveTarget, modalOpen: inputLocked, running, lowPower, playerObj,
      boundsRadius: journey.active ? journey.boundsRadius : dest().boundsRadius
    }, dt, worldTicker);
```

(c) Secret-node collection loop (line 757) — guard it so hidden secrets aren't collected mid-journey:

```js
    // Secret node collection
    if (!journey.active) for (const secret of pack.secretNodes) {
```

(d) Proximity detection — wrap the whole gate/landmark/entry block. The block begins at `// Proximity detection:` (line 796) and the if/else chain ends at the closing brace of the final `else` (line 864), immediately before `quickLook.show(...)` (line 866). Wrap it:

```js
    // Proximity detection: gates take priority, then landmark, then entries.
    let nearestGate = null;
    let nearestGateDist = Infinity;
    let interactionProximity = 0;
    if (journey.active) {
      journey.update(dt);
      if (quickLookEl) quickLookEl.hidden = true;
    } else {
      // ... existing proximity code, unchanged, from line 798 through line 864 ...
      quickLook.show(hoverEntry || nearby, { quickLookEl, quickLookKicker, quickLookTitle, quickLookSummary, modalOpen });
    }
```

Concretely: move the existing `quickLook.show(...)` call (currently line 866) up so it lives at the end of the `else` branch, and delete its old standalone location. Note `let interactionProximity = 0;` is hoisted above the branch (it was previously declared at line 823 inside the block) so the audio-profile call at line 897 still sees it.

- [ ] **Step 8: Dispose the journey on teardown + expose test hooks**

Find the cleanup function that calls `quickLook.dispose();` (line 1003) and add right after it:

```js
    quickLook.dispose();
    journey.dispose();
```

Extend the `window.__wbTest` block (created in Task 1) with the lifecycle hooks:

```js
  window.__wbTest.start = (i) => {
    journey.start(content.posts[i], null);
    return { active: journey.active, sectionCount: journey.sectionCount };
  };
  window.__wbTest.readAll = () => {
    const n = journey.sectionCount;
    for (let i = 0; i < n; i += 1) { journey.openSectionByIndex(i); journey.closeOverlay(); }
    return {
      sectionCount: n,
      readCount: journey.readCount,
      allRead: journey.allRead,
      persisted: isPostJourneyed(journey.currentSlug)
    };
  };
  window.__wbTest.leave = () => {
    journey.leave();
    return { active: journey.active, worldVisible: pack.entryMeshes[0] ? pack.entryMeshes[0].visible : true };
  };
```

> `window.__wbTest.start` is async-fire-and-forget; sections resolve quickly from the same-origin fetch. The smoke test waits via `page.waitForTimeout` after warping to the posts world (see Step 9), so the trail is built before assertions run.

- [ ] **Step 9: Make the smoke warp to the posts world before the lifecycle assertions**

In `scripts/post-journey-smoke.mjs`, before the "Task 4/5" block, warp into Signal and let the journey hooks settle:

```js
  // Enter the Signal (posts) world before exercising the journey.
  await page.click("#world-starmap-btn");
  await page.click('.world-starmap-dest[data-dest="posts"]');
  await page.waitForTimeout(3500);
  await page.evaluate((i) => window.__wbTest.start(i), 0);
  await page.waitForTimeout(800); // allow fetch + trail build
  const started = await page.evaluate(() => ({ active: window.__wbTest.journeyActive(), sectionCount: window.__wbTest.sectionCount() }));
```

Replace the earlier Task 4 `started`/`completed`/`left` block's first `page.evaluate((i) => window.__wbTest.start(i), 0)` usage with the version above, and add the two tiny getters to the `__wbTest` block in `open-world.js`:

```js
  window.__wbTest.journeyActive = () => journey.active;
  window.__wbTest.sectionCount = () => journey.sectionCount;
```

- [ ] **Step 10: Run the full smoke, verify it passes**

Run: `npm run build && npm run test:journey`
Expected: PASS — "JOURNEY SMOKE PASSED", all of Tasks 1–5 assertions green, no runtime errors.

- [ ] **Step 11: Run the existing world smoke for regressions**

Run: `npm run test:world`
Expected: PASS — "SMOKE PASSED" (warp to all worlds still works; posts node behavior changed but warp/labels are unaffected).

- [ ] **Step 12: Commit**

```bash
git add src/scripts/open-world.js scripts/post-journey-smoke.mjs
git commit -m "feat(world): integrate post journey into Signal (entry, exit, bounds, persistence)"
```

---

## Task 6: Manual verification + docs

**Files:**
- Modify: `docs/superpowers/specs/2026-06-19-post-journey-design.md` (mark implemented)

- [ ] **Step 1: Manual smoke in the dev server**

Run: `npm run dev`, open `/world/`, press **M** → Signal. Walk to a post node, press **E**.
Verify: other nodes fade out; a trail of checkpoints + a relay-spire terminus appears; the journey HUD chip shows "0 / N".

- [ ] **Step 2: Verify reading + completion**

Walk to a checkpoint → prompt "Read: <heading>" → press **E** → overlay shows that section's rendered HTML (including any code blocks/images). Close (**Esc**), walk the trail, read all checkpoints. Verify the HUD count climbs and the terminus halo brightens when all are read. Open the terminus → "Transmission received" with Replay / Next post / Read plain article.

- [ ] **Step 3: Verify exit + persistence + fallback**

Press **Esc** (or the HUD "Leave" button) → trail collapses, Signal nodes return, you're back near the original node, and a completed node's base ring is tinted. Reload `/world/`, return to Signal → the completed node stays tinted (persisted). Confirm `/posts/<slug>/` still loads normally and the overlay's "Read plain article" link points to it.

- [ ] **Step 4: Update the spec status**

In `docs/superpowers/specs/2026-06-19-post-journey-design.md`, change the `**Status:**` line to:

```markdown
**Status:** Implemented (2026-06-19)
```

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-06-19-post-journey-design.md
git commit -m "docs: mark post journey design implemented"
```

---

## Self-Review

**Spec coverage:**
- In-world / Signal-only, H2 checkpoints → Task 1 (sectionizer), Task 4 (markers per section). ✓
- Linear trail, free walk, lit progress → Task 4 (`buildSegment`, `lightCheckpoint`, `update`). ✓
- Hybrid reveal (teaser → overlay on E) → Task 4 (`teaser` sprites + `update` prompt + `openSectionByIndex`). ✓
- Terminus payoff (Replay / Return / Next) → Task 4 (`buildTerminus`, `renderTerminus`, `onPrev`/`onNext`); Return = Leave HUD button. ✓
- Reconfigure-in-place + entry via E + Esc exit → Task 5 (Steps 3-7). ✓
- Runtime fetch of built article, fallback on failure → Task 1 (`fetchPostSections`), Task 4 (`start` fallback). ✓
- Persist completion + node visual → Task 2, Task 5 (`onComplete`, `tintJourneyedNode`, Step 6). ✓
- Accessibility (focus, plain-article link, keyboard) → Task 3 (dialog role, close focus), Task 4 (`showOverlay` focuses close; `plainLink`). ✓
- Corridor/expanded bounds for long posts → Task 4 (`boundsRadius` getter), Task 5 Step 7b. ✓
- Edge cases: no-H2 single section (Task 1 fallback), fetch failure (Task 4 redirect). ✓
- Testing across smoke + structure → Tasks 1-5 assertions in `post-journey-smoke.mjs`. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code. ✓

**Type consistency:** `fetchPostSections` shape (`{ ok, title, meta, sections }`) consistent across Tasks 1/4/5. Journey API names (`start`, `update`, `tryOpen`, `openSectionByIndex`, `closeOverlay`, `leave`, `replay`, `dispose`, getters `active`/`overlayOpen`/`blockers`/`boundsRadius`/`currentSlug`/`sectionCount`/`readCount`/`allRead`) defined in Task 4 and consumed identically in Task 5. Overlay DOM ids defined in Task 3 match the `journeyEls` lookups in Task 5 Step 2. ✓
