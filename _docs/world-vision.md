# World Vision

## District Map

| District | Theme | Mood |
|---|---|---|
| **Hub** | Town Square | Central, welcoming |
| **Experiences** | Memory Garden 🌿 | Soft, organic, dreamy |
| **Projects** | Industrial Town 🏭 | Mechanical, dense, structured |
| **Posts** | Marketplace 🏪 | Warm, busy, lively |

---

## Hub — Town Square

- Decorative **fountain** at centre: tiered basin on plinth, water-ring glow effect
- Player spawns at the fountain
- Cobblestone-style ground plate (slightly raised, darker tone)

---

## Experiences — Memory Garden

**Ground colour**: `0x091a10` (deep garden earth)

### Entry node geometry
Each pedestal randomly picks one of:
- **Standing stone** — tapered monolith + rune glow ring at base
- **Memory orb pedestal** — short plinth + hovering sphere (gentle bob animation)
- **Arch monument** — two posts + top arc + inner glow plane

### Ambient props (scattered across zone)
- Stone ring henge (torus on ground, mossy green)
- Glowing lantern stem (thin pole + enclosed glow sphere)
- Floating memory shard (small octahedron, slow drift animation)
- Low hedge trim (flat stretched box, soft green emissive)
- Arch gate pair (two posts + overhead arch, teal glow)

### GLB assets (on disk)
- `memory_obelisk.glb` — entry gateway at corridor start
- `timeline_bridge.glb` — tiled along the path corridor
- `skill_garden.glb` — side dressing scattered along corridor

---

## Projects — Industrial Town

**Ground colour**: `0x0c1920` (dark industrial concrete)

### Entry node geometry
Each node randomly picks one of:
- **Factory unit** — main box building + chimney + corrugated roof cap
- **Warehouse** — wide low box + loading bay indent + side vent pipes
- **Machine shop** — boxy structure + side-mounted gear ring + small antenna

### Ambient props
- Tall factory chimney stack (cylinder, y: 0 → 9)
- Storage silo (fat cylinder, y: 0 → 6)
- Industrial crane arm (horizontal box + vertical mast + cable line)
- Pipeline section (horizontal tubes connecting two anchor posts)
- Cooling tower (tapered hyperboloid via lathe, wider at top)

### GLB assets (on disk)
- `forge_tower.glb`
- `assembly_arm.glb`
- `generator_rack.glb`

---

## Posts — Marketplace

**Ground colour**: `0x1a1006` (warm amber cobblestone)

### Entry node geometry
Each node randomly picks one of:
- **Covered stall** — 4 slim posts + flat canopy + hanging sign board
- **Open-front shop** — box back wall + overhang + goods shelf ledge
- **Food cart** — rounded front + single post + striped canopy cone

### Ambient props
- Market awning pole (slim post + triangular canopy)
- Stacked goods crates (2–3 boxes, slightly rotated)
- Town lamp-post (thin pole + glowing sphere cap)
- Info board/banner (flat plane + pole + glowing amber panel)
- Decorative potted plant (pot box + small sphere cluster top)

### GLB assets (on disk)
- `archive_kiosk.glb`
- `signal_arch.glb`
- `datapole_cluster.glb`

---

## NPCs

- 3–4 per district (not in hub), 12 total
- Shape: slim capsule body + sphere head (pure geometry — no GLTF)
- Behaviour: pick random point in district bounds → walk → pause → repeat
- Scale: `0.32` (same as player) so they feel proportionate
- Colour: neutral dark grey, no emissive (background elements)

---

## Player Scale

`0.32` — reduced so buildings read as city-scale

---

## Portal System

Hub has 3 portals (one per district). Additional inter-district shortcuts:

| Portal | From | To |
|---|---|---|
| Projects → Posts | near projects east wall `(-5, 0, -2)` | Posts `(38, 0, 0)` |
| Posts → Projects | near posts west wall `(5, 0, -2)` | Projects `(-38, 0, 0)` |
| Experiences → Hub | near exp south gate `(0, 0, -22)` | Hub `(0, 0, 0)` |

---

## What's Built vs Pending

| Feature | Status |
|---|---|
| Experiences corridor, pedestals, wisps, sentinel | ✅ Built |
| Experiences GLB assets wired (obelisk, bridge, garden) | ✅ Built |
| Experiences ambient props (henge, lantern, shard, hedge, arch) | ✅ Built |
| Hub fountain | ⬜ Pending |
| Projects / Posts entry node variety | ⬜ Pending |
| Projects / Posts ambient props | ⬜ Pending |
| NPCs | ⬜ Pending |
| Inter-district shortcut portals | ⬜ Pending |
