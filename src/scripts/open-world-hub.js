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

  const orrery = createOrrery(group);
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
    // Orrery animation (same motion as the district-era orrery update).
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
