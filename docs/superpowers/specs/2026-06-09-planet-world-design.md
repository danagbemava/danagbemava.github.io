# Planet World — Design

**Date:** 2026-06-09
**Status:** Approved pending user review
**Scope:** Transform `/world` from four districts on one plane into a hub space station plus three planets, with warp travel between them, atmosphere, and a full aesthetics pass (bloom, gradient skies, living motion, player juice, faded labels, hover states, cinematic transitions).

## Vision

Each portfolio section is a planet. The player starts on the Nexus Station (hub), sees the three planets hanging in the station's sky, and travels to them through warp gates or a starmap. Each planet is a self-contained scene with its own sky, atmosphere, terrain, and the section's content (project/post/experience nodes, one landmark beacon, one secret shard).

Destinations:

| Key | Name | Section | Identity |
|---|---|---|---|
| `home` | Nexus Station | hub | Lavender station platform in hard vacuum; orrery centerpiece |
| `projects` | Forge | Projects | Molten orange planet, ember ring, industrial constructs |
| `posts` | Signal | Posts | Cyan crystalline planet, planetary rings, aurora sky |
| `experiences` | Grove | Experiences | Green living planet, atmosphere glow, bioluminescent flora |

## 1. Architecture — one renderer, swappable scene packs

The Three.js app boots once per page visit and persists across travel. Destinations are scene packs swapped inside the live scene.

### Module layout

- **`open-world.js`** — boot, main loop, input, HUD wiring, travel orchestration. Slims down: world-building moves out.
- **`open-world-config.js`** — per-destination definitions: sky gradient stops, fog color/density, accent colors, blurbs/objectives, player spawn, gate placements, light profile. Existing `districtConfig`/`districtPresentation`/`districtAtmosphere` merge into one `destinations` map keyed by the same four keys (`home`, `projects`, `posts`, `experiences`) so `world-state` and analytics keys are unchanged.
- **`open-world-scenes.js`** *(new)* — scene-pack manager. Contract:

  ```js
  buildDestination(key, scene, content, lowPower, onAssetLoaded) => {
    group,        // THREE.Group added to scene; dispose removes it
    blockers,     // [{x, z, radius}] for player collision
    entryMeshes,  // interactable content nodes (userData.kind/entry)
    gates,        // [{key: destKey, root, radius, title}] warp triggers
    landmark,     // landmark beacon or null (hub has none)
    secretNodes,  // secret shards in this scene
    assetCount,   // GLBs this pack will load
    update(dt, t),// per-frame animation for this pack
    dispose()     // remove + dispose geometry/materials/textures
  }
  ```

  `swapDestination(key)` disposes the current pack, builds the new one, applies the destination's sky/fog/light profile, and places the player at the arrival point. Scene packs build synchronously in milliseconds; GLBs stream in after arrival (see Travel).
- **`open-world-hub.js`** *(new)* — Nexus Station builder.
- **`open-world-planet.js`** *(new)* — one generic planet-surface builder parameterized by a biome definition. The three planets are data, not three codebases.
- **`open-world-travel.js`** *(new)* — warp sequence controller + starmap overlay logic.
- **`open-world-environment.js`** — reworked into per-destination sky/space backdrop helpers: gradient sky dome (shader), star fields with twinkle, nebula billboards, planet-from-space builder (sphere + fresnel atmosphere shell + rings/particles).
- **`open-world-entries.js`** — keeps node construction; layout becomes a golden-angle spiral around a focal point instead of a grid (parameterized so each planet places its own nodes).
- **`open-world-player.js`**, **`open-world-hud.js`**, **`sfx.js`**, **`world-state.js`**, **`world-events.js`** — kept with adjustments noted below.

### Routing

URL hash sync: `/world/#/projects` etc. via the history API. On load, the hash selects the starting destination (falling back to the `startZone` prop). `hashchange` (back/forward) triggers a warp to the named destination. Unknown hashes fall back to `home`.

## 2. Destinations

### 2.1 Nexus Station (hub)

- Current home island re-dressed as a station platform; orrery centerpiece and `command_nexus.glb` stay.
- Three warp gates around the platform rim (replacing the old district gateways), each with a spinning hologram of its planet and a sprite label.
- The three planets render in the station's sky as large distant bodies (radius ~18–26 at distance ~140–180), each positioned in the direction of its gate: Forge (molten orange, ember particle ring), Signal (cyan, planetary ring discs), Grove (green, thick atmosphere limb).
- Hard vacuum: no clouds, no airborne particles, crisp stars, minimal fog. The contrast with planet surfaces is deliberate.
- Warp lanes: faint energy beams from the station toward each sky planet, with bright pulses traveling along them.

### 2.2 Planet surfaces (generic builder + biome data)

- Terrain: a large disc (~radius 55) of displaced, gently domed geometry — higher rim undulation reads as distant hills; flat playable area (~radius 40) inside. The world boundary clamp matches the playable radius.
- Horizon: haze band ring at the terrain edge + aerial-perspective fog (fog color = sky horizon stop).
- Sky: per-biome gradient dome; sister planets and the hub station visible as small distant bodies; biome-tinted nebula; stars.
- Content per planet: that section's entry nodes on a golden-angle spiral (with jitter) radiating from the planet center; the landmark beacon stands beyond the spiral, opposite the spawn gate, so it reads as a destination; one secret shard hidden off the main path; biome props (existing prop builders, denser than today since each planet has the whole frame budget); 3 NPC wisps; a return gate near spawn plus two side gates to the sister planets (small, so planet-to-planet hops don't require the hub).
- Per-planet GLBs from `DISTRICT_ASSET_CATALOG` mount as today.

### 2.3 Atmosphere

**From space** (planets seen in any sky): fresnel rim-glow shell — an oversized back-face sphere whose opacity peaks at the silhouette edge and fades toward center. One shared ShaderMaterial, color per biome. With bloom, limbs radiate.

**On surface**, four layers, all biome-tinted:

1. **Aerial perspective** — fog color matched to the sky's horizon stop (always on).
2. **Horizon haze band** — glowing ring between terrain edge and sky dome (always on).
3. **Drifting clouds** — large soft billboard sprites crossing overhead at 2–3 altitudes. Low and sparse on Forge, high thin streaks on Signal, low rolling mist on Grove. (Tier 1: halved; lowPower: off.)
4. **Airborne particles** — rising embers that wink out (Forge), slow aurora ribbons rippling across the sky (Signal), drifting luminous pollen (Grove). (Tier 1: halved; lowPower: off.)

The hub gets none of layers 3–4 (vacuum).

## 3. Travel

### Warp sequence (`open-world-travel.js`)

1. **Trigger:** gate interact (E / tap / Inspect button) or starmap selection. Ignored while a warp is in progress or a modal is open.
2. **Departure (0.4s):** input locked, gate glow swells, FOV widens slightly, warp-charge audio.
3. **Tunnel (≥1.2s):** fullscreen star-streak overlay (2D canvas or shader quad) tinted toward the destination accent. The scene swap executes behind the overlay. If destination GLBs aren't loaded, the tunnel holds up to 5s, then arrives anyway with models popping in as they land.
4. **Arrival (0.6s):** overlay irises out; camera starts slightly high/wide and settles into gameplay framing; destination title splash ("FORGE — Stellar Foundry") with letter-spacing animation. This replaces the old zone-flash entirely.
5. URL hash updated; `registerVisit(key)` fires on arrival.

### Starmap

- HUD button alongside Cam/Quality (+ `M` key, touch-friendly).
- DOM overlay styled like the detail modal: four destination cards with accent colors, name, blurb, current-location marker, and progress per destination (beacon lit? secret found?).
- Esc or backdrop click closes. Picking a destination (other than current) starts a warp. Focus is trapped while open (same pattern as the detail modal).

## 4. Aesthetics layer

1. **Bloom** — `EffectComposer` + `RenderPass` + `UnrealBloomPass` (threshold ≈0.75, strength ≈0.55, radius ≈0.6) + `OutputPass`. Only emissive/bright surfaces bloom. Most existing fake additive "glow shell" meshes get deleted — real glow replaces them. Vignette via a static CSS radial-gradient overlay (free).
2. **Gradient skies** — per-destination 3-stop gradient dome (ShaderMaterial, vertex-height mix). Star twinkle via per-star phase attribute in a small Points shader.
3. **Living motion** — warp-lane pulses in the hub sky; shooting stars every 8–20s (streak sprite, any destination); NPC wisps leave short fading trails (ring buffer of sprites).
4. **Player juice** — footstep ground ripple rings; landing dust burst; sprint FOV kick (+5°, lerped in/out).
5. **Distance-faded labels** — sprite labels fade in within ~28 units of the player and scale ~1.0→1.06 on approach. Per-frame opacity lerp over the current pack's labels only.
6. **Node hover/proximity states** — the active `nearby`/hover node gets emissive ×1.6, base-ring spin ×3, and 5% scale, all lerped.
7. **Transitions** — warp + arrival title splash (section 3) is the transition system.

## 5. Performance & quality tiers

| Effect | Tier 2 | Tier 1 | Tier 0 / lowPower |
|---|---|---|---|
| Bloom composer | on | off | off |
| Clouds / airborne particles | full | halved | off |
| Wisp trails, footstep ripples | on | on | off |
| Fresnel shells, gradient sky, fog, haze band | on | on | on |
| Pixel-ratio caps (existing) | 1.4 | 1.1 | 0.85 |

Each scene pack is smaller than today's combined world, so this is a net perf win even with bloom. The adaptive-quality FPS sampler (existing) drives tier changes; the composer is created lazily on first tier-2 frame.

## 6. State, HUD, audio

- `world-state.js` unchanged: energy/visits/secrets remain global and keyed by the same four zone keys. Beacon activations stay in session memory; the starmap reads both.
- `world-events.js`: `getZone` (already implemented) returns the current destination; event pools keep their keys.
- HUD: zone label/blurb/objective come from the destination config. The minimap shows the **current scene's** POIs (entries, landmark, gates, player) instead of the old 4-district overview; in the hub it shows the three gates. Secrets never appear on the minimap.
- Tutorial gains a "Travel" hint (gate + starmap) in both keyboard and touch flavors.
- Audio: per-destination ambient profile via existing `setWorldAudioProfile`; new sfx: warp charge, warp tunnel whoosh, arrival chime.

## 7. Error handling

- If a destination build throws mid-warp: abort the warp, rebuild/keep the previous destination, unlock input, `console.warn`. The world never dies from a failed swap.
- GLB load failures: as today — `onAssetLoaded` error path; the planet simply lacks that model.
- WebGL-unavailable fallback (already shipped) unchanged.
- Unknown URL hash → `home`.

## 8. Verification

- `npm run build` passes.
- Playwright smoke (extends the existing pattern): boot hub → assert scene-ready, zero console errors → open starmap → warp to each planet → assert zone label, URL hash, zero errors → gate back to hub. Screenshot each destination for visual review.
- Manual pass on a touch viewport (joystick + tap-to-travel).

## 9. Out of scope

- Mario Galaxy spherical-gravity walking.
- New GLB asset downloads (existing catalog only).
- InstancedMesh/draw-call refactor (less needed; scenes are smaller).
- Persistent cross-session beacon state.
- Day/night cycles, weather simulation.
