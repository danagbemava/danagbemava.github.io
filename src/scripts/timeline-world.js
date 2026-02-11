import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  updateFootsteps, resetFootsteps, playDoorOpen, playDoorClose, playPortalEnter, playBeep,
  updateProximityHum, startAmbient, toggleMute, isMuted
} from "./sfx.js";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const fallbackSummary = (entry, kind) => {
  if (entry.summary && entry.summary.trim().length > 16) {
    return entry.summary.trim();
  }

  if (kind === "posts") {
    return "Open this door to read the full post.";
  }

  return "Open this door to inspect this project in detail.";
};

const makeLabel = (text, background, foreground) => {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  canvas.width = 1024;
  canvas.height = 256;
  context.fillStyle = background;
  context.strokeStyle = "rgba(255,255,255,0.25)";
  context.lineWidth = 4;
  context.fillRect(10, 10, canvas.width - 20, canvas.height - 20);
  context.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
  context.fillStyle = foreground;
  context.textAlign = "center";
  context.textBaseline = "middle";

  const maxWidth = canvas.width - 60;
  let fontSize = 62;
  context.font = `700 ${fontSize}px Sora, sans-serif`;
  while (context.measureText(text).width > maxWidth && fontSize > 28) {
    fontSize -= 2;
    context.font = `700 ${fontSize}px Sora, sans-serif`;
  }

  const maxLength = 60;
  const normalized = text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
  context.fillText(normalized, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true
    })
  );
  sprite.scale.set(3.9, 0.95, 1);
  return sprite;
};

const bootTimeline = () => {
  const canvas = document.getElementById("timeline-canvas");
  const statusNode = document.getElementById("timeline-status");
  const promptNode = document.getElementById("timeline-prompt");
  const uiPanel = canvas?.parentElement?.querySelector(".timeline-ui");
  const modal = document.getElementById("timeline-modal");
  const modalClose = document.getElementById("timeline-modal-close");
  const modalMeta = document.getElementById("timeline-modal-meta");
  const modalTitle = document.getElementById("timeline-modal-title");
  const modalSummary = document.getElementById("timeline-modal-summary");
  const modalLink = document.getElementById("timeline-modal-link");
  const dataNode = document.getElementById("timeline-data");

  if (
    !canvas ||
    !statusNode ||
    !promptNode ||
    !modal ||
    !modalClose ||
    !modalMeta ||
    !modalTitle ||
    !modalSummary ||
    !modalLink ||
    !dataNode
  ) {
    return;
  }

  let entries = [];
  try {
    entries = JSON.parse(dataNode.textContent || "[]");
  } catch (error) {
    console.error("Could not parse timeline data:", error);
    statusNode.textContent = "Timeline data is invalid.";
    return;
  }

  if (!entries.length) {
    statusNode.textContent = "No entries found for this timeline.";
    return;
  }

  const kind = canvas.dataset.kind === "posts" ? "posts" : "projects";
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const palette =
    kind === "posts"
      ? {
          bg: 0x081a20,
          fog: 0x14333b,
          floor: 0x0a252d,
          line: 0x55cddd,
          frame: 0x72d9e5,
          door: 0x1e5f6b,
          accent: 0x5be8f2,
          labelBg: "rgba(11, 43, 52, 0.7)",
          labelText: "#e7fdff"
        }
      : {
          bg: 0x121d1a,
          fog: 0x2d3f39,
          floor: 0x182c27,
          line: 0xd88f43,
          frame: 0xf0ba7d,
          door: 0x5f4730,
          accent: 0xffb368,
          labelBg: "rgba(67, 43, 23, 0.72)",
          labelText: "#fff6ec"
        };

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  } catch (error) {
    console.error("WebGL initialization failed:", error);
    statusNode.textContent = "Could not initialize the 3D scene.";
    return;
  }

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(palette.bg);
  scene.fog = new THREE.Fog(palette.fog, 20, 180);

  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 340);
  camera.position.set(0, 4.6, 11.2);

  scene.add(new THREE.HemisphereLight(0xd6f6fa, 0x204a43, 1.04));
  const sun = new THREE.DirectionalLight(0xffd8aa, 0.94);
  sun.position.set(9, 12, 14);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x81e7f1, 0.54);
  fill.position.set(-10, 5, -14);
  scene.add(fill);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 460),
    new THREE.MeshStandardMaterial({
      color: palette.floor,
      roughness: 0.94,
      metalness: 0.05
    })
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const centerLineLength = 300;
  const centerLine = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.08, centerLineLength),
    new THREE.MeshStandardMaterial({
      color: palette.line,
      emissive: palette.line,
      emissiveIntensity: 0.2
    })
  );
  centerLine.position.set(0, 0.06, -centerLineLength * 0.5 + 8);
  scene.add(centerLine);

  for (let index = 0; index < entries.length * 7; index += 1) {
    const marker = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.05, 0.42),
      new THREE.MeshStandardMaterial({ color: 0xdffbff, transparent: true, opacity: 0.34 })
    );
    marker.position.set(0, 0.05, 5 - index * 3.2);
    scene.add(marker);
  }

  // ── Enhanced particles (varying sizes, drift, color bands) ──
  const isMobile = window.matchMedia("(max-width: 900px)").matches;
  const particleCount = isMobile ? 350 : 900;
  const points = new Float32Array(particleCount * 3);
  const sizes = new Float32Array(particleCount);
  const speeds = new Float32Array(particleCount);
  for (let i = 0; i < particleCount; i += 1) {
    const cursor = i * 3;
    points[cursor] = (Math.random() - 0.5) * 70;
    points[cursor + 1] = Math.random() * 38 + 1;
    points[cursor + 2] = (Math.random() - 0.5) * 320;
    sizes[i] = 0.04 + Math.random() * 0.14;
    speeds[i] = 0.2 + Math.random() * 0.8;
  }
  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute("position", new THREE.BufferAttribute(points, 3));
  const particles = new THREE.Points(
    particleGeometry,
    new THREE.PointsMaterial({
      color: palette.accent,
      size: 0.1,
      transparent: true,
      opacity: 0.6,
      sizeAttenuation: true
    })
  );
  scene.add(particles);

  // Secondary particle layer (dimmer, slower, larger spread)
  const dustCount = isMobile ? 120 : 300;
  const dustPos = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 90;
    dustPos[i * 3 + 1] = Math.random() * 20 + 0.5;
    dustPos[i * 3 + 2] = (Math.random() - 0.5) * 340;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
  const dustParticles = new THREE.Points(
    dustGeo,
    new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.04,
      transparent: true,
      opacity: 0.2,
      sizeAttenuation: true
    })
  );
  scene.add(dustParticles);

  // ── Floating geometric debris ──
  const debrisGroup = new THREE.Group();
  const debrisGeos = [
    new THREE.OctahedronGeometry(0.3, 0),
    new THREE.TetrahedronGeometry(0.35, 0),
    new THREE.IcosahedronGeometry(0.25, 0),
    new THREE.BoxGeometry(0.3, 0.3, 0.3)
  ];
  const debrisMat = new THREE.MeshStandardMaterial({
    color: palette.accent,
    emissive: palette.accent,
    emissiveIntensity: 0.15,
    transparent: true,
    opacity: 0.35,
    roughness: 0.5,
    metalness: 0.6,
    wireframe: true
  });
  const debrisCount = isMobile ? 14 : 30;
  const debrisItems = [];
  for (let i = 0; i < debrisCount; i++) {
    const geo = debrisGeos[Math.floor(Math.random() * debrisGeos.length)];
    const mesh = new THREE.Mesh(geo, debrisMat);
    mesh.position.set(
      (Math.random() - 0.5) * 60,
      3 + Math.random() * 22,
      (Math.random() - 0.5) * 280
    );
    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    const s = 0.4 + Math.random() * 1.2;
    mesh.scale.set(s, s, s);
    debrisGroup.add(mesh);
    debrisItems.push({
      mesh,
      rotSpeed: (Math.random() - 0.5) * 0.8,
      bobSpeed: 0.3 + Math.random() * 0.7,
      bobAmp: 0.3 + Math.random() * 0.6,
      baseY: mesh.position.y
    });
  }
  scene.add(debrisGroup);

  // ── Energy pillars along the timeline ──
  const pillarGroup = new THREE.Group();
  const pillarItems = [];
  const pillarSpacing = 22;
  const pillarCount = Math.min(entries.length * 2 + 4, 20);
  for (let i = 0; i < pillarCount; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const z = 5 - i * pillarSpacing;
    const height = 6 + Math.random() * 10;

    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, height, 8),
      new THREE.MeshStandardMaterial({
        color: palette.accent,
        emissive: palette.accent,
        emissiveIntensity: 0.4,
        transparent: true,
        opacity: 0.25
      })
    );
    pillar.position.set(side * (16 + Math.random() * 6), height / 2, z);
    pillarGroup.add(pillar);

    // Glow orb at top
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 12, 12),
      new THREE.MeshBasicMaterial({
        color: palette.accent,
        transparent: true,
        opacity: 0.5
      })
    );
    orb.position.set(pillar.position.x, height + 0.2, z);
    pillarGroup.add(orb);

    // Point light at top
    const pLight = new THREE.PointLight(palette.accent, 0.6, 12, 2);
    pLight.position.copy(orb.position);
    pillarGroup.add(pLight);

    pillarItems.push({ pillar, orb, light: pLight, baseIntensity: 0.6, phase: Math.random() * Math.PI * 2 });
  }
  scene.add(pillarGroup);

  // ── Drifting fog layers ──
  const fogLayers = [];
  const fogMat = new THREE.MeshBasicMaterial({
    color: palette.fog,
    transparent: true,
    opacity: 0.08,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  for (let i = 0; i < 5; i++) {
    const fogPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 120),
      fogMat.clone()
    );
    fogPlane.rotation.x = -Math.PI / 2;
    fogPlane.position.set(
      (Math.random() - 0.5) * 20,
      1.5 + i * 3,
      -60 - i * 30
    );
    fogPlane.material.opacity = 0.04 + Math.random() * 0.06;
    scene.add(fogPlane);
    fogLayers.push({
      mesh: fogPlane,
      driftSpeed: 0.15 + Math.random() * 0.3,
      driftDir: Math.random() > 0.5 ? 1 : -1,
      baseX: fogPlane.position.x
    });
  }

  const avatar = new THREE.Group();

  // ── GLB Robot model ──
  let mixer = null;
  const animations = {};
  let activeAction = null;

  const fadeToAction = (name, duration = 0.35) => {
    const next = animations[name];
    if (!next || next === activeAction) return;
    if (activeAction) activeAction.fadeOut(duration);
    next.reset().fadeIn(duration).play();
    activeAction = next;
  };

  const loader = new GLTFLoader();
  loader.load("/models/robot.glb", (gltf) => {
    const model = gltf.scene;
    const s = isNarrow() ? 0.65 : 0.9;
    model.scale.set(s, s, s);
    model.position.y = 0;
    avatar.add(model);

    mixer = new THREE.AnimationMixer(model);
    for (const clip of gltf.animations) {
      animations[clip.name] = mixer.clipAction(clip);
    }
    if (animations.Idle) {
      animations.Idle.play();
      activeAction = animations.Idle;
    }
  });

  // Ground ring
  const avatarRing = new THREE.Mesh(
    new THREE.RingGeometry(0.7, 0.95, 48),
    new THREE.MeshBasicMaterial({
      color: palette.accent,
      transparent: true,
      opacity: 0.84
    })
  );
  avatarRing.rotation.x = -Math.PI / 2;
  avatarRing.position.y = 0.04;
  avatar.add(avatarRing);

  // Floating arrow
  const avatarArrow = new THREE.Mesh(
    new THREE.ConeGeometry(0.14, 0.32, 16),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: palette.accent,
      emissiveIntensity: 0.7
    })
  );
  avatarArrow.rotation.x = Math.PI;
  avatarArrow.position.set(0, 2.65, 0);
  avatar.add(avatarArrow);

  const avatarLight = new THREE.PointLight(0xfff0d1, 1.6, 20, 2);
  avatarLight.position.set(0, 2.45, 0);
  avatar.add(avatarLight);

  avatar.position.set(0, 0, 4.8);
  scene.add(avatar);

  const doorSpacing = 18.5;
  const firstDoorZ = -14;
  const lastDoorZ = firstDoorZ - (entries.length - 1) * doorSpacing;
  const minAvatarZ = lastDoorZ - 15;
  const maxAvatarZ = 7.6;

  const clickable = [];
  const doors = [];
  const metaSprites = [];

  const createDoor = (entry, index) => {
    const side = index % 2 === 0 ? -1 : 1;
    const x = side * 9.7;
    const z = firstDoorZ - index * doorSpacing;

    const root = new THREE.Group();
    root.position.set(x, 2.5, z);
    root.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;

    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(3.5, 6.7, 0.78),
      new THREE.MeshStandardMaterial({
        color: palette.frame,
        roughness: 0.34,
        metalness: 0.36
      })
    );
    root.add(frame);

    const inner = new THREE.Mesh(
      new THREE.BoxGeometry(2.9, 5.95, 0.34),
      new THREE.MeshStandardMaterial({
        color: 0x112f37,
        emissive: palette.accent,
        emissiveIntensity: 0.24,
        roughness: 0.44,
        metalness: 0.2
      })
    );
    inner.position.z = 0.17;
    root.add(inner);

    const pivot = new THREE.Group();
    pivot.position.set(-1.34, 0, 0.46);
    const leaf = new THREE.Mesh(
      new THREE.BoxGeometry(2.62, 5.72, 0.14),
      new THREE.MeshStandardMaterial({
        color: palette.door,
        emissive: palette.accent,
        emissiveIntensity: 0.1,
        roughness: 0.48
      })
    );
    leaf.position.x = 1.31;
    pivot.add(leaf);
    root.add(pivot);

    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(3.02, 6.16),
      new THREE.MeshBasicMaterial({
        color: palette.accent,
        transparent: true,
        opacity: 0.1
      })
    );
    glow.position.z = 0.5;
    root.add(glow);

    const titleLabel = makeLabel(entry.title, palette.labelBg, palette.labelText);
    if (titleLabel) {
      titleLabel.position.set(0, 4.42, 0.68);
      root.add(titleLabel);
    }

    const metaLabel = makeLabel(entry.dateLabel || "Entry", "rgba(9, 22, 28, 0.55)", "#eaf9fc");
    if (metaLabel) {
      metaLabel.position.set(0, -4.2, 0.6);
      metaLabel.scale.set(2.76, 0.62, 1);
      root.add(metaLabel);
      metaSprites.push(metaLabel);
    }

    const branch = new THREE.Mesh(
      new THREE.BoxGeometry(Math.abs(x) - 1.7, 0.12, 0.12),
      new THREE.MeshStandardMaterial({
        color: palette.line,
        emissive: palette.line,
        emissiveIntensity: 0.24
      })
    );
    branch.position.set(x / 2, 0.3, z);
    scene.add(branch);

    const node = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 0.48, 24),
      new THREE.MeshStandardMaterial({
        color: palette.accent,
        emissive: palette.accent,
        emissiveIntensity: 0.52
      })
    );
    node.position.set(0, 0.26, z);
    scene.add(node);

    for (const mesh of [frame, inner, leaf, glow]) {
      mesh.userData.doorIndex = index;
      clickable.push(mesh);
    }

    scene.add(root);
    doors.push({
      index,
      x,
      z,
      entry,
      root,
      inner,
      pivot,
      glow,
      openAmount: 0,
      targetOpen: 0
    });
  };

  entries.forEach((entry, index) => createDoor(entry, index));

  const keyState = {};
  const controls = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyE"]);
  let nearestDoor = null;
  let selectedDoor = null;
  let elapsed = 0;

  // Portal animation state
  let portalAnim = null; // { doorIndex, progress, startPos, targetPos, startScale }
  const PORTAL_DURATION = 0.85;
  const avatarStartPos = new THREE.Vector3();
  const avatarSavedPos = new THREE.Vector3();

  const showModal = (isVisible) => {
    modal.hidden = !isVisible;
    modal.setAttribute("aria-hidden", isVisible ? "false" : "true");
  };

  const closeModal = () => {
    showModal(false);
    selectedDoor = null;
    for (const door of doors) {
      door.targetOpen = 0;
    }
    playDoorClose();
    // Reset avatar if portal was cancelled (shouldn't happen, but safety)
    if (portalAnim) {
      avatar.position.copy(portalAnim.startPos);
      avatar.scale.set(1, 1, 1);
      avatar.visible = true;
      portalAnim = null;
    }
  };

  const resetAfterPortal = () => {
    portalAnim = null;
  };

  const openDoor = (doorIndex) => {
    const door = doors[doorIndex];
    if (!door || portalAnim) {
      return;
    }

    selectedDoor = doorIndex;
    for (const targetDoor of doors) {
      targetDoor.targetOpen = targetDoor.index === doorIndex ? 1 : 0;
    }

    modalMeta.textContent = `${door.entry.dateLabel || "Entry"} • ${door.entry.tags || (kind === "posts" ? "Post" : "Project")}`;
    modalTitle.textContent = door.entry.title;
    modalSummary.textContent = fallbackSummary(door.entry, kind);
    modalLink.href = door.entry.url;
    modalLink.textContent = kind === "posts" ? "Read Post" : "Open Project";
    statusNode.textContent = `Opened: ${door.entry.title}`;
    promptNode.textContent = "";
    showModal(true);
    playDoorOpen();
  };

  // Portal animation triggers on the affirmative link click
  modalLink.addEventListener("click", (event) => {
    event.preventDefault();
    const door = doors[selectedDoor];
    if (!door || portalAnim) {
      return;
    }

    const dest = modalLink.href;
    showModal(false);

    avatarStartPos.copy(avatar.position);
    portalAnim = {
      doorIndex: selectedDoor,
      progress: 0,
      startPos: avatarStartPos.clone(),
      targetPos: new THREE.Vector3(door.x, 1.2, door.z),
      entry: door.entry,
      navigateTo: dest
    };

    statusNode.textContent = `Entering: ${door.entry.title}`;
    promptNode.textContent = "";
    playPortalEnter();
  });

  modalClose.addEventListener("click", closeModal);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeModal();
    }
  });

  window.addEventListener("keydown", (event) => {
    if (controls.has(event.code)) {
      event.preventDefault();
    }
    keyState[event.code] = true;
    if (event.code === "KeyE" && nearestDoor) {
      openDoor(nearestDoor.index);
    }
    if (event.code === "Escape") {
      closeModal();
    }
    if (event.code === "Enter" && !modal.hidden) {
      modalLink.click();
    }
  });

  window.addEventListener("keyup", (event) => {
    keyState[event.code] = false;
  });

  const pointer = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  canvas.addEventListener("pointerdown", (event) => {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return;
    }
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    raycaster.setFromCamera(pointer, camera);
    const intersections = raycaster.intersectObjects(clickable, false);
    if (!intersections.length) {
      return;
    }
    const index = intersections[0].object.userData.doorIndex;
    if (typeof index === "number") {
      openDoor(index);
    }
  });

  const isNarrow = () => window.innerWidth < 700;

  const resize = () => {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.9));
    camera.fov = isNarrow() ? 78 : 58;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  if (typeof ResizeObserver === "function") {
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
  } else {
    window.addEventListener("resize", resize);
  }
  resize();

  const velocity = new THREE.Vector3(0, 0, 0);
  const input = new THREE.Vector2(0, 0);
  const cameraAnchor = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();
  const clock = new THREE.Clock();

  const tick = () => {
    const delta = clock.getDelta();
    elapsed += delta;

    input.set(
      (keyState.KeyD || keyState.ArrowRight ? 1 : 0) - (keyState.KeyA || keyState.ArrowLeft ? 1 : 0),
      (keyState.KeyS || keyState.ArrowDown ? 1 : 0) - (keyState.KeyW || keyState.ArrowUp ? 1 : 0)
    );
    if (input.lengthSq() > 1) {
      input.normalize();
    }

    const speed = 7.4;
    if (!portalAnim) {
      velocity.x += ((input.x * speed) - velocity.x) * Math.min(1, delta * 9);
      velocity.z += ((input.y * speed) - velocity.z) * Math.min(1, delta * 9);

      avatar.position.x = clamp(avatar.position.x + velocity.x * delta, -4.2, 4.2);
      avatar.position.z = clamp(avatar.position.z + velocity.z * delta, minAvatarZ, maxAvatarZ);
    }

    const isMoving = Math.abs(velocity.x) + Math.abs(velocity.z) > 0.09;
    if (uiPanel) {
      uiPanel.classList.toggle("hidden-ui", avatar.position.z < 3);
    }
    if (!reducedMotion) {
      avatar.rotation.y += (Math.atan2(velocity.x, velocity.z || 0.0001) - avatar.rotation.y) * Math.min(1, delta * 9);

      // Switch between Idle/Walking/Running animations
      if (isMoving) {
        const spd = Math.abs(velocity.x) + Math.abs(velocity.z);
        fadeToAction(spd > 5.5 ? "Running" : "Walking");
      } else {
        fadeToAction("Idle");
      }

      avatarRing.material.opacity = 0.72 + Math.sin(elapsed * 4) * 0.12;
      avatarArrow.position.y = 2.65 + Math.sin(elapsed * 3.4) * 0.1;
      particles.rotation.y = elapsed * 0.03;
      particles.position.y = Math.sin(elapsed * 0.6) * 0.12;
      dustParticles.rotation.y = -elapsed * 0.015;
      dustParticles.position.y = Math.sin(elapsed * 0.35 + 1) * 0.2;

      // Animate individual particle drift
      const posArr = particleGeometry.attributes.position.array;
      for (let i = 0; i < particleCount; i++) {
        posArr[i * 3 + 1] += Math.sin(elapsed * speeds[i] + i) * delta * 0.15;
      }
      particleGeometry.attributes.position.needsUpdate = true;

      // Floating debris rotation + bob
      for (const d of debrisItems) {
        d.mesh.rotation.x += d.rotSpeed * delta;
        d.mesh.rotation.y += d.rotSpeed * 0.7 * delta;
        d.mesh.position.y = d.baseY + Math.sin(elapsed * d.bobSpeed) * d.bobAmp;
      }

      // Energy pillar pulse
      for (const p of pillarItems) {
        const pulse = 0.5 + Math.sin(elapsed * 1.8 + p.phase) * 0.5;
        p.pillar.material.opacity = 0.15 + pulse * 0.2;
        p.pillar.material.emissiveIntensity = 0.2 + pulse * 0.5;
        p.orb.material.opacity = 0.3 + pulse * 0.4;
        p.light.intensity = p.baseIntensity * (0.5 + pulse * 0.5);
      }

      // Drifting fog
      for (const f of fogLayers) {
        f.mesh.position.x = f.baseX + Math.sin(elapsed * f.driftSpeed) * 8 * f.driftDir;
        f.mesh.material.opacity = 0.03 + Math.sin(elapsed * f.driftSpeed * 0.5) * 0.03;
      }

      // Footstep SFX synced to distance traveled
      if (isMoving) {
        const dist = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z) * delta;
        updateFootsteps(dist);
      } else {
        resetFootsteps();
      }

      for (let index = 0; index < metaSprites.length; index += 1) {
        const sprite = metaSprites[index];
        sprite.material.opacity = 0.5 + Math.sin(elapsed * 1.4 + index) * 0.14;
      }
    }

    // Portal pull animation
    if (portalAnim) {
      portalAnim.progress += delta / PORTAL_DURATION;
      const t = clamp(portalAnim.progress, 0, 1);
      // Ease-in curve for "being pulled" feel
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

      avatar.position.lerpVectors(portalAnim.startPos, portalAnim.targetPos, ease);
      const scaleVal = Math.max(0.01, 1 - ease * 0.95);
      avatar.scale.set(scaleVal, scaleVal, scaleVal);
      // Spin the avatar as it gets pulled in
      avatar.rotation.y += delta * 8 * ease;
      // Shrink the ring glow
      avatarRing.material.opacity = (1 - ease) * 0.84;

      // Zoom camera toward the door
      const door = doors[portalAnim.doorIndex];
      if (door) {
        const camTarget = new THREE.Vector3(
          door.x * 0.6,
          3.2 + (1 - ease) * 1.5,
          door.z + 4 * (1 - ease) + 2
        );
        camera.position.lerp(camTarget, Math.min(1, delta * 6));
        const doorLook = new THREE.Vector3(door.x * 0.5, 2.0, door.z);
        lookTarget.lerp(doorLook, Math.min(1, delta * 6));

        // Intensify door glow during animation
        door.glow.material.opacity = 0.1 + ease * 0.6;
        door.inner.material.emissiveIntensity = 0.24 + ease * 1.4;
      }

      if (t >= 1 && !portalAnim.closing) {
        avatar.visible = false;
        portalAnim.closing = true;
        portalAnim.closeTimer = 0;
        // Start closing the door
        for (const d of doors) {
          d.targetOpen = 0;
        }
        playDoorClose();
      }

      if (portalAnim.closing) {
        portalAnim.closeTimer += delta;
        if (portalAnim.closeTimer >= 0.6) {
          const dest = portalAnim.navigateTo;
          resetAfterPortal();
          selectedDoor = null;
          window.location.href = dest;
        }
      }
    }

    nearestDoor = null;
    let nearestDistance = Infinity;
    for (const door of doors) {
      const distance = Math.hypot(avatar.position.x - door.x, avatar.position.z - door.z);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestDoor = door;
      }

      door.openAmount += (door.targetOpen - door.openAmount) * Math.min(1, delta * 8.6);
      door.pivot.rotation.y = -door.openAmount * Math.PI * 0.5;
      door.glow.material.opacity = 0.1 + door.openAmount * 0.28;
      door.inner.material.emissiveIntensity = 0.24 + door.openAmount * 0.7;
    }

    if (nearestDoor && nearestDistance < 5) {
      promptNode.textContent = `Press E or click to open: ${nearestDoor.entry.title}`;
      if (selectedDoor === null) {
        statusNode.textContent = `Near ${kind === "posts" ? "post" : "project"}: ${nearestDoor.entry.title}`;
      }
      updateProximityHum(1 - nearestDistance / 5);
    } else {
      promptNode.textContent = "";
      if (selectedDoor === null) {
        statusNode.textContent = "Walk forward to discover more timeline doors.";
      }
      updateProximityHum(0);
    }

    const mobile = isNarrow();
    const camZ = mobile ? 13.5 : 9.5;
    const camY = mobile ? 5.8 : 4.7;
    cameraAnchor.set(avatar.position.x * 0.48, camY, avatar.position.z + camZ);
    camera.position.lerp(cameraAnchor, Math.min(1, delta * 5));
    lookTarget.set(avatar.position.x * 0.2, 1.5, avatar.position.z - 5.9);

    if (nearestDoor && nearestDistance < 12) {
      const doorBlend = 1 - nearestDistance / 12;
      lookTarget.x += (nearestDoor.x * 0.5 - lookTarget.x) * doorBlend;
      lookTarget.z += (nearestDoor.z - lookTarget.z) * doorBlend * 0.4;
    }

    camera.lookAt(lookTarget);

    if (mixer) mixer.update(delta);
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  };

  statusNode.textContent = `Loaded ${entries.length} ${kind === "posts" ? "posts" : "projects"} doors.`;

  // Sound mute toggle
  const muteBtn = document.getElementById("timeline-mute");
  if (muteBtn) {
    muteBtn.addEventListener("click", () => {
      const nowMuted = toggleMute();
      muteBtn.textContent = nowMuted ? "🔇 Muted" : "🔊 Sound";
    });
  }

  // Start ambient on first user interaction
  let ambientStarted = false;
  const initAmbient = () => {
    if (ambientStarted) return;
    ambientStarted = true;
    startAmbient("/models/ambient-drone.wav");
  };
  canvas.addEventListener("pointerdown", initAmbient, { once: false });
  window.addEventListener("keydown", initAmbient, { once: false });

  tick();
};

bootTimeline();
