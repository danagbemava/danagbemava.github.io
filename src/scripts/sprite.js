/**
 * sprite.js – Golden-snitch easter egg
 *
 * A small golden orb with fluttering wings that dashes erratically
 * around the viewport. Clicking it 5 times within 2 seconds triggers
 * a warp transition to /world.
 */

const CLICK_THRESHOLD = 5;
const CLICK_WINDOW_MS = 2000;
const DASH_INTERVAL_MS = 1800;  // change direction every ~1.8s
const SPEED = 3.5;              // px per frame
const HOVER_AMPLITUDE = 6;      // px vertical bob

export function initSnitch() {
  /* ── create DOM ── */
  const snitch = document.createElement('div');
  snitch.className = 'snitch';
  snitch.setAttribute('aria-hidden', 'true');
  snitch.innerHTML = `
    <div class="snitch-body">
      <div class="snitch-glow"></div>
    </div>
    <div class="snitch-wing snitch-wing--left"></div>
    <div class="snitch-wing snitch-wing--right"></div>
  `;
  document.body.appendChild(snitch);

  /* ── state ── */
  let x = Math.random() * (window.innerWidth - 40);
  let y = Math.random() * (window.innerHeight - 40);
  let vx = (Math.random() - 0.5) * SPEED * 2;
  let vy = (Math.random() - 0.5) * SPEED * 2;
  let clickTimes = [];
  let caught = false;
  let hoverT = 0;

  /* position */
  snitch.style.left = `${x}px`;
  snitch.style.top = `${y}px`;

  /* ── periodic dash (sudden direction change) ── */
  const dashTimer = setInterval(() => {
    if (caught) return;
    // Sudden burst in a random direction
    const angle = Math.random() * Math.PI * 2;
    const burst = SPEED * (1.5 + Math.random());
    vx = Math.cos(angle) * burst;
    vy = Math.sin(angle) * burst;
    snitch.classList.add('snitch--dash');
    setTimeout(() => snitch.classList.remove('snitch--dash'), 300);
  }, DASH_INTERVAL_MS);

  /* ── click tracking ── */
  snitch.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (caught) return;

    const now = Date.now();
    clickTimes.push(now);
    clickTimes = clickTimes.filter(t => now - t < CLICK_WINDOW_MS);

    /* visual feedback */
    snitch.classList.add('snitch--hit');
    setTimeout(() => snitch.classList.remove('snitch--hit'), 200);

    /* burst away from click */
    const angle = Math.random() * Math.PI * 2;
    vx = Math.cos(angle) * SPEED * 2.5;
    vy = Math.sin(angle) * SPEED * 2.5;

    if (clickTimes.length >= CLICK_THRESHOLD) {
      caught = true;
      clearInterval(dashTimer);
      triggerWarp(snitch);
    }
  });

  /* ── animation loop ── */
  function frame() {
    if (caught) return;
    hoverT += 0.06;

    /* move */
    x += vx;
    y += vy;

    /* friction */
    vx *= 0.99;
    vy *= 0.99;

    /* keep minimum speed */
    const speed = Math.sqrt(vx * vx + vy * vy);
    if (speed < SPEED * 0.5) {
      const angle = Math.atan2(vy, vx);
      vx = Math.cos(angle) * SPEED * 0.6;
      vy = Math.sin(angle) * SPEED * 0.6;
    }

    /* bounce off viewport edges */
    const W = window.innerWidth - 36;
    const H = window.innerHeight - 36;
    if (x < 0)  { x = 0;  vx = Math.abs(vx); }
    if (x > W)  { x = W;  vx = -Math.abs(vx); }
    if (y < 0)  { y = 0;  vy = Math.abs(vy); }
    if (y > H)  { y = H;  vy = -Math.abs(vy); }

    /* hover bob */
    const bobY = Math.sin(hoverT) * HOVER_AMPLITUDE;

    snitch.style.left = `${x}px`;
    snitch.style.top = `${y + bobY}px`;

    /* tilt toward movement direction */
    const tilt = Math.atan2(vy, vx) * (180 / Math.PI);
    snitch.style.transform = `rotate(${tilt * 0.15}deg)`;

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

/* ── warp transition → /world ── */
function triggerWarp(snitch) {
  snitch.classList.add('snitch--caught');

  /* full-screen warp overlay */
  const warp = document.createElement('div');
  warp.className = 'snitch-warp';
  document.body.appendChild(warp);

  /* trigger animation */
  requestAnimationFrame(() => warp.classList.add('snitch-warp--active'));

  setTimeout(() => {
    window.location.href = '/world';
  }, 900);
}
