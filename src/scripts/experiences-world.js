import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  updateFootsteps,
  resetFootsteps,
  playBeep,
  updateProximityHum,
  startAmbient,
  toggleMute,
  isMuted
} from "./sfx.js";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const makePlaque = (title, tenure) => {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  canvas.width = 768;
  canvas.height = 256;
  context.fillStyle = "rgba(12, 28, 22, 0.92)";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "rgba(123, 234, 199, 0.42)";
  context.lineWidth = 8;
  context.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

  context.textAlign = "center";
  context.textBaseline = "middle";

  context.fillStyle = "#dbfff2";
  context.font = "700 58px Sora, sans-serif";
  context.fillText(tenure, canvas.width / 2, canvas.height / 2 - 26);

  context.fillStyle = "rgba(175, 230, 212, 0.9)";
  context.font = "600 30px Sora, sans-serif";
  context.fillText(title, canvas.width / 2, canvas.height / 2 + 48);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2.7, 0.9),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true })
  );
  return mesh;
};

const bootExperiences = () => {
  const canvas = document.getElementById("experiences-canvas");
  const statusEl = document.getElementById("experiences-status");
  const promptEl = document.getElementById("experiences-prompt");
  const tourToggle = document.getElementById("experiences-tour-toggle");
  const muteButton = document.getElementById("experiences-mute");
  const modal = document.getElementById("experiences-modal");
  const modalClose = document.getElementById("experiences-modal-close");
  const modalMeta = document.getElementById("experiences-modal-meta");
  const modalTitle = document.getElementById("experiences-modal-title");
  const modalSummary = document.getElementById("experiences-modal-summary");
  const modalActivities = document.getElementById("experiences-modal-activities");
  const dataNode = document.getElementById("experiences-data");

  if (
    !canvas ||
    !statusEl ||
    !promptEl ||
    !tourToggle ||
    !muteButton ||
    !modal ||
    !modalClose ||
    !modalMeta ||
    !modalTitle ||
    !modalSummary ||
    !modalActivities ||
    !dataNode
  ) {
    return;
  }

  let entries = [];
  try {
    entries = JSON.parse(dataNode.textContent || "[]");
  } catch (error) {
    console.error("Could not parse experiences data:", error);
    statusEl.textContent = "Experience data is invalid.";
    return;
  }

  if (!entries.length) {
    statusEl.textContent = "No experiences available.";
    return;
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  } catch (error) {
    console.error("Could not initialize experiences renderer:", error);
    statusEl.textContent = "Could not initialize 3D scene.";
    return;
  }

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x06140f);
  scene.fog = new THREE.Fog(0x092018, 20, 120);

  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 220);
  camera.position.set(0, 5.2, 14);

  scene.add(new THREE.AmbientLight(0x8ec6b2, 0.8));
  const keyLight = new THREE.DirectionalLight(0xbbeee0, 0.88);
  keyLight.position.set(8, 16, 7);
  scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight(0x3dc79b, 0.45);
  rimLight.position.set(-8, 8, -10);
  scene.add(rimLight);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(54, 220),
    new THREE.MeshStandardMaterial({ color: 0x0a241b, roughness: 0.88, metalness: 0.2 })
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const pathLine = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.06, 220),
    new THREE.MeshStandardMaterial({
      color: 0x1f6b55,
      emissive: 0x1f6b55,
      emissiveIntensity: 0.32
    })
  );
  pathLine.position.set(0, 0.04, -85);
  scene.add(pathLine);

  const markerCount = 64;
  for (let i = 0; i < markerCount; i += 1) {
    const marker = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.05, 1.6),
      new THREE.MeshStandardMaterial({ color: 0xc6f5e6, transparent: true, opacity: 0.38 })
    );
    marker.position.set(0, 0.07, 20 - i * 3);
    scene.add(marker);
  }

  const statueRoot = new THREE.Group();
  scene.add(statueRoot);

  const clickable = [];
  const statueSpots = [];
  const collisionObjects = [];

  entries.forEach((entry, index) => {
    const side = index % 2 === 0 ? -1 : 1;
    const z = -14 - index * 20;
    const x = side * 8;

    const stand = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.5, 0.65, 24),
      new THREE.MeshStandardMaterial({
        color: 0x274a3e,
        roughness: 0.7,
        metalness: 0.35
      })
    );
    stand.position.set(x, 0.32, z);
    statueRoot.add(stand);

    const statueGroup = new THREE.Group();
    statueGroup.position.set(x, 0.66, z);
    statueRoot.add(statueGroup);

    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.45, 1.65, 10, 16),
      new THREE.MeshStandardMaterial({
        color: 0x7fd7b8,
        emissive: 0x2fa57d,
        emissiveIntensity: 0.2,
        roughness: 0.22,
        metalness: 0.68
      })
    );
    body.position.y = 1.1;
    statueGroup.add(body);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 24, 18),
      new THREE.MeshStandardMaterial({
        color: 0x8ae4c4,
        emissive: 0x39b48c,
        emissiveIntensity: 0.26,
        roughness: 0.2,
        metalness: 0.66
      })
    );
    head.position.y = 2.5;
    statueGroup.add(head);

    const shoulders = new THREE.Mesh(
      new THREE.TorusGeometry(0.78, 0.09, 12, 28),
      new THREE.MeshStandardMaterial({
        color: 0xbafbe2,
        emissive: 0x50c89f,
        emissiveIntensity: 0.34,
        roughness: 0.1,
        metalness: 0.7
      })
    );
    shoulders.rotation.x = Math.PI / 2;
    shoulders.position.y = 1.85;
    statueGroup.add(shoulders);

    const glowRing = new THREE.Mesh(
      new THREE.RingGeometry(1.3, 1.55, 44),
      new THREE.MeshBasicMaterial({
        color: 0x79f2c6,
        transparent: true,
        opacity: 0.32,
        side: THREE.DoubleSide
      })
    );
    glowRing.rotation.x = -Math.PI / 2;
    glowRing.position.set(x, 0.08, z);
    statueRoot.add(glowRing);

    const plaque = makePlaque(entry.role, entry.tenure);
    if (plaque) {
      plaque.position.set(x, 1.35, z + 2.35);
      plaque.rotation.y = side < 0 ? Math.PI / 8 : -Math.PI / 8;
      statueRoot.add(plaque);
    }

    stand.userData.entryIndex = index;
    body.userData.entryIndex = index;
    head.userData.entryIndex = index;
    shoulders.userData.entryIndex = index;

    clickable.push(stand, body, head, shoulders);
    statueSpots.push({ x, z, glowRing, stand });
    collisionObjects.push({ x, z, radius: 2.5 });
  });

  const avatar = new THREE.Group();
  let mixer = null;
  const clips = {};
  let activeAction = null;
  let fallbackWalker = null;

  const fadeTo = (name, duration = 0.26) => {
    const nextAction = clips[name];
    if (!nextAction || nextAction === activeAction) {
      return;
    }
    if (activeAction) {
      activeAction.fadeOut(duration);
    }
    nextAction.reset().fadeIn(duration).play();
    activeAction = nextAction;
  };

  const loader = new GLTFLoader();
  loader.load(
    "/models/soldier.glb",
    (gltf) => {
      const model = gltf.scene;
      model.scale.set(1.5, 1.5, 1.5);
      model.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material = child.material.clone();
          child.material.emissive = new THREE.Color(0x2a8f70);
          child.material.emissiveIntensity = 0.12;
        }
      });
      avatar.add(model);
      mixer = new THREE.AnimationMixer(model);
      for (const clip of gltf.animations) {
        clips[clip.name] = mixer.clipAction(clip);
      }
      if (clips.Idle) {
        clips.Idle.play();
        activeAction = clips.Idle;
      }
    },
    undefined,
    () => {
      fallbackWalker = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.46, 1.4, 10, 14),
        new THREE.MeshStandardMaterial({ color: 0x8de4c5, emissive: 0x2ca27a, emissiveIntensity: 0.22 })
      );
      fallbackWalker.position.y = 1.1;
      avatar.add(fallbackWalker);
    }
  );

  const avatarRing = new THREE.Mesh(
    new THREE.RingGeometry(0.55, 0.75, 48),
    new THREE.MeshBasicMaterial({
      color: 0x91f7d2,
      transparent: true,
      opacity: 0.54
    })
  );
  avatarRing.rotation.x = -Math.PI / 2;
  avatarRing.position.y = 0.04;
  avatar.add(avatarRing);

  avatar.position.set(0, 0, 14);
  if (statueSpots.length) {
    const nearest = statueSpots.reduce((closest, spot) => {
      if (!closest) return spot;
      const currentDistance = Math.hypot(avatar.position.x - spot.x, avatar.position.z - spot.z);
      const bestDistance = Math.hypot(avatar.position.x - closest.x, avatar.position.z - closest.z);
      return currentDistance < bestDistance ? spot : closest;
    }, null);
    if (nearest) {
      const dirX = nearest.x - avatar.position.x;
      const dirZ = nearest.z - avatar.position.z;
      avatar.rotation.y = Math.atan2(dirX, dirZ) + Math.PI;
    }
  }
  scene.add(avatar);

  const controls = {
    forward: false,
    backward: false,
    left: false,
    right: false
  };

  let patrolMode = false;
  let patrolIndex = 0;
  let modalOpen = false;
  let closestIndex = -1;

  const speed = 7.2;
  const cameraLerp = 0.08;
  const avatarRadius = 0.7;
  const tmpVector = new THREE.Vector3();
  const desiredMove = new THREE.Vector3();
  const velocity = new THREE.Vector3();
  const walkTarget = new THREE.Vector3();
  const lookVector = new THREE.Vector3();
  const cameraTarget = new THREE.Vector3();

  const setTourButtonLabel = () => {
    tourToggle.textContent = patrolMode ? "Stop Tour" : "Start Tour";
  };

  const setModal = (entryIndex) => {
    const entry = entries[entryIndex];
    if (!entry) return;

    modalMeta.textContent = `${entry.tenure} · ${entry.company}`;
    modalTitle.textContent = entry.role;
    modalSummary.textContent = entry.summary;

    modalActivities.innerHTML = "";
    entry.activities.forEach((activity) => {
      const item = document.createElement("li");
      item.textContent = activity;
      modalActivities.appendChild(item);
    });

    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    modalOpen = true;
    playBeep();
  };

  const closeModal = () => {
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    modalOpen = false;
  };

  modalClose.addEventListener("click", closeModal);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeModal();
    }
  });

  muteButton.addEventListener("click", () => {
    const muted = toggleMute();
    muteButton.textContent = muted ? "🔈 Muted" : "🔊 Sound";
  });

  tourToggle.addEventListener("click", () => {
    patrolMode = !patrolMode;
    setTourButtonLabel();
  });

  setTourButtonLabel();

  const onKeyDown = (event) => {
    if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") controls.forward = true;
    if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") controls.backward = true;
    if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") controls.left = true;
    if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") controls.right = true;

    if (["w", "a", "s", "d", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
      patrolMode = false;
      setTourButtonLabel();
    }

    if (event.key.toLowerCase() === "e" && closestIndex >= 0 && !modalOpen) {
      setModal(closestIndex);
    }

    if (event.key === "Escape" && modalOpen) {
      closeModal();
    }
  };

  const onKeyUp = (event) => {
    if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") controls.forward = false;
    if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") controls.backward = false;
    if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") controls.left = false;
    if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") controls.right = false;
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const onPointerClick = (event) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const intersections = raycaster.intersectObjects(clickable, false);
    if (!intersections.length || modalOpen) {
      return;
    }
    const index = intersections[0].object.userData.entryIndex;
    if (typeof index === "number") {
      setModal(index);
    }
  };
  canvas.addEventListener("click", onPointerClick);

  const resize = () => {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener("resize", resize);

  const nearestStatueIndex = () => {
    let nearest = -1;
    let bestDistance = Infinity;
    for (let i = 0; i < statueSpots.length; i += 1) {
      const spot = statueSpots[i];
      const distance = Math.hypot(avatar.position.x - spot.x, avatar.position.z - spot.z);
      if (distance < bestDistance) {
        bestDistance = distance;
        nearest = i;
      }
      const opacity = clamp(0.16 + (4.6 - distance) * 0.16, 0.14, 0.62);
      spot.glowRing.material.opacity = opacity;
    }
    if (bestDistance <= 4.6) {
      return nearest;
    }
    return -1;
  };

  let previous = performance.now();
  statusEl.textContent = `Loaded ${entries.length} role statues.`;
  if (!isMuted()) {
    startAmbient("/models/ambient-drone.wav");
  }

  const animate = (now) => {
    const delta = clamp((now - previous) / 1000, 0, 0.05);
    previous = now;

    const directional = desiredMove.set(
      (controls.right ? 1 : 0) - (controls.left ? 1 : 0),
      0,
      (controls.backward ? 1 : 0) - (controls.forward ? 1 : 0)
    );
    if (directional.lengthSq() > 1) {
      directional.normalize();
    }

    let desiredX = directional.x;
    let desiredZ = directional.z;

    if (patrolMode && !modalOpen && statueSpots.length) {
      const patrolSpot = statueSpots[patrolIndex];
      walkTarget.set(
        patrolSpot.x + (patrolSpot.x < 0 ? 2.8 : -2.8),
        0,
        patrolSpot.z + 2.7
      );
      tmpVector.subVectors(walkTarget, avatar.position);
      tmpVector.y = 0;
      const distance = tmpVector.length();
      if (distance < 0.5) {
        patrolIndex = (patrolIndex + 1) % statueSpots.length;
      } else {
        tmpVector.normalize();
        desiredX = tmpVector.x * 0.66;
        desiredZ = tmpVector.z * 0.66;
      }
    }

    velocity.x += (desiredX * speed - velocity.x) * Math.min(1, delta * 9);
    velocity.z += (desiredZ * speed - velocity.z) * Math.min(1, delta * 9);

    avatar.position.x = clamp(avatar.position.x + velocity.x * delta, -14.5, 14.5);
    avatar.position.z = clamp(avatar.position.z + velocity.z * delta, -110, 24);

    for (const obstacle of collisionObjects) {
      const dx = avatar.position.x - obstacle.x;
      const dz = avatar.position.z - obstacle.z;
      const dist = Math.hypot(dx, dz) || 0.0001;
      const minDist = obstacle.radius + avatarRadius;
      if (dist < minDist) {
        const nx = dx / dist;
        const nz = dz / dist;
        const push = minDist - dist;
        avatar.position.x += nx * push;
        avatar.position.z += nz * push;

        const inwardSpeed = velocity.x * nx + velocity.z * nz;
        if (inwardSpeed < 0) {
          velocity.x -= inwardSpeed * nx;
          velocity.z -= inwardSpeed * nz;
        }
      }
    }

    avatar.position.x = clamp(avatar.position.x, -14.5, 14.5);
    avatar.position.z = clamp(avatar.position.z, -110, 24);

    const moving = Math.abs(velocity.x) + Math.abs(velocity.z) > 0.09;
    if (moving) {
      const targetRot = Math.atan2(velocity.x, velocity.z || 0.0001) + Math.PI;
      let diff = targetRot - avatar.rotation.y;
      diff = ((diff + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      avatar.rotation.y += diff * Math.min(1, delta * 9);
      updateFootsteps(Math.hypot(velocity.x, velocity.z) * delta);
    } else {
      resetFootsteps();
    }

    if (mixer) {
      mixer.update(delta);
      if (moving) {
        fadeTo("Walk", 0.22);
      } else {
        fadeTo("Idle", 0.28);
      }
    } else if (fallbackWalker) {
      fallbackWalker.rotation.y += delta * 0.8;
    }

    closestIndex = nearestStatueIndex();
    if (closestIndex >= 0 && !modalOpen) {
      const active = entries[closestIndex];
      promptEl.textContent = `Press E to inspect ${active.role} (${active.tenure})`;
      updateProximityHum(1);
    } else {
      promptEl.textContent = "";
      updateProximityHum(0);
    }

    lookVector.set(
      avatar.position.x * 0.35,
      4.5,
      avatar.position.z + 2.8
    );
    camera.position.lerp(
      cameraTarget.set(avatar.position.x * 0.45, 5.5, avatar.position.z + 12),
      cameraLerp
    );
    camera.lookAt(lookVector);

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  };

  requestAnimationFrame(animate);
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootExperiences, { once: true });
} else {
  bootExperiences();
}
