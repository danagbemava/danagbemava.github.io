import * as THREE from "https://unpkg.com/three@0.161.0/build/three.module.js";

const bootHomeScene = () => {
  const canvas = document.getElementById("home-canvas");
  if (!canvas) {
    return;
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (error) {
    console.error("Home scene could not start:", error);
    return;
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 180);
  camera.position.set(0, 1.8, 14);

  const ambient = new THREE.HemisphereLight(0xf5f7ff, 0x4b786f, 1.1);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0xfcc08b, 1.2);
  keyLight.position.set(4, 8, 10);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x7fdbe3, 0.8);
  fillLight.position.set(-6, 3, -2);
  scene.add(fillLight);

  const ringGroup = new THREE.Group();
  scene.add(ringGroup);

  const palette = [0xd47a2f, 0x0b8ca0, 0x94c8bd, 0x1d6e63];
  for (let i = 0; i < 14; i += 1) {
    const radius = 0.8 + i * 0.23;
    const tube = 0.04 + (i % 3) * 0.01;
    const geometry = new THREE.TorusGeometry(radius, tube, 18, 90);
    const material = new THREE.MeshStandardMaterial({
      color: palette[i % palette.length],
      metalness: 0.34,
      roughness: 0.33,
      transparent: true,
      opacity: 0.78 - i * 0.026,
    });
    const torus = new THREE.Mesh(geometry, material);
    torus.rotation.x = Math.PI * 0.5 + i * 0.08;
    torus.rotation.y = i * 0.3;
    torus.position.set(Math.sin(i) * 1.8, Math.cos(i * 0.65) * 1.5, -i * 0.52);
    ringGroup.add(torus);
  }

  const orbGeometry = new THREE.IcosahedronGeometry(0.82, 1);
  const orbMaterial = new THREE.MeshStandardMaterial({
    color: 0xfaebdb,
    emissive: 0xd37e3f,
    emissiveIntensity: 0.12,
    roughness: 0.24,
    metalness: 0.52,
  });
  const orb = new THREE.Mesh(orbGeometry, orbMaterial);
  orb.position.set(0, 0.25, 0);
  scene.add(orb);

  const mobile = window.matchMedia("(max-width: 900px)").matches;
  const particleCount = mobile ? 140 : 330;
  const particlePositions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i += 1) {
    const idx = i * 3;
    particlePositions[idx] = (Math.random() - 0.5) * 26;
    particlePositions[idx + 1] = Math.random() * 11 + 0.6;
    particlePositions[idx + 2] = (Math.random() - 0.5) * 24;
  }

  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
  const particleMaterial = new THREE.PointsMaterial({
    color: 0x0b8ca0,
    size: mobile ? 0.05 : 0.065,
    transparent: true,
    opacity: 0.58,
  });
  const particles = new THREE.Points(particleGeometry, particleMaterial);
  scene.add(particles);

  const pointerTarget = new THREE.Vector2(0, 0);
  const pointerCurrent = new THREE.Vector2(0, 0);
  const clock = new THREE.Clock();
  let elapsed = 0;
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const resize = () => {
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

  const observer = typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
  if (observer) {
    observer.observe(canvas);
  } else {
    window.addEventListener("resize", resize);
  }
  canvas.addEventListener("pointermove", onPointerMove);
  resize();

  const animate = () => {
    const delta = clock.getDelta();
    elapsed += delta;

    if (!prefersReducedMotion) {
      pointerCurrent.lerp(pointerTarget, Math.min(1, delta * 2.4));
      ringGroup.rotation.z = Math.sin(elapsed * 0.2) * 0.08;
      ringGroup.rotation.y += delta * 0.12;
      ringGroup.position.y = Math.sin(elapsed * 0.6) * 0.25;

      orb.rotation.x += delta * 0.24;
      orb.rotation.y -= delta * 0.34;
      orb.position.y = 0.22 + Math.sin(elapsed * 1.4) * 0.18;

      particles.rotation.y = elapsed * 0.03;
      particles.position.y = Math.cos(elapsed * 0.8) * 0.12;
    }

    camera.position.x += ((pointerCurrent.x * 1.35) - camera.position.x) * 0.04;
    camera.position.y += ((1.8 + pointerCurrent.y * 0.46) - camera.position.y) * 0.04;
    camera.lookAt(0, 0.6, -2.8);

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  };

  animate();
};

bootHomeScene();
