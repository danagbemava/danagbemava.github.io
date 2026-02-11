import * as THREE from "https://unpkg.com/three@0.161.0/build/three.module.js";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const withFallbackSummary = (entry, kind) => {
  if (entry.summary && entry.summary.trim().length > 0) {
    const normalized = entry.summary.trim();
    if (normalized.length > 22 && normalized.toLowerCase() !== "background") {
      return normalized;
    }
  }

  if (kind === "posts") {
    return "Open this door to read the full write-up and details for this post.";
  }

  return "Open this door to inspect this project and explore details on the project page.";
};

const createLabelSprite = (text, color, bgColor) => {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  canvas.width = 1024;
  canvas.height = 256;
  context.fillStyle = bgColor;
  context.strokeStyle = "rgba(255,255,255,0.35)";
  context.lineWidth = 4;
  context.fillRect(12, 12, canvas.width - 24, canvas.height - 24);
  context.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);

  context.fillStyle = color;
  context.font = "700 62px Sora, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";

  const maxLength = 36;
  const title = text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
  context.fillText(title, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(3.9, 0.95, 1);
  return sprite;
};

const bootTimeline = () => {
  const canvas = document.getElementById("timeline-canvas");
  const dataElement = document.getElementById("timeline-data");
  const statusElement = document.getElementById("timeline-status");
  const promptElement = document.getElementById("timeline-prompt");
  const modal = document.getElementById("timeline-modal");
  const modalTitle = document.getElementById("timeline-modal-title");
  const modalMeta = document.getElementById("timeline-modal-meta");
  const modalSummary = document.getElementById("timeline-modal-summary");
  const modalLink = document.getElementById("timeline-modal-link");
  const modalCloseButton = document.getElementById("timeline-modal-close");

  if (!canvas || !dataElement || !statusElement || !promptElement || !modal || !modalTitle || !modalMeta || !modalSummary || !modalLink || !modalCloseButton) {
    return;
  }

  let entries = [];
  try {
    entries = JSON.parse(dataElement.textContent || "[]");
  } catch (error) {
    console.error("Could not parse timeline data:", error);
  }

  if (!entries.length) {
    statusElement.textContent = "No timeline entries yet. Add content to populate this world.";
    promptElement.textContent = "";
    return;
  }

  const kind = canvas.dataset.kind === "posts" ? "posts" : "projects";
  const palette = kind === "posts"
    ? {
        bg: 0x081a20,
        fog: 0x11313b,
        floor: 0x0b2228,
        line: 0x4cc3d1,
        marker: 0x93f1ff,
        frame: 0x6fd2db,
        panel: 0x103741,
        panelAccent: 0x59dceb,
        labelText: "#e3fcff",
        labelBg: "rgba(12, 43, 51, 0.68)",
      }
    : {
        bg: 0x121d1a,
        fog: 0x2a3b36,
        floor: 0x172a25,
        line: 0xd48b3a,
        marker: 0xffbe76,
        frame: 0xf0b576,
        panel: 0x324942,
        panelAccent: 0xff9e3d,
        labelText: "#fff8ef",
        labelBg: "rgba(61, 40, 23, 0.7)",
      };

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  } catch (error) {
    statusElement.textContent = "3D scene could not be initialized in this browser.";
    console.error("WebGL renderer init failed:", error);
    return;
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(palette.bg);
  scene.fog = new THREE.Fog(palette.fog, 26, 170);

  const camera = new THREE.PerspectiveCamera(54, 1, 0.1, 320);
  camera.position.set(0, 5.2, 12.8);

  const hemisphere = new THREE.HemisphereLight(0xd4f4f3, 0x28473f, 1.05);
  scene.add(hemisphere);

  const rimLight = new THREE.DirectionalLight(0xffd6a0, 0.88);
  rimLight.position.set(7, 9, 11);
  scene.add(rimLight);

  const fillLight = new THREE.DirectionalLight(0x8de6ef, 0.52);
  fillLight.position.set(-8, 4, -10);
  scene.add(fillLight);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(72, 420),
    new THREE.MeshStandardMaterial({
      color: palette.floor,
      roughness: 0.93,
      metalness: 0.04,
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  scene.add(floor);

  const timelineSpacing = 17.5;
  const entryStartZ = -16;
  const lastDoorZ = entryStartZ - ((entries.length - 1) * timelineSpacing);
  const minZ = lastDoorZ - 14;
  const maxZ = 7;

  const centerLineLength = Math.abs(minZ) + 28;
  const centerLine = new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 0.1, centerLineLength),
    new THREE.MeshStandardMaterial({ color: palette.line, emissive: palette.line, emissiveIntensity: 0.18 })
  );
  centerLine.position.set(0, 0.07, -(centerLineLength / 2) + 8);
  scene.add(centerLine);

  const laneMarkerGeometry = new THREE.BoxGeometry(1.8, 0.05, 0.4);
  const laneMarkerMaterial = new THREE.MeshStandardMaterial({ color: 0xe3faf7, transparent: true, opacity: 0.38 });
  for (let i = 0; i < entries.length * 5; i += 1) {
    const marker = new THREE.Mesh(laneMarkerGeometry, laneMarkerMaterial);
    marker.position.set(0, 0.06, -i * 4.2 + 6);
    scene.add(marker);
  }

  const mobile = window.matchMedia("(max-width: 900px)").matches;
  const particleCount = mobile ? 240 : 520;
  const particlePositions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i += 1) {
    const idx = i * 3;
    particlePositions[idx] = (Math.random() - 0.5) * 56;
    particlePositions[idx + 1] = Math.random() * 28 + 2;
    particlePositions[idx + 2] = Math.random() * (Math.abs(minZ) + 50) + minZ - 10;
  }
  const particlesGeometry = new THREE.BufferGeometry();
  particlesGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
  const particlesMaterial = new THREE.PointsMaterial({
    color: palette.marker,
    size: mobile ? 0.075 : 0.09,
    transparent: true,
    opacity: 0.66,
  });
  const particles = new THREE.Points(particlesGeometry, particlesMaterial);
  scene.add(particles);

  const avatar = new THREE.Group();
  const avatarBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.48, 1.25, 18),
    new THREE.MeshStandardMaterial({ color: 0xf4eee6, roughness: 0.44, metalness: 0.18 })
  );
  avatarBody.position.y = 1.08;
  avatar.add(avatarBody);

  const avatarHead = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 20, 20),
    new THREE.MeshStandardMaterial({ color: 0xffe3c8, roughness: 0.52, metalness: 0.06 })
  );
  avatarHead.position.y = 1.95;
  avatar.add(avatarHead);

  const avatarBackpack = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.42, 0.14),
    new THREE.MeshStandardMaterial({ color: palette.panelAccent, roughness: 0.4, metalness: 0.1 })
  );
  avatarBackpack.position.set(0, 1.1, 0.32);
  avatar.add(avatarBackpack);

  const avatarShadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.6, 32),
    new THREE.MeshBasicMaterial({ color: 0x010202, transparent: true, opacity: 0.3 })
  );
  avatarShadow.rotation.x = -Math.PI / 2;
  avatarShadow.position.y = 0.021;
  avatar.add(avatarShadow);

  avatar.position.set(0, 0, 5.4);
  scene.add(avatar);

  const doorObjects = [];
  const clickableMeshes = [];
  const entryMetaSprites = [];

  const createDoor = (entry, index) => {
    const side = index % 2 === 0 ? -1 : 1;
    const x = side * 8.9;
    const z = entryStartZ - index * timelineSpacing;

    const doorRoot = new THREE.Group();
    doorRoot.position.set(x, 2.36, z);
    doorRoot.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;

    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 6.4, 0.75),
      new THREE.MeshStandardMaterial({
        color: palette.frame,
        roughness: 0.37,
        metalness: 0.34,
      })
    );
    doorRoot.add(frame);

    const innerVoid = new THREE.Mesh(
      new THREE.BoxGeometry(2.82, 5.8, 0.35),
      new THREE.MeshStandardMaterial({
        color: palette.panel,
        emissive: palette.panelAccent,
        emissiveIntensity: 0.18,
        roughness: 0.42,
        metalness: 0.22,
      })
    );
    innerVoid.position.z = 0.15;
    doorRoot.add(innerVoid);

    const pivot = new THREE.Group();
    pivot.position.set(-1.3, 0, 0.31);

    const doorLeaf = new THREE.Mesh(
      new THREE.BoxGeometry(2.58, 5.58, 0.14),
      new THREE.MeshStandardMaterial({
        color: kind === "posts" ? 0x215a66 : 0x4f3d2d,
        emissive: palette.panelAccent,
        emissiveIntensity: 0.08,
        roughness: 0.5,
        metalness: 0.1,
      })
    );
    doorLeaf.position.x = 1.29;
    pivot.add(doorLeaf);
    doorRoot.add(pivot);

    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.95, 6.1),
      new THREE.MeshBasicMaterial({
        color: palette.panelAccent,
        transparent: true,
        opacity: 0.09,
      })
    );
    glow.position.z = 0.5;
    doorRoot.add(glow);

    const labelSprite = createLabelSprite(entry.title, palette.labelText, palette.labelBg);
    if (labelSprite) {
      labelSprite.position.set(0, 4.4, 0.65);
      doorRoot.add(labelSprite);
    }

    const metaSprite = createLabelSprite(entry.dateLabel || "Entry", palette.labelText, "rgba(8, 25, 29, 0.48)");
    if (metaSprite) {
      metaSprite.position.set(0, -4.3, 0.58);
      metaSprite.scale.set(2.8, 0.64, 1);
      doorRoot.add(metaSprite);
      entryMetaSprites.push(metaSprite);
    }

    const connectorLength = Math.abs(x) - 1.8;
    const connector = new THREE.Mesh(
      new THREE.BoxGeometry(connectorLength, 0.12, 0.12),
      new THREE.MeshStandardMaterial({ color: palette.line, emissive: palette.line, emissiveIntensity: 0.22 })
    );
    connector.position.set(x / 2, 0.3, z);
    scene.add(connector);

    const checkpoint = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.2, 0.5, 24),
      new THREE.MeshStandardMaterial({
        color: palette.marker,
        emissive: palette.panelAccent,
        emissiveIntensity: 0.4,
        roughness: 0.4,
        metalness: 0.15,
      })
    );
    checkpoint.position.set(0, 0.24, z);
    scene.add(checkpoint);

    frame.userData.doorIndex = index;
    innerVoid.userData.doorIndex = index;
    doorLeaf.userData.doorIndex = index;
    glow.userData.doorIndex = index;

    clickableMeshes.push(frame, innerVoid, doorLeaf, glow);
    scene.add(doorRoot);

    doorObjects.push({
      entry,
      index,
      x,
      z,
      root: doorRoot,
      innerVoid,
      pivot,
      glow,
      openAmount: 0,
      targetOpen: 0,
    });
  };

  entries.forEach((entry, index) => createDoor(entry, index));

  const keyState = {};
  let selectedDoorIndex = null;
  let nearestDoor = null;

  const setModalState = (isOpen) => {
    modal.hidden = !isOpen;
    modal.setAttribute("aria-hidden", isOpen ? "false" : "true");
  };

  const openDoor = (doorIndex) => {
    const door = doorObjects[doorIndex];
    if (!door) {
      return;
    }

    selectedDoorIndex = doorIndex;
    doorObjects.forEach((entryDoor, index) => {
      entryDoor.targetOpen = index === doorIndex ? 1 : 0;
    });

    modalTitle.textContent = door.entry.title;
    modalMeta.textContent = `${door.entry.dateLabel || "Entry"} • ${door.entry.tags || (kind === "posts" ? "Post" : "Project")}`;
    modalSummary.textContent = withFallbackSummary(door.entry, kind);
    modalLink.href = door.entry.url;
    modalLink.textContent = kind === "posts" ? "Read Post" : "Open Project";
    setModalState(true);

    statusElement.textContent = `Opened: ${door.entry.title}`;
    promptElement.textContent = "";
  };

  const closeModal = () => {
    setModalState(false);
    selectedDoorIndex = null;
    doorObjects.forEach((entryDoor) => {
      entryDoor.targetOpen = 0;
    });
  };

  modalCloseButton.addEventListener("click", closeModal);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeModal();
    }
  });

  const controlKeys = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyE"]);
  window.addEventListener("keydown", (event) => {
    if (controlKeys.has(event.code)) {
      event.preventDefault();
    }
    keyState[event.code] = true;
    if (event.code === "KeyE" && nearestDoor) {
      openDoor(nearestDoor.index);
    }
    if (event.code === "Escape") {
      closeModal();
    }
  });
  window.addEventListener("keyup", (event) => {
    keyState[event.code] = false;
  });

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  canvas.addEventListener("pointerdown", (event) => {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return;
    }

    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    raycaster.setFromCamera(pointer, camera);
    const intersections = raycaster.intersectObjects(clickableMeshes, false);
    if (!intersections.length) {
      return;
    }

    const index = intersections[0].object.userData.doorIndex;
    if (typeof index === "number") {
      openDoor(index);
    }
  });

  const resize = () => {
    const width = canvas.clientWidth || canvas.parentElement?.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || canvas.parentElement?.clientHeight || window.innerHeight;
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.85));
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  const observer = typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
  if (observer) {
    observer.observe(canvas);
  } else {
    window.addEventListener("resize", resize);
  }
  resize();

  const velocity = new THREE.Vector3(0, 0, 0);
  const inputVector = new THREE.Vector2(0, 0);
  const cameraAnchor = new THREE.Vector3();
  const lookAtTarget = new THREE.Vector3();
  const worldTime = new THREE.Clock();
  let elapsedTime = 0;
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const animate = () => {
    const delta = worldTime.getDelta();
    elapsedTime += delta;

    inputVector.set(
      Number(keyState.KeyD || keyState.ArrowRight) - Number(keyState.KeyA || keyState.ArrowLeft),
      Number(keyState.KeyS || keyState.ArrowDown) - Number(keyState.KeyW || keyState.ArrowUp)
    );
    if (inputVector.lengthSq() > 1) {
      inputVector.normalize();
    }

    const targetSpeed = 6.8;
    velocity.x += ((inputVector.x * targetSpeed) - velocity.x) * Math.min(1, delta * 8.8);
    velocity.z += ((inputVector.y * targetSpeed) - velocity.z) * Math.min(1, delta * 8.8);

    avatar.position.x += velocity.x * delta;
    avatar.position.z += velocity.z * delta;
    avatar.position.x = clamp(avatar.position.x, -3.7, 3.7);
    avatar.position.z = clamp(avatar.position.z, minZ, maxZ);

    const moving = Math.abs(velocity.x) + Math.abs(velocity.z) > 0.08;
    if (!prefersReducedMotion) {
      avatar.position.y = moving ? Math.sin(elapsedTime * 10) * 0.06 : 0;
      avatar.rotation.y += ((Math.atan2(velocity.x, velocity.z || 0.0001) - avatar.rotation.y) * Math.min(1, delta * 8)) || 0;
      particles.rotation.y = elapsedTime * 0.03;
      particles.position.y = Math.sin(elapsedTime * 0.6) * 0.12;
      entryMetaSprites.forEach((sprite, index) => {
        sprite.material.opacity = 0.55 + Math.sin(elapsedTime * 1.6 + index) * 0.12;
      });
    }

    nearestDoor = null;
    let nearestDistance = Infinity;
    for (const door of doorObjects) {
      const distance = Math.hypot(avatar.position.x - door.x, avatar.position.z - door.z);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestDoor = door;
      }

      door.openAmount += (door.targetOpen - door.openAmount) * Math.min(1, delta * 8.5);
      door.pivot.rotation.y = -door.openAmount * Math.PI * 0.66;
      door.glow.material.opacity = 0.08 + door.openAmount * 0.26;
      door.innerVoid.material.emissiveIntensity = 0.18 + door.openAmount * 0.66;
    }

    if (nearestDoor && nearestDistance < 4.9) {
      promptElement.textContent = `Press E or click to open: ${nearestDoor.entry.title}`;
      if (selectedDoorIndex === null) {
        statusElement.textContent = `Near ${kind === "posts" ? "post" : "project"}: ${nearestDoor.entry.title}`;
      }
    } else {
      promptElement.textContent = "";
      if (selectedDoorIndex === null) {
        statusElement.textContent = "Walk the corridor to discover each door.";
      }
    }

    cameraAnchor.set(avatar.position.x * 0.55, 5.6, avatar.position.z + 12.5);
    camera.position.lerp(cameraAnchor, Math.min(1, delta * 4.5));
    lookAtTarget.set(avatar.position.x * 0.2, 1.5, avatar.position.z - 7.2);
    camera.lookAt(lookAtTarget);

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  };

  statusElement.textContent = `Loaded ${entries.length} ${kind === "posts" ? "posts" : "projects"} doors.`;
  animate();
};

bootTimeline();
