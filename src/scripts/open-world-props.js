import * as THREE from "three";

// ── Landmark definitions ─────────────────────────────────────────
export const landmarkDefs = [
  {
    zone: "projects",
    title: "Forge Core",
    summary: "Stellar forge beacon. Ignite to overclock the fabrication crucible.",
    link: "/projects/",
    radius: 4.5,
    position: new THREE.Vector3(-38, 0, -10),
    build: (color) => {
      const group = new THREE.Group();
      // Molten core sphere
      const core = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1.3, 1),
        new THREE.MeshStandardMaterial({ color: 0x2a0a02, emissive: color, emissiveIntensity: 0.7, roughness: 0.15, metalness: 0.8, transparent: true, opacity: 0.9 })
      );
      core.position.y = 3.0;
      // Orbit rings (like an atom)
      for (let i = 0; i < 3; i += 1) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(2.2 + i * 0.3, 0.04, 8, 36),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55 - i * 0.1, blending: THREE.AdditiveBlending, depthWrite: false })
        );
        ring.position.y = 3.0;
        ring.rotation.x = Math.PI / 2 + i * 0.5;
        ring.rotation.y = i * 0.7;
        group.add(ring);
      }
      // Ember particles base
      const emberBase = new THREE.Mesh(
        new THREE.CylinderGeometry(1.8, 2.2, 0.4, 8),
        new THREE.MeshStandardMaterial({ color: 0x1a0602, emissive: color, emissiveIntensity: 0.15, roughness: 0.7, metalness: 0.4 })
      );
      emberBase.position.y = 0.2;
      group.add(core, emberBase);
      return group;
    }
  },
  {
    zone: "posts",
    title: "Relay Spire",
    summary: "Signal relay tower. Pulse to broadcast across all archive channels.",
    link: "/posts/",
    radius: 4.5,
    position: new THREE.Vector3(38, 0, -10),
    build: (color) => {
      const group = new THREE.Group();
      // Crystal spire
      const spire = new THREE.Mesh(
        new THREE.ConeGeometry(0.6, 7.5, 6),
        new THREE.MeshStandardMaterial({ color: 0x041420, emissive: color, emissiveIntensity: 0.35, roughness: 0.1, metalness: 0.9, transparent: true, opacity: 0.85 })
      );
      spire.position.y = 3.75;
      // Data rings orbiting the spire
      for (let i = 0; i < 4; i += 1) {
        const dataRing = new THREE.Mesh(
          new THREE.TorusGeometry(1.4 - i * 0.2, 0.03, 6, 20),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })
        );
        dataRing.position.y = 2.0 + i * 1.4;
        dataRing.rotation.x = Math.PI / 2;
        group.add(dataRing);
      }
      // Base dish
      const dish = new THREE.Mesh(
        new THREE.ConeGeometry(2.0, 0.8, 12),
        new THREE.MeshStandardMaterial({ color: 0x061018, emissive: color, emissiveIntensity: 0.12, roughness: 0.4, metalness: 0.6 })
      );
      dish.rotation.x = Math.PI;
      dish.position.y = 0.5;
      group.add(spire, dish);
      return group;
    }
  },
  {
    zone: "experiences",
    title: "Bloom Heart",
    summary: "Living memory core. Resonate to bloom the collected echoes.",
    link: "/experiences/",
    radius: 4.8,
    position: new THREE.Vector3(0, 0, -50),
    build: (color) => {
      const group = new THREE.Group();
      // Central tree trunk
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.7, 5.0, 7),
        new THREE.MeshStandardMaterial({ color: 0x0a1a06, emissive: color, emissiveIntensity: 0.15, roughness: 0.8, metalness: 0.1 })
      );
      trunk.position.y = 2.5;
      // Luminous canopy (sphere cluster)
      const canopyColors = [0x7dffb3, 0x40ff80, 0xb0ffe0];
      for (let i = 0; i < 5; i += 1) {
        const sphere = new THREE.Mesh(
          new THREE.SphereGeometry(0.8 + Math.random() * 0.6, 10, 8),
          new THREE.MeshStandardMaterial({
            color: 0x0a2010,
            emissive: canopyColors[i % canopyColors.length],
            emissiveIntensity: 0.5,
            roughness: 0.4,
            metalness: 0.2,
            transparent: true,
            opacity: 0.7
          })
        );
        const a = (i / 5) * Math.PI * 2;
        sphere.position.set(Math.cos(a) * 1.2, 5.0 + Math.sin(a) * 0.5, Math.sin(a) * 1.2);
        group.add(sphere);
      }
      // Root glow
      const rootGlow = new THREE.Mesh(
        new THREE.RingGeometry(0.8, 2.4, 24),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      rootGlow.rotation.x = -Math.PI / 2;
      rootGlow.position.y = 0.05;
      group.add(trunk, rootGlow);
      return group;
    }
  }
];

// ── Hub centerpiece: The Orrery ──────────────────────────────────
export const createOrrery = (scene) => {
  const group = new THREE.Group();
  group.position.set(0, 0, -6);

  // Central gravity well core
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.8, 1),
    new THREE.MeshStandardMaterial({
      color: 0x1a0840,
      emissive: 0xc8b0ff,
      emissiveIntensity: 0.9,
      roughness: 0.1,
      metalness: 0.9
    })
  );
  core.position.y = 3.2;
  group.add(core);

  // Celestial rings (3 nested, different axes)
  const ringSpecs = [
    { radius: 2.8, tube: 0.04, color: 0xc8b0ff, opacity: 0.6, rx: Math.PI / 2, ry: 0 },
    { radius: 3.6, tube: 0.03, color: 0x9080cc, opacity: 0.45, rx: Math.PI / 3, ry: Math.PI / 5 },
    { radius: 4.4, tube: 0.025, color: 0x7060aa, opacity: 0.35, rx: Math.PI / 7, ry: Math.PI / 3 },
  ];
  const rings = [];
  for (const spec of ringSpecs) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(spec.radius, spec.tube, 10, 48),
      new THREE.MeshBasicMaterial({
        color: spec.color,
        transparent: true,
        opacity: spec.opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    ring.position.y = 3.2;
    ring.rotation.x = spec.rx;
    ring.rotation.y = spec.ry;
    group.add(ring);
    rings.push(ring);
  }

  // Orbiting celestial bodies on the rings
  const orbitals = [];
  const orbitalColors = [0xff6b35, 0x00e5ff, 0x7dffb3];
  for (let i = 0; i < 3; i += 1) {
    const orbital = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 6),
      new THREE.MeshStandardMaterial({
        color: 0x0a0420,
        emissive: orbitalColors[i],
        emissiveIntensity: 0.8,
        roughness: 0.2,
        metalness: 0.5
      })
    );
    orbital.position.y = 3.2;
    group.add(orbital);
    orbitals.push({ mesh: orbital, radius: ringSpecs[i].radius, speed: 0.3 + i * 0.15, phase: i * 2.1 });
  }

  // Base pedestal
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 1.8, 0.5, 12),
    new THREE.MeshStandardMaterial({ color: 0x0a0420, emissive: 0xc8b0ff, emissiveIntensity: 0.1, roughness: 0.5, metalness: 0.5 })
  );
  pedestal.position.y = 0.25;
  group.add(pedestal);

  // Gravity well pool
  const pool = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 3.2, 48),
    new THREE.MeshBasicMaterial({
      color: 0xc8b0ff,
      transparent: true,
      opacity: 0.1,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.06;
  group.add(pool);

  // Cobble ring
  const cobble = new THREE.Mesh(
    new THREE.RingGeometry(3.8, 6.0, 48),
    new THREE.MeshStandardMaterial({ color: 0x0a0520, roughness: 0.88, metalness: 0.1 })
  );
  cobble.rotation.x = -Math.PI / 2;
  cobble.position.y = 0.02;
  group.add(cobble);

  scene.add(group);
  return { group, apex: core, waterGlow: pool, cobble, rings, orbitals };
};

// ── District props ───────────────────────────────────────────────

// Projects: Forge/industrial structures with ember glow
export const forgePropDefs = [
  // Smelting crucible
  (x, z) => { const g = new THREE.Group(); const crucible = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.1, 3, 8), new THREE.MeshStandardMaterial({ color: 0x1a0804, emissive: 0xff6b35, emissiveIntensity: 0.15, roughness: 0.7, metalness: 0.4 })); crucible.position.y = 1.5; const rim = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.1, 6, 16), new THREE.MeshBasicMaterial({ color: 0xff6b35, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })); rim.rotation.x = Math.PI / 2; rim.position.y = 3.0; const glow = new THREE.Mesh(new THREE.CircleGeometry(0.65, 12), new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })); glow.rotation.x = -Math.PI / 2; glow.position.y = 3.05; g.add(crucible, rim, glow); g.position.set(x, 0, z); return g; },
  // Hammer pylon
  (x, z) => { const g = new THREE.Group(); const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.3, 6, 0.3), new THREE.MeshStandardMaterial({ color: 0x120602, emissive: 0xff6b35, emissiveIntensity: 0.08, roughness: 0.6, metalness: 0.5 })); shaft.position.y = 3; const head = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.0, 0.8), new THREE.MeshStandardMaterial({ color: 0x1a0804, emissive: 0xff6b35, emissiveIntensity: 0.22, roughness: 0.5, metalness: 0.6 })); head.position.y = 6.3; g.add(shaft, head); g.position.set(x, 0, z); return g; },
  // Containment field
  (x, z) => { const g = new THREE.Group(); const base = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 0.4, 10), new THREE.MeshStandardMaterial({ color: 0x0e0402, roughness: 0.7, metalness: 0.4 })); base.position.y = 0.2; const field = new THREE.Mesh(new THREE.SphereGeometry(1.0, 12, 10), new THREE.MeshBasicMaterial({ color: 0xff6b35, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false, wireframe: true })); field.position.y = 1.8; const spark = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0), new THREE.MeshStandardMaterial({ color: 0x2a0802, emissive: 0xff8844, emissiveIntensity: 0.8, roughness: 0.15, metalness: 0.7 })); spark.position.y = 1.8; g.add(base, field, spark); g.position.set(x, 0, z); return g; },
  // Exhaust stack
  (x, z) => { const g = new THREE.Group(); const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 7 + Math.random() * 2, 8), new THREE.MeshStandardMaterial({ color: 0x100602, emissive: 0xff6b35, emissiveIntensity: 0.1, roughness: 0.75, metalness: 0.3 })); stack.position.y = stack.geometry.parameters.height * 0.5; const cap = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false })); cap.position.y = stack.geometry.parameters.height + 0.3; g.add(stack, cap); g.position.set(x, 0, z); return g; },
  // Cooling vent
  (x, z) => { const g = new THREE.Group(); const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.65, 5 + Math.random() * 2, 10), new THREE.MeshStandardMaterial({ color: 0x0e0602, emissive: 0xff6b35, emissiveIntensity: 0.08, roughness: 0.7, metalness: 0.35 })); const h = tower.geometry.parameters.height; tower.position.y = h / 2; const ring = new THREE.Mesh(new THREE.TorusGeometry(1.02, 0.06, 6, 16), new THREE.MeshBasicMaterial({ color: 0xff6b35, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })); ring.rotation.x = Math.PI / 2; ring.position.y = h; g.add(tower, ring); g.position.set(x, 0, z); return g; },
];

// Posts: Crystal/signal structures with cyan glow
export const signalPropDefs = [
  // Data crystal
  (x, z) => { const g = new THREE.Group(); const crystal = new THREE.Mesh(new THREE.ConeGeometry(0.5, 5 + Math.random() * 2, 5), new THREE.MeshStandardMaterial({ color: 0x041820, emissive: 0x00e5ff, emissiveIntensity: 0.3, roughness: 0.1, metalness: 0.85, transparent: true, opacity: 0.8 })); crystal.position.y = crystal.geometry.parameters.height * 0.5; g.add(crystal); g.position.set(x, 0, z); return g; },
  // Signal dish
  (x, z) => { const g = new THREE.Group(); const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 4.5, 6), new THREE.MeshStandardMaterial({ color: 0x061018, roughness: 0.5, metalness: 0.6 })); post.position.y = 2.25; const dish = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.15, 8, 20, Math.PI * 1.2), new THREE.MeshStandardMaterial({ color: 0x081822, emissive: 0x00e5ff, emissiveIntensity: 0.2, roughness: 0.3, metalness: 0.7 })); dish.position.y = 4.5; dish.rotation.x = -Math.PI / 3; g.add(post, dish); g.position.set(x, 0, z); return g; },
  // Holographic display
  (x, z) => { const g = new THREE.Group(); const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.15, 3.0, 6), new THREE.MeshStandardMaterial({ color: 0x061420, roughness: 0.5, metalness: 0.5 })); stand.position.y = 1.5; const holo = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.5), new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); holo.position.y = 3.8; g.add(stand, holo); g.position.set(x, 0, z); return g; },
  // Relay node
  (x, z) => { const g = new THREE.Group(); const node = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6, 0), new THREE.MeshStandardMaterial({ color: 0x081420, emissive: 0x00e5ff, emissiveIntensity: 0.5, roughness: 0.15, metalness: 0.8, transparent: true, opacity: 0.75 })); node.position.y = 2.5; const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.5, 4), new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false })); beam.position.y = 1.25; g.add(node, beam); g.position.set(x, 0, z); return g; },
  // Antenna array
  (x, z) => { const g = new THREE.Group(); for (let i = 0; i < 3; i += 1) { const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.08, 3.5 + Math.random() * 2, 4), new THREE.MeshStandardMaterial({ color: 0x0a1822, emissive: 0x00e5ff, emissiveIntensity: 0.12, roughness: 0.5, metalness: 0.6 })); ant.position.set((i - 1) * 0.8, ant.geometry.parameters.height * 0.5, 0); const tip = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false })); tip.position.set((i - 1) * 0.8, ant.geometry.parameters.height, 0); g.add(ant, tip); } g.position.set(x, 0, z); return g; },
];

// Experiences: Bioluminescent flora with mint/green glow
export const grovePropDefs = [
  // Luminous mushroom cluster
  (x, z) => { const g = new THREE.Group(); for (let i = 0; i < 3; i += 1) { const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 1.5 + Math.random() * 2, 6), new THREE.MeshStandardMaterial({ color: 0x0a1a08, roughness: 0.8, metalness: 0.1 })); const h = stem.geometry.parameters.height; stem.position.set((i - 1) * 0.6, h * 0.5, Math.random() * 0.4); const cap = new THREE.Mesh(new THREE.SphereGeometry(0.4 + Math.random() * 0.3, 8, 6), new THREE.MeshStandardMaterial({ color: 0x0a2010, emissive: 0x7dffb3, emissiveIntensity: 0.6, roughness: 0.4, metalness: 0.2, transparent: true, opacity: 0.8 })); cap.position.set((i - 1) * 0.6, h + 0.15, Math.random() * 0.4); cap.scale.y = 0.5; g.add(stem, cap); } g.position.set(x, 0, z); return g; },
  // Memory vine arch
  (x, z) => { const g = new THREE.Group(); const arch = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.12, 8, 20, Math.PI), new THREE.MeshStandardMaterial({ color: 0x0a1a08, emissive: 0x7dffb3, emissiveIntensity: 0.2, roughness: 0.7, metalness: 0.1 })); arch.rotation.z = Math.PI; arch.position.y = 3.6; const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.18, 3.6, 6), new THREE.MeshStandardMaterial({ color: 0x081a06, roughness: 0.8 })); postL.position.set(-1.8, 1.8, 0); const postR = postL.clone(); postR.position.x = 1.8; g.add(arch, postL, postR); g.position.set(x, 0, z); return g; },
  // Floating spore
  (x, z) => { const g = new THREE.Group(); const spore = new THREE.Mesh(new THREE.SphereGeometry(0.45 + Math.random() * 0.3, 10, 8), new THREE.MeshStandardMaterial({ color: 0x0a2814, emissive: 0x7dffb3, emissiveIntensity: 0.65, roughness: 0.2, metalness: 0.4, transparent: true, opacity: 0.85 })); spore.position.y = 2.5 + Math.random() * 1.5; spore.userData.bobPhase = Math.random() * Math.PI * 2; spore.userData.bobOrigin = spore.position.y; g.add(spore); g.position.set(x, 0, z); return g; },
  // Bioluminescent fern
  (x, z) => { const g = new THREE.Group(); for (let i = 0; i < 4; i += 1) { const frond = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.0 + Math.random(), 0.6), new THREE.MeshStandardMaterial({ color: 0x0a2210, emissive: 0x40ff80, emissiveIntensity: 0.3, roughness: 0.7, metalness: 0.05 })); frond.position.set((i - 1.5) * 0.5, frond.geometry.parameters.height * 0.5, 0); frond.rotation.z = (i - 1.5) * 0.15; g.add(frond); } g.position.set(x, 0, z); return g; },
  // Root crystal
  (x, z) => { const g = new THREE.Group(); const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.6 + Math.random() * 0.3, 0), new THREE.MeshStandardMaterial({ color: 0x0a2818, emissive: 0x7dffb3, emissiveIntensity: 0.55, roughness: 0.15, metalness: 0.5, transparent: true, opacity: 0.8 })); crystal.position.y = 1.2; crystal.rotation.y = Math.random() * Math.PI; const base = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 0.3, 8), new THREE.MeshStandardMaterial({ color: 0x081a0a, roughness: 0.85 })); base.position.y = 0.15; g.add(crystal, base); g.position.set(x, 0, z); return g; },
];


export const propDefsByBiome = { forge: forgePropDefs, signal: signalPropDefs, grove: grovePropDefs };

export const landmarkDefByZone = Object.fromEntries(landmarkDefs.map((d) => [d.zone, d]));

// Planet scenes place landmarks themselves; build a landmark structure only.
export const buildLandmark = (zone, color) => {
  const def = landmarkDefByZone[zone];
  const root = new THREE.Group();
  const structure = def.build(color);
  root.add(structure);
  return { zone: def.zone, title: def.title, summary: def.summary, link: def.link, radius: def.radius, root, structure, pulse: 0 };
};

// Per-frame landmark pulse (same motion as the district-era update).
export const updateLandmark = (landmark, dt, worldTicker) => {
  const clampLocal = (v, min, max) => Math.min(max, Math.max(min, v));
  landmark.structure.rotation.y += dt * 0.28;
  landmark.pulse = Math.max(0, landmark.pulse - dt * 0.65);
  const boost = 0.3 + Math.sin(worldTicker * 2.2) * 0.1 + landmark.pulse * 0.6;
  landmark.structure.children.forEach((child) => {
    if (child.material && "emissiveIntensity" in child.material) {
      child.material.emissiveIntensity = clampLocal(boost, 0.12, 1.2);
    }
  });
};

// Wisp NPC: ethereal drone that wanders a rectangle around (cx, cz).
export const createWisp = (scene, accent, cx, cz, hw, hd) => {
  const npc = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x404040, emissive: accent, emissiveIntensity: 0.4, roughness: 0.3, metalness: 0.5 })
  );
  body.position.y = 1.0;
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 6, 4),
    new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  glow.position.y = 1.0;
  npc.add(body, glow);
  npc.position.set(cx + (Math.random() * 2 - 1) * hw, 0, cz + (Math.random() * 2 - 1) * hd);
  scene.add(npc);
  const pickTarget = () => ({ x: cx + (Math.random() * 2 - 1) * hw, z: cz + (Math.random() * 2 - 1) * hd });
  return { mesh: npc, target: pickTarget(), speed: 1.8 + Math.random() * 1.2, waitTime: 0, pickTarget };
};

// Per-frame wisp wander (same motion as the district-era NPC update).
export const updateWisps = (wisps, dt, worldTicker) => {
  for (const npc of wisps) {
    if (npc.waitTime > 0) { npc.waitTime -= dt; continue; }
    const dx = npc.target.x - npc.mesh.position.x;
    const dz = npc.target.z - npc.mesh.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.5) {
      npc.target = npc.pickTarget();
      npc.waitTime = 1.5 + Math.random() * 2.5;
    } else {
      npc.mesh.position.x += (dx / dist) * npc.speed * dt;
      npc.mesh.position.z += (dz / dist) * npc.speed * dt;
    }
    npc.mesh.position.y = Math.sin(worldTicker * 2 + npc.mesh.position.x) * 0.15;
  }
};
