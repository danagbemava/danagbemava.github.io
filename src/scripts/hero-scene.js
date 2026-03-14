/**
 * hero-scene.js – Three.js holographic hero for the landing page
 *
 * Procedural astronaut-helmet-style shape with wireframe overlay,
 * orbiting particles, mouse parallax, and smooth entrance animation.
 *
 * To swap in a real GLTF model later, replace the `buildCoreModel()`
 * function body with GLTFLoader usage — the rest of the pipeline
 * (lighting, particles, animation loop) stays the same.
 */

import * as THREE from 'three';

const CANVAS_ID = 'hero-canvas';
const PARTICLE_COUNT = 180;
const RING_COUNT = 3;

/* ── palette (matches site design tokens) ── */
const COL = {
  cyan:   0x4fc3f7,
  orange: 0xffab40,
  green:  0x6de2bc,
  dark:   0x020810,
  white:  0xe0f0ff,
};

/* ── state ── */
let scene, camera, renderer, clock;
let coreGroup, particleSystem;
let mouse = { x: 0, y: 0 };
let entered = false;
let raf;

/* ── entry ── */
export function initHeroScene() {
  const canvas = document.getElementById(CANVAS_ID);
  if (!canvas) return;

  scene = new THREE.Scene();
  clock = new THREE.Clock();

  /* camera */
  const aspect = canvas.clientWidth / canvas.clientHeight;
  camera = new THREE.PerspectiveCamera(40, aspect, 0.1, 100);
  camera.position.set(0, 0.4, 5);

  /* renderer */
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.setClearColor(0x000000, 0);

  /* content */
  buildLights();
  coreGroup = buildCoreModel();
  scene.add(coreGroup);
  particleSystem = buildParticles();
  scene.add(particleSystem);
  buildOrbitRings();

  /* interaction */
  window.addEventListener('mousemove', onMouse);
  window.addEventListener('resize', onResize);

  /* entrance animation – start at scale 0 */
  coreGroup.scale.set(0, 0, 0);
  entered = false;

  animate();
}

/* ── lighting ── */
function buildLights() {
  const ambient = new THREE.AmbientLight(0xffffff, 0.3);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(COL.cyan, 1.2);
  key.position.set(3, 4, 5);
  scene.add(key);

  const fill = new THREE.PointLight(COL.orange, 0.8, 12);
  fill.position.set(-3, -1, 2);
  scene.add(fill);

  const rim = new THREE.PointLight(COL.green, 0.5, 10);
  rim.position.set(0, 3, -4);
  scene.add(rim);
}

/* ── core model (procedural astronaut-helmet hologram) ── */
function buildCoreModel() {
  const group = new THREE.Group();

  /* visor – reflective sphere */
  const visorGeo = new THREE.SphereGeometry(0.82, 48, 48);
  const visorMat = new THREE.MeshPhysicalMaterial({
    color: COL.dark,
    metalness: 0.9,
    roughness: 0.08,
    envMapIntensity: 1.5,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    transparent: true,
    opacity: 0.88,
  });
  const visor = new THREE.Mesh(visorGeo, visorMat);
  group.add(visor);

  /* helmet shell */
  const helmetGeo = new THREE.SphereGeometry(0.9, 32, 32,
    0, Math.PI * 2, 0, Math.PI * 0.75);
  const helmetMat = new THREE.MeshStandardMaterial({
    color: 0x1a2a44,
    metalness: 0.6,
    roughness: 0.3,
    transparent: true,
    opacity: 0.6,
  });
  const helmet = new THREE.Mesh(helmetGeo, helmetMat);
  helmet.rotation.x = -0.15;
  group.add(helmet);

  /* wireframe overlay */
  const wireGeo = new THREE.IcosahedronGeometry(1.02, 2);
  const wireMat = new THREE.MeshBasicMaterial({
    color: COL.cyan,
    wireframe: true,
    transparent: true,
    opacity: 0.2,
  });
  const wire = new THREE.Mesh(wireGeo, wireMat);
  group.add(wire);
  group.userData.wire = wire;

  /* scan line ring */
  const ringGeo = new THREE.RingGeometry(0.95, 1.0, 64);
  const ringMat = new THREE.MeshBasicMaterial({
    color: COL.cyan,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  group.add(ring);
  group.userData.scanRing = ring;

  /* glow disc behind */
  const glowGeo = new THREE.CircleGeometry(1.8, 64);
  const glowMat = new THREE.MeshBasicMaterial({
    color: COL.cyan,
    transparent: true,
    opacity: 0.04,
    side: THREE.DoubleSide,
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.position.z = -0.6;
  group.add(glow);

  return group;
}

/* ── orbiting particles ── */
function buildParticles() {
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const sizes = new Float32Array(PARTICLE_COUNT);
  const colors = new Float32Array(PARTICLE_COUNT * 3);

  const palette = [
    new THREE.Color(COL.cyan),
    new THREE.Color(COL.orange),
    new THREE.Color(COL.green),
    new THREE.Color(COL.white),
  ];

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const r = 1.4 + Math.random() * 2.2;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
    sizes[i] = 2 + Math.random() * 4;

    const c = palette[Math.floor(Math.random() * palette.length)];
    colors[i * 3]     = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    size: 3,
    vertexColors: true,
    transparent: true,
    opacity: 0.7,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  return new THREE.Points(geo, mat);
}

/* ── orbit rings ── */
function buildOrbitRings() {
  for (let i = 0; i < RING_COUNT; i++) {
    const r = 1.6 + i * 0.6;
    const ringGeo = new THREE.RingGeometry(r - 0.005, r + 0.005, 128);
    const ringMat = new THREE.MeshBasicMaterial({
      color: i === 1 ? COL.orange : COL.cyan,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2 + (i - 1) * 0.35;
    ring.rotation.z = i * 0.8;
    scene.add(ring);
  }
}

/* ── mouse parallax ── */
function onMouse(e) {
  mouse.x = (e.clientX / window.innerWidth - 0.5) * 2;
  mouse.y = (e.clientY / window.innerHeight - 0.5) * 2;
}

/* ── resize ── */
function onResize() {
  const canvas = renderer.domElement;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}

/* ── animation loop ── */
function animate() {
  raf = requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  /* entrance anim */
  if (!entered && coreGroup) {
    const s = Math.min(coreGroup.scale.x + 0.025, 1);
    coreGroup.scale.set(s, s, s);
    if (s >= 1) entered = true;
  }

  /* core rotation */
  if (coreGroup) {
    coreGroup.rotation.y = t * 0.3 + mouse.x * 0.3;
    coreGroup.rotation.x = Math.sin(t * 0.2) * 0.15 + mouse.y * 0.15;

    /* pulsing wireframe */
    const wire = coreGroup.userData.wire;
    if (wire) {
      wire.rotation.y = -t * 0.15;
      wire.rotation.z = t * 0.1;
      wire.material.opacity = 0.15 + Math.sin(t * 2) * 0.08;
    }

    /* scan ring bob */
    const scan = coreGroup.userData.scanRing;
    if (scan) {
      scan.position.y = Math.sin(t * 1.5) * 0.5;
      scan.material.opacity = 0.2 + Math.sin(t * 3) * 0.15;
    }
  }

  /* particle orbit */
  if (particleSystem) {
    particleSystem.rotation.y = t * 0.08;
    particleSystem.rotation.x = Math.sin(t * 0.12) * 0.1;
  }

  /* camera parallax */
  camera.position.x += (mouse.x * 0.5 - camera.position.x) * 0.03;
  camera.position.y += (0.4 - mouse.y * 0.3 - camera.position.y) * 0.03;
  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);
}

/* ── cleanup ── */
export function destroyHeroScene() {
  cancelAnimationFrame(raf);
  window.removeEventListener('mousemove', onMouse);
  window.removeEventListener('resize', onResize);
  renderer?.dispose();
}
