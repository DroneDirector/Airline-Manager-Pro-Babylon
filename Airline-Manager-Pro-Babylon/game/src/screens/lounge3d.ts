// Your lounges, in 3D. Walk into the lounge you have built at a base and see it as it is at its level:
//  - Lounge: a bright, comfortable room with fabric armchairs, a good carpet and a refreshment corner.
//  - Business lounge: larger, a herringbone oak floor, plaster walls over walnut, leather armchairs, the black and brass
//    L-shaped bar, the art deco fireplace, pendant lights and a richer carpet.
//  Every level: a copper-wave ceiling, tall walls, flight boards on the side walls too, a welcome mat where you arrive.
//  - Flagship lounge: the largest, with marble, velvet chairs on gold legs, chandeliers, a fireplace, a grand piano,
//    art on the walls and the finest carpet of all.
// Every level has the refreshment corner (an espresso machine, a tea urn, cups and saucers, napkins, a fruit bowl
// and a glass-fronted fridge of soft drinks and snacks), a departures screen with your flights from that base and a
// wall of windows onto the apron, with the sky as it is there now. Guests sit, chat and wait for their flights.
// Every piece of furniture and equipment has a file name in www/models/lounge-props/ (see www/models/README.md):
// a .glb there takes its place.

const LoungeRoom: any = { on: false };
interface LgSpec { W: number; D: number; H: number; guests: number; name: string }
const LG_SPECS: LgSpec[] = [
  { W: 16, D: 11, H: 4.2, guests: 4, name: 'Lounge' },
  { W: 22, D: 14, H: 4.8, guests: 7, name: 'Business lounge' },
  { W: 28, D: 17, H: 5.5, guests: 10, name: 'Flagship lounge' },
];
const LG_DOOR_W = 1.9, LG_DOOR_H = 2.4;
function lgPropSwap(g: any, name: string) { try { Models.swap(g, 'lounge-props/' + name + '.glb', false); } catch (e) { /* the app's own */ } }

/** Your lounges: where you have one, at what level. */
function lgList(): { k: string; lvl: number; name: string }[] {
  let L: any = null; try { L = loyalty(); } catch (e) { L = null; }
  if (!L || !L.lounges) return [];
  return Object.keys(L.lounges).map(k => ({ k, lvl: clamp(L.lounges[k].lvl || 0, 0, 2), name: L.lounges[k].name || LG_SPECS[L.lounges[k].lvl || 0].name }));
}
SCREENS.lounges = {
  title: 'Lounges', icon: 'star', nav: false,
  render() {
    const list = lgList();
    return `<div class="screen-head"><div><button class="back-btn" data-act="go" data-screen="ops">${icon('chevron', 'flip')}<span>Overview</span></button>
      <h1>Lounges</h1><p class="sub">${list.length ? `${list.length} ${list.length === 1 ? 'lounge' : 'lounges'}: walk in and see them as they are at their level` : 'You have no lounge yet'}</p></div></div>
      ${list.length ? `<div class="hg-list">${list.map(l => { const A: any = apt(l.k);
        return `<div class="card hg-card"><div class="hg-ac"><span><b>${esc(LG_SPECS[l.lvl].name)} at ${esc(l.k)}${A ? ' · ' + esc(A.city || A.name) : ''}</b><small>Level ${l.lvl + 1} of 3 · ${LG_SPECS[l.lvl].W} × ${LG_SPECS[l.lvl].D} m</small></span>
          <button class="btn sm primary" data-act="lounge-visit" data-k="${esc(l.k)}">${icon('star')}Walk in</button></div></div>`; }).join('')}</div>` : ''}
      ${typeof loungesCardHtml === 'function' ? loungesCardHtml() : ''}`;
  },
};

/* ---------- drawn pictures ---------- */
function lgCarpet(lvl: number): HTMLCanvasElement {
  const N = DESKTOP ? 2048 : 1024, [c, x] = ctCanvas(N, N), r = ctRng(91 + lvl), s = N / 1024;
  if (lvl === 0) {
    x.fillStyle = '#4C5A6B'; x.fillRect(0, 0, N, N);
    for (let i = 0; i < 60000 * s; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${r() * 0.06})`; x.fillRect(r() * N, r() * N, 1.5 * s, 1.5 * s); }
    x.strokeStyle = 'rgba(255,255,255,.07)'; x.lineWidth = 2 * s; for (let i = 0; i <= 16; i++) { x.beginPath(); x.moveTo(i * N / 16, 0); x.lineTo(i * N / 16, N); x.moveTo(0, i * N / 16); x.lineTo(N, i * N / 16); x.stroke(); }
    x.strokeStyle = '#2E3946'; x.lineWidth = 26 * s; x.strokeRect(13 * s, 13 * s, N - 26 * s, N - 26 * s);
  } else if (lvl === 1) {
    x.fillStyle = '#1C2C4A'; x.fillRect(0, 0, N, N);
    for (let i = 0; i < 80000 * s; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '120,150,200' : '0,0,0'},${r() * 0.07})`; x.fillRect(r() * N, r() * N, 1.5 * s, 1.5 * s); }
    x.strokeStyle = 'rgba(201,165,91,.75)'; x.lineWidth = 3 * s; const g = N / 12;
    for (let i = -12; i <= 24; i++) { x.beginPath(); x.moveTo(i * g, 0); x.lineTo(i * g + N, N); x.stroke(); x.beginPath(); x.moveTo(i * g, N); x.lineTo(i * g + N, 0); x.stroke(); }
    for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) { x.fillStyle = 'rgba(201,165,91,.85)'; x.beginPath(); x.arc((i + 0.5) * g, (j + 0.5) * g, 5 * s, 0, 6.3); x.fill(); }
    x.strokeStyle = '#C9A55B'; x.lineWidth = 10 * s; x.strokeRect(30 * s, 30 * s, N - 60 * s, N - 60 * s); x.strokeStyle = '#0E1729'; x.lineWidth = 50 * s; x.strokeRect(0, 0, N, N);
  } else {
    // the finest: a burgundy field, a gold and navy medallion, a patterned double border, a hand-knotted look
    x.fillStyle = '#5A1622'; x.fillRect(0, 0, N, N);
    for (let i = 0; i < 120000 * s; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '255,200,170' : '20,0,0'},${r() * 0.06})`; x.fillRect(r() * N, r() * N, 1.2 * s, 1.2 * s); }
    const C = N / 2, gold = '#D4AF37', navy = '#16224A';
    for (let k = 9; k > 0; k--) { x.fillStyle = k % 2 ? navy : gold; x.globalAlpha = k % 2 ? 0.9 : 0.85; x.beginPath(); for (let a = 0; a <= 64; a++) { const t = a / 64 * Math.PI * 2, rr = k * 34 * s * (1 + 0.12 * Math.cos(t * 8)); a ? x.lineTo(C + Math.cos(t) * rr, C + Math.sin(t) * rr) : x.moveTo(C + Math.cos(t) * rr, C + Math.sin(t) * rr); } x.fill(); }
    x.globalAlpha = 1;
    for (let q = 0; q < 4; q++) { x.save(); x.translate(q % 2 ? N - 170 * s : 170 * s, q < 2 ? 170 * s : N - 170 * s); for (let k = 4; k > 0; k--) { x.fillStyle = k % 2 ? gold : navy; x.beginPath(); x.arc(0, 0, k * 22 * s, 0, 6.3); x.fill(); } x.restore(); }
    x.strokeStyle = 'rgba(212,175,55,.35)'; x.lineWidth = 2 * s; for (let a = 0; a < 48; a++) { const t = a / 48 * Math.PI * 2; x.beginPath(); x.moveTo(C + Math.cos(t) * 330 * s, C + Math.sin(t) * 330 * s); x.lineTo(C + Math.cos(t) * 440 * s, C + Math.sin(t) * 440 * s); x.stroke(); }
    for (const [o, w, col] of [[0, 60, navy], [60, 14, gold], [74, 40, '#3E0E18'], [114, 8, gold]] as any[]) { x.strokeStyle = col; x.lineWidth = w * s; x.strokeRect((o + w / 2) * s, (o + w / 2) * s, N - (2 * o + w) * s, N - (2 * o + w) * s); }
    x.fillStyle = gold; for (let i = 0; i < 40; i++) { const p = 80 * s + i * (N - 160 * s) / 39; for (const [X, Y] of [[p, 30 * s], [p, N - 30 * s], [30 * s, p], [N - 30 * s, p]]) { x.save(); x.translate(X, Y); x.rotate(Math.PI / 4); x.fillRect(-7 * s, -7 * s, 14 * s, 14 * s); x.restore(); } }
  }
  return c;
}
/** The view from the windows: the apron and the runway beyond, aircraft at their stands, the sky as it is there now. */
function lgView(S: any): HTMLCanvasElement {
  const [c, x] = ctCanvas(2048, 512), r = ctRng(17), co = company(), night = S.alt < -6, low = S.alt < 8;
  const sky = S.sky.clone(), top = sky.clone().multiplyScalar(0.75), hz = sky.clone().lerp(new THREE.Color(low && !night ? 0xFFB070 : 0xDCE8F4), night ? 0.05 : low ? 0.6 : 0.35);
  const g = x.createLinearGradient(0, 0, 0, 330); g.addColorStop(0, '#' + top.getHexString()); g.addColorStop(1, '#' + hz.getHexString()); x.fillStyle = g; x.fillRect(0, 0, 2048, 512);
  if (night) for (let i = 0; i < 300; i++) { x.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.6})`; x.fillRect(r() * 2048, r() * 260, 1.5, 1.5); }
  x.fillStyle = night ? '#1A2027' : '#6E7880'; x.fillRect(0, 300, 2048, 40);
  for (let i = 0; i < 6; i++) { x.fillStyle = night ? '#232A33' : '#8C969F'; const X = 80 + i * 340, w = 220 + r() * 80; x.fillRect(X, 260 - r() * 30, w, 80); }
  x.fillStyle = night ? '#16191E' : '#5C636B'; x.fillRect(0, 340, 2048, 172);
  x.strokeStyle = night ? '#C9A227' : '#E8D27A'; x.lineWidth = 3; x.setLineDash([24, 18]); x.beginPath(); x.moveTo(0, 420); x.lineTo(2048, 400); x.stroke(); x.setLineDash([]);
  // aircraft at their stands, in your colours
  for (let i = 0; i < 4; i++) { const X = 160 + i * 480, Y = 395 - i * 4, k = 0.8 + r() * 0.3; x.save(); x.translate(X, Y); x.scale(k, k);
    x.fillStyle = night ? '#9AA4AE' : '#F2F4F6'; x.beginPath(); x.ellipse(0, 0, 150, 16, 0, 0, 6.3); x.fill();
    x.fillStyle = co.color || '#2C8CFF'; x.beginPath(); x.moveTo(110, -6); x.lineTo(150, -70); x.lineTo(168, -70); x.lineTo(150, -4); x.fill();
    x.fillStyle = night ? '#7A848E' : '#D3D9DF'; x.beginPath(); x.moveTo(-20, 6); x.lineTo(70, 34); x.lineTo(90, 34); x.lineTo(30, 4); x.fill();
    if (night) { x.fillStyle = '#FFE9A8'; for (let w = 0; w < 18; w++) x.fillRect(-110 + w * 11, -4, 5, 4); x.fillStyle = '#FF3B30'; x.fillRect(-2, -18, 4, 4); }
    x.restore(); }
  if (night) for (let i = 0; i < 40; i++) { x.fillStyle = i % 3 ? '#4FA3FF' : '#FFD27A'; x.fillRect(i * 52 + 10, 345, 4, 3); }
  return c;
}
function lgDepartures(c: HTMLCanvasElement, base: string) {
  const x = c.getContext('2d') as CanvasRenderingContext2D, W = c.width, H = c.height; x.fillStyle = '#0A1220'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#F2C230'; x.font = '700 40px Inter, Arial, sans-serif'; x.fillText(`Departures · ${base}`, 30, 60);
  let rows: any[] = []; try { rows = scheduleBlocks().filter((b: any) => b.kind === 'flight' && b.from === base && !b.cancelled).sort((a: any, b: any) => a.start - b.start); } catch (e) { rows = []; }
  const now = new Date(), nm = now.getHours() * 60 + now.getMinutes(), hm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(Math.round(m % 60)).padStart(2, '0')}`;
  rows = rows.filter(b => b.start >= nm - 20).slice(0, 7);
  x.font = '600 32px Inter, Arial, sans-serif';
  rows.forEach((b, i) => { const y = 120 + i * 52; x.fillStyle = i % 2 ? 'rgba(255,255,255,.04)' : 'rgba(255,255,255,0)'; x.fillRect(0, y - 36, W, 52);
    x.fillStyle = '#EAF2FA'; x.fillText(hm(b.start), 30, y); const A: any = apt(b.to); x.fillText(`${b.to}${A ? '  ' + (A.city || '').slice(0, 14) : ''}`, 160, y); x.fillStyle = '#9FB6CC'; x.fillText(b.reg, W - 420, y);
    const late = (b.delayMin || 0) >= 5; x.fillStyle = late ? '#F2B544' : b.start <= nm + 40 ? '#3FD0A0' : '#7FC4F5'; x.fillText(late ? `+${b.delayMin} min` : b.start <= nm + 40 ? 'Boarding' : 'On time', W - 230, y); });
  if (!rows.length) { x.fillStyle = '#9FB6CC'; x.fillText('No more departures today', 30, 140); }
}

/* ---------- opening ---------- */
const LG_EMBLEM = `<svg class="ctl-scales lg-emb" viewBox="0 0 200 200" aria-hidden="true"><defs><linearGradient id="lgG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF0C8"/><stop offset=".55" stop-color="#D4AF37"/><stop offset="1" stop-color="#7A5A12"/></linearGradient></defs>
  <circle cx="100" cy="100" r="94" fill="#160E10" stroke="url(#lgG)" stroke-width="4"/>
  <path d="M60 120 Q60 92 82 92 L118 92 Q140 92 140 120 L140 132 L60 132 Z" fill="none" stroke="url(#lgG)" stroke-width="5" stroke-linejoin="round"/>
  <path d="M52 112 L52 136 L148 136 L148 112" fill="none" stroke="url(#lgG)" stroke-width="5"/><path class="lg-steam" d="M96 58 q-6 -8 0 -16 q6 -8 0 -16 M108 58 q-6 -8 0 -16 q6 -8 0 -16" stroke="url(#lgG)" stroke-width="3" fill="none" opacity=".8"/>
  <text x="100" y="168" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="15" fill="url(#lgG)" letter-spacing="5">LOUNGE</text></svg>`;

LoungeRoom.open = function (k: string, host?: any) {
  const R = LoungeRoom; if (R.on) return;
  if (!host && trJoined() && lgList().length) {   // your lounges: in the joined building, at the end of the concourse
    const want = trLgPick(k);
    if (TestRooms.on && TestRooms.game && TestRooms.lgKey === want) trEnter('lounge', null);
    else { if (TestRooms.on) TestRooms.close(true); TestRooms.open({ game: true, room: 'lounge', lk: want }); }
    return; }
  R.host = host || null;
  const T = THREE; if (!T) { toast('3D is not available on this device', 'warn'); return; }
  const it = lgList().filter(l => l.k === k)[0] || (host ? { k, lvl: clamp(TestRooms.lgLv || 0, 0, 2), name: '' } : lgList()[0]); if (!it) { toast('Build a lounge first (Lounges)', 'info'); return; }
  if (!host) for (const X of [typeof OfficeRoom !== 'undefined' ? OfficeRoom : null, typeof OpsRoom !== 'undefined' ? OpsRoom : null, typeof HangarRoom !== 'undefined' ? HangarRoom : null]) { try { if (X && X.on) X.close(true); } catch (e) { /* none */ } }
  R.on = true; R.loading = true; R.k = it.k; R.lvl = it.lvl; R.spec = LG_SPECS[it.lvl]; R.keys = {}; R.stick = [0, 0]; R.last = 0; R.loadT0 = performance.now(); R.overlay = null; R.vend = null; R.flapT = 0; R.flapK = 0; R.panelOpen = false; HG_VR = LoungeRoom; R.press = null; R.drops = []; R.spots = [];
  const q = Gfx.placeQ('lounge'), co: any = company(), A: any = apt(it.k);
  const root = host ? host.root : document.createElement('div'); if (!host) root.className = 'court3d office3d ops3d hg3d lg3d'; R.root = root;
  const ui = `${host ? '' : '<canvas></canvas>'}
    <div class="ct-top"><div><small>${esc(co.name)} · ${esc(it.k)}${A ? ' · ' + esc(A.city || A.name) : ''}</small><b>${esc(R.spec.name)}</b></div></div>
    <button class="ct-leave" data-op="leave">${icon('close')}<span>Leave the lounge</span><kbd>Esc</kbd></button>
    <div class="ct-spots of-spots op-spots hg-spots" hidden></div><div class="of-aim op-aim" hidden></div><div class="walk-pad ct-pad op-pad" hidden><i></i></div><div class="of-aim op-dot" hidden>+</div><div class="hg-panel" hidden></div><div class="hg-fade"></div>
    ${host ? '' : ctLoaderHtml(R.spec.name, 'Opening the doors…', LG_EMBLEM)}`;
  if (host) { host.mount('lounge', ui); lgOpen2(root, q); return; }   // in the building: built already, straight in
  root.innerHTML = ui;
  document.body.appendChild(root);
  setTimeout(() => { if (R.on && R.root === root) lgOpen2(root, q); }, 80);
};

/* ---------- the room ---------- */
function lgBuild(scene: any, q: number): any {
  const R = LoungeRoom, T = THREE, sp: LgSpec = R.spec, lv = R.lvl, W = sp.W, D = sp.D, H = sp.H, co: any = company();
  const A: any = { hits: [], blocks: [] as number[][], flames: [], steam: [], surf: [] as any[] };
  const root = new T.Group(); scene.add(root); A.root = root;
  const shadow = q >= 1;
  const M = (o: any) => new T.MeshStandardMaterial(Object.assign({ roughness: 0.6 }, o));
  const add = (g: any, m: any, x: number, y: number, z: number, ry?: number) => { const o = new T.Mesh(g, m); o.position.set(x, y, z); if (ry) o.rotation.y = ry; o.castShadow = shadow; o.receiveShadow = true; root.add(o); return o; };
  const bx = (w: number, h: number, d: number, m: any, x: number, y: number, z: number, ry?: number) => add(new T.BoxGeometry(w, h, d), m, x, y, z, ry);
  const block = (x0: number, z0: number, x1: number, z1: number) => A.blocks.push([Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1)]);
  const prop = (name: string, x: number, z: number, ry: number, build: () => void) => {
    const n0 = root.children.length; build();
    const g = new T.Group(); g.name = name; g.position.set(x, 0, z); g.rotation.y = ry; root.add(g); g.updateMatrixWorld(true);
    for (const o of root.children.slice(n0)) if (o !== g) g.attach(o);
    lgPropSwap(g, name); return g;
  };
  const x0 = -W / 2, x1 = W / 2, z0 = -D / 2, z1 = D / 2;
  // materials by level
  const gold = M({ color: 0xD4AF37, metalness: 1, roughness: 0.25 }), brass = M({ color: 0xB08D57, metalness: 0.9, roughness: 0.3 }), chrome = M({ color: 0xDDE2E8, metalness: 1, roughness: 0.15 });
  const walnut = M({ map: ctTex(ctWood('#6B4428', '#2E1A0E', 5)), roughness: 0.4 }), oak = M({ map: ctTex(ctWood('#B89466', '#7A5A36', 6)), roughness: 0.5 });
  const marble = M({ map: ctTex(lgMarble()), roughness: 0.15, metalness: 0.05 }), porcelain = M({ color: 0xF7F5F0, roughness: 0.2 }), black = M({ color: 0x15171B, roughness: 0.4 });
  const fabric = [M({ color: 0x3E6A8A, roughness: 0.95 }), M({ map: ctTex(ctLeather('#7A3F22')), roughness: 0.45 }), M({ color: 0x1F5C4A, roughness: 0.85 })][lv];
  const legM = [M({ color: 0x2A2D33, metalness: 0.6, roughness: 0.4 }), black, gold][lv];
  // floor, walls, ceiling
  { const floorM = lv === 2 ? marble : lv === 1 ? M({ map: ctTex(lgHerringbone()), roughness: 0.42 }) : M({ map: ctTex(ctNoise('#8A8F96', 0.08, 3), 6, 4), roughness: 0.7 });
    if (floorM.map) { floorM.map.repeat.set(W / (lv === 1 ? 4 : 3), D / (lv === 1 ? 4 : 3)); }
    const f = new T.Mesh(new T.PlaneGeometry(W, D), floorM); f.rotation.x = -Math.PI / 2; f.receiveShadow = true; root.add(f);
    // the ceiling: copper waves on every level (its own model file)
    lgCeilingWaves(root, W, D, H, q);
    const wallM = lv === 0 ? M({ color: 0xE3E6EA, roughness: 0.9 }) : lv === 1 ? M({ map: ctTex(lgPlaster(), 3, 1), roughness: 0.9 }) : M({ color: 0xEDE6DA, roughness: 0.8 });
    // the back wall has the way in: an opening for the sliding doors (dx ± LG_DOOR_W/2, LG_DOOR_H high)
    const dxo = W / 2 - 6.3, oa = dxo - LG_DOOR_W / 2, ob = dxo + LG_DOOR_W / 2;
    const backSeg = (xa: number, xb: number, ya: number, yb: number, m: any, dz: number) => { if (xb - xa < 0.01 || yb - ya < 0.01) return; const p = new T.Mesh(new T.PlaneGeometry(xb - xa, yb - ya), m); p.position.set((xa + xb) / 2, (ya + yb) / 2, z1 - dz); p.rotation.y = Math.PI; p.receiveShadow = true; root.add(p); };
    backSeg(x0, oa, 0, H, wallM, 0); backSeg(ob, x1, 0, H, wallM, 0); backSeg(oa, ob, LG_DOOR_H, H, wallM, 0);
    for (const [w, x, z, ry] of [[D, x0, 0, Math.PI / 2], [D, x1, 0, -Math.PI / 2]] as number[][]) { const p = new T.Mesh(new T.PlaneGeometry(w, H), wallM); p.position.set(x, H / 2, z); p.rotation.y = ry; p.receiveShadow = true; root.add(p); }
    if (lv >= 1) { const wains = lv === 2 ? marble : walnut;   // a wainscot to 1.1 m with a gold line (walnut in the Business lounge, marble in the Flagship)
      for (const [w, x, z, ry] of [[D, x0 + 0.02, 0, Math.PI / 2], [D, x1 - 0.02, 0, -Math.PI / 2]] as number[][]) { const p = new T.Mesh(new T.PlaneGeometry(w, 1.1), wains); p.position.set(x, 0.55, z); p.rotation.y = ry; root.add(p); const t = new T.Mesh(new T.BoxGeometry(w, 0.04, 0.03), gold); t.position.set(x, 1.12, z); t.rotation.y = ry; root.add(t); }
      for (const [xa, xb] of [[x0, oa - 0.12], [ob + 0.12, x1]]) { backSeg(xa, xb, 0, 1.1, wains, 0.02); const t = new T.Mesh(new T.BoxGeometry(xb - xa, 0.04, 0.03), gold); t.position.set((xa + xb) / 2, 1.12, z1 - 0.02); root.add(t); } }
    // the carpet (its own model file per level)
    // under the seating (the groups of armchairs start 2.6 m from the windows, one or two rows of them)
    const rows = lv === 0 ? 1 : 2, cw = W * 0.7, cd = rows * 3.3 + 1.4, cz = z0 + 2.6 + (rows - 1) * 1.65;
    prop(['carpet-lounge', 'carpet-business', 'carpet-flagship'][lv], 0, cz, 0, () => { const cp = new T.Mesh(new T.BoxGeometry(cw, 0.012, cd), M({ map: ctTex(lgCarpet(lv)), roughness: 1 })); cp.position.set(0, 0.006, cz); cp.receiveShadow = true; root.add(cp); });
  }
  // the window wall onto the apron (−z): tall panes, mullions, the view beyond
  { const view = new T.Mesh(new T.PlaneGeometry(W * 2.4, W * 0.6), new T.MeshBasicMaterial({ map: ctTex(lgView(hgSun(R.k))), toneMapped: false })); view.position.set(0, W * 0.15 - 2, z0 - 14); root.add(view); A.view = view;
    const n = Math.round(W / 2.2); for (let i = 0; i <= n; i++) bx(0.09, H, 0.14, lv === 2 ? brass : black, x0 + i * W / n, H / 2, z0);
    bx(W, 0.12, 0.2, lv === 2 ? brass : black, 0, 0.06, z0); bx(W, 0.2, 0.2, lv === 2 ? brass : black, 0, H - 0.1, z0);
    const gl = new T.Mesh(new T.PlaneGeometry(W, H), new T.MeshPhysicalMaterial({ color: 0xCFE2F2, transparent: true, opacity: 0.12, roughness: 0.03, depthWrite: false })); gl.position.set(0, H / 2, z0 + 0.01); gl.renderOrder = 3; root.add(gl);
    block(x0, z0 - 1, x1, z0 + 0.4); }
  block(x0 - 1, z0, x0 + 0.35, z1); block(x1 - 0.35, z0, x1 + 1, z1); block(x0, z1 - 0.35, x1, z1 + 1);
  // the way in: a glass door on the front wall, the reception desk beside it
  { const dx = W / 2 - 6.3, fm = lv === 2 ? brass : black, dw = LG_DOOR_W, dh = LG_DOOR_H;
    // the frame: two posts, a header with the door operator above it
    bx(0.09, dh, 0.16, fm, dx - dw / 2 - 0.045, dh / 2, z1 - 0.06); bx(0.09, dh, 0.16, fm, dx + dw / 2 + 0.045, dh / 2, z1 - 0.06);
    bx(dw + 0.18, 0.22, 0.2, fm, dx, dh + 0.11, z1 - 0.08); bx(dw * 2 + 0.4, 0.16, 0.12, M({ color: 0x3C3F44, metalness: 0.6, roughness: 0.4 }), dx, dh - 0.02, z1 - 0.2);
    // two sliding glass leaves (props/door-2), each sliding to its own side
    const leaves: any[] = [];
    for (const s of [-1, 1]) { const g = Props.place(root, 'door-2', dx + s * dw / 4, z1 - 0.16, Math.PI, q, { w: dw / 2 + 0.02, h: dh - 0.06, rail: lv === 2 ? 0xB08D57 : 0x2A2C30 });
      g.userData.x0 = dx + s * dw / 4; g.userData.x1 = dx + s * (dw * 3 / 4 - 0.02); leaves.push(g);
      // a frosted band with the airline's name, at eye height, on each leaf
      const [bc, bxx] = ctCanvas(256, 32); bxx.fillStyle = 'rgba(255,255,255,0.78)'; bxx.fillRect(0, 0, 256, 32); bxx.fillStyle = 'rgba(60,60,60,0.85)'; bxx.font = '600 15px Inter, Arial, sans-serif'; bxx.textAlign = 'center'; bxx.fillText(String(co.name || '').toUpperCase(), 128, 21);
      const band = new T.Mesh(new T.PlaneGeometry(dw / 2 - 0.06, 0.1), new T.MeshBasicMaterial({ map: ctTex(bc), transparent: true })); band.position.set(0, 1.2, -0.012); band.rotation.y = Math.PI; band.userData.keep = true; g.add(band); }
    A.doorLeaves = leaves; A.doorK = 0; A.doorTo = 0;
    // beyond the doors: the concourse (a short hall with its floor, walls and lights, and the view along it); in the
    // test rooms the real concourse is there instead
    if (!R.linked) { const fl = new T.Mesh(new T.PlaneGeometry(dw + 3, 3.2), M({ color: 0xB8B2A6, roughness: 0.45 })); fl.rotation.x = -Math.PI / 2; fl.position.set(dx, 0.002, z1 + 1.6); root.add(fl);
      for (const s of [-1, 1]) { const w2 = new T.Mesh(new T.PlaneGeometry(3.2, 3.2), M({ color: 0xE9E7E1, roughness: 0.8 })); w2.position.set(dx + s * (dw / 2 + 1.5), 1.6, z1 + 1.6); w2.rotation.y = -s * Math.PI / 2; root.add(w2); }
      const ce = new T.Mesh(new T.PlaneGeometry(dw + 3, 3.2), new T.MeshBasicMaterial({ color: 0xF4F1EA })); ce.rotation.x = Math.PI / 2; ce.position.set(dx, 3.2, z1 + 1.6); root.add(ce);
      const [vc, vx] = ctCanvas(512, 320); const gr = vx.createLinearGradient(0, 0, 0, 320); gr.addColorStop(0, '#EDEAE2'); gr.addColorStop(0.55, '#D9D3C6'); gr.addColorStop(0.56, '#B9B2A4'); gr.addColorStop(1, '#A39C8E'); vx.fillStyle = gr; vx.fillRect(0, 0, 512, 320);
      vx.fillStyle = '#2B3036'; vx.fillRect(150, 70, 212, 40); vx.fillStyle = '#F4C542'; vx.font = '700 22px Inter, Arial, sans-serif'; vx.fillText('\u2190  Gates   Exit  \u2192', 168, 98);
      for (let i = 0; i < 7; i++) { vx.fillStyle = 'rgba(255,248,230,0.9)'; vx.fillRect(40 + i * 66, 20, 36, 6); }
      for (let i = 0; i < 5; i++) { vx.fillStyle = 'rgba(40,40,46,0.55)'; const px = 60 + i * 95 + (i % 2) * 20, ph = 46 + (i % 3) * 6; vx.fillRect(px, 176 - ph, 12, ph); vx.beginPath(); vx.arc(px + 6, 176 - ph - 7, 7, 0, 6.3); vx.fill(); }
      const view = new T.Mesh(new T.PlaneGeometry(dw + 3, 3.2), new T.MeshBasicMaterial({ map: ctTex(vc) })); view.position.set(dx, 1.6, z1 + 3.2); view.rotation.y = Math.PI; root.add(view); }
    // the green exit sign over the doors, inside
    { const ex = new T.Mesh(new T.PlaneGeometry(0.46, 0.17), new T.MeshBasicMaterial({ map: ctTex(ctExit()), toneMapped: false })); ex.position.set(dx, dh + 0.42, z1 - 0.02); ex.rotation.y = Math.PI; root.add(ex); }
    const hit = new T.Mesh(new T.BoxGeometry(dw, dh, 0.4), new T.MeshBasicMaterial({ visible: false })); hit.position.set(dx, dh / 2, z1 - 0.2); hit.userData.act = 'door'; root.add(hit); A.hits.push(hit); A.door = new T.Vector3(dx, 0, z1 - 1.4);
    // the arrival area: a mat inside the doors, kept clear; where you start when you open the lounge from the menus
    A.spawn = { x: dx, z: z1 - 2.3, yaw: 0.15 };
    prop('welcome-mat', dx, z1 - 1.9, 0, () => { const [mc, mx] = ctCanvas(512, 256); mx.fillStyle = '#23262B'; mx.fillRect(0, 0, 512, 256); mx.strokeStyle = '#C9A25E'; mx.lineWidth = 6; mx.strokeRect(14, 14, 484, 228); mx.fillStyle = '#C9A25E'; mx.font = '600 44px Georgia, serif'; mx.textAlign = 'center'; mx.textBaseline = 'middle'; mx.fillText('WELCOME', 256, 130);
      const mat = new T.Mesh(new T.BoxGeometry(2.0, 0.01, 1.2), M({ map: ctTex(mc), roughness: 1 })); mat.position.set(dx, 0.005, z1 - 1.9); mat.receiveShadow = true; root.add(mat); });
    prop('reception-desk', dx - 2.6, z1 - 1.6, Math.PI, () => {
      const top = lv === 2 ? marble : lv === 1 ? walnut : M({ color: 0xE9E4DA, roughness: 0.35 });
      bx(2.2, 1.05, 0.6, lv === 0 ? M({ color: 0x3C5A72 }) : walnut, dx - 2.6, 0.525, z1 - 1.6); bx(2.3, 0.05, 0.75, top, dx - 2.6, 1.07, z1 - 1.6);
      const [lc, lx] = ctCanvas(512, 128); lx.fillStyle = co.color || '#2C8CFF'; lx.fillRect(0, 0, 512, 128); lx.fillStyle = '#fff'; lx.font = '700 48px Georgia, serif'; lx.textAlign = 'center'; lx.textBaseline = 'middle'; lx.fillText(co.name, 256, 66);
      const logo = new T.Mesh(new T.PlaneGeometry(1.6, 0.4), new T.MeshBasicMaterial({ map: ctTex(lc) })); logo.position.set(dx - 2.6, 0.6, z1 - 1.91); logo.rotation.y = Math.PI; root.add(logo); });
    block(dx - 3.8, z1 - 2.0, dx - 1.4, z1 - 1.2);
    A.desk = new T.Vector3(dx - 2.6, 0, z1 - 1.0); }
  // seating: groups of armchairs (and a sofa) round coffee tables on the carpet
  const seats: any[] = [];
  const upCol = [0x3E6A8A, 0x7A3F22, 0x1F5C4A][lv];
  const chairsAt: number[][] = [], armchair = (x: number, z: number, ry: number) => { chairsAt.push([x, z, ry]); };   // all drawn together below
  const table = (x: number, z: number) => prop(['coffee-table-oak', 'coffee-table-walnut', 'coffee-table-marble'][lv], x, z, 0, () => {
    const top = [oak, walnut, marble][lv]; add(new T.CylinderGeometry(0.5, 0.5, 0.05, 40), top, x, 0.42, z);
    if (lv === 2) { for (let i = 0; i < 3; i++) { const a = i / 3 * 6.283; const l = add(new T.CylinderGeometry(0.02, 0.02, 0.4, 8), gold, x + Math.cos(a) * 0.3, 0.2, z + Math.sin(a) * 0.3); l.rotation.z = Math.cos(a) * 0.2; l.rotation.x = -Math.sin(a) * 0.2; } }
    else add(new T.CylinderGeometry(0.06, 0.2, 0.4, 16), legM, x, 0.2, z); });
  const clusters: number[][] = [];
  { const nx = lv === 0 ? 2 : lv === 1 ? 3 : 4; for (let i = 0; i < nx; i++) for (let j = 0; j < (lv === 0 ? 1 : 2); j++) clusters.push([-W * 0.3 + (i + 0.5) * W * 0.6 / nx, z0 + 2.6 + j * 3.3]); }
  clusters.forEach((c, ci) => {
    table(c[0], c[1]); block(c[0] - 0.55, c[1] - 0.55, c[0] + 0.55, c[1] + 0.55); A.surf.push({ x: c[0], z: c[1], top: 0.445, r: 0.46 });
    for (const [dx, dz, ry] of [[0, -1.0, 0], [0, 1.0, Math.PI], [-1.0, 0, Math.PI / 2], [1.0, 0, -Math.PI / 2]] as number[][]) {
      if (ci % 2 && dx === 0 && dz < 0) continue;
      armchair(c[0] + dx, c[1] + dz, ry); block(c[0] + dx - 0.45, c[1] + dz - 0.45, c[0] + dx + 0.45, c[1] + dz + 0.45);
      seats.push({ x: c[0] + dx, z: c[1] + dz, ry, hip: 0.5, kind: 'armchair' });
    }
    // cups and napkins on the tables
    prop(ci % 2 ? 'teacup-and-saucer' : 'coffee-cup-and-saucer', c[0] + 0.18, c[1] + 0.1, 0, () => lgCup(add, porcelain, lv === 2 ? gold : null, c[0] + 0.18, 0.445, c[1] + 0.1, ci % 2 === 1, ci % 2 ? 0x7A3E14 : 0x3A1F0E));
    prop('napkin-stack', c[0] - 0.2, c[1] - 0.08, 0.3, () => lgNapkins(add, c[0] - 0.2, 0.445, c[1] - 0.08, 4, lv));
  });
  Props.placeMany(root, 'armchair-' + (lv + 1), chairsAt, q, { color: upCol });   // every armchair at once: one draw call per material
  A.seats = seats;
  // a sofa against each side wall
  for (const s of [-1, 1]) { const x = s * (W / 2 - 0.65), z = z0 + D * 0.42;
    Props.place(root, 'sofa-' + (lv + 1), x, z, -s * Math.PI / 2, q, { seats: 3, color: upCol });
    block(x - 0.5, z - 1.2, x + 0.5, z + 1.2);
    for (let k = -1; k <= 1; k++) seats.push({ x: x - s * 0.05, z: z + s * k * 0.64, ry: -s * Math.PI / 2, hip: 0.5, kind: 'sofa' });   // three places on the sofa
    // a floor lamp and a plant beside it
    prop('floor-lamp', x, z + 1.6, 0, () => { add(new T.CylinderGeometry(0.16, 0.18, 0.03, 20), lv === 2 ? brass : black, x, 0.015, z + 1.6); add(new T.CylinderGeometry(0.015, 0.015, 1.5, 8), lv === 2 ? brass : black, x, 0.76, z + 1.6); const sh = add(new T.CylinderGeometry(0.18, 0.25, 0.3, 24, 1, true), new T.MeshStandardMaterial({ color: 0xF4ECD8, emissive: 0xFFE2A8, emissiveIntensity: 0.6, side: T.DoubleSide }), x, 1.55, z + 1.6); void sh; });
    Props.place(root, (lv === 0 ? ['plant-3', 'plant-1'] : lv === 1 ? ['plant-1', 'plant-2'] : ['plant-2', 'plant-1'])[s < 0 ? 0 : 1], x, z - 1.7, s * 0.7, q, { seed: 3 + s });
    block(x - 0.35, z + 1.3, x + 0.35, z - 2.05);
  }
  // the refreshment corner (back right): counter, espresso machine, tea urn, teapot, cups, napkins, fruit, the fridge
  { const cx = x1 - 3.0, cz = z1 - 1.0, top = lv === 2 ? marble : lv === 1 ? M({ color: 0x2B2F36, roughness: 0.25 }) : M({ color: 0xE9E4DA, roughness: 0.35 });
    prop('buffet-counter', cx, cz, Math.PI, () => { bx(3.2, 0.88, 0.7, lv === 0 ? M({ color: 0x3C5A72 }) : walnut, cx, 0.44, cz); bx(3.3, 0.05, 0.78, top, cx, 0.905, cz); });
    block(cx - 1.7, cz - 0.45, cx + 1.7, z1); A.surf.push({ x: cx, z: cz - 0.05, top: 0.93, w: 3.2, d: 0.66 });
    const cm = Props.place(root, 'coffee-machine-1', cx - 1.1, cz + 0.05, Math.PI, q, {}, 0.93);
    { root.updateMatrixWorld(true); cm.updateMatrixWorld(true); const at = (x: number, y: number, z: number) => root.worldToLocal(cm.localToWorld(new T.Vector3(x, y, z)));
      A.coffeeScreen = at(0, 0.5, 0.3); A.coffeeSpout = at(0, 0.25, 0.35); }   // the touchscreen on its front; the spouts over the cup
    prop('tea-urn', cx - 0.35, cz, 0, () => lgUrn(add, lv === 0 ? chrome : brass, black, cx - 0.35, 0.93, cz, lv));
    prop('teapot', cx + 0.2, cz - 0.1, 0.6, () => lgTeapot(add, lv === 2 ? porcelain : lv === 1 ? M({ color: 0x1E2F4F, roughness: 0.25 }) : porcelain, lv === 2 ? gold : null, cx + 0.2, 0.93, cz - 0.1));
    for (let i = 0; i < 4; i++) prop(i % 2 ? 'teacup-and-saucer' : 'coffee-cup-and-saucer', cx + 0.55 + (i % 2) * 0.2, cz - 0.15 + Math.floor(i / 2) * 0.22, 0, () => lgCup(add, porcelain, lv === 2 ? gold : null, cx + 0.55 + (i % 2) * 0.2, 0.93, cz - 0.15 + Math.floor(i / 2) * 0.22, i % 2 === 1, 0));
    prop('napkin-stack', cx + 1.0, cz, 0, () => lgNapkins(add, cx + 1.0, 0.93, cz, 10, lv));
    prop('fruit-bowl', cx + 1.38, cz - 0.05, 0, () => lgFruit(add, lv === 2 ? gold : porcelain, cx + 1.38, 0.93, cz - 0.05));
    const hit = new T.Mesh(new T.BoxGeometry(2.0, 0.7, 0.8), new T.MeshBasicMaterial({ visible: false })); hit.position.set(cx - 0.7, 1.2, cz); hit.userData.act = 'coffee'; root.add(hit); A.hits.push(hit); A.coffeeAt = new T.Vector3(cx - 1.1, 0.93 + 0.058, cz + 0.05 - (cm.userData.cupAt ? cm.userData.cupAt.z : 0.34));
    // the vending machine (the same as the hangars'): choose, the coil turns, it drops; open the flap and take it
    const fx = x1 - 0.62, fz = cz - 1.6;
    HG_VR = LoungeRoom; hgVendBuild(A, fx, fz, -Math.PI / 2); }
  // a magazine rack by the door, the departures screen on the front wall
  { const mx = x0 + (lv >= 1 ? 0.62 : 1.2), mz = z1 - 0.5;   // beside the bar's end on the bar's levels
    prop('magazine-rack', mx, mz, Math.PI, () => { bx(0.7, 1.0, 0.3, lv === 0 ? M({ color: 0x3C5A72 }) : walnut, mx, 0.5, mz); const cols = [0xC0392B, 0x2E5C8A, 0xF2B544, 0x2F6B4A, 0x8E44AD, 0xE67E22]; for (let r = 0; r < 3; r++) for (let i = 0; i < 2; i++) { const m = new T.Mesh(new T.PlaneGeometry(0.26, 0.3), M({ color: cols[(r * 2 + i) % cols.length] })); m.position.set(mx - 0.16 + i * 0.32, 0.3 + r * 0.3, mz - 0.17); m.rotation.set(0.15, Math.PI, 0); root.add(m); } });
    block(mx - 0.45, mz - 0.3, mx + 0.45, z1);
    // the flight boards: Departures and Arrivals side by side, 30 cm apart (fids3d.ts)
    try { A.fids = fidsPair(root, R.k, -W * 0.05, 2.0, z1 - 0.07, Math.PI, 1.6); } catch (e) { A.fids = []; }
    // and a pair on each side wall, high over the sofas (the walls are tall enough now)
    for (const s2 of [-1, 1]) { try { A.fids = A.fids.concat(fidsPair(root, R.k, s2 * (W / 2 - 0.07), 2.75, z0 + D * 0.42, -s2 * Math.PI / 2, 1.3)); } catch (e) { /* that wall without */ } } }
  // Business and Flagship: the bar (back left). An L-shaped counter in black lacquer with a top of black stone veined
  // with gold, returning to the back wall at its right end; a brass foot rail; stools on brass legs; behind it a mirrored
  // wall in a brass frame with glass shelves of bottles, lit from below; globe lights hanging over the counter.
  // The bartender works along the long side as before (lounge-bar.ts).
  if (lv >= 1) { const bxp = x0 + 3.2, bz = z1 - 1.2, xa = bxp - 1.85, xc = bxp + 1.85, xr = bxp + 2.45;   // xa..xr the counter, xc..xr the return
    const lacq = M({ color: 0x111214, roughness: 0.18, metalness: 0.1 }), stone = M({ map: ctTex(lgDarkMarble()), roughness: 0.2, metalness: 0.05 }), brassB = M({ color: 0xC9A25E, metalness: 0.95, roughness: 0.28 });
    prop('bar-counter', bxp, bz, Math.PI, () => {
      bx(xr - xa, 1.08, 0.6, lacq, (xa + xr) / 2, 0.54, bz);                                   // the long side
      bx(0.6, 1.08, z1 - bz - 0.3, lacq, (xc + xr) / 2, 0.54, (bz + 0.3 + z1) / 2);            // the return to the wall
      bx(xr - xa + 0.2, 0.06, 0.8, stone, (xa + xr) / 2 + 0.1 - 0.1, 1.1, bz);                 // the tops
      bx(0.8, 0.06, z1 - bz - 0.4, stone, (xc + xr) / 2, 1.1, (bz + 0.4 + z1) / 2 - 0.02);
      bx(xr - xa, 0.03, 0.012, brassB, (xa + xr) / 2, 1.06, bz - 0.306);                        // a brass line under the top
      bx(0.012, 0.03, z1 - bz - 0.3, brassB, xr + 0.006, 1.06, (bz + 0.3 + z1) / 2);
      // the foot rail, on brass brackets
      const rail = (x0r: number, z0r: number, x1r: number, z1r: number) => { const len = Math.hypot(x1r - x0r, z1r - z0r), r = add(new T.CylinderGeometry(0.022, 0.022, len, 12), brassB, (x0r + x1r) / 2, 0.2, (z0r + z1r) / 2); r.rotation.z = Math.PI / 2; r.rotation.y = -Math.atan2(z1r - z0r, x1r - x0r);
        for (let k = 0; k <= Math.floor(len / 1.1); k++) { const t = k / Math.max(1, Math.floor(len / 1.1)); add(new T.CylinderGeometry(0.012, 0.012, 0.2, 8), brassB, x0r + (x1r - x0r) * t, 0.1, z0r + (z1r - z0r) * t); } };
      rail(xa + 0.05, bz - 0.4, xr + 0.1, bz - 0.4); rail(xr + 0.1, bz - 0.4, xr + 0.1, z1 - 0.12); });
    block(xa - 0.1, bz - 0.5, xr + 0.15, z1); A.surf.push({ x: bxp, z: bz - 0.1, top: 1.13, w: 3.7, d: 0.7 }, { x: (xc + xr) / 2, z: (bz + z1) / 2 + 0.2, top: 1.13, w: 0.7, d: z1 - bz - 0.6 });
    const seatM = M({ map: ctTex(ctLeather('#1E1E20')), roughness: 0.5 }), stool = (sx: number, sz: number, ry: number) => {
      prop('bar-stool', sx, sz, ry, () => { add(new T.CylinderGeometry(0.21, 0.2, 0.07, 24), seatM, sx, 0.8, sz); add(new T.CylinderGeometry(0.2, 0.2, 0.02, 24), brassB, sx, 0.755, sz);
        for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + 0.4, l = add(new T.CylinderGeometry(0.012, 0.014, 0.78, 8), brassB, sx + Math.cos(a) * 0.15, 0.38, sz + Math.sin(a) * 0.15); l.rotation.z = Math.cos(a) * 0.12; l.rotation.x = -Math.sin(a) * 0.12; }
        add(new T.TorusGeometry(0.19, 0.01, 8, 28), brassB, sx, 0.3, sz).rotation.x = Math.PI / 2; });
      block(sx - 0.25, sz - 0.25, sx + 0.25, sz + 0.25); seats.push({ x: sx, z: sz, ry, hip: 0.84, kind: 'stool' }); };
    for (let i = 0; i < 5; i++) stool(bxp - 1.6 + i * 0.72, bz - 0.75, 0);     // along the long side (room to stand at the corner)
    for (const sz of [bz + 0.05, bz + 0.78]) stool(xr + 0.7, sz, -Math.PI / 2);   // and along the return
    // the back wall: lacquer cabinet, the mirror in its brass frame, glass shelves with light under them
    prop('bar-mirror', bxp, z1 - 0.03, Math.PI, () => {
      bx(3.6, 0.9, 0.3, lacq, bxp, 0.45, z1 - 0.15); bx(3.64, 0.03, 0.34, stone, bxp, 0.915, z1 - 0.17);
      // the mirror: a real reflection of the room, as wide as the back bar and up to the brass line
      const mir = lgMirror(root, 3.6, 1.9, bxp, 1.95, z1 - 0.012, Math.PI, 0xD8D0C0); mir.userData.keep = true; A.mirrors = (A.mirrors || []).concat([mir]);
      for (const [w, h, x, y] of [[3.7, 0.04, bxp, 2.92], [3.7, 0.04, bxp, 0.98], [0.04, 1.98, bxp - 1.83, 1.95], [0.04, 1.98, bxp + 1.83, 1.95]] as number[][]) bx(w, h, 0.03, brassB, x, y, z1 - 0.02);
      bx(xr + 0.4 - (x0 + 0.1), 0.02, 0.02, brassB, (x0 + 0.1 + xr + 0.4) / 2, 3.02, z1 - 0.012); });   // a brass line along the wall
    prop('bottle-shelf', bxp, z1 - 0.2, Math.PI, () => { const glassS = new T.MeshStandardMaterial({ color: 0xDDEFF2, roughness: 0.05, transparent: true, opacity: 0.35, depthWrite: false }), led = new T.MeshBasicMaterial({ color: 0xFFD9A0, toneMapped: false });
      for (const y of [1.4, 1.8, 2.2]) { bx(3.0, 0.015, 0.25, glassS, bxp, y, z1 - 0.2).castShadow = false; bx(3.0, 0.01, 0.01, brassB, bxp, y - 0.012, z1 - 0.33); const l = add(new T.BoxGeometry(2.9, 0.008, 0.02), led, bxp, y - 0.012, z1 - 0.1); l.castShadow = false; }
      for (const sx of [-1.52, 1.52]) bx(0.02, 1.0, 0.02, brassB, bxp + sx, 1.8, z1 - 0.33); });
    // globe lights over the counter, a little in front of it (the glass rack hangs over the top)
    for (let i = 0; i < 5; i++) { const gx = xa + 0.4 + i * (xr - xa - 0.8) / 4, gz = bz - 0.5, gy = Math.min(2.85, H - 1.4);
      prop('bar-pendant-globe', gx, gz, 0, () => { add(new T.CylinderGeometry(0.004, 0.004, H - gy - 0.17, 6), black, gx, (H + gy + 0.17) / 2, gz).castShadow = false; const gl = add(new T.SphereGeometry(0.17, 24, 16), new T.MeshStandardMaterial({ color: 0xFFFFFF, emissive: 0xFFF1DA, emissiveIntensity: 1.1, roughness: 0.4 }), gx, gy, gz); gl.castShadow = false; add(new T.CylinderGeometry(0.03, 0.03, 0.04, 12), brassB, gx, gy + 0.18, gz); }); }
    try { lgMixStation(root, (xc + xr) / 2, 1.13, bz + 0.62); } catch (e) { /* none */ }
    try { lgBarBuild(A, root, lv, bxp, bz, z1, H, q); } catch (e) { console.error(e); } }
  // paintings on every level: not too many, each with its picture light. The northern lights and the dusk on the side
  // walls (towards the windows), the arcs of gold beside the bar, the storm over the refreshment corner.
  { const k = lv === 0 ? 0.8 : 1, y = lv === 0 ? 2.1 : 2.25, fidsL = -W * 0.05 - 1.65, own = Models.has('lounge-props/wall-art.glb');
    const left = lv >= 1 ? x0 + 5.65 : x0 + 2.0;
    const hang = (name: string, kind: string, w: number, h: number, x: number, z: number, ry: number) => { try { lgHangPainting(root, name, kind, w * k, h * k, x, y, z, ry); } catch (e) { /* bare wall */ } };
    hang(own ? 'wall-art' : 'painting-aurora', 'aurora', 2.6, 1.5, x0 + 0.02, z0 + D * 0.17, Math.PI / 2);
    hang(own ? 'wall-art' : 'painting-dusk', 'dusk', 1.8, 1.2, x1 - 0.02, z0 + D * 0.2, -Math.PI / 2);
    hang('painting-gold', 'gold', 1.3, 1.6, (left + fidsL) / 2, z1 - 0.02, Math.PI);
    hang('painting-storm', 'storm', 2.4, 1.3, x1 - 3.0, z1 - 0.02, Math.PI); }
  // Business and Flagship: the art deco fireplace on the west wall: a black lacquer chimney breast to the ceiling, a
  // brass surround in five stepped frames like a sunburst, a fan of brass rays above, warm light washing up the breast.
  // The fire is the lounge's own (its flames and their light). File: lounge-props/fireplace.glb.
  if (lv >= 1) {
    const fx = x0, fz = z0 + D * 0.72, brassF = M({ color: 0xC9A25E, metalness: 0.95, roughness: 0.28, emissive: 0x5A3E14, emissiveIntensity: 0.55 });   // the brass catches the fire's glow
    // w along the wall (z), d out from it (x), at a distance x from the wall
    const at = (w: number, h: number, d: number, m: any, x: number, y: number, z: number) => bx(d, h, w, m, fx + x, y, fz + z);
    prop('fireplace', fx + 0.3, fz, Math.PI / 2, () => {
      at(3.0, H, 0.12, M({ color: 0x111111, roughness: 0.15, metalness: 0.2 }), 0.06, H / 2, 0);
      for (let s2 = 0; s2 < 5; s2++) { const w2 = 1.2 + s2 * 0.28, h2 = 1.0 + s2 * 0.14, d2 = 0.14 + (4 - s2) * 0.02;
        at(w2 + 0.04, 0.04, d2, brassF, 0.12 + d2 / 2, h2, 0); at(0.04, h2, d2, brassF, 0.12 + d2 / 2, h2 / 2, w2 / 2); at(0.04, h2, d2, brassF, 0.12 + d2 / 2, h2 / 2, -w2 / 2); }
      at(1.16, 0.96, 0.06, M({ color: 0x050505, roughness: 0.9 }), 0.13, 0.48, 0);                     // the firebox
      at(2.6, 0.05, 0.6, M({ map: ctTex(lgDarkMarble()), roughness: 0.25 }), 0.42, 0.025, 0);         // the hearth
      const fl = new T.Mesh(new T.PlaneGeometry(1.0, 0.5), new T.MeshBasicMaterial({ map: ctTex(lgFlame()), transparent: true, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false })); fl.position.set(fx + 0.3, 0.32, fz); fl.rotation.y = Math.PI / 2; root.add(fl); A.flames.push(fl);
      at(0.9, 0.06, 0.18, M({ color: 0x3A2214, roughness: 0.9 }), 0.26, 0.08, 0);                     // the logs' bed
      for (let i = 0; i < 9; i++) { const a2 = (i - 4) * 0.22, r2 = add(new T.BoxGeometry(0.02, 1.2, 0.03), brassF, fx + 0.14, 2.6 + Math.cos(a2) * 0.6, fz + Math.sin(a2) * 0.6); r2.rotation.x = a2; r2.castShadow = false; }
      const L = new T.PointLight(0xFF8A3C, 1.6, 6, 2); L.position.set(fx + 0.8, 0.5, fz); root.add(L); A.fireL = L;
      if (q >= 2) { const up = new T.SpotLight(0xFFC98A, 4, 4.5, 0.5, 0.8, 2); up.position.set(fx + 0.8, 0.25, fz); up.target.position.set(fx, 3.5, fz); root.add(up); root.add(up.target); } });
    block(fx - 0.5, fz - 1.5, fx + 0.8, fz + 1.5);
  }
  // Flagship: a grand piano, art and a champagne bucket
  if (lv === 2) {
    const px = W * 0.28, pz = z0 + D * 0.2;
    prop('grand-piano', px, pz, -0.5, () => { const g = new T.Group(); g.position.set(px, 0, pz); g.rotation.y = -0.5; root.add(g); const pm = M({ color: 0x0A0A0C, roughness: 0.08, metalness: 0.2 });
      const sh = new T.Shape(); sh.moveTo(-0.75, -0.8); sh.lineTo(0.75, -0.8); sh.lineTo(0.75, 0.2); sh.bezierCurveTo(0.75, 0.9, 0.1, 1.0, -0.1, 1.1); sh.bezierCurveTo(-0.6, 1.2, -0.75, 0.9, -0.75, 0.6); sh.lineTo(-0.75, -0.8);
      const bd = new T.Mesh(new T.ExtrudeGeometry(sh, { depth: 0.32, bevelEnabled: false }), pm); bd.rotation.x = -Math.PI / 2; bd.position.y = 0.62; bd.castShadow = shadow; g.add(bd);
      const lid = new T.Mesh(new T.ExtrudeGeometry(sh, { depth: 0.02, bevelEnabled: false }), pm); lid.rotation.x = -Math.PI / 2 - 0.6; lid.position.set(0, 0.96, -0.78); g.add(lid);
      const keys = new T.Mesh(new T.BoxGeometry(1.42, 0.03, 0.16), porcelain); keys.position.set(0, 0.8, -0.88); g.add(keys);
      for (const [X, Z] of [[-0.6, -0.65], [0.6, -0.65], [0, 0.85]]) { const l = new T.Mesh(new T.CylinderGeometry(0.05, 0.04, 0.62, 10), pm); l.position.set(X, 0.31, Z); g.add(l); }
      const bench = new T.Mesh(new T.BoxGeometry(0.8, 0.08, 0.36), pm); bench.position.set(0, 0.48, -1.35); g.add(bench); for (const s of [-1, 1]) { const l = new T.Mesh(new T.BoxGeometry(0.05, 0.46, 0.3), pm); l.position.set(s * 0.35, 0.23, -1.35); g.add(l); } });
    block(px - 1.1, pz - 1.3, px + 1.1, pz + 1.0);
    { const cx = x0 + 3.2 + 1.2, cz = z1 - 1.2; prop('champagne-bucket', cx, cz, 0, () => { add(new T.CylinderGeometry(0.11, 0.08, 0.22, 20, 1, true), chrome, cx, 1.24, cz); const b = add(new T.CylinderGeometry(0.035, 0.04, 0.3, 12), M({ color: 0x1F3A20, roughness: 0.1 }), cx, 1.3, cz); b.rotation.z = 0.25; add(new T.CylinderGeometry(0.015, 0.02, 0.06, 8), gold, cx + 0.04, 1.48, cz); }); }
  }
  // the lights
  { const lamp = new T.MeshBasicMaterial({ color: 0xFFF3DC });
    if (lv === 0) for (let i = -1; i <= 1; i++) for (const z of [z0 + D * 0.3, z0 + D * 0.7]) { const p = new T.Mesh(new T.PlaneGeometry(1.2, 0.6), lamp); p.rotation.x = Math.PI / 2; p.position.set(i * W * 0.3, H - 0.01, z); root.add(p); }
    if (lv === 1) for (const c of clusters) prop('pendant-light', c[0], c[1], 0, () => { add(new T.CylinderGeometry(0.006, 0.006, 1.2, 6), black, c[0], H - 0.6, c[1]); add(new T.ConeGeometry(0.28, 0.3, 24, 1, true), brass, c[0], H - 1.3, c[1]); const b = new T.Mesh(new T.SphereGeometry(0.08, 12, 8), lamp); b.position.set(c[0], H - 1.38, c[1]); root.add(b); });
    if (lv === 2) for (const c of [[-W * 0.2, z0 + D * 0.45], [W * 0.2, z0 + D * 0.45]]) prop('chandelier', c[0], c[1], 0, () => { const cy = H - 1.1; add(new T.CylinderGeometry(0.01, 0.01, 0.8, 6), gold, c[0], H - 0.4, c[1]); for (const [rr, y] of [[0.7, cy], [0.45, cy + 0.25], [0.22, cy + 0.45]]) { add(new T.TorusGeometry(rr, 0.02, 8, 40), gold, c[0], y, c[1]).rotation.x = Math.PI / 2; const n = Math.round(rr * 22); for (let i = 0; i < n; i++) { const a = i / n * 6.283; const cr = add(new T.OctahedronGeometry(0.035), new T.MeshPhysicalMaterial({ color: 0xFFFFFF, roughness: 0, transmission: 0.6, thickness: 0.05, emissive: 0xFFF3DC, emissiveIntensity: 0.3 }), c[0] + Math.cos(a) * rr, y - 0.08, c[1] + Math.sin(a) * rr); cr.castShadow = false; } } const b = new T.Mesh(new T.SphereGeometry(0.15, 16, 10), lamp); b.position.set(c[0], cy + 0.1, c[1]); root.add(b); });
  }
  // every metal: a subtle reflection
  try { lgMetalShine(root, R.ren || (typeof TestRooms !== 'undefined' ? TestRooms.ren : null)); } catch (e) { /* plain */ }
  return A;
}
function lgMarble(): HTMLCanvasElement {
  const [c, x] = ctCanvas(1024, 1024), r = ctRng(55); x.fillStyle = '#EEEAE3'; x.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 14; i++) { x.strokeStyle = `rgba(${90 + r() * 40},${90 + r() * 40},${100 + r() * 40},${0.15 + r() * 0.25})`; x.lineWidth = 1 + r() * 3; x.beginPath(); let X = r() * 1024, Y = 0; x.moveTo(X, Y); while (Y < 1024) { X += (r() - 0.5) * 60; Y += 20 + r() * 40; x.lineTo(X, Y); } x.stroke(); }
  x.strokeStyle = 'rgba(0,0,0,.08)'; x.lineWidth = 2; x.strokeRect(0, 0, 1024, 1024);
  return c;
}
function lgFlame(): HTMLCanvasElement {
  const [c, x] = ctCanvas(256, 128); for (let i = 0; i < 9; i++) { const X = 20 + i * 27, g = x.createRadialGradient(X, 120, 2, X, 90, 60); g.addColorStop(0, 'rgba(255,240,180,1)'); g.addColorStop(0.35, 'rgba(255,150,40,.9)'); g.addColorStop(1, 'rgba(255,60,0,0)'); x.fillStyle = g; x.beginPath(); x.ellipse(X, 95, 16, 34 + (i % 3) * 8, 0, 0, 6.3); x.fill(); }
  return c;
}
/** A cup on its saucer (a teacup is wider and lower), with coffee or tea in it if col. */
function lgCup(add: any, por: any, rim: any, x: number, y: number, z: number, tea: boolean, col: number) {
  const T = THREE, sau = add(new T.CylinderGeometry(0.075, 0.06, 0.012, 28), por, x, y + 0.006, z); void sau;
  const prof = tea ? [[0.03, 0], [0.04, 0.005], [0.05, 0.03], [0.055, 0.055]] : [[0.025, 0], [0.035, 0.006], [0.04, 0.04], [0.04, 0.075]];
  const cup = new T.Mesh(new T.LatheGeometry(prof.map(p => new T.Vector2(p[0], p[1])), 28), por); cup.material = por.clone(); cup.material.side = T.DoubleSide; cup.position.set(x, y + 0.012, z); cup.castShadow = true;
  const g = add(new T.CylinderGeometry(0.0001, 0.0001, 0.0001, 3), por, x, y, z); g.parent.add(cup);
  const h = add(new T.TorusGeometry(tea ? 0.016 : 0.014, 0.004, 6, 14, Math.PI * 1.2), por, x + (tea ? 0.058 : 0.044), y + 0.045, z); h.rotation.z = -Math.PI / 2;
  if (rim) { const rm = add(new T.TorusGeometry(tea ? 0.055 : 0.04, 0.0025, 6, 28), rim, x, y + 0.012 + (tea ? 0.055 : 0.075), z); rm.rotation.x = Math.PI / 2; }
  if (col) { const d = add(new T.CircleGeometry(tea ? 0.05 : 0.037, 24), new T.MeshStandardMaterial({ color: col, roughness: 0.15 }), x, y + 0.012 + (tea ? 0.045 : 0.065), z); d.rotation.x = -Math.PI / 2; }
}
function lgNapkins(add: any, x: number, y: number, z: number, n: number, lv: number) {
  const T = THREE, m = new T.MeshStandardMaterial({ color: [0xF4F4F0, 0xEDE4D0, 0xF7F1E3][lv], roughness: 0.95 });
  for (let i = 0; i < n; i++) { const k = add(new T.BoxGeometry(0.16, 0.004, 0.16), m, x, y + 0.003 + i * 0.005, z); k.rotation.y = i * 0.05; }
  if (lv === 2) { const b = add(new T.BoxGeometry(0.17, 0.006, 0.03), new T.MeshStandardMaterial({ color: 0xD4AF37, metalness: 1, roughness: 0.3 }), x, y + n * 0.005 + 0.004, z); void b; }
}
function lgFruit(add: any, bowlM: any, x: number, y: number, z: number) {
  const T = THREE, bowl = new T.Mesh(new T.LatheGeometry([[0.04, 0], [0.12, 0.02], [0.17, 0.08], [0.18, 0.09]].map(p => new T.Vector2(p[0], p[1])), 32), bowlM.clone()); bowl.material.side = T.DoubleSide; bowl.position.set(x, y, z);
  const g = add(new T.CylinderGeometry(0.0001, 0.0001, 0.0001, 3), bowlM, x, y, z); g.parent.add(bowl);
  const cols = [0xF28C28, 0xC0392B, 0x8BC34A, 0xF2D13A, 0xF28C28, 0xC0392B, 0x8BC34A]; cols.forEach((col, i) => { const a = i / cols.length * 6.283, rr = i < 5 ? 0.08 : 0.02; add(new T.SphereGeometry(0.038, 14, 10), new T.MeshStandardMaterial({ color: col, roughness: 0.4 }), x + Math.cos(a) * rr, y + 0.07 + (i >= 5 ? 0.05 : 0), z + Math.sin(a) * rr); });
}
function lgUrn(add: any, metal: any, dark: any, x: number, y: number, z: number, lv: number) {
  const T = THREE, prof = lv === 0 ? [[0.12, 0], [0.13, 0.05], [0.13, 0.4], [0.1, 0.45], [0.05, 0.47]] : [[0.1, 0], [0.12, 0.03], [0.08, 0.08], [0.16, 0.2], [0.17, 0.32], [0.12, 0.44], [0.07, 0.48], [0.08, 0.52], [0.03, 0.58]];
  const u = new T.Mesh(new T.LatheGeometry(prof.map(p => new T.Vector2(p[0], p[1])), 32), metal); u.position.set(x, y, z); u.castShadow = true;
  const g = add(new T.CylinderGeometry(0.0001, 0.0001, 0.0001, 3), metal, x, y, z); g.parent.add(u);
  const tap = add(new T.BoxGeometry(0.03, 0.03, 0.09), metal, x, y + 0.12, z - 0.17); void tap; add(new T.BoxGeometry(0.02, 0.05, 0.02), dark, x, y + 0.15, z - 0.21);
  if (lv) for (const s of [-1, 1]) add(new T.TorusGeometry(0.035, 0.008, 6, 14), metal, x + s * 0.18, y + 0.3, z).rotation.y = Math.PI / 2;
}
function lgTeapot(add: any, por: any, rim: any, x: number, y: number, z: number) {
  const T = THREE, b = new T.Mesh(new T.LatheGeometry([[0.05, 0], [0.09, 0.03], [0.1, 0.08], [0.08, 0.13], [0.04, 0.15], [0.015, 0.17]].map(p => new T.Vector2(p[0], p[1])), 28), por); b.position.set(x, y, z); b.castShadow = true;
  const g = add(new T.CylinderGeometry(0.0001, 0.0001, 0.0001, 3), por, x, y, z); g.parent.add(b);
  const sp = add(new T.CylinderGeometry(0.01, 0.02, 0.12, 10), por, x + 0.12, y + 0.09, z); sp.rotation.z = -0.9;
  add(new T.TorusGeometry(0.045, 0.01, 6, 14, Math.PI), por, x - 0.1, y + 0.08, z).rotation.z = Math.PI / 2;
  if (rim) add(new T.TorusGeometry(0.08, 0.003, 6, 28), rim, x, y + 0.13, z).rotation.x = Math.PI / 2;
}
/* ---------- guests ---------- */
/** Who is in the lounge: the business and first class passengers of your next departures from here (the next four
 *  hours), the same people (names, faces, clothes) as on those flights' passenger lists. The flight is given their
 *  seed, so when it leaves they are on board. */
function lgPassengers(): { name: string; look: any; cls: string; to: string; dep: number; callsign: string }[] {
  const R = LoungeRoom, now = Date.now(), out: any[] = [], S: any = State;
  const legs = ((S.aiNext || []) as any[]).filter(n => n && n.from === R.k && n.to && n.to !== n.from && n.depAt > now - 10 * 60e3 && n.depAt < now + 4 * 3600e3 && plane(n.reg))
    .sort((a, b) => a.depAt - b.depAt);
  for (const n of legs) {
    let ld: any = null; try { ld = aiPlannedLoad(n); } catch (e) { ld = null; }
    if (!ld || !(ld.paxF + ld.paxJ)) continue;
    if (!n.paxSeed) { n.paxSeed = 'lp-' + uid(); try { Store.soon(); } catch (e) { /* saved later */ } }
    const a = plane(n.reg), pseudo: any = { id: n.paxSeed, paxSeed: n.paxSeed, reg: n.reg, typeId: a.typeId, from: n.from, to: n.to, pax: ld.pax, paxJ: ld.paxJ, paxF: ld.paxF };
    let list: any[] = []; try { list = manifestOf(pseudo).filter((p: any) => p.cls !== 'Y'); } catch (e) { list = []; }
    for (const p of list) out.push({ name: p.name, look: p.look, cls: p.cls === 'F' ? 'First' : 'Business', to: n.to, from: n.from, reg: n.reg, dep: n.depAt, callsign: n.callsign || n.reg });
  }
  return out;
}
/** The places guests walk to when they are up: where they stand, which way they face, how long they stay. */
function lgSpots(): { k: string; x: number; z: number; ry: number; t: [number, number] }[] {
  const R = LoungeRoom, sp: LgSpec = R.spec, W = sp.W, D = sp.D, x0 = -W / 2, x1 = W / 2, z0 = -D / 2, z1 = D / 2, lv = R.lvl;
  const cx = x1 - 3.0, cz = z1 - 1.0, out: any[] = [
    { k: 'coffee', x: cx - 1.1, z: cz - 0.85, ry: 0, t: [8, 16] }, { k: 'tea', x: cx - 0.35, z: cz - 0.85, ry: 0, t: [8, 14] }, { k: 'snacks', x: cx + 1.0, z: cz - 0.85, ry: 0, t: [5, 10] },
    { k: 'fridge', x: x1 - 1.45, z: cz - 1.6, ry: Math.PI / 2, t: [6, 12] },
    { k: 'magazines', x: x0 + (lv >= 1 ? 0.62 : 1.2), z: z1 - 1.2, ry: 0, t: [8, 18] },
    { k: 'departures', x: -W * 0.05, z: z1 - 2.6, ry: 0, t: [10, 22] },
    { k: 'window', x: -W * 0.3, z: z0 + 0.9, ry: Math.PI, t: [15, 35] }, { k: 'window', x: W * 0.05, z: z0 + 0.9, ry: Math.PI, t: [15, 35] }, { k: 'window', x: W * 0.35, z: z0 + 0.9, ry: Math.PI, t: [15, 35] },
  ];
  if (lv >= 1) { const bxp = x0 + 3.2, bz = z1 - 1.2; out.push({ k: 'bar', x: bxp + 2.0, z: bz - 0.95, ry: -0.4, t: [12, 25] }, { k: 'fireplace', x: x0 + 1.9, z: z0 + D * 0.72, ry: -Math.PI / 2, t: [15, 30] }); }
  if (lv === 2) { out.push({ k: 'piano', x: W * 0.28 - 1.6, z: z0 + D * 0.2 + 0.4, ry: Math.PI / 2, t: [10, 20] }); }
  return out.filter(o => !lgBlocked(o.x, o.z));
}
function lgGuests() {
  const R = LoungeRoom, T = THREE, A = R.A, r = ctRng(7 + R.lvl * 31 + R.k.length), q = Gfx.placePeopleQ('lounge', R.q >= 2 ? 0.6 : 0.4);
  R.guests = []; R.spots = lgSpots();
  if (!Gfx.placePeople('lounge')) return;   // Settings → Graphics → Lounges: no guests (quicker)
  const pax = lgPassengers().slice(0, R.spec.guests * 2);
  if (!pax.length) setTimeout(() => { if (R.on) toast('No one waiting yet: none of your departures from here in the next 4 hours has business or first class passengers', 'info'); }, 6500);
  const free = () => (A.seats || []).filter((x: any) => !x.taken && x !== R.sit);
  pax.forEach((P, i) => {
    let m: any = null; try { m = Human.build(dressed(P.look, 'fa' as any), 'fa', '#2C8CFF', av3Style(), q); } catch (e) { m = null; } if (!m) return;
    try { modelsPeople(m, P.look); } catch (e) { /* the app's own figure */ }
    const pivot = new T.Group(), holder = new T.Group(); holder.add(m.root); pivot.add(holder); A.root.add(pivot);
    m.root.traverse((o: any) => { if (o.isMesh) { o.castShadow = R.q >= 1; o.receiveShadow = true; } });
    const G: any = { m, pivot, holder, P, seed: r() * 10, v: 0, dist: 0, sitK: 0, st: 'sit', timer: 0, heavy: r() < 0.05 };   // now and then one who drinks far too much (about one in twenty)
    // at the start most are sitting, the rest up and about
    const fs = free(), seat = r() < 0.72 && fs.length ? fs[Math.floor(r() * fs.length)] : null;
    if (seat) { lgTake(G, seat); G.sitK = 1; G.st = 'sit'; G.timer = 20 + r() * 120; const p = lgSeatPos(seat); G.x = p.x; G.z = p.z; G.yaw = seat.ry; }
    else { const s = R.spots[Math.floor(r() * R.spots.length)]; G.st = 'use'; G.spot = s; G.x = s ? s.x + (r() - 0.5) * 0.3 : 0; G.z = s ? s.z : 0; G.yaw = s ? s.ry : 0; G.timer = 5 + r() * 15; }
    R.guests.push(G);
  });
}
function lgSeatPos(st: any) { return { x: st.x - Math.sin(st.ry) * 0.04, z: st.z - Math.cos(st.ry) * 0.04 }; }
/** A guest takes a seat (no one else can have it, and it shows as taken when you look at it). */
function lgTake(G: any, st: any) { G.seat = st; st.taken = true; lgSeatHit(st); }
function lgFreeSeat(G: any) { if (G.seat) { G.seat.taken = false; lgSeatHit(G.seat); G.seat = null; } }
function lgSeatHit(st: any) { const R = LoungeRoom, i = (R.A.seats || []).indexOf(st); for (const h of R.A.hits || []) if (h.userData.seat === i) h.userData.act = st.taken ? 'taken' : 'sit'; }
/** Where to stand to sit down in a seat or get up from it: beside it, where there is room. */
function lgSeatSide(st: any) {
  const fx = Math.sin(st.ry), fz = Math.cos(st.ry);
  for (const [a, b] of [[0.85, 0], [0, 0.85], [0, -0.85], [-0.85, 0], [1.3, 0], [0, 1.3], [0, -1.3]]) { const x = st.x + fx * a + fz * b, z = st.z + fz * a - fx * b; if (!lgBlocked(x, z)) return { x, z }; }
  return { x: st.x + fx, z: st.z + fz };
}
/** What a guest does next when they have finished what they were doing. */
function lgNext(G: any) {
  const R = LoungeRoom, now = Date.now(), r = Math.random();
  if (G.P.dep - now < 25 * 60e3) { lgFreeSeat(G); G.st = 'go'; G.goal = { x: R.A.door.x, z: R.A.door.z }; G.then = 'leave'; return; }   // their flight is boarding
  if (G.st === 'sit') { const side = lgSeatSide(G.seat); G.st = 'stand'; G.timer = 0; G.side = side; return; }
  // a drink at the bar (Business and Flagship lounges): now and then, and often for some
  const barS = R.spots.filter((x: any) => x.k === 'bar')[0];
  if (barS && !G.drink && (G.heavy ? r < 0.55 : r < 0.12 && (G.bacK || 0) < 0.3) && !(R.guests || []).some((o: any) => o !== G && o.wantsDrink)) {
    G.st = 'go'; G.spot = barS; G.goal = { x: barS.x + (Math.random() - 0.5) * 0.3, z: barS.z }; G.then = 'use'; G.wantsDrink = true; G.ordered = false; return; }
  const fs = (R.A.seats || []).filter((x: any) => !x.taken && x !== R.sit);
  if ((G.st === 'use' && r < 0.7 && fs.length) || !R.spots.length) {   // somewhere to sit, the nearer the likelier
    const pick = fs.map((x: any) => ({ x, d: Math.hypot(x.x - G.x, x.z - G.z) + Math.random() * 6 })).sort((a: any, b: any) => a.d - b.d)[0];
    if (pick) { lgTake(G, pick.x); const sd = lgSeatSide(pick.x); G.st = 'go'; G.goal = sd; G.then = 'sitdown'; return; }
  }
  const s = R.spots[Math.floor(Math.random() * R.spots.length)];
  G.st = 'go'; G.spot = s; G.goal = { x: s.x + (Math.random() - 0.5) * 0.4, z: s.z + (Math.random() - 0.5) * 0.2 }; G.then = 'use';
}
/** One frame of a guest: sitting, getting up, walking round the furniture, standing at the coffee or the window. */
function lgGuestStep(G: any, now: number, dt: number) {
  const R = LoungeRoom;
  G.timer -= dt;
  if (G.st === 'led') G.timer = 99;   // being led out by Security (lgSecStep moves them)
  if (G.st === 'sit') { G.sitK = Math.min(1, G.sitK + dt * 1.6); if (G.timer <= 0) lgNext(G); }
  else if (G.st === 'stand') {   // getting up: out of the seat to its side
    G.sitK = Math.max(0, G.sitK - dt * 1.6); const p = lgSeatPos(G.seat || { x: G.x, z: G.z, ry: G.yaw });
    if (G.seat) { G.x = G.side.x + (p.x - G.side.x) * G.sitK; G.z = G.side.z + (p.z - G.side.z) * G.sitK; }
    if (G.sitK <= 0) { lgFreeSeat(G); G.st = 'up'; G.timer = 0; lgNext(G); }   // up: off to do something first
  } else if (G.st === 'sitdown') {   // into the seat
    const st = G.seat, p = lgSeatPos(st); G.sitK = Math.min(1, G.sitK + dt * 1.4);
    G.x = G.from.x + (p.x - G.from.x) * G.sitK; G.z = G.from.z + (p.z - G.from.z) * G.sitK; G.yaw += angDiffRad(G.yaw, st.ry) * Math.min(1, dt * 6);
    if (G.sitK >= 1) { G.st = 'sit'; G.timer = 40 + Math.random() * 120; }
  } else if (G.st === 'use') { if (G.spot) G.yaw += angDiffRad(G.yaw, G.spot.ry) * Math.min(1, dt * 4); try { lgGuestBar(G, dt); } catch (e) { G.wantsDrink = false; } if (G.timer <= 0) lgNext(G); }
  else if (G.st === 'go') {
    const dx = G.goal.x - G.x, dz = G.goal.z - G.z, d = Math.hypot(dx, dz);
    if (d < 0.12) {
      G.v = 0;
      if (G.then === 'leave') { R.A.root.remove(G.pivot); G.gone = true; if (G.seat) lgFreeSeat(G); return; }
      if (G.then === 'sitdown') { G.st = 'sitdown'; G.from = { x: G.x, z: G.z }; G.sitK = 0; return; }
      G.st = 'use'; G.timer = G.spot ? G.spot.t[0] + Math.random() * (G.spot.t[1] - G.spot.t[0]) : 8; return;
    }
    G.v += (Math.min(1.05, d * 1.5) - G.v) * Math.min(1, dt * 3);
    // walk straight there, turning aside round the furniture when the way is blocked
    const want = Math.atan2(dx, dz); let moved = false;
    for (const off of [0, 0.5, -0.5, 1.0, -1.0, 1.5, -1.5, 2.2, -2.2]) {
      const h = want + off * (G.side2 || 1), nx = G.x + Math.sin(h) * G.v * dt, nz = G.z + Math.cos(h) * G.v * dt;
      if (!lgBlockedG(nx, nz, G) || d < 0.6) { G.x = nx; G.z = nz; G.yaw += angDiffRad(G.yaw, h) * Math.min(1, dt * 7); moved = true; if (off) G.side2 = off > 0 ? 1 : -1; break; }
    }
    G.dist += G.v * dt;
    G.stuck = moved ? 0 : (G.stuck || 0) + dt;
    if (G.stuck > 3 || G.timer < -60) { G.stuck = 0; G.timer = 0; if (G.seat && G.then === 'sitdown') lgFreeSeat(G); G.st = 'use'; G.spot = null; lgNext(G); }
  }
  // place and pose them: sitting down lowers them into the seat
  const st = G.seat, hip = st ? st.hip : 0.55, k = G.sitK;
  G.pivot.position.set(G.x, (hip - 0.1) * k, G.z); G.pivot.rotation.y = G.yaw; G.holder.position.y = -(G.m.top || 1.75) * 0.52 * k;
  const t = now + G.seed; let g = humanGesture(null, t);
  if (G.v > 0.05) g = cabinLerpG(g, humanGesture({ kind: 'walk', v: Math.max(0.6, G.v), seed: G.P.name } as any, G.dist / 1.25), Math.min(1, G.v / 0.6));
  if (k > 0) g = cabinLerpG(g, humanGesture({ kind: 'sit', v: 0 }, t), k);
  // a guest who has been drinking sways and lurches a little
  const bk = G.bacK || 0; if (bk > 0.05) { g.roll = (g.roll || 0) + 0.07 * bk * Math.sin(t * 1.1); g.lean = (g.lean || 0) + 0.04 * bk * Math.sin(t * 0.7 + 1); g.nod = (g.nod || 0) + 0.08 * bk; }
  const arms = G.drink ? lgGuestArms(G, t) : null; if (arms) g.R = arms;
  try { G.m.pose({ t, yaw: 0, gaze: [Math.sin(t * 0.3) * 0.3, 0], blink: (t % 4.2) < 0.12 ? 1 : 0, g, talk: 0 }); } catch (e) { /* still */ }
  if (G.drink) lgGuestGlass(G, arms);
}
function angDiffRad(a: number, b: number): number { return Math.atan2(Math.sin(b - a), Math.cos(b - a)); }
/** Blocked for a guest: the furniture and walls, and the other people (not themselves). */
function lgBlockedG(x: number, z: number, G: any): boolean {
  if (lgBlocked(x, z)) return true;
  const R = LoungeRoom; for (const o of R.guests) if (o !== G && !o.gone && o.st !== 'sit' && Math.hypot(o.x - x, o.z - z) < 0.45 && Math.hypot(o.x - G.x, o.z - G.z) > Math.hypot(o.x - x, o.z - z)) return true;
  if (R.free && !R.sit && Math.hypot(R.free.x - x, R.free.z - z) < 0.5) return true;
  return false;
}
/** The passenger you are looking at (near the middle of the view, within 5 m): name, class and flight. */
function lgGuestAt(): any {
  const R = LoungeRoom, T = THREE, c = R.cam.position, f = new T.Vector3(); R.cam.getWorldDirection(f); let best: any = null, bd = 1e9;
  for (const G of R.guests || []) { if (G.gone) continue; const v = new T.Vector3(G.x - c.x, (G.sitK ? 1.0 : 1.5) - c.y, G.z - c.z), d = v.length(); if (d > 5 || d < 0.3) continue; const ang = v.normalize().angleTo(f); if (ang < 0.12 && d < bd) { bd = d; best = G; } }
  return best;
}

/* ---------- the loop ---------- */
function lgOpen2(root: HTMLElement, q: number) {
  const R = LoungeRoom, T = THREE, cv = root.querySelector('canvas') as HTMLCanvasElement, H = R.host; R.q = q;
  R.ac = new AbortController(); R.sig = R.ac.signal;   // the room's own controls, all let go of together when it closes
  const ren = H ? H.ren : new T.WebGLRenderer({ canvas: cv, antialias: q >= 1, powerPreference: 'high-performance' }); R.ren = ren;
  if (!H) { ren.setPixelRatio(Gfx.pr(Gfx.placeSharp('lounge', q))); ren.outputColorSpace = T.SRGBColorSpace; ren.toneMapping = T.ACESFilmicToneMapping; ren.toneMappingExposure = 1.0;
    ren.shadowMap.enabled = Gfx.placeShadow('lounge', q >= 2); ren.shadowMap.type = T.PCFSoftShadowMap; }
  const scene = H ? H.scene : new T.Scene(); R.scene = scene; if (!H) scene.background = new T.Color(0x0B121B);
  const cam = H ? H.cam('lounge') : new T.PerspectiveCamera(62, 1, 0.06, 200); R.cam = cam;
  const S = hgSun(R.k); if (!H) { R.hemi = new T.HemisphereLight(0xFFF4E6, 0x40362E, 0.55 + 0.35 * S.k); scene.add(R.hemi); }
  ctProgress(15, 'Laying the carpet…', R);
  setTimeout(() => {
    if (!R.on) return;
    if (!H) try { const pm = new T.PMREMGenerator(ren), env = new T.Scene(); env.add(new T.Mesh(new T.BoxGeometry(10, 5, 10), new T.MeshBasicMaterial({ color: 0x6A5E52, side: T.BackSide }))); const l = new T.Mesh(new T.PlaneGeometry(6, 1), new T.MeshBasicMaterial({ color: 0xFFFFFF })); l.position.set(0, 2.4, -4); env.add(l); scene.environment = pm.fromScene(env, 0.04).texture; pm.dispose(); } catch (e) { /* no reflections */ }
    ctProgress(35, 'Setting out the cups…', R);
    let A: any = null; try { A = H ? H.A('lounge') : lgBuild(scene, q); } catch (e) { console.error(e); }
    if (!A) { toast('The lounge could not be built on this device', 'warn'); LoungeRoom.close(); return; }
    R.A = A; R.glow = H ? H.glow('lounge') : new AimGlow(scene);
    if (!H) lgLights(scene, q);
    ctProgress(60, 'The guests are arriving…', R);
    if (!H || !A.guestsDone) { A.guestsDone = true; try { lgGuests(); } catch (e) { R.guests = []; } try { lgSeatHits(); lgSurfHits(); } catch (e) { /* no seats to click */ } A.guests = R.guests; }
    else R.guests = A.guests || [];
    const fit = () => { const w = root.clientWidth, h = root.clientHeight; ren.setSize(w, h, false); cam.aspect = w / Math.max(1, h); cam.updateProjectionMatrix(); };
    if (!H) { fit(); R.fit = fit; window.addEventListener('resize', fit); } else R.fit = null;
    { const sp0 = A.spawn || { x: A.door.x - 0.2, z: A.door.z - 0.6, yaw: 0.25 }; R.free = { x: sp0.x, z: sp0.z, v: 0, bob: 0 }; R.look = { yaw: sp0.yaw, pitch: -0.04 }; } R.sit = null; R.cups = A.cups || (A.cups = []);
    if (H && H.enterAt) { const e = H.enterAt; H.enterAt = null; R.free = { x: e.x, z: e.z, v: e.v || 0, bob: 0 }; R.look = { yaw: e.yaw, pitch: e.pitch || 0 }; }
    lgInput(root, cv);
    lgStart(root, ren, scene, cam);
  }, H ? 0 : 30);
}
/** Daylight through the windows and warm lamps inside (in the building, built with the lounge). */
function lgLights(scene: any, q: number) {
  const R = LoungeRoom, T = THREE, S = hgSun(R.k);
    const sp: LgSpec = R.spec, sunK = S.k;
    const win = new T.DirectionalLight(0xEAF2FF, 1.2 * sunK + 0.1); win.position.set(0, sp.H * 1.5, -sp.D * 1.5); win.target.position.set(0, 0, 0); if (q >= 2) { win.castShadow = true; win.shadow.mapSize.set(DESKTOP ? 2048 : 1024, DESKTOP ? 2048 : 1024); const c = win.shadow.camera; c.left = -sp.W / 2; c.right = sp.W / 2; c.top = sp.D; c.bottom = -sp.D; } scene.add(win); scene.add(win.target);
    const nL = DESKTOP ? 6 : q >= 2 ? 4 : 2;
    for (let i = 0; i < nL; i++) { const L = new T.PointLight(0xFFE6C4, (R.lvl === 2 ? 9 : 7) * 1.25 * (1.2 - 0.5 * sunK), 14, 1.6); L.position.set(-sp.W * 0.35 + (i % 3) * sp.W * 0.35, sp.H - 0.4, -sp.D * 0.2 + Math.floor(i / 3) * sp.D * 0.45); scene.add(L); }
}
/** The room comes alive: compiled, shown, drawn every frame (in the building, the building draws it). */
function lgStart(root: HTMLElement, ren: any, scene: any, cam: any) {
  const R = LoungeRoom, H = R.host;
    ctProgress(85, 'Opening the doors…', R);
    setTimeout(() => {
      if (!R.on) return;
      try { ren.compile(scene, cam); } catch (e) { /* first frame */ }
      R.loading = false; lgFrame(); ctProgress(100, 'Ready', R);
      const wait = Math.max(300, 5000 - (performance.now() - R.loadT0));   // at least 5 seconds, and until it is all here
      setTimeout(() => { const L = R.root && R.root.querySelector('.ct-loader') as HTMLElement; if (L) { L.classList.add('out'); setTimeout(() => L.remove(), 800); } lgUi(true); }, wait);
    }, 40);
    R.iv = 0;   // the flight boards update themselves (fidsStep)
    R.perf = Perf.state();
    if (H) return;   // the building draws it
    const loop = () => { if (!R.on) return; R.raf = requestAnimationFrame(loop); if (!R.loading && !Perf.skip(R.perf)) lgFrame(); };
    R.raf = requestAnimationFrame(loop);
}
function lgInput(root: HTMLElement, cv: HTMLCanvasElement) {
  const R = LoungeRoom; let drag: any = null, moved = 0, justLocked = false;
  cv.addEventListener('pointerdown', e => { if (DESKTOP && e.pointerType === 'mouse') { drag = null; if (!aimLocked(cv)) { justLocked = true; aimLock(cv); } return; } drag = { x: e.clientX, y: e.clientY, yaw: R.look.yaw, pitch: R.look.pitch }; moved = 0; try { cv.setPointerCapture(e.pointerId); } catch (x) { /* none */ } }, { signal: R.sig });
  R.mm$ = (e: MouseEvent) => { if (R.on && aimLocked(cv)) aimTurn(R.look, e, -1.2, 1.0); }; document.addEventListener('mousemove', R.mm$);
  cv.addEventListener('pointermove', e => { if (drag) { moved = Math.max(moved, Math.hypot(e.clientX - drag.x, e.clientY - drag.y)); R.look.yaw = drag.yaw - (e.clientX - drag.x) * 0.004; R.look.pitch = clamp(drag.pitch - (e.clientY - drag.y) * 0.003, -1.2, 1.0); } }, { signal: R.sig });
  cv.addEventListener('pointerup', e => { if (aimLocked(cv)) { if (justLocked) justLocked = false; else lgClickAt(); return; } justLocked = false; if (drag && moved < 6) lgClickAt(e); drag = null; }, { signal: R.sig });
  { const pad = root.querySelector('.op-pad') as HTMLElement, knob = pad && pad.firstElementChild as HTMLElement; let id = -1;
    if (pad) { const mv = (e: PointerEvent) => { const r = pad.getBoundingClientRect(), Rr = r.width / 2; let dx = (e.clientX - r.left - Rr) / Rr, dy = (e.clientY - r.top - Rr) / Rr; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } R.stick = [dx, -dy]; knob.style.transform = `translate(${dx * Rr * 0.55}px, ${dy * Rr * 0.55}px)`; };
      pad.addEventListener('pointerdown', e => { e.stopPropagation(); id = e.pointerId; pad.setPointerCapture(id); mv(e); }); pad.addEventListener('pointermove', e => { if (e.pointerId === id) mv(e); });
      const up = (e: PointerEvent) => { if (e.pointerId !== id) return; id = -1; R.stick = [0, 0]; knob.style.transform = ''; }; pad.addEventListener('pointerup', up); pad.addEventListener('pointercancel', up); } }
  root.addEventListener('click', ev => { const b = (ev.target as HTMLElement).closest('[data-op]') as HTMLElement; if (!b) return; ev.stopPropagation(); const k = b.getAttribute('data-op');
    if (k === 'leave') lgLeave(); else if (k === 'goto') lgGoto(b.getAttribute('data-k'));
    else if (k === 'coffee-pick') lgCoffeePick(b.getAttribute('data-k') || 'espresso'); else if (k === 'bar-pick') lgBarPick(b.getAttribute('data-k') || ''); else if (k === 'bar-close') lgBarClose(); else if (k === 'coffee-cancel') lgCoffeePick('');
    else if (k === 'vend-pick') { HG_VR = LoungeRoom; hgVendPick(b.getAttribute('data-k')); } else if (k === 'panel-close') { HG_VR = LoungeRoom; hgPanelClose(); } }, { signal: R.sig });
  R.key$ = (e: KeyboardEvent) => { if (!R.on) return; const k = e.key.toLowerCase();
    if (k === 'escape') { e.preventDefault(); e.stopImmediatePropagation(); if (aimLocked()) { aimUnlock(); return; } if (aimEscUsed()) return; lgLeave(); return; }
    if (/^arrow\w+$/.test(k) || /^(w|a|s|d|shift)$/.test(k)) { R.keys[k] = true; e.preventDefault(); e.stopImmediatePropagation(); } };
  R.ku$ = (e: KeyboardEvent) => { if (R.on) R.keys[e.key.toLowerCase()] = false; };
  window.addEventListener('keydown', R.key$, true); window.addEventListener('keyup', R.ku$, true);
}
function lgBlocked(x: number, z: number): boolean { const R = LoungeRoom, sp: LgSpec = R.spec, r = 0.25; if (R.host) { const d = R.host.pass('lounge', x, z); if (d) return d < 0; } if (x < -sp.W / 2 + 0.4 || x > sp.W / 2 - 0.4 || z < -sp.D / 2 + 0.45 || z > sp.D / 2 - 0.4) return true; for (const b of R.A.blocks) if (x > b[0] - r && x < b[2] + r && z > b[1] - r && z < b[3] + r) return true; return false; }
function lgFrame() {
  const R = LoungeRoom, T = THREE, now = performance.now() / 1000, dt = Math.min(0.05, now - (R.last || now)); R.last = now;
  const K = R.keys || {}, F = R.free;
  if (K.arrowleft) R.look.yaw += dt * 1.6; if (K.arrowright) R.look.yaw -= dt * 1.6;
  if (!R.meTried) { R.meTried = true; const mk = () => { try { if (!R.on || !R.scene) return; const me: any = myPilot(); R.me = selfBody(R.scene, me && me.look ? Object.assign({}, me.look, { hat: 'none' }) : ctLook('me', 'm', 'public'), company().color); } catch (e) { R.me = null; } }; if (Human.ready) mk(); else Human.load().then(mk, () => { /* without */ }); }
  const f = (K.w || K.arrowup ? 1 : 0) - (K.s || K.arrowdown ? 1 : 0) + R.stick[1], rr = (K.d ? 1 : 0) - (K.a ? 1 : 0) + R.stick[0];
  if (R.sit && Math.hypot(f, rr) > 0.3) lgStand();   // walking gets you up
  if (R.sit) { lgSeated(now, dt); return; }
  const mag = R.press ? 0 : Math.min(1, Math.hypot(f, rr)), vmax = (K.shift ? 2.4 : 1.2) * (1 - 0.25 * lgDrunkK()); F.v += ((mag > 0.05 ? vmax * mag : 0) - F.v) * Math.min(1, dt * 6);
  try { lgPressStep(dt); } catch (e) { R.press = null; }
  const yaw = R.look.yaw, fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const drift = mag > 0.05 ? lgDrunkK() * (0.45 * Math.sin(now * 1.1) + 0.2 * Math.sin(now * 2.7)) : 0;   // drunk: hard to walk straight
  let mx = fx * f + rx * (rr + drift), mz = fz * f + rz * (rr + drift); const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml; if (R.host && R.host.assist && ml > 0.05) { const g2 = R.host.assist('lounge', F.x, F.z, mx, mz); mx = g2[0]; mz = g2[1]; }   // eased through an open doorway
  const step = F.v * dt;
  if (step > 0) { const nx = F.x + mx * step, nz = F.z + mz * step; if (!lgBlocked(nx, nz)) { F.x = nx; F.z = nz; } else if (!lgBlocked(nx, F.z)) F.x = nx; else if (!lgBlocked(F.x, nz)) F.z = nz; F.bob += step; }
  if (R.host && R.host.out('lounge', F.x, F.z, R.look, F.v)) return;   // out through the doors: the concourse takes over
  try { Sound.steps(F, F.bob, 'carpet', F.v); } catch (e) { /* quiet */ }
  const bobY = Math.sin(F.bob / 0.65 * Math.PI) * 0.016 * Math.min(1, F.v / 1.1);
  R.cam.position.set(F.x, 1.64 + bobY, F.z);
  if (R.me) { try { const S = R.me, yb = yaw + Math.PI, o = selfEyeOff(S, yb, 0); S.pitch = R.look.pitch; const eye = selfPose(S, new T.Vector3(F.x - o.x, S.hipY, F.z - o.z), yb, 0, 0, F.v, F.bob, now, dt, R.press ? (m: any) => lgPressArms(m, now) : undefined); R.cam.position.set(eye.x, eye.y + bobY, eye.z); } catch (e) { R.me = null; } }
  const p = R.look.pitch; R.cam.lookAt(R.cam.position.clone().add(new T.Vector3(fx * Math.cos(p), Math.sin(p), fz * Math.cos(p))));
  lgFrameRest(now, dt);
}
/** Everything that goes on in the room each frame, standing or sitting: the guests, the fire, steam, what you look at. */
/** The sliding doors: towards open (1) or shut (0); they move in lgFrameRest. */
function lgDoorsTo(k: number) { const A = LoungeRoom.A; if (!A || !A.doorLeaves) return; if (A.doorTo !== k) { try { sfxDoor('sliding', k > 0); } catch (e) { /* quiet */ } } A.doorTo = k; }
function lgFrameRest(now: number, dt: number) {
  const R = LoungeRoom;
  try { lgBarStep(dt, now); } catch (e) { /* the bar rests */ }
  try { fidsStep(R.A && R.A.fids); } catch (e) { /* the boards wait */ }
  try { lgSecStep(dt, now); } catch (e) { R.sec = null; }
  try { lgDrunkStep(dt); lgDrunkCam(R, dt, now, !!(R.free && R.free.v > 0.2 && !R.sit)); } catch (e) { /* clear-headed */ }
  if (R.A && R.A.doorLeaves && R.A.doorK !== R.A.doorTo) { const A = R.A; A.doorK += Math.sign(A.doorTo - A.doorK) * Math.min(Math.abs(A.doorTo - A.doorK), dt * 1.6); const e = A.doorK * A.doorK * (3 - 2 * A.doorK); for (const L of A.doorLeaves) L.position.x = L.userData.x0 + (L.userData.x1 - L.userData.x0) * e; }
  // guests: sitting back, talking now and then, sipping; the fire flickers; steam rises from fresh cups
  for (const G of R.guests || []) if (!G.gone && !(R.inc && R.inc.G === G)) lgGuestStep(G, now, dt);
  try { secIncStep(dt, now); } catch (e) { try { secEnd(R.inc); } catch (e2) { R.inc = null; } }
  if (R.guests && R.guests.some((G: any) => G.gone)) R.guests = R.guests.filter((G: any) => !G.gone);
  for (const fl of R.A.flames) { fl.scale.y = 0.85 + 0.25 * Math.abs(Math.sin(now * 7.3) * Math.sin(now * 3.1)); fl.material.opacity = 0.8 + 0.2 * Math.sin(now * 11); }
  if (R.A.fireL) R.A.fireL.intensity = 1.4 + 0.5 * Math.sin(now * 9) * Math.sin(now * 4.7);
  for (let i = R.A.steam.length - 1; i >= 0; i--) { const s = R.A.steam[i]; s.t += dt; s.m.position.y += dt * 0.07; s.m.position.x += Math.sin(now * 1.7 + i) * dt * 0.01; s.m.material.opacity = Math.max(0, 0.32 * Math.min(1, s.t * 4) * (1 - s.t / 2.2)); s.m.scale.setScalar(0.03 + s.t * 0.05); if (s.t > 2.2) { R.A.root.remove(s.m); s.m.material.dispose(); R.A.steam.splice(i, 1); } }
  for (let i = (R.drops || []).length - 1; i >= 0; i--) { const D = R.drops[i]; D.v.y -= 9.81 * dt; D.m.position.addScaledVector(D.v, dt); if (D.m.position.y <= D.floor) { D.m.position.y = D.floor + 0.002; D.m.scale.set(2.2, 0.15, 2.2); R.drops.splice(i, 1); D.land = now; R.spots = R.spots || []; R.spots.push(D); } }
  // spills dry up: after a while they fade away (every kind of drink), never vanish at once
  for (let i = (R.spots || []).length - 1; i >= 0; i--) { const D = R.spots[i], age = now - D.land, FADE = 4;
    if (age > 20 - FADE) { const m = D.m.material; if (!D.faded) { D.faded = true; D.m.material = m.clone(); D.m.material.transparent = true; D.op0 = m.opacity == null ? 1 : m.opacity; }
      const k = clamp((20 - age) / FADE, 0, 1); D.m.material.opacity = D.op0 * k * k; D.m.scale.set(2.2 * (0.85 + 0.15 * k), 0.15, 2.2 * (0.85 + 0.15 * k)); }
    if (age > 20) { R.A.root.remove(D.m); try { if (D.faded) D.m.material.dispose(); } catch (e) { /* gone */ } R.spots.splice(i, 1); } }
  try { lgCupsStep(dt, now); } catch (e) { /* no cups */ }
  if (R.A.vend) { try { HG_VR = LoungeRoom; hgVendStep(dt); } catch (e) { /* the machine rests */ } }
  // what you look at glows
  const obj = lgAimedObj(), hint = obj ? obj.userData.act : '', dot = R.root.querySelector('.op-dot') as HTMLElement;
  const mine = obj && obj.userData.seat != null && R.A.seats[obj.userData.seat] === R.sit;   // the seat you're in doesn't glow
  if (R.glow) { if (obj && !mine) R.glow.showObj(obj); else R.glow.hide(); R.glow.step(dt); }
  if (dot) { const seat = obj && obj.userData.seat != null ? R.A.seats[obj.userData.seat] : null;
    const held0 = lgHeldCup(), tx = hint === 'bartender' ? 'Click to order a drink at the bar' : hint === 'cup' ? (held0 ? 'You already have something in your hand' : 'Click to pick it up') : hint === 'surface' ? 'Click to put it down here' : held0 && !hint ? (held0.snack && hgProd(held0.snack).type === 'bar' ? 'Click to take a bite · aim at a table or a counter to put it down' : 'Click to sip · aim at a table or a counter to put it down') : hint === 'door' ? 'The door: click to leave the lounge' : hint === 'coffee' ? 'Click for a coffee or a tea' : hint === 'vend' ? (R.vend && R.vend.st === 'ready' ? 'Open the flap at the bottom to take it' : 'Click to choose a snack or a drink') : hint === 'flap' ? (R.vend && R.vend.st === 'ready' ? 'Click to take it' : 'The tray') : hint === 'sit' && seat !== R.sit ? `${LG_SEAT_NAME[seat.kind] || 'A seat'}: click to sit down` : hint === 'taken' ? 'Someone is sitting there' : (() => { const G = lgGuestAt(); return G ? `${G.P.name} · ${G.P.cls} to ${(apt(G.P.to) || {} as any).city || G.P.to}, ${new Date(G.P.dep).toTimeString().slice(0, 5)}` : ''; })() || (R.sit ? (DESKTOP ? 'Sitting · W A S D or click to stand up' : 'Sitting · the stick or a tap to stand up') : ''); dot.hidden = !tx && !aimLocked(); dot.textContent = tx || '·'; dot.classList.toggle('on', !!tx); }
  // frame generation: the cup, glass or snack in your hand moves with your view, not with the room
  if (R.perf) { const held = lgHeldCup(); R.perf.anchor = held && held.g ? R.cam : null; R.perf.anchorDraw = held && held.g ? [held.g] : null; }
  try { lgMirrorsStep(R); } catch (e) { /* no mirror */ }
  FrameGen.draw(R.perf, R.ren, R.scene, R.cam); Perf.frame(R.perf, R.ren);
  try { lgDrunkScreen(R, lgDrunkK(), now); } catch (e) { /* clear */ }   // straight after drawing: a copy of this picture
}
/** A frame while you are sitting: your body in the seat, the view from your eyes, the room carrying on around you. */
function lgSeated(now: number, dt: number) {
  const R = LoungeRoom, T = THREE, st = R.sit; R.sitK = Math.min(1, (R.sitK || 0) + dt * 2.2);
  const face = st.ry + Math.PI, yaw = R.look.yaw, p = R.look.pitch, fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  let eye = new T.Vector3(st.x - Math.sin(st.ry) * 0.05, st.hip + 0.68, st.z - Math.cos(st.ry) * 0.05);
  if (R.me) { try { const S = R.me; S.pitch = p; const turn = Math.atan2(Math.sin(yaw - face), Math.cos(yaw - face));
    eye = selfPose(S, new T.Vector3(st.x - Math.sin(st.ry) * 0.04, st.hip, st.z - Math.cos(st.ry) * 0.04), st.ry + clamp(turn, -0.6, 0.6) * 0.4, 0, R.sitK, 0, 0, now, dt); } catch (e) { R.me = null; } }
  R.cam.position.copy(eye); R.cam.lookAt(R.cam.position.clone().add(new T.Vector3(fx * Math.cos(p), Math.sin(p), fz * Math.cos(p))));
  lgFrameRest(now, dt);
}
function lgAimedObj(e?: PointerEvent): any {
  const R = LoungeRoom, T = THREE, rc = new T.Raycaster();
  if (e && !aimLocked()) { const r = (R.root.querySelector('canvas') as HTMLElement).getBoundingClientRect(); rc.setFromCamera(new T.Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), R.cam); }
  else rc.setFromCamera(new T.Vector2(0, 0), R.cam);
  const hs = R.A ? rc.intersectObjects(R.A.hits, false).filter((x: any) => x.object.userData.act !== 'surface' || lgHeldCup()) : [], h = hs.filter((x: any) => x.object.userData.act === 'cup' && x.distance < 3.2)[0] || hs[0] || null; R.aimPoint = h ? h.point : null; return h && h.distance < 3.2 ? h.object : null;
}
function lgClickAt(e?: PointerEvent) {
  const R = LoungeRoom; if (R.loading) return; const o = lgAimedObj(e), a = o ? o.userData.act : '';
  if (a === 'door' && R.host) { if (R.sit) lgStand(); lgDoorsTo(R.A.doorTo ? 0 : 1); Sound.tick(); return; }   // in the building: the doors open and shut
  if (a === 'door') { if (R.sit) lgStand(); lgDoorsTo(1); setTimeout(() => { if (R.on) roomExitMenu(R.root, 'lounges', to => lgLeave(to), () => lgDoorsTo(0)); }, 450); return; }
  if (a === 'coffee') { if (R.sit) lgStand(); lgPour(); return; }
  if (a === 'vend' || a === 'flap') { HG_VR = LoungeRoom; if (R.sit) lgStand(); if (R.vend && R.vend.st === 'ready') hgTake(); else if (a === 'vend') hgVendOpen(); return; }
  if (a === 'bartender') { if (R.sit) lgStand(); lgBarMenu(); return; }
  if (a === 'cup') { lgPickCup(o); return; }
  if (a === 'surface' && lgHeldCup()) { lgPutCup(o, R.aimPoint || o.position); return; }
  if (lgHeldCup()) { lgSip(); return; }   // holding a cup: a click anywhere else is a sip
  if (a === 'sit' && o.userData.seat != null && R.A.seats[o.userData.seat] !== R.sit) { lgSit(o.userData.seat); return; }
  if (a === 'taken') { toast('Someone is sitting there', 'info'); return; }
  if (R.sit) lgStand();   // sitting: a click anywhere else stands you up
}
/** A fresh cup: the machine hums, a cup on its saucer appears under the spout, steaming. */
/** Every chair, sofa place and bar stool can be clicked: a free one to sit down in it. */
function lgSeatHits() {
  const R = LoungeRoom, T = THREE, A = R.A, m = new T.MeshBasicMaterial({ visible: false });
  (A.seats || []).forEach((st: any, i: number) => {
    const w = st.kind === 'stool' ? 0.5 : 0.75, h = new T.Mesh(new T.BoxGeometry(w, st.hip + 0.35, w), m);
    h.position.set(st.x, (st.hip + 0.35) / 2, st.z); h.userData.act = st.taken ? 'taken' : 'sit'; h.userData.seat = i; A.root.add(h); A.hits.push(h);
  });
}
const LG_SEAT_NAME: { [k: string]: string } = { armchair: 'An armchair', sofa: 'The sofa', stool: 'A bar stool' };
/** Sit down: the view settles into the seat, facing the way it faces; look around freely. */
function lgSit(i: number) {
  const R = LoungeRoom, st = R.A && R.A.seats[i]; if (!st || st.taken) return;
  Sound.tick(); aimUnlock(); R.sit = st; R.sitK = 0; R.free.v = 0; R.look = { yaw: st.ry + Math.PI, pitch: st.kind === 'stool' ? -0.05 : -0.12 };
}
/** Stand up again, beside the seat (wherever there is room). */
function lgStand() {
  const R = LoungeRoom, st = R.sit; if (!st) return; R.sit = null; Sound.tick();
  const fx = Math.sin(st.ry), fz = Math.cos(st.ry);
  for (const [a, b] of [[0.85, 0], [0, 0.85], [0, -0.85], [-0.85, 0], [1.3, 0], [0, 1.3], [0, -1.3]]) {   // in front, either side, behind
    const x = st.x + fx * a + fz * b, z = st.z + fz * a - fx * b; if (!lgBlocked(x, z)) { R.free.x = x; R.free.z = z; return; }
  }
}
/** The drinks the machine makes: name, colour, the cup it goes in, how long it pours, a foam top. */
const LG_DRINKS: { [k: string]: { name: string; col: number; top?: number; tea?: boolean; small?: boolean; pour: number } } = {
  espresso: { name: 'Espresso', col: 0x2E170A, top: 0x8A5A32, small: true, pour: 3.2 },
  cappuccino: { name: 'Cappuccino', col: 0x6E4128, top: 0xEADBC2, pour: 5.2 },
  latte: { name: 'Latte', col: 0xB98A5E, top: 0xF1E6D3, tea: true, pour: 5.6 },
  americano: { name: 'Americano', col: 0x24130A, pour: 4.8 },
  chocolate: { name: 'Hot chocolate', col: 0x4E2A18, top: 0x6A3A22, tea: true, pour: 5.4 },
  tea: { name: 'Tea', col: 0x8A4A16, tea: true, pour: 4.4 },
};
/** Order a drink: your hand goes to the machine's touchscreen and stays there while you choose; one cup at a time. */
function lgPour() {
  const R = LoungeRoom, A = R.A; if (!A || !A.coffeeAt || R.press) return;
  R.cups = R.cups || [];
  const waiting = R.cups.filter((c: any) => c.st === 'ready' || c.st === 'pour')[0], held = lgHeldCup();
  if (waiting) { toast('Your cup is waiting at the machine: pick it up first', 'info'); return; }
  if (held) { toast('Finish what you have or put it down first', 'info'); return; }
  aimUnlock(); Sound.tick(); R.press = { st: 'reach', t: 0, a: null, k: 0 };
}
/** The press: reaching (about half a second), holding while the menu is open, then back to how your arms were. */
function lgPressStep(dt: number) {
  const R = LoungeRoom, P = R.press; if (!P) return; P.t += dt;
  const E = (x: number) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  if (P.st === 'reach') { P.k = E(P.t / 0.5); if (P.t >= 0.5) { P.st = 'hold'; P.t = 0; try { if (!Sfx.play('coffee-touch')) Sound.tick(); } catch (e) { /* quiet */ } lgCoffeeMenu(); } }
  else if (P.st === 'hold') P.k = 1;
  else if (P.st === 'back') { P.k = 1 - E(P.t / 0.5); if (P.t >= 0.5) { R.press = null; if (P.pick) lgCoffeePour(P.pick); } }
}
/** The menu on screen while your finger is on the machine's touchscreen. */
function lgCoffeeMenu() {
  const R = LoungeRoom, el = R.root.querySelector('.hg-panel') as HTMLElement; if (!el) return;
  el.hidden = false;
  el.innerHTML = `<div class="hg-vend"><div class="hg-vend-h"><b>Choose your drink</b><small>Freshly made, served hot.</small><button data-op="coffee-cancel" aria-label="Close">${icon('close')}</button></div>
    <div class="hg-vend-g">${Object.keys(LG_DRINKS).map(k => { const d = LG_DRINKS[k], c = '#' + d.col.toString(16).padStart(6, '0'), t = '#' + (d.top || d.col).toString(16).padStart(6, '0'); return `<button data-op="coffee-pick" data-k="${k}"><i style="--c1:${t};--c2:${c}" class="hg-ic can"></i><span>${esc(d.name)}</span></button>`; }).join('')}</div></div>`;
}
/** A drink chosen (or none): the finger comes off the screen and your arm goes back; then it pours. */
function lgCoffeePick(k: string) {
  const R = LoungeRoom, el = R.root.querySelector('.hg-panel') as HTMLElement; if (el) { el.hidden = true; el.innerHTML = ''; }
  const P = R.press; if (!P) return; Sound.tick();
  P.pick = k && LG_DRINKS[k] ? k : ''; P.st = 'back'; P.t = 0;
}
/** Your right arm while ordering: from where it was, out to the touchscreen, a fingertip on it, and back. */
function lgPressArms(m: any, now: number): any {
  const R = LoungeRoom, T = THREE, P = R.press, A = R.A; if (!P || !A || !A.coffeeScreen || P.k < 0.002) { if (P) P.a = null; return null; }
  const rest = humanGesture(null, now), J = m.joints.R; m.root.updateMatrixWorld(true);
  const scr = A.root.localToWorld(A.coffeeScreen.clone()), from = m.root.localToWorld(humanHandAt(m, 'R', rest.R, undefined, J.palm));
  const to = from.lerp(scr, P.k);
  P.a = humanReach(m, 'R', m.root.worldToLocal(to), P.a || rest.R, J.palm);
  return { R: P.a };
}
/** The cup under the spout, the drink running into it and the cup filling; hot drinks steam. */
function lgCoffeePour(k: string) {
  const R = LoungeRoom, A = R.A, T = THREE, d = LG_DRINKS[k]; if (!A || !d) return;
  try { if (!Sfx.play('coffee-grind')) hgSnd('motor'); } catch (e) { /* quiet */ }
  const p = A.coffeeAt, c: any = { st: 'pour', kind: k, tea: !!d.tea, sips: 0, lvl: 0, full: 0.8, hotUntil: Date.now() + 5 * 60e3 };
  c.g = lgCupGroup(k); c.g.position.set(p.x, p.y, p.z); A.root.add(c.g); lgLiquid(c);
  R.cups = R.cups || []; R.cups.push(c);
  // the stream: from the spouts down into the cup, the drink's colour, wavering a little
  const sp = A.coffeeSpout || new T.Vector3(p.x, p.y + 0.2, p.z), top = sp.y, bot = p.y + 0.02;
  const st = new T.Mesh(new T.CylinderGeometry(0.0032, 0.0026, 1, 8, 1, true), new T.MeshStandardMaterial({ color: d.col, roughness: 0.15, transparent: true, opacity: 0.92 }));
  st.position.set(p.x, (top + bot) / 2, p.z); st.scale.y = top - bot; A.root.add(st);
  c.stream = { m: st, t: 0, dur: d.pour, top, bot };
  const milk = !!d.top && k !== 'espresso' && k !== 'chocolate', water = k === 'tea' || k === 'americano';
  setTimeout(() => { if (!LoungeRoom.on) return; try { if (!Sfx.play(milk ? 'coffee-milk' : water ? 'coffee-water' : 'coffee-pour')) Sound.pour(d.pour * 0.92, milk); } catch (e) { /* quiet */ } }, d.pour * 80);
}
/** A cup on its saucer as one group (to carry and put down), with its hit box, the heat shimmer above it, and the
 *  drink in it: a surface that rises as it fills, falls as you drink, and tilts as it sloshes. */
function lgCupGroup(k: any): any {
  const R = LoungeRoom, T = THREE, g = new T.Group(), d = LG_DRINKS[typeof k === 'string' ? k : k ? 'tea' : 'espresso'] || LG_DRINKS.espresso;
  const add = (geo: any, m: any, x: number, y: number, z: number) => { const o = new T.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
  lgCup(add, new T.MeshStandardMaterial({ color: 0xF7F5F0, roughness: 0.2 }), R.lvl === 2 ? new T.MeshStandardMaterial({ color: 0xD4AF37, metalness: 1, roughness: 0.25 }) : null, 0, 0, 0, !!d.tea, 0);
  // the inside of the cup, as lgCup makes it: radius at a height above the saucer
  const prof = d.tea ? [[0.03, 0], [0.04, 0.005], [0.05, 0.03], [0.055, 0.055]] : [[0.025, 0], [0.035, 0.006], [0.04, 0.04], [0.04, 0.075]];
  const liq = new T.Mesh(new T.CircleGeometry(1, 28), new T.MeshStandardMaterial({ color: d.col, roughness: 0.12 })); liq.rotation.x = -Math.PI / 2; liq.visible = false;
  const lg = new T.Group(); lg.add(liq); g.add(lg);
  let foam: any = null; if (d.top) { foam = new T.Mesh(new T.RingGeometry(0.0, 1, 28), new T.MeshStandardMaterial({ color: d.top, roughness: 0.8, transparent: true, opacity: 0.9 })); foam.rotation.x = -Math.PI / 2; foam.position.y = 0.0008; foam.scale.setScalar(0.82); lg.add(foam); }
  g.userData.liq = { lg, liq, foam, prof, h: prof[prof.length - 1][1], base: 0.012 };
  const hit = new T.Mesh(new T.BoxGeometry(0.2, 0.16, 0.2), new T.MeshBasicMaterial({ visible: false })); hit.position.y = 0.07; hit.userData.act = 'cup'; g.add(hit); R.A.hits.push(hit); g.userData.hit = hit;
  // the heat rising from a hot drink: a little of the shimmer behind the engines, bending what is behind it
  const hz = new T.Group(); for (const r of [0, Math.PI / 2]) { const q = new T.Mesh(new T.PlaneGeometry(0.075, 0.17), lgHeatMat()); q.rotation.y = r; q.position.y = 0.17; hz.add(q); }
  g.add(hz); g.userData.heat = hz;
  return g;
}
/** The drink's surface for how full the cup is (and the slosh: c.sl, a tilt in the room's x and z). */
function lgLiquid(c: any) {
  const L = c.g && c.g.userData.liq; if (!L) return;
  const T = THREE, y = c.lvl * L.h, P = L.prof; let r = P[0][0];
  for (let i = 1; i < P.length; i++) if (y <= P[i][1]) { const a = P[i - 1], b = P[i], t = (y - a[1]) / Math.max(1e-4, b[1] - a[1]); r = a[0] + (b[0] - a[0]) * t; break; } else r = P[i][0];
  L.liq.visible = c.lvl > 0.012; if (L.foam) L.foam.visible = c.lvl > 0.25;
  L.lg.position.set(0, L.base + y, 0); L.liq.scale.setScalar(Math.max(0.001, r - 0.0015)); if (L.foam) L.foam.scale.setScalar(Math.max(0.001, r - 0.0015) * 0.86);
  // level in the room whatever the cup does, tilted by the slosh
  c.g.updateMatrixWorld(true);
  const qc = c.g.getWorldQuaternion(new T.Quaternion()).invert(), sl = c.sl || [0, 0];
  const qs = new T.Quaternion().setFromEuler(new T.Euler(sl[1], 0, -sl[0]));
  const qp = (LoungeRoom.A && LoungeRoom.A.root) ? LoungeRoom.A.root.getWorldQuaternion(new T.Quaternion()) : new T.Quaternion();
  L.lg.quaternion.copy(qc).multiply(qp).multiply(qs);
  if (L.vol) lgGlassVolume(L, c.lvl);   // a glass: the drink seen through it, not only its surface
}
/** The drink moving in the cup as you carry it: the surface swings against how the cup is moved, settles again, and
 *  if you swing it hard enough it goes over the rim: a little less in the cup, and drops on the floor. */
function lgSlosh(c: any, dt: number) {
  const R = LoungeRoom, T = THREE, w = c.g.getWorldPosition(new T.Vector3());
  if (!c.pv) { c.pv = w.clone(); c.vv = new T.Vector3(); c.sl = [0, 0]; c.sv = [0, 0]; return; }
  const v = w.clone().sub(c.pv).divideScalar(dt), a0 = v.clone().sub(c.vv).divideScalar(dt); c.pv.copy(w); c.vv.copy(v);
  c.as = c.as || new T.Vector3(); c.as.lerp(a0, Math.min(1, dt * 10)); const a = c.as;   // smoothed: a hand, not single jolts
  const K = 150, C = 5.5, ax = clamp(a.x, -60, 60), az = clamp(a.z, -60, 60);   // a steady push tilts the surface by about a / g (half that: the cup's own walls)
  for (const [i, ai] of [[0, ax], [1, az]] as number[][]) { c.sv[i] += (-K * c.sl[i] - C * c.sv[i] - ai * K / 9.81 * 0.28) * dt; c.sl[i] = clamp(c.sl[i] + c.sv[i] * dt, -0.7, 0.7); }
  // over the rim?
  const L = c.g.userData.liq, rim = L.h, y = c.lvl * L.h, r = L.prof[L.prof.length - 1][0], lift = Math.hypot(c.sl[0], c.sl[1]) * r;
  if (c.lvl > 0.02 && y + lift > rim) {
    const out = Math.min(c.lvl, (y + lift - rim) / L.h * dt * 5); c.lvl -= out;
    if (!c.spilt) { c.spilt = true; toast('Careful, you spilt some', 'info'); }
    c.dropT = (c.dropT || 0) - dt;
    if (c.dropT <= 0) { c.dropT = 0.05; R.drops = R.drops || [];
      const m = new T.Mesh(new T.SphereGeometry(0.006, 6, 4), new T.MeshStandardMaterial({ color: c.spirit && lgSpirit(c.spirit) ? lgSpirit(c.spirit).col : (LG_DRINKS[c.kind] || LG_DRINKS.espresso).col, roughness: 0.1, transparent: !!c.spirit, opacity: c.spirit ? Math.max(0.5, lgSpirit(c.spirit).op) : 1 }));
      const at = R.A.root.worldToLocal(w.clone().add(new T.Vector3(0, L.h, 0))); m.position.copy(at); R.A.root.add(m);
      const dir = new T.Vector3(c.sl[0], 0, c.sl[1]).normalize();
      R.drops.push({ m, v: R.A.root.worldToLocal(w.clone().add(dir.multiplyScalar(0.4).add(new T.Vector3(0, 0.3, 0)))).sub(R.A.root.worldToLocal(w.clone())), floor: 0.003 }); }
  }
}
/** A wisp of steam: a soft round sprite, made once. */
let _lgSteamTex: any = null;
function lgSteamPuff(): any {
  const T = THREE;
  if (!_lgSteamTex) { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d') as CanvasRenderingContext2D, gr = x.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); _lgSteamTex = new T.CanvasTexture(cv); }
  const s = new T.Sprite(new T.SpriteMaterial({ map: _lgSteamTex, transparent: true, opacity: 0, depthWrite: false })); s.scale.setScalar(0.03); return s;
}
let _lgHeat: any = null;
function lgHeatMat(): any {
  if (_lgHeat) return _lgHeat;
  const T = THREE; _lgHeat = v3dHazeMat().clone(); _lgHeat.normalMap = v3dHazeMat().normalMap.clone(); _lgHeat.normalMap.needsUpdate = true; _lgHeat.normalMap.repeat.set(1, 1.6);
  _lgHeat.normalScale = new T.Vector2(0.22, 0.22); _lgHeat.thickness = 0.05; return _lgHeat;
}
/** Every table, the refreshment counter and the bar: places to put a cup down (they only glow while you hold one). */
function lgSurfHits() {
  const R = LoungeRoom, T = THREE, A = R.A, m = new T.MeshBasicMaterial({ visible: false });
  for (const s of A.surf || []) { const h = new T.Mesh(s.r ? new T.CylinderGeometry(s.r, s.r, 0.04, 16) : new T.BoxGeometry(s.w, 0.04, s.d), m); h.position.set(s.x, s.top + 0.01, s.z); h.userData.act = 'surface'; h.userData.top = s.top; A.root.add(h); A.hits.push(h); }
}
function lgHeldCup(): any { const R = LoungeRoom; return (R.cups || []).filter((c: any) => c.st === 'held')[0] || null; }
/** Pick up a cup (from the counter, or where you put it down). */
function lgPickCup(o: any) {
  const R = LoungeRoom; if (lgHeldCup()) { toast('You already have a cup in your hand', 'info'); return; }
  const c = (R.cups || []).filter((x: any) => x.g && x.g.userData.hit === o)[0]; if (!c) return;
  Sound.tick(); c.st = 'held'; c.w = 0; c.from = c.g.position.clone(); c.g.userData.hit.visible = false; R.A.hits = R.A.hits.filter((h: any) => h !== o);
}
/** Put the cup down where you are aiming, on a table or a counter. */
function lgPutCup(hit: any, point: any) {
  const R = LoungeRoom, c = lgHeldCup(); if (!c) return;
  try { if (!Sfx.play(c.snack ? 'put-down' : 'cup-down')) hgSnd('put'); } catch (e) { Sound.tick(); } c.st = 'placed'; c.g.position.set(point.x, hit.userData.top, point.z); c.g.rotation.set(0, Math.random() * 6.28, 0); c.use = null;
  R.A.hits.push(c.g.userData.hit);
}
/** A sip: the cup comes up to your mouth and back down. Three sips and it is finished (a snack: its own bites). */
function lgSip() {
  const R = LoungeRoom, c = lgHeldCup(); if (!c || c.use) return;
  const bite = c.snack && hgProd(c.snack).type === 'bar';
  c.use = { t: 0 }; setTimeout(() => { if (R.on) try { hgSnd(bite ? 'bite' : 'sip'); } catch (e) { /* quiet */ } }, 450);
}
/** What you took from the vending machine: in your hand, used like a cup (a bite or a sip each click). */
function lgTakeSnack(it: any, from: any) {
  const R = LoungeRoom, T = THREE, g = new T.Group(), mesh = hgItemMesh(it.kind, 0, it.n); g.add(mesh);
  const hit = new T.Mesh(new T.BoxGeometry(0.14, 0.18, 0.14), new T.MeshBasicMaterial({ visible: false })); hit.position.y = 0.07; hit.userData.act = 'cup'; hit.visible = false; g.add(hit); g.userData.hit = hit;
  g.userData.heat = new T.Group(); g.position.copy(from); R.A.root.add(g);
  R.cups = R.cups || []; R.cups.push({ st: 'held', g, snack: it.kind, n: it.n, sips: 0, hotUntil: 0, w: 0, from: from.clone(), mesh });
  Sound.tick();
}
/** Each frame: cups in your hand follow your view; hot cups shimmer, less as they cool. */
function lgCupsStep(dt: number, now: number) {
  const R = LoungeRoom, T = THREE, S: any = State.settings, heatOn = S.loungeHeat !== false;
  if (_lgHeat && _lgHeat.normalMap) _lgHeat.normalMap.offset.set(Math.sin(now * 0.9) * 0.05, -now * 0.45);   // rising
  for (const c of R.cups || []) {
    if (!c.g) continue;
    const hot = c.snack ? 0 : clamp((c.hotUntil - Date.now()) / (5 * 60e3), 0, 1) * (c.lvl == null ? 1 - c.sips / 3 : c.lvl > 0.02 ? 1 : 0);
    c.g.userData.heat.visible = heatOn && hot > 0.05; c.g.userData.heat.scale.set(1, 0.5 + 0.5 * hot, 1);
    if (c.stream) {   // pouring: the stream runs and the cup fills
      const S = c.stream; S.t += dt; const k = clamp(S.t / S.dur, 0, 1);
      c.lvl = c.full * (k < 0.08 ? 0 : (k - 0.08) / 0.92);
      const surf = c.g.position.y + 0.012 + c.lvl * c.g.userData.liq.h; S.m.scale.y = Math.max(0.01, S.top - surf); S.m.position.y = (S.top + surf) / 2;
      const wv = 1 + 0.18 * Math.sin(now * 37) * Math.sin(now * 13); S.m.scale.x = S.m.scale.z = (k > 0.9 ? 1 - (k - 0.9) * 8 : 1) * wv;
      S.m.visible = k > 0.02 && k < 1;
      if (k >= 1) { R.A.root.remove(S.m); S.m.geometry.dispose(); c.stream = null; c.st = 'ready'; toast(`${(LG_DRINKS[c.kind] || LG_DRINKS.espresso).name}, freshly made: click the cup to pick it up`, 'ok'); }
    }
    if (hot > 0.05 && heatOn && c.lvl > 0.02) {   // steam: soft wisps rising and fading
      c.stT = (c.stT || 0) - dt;
      if (c.stT <= 0) { c.stT = 0.28 + Math.random() * 0.25; const w = lgSteamPuff(); const at = c.g.localToWorld(new THREE.Vector3((Math.random() - 0.5) * 0.02, 0.02 + c.lvl * c.g.userData.liq.h, (Math.random() - 0.5) * 0.02)); R.A.root.worldToLocal(at); w.position.copy(at); R.A.root.add(w); R.A.steam.push({ m: w, t: 0 }); }
    }
    if (c.lvl != null) lgLiquid(c);
    if (c.st !== 'held') continue;
    const yaw = R.look.yaw, rot = (x: number, y: number, z: number) => new T.Vector3(x, y, z).applyAxisAngle(new T.Vector3(0, 1, 0), yaw), eye = R.cam.position;
    c.w = Math.min(1, (c.w || 0) + dt * 2.5);
    let pos = eye.clone().add(rot(0.13, -0.26, -0.38)), tilt = 0;
    if (c.use) {   // up to the mouth, a sip, back down
      c.use.t += dt; const t = c.use.t, e = (x: number) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }, k = t < 0.5 ? e(t / 0.5) : t < 1.6 ? 1 : 1 - e((t - 1.6) / 0.5);
      pos = pos.lerp(eye.clone().add(rot(0.0, -0.09, -0.13)), k); tilt = 0.75 * k;
      if (c.lvl != null && t > 0.55 && t < 1.6) { if (c.sip0 == null) c.sip0 = c.lvl; const was = c.lvl; c.lvl = Math.max(0, c.sip0 - (c.full / 3) * clamp((t - 0.55) / 1.0, 0, 1)); if (c.alc && c.lvl < was) lgBarIntake(c.alc.g * (was - c.lvl) / c.full); }   // a drink with alcohol: into you, sip by sip
      if (t >= 2.1) { c.use = null; c.sips++; c.sip0 = null;
        if (c.lvl != null && c.lvl < 0.03) c.sips = 99;
        if (c.snack && c.sips < c.n) { try { c.g.remove(c.mesh); c.mesh = hgItemMesh(c.snack, c.sips, c.n); c.g.add(c.mesh); } catch (e) { /* as it was */ } }
        if (c.sips >= (c.snack ? c.n : 3)) { R.A.root.remove(c.g); c.g = null; c.st = 'done'; toast(c.snack ? `${hgProd(c.snack).name} finished` : c.drinkName ? `${c.drinkName} finished` : c.tea ? 'Tea finished' : 'Coffee finished', 'ok'); continue; } }
    }
    if (c.w < 1) pos = c.from.clone().lerp(pos, c.w * c.w * (3 - 2 * c.w));
    c.g.position.copy(pos); c.g.rotation.set(0, yaw, 0); c.g.rotateX(tilt);
    if (c.lvl != null && dt > 0) { if (c.w >= 1) lgSlosh(c, dt); else { c.pv = null; c.sl = [0, 0]; } }   // picked up gently: it settles in your hand first
  }
  R.cups = (R.cups || []).filter((c: any) => c.st !== 'done');
}

function lgUi(first?: boolean) {
  const R = LoungeRoom; if (!R.on) return;
  const sp = R.root.querySelector('.hg-spots') as HTMLElement; sp.hidden = false;
  sp.innerHTML = `<button data-op="goto" data-k="seats">The seats</button><button data-op="goto" data-k="coffee">Coffee and tea</button>${R.lvl >= 1 ? '<button data-op="goto" data-k="bar">The bar</button>' : ''}<button data-op="goto" data-k="window">The window</button>`;
  const pad = R.root.querySelector('.op-pad') as HTMLElement; if (pad) pad.hidden = DESKTOP;
  const hint = R.root.querySelector('.op-aim') as HTMLElement;
  if (hint && first) { hint.hidden = false; hint.classList.add('op-hint'); hint.textContent = DESKTOP ? 'W A S D to walk · the mouse looks around · click what glows' : 'Stick to walk · drag to look · tap what glows'; setTimeout(() => { if (hint) hint.hidden = true; }, 6000); }
}
function lgGoto(where: string) {
  const R = LoungeRoom, sp: LgSpec = R.spec, fd = R.root.querySelector('.hg-fade') as HTMLElement;
  const to = where === 'coffee' ? { x: sp.W / 2 - 3.3, z: sp.D / 2 - 2.4, yaw: Math.PI, pitch: -0.3 } : where === 'bar' ? { x: -sp.W / 2 + 3.2, z: sp.D / 2 - 3.2, yaw: Math.PI, pitch: -0.15 } : where === 'window' ? { x: 0, z: -sp.D / 2 + 1.6, yaw: 0, pitch: 0.02 } : { x: 0, z: sp.D * 0.18, yaw: 0.2, pitch: -0.12 };
  Sound.tick(); aimUnlock(); if (fd) fd.classList.add('on');
  setTimeout(() => { if (!lgBlocked(to.x, to.z)) { R.free.x = to.x; R.free.z = to.z; } R.look = { yaw: to.yaw, pitch: to.pitch }; if (fd) fd.classList.remove('on'); }, 260);
}

/* ---------- leaving ---------- */
LoungeRoom.close = function (quiet?: boolean) {
  const R = LoungeRoom; if (!R.on) return; R.on = false;
  try { lgDrunkClear(R); } catch (e) { /* clear */ }
  if (!R.host) { for (const m of (R.A && R.A.mirrors) || []) { try { m.userData.dispose(); } catch (e) { /* gone */ } } }
  if (R.host) {   // in the building: only the room's own controls go; the building keeps the room (and its guests)
    const H = R.host; R.host = null;
    clearInterval(R.iv); window.removeEventListener('keydown', R.key$, true); window.removeEventListener('keyup', R.ku$, true); document.removeEventListener('mousemove', R.mm$);
    try { R.ac && R.ac.abort(); } catch (e) { /* none */ }
    if (R.sit) { try { lgStand(); } catch (e) { /* up */ } }
    H.unmount('lounge', R.A && R.A.doorTo ? 1 : 0); R.ren = null; R.scene = null; R.A = null; R.glow = null; R.root = null;
    if (!quiet) H.leaveAll();
    return;
  }
  cancelAnimationFrame(R.raf); clearInterval(R.iv); window.removeEventListener('keydown', R.key$, true); window.removeEventListener('keyup', R.ku$, true); window.removeEventListener('resize', R.fit);
  document.removeEventListener('mousemove', R.mm$); aimUnlock();
  try { FrameGen.dispose(R.perf); } catch (e) { /* none */ }
  exitFreeRenderer(R.ren, R.scene); R.ren = null; R.scene = null; R.A = null; R.glow = null; R.me = null; R.meTried = false; R.guests = [];
  if (R.root) R.root.remove();
  if (!quiet) { try { refresh(); } catch (e) { /* ignore */ } }
};
function lgLeave(to?: string) {
  if (!LoungeRoom.on || ExitSplash.on) return;
  exitSplash('lounge', 'Leaving the ' + (LoungeRoom.spec ? LoungeRoom.spec.name.toLowerCase() : 'lounge'), [
    { pct: 30, step: 'Closing the lounge…', run: () => { const H = LoungeRoom.host; LoungeRoom.close(true); if (H) H.closeAll(); } },
    { pct: 55, step: 'Clearing the room from memory…', run: exitFreeMemory },
    { pct: 85, step: to && to !== 'lounges' ? 'On your way…' : 'Loading your lounges…', run: () => { try { roomGoTo(to || 'lounges'); } catch (e) { refresh(); } } },
  ]);
}
ACTIONS['lounge-visit'] = el => { const k = el && el.getAttribute ? el.getAttribute('data-k') || '' : ''; if (roomLeaveFor('lvisit:' + k)) return; closeAll(); LoungeRoom.open(k); };
