# Authored Open World Expedition — Design

**Date:** 2026-09-05
**Status:** Approved pending written-spec review
**Scope:** Evolve `/world/` from a freeform portfolio explorer into a focused, game-like 15–20 minute expedition built from the existing Nexus, Forge, Signal, and Grove destinations.

## Summary

The Open World already provides movement, travel, four destination scene packs,
content nodes, landmark beacons, secrets, local persistence, adaptive quality,
ambient events, and an in-world journey for reading posts. The next stage should
give those systems a shared purpose.

The player arrives at a partially dormant Nexus Station and restores three
planetary beacons. Each planet turns its existing portfolio content into a
distinct activity:

- **Forge:** reconstruct real systems from selected projects.
- **Signal:** walk through and tune a written idea.
- **Grove:** reconstruct pivotal career memories and connect the capabilities
  they developed.

Restoring all three planets unlocks a personalized constellation sequence at
Nexus. The world then remains open for free exploration, replay, and secret
discovery.

The experience is gently guided through Forge → Signal → Grove on a first visit,
but all gates and starmap destinations remain available. No combat, currency,
crafting, daily quests, generic experience points, or backend account system is
introduced.

## Design principles

1. **Portfolio actions, not generic game tasks.** Every required action must
   reveal something specific about Daniel's work, thinking, or development.
2. **Guidance without restriction.** The world recommends a route but never
   locks a destination or punishes deviation.
3. **No dead ends.** Every activity can be reset, left, skipped, and resumed.
4. **Visible consequences.** Completion changes the world through light,
   motion, sound, geometry, or environmental activity.
5. **Depth over breadth.** Three deliberately authored activities are preferable
   to shallow mechanics on every portfolio entry.
6. **The conventional website remains canonical.** Project pages, posts, and
   experiences remain directly reachable throughout the expedition.
7. **Gameplay signals survive reduced quality.** Decorative rendering may scale
   down; objectives, interactions, and state cues may not disappear.

## Player journey

### Opening at Nexus

The player arrives at a dormant Nexus Station. The central orrery detects three
weak planetary signals and recommends Forge as the first destination. Gate
lighting, an orrery pulse, and the objective text reinforce that recommendation.
Signal and Grove remain selectable from their gates and the starmap.

On a returning visit, Nexus restores the saved expedition state and displays a
short, dismissible summary: current objective, restored worlds, and incomplete
activities. The player may continue, restart the expedition, or enter free
exploration if the finale was previously completed.

### Planet rhythm

Every planet follows the same high-level rhythm so the player can understand
progress without a heavy tutorial:

1. Arrive and witness a short environmental introduction to the planet's
   problem.
2. Discover three authored anchors drawn from existing portfolio content.
3. Complete the planet's activity using those anchors.
4. Reach and activate the landmark beacon.
5. Witness a persistent transformation of the planet.

An activity may be left at any point. Completed steps save immediately. Returning
to the planet restores those steps and highlights the next meaningful action.

### Finale and post-game

When all three beacons are restored, the starmap and gate lighting point back to
Nexus. The three signals converge on the orrery and open the Constellation.

The Constellation is assembled from the visitor's actual route: restored project
systems, the completed transmission, recovered capabilities, and found secrets.
It is a short audiovisual retrospective rather than a score screen. After it
finishes, the player can continue exploring, replay any activity, or return to
the conventional site.

Finding all three secrets adds a hidden constellation and a short creator's
note. It does not change access to the main ending.

## Planet activities

### Forge — reconstruct the systems

Forge represents the engineering of complete systems. Three selected projects
become dormant machines positioned as major landmarks instead of ordinary entry
nodes. The initial authored set is:

1. **Shea Traceability:** restore the offline capture → local cache → background
   synchronization flow.
2. **Agriconnect:** route a domain event from a producer through Kafka to its
   consumer and appropriate datastore.
3. **Fluxx:** reconnect a mobile feature through interface → state → service →
   API, including the authenticated request path.

Each reconstruction is a guided spatial circuit. A nearby component identifies
its responsibility and shows available connections. The player carries or
routes an energy pulse between components. A valid connection lights and starts
the next part of the machine. An invalid connection briefly visualizes why the
signal cannot flow and returns the piece without losing progress.

These activities are explanations, not quizzes. Visitors are never expected to
already know the architecture. Completing a machine reveals a concise engineering
decision from the underlying project and activates one feed into the Forge Core.
Restoring all three machines enables the player to ignite the Core beacon.

The existing project nodes remain available as optional exhibits. Only the three
authored machines are required for the planet activity.

### Signal — walk through ideas

Signal extends the implemented post-journey system. The player chooses a
transmission and walks its ordered section checkpoints. On the first expedition,
the world highlights one recommended introductory post; the player can choose a
different complete post instead.

At each checkpoint:

- the existing overlay presents the canonical rendered section;
- an environmental response represents the section's subject, such as a
  holographic architecture diagram, animated data flow, or changing signal
  pattern;
- optional echo nodes expose closely related posts without interrupting the
  active journey.

Tuning every checkpoint in one transmission establishes the Relay and enables
the Signal beacon. Completing more transmissions intensifies planetary lighting
and relay traffic but is not required for the expedition.

The plain article link remains available in the journey overlay and HUD. If a
post cannot be fetched or parsed, the player is offered the plain article and a
planet-progress skip; the world never navigates away without explaining the
fallback.

### Grove — reconstruct a career

Grove represents growth through connected experiences. The primary path contains
three pivotal memories:

1. **FASYL:** early mobile architecture and technical enablement.
2. **Nevercode:** large-scale open-source support, testing, compatibility work,
   and issue triage.
3. **Independent work:** end-to-end delivery across mobile, backend, distributed
   systems, hardware integration, and offline products.

Each memory is reconstructed from three short fragments:

- the challenge or context;
- the action Daniel took;
- the capability the experience developed.

The player gathers the fragments by exploring a compact memory scene and returns
them to its monument. Completion grows a luminous root from that memory toward
later experiences and related projects. Examples include Nevercode support work
connecting to later Flutter products, event-driven architecture connecting to
Agriconnect, and offline-first engineering connecting to Traceability.

The mechanic is chronological but not a résumé slideshow: the player physically
reveals how one capability enabled later work. Restoring all three memories and
their connections blooms the Grove Heart beacon.

## Progression model

### Expedition states

The expedition director owns the following top-level phases:

`arrival → planetary restoration → Nexus return → constellation → free exploration`

Each planet independently reports:

`dormant → discovered → responding → restored`

The states are descriptive rather than restrictive. A player may have multiple
planets in `responding` and can restore them in any order.

### Guidance hierarchy

Guidance escalates only when necessary:

1. **Environmental:** gate light, energy flow, signal pulse, luminous root, or
   guiding wisp.
2. **Contextual:** proximity prompt and short objective update.
3. **Explicit:** after an inactivity threshold, the HUD offers to highlight the
   next objective or let a wisp lead the player there.

The first-visit route recommends Forge → Signal → Grove. The recommendation is
recorded separately from completion state so choosing another planet never
creates an invalid save.

### Persistence

World state moves from version 1 to version 2. The migration preserves current
visits, energy, discovered secrets, and completed post journeys. Version 2 adds:

- expedition phase and finale completion;
- per-planet state;
- per-activity step completion;
- restored beacons;
- route history used by the finale;
- activity skip markers;
- optional reset generation or start timestamp.

State continues to use browser-local storage. Save after every completed step,
beacon activation, secret discovery, skip, and finale transition. Storage
failure keeps the current session playable and surfaces one non-blocking warning
that progress may not persist.

Restarting the expedition requires confirmation and resets only expedition v2
progress. Existing site preferences and unrelated browser data are untouched.

## Secrets and environmental storytelling

Each planet contains one authored secret outside the required path:

- **Forge — Prototype Vault:** contrasts an early and later approach to one
  project and explains what changed.
- **Signal — Fragmented Transmission:** reveals a personal reflection, abandoned
  idea, or lesson that does not fit a conventional article.
- **Grove — Hidden Root Network:** reveals the people, communities, or open-source
  work behind a later capability.

Secrets provide lore and permanent visual changes. They do not award power or
gate the main ending. Existing secret keys may be retained and mapped to these
authored discoveries during the state migration.

Ambient world events should reinforce current progress. They may acknowledge a
newly running Forge machine, an established Signal relay, or a restored Grove
memory. Random events must not alter required state.

## Interface

### Expedition HUD

The always-visible HUD retains:

- destination name and short identity;
- current objective;
- starmap access;
- contextual action;
- compact planet-restoration state.

Camera, quality, sound, help, restart, and return-to-site actions move into a
pause panel. Raw visit count leaves the primary HUD. Energy remains only if it is
redefined as beacon restoration; otherwise it is removed rather than presented
as an unexplained percentage.

The starmap shows each planet's four-state progression, next authored objective,
beacon state, and secret state. It does not lock destinations.

### Activity overlays

Every activity provides:

- a short objective and current step;
- `Leave` without losing completed steps;
- `Reset activity` with confirmation;
- `Skip activity` with an explanation of what will remain incomplete;
- a direct link to the relevant canonical project, post, or experience content.

Text should describe the portfolio meaning of an action, not only the game
metaphor. For example, a Forge connection identifies the actual architectural
boundary that the energy conduit represents.

## Content model

Authored gameplay data lives in a dedicated module, proposed as
`src/data/world-expedition.ts`, rather than being inferred from arbitrary
Markdown. The manifest references canonical content by slug or stable experience
identifier.

It defines:

- first-visit route and Nexus narration;
- Forge projects, components, connections, hints, explanations, and visual
  transformations;
- Signal recommendation, optional relationships, and checkpoint presentation;
- Grove memories, fragments, capabilities, and project connections;
- objective and recovery copy;
- secret lore;
- finale fragments and route-dependent selection rules.

Validation happens at build time. A referenced slug or identifier that does not
exist fails the build with a clear message. The manifest does not duplicate full
article or project bodies; it stores only the authored interaction layer.

## Architecture

### Expedition director

A new `open-world-expedition.js` module coordinates high-level progression. It
reads and writes the versioned state, chooses the current objective, responds to
destination swaps, receives activity completion events, updates the starmap and
HUD, and starts the finale.

It does not construct Three.js objects and does not own input handling. The
existing `open-world.js` remains the composition root and forwards travel and
interaction events to the director.

### Activity controllers

Each planet owns a controller with a common lifecycle:

```text
start(context)
update(deltaTime)
interact(target)
leave()
reset()
restore(savedProgress)
dispose()
```

Proposed modules:

- `open-world-forge-activity.js`
- `open-world-signal-activity.js`, wrapping the existing post journey rather
  than replacing it
- `open-world-grove-activity.js`
- `open-world-finale.js`

Controllers emit semantic events such as `step-completed`, `activity-skipped`,
and `planet-restored`. They do not write local storage directly. The expedition
director owns state transitions and persistence.

### Scene integration

`open-world-scenes.js`, `open-world-hub.js`, and `open-world-planet.js` continue to
own destination construction and disposal. Scene packs expose stable attachment
points for authored activity objects and a method for applying a planet's
progress transformation.

Travel remains available during activities. Before a scene swap, the active
controller records its step state and disposes temporary objects. Returning to
the planet reconstructs the activity from saved progress.

The existing movement, player, travel, entry, HUD, world-event, audio, adaptive
quality, and post-journey modules remain the foundation. The design does not
replace them with a second runtime.

## Recovery and error handling

- Invalid Forge connections animate a reversible rejection and preserve valid
  connections.
- A missing activity attachment point disables only that activity and offers its
  skip/canonical-content path.
- Signal fetch or parsing failure offers the plain article and progress skip
  rather than navigating away automatically.
- Missing Grove content falls back to an overlay presentation of the canonical
  experience.
- A failed state migration keeps a backup of the parsed version-1 data in memory,
  initializes fresh expedition progress, and reports a non-blocking warning.
- A failed destination build follows the existing warp recovery path and never
  advances expedition state.
- Finale failure returns control to the restored Nexus and exposes a `Replay
  finale` action.

No recoverable error clears saved progress automatically.

## Accessibility and input

- Each spatial activity has an equivalent DOM overlay mode using the same
  objective and completion state.
- Keyboard, pointer, and touch actions call the same controller interactions.
- Focus is trapped inside activity, pause, starmap, and finale dialogs and is
  restored on close.
- Reduced-motion mode shortens warp transitions, removes camera/FOV kicks, and
  replaces sweeping finale movement with fades.
- Objective cues never depend on color alone; use shape, motion where permitted,
  text, and audio as redundant signals.
- Low-quality mode preserves paths, roots, connection lines, and interactable
  highlights while removing only decorative particles, trails, bloom, and dense
  props.
- The WebGL fallback links to the same canonical projects, posts, and experiences
  represented by the expedition.

## Verification

### Automated

Extend the existing Playwright smoke style to cover:

1. First-time Nexus boot and suggested Forge objective.
2. Free travel to every planet despite the suggested order.
3. Complete all three Forge circuits and restore its beacon.
4. Complete one Signal transmission and restore its beacon.
5. Restore all three Grove memories and its beacon.
6. Return to Nexus, play the Constellation, and enter free exploration.
7. Reload during every activity and verify exact step restoration.
8. Leave, reset, and skip each activity.
9. Discover all secrets and verify the alternate finale fragment.
10. Migrate a representative version-1 save.
11. Exercise missing-content and storage-failure fallbacks.
12. Confirm canonical links remain usable.

Pure state-transition tests should cover the expedition director independently
from WebGL. Activity-controller tests should verify restore and reset behavior
without requiring rendered screenshots.

### Manual and visual

- Desktop keyboard and click-to-move expedition.
- Touch viewport with joystick, contextual action, and overlay equivalents.
- Reduced-motion expedition and finale.
- Low-quality mode on every required objective.
- Keyboard-only focus order and dialog recovery.
- Visual captures for dormant, responding, and restored states of each planet
  plus the normal and secret Constellation endings.
- A complete playthrough timed against the 15–20 minute target, including a
  first-time visitor who has not read the conventional portfolio.

## Delivery boundaries

This design is one subsystem but should be delivered in cohesive vertical
slices. A practical sequence is:

1. Expedition manifest, state v2 migration, director, HUD, and Nexus guidance.
2. Forge activity and persistent planet transformation.
3. Signal integration and environmental checkpoint responses.
4. Grove memory activity and capability roots.
5. Constellation finale and secret variant.
6. Cross-device accessibility, performance, and complete expedition hardening.

Each slice must keep free exploration and canonical content fallbacks working.

## Out of scope

- Combat, enemies, health, or fail states.
- Currency, inventory, crafting, equipment, or generic experience levels.
- Accounts, cloud saves, leaderboards, multiplayer, or social ghosts.
- Procedurally generated quests or daily retention systems.
- Automatic gameplay generation from Markdown prose.
- Replacing the existing planet-scene architecture or player controller.
- Requiring every project, post, or experience to have a bespoke activity.
- Spherical-gravity walking or a general-purpose physics engine.
