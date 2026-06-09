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
