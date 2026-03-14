import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * Loads the player avatar (GLTF soldier model with capsule fallback), attaches
 * a ground ring, positions and faces the avatar toward the nearest statue, and
 * adds it to the scene.
 *
 * @param {THREE.Scene} scene
 * @param {Array<{ x: number, z: number }>} statueSpots
 * @returns {{
 *   avatar: THREE.Group,
 *   avatarRing: THREE.Mesh,
 *   fadeTo: (name: string, duration?: number) => void,
 *   getMixer: () => THREE.AnimationMixer | null,
 *   getClips: () => Record<string, THREE.AnimationAction>,
 *   getFallbackWalker: () => THREE.Mesh | null
 * }}
 */
export const buildAvatar = (scene, statueSpots) => {
  const avatar = new THREE.Group();
  let mixer = null;
  const clips = {};
  let activeAction = null;
  let fallbackWalker = null;

  const fadeTo = (name, duration = 0.26) => {
    const nextAction = clips[name];
    if (!nextAction || nextAction === activeAction) return;
    if (activeAction) activeAction.fadeOut(duration);
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
        new THREE.MeshStandardMaterial({
          color: 0x8de4c5,
          emissive: 0x2ca27a,
          emissiveIntensity: 0.22
        })
      );
      fallbackWalker.position.y = 1.1;
      avatar.add(fallbackWalker);
    }
  );

  // Ground ring beneath the avatar
  const avatarRing = new THREE.Mesh(
    new THREE.RingGeometry(0.55, 0.75, 48),
    new THREE.MeshBasicMaterial({ color: 0x91f7d2, transparent: true, opacity: 0.54 })
  );
  avatarRing.rotation.x = -Math.PI / 2;
  avatarRing.position.y = 0.04;
  avatar.add(avatarRing);

  avatar.position.set(0, 0, 14);

  // Face the nearest statue on spawn
  if (statueSpots.length) {
    const nearest = statueSpots.reduce((closest, spot) => {
      if (!closest) return spot;
      const d = Math.hypot(avatar.position.x - spot.x, avatar.position.z - spot.z);
      const best = Math.hypot(avatar.position.x - closest.x, avatar.position.z - closest.z);
      return d < best ? spot : closest;
    }, null);
    if (nearest) {
      avatar.rotation.y =
        Math.atan2(nearest.x - avatar.position.x, nearest.z - avatar.position.z) + Math.PI;
    }
  }

  scene.add(avatar);

  return {
    avatar,
    avatarRing,
    fadeTo,
    getMixer: () => mixer,
    getClips: () => clips,
    getFallbackWalker: () => fallbackWalker
  };
};
