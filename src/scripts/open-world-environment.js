import * as THREE from "three";
import { districtConfig } from "./open-world-config.js";

/**
 * Creates the deep-space nebula environment: layered sky, star fields,
 * nebula clouds, floating asteroid debris, per-district island platforms,
 * energy tethers, and ambient particle dust.
 */
export const createEnvironment = (scene, lowPower) => {
  // ── Deep-space sky dome ────────────────────────────────────────
  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(260, lowPower ? 20 : 36, lowPower ? 14 : 24),
    new THREE.MeshBasicMaterial({ color: 0x06021a, side: THREE.BackSide, fog: false })
  );
  scene.add(skyDome);

  // ── Nebula cloud layers (additive-blended tori at odd angles) ──
  const nebulaClouds = [];
  const nebulaSpecs = [
    { color: 0x3a1868, radius: 210, tube: 55, opacity: 0.06,  rx: 0.3,  ry: 0,    rz: 0.1,  y: 25 },
    { color: 0x0c3858, radius: 190, tube: 48, opacity: 0.05,  rx: -0.2, ry: 0.5,  rz: -0.3, y: 10 },
    { color: 0x5a1040, radius: 175, tube: 38, opacity: 0.04,  rx: 0.7,  ry: -0.3, rz: 0.2,  y: -5 },
    { color: 0x082840, radius: 220, tube: 62, opacity: 0.035, rx: -0.5, ry: 0.2,  rz: 0.6,  y: 35 },
    { color: 0x281050, radius: 160, tube: 32, opacity: 0.045, rx: 0.1,  ry: 0.8,  rz: -0.1, y: 0 },
  ];
  for (const spec of nebulaSpecs) {
    const cloud = new THREE.Mesh(
      new THREE.TorusGeometry(spec.radius, spec.tube, 6, lowPower ? 32 : 56),
      new THREE.MeshBasicMaterial({
        color: spec.color,
        transparent: true,
        opacity: spec.opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    cloud.rotation.set(spec.rx, spec.ry, spec.rz);
    cloud.position.y = spec.y;
    scene.add(cloud);
    nebulaClouds.push(cloud);
  }

  // ── Distant galaxy disc ────────────────────────────────────────
  const galaxyDisc = new THREE.Mesh(
    new THREE.RingGeometry(12, 44, 64),
    new THREE.MeshBasicMaterial({
      color: 0xd8c0ff,
      transparent: true,
      opacity: 0.035,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    })
  );
  galaxyDisc.position.set(140, 55, -160);
  galaxyDisc.lookAt(0, 30, 0);
  scene.add(galaxyDisc);

  // ── Star fields ────────────────────────────────────────────────
  // Main stars — cool whites and blues
  const starsCount = lowPower ? 800 : 2400;
  const starsPos = new Float32Array(starsCount * 3);
  const starsCols = new Float32Array(starsCount * 3);
  const starPalette = [
    [0.88, 0.9, 1.0], [1.0, 0.95, 0.85], [0.75, 0.82, 1.0],
    [1.0, 0.7, 0.5], [0.6, 0.75, 1.0], [1.0, 1.0, 1.0]
  ];
  for (let i = 0; i < starsCount; i += 1) {
    const c = i * 3;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 180 + Math.random() * 60;
    starsPos[c] = r * Math.sin(phi) * Math.cos(theta);
    starsPos[c + 1] = r * Math.cos(phi) * 0.6 + 15; // bias upward
    starsPos[c + 2] = r * Math.sin(phi) * Math.sin(theta);
    const pal = starPalette[i % starPalette.length];
    starsCols[c] = pal[0]; starsCols[c + 1] = pal[1]; starsCols[c + 2] = pal[2];
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(starsPos, 3));
  starGeo.setAttribute("color", new THREE.BufferAttribute(starsCols, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({
    size: lowPower ? 0.2 : 0.3,
    transparent: true,
    opacity: 0.82,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })));

  // Bright accent stars
  const accentCount = lowPower ? 50 : 140;
  const accentPos = new Float32Array(accentCount * 3);
  for (let i = 0; i < accentCount; i += 1) {
    const c = i * 3;
    accentPos[c] = (Math.random() - 0.5) * 240;
    accentPos[c + 1] = Math.random() * 70 + 10;
    accentPos[c + 2] = (Math.random() - 0.5) * 240;
  }
  const accentGeo = new THREE.BufferGeometry();
  accentGeo.setAttribute("position", new THREE.BufferAttribute(accentPos, 3));
  scene.add(new THREE.Points(accentGeo, new THREE.PointsMaterial({
    color: 0xffeedd,
    size: lowPower ? 0.4 : 0.6,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })));

  // ── Ground — barely-visible void floor ─────────────────────────
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(120, 72),
    new THREE.MeshStandardMaterial({
      color: 0x060212,
      roughness: 0.95,
      metalness: 0.05,
      emissive: 0x0a0420,
      emissiveIntensity: 0.08,
      transparent: true,
      opacity: 0.55
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = !lowPower;
  scene.add(ground);

  // ── Per-district floating island platforms ──────────────────────
  const islands = [];
  const islandDefs = [
    { zone: "home",        radius: 12, segments: 48, color: 0x100830,  emissive: 0xc8b0ff, height: 0.6, edgeColor: 0xc8b0ff },
    { zone: "projects",    radius: 14, segments: 6,  color: 0x1a0a04,  emissive: 0xff6b35, height: 0.8, edgeColor: 0xff6b35 },
    { zone: "posts",       radius: 13, segments: 32, color: 0x040e18,  emissive: 0x00e5ff, height: 0.5, edgeColor: 0x00e5ff },
    { zone: "experiences", radius: 13, segments: 12, color: 0x041a0a,  emissive: 0x7dffb3, height: 0.7, edgeColor: 0x7dffb3 },
  ];

  for (const def of islandDefs) {
    const cfg = districtConfig[def.zone];
    const group = new THREE.Group();
    group.position.set(cfg.center.x, -0.1, cfg.center.z);

    // Top surface
    const top = new THREE.Mesh(
      new THREE.CylinderGeometry(def.radius, def.radius * 0.88, def.height, def.segments),
      new THREE.MeshStandardMaterial({
        color: def.color,
        emissive: def.emissive,
        emissiveIntensity: 0.06,
        roughness: 0.78,
        metalness: 0.22
      })
    );
    group.add(top);

    // Glowing edge ring
    const edgeRing = new THREE.Mesh(
      new THREE.TorusGeometry(def.radius * 0.94, 0.08, 8, def.segments * 2),
      new THREE.MeshBasicMaterial({
        color: def.edgeColor,
        transparent: true,
        opacity: 0.45,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    edgeRing.rotation.x = Math.PI / 2;
    edgeRing.position.y = def.height * 0.5;
    group.add(edgeRing);

    // Underside glow
    const underGlow = new THREE.Mesh(
      new THREE.CircleGeometry(def.radius * 0.7, 32),
      new THREE.MeshBasicMaterial({
        color: def.edgeColor,
        transparent: true,
        opacity: 0.08,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    underGlow.rotation.x = Math.PI / 2;
    underGlow.position.y = -def.height * 0.5 - 0.1;
    group.add(underGlow);

    // Underside crystal stalactites
    const crystalCount = lowPower ? 3 : 6;
    for (let i = 0; i < crystalCount; i += 1) {
      const angle = (i / crystalCount) * Math.PI * 2 + Math.random() * 0.4;
      const dist = def.radius * (0.3 + Math.random() * 0.45);
      const cLen = 1.5 + Math.random() * 3;
      const crystal = new THREE.Mesh(
        new THREE.ConeGeometry(0.3 + Math.random() * 0.4, cLen, 5),
        new THREE.MeshStandardMaterial({
          color: def.color,
          emissive: def.edgeColor,
          emissiveIntensity: 0.35,
          roughness: 0.2,
          metalness: 0.6,
          transparent: true,
          opacity: 0.75
        })
      );
      crystal.position.set(
        Math.cos(angle) * dist,
        -def.height * 0.5 - cLen * 0.5,
        Math.sin(angle) * dist
      );
      crystal.rotation.z = Math.PI; // point downward
      group.add(crystal);
    }

    scene.add(group);
    islands.push({ group, edgeRing, def });
  }

  // ── Hex grid overlay (subtle, on ground) ───────────────────────
  const terrainRing = new THREE.Mesh(
    new THREE.RingGeometry(28, 90, 6),
    new THREE.MeshBasicMaterial({
      color: 0xc8b0ff,
      transparent: true,
      opacity: 0.03,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  terrainRing.rotation.x = -Math.PI / 2;
  terrainRing.position.y = 0.02;
  scene.add(terrainRing);

  // Haze layer
  const haze = new THREE.Mesh(
    new THREE.CircleGeometry(100, 48),
    new THREE.MeshBasicMaterial({
      color: 0x2a1850,
      transparent: true,
      opacity: 0.06,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  haze.rotation.x = -Math.PI / 2;
  haze.position.y = 0.04;
  scene.add(haze);

  // World contour ring
  const worldContour = new THREE.Mesh(
    new THREE.RingGeometry(30, 75, 72),
    new THREE.MeshBasicMaterial({
      color: 0x6840a0,
      transparent: true,
      opacity: 0.04,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  worldContour.rotation.x = -Math.PI / 2;
  worldContour.position.y = 0.03;
  scene.add(worldContour);

  // ── Energy tethers (connecting hub to districts) ───────────────
  const tethers = [];
  for (const zone of ["projects", "posts", "experiences"]) {
    const cfg = districtConfig[zone];
    const hubCfg = districtConfig.home;
    const points = [
      new THREE.Vector3(hubCfg.center.x, 1.2, hubCfg.center.z),
      new THREE.Vector3(cfg.center.x * 0.35, 3.5, cfg.center.z * 0.35),
      new THREE.Vector3(cfg.center.x * 0.65, 2.8, cfg.center.z * 0.65),
      new THREE.Vector3(cfg.center.x, 1.2, cfg.center.z)
    ];
    const curve = new THREE.CatmullRomCurve3(points);

    // Outer glow tube
    const glow = new THREE.Mesh(
      new THREE.TubeGeometry(curve, lowPower ? 20 : 40, 0.35, 8, false),
      new THREE.MeshBasicMaterial({
        color: cfg.color,
        transparent: true,
        opacity: 0.08,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    scene.add(glow);

    // Inner bright core
    const core = new THREE.Mesh(
      new THREE.TubeGeometry(curve, lowPower ? 20 : 40, 0.06, 6, false),
      new THREE.MeshBasicMaterial({
        color: cfg.color,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    scene.add(core);

    tethers.push({ glow, core, zone });
  }

  // ── Asteroid debris field (replaces skyline towers) ────────────
  const skyline = [];
  const asteroidCount = lowPower ? 22 : 40;
  const asteroidGeos = [
    new THREE.DodecahedronGeometry(1, 0),
    new THREE.IcosahedronGeometry(1, 0),
    new THREE.OctahedronGeometry(1, 0),
  ];
  for (let i = 0; i < asteroidCount; i += 1) {
    const angle = (i / asteroidCount) * Math.PI * 2 + Math.random() * 0.3;
    const radius = 65 + Math.random() * 30;
    const scale = 1.2 + Math.random() * 4;
    const geo = asteroidGeos[i % asteroidGeos.length];
    const asteroid = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        color: 0x0e0820,
        emissive: i % 5 === 0 ? 0x4a2878 : 0x18102e,
        emissiveIntensity: 0.08 + Math.random() * 0.08,
        roughness: 0.85,
        metalness: 0.15
      })
    );
    asteroid.scale.set(scale, scale * (0.5 + Math.random() * 0.8), scale);
    const yPos = -3 + Math.random() * 30;
    asteroid.position.set(Math.cos(angle) * radius, yPos, Math.sin(angle) * radius);
    asteroid.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    scene.add(asteroid);
    skyline.push(asteroid);

    // Some asteroids get a glowing vein
    if (!lowPower && Math.random() > 0.6) {
      const veinColor = [0xc8b0ff, 0xff6b35, 0x00e5ff, 0x7dffb3][i % 4];
      const vein = new THREE.Mesh(
        new THREE.TorusGeometry(scale * 0.6, 0.06, 6, 12),
        new THREE.MeshBasicMaterial({
          color: veinColor,
          transparent: true,
          opacity: 0.4,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      vein.position.copy(asteroid.position);
      vein.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      scene.add(vein);
      skyline.push(vein);
    }
  }

  // ── Ambient particle dust ──────────────────────────────────────
  const dustCount = lowPower ? 200 : 600;
  const dustPos = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i += 1) {
    const c = i * 3;
    dustPos[c] = (Math.random() - 0.5) * 140;
    dustPos[c + 1] = Math.random() * 20 - 2;
    dustPos[c + 2] = (Math.random() - 0.5) * 140;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    color: 0xd0b8ff,
    size: 0.12,
    transparent: true,
    opacity: 0.35,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  }));
  scene.add(dust);

  // ── Floating infrastructure (holographic data relays) ──────────
  const floatingInfrastructure = [];
  const hangingCables = [];
  const infraAnchors = [
    new THREE.Vector3(-8, 7.5, -6),
    new THREE.Vector3(8, 7, -6),
    new THREE.Vector3(0, 8.5, -14),
    new THREE.Vector3(-4, 6.5, -2),
    new THREE.Vector3(4, 6.5, -2)
  ];
  for (let i = 0; i < infraAnchors.length; i += 1) {
    const anchor = infraAnchors[i];
    const relay = new THREE.Group();
    relay.position.copy(anchor);

    // Holographic prism
    const prism = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.7, 0),
      new THREE.MeshStandardMaterial({
        color: 0x14082a,
        emissive: 0xc8b0ff,
        emissiveIntensity: 0.4,
        roughness: 0.2,
        metalness: 0.7,
        transparent: true,
        opacity: 0.7
      })
    );
    const haloRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.1, 0.03, 8, 24),
      new THREE.MeshBasicMaterial({
        color: 0xc8b0ff,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    haloRing.rotation.x = Math.PI / 2;
    relay.add(prism, haloRing);
    scene.add(relay);
    floatingInfrastructure.push({ mesh: relay, baseY: anchor.y, phase: i * 1.2 });

    // Tether beam downward
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, anchor.y, 4),
      new THREE.MeshBasicMaterial({
        color: 0xc8b0ff,
        transparent: true,
        opacity: 0.12,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    beam.position.set(anchor.x, anchor.y * 0.5, anchor.z);
    scene.add(beam);
    hangingCables.push(beam);
  }

  return {
    skyDome,
    ground,
    terrainRing,
    haze,
    worldContour,
    skyline,
    nebulaClouds,
    tethers,
    islands,
    dust,
    floatingInfrastructure,
    hangingCables
  };
};

/** Per-frame environment animations. */
export const updateEnvironment = (env, dt, worldTicker) => {
  env.skyDome.rotation.y += dt * 0.008;
  env.worldContour.rotation.z += dt * 0.025;
  env.haze.material.opacity = 0.04 + Math.sin(worldTicker * 0.4) * 0.02;

  // Nebula drift
  for (let i = 0; i < env.nebulaClouds.length; i += 1) {
    const cloud = env.nebulaClouds[i];
    cloud.rotation.y += dt * (0.003 + i * 0.001);
    cloud.rotation.x += dt * 0.001 * (i % 2 === 0 ? 1 : -1);
    cloud.material.opacity = cloud.material.opacity + Math.sin(worldTicker * 0.2 + i) * 0.0003;
  }

  // Asteroid tumble
  for (let i = 0; i < env.skyline.length; i += 1) {
    const node = env.skyline[i];
    node.rotation.x += dt * 0.02 * ((i % 3) - 1);
    node.rotation.y += dt * 0.03 * ((i % 2) === 0 ? 1 : -1);
    if (node.material && "emissiveIntensity" in node.material) {
      node.material.emissiveIntensity = 0.06 + Math.sin(worldTicker * 0.6 + i * 0.5) * 0.04;
    }
  }

  // Island edge ring pulse
  for (let i = 0; i < env.islands.length; i += 1) {
    const island = env.islands[i];
    island.edgeRing.material.opacity = 0.3 + Math.sin(worldTicker * 1.5 + i * 1.2) * 0.15;
  }

  // Energy tether pulse
  for (let i = 0; i < env.tethers.length; i += 1) {
    const tether = env.tethers[i];
    tether.glow.material.opacity = 0.05 + Math.sin(worldTicker * 1.2 + i * 2) * 0.03;
    tether.core.material.opacity = 0.4 + Math.sin(worldTicker * 2.5 + i * 1.5) * 0.15;
  }

  // Dust drift
  if (env.dust) {
    env.dust.rotation.y += dt * 0.015;
    env.dust.material.opacity = 0.25 + Math.sin(worldTicker * 0.3) * 0.1;
  }

  // Floating relays
  for (let i = 0; i < env.floatingInfrastructure.length; i += 1) {
    const infra = env.floatingInfrastructure[i];
    infra.mesh.position.y = infra.baseY + Math.sin(worldTicker * 0.8 + infra.phase) * 0.5;
    infra.mesh.rotation.y += dt * 0.6;
    // Pulse the prism
    const prism = infra.mesh.children[0];
    if (prism && prism.material) {
      prism.material.emissiveIntensity = 0.3 + Math.sin(worldTicker * 2 + infra.phase) * 0.15;
    }
  }

  for (let i = 0; i < env.hangingCables.length; i += 1) {
    env.hangingCables[i].material.opacity = 0.08 + Math.sin(worldTicker * 1.5 + i) * 0.04;
  }
};
