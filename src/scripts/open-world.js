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
  playHolodeckDeactivate,
  playWarpCharge,
  playWarpTunnel,
  playArrival
} from "./sfx.js";
import { getWorldSnapshot, registerVisit, markInteraction, markSecretFound, getSecretsFound } from "./world-state.js";
import { startWorldEvents } from "./world-events.js";
import {
  clamp,
  lerp,
  colorToHex,
  safeAudio,
  parseJsonNode,
  summarizeExperience,
  destinations,
  keyFromHash,
  setHashForDestination
} from "./open-world-config.js";
import { createSceneManager } from "./open-world-scenes.js";
import { createWarpController, createStarmap } from "./open-world-travel.js";
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
    sprintBadge, helpToggle, helpPanel, loadingEl, loadingHint, minimapCanvas
  } = els;

  // ── Tutorial & Secret Reward elements ───────────────────────────
  const tutorialEl = document.getElementById("world-tutorial");
  const secretRewardEl = document.getElementById("world-secret-reward");
  const secretRewardTitle = document.getElementById("world-secret-reward-title");
  const secretRewardText = document.getElementById("world-secret-reward-text");

  // ── Loading helpers ────────────────────────────────────────────
  const updateLoadingHint = (text) => { if (loadingHint) loadingHint.textContent = text; };
  const dismissLoading = () => { if (loadingEl) loadingEl.classList.add("is-hidden"); };

  // ── Help toggle ────────────────────────────────────────────────
  if (helpToggle && helpPanel) {
    helpToggle.addEventListener("click", () => {
      helpPanel.hidden = !helpPanel.hidden;
      helpToggle.textContent = helpPanel.hidden ? "?" : "✕";
    });
  }

  // ── Data ───────────────────────────────────────────────────────
  const content = {
    projects: parseJsonNode("world-data-projects"),
    posts: parseJsonNode("world-data-posts"),
    experiences: parseJsonNode("world-data-experiences")
  };

  // ── Platform ───────────────────────────────────────────────────
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isTouch = window.matchMedia("(pointer: coarse)").matches;
  const lowPower = prefersReducedMotion || isTouch;
  const dprCap = lowPower ? 1 : 1.4;
  let cameraMode = "isometric";
  let qualityMode = "auto";
  let adaptiveQuality = lowPower ? 0 : 1;

  // Tutorial / help copy comes in keyboard and touch flavors.
  for (const el of shell.querySelectorAll("[data-input]")) {
    el.hidden = el.dataset.input !== (isTouch ? "touch" : "keyboard");
  }

  // ── Renderer & Scene ───────────────────────────────────────────
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowPower, powerPreference: "low-power" });
  } catch {
    // WebGL unavailable — swap the loading overlay for plain navigation
    // instead of leaving the spinner running forever.
    if (loadingEl) {
      loadingEl.innerHTML = `
        <div class="world-loading-inner">
          <p class="world-loading-text">This world needs WebGL, which isn't available in your browser.</p>
          <p class="world-loading-hint">
            Browse the classic way:
            <a href="/projects/">Projects</a> &middot;
            <a href="/posts/">Posts</a> &middot;
            <a href="/experiences/">Experiences</a>
          </p>
        </div>`;
    }
    return;
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = lowPower ? 0.92 : 1.0;
  renderer.shadowMap.enabled = !lowPower;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x08041a);
  scene.fog = new THREE.FogExp2(0x0a0520, lowPower ? 0.01 : 0.008);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 520);

  // ── Lights ─────────────────────────────────────────────────────
  const ambient = new THREE.AmbientLight(0x8878b8, lowPower ? 0.9 : 1.05);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xd8c0ff, lowPower ? 0.7 : 1.0);
  sun.position.set(30, 60, 20);
  if (!lowPower) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    // The default directional shadow camera is a ±5 unit box; size it to
    // cover the playable area.
    sun.shadow.camera.left = -85;
    sun.shadow.camera.right = 85;
    sun.shadow.camera.top = 85;
    sun.shadow.camera.bottom = -85;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 220;
  }
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x4040a0, 0.35);
  fill.position.set(-35, 18, 28);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xc8b0ff, 0.4);
  rim.position.set(-18, 14, -22);
  scene.add(rim);

  // ── Scene manager & initial destination ────────────────────────
  let assetResolve = null;
  let assetsRemaining = 0;
  const beginAssetWait = (count) => new Promise((resolve) => {
    assetsRemaining = count;
    assetResolve = resolve;
    if (count === 0) { resolve(); assetResolve = null; }
  });
  const onAssetLoaded = () => {
    assetsRemaining -= 1;
    if (assetsRemaining <= 0 && assetResolve) { assetResolve(); assetResolve = null; }
  };

  const sceneManager = createSceneManager({ scene, content, lowPower, lights: { ambient, rim } });

  const startKey = keyFromHash() || shell.dataset.startZone || "home";
  updateLoadingHint("Building world");
  let pack = sceneManager.swap(startKey, onAssetLoaded);
  const initialAssets = beginAssetWait(pack.assetCount + 1); // +1 avatar
  registerVisit(startKey);
  setHashForDestination(startKey);
  let snapshot = getWorldSnapshot(startKey);

  const dest = () => sceneManager.destination;

  // ── Player ─────────────────────────────────────────────────────
  const spawn = dest().spawn;
  const playerObj = createPlayer(scene, new THREE.Vector3(spawn.x, 0, spawn.z), isTouch, lowPower);
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

  initialAssets.then(() => {
    updateLoadingHint("Ready");
    setTimeout(() => { dismissLoading(); showTutorialIfNew(); }, 300);
  });

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
  let nearbyGate = null;
  let landmarkCooldown = 0;
  let objectiveFlash = 0;
  let modalOpen = false;
  let ambientStarted = false;
  let rafId = null;
  let worldTicker = 0;
  let hoverEntry = null;
  let moveTarget = null;
  let pointerMoved = false;
  let pointerDownAt = null;
  let modalFocus = null;
  let qualitySampleTime = 0;
  let qualitySampleFrames = 0;
  let minimapFrame = 0;
  let appliedQualityTier = null;
  let lastFocused = null;
  const activatedBeacons = new Set();
  const secretKeyByDest = { projects: "data_shard", posts: "timeline_echo", experiences: "sky_shard" };
  const beaconTotal = Object.keys(secretKeyByDest).length;
  const secretTotal = Object.keys(secretKeyByDest).length;

  const setText = (el, value) => {
    if (el && el.__lastText !== value) {
      el.__lastText = value;
      el.textContent = value;
    }
  };

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

  // Bob targets are re-collected after every scene swap.
  const bobbers = [];
  const refreshSceneCaches = () => {
    bobbers.length = 0;
    pack.group.traverse((o) => {
      if (o.userData.bobOrigin !== undefined) bobbers.push(o);
    });
  };
  refreshSceneCaches();

  // ── Minimap & QuickLook ────────────────────────────────────────
  const drawMinimap = createMinimap(minimapCanvas);
  const quickLook = createQuickLook(quickLookCanvas);

  // ── Travel ─────────────────────────────────────────────────────
  const performSwap = (key) => {
    pack = sceneManager.swap(key, onAssetLoaded);
    const ready = beginAssetWait(pack.assetCount);
    const s = destinations[key].spawn;
    playerObj.player.position.set(s.x, 0, s.z);
    velocity.set(0, 0, 0);
    moveTarget = null;
    nearby = null;
    nearbyGate = null;
    nearbyLandmark = null;
    hoverEntry = null;
    refreshSceneCaches();
    registerVisit(key);
    snapshot = getWorldSnapshot(key);
    return ready;
  };

  const warp = createWarpController({
    els: {
      warp: els.warp, warpCanvas: els.warpCanvas, arrival: els.arrival,
      arrivalKicker: els.arrivalKicker, arrivalTitle: els.arrivalTitle
    },
    performSwap,
    sounds: {
      charge: () => safeAudio(() => playWarpCharge()),
      tunnel: () => safeAudio(() => playWarpTunnel()),
      arrival: () => safeAudio(() => playArrival())
    }
  });

  const starmap = createStarmap({
    els: { starmap: els.starmap, starmapGrid: els.starmapGrid, starmapClose: els.starmapClose },
    getCurrentKey: () => sceneManager.key,
    getProgress: (key) => ({
      beacon: activatedBeacons.has(key),
      secret: Boolean(getSecretsFound()[secretKeyByDest[key]])
    }),
    onPick: (key) => warp.warpTo(key)
  });
  const onStarmapBtn = () => starmap.toggle();
  els.starmapBtn.addEventListener("click", onStarmapBtn);

  const onHashChange = () => {
    const key = keyFromHash();
    if (key && key !== sceneManager.key && !warp.warping) warp.warpTo(key);
  };
  window.addEventListener("hashchange", onHashChange);

  // ── World events ───────────────────────────────────────────────
  const stopWorldEvents = startWorldEvents({
    zone: startKey,
    getZone: () => sceneManager.key,
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
    lastFocused = document.activeElement;
    detailClose.focus();
    markInteraction(1.1);
    safeAudio(() => playHolodeckActivate());
  };

  const activateLandmark = (landmark) => {
    if (!landmark || landmarkCooldown > 0) return;
    landmarkCooldown = 2.5;
    landmark.pulse = 1;
    objectiveFlash = 2.4;
    activatedBeacons.add(landmark.zone);
    markInteraction(1.4);
    snapshot = getWorldSnapshot(sceneManager.key);
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
    lastFocused = document.activeElement;
    detailClose.focus();
    safeAudio(() => playBeep());
  };

  const closeEntry = () => {
    if (!modalOpen) return;
    detailEl.hidden = true;
    detailEl.setAttribute("aria-hidden", "true");
    delete detailEl.dataset.kind;
    modalOpen = false;
    modalFocus = null;
    if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
    lastFocused = null;
    safeAudio(() => playHolodeckDeactivate());
  };

  const tryInspect = () => {
    if (nearbyGate && !warp.warping) { warp.warpTo(nearbyGate.key); return; }
    if (nearbyLandmark) { activateLandmark(nearbyLandmark); return; }
    if (nearby) { openEntry(nearby); return; }
    safeAudio(() => playBeep());
  };

  // ── Input handlers ─────────────────────────────────────────────
  const keySet = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d", " "]);

  const onKeyDown = (event) => {
    dismissTutorial();
    safeAudio(() => primeAudio());
    if (modalOpen && event.key === "Tab") {
      // Keep focus inside the detail dialog.
      event.preventDefault();
      const focusables = [detailClose, detailLink];
      const idx = focusables.indexOf(document.activeElement);
      const next = event.shiftKey
        ? (idx <= 0 ? focusables.length - 1 : idx - 1)
        : (idx + 1) % focusables.length;
      focusables[next].focus();
      return;
    }
    if (keySet.has(event.key) || event.key === "Shift") event.preventDefault();
    const key = event.key.toLowerCase();
    if (key === "w" || event.key === "ArrowUp") controls.forward = true;
    if (key === "s" || event.key === "ArrowDown") controls.backward = true;
    if (key === "a" || event.key === "ArrowLeft") controls.left = true;
    if (key === "d" || event.key === "ArrowRight") controls.right = true;
    if (event.key === "Shift") controls.run = true;
    if (event.code === "Space") controls.jumpQueued = true;
    if (key === "e") tryInspect();
    if (key === "m") { starmap.toggle(); return; }
    if (event.key === "Escape") {
      if (starmap.isOpen) { starmap.hide(); return; }
      closeEntry();
    }
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
      const r = dest().boundsRadius;
      const len = Math.hypot(clickPoint.x, clickPoint.z);
      moveTarget = len > r
        ? new THREE.Vector3(clickPoint.x * r / len, 0, clickPoint.z * r / len)
        : new THREE.Vector3(clickPoint.x, 0, clickPoint.z);
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
    if (isTouch && (nearby || nearbyLandmark || nearbyGate) && !modalOpen) tryInspect();
  };

  const onPointerMove = (event) => {
    const rect = canvas.getBoundingClientRect();
    pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, camera);
    const hits = raycaster.intersectObjects(pack.entryMeshes, true);
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
    if (moved || modalOpen || warp.warping || starmap.isOpen) return;
    if (isTouch && (nearby || nearbyLandmark || nearbyGate)) return;
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

  const getEffectiveQualityTier = () => {
    if (qualityMode === "low") return 0;
    if (qualityMode === "high") return 2;
    return adaptiveQuality;
  };

  // Pixel ratio is the biggest perf lever, so it scales with quality tier.
  const tierDprCaps = [0.85, 1.1, 1.4];

  const onResize = () => {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap, tierDprCaps[getEffectiveQualityTier()]));
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

    const qualityTier = getEffectiveQualityTier();
    if (qualityTier !== appliedQualityTier) {
      appliedQualityTier = qualityTier;
      onResize();
    }

    const traveling = warp.warping;
    const inputLocked = modalOpen || traveling || starmap.isOpen;

    // Player physics
    const running = controls.run && !inputLocked;
    const playerResult = updatePlayer({
      player: playerObj.player, controls, velocity, desired, blockers: pack.blockers,
      camera, moveTarget, modalOpen: inputLocked, running, lowPower, playerObj,
      boundsRadius: dest().boundsRadius
    }, dt, worldTicker);

    moveTarget = playerResult.moveTarget;
    const onGround = playerResult.onGround;

    // Audio footsteps
    if (!inputLocked) {
      if (playerResult.moving && onGround) {
        safeAudio(() => updateFootsteps(Math.hypot(velocity.x, velocity.z) * dt));
      } else {
        safeAudio(() => resetFootsteps());
      }
    }

    // Scene pack + backdrop animation
    sceneManager.update(dt, worldTicker);

    // Bobbing spores/orbs
    for (const obj of bobbers) {
      obj.userData.bobPhase = (obj.userData.bobPhase || 0) + dt * 1.4;
      obj.position.y = obj.userData.bobOrigin + Math.sin(obj.userData.bobPhase) * 0.25;
    }

    // Secret node collection
    for (const secret of pack.secretNodes) {
      if (!secret.mesh.parent) continue;
      if (playerObj.player.position.distanceTo(secret.mesh.position) < 1.4) {
        secret.mesh.removeFromParent();
        secret.mesh.geometry.dispose();
        secret.mesh.material.dispose();
        if (markSecretFound(secret.key)) {
          playSecretFound();
          objectiveFlash = 2;
          showSecretReward(secret.key);
        }
      }
    }

    snapshot = getWorldSnapshot(sceneManager.key);

    // HUD update (setText skips writes when nothing changed)
    const d = dest();
    setText(zoneLabel, d.title);
    setText(zoneBlurb, d.blurb);
    const objectiveText = objectiveFlash > 0
      ? `Beacon activated (${activatedBeacons.size}/${beaconTotal}). Explore another world.`
      : (activatedBeacons.size >= beaconTotal
        ? "All beacons active. Hunt down the remaining secret shards."
        : d.objective);
    setText(objectiveEl, objectiveText);
    setText(energyVal, `${Math.round(snapshot.energyLevel * 100)}%`);
    setText(secretsVal, `${snapshot.secretsFound}/${secretTotal}`);
    setText(visitsVal, String(snapshot.totalVisits));
    if (sprintBadge) sprintBadge.hidden = !controls.run;

    shell.dataset.zone = sceneManager.key;
    shell.style.setProperty("--district-accent", colorToHex(d.accent));
    shell.style.setProperty("--district-accent-soft", d.accentSoft);

    // Soft sun pulse tied to world energy.
    const lightBeat = Math.sin(worldTicker * 2.8 + snapshot.energyLevel * 5) * 0.5 + 0.5;
    sun.intensity = lerp(sun.intensity, (lowPower ? 0.58 : 0.82) + lightBeat * 0.24, Math.min(1, dt * 3.2));

    // Proximity detection: gates take priority, then landmark, then entries.
    let nearestGate = null;
    let nearestGateDist = Infinity;
    for (const gate of pack.gates) {
      const gd = Math.hypot(
        playerObj.player.position.x - gate.root.position.x,
        playerObj.player.position.z - gate.root.position.z
      );
      if (gd < nearestGateDist) { nearestGateDist = gd; nearestGate = gate; }
      gate.setCharge(0);
    }

    let nearest = null;
    let nearestDist = Infinity;
    for (const mesh of pack.entryMeshes) {
      const dist = Math.hypot(playerObj.player.position.x - mesh.position.x, playerObj.player.position.z - mesh.position.z);
      if (dist < nearestDist) { nearestDist = dist; nearest = mesh; }
    }

    let landmarkDist = Infinity;
    if (pack.landmark) {
      landmarkDist = Math.hypot(
        playerObj.player.position.x - pack.landmark.root.position.x,
        playerObj.player.position.z - pack.landmark.root.position.z
      );
    }

    let interactionProximity = 0;

    if (nearestGate && nearestGateDist < nearestGate.radius && !traveling) {
      nearbyGate = nearestGate;
      nearby = null;
      nearbyLandmark = null;
      nearestGate.setCharge(clamp(1 - nearestGateDist / nearestGate.radius, 0, 1));
      promptEl.hidden = false;
      setText(promptText, nearestGate.title);
      setText(actionBtn, "Warp");
      actionBtn.disabled = false;
      interactionProximity = clamp(1 - nearestGateDist / nearestGate.radius, 0, 1);
      safeAudio(() => updateProximityHum(interactionProximity));
    } else if (pack.landmark && landmarkDist < pack.landmark.radius) {
      nearbyGate = null;
      nearby = null;
      nearbyLandmark = pack.landmark;
      promptEl.hidden = false;
      setText(promptText, `Activate landmark: ${pack.landmark.title}`);
      setText(actionBtn, landmarkCooldown > 0 ? "Stabilizing..." : "Activate");
      actionBtn.disabled = landmarkCooldown > 0;
      interactionProximity = clamp(1 - landmarkDist / pack.landmark.radius, 0, 1);
      safeAudio(() => updateProximityHum(interactionProximity));
    } else if (nearest && nearestDist < (nearest.userData.interactionRadius || 4)) {
      nearbyGate = null;
      nearby = nearest;
      nearbyLandmark = null;
      promptEl.hidden = false;
      setText(promptText, `Inspect ${nearest.userData.kind}`);
      setText(actionBtn, "Inspect");
      actionBtn.disabled = false;
      interactionProximity = clamp(1 - nearestDist / 4, 0, 1);
      safeAudio(() => updateProximityHum(interactionProximity));
    } else {
      nearbyGate = null;
      nearby = null;
      nearbyLandmark = null;
      promptEl.hidden = true;
      setText(actionBtn, "Inspect");
      actionBtn.disabled = true;
      safeAudio(() => updateProximityHum(0));
    }

    quickLook.show(hoverEntry || nearby, { quickLookEl, quickLookKicker, quickLookTitle, quickLookSummary, modalOpen });

    // Minimap (every 6 frames)
    minimapFrame += 1;
    if (minimapFrame % 6 === 0) {
      drawMinimap(playerObj.player.position, {
        entries: pack.entryMeshes.map((m) => ({ x: m.position.x, z: m.position.z })),
        gates: pack.gates.map((g) => ({ x: g.root.position.x, z: g.root.position.z, accent: colorToHex(destinations[g.key].accent) })),
        landmark: pack.landmark ? { x: pack.landmark.root.position.x, z: pack.landmark.root.position.z } : null,
        boundsRadius: d.boundsRadius + 8,
        accent: colorToHex(d.accent)
      });
    }

    // Audio profile
    safeAudio(() => setWorldAudioProfile({
      zone: sceneManager.key,
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
    window.removeEventListener("hashchange", onHashChange);
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
    els.starmapBtn.removeEventListener("click", onStarmapBtn);

    stopWorldEvents();
    safeAudio(() => updateProximityHum(0));
    safeAudio(() => resetFootsteps());

    // material.dispose() does not release textures, so dispose maps
    // explicitly (sprite-label CanvasTextures, GLTF textures).
    const disposeMaterial = (mat) => {
      for (const key of ["map", "emissiveMap", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "alphaMap"]) {
        if (mat[key]) mat[key].dispose();
      }
      mat.dispose();
    };
    scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(disposeMaterial);
        else disposeMaterial(obj.material);
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
