import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * Initialises the WebGL renderer, scene, camera, lighting, floor, path line,
 * and path step markers for the experiences world. The floor receives the
 * shared colormap texture if available.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {{ exposure: number, ambient: number, key: number, rim: number, fogNear: number, fogFar: number }} worldProfile
 * @returns {{ renderer, scene, camera, ambientLight, keyLight, rimLight } | null}
 */
export const buildScene = (canvas, worldProfile) => {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  } catch (error) {
    console.error("Could not initialize experiences renderer:", error);
    return null;
  }

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = worldProfile.exposure;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x06140f);
  scene.fog = new THREE.FogExp2(0x061a10, 0.013);

  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 220);
  camera.position.set(0, 5.2, 14);

  // ── Lighting ──────────────────────────────────────────────────────────────
  const ambientLight = new THREE.AmbientLight(0x8ec6b2, worldProfile.ambient);
  scene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight(0xbbeee0, worldProfile.key);
  keyLight.position.set(8, 16, 7);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0x3dc79b, worldProfile.rim);
  rimLight.position.set(-8, 8, -10);
  scene.add(rimLight);

  // ── Floor — colormap texture applied if available ─────────────────────────
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x0a241b,
    roughness: 0.88,
    metalness: 0.2
  });

  const texLoader = new THREE.TextureLoader();
  texLoader.load(
    "/models/world/experiences/Textures/colormap.png",
    (texture) => {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(6, 40);
      texture.colorSpace = THREE.SRGBColorSpace;
      floorMat.map = texture;
      floorMat.color.set(0xffffff); // let texture carry the colour
      floorMat.needsUpdate = true;
    }
  );

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(54, 300), floorMat);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  // ── Path line ─────────────────────────────────────────────────────────────
  const pathLine = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.06, 300),
    new THREE.MeshStandardMaterial({
      color: 0x1f6b55,
      emissive: 0x1f6b55,
      emissiveIntensity: 0.32
    })
  );
  pathLine.position.set(0, 0.04, -125);
  scene.add(pathLine);

  // ── Path step markers ─────────────────────────────────────────────────────
  const markerCount = 100;
  for (let i = 0; i < markerCount; i += 1) {
    const marker = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.05, 1.6),
      new THREE.MeshStandardMaterial({ color: 0xc6f5e6, transparent: true, opacity: 0.38 })
    );
    marker.position.set(0, 0.07, 20 - i * 3);
    scene.add(marker);
  }

  return { renderer, scene, camera, ambientLight, keyLight, rimLight };
};

// ── GLB material tint helper ───────────────────────────────────────────────
const tintModel = (root, hexColor, emissiveHex, emissiveIntensity = 0.08) => {
  root.traverse((child) => {
    if (child.isMesh && child.material) {
      child.material = child.material.clone();
      child.material.color?.set(hexColor);
      if (child.material.emissive) {
        child.material.emissive.set(emissiveHex);
        child.material.emissiveIntensity = emissiveIntensity;
      }
    }
  });
};

/**
 * Asynchronously loads and places the three experiences district GLB models:
 *   - memory_obelisk  → entry gateway at the corridor start
 *   - timeline_bridge → tiled along the path corridor
 *   - skill_garden    → side dressing scattered along the corridor
 *
 * Resilient: each load is independent; a missing file is silently skipped.
 *
 * @param {THREE.Scene} scene
 */
export const loadExperienceModels = (scene) => {
  const loader = new GLTFLoader();

  // ── Memory obelisk — entry gateway ────────────────────────────────────────
  loader.load(
    "/models/world/experiences/memory_obelisk.glb",
    (gltf) => {
      const obelisk = gltf.scene;

      // Normalise scale so the tallest dimension is ~4 units
      const box = new THREE.Box3().setFromObject(obelisk);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const targetHeight = 4.0;
      const s = targetHeight / maxDim;
      obelisk.scale.setScalar(s);

      tintModel(obelisk, 0x1a4d3a, 0x3dc79b, 0.14);

      // Centre above ground at z ≈ 2 — just ahead of avatar spawn (z=14)
      // so it's visible immediately but doesn't block the path
      const box2 = new THREE.Box3().setFromObject(obelisk);
      const groundOffset = -box2.min.y;
      obelisk.position.set(0, groundOffset, 2);
      scene.add(obelisk);
    },
    undefined,
    () => {} // missing file → skip
  );

  // ── Timeline bridge — tiled corridor ─────────────────────────────────────
  loader.load(
    "/models/world/experiences/timeline_bridge.glb",
    (gltf) => {
      const template = gltf.scene;

      // Measure the model's Z extent to know tile spacing
      const box = new THREE.Box3().setFromObject(template);
      const size = box.getSize(new THREE.Vector3());

      // Scale so width ≈ 2.4 units (just wider than the path line)
      const xDim = size.x || 1;
      const targetWidth = 2.4;
      const s = targetWidth / xDim;
      template.scale.setScalar(s);

      // Re-measure after scale
      const scaledBox = new THREE.Box3().setFromObject(template);
      const scaledSize = scaledBox.getSize(new THREE.Vector3());
      const tileDepth = (scaledSize.z || 4) * 0.95; // slight overlap to avoid gaps
      const groundOffset = -scaledBox.min.y;

      tintModel(template, 0x0d3326, 0x4fbb99, 0.06);

      // Tile from z=18 down to z=-114 (corridor length ≈ 132 units)
      const corridorStart = 18;
      const corridorEnd = -114;
      const tileCount = Math.ceil((corridorStart - corridorEnd) / tileDepth) + 1;

      for (let i = 0; i < tileCount; i++) {
        const tile = template.clone(true);
        tile.position.set(0, groundOffset, corridorStart - i * tileDepth);
        scene.add(tile);
      }
    },
    undefined,
    () => {}
  );

  // ── Skill garden — ambient side dressing ──────────────────────────────────
  loader.load(
    "/models/world/experiences/skill_garden.glb",
    (gltf) => {
      const template = gltf.scene;

      // Normalise to ~2.5 units tall
      const box = new THREE.Box3().setFromObject(template);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const s = 2.5 / maxDim;
      template.scale.setScalar(s);

      const scaledBox = new THREE.Box3().setFromObject(template);
      const groundOffset = -scaledBox.min.y;

      tintModel(template, 0x1e5c44, 0x6de2bc, 0.1);

      // Scatter 6 instances along both sides of the corridor
      const placements = [
        { x: -14, z: -20,  ry: 0.4 },
        { x:  14, z: -38,  ry: -0.6 },
        { x: -13, z: -60,  ry: 1.1 },
        { x:  13, z: -80,  ry: -1.3 },
        { x: -12, z: -100, ry: 0.8 },
        { x:  12, z: -50,  ry: -0.2 },
      ];

      for (const p of placements) {
        const instance = template.clone(true);
        instance.position.set(p.x, groundOffset, p.z);
        instance.rotation.y = p.ry;
        scene.add(instance);
      }
    },
    undefined,
    () => {}
  );
};
