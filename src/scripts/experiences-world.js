import * as THREE from "three";
import {
  updateFootsteps,
  resetFootsteps,
  playBeep,
  playJump,
  playLand,
  playSecretFound,
  updateProximityHum,
  startAmbient,
  toggleMute,
  isMuted,
  primeAudio,
  setWorldAudioProfile
} from "./sfx.js";
import { getWorldSnapshot, registerVisit, markInteraction, markSecretFound } from "./world-state.js";
import { startWorldEvents } from "./world-events.js";
import { buildScene, loadExperienceModels } from "./experiences-scene.js";
import { buildStatues } from "./experiences-statues.js";
import { buildAtmosphere } from "./experiences-atmosphere.js";
import { buildAvatar } from "./experiences-avatar.js";
import { buildAmbientProps } from "./experiences-props.js";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

let experienceAnimationFrameId = null;

const bootExperiences = () => {
  if (experienceAnimationFrameId) {
    cancelAnimationFrame(experienceAnimationFrameId);
    experienceAnimationFrameId = null;
  }

  // ── DOM refs ───────────────────────────────────────────────────────────────
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
    !canvas || !statusEl || !promptEl || !tourToggle || !muteButton ||
    !modal || !modalClose || !modalMeta || !modalTitle || !modalSummary ||
    !modalActivities || !dataNode
  ) return;

  // ── Data ───────────────────────────────────────────────────────────────────
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

  registerVisit("experiences");
  let worldSnapshot = getWorldSnapshot("experiences");

  const phaseProfile = (phase) => {
    if (phase === "dawn") return { exposure: 1.0,  ambient: 0.78, key: 0.86, rim: 0.44, fogNear: 20, fogFar: 130 };
    if (phase === "day")  return { exposure: 1.08, ambient: 0.9,  key: 0.95, rim: 0.5,  fogNear: 20, fogFar: 140 };
    if (phase === "dusk") return { exposure: 0.95, ambient: 0.72, key: 0.82, rim: 0.48, fogNear: 18, fogFar: 118 };
    return                       { exposure: 0.86, ambient: 0.6,  key: 0.72, rim: 0.44, fogNear: 16, fogFar: 104 };
  };
  let worldProfile = phaseProfile(worldSnapshot.dayPhase);

  // ── Build sub-systems ─────────────────────────────────────────────────────
  const sceneResult = buildScene(canvas, worldProfile);
  if (!sceneResult) {
    statusEl.textContent = "Could not initialize 3D scene.";
    return;
  }
  const { renderer, scene, camera, ambientLight, keyLight, rimLight } = sceneResult;

  // Load district GLB models asynchronously (resilient — skipped if file missing)
  loadExperienceModels(scene);

  const { skyShell, floatingIsles, lightShafts, fireflies } = buildAtmosphere(scene);

  const {
    clickable, statueSpots, collisionObjects,
    mentorWisps, resonanceLinks,
    curatorSentinel, sentinelCore, sentinelRing, sentinelPatrol,
    shardGroup, shardCollected
  } = buildStatues(scene, entries, worldSnapshot);

  const { avatar, avatarRing, fadeTo, getMixer, getClips, getFallbackWalker } =
    buildAvatar(scene, statueSpots);

  const { memoryShards, lanternLights } = buildAmbientProps(scene);

  // ── Controls ───────────────────────────────────────────────────────────────
  const controls = {
    forward: false, backward: false, left: false, right: false,
    run: false, jump: false,
    joystick: { x: 0, y: 0 }
  };

  let patrolMode = false;
  let patrolIndex = 0;
  let modalOpen = false;
  let closestIndex = -1;
  let worldRefresh = 0;
  let lastEventMessage = "";
  let ecologyMessageTimer = 0;
  let breeze = 0;

  const speed = 7.2;
  const gravity = 45;
  const jumpForce = 15;
  const cameraLerp = 0.08;
  const avatarRadius = 0.7;
  const tmpVector = new THREE.Vector3();
  const desiredMove = new THREE.Vector3();
  const velocity = new THREE.Vector3();
  const walkTarget = new THREE.Vector3();
  const lookVector = new THREE.Vector3();
  const cameraTarget = new THREE.Vector3();

  // ── Helpers ────────────────────────────────────────────────────────────────
  const setTourButtonLabel = () => {
    tourToggle.textContent = patrolMode ? "Stop Tour" : "Start Tour";
  };

  const statusIdleText = () =>
    `Gallery online (${worldSnapshot.dayPhase}) · Featured: ${worldSnapshot.featuredNode} · Secrets: ${worldSnapshot.secretsFound}`;

  const updateWorldStatus = () => {
    if (modalOpen) return;
    statusEl.textContent = lastEventMessage || statusIdleText();
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
    markInteraction(1.1);
  };

  const closeModal = () => {
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    modalOpen = false;
    markInteraction(0.4);
  };

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
    return bestDistance <= 4.6 ? nearest : -1;
  };

  // ── World events ───────────────────────────────────────────────────────────
  const stopWorldEvents = startWorldEvents({
    zone: "experiences",
    sound: !isMuted(),
    minDelayMs: 17000,
    maxDelayMs: 30000,
    onEvent: (event) => {
      lastEventMessage = `Event: ${event.text}`;
      statusEl.textContent = lastEventMessage;
      window.setTimeout(() => {
        if (statusEl.textContent === lastEventMessage) {
          lastEventMessage = "";
          updateWorldStatus();
        }
      }, 6500);
    }
  });

  // ── UI events ──────────────────────────────────────────────────────────────
  modalClose.addEventListener("click", closeModal);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
  });
  muteButton.addEventListener("click", () => {
    const muted = toggleMute();
    muteButton.textContent = muted ? "🔈 Muted" : "🔊 Sound";
  });
  tourToggle.addEventListener("click", () => {
    patrolMode = !patrolMode;
    setTourButtonLabel();
    markInteraction(0.5);
  });
  setTourButtonLabel();

  window.addEventListener("joystick-move", (e) => {
    controls.joystick.x = e.detail.x;
    controls.joystick.y = e.detail.y;
    if (controls.joystick.x !== 0 || controls.joystick.y !== 0) {
      patrolMode = false;
      setTourButtonLabel();
    }
  });

  // ── Keyboard ───────────────────────────────────────────────────────────────
  const onKeyDown = (event) => {
    primeAudio();
    if (event.key === "ArrowUp"    || event.key.toLowerCase() === "w") controls.forward   = true;
    if (event.key === "ArrowDown"  || event.key.toLowerCase() === "s") controls.backward  = true;
    if (event.key === "ArrowLeft"  || event.key.toLowerCase() === "a") controls.left      = true;
    if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") controls.right     = true;
    if (event.key === "Shift") controls.run  = true;
    if (event.key === " ")    controls.jump = true;
    if (["w","a","s","d","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "].includes(event.key)) {
      patrolMode = false;
      setTourButtonLabel();
    }
    if (event.key.toLowerCase() === "e" && closestIndex >= 0 && !modalOpen) setModal(closestIndex);
    if (event.key === "Escape" && modalOpen) closeModal();
  };

  const onKeyUp = (event) => {
    if (event.key === "ArrowUp"    || event.key.toLowerCase() === "w") controls.forward   = false;
    if (event.key === "ArrowDown"  || event.key.toLowerCase() === "s") controls.backward  = false;
    if (event.key === "ArrowLeft"  || event.key.toLowerCase() === "a") controls.left      = false;
    if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") controls.right     = false;
    if (event.key === "Shift") controls.run  = false;
    if (event.key === " ")    controls.jump = false;
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  // ── Pointer click (statue inspection) ─────────────────────────────────────
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const onPointerClick = (event) => {
    primeAudio();
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const intersections = raycaster.intersectObjects(clickable, false);
    if (!intersections.length || modalOpen) return;
    const index = intersections[0].object.userData.entryIndex;
    if (typeof index === "number") setModal(index);
  };
  canvas.addEventListener("click", onPointerClick);

  // ── Resize ─────────────────────────────────────────────────────────────────
  const resize = () => {
    const width  = canvas.clientWidth  || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener("resize", resize);

  // ── Boot ───────────────────────────────────────────────────────────────────
  statusEl.textContent = `Loaded ${entries.length} role statues · ${worldSnapshot.featuredNode}`;
  if (!isMuted()) startAmbient("/models/ambient-drone.wav");

  let previous = performance.now();
  let readyDispatched = false;

  // ── Animation loop ─────────────────────────────────────────────────────────
  const animate = (now) => {
    const delta = clamp((now - previous) / 1000, 0, 0.05);
    previous = now;

    // Refresh world state periodically
    worldRefresh += delta;
    if (worldRefresh > 10.5) {
      worldRefresh = 0;
      worldSnapshot = getWorldSnapshot("experiences");
      worldProfile = phaseProfile(worldSnapshot.dayPhase);
    }

    setWorldAudioProfile({
      zone: "experiences",
      energy: worldSnapshot.energyLevel,
      eventBoost: lastEventMessage ? 0.8 : 0.18
    });

    // ── Ecology ──────────────────────────────────────────────────────────────
    const ecologyFlow = 0.6 + worldSnapshot.energyLevel * 1.2;

    for (const w of mentorWisps) {
      w.angle += delta * w.speed * ecologyFlow;
      w.wisp.position.x = w.spot.x + Math.cos(w.angle) * w.radius;
      w.wisp.position.z = w.spot.z + Math.sin(w.angle) * (w.radius * 0.62);
      w.wisp.position.y = 2.7 + Math.sin(now * 0.0024 + w.phase) * 0.65;
      w.wisp.material.opacity = 0.3 + Math.sin(now * 0.003 + w.phase) * 0.2;
    }

    for (const resonance of resonanceLinks) {
      resonance.link.material.opacity =
        0.08 + Math.sin(now * 0.0022 + resonance.phase) * 0.09 + worldSnapshot.energyLevel * 0.06;
    }

    sentinelPatrol.z += delta * sentinelPatrol.speed * sentinelPatrol.dir * ecologyFlow;
    if (sentinelPatrol.z < -104 || sentinelPatrol.z > 18) sentinelPatrol.dir *= -1;
    curatorSentinel.position.set(Math.sin(now * 0.0009) * 3.4, 2.2 + Math.sin(now * 0.002) * 0.5, sentinelPatrol.z);
    curatorSentinel.rotation.y += delta * 1.8;
    sentinelRing.rotation.z += delta * 1.3;
    sentinelCore.material.emissiveIntensity = 0.65 + worldSnapshot.energyLevel * 0.85;

    // ── Atmosphere ────────────────────────────────────────────────────────────
    breeze += delta * (0.07 + worldSnapshot.energyLevel * 0.06);
    skyShell.rotation.y += delta * 0.01;
    skyShell.material.opacity = 0.14 + worldSnapshot.energyLevel * 0.1;

    for (const isle of floatingIsles) {
      isle.isle.position.y = isle.baseY + Math.sin(now * 0.0011 * isle.speed + isle.phase) * 0.9;
      isle.isle.position.x += Math.sin(breeze + isle.phase) * delta * 0.4;
      isle.isle.rotation.y += delta * (0.1 + isle.speed * 0.3);
      isle.isle.rotation.x += delta * 0.05;
    }

    for (const shaft of lightShafts) {
      const sway = Math.sin(now * 0.0016 * shaft.speed + shaft.phase);
      shaft.shaft.position.x = Math.sin(breeze + shaft.phase) * 9;
      shaft.shaft.material.opacity = 0.04 + (sway * 0.5 + 0.5) * 0.08 + worldSnapshot.energyLevel * 0.02;
      shaft.shaft.rotation.z = sway * 0.08;
    }

    for (const f of fireflies) {
      const wx = Math.sin(now * 0.00088 * f.speed + f.phase);
      const wz = Math.cos(now * 0.00072 * f.speed + f.phase * 1.3);
      f.mesh.position.x = f.baseX + wx * f.orbitR;
      f.mesh.position.z = f.baseZ + wz * (f.orbitR * 0.6);
      f.mesh.position.y = f.baseY + Math.sin(now * 0.0019 * f.speed + f.phase) * 0.55;
      f.mesh.material.opacity = 0.4 + Math.sin(now * 0.0031 + f.phase) * 0.45;
    }

    // ── Ambient props ─────────────────────────────────────────────────────────
    for (const s of memoryShards) {
      s.mesh.position.y = s.baseY + Math.sin(now * 0.0013 * s.speed + s.phase) * 0.38;
      s.mesh.rotation.y += delta * 0.7 * s.speed;
      s.mesh.rotation.x += delta * 0.3;
    }
    for (const l of lanternLights) {
      const pulse = 0.9 + Math.sin(now * 0.0028 + l.phase) * 0.35;
      l.light.intensity = pulse * 1.4;
    }

    // ── Statue animations ─────────────────────────────────────────────────────
    for (const spot of statueSpots) {
      if (!spot.group) continue;
      spot.group.rotation.y += delta * 0.3;
      spot.group.rotation.x = Math.sin(now * 0.0005 + spot.x) * 0.1;
      const isClosest = statueSpots.indexOf(spot) === closestIndex;
      const scale = 1 + Math.sin(now * 0.002) * 0.05 + (isClosest ? 0.1 : 0);
      spot.group.scale.setScalar(scale);
    }

    // ── Shard ─────────────────────────────────────────────────────────────────
    if (!shardCollected.value) {
      shardGroup.rotation.y += delta * 2;
      shardGroup.position.y = 2.5 + Math.sin(now * 0.003) * 0.3;
      if (avatar.position.distanceTo(shardGroup.position) < 1.5) {
        shardCollected.value = true;
        scene.remove(shardGroup);
        if (markSecretFound("data_shard")) {
          playSecretFound();
          statusEl.textContent = "SECRET_DATA_SHARD_RECOVERED // SYSTEM_ACCESS_LEVEL_INCREASED";
        } else {
          statusEl.textContent = "DATA_SHARD_ALREADY_REGISTERED // ACCESS_STABLE";
        }
        avatarRing.material.color.set(0xffab40);
        avatarRing.scale.set(1.5, 1.5, 1.5);
      }
    }

    // ── Movement ──────────────────────────────────────────────────────────────
    const directional = desiredMove.set(
      (controls.right ? 1 : 0) - (controls.left ? 1 : 0) + controls.joystick.x,
      0,
      (controls.backward ? 1 : 0) - (controls.forward ? 1 : 0) + controls.joystick.y
    );
    if (directional.lengthSq() > 1) directional.normalize();

    let desiredX = directional.x;
    let desiredZ = directional.z;

    if (patrolMode && !modalOpen && statueSpots.length) {
      const patrolSpot = statueSpots[patrolIndex];
      walkTarget.set(patrolSpot.x + (patrolSpot.x < 0 ? 2.8 : -2.8), 0, patrolSpot.z + 2.7);
      tmpVector.subVectors(walkTarget, avatar.position);
      tmpVector.y = 0;
      if (tmpVector.length() < 0.5) {
        patrolIndex = (patrolIndex + 1) % statueSpots.length;
      } else {
        tmpVector.normalize();
        desiredX = tmpVector.x * 0.66;
        desiredZ = tmpVector.z * 0.66;
      }
    }

    const isRunning = controls.run && !patrolMode && !modalOpen && (desiredX !== 0 || desiredZ !== 0);
    const movementSpeed = isRunning ? speed * 1.5 : speed;

    const wasOnGround = avatar.position.y <= 0.01;
    let onGround = wasOnGround;

    const friction = onGround ? 6 : 2.5;
    velocity.x += (desiredX * movementSpeed - velocity.x) * Math.min(1, delta * friction);
    velocity.z += (desiredZ * movementSpeed - velocity.z) * Math.min(1, delta * friction);

    if (onGround) {
      velocity.y = 0;
      if (controls.jump && !modalOpen) {
        velocity.y = jumpForce;
        playJump();
        patrolMode = false;
        setTourButtonLabel();
        onGround = false;
      }
    } else {
      velocity.y -= gravity * delta;
    }

    avatar.position.x = clamp(avatar.position.x + velocity.x * delta, -14.5, 14.5);
    avatar.position.y = Math.max(0, avatar.position.y + velocity.y * delta);
    avatar.position.z = clamp(avatar.position.z + velocity.z * delta, -110, 24);

    onGround = avatar.position.y <= 0.01;
    if (onGround && !wasOnGround) playLand();

    // Collision with pedestals
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

    // ── Avatar orientation & animation ────────────────────────────────────────
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

    if (!onGround) {
      const stretch = clamp(1 + Math.abs(velocity.y) * 0.012, 1, 1.2);
      avatar.scale.set(1 / stretch, stretch, 1 / stretch);
    } else {
      avatar.scale.lerp(new THREE.Vector3(1, 1, 1), 0.15);
    }

    const mixer = getMixer();
    const clips = getClips();
    const fallbackWalker = getFallbackWalker();
    if (mixer) {
      mixer.update(delta);
      const runClip  = clips.Run     ? "Run"     : (clips.Running  ? "Running"  : "Walk");
      const walkClip = clips.Walk    ? "Walk"    : (clips.Walking  ? "Walking"  : "Idle");
      const moveClip = isRunning ? runClip : walkClip;

      if (!onGround) {
        if      (clips.Jump)      fadeTo("Jump", 0.1);
        else if (clips.Jump_Idle) fadeTo("Jump_Idle", 0.1);
        else {
          if (moving) { fadeTo(moveClip, 0.2); if (clips[moveClip]?.isRunning()) clips[moveClip].timeScale = 0.5; }
          else          fadeTo("Idle", 0.2);
        }
      } else {
        if (clips[moveClip]) clips[moveClip].timeScale = 1.0;
        moving ? fadeTo(moveClip, 0.22) : fadeTo("Idle", 0.28);
      }
    } else if (fallbackWalker) {
      fallbackWalker.rotation.y += delta * 0.8;
    }

    // ── Proximity / prompt ────────────────────────────────────────────────────
    closestIndex = nearestStatueIndex();
    if (closestIndex >= 0 && !modalOpen) {
      const active = entries[closestIndex];
      promptEl.textContent = `Press E to inspect ${active.role} (${active.tenure})`;
      updateProximityHum(1);
      setWorldAudioProfile({ zone: "experiences", energy: worldSnapshot.energyLevel, proximity: 1 });
    } else {
      promptEl.textContent = "";
      updateProximityHum(0);
      setWorldAudioProfile({ zone: "experiences", energy: worldSnapshot.energyLevel, proximity: 0 });
      if (!modalOpen) updateWorldStatus();
    }

    ecologyMessageTimer += delta;
    if (ecologyMessageTimer > 24 && !modalOpen && !lastEventMessage) {
      ecologyMessageTimer = 0;
      statusEl.textContent = `Gallery ecology: ${mentorWisps.length} mentor wisps · ${resonanceLinks.length} resonance links`;
      window.setTimeout(() => {
        if (!modalOpen && !lastEventMessage) updateWorldStatus();
      }, 3600);
    }

    // ── Lighting transitions ──────────────────────────────────────────────────
    ambientLight.intensity += (worldProfile.ambient - ambientLight.intensity) * Math.min(1, delta * 1.7);
    keyLight.intensity     += (worldProfile.key     - keyLight.intensity)     * Math.min(1, delta * 1.7);
    rimLight.intensity     += (worldProfile.rim     - rimLight.intensity)     * Math.min(1, delta * 1.7);
    scene.fog.near         += (worldProfile.fogNear - scene.fog.near)         * Math.min(1, delta * 1.5);
    scene.fog.far          += (worldProfile.fogFar  - scene.fog.far)          * Math.min(1, delta * 1.5);
    renderer.toneMappingExposure += (worldProfile.exposure - renderer.toneMappingExposure) * Math.min(1, delta * 1.4);

    // ── Camera ────────────────────────────────────────────────────────────────
    lookVector.set(avatar.position.x * 0.35, 4.5, avatar.position.z + 2.8);
    camera.position.lerp(
      cameraTarget.set(avatar.position.x * 0.45, 5.5, avatar.position.z + 12),
      cameraLerp
    );
    camera.lookAt(lookVector);

    renderer.render(scene, camera);

    if (!readyDispatched) {
      readyDispatched = true;
      window.dispatchEvent(new CustomEvent("scene-ready"));
    }

    experienceAnimationFrameId = requestAnimationFrame(animate);
  };

  experienceAnimationFrameId = requestAnimationFrame(animate);

  // ── Cleanup on navigation ──────────────────────────────────────────────────
  document.addEventListener("astro:before-preparation", () => {
    cancelAnimationFrame(experienceAnimationFrameId);
    stopWorldEvents();
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    renderer.dispose();
  }, { once: true });
};

document.addEventListener("astro:page-load", bootExperiences);
