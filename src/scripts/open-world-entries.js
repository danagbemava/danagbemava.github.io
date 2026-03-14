import * as THREE from "three";
import { createSpriteLabel } from "./open-world-config.js";

/**
 * Builds a single entry node with the new aesthetic:
 * - Projects: Forge constructs (anvils, reactors, fabricators)
 * - Posts: Signal crystals (data towers, relay nodes, transmitters)
 * - Experiences: Living monuments (trees, orbs, arches)
 */
const addEntry = (scene, entry, kind, x, z, color, lowPower) => {
  const root = new THREE.Group();
  root.position.set(x, 0, z);

  const mat = (baseColor, emissiveInt = 0.2) => new THREE.MeshStandardMaterial({
    color: baseColor,
    emissive: color,
    emissiveIntensity: emissiveInt,
    roughness: 0.35,
    metalness: 0.55
  });

  const variant = Math.floor(Math.random() * 3);
  let pillar;

  if (kind === "projects") {
    if (variant === 0) {
      // Reactor chamber
      const group = new THREE.Group();
      const chamber = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 4.5, 8), mat(0x1a0804));
      chamber.position.y = 2.25;
      const viewport = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.08, 8, 20), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
      viewport.rotation.x = Math.PI / 2; viewport.position.y = 2.8;
      const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), mat(0x2a0a02, 0.6));
      core.position.y = 2.8;
      const cap = new THREE.Mesh(new THREE.ConeGeometry(1.5, 1.0, 8), mat(0x120602, 0.12));
      cap.position.y = 4.8;
      group.add(chamber, viewport, core, cap);
      pillar = group;
    } else if (variant === 1) {
      // Anvil forge
      const group = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.2, 2.2), mat(0x120602));
      base.position.y = 0.6;
      const anvil = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.6, 2.6), mat(0x1a0804, 0.15));
      anvil.position.y = 1.5;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 4.5, 0.5), mat(0x0e0402, 0.1));
      arm.position.set(1.2, 3.6, 0);
      const hammer = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 0.7), mat(0x1a0804, 0.25));
      hammer.position.set(0, 5.6, 0);
      const spark = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
      spark.position.set(0, 1.9, 0);
      group.add(base, anvil, arm, hammer, spark);
      pillar = group;
    } else {
      // Smelting tower
      const group = new THREE.Group();
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, 5.5, 6), mat(0x140602));
      tower.position.y = 2.75;
      const vent1 = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 1.5, 6), mat(0x1a0804, 0.2));
      vent1.position.set(0.9, 4.5, 0.4); vent1.rotation.z = 0.3;
      const vent2 = vent1.clone(); vent2.position.set(-0.8, 4.2, -0.3); vent2.rotation.z = -0.25;
      const glow = new THREE.Mesh(new THREE.CircleGeometry(0.7, 12), new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }));
      glow.rotation.x = -Math.PI / 2; glow.position.y = 5.6;
      group.add(tower, vent1, vent2, glow);
      pillar = group;
    }
  } else if (kind === "posts") {
    if (variant === 0) {
      // Data crystal cluster
      const group = new THREE.Group();
      const mainCrystal = new THREE.Mesh(new THREE.ConeGeometry(0.7, 6.0, 5), mat(0x041820, 0.35));
      mainCrystal.position.y = 3.0;
      const side1 = new THREE.Mesh(new THREE.ConeGeometry(0.4, 3.5, 5), mat(0x061420, 0.25));
      side1.position.set(0.8, 1.75, 0.3); side1.rotation.z = 0.15;
      const side2 = new THREE.Mesh(new THREE.ConeGeometry(0.35, 2.8, 5), mat(0x081822, 0.2));
      side2.position.set(-0.6, 1.4, -0.4); side2.rotation.z = -0.2;
      const halo = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.03, 6, 20), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
      halo.position.y = 4.5; halo.rotation.x = Math.PI / 2;
      group.add(mainCrystal, side1, side2, halo);
      pillar = group;
    } else if (variant === 1) {
      // Relay tower
      const group = new THREE.Group();
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.35, 5.5, 6), mat(0x061018));
      stem.position.y = 2.75;
      const dish = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.12, 8, 18, Math.PI * 1.3), mat(0x081420, 0.2));
      dish.position.y = 5.0; dish.rotation.x = -Math.PI / 2.5;
      const signal = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.4, 24), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      signal.position.y = 5.0; signal.rotation.x = Math.PI / 2;
      group.add(stem, dish, signal);
      pillar = group;
    } else {
      // Holographic terminal
      const group = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.4, 1.2), mat(0x081420));
      base.position.y = 0.2;
      const screen = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.2, 0.08), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      screen.position.y = 2.2;
      const frame = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3.4, 0.04), mat(0x0a1822, 0.15));
      frame.position.y = 2.2;
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
      dot.position.set(0, 3.5, 0.1);
      group.add(base, frame, screen, dot);
      pillar = group;
    }
  } else {
    // Experiences — living monuments
    if (variant === 0) {
      // Memory tree
      const group = new THREE.Group();
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.4, 4.5, 7),
        new THREE.MeshStandardMaterial({ color: 0x0a1a06, emissive: color, emissiveIntensity: 0.12, roughness: 0.8, metalness: 0.08 })
      );
      trunk.position.y = 2.25;
      // Canopy spheres
      for (let i = 0; i < 3; i += 1) {
        const leaf = new THREE.Mesh(
          new THREE.SphereGeometry(0.7 + Math.random() * 0.4, 8, 6),
          new THREE.MeshStandardMaterial({ color: 0x0a2810, emissive: color, emissiveIntensity: 0.45, roughness: 0.4, transparent: true, opacity: 0.75 })
        );
        const a = (i / 3) * Math.PI * 2 + Math.random() * 0.5;
        leaf.position.set(Math.cos(a) * 0.8, 4.5 + Math.sin(a) * 0.3, Math.sin(a) * 0.8);
        group.add(leaf);
      }
      const rootGlow = new THREE.Mesh(new THREE.RingGeometry(0.5, 1.5, 16), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending, depthWrite: false }));
      rootGlow.rotation.x = -Math.PI / 2; rootGlow.position.y = 0.05;
      group.add(trunk, rootGlow);
      pillar = group;
    } else if (variant === 1) {
      // Hovering memory orb
      const group = new THREE.Group();
      const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 1.0, 8), new THREE.MeshStandardMaterial({ color: 0x081a0a, roughness: 0.78, metalness: 0.12 }));
      pedestal.position.y = 0.5;
      const orb = new THREE.Mesh(
        new THREE.SphereGeometry(1.0, 16, 12),
        new THREE.MeshStandardMaterial({ color: 0x0a2818, emissive: color, emissiveIntensity: 0.55, roughness: 0.15, metalness: 0.5, transparent: true, opacity: 0.82 })
      );
      orb.position.y = 2.8;
      orb.userData.bobOrigin = 2.8;
      orb.userData.bobPhase = Math.random() * Math.PI * 2;
      const orbGlow = new THREE.Mesh(new THREE.SphereGeometry(1.2, 10, 8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false }));
      orbGlow.position.y = 2.8;
      orbGlow.userData.bobOrigin = 2.8;
      orbGlow.userData.bobPhase = orb.userData.bobPhase;
      group.add(pedestal, orb, orbGlow);
      pillar = group;
    } else {
      // Vine archway
      const group = new THREE.Group();
      const pMat = new THREE.MeshStandardMaterial({ color: 0x0a1a08, emissive: color, emissiveIntensity: 0.15, roughness: 0.75, metalness: 0.1 });
      const pL = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.35, 5.0, 7), pMat.clone());
      pL.position.set(-1.3, 2.5, 0); pL.rotation.z = 0.08;
      const pR = pL.clone(); pR.position.x = 1.3; pR.rotation.z = -0.08;
      const arch = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.2, 8, 20, Math.PI), new THREE.MeshStandardMaterial({ color: 0x0a2010, emissive: color, emissiveIntensity: 0.25, roughness: 0.5 }));
      arch.rotation.z = Math.PI; arch.position.y = 5.0;
      const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
      bloom.position.set(0, 5.5, 0);
      group.add(pL, pR, arch, bloom);
      pillar = group;
    }
  }

  pillar.castShadow = !lowPower;
  root.add(pillar);

  // Base glow ring
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.8, 0.05, 10, 36),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.06;
  root.add(ring);

  // Label
  const labelColor = kind === "posts" ? "#a0f0ff" : (kind === "projects" ? "#ffb090" : "#a0ffd0");
  const label = createSpriteLabel(entry.title || entry.role || "Entry", labelColor, { x: 3.2, y: 0.78 });
  if (label) {
    label.position.set(0, 7.2, 0);
    root.add(label);
  }

  root.userData = { kind, entry, interactionRadius: 3.8 };
  scene.add(root);
  return root;
};

/**
 * Creates all entry nodes and secret nodes.
 */
export const createEntries = (scene, projects, posts, experiences, lowPower) => {
  const entryMeshes = [];
  const blockers = [];

  projects.forEach((entry, idx) => {
    const row = Math.floor(idx / 3);
    const col = idx % 3;
    const x = -29 - col * 11.5;
    const z = -12 + row * 12;
    entryMeshes.push(addEntry(scene, entry, "projects", x, z, 0xff6b35, lowPower));
    blockers.push({ x, z, radius: 2.3 });
  });

  posts.forEach((entry, idx) => {
    const row = Math.floor(idx / 3);
    const col = idx % 3;
    const x = 30 + col * 11.5;
    const z = -11 + row * 12;
    entryMeshes.push(addEntry(scene, entry, "posts", x, z, 0x00e5ff, lowPower));
    blockers.push({ x, z, radius: 2.3 });
  });

  experiences.forEach((entry, idx) => {
    const x = -13 + idx * 13;
    const z = -45;
    entryMeshes.push(addEntry(scene, entry, "experiences", x, z, 0x7dffb3, lowPower));
    blockers.push({ x, z, radius: 2.3 });
  });

  // Secret nodes — glowing wireframe shards
  const secretNodes = [
    { key: "sky_shard", color: 0x7dffb3, pos: new THREE.Vector3(0, 1.8, -56) },
    { key: "data_shard", color: 0xff6b35, pos: new THREE.Vector3(-46, 1.7, -7) },
    { key: "timeline_echo", color: 0x00e5ff, pos: new THREE.Vector3(46, 1.75, -8) }
  ].map((secret) => {
    const mesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.7, 0),
      new THREE.MeshStandardMaterial({
        color: secret.color,
        emissive: secret.color,
        emissiveIntensity: 2.0,
        transparent: true,
        opacity: 0.7,
        wireframe: true
      })
    );
    mesh.position.copy(secret.pos);
    scene.add(mesh);
    return { ...secret, mesh };
  });

  return { entryMeshes, blockers, secretNodes };
};

/** Build a quick-look preview mesh. */
export const buildQuickMesh = (kind, color) => {
  const mat = new THREE.MeshStandardMaterial({
    color: 0x0a0420,
    emissive: color,
    emissiveIntensity: 0.3,
    roughness: 0.3,
    metalness: 0.55
  });
  if (kind === "projects") {
    const group = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 1.3, 8), mat.clone());
    base.position.y = 0.65;
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35, 0), mat.clone());
    core.position.y = 1.5;
    group.add(base, core);
    return group;
  }
  if (kind === "posts") {
    const group = new THREE.Group();
    const crystal = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.8, 5), mat.clone());
    crystal.position.y = 0.9;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.03, 6, 16), mat.clone());
    ring.position.y = 1.4; ring.rotation.x = Math.PI / 2;
    group.add(crystal, ring);
    return group;
  }
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.3, 1.0, 6), mat.clone());
  trunk.position.y = 0.5;
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), mat.clone());
  canopy.position.y = 1.3;
  group.add(trunk, canopy);
  return group;
};
