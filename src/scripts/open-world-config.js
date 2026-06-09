import * as THREE from "three";

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const lerp = (from, to, t) => from + (to - from) * t;
export const colorToHex = (value) => `#${value.toString(16).padStart(6, "0")}`;

export const safeAudio = (callback) => {
  try {
    callback();
  } catch {
    // Audio can fail before a user gesture on some browsers; rendering should continue.
  }
};

export const parseJsonNode = (id) => {
  const node = document.getElementById(id);
  if (!node) return [];
  try {
    return JSON.parse(node.textContent || "[]");
  } catch {
    return [];
  }
};

export const summarizeExperience = (entry) => {
  const tenure = entry.tenure ? `${entry.tenure} · ` : "";
  const company = entry.company || "Experience";
  const summary = entry.summary || "Inspect this role for details.";
  return `${tenure}${company}\n${summary}`;
};

export const createSpriteLabel = (text, color = "#e0d8ff", scale = { x: 4.6, y: 1.2 }) => {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 200;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Frosted glass look
  ctx.fillStyle = "rgba(8, 4, 22, 0.72)";
  ctx.strokeStyle = "rgba(180, 160, 255, 0.35)";
  ctx.lineWidth = 4;
  const r = 18;
  const x = 12, y = 12, w = canvas.width - 24, h = canvas.height - 24;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.font = "700 54px Sora, sans-serif";

  const normalized = text.length > 42 ? `${text.slice(0, 39)}...` : text;
  ctx.fillText(normalized, canvas.width / 2, canvas.height / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true, depthWrite: false })
  );
  sprite.scale.set(scale.x, scale.y, 1);
  return sprite;
};

export const districtConfig = {
  home:        { center: new THREE.Vector3(0, 0, 0),    title: "Sector: NEXUS CORE",    color: 0xc8b0ff },
  projects:    { center: new THREE.Vector3(-38, 0, 0),   title: "Sector: STELLAR FORGE",  color: 0xff6b35 },
  posts:       { center: new THREE.Vector3(38, 0, 0),    title: "Sector: SIGNAL ARRAY",   color: 0x00e5ff },
  experiences: { center: new THREE.Vector3(0, 0, -38),   title: "Sector: MEMORY GROVE",   color: 0x7dffb3 }
};

export const districtAtmosphere = {
  home:        { bg: 0x08041a, fog: 0x0a0520, ambient: 1.0,  rim: 0.55, fogDensity: 0.0088 },
  projects:    { bg: 0x120808, fog: 0x0e0604, ambient: 0.88, rim: 0.72, fogDensity: 0.0076 },
  posts:       { bg: 0x040e14, fog: 0x030a10, ambient: 1.08, rim: 0.62, fogDensity: 0.0082 },
  experiences: { bg: 0x041208, fog: 0x030e06, ambient: 1.12, rim: 0.68, fogDensity: 0.0078 }
};

export const districtPresentation = {
  home: {
    accent: 0xc8b0ff,
    accentSoft: "rgba(200, 176, 255, 0.2)",
    blurb: "Central nexus. The orrery hums with stellar data. All districts converge here.",
    objective: "Explore districts and activate each landmark beacon."
  },
  projects: {
    accent: 0xff6b35,
    accentSoft: "rgba(255, 107, 53, 0.22)",
    blurb: "Stellar forge. Systems are hammered into shape in the crucible of molten light.",
    objective: "Inspect a project node and ignite the Forge Core."
  },
  posts: {
    accent: 0x00e5ff,
    accentSoft: "rgba(0, 229, 255, 0.2)",
    blurb: "Signal array. Transmissions radiate outward from crystalline relay towers.",
    objective: "Inspect a signal node and pulse the Relay Spire."
  },
  experiences: {
    accent: 0x7dffb3,
    accentSoft: "rgba(125, 255, 179, 0.2)",
    blurb: "Memory grove. Career echoes bloom as bioluminescent flora across this living archive.",
    objective: "Inspect a memory node and resonate the Bloom Heart."
  }
};

export const getStartPosition = (zone) => {
  const config = districtConfig[zone] || districtConfig.home;
  return new THREE.Vector3(config.center.x, 0, config.center.z + 5);
};

// ── Destinations (planet world) ──────────────────────────────────
// Keys match world-state zone keys. `planet` describes the body as seen
// from space; `gates` are warp gates placed in that scene.
export const destinations = {
  home: {
    key: "home", name: "Nexus Station", title: "NEXUS STATION", kicker: "Orbital Hub",
    accent: 0xc8b0ff, accentSoft: "rgba(200, 176, 255, 0.2)",
    blurb: "Orbital command station. Three worlds hang in the dark beyond the gates.",
    objective: "Step through a warp gate, or open the starmap [M].",
    sky: { top: 0x06021a, horizon: 0x1a0f3a, bottom: 0x030110 },
    fog: { color: 0x0a0520, density: 0.0032 },
    lights: { ambient: 1.0, rim: 0.55 },
    vacuum: true, biome: null, boundsRadius: 13,
    spawn: { x: 0, z: 8 },
    gates: [
      { to: "projects", x: -11, z: 0, rotationY: Math.PI / 2 },
      { to: "posts", x: 11, z: 0, rotationY: -Math.PI / 2 },
      { to: "experiences", x: 0, z: -11, rotationY: 0 }
    ],
    planet: null
  },
  projects: {
    key: "projects", name: "Forge", title: "FORGE", kicker: "Stellar Foundry",
    accent: 0xff6b35, accentSoft: "rgba(255, 107, 53, 0.22)",
    blurb: "A molten world where systems are hammered into shape in crucibles of light.",
    objective: "Inspect a project node and ignite the Forge Core.",
    sky: { top: 0x0c0302, horizon: 0x521b06, bottom: 0x1a0804 },
    fog: { color: 0x2a0e04, density: 0.006 },
    lights: { ambient: 0.88, rim: 0.72 },
    vacuum: false, biome: "forge", boundsRadius: 40,
    spawn: { x: 0, z: 27 },
    gates: [
      { to: "home", x: 0, z: 33, rotationY: Math.PI },
      { to: "posts", x: 28, z: 18, rotationY: -Math.PI / 3 },
      { to: "experiences", x: -28, z: 18, rotationY: Math.PI / 3 }
    ],
    planet: { surfaceColor: 0x35140a, emissive: 0x802a08, limbColor: 0xff8a50, radius: 22, ring: "ember", skyDir: [-1, 0.28, -0.35], skyDist: 165 },
    groundColor: 0x1a0a05
  },
  posts: {
    key: "posts", name: "Signal", title: "SIGNAL", kicker: "Relay World",
    accent: 0x00e5ff, accentSoft: "rgba(0, 229, 255, 0.2)",
    blurb: "A crystalline world of relay spires, broadcasting beneath an aurora sky.",
    objective: "Inspect a signal node and pulse the Relay Spire.",
    sky: { top: 0x020a12, horizon: 0x0a3a4a, bottom: 0x04141c },
    fog: { color: 0x07222c, density: 0.0055 },
    lights: { ambient: 1.08, rim: 0.62 },
    vacuum: false, biome: "signal", boundsRadius: 40,
    spawn: { x: 0, z: 27 },
    gates: [
      { to: "home", x: 0, z: 33, rotationY: Math.PI },
      { to: "projects", x: -28, z: 18, rotationY: Math.PI / 3 },
      { to: "experiences", x: 28, z: 18, rotationY: -Math.PI / 3 }
    ],
    planet: { surfaceColor: 0x0a2030, emissive: 0x0a4a5a, limbColor: 0x60f0ff, radius: 20, ring: "discs", skyDir: [1, 0.32, -0.4], skyDist: 170 },
    groundColor: 0x06141c
  },
  experiences: {
    key: "experiences", name: "Grove", title: "GROVE", kicker: "Living Archive",
    accent: 0x7dffb3, accentSoft: "rgba(125, 255, 179, 0.2)",
    blurb: "A living world. Career echoes bloom as bioluminescent flora across the archive.",
    objective: "Inspect a memory node and resonate the Bloom Heart.",
    sky: { top: 0x02120a, horizon: 0x0e4a28, bottom: 0x04180c },
    fog: { color: 0x0a2a16, density: 0.0058 },
    lights: { ambient: 1.12, rim: 0.68 },
    vacuum: false, biome: "grove", boundsRadius: 40,
    spawn: { x: 0, z: 27 },
    gates: [
      { to: "home", x: 0, z: 33, rotationY: Math.PI },
      { to: "projects", x: -28, z: 18, rotationY: Math.PI / 3 },
      { to: "posts", x: 28, z: 18, rotationY: -Math.PI / 3 }
    ],
    planet: { surfaceColor: 0x0c2a14, emissive: 0x1a5a2a, limbColor: 0xa0ffce, radius: 21, ring: null, skyDir: [0, 0.45, -1], skyDist: 155 },
    groundColor: 0x07180d
  }
};

export const destinationKeys = Object.keys(destinations);

export const keyFromHash = () => {
  const m = (window.location.hash || "").match(/^#\/(\w+)/);
  return m && destinations[m[1]] ? m[1] : null;
};

export const setHashForDestination = (key) => {
  const target = `#/${key}`;
  if (window.location.hash !== target) {
    history.pushState(null, "", target);
  }
};

let loaderPromise = null;
export const getGltfLoader = async () => {
  if (!loaderPromise) {
    loaderPromise = import("three/examples/jsm/loaders/GLTFLoader.js")
      .then(({ GLTFLoader }) => new GLTFLoader())
      .catch(() => null);
  }
  return loaderPromise;
};
