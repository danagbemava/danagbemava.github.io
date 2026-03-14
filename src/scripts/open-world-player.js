import * as THREE from "three";
import { clamp, getGltfLoader } from "./open-world-config.js";

/**
 * Creates the player avatar (capsule fallback) and ring indicator.
 * Returns player group, body mesh, avatar root, and animation helpers.
 */
export const createPlayer = (scene, startPosition, isTouch, lowPower) => {
  const player = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.45, 1.3, 8, 14),
    new THREE.MeshStandardMaterial({ color: 0x9ad7ff, emissive: 0x2f7ebb, emissiveIntensity: 0.22 })
  );
  body.position.y = 1.1;
  player.add(body);

  const avatarRoot = new THREE.Group();
  player.add(avatarRoot);

  const playerRing = new THREE.Mesh(
    new THREE.RingGeometry(0.7, 0.92, 36),
    new THREE.MeshBasicMaterial({ color: 0xa7deff, transparent: true, opacity: 0.72 })
  );
  playerRing.rotation.x = -Math.PI / 2;
  playerRing.position.y = 0.06;
  player.add(playerRing);

  player.position.copy(startPosition);
  scene.add(player);

  // Animation state
  let mixer = null;
  const animActions = { idle: null, walk: null, run: null, jump: null };
  let activeAction = null;

  const pickClip = (clips, candidates) => {
    const lowered = clips.map((clip) => ({ clip, name: clip.name.toLowerCase() }));
    for (const candidate of candidates) {
      const hit = lowered.find((entry) => entry.name.includes(candidate));
      if (hit) return hit.clip;
    }
    return null;
  };

  const fadeToAction = (nextAction, duration = 0.18) => {
    if (!nextAction || nextAction === activeAction) return;
    if (activeAction) activeAction.fadeOut(duration);
    nextAction.reset().fadeIn(duration).play();
    activeAction = nextAction;
  };

  const setupAnimations = (model, clips) => {
    if (!clips || !clips.length) return;
    mixer = new THREE.AnimationMixer(model);

    animActions.idle = pickClip(clips, ["idle", "breath"]) ? mixer.clipAction(pickClip(clips, ["idle", "breath"])) : null;
    animActions.walk = pickClip(clips, ["walk"]) ? mixer.clipAction(pickClip(clips, ["walk"])) : null;
    animActions.run = pickClip(clips, ["run", "sprint"]) ? mixer.clipAction(pickClip(clips, ["run", "sprint"])) : null;
    animActions.jump = pickClip(clips, ["jump"]) ? mixer.clipAction(pickClip(clips, ["jump"])) : null;

    if (animActions.jump) {
      animActions.jump.setLoop(THREE.LoopRepeat, Infinity);
      animActions.jump.clampWhenFinished = false;
    }

    const starter = animActions.idle || animActions.walk || animActions.run || animActions.jump;
    if (starter) {
      starter.reset().fadeIn(0.01).play();
      activeAction = starter;
    }
  };

  const mountAvatarModel = (model, animations = [], tint = 0x1f6eaa) => {
    const scale = isTouch ? 1.2 : 1.5;
    model.scale.set(scale, scale, scale);
    model.position.set(0, 0, 0);
    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = !lowPower;
        child.receiveShadow = !lowPower;
        if (child.material && typeof child.material.clone === "function") {
          child.material = child.material.clone();
          if ("emissive" in child.material) {
            child.material.emissive = new THREE.Color(tint);
            child.material.emissiveIntensity = 0.08;
          }
        }
      }
    });
    body.visible = false;
    avatarRoot.add(model);
    setupAnimations(model, animations);
  };

  // Attempt to load GLB avatar
  const loadAvatar = (onDone) => {
    getGltfLoader()
      .then((avatarLoader) => {
        if (!avatarLoader) {
          body.visible = true;
          onDone();
          return;
        }
        const tryLoad = (url, onSuccess, onFailure) => {
          avatarLoader.load(url, onSuccess, undefined, onFailure);
        };
        tryLoad(
          "/models/soldier.glb",
          (gltf) => { mountAvatarModel(gltf.scene, gltf.animations || [], 0x1f6eaa); onDone(); },
          () => {
            tryLoad(
              "/models/robot.glb",
              (gltf) => { mountAvatarModel(gltf.scene, gltf.animations || [], 0x20a3c8); onDone(); },
              () => { body.visible = true; onDone(); }
            );
          }
        );
      })
      .catch(() => { body.visible = true; onDone(); });
  };

  return {
    player,
    body,
    playerRing,
    loadAvatar,
    get mixer() { return mixer; },
    animActions,
    fadeToAction,
    get activeAction() { return activeAction; }
  };
};

/**
 * Applies player movement physics for a single frame.
 * Updates position, velocity, collision, rotation, and animation.
 */
export const updatePlayer = (ctx, dt, worldTicker) => {
  const {
    player, controls, velocity, desired, blockers,
    camera, moveTarget, modalOpen, running, lowPower,
    playerObj
  } = ctx;

  const camDir = new THREE.Vector3();
  const screenForward = new THREE.Vector3();
  const screenRight = new THREE.Vector3();

  const inputRight = (controls.right ? 1 : 0) - (controls.left ? 1 : 0) + controls.joystickX;
  const inputForward = (controls.forward ? 1 : 0) - (controls.backward ? 1 : 0) - controls.joystickY;
  camera.getWorldDirection(camDir);
  screenForward.set(camDir.x, 0, camDir.z).normalize();
  screenRight.set(-screenForward.z, 0, screenForward.x).normalize();

  desired.set(0, 0, 0);
  let currentMoveTarget = moveTarget;

  if (Math.abs(inputRight) > 0.01 || Math.abs(inputForward) > 0.01) {
    desired.addScaledVector(screenRight, inputRight).addScaledVector(screenForward, inputForward);
    if (desired.lengthSq() > 1) desired.normalize();
    currentMoveTarget = null;
  } else if (currentMoveTarget && !modalOpen) {
    const toTarget = currentMoveTarget.clone().sub(player.position);
    toTarget.y = 0;
    if (toTarget.length() < 0.72) {
      currentMoveTarget = null;
    } else {
      desired.copy(toTarget.normalize());
    }
  }

  const speed = running ? 11 : 7;
  const gravity = 34;
  const jumpForce = 12.5;
  const wasOnGround = player.position.y <= 0.001;
  let onGround = wasOnGround;

  if (!modalOpen) {
    velocity.x += (desired.x * speed - velocity.x) * Math.min(1, dt * 8);
    velocity.z += (desired.z * speed - velocity.z) * Math.min(1, dt * 8);
    if (wasOnGround) {
      velocity.y = 0;
      if (controls.jumpQueued) {
        velocity.y = jumpForce;
        onGround = false;
      }
    } else {
      velocity.y -= gravity * dt;
    }

    player.position.x = clamp(player.position.x + velocity.x * dt, -68, 68);
    player.position.y = Math.max(0, player.position.y + velocity.y * dt);
    player.position.z = clamp(player.position.z + velocity.z * dt, -68, 30);

    for (const obstacle of blockers) {
      const dx = player.position.x - obstacle.x;
      const dz = player.position.z - obstacle.z;
      const dist = Math.hypot(dx, dz) || 0.0001;
      const minDist = obstacle.radius + 0.9;
      if (dist < minDist) {
        const nx = dx / dist;
        const nz = dz / dist;
        player.position.x += nx * (minDist - dist);
        player.position.z += nz * (minDist - dist);
      }
    }

    const moving = Math.abs(velocity.x) + Math.abs(velocity.z) > 0.1;
    if (moving) {
      const rot = Math.atan2(velocity.x, velocity.z || 0.0001) + Math.PI;
      let diff = rot - player.rotation.y;
      diff = ((diff + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      player.rotation.y += diff * Math.min(1, dt * 8);
    }

    onGround = player.position.y <= 0.001;
  }

  // Animation
  const { mixer, animActions, fadeToAction, activeAction } = playerObj;
  if (mixer) {
    const movingHorizontally = Math.abs(velocity.x) + Math.abs(velocity.z) > 0.08;
    if (!onGround) {
      if (animActions.jump) {
        fadeToAction(animActions.jump, 0.1);
        if (playerObj.activeAction) playerObj.activeAction.timeScale = movingHorizontally ? 1.12 : 1.0;
      } else if (movingHorizontally) {
        fadeToAction(running ? (animActions.run || animActions.walk || animActions.idle) : (animActions.walk || animActions.run || animActions.idle), 0.12);
        if (playerObj.activeAction) playerObj.activeAction.timeScale = 0.75;
      } else {
        fadeToAction(animActions.idle || animActions.walk || animActions.run, 0.12);
        if (playerObj.activeAction) playerObj.activeAction.timeScale = 1.0;
      }
    } else if (movingHorizontally) {
      fadeToAction(running ? (animActions.run || animActions.walk || animActions.idle) : (animActions.walk || animActions.run || animActions.idle), 0.15);
      if (playerObj.activeAction) playerObj.activeAction.timeScale = running ? 1.06 : 1.0;
    } else {
      fadeToAction(animActions.idle || animActions.walk || animActions.run, 0.18);
      if (playerObj.activeAction) playerObj.activeAction.timeScale = 1.0;
    }
    mixer.update(dt);
  }

  // Ring pulse
  playerObj.playerRing.material.opacity = 0.58 + Math.sin(worldTicker * 3) * 0.1;

  controls.jumpQueued = false;

  return { onGround, moving: Math.abs(velocity.x) + Math.abs(velocity.z) > 0.1, moveTarget: currentMoveTarget };
};
