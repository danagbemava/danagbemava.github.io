// Playwright smoke test for /world. Usage: npm run build && npm run test:world
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const PORT = 4399;
const BASE = `http://localhost:${PORT}`;

const startPreview = () =>
  new Promise((resolve, reject) => {
    const proc = spawn("npx", ["astro", "preview", "--port", String(PORT)], { stdio: "pipe" });
    const timer = setTimeout(() => reject(new Error("preview server timed out")), 20000);
    const poll = async () => {
      try {
        const res = await fetch(`${BASE}/world/`);
        if (res.ok) { clearTimeout(timer); resolve(proc); return; }
      } catch { /* not up yet */ }
      setTimeout(poll, 400);
    };
    poll();
  });

const fail = (msg) => { console.error(`FAIL: ${msg}`); process.exitCode = 1; };

const preview = await startPreview();
const browser = await chromium.launch({ args: ["--use-gl=angle", "--enable-unsafe-swiftshader"] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(`console: ${msg.text()}`); });

  let sceneReady = false;
  await page.exposeFunction("__sceneReadyHook", () => { sceneReady = true; });
  await page.addInitScript(() => {
    window.addEventListener("scene-ready", () => window.__sceneReadyHook());
  });

  await page.goto(`${BASE}/world/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(6000);

  if (!sceneReady) fail("scene-ready event never fired");
  const loadingHidden = await page.$eval("#world-loading", (el) => el.classList.contains("is-hidden"));
  if (!loadingHidden) fail("loading overlay never dismissed");
  const zoneLabel = await page.$eval("#world-zone-label", (el) => el.textContent);
  if (!zoneLabel || !zoneLabel.trim()) fail("zone label empty");

  // Movement sanity: WASD for a second must not throw.
  await page.keyboard.down("w");
  await page.waitForTimeout(1000);
  await page.keyboard.up("w");
  await page.waitForTimeout(500);

  // ── Warp via starmap to each planet and back ──
  for (const dest of ["projects", "posts", "experiences", "home"]) {
    await page.click("#world-starmap-btn");
    await page.click(`.world-starmap-dest[data-dest="${dest}"]`);
    await page.waitForTimeout(3500); // warp completes in ~2.2s
    const hash = await page.evaluate(() => window.location.hash);
    if (hash !== `#/${dest}`) fail(`expected hash #/${dest}, got ${hash}`);
    const label = await page.$eval("#world-zone-label", (el) => el.textContent);
    const expected = { home: "NEXUS STATION", projects: "FORGE", posts: "SIGNAL", experiences: "GROVE" }[dest];
    if (!label.includes(expected)) fail(`expected zone label ${expected}, got ${label}`);
    await page.screenshot({ path: `/tmp/world-smoke-${dest}.png` });
  }

  if (errors.length) fail(`runtime errors:\n${errors.join("\n")}`);
  await page.screenshot({ path: "/tmp/world-smoke-hub.png" });
  console.log(process.exitCode ? "SMOKE FAILED" : "SMOKE PASSED");
} finally {
  await browser.close();
  preview.kill();
}
