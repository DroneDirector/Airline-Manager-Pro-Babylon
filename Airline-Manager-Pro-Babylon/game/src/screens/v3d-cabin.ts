/* The cabin window views (3D view → Window L / Window R): you sit in a window seat over the wing and look
 * out of the side window, with the wing tip in the middle of the window. Around it, the cabin: the wall
 * panel with the window's deep rounded frame, the pulled-up shade, the overhead bin above, the seat in
 * front and the armrest. Built once for the aircraft type and side, simply enough for any tablet. */

const V3dCabin: any = { key: '', grp: null };

/** How each family's cabin looks, after the real ones (our own drawing, no makers' designs copied):
 *  window size (m) and corner rounding, the shade, the overhead bins, the walls' and seats' colours and the
 *  mood light. */
interface CabinStyle { ww: number; wh: number; round: number; shade: 'blind' | 'dim' | 'none'; bin: 'square' | 'sculpted' | 'pivot' | 'small' | 'none'; wall: number; trim: number; seat: number; head: number; mood: number; ceil: number }
const CABIN_STYLES: { [k: string]: CabinStyle } = {
  airbus: { ww: 0.23, wh: 0.33, round: 0.4, shade: 'blind', bin: 'square', wall: 0xE4E2DD, trim: 0x9AA0A8, seat: 0x2B3E5C, head: 0xA9B9CC, mood: 0xFFE9C8, ceil: 2.15 },     // A320 family: tall flat-sided bins, squarer windows
  a350: { ww: 0.28, wh: 0.39, round: 0.45, shade: 'blind', bin: 'sculpted', wall: 0xECEBE7, trim: 0xB3B8BE, seat: 0x33475F, head: 0xB7C4D2, mood: 0xF2E6FF, ceil: 2.3 },   // wide body, larger windows, smooth bins, softer mood light
  b737: { ww: 0.25, wh: 0.35, round: 0.48, shade: 'blind', bin: 'pivot', wall: 0xE9E8E4, trim: 0x8E949C, seat: 0x23324A, head: 0x9FB3CA, mood: 0xBFD8FF, ceil: 2.1 },     // sculpted sidewalls, pivoting bins, blue-white sky lighting
  b777: { ww: 0.26, wh: 0.38, round: 0.5, shade: 'blind', bin: 'sculpted', wall: 0xE7E5E0, trim: 0xA1A6AD, seat: 0x2A3A55, head: 0xA6B6C9, mood: 0xFFF0DA, ceil: 2.35 },
  b787: { ww: 0.27, wh: 0.47, round: 0.5, shade: 'dim', bin: 'sculpted', wall: 0xEEEDEA, trim: 0xAAB0B7, seat: 0x2E3D57, head: 0xB0C0D2, mood: 0xD9E6FF, ceil: 2.4 },       // the tall windows with electronic dimming, no blinds
  b747: { ww: 0.25, wh: 0.36, round: 0.5, shade: 'blind', bin: 'sculpted', wall: 0xE6E3DD, trim: 0x9EA3AA, seat: 0x2C3A52, head: 0xA4B4C7, mood: 0xFFEFD8, ceil: 2.35 },
  crj: { ww: 0.21, wh: 0.29, round: 0.48, shade: 'blind', bin: 'small', wall: 0xE2E0DB, trim: 0x8F959C, seat: 0x313B48, head: 0x9AA6B4, mood: 0xFFE8CC, ceil: 1.9 },         // regional jet: low ceiling, small bins
  atr: { ww: 0.24, wh: 0.3, round: 0.45, shade: 'blind', bin: 'small', wall: 0xE5E3DE, trim: 0x8F959C, seat: 0x2B4060, head: 0xA0B2C6, mood: 0xFFE8CC, ceil: 1.95 },         // turboprop: wing above, small bins
  utility: { ww: 0.36, wh: 0.3, round: 0.35, shade: 'none', bin: 'none', wall: 0xC9CCD0, trim: 0x6C7178, seat: 0x3C3F44, head: 0x5A5E64, mood: 0xFFFFFF, ceil: 1.45 },
  ga: { ww: 0.42, wh: 0.34, round: 0.3, shade: 'none', bin: 'none', wall: 0xBFC3C8, trim: 0x5F646B, seat: 0x4A3E33, head: 0x5E5145, mood: 0xFFFFFF, ceil: 1.25 },
};
function cabinStyle(s: ShapeSpec): CabinStyle { return CABIN_STYLES[s.cockpit] || CABIN_STYLES.airbus; }

/** The eye and the window, in the model's own coordinates (aircraft axes: x back from the nose, y right, z up). */
function cabinGeometry(s: ShapeSpec, sy: number, measured?: number[]): { eye: number[]; tip: number[]; win: number[] } {
  const W = s.wing, semi = s.span / 2, rootY = s.w / 2 * 0.9;
  const tipX = W.x + (semi - rootY) * Math.tan(W.sweep * D2R) + W.tip * 0.5;
  const tipZ = s.ground + W.z * s.h + (semi - rootY) * Math.tan(W.dih * D2R) + 0.2;
  // the seat: inside the window row, set back from the wall
  const seatX = clamp(tipX - semi * 0.5, s.win.from + 0.8, s.win.to - 0.8), eyeY = sy * Math.max(0.3, s.w / 2 - 1.0), eyeZ = s.ground + s.h * 0.57;
  const eye = [seatX, eyeY, eyeZ], tip = measured || [tipX, sy * semi, tipZ];
  // the seat right abeam the wing tip: looking straight out through the window, square to it, with the tip in the middle
  eye[0] = clamp(tip[0], s.win.from + 0.8, s.win.to - 0.8);
  // the window: where the line from the eye to the wing tip passes through the cabin wall
  const wallY = sy * (s.w / 2 - 0.22), t = (wallY - eye[1]) / (tip[1] - eye[1]);
  const win = [eye[0] + (tip[0] - eye[0]) * t, wallY, eye[2] + (tip[2] - eye[2]) * t];
  return { eye, tip, win };
}

/* ---------- the cabin window (after real ones) ----------
 * A deep, soft surround in satin white plastic, rounded like a pillow, curling in to a reveal that goes back to the
 * pane; a thin grey seal round the pane; a pull-down shade with a lip along its edge and a small grip in the middle.
 * All one shape swept round the window's rounded outline, so it is smooth at any size: more points on the higher
 * cabin qualities (Very high and Ultra for strong PCs), fewer on phones, never jagged (the shading is smooth). */
const CabWin: any = { geo: {} };
/** The rounded outline at offset o outside the pane (w × h, corner r), always the same number of points in the
 *  same places, so outlines at different offsets line up point for point. */
function cabWinLoop(w: number, h: number, r: number, o: number, nc: number, ns: number): number[][] {
  const W = w / 2 + o, H = h / 2 + o, R = Math.max(0.002, r + o), cx = W - R, cy = H - R, out: number[][] = [];
  const corners = [[cx, cy, 0], [-cx, cy, Math.PI / 2], [-cx, -cy, Math.PI], [cx, -cy, Math.PI * 1.5]];
  corners.forEach((c, i) => {
    for (let k = 0; k <= nc; k++) { const a = c[2] + k / nc * Math.PI / 2; out.push([c[0] + Math.cos(a) * R, c[1] + Math.sin(a) * R]); }
    const n = corners[(i + 1) % 4], a1 = c[2] + Math.PI / 2, p0 = [c[0] + Math.cos(a1) * R, c[1] + Math.sin(a1) * R], p1 = [n[0] + Math.cos(n[2]) * R, n[1] + Math.sin(n[2]) * R];
    for (let k = 1; k <= ns; k++) { const t = k / (ns + 1); out.push([p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t]); }
  });
  return out;
}
/** A profile [offset outside the pane, depth (+ towards the cabin)] swept round the outline: one smooth mesh. */
function cabWinSweep(w: number, h: number, r: number, prof: number[][], nc: number, ns: number): any {
  const T = THREE, loops = prof.map(p => cabWinLoop(w, h, r, p[0], nc, ns)), n = loops[0].length, P: number[] = [], I: number[] = [];
  loops.forEach((L, j) => { for (const q of L) P.push(q[0], q[1], prof[j][1]); });
  for (let j = 0; j < loops.length - 1; j++) for (let i = 0; i < n; i++) { const a = j * n + i, b = j * n + (i + 1) % n, c = (j + 1) * n + i, d = (j + 1) * n + (i + 1) % n; I.push(a, c, b, b, c, d); }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setIndex(I); g.computeVertexNormals(); return g;
}
/** The surround's profile: deep (a single window you sit at) or for the long cabin (set into the wall panel, the
 *  outer edge sloping back to the cabin's curved wall). Fewer steps on the lighter qualities. */
function cabWinProfile(kind: 'deep' | 'row', q: number): number[][] {
  const deep = [[0.075, 0.0], [0.073, 0.008], [0.066, 0.016], [0.055, 0.022], [0.043, 0.024], [0.032, 0.021], [0.024, 0.014], [0.018, 0.004], [0.015, -0.012], [0.012, -0.04], [0.008, -0.08], [0.005, -0.104], [0.002, -0.11]];
  const row = [[0.12, -0.066], [0.1, -0.034], [0.082, -0.008], [0.073, 0.008], [0.062, 0.016], [0.05, 0.02], [0.038, 0.018], [0.028, 0.011], [0.021, 0.002], [0.017, -0.012], [0.012, -0.034], [0.006, -0.054], [0.002, -0.06]];
  const pr = kind === 'deep' ? deep : row;
  if (q >= 2) return pr;
  const keep = q === 1 ? [0, 1, 2, 3, 4, 6, 7, 8, 10, 12] : [0, 2, 4, 6, 8, 10, 12];
  return keep.map(i => pr[i]);
}
/** The parts of a window for this cabin style and quality, made once and shared. */
function cabWinParts(st: CabinStyle, kind: 'deep' | 'row'): any {
  const q = cabinQ(), key = [st.ww, st.wh, st.round, kind, q].join('|'); if (CabWin.geo[key]) return CabWin.geo[key];
  const T = THREE, ww = st.ww, wh = st.wh, r = Math.min(ww, wh) * st.round, nc = [6, 9, 12, 18][q], ns = [1, 1, 2, 3][q];   // round corners even on Low (only a few hundred points a window)
  const prof = cabWinProfile(kind, q), back = prof[prof.length - 1][1];
  const ring = cabWinSweep(ww, wh, r, prof, nc, ns);
  // the grey seal round the pane
  const seal = cabWinSweep(ww, wh, r, [[0.004, back + 0.001], [0.0, back - 0.001], [-0.004, back - 0.002]], nc, ns);
  // the pane itself (the outside is seen through it; on the long cabin, drawn behind it)
  const pane = new T.ShapeGeometry(new T.Shape(cabWinLoop(ww, wh, r, -0.002, nc, ns).map(p => new T.Vector2(p[0], p[1]))));
  pane.translate(0, 0, back - 0.003);
  // the shade: a panel 1 high from its bottom edge up (scaled to how far it is down), its lip and the grip
  const shade = new T.PlaneGeometry(ww + 0.012, 1); shade.translate(0, 0.5, 0);
  const lip = new T.BoxGeometry(ww + 0.008, 0.012, 0.014, 1, 1, 1); lip.translate(0, 0.006, 0.007);
  const grip = new T.CylinderGeometry(0.034, 0.034, 0.01, [12, 16, 20, 28][q], 1, false, Math.PI / 2, Math.PI); grip.rotateX(Math.PI / 2); grip.scale(1, 0.4, 1); grip.translate(0, 0.0, 0.014);   // the half-oval tab under the lip
  const shadeZ = back + 0.006;   // close in front of the pane, so its square corners stay hidden behind the rounded surround
  return (CabWin.geo[key] = { ring, seal, pane, shade, lip, grip, back, shadeZ, ww, wh, r });
}
/** Where the shade's bottom edge is for how far it is down (0 up, the lip just showing at the top; 1 shut). */
function cabWinShadeY(W: any, k: number): number { const top = W.wh / 2 + 0.004; return top - 0.012 - k * (W.wh - 0.043); }   // shut: the lip and its grip a little above the bottom, as on board
/** How much of the shade shows: from its bottom edge up to just inside the window's top (no more). */
function cabWinShadeH(W: any, y: number): number { return Math.max(0.002, W.wh / 2 + 0.01 - y); }
const CABWIN_MAT: any = {};
function cabWinMats(): any {
  if (CABWIN_MAT.ring) return CABWIN_MAT;
  const T = THREE;
  CABWIN_MAT.ring = cabinMat(0xF2F0EB, { side: T.DoubleSide });
  CABWIN_MAT.seal = cabinMat(0xC9CDD2, { side: T.DoubleSide });
  CABWIN_MAT.shade = cabinMat(0xE3E1DC, { side: T.DoubleSide });
  CABWIN_MAT.lip = cabinMat(0xF7F5F1, {});
  return CABWIN_MAT;
}

function cabinBuild(s: ShapeSpec, sy: number, win: number[]): any {
  const T = THREE, g = new T.Group(), st = cabinStyle(s);
  const ww = st.ww, wh = st.wh, r = Math.min(ww, wh) * st.round;
  const rr = (w: number, h: number, rad: number) => { const p = new T.Path(); p.moveTo(-w / 2 + rad, -h / 2); p.lineTo(w / 2 - rad, -h / 2); p.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + rad); p.lineTo(w / 2, h / 2 - rad); p.quadraticCurveTo(w / 2, h / 2, w / 2 - rad, h / 2); p.lineTo(-w / 2 + rad, h / 2); p.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - rad); p.lineTo(-w / 2, -h / 2 + rad); p.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + rad, -h / 2); return p; };
  const shapeWith = (outer: any, hole: any) => { const n = cabinQv([12, 24, 40, 64]), sh = new T.Shape(outer.getPoints(n)); sh.holes.push(new T.Path(hole.getPoints(n))); return sh; };
  const mat = (c: number, rough: number, em?: number) => { const m = cabinMat(c, { side: T.DoubleSide }); if (em) { m.emissive = new T.Color(0xFFE2B8); m.emissiveIntensity = em; } void rough; return m; };
  const mWall = cabinMat(st.wall, { side: T.DoubleSide, map: (() => { const t = cabinSatinTex().clone(); t.needsUpdate = true; t.repeat.set(6, 3.4); return t; })() }), mBezel = mat(0xF3F1EC, 0.5), mReveal = mat(new T.Color(st.wall).multiplyScalar(0.94).getHex(), 0.9), mShade = mat(0xEDEAE3, 0.7), mBin = cabinMat(new T.Color(st.wall).lerp(new T.Color(0xFFFFFF), 0.35).getHex(), { side: T.DoubleSide, map: cabinSatinTex() }), mSeat = cabinMat(st.seat, { side: T.DoubleSide, map: cabinFabricTex() }), mTrim = mat(st.trim, 0.45), mDark = mat(0x3A3D42, 0.8);
  // the wall: a large panel with the window cut out, its frame going back through the wall's thickness
  const wpitch = Math.max(0.5, s.win.pitch || 0.53) * 1.95, nq = cabinQv([12, 24, 40, 64]), wsh = new T.Shape(rr(8, 4.6, 0.01).getPoints(nq));
  for (const dx of [0, -1, 1]) wsh.holes.push(new T.Path(rr(ww + 0.11, wh + 0.11, r + 0.07).getPoints(nq).map((p: any) => new T.Vector2(p.x + dx * wpitch, p.y))));   // this window and the next ones along
  const wall = new T.Mesh(new T.ExtrudeGeometry(wsh, { depth: 0.02, bevelEnabled: false }), mWall);
  // the rest of the cabin around the seat, closed all round (only the window looks out), so no sky shows through a gap
  const roomM = [mWall, mWall, cabinMat(0xEDEEEF, { side: T.BackSide }), cabinMat(0x3A3F48, { side: T.BackSide, map: cabinCarpetTex() }), mWall, new T.MeshBasicMaterial({ visible: false })];
  const room = new T.Mesh(new T.BoxGeometry(8, 4, 3), roomM); room.position.set(0, 0.3, 0.03 + 1.5); g.add(room);
  wall.position.z = 0.02; g.add(wall);
  // the window, after real ones: the soft surround and its deep reveal, the seal, the pane, the shade pushed up
  // (its lip just showing at the top), as in the photo of an open window
  const W = cabWinParts(st, 'deep'), WM = cabWinMats(), wg = new T.Group(); wg.position.z = 0.02; g.add(wg);
  wg.add(new T.Mesh(W.ring, WM.ring), new T.Mesh(W.seal, WM.seal));
  const pane = new T.Mesh(W.pane, new T.MeshBasicMaterial({ color: 0x9FB4C8, transparent: true, opacity: 0.08, depthWrite: false, side: T.DoubleSide })); pane.material.userData.noDim = true; wg.add(pane);
  const shadeAt = (par: any, k: number) => {
    if (st.shade !== 'blind') return;
    const y = cabWinShadeY(W, k), sh = new T.Mesh(W.shade, WM.shade); sh.position.set(0, y, W.shadeZ); sh.scale.y = cabWinShadeH(W, y); par.add(sh);
    const lp = new T.Mesh(W.lip, WM.lip); lp.position.set(0, y, W.shadeZ); par.add(lp); const gp = new T.Mesh(W.grip, WM.lip); gp.position.set(0, y, W.shadeZ); par.add(gp);
    return [sh, lp, gp];
  };
  const own = shadeAt(wg, 0.02);
  if (own) g.userData.shade = { parts: own, hit: [pane, own[0]], W, k: [0.02], to: [0.02], from: [0.02], p: [1], live: [true], moving: [] as number[],
    set: (i: number) => { const y = cabWinShadeY(W, g.userData.shade.k[i]); for (const m of own) m.position.y = y; own[0].scale.y = cabWinShadeH(W, y); } };
  if (st.shade === 'dim') {   // the dimming button under the window
    const btn = new T.Mesh(new T.BoxGeometry(0.03, 0.06, 0.012), mat(0x2C3138, 0.4, 0.4)); btn.position.set(0, -wh / 2 - 0.1, 0.03); g.add(btn);
  }
  void mShade; void mReveal; void mBezel;
  // the overhead bin: above the window, coming out over the seats, with its lower lip and a reading-light strip
  if (st.bin !== 'none') {
    const big = st.bin === 'small' ? 0.7 : 1, binH = 0.42 * big, binD = 0.62 * big;
    let bin: any;
    if (st.bin === 'sculpted' || st.bin === 'pivot') {   // a rounded, curving bin door
      const sh = new T.Shape(); sh.moveTo(0, 0); sh.lineTo(binD, 0); sh.quadraticCurveTo(binD + 0.04, binH * 0.55, binD * 0.72, binH); sh.lineTo(0, binH); sh.lineTo(0, 0);
      const geo = new T.ExtrudeGeometry(sh, { depth: 8, bevelEnabled: false, curveSegments: cabinQv([6, 12, 24, 48]) }); geo.translate(0, 0, -4); geo.rotateY(Math.PI / 2);
      bin = new T.Mesh(geo, mBin); bin.position.set(0, wh / 2 + 0.4, 0.02);
    } else { bin = new T.Mesh(new T.BoxGeometry(8, binH, binD), mBin); bin.position.set(0, wh / 2 + 0.4 + binH / 2, 0.02 + binD / 2); }
    g.add(bin);
    // the door seams of the bins and the passenger service strip with its reading lights
    for (let k = -1; k <= 1; k++) { const seam = new T.Mesh(new T.BoxGeometry(0.008, binH * 0.9, 0.01), mTrim); seam.position.set(k * 0.85, wh / 2 + 0.4 + binH * 0.5, binD + 0.035); g.add(seam); }
    const psu = new T.Mesh(new T.BoxGeometry(8, 0.03, 0.2), mat(0xDCD8D0, 0.6, 0.25)); psu.position.set(0, wh / 2 + 0.39, binD * 0.75); g.add(psu);
    const strip = new T.Mesh(new T.BoxGeometry(8, 0.012, 0.03), new T.MeshBasicMaterial({ color: st.mood })); strip.material.userData.noDim = true; strip.position.set(0, wh / 2 + 0.38, 0.06); g.add(strip);
    V3dCabin.mood = strip;
  }
  // the sidewall's lower part and the armrest, the seat in front (its back and headrest)
  const dado = new T.Mesh(new T.BoxGeometry(8, 0.5, 0.06), mWall); dado.position.set(0, -wh / 2 - 0.62, 0.06); dado.rotation.x = 0.15; g.add(dado);
  const arm = new T.Mesh(new T.BoxGeometry(0.62, 0.08, 0.1), mDark); arm.position.set(0.05, -wh / 2 - 0.3, 0.17); g.add(arm);
  const seatBack = new T.Mesh(new T.BoxGeometry(0.12, 0.95, 0.5), mSeat); void mShade; seatBack.position.set(-0.62, -wh / 2 - 0.12, 0.42); g.add(seatBack);
  const head = new T.Mesh(new T.BoxGeometry(0.14, 0.24, 0.42), cabinMat(st.head, { map: cabinLeatherTex() })); head.position.set(-0.62, -wh / 2 + 0.38, 0.42); g.add(head);
  // the next window along, on both sides (part of the row)
  for (const dx of [-1, 1]) {
    const pitch = Math.max(0.5, s.win.pitch || 0.53), ng = new T.Group(); ng.position.set(dx * pitch * 1.95, 0, 0.02); g.add(ng);
    ng.add(new T.Mesh(W.ring, WM.ring), new T.Mesh(W.seal, WM.seal), new T.Mesh(W.pane, pane.material));   // they look out too
    shadeAt(ng, dx < 0 ? 1 : 0.55);   // the neighbours' shades: one shut, one half down
  }
  // place it: the panel's x along the fuselage, y up, z into the cabin (aircraft axes → the model's)
  const ex = _av(1, 0, 0), ey = _av(0, 0, 1), ez = _av(0, -sy, 0), o = _av(win[0], win[1], win[2]);
  const M = new T.Matrix4().makeBasis(ex, ey, ez); M.setPosition(o);
  g.matrixAutoUpdate = false; g.matrix.copy(M);
  g.traverse((m: any) => { m.renderOrder = 40; m.frustumCulled = false; });
  return g;
}

/** A window shade pulled up or down: about a second for the whole way, easing in and out. */
function cabShadeToggle(SH: any, i: number) {
  if (!SH || !SH.live[i]) return false;
  SH.from[i] = SH.k[i]; SH.to[i] = SH.k[i] > 0.5 ? 0.02 : 1; SH.p[i] = 0; SH.dur = SH.dur || []; SH.dur[i] = 0.35 + 0.75 * Math.abs(SH.to[i] - SH.from[i]);
  if (SH.moving.indexOf(i) < 0) SH.moving.push(i);
  try { Sound.tick(); } catch (e) { /* quiet */ }
  return true;
}
function cabShadeStep(SH: any, dt: number, put: (i: number) => void) {
  if (!SH || !SH.moving.length) return;
  for (const i of SH.moving.slice()) {
    SH.p[i] = Math.min(1, SH.p[i] + dt / SH.dur[i]); const e = SH.p[i] * SH.p[i] * (3 - 2 * SH.p[i]);
    SH.k[i] = SH.from[i] + (SH.to[i] - SH.from[i]) * e; put(i);
    if (SH.p[i] >= 1) SH.moving.splice(SH.moving.indexOf(i), 1);
  }
}
/** A click on a window in the cabin: its shade goes up or down (within reach). */
function cabShadeTap(ray: any, G: any): boolean {
  const SH = G && G.userData.shades; if (!SH) return false;
  const hit = ray.intersectObjects([G.userData.wins, SH.ims[0]].filter(Boolean), false).filter((h: any) => h.instanceId != null && h.distance < 3.4)[0];
  return !!hit && cabShadeToggle(SH, hit.instanceId);
}
function cabShadeFrame(G: any, dt: number) {
  const SH = G && G.userData.shades; if (!SH || !SH.moving.length) return;
  cabShadeStep(SH, dt, i => { const F = SH.frames[i]; SH.ims[0].setMatrixAt(i, SH.at(i, F, true)); SH.ims[1].setMatrixAt(i, SH.at(i, F, false)); SH.ims[2].setMatrixAt(i, SH.at(i, F, false)); });
  for (const im of SH.ims) im.instanceMatrix.needsUpdate = true;
}

/** The wing tips as built (aircraft axes), measured from the model itself: the outermost part of each wing. */
function cabinTips(body: any): number[][] {
  const wingMat = (_acMats as any).wing, out: number[][] = [null, null], v = new THREE.Vector3();
  body.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(body.matrixWorld).invert();
  for (const side of [0, 1]) {
    let best = -1e9; const pts: number[][] = [];
    body.traverse((o: any) => {
      if (!o.isMesh || o.material !== wingMat) return;
      const pos = o.geometry.attributes.position, M = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
      for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(M); const span = side ? -v.z : v.z; if (span > best - 0.6) { pts.push([v.x, -v.z, v.y, span]); if (span > best) best = span; } }
    });
    const tipPts = pts.filter(p => p[3] > best - 0.6);
    if (tipPts.length) out[side] = [tipPts.reduce((a, p) => a + p[0], 0) / tipPts.length, tipPts.reduce((a, p) => a + p[1], 0) / tipPts.length, tipPts.reduce((a, p) => a + p[2], 0) / tipPts.length];
  }
  return out;
}

/** How close to the window you sit in the window views: 0 in your seat, 1 as close as it goes (kept). */
function cabinWinZoom(): number { const v = (State.settings as any).v3dWinZoom; return v == null ? 0.7 : clamp(+v, 0, 1); }   // starts zoomed well in to the window (the wing and the view filling it)
function cabinWinZoomSet(v: number) {
  (State.settings as any).v3dWinZoom = clamp(v, 0, 1); Store.soon();
  const el = V3d.root && V3d.root.querySelector('.v3d-wz') as HTMLInputElement; if (el && document.activeElement !== el) el.value = String(Math.round(cabinWinZoom() * 100));
}
document.addEventListener('input', e => { const el = e.target as HTMLInputElement; if (el && el.classList && el.classList.contains('v3d-wz')) cabinWinZoomSet(+el.value / 100); });

/** Each frame in a window view: the camera at the seat, fixed, aimed at the wing tip; the cabin around it. */
function v3dCabinCam(P: any, mode: string) {
  const T = THREE, s = shapeOf(P.type), sy = mode === 'winL' ? -1 : 1, body = P.model.userData.body; if (!body) return;
  const key = P.id + '|' + P.type + '|' + sy + '|' + cabinQ();
  if (!body.userData.tips) body.userData.tips = cabinTips(body);
  const G = cabinGeometry(s, sy, body.userData.tips[sy < 0 ? 0 : 1]);
  if (V3dCabin.key !== key || !V3dCabin.grp || V3dCabin.grp.parent !== body) {
    if (V3dCabin.grp && V3dCabin.grp.parent) V3dCabin.grp.parent.remove(V3dCabin.grp);
    V3dCabin.grp = cabinBuild(s, sy, G.win); V3dCabin.key = key; body.add(V3dCabin.grp);
  }
  V3dCabin.grp.visible = true; cabinSharp(true);
  // the aircraft's outside skin and its window glow would sit right in front of the eye: hidden from in here
  body.traverse((o: any) => { if (o.userData && o.userData.fus) o.visible = false; });
  if (body.userData.cabin) body.userData.cabin.visible = false;
  P.model.updateMatrixWorld(true);
  // the zoom (slider, pinch or scroll): the seat moves up to the window along the line to the wing tip, and
  // stops a hand's width short of it, so you can never go through the window
  const perp = Math.abs(G.win[1] - G.eye[1]), kMax = perp > 0.3 ? 1 - 0.2 / perp : 0, k = cabinWinZoom() * kMax;
  const ey = [G.eye[0] + (G.win[0] - G.eye[0]) * k, G.eye[1] + (G.win[1] - G.eye[1]) * k, G.eye[2] + (G.win[2] - G.eye[2]) * k];
  const at = body.localToWorld(_av(ey[0], ey[1], ey[2])), to = body.localToWorld(_av(G.tip[0], G.tip[1], G.tip[2]));
  // a small look around within the window (drag), back to the wing tip on its own
  const q = P.model.getWorldQuaternion(new T.Quaternion()), up = new T.Vector3(0, 1, 0).applyQuaternion(q);
  const dir = to.clone().sub(at).normalize(), side = new T.Vector3().crossVectors(dir, up).normalize();
  const yaw = clamp(V3d.yaw, -0.6, 0.6), pit = clamp(V3d.pitch, -0.45, 0.45);   // out of the window: as far as it shows
  dir.applyAxisAngle(up, -yaw).applyAxisAngle(side, pit);
  V3d.cam.position.copy(at); V3d.cam.up.copy(up); V3d.cam.lookAt(at.clone().add(dir)); V3d.cam.up.set(0, 1, 0);
  if (V3d.cam.fov !== 62 || V3d.cam.near > 0.03) { V3d.cam.fov = 62; (V3d as any).nearWas = (V3d as any).nearWas || V3d.cam.near; V3d.cam.near = 0.02; V3d.cam.updateProjectionMatrix(); }
  // the cabin's light: daylight from the window, warm cabin lights at night
  const night = (V3dSky as any).U ? (V3dSky as any).U.uNight.value : 0, amb = (V3dSky as any).amb || 1;
  CabinLight.ln.value = 0;   // the window seat view has no mood lights of its own
  try { V3d.cam.updateMatrixWorld(); CabinLight.up.value.set(0, 1, 0).transformDirection(V3d.cam.matrixWorldInverse); } catch (e) { CabinLight.up.value.set(0, 0, 0); }
  CabinLight.self.value = 0.55 * (1 - night * 0.82) + 0.0 * amb; CabinLight.warm.value.setRGB(1, 0.97 - 0.2 * night, 0.92 - 0.05 * night);
  const Gw = V3dCabin.grp, SW = Gw && Gw.userData.shade;
  if (SW && SW.moving.length) { const tn = performance.now() / 1000, dt = Math.min(0.1, Math.max(0, tn - (SW.t || tn))); SW.t = tn; cabShadeStep(SW, dt, SW.set); } else if (SW) SW.t = 0;

}
/** Leaving a window view: the aircraft as it was, the camera's near limit back. */
/** A cabin is only made while you look at it: leaving the view takes it out of the scene and frees its memory
 *  on the graphics chip (shared textures stay ready, so going back in is quick). */
function cabinFree(G: any) {
  if (!G) return;
  if (G.parent) G.parent.remove(G);
  G.traverse((o: any) => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m: any) => m.dispose()); });
}
function v3dCabinLeave(P: any) {
  cabinFree(V3dCabin.grp); V3dCabin.grp = null; V3dCabin.key = ''; cabinSharp(false);
  const body = P && P.model && P.model.userData.body;
  if (body) { body.traverse((o: any) => { if (o.userData && o.userData.fus) o.visible = true; }); if (body.userData.cabin) body.userData.cabin.visible = true; }
  if ((V3d as any).nearWas) { V3d.cam.near = (V3d as any).nearWas; (V3d as any).nearWas = 0; V3d.cam.updateProjectionMatrix(); }
}

/* ---------- the cabin, looking forward ---------- */
// From the back of the cabin, standing in the aisle: every row of seats as the aircraft is laid out
// (the same seat numbers as the passenger list), the overhead bins, the windows and the lights, and the
// passengers in their own seats, each with their own look (skin, hair, clothes; children smaller), with
// pets travelling in the cabin on their owners' laps. People are drawn in a handful of shared shapes
// (instanced), so even a full wide-body stays quick. Settings → Graphics → Passengers in the cabin.

const V3dCabinF: any = { key: '', grp: null };

/* ---------- the view out of the cabin windows ---------- */
// The windows show the world outside as it is (the sky, the ground, the wing, the clouds, other aircraft): each
// frame the outside is drawn small from the same eye, without the cabin, and every window shows its part of it.
const CabinOut: any = { rt: null, mat: null, n: 0 };
function cabinOutsideMat(): any {
  const T = THREE; if (!T || !T.WebGLRenderTarget) return null;
  if (CabinOut.mat) return CabinOut.mat;
  CabinOut.mat = new T.ShaderMaterial({
    uniforms: { tOut: { value: null }, tMask: { value: V3dCabinF.winTex }, uRes: { value: new T.Vector2(1, 1) } },
    vertexShader: 'varying vec2 vUv;\nvoid main() { vUv = uv; vec4 p = vec4(position, 1.0);\n#ifdef USE_INSTANCING\n  p = instanceMatrix * p;\n#endif\n  gl_Position = projectionMatrix * modelViewMatrix * p; }',
    fragmentShader: 'uniform sampler2D tOut; uniform sampler2D tMask; uniform vec2 uRes; varying vec2 vUv;\nvoid main() { vec4 c = texture2D(tOut, gl_FragCoord.xy / uRes); float a = texture2D(tMask, vUv).g; if (a < 0.02) discard;\n  gl_FragColor = vec4(c.rgb, a);\n  #include <tonemapping_fragment>\n  #include <colorspace_fragment>\n}',
    transparent: true, depthWrite: false, toneMapped: true,
  });
  CabinOut.mat.userData.noDim = true;
  return CabinOut.mat;
}
/** Before the cabin is drawn: the outside, from the same eye, small (it is only seen through the windows). */
function cabinOutsidePass(P: any) {
  const T = THREE, G = V3dCabinF.grp, ren = V3d.r; if (!G || !G.visible || !CabinOut.mat || !ren) return;
  const body = P && P.model && P.model.userData.body; if (!body) return;
  const pc = typeof cabinIsPc === 'function' && cabinIsPc(), q = cabinQ();
  // phones draw it a little smaller and, on Low, every other frame
  if (!pc && q === 0 && (CabinOut.n++ & 1) && CabinOut.rt) return;
  const k = pc ? (q >= 2 ? 0.6 : 0.45) : (q >= 2 ? 0.4 : 0.3);
  const sz = ren.getDrawingBufferSize(new T.Vector2()), w = Math.max(64, Math.round(sz.x * k)), h = Math.max(64, Math.round(sz.y * k));
  if (!CabinOut.rt) CabinOut.rt = new T.WebGLRenderTarget(w, h, { depthBuffer: true });
  else if (CabinOut.rt.width !== w || CabinOut.rt.height !== h) CabinOut.rt.setSize(w, h);
  // the cabin away, the wings and engines back (not the fuselage: the eye is inside it), the clouds back
  const shown: any[] = [];
  G.visible = false;
  for (const c of body.children) if ((c.userData as any).hiddenForCabin && c !== body.userData.cabin && !cabinIsFus(c)) { c.visible = true; shown.push(c); }
  const cl = typeof V3dClouds !== 'undefined' && V3dClouds.mesh, clWas = cl ? cl.visible : false; if (cl) cl.visible = true;
  const was = ren.getRenderTarget();
  try { ren.setRenderTarget(CabinOut.rt); ren.clear(); ren.render(V3d.scene, V3d.cam); }
  finally {
    ren.setRenderTarget(was); G.visible = true; for (const c of shown) c.visible = false; if (cl) cl.visible = clWas;
  }
  CabinOut.mat.uniforms.tOut.value = CabinOut.rt.texture; CabinOut.mat.uniforms.uRes.value.set(sz.x, sz.y);
}
/** The fuselage (and anything else the eye would sit inside of). */
function cabinIsFus(o: any): boolean {
  let fus = false; o.traverse((x: any) => { if (x.userData && x.userData.fus) fus = true; });
  return fus;
}
/** A cabin surface: lit by the cabin's own lights in its own colour (people, seats, walls keep their colours),
 *  with a little shading from the light outside on top. */
// (the Babylon.js edition has no other 3D library: these are only made where one is there)
const _cl3 = typeof THREE !== 'undefined', _clV = (x = 0, y = 0, z = 0) => _cl3 ? new THREE.Vector3(x, y, z) : null, _clC = (r = 0, g = 0, b = 0) => _cl3 ? new THREE.Color(r, g, b) : null;
const CabinLight: any = { self: { value: 0.8 }, warm: { value: _clC(1, 1, 1) },
  // the blue mood lights: real light sources (lines of light) that light the surfaces around them: the side walls
  // below the bins, the ceiling above them and, from the lit ceiling, the bins' doors. Each line: its two ends and
  // the way it shines (in view space, set every frame), its colour and strength, its reach and its fixture spacing.
  la: { value: Array.from({ length: 6 }, () => _clV()) }, lb: { value: Array.from({ length: 6 }, () => _clV()) },
  ld: { value: Array.from({ length: 6 }, () => _clV(0, -1, 0)) }, lc: { value: Array.from({ length: 6 }, () => _clC(0, 0, 0)) },
  lr: { value: [0.4, 0.4, 0.4, 0.4, 0.4, 0.4] }, ls: { value: [0, 0, 0, 0, 0, 0] }, ln: { value: 0 },
  // which way is up in the cabin (view space): surfaces facing up catch a little more of the ceiling light, those
  // facing down a little less, so padding, curves and folds show their depth
  up: { value: _clV(0, 0, 0) } };
const CABIN_LIGHT_GLSL = `
  { vec3 lp = -vViewPosition; vec3 lsum = vec3(0.0);
    for (int i = 0; i < 6; i++) { if (i >= uLN) break;
      vec3 ab = uLB[i] - uLA[i]; float l2 = max(dot(ab, ab), 1e-4); float t = clamp(dot(lp - uLA[i], ab) / l2, 0.0, 1.0);
      vec3 L = uLA[i] + ab * t - lp; float d = max(length(L), 0.03); vec3 l = L / d;
      float ndl = dot(normal, l), aim = dot(-l, uLD[i]);
      if (ndl <= 0.0 || aim <= 0.0 || d > uLR[i] * 5.0) continue;   // facing away, behind the light, or out of its reach
      float fall = 1.0 / (1.0 + (d / uLR[i]) * (d / uLR[i]));
      float seg = 1.0; if (uLS[i] > 0.0) { float u = fract(t * sqrt(l2) / uLS[i]); seg = 0.12 + 0.88 * smoothstep(0.0, 0.25, u) * smoothstep(1.0, 0.75, u); }
      lsum += uLC[i] * ndl * aim * fall * seg; }
    float shade = 1.0 - 0.08 * length(uUp) + 0.14 * dot(normal, uUp);
    float blueK = min(0.55, dot(lsum, vec3(0.25, 0.45, 0.3)) * 0.7);   // where the blue light falls, the white light is weaker (the bins shade it)
    totalEmissiveRadiance += diffuseColor.rgb * (uWarm * uSelf * shade * (1.0 - blueK) + lsum); }`;
function cabinMat(color: number, o?: any): any {
  const m = new THREE.MeshLambertMaterial(Object.assign({ color, fog: false }, o || {}));
  m.userData.noDim = true;
  // the sharpest texture filtering the graphics chip has at extreme quality (cloth and leather stay crisp at a slant)
  try { if (m.map && V3d.r) { const an = cabinQ() === 3 ? V3d.r.capabilities.getMaxAnisotropy() : cabinQ() === 2 ? 4 : 1; if (m.map.anisotropy !== an) { m.map.anisotropy = an; m.map.needsUpdate = true; } } } catch (e) { /* default filtering */ }
  m.onBeforeCompile = (sh: any) => {
    sh.uniforms.uSelf = CabinLight.self; sh.uniforms.uWarm = CabinLight.warm;
    sh.uniforms.uLA = CabinLight.la; sh.uniforms.uLB = CabinLight.lb; sh.uniforms.uLD = CabinLight.ld; sh.uniforms.uLC = CabinLight.lc; sh.uniforms.uLR = CabinLight.lr; sh.uniforms.uLS = CabinLight.ls; sh.uniforms.uLN = CabinLight.ln; sh.uniforms.uUp = CabinLight.up;
    sh.fragmentShader = 'uniform float uSelf; uniform vec3 uWarm; uniform vec3 uLA[6]; uniform vec3 uLB[6]; uniform vec3 uLD[6]; uniform vec3 uLC[6]; uniform float uLR[6]; uniform float uLS[6]; uniform int uLN; uniform vec3 uUp;\n'
      + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + CABIN_LIGHT_GLSL);
  };
  return m;
}
/** The blue mood lights each frame: where they are as seen from the camera, and how bright. By day they are on
 *  but a little softer; at night, with the cabin's white lights dimmed, the blue fills the walls and the ceiling. */
function cabinMoodLights(G: any, dim: number) {
  const T = THREE, L: any[] = cabinMoodOn() ? G.userData.lights || [] : [], n = Math.min(6, L.length), cam = V3d.cam;
  cam.updateMatrixWorld(); G.updateMatrixWorld();
  const M = new T.Matrix4().multiplyMatrices(cam.matrixWorldInverse, G.matrixWorld), N = new T.Matrix3().setFromMatrix4(M);
  const night = Math.min(1, dim / 0.86), blue = new T.Color(0.16, 0.38, 1);
  const k: any = { wall: 1.6 + 2.0 * night, cove: 1.3 + 3.9 * night, bins: 0.35 + 1.3 * night };
  for (let i = 0; i < n; i++) {
    const l = L[i];
    CabinLight.la.value[i].copy(l.a).applyMatrix4(M); CabinLight.lb.value[i].copy(l.b).applyMatrix4(M);
    CabinLight.ld.value[i].copy(l.d).applyMatrix3(N).normalize();
    CabinLight.lc.value[i].copy(blue).multiplyScalar(k[l.kind] || 1);
    CabinLight.lr.value[i] = l.r; CabinLight.ls.value[i] = l.seg;
  }
  CabinLight.ln.value = n;
  CabinLight.up.value.set(0, 1, 0).applyMatrix3(N).normalize();
}
/** Each frame: the seats within the detail range get the detailed parts and the others the light ones; a seat
 *  crossing the line fades from one to the other in about half a second (both are fully there half way, so the
 *  seat never thins out). */
function cabinSeatLod(G: any) {
  const L = G.userData.seatLod; if (!L || L.allHi || !L.hi || !L.lo) return;
  const now = performance.now(), dt = Math.min(0.2, (now - (L.last || now)) / 1000); L.last = now;
  G.updateMatrixWorld(); const cam = G.worldToLocal(V3d.cam.position.clone()), cx = cam.x, cy = -cam.z;
  const R = L.R, hi = L.hi, lo = L.lo, slots: number[] = L.slots, fa = (S: any, key: string) => S[key].geometry.attributes.aFade;
  let dHi = false, dLo = false;
  for (let i = 0; i < L.list.length; i++) {
    const sd = L.list[i], d = Math.hypot(sd.x - cx, (sd.y - cy) * 0.8), first = sd.f < 0;
    let want = d < R ? 1 : d > R + 0.6 ? 0 : (sd.f > 0.5 ? 1 : 0);
    if (want && sd.slot < 0) {
      const fr = slots.indexOf(-1);
      if (fr < 0) want = 0;
      else { sd.slot = fr; slots[fr] = i; for (const key in hi) { const m = hi[key]; m.setMatrixAt(fr, sd.M); m.instanceMatrix.needsUpdate = true; if (key !== 'handle') { m.setColorAt(fr, key === 'head' ? sd.hc : sd.up); m.instanceColor.needsUpdate = true; } } }
    }
    const f = first ? want : Math.max(0, Math.min(1, sd.f + (want ? 1 : -1) * dt * 2.2));
    if (f === sd.f) continue;
    sd.f = f;
    if (sd.slot >= 0) { for (const key in hi) fa(hi, key).setX(sd.slot, Math.min(1, f * 2)); dHi = true; }
    for (const key in lo) fa(lo, key).setX(i, Math.min(1, (1 - f) * 2)); dLo = true;
    if (f <= 0 && sd.slot >= 0) { slots[sd.slot] = -1; sd.slot = -1; }
  }
  let top = -1; for (let j = slots.length - 1; j >= 0; j--) if (slots[j] >= 0) { top = j; break; }
  for (const key in hi) { hi[key].count = top + 1; if (dHi) fa(hi, key).needsUpdate = true; }
  if (dLo) for (const key in lo) fa(lo, key).needsUpdate = true;
}
const _people: any = {};
/** Cabin quality (Settings → Graphics → Cabin): 0 low, 1 medium, 2 high, 3 extreme. It sets how finely the
 *  curves of the bins, walls, seats, headrests and people are made, and at extreme the cabin is also drawn at
 *  the screen's full sharpness with the sharpest texture filtering. */
const CABIN_Q_NAMES = ['Low', 'Medium', 'Very high', 'Ultra'];
function cabinQ(): number { const v = (State.settings as any).v3dCabinQ; return v == null ? (cabinLowMem() ? 1 : 2) : clamp(Math.round(+v), 0, 3); }
/** Phones and tablets with 4 GB of memory or less: Medium is their standard, and fewer detailed people. */
function cabinLowMem(): boolean { return !(typeof DESKTOP !== 'undefined' && DESKTOP) && (+(navigator as any).deviceMemory || 8) <= 4; }
/* The cabin's own settings (Settings → Graphics → Cabin). Each is "auto" unless chosen: it then follows the cabin
 * quality. Ultra on auto is the full cabin: every seat detailed, up to 48 detailed passengers, up to 3× sharpness. */
function cabinOpt(k: string): string { const v = (State.settings as any)[k]; return v == null ? 'auto' : String(v); }
const CABIN_SEAT_NEAR = ['Off', 'Close by', 'Nearby rows', 'Far', 'Every seat'], CABIN_SEAT_M = [0, 3, 5.5, 9, 1e9];
/** How far around you the seats are drawn in full detail (metres; further away a lighter seat, faded between). */
function cabinSeatRange(): number { const v = cabinOpt('cabSeatNear'); if (v !== 'auto') return CABIN_SEAT_M[clamp(+v, 0, 4)]; return CABIN_SEAT_M[cabinSeatAuto()]; }
/** Detailed seats on Automatic: on the PC every seat from Very high up, on phones and tablets the nearby rows. */
function cabinSeatAuto(): number { const q = cabinQ(); return q === 3 ? 4 : cabinIsPc() ? [1, 2, 4][q] : [0, 1, 1][q]; }
const CABIN_HD_N = [0, 4, 8, 12, 20, 48];
/** How many of the passengers around you are drawn as detailed figures. */
function cabinHdCount(): number { const v = cabinOpt('cabHd'); if (v !== 'auto') return CABIN_HD_N[clamp(+v, 0, 5)]; return cabinHdAuto(); }
function cabinHdAuto(): number { const q = cabinQ(); return q === 3 ? 48 : cabinIsPc() ? [6, 10, 20][q] : cabinLowMem() ? 2 : [2, 3, 4][q]; }
function cabinIsPc(): boolean { return typeof DESKTOP !== 'undefined' && !!DESKTOP; }
const CABIN_SCALE = [0.75, 1, 1.5, 2, 3];
/** The cabin's drawing sharpness against the view's normal one (auto: finer than the screen at the top settings,
 *  on PCs and devices with plenty of memory). */
function cabinRatio(base: number): number {
  const v = cabinOpt('cabScale'), dpr = window.devicePixelRatio || 1;
  if (v !== 'auto') return base * CABIN_SCALE[clamp(+v, 0, 4)];
  const q = cabinQ();
  if (q === 3) return Math.max(base, Math.min(Math.max(dpr, 2), 3));
  if (q === 2 && typeof DESKTOP !== 'undefined' && DESKTOP) return Math.max(base, Math.min(Math.max(dpr, 1.5), 2));   // phones: their own sharpness (their graphics memory is shared and small)
  return base;
}
function cabinMoodOn(): boolean { return (State.settings as any).cabMood !== false; }
/** Keep the frame rate smooth: the cabin is drawn less sharply while the frame rate is low (auto: on, except Ultra). */
function cabinGuardOn(): boolean { const v = cabinOpt('cabGuard'); return v === 'on'; }   // off unless chosen: frame generation keeps the cabin smooth
function cabinQv(v: number[]): number { return v[cabinQ()]; }
/** A smooth closed outline through the points (or the plain outline at low quality). */
function cabinSmooth(pts: number[][], n: number): any {
  const T = THREE;
  if (n <= pts.length) return pts.map(p => new T.Vector2(p[0], p[1]));
  const c = new T.CatmullRomCurve3(pts.map(p => new T.Vector3(p[0], p[1], 0)), true, 'centripetal');
  return c.getSpacedPoints(n).slice(0, n).map((v: any) => new T.Vector2(v.x, v.y));
}
/** A profile drawn out in a straight line (the bins): smooth shading across the curve, so a curved door
 *  looks curved rather than a row of flat strips. pts run from the wall over the door and back underneath. */
function cabinSweep(pts: number[][], len: number): any {
  const T = THREE, n = pts.length, pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = [];
  let run = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], tx = b[0] - a[0], ty = b[1] - a[1], tl = Math.hypot(tx, ty) || 1;
    if (i) run += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    for (const w of [0, len]) { pos.push(pts[i][0], pts[i][1], w); nor.push(-ty / tl, tx / tl, 0); uv.push(w / 1.2, run / 1.2); }
  }
  for (let i = 0; i < n - 1; i++) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
  return geo;
}
/** At extreme quality the cabin is drawn at the screen's full sharpness while you are in it. */
const CabGuard = { t0: 0, n: 0, k: 1 };
/** The cabin's drawing sharpness, every frame while a cabin view is open: as chosen, lowered step by step while the
 *  frame rate stays low (when that is switched on) and raised again when there is room. */
function cabinSharp(on: boolean) {
  const r = V3d.r; if (!r) return; const VV: any = V3d;
  if (!on) { if (VV.dprWas) { r.setPixelRatio(VV.dprWas); VV.dprWas = 0; } CabGuard.k = 1; CabGuard.t0 = 0; return; }
  if (!VV.dprWas) VV.dprWas = r.getPixelRatio();
  const now = performance.now(); CabGuard.n++;
  if (!CabGuard.t0) { CabGuard.t0 = now; CabGuard.n = 0; }
  else if (now - CabGuard.t0 > 2000) {
    const fps = CabGuard.n * 1000 / (now - CabGuard.t0), goal = gameBoost() ? 48 : 25; CabGuard.n = 0; CabGuard.t0 = now;
    if (!cabinGuardOn()) CabGuard.k = 1;
    else if (fps < goal) CabGuard.k = Math.max(0.5, CabGuard.k - 0.15);
    else if (fps > goal * 1.18) CabGuard.k = Math.min(1, CabGuard.k + 0.1);
  }
  const want = Math.max(0.5, cabinRatio(VV.dprWas) * CabGuard.k);
  if (Math.abs(r.getPixelRatio() - want) > 0.01) r.setPixelRatio(want);
}
function cabinPeopleOn(): boolean { return (State.settings as any).v3dCabinPax !== false; }

/** Seats across, in blocks between the aisles, for a cabin this wide (matching the passenger list's letters). */
function cabinBlocks(abreast: number): number[] { return abreast >= 10 ? [3, 4, 3] : abreast === 9 ? [3, 3, 3] : abreast === 8 ? [2, 4, 2] : abreast === 7 ? [2, 3, 2] : abreast === 6 ? [3, 3] : abreast === 5 ? [2, 3] : abreast === 4 ? [2, 2] : abreast === 3 ? [1, 2] : [1, 1]; }

function cabinFwdBuild(P: any, s: ShapeSpec, f: any): any {
  if (typeof isHeli === 'function' && isHeli(P.type)) return heliCabinBuild(P.type);
  const T = THREE, g = new T.Group(), st = cabinStyle(s), t: any = acType(P.type) || {};
  const abreast = (t.seats || 150) > 250 ? 9 : (t.seats || 150) > 100 ? 6 : (t.seats || 150) > 40 ? 4 : (t.seats || 150) > 12 ? 3 : 2, blocks = cabinBlocks(abreast), letters = 'ABCDEFGHJK'.slice(0, abreast);
  const zc = s.ground + s.h / 2, ri = Math.min(s.w, s.h) / 2 - 0.12, zf = zc - ri * 0.55, x0 = Math.max(s.nose * 0.7, s.win.from - 0.6), x1 = s.win.to + 0.4, len = x1 - x0;
  const V = (x: number, y: number, z: number) => _av(x, y, z);
  const mat = (c: number, rough: number) => cabinMat(c); void 0;
  // the shell: side walls and ceiling (seen from inside), the floor with its aisle carpet, the front wall
  const shell = new T.Mesh(new T.CylinderGeometry(ri, ri, len, cabinQv([32, 64, 112, 192]), 1, true), cabinMat(0xFFFFFF, { map: cabinShellTex(st.wall, len) })); shell.material.side = T.BackSide;
  shell.rotation.z = Math.PI / 2; shell.position.copy(V(x0 + len / 2, 0, zc)); g.add(shell);
  const carpet = cabinCarpetTex().clone(); carpet.needsUpdate = true; carpet.repeat.set(len / 0.6, ri * 1.9 / 0.6);
  const floor = new T.Mesh(new T.PlaneGeometry(len, ri * 1.9).rotateX(-Math.PI / 2), cabinMat(0xFFFFFF, { map: carpet })); floor.position.copy(V(x0 + len / 2, 0, zf)); g.add(floor);
  const front = new T.Mesh(new T.CircleGeometry(ri, cabinQv([24, 40, 64, 96])), mat(0xE2E4E6, 0.8)); front.position.copy(V(x0 + 0.01, 0, zc)); front.rotation.y = Math.PI / 2; g.add(front);
  if (!V3dCabinF.curtTex) V3dCabinF.curtTex = cabinCanvas(128, 32, (gg, img, d) => { for (let y = 0; y < 32; y++) for (let x2 = 0; x2 < 128; x2++) { const v = 200 + 34 * Math.sin(x2 / 128 * Math.PI * 2 * 9) + 6 * (cloudHash(x2, y, 91) - 0.5), i = (y * 128 + x2) * 4; d[i] = v * 0.98; d[i + 1] = v * 0.94; d[i + 2] = v * 0.86; d[i + 3] = 255; } gg.putImageData(img, 0, 0); });
  const door = new T.Mesh(new T.PlaneGeometry(1.0, 1.95), cabinMat(0xFFFFFF, { map: V3dCabinF.curtTex })); door.position.copy(V(x0 + 0.05, 0, zf + 0.98)); door.rotation.y = Math.PI / 2; g.add(door);   // the galley curtain
  const exitSign = new T.Mesh(new T.BoxGeometry(0.02, 0.1, 0.32), new T.MeshBasicMaterial({ color: 0x18E070 })); exitSign.material.userData.noDim = true; exitSign.position.copy(V(x0 + 0.05, 0, zf + 2.05)); g.add(exitSign);
  // the back of the cabin is closed the same way: a wall with the rear galley's curtain and an exit sign
  const aftWall = new T.Mesh(new T.CircleGeometry(ri, cabinQv([24, 40, 64, 96])), mat(0xE2E4E6, 0.8)); aftWall.position.copy(V(x1 - 0.01, 0, zc)); aftWall.rotation.y = -Math.PI / 2; g.add(aftWall);
  const door2 = new T.Mesh(new T.PlaneGeometry(1.0, 1.95), cabinMat(0xFFFFFF, { map: V3dCabinF.curtTex })); door2.position.copy(V(x1 - 0.05, 0, zf + 0.98)); door2.rotation.y = -Math.PI / 2; g.add(door2);
  const exit2 = new T.Mesh(new T.BoxGeometry(0.02, 0.1, 0.32), new T.MeshBasicMaterial({ color: 0x18E070 })); exit2.material.userData.noDim = true; exit2.position.copy(V(x1 - 0.05, 0, zf + 2.05)); g.add(exit2);
  // the overhead bins on both sides, with their light strip
  const M0 = new T.Matrix4(), lam2 = (c: number) => cabinMat(c);
  const binH = st.bin === 'small' ? 0.3 : 0.42, binD = st.bin === 'small' ? 0.42 : 0.6, mBin = cabinMat(0xF6F7F8, { map: cabinSatinTex() });
  if (st.bin !== 'none') for (const side of [-1, 1]) {
    // the bin: a big rounded door bulging into the cabin from the ceiling down to a lip over the seats
    const bh = binH * 1.2, bd = binD * 1.04, N = cabinQv([6, 12, 24, 48]), prof: number[][] = [];
    // the bins' lower edge about 1.8 m above the floor (head room over the seats), lower in small cabins; they
    // meet the wall where the curved wall is at that height
    const zb = Math.min(zf + 1.8, zc + ri * 0.48), wallY = Math.min(ri * 0.9, Math.sqrt(Math.max(0.01, ri * ri - (zb - zc) * (zb - zc))) - 0.02);
    // their top follows the ceiling, so they sit flush against it all along (no gap above them): the height of the
    // ceiling over a point xp in from the wall, from the bins' lower edge
    const ceilAt = (xp: number) => zc + Math.sqrt(Math.max(0.01, ri * ri - (wallY - xp) * (wallY - xp))) - zb - 0.006;
    const hT = Math.max(bh + 0.05, ceilAt(bd * 0.32));   // where the door's sweep begins, up against the ceiling
    const bez = (p0: number[], p1: number[], p2: number[], p3: number[], m: number, first: boolean) => { for (let i = first ? 0 : 1; i <= m; i++) { const t = i / m, u = 1 - t; prof.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]); } };
    // up in the ceiling, then the door's long convex sweep down into the cabin, a rounded lip, and the flat underside back to the wall
    { const n0 = Math.max(3, N >> 2); for (let i = 0; i <= n0; i++) { const xp = bd * 0.32 * i / n0; prof.push([xp, Math.max(bh + 0.05, ceilAt(xp))]); } }   // along the ceiling
    const lift = hT - (bh + 0.05);   // the door is that much taller where the ceiling is higher (scaled, the same shape)
    bez([bd * 0.32, hT], [bd * 0.78, bh * 0.98 + lift * 0.85], [bd * 1.03, bh * 0.62 + lift * 0.4], [bd, bh * 0.16], N, false);
    bez([bd, bh * 0.16], [bd * 0.995, bh * 0.04], [bd * 0.985, 0], [bd * 0.92, 0], Math.max(3, N >> 1), false);
    prof.push([bd * 0.5, 0], [0, 0]);
    const geo = cabinSweep(prof, len);
    const m = new T.Mesh(geo, mBin); mBin.side = T.DoubleSide; mBin.fog = false;
    const Mb = new T.Matrix4().makeBasis(_av(0, -side, 0), new T.Vector3(0, 1, 0), new T.Vector3(1, 0, 0));
    Mb.setPosition(V(x0, side * wallY, zb)); m.matrixAutoUpdate = false; m.matrix.copy(Mb); g.userData.bin = { zb, lip: wallY - bd, top: zb + hT };   // where the bins' lower edge is (for the seat placards)
    g.add(m);
    // underneath: the grey passenger service panel, with a pair of reading lights and air vents over every row
    const psu = new T.Mesh(new T.BoxGeometry(len, 0.035, bd * 0.95), lam2(0xA4A9AF)); psu.position.copy(V(x0 + len / 2, side * (wallY - bd * 0.475), zb)); g.add(psu);
    const nL = Math.floor(len / 0.79), rl = new T.InstancedMesh(new T.CylinderGeometry(0.022, 0.022, 0.01, 12), new T.MeshBasicMaterial({ color: 0xF2F4F6 }), nL * 2);
    const vent = new T.InstancedMesh(new T.CylinderGeometry(0.018, 0.022, 0.012, 10), lam2(0x5A6068), nL * 2); rl.material.userData.noDim = true;
    for (let i = 0; i < nL; i++) for (let j = 0; j < 2; j++) {
      M0.compose(V(x0 + 1.2 + i * 0.79 + j * 0.08, side * (wallY - bd * 0.62 - j * 0.07), zb - 0.02), new T.Quaternion(), new T.Vector3(1, 1, 1)); rl.setMatrixAt(i * 2 + j, M0);
      M0.compose(V(x0 + 1.32 + i * 0.79 + j * 0.06, side * (wallY - bd * 0.3), zb - 0.02), new T.Quaternion(), new T.Vector3(1, 1, 1)); vent.setMatrixAt(i * 2 + j, M0);
    }
    g.add(rl, vent); (g.userData.rls = g.userData.rls || []).push(rl);
    // the bin door's edge (a darker latch strip with a handle on each door) and the joints between doors
    // the joints between doors, following the door's curve
    const doorPts = prof.filter(p => p[0] > bd * 0.34 && p[1] > 0.002).map((p, i, arr) => { const a2 = arr[Math.max(0, i - 1)], b2 = arr[Math.min(arr.length - 1, i + 1)], tx = b2[0] - a2[0], ty = b2[1] - a2[1], tl = Math.hypot(tx, ty) || 1; return [p[0] - ty / tl * 0.003, p[1] + tx / tl * 0.003]; });
    const seams = new T.InstancedMesh(cabinSweep(doorPts, 0.012), lam2(0xBEC3C9), Math.ceil(len / 1.5)); seams.material.side = T.DoubleSide;
    for (let i = 0; i < seams.count; i++) { M0.copy(Mb).multiply(new T.Matrix4().makeTranslation(0, 0, 0.75 + i * 1.5)); seams.setMatrixAt(i, M0); }
    seams.matrixAutoUpdate = false; g.add(seams);
    const handles = new T.InstancedMesh(new T.BoxGeometry(0.2, 0.035, 0.02), lam2(0x8E949B), Math.ceil(len / 1.5));
    for (let i = 0; i < handles.count; i++) { M0.compose(V(x0 + 1.5 + i * 1.5, side * (wallY - bd - 0.008), zb + bh * 0.2), new T.Quaternion(), new T.Vector3(1, 1, 1)); handles.setMatrixAt(i, M0); }
    g.add(handles);
    // light: a bright line where the bin meets the ceiling, and one along the wall above the windows
    const glow = new T.MeshBasicMaterial({ color: 0xFFFFFF }); glow.userData.noDim = true; (g.userData.glows = g.userData.glows || []).push(glow);
    const up = new T.Mesh(new T.BoxGeometry(len, 0.02, 0.05), glow); up.position.copy(V(x0 + len / 2, side * (wallY - bd * 0.36), zb + hT - 0.012)); g.add(up);
    // the blue mood lighting: a strip under the bins' lip and one along the wall above the windows, and its glow
    // washing down the wall below the bins
    const led = new T.MeshBasicMaterial({ color: 0x2E6BFF, toneMapped: false }); led.userData.noDim = true; (g.userData.leds = g.userData.leds || []).push(led);
    const lip = new T.Mesh(new T.BoxGeometry(len, 0.02, 0.04), led); lip.position.copy(V(x0 + len / 2, side * (wallY - bd * 0.97), zb - 0.006)); g.add(lip);
    const wl = new T.Mesh(new T.BoxGeometry(len, 0.016, 0.03), led); wl.position.copy(V(x0 + len / 2, side * (wallY - 0.02), zb - 0.04)); g.add(wl);
    // the light itself: lines of blue light that light the wall below (from just inside the strip, shining down and
    // out onto the wall), the ceiling above the bins (from the bins' tops, in pools one fixture after another) and,
    // from the lit ceiling, the bins' doors
    const L = (g.userData.lights = g.userData.lights || []);
    L.push({ kind: 'wall', a: V(x0 + 0.2, side * (wallY - 0.16), zb - 0.05), b: V(x1 - 0.2, side * (wallY - 0.16), zb - 0.05), d: _av(0, side * 0.62, -0.78).normalize(), r: 0.75, seg: 0 });
    L.push({ kind: 'cove', a: V(x0 + 0.2, side * (wallY - bd * 0.38), zb + hT - 0.03), b: V(x1 - 0.2, side * (wallY - bd * 0.38), zb + hT - 0.03), d: _av(0, -side * 0.72, 0.69).normalize(), r: 1.1, seg: 1.52 });
    const cy = Math.max(0.3, wallY - bd - 0.25), cz = zc + Math.sqrt(Math.max(0.01, ri * ri - cy * cy)) - 0.08;
    L.push({ kind: 'bins', a: V(x0 + 0.2, side * cy, cz), b: V(x1 - 0.2, side * cy, cz), d: _av(0, side * 0.86, -0.5).normalize(), r: 0.75, seg: 1.52 });
    if (side === -1) V3dCabin.mood = up;
  }
  // the ceiling: two long white light lines down the middle
  { const glow2 = new T.MeshBasicMaterial({ color: 0xFFFFFF }); glow2.userData.noDim = true; (g.userData.glows = g.userData.glows || []).push(glow2);
    for (const sy of [-0.34, 0.34]) { const cz = zc + Math.sqrt(Math.max(0.01, ri * ri - sy * sy)) - 0.04; const ln = new T.Mesh(new T.BoxGeometry(len, 0.008, 0.06), glow2); ln.position.copy(V(x0 + len / 2, sy, cz)); g.add(ln); } }
  // the windows along both walls
  const pitch = Math.max(0.45, s.win.pitch || 0.53), nW = Math.floor((s.win.to - s.win.from) / pitch), zW = Math.min(zf + 1.12, zc + ri * 0.2);   // window middle about 1.1 m above the floor, as in real cabins
  if (!V3dCabinF.winTex) { const cv = document.createElement('canvas'); cv.width = 64; cv.height = 96; const x = cv.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, 64, 96); x.fillStyle = '#fff'; x.beginPath(); (x as any).roundRect ? (x as any).roundRect(4, 4, 56, 88, 24) : x.rect(4, 4, 56, 88); x.fill(); V3dCabinF.winTex = new T.CanvasTexture(cv); }
  const winGeo = new T.PlaneGeometry(st.ww * 1.08, st.wh * 1.06), winMat = cabinOutsideMat() || new T.MeshBasicMaterial({ color: 0xFFFFFF, map: cabinSkyTex(), alphaMap: V3dCabinF.winTex, transparent: true, fog: false }); winMat.userData.noDim = true;
  const wins = new T.InstancedMesh(winGeo, winMat, nW * 2), M = new T.Matrix4(), Q = new T.Quaternion(), S = new T.Vector3(1, 1, 1);
  let wi = 0;
  // each window: its frame set into the wall panel, 7 cm in from the cabin's curved wall (room for the reveal)
  const WR = cabWinParts(st, 'row'), WMr = cabWinMats(), frames: any[] = [], IN = 0.045;
  const yw = Math.sqrt(Math.max(0, ri * ri - (zW - zc) * (zW - zc))), cT = yw / ri, sT = (zW - zc) / ri, dIn = 0.02 + IN;
  for (let i = 0; i < nW; i++) for (const side of [-1, 1]) {
    // facing straight out of the curved wall where it is (the wall leans in above the middle of the cabin)
    const ax = V(side, 0, 0), az = V(0, -side * cT, -sT), ay = new T.Vector3().crossVectors(az, ax);
    M.makeBasis(ax, ay, az); M.setPosition(V(s.win.from + i * pitch, side * (yw - dIn * cT), zW - dIn * sT));
    frames.push(M.clone());
    const Mo = M.clone().multiply(new T.Matrix4().makeTranslation(0, 0, WR.back - 0.004));   // the view out: just behind the pane
    wins.setMatrixAt(wi++, Mo);
  }
  g.add(wins); g.userData.wins = wins;
  {
    const sm = shell.material, ob = sm.onBeforeCompile; shell.updateMatrix();
    const U = { uSh: { value: shell.matrix.clone() }, uWn: { value: new T.Vector3(s.win.from, pitch, nW) }, uWc: { value: new T.Vector3(zc, Math.asin(clamp(sT, -1, 1)), ri) },
      uWh: { value: new T.Vector3(st.ww / 2 + 0.085, st.wh / 2 + 0.085, Math.min(st.ww, st.wh) * st.round + 0.085) } };
    sm.onBeforeCompile = (sh: any, r: any) => { ob(sh, r); Object.assign(sh.uniforms, U);
      sh.vertexShader = 'uniform mat4 uSh; varying vec3 vAc;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  { vec4 pg = uSh * vec4(transformed, 1.0); vAc = vec3(pg.x, -pg.z, pg.y); }');
      sh.fragmentShader = 'uniform vec3 uWn; uniform vec3 uWc; uniform vec3 uWh; varying vec3 vAc;\n' + sh.fragmentShader.replace('void main() {', `void main() {
  { float k = floor((vAc.x - uWn.x) / uWn.y + 0.5);
    if (k >= 0.0 && k < uWn.z) {
      float ax = abs(vAc.x - (uWn.x + k * uWn.y)), ay = abs(atan(vAc.z - uWc.x, abs(vAc.y)) - uWc.y) * uWc.z;
      vec2 q = vec2(ax, ay) - (uWh.xy - uWh.z);
      if (length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) < uWh.z) discard; } }`); };
    sm.customProgramCacheKey = () => 'cab-shell-holes'; sm.needsUpdate = true;
  }
  // the surrounds and the seals: every window in one draw each
  const nF = frames.length, inst = (geo: any, m: any, at: (i: number, M: any) => any) => { const im = new T.InstancedMesh(geo, m, nF); for (let i = 0; i < nF; i++) im.setMatrixAt(i, at(i, frames[i])); im.instanceMatrix.needsUpdate = true; g.add(im); return im; };
  inst(WR.ring, WMr.ring, (i, F) => F); inst(WR.seal, WMr.seal, (i, F) => F);
  // the shades: most up, some halfway, a few down (as on a real flight); at night more of them down
  if (st.shade === 'blind') {
    const night = (() => { try { return ((V3dSky as any).U ? (V3dSky as any).U.uNight.value : 0) > 0.6; } catch (e) { return false; } })();
    // from the front of the cabin to just behind the wing, every shade can be pulled up and down (a click on the
    // window); further back they are drawn down and stay so. Not all are open to start with.
    const wingAft = s.wing.x + s.wing.root + 1.2, live: boolean[] = [];
    const ks = frames.map((F, i) => {
      const xi = s.win.from + Math.floor(i / 2) * pitch, r2 = cloudHash(i, 7, 911); live[i] = xi <= wingAft;
      if (!live[i]) return r2 < 0.86 ? 1 : 0.02;
      return r2 < (night ? 0.45 : 0.26) ? 1 : r2 < (night ? 0.58 : 0.38) ? 0.5 : 0.02; });
    const SH: any = { k: ks, to: ks.slice(), from: ks.slice(), p: ks.map(() => 1), live, frames, moving: [] as number[] };
    SH.at = (i: number, F: any, sh: boolean) => { const y = cabWinShadeY(WR, SH.k[i]); return F.clone().multiply(new T.Matrix4().compose(new T.Vector3(0, y, WR.shadeZ), new T.Quaternion(), new T.Vector3(1, sh ? cabWinShadeH(WR, y) : 1, 1))); };   // only the part below the window's top shows (the rest is rolled up out of sight)
    SH.ims = [inst(WR.shade, WMr.shade, (i, F) => SH.at(i, F, true)), inst(WR.lip, WMr.lip, (i, F) => SH.at(i, F, false)), inst(WR.grip, WMr.lip, (i, F) => SH.at(i, F, false))];
    for (const im of SH.ims) im.userData.shades = true;
    g.userData.shades = SH;
  }
  // every window shade is up: the view out of each one
  // the seats, row by row, from the passenger list's layout (first class and business at the front, wider)
  const list: PaxSeat[] = f ? (() => { try { return manifestOf(f); } catch (e) { return []; } })() : [];
  const rowCls: { [r: number]: string } = {}; let maxRow = 0;
  for (const p of list) { const r = parseInt(p.seat, 10); if (r > maxRow) maxRow = r; if (!rowCls[r] || p.cls !== 'Y') rowCls[r] = p.cls; }
  const pitchOf = (c: string) => c === 'F' ? 1.5 : c === 'J' ? 1.0 : 0.79;
  // every passenger on the list has a seat: the rows fit the cabin, with the seats a little closer together
  // where needed (down to 28 inches); only beyond that is a passenger left out (never without a seat)
  let need = 0; for (let r = 1; r <= maxRow; r++) need += pitchOf(rowCls[r] || 'Y');
  const room = (x1 - 1.6) - (x0 + 1.4), squeeze = need > room ? Math.max(0.89, room / need) : 1;
  // as many rows as the aircraft really has (its seats), the empty seats too; the seats are spaced to fill the
  // cabin a little more generously where it is long, and the rest is galley space at the back
  const nPrem = list.filter(p => p.cls !== 'Y').length, yStart = (() => { const ys = list.filter(p => p.cls === 'Y').map(p => parseInt(p.seat, 10)); return ys.length ? Math.min(...ys) : maxRow + 1; })();
  const capRows = Math.max(maxRow, yStart - 1 + Math.ceil(Math.max(0, (t.seats || 150) - nPrem) / abreast));
  let needCap = 0; for (let r = 1; r <= capRows; r++) needCap += pitchOf(rowCls[r] || 'Y');
  const stretch = needCap < room ? Math.min(1.12, room / needCap) : 1;
  let rows = Math.max(maxRow, 1), x = x0 + 1.4; const rowX: number[] = [], rowsCls: string[] = [];
  for (let r = 1; r <= capRows && x < x1 - 1.6 + 0.01; r++) { const c = rowCls[r] || 'Y'; rowX[r] = x; rowsCls[r] = c; x += pitchOf(c) * squeeze * stretch; rows = r; }
  const width = ri * 2 * 0.9, aisles = blocks.length - 1, aisles0 = aisles, aisleW = 0.5, seatW = (width - aisles * aisleW) / abreast;
  const seatY: number[] = []; let yy = -width / 2;
  blocks.forEach((b, bi) => { for (let k = 0; k < b; k++) { seatY.push(yy + seatW * (k + 0.5)); } yy += b * seatW + (bi < aisles ? aisleW : 0); });
  const aisleY = blocks.length > 1 ? -width / 2 + blocks[0] * seatW + aisleW / 2 : 0;
  const seatColor = new T.Color(0xD5D8DC), headDark = new T.Color(0x2B2E34), premColor = new T.Color(st.seat).lerp(new T.Color(0x1C2433), 0.4), headColor = new T.Color(st.head); void headColor;
  const nSeats = rows * abreast;
  // a seat seen from the side (forward is −x): cushion, a back curving to a rounded top, the shell behind;
  // drawn out across the seat's width, its edges softly rounded
  if (!V3dCabinF.seatGeo || V3dCabinF.seatQ !== cabinQ()) {
    V3dCabinF.seatQ = cabinQ();
    const pr = [[-0.25, 0.4], [-0.26, 0.5], [-0.2, 0.54], [0.12, 0.55], [0.17, 0.6], [0.21, 0.98], [0.24, 1.05], [0.3, 1.06], [0.32, 1.0], [0.3, 0.62], [0.27, 0.4], [0.22, 0.12], [0.19, 0.12], [0.15, 0.36]];
    const sh = new T.Shape(cabinSmooth(pr, cabinQv([0, 36, 60, 96])));
    const geo = new T.ExtrudeGeometry(sh, { depth: 0.86, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.03, bevelSegments: cabinQv([1, 2, 3, 4]), curveSegments: 4 });
    geo.translate(0, 0, -0.43); geo.scale(1, 1, 1 / 0.93);   // centred across, one metre wide before scaling
    { const P = geo.attributes.position; for (let i = 0; i < P.count; i++) { const y = P.getY(i); if (y > 0.75) P.setZ(i, P.getZ(i) * (1 - 0.12 * (y - 0.75) / 0.31)); } geo.computeVertexNormals(); }   // the back narrows towards the shoulders
    V3dCabinF.seatGeo = geo;
    // the headrest: padded, with wings at the sides, seen from behind as in a real cabin
    const hs = new T.Shape(); hs.moveTo(-0.22, 0); hs.lineTo(0.22, 0); hs.quadraticCurveTo(0.27, 0.02, 0.27, 0.1); hs.lineTo(0.26, 0.2); hs.quadraticCurveTo(0.25, 0.26, 0.18, 0.26); hs.lineTo(-0.18, 0.26); hs.quadraticCurveTo(-0.25, 0.26, -0.26, 0.2); hs.lineTo(-0.27, 0.1); hs.quadraticCurveTo(-0.27, 0.02, -0.22, 0);
    const hg = new T.ExtrudeGeometry(hs, { depth: 0.11, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.02, bevelSegments: cabinQv([1, 3, 5, 8]), curveSegments: cabinQv([3, 8, 14, 24]) });
    hg.rotateY(-Math.PI / 2); hg.translate(0.28, 1.0, 0); hg.scale(1, 1, 1.5 / 0.93);
    V3dCabinF.headGeo = hg;
  }
  // the seat's frame and shell (light moulded plastic) and its upholstered parts: back and seat cushions,
  // headrest, grab handle, armrests with padded tops (v3d-seat.ts)
  const SP = cabinSeatParts(seatW * 0.94, st), seatUp = new T.Color(st.seat), premUp = premColor, shellC = new T.Color(0xD9DCE0);
  const cush = new T.InstancedMesh(V3dCabinF.seatGeo, cabinMat(0xFFFFFF, { map: cabinSatinTex() }), nSeats);
  const arm = new T.InstancedMesh(SP.arm, SP.armM, nSeats + 40), pad = new T.InstancedMesh(SP.pad, SP.padM, nSeats + 40);
  let k = 0, na = 0; const seatAt: { [k: string]: any } = {}, armAt: { [k: string]: boolean } = {}, seatList: any[] = [];
  for (let r = 1; r <= rows; r++) {
    const c = rowsCls[r], prem = c !== 'Y', n = prem ? Math.max(2, abreast - 2) : abreast;
    for (let i = 0; i < abreast; i++) {
      // premium rows leave out middle seats (wider seats at the window and aisle)
      const skip = prem && n < abreast && ((abreast === 6 && (i === 1 || i === 4)) || (abreast === 4 && false) || (abreast >= 9 && (i === 1 || i === abreast - 2)));
      if (skip) continue;
      const sy = seatY[i] + (prem && abreast === 6 ? (i < 3 ? 0.12 : -0.12) * (i === 0 || i === 5 ? -1 : 1) : 0), wS = prem ? seatW * 1.35 : seatW * 0.94, X = rowX[r];
      const q = new T.Quaternion(), pk = prem ? 1.25 : 1, ws = wS / (seatW * 0.94);
      M.compose(V(X, sy, zf), q, new T.Vector3(pk, pk, wS)); cush.setMatrixAt(k, M); cush.setColorAt(k, shellC);
      // the upholstered parts are placed per frame by detail (cabinSeatLod)
      seatList.push({ x: X, y: sy, M: new T.Matrix4().compose(V(X, sy, zf), q, new T.Vector3(pk, pk, ws)), up: prem ? premUp : seatUp, hc: prem ? new T.Color(0.8, 0.8, 0.84) : new T.Color(1, 1, 1), f: -1, slot: -1 });
      // armrests between the seats: one each, shared by neighbours
      for (const sd of [-1, 1]) {
        const ay = sy + sd * wS * 0.5, ak = r + '|' + Math.round(ay * 50);
        if (armAt[ak] || na >= arm.count) continue; armAt[ak] = true;
        M.compose(V(X, ay, zf), q, new T.Vector3(pk, pk, 1)); arm.setMatrixAt(na, M); pad.setMatrixAt(na, M); na++;
      }
      seatAt[r + letters[i]] = { x: X, y: sy, prem }; k++;
    }
  }
  cush.count = k; arm.count = pad.count = na;
  if (cush.instanceColor) cush.instanceColor.needsUpdate = true;
  // two sets of the upholstered parts: the detailed seats (as many as fit in the detail range around you) and the
  // light ones (every seat); each seat fades between them
  { const R = cabinSeatRange(), allHi = R > 1e8 || SP.hi === SP.lo, nHi = allHi ? k : R <= 0 ? 0 : Math.min(k, Math.ceil((R * 2 + 2) / 0.74 + 2) * abreast + abreast * 2);
    const set = (G2: any, n: number) => ({ back: seatMesh(G2.back, SP.backM, n), seat: seatMesh(G2.seat, SP.seatM, n), head: seatMesh(G2.head, SP.headM, n), handle: seatMesh(G2.handle, SP.handleM, n) });
    const hiS = nHi ? set(SP.hi, nHi) : null, loS = allHi ? null : set(SP.lo, k);
    for (const S2 of [hiS, loS]) if (S2) for (const key in S2) g.add(S2[key]);
    if (loS) seatList.forEach((sd, i) => { for (const key in loS) { const m = (loS as any)[key]; m.setMatrixAt(i, sd.M); if (key !== 'handle') m.setColorAt(i, key === 'head' ? sd.hc : sd.up); m.count = k; } });
    if (allHi && hiS) seatList.forEach((sd, i) => { sd.f = 1; sd.slot = i; for (const key in hiS) { const m = (hiS as any)[key]; m.setMatrixAt(i, sd.M); if (key !== 'handle') m.setColorAt(i, key === 'head' ? sd.hc : sd.up); m.count = k; } });
    g.userData.seatLod = { list: seatList, hi: hiS, lo: loS, R, allHi, slots: new Array(nHi).fill(-1) }; }
  g.add(arm, pad);
  // the back of every seat: the tray table and its latch, the pocket, and on long-haul cabins the screen
  const longHaul = abreast >= 7 || /a350|b777|b787|b747/.test(s.cockpit);
  // the back of every seat: a light moulded shell with the screen (long haul) or a phone holder, the tray table
  // with its latch, the pocket and a coat hook, as on a modern slimline seat
  const backTex = cabinSeatBackTex(longHaul), panel = new T.InstancedMesh(new T.PlaneGeometry(1, 1), cabinMat(0xFFFFFF, { map: backTex }), k);
  let t2 = 0; const qp = new T.Quaternion().setFromEuler(new T.Euler(0, 0, -0.04)).multiply(new T.Quaternion().setFromEuler(new T.Euler(0, Math.PI / 2, 0)));
  for (const key in seatAt) {
    const a = seatAt[key]; if (a.prem) continue;
    M.compose(V(a.x + 0.37, a.y, zf + 0.8), qp, new T.Vector3(seatW * 0.82, 0.54, 1)); panel.setMatrixAt(t2++, M);   // just behind the shell
  }
  panel.count = t2; g.add(panel);
  g.add(cush);
  // the passengers
  if (cabinPeopleOn() && list.length) { const pg = cabinPeople(list, seatAt, zf, V); g.add(pg); g.userData.people = pg; }
  g.userData.pax = { list: list.length, seated: list.filter(p => seatAt[p.seat]).length };
  g.traverse((m: any) => { m.frustumCulled = false; m.renderOrder = 40; });
  g.userData.eye = [x1 - 0.3, aisleY, zf + 1.7]; g.userData.look = [x0 + 2, aisleY, zf + 0.7];
  // for the cabin crew: the aisle, the floor, the galleys and the rows with passengers in them
  { const paxRows: number[] = []; for (const p of list) { const r = parseInt(p.seat, 10); if (seatAt[p.seat] && paxRows.indexOf(r) < 0) paxRows.push(r); } paxRows.sort((a, b) => a - b);
    const aisles: number[] = []; { let yy2 = -width / 2; blocks.forEach((b, bi) => { yy2 += b * seatW; if (bi < aisles0) { aisles.push(yy2 + aisleW / 2); yy2 += aisleW; } }); }
    const rk = Object.keys(rowX).map(Number), firstX = rk.length ? rowX[Math.min(...rk)] : x0 + 1.4, lastX = rk.length ? rowX[Math.max(...rk)] : x1 - 1.6;
    g.userData.crewAt = { aisleY, aisles, zf, x0, x1, rowX, paxRows, mood: st.mood, firstX, lastX, half: width / 2 + 0.05 };
    // the row numbers and seat letters, on a lit placard under the bins at the aisle side of each block of seats,
    // as on board (passengers find their seats by them)
    // twin-aisle cabins: a row of bins over the middle block too, hanging from the ceiling
    if (aisles.length >= 2 && g.userData.bin && st.bin !== 'none') { try { cabinCentreBins(g, x0, len, aisles[0] + aisleW / 2, aisles[aisles.length - 1] - aisleW / 2, g.userData.bin.zb, binH * 1.2, mBin, V); } catch (e) { /* no centre bins */ } }
    try { const lab = cabinRowLabels(rowX, blocks, letters, seatY, seatW, aisles, zf, V, g.userData.bin); if (lab) g.add(lab); } catch (e) { /* no placards */ } }
  return g;
}

/** The people in their seats: torso, arms, neck, head and hair, in a few shared shapes. */
function cabinPeople(list: PaxSeat[], seatAt: any, zf: number, V: (x: number, y: number, z: number) => any): any {
  const T = THREE, g = new T.Group();
  if (!_people.torso || _people.q !== cabinQ()) {
    _people.q = cabinQ(); const sg = cabinQv([8, 14, 22, 32]);
    _people.torso = new T.LatheGeometry([[0.0, 0], [0.16, 0.02], [0.17, 0.2], [0.18, 0.4], [0.17, 0.5], [0.12, 0.56], [0.05, 0.58]].map(p => new T.Vector2(p[0], p[1])), sg).scale(0.68, 1, 1);   // shoulders wide across, slimmer front to back
    _people.head = new T.SphereGeometry(0.105, sg + 2, Math.round(sg * 0.75)).scale(0.9, 1.1, 1);
    _people.hair = new T.SphereGeometry(0.112, sg + 2, Math.round(sg * 0.65), 0, Math.PI * 2, 0, 1.75).scale(0.92, 1.1, 1.02);
    _people.long = new T.CylinderGeometry(0.1, 0.12, 0.26, 12, 1, true, -Math.PI * 0.55, Math.PI * 1.1);
    _people.arm = new T.CylinderGeometry(0.045, 0.04, 0.44, Math.max(6, sg >> 1));
    _people.neck = new T.CylinderGeometry(0.045, 0.05, 0.1, Math.max(6, sg >> 1));
    _people.thigh = new T.CylinderGeometry(0.07, 0.06, 0.42, Math.max(6, sg >> 1));
    _people.shin = new T.CylinderGeometry(0.055, 0.045, 0.42, Math.max(6, sg >> 1));   // lower legs (they walk in and out)
    _people.petBody = new T.SphereGeometry(0.1, 12, 8).scale(1.5, 0.9, 0.9);
    _people.petHead = new T.SphereGeometry(0.065, 12, 8);
    _people.ear = new T.ConeGeometry(0.025, 0.06, 6);
  }
  const ok = list.filter(p => seatAt[p.seat]);
  // each part's own copy of the shape, with a fade for every person (they fade in and out at the door)
  const n = ok.length, mk = (geo0: any, count: number) => {
    const geo = geo0.clone(), cnt = Math.max(1, count), fade = new T.InstancedBufferAttribute(new Float32Array(cnt).fill(1), 1); fade.setUsage(T.DynamicDrawUsage); geo.setAttribute('aFade', fade);
    const mt = cabinMat(0xffffff); mt.alphaHash = true; mt.userData.noDim = true;
    const ob = mt.onBeforeCompile; mt.onBeforeCompile = (sh: any, r: any) => { ob(sh, r);
      sh.vertexShader = 'attribute float aFade;\nvarying float vFade;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vFade = aFade;');
      sh.fragmentShader = 'varying float vFade;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.a *= vFade;'); };
    mt.customProgramCacheKey = () => 'cabin-pax';
    const m = new T.InstancedMesh(geo, mt, cnt); m.count = 0; g.add(m); return m; };
  const torso = mk(_people.torso, n), headM = mk(_people.head, n), hairM = mk(_people.hair, n), longM = mk(_people.long, n), arms = mk(_people.arm, n * 2), neck = mk(_people.neck, n), thighs = mk(_people.thigh, n * 2), shins = mk(_people.shin, n * 2);
  const pets = ok.filter(p => p.pet && !p.pet.left && p.pet.where === 'cabin'), petB = mk(_people.petBody, pets.length), petH = mk(_people.petHead, pets.length), ears = mk(_people.ear, pets.length * 2);
  const M = new T.Matrix4(), Q = new T.Quaternion(), E = new T.Euler(), one = new T.Vector3(1, 1, 1), C = new T.Color();
  const put = (m: any, pos: any, rot: number[], sc: any, col: any) => { E.set(rot[0], rot[1], rot[2]); Q.setFromEuler(E); M.compose(pos, Q, sc); m.setMatrixAt(m.count, M); m.setColorAt(m.count, col); m.count++; return m.count - 1; };
  // who is where: for tapping a passenger, and for turning their head when the crew talks to them
  const who: any[] = []; g.userData.who = who; g.userData.meshes = { torso, head: headM, hair: hairM };
  // every person's parts, so they can stand up, walk and sit down (v3d-cabinpax.ts)
  const figs: any[] = []; g.userData.figs = figs; g.userData.parts = { torso, neck, head: headM, hair: hairM, long: longM, arms, thighs, shins, petB, petH, ears }; g.userData.seatAt = seatAt; g.userData.zf = zf;
  for (const p of ok) {
    const at = seatAt[p.seat], L = p.look || {}, kid = p.age < 12 ? 0.72 : p.age < 16 ? 0.88 : 1, fem = p.sex === 'f' ? 0.93 : 1, sc = kid * fem;
    const skin = new T.Color(SKIN_TONES[L.skin == null ? 2 : L.skin] || '#D9A07A'), hairC = new T.Color(HAIR_COLORS[L.hairColor == null ? 1 : L.hairColor] || '#3A2A1E');
    const cloth = new T.Color(UNIFORM_COLORS[L.uniform || 0] || '#2F5D8C').lerp(new T.Color(cloudHash(p.key.length * 7, p.age, 3) < 0.5 ? 0xD8D2C4 : 0x5E6A78), 0.25 + cloudHash(p.key.length, p.age, 9) * 0.4);
    const seatZ = zf + 0.5, lean = -0.17;   // leaning back into the seat
    const bx = at.x - 0.045 * (at.prem ? 1.25 : 1), y = at.y;   // the back and head just in front of the seat back and headrest, never through them
    put(torso, V(bx, y, seatZ), [0, 0, lean], new T.Vector3(sc * (p.sex === 'f' ? 0.92 : 1), sc, sc), cloth);
    const shoulderZ = seatZ + 0.56 * sc, headX = bx + Math.sin(-lean) * 0.6 * sc;
    put(neck, V(headX, y, shoulderZ + 0.05 * sc), [0, 0, lean], new T.Vector3(sc, sc, sc), skin);
    const hp = V(headX - 0.01, y, shoulderZ + 0.16 * sc);
    const fig: any = { p, at, sc, fem: p.sex === 'f' ? 0.92 : 1, lean, ti: torso.count - 1, ni: neck.count - 1, hi: -1, ri: -1, li: -1, ai: arms.count, gi: thighs.count, si: shins.count, pet: null, hairK: L.hair === 'afro' ? 1 : L.hair === 'buzz' ? 2 : 0 };
    const hi = put(headM, hp, [0, 0, lean * 0.5], new T.Vector3(sc, sc, sc), skin); let ri = -1; fig.hi = hi;
    who.push({ p, hi, head: hp.clone(), sc, lean, seatY: at.y });
    if (L.hair !== 'bald' && L.hair !== 'buzz') {
      ri = put(hairM, V(headX + 0.012, y, shoulderZ + 0.175 * sc), [0, 0, lean * 0.5 - 0.25], new T.Vector3(sc * (L.hair === 'afro' ? 1.25 : 1), sc * (L.hair === 'afro' ? 1.2 : 1), sc * (L.hair === 'afro' ? 1.25 : 1)), hairC);
      if (/long|wavy|braids|ponytail|curly/.test(L.hair || '') && p.sex === 'f') fig.li = put(longM, V(headX + 0.05, y, shoulderZ + 0.04 * sc), [0, 0, lean], new T.Vector3(sc, sc, sc), hairC);
    } else if (L.hair === 'buzz') ri = put(hairM, V(headX + 0.012, y, shoulderZ + 0.17 * sc), [0, 0, lean * 0.5 - 0.25], new T.Vector3(sc * 0.97, sc * 0.97, sc * 0.97), C.copy(hairC).lerp(skin, 0.4));
    who[who.length - 1].ri = ri; fig.ri = ri; figs.push(fig);
    for (const sd of [-1, 1]) {
      put(arms, V(bx - 0.06, y + sd * 0.2 * sc, seatZ + 0.3 * sc), [sd * 0.08, 0, -0.5], new T.Vector3(sc, sc, sc), cloth);
      put(thighs, V(at.x - 0.12, y + sd * 0.09 * sc, seatZ + 0.03), [0, 0, Math.PI / 2], new T.Vector3(sc, sc, sc), C.set(0x2E3540));
      put(shins, V(at.x - 0.33, y + sd * 0.09 * sc, zf + 0.265), [0, 0, 0], new T.Vector3(sc, 0.53 / 0.42, sc), C.set(0x2E3540));
    }
    // a pet on the lap, looking about
    if (p.pet && !p.pet.left && p.pet.where === 'cabin') {
      const pc = new T.Color(p.pet.color || '#8B5A2B'), dog = p.pet.kind === 'dog';
      fig.pet = { b: petB.count, h: petH.count, e: ears.count };
      put(petB, V(at.x - 0.18, y, seatZ + 0.17), [0, 0.4, 0], new T.Vector3(dog ? 1 : 0.85, 1, 1), pc);
      put(petH, V(at.x - 0.3, y + 0.04, seatZ + 0.27), [0, 0, 0], one, pc);
      for (const sd of [-1, 1]) put(ears, V(at.x - 0.3, y + 0.04 + sd * 0.04, seatZ + 0.34), [dog ? sd * 0.5 : 0, 0, 0], new T.Vector3(1, dog ? 0.8 : 1.1, 1), pc);
    }
  }
  for (const m of g.children) { if (m.instanceMatrix) m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  return g;
}

/** Each frame in the cabin view: the camera at the back of the aisle, looking forward; a drag looks around a little. */
function v3dCabinFwdCam(P: any) {
  const T = THREE, s = shapeOf(P.type), body = P.model.userData.body; if (!body) return;
  const f = State.live.filter(x => x.id === P.id)[0] || null, key = P.id + '|' + P.type + '|' + (f ? f.pax : 0) + '|' + cabinPeopleOn() + '|' + cabinQ() + '|' + cabinSeatRange();
  if (V3dCabinF.key !== key || !V3dCabinF.grp || V3dCabinF.grp.parent !== body) {
    if (V3dCabinF.grp && V3dCabinF.grp.parent) V3dCabinF.grp.parent.remove(V3dCabinF.grp);
    V3dCabinF.grp = cabinFwdBuild(P, s, f); V3dCabinF.key = key; body.add(V3dCabinF.grp);
  }
  const G = V3dCabinF.grp; G.visible = true; cabinSharp(true);
  // inside, the clouds and the rain outside can't be seen (the windows show the light outside)
  try { if (V3dClouds.mesh) V3dClouds.mesh.visible = false; if (V3dWx.rain) V3dWx.rain.visible = false; if (V3dWx.snow) V3dWx.snow.visible = false; if (V3dSky.flare) (V3dSky.flare as HTMLElement).style.opacity = '0'; } catch (e) { /* none */ }
  // inside, only the cabin is drawn: the outside of this aircraft is hidden
  for (const c of body.children) if (c !== G && c.visible) { c.visible = false; (c.userData as any).hiddenForCabin = true; }
  P.model.updateMatrixWorld(true);
  const q = P.model.getWorldQuaternion(new T.Quaternion()), up = new T.Vector3(0, 1, 0).applyQuaternion(q);
  if (V3d.mode === 'walk') cabinWalkCam(P, G, body, up);   // walking about inside (v3d-walk.ts)
  else {
    const e = G.userData.eye, l = G.userData.look, at = body.localToWorld(_av(e[0], e[1], e[2])), to = body.localToWorld(_av(l[0], l[1], l[2]));
    const dir = to.clone().sub(at).normalize(), side = new T.Vector3().crossVectors(dir, up).normalize();
    dir.applyAxisAngle(up, -V3d.yaw).applyAxisAngle(side, clamp(V3d.pitch, -0.9, 0.6));   // look all the way round the cabin
    V3d.cam.position.copy(at); V3d.cam.up.copy(up); V3d.cam.lookAt(at.clone().add(dir)); V3d.cam.up.set(0, 1, 0);
  }
  if (V3d.cam.fov !== 70 || V3d.cam.near > 0.03) { V3d.cam.fov = 70; (V3d as any).nearWas = (V3d as any).nearWas || V3d.cam.near; V3d.cam.near = 0.02; V3d.cam.updateProjectionMatrix(); }
  // light: the cabin's own lights (warmer at night, a touch brighter by day with the windows' light)
  const night = (V3dSky as any).U ? (V3dSky as any).U.uNight.value : 0, amb = (V3dSky as any).amb || 1;
  // at night the cabin is dimmed, as airlines do: a low glow of mood lighting along the ceiling and above the
  // windows, and here and there a passenger's reading light
  const dim = night * 0.86;
  CabinLight.self.value = 0.7 * (1 - dim) + 0.07 * dim;
  const md = new T.Color(G.userData.crewAt ? G.userData.crewAt.mood : 0xBFD8FF);
  CabinLight.warm.value.setRGB(1 - dim * (1 - md.r * 0.75), 0.99 - dim * (1 - md.g * 0.7), 0.98 - dim * (1 - md.b * 0.95));
  // the white light lines are switched down at night, leaving a faint blue glow
  for (const gm of G.userData.glows || []) gm.color.setRGB(1, 1, 1).lerp(new T.Color(0.1, 0.22, 0.6), Math.min(1, dim / 0.86));
  // the blue mood lighting stays on, a little softer at night
  for (const lm of G.userData.leds || []) lm.color.setRGB(0.18, 0.42, 1).multiplyScalar(1 - dim * 0.4);
  cabinMoodLights(G, dim);
  try { cabinSeatLod(G); } catch (e) { /* stays as it is */ }
  if (Math.abs((G.userData.nightWas == null ? -1 : G.userData.nightWas) - dim) > 0.05) {
    G.userData.nightWas = dim;
    for (const rl of G.userData.rls || []) { const first = !rl.instanceColor; for (let i = 0; i < rl.count; i++) { const on = cloudHash(i, rl.count, 77) < 0.14 || dim < 0.3; rl.setColorAt(i, new T.Color(on ? 0xFFF1D6 : 0x3A3E46)); } if (rl.instanceColor) rl.instanceColor.needsUpdate = true; if (first) rl.material.needsUpdate = true; }
  }
  try { cabinCrewStep(P, G, night); } catch (e) { /* the crew stays where it is */ }
  try { const tn = performance.now() / 1000, CP: any = CabinPax; const dtp = Math.min(0.1, Math.max(0, tn - (CP.lastT || tn))); CP.lastT = tn; cabinPaxStep(P, G, dtp); } catch (e) { /* passengers stay where they are */ }
  try { const CH: any = CabinHD, tn2 = performance.now() / 1000, dth = Math.min(0.1, Math.max(0, tn2 - (CH.lastT || tn2))); CH.lastT = tn2; cabinHdStep(G, dth); } catch (e) { /* the simple figures stay */ }
  try { const tn3 = performance.now() / 1000, dts = Math.min(0.1, Math.max(0, tn3 - (G.userData.shT || tn3))); G.userData.shT = tn3; cabShadeFrame(G, dts); } catch (e) { /* the shades stay */ }
  if (G.userData.wins && G.userData.wins.material.color) { const k = Math.max(0.08, Math.min(1, amb)); G.userData.wins.material.color.setRGB(k * (1 - 0.6 * night), k * (1 - 0.5 * night), k); }
}
function v3dCabinFwdLeave(P: any) {
  try { cabinCrewFree(); } catch (e) { /* none */ }
  cabinFree(V3dCabinF.grp); V3dCabinF.grp = null; V3dCabinF.key = ''; cabinSharp(false);
  const body = P && P.model && P.model.userData.body;
  if (body) for (const c of body.children) if ((c.userData as any).hiddenForCabin) { c.visible = true; (c.userData as any).hiddenForCabin = false; }
  if ((V3d as any).nearWas) { V3d.cam.near = (V3d as any).nearWas; (V3d as any).nearWas = 0; V3d.cam.updateProjectionMatrix(); }
}

/* ---------- cabin materials ----------
 * Real-looking surfaces, drawn by the app itself (no photos, no makers' or airlines' designs): woven seat
 * fabric with seams and piping, leather headrest covers, airline carpet, sidewall laminate with panel joints
 * and shading from the window belt down to the dark lower wall, a perforated ceiling with cove lighting,
 * satin bin doors, and the sky in the windows. Made once and shared by every cabin. */
const CabinTex: any = {};
function cabinCanvas(w: number, h: number, draw: (g: CanvasRenderingContext2D, img: ImageData, d: Uint8ClampedArray) => void, repeat?: number[]): any {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d'), img = g.createImageData(w, h);
  draw(g, img, img.data);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 8; if (repeat) tex.repeat.set(repeat[0], repeat[1]);
  return tex;
}
/** Smooth noise for the textures (cheap value noise, tiling). */
function cabinNoise(x: number, y: number, p: number, seed: number): number {
  const h = (i: number, j: number) => cloudHash(((i % p) + p) % p, ((j % p) + p) % p, seed);
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = h(ix, iy), b = h(ix + 1, iy), c = h(ix, iy + 1), e = h(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + e) * ux * uy;
}
/** Woven seat fabric: a fine twill with flecks of colour, slightly worn in the middle of the tile. White, so
 *  the seat's own colour tints it (each class its own colour). */
function cabinFabricTex(): any {
  return CabinTex.fabric || (CabinTex.fabric = cabinCanvas(256, 256, (g, img, d) => {
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      const tw = ((x + y) % 4 < 2 ? 1 : 0.86) * ((x - y + 512) % 6 < 3 ? 1 : 0.95);   // twill: diagonal ribs
      const fl = cloudHash(x, y, 77) > 0.985 ? 1.18 : cloudHash(x, y, 78) < 0.015 ? 0.78 : 1;   // flecks
      const hz = 0.9 + 0.1 * cabinNoise(x / 32, y / 32, 8, 5) + 0.04 * cabinNoise(x / 6, y / 6, 43, 6);   // heather
      const v = Math.min(255, 228 * tw * fl * hz), i = (y * 256 + x) * 4;
      d[i] = v; d[i + 1] = v; d[i + 2] = v; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, [3, 3]));
}
/** Leather for the headrest covers and armrests: fine pebbled grain. */
function cabinLeatherTex(): any {
  return CabinTex.leather || (CabinTex.leather = cabinCanvas(256, 256, (g, img, d) => {
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      const n = cabinNoise(x / 3.2, y / 3.2, 80, 9), n2 = cabinNoise(x / 14, y / 14, 18, 10);
      const v = Math.min(255, 205 + 40 * Math.pow(n, 1.5) + 14 * n2), i = (y * 256 + x) * 4;
      d[i] = v; d[i + 1] = v; d[i + 2] = v; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, [4, 4]));
}
/** Airline carpet: a dense loop pile in blue-grey with a small woven pattern and darker wear down the aisle. */
function cabinCarpetTex(): any {
  return CabinTex.carpet || (CabinTex.carpet = cabinCanvas(256, 256, (g, img, d) => {
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      const pile = 0.82 + 0.18 * cloudHash(x, y, 31) * cabinNoise(x / 2, y / 2, 128, 32);
      const pat = ((Math.floor(x / 16) + Math.floor(y / 16)) % 2 ? 1 : 0.93) * (Math.abs(((x % 32) - 16)) + Math.abs(((y % 32) - 16)) < 3 ? 1.25 : 1);
      const k = pile * pat, i = (y * 256 + x) * 4;
      d[i] = 52 * k; d[i + 1] = 60 * k; d[i + 2] = 78 * k; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, [6, 2]));
}
/** The cabin's walls and ceiling, all around the fuselage (u around it, v along it): the perforated ceiling
 *  with its cove light, the bins' shadow, the laminate sidewall with panel joints, the darker lower wall. */
function cabinShellTex(wall: number, len: number): any {
  const key = 'shell' + wall; if (CabinTex[key]) { CabinTex[key].repeat.set(1, len / 2.2); return CabinTex[key]; }
  const base = new THREE.Color(wall);
  return (CabinTex[key] = cabinCanvas(1024, 256, (g, img, d) => {
    for (let y = 0; y < 256; y++) for (let x = 0; x < 1024; x++) {
      const th = x / 1024 * Math.PI * 2, h = (Math.sin(th) + 1) / 2;   // 0 at the floor, 1 at the top of the ceiling
      let k = 1, tint = [1, 1, 1];
      if (h > 0.84) {   // ceiling: off-white, a field of tiny perforations, brighter towards the middle
        k = 1.08 + 0.06 * (h - 0.84) / 0.16;
      } else if (h > 0.78) {   // the cove: light washing up from behind the bins
        k = 1.12 - (0.84 - h) * 2; tint = [1.02, 1.01, 0.98];
      } else if (h > 0.70) {   // under the bins: in their shadow
        k = 0.8;
      } else if (h > 0.4) {   // sidewall laminate: fine speckle, a soft vertical gradient, panel joints every 1.1 m
        k = 0.95 + 0.04 * (h - 0.4) / 0.3 + 0.025 * (cloudHash(x, y, 51) - 0.5) + 0.015 * cabinNoise(x / 9, y / 9, 114, 52);
        if (y % 128 < 2) k *= 0.82; else if (y % 128 < 4) k *= 1.04;   // the joint and its lit edge
      } else if (h > 0.22) {   // the lower wall (dado): darker, a slight texture
        k = 0.62 + 0.02 * (cloudHash(x, y, 53) - 0.5); tint = [0.96, 0.96, 0.98];
        if (Math.abs(h - 0.4) < 0.006) k = 0.5;   // the trim line between them
      } else k = 0.4;
      const i = (y * 1024 + x) * 4;
      d[i] = Math.min(255, base.r * 255 * k * tint[0]); d[i + 1] = Math.min(255, base.g * 255 * k * tint[1]); d[i + 2] = Math.min(255, base.b * 255 * k * tint[2]); d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, [1, len / 2.2]));
}
/** Satin plastic for bins and trim: smooth, with the faintest mottling. */
function cabinSatinTex(): any {
  return CabinTex.satin || (CabinTex.satin = cabinCanvas(128, 128, (g, img, d) => {
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
      const v = 238 + 10 * cabinNoise(x / 10, y / 10, 13, 61) + 4 * (cloudHash(x, y, 62) - 0.5), i = (y * 128 + x) * 4;
      d[i] = v; d[i + 1] = v; d[i + 2] = v; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, [2, 2]));
}
/** The sky as seen through a cabin window: a gradient with soft clouds (by day), a dark blue night. */
function cabinSkyTex(): any {
  return CabinTex.sky || (CabinTex.sky = cabinCanvas(64, 96, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, 96); gr.addColorStop(0, '#6E9FD6'); gr.addColorStop(0.55, '#B9D3EE'); gr.addColorStop(0.62, '#E8EEF4'); gr.addColorStop(1, '#8D9AA8');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 96);
    for (let i = 0; i < 9; i++) { const x = Math.random() * 64, y = 48 + Math.random() * 18, r = 6 + Math.random() * 10, c = g.createRadialGradient(x, y, 0, x, y, r); c.addColorStop(0, 'rgba(255,255,255,.75)'); c.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = c; g.fillRect(0, 0, 64, 96); }
  }));
}

/** The headrest cover: a light cloth with a bold pattern of our own in the airline's colour (a woven chevron
 *  and lines), like the covers airlines use; never another airline's design. */
function cabinCoverTex(color: string): any {
  const key = 'cover2' + color; if (CabinTex[key]) return CabinTex[key];
  return (CabinTex[key] = cabinCanvas(128, 104, (g) => {
    g.fillStyle = '#2E3137'; g.fillRect(0, 0, 128, 104);
    g.fillStyle = color; g.fillRect(0, 0, 128, 12);   // the airline's colour along the top, as piping
    g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(0, 12, 128, 2);
    for (let i = 0; i < 1600; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * 0.06})`; g.fillRect(Math.random() * 128, Math.random() * 104, 1, 1); }   // the leather grain
  }));
}
/** The back of a slimline seat: light grey moulding, the screen (or a phone holder), the tray table and latch, the
 *  pocket and a coat hook. */
function cabinSeatBackTex(screen: boolean): any {
  const key = 'seatback' + screen; if (CabinTex[key]) return CabinTex[key];
  return (CabinTex[key] = cabinCanvas(192, 256, (g) => {
    const rr = (x: number, y: number, w: number, h: number, r: number) => { g.beginPath(); (g as any).roundRect(x, y, w, h, r); };
    const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#E9EBEE'); gr.addColorStop(1, '#D3D7DB'); g.fillStyle = gr; g.fillRect(0, 0, 192, 256);
    // the screen (or a phone holder) at the top
    if (screen) { rr(26, 14, 140, 82, 8); g.fillStyle = '#16191E'; g.fill(); const s2 = g.createLinearGradient(26, 14, 166, 96); s2.addColorStop(0, 'rgba(255,255,255,.12)'); s2.addColorStop(0.5, 'rgba(255,255,255,0)'); g.fillStyle = s2; rr(30, 18, 132, 74, 6); g.fill(); g.fillStyle = '#2C6FB5'; g.globalAlpha = 0.35; rr(34, 22, 124, 66, 4); g.fill(); g.globalAlpha = 1; }
    else { rr(66, 20, 60, 40, 6); g.fillStyle = '#5A6068'; g.fill(); }
    // the tray table: a panel outline with its latch at the top
    rr(18, 108, 156, 78, 10); g.strokeStyle = 'rgba(80,88,98,.55)'; g.lineWidth = 3; g.stroke();
    rr(82, 102, 28, 12, 4); g.fillStyle = '#9AA1A9'; g.fill(); g.fillStyle = '#5B6168'; g.fillRect(89, 106, 14, 4);
    // the pocket below, in dark fabric, and a coat hook
    rr(20, 198, 152, 50, 8); g.fillStyle = '#3A3F47'; g.fill(); g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(24, 200, 144, 3);
    g.fillStyle = '#7C838B'; rr(150, 124, 10, 18, 3); g.fill();
    for (let i = 0; i < 1800; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.03})`; g.fillRect(Math.random() * 192, Math.random() * 256, 1, 1); }
  }));
}

/** The placards with the row number and the seat letters, as on board: a white plate along the bin's lower edge,
 *  facing down towards the aisle, with the row number, a person (the aisle), the seat letters in boxes from the
 *  aisle seat out to the window seat, and a window. All in one mesh drawn from one picture. */
/** The centre bins of a twin-aisle cabin: a rounded box over the middle block from front to back, its doors
 *  bulging a little, with door joints, handles and the passenger service panel underneath. */
function cabinCentreBins(g: any, x0: number, len: number, yL: number, yR: number, zb: number, bh: number, mBin: any, V: (x: number, y: number, z: number) => any) {
  const T = THREE, W = yR - yL, r = 0.07, bulge = 0.025, S = new T.Shape();
  S.moveTo(yL + r, 0); S.lineTo(yR - r, 0); S.quadraticCurveTo(yR, 0, yR + bulge * 0.4, r);
  S.quadraticCurveTo(yR + bulge, bh * 0.5, yR, bh); S.lineTo(yL, bh); S.quadraticCurveTo(yL - bulge, bh * 0.5, yL - bulge * 0.4, r); S.quadraticCurveTo(yL, 0, yL + r, 0);
  const geo = new T.ExtrudeGeometry(S, { depth: len, bevelEnabled: false, curveSegments: cabinQv([3, 6, 10, 16]) });
  geo.rotateY(Math.PI / 2);   // the outline across the cabin, drawn out along it
  const m = new T.Mesh(geo, mBin); m.position.copy(V(x0, 0, zb)); m.position.z = 0; g.add(m);
  // the passenger service panel underneath, and the door joints and handles on both faces
  const psu = new T.Mesh(new T.BoxGeometry(len, 0.03, W * 0.8), cabinMat(0xA4A9AF)); psu.position.copy(V(x0 + len / 2, (yL + yR) / 2, zb - 0.012)); g.add(psu);
  const n = Math.ceil(len / 1.5), seam = new T.InstancedMesh(new T.BoxGeometry(0.008, bh * 0.85, 0.006), cabinMat(0xB9BEC4), n * 2), hdl = new T.InstancedMesh(new T.BoxGeometry(0.2, 0.035, 0.02), cabinMat(0x8E949B), n * 2), M = new T.Matrix4(), q = new T.Quaternion(), one = new T.Vector3(1, 1, 1);
  for (let i = 0; i < n; i++) for (const [j, y] of [[0, yL - 0.024], [1, yR + 0.024]] as [number, number][]) {
    M.compose(V(x0 + 0.75 + i * 1.5, y, zb + bh * 0.5), q, one); seam.setMatrixAt(i * 2 + j, M);
    M.compose(V(x0 + 1.5 + i * 1.5, y, zb + bh * 0.22), q, one); hdl.setMatrixAt(i * 2 + j, M);
  }
  g.add(seam, hdl);
  g.userData.bin.mid = { yL, yR };
}
function cabinRowLabels(rowX: { [r: number]: number }, blocks: number[], letters: string, seatY: number[], seatW: number, aisles: number[], zf: number, V: (x: number, y: number, z: number) => any, bin?: { zb: number; lip: number }): any {
  const T = THREE, rows = Object.keys(rowX).map(Number).sort((a, b) => a - b); if (!rows.length || !aisles.length) return null;
  // which blocks face which aisle, and their letters from the aisle seat to the window seat
  const sides: { y: number; dir: number; txt: string }[] = []; let i0 = 0;
  blocks.forEach(b => { const ys = seatY.slice(i0, i0 + b), lt = letters.slice(i0, i0 + b), lo = Math.min(...ys) - seatW / 2, hi = Math.max(...ys) + seatW / 2;
    for (const a of aisles) { if (a > hi && a - hi < 0.6) sides.push({ y: hi - 0.06, dir: 1, txt: lt.split('').reverse().join('') }); if (a < lo && lo - a < 0.6) sides.push({ y: lo + 0.06, dir: -1, txt: lt }); }
    i0 += b; });
  const cells = rows.length * sides.length, cols = 4, cw = 256, ch = 56, cv = document.createElement('canvas'); cv.width = cols * cw; cv.height = Math.ceil(cells / cols) * ch;
  const x = cv.getContext('2d') as CanvasRenderingContext2D; x.fillStyle = '#ECEEF0'; x.fillRect(0, 0, cv.width, cv.height);
  const pos: number[] = [], uv: number[] = [], idx: number[] = []; let c = 0;
  for (const r of rows) for (const sd of sides) {
    const cx = (c % cols) * cw, cy = Math.floor(c / cols) * ch;
    x.fillStyle = '#F7F8F9'; x.fillRect(cx + 2, cy + 3, cw - 4, ch - 6);
    x.fillStyle = '#16181B'; x.textBaseline = 'middle'; x.textAlign = 'left';
    x.font = 'bold 38px Inter, Arial, sans-serif'; x.fillText(String(r), cx + 12, cy + ch / 2 + 2);
    let px = cx + 14 + x.measureText(String(r)).width + 12;
    // the person (the aisle side): a head and a body
    x.beginPath(); x.arc(px + 7, cy + 17, 5, 0, 6.3); x.fill(); x.fillRect(px, cy + 24, 14, 18); x.fillRect(px + 2, cy + 40, 4, 6); x.fillRect(px + 8, cy + 40, 4, 6); px += 20;
    // the letters, each in a box, then the window
    x.font = 'bold 22px Inter, Arial, sans-serif'; x.lineWidth = 2; x.strokeStyle = '#16181B'; x.textAlign = 'center';
    for (const L of sd.txt) { x.strokeRect(px, cy + 14, 24, 28); x.fillText(L, px + 12, cy + 29); px += 26; }
    x.beginPath(); x.ellipse(px + 9, cy + 28, 6, 11, 0, 0, 6.3); x.lineWidth = 3; x.stroke(); x.beginPath(); x.ellipse(px + 9, cy + 28, 3, 7, 0, 0, 6.3); x.fill();
    // the plate: along the bin's lower edge over the aisle seat, tilted to face down and towards the aisle
    // on the panel under the bin, near its edge over the aisle seat: the side bins, or (twin aisles) the centre bins
    const mid = bin && (bin as any).mid, inMid = mid && sd.y > mid.yL - 0.01 && sd.y < mid.yR + 0.01;
    const pz = bin ? bin.zb - 0.03 : zf + 1.7, py = !bin ? sd.y : inMid ? (sd.dir > 0 ? mid.yR : mid.yL) - sd.dir * 0.1 : aisles.length === 1 ? Math.sign(sd.y - aisles[0]) * (bin.lip + 0.1) : Math.sign(sd.y) * (bin.lip + 0.1);
    const ctr = V(rowX[r] - 0.02, py, pz), o0 = V(0, 0, 0), n = V(0, sd.dir * 0.5, -0.87).sub(o0).normalize();
    const along = V(-1, 0, 0).sub(o0).normalize(), right = along.clone().multiplyScalar(sd.dir > 0 ? 1 : -1);   // the text runs along the cabin, upright as seen from the aisle
    const upv = new T.Vector3().crossVectors(n, right).normalize();   // the edge towards the aisle is the top of the text
    const hw = 0.13, hh = 0.028, b0 = pos.length / 3, c0 = ctr.clone().addScaledVector(n, 0.003);
    for (const [sx, sy2] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const p = c0.clone().addScaledVector(right, sx * hw).addScaledVector(upv, sy2 * hh); pos.push(p.x, p.y, p.z); }
    const u0 = cx / cv.width, u1 = (cx + cw) / cv.width, v0 = 1 - (cy + ch) / cv.height, v1 = 1 - cy / cv.height;
    uv.push(u0, v0, u1, v0, u1, v1, u0, v1); idx.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3); c++;
  }
  const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
  const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 8;
  const m = new T.Mesh(geo, new T.MeshBasicMaterial({ map: tex, side: T.DoubleSide, fog: false })); m.material.userData.noDim = true;
  return m;
}

/* ---------- a helicopter's cabin ---------- */
// Built to each type's own cabin (length, width and height from docs/reference/helicopters.txt): the cockpit with
// its two seats and instrument panel under the big windscreen, then the cabin's seats in rows (or a stretcher and
// the medical crew's seats in an air ambulance), big side windows and the sliding doors. Model axes: x aft from
// the nose, y up, z sideways.
function heliCabinBuild(typeId: string): any {
  const T = THREE, h: any = HELI_SPECS[typeId], t: any = acType(typeId) || {}, g = new T.Group();
  const gearH = h.gear === 'skids' ? 0.45 : 0.6, fusH = h.cabinH + 0.55, cy = gearH + fusH / 2, fy = cy - fusH / 2 + 0.24, top = fy + h.cabinH + 0.12;
  const x0 = 0.35, x1 = 1.3 + h.cabinL, len = x1 - x0, W = h.cabinW, hw = W / 2;
  const m = (c: number, o?: any) => cabinMat(c, Object.assign({ side: T.DoubleSide }, o || {}));
  const mWall = m(0xD9DCDF), mTrim = m(0x5B636D), mFloor = m(0x3C424B, { map: cabinCarpetTex() }), mSeat = m(roles(t).indexOf('vip') >= 0 && t.seats <= 8 ? 0x6B4A32 : 0x2E3A4C), mPanel = m(0x1E2227), mScreen = new T.MeshBasicMaterial({ color: 0x2D7DB8 });
  mScreen.userData.noDim = true;
  const box = (w: number, hh: number, d: number, mat: any, x: number, y: number, z: number) => { const o = new T.Mesh(new T.BoxGeometry(w, hh, d), mat); o.position.set(x, y, z); g.add(o); return o; };
  // floor, ceiling and the walls below and above the windows (the windows themselves are open to the view)
  box(len, 0.04, W, mFloor, x0 + len / 2, fy - 0.02, 0);
  box(len, 0.04, W, m(0xEDEFF1), x0 + len / 2, top, 0);
  for (const sd of [-1, 1]) {
    box(len, 0.42, 0.04, mWall, x0 + len / 2, fy + 0.21, sd * hw);                      // below the windows
    box(len, 0.22, 0.04, mWall, x0 + len / 2, top - 0.11, sd * hw);                     // above them
    for (let x = 1.3; x < x1; x += Math.max(0.9, h.cabinL / 3)) box(0.07, top - fy - 0.6, 0.05, mTrim, x, fy + 0.42 + (top - fy - 0.64) / 2, sd * hw);   // window frames
  }
  box(0.04, top - fy, W, mWall, x1, fy + (top - fy) / 2, 0);                            // the back wall (baggage bay behind)
  // the cockpit: instrument panel with its screens, the centre console, two pilots' seats
  box(0.32, 0.36, W * 0.9, mPanel, 0.62, fy + 0.62, 0);
  for (const k of [-0.32, -0.11, 0.11, 0.32]) box(0.02, 0.16, 0.17, mScreen, 0.79, fy + 0.66, k * W);
  box(0.6, 0.3, 0.22, mPanel, 0.95, fy + 0.3, 0);
  const seat = (x: number, z: number, face: number, mat?: any) => {
    const sm = mat || mSeat; box(0.46, 0.08, 0.44, sm, x, fy + 0.42, z); box(0.08, 0.62, 0.44, sm, x + face * 0.22, fy + 0.72, z);
    box(0.08, 0.36, 0.06, mTrim, x, fy + 0.2, z - 0.18); box(0.08, 0.36, 0.06, mTrim, x, fy + 0.2, z + 0.18);
  };
  seat(1.25, -hw * 0.5, 1, m(0x22262C)); seat(1.25, hw * 0.5, 1, m(0x22262C));
  // the cabin: an air ambulance has a stretcher and the medical crew's seats; others their passenger rows
  const pax = Math.max(1, t.seats || 4), from = 1.95, room = Math.max(0.6, x1 - 0.8 - from);   // the last half metre stays clear: you sit there
  if (roles(t).indexOf('hems') >= 0 && roles(t).indexOf('offshore') < 0) {
    box(Math.min(2.0, room), 0.1, 0.56, m(0xEEF2F5), from + Math.min(2.0, room) / 2, fy + 0.62, -hw + 0.36);       // the stretcher
    box(Math.min(1.9, room - 0.1), 0.05, 0.5, m(0x3E7CC4), from + Math.min(2.0, room) / 2, fy + 0.69, -hw + 0.36);  // its blanket
    box(0.4, 0.3, 0.3, m(0xF2C230), from + 0.3, fy + 0.85, hw - 0.25);                                               // the medical bag
    seat(from + room * 0.75, hw - 0.3, 1);
  } else {
    const ab = W >= 2.0 ? 4 : W >= 1.7 ? 3 : 2, rows = Math.max(1, Math.min(Math.ceil(pax / ab), Math.floor(room / 0.78) + 1));
    for (let r = 0; r < rows; r++) for (let k = 0; k < ab; k++) {
      const z = -hw + 0.3 + k * (W - 0.6) / Math.max(1, ab - 1), x = from + 0.25 + r * Math.min(0.8, room / Math.max(1, rows));
      if (r * ab + k < pax - 1) seat(Math.min(x, x1 - 0.8), z, 1);
    }
  }
  if (h.hoist) box(0.5, 0.04, 0.3, m(0xF2C230), 1.3 + h.cabinL * 0.3, top - 0.04, -hw + 0.2);   // the hoist's mount above the right-hand door
  // a soft cabin light
  const lamp = box(len * 0.6, 0.015, 0.12, new T.MeshBasicMaterial({ color: 0xFFF3DD }), x0 + len / 2 + 0.3, top - 0.03, 0); lamp.material.userData.noDim = true;
  g.traverse((o: any) => { o.renderOrder = 40; o.frustumCulled = false; });
  g.userData.eye = [x1 - 0.12, hw * 0.35, fy + 0.95]; g.userData.look = [0.2, 0, fy + 0.6];   // aircraft axes: from the back of the cabin forward
  g.userData.heli = true;
  return g;
  function roles(tt: any): string[] { return tt.roles || []; }
}
