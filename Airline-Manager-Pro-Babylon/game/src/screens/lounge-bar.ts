/* The bar in the Business and Flagship lounges: a bartender who is always there, bottles on the shelf, glasses
 * hanging over the counter, drinks poured in front of you, and what too many of them do to you.
 *  - The bartender stands behind the counter swaying a little. When you come within about 2.5 m he turns to you and
 *    waves; click him for the drinks: what each is, how strong (ABV), and how much alcohol is in a serving.
 *  - He turns to the shelf, takes one of the bottles of that drink, takes a glass from the rack over the counter, sets
 *    it on the counter and pours: the drink rises in the glass until he stops. Then he puts the bottle back where it
 *    was; from then on the glass is yours to pick up. The rack fills up again.
 *  - In your hand the drink moves as you move (a hard swing spills it), and each sip is alcohol: how much depends on
 *    the drink's strength and how much you drink (grams of alcohol, the Widmark formula for your blood alcohol).
 *  - Drunk: your walk wobbles and drifts, your knees give a little now and then, the view sways and blurs and doubles
 *    (on any screen shape, ultra-wide too). It wears off in about 10 to 25 seconds, the more you drank the longer.
 * Real-world figures: docs/reference/bar-drinks.txt. Every bottle and glass has a model file name (lounge-props/). */

interface LgSpirit { id: string; name: string; what: string; abv: number; ml: number; price: number; glass: string; col: number; op: number; bottle: string; bCol: number; label: string }
const LG_SPIRITS: LgSpirit[] = [
  { id: 'red', name: 'Red wine', what: 'Bordeaux, dry and full', abv: 13.5, ml: 150, price: 9, glass: 'wine', col: 0x5E0B16, op: 0.92, bottle: 'wine', bCol: 0x1E3A1E, label: '#EFE6D2' },
  { id: 'white', name: 'White wine', what: 'Chablis, crisp and dry', abv: 12.5, ml: 150, price: 9, glass: 'wine', col: 0xE9D98A, op: 0.55, bottle: 'wine', bCol: 0xC9D7A8, label: '#F6F1E3' },
  { id: 'champagne', name: 'Champagne', what: 'Brut, from Reims', abv: 12, ml: 125, price: 14, glass: 'flute', col: 0xF0DE96, op: 0.5, bottle: 'champagne', bCol: 0x17301C, label: '#E8D9A8' },
  { id: 'whisky', name: 'Single malt whisky', what: '12 years old, from Speyside', abv: 40, ml: 40, price: 12, glass: 'tumbler', col: 0xB8661C, op: 0.78, bottle: 'whisky', bCol: 0xE8E4DA, label: '#1C1A18' },
  { id: 'gin', name: 'London dry gin', what: 'Juniper and citrus', abv: 40, ml: 40, price: 10, glass: 'tumbler', col: 0xEAF4F6, op: 0.18, bottle: 'gin', bCol: 0x9FD2D8, label: '#F3F0E8' },
  { id: 'vodka', name: 'Vodka', what: 'Clean and neutral, ice cold', abv: 40, ml: 40, price: 9, glass: 'shot', col: 0xF4F8FA, op: 0.14, bottle: 'vodka', bCol: 0xE9EEF2, label: '#C8202A' },
  { id: 'aquavit', name: 'Aquavit', what: 'Nordic, caraway and dill', abv: 42, ml: 40, price: 9, glass: 'shot', col: 0xF2EAC8, op: 0.2, bottle: 'vodka', bCol: 0xDCE9DC, label: '#2D4A6B' },
  { id: 'rum', name: 'Dark rum', what: 'Aged in oak, from the Caribbean', abv: 40, ml: 40, price: 10, glass: 'tumbler', col: 0x6E3410, op: 0.85, bottle: 'rum', bCol: 0x3A2010, label: '#E8C873' },
  { id: 'cognac', name: 'Cognac', what: 'VSOP, warm and smooth', abv: 40, ml: 40, price: 16, glass: 'snifter', col: 0xA4561A, op: 0.8, bottle: 'cognac', bCol: 0xE6DCCB, label: '#D4AF37' },
  { id: 'port', name: 'Port', what: 'Tawny, 10 years old', abv: 20, ml: 75, price: 10, glass: 'small', col: 0x7A2412, op: 0.9, bottle: 'wine', bCol: 0x2A1810, label: '#E9DFC8' },
  { id: 'amaretto', name: 'Amaretto', what: 'Almond liqueur, sweet', abv: 28, ml: 40, price: 9, glass: 'tumbler', col: 0x9A4A14, op: 0.8, bottle: 'liqueur', bCol: 0x8A4416, label: '#F0E2C0' },
];
/** Grams of alcohol in a serving (ethanol: 0.789 g/ml). */
function spiritGrams(d: LgSpirit): number { return d.ml * d.abv / 100 * 0.789; }
function lgSpirit(id: string): LgSpirit { return LG_SPIRITS.filter(x => x.id === id)[0]; }

/** Bottle shapes (radius, height in metres), as made on a lathe. */
const LG_BOTTLES: { [k: string]: number[][] } = {
  wine: [[0, 0], [0.036, 0.002], [0.037, 0.012], [0.037, 0.2], [0.033, 0.225], [0.02, 0.245], [0.014, 0.26], [0.0135, 0.3], [0.0155, 0.302], [0.0155, 0.31], [0, 0.31]],
  champagne: [[0, 0], [0.043, 0.002], [0.044, 0.014], [0.044, 0.18], [0.037, 0.22], [0.022, 0.26], [0.016, 0.28], [0.0155, 0.31], [0.018, 0.312], [0, 0.315]],
  whisky: [[0, 0], [0.042, 0.002], [0.046, 0.01], [0.046, 0.17], [0.04, 0.19], [0.02, 0.205], [0.015, 0.215], [0.015, 0.25], [0.02, 0.252], [0.02, 0.27], [0, 0.27]],
  gin: [[0, 0], [0.037, 0.002], [0.039, 0.012], [0.039, 0.2], [0.03, 0.225], [0.016, 0.24], [0.015, 0.27], [0.018, 0.272], [0.018, 0.29], [0, 0.29]],
  vodka: [[0, 0], [0.033, 0.002], [0.034, 0.01], [0.034, 0.22], [0.028, 0.245], [0.013, 0.265], [0.0125, 0.31], [0.015, 0.312], [0.015, 0.325], [0, 0.325]],
  rum: [[0, 0], [0.04, 0.002], [0.041, 0.012], [0.041, 0.18], [0.035, 0.2], [0.018, 0.22], [0.015, 0.26], [0.018, 0.262], [0.018, 0.28], [0, 0.28]],
  cognac: [[0, 0], [0.04, 0.002], [0.05, 0.03], [0.055, 0.08], [0.05, 0.13], [0.03, 0.165], [0.016, 0.18], [0.015, 0.215], [0.019, 0.217], [0.019, 0.24], [0, 0.24]],
  liqueur: [[0, 0], [0.044, 0.002], [0.046, 0.012], [0.046, 0.14], [0.04, 0.16], [0.018, 0.18], [0.016, 0.2], [0.019, 0.202], [0.019, 0.22], [0, 0.22]],
};
/** Glass shapes: the outside (radius, height) and the inside the drink fills (radius, height above the base). */
const LG_GLASSES: { [k: string]: { out: number[][]; inn: number[][]; base: number; full: number } } = {
  wine: { out: [[0, 0], [0.036, 0.001], [0.036, 0.004], [0.005, 0.008], [0.0035, 0.02], [0.0035, 0.085], [0.012, 0.095], [0.036, 0.12], [0.043, 0.15], [0.041, 0.18], [0.035, 0.215]],
    inn: [[0.002, 0], [0.03, 0.022], [0.04, 0.052], [0.039, 0.08], [0.033, 0.115]], base: 0.096, full: 0.42 },
  flute: { out: [[0, 0], [0.032, 0.001], [0.032, 0.004], [0.004, 0.008], [0.003, 0.02], [0.003, 0.09], [0.012, 0.1], [0.026, 0.13], [0.028, 0.2], [0.025, 0.235]],
    inn: [[0.002, 0], [0.022, 0.025], [0.025, 0.08], [0.023, 0.13]], base: 0.1, full: 0.72 },
  tumbler: { out: [[0, 0], [0.04, 0], [0.042, 0.012], [0.044, 0.09]], inn: [[0.038, 0], [0.041, 0.078]], base: 0.012, full: 0.32 },
  shot: { out: [[0, 0], [0.022, 0], [0.023, 0.012], [0.026, 0.065]], inn: [[0.02, 0], [0.024, 0.052]], base: 0.012, full: 0.75 },
  snifter: { out: [[0, 0], [0.034, 0.001], [0.034, 0.004], [0.006, 0.008], [0.005, 0.04], [0.02, 0.05], [0.048, 0.085], [0.05, 0.11], [0.04, 0.14], [0.034, 0.155]],
    inn: [[0.004, 0], [0.04, 0.025], [0.046, 0.055], [0.036, 0.09]], base: 0.05, full: 0.3 },
  small: { out: [[0, 0], [0.03, 0.001], [0.03, 0.004], [0.004, 0.008], [0.003, 0.02], [0.003, 0.07], [0.01, 0.078], [0.028, 0.1], [0.031, 0.125], [0.027, 0.155]],
    inn: [[0.002, 0], [0.024, 0.02], [0.029, 0.045], [0.025, 0.075]], base: 0.079, full: 0.55 },
};
const LG_RACK_TYPES = ['wine', 'flute', 'tumbler', 'snifter', 'shot', 'small'];

let _lgGlassMat: any = null;
function lgGlassMat(): any {
  if (_lgGlassMat) return _lgGlassMat;
  const T = THREE; _lgGlassMat = new T.MeshStandardMaterial({ color: 0xF4FAFF, roughness: 0.04, metalness: 0.0, transparent: true, opacity: 0.2, depthWrite: false, side: T.DoubleSide, envMapIntensity: 2.2 });
  return _lgGlassMat;
}
const _lgGeo: any = {};
function lgLathe(key: string, prof: number[][], seg = 28): any {
  if (_lgGeo[key]) return _lgGeo[key];
  const T = THREE; return (_lgGeo[key] = new T.LatheGeometry(prof.map(p => new T.Vector2(p[0], p[1])), seg));
}
/** A bottle's label: the drink's name in a typeface that suits it. */
function lgLabelTex(d: LgSpirit): any {
  const [cv, k] = ctCanvas(256, 128); k.fillStyle = d.label; k.fillRect(0, 0, 256, 128);
  const dark = parseInt(d.label.slice(1), 16) < 0x808080; k.fillStyle = dark ? '#E9D9A6' : '#2A1E14'; k.strokeStyle = k.fillStyle; k.lineWidth = 3; k.strokeRect(10, 10, 236, 108);
  k.textAlign = 'center'; k.font = `700 ${d.name.length > 12 ? 24 : 30}px Georgia, serif`; k.fillText(d.name.toUpperCase().slice(0, 18), 128, 62);
  k.font = 'italic 18px Georgia, serif'; k.fillText(`${d.abv}% vol`, 128, 96);
  return ctTex(cv);
}
/** One bottle as a group (its glass, the drink in it, its label and cap), for the one the bartender carries. */
function lgBottleGroup(d: LgSpirit): any {
  const T = THREE, g = new T.Group(), prof = LG_BOTTLES[d.bottle] || LG_BOTTLES.wine, parts = lgBottleParts(d);
  for (const p of parts) { const o = new T.Mesh(p.geo, p.mat); o.castShadow = false; g.add(o); }
  void prof; g.name = 'bottle-' + d.id;
  return g;
}
const _lgBottleParts: any = {};
function lgBottleParts(d: LgSpirit): { geo: any; mat: any }[] {
  if (_lgBottleParts[d.id]) return _lgBottleParts[d.id];
  const T = THREE, prof = LG_BOTTLES[d.bottle] || LG_BOTTLES.wine, H = prof[prof.length - 1][1];
  const glassM = new T.MeshStandardMaterial({ color: d.bCol, roughness: 0.06, metalness: 0.0, transparent: true, opacity: d.bottle === 'whisky' || d.bottle === 'vodka' || d.bottle === 'cognac' || d.bottle === 'gin' ? 0.32 : 0.62, depthWrite: false, envMapIntensity: 2.0 });
  const body = prof.filter(p => p[1] < H * 0.72), maxR = Math.max(...body.map(p => p[0]));
  const liqProf = prof.filter(p => p[1] <= H * 0.68).map(p => [Math.max(0, p[0] * 0.9), p[1] + 0.004]);
  const liqM = new T.MeshStandardMaterial({ color: d.col, roughness: 0.15, transparent: true, opacity: Math.min(0.95, d.op + 0.1), depthWrite: false });
  const bodyTop = body.filter(p => p[0] > maxR * 0.95).reduce((a, p) => Math.max(a, p[1]), 0);
  const labelH = Math.min(0.11, bodyTop * 0.55), labelY = bodyTop * 0.45;
  const label = new T.CylinderGeometry(maxR + 0.0008, maxR + 0.0008, labelH, 24, 1, true, -1.15, 2.3); label.translate(0, labelY, 0);
  const cap = new T.CylinderGeometry(0.0165, 0.0165, 0.025, 14); cap.translate(0, H - 0.008, 0);
  const capM = new T.MeshStandardMaterial({ color: d.id === 'champagne' ? 0xC9A23A : d.bottle === 'whisky' || d.bottle === 'cognac' ? 0x6B4A2A : 0x1A1A1C, roughness: 0.35, metalness: d.id === 'champagne' ? 0.9 : 0.2 });
  return (_lgBottleParts[d.id] = [
    { geo: lgLathe('liq-' + d.bottle, liqProf, 20), mat: liqM },
    { geo: lgLathe('bot-' + d.bottle, prof, 28), mat: glassM },
    { geo: label, mat: new T.MeshStandardMaterial({ map: lgLabelTex(d), roughness: 0.6 }) },
    { geo: cap, mat: capM },
  ]);
}
/** A glass (as made, standing) with the drink's volume and surface, ready for lgLiquid and the cups' code. */
function lgGlassGroup(type: string): any {
  const T = THREE, G = LG_GLASSES[type] || LG_GLASSES.wine, g = new T.Group();
  g.add(new T.Mesh(lgLathe('gl-' + type, G.out, 28), lgGlassMat()));
  return g;
}

/** Build the bar's bottles (instanced on the shelf: one draw per part of each drink), the glass rack over the counter,
 *  and the bartender's place. Called from lgBuild for the Business and Flagship lounges. */
function lgBarBuild(A: any, root: any, lv: number, bxp: number, bz: number, z1: number, H: number, q: number) {
  const T = THREE, B: any = { bxp, bz, z1, standZ: z1 - 0.62, top: 1.13, bottles: [], rack: [], st: 'idle', x: bxp, yaw: Math.PI, order: null, waveT: 0, near: false };
  A.bar = B;
  // the shelf's bottles: three shelves of twelve, every drink at least twice
  const ys = [1.4, 1.8, 2.2], perDrink: { [id: string]: any[] } = {};
  let n = 0;
  for (const y of ys) for (let i = 0; i < 12; i++) {
    const d = LG_SPIRITS[(n * 7 + Math.floor(n / LG_SPIRITS.length)) % LG_SPIRITS.length]; n++;
    const pos = new T.Vector3(bxp - 1.35 + i * 0.245, y + 0.015, z1 - 0.2), b = { d, pos, ry: Math.PI + (i % 3 - 1) * 0.25, idx: 0, out: false, mesh: null as any };
    (perDrink[d.id] = perDrink[d.id] || []).push(b); B.bottles.push(b);
  }
  B.inst = {};
  for (const id in perDrink) {
    const d = lgSpirit(id), list = perDrink[id], file = 'lounge-props/bottle-' + id + '.glb';
    if (Models.has(file)) {   // a model of your own: each bottle on its own
      for (const b of list) { const g = lgBottleGroup(d); g.position.copy(b.pos); g.rotation.y = b.ry; root.add(g); try { Models.swap(g, file, false); } catch (e) { /* the app's own */ } b.mesh = g; }
      continue;
    }
    const ims = lgBottleParts(d).map(p => { const I = new T.InstancedMesh(p.geo, p.mat, list.length); I.castShadow = false; I.receiveShadow = false; root.add(I); return I; });
    list.forEach((b, i) => { b.idx = i; const m = new T.Matrix4().compose(b.pos, new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), b.ry), new T.Vector3(1, 1, 1)); for (const I of ims) I.setMatrixAt(i, m); });
    for (const I of ims) I.instanceMatrix.needsUpdate = true;
    B.inst[id] = ims;
  }
  // the glass rack over the counter, hung from the ceiling: glasses upside down by their foot
  const metal = new T.MeshStandardMaterial({ color: 0xC9A25E, metalness: 0.9, roughness: 0.3 }); void lv;
  const ry = 2.42, rz = bz + 0.02, rack = new T.Group(); rack.name = 'glass-rack'; root.add(rack);
  for (const s of [-1, 1]) { const rail = new T.Mesh(new T.BoxGeometry(3.0, 0.02, 0.02), metal); rail.position.set(bxp, ry, rz + s * 0.12); rack.add(rail); }
  for (const x of [-1.4, 0, 1.4]) { const rod = new T.Mesh(new T.CylinderGeometry(0.008, 0.008, Math.max(0.1, H - ry), 6), metal); rod.position.set(bxp + x, ry + (H - ry) / 2, rz); rack.add(rod); }
  try { Models.swap(rack, 'lounge-props/glass-rack.glb', false); } catch (e) { /* the app's own */ }
  for (let i = 0; i < 14; i++) {
    const type = LG_RACK_TYPES[i % LG_RACK_TYPES.length], x = bxp - 1.3 + i * 0.2, z = rz + (i % 2 ? 0.06 : -0.06);
    const slot: any = { type, home: new T.Vector3(x, ry - 0.012, z), g: null, back: 0 };
    lgRackFill(A, slot, root, 1); B.rack.push(slot);
  }
  // the bartender's hit box (follows him), made when he is
  void q;
}
/** A glass back in its place on the rack (a new one: fading in when fill < 1). */
function lgRackFill(A: any, slot: any, root: any, fill: number) {
  const g = lgGlassGroup(slot.type); g.rotation.x = Math.PI; g.position.copy(slot.home); g.name = 'glass-' + slot.type; root.add(g);
  try { Models.swap(g, 'lounge-props/glass-' + slot.type + '.glb', false); } catch (e) { /* the app's own */ }
  slot.g = g; slot.fade = fill;
}

/* ---------- the bartender ---------- */
function lgBartenderMake(R: any, B: any) {
  if (B.m || B.tried || !Human.ready) return; B.tried = true;
  const T = THREE, A = R.A;
  try {
    const L: any = randomLook('lounge-bartender-' + (R.k || ''), 'm', 'fa'); L.civil = true; L.top = 'vest'; L.uniform = 1; L.neck = 'tie'; L.hat = 'none'; L.bottom = 'trousers'; L.shoes = 'oxford'; L.glasses = 'none';
    L.skin = 3; L.hairColor = 3; L.facial = 'none';   // his look: a Spanish skin tone, light brown hair, clean-shaven (the same build, so the same moves)
    const m = Human.build(dressed(L, 'fa' as any), 'fa', '#1C1F26', av3Style(), R.q >= 2 ? 0.75 : 0.55); try { modelsPeople(m, L); } catch (e) { /* the app's own */ }
    m.root.traverse((o: any) => { if (o.isMesh) { o.castShadow = R.q >= 1; o.receiveShadow = true; } });
    const pivot = new T.Group(), holder = new T.Group(); holder.add(m.root); pivot.add(holder); A.root.add(pivot);
    // a bartender's apron, from the waist down (charcoal, long)
    const top = m.top || 1.75, apron = new T.Mesh(new T.PlaneGeometry(0.42, top * 0.42), new T.MeshStandardMaterial({ color: 0x2A2C30, roughness: 0.85, side: T.DoubleSide }));
    apron.position.set(0, top * 0.36, 0.13); holder.add(apron);
    const hit = new T.Mesh(new T.BoxGeometry(0.6, 1.8, 0.5), new T.MeshBasicMaterial({ visible: false })); hit.userData.act = 'bartender'; hit.userData.keep = true; A.root.add(hit); A.hits.push(hit);
    B.m = m; B.pivot = pivot; B.holder = holder; B.hit = hit; B.armR = null; B.armL = null; B.dist = 0;
  } catch (e) { B.m = null; }
}
/** Arm angles for a hand to reach a point in the lounge's coordinates (smoothly, from where it was). */
function lgBarReach(R: any, B: any, sd: 'L' | 'R', at: any): number[] {
  const m = B.m; m.root.updateMatrixWorld(true);
  const w = R.A.root.localToWorld(at.clone()), loc = m.root.worldToLocal(w), key = sd === 'L' ? 'armL' : 'armR';
  B[key] = humanReach(m, sd, loc, B[key] || [0.3, 0.1, 0.05, 0.6]); return B[key];
}
/** A point in front of his shoulder on that side, as he faces now (the lounge's coordinates): where a hand holds
 *  something it carries. */
function lgBarFront(R: any, B: any, sd: 'L' | 'R', fwd: number, y: number): any {
  const T = THREE, m = B.m; m.root.updateMatrixWorld(true);
  const s = R.A.root.worldToLocal(m.root.localToWorld(m.joints[sd].s.clone()));
  return new T.Vector3(s.x + Math.sin(B.yaw) * fwd, y, s.z + Math.cos(B.yaw) * fwd);
}
/** Where a hand is now (the lounge's coordinates). */
function lgBarHand(R: any, B: any, sd: 'L' | 'R', arm: number[]): any {
  const m = B.m; m.root.updateMatrixWorld(true);
  return R.A.root.worldToLocal(m.root.localToWorld(humanHandAt(m, sd, arm, undefined, m.joints[sd].palm)));
}
/** Click on the bartender: the drinks. */
function lgBarMenu() {
  const R = LoungeRoom, B = R.A && R.A.bar; if (!B) return;
  if (B.order) { toast(B.order.guest ? 'He is serving another guest: a moment' : 'He is pouring your drink', 'info'); return; }
  const held = lgHeldCup(), waiting = (R.cups || []).filter((c: any) => c.spirit && (c.st === 'ready' || c.st === 'pour'))[0];
  if (waiting) { toast('Your drink is on the counter: pick it up first', 'info'); return; }
  if (held) { toast('Finish what you have or put it down first', 'info'); return; }
  aimUnlock(); Sound.tick();
  const el = R.root.querySelector('.hg-panel') as HTMLElement; if (!el) return; el.hidden = false;
  el.innerHTML = `<div class="hg-vend lg-barmenu"><div class="hg-vend-h"><b>The bar</b><small>What would you like? The strength is the share of alcohol in it; a standard drink is 10 g of alcohol.</small><button data-op="bar-close" aria-label="Close">${icon('close')}</button></div>
    ${spiritAny() ? '' : `<p class="lg-bar-out">${icon('alert')}The bar has run out of everything. Order spirits for your lounges under Finance → Storage.</p>`}
    <div class="lg-bar-list">${LG_SPIRITS.map(d => { const g = spiritGrams(d), c = '#' + d.col.toString(16).padStart(6, '0'), left = spiritLeft(d.id);
      return `<button data-op="bar-pick" data-k="${d.id}" ${left ? '' : 'disabled'}><i class="lg-bar-sw" style="--c:${c}"></i><span><b>${esc(d.name)}</b><small>${esc(d.what)}</small><small class="lg-bar-num">${d.abv}% · ${d.ml} ml · ${g.toFixed(1)} g alcohol (${(g / 10).toFixed(1)} standard drinks)</small></span><em>${left ? `${num(left)} left` : 'Run out'}</em></button>`; }).join('')}</div></div>`;
}
function lgBarClose() { const R = LoungeRoom, el = R.root && R.root.querySelector('.hg-panel') as HTMLElement; if (el) { el.hidden = true; el.innerHTML = ''; } Sound.tick(); }
/** A drink ordered: paid for, the menu goes, and he gets to work. */
function lgBarPick(id: string) {
  const R = LoungeRoom, B = R.A && R.A.bar, d = lgSpirit(id); if (!B || !d || B.order) return;
  const el = R.root.querySelector('.hg-panel') as HTMLElement; if (el) { el.hidden = true; el.innerHTML = ''; }
  if (!spiritTake(id)) { toast(`Sorry, the ${d.name.toLowerCase()} has run out`, 'info'); return; }   // from your own storage: it's your bar
  Sound.tick(); lgBarOrder(id, null);
}
/** An order for you (guest null) or for a guest at the bar: he takes a bottle and a glass, and pours. */
function lgBarOrder(id: string, guest: any): boolean {
  const R = LoungeRoom, B = R.A && R.A.bar, d = lgSpirit(id); if (!B || !d || B.order) return false;
  const bottles = B.bottles.filter((b: any) => b.d.id === id && !b.out), bottle = bottles[Math.floor(Math.random() * bottles.length)];
  const want = (LG_GLASSES[d.glass] ? d.glass : 'wine'), F = R.free;
  const slots = B.rack.filter((s: any) => s.type === want && s.g && s.fade >= 1);
  const px = guest ? guest.x : F ? F.x : B.bxp, slot = slots.sort((a: any, b: any) => Math.abs(a.home.x - px) - Math.abs(b.home.x - px))[0] || B.rack.filter((s: any) => s.g)[0];
  if (!bottle || !slot) { if (!guest) toast('Sorry, that one has run out', 'info'); return false; }
  B.order = { st: 'toBottle', t: 0, d, bottle, slot, guest, serveX: clamp(guest ? guest.x : slot.home.x, B.bxp - 1.5, B.bxp + 1.5) };
  return true;
}
/** Each frame: the bartender (idle, greeting you, or making your drink), the rack refilling. */
function lgBarStep(dt: number, now: number) {
  const R = LoungeRoom, A = R.A, B = A && A.bar; if (!B) return;
  lgBartenderMake(R, B);
  for (const s of B.rack) if (s.g && s.fade < 1) { s.fade = Math.min(1, s.fade + dt * 0.8); s.g.visible = true; s.g.scale.setScalar(0.6 + 0.4 * s.fade); }
  else if (!s.g && s.back && now > s.back) { s.back = 0; lgRackFill(A, s, A.root, 0); }
  if (!B.m) return;
  const T = THREE, m = B.m, F = R.free, O = B.order, E = (x: number) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  let goalX = B.idleX == null ? B.bxp : B.idleX, wantYaw = Math.PI, armR: number[] | null = null, armL: number[] | null = null, walking = false;
  // near you: he turns to you and waves (once each time you come up to the bar)
  const dx = F ? F.x - B.x : 99, dz = F ? F.z - B.standZ : 99, d = Math.hypot(dx, dz);
  if (!O) {
    if (d < 2.6 && !B.near) { B.near = true; B.waveT = 2.4; }
    else if (d > 3.6) B.near = false;
    if (B.near) wantYaw = Math.atan2(dx, dz);
    if (Math.abs(angDiffRad(Math.PI, wantYaw)) > 1.3) wantYaw = Math.PI + Math.sign(angDiffRad(Math.PI, wantYaw)) * 1.3;   // behind the counter, he can only turn so far
  }
  if (O) {
    O.t += dt; const b = O.bottle, d2 = O.d;
    const toward = (x: number) => { const ddx = x - B.x; if (Math.abs(ddx) < 0.03) { B.x = x; return true; } B.x += Math.sign(ddx) * Math.min(Math.abs(ddx), dt * 0.9); walking = true; return false; };
    if (O.st === 'toBottle') { wantYaw = 0; if (toward(b.pos.x) && Math.abs(angDiffRad(B.yaw, 0)) < 0.2) { O.st = 'reachBottle'; O.t = 0; } }
    else if (O.st === 'reachBottle') { wantYaw = 0; armR = lgBarReach(R, B, 'R', b.pos.clone().add(new T.Vector3(0, 0.12, -0.03)));
      if (O.t > 0.7) { lgBarTakeBottle(R, B, b); O.st = 'toServe'; O.t = 0; } }
    else if (O.st === 'toServe') { wantYaw = Math.PI; armR = lgBarReach(R, B, 'R', lgBarFront(R, B, 'R', 0.3, 1.1));
      if (toward(O.serveX) && Math.abs(angDiffRad(B.yaw, Math.PI)) < 0.2) { O.st = 'reachGlass'; O.t = 0; } }
    else if (O.st === 'reachGlass') { wantYaw = Math.PI; armR = lgBarReach(R, B, 'R', lgBarFront(R, B, 'R', 0.3, 1.1)); armL = lgBarReach(R, B, 'L', O.slot.home.clone().add(new T.Vector3(0, -0.05, 0)));
      if (O.t > 0.7) { lgBarTakeGlass(R, B, O); O.st = 'placeGlass'; O.t = 0; } }
    else if (O.st === 'placeGlass') { wantYaw = Math.PI; const k = E(O.t / 0.9), put = new T.Vector3(O.serveX + 0.05, B.top + 0.02, B.bz + 0.08);
      const up = O.slot.home.clone().add(new T.Vector3(0, -0.05, 0)); armR = lgBarReach(R, B, 'R', lgBarFront(R, B, 'R', 0.3, 1.1)); armL = lgBarReach(R, B, 'L', up.lerp(put.clone().add(new T.Vector3(0, 0.06, 0)), k));
      if (O.cup) { O.cup.g.rotation.x = Math.PI * (1 - k); O.cup.g.position.copy(lgBarHand(R, B, 'L', armL)).add(new T.Vector3(0, -0.06 * k, 0)); }
      if (O.t > 0.9) { O.cup.g.rotation.set(0, 0, 0); O.cup.g.position.copy(put).setY(B.top); O.st = 'pour'; O.t = 0; } }
    else if (O.st === 'pour') { wantYaw = Math.PI; const g0 = O.cup.g.position, dur = d2.ml > 100 ? 3.4 : 2.4, tilt = E(O.t / 0.5) * (O.t < dur + 0.5 ? 1 : 1 - E((O.t - dur - 0.5) / 0.5));
      armL = lgBarReach(R, B, 'L', lgBarFront(R, B, 'L', 0.25, 1.0));
      const over = new T.Vector3(g0.x - 0.05, B.top + LG_GLASSES[O.cup.type].out[LG_GLASSES[O.cup.type].out.length - 1][1] + 0.16, g0.z - 0.02);
      armR = lgBarReach(R, B, 'R', over);
      O.bottleTilt = tilt * 2.1;
      const flow = O.t > 0.5 && O.t < dur + 0.5 ? 1 : 0, k = clamp((O.t - 0.5) / dur, 0, 1);
      O.cup.lvl = O.cup.full * k; lgBarStream(R, O, flow);
      if (O.t > dur + 1.0) { lgBarStream(R, O, 0); O.st = 'toShelf'; O.t = 0;
        if (O.guest) { O.cup.st = 'guest'; O.cup.guest = O.guest; O.guest.drink = O.cup; O.guest.drinkT = 0; }   // the guest's: they pick it up
        else { O.cup.st = 'ready'; if (O.cup.g.userData.hit) R.A.hits.push(O.cup.g.userData.hit); toast(`${d2.name}: your glass is on the counter, pick it up`, 'ok'); } } }
    else if (O.st === 'toShelf') { wantYaw = 0; armR = lgBarReach(R, B, 'R', lgBarFront(R, B, 'R', 0.3, 1.2)); O.bottleTilt = 0;
      if (toward(b.pos.x) && Math.abs(angDiffRad(B.yaw, 0)) < 0.2) { O.st = 'putBottle'; O.t = 0; } }
    else if (O.st === 'putBottle') { wantYaw = 0; armR = lgBarReach(R, B, 'R', b.pos.clone().add(new T.Vector3(0, 0.12, -0.03)));
      if (O.t > 0.7) { lgBarPutBottle(R, B, b); O.st = 'home'; O.t = 0; } }
    else if (O.st === 'home') { wantYaw = Math.PI; if (toward(goalX)) { B.order = null; } }
    // the bottle in his right hand (tipped while pouring)
    if (b.carry && armR) { const h = lgBarHand(R, B, 'R', armR); b.carry.position.copy(h).add(new T.Vector3(0, -0.12, 0)); b.carry.rotation.set(0, 0, 0); if (O.bottleTilt) { b.carry.rotation.z = O.bottleTilt * (B.x < (O.cup ? O.cup.g.position.x : B.x) ? -1 : 1); b.carry.position.y += 0.05 * Math.sin(O.bottleTilt * 0.5); } }
  } else if (Math.abs(B.x - goalX) > 0.03) { B.x += Math.sign(goalX - B.x) * Math.min(Math.abs(goalX - B.x), dt * 0.9); walking = true; }
  B.yaw += angDiffRad(B.yaw, wantYaw) * Math.min(1, dt * 5);
  // place and pose him
  B.pivot.position.set(B.x, 0, B.standZ); B.pivot.rotation.y = B.yaw; B.hit.position.set(B.x, 0.9, B.standZ);
  B.dist += walking ? dt * 0.9 : 0;
  const t = now; let g = humanGesture(null, t);
  if (walking) g = cabinLerpG(g, humanGesture({ kind: 'walk', v: 0.8, seed: 'bartender' } as any, B.dist / 1.25), 0.8);
  if (B.waveT > 0 && !O) {   // a wave: the right hand up beside his head, waving
    B.waveT -= dt; const k = Math.min(1, B.waveT * 2, (2.4 - B.waveT) * 3), J = m.joints.R.s;
    m.root.updateMatrixWorld(true);
    const loc = new T.Vector3(J.x * 1.9, (m.top || 1.75) * 0.98, 0.12 + 0.06 * Math.sin(t * 9));
    const wv = humanReach(m, 'R', loc, B.armR || [0.3, 0.1, 0.05, 0.6]); B.armR = wv;
    g.R = k >= 1 ? wv : wv.map((v: number, i: number) => (g.R[i] || 0) + (v - (g.R[i] || 0)) * k);
  }
  if (armR) g.R = armR; if (armL) g.L = armL;
  if (!armR && !(B.waveT > 0)) B.armR = null; if (!armL) B.armL = null;
  try { m.pose({ t, yaw: 0, gaze: [0, 0], blink: (t % 3.7) < 0.12 ? 1 : 0, g, talk: 0 }); } catch (e) { /* still */ }
}
/** He takes the bottle: off the shelf (the instance hidden), a bottle of its own in his hand. */
function lgBarTakeBottle(R: any, B: any, b: any) {
  const T = THREE; b.out = true;
  if (b.mesh) { b.carry = b.mesh; } else { const ims = B.inst[b.d.id]; for (const I of ims || []) { I.setMatrixAt(b.idx, new T.Matrix4().makeScale(0, 0, 0)); I.instanceMatrix.needsUpdate = true; } b.carry = lgBottleGroup(b.d); R.A.root.add(b.carry); }
  try { hgSnd('put'); } catch (e) { /* quiet */ }
}
/** And puts it back exactly where it was. */
function lgBarPutBottle(R: any, B: any, b: any) {
  const T = THREE; b.out = false;
  if (b.mesh) { b.mesh.position.copy(b.pos); b.mesh.rotation.set(0, b.ry, 0); }
  else { R.A.root.remove(b.carry); const ims = B.inst[b.d.id]; const m = new T.Matrix4().compose(b.pos, new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), b.ry), new T.Vector3(1, 1, 1)); for (const I of ims || []) { I.setMatrixAt(b.idx, m); I.instanceMatrix.needsUpdate = true; } }
  b.carry = null;
  try { hgSnd('put'); } catch (e) { /* quiet */ }
}
/** He takes a glass off the rack: from now on it is your drink (a cup in the lounge's own way), and the rack's place
 *  gets a new glass in a while. */
function lgBarTakeGlass(R: any, B: any, O: any) {
  const T = THREE, s = O.slot, d = O.d, G = LG_GLASSES[s.type] || LG_GLASSES.wine;
  const g = s.g; s.g = null; s.back = performance.now() / 1000 + 8;
  // the drink inside: its volume (rebuilt as the level changes) and its surface (levelled by lgLiquid)
  const liqM = new T.MeshStandardMaterial({ color: d.col, roughness: 0.08, transparent: true, opacity: d.op, depthWrite: false });
  const surf = new T.Mesh(new T.CircleGeometry(1, 28), liqM); surf.rotation.x = -Math.PI / 2; surf.visible = false;
  const lg = new T.Group(); lg.add(surf); g.add(lg);
  const vol = new T.Mesh(new T.BufferGeometry(), liqM); vol.position.y = G.base; vol.renderOrder = 1; g.add(vol);
  g.userData.liq = { lg, liq: surf, foam: null, prof: G.inn, h: G.inn[G.inn.length - 1][1], base: G.base, vol, volLvl: -1, volProf: G.inn };
  const hit = new T.Mesh(new T.BoxGeometry(0.14, 0.24, 0.14), new T.MeshBasicMaterial({ visible: false })); hit.position.y = 0.11; hit.userData.act = 'cup'; g.add(hit); g.userData.hit = hit;
  g.userData.heat = new T.Group();
  const c: any = { st: 'pour', kind: d.id, spirit: d.id, drinkName: d.name, type: s.type, g, lvl: 0, full: G.full, sips: 0, hotUntil: 0, alc: { g: spiritGrams(d) } };
  R.cups = R.cups || []; R.cups.push(c); O.cup = c;
  try { hgSnd('put'); } catch (e) { /* quiet */ }
}
/** The stream from the bottle's neck into the glass. */
function lgBarStream(R: any, O: any, on: number) {
  const T = THREE, b = O.bottle; if (!on) { if (O.stream) { R.A.root.remove(O.stream); O.stream = null; } return; }
  if (!O.stream) { O.stream = new T.Mesh(new T.CylinderGeometry(0.0035, 0.003, 1, 8, 1, true), new T.MeshStandardMaterial({ color: O.d.col, roughness: 0.1, transparent: true, opacity: Math.min(0.9, O.d.op + 0.2), depthWrite: false })); R.A.root.add(O.stream); }
  const g = O.cup.g, G = LG_GLASSES[O.cup.type], top = b.carry ? b.carry.localToWorld(new T.Vector3(0, (LG_BOTTLES[O.d.bottle] || LG_BOTTLES.wine).slice(-1)[0][1] - 0.01, 0)) : null;
  if (!top) return; R.A.root.worldToLocal(top);
  const surf = g.position.y + G.base + O.cup.lvl * G.inn[G.inn.length - 1][1], x = g.position.x, z = g.position.z;
  const y0 = Math.min(top.y, surf + 0.4); O.stream.position.set((top.x + x) / 2 * 0 + x, (y0 + surf) / 2, z); O.stream.scale.y = Math.max(0.01, y0 - surf);
  O.stream.scale.x = O.stream.scale.z = 1 + 0.15 * Math.sin(performance.now() / 30);
}
/** The drink's volume in a glass (a lathe of the inside up to the level). */
function lgGlassVolume(L: any, lvl: number) {
  if (!L.vol || Math.abs(lvl - L.volLvl) < 0.004) return; L.volLvl = lvl;
  const T = THREE, P = L.volProf, y = lvl * L.h; const pts: any[] = [new T.Vector2(0, 0.001)];
  for (let i = 0; i < P.length; i++) { if (P[i][1] >= y) { const a = P[i - 1] || P[i], t = (y - a[1]) / Math.max(1e-4, P[i][1] - a[1]); pts.push(new T.Vector2(Math.max(0, (a[0] + (P[i][0] - a[0]) * clamp(t, 0, 1)) - 0.0012), y)); break; } pts.push(new T.Vector2(Math.max(0, P[i][0] - 0.0012), Math.max(0.001, P[i][1]))); }
  pts.push(new T.Vector2(0, y));
  L.vol.geometry.dispose(); L.vol.geometry = new T.LatheGeometry(pts, 24); L.vol.visible = lvl > 0.012;
}

/* ---------- drinking: alcohol in your blood, and what it does ---------- */
// Widmark: blood alcohol (per mille) = grams of alcohol / (body water ratio × body weight in kg); 0.68 for men,
// 0.55 for women, a man of 80 kg and a woman of 65 kg. In the game the alcohol takes a few seconds to arrive, and the
// effect wears off in 10 to 25 seconds (the more you drank, the longer).
const LgDrunk: any = { pend: 0, bac: 0, rate: 0, peakAt: 0, dip: 0, dipT: 3 };
function lgBarIntake(grams: number) {
  if (!(grams > 0)) return; LgDrunk.pend += grams;
}
function lgDrunkK(): number { return clamp(LgDrunk.bac / 0.8, 0, 1); }
function lgDrunkStep(dt: number) {
  const D = LgDrunk;
  if (D.pend > 0) {   // into the blood over a few seconds
    const take = Math.min(D.pend, Math.max(0.5, D.pend * 0.6) * dt);
    D.pend -= take; let sex: 'm' | 'f' = 'm'; try { sex = myVoiceChoice().sex; } catch (e) { /* a man */ }
    D.bac += take / ((sex === 'f' ? 0.55 : 0.68) * (sex === 'f' ? 65 : 80));
    const dur = 10 + 15 * clamp(D.bac / 1.0, 0, 1); D.rate = D.bac / dur;
  } else if (D.bac > 0) D.bac = Math.max(0, D.bac - Math.max(0.004, D.rate) * dt);
}
/** The view while drunk: it sways and rolls, your knees give a little now and then, and it blurs and doubles. */
function lgDrunkCam(R: any, dt: number, now: number, moving: boolean) {
  const k = lgDrunkK(), cam = R.cam; if (!cam) return;
  if (k > 0.01) {
    const D = LgDrunk;
    if (moving) { D.dipT -= dt; if (D.dipT <= 0) { D.dipT = 2.5 + Math.random() * 3.5; D.dipAt = now; } }
    const dk = D.dipAt ? Math.max(0, 1 - Math.abs(now - D.dipAt - 0.35) / 0.35) : 0;
    cam.position.y -= 0.07 * k * dk * dk;
    cam.rotateZ(0.06 * k * Math.sin(now * 0.8) + 0.02 * k * Math.sin(now * 2.3));
    cam.rotateY(0.035 * k * Math.sin(now * 0.55 + 1));
    cam.rotateX(0.02 * k * Math.sin(now * 0.7 + 2));
  }
  lgDrunkScreen(R, k, now);
  lgIntoxNote(R);
}
/** The blur and the double image: a copy of the picture, small and soft, a little to the side; works on any screen
 *  shape (it stretches with the picture). */
function lgDrunkScreen(R: any, k: number, now: number) {
  const cv = R.ren && R.ren.domElement as HTMLCanvasElement; if (!cv || !cv.parentElement) return;
  let o = R.drunkEl as HTMLElement;
  if (k < 0.01) { if (o) { o.remove(); R.drunkEl = null; cv.style.filter = ''; } return; }
  if (!o || !o.isConnected) {
    o = document.createElement('div'); o.className = 'lg-drunk'; o.innerHTML = '<canvas></canvas><i></i>';
    cv.parentElement.insertBefore(o, cv.nextSibling); R.drunkEl = o;
  }
  const c2 = o.querySelector('canvas') as HTMLCanvasElement, w = Math.max(64, Math.round(cv.width / 3)), h = Math.max(64, Math.round(cv.height / 3));
  if (c2.width !== w || c2.height !== h) { c2.width = w; c2.height = h; }
  try { (c2.getContext('2d') as CanvasRenderingContext2D).drawImage(cv, 0, 0, w, h); } catch (e) { /* not this frame */ }
  const off = (1.2 + 1.0 * Math.sin(now * 0.9)) * k;
  c2.style.transform = `translate(${off.toFixed(2)}%, ${(0.4 * k * Math.sin(now * 0.6)).toFixed(2)}%)`;
  c2.style.opacity = (0.42 * k).toFixed(3); c2.style.filter = `blur(${(1 + 2.5 * k).toFixed(1)}px)`;
  (o.querySelector('i') as HTMLElement).style.opacity = (0.55 * k).toFixed(3);
  cv.style.filter = `blur(${(0.3 + 1.2 * k).toFixed(2)}px)`;
}
/** A small note while you're intoxicated: how drunk, and a countdown to sober (it keeps counting with what is still
 *  coming into your blood). Kept clear of the blur, out of the way at the top. */
function lgIntoxNote(R: any) {
  const D = LgDrunk; let sex: 'm' | 'f' = 'm'; try { sex = myVoiceChoice().sex; } catch (e) { /* a man */ }
  const pendBac = D.pend / ((sex === 'f' ? 0.55 : 0.68) * (sex === 'f' ? 65 : 80)), total = D.bac + pendBac;
  let el = R.intoxEl as HTMLElement;
  if (total < 0.3 || !R.root) { if (el) { el.classList.add('out'); const e2 = el; setTimeout(() => e2.remove(), 400); R.intoxEl = null; } return; }
  if (!el || !el.isConnected) { el = document.createElement('div'); el.className = 'lg-intox'; el.setAttribute('role', 'status'); el.innerHTML = '<b>You\'re intoxicated</b><small>You\'ve had too much to drink</small><span class="lg-ix-t"></span><i><em></em></i>'; R.root.appendChild(el); R.intoxEl = el; R.intoxMax = 0; }
  const secs = Math.ceil(total / Math.max(0.004, D.rate || 0.004)); R.intoxMax = Math.max(R.intoxMax || 0, secs);
  const txt = `Sober in ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')} · ${D.bac.toFixed(2)}‰`;
  const t = el.querySelector('.lg-ix-t') as HTMLElement; if (t.textContent !== txt) t.textContent = txt;
  (el.querySelector('em') as HTMLElement).style.width = (100 * secs / Math.max(1, R.intoxMax)).toFixed(1) + '%';
}
function lgDrunkClear(R: any) { if (R.intoxEl) { R.intoxEl.remove(); R.intoxEl = null; } if (R.drunkEl) { R.drunkEl.remove(); R.drunkEl = null; } try { if (R.ren && R.ren.domElement) R.ren.domElement.style.filter = ''; } catch (e) { /* gone */ } LgDrunk.pend = 0; LgDrunk.bac = 0; }

/* ---------- guests at the bar ---------- */
/** A guest standing at the bar: they order when the bartender is free, pick up their glass when it is poured, and
 *  drink it sip by sip (each sip's alcohol counts: lounge-drunk.ts), then go and do something else. */
function lgGuestBar(G: any, dt: number) {
  const R = LoungeRoom, B = R.A && R.A.bar; if (!B || !G.spot || G.spot.k !== 'bar' || !G.wantsDrink) return;
  G.bacK = clamp(guestBac(drunkKey(G.P.name, G.P.callsign, G.P.dep)) / 1.5, 0, 1);
  if (!G.ordered && !G.drink) {
    if (B.m && !B.order) { const have = LG_SPIRITS.filter(d => spiritLeft(d.id) > 0), pick = have[Math.floor(Math.random() * have.length)];
      if (!pick) { G.wantsDrink = false; G.timer = 2; return; }   // nothing left to serve
      if (spiritTake(pick.id) && lgBarOrder(pick.id, G)) { G.ordered = true; spiritSale(pick.id); } }
    G.timer = Math.max(G.timer, 4); return;
  }
  if (G.ordered && !G.drink) { G.timer = Math.max(G.timer, 4); return; }
  const c = G.drink; G.timer = Math.max(G.timer, 3); G.drinkT = (G.drinkT || 0) + dt;
  // a sip about every eight seconds (sooner for those who like it), a quarter of the glass each
  if (!G.sip && G.drinkT > (G.heavy ? 5 : 8)) { G.sip = { t: 0, from: c.lvl }; G.drinkT = 0; }
  if (G.sip) { G.sip.t += dt; const k = clamp((G.sip.t - 0.6) / 0.8, 0, 1), was = c.lvl;
    c.lvl = Math.max(0, G.sip.from - c.full / 4 * k); if (c.lvl < was && c.alc) { guestDrink(G.P, c.alc.g * (was - c.lvl) / c.full); G.bacK = clamp(guestBac(drunkKey(G.P.name, G.P.callsign, G.P.dep)) / 1.5, 0, 1); }
    if (G.sip.t > 2.0) G.sip = null; }
  if (c.lvl < 0.02 && !G.sip) {   // finished: the glass goes back on the counter and is cleared away
    c.st = 'done'; if (c.g && c.g.parent) c.g.parent.remove(c.g); c.g = null; G.drink = null; G.ordered = false; G.wantsDrink = G.heavy && Math.random() < 0.6 || (!G.heavy && G.bacK < 0.3 && Math.random() < 0.15); G.timer = G.wantsDrink ? 3 : 1.5;
  }
}
/** The guest's right arm: holding the glass in front of them, or up to their mouth for a sip. */
function lgGuestArms(G: any, t: number): number[] | null {
  const T = THREE, m = G.m, J = m.joints.R; if (!J) return null; m.root.updateMatrixWorld(true);
  const top = m.top || 1.75, up = G.sip ? Math.sin(Math.PI * clamp(G.sip.t / 2.0, 0, 1)) : 0;
  const at = new T.Vector3(J.s.x * 0.55, top * (0.62 + 0.28 * up), 0.26 - 0.12 * up);
  G.armR = humanReach(m, 'R', at, G.armR || [0.4, 0.1, 0.05, 1.2]); void t; return G.armR;
}
/** The glass in the guest's hand (picked up off the counter at first). */
function lgGuestGlass(G: any, arms: number[] | null) {
  const R = LoungeRoom, c = G.drink; if (!c || !c.g || !arms) return;
  const m = G.m; m.root.updateMatrixWorld(true);
  const h = R.A.root.worldToLocal(m.root.localToWorld(humanHandAt(m, 'R', arms, undefined, m.joints.R.palm)));
  if (!c.from) c.from = c.g.position.clone(); c.w = Math.min(1, (c.w || 0) + 0.04);
  const want = h.add(new THREE.Vector3(0, -0.06, 0)); c.g.position.copy(c.from.clone().lerp(want, c.w * c.w * (3 - 2 * c.w)));
  c.g.rotation.set(G.sip ? -0.7 * Math.sin(Math.PI * clamp(G.sip.t / 2.0, 0, 1)) : 0, G.yaw, 0, 'YXZ');
}

/* ---------- Security collecting a drunk guest ---------- */
// An officer comes in through the lounge's doors, walks to the guest, and leads them out the way out (secExit: the
// doors now; another way out if there ever is one). A weak officer makes a scene: raised voices, the guest pulling away.
function lgSecurityEscort(name: string, o: any, scene: boolean) {
  const R = LoungeRoom, A = R.A, T = THREE; if (!A || R.sec) return;
  const G = (R.guests || []).filter((g: any) => g.P && g.P.name === name)[0]; if (!G) return;
  let m: any = null; try { m = Human.build(dressed(Object.assign({}, o.look, { sec: true }), 'ground' as any), 'ground', '#1C1F26', av3Style(), R.q >= 2 ? 0.7 : 0.5); try { modelsPeople(m, o.look); } catch (e) { /* the app's own */ } } catch (e) { m = null; }
  if (!m) return;
  const pivot = new T.Group(), holder = new T.Group(); holder.add(m.root); pivot.add(holder); A.root.add(pivot);
  const door = A.door || { x: 0, z: 0 };
  R.sec = { m, pivot, holder, G, st: 'in', x: door.x, z: door.z, yaw: 0, dist: 0, scene, t: 0, exit: secExit('lounge') };
  if (G.seat) { G.st = 'stand'; G.timer = 0; G.side = lgSeatSide(G.seat); }   // the guest gets up
  toast(`Security is collecting ${name}`, 'info');
}
function lgSecStep(dt: number, now: number) {
  const R = LoungeRoom, S = R.sec, A = R.A; if (!S || !A) return;
  const G = S.G, door = A.door || { x: 0, z: 0 }, T = THREE; S.t += dt;
  const walk = (x: number, z: number, v: number) => { const dx = x - S.x, dz = z - S.z, d = Math.hypot(dx, dz); if (d < 0.15) return true;
    const h = Math.atan2(dx, dz); S.x += Math.sin(h) * Math.min(d, v * dt); S.z += Math.cos(h) * Math.min(d, v * dt); S.yaw += angDiffRad(S.yaw, h) * Math.min(1, dt * 6); S.dist += v * dt; S.moving = true; return false; };
  S.moving = false;
  if (S.st === 'in') { if (G.gone) { S.st = 'out'; } else if (walk(G.x - Math.sin(G.yaw) * 0.0 + 0.55, G.z + 0.1, 1.1)) { S.st = 'talk'; S.t = 0; } }
  else if (S.st === 'talk') { S.yaw += angDiffRad(S.yaw, Math.atan2(G.x - S.x, G.z - S.z)) * Math.min(1, dt * 5); if (S.t > (S.scene ? 4.5 : 2.5)) { S.st = 'lead'; S.t = 0; G.st = 'led'; G.v = 0; } }
  else if (S.st === 'lead') {
    // to the way out, the guest a step behind (unsteady)
    const done = walk(door.x, door.z, 0.75);
    const bx = S.x - Math.sin(S.yaw) * 0.6 + 0.25 * Math.sin(S.t * 2), bz = S.z - Math.cos(S.yaw) * 0.6;
    const dx = bx - G.x, dz = bz - G.z, d = Math.hypot(dx, dz); if (d > 0.02) { G.x += dx * Math.min(1, dt * 3); G.z += dz * Math.min(1, dt * 3); G.yaw += angDiffRad(G.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 5); G.v = 0.7; G.dist += 0.7 * dt; }
    if (done) { S.st = 'out'; try { A.root.remove(G.pivot); } catch (e) { /* gone */ } G.gone = true; if (G.seat) lgFreeSeat(G); }
  }
  else if (S.st === 'out') { try { A.root.remove(S.pivot); } catch (e) { /* gone */ } R.sec = null; return; }
  S.pivot.position.set(S.x, 0, S.z); S.pivot.rotation.y = S.yaw;
  let g = humanGesture(null, now);
  if (S.moving) g = cabinLerpG(g, humanGesture({ kind: 'walk', v: 0.9, seed: 'security' } as any, S.dist / 1.25), 0.9);
  if (S.st === 'talk' || S.st === 'lead') { g.R = [0.55, 0.15, 0.1, 0.7]; }   // a hand out to the guest's arm
  if (S.st === 'talk' && S.scene) { g.shake = (g.shake || 0) + 0.15 * Math.sin(now * 3); }
  try { S.m.pose({ t: now, yaw: 0, gaze: [0, 0], blink: (now % 3.9) < 0.12 ? 1 : 0, g, talk: 0 }); } catch (e) { /* still */ }
  // the guest: arguing a little in a scene, then led away
  if (S.st === 'talk' && S.scene && G.m) { G.yaw += 0.6 * dt * Math.sin(now * 2.2); }
}
