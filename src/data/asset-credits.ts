export interface AssetCredit {
  name: string;
  usage: string;
  creator: string;
  source: string;
  sourceUrl: string;
  license: string;
  licenseUrl: string;
  notes?: string;
}

export const ASSET_CREDITS: AssetCredit[] = [
  {
    name: "Soldier character model",
    usage: "Player avatar in open world",
    creator: "Mixamo / Adobe",
    source: "Mixamo",
    sourceUrl: "https://www.mixamo.com/",
    license: "Mixamo Terms of Use",
    licenseUrl: "https://www.adobe.com/legal/terms.html",
    notes: "Used as the primary player character animation rig."
  },
  {
    name: "Robot character model",
    usage: "Fallback player avatar",
    creator: "Khronos Group sample",
    source: "glTF Sample Models",
    sourceUrl: "https://github.com/KhronosGroup/glTF-Sample-Models/tree/main/2.0/RobotExpressive",
    license: "CC-BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    notes: "Loaded when soldier model fails to resolve."
  },
  {
    name: "Ambient drone audio",
    usage: "World ambient bed",
    creator: "Project-local audio asset",
    source: "Local project file",
    sourceUrl: "/models/ambient-drone.wav",
    license: "Project-owned",
    licenseUrl: "/credits/",
    notes: "Bundled locally in public/models."
  },
  {
    name: "Kenney Space Kit models",
    usage: "Projects and Posts district structures (forge_tower, assembly_arm, generator_rack, archive_kiosk, signal_arch, datapole_cluster)",
    creator: "Kenney",
    source: "kenney.nl",
    sourceUrl: "https://kenney.nl/assets/space-kit",
    license: "CC0",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    notes: "150 low-poly space structures. Downloaded via scripts/download-world-assets.mjs."
  },
  {
    name: "Kenney Space Station Kit models",
    usage: "Experiences and Home district structures (memory_obelisk, skill_garden, timeline_bridge, command_nexus)",
    creator: "Kenney",
    source: "kenney.nl",
    sourceUrl: "https://kenney.nl/assets/space-station-kit",
    license: "CC0",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    notes: "90 space station modules and ship parts. Downloaded via scripts/download-world-assets.mjs."
  }
];
