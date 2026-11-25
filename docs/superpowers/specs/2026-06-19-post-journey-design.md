# Post Journey — In-World Checkpoint Reading (Design)

**Date:** 2026-06-19
**Status:** Implemented (2026-06-19)
**Scope:** The **Signal** world of the Three.js open world (`/world/`). Posts only.

## Summary

Today, pressing **E** on a post node in the Signal world opens a detail modal whose
"Read Post" button navigates *out* of the world to the flat `/posts/<slug>/` article.

This feature replaces that handoff (for posts) with an **in-world checkpoint journey**:
the player walks a glowing trail whose checkpoints map to the post's `##` (H2) sections,
reading each section in a themed 2D overlay as they go. The journey reconfigures the
Signal scene in place — no route change. The plain article remains the canonical,
always-reachable source of truth and the graceful fallback.

## Decisions (locked)

| Decision | Choice |
|---|---|
| Where the journey lives | In-world (3D), inside the Signal world |
| Checkpoint source | Markdown **H2** headings (intro = content before first H2) |
| Spatial form | **Linear trail** — checkpoints in reading order along a forward arc |
| Reading mechanic | **Hybrid** — in-world teaser on approach, **E** expands a 2D themed overlay |
| Progression | **Free walk** — no gating; lit trail shows sequence; HUD shows "n / N" |
| End state | **Relay Spire terminus** — broadcasts when all checkpoints read; meta + actions |
| Scene model | **Reconfigure Signal in place** (state machine), not a separate scene/route |
| Entry | **E launches the journey directly** — no intermediate modal for posts |
| Exit | **Esc** / "Leave" collapses the trail, restores Signal, returns near the node |
| Content source | **Fetch the built `/posts/<slug>/` article at runtime**, split client-side |
| Persistence | Completed post slugs persisted via `world-state` |

## Concept & flow

1. Walk up to a post node, press **E** → other Signal nodes/decor fade back; a glowing
   trail materializes ahead from the player's position.
2. The trail has one **checkpoint** per H2 section, in reading order. Content before the
   first H2 (the intro) is checkpoint 0.
3. Each checkpoint shows an **in-world teaser**: section heading + first line + "n / N".
   Within interaction range it brightens and prompts **"E to read."**
4. **E** → a Signal-themed 2D **glass overlay** opens with that section's fully-rendered
   HTML (prose, code blocks, images). Reading it **lights the checkpoint** and its trail
   segment. **Esc** / close → back to walking.
5. **Free walk** — wander, skip, backtrack. A HUD readout shows progress ("3 / 7").
6. The trail ends at a **Relay Spire terminus**. Once every checkpoint is read it
   pulses/broadcasts and shows post meta (date, tags) with **Replay · Return to Signal ·
   Next Post**.
7. **Esc** (or a "Leave" HUD button) at any time collapses the trail, fades Signal back
   in, and returns the player near the original node.

A **"Read plain article"** affordance is always present in the overlay/HUD as an escape
hatch to `/posts/<slug>/`.

## Data flow

On journey entry:

1. `fetchPostSections(slug)` → `fetch('/posts/<slug>/')` (same-origin static file).
2. Parse the returned HTML in-browser; locate the article body (`.post-content`).
3. Split into sections at each `<h2>`: `{ heading, html }[]`. Content before the first
   `<h2>` becomes the **intro** section (heading derived from the post title / "Transmission Start").
4. Cache the result per-slug for the session.

The world page (`src/pages/world/index.astro`) continues to pass post entries as
`{ slug, title, excerpt }` — no build-pipeline change.

### Edge cases

- **No H2 headings** → a single "whole transmission" checkpoint containing the full body.
- **Fetch/parse failure** → surface a toast and fall back to navigating directly to
  `/posts/<slug>/`. Never a dead end.

## Spatial / scene model

Reconfigure Signal **in place** via a journey state machine:
`idle → entering → active → exiting`.

- **Trail:** checkpoints laid in a gentle forward arc from the player's position,
  ~8–10 units apart. Each checkpoint is a lightweight spire/marker reusing the Signal
  palette (cyan/aurora, additive glow) and `buildQuickMesh`-style geometry. Trail
  segments between read checkpoints are lit.
- **Bounds:** Signal's circular `boundsRadius: 40` is too small for long posts. During a
  journey, swap the circular bound for a **corridor bound** sized to the trail length;
  restore the circular bound on exit.
- **Teasers:** a floating sprite/panel per checkpoint (heading + first line) that
  brightens within interaction radius — reuses the existing proximity pattern
  (`nearby` / `hover` node logic in `open-world.js`).

## Components & files

| File | Change | Purpose |
|---|---|---|
| `src/scripts/open-world-journey.js` | **new** | Builds trail/checkpoints/terminus; owns journey state machine, proximity→teaser updates, read-tracking. Bulk of the feature, isolated from `open-world.js`. |
| `src/scripts/post-content.js` | **new** | `fetchPostSections(slug)`: fetch + parse + split + per-session cache. Pure and testable. |
| `src/components/OpenWorldScene.astro` | edit | Add the 2D overlay markup + Signal-themed styles; mirror the existing detail-modal / quicklook structure and focus-trapping. |
| `src/scripts/open-world.js` | edit | For `kind === "posts"`, `openEntry` calls `journey.start(entry)` instead of populating the modal; wire E/Esc; per-frame `journey.update(dt, player)`; integrate corridor bounds. |
| `src/scripts/world-state.js` | edit | Track completed post slugs (persisted) so the terminus and the node's idle visual reflect "already journeyed." |

### Module boundaries

- **`post-content.js`** depends only on `fetch` + DOM parsing. Input: slug. Output:
  `{ sections, error }`. No Three.js, no world state.
- **`open-world-journey.js`** depends on Three.js, `post-content.js`, the Signal
  palette/config, and the overlay DOM handles. Exposes `start(entry)`, `update(dt, player)`,
  `leave()`, and a `state` flag. Does not reach into unrelated world systems.
- **`open-world.js`** is the integrator: routes post interactions into the journey,
  forwards input and the frame loop, manages bounds swap.

## Error handling, accessibility, testing

- **Errors:** fetch/parse failure → graceful fallback to the plain article; never a dead end.
- **Accessibility:** the journey is an *enhancement* over the always-available article.
  The overlay is focus-trapped (like the current detail modal), driven by E/Esc, and the
  "Read plain article" link is always present.
- **Testing:**
  - Extend the smoke rig (`scripts/world-smoke.mjs`, Playwright): E on a post node starts a
    journey; checkpoint count == section count (intro + H2s); opening a checkpoint renders
    section HTML; reading all checkpoints lights the terminus; Esc restores Signal.
  - Focused unit test for `post-content.js` split logic (intro extraction, H2 splitting,
    no-H2 fallback).

## Out of scope

- Projects and Experiences worlds (posts only for now).
- Authored/custom checkpoint markers, automatic chunking, or non-H2 segmentation.
- Changes to the flat `/posts/[slug].astro` article page itself.
- Gated/on-rails progression.
