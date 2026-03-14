import * as THREE from "three";
import {
  updateFootsteps,
  resetFootsteps,
  updateProximityHum,
  startAmbient,
  toggleMute,
  isMuted,
  setWorldAudioProfile,
  playBeep,
  playSecretFound,
  primeAudio,
  playHolodeckActivate,
  playHolodeckDeactivate
} from "./sfx.js";
import { getWorldSnapshot, registerVisit, markInteraction, markSecretFound } from "./world-state.js";
import { startWorldEvents } from "./world-events.js";
import {
  clamp,
  lerp,
  colorToHex,
  safeAudio,
  parseJsonNode,
  summarizeExperience,
  districtConfig,
  districtAtmosphere,
  districtPresentation,
  getStartPosition
} from "./open-world-config.js";
import { createEnvironment, updateEnvironment } from "./open-world-environment.js";
import { createDistricts, updateDistricts } from "./open-world-districts.js";
import { createEntries } from "./open-world-entries.js";
import { createPlayer, updatePlayer } from "./open-world-player.js";
import { getHudElements, createMinimap, createQuickLook } from "./open-world-hud.js";

let cleanupCurrent = null;
let _booted = false;

const bootOpenWorld = () => {
  if (_booted) return;
  _booted = true;
  if (cleanupCurrent) {
    cleanupCurrent();
    cleanupCurrent = null;
  }

  // ── DOM elements ───────────────────────────────────────────────
  const els = getHudElements();
  if (!els) return;

  const {
    shell, canvas, zoneLabel, zoneBlurb, objective: objectiveEl,
    energyVal, secretsVal, visitsVal,
    prompt: promptEl, promptText,
    mute: muteBtn, action: actionBtn,
    cameraMode: cameraModeBtn, qualityMode: qualityModeBtn,
    quicklook: quickLookEl, quicklookKicker: quickLookKicker,
    quicklookTitle: quickLookTitle, quicklookSummary: quickLookSummary,
    quicklookCanvas: quickLookCanvas,
    detail: detailEl, detailClose, detailMeta, detailTitle, detailSummary, detailLink,
    sprintBadge, helpToggle, helpPanel, loadingEl, loadingHint, zoneFlash, minimapCanvas
  } = els;

  // ── Tutorial & Secret Reward elements ───────────────────────────
  const tutorialEl = document.getElementById("world-tutorial");
  const secretRewardEl = document.getElementById("world-secret-reward");
  const secretRewardTitle = document.getElementById("world-secret-reward-title");
  const secretRewardText = document.getElementById("world-secret-reward-text");

  // ── Loading helpers ────────────────────────────────────────────
  let loadingAssetsRemaining = 0;
  let loadingAssetsTotal = 0;
  const updateLoadingHint = (text) => { if (loadingHint) loadingHint.textContent = text; };
  const dismissLoading = () => { if (loadingEl) loadingEl.classList.add("is-hidden"); };

  // ── Help toggle ────────────────────────────────────────────────
  if (helpToggle && helpPanel) {
    helpToggle.addEventListener("click", () => {
      helpPanel.hidden = !helpPanel.hidden;
      helpToggle.textContent = helpPanel.hidden ? "?" : "\u2715";
    });
  }

  // ── Zone flash ─────────────────────────────────────────────────
  let prevZone = shell.dataset.startZone || "home";
  const triggerZoneFlash = () => {
    if (!zoneFlash) return;
    zoneFlash.classList.remove("is-active");
    void zoneFlash.offsetWidth;
    zoneFlash.classList.add("is-active");
  };

  // ── Data ───────────────────────────────────────────────────────
  const projects = parseJsonNode("world-data-projects");
  const posts = parseJsonNode("world-data-posts");
  const experiences = parseJsonNode("world-data-experiences");

  // ── Platform ───────────────────────────────────────────────────
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isTouch = window.matchMedia("(pointer: coarse)").matches;
  const lowPower = prefersReducedMotion || isTouch;
  const dprCap = lowPower ? 1 : 1.4;
  let cameraMode = "isometric";
  let qualityMode = "auto";
  let adaptiveQuality = lowPower ? 0 : 1;

  const startZone = shell.dataset.startZone || "home";
  registerVisit(startZone);
  let snapshot = getWorldSnapshot(startZone);

  // ── Renderer & Scene ───────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowPower, powerPreference: "low-power" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = lowPower ? 0.92 : 1.0;
  renderer.shadowMap.enabled = !lowPower;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x08041a);
  scene.fog = new THREE.FogExp2(0x0a0520, lowPower ? 0.01 : 0.008);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 320);

  // ── Lights (nebula-tuned) ──────────────────────────────────────
  const ambient = new THREE.AmbientLight(0x8878b8, lowPower ? 0.9 : 1.05);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xd8c0ff, lowPower ? 0.7 : 1.0);
  sun.position.set(30, 60, 20);
  if (!lowPower) { sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); }
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x4040a0, 0.35);
  fill.position.set(-35, 18, 28);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xc8b0ff, 0.4);
  rim.position.set(-18, 14, -22);
  scene.add(rim);

  // ── Build world ────────────────────────────────────────────────
  const env = createEnvironment(scene, lowPower);

  const onAssetLoaded = () => {
    loadingAssetsRemaining -= 1;
    if (loadingAssetsRemaining <= 0) {
      updateLoadingHint("Ready");
      setTimeout(() => { dismissLoading(); showTutorialIfNew(); }, 300);
    } else {
      updateLoadingHint(`Loading models (${loadingAssetsTotal - loadingAssetsRemaining}/${loadingAssetsTotal})`);
    }
  };

  updateLoadingHint("Loading district models");
  const districts = createDistricts(scene, lowPower, onAssetLoaded);
  loadingAssetsTotal = districts.assetCount + 1; // +1 for avatar
  loadingAssetsRemaining = loadingAssetsTotal;
  if (districts.assetCount === 0) setTimeout(dismissLoading, 400);

  const entries = createEntries(scene, projects, posts, experiences, lowPower);

  // ── Player ─────────────────────────────────────────────────────
  const startPos = getStartPosition(startZone);
  const playerObj = createPlayer(scene, startPos, isTouch, lowPower);

  updateLoadingHint("Loading avatar");
  playerObj.loadAvatar(() => onAssetLoaded());

  camera.position.copy(playerObj.player.position).add(new THREE.Vector3(15, isTouch ? 15 : 14, 15));
  camera.lookAt(playerObj.player.position.x, 1.5, playerObj.player.position.z);

  // ── Controls state ─────────────────────────────────────────────
  const controls = {
    forward: false, backward: false, left: false, right: false,
    run: false, jumpQueued: false, joystickX: 0, joystickY: 0
  };

  // ── First-visit tutorial ────────────────────────────────────────
  const TUTORIAL_SEEN_KEY = "wb.world.tutorial.seen";
  let tutorialActive = false;
  const showTutorialIfNew = () => {
    try {
      if (window.localStorage.getItem(TUTORIAL_SEEN_KEY)) return;
    } catch { /* ignore */ }
    if (!tutorialEl) return;
    tutorialActive = true;
    tutorialEl.hidden = false;
    tutorialEl.setAttribute("aria-hidden", "false");
  };
  const dismissTutorial = () => {
    if (!tutorialActive) return;
    tutorialActive = false;
    if (tutorialEl) {
      tutorialEl.hidden = true;
      tutorialEl.setAttribute("aria-hidden", "true");
    }
    try { window.localStorage.setItem(TUTORIAL_SEEN_KEY, "1"); } catch { /* ignore */ }
  };

  // Show tutorial once loading finishes
  const origDismissLoading = dismissLoading;

  // ── Secret reward payoff ───────────────────────────────────────
  const secretRewards = {
    sky_shard: { title: "Sky Shard Recovered", text: "A fragment from beyond the nebula veil. The grove remembers." },
    data_shard: { title: "Data Shard Recovered", text: "Forged in stellar fire, this shard pulses with raw energy." },
    timeline_echo: { title: "Timeline Echo Captured", text: "A crystallized signal, echoing across the relay network." }
  };
  let secretRewardTimer = null;
  const showSecretReward = (secretKey) => {
    if (!secretRewardEl || !secretRewardTitle || !secretRewardText) return;
    const reward = secretRewards[secretKey];
    if (!reward) return;
    secretRewardTitle.textContent = reward.title;
    secretRewardText.textContent = reward.text;
    secretRewardEl.hidden = false;
    secretRewardEl.setAttribute("aria-hidden", "false");
    // Reset animation
    secretRewardEl.style.animation = "none";
    void secretRewardEl.offsetWidth;
    secretRewardEl.style.animation = "";
    if (secretRewardTimer) clearTimeout(secretRewardTimer);
    secretRewardTimer = setTimeout(() => {
      secretRewardEl.hidden = true;
      secretRewardEl.setAttribute("aria-hidden", "true");
      secretRewardTimer = null;
    }, 3000);
  };

  // ── Interaction state ──────────────────────────────────────────
  let nearby = null;
  let nearbyLandmark = null;
  let landmarkCooldown = 0;
  let objectiveFlash = 0;
  let modalOpen = false;
  let ambientStarted = false;
  let rafId = null;
  let worldTicker = 0;
  let currentZone = "home";
  let hoverEntry = null;
  let moveTarget = null;
  let pointerMoved = false;
  let pointerDownAt = null;
  let modalFocus = null;
  let qualitySampleTime = 0;
  let qualitySampleFrames = 0;

  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const clickPoint = new THREE.Vector3();
  const velocity = new THREE.Vector3();
  const desired = new THREE.Vector3();
  const lookAt = new THREE.Vector3(playerObj.player.position.x, 1.6, playerObj.player.position.z - 2.8);
  const cameraTarget = new THREE.Vector3();
  const lookAtTarget = new THREE.Vector3();
  const clock = new THREE.Clock();

  const isometricOffset = new THREE.Vector3(15, isTouch ? 15 : 14, 15);
  const followOffset = new THREE.Vector3(0, isTouch ? 8.5 : 7.2, isTouch ? 14.5 : 12);

  // ── Minimap & QuickLook ────────────────────────────────────────
  const drawMinimap = createMinimap(minimapCanvas);
  const quickLook = createQuickLook(quickLookCanvas);

  // ── World events ───────────────────────────────────────────────
  const stopWorldEvents = startWorldEvents({
    zone: startZone,
    sound: !isMuted(),
    minDelayMs: 18000,
    maxDelayMs: 32000,
    onEvent: () => { markInteraction(0.35); }
  });

  // ── Interaction helpers ────────────────────────────────────────
  const openEntry = (mesh) => {
    if (!mesh) return;
    const kind = mesh.userData.kind;
    const entry = mesh.userData.entry;
    const title = entry.title || entry.role || "Entry";

    detailTitle.textContent = title;
    detailMeta.textContent = kind.toUpperCase();
    detailEl.dataset.kind = kind;

    if (kind === "projects") {
      detailSummary.textContent = entry.description || "Open project details.";
      detailLink.textContent = "Open Project";
      detailLink.href = `/projects/${entry.slug}`;
    } else if (kind === "posts") {
      detailSummary.textContent = entry.excerpt || "Open post details.";
      detailLink.textContent = "Read Post";
      detailLink.href = `/posts/${entry.slug}`;
    } else {
      detailSummary.textContent = summarizeExperience(entry);
      detailLink.textContent = "Go To Experiences";
      detailLink.href = "/experiences/";
    }

    detailEl.hidden = false;
    detailEl.setAttribute("aria-hidden", "false");
    modalOpen = true;
    modalFocus = mesh.position.clone().add(new THREE.Vector3(0, 2.2, 0));
    markInteraction(1.1);
    safeAudio(() => playHolodeckActivate());
  };

  const activateLandmark = (landmark) => {
    if (!landmark || landmarkCooldown > 0) return;
    landmarkCooldown = 2.5;
    landmark.pulse = 1;
    objectiveFlash = 2.4;
    markInteraction(1.4);
    snapshot = getWorldSnapshot(currentZone);
    detailTitle.textContent = landmark.title;
    detailMeta.textContent = `${landmark.zone.toUpperCase()} LANDMARK`;
    detailEl.dataset.kind = landmark.zone;
    detailSummary.textContent = `${landmark.summary}\nEnergy now at ${Math.round(snapshot.energyLevel * 100)}%.`;
    detailLink.textContent = `Open ${landmark.zone}`;
    detailLink.href = landmark.link;
    detailEl.hidden = false;
    detailEl.setAttribute("aria-hidden", "false");
    modalOpen = true;
    modalFocus = landmark.root.position.clone().add(new THREE.Vector3(0, 3.1, 0));
    safeAudio(() => playBeep());
  };

  const closeEntry = () => {
    if (!modalOpen) return;
    detailEl.hidden = true;
    detailEl.setAttribute("aria-hidden", "true");
    delete detailEl.dataset.kind;
    modalOpen = false;
    modalFocus = null;
    safeAudio(() => playHolodeckDeactivate());
  };

  const tryInspect = () => {
    if (nearbyLandmark) { activateLandmark(nearbyLandmark); return; }
    if (nearby) { openEntry(nearby); return; }
    safeAudio(() => playBeep());
  };

  // ── Input handlers ─────────────────────────────────────────────
  const keySet = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d", " "]);

  const onKeyDown = (event) => {
    dismissTutorial();
    safeAudio(() => primeAudio());
    if (keySet.has(event.key) || event.key === "Shift") event.preventDefault();
    const key = event.key.toLowerCase();
    if (key === "w" || event.key === "ArrowUp") controls.forward = true;
    if (key === "s" || event.key === "ArrowDown") controls.backward = true;
    if (key === "a" || event.key === "ArrowLeft") controls.left = true;
    if (key === "d" || event.key === "ArrowRight") controls.right = true;
    if (event.key === "Shift") controls.run = true;
    if (event.code === "Space") controls.jumpQueued = true;
    if (key === "e") tryInspect();
    if (event.key === "Escape") closeEntry();
    if (!ambientStarted) {
      ambientStarted = true;
      safeAudio(() => startAmbient("/models/ambient-drone.wav"));
    }
  };

  const onKeyUp = (event) => {
    const key = event.key.toLowerCase();
    if (key === "w" || event.key === "ArrowUp") controls.forward = false;
    if (key === "s" || event.key === "ArrowDown") controls.backward = false;
    if (key === "a" || event.key === "ArrowLeft") controls.left = false;
    if (key === "d" || event.key === "ArrowRight") controls.right = false;
    if (event.key === "Shift") controls.run = false;
  };

  const onJoystickMove = (event) => {
    controls.joystickX = event.detail.x;
    controls.joystickY = event.detail.y;
  };

  const onJoystickSprint = (event) => { controls.run = event.detail.sprinting; };

  const findEntryRoot = (object) => {
    let cursor = object;
    while (cursor) {
      if (cursor.userData && cursor.userData.kind) return cursor;
      cursor = cursor.parent;
    }
    return null;
  };

  const setMoveTargetFromPointer = (event) => {
    const rect = canvas.getBoundingClientRect();
    pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, camera);
    if (raycaster.ray.intersectPlane(groundPlane, clickPoint)) {
      moveTarget = new THREE.Vector3(
        clamp(clickPoint.x, -66, 66), 0, clamp(clickPoint.z, -66, 28)
      );
    }
  };

  const onPointerDown = (event) => {
    dismissTutorial();
    safeAudio(() => primeAudio());
    if (!ambientStarted) {
      ambientStarted = true;
      safeAudio(() => startAmbient("/models/ambient-drone.wav"));
    }
    pointerMoved = false;
    pointerDownAt = { x: event.clientX, y: event.clientY };
    if (isTouch && (nearby || nearbyLandmark) && !modalOpen) tryInspect();
  };

  const onPointerMove = (event) => {
    const rect = canvas.getBoundingClientRect();
    pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, camera);
    const hits = raycaster.intersectObjects(entries.entryMeshes, true);
    hoverEntry = hits.length > 0 ? findEntryRoot(hits[0].object) : null;
    if (!pointerDownAt) return;
    const dx = event.clientX - pointerDownAt.x;
    const dy = event.clientY - pointerDownAt.y;
    if (Math.hypot(dx, dy) > 8) pointerMoved = true;
  };

  const onPointerUp = (event) => {
    if (!pointerDownAt) return;
    const moved = pointerMoved;
    pointerDownAt = null;
    pointerMoved = false;
    if (moved || modalOpen) return;
    if (isTouch && (nearby || nearbyLandmark)) return;
    setMoveTargetFromPointer(event);
  };

  const onVisibilityChange = () => {
    if (document.hidden) {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
      resetFootsteps();
      return;
    }
    if (!rafId) rafId = requestAnimationFrame(tick);
  };

  const onResize = () => {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
    camera.aspect = width / height;
    camera.fov = cameraMode === "isometric" ? (isTouch ? 50 : 46) : (isTouch ? 68 : 58);
    camera.updateProjectionMatrix();
    quickLook.resize(quickLookCanvas);
  };

  const onMuteClick = () => {
    const muted = toggleMute();
    muteBtn.textContent = muted ? "Muted" : "Sound";
  };

  const applyCameraModeText = () => {
    cameraModeBtn.textContent = cameraMode === "isometric" ? "Cam: Isometric" : "Cam: Follow";
  };

  const getEffectiveQualityTier = () => {
    if (qualityMode === "low") return 0;
    if (qualityMode === "high") return 2;
    return adaptiveQuality;
  };

  const applyQualityText = () => {
    if (qualityMode === "low") qualityModeBtn.textContent = "Quality: Low";
    else if (qualityMode === "high") qualityModeBtn.textContent = "Quality: High";
    else qualityModeBtn.textContent = "Quality: Auto";
  };

  const onCameraModeClick = () => {
    cameraMode = cameraMode === "isometric" ? "follow" : "isometric";
    applyCameraModeText();
    onResize();
  };

  const onQualityModeClick = () => {
    if (qualityMode === "auto") qualityMode = "high";
    else if (qualityMode === "high") qualityMode = "low";
    else qualityMode = "auto";
    applyQualityText();
  };

  const onDetailOverlayClick = (event) => { if (event.target === detailEl) closeEntry(); };

  // ── Main loop ──────────────────────────────────────────────────
  const tick = () => {
    const dt = clamp(clock.getDelta(), 0, 0.04);
    worldTicker += dt;
    if (landmarkCooldown > 0) landmarkCooldown = Math.max(0, landmarkCooldown - dt);
    if (objectiveFlash > 0) objectiveFlash = Math.max(0, objectiveFlash - dt);

    // Adaptive quality
    if (qualityMode === "auto") {
      qualitySampleTime += dt;
      qualitySampleFrames += 1;
      if (qualitySampleTime > 1.6) {
        const fps = qualitySampleFrames / qualitySampleTime;
        if (fps < 44 && adaptiveQuality > 0) adaptiveQuality -= 1;
        else if (fps > 57 && adaptiveQuality < (lowPower ? 1 : 2)) adaptiveQuality += 1;
        qualitySampleTime = 0;
        qualitySampleFrames = 0;
      }
    }

    // Player physics
    const running = controls.run && !modalOpen;
    const playerResult = updatePlayer({
      player: playerObj.player, controls, velocity, desired, blockers: entries.blockers,
      camera, moveTarget, modalOpen, running, lowPower, playerObj
    }, dt, worldTicker);

    moveTarget = playerResult.moveTarget;
    const onGround = playerResult.onGround;

    // Audio footsteps
    if (!modalOpen) {
      if (playerResult.moving && onGround) {
        safeAudio(() => updateFootsteps(Math.hypot(velocity.x, velocity.z) * dt));
      } else {
        safeAudio(() => resetFootsteps());
      }
    }

    // Environment animation
    updateEnvironment(env, dt, worldTicker);

    // District animation
    updateDistricts(districts, scene, dt, worldTicker, currentZone);

    // Secret node collection
    for (const secret of entries.secretNodes) {
      if (!secret.mesh.parent) continue;
      secret.mesh.rotation.y += dt * 2.8;
      secret.mesh.position.y = secret.pos.y + Math.sin(worldTicker * 2.4) * 0.28;
      if (playerObj.player.position.distanceTo(secret.mesh.position) < 1.4) {
        scene.remove(secret.mesh);
        if (markSecretFound(secret.key)) {
          playSecretFound();
          objectiveFlash = 2;
          showSecretReward(secret.key);
        }
      }
    }

    // Zone detection
    const zoneDistances = Object.entries(districtConfig).map(([name, cfg]) => ({
      name,
      distance: Math.hypot(playerObj.player.position.x - cfg.center.x, playerObj.player.position.z - cfg.center.z)
    }));
    zoneDistances.sort((a, b) => a.distance - b.distance);
    currentZone = zoneDistances[0]?.name || "home";
    snapshot = getWorldSnapshot(currentZone);

    // HUD update
    zoneLabel.textContent = districtConfig[currentZone].title;
    const profile = districtPresentation[currentZone] || districtPresentation.home;
    zoneBlurb.textContent = profile.blurb;
    objectiveEl.textContent = objectiveFlash > 0 ? "Landmark activated. Explore another district." : profile.objective;
    energyVal.textContent = `${Math.round(snapshot.energyLevel * 100)}%`;
    secretsVal.textContent = String(snapshot.secretsFound);
    visitsVal.textContent = String(snapshot.totalVisits);
    if (sprintBadge) sprintBadge.hidden = !controls.run;

    // Zone transition
    if (currentZone !== prevZone) {
      triggerZoneFlash();
      prevZone = currentZone;
    }

    shell.dataset.zone = currentZone;
    shell.style.setProperty("--district-accent", colorToHex(profile.accent));
    shell.style.setProperty("--district-accent-soft", profile.accentSoft);

    // Atmosphere transition
    const atmos = districtAtmosphere[currentZone] || districtAtmosphere.home;
    scene.background.lerp(new THREE.Color(atmos.bg), Math.min(1, dt * 1.6));
    scene.fog.color.lerp(new THREE.Color(atmos.fog), Math.min(1, dt * 1.8));
    scene.fog.density += (atmos.fogDensity - scene.fog.density) * Math.min(1, dt * 2.2);
    ambient.intensity += (atmos.ambient - ambient.intensity) * Math.min(1, dt * 2.2);
    rim.intensity += (atmos.rim - rim.intensity) * Math.min(1, dt * 2.2);
    const lightBeat = Math.sin(worldTicker * 2.8 + snapshot.energyLevel * 5) * 0.5 + 0.5;
    sun.intensity = lerp(sun.intensity, (lowPower ? 0.58 : 0.82) + lightBeat * 0.24, Math.min(1, dt * 3.2));
    env.ground.material.color.lerp(new THREE.Color(atmos.fog), Math.min(1, dt * 0.8));
    env.terrainRing.material.color.lerp(new THREE.Color(atmos.bg), Math.min(1, dt * 0.5));
    env.skyDome.material.color.lerp(new THREE.Color(atmos.fog), Math.min(1, dt * 0.28));

    // Proximity detection
    let nearest = null;
    let nearestDist = Infinity;
    for (const mesh of entries.entryMeshes) {
      const dist = Math.hypot(playerObj.player.position.x - mesh.position.x, playerObj.player.position.z - mesh.position.z);
      if (dist < nearestDist) { nearestDist = dist; nearest = mesh; }
    }

    let nearestLandmark = null;
    let nearestLandmarkDist = Infinity;
    for (const landmark of districts.districtLandmarks) {
      const dist = Math.hypot(playerObj.player.position.x - landmark.root.position.x, playerObj.player.position.z - landmark.root.position.z);
      if (dist < nearestLandmarkDist) { nearestLandmarkDist = dist; nearestLandmark = landmark; }
    }

    const landmarkActive = nearestLandmark && nearestLandmarkDist < nearestLandmark.radius;
    let interactionProximity = 0;

    if (landmarkActive) {
      nearby = null;
      nearbyLandmark = nearestLandmark;
      promptEl.hidden = false;
      promptText.textContent = `Activate landmark: ${nearestLandmark.title}`;
      actionBtn.textContent = landmarkCooldown > 0 ? "Stabilizing..." : "Activate";
      actionBtn.disabled = landmarkCooldown > 0;
      interactionProximity = clamp(1 - nearestLandmarkDist / nearestLandmark.radius, 0, 1);
      safeAudio(() => updateProximityHum(interactionProximity));
    } else if (nearest && nearestDist < (nearest.userData.interactionRadius || 4)) {
      nearby = nearest;
      nearbyLandmark = null;
      promptEl.hidden = false;
      promptText.textContent = `Inspect ${nearest.userData.kind}`;
      actionBtn.textContent = "Inspect";
      actionBtn.disabled = false;
      interactionProximity = clamp(1 - nearestDist / 4, 0, 1);
      safeAudio(() => updateProximityHum(interactionProximity));
    } else {
      nearby = null;
      nearbyLandmark = null;
      promptEl.hidden = true;
      actionBtn.textContent = "Inspect";
      actionBtn.disabled = true;
      safeAudio(() => updateProximityHum(0));
    }

    quickLook.show(hoverEntry || nearby, { quickLookEl, quickLookKicker, quickLookTitle, quickLookSummary, modalOpen });

    // Quality-based LOD
    const qualityTier = getEffectiveQualityTier();
    const skylineDistance = qualityTier === 0 ? 42 : (qualityTier === 1 ? 58 : 74);
    const propDistance = qualityTier === 0 ? 30 : (qualityTier === 1 ? 46 : 62);
    const particleDistance = qualityTier === 0 ? 20 : (qualityTier === 1 ? 30 : 40);

    for (const node of env.skyline) node.visible = node.position.distanceTo(playerObj.player.position) < skylineDistance;
    for (const prop of districts.districtProps) prop.visible = prop.position.distanceTo(playerObj.player.position) < propDistance;
    for (const po of districts.particleOrbiters) po.mesh.visible = po.mesh.position.distanceTo(playerObj.player.position) < particleDistance;
    for (const sr of districts.scanRings) sr.mesh.visible = qualityTier > 0;

    // Minimap (every ~6 frames)
    if (Math.floor(worldTicker * 10) % 6 === 0) {
      drawMinimap(playerObj.player.position, currentZone);
    }

    // Audio profile
    safeAudio(() => setWorldAudioProfile({
      zone: currentZone,
      energy: snapshot.energyLevel,
      proximity: interactionProximity,
      eventBoost: objectiveFlash > 0 ? 0.5 : 0
    }));

    // Camera
    const lookAhead = velocity.clone().setY(0).multiplyScalar(0.18).clampLength(0, 1.9);
    if (modalOpen && modalFocus) {
      const modalOffset = cameraMode === "isometric"
        ? new THREE.Vector3(7.2, 7.8, 7.2)
        : new THREE.Vector3(0, 4.2, 5.6);
      cameraTarget.copy(modalFocus).add(modalOffset);
      lookAtTarget.copy(modalFocus);
    } else if (cameraMode === "isometric") {
      cameraTarget.copy(playerObj.player.position).add(isometricOffset);
      lookAtTarget.copy(playerObj.player.position).add(new THREE.Vector3(lookAhead.x, 1.5, lookAhead.z));
    } else {
      cameraTarget.copy(playerObj.player.position).add(followOffset);
      lookAtTarget.copy(playerObj.player.position).add(new THREE.Vector3(lookAhead.x, 1.6, -2.2 + lookAhead.z));
    }

    camera.position.lerp(cameraTarget, Math.min(1, dt * 4.8));
    lookAt.lerp(lookAtTarget, Math.min(1, dt * 7.5));
    camera.lookAt(lookAt);

    // Render
    quickLook.render(dt);
    renderer.render(scene, camera);
    rafId = requestAnimationFrame(tick);
  };

  // ── Bind events ────────────────────────────────────────────────
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("joystick-move", onJoystickMove);
  window.addEventListener("joystick-sprint", onJoystickSprint);
  window.addEventListener("resize", onResize);
  document.addEventListener("visibilitychange", onVisibilityChange);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  detailClose.addEventListener("click", closeEntry);
  detailEl.addEventListener("click", onDetailOverlayClick);
  muteBtn.addEventListener("click", onMuteClick);
  cameraModeBtn.addEventListener("click", onCameraModeClick);
  qualityModeBtn.addEventListener("click", onQualityModeClick);
  actionBtn.addEventListener("click", tryInspect);

  applyCameraModeText();
  applyQualityText();
  onResize();
  drawMinimap(playerObj.player.position, startZone);
  rafId = requestAnimationFrame(tick);

  window.dispatchEvent(new CustomEvent("scene-ready"));

  // ── Cleanup ────────────────────────────────────────────────────
  cleanupCurrent = () => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;

    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("joystick-move", onJoystickMove);
    window.removeEventListener("joystick-sprint", onJoystickSprint);
    window.removeEventListener("resize", onResize);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", onPointerUp);
    detailClose.removeEventListener("click", closeEntry);
    detailEl.removeEventListener("click", onDetailOverlayClick);
    muteBtn.removeEventListener("click", onMuteClick);
    cameraModeBtn.removeEventListener("click", onCameraModeClick);
    qualityModeBtn.removeEventListener("click", onQualityModeClick);
    actionBtn.removeEventListener("click", tryInspect);

    stopWorldEvents();
    safeAudio(() => updateProximityHum(0));
    safeAudio(() => resetFootsteps());

    scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((mat) => mat.dispose());
        else obj.material.dispose();
      }
    });
    quickLook.dispose();
    renderer.dispose();
  };
};

document.addEventListener("astro:page-load", bootOpenWorld);
document.addEventListener("astro:before-preparation", () => {
  if (cleanupCurrent) {
    cleanupCurrent();
    cleanupCurrent = null;
  }
  _booted = false;
}, { once: false });

if (document.readyState !== "loading") {
  bootOpenWorld();
}
