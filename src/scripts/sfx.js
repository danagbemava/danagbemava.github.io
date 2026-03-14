// Sci-fi / cyberpunk sound effects via Web Audio API

let ctx = null;
let masterGain = null;
let muted = false;

const audioProfile = {
  zone: "home",
  energy: 0.62,
  proximity: 0,
  eventBoost: 0
};

const zoneHumBase = {
  home: 90,
  projects: 108,
  posts: 82,
  experiences: 96,
  holodeck: 108,
  timeline: 82
};

const zoneAmbientBase = {
  home: 0.048,
  projects: 0.058,
  posts: 0.052,
  experiences: 0.05,
  holodeck: 0.058,
  timeline: 0.052
};

const ensure = () => {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = muted ? 0 : 0.35;
    masterGain.connect(ctx.destination);
  }
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {
      // Some browsers require another explicit user gesture.
    });
  }
  return ctx;
};

const ambientTargetGain = () => {
  const zone = zoneAmbientBase[audioProfile.zone] ?? zoneAmbientBase.home;
  return Math.min(
    0.11,
    zone + audioProfile.energy * 0.015 + audioProfile.proximity * 0.024 + audioProfile.eventBoost * 0.02
  );
};

const applyAmbientProfile = () => {
  if (!ambientGain || !ctx) {
    return;
  }
  const target = ambientTargetGain();
  ambientGain.gain.cancelScheduledValues(ctx.currentTime);
  ambientGain.gain.linearRampToValueAtTime(target, ctx.currentTime + 0.28);
};

export const setWorldAudioProfile = (patch = {}) => {
  if (typeof patch.zone === "string") audioProfile.zone = patch.zone;
  if (typeof patch.energy === "number") audioProfile.energy = Math.min(1, Math.max(0, patch.energy));
  if (typeof patch.proximity === "number") audioProfile.proximity = Math.min(1, Math.max(0, patch.proximity));
  if (typeof patch.eventBoost === "number") audioProfile.eventBoost = Math.min(1, Math.max(0, patch.eventBoost));

  ensure();
  applyAmbientProfile();

  if (humOsc && humGain) {
    const humBase = zoneHumBase[audioProfile.zone] ?? 95;
    humOsc.frequency.setTargetAtTime(
      humBase + audioProfile.proximity * 45 + audioProfile.energy * 8,
      ctx.currentTime,
      0.12
    );
    humGain.gain.setTargetAtTime(
      Math.min(
        0.11,
        audioProfile.proximity * (0.04 + audioProfile.energy * 0.05 + audioProfile.eventBoost * 0.03)
      ),
      ctx.currentTime,
      0.12
    );
  }
};

export const toggleMute = () => {
  muted = !muted;
  if (masterGain) masterGain.gain.value = muted ? 0 : 0.35;
  return muted;
};

export const isMuted = () => muted;

export const primeAudio = () => {
  ensure();
};

// -- Footstep: short metallic tick, synced by stride distance --
let distanceSinceStep = 0;
const STRIDE_LENGTH = 2.2;
export const updateFootsteps = (deltaDist) => {
  distanceSinceStep += deltaDist;
  if (distanceSinceStep >= STRIDE_LENGTH) {
    distanceSinceStep -= STRIDE_LENGTH;
    const c = ensure();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(160 + Math.random() * 80, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(70, c.currentTime + 0.06);
    gain.gain.setValueAtTime(0.12, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.09);
    osc.connect(gain).connect(masterGain);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + 0.09);
  }
};

export const resetFootsteps = () => {
  distanceSinceStep = 0;
};

// -- Door open: servo whir --
export const playDoorOpen = () => {
  const c = ensure();
  const osc = c.createOscillator();
  const osc2 = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(120, c.currentTime);
  osc.frequency.linearRampToValueAtTime(340, c.currentTime + 0.3);
  osc2.type = "sine";
  osc2.frequency.setValueAtTime(600, c.currentTime);
  osc2.frequency.linearRampToValueAtTime(900, c.currentTime + 0.3);
  gain.gain.setValueAtTime(0.08, c.currentTime);
  gain.gain.linearRampToValueAtTime(0.14, c.currentTime + 0.12);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.45);
  osc.connect(gain);
  osc2.connect(gain);
  gain.connect(masterGain);
  osc.start(c.currentTime);
  osc.stop(c.currentTime + 0.45);
  osc2.start(c.currentTime);
  osc2.stop(c.currentTime + 0.45);
};

// -- Door close: reverse servo whir + thud --
export const playDoorClose = () => {
  const c = ensure();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(300, c.currentTime);
  osc.frequency.linearRampToValueAtTime(80, c.currentTime + 0.25);
  gain.gain.setValueAtTime(0.07, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.3);
  osc.connect(gain).connect(masterGain);
  osc.start(c.currentTime);
  osc.stop(c.currentTime + 0.3);

  const thud = c.createOscillator();
  const thudGain = c.createGain();
  thud.type = "sine";
  thud.frequency.setValueAtTime(55, c.currentTime + 0.22);
  thud.frequency.exponentialRampToValueAtTime(30, c.currentTime + 0.38);
  thudGain.gain.setValueAtTime(0, c.currentTime);
  thudGain.gain.setValueAtTime(0.18, c.currentTime + 0.22);
  thudGain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.42);
  thud.connect(thudGain).connect(masterGain);
  thud.start(c.currentTime + 0.2);
  thud.stop(c.currentTime + 0.42);
};

// -- Portal whoosh: sweeping noise + descending tone --
export const playPortalEnter = () => {
  const c = ensure();
  const dur = 0.85;

  const bufSize = c.sampleRate * dur;
  const buf = c.createBuffer(1, bufSize, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  const noise = c.createBufferSource();
  noise.buffer = buf;

  const bandpass = c.createBiquadFilter();
  bandpass.type = "bandpass";
  bandpass.frequency.setValueAtTime(2000, c.currentTime);
  bandpass.frequency.exponentialRampToValueAtTime(200, c.currentTime + dur);
  bandpass.Q.value = 3;

  const nGain = c.createGain();
  nGain.gain.setValueAtTime(0.0, c.currentTime);
  nGain.gain.linearRampToValueAtTime(0.22, c.currentTime + 0.15);
  nGain.gain.linearRampToValueAtTime(0.0, c.currentTime + dur);
  noise.connect(bandpass).connect(nGain).connect(masterGain);
  noise.start(c.currentTime);
  noise.stop(c.currentTime + dur);

  const osc = c.createOscillator();
  const oGain = c.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(800, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(60, c.currentTime + dur);
  oGain.gain.setValueAtTime(0.15, c.currentTime);
  oGain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
  osc.connect(oGain).connect(masterGain);
  osc.start(c.currentTime);
  osc.stop(c.currentTime + dur);
};

// -- UI beep: short confirm --
export const playBeep = () => {
  const c = ensure();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(880, c.currentTime);
  osc.frequency.setValueAtTime(1100, c.currentTime + 0.06);
  gain.gain.setValueAtTime(0.1, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.14);
  osc.connect(gain).connect(masterGain);
  osc.start(c.currentTime);
  osc.stop(c.currentTime + 0.14);
};

export const playWorldEventPulse = (zone = "home", energy = 0.6) => {
  const c = ensure();
  const osc = c.createOscillator();
  const gain = c.createGain();
  const base = zoneHumBase[zone] ?? 95;
  osc.type = "triangle";
  osc.frequency.setValueAtTime(base + 280, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(base + 120, c.currentTime + 0.22);
  gain.gain.setValueAtTime(0.06 + energy * 0.04, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.3);
  osc.connect(gain).connect(masterGain);
  osc.start(c.currentTime);
  osc.stop(c.currentTime + 0.3);
};

// -- Proximity hum: continuous drone near interactables --
let humOsc = null;
let humGain = null;
export const updateProximityHum = (intensity) => {
  if (muted || !ctx) return;
  const value = Math.min(1, Math.max(0, intensity));
  audioProfile.proximity = value;

  if (value > 0.01 && !humOsc) {
    const c = ensure();
    humOsc = c.createOscillator();
    humGain = c.createGain();
    humOsc.type = "sine";
    humOsc.frequency.value = zoneHumBase[audioProfile.zone] ?? 95;
    humGain.gain.value = 0;
    humOsc.connect(humGain).connect(masterGain);
    humOsc.start();
  }

  if (humGain && humOsc && ctx) {
    const base = zoneHumBase[audioProfile.zone] ?? 95;
    humOsc.frequency.setTargetAtTime(base + value * 45 + audioProfile.energy * 8, ctx.currentTime, 0.12);
    humGain.gain.setTargetAtTime(
      Math.min(0.11, value * (0.04 + audioProfile.energy * 0.05 + audioProfile.eventBoost * 0.03)),
      ctx.currentTime,
      0.12
    );
  }

  applyAmbientProfile();

  if (value <= 0.01 && humOsc) {
    humOsc.stop();
    humOsc = null;
    humGain = null;
  }
};

// -- Key pickup: short crystalline chime --
export const playKeyPickup = () => {
  const c = ensure();
  const osc = c.createOscillator();
  const osc2 = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(1200, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(1800, c.currentTime + 0.12);
  osc2.type = "triangle";
  osc2.frequency.setValueAtTime(2400, c.currentTime);
  osc2.frequency.exponentialRampToValueAtTime(3200, c.currentTime + 0.1);
  gain.gain.setValueAtTime(0.12, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.22);
  osc.connect(gain);
  osc2.connect(gain);
  gain.connect(masterGain);
  osc.start(c.currentTime);
  osc.stop(c.currentTime + 0.22);
  osc2.start(c.currentTime);
  osc2.stop(c.currentTime + 0.22);
};

// -- Holodeck activate: rising power-up whoosh --
export const playHolodeckActivate = () => {
  const c = ensure();
  const dur = 0.6;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(80, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(600, c.currentTime + dur);
  gain.gain.setValueAtTime(0.06, c.currentTime);
  gain.gain.linearRampToValueAtTime(0.14, c.currentTime + dur * 0.7);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
  osc.connect(gain).connect(masterGain);
  osc.start(c.currentTime);
  osc.stop(c.currentTime + dur);

  const osc2 = c.createOscillator();
  const g2 = c.createGain();
  osc2.type = "sine";
  osc2.frequency.setValueAtTime(1400, c.currentTime);
  osc2.frequency.linearRampToValueAtTime(2200, c.currentTime + dur);
  g2.gain.setValueAtTime(0.04, c.currentTime);
  g2.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
  osc2.connect(g2).connect(masterGain);
  osc2.start(c.currentTime);
  osc2.stop(c.currentTime + dur);
};

// -- Holodeck deactivate: descending power-down --
export const playHolodeckDeactivate = () => {
  const c = ensure();
  const dur = 0.4;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(400, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(50, c.currentTime + dur);
  gain.gain.setValueAtTime(0.1, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
  osc.connect(gain).connect(masterGain);
  osc.start(c.currentTime);
  osc.stop(c.currentTime + dur);
};

// -- Jump: short ascending burst --
export const playJump = () => {
  const c = ensure();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(150, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(450, c.currentTime + 0.12);
  gain.gain.setValueAtTime(0.12, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.18);
  osc.connect(gain).connect(masterGain);
  osc.start(c.currentTime);
  osc.stop(c.currentTime + 0.18);
};

// -- Land: short thud --
export const playLand = () => {
  const c = ensure();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(100, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(40, c.currentTime + 0.1);
  gain.gain.setValueAtTime(0.15, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.15);
  osc.connect(gain).connect(masterGain);
  osc.start(c.currentTime);
  osc.stop(c.currentTime + 0.15);
};

// -- Secret: celebratory crystalline arpeggio --
export const playSecretFound = () => {
  const c = ensure();
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, i) => {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, c.currentTime + i * 0.1);
    g.gain.setValueAtTime(0, c.currentTime + i * 0.1);
    g.gain.linearRampToValueAtTime(0.1, c.currentTime + i * 0.1 + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + i * 0.1 + 0.4);
    osc.connect(g).connect(masterGain);
    osc.start(c.currentTime + i * 0.1);
    osc.stop(c.currentTime + i * 0.1 + 0.4);
  });
};

// -- Ambient loop from file --
let ambientSource = null;
let ambientGain = null;
let cachedAmbientBuffer = null;

export const startAmbient = async (url) => {
  if (ambientSource) {
    applyAmbientProfile();
    return;
  }
  const c = ensure();
  try {
    if (!cachedAmbientBuffer) {
      const res = await fetch(url);
      const arrayBuf = await res.arrayBuffer();
      cachedAmbientBuffer = await c.decodeAudioData(arrayBuf);
    }

    ambientSource = c.createBufferSource();
    ambientGain = c.createGain();
    ambientSource.buffer = cachedAmbientBuffer;
    ambientSource.loop = true;
    ambientGain.gain.value = ambientTargetGain();
    ambientSource.connect(ambientGain).connect(masterGain);
    ambientSource.start();
  } catch (e) {
    console.warn("Ambient audio failed to load:", e);
  }
};
