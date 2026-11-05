// The hangar, in 3D. Walk into the hangar where one of your aircraft stands, its doors shut behind it.
//  - Sizes: a hangar is as big as the aircraft in it needs (a small one for turboprops and business jets, up to a very
//    large one for the A380): the whole aircraft fits inside with the doors closed.
//  - The building: steel columns and roof trusses, insulated wall panels, skylight strips across the roof and a band
//    of windows high on the side walls and in the doors, as on real maintenance hangars. Through them the sky outside
//    is the base's own: night, sunrise, day and sunset, worked out from the sun at the airport now; by day the sun
//    shines in through the roof lights.
//  - The doors: sliding leaves across the whole front, each on its own track (hgDoors() moves them; they stay shut).
//  - The aircraft: your own, in your livery (or a model file from www/models/, as everywhere), with what needs fixing.
//  - Your mechanics at that base work round it; click one to talk: what needs fixing, how long it will take, how it is
//    looking, how they are doing. Their voices and mouths are the app's own (humanTalk).
//  - Along the back wall, two rooms: the maintenance office, with the same monitor, keyboard and mouse as the
//    Operations office (the same screen and the same screens behind it), and the break room with a vending machine.
//  - The vending machine: choose something, the coil turns and it drops into the tray; open the flap and take it.
//    Hold it as you walk (look down and it is in your hand), look at it, drink or eat it (a can has 4 or 5 sips, a bar
//    3 or 4 bites), and put it down on any table, counter, trolley or the floor, and pick it up again. What you put
//    down stays where it is in that size of hangar (saved with your airline at once, and in its backups) for 48 hours.
//    Just for fun: nothing in it changes the game.

const HangarRoom: any = { on: false };

interface HgSize { k: string; name: string; W: number; D: number; H: number; door: number }
const HG_SIZES: HgSize[] = [
  { k: 's', name: 'Small hangar', W: 36, D: 42, H: 13, door: 10.5 },
  { k: 'm', name: 'Medium hangar', W: 52, D: 66, H: 18, door: 15 },
  { k: 'l', name: 'Large hangar', W: 82, D: 94, H: 25, door: 21.5 },
  { k: 'xl', name: 'Very large hangar', W: 96, D: 100, H: 30, door: 26.5 },
];
/** The rooms along the back wall: the maintenance office (x −11 … −3) and the break room (−3 … 5), 6.5 m deep. */
const HG_RD = 6.5, HG_RX0 = -11, HG_RXM = -3, HG_RX1 = 5, HG_RH = 3.2;

function hgSizeFor(typeId: string): HgSize {
  let s: any = null; try { s = shapeOf(typeId); } catch (e) { s = null; }
  if (!s) return HG_SIZES[1];
  for (const z of HG_SIZES) if (s.span + 8 <= z.W && s.L + HG_RD + 12 <= z.D && s.H + 1.5 <= z.door) return z;
  return HG_SIZES[HG_SIZES.length - 1];
}
/** The hangar's own model file for a size, if there is one: on the PC a "-pc" file (higher quality) first. */
function hgShellFile(sz: HgSize): string {
  const n = 'hangars/hangar-' + ({ s: 'small', m: 'medium', l: 'large', xl: 'very-large' } as any)[sz.k];
  return Models.first(DESKTOP ? [n + '-pc.glb', n + '.glb'] : [n + '.glb']);
}
function hgSizeK(k: string): HgSize { return HG_SIZES.filter(s => s.k === k)[0] || HG_SIZES[1]; }

/** Is this aircraft in a hangar now? Only while its repairs are being done (booked and paid, on the ground). */
function hgInWork(a: any): boolean {
  if (!a || a.status === 'flying') return false;
  return a.status === 'maintenance' || ((State.issues || []) as any[]).some(i => i.reg === a.reg && i.status === 'scheduled');
}
/** Where an aircraft in for work is: the airport it stands at. */
function hgWhere(a: any): string { return a.location || a.base || company().hub; }
/** The mechanics working on an aircraft: chosen when its work starts (the ones based where it is, each on one aircraft
 *  at a time, as many as its size needs), and kept on its jobs until they are done. */
function hgCrewFor(reg: string): any[] {
  const a: any = plane(reg); if (!a || !hgInWork(a)) return [];
  const jobs = ((State.issues || []) as any[]).filter(i => i.reg === reg && i.status === 'scheduled');
  const alive = (id: string) => { const p: any = (State as any).staff.filter((x: any) => x.id === id)[0]; return p && !p.left ? p : null; };
  const kept = jobs.length && Array.isArray(jobs[0].mechIds) ? jobs[0].mechIds.map(alive).filter(Boolean) : [];
  if (kept.length) return kept;
  const where = hgWhere(a), busy: any = {};
  for (const i of (State.issues || []) as any[]) if (i.status === 'scheduled' && i.reg !== reg && Array.isArray(i.mechIds)) for (const id of i.mechIds) busy[id] = 1;
  const free = (staffOf(a.companyId, 'mech') as any[]).filter(p => !p.left && p.base === where && !busy[p.id]).sort((x, y) => (y.rating || 0) - (x.rating || 0));
  const want = Math.max(1, Math.min(3, Math.ceil((MECH_RATIO as any)[acType(a.typeId).cls] || 1)));
  const crew = free.slice(0, want);
  if (jobs.length && crew.length) { for (const j of jobs) j.mechIds = crew.map(p => p.id); try { Store.soon(); } catch (e) { /* saved later */ } }
  return crew;
}
interface HgHangar { base: string; sz: HgSize; n: number; reg: string }
/** Your hangars, base by base: one of every size always ready to walk into; an aircraft in for work stands in a
 *  hangar of its size, one aircraft to a hangar, and when more of a size are in, there are more of that size. */
function hgHangars(): HgHangar[] {
  const co: any = company(), out: HgHangar[] = [];
  const inWork = fleetOf().filter(hgInWork) as any[];
  const bases: string[] = []; const addB = (b: string) => { if (b && bases.indexOf(b) < 0) bases.push(b); };
  try { for (const b of companyBases(co.id)) addB(b); } catch (e) { addB(co.hub); }
  for (const a of inWork) addB(hgWhere(a));
  for (const b of bases) for (const sz of HG_SIZES) {
    const here = inWork.filter(a => hgWhere(a) === b && hgSizeFor(a.typeId).k === sz.k).sort((x, y) => x.reg < y.reg ? -1 : 1);
    if (!here.length) out.push({ base: b, sz, n: 1, reg: '' });
    else here.forEach((a, k) => out.push({ base: b, sz, n: k + 1, reg: a.reg }));
  }
  return out;
}
function hgName(h: { sz: HgSize; n: number }, many: boolean): string { return `${h.sz.name}${many ? ' ' + h.n : ''}`; }
function hgFixList(reg: string): any[] { return ((State.issues || []) as any[]).filter(i => i.reg === reg && (i.status === 'open' || i.status === 'scheduled')); }
/** How far the work on an aircraft has come (0…1), from its booked jobs. */
function hgProgress(reg: string): number { const s: any = ((State.issues || []) as any[]).filter(i => i.reg === reg && i.status === 'scheduled' && i.startedAt && i.durMin)[0]; return s ? clamp((Date.now() - s.startedAt) / (s.durMin * 60000), 0, 1) : 0; }
function hgLeftMin(reg: string): number { const s: any = ((State.issues || []) as any[]).filter(i => i.reg === reg && i.status === 'scheduled' && i.startedAt && i.durMin)[0]; return s ? Math.max(1, Math.round((s.startedAt + s.durMin * 60000 - Date.now()) / 60000)) : 0; }
/** The list in Maintenance: every base's hangars, which aircraft is in each, what is being fixed and by whom. */
function hgListHtml(): string {
  const H = hgHangars();
  if (!H.length) return `<p class="muted hg-none">${icon('info')}Your hangars open when you have a base.</p>`;
  const bases = H.map(h => h.base).filter((b, i, l) => l.indexOf(b) === i);
  return `<div class="hg-list">${bases.map(b => { const hs = H.filter(h => h.base === b), busy = hs.filter(h => h.reg).length;
    return `<div class="card hg-card"><div class="hg-card-h">${icon('wrench')}<span><b>Hangars at ${esc(b)}</b><small>${busy ? `${busy} aircraft in for work` : 'All empty: nothing is in for work here'}</small></span></div>
    ${hs.map(h => { const many = hs.filter(x => x.sz.k === h.sz.k).length > 1;
      if (!h.reg) return `<div class="hg-ac empty"><span><b>${esc(hgName(h, many))}</b><small>${h.sz.W} × ${h.sz.D} m · doors ${h.sz.door} m · empty</small></span><button class="btn sm ghost" data-act="hangar-visit" data-base="${esc(b)}" data-size="${h.sz.k}">${icon('wrench')}Walk in</button></div>`;
      const a = plane(h.reg), t = acType(a.typeId), fx = hgFixList(h.reg), crew = hgCrewFor(h.reg), left = hgLeftMin(h.reg);
      return `<div class="hg-ac"><span><b>${esc(hgName(h, many))} · ${esc(h.reg)}</b><small>${esc(t.model)} · ${Math.round(a.condition)}%${left ? ` · ready in ${left > 90 ? Math.round(left / 60) + ' h' : left + ' min'}` : ''}</small>
        <em class="bad">${fx.length ? esc(fx.map(i => i.title).slice(0, 3).join(', ')) + (fx.length > 3 ? '…' : '') : 'General check'}</em>
        <span class="hg-prog" title="${Math.round(hgProgress(h.reg) * 100)}% done"><i style="width:${(hgProgress(h.reg) * 100).toFixed(1)}%"></i></span><small class="hg-pct">${Math.round(hgProgress(h.reg) * 100)}% done</small>
        <em class="${crew.length ? 'ok' : 'bad'}">${crew.length ? 'Mechanics: ' + esc(crew.map((p: any) => p.name).join(', ')) : `No mechanics free at ${esc(b)}`}</em></span>
        <button class="btn sm primary" data-act="hangar-visit" data-reg="${esc(h.reg)}">${icon('wrench')}Walk in</button></div>`; }).join('')}</div>`; }).join('')}</div>`;
}

/** The line under Hangars on the Overview: how many aircraft are in for work. */
function hgBusyLine(): string {
  let n = 0; try { n = fleetOf().filter(hgInWork).length; } catch (e) { n = 0; }
  return n ? `${n} aircraft in for work: walk in and see them` : 'Every hangar is empty: walk in and look around';
}
/** The Hangars page (from the Overview): every hangar at every base, empty or with an aircraft in for work. */
SCREENS.hangars = {
  title: 'Hangars', icon: 'wrench', nav: false,
  render() {
    const n = fleetOf().filter(hgInWork).length;
    return `<div class="screen-head"><div><button class="back-btn" data-act="go" data-screen="ops">${icon('chevron', 'flip')}<span>Overview</span></button>
      <h1>Hangars</h1><p class="sub">${n ? `${n} aircraft in for work` : 'No aircraft in for work right now'} · one hangar of every size at each base, more when more aircraft are in</p></div></div>
      ${hgListHtml()}`;
  },
};

/* ---------- what the vending machine sells (made-up products, no brands) ---------- */
interface HgProd { k: string; name: string; type: 'can' | 'bar'; c1: string; c2: string; inner?: string; file: string }
const HG_PRODUCTS: HgProd[] = [
  { k: 'cola', name: 'Cola', type: 'can', c1: '#7A1414', c2: '#EFE6D6', file: 'can-cola' },
  { k: 'lemon', name: 'Lemon soda', type: 'can', c1: '#E6CF2E', c2: '#2E7A34', file: 'can-lemon' },
  { k: 'orange', name: 'Orange soda', type: 'can', c1: '#EE7418', c2: '#FFF6E8', file: 'can-orange' },
  { k: 'choco', name: 'Chocolate bar', type: 'bar', c1: '#4A2A18', c2: '#E9C46A', inner: '#5A341F', file: 'bar-chocolate' },
  { k: 'peanut', name: 'Peanut bar', type: 'bar', c1: '#D9A441', c2: '#6B3B12', inner: '#A8743A', file: 'bar-peanut' },
  { k: 'water', name: 'Sparkling water', type: 'can', c1: '#CFE6F5', c2: '#2C6FB0', file: 'can-water' },
  { k: 'oat', name: 'Oat bar', type: 'bar', c1: '#5E8C3A', c2: '#F4EBD0', inner: '#C9A46A', file: 'bar-oat' },
  { k: 'icedtea', name: 'Iced tea', type: 'can', c1: '#A85A1B', c2: '#F6E7C8', file: 'can-icedtea' },
  { k: 'caramel', name: 'Caramel bar', type: 'bar', c1: '#B3261E', c2: '#F5D08A', inner: '#8A4B1E', file: 'bar-caramel' },
];
function hgProd(k: string): HgProd { return HG_PRODUCTS.filter(p => p.k === k)[0] || HG_PRODUCTS[0]; }
const HG_CAN = { r: 0.033, h: 0.115 }, HG_BAR = { w: 0.038, l: 0.13, t: 0.016 };

/* ---------- what you put down: saved per hangar size, for 48 hours ---------- */
interface HgItem { id: string; kind: string; x: number; y: number; z: number; ry: number; used: number; n: number; at: number; flat?: boolean }
const HG_KEEP_MS = 48 * 3600 * 1000;
function hgStore(): any { const S: any = State; if (!S.hangarItems || typeof S.hangarItems !== 'object') S.hangarItems = {}; return S.hangarItems; }
function hgClean(): boolean {
  const st = hgStore(), lim = Date.now() - HG_KEEP_MS; let ch = false;
  for (const k of Object.keys(st)) if (Array.isArray(st[k])) { const n = st[k].length; st[k] = st[k].filter((i: any) => i && i.at > lim); if (st[k].length !== n) ch = true; }
  if (st.held && !(st.held.at > lim)) { st.held = null; ch = true; }
  return ch;
}
/** Saved at once (and so in the next backup and the cloud copy). */
function hgSave() { try { Store.save(); } catch (e) { try { Store.soon(); } catch (x) { /* next change */ } } }

/* ---------- drawn pictures ---------- */
function hgLabel(p: HgProd): HTMLCanvasElement {
  const can = p.type === 'can', [c, x] = ctCanvas(can ? 512 : 256, can ? 256 : 512), W = c.width, H = c.height;
  x.fillStyle = p.c1; x.fillRect(0, 0, W, H);
  x.fillStyle = p.c2; x.globalAlpha = 0.9;
  if (can) { x.beginPath(); x.moveTo(0, H * 0.62); for (let i = 0; i <= 16; i++) x.lineTo(i * W / 16, H * (0.62 + 0.07 * Math.sin(i * 0.8))); x.lineTo(W, H * 0.8); x.lineTo(0, H * 0.8); x.fill(); }
  else { x.beginPath(); x.moveTo(0, H * 0.58); x.lineTo(W, H * 0.42); x.lineTo(W, H * 0.5); x.lineTo(0, H * 0.66); x.fill(); }
  x.globalAlpha = 1; x.fillStyle = p.c2; x.textAlign = 'center'; x.textBaseline = 'middle';
  if (can) { const words = p.name.toUpperCase(); x.font = `800 ${words.length > 8 ? 42 : 60}px Inter, Arial, sans-serif`; for (const dx of [W * 0.25, W * 0.75]) x.fillText(words, dx, H * 0.36); x.font = '600 20px Inter, Arial, sans-serif'; x.fillText('330 ml', W * 0.25, H * 0.9); x.fillText('330 ml', W * 0.75, H * 0.9); }
  else { x.save(); x.translate(W / 2, H * 0.3); x.rotate(-Math.PI / 2); x.font = '800 44px Inter, Arial, sans-serif'; x.fillText(p.name.split(' ')[0].toUpperCase(), 0, 0); x.restore(); x.font = '600 18px Inter, Arial, sans-serif'; x.fillText('45 g', W / 2, H * 0.9); }
  // the crimped wrapper ends / a little shine
  const g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.45, 'rgba(255,255,255,.18)'); g.addColorStop(0.55, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  return c;
}
function hgMat(key: string, make: () => any): any { const R = HangarRoom, M = R.mats || (R.mats = {}); return M[key] || (M[key] = make()); }
/** One can or bar as it is now (used: sips or bites taken of n); its middle at the origin, standing upright. */
function hgItemMesh(kind: string, used: number, n: number): any {
  const T = THREE, p = hgProd(kind), g = new T.Group(); g.userData.kind = kind;
  const label = hgMat('lab-' + kind, () => new T.MeshStandardMaterial({ map: ctTex(hgLabel(p)), roughness: p.type === 'can' ? 0.28 : 0.45, metalness: p.type === 'can' ? 0.45 : 0.05 }));
  const alu = hgMat('alu', () => new T.MeshStandardMaterial({ color: 0xC9CED4, roughness: 0.25, metalness: 0.9 }));
  const add = (geo: any, m: any, y: number, z = 0) => { const o = new T.Mesh(geo, m); o.position.set(0, y, z); o.castShadow = true; g.add(o); return o; };
  if (p.type === 'can') {
    const { r, h } = HG_CAN;
    add(new T.CylinderGeometry(r, r, h * 0.84, 28, 1, true), label, 0);
    add(new T.CylinderGeometry(r * 0.8, r, h * 0.07, 28, 1, true), alu, h * 0.455);
    add(new T.CylinderGeometry(r, r * 0.86, h * 0.08, 28, 1, true), alu, -h * 0.46);
    add(new T.CylinderGeometry(r * 0.8, r * 0.8, 0.002, 28), alu, h * 0.49);
    add(new T.CircleGeometry(r * 0.86, 24), alu, -h * 0.5).rotation.x = Math.PI / 2;
    const tab = add(new T.BoxGeometry(0.011, 0.0016, 0.021), alu, h * 0.493, used > 0 ? -0.004 : 0.006); if (used > 0) tab.rotation.x = -0.5;
    if (used > 0) { const hole = add(new T.CircleGeometry(1, 16), hgMat('hole', () => new T.MeshBasicMaterial({ color: 0x0A0B0D })), h * 0.4915, 0.014); hole.scale.set(0.007, 0.011, 1); hole.rotation.x = -Math.PI / 2; }
  } else {
    const { w, l, t } = HG_BAR, left = n > 0 ? Math.max(0, (n - used) / n) : 1;
    if (used <= 0) add(new T.BoxGeometry(w, l, t), label, 0);
    else {
      const inner = hgMat('in-' + kind, () => new T.MeshStandardMaterial({ color: p.inner || '#5A341F', roughness: 0.6 }));
      const Li = Math.max(0.01, (l - 0.006) * left), Lw = Math.min(Li - 0.012, l * 0.55);
      add(new T.BoxGeometry(w * 0.9, Li, t * 0.82), inner, -l / 2 + 0.003 + Li / 2);
      if (Lw > 0.01) { const wr = add(new T.BoxGeometry(w, Lw, t), label, -l / 2 + Lw / 2); wr.scale.z = 1.02; }
      // the bitten end: a rounded bite out of the top
      const bite = add(new T.CylinderGeometry(w * 0.32, w * 0.32, t * 0.86, 12), inner, -l / 2 + 0.003 + Li - 0.002); bite.rotation.x = Math.PI / 2; bite.scale.set(1, 1, 1);
    }
  }
  // a model file in its place, if there is one (whole items only: a bitten bar stays the app's own)
  if (p.type === 'can' || used <= 0) { try { Models.swap(g, 'items/' + p.file + '.glb', false); } catch (e) { /* own model */ } }
  return g;
}

/** How a hangar's windows look from inside, from the sun at the base now: night, sunrise, day or sunset. */
function hgSun(base: string): { alt: number; v: number[]; sky: any; k: number; warm: number; name: string } {
  const T = THREE, A: any = apt(base) || apt(company().hub) || { pos: [0, 50] };
  let alt = 30, az = 180;
  try { const d = astroD(Date.now()), s = astroSun(d), p = astroAltAz(s.ra, s.dec, A.pos[1], astroLst(d, A.pos[0])); alt = astroRefract(p.alt); az = p.az; } catch (e) { /* noon */ }
  const v = astroVec(alt, az), am = new Date().getHours() < 12;
  const day = new T.Color(0xA9D0F2), low = new T.Color(0xF4A35C), dusk = new T.Color(0x5A4C80), night = new T.Color(0x0C1630);
  const sm = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  let sky: any;
  if (alt > 2) sky = low.clone().lerp(day, sm(2, 14, alt));
  else if (alt > -6) sky = dusk.clone().lerp(low, sm(-6, 2, alt));
  else sky = night.clone().lerp(dusk, sm(-12, -6, alt));
  const k = alt > 8 ? 1 : alt > -6 ? 0.18 + 0.82 * sm(-6, 8, alt) : 0.06 + 0.12 * sm(-14, -6, alt);
  const warm = alt > -4 && alt < 14 ? 1 - Math.abs(alt - 3) / 11 : 0;
  const name = alt < -6 ? 'Night' : alt < 8 ? (am ? 'Sunrise' : 'Sunset') : 'Day';
  return { alt, v, sky, k, warm: clamp(warm, 0, 1), name };
}

/* ---------- opening ---------- */
const HG_EMBLEM = `<svg class="ctl-scales hg-emb" viewBox="0 0 200 200" aria-hidden="true"><defs><linearGradient id="hgG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE7B0"/><stop offset=".55" stop-color="#F2B544"/><stop offset="1" stop-color="#9A6A1E"/></linearGradient></defs>
  <circle cx="100" cy="100" r="94" fill="#141210" stroke="url(#hgG)" stroke-width="4"/>
  <path d="M34 136 V84 Q100 40 166 84 V136 Z" fill="none" stroke="url(#hgG)" stroke-width="4" stroke-linejoin="round"/>
  <g fill="url(#hgG)"><path class="hg-plane" d="M62 120 L92 116 L104 100 L110 100 L106 116 L134 113 L140 106 L144 106 L142 116 L146 122 L142 122 L106 124 L102 132 L96 132 L96 124 L62 124 Z"/></g>
  <g stroke="url(#hgG)" stroke-width="2" opacity=".7"><path d="M50 136 V92 M66 136 V82 M82 136 V75 M118 136 V75 M134 136 V82 M150 136 V92"/></g>
  <text x="100" y="168" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-weight="700" font-size="14" fill="url(#hgG)" letter-spacing="5">HANGAR</text></svg>`;
const HG_SCENE = `<svg class="ctl-house hg-scene" viewBox="0 0 560 260" aria-hidden="true"><rect x="0" y="236" width="560" height="24"/>
  <path d="M120 236 V120 Q280 50 440 120 V236 Z"/><rect x="40" y="170" width="70" height="66"/><rect x="450" y="186" width="80" height="50"/></svg>`;

HangarRoom.open = function (reg: string, base?: string, sizeK?: string, show?: HgShow) {
  const R = HangarRoom; if (R.on) return; HG_VR = null;
  const T = THREE; if (!T) { toast('3D is not available on this device', 'warn'); return; }
  R.show = show || null;   // a showroom: an aircraft you are thinking of buying or leasing, on its own in a hangar of its size
  // an aircraft stands in a hangar only while it is in for work; otherwise it is an empty hangar of that size
  const a0: any = reg && !show ? plane(reg) : null, a: any = a0 && hgInWork(a0) ? a0 : null;
  try { if (typeof OfficeRoom !== 'undefined' && OfficeRoom.on) OfficeRoom.close(true); } catch (e) { /* none */ }
  try { if (typeof OpsRoom !== 'undefined' && OpsRoom.on) OpsRoom.close(true); } catch (e) { /* none */ }
  const co: any = company(), sz = show ? hgSizeFor(show.typeId) : a ? hgSizeFor(a.typeId) : a0 ? hgSizeFor(a0.typeId) : hgSizeK(sizeK || 'm');
  R.on = true; R.loading = true; R.reg = a ? a.reg : ''; R.sz = sz; R.base = show ? 'Showroom' : a ? hgWhere(a) : base || (a0 ? hgWhere(a0) : co.hub); R.keys = {}; R.stick = [0, 0]; R.last = 0; R.loadT0 = performance.now();
  R.overlay = null; R.hold = null; R.vend = null; R.talk = -1; R.hover = null;
  if (hgClean()) hgSave();
  const q = Gfx.placeQ('hangar');
  const root = document.createElement('div'); root.className = 'court3d office3d ops3d hg3d'; R.root = root;
  root.innerHTML = `<canvas></canvas>
    <div class="ct-top"><div><small>${show ? 'Showroom · ' + esc(sz.name) : esc(co.name) + ' · ' + esc(R.base)}</small><b>${show ? esc(show.label) : `${esc(sz.name)} · ${a ? esc(a.reg) : 'empty'}`}</b></div></div>
    <button class="ct-leave" data-op="leave">${icon('close')}<span>${show ? 'Back to the market' : 'Leave the hangar'}</span><kbd>Esc</kbd></button>
    <div class="ct-spots of-spots op-spots hg-spots" hidden></div><div class="of-aim op-aim" hidden></div><div class="walk-pad ct-pad op-pad" hidden><i></i></div><div class="of-aim op-dot" hidden>+</div>
    <div class="hg-hand" hidden></div><div class="hg-panel" hidden></div><div class="hg-fade"></div>
    ${ctLoaderHtml(sz.name, 'Opening the hangar…', HG_EMBLEM, HG_SCENE)}`;
  document.body.appendChild(root);
  setTimeout(() => { if (R.on && R.root === root) hgOpen2(root, q); }, 80);
};

/* ---------- the building ---------- */
function hgPanelTex(base: string, seams: number, ribs: boolean, seed: number): HTMLCanvasElement {
  const [c, x] = ctCanvas(512, 512), r = ctRng(seed); x.fillStyle = base; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 4000; i++) { x.fillStyle = `rgba(0,0,0,${r() * 0.035})`; x.fillRect(r() * 512, r() * 512, 2, 2); }
  if (ribs) for (let i = 0; i < 16; i++) { const X = i * 32; const g = x.createLinearGradient(X, 0, X + 32, 0); g.addColorStop(0, 'rgba(0,0,0,.10)'); g.addColorStop(0.3, 'rgba(255,255,255,.10)'); g.addColorStop(0.55, 'rgba(0,0,0,.04)'); g.addColorStop(1, 'rgba(0,0,0,.12)'); x.fillStyle = g; x.fillRect(X, 0, 32, 512); }
  for (let i = 0; i < seams; i++) { x.fillStyle = 'rgba(0,0,0,.22)'; x.fillRect(0, i * 512 / seams, 512, 2); x.fillStyle = 'rgba(255,255,255,.18)'; x.fillRect(0, i * 512 / seams + 2, 512, 1); }
  return c;
}
function hgFloorTex(): HTMLCanvasElement {
  const [c, x] = ctCanvas(1024, 1024), r = ctRng(77); x.fillStyle = '#8D9399'; x.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 26000; i++) { const v = r(); x.fillStyle = v < 0.5 ? `rgba(0,0,0,${r() * 0.05})` : `rgba(255,255,255,${r() * 0.05})`; x.fillRect(r() * 1024, r() * 1024, 1 + r() * 3, 1 + r() * 3); }
  for (let i = 0; i < 18; i++) { x.fillStyle = `rgba(40,36,30,${0.04 + r() * 0.05})`; x.beginPath(); x.ellipse(r() * 1024, r() * 1024, 20 + r() * 90, 10 + r() * 50, r() * 3, 0, 6.3); x.fill(); }   // old oil marks
  x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 2; for (const p of [0, 512]) { x.beginPath(); x.moveTo(p, 0); x.lineTo(p, 1024); x.moveTo(0, p); x.lineTo(1024, p); x.stroke(); }   // the saw cuts in the slab
  return c;
}
function hgBoard(reg: string): HTMLCanvasElement {
  const [c, x] = ctCanvas(1024, 640), a: any = plane(reg), fx = hgFixList(reg);
  x.fillStyle = '#F4F5F2'; x.fillRect(0, 0, 1024, 640); x.strokeStyle = '#C9CDD2'; x.lineWidth = 10; x.strokeRect(5, 5, 1014, 630);
  if (!a) { x.fillStyle = '#1F3550'; x.font = '700 46px "Comic Sans MS", "Segoe Print", cursive'; x.fillText('Hangar free', 40, 80); x.fillStyle = '#334'; x.font = '600 32px "Comic Sans MS", "Segoe Print", cursive'; x.fillText('No aircraft in for work.', 40, 150); x.fillStyle = '#B22222'; x.font = '700 28px "Comic Sans MS", cursive'; x.fillText('SAFETY FIRST · FOD WALK EVERY SHIFT', 40, 600); return c; }
  x.fillStyle = '#1F3550'; x.font = '700 46px "Comic Sans MS", "Segoe Print", cursive'; x.fillText(`Work on ${reg}`, 40, 80);
  x.fillStyle = '#334'; x.font = '600 30px "Comic Sans MS", "Segoe Print", cursive';
  try { x.fillText(`${acType(a.typeId).model} · condition ${Math.round(a.condition)}%`, 40, 130); } catch (e) { /* none */ }
  x.font = '600 32px "Comic Sans MS", "Segoe Print", cursive';
  if (!fx.length) { x.fillStyle = '#1E7A44'; x.fillText('Nothing open. General look-over.', 40, 210); }
  fx.slice(0, 7).forEach((i: any, k: number) => { x.fillStyle = i.status === 'scheduled' ? '#1E7A44' : i.severity === 'grounding' ? '#B22222' : '#B8681E'; x.fillText(`${i.status === 'scheduled' ? '▶' : '□'}  ${i.title}`, 40, 210 + k * 56); });
  x.fillStyle = '#B22222'; x.font = '700 28px "Comic Sans MS", cursive'; x.fillText('SAFETY FIRST · FOD WALK EVERY SHIFT', 40, 600);
  return c;
}

function hgBuild(scene: any, q: number): any {
  const R = HangarRoom, T = THREE, sz: HgSize = R.sz, W = sz.W, D = sz.D, H = sz.H, Hd = sz.door, co: any = company();
  const A: any = { hits: [], surfs: [], blocks: [] as number[][], panes: {} as any, root: null, patches: [] };
  const M = (o: any) => new T.MeshStandardMaterial(Object.assign({ roughness: 0.7, metalness: 0.05 }, o));
  const mat = {
    floor: M({ map: ctTex(hgFloorTex(), W / 8, D / 8), roughness: 0.32, envMapIntensity: 0.8 }),
    liner: M({ map: ctTex(hgPanelTex('#D7DBDF', 1, false, 3), 1, 1), roughness: 0.85 }),
    clad: M({ map: ctTex(hgPanelTex('#C8CDD2', 0, true, 4), 6, 1), roughness: 0.6, metalness: 0.25 }),
    block: M({ map: ctTex(ctNoise('#8A9097', 0.1, 21), 6, 2), roughness: 0.95 }),
    steel: M({ color: 0x3E5266, roughness: 0.55, metalness: 0.5 }), truss: M({ color: 0x6E7C8A, roughness: 0.6, metalness: 0.5 }),
    roof: M({ map: ctTex(hgPanelTex('#C3C8CD', 0, true, 5), 1, 4), roughness: 0.9 }),
    yellow: M({ color: 0xF2C230, roughness: 0.5 }), red: M({ color: 0xB3261E, roughness: 0.45 }), white: M({ color: 0xF2F2EE, roughness: 0.6 }),
    dark: M({ color: 0x1E2126, roughness: 0.6 }), black: M({ color: 0x15171B, roughness: 0.4 }), metal: M({ color: 0x8A939C, metalness: 0.85, roughness: 0.35 }),
    wallIn: M({ color: 0xE6E8EA, roughness: 0.9 }), vinyl: M({ map: ctTex(ctNoise('#5B6A78', 0.08, 8), 4, 4), roughness: 0.55 }), vinyl2: M({ map: ctTex(ctNoise('#7D7267', 0.08, 9), 4, 4), roughness: 0.55 }),
    ceiling: M({ map: ctTex(hgPanelTex('#ECEDEE', 4, false, 6), 4, 4), roughness: 0.95 }), oak: M({ map: ctTex(ctWood('#B08A5C', '#6E4F2E', 3)), roughness: 0.45 }),
    lamp: new T.MeshBasicMaterial({ color: 0xFFF6E6 }), glass: M({ color: 0x9FB6C8, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.22, depthWrite: false }),
  };
  const root = new T.Group(); scene.add(root); A.root = root;
  const shadow = q >= 1;
  const add = (g: any, m: any, x: number, y: number, z: number, ry?: number, par?: any) => { const o = new T.Mesh(g, m); o.position.set(x, y, z); if (ry) o.rotation.y = ry; o.castShadow = shadow; o.receiveShadow = true; (par || root).add(o); return o; };
  const bx = (w: number, h: number, d: number, m: any, x: number, y: number, z: number, ry?: number, par?: any) => add(new T.BoxGeometry(w, h, d), m, x, y, z, ry, par);
  const quad = (w: number, h: number, m: any, x: number, y: number, z: number, ry: number, rx = 0, cast = true) => { const o = new T.Mesh(new T.PlaneGeometry(w, h), m); o.position.set(x, y, z); o.rotation.set(rx, ry, 0, 'YXZ'); o.receiveShadow = true; o.castShadow = cast && shadow; root.add(o); return o; };
  const surf = (o: any) => { A.surfs.push(o); return o; };
  const block = (x0: number, z0: number, x1: number, z1: number) => A.blocks.push([Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1)]);
  /** One piece of equipment or furniture: what build() adds becomes one group at (x, z) turned ry (its front along +z
   *  before turning), and a model file hangar-props/<name>.glb goes in its place if there is one. */
  const prop = (name: string, x: number, z: number, ry: number, build: () => void) => {
    const n0 = root.children.length; build();
    const g = new T.Group(); g.name = name; g.position.set(x, 0, z); g.rotation.y = ry; root.add(g); g.updateMatrixWorld(true);
    for (const o of root.children.slice(n0)) if (o !== g) g.attach(o);
    hgPropSwap(g, name); return g;
  };
  A.prop = prop;
  // the windows' glass: one material for each way they face (the sky is brighter and warmer on the sun's side)
  const pane = (k: string) => A.panes[k] || (A.panes[k] = new T.MeshBasicMaterial({ color: 0x9FC4E6, toneMapped: false, side: T.DoubleSide }));
  const x0 = -W / 2, x1 = W / 2, z0 = -D / 2, z1 = D / 2;
  // the floor: the whole slab, with the yellow lines: the centre line the aircraft is towed in on, a walkway along the walls
  { const f = quad(W, D, mat.floor, 0, 0, 0, 0, -Math.PI / 2, false); surf(f); f.userData.floor = true; f.userData.keep = true;
    const ln = (w: number, d: number, x: number, z: number, m = mat.yellow) => { const o = new T.Mesh(new T.PlaneGeometry(w, d), m); o.rotation.x = -Math.PI / 2; o.position.set(x, 0.004, z); o.receiveShadow = true; root.add(o); };
    ln(0.18, D - HG_RD - 4, 0, (z0 + HG_RD + z1) / 2);
    for (const s of [-1, 1]) { ln(0.12, D - HG_RD - 3, s * (W / 2 - 1.6), (z0 + HG_RD + z1) / 2); }
    ln(W - 3.2, 0.12, 0, z0 + HG_RD + 1.4); ln(W - 2, 0.12, 0, z1 - 2.6);
    for (let i = 0; i < Math.floor((W - 4) / 1.2); i++) { const o = new T.Mesh(new T.PlaneGeometry(0.5, 0.12), mat.red); o.rotation.set(-Math.PI / 2, 0, 0.8); o.position.set(x0 + 2.2 + i * 1.2, 0.005, z1 - 1.6); root.add(o); }   // keep clear of the doors
  }
  // the side walls: concrete blocks below, liner panels above, a band of windows high up between the columns
  const bay = 8, nb = Math.max(3, Math.round((D - 1) / bay)), bz = (D - 1) / nb, wy0 = H - 5.2, wy1 = H - 2.2;
  for (const s of [-1, 1]) {
    const x = s * W / 2, ry = -s * Math.PI / 2, kp = s > 0 ? 'e' : 'w';
    quad(D, 2.4, mat.block, x - s * 0.03, 1.2, 0, ry);
    quad(D, wy0 - 2.4, mat.liner, x, 2.4 + (wy0 - 2.4) / 2, 0, ry);
    quad(D, H - wy1, mat.liner, x, wy1 + (H - wy1) / 2, 0, ry);
    for (let i = 0; i <= nb; i++) {
      const z = z0 + 0.5 + i * bz;
      bx(0.5, H, 0.5, mat.steel, x - s * 0.3, H / 2, z);   // the column
      if (i < nb) { const zc = z + bz / 2, pw = bz - 0.8; quad(pw, wy1 - wy0, pane(kp), x - s * 0.04, (wy0 + wy1) / 2, zc, ry, 0, false); bx(0.12, wy1 - wy0, 0.12, mat.steel, x - s * 0.1, (wy0 + wy1) / 2, zc, 0); bx(0.14, 0.14, bz, mat.steel, x - s * 0.11, wy0, zc); bx(0.14, 0.14, bz, mat.steel, x - s * 0.11, wy1, zc); }
      // the wall between the windows, round the column
      bx(0.06, wy1 - wy0 - 0.02, 0.8, mat.liner, x - s * 0.035, (wy0 + wy1) / 2, z);
    }
    block(x - 0.6, z0, x + 0.6, z1);
  }
  // the back wall: blocks and liner, two small windows in the rooms
  quad(W, 2.4, mat.block, 0, 1.2, z0 + 0.03, 0); quad(W, H - 2.4, mat.liner, 0, 2.4 + (H - 2.4) / 2, z0, 0);
  for (let x = x0 + 0.5; x <= x1; x += 8) bx(0.5, H, 0.5, mat.steel, x, H / 2, z0 + 0.3);
  // high on the back wall, a row of windows too (as most hangars have, over the shops)
  for (let x = x0 + 5; x < x1 - 4; x += 8) quad(5.4, 2.4, pane('n'), x + 3.2, H - 3.6, z0 + 0.08, 0, 0, false);
  block(x0, z0 - 1, x1, z0 + 0.35);
  // the roof: trusses across the width every bay, roof panels between skylight strips that run across the hangar
  {
    const tH = Math.min(3.2, H * 0.16), yb = H - tH, nT = nb + 1, trussBars: number[][] = [];
    for (let i = 0; i < nT; i++) {
      const z = z0 + 0.5 + i * bz;
      trussBars.push([0, yb, z, W, 0.3, 0.3, 0]); trussBars.push([0, H - 0.25, z, W, 0.3, 0.3, 0]);   // the top chord 10 cm under the roof panels, not touching them
      const n = Math.round(W / 3), sw = W / n;
      for (let k = 0; k <= n; k++) { const x = x0 + k * sw; trussBars.push([x, yb + tH / 2, z, 0.14, tH, 0.14, 0]); if (k < n) { const L = Math.hypot(sw, tH); trussBars.push([x + sw / 2, yb + tH / 2, z, L, 0.12, 0.12, (k % 2 ? 1 : -1) * Math.atan2(tH, sw)]); } }
    }
    // purlins along the hangar
    for (let k = 0; k <= 8; k++) trussBars.push([x0 + k * W / 8, H - 0.55, 0, 0.2, 0.25, D, 0]);
    const im = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), mat.truss, trussBars.length), m4 = new T.Matrix4(), Q = new T.Quaternion(), E = new T.Euler(), S = new T.Vector3(), P = new T.Vector3();
    trussBars.forEach((b, i) => { E.set(0, 0, b[6]); Q.setFromEuler(E); m4.compose(P.set(b[0], b[1], b[2]), Q, S.set(b[3], b[4], b[5])); im.setMatrixAt(i, m4); });
    im.castShadow = shadow; root.add(im);
    // the roof itself, with a skylight strip in every other bay
    for (let i = 0; i < nb; i++) {
      const zc = z0 + 0.5 + (i + 0.5) * bz, sky = i % 2 === 1 && zc > z0 + HG_RD + 2;
      if (sky) { const sw = bz * 0.42; quad(W, sw, pane('up'), 0, H + 0.06, zc, 0, Math.PI / 2, false); A.skylights = (A.skylights || []).concat([[zc, sw]]);
        for (const s of [-1, 1]) quad(W, (bz - sw) / 2, mat.roof, 0, H, zc + s * (bz + sw) / 4, 0, Math.PI / 2); }
      else quad(W, bz, mat.roof, 0, H, zc, 0, Math.PI / 2);
    }
    quad(W, 0.5, mat.roof, 0, H, z0 + 0.25, 0, Math.PI / 2); quad(W, 0.5, mat.roof, 0, H, z1 - 0.25, 0, Math.PI / 2);   // end strips that meet the bays, not overlap them
    // the outside of the roof (for the sun's shadows)
    if (shadow) { const top = new T.Mesh(new T.PlaneGeometry(W + 1, D + 1), new T.MeshBasicMaterial({ colorWrite: false, depthWrite: false })); top.rotation.x = -Math.PI / 2; top.position.y = H + 0.5; top.castShadow = false; root.add(top); }
    // the high-bay lamps under the trusses
    const lamps: number[][] = []; for (let i = 0; i < nT; i++) for (let x = x0 + 6; x < x1 - 4; x += 10) lamps.push([x + 2, yb - 0.4, z0 + 0.5 + i * bz]);
    const hm = new T.InstancedMesh(new T.CylinderGeometry(0.28, 0.45, 0.4, 16, 1, true), mat.dark, lamps.length), lm = new T.InstancedMesh(new T.CircleGeometry(0.42, 16), mat.lamp, lamps.length);
    lamps.forEach((p, i) => { m4.compose(P.set(p[0], p[1], p[2]), Q.identity(), S.set(1, 1, 1)); hm.setMatrixAt(i, m4); E.set(Math.PI / 2, 0, 0); Q.setFromEuler(E); m4.compose(P.set(p[0], p[1] - 0.2, p[2]), Q, S.set(1, 1, 1)); lm.setMatrixAt(i, m4); });
    root.add(hm); root.add(lm); A.lamps = lamps;
  }
  // the front: the door header over the opening, and the sliding door leaves, each on its own track
  {
    const ow = W - 2, hh = H - Hd;
    quad(W, hh, mat.liner, 0, Hd + hh / 2, z1, Math.PI); bx(W, 1.2, 1.4, mat.steel, 0, Hd + 0.6, z1 - 0.7);
    for (const s of [-1, 1]) bx(1, Hd, 1, mat.steel, s * (W / 2 - 0.5), Hd / 2, z1 - 0.5);
    const n = Math.max(4, Math.ceil(ow / 11) + (Math.ceil(ow / 11) % 2)), lw = ow / n + 0.3, leaves: any[] = [];
    const frameM = M({ color: 0x55626F, roughness: 0.5, metalness: 0.5 });
    for (let i = 0; i < n; i++) {
      const g = new T.Group(), track = i % 2, xc = -ow / 2 + (i + 0.5) * (ow / n), zc = z1 - 0.35 - track * 0.38;
      g.position.set(xc, 0, zc); root.add(g);
      // the leaf: a steel frame, ribbed cladding, a strip of windows high up, a bottom rail
      const vy0 = Hd * 0.66, vy1 = Hd * 0.66 + Math.min(1.6, Hd * 0.1);
      const cl = (h: number, y: number) => { const o = new T.Mesh(new T.BoxGeometry(lw, h, 0.12), mat.clad); o.position.y = y; o.castShadow = shadow; o.receiveShadow = true; g.add(o); };
      cl(vy0, vy0 / 2); cl(Hd - vy1, vy1 + (Hd - vy1) / 2);
      const pn = new T.Mesh(new T.PlaneGeometry(lw - 0.3, vy1 - vy0), pane('s')); pn.position.set(0, (vy0 + vy1) / 2, 0); pn.rotation.y = Math.PI; g.add(pn);
      for (const y of [0.1, vy0, vy1, Hd - 0.1]) { const o = new T.Mesh(new T.BoxGeometry(lw, 0.2, 0.18), frameM); o.position.y = y; g.add(o); }
      for (const s of [-1, 1]) { const o = new T.Mesh(new T.BoxGeometry(0.2, Hd, 0.18), frameM); o.position.x = s * (lw / 2 - 0.1); o.position.y = Hd / 2; g.add(o); }
      for (let k = 1; k < 4; k++) { const o = new T.Mesh(new T.BoxGeometry(lw, 0.12, 0.16), frameM); o.position.y = vy0 * k / 4; g.add(o); }
      // the small door for people, in the second leaf
      if (i === 1) { const dw = 1.0, dh = 2.15; const fr = new T.Mesh(new T.BoxGeometry(dw + 0.1, dh + 0.05, 0.16), M({ color: 0x2E5C8A, roughness: 0.5 })); fr.position.set(0, dh / 2, -0.03); g.add(fr);
        const hd = new T.Mesh(new T.BoxGeometry(0.16, 0.03, 0.05), mat.metal); hd.position.set(0.35, 1.05, -0.12); g.add(hd);
        const sign = new T.Mesh(new T.PlaneGeometry(0.4, 0.12), new T.MeshBasicMaterial({ color: 0x1FA36B, toneMapped: false })); sign.position.set(0, dh + 0.2, -0.12); sign.rotation.y = Math.PI; g.add(sign);
        const hit = new T.Mesh(new T.BoxGeometry(dw, dh, 0.5), new T.MeshBasicMaterial({ visible: false })); hit.position.set(0, dh / 2, -0.2); hit.userData.act = 'door'; hit.userData.keep = true; g.add(hit); A.hits.push(hit); }
      // where it slides to when the doors open: into the end of the opening on its own side, behind the others
      const side = xc < 0 ? -1 : 1, rank = side < 0 ? i : n - 1 - i;
      g.userData.x0 = xc; g.userData.x1 = side * (W / 2 + lw / 2 + 0.4 + rank * 0.25);
      leaves.push(g);
    }
    A.doorLeaves = leaves; A.doorK = 0;
    block(x0, z1 - 1.25, x1, z1 + 1);
  }
  // the building so far (floor markings, walls, windows, columns, roof, lamps, doors) is the hangar's shell: a model
  // file of the same size goes in its place if there is one (hangars/hangar-large.glb …; on the PC a -pc file first)
  { const shell = new T.Group(); shell.name = 'hangar-shell';
    for (const o of root.children.slice()) shell.add(o);
    root.add(shell); A.shell = shell;
    const f = hgShellFile(sz); if (f) { try { Models.swap(shell, f, false); } catch (e) { /* our own building */ } } }
  // the aircraft: your own, nose towards the doors, on the centre line
  {
    const a: any = R.reg ? plane(R.reg) : null, sh: HgShow = R.show, lv = sh ? (sh.used ? liveryFor('#C9D2DE', '#5D6B7E') : liveryFor(co.color, co.color2, co.id)) : (a && a.livery) || liveryFor(co.color, co.color2, co.id);
    let m: any = null; const tid = sh ? sh.typeId : a ? a.typeId : ''; if (tid) try { m = buildAircraftModel(tid, lv); m.userData.set && m.userData.set({ flaps: 0, gear: 1 }); } catch (e) { m = null; }
    if (m) {
      const holder = new T.Group(); holder.add(m); root.add(holder);
      m.traverse((o: any) => { if (o.isMesh) { o.castShadow = shadow; o.receiveShadow = true; } });
      const b = new T.Box3().setFromObject(m), c = b.getCenter(new T.Vector3());
      m.position.set(-c.x, -b.min.y, -c.z); holder.rotation.y = Math.PI / 2;   // its nose (−X) towards the doors (+z)
      const len = b.max.x - b.min.x, zN = z1 - 5.5; holder.position.set(0, 0, zN - len / 2);
      holder.updateMatrixWorld(true); A.ac = holder; A.acBox = new T.Box3().setFromObject(holder);
      const hb = A.acBox; A.acMeshes = []; holder.traverse((o: any) => { if (o.isMesh) A.acMeshes.push(o); });
      const hit = new T.Mesh(new T.BoxGeometry(hb.max.x - hb.min.x, hb.max.y - hb.min.y, hb.max.z - hb.min.z), new T.MeshBasicMaterial({ visible: false })); hit.position.copy(hb.getCenter(new T.Vector3())); hit.userData.act = 'aircraft'; hit.userData.far = 60; root.add(hit); A.hits.push(hit); A.acHit = hit;
    }
  }
  const ab = A.acBox || new T.Box3(new T.Vector3(-15, 0, -10), new T.Vector3(15, 8, z1 - 5.5)), nose = ab.max.z, span = ab.max.x - ab.min.x;
  // things round it: tool trolleys, a work stand at the engine, cones at the wing tips, a tug by the doors
  {
    const trolley = (x: number, z: number, ry: number) => { const g = new T.Group(); g.name = 'tool-trolley'; g.position.set(x, 0, z); g.rotation.y = ry; root.add(g);
      const o = (w: number, h: number, d: number, m: any, X: number, Y: number, Z: number) => { const k = new T.Mesh(new T.BoxGeometry(w, h, d), m); k.position.set(X, Y, Z); k.castShadow = shadow; k.receiveShadow = true; g.add(k); return k; };
      o(0.92, 0.82, 0.48, mat.red, 0, 0.53, 0); for (let i = 0; i < 5; i++) o(0.86, 0.006, 0.01, mat.metal, 0, 0.2 + i * 0.15, 0.245);
      const top = o(0.94, 0.03, 0.5, mat.dark, 0, 0.955, 0); surf(top);
      for (const [X, Z] of [[-0.4, -0.2], [0.4, -0.2], [-0.4, 0.2], [0.4, 0.2]]) o(0.06, 0.12, 0.06, mat.black, X, 0.06, Z);
      o(0.04, 0.04, 0.5, mat.metal, 0.5, 0.9, 0);
      // spanners and a torque wrench on top
      o(0.3, 0.012, 0.03, mat.metal, -0.15, 0.976, 0.08).rotation.y = 0.3; o(0.22, 0.012, 0.025, mat.metal, 0.12, 0.976, -0.1).rotation.y = -0.5;
      block(x - 0.6, z - 0.6, x + 0.6, z + 0.6); hgPropSwap(g, 'tool-trolley'); return g; };
    trolley(2.4, nose + 2.2, 0.2); trolley(-span * 0.22 - 1.5, (ab.min.z + ab.max.z) / 2 + 3, -0.4);
    // the work stand: yellow steps up to a platform at the engine
    { const ex = Math.max(3.2, span * 0.17), ez = (ab.min.z + ab.max.z) / 2 + 1.6, ph = Math.min(1.8, Math.max(0.9, (ab.max.y - ab.min.y) * 0.12)), g = new T.Group(); g.name = 'work-stand'; g.position.set(ex + 1.6, 0, ez); root.add(g);
      const o = (w: number, h: number, d: number, m: any, X: number, Y: number, Z: number) => { const k = new T.Mesh(new T.BoxGeometry(w, h, d), m); k.position.set(X, Y, Z); k.castShadow = shadow; k.receiveShadow = true; g.add(k); return k; };
      const pl = o(1.4, 0.06, 1.2, mat.metal, 0, ph, 0); surf(pl);
      for (const [X, Z] of [[-0.65, -0.55], [0.65, -0.55], [-0.65, 0.55], [0.65, 0.55]]) { o(0.06, ph, 0.06, mat.yellow, X, ph / 2, Z); o(0.05, 1.0, 0.05, mat.yellow, X, ph + 0.5, Z); }
      for (const Z of [-0.55, 0.55]) o(1.4, 0.05, 0.05, mat.yellow, 0, ph + 1.0, Z); o(0.05, 0.05, 1.1, mat.yellow, 0.65, ph + 1.0, 0);
      const st = Math.round(ph / 0.22); for (let i = 0; i < st; i++) o(0.7, 0.04, 0.26, mat.metal, 0.7 + 0.35 + (st - i) * 0.24 - 0.24, (i + 1) * ph / (st + 1), 0);
      for (const Z of [-0.36, 0.36]) { const r = o(0.05, 0.05, 0.05, mat.yellow, 0, 0, Z); r.scale.set(st * 0.25 / 0.05, 1, 1); r.position.set(1.05 + st * 0.12 - 0.12, ph / 2, Z); r.rotation.z = Math.atan2(ph, st * 0.24); }
      block(ex + 0.8, ez - 0.7, ex + 2.4 + st * 0.24, ez + 0.7); hgPropSwap(g, 'work-stand'); }
    // cones at the wing tips and the nose
    const coneM = M({ color: 0xF26A1B, roughness: 0.5 });
    for (const [x, z] of [[ab.min.x - 0.8, (ab.min.z + ab.max.z) / 2 - 2], [ab.max.x + 0.8, (ab.min.z + ab.max.z) / 2 - 2], [-1.2, nose + 0.9], [1.2, nose + 0.9]]) prop('traffic-cone', x, z, 0, () => { add(new T.ConeGeometry(0.17, 0.5, 16), coneM, x, 0.27, z); bx(0.38, 0.03, 0.38, mat.black, x, 0.015, z); });
    // the tug, parked by the doors
    // (the same tug as on the apron, and the same file: vehicles/pushback-tug.glb)
    { let g: any = null; try { g = GV_BUILD['pushback-tug'](); } catch (e) { g = null; }
      if (g) { g.position.set(x1 - 7, 0, z1 - 4.6); root.add(g); g.traverse((o: any) => { if (o.isMesh) { o.castShadow = shadow; o.receiveShadow = true; } }); try { Models.swap(g, 'vehicles/pushback-tug.glb'); } catch (e) { /* the app's own */ } }
      block(x1 - 9.8, z1 - 6.0, x1 - 4.2, z1 - 3.2); }
    // the workbench along the back wall (right of the rooms), with a vice and a pegboard of tools
    { const wx0 = HG_RX1 + 2, wx1 = Math.min(x1 - 2, wx0 + 6), wz = z0 + 0.75;
      prop('workbench', (wx0 + wx1) / 2, wz, 0, () => {
      const top = bx(wx1 - wx0, 0.06, 0.9, mat.oak, (wx0 + wx1) / 2, 0.92, wz); surf(top);
      bx(wx1 - wx0, 0.8, 0.85, mat.steel, (wx0 + wx1) / 2, 0.45, wz);
      bx(wx1 - wx0, 1.4, 0.04, M({ map: ctTex(ctNoise('#C9B48A', 0.15, 12), 3, 1), roughness: 0.9 }), (wx0 + wx1) / 2, 1.75, z0 + 0.36);
      const r = ctRng(13); for (let i = 0; i < 18; i++) bx(0.03 + r() * 0.04, 0.2 + r() * 0.25, 0.02, i % 3 ? mat.metal : mat.red, wx0 + 0.3 + r() * (wx1 - wx0 - 0.6), 1.4 + r() * 0.7, z0 + 0.4);
      bx(0.2, 0.14, 0.16, mat.steel, wx0 + 0.4, 1.02, wz + 0.2); });
      block(wx0, z0, wx1, z0 + 1.25);
      // a waste bin at its end
      prop('waste-bin', wx1 + 0.6, z0 + 0.9, 0, () => hgBin(add, wx1 + 0.6, z0 + 0.9, 0x2F6B4A)); block(wx1 + 0.3, z0 + 0.6, wx1 + 0.9, z0 + 1.2); }
    // a fire extinguisher on its stand by each side wall
    for (const s of [-1, 1]) prop('fire-extinguisher', s * (W / 2 - 1.0), 0, -s * Math.PI / 2, () => { add(new T.CylinderGeometry(0.09, 0.09, 0.6, 14), mat.red, s * (W / 2 - 1.0), 0.45, 0); bx(0.3, 0.12, 0.3, mat.dark, s * (W / 2 - 1.0), 0.06, 0); });
  }
  // the rooms along the back wall
  hgRooms(A, mat, add, bx, quad, surf, block, pane, prop);
  return A;
}

/** The maintenance office and the break room: walls with doors and windows to the hangar, a ceiling, lights. */
function hgRooms(A: any, mat: any, add: any, bx: any, quad: any, surf: any, block: any, pane: any, prop: any) {
  const R = HangarRoom, T = THREE, D = R.sz.D, z0 = -D / 2, zf = z0 + HG_RD, H = HG_RH, q = R.q;
  // floors and ceilings
  for (const [xa, xb, m] of [[HG_RX0, HG_RXM, mat.vinyl], [HG_RXM, HG_RX1, mat.vinyl2]] as any[]) {
    const f = quad(xb - xa, HG_RD, m, (xa + xb) / 2, 0.006, (z0 + zf) / 2, 0, -Math.PI / 2, false); surf(f); f.userData.floor = true;
    quad(xb - xa, HG_RD, mat.ceiling, (xa + xb) / 2, H, (z0 + zf) / 2, 0, Math.PI / 2);
  }
  // the room block's roof (a store above, with a railing), seen from the hangar
  bx(HG_RX1 - HG_RX0 + 0.3, 0.3, HG_RD + 0.15, mat.steel, (HG_RX0 + HG_RX1) / 2, H + 0.15, (z0 + zf) / 2);
  for (let x = HG_RX0; x <= HG_RX1 + 0.01; x += 1.6) bx(0.05, 1.1, 0.05, mat.yellow, x, H + 0.85, zf - 0.05);
  bx(HG_RX1 - HG_RX0, 0.06, 0.06, mat.yellow, (HG_RX0 + HG_RX1) / 2, H + 1.4, zf - 0.05);
  // walls: the front one (to the hangar) with a door and a window for each room, the side walls, the wall between
  const wall = (xa: number, xb: number, z: number, holes: number[][]) => {   // holes: [x0, x1, y0, y1]
    const t = 0.14, segs: number[][] = []; let x = xa;
    const hs = holes.slice().sort((a, b) => a[0] - b[0]);
    for (const h of hs) { if (h[0] > x) segs.push([x, h[0], 0, H]); segs.push([h[0], h[1], 0, h[2]]); segs.push([h[0], h[1], h[3], H]); x = h[1]; }
    if (x < xb) segs.push([x, xb, 0, H]);
    for (const s of segs) if (s[1] - s[0] > 0.01 && s[3] - s[2] > 0.01) bx(s[1] - s[0], s[3] - s[2], t, mat.wallIn, (s[0] + s[1]) / 2, (s[2] + s[3]) / 2, z);
  };
  const doors: number[][] = [], wins: number[][] = [];
  for (const [xa, xb] of [[HG_RX0, HG_RXM], [HG_RXM, HG_RX1]]) { const dc = xb - 1.4; doors.push([dc - 0.55, dc + 0.55, 2.15, H]); wins.push([xa + 1.2, xa + 4.6, 1.0, 2.2]); }
  wall(HG_RX0, HG_RX1, zf, doors.concat(wins));
  for (const w of wins) { const g = new T.Mesh(new T.PlaneGeometry(w[1] - w[0], w[3] - w[2]), mat.glass); g.position.set((w[0] + w[1]) / 2, (w[2] + w[3]) / 2, zf); g.renderOrder = 3; A.root.add(g); bx(w[1] - w[0] + 0.1, 0.06, 0.24, mat.steel, (w[0] + w[1]) / 2, w[2] - 0.03, zf); }
  for (const d of doors) { bx(0.08, 2.2, 0.2, mat.steel, d[0] - 0.04, 1.1, zf); bx(0.08, 2.2, 0.2, mat.steel, d[1] + 0.04, 1.1, zf); bx(d[1] - d[0] + 0.16, 0.08, 0.2, mat.steel, (d[0] + d[1]) / 2, 2.19, zf);
    // the door: a steel leaf on its hinges (props/door-1), shut until you open it; it opens into the room
    const k = doors.indexOf(d), pv = new T.Group(); pv.position.set(d[0] + 0.01, 0, zf); A.root.add(pv);
    const leaf = Props.place(pv, 'door-1', 0, 0, 0, q, { w: d[1] - d[0] - 0.02, h: 2.13, color: k ? 0x8A2F2A : 0x2E5C8A });
    const hit = new T.Mesh(new T.BoxGeometry(d[1] - d[0], 2.1, 0.3), new T.MeshBasicMaterial({ visible: false })); hit.position.set((d[1] - d[0]) / 2, 1.05, 0); hit.userData.act = 'rdoor'; hit.userData.i = k; pv.add(hit); A.hits.push(hit); void leaf;
    const blk = [d[0], zf - 0.1, d[1], zf + 0.1]; A.blocks.push(blk);
    (A.rdoors = A.rdoors || []).push({ pv, k: 0, to: 0, blk, d });
    // the room's sign beside its door, on the hangar side (airport style)
    const sg = Props.place(A.root, 'room-sign', d[1] + 0.36, zf + 0.075, 0, q, k ? { name: 'Break room', sub: 'Staff rest area', num: 'H.02', pict: 'break', staff: true } : { name: 'Maintenance\noffice', sub: 'Engineering', num: 'H.01', pict: 'tools', staff: true }, 1.25); void sg; }
  // room signs over the doors
  const sign = (text: string, x: number) => { const [c, x2] = ctCanvas(512, 96); x2.fillStyle = '#12304E'; x2.fillRect(0, 0, 512, 96); x2.fillStyle = '#FFFFFF'; x2.font = '700 44px Inter, Arial, sans-serif'; x2.textAlign = 'center'; x2.textBaseline = 'middle'; x2.fillText(text, 256, 50);
    const o = new T.Mesh(new T.PlaneGeometry(1.6, 0.3), new T.MeshBasicMaterial({ map: ctTex(c) })); o.position.set(x, 2.55, zf + 0.08); A.root.add(o); };
  sign('MAINTENANCE OFFICE', doors[0][0] + 0.55); sign('BREAK ROOM', doors[1][0] + 0.55);
  for (const x of [HG_RX0, HG_RXM, HG_RX1]) bx(0.14, H, HG_RD, mat.wallIn, x, H / 2, (z0 + zf) / 2);
  // walking: the front wall (but its doors), the side walls
  const t = 0.3; let x = HG_RX0 - t;
  for (const d of doors) { block(x, zf - t, d[0], zf + t); x = d[1]; } block(x, zf - t, HG_RX1 + t, zf + t);
  for (const xx of [HG_RX0, HG_RXM, HG_RX1]) block(xx - t, z0, xx + t, zf);
  // the rooms' own back wall, in front of the building's columns, with a deep window through it in each room
  const zb = z0 + 0.62;
  wall(HG_RX0, HG_RX1, zb, [[HG_RX0 + 0.5, HG_RX0 + 2.3, 1.0, 2.2], [HG_RXM + 0.8, HG_RXM + 3.2, 1.35, 2.35]]);
  for (const w of [[HG_RX0 + 0.5, HG_RX0 + 2.3, 1.0, 2.2], [HG_RXM + 0.8, HG_RXM + 3.2, 1.35, 2.35]]) { const cx = (w[0] + w[1]) / 2, cz = (z0 + zb) / 2, d = zb - z0;
    for (const sx of [w[0], w[1]]) bx(0.02, w[3] - w[2], d, mat.wallIn, sx, (w[2] + w[3]) / 2, cz); bx(w[1] - w[0], 0.02, d, mat.wallIn, cx, w[3], cz); bx(w[1] - w[0], 0.04, d, mat.wallIn, cx, w[2], cz); }
  // windows to the outside on the back wall, one in each room
  quad(1.8, 1.2, pane('n'), HG_RX0 + 1.4, 1.6, z0 + 0.04, 0, 0, false); bx(1.9, 0.08, 0.2, mat.steel, HG_RX0 + 1.4, 0.98, z0 + 0.1);
  quad(2.4, 1.0, pane('n'), HG_RXM + 2.0, 1.85, z0 + 0.04, 0, 0, false); bx(2.5, 0.08, 0.2, mat.steel, HG_RXM + 2.0, 1.33, z0 + 0.1);
  // the lights: a panel light in each room
  for (const xc of [(HG_RX0 + HG_RXM) / 2, (HG_RXM + HG_RX1) / 2]) {
    for (const dz of [-1.4, 1.4]) { const p = new T.Mesh(new T.PlaneGeometry(1.2, 0.6), mat.lamp); p.rotation.x = Math.PI / 2; p.position.set(xc, H - 0.01, (z0 + zf) / 2 + dz); A.root.add(p); }
    const L = new T.PointLight(0xFFF2E0, 6, 9, 1.6); L.position.set(xc, H - 0.3, (z0 + zf) / 2); A.root.add(L);
  }
  /* --- the maintenance office: the work table with the monitor, keyboard and mouse; the work board; manuals --- */
  { const xc = (HG_RX0 + HG_RXM) / 2, tz = z0 + 1.6;
    prop('office-desk', xc, tz, 0, () => { const top = bx(2.2, 0.045, 0.85, mat.oak, xc, 0.75, tz); surf(top);
      for (const sx of [-1, 1]) { bx(0.06, 0.73, 0.75, mat.black, xc + sx * 1.0, 0.365, tz); } });
    block(xc - 1.2, tz - 0.6, xc + 1.2, tz + 0.5);
    hgMonitor(A, xc, tz);
    // the chair
    { const g = new T.Group(); g.name = 'office-chair'; g.position.set(xc, 0, tz + 0.9); g.rotation.y = Math.PI; A.root.add(g);
      const leather = new T.MeshStandardMaterial({ color: 0x1E1E22, roughness: 0.5 });
      const s = new T.Mesh(new T.BoxGeometry(0.52, 0.09, 0.5), leather); s.position.y = 0.5; g.add(s);
      const b = new T.Mesh(new T.BoxGeometry(0.5, 0.65, 0.08), leather); b.position.set(0, 0.88, -0.25); b.rotation.x = -0.1; g.add(b);
      const p = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 0.4, 10), mat.metal); p.position.y = 0.28; g.add(p);
      for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283, l = new T.Mesh(new T.BoxGeometry(0.3, 0.03, 0.04), mat.metal); l.position.set(Math.cos(a) * 0.15, 0.06, Math.sin(a) * 0.15); l.rotation.y = -a; g.add(l); }
      g.traverse((o: any) => { if (o.isMesh) { o.castShadow = q >= 1; o.receiveShadow = true; } }); hgPropSwap(g, 'office-chair'); block(xc - 0.3, tz + 0.6, xc + 0.3, tz + 1.2);
      prop('waste-bin', xc + 1.45, tz + 0.1, 0, () => hgBin(add, xc + 1.45, tz + 0.1, 0x3A3F46)); block(xc + 1.25, tz - 0.1, xc + 1.65, tz + 0.3); }
    // the work board on the side wall: what is being done on the aircraft in here
    { const c = hgBoard(R.reg); A.boardCv = c; const b = new T.Mesh(new T.PlaneGeometry(2.4, 1.5), new T.MeshStandardMaterial({ map: ctTex(c), roughness: 0.4 })); b.position.set(HG_RX0 + 0.09, 1.55, (z0 + zf) / 2 + 0.3); b.rotation.y = Math.PI / 2; A.root.add(b);
      bx(0.04, 1.58, 2.48, mat.metal, HG_RX0 + 0.08, 1.55, (z0 + zf) / 2 + 0.3); }
    // a shelf of manuals by the door
    { const sx = HG_RXM - 0.3, sz2 = z0 + 3.4, r = ctRng(31), cols = [0x2E4F7A, 0x8A2E2E, 0x2F6B4A, 0xB8862E, 0x3A3F46];
      prop('bookshelf', sx, sz2, -Math.PI / 2, () => {
      for (const y of [0.4, 0.9, 1.4, 1.9]) { bx(0.4, 0.03, 1.6, mat.steel, sx, y, sz2); let z = sz2 - 0.75; while (z < sz2 + 0.72) { const w = 0.05 + r() * 0.03, h = 0.3 + r() * 0.12; bx(0.28, h, w, new T.MeshStandardMaterial({ color: cols[Math.floor(r() * cols.length)], roughness: 0.6 }), sx, y + 0.015 + h / 2, z + w / 2); z += w + 0.004; } }
      for (const dz of [-0.8, 0.8]) bx(0.4, 2.1, 0.03, mat.steel, sx, 1.05, sz2 + dz); });
      block(sx - 0.3, sz2 - 0.85, sx + 0.3, sz2 + 0.85); }
  }
  /* --- the break room: the vending machine, a counter with a sink and a coffee machine, a table and chairs --- */
  { const xa = HG_RXM, xb = HG_RX1;
    // the counter along the back wall
    const cx0 = xa + 0.3, cx1 = xb - 1.6;
    const cz = z0 + 1.0;
    prop('kitchen-counter', (cx0 + cx1) / 2, cz, 0, () => { const ctop = bx(cx1 - cx0, 0.04, 0.62, new T.MeshStandardMaterial({ color: 0xE9E4DA, roughness: 0.35 }), (cx0 + cx1) / 2, 0.92, cz); surf(ctop);
    bx(cx1 - cx0, 0.88, 0.58, new T.MeshStandardMaterial({ color: 0x3C5A72, roughness: 0.6 }), (cx0 + cx1) / 2, 0.45, cz);
    for (let x = cx0 + 0.6; x < cx1; x += 0.6) bx(0.012, 0.8, 0.005, mat.dark, x, 0.46, cz + 0.295);
    });
    prop('sink', cx0 + 0.6, cz - 0.02, 0, () => { bx(0.5, 0.012, 0.4, mat.metal, cx0 + 0.6, 0.945, cz - 0.02); add(new T.CylinderGeometry(0.015, 0.015, 0.3, 8), mat.metal, cx0 + 0.6, 1.08, cz - 0.22); });
    // the coffee machine and a few mugs
    Props.place(A.root, 'coffee-machine-1', cx1 - 0.4, cz - 0.08, 0, R.q, {}, 0.94);
    for (let i = 0; i < 3; i++) prop('coffee-mug', cx1 - 1.0 + i * 0.13, cz + 0.06, 0, () => { const mm = new T.MeshStandardMaterial({ color: [0xF4F4F2, 0x2E5C8A, 0xB3261E][i], roughness: 0.3 }); add(new T.CylinderGeometry(0.04, 0.035, 0.095, 16), mm, cx1 - 1.0 + i * 0.13, 0.988, cz + 0.06); const h = new T.Mesh(new T.TorusGeometry(0.025, 0.007, 8, 16, Math.PI), mm); h.position.set(cx1 - 1.0 + i * 0.13 + 0.04, 0.99, cz + 0.06); h.rotation.z = -Math.PI / 2; A.root.add(h); });
    for (let i = 0; i < 2; i++) prop('drinking-glass', cx1 - 1.5 + i * 0.1, cz + 0.1, 0, () => { const gl = new T.Mesh(new T.CylinderGeometry(0.035, 0.03, 0.11, 18, 1, true), new T.MeshPhysicalMaterial({ color: 0xE8F2FA, roughness: 0.05, transparent: true, opacity: 0.35, side: T.DoubleSide, depthWrite: false })); gl.position.set(cx1 - 1.5 + i * 0.1, 0.995, cz + 0.1); A.root.add(gl); });
    prop('waste-bin', xa + 0.45, z0 + 1.75, 0, () => hgBin(add, xa + 0.45, z0 + 1.75, 0x3C5A72)); block(xa + 0.2, z0 + 1.5, xa + 0.7, z0 + 2.0);
    block(cx0, z0, cx1, cz + 0.38);
    // the table and four chairs
    const tx = (xa + xb) / 2 - 0.4, tz = z0 + 3.4;
    prop('break-room-table', tx, tz, 0, () => { const tt = bx(1.4, 0.04, 0.9, new T.MeshStandardMaterial({ color: 0xEDEDE8, roughness: 0.4 }), tx, 0.74, tz); surf(tt);
      for (const [dx, dz] of [[-0.62, -0.38], [0.62, -0.38], [-0.62, 0.38], [0.62, 0.38]]) bx(0.04, 0.72, 0.04, mat.metal, tx + dx, 0.36, tz + dz); });
    for (const [dx, dz, ry] of [[-0.35, -0.75, 0], [0.35, -0.75, 0], [-0.35, 0.75, Math.PI], [0.35, 0.75, Math.PI]]) { const g = new T.Group(); g.name = 'break-room-chair'; g.position.set(tx + dx, 0, tz + dz); g.rotation.y = ry; A.root.add(g);
      const sm = new T.MeshStandardMaterial({ color: 0xC0392B, roughness: 0.5 }); const s = new T.Mesh(new T.BoxGeometry(0.42, 0.04, 0.42), sm); s.position.y = 0.46; g.add(s); const b = new T.Mesh(new T.BoxGeometry(0.42, 0.4, 0.03), sm); b.position.set(0, 0.7, -0.2); g.add(b);
      for (const [lx, lz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) { const l = new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 0.46, 8), mat.metal); l.position.set(lx, 0.23, lz); g.add(l); } hgPropSwap(g, 'break-room-chair'); }
    block(tx - 0.8, tz - 1.0, tx + 0.8, tz + 1.0);
    // a poster: drawn by us
    { const [c, x] = ctCanvas(384, 512); x.fillStyle = '#F2D18A'; x.fillRect(0, 0, 384, 512); x.fillStyle = '#12304E'; x.font = '800 54px Inter, Arial, sans-serif'; x.textAlign = 'center'; x.fillText('TAKE', 192, 140); x.fillText('A BREAK', 192, 210); x.font = '600 26px Inter, Arial, sans-serif'; x.fillText('Rested hands', 192, 330); x.fillText('make safe aircraft', 192, 368);
      x.strokeStyle = '#12304E'; x.lineWidth = 10; x.strokeRect(20, 20, 344, 472); const o = new T.Mesh(new T.PlaneGeometry(0.6, 0.8), new T.MeshStandardMaterial({ map: ctTex(c), roughness: 0.6 })); o.position.set(xa + 0.09, 1.6, z0 + 3.4); o.rotation.y = Math.PI / 2; A.root.add(o); }
    // the vending machine, in the corner by the back wall
    hgVendBuild(A, xb - 0.75, z0 + 1.12);
  }
  function M2(c: number) { return new T.MeshStandardMaterial({ color: c, roughness: 0.4 }); }
}

/** A model file in place of one piece of equipment or furniture (hangar-props/<name>.glb), if there is one. Surfaces
 *  you can put things on keep working: they are still found where the app's own top was. */
function hgPropSwap(g: any, name: string) { try { Models.swap(g, 'hangar-props/' + name + '.glb', false); } catch (e) { /* the app's own */ } }
/** A waste bin: a round bin with a pedal and a lid. */
function hgBin(add: any, x: number, z: number, col: number) {
  const T = THREE, m = new T.MeshStandardMaterial({ color: col, roughness: 0.45, metalness: 0.2 }), dark = new T.MeshStandardMaterial({ color: 0x1E2126, roughness: 0.6 });
  add(new T.CylinderGeometry(0.16, 0.14, 0.5, 20), m, x, 0.26, z); add(new T.CylinderGeometry(0.165, 0.165, 0.03, 20), dark, x, 0.525, z); add(new T.BoxGeometry(0.1, 0.02, 0.06), dark, x, 0.03, z + 0.17);
}
/** The monitor on the work table: the same ultra-wide screen as in the Operations office, showing the same. */
function hgMonitor(A: any, xc: number, tz: number) {
  const T = THREE, R = HangarRoom, root = A.root, black = new T.MeshStandardMaterial({ color: 0x15171B, roughness: 0.4 }), metal = new T.MeshStandardMaterial({ color: 0x5D636B, metalness: 0.85, roughness: 0.35 });
  const r = 1.25, wA = 1.08, hA = 0.32, L = wA / r, y0 = 1.12, zc = tz - 0.05 + r;
  const sg = new T.CylinderGeometry(r, r, hA, 48, 1, true, Math.PI - L / 2, L); const uv = sg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
  const MW = DESKTOP ? 4096 : 2560, [c] = ctCanvas(MW, Math.round(MW * hA / wA)); A.monCv = c; const tex = ctTex(c); A.monTex = tex;
  try { tex.anisotropy = R.ren ? Math.min(16, R.ren.capabilities.getMaxAnisotropy()) : 8; } catch (e) { /* default */ }
  const scr = new T.Mesh(sg, new T.MeshBasicMaterial({ map: tex, toneMapped: false, side: T.DoubleSide })); scr.position.set(xc, y0, zc); root.add(scr); A.monScr = scr;
  try { const glass = new T.Mesh(new T.CylinderGeometry(r - 0.004, r - 0.004, hA + 0.006, 64, 1, true, Math.PI - (L + 0.004) / 2, L + 0.004), roomGlassMat(T, 0.12)); glass.position.set(xc, y0, zc); glass.renderOrder = 2; root.add(glass); } catch (e) { /* no glass */ }
  const back = new T.Mesh(new T.CylinderGeometry(r + 0.03, r + 0.03, hA + 0.03, 48, 1, true, Math.PI - (L + 0.03) / 2, L + 0.03), new T.MeshStandardMaterial({ color: 0x0E1013, roughness: 0.35, side: T.DoubleSide })); back.position.set(xc, y0, zc); root.add(back);
  const st = new T.Mesh(new T.BoxGeometry(0.08, 0.28, 0.05), metal); st.position.set(xc, 0.93, tz - 0.12); root.add(st);
  const ft = new T.Mesh(new T.BoxGeometry(0.36, 0.012, 0.22), metal); ft.position.set(xc, 0.778, tz - 0.1); root.add(ft);
  // the keyboard and the mouse on its mat
  const kbG = new T.Group(); kbG.name = 'keyboard'; kbG.position.set(xc - 0.05, 0, tz + 0.2); root.add(kbG);
  const kb = new T.Mesh(new T.BoxGeometry(0.44, 0.02, 0.14), black); kb.position.set(0, 0.783, 0); kbG.add(kb);
  const km = new T.Mesh(new T.PlaneGeometry(0.42, 0.12), new T.MeshStandardMaterial({ map: ctTex(hgKeys()), roughness: 0.6 })); km.rotation.x = -Math.PI / 2; km.position.set(0, 0.7935, 0); kbG.add(km); hgPropSwap(kbG, 'keyboard');
  const pad = new T.Mesh(new T.PlaneGeometry(0.26, 0.22), new T.MeshStandardMaterial({ color: 0x1B2028, roughness: 0.95 })); pad.rotation.x = -Math.PI / 2; pad.position.set(xc + 0.42, 0.7735, tz + 0.2); root.add(pad);
  const mouse = new T.Mesh(new T.SphereGeometry(1, 24, 16), new T.MeshStandardMaterial({ color: 0x1A1C20, roughness: 0.3 })); mouse.scale.set(0.032, 0.019, 0.058); const msG = new T.Group(); msG.name = 'computer-mouse'; msG.position.set(xc + 0.42, 0, tz + 0.21); root.add(msG); mouse.position.set(0, 0.776, 0); msG.add(mouse); hgPropSwap(msG, 'computer-mouse');
  const glow = new T.PointLight(0x9CC8FF, 0.8, 2.4, 1.6); glow.position.set(xc, 1.12, tz + 0.2); root.add(glow);
  const hit = new T.Mesh(new T.BoxGeometry(1.2, 0.6, 0.6), new T.MeshBasicMaterial({ visible: false })); hit.position.set(xc, 1.0, tz); hit.userData.act = 'monitor'; root.add(hit); A.hits.push(hit);
  // the corners of the screen, for the zoom into it
  A.monEye = new T.Vector3(xc, 1.2, tz + 0.62); A.monAt = new T.Vector3(xc, 1.1, tz - 0.05);
  A.monRect = [[xc - 0.54, y0 + 0.16, tz + 0.12], [xc + 0.54, y0 + 0.16, tz + 0.12], [xc - 0.54, y0 - 0.16, tz + 0.12], [xc + 0.54, y0 - 0.16, tz + 0.12], [xc, y0 + 0.16, tz - 0.05], [xc, y0 - 0.16, tz - 0.05]];
}
function hgKeys(): HTMLCanvasElement {
  const [c, x] = ctCanvas(512, 146); x.fillStyle = '#16181C'; x.fillRect(0, 0, 512, 146);
  const u = 22.4; const rows = [[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2], [1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5], [1.8, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.2], [2.3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.7], [1.3, 1.3, 1.3, 6.2, 1.3, 1.3, 1.3, 1.3]];
  rows.forEach((r, ri) => { let X = 6; r.forEach(w => { x.fillStyle = '#2A2D33'; x.fillRect(X + 1.5, 6 + ri * 27 + 1.5, w * u - 3, 24); X += w * u; }); });
  for (let ri = 0; ri < 5; ri++) for (let k = 0; k < 4; k++) { x.fillStyle = '#2A2D33'; x.fillRect(418 + k * u + 1.5, 6 + ri * 27 + 1.5, u - 3, 24); }
  return c;
}

/* ---------- the vending machine ---------- */
/** The room whose vending machine is in use: the hangar's break room, or the lounge (the same machine). */
let HG_VR: any = null;
function hgVR(): any { return HG_VR || HangarRoom; }
function hgVendBuild(A: any, x: number, z: number, ry?: number) {
  const T = THREE, R = hgVR(), q = R.q == null ? 1 : R.q, g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = ry || 0; A.root.add(g);
  const Wm = 0.95, Hm = 1.85, Dm = 0.8;
  const body = new T.MeshStandardMaterial({ color: 0x1F2A36, roughness: 0.45, metalness: 0.3 }), trim = new T.MeshStandardMaterial({ color: 0xB9C2CC, roughness: 0.3, metalness: 0.8 });
  const o = (w: number, h: number, d: number, m: any, X: number, Y: number, Z: number, par?: any) => { const k = new T.Mesh(new T.BoxGeometry(w, h, d), m); k.position.set(X, Y, Z); k.castShadow = q >= 1; k.receiveShadow = true; (par || g).add(k); return k; };
  // the cabinet (open at the front behind the glass), the inside lit
  o(Wm, Hm, 0.04, body, 0, Hm / 2, -Dm / 2 + 0.02); for (const s of [-1, 1]) o(0.04, Hm, Dm, body, s * (Wm / 2 - 0.02), Hm / 2, 0);
  const tp = o(Wm, 0.04, Dm, body, 0, Hm - 0.02, 0); if (A.surfs) A.surfs.push(tp); o(Wm, 0.1, Dm, body, 0, 0.05, 0);
  const gx0 = -Wm / 2 + 0.05, gx1 = 0.2, inner = new T.MeshStandardMaterial({ color: 0xDDE4EA, roughness: 0.6, emissive: 0x404850, emissiveIntensity: 0.6 });
  o(gx1 - gx0, Hm - 0.62, 0.01, inner, (gx0 + gx1) / 2, 0.52 + (Hm - 0.62) / 2, -Dm / 2 + 0.05);
  // the right panel: the display, the keypad and the coin slot
  o(Wm / 2 - gx1 - 0.02, Hm - 0.1, 0.04, body, (gx1 + Wm / 2) / 2, Hm / 2, Dm / 2 - 0.02);
  o(gx1 - gx0, 0.42, 0.04, body, (gx0 + gx1) / 2, 0.31, Dm / 2 - 0.02);   // under the glass, round the tray
  const [dc] = ctCanvas(256, 96); A.vendCv = dc; const dt = ctTex(dc); A.vendTex = dt;
  const disp = new T.Mesh(new T.PlaneGeometry(0.2, 0.075), new T.MeshBasicMaterial({ map: dt, toneMapped: false })); disp.position.set(0.335, 1.42, Dm / 2 + 0.002); g.add(disp);
  { const [kc, kx] = ctCanvas(128, 160); kx.fillStyle = '#2B3540'; kx.fillRect(0, 0, 128, 160); kx.font = '700 22px Inter, Arial, sans-serif'; kx.textAlign = 'center'; kx.textBaseline = 'middle';
    ['A', 'B', 'C', '1', '2', '3', '4', '5', '6', '7', '8', '9'].forEach((k, i) => { const cx = 22 + (i % 3) * 42, cy = 20 + Math.floor(i / 3) * 40; kx.fillStyle = '#C9D1D9'; kx.fillRect(cx - 17, cy - 15, 34, 30); kx.fillStyle = '#1B232C'; kx.fillText(k, cx, cy + 1); });
    const kp = new T.Mesh(new T.PlaneGeometry(0.16, 0.2), new T.MeshStandardMaterial({ map: ctTex(kc), roughness: 0.5 })); kp.position.set(0.335, 1.18, Dm / 2 + 0.002); g.add(kp); }
  o(0.05, 0.1, 0.01, trim, 0.335, 0.98, Dm / 2 + 0.005); o(0.16, 0.06, 0.03, trim, 0.335, 0.62, Dm / 2 + 0.01);
  // the name on top, our own
  { const [nc, nx] = ctCanvas(512, 96); const gr = nx.createLinearGradient(0, 0, 512, 0); gr.addColorStop(0, '#E8522E'); gr.addColorStop(1, '#F2B544'); nx.fillStyle = gr; nx.fillRect(0, 0, 512, 96); nx.fillStyle = '#FFFFFF'; nx.font = '800 50px Inter, Arial, sans-serif'; nx.textAlign = 'center'; nx.textBaseline = 'middle'; nx.fillText('SNACKS & DRINKS', 256, 50);
    const nm = new T.Mesh(new T.PlaneGeometry(Wm - 0.06, 0.13), new T.MeshBasicMaterial({ map: ctTex(nc), toneMapped: false })); nm.position.set(0, Hm - 0.1, Dm / 2 + 0.002); g.add(nm); }
  // the shelves: three rows of three coils, a product in front on each and more behind
  const slots: any[] = [], cw = (gx1 - gx0) / 3, shelfY = [1.42, 1.08, 0.74];
  const coilGeo = (() => { const pts: any[] = []; for (let i = 0; i <= 160; i++) { const t = i / 160, a = t * Math.PI * 2 * 7; pts.push(new T.Vector3(Math.cos(a) * cw * 0.34, Math.sin(a) * cw * 0.34, -0.3 + t * 0.58)); } return new T.TubeGeometry(new T.CatmullRomCurve3(pts), 220, 0.0025, 5, false); })();
  HG_PRODUCTS.forEach((p, i) => {
    const r = Math.floor(i / 3), c = i % 3, sx = gx0 + cw * (c + 0.5), sy = shelfY[r];
    o(cw - 0.01, 0.012, Dm - 0.12, trim, sx, sy - 0.006, -0.02);
    const coil = new T.Mesh(coilGeo, trim); coil.position.set(sx, sy + cw * 0.34 + 0.01, 0.02); g.add(coil);
    const items: any[] = [];
    for (let k = 0; k < 4; k++) {
      const it = hgItemMesh(p.k, 0, 1); const zz = 0.24 - k * 0.14;
      if (p.type === 'bar') { it.position.set(sx, sy + HG_BAR.l / 2 + 0.005, zz); }
      else { it.position.set(sx, sy + HG_CAN.h / 2 + 0.004, zz); }
      g.add(it); items.push(it);
    }
    // the price tag under each: a code and the name
    const [tc, tx] = ctCanvas(256, 64); tx.fillStyle = '#F4F4F0'; tx.fillRect(0, 0, 256, 64); tx.fillStyle = '#1B232C'; tx.font = '700 26px Inter, Arial, sans-serif'; tx.fillText(`${'ABC'[r]}${c + 1}`, 10, 40); tx.font = '600 20px Inter, Arial, sans-serif'; tx.fillText(p.name, 60, 40);
    const tag = new T.Mesh(new T.PlaneGeometry(cw - 0.02, 0.025), new T.MeshBasicMaterial({ map: ctTex(tc) })); tag.position.set(sx, sy - 0.022, Dm / 2 - 0.08); g.add(tag);
    slots.push({ k: p.k, code: `${'ABC'[r]}${c + 1}`, x: sx, y: sy, z0: 0.24, gap: 0.14, coil, items });
  });
  // the glass front
  const gl = new T.Mesh(new T.PlaneGeometry(gx1 - gx0, Hm - 0.62), new T.MeshPhysicalMaterial({ color: 0xDDEEFF, roughness: 0.04, transmission: 0, transparent: true, opacity: 0.16, depthWrite: false, metalness: 0.1 })); gl.position.set((gx0 + gx1) / 2, 0.52 + (Hm - 0.62) / 2, Dm / 2 - 0.035); gl.renderOrder = 4; g.add(gl);
  o(gx1 - gx0 + 0.02, 0.02, 0.03, trim, (gx0 + gx1) / 2, 0.51, Dm / 2 - 0.03); o(gx1 - gx0 + 0.02, 0.02, 0.03, trim, (gx0 + gx1) / 2, Hm - 0.1, Dm / 2 - 0.03);
  // the tray at the bottom, behind a flap that swings in
  o(gx1 - gx0 - 0.06, 0.012, 0.3, new T.MeshStandardMaterial({ color: 0x0E1217, roughness: 0.7 }), (gx0 + gx1) / 2, 0.14, Dm / 2 - 0.18);
  const flapH = new T.Group(); flapH.position.set((gx0 + gx1) / 2, 0.42, Dm / 2 + 0.005); g.add(flapH);
  const flap = new T.Mesh(new T.BoxGeometry(gx1 - gx0 - 0.08, 0.2, 0.01), new T.MeshPhysicalMaterial({ color: 0x2A3440, roughness: 0.2, transparent: true, opacity: 0.85 })); flap.position.y = -0.1; flapH.add(flap);
  const fh = new T.Mesh(new T.BoxGeometry(0.16, 0.02, 0.02), trim); fh.position.set(0, -0.18, 0.015); flapH.add(fh);
  // a light inside
  const L = new T.PointLight(0xEAF4FF, 0.9, 1.6, 2); L.position.set((gx0 + gx1) / 2, 1.5, 0.1); g.add(L);
  // what you click: the machine (to choose) and the flap (to take what fell)
  const hit = new T.Mesh(new T.BoxGeometry(Wm, Hm - 0.5, 0.4), new T.MeshBasicMaterial({ visible: false })); hit.position.set(0, 0.5 + (Hm - 0.5) / 2, Dm / 2 - 0.1); hit.userData.act = 'vend'; g.add(hit); A.hits.push(hit);
  const fhit = new T.Mesh(new T.BoxGeometry(gx1 - gx0, 0.3, 0.3), new T.MeshBasicMaterial({ visible: false })); fhit.position.set((gx0 + gx1) / 2, 0.28, Dm / 2 - 0.05); fhit.userData.act = 'flap'; g.add(fhit); A.hits.push(fhit);
  // a model file for the machine, if there is one
  g.updateMatrixWorld(true);
  A.vend = { g, slots, flapH, flap, tray: new T.Vector3((gx0 + gx1) / 2, 0.14, Dm / 2 - 0.2), Dm };
  hgVendFile(A);
  hgVendDisplay('Choose a product', A);
  const side = Math.abs(Math.sin(ry || 0)) > 0.5, hw = (side ? Dm : Wm) / 2 + 0.2, hd = (side ? Wm : Dm) / 2 + 0.22;
  R.blockVend = [x - hw, z - hd, x + hw, z + hd];
  A.blocks.push(R.blockVend);
}
/** The vending machine from a model file (items/vending-machine.glb), with its working parts found by name:
 *   slot-A1 … slot-C3   where each product stands at the front of its shelf (empty nodes; A is the top row, 1 the left)
 *   coil-A1 … coil-C3   the spiral behind each product: turns once round its own Z axis when that product is chosen
 *   flap                the tray's flap: its origin on the hinge (the top edge); it swings in round its X axis
 *   tray                where a product lands (an empty node on the tray's floor)
 *   display             a flat mesh facing the front: the machine's green text is drawn on it
 *   anything else       the cabinet, glass, keypad … shown as it is
 *  The products themselves stay the app's own (or their own files in items/). Missing parts keep the app's own. */
function hgVendFile(A: any) {
  const path = 'items/vending-machine.glb'; if (!Models.has(path)) return;
  const go = () => {
    const R = hgVR(), T = THREE, V = A.vend; if (R === HangarRoom && (!R.on || R.A !== A && R.Abuild !== A && R.A)) return;
    const g = V.g, o = Models.copy(path); if (!o || g.userData.__swapped) return;
    const isProduct = (m: any) => { let x = m; while (x && x !== g) { if (x.userData.kind) return true; x = x.parent; } return false; };
    const own: any[] = []; g.traverse((m: any) => { if (m.isMesh && !m.userData.act && !isProduct(m)) own.push(m); });
    g.updateMatrixWorld(true);
    const box = new T.Box3(); for (const m of own) box.expandByObject(m); box.applyMatrix4(new T.Matrix4().copy(g.matrixWorld).invert());
    const fitted = Models.fit(o, box, false); fitted.userData.fromFile = path; g.add(fitted); g.updateMatrixWorld(true);
    const parts: any = {}; fitted.traverse((x: any) => { const n = String(x.name || '').toLowerCase().replace(/[\s_]+/g, '-'); if (n && !parts[n]) parts[n] = x; });
    const at = (x: any) => g.worldToLocal(x.getWorldPosition(new T.Vector3()));
    const hide = (o2: any) => { if (o2) o2.traverse((m: any) => { if (m.isMesh) m.layers.set(31); }); };
    // the shelves: the products move to each slot, the file's coil turns
    for (const s of V.slots) {
      const sl = parts['slot-' + s.code.toLowerCase()], co = parts['coil-' + s.code.toLowerCase()];
      if (sl) { const p = at(sl), dx = p.x - s.x, dy = p.y - s.y, dz = p.z - s.z0; s.x = p.x; s.y = p.y; s.z0 = p.z; for (const it of s.items) { it.position.x += dx; it.position.y += dy; it.position.z += dz; } }
      if (co) { hide(s.coil); s.coil = co; co.userData.rz0 = co.rotation.z; }
    }
    // the flap and the tray
    if (parts.flap) { hide(V.flapH); V.flapH = parts.flap; parts.flap.userData.rx0 = parts.flap.rotation.x; }
    if (parts.tray) V.tray = at(parts.tray);
    // the display: our text on its screen
    const d = parts.display; if (d) d.traverse((m: any) => { if (m.isMesh) m.material = new T.MeshBasicMaterial({ map: A.vendTex, toneMapped: false }); });
    // the rest of our own machine goes (the products stay)
    for (const m of own) m.layers.set(31);
    g.userData.__swapped = path;
  };
  if (Models.ready[path]) go(); else Models.load(path).then((x: any) => { if (x) go(); });
}
function hgVendDisplay(text: string, A0?: any) {
  const R = hgVR(), A = A0 || (R.A && R.A.vend ? R.A : R.Abuild), c = A && A.vendCv; if (!c) return;
  const x = c.getContext('2d') as CanvasRenderingContext2D; x.fillStyle = '#06210F'; x.fillRect(0, 0, 256, 96); x.fillStyle = '#3CFF7A'; x.font = '700 26px "Courier New", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
  const words = text.toUpperCase().split(' '), lines: string[] = []; let l = '';
  for (const w of words) { if ((l + ' ' + w).trim().length > 15) { lines.push(l.trim()); l = w; } else l += ' ' + w; } lines.push(l.trim());
  lines.slice(0, 2).forEach((s, i) => x.fillText(s, 128, lines.length > 1 ? 30 + i * 36 : 48));
  if (A.vendTex) A.vendTex.needsUpdate = true;
}

/* ---------- mechanics ---------- */
function hgMechanics(scene: any) {
  const R = HangarRoom, T = THREE, A = R.A, co: any = company();
  // the mechanics on this aircraft's work (an empty hangar has nobody in it)
  let list: any[] = R.reg ? hgCrewFor(R.reg) : [];
  R.noMech = !!R.reg && !list.length;
  list = Gfx.placePeople('hangar') ? list.slice(0, 3) : []; R.mechs = [];   // Settings → Graphics → Hangars: without the people (quicker)
  const ab = A.acBox || new T.Box3(new T.Vector3(-10, 0, -10), new T.Vector3(10, 6, 10)), nose = ab.max.z, mid = (ab.min.z + ab.max.z) / 2, span = ab.max.x - ab.min.x;
  const spots = [[2.9, nose + 1.4, -0.9], [Math.max(3.2, span * 0.17) + 0.6, mid + 3.4, Math.PI], [-span * 0.22 - 0.9, mid + 3.0, 0.6]];
  list.forEach((p, i) => {
    try {
      const m = Human.build(p.look, 'mech', co.color || '#2C8CFF', av3Style(), Gfx.placePeopleQ('hangar', R.q >= 2 ? 0.7 : 0.45));
      const pivot = new T.Group(); pivot.add(m.root); A.root.add(pivot);
      const s = spots[i]; pivot.position.set(s[0], 0, s[1]); pivot.rotation.y = s[2];
      m.root.traverse((o: any) => { if (o.isMesh) { o.castShadow = R.q >= 1; o.receiveShadow = true; } });
      const hit = new T.Mesh(new T.BoxGeometry(0.7, 1.85, 0.7), new T.MeshBasicMaterial({ visible: false })); hit.position.set(0, 0.92, 0); hit.userData.act = 'mech'; hit.userData.i = i; pivot.add(hit); A.hits.push(hit);
      A.blocks.push([s[0] - 0.35, s[1] - 0.35, s[0] + 0.35, s[1] + 0.35]);
      R.mechs.push({ p, m, pivot, yaw0: s[2], yaw: s[2], seed: i * 1.7 });
    } catch (e) { /* without this one */ }
  });
}

/* ---------- light: the sky in the windows, the sun through the roof ---------- */
function hgSkyUpdate() {
  const R = HangarRoom, T = THREE, A = R.A; if (!A) return;
  const S = hgSun(R.base); R.sun = S;
  const sunXZ = new T.Vector2(S.v[0], S.v[2]); const l = sunXZ.length() || 1; sunXZ.divideScalar(l);
  const warmC = new T.Color(0xFFC48A);
  const face: any = { e: [1, 0], w: [-1, 0], s: [0, 1], n: [0, -1], up: null };
  for (const k of Object.keys(A.panes)) {
    const c = S.sky.clone(), f = face[k];
    const toward = f ? Math.max(0, f[0] * sunXZ.x + f[1] * sunXZ.y) : 0.5;
    if (S.warm > 0) c.lerp(warmC, S.warm * toward * 0.85);
    const bright = k === 'up' ? 0.7 + 0.45 * S.k : 0.55 + 0.6 * S.k * (0.75 + 0.5 * toward);
    c.multiplyScalar(bright); A.panes[k].color.copy(c);
  }
  // a model file's windows (meshes named window, glass or skylight) show the same sky
  const fm = A.shell && A.shell.children.filter((c: any) => c.userData.fromFile)[0];
  if (fm && !A.filePanes) { A.filePanes = true; fm.traverse((o: any) => { if (o.isMesh && /window|glass|skylight|glazing/i.test(o.name || '')) o.material = /sky|roof/i.test(o.name) ? A.panes.up || o.material : A.panes.s || o.material; }); }
  if (R.hemi) { R.hemi.intensity = 0.45 + 0.85 * S.k; R.hemi.color.copy(new T.Color(0xEAF2FF).lerp(S.sky, 0.25)); }
  // the sun through the roof lights: a real light with shadows on the PC (and good phones), drawn patches otherwise
  const vis = clamp((S.alt - 0) / 6, 0, 1);
  if (R.sunL) { R.sunL.intensity = 2.6 * vis; R.sunL.visible = vis > 0.01; R.sunL.color.copy(new T.Color(0xFFF1DA).lerp(warmC, S.warm * 0.7)); R.sunL.position.set(S.v[0] * 150, Math.max(10, S.v[1] * 150), S.v[2] * 150); R.sunL.target.position.set(0, 0, 0); }
  for (const p of A.patches || []) { p.visible = vis > 0.01; p.material.opacity = 0.32 * vis; p.material.color.copy(new T.Color(0xFFF1DA).lerp(warmC, S.warm * 0.7)); const sh = S.v[1] > 0.05 ? R.sz.H / Math.max(0.15, S.v[1]) : 0; p.position.x = -S.v[0] * sh; p.position.z = p.userData.z - S.v[2] * sh; }
  const hint = R.root && R.root.querySelector('.ct-top small') as HTMLElement; if (hint) hint.textContent = `${company().name} · ${R.base} · ${S.name}`;
}

function hgOpen2(root: HTMLElement, q: number) {
  const R = HangarRoom, T = THREE, cv = root.querySelector('canvas') as HTMLCanvasElement; R.q = q;
  const ren = new T.WebGLRenderer({ canvas: cv, antialias: q >= 1, powerPreference: 'high-performance' }); R.ren = ren;
  ren.setPixelRatio(Gfx.pr(Gfx.placeSharp('hangar', q))); ren.outputColorSpace = T.SRGBColorSpace; ren.toneMapping = T.ACESFilmicToneMapping; ren.toneMappingExposure = 1.0;
  ren.shadowMap.enabled = Gfx.placeShadow('hangar', q >= 2); ren.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene(); R.scene = scene; scene.background = new T.Color(0x0B121B);
  const cam = new T.PerspectiveCamera(60, 1, 0.1, 400); R.cam = cam;   // a near plane of 10 cm keeps the depth fine at the far roof (no flicker)
  R.hemi = new T.HemisphereLight(0xEAF2FF, 0x3A3F46, 0.9); scene.add(R.hemi);
  ctProgress(12, 'Switching on the lights…', R);
  setTimeout(() => {
    if (!R.on) return;
    try {
      const pm = new T.PMREMGenerator(ren), env = new T.Scene(); env.add(new T.Mesh(new T.BoxGeometry(10, 5, 10), new T.MeshBasicMaterial({ color: 0x5C646E, side: T.BackSide })));
      for (const x of [-2, 2]) { const l = new T.Mesh(new T.PlaneGeometry(1.2, 6), new T.MeshBasicMaterial({ color: 0xFFFFFF })); l.position.set(x, 2.4, 0); l.rotation.x = Math.PI / 2; env.add(l); }
      scene.environment = pm.fromScene(env, 0.04).texture; pm.dispose();
    } catch (e) { /* no reflections */ }
    ctProgress(30, 'Towing the aircraft in…', R);
    let A: any = null;
    try { R.Abuild = null; A = hgBuild(scene, q); } catch (e) { console.error(e); }
    if (!A) { toast('The hangar could not be built on this device', 'warn'); HangarRoom.close(); return; }
    R.A = A; R.glow = new AimGlow(scene);
    ctProgress(55, 'Your mechanics are on their way…', R);
    // the lamps: a few real lights under the roof (more on the PC), and the sun
    { const sz: HgSize = R.sz, n = DESKTOP ? Math.min(8, 2 + 2 * Gfx.lights()) : q >= 2 ? 4 : 2, lamps: number[][] = A.lamps || [];
      const pick = lamps.filter((_, i) => i % Math.max(1, Math.floor(lamps.length / n)) === 0).slice(0, n);
      for (const p of pick) { const L = new T.SpotLight(0xFFF4E2, 1.1 * p[1] * p[1], 0, 1.1, 0.8, 2); L.position.set(p[0], p[1], p[2]); L.target.position.set(p[0], 0, p[2]); scene.add(L); scene.add(L.target); }
      const fill = new T.PointLight(0xFFF4E2, 0.6 * sz.H * sz.H, 0, 2); fill.position.set(0, sz.H * 0.8, 0); scene.add(fill);
      const realSun = q >= 2 && (DESKTOP || q >= 3);
      if (realSun) {
        const S = new T.DirectionalLight(0xFFF1DA, 2.6); S.castShadow = true; const ms = DESKTOP ? 4096 : 2048; S.shadow.mapSize.set(ms, ms);
        const c = S.shadow.camera; const half = Math.max(sz.W, sz.D) * 0.62; c.left = -half; c.right = half; c.top = half; c.bottom = -half; c.near = 10; c.far = 400; S.shadow.bias = -0.0006; S.shadow.normalBias = 0.05;
        scene.add(S); scene.add(S.target); R.sunL = S;
      } else {
        // the patches of sunlight under each roof light, moved with the sun
        for (const sl of A.skylights || []) { const p = new T.Mesh(new T.PlaneGeometry(sz.W - 2, sl[1]), new T.MeshBasicMaterial({ color: 0xFFF1DA, transparent: true, opacity: 0.3, blending: T.AdditiveBlending, depthWrite: false })); p.rotation.x = -Math.PI / 2; p.position.set(0, 0.012, sl[0]); p.userData.z = sl[0]; p.renderOrder = 1; scene.add(p); A.patches.push(p); }
      }
    }
    hgSkyUpdate();
    opsMonitorDraw(A);
    try { hgMechanics(scene); } catch (e) { R.mechs = []; }
    hgItemsPlace();
    const fit = () => { const w = root.clientWidth, h = root.clientHeight; ren.setSize(w, h, false); cam.aspect = w / Math.max(1, h); cam.updateProjectionMatrix(); };
    fit(); R.fit = fit; window.addEventListener('resize', fit);
    // where you come in: by the small door, looking at the aircraft
    const ab = A.acBox, z1 = R.sz.D / 2;
    R.free = { x: -R.sz.W / 2 + 1.2 + (R.sz.W - 2) / 4 * 0.6, z: z1 - 2.2, v: 0, bob: 0 };
    { const dx = 0 - R.free.x, dz = (ab ? (ab.min.z + ab.max.z) / 2 : 0) - R.free.z; R.look = { yaw: Math.atan2(-dx, -dz), pitch: 0.05 }; }
    // the held item, if you left with one
    { const st = hgStore(); if (st.held && st.held.kind) hgHoldStart(st.held, true); }
    hgInput(root, cv);
    ctProgress(85, 'Opening the hangar…', R);
    setTimeout(() => {
      if (!R.on) return;
      try { ren.compile(scene, cam); } catch (e) { /* first frame */ }
      R.loading = false; R.t0 = performance.now(); hgFrame();
      ctProgress(100, 'Ready', R);
      // the splash stays at least 5 seconds, and until everything is loaded (it is, by now)
      const wait = Math.max(300, 5000 - (performance.now() - R.loadT0));
      setTimeout(() => { const L = R.root && R.root.querySelector('.ct-loader') as HTMLElement; if (L) { L.classList.add('out'); setTimeout(() => L.remove(), 800); } hgUi(true); }, wait);
    }, 40);
    R.iv = setInterval(() => { if (R.on && !document.hidden) { opsMonitorDraw(R.A); hgSkyUpdate(); } }, 15000);
    R.perf = Perf.state();
    const loop = () => { if (!R.on) return; R.raf = requestAnimationFrame(loop); if (!R.loading && (!R.overlay || R.zoomAnim) && !Perf.skip(R.perf)) hgFrame(); };
    R.raf = requestAnimationFrame(loop);
  }, 30);
}

/* ---------- input ---------- */
function hgInput(root: HTMLElement, cv: HTMLCanvasElement) {
  const R = HangarRoom;
  let drag: any = null, moved = 0, justLocked = false;
  cv.addEventListener('pointerdown', e => {
    if (DESKTOP && e.pointerType === 'mouse') { drag = null; if (!aimLocked(cv)) { justLocked = true; aimLock(cv); } return; }
    drag = { x: e.clientX, y: e.clientY, yaw: R.look.yaw, pitch: R.look.pitch }; moved = 0; try { cv.setPointerCapture(e.pointerId); } catch (x) { /* none */ }
  });
  R.mm$ = (e: MouseEvent) => { if (R.on && aimLocked(cv) && !R.panelOpen) aimTurn(R.look, e, -1.25, 1.1); };
  document.addEventListener('mousemove', R.mm$);
  cv.addEventListener('pointermove', e => { if (drag) { moved = Math.max(moved, Math.hypot(e.clientX - drag.x, e.clientY - drag.y)); R.look.yaw = drag.yaw - (e.clientX - drag.x) * 0.004; R.look.pitch = clamp(drag.pitch - (e.clientY - drag.y) * 0.003, -1.25, 1.1); } });
  cv.addEventListener('pointerup', e => { if (aimLocked(cv)) { if (justLocked) justLocked = false; else hgClickAt(); return; } justLocked = false; if (drag && moved < 6) hgClickAt(e); drag = null; });
  // the walking stick on touch screens
  { const pad = root.querySelector('.op-pad') as HTMLElement, knob = pad && pad.firstElementChild as HTMLElement; let id = -1;
    if (pad) {
      const mv = (e: PointerEvent) => { const r = pad.getBoundingClientRect(), Rr = r.width / 2; let dx = (e.clientX - r.left - Rr) / Rr, dy = (e.clientY - r.top - Rr) / Rr; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } R.stick = [dx, -dy]; knob.style.transform = `translate(${dx * Rr * 0.55}px, ${dy * Rr * 0.55}px)`; };
      pad.addEventListener('pointerdown', e => { e.stopPropagation(); id = e.pointerId; pad.setPointerCapture(id); mv(e); });
      pad.addEventListener('pointermove', e => { if (e.pointerId === id) mv(e); });
      const up = (e: PointerEvent) => { if (e.pointerId !== id) return; id = -1; R.stick = [0, 0]; knob.style.transform = ''; };
      pad.addEventListener('pointerup', up); pad.addEventListener('pointercancel', up);
    } }
  root.addEventListener('click', ev => { const b = (ev.target as HTMLElement).closest('[data-op]') as HTMLElement; if (b) { ev.stopPropagation(); hgClick(b); } });
  R.key$ = (e: KeyboardEvent) => {
    if (!R.on) return; const k = e.key.toLowerCase();
    if (R.overlay) { if (k === 'escape' && !document.querySelector('.layer')) { e.preventDefault(); e.stopImmediatePropagation(); hgScreenClose(); } return; }
    if (k === 'escape') {
      e.preventDefault(); e.stopImmediatePropagation();
      if (R.talk >= 0) { hgTalkClose(); return; } if (R.panelOpen) { hgPanelClose(); return; }
      if (aimLocked()) { aimUnlock(); return; } if (aimEscUsed()) return; hgLeave(); return;
    }
    if (R.panelOpen || R.talk >= 0) return;
    if (k === 'f' && R.hold) { e.preventDefault(); hgUse(); return; }
    if (k === 'r' && R.hold) { e.preventDefault(); hgLookToggle(); return; }
    if (/^arrow\w+$/.test(k) || /^(w|a|s|d|shift)$/.test(k)) { R.keys[k] = true; e.preventDefault(); e.stopImmediatePropagation(); }
  };
  R.ku$ = (e: KeyboardEvent) => { if (R.on) R.keys[e.key.toLowerCase()] = false; };
  window.addEventListener('keydown', R.key$, true); window.addEventListener('keyup', R.ku$, true);
}

/* ---------- each frame ---------- */
function hgFrame() {
  const R = HangarRoom, T = THREE, now = performance.now() / 1000, dt = Math.min(0.05, now - (R.last || now)); R.last = now;
  const k = R.keys || {};
  if (!R.panelOpen && R.talk < 0) { if (k.arrowleft) R.look.yaw += dt * 1.6; if (k.arrowright) R.look.yaw -= dt * 1.6; }
  // you: your own figure, seen from your eyes
  if (!R.meTried) { R.meTried = true; const mk = () => { try { if (!R.on || !R.scene) return; const me: any = myPilot(); R.me = selfBody(R.scene, me && me.look ? Object.assign({}, me.look, { hat: 'none' }) : ctLook('me', 'm', 'public'), company().color); } catch (e) { R.me = null; } }; if (Human.ready) mk(); else Human.load().then(mk, () => { /* without */ }); }
  hgWalk(dt, now); hgRoomDoorsStep(dt);
  // the doors (shut; ready to slide), the vending machine, the mechanics
  if (R.A && R.A.doorLeaves && R.A.doorK !== R.doorK0) { R.doorK0 = R.A.doorK; hgDoors(R.A.doorK); }
  hgVendStep(dt);
  for (const M of R.mechs || []) {
    const talking = R.talk >= 0 && R.mechs[R.talk] === M;
    if (talking) { const dx = R.cam.position.x - M.pivot.position.x, dz = R.cam.position.z - M.pivot.position.z; M.yaw = lerpAng(M.yaw, Math.atan2(dx, dz), Math.min(1, dt * 4)); }
    else M.yaw = lerpAng(M.yaw, M.yaw0, Math.min(1, dt * 2));
    M.pivot.rotation.y = M.yaw;
    try { M.m.pose({ t: now + M.seed, yaw: 0, gaze: [0, talking ? 0.05 : -0.1], blink: ((now + M.seed) % 4.3) < 0.12 ? 1 : 0, g: humanGesture(null, now + M.seed), talk: talking ? humanTalk(M.p.name, R.sayText, R.sayAt) : 0 }); } catch (e) { /* still */ }
  }
  if (R.glow) { if (R.overlay || R.zoomAnim || R.panelOpen) R.glow.hide(); R.glow.step(dt); }
  // working at the monitor: you lean in to it as its screen comes up (and back out as it goes)
  R.walkPos = R.cam.position.clone(); R.walkQuat = R.cam.quaternion.clone();
  if (R.A && R.A.monScr) { const zk = hgZoomK(); R.A.monScr.material.color.setScalar(1 + 0.6 * Math.sin(Math.PI * Math.min(1, zk * 1.4)));
    if (zk > 0 && R.A.monEye) { const e = zk * zk * (3 - 2 * zk), q0 = R.cam.quaternion.clone(); R.cam.position.lerp(R.A.monEye, e); R.cam.lookAt(R.A.monAt); const q1 = R.cam.quaternion.clone(); R.cam.quaternion.copy(q0).slerp(q1, e); } }
  // frame generation: what you hold moves with your view, not with the room
  if (R.perf) { const H = R.hold && R.hold.grip; R.perf.anchor = H ? R.cam : null; R.perf.anchorDraw = H ? [H] : null; }
  FrameGen.draw(R.perf, R.ren, R.scene, R.cam); Perf.frame(R.perf, R.ren);
}
function lerpAng(a: number, b: number, k: number): number { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * k; }
/** A room's door: open it, or shut it (not while you stand in its way). */
function hgRoomDoor(i: number) {
  const R = HangarRoom, A = R.A, D0 = A && A.rdoors && A.rdoors[i]; if (!D0) return;
  if (D0.to) { const F = R.free, d = D0.d, zf = D0.pv.position.z; if (F && F.x > d[0] - 0.3 && F.x < d[1] + 0.3 && F.z > zf - 1.25 && F.z < zf + 0.3) { toast('Step out of the doorway first', 'info'); return; } }
  D0.to = D0.to ? 0 : 1; try { sfxDoor('metal', D0.to === 1); } catch (e) { /* quiet */ }
  const at = A.blocks.indexOf(D0.blk); if (D0.to && at >= 0) A.blocks.splice(at, 1); if (!D0.to && at < 0) A.blocks.push(D0.blk);
}
/** The rooms' doors swinging, a little each frame. */
function hgRoomDoorsStep(dt: number) {
  const A = HangarRoom.A; if (!A || !A.rdoors) return;
  for (const D0 of A.rdoors) if (D0.k !== D0.to) { D0.k += Math.sign(D0.to - D0.k) * Math.min(Math.abs(D0.to - D0.k), dt * 1.8); const e = D0.k * D0.k * (3 - 2 * D0.k); D0.pv.rotation.y = e * Math.PI * 0.55; }
}
/** The door leaves: 0 shut … 1 open, each sliding along its own track into the end of the opening. */
function hgDoors(k: number) { const A = HangarRoom.A; if (!A || !A.doorLeaves) return; const e = k * k * (3 - 2 * k); for (const L of A.doorLeaves) L.position.x = L.userData.x0 + (L.userData.x1 - L.userData.x0) * e; }

function hgBlocked(x: number, z: number, dx: number, dz: number): boolean {
  const R = HangarRoom, A = R.A, sz: HgSize = R.sz, r = 0.28;
  if (x < -sz.W / 2 + 0.5 || x > sz.W / 2 - 0.5 || z < -sz.D / 2 + 0.4 || z > sz.D / 2 - 1.3) return true;
  for (const b of A.blocks) if (x > b[0] - r && x < b[2] + r && z > b[1] - r && z < b[3] + r) return true;
  // the aircraft: anything of it lower than your head, just ahead of you
  const ab = A.acBox;
  if (ab && x > ab.min.x - 0.5 && x < ab.max.x + 0.5 && z > ab.min.z - 0.5 && z < ab.max.z + 0.5) {
    const rc = R.rc || (R.rc = new THREE.Raycaster()), l = Math.hypot(dx, dz) || 1;
    for (const f of [0, 0.32]) {
      rc.set(new THREE.Vector3(x + dx / l * f, 1.8, z + dz / l * f), new THREE.Vector3(0, -1, 0)); rc.far = 1.78;
      if (rc.intersectObjects(A.acMeshes || [], false).length) return true;
    }
  }
  return false;
}
function hgInRooms(x: number, z: number): boolean { const D = HangarRoom.sz.D; return z < -D / 2 + HG_RD && x > HG_RX0 && x < HG_RX1; }
function hgWalk(dt: number, now: number) {
  const R = HangarRoom, F = R.free, K = R.keys || {}, T = THREE, free = !R.panelOpen && R.talk < 0;
  const f = free ? (K.w || K.arrowup ? 1 : 0) - (K.s || K.arrowdown ? 1 : 0) + R.stick[1] : 0, rr = free ? (K.d ? 1 : 0) - (K.a ? 1 : 0) + R.stick[0] : 0;
  const mag = Math.min(1, Math.hypot(f, rr)), run = K.shift || Math.hypot(R.stick[0], R.stick[1]) > 0.96, vmax = run ? 3.4 : 1.4;
  F.v += ((mag > 0.05 ? vmax * mag : 0) - F.v) * Math.min(1, dt * 6);
  const yaw = R.look.yaw, fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  let mx = fx * f + rx * rr, mz = fz * f + rz * rr; const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml; const step = F.v * dt;
  if (step > 0) { const nx = F.x + mx * step, nz = F.z + mz * step; if (!hgBlocked(nx, nz, mx, mz)) { F.x = nx; F.z = nz; } else if (!hgBlocked(nx, F.z, mx, 0)) F.x = nx; else if (!hgBlocked(F.x, nz, 0, mz)) F.z = nz; F.bob += step; }
  try { Sound.steps(F, F.bob, hgInRooms(F.x, F.z) ? 'tile' : 'concrete', F.v); } catch (e) { /* quiet */ }
  const bobY = Math.sin(F.bob / 0.65 * Math.PI) * 0.016 * Math.min(1, F.v / 1.1);
  R.cam.position.set(F.x, 1.64 + bobY, F.z);
  // drinking: the head tips back a little
  const H = R.hold, tilt = H && H.use ? H.use.head || 0 : 0;
  if (R.me) { try {
    const S = R.me, yb = yaw + Math.PI, o = selfEyeOff(S, yb, 0); S.pitch = R.look.pitch + tilt;
    const arms = H ? (m: any) => hgArms(m, dt, now) : undefined;
    if (H) hgHoldStep(dt, now, new T.Vector3(F.x, S.hipY + S.hh, F.z));
    const eye = selfPose(S, new T.Vector3(F.x - o.x, S.hipY, F.z - o.z), yb, 0, 0, F.v, F.bob, now, dt, arms); R.cam.position.set(eye.x, eye.y + bobY, eye.z);
  } catch (e) { R.me = null; } }
  else if (H) hgHoldStep(dt, now, new T.Vector3(F.x, 1.62, F.z));
  const p = R.look.pitch + tilt; R.cam.lookAt(R.cam.position.clone().add(new T.Vector3(fx * Math.cos(p), Math.sin(p), fz * Math.cos(p))));
  // what's in front of you glows; holding something, where it would go down shows on the surface you look at
  if (free && !R.overlay) {
    const obj = hgAimedObj(), hint = obj ? obj.userData.act : '', dot = R.root.querySelector('.op-dot') as HTMLElement;
    if (R.glow) { if (obj && hint !== 'aircraft') R.glow.showObj(obj); else R.glow.hide(); }
    let spot: any = null; if (R.hold && !R.hold.use && R.hold.mode === 'hold' && (!obj || hint === 'aircraft')) spot = hgSurfAt();
    R.spot = spot; hgGhost(spot);
    if (dot) { dot.hidden = false; const tx = hgHint(obj, spot); dot.textContent = tx || (aimLocked() ? '·' : ''); dot.classList.toggle('on', !!tx); if (!tx && !aimLocked()) dot.hidden = true; }
  } else { const dot = R.root.querySelector('.op-dot') as HTMLElement; if (dot) dot.hidden = true; hgGhost(null); }
}
function hgHint(obj: any, spot: any): string {
  const R = HangarRoom, a = obj ? obj.userData.act : '';
  if (a === 'door') return 'The door: click to leave the hangar';
  if (a === 'rdoor') { const D0 = R.A && R.A.rdoors && R.A.rdoors[obj.userData.i]; return D0 && D0.to ? 'Click to close the door' : 'Click to open the door'; }
  if (a === 'monitor') return 'Click to work at the monitor';
  if (a === 'vend') return R.vend && R.vend.st === 'ready' ? 'Open the flap at the bottom to take it' : 'Click to choose a snack or a drink';
  if (a === 'flap') return R.vend && R.vend.st === 'ready' ? 'Click to take it' : 'The tray';
  if (a === 'mech') { const M = R.mechs[obj.userData.i]; return M ? `Talk to ${M.p.name}` : ''; }
  if (a === 'item') return R.hold ? 'Your hands are full' : `Click to pick up the ${hgProd(obj.userData.kind).name.toLowerCase()}`;
  if (a === 'aircraft' && !spot && R.reg) { const fx = hgFixList(R.reg); return `${R.reg}: ${fx.length ? fx.length + ' to fix' : 'nothing to fix'}`; }
  if (spot) return 'Click to put it down here';
  return '';
}
/** What you can use at the mouse (or at the dot in the middle), within reach. */
function hgAimedObj(e?: PointerEvent): any {
  const R = HangarRoom, T = THREE, rc = new T.Raycaster();
  if (e && !aimLocked()) { const r = (R.root.querySelector('canvas') as HTMLElement).getBoundingClientRect(); rc.setFromCamera(new T.Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), R.cam); }
  else rc.setFromCamera(new T.Vector2(0, 0), R.cam);
  R.ray = rc;
  const hs = R.A ? rc.intersectObjects(R.A.hits.filter((h: any) => h.visible !== false || h.userData.act), false) : [];
  for (const h of hs) { const far = h.object.userData.far || 3.0; if (h.distance < far) return h.object; if (h.object.userData.act !== 'aircraft') break; }
  return null;
}
/** The flat surface you look at, within reach (a table, a counter, a trolley, the floor…): where a thing would go. */
function hgSurfAt(e?: PointerEvent): any {
  const R = HangarRoom, T = THREE, rc = new T.Raycaster();
  if (e && !aimLocked()) { const r = (R.root.querySelector('canvas') as HTMLElement).getBoundingClientRect(); rc.setFromCamera(new T.Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), R.cam); }
  else rc.setFromCamera(new T.Vector2(0, 0), R.cam);
  rc.far = 3.2; rc.layers.enableAll();
  const h = rc.intersectObjects(R.A.surfs, false)[0]; if (!h) return null;
  const n = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : new T.Vector3(0, 1, 0); if (n.y < 0.8) return null;
  // nothing else in the way (the aircraft, a wall)
  const near = rc.intersectObjects(R.A.acMeshes || [], false)[0]; if (near && near.distance < h.distance) return null;
  return { p: h.point.clone(), floor: !!h.object.userData.floor };
}
function hgGhost(spot: any) {
  const R = HangarRoom, T = THREE;
  if (!R.ghost) { const g = new T.Mesh(new T.RingGeometry(0.035, 0.05, 28), new T.MeshBasicMaterial({ color: 0x6FE3F5, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false })); g.rotation.x = -Math.PI / 2; g.renderOrder = 6; R.scene.add(g); R.ghost = g; }
  R.ghost.visible = !!spot; if (spot) R.ghost.position.set(spot.p.x, spot.p.y + 0.004, spot.p.z);
}

function hgClickAt(e?: PointerEvent) {
  const R = HangarRoom; if (R.loading || R.overlay || R.panelOpen) return;
  if (R.talk >= 0) return;
  const o = hgAimedObj(e), a = o ? o.userData.act : '';
  if (a === 'door') { roomExitMenu(R.root, 'hangars', to => hgLeave(to)); return; }
  if (a === 'rdoor') { hgRoomDoor(o.userData.i); return; }
  if (a === 'monitor') { hgScreenOpen('schedule'); return; }
  if (a === 'mech') { hgTalkOpen(o.userData.i); return; }
  if (a === 'vend') { if (R.vend && R.vend.st === 'ready') { hgTake(); return; } hgVendOpen(); return; }
  if (a === 'flap') { if (R.vend && R.vend.st === 'ready') hgTake(); return; }
  if (a === 'item') { if (R.hold) { toast('Your hands are full: put it down first', 'info'); return; } hgPickUp(o.userData.id); return; }
  if (R.hold && !R.hold.use) { const s = e ? hgSurfAt(e) : R.spot; if (s) { hgPutDown(s); return; } }
  if (a === 'aircraft' && R.reg) { const fx = hgFixList(R.reg); toast(`${R.reg}: ${fx.length ? fx.map((i: any) => i.title).join(', ') : 'nothing to fix'}`, 'info'); }
}

/* ---------- the buttons below ---------- */
function hgUi(first?: boolean) {
  const R = HangarRoom; if (!R.on) return;
  const sp = R.root.querySelector('.hg-spots') as HTMLElement; sp.hidden = false;
  sp.innerHTML = `<button data-op="goto" data-k="ac">The aircraft</button><button data-op="goto" data-k="office">Maintenance office</button><button data-op="goto" data-k="break">Break room</button>`;
  const pad = R.root.querySelector('.op-pad') as HTMLElement; if (pad) pad.hidden = DESKTOP;
  hgHandUi();
  const hint = R.root.querySelector('.op-aim') as HTMLElement;
  if (hint && first) { hint.hidden = false; hint.classList.add('op-hint'); hint.textContent = R.show ? `${R.show.label}: walk round it and take a look. Back to the market with Esc.` : !R.reg ? `This hangar is empty: no ${R.sz.name.toLowerCase().replace(' hangar', '')} aircraft is in for work at ${R.base}.` : R.noMech ? `No mechanics are free at ${R.base}: hire some in Crew.` : DESKTOP ? 'W A S D to walk, Shift to run · the mouse looks around · click what glows' : 'Stick to walk (push it all the way to run) · drag to look · tap what glows'; setTimeout(() => { if (hint) hint.hidden = true; }, 7000); }
}
function hgHandUi() {
  const R = HangarRoom, el = R.root && R.root.querySelector('.hg-hand') as HTMLElement; if (!el) return;
  const H = R.hold; if (!H) { el.hidden = true; el.innerHTML = ''; return; }
  const p = hgProd(H.it.kind), can = p.type === 'can', done = can && H.it.used >= H.it.n;
  el.hidden = false;
  el.innerHTML = `<span class="hg-hand-n"><b>${esc(p.name)}</b><small>${can ? (done ? 'Empty' : H.it.used ? `${H.it.n - H.it.used} of ${H.it.n} sips left` : 'Unopened') : H.it.used ? `${H.it.n - H.it.used} of ${H.it.n} bites left` : 'Still wrapped'}</small></span>
    ${done ? '' : `<button data-op="use">${can ? 'Drink' : 'Take a bite'}${DESKTOP ? '<kbd>F</kbd>' : ''}</button>`}
    <button data-op="look-item" class="${H.mode === 'look' ? 'on' : ''}">${H.mode === 'look' ? 'Lower it' : 'Look at it'}${DESKTOP ? '<kbd>R</kbd>' : ''}</button>
    <small class="hg-hand-t">${DESKTOP ? 'Aim at a table, a counter or the floor and click to put it down' : 'Tap a table, a counter or the floor to put it down'}</small>`;
}
function hgClick(b: HTMLElement) {
  const R = HangarRoom, k = b.getAttribute('data-op');
  if (k === 'leave') hgLeave();
  else if (k === 'goto') hgGoto(b.getAttribute('data-k'));
  else if (k === 'use') hgUse();
  else if (k === 'look-item') hgLookToggle();
  else if (k === 'vend-pick') hgVendPick(b.getAttribute('data-k'));
  else if (k === 'panel-close') hgPanelClose();
  else if (k === 'talk-close') hgTalkClose();
  else if (k === 'ask') hgAsk(b.getAttribute('data-k'));
}
/** Quick walks: to the aircraft, the office or the break room (a moment's fade, you are there). */
function hgGoto(where: string) {
  const R = HangarRoom, D = R.sz.D, z0 = -D / 2, ab = R.A.acBox, fd = R.root.querySelector('.hg-fade') as HTMLElement;
  const to = where === 'office' ? { x: (HG_RX0 + HG_RXM) / 2 + 0.6, z: z0 + 4.4, yaw: 0.1, pitch: -0.2 } : where === 'break' ? { x: HG_RX1 - 1.4, z: z0 + 3.6, yaw: -0.35, pitch: -0.12 }
    : { x: 7, z: Math.min((ab ? ab.max.z : 0) + 2, D / 2 - 2.2), yaw: 1.05, pitch: 0.12 };
  Sound.tick(); aimUnlock(); if (fd) fd.classList.add('on');
  setTimeout(() => { R.free.x = to.x; R.free.z = to.z; R.look = { yaw: to.yaw, pitch: to.pitch }; if (fd) fd.classList.remove('on'); }, 260);
}

/* ---------- the vending machine: choosing, the coil turns, it drops, the flap ---------- */
function hgVendOpen() {
  const R = hgVR(); if (R.vend && R.vend.st && R.vend.st !== 'idle') return;
  if (R.hold || (R === LoungeRoom && lgHeldCup())) { hgVendDisplay('Hands full'); toast('Your hands are full: put it down first', 'info'); return; }
  aimUnlock(); R.panelOpen = true; Sound.tick(); hgVendDisplay('Make a choice');
  const el = R.root.querySelector('.hg-panel') as HTMLElement; el.hidden = false;
  el.innerHTML = `<div class="hg-vend"><div class="hg-vend-h"><b>Snacks &amp; drinks</b><small>${R === LoungeRoom ? 'Complimentary for our guests. Choose one.' : 'Free for the crew. Choose one.'}</small><button data-op="panel-close" aria-label="Close">${icon('close')}</button></div>
    <div class="hg-vend-g">${R.A.vend.slots.map((s: any) => { const p = hgProd(s.k); return `<button data-op="vend-pick" data-k="${s.k}"><i style="--c1:${p.c1};--c2:${p.c2}" class="hg-ic ${p.type}"></i><span><em>${s.code}</em>${esc(p.name)}</span></button>`; }).join('')}</div></div>`;
}
function hgPanelClose() { const R = hgVR(); R.panelOpen = false; const el = R.root.querySelector('.hg-panel') as HTMLElement; if (el) { el.hidden = true; el.innerHTML = ''; } if (!R.vend || !R.vend.st || R.vend.st === 'idle') hgVendDisplay('Choose a product'); }
function hgVendPick(k: string) {
  const R = hgVR(), V = R.A.vend, s = V.slots.filter((x: any) => x.k === k)[0]; if (!s) return;
  hgPanelClose(); hgVendDisplay(`${s.code} ${hgProd(k).name}`);
  hgSnd('beep');
  // the one in front comes out of the coil; the others move up, and one more goes in at the back
  const it = s.items.shift(), back = hgItemMesh(k, 0, 1); back.position.copy(s.items[s.items.length - 1].position); back.position.z -= s.gap; back.visible = true; V.g.add(back); s.items.push(back);
  R.vend = { st: 'turn', t: 0, s, it, z0: it.position.z, y0: it.position.y };
  setTimeout(() => hgSnd('motor'), 120);
}
function hgVendStep(dt: number) {
  const R = hgVR(), V = R.vend; if (!V || !V.st || V.st === 'idle' || V.st === 'ready') { hgFlapStep(dt); return; }
  const A = R.A, M = A.vend; V.t += dt;
  if (V.st === 'turn') {
    const k = Math.min(1, V.t / 1.6);
    const S = V.s, rz0 = S.coil.userData.rz0 || 0;
    S.coil.rotation.z = rz0 - k * Math.PI * 2;
    V.it.position.z = V.z0 + S.gap * 0.93 * k;
    S.items.forEach((o: any, i: number) => { o.position.z = S.z0 - (i + 1) * S.gap + S.gap * k; });
    if (k >= 1) { S.coil.rotation.z = rz0; V.st = 'fall'; V.t = 0; V.vy = 0; S.items.forEach((o: any, i: number) => { o.position.z = S.z0 - i * S.gap; }); V.tilt = 0; }
  } else if (V.st === 'fall') {
    // it tips off the front of the shelf and drops to the tray, bouncing once
    V.vy -= 9.81 * dt; V.it.position.y += V.vy * dt; V.it.position.z += (M.tray.z - V.it.position.z) * Math.min(1, dt * 5); V.it.position.x += (M.tray.x - V.it.position.x) * Math.min(1, dt * 3); V.tilt = Math.min(Math.PI / 2, V.tilt + dt * 5); V.it.rotation.x = V.tilt;
    const p = hgProd(V.s.k), floorY = M.tray.y + (p.type === 'can' ? HG_CAN.r : HG_BAR.t / 2) + 0.004;
    if (V.it.position.y <= floorY) { V.it.position.y = floorY; if (V.vy < -0.8) { V.vy = -V.vy * 0.25; hgSnd('thunk'); } else { V.vy = 0; V.st = 'ready'; V.t = 0; hgVendDisplay('Take your item'); R.glow && R.glow.showObj(R.A.hits.filter((h: any) => h.userData.act === 'flap')[0]); } }
  }
  hgFlapStep(dt);
}
function hgFlapStep(dt: number) { const R = hgVR(), M = R.A && R.A.vend; if (!M) return; R.flapK = (R.flapK || 0) + ((R.flapT || 0) - (R.flapK || 0)) * Math.min(1, dt * 7); M.flapH.rotation.x = (M.flapH.userData.rx0 || 0) - R.flapK * 1.2; }
/** Open the flap, take it: it comes up into your hand. */
function hgTake() {
  const R = hgVR(), V = R.vend; if (!V || V.st !== 'ready') return;
  R.flapT = 1; hgSnd('flap');
  const it: HgItem = { id: uid(), kind: V.s.k, x: 0, y: 0, z: 0, ry: 0, used: 0, n: hgProd(V.s.k).type === 'can' ? 4 + (Math.random() < 0.5 ? 1 : 0) : 3 + (Math.random() < 0.5 ? 1 : 0), at: Date.now() };
  const w = V.it.getWorldPosition(new THREE.Vector3()); V.it.parent.remove(V.it);
  R.vend = { st: 'idle' }; hgVendDisplay('Enjoy');
  setTimeout(() => { R.flapT = 0; hgVendDisplay('Choose a product'); }, 1400);
  if (R === LoungeRoom) { lgTakeSnack(it, w); return; }   // in the lounge: in your hand like a cup
  hgHoldStart(it, false, w);
}

/* ---------- in your hand ---------- */
function hgHoldStart(it: HgItem, already: boolean, from?: any) {
  const R = HangarRoom, T = THREE, grip = new T.Group(); R.scene.add(grip);
  const mesh = hgItemMesh(it.kind, it.used, it.n); grip.add(mesh); hgGripFit(mesh, it.kind);
  if (from) grip.position.copy(from);
  R.hold = { it, grip, mesh, mode: 'hold', use: null, w: already ? 1 : 0, a: { R: null }, placed: !!from };
  const st = hgStore(); st.held = it; hgSave(); hgHandUi();
}
/** Where an item sits in the hand's grip (made for holding a phone): a little forward, into the palm. */
function hgGripFit(mesh: any, kind: string) { const p = hgProd(kind); mesh.position.set(-0.004, p.type === 'can' ? 0.008 : 0.01, p.type === 'can' ? 0.012 : 0.0); }
function hgHoldStep(dt: number, now: number, eye: any) {
  const R = HangarRoom, T = THREE, H = R.hold, yaw = R.look.yaw, rot = (x: number, y: number, z: number) => new T.Vector3(x, y, z).applyAxisAngle(new T.Vector3(0, 1, 0), yaw);
  H.w = Math.min(1, H.w + dt * 2.2);
  let pos: any, q: any;
  const U = H.use;
  if (U) {
    const p = hgProd(H.it.kind), can = p.type === 'can'; U.t += dt;
    const up = 0.5, act = can ? 2.4 : 0.5, dn = can ? 0.5 : 1.3, e = (x: number) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
    let k = 0; if (U.t < up) k = e(U.t / up); else if (U.t < up + act) k = 1; else k = 1 - e((U.t - up - act) / (can ? dn : 0.45));
    if (can) { const sip = U.t > up && U.t < up + act ? Math.sin((U.t - up) / act * Math.PI) : 0; U.head = 0.14 * k + 0.06 * sip;
      pos = eye.clone().add(rot(0.0, -0.03, -0.115)).lerp(eye.clone().add(rot(0.07, -0.2, -0.32)), 1 - k);
      q = new T.Quaternion().setFromEuler(new T.Euler(-0.3 + (1.35 + 0.25 * sip) * k, yaw + 0.1 * (1 - k), 0, 'YXZ'));
      if (!U.snd && U.t > up * 0.8) { U.snd = true; if (!H.it.used) hgSnd('open'); setTimeout(() => { if (R.on) hgSnd('sip'); }, H.it.used ? 0 : 450); }
    } else {
      U.head = 0.12 * k;
      pos = eye.clone().add(rot(0.01, -0.055, -0.19)).lerp(eye.clone().add(rot(0.07, -0.2, -0.32)), 1 - k);
      q = new T.Quaternion().setFromEuler(new T.Euler(-0.3 + 1.0 * k, yaw + 0.1 * (1 - k), 0, 'YXZ'));
      if (!U.bit && U.t > up + 0.18) { U.bit = true; hgSnd('bite'); hgBite(); if (!R.hold) return; }
    }
    if (U.t >= up + act + (can ? dn : 0.45)) { hgUseDone(); }
  } else if (H.mode === 'look') {
    const d = new T.Vector3(); R.cam.getWorldDirection(d);
    pos = eye.clone().add(d.multiplyScalar(0.3)).add(rot(0.02, -0.04, 0));
    q = new T.Quaternion().setFromEuler(new T.Euler(-0.1 + R.look.pitch, yaw + 0.55 * Math.sin(now * 0.7), 0, 'YXZ'));
  } else {
    pos = eye.clone().add(rot(0.07, -0.2, -0.32));
    q = new T.Quaternion().setFromEuler(new T.Euler(-0.3, yaw + 0.1, 0, 'YXZ'));
  }
  if (!pos) return;
  const kk = H.placed ? 1 - Math.exp(-dt * 5) : 1 - Math.exp(-dt * 14);
  if (H.placed && H.grip.position.distanceTo(pos) < 0.02) H.placed = false;
  H.grip.position.lerp(pos, kk); H.grip.quaternion.slerp(q, kk); H.grip.updateMatrixWorld(true);
}
/** Your right hand round it (the same grip as your phone's). */
function hgArms(m: any, dt: number, now: number): any {
  const R = HangarRoom, H = R.hold; if (!H) return {};
  const rest = humanGesture(null, now);
  try { const g = phoneGrip(m, H.grip, 1, H.w, rest.R, H.a.R, PH_FIT0); H.a.R = g.R; return g; } catch (e) { return {}; }
}
function hgLookToggle() { const R = HangarRoom, H = R.hold; if (!H || H.use) return; H.mode = H.mode === 'look' ? 'hold' : 'look'; Sound.tick(); hgHandUi(); }
function hgUse() {
  const R = HangarRoom, H = R.hold; if (!H || H.use) return;
  const p = hgProd(H.it.kind); if (p.type === 'can' && H.it.used >= H.it.n) { toast('It\'s empty', 'info'); return; }
  H.mode = 'hold'; H.use = { t: 0, head: 0 }; hgHandUi();
}
function hgUseDone() {
  const R = HangarRoom, H = R.hold; if (!H) return; const p = hgProd(H.it.kind);
  if (p.type === 'can') { H.it.used = Math.min(H.it.n, H.it.used + 1); hgRebuildHeld(); if (H.it.used >= H.it.n) toast('That was the last sip: the can is empty', 'info'); }
  H.use = null; hgStore().held = H.it; hgSave(); hgHandUi();
}
/** A bite: the bar is shorter; the last one and it is gone. */
function hgBite() {
  const R = HangarRoom, H = R.hold; if (!H) return;
  H.it.used = Math.min(H.it.n, H.it.used + 1);
  if (H.it.used >= H.it.n) { const name = hgProd(H.it.kind).name.toLowerCase(); R.scene.remove(H.grip); R.hold = null; hgStore().held = null; hgSave(); hgHandUi(); toast(`That was the last of the ${name}`, 'info'); return; }
  hgRebuildHeld(); hgStore().held = H.it; hgSave();
}
function hgRebuildHeld() { const R = HangarRoom, H = R.hold; if (!H) return; H.grip.remove(H.mesh); H.mesh = hgItemMesh(H.it.kind, H.it.used, H.it.n); hgGripFit(H.mesh, H.it.kind); H.grip.add(H.mesh); }

/* ---------- putting things down, picking them up ---------- */
function hgPutDown(s: any) {
  const R = HangarRoom, H = R.hold; if (!H) return;
  const p = hgProd(H.it.kind), it = H.it;
  it.x = Math.round(s.p.x * 1000) / 1000; it.y = Math.round(s.p.y * 1000) / 1000; it.z = Math.round(s.p.z * 1000) / 1000; it.ry = Math.round((R.look.yaw + Math.PI) * 100) / 100; it.at = Date.now();
  it.flat = p.type === 'bar';
  R.scene.remove(H.grip); R.hold = null;
  const st = hgStore(), list = st[R.sz.k] || (st[R.sz.k] = []); list.push(it); st.held = null; hgSave();
  hgItemAdd(it); hgSnd('put'); hgHandUi();
}
function hgItemAdd(it: HgItem) {
  const R = HangarRoom, T = THREE, A = R.A, p = hgProd(it.kind), g = new T.Group(), mesh = hgItemMesh(it.kind, it.used, it.n);
  g.add(mesh);
  if (it.flat) { mesh.rotation.x = -Math.PI / 2; mesh.position.y = HG_BAR.t / 2; } else mesh.position.y = p.type === 'can' ? HG_CAN.h / 2 : HG_BAR.l / 2;
  g.position.set(it.x, it.y, it.z); g.rotation.y = it.ry; A.root.add(g);
  const hit = new T.Mesh(new T.BoxGeometry(0.14, it.flat ? 0.06 : 0.16, 0.14), new T.MeshBasicMaterial({ visible: false })); hit.position.y = it.flat ? 0.02 : 0.07; hit.userData.act = 'item'; hit.userData.id = it.id; hit.userData.kind = it.kind; g.add(hit); A.hits.push(hit);
  (A.items || (A.items = {}))[it.id] = { g, hit };
}
/** Everything put down earlier in this size of hangar (the last 48 hours). */
function hgItemsPlace() { const R = HangarRoom, list = (hgStore()[R.sz.k] || []) as HgItem[]; for (const it of list) { try { hgItemAdd(it); } catch (e) { /* skip it */ } } }
function hgPickUp(id: string) {
  const R = HangarRoom, A = R.A, st = hgStore(), list = (st[R.sz.k] || []) as HgItem[], it = list.filter(i => i.id === id)[0], o = A.items && A.items[id]; if (!it || !o) return;
  st[R.sz.k] = list.filter(i => i.id !== id);
  const w = o.g.getWorldPosition(new THREE.Vector3()); w.y += 0.05;
  A.root.remove(o.g); A.hits = A.hits.filter((h: any) => h !== o.hit); delete A.items[id];
  it.at = Date.now(); hgSnd('put'); hgHoldStart(it, false, w);
}

/* ---------- talking to your mechanics ---------- */
function hgMechVoice(p: any): string { return `mechanic|${p.sex === 'f' ? 'f' : 'm'}|neutral|${p.name}`; }
function hgLine(p: any, k: string): string {
  const R = HangarRoom, a: any = plane(R.reg), fx = hgFixList(R.reg), t = acType(a.typeId), c = Math.round(a.condition || 0), me: any = myPilot(), boss = me && me.name ? me.name.split(' ')[0] : 'boss';
  const sched = fx.filter((i: any) => i.status === 'scheduled'), open = fx.filter((i: any) => i.status === 'open');
  const list = (l: any[]) => l.length === 1 ? l[0] : l.slice(0, -1).join(', ') + ' and ' + l[l.length - 1];
  if (k === 'hello') return pick([`Hi ${boss}. ${a.status === 'maintenance' ? `We're working on ${a.reg}.` : `${a.reg} is in for a look-over.`}`, `Hello ${boss}. Come to see ${a.reg}?`, `Morning. ${a.reg} is all ours ${a.status === 'maintenance' ? 'until the work is done' : 'for now'}.`]);
  if (k === 'fix') {
    if (!fx.length) return `Nothing open on it. Condition is ${c}%, ${c > 85 ? 'it is in good shape.' : c > 60 ? 'some wear, nothing urgent.' : 'it is getting tired: a heavy check would do it good.'}`;
    const g = fx.filter((i: any) => i.severity === 'grounding');
    return `${fx.length === 1 ? 'One thing' : fx.length + ' things'}: ${list(fx.map((i: any) => i.title.toLowerCase()))}.${g.length ? ` The ${g[0].title.toLowerCase()} keeps it on the ground until it is fixed.` : ''} ${sched.length && !open.length ? 'We are on all of it.' : sched.length ? `We are on ${list(sched.map((i: any) => i.title.toLowerCase()))}; the rest still needs booking in Maintenance.` : 'Nobody has booked the work yet. Book it in Maintenance and we start straight away.'}`;
  }
  if (k === 'when') {
    const s: any = sched.filter((i: any) => i.startedAt && i.durMin)[0];
    if (s) { const left = Math.max(1, Math.round((s.startedAt + s.durMin * 60000 - Date.now()) / 60000)); return left > 90 ? `About ${Math.round(left / 60)} hours. We'll call you the moment it's signed off.` : `About ${left} minutes. Then the paperwork, and it's yours.`; }
    if (open.length) return 'We can start as soon as the work is booked. Most of it is a few hours.';
    return `It can go whenever you need it. ${a.status === 'flying' ? '' : 'Just let us close the panels first.'}`;
  }
  if (k === 'look') return c > 90 ? `Honestly? Lovely. ${t.model}s are good to work on and this one has been looked after.` : c > 70 ? `Fine. A few scuffs, the usual wear on the brakes and tyres. Nothing that worries me.` : c > 45 ? `Tired. It's flown hard. I'd plan a proper check before the busy season.` : `Not great. I wouldn't push it: it needs time in here.`;
  if (k === 'you') { const r = p.rating || 3.5; return r >= 4.2 ? 'Good, thanks. Busy, but I like this team.' : r >= 3.4 ? 'Fine. Long shift, but fine.' : 'Could be better. We are short of hands some days.'; }
  return pick(['Right, back to it.', 'No problem. Shout if you need anything.', 'See you later.']);
}
function pick<T>(a: T[]): T { return a[Math.floor(Math.random() * a.length)]; }
function hgTalkOpen(i: number) {
  const R = HangarRoom, M = R.mechs[i]; if (!M) return;
  aimUnlock(); R.talk = i; Sound.tick(); hgSay('hello');
}
function hgSay(k: string) {
  const R = HangarRoom, M = R.mechs[R.talk]; if (!M) return;
  const text = hgLine(M.p, k), voice = hgMechVoice(M.p); R.sayText = text; R.sayAt = Date.now();
  const el = R.root.querySelector('.hg-panel') as HTMLElement; el.hidden = false;
  const Q: [string, string][] = [['fix', 'What needs fixing?'], ['when', 'When will it be ready?'], ['look', 'How is it looking?'], ['you', 'How are you doing?'], ['bye', 'Thanks, carry on']];
  el.innerHTML = `<div class="hg-talk"><div class="hg-talk-h"><span><b>${esc(M.p.name)}</b><small>Mechanic at ${esc(R.base)} · on ${esc(R.reg)}</small></span><button data-op="talk-close" aria-label="Close">${icon('close')}</button></div>
    <p class="hg-talk-t">${esc(text)}</p><div class="hg-talk-v">${voiceButton(text, voice, 'Play')}</div>
    <div class="hg-talk-q">${Q.filter(q => q[0] !== k || k === 'bye').map(q => `<button data-op="ask" data-k="${q[0]}">${q[1]}</button>`).join('')}</div></div>`;
  if ((State.settings as any).officeAutoVoice) { try { Voice.stop(); Voice.speak(text, undefined, voice); } catch (e) { /* no voice */ } }
}
function hgAsk(k: string) { const R = HangarRoom; if (k === 'bye') { hgSay('bye'); setTimeout(() => { if (R.talk >= 0) hgTalkClose(); }, 2600); return; } Sound.tick(); hgSay(k); }
function hgTalkClose() { const R = HangarRoom; R.talk = -1; R.sayText = ''; try { Voice.stop(); } catch (e) { /* none */ } const el = R.root.querySelector('.hg-panel') as HTMLElement; if (el) { el.hidden = true; el.innerHTML = ''; } }

/* ---------- the monitor: the same screens as in the Operations office ---------- */
const HG_ZOOM_MS = 750;
function hgZoomK(): number {
  const R = HangarRoom, Z = R.zoomAnim; if (!Z) return R.overlay ? 1 : 0;
  const k = Math.min(1, (performance.now() - Z.t0) / HG_ZOOM_MS);
  if (k >= 1) { R.zoomAnim = null; if (Z.done) Z.done(); return Z.dir > 0 ? 1 : 0; }
  return Z.dir > 0 ? k : 1 - k;
}
function hgMonRect(): { x: number; y: number; w: number; h: number } {
  const R = HangarRoom, T = THREE, rr = R.root.getBoundingClientRect(); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  // seen from where you stand (not from where you lean in to it)
  const kp = R.cam.position.clone(), kq = R.cam.quaternion.clone(); if (R.walkPos) { R.cam.position.copy(R.walkPos); R.cam.quaternion.copy(R.walkQuat); }
  R.cam.updateMatrixWorld();
  for (const p of R.A.monRect || []) { const v = new T.Vector3(p[0], p[1], p[2]).project(R.cam), sx = (v.x + 1) / 2 * rr.width, sy = (1 - v.y) / 2 * rr.height; x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy); }
  R.cam.position.copy(kp); R.cam.quaternion.copy(kq); R.cam.updateMatrixWorld();
  return { x: x0, y: y0, w: Math.max(40, x1 - x0), h: Math.max(30, y1 - y0) };
}
function hgScreenOpen(key: string) {
  const R = HangarRoom; if (!R.on || !SCREENS[key] || R.zoomAnim || R.overlay) return;
  aimUnlock(); Sound.tick();
  for (const sel of ['.hg-spots', '.op-aim', '.hg-hand']) { const e = R.root.querySelector(sel) as HTMLElement; if (e) e.hidden = true; }
  const ov = document.createElement('div'); ov.className = 'of-planner op-screen lap-screen'; ov.setAttribute('data-screen', key);
  R.root.appendChild(ov); R.overlay = ov; document.body.classList.add('of-over');
  try { lapMount(ov); (Lap as any).ops = true; Lap.app = 'scr:' + key; lapRender(); } catch (e) { ov.innerHTML = '<p class="muted">The computer could not start.</p>'; }
  if (opsReduced()) return;
  const m = hgMonRect(), W = ov.offsetWidth || R.root.clientWidth, H = ov.offsetHeight || R.root.clientHeight;
  ov.classList.add('op-zoom'); ov.style.transformOrigin = '0 0';
  ov.style.transform = `translate(${m.x - ov.offsetLeft}px, ${m.y - ov.offsetTop}px) scale(${m.w / W}, ${m.h / H})`; ov.style.opacity = '0';
  const fx = document.createElement('div'); fx.className = 'op-zoom-fx'; fx.style.left = m.x + 'px'; fx.style.top = m.y + 'px'; fx.style.width = m.w + 'px'; fx.style.height = m.h + 'px'; R.root.appendChild(fx);
  R.zoomAnim = { t0: performance.now(), dir: 1, done: () => { ov.classList.remove('op-zoom', 'op-zoom-go'); ov.style.transform = ''; ov.style.opacity = ''; ov.style.transformOrigin = ''; } };
  void ov.offsetWidth;
  requestAnimationFrame(() => { ov.classList.add('op-zoom-go'); ov.style.transform = 'translate(0px, 0px) scale(1, 1)'; ov.style.opacity = '1'; fx.classList.add('go'); setTimeout(() => fx.remove(), 900); });
}
function hgScreenClose() {
  const R = HangarRoom; if (!R.overlay || R.zoomAnim) return;
  const ov = R.overlay; Sound.tick(); opsMonitorDraw(R.A);
  const finish = () => { try { if (Lap.root === ov) lapUnmount(); } catch (e) { /* closed */ } ov.remove(); if (R.overlay === ov) R.overlay = null; document.body.classList.remove('of-over'); hgUi(); };
  if (opsReduced()) { finish(); return; }
  const m = hgMonRect(), W = ov.offsetWidth || R.root.clientWidth, H = ov.offsetHeight || R.root.clientHeight;
  ov.style.pointerEvents = 'none'; ov.style.transformOrigin = '0 0'; ov.classList.add('op-zoom', 'op-zoom-go', 'op-zoom-back');
  R.zoomAnim = { t0: performance.now(), dir: -1, done: finish };
  requestAnimationFrame(() => { ov.style.transform = `translate(${m.x - ov.offsetLeft}px, ${m.y - ov.offsetTop}px) scale(${m.w / W}, ${m.h / H})`; ov.style.opacity = '0'; });
}
function hgRefresh() {
  const R = HangarRoom; if (!R.on) return;
  try { opsMonitorDraw(R.A); } catch (e) { /* next time */ }
  if (R.overlay && Lap.root === R.overlay) { try { lapRefresh(); } catch (e) { /* next time */ } }
}

/* ---------- sounds: the machine, the can, the bites (made here, no recordings) ---------- */
const HG_SFX: { [k: string]: string } = { beep: 'vending-button', motor: 'vending-coil', thunk: 'vending-drop', flap: 'vending-flap', put: 'put-down', open: 'can-open', sip: 'drink-sip', bite: 'snack-bite' };
function hgSnd(kind: string) {
  try {
    if ((State.settings as any).muteAll) return;
    if (HG_SFX[kind] && Sfx.play(HG_SFX[kind])) return;   // a file in www/sounds
    const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext, ac = HangarRoom.ac || (HangarRoom.ac = new AC()); if (ac.state !== 'running') ac.resume();
    const t0 = ac.currentTime + 0.02, out = ac.createGain(); out.gain.value = 0.8; out.connect(ac.destination);
    const noise = (dur: number) => { const n = ac.createBuffer(1, Math.max(1, Math.floor(ac.sampleRate * dur)), ac.sampleRate), d = n.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; const s = ac.createBufferSource(); s.buffer = n; return s; };
    const burst = (at: number, dur: number, type: string, f: number, Q: number, gain: number, att = 0.005) => { const s = noise(dur), fl = ac.createBiquadFilter(), g = ac.createGain(); fl.type = type; fl.frequency.value = f; fl.Q.value = Q; g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(gain, at + att); g.gain.exponentialRampToValueAtTime(0.0001, at + dur); s.connect(fl); fl.connect(g); g.connect(out); s.start(at); s.stop(at + dur + 0.02); };
    const tone = (at: number, dur: number, f0: number, f1: number, gain: number, type = 'sine') => { const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f0, at); o.frequency.exponentialRampToValueAtTime(f1, at + dur); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(gain, at + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, at + dur); o.connect(g); g.connect(out); o.start(at); o.stop(at + dur + 0.02); };
    if (kind === 'beep') { tone(t0, 0.08, 1800, 1800, 0.08, 'square'); tone(t0 + 0.11, 0.08, 1800, 1800, 0.08, 'square'); }
    else if (kind === 'motor') { const o = ac.createOscillator(), g = ac.createGain(), fl = ac.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = 96; fl.type = 'lowpass'; fl.frequency.value = 600; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.09, t0 + 0.1); g.gain.setValueAtTime(0.09, t0 + 1.4); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.6); o.connect(fl); fl.connect(g); g.connect(out); o.start(t0); o.stop(t0 + 1.7); burst(t0, 1.5, 'bandpass', 2400, 2, 0.02, 0.1); }
    else if (kind === 'thunk') { tone(t0, 0.16, 140, 60, 0.5); burst(t0, 0.09, 'lowpass', 900, 1, 0.35); }
    else if (kind === 'flap') { burst(t0, 0.08, 'bandpass', 1400, 3, 0.25); tone(t0 + 0.02, 0.1, 300, 180, 0.12, 'triangle'); }
    else if (kind === 'put') { tone(t0, 0.08, 520, 300, 0.18, 'triangle'); burst(t0, 0.05, 'highpass', 2500, 1, 0.12); }
    else if (kind === 'open') { burst(t0, 0.06, 'highpass', 3000, 1, 0.5); burst(t0 + 0.03, 0.55, 'bandpass', 6000, 0.7, 0.25, 0.01); tone(t0, 0.05, 1200, 700, 0.15, 'triangle'); }
    else if (kind === 'sip') {
      // 2.4 s: the first slurp, three gulps, the fizz all the way
      burst(t0, 2.4, 'bandpass', 7000, 0.8, 0.035, 0.2);
      burst(t0, 0.35, 'bandpass', 1200, 1.4, 0.18, 0.05);
      for (const at of [0.55, 1.2, 1.85]) { tone(t0 + at, 0.22, 210, 85, 0.45); burst(t0 + at, 0.18, 'lowpass', 500, 1, 0.25); }
    }
    else if (kind === 'bite') {
      // the snap of the bite, then chewing for a moment
      for (let i = 0; i < 7; i++) burst(t0 + i * 0.012, 0.04, 'bandpass', 2500 + Math.random() * 2500, 2, 0.35);
      for (let i = 0; i < 6; i++) burst(t0 + 0.35 + i * 0.26, 0.16, 'bandpass', 700 + Math.random() * 500, 1.5, 0.12, 0.03);
    }
  } catch (e) { /* no sound */ }
}

/* ---------- leaving ---------- */
HangarRoom.close = function (quiet?: boolean) {
  const R = HangarRoom; if (!R.on) return; R.on = false;
  // what is in your hand comes with you (it is there again next time)
  if (R.hold) { hgStore().held = R.hold.it; }
  try { Voice.stop(); } catch (e) { /* none */ }
  if (R.overlay) { try { if (Lap.root === R.overlay) lapUnmount(); } catch (e) { /* closed */ } } R.overlay = null; document.body.classList.remove('of-over');
  cancelAnimationFrame(R.raf); clearInterval(R.iv); window.removeEventListener('keydown', R.key$, true); window.removeEventListener('keyup', R.ku$, true); window.removeEventListener('resize', R.fit);
  document.removeEventListener('mousemove', R.mm$); aimUnlock();
  try { FrameGen.dispose(R.perf); } catch (e) { /* none */ }
  exitFreeRenderer(R.ren, R.scene); R.ren = null; R.scene = null; R.A = null; R.glow = null; R.me = null; R.meTried = false; R.mechs = []; R.hold = null; R.ghost = null; R.mats = null; R.sunL = null; R.hemi = null; R.rc = null;
  try { if (R.ac) R.ac.close(); } catch (e) { /* none */ } R.ac = null;
  if (R.root) R.root.remove();
  if (!quiet) { try { refresh(); } catch (e) { /* ignore */ } }
};
function hgLeave(to?: string) {
  if (!HangarRoom.on || ExitSplash.on) return;
  const show = !!HangarRoom.show;
  exitSplash('hangar', HangarRoom.sz ? 'Leaving the ' + HangarRoom.sz.name.toLowerCase() : 'Leaving the hangar', [
    { pct: 30, step: 'Closing the hangar…', run: () => HangarRoom.close(true) },
    { pct: 55, step: 'Clearing the hangar from memory…', run: exitFreeMemory },
    { pct: 85, step: show ? 'Back to the aircraft market…' : to && to !== 'hangars' ? 'On your way…' : 'Loading your hangars…', run: () => { try { if (show && !to) go('market'); else roomGoTo(to || 'hangars'); } catch (e) { refresh(); } } },
  ]);
}

/** The showroom: an aircraft from the market, on its own in a new hangar the size it needs (none of your hangars). */
interface HgShow { typeId: string; label: string; used?: boolean }
ACTIONS['mk-view'] = el => {
  const id = el.getAttribute('data-id'), used = el.getAttribute('data-used'), t = acType(id); if (!t) return;
  const u: any = used ? (usedList() as any[]).filter(x => x.id === used)[0] : null;
  Sound.tick(); HangarRoom.open('', '', '', { typeId: t.id, label: `${t.maker} ${t.model}${u ? ` · used, ${u.ageY} years` : ''}`, used: !!u });
};

/* ---------- the door: where to next ---------- */
// The doors of your office, the Operations office and the hangars ask where you are going: the Overview, the hangars,
// your office or Operations (all at the airport), or the courtroom (in the city). The room you are in isn't offered.
const ROOM_EXITS: [string, string, string][] = [['overview', 'The Overview', 'ops'], ['hangars', 'The hangars', 'wrench'], ['office', 'My office', 'jobs'], ['ops', 'Operations', 'clock'], ['lounges', 'The lounges', 'star'], ['court', 'The courtroom (in the city)', 'shield']];
function roomExitMenu(root: HTMLElement, here: string, leave: (to: string) => void, stay?: () => void) {
  if (!root || root.querySelector('.room-exit')) return;
  try { aimUnlock(); } catch (e) { /* not locked */ }
  const el = document.createElement('div'); el.className = 'room-exit';
  el.innerHTML = `<div class="room-exit-box"><b>Where to?</b>${ROOM_EXITS.filter(x => x[0] !== here).map(x => `<button data-rx="${x[0]}">${icon(x[2])}<span>${x[1]}</span>${icon('chevron')}</button>`).join('')}<button data-rx="stay" class="stay">Stay here</button></div>`;
  el.addEventListener('click', ev => { ev.stopPropagation(); const b = (ev.target as HTMLElement).closest('[data-rx]') as HTMLElement; if (!b && ev.target !== el) return; const to = b ? b.getAttribute('data-rx') : 'stay'; el.remove(); Sound.tick(); if (to === 'stay') { if (stay) stay(); return; } leave(to); });
  el.addEventListener('pointerdown', ev => ev.stopPropagation()); el.addEventListener('pointerup', ev => ev.stopPropagation());
  const esc$ = (e: KeyboardEvent) => { if (e.key !== 'Escape') return; if (!el.isConnected) { window.removeEventListener('keydown', esc$, true); return; } e.preventDefault(); e.stopImmediatePropagation(); el.remove(); window.removeEventListener('keydown', esc$, true); if (stay) stay(); };
  window.addEventListener('keydown', esc$, true);
  root.appendChild(el);
}
/** After leaving a room: on to where you chose. */
function roomGoTo(to: string) {
  try { closeAll(); } catch (e) { /* nothing open */ }
  if (to.indexOf('visit:') === 0) { const v = to.slice(6).split('|'); go('hangars'); setTimeout(() => HangarRoom.open(v[0], v[1], v[2]), 60); }
  else if (to === 'hangars') go('hangars');
  else if (to === 'lounges') go('lounges');
  else if (to.indexOf('lvisit:') === 0) { go('lounges'); setTimeout(() => LoungeRoom.open(to.slice(7)), 60); }
  else if (to === 'office') { go('ops'); setTimeout(() => ACTIONS['office-open'](null, null), 60); }
  else if (to === 'ops') { go('ops'); setTimeout(() => ACTIONS['ops-room'](null, null), 60); }
  else if (to === 'court') { go('ops'); setTimeout(() => ACTIONS['court-enter'](null, null), 60); }
  else go('ops');
}

/** A place picked on a computer (or anywhere) while you are in one of the rooms: the screen goes away, you leave the
 *  room through its own loading screen, and the place opens. The room you are in just shows itself again. */
function roomLeaveFor(dest: string): boolean {
  const H: any = typeof HangarRoom !== 'undefined' ? HangarRoom : null, O: any = typeof OpsRoom !== 'undefined' ? OpsRoom : null, F: any = typeof OfficeRoom !== 'undefined' ? OfficeRoom : null;
  const LR: any = typeof LoungeRoom !== 'undefined' ? LoungeRoom : null;
  const here = H && H.on ? 'hangars' : O && O.on ? 'ops' : F && F.on ? 'office' : LR && LR.on ? 'lounges' : ''; if (!here) return false;
  if (dest === here) { if (here === 'hangars' && H.overlay) hgScreenClose(); else if (here === 'ops' && O.overlay) opsScreenClose(); else if (here === 'office') { try { closeAll(); } catch (e) { /* none */ } try { if (F.overlay && typeof ofLaptopClose === 'function') ofLaptopClose(); } catch (e) { /* none */ } } return true; }
  try { if (Lap.root) lapUnmount(); } catch (e) { /* closed */ }
  try { closeAll(); } catch (e) { /* none */ }
  if (here === 'lounges') { lgLeave(dest); return true; }
  if (here === 'hangars') { if (H.overlay) { H.overlay.remove(); H.overlay = null; document.body.classList.remove('of-over'); } hgLeave(dest); }
  else if (here === 'ops') { if (O.overlay) { O.overlay.remove(); O.overlay = null; document.body.classList.remove('of-over'); } opsLeave(dest); }
  else ofExitToMain('', dest);
  return true;
}
(() => {
  const wrap = (k: string, dest: (el: any) => string) => { const f = ACTIONS[k]; ACTIONS[k] = (el: any, ev: any) => { if (roomLeaveFor(dest(el))) return; f(el, ev); }; };
  wrap('office-open', () => 'office'); wrap('ops-room', () => 'ops'); wrap('court-enter', () => 'court');
})();

ACTIONS['hangar-visit'] = el => { const g = (k: string) => el && el.getAttribute ? el.getAttribute(k) || '' : ''; const to = 'visit:' + [g('data-reg'), g('data-base'), g('data-size')].join('|');
  if ((HangarRoom.on || (typeof OpsRoom !== 'undefined' && OpsRoom.on) || (typeof OfficeRoom !== 'undefined' && OfficeRoom.on) || (typeof LoungeRoom !== 'undefined' && LoungeRoom.on)) && roomLeaveFor(to)) return;
  closeAll(); HangarRoom.open(g('data-reg'), g('data-base'), g('data-size')); };
