import * as THREE from "three";

// ── Gradient sky canvas ────────────────────────────────────────────────────
const makeSkyTexture = () => {
  const canvas = document.createElement("canvas");
  canvas.width = 2;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0.0,  "#010a06"); // zenith — near black
  gradient.addColorStop(0.35, "#041a0f"); // upper — very dark teal
  gradient.addColorStop(0.68, "#0a2e1c"); // middle — deep teal-green
  gradient.addColorStop(0.88, "#0d3d24"); // horizon — slightly lighter
  gradient.addColorStop(1.0,  "#10472a"); // base — warm green tinge
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 2, 512);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
};

/**
 * Builds the full atmospheric layer stack for the experiences Memory Garden
 * world. Returns animated objects for the main loop to tick.
 *
 * Layers (bottom → top):
 *   1. Ground mist    – large low-opacity discs near y=0, additive blending
 *   2. Sky shell      – gradient-textured sphere, slow rotation
 *   3. Star field     – Points geometry on a wide hemisphere
 *   4. Floating isles – drifting DodecahedronGeometry chunks
 *   5. Light shafts   – swaying additive planes
 *   6. Fireflies      – ~20 individual glowing spheres that drift organically
 *
 * @param {THREE.Scene} scene
 * @returns {{
 *   skyShell: THREE.Mesh,
 *   floatingIsles: Array<{isle, baseY, phase, speed}>,
 *   lightShafts:   Array<{shaft, phase, speed}>,
 *   fireflies:     Array<{mesh, baseX, baseY, baseZ, phase, speed, orbitR}>
 * }}
 */
export const buildAtmosphere = (scene) => {

  // ── 1. Ground mist ────────────────────────────────────────────────────────
  const mistPositions = [
    { z: -10 }, { z: -35 }, { z: -60 }, { z: -85 }, { z: -110 }
  ];
  const mistMat = new THREE.MeshBasicMaterial({
    color: 0x4fc98a,
    transparent: true,
    opacity: 0.04,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  for (const m of mistPositions) {
    const disc = new THREE.Mesh(new THREE.PlaneGeometry(30, 12), mistMat);
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(0, 0.12, m.z);
    scene.add(disc);
    // Second, slightly offset layer for density
    const disc2 = new THREE.Mesh(new THREE.PlaneGeometry(24, 8), mistMat);
    disc2.rotation.x = -Math.PI / 2;
    disc2.position.set((Math.random() - 0.5) * 4, 0.35, m.z + (Math.random() - 0.5) * 6);
    scene.add(disc2);
  }

  // ── 2. Sky shell — gradient texture ───────────────────────────────────────
  const skyShell = new THREE.Mesh(
    new THREE.SphereGeometry(220, 32, 24),
    new THREE.MeshBasicMaterial({
      map: makeSkyTexture(),
      side: THREE.BackSide,
      depthWrite: false
    })
  );
  scene.add(skyShell);

  // ── 3. Star field ─────────────────────────────────────────────────────────
  const starCount = 680;
  const starPositions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    // Distribute on an upper hemisphere so stars appear overhead
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.random() * (Math.PI / 2.2); // upper hemisphere only
    const r     = 190 + Math.random() * 20;
    starPositions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    starPositions[i * 3 + 1] = r * Math.cos(phi);
    starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xd0fff2,
    size: 0.55,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.72,
    depthWrite: false
  });
  scene.add(new THREE.Points(starGeo, starMat));

  // ── 4. Floating isles ─────────────────────────────────────────────────────
  const floatingIsles = [];
  const isleCount = window.matchMedia("(max-width: 900px)").matches ? 3 : 6;
  for (let i = 0; i < isleCount; i++) {
    const isle = new THREE.Mesh(
      new THREE.DodecahedronGeometry(1.6 + Math.random() * 1.9, 0),
      new THREE.MeshStandardMaterial({
        color: 0x4f8c73,
        emissive: 0x224f3f,
        emissiveIntensity: 0.28,
        roughness: 0.86,
        metalness: 0.08,
        flatShading: true
      })
    );
    isle.position.set(
      (Math.random() - 0.5) * 32,
      10 + Math.random() * 9,
      -10 - Math.random() * 92
    );
    scene.add(isle);
    floatingIsles.push({
      isle,
      baseY: isle.position.y,
      phase: Math.random() * Math.PI * 2,
      speed: 0.22 + Math.random() * 0.38
    });
  }

  // ── 5. Volumetric light shafts ────────────────────────────────────────────
  const lightShafts = [];
  for (let i = 0; i < 4; i++) {
    const shaft = new THREE.Mesh(
      new THREE.PlaneGeometry(8 + Math.random() * 4, 28),
      new THREE.MeshBasicMaterial({
        color: 0xa9ffe0,
        transparent: true,
        opacity: 0.07,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    shaft.position.set((Math.random() - 0.5) * 24, 12, -10 - i * 25);
    shaft.rotation.x = -Math.PI / 2.45;
    scene.add(shaft);
    lightShafts.push({
      shaft,
      phase: Math.random() * Math.PI * 2,
      speed: 0.35 + Math.random() * 0.3
    });
  }

  // ── 6. Fireflies ──────────────────────────────────────────────────────────
  const fireflies = [];
  const fireGeo   = new THREE.SphereGeometry(0.06, 6, 4);
  const fireMat   = new THREE.MeshBasicMaterial({
    color: 0xb6ffe5,
    transparent: true,
    opacity: 0.9
  });

  const fireflyCount = 22;
  for (let i = 0; i < fireflyCount; i++) {
    const mesh = new THREE.Mesh(fireGeo, fireMat.clone());
    const bx = (Math.random() - 0.5) * 20;
    const bz = -8 - Math.random() * 100;
    const by = 0.6 + Math.random() * 3.2;
    mesh.position.set(bx, by, bz);
    scene.add(mesh);
    fireflies.push({
      mesh,
      baseX: bx,
      baseY: by,
      baseZ: bz,
      phase: Math.random() * Math.PI * 2,
      speed: 0.3 + Math.random() * 0.55,
      orbitR: 0.4 + Math.random() * 1.1
    });
  }

  return { skyShell, floatingIsles, lightShafts, fireflies };
};
