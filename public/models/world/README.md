# World Assets (CC0)

## Automatic Download

Run the download script to fetch CC0 models from Kenney:

```bash
npm run sync-assets          # download and place all models
npm run sync-assets:dry      # preview what would be downloaded
```

The script downloads from:
- **Kenney Space Kit** (150 assets) — projects & posts districts
- **Kenney Space Station Kit** (90 assets) — experiences & home districts

## Manual Placement

If you prefer to choose models manually, drop `.glb` files with these exact names:

### Home district
- `home/command_nexus.glb`

### Projects district
- `projects/forge_tower.glb`
- `projects/assembly_arm.glb`
- `projects/generator_rack.glb`

### Posts district
- `posts/archive_kiosk.glb`
- `posts/signal_arch.glb`
- `posts/datapole_cluster.glb`

### Experiences district
- `experiences/memory_obelisk.glb`
- `experiences/skill_garden.glb`
- `experiences/timeline_bridge.glb`

## Recommended free sources
- [Kenney](https://kenney.nl/assets) (CC0): Space Kit, Space Station Kit, City Kit Industrial
- [Quaternius](https://quaternius.com/) (CC0): Modular Sci-Fi MegaKit, Ultimate Space Kit
- [Poly Haven](https://polyhaven.com/) (CC0): Atmospheres and textures

The scene loader is resilient: if a model file is missing, that slot is skipped
and the procedural fallback geometry remains visible.
