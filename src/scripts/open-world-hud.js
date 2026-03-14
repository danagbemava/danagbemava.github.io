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

  return els;
};

/**
 * Creates the minimap drawing function.
 */
export const createMinimap = (minimapCanvas) => {
  const ctx = minimapCanvas ? minimapCanvas.getContext("2d") : null;

  const districts = [
    { name: "home", x: 0, z: 0, color: "#a2d7ff" },
    { name: "projects", x: -38, z: 0, color: "#4fc3f7" },
    { name: "posts", x: 38, z: 0, color: "#ffab40" },
    { name: "experiences", x: 0, z: -38, color: "#6de2bc" }
  ];
  const labels = { home: "H", projects: "P", posts: "B", experiences: "E" };

  return (playerPos, zone) => {
    if (!ctx || !minimapCanvas) return;
    const w = minimapCanvas.width;
    const h = minimapCanvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const scale = 1.25;

    ctx.clearRect(0, 0, w, h);

    ctx.beginPath();
    ctx.arc(cx, cy, cx - 2, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(5, 10, 18, 0.7)";
    ctx.fill();

    for (const d of districts) {
      const dx = (d.x - playerPos.x) * scale + cx;
      const dy = (d.z - playerPos.z) * scale + cy;
      if (dx < -10 || dx > w + 10 || dy < -10 || dy > h + 10) {
        const angle = Math.atan2(dy - cy, dx - cx);
        const edgeR = cx - 10;
        const ex = cx + Math.cos(angle) * edgeR;
        const ey = cy + Math.sin(angle) * edgeR;
        ctx.beginPath();
        ctx.arc(ex, ey, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = d.name === zone ? d.color : "rgba(120, 180, 220, 0.3)";
        ctx.fill();
      } else {
        const isActive = d.name === zone;
        const r = isActive ? 7 : 5;
        ctx.beginPath();
        ctx.arc(dx, dy, r, 0, Math.PI * 2);
        ctx.fillStyle = isActive ? d.color : "rgba(120, 180, 220, 0.25)";
        ctx.fill();
        if (isActive) {
          ctx.beginPath();
          ctx.arc(dx, dy, r + 3, 0, Math.PI * 2);
          ctx.strokeStyle = d.color;
          ctx.globalAlpha = 0.35;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        ctx.fillStyle = isActive ? "#fff" : "rgba(200, 225, 245, 0.55)";
        ctx.font = `${isActive ? "700" : "600"} ${isActive ? 8 : 7}px Sora, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(labels[d.name] || "", dx, dy);
      }
    }

    // Player dot
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Compass N
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
  const quickRenderer = new THREE.WebGLRenderer({
    canvas: quickLookCanvas,
    alpha: true,
    antialias: true,
    powerPreference: "low-power"
  });
  quickRenderer.outputColorSpace = THREE.SRGBColorSpace;
  quickRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.2));

  const quickScene = new THREE.Scene();
  const quickCamera = new THREE.PerspectiveCamera(38, 320 / 200, 0.1, 40);
  quickCamera.position.set(0, 1.15, 4.1);
  quickCamera.lookAt(0, 0.65, 0);
  quickScene.add(new THREE.AmbientLight(0xa4d5f3, 1.1));
  const quickKey = new THREE.DirectionalLight(0xd0ecff, 0.9);
  quickKey.position.set(3, 4, 2);
  quickScene.add(quickKey);

  const meshRoot = new THREE.Group();
  quickScene.add(meshRoot);

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

    const kind = mesh.userData.kind;
    const entry = mesh.userData.entry;
    const color = kind === "projects" ? 0x4fc3f7 : (kind === "posts" ? 0xffab40 : 0x6de2bc);
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
    if (currentMesh) {
      currentMesh.rotation.y += dt * 1.1;
      quickRenderer.render(quickScene, quickCamera);
    }
  };

  const resize = (canvas) => {
    const w = canvas.clientWidth || 320;
    const h = canvas.clientHeight || 200;
    quickRenderer.setSize(w, h, false);
    quickCamera.aspect = w / h;
    quickCamera.updateProjectionMatrix();
  };

  const dispose = () => {
    clearMesh();
    quickRenderer.dispose();
  };

  return { show, render, resize, dispose, clearMesh };
};
