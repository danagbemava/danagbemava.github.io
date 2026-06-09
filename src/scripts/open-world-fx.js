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

// Footstep ripples + landing dust. Pools, additive, cheap.
export const createGroundFx = (scene, lowPower) => {
  const ripples = [];
  const dust = [];
  if (!lowPower) {
    for (let i = 0; i < 6; i += 1) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.18, 0.26, 20),
        new THREE.MeshBasicMaterial({ color: 0xa7deff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      ring.rotation.x = -Math.PI / 2;
      scene.add(ring);
      ripples.push({ mesh: ring, t: -1 });
    }
    for (let i = 0; i < 10; i += 1) {
      const mote = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 6, 4),
        new THREE.MeshBasicMaterial({ color: 0xd0c8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      scene.add(mote);
      dust.push({ mesh: mote, t: -1, vx: 0, vy: 0, vz: 0 });
    }
  }

  const ripple = (pos) => {
    const r = ripples.find((x) => x.t < 0);
    if (!r) return;
    r.t = 0;
    r.mesh.position.set(pos.x, 0.05, pos.z);
  };

  const burst = (pos) => {
    let used = 0;
    for (const d of dust) {
      if (d.t >= 0 || used >= 6) continue;
      used += 1;
      d.t = 0;
      d.mesh.position.set(pos.x, 0.15, pos.z);
      const a = Math.random() * Math.PI * 2;
      d.vx = Math.cos(a) * (1 + Math.random());
      d.vz = Math.sin(a) * (1 + Math.random());
      d.vy = 1.5 + Math.random();
    }
  };

  const update = (dt) => {
    for (const r of ripples) {
      if (r.t < 0) continue;
      r.t += dt;
      const k = r.t / 0.55;
      if (k >= 1) { r.t = -1; r.mesh.material.opacity = 0; continue; }
      r.mesh.scale.setScalar(1 + k * 4);
      r.mesh.material.opacity = 0.35 * (1 - k);
    }
    for (const d of dust) {
      if (d.t < 0) continue;
      d.t += dt;
      if (d.t >= 0.6) { d.t = -1; d.mesh.material.opacity = 0; continue; }
      d.vy -= 6 * dt;
      d.mesh.position.x += d.vx * dt;
      d.mesh.position.y = Math.max(0.05, d.mesh.position.y + d.vy * dt);
      d.mesh.position.z += d.vz * dt;
      d.mesh.material.opacity = 0.5 * (1 - d.t / 0.6);
    }
  };

  return { ripple, burst, update };
};
