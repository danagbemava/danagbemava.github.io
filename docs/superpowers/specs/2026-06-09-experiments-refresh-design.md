# Experiments Refresh — Design

**Date:** 2026-06-09
**Status:** Approved
**Scope:** Upgrade the two experiment pages (`public/experiments/fibonacci-sphere.html`, `public/experiments/celestial-hand-control.html`) to match the planet-world aesthetic and modernize their tech, keeping them self-contained single HTML files served in the experiment viewer's iframe.

## Shared visual language ("one universe")

Both pages adopt the planet-world look:

- Nebula gradient backdrop (deep violet zenith → tinted horizon) instead of flat black; star specks.
- Site palette: lavender `#c8b0ff` primary accent; cyan `#00e5ff`, orange `#ff6b35`, mint `#7dffb3` as secondary accents.
- Sora typography (Google Fonts link, `sans-serif` fallback), uppercase letter-spaced kickers.
- Frosted-glass panels matching the world HUD: `rgba(10, 6, 28, 0.8)` + blur + 1px `rgba(180, 160, 255, 0.25)` border, 12–16px radius.
- Soft CSS vignette overlay.
- Themed loader consistent with the world loading overlay.

## Fibonacci Sphere — rewrite

**Out:** React 18 UMD, Babel-standalone (in-browser JSX), Tailwind CDN runtime, Three r128 script tag.
**In:** Vanilla JS, Three (current release, pinned) via ESM importmap from jsdelivr, hand-rolled themed UI.

Features preserved exactly: point-count/radius/size/rotation controls, rainbow + base color, sphere/cube/torus morph targets with lerp, noise strength/speed, plexus connection lines, bouncing planet physics (instanced, gravity + collisions), audio file upload + analyser-driven displacement, gain/bass-boost controls, drag-rotate, wheel zoom, UI hide toggle.

Added:

- **Touch:** pointer-events-based drag (works for touch + mouse), two-finger pinch zoom.
- **Mic input:** second audio source via `getUserMedia` → analyser (no playback routing to speakers).
- **Safety:** point count clamped to [100, 10000]; numeric inputs validated.
- **Disposal:** full geometry/material/texture cleanup on page hide is unnecessary (iframe lifetime) but allocations on point-count change must dispose the old buffers.
- Page title and panel header unified as "Fibonacci Sphere".

## Celestial Hand Control — modernize

**Out:** legacy `@mediapipe/hands` + `camera_utils` scripts, Three r128 + `examples/js` OrbitControls, inline `onclick` handlers.
**In:** `@mediapipe/tasks-vision` `HandLandmarker` (VIDEO running mode) via ESM, Three (current, pinned) ESM + `three/addons` OrbitControls, `addEventListener` wiring.

Features preserved exactly: 8000-particle universe; all 8 gestures (fist→sphere, point→Sagittarius, palm→galaxy, peace→Taurus, rock-on→Orion, three→Cassiopeia, OK→black hole, hands-apart→big bang); hand-size zoom; camera preview tile with landmark overlay (drawn manually from landmark output — `drawing_utils` is not needed); particle size slider; reset; toast notifications; internal tween system.

Gesture port: the existing finger-up heuristics (`tip.y < pip.y`) read `HandLandmarker` landmarks unchanged — same 21-point topology, same normalized coordinates.

Added:

- **Camera-denied/error state:** if `getUserMedia` rejects or the model fails to load, the button resets and a themed toast explains what happened. No hung "Loading AI…".
- Pixel ratio capped at 1.5.
- Gesture guide collapses behind a toggle on small screens.

## Architecture constraints

- Both files remain **self-contained static HTML** in `public/experiments/` — the viewer (`src/pages/experiments/[slug].astro`) iframes them raw with `sandbox="allow-scripts allow-same-origin"` and shows their source in a code tab. No bundler involvement; all dependencies via pinned CDN URLs (ESM importmap).
- No changes to the experiment content collection or viewer page.

## Verification

- `scripts/experiments-smoke.mjs` (+ `npm run test:experiments`): Playwright loads both pages directly (not via iframe), asserts a WebGL canvas is present and rendering, zero console errors / page errors, and for hand-control asserts the camera-denied path shows the themed error toast (permission auto-denied headlessly). Screenshots for visual review.
- `npm run build` unaffected (public/ files aren't built) but run anyway as the repo gate.

## Risk

MediaPipe migration is the fragile part. Fallback if `tasks-vision` fails in practice: keep the legacy API, ship the visual refresh only.

## Out of scope

- Integrating the experiments into the 3D world.
- New experiments or feature additions beyond mic input and touch support.
- Changing the experiments index or viewer chrome.
