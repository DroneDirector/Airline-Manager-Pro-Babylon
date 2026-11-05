// Helicopters: the 3D model of each type, built from its real dimensions (fuselage, cabin, rotor, tail rotor or
// shrouded fan, skids or wheels), in the airline's livery. Like the aircraft, a model file in www/models/helicopters/
// (helicopter-<maker>-<model>.glb) takes its place. The same axes as the aircraft: x from the nose (0) aft, the
// skids or wheels on the ground at 0.
//   userData.set({ spin }) turns the main and tail rotors (spin in turns of the main rotor).

interface HeliSpec {
  L: number;        // overall length, rotors turning
  fus: number;      // fuselage length (nose to the tail fin)
  rotor: number;    // main rotor diameter
  blades: number;   // main rotor blades
  tail: 'conv' | 'fen';   // a conventional tail rotor or a shrouded fan (Fenestron)
  tailD: number;    // tail rotor or fan diameter
  H: number;        // height to the top of the rotor head / fin
  w: number;        // fuselage width
  cabinL: number; cabinW: number; cabinH: number;
  gear: 'skids' | 'wheels' | 'retract';
  sponsons?: boolean;
  doors: number;    // cabin doors each side
  sliding: boolean;
  engines: number;
  hoist?: boolean;  // rescue hoist on SAR and air ambulance versions
}
const HELI_SPECS: { [typeId: string]: HeliSpec } = {};
// from docs/reference/helicopters.txt
HELI_SPECS['h125'] = { L: 12.94, fus: 10.93, rotor: 10.69, blades: 3, tail: 'conv', tailD: 1.86, H: 3.34, w: 1.87, cabinL: 2.0, cabinW: 1.75, cabinH: 1.33, gear: 'skids', sponsons: false, doors: 2, sliding: true, engines: 1, hoist: true };
HELI_SPECS['h130'] = { L: 12.64, fus: 10.68, rotor: 10.69, blades: 3, tail: 'fen', tailD: 0.75, H: 3.61, w: 2.03, cabinL: 2.5, cabinW: 1.87, cabinH: 1.25, gear: 'skids', sponsons: false, doors: 2, sliding: true, engines: 1, hoist: false };
HELI_SPECS['h135'] = { L: 12.16, fus: 10.2, rotor: 10.2, blades: 4, tail: 'fen', tailD: 1.0, H: 3.51, w: 1.56, cabinL: 2.8, cabinW: 1.5, cabinH: 1.26, gear: 'skids', sponsons: false, doors: 2, sliding: true, engines: 2, hoist: true };
HELI_SPECS['h145'] = { L: 13.64, fus: 11.64, rotor: 10.8, blades: 5, tail: 'fen', tailD: 1.1, H: 3.95, w: 1.73, cabinL: 3.0, cabinW: 1.73, cabinH: 1.28, gear: 'skids', sponsons: false, doors: 2, sliding: true, engines: 2, hoist: true };
HELI_SPECS['h160'] = { L: 15.7, fus: 13.0, rotor: 13.4, blades: 5, tail: 'fen', tailD: 1.2, H: 4.9, w: 2.2, cabinL: 3.7, cabinW: 2.0, cabinH: 1.42, gear: 'retract', sponsons: false, doors: 2, sliding: true, engines: 2, hoist: true };
HELI_SPECS['h175'] = { L: 18.06, fus: 15.7, rotor: 14.8, blades: 5, tail: 'conv', tailD: 3.2, H: 5.34, w: 2.5, cabinL: 4.3, cabinW: 2.06, cabinH: 1.48, gear: 'retract', sponsons: true, doors: 2, sliding: true, engines: 2, hoist: true };
HELI_SPECS['bell407'] = { L: 12.7, fus: 9.8, rotor: 10.67, blades: 4, tail: 'conv', tailD: 1.65, H: 3.56, w: 1.6, cabinL: 2.2, cabinW: 1.5, cabinH: 1.3, gear: 'skids', sponsons: false, doors: 2, sliding: false, engines: 1, hoist: true };
HELI_SPECS['bell429'] = { L: 13.11, fus: 10.5, rotor: 10.98, blades: 4, tail: 'conv', tailD: 1.73, H: 4.04, w: 1.8, cabinL: 2.5, cabinW: 1.5, cabinH: 1.3, gear: 'skids', sponsons: false, doors: 2, sliding: false, engines: 2, hoist: true };
HELI_SPECS['bell505'] = { L: 12.95, fus: 9.6, rotor: 11.28, blades: 2, tail: 'conv', tailD: 1.65, H: 3.3, w: 1.5, cabinL: 1.6, cabinW: 1.4, cabinH: 1.25, gear: 'skids', sponsons: false, doors: 2, sliding: false, engines: 1, hoist: false };
HELI_SPECS['bell525'] = { L: 19.9, fus: 16.8, rotor: 16.61, blades: 5, tail: 'conv', tailD: 3.0, H: 5.0, w: 2.6, cabinL: 4.9, cabinW: 2.2, cabinH: 1.6, gear: 'retract', sponsons: true, doors: 2, sliding: false, engines: 2, hoist: true };
HELI_SPECS['aw109'] = { L: 12.96, fus: 11.0, rotor: 10.83, blades: 4, tail: 'conv', tailD: 2.0, H: 3.6, w: 1.6, cabinL: 2.4, cabinW: 1.5, cabinH: 1.28, gear: 'skids', sponsons: false, doors: 2, sliding: true, engines: 2, hoist: true };
HELI_SPECS['aw139'] = { L: 16.66, fus: 13.77, rotor: 13.8, blades: 5, tail: 'conv', tailD: 2.7, H: 4.98, w: 2.26, cabinL: 2.6, cabinW: 2.1, cabinH: 1.42, gear: 'retract', sponsons: false, doors: 2, sliding: true, engines: 2, hoist: true };
HELI_SPECS['aw169'] = { L: 14.65, fus: 12.0, rotor: 12.12, blades: 5, tail: 'conv', tailD: 2.1, H: 4.5, w: 2.0, cabinL: 2.3, cabinW: 2.0, cabinH: 1.3, gear: 'skids', sponsons: false, doors: 2, sliding: true, engines: 2, hoist: true };
HELI_SPECS['aw189'] = { L: 17.6, fus: 14.6, rotor: 14.6, blades: 5, tail: 'conv', tailD: 2.9, H: 5.1, w: 2.5, cabinL: 4.35, cabinW: 2.3, cabinH: 1.42, gear: 'retract', sponsons: true, doors: 2, sliding: true, engines: 2, hoist: true };
HELI_SPECS['s76d'] = { L: 16.0, fus: 13.2, rotor: 13.41, blades: 4, tail: 'conv', tailD: 2.44, H: 4.42, w: 2.13, cabinL: 2.5, cabinW: 1.9, cabinH: 1.35, gear: 'retract', sponsons: false, doors: 2, sliding: false, engines: 2, hoist: true };
HELI_SPECS['s92'] = { L: 20.88, fus: 17.1, rotor: 17.17, blades: 4, tail: 'conv', tailD: 3.35, H: 5.47, w: 3.0, cabinL: 6.1, cabinW: 2.0, cabinH: 1.83, gear: 'retract', sponsons: true, doors: 1, sliding: false, engines: 2, hoist: true };
function isHeli(typeId: string): boolean { return !!HELI_SPECS[typeId]; }
function heliSpec(typeId: string): HeliSpec { return HELI_SPECS[typeId]; }
/** The file a helicopter's own model may come from: helicopters/helicopter-airbus-h145.glb, helicopter-bell-429.glb … */
function helicopterModelFile(typeId: string): string {
  const t = acType(typeId); if (!t) return '';
  const mk = modelSlug(t.maker.replace(/ Helicopters?$/i, '')), md = modelSlug(t.model);
  return 'helicopters/helicopter-' + (md.indexOf(mk + '-') === 0 ? md : mk + '-' + md) + '.glb';
}
/** What the rest of the app reads of a type's shape (hangars, the apron, the 3D view), for a helicopter. */
function heliShape(typeId: string): ShapeSpec {
  const h = HELI_SPECS[typeId];
  return {
    L: h.L, span: h.rotor, H: h.H, w: h.w, h: h.cabinH + 0.5, ground: h.gear === 'skids' ? 0.45 : 0.6,
    nose: 1.4, tip: 0.3, pTop: 0.6, pBot: 0.8, tail: h.fus * 0.45, tailEnd: 0.3, cockpit: 'utility',
    wing: { x: h.fus * 0.35, root: 0.01, tip: 0.01, sweep: 0, dih: 0, z: 0, tipDev: 'none' },
    fin: { x: h.fus - 1.2, root: 1.0, tip: 0.6, sweep: 30 },
    stab: { x: h.fus - 1.6, root: 0.5, tip: 0.4, span: Math.max(1.6, h.w * 1.1), sweep: 0, dih: 0, z: 0.5 },
    eng: [], gear: { nose: 1.6, main: h.fus * 0.42, track: Math.max(2, h.w), wheels: 1, fixed: h.gear !== 'retract' },
    win: { from: 1.2, to: 1.2 + h.cabinL, pitch: 1.0, z: 0.4 }, doors: [2.2],
  } as any;
}

function buildHelicopterModel(typeId: string, lv: Livery): any {
  const T = THREE, h = HELI_SPECS[typeId], root = new T.Group(); root.name = typeId;
  const std = (o: any) => new T.MeshStandardMaterial(Object.assign({ roughness: 0.35, metalness: 0.1 }, o));
  const mBody = std({ color: new T.Color(lv.body || '#F4F6F8'), roughness: 0.25 }), mC1 = std({ color: new T.Color(lv.c1), roughness: 0.3 }), mC2 = std({ color: new T.Color(lv.c2), roughness: 0.3 });
  const mGlass = std({ color: 0x1B2836, roughness: 0.08, metalness: 0.5 }), mDark = std({ color: 0x23272D, roughness: 0.55 }), mMetal = std({ color: 0x9BA4AE, metalness: 0.75, roughness: 0.35 });
  const mBlade = std({ color: 0x2A2E34, roughness: 0.5 }), mDisc = new T.MeshBasicMaterial({ color: 0x9AA6B2, transparent: true, opacity: 0.12, depthWrite: false, side: T.DoubleSide });
  const add = (g: any, m: any, x: number, y: number, z: number, par?: any) => { const o = new T.Mesh(g, m); o.position.set(x, y, z); (par || root).add(o); return o; };
  const gearH = h.gear === 'skids' ? 0.45 : 0.6, fusH = h.cabinH + 0.55, cy = gearH + fusH / 2, cabEnd = 1.3 + h.cabinL, boomStart = cabEnd + Math.min(1.6, h.fus * 0.12);
  // the fuselage: a rounded nose, the cabin, the engine deck, then the tail boom tapering to the fin
  const pts: any[] = [], prof = (x: number) => {
    if (x < 1.3) { const k = x / 1.3; return [Math.sqrt(Math.max(0, 1 - (1 - k) * (1 - k))) * 0.5 * h.w, Math.sqrt(Math.max(0, 1 - (1 - k) * (1 - k))) * 0.5 * fusH, 0]; }
    if (x < cabEnd) return [0.5 * h.w, 0.5 * fusH, 0];
    if (x < boomStart) { const k = (x - cabEnd) / (boomStart - cabEnd), e = k * k * (3 - 2 * k); return [0.5 * h.w * (1 - e) + 0.32 * e, 0.5 * fusH * (1 - e) + 0.34 * e, 0.22 * fusH * e]; }
    const k = (x - boomStart) / Math.max(0.5, h.fus - boomStart); return [0.32 - 0.14 * k, 0.34 - 0.15 * k, 0.22 * fusH + 0.05 * k];
  };
  { const N = 40, S = 24, pos: number[] = [], idx: number[] = [];
    for (let i = 0; i <= N; i++) { const x = (i / N) * h.fus, [ry, rz, up] = prof(x); for (let j = 0; j <= S; j++) { const a = j / S * Math.PI * 2; pos.push(x, cy + up + Math.sin(a) * rz, Math.cos(a) * ry); } }
    for (let i = 0; i < N; i++) for (let j = 0; j < S; j++) { const a = i * (S + 1) + j, b = a + S + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const body = new T.Mesh(g, mBody); body.castShadow = true; root.add(body); }
  // the livery: a band of the airline's colours along the cabin and the boom
  { const band = add(new T.BoxGeometry(cabEnd - 1.0, 0.18, h.w * 1.01 + 0.02), mC1, 0.6 + (cabEnd - 1.0) / 2, cy - fusH * 0.18, 0);
    band.scale.z = 1; add(new T.BoxGeometry(h.fus - boomStart, 0.12, 0.66), mC1, boomStart + (h.fus - boomStart) / 2, cy + 0.22 * fusH - 0.05, 0);
    add(new T.BoxGeometry(cabEnd - 1.2, 0.08, h.w * 1.01 + 0.03), mC2, 0.8 + (cabEnd - 1.2) / 2, cy - fusH * 0.32, 0); }
  // windscreen and cabin windows; the doors (sliding ones run on a rail)
  { const ws = add(new T.SphereGeometry(1, 20, 12, Math.PI * 0.55, Math.PI * 0.9, Math.PI * 0.18, Math.PI * 0.42), mGlass, 1.15, cy + fusH * 0.05, 0); ws.scale.set(1.05, fusH * 0.5, h.w * 0.505); ws.rotation.y = Math.PI / 2;
    const nWin = Math.max(2, Math.round(h.cabinL / 1.0)), ww = Math.min(0.85, h.cabinL / nWin * 0.7);
    for (const s of [-1, 1]) {
      for (let i = 0; i < nWin; i++) add(new T.BoxGeometry(ww, fusH * 0.32, 0.03), mGlass, 2.0 + i * (h.cabinL - 0.4) / nWin, cy + fusH * 0.12, s * (h.w / 2 + 0.005));
      for (let d = 0; d < h.doors; d++) { const dx = 1.9 + d * h.cabinL * 0.55; add(new T.BoxGeometry(0.02, fusH * 0.8, 0.012), mDark, dx, cy, s * (h.w / 2 + 0.008)); add(new T.BoxGeometry(0.02, fusH * 0.8, 0.012), mDark, dx + Math.min(1.5, h.cabinL * 0.5), cy, s * (h.w / 2 + 0.008)); if (h.sliding) add(new T.BoxGeometry(h.cabinL * 0.8, 0.03, 0.03), mMetal, dx + h.cabinL * 0.4, cy + fusH * 0.42, s * (h.w / 2 + 0.02)); }
    } }
  // the engine deck and cowling on top, exhausts
  const mastX = 1.3 + h.cabinL * 0.55, deckY = cy + fusH / 2;
  { const cw = add(new T.BoxGeometry(h.cabinL * 0.9 + 0.8, 0.42 + 0.08 * h.engines, h.w * 0.62), mBody, mastX + 0.25, deckY + 0.18, 0); cw.castShadow = true;
    for (let e = 0; e < h.engines; e++) { const ex = add(new T.CylinderGeometry(0.13, 0.15, 0.32, 12), mDark, mastX + h.cabinL * 0.45 + 0.4, deckY + 0.25, (h.engines > 1 ? (e ? 1 : -1) * h.w * 0.25 : 0)); ex.rotation.z = Math.PI / 2 - 0.3; } }
  // the main rotor: mast, hub, blades, and a faint disc when it turns fast
  const rotor = new T.Group(); rotor.position.set(mastX, deckY + 0.55 + 0.08 * h.engines, 0); root.add(rotor);
  add(new T.CylinderGeometry(0.09, 0.11, 0.6, 12), mMetal, mastX, deckY + 0.3, 0);
  add(new T.CylinderGeometry(0.3, 0.26, 0.2, 16), mMetal, 0, 0, 0, rotor);
  const blades = new T.Group(); rotor.add(blades);
  const R = h.rotor / 2, chord = Math.max(0.25, R * 0.06);
  for (let i = 0; i < h.blades; i++) { const b = new T.Mesh(new T.BoxGeometry(R - 0.25, 0.05, chord), mBlade); b.position.x = (R + 0.25) / 2; const p = new T.Group(); p.rotation.y = i / h.blades * Math.PI * 2; p.add(b); blades.add(p);
    const tipC = new T.Mesh(new T.BoxGeometry(0.4, 0.052, chord * 1.02), mC1); tipC.position.x = R - 0.3; p.add(tipC); }
  const disc = new T.Mesh(new T.CircleGeometry(R, 48), mDisc); disc.rotation.x = -Math.PI / 2; disc.visible = false; rotor.add(disc);
  // the tail: fin, horizontal stabiliser, and a tail rotor or a shrouded fan
  const tx = h.fus - 0.7, ty = cy + 0.22 * fusH + 0.05;
  const fin = add(new T.BoxGeometry(1.2, 1.3 + h.tailD * 0.5, 0.12), mC1, tx, ty + 0.5 + h.tailD * 0.2, 0); fin.rotation.z = -0.25; fin.castShadow = true;
  add(new T.BoxGeometry(0.7, 0.06, Math.max(1.6, h.w * 1.1)), mBody, tx - 1.0, ty + 0.05, 0);
  const tailRot = new T.Group(); root.add(tailRot);
  if (h.tail === 'fen') {
    tailRot.position.set(tx, ty + 0.35, 0);
    const ring = add(new T.TorusGeometry(h.tailD / 2 + 0.06, 0.12, 10, 32), mC1, tx, ty + 0.35, 0); ring.scale.z = 1.5; void ring;
    for (let i = 0; i < 9; i++) { const b = new T.Mesh(new T.BoxGeometry(0.05, h.tailD / 2, 0.06), mDark); b.position.y = h.tailD / 4; const p = new T.Group(); p.rotation.z = i / 9 * Math.PI * 2; p.add(b); tailRot.add(p); }
  } else {
    tailRot.position.set(tx + 0.25, ty + 0.55, 0.2);
    for (let i = 0; i < 2; i++) { const b = new T.Mesh(new T.BoxGeometry(0.1, h.tailD, 0.03), mBlade); const p = new T.Group(); p.rotation.z = i * Math.PI / 2; p.add(b); tailRot.add(p); }
  }
  // the undercarriage: skids, fixed wheels, or wheels that retract into sponsons
  if (h.gear === 'skids') {
    for (const s of [-1, 1]) { const sk = add(new T.CylinderGeometry(0.05, 0.05, h.cabinL + 1.2, 10), mMetal, 0.8 + (h.cabinL + 1.2) / 2, 0.05, s * h.w * 0.6); sk.rotation.z = Math.PI / 2;
      const tip = add(new T.CylinderGeometry(0.05, 0.05, 0.4, 10), mMetal, 0.65, 0.17, s * h.w * 0.6); tip.rotation.z = 0.9; }
    for (const x of [1.6, 1.4 + h.cabinL * 0.75]) { const ct = add(new T.CylinderGeometry(0.045, 0.045, h.w * 1.2, 10), mMetal, x, gearH * 0.55, 0); ct.rotation.x = Math.PI / 2;
      for (const s of [-1, 1]) add(new T.CylinderGeometry(0.045, 0.045, gearH, 10), mMetal, x, gearH / 2, s * h.w * 0.58); }
  } else {
    const gearG = new T.Group(); root.add(gearG); root.userData.gear = gearG;
    const wheel = (x: number, z: number, r: number) => { const w = new T.Mesh(new T.CylinderGeometry(r, r, 0.16, 16), mDark); w.rotation.x = Math.PI / 2; w.position.set(x, r, z); gearG.add(w); const leg = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, gearH, 8), mMetal); leg.position.set(x, r + gearH * 0.4, z); gearG.add(leg); };
    wheel(1.0, 0, 0.22); for (const s of [-1, 1]) wheel(1.4 + h.cabinL * 0.8, s * h.w * (h.sponsons ? 0.75 : 0.55), 0.3);
    if (h.sponsons) for (const s of [-1, 1]) { const sp = add(new T.SphereGeometry(1, 16, 10), mBody, 1.4 + h.cabinL * 0.8, cy - fusH * 0.3, s * h.w * 0.62); sp.scale.set(h.cabinL * 0.35, fusH * 0.2, 0.42); }
  }
  // the rescue hoist above the right-hand door
  if (h.hoist) { const hx = 2.2 + h.cabinL * 0.3; add(new T.BoxGeometry(0.9, 0.12, 0.12), mMetal, hx, deckY - 0.05, -(h.w / 2 + 0.35)); add(new T.CylinderGeometry(0.12, 0.12, 0.3, 12), mC1, hx + 0.4, deckY - 0.05, -(h.w / 2 + 0.75)); }
  root.traverse((o: any) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  root.userData.shape = heliShape(typeId); root.userData.engPts = []; root.userData.revPts = []; root.userData.props = []; root.userData.heli = true;
  root.userData.rotor = blades; root.userData.tailRot = tailRot;
  root.userData.set = (o: { spin?: number; gear?: number }) => {
    // turning: a soft rotor disc with the blades going round slowly enough to see (as a camera catches them); stopped: still blades
    const stop = !!(o as any).stopped;
    if (o.spin != null) { blades.rotation.y = stop ? blades.rotation.y : -o.spin * 0.35; tailRot.rotation.z = stop ? tailRot.rotation.z : o.spin * 1.7; disc.visible = !stop; }
    const G = root.userData.gear; if (o.gear != null && G && h.gear === 'retract') { G.visible = o.gear > 0.02; G.scale.y = 0.2 + 0.8 * clamp(o.gear, 0, 1); }
  };
  try { Models.swap(root, helicopterModelFile(typeId)); } catch (e) { /* the app's own model */ }
  return root;
}
