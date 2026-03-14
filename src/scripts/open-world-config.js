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

let loaderPromise = null;
export const getGltfLoader = async () => {
  if (!loaderPromise) {
    loaderPromise = import("three/examples/jsm/loaders/GLTFLoader.js")
      .then(({ GLTFLoader }) => new GLTFLoader())
      .catch(() => null);
  }
  return loaderPromise;
};
