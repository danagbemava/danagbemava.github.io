import * as THREE from "three";
import { makePlaque } from "./experiences-plaque.js";

/**
 * @typedef {{ role: string, tenure: string, company: string, summary: string, activities: string[] }} Entry
 * @typedef {{ x: number, z: number, glowRing: THREE.Mesh, stand: THREE.Mesh, group: THREE.Group }} StatueSpot
 */

/**
 * Builds all experience pedestals, floating artifacts, mentor wisps, resonance
 * links, the curator sentinel, and the hidden data shard.
 *
 * @param {THREE.Scene} scene
 * @param {Entry[]} entries
 * @param {{ state: { discoveredSecrets: Record<string, boolean> } }} worldSnapshot
 * @returns {{
 *   clickable: THREE.Object3D[],
 *   statueSpots: StatueSpot[],
 *   collisionObjects: Array<{ x: number, z: number, radius: number }>,
 *   mentorWisps: Array<{ wisp: THREE.Mesh, spot: StatueSpot, angle: number, radius: number, speed: number, phase: number }>,
 *   resonanceLinks: Array<{ link: THREE.Mesh, phase: number }>,
 *   curatorSentinel: THREE.Group,
 *   sentinelCore: THREE.Mesh,
 *   sentinelRing: THREE.Mesh,
 *   sentinelPatrol: { z: number, speed: number, dir: number },
 *   shardGroup: THREE.Group,
 *   shardCollected: { value: boolean }
 * }}
 */
export const buildStatues = (scene, entries, worldSnapshot) => {
  const statueRoot = new THREE.Group();
  scene.add(statueRoot);

  const clickable = [];
  const statueSpots = [];
  const collisionObjects = [];

  entries.forEach((entry, index) => {
    const side = index % 2 === 0 ? -1 : 1;
    const z = -14 - index * 20;
    const x = side * 8;

    // ── Pedestal ─────────────────────────────────────────────────────────
    const stand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 1.1, 1.6, 6),
      new THREE.MeshStandardMaterial({
        color: 0x0a1f18,
        roughness: 0.2,
        metalness: 0.9,
        flatShading: true
      })
    );
    stand.position.set(x, 0.8, z);
    statueRoot.add(stand);

    const pedestalRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.85, 0.04, 12, 6),
      new THREE.MeshStandardMaterial({
        color: 0x6de2bc,
        emissive: 0x6de2bc,
        emissiveIntensity: 1.0
      })
    );
    pedestalRing.rotation.x = Math.PI / 2;
    pedestalRing.rotation.z = Math.PI / 6;
    pedestalRing.position.set(x, 1.55, z);
    statueRoot.add(pedestalRing);

    // ── Floating artifact ─────────────────────────────────────────────────
    const statueGroup = new THREE.Group();
    statueGroup.position.set(x, 3.2, z);
    statueRoot.add(statueGroup);

    const outerGeo = new THREE.IcosahedronGeometry(0.9, 0);
    const outerMat = new THREE.MeshBasicMaterial({
      color: 0x6de2bc,
      wireframe: true,
      transparent: true,
      opacity: 0.3
    });
    const shell = new THREE.Mesh(outerGeo, outerMat);
    statueGroup.add(shell);

    const innerGeo = new THREE.OctahedronGeometry(0.4, 0);
    const innerMat = new THREE.MeshStandardMaterial({
      color: 0x4fbb99,
      emissive: 0x2fa57d,
      emissiveIntensity: 0.8,
      roughness: 0.2,
      metalness: 1.0,
      flatShading: true
    });
    const core = new THREE.Mesh(innerGeo, innerMat);
    statueGroup.add(core);

    const light = new THREE.PointLight(0x6de2bc, 2, 8);
    statueGroup.add(light);

    const particleGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06);
    const particleMat = new THREE.MeshBasicMaterial({ color: 0xcaffef });
    for (let p = 0; p < 5; p++) {
      const particle = new THREE.Mesh(particleGeo, particleMat);
      particle.position.set(
        (Math.random() - 0.5) * 2.0,
        (Math.random() - 0.5) * 2.0,
        (Math.random() - 0.5) * 2.0
      );
      statueGroup.add(particle);
    }

    // ── Glow ring on ground ───────────────────────────────────────────────
    const glowRing = new THREE.Mesh(
      new THREE.RingGeometry(1.6, 1.8, 32),
      new THREE.MeshBasicMaterial({
        color: 0x6de2bc,
        transparent: true,
        opacity: 0.1,
        side: THREE.DoubleSide
      })
    );
    glowRing.rotation.x = -Math.PI / 2;
    glowRing.position.set(x, 0.05, z);
    statueRoot.add(glowRing);

    // ── Plaque ────────────────────────────────────────────────────────────
    const plaque = makePlaque(entry.role, entry.tenure);
    if (plaque) {
      plaque.position.set(x, 1.4, z + 1.2);
      plaque.rotation.x = -Math.PI / 8;
      plaque.rotation.y = side < 0 ? Math.PI / 12 : -Math.PI / 12;
      statueRoot.add(plaque);
    }

    stand.userData.entryIndex = index;
    shell.userData.entryIndex = index;
    core.userData.entryIndex = index;

    clickable.push(stand, shell, core);
    statueSpots.push({ x, z, glowRing, stand, group: statueGroup });
    collisionObjects.push({ x, z, radius: 2.2 });
  });

  // ── Mentor wisps ──────────────────────────────────────────────────────────
  const mentorWisps = statueSpots.map((spot, index) => {
    const wisp = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xb6ffe5, transparent: true, opacity: 0.6 })
    );
    scene.add(wisp);
    return {
      wisp,
      spot,
      angle: (index / Math.max(1, statueSpots.length)) * Math.PI * 2,
      radius: 1.4 + Math.random() * 0.9,
      speed: 0.8 + Math.random() * 0.7,
      phase: Math.random() * Math.PI * 2
    };
  });

  // ── Resonance links ───────────────────────────────────────────────────────
  const resonanceLinks = [];
  for (let i = 0; i < statueSpots.length - 1; i += 1) {
    const a = statueSpots[i];
    const b = statueSpots[i + 1];
    const dist = Math.hypot(b.x - a.x, b.z - a.z);
    const link = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, dist, 8, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x6de2bc, transparent: true, opacity: 0.1 })
    );
    link.position.set((a.x + b.x) * 0.5, 1.3, (a.z + b.z) * 0.5);
    link.rotation.x = Math.PI / 2;
    link.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
    scene.add(link);
    resonanceLinks.push({ link, phase: Math.random() * Math.PI * 2 });
  }

  // ── Curator sentinel ──────────────────────────────────────────────────────
  const curatorSentinel = new THREE.Group();
  const sentinelCore = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.28, 0),
    new THREE.MeshStandardMaterial({
      color: 0xa9ffe0,
      emissive: 0x4fbb99,
      emissiveIntensity: 1.0,
      roughness: 0.24,
      metalness: 0.6
    })
  );
  const sentinelRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.42, 0.02, 10, 32),
    new THREE.MeshBasicMaterial({ color: 0x8ffff0, transparent: true, opacity: 0.5 })
  );
  sentinelRing.rotation.x = Math.PI / 2;
  curatorSentinel.add(sentinelCore);
  curatorSentinel.add(sentinelRing);
  scene.add(curatorSentinel);

  const sentinelPatrol = { z: 12, speed: 8.5, dir: -1 };

  // ── Hidden data shard ─────────────────────────────────────────────────────
  const shardGroup = new THREE.Group();
  shardGroup.position.set(0, 2.5, -160);
  scene.add(shardGroup);

  const shardMesh = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.6, 0),
    new THREE.MeshStandardMaterial({
      color: 0xffab40,
      emissive: 0xff9100,
      emissiveIntensity: 2,
      transparent: true,
      opacity: 0.8,
      wireframe: true
    })
  );
  shardGroup.add(shardMesh);

  const shardLight = new THREE.PointLight(0xff9100, 2, 10);
  shardGroup.add(shardLight);

  // Use an object reference so the animation loop can mutate the flag
  const shardCollected = { value: !!worldSnapshot.state.discoveredSecrets.data_shard };
  if (shardCollected.value) {
    scene.remove(shardGroup);
  }

  return {
    clickable,
    statueSpots,
    collisionObjects,
    mentorWisps,
    resonanceLinks,
    curatorSentinel,
    sentinelCore,
    sentinelRing,
    sentinelPatrol,
    shardGroup,
    shardCollected
  };
};
