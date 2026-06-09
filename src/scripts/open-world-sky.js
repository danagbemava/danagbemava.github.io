import * as THREE from "three";
import { destinations } from "./open-world-config.js";

// ── Gradient sky dome ────────────────────────────────────────────
const createSkyDome = (sky, lowPower) => {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTop: { value: new THREE.Color(sky.top) },
      uHorizon: { value: new THREE.Color(sky.horizon) },
      uBottom: { value: new THREE.Color(sky.bottom) }
    },
    vertexShader: `
      varying float vH;
      void main() {
        vH = normalize(position).y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uBottom;
      varying float vH;
      void main() {
        vec3 c = vH > 0.0
          ? mix(uHorizon, uTop, pow(vH, 0.55))
          : mix(uHorizon, uBottom, pow(-vH, 0.8));
        gl_FragColor = vec4(c, 1.0);
      }`,
    side: THREE.BackSide,
    fog: false,
    depthWrite: false
  });
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(260, lowPower ? 20 : 36, lowPower ? 14 : 24),
    material
  );
  dome.renderOrder = -10;
  return dome;
};

// ── Twinkling stars ──────────────────────────────────────────────
const createStars = (lowPower) => {
  const count = lowPower ? 700 : 2000;
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const phase = new Float32Array(count);
  const palette = [
    [0.88, 0.9, 1.0], [1.0, 0.95, 0.85], [0.75, 0.82, 1.0],
    [1.0, 0.7, 0.5], [0.6, 0.75, 1.0], [1.0, 1.0, 1.0]
  ];
  for (let i = 0; i < count; i += 1) {
    const c = i * 3;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 200 + Math.random() * 50;
    pos[c] = r * Math.sin(phi) * Math.cos(theta);
    pos[c + 1] = Math.abs(r * Math.cos(phi)) * 0.75 + 8;
    pos[c + 2] = r * Math.sin(phi) * Math.sin(theta);
    const p = palette[i % palette.length];
    col[c] = p[0]; col[c + 1] = p[1]; col[c + 2] = p[2];
    phase[i] = Math.random() * Math.PI * 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
  geo.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uSize: { value: lowPower ? 2.0 : 2.6 } },
    vertexShader: `
      attribute vec3 aColor; attribute float aPhase;
      uniform float uTime; uniform float uSize;
      varying vec3 vColor; varying float vTwinkle;
      void main() {
        vColor = aColor;
        vTwinkle = 0.6 + 0.4 * sin(uTime * 1.8 + aPhase);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = uSize * vTwinkle;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vColor; varying float vTwinkle;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        gl_FragColor = vec4(vColor, vTwinkle * (1.0 - d * 2.0));
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  return new THREE.Points(geo, material);
};

// ── Soft nebula billboards ───────────────────────────────────────
const nebulaTexture = (hex) => {
  const canvas = document.createElement("canvas");
  canvas.width = 256; canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const g = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
  g.addColorStop(0, `${hex}55`);
  g.addColorStop(0.5, `${hex}22`);
  g.addColorStop(1, `${hex}00`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(canvas);
};

const createNebula = (accentHexes, lowPower) => {
  const group = new THREE.Group();
  const count = lowPower ? 2 : 4;
  for (let i = 0; i < count; i += 1) {
    const hex = accentHexes[i % accentHexes.length];
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: nebulaTexture(hex),
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false
    }));
    const angle = (i / count) * Math.PI * 2 + 0.7;
    sprite.position.set(Math.cos(angle) * 170, 35 + i * 22, Math.sin(angle) * 170);
    const s = 130 + i * 35;
    sprite.scale.set(s, s * 0.6, 1);
    group.add(sprite);
  }
  return group;
};

// ── Fresnel atmosphere shell ─────────────────────────────────────
export const createFresnelShell = (radius, color, power = 2.6) => {
  const material = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uPower: { value: power } },
    vertexShader: `
      varying vec3 vNormal; varying vec3 vView;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uPower;
      varying vec3 vNormal; varying vec3 vView;
      void main() {
        float rim = pow(1.0 - abs(dot(vNormal, vView)), uPower);
        gl_FragColor = vec4(uColor, rim);
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  return new THREE.Mesh(new THREE.SphereGeometry(radius * 1.12, 32, 24), material);
};

// ── A planet as seen from space ──────────────────────────────────
export const createPlanetFromSpace = (planetDef, accent) => {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(planetDef.radius, 32, 24),
    new THREE.MeshStandardMaterial({
      color: planetDef.surfaceColor,
      emissive: planetDef.emissive,
      emissiveIntensity: 0.5,
      roughness: 0.9,
      metalness: 0.1,
      fog: false
    })
  );
  group.add(body);
  group.add(createFresnelShell(planetDef.radius, planetDef.limbColor));

  if (planetDef.ring === "discs") {
    for (let i = 0; i < 2; i += 1) {
      const disc = new THREE.Mesh(
        new THREE.RingGeometry(planetDef.radius * (1.4 + i * 0.35), planetDef.radius * (1.6 + i * 0.35), 48),
        new THREE.MeshBasicMaterial({
          color: accent, transparent: true, opacity: 0.3 - i * 0.1,
          blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false
        })
      );
      disc.rotation.x = Math.PI / 2.4;
      group.add(disc);
    }
  } else if (planetDef.ring === "ember") {
    const count = 90;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const r = planetDef.radius * (1.35 + Math.random() * 0.5);
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = (Math.random() - 0.5) * planetDef.radius * 0.18;
      pos[i * 3 + 2] = Math.sin(a) * r;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    group.add(new THREE.Points(geo, new THREE.PointsMaterial({
      color: accent, size: 1.6, transparent: true, opacity: 0.8,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false
    })));
  }

  group.userData.spinSpeed = 0.015 + Math.random() * 0.01;
  return group;
};

// ── Shooting stars ───────────────────────────────────────────────
const createShootingStars = (lowPower) => {
  const group = new THREE.Group();
  const streaks = [];
  if (!lowPower) {
    for (let i = 0; i < 2; i += 1) {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(14, 0.25),
        new THREE.MeshBasicMaterial({
          color: 0xffffff, transparent: true, opacity: 0,
          blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false
        })
      );
      group.add(mesh);
      streaks.push({ mesh, t: -1, nextAt: 4 + Math.random() * 12, dir: new THREE.Vector3() });
    }
  }
  const update = (dt) => {
    for (const s of streaks) {
      if (s.t < 0) {
        s.nextAt -= dt;
        if (s.nextAt <= 0) {
          s.t = 0;
          const a = Math.random() * Math.PI * 2;
          s.mesh.position.set(Math.cos(a) * 150, 70 + Math.random() * 40, Math.sin(a) * 150);
          s.dir.set(-Math.cos(a) + (Math.random() - 0.5), -0.35, -Math.sin(a) + (Math.random() - 0.5)).normalize();
          s.mesh.lookAt(s.mesh.position.clone().add(s.dir));
        }
      } else {
        s.t += dt;
        s.mesh.position.addScaledVector(s.dir, dt * 130);
        s.mesh.material.opacity = Math.sin(Math.min(1, s.t / 1.1) * Math.PI) * 0.8;
        if (s.t > 1.1) { s.t = -1; s.nextAt = 8 + Math.random() * 12; s.mesh.material.opacity = 0; }
      }
    }
  };
  return { group, update };
};

// ── Full backdrop for a destination ──────────────────────────────
// Returns { group, update(dt, t), dispose() }. The group contains the sky
// dome, stars, nebula, shooting stars, and the OTHER destinations as
// planets in the sky (for the hub: all three; for a planet: its sisters
// plus a small hub-station beacon).
export const createSpaceBackdrop = (destKey, lowPower) => {
  const dest = destinations[destKey];
  const group = new THREE.Group();
  const dome = createSkyDome(dest.sky, lowPower);
  const stars = createStars(lowPower);
  const accentHexes = [`#${dest.accent.toString(16).padStart(6, "0")}`, "#6840a0", "#30308a"];
  const nebula = createNebula(accentHexes, lowPower);
  const shooting = createShootingStars(lowPower);
  group.add(dome, stars, nebula, shooting.group);

  const skyPlanets = [];
  for (const other of Object.values(destinations)) {
    if (other.key === destKey || !other.planet) continue;
    const p = createPlanetFromSpace(other.planet, other.accent);
    const d = other.planet.skyDir;
    p.position.set(d[0], d[1], d[2]).normalize().multiplyScalar(other.planet.skyDist);
    group.add(p);
    skyPlanets.push(p);
  }
  if (destKey !== "home") {
    // Hub station beacon: a small bright point with a lavender halo.
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(1.6, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0xc8b0ff, fog: false })
    );
    beacon.position.set(40, 95, -120);
    const halo = createFresnelShell(4, 0xc8b0ff, 2.0);
    halo.position.copy(beacon.position);
    group.add(beacon, halo);
  }

  const update = (dt, t) => {
    stars.material.uniforms.uTime.value = t;
    shooting.update(dt, t);
    for (const p of skyPlanets) p.rotation.y += dt * p.userData.spinSpeed;
  };

  const dispose = () => {
    group.removeFromParent();
    group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (obj.material.map) obj.material.map.dispose();
        obj.material.dispose();
      }
    });
  };

  return { group, update, dispose };
};
