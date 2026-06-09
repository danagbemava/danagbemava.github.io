import { destinations, destinationKeys, setHashForDestination } from "./open-world-config.js";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 2D star-streak tunnel on the warp overlay canvas.
const createStreaks = (canvas) => {
  const ctx = canvas.getContext("2d");
  let rafId = null;
  let accent = "#c8b0ff";
  const streaks = Array.from({ length: 110 }, () => ({
    angle: Math.random() * Math.PI * 2,
    dist: Math.random(),
    speed: 0.4 + Math.random() * 1.2,
    len: 0.05 + Math.random() * 0.2
  }));
  const frame = () => {
    const w = canvas.width = canvas.clientWidth;
    const h = canvas.height = canvas.clientHeight;
    const cx = w / 2; const cy = h / 2;
    const maxR = Math.hypot(cx, cy);
    ctx.fillStyle = "rgba(2, 1, 8, 0.35)";
    ctx.fillRect(0, 0, w, h);
    for (const s of streaks) {
      s.dist += s.speed * 0.016;
      if (s.dist > 1) { s.dist = 0.02; s.angle = Math.random() * Math.PI * 2; }
      const r0 = s.dist * maxR;
      const r1 = Math.min(maxR, (s.dist + s.len * s.dist) * maxR);
      ctx.strokeStyle = s.dist > 0.5 ? "#ffffff" : accent;
      ctx.globalAlpha = Math.min(1, s.dist * 2);
      ctx.lineWidth = 1 + s.dist * 2.5;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(s.angle) * r0, cy + Math.sin(s.angle) * r0);
      ctx.lineTo(cx + Math.cos(s.angle) * r1, cy + Math.sin(s.angle) * r1);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    rafId = requestAnimationFrame(frame);
  };
  return {
    start: (accentHex) => { accent = accentHex; if (!rafId) rafId = requestAnimationFrame(frame); },
    stop: () => { if (rafId) cancelAnimationFrame(rafId); rafId = null; }
  };
};

/**
 * Warp controller. `performSwap(key)` must execute the scene swap and
 * return a promise that resolves when the destination's assets are ready
 * (the controller caps the wait at 5s).
 */
export const createWarpController = ({ els, performSwap, sounds }) => {
  const streaks = createStreaks(els.warpCanvas);
  let warping = false;

  const showArrival = (dest) => {
    els.arrivalKicker.textContent = dest.kicker;
    els.arrivalTitle.textContent = dest.title;
    els.arrival.hidden = false;
    els.arrival.classList.remove("is-active");
    void els.arrival.offsetWidth;
    els.arrival.classList.add("is-active");
    setTimeout(() => { els.arrival.hidden = true; els.arrival.classList.remove("is-active"); }, 2000);
  };

  const warpTo = async (key) => {
    if (warping || !destinations[key]) return false;
    warping = true;
    const dest = destinations[key];
    try {
      sounds.charge();
      await wait(400);
      els.warp.hidden = false;
      void els.warp.offsetWidth;
      els.warp.classList.add("is-active");
      streaks.start(`#${dest.accent.toString(16).padStart(6, "0")}`);
      sounds.tunnel();
      const swapReady = Promise.resolve(performSwap(key));
      await Promise.all([
        Promise.race([swapReady, wait(5000)]),
        wait(1200)
      ]);
      streaks.stop();
      els.warp.classList.remove("is-active");
      setTimeout(() => { els.warp.hidden = true; }, 400);
      setHashForDestination(key);
      showArrival(dest);
      sounds.arrival();
      return true;
    } catch (err) {
      // Failed swap: hide the overlay and keep whatever scene is live.
      console.warn("warp failed", err);
      streaks.stop();
      els.warp.classList.remove("is-active");
      els.warp.hidden = true;
      return false;
    } finally {
      warping = false;
    }
  };

  return { warpTo, get warping() { return warping; } };
};

/** Starmap overlay. */
export const createStarmap = ({ els, getCurrentKey, getProgress, onPick }) => {
  const buttons = Array.from(els.starmapGrid.querySelectorAll("[data-dest]"));
  let open = false;
  let lastFocused = null;

  const refresh = () => {
    const current = getCurrentKey();
    for (const btn of buttons) {
      const key = btn.dataset.dest;
      btn.dataset.current = String(key === current);
      const progressEl = btn.querySelector("[data-progress]");
      const p = getProgress(key);
      progressEl.textContent = key === "home" ? "" : `${p.beacon ? "Beacon ✓" : "Beacon —"} · ${p.secret ? "Secret ✓" : "Secret —"}`;
    }
  };

  const show = () => {
    if (open) return;
    open = true;
    refresh();
    els.starmap.hidden = false;
    els.starmap.setAttribute("aria-hidden", "false");
    lastFocused = document.activeElement;
    els.starmapClose.focus();
  };

  const hide = () => {
    if (!open) return;
    open = false;
    els.starmap.hidden = true;
    els.starmap.setAttribute("aria-hidden", "true");
    if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
    lastFocused = null;
  };

  const toggle = () => (open ? hide() : show());

  for (const btn of buttons) {
    btn.addEventListener("click", () => {
      const key = btn.dataset.dest;
      if (key === getCurrentKey()) return;
      hide();
      onPick(key);
    });
  }
  els.starmapClose.addEventListener("click", hide);
  els.starmap.addEventListener("click", (event) => { if (event.target === els.starmap) hide(); });

  return { show, hide, toggle, get isOpen() { return open; } };
};

export { destinationKeys };
