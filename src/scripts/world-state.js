const STORAGE_KEY = "wb.world.state.v1";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const defaultState = () => ({
  version: 1,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  lastVisitAt: 0,
  lastVisitedZone: "home",
  visits: {
    home: 0,
    projects: 0,
    posts: 0,
    experiences: 0
  },
  discoveredSecrets: {
    sky_shard: false,
    data_shard: false,
    timeline_echo: false
  },
  secretsFound: 0,
  energyLevel: 0.62,
  interactions: 0
});

let cache = null;
let saveTimer = null;

const safeNow = () => Date.now();

const loadState = () => {
  if (cache) {
    return cache;
  }

  const fresh = defaultState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      cache = fresh;
      return cache;
    }

    const parsed = JSON.parse(raw);
    cache = {
      ...fresh,
      ...parsed,
      visits: { ...fresh.visits, ...(parsed.visits || {}) },
      discoveredSecrets: { ...fresh.discoveredSecrets, ...(parsed.discoveredSecrets || {}) }
    };
  } catch {
    cache = fresh;
  }

  return cache;
};

const saveNow = () => {
  if (!cache) {
    return;
  }

  cache.updatedAt = safeNow();
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore storage failures (private mode, full quota, etc.).
  }
};

const scheduleSave = () => {
  if (saveTimer) {
    return;
  }
  saveTimer = window.setTimeout(() => {
    saveTimer = null;
    saveNow();
  }, 650);
};

const getDayPhase = (date = new Date()) => {
  const hour = date.getHours();
  if (hour < 6) return "night";
  if (hour < 11) return "dawn";
  if (hour < 17) return "day";
  if (hour < 21) return "dusk";
  return "night";
};

const getDayKey = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const getWeekKey = (date = new Date()) => {
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((utcDate - yearStart) / 86400000) + 1) / 7);
  return `${utcDate.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
};

const hashString = (input) => {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) - hash + input.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
};

const featuredByZone = {
  home: ["Orrery Core", "Nebula Relay", "Gravity Well", "Transit Veil"],
  projects: ["Forge Core", "Crucible Arm", "Reactor Node", "Smelting Crown"],
  posts: ["Crystal Array", "Relay Spire", "Data Prism", "Signal Bloom"],
  experiences: ["Bloom Heart", "Memory Root", "Spore Vault", "Living Archive"]
};

const bulletins = {
  dawn: [
    "Nebula dawn detected. Stellar forge warming its crucibles.",
    "Morning drift stabilizing. New signal crystals forming.",
    "The grove stirs. Bioluminescent roots are brightening."
  ],
  day: [
    "Peak nebula cycle. Energy tethers at full luminosity.",
    "Orrery aligned. All districts resonating clearly.",
    "The drift is active. Follow the tethers to discover more."
  ],
  dusk: [
    "Nebula dusk descending. Forge embers glow brighter in the dark.",
    "Signal array shifting to deep-scan mode. Hidden shards surface.",
    "The grove settles. Memory spores drift gently between branches."
  ],
  night: [
    "Deep nebula night. The asteroids glow with quiet veins of light.",
    "Night drift online. Rare crystalline formations may appear.",
    "The orrery hums softly. Distant galaxies pulse at the edge of sight."
  ]
};

const zoneLabels = {
  home: "Nexus Core",
  projects: "Stellar Forge",
  posts: "Signal Array",
  experiences: "Memory Grove"
};

const getFeaturedNode = (zone, date = new Date()) => {
  const zoneKey = featuredByZone[zone] ? zone : "home";
  const list = featuredByZone[zoneKey];
  const index = hashString(`${zoneKey}-${getDayKey(date)}`) % list.length;
  return list[index];
};

const getBulletin = (zone, date = new Date()) => {
  const phase = getDayPhase(date);
  const list = bulletins[phase];
  const index = hashString(`${zone}-${getWeekKey(date)}-${phase}`) % list.length;
  return list[index];
};

const getSecondsSince = (timestamp) => {
  if (!timestamp) return null;
  return Math.max(0, Math.floor((safeNow() - timestamp) / 1000));
};

const formatLastVisit = (timestamp) => {
  const seconds = getSecondsSince(timestamp);
  if (seconds === null) {
    return "first session";
  }
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m ago`;
  }
  if (seconds < 86400) {
    return `${Math.floor(seconds / 3600)}h ago`;
  }
  return `${Math.floor(seconds / 86400)}d ago`;
};

export const getWorldState = () => loadState();

export const getWorldSnapshot = (zone = "home") => {
  const state = loadState();
  const now = new Date();
  const dayPhase = getDayPhase(now);

  return {
    state,
    zone,
    zoneLabel: zoneLabels[zone] || zone,
    dayPhase,
    dayKey: getDayKey(now),
    featuredNode: getFeaturedNode(zone, now),
    bulletin: getBulletin(zone, now),
    lastVisitedLabel: zoneLabels[state.lastVisitedZone] || state.lastVisitedZone,
    lastVisitAgo: formatLastVisit(state.lastVisitAt),
    energyLevel: state.energyLevel,
    secretsFound: state.secretsFound,
    totalVisits: Object.values(state.visits).reduce((acc, count) => acc + count, 0)
  };
};

export const registerVisit = (zone = "home") => {
  const state = loadState();
  state.visits[zone] = (state.visits[zone] || 0) + 1;
  state.lastVisitedZone = zone;
  state.lastVisitAt = safeNow();
  state.energyLevel = clamp(state.energyLevel + 0.02, 0.2, 1);
  scheduleSave();
  return getWorldSnapshot(zone);
};

export const markInteraction = (weight = 1) => {
  const state = loadState();
  state.interactions += weight;
  state.energyLevel = clamp(state.energyLevel + weight * 0.003, 0.2, 1);
  scheduleSave();
};

export const nudgeEnergy = (delta) => {
  const state = loadState();
  const before = state.energyLevel;
  state.energyLevel = clamp(state.energyLevel + delta, 0.2, 1);
  if (Math.abs(before - state.energyLevel) > 0.0001) {
    scheduleSave();
  }
  return state.energyLevel;
};

export const markSecretFound = (secretKey) => {
  const state = loadState();
  if (!secretKey || state.discoveredSecrets[secretKey]) {
    return false;
  }
  state.discoveredSecrets[secretKey] = true;
  state.secretsFound += 1;
  state.energyLevel = clamp(state.energyLevel + 0.08, 0.2, 1);
  scheduleSave();
  return true;
};

export const zoneLabel = (zone) => zoneLabels[zone] || zone;

window.addEventListener("beforeunload", () => {
  if (saveTimer) {
    window.clearTimeout(saveTimer);
    saveTimer = null;
  }
  saveNow();
});
