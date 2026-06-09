import * as THREE from "three";

// Lazily builds the bloom composer the first time quality tier 2 is
// active. Returns null on any import/initialization failure so the
// caller falls back to direct rendering.
export const createBloomPipeline = async (renderer, scene, camera) => {
  try {
    const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }] = await Promise.all([
      import("three/examples/jsm/postprocessing/EffectComposer.js"),
      import("three/examples/jsm/postprocessing/RenderPass.js"),
      import("three/examples/jsm/postprocessing/UnrealBloomPass.js"),
      import("three/examples/jsm/postprocessing/OutputPass.js")
    ]);
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.6, 0.75);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    return {
      render: () => composer.render(),
      setSize: (w, h) => composer.setSize(w, h),
      dispose: () => composer.dispose()
    };
  } catch {
    return null;
  }
};
