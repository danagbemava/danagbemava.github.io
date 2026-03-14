import { getWorldSnapshot, markInteraction, nudgeEnergy } from "./world-state.js";
import { playBeep, playWorldEventPulse } from "./sfx.js";

const eventPools = {
  home: [
    { type: "transmission", text: "Background transmission received from the Orbit Relay.", energy: 0.01 },
    { type: "drone_pass", text: "Service drone crossed the atrium above your position.", energy: 0.005 },
    { type: "calibration", text: "Core rings recalibrated to current movement profile.", energy: 0.004 }
  ],
  projects: [
    { type: "forge_sync", text: "Fabrication lane synchronization pulse completed.", energy: 0.006 },
    { type: "archive_ping", text: "New build index ping detected in the forge.", energy: 0.007 },
    { type: "anomaly", text: "A short-lived power anomaly flickered in the industrial zone.", energy: 0.01 }
  ],
  posts: [
    { type: "signal_cycle", text: "A distant signal arch shifted its broadcast phase.", energy: 0.006 },
    { type: "echo", text: "Archive echo registered in the marketplace.", energy: 0.005 },
    { type: "marker_refresh", text: "Market stall data refreshed with recent entries.", energy: 0.004 }
  ],
  experiences: [
    { type: "memory_flash", text: "A role statue emitted a brief memory flash.", energy: 0.006 },
    { type: "gallery_update", text: "Gallery annotation cache has been updated.", energy: 0.005 },
    { type: "vault_hum", text: "Data shard vault resonance briefly increased.", energy: 0.008 }
  ]
};

const pick = (list, seed) => list[seed % list.length];

export const startWorldEvents = ({
  zone = "home",
  onEvent,
  minDelayMs = 18000,
  maxDelayMs = 32000,
  sound = true
} = {}) => {
  let active = true;
  let timer = null;

  const loop = () => {
    if (!active) {
      return;
    }

    const delay = minDelayMs + Math.random() * (maxDelayMs - minDelayMs);
    timer = window.setTimeout(() => {
      if (!active) {
        return;
      }

      const snapshot = getWorldSnapshot(zone);
      const zoneEvents = eventPools[zone] || eventPools.home;
      const seed = Math.floor(Math.random() * 100000) + snapshot.totalVisits + snapshot.secretsFound;
      const event = pick(zoneEvents, seed);

      nudgeEnergy(event.energy);
      markInteraction(0.5);

      if (sound) {
        if (Math.random() < 0.55) {
          playBeep();
        } else {
          playWorldEventPulse(zone, snapshot.energyLevel);
        }
      }

      if (typeof onEvent === "function") {
        onEvent({ ...event, snapshot: getWorldSnapshot(zone) });
      }

      loop();
    }, delay);
  };

  loop();

  return () => {
    active = false;
    if (timer) {
      window.clearTimeout(timer);
      timer = null;
    }
  };
};
