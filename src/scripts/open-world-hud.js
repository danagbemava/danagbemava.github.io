import * as THREE from "three";
import { summarizeExperience, districtConfig } from "./open-world-config.js";
import { buildQuickMesh } from "./open-world-entries.js";

/**
 * Grabs all HUD DOM elements and returns them in one object.
 * Returns null if any required element is missing.
 */
export const getHudElements = () => {
  const ids = [
    "open-world-shell", "open-world-canvas",
    "world-zone-label", "world-zone-blurb", "world-objective",
    "world-energy-val", "world-secrets-val", "world-visits-val",
    "world-prompt", "world-prompt-text",
    "world-mute", "world-action", "world-camera-mode", "world-quality-mode",
    "world-quicklook", "world-quicklook-kicker", "world-quicklook-title",
    "world-quicklook-summary", "world-quicklook-canvas",
    "world-detail", "world-detail-close", "world-detail-meta",
    "world-detail-title", "world-detail-summary", "world-detail-link"
  ];

  const els = {};
  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el) return null;
    // Convert "open-world-shell" → "shell", "world-zone-label" → "zoneLabel", etc.
    const key = id
      .replace("open-world-", "")
      .replace("world-", "")
      .replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    els[key] = el;
  }

  // Optional elements
  els.sprintBadge = document.getElementById("world-sprint-badge");
  els.helpToggle = document.getElementById("world-help-toggle");
  els.helpPanel = document.getElementById("world-help-panel");
  els.loadingEl = document.getElementById("world-loading");
  els.loadingHint = document.getElementById("world-loading-hint");
  els.zoneFlash = document.getElementById("world-zone-flash");
  els.minimapCanvas = document.getElementById("world-minimap");
  els.warp = document.getElementById("world-warp");
  els.warpCanvas = document.getElementById("world-warp-canvas");
  els.arrival = document.getElementById("world-arrival");
  els.arrivalKicker = document.getElementById("world-arrival-kicker");
  els.arrivalTitle = document.getElementById("world-arrival-title");
  els.starmap = document.getElementById("world-starmap");
  els.starmapGrid = document.getElementById("world-starmap-grid");
  els.starmapClose = document.getElementById("world-starmap-close");
  els.starmapBtn = document.getElementById("world-starmap-btn");

  return els;
};

/**
 * Minimap: radar of the CURRENT scene. Caller passes POIs each draw:
 * { entries: [{x,z}], gates: [{x,z,accent}], landmark: {x,z}|null,
 *   boundsRadius, accent }
 */
export const createMinimap = (minimapCanvas) => {
  const ctx = minimapCanvas ? minimapCanvas.getContext("2d") : null;
  return (playerPos, pois) => {
    if (!ctx || !minimapCanvas) return;
    const w = minimapCanvas.width;
    const h = minimapCanvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const scale = (cx - 8) / pois.boundsRadius;

    ctx.clearRect(0, 0, w, h);
    ctx.beginPath();
    ctx.arc(cx, cy, cx - 2, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(5, 10, 18, 0.7)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, pois.boundsRadius * scale, 0, Math.PI * 2);
    ctx.strokeStyle = `${pois.accent}44`;
    ctx.lineWidth = 1;
    ctx.stroke();

    const plot = (x, z) => ({ px: cx + x * scale, py: cy + z * scale });

    for (const e of pois.entries) {
      const { px, py } = plot(e.x, e.z);
      ctx.beginPath(); ctx.arc(px, py, 2, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(200, 225, 245, 0.5)"; ctx.fill();
    }
    if (pois.landmark) {
      const { px, py } = plot(pois.landmark.x, pois.landmark.z);
      ctx.beginPath(); ctx.arc(px, py, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = pois.accent; ctx.fill();
    }
    for (const g of pois.gates) {
      const { px, py } = plot(g.x, g.z);
      ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.strokeStyle = g.accent; ctx.lineWidth = 1.5; ctx.stroke();
    }
    const { px, py } = plot(playerPos.x, playerPos.z);
    ctx.beginPath(); ctx.arc(px, py, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = "#fff"; ctx.fill();

    ctx.fillStyle = "rgba(200, 225, 245, 0.5)";
    ctx.font = "600 8px Sora, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("N", cx, 12);
  };
};

/**
 * Creates the quick-look preview renderer and helpers.
 */
export const createQuickLook = (quickLookCanvas) => {
  // The WebGL context (a second one alongside the main scene) is created
  // lazily on first use so touch/low-power sessions that never hover a
  // node don't pay for it.
  let quickRenderer = null;
  let quickScene = null;
  let quickCamera = null;
  let meshRoot = null;
  let contextFailed = false;
  let pendingSize = null;

  const ensureContext = () => {
    if (quickRenderer || contextFailed) return !contextFailed;
    try {
      quickRenderer = new THREE.WebGLRenderer({
        canvas: quickLookCanvas,
        alpha: true,
        antialias: true,
        powerPreference: "low-power"
      });
    } catch {
      contextFailed = true;
      return false;
    }
    quickRenderer.outputColorSpace = THREE.SRGBColorSpace;
    quickRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.2));

    quickScene = new THREE.Scene();
    quickCamera = new THREE.PerspectiveCamera(38, 320 / 200, 0.1, 40);
    quickCamera.position.set(0, 1.15, 4.1);
    quickCamera.lookAt(0, 0.65, 0);
    quickScene.add(new THREE.AmbientLight(0xa4d5f3, 1.1));
    const quickKey = new THREE.DirectionalLight(0xd0ecff, 0.9);
    quickKey.position.set(3, 4, 2);
    quickScene.add(quickKey);

    meshRoot = new THREE.Group();
    quickScene.add(meshRoot);

    if (pendingSize) {
      applySize(pendingSize.w, pendingSize.h);
      pendingSize = null;
    }
    return true;
  };

  const applySize = (w, h) => {
    quickRenderer.setSize(w, h, false);
    quickCamera.aspect = w / h;
    quickCamera.updateProjectionMatrix();
  };

  let currentMesh = null;
  let currentKeyId = "";

  const clearMesh = () => {
    if (!currentMesh) return;
    meshRoot.remove(currentMesh);
    currentMesh.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    });
    currentMesh = null;
  };

  const show = (mesh, els) => {
    if (!mesh || els.modalOpen) {
      els.quickLookEl.hidden = true;
      els.quickLookEl.setAttribute("aria-hidden", "true");
      currentKeyId = "";
      clearMesh();
      return;
    }
    if (!ensureContext()) return;

    const kind = mesh.userData.kind;
    const entry = mesh.userData.entry;
    const color = kind === "projects" ? 0xff6b35 : (kind === "posts" ? 0x00e5ff : 0x7dffb3);
    const title = entry.title || entry.role || "Quick Look";
    const key = `${kind}:${entry.slug || entry.company || title}`;

    if (key !== currentKeyId) {
      clearMesh();
      currentMesh = buildQuickMesh(kind, color);
      meshRoot.add(currentMesh);
      currentKeyId = key;
    }

    els.quickLookKicker.textContent = kind.toUpperCase();
    els.quickLookTitle.textContent = title;
    els.quickLookSummary.textContent = kind === "projects"
      ? (entry.description || "Prototype details available on inspect.")
      : (kind === "posts" ? (entry.excerpt || "Transmission details available on inspect.") : summarizeExperience(entry));
    els.quickLookEl.hidden = false;
    els.quickLookEl.setAttribute("aria-hidden", "false");
  };

  const render = (dt) => {
    if (currentMesh && quickRenderer) {
      currentMesh.rotation.y += dt * 1.1;
      quickRenderer.render(quickScene, quickCamera);
    }
  };

  const resize = (canvas) => {
    const w = canvas.clientWidth || 320;
    const h = canvas.clientHeight || 200;
    if (quickRenderer) applySize(w, h);
    else pendingSize = { w, h };
  };

  const dispose = () => {
    clearMesh();
    if (quickRenderer) quickRenderer.dispose();
  };

  return { show, render, resize, dispose, clearMesh };
};
