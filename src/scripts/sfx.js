// Sci-fi / cyberpunk sound effects via Web Audio API

let ctx = null;
let masterGain = null;
let muted = false;

const ensure = () => {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.35;
    masterGain.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
};

export const toggleMute = () => {
  muted = !muted;
  if (masterGain) masterGain.gain.value = muted ? 0 : 0.35;
  return muted;
};

export const isMuted = () => muted;

// ── Footstep: short metallic tick, synced by stride distance ──
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

// ── Door open: servo whir ──
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

// ── Door close: reverse servo whir + thud ──
export const playDoorClose = () => {
  const c = ensure();
  // Descending servo
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

  // Thud impact at the end
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

// ── Portal whoosh: sweeping noise + descending tone ──
export const playPortalEnter = () => {
  const c = ensure();
  const dur = 0.85;

  // Noise sweep
  const bufSize = c.sampleRate * dur;
  const buf = c.createBuffer(1, bufSize, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1);
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

  // Descending synth tone
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

// ── UI beep: short confirm ──
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

// ── Proximity hum: continuous drone near doors ──
let humOsc = null;
let humGain = null;
export const updateProximityHum = (intensity) => {
  if (muted || !ctx) return;
  if (intensity > 0.01 && !humOsc) {
    const c = ensure();
    humOsc = c.createOscillator();
    humGain = c.createGain();
    humOsc.type = "sine";
    humOsc.frequency.value = 95;
    humGain.gain.value = 0;
    humOsc.connect(humGain).connect(masterGain);
    humOsc.start();
  }
  if (humGain) {
    humGain.gain.value = Math.min(intensity * 0.08, 0.08);
  }
  if (intensity <= 0.01 && humOsc) {
    humOsc.stop();
    humOsc = null;
    humGain = null;
  }
};

// ── Key pickup: short crystalline chime ──
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

// ── Holodeck activate: rising power-up whoosh ──
export const playHolodeckActivate = () => {
  const c = ensure();
  const dur = 0.6;
  // Rising tone
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
  // Shimmer
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

// ── Holodeck deactivate: descending power-down ──
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

// ── Ambient loop from file ──
let ambientSource = null;
let ambientGain = null;
export const startAmbient = async (url) => {
  if (ambientSource) return;
  const c = ensure();
  try {
    const res = await fetch(url);
    const arrayBuf = await res.arrayBuffer();
    const audioBuf = await c.decodeAudioData(arrayBuf);
    ambientSource = c.createBufferSource();
    ambientGain = c.createGain();
    ambientSource.buffer = audioBuf;
    ambientSource.loop = true;
    ambientGain.gain.value = 0.06;
    ambientSource.connect(ambientGain).connect(masterGain);
    ambientSource.start();
  } catch (e) {
    console.warn("Ambient audio failed to load:", e);
  }
};
