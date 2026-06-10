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

      // Formations must be reachable without a camera: click + hotkey.
      await page.click('[data-formation="galaxy"]');
      await page.waitForTimeout(600);
      let chip = await page.$eval("#formation-name", (el) => el.textContent || "");
      if (!/galaxy/i.test(chip)) fail(`${name}: formation click did not update chip (got "${chip}")`);
      await page.keyboard.press("7");
      await page.waitForTimeout(600);
      chip = await page.$eval("#formation-name", (el) => el.textContent || "");
      if (!/black hole/i.test(chip)) fail(`${name}: hotkey 7 did not trigger black hole (got "${chip}")`);
    }

    if (name === "fibonacci-sphere") {
      // Demo mode must engage with one click and a preset must apply.
      await page.click("#demo-btn");
      await page.waitForTimeout(1500);
      const demoOn = await page.$eval("#demo-btn", (el) => el.classList.contains("is-on"));
      if (!demoOn) fail(`${name}: demo button did not engage`);
      await page.click('[data-preset="lattice"]');
      await page.waitForTimeout(800);
      const plexusOn = await page.$eval("#plexus-btn", (el) => el.classList.contains("is-on"));
      if (!plexusOn) fail(`${name}: lattice preset did not apply (plexus off)`);
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
