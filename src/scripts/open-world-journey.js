import * as THREE from "three";
import { createSpriteLabel } from "./open-world-config.js";

const ACCENT = 0x00e5ff;
const LABEL = "#a0f0ff";
const SPACING = 9;       // world units between checkpoints
const START_Z = 6;       // first checkpoint sits this far in front of the trail head
const NEAR_RADIUS = 3.6; // proximity radius to open a checkpoint/terminus

export const createPostJourney = (opts) => {
  const {
    scene, playerObj, setText, hud, overlay,
    fetchSections, onEnter, onLeave, onComplete, onNextPost, sounds = {}
  } = opts;

  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  let active = false;
  let overlayOpen = false;
  let terminusMode = false;
  let lastFocused = null;
  let startEpoch = 0;
  let sections = [];
  let checkpoints = [];   // { index, root, spire, ring, teaser, pos, read }
  let segments = [];      // { mesh }
  let terminus = null;    // { root, spire, halo, pos }
  let nearby = null;      // number | "terminus" | null
  let openIndex = null;
  let slug = null;
  let title = "";
  let meta = "";
  let boundsRadius = 40;
  let ticker = 0;
  const returnPos = new THREE.Vector3();

  const point = (i) => new THREE.Vector3(Math.sin(i * 0.6) * 4, 0, START_Z - i * SPACING);
  const markerMat = (emissiveInt) => new THREE.MeshStandardMaterial({
    color: 0x041820, emissive: ACCENT, emissiveIntensity: emissiveInt, roughness: 0.3, metalness: 0.5
  });
  const glowMat = (opacity) => new THREE.MeshBasicMaterial({
    color: ACCENT, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false
  });

  const readCount = () => checkpoints.filter((c) => c.read).length;
  const allRead = () => checkpoints.length > 0 && checkpoints.every((c) => c.read);

  const buildMarker = (i) => {
    const root = new THREE.Group();
    const pos = point(i);
    root.position.copy(pos);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.6, 4.2, 5), markerMat(0.25));
    spire.position.y = 2.1;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.05, 10, 36), glowMat(0.32));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.06;
    root.add(spire, ring);
    const teaser = createSpriteLabel(`${i + 1}. ${sections[i].heading}`, LABEL, { x: 4.4, y: 1.05 });
    if (teaser) { teaser.position.set(0, 5.4, 0); teaser.material.opacity = 0.5; root.add(teaser); }
    group.add(root);
    return { index: i, root, spire, ring, teaser, pos, read: false };
  };

  const buildSegment = (i) => {
    const a = i === 0 ? new THREE.Vector3(0, 0, START_Z + 4) : point(i - 1);
    const b = point(i);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const len = a.distanceTo(b) || 0.0001;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, len), glowMat(0.1));
    mesh.position.set(mid.x, 0.08, mid.z);
    mesh.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
    group.add(mesh);
    return { mesh };
  };

  const buildTerminus = (n) => {
    const root = new THREE.Group();
    const pos = point(n);
    root.position.copy(pos);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(1.1, 7.5, 6), markerMat(0.3));
    spire.position.y = 3.75;
    const halo = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.08, 12, 40), glowMat(0.4));
    halo.rotation.x = Math.PI / 2; halo.position.y = 5.2;
    const baseRing = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.06, 10, 40), glowMat(0.3));
    baseRing.rotation.x = Math.PI / 2; baseRing.position.y = 0.06;
    root.add(spire, halo, baseRing);
    group.add(root);
    return { root, spire, halo, pos };
  };

  const clearTrail = () => {
    for (const child of [...group.children]) {
      group.remove(child);
      child.traverse?.((o) => {
        if (o.geometry) o.geometry.dispose?.();
        if (o.material) {
          if (o.material.map) o.material.map.dispose?.();
          o.material.dispose?.();
        }
      });
    }
    checkpoints = [];
    segments = [];
    terminus = null;
  };

  const updateProgressHud = () => {
    if (overlay.hudProgress) overlay.hudProgress.textContent = `${readCount()} / ${checkpoints.length}`;
  };

  const lightCheckpoint = (c) => {
    c.read = true;
    c.spire.material.emissiveIntensity = 0.85;
    c.ring.material.opacity = 0.75;
    if (c.teaser) c.teaser.material.opacity = 0.85;
    if (segments[c.index]) segments[c.index].mesh.material.opacity = 0.55;
  };

  const markRead = (i) => {
    const c = checkpoints[i];
    if (!c || c.read) return;
    const wasComplete = allRead();
    lightCheckpoint(c);
    updateProgressHud();
    if (!wasComplete && allRead()) {
      if (terminus) {
        terminus.halo.material.opacity = 0.85;
        terminus.spire.material.emissiveIntensity = 0.9;
      }
      sounds.complete && sounds.complete();
      onComplete && onComplete(slug);
    }
  };

  const renderSection = (i) => {
    const s = sections[i];
    overlay.title.textContent = s.heading;
    overlay.body.innerHTML = s.html;
    overlay.progress.textContent = `${i + 1} / ${sections.length}`;
    overlay.prevBtn.textContent = "← Prev";
    overlay.prevBtn.disabled = i === 0;
    overlay.nextBtn.textContent = i < sections.length - 1 ? "Next →" : "To terminus →";
    overlay.nextBtn.disabled = false;
  };

  const renderTerminus = () => {
    const done = allRead();
    overlay.title.textContent = title;
    overlay.body.innerHTML =
      `<p class="entry-meta">${meta}</p>` +
      (done
        ? `<p>Transmission received. You walked the whole signal.</p>`
        : `<p>${readCount()} of ${sections.length} checkpoints read. Keep walking the trail to complete the transmission.</p>`);
    overlay.progress.textContent = `${readCount()} / ${sections.length}`;
    overlay.prevBtn.textContent = "↺ Replay";
    overlay.prevBtn.disabled = false;
    overlay.nextBtn.textContent = "Next post →";
    overlay.nextBtn.disabled = false;
  };

  const showOverlay = () => {
    lastFocused = document.activeElement;
    overlay.root.hidden = false;
    overlay.root.setAttribute("aria-hidden", "false");
    overlayOpen = true;
    if (hud.promptEl) hud.promptEl.hidden = true;
    overlay.closeBtn.focus();
    sounds.open && sounds.open();
  };

  const openSectionByIndex = (i, options = {}) => {
    if (i < 0 || i >= sections.length) return;
    terminusMode = false;
    openIndex = i;
    if (options.teleport) {
      const p = checkpoints[i].pos;
      playerObj.player.position.set(p.x, 0, p.z + 3);
    }
    renderSection(i);
    markRead(i);
    showOverlay();
  };

  const openTerminus = () => {
    terminusMode = true;
    openIndex = null;
    renderTerminus();
    showOverlay();
  };

  const closeOverlay = () => {
    if (!overlayOpen) return;
    overlay.root.hidden = true;
    overlay.root.setAttribute("aria-hidden", "true");
    overlayOpen = false;
    terminusMode = false;
    sounds.close && sounds.close();
    if (lastFocused && lastFocused.focus) lastFocused.focus();
    lastFocused = null;
  };

  const tryOpen = () => {
    if (overlayOpen) return;
    if (nearby === "terminus") { openTerminus(); return; }
    if (typeof nearby === "number") { openSectionByIndex(nearby); return; }
  };

  const replay = () => {
    for (const c of checkpoints) {
      c.read = false;
      c.spire.material.emissiveIntensity = 0.25;
      c.ring.material.opacity = 0.32;
      if (c.teaser) c.teaser.material.opacity = 0.5;
    }
    for (const seg of segments) seg.mesh.material.opacity = 0.1;
    if (terminus) { terminus.halo.material.opacity = 0.4; terminus.spire.material.emissiveIntensity = 0.3; }
    updateProgressHud();
    closeOverlay();
    playerObj.player.position.set(0, 0, START_Z + 8);
  };

  const start = async (entry, originMesh) => {
    if (active) return;
    const epoch = ++startEpoch;
    slug = entry.slug;
    const data = await fetchSections(slug);
    if (epoch !== startEpoch) return;
    if (!data || !data.ok || !data.sections.length) {
      window.location.href = `/posts/${slug}/`; // graceful fallback to the article
      return;
    }
    sections = data.sections;
    title = data.title || entry.title || slug;
    meta = data.meta || "";
    returnPos.copy(originMesh ? originMesh.position : playerObj.player.position);

    clearTrail();
    checkpoints = sections.map((_, i) => buildMarker(i));
    segments = sections.map((_, i) => buildSegment(i));
    terminus = buildTerminus(sections.length);
    group.visible = true;

    playerObj.player.position.set(0, 0, START_Z + 8);
    boundsRadius = sections.length * SPACING + 18;
    active = true;

    overlay.plainLink.href = `/posts/${slug}/`;
    if (overlay.hud) { overlay.hud.hidden = false; overlay.hud.setAttribute("aria-hidden", "false"); }
    updateProgressHud();
    onEnter && onEnter();
    sounds.start && sounds.start();
  };

  const leave = () => {
    if (!active) return;
    startEpoch += 1;
    closeOverlay();
    clearTrail();
    group.visible = false;
    active = false;
    nearby = null;
    playerObj.player.position.set(returnPos.x, 0, returnPos.z);
    if (overlay.hud) { overlay.hud.hidden = true; overlay.hud.setAttribute("aria-hidden", "true"); }
    if (hud.promptEl) hud.promptEl.hidden = true;
    onLeave && onLeave();
    sounds.leave && sounds.leave();
  };

  const update = (dt) => {
    if (!active) return;
    ticker += dt;
    const p = playerObj.player.position;

    let foundNearby = null;
    let nearestDist = Infinity;
    for (const c of checkpoints) {
      const d = Math.hypot(p.x - c.pos.x, p.z - c.pos.z);
      // gentle idle shimmer on unread teasers
      if (c.teaser && !c.read) c.teaser.material.opacity = 0.5 + Math.sin(ticker * 2 + c.index) * 0.08;
      if (d < NEAR_RADIUS && d < nearestDist) { nearestDist = d; foundNearby = c.index; }
    }
    if (terminus) {
      const d = Math.hypot(p.x - terminus.pos.x, p.z - terminus.pos.z);
      terminus.halo.rotation.z += dt * (allRead() ? 1.6 : 0.4);
      if (d < NEAR_RADIUS && d < nearestDist) { nearestDist = d; foundNearby = "terminus"; }
    }
    nearby = foundNearby;

    if (!overlayOpen && hud.promptEl) {
      if (nearby === "terminus") {
        hud.promptEl.hidden = false;
        setText(hud.promptText, allRead() ? "View transmission summary" : "Inspect relay spire");
        if (hud.actionBtn) { setText(hud.actionBtn, "Read"); hud.actionBtn.disabled = false; }
      } else if (typeof nearby === "number") {
        hud.promptEl.hidden = false;
        setText(hud.promptText, `Read: ${sections[nearby].heading}`);
        if (hud.actionBtn) { setText(hud.actionBtn, "Read"); hud.actionBtn.disabled = false; }
      } else {
        hud.promptEl.hidden = true;
        if (hud.actionBtn) hud.actionBtn.disabled = true;
      }
    }
  };

  const onPrev = () => { if (terminusMode) replay(); else if (openIndex > 0) openSectionByIndex(openIndex - 1, { teleport: true }); };
  const onNext = () => {
    if (terminusMode) { onNextPost && onNextPost(); return; }
    if (openIndex < sections.length - 1) openSectionByIndex(openIndex + 1, { teleport: true });
    else openTerminus();
  };

  overlay.closeBtn.addEventListener("click", closeOverlay);
  overlay.prevBtn.addEventListener("click", onPrev);
  overlay.nextBtn.addEventListener("click", onNext);
  if (overlay.leaveBtn) overlay.leaveBtn.addEventListener("click", leave);

  const onOverlayKeyDown = (event) => {
    if (!overlayOpen || event.key !== "Tab") return;
    event.preventDefault();
    const candidates = [overlay.closeBtn, overlay.prevBtn, overlay.plainLink, overlay.nextBtn];
    const focusables = candidates.filter((el) => el && !el.disabled && !el.hidden);
    if (focusables.length === 0) return;
    const idx = focusables.indexOf(document.activeElement);
    const next = event.shiftKey
      ? (idx <= 0 ? focusables.length - 1 : idx - 1)
      : (idx + 1) % focusables.length;
    focusables[next].focus();
  };
  window.addEventListener("keydown", onOverlayKeyDown);

  const dispose = () => {
    overlay.closeBtn.removeEventListener("click", closeOverlay);
    overlay.prevBtn.removeEventListener("click", onPrev);
    overlay.nextBtn.removeEventListener("click", onNext);
    if (overlay.leaveBtn) overlay.leaveBtn.removeEventListener("click", leave);
    window.removeEventListener("keydown", onOverlayKeyDown);
    clearTrail();
    if (group.parent) group.parent.remove(group);
  };

  return {
    start, update, tryOpen, openSectionByIndex, closeOverlay, leave, replay, dispose,
    get active() { return active; },
    get overlayOpen() { return overlayOpen; },
    get blockers() { return []; },
    get boundsRadius() { return boundsRadius; },
    get currentSlug() { return slug; },
    get sectionCount() { return sections.length; },
    get readCount() { return readCount(); },
    get allRead() { return allRead(); }
  };
};
