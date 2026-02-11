import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  updateFootsteps, resetFootsteps, playBeep,
  updateProximityHum, startAmbient, toggleMute,
  playKeyPickup, playHolodeckActivate, playHolodeckDeactivate
} from "./sfx.js";

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/* ══════════════════════════════════════ */
/*            BOOT HOLODECK              */
/* ══════════════════════════════════════ */
const bootHolodeck = () => {
  const canvas   = document.getElementById("holodeck-canvas");
  const statusEl = document.getElementById("holodeck-status");
  const promptEl = document.getElementById("holodeck-prompt");
  const uiPanel  = document.getElementById("holodeck-ui");

  const listModal = document.getElementById("holodeck-list-modal");
  const listClose = document.getElementById("holodeck-list-close");
  const entryList = document.getElementById("holodeck-entry-list");

  const detailEl    = document.getElementById("holodeck-detail");
  const detailClose = document.getElementById("holodeck-detail-close");
  const detailMeta  = document.getElementById("holodeck-detail-meta");
  const detailTitle = document.getElementById("holodeck-detail-title");
  const detailSum   = document.getElementById("holodeck-detail-summary");
  const detailLink  = document.getElementById("holodeck-detail-link");

  const dataNode = document.getElementById("holodeck-data");

  if (!canvas || !statusEl || !promptEl || !listModal || !listClose || !entryList ||
      !detailEl || !detailClose || !detailMeta || !detailTitle || !detailSum || !detailLink || !dataNode) return;

  let entries = [];
  try { entries = JSON.parse(dataNode.textContent || "[]"); } catch { statusEl.textContent = "Holodeck data invalid."; return; }
  if (!entries.length) { statusEl.textContent = "No entries loaded."; return; }

  const kind = canvas.dataset.kind === "posts" ? "posts" : "projects";
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isMobile = () => window.innerWidth < 700;

  const modelFile = "/models/soldier.glb";

  /* ── Palette ── */
  const PAL = kind === "posts"
    ? { bg: 0x0c1a2e, fog: 0x0e1f33, floor: 0x0a1525, accent: 0x4fc3f7,
        glow: 0x29b6f6, rim: 0x0288d1, dimAccent: 0x1a4060, warm: 0x1a237e }
    : { bg: 0x1a150e, fog: 0x1f1a14, floor: 0x16120a, accent: 0xffab40,
        glow: 0xff9100, rim: 0xe65100, dimAccent: 0x5a3a10, warm: 0x3e2723 };

  /* ── Renderer ── */
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); }
  catch { statusEl.textContent = "Could not initialize 3D scene."; return; }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PAL.bg);
  scene.fog = new THREE.FogExp2(PAL.fog, 0.014);

  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 300);
  camera.position.set(0, 5, 18);

  /* ── Star field ── */
  const starCount = isMobile() ? 800 : 2000;
  const starPos = new Float32Array(starCount * 3);
  const starSizes = new Float32Array(starCount);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 80 + Math.random() * 120;
    starPos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = Math.abs(r * Math.cos(phi)) * 0.6 + 5;
    starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    starSizes[i] = 0.3 + Math.random() * 1.2;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute("size", new THREE.BufferAttribute(starSizes, 1));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({
    color: 0xddeeff, size: 0.25, transparent: true, opacity: 0.7, sizeAttenuation: true
  })));

  /* ── Lights ── */
  scene.add(new THREE.AmbientLight(0x1a2a40, 0.9));
  const keyLight = new THREE.DirectionalLight(0x8ec8f8, 0.7);
  keyLight.position.set(5, 12, 8);
  scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight(PAL.accent, 0.45);
  rimLight.position.set(-6, 4, -10);
  scene.add(rimLight);

  /* ── Floor — dark metallic with hex grid ── */
  const floorSize = 60;
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(floorSize, floorSize),
    new THREE.MeshStandardMaterial({ color: PAL.floor, roughness: 0.85, metalness: 0.3 })
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  // Hex grid overlay (using fine grid for now — true hex would need custom shader)
  const gridHelper = new THREE.GridHelper(floorSize, 48, PAL.dimAccent, PAL.dimAccent);
  gridHelper.position.y = 0.02;
  gridHelper.material.transparent = true;
  gridHelper.material.opacity = 0.12;
  scene.add(gridHelper);

  /* ── Data-stream particles (rising motes) ── */
  const pCount = isMobile() ? 150 : 400;
  const pPos = new Float32Array(pCount * 3);
  const pSpd = new Float32Array(pCount);
  for (let i = 0; i < pCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * 8;
    pPos[i * 3]     = Math.cos(a) * r;
    pPos[i * 3 + 1] = Math.random() * 12;
    pPos[i * 3 + 2] = Math.sin(a) * r - 6;
    pSpd[i] = 0.4 + Math.random() * 0.8;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
  const particlesMesh = new THREE.Points(pGeo, new THREE.PointsMaterial({
    color: PAL.accent, size: 0.06, transparent: true, opacity: 0.35, sizeAttenuation: true, blending: THREE.AdditiveBlending
  }));
  scene.add(particlesMesh);

  /* ══════════════════════════════════════════ */
  /*       HOLOTABLE (Star Wars style)          */
  /* ══════════════════════════════════════════ */
  const holoGroup = new THREE.Group();
  holoGroup.position.set(0, 0, -6);
  scene.add(holoGroup);

  const glowMat = (color, intensity = 0.8, opacity = 0.7) =>
    new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: intensity,
      transparent: true, opacity, roughness: 0.2, metalness: 0.6
    });

  // Base platform — tiered circular discs
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.3, metalness: 0.7 });
  const baseOuter = new THREE.Mesh(new THREE.CylinderGeometry(6, 6.3, 0.3, 32), baseMat);
  baseOuter.position.y = 0.15;
  holoGroup.add(baseOuter);

  const baseInner = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 5, 0.25, 32), baseMat.clone());
  baseInner.material.color.set(0x22223a);
  baseInner.position.y = 0.42;
  holoGroup.add(baseInner);

  const baseCore = new THREE.Mesh(
    new THREE.CylinderGeometry(3.5, 3.8, 0.2, 32),
    new THREE.MeshStandardMaterial({ color: 0x0d1b2a, roughness: 0.15, metalness: 0.8 })
  );
  baseCore.position.y = 0.65;
  holoGroup.add(baseCore);

  // Glowing rings around each tier
  const makeRing = (radius, y, thick = 0.05) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, thick, 16, 64),
      glowMat(PAL.accent, 0.6, 0.6)
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = y;
    holoGroup.add(ring);
    return ring;
  };
  const ring1 = makeRing(6.15, 0.31);
  const ring2 = makeRing(4.9, 0.56);
  const ring3 = makeRing(3.65, 0.76);

  // Central emitter column
  const emitter = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.5, 0.6, 16),
    glowMat(PAL.accent, 1.0, 0.9)
  );
  emitter.position.y = 1.05;
  holoGroup.add(emitter);

  // Holographic projection cone (transparent)
  const coneMat = new THREE.MeshBasicMaterial({
    color: PAL.glow, transparent: true, opacity: 0.03, side: THREE.DoubleSide,
    depthWrite: false, blending: THREE.AdditiveBlending
  });
  const projCone = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 4.5, 10, 32, 1, true), coneMat);
  projCone.position.y = 6.3;
  holoGroup.add(projCone);

  // Holographic sphere wireframe (data visualization feel)
  const holoSphere = new THREE.Mesh(
    new THREE.IcosahedronGeometry(3.2, 1),
    new THREE.MeshBasicMaterial({
      color: PAL.accent, wireframe: true, transparent: true, opacity: 0.06,
      blending: THREE.AdditiveBlending
    })
  );
  holoSphere.position.y = 5.5;
  holoGroup.add(holoSphere);

  // Scanning beam — flat ring that rotates
  const scanBeam = new THREE.Mesh(
    new THREE.RingGeometry(0.1, 5, 32),
    new THREE.MeshBasicMaterial({
      color: PAL.accent, transparent: true, opacity: 0.08, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    })
  );
  scanBeam.rotation.x = -Math.PI / 2;
  scanBeam.position.y = 1.5;
  holoGroup.add(scanBeam);

  // Inner point light
  const holoLight = new THREE.PointLight(PAL.glow, 0.5, 18, 2);
  holoLight.position.set(0, 4, 0);
  holoGroup.add(holoLight);

  // Secondary rim lights at base
  const rimL1 = new THREE.PointLight(PAL.accent, 0.3, 10, 2);
  rimL1.position.set(4, 1, 0);
  holoGroup.add(rimL1);
  const rimL2 = new THREE.PointLight(PAL.accent, 0.3, 10, 2);
  rimL2.position.set(-4, 1, 0);
  holoGroup.add(rimL2);

  // Holodeck activation state
  let holoActive = false;

  // Clickable meshes
  const clickable = [];
  [baseOuter, baseInner, baseCore, emitter, projCone].forEach(m => {
    m.userData.isHolodeck = true;
    clickable.push(m);
  });

  /* ── Avatar ── */
  const avatar = new THREE.Group();
  let mixer = null;
  const animations = {};
  let activeAction = null;

  const fadeToAction = (name, dur = 0.35) => {
    const next = animations[name];
    if (!next || next === activeAction) return;
    if (activeAction) activeAction.fadeOut(dur);
    next.reset().fadeIn(dur).play();
    activeAction = next;
  };

  new GLTFLoader().load(modelFile, (gltf) => {
    const model = gltf.scene;
    const s = isMobile() ? 1.2 : 1.6;
    model.scale.set(s, s, s);
    // Tint character with subtle holographic rim
    model.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material = child.material.clone();
        child.material.emissive = new THREE.Color(PAL.accent);
        child.material.emissiveIntensity = 0.08;
      }
    });
    avatar.add(model);
    mixer = new THREE.AnimationMixer(model);
    for (const clip of gltf.animations) animations[clip.name] = mixer.clipAction(clip);
    if (animations.Idle) { animations.Idle.play(); activeAction = animations.Idle; }
  });

  // Subtle ground indicator
  const avatarRing = new THREE.Mesh(
    new THREE.RingGeometry(0.6, 0.8, 48),
    new THREE.MeshBasicMaterial({ color: PAL.accent, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending })
  );
  avatarRing.rotation.x = -Math.PI / 2;
  avatarRing.position.y = 0.04;
  avatar.add(avatarRing);

  // Floating direction indicator
  const avatarArrow = new THREE.Mesh(
    new THREE.ConeGeometry(0.1, 0.25, 12),
    new THREE.MeshBasicMaterial({ color: PAL.accent, transparent: true, opacity: 0.7 })
  );
  avatarArrow.rotation.x = Math.PI;
  avatarArrow.position.set(0, 2.8, 0);
  avatar.add(avatarArrow);

  avatar.position.set(0, 0, 10);
  avatar.rotation.y = Math.PI; // Face the holodeck by default
  scene.add(avatar);

  /* ── State ── */
  const keyState = {};
  const ctrlKeys = new Set(["KeyW","KeyA","KeyS","KeyD","ArrowUp","ArrowDown","ArrowLeft","ArrowRight","KeyE"]);
  let nearHolodeck = false;
  let selectedEntry = null;
  let elapsed = 0;
  const boundHalf = floorSize / 2 - 2;
  const avatarRadius = 0.7;
  const holotableCollisionRadius = 6.6;

  /* ── Show/hide helpers ── */
  const showEl = (el) => { el.hidden = false; el.setAttribute("aria-hidden", "false"); };
  const hideEl = (el) => { el.hidden = true; el.setAttribute("aria-hidden", "true"); };

  const openListModal = () => {
    if (!listModal.hidden) return;
    showEl(listModal);
    playKeyPickup();
    statusEl.textContent = "Choose an entry to project...";
    promptEl.textContent = "";
  };

  const closeListModal = () => {
    hideEl(listModal);
    if (selectedEntry === null) statusEl.textContent = "Approach the holotable.";
  };

  const projectEntry = (index) => {
    const entry = entries[index];
    if (!entry) return;
    selectedEntry = index;
    hideEl(listModal);
    holoActive = true;
    playHolodeckActivate();

    detailMeta.textContent = `${entry.dateLabel || "Entry"} · ${entry.tags || (kind === "posts" ? "Post" : "Project")}`;
    detailTitle.textContent = entry.title;
    detailSum.textContent = entry.summary && entry.summary.trim().length > 16
      ? entry.summary.trim()
      : (kind === "posts" ? "Open to read the full post." : "Open to inspect this project.");
    detailLink.href = entry.url;
    showEl(detailEl);
    statusEl.textContent = `Projecting: ${entry.title}`;
  };

  const closeDetail = () => {
    hideEl(detailEl);
    selectedEntry = null;
    holoActive = false;
    playHolodeckDeactivate();
    statusEl.textContent = "Holotable idle.";
  };

  /* ── Event handlers ── */
  listClose.addEventListener("click", closeListModal);
  listModal.addEventListener("click", (ev) => { if (ev.target === listModal) closeListModal(); });

  entryList.addEventListener("click", (ev) => {
    const btn = ev.target.closest(".holodeck-entry-btn");
    if (!btn) return;
    const idx = parseInt(btn.dataset.index, 10);
    if (!isNaN(idx)) projectEntry(idx);
  });

  detailClose.addEventListener("click", closeDetail);
  detailEl.addEventListener("click", (ev) => { if (ev.target === detailEl) closeDetail(); });

  window.addEventListener("keydown", (ev) => {
    if (ctrlKeys.has(ev.code)) ev.preventDefault();
    keyState[ev.code] = true;
    if (ev.code === "KeyE" && nearHolodeck && listModal.hidden && detailEl.hidden) openListModal();
    if (ev.code === "Escape") {
      if (!listModal.hidden) closeListModal();
      else if (!detailEl.hidden) closeDetail();
    }
  });
  window.addEventListener("keyup", (ev) => { keyState[ev.code] = false; });

  const pointer = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  canvas.addEventListener("pointerdown", (ev) => {
    if (!listModal.hidden || !detailEl.hidden) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 - 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(clickable, false);
    if (hits.length && hits[0].object.userData.isHolodeck) openListModal();
  });

  /* ── Resize ── */
  const resize = () => {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.9));
    camera.fov = isMobile() ? 76 : 58;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  if (typeof ResizeObserver === "function") new ResizeObserver(resize).observe(canvas);
  else window.addEventListener("resize", resize);
  resize();

  /* ── Tick ── */
  const velocity = new THREE.Vector3();
  const cameraAnchor = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();
  const clock = new THREE.Clock();

  const tick = () => {
    const dt = clock.getDelta();
    elapsed += dt;

    // Input
    const ix = (keyState.KeyD || keyState.ArrowRight ? 1 : 0) - (keyState.KeyA || keyState.ArrowLeft ? 1 : 0);
    const iz = (keyState.KeyS || keyState.ArrowDown ? 1 : 0) - (keyState.KeyW || keyState.ArrowUp ? 1 : 0);
    let inX = ix, inZ = iz;
    const len = Math.sqrt(inX * inX + inZ * inZ);
    if (len > 1) { inX /= len; inZ /= len; }

    const speed = 7;
    velocity.x += (inX * speed - velocity.x) * Math.min(1, dt * 9);
    velocity.z += (inZ * speed - velocity.z) * Math.min(1, dt * 9);
    avatar.position.x = clamp(avatar.position.x + velocity.x * dt, -boundHalf, boundHalf);
    avatar.position.z = clamp(avatar.position.z + velocity.z * dt, -boundHalf, boundHalf);

    // Holotable collision: keep avatar outside the table footprint.
    const holoPos = holoGroup.position;
    const dx = avatar.position.x - holoPos.x;
    const dz = avatar.position.z - holoPos.z;
    const distance = Math.hypot(dx, dz) || 0.0001;
    const minDistance = holotableCollisionRadius + avatarRadius;
    if (distance < minDistance) {
      const nx = dx / distance;
      const nz = dz / distance;
      const push = minDistance - distance;
      avatar.position.x += nx * push;
      avatar.position.z += nz * push;

      const inwardSpeed = velocity.x * nx + velocity.z * nz;
      if (inwardSpeed < 0) {
        velocity.x -= inwardSpeed * nx;
        velocity.z -= inwardSpeed * nz;
      }
    }

    const isMoving = Math.abs(velocity.x) + Math.abs(velocity.z) > 0.09;

    if (!reducedMotion) {
      const targetRot = Math.atan2(velocity.x, velocity.z || 0.0001) + Math.PI;
      let diff = targetRot - avatar.rotation.y;
      // Normalize to [-π, π] for shortest path
      diff = ((diff + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      avatar.rotation.y += diff * Math.min(1, dt * 9);
      if (isMoving) {
        const spd = Math.abs(velocity.x) + Math.abs(velocity.z);
        fadeToAction(spd > 5.5 ? "Run" : "Walk");
      } else {
        fadeToAction("Idle");
      }

      avatarRing.material.opacity = 0.4 + Math.sin(elapsed * 3) * 0.1;
      avatarArrow.position.y = 2.8 + Math.sin(elapsed * 2.5) * 0.08;

      // Data-stream particles — rise and reset
      const pp = pGeo.attributes.position.array;
      for (let i = 0; i < pCount; i++) {
        pp[i * 3 + 1] += pSpd[i] * dt * (holoActive ? 1.8 : 0.4);
        if (pp[i * 3 + 1] > 14) {
          const a = Math.random() * Math.PI * 2;
          const r = Math.random() * (holoActive ? 5 : 8);
          pp[i * 3]     = Math.cos(a) * r;
          pp[i * 3 + 1] = 0.5;
          pp[i * 3 + 2] = Math.sin(a) * r - 6;
        }
      }
      pGeo.attributes.position.needsUpdate = true;
      particlesMesh.material.opacity = holoActive ? 0.55 : 0.3;

      // Holotable animations
      holoSphere.rotation.y += dt * (holoActive ? 0.5 : 0.15);
      holoSphere.rotation.x = Math.sin(elapsed * 0.3) * 0.1;
      const targetSphereOp = holoActive ? 0.2 + Math.sin(elapsed * 2) * 0.05 : 0.05;
      holoSphere.material.opacity += (targetSphereOp - holoSphere.material.opacity) * Math.min(1, dt * 4);

      // Scanning beam rises and resets
      scanBeam.position.y += dt * (holoActive ? 3.0 : 1.2);
      if (scanBeam.position.y > 11) scanBeam.position.y = 1.5;
      scanBeam.material.opacity = holoActive ? 0.15 + Math.sin(elapsed * 4) * 0.05 : 0.06;

      // Projection cone
      const targetConeOp = holoActive ? 0.08 + Math.sin(elapsed * 1.5) * 0.02 : 0.02;
      projCone.material.opacity += (targetConeOp - projCone.material.opacity) * Math.min(1, dt * 4);

      // Ring glow pulse
      const basePulse = 0.4 + Math.sin(elapsed * 2) * 0.15;
      const activePulse = 0.9 + Math.sin(elapsed * 3) * 0.1;
      [ring1, ring2, ring3].forEach((ring, i) => {
        ring.material.opacity = holoActive ? activePulse : basePulse;
        ring.material.emissiveIntensity = holoActive ? 1.2 + Math.sin(elapsed * 3 + i) * 0.3 : 0.5;
      });

      // Emitter glow
      emitter.material.emissiveIntensity = holoActive ? 2.0 + Math.sin(elapsed * 4) * 0.5 : 0.8;

      // Light intensity
      holoLight.intensity += ((holoActive ? 3.0 : 0.5) - holoLight.intensity) * Math.min(1, dt * 4);
      rimL1.intensity += ((holoActive ? 0.8 : 0.3) - rimL1.intensity) * Math.min(1, dt * 3);
      rimL2.intensity += ((holoActive ? 0.8 : 0.3) - rimL2.intensity) * Math.min(1, dt * 3);

      // Footsteps
      if (isMoving) {
        updateFootsteps(Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z) * dt);
      } else {
        resetFootsteps();
      }

      // Subtle star twinkle
      if (Math.random() < 0.3) {
        const idx = Math.floor(Math.random() * starCount);
        starGeo.attributes.position.array[idx * 3 + 1] += Math.sin(elapsed * 10 + idx) * 0.01;
        starGeo.attributes.position.needsUpdate = true;
      }
    }

    // Proximity to holotable
    const distToHolo = Math.hypot(avatar.position.x - holoPos.x, avatar.position.z - holoPos.z);
    nearHolodeck = distToHolo < 12;

    if (nearHolodeck) {
      if (listModal.hidden && detailEl.hidden) {
        promptEl.textContent = "Press E or click the holotable to browse entries";
        if (selectedEntry === null) statusEl.textContent = "Near the holotable";
      }
      updateProximityHum(Math.max(0, 1 - distToHolo / 12));
    } else {
      if (listModal.hidden && detailEl.hidden) {
        promptEl.textContent = "";
        if (selectedEntry === null) statusEl.textContent = "Approach the holotable.";
      }
      updateProximityHum(0);
    }

    // UI panel
    if (uiPanel) uiPanel.classList.toggle("hidden-ui", avatar.position.z < 8);

    // Camera
    const mob = isMobile();
    const camZ = mob ? 14 : 10;
    const camY = mob ? 6.5 : 5;
    cameraAnchor.set(avatar.position.x * 0.4, camY, avatar.position.z + camZ);
    camera.position.lerp(cameraAnchor, Math.min(1, dt * 4));

    // Look bias toward holotable when close (skip when modal open to prevent camera snap)
    const modalOpen = !listModal.hidden || !detailEl.hidden;
    if (!modalOpen) {
      lookTarget.set(avatar.position.x * 0.2, 2.5, avatar.position.z - 5);
      if (nearHolodeck) {
        const blend = 1 - distToHolo / 12;
        lookTarget.x += (holoPos.x - lookTarget.x) * blend * 0.4;
        lookTarget.y += (4.0 - lookTarget.y) * blend * 0.4;
        lookTarget.z += (holoPos.z - lookTarget.z) * blend * 0.3;
      }
    }
    camera.lookAt(lookTarget);

    if (mixer) mixer.update(dt);
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  };

  statusEl.textContent = `Holotable ready — ${entries.length} ${kind} loaded.`;

  // Mute toggle
  const muteBtn = document.getElementById("holodeck-mute");
  if (muteBtn) muteBtn.addEventListener("click", () => {
    muteBtn.textContent = toggleMute() ? "🔇 Muted" : "🔊 Sound";
  });

  // Ambient
  let ambStarted = false;
  const initAmb = () => { if (ambStarted) return; ambStarted = true; startAmbient("/models/ambient-drone.wav"); };
  canvas.addEventListener("pointerdown", initAmb, { once: false });
  window.addEventListener("keydown", initAmb, { once: false });

  tick();
};

bootHolodeck();
