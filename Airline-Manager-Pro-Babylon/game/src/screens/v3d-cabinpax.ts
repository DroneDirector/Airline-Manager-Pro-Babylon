/* Boarding and deboarding, seen in the cabin.
 *  - Deboarding (at the gate after landing): row by row, mostly from the front and a little mixed, people rise from
 *    their seats: the one on the aisle first, then the middle seat, then the window, a few seconds apart, each
 *    stepping into the aisle only when there is room. They walk forward through the galley to the door and fade
 *    out there (there is no jet bridge inside to walk into).
 *  - Boarding (at the gate before departure): people come in through the front door (fading in there), walk down
 *    the aisle to the seat on the passenger list (rows and letters as on the boarding pass, shown above the seats),
 *    stop to stow their bag, step into the row and sit down. The back rows board first and the window seats before
 *    the middle and aisle, so nobody has to get up again.
 *  - Nobody walks through anybody: in the aisle and the galley they keep their distance and wait until the way is
 *    clear.
 *  - The pace is the real one: about 20 to 25 people a minute leave through a door; about 10 a minute board
 *    (bags take time). A pushback with people still boarding seats them at once. */

const CabinPax: any = { key: '', mode: '', t0: 0 };

/** The pose of one person: where they stand (root x, y, along and across the cabin), which way they face (yaw 0 =
 *  forward), how far they are into sitting (k: 0 standing … 1 seated), their stride (ph) and how much they are
 *  walking (w), and how visible they are (a). */
function cabinPaxPose(G: any, f: any, x: number, y: number, yaw: number, k: number, ph: number, w: number, a: number) {
  f.pose = { x, y, yaw, k, ph, w, a };   // kept for the detailed figure (v3d-cabin's nearby passengers)
  if (f.hd) a *= 1 - f.hd.mix;            // shown by the detailed figure instead (fading over to it)
  const T = THREE, P = G.userData.people.userData.parts, zf = G.userData.people.userData.zf, S = f.sc, at = f.at;
  const V = (bx: number, by: number, bz: number) => _av(bx, by, bz);
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  // positions are worked out facing forward (−x) around the root, then turned to the way they face
  const put = (m: any, i: number, lx: number, ly: number, lz: number, rot: number[], sc: number[]) => {
    if (i < 0) return;
    const dx = lx - x, dy = ly - y, px = x + dx * cy - dy * sy, py = y + dx * sy + dy * cy;
    const q = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), yaw).multiply(new T.Quaternion().setFromEuler(new T.Euler(rot[0], rot[1], rot[2])));
    const M = new T.Matrix4().compose(V(px, py, lz), q, new T.Vector3(sc[0], sc[1], sc[2])); m.setMatrixAt(i, M);
    const fa = m.geometry.attributes.aFade; if (fa) { fa.setX(i, a); fa.needsUpdate = true; }
    m.instanceMatrix.needsUpdate = true;
  };
  // the hips: standing over the feet, or back and down into the seat
  const hipStandZ = zf + 0.86 * S, hipSeatZ = zf + 0.53, hipSeatX = at.x + 0.09;
  const hx = k > 0 ? x + (hipSeatX - x) * k : x, hz = hipStandZ + (hipSeatZ - hipStandZ) * k;
  // legs: thighs swing when walking, fold forward to sit; the lower legs reach the floor
  for (let i = 0; i < 2; i++) {
    const sd = i ? 1 : -1, sw = w * 0.38 * Math.sin(ph + (sd > 0 ? Math.PI : 0)), th = k * Math.PI / 2 + sw;
    const kx = hx - Math.sin(th) * 0.42 * S, kz = hz - Math.cos(th) * 0.42 * S, ly = y + sd * 0.09 * S;
    put(P.thighs, f.gi + i, (hx + kx) / 2, ly, (hz + kz) / 2, [0, 0, -th], [S, S, S]);
    const phi = k > 0.02 ? 0 : sw * 0.5 - w * 0.12 * Math.max(0, Math.sin(ph + (sd > 0 ? Math.PI : 0) + 1.2));
    const len = k > 0.02 ? Math.max(0.05, kz - zf) : Math.max(0.05, Math.min(0.46 * S, kz - zf));
    const fx2 = kx - Math.sin(phi) * len, fz2 = kz - Math.cos(phi) * len;
    put(P.shins, f.si + i, (kx + fx2) / 2, ly, (kz + fz2) / 2, [0, 0, -phi], [S, len / 0.42, S]);
  }
  // the body: upright when standing (a slight lean walking), bending forward on the way down, back in the seat
  const lean = (0.04 * w) + (f.lean - 0.04 * w) * k + 0.35 * Math.sin(Math.PI * k);
  const bx = hx + (-0.135) * k, bz = hz + (-0.03 - 0.02 * (1 - k)) ;
  put(P.torso, f.ti, bx, y, bz, [0, 0, lean], [S * f.fem, S, S]);
  const shZ = bz + 0.56 * S, headX = bx - Math.sin(lean) * 0.6 * S;
  put(P.neck, f.ni, headX, y, shZ + 0.05 * S, [0, 0, lean], [S, S, S]);
  put(P.head, f.hi, headX - 0.01, y, shZ + 0.16 * S, [0, 0, lean * 0.5], [S, S, S]);
  const hk = f.hairK === 1 ? [1.25, 1.2, 1.25] : f.hairK === 2 ? [0.97, 0.97, 0.97] : [1, 1, 1];
  put(P.hair, f.ri, headX + 0.012, y, shZ + (f.hairK === 2 ? 0.17 : 0.175) * S, [0, 0, lean * 0.5 - 0.25], [S * hk[0], S * hk[1], S * hk[2]]);
  put(P.long, f.li, headX + 0.05, y, shZ + 0.04 * S, [0, 0, lean], [S, S, S]);
  // arms: hanging and swinging opposite the legs when walking, forward onto the lap when seated
  for (let i = 0; i < 2; i++) {
    const sd = i ? 1 : -1, sw = -w * 0.32 * Math.sin(ph + (sd > 0 ? 0 : Math.PI));
    put(P.arms, f.ai + i, bx - 0.06 * k, y + sd * 0.2 * S, bz + 0.3 * S, [sd * 0.08, 0, sw + (-0.5 - sw) * k], [S, S, S]);
  }
  // a pet stays on the lap only while they're seated
  if (f.pet) { const vis = k > 0.98 && a > 0.99; for (const [m, i] of [[P.petB, f.pet.b], [P.petH, f.pet.h], [P.ears, f.pet.e], [P.ears, f.pet.e + 1]]) { const fa = m.geometry.attributes.aFade; if (fa) { fa.setX(i, vis ? 1 : 0); fa.needsUpdate = true; } } }
}

/** Each frame in the cabin: who is boarding or leaving, and where everyone is. */
function cabinPaxStep(P: any, G: any, dt: number) {
  const pg = G.userData.people; if (!pg || !pg.userData.figs || !pg.userData.figs.length) return;
  const C = CabinPax, ph = String(P.ph || ''), kt = +P.kt || 0, now = performance.now() / 1000;
  if (/climb|cruise|descent|approach|final|take-?off|lift-?off|landing|touchdown|flare/.test(ph)) P._air = true;
  const arrived = !!P._air && /arriv|park|gate|deboard|turnaround/.test(ph) && kt < 2;
  const boarding = !P._air && /park|gate|board|sched|preflight|before/.test(ph) && !/push|taxi/.test(ph);
  const mode = arrived ? 'deboard' : boarding ? 'board' : 'fly';
  if (C.key !== pg.uuid) { C.key = pg.uuid; C.mode = ''; C.list = null; }
  if (mode !== C.mode) cabinPaxStart(P, G, pg, mode, now);
  if (!C.list) return;
  const at = G.userData.crewAt; if (!at) return;
  const doorX = at.x0 + 0.7, doorY = -at.half + 0.45, galX = doorX;   // the galley, beside the door
  const L: any[] = C.list, aisleOf = (y: number) => { const a = at.aisles && at.aisles.length ? at.aisles : [at.aisleY]; let b = a[0]; for (const v of a) if (Math.abs(v - y) < Math.abs(b - y)) b = v; return b; };
  // who is in each aisle or in the galley, and where (nobody walks through anybody)
  // everyone up and about counts as being in the way (in the aisle, the galley or at the door)
  const inAisle = (e: any) => !/^(seat|away|wait|rise|queue|sit)$/.test(e.st);
  const blockedAhead = (e: any, dir: number) => { for (const o of L) { if (o === e || o.a < 0.3) continue; if (inAisle(o) && Math.abs(o.y - e.y) < 0.3) { const d = (o.x - e.x) * dir; if (d > 0 && d < 0.66) return true; } } return false; };
  const aisleFree = (x: number, y: number, e: any) => { for (const o of L) { if (o === e || o.a < 0.3) continue; if (inAisle(o) && Math.abs(o.y - y) < 0.3 && Math.abs(o.x - x) < 0.62) return false; } return true; };
  const galleyFree = (e: any, tx: number, ty: number) => { const dx = tx - e.x, dy = ty - e.y, l = Math.hypot(dx, dy) || 1; for (const o of L) { if (o === e || o.a < 0.2 || !inAisle(o)) continue; const ox = o.x - e.x, oy = o.y - e.y, along = (ox * dx + oy * dy) / l, side = Math.abs(ox * dy - oy * dx) / l; if (along > 0 && along < 0.6 && side < 0.4) return false; } return true; };
  const move = (e: any, tx: number, ty: number, v: number) => { const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy); if (d < 1e-4) return true; const s = Math.min(d, v * dt); e.x += dx / d * s; e.y += dy / d * s; e.ph += s / 0.7 * Math.PI; return d - s < 0.01; };
  const faceTo = (e: any, dx: number, dy: number) => face(e, Math.atan2(-dy, -dx));   // yaw 0 faces forward (−x)
  const face = (e: any, want: number) => { let d = want - e.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; e.yaw += d * Math.min(1, dt * 5); };
  for (const e of L) {
    if (e.st === 'seat' || e.st === 'away') continue;
    const f = e.f, rowX = f.at.x - 0.17, ay = e.aisle;
    let w = 0;
    switch (e.st) {
      // leaving: stand up when it's their turn and the people between them and the aisle have gone
      case 'wait': if (now >= e.ready && e.before.every((b: any) => b.st !== 'seat' && b.st !== 'rise' && b.st !== 'side')) { e.st = 'rise'; e.k = 1; } break;
      case 'rise': e.k = Math.max(0, e.k - dt / 1.5); e.x = rowX; if (e.k <= 0) e.st = 'side'; break;
      case 'side': if (Math.abs(e.y - ay) < 0.42 && !aisleFree(rowX, ay, e)) break; face(e, 0); if (move(e, rowX, ay, 0.5)) { e.st = 'outAisle'; } w = 0.5; break;   // sideways along the row, facing forward
      case 'outAisle': face(e, 0); if (!blockedAhead(e, -1)) { if (move(e, galX, ay, 0.85)) e.st = 'galley'; w = 1; } break;
      case 'galley': { faceTo(e, doorX - e.x, doorY - e.y); if (galleyFree(e, doorX, doorY)) { if (move(e, doorX, doorY, 0.8)) e.st = 'door'; w = 1; } break; }
      case 'door': if (now - C.lastDoor > C.doorGap) { C.lastDoor = now; e.st = 'fadeOut'; } break;
      case 'fadeOut': e.a = Math.max(0, e.a - dt / 1.1); move(e, doorX - 0.4, doorY - 0.5, 0.6); w = 1; if (e.a <= 0) { e.st = 'away'; } break;
      // boarding: in at the door, down the aisle, stow the bag, into the row, sit down
      case 'queue': if (now >= e.ready && now - C.lastDoor > C.doorGap && galleyFree(e, galX, ay)) { C.lastDoor = now; e.st = 'fadeIn'; e.x = doorX - 0.4; e.y = doorY - 0.5; e.a = 0; e.k = 0; } break;
      case 'fadeIn': e.a = Math.min(1, e.a + dt / 1.1); faceTo(e, doorX - e.x, doorY - e.y); if (move(e, doorX, doorY, 0.7)) e.st = 'toGalley'; w = 1; break;
      case 'toGalley': faceTo(e, galX - e.x, ay - e.y); e.a = Math.min(1, e.a + dt / 1.1); if (galleyFree(e, galX, ay)) { if (move(e, galX, ay, 0.8)) e.st = 'walk'; w = 1; } break;
      case 'walk': face(e, Math.PI); if (!blockedAhead(e, 1)) { if (move(e, rowX, ay, 0.85)) { e.st = 'stow'; e.stowUntil = now + 3 + Math.random() * 6; } w = 1; } break;
      case 'stow': faceTo(e, 0, Math.sign(f.at.y - ay) || 1); if (now > e.stowUntil && e.inner.every((b: any) => b.st === 'seat' || b.st === 'sit')) e.st = 'turnIn'; break;   // facing the row while the bag goes up
      case 'turnIn': face(e, 0); if (move(e, rowX, f.at.y, 0.45)) { e.st = 'sit'; e.k = 0; } w = 0.5; break;
      case 'sit': face(e, 0); e.k = Math.min(1, e.k + dt / 1.6); if (e.k >= 1) { e.st = 'seat'; e.k = 1; } break;
    }
    cabinPaxPose(G, f, e.st === 'sit' || e.st === 'rise' ? rowX : e.x, e.y, e.yaw, e.k, e.ph, w, e.a);
  }
}

/** A new stage: everyone in place for it (seated in flight; seated or still to come when boarding; seated or already
 *  gone when deboarding, from how long it has been going on), and the order they will move in. */
function cabinPaxStart(P: any, G: any, pg: any, mode: string, now: number) {
  const C = CabinPax, figs: any[] = pg.userData.figs, at = G.userData.crewAt; C.mode = mode; C.lastDoor = -99;
  const aisles = at && at.aisles && at.aisles.length ? at.aisles : [at ? at.aisleY : 0];
  const aisleOf = (y: number) => { let b = aisles[0]; for (const v of aisles) if (Math.abs(v - y) < Math.abs(b - y)) b = v; return b; };
  const L = figs.map(f => ({ f, st: 'seat', x: f.at.x - 0.17, y: f.at.y, yaw: 0, k: 1, ph: 0, a: 1, aisle: aisleOf(f.at.y), row: parseInt(f.p.seat, 10) || 0, ready: 0, before: [] as any[], inner: [] as any[], boarding: false }));
  // the people between each seat and its aisle (they go first when leaving); those further in (first when boarding)
  for (const e of L) for (const o of L) { if (o === e || o.row !== e.row || Math.sign(o.f.at.y - e.aisle) !== Math.sign(e.f.at.y - e.aisle)) continue; const de = Math.abs(e.f.at.y - e.aisle), dO = Math.abs(o.f.at.y - e.aisle); if (dO < de - 0.05) e.before.push(o); else if (dO > de + 0.05) e.inner.push(o); }
  const n = L.length, rnd = (s: number) => cloudHash(s * 13 + 7, s * 3 + 1, 77);
  if (mode === 'fly') {
    // seated for the flight (and anyone still standing sits at once, e.g. at pushback)
    for (const e of L) cabinPaxPose(G, e.f, e.x, e.y, 0, 1, 0, 0, 1);
    C.list = null; return;
  }
  const t: any = (State.live || []).filter((x: any) => x.id === P.id)[0] || {}, pax = n;
  if (mode === 'deboard') {
    // the doors open about a minute after the engines stop; people leave at 20 to 25 a minute through the door
    C.doorGap = 60 / 22;
    if (!P._debT0) P._debT0 = now;
    const elapsed = now - P._debT0 - 45;
    const order = L.slice().sort((a, b) => (a.row + rnd(a.row) * 3) - (b.row + rnd(b.row) * 3) || a.before.length - b.before.length);
    order.forEach((e, i) => { const at0 = i * C.doorGap * 0.92; e.st = at0 < elapsed - 20 ? 'away' : 'wait'; e.ready = P._debT0 + 45 + Math.max(0, at0 - 25) + e.before.length * (2 + rnd(i) * 2); if (e.st === 'away') { e.a = 0; e.k = 0; } });
  } else {
    // boarding: about 10 people a minute (bags take time), back rows first, window seats first in each row
    C.doorGap = 60 / (pax < 60 ? 12 : 10);
    const dep = t.depAt || 0, total = pax * C.doorGap + 120;
    if (!P._brdT0) P._brdT0 = dep ? (performance.now() / 1000) - Math.max(0, (Date.now() - (dep - 5 * 60e3 - total * 1000)) / 1000) : now;
    const elapsed = now - P._brdT0;
    const order = L.slice().sort((a, b) => (b.row + rnd(b.row) * 4) - (a.row + rnd(a.row) * 4) || a.inner.length - b.inner.length);
    order.forEach((e, i) => { const at0 = i * C.doorGap; e.boarding = true; if (at0 < elapsed - 60) { e.st = 'seat'; } else { e.st = 'queue'; e.ready = P._brdT0 + at0; e.a = 0; e.k = 0; e.x = at.x0 + 0.3; e.y = -at.half + 0.4; } });
  }
  for (const e of L) cabinPaxPose(G, e.f, e.x, e.y, e.yaw, e.k, 0, 0, e.a);
  C.list = L; void pax;
}

/* ---------- the passengers near you, in full detail ----------
 * The passengers in the rows around you are the same detailed figures as your staff (graphics/human.ts): the same
 * bodies, and the face, hair and clothes from the passenger list (the very look its pictures are drawn from). Further
 * away the simple figures stand in, as nobody can tell the difference there. As you move about the cabin the
 * detailed ones follow you, a few at a time, so the view never stalls. They sit, rise, walk and fade as the
 * others do (cabinPaxStep). How many: Settings → 3D view → Cabin quality. */
const CabinHD: any = { key: '', last: 0 };
function cabinHdMax(): number { return cabinHdCount(); }
const CABIN_HD_Q = ['Light', 'Normal', 'High', 'Highest'];
/** How finely each detailed passenger is made (Settings → Graphics → Cabin; auto follows the cabin quality, lighter on
 *  devices with little memory). */
function cabinHdDetail(): number {
  const v = cabinOpt('cabHdQ'); if (v !== 'auto') return [0.35, 0.5, 0.7, 0.9][clamp(+v, 0, 3)];
  const q = cabinQ(); return q === 3 ? 0.9 : cabinIsPc() ? [0.5, 0.7, 0.8][q] : 0.35;
}
function cabinHdStep(G: any, dt: number) {
  const pg = G.userData.people; if (!pg || !pg.userData.figs || !Human || !V3d.cam) return;
  const T = THREE, H = CabinHD, figs: any[] = pg.userData.figs, zf = pg.userData.zf;
  if (H.key !== pg.uuid) { cabinHdFree(); H.key = pg.uuid; H.built = []; }
  if (!Human.ready) { if (!H.loading) { H.loading = true; Human.load().then(() => { H.loading = false; }, () => { H.loading = false; }); } return; }
  // where you are, in the cabin's own measures
  G.updateMatrixWorld(); const cam = G.worldToLocal(V3d.cam.position.clone()), cx = cam.x, cy = -cam.z;
  const dist = (f: any) => { const p = f.pose || { x: f.at.x - 0.17, y: f.at.y }; return Math.hypot(p.x - cx, (p.y - cy) * 0.6); };
  const want = figs.filter(f => !f.pose || f.pose.a > 0.01).map(f => [dist(f), f] as [number, any]).sort((a, b) => a[0] - b[0]).slice(0, cabinHdMax()).map(x => x[1]);
  // those no longer near fade back to the simple figure; the nearest missing one is built (one at a time, and
  // only while you stand still, so walking stays smooth)
  for (const f of figs) if (f.hd) f.hd.leave = want.indexOf(f) < 0 && dist(f) > 2.5;
  const now = performance.now(), moved = H.cam ? Math.hypot(cx - H.cam[0], cy - H.cam[1]) / Math.max(0.016, dt) : 0; H.cam = [cx, cy];
  H.still = moved < 0.25 ? (H.still || 0) + dt : 0;
  if (H.still > 0.35 && now - H.last > (cabinLowMem() ? 400 : 120)) { const f = want.filter(x => !x.hd)[0]; if (f) { H.last = now; try { cabinHdBuild(f, G); } catch (e) { f.hdFail = true; } } }
  // the fade between the two: the detailed figure comes in over the simple one, or goes, in about half a second
  for (const f of figs) {
    const h = f.hd; if (!h) continue;
    h.mix = Math.max(0, Math.min(1, h.mix + (h.leave ? -1 : 1) * dt * 2));
    if (h.leave && h.mix <= 0) { cabinHdDrop(f, G); continue; }
    const base = f.pose ? f.pose.a : 1;
    for (const [m, i] of cabinHdParts(f, G)) { const fa = m.geometry.attributes.aFade; if (fa) { fa.setX(i, base * (1 - Math.min(1, h.mix * 1.4))); fa.needsUpdate = true; } }
  }
  // pose every detailed passenger as their simple figure would be
  const t = now / 1000;
  for (const f of figs) {
    if (!f.hd) continue;
    const ps = f.pose || { x: f.at.x - 0.17, y: f.at.y, yaw: 0, k: 1, ph: 0, w: 0, a: 1 }, h = f.hd, m = h.m;
    const k = ps.k, sk = k * k * (3 - 2 * k), top = m.top || 1.7, seatTop = zf + 0.645;   // the hip joints a hand's width above the cushion (its top is 0.55 m up), so the thighs rest on it
    // the hips back into the seat when seated
    const hx = ps.x + ((f.at.x + 0.07) - ps.x) * sk;   // back in the seat, knees clear of the seat in front
    h.pivot.position.copy(_av(hx, ps.y, zf + sk * (seatTop - zf)));
    h.holder.position.y = -sk * top * 0.52;
    h.pivot.rotation.y = Math.atan2(-Math.cos(ps.yaw), Math.sin(ps.yaw));   // facing forward along the cabin when yaw is 0
    h.pivot.scale.setScalar(f.sc);
    const tt = t + h.t0, walk = humanGesture({ kind: 'walk', v: 1 }, ps.ph / 5.65), sit = humanGesture({ kind: 'sit', v: 0 }, tt);
    let g = cabinLerpG(humanGesture(null, tt), walk, Math.min(1, ps.w || 0));
    g = cabinLerpG(g, sit, sk);
    // in an aircraft seat: the thighs slope gently down over the front of the cushion and the shins go slightly
    // forward to the floor, so knees, shins and feet stay clear of the seat (not straight out through its edge)
    if (sk > 0 && g.legs) { const SEAT = [-1.36, 1.12, -1.36, 1.12]; g.legs = g.legs.map((v: number, i: number) => v + (SEAT[i] - (sit.legs ? sit.legs[i] : v)) * sk); }
    if (f.p && (f.p as any).drunk) { const dk = clamp((f.p as any).drunk / 1.8, 0.3, 1); g.roll = (g.roll || 0) + 0.08 * dk * Math.sin(tt * 0.9); g.nod = (g.nod || 0) + 0.18 * dk + 0.06 * Math.sin(tt * 0.5); g.tilt = (g.tilt || 0) + 0.1 * dk * Math.sin(tt * 0.4); }   // drunk: slumped, head lolling
    h.g = h.g ? cabinLerpG(h.g, g, Math.min(1, dt * 7)) : g;
    m.pose({ t: tt, yaw: 0, gaze: [Math.sin(tt * 0.27 + h.t0) * 0.3, 0], blink: (tt % 4.3) < 0.12 ? 1 : 0, g: h.g, talk: f.p ? cabinTalkJaw('pax:' + f.p.key) : 0 });
    cabinHdFade(h, ps.a * h.mix);
  }
}
function cabinHdBuild(f: any, G: any) {
  const T = THREE, L = dressed(f.p.look, 'fa' as any);   // exactly as the passenger list draws them
  const m = Human.build(L, 'fa', '#2C8CFF', av3Style(), cabinHdDetail());
  const pivot = new T.Group(), holder = new T.Group(); holder.add(m.root); pivot.add(holder); G.add(pivot);
  m.root.traverse((o: any) => { o.frustumCulled = false; o.renderOrder = 41; });
  f.hd = { m, pivot, holder, t0: Math.random() * 10, a: -1, mix: 0, leave: false };
  cabinHdFade(f.hd, 0);
}
function cabinHdDrop(f: any, G: any) {
  const h = f.hd; if (!h) return; f.hd = null;
  G.remove(h.pivot); h.pivot.traverse((o: any) => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((mm: any) => mm.dispose()); });
  const ps = f.pose; if (ps) cabinPaxPose(G, f, ps.x, ps.y, ps.yaw, ps.k, ps.ph, ps.w, ps.a); else cabinHdShowSimple(f, G);
}
function cabinHdFree() { /* the cabin group is thrown away with everything in it */ }
/** The simple figure steps aside for the detailed one (and comes back when it goes). */
function cabinHdParts(f: any, G: any): [any, number][] {
  const P = G.userData.people.userData.parts, out: [any, number][] = [[P.torso, f.ti], [P.neck, f.ni], [P.head, f.hi], [P.hair, f.ri], [P.long, f.li], [P.arms, f.ai], [P.arms, f.ai + 1], [P.thighs, f.gi], [P.thighs, f.gi + 1], [P.shins, f.si], [P.shins, f.si + 1]];
  return out.filter(x => x[1] >= 0);
}
function cabinHdHideSimple(f: any, G: any) { for (const [m, i] of cabinHdParts(f, G)) { const fa = m.geometry.attributes.aFade; if (fa) { fa.setX(i, 0); fa.needsUpdate = true; } } }
function cabinHdShowSimple(f: any, G: any) { for (const [m, i] of cabinHdParts(f, G)) { const fa = m.geometry.attributes.aFade; if (fa) { fa.setX(i, 1); fa.needsUpdate = true; } } }
/** Fading at the door: the figure's own materials go see-through (the hair, drawn its own way, goes when faint). */
function cabinHdFade(h: any, a: number) {
  if (Math.abs((h.a == null ? 1 : h.a) - a) < 0.01) return; h.a = a;
  h.pivot.visible = a > 0.02;
  h.pivot.traverse((o: any) => { if (!o.material) return; for (const mm of Array.isArray(o.material) ? o.material : [o.material]) { if (mm.isShaderMaterial) { o.visible = a > 0.5; continue; } mm.transparent = a < 0.999; mm.opacity = a; mm.depthWrite = a > 0.6; } });
}
