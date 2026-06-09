import { destinations } from "./open-world-config.js";
import { buildHub } from "./open-world-hub.js";
import { buildPlanet } from "./open-world-planet.js";
import { createSpaceBackdrop } from "./open-world-sky.js";

// Owns the active scene pack + backdrop. swap() tears down the old pair,
// builds the new one, and applies the destination's sky/fog/light profile.
export const createSceneManager = ({ scene, content, lowPower, lights }) => {
  let pack = null;
  let backdrop = null;
  let key = null;

  const applyProfile = (dest) => {
    scene.background.set(dest.sky.bottom);
    scene.fog.color.set(dest.fog.color);
    scene.fog.density = dest.fog.density;
    lights.ambient.intensity = dest.lights.ambient * (lowPower ? 0.9 : 1.05);
    lights.rim.intensity = dest.lights.rim;
  };

  const swap = (nextKey, onAssetLoaded) => {
    const dest = destinations[nextKey] || destinations.home;
    if (pack) { pack.dispose(); pack = null; }
    if (backdrop) { backdrop.dispose(); backdrop = null; }
    backdrop = createSpaceBackdrop(dest.key, lowPower);
    scene.add(backdrop.group);
    pack = dest.key === "home"
      ? buildHub(scene, content, lowPower, onAssetLoaded)
      : buildPlanet(dest.key, scene, content, lowPower, onAssetLoaded);
    applyProfile(dest);
    key = dest.key;
    return pack;
  };

  const update = (dt, t) => {
    if (backdrop) backdrop.update(dt, t);
    if (pack) pack.update(dt, t);
  };

  return {
    swap,
    update,
    get pack() { return pack; },
    get key() { return key; },
    get destination() { return destinations[key] || destinations.home; }
  };
};
