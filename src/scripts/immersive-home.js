import * as THREE from "three";

const startHomeScene = () => {
  const canvas = document.getElementById("home-canvas");
  if (!canvas) {
    return;
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (error) {
    console.error("Could not initialize home scene:", error);
    return;
  }

  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(56, 1, 0.1, 220);
  camera.position.set(0, 1.9, 14.5);

  scene.add(new THREE.AmbientLight(0x0a1525, 0.6));
  const warm = new THREE.DirectionalLight(0x8ec8f8, 0.7);
  warm.position.set(4, 9, 8);
  scene.add(warm);
  const cool = new THREE.DirectionalLight(0x4fc3f7, 0.5);
  cool.position.set(-6, 5, -5);
  scene.add(cool);

  // ── Orbital rings ──
  const ringGroup = new THREE.Group();
  scene.add(ringGroup);

  const ringColors = [0xffab40, 0x4fc3f7, 0x29b6f6, 0x0288d1];
  for (let index = 0; index < 14; index += 1) {
    const geometry = new THREE.TorusGeometry(0.75 + index * 0.24, 0.036 + (index % 3) * 0.01, 20, 96);
    const material = new THREE.MeshStandardMaterial({
      color: ringColors[index % ringColors.length],
      roughness: 0.34,
      metalness: 0.34,
      transparent: true,
      opacity: 0.8 - index * 0.028
    });
    const ring = new THREE.Mesh(geometry, material);
    ring.position.set(Math.sin(index * 0.5) * 1.6, Math.cos(index * 0.65) * 1.3, -index * 0.62);
    ring.rotation.x = Math.PI / 2 + index * 0.06;
    ring.rotation.y = index * 0.31;
    ringGroup.add(ring);
  }

  // ── Glowing core ──
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.88, 1),
    new THREE.MeshStandardMaterial({
      color: 0x4fc3f7,
      emissive: 0x29b6f6,
      emissiveIntensity: 0.3,
      roughness: 0.28,
      metalness: 0.54
    })
  );
  core.position.y = 0.2;
  scene.add(core);

  // Core inner glow
  const coreGlow = new THREE.PointLight(0x29b6f6, 1.5, 12, 2);
  coreGlow.position.set(0, 0.2, 0);
  scene.add(coreGlow);

  // ── Particles (two layers) ──
  const smallScreen = window.matchMedia("(max-width: 900px)").matches;
  const particleCount = smallScreen ? 200 : 500;
  const positions = new Float32Array(particleCount * 3);
  const pSpeeds = new Float32Array(particleCount);
  for (let i = 0; i < particleCount; i += 1) {
    const cursor = i * 3;
    positions[cursor] = (Math.random() - 0.5) * 30;
    positions[cursor + 1] = Math.random() * 15 + 0.5;
    positions[cursor + 2] = (Math.random() - 0.5) * 30;
    pSpeeds[i] = 0.2 + Math.random() * 0.8;
  }

  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const particles = new THREE.Points(
    particleGeometry,
    new THREE.PointsMaterial({
      color: 0x29b6f6,
      size: smallScreen ? 0.05 : 0.07,
      transparent: true,
      opacity: 0.6,
      sizeAttenuation: true
    })
  );
  scene.add(particles);

  // Warm dust layer
  const dustCount = smallScreen ? 80 : 200;
  const dustPos = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 36;
    dustPos[i * 3 + 1] = Math.random() * 18 + 0.3;
    dustPos[i * 3 + 2] = (Math.random() - 0.5) * 36;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    color: 0x4fc3f7,
    size: 0.04,
    transparent: true,
    opacity: 0.2,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending
  }));
  scene.add(dust);

  // ── Floating wireframe shapes ──
  const shapes = [];
  const shapeMat = new THREE.MeshStandardMaterial({
    color: 0x4fc3f7,
    emissive: 0x29b6f6,
    emissiveIntensity: 0.15,
    wireframe: true,
    transparent: true,
    opacity: 0.15
  });
  const shapeGeos = [
    new THREE.OctahedronGeometry(0.5, 0),
    new THREE.TetrahedronGeometry(0.6, 0),
    new THREE.IcosahedronGeometry(0.4, 0)
  ];
  for (let i = 0; i < 8; i++) {
    const geo = shapeGeos[i % shapeGeos.length];
    const mesh = new THREE.Mesh(geo, shapeMat.clone());
    const angle = (i / 8) * Math.PI * 2;
    const radius = 5 + Math.random() * 6;
    mesh.position.set(
      Math.cos(angle) * radius,
      2 + Math.random() * 6,
      Math.sin(angle) * radius - 4
    );
    const s = 0.5 + Math.random() * 1;
    mesh.scale.set(s, s, s);
    scene.add(mesh);
    shapes.push({
      mesh,
      rotSpeed: (Math.random() - 0.5) * 0.6,
      bobSpeed: 0.3 + Math.random() * 0.5,
      bobAmp: 0.2 + Math.random() * 0.4,
      baseY: mesh.position.y,
      orbitRadius: radius,
      orbitSpeed: (Math.random() - 0.5) * 0.08,
      orbitAngle: angle
    });
  }

  const pointerTarget = new THREE.Vector2(0, 0);
  const pointerCurrent = new THREE.Vector2(0, 0);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clock = new THREE.Clock();
  let elapsed = 0;

  const onResize = () => {
    const width = canvas.clientWidth || canvas.parentElement?.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || canvas.parentElement?.clientHeight || window.innerHeight;
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  const onPointerMove = (event) => {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return;
    }
    pointerTarget.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointerTarget.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
  };

  canvas.addEventListener("pointermove", onPointerMove);
  if (typeof ResizeObserver === "function") {
    const observer = new ResizeObserver(onResize);
    observer.observe(canvas);
  } else {
    window.addEventListener("resize", onResize);
  }
  onResize();

  const tick = () => {
    const delta = clock.getDelta();
    elapsed += delta;

    if (!reducedMotion) {
      pointerCurrent.lerp(pointerTarget, Math.min(1, delta * 2.5));
      ringGroup.rotation.y += delta * 0.12;
      ringGroup.rotation.z = Math.sin(elapsed * 0.25) * 0.08;
      ringGroup.position.y = Math.sin(elapsed * 0.7) * 0.25;
      core.rotation.x += delta * 0.25;
      core.rotation.y -= delta * 0.32;
      core.position.y = 0.2 + Math.sin(elapsed * 1.4) * 0.2;
      coreGlow.intensity = 1.2 + Math.sin(elapsed * 2) * 0.4;
      particles.rotation.y = elapsed * 0.03;
      particles.position.y = Math.cos(elapsed * 0.8) * 0.12;
      dust.rotation.y = -elapsed * 0.02;

      // Animate particles drift
      const posArr = particleGeometry.attributes.position.array;
      for (let i = 0; i < particleCount; i++) {
        posArr[i * 3 + 1] += Math.sin(elapsed * pSpeeds[i] + i) * delta * 0.08;
      }
      particleGeometry.attributes.position.needsUpdate = true;

      // Orbit and bob wireframe shapes
      for (const s of shapes) {
        s.orbitAngle += s.orbitSpeed * delta;
        s.mesh.position.x = Math.cos(s.orbitAngle) * s.orbitRadius;
        s.mesh.position.z = Math.sin(s.orbitAngle) * s.orbitRadius - 4;
        s.mesh.position.y = s.baseY + Math.sin(elapsed * s.bobSpeed) * s.bobAmp;
        s.mesh.rotation.x += s.rotSpeed * delta;
        s.mesh.rotation.y += s.rotSpeed * 0.6 * delta;
      }
    }

    camera.position.x += ((pointerCurrent.x * 1.3) - camera.position.x) * 0.04;
    camera.position.y += ((1.85 + pointerCurrent.y * 0.42) - camera.position.y) * 0.04;
    camera.lookAt(0, 0.6, -3.1);

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  };

  tick();
};

startHomeScene();
