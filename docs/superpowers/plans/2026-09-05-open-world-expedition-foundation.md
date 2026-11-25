# Open World Expedition Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent expedition foundation that gently guides a first-time player from Nexus toward Forge while preserving free travel and every current Open World route.

**Architecture:** A build-validated expedition manifest is serialized through the existing world page. A version-2 state migration and renderer-independent expedition director own progression; focused HUD and pause modules render that state, and scene packs receive a small presentation-only progress hook. `open-world.js` stays the composition root and forwards travel and beacon events without owning expedition rules.

**Tech Stack:** Astro 5, browser JavaScript modules, Three.js 0.161, browser `localStorage`, Node.js assertions, Playwright smoke scripts.

**Spec:** `docs/superpowers/specs/2026-09-05-authored-open-world-expedition-design.md`

## Global Constraints

- This plan covers phase 1 only: manifest, state v2, director, Nexus guidance, starmap/HUD, pause, and recovery controls.
- Forge, Signal, Grove, Constellation, and final hardening remain separate reviewable plans built on these interfaces.
- All destinations stay reachable through gates and the starmap; suggested order never becomes a lock.
- Preserve v1 visits, energy, secrets, and `journeyedPosts` during migration.
- Keep state browser-local; add no account, backend, network save, leaderboard, or analytics dependency.
- Preserve canonical Projects, Posts, Experiences, and WebGL-fallback routes.
- Required cues must remain visible in low-quality and reduced-motion modes.
- Keep the user's unrelated modified and untracked posts out of every commit.
- Use test-first changes and one focused commit per task.

## Planned file responsibilities

- `src/data/world-expedition.js`: authored route, anchor references, copy, secret mapping, and build validator.
- `src/scripts/world-state.js`: v1-to-v2 normalization and expedition persistence primitives.
- `src/scripts/open-world-expedition.js`: pure progression policy and semantic transitions.
- `src/scripts/open-world-pause.js`: pause dialog, focus management, and confirmed restart.
- `src/scripts/open-world-hud.js`: expedition view-model rendering.
- `src/scripts/open-world-travel.js`: four-state starmap presentation only.
- `src/scripts/open-world-hub.js` and `open-world-planet.js`: visual response to progress, without persistence.
- `src/scripts/open-world.js`: lifecycle composition and forwarding of semantic events.
- `scripts/world-expedition-*.mjs`: renderer-independent contract tests.
- `scripts/world-smoke.mjs`: browser integration and resume behavior.

---

### Task 1: Authored manifest and build-time content validation

**Files:**
- Create: `src/data/world-expedition.js`
- Create: `scripts/world-expedition-manifest-smoke.mjs`
- Modify: `src/pages/world/index.astro`
- Modify: `src/components/OpenWorldScene.astro`
- Modify: `package.json`

**Interfaces:**
- Produces: `expeditionManifest` with `version`, `suggestedRoute`, `nexus`, `planets`, and `secrets`.
- Produces: `validateExpeditionManifest(manifest, contentIndex) => { ok: true }`, throwing a descriptive error for unknown references.
- Produces: JSON node `#world-data-expedition`, consumed through existing `parseJsonNode`.

- [ ] **Step 1: Write the failing manifest smoke**

Create `scripts/world-expedition-manifest-smoke.mjs`:

```js
import assert from "node:assert/strict";
import {
  expeditionManifest,
  validateExpeditionManifest
} from "../src/data/world-expedition.js";

const index = {
  projects: new Set(["traceability", "agriconnect", "fluxx"]),
  posts: new Set(["2026-02-23-my-agentic-development-flow"]),
  experiences: new Set([
    "software-engineer-fasyl",
    "nevercode-software-developer",
    "freelance-software-engineer"
  ])
};

assert.deepEqual(validateExpeditionManifest(expeditionManifest, index), { ok: true });
const broken = structuredClone(expeditionManifest);
broken.planets.projects.anchors[0].contentSlug = "missing-project";
assert.throws(
  () => validateExpeditionManifest(broken, index),
  /Unknown project slug: missing-project/
);
console.log("world expedition manifest smoke: ok");
```

- [ ] **Step 2: Add and run the test command**

Add to `package.json`:

```json
"test:expedition:manifest": "node scripts/world-expedition-manifest-smoke.mjs"
```

Run: `npm run test:expedition:manifest`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `world-expedition.js`.

- [ ] **Step 3: Implement the immutable manifest and validator**

Create `src/data/world-expedition.js` with this authored content:

```js
const DESTINATIONS = new Set(["home", "projects", "posts", "experiences"]);

const value = {
  version: 1,
  suggestedRoute: ["projects", "posts", "experiences"],
  nexus: {
    arrivalObjective: "The Forge signal is weakest. Restore it first, or choose any world from the starmap.",
    returningObjective: "Resume the next unfinished planetary signal.",
    completeObjective: "The Constellation is stable. Explore freely or replay a restored world."
  },
  planets: {
    projects: {
      label: "Forge",
      anchors: [
        { id: "traceability-sync", contentType: "project", contentSlug: "traceability" },
        { id: "agriconnect-events", contentType: "project", contentSlug: "agriconnect" },
        { id: "fluxx-feature-flow", contentType: "project", contentSlug: "fluxx" }
      ]
    },
    posts: {
      label: "Signal",
      anchors: [{
        id: "agentic-development-transmission",
        contentType: "post",
        contentSlug: "2026-02-23-my-agentic-development-flow"
      }]
    },
    experiences: {
      label: "Grove",
      anchors: [
        { id: "fasyl-memory", contentType: "experience", contentSlug: "software-engineer-fasyl" },
        { id: "nevercode-memory", contentType: "experience", contentSlug: "nevercode-software-developer" },
        { id: "independent-memory", contentType: "experience", contentSlug: "freelance-software-engineer" }
      ]
    }
  },
  secrets: {
    projects: "data_shard",
    posts: "timeline_echo",
    experiences: "sky_shard"
  }
};

const deepFreeze = (item) => {
  Object.values(item).forEach((child) => {
    if (child && typeof child === "object" && !Object.isFrozen(child)) deepFreeze(child);
  });
  return Object.freeze(item);
};

export const expeditionManifest = deepFreeze(value);

export const validateExpeditionManifest = (manifest, contentIndex) => {
  for (const key of manifest.suggestedRoute) {
    if (!DESTINATIONS.has(key) || key === "home") {
      throw new Error(`Unknown expedition destination: ${key}`);
    }
  }
  for (const [key, planet] of Object.entries(manifest.planets)) {
    if (!DESTINATIONS.has(key) || key === "home") {
      throw new Error(`Unknown expedition planet: ${key}`);
    }
    for (const anchor of planet.anchors) {
      const collection = `${anchor.contentType}s`;
      if (!contentIndex[collection]?.has(anchor.contentSlug)) {
        throw new Error(`Unknown ${anchor.contentType} slug: ${anchor.contentSlug}`);
      }
    }
  }
  return { ok: true };
};
```

- [ ] **Step 4: Run the manifest smoke**

Run: `npm run test:expedition:manifest`

Expected: PASS with `world expedition manifest smoke: ok`.

- [ ] **Step 5: Validate and serialize the manifest in Astro**

In `src/pages/world/index.astro`, add stable experience slugs, create `Set`s from
the three loaded collections, call `validateExpeditionManifest`, and pass
`expeditionManifest` to `OpenWorldScene`.

In `OpenWorldScene.astro`, add the prop, serialize it with the component's existing
safe JSON pattern, and emit:

```astro
<script id="world-data-expedition" type="application/json" set:html={expeditionJson} />
```

- [ ] **Step 6: Verify build-time validation**

Run: `npm run build`

Expected: PASS with `/world/index.html` generated. Existing Astro `layout` warnings
are acceptable; new manifest/schema errors are not.

- [ ] **Step 7: Commit**

```bash
git add package.json src/data/world-expedition.js scripts/world-expedition-manifest-smoke.mjs src/pages/world/index.astro src/components/OpenWorldScene.astro
git commit -m "feat(world): add validated expedition manifest"
```

---

### Task 2: Version-2 state and migration

**Files:**
- Create: `scripts/world-expedition-state-smoke.mjs`
- Modify: `src/scripts/world-state.js`
- Modify: `package.json`

**Interfaces:**
- Produces: `createDefaultWorldState(now)`, `migrateWorldState(input, now)`, and `resetExpeditionStateObject(state, now)` as pure functions.
- Produces: `getExpeditionProgress()`, `updateExpeditionProgress(mutator)`, `resetExpeditionProgress()`, and `consumePersistenceWarning()`.
- Preserves all existing exports.

- [ ] **Step 1: Write migration and reset assertions**

Create a Node assertion script that supplies a representative v1 object and
asserts:

```js
const v1 = {
  version: 1,
  createdAt: 100,
  updatedAt: 200,
  lastVisitedZone: "posts",
  visits: { home: 2, projects: 1, posts: 3, experiences: 0 },
  discoveredSecrets: { sky_shard: true, data_shard: false, timeline_echo: false },
  secretsFound: 1,
  energyLevel: 0.74,
  interactions: 12,
  journeyedPosts: { "2026-02-23-my-agentic-development-flow": 123 }
};
const migrated = migrateWorldState(v1, 1_700_000_000_000);
assert.equal(migrated.version, 2);
assert.deepEqual(migrated.visits, v1.visits);
assert.deepEqual(migrated.discoveredSecrets, v1.discoveredSecrets);
assert.deepEqual(migrated.journeyedPosts, v1.journeyedPosts);
assert.equal(migrated.expedition.phase, "arrival");
assert.equal(migrated.expedition.planets.projects.status, "dormant");

const reset = resetExpeditionStateObject({
  ...migrated,
  expedition: { ...migrated.expedition, phase: "free_exploration", finaleCompleted: true }
}, 1_700_000_000_001);
assert.equal(reset.expedition.phase, "arrival");
assert.equal(reset.expedition.finaleCompleted, false);
assert.deepEqual(reset.visits, migrated.visits);
assert.deepEqual(reset.discoveredSecrets, migrated.discoveredSecrets);
```

End with `world expedition state smoke: ok`.

- [ ] **Step 2: Add the command and prove failure**

Add `"test:expedition:state": "node scripts/world-expedition-state-smoke.mjs"`.

Run: `npm run test:expedition:state`

Expected: FAIL because the pure helpers are not exported.

- [ ] **Step 3: Define the v2 expedition shape**

Use `wb.world.state.v2` as the active key and retain
`wb.world.state.v1` as `LEGACY_STORAGE_KEY`. Add:

```js
const createDefaultExpedition = (now) => ({
  startedAt: now,
  phase: "arrival",
  finaleCompleted: false,
  suggestedDestination: "projects",
  route: [],
  skippedActivities: {},
  planets: {
    projects: { status: "dormant", completedSteps: [], beaconRestored: false },
    posts: { status: "dormant", completedSteps: [], beaconRestored: false },
    experiences: { status: "dormant", completedSteps: [], beaconRestored: false }
  }
});
```

`migrateWorldState` must clone input, normalize partial v2 values, and copy all v1
top-level fields. It must never mutate its argument.

- [ ] **Step 4: Make pure helpers Node-safe**

Export the pure helpers and guard the current top-level unload registration with
`if (typeof window !== "undefined")`. Do not call browser APIs while importing
the module in Node.

- [ ] **Step 5: Load v2 first and migrate v1 once**

If v2 is absent, read v1, migrate it, cache the v2 result, and schedule a v2 save.
Keep the v1 key as a recoverable backup. Malformed JSON creates fresh v2 state and
sets an in-memory persistence warning.

Storage write failure also sets that warning. `consumePersistenceWarning()`
returns and clears it.

- [ ] **Step 6: Add the mutation gateway**

```js
export const getExpeditionProgress = () => structuredClone(loadState().expedition);

export const updateExpeditionProgress = (mutator) => {
  const state = loadState();
  const draft = structuredClone(state.expedition);
  mutator(draft);
  state.expedition = draft;
  scheduleSave();
  return structuredClone(draft);
};

export const resetExpeditionProgress = () => {
  cache = resetExpeditionStateObject(loadState());
  scheduleSave();
  return getExpeditionProgress();
};
```

- [ ] **Step 7: Run focused regressions**

Run:

```bash
npm run test:expedition:state
npm run test:journey
```

Expected: both PASS, including existing completed-post persistence.

- [ ] **Step 8: Commit**

```bash
git add package.json scripts/world-expedition-state-smoke.mjs src/scripts/world-state.js
git commit -m "feat(world): migrate expedition progress to state v2"
```

---

### Task 3: Renderer-independent expedition director

**Files:**
- Create: `src/scripts/open-world-expedition.js`
- Create: `scripts/world-expedition-director-smoke.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes state adapter `{ getProgress, updateProgress, resetProgress }`.
- Produces `createExpeditionDirector({ manifest, state, onChange })`.
- Director methods: `arrive(destination)`, `setActivityStep(destination, stepId, complete)`, `skipActivity(destination, skipped)`, `restoreBeacon(destination)`, `completeFinale()`, `reset()`, `getViewModel()`, `dispose()`.
- View model: `{ phase, suggestedDestination, objective, route, finaleAvailable, finaleCompleted, planets }`.

- [ ] **Step 1: Write a failing director smoke**

Use an in-memory state adapter and assert:

```js
assert.equal(director.getViewModel().suggestedDestination, "projects");
director.arrive("posts");
assert.deepEqual(progress.route, ["posts"]);
assert.equal(progress.planets.posts.status, "discovered");
assert.equal(progress.suggestedDestination, "projects");

director.restoreBeacon("projects");
assert.equal(progress.suggestedDestination, "posts");
director.restoreBeacon("posts");
director.restoreBeacon("experiences");
assert.equal(director.getViewModel().finaleAvailable, true);
assert.equal(progress.phase, "nexus_return");

director.completeFinale();
assert.equal(progress.phase, "free_exploration");
assert.equal(progress.finaleCompleted, true);
```

Also assert each public mutation calls `onChange` once and `dispose()` suppresses
future callbacks.

- [ ] **Step 2: Add the command and prove failure**

Add `"test:expedition:director": "node scripts/world-expedition-director-smoke.mjs"`.

Run: `npm run test:expedition:director`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement objective selection**

Keep the module independent of DOM, Three.js, and local storage. Apply these exact
rules in order:

1. Completed finale → `nexus.completeObjective`.
2. All beacons restored → phase `nexus_return`, objective `Return to Nexus and align the Constellation.`
3. Suggested destination → first incomplete entry in `suggestedRoute`.
4. Home → arrival objective before any route entry, returning objective afterward.
5. Restored current planet → invite free exploration or the next planet.
6. Dormant/discovered current planet → locate its authored anchors.
7. Responding current planet → continue restoring its signal.

- [ ] **Step 4: Implement semantic transitions**

`arrive` records non-home destinations once and changes `dormant` to `discovered`.
`setActivityStep` adds/removes unique IDs and changes the planet to `responding`
when any step exists. `restoreBeacon` sets `status: "restored"` and
`beaconRestored: true`. `skipActivity` records intent but never restores a beacon.
Every mutation recalculates phase and suggested destination before notifying.

- [ ] **Step 5: Run tests**

Run:

```bash
npm run test:expedition:director
npm run test:expedition:state
```

Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json scripts/world-expedition-director-smoke.mjs src/scripts/open-world-expedition.js
git commit -m "feat(world): add expedition progression director"
```

---

### Task 4: Expedition HUD, pause, and four-state starmap

**Files:**
- Create: `src/scripts/open-world-pause.js`
- Modify: `src/components/OpenWorldScene.astro`
- Modify: `src/scripts/open-world-hud.js`
- Modify: `src/scripts/open-world-travel.js`
- Modify: `src/styles/app.css`
- Modify: `scripts/world-smoke.mjs`

**Interfaces:**
- Produces `renderExpeditionHud(els, viewModel, currentDestination)`.
- Produces `createPausePanel({ root, openButton, closeButton, resetButton, onReset })` with `show`, `hide`, `toggle`, `isOpen`, `dispose`.
- Changes starmap progress to `{ status, beaconRestored, secretFound, objective }`.
- Changes `createStarmap` to return its existing controls plus public `refresh()`.

- [ ] **Step 1: Add failing UI smoke assertions**

Import `expect` from `@playwright/test`, then add these assertions to
`scripts/world-smoke.mjs` after world readiness:

```js
await expect(page.locator("#world-expedition-status")).toContainText("0 / 3 RESTORED");
await expect(page.locator("#world-objective")).toContainText("Forge");
await expect(page.locator("#world-pause-btn")).toBeVisible();
await expect(page.locator("#world-visits")).toBeHidden();
await page.locator("#world-pause-btn").click();
await expect(page.locator("#world-pause")).toBeVisible();
await page.keyboard.press("Escape");
await expect(page.locator("#world-pause")).toBeHidden();
```

Open the starmap and assert Forge contains `DORMANT` while every non-current
destination remains enabled.

- [ ] **Step 2: Prove failure**

Run: `npm run test:world`

Expected: FAIL because the status and pause controls do not exist.

- [ ] **Step 3: Restructure the HUD markup**

Keep destination, objective, starmap, help, contextual action, minimap, secrets,
and new `#world-expedition-status` visible. Hide the visit stat and remove energy
from the visible primary row while retaining their IDs for safe legacy updates.

Move camera, quality, and sound into dialog `#world-pause`. Add close, canonical
site links, `Restart expedition`, and an `aria-live="polite"`
`#world-persistence-warning`. Add `Pause [Esc]` to the primary HUD.

- [ ] **Step 4: Implement pause behavior**

`show()` stores focus and focuses close. `hide()` restores focus. Trap Tab within
the dialog. Backdrop and Escape close it. Restart calls `window.confirm`
immediately before `onReset`; cancel changes nothing. `dispose()` removes every
listener.

- [ ] **Step 5: Render expedition status**

Add to `open-world-hud.js`:

```js
export const renderExpeditionHud = (els, view, currentDestination) => {
  els.objective.textContent = view.objective;
  const restored = Object.values(view.planets).filter((item) => item.beaconRestored).length;
  els.expeditionStatus.textContent = `${restored} / 3 RESTORED`;
  els.shell.dataset.expeditionPhase = view.phase;
  els.shell.dataset.suggestedDestination = view.suggestedDestination || "";
  els.shell.dataset.zone = currentDestination;
};
```

- [ ] **Step 6: Render four-state starmap cards**

Each planet displays `DORMANT`, `DISCOVERED`, `RESPONDING`, or `RESTORED`, plus
its objective. Restored cards show beacon and secret markers. Set `data-status`
for styling. Do not disable any non-current destination. Return the existing
starmap controls plus `refresh`, so director changes can update an already-open
starmap without closing it.

- [ ] **Step 7: Style and verify responsive/reduced-motion behavior**

Reuse the starmap glass surface. On mobile, keep only destination, objective,
status, starmap, pause, and contextual action in the primary controls. Add visible
focus treatment and remove panel transitions under `prefers-reduced-motion`.

Run:

```bash
npm run test:world
npm run build
```

Expected: both PASS.

- [ ] **Step 8: Commit**

```bash
git add scripts/world-smoke.mjs src/components/OpenWorldScene.astro src/scripts/open-world-hud.js src/scripts/open-world-pause.js src/scripts/open-world-travel.js src/styles/app.css
git commit -m "feat(world): add expedition HUD and pause controls"
```

---

### Task 5: Scene-pack progress presentation

**Files:**
- Modify: `src/scripts/open-world-scenes.js`
- Modify: `src/scripts/open-world-hub.js`
- Modify: `src/scripts/open-world-planet.js`
- Modify: `scripts/world-smoke.mjs`

**Interfaces:**
- Produces on every scene pack: `applyExpeditionView(viewModel) => void`.
- Hub: suggested gate and restored planet holograms respond visually.
- Planets: baseline dormant/discovered/responding/restored presentation without activity logic.

- [ ] **Step 1: Add failing presentation probes**

Assert through `window.__wbTest.expeditionPresentation()`:

```js
assert.equal(presentation.destination, "home");
assert.equal(presentation.suggestedDestination, "projects");
assert.equal(presentation.suggestedGate, "projects");
assert.equal(presentation.planetStatuses.projects, "dormant");
```

After traveling to Signal, assert its scene status is `discovered`.

- [ ] **Step 2: Prove failure**

Run: `npm run test:world`

Expected: FAIL because the presentation hook is absent.

- [ ] **Step 3: Add the scene-pack contract**

Both hub and planet builders return `applyExpeditionView`. The scene manager
validates its presence. It receives the complete view model and never imports
state or the director.

- [ ] **Step 4: Implement Nexus guidance**

Retain references to gates and distant planet holograms. Mark exactly one gate
root with `userData.expeditionSuggested`, raise its emissive treatment, and pulse
it from the existing update loop. A restored planet hologram gets a steady
brighter treatment. Reduced motion uses steady brightness with no scale pulse.
Do not change gate keys or interaction radii.

- [ ] **Step 5: Implement baseline planet states**

Record state on `group.userData.expeditionStatus` and apply:

- dormant: current baseline;
- discovered: brighter landmark ring;
- responding: brighter landmark and one steady path cue;
- restored: persistent landmark glow and brighter horizon haze.

Visits and landmark inspection must not restore an expedition beacon.

- [ ] **Step 6: Verify and commit**

Run:

```bash
npm run test:world
npm run test:journey
npm run build
```

Expected: all PASS.

```bash
git add scripts/world-smoke.mjs src/scripts/open-world-scenes.js src/scripts/open-world-hub.js src/scripts/open-world-planet.js
git commit -m "feat(world): visualize expedition progress in scene packs"
```

---

### Task 6: Live integration, resume, and restart

**Files:**
- Modify: `src/scripts/open-world.js`
- Modify: `src/scripts/open-world-hud.js`
- Modify: `src/components/OpenWorldScene.astro`
- Modify: `scripts/world-smoke.mjs`
- Modify: `scripts/post-journey-smoke.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces one director and one pause controller per world boot lifecycle.
- Produces test hooks `window.__wbTest.expedition()`, `restoreBeacon(destination)`, and `expeditionPresentation()` returning defensive data.

- [ ] **Step 1: Add the failing end-to-end foundation flow**

Clear v1/v2 storage, load Nexus, and assert phase `arrival`, Forge suggestion, and
Forge objective. Travel to Signal first; assert Signal becomes `discovered` while
Forge remains suggested. Reload and assert route/status persist. Use the semantic
test hook to restore all three beacons and assert phase `nexus_return` and
`finaleAvailable: true`.

- [ ] **Step 2: Prove failure**

Run: `npm run test:world`

Expected: FAIL because the expedition hooks do not exist.

- [ ] **Step 3: Instantiate manifest, state adapter, and director**

Parse `world-data-expedition`; create the Task 2 state adapter; instantiate the
Task 3 director. Its `onChange` callback must render the HUD, call the active
pack's `applyExpeditionView`, and refresh an open starmap. If
`consumePersistenceWarning()` is true, announce `Progress may not persist in this browser.` once.

- [ ] **Step 4: Forward semantic travel events**

Call `director.arrive(startKey)` after initial construction and
`director.arrive(key)` only after a successful swap. Starmap status reads the
director plus existing secret state. Do not use the session-only
`activatedBeacons` set as expedition truth.

Landmark inspection remains functional but does not restore expedition beacons
until planet activities exist.

- [ ] **Step 5: Wire pause, Escape, restart, and cleanup**

Restart calls `director.reset()` and reapplies the current destination. Escape
precedence is starmap → journey overlay → active journey → entry detail → pause →
open pause. Never open pause during warp. Cleanup disposes director/pause,
removes listeners, and deletes test hooks.

- [ ] **Step 6: Expose defensive test hooks**

```js
window.__wbTest.expedition = () => structuredClone(director.getViewModel());
window.__wbTest.restoreBeacon = (key) => director.restoreBeacon(key);
window.__wbTest.expeditionPresentation = () => ({
  destination: sceneManager.key,
  suggestedDestination: director.getViewModel().suggestedDestination,
  suggestedGate: pack.gates.find((gate) => gate.root.userData.expeditionSuggested)?.key || null,
  planetStatuses: Object.fromEntries(
    Object.entries(director.getViewModel().planets).map(([key, item]) => [key, item.status])
  )
});
```

- [ ] **Step 7: Add an aggregate command**

```json
"test:expedition": "npm run test:expedition:manifest && npm run test:expedition:state && npm run test:expedition:director && npm run test:world && npm run test:journey"
```

- [ ] **Step 8: Run the complete automated gate**

Run:

```bash
npm run test:expedition
npm run test:experiments
npm run build
git diff --check
```

Expected: all PASS. World smoke proves free-order travel and reload/resume;
journey smoke proves the existing in-world reading flow remains functional.

- [ ] **Step 9: Run the manual foundation pass**

Verify desktop keyboard and pointer behavior:

1. Nexus suggests Forge in HUD and gate presentation.
2. Signal and Grove remain immediately selectable.
3. Signal remains `DISCOVERED` after reload.
4. Pause opens/closes with pointer and keyboard, trapping/restoring focus.
5. Restart cancel preserves progress; restart confirm clears expedition only.
6. Low quality preserves suggested-gate visibility.
7. Reduced motion uses steady guidance rather than pulsing.

Record desktop results explicitly. Do not label a responsive viewport as
native-device or touch-device validation.

- [ ] **Step 10: Commit**

```bash
git add package.json scripts/world-smoke.mjs scripts/post-journey-smoke.mjs src/components/OpenWorldScene.astro src/scripts/open-world.js src/scripts/open-world-hud.js
git commit -m "feat(world): integrate persistent expedition foundation"
```

---

### Task 7: Foundation review checkpoint

**Files:**
- Create after the checkpoint: `docs/superpowers/plans/2026-09-05-open-world-forge-activity.md`
- Modify implementation files only if the verification gate identifies a defect.

**Interfaces:**
- Locks the manifest, state adapter, director, activity-step, beacon, and scene-presentation contracts consumed by the Forge plan.

- [ ] **Step 1: Review branch scope**

Run `git diff main...HEAD --check`, `git diff main...HEAD --stat`, and
`git log --oneline main..HEAD`. Confirm unrelated post files are absent and the
foundation commits are focused.

- [ ] **Step 2: Record exact stable signatures for the Forge plan**

Record these resolved exports at the top of the Forge plan:

```text
expeditionManifest
getExpeditionProgress()
updateExpeditionProgress(mutator)
createExpeditionDirector({ manifest, state, onChange })
director.setActivityStep(destination, stepId, complete)
director.restoreBeacon(destination)
pack.applyExpeditionView(viewModel)
```

If execution required a signature change, update this plan's interface record
and the Forge plan in the same documentation commit.

- [ ] **Step 3: Run a clean-process final gate**

Stop the development server, then run:

```bash
npm run test:expedition
npm run test:experiments
npm run build
git status --short
```

Expected: all commands PASS. Status may show only the user's pre-existing post
edits and drafts; no foundation implementation file may remain modified.

- [ ] **Step 4: Request foundation review**

Present the exact commit list, automated results, manual-validation boundaries,
and known limitations. Do not begin Forge activity work before this vertical
slice is approved.
