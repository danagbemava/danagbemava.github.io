#!/usr/bin/env node
/**
 * download-world-assets.mjs
 *
 * Downloads CC0-licensed GLB models from free asset packs and places them
 * into the correct public/models/world/ directories for the open world.
 *
 * Usage:
 *   node scripts/download-world-assets.mjs             # download all packs
 *   node scripts/download-world-assets.mjs --dry-run   # preview without downloading
 *   node scripts/download-world-assets.mjs --force     # re-download even if files exist
 *   node scripts/download-world-assets.mjs --pack kenney-space-kit  # specific pack only
 *
 * All downloaded assets are CC0 / public domain. See src/data/asset-credits.ts.
 */

import { existsSync, createWriteStream } from "node:fs";
import { mkdir, readdir, copyFile, rm, rename, stat } from "node:fs/promises";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createReadStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import https from "node:https";
import http from "node:http";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const modelsDir = path.join(root, "public", "models", "world");
const tmpDir = path.join(root, ".asset-cache");

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const FORCE = args.includes("--force");
const packFilter = args.find((a) => a.startsWith("--pack="))?.split("=")[1]
  || (args.includes("--pack") ? args[args.indexOf("--pack") + 1] : null);

const log = (msg) => console.log(`  ${msg}`);
const info = (msg) => console.log(`\x1b[36m→\x1b[0m ${msg}`);
const warn = (msg) => console.log(`\x1b[33m⚠\x1b[0m ${msg}`);
const success = (msg) => console.log(`\x1b[32m✓\x1b[0m ${msg}`);
const error = (msg) => console.error(`\x1b[31m✗\x1b[0m ${msg}`);

// ── Asset Pack Definitions ─────────────────────────────────────────
// Each pack defines where to download from, which files to extract,
// and where to place them in the world directory structure.

const PACKS = [
  {
    id: "kenney-space-kit",
    name: "Kenney Space Kit",
    description: "150 low-poly space structures, ships, turrets (CC0)",
    downloadUrl: "https://kenney.nl/media/pages/assets/space-kit/cceeafbd0c-1677698978/kenney_space-kit.zip",
    zipFileName: "kenney_space-kit.zip",
    creator: "Kenney",
    license: "CC0",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    sourceUrl: "https://kenney.nl/assets/space-kit",
    // After unzipping, GLB files live under a subfolder. We search recursively.
    glbSearchPattern: "**/*.glb",
    mappings: [
      // Projects district: industrial / fabrication structures
      {
        search: ["hangar", "large_hangar", "building", "machine"],
        fallbackIndex: 0,
        target: "projects/forge_tower.glb"
      },
      {
        search: ["crane", "turret_double", "turret_base", "support"],
        fallbackIndex: 3,
        target: "projects/assembly_arm.glb"
      },
      {
        search: ["barrel", "platform", "desk", "monorail_straight"],
        fallbackIndex: 5,
        target: "projects/generator_rack.glb"
      },
      // Posts district: communication / broadcast structures
      {
        search: ["satellite_dish", "radar", "antenna"],
        fallbackIndex: 8,
        target: "posts/archive_kiosk.glb"
      },
      {
        search: ["gate", "corridor", "rocket_baseA"],
        fallbackIndex: 10,
        target: "posts/signal_arch.glb"
      },
      {
        search: ["bones", "meteor", "rock"],
        fallbackIndex: 12,
        target: "posts/datapole_cluster.glb"
      }
    ]
  },
  {
    id: "kenney-space-station-kit",
    name: "Kenney Space Station Kit",
    description: "90 space station modules and ship parts (CC0)",
    downloadUrl: "https://kenney.nl/media/pages/assets/space-station-kit/3fd76112b3-1712749919/kenney_space-station-kit.zip",
    zipFileName: "kenney_space-station-kit.zip",
    creator: "Kenney",
    license: "CC0",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    sourceUrl: "https://kenney.nl/assets/space-station-kit",
    glbSearchPattern: "**/*.glb",
    mappings: [
      // Experiences district: modular / memory structures
      {
        search: ["corridor_straight", "room", "module"],
        fallbackIndex: 0,
        target: "experiences/memory_obelisk.glb"
      },
      {
        search: ["window", "airlock", "hallway"],
        fallbackIndex: 2,
        target: "experiences/skill_garden.glb"
      },
      {
        search: ["bridge", "connector", "junction"],
        fallbackIndex: 4,
        target: "experiences/timeline_bridge.glb"
      },
      // Home district
      {
        search: ["station", "hub", "dome"],
        fallbackIndex: 6,
        target: "home/command_nexus.glb"
      }
    ]
  }
];

// ── Download Utility ───────────────────────────────────────────────

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    protocol.get(url, { headers: { "User-Agent": "willows-bell-asset-downloader/1.0" } }, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        res.resume();
        return;
      }
      resolve(res);
    }).on("error", reject);
  });
}

async function downloadFile(url, destPath) {
  const stream = await fetchUrl(url);
  await pipeline(stream, createWriteStream(destPath));
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function fetchText(url) {
  const stream = await fetchUrl(url);
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function resolveDownloadUrl(pack) {
  if (!pack.sourceUrl || !pack.zipFileName) {
    return pack.downloadUrl;
  }

  try {
    const html = await fetchText(pack.sourceUrl);
    const zipRegex = new RegExp(
      `https://kenney\\.nl/media/pages/assets/[^"'\\s]+/${escapeRegex(pack.zipFileName)}`,
      "i"
    );
    const match = html.match(zipRegex);
    if (match?.[0]) {
      return match[0];
    }
  } catch (e) {
    warn(`Could not resolve dynamic URL from ${pack.sourceUrl}: ${e.message}`);
  }

  return pack.downloadUrl;
}

// ── ZIP Extraction (uses system `unzip`) ───────────────────────────

async function extractZip(zipPath, destDir) {
  await mkdir(destDir, { recursive: true });
  try {
    execSync(`unzip -o -q "${zipPath}" -d "${destDir}"`, { stdio: "pipe" });
    return true;
  } catch (e) {
    // Try with python3 zipfile as fallback
    try {
      execSync(
        `python3 -c "import zipfile; zipfile.ZipFile('${zipPath}').extractall('${destDir}')"`,
        { stdio: "pipe" }
      );
      return true;
    } catch {
      error(`Failed to extract ${zipPath}: ${e.message}`);
      return false;
    }
  }
}

// ── GLB File Discovery ─────────────────────────────────────────────

async function findGlbFiles(dir) {
  const results = [];
  async function walk(current) {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.name.toLowerCase().endsWith(".glb")) {
        results.push({ name: entry.name.toLowerCase().replace(".glb", ""), fullPath });
      }
    }
  }
  await walk(dir);
  return results;
}

// ── Mapping Logic ──────────────────────────────────────────────────

function findBestMatch(glbFiles, searchTerms, fallbackIndex) {
  // Try exact substring match first
  for (const term of searchTerms) {
    const match = glbFiles.find((f) => f.name.includes(term.toLowerCase()));
    if (match) return match;
  }
  // Fallback to index if no match found
  if (fallbackIndex < glbFiles.length) {
    return glbFiles[fallbackIndex];
  }
  // Last resort: return first available
  return glbFiles.length > 0 ? glbFiles[0] : null;
}

// ── Main ───────────────────────────────────────────────────────────

async function processPack(pack) {
  info(`Processing: ${pack.name}`);
  log(pack.description);

  const zipName = `${pack.id}.zip`;
  const zipPath = path.join(tmpDir, zipName);
  const extractDir = path.join(tmpDir, pack.id);

  // Download ZIP
  if (!existsSync(zipPath) || FORCE) {
    if (DRY_RUN) {
      log(`[dry-run] Would download ZIP for: ${pack.sourceUrl}`);
      log(`[dry-run] Would extract to: ${extractDir}`);
      for (const mapping of pack.mappings) {
        const targetPath = path.join(modelsDir, mapping.target);
        log(`[dry-run] Would place: ${mapping.target} (search: ${mapping.search.join(", ")})`);
      }
      return;
    }

    const resolvedDownloadUrl = await resolveDownloadUrl(pack);
    if (!resolvedDownloadUrl) {
      error(`No download URL found for ${pack.name}`);
      warn(`You can manually download from: ${pack.sourceUrl}`);
      warn(`Place the ZIP at: ${zipPath}`);
      return;
    }

    info(`Downloading ${resolvedDownloadUrl}...`);
    await mkdir(tmpDir, { recursive: true });
    try {
      await downloadFile(resolvedDownloadUrl, zipPath);
      const stats = await stat(zipPath);
      success(`Downloaded ${(stats.size / 1024 / 1024).toFixed(1)} MB`);
    } catch (e) {
      error(`Download failed: ${e.message}`);
      warn(`You can manually download from: ${pack.sourceUrl}`);
      warn(`Place the ZIP at: ${zipPath}`);
      return;
    }
  } else {
    log(`Using cached: ${zipPath}`);
  }

  // Extract
  if (!existsSync(extractDir) || FORCE) {
    info("Extracting ZIP...");
    const extracted = await extractZip(zipPath, extractDir);
    if (!extracted) return;
    success("Extracted successfully");
  }

  // Find GLB files
  const glbFiles = await findGlbFiles(extractDir);
  log(`Found ${glbFiles.length} GLB files in pack`);

  if (glbFiles.length === 0) {
    warn("No GLB files found. The pack may use a different format (FBX/OBJ).");
    warn("You may need to convert models to GLB using Blender or gltf-pipeline.");
    return;
  }

  // Sort for consistent fallback ordering
  glbFiles.sort((a, b) => a.name.localeCompare(b.name));

  // Track used files to avoid duplicates
  const usedFiles = new Set();

  // Process mappings
  for (const mapping of pack.mappings) {
    const targetPath = path.join(modelsDir, mapping.target);
    const targetDir = path.dirname(targetPath);

    // Skip if already exists (unless --force)
    if (existsSync(targetPath) && !FORCE) {
      log(`Skipping (exists): ${mapping.target}`);
      continue;
    }

    // Find best matching GLB
    const available = glbFiles.filter((f) => !usedFiles.has(f.fullPath));
    const match = findBestMatch(available, mapping.search, mapping.fallbackIndex);

    if (!match) {
      warn(`No model found for: ${mapping.target}`);
      continue;
    }

    usedFiles.add(match.fullPath);
    await mkdir(targetDir, { recursive: true });
    await copyFile(match.fullPath, targetPath);
    success(`${match.name}.glb → ${mapping.target}`);
  }
}

async function main() {
  console.log("\n🌐 Willows Bell — World Asset Downloader\n");

  if (DRY_RUN) {
    warn("DRY RUN MODE — no files will be downloaded or placed\n");
  }

  // Ensure model directories exist
  for (const district of ["home", "projects", "posts", "experiences"]) {
    await mkdir(path.join(modelsDir, district), { recursive: true });
  }

  const packsToProcess = packFilter
    ? PACKS.filter((p) => p.id === packFilter || p.name.toLowerCase().includes(packFilter.toLowerCase()))
    : PACKS;

  if (packsToProcess.length === 0) {
    error(`No pack found matching: ${packFilter}`);
    log("Available packs:");
    PACKS.forEach((p) => log(`  ${p.id} — ${p.name}`));
    process.exit(1);
  }

  for (const pack of packsToProcess) {
    await processPack(pack);
    console.log();
  }

  // Summary
  console.log("─".repeat(50));
  let placed = 0;
  let missing = 0;
  for (const district of ["home", "projects", "posts", "experiences"]) {
    const dir = path.join(modelsDir, district);
    try {
      const files = (await readdir(dir)).filter((f) => f.endsWith(".glb"));
      placed += files.length;
      if (files.length > 0) {
        success(`${district}/: ${files.join(", ")}`);
      } else {
        warn(`${district}/: (empty)`);
        missing += 1;
      }
    } catch {
      warn(`${district}/: (not found)`);
      missing += 1;
    }
  }

  console.log();
  if (placed > 0) {
    success(`${placed} model(s) placed. Run \`npm run dev\` to see them in the world.`);
  }
  if (missing > 0) {
    warn(`${missing} district(s) still empty.`);
    log("You can manually add GLB files to public/models/world/{district}/");
    log("See public/models/world/README.md for the expected filenames.");
  }

  if (!DRY_RUN) {
    log("\nRemember to update src/data/asset-credits.ts with the packs you used.");
  }
}

main().catch((e) => {
  error(e.message);
  process.exit(1);
});
