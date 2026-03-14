import * as THREE from "three";

/**
 * Builds and places all five Memory Garden ambient props across the experiences
 * corridor. Returns arrays of animated items for the main loop to tick.
 *
 * Props:
 *   1. Stone ring henge   – mossy torus on ground
 *   2. Glowing lantern    – slim pole + enclosed pulsing glow sphere
 *   3. Floating memory shard – drifting octahedron with slow bob + spin
 *   4. Low hedge trim     – flat stretched box, soft green emissive
 *   5. Arch gate pair     – two posts + overhead arc, teal glow
 *
 * @param {THREE.Scene} scene
 * @returns {{
 *   memoryShards: Array<{ mesh: THREE.Mesh, baseY: number, phase: number, speed: number }>,
 *   lanternLights: Array<{ light: THREE.PointLight, phase: number }>
 * }}
 */
export const buildAmbientProps = (scene) => {
  const memoryShards = [];
  const lanternLights = [];

  // ── 1. Stone ring henges ──────────────────────────────────────────────────
  // Mossy green tori lying flat on the ground at corridor sides
  const hengePlacements = [
    { x: -11, z: -26 },
    { x:  11, z: -46 },
    { x: -10, z: -72 },
    { x:  10, z: -94 },
  ];
  const hengeMat = new THREE.MeshStandardMaterial({
    color: 0x1a5c30,
    emissive: 0x0d3a1a,
    emissiveIntensity: 0.3,
    roughness: 0.9,
    metalness: 0.0
  });
  for (const p of hengePlacements) {
    const henge = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.18, 10, 36), hengeMat);
    henge.rotation.x = Math.PI / 2;
    henge.position.set(p.x, 0.08, p.z);
    scene.add(henge);

    // Inner glow ring (thin, brighter)
    const innerRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.05, 0.04, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0x4fc98a, transparent: true, opacity: 0.45 })
    );
    innerRing.rotation.x = Math.PI / 2;
    innerRing.position.set(p.x, 0.06, p.z);
    scene.add(innerRing);
  }

  // ── 2. Glowing lantern stems ──────────────────────────────────────────────
  // Slim pole + sphere housing + point light; paired on both sides of path
  const lanternZ = [-18, -38, -58, -78, -98];
  const poleMatLantern = new THREE.MeshStandardMaterial({
    color: 0x0d2d22,
    roughness: 0.6,
    metalness: 0.8
  });
  for (const z of lanternZ) {
    for (const side of [-1, 1]) {
      const x = side * 5.5;

      // Pole
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 2.6, 8), poleMatLantern);
      pole.position.set(x, 1.3, z);
      scene.add(pole);

      // Arm (small horizontal box)
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.05), poleMatLantern);
      arm.position.set(x + side * 0.2, 2.55, z);
      scene.add(arm);

      // Housing sphere
      const housing = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 10, 8),
        new THREE.MeshStandardMaterial({
          color: 0xa9ffe0,
          emissive: 0x6de2bc,
          emissiveIntensity: 1.2,
          transparent: true,
          opacity: 0.82
        })
      );
      housing.position.set(x + side * 0.4, 2.55, z);
      scene.add(housing);

      // Point light
      const light = new THREE.PointLight(0x6de2bc, 1.4, 6.5);
      light.position.set(x + side * 0.4, 2.55, z);
      scene.add(light);
      lanternLights.push({ light, phase: Math.random() * Math.PI * 2 });
    }
  }

  // ── 3. Floating memory shards ─────────────────────────────────────────────
  // Small drifting octahedra, scattered between pedestals
  const shardPlacements = [
    { x: -4, z: -22, baseY: 2.8 },
    { x:  4, z: -44, baseY: 3.2 },
    { x: -3, z: -62, baseY: 2.5 },
    { x:  5, z: -82, baseY: 3.0 },
    { x:  0, z: -54, baseY: 4.0 },
  ];
  const shardMat = new THREE.MeshStandardMaterial({
    color: 0x9bf7d8,
    emissive: 0x4fbb99,
    emissiveIntensity: 1.0,
    roughness: 0.1,
    metalness: 0.6,
    transparent: true,
    opacity: 0.75,
    flatShading: true
  });
  for (const p of shardPlacements) {
    const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), shardMat);
    shard.position.set(p.x, p.baseY, p.z);
    scene.add(shard);
    memoryShards.push({
      mesh: shard,
      baseY: p.baseY,
      phase: Math.random() * Math.PI * 2,
      speed: 0.6 + Math.random() * 0.5
    });
  }

  // ── 4. Low hedge trims ────────────────────────────────────────────────────
  // Flat stretched boxes, grouped in runs at corridor edges
  const hedgeMat = new THREE.MeshStandardMaterial({
    color: 0x1e4d2f,
    emissive: 0x0d3a1a,
    emissiveIntensity: 0.22,
    roughness: 0.95
  });
  const hedgePlacements = [
    { x: -13, z: -32, sx: 0.5, sz: 5.0 },
    { x:  13, z: -52, sx: 0.5, sz: 5.0 },
    { x: -13, z: -70, sx: 0.5, sz: 7.0 },
    { x:  13, z: -88, sx: 0.5, sz: 5.0 },
    { x: -13, z: -50, sx: 0.5, sz: 4.0 },
  ];
  for (const p of hedgePlacements) {
    const hedge = new THREE.Mesh(new THREE.BoxGeometry(p.sx, 0.55, p.sz), hedgeMat);
    hedge.position.set(p.x, 0.275, p.z);
    scene.add(hedge);

    // Small rounded top cap for organic feel
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.28, p.sz, 8, 1, false, 0, Math.PI),
      hedgeMat
    );
    cap.rotation.z = Math.PI / 2;
    cap.rotation.y = Math.PI / 2;
    cap.position.set(p.x, 0.55, p.z);
    scene.add(cap);
  }

  // ── 5. Arch gate pairs ────────────────────────────────────────────────────
  // Two posts + overhead arc with teal glow; frames corridor transitions
  const archPlacements = [{ z: -8 }, { z: -56 }, { z: -108 }];
  const postMat = new THREE.MeshStandardMaterial({
    color: 0x0a1f18,
    roughness: 0.3,
    metalness: 0.85
  });
  const archGlowMat = new THREE.MeshBasicMaterial({
    color: 0x6de2bc,
    transparent: true,
    opacity: 0.55
  });

  for (const p of archPlacements) {
    // Left and right posts
    for (const side of [-1, 1]) {
      const postX = side * 2.4;

      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 3.6, 8), postMat);
      post.position.set(postX, 1.8, p.z);
      scene.add(post);

      // Post cap sphere
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0x6de2bc, emissive: 0x6de2bc, emissiveIntensity: 1.2 })
      );
      cap.position.set(postX, 3.65, p.z);
      scene.add(cap);
    }

    // Overhead arch (torus segment)
    const arch = new THREE.Mesh(
      new THREE.TorusGeometry(2.4, 0.08, 10, 24, Math.PI),
      archGlowMat
    );
    arch.rotation.z = Math.PI;
    arch.position.set(0, 3.6, p.z);
    scene.add(arch);

    // Inner glow plane inside the arch opening
    const glowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(4.6, 1.6),
      new THREE.MeshBasicMaterial({
        color: 0x6de2bc,
        transparent: true,
        opacity: 0.06,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    glowPlane.position.set(0, 2.8, p.z);
    scene.add(glowPlane);
  }

  return { memoryShards, lanternLights };
};
