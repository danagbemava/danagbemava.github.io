// Playwright smoke for the in-world post journey.
// Usage: npm run build && npm run test:journey
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const PORT = 4401;
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

  await page.goto(`${BASE}/world/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(6000);

  // ── Task 1: sectionizer returns sections matching the article's structure ──
  const slug = await page.evaluate(() => window.__wbTest && window.__wbTest.postSlug(0));
  if (!slug) fail("no post slug exposed via __wbTest");

  const expectedCount = await page.evaluate(async (s) => {
    const res = await fetch(`/posts/${s}/`);
    const doc = new DOMParser().parseFromString(await res.text(), "text/html");
    const body = doc.querySelector(".post-content");
    const h2 = body ? body.querySelectorAll(":scope > h2").length : 0;
    // intro present if any element/text precedes the first h2
    let introHasContent = false;
    if (body) {
      for (const node of Array.from(body.childNodes)) {
        if (node.nodeType === 1 && node.tagName === "H2") break;
        if ((node.textContent || "").trim().length) { introHasContent = true; break; }
      }
    }
    if (h2 === 0) return 1;
    return h2 + (introHasContent ? 1 : 0);
  }, slug);

  const data = await page.evaluate((s) => window.__wbTest.fetchSections(s), slug);
  if (!data || !data.ok) fail(`fetchSections not ok for ${slug}: ${data && data.error}`);
  else if (data.sections.length !== expectedCount) {
    fail(`section count ${data.sections.length} != expected ${expectedCount} for ${slug}`);
  }

  // ── Task 2: world-state persists journeyed posts ──
  const persistResult = await page.evaluate((s) => {
    const first = window.__wbTest.markPostJourneyed(s);
    const second = window.__wbTest.markPostJourneyed(s);
    return { first, second, isMarked: window.__wbTest.isPostJourneyed(s) };
  }, slug);
  if (persistResult.first !== true) fail("markPostJourneyed should return true on first mark");
  if (persistResult.second !== false) fail("markPostJourneyed should return false on repeat");
  if (persistResult.isMarked !== true) fail("isPostJourneyed should be true after marking");

  // ── Task 3: journey overlay + HUD markup present and hidden by default ──
  for (const id of ["world-journey-overlay", "world-journey-body", "world-journey-hud", "world-journey-leave"]) {
    const exists = await page.$(`#${id}`);
    if (!exists) fail(`missing journey element #${id}`);
  }
  const overlayHidden = await page.$eval("#world-journey-overlay", (el) => el.hidden);
  if (!overlayHidden) fail("journey overlay should start hidden");

  if (errors.length) fail(`runtime errors:\n${errors.join("\n")}`);
  console.log(process.exitCode ? "JOURNEY SMOKE FAILED" : "JOURNEY SMOKE PASSED");
} finally {
  await browser.close();
  preview.kill();
}
