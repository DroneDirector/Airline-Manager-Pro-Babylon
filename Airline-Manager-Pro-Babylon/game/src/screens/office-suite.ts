/* Your private suite behind the office (the "Dark hotel suite"): a door in the office's back wall opens on a short
 * hall; off it a bathroom (a wall-hung toilet you can use, a vanity with a basin to wash your hands at, a mirror that
 * really reflects you, a walk-in shower behind a glass panel and a freestanding bath), the bedroom (a double bed with
 * a channelled headboard, nightstands, a lamp you switch on and off, a digital clock showing the game's time, a
 * ceiling light on a switch by the door so the room goes completely dark, an armchair by the window) and a dressing
 * alcove whose wardrobe opens your look.
 *  - Its doors open as you walk up to them and close behind you.
 *  - The visitors and your pet stay in the office: their walks and the pet's bed are as they were.
 *  - Every piece has its own file in suite-props/ (see www/models/README.md). */

const OS_H = 2.7;
/** Where you can walk (each room less a person's half-width), the doorways (open doors only), and what is in the way. */
const OS_ROOMS: number[][] = [[-2.95, -6.15, -1.25, -3.75], [-0.65, -6.15, -0.15, -3.75], [0.45, -6.75, 2.33, -3.75], [-2.95, -10.35, 2.95, -6.75]];
const OS_PASS: { [k: string]: number[] } = { office: [-0.62, -3.8, -0.18, -3.0], bed: [-0.62, -6.8, -0.18, -6.1], bath: [-1.3, -4.7, -0.6, -4.3] };
const OS_OBST: number[][] = [
  [-3.2, -4.25, -2.6, -3.7],     // the toilet
  [-3.2, -5.45, -2.7, -4.25],    // the vanity
  [-2.34, -6.4, -2.26, -5.9],    // the shower's glass panel
  [-1.95, -6.35, -1.15, -4.75],  // the bath
  [-1.45, -10.6, 0.25, -8.3],    // the bed
  [-2.0, -10.6, -1.5, -10.05], [0.3, -10.6, 0.8, -10.05],   // the nightstands
  [2.0, -10.1, 2.8, -9.3],       // the armchair
  [2.58, -6.3, 3.2, -3.6],       // the wardrobe
];
/** Is (x, z) in the suite, or in the doorway to it from the office? */
function osIn(x: number, z: number): boolean { return z < -3.4 || (z < -3.0 && x > -0.62 && x < -0.18); }
/** In the suite: can you stand there? */
function osBlocked(x: number, z: number): boolean {
  const S = OfficeRoom.A && OfficeRoom.A.suite; if (!S) return true;
  let ok = false;
  for (const r of OS_ROOMS) if (x > r[0] && x < r[2] && z > r[1] && z < r[3]) { ok = true; break; }
  if (!ok) for (const k in OS_PASS) { const r = OS_PASS[k], D = S.doors[k]; if (D && D.k > 0.6 && x > r[0] && x < r[2] && z > r[1] && z < r[3]) { ok = true; break; } }
  if (!ok) return true;
  const g = 0.22; for (const b of OS_OBST) if (x > b[0] - g && x < b[2] + g && z > b[1] - g && z < b[3] + g) return true;
  return false;
}

/* ---------- pictures ---------- */
function osTex(w: number, h: number, f: (x: CanvasRenderingContext2D, w: number, h: number) => void, rx?: number, ry?: number): any { const [c, x] = ctCanvas(w, h); f(x, w, h); return ctTex(c, rx || 1, ry || 1); }
function osWood(c1: string, c2: string, seed: number, planks: number, rx = 1, ry = 1): any {
  return osTex(1024, 1024, (x, w, h) => { const r = ctRng(seed), n = planks, pw = w / n;
    for (let i = 0; i < n; i++) { const off = r() * h, g = x.createLinearGradient(i * pw, 0, (i + 1) * pw, 0), t = r() * 0.25; g.addColorStop(0, c1); g.addColorStop(0.5 + t, c2); g.addColorStop(1, c1); x.fillStyle = g; x.fillRect(i * pw, 0, pw, h);
      for (let k = 0; k < 40; k++) { x.strokeStyle = `rgba(40,20,8,${0.05 + r() * 0.12})`; x.lineWidth = 0.5 + r() * 1.6; x.beginPath(); const xx = i * pw + r() * pw; x.moveTo(xx, 0); for (let y = 0; y <= h; y += 32) x.lineTo(xx + Math.sin((y + off) / 90 + k) * 4, y); x.stroke(); }
      x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(i * pw, 0, 1.5, h); x.fillRect(i * pw, off % h, pw, 1.5); } }, rx, ry);
}
function osTiles(c: string, grout: string, nx: number, ny: number, seed: number, rx = 1, ry = 1): any {
  return osTex(1024, 1024, (x, w, h) => { const r = ctRng(seed); x.fillStyle = grout; x.fillRect(0, 0, w, h); const tw = w / nx, th = h / ny, base = new THREE.Color(c);
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { const cc = base.clone().multiplyScalar(1 + (r() - 0.5) * 0.1); x.fillStyle = '#' + cc.getHexString(); x.fillRect(i * tw + 2, j * th + 2, tw - 4, th - 4);
      const g = x.createLinearGradient(i * tw, j * th, (i + 1) * tw, (j + 1) * th); g.addColorStop(0, 'rgba(255,255,255,.08)'); g.addColorStop(1, 'rgba(0,0,0,.05)'); x.fillStyle = g; x.fillRect(i * tw + 2, j * th + 2, tw - 4, th - 4); } }, rx, ry);
}
function osMarble(base: string, vein: string, seed: number): any {
  return osTex(1024, 1024, (x, w, h) => { const r = ctRng(seed); x.fillStyle = base; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { x.fillStyle = `rgba(0,0,0,${r() * 0.025})`; x.fillRect(r() * w, r() * h, 3 + r() * 30, 3 + r() * 30); }
    for (let v = 0; v < 14; v++) { x.strokeStyle = vein; x.globalAlpha = 0.15 + r() * 0.45; x.lineWidth = 0.6 + r() * 2.4; x.beginPath(); let px = r() * w, py = 0; x.moveTo(px, py); while (py < h) { px += (r() - 0.45) * 60; py += 20 + r() * 40; x.lineTo(px, py); } x.stroke(); }
    x.globalAlpha = 1; });
}
function osFabric(c: string, seed: number): any {
  return osTex(512, 512, (x, w, h) => { const r = ctRng(seed); x.fillStyle = c; x.fillRect(0, 0, w, h); for (let i = 0; i < w; i += 2) { x.fillStyle = `rgba(255,255,255,${r() * 0.05})`; x.fillRect(i, 0, 1, h); x.fillStyle = `rgba(0,0,0,${r() * 0.06})`; x.fillRect(0, i, w, 1); } });
}
function osPlaster(c: string, seed: number, rx = 2, ry = 1): any {
  return osTex(512, 512, (x, w, h) => { const r = ctRng(seed); x.fillStyle = c; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 120; i++) { const X = r() * w, Y = r() * h, R = 20 + r() * 60, g = x.createRadialGradient(X, Y, 0, X, Y, R); g.addColorStop(0, `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${r() * 0.03})`); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(X - R, Y - R, R * 2, R * 2); }
    for (let i = 0; i < 20000; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${r() * 0.025})`; x.fillRect(r() * w, r() * h, 1, 1); } }, rx, ry);
}
function osClockDraw(c: HTMLCanvasElement, t: string) {
  const x = c.getContext('2d') as CanvasRenderingContext2D, w = c.width, h = c.height; x.fillStyle = '#050505'; x.fillRect(0, 0, w, h);
  x.fillStyle = '#FF7A3D'; x.shadowColor = '#FF5A1F'; x.shadowBlur = 12; x.font = 'bold 76px monospace'; x.textAlign = 'center'; x.fillText(t, w / 2, 76); x.shadowBlur = 0;
}

/* ---------- building it ---------- */
/** Build the suite into the office's root (the office's own coordinates). Returns its state (A.suite). */
function osBuild(root: any, q: number): any {
  const T = THREE, H = OS_H, S: any = { doors: {}, lights: [], occ: [], hits: [], lampOn: true, mainOn: true, k: 0, dark: 1, base: null };
  const M = (o: any) => new T.MeshStandardMaterial(Object.assign({ roughness: 0.7 }, o)), P = (o: any) => new T.MeshPhysicalMaterial(Object.assign({ roughness: 0.3 }, o));
  const brass = M({ color: 0xC09A5E, metalness: 1, roughness: 0.28 });
  const mat = {
    floor: M({ map: osWood('#4E3A2C', '#634A38', 77, 10, 2, 2), roughness: 0.5 }), wall: M({ map: osPlaster('#2E3136', 42), roughness: 0.9 }), accent: M({ map: osPlaster('#1F2226', 2), roughness: 0.9 }),
    tile: M({ map: osTiles('#2B2B2E', '#1C1C1E', 3, 6, 35, 2, 2), roughness: 0.3 }), btile: M({ map: osTiles('#4A4A4E', '#2A2A2E', 3, 3, 36, 2.2 / 1.2, 3 / 1.2), roughness: 0.35 }),
    ceil: M({ color: 0xE9E5DE, roughness: 0.9 }), van: M({ map: osWood('#2A1F18', '#3A2B20', 98, 10), roughness: 0.45 }), top: M({ map: osMarble('#1C1C1E', '#C8A15A', 21), roughness: 0.25 }),
    por: P({ color: 0xFAFAF8, roughness: 0.08, clearcoat: 1 }), door: M({ map: osWood('#2A1F18', '#3A2B20', 61, 4), roughness: 0.4 }),
  };
  const group = (name: string, x = 0, z = 0, ry = 0) => { const g = new T.Group(); g.name = name; g.position.set(x, 0, z); g.rotation.y = ry; root.add(g); return g; };
  const box = (par: any, w: number, h: number, d: number, m: any, x: number, y: number, z: number, ry?: number) => { const o = new T.Mesh(new T.BoxGeometry(w, h, d), m); o.position.set(x, y, z); if (ry) o.rotation.y = ry; o.castShadow = q >= 1; o.receiveShadow = true; par.add(o); return o; };
  const rbox = (par: any, w: number, h: number, d: number, r: number, m: any, x: number, y: number, z: number, ry?: number) => {
    const s = new T.Shape(), hw = w / 2, hd = d / 2; r = Math.min(r, hw, hd);
    s.moveTo(-hw + r, -hd); s.lineTo(hw - r, -hd); s.quadraticCurveTo(hw, -hd, hw, -hd + r); s.lineTo(hw, hd - r); s.quadraticCurveTo(hw, hd, hw - r, hd); s.lineTo(-hw + r, hd); s.quadraticCurveTo(-hw, hd, -hw, hd - r); s.lineTo(-hw, -hd + r); s.quadraticCurveTo(-hw, -hd, -hw + r, -hd);
    const g = new T.ExtrudeGeometry(s, { depth: h, bevelEnabled: true, bevelThickness: Math.min(0.01, h / 4), bevelSize: Math.min(0.01, r / 2), bevelSegments: 3, curveSegments: 8 }); g.rotateX(-Math.PI / 2);
    const o = new T.Mesh(g, m); o.position.set(x, y, z); if (ry) o.rotation.y = ry; o.castShadow = q >= 1; o.receiveShadow = true; par.add(o); return o; };
  const cyl = (par: any, rt: number, rb: number, h: number, m: any, x: number, y: number, z: number, seg?: number) => { const o = new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg || 32), m); o.position.set(x, y, z); o.castShadow = q >= 1; o.receiveShadow = true; par.add(o); return o; };
  const lathe = (par: any, pts: number[][], m: any, x: number, y: number, z: number, seg?: number) => { const o = new T.Mesh(new T.LatheGeometry(pts.map(p => new T.Vector2(p[0], p[1])), seg || 48), m); o.position.set(x, y, z); o.castShadow = q >= 1; o.receiveShadow = true; par.add(o); return o; };
  const plane = (par: any, w: number, h: number, m: any, x: number, y: number, z: number, rx: number, ry: number) => { const o = new T.Mesh(new T.PlaneGeometry(w, h), m); o.position.set(x, y, z); o.rotation.set(rx, ry, 0, 'YXZ'); o.receiveShadow = true; par.add(o); return o; };
  const swap = (g: any, name: string) => { try { Models.swap(g, 'suite-props/' + name + '.glb', false); } catch (e) { /* the app's own */ } };
  const hit = (par: any, w: number, h: number, d: number, x: number, y: number, z: number, act: string) => { const o = new T.Mesh(new T.BoxGeometry(w, h, d), new T.MeshBasicMaterial({ visible: false })); o.position.set(x, y, z); o.userData.act = act; o.userData.keep = true; par.add(o); S.hits.push(o); return o; };
  const occ = new T.MeshBasicMaterial({ visible: false });
  const shell = group('suite-shell');
  /** A wall at z = c (ax 'z', running along x) or x = c (ax 'x', running along z), from a0 to a1, facing +1/−1 along its
   *  normal, with doorways (gaps: [from, to, height]). Each piece also stops clicks through it. */
  const wall = (ax: 'x' | 'z', c: number, a0: number, a1: number, face: number, m: any, gaps?: number[][]) => {
    const ry = ax === 'z' ? (face > 0 ? 0 : Math.PI) : (face > 0 ? Math.PI / 2 : -Math.PI / 2);
    const piece = (b0: number, b1: number, y0: number, y1: number) => { if (b1 - b0 < 0.005 || y1 - y0 < 0.005) return; const mid = (b0 + b1) / 2, ym = (y0 + y1) / 2;
      const p = new T.Mesh(new T.PlaneGeometry(b1 - b0, y1 - y0), m); p.position.set(ax === 'z' ? mid : c, ym, ax === 'z' ? c : mid); p.rotation.y = ry; p.receiveShadow = true; shell.add(p);
      if (m.map) { /* keep the texture's scale the same on every piece */ const uv = p.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (b1 - b0) / 2, uv.getY(i) * (y1 - y0) / 2); }
      const o = new T.Mesh(new T.BoxGeometry(ax === 'z' ? b1 - b0 : 0.1, y1 - y0, ax === 'z' ? 0.1 : b1 - b0), occ); o.position.copy(p.position); shell.add(o); S.occ.push(o); };
    const gs = (gaps || []).slice().sort((a, b) => a[0] - b[0]); let at = a0;
    for (const g of gs) { piece(at, g[0], 0, H); piece(g[0], g[1], g[2], H); at = g[1]; }
    piece(at, a1, 0, H);
  };
  // ---- the rooms: floors, ceilings, walls ----
  const floor = (x0: number, z0: number, x1: number, z1: number, m: any) => { const f = plane(shell, x1 - x0, z1 - z0, m, (x0 + x1) / 2, 0, (z0 + z1) / 2, -Math.PI / 2, 0); const c = plane(shell, x1 - x0, z1 - z0, mat.ceil, (x0 + x1) / 2, H, (z0 + z1) / 2, Math.PI / 2, 0); void f; void c; };
  floor(-3.2, -6.4, -1.0, -3.5, mat.btile); floor(-1.0, -6.5, 0.2, -3.4, mat.floor); floor(0.1, -6.5, 3.2, -3.5, mat.floor); floor(-3.2, -10.6, 3.2, -6.5, mat.floor);
  const DOOR_H = 2.1;
  // the bathroom (tiles all round)
  wall('x', -3.2, -6.4, -3.5, 1, mat.tile); wall('z', -3.5, -3.2, -1.0, -1, mat.tile); wall('z', -6.4, -3.2, -1.0, 1, mat.tile); wall('x', -1.0, -6.4, -3.5, -1, mat.tile, [[-4.9, -4.1, DOOR_H]]);
  // the hall
  wall('x', -0.9, -6.4, -3.5, 1, mat.wall, [[-4.9, -4.1, DOOR_H]]); wall('x', 0.1, -6.4, -3.5, -1, mat.wall); wall('z', -3.5, -0.9, 0.1, -1, mat.wall, [[-0.8, 0.0, DOOR_H]]); wall('z', -6.4, -0.9, 0.1, 1, mat.wall, [[-0.8, 0.0, DOOR_H]]);
  // the dressing alcove (open to the bedroom)
  wall('z', -3.5, 0.2, 3.2, -1, mat.wall); wall('x', 0.2, -6.5, -3.5, 1, mat.wall); wall('x', 3.2, -6.5, -3.5, -1, mat.wall);
  // the bedroom
  wall('z', -10.6, -3.2, 3.2, 1, mat.accent); wall('x', -3.2, -10.6, -6.5, 1, mat.wall); wall('x', 3.2, -10.6, -6.5, -1, mat.wall); wall('z', -6.5, -3.2, 0.2, -1, mat.wall, [[-0.8, 0.0, DOOR_H]]);
  // the thickness of the walls round the doorways, and the frames
  const frame = (ax: 'x' | 'z', c: number, a0: number, a1: number) => { const mid = (a0 + a1) / 2, w = a1 - a0;
    for (const a of [a0 - 0.03, a1 + 0.03]) box(shell, ax === 'z' ? 0.06 : 0.14, DOOR_H + 0.04, ax === 'z' ? 0.14 : 0.06, mat.door, ax === 'z' ? a : c, (DOOR_H + 0.04) / 2, ax === 'z' ? c : a);
    box(shell, ax === 'z' ? w + 0.12 : 0.14, 0.07, ax === 'z' ? 0.14 : w + 0.12, mat.door, ax === 'z' ? mid : c, DOOR_H + 0.035, ax === 'z' ? c : mid); };
  frame('z', -3.45, -0.8, 0.0); frame('z', -6.45, -0.8, 0.0); frame('x', -0.95, -4.9, -4.1);
  // ---- the doors: hinged leaves that open as you come up to them ----
  const door = (k: string, hx: number, hz: number, len: number, along: number[], openTo: number) => {
    const g = group('suite-door', hx, hz); const leaf = new T.Group(); g.add(leaf);
    const lx = along[0] * len / 2, lz = along[1] * len / 2;
    box(leaf, along[0] ? len - 0.02 : 0.04, DOOR_H - 0.02, along[1] ? len - 0.02 : 0.04, mat.door, lx, (DOOR_H - 0.02) / 2, lz);
    for (const s of [-1, 1]) cyl(leaf, 0.02, 0.02, 0.03, brass, along[0] * (len - 0.1) + (along[1] ? s * 0.035 : 0), 1.0, along[1] * (len - 0.1) + (along[0] ? s * 0.035 : 0), 12).rotation[along[0] ? 'x' : 'z'] = Math.PI / 2;
    swap(g, 'suite-door');
    S.doors[k] = { leaf, k: 0, to: 0, open: openTo, at: [hx + along[0] * len / 2, hz + along[1] * len / 2] };
  };
  door('office', 0.0, -3.45, 0.8, [-1, 0], -1.5); door('bed', 0.0, -6.45, 0.8, [-1, 0], -1.5); door('bath', -0.95, -4.1, 0.8, [0, -1], 1.5);
  // ---- the bathroom ----
  { // the vanity: walnut, a black stone top veined with gold, the stone up the wall behind it
    const vz = -4.85, vw = 1.2, g = group('vanity');
    box(g, 0.5, 0.45, vw, mat.van, -3.2 + 0.25, 0.58, vz); box(g, 0.52, 0.04, vw + 0.04, mat.top, -3.2 + 0.26, 0.82, vz); box(g, 0.02, H, vw + 0.3, mat.top, -3.2 + 0.01, H / 2, vz); swap(g, 'vanity');
    const b = group('basin'); rbox(b, 0.42, 0.12, 0.36, 0.03, mat.por, -3.2 + 0.3, 0.84, vz);
    const sp = cyl(b, 0.012, 0.012, 0.2, brass, -3.2 + 0.11, 1.08, vz); sp.rotation.z = Math.PI / 2; cyl(b, 0.02, 0.02, 0.06, brass, -3.2 + 0.03, 1.08, vz); swap(b, 'basin');
    const st = new T.Mesh(new T.CylinderGeometry(0.006, 0.008, 0.22, 10), new T.MeshStandardMaterial({ color: 0xCFE6F2, roughness: 0.05, transparent: true, opacity: 0.55 })); st.position.set(-3.2 + 0.2, 0.96, vz); st.visible = false; root.add(st); S.stream = st;
    hit(root, 0.5, 0.4, 0.5, -3.2 + 0.3, 0.95, vz, 'suite-basin');
    // the mirror: a lit frame, and the glass that really reflects
    const mf = group('bath-mirror'); box(mf, 0.04, 0.9 + 0.05, 1.0 + 0.05, M({ color: 0xFFF4DE, emissive: 0xFFE6B8, emissiveIntensity: 1.6 }), -3.2 + 0.03, 1.62, vz); swap(mf, 'bath-mirror');
    try { S.mirror = lgMirror(root, 1.0, 0.9, -3.2 + 0.055, 1.62, vz, Math.PI / 2, 0xE8EEF2); S.mirror.userData.keep = true; } catch (e) { S.mirror = null; }
  }
  { // the toilet: wall-hung, a brass flush plate; the lid lifts when you use it
    const g = group('toilet', -3.2 + 0.22, -3.95);
    box(g, 0.22, 1.1, 0.75, mat.top, -0.11, 0.55, 0); box(g, 0.012, 0.15, 0.24, brass, 0.005, 1.0, 0);
    const pan = lathe(g, [[0, 0.0], [0.1, 0.0], [0.15, 0.04], [0.18, 0.12], [0.19, 0.2], [0.19, 0.24], [0.17, 0.245], [0.15, 0.2], [0.05, 0.12], [0, 0.11]], mat.por, 0.27, 0.16, 0, 64); pan.scale.set(1.45, 1, 1);
    rbox(g, 0.3, 0.26, 0.34, 0.12, mat.por, 0.12, 0.16, 0);
    const seat = new T.Mesh(new T.TorusGeometry(0.15, 0.028, 16, 64), mat.por); seat.rotation.x = Math.PI / 2; seat.scale.set(1.5, 1.05, 0.55); seat.position.set(0.28, 0.42, 0); g.add(seat);
    const ls = new T.Shape(); ls.absellipse(0, 0, 0.235, 0.18, 0, Math.PI * 2, false, 0); const lg = new T.ExtrudeGeometry(ls, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 4, curveSegments: 48 }); lg.rotateX(-Math.PI / 2);
    const hinge = new T.Group(); hinge.name = 'lid'; hinge.position.set(0.07, 0.44, 0); g.add(hinge); const lid = new T.Mesh(lg, mat.por); lid.position.set(0.23, 0, 0); hinge.add(lid); S.lid = hinge;
    swap(g, 'toilet'); S.lid = g.getObjectByName('lid') || hinge;
    hit(root, 0.65, 0.9, 0.6, -3.2 + 0.4, 0.6, -3.95, 'suite-toilet');
  }
  { // the walk-in shower: a tray of small tiles, a glass panel in a brass frame, the rain head; the valve on the wall
    const g = group('shower'), x0 = -3.2, z0 = -6.4, x1 = -2.3, z1 = -5.55, glass = P({ color: 0xE9F3F4, roughness: 0.02, transparent: true, opacity: 0.22, depthWrite: false });
    box(g, x1 - x0, 0.01, z1 - z0, M({ map: osTiles('#2A2A2E', '#141416', 8, 8, 37), roughness: 0.35 }), (x0 + x1) / 2, 0.006, (z0 + z1) / 2);
    box(g, 0.012, 2.0, 0.5, glass, x1, 1.0, z0 + 0.25).castShadow = false; box(g, 0.02, 0.02, 0.5, brass, x1, 2.0, z0 + 0.25); box(g, 0.02, 2.0, 0.02, brass, x1, 1.0, z0 + 0.5);
    cyl(g, 0.15, 0.15, 0.012, brass, (x0 + x1) / 2, H - 0.45, (z0 + z1) / 2); cyl(g, 0.01, 0.01, 0.4, brass, (x0 + x1) / 2, H - 0.25, (z0 + z1) / 2);
    const v = cyl(g, 0.05, 0.05, 0.03, brass, x0 + 0.02, 1.2, (z0 + z1) / 2 + 0.25); v.rotation.z = Math.PI / 2; swap(g, 'shower');
    hit(root, 0.3, 0.4, 0.4, x0 + 0.1, 1.2, (z0 + z1) / 2 + 0.25, 'suite-shower'); hit(root, 0.9, 0.3, 0.85, (x0 + x1) / 2, H - 0.45, (z0 + z1) / 2, 'suite-shower');
    // the water: falling streaks under the head (shown while it runs)
    const n = q >= 1 ? 160 : 80, pos = new Float32Array(n * 6); const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    const lines = new T.LineSegments(geo, new T.LineBasicMaterial({ color: 0xCFE6F2, transparent: true, opacity: 0.45, depthWrite: false })); lines.frustumCulled = false; lines.visible = false; root.add(lines);
    S.rain = { lines, pos, n, y: H - 0.46, c: [(x0 + x1) / 2, (z0 + z1) / 2], d: new Float32Array(n).map(() => Math.random() * (H - 0.5)) };
  }
  { // the freestanding bath, with its filler
    const g = group('bathtub'), x = -1.55, z = -5.55, len = 1.6;
    const sh = new T.Shape(); sh.absellipse(0, 0, len / 2, 0.38, 0, Math.PI * 2, false, 0); const og = new T.ExtrudeGeometry(sh, { depth: 0.55, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 6, curveSegments: 64 }); og.rotateX(-Math.PI / 2);
    const o = new T.Mesh(og, mat.por); o.position.set(x, 0, z); o.rotation.y = Math.PI / 2; o.castShadow = q >= 1; g.add(o);
    const ih = new T.Shape(); ih.absellipse(0, 0, len / 2 - 0.07, 0.31, 0, Math.PI * 2, false, 0); const ig = new T.ShapeGeometry(ih, 48); ig.rotateX(-Math.PI / 2);
    const w = new T.Mesh(ig, P({ color: 0xBFD8E2, roughness: 0.05, transparent: true, opacity: 0.85 })); w.position.set(x, 0.5, z); w.rotation.y = Math.PI / 2; g.add(w);
    cyl(g, 0.015, 0.015, 0.9, brass, x + 0.5, 0.45, z + len / 2 - 0.15); const a = cyl(g, 0.012, 0.012, 0.18, brass, x + 0.43, 0.9, z + len / 2 - 0.15); a.rotation.z = Math.PI / 2; swap(g, 'bathtub');
  }
  { // a heated towel rail on the wall by the door, a towel on it
    const g = group('towel-rail'); for (let i = 0; i < 6; i++) cyl(g, 0.012, 0.012, 0.5, brass, -1.35, 0.7 + i * 0.12, -3.5 - 0.06).rotation.z = Math.PI / 2;
    box(g, 0.5, 0.35, 0.05, M({ map: osFabric('#7A5A2E', 4), roughness: 1 }), -1.35, 1.05, -3.5 - 0.1); swap(g, 'towel-rail');
  }
  // ---- the bedroom ----
  { const view = new T.MeshBasicMaterial({ map: ctTex(ofView()), toneMapped: false });   // the same view as the office's window, further along
    plane(shell, 2.2, 1.6, view, 3.2 - 0.02, 1.45, -8.5, 0, -Math.PI / 2);
    for (const z of [-9.6, -8.5, -7.4]) box(shell, 0.06, 1.65, 0.05, M({ color: 0x1E1E20 }), 3.2 - 0.04, 1.45, z); box(shell, 0.25, 0.04, 2.3, M({ color: 0xEDE9E2 }), 3.2 - 0.12, 0.63, -8.5);
    for (const z of [-9.95, -7.05]) box(shell, 0.05, 2.5, 0.5, M({ map: osFabric('#7A5A2E', 6), roughness: 1 }), 3.2 - 0.2, 1.3, z); }
  { // the bed against the north wall: a green channelled headboard, white sheets, a dark duvet, an ochre throw
    const bw = 1.6, bl = 2.1, g = group('bed', -0.6, -10.6), hbM = M({ map: osFabric('#2E4A44', 63), roughness: 0.95 }), by = 0.35;
    for (let i = 0; i < 9; i++) rbox(g, 0.22, 1.2, 0.14, 0.08, hbM, -0.92 + i * 0.23, 0, 0.08);
    box(g, bw + 0.08, 0.3, bl, hbM, 0, 0.2, 0.15 + bl / 2);
    rbox(g, bw, 0.22, bl - 0.05, 0.06, M({ map: osFabric('#EDEAE4', 5), roughness: 1 }), 0, by, 0.15 + bl / 2);
    rbox(g, bw + 0.06, 0.06, 1.3, 0.04, M({ map: osFabric('#2F3A3A', 7), roughness: 1 }), 0, by + 0.22, 1.55);
    rbox(g, bw + 0.1, 0.03, 0.45, 0.02, M({ map: osFabric('#7A5A2E', 8), roughness: 1 }), 0, by + 0.28, 1.85);
    for (const dx of [-0.42, 0.42]) { const pw = rbox(g, 0.62, 0.16, 0.42, 0.1, M({ map: osFabric('#EDEAE4', 9), roughness: 1 }), dx, by + 0.22, 0.42); pw.rotation.x = -0.35; }
    swap(g, 'bed');
    // the nightstands (green, a brass pull)
    for (const sx of [-bw / 2 - 0.35, bw / 2 + 0.35]) { const n = group('nightstand', -0.6 + sx, -10.6); box(n, 0.5, 0.5, 0.42, hbM, 0, 0.3, 0.3); box(n, 0.12, 0.012, 0.015, brass, 0, 0.45, 0.52); swap(n, 'nightstand'); }
    // the lamp on the left one (on and off)
    const lsx = -0.6 - bw / 2 - 0.43, lz = -10.6 + 0.28, lp = group('bed-lamp'), lm = M({ color: 0xC09A5E, metalness: 0.5, roughness: 0.3 });
    lathe(lp, [[0, 0], [0.07, 0], [0.075, 0.02], [0.04, 0.05], [0.025, 0.25], [0.03, 0.27], [0, 0.27]], lm, lsx, 0.55, lz);
    const shade = lathe(lp, [[0.09, 0], [0.15, 0], [0.12, 0.2], [0.08, 0.2]], M({ color: 0xE9D8B4, emissive: 0xFFD9A0, emissiveIntensity: 1.3, side: T.DoubleSide, roughness: 1 }), lsx, 0.8, lz); swap(lp, 'bed-lamp');
    const L = new T.PointLight(0xFFC98A, 3, 5, 2); L.position.set(lsx, 0.9, lz + 0.07); root.add(L); S.lamp = { L, shade, base: 3 };
    hit(root, 0.4, 0.5, 0.4, lsx, 0.8, lz, 'suite-lamp');
    // the clock beside it: the game's time
    const ck = group('bedside-clock'), [cc] = ctCanvas(256, 96); box(ck, 0.16, 0.07, 0.06, M({ color: 0x151517, roughness: 0.3 }), lsx + 0.21, 0.585, lz + 0.04); swap(ck, 'bedside-clock');
    const ctex = ctTex(cc); const face = new T.Mesh(new T.PlaneGeometry(0.14, 0.05), new T.MeshBasicMaterial({ map: ctex, toneMapped: false })); face.position.set(lsx + 0.21, 0.585, lz + 0.071); root.add(face);
    S.clock = { c: cc, tex: ctex, t: '' };
    // the painting over the bed
    const art = group('bedroom-art'); box(art, 1.24, 0.84, 0.04, M({ color: 0x1A1A1A }), -0.6, 1.85, -10.6 + 0.03);
    const pic = new T.Mesh(new T.PlaneGeometry(1.16, 0.76), M({ map: ctTex(lgPainting('gold', 1.16, 0.76)), roughness: 0.8 })); pic.position.set(-0.6, 1.85, -10.6 + 0.052); art.add(pic); swap(art, 'bedroom-art');
    // the rug, the armchair by the window
    const rug = group('bedroom-rug'); box(rug, 2.6, 0.012, 1.9, M({ map: osFabric('#3A3530', 11), roughness: 1 }), -0.6, 0.006, -10.6 + 2.4).castShadow = false; swap(rug, 'bedroom-rug');
    const ch = group('bedroom-armchair', 2.4, -9.7, -2.3), lea = M({ map: osFabric('#7A5A2E', 13), roughness: 0.7 });
    rbox(ch, 0.75, 0.18, 0.7, 0.08, lea, 0, 0.3, 0); rbox(ch, 0.75, 0.55, 0.14, 0.06, lea, 0, 0.45, -0.3); for (const s of [-1, 1]) rbox(ch, 0.12, 0.3, 0.7, 0.05, lea, s * 0.36, 0.45, 0);
    for (const lx of [-0.3, 0.3]) for (const lz2 of [-0.28, 0.28]) cyl(ch, 0.015, 0.012, 0.3, brass, lx, 0.15, lz2); swap(ch, 'bedroom-armchair');
  }
  { // the wardrobe in the alcove: open it for your look
    const g = group('wardrobe'); box(g, 0.62, 2.4, 2.7, mat.van, 3.2 - 0.31, 1.2, -4.95);
    for (const z of [-6.25, -5.6, -4.95, -4.3, -3.65]) box(g, 0.01, 2.3, 0.005, M({ color: 0x5A4A3A }), 3.2 - 0.618, 1.2, z);
    for (const z of [-5.75, -5.45, -4.45, -4.15]) cyl(g, 0.008, 0.008, 0.3, brass, 3.2 - 0.635, 1.2, z, 10);
    swap(g, 'wardrobe'); hit(root, 0.3, 2.2, 2.6, 3.2 - 0.7, 1.15, -4.95, 'suite-wardrobe');
  }
  // the light switch inside the bedroom door
  { const sw = box(shell, 0.08, 0.12, 0.015, M({ color: 0x1A1A1C, roughness: 0.4 }), -1.05, 1.2, -6.5 - 0.01); sw.castShadow = false; const k = box(shell, 0.03, 0.05, 0.01, brass, -1.05, 1.2, -6.5 - 0.02); S.switchKnob = k;
    hit(root, 0.2, 0.25, 0.1, -1.05, 1.2, -6.55, 'suite-light'); }
  // ---- the lights ----
  const dl = new T.MeshBasicMaterial({ color: 0xFFF6E8, toneMapped: false });
  const spot = (x: number, z: number, k: number, ang: number, zone: string) => { const s = new T.SpotLight(0xFFDDB0, k, 5, ang, 0.6, 2); s.position.set(x, H - 0.05, z); s.target.position.set(x, 0, z); root.add(s); root.add(s.target);
    const d = new T.Mesh(new T.CircleGeometry(0.05, 18), dl); d.rotation.x = Math.PI / 2; d.position.set(x, H - 0.006, z); root.add(d); S.lights.push({ L: s, base: k, zone, disc: d }); return s; };
  spot(-2.1, -4.3, 6, 0.55, 'bath'); if (q >= 1) spot(-2.4, -5.8, 5, 0.55, 'bath');
  { const f = new T.PointLight(0xFFF4E6, 1.6, 3.5, 2); f.position.set(-1.6, 2.3, -4.6); root.add(f); S.lights.push({ L: f, base: 1.6, zone: 'bath' }); }
  spot(-0.4, -4.95, 4, 0.5, 'hall');
  spot(-0.6, -8.4, 6, 0.8, 'main'); if (q >= 1) spot(1.6, -5.0, 4, 0.6, 'main');
  // the main light's warm cove round the bedroom ceiling
  { const cove = new T.MeshBasicMaterial({ color: 0xFFC27A, toneMapped: false }); S.cove = [];
    for (const [w, x, z, ry] of [[6.2, 0, -10.5, 0], [4.0, -3.1, -8.55, Math.PI / 2], [4.0, 3.1, -8.55, Math.PI / 2]] as number[][]) { const c = box(shell, w, 0.03, 0.06, cove, x, H - 0.04, z, ry); c.castShadow = false; S.cove.push(c); } }
  return S;
}

/* ---------- each frame ---------- */
function osStep(R: any, dt: number, now: number) {
  const A = R.A, S = A && A.suite, T = THREE; if (!S) return;
  const F = R.free, px = R.seat || !F ? 0 : F.x, pz = R.seat || !F ? 0 : F.z, inside = !R.seat && F && pz < -3.45;
  // the doors: open as you come up to them, shut behind you
  for (const k in S.doors) { const D = S.doors[k], d = Math.hypot(px - D.at[0], pz - D.at[1]); D.to = !R.seat && d < 1.4 ? 1 : 0;
    if (D.k !== D.to) { const was = D.k; D.k += Math.sign(D.to - D.k) * Math.min(Math.abs(D.to - D.k), dt * 1.8); if ((was === 0 && D.k > 0) || (was > 0.02 && D.k <= 0.02 && D.to === 0)) { try { sfxDoor('wood', D.to === 1); } catch (e) { /* quiet */ } } }
    const e = D.k * D.k * (3 - 2 * D.k); D.leaf.rotation.y = D.open * e; }
  // the lights: the suite's when you are in it, the office's (and the building's) dimmed then; the bedroom dark with both off
  S.k += ((inside ? 1 : 0) - S.k) * Math.min(1, dt * 4);
  const inBed = inside && (pz < -6.5 || px > 0.15), dark = inBed && !S.mainOn && !S.lampOn;
  S.dark += ((dark ? 0.04 : inside ? 0.25 : 1) - S.dark) * Math.min(1, dt * 4);
  if (!S.base) { S.base = []; const mine = new Set(S.lights.map((l: any) => l.L).concat([S.lamp.L])); R.scene.traverse((o: any) => { if (o.isLight && !mine.has(o)) S.base.push([o, o.intensity]); }); }
  for (const [o, b] of S.base) o.intensity = b * S.dark;
  for (const l of S.lights) { const on = l.zone === 'hall' ? 1 : l.zone === 'main' ? (S.mainOn ? S.k : 0) : S.k; l.L.intensity = l.base * on; if (l.disc) l.disc.visible = l.zone !== 'main' || S.mainOn; }
  for (const c of S.cove) c.visible = S.mainOn;
  S.lamp.L.intensity = S.lamp.base * (S.lampOn ? Math.max(0.15, S.k) : 0); S.lamp.shade.material.emissiveIntensity = S.lampOn ? 1.3 : 0;
  if (S.switchKnob) S.switchKnob.position.y = 1.2 + (S.mainOn ? 0.012 : -0.012);
  // the clock: the game's time
  { let t = ''; try { t = dclockParts().t; } catch (e) { t = new Date().toTimeString().slice(0, 5); } if (t !== S.clock.t) { S.clock.t = t; osClockDraw(S.clock.c, t); S.clock.tex.needsUpdate = true; } }
  // the toilet's lid, the basin's water, the shower
  if (S.loo) { S.loo.t += dt; const u = S.loo.t, up = u < 0.8 ? u / 0.8 : u < 7.5 ? 1 : Math.max(0, 1 - (u - 7.5) / 0.8); if (S.lid) S.lid.rotation.z = 1.5 * up * up * (3 - 2 * up); if (u > 8.4) { S.loo = null; if (S.lid) S.lid.rotation.z = 0; } }
  if (S.stream) { S.stream.visible = !!(S.wash && S.wash.t < 4.5); if (S.wash) { S.wash.t += dt; S.stream.scale.x = S.stream.scale.z = 1 + 0.15 * Math.sin(now * 40); if (S.wash.t > 4.8) S.wash = null; } }
  if (S.rain) { const W = S.rain, on = !!S.showerOn; W.lines.visible = on;
    if (on) { for (let i = 0; i < W.n; i++) { W.d[i] += dt * (3.5 + (i % 7) * 0.2); if (W.d[i] > W.y) W.d[i] -= W.y; const a = i * 2.39996, r = 0.13 * Math.sqrt((i % 37) / 37), x = W.c[0] + Math.cos(a) * r, z = W.c[1] + Math.sin(a) * r, y = W.y - W.d[i];
      W.pos.set([x, y, z, x, Math.max(0.01, y - 0.09), z], i * 6); } W.lines.geometry.attributes.position.needsUpdate = true; } }
  // the bathroom mirror: you in it (your head shown for the mirror only)
  if (S.mirror && inside && px < -0.9 && pz > -6.45) {
    const me = R.me; let shown = false;
    try { if (me && me.m && me.G) { me.m.pose({ t: now, yaw: 0, gaze: [0, 0], blink: 0, g: Object.assign({}, me.G, { lean: 0, nod: 0, shake: 0, tilt: 0 }), noHead: false }); shown = true; } } catch (e) { /* headless */ }
    try { S.mirror.userData.update(R.ren, R.scene, R.cam); } catch (e) { /* the mirror rests */ }
    if (shown) { try { me.m.pose({ t: now, yaw: 0, gaze: [0, 0], blink: 0, g: Object.assign({}, me.G, { lean: 0, nod: 0, shake: 0, tilt: 0 }), noHead: true }); } catch (e) { /* as it was */ } }
  }
  void T;
}
/** Everything back as it was when you leave the office (the lights, the water). */
function osRestore(R: any) {
  const S = R && R.A && R.A.suite; if (!S) return;
  for (const [o, b] of S.base || []) o.intensity = b; S.dark = 1; S.k = 0;
  if (S.showerStop) { try { S.showerStop(); } catch (e) { /* quiet */ } S.showerStop = null; } S.showerOn = false;
}

/* ---------- using things ---------- */
/** Running water (the basin, the shower) or the toilet's trickle and flush: filtered noise, in code. */
function osWater(dur: number, freq: number, gain: number, sweep?: number): () => void {
  const ctx = audio(); if (!ctx) return () => { /* silent */ };
  const len = Math.floor(ctx.sampleRate * 2), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
  const g = ctx.createGain(), t = ctx.currentTime; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.25);
  if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + Math.max(0.5, dur));
  src.connect(f); f.connect(g); g.connect(ctx.destination); src.start(t);
  let done = false; const stop = () => { if (done) return; done = true; const e = ctx.currentTime; g.gain.cancelScheduledValues(e); g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), e); g.gain.exponentialRampToValueAtTime(0.0001, e + 0.4); src.stop(e + 0.45); };
  if (dur > 0) setTimeout(stop, dur * 1000);
  return stop;
}
const OS_HINTS: { [k: string]: string } = { 'suite-toilet': 'Click to use the toilet', 'suite-basin': 'Click to wash your hands', 'suite-shower': 'Click to turn the shower on or off', 'suite-lamp': 'Click to switch the lamp on or off', 'suite-light': 'Click to switch the light on or off', 'suite-wardrobe': 'Click to open the wardrobe: your look' };
function osHint(act: string): string { return OS_HINTS[act] || ''; }
function osClick(act: string) {
  const R = OfficeRoom, S = R.A && R.A.suite; if (!S) return;
  if (act === 'suite-lamp') { S.lampOn = !S.lampOn; Sound.tick(); return; }
  if (act === 'suite-light') { S.mainOn = !S.mainOn; Sound.tick(); return; }
  if (act === 'suite-toilet') { if (S.loo) return; S.loo = { t: 0 }; osWater(6.2, 900, 0.05); setTimeout(() => { if (R.on) { osWater(2.4, 2400, 0.16, 500); try { Sound.tick(); } catch (e) { /* quiet */ } } }, 6600); return; }
  if (act === 'suite-basin') { if (S.wash) return; S.wash = { t: 0 }; osWater(4.5, 1500, 0.08); setTimeout(() => { if (R.on) toast('Your hands are clean', 'ok'); }, 4600); return; }
  if (act === 'suite-shower') { S.showerOn = !S.showerOn; if (S.showerOn) S.showerStop = osWater(0, 1800, 0.12); else if (S.showerStop) { S.showerStop(); S.showerStop = null; } return; }
  if (act === 'suite-wardrobe') { osWardrobe(); return; }
}
/** The wardrobe: your look (the same as Pilots → your pilot), shown over the room; your figure changes with it. */
function osWardrobe() {
  const R = OfficeRoom, me: any = myPilot(); if (!me) return;
  aimUnlock(); Sound.tick();
  try { sfxDoor('wood', true); } catch (e) { /* quiet */ }
  openLookEditor({ title: 'Your wardrobe', role: 'captain', look: me.look, identity: { name: me.name, dob: me.dob, nat: me.nat }, confirmName: 'your pilot',
    onAccept: (look: any, id: any) => {
      me.look = look; me.sex = look.sex; me.lookAccepted = true; if (id) { me.name = id.name; me.dob = id.dob; me.nat = id.nat; }
      Store.save(); try { scheduleBirthdayNotification(); } catch (e) { /* none */ } toast('Your look is saved', 'ok');
      // your figure in the room, dressed anew
      try { const old = R.me; if (old && R.scene && Human.ready) { const nb = selfBody(R.scene, Object.assign({}, look, { hat: 'none' }), company().color); if (nb) { nb.chair = old.chair; nb.eye0 = old.eye0; if (old.g && old.g.parent) old.g.parent.remove(old.g); R.me = nb; if (R.A) R.A.me = nb; } } } catch (e) { /* as it was */ }
    } } as any);
  // over the room (the rooms sit above the app's own windows)
  setTimeout(() => { const L = document.querySelectorAll('#overlay-root .layer'); const el = L[L.length - 1] as HTMLElement; if (el) el.style.zIndex = '1001'; }, 0);
}
