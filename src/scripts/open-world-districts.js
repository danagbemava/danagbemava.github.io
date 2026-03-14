import * as THREE from "three";
import { districtConfig, createSpriteLabel } from "./open-world-config.js";
import { DISTRICT_ASSET_CATALOG } from "./world-assets.js";
import { getGltfLoader } from "./open-world-config.js";

// ── Floating island ground plates ────────────────────────────────
const addGroundPlate = (scene, zone, width, depth, color, rotation = 0) => {
  const cfg = districtConfig[zone];
  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.18, depth),
    new THREE.MeshStandardMaterial({
      color,
      emissive: cfg.color,
      emissiveIntensity: 0.05,
      roughness: 0.85,
      metalness: 0.15,
      transparent: true,
      opacity: 0.75
    })
  );
  plate.position.set(cfg.center.x, 0.04, cfg.center.z + 1.8);
  plate.rotation.y = rotation;
  scene.add(plate);
  return plate;
};

// ── Energy barrier enclosures (translucent force fields) ─────────
const addDistrictEnclosure = (scene, zone, width, depth, rot = 0) => {
  const cfg = districtConfig[zone];
  const group = new THREE.Group();
  group.position.set(cfg.center.x, 0, cfg.center.z + 1.8);
  group.rotation.y = rot;

  const barrierMat = new THREE.MeshBasicMaterial({
    color: cfg.color,
    transparent: true,
    opacity: 0.06,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });

  const wallH = 3.5;
  const xHalf = width * 0.5;
  const zHalf = depth * 0.5;

  // Translucent barrier walls (very subtle)
  const left = new THREE.Mesh(new THREE.PlaneGeometry(depth, wallH), barrierMat.clone());
  left.position.set(-xHalf, wallH * 0.5, 0);
  left.rotation.y = Math.PI / 2;
  const right = new THREE.Mesh(new THREE.PlaneGeometry(depth, wallH), barrierMat.clone());
  right.position.set(xHalf, wallH * 0.5, 0);
  right.rotation.y = Math.PI / 2;
  const back = new THREE.Mesh(new THREE.PlaneGeometry(width, wallH), barrierMat.clone());
  back.position.set(0, wallH * 0.5, -zHalf);

  // Gate opening — no front walls, just corner pylons
  const pylonGeo = new THREE.CylinderGeometry(0.15, 0.2, wallH + 1, 6);
  const pylonMat = new THREE.MeshStandardMaterial({
    color: 0x0a0420,
    emissive: cfg.color,
    emissiveIntensity: 0.35,
    roughness: 0.3,
    metalness: 0.7
  });
  const corners = [[-xHalf, zHalf], [xHalf, zHalf], [-xHalf, -zHalf], [xHalf, -zHalf]];
  for (const [cx, cz] of corners) {
    const pylon = new THREE.Mesh(pylonGeo, pylonMat.clone());
    pylon.position.set(cx, (wallH + 1) * 0.5, cz);
    group.add(pylon);
  }

  // Gate energy arc
  const gate = Math.max(4.8, width * 0.28);
  const gateGlow = new THREE.Mesh(
    new THREE.TorusGeometry(gate * 0.38, 0.05, 8, 32, Math.PI),
    new THREE.MeshBasicMaterial({
      color: cfg.color,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  gateGlow.rotation.set(-Math.PI / 2, 0, Math.PI);
  gateGlow.position.set(0, 0.15, zHalf);

  group.add(left, right, back, gateGlow);
  scene.add(group);
  return { zone, group, walls: [left, right, back], gateGlow };
};

// ── Gateway portals ──────────────────────────────────────────────
const gatewayBuilders = {
  projects: (color) => {
    const group = new THREE.Group();
    // Anvil-shaped portal
    const anvil = new THREE.Mesh(
      new THREE.BoxGeometry(5.2, 0.6, 2.4),
      new THREE.MeshStandardMaterial({ color: 0x1a0804, emissive: color, emissiveIntensity: 0.25, roughness: 0.6, metalness: 0.5 })
    );
    anvil.position.y = 1.8;
    const pillarL = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 3.8, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x120602, emissive: color, emissiveIntensity: 0.2, roughness: 0.5, metalness: 0.6 })
    );
    pillarL.position.set(-2.4, 1.9, 0);
    const pillarR = pillarL.clone();
    pillarR.position.x = 2.4;
    // Ember sparks ring
    const sparkRing = new THREE.Mesh(
      new THREE.TorusGeometry(2.6, 0.04, 6, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    sparkRing.position.y = 2.2;
    sparkRing.rotation.x = Math.PI / 2;
    group.add(anvil, pillarL, pillarR, sparkRing);
    return group;
  },
  posts: (color) => {
    const group = new THREE.Group();
    // Crystal archway
    const crystalL = new THREE.Mesh(
      new THREE.ConeGeometry(0.4, 5.5, 5),
      new THREE.MeshStandardMaterial({ color: 0x041018, emissive: color, emissiveIntensity: 0.3, roughness: 0.15, metalness: 0.8, transparent: true, opacity: 0.85 })
    );
    crystalL.position.set(-2.0, 2.75, 0);
    const crystalR = crystalL.clone();
    crystalR.position.x = 2.0;
    const bridge = new THREE.Mesh(
      new THREE.BoxGeometry(4.4, 0.12, 0.5),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    bridge.position.y = 4.8;
    // Signal ring
    const signalRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.8, 0.03, 6, 24),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    signalRing.position.y = 3.5;
    signalRing.rotation.x = Math.PI / 4;
    group.add(crystalL, crystalR, bridge, signalRing);
    return group;
  },
  experiences: (color) => {
    const group = new THREE.Group();
    // Living arch — organic trunk shapes
    const trunkL = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.45, 4.8, 8),
      new THREE.MeshStandardMaterial({ color: 0x0a1a08, emissive: color, emissiveIntensity: 0.2, roughness: 0.75, metalness: 0.1 })
    );
    trunkL.position.set(-1.6, 2.4, 0);
    trunkL.rotation.z = 0.12;
    const trunkR = trunkL.clone();
    trunkR.position.x = 1.6;
    trunkR.rotation.z = -0.12;
    // Canopy arc
    const canopy = new THREE.Mesh(
      new THREE.TorusGeometry(1.7, 0.35, 8, 24, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0x0a2010, emissive: color, emissiveIntensity: 0.3, roughness: 0.6, metalness: 0.15 })
    );
    canopy.rotation.z = Math.PI;
    canopy.position.y = 4.8;
    // Spore glow
    const sporeGlow = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 8, 6),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    sporeGlow.position.set(0, 5.2, 0);
    group.add(trunkL, trunkR, canopy, sporeGlow);
    return group;
  }
};

// ── Landmark definitions ─────────────────────────────────────────
const landmarkDefs = [
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
const createOrrery = (scene) => {
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

// ── Navigation tether paths ──────────────────────────────────────
const addRoute = (scene, zone) => {
  const cfg = districtConfig[zone];
  const points = [
    new THREE.Vector3(0, 0.08, 0.6),
    new THREE.Vector3(cfg.center.x * 0.35, 0.08, cfg.center.z * 0.35),
    new THREE.Vector3(cfg.center.x * 0.7, 0.08, cfg.center.z * 0.7),
    new THREE.Vector3(cfg.center.x, 0.08, cfg.center.z + 4.6)
  ];
  const curve = new THREE.CatmullRomCurve3(points);
  // Dotted path effect (segmented)
  const path = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 50, 0.2, 6, false),
    new THREE.MeshBasicMaterial({
      color: cfg.color,
      transparent: true,
      opacity: 0.1,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  scene.add(path);
  return path;
};

// ── Lore pylons ──────────────────────────────────────────────────
const addLorePylon = (scene, zone, text, offset) => {
  const cfg = districtConfig[zone];
  const pylon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.25, 2.8, 6),
    new THREE.MeshStandardMaterial({
      color: 0x0a0420,
      emissive: cfg.color,
      emissiveIntensity: 0.3,
      roughness: 0.35,
      metalness: 0.55
    })
  );
  pylon.position.set(cfg.center.x + offset.x, 1.4, cfg.center.z + offset.z);
  scene.add(pylon);

  const loreLabel = createSpriteLabel(text, "#e0d8ff", { x: 3.4, y: 0.62 });
  if (loreLabel) {
    loreLabel.position.set(pylon.position.x, 3.5, pylon.position.z);
    scene.add(loreLabel);
  }
};

// ── District props ───────────────────────────────────────────────

// Projects: Forge/industrial structures with ember glow
const forgePropDefs = [
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
const signalPropDefs = [
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
const grovePropDefs = [
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

const projPositions = [[-46,-11],[-43,-8],[-40,-14],[-50,-8],[-52,-12],[-44,-5],[-48,-15],[-41,-9],[-55,-10],[-38,-13],[-47,-6],[-53,-7]];
const postsPositions = [[32,-14],[35,-10],[38,-17],[41,-12],[44,-8],[36,-7],[42,-15],[34,-5],[46,-11],[39,-4],[30,-9],[43,-16]];
const gardenPositions = [[-9,-51],[-5,-47],[0,-53],[5,-47],[10,-51],[-14,-47],[-7,-44],[3,-55],[8,-44],[-12,-53],[1,-44],[12,-47]];

// ── NPC definitions ──────────────────────────────────────────────
const npcDefs = [
  { zone: "projects", cx: -38, cz: 0, hw: 13, hd: 12 },
  { zone: "projects", cx: -38, cz: 0, hw: 13, hd: 12 },
  { zone: "projects", cx: -38, cz: 0, hw: 13, hd: 12 },
  { zone: "posts",    cx:  38, cz: 0, hw: 13, hd: 11 },
  { zone: "posts",    cx:  38, cz: 0, hw: 13, hd: 11 },
  { zone: "posts",    cx:  38, cz: 0, hw: 13, hd: 11 },
  { zone: "experiences", cx: 0, cz: -38, hw: 11, hd: 13 },
  { zone: "experiences", cx: 0, cz: -38, hw: 11, hd: 13 },
  { zone: "experiences", cx: 0, cz: -38, hw: 11, hd: 13 }
];
// NPCs styled as ethereal wisps/drones per zone
const npcZoneColors = {
  projects: [0x804020, 0x6a3018, 0x904828],
  posts: [0x206880, 0x185060, 0x2880a0],
  experiences: [0x208040, 0x186830, 0x28a050]
};

/**
 * Builds all district structures.
 */
export const createDistricts = (scene, lowPower, onAssetLoaded) => {
  const districtGroundPlates = [
    addGroundPlate(scene, "projects", 30, 20, 0x0e0402, Math.PI * 0.08),
    addGroundPlate(scene, "posts", 30, 18, 0x040e14, -Math.PI * 0.06),
    addGroundPlate(scene, "experiences", 24, 24, 0x041a0a, Math.PI * 0.03)
  ];

  const districtEnclosures = [
    addDistrictEnclosure(scene, "projects", 34, 28, Math.PI * 0.08),
    addDistrictEnclosure(scene, "posts", 34, 26, -Math.PI * 0.07),
    addDistrictEnclosure(scene, "experiences", 28, 30, Math.PI * 0.03)
  ];

  // District markers
  const districtMarkers = [];
  for (const key of Object.keys(districtConfig)) {
    const district = districtConfig[key];
    const marker = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 0.14, 18),
      new THREE.MeshStandardMaterial({ color: district.color, emissive: district.color, emissiveIntensity: 0.5, transparent: true, opacity: 0.7 })
    );
    marker.position.set(district.center.x, 0.16, district.center.z);
    scene.add(marker);
    districtMarkers.push(marker);

    const label = createSpriteLabel(district.title.replace("Sector: ", ""), "#e0d8ff", { x: 3.6, y: 0.95 });
    if (label) {
      label.position.set(district.center.x, 2.4, district.center.z);
      scene.add(label);
    }
  }

  // District pads (holographic landing zones)
  const districtPads = [];
  const addPad = (zone, geometry, y = 0.05, opacity = 0.15) => {
    const cfg = districtConfig[zone];
    const pad = new THREE.Mesh(geometry,
      new THREE.MeshBasicMaterial({ color: cfg.color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(cfg.center.x, y, cfg.center.z);
    scene.add(pad);
    districtPads.push(pad);
  };
  addPad("home", new THREE.RingGeometry(3.2, 5.3, 48), 0.05, 0.12);
  addPad("projects", new THREE.RingGeometry(4.8, 8.2, 6), 0.05, 0.14);
  addPad("posts", new THREE.RingGeometry(4.4, 7.7, 32), 0.05, 0.14);
  addPad("experiences", new THREE.RingGeometry(4.2, 7.3, 12), 0.05, 0.16);

  // Routes
  const navigationRoutes = ["projects", "posts", "experiences"].map((z) => addRoute(scene, z));

  // Pylons
  addLorePylon(scene, "projects", "Stellar Forge", { x: -5.8, z: 4.8 });
  addLorePylon(scene, "posts", "Signal Array", { x: 6.2, z: 5.6 });
  addLorePylon(scene, "experiences", "Memory Grove", { x: 5.7, z: -2.4 });

  // Gateways
  const districtGateways = [];
  for (const zone of ["projects", "posts", "experiences"]) {
    const cfg = districtConfig[zone];
    const group = new THREE.Group();
    group.position.set(cfg.center.x, 0, cfg.center.z + 11.5);
    group.add(gatewayBuilders[zone](cfg.color));
    scene.add(group);
    districtGateways.push(group);
  }

  // Landmarks
  const districtLandmarks = [];
  for (const def of landmarkDefs) {
    const root = new THREE.Group();
    root.position.copy(def.position);
    const structure = def.build(districtConfig[def.zone].color);
    root.add(structure);
    scene.add(root);
    districtLandmarks.push({ zone: def.zone, title: def.title, summary: def.summary, link: def.link, radius: def.radius, root, structure, pulse: 0 });
  }

  // Orrery (hub centerpiece)
  const fountain = createOrrery(scene);

  // Particle orbiters
  const particleOrbiters = [];
  const particleGeometries = [
    new THREE.BoxGeometry(0.15, 0.15, 0.15),
    new THREE.TetrahedronGeometry(0.12, 0),
    new THREE.OctahedronGeometry(0.1, 0)
  ];
  const particlesPerLandmark = lowPower ? 6 : 12;

  for (const landmark of districtLandmarks) {
    const color = districtConfig[landmark.zone].color;
    for (let i = 0; i < particlesPerLandmark; i += 1) {
      const mesh = new THREE.Mesh(
        particleGeometries[i % particleGeometries.length],
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      const orbitRadius = 2.2 + (i % 3) * 1.1;
      const orbitPhase = (i / particlesPerLandmark) * Math.PI * 2;
      const yOffset = 1.8 + (i % 3) * 0.9;
      mesh.position.set(
        landmark.root.position.x + Math.cos(orbitPhase) * orbitRadius,
        yOffset,
        landmark.root.position.z + Math.sin(orbitPhase) * orbitRadius
      );
      scene.add(mesh);
      particleOrbiters.push({
        mesh, center: landmark.root.position, landmark,
        radius: orbitRadius, speed: 0.4 + (i % 4) * 0.15, phase: orbitPhase,
        yBase: yOffset, yAmp: 0.3 + (i % 2) * 0.2, spinSpeed: 1.2 + Math.random() * 2
      });
    }
  }

  // Orrery particles
  const spireParticleCount = lowPower ? 4 : 8;
  for (let i = 0; i < spireParticleCount; i += 1) {
    const mesh = new THREE.Mesh(
      particleGeometries[i % particleGeometries.length],
      new THREE.MeshBasicMaterial({ color: 0xc8b0ff, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    const orbitRadius = 2.6 + (i % 3) * 0.8;
    const orbitPhase = (i / spireParticleCount) * Math.PI * 2;
    mesh.position.set(
      fountain.group.position.x + Math.cos(orbitPhase) * orbitRadius,
      2.8 + (i % 3) * 0.7,
      fountain.group.position.z + Math.sin(orbitPhase) * orbitRadius
    );
    scene.add(mesh);
    particleOrbiters.push({
      mesh, center: fountain.group.position, landmark: null,
      radius: orbitRadius, speed: 0.35 + (i % 3) * 0.12, phase: orbitPhase,
      yBase: 2.8 + (i % 3) * 0.7, yAmp: 0.4, spinSpeed: 1.5 + Math.random() * 1.5
    });
  }

  // District props
  const districtProps = [];
  projPositions.forEach(([px, pz], i) => { const p = forgePropDefs[i % forgePropDefs.length](px, pz); scene.add(p); districtProps.push(p); });
  postsPositions.forEach(([px, pz], i) => { const p = signalPropDefs[i % signalPropDefs.length](px, pz); scene.add(p); districtProps.push(p); });
  gardenPositions.forEach(([px, pz], i) => { const p = grovePropDefs[i % grovePropDefs.length](px, pz); scene.add(p); districtProps.push(p); });

  // NPCs (wisp-like drones)
  const npcData = [];
  npcDefs.forEach((def, i) => {
    const npc = new THREE.Group();
    const zoneColors = npcZoneColors[def.zone] || [0x404040];
    const col = zoneColors[i % zoneColors.length];
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 6),
      new THREE.MeshStandardMaterial({ color: col, emissive: districtConfig[def.zone].color, emissiveIntensity: 0.3, roughness: 0.3, metalness: 0.5 })
    );
    body.position.y = 1.0;
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 6, 4),
      new THREE.MeshBasicMaterial({ color: districtConfig[def.zone].color, transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    glow.position.y = 1.0;
    npc.add(body, glow);
    const startX = def.cx + (Math.random() * 2 - 1) * def.hw;
    const startZ = def.cz + (Math.random() * 2 - 1) * def.hd;
    npc.position.set(startX, 0, startZ);
    scene.add(npc);
    const pickTarget = () => ({ x: def.cx + (Math.random() * 2 - 1) * def.hw, z: def.cz + (Math.random() * 2 - 1) * def.hd });
    npcData.push({ mesh: npc, target: pickTarget(), speed: 1.8 + Math.random() * 1.2, waitTime: 0, cx: def.cx, cz: def.cz, hw: def.hw, hd: def.hd, pickTarget });
  });

  // Scanning energy rings
  const scanRings = [];
  if (!lowPower) {
    for (const zone of ["projects", "posts", "experiences"]) {
      const cfg = districtConfig[zone];
      for (let i = 0; i < 2; i += 1) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(8 + i * 4, 0.03, 8, 48),
          new THREE.MeshBasicMaterial({ color: cfg.color, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(cfg.center.x, 0.12 + i * 0.06, cfg.center.z);
        scene.add(ring);
        scanRings.push({ mesh: ring, zone, baseOpacity: 0.1 - i * 0.025, speed: 0.6 + i * 0.3, phase: i * Math.PI });
      }
    }
  }

  // Circuit lines
  const circuitLines = [];
  for (const zone of ["projects", "posts", "experiences"]) {
    const cfg = districtConfig[zone];
    const dir = cfg.center.clone().normalize();
    const segCount = lowPower ? 4 : 8;
    for (let i = 0; i < segCount; i += 1) {
      const t = (i + 1) / (segCount + 1);
      const seg = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.03, 0.5),
        new THREE.MeshBasicMaterial({ color: cfg.color, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      seg.position.set(dir.x * t * cfg.center.length() * 0.85, 0.03, dir.z * t * cfg.center.length() * 0.85);
      seg.rotation.y = Math.atan2(dir.x, dir.z);
      scene.add(seg);
      circuitLines.push({ mesh: seg, index: i, total: segCount, zone });
    }
  }

  // GLB assets
  const districtAssetModels = [];
  const districtAssetRoots = {};
  for (const zone of ["projects", "posts", "experiences"]) {
    const cfg = districtConfig[zone];
    const root = new THREE.Group();
    root.position.set(cfg.center.x, 0, cfg.center.z + 1.8);
    scene.add(root);
    districtAssetRoots[zone] = root;
  }
  const allAssetSpecs = Object.entries(DISTRICT_ASSET_CATALOG).flatMap(([zone, list]) => (list || []).map((spec) => ({ zone, spec })));
  const mountDistrictAsset = (zone, spec) => {
    const parent = districtAssetRoots[zone];
    if (!parent || !spec) { onAssetLoaded(); return; }
    getGltfLoader().then((loader) => {
      if (!loader) { onAssetLoaded(); return; }
      loader.load(spec.url, (gltf) => {
        const node = gltf.scene;
        node.position.set(spec.position[0], spec.position[1], spec.position[2]);
        const scale = typeof spec.scale === "number" ? spec.scale : 1;
        node.scale.set(scale, scale, scale);
        node.rotation.y = spec.rotationY || 0;
        node.traverse((child) => { if (child.isMesh) { child.castShadow = !lowPower; child.receiveShadow = !lowPower; } });
        parent.add(node);
        districtAssetModels.push(node);
        onAssetLoaded();
      }, undefined, () => { onAssetLoaded(); });
    });
  };
  for (const { zone, spec } of allAssetSpecs) mountDistrictAsset(zone, spec);

  return {
    districtGroundPlates, districtEnclosures, districtMarkers, districtGateways,
    districtLandmarks, fountain, particleOrbiters, districtProps,
    npcData, scanRings, circuitLines, navigationRoutes, districtAssetModels,
    assetCount: allAssetSpecs.length
  };
};

/** Per-frame district animations. */
export const updateDistricts = (districts, scene, dt, worldTicker, currentZone) => {
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  for (let i = 0; i < districts.districtMarkers.length; i += 1) {
    districts.districtMarkers[i].material.emissiveIntensity = 0.4 + Math.sin(worldTicker * 2 + i) * 0.12;
  }

  for (let i = 0; i < districts.districtGateways.length; i += 1) {
    districts.districtGateways[i].children.forEach((child) => {
      if (child.rotation) child.rotation.y += dt * (0.04 + i * 0.01);
    });
  }

  for (let i = 0; i < districts.districtGroundPlates.length; i += 1) {
    districts.districtGroundPlates[i].material.emissiveIntensity = 0.04 + Math.sin(worldTicker * 1.3 + i * 0.7) * 0.02;
  }

  for (let i = 0; i < districts.navigationRoutes.length; i += 1) {
    districts.navigationRoutes[i].material.opacity = 0.06 + Math.sin(worldTicker * 1.8 + i * 0.8) * 0.04;
  }

  for (let i = 0; i < districts.districtEnclosures.length; i += 1) {
    const enc = districts.districtEnclosures[i];
    enc.gateGlow.material.opacity = 0.35 + Math.sin(worldTicker * 2 + i) * 0.15;
    enc.gateGlow.rotation.z += dt * 0.4;
    const active = enc.zone === currentZone;
    for (const wall of enc.walls) {
      wall.material.opacity += ((active ? 0.1 : 0.04) - wall.material.opacity) * Math.min(1, dt * 2.2);
    }
  }

  // Landmarks
  for (const landmark of districts.districtLandmarks) {
    landmark.structure.rotation.y += dt * 0.28;
    landmark.pulse = Math.max(0, landmark.pulse - dt * 0.65);
    const boost = 0.3 + Math.sin(worldTicker * 2.2) * 0.1 + landmark.pulse * 0.6;
    landmark.structure.children.forEach((child) => {
      if (child.material && "emissiveIntensity" in child.material) {
        child.material.emissiveIntensity = clamp(boost, 0.12, 1.2);
      }
    });
  }

  // Orrery animation
  const { apex, waterGlow, cobble, rings, orbitals } = districts.fountain;
  apex.rotation.y += dt * 0.6;
  apex.rotation.x += dt * 0.2;
  apex.material.emissiveIntensity = 0.7 + Math.sin(worldTicker * 1.5) * 0.2;
  waterGlow.material.opacity = 0.08 + Math.sin(worldTicker * 1.2) * 0.04;
  cobble.rotation.z += dt * 0.08;

  if (rings) {
    for (let i = 0; i < rings.length; i += 1) {
      const dir = i % 2 === 0 ? 1 : -1;
      rings[i].rotation.x += dt * (0.3 + i * 0.12) * dir;
      rings[i].rotation.z += dt * (0.15 + i * 0.08);
      rings[i].material.opacity = (0.5 - i * 0.08) + Math.sin(worldTicker * 2 + i * 1.2) * 0.1;
    }
  }

  if (orbitals) {
    for (let i = 0; i < orbitals.length; i += 1) {
      const orb = orbitals[i];
      const angle = worldTicker * orb.speed + orb.phase;
      orb.mesh.position.x = districts.fountain.group.position.x + Math.cos(angle) * orb.radius;
      orb.mesh.position.z = districts.fountain.group.position.z + Math.sin(angle) * orb.radius;
      orb.mesh.position.y = 3.2 + Math.sin(worldTicker * 0.8 + orb.phase) * 0.3;
    }
  }

  // Particle orbiters
  for (let i = 0; i < districts.particleOrbiters.length; i += 1) {
    const p = districts.particleOrbiters[i];
    const angle = worldTicker * p.speed + p.phase;
    p.mesh.position.x = p.center.x + Math.cos(angle) * p.radius;
    p.mesh.position.z = p.center.z + Math.sin(angle) * p.radius;
    p.mesh.position.y = p.yBase + Math.sin(worldTicker * 1.4 + p.phase) * p.yAmp;
    p.mesh.rotation.x += dt * p.spinSpeed;
    p.mesh.rotation.y += dt * p.spinSpeed * 0.7;
    let baseOpacity = 0.4 + Math.sin(worldTicker * 2.2 + p.phase) * 0.2;
    if (p.landmark && p.landmark.pulse > 0) {
      baseOpacity = Math.min(1, baseOpacity + p.landmark.pulse * 0.5);
      p.mesh.scale.setScalar(1 + p.landmark.pulse * 0.3);
    } else {
      p.mesh.scale.setScalar(1);
    }
    p.mesh.material.opacity = baseOpacity;
  }

  // Scan rings
  for (let i = 0; i < districts.scanRings.length; i += 1) {
    const sr = districts.scanRings[i];
    sr.mesh.rotation.z += dt * sr.speed;
    const wave = Math.sin(worldTicker * 1.5 + sr.phase) * 0.5 + 0.5;
    sr.mesh.material.opacity = sr.baseOpacity + wave * 0.06;
    const scale = 1 + wave * 0.06;
    sr.mesh.scale.set(scale, scale, 1);
  }

  // Circuit lines
  for (let i = 0; i < districts.circuitLines.length; i += 1) {
    const cl = districts.circuitLines[i];
    const wave = Math.sin(worldTicker * 2.5 - cl.index * 0.6) * 0.5 + 0.5;
    cl.mesh.material.opacity = 0.04 + wave * 0.16;
  }

  // Asset models
  for (let i = 0; i < districts.districtAssetModels.length; i += 1) {
    districts.districtAssetModels[i].rotation.y += dt * 0.03;
  }

  // Props
  for (let i = 0; i < districts.districtProps.length; i += 1) {
    const prop = districts.districtProps[i];
    if (prop.isGroup !== false) {
      prop.rotation.y += dt * (0.015 + (i % 3) * 0.008);
      const children = prop.children;
      for (let c = children.length - 1; c >= 2; c -= 1) {
        const child = children[c];
        if (child.position.y > 1.5) {
          child.position.y += Math.sin(worldTicker * 2.2 + i + c) * 0.003;
          child.rotation.y += dt * 1.2;
        }
      }
    }
  }

  // NPCs
  for (const npc of districts.npcData) {
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
    // Wisp bob
    npc.mesh.position.y = Math.sin(worldTicker * 2 + npc.mesh.position.x) * 0.15;
  }

  // Bob spores/orbs
  scene.traverse((obj) => {
    if (obj.userData.bobOrigin !== undefined) {
      obj.userData.bobPhase = (obj.userData.bobPhase || 0) + dt * 1.4;
      obj.position.y = obj.userData.bobOrigin + Math.sin(obj.userData.bobPhase) * 0.25;
    }
  });
};
