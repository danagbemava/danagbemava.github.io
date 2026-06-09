// Playwright smoke test for the experiment pages.
// Usage: npm run build && npm run test:experiments
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const PORT = 4398;
const BASE = `http://localhost:${PORT}`;

const startPreview = () =>
  new Promise((resolve, reject) => {
    const proc = spawn("npx", ["astro", "preview", "--port", String(PORT)], { stdio: "pipe" });
    const timer = setTimeout(() => reject(new Error("preview server timed out")), 20000);
    const poll = async () => {
      try {
        const res = await fetch(`${BASE}/experiments/fibonacci-sphere.html`);
        if (res.ok) { clearTimeout(timer); resolve(proc); return; }
      } catch { /* not up yet */ }
      setTimeout(poll, 400);
    };
    poll();
  });

const fail = (msg) => { console.error(`FAIL: ${msg}`); process.exitCode = 1; };

// Pre-rewrite pages pull Tailwind/Babel CDNs that log non-fatal noise.
const NOISE = /tailwind|babel|cdn\.tailwindcss/i;

const preview = await startPreview();
const browser = await chromium.launch({ args: ["--use-gl=angle", "--enable-unsafe-swiftshader"] });
try {
  for (const name of ["fibonacci-sphere", "celestial-hand-control"]) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
    page.on("console", (msg) => {
      if (msg.type() === "error" && !NOISE.test(msg.text())) errors.push(`console: ${msg.text()}`);
    });

    await page.goto(`${BASE}/experiments/${name}.html`, { waitUntil: "networkidle" });
    await page.waitForTimeout(6000);

    const hasCanvas = await page.evaluate(() => Boolean(document.querySelector("canvas")));
    if (!hasCanvas) fail(`${name}: no canvas rendered`);

    // Modernized hand-control page: clicking Enable Camera with permission
    // denied must recover to the idle button state (no hung "Loading AI").
    const isModern = await page.evaluate(() => document.body.dataset.modern === "1");
    if (name === "celestial-hand-control" && isModern) {
      await page.click("#cam-btn");
      await page.waitForTimeout(4000);
      const btnText = await page.$eval("#cam-btn", (el) => el.textContent || "");
      if (!/enable camera/i.test(btnText)) fail(`${name}: camera-denied path did not reset button (got "${btnText.trim()}")`);
    }

    if (errors.length) fail(`${name}: runtime errors:\n${errors.join("\n")}`);
    await page.screenshot({ path: `/tmp/exp-${name}.png` });
    console.log(`${name}: ok`);
    await context.close();
  }
  console.log(process.exitCode ? "EXPERIMENTS SMOKE FAILED" : "EXPERIMENTS SMOKE PASSED");
} finally {
  await browser.close();
  preview.kill();
}
