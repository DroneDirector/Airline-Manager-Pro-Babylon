/** The phone on a desk (pos, turned by yaw), screen up and on; its parts in A (phoneAt, phoneScr, its hit for clicks). */
function phoneMesh(T: any, root: any, A: any, pos: number[], yaw: number) {
  { const g = new T.Group(); g.position.set(pos[0], pos[1], pos[2]); g.rotation.set(-Math.PI / 2, 0, yaw); root.add(g); A.phoneAt = g; A.hits = A.hits || [];
    const gi = new T.Group(); g.add(gi); A.phoneIn = gi;   // the phone's parts (nudged a few millimetres clear of your fingers while held)
    const W = 0.072, H = 0.152, r = 0.009, sh = new T.Shape(); sh.moveTo(-W / 2 + r, -H / 2); sh.lineTo(W / 2 - r, -H / 2); sh.quadraticCurveTo(W / 2, -H / 2, W / 2, -H / 2 + r); sh.lineTo(W / 2, H / 2 - r); sh.quadraticCurveTo(W / 2, H / 2, W / 2 - r, H / 2); sh.lineTo(-W / 2 + r, H / 2); sh.quadraticCurveTo(-W / 2, H / 2, -W / 2, H / 2 - r); sh.lineTo(-W / 2, -H / 2 + r); sh.quadraticCurveTo(-W / 2, -H / 2, -W / 2 + r, -H / 2);
    // a titanium frame with rounded edges, a matte grey back with a camera island and a small engraved emblem,
    // the side buttons, and black glass on the front with the screen behind it
    const frameM = new T.MeshPhysicalMaterial({ color: 0xb8b4ab, metalness: 0.92, roughness: 0.28, clearcoat: 0.3 });
    const bodyM = new T.Mesh(new T.ExtrudeGeometry(sh, { depth: 0.0058, bevelEnabled: true, bevelThickness: 0.0014, bevelSize: 0.0014, bevelSegments: 4, curveSegments: 12 }), frameM);
    bodyM.position.z = -0.0072; bodyM.castShadow = true; gi.add(bodyM);
    const inset = (w: number, h: number, rr: number) => { const q = new T.Shape(); q.moveTo(-w / 2 + rr, -h / 2); q.lineTo(w / 2 - rr, -h / 2); q.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + rr); q.lineTo(w / 2, h / 2 - rr); q.quadraticCurveTo(w / 2, h / 2, w / 2 - rr, h / 2); q.lineTo(-w / 2 + rr, h / 2); q.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - rr); q.lineTo(-w / 2, -h / 2 + rr); q.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + rr, -h / 2); return new T.ShapeGeometry(q, 10); };
    const back = new T.Mesh(inset(W - 0.002, H - 0.002, r * 0.9), new T.MeshPhysicalMaterial({ color: 0x86837d, metalness: 0.15, roughness: 0.62, sheen: 0.2 })); back.position.z = -0.0087; back.rotation.y = Math.PI; gi.add(back);
    // the camera island: three lenses in a row and a flash
    const isl = new T.Mesh(new T.ExtrudeGeometry((() => { const q = new T.Shape(), w = W * 0.74, h = 0.022, rr = 0.011; q.moveTo(-w / 2 + rr, -h / 2); q.lineTo(w / 2 - rr, -h / 2); q.absarc(w / 2 - rr, 0, rr, -Math.PI / 2, Math.PI / 2, false); q.lineTo(-w / 2 + rr, h / 2); q.absarc(-w / 2 + rr, 0, rr, Math.PI / 2, Math.PI * 1.5, false); return q; })(), { depth: 0.0018, bevelEnabled: true, bevelThickness: 0.0005, bevelSize: 0.0005, bevelSegments: 2 }), new T.MeshPhysicalMaterial({ color: 0x15171b, metalness: 0.3, roughness: 0.18, clearcoat: 1 }));
    isl.position.set(0, H / 2 - 0.022, -0.0087); isl.rotation.y = Math.PI; gi.add(isl);
    for (let i = 0; i < 3; i++) {
      const lx = -W * 0.22 + i * W * 0.17, ring = new T.Mesh(new T.CylinderGeometry(0.0062, 0.0062, 0.0012, 28), frameM); ring.rotation.x = Math.PI / 2; ring.position.set(lx, H / 2 - 0.022, -0.0112); gi.add(ring);
      const lens = new T.Mesh(new T.CylinderGeometry(0.0046, 0.0046, 0.0014, 28), new T.MeshPhysicalMaterial({ color: 0x050608, metalness: 0.1, roughness: 0.05, clearcoat: 1, iridescence: 0.6 })); lens.rotation.x = Math.PI / 2; lens.position.set(lx, H / 2 - 0.022, -0.0114); gi.add(lens);
    }
    const flash = new T.Mesh(new T.CylinderGeometry(0.0018, 0.0018, 0.0008, 16), new T.MeshStandardMaterial({ color: 0xf2e8d0, roughness: 0.3, emissive: 0x332a18 })); flash.rotation.x = Math.PI / 2; flash.position.set(W * 0.29, H / 2 - 0.022, -0.0108); gi.add(flash);
    { const em = new T.Mesh(new T.RingGeometry(0.0045, 0.0052, 4, 1), new T.MeshStandardMaterial({ color: 0x9a978f, metalness: 0.6, roughness: 0.35, side: T.DoubleSide })); em.position.set(0, -0.005, -0.0089); em.rotation.set(0, Math.PI, Math.PI / 4); gi.add(em); }
    // the side buttons (volume up and down, and the power key) on the right edge
    for (const [by, bl] of [[0.03, 0.016], [0.012, 0.016], [-0.016, 0.012]] as number[][]) { const bt = new T.Mesh(new T.BoxGeometry(0.0012, bl, 0.0028), frameM); bt.position.set(W / 2 + 0.0019, by, -0.0042); gi.add(bt); }
    // the front glass: black bezel round the screen
    const glassBlack = new T.Mesh(inset(W - 0.0006, H - 0.0006, r * 0.95), new T.MeshPhysicalMaterial({ color: 0x050607, metalness: 0, roughness: 0.08, clearcoat: 1 })); glassBlack.position.z = -0.00005; gi.add(glassBlack);
    const cv = document.createElement('canvas'); cv.width = 216; cv.height = 456; const tx = new T.CanvasTexture(cv); tx.colorSpace = T.SRGBColorSpace; A.phoneCv = cv; A.phoneTex = tx;
    const scr = new T.Mesh(new T.PlaneGeometry(W - 0.005, H - 0.005), new T.MeshBasicMaterial({ map: tx, toneMapped: false })); scr.position.z = 0.0001; gi.add(scr); A.phoneScr = scr; scr.userData.size = [W - 0.005, H - 0.005];
    // the glass over the screen: it catches the room's light, so a soft glare slides over it as the phone moves
    const glass = new T.Mesh(inset(W - 0.0008, H - 0.0008, r * 0.95), new T.MeshPhysicalMaterial({ color: 0x000000, metalness: 0, roughness: 0.03, transparent: true, opacity: 0.22, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.6, depthWrite: false }));
    glass.position.z = 0.0003; gi.add(glass);
    const cam = new T.Mesh(new T.CircleGeometry(0.0022, 20), new T.MeshBasicMaterial({ color: 0x020203 })); cam.position.set(0, H / 2 - 0.0095, 0.00025); gi.add(cam);
    const hit = new T.Mesh(new T.BoxGeometry(W + 0.03, H + 0.03, 0.04), new T.MeshBasicMaterial({ visible: false })); hit.userData.act = 'phone'; gi.add(hit); A.hits.push(hit);
    phoneLock(A); }
}
// Your phone, in your office and in Operations: lying on the desk with its screen on; click it and your hand picks
// it up; tap it and its screen comes up to you in its frame (the laptop's apps in a phone layout, to scroll and tap);
// lower it, and put it back where it was. Each room gives its room object (R: R.A, R.cam, R.root, R.me, R.overlay)
// and R.phoneAfter (the room's own buttons back after the screen goes down).
/** The lock screen on the phone in the room: the company's colours, the time and what is waiting. */
function phoneLock(A: any) {
  const cv = A && A.phoneCv as HTMLCanvasElement; if (!cv) return;
  const x = cv.getContext('2d') as CanvasRenderingContext2D, co: any = company(), W = cv.width, H = cv.height, d = typeof lapGameNow === 'function' ? lapGameNow() : new Date();
  const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, co.color || '#2C8CFF'); g.addColorStop(1, co.color2 || '#0B2A55'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#fff'; x.textAlign = 'center'; x.font = '600 52px Inter, sans-serif'; x.fillText(d.toTimeString().slice(0, 5), W / 2, 120);
  x.font = '500 15px Inter, sans-serif'; x.fillText(d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }), W / 2, 148);
  let un = 0; try { un = lapUnread(); } catch (e) { /* none */ }
  if (un) { x.fillStyle = 'rgba(255,255,255,.18)'; x.fillRect(16, 190, W - 32, 46); x.fillStyle = '#fff'; x.font = '600 14px Inter, sans-serif'; x.fillText(`${un} new ${un === 1 ? 'message' : 'messages'}`, W / 2, 218); }
  x.fillStyle = 'rgba(255,255,255,.7)'; x.fillRect(W / 2 - 40, H - 16, 80, 4);
  if (A.phoneTex) A.phoneTex.needsUpdate = true;
}
const PH_PK_D = { reach: 0.75, lift: 0.95, lower: 0.95, release: 0.6 };
function phonePick(R: any) {
  const A = R.A; if (!A || !A.phoneAt || (R.pk && R.pk.st !== 'idle') || R.overlay) return;
  phoneLock(A);
  R.pk = { st: 'reach', t: 0, P0: A.phoneAt.position.clone(), q0: A.phoneAt.quaternion.clone(), a: {} };
  if (R.glow) R.glow.hide(); R.lapHover = false; R.hover = false; phoneUi(R); Sound.tick();
}
function phonePut(R: any) { const pk = R.pk; if (!pk || pk.st !== 'hold') return; pk.st = 'lower'; pk.t = 0; phoneUi(R); }
function phoneReset(R: any) {
  const pk = R.pk; if (!pk) return;
  if (R.overlay && R.overlay.classList.contains('ph-screen')) { try { lapUnmount(); } catch (e) { /* closed */ } R.overlay.remove(); R.overlay = null; document.body.classList.remove('of-over'); }
  if (R.A && R.A.phoneAt) { R.A.phoneAt.position.copy(pk.P0); R.A.phoneAt.quaternion.copy(pk.q0); if (R.A.phoneIn) R.A.phoneIn.position.set(0, 0, 0); }
  R.pk = null; phoneUi(R);
}
function phoneUi(R: any) {
  const pk = R.pk, on = !!(pk && pk.st === 'hold' && !R.overlay);
  let b = R.root && R.root.querySelector('.of-pk') as HTMLElement;
  if (!on) { if (b) b.remove(); return; }
  if (b) return;
  b = document.createElement('div'); b.className = 'of-ph of-pk';
  b.innerHTML = `<button class="btn primary sm" data-pk="open">${icon('user')}Use the phone</button><button class="btn sm" data-pk="put">Put it down</button>
    <span class="of-pk-turn" aria-label="Turn the phone in your hand"><button class="btn sm ghost" data-pk="tl" title="Turn it left">⟲</button><button class="btn sm ghost" data-pk="tu" title="Tilt it towards you">⤒</button><button class="btn sm ghost" data-pk="td" title="Tilt it away">⤓</button><button class="btn sm ghost" data-pk="tr" title="Turn it right">⟳</button></span>`;
  b.addEventListener('pointerdown', e => e.stopPropagation());
  b.addEventListener('click', e => { const k = (e.target as HTMLElement).closest('[data-pk]'); if (!k) return; e.stopPropagation(); const v = k.getAttribute('data-pk'); if (v === 'open') phoneOpen(R); else if (v === 'put') phonePut(R); else phoneTurn(R, v === 'tl' ? -1 : v === 'tr' ? 1 : 0, v === 'tu' ? -1 : v === 'td' ? 1 : 0); });
  R.root.appendChild(b);
}
/** Put the phone down first (its animation plays to the end), then do something else: open the laptop, the monitor. */
function phoneThen(R: any, f: () => void) {
  if (!R.pk) { f(); return; }
  R.afterPhone = f;
  if (R.overlay && R.overlay.classList.contains('ph-screen')) { phoneClose(R); setTimeout(() => phonePut(R), 600); }
  else phonePut(R);
}
/** The phone's screen is up and you click beside it, on the laptop or the monitor: the phone goes down, then that opens. */
function phoneBesideAct(R: any, e: MouseEvent): string {
  try {
    if (typeof OfficeRoom !== 'undefined' && R === OfficeRoom) return ofAimed(e as any) === 'laptop' ? 'laptop' : '';
    if (typeof OpsRoom !== 'undefined' && R === OpsRoom) return opsAimed(e as any) === 'monitor' ? 'monitor' : '';
  } catch (x) { /* nothing there */ }
  return '';
}
/** Turn the phone gently in your hand, only when you choose to (a step each time, within what a wrist does). */
function phoneTurn(R: any, dy: number, dp: number) {
  const pk = R.pk; if (!pk || pk.st !== 'hold') return;
  pk.turn = pk.turn || { y: 0, p: 0 };
  pk.turn.y = clamp(pk.turn.y + dy * 0.22, -0.66, 0.66); pk.turn.p = clamp(pk.turn.p + dp * 0.16, -0.32, 0.48);
  pk.fit = null;   // the hand finds its grip again once the phone has turned
  Sound.tick();
}
/** Each frame in the chair while the phone is in play: where it is, your right hand on it, leaning to the desk. */
function phoneStep(R: any, dt: number, t: number): { lean: number; turn: number; slide: number; lookK: number; at: any; arms: any; t?: number } {
  const pk = R.pk, A = R.A, T = THREE, out = { lean: 0, turn: 0, slide: 0, lookK: 0, at: null as any, arms: null as any, t: undefined as number };
  if (!pk || !A || !A.phoneAt) return out;
  const E = (x: number) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }, D = PH_PK_D;
  pk.t += dt;
  let w = 0, mv = 0;
  if (pk.st === 'reach') { w = E(pk.t / D.reach); if (pk.t >= D.reach) { pk.st = 'lift'; pk.t = 0; } }
  else if (pk.st === 'lift') { w = 1; mv = E(pk.t / D.lift); if (pk.t >= D.lift) { pk.st = 'hold'; pk.t = 0; phoneUi(R); } }
  else if (pk.st === 'hold') { w = 1; mv = 1; }
  else if (pk.st === 'lower') { w = 1; mv = 1 - E(pk.t / D.lower); if (pk.t >= D.lower) { pk.st = 'release'; pk.t = 0; Sound.tick(); } }
  else if (pk.st === 'release') { w = 1 - E(pk.t / D.release); if (pk.t >= D.release) { R.pk = null; phoneUi(R); const f = R.afterPhone; R.afterPhone = null; if (f) setTimeout(f, 30); return out; } }
  const down = pk.st === 'reach' || pk.st === 'release' ? w : 1 - mv;
  out.lean = 0.35 * down; out.turn = -0.3 * down; out.slide = 0.08 * down;
  // in your hand: low and a little to the right, screen towards you, perfectly still (you sit still too, the
  // time your body moves by stands still while you hold it); it turns only when you turn it
  if (pk.st === 'hold') { if (pk.tf == null) pk.tf = t; out.t = pk.tf; } else if (pk.st === 'lift' || pk.st === 'lower') { if (pk.tf != null) out.t = pk.tf; } else pk.tf = null;
  const tu = pk.turn || { y: 0, p: 0 }, tc = pk.tc || (pk.tc = { y: 0, p: 0 }), ke = 1 - Math.exp(-dt * 6);
  tc.y += (tu.y - tc.y) * ke; tc.p += (tu.p - tc.p) * ke;
  const e0 = R.me && R.me.eye0 ? R.me.eye0 : new T.Vector3(0, 1.2, 1.02);
  const hold = new T.Vector3(e0.x + 0.06, e0.y - 0.2, e0.z - 0.31);
  const qh = new T.Quaternion().setFromEuler(new T.Euler(-0.32 + tc.p, 0.08 + tc.y, 0, 'YXZ'));
  const pos = pk.P0.clone().lerp(hold, mv); pos.y += 0.07 * Math.sin(Math.PI * mv);
  A.phoneAt.position.copy(pos); A.phoneAt.quaternion.copy(pk.q0).slerp(qh, mv); A.phoneAt.updateMatrixWorld(true);
  out.at = A.phoneAt.localToWorld(new T.Vector3(0, 0, 0));
  out.lookK = pk.st === 'reach' || pk.st === 'release' ? 0.85 * w : 0.9 + 0.1 * mv;
  // the right hand: from above while it lies on the desk, then holding it from behind, fingers round its left edge
  const gk = pk.st === 'reach' ? 0 : pk.st === 'lift' ? E(pk.t / D.lift * 1.6) : pk.st === 'lower' ? 1 - E((pk.t / D.lower - 0.4) / 0.6) : pk.st === 'release' ? 0 : 1;
  const settled = Math.abs(tu.y - tc.y) + Math.abs(tu.p - tc.p) < 0.01;
  if (A.phoneIn) { const cl = gk > 0.5 && pk.fit && pk.fit.done && pk.fit.clear ? pk.fit.clear : [0, 0, 0], kc = 1 - Math.exp(-dt * 6); A.phoneIn.position.x += (cl[0] - A.phoneIn.position.x) * kc; A.phoneIn.position.y += (cl[1] - A.phoneIn.position.y) * kc; A.phoneIn.position.z += (cl[2] - A.phoneIn.position.z) * kc; }
  out.arms = (m: any) => {
    const rest = humanGesture({ kind: 'sit', v: 0 }, out.t != null ? out.t : t);
    if (w < 0.002) { pk.a.R = null; return {}; }
    // held: the hand finds a grip where nothing of it goes through the phone (a few tries each frame), then keeps it
    if (gk > 0.5 && settled) phoneFit(m, A.phoneAt, pk, rest.R);
    const tgt = pk.fit && pk.fit.done ? pk.fit.best : PH_FIT0, fo = pk.fo || (pk.fo = Object.assign({}, PH_FIT0)), kf = 1 - Math.exp(-dt * 5);
    for (const key of Object.keys(PH_FIT0)) (fo as any)[key] += ((tgt as any)[key] - (fo as any)[key]) * kf;
    const g = phoneGrip(m, A.phoneAt, gk, w, rest.R, pk.a.R, fo); pk.a.R = g.R;
    return g;
  };
  return out;
}
/** Where the right hand holds the phone, in the phone's own space: the wrist, the way the fingers point and the
 *  palm faces, and how far the fingers close. On the desk the hand comes from above, thumb on the near edge and the
 *  fingers over the far one; held, the phone lies in the palm, the fingers wrap its left edge and the thumb rests
 *  on the right edge. */
const PH_GRIP = {
  desk: { w: [0.078, -0.03, 0.034], F: [-1, -0.08, -0.42], N: [0, 0, -1], curl: 0.5, th: 0, k1: 1.15, k2: 1.25 },
  hold: { w: [0.052, -0.05, -0.025], F: [-1, -0.12, 0], N: [0, 0, 1], curl: 0.85, th: -0.7, k1: 1.6, k2: 0.65 },
};
/** Small changes to the hold grip (the wrist along and off the phone, the thumb, how far the fingers close), found for
 *  each person's hand so that nothing goes through the phone. */
const PH_FIT0 = { dx: 0, dz: 0, th: 0, cs: 1 };
/** Try a few grips this frame; when all are tried, keep the best: no skin inside the phone, the palm against its
 *  back, as close to the usual grip as possible. */
function phoneFit(m: any, ph: any, pk: any, restR: number[]) {
  const T = THREE;
  if (!pk.fit) { const C: any[] = []; for (const dx of [0, -0.004, 0.006, 0.012, 0.02]) for (const dz of [0, -0.005, -0.01, -0.016, 0.003]) for (const th of [0, -0.3, -0.6, -0.9, 0.25]) for (const cs of [1, 0.85]) C.push({ dx, dz, th, cs }); pk.fit = { C, i: 0, best: null, bs: 1e9, done: false }; }
  const F = pk.fit; if (F.done) return;
  ph.updateMatrixWorld(true); m.root.updateMatrixWorld(true);
  const toPh = new T.Matrix4().copy(ph.matrixWorld).invert().multiply(m.root.matrixWorld);
  const X = 0.0415, Y = 0.0805, Z0 = -0.0145, Z1 = 0.0045;
  const test = (c: any) => {
    const g = phoneGrip(m, ph, 1, 1, restR, pk.a.R, c), pts = humanHandPts(m, 'R', g.R, g.hand.R);
    let pen = 0, inside = 0, back = 0, sx = 0, sz = 0;
    for (const p of pts) {
      const q = p.applyMatrix4(toPh), ax = Math.abs(q.x), ay = Math.abs(q.y);
      if (ax < X && ay < Y && q.z > Z0 && q.z < Z1) { inside++; pen += Math.min(X - ax, Y - ay, q.z - Z0, Z1 - q.z); sx += q.x; sz += q.z; }
      else if (ax < X && ay < Y && q.z <= Z0 && q.z > Z0 - 0.008) back++;
    }
    return { inside, sc: pen * 4000 + inside * 0.4 + Math.max(0, 40 - back) * 0.03 + (Math.abs(c.dx) + Math.abs(c.dz)) * 20 + Math.abs(c.th) * 0.6 + (1 - c.cs) * 2, sx: inside ? sx / inside : 0, sz: inside ? sz / inside : 0 };
  };
  if (F.i < F.C.length) {
    for (let n = 0; n < 10 && F.i < F.C.length; n++) { const c = F.C[F.i++], r = test(c); if (r.sc < F.bs) { F.bs = r.sc; F.best = c; F.bin = r; } }
    return;
  }
  // then, while any skin is still too close, the hand moves away from where it touches, a few millimetres a step
  F.steps = (F.steps || 0) + 1;
  const r = F.bin || test(F.best);
  if (!r.inside || F.steps > 14) { F.done = true; F.clear = phoneClear(m, ph, pk, restR, toPh, X, Y, Z0, Z1); return; }
  // try a small move each way (behind, right, left, the thumb in or out) and keep the one that touches least
  let bc: any = null, br: any = null;
  for (const d of [{ dz: -0.003 }, { dx: 0.003 }, { dx: -0.003 }, { th: -0.12 }, { th: 0.12 }, { dz: 0.002, dx: 0.003 }]) {
    const c = Object.assign({}, F.best); for (const k of Object.keys(d)) c[k] += (d as any)[k];
    if (Math.abs(c.dz) > 0.024 || Math.abs(c.dx) > 0.03 || c.th < -1.4 || c.th > 0.5) continue;
    const t = test(c), v = t.inside * 1000 + t.sc; if (!br || v < br.v) { bc = c; br = Object.assign(t, { v }); }
  }
  if (!bc || br.inside >= r.inside && br.sc >= r.sc) { F.done = true; F.clear = phoneClear(m, ph, pk, restR, toPh, X, Y, Z0, Z1); return; }
  F.best = bc; F.bin = br;
}
/** Whatever skin is still within a hair of the phone after the fit: the smallest move of the phone itself (left,
 *  right, forward or back, up to 8 mm) that takes it clear. */
function phoneClear(m: any, ph: any, pk: any, restR: number[], toPh: any, X: number, Y: number, Z0: number, Z1: number): number[] {
  const g = phoneGrip(m, ph, 1, 1, restR, pk.a.R, pk.fit.best), pts = humanHandPts(m, 'R', g.R, g.hand.R).map((p: any) => p.applyMatrix4(toPh)).filter((q: any) => Math.abs(q.x) < X && Math.abs(q.y) < Y && q.z > Z0 && q.z < Z1);
  if (!pts.length) return [0, 0, 0];
  // each way the phone could move, and how far it must go for every point to be outside it
  const c: [number, number[]][] = [
    [Math.max(...pts.map((q: any) => X - q.x)), [-1, 0, 0]], [Math.max(...pts.map((q: any) => X + q.x)), [1, 0, 0]],
    [Math.max(...pts.map((q: any) => q.z - Z0)), [0, 0, 1]], [Math.max(...pts.map((q: any) => Z1 - q.z)), [0, 0, -1]]];
  c.sort((a, b) => a[0] - b[0]);
  const a = Math.min(0.008, c[0][0] + 0.0005); return c[0][1].map(v => v * a);
}
/** The right arm and hand on the phone: k 0 the desk grip … 1 the hold, w how far the hand has come (0 at rest);
 *  fo: the held grip's changes for this hand (phoneFit). */
function phoneGrip(m: any, ph: any, k: number, w: number, restR: number[], prev?: number[], fo?: any): any {
  const T = THREE, G0 = PH_GRIP.desk, G1 = PH_GRIP.hold, V = (a: number[]) => new T.Vector3(a[0], a[1], a[2]), f = fo || PH_FIT0;
  ph.updateMatrixWorld(true); m.root.updateMatrixWorld(true);
  const toRoot = new T.Matrix4().copy(m.root.matrixWorld).invert().multiply(ph.matrixWorld), rot = new T.Matrix3().setFromMatrix4(toRoot);
  const wl = V(G0.w).lerp(V(G1.w).add(new T.Vector3(f.dx, 0, f.dz)), k).applyMatrix4(toRoot);
  // from one grip to the other the hand turns (the two frames blended as turns, so it never folds through itself)
  const frame = (G: any) => { const f = V(G.F).normalize(), n = V(G.N).sub(f.clone().multiplyScalar(V(G.N).dot(f))).normalize(); return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(f, n, f.clone().cross(n))); };
  const qf = frame(G0).slerp(frame(G1), k), Mf = new T.Matrix4().makeRotationFromQuaternion(qf);
  const Fd = new T.Vector3(1, 0, 0).applyMatrix4(Mf).applyMatrix3(rot).normalize(), Nd = new T.Vector3(0, 1, 0).applyMatrix4(Mf).applyMatrix3(rot).normalize();
  // the wrist on its way from where it rests to the grip
  const J = m.joints.R, from = humanHandAt(m, 'R', restR, undefined, J.w), to = from.lerp(wl, w);
  const R = humanReach(m, 'R', to, prev || restR, J.w);
  const W = humanHandAim(m, 'R', R, Fd, Nd), q = new T.Quaternion().setFromRotationMatrix(new T.Matrix4().setFromMatrix3(W));
  q.slerp(new T.Quaternion(), 1 - Math.min(1, w * 1.25));
  const curl = (G0.curl + (G1.curl * f.cs - G0.curl) * k) * Math.max(0, Math.min(1, (w - 0.55) / 0.45));
  const th = (G0.th + (G1.th + f.th - G0.th) * k) * Math.min(1, w);
  return { R, hand: { R: { W: new T.Matrix3().setFromMatrix4(new T.Matrix4().makeRotationFromQuaternion(q)), curl: Math.max(curl, 0.001), th, k1: G0.k1 + (G1.k1 - G0.k1) * k, k2: G0.k2 + (G1.k2 - G0.k2) * k } } };
}
/** The phone's screen on your screen, as it is held now. */
function phoneRect(R: any): { x: number; y: number; w: number; h: number } {
  const T = THREE, S = R.A.phoneScr, rr = R.root.getBoundingClientRect(), z = (window as any).__uiZoom || 1;
  const [w, h] = S.userData.size; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [x, y] of [[-w / 2, -h / 2], [w / 2, -h / 2], [-w / 2, h / 2], [w / 2, h / 2]]) {
    const v = S.localToWorld(new T.Vector3(x, y, 0)).project(R.cam), sx = (v.x + 1) / 2 * rr.width / z, sy = (1 - v.y) / 2 * rr.height / z;
    x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
  }
  return { x: x0, y: y0, w: Math.max(20, x1 - x0), h: Math.max(40, y1 - y0) };
}
/** The phone on the screen is laid out at a real phone's size (400 by 858) and then shrunk to fit whatever it is
 *  shown on, so on a small screen (a phone in landscape) everything in it is smaller in step, never cut off. */
const PH_W = 400, PH_H = 858;
function phoneFitScreen(ov: any) {
  const z = (window as any).__uiZoom || 1, rr = ov.getBoundingClientRect(), w = rr.width / z, h = rr.height / z;
  const k = Math.min(1, (h * 0.94) / PH_H, (w * 0.92) / PH_W);
  ov.style.setProperty('--phz', String(Math.max(0.2, Math.round(k * 1000) / 1000)));
}
function phoneZoomOf(ov: any): number { return +(ov && ov.style.getPropertyValue('--phz')) || 1; }
/** Tap the phone in your hand: its screen comes up to you, still a phone in its frame, to scroll and tap. */
function phoneOpen(R: any) {
  if (!R.on || R.overlay || !R.pk || R.pk.st !== 'hold') return;
  Sound.tick(); aimUnlock();
  for (const sel of ['.of-spots', '.ct-box', '.ct-pad', '.ct-hint', '.of-aim', '.op-ui', '.op-dot', '.op-pad']) { const e = R.root.querySelector(sel) as HTMLElement; if (e) e.hidden = true; }
  const from = phoneRect(R);
  const ov = document.createElement('div'); ov.className = 'ph-screen';
  ov.innerHTML = `<div class="ph-frame"><div class="ph-glass"></div><span class="ph-glare"></span><span class="ph-cam"></span><button class="ph-side" data-pk="close" aria-label="Lower the phone" title="Lower the phone (Esc)"></button></div>`;
  // the glare on the glass moves a little with your hand and with the pointer, as light does on a real screen
  const glr = () => { const fr0 = ov.querySelector('.ph-frame') as HTMLElement; if (!fr0 || !ov.isConnected) return; const t = performance.now() / 1000; fr0.style.setProperty('--gx', (ov as any)._gx + 6 * Math.sin(t * 0.7) + '%'); fr0.style.setProperty('--gy', (ov as any)._gy + 4 * Math.sin(t * 0.53 + 1) + '%'); requestAnimationFrame(glr); };
  (ov as any)._gx = 0; (ov as any)._gy = 0;
  ov.addEventListener('pointermove', e => { const r = ov.getBoundingClientRect(); (ov as any)._gx = ((e.clientX - r.left) / r.width - 0.5) * 40; (ov as any)._gy = ((e.clientY - r.top) / r.height - 0.5) * 30; });
  requestAnimationFrame(glr);
  R.root.appendChild(ov); R.overlay = ov; document.body.classList.add('of-over'); phoneUi(R);
  phoneFitScreen(ov); (ov as any)._fit = () => phoneFitScreen(ov); window.addEventListener('resize', (ov as any)._fit);
  ov.addEventListener('click', e => {
    const t = e.target as HTMLElement; if (!(t === ov || t.closest('[data-pk=close]'))) return;
    e.stopPropagation();
    const a = t === ov ? phoneBesideAct(R, e) : '';
    if (a === 'laptop') phoneThen(R, () => ofLaptopOpen());
    else if (a === 'monitor') phoneThen(R, () => opsScreenOpen(R.tab || 'schedule'));
    else phoneClose(R);
  });
  try { lapMount(ov.querySelector('.ph-glass') as HTMLElement, true); } catch (e) { (ov.querySelector('.ph-glass') as HTMLElement).innerHTML = '<p class="muted">The phone could not start.</p>'; }
  const fr = ov.querySelector('.ph-frame') as HTMLElement, z = (window as any).__uiZoom || 1, rr = R.root.getBoundingClientRect(), b = fr.getBoundingClientRect();
  const tx = { x: (b.left - rr.left) / z, y: (b.top - rr.top) / z, w: b.width / z, h: b.height / z };
  fr.style.transformOrigin = '0 0'; fr.style.transition = 'none';
  const k0 = phoneZoomOf(ov); fr.style.transform = `translate(${(from.x - tx.x) / k0}px, ${(from.y - tx.y) / k0}px) scale(${from.w / tx.w}, ${from.h / tx.h})`; ov.classList.add('in');
  void fr.offsetWidth;
  requestAnimationFrame(() => { fr.style.transition = ''; fr.classList.add('go'); fr.style.transform = 'none'; });
  setTimeout(() => { if (fr.isConnected && !ov.classList.contains('out')) fr.style.transform = 'none'; }, 700);   // in any case, in its place
}
function phoneClose(R: any) {
  const ov = R.overlay; if (!ov || !ov.classList.contains('ph-screen') || ov.classList.contains('out')) return;
  Sound.tick(); try { lapUnmount(); } catch (e) { /* closed */ }
  const fr = ov.querySelector('.ph-frame') as HTMLElement, to = phoneRect(R), z = (window as any).__uiZoom || 1, rr = R.root.getBoundingClientRect(), b = fr.getBoundingClientRect();
  const cur = { x: (b.left - rr.left) / z, y: (b.top - rr.top) / z, w: b.width / z, h: b.height / z };
  if (ov._fit) window.removeEventListener('resize', ov._fit);
  const k1 = phoneZoomOf(ov); ov.classList.add('out'); ov.classList.remove('in'); fr.style.transform = `translate(${(to.x - cur.x) / k1}px, ${(to.y - cur.y) / k1}px) scale(${to.w / cur.w}, ${to.h / cur.h})`;
  setTimeout(() => { ov.remove(); if (R.overlay === ov) R.overlay = null; document.body.classList.remove('of-over'); phoneUi(R); try { if (R.phoneAfter) R.phoneAfter(); } catch (e) { /* ui */ } }, 560);
}


/** Glass over a screen in a room (the laptop, the Operations monitor): dark, smooth and a little reflective, so the
 *  room's light glints off it and slides over it as you move; the picture shows through, only a touch darker. */
function roomGlassMat(T: any, opacity: number): any {
  return new T.MeshPhysicalMaterial({ color: 0x000000, metalness: 0, roughness: 0.04, transparent: true, opacity, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.7, depthWrite: false, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1 });
}
