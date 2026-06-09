import * as THREE from "three";
import { destinations, createSpriteLabel } from "./open-world-config.js";
import { createFresnelShell } from "./open-world-sky.js";

// A warp gate: portal ring + swirl disc + hologram of the destination
// planet + label. radius = interaction distance.
export const createWarpGate = (toKey, x, z, rotationY) => {
  const dest = destinations[toKey];
  const root = new THREE.Group();
  root.position.set(x, 0, z);
  root.rotation.y = rotationY;

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 2.0, 0.4, 8),
    new THREE.MeshStandardMaterial({ color: 0x0a0420, emissive: dest.accent, emissiveIntensity: 0.15, roughness: 0.5, metalness: 0.6 })
  );
  base.position.y = 0.2;

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.2, 0.12, 10, 40),
    new THREE.MeshStandardMaterial({ color: 0x0a0420, emissive: dest.accent, emissiveIntensity: 0.8, roughness: 0.2, metalness: 0.8 })
  );
  ring.position.y = 2.9;

  const swirl = new THREE.Mesh(
    new THREE.CircleGeometry(2.0, 32),
    new THREE.MeshBasicMaterial({ color: dest.accent, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
  );
  swirl.position.y = 2.9;

  const holo = new THREE.Group();
  if (dest.planet) {
    const mini = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 16, 12),
      new THREE.MeshStandardMaterial({ color: dest.planet.surfaceColor, emissive: dest.planet.emissive, emissiveIntensity: 0.6, roughness: 0.8 })
    );
    holo.add(mini, createFresnelShell(0.55, dest.planet.limbColor, 2.2));
  } else {
    const station = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.5, 0),
      new THREE.MeshStandardMaterial({ color: 0x14082a, emissive: 0xc8b0ff, emissiveIntensity: 0.7, roughness: 0.2, metalness: 0.7 })
    );
    holo.add(station);
  }
  holo.position.y = 5.2;

  const label = createSpriteLabel(dest.name, "#e0d8ff", { x: 2.8, y: 0.7 });
  if (label) { label.position.y = 6.6; root.add(label); }

  root.add(base, ring, swirl, holo);

  let charge = 0;
  const update = (dt, t) => {
    swirl.rotation.z += dt * (0.6 + charge * 4);
    holo.rotation.y += dt * 0.8;
    holo.position.y = 5.2 + Math.sin(t * 1.2 + x) * 0.15;
    ring.material.emissiveIntensity = 0.6 + Math.sin(t * 2 + z) * 0.2 + charge * 1.5;
    swirl.material.opacity = 0.14 + Math.sin(t * 2.4) * 0.04 + charge * 0.4;
  };

  return {
    key: toKey,
    title: `Warp to ${dest.name}`,
    root,
    radius: 3.4,
    update,
    setCharge: (v) => { charge = Math.min(1, Math.max(0, v)); },
    label
  };
};
