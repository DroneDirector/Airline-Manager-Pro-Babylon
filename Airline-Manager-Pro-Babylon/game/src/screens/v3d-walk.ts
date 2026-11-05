/* Walk the cabin: walk about inside the aircraft in first person, as in a modern game, while it flies, taxis
 * or stands at the gate. You move with the aircraft (it carries you), so nothing throws you out of it.
 *  - PC: W A S D or the arrow keys to walk, the mouse to look (click the view to take the mouse, Esc to let
 *    it go), Shift to walk faster.
 *  - Phone: the stick at the bottom left to walk, drag anywhere else to look.
 * You can walk the aisles, the galleys at the front and back and between the aisles; the seats, walls and
 * people block the way as they would. A gentle step bob follows your pace. */

const CabinWalk: any = {
  on: false, x: 0, y: 0, v: 0, dist: 0, keys: {} as { [k: string]: boolean }, stick: [0, 0], bound: false, started: false,
};

function cabinWalkStart() {
  const W = CabinWalk; W.on = true; W.started = false;
  // on the PC the view takes the mouse straight away (no pointer; turn as far as you like); a dot marks the middle
  if (DESKTOP && V3d.cv) aimLock(V3d.cv as any);
  if (V3d.root && !V3d.root.querySelector('.walk-dot')) { const d = document.createElement('div'); d.className = 'walk-dot'; V3d.root.appendChild(d); }
  if (!W.bound) {
    W.bound = true;
    const set = (e: KeyboardEvent, on: boolean) => {
      if (!V3d.open || V3d.mode !== 'walk' || (e.target as HTMLElement).closest && (e.target as HTMLElement).closest('input, textarea')) return;
      const k = e.key.toLowerCase(); if ('wasd'.indexOf(k) >= 0 || /^arrow/.test(k) || k === 'shift') { W.keys[k] = on; e.preventDefault(); }
    };
    document.addEventListener('keydown', e => set(e, true)); document.addEventListener('keyup', e => set(e, false));
    window.addEventListener('blur', () => { W.keys = {}; });
    // the mouse looks around once the view has it (click the view; Esc lets it go)
    document.addEventListener('mousemove', (e: MouseEvent) => {
      if (!V3d.open || V3d.mode !== 'walk' || document.pointerLockElement !== V3d.cv) return;
      V3d.yaw -= e.movementX * 0.0025; V3d.pitch = clamp(V3d.pitch - e.movementY * 0.0025, -1.2, 1.2);
    });
  }
  if (DESKTOP && V3d.cv && !(V3d.cv as any)._walkClick) {
    (V3d.cv as any)._walkClick = true;
    V3d.cv.addEventListener('click', () => { if (V3d.mode === 'walk' && document.pointerLockElement !== V3d.cv) { try { (V3d.cv as any).requestPointerLock(); } catch (e) { /* not allowed */ } } });
  }
  cabinWalkPad();
}
function cabinWalkStop() {
  const W = CabinWalk; if (!W.on) return; W.on = false; W.keys = {}; W.stick = [0, 0];
  if (W.glow) { W.glow.hide(); W.glow.dispose(); W.glow = null; }
  try { if (document.pointerLockElement === V3d.cv) document.exitPointerLock(); } catch (e) { /* not locked */ }
  const pad = V3d.root && V3d.root.querySelector('.walk-pad'); if (pad) pad.remove();
  const hint = V3d.root && V3d.root.querySelector('.walk-hint'); if (hint) hint.remove();
  const dot = V3d.root && V3d.root.querySelector('.walk-dot'); if (dot) dot.remove();
}

/** The stick for walking on a touch screen (and a short hint on the PC). */
function cabinWalkPad() {
  const root = V3d.root; if (!root || root.querySelector('.walk-pad')) return;
  const hint = document.createElement('div'); hint.className = 'walk-hint';
  hint.textContent = DESKTOP ? 'Click to look around with the mouse · W A S D to walk · Shift to walk faster · Esc lets go of the mouse' : 'Left stick to walk · drag to look around';
  root.appendChild(hint); setTimeout(() => hint.classList.add('fade'), 6000);
  const pad = document.createElement('div'); pad.className = 'walk-pad' + (cabinTouch() ? ' wp-touch' : ''); pad.innerHTML = '<i></i>'; root.appendChild(pad);
  const knob = pad.firstElementChild as HTMLElement; let id = -1;
  const move = (e: PointerEvent) => {
    const r = pad.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = r.width / 2;
    let dx = (e.clientX - cx) / R, dy = (e.clientY - cy) / R; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
    if (V3d.mode === 'cabin' && Math.hypot(dx, dy) > 0.25) v3dModeSet('walk');   // in the cabin view, the stick gets you up and walking
    CabinWalk.stick = [dx, -dy]; knob.style.transform = `translate(${dx * R * 0.6}px, ${dy * R * 0.6}px)`;
  };
  pad.addEventListener('pointerdown', e => { e.stopPropagation(); id = e.pointerId; pad.setPointerCapture(id); move(e); });
  pad.addEventListener('pointermove', e => { if (e.pointerId === id) { e.stopPropagation(); move(e); } });
  const up = (e: PointerEvent) => { if (e.pointerId !== id) return; id = -1; CabinWalk.stick = [0, 0]; knob.style.transform = ''; };
  pad.addEventListener('pointerup', up); pad.addEventListener('pointercancel', up);
}

/** Can you stand here? The aisles, and the galleys at the front and back across the whole width. */
function cabinWalkable(at: any, x: number, y: number): boolean {
  if (x < at.x0 + 0.35 || x > at.x1 - 0.2) return false;
  const galley = x < at.firstX - 0.45 || x > at.lastX + 0.75;
  if (galley) return Math.abs(y) < at.half - 0.35;
  for (const a of (at.aisles && at.aisles.length ? at.aisles : [at.aisleY])) if (Math.abs(y - a) < 0.2) return true;
  return false;
}

/** Each frame while walking: move, keep out of seats and walls, and place the eye. */
function cabinWalkCam(P: any, G: any, body: any, up: any) {
  const W = CabinWalk, at = G.userData.crewAt, T = THREE; if (!at) return;
  const now = performance.now() / 1000, dt = Math.min(0.1, Math.max(0, now - (W.last || now))); W.last = now;
  if (!W.started || W.for !== P.id) { W.started = true; W.for = P.id; W.x = Math.min(at.x1 - 0.5, at.lastX + 1.0); W.y = at.aisleY; V3d.yaw = 0; V3d.pitch = 0; W.v = 0; }
  // input: keys and the stick
  const K = W.keys, f = (K.w || K.arrowup ? 1 : 0) - (K.s || K.arrowdown ? 1 : 0) + W.stick[1], r = (K.d || K.arrowright ? 1 : 0) - (K.a || K.arrowleft ? 1 : 0) + W.stick[0];
  const mag = Math.min(1, Math.hypot(f, r)), vmax = K.shift ? 2.2 : 1.35;
  const yaw = -V3d.yaw, pitch = clamp(V3d.pitch, -1.2, 1.2);
  // forward along the cabin is −x; to the right is +y
  const fx = -Math.cos(yaw), fy = Math.sin(yaw), rx = Math.sin(yaw), ry = Math.cos(yaw);
  let mx = fx * f + rx * r, my = fy * f + ry * r; const ml = Math.hypot(mx, my) || 1; mx /= ml; my /= ml;
  W.v += ((mag > 0.05 ? vmax * mag : 0) - W.v) * Math.min(1, dt * 6);   // speed up and slow down gently
  const step = W.v * dt;
  if (step > 0) {
    // slide along what is in the way
    const nx = W.x + mx * step, ny = W.y + my * step;
    if (cabinWalkable(at, nx, ny) && !cabinWalkBumps(nx, ny, at)) { W.x = nx; W.y = ny; }
    else if (cabinWalkable(at, nx, W.y) && !cabinWalkBumps(nx, W.y, at)) W.x = nx;
    else if (cabinWalkable(at, W.x, ny) && !cabinWalkBumps(W.x, ny, at)) W.y = ny;
    W.dist += step;
  }
  // the aisle carpet, or the galley's vinyl floor
  Sound.steps(W, W.dist, W.x < at.firstX - 0.45 || W.x > at.lastX + 0.75 ? 'tile' : 'carpet', W.v);
  // the eye: standing height, with a gentle bob as you walk
  const bob = Math.sin(W.dist / 0.65 * Math.PI) * 0.018 * Math.min(1, W.v / 1.2);
  const eye = body.localToWorld(_av(W.x, W.y, at.zf + 1.64 + bob));
  const ahead = body.localToWorld(_av(W.x + Math.cos(pitch) * fx, W.y + Math.cos(pitch) * fy, at.zf + 1.64 + bob + Math.sin(pitch)));
  V3d.cam.position.copy(eye); V3d.cam.up.copy(up); V3d.cam.lookAt(ahead); V3d.cam.up.set(0, 1, 0);
  try { cabinWalkGlow(G, dt); } catch (e) { /* no glow */ }
}
/** Whoever you look at (the dot in the middle) and can talk to glows softly: crew and passengers within reach. */
function cabinWalkGlow(G: any, dt: number) {
  const W = CabinWalk, T = THREE;
  if (!W.glow || W.glow.mesh.parent !== V3d.scene) W.glow = new AimGlow(V3d.scene);
  V3d.cam.updateMatrixWorld();
  const ray = new T.Raycaster(); ray.setFromCamera(new T.Vector2(0, 0), V3d.cam);
  const eye = V3d.cam.position; let best: any = null, bd = 0.32;
  for (const m of (CabinCrew.members || [])) {
    if (m.hidden || !m.holder) continue; const h = (m.m && m.m.top) || 1.7, sit = m.sitK > 0.5;
    const c = m.holder.localToWorld(new T.Vector3(0, h * (sit ? 0.42 : 0.55), 0)); if (c.distanceTo(eye) > 3.2) continue;
    const d = ray.ray.distanceToPoint(c); if (d < bd) { bd = d; best = { c, half: new T.Vector3(0.3, h * (sit ? 0.34 : 0.52), 0.3) }; }
  }
  const pg = G.userData.people;
  if (pg && pg.userData.who) for (const w of pg.userData.who) {
    const c = G.localToWorld(w.head.clone().add(new T.Vector3(0, -0.22, 0))); if (c.distanceTo(eye) > 3.2) continue;
    const d = ray.ray.distanceToPoint(c); if (d < bd) { bd = d; best = { c, half: new T.Vector3(0.28, 0.4, 0.28).multiplyScalar(w.sc || 1) }; }
  }
  if (best && V3d.mode === 'walk') W.glow.show(best.c, best.half); else W.glow.hide();
  W.glow.step(dt);
}
/** The crew and the trolley are in the way too. */
function cabinWalkBumps(x: number, y: number, at: any): boolean {
  try {
    for (const m of (CabinCrew.members || [])) { if (m.hidden) continue; const yy = m.want && m.want.sit && m.sitK > 0.5 ? m.want.side : at.aisleY + m.side; if (Math.hypot(m.x - x, yy - y) < 0.38) return true; }
    const S = CabinCrew.trolley; if (S && S.visible) { const tp = S.position, sx = tp.x, sy = -tp.z; if (Math.abs(sx - x) < 0.62 && Math.abs(sy - y) < 0.3) return true; }
  } catch (e) { /* nothing in the way */ }
  return false;
}

/* ---------- touch screens: the stick in the cabin view too ---------- */
/** A touch screen (a phone, a tablet, or a PC with a touch screen)? */
function cabinTouch(): boolean { try { return !DESKTOP || navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches; } catch (e) { return !DESKTOP; } }
/** In the cabin view on a touch screen the walking stick is there: push it and you get up and walk the aisle,
 *  as in your office, Operations and the court. Elsewhere it goes. */
function cabinTouchPad() {
  const root = V3d.root; if (!root) return;
  if (V3d.mode === 'walk') return;
  if (V3d.mode === 'cabin' && cabinTouch()) { cabinWalkPad(); return; }
  const pad = root.querySelector('.walk-pad'); if (pad) pad.remove();
  const hint = root.querySelector('.walk-hint'); if (hint) hint.remove();
}

/* ---------- going into the cabin: a loading screen, as when the 3D view opens ---------- */
const CAB_LOAD_MS = 1300;   // shown at least this long
function cabinLoadShow(go: () => void) {
  const root = V3d.root; if (!root) { go(); return; }
  if (root.querySelector('.cab-load')) return;
  const L = document.createElement('div'); L.className = 'v3d-load splash cab-load';
  L.innerHTML = `<div class="spl-glow"></div><div class="v3l-orbit"><i></i><i></i><i></i></div>
    <div class="spl-mark">${splashLogo()}</div><div class="spl-name"><b>Loading cabin</b></div>
    <div class="spl-load"><div class="spl-info"><span class="spl-step">Building the cabin…</span><b class="spl-pct">0%</b></div>
      <div class="spl-bar"><i class="spl-fill"><span class="spl-sheen"></span></i><span class="spl-tip"><svg viewBox="0 0 24 24"><path d="M21 15.5v-1.8l-8-5V3.6a1.5 1.5 0 0 0-3 0v5.1l-8 5v1.8l8-2.5v5l-2 1.5V21l3.5-1 3.5 1v-1.5L13 18v-5z"/></svg></span></div></div>`;
  root.appendChild(L);
  const fill = L.querySelector('.spl-fill') as HTMLElement, tip = L.querySelector('.spl-tip') as HTMLElement, pct = L.querySelector('.spl-pct') as HTMLElement, step = L.querySelector('.spl-step') as HTMLElement;
  const set = (k: number, txt: string) => { const v = Math.round(k * 100); fill.style.width = v + '%'; tip.style.left = v + '%'; pct.textContent = v + '%'; if (step.textContent !== txt) step.textContent = txt; };
  const t0 = performance.now(); let went = 0, frames = 0;
  const tick = () => {
    if (!L.isConnected) return;
    const t = performance.now() - t0;
    if (!went) {
      set(Math.min(0.55, t / 700 * 0.55), 'Building the cabin…');
      if (t > 420) { went = t; requestAnimationFrame(() => { try { go(); } catch (e) { /* the view goes on */ } requestAnimationFrame(tick); }); return; }
    } else {
      frames++;   // the cabin is built in the first frame drawn after the switch
      const k = Math.min(1, 0.55 + 0.45 * Math.min(1, (t - went) / Math.max(300, CAB_LOAD_MS - went)));
      set(k, k < 0.8 ? 'Seating the passengers…' : k < 1 ? 'Turning on the cabin lights…' : 'Ready');
      if (k >= 1 && frames > 2) { L.classList.add('out'); setTimeout(() => L.remove(), 750); return; }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
