/* Your office, in 3D. A warm, panelled corner office: a walnut executive desk with a leather top, your laptop
 * showing the airline, a banker's lamp, the phone, a notepad, coffee, a model of one of your aircraft in the
 * company colours, your nameplate, and a photo of you with your family; a big window over the airport and the
 * mountains, bookshelves, aviation posters, your route map, a propeller on the wall, a leather sofa, a globe
 * and your trophies.
 *  - Visit it any time (My office): sit in your chair, look at the paintings, the window, the route map, or
 *    walk about freely (W A S D, or the stick); click your chair to sit, click the door to leave.
 *  - Invite a crew member in over a conduct report: they knock, come in, sit down across the desk facing you
 *    and you question them. They answer honestly, defensively, dismissively or lie, in their own words each
 *    time (a library of answers), and their body shows it. Then you keep them, discipline them or dismiss them.
 *    You stay seated (you can look around); their answers can be played aloud, or play by themselves if
 *    Settings → Conduct → Play answers aloud in the office is on.
 * Everything is our own: drawn textures and simple shapes. People, airlines and the family are made up. */

const OfficeRoom: any = { on: false };

/* ---------- drawn pictures for the office ---------- */
function ofPoster(seed: number, co: any, city: string): HTMLCanvasElement {
  const [c, x] = ctCanvas(384, 576), r = ctRng(seed);
  const top = ['#F3C27A', '#9FC6E0', '#F0A87A'][seed % 3], bot = ['#E9DDC2', '#E4E9E6', '#F2E2C8'][seed % 3];
  const g = x.createLinearGradient(0, 0, 0, 400); g.addColorStop(0, top); g.addColorStop(1, bot); x.fillStyle = g; x.fillRect(0, 0, 384, 576);
  x.fillStyle = 'rgba(255,240,200,.85)'; x.beginPath(); x.arc(270, 150, 46, 0, 6.3); x.fill();
  for (let k = 0; k < 3; k++) { x.fillStyle = ['#7C8C7A', '#5A6C5E', '#3E4E44'][k]; x.beginPath(); x.moveTo(0, 420); let y = 250 + k * 45; for (let X = 0; X <= 384; X += 32) { y += (r() - 0.5) * 70; x.lineTo(X, Math.max(200 + k * 40, Math.min(400, y))); } x.lineTo(384, 420); x.fill(); }
  x.fillStyle = '#2F5468'; x.fillRect(0, 400, 384, 40);
  // a jet climbing out, drawn flat in the airline's colours
  x.save(); x.translate(150, 210); x.rotate(-0.22); x.fillStyle = co.color || '#2C8CFF';
  x.beginPath(); x.ellipse(0, 0, 92, 11, 0, 0, 6.3); x.fill();
  x.beginPath(); x.moveTo(-10, 2); x.lineTo(-58, 46); x.lineTo(-38, 46); x.lineTo(30, 4); x.fill();
  x.beginPath(); x.moveTo(-66, -4); x.lineTo(-92, -40); x.lineTo(-78, -40); x.lineTo(-50, -6); x.fill();
  x.fillStyle = 'rgba(255,255,255,.75)'; for (let i = 0; i < 9; i++) x.fillRect(-46 + i * 11, -4, 5, 4);
  x.restore();
  x.fillStyle = '#1E2A33'; x.fillRect(0, 440, 384, 136);
  x.fillStyle = '#F2D18A'; x.font = '700 40px Georgia, serif'; x.textAlign = 'center'; x.fillText(seed % 2 ? 'FLY TO' : 'DISCOVER', 192, 495);
  x.fillStyle = '#FFFFFF'; x.font = '700 34px Inter, Arial, sans-serif'; x.fillText(String(city || 'the North').toUpperCase(), 192, 540);
  x.fillStyle = 'rgba(255,255,255,.6)'; x.font = '600 16px Inter, Arial, sans-serif'; x.fillText(co.name.toUpperCase(), 192, 566);
  for (let i = 0; i < 2600; i++) { x.fillStyle = `rgba(80,50,20,${0.05 * r()})`; x.fillRect(r() * 384, r() * 576, 2, 2); }
  return c;
}
/** The airline's route map: every route of the network on a dark chart, the hub marked. */
function ofRouteMap(co: any): HTMLCanvasElement {
  const [c, x] = ctCanvas(1024, 576), g = x.createLinearGradient(0, 0, 0, 576); g.addColorStop(0, '#0F2338'); g.addColorStop(1, '#0A1828'); x.fillStyle = g; x.fillRect(0, 0, 1024, 576);
  const pts: number[][] = [];
  for (const rt of (State.routes || []) as any[]) if (rt.companyId === co.id || !rt.companyId) for (const k of rt.legs || []) { const A = apt(k); if (A) pts.push(A.pos); }
  const H = apt(co.hub); if (H) pts.push(H.pos);
  let x0 = -30, x1 = 40, y0 = 35, y1 = 72;
  if (pts.length) { x0 = Math.min(...pts.map(p => p[0])) - 8; x1 = Math.max(...pts.map(p => p[0])) + 8; y0 = Math.min(...pts.map(p => p[1])) - 5; y1 = Math.max(...pts.map(p => p[1])) + 5; }
  const k = Math.min(1024 / (x1 - x0), 576 / (y1 - y0)), ox = (1024 - (x1 - x0) * k) / 2, oy = (576 - (y1 - y0) * k) / 2;
  const P = (p: number[]) => [ox + (p[0] - x0) * k, 576 - oy - (p[1] - y0) * k];
  x.strokeStyle = 'rgba(120,160,200,.12)'; x.lineWidth = 1;
  for (let lo = Math.ceil(x0 / 10) * 10; lo < x1; lo += 10) { const a = P([lo, y0]), b = P([lo, y1]); x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke(); }
  for (let la = Math.ceil(y0 / 5) * 5; la < y1; la += 5) { const a = P([x0, la]), b = P([x1, la]); x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke(); }
  x.strokeStyle = co.color || '#3FD0E8'; x.lineWidth = 2.4; x.globalAlpha = 0.85;
  for (const rt of (State.routes || []) as any[]) { if (rt.companyId && rt.companyId !== co.id) continue; const L = (rt.legs || []).map((k2: string) => apt(k2)).filter(Boolean); for (let i = 1; i < L.length; i++) { const a = P(L[i - 1].pos), b = P(L[i].pos), mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2 - Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.18; x.beginPath(); x.moveTo(a[0], a[1]); x.quadraticCurveTo(mx, my, b[0], b[1]); x.stroke(); } }
  x.globalAlpha = 1; x.fillStyle = '#EAF2FA';
  for (const p of pts) { const q = P(p); x.beginPath(); x.arc(q[0], q[1], 4, 0, 6.3); x.fill(); }
  if (H) { const q = P(H.pos); x.fillStyle = '#F2D18A'; x.beginPath(); x.arc(q[0], q[1], 9, 0, 6.3); x.fill(); x.font = '700 22px Inter, Arial, sans-serif'; x.fillText(H.city || co.hub, q[0] + 14, q[1] + 7); }
  x.fillStyle = '#F2D18A'; x.font = '700 30px Georgia, serif'; x.fillText(co.name + ' · Route network', 32, 52);
  return c;
}
/** The view from the window: the airport below the mountains, an aircraft on the runway. */
function ofView(): HTMLCanvasElement {
  const [c, x] = ctCanvas(1024, 512), g = x.createLinearGradient(0, 0, 0, 300), r = ctRng(4);
  g.addColorStop(0, '#7FA7CC'); g.addColorStop(1, '#E7E4D8'); x.fillStyle = g; x.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 9; i++) { x.fillStyle = 'rgba(255,255,255,.55)'; const cx = r() * 1024, cy = 40 + r() * 120; for (let j = 0; j < 6; j++) { x.beginPath(); x.ellipse(cx + j * 22, cy + Math.sin(j) * 6, 40, 14, 0, 0, 6.3); x.fill(); } }
  for (let kk = 0; kk < 3; kk++) { x.fillStyle = ['#8C9A9E', '#6A7A72', '#4F5F52'][kk]; x.beginPath(); x.moveTo(0, 340); let y = 170 + kk * 45; for (let X = 0; X <= 1024; X += 40) { y += (r() - 0.5) * 80; x.lineTo(X, Math.max(130 + kk * 40, Math.min(330, y))); } x.lineTo(1024, 340); x.fill(); }
  x.fillStyle = '#5E7050'; x.fillRect(0, 330, 1024, 182);
  x.fillStyle = '#3B3F43'; x.beginPath(); x.moveTo(0, 410); x.lineTo(1024, 380); x.lineTo(1024, 410); x.lineTo(0, 446); x.fill();
  x.strokeStyle = '#F2F2F2'; x.lineWidth = 3; x.setLineDash([22, 18]); x.beginPath(); x.moveTo(0, 428); x.lineTo(1024, 395); x.stroke(); x.setLineDash([]);
  x.fillStyle = '#DDE3E8'; x.beginPath(); x.ellipse(600, 392, 46, 6, -0.03, 0, 6.3); x.fill(); x.fillRect(588, 380, 4, 12); x.beginPath(); x.moveTo(598, 392); x.lineTo(580, 404); x.lineTo(620, 392); x.fill();
  x.fillStyle = '#C9CFD4'; x.fillRect(120, 300, 220, 40); x.fillStyle = '#8FA3B5'; for (let i = 0; i < 10; i++) x.fillRect(128 + i * 21, 310, 14, 18);
  return c;
}
/** The laptop's screen: the airline at a glance. */
function ofLaptop(co: any): HTMLCanvasElement {
  const [c, x] = ctCanvas(512, 320); x.fillStyle = '#0B1A2F'; x.fillRect(0, 0, 512, 320);
  x.fillStyle = co.color || '#2C8CFF'; x.fillRect(0, 0, 512, 36); x.fillStyle = '#fff'; x.font = '700 18px Inter, Arial, sans-serif'; x.fillText(co.name, 14, 24);
  x.fillStyle = '#8FA6BD'; x.font = '13px Inter, Arial, sans-serif'; x.fillText('Balance', 16, 66); x.fillText('Fleet', 200, 66); x.fillText('Popularity', 340, 66);
  x.fillStyle = '#EAF2FA'; x.font = '700 22px Inter, Arial, sans-serif'; x.fillText(money(co.balance), 16, 92); x.fillText(String(fleetOf(co.id).length), 200, 92); x.fillText(Math.round(co.reputation || 50) + '%', 340, 92);
  x.strokeStyle = '#3FD0E8'; x.lineWidth = 3; x.beginPath(); const r = ctRng(2); let y = 250; for (let X = 16; X < 496; X += 24) { y = Math.max(140, Math.min(290, y - 6 + (r() - 0.4) * 30)); X === 16 ? x.moveTo(X, y) : x.lineTo(X, y); } x.stroke();
  x.fillStyle = 'rgba(63,208,232,.12)'; x.lineTo(496, 300); x.lineTo(16, 300); x.fill();
  return c;
}
/** The report on the desk, for the interview. */
function ofReport(inc: any, p: any): HTMLCanvasElement {
  const [c, x] = ctCanvas(384, 512); x.fillStyle = '#F7F4EC'; x.fillRect(0, 0, 384, 512);
  x.fillStyle = '#7A1E22'; x.font = '700 26px Georgia, serif'; x.fillText('CONDUCT REPORT', 28, 52);
  x.fillStyle = '#222'; x.font = '600 18px Inter, Arial, sans-serif'; x.fillText(p.name, 28, 92); x.font = '16px Inter, Arial, sans-serif'; x.fillText(inc.title, 28, 118);
  x.fillStyle = '#999'; for (let i = 0; i < 12; i++) x.fillRect(28, 150 + i * 26, 300 - (i % 3) * 40, 3);
  x.strokeStyle = '#7A1E22'; x.lineWidth = 3; x.strokeRect(250, 420, 100, 46); x.fillStyle = '#7A1E22'; x.font = '700 15px Inter, Arial, sans-serif'; x.fillText('OPEN', 278, 449);
  return c;
}
function ofBooks(): HTMLCanvasElement {
  const [c, x] = ctCanvas(512, 128), r = ctRng(31); x.fillStyle = '#2A1A0E'; x.fillRect(0, 0, 512, 128);
  let X = 2; while (X < 510) { const w = 8 + r() * 14, h = 80 + r() * 44; x.fillStyle = ['#6B1F22', '#1F3B5A', '#2E4A2E', '#8A6A2A', '#3A2A4A', '#5A4A3A', '#1A1A1A', '#7A4A2A'][Math.floor(r() * 8)]; x.fillRect(X, 128 - h, w, h); x.fillStyle = 'rgba(230,200,120,.6)'; x.fillRect(X + 1, 128 - h + 10, w - 2, 2); x.fillRect(X + 1, 128 - h + 16, w - 2, 1); X += w + 1; if (r() < 0.06) X += 14; }
  return c;
}
function ofRug(): HTMLCanvasElement {
  const [c, x] = ctCanvas(512, 512); x.fillStyle = '#6B1E26'; x.fillRect(0, 0, 512, 512);
  x.strokeStyle = '#C9A25A'; x.lineWidth = 10; x.strokeRect(22, 22, 468, 468); x.lineWidth = 3; x.strokeRect(44, 44, 424, 424);
  x.fillStyle = '#1F2E4A'; x.fillRect(48, 48, 416, 416); x.fillStyle = '#6B1E26'; x.beginPath(); x.moveTo(256, 90); x.lineTo(420, 256); x.lineTo(256, 422); x.lineTo(92, 256); x.closePath(); x.fill();
  x.strokeStyle = '#C9A25A'; x.lineWidth = 3; x.stroke(); x.fillStyle = '#C9A25A'; x.beginPath(); x.arc(256, 256, 30, 0, 6.3); x.fill();
  const r = ctRng(8); for (let i = 0; i < 14000; i++) { x.fillStyle = `rgba(0,0,0,${0.12 * r()})`; x.fillRect(r() * 512, r() * 512, 1, 1); }
  return c;
}

/* ---------- the room ---------- */
function ofBuild(scene: any, q: number) {
  const T = THREE, A: any = { hits: [] }, co = company(), me: any = myPilot();
  const M = (o: any) => new T.MeshPhysicalMaterial(Object.assign({ roughness: 0.6, envMapIntensity: 0.75 }, o));
  const tex = { walnut: ctTex(ctWood('#5A3519', '#2A160A', 3)), oak: ctTex(ctWood('#9A6E42', '#4A2E16', 5)), parquet: ctTex(ctParquet(), 3, 3) };
  const mat = {
    walnut: M({ map: tex.walnut, roughness: 0.28, clearcoat: 0.7, clearcoatRoughness: 0.18 }), walnutM: M({ map: tex.walnut, roughness: 0.5 }),
    oak: M({ map: tex.oak, roughness: 0.45, clearcoat: 0.3 }), parquet: M({ map: tex.parquet, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.2 }),
    wall: M({ color: 0x23344A, roughness: 0.85 }), wallLight: M({ map: ctTex(ctNoise('#E9E1D0', 0.06, 9), 4, 2), roughness: 0.9 }), ceiling: M({ color: 0xF1EBDD, roughness: 0.9 }),
    leather: M({ map: ctTex(ctLeather('#4A2414')), roughness: 0.42, sheen: 0.5, sheenColor: new T.Color(0x8A4A2A) }), leatherG: M({ map: ctTex(ctLeather('#23402F')), roughness: 0.45 }),
    inlay: M({ map: ctTex(ctNoise('#1E3A2A', 0.15, 3)), roughness: 0.55 }),
    brass: M({ color: 0xC9A04E, metalness: 1, roughness: 0.25 }), chrome: M({ color: 0xDDE2E8, metalness: 1, roughness: 0.15 }), black: M({ color: 0x141619, roughness: 0.45 }),
    paper: M({ color: 0xF4F1E8, roughness: 0.9 }), glass: M({ color: 0xDDEEFF, roughness: 0.05, transparent: true, opacity: 0.2, clearcoat: 1 }),
    greenGlass: M({ color: 0x1F6B3A, roughness: 0.15, transmission: 0, emissive: 0x2E8A4A, emissiveIntensity: 0.6, clearcoat: 1 }),
    white: M({ color: 0xF2F2F0, roughness: 0.3 }), co: M({ color: new T.Color(co.color || '#2C8CFF'), roughness: 0.3, clearcoat: 0.8 }), plant: M({ color: 0x2F6B34, roughness: 0.7, side: T.DoubleSide }), pot: M({ color: 0xD8D2C6, roughness: 0.6 }),
  };
  const root = new T.Group(); scene.add(root); A.root = root;
  const add = (g: any, m: any, x: number, y: number, z: number, ry?: number, par?: any) => { const o = new T.Mesh(g, m); o.position.set(x, y, z); if (ry) o.rotation.y = ry; o.castShadow = true; o.receiveShadow = true; (par || root).add(o); return o; };
  const bx = (w: number, h: number, d: number, m: any, x: number, y: number, z: number, ry?: number, par?: any) => add(new T.BoxGeometry(w, h, d), m, x, y, z, ry, par);
  const slab = (w: number, d: number, h: number, r: number, m: any, x: number, yTop: number, z: number, ry?: number, par?: any) => {
    const s = new T.Shape(), hw = w / 2 - r, hd = d / 2 - r;
    s.moveTo(-hw, -d / 2); s.lineTo(hw, -d / 2); s.quadraticCurveTo(w / 2, -d / 2, w / 2, -hd); s.lineTo(w / 2, hd); s.quadraticCurveTo(w / 2, d / 2, hw, d / 2); s.lineTo(-hw, d / 2); s.quadraticCurveTo(-w / 2, d / 2, -w / 2, hd); s.lineTo(-w / 2, -hd); s.quadraticCurveTo(-w / 2, -d / 2, -hw, -d / 2);
    const bv = Math.min(0.012, h * 0.3), g = new T.ExtrudeGeometry(s, { depth: h - bv * 2, bevelEnabled: true, bevelThickness: bv, bevelSize: bv, bevelSegments: 3, curveSegments: 6 });
    g.rotateX(Math.PI / 2); g.translate(0, -bv, 0); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.6, uv.getY(i) * 0.6);
    return add(g, m, x, yTop, z, ry, par);
  };
  const plane = (w: number, h: number, m: any, x: number, y: number, z: number, ry: number) => { const o = new T.Mesh(new T.PlaneGeometry(w, h), m); o.position.set(x, y, z); o.rotation.y = ry; o.receiveShadow = true; root.add(o); return o; };
  const frame = (w: number, h: number, picMat: any, x: number, y: number, z: number, ry: number, fm?: any) => {
    const g = new T.Group(); g.position.set(x, y, z); g.rotation.y = ry; root.add(g);
    const pic = new T.Mesh(new T.PlaneGeometry(w, h), picMat); pic.position.z = 0.025; g.add(pic);
    const f = fm || mat.brass, t = 0.05;
    for (const [fw, fh, fx, fy] of [[w + t * 2, t, 0, h / 2 + t / 2], [w + t * 2, t, 0, -h / 2 - t / 2], [t, h, w / 2 + t / 2, 0], [t, h, -w / 2 - t / 2, 0]]) bx(fw, fh, 0.05, f, fx, fy, 0.02, 0, g);
    return g;
  };
  // the room: 6.4 m by 6.4 m, 3 m high; you sit at the desk facing the door side (−z)
  const X0 = -3.2, X1 = 3.2, Z0 = -3.4, Z1 = 3.0, HH = 3.0; A.box = [X0, Z0, X1, Z1];
  const fl = plane(X1 - X0, Z1 - Z0, mat.parquet, 0, 0, (Z0 + Z1) / 2, 0); fl.rotation.x = -Math.PI / 2;
  const rug = plane(3.6, 3.0, M({ map: ctTex(ofRug()), roughness: 1 }), 0, 0.006, 0, 0); rug.rotation.x = -Math.PI / 2;
  const ce = plane(X1 - X0, Z1 - Z0, mat.ceiling, 0, HH, (Z0 + Z1) / 2, 0); ce.rotation.x = Math.PI / 2;
  // walls: deep blue above oak panelling, the window wall in light plaster
  // the back wall has the door to your suite in it (x −0.8 … 0.0)
  plane(2.4, HH, mat.wall, -2.0, HH / 2, Z0, 0); plane(3.2, HH, mat.wall, 1.6, HH / 2, Z0, 0); plane(0.8, HH - 2.15, mat.wall, -0.4, 2.15 + (HH - 2.15) / 2, Z0, 0); plane(X1 - X0, HH, mat.wall, 0, HH / 2, Z1, Math.PI); plane(Z1 - Z0, HH, mat.wall, X0, HH / 2, (Z0 + Z1) / 2, Math.PI / 2); plane(Z1 - Z0, HH, mat.wallLight, X1, HH / 2, (Z0 + Z1) / 2, -Math.PI / 2);
  const pan: [number, number, number, number, number][] = [[-2.0, Z0 + 0.03, 2.4, 0, 0], [1.6, Z0 + 0.03, 3.2, 0, 0], [0, Z1 - 0.03, X1 - X0, Math.PI, 0], [X0 + 0.03, (Z0 + Z1) / 2, Z1 - Z0, Math.PI / 2, 0]];
  for (const [x, z, len, ry] of pan) { bx(len, 1.0, 0.04, mat.oak, x, 0.5, z, ry); bx(len, 0.06, 0.07, mat.walnut, x, 1.02, z, ry); bx(len, 0.12, 0.05, mat.walnut, x, 0.06, z, ry); }
  for (const [x, z, ry] of [[0, Z0 + 0.02, 0], [0, Z1 - 0.02, Math.PI], [X0 + 0.02, (Z0 + Z1) / 2, Math.PI / 2], [X1 - 0.02, (Z0 + Z1) / 2, -Math.PI / 2]] as number[][]) { const len = Math.abs(ry) === Math.PI / 2 ? Z1 - Z0 : X1 - X0; bx(len, 0.12, 0.1, mat.ceiling, x, HH - 0.06, z, ry); }
  // the big window over the airport (right wall)
  const view = new T.MeshBasicMaterial({ map: ctTex(ofView()), toneMapped: false });
  plane(4.0, 1.9, view, X1 - 0.01, 1.85, -0.4, -Math.PI / 2);
  for (const z of [-2.4, -1.07, 0.27, 1.6]) bx(0.08, 1.95, 0.07, mat.black, X1 - 0.05, 1.85, z);
  bx(0.08, 0.07, 4.06, mat.black, X1 - 0.05, 2.82, -0.4); bx(0.3, 0.06, 4.2, mat.walnut, X1 - 0.15, 0.88, -0.4);
  const sun = new T.DirectionalLight(0xFFE8C8, 2.2); sun.position.set(9, 5, -1.5); sun.target.position.set(0, 0.5, 0); sun.castShadow = q >= 1; sun.shadow.mapSize.set(q >= 2 ? 2048 : 1024, q >= 2 ? 2048 : 1024);
  const sc = sun.shadow.camera; sc.left = -5; sc.right = 5; sc.top = 5; sc.bottom = -5; sc.near = 1; sc.far = 25; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02; scene.add(sun); scene.add(sun.target);
  // the door (left wall, at the far end), with a brass handle; it swings open for visitors
  const door = new T.Group(); door.position.set(X0 + 0.04, 0, -2.6); root.add(door); A.door = door;
  const dl = new T.Group(); door.add(dl); dl.position.z = 0.5;
  bx(0.05, 2.15, 1.0, mat.walnutM, 0, 1.075, -0.5, 0, dl);
  for (const [y, h] of [[1.55, 0.8], [0.6, 0.8]]) bx(0.02, h, 0.72, mat.walnut, 0.035, y, -0.5, 0, dl);
  add(new T.SphereGeometry(0.035, 14, 10), mat.brass, 0.07, 1.0, -0.88, 0, dl);
  bx(0.08, 2.25, 0.08, mat.walnut, X0 + 0.05, 1.12, -2.08); bx(0.08, 2.25, 0.08, mat.walnut, X0 + 0.05, 1.12, -3.12); bx(0.08, 0.1, 1.1, mat.walnut, X0 + 0.05, 2.2, -2.6);
  const doorHit = bx(0.3, 2.2, 1.0, new T.MeshBasicMaterial({ visible: false }), X0 + 0.15, 1.1, -2.6); doorHit.userData.act = 'door'; A.hits.push(doorHit); A.doorLeaf = dl;
  // the desk: walnut with a green leather top, two pedestals of drawers; the front is set back so a visitor's knees fit
  slab(2.1, 0.95, 0.05, 0.03, mat.walnut, 0, 0.77, 0);
  const inl = plane(1.7, 0.6, mat.inlay, 0, 0.7725, 0.06, 0); inl.rotation.x = -Math.PI / 2;
  for (const s of [-1, 1]) { bx(0.5, 0.72, 0.85, mat.walnutM, s * 0.78, 0.36, 0); for (let i = 0; i < 3; i++) { bx(0.44, 0.2, 0.02, mat.walnut, s * 0.78, 0.13 + i * 0.23, 0.43); bx(0.1, 0.018, 0.03, mat.brass, s * 0.78, 0.17 + i * 0.23, 0.45); } }
  bx(1.06, 0.5, 0.03, mat.walnutM, 0, 0.45, -0.12);   // modesty panel, set back
  // things on the desk
  const lt = new T.Group(); lt.position.set(0.72, 0.775, 0.02); lt.rotation.y = -0.6; root.add(lt);
  A.lapScr = ofLaptop3d(T, lt, slab, bx, ctTex(ofLaptop(co)));
  { const lh = new T.Mesh(new T.BoxGeometry(0.38, 0.27, 0.3), new T.MeshBasicMaterial({ visible: false })); lh.position.set(0, 0.12, -0.02); lh.userData.act = 'laptop'; lt.add(lh); A.hits.push(lh); }
  // the banker's lamp: brass stand, green glass shade, a warm light
  add(new T.CylinderGeometry(0.07, 0.08, 0.02, 24), mat.brass, -0.72, 0.785, -0.18); add(new T.CylinderGeometry(0.008, 0.008, 0.3, 8), mat.brass, -0.72, 0.94, -0.18);
  const shade = add(new T.CylinderGeometry(0.06, 0.06, 0.32, 28, 1, true, 0, Math.PI), mat.greenGlass, -0.72, 1.1, -0.17); shade.rotation.set(0, 0, Math.PI / 2);   // a half tube, open below
  shade.material = mat.greenGlass.clone(); shade.material.side = T.DoubleSide;
  for (const s2 of [-1, 1]) add(new T.CylinderGeometry(0.008, 0.008, 0.02, 8), mat.brass, -0.72 + s2 * 0.16, 1.1, -0.17).rotation.z = Math.PI / 2;
  add(new T.CylinderGeometry(0.004, 0.004, 0.12, 6), mat.brass, -0.72, 1.04, -0.17);
  const lampL = new T.PointLight(0xFFD7A0, 1.6, 3, 1.6); lampL.position.set(-0.72, 1.05, -0.12); root.add(lampL);
  // the family photo, the phone, notes, coffee, pens
  A.photoAt = new T.Group(); A.photoAt.position.set(-0.42, 0.775, 0.3); A.photoAt.rotation.y = 0.5; root.add(A.photoAt);   // turned towards you
  // your phone, lying on the desk to your right, screen up
  phoneMesh(T, root, A, [0.4, 0.784, 0.27], -0.35);   // on the leather, in front of the laptop
  bx(0.24, 0.015, 0.17, mat.white, 0.0, 0.783, 0.33, 0.1);   // a notepad
  add(new T.CylinderGeometry(0.006, 0.006, 0.15, 8), mat.black, 0.06, 0.79, 0.3).rotation.set(Math.PI / 2, 0, 0.6);
  add(new T.CylinderGeometry(0.04, 0.035, 0.09, 20), mat.white, 0.78, 0.82, 0.32); add(new T.TorusGeometry(0.025, 0.007, 8, 16), mat.white, 0.82, 0.82, 0.32).rotation.y = 0;
  add(new T.CylinderGeometry(0.036, 0.036, 0.004, 20), M({ color: 0x3A2216 }), 0.78, 0.862, 0.32);
  bx(0.2, 0.05, 0.22, mat.black, 0.5, 0.8, -0.28, 0.3); bx(0.18, 0.025, 0.05, mat.black, 0.48, 0.84, -0.36, 0.3);
  add(new T.CylinderGeometry(0.035, 0.035, 0.1, 18), mat.brass, -0.85, 0.825, 0.25); for (let i = 0; i < 4; i++) add(new T.CylinderGeometry(0.004, 0.004, 0.15, 6), [mat.black, mat.co, mat.brass, mat.black][i], -0.85 + (i - 1.5) * 0.012, 0.9, 0.25 + (i % 2) * 0.01).rotation.z = (i - 1.5) * 0.08;
  // your nameplate, facing the visitor
  { const [c, x] = ctCanvas(512, 96); x.fillStyle = '#1A120A'; x.fillRect(0, 0, 512, 96); x.fillStyle = '#F2D18A'; x.font = '600 34px Georgia, serif'; x.textAlign = 'center'; x.fillText((me && me.name) || 'Chief Executive', 256, 46); x.font = '18px Inter, Arial, sans-serif'; x.fillText('Chief Executive · ' + co.name, 256, 78);
    const np = new T.Group(); np.position.set(0, 0.775, -0.38); root.add(np); const pr = new T.Mesh(new T.BoxGeometry(0.42, 0.08, 0.05), mat.walnut); pr.position.y = 0.04; pr.rotation.x = -0.35; np.add(pr);
    const pl = new T.Mesh(new T.PlaneGeometry(0.4, 0.075), M({ map: ctTex(c), roughness: 0.3, metalness: 0.3 })); pl.position.set(0, 0.045, -0.028); pl.rotation.set(-0.35, Math.PI, 0); np.add(pl); }
  // a model of one of your aircraft on a stand, in the company colours
  { const g = new T.Group(); g.position.set(0.78, 0.775, -0.32); g.rotation.y = 0.9; root.add(g);
    add(new T.CylinderGeometry(0.05, 0.06, 0.015, 20), mat.walnut, 0, 0.008, 0, 0, g); add(new T.CylinderGeometry(0.004, 0.004, 0.16, 8), mat.chrome, 0, 0.09, 0, 0, g);
    const p = new T.Group(); p.position.y = 0.18; p.rotation.z = 0.1; g.add(p);
    const fu = add(new T.CapsuleGeometry(0.018, 0.26, 6, 16), mat.white, 0, 0, 0, 0, p); fu.rotation.z = Math.PI / 2;
    const ws = new T.Shape(); ws.moveTo(0.03, 0); ws.lineTo(-0.04, 0.17); ws.lineTo(-0.075, 0.17); ws.lineTo(-0.045, 0); ws.lineTo(-0.075, -0.17); ws.lineTo(-0.04, -0.17); ws.closePath();
    const wg = new T.ExtrudeGeometry(ws, { depth: 0.006, bevelEnabled: false }); const w = add(wg, mat.white, 0, -0.006, 0, 0, p); w.rotation.x = Math.PI / 2;
    const ts = new T.Shape(); ts.moveTo(-0.11, 0); ts.lineTo(-0.16, 0.075); ts.lineTo(-0.135, 0.075); ts.lineTo(-0.085, 0); ts.closePath(); add(new T.ExtrudeGeometry(ts, { depth: 0.004, bevelEnabled: false }), mat.co, 0, 0.012, -0.002, 0, p);
    const hs = new T.Shape(); hs.moveTo(-0.115, 0); hs.lineTo(-0.15, 0.06); hs.lineTo(-0.135, 0.06); hs.lineTo(-0.1, 0); hs.lineTo(-0.135, -0.06); hs.lineTo(-0.15, -0.06); hs.closePath(); const h = add(new T.ExtrudeGeometry(hs, { depth: 0.004, bevelEnabled: false }), mat.white, 0, 0.004, 0, 0, p); h.rotation.x = Math.PI / 2;
    for (const s of [-1, 1]) { const e = add(new T.CylinderGeometry(0.012, 0.011, 0.05, 14), mat.co, 0.0, -0.022, s * 0.065, 0, p); e.rotation.z = Math.PI / 2; }
    bx(0.24, 0.006, 0.0372, mat.co, -0.01, -0.004, 0, 0, p).scale.set(1, 1, 1); }
  // your chair: a high-backed executive chair in brown leather on a five-star base
  { const g = new T.Group(); g.position.set(0, 0, 0.98); g.rotation.y = Math.PI; root.add(g); A.myChair = g;
    slab(0.6, 0.56, 0.1, 0.06, mat.leather, 0, 0.5, 0.03, 0, g);
    const back = slab(0.6, 0.12, 0.95, 0.06, mat.leather, 0, 1.55, -0.27, 0, g); back.rotation.x = 0; back.position.y = 1.5;
    const hb = new T.Mesh(new T.BoxGeometry(0.62, 0.95, 0.1), mat.leather); hb.position.set(0, 1.05, -0.3); hb.rotation.x = -0.12; hb.castShadow = true; g.add(hb); g.remove(back);
    for (const s of [-1, 1]) { bx(0.07, 0.05, 0.42, mat.leather, s * 0.34, 0.72, 0.02, 0, g); bx(0.04, 0.22, 0.04, mat.chrome, s * 0.34, 0.6, 0.12, 0, g); }
    add(new T.CylinderGeometry(0.03, 0.03, 0.3, 12), mat.chrome, 0, 0.3, 0, 0, g);
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; const leg = bx(0.33, 0.04, 0.05, mat.chrome, Math.cos(a) * 0.16, 0.1, Math.sin(a) * 0.16, -a, g); void leg; add(new T.SphereGeometry(0.03, 10, 8), mat.black, Math.cos(a) * 0.32, 0.03, Math.sin(a) * 0.32, 0, g); }
    const hit = bx(0.7, 1.4, 0.7, new T.MeshBasicMaterial({ visible: false }), 0, 0.7, 0, 0, g); hit.userData.act = 'sit'; A.hits.push(hit); }
  // the visitor's chair (nice, if not as nice as yours), facing you across the desk
  ctChair(root, add, bx, slab, mat, 0, 0, -0.98, 0, false); A.visitor = { x: 0, y: 0, z: -0.98, yaw: 0 };
  // bookshelves along the back wall, the route map between them, posters
  for (const s of [-1, 1]) {
    const x = s * 2.35, g = new T.Group(); g.position.set(x, 0, Z0 + 0.2); root.add(g);
    bx(1.4, 2.5, 0.04, mat.walnutM, 0, 1.25, -0.16, 0, g); for (const sx of [-0.68, 0.68]) bx(0.04, 2.5, 0.36, mat.walnut, sx, 1.25, 0, 0, g);
    const bm = M({ map: ctTex(ofBooks()), roughness: 0.8 });
    for (let i = 0; i < 6; i++) { bx(1.36, 0.03, 0.34, mat.walnut, 0, 0.1 + i * 0.45, 0, 0, g); if (i < 5) { const b = new T.Mesh(new T.PlaneGeometry(1.3, 0.34), bm); b.position.set(0, 0.29 + i * 0.45, 0.06); g.add(b); } }
  }
  frame(1.3, 0.73, new T.MeshStandardMaterial({ map: ctTex(ofRouteMap(co)), roughness: 0.5 }), 0.9, 1.75, Z0 + 0.05, 0, mat.walnut);   // beside the door to your suite
  // the door to your suite: a walnut frame on this side (the door itself and the rooms behind: office-suite.ts)
  bx(0.08, 2.25, 0.08, mat.walnut, -0.84, 1.12, Z0 + 0.04); bx(0.08, 2.25, 0.08, mat.walnut, 0.04, 1.12, Z0 + 0.04); bx(0.96, 0.1, 0.08, mat.walnut, -0.4, 2.2, Z0 + 0.04);
  try { const S = osBuild(root, q); A.suite = S; A.hits.push(...S.hits); A.occ = S.occ; } catch (e) { console.error(e); }
  frame(0.62, 0.93, M({ map: ctTex(ofPoster(1, co, (apt(co.hub) || {} as any).city)), roughness: 0.5 }), X0 + 0.05, 1.75, -0.4, Math.PI / 2, mat.black);
  frame(0.62, 0.93, M({ map: ctTex(ofPoster(2, co, 'Reykjavík')), roughness: 0.5 }), X0 + 0.05, 1.75, 0.6, Math.PI / 2, mat.black);
  frame(0.9, 0.6, M({ map: ctTex(ctPainting(5)), roughness: 0.6 }), X0 + 0.05, 1.8, 2.0, Math.PI / 2, mat.brass);
  // a wooden propeller on the wall behind you, a credenza with a globe and trophies
  { const g = new T.Group(); g.position.set(0, 2.15, Z1 - 0.08); g.rotation.y = Math.PI; root.add(g);
    add(new T.CylinderGeometry(0.06, 0.06, 0.08, 20), mat.brass, 0, 0, 0, 0, g).rotation.x = Math.PI / 2;
    for (const s of [-1, 1]) { const sh = new T.Shape(); sh.moveTo(0, -0.04); sh.quadraticCurveTo(0.45, -0.07, 0.85, -0.02); sh.quadraticCurveTo(0.9, 0, 0.85, 0.02); sh.quadraticCurveTo(0.45, 0.07, 0, 0.04); sh.closePath(); const b = add(new T.ExtrudeGeometry(sh, { depth: 0.025, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008 }), mat.walnut, 0, 0, 0, 0, g); b.rotation.z = s > 0 ? 0.15 : Math.PI + 0.15; } }
  slab(2.4, 0.5, 0.06, 0.02, mat.walnut, 0, 0.78, Z1 - 0.3); bx(2.36, 0.72, 0.46, mat.walnutM, 0, 0.36, Z1 - 0.3);
  for (let i = 0; i < 4; i++) bx(0.54, 0.62, 0.02, mat.walnut, -0.885 + i * 0.59, 0.38, Z1 - 0.53);
  { const gl = new T.Group(); gl.position.set(-0.7, 0.81, Z1 - 0.3); root.add(gl); add(new T.CylinderGeometry(0.07, 0.09, 0.03, 20), mat.walnut, 0, 0.015, 0, 0, gl); add(new T.CylinderGeometry(0.01, 0.01, 0.1, 8), mat.brass, 0, 0.08, 0, 0, gl);
    const [c, x] = ctCanvas(512, 256); x.fillStyle = '#C9B88A'; x.fillRect(0, 0, 512, 256); x.fillStyle = '#7A8A5A'; const r = ctRng(12); for (let i = 0; i < 40; i++) { x.beginPath(); x.ellipse(r() * 512, 30 + r() * 196, 20 + r() * 60, 10 + r() * 30, r() * 3, 0, 6.3); x.fill(); } x.strokeStyle = 'rgba(80,60,30,.4)'; for (let i = 1; i < 12; i++) { x.beginPath(); x.moveTo(i * 42, 0); x.lineTo(i * 42, 256); x.stroke(); }
    add(new T.SphereGeometry(0.15, 32, 20), M({ map: ctTex(c), roughness: 0.4, clearcoat: 0.6 }), 0, 0.3, 0, 0, gl); add(new T.TorusGeometry(0.17, 0.008, 8, 40, Math.PI * 1.4), mat.brass, 0, 0.3, 0, 0, gl).rotation.y = Math.PI / 2; }
  for (const [x, h] of [[0.3, 0.26], [0.55, 0.2], [0.8, 0.3]]) { add(new T.CylinderGeometry(0.04, 0.05, 0.04, 16), mat.walnut, x, 0.83, Z1 - 0.3); const cup = add(new T.LatheGeometry([[0, 0], [0.02, 0], [0.012, 0.06], [0.012, h * 0.5], [0.06, h * 0.75], [0.07, h]].map(p => new T.Vector2(p[0], p[1])), 20), mat.brass, x, 0.85, Z1 - 0.3); void cup; }
  // a leather sofa and a low table (left), a plant in the corner
  { const sx = X0 + 0.55, sz = 1.2; Props.place(root, 'sofa-2', X0 + 0.48, sz, Math.PI / 2, q, { seats: 3, color: 0x4A2414 });
    slab(0.6, 1.0, 0.04, 0.03, mat.walnut, X0 + 1.45, 0.42, sz); for (const s of [-1, 1]) bx(0.5, 0.38, 0.04, mat.walnutM, X0 + 1.45, 0.2, sz + s * 0.42); }
  Props.place(root, 'plant-1', X1 - 0.45, Z0 + 0.45, 0.4, q, { seed: 5 });
  // your pet, asleep in its bed by the right-hand bookshelf
  try { petPlace(T, root, A, [1.2, -2.8], -0.5, { free: (x: number, z: number) => ofFree(x, z) && !ofPetBlocked(x, z), door: [1.05, -1.85], box: [-2.9, -3.1, 2.9, 2.7] }); } catch (e) { /* no pet */ }
  // ceiling lights
  const dm = new T.MeshBasicMaterial({ color: 0xFFF1D8, toneMapped: false });
  for (const [x, z] of (q >= 1 ? [[-1.6, -1.8], [1.6, -1.8], [-1.6, 1.4], [1.6, 1.4], [0, -0.2]] : [[0, -1.5], [0, 1.1]])) { const d = new T.Mesh(new T.CircleGeometry(0.08, 20), dm); d.rotation.x = Math.PI / 2; d.position.set(x, HH - 0.005, z); root.add(d); const L = new T.SpotLight(0xFFE4C0, q >= 1 ? 5 : 11, q >= 1 ? 7 : 9, q >= 1 ? 0.9 : 1.15, 0.7, 1.6); L.position.set(x, HH - 0.05, z); L.target.position.set(x, 0, z); if (DESKTOP && Gfx.lights() >= 2 && Gfx.shadow() !== 0 && (x === 0 || z < 0)) { L.castShadow = true; L.shadow.mapSize.set(1024, 1024); L.shadow.bias = -0.0005; L.shadow.radius = 4; } root.add(L); root.add(L.target); }   // on the PC the ceiling lights cast soft shadows of their own
  return A;
}

/** The laptop on your desk: an aluminium body with rounded corners, a keyboard of real keys (function row,
 *  letters, the wide keys at the ends, the space bar, the arrow keys), a glass trackpad, the hinge, and the lid
 *  with a thin black bezel, the camera and the company's figures on the screen. 34 cm wide. */
function ofLaptop3d(T: any, lt: any, slab: any, bx: any, screenTex: any) {
  const alu = new T.MeshPhysicalMaterial({ color: 0x8D9299, metalness: 0.85, roughness: 0.32, clearcoat: 0.2 });
  const keyM = new T.MeshStandardMaterial({ color: 0x1C1E22, roughness: 0.55 }), well = new T.MeshStandardMaterial({ color: 0x2A2D32, roughness: 0.8 });
  const W = 0.34, D = 0.235, H = 0.014;
  // the base and the keyboard well
  slab(W, D, H, 0.012, alu, 0, H, 0, 0, lt);
  const kw = 0.29, kd = 0.112, kz = -0.044;
  bx(kw + 0.006, 0.0015, kd + 0.006, well, 0, H + 0.0002, kz, 0, lt);
  // the keys: rows of 14 units, with the wide keys where a real keyboard has them
  const u = kw / 14.6, g = u * 0.16, kh = 0.0024;
  const rows: number[][] = [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.6],          // Esc, F1–F12, power
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.6],          // numbers, backspace
    [1.6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],          // tab
    [1.9, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.7],           // caps lock, enter
    [2.4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.2],              // shifts
    [1, 1, 1, 1.25, 5.4, 1.25, 1, 1, 1, 1],                // fn, ctrl, alt, cmd, space, cmd, alt, arrows
  ];
  const rowH = [0.55, 1, 1, 1, 1, 1], tot = rowH.reduce((a, b) => a + b, 0) * u;
  const keys: number[][] = []; let z = kz - tot / 2;
  rows.forEach((r, ri) => {
    const h = rowH[ri] * u, sum = r.reduce((a, b) => a + b, 0) * u; let x = -sum / 2;
    r.forEach((wu, ki) => {
      const w = wu * u;
      // the arrow keys: up and down share one key's place, half height each
      if (ri === 5 && ki >= 7 && ki <= 9 && ki === 8) { keys.push([x + w / 2, z + h * 0.25, w - g, h * 0.5 - g]); keys.push([x + w / 2, z + h * 0.75, w - g, h * 0.5 - g]); }
      else if (ri === 5 && ki >= 7) keys.push([x + w / 2, z + h * 0.75, w - g, h * 0.5 - g]);
      else keys.push([x + w / 2, z + h / 2, w - g, h - g]);
      x += w;
    });
    z += h;
  });
  const kg = new T.BoxGeometry(1, kh, 1), km = new T.InstancedMesh(kg, keyM, keys.length), m4 = new T.Matrix4();
  keys.forEach((k, i) => { m4.makeScale(k[2], 1, k[3]); m4.setPosition(k[0], H + kh / 2, k[1]); km.setMatrixAt(i, m4); });
  km.castShadow = true; lt.add(km);
  // the trackpad, and the small gap at the front edge where you lift the lid
  const tp = new T.Mesh(new T.PlaneGeometry(0.12, 0.072), new T.MeshPhysicalMaterial({ color: 0x9CA1A8, metalness: 0.6, roughness: 0.18, clearcoat: 0.6 }));
  tp.rotation.x = -Math.PI / 2; tp.position.set(0, H + 0.0004, 0.068); lt.add(tp);
  bx(0.05, 0.003, 0.004, well, 0, H - 0.003, D / 2 - 0.001, 0, lt);
  // the speaker grilles either side of the keyboard
  for (const sx of [-1, 1]) bx(0.012, 0.0006, kd * 0.9, well, sx * (kw / 2 + 0.012), H + 0.0003, kz, 0, lt);
  // the hinge and the lid, tilted back
  const hinge = new T.Mesh(new T.CylinderGeometry(0.006, 0.006, W * 0.8, 16), alu); hinge.rotation.z = Math.PI / 2; hinge.position.set(0, H, -D / 2 + 0.004); lt.add(hinge);
  const lid = new T.Group(); lid.position.set(0, H, -D / 2 + 0.004); lid.rotation.x = -0.3; lt.add(lid);
  const LH = 0.225;
  { const r = 0.012, sh = new T.Shape(), hw = W / 2, x0 = -hw, x1 = hw, y0 = 0, y1 = LH;
    sh.moveTo(x0 + r, y0); sh.lineTo(x1 - r, y0); sh.quadraticCurveTo(x1, y0, x1, y0 + r); sh.lineTo(x1, y1 - r); sh.quadraticCurveTo(x1, y1, x1 - r, y1); sh.lineTo(x0 + r, y1); sh.quadraticCurveTo(x0, y1, x0, y1 - r); sh.lineTo(x0, y0 + r); sh.quadraticCurveTo(x0, y0, x0 + r, y0);
    const lg = new T.ExtrudeGeometry(sh, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.001, bevelSize: 0.001, bevelSegments: 2, curveSegments: 6 });
    const back = new T.Mesh(lg, alu); back.position.z = -0.0055; back.castShadow = true; lid.add(back); }
  // the front of the lid: black glass with the screen in it, the camera at the top
  const bez = new T.Mesh(new T.PlaneGeometry(W - 0.006, LH - 0.004), new T.MeshPhysicalMaterial({ color: 0x0B0C0E, roughness: 0.08, clearcoat: 1 }));
  bez.position.set(0, LH / 2, 0.0001); lid.add(bez);
  const scrW = W - 0.022, scrH = LH - 0.026;
  const sm = new T.Mesh(new T.PlaneGeometry(scrW, scrH), new T.MeshBasicMaterial({ map: screenTex, toneMapped: false })); sm.position.set(0, LH / 2 - 0.004, 0.0004); lid.add(sm);
  // the glass over the screen: it catches the room's light, so a soft glare moves over it as you move
  { const gl = new T.Mesh(new T.PlaneGeometry(scrW + 0.004, scrH + 0.004), roomGlassMat(T, 0.14)); gl.position.set(0, LH / 2 - 0.004, 0.0009); gl.renderOrder = 2; lid.add(gl); }
  const cam = new T.Mesh(new T.CircleGeometry(0.0022, 12), new T.MeshStandardMaterial({ color: 0x1D2733, roughness: 0.1 })); cam.position.set(0, LH - 0.006, 0.0005); lid.add(cam);
  sm.userData.size = [scrW, scrH];
  return sm;
}

/** A photo of you with your family on the desk: taken once, with the figures, and kept. */
function ofFamilyPhoto(ren: any, done: (tex: any) => void) {
  const T = THREE, R = OfficeRoom, me: any = myPilot();
  const fam = familyInfo(), pet: any = petData(), kind = fam.married ? 'family' : pet && pet.kind !== 'none' ? 'pet' : 'firstday';
  const key = JSON.stringify([me && me.look || {}, (State as any).family || null, kind, kind === 'pet' ? pet : 0]);
  if (R.photo && R.photo.key === key) { done(ctTex(R.photo.cv)); return; }
  const scene = new T.Scene(), cam = new T.PerspectiveCamera(30, 4 / 3, 0.1, 30);
  const [bg] = ctCanvas(512, 384); { const x = bg.getContext('2d') as CanvasRenderingContext2D, g = x.createLinearGradient(0, 0, 0, 384); g.addColorStop(0, '#8DB7D9'); g.addColorStop(0.55, '#DCE7E8'); g.addColorStop(0.56, '#4E7F9A'); g.addColorStop(0.7, '#5D8C5A'); g.addColorStop(1, '#3E6A3A'); x.fillStyle = g; x.fillRect(0, 0, 512, 384); }
  const bp = new T.Mesh(new T.PlaneGeometry(9, 6.75), new T.MeshBasicMaterial({ map: ctTex(bg) })); bp.position.set(0, 1.4, -3); scene.add(bp);
  scene.add(new T.HemisphereLight(0xFFF6E8, 0x6A7A5A, 1.4)); const sl = new T.DirectionalLight(0xFFF0DC, 2.2); sl.position.set(2, 4, 5); scene.add(sl);
  // you, as you look (in your own clothes) and as tall as you are, and your partner as you chose them in Your pilot
  const meL = me && me.look ? Object.assign({}, me.look, { civil: true, top: me.look.sex === 'f' ? 'blouse' : 'shirt', uniform: 4, hat: 'none', neck: 'open', bottom: 'trousers' }) : ctLook('me', 'm', 'public');
  const base = (me && me.id) || 'me', ptL = familyPartner(meL.sex, base), H0 = 178;
  const hOf = (L: any) => (L.height || FAM_H[L.sex === 'f' ? 'f' : 'm']) / H0;
  // the man on the left, the woman on the right, the children in front between them
  const meX = meL.sex === 'f' ? 0.38 : -0.38;
  const kids = [{ L: ctLook('kid1-' + base, 'f', 'public'), x: -0.16, s: 0.62, z: 0.55 }, { L: ctLook('kid2-' + base, 'm', 'public'), x: 0.2, s: 0.54, z: 0.6 }, { L: ctLook('kid3-' + base, 'm', 'public'), x: 0.02, s: 0.46, z: 0.9 }];
  const famAll: any[] = [{ L: meL, x: meX, s: hOf(meL) }, { L: ptL, x: -meX, s: hOf(ptL) }].concat(fam.kids === 1 ? [Object.assign({}, kids[0], { x: 0.02 })] : fam.kids === 3 ? [Object.assign({}, kids[0], { x: -0.3 }), Object.assign({}, kids[2], { x: 0.06, z: 0.7 }), Object.assign({}, kids[1], { x: 0.38 })] : kids.slice(0, fam.kids));
  if (kind !== 'family') { ofOtherPhoto(ren, kind, me, pet, key, done); return; }
  // the children's hair and features stay the same from one photo to the next
  let rs = 7; const rnd = () => { rs = (rs * 16807) % 2147483647; return rs / 2147483647; };
  // the children: no beards or grey hair, and their skin between their parents'
  for (const f of famAll.slice(2)) { const L: any = f.L, a = famAll[0].L.skin || 2, b = famAll[1].L.skin || 2; L.facial = 'none'; L.glasses = 'none'; L.skin = Math.round((a + b) / 2 + (rnd() - 0.5)); if (L.hairColor >= 8) L.hairColor = famAll[rnd() < 0.5 ? 0 : 1].L.hairColor < 8 ? famAll[0].L.hairColor : 1; }
  const built: any[] = [];   // each figure is scaled from outside: it sets its own scale as it breathes
  try {
    for (const f of famAll) { const m = Human.build(f.L, 'exec', '#2C8CFF', av3Style(), 0.5), g = new T.Group(); g.add(m.root); g.position.set(f.x, 0, f.z || 0); g.scale.setScalar(f.s); scene.add(g); m.pose({ t: 1, yaw: 0, gaze: [0, 0], blink: 0, g: humanGesture(null, 1) }); built.push(m); }
  } catch (e) { /* the photo without people */ }
  cam.position.set(0, 1.05, 3.9); cam.lookAt(0, 0.95, 0);
  const rt = new T.WebGLRenderTarget(512, 384, { samples: 4 }); rt.texture.colorSpace = T.SRGBColorSpace;
  ren.setRenderTarget(rt); ren.render(scene, cam); ren.setRenderTarget(null);
  // keep it as a picture (so the figures aren't built again next time)
  const px = new Uint8Array(512 * 384 * 4); try { ren.readRenderTargetPixels(rt, 0, 0, 512, 384, px); } catch (e) { /* the picture stays on the card */ }
  const [cv, x] = ctCanvas(512, 384), id = x.createImageData(512, 384);
  for (let y = 0; y < 384; y++) id.data.set(px.subarray((383 - y) * 512 * 4, (384 - y) * 512 * 4), y * 512 * 4);
  x.putImageData(id, 0, 0);
  R.photo = { key, cv }; rt.dispose();
  scene.traverse((o: any) => { if (o.geometry) o.geometry.dispose(); });
  done(ctTex(cv));
}

/** The photo on your desk without a partner: your pet if you have one (lying on a rug in the sun), or you on your
 *  first day in the job (in uniform, an aircraft on the apron behind you, the day written in the corner). */
function ofOtherPhoto(ren: any, kind: string, me: any, pet: any, key: string, done: (tex: any) => void) {
  const T = THREE, R = OfficeRoom, scene = new T.Scene(), W = 512, H = 384;
  const [bg, bx] = ctCanvas(W, H);
  if (kind === 'pet') { const g = bx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#E9D9BF'); g.addColorStop(1, '#C9A97E'); bx.fillStyle = g; bx.fillRect(0, 0, W, H); bx.fillStyle = 'rgba(255,240,200,0.35)'; bx.beginPath(); bx.moveTo(60, 0); bx.lineTo(220, 0); bx.lineTo(420, H); bx.lineTo(180, H); bx.fill(); }
  else {   // the apron: sky, the terminal far off, an aircraft's nose and wing
    const g = bx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#7FAEDB'); g.addColorStop(0.58, '#D8E6EE'); g.addColorStop(0.6, '#8C949B'); g.addColorStop(1, '#5E666D'); bx.fillStyle = g; bx.fillRect(0, 0, W, H);
    bx.fillStyle = '#B9C3CB'; bx.fillRect(0, 196, W, 34); for (let i = 0; i < 26; i++) { bx.fillStyle = '#6E8496'; bx.fillRect(8 + i * 20, 204, 12, 14); }
    bx.fillStyle = '#F4F6F8'; bx.beginPath(); bx.ellipse(380, 190, 150, 34, 0, 0, Math.PI * 2); bx.fill(); bx.beginPath(); bx.moveTo(250, 200); bx.lineTo(120, 236); bx.lineTo(150, 240); bx.lineTo(300, 210); bx.fill();
    bx.fillStyle = '#26323D'; for (let i = 0; i < 7; i++) bx.fillRect(300 + i * 26, 182, 12, 9); bx.beginPath(); bx.ellipse(500, 186, 22, 14, 0, 0, Math.PI * 2); bx.fill();
    bx.fillStyle = (company() && company().color) || '#2C8CFF'; bx.fillRect(240, 204, 280, 6);
  }
  const bp = new T.Mesh(new T.PlaneGeometry(9, 6.75), new T.MeshBasicMaterial({ map: ctTex(bg) })); bp.position.set(0, 1.4, -3); scene.add(bp);
  scene.add(new T.HemisphereLight(0xFFF6E8, 0x6A7A5A, 1.4)); const sl = new T.DirectionalLight(0xFFF0DC, 2.2); sl.position.set(2, 4, 5); scene.add(sl);
  const cam = new T.PerspectiveCamera(30, 4 / 3, 0.05, 30);
  try {
    if (kind === 'pet') {
      const A: any = {}, rug = new T.Mesh(new T.CircleGeometry(1.4, 48), new T.MeshStandardMaterial({ color: 0x8A4E3A, roughness: 0.9 })); rug.rotation.x = -Math.PI / 2; scene.add(rug);
      petPlace(T, scene, A, [0, 0], 0.4); if (A.pet && A.pet.body && A.pet.body.U) A.pet.body.U.uBreath.value = 0;
      cam.position.set(0.95, 0.95, 1.75); cam.lookAt(0.05, 0.12, 0);
    } else {
      const L = me && me.look ? Object.assign({}, me.look, { hat: 'cap' }) : ctLook('me', 'm', 'public');
      const m = Human.build(dressed(L, 'captain'), 'captain', (company() && company().color) || '#2C8CFF', av3Style(), 0.5), g = new T.Group(); g.add(m.root); scene.add(g);
      m.pose({ t: 1, yaw: 0.15, gaze: [0, 0], blink: 0, g: humanGesture(null, 1) });
      cam.position.set(0, 1.25, 3.4); cam.lookAt(0, 1.05, 0);
    }
  } catch (e) { cam.position.set(0, 1.2, 3.6); cam.lookAt(0, 1, 0); }
  const rt = new T.WebGLRenderTarget(W, H, { samples: 4 }); rt.texture.colorSpace = T.SRGBColorSpace;
  ren.setRenderTarget(rt); ren.render(scene, cam); ren.setRenderTarget(null);
  const px = new Uint8Array(W * H * 4); try { ren.readRenderTargetPixels(rt, 0, 0, W, H, px); } catch (e) { /* as it is */ }
  const [cv, x] = ctCanvas(W, H), id = x.createImageData(W, H);
  for (let y = 0; y < H; y++) id.data.set(px.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
  x.putImageData(id, 0, 0);
  if (kind === 'firstday') {   // the day it was, written in the corner as people do
    const d = (() => { try { const S: any = State; const t = S.startedAt || S.created || (S.company && S.company.founded); return t ? new Date(t) : new Date(); } catch (e) { return new Date(); } })();
    x.fillStyle = 'rgba(255,250,235,0.92)'; x.font = 'italic 600 26px Georgia, serif'; x.textAlign = 'right'; x.fillText('Day one · ' + d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }), W - 18, H - 18);
  }
  R.photo = { key, cv }; rt.dispose();
  scene.traverse((o: any) => { if (o.geometry && !o.geometry.userData.keep) o.geometry.dispose(); });
  done(ctTex(cv));
}

/* ---------- opening the office ---------- */
const OF_WINGS = `<svg class="ctl-scales" viewBox="0 0 200 200" aria-hidden="true"><defs><linearGradient id="ofG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F6DB8E"/><stop offset=".55" stop-color="#C8963E"/><stop offset="1" stop-color="#8A5E22"/></linearGradient></defs>
  <circle cx="100" cy="100" r="94" fill="#13213A" stroke="url(#ofG)" stroke-width="4"/><g fill="url(#ofG)" class="ctl-beam">
  <path d="M100 82 C80 80 50 76 18 64 C30 78 46 86 62 90 C48 92 36 92 24 90 C38 100 60 104 82 102 C70 106 60 108 48 108 C64 116 84 114 100 108 Z"/>
  <path d="M100 82 C120 80 150 76 182 64 C170 78 154 86 138 90 C152 92 164 92 176 90 C162 100 140 104 118 102 C130 106 140 108 152 108 C136 116 116 114 100 108 Z"/>
  <circle cx="100" cy="95" r="16"/><circle cx="100" cy="95" r="10" fill="#13213A"/></g><text x="100" y="150" text-anchor="middle" font-family="Georgia, serif" font-size="15" fill="url(#ofG)" letter-spacing="3">OFFICE</text></svg>`;

OfficeRoom.open = function (inc?: any, host?: any) {
  const R = OfficeRoom;
  if (!host && trJoined()) {   // the joined building: your office off the staff corridor
    if (TestRooms.on && TestRooms.game) { if (R.on) R.close(true); trEnter('office', null, inc); } else { if (R.on) R.close(true); TestRooms.open({ game: true, room: 'office', inc }); }
    return;
  }
  if (R.on) R.close(true);
  R.host = host || null;
  const T = THREE; if (!T) { toast('3D is not available on this device', 'warn'); return; }
  const p: any = inc ? staffById(inc.staffId) : null; if (inc && !p) { toast('This person no longer works for you', 'info'); return; }
  R.on = true; R.inc = inc || null; R.p = p; R.mode = inc ? 'interview' : 'visit'; R.keys = {}; R.stick = [0, 0]; R.pct = 0; R.asked = []; R.answers = 0; R.decided = false; R.ended = false; R.started = false; R.rescued = false; R.talkUntil = 0; R.flush = false; R.cond = null; R.doorT = 0; R.last = 0; R.view = ''; R.vis = null; R.loadT0 = performance.now();
  const q = Gfx.roomQ(), co = company();
  const root = host ? host.root : document.createElement('div'); if (!host) root.className = 'court3d office3d'; R.root = root;
  const ui = `${host ? '' : '<canvas></canvas>'}
    <div class="ct-top" data-of="boxopen" title="Show the conversation"><div><small>${esc(co.name)}</small><b>${inc ? `Your office: ${esc(p.name)}, ${esc(inc.title.toLowerCase())}` : 'Your office'}</b></div><i class="of-reopen">${icon('chevron')}</i></div>
    <button class="ct-leave" data-of="leave">${icon('close')}<span>Leave the office</span><kbd>Esc</kbd></button>
    <div class="ct-box" hidden><div class="box-grip" title="Drag to move the window (double-click to put it back)"><i></i></div><button class="of-x" data-of="boxclose" aria-label="Close" title="Close (bring it back from the name at the top left)">${icon('close')}</button><button class="of-x of-min" data-of="boxmin" aria-label="Minimise" title="Minimise">${icon('down')}</button><div class="of-you"></div><div class="ct-who"><b></b><small></small></div><p class="ct-text"></p><p class="of-tell"></p><div class="ct-say"></div><div class="ct-opts"></div><div class="ct-ctl"></div></div>
    <div class="ct-spots of-spots" hidden></div><div class="ct-hint" hidden></div><div class="walk-pad ct-pad" hidden><i></i></div><div class="of-aim" hidden>+</div>
    ${host ? '' : ctLoaderHtml('Your office', inc ? `${p.name} is on the way up…` : 'Unlocking the door…', OF_WINGS)}`;
  if (host) { host.mount('office', ui); ofOpen2(root, q); return; }   // in the building: built already, straight in
  root.innerHTML = ui;
  document.body.appendChild(root);
  setTimeout(() => { if (R.on && R.root === root) ofOpen2(root, q); }, 80);
};
function ofOpen2(root: HTMLElement, q: number) {
  const R = OfficeRoom, T = THREE, cv = root.querySelector('canvas') as HTMLCanvasElement, H = R.host;
  R.ac = new AbortController(); R.sig = R.ac.signal;   // the room's own controls, all let go of together when it closes
  if (H) { ofHosted(root, q, cv); return; }
  const ren = new T.WebGLRenderer({ canvas: cv, antialias: q >= 1, powerPreference: 'high-performance' }); R.ren = ren;
  ren.setPixelRatio(Gfx.pr(Gfx.placeSharp('room', q))); ren.outputColorSpace = T.SRGBColorSpace; ren.toneMapping = T.ACESFilmicToneMapping; ren.toneMappingExposure = 1.0;
  ren.shadowMap.enabled = Gfx.placeShadow('room', q >= 1); ren.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene(); R.scene = scene; scene.background = new T.Color(0x101820);
  const cam = new T.PerspectiveCamera(58, 1, 0.03, 40); R.cam = cam;
  scene.add(new T.HemisphereLight(0xFFF3E2, 0x3A2A1A, 0.85));
  try {
    const pm = new T.PMREMGenerator(ren), env = new T.Scene(), b = new T.Mesh(new T.BoxGeometry(6, 3, 6), new T.MeshBasicMaterial({ color: 0x3A3020, side: T.BackSide })); env.add(b);
    const w = new T.Mesh(new T.PlaneGeometry(4, 1.9), new T.MeshBasicMaterial({ color: 0xFFF6E6 })); w.position.set(2.9, 0.3, 0); w.rotation.y = -Math.PI / 2; env.add(w);
    scene.environment = pm.fromScene(env, 0.04).texture; pm.dispose();
  } catch (e) { /* no reflections */ }
  ctProgress(15, 'Arranging the desk…', R);
  const A = ofBuild(scene, q); R.A = A; R.glow = new AimGlow(scene);
  ctProgress(40, 'Hanging the pictures…', R);
  const fit = () => { const w = root.clientWidth, h = root.clientHeight; ren.setSize(w, h, false); cam.aspect = w / Math.max(1, h); cam.updateProjectionMatrix(); };
  fit(); R.fit = fit; window.addEventListener('resize', fit);
  ofControls(root, cv, scene, ren, A);
}
/** In the building: its renderer, scene and this room's camera; the room itself built with the building. */
function ofHosted(root: HTMLElement, q: number, cv: HTMLCanvasElement) {
  const R = OfficeRoom, H = R.host;
  R.ren = H.ren; R.scene = H.scene; R.cam = H.cam('office'); R.A = H.A('office'); R.glow = H.glow('office'); R.fit = null;
  ofControls(root, cv, R.scene, R.ren, R.A);
}
/** Looking, clicking, the keys, the photo, you, the visitor; then the room comes alive. */
function ofControls(root: HTMLElement, cv: HTMLCanvasElement, scene: any, ren: any, A: any) {
  const R = OfficeRoom, H = R.host;
  // looking: drag (or the mouse once the view has it on the PC), the arrow keys in the chair
  R.look = { yaw: 0, pitch: -0.08 }; R.seat = true; R.free = { x: 0, z: 0.98, v: 0, bob: 0 };
  if (H && H.enterAt) { const e = H.enterAt; H.enterAt = null; R.seat = false; R.free = { x: e.x, z: e.z, v: e.v || 0, bob: 0 }; R.look = { yaw: e.yaw, pitch: e.pitch || 0 }; }
  R.phoneAfter = () => ofVisitUi();
  let drag: any = null, moved = 0, justLocked = false;
  cv.addEventListener('pointerdown', e => {
    // walking on the PC: the view takes the mouse (no pointer, turn as far as you like); a click then uses what glows
    if (!R.seat && DESKTOP && e.pointerType === 'mouse') { drag = null; if (!aimLocked(cv)) { justLocked = true; aimLock(cv); } return; }
    drag = { x: e.clientX, y: e.clientY, yaw: R.look.yaw, pitch: R.look.pitch, pw: R.ph && R.ph.st === 'hold' ? R.ph.want.slice() : null, bw: R.bw && R.bw.st === 'hold' ? R.bw.want.slice() : null }; moved = 0; cv.setPointerCapture(e.pointerId); }, { signal: R.sig });
  R.mm$ = (e: MouseEvent) => { if (R.on && !R.seat && aimLocked(cv)) aimTurn(R.look, e, -1.25, 0.9); };
  document.addEventListener('mousemove', R.mm$);
  cv.addEventListener('pointermove', e => {
    if (!drag && R.seat && !R.overlay && !R.loading) { const o = ofAimedObj(e), on = !!(o && (o.userData.act === 'laptop' || o.userData.act === 'photo' || o.userData.act === 'phone') && !(R.ph && R.ph.st !== 'idle') && !(R.pk && R.pk.st !== 'idle')); R.lapHover = on; cv.style.cursor = on ? 'pointer' : ''; if (on && R.glow) R.glow.showObj(o); }
    if (!drag) return; moved = Math.max(moved, Math.hypot(e.clientX - drag.x, e.clientY - drag.y));
    if (drag.bw && R.bw && R.bw.st === 'hold') { R.bw.want = [clamp(drag.bw[0] + (e.clientX - drag.x) * 0.006, -1.2, 1.2), clamp(drag.bw[1] + (e.clientY - drag.y) * 0.004, -0.5, 0.6)]; return; }   // the bowl: turn and tilt it
    if (drag.pw && R.ph && R.ph.st === 'hold') { R.ph.want = [clamp(drag.pw[0] + (e.clientX - drag.x) * 0.004, -0.5, 0.5), clamp(drag.pw[1] + (e.clientY - drag.y) * 0.003, -0.4, 0.4)]; return; }   /* holding the photo: tilt it */ R.look.yaw = drag.yaw - (e.clientX - drag.x) * 0.004; R.look.pitch = clamp(drag.pitch - (e.clientY - drag.y) * 0.003, -1.25, 0.9); if (R.seat) R.look.yaw = clamp(R.look.yaw, -2.6, 2.6); }, { signal: R.sig });
  cv.addEventListener('pointerup', e => { if (aimLocked(cv)) { if (justLocked) justLocked = false; else ofClickAt(); return; } justLocked = false; if (drag && moved < 6) ofClickAt(e); drag = null; }, { signal: R.sig });
  root.addEventListener('click', ev => { const b = (ev.target as HTMLElement).closest('[data-of]') as HTMLElement; if (b) ofClick(b); }, { signal: R.sig });
  R.key$ = (e: KeyboardEvent) => {
    if (!R.on) return; const k = e.key.toLowerCase();
    if (R.overlay) { if (k === 'escape' && !document.querySelector('.layer')) { e.preventDefault(); e.stopImmediatePropagation(); if (R.overlay.classList.contains('lap-screen')) ofLaptopClose(); else if (R.overlay.classList.contains('ph-screen')) ofPhoneClose(); else ofPlannerClose(); } return; }   // the planner has the keys (typing)
    if (k === 'escape' && R.ph && R.ph.st === 'hold') { e.preventDefault(); e.stopImmediatePropagation(); ofPhotoPut(); return; }
    if (k === 'escape' && R.pk && R.pk.st === 'hold') { e.preventDefault(); e.stopImmediatePropagation(); ofPhonePut(); return; }
    if (k === 'escape') { e.preventDefault(); e.stopImmediatePropagation(); if (aimLocked()) { aimUnlock(); return; } if (aimEscUsed()) return; ofLeave(); return; }   // the first Esc only gives the mouse back
    if (k === 'h' && !R.seat) { e.preventDefault(); R.root.classList.toggle('ui-off'); return; }   // walking: hide or show the controls
    if (/^(w|a|s|d|arrow\w+|shift)$/.test(k)) { R.keys[k] = true; e.preventDefault(); e.stopImmediatePropagation(); }
  };
  R.ku$ = (e: KeyboardEvent) => { if (R.on) R.keys[e.key.toLowerCase()] = false; };
  window.addEventListener('keydown', R.key$, true); window.addEventListener('keyup', R.ku$, true);
  ofPad(); roomBoxDrag(root, 'office');
  // the family photo, then (for an interview) the crew member
  const next = () => {
    ctProgress(70, R.inc ? `${R.p.name} is at the door…` : 'Opening the blinds…', R);
    if (R.inc) {
      const go = () => { try { ofVisitor(); } catch (e) { R.vis = null; try { ErrorLog.add('office', 'Your office: the visitor couldn\'t be shown', (e && (e as any).message) || String(e), 'You can still talk to them.'); } catch (x) { /* no log */ } } ofReady(); };
      if (Human.ready) setTimeout(go, 30); else Human.load().then(() => setTimeout(go, 30), () => ofReady());
    } else ofReady();
  };
  const photo = () => (H && A.photoDone) ? (R.me = A.me || null, R.me && R.me.g && (R.me.g.visible = true), R.ph = null, next()) : ofFamilyPhoto(ren, tex => {
    A.photoDone = true;
    const T2 = THREE, fr = new T2.Group(); A.photoAt.add(fr);
    const bk = new T2.Mesh(new T2.BoxGeometry(0.2, 0.155, 0.012), new T2.MeshPhysicalMaterial({ color: 0xC9A04E, metalness: 1, roughness: 0.25 })); bk.position.set(0, 0.09, 0); bk.rotation.x = -0.15; fr.add(bk);
    const ph = new T2.Mesh(new T2.PlaneGeometry(0.18, 0.135), new T2.MeshStandardMaterial({ map: tex, roughness: 0.35 })); ph.position.set(0, 0.09, 0.0065); ph.rotation.x = -0.15; fr.add(ph);
    const st = new T2.Mesh(new T2.BoxGeometry(0.03, 0.12, 0.008), new T2.MeshPhysicalMaterial({ color: 0x8A6A2A, metalness: 1, roughness: 0.3 })); st.position.set(0, 0.06, -0.04); st.rotation.x = 0.4; fr.add(st);
    const hb = new T2.Mesh(new T2.BoxGeometry(0.24, 0.2, 0.12), new T2.MeshBasicMaterial({ visible: false })); hb.position.set(0, 0.09, 0); hb.userData.act = 'photo'; fr.add(hb); A.hits.push(hb);
    // you: your own figure, seen from your eyes
    try {
      const me: any = myPilot(); R.me = selfBody(scene, me && me.look ? Object.assign({}, me.look, { hat: 'none' }) : ctLook('me', 'm', 'public'), company().color);
      if (R.me) { R.me.chair = new T2.Vector3(0, 0.64, 1.14); R.me.eye0 = R.me.chair.clone().add(selfEyeOff(R.me, Math.PI, 0)); }   // sitting on the cushion, back in the chair
      A.me = R.me;
    } catch (e) { R.me = null; }
    R.ph = null;
    next();
  });
  if (Human.ready) setTimeout(photo, 30); else Human.load().then(() => setTimeout(photo, 30), () => next());
  R.loading = true;
  R.perf = Perf.state();
  if (H) return;   // the building draws it
  const loop = () => { if (!R.on) return; R.raf = requestAnimationFrame(loop); if (!R.loading && (!R.overlay || R.lapZ) && !Perf.skip(R.perf)) ofFrame(); };   // the room rests while the planner is open
  R.raf = requestAnimationFrame(loop);
}
function ofReady() {
  const R = OfficeRoom; if (!R.on) return;
  ctProgress(92, 'Turning on the lamp…', R);
  setTimeout(() => {
    if (!R.on) return;
    try { R.ren.compile(R.scene, R.cam); } catch (e) { /* first frame */ }
    R.loading = false; R.t0 = performance.now(); try { ofFrame(); } catch (e) { /* next */ }
    ctProgress(100, 'Ready', R);
    const wait = Math.max(300, 2400 - (performance.now() - R.loadT0));
    setTimeout(() => { const L = R.root && R.root.querySelector('.ct-loader') as HTMLElement; if (L) { L.classList.add('out'); setTimeout(() => L.remove(), 800); }
      if (R.mode === 'interview') ofKnock(); else ofVisitUi(); }, wait);
  }, 40);
}
OfficeRoom.close = function (quiet?: boolean) {
  const R = OfficeRoom; if (!R.on) return; R.on = false;
  try { osRestore(R); } catch (e) { /* as it was */ }
  if (R.host) {   // in the building: only the room's own controls go; the building keeps the room
    const H = R.host; R.host = null;
    if (R.overlay && R.overlay.classList.contains('lap-screen')) { try { lapUnmount(); } catch (e) { /* closed */ } }
    if (R.overlay) { try { R.overlay.remove(); } catch (e) { /* gone */ } } R.overlay = null; R.lapZ = null; document.body.classList.remove('of-over');
    window.removeEventListener('keydown', R.key$, true); window.removeEventListener('keyup', R.ku$, true); document.removeEventListener('mousemove', R.mm$);
    try { R.ac && R.ac.abort(); } catch (e) { /* none */ } try { Voice.stop(); } catch (e) { /* ignore */ }
    if (R.vis && R.vis.pivot && R.A) { try { R.A.root.remove(R.vis.pivot); } catch (e) { /* gone */ } }
    H.unmount('office', R.doorT ? 1 : 0); R.ren = null; R.scene = null; R.A = null; R.vis = null; R.ph = null; R.pk = null; R.glow = null; R.root = null;
    if (!quiet) H.leaveAll();
    return;
  }
  if (R.overlay && R.overlay.classList.contains('lap-screen')) { try { lapUnmount(); } catch (e) { /* closed */ } }
  R.overlay = null; R.lapZ = null; document.body.classList.remove('of-over');
  cancelAnimationFrame(R.raf); window.removeEventListener('keydown', R.key$, true); window.removeEventListener('keyup', R.ku$, true); window.removeEventListener('resize', R.fit);
  document.removeEventListener('mousemove', R.mm$); aimUnlock(); R.glow = null;
  try { Voice.stop(); } catch (e) { /* ignore */ }
  FrameGen.dispose(R.perf); exitFreeRenderer(R.ren, R.scene); R.ren = null; R.scene = null; R.A = null;
  R.root.remove(); R.vis = null; R.me = null; R.ph = null; R.pk = null;
  if (!quiet) { try { refresh(); } catch (e) { /* ignore */ } }
};
function ofLeave() {
  const R = OfficeRoom; if (!R.on) return;
  // leaving mid-conversation: the report stays open
  const msg = R.mode === 'interview' && R.vis && !R.decided && R.vis.state !== 'gone' ? `${R.p.name} goes back to work. The report is still open.` : '';
  ofExitToMain(msg);
}
/** Out of the office: the office's loading screen while the room is cleared from memory and the app comes back. */
function ofExitToMain(msg?: string, to?: string) {
  if (!OfficeRoom.on) return;
  exitSplash('office', 'Leaving the office', [
    { pct: 30, step: 'Closing the office…', run: () => { const H = OfficeRoom.host; OfficeRoom.close(true); if (H) H.closeAll(); } },
    { pct: 55, step: 'Clearing the room from memory…', run: exitFreeMemory },
    { pct: 85, step: to === 'hangars' ? 'Loading your hangars…' : 'Loading your airline…', run: () => { if (to) { try { roomGoTo(to); } catch (e) { refresh(); } } else refresh(); } },
  ], () => { if (msg) toast(msg, 'info'); });
}

/* ---------- the visitor ---------- */
function ofVisitor() {
  const R = OfficeRoom, T = THREE, p = R.p, role = personRole(p);
  const m = Human.build(p.look, role, company().color || '#2C8CFF', av3Style(), 0.85);
  const pivot = new T.Group(), holder = new T.Group(); pivot.rotation.order = 'YXZ'; holder.add(m.root); pivot.add(holder); R.A.root.add(pivot);
  m.root.traverse((o: any) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  R.vis = { m, pivot, holder, x: -2.75, z: -2.6, yaw: Math.PI / 2, sitK: 0, wantSit: 0, dist: 0, v: 0, path: [], state: 'outside', mood: null, g: null, talkUntil: 0, attitude: ofAttitude(p) };
  pivot.visible = false;
}
/** How they'll be in the room: honest, defensive, dismissive or lying; from who they are and how they feel. */
function ofAttitude(p: any): string {
  const mood = typeof p.mood === 'number' ? p.mood : 60, w = p.warnings || 0, rt = p.rating || 3.5;
  const W: [string, number][] = [['honest', 0.38 + (rt - 3.5) * 0.15], ['defensive', 0.26 + w * 0.04], ['dismissive', 0.14 + Math.max(0, 50 - mood) / 160 + (p.stubborn || 0) * 0.06], ['lying', 0.2 + w * 0.03]];
  let tot = W.reduce((s, x) => s + Math.max(0.02, x[1]), 0), r = Math.random() * tot;
  for (const [k, v] of W) { r -= Math.max(0.02, v); if (r <= 0) return k; }
  return 'honest';
}
function ofKnock() {
  if (Sfx.play('door-knock')) { ofKnockAsk(); return; }
  try {
    const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext, ac = OfficeRoom.ac || (OfficeRoom.ac = new AC());
    [0, 0.22, 0.44].forEach(dl => { const t = ac.currentTime + 0.05 + dl, n = ac.createBuffer(1, 4410, 44100), d = n.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / 380); const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); f.type = 'lowpass'; f.frequency.value = 420; g.gain.value = 0.9; s.buffer = n; s.connect(f); f.connect(g); g.connect(ac.destination); s.start(t); });
  } catch (e) { /* no sound */ }
  ofKnockAsk();
}
function ofKnockAsk() {
  ofSay('', 'Someone is knocking on your door.', 'A knock at the door');
  const R = OfficeRoom, o = R.root.querySelector('.ct-opts') as HTMLElement;
  if (o) o.innerHTML = `<button class="btn primary" data-of="comein">Come in</button>`;
  // nobody answering: they knock once more after a while
  clearTimeout(R.knockT); R.knockT = setTimeout(() => { if (R.on && R.vis && R.vis.state === 'outside' && !R.started && R.root.querySelector('[data-of=comein]')) ofKnockAgain(); }, 12000);
}
function ofKnockAgain() { const R = OfficeRoom; if (Sfx.play('door-knock')) return; try { const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext, ac = R.ac || (R.ac = new AC()); [0, 0.22].forEach(dl => { const t = ac.currentTime + 0.05 + dl, n = ac.createBuffer(1, 4410, 44100), d = n.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / 380); const s2 = ac.createBufferSource(), f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420; s2.buffer = n; s2.connect(f); f.connect(ac.destination); s2.start(t); }); } catch (e) { /* no sound */ } }
/** You answer the knock: "Come in." in your own voice, then the door opens and they come in. */
function ofComeIn() {
  const R = OfficeRoom; clearTimeout(R.knockT); sfxDoor('wood', true); const o = R.root.querySelector('.ct-opts') as HTMLElement; if (o) o.innerHTML = '';
  const mine = 'Come in.', meWho = myWho('neutral'), you = R.root.querySelector('.of-you') as HTMLElement;
  if (you) you.innerHTML = `<span><b>You</b>${esc(mine)}</span>${voiceButton(mine, meWho, 'Play what you said')}`;
  if (ofAutoVoice()) { try { Voice.speak(mine, () => { /* said */ }, meWho); } catch (e) { /* no voice */ } }
  Sound.tick(); setTimeout(() => { if (R.on) ofEnter(); }, 500);
}
/** In they come: the door swings open, a moment later they step in, walk round the furniture to the chair, turn
 *  and sit down facing you. */
function ofEnter() {
  const R = OfficeRoom, V = R.vis; if (!V) { ofInterviewStart(); return; }
  R.doorT = 1; V.x = -3.8; V.z = -2.6; V.yaw = Math.PI / 2;   // waiting outside, in the corridor
  setTimeout(() => {
    if (!R.on || R.vis !== V || R.started) return;
    V.pivot.visible = true; V.state = 'walking';
    V.path = ofRoute(V.x, V.z, -0.6, -0.9).concat([[0, -0.86]]); V.after = 'sit';
    // they walk in, turn and sit down as animated; only if they get stuck (no progress for 4 seconds) are they
    // put straight into the chair
    let mark = '', since = performance.now();
    const watch = setInterval(() => {
      if (!R.on || R.vis !== V || R.started) { clearInterval(watch); return; }
      const now = `${V.state}|${V.x.toFixed(2)}|${V.z.toFixed(2)}|${V.yaw.toFixed(2)}|${V.sitK.toFixed(2)}`;
      if (now !== mark) { mark = now; since = performance.now(); } else if (performance.now() - since > 4000) { clearInterval(watch); ofSeatNow(); }
    }, 500);
  }, 2000);
}
/* ---------- finding the way: round the door, the walls and the furniture ---------- */
// what stands on the floor, as rectangles [x0, z0, x1, z1] (the room is 6.4 m by 6.4 m; the door is on the left wall
// between z −3.1 and −2.1 and opens into the room, hinged at z −2.1)
const OF_BLOCK: number[][] = [
  [-1.08, -0.5, 1.08, 0.5],      // the desk
  [-0.45, 0.55, 0.45, 1.45],     // your chair
  [-0.34, -1.32, 0.34, -0.7],    // the visitor's chair
  [-3.05, -3.4, -1.65, -3.0], [1.65, -3.4, 3.05, -3.0],   // the bookshelves
  [0.72, -3.28, 1.98, -2.22],    // the pet's bed and bowls
  [-3.2, 0.1, -2.35, 2.3], [-2.05, 0.68, -1.45, 1.72],     // the sofa and the low table
  [2.5, -3.2, 3.2, -2.7],        // the plant
  [-1.25, 2.45, 1.25, 3.0],      // the credenza
  [-3.2, -2.22, -2.12, -2.04],   // the door, open
];
const OF_GAP = 0.24;   // how far a person keeps from things (half their width, and a little)
function ofFree(x: number, z: number): boolean {
  if (z < -3.4 + OF_GAP || z > 3.0 - OF_GAP || x > 3.2 - OF_GAP - 0.1 || x < -4.0) return false;
  if (x < -3.2 + OF_GAP && (z < -3.1 + OF_GAP || z > -2.1 - OF_GAP)) return false;   // the wall, but for the doorway
  for (const b of OF_BLOCK) if (x > b[0] - OF_GAP && x < b[2] + OF_GAP && z > b[1] - OF_GAP && z < b[3] + OF_GAP) return false;
  return true;
}
function ofClear(a: number[], b: number[]): boolean {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(d / 0.04));
  for (let i = 1; i < n; i++) if (!ofFree(a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n)) return false;
  return true;
}
/** A walk from one place to another that keeps clear of everything: the shortest way on a 10 cm grid, then
 *  straightened where nothing is in the way. */
function ofRoute(x0: number, z0: number, x1: number, z1: number): number[][] {
  const C = 0.1, GX0 = -4.0, GZ0 = -3.4, NX = 73, NZ = 65, idx = (i: number, j: number) => j * NX + i;
  const cell = (x: number, z: number) => [Math.round((x - GX0) / C), Math.round((z - GZ0) / C)];
  const pos = (i: number, j: number) => [GX0 + i * C, GZ0 + j * C];
  const free = new Uint8Array(NX * NZ); for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const p = pos(i, j); free[idx(i, j)] = ofFree(p[0], p[1]) ? 1 : 0; }
  const near = (x: number, z: number) => { const [ci, cj] = cell(x, z); let best = -1, bd = 1e9; for (let j = Math.max(0, cj - 6); j <= Math.min(NZ - 1, cj + 6); j++) for (let i = Math.max(0, ci - 6); i <= Math.min(NX - 1, ci + 6); i++) if (free[idx(i, j)]) { const d = (i - ci) ** 2 + (j - cj) ** 2; if (d < bd) { bd = d; best = idx(i, j); } } return best; };
  const s = near(x0, z0), g = near(x1, z1); if (s < 0 || g < 0) return [[x1, z1]];
  const cost = new Float32Array(NX * NZ).fill(1e9), from = new Int32Array(NX * NZ).fill(-1), done = new Uint8Array(NX * NZ);
  const gi = g % NX, gj = (g / NX) | 0, hh = (k: number) => Math.hypot(k % NX - gi, ((k / NX) | 0) - gj);
  const heap: number[][] = []; const push = (f: number, k: number) => { heap.push([f, k]); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let c = 0; for (;;) { const l = 2 * c + 1, r = l + 1; let m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m; } } return top; };
  cost[s] = 0; push(hh(s), s);
  while (heap.length) {
    const k = pop()[1]; if (done[k]) continue; done[k] = 1; if (k === g) break;
    const i = k % NX, j = (k / NX) | 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue; const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= NX || nj >= NZ) continue;
      const n = idx(ni, nj); if (!free[n] || done[n]) continue;
      if (di && dj && (!free[idx(i + di, j)] || !free[idx(i, j + dj)])) continue;   // no cutting corners
      const c = cost[k] + (di && dj ? 1.414 : 1); if (c < cost[n]) { cost[n] = c; from[n] = k; push(c + hh(n), n); }
    }
  }
  if (from[g] < 0 && g !== s) return [[x1, z1]];
  const cells: number[][] = []; for (let k = g; k >= 0; k = k === s ? -1 : from[k]) cells.unshift(pos(k % NX, (k / NX) | 0));
  cells[0] = [x0, z0]; cells[cells.length - 1] = [x1, z1];
  // straighten: from each point, on to the farthest one that can be seen
  const out: number[][] = []; let a = 0;
  while (a < cells.length - 1) { let b = cells.length - 1; while (b > a + 1 && !ofClear(cells[a], cells[b])) b--; out.push(cells[b]); a = b; }
  return out;
}
/** Straight into the chair, facing you, and the conversation begins. */
function ofSeatNow() {
  const R = OfficeRoom, V = R.vis;
  if (V) { V.path = []; V.pivot.visible = true; V.x = 0; V.z = -0.86; V.yaw = 0; V.v = 0; V.state = 'sitting'; V.wantSit = 1; V.sitK = 1; }
  R.doorT = 0;
  if (!R.started) { R.started = true; ofInterviewStart(); }
}
/** Something went wrong with the person in the room: note it (Settings → Updates and errors), seat them, carry on. */
function ofRescue(e: any) {
  const R = OfficeRoom; if (R.rescued) return; R.rescued = true;
  try { ErrorLog.add('office', 'Your office: the visitor couldn\'t be shown moving', (e && e.message) || String(e), 'The conversation carries on. Tell us if this keeps happening.'); } catch (x) { /* no log */ }
  try { ofSeatNow(); } catch (x) { /* carry on */ }
}
function ofExit() {
  const R = OfficeRoom, V = R.vis; if (!V) return;
  if (!V.m) { setTimeout(() => ofVisitUi(true), 1500); return; }   // no figure was shown
  V.wantSit = 0; V.state = 'standing';
  setTimeout(() => { if (!R.on || !R.vis) return; R.doorT = 1; V.state = 'walking'; V.path = [[-0.6, -0.9] as number[]].concat(ofRoute(-0.6, -0.9, -3.8, -2.6)); V.after = 'gone'; }, 1300);
}

/* ---------- every frame ---------- */
function ofFrame() {
  const R = OfficeRoom, T = THREE, now = (performance.now() - (R.t0 || 0)) / 1000, dt = Math.min(0.05, now - (R.last || now)); R.last = now;
  try { petStep(R.A, now, dt); } catch (e) { /* no pet */ }
  // the door
  if (R.A.doorLeaf) { const want = R.doorT ? -1.5 : 0; R.A.doorLeaf.rotation.y += (want - R.A.doorLeaf.rotation.y) * Math.min(1, dt * 2.5); }
  const V = R.vis;
  try {
  if (V && V.pivot.visible) {
    const top = V.m.top || 1.7, t = now + 3;
    if (V.state === 'walking' && V.after === 'sit' && R.doorT && V.x > -1.5) R.doorT = 0;   // the door shuts behind them
    if (V.state === 'walking' && V.path.length) {
      const [tx, tz] = V.path[0], dx = tx - V.x, dz = tz - V.z, d = Math.hypot(dx, dz);
      const vWant = Math.min(1.0, Math.sqrt(2 * 1.4 * (d + (V.path.length > 1 ? 1 : 0)))); V.v += Math.max(-1.4 * dt, Math.min(1.4 * dt, vWant - V.v));
      const step = Math.min(d, V.v * dt); if (d > 1e-4) { V.x += dx / d * step; V.z += dz / d * step; V.dist += step; }
      const yawT = Math.atan2(dx, dz); let dy = yawT - V.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI; V.yaw += dy * Math.min(1, dt * 5);
      if (d < 0.03) { V.path.shift(); if (!V.path.length) { V.v = 0; if (V.after === 'sit') { V.state = 'turning'; } else { V.state = 'gone'; V.pivot.visible = false; ofGone(); setTimeout(() => { R.doorT = 0; ofVisitUi(true); }, 600); } } }
    } else if (V.state === 'turning') {
      let dy = 0 - V.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI; V.yaw += dy * Math.min(1, dt * 3.5);
      if (Math.abs(dy) < 0.04) { V.yaw = 0; V.state = 'sitting'; V.wantSit = 1; }
    }
    V.sitK += Math.sign(V.wantSit - V.sitK) * Math.min(Math.abs(V.wantSit - V.sitK), dt * 1.0);
    const sk = V.sitK * V.sitK * (3 - 2 * V.sitK);
    if (V.state === 'sitting' && sk > 0.99 && !R.started) { R.started = true; ofInterviewStart(); }
    // back into the chair as they sit (they stood just in front of it)
    const zz = V.state === 'walking' ? V.z : V.z + (R.A.visitor.z - V.z) * sk;
    V.pivot.position.set(V.x, sk * 0.49, zz); V.holder.position.y = -sk * top * 0.52; V.pivot.rotation.y = V.yaw;
    const seated = sk > 0.5;
    V.pivot.rotation.x = (seated ? 1 : 1.2) * (0.011 * Math.sin(t * 0.37) + 0.005 * Math.sin(t * 0.91 + 1));
    V.pivot.rotation.z = (seated ? 1 : 1.2) * (0.012 * Math.sin(t * 0.29 + 2) + 0.004 * Math.sin(t * 0.77));
    // their voice heard: the mouth follows it (from the start each time Play is pressed), not the reading time
    const heard = R.p && humanVoiceOn(R.p.name);
    if (R.p && humanVoiceBusy(R.p.name)) { R.talkUntil = 0; R.sayText = ''; }   // the voice leads: still until it is heard, then with it
    const talking = heard || R.talkUntil > now;
    let gT = V.state === 'walking' ? cabinLerpG(humanGesture(null, t), humanGesture({ kind: 'walk', v: Math.max(0.6, V.v), seed: R.p && R.p.name }, V.dist / 1.25), Math.min(1, V.v / 0.6)) : humanGesture(null, t);
    gT = humanSitMove(cabinLerpG(gT, humanGesture({ kind: 'sit', v: 0 }, t), sk), sk);   // leaning forward as they sit down or stand up
    // body language: how they feel about what they say
    const att = V.say || V.attitude;
    if (seated && V.state === 'sitting') {
      if (att === 'dismissive') { gT.L = [0.62, 0.12, 0.95, 2.05]; gT.R = [0.56, 0.12, 0.9, 2.0]; gT.lean = -0.04; gT.tilt = 0.06; }
      else if (att === 'honest') { gT.nod += 0.1; }
      else if (att === 'lying') { gT.shake += 0.32 * Math.sin(t * 0.7) * (talking ? 1 : 0.6); }
      else if (att === 'defensive' && talking) { gT.L = [0.55 + 0.1 * Math.sin(t * 2), 0.25, -0.1, 1.1]; gT.R = [0.55 + 0.1 * Math.sin(t * 2 + 1), 0.25, -0.1, 1.1]; }
      if (talking) { gT.nod += 0.05 * Math.sin(t * 3.3); gT.shake += 0.04 * Math.sin(t * 1.3); }
      if (R.flush) gT.flush = 0.35;
    }
    // they look at you (your eyes), unless they're avoiding them
    if (V.state === 'sitting') { const ey = R.cam.position, h = new T.Vector3(V.x, 1.25, zz); gT.nod += clamp(-(ey.y - h.y) / Math.max(0.5, Math.hypot(ey.x - h.x, ey.z - h.z)), -0.3, 0.3) * 0.6; }
    V.g = V.g ? cabinLerpG(V.g, gT, Math.min(1, dt * 6)) : gT;
    V.m.pose({ t, yaw: 0, gaze: [0, 0.05], blink: (t % 4.1) < 0.12 ? 1 : 0, g: V.g, talk: R.p ? humanTalk(R.p.name, R.sayText, R.sayAt) : 0 });
  }
  } catch (e) { ofRescue(e); }
  // you: in your chair (look around), or walking about
  const lk = ofLapK();
  if (R.seat && lk > 0 && R.A.lapScr) {
    // leaning in to the laptop (and back), eased at both ends
    const e = lk * lk * (3 - 2 * lk), S = R.A.lapScr, c = new T.Vector3(), n = new T.Vector3(0, 0, 1);
    S.getWorldPosition(c); n.applyQuaternion(S.getWorldQuaternion(new T.Quaternion()));
    const to = c.clone().add(n.multiplyScalar(0.42)), from = R.me && R.me.eye0 ? R.me.eye0.clone() : new T.Vector3(0, 1.2, 1.02);
    if (R.me) { try { R.me.pitch = 0; selfPose(R.me, R.me.chair, Math.PI, 0.22 * e, 1, 0, 0, now, dt); } catch (x) { R.me = null; } }
    R.cam.position.copy(from.lerp(to, e));
    const yaw = Math.PI + R.look.yaw, p = R.look.pitch, ahead = R.cam.position.clone().add(new T.Vector3(Math.sin(yaw) * Math.cos(p), Math.sin(p), Math.cos(yaw) * Math.cos(p)));
    R.cam.lookAt(ahead.lerp(c, e));
    if (S.material) S.material.color.setScalar(1 + 0.6 * Math.sin(Math.PI * Math.min(1, lk * 1.4)));   // the screen lights up as it opens
  } else if (R.bw) {
    ofBowlFrame(dt, now);   // down on one knee by the bowls, the food bowl in your hands
  } else if (R.seat) {
    // you in your chair: your body (leaning in and turning to reach for the photo), your eyes where your head is
    const P = R.pk ? ofPhoneStep(dt, now) : ofPhotoStep(dt, now), ph = R.ph, S = R.me;
    let eye = new T.Vector3(0, 1.2, 1.02);
    if (S) { try { S.pitch = R.look.pitch * (1 - P.lookK); eye = selfPose(S, P.slide ? S.chair.clone().add(new T.Vector3(0, 0, -P.slide)) : S.chair, Math.PI + P.turn + clamp(R.look.yaw * 0.3, -0.4, 0.4) * (1 - P.lookK), P.lean, 1, 0, 0, P.t != null ? P.t : now, dt, P.arms); } catch (e) { R.me = null; } }
    R.cam.position.copy(eye);
    const yaw = Math.PI + R.look.yaw;   // facing −z
    const k = R.keys || {};
    if (ph && ph.st === 'hold') { if (k.arrowleft) ph.want[0] = clamp(ph.want[0] - dt * 0.6, -0.5, 0.5); if (k.arrowright) ph.want[0] = clamp(ph.want[0] + dt * 0.6, -0.5, 0.5); if (k.arrowup) ph.want[1] = clamp(ph.want[1] - dt * 0.5, -0.4, 0.4); if (k.arrowdown) ph.want[1] = clamp(ph.want[1] + dt * 0.5, -0.4, 0.4); }
    else if (k.arrowleft) R.look.yaw = clamp(R.look.yaw + dt * 1.4, -2.6, 2.6); if (k.arrowright) R.look.yaw = clamp(R.look.yaw - dt * 1.4, -2.6, 2.6); if (k.arrowup) R.look.pitch = clamp(R.look.pitch + dt, -1.25, 0.9); if (k.arrowdown) R.look.pitch = clamp(R.look.pitch - dt, -1.25, 0.9);
    const p = R.look.pitch, ahead = R.cam.position.clone().add(new T.Vector3(Math.sin(yaw) * Math.cos(p), Math.sin(p), Math.cos(yaw) * Math.cos(p)));
    if (P.at && P.lookK > 0) ahead.lerp(P.at, P.lookK);   // your eyes follow the photo
    R.cam.lookAt(ahead);
  } else ofWalk(dt, now);
  if (R.glow) { if ((R.seat && !R.lapHover) || R.overlay || R.lapZ) R.glow.hide(); R.glow.step(dt); }
  // frame generation: the photo in your hands moves with your view
  if (R.perf) { const P = R.ph && R.ph.st !== 'idle' && R.A && R.A.photoAt; R.perf.anchor = P ? R.cam : null; R.perf.anchorDraw = P ? [R.A.photoAt] : null; }
  try { osStep(R, dt, now); } catch (e) { /* the suite rests */ }
  FrameGen.draw(R.perf, R.ren, R.scene, R.cam); Perf.frame(R.perf, R.ren);
}
function ofBlocked(x: number, z: number): boolean {
  const H = OfficeRoom.host; if (H) { const d = H.pass('office', x, z); if (d) return d < 0; }   // the doorway to the corridor: open or shut
  if (OfficeRoom.A && OfficeRoom.A.suite && osIn(x, z)) return osBlocked(x, z);   // your suite, through its door
  if (x < -2.9 || x > 2.9 || z < -3.1 || z > 2.7) return true;
  const B = [[-1.3, -0.7, 1.3, 0.7], [-0.45, 0.6, 0.45, 1.4], [-0.45, -1.4, 0.45, -0.6], [-3.2, 0.1, -1.6, 2.3], [-1.4, 2.25, 1.4, 3.0], [-3.1, -3.4, -1.5, -2.85], [1.5, -3.4, 3.1, -2.85], [2.5, -3.2, 3.2, -2.5]];
  for (const r of B) if (x > r[0] && x < r[2] && z > r[1] && z < r[3]) return true;
  return false;
}
function ofWalk(dt: number, now?: number) {
  const R = OfficeRoom, F = R.free, K = R.keys || {}, T = THREE;
  const f = (K.w || K.arrowup ? 1 : 0) - (K.s || K.arrowdown ? 1 : 0) + R.stick[1], r = (K.d || K.arrowright ? 1 : 0) - (K.a || K.arrowleft ? 1 : 0) + R.stick[0];
  const mag = Math.min(1, Math.hypot(f, r)), vmax = K.shift ? 2.0 : 1.2; F.v += ((mag > 0.05 ? vmax * mag : 0) - F.v) * Math.min(1, dt * 6);
  const yaw = R.look.yaw, fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  let mx = fx * f + rx * r, mz = fz * f + rz * r; const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml; if (R.host && R.host.assist && ml > 0.05) { const g2 = R.host.assist('office', F.x, F.z, mx, mz); mx = g2[0]; mz = g2[1]; }   // eased through an open doorway
  const step = F.v * dt;
  if (step > 0) { const nx = F.x + mx * step, nz = F.z + mz * step; if (!ofBlocked(nx, nz)) { F.x = nx; F.z = nz; } else if (!ofBlocked(nx, F.z)) F.x = nx; else if (!ofBlocked(F.x, nz)) F.z = nz; F.bob += step; }
  if (R.host && R.host.out('office', F.x, F.z, R.look, F.v)) return;   // through the door: the corridor takes over
  Sound.steps(F, F.bob, Math.abs(F.x) < 1.8 && Math.abs(F.z) < 1.5 ? 'carpet' : 'wood', F.v);   // the rug, or the parquet around it
  const bobY = Math.sin(F.bob / 0.65 * Math.PI) * 0.016 * Math.min(1, F.v / 1.1);
  R.cam.position.set(F.x, 1.64 + bobY, F.z);
  // your body under you: feet stepping, arms swinging; your eyes at your own height
  if (R.me) { try { const S = R.me, yb = yaw + Math.PI, o = selfEyeOff(S, yb, 0); S.pitch = R.look.pitch; const eye = selfPose(S, new T.Vector3(F.x - o.x, S.hipY, F.z - o.z), yb, 0, 0, F.v, F.bob, now || 0, dt); R.cam.position.set(eye.x, eye.y + bobY, eye.z); } catch (e) { R.me = null; } }
  const p = R.look.pitch; R.cam.lookAt(R.cam.position.clone().add(new T.Vector3(fx * Math.cos(p), Math.sin(p), fz * Math.cos(p))));
  // what's in front of you: the chair (sit) or the door (leave)
  const aim = R.root.querySelector('.of-aim') as HTMLElement, obj = ofAimedObj(), hint = obj ? obj.userData.act : '';
  if (R.glow) { if (obj) R.glow.showObj(obj); else R.glow.hide(); }   // what you can use glows softly
  if (aim) { aim.hidden = false; aim.textContent = osHint(hint) ? osHint(hint) : hint === 'sit' ? 'Click to sit in your chair' : hint === 'door' ? (R.host ? (R.doorT ? 'Click to shut the door' : 'Click to open the door to the corridor') : 'Click the door to leave the office') : '·'; aim.classList.toggle('on', !!hint); }
}
function ofAimed(e?: PointerEvent): string { const o = ofAimedObj(e); return o ? o.userData.act : ''; }
/** What you can use at the mouse (or, walking, at the dot in the middle), within reach. */
function ofAimedObj(e?: PointerEvent): any {
  const R = OfficeRoom, T = THREE, rc = new T.Raycaster();
  if (e && !aimLocked()) { const r = (R.root.querySelector('canvas') as HTMLElement).getBoundingClientRect(); rc.setFromCamera(new T.Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), R.cam); }
  else rc.setFromCamera(new T.Vector2(0, 0), R.cam);
  const h = rc.intersectObjects(R.A.hits, false)[0];
  if (h && R.A.occ) { const w = rc.intersectObjects(R.A.occ, false)[0]; if (w && w.distance < h.distance - 0.02) return null; }   // a wall in between
  return h && (h.distance < 2.6 || (/^(pet|bowl)/.test(h.object.userData.act || '') && h.distance < 7)) ? h.object : null;
}
function ofClickAt(e?: PointerEvent) {
  const R = OfficeRoom; if (R.loading) return;
  // the laptop's screen is up: a click beside it puts it away (and on the phone, picks the phone up after)
  if (R.overlay) return;   // the laptop fills the screen: its power button puts it away
  if (R.bw) { if (R.bw.st === 'hold') ofBowlPut(); return; }   // the food bowl in your hands: a click puts it down
  if (R.ph && R.ph.st !== 'idle') { if (R.ph.st === 'hold') ofPhotoPut(); return; }   // holding the photo: a click puts it back
  // the phone in your hand: a tap brings its screen up; a click on the laptop puts the phone down first, then opens it
  if (R.pk && R.pk.st !== 'idle') { if (R.pk.st === 'hold') { const a0 = ofAimed(e); if (a0 === 'laptop') phoneThen(R, () => ofLaptopOpen()); else if (a0 === 'phone') ofPhoneOpen(); else ofPhonePut(); } return; }   // a click on the phone uses it; anywhere else puts it back on the desk
  const a = ofAimed(e) || (R.seat ? '' : ofAimed());
  if (a === 'photo' && R.seat) { ofPhotoPick(); return; }
  if (a === 'phone' && R.seat) { ofPhonePick(); return; }
  if (a === 'laptop') { ofLaptopOpen(); return; }
  if (a === 'pet') { petStir(R.A); return; }
  if (a === 'bowl-water') { if (!petRefill(R.A, 'water')) toast('The water bowl is full', 'info'); return; }
  if (a === 'bowl-food') { ofBowlPick(); return; }
  if (R.seat) return;
  if (a && a.indexOf('suite-') === 0) { osClick(a); return; }   // in your suite
  if (a === 'door' && R.host) { R.doorT = R.doorT ? 0 : 1; sfxDoor('wood', R.doorT === 1); return; }   // in the building: the door opens and shuts
  if (a === 'sit') ofSit(); else if (a === 'door') { Sound.tick(); roomExitMenu(R.root, 'office', to => { R.doorT = 1; setTimeout(() => ofExitToMain('', to), 650); }); }
}
function ofSit() { aimUnlock(); const R = OfficeRoom; R.seat = true; R.look = { yaw: 0, pitch: -0.08 }; const aim = R.root.querySelector('.of-aim') as HTMLElement; if (aim) aim.hidden = true; ofVisitUi(); Sound.tick(); }
function ofPad() {
  const R = OfficeRoom, pad = R.root.querySelector('.ct-pad') as HTMLElement; if (!pad) return;
  const knob = pad.firstElementChild as HTMLElement; let id = -1;
  const move = (e: PointerEvent) => { const r = pad.getBoundingClientRect(), Rr = r.width / 2; let dx = (e.clientX - r.left - Rr) / Rr, dy = (e.clientY - r.top - Rr) / Rr; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } R.stick = [dx, -dy]; knob.style.transform = `translate(${dx * Rr * 0.6}px, ${dy * Rr * 0.6}px)`; };
  pad.addEventListener('pointerdown', e => { e.stopPropagation(); id = e.pointerId; pad.setPointerCapture(id); move(e); });
  pad.addEventListener('pointermove', e => { if (e.pointerId === id) move(e); });
  const up = (e: PointerEvent) => { if (e.pointerId !== id) return; id = -1; R.stick = [0, 0]; knob.style.transform = ''; };
  pad.addEventListener('pointerup', up); pad.addEventListener('pointercancel', up);
}

/* ---------- visiting: places to look, free mode ---------- */
function ofVisitUi(afterInterview?: boolean) {
  const R = OfficeRoom; if (!R.on) return;
  R.mode = 'visit';
  const sp = R.root.querySelector('.of-spots') as HTMLElement, box = R.root.querySelector('.ct-box') as HTMLElement, pad = R.root.querySelector('.ct-pad') as HTMLElement, hint = R.root.querySelector('.ct-hint') as HTMLElement;
  if (!afterInterview) { box.hidden = true; ofTopState(); }
  sp.hidden = false;
  const nRep = ofOpenReports().length;
  sp.innerHTML = (nRep ? [['reports', `Conduct reports (${nRep})`]] : []).concat([['laptop', 'My laptop'], ['planner', 'Flight planner'], ['schedule', 'Schedule'], ['sit', 'Sit in my chair'], ['paint', 'The paintings'], ['window', 'The window'], ['map', 'The route map'], ['photo', 'The family photo'], ['hangars', 'The hangars'], ['free', 'Free mode']]).map(x => `<button data-of="spot" data-k="${x[0]}" class="${(x[0] === 'free' && !R.seat) || (x[0] === 'sit' && R.seat && R.view !== 'photo') ? 'on' : ''}">${x[1]}</button>`).join('');
  pad.hidden = R.seat;
  if (!R.seat) { hint.hidden = false; hint.classList.remove('fade'); hint.textContent = DESKTOP ? 'W A S D to walk · the mouse looks around, all the way round · click what glows · H hides the controls · Esc for the menu' : 'Stick to walk · drag to look · tap your chair to sit · tap the door to leave'; setTimeout(() => hint.classList.add('fade'), 6000); }
  else hint.hidden = true;
  ofFit();
}
/** A screen at your desk (the Flight planner, the schedule): the whole screen over the office, working as it does
 *  in the app (the room stays behind it); Back or Esc returns to the office. */
const OF_SCREENS: { [k: string]: [string, string] } = { planner: ['Flight planner', 'routes'], schedule: ['Schedule', 'clock'] };
function ofScreenOpen(key: string) {
  const R = OfficeRoom; if (!R.on || R.overlay || !SCREENS[key]) return;
  for (const sel of ['.of-spots', '.ct-box', '.ct-pad', '.ct-hint', '.of-aim']) { const e = R.root.querySelector(sel) as HTMLElement; if (e) e.hidden = true; }
  const [title, ic] = OF_SCREENS[key] || [SCREENS[key].title, SCREENS[key].icon];
  const ov = document.createElement('div'); ov.className = 'of-planner of-scr-' + key; ov.setAttribute('data-screen', key);
  ov.innerHTML = `<div class="of-pl-head"><b>${icon(ic)}${esc(title)}</b><button class="btn ghost sm" data-of="plclose">${icon('close')}Back to the office</button></div><div class="of-pl-body"><section class="screen screen-${key}">${SCREENS[key].render()}</section></div>`;
  R.root.appendChild(ov); R.overlay = ov; document.body.classList.add('of-over');
  try { if (SCREENS[key].mount) SCREENS[key].mount(ov.querySelector('.of-pl-body .screen') as HTMLElement); } catch (e) { /* the screen shows what it can */ }
}
function ofPlannerOpen() { ofScreenOpen('planner'); }

/* ---------- the laptop: lean in, and its screen grows out of it (as the Operations monitor) ---------- */
const OF_LAP_MS = 750;
function ofLapK(): number {
  const R = OfficeRoom, Z = R.lapZ; if (!Z) return R.overlay && R.overlay.classList.contains('lap-screen') ? 1 : 0;
  const k = Math.min(1, (performance.now() - Z.t0) / OF_LAP_MS);
  if (k >= 1) { R.lapZ = null; if (Z.done) Z.done(); return Z.dir > 0 ? 1 : 0; }
  return Z.dir > 0 ? k : 1 - k;
}
/** The laptop's screen on your screen, from the chair. */
function ofLapRect(): { x: number; y: number; w: number; h: number } {
  const R = OfficeRoom, T = THREE, cam = R.cam, S = R.A.lapScr, rr = R.root.getBoundingClientRect();
  const keep = cam.position.clone(), q = cam.quaternion.clone();
  if (R.me && R.me.eye0) cam.position.copy(R.me.eye0); else cam.position.set(0, 1.2, 1.02); const yaw = Math.PI + R.look.yaw, p = R.look.pitch;
  cam.lookAt(cam.position.clone().add(new T.Vector3(Math.sin(yaw) * Math.cos(p), Math.sin(p), Math.cos(yaw) * Math.cos(p)))); cam.updateMatrixWorld();
  const [w, h] = S.userData.size || [0.32, 0.2]; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [x, y] of [[-w / 2, -h / 2], [w / 2, -h / 2], [-w / 2, h / 2], [w / 2, h / 2]]) {
    const v = S.localToWorld(new T.Vector3(x, y, 0)).project(cam), sx = (v.x + 1) / 2 * rr.width, sy = (1 - v.y) / 2 * rr.height;
    x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
  }
  cam.position.copy(keep); cam.quaternion.copy(q); cam.updateMatrixWorld();
  return { x: x0, y: y0, w: Math.max(40, x1 - x0), h: Math.max(30, y1 - y0) };
}
function ofLaptopOpen() {
  const R = OfficeRoom; if (!R.on || R.overlay || R.lapZ || !R.A || !R.A.lapScr || (R.pk && R.pk.st !== 'idle')) return;
  Sound.tick(); aimUnlock();
  if (!R.seat) { R.seat = true; R.view = 'sit'; }
  R.look = { yaw: R.look.yaw, pitch: R.look.pitch };
  for (const sel of ['.of-spots', '.ct-box', '.ct-pad', '.ct-hint', '.of-aim']) { const e = R.root.querySelector(sel) as HTMLElement; if (e) e.hidden = true; }
  const ov = document.createElement('div'); ov.className = 'of-planner lap-screen';
  R.root.appendChild(ov); R.overlay = ov; document.body.classList.add('of-over');
  try { lapMount(ov); } catch (e) { ov.innerHTML = '<p class="muted">The laptop could not start.</p>'; }
  let reduced = false; try { reduced = !!(State.settings as any).reduceMotion || matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* motion */ }
  if (reduced) return;
  const m = ofLapRect(), W = ov.offsetWidth || R.root.clientWidth, H = ov.offsetHeight || R.root.clientHeight;
  ov.classList.add('lap-zoom'); ov.style.transformOrigin = '0 0';
  ov.style.transform = `translate(${m.x - ov.offsetLeft}px, ${m.y - ov.offsetTop}px) scale(${m.w / W}, ${m.h / H})`; ov.style.opacity = '0';
  const fx = document.createElement('div'); fx.className = 'lap-zoom-fx'; fx.style.left = m.x + 'px'; fx.style.top = m.y + 'px'; fx.style.width = m.w + 'px'; fx.style.height = m.h + 'px'; R.root.appendChild(fx);
  R.lapZ = { t0: performance.now(), dir: 1, done: () => { ov.classList.remove('lap-zoom', 'lap-zoom-go'); ov.style.transform = ''; ov.style.opacity = ''; ov.style.transformOrigin = ''; } };
  void ov.offsetWidth;
  requestAnimationFrame(() => { ov.classList.add('lap-zoom-go'); ov.style.transform = 'translate(0px, 0px) scale(1, 1)'; ov.style.opacity = '1'; fx.classList.add('go'); setTimeout(() => fx.remove(), 900); });
}
function ofLaptopClose() {
  const R = OfficeRoom, ov = R.overlay; if (!ov || !ov.classList.contains('lap-screen') || R.lapZ) return;
  Sound.tick(); try { lapUnmount(); } catch (e) { /* closed */ }
  const finish = () => { ov.remove(); if (R.overlay === ov) R.overlay = null; document.body.classList.remove('of-over'); ofVisitUi(); };
  let reduced = false; try { reduced = !!(State.settings as any).reduceMotion || matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* motion */ }
  if (reduced) { finish(); return; }
  const m = ofLapRect(), W = ov.offsetWidth || R.root.clientWidth, H = ov.offsetHeight || R.root.clientHeight;
  ov.style.pointerEvents = 'none'; ov.style.transformOrigin = '0 0'; ov.classList.add('lap-zoom', 'lap-zoom-go', 'lap-zoom-back');
  R.lapZ = { t0: performance.now(), dir: -1, done: finish };
  requestAnimationFrame(() => { ov.style.transform = `translate(${m.x - ov.offsetLeft}px, ${m.y - ov.offsetTop}px) scale(${m.w / W}, ${m.h / H})`; ov.style.opacity = '0'; });
}
/** After a change (a leg moved, a route added): the screen over the office shows it too. */
function ofScreenRefresh() {
  const R = OfficeRoom; if (!R.on || !R.overlay) return;
  const key = R.overlay.getAttribute('data-screen'); if (!key || key === 'planner' || !SCREENS[key]) return;   // the planner redraws itself
  const sec = R.overlay.querySelector('.of-pl-body .screen') as HTMLElement; if (sec) patchHtml(sec, SCREENS[key].render());
}
function ofPlannerClose() {
  const R = OfficeRoom; if (!R.overlay) return;
  R.overlay.remove(); R.overlay = null; document.body.classList.remove('of-over'); Sound.tick(); ofVisitUi();
}
/** The open conduct reports about people who still work for you, newest first. */
function ofOpenReports(): any[] { return ((State as any).incidents || []).filter((x: any) => x.status === 'open' && staffById(x.staffId)); }
/** From the office: the open conduct reports, each with who it is about, what happened and when; pick one to invite them in. */
function ofReportsUi() {
  const R = OfficeRoom, L = ofOpenReports();
  ofSay('', L.length ? 'Who would you like to see?' : 'There are no open conduct reports.', 'Conduct reports');
  const sp = R.root.querySelector('.of-spots') as HTMLElement; if (sp) sp.hidden = true;   // the list instead of the places, until you go back
  (R.root.querySelector('.ct-ctl') as HTMLElement).innerHTML = '<button class="btn ghost" data-of="back">Back</button>';
  (R.root.querySelector('.ct-opts') as HTMLElement).innerHTML = L.slice(0, 12).map((inc: any) => { const p = staffById(inc.staffId);
    return `<div class="of-rep-row"><button class="of-rep" data-of="invite" data-id="${esc(inc.id)}"><b>${esc(p.name)}</b><small>${esc(inc.title)} · ${esc(inc.date || '')}${courtReportable(inc) ? ' · can go to court' : ''}</small><span>Invite in</span></button>${courtReportable(inc) ? `<button class="of-rep court police-btn" data-of="tocourt" data-id="${esc(inc.id)}"><i class="pl-l"></i><i class="pl-r"></i><span>Report to the police</span></button>` : ''}</div>`; }).join('');
}
/** The person comes up: you sit down at your desk, there is a knock, and they walk in and sit facing you. */
function ofInviteNow(id: string) {
  const R = OfficeRoom, inc = ofOpenReports().filter((x: any) => x.id === id)[0], p = inc && staffById(inc.staffId);
  if (!p) { toast('This report is closed or the person no longer works for you', 'info'); return; }
  if (R.mode === 'interview' && R.vis && !R.decided && R.vis.state !== 'gone') { toast(`Finish your conversation with ${R.p.name} first`, 'info'); return; }
  Sound.tick();
  // whoever was here before has left
  if (R.vis && R.vis.pivot && R.vis.m) { try { R.A.root.remove(R.vis.pivot); R.vis.pivot.traverse((o: any) => { if (o.geometry) o.geometry.dispose(); }); } catch (e) { /* gone */ } }
  R.vis = null; R.inc = inc; R.p = p; R.mode = 'interview'; R.cond = null; R.asked = []; R.answers = 0; R.decided = false; R.ended = false; R.started = false; R.rescued = false; R.talkUntil = 0;
  R.seat = true; R.view = 'sit'; R.look = { yaw: 0, pitch: -0.08 };
  for (const sel of ['.of-spots', '.ct-pad', '.ct-hint', '.of-aim']) { const e = R.root.querySelector(sel) as HTMLElement; if (e) e.hidden = true; }
  const top = R.root.querySelector('.ct-top b') as HTMLElement; if (top) top.textContent = `Your office: ${p.name}, ${String(inc.title).toLowerCase()}`;
  ofSay('', `${p.name} is on the way up…`, 'Conduct report');
  const go = () => { if (!R.on || R.p !== p) return; try { ofVisitor(); } catch (e) { R.vis = null; } ofKnock(); };
  setTimeout(() => { if (Human.ready) go(); else Human.load().then(go, go); }, 1800);
}
function ofSpot(k: string) {
  if (k === 'reports') { Sound.tick(); ofReportsUi(); return; }
  if (k === 'laptop') { ofLaptopOpen(); return; }
  if (k === 'planner' || k === 'schedule') { Sound.tick(); ofScreenOpen(k); return; }
  const R = OfficeRoom; Sound.tick(); ofPhotoReset(); ofPhoneReset(); R.view = k; const box = R.root.querySelector('.ct-box') as HTMLElement; box.hidden = true; ofTopState();
  if (k !== 'free') aimUnlock();
  if (k === 'sit') { R.seat = true; R.look = { yaw: 0, pitch: -0.08 }; }
  else if (k === 'photo') { R.seat = true; R.look = { yaw: 0.53, pitch: -0.38 }; }
  else if (k === 'free') { R.seat = false; R.free = { x: 0.9, z: 1.6, v: 0, bob: 0 }; R.look = { yaw: 0.25, pitch: -0.05 }; aimLock(R.root.querySelector('canvas') as HTMLElement); }
  else { R.seat = false; const S: any = { paint: [-1.4, 0.4, Math.PI / 2 - 0.05, 0.05], window: [1.6, -0.4, -Math.PI / 2, -0.04], map: [0, -2.1, 0, 0.08] }[k]; R.free = { x: S[0], z: S[1], v: 0, bob: 0 }; R.look = { yaw: S[2], pitch: S[3] }; }
  ofVisitUi(true);
  const aim = R.root.querySelector('.of-aim') as HTMLElement; if (aim) aim.hidden = R.seat;
}

/* ---------- your pet's food bowl: down on one knee beside it, picked up, looked at, put down ---------- */
/** Where you are in the way of the pet's walk (you walking about, the visitor). */
function ofPetBlocked(x: number, z: number): boolean {
  const R = OfficeRoom; if (!R.on) return false;
  if (!R.seat && R.free && Math.hypot(x - R.free.x, z - R.free.z) < 0.55) return true;
  if (R.bw && Math.hypot(x - R.bw.spot.x, z - R.bw.spot.z) < 0.6) return true;
  if (R.vis && R.vis.state !== 'outside' && R.vis.state !== 'gone' && Math.hypot(x - R.vis.x, z - (R.vis.z || 0)) < 0.55) return true;
  return false;
}
const OF_BW_D = { dip: 0.4, reach: 0.9, lift: 1.1, lower: 1.0, release: 0.7 };
function ofBowlPick() {
  const R = OfficeRoom, A = R.A, P = A && A.pet; if (!P || R.bw || (R.ph && R.ph.st !== 'idle') || (R.pk && R.pk.st !== 'idle') || ofLapK() > 0 || R.overlay) return;
  const T = THREE, B = P.bowls.food, h = B.holder;
  h.updateMatrixWorld(true);
  const Bw = h.getWorldPosition(new T.Vector3()), gq = P.g.getWorldQuaternion(new T.Quaternion()), d = new T.Vector3(0, 0, 1).applyQuaternion(gq).setY(0).normalize();
  const f = d.clone().negate(), spot = Bw.clone().add(d.clone().multiplyScalar(0.44)); spot.y = 0;
  R.bw = { st: 'dip', t: 0, B, h, parent: h.parent, p0: h.position.clone(), q0: h.quaternion.clone(), Bw, f, spot, yaw: Math.atan2(f.x, f.z), want: [0, 0], tilt: [0, 0], a: {},
    prev: { seat: R.seat, free: Object.assign({}, R.free), look: Object.assign({}, R.look) }, dip: 0, back: false };
  if (R.glow) R.glow.hide(); R.lapHover = false; Sound.tick(); ofBowlUi();
}
function ofBowlPut() { const b = OfficeRoom.bw; if (!b || b.st !== 'hold') return; b.st = 'lower'; b.t = 0; ofBowlUi(); }
function ofBowlUi() {
  const R = OfficeRoom, b = R.bw, on = !!(b && b.st === 'hold'); let el = R.root && R.root.querySelector('.of-ph.of-bw') as HTMLElement;
  if (!on) { if (el) el.remove(); return; }
  if (el) return;
  const nm = (petData() || {} as any).name || 'your pet';
  el = document.createElement('div'); el.className = 'of-ph of-bw';
  el.innerHTML = `<span>${esc(nm)}'s bowl · ${DESKTOP ? 'drag or use the arrow keys' : 'drag'} to turn it</span><button class="btn sm ghost" data-bw="fill">Fill it up</button><button class="btn sm" data-bw="put">Put it down</button>`;
  el.addEventListener('pointerdown', e => e.stopPropagation());
  el.addEventListener('click', e => { const t = (e.target as HTMLElement).closest('[data-bw]') as HTMLElement; if (!t) return; e.stopPropagation(); if (t.getAttribute('data-bw') === 'put') ofBowlPut(); else ofBowlFill(); });
  R.root.appendChild(el);
}
/** Fill the bowl you are holding: kibble pours in from the bag. */
function ofBowlFill() { const R = OfficeRoom; if (!petRefill(R.A, 'food')) toast('The bowl is full', 'info'); }
/** The dip to black and back while you go over to the bowls, or back to where you were. */
function ofBowlDip(k: number) {
  const R = OfficeRoom; let d = R.root.querySelector('.of-dip') as HTMLElement;
  if (k <= 0.001) { if (d) d.remove(); return; }
  if (!d) { d = document.createElement('div'); d.className = 'of-dip'; R.root.appendChild(d); }
  d.style.opacity = String(Math.min(1, k));
}
/** Each frame with the bowl: you kneel by it, reach down, lift it up in front of you (its name towards you), turn it as
 *  you like, put it down, let go, and go back. Your hands hold it by its sides, outside the glaze. */
function ofBowlFrame(dt: number, now: number) {
  const R = OfficeRoom, b = R.bw, T = THREE, S = R.me, D = OF_BW_D; if (!b) return;
  const E = (x: number) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  b.t += dt;
  // over there and back: a quick dip to black either way
  if (b.st === 'dip') { ofBowlDip(b.t / D.dip); if (b.t >= D.dip) { b.st = 'rise'; b.t = 0; R.seat = true; } }
  else if (b.st === 'rise') { ofBowlDip(1 - b.t / D.dip); if (b.t >= D.dip) { b.st = 'reach'; b.t = 0; ofBowlDip(0); } }
  else if (b.st === 'out') { ofBowlDip(b.t / D.dip); if (b.t >= D.dip) { b.st = 'home'; b.t = 0; } }
  else if (b.st === 'home') {
    ofBowlDip(1 - b.t / D.dip);
    if (!b.back) { b.back = true; b.parent.attach(b.h); b.h.position.copy(b.p0); b.h.quaternion.copy(b.q0); R.seat = b.prev.seat; R.free = b.prev.free; R.look = b.prev.look; }
    if (b.t >= D.dip) { ofBowlDip(0); R.bw = null; ofBowlUi(); return; }
  }
  if (b.st === 'dip' || b.st === 'home') {
    // still where you were for this moment: the camera stays
    return;
  }
  let wL = 0, wR = 0, mv = 0;
  if (b.st === 'reach') { wL = wR = E(b.t / D.reach); if (b.t >= D.reach) { b.st = 'lift'; b.t = 0; R.A.root.attach(b.h); } }
  else if (b.st === 'lift') { wL = wR = 1; mv = E(b.t / D.lift); if (b.t >= D.lift) { b.st = 'hold'; b.t = 0; ofBowlUi(); } }
  else if (b.st === 'hold') { wL = wR = 1; mv = 1; }
  else if (b.st === 'lower') { wL = wR = 1; mv = 1 - E(b.t / D.lower); if (b.t >= D.lower) { b.st = 'release'; b.t = 0; Sound.tick(); } }
  else if (b.st === 'release') { wL = wR = 1 - E(b.t / D.release); if (b.t >= D.release) { b.st = 'out'; b.t = 0; } }
  else if (b.st === 'out') { wL = wR = 0; }
  // the keys turn and tilt it too
  const k = R.keys || {};
  if (b.st === 'hold') { if (k.arrowleft) b.want[0] = clamp(b.want[0] - dt * 1.2, -1.2, 1.2); if (k.arrowright) b.want[0] = clamp(b.want[0] + dt * 1.2, -1.2, 1.2); if (k.arrowup) b.want[1] = clamp(b.want[1] - dt * 0.6, -0.5, 0.6); if (k.arrowdown) b.want[1] = clamp(b.want[1] + dt * 0.6, -0.5, 0.6); }
  b.tilt[0] += (b.want[0] - b.tilt[0]) * Math.min(1, dt * 5); b.tilt[1] += (b.want[1] - b.tilt[1]) * Math.min(1, dt * 5);
  // the bowl: from the floor up in front of you, tilted towards you so you see the name and what is in it
  const f = b.f, right = new T.Vector3().crossVectors(f, new T.Vector3(0, 1, 0)).normalize(), hip = b.spot.clone().add(new T.Vector3(0, 0.5, 0));
  const hold = hip.clone().add(new T.Vector3(0, 0.44, 0)).add(f.clone().multiplyScalar(0.38)), S0 = Math.sin;
  hold.y += 0.002 * S0(now * 0.9) + 0.0015 * S0(now * 2.3); hold.addScaledVector(right, 0.0015 * S0(now * 1.1));
  const q0w = new T.Quaternion(); if (b.st === 'reach' || (b.st !== 'lift' && b.st !== 'hold' && b.st !== 'lower' && b.h.parent === b.parent)) b.h.getWorldQuaternion(q0w); else q0w.copy(b.q0w || b.h.quaternion);
  if (!b.q0w) { b.q0w = b.h.getWorldQuaternion(new T.Quaternion()); b.P0w = b.h.getWorldPosition(new T.Vector3()); }
  const qh = new T.Quaternion().setFromAxisAngle(right, -(0.28 + b.tilt[1])).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), b.tilt[0] + 0.03 * S0(now * 0.8))).multiply(b.q0w);
  if (b.h.parent !== b.parent) {
    const pos = b.P0w.clone().lerp(hold, mv); pos.y += 0.06 * Math.sin(Math.PI * mv);
    b.h.position.copy(pos); b.h.quaternion.copy(b.q0w).slerp(qh, mv); b.h.updateMatrixWorld(true);
  }
  // you: kneeling on one knee by the bowl, leaning down to it, upright with it in your hands
  const lean = 0.62 * (1 - mv) * (b.st === 'reach' || b.st === 'release' ? Math.max(wL, 0.4) : 1) + 0.06;
  // held by its sides: each hand flat against the outside of the bowl, the wrist at the near side, the fingers along
  // the glaze towards the far side, the palm towards the bowl; nothing reaches over the rim or into it
  const B = b.B, side = B.r * 1.0 + 0.034, hq = b.h.getWorldQuaternion(new T.Quaternion());
  const left = right.clone().negate(), lx = new T.Vector3(1, 0, 0).applyQuaternion(hq).dot(left) > 0 ? 1 : -1;   // which of the bowl's own sides is on your left
  const w: any = { L: wL, R: wR };
  const arms = (m: any) => {
    const res: any = { legs: [-0.3, 1.9, -1.35, 1.45], hand: {} }, rest = humanGesture(null, now);   // one knee down, the other foot forward
    m.root.updateMatrixWorld(true); const rq = m.root.getWorldQuaternion(new T.Quaternion()).invert();
    for (const sd of ['L', 'R'] as ('L' | 'R')[]) {
      if (w[sd] < 0.002) { b.a[sd] = null; continue; }
      const sx = (sd === 'L' ? lx : -lx), J = m.joints[sd];
      const wrist = b.h.localToWorld(new T.Vector3(sx * side, B.hgt * 0.42, -B.r * 0.62));
      const Fd = new T.Vector3(0, -0.12, 1).applyQuaternion(hq).applyQuaternion(rq).normalize();       // the fingers: away from you, along the side
      const Nd = new T.Vector3(-sx, 0.25, 0).applyQuaternion(hq).applyQuaternion(rq).normalize();       // the palm: towards the bowl
      const from = m.root.localToWorld(humanHandAt(m, sd, sd === 'L' ? rest.L : rest.R, undefined, J.w)), to = from.lerp(wrist, w[sd]);
      b.a[sd] = humanReach(m, sd, m.root.worldToLocal(to), b.a[sd] || (sd === 'L' ? rest.L : rest.R), J.w); res[sd] = b.a[sd];
      const W = humanHandAim(m, sd, b.a[sd], Fd, Nd), q = new T.Quaternion().setFromRotationMatrix(new T.Matrix4().setFromMatrix3(W)).slerp(new T.Quaternion(), 1 - Math.min(1, w[sd] * 1.2));
      res.hand[sd] = { W: new T.Matrix3().setFromMatrix4(new T.Matrix4().makeRotationFromQuaternion(q)), curl: 0.08 * w[sd] + 0.001, th: 0, k1: 0, k2: 0 };
    }
    return res;
  };
  let eye = hip.clone().add(new T.Vector3(0, 0.62, 0));
  if (S) { try { S.pitch = -0.6; eye = selfPose(S, hip, b.yaw, lean, 0, 0, 0, now, dt, arms); } catch (e) { R.me = null; } }
  R.cam.position.copy(eye);
  const look = b.h.localToWorld(new T.Vector3(0, B.hgt * 0.45, 0));
  R.cam.lookAt(look);
}

/* ---------- the family photo: picked up, looked at, put back ---------- */
const OF_PH_D = { reach: 0.85, lift: 1.15, lower: 1.15, release: 0.75 };
function ofPhotoPick() {
  const R = OfficeRoom, A = R.A; if (!A || !A.photoAt || (R.ph && R.ph.st !== 'idle') || (R.pk && R.pk.st !== 'idle') || ofLapK() > 0) return;
  R.ph = { st: 'reach', t: 0, P0: A.photoAt.position.clone(), q0: A.photoAt.quaternion.clone(), tilt: [0, 0], want: [0, 0], a: {}, tf: null };
  if (R.glow) R.glow.hide(); R.lapHover = false; ofPhotoUi(); Sound.tick();
}
function ofPhotoPut() { const ph = OfficeRoom.ph; if (!ph || ph.st !== 'hold') return; ph.st = 'lower'; ph.t = 0; ofPhotoUi(); }
/** Back on the desk at once (leaving the chair, another view). */
function ofPhotoReset() {
  const R = OfficeRoom, ph = R.ph; if (!ph) return;
  if (R.A && R.A.photoAt) { R.A.photoAt.position.copy(ph.P0); R.A.photoAt.quaternion.copy(ph.q0); }
  R.ph = null; ofPhotoUi();
}
function ofPhotoUi() {
  const R = OfficeRoom, ph = R.ph, on = !!(ph && ph.st === 'hold');
  let b = R.root && R.root.querySelector('.of-ph') as HTMLElement;
  if (!on) { if (b) b.remove(); return; }
  if (b) return;
  b = document.createElement('div'); b.className = 'of-ph';
  b.innerHTML = `<span>${DESKTOP ? 'Drag or use the arrow keys' : 'Drag'} to tilt the photo</span><button class="btn sm" data-of="ph-put">Put it back</button>`;
  b.addEventListener('pointerdown', e => e.stopPropagation());
  b.querySelector('button')!.addEventListener('click', e => { e.stopPropagation(); ofPhotoPut(); });
  R.root.appendChild(b);
}
/** Each frame in the chair: where the photo is, your hands on it, how far you lean in and turn, where you look. */
function ofPhotoStep(dt: number, t: number): { lean: number; turn: number; slide: number; lookK: number; at: any; arms: any; t?: number } {
  const R = OfficeRoom, ph = R.ph, A = R.A, T = THREE, out = { lean: 0, turn: 0, slide: 0, lookK: 0, at: null as any, arms: null as any };
  if (!ph || !A || !A.photoAt) return out;
  const E = (x: number) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }, D = OF_PH_D;
  ph.t += dt;
  let wL = 0, wR = 0, mv = 0;   // the hands on it (0 at rest, 1 holding), the photo from the desk (0) to your hands (1)
  if (ph.st === 'reach') { wL = E(ph.t / D.reach); if (ph.t >= D.reach) { ph.st = 'lift'; ph.t = 0; } }
  else if (ph.st === 'lift') { wL = 1; mv = E(ph.t / D.lift); wR = E((ph.t - 0.45) / 0.6); if (ph.t >= D.lift) { ph.st = 'hold'; ph.t = 0; ofPhotoUi(); } }
  else if (ph.st === 'hold') { wL = wR = 1; mv = 1; }
  else if (ph.st === 'lower') { wL = 1; mv = 1 - E(ph.t / D.lower); wR = 1 - E(ph.t / 0.5); if (ph.t >= D.lower) { ph.st = 'release'; ph.t = 0; Sound.tick(); } }
  else if (ph.st === 'release') { wL = 1 - E(ph.t / D.release); if (ph.t >= D.release) { R.ph = null; ofPhotoUi(); return out; } }
  // leaning in and turning to the desk while it is down there, upright again as it comes up
  const down = ph.st === 'reach' || ph.st === 'release' ? wL : 1 - mv;
  out.lean = 0.55 * down; out.turn = 0.45 * down; out.slide = 0.14 * down;   // forward on the seat, leaning in and turning to it
  // in your hands: a little in front of your eyes, tilted as you like. While you hold it your body keeps still (no
  // swaying or breathing in the arms: the time stands still for your figure), and the photo sits flush between your
  // hands as one piece with them; tilting it moves your arms and the photo together
  ph.tilt[0] += (ph.want[0] - ph.tilt[0]) * Math.min(1, dt * 5); ph.tilt[1] += (ph.want[1] - ph.tilt[1]) * Math.min(1, dt * 5);
  const e0 = R.me && R.me.eye0 ? R.me.eye0 : new T.Vector3(0, 1.2, 1.02), hold = new T.Vector3(e0.x, e0.y - 0.19, e0.z - 0.39);
  const qh = new T.Quaternion().setFromEuler(new T.Euler(0.12 + ph.tilt[1], ph.tilt[0], 0, 'YXZ'));
  if (ph.tf == null) ph.tf = t;
  (out as any).t = ph.tf;
  const pos = ph.P0.clone().lerp(hold, mv); pos.y += 0.09 * Math.sin(Math.PI * mv);   // up off the desk in an arc
  A.photoAt.position.copy(pos); A.photoAt.quaternion.copy(ph.q0).slerp(qh, mv); A.photoAt.updateMatrixWorld(true);
  out.at = A.photoAt.localToWorld(new T.Vector3(0, 0.09, 0));
  out.lookK = ph.st === 'reach' || ph.st === 'release' ? 0.9 * wL : 0.92 + 0.08 * mv;   // you watch it all the way
  // the hands: the left reaches for it, the right joins it once it is up (each from where it rested)
  const grip: any = { L: A.photoAt.localToWorld(new T.Vector3(-0.142, 0.075, -0.03)), R: A.photoAt.localToWorld(new T.Vector3(0.142, 0.075, -0.03)) }, w: any = { L: wL, R: wR };   // holding it by its sides, from a little behind
  out.arms = (m: any) => {
    const res: any = {}, rest = humanGesture({ kind: 'sit', v: 0 }, t);
    for (const sd of ['L', 'R'] as ('L' | 'R')[]) {
      if (w[sd] < 0.002) { ph.a[sd] = null; continue; }
      const from = m.root.localToWorld(humanHandAt(m, sd, sd === 'L' ? rest.L : rest.R)), to = from.lerp(grip[sd], w[sd]);
      ph.a[sd] = humanReach(m, sd, m.root.worldToLocal(to), ph.a[sd] || (sd === 'L' ? rest.L : rest.R)); res[sd] = ph.a[sd];
    }
    return res;
  };
  return out;
}

/* ---------- your phone (shared with Operations: phone3d.ts) ---------- */
function ofPhonePick() { const R = OfficeRoom; if ((R.ph && R.ph.st !== 'idle') || ofLapK() > 0) return; phonePick(R); }
function ofPhonePut() { phonePut(OfficeRoom); }
function ofPhoneReset() { phoneReset(OfficeRoom); }
function ofPhoneStep(dt: number, t: number) { return phoneStep(OfficeRoom, dt, t); }
function ofPhoneOpen() { phoneOpen(OfficeRoom); }
function ofPhoneClose() { phoneClose(OfficeRoom); }

/* ---------- the interview ---------- */
const OF_Q: [string, string][] = [['what', 'Tell me, in your own words, what happened.'], ['claim', 'The report says: {did} Is that true?'], ['why', 'Why did it happen?'], ['again', 'How do I know it won\'t happen again?'], ['keep', 'Give me one good reason to keep you.']];
// what they did, as they'd say it themselves; the excuse they reach for; what they'd claim instead
const OF_ADMIT: { [t: string]: [string, string, string] } = {
  'Rude to a passenger': ['was short and rude with a passenger during the meal service', 'The cabin was a crew member short and that passenger had been at me the whole flight.', 'was perfectly polite to everyone on that flight'],
  'Late for duty': ['came in late for the briefing', 'The staff bus from the hotel was late, and nobody told us.', 'was there on time, the briefing started early'],
  'Skipped a safety check': ['signed off the safety check without doing all of it', 'The turnaround was impossibly tight and the captain wanted to board early.', 'checked every piece of equipment, like I always do'],
  'Argument with a colleague': ['lost my temper with a colleague in the galley', 'My colleague criticised me in front of passengers first.', 'had a normal conversation with a colleague, nothing more'],
  'Late for the turnaround': ['got to the aircraft late', 'The vehicle wouldn\'t start and I had to fetch another one.', 'was at the stand when the aircraft came in'],
  'Drove too fast on the apron': ['drove too fast on the apron', 'I was late for the next flight because we\'re short of drivers.', 'was well within the speed limit'],
  'Hit an aircraft with a vehicle': ['hit the aircraft with the vehicle', 'The guide gave me the signal to keep reversing.', 'never touched that aircraft'],
  'Threw passengers\' bags': ['threw passengers\' bags', 'The bags were heavy and the loading was running late.', 'handled every bag with care'],
  'Left a vehicle unattended': ['left the vehicle running and walked off', 'I was gone for a minute, and I thought the brake was on.', 'never left the vehicle'],
  'Missed a deadline': ['started the inspection far too late', 'The night shift handed the job over late, and there was no one to help.', 'finished the work on time; the delay was somebody else\'s'],
  'Tools left on the apron': ['left my toolbox on the apron', 'I was called away to another aircraft in the middle of the job.', 'signed every tool back in'],
  'Paperwork not signed': ['returned the aircraft to service without the paperwork', 'It was the end of a very long shift, and the work itself was done right.', 'signed all the paperwork'],
  'Late for shift': ['turned up late for my shift', 'I\'d worked a double shift the day before and fell asleep.', 'was on time; the clock-in system is wrong'],
  'Late for the flight': ['reported late for the flight', 'The crew car was stuck in traffic.', 'was on time; the captain was early'],
  'Checklist shortcuts': ['skipped part of the checklist', 'The tower was pushing for a quick departure.', 'read every line of the checklist'],
  'Unprofessional radio calls': ['was unprofessional on the radio', 'The frequency was busy and the controller kept cutting me off.', 'was completely professional on the radio'],
};
const OF_A: { [q: string]: { [att: string]: string[] } } = {
  what: {
    honest: ['I\'ll be straight with you. I {admit}. It happened the way the report says, and I\'m not proud of it.', 'It\'s true. I {admit}. I knew better, and I let the team down.', 'I messed up. There\'s no other way to put it: I {admit}, and it\'s on me.'],
    defensive: ['It wasn\'t how it sounds. {excuse} I did what I could.', 'There\'s more to it than what\'s in that report. {excuse}', 'Look, I\'m not saying it was perfect. But {excuseL}'],
    dismissive: ['Honestly? It was nothing. Someone\'s making a big deal out of a bad day.', 'Is this really why I\'m here? Everybody does it now and then.', 'I don\'t see the problem. The job got done, didn\'t it?'],
    lying: ['That\'s not what happened. I {deny}.', 'Whoever wrote that report got it wrong. I {deny}.', 'I have no idea where that came from. I {deny}, ask anyone.'],
  },
  claim: {
    honest: ['Yes. That\'s exactly what happened.', 'It\'s true. I\'m sorry.', 'Yes, it is. I won\'t pretend otherwise.'],
    defensive: ['Partly. But {excuseL}', 'Technically, yes. But {excuseL}', 'The facts are right, but not the picture. {excuse}'],
    dismissive: ['If you say so.', 'Sure. And?', 'Maybe. I don\'t really remember, it wasn\'t a big deal.'],
    lying: ['No. Absolutely not.', 'No, that never happened. Ask anyone who was on shift.', 'That\'s a lie, and I\'d like to know who\'s spreading it.'],
  },
  why: {
    honest: ['I was tired and I cut a corner. That\'s the truth.', 'I let the stress get the better of me. It\'s no excuse.', 'I wasn\'t paying attention the way I should have been.'],
    defensive: ['{excuse} Anyone would have struggled.', 'We\'re short of people. Everyone\'s stretched, and it was bound to happen to someone.', '{excuse} I\'m not the only one to blame here.'],
    dismissive: ['Things happen. It\'s an airline, not a monastery.', 'Why does anything happen? Bad luck.', 'Ask the people who make the rosters.'],
    lying: ['It didn\'t happen, so there\'s no "why".', 'There\'s nothing to explain. I did my job properly.', 'I really don\'t know what you want me to say. I did nothing wrong.'],
  },
  again: {
    honest: ['Because I\'ve learned from it. You have my word, and you\'ll see it in my work.', 'I\'ll prove it. Watch me over the next weeks, and if I slip, you can let me go.', 'I\'ve already talked to the team about it. It won\'t happen again.'],
    defensive: ['It won\'t, as long as the conditions are fair.', 'If we get the staff we need, it won\'t.', 'It won\'t. But I can\'t control everything around me.'],
    dismissive: ['You don\'t. Nobody can promise that.', 'I guess you\'ll have to trust me.', 'Does it matter? You\'ve already made up your mind.'],
    lying: ['It can\'t happen again, because it never happened in the first place.', 'There\'s nothing to repeat. My record speaks for itself.', 'It won\'t, because I\'ve always done this right.'],
  },
  keep: {
    honest: ['Because I care about this airline, and I\'m good at what I do when I do it right. I\'m asking for a second chance.', 'Because I own my mistakes. You won\'t find many who do.', 'Because I\'ve been here {years}, and this is the first time I\'ve let you down like this.'],
    defensive: ['Because I\'m one of the few who actually turns up and works hard. Look at the others.', 'Because you\'d struggle to replace me. You know that.', 'Because I\'m not the problem here. The system is.'],
    dismissive: ['Do what you want. There are other airlines.', 'I don\'t have to beg for my job.', 'If you don\'t want me here, just say so.'],
    lying: ['Because I\'ve never done anything wrong, and I\'m not going to start now.', 'Because my record is spotless, and this report is a mistake.', 'Because everyone will tell you I\'m the best on the team.'],
  },
};
const OF_TELL: { [att: string]: string[] } = {
  honest: ['Looks you in the eye.', 'Lowers their head for a moment.', 'Speaks quietly, without hesitating.'],
  defensive: ['Spreads their hands.', 'Shifts in the chair.', 'Talks a little faster.'],
  dismissive: ['Leans back with their arms crossed.', 'Shrugs.', 'Glances at the window, bored.'],
  lying: ['Glances away as they answer.', 'Answers a little too quickly.', 'Touches their face, then looks back at you.'],
};
/** What you tell them when you decide (spoken in your own voice). */
const OF_MY_DEC: { [d: string]: string[] } = {
  improve: ['I hear you. You can stay, with no warning, and I\'ll make sure your working conditions improve.', 'You\'re right, and that\'s on me as much as on you. I\'ll look into it and fix it.'],
  keep: ['You can stay. No warning this time.', 'All right. We\'ll leave it there. No warning.'],
  discipline: ['I\'m giving you a formal warning. It goes on your record.', 'This is a written warning. Don\'t let it happen again.'],
  dismiss: ['I\'m sorry, but I\'m letting you go. Today is your last day.', 'I can\'t keep you on. You\'re dismissed.'],
  court: ['This is a matter for the police. I\'m reporting it.', 'I have no choice. I\'m handing this to the police.'],
};
const OF_REACT: { [d: string]: { [att: string]: string[] } } = {
  improve: { honest: ['Thank you. That\'s all any of us are asking for.', 'Thank you. I\'ll still be more careful, I promise.'], defensive: ['Finally. Thank you. The others will be glad to hear it.', 'Thank you. That\'s fair, and it\'s what we need.'], dismissive: ['We\'ll see if anything actually changes.', 'Right. I\'ll believe it when I see it.'], lying: ['Good. Glad you see it my way.', 'Right. Thank you.'] },
  court: { honest: ['The police? …I understand. I\'ll tell them exactly what I told you.', 'I deserve that. I\'ll answer for it.'], defensive: ['The police? Over this? You can\'t be serious.', 'You\'re going to ruin my career over one mistake.'], dismissive: ['Fine. Let a judge decide. I\'ll see you in court.', 'Do what you want.'], lying: ['You\'ll regret this. They\'ll find I did nothing wrong.', 'Go ahead. You have no proof.'] },
  keep: { honest: ['Thank you. I won\'t let you down.', 'Thank you for hearing me out. It means a lot.'], defensive: ['Thank you. I\'m glad you see it my way.', 'Good. Thank you.'], dismissive: ['Right. Can I go now?', 'Fine.'], lying: ['Thank you. I knew you\'d see it was a mistake.', 'Good. I told you, there was nothing to it.'] },
  discipline: { honest: ['I understand. I deserved that.', 'That\'s fair. Thank you for the chance.'], defensive: ['I think that\'s unfair, but I\'ll accept it.', 'If you say so. I still think it\'s not all on me.'], dismissive: ['Whatever.', 'Fine. Write it down, then.'], lying: ['This is wrong. But fine.', 'You\'re making a mistake, but I\'ll sign it.'] },
  dismiss: { honest: ['I understand. I\'m sorry it ended like this.', 'I see. Thank you for the years.'], defensive: ['You\'re making a mistake. This place won\'t run without people like me.', 'That\'s it? After everything?'], dismissive: ['Good. I was leaving anyway.', 'Your loss.'], lying: ['You\'ll regret this.', 'I did nothing wrong, and you know it.'] },
};
function ofPick<T>(a: T[]): T { return a[Math.floor(Math.random() * a.length)]; }
function ofFill(s: string): string {
  const R = OfficeRoom, inc = R.inc, p = R.p, ad = OF_ADMIT[inc.title] || ['did what the report says', 'It was a difficult day.', 'did nothing wrong'];
  const det = typeof conductDetail === 'function' ? conductDetail(inc, p) : null, yrs = Math.max(1, Math.round(serviceYears(p)));
  const did = det && det.did ? det.did.charAt(0).toLowerCase() + det.did.slice(1) : inc.text.charAt(0).toLowerCase() + inc.text.slice(1);
  return s.replace(/\{admit\}/g, ad[0]).replace(/\{excuseL\}/g, ad[1].charAt(0).toLowerCase() + ad[1].slice(1)).replace(/\{excuse\}/g, ad[1]).replace(/\{deny\}/g, ad[2])
    .replace(/\{years\}/g, `${yrs} ${yrs === 1 ? 'year' : 'years'}`).replace(/\{did\}/g, did.replace(/\.$/, '.'));
}
function ofSay(who: string, text: string, title?: string, tell?: string) {
  const R = OfficeRoom, b = R.root.querySelector('.ct-box') as HTMLElement; b.hidden = false; b.classList.remove('min'); ofTopState();
  (b.querySelector('.ct-who b') as HTMLElement).textContent = who === 'you' ? 'You' : who || ''; (b.querySelector('.ct-who small') as HTMLElement).textContent = title || '';
  (b.querySelector('.ct-text') as HTMLElement).textContent = text; (b.querySelector('.of-tell') as HTMLElement).textContent = tell || '';
  (b.querySelector('.ct-say') as HTMLElement).innerHTML = ''; (b.querySelector('.ct-opts') as HTMLElement).innerHTML = ''; (b.querySelector('.ct-ctl') as HTMLElement).innerHTML = '';
  const you = b.querySelector('.of-you') as HTMLElement; if (you) you.innerHTML = '';
  ofFit();
}
/** The dialogue sits above the row of places, never over it. */
function ofFit() {
  const R = OfficeRoom; if (!R.root) return;
  const b = R.root.querySelector('.ct-box') as HTMLElement, sp = R.root.querySelector('.of-spots') as HTMLElement; if (!b) return;
  b.style.bottom = sp && !sp.hidden && sp.offsetHeight ? (sp.offsetHeight + 30) + 'px' : '';
}
/** Close the dialogue (the X): during a talk only its words, the questions come back with the next answer. */
function ofBoxClose() {
  const R = OfficeRoom, b = R.root && R.root.querySelector('.ct-box') as HTMLElement; if (!b) return;
  try { Voice.stop(); } catch (e) { /* no voice */ }
  Sound.tick(); b.hidden = true; b.classList.remove('min'); ofTopState();
}
/** Minimise the dialogue to its name line (the voice carries on); the same button, or the line, opens it again. */
function ofBoxMin() {
  const R = OfficeRoom, b = R.root && R.root.querySelector('.ct-box') as HTMLElement; if (!b) return;
  Sound.tick(); b.classList.toggle('min');
  const m = b.querySelector('.of-min') as HTMLElement; if (m) { const on = b.classList.contains('min'); m.setAttribute('aria-label', on ? 'Open the conversation' : 'Minimise'); m.title = on ? 'Open the conversation' : 'Minimise'; }
  ofFit(); ofTopState();
}
/** The visitor has left: their name goes from the top left, and the talk can't be brought back. */
function ofGone() {
  const R = OfficeRoom; if (!R.root) return;
  const top = R.root.querySelector('.ct-top b') as HTMLElement; if (top) top.textContent = 'Your office';
  const b = R.root.querySelector('.ct-box') as HTMLElement;
  if (b) { b.hidden = true; b.classList.remove('min'); for (const sel of ['.ct-text', '.of-tell', '.ct-say', '.ct-opts', '.ct-ctl', '.of-you']) { const e = b.querySelector(sel) as HTMLElement; if (e) e.innerHTML = ''; } }
  ofTopState();
}
/** The office name at the top left brings a closed or minimised conversation back, where it was. */
function ofBoxOpen() {
  const R = OfficeRoom, b = R.root && R.root.querySelector('.ct-box') as HTMLElement; if (!b) return;
  const t = b.querySelector('.ct-text') as HTMLElement;
  if (!t || !t.textContent || (!b.hidden && !b.classList.contains('min'))) return;
  Sound.tick(); b.hidden = false; b.classList.remove('min'); b.classList.remove('back-in'); void b.offsetWidth; b.classList.add('back-in');
  ofFit(); ofTopState();
}
/** The top left shows it can bring the conversation back while it is closed or minimised. */
function ofTopState() {
  const R = OfficeRoom; if (!R.root) return;
  const b = R.root.querySelector('.ct-box') as HTMLElement, top = R.root.querySelector('.ct-top') as HTMLElement; if (!b || !top) return;
  const t = b.querySelector('.ct-text') as HTMLElement;
  top.classList.toggle('can-open', !!(t && t.textContent && (b.hidden || b.classList.contains('min'))));
}
/** They put it down to how they have to work: short of people, too many hours, the wrong equipment. Noted, so you
 *  can answer it: agree and improve their working conditions, or not. Whether it's true is decided by the airline
 *  itself (are there enough people in their job for the fleet?) and how worn out they are. */
const OF_COND: [RegExp, 'staff' | 'hours' | 'equipment'][] = [
  [/short of|not enough (people|staff)|stretched|staff we need|no one to help|nobody to help|the rosters|undermanned|understaffed|the system/i, 'staff'],
  [/double shift|long shift|very long shift|worked .* day before|fell asleep|exhausted/i, 'hours'],
  [/vehicle wouldn'?t start|equipment|tools? (were|was) (broken|missing)|no tug|broken/i, 'equipment'],
];
function ofCondCheck(text: string) {
  const R = OfficeRoom; if (R.cond || !R.vis || R.vis.say === 'lying') return;
  const m = OF_COND.filter(c => c[0].test(text))[0]; if (!m) return;
  R.cond = { kind: m[1], truth: ofCondTrue(R.p, m[1], R.inc) };
}
function ofCondTrue(p: any, kind: string, inc: any): boolean {
  const role = personRole(p), cid = p.companyId || State.companyId, n = Math.max(1, fleetOf(cid).length);
  const need: any = { fa: 3, mech: 0.6, ground: 0.8 }, staff = need[role] ? staffOf(cid, role as any).length : 0;
  const short = need[role] ? staff < need[role] * n : n > Math.max(1, (State.pilots || []).length) * 0.8;
  const tired = (typeof p.mood === 'number' ? p.mood : 60) < 45;
  if (kind === 'equipment') return short || (_hashStr(String(inc && inc.id || p.id)) % 2 === 0);
  return short || tired;
}
/** Your company's standing (its reputation) after how you handled it. */
function ofRep(d: number, why?: string) {
  const co: any = company(); if (!co || !d) return;
  co.reputation = Math.max(0, Math.min(100, Math.round(((co.reputation || 50) + d) * 10) / 10));
  if (why) setTimeout(() => toast(why, d > 0 ? 'ok' : 'warn'), 3200);
}
function ofInterviewStart() {
  const R = OfficeRoom, p = R.p;
  if (!R.vis) R.vis = { attitude: ofAttitude(p), state: 'sitting', pivot: { visible: false }, path: [] };
  const hello = R.vis.attitude === 'dismissive' ? 'You wanted to see me.' : R.vis.attitude === 'honest' ? 'Thank you for seeing me. I think I know what this is about.' : 'You wanted to see me?';
  ofSay(p.name, hello, `${ROLE_NAMES[personRole(p)]}, ${p.base}`); R.sayText = hello; R.sayAt = Date.now();
  // they say it out loud too (only what they say: your questions are never read out)
  const att = R.vis.attitude, voice = `pax|${p.sex === 'f' ? 'f' : 'm'}|${att === 'honest' ? 'sorry' : att === 'dismissive' ? 'angry' : 'neutral'}|${p.name}`;
  (R.root.querySelector('.ct-say') as HTMLElement).innerHTML = voiceButton(hello, voice, 'Play');
  R.talkUntil = (performance.now() - R.t0) / 1000 + Math.max(2, hello.split(/\s+/).length * 0.36);
  if ((State.settings as any).officeAutoVoice) { try { Voice.stop(); Voice.speak(hello, undefined, voice); } catch (e) { /* no voice */ } }
  ofQuestions();
}
function ofQuestions() {
  const R = OfficeRoom, b = R.root.querySelector('.ct-box') as HTMLElement;
  const left = OF_Q.filter(q => R.asked.indexOf(q[0]) < 0);
  (b.querySelector('.ct-opts') as HTMLElement).innerHTML = left.map(q => `<button class="ct-opt" data-of="ask" data-k="${q[0]}">${esc(ofFill(q[1]))}</button>`).join('');
  const p = R.p, strong = (p.warnings || 0) >= 1;
  (b.querySelector('.ct-ctl') as HTMLElement).innerHTML = R.answers >= 1 ? `<span class="of-dec">Your decision:</span>${R.cond ? `<button class="btn primary" data-of="dec" data-k="improve">${R.cond.kind === 'equipment' ? 'I agree: I\'ll get you the right equipment' : R.cond.kind === 'hours' ? 'I agree: I\'ll sort out the hours' : 'I agree: I\'ll get you more people'}</button>` : ''}<button class="btn ghost" data-of="dec" data-k="keep">Keep them, no warning</button><button class="btn ghost" data-of="dec" data-k="discipline">${strong ? 'Final warning' : 'Discipline'}</button><button class="btn danger" data-of="dec" data-k="dismiss">Dismiss</button>${courtReportable(R.inc) ? '<button class="btn danger police-btn" data-of="dec" data-k="court"><i class="pl-l"></i><i class="pl-r"></i><span>Report to the police</span></button>' : ''}` : '';
}
function ofAsk(k: string) {
  const R = OfficeRoom, V = R.vis, p = R.p; if (!V) return;
  R.asked.push(k); R.answers++;
  // they mostly stay in character, but not always
  const base = V.attitude, stay = base === 'honest' ? 0.85 : 0.72;
  const att = Math.random() < stay ? base : ofPick(['honest', 'defensive', 'dismissive', 'lying'].filter(a => a !== base));
  V.say = att;
  const lines = OF_A[k][att], text = ofFill(ofPick(lines)), tell = ofPick(OF_TELL[att]);
  const q = OF_Q.filter(x => x[0] === k)[0], mine = q ? ofFill(q[1]) : '', meWho = myWho('neutral');
  ofSay(p.name, text, `${ROLE_NAMES[personRole(p)]}, ${p.base}`, tell); R.sayText = text; R.sayAt = Date.now();
  // what you asked, in your own voice (they never read your lines)
  const you = R.root.querySelector('.of-you') as HTMLElement;
  if (you && mine) you.innerHTML = `<span><b>You</b>${esc(mine)}</span>${voiceButton(mine, meWho, 'Play your question')}`;
  R.talkUntil = (performance.now() - R.t0) / 1000 + Math.max(2.5, text.split(/\s+/).length * 0.36);
  R.flush = att === 'dismissive' || (att === 'defensive' && Math.random() < 0.4);
  const voice = `pax|${p.sex === 'f' ? 'f' : 'm'}|${att === 'honest' ? 'sorry' : att === 'dismissive' ? 'angry' : 'neutral'}|${p.name}`;
  (R.root.querySelector('.ct-say') as HTMLElement).innerHTML = voiceButton(text, voice, 'Play');
  ofCondCheck(text);
  if ((State.settings as any).officeAutoVoice && State.settings.mechanicVoice && !State.settings.muteAll) {
    // you ask, then they answer: their mouth waits for their voice
    R.talkUntil = 0; R.sayText = '';
    try { Voice.stop(); const go = () => { if (OfficeRoom.on && OfficeRoom.p === p) Voice.speak(text, undefined, voice); }; if (mine) Voice.speak(mine, () => setTimeout(go, 250), meWho); else go(); } catch (e) { /* no voice */ }
  }
  (R.inc as any).interview = { attitude: base, answers: R.answers, at: Date.now() };
  ofQuestions();
}
function ofDecide(k: string) {
  const R = OfficeRoom, inc = R.inc, p = R.p, V = R.vis; if (R.decided) return; R.decided = true; Voice.stop();
  const att = (V && V.attitude) || 'defensive', text = ofPick(OF_REACT[k][att]);
  ofSay(p.name, text, k === 'improve' ? 'Working conditions to be improved' : k === 'keep' ? 'Kept on, no warning' : k === 'discipline' ? ((p.warnings || 0) >= 1 ? 'Final warning' : 'Disciplined') : k === 'court' ? 'Reported to the police' : 'Dismissed');
  if (V) V.say = att; R.sayText = text; R.sayAt = Date.now();
  R.talkUntil = (performance.now() - R.t0) / 1000 + 3; R.flush = k !== 'keep' && att !== 'honest';
  const voice = `pax|${p.sex === 'f' ? 'f' : 'm'}|${k === 'dismiss' && att !== 'honest' ? 'angry' : att === 'honest' ? 'sorry' : 'neutral'}|${p.name}`;
  (R.root.querySelector('.ct-say') as HTMLElement).innerHTML = voiceButton(text, voice, 'Play');
  // what you tell them, in your own voice
  const mine = ofPick(OF_MY_DEC[k] || ['']), meWho = myWho(k === 'dismiss' || k === 'court' ? 'neutral' : ''), you = R.root.querySelector('.of-you') as HTMLElement;
  if (you && mine) you.innerHTML = `<span><b>You</b>${esc(mine)}</span>${voiceButton(mine, meWho, 'Play what you said')}`;
  // they stay in their chair until they have answered and you have told them they are dismissed
  R.endK = k; R.endVoice = voice;
  let ready = false; const done = () => { if (ready || !OfficeRoom.on || OfficeRoom.p !== p) return; ready = true; ofEndReady(); };
  if (ofAutoVoice()) {
    R.talkUntil = 0; R.sayText = '';
    try { Voice.speak(mine, () => setTimeout(() => { if (OfficeRoom.on && OfficeRoom.p === p) Voice.speak(text, () => setTimeout(done, 500), voice); }, 250), meWho); } catch (e) { /* no voice */ }
    setTimeout(done, 20000);   // in any case
  } else setTimeout(done, ofReadMs(text));
  // the decision itself, as on the report
  const el = { getAttribute: (a: string) => a === 'data-id' ? inc.id : a === 'data-strong' ? ((p.warnings || 0) >= 1 ? '1' : '0') : null } as any;
  const keepToast = toast; void keepToast;
  try {
    if (k === 'court') { inc.interview = inc.interview || { attitude: att, answers: R.answers, at: Date.now() }; const cc = courtBringCase(inc); if (cc) setTimeout(() => toast(`${p.name} is reported to the police. You will be called to court as a witness.`, 'warn'), 2800); }
    else if (k === 'improve') {
      // you take their side: they stay, without a warning, and you promise better working conditions
      const C = R.cond || { kind: 'staff', truth: false };
      inc.status = 'excused' as any; (inc as any).improve = { kind: C.kind, at: Date.now() };
      try { staffMoodAdd(p, C.truth ? 12 : 6, 'You listened and promised better working conditions'); } catch (e) { /* ignore */ }
      const role = ROLE_NAMES[personRole(p)] ? ROLE_NAMES[personRole(p)].toLowerCase() : 'staff';
      ofRep(C.truth ? 2 : 0.5, C.truth ? `The crew hear you listened to ${p.name}. ${C.kind === 'staff' ? `Hire more ${role}s in Staff to keep your word.` : C.kind === 'hours' ? 'Give them fewer back-to-back shifts to keep your word.' : 'Fix the equipment in Maintenance to keep your word.'}` : '');
      Store.save();
    }
    else if (k === 'keep') { inc.status = 'excused' as any; try { staffMoodAdd(p, att === 'honest' ? 8 : 4); } catch (e) { /* ignore */ } if (att === 'lying') ofRep(-1.5, `Word gets around that ${p.name} got away with it.`); Store.save(); }
    else if (k === 'discipline') { const ca = closeAll; (window as any).closeAll = () => { /* stay in the office */ }; try { ACTIONS.discipline(el, null); } finally { (window as any).closeAll = ca; } if (att === 'honest') { p.learned = (p.learned || 0) + 1; Store.save(); } }
    else { const ca = closeAll; (window as any).closeAll = () => { /* stay in the office */ }; try { ACTIONS['dismiss-inc'](el, null); } finally { (window as any).closeAll = ca; } }
  } catch (e) { /* decided anyway */ }
  // how it looks to everyone else: punishing someone who was telling the truth about how they have to work hurts your
  // standing; standing firm with someone who lied helps it
  if (k === 'discipline' || k === 'dismiss' || k === 'court') {
    const C = R.cond;
    if (C && C.truth) ofRep(k === 'discipline' ? -2.5 : -4, `The crew say ${p.name} was telling the truth about ${C.kind === 'staff' ? 'being short of people' : C.kind === 'hours' ? 'the hours' : 'the equipment'}. Your standing drops.`);
    else if (att === 'lying') ofRep(1, '');
    else if (att === 'honest' && k !== 'discipline') ofRep(-1, `${p.name} owned up, and the crew think that was harsh.`);
  }
  Store.save();
  try { closeAll(); } catch (e) { /* none */ }
  (R.root.querySelector('.ct-ctl') as HTMLElement).innerHTML = '';
}
/* ---------- the end of the conversation: you dismiss them; they may say something; then they leave ---------- */
const OF_END = ['Okay, that\'s it. You are dismissed.', 'That\'s all for now. You are dismissed.', 'Okay, that\'s it. You can go.', 'We\'re done here. You are dismissed.'];
// what they say on their way out (sometimes nothing), by what you decided and how they took it
const OF_BYE: { [d: string]: { [att: string]: string[] } } = {
  keep: { honest: ['Thank you. I won\'t let you down.', 'Thank you. Really.', ''], defensive: ['Thanks.', ''], lying: ['Thank you.', ''], dismissive: ['', 'Right.'] },
  improve: { honest: ['Thank you for listening.', 'Thank you. It means a lot.', ''], defensive: ['Thanks. I\'ll hold you to that.', ''], lying: ['Thank you.', ''], dismissive: ['We\'ll see.', ''] },
  discipline: { honest: ['I understand. It won\'t happen again.', ''], defensive: ['Fine.', 'If you say so.', ''], lying: ['Fine.', ''], dismissive: ['Whatever.', ''] },
  dismiss: { honest: ['I understand. Thank you for the chance.', ''], defensive: ['This isn\'t fair, and you know it.', 'Fine.', ''], lying: ['You\'ll regret this.', 'Fine.', ''], dismissive: ['Good luck finding someone else.', ''] },
  court: { honest: ['I understand.', ''], defensive: ['I\'ll see you in court, then.', ''], lying: ['You can\'t prove anything.', ''], dismissive: ['', 'Whatever.'] },
};
function ofAutoVoice(): boolean { return !!((State.settings as any).officeAutoVoice && State.settings.mechanicVoice && !State.settings.muteAll); }
function ofReadMs(text: string): number { return Math.max(2200, Math.min(9000, 900 + String(text || '').length * 55)); }
/** Their answer is heard: now you can tell them they are dismissed. */
function ofEndReady() {
  const R = OfficeRoom, c = R.root && R.root.querySelector('.ct-ctl') as HTMLElement; if (!c || R.ended) return;
  c.innerHTML = `<button class="btn primary" data-of="end">That's it. You are dismissed.</button>`;
  ofBoxOpen();
}
/** You dismiss them: in your voice; then whatever they have to say; then they get up and go. */
function ofEnd() {
  const R = OfficeRoom, p = R.p, V = R.vis; if (R.ended || !p) return; R.ended = true; Voice.stop();
  const c = R.root.querySelector('.ct-ctl') as HTMLElement; if (c) c.innerHTML = '';
  const mine = ofPick(OF_END), meWho = myWho('neutral'), you = R.root.querySelector('.of-you') as HTMLElement;
  if (you) you.innerHTML = `<span><b>You</b>${esc(mine)}</span>${voiceButton(mine, meWho, 'Play what you said')}`;
  const att = (V && V.attitude) || 'defensive', bye = ofPick((OF_BYE[R.endK] || OF_BYE.keep)[att] || ['']);
  let gone = false; const leave = () => { if (gone || !OfficeRoom.on || OfficeRoom.p !== p) return; gone = true; ofExit(); };
  let byeSaid = false;
  const sayBye = () => {
    if (byeSaid || !OfficeRoom.on || OfficeRoom.p !== p) return; byeSaid = true;
    if (!bye) { setTimeout(leave, 500); return; }
    ofSay(p.name, bye, 'Before they go'); if (V) V.say = att; R.sayText = bye; R.sayAt = Date.now();
    R.talkUntil = (performance.now() - R.t0) / 1000 + ofReadMs(bye) / 1000;
    const sb = R.root.querySelector('.ct-say') as HTMLElement; if (sb) sb.innerHTML = voiceButton(bye, R.endVoice, 'Play');
    if (ofAutoVoice()) { R.talkUntil = 0; R.sayText = ''; try { Voice.speak(bye, () => setTimeout(leave, 700), R.endVoice); } catch (e) { /* no voice */ } setTimeout(leave, 12000); }
    else setTimeout(leave, ofReadMs(bye));
  };
  if (ofAutoVoice()) { try { Voice.speak(mine, () => setTimeout(sayBye, 300), meWho); } catch (e) { /* no voice */ } setTimeout(() => { if (!Voice.speaking) sayBye(); }, 9000); }
  else setTimeout(sayBye, 1600);
  Sound.tick();
}
function ofClick(b: HTMLElement) {
  const k = b.getAttribute('data-of');
  if (k === 'leave') ofLeave();
  else if (k === 'ask') { Voice.stop(); ofAsk(b.getAttribute('data-k')); }
  else if (k === 'dec') ofDecide(b.getAttribute('data-k'));
  else if (k === 'end') ofEnd();
  else if (k === 'spot') { const s = b.getAttribute('data-k'); if (s === 'sit') ofSit(); else if (s === 'hangars') { Sound.tick(); ofExitToMain('', 'hangars'); } else ofSpot(s); }
  else if (k === 'invite') ofInviteNow(b.getAttribute('data-id'));
  else if (k === 'comein') ofComeIn();
  else if (k === 'back') { Sound.tick(); ofVisitUi(); }
  else if (k === 'boxclose') ofBoxClose();
  else if (k === 'boxmin') ofBoxMin();
  else if (k === 'boxopen') ofBoxOpen();
  else if (k === 'plclose') ofPlannerClose();
  else if (k === 'tocourt') {
    // straight to the police, without talking to them first (the court will ask about that)
    const inc = ofOpenReports().filter((x: any) => x.id === b.getAttribute('data-id'))[0]; if (!inc || !courtReportable(inc)) return;
    const p = staffById(inc.staffId), cc = courtBringCase(inc); Sound.tick();
    if (cc) { toast(`${p.name} is reported to the police. You will be called to court as a witness.`, 'warn'); ofReportsUi(); }
  }
}

ACTIONS['office-open'] = () => { closeAll(); OfficeRoom.open(); };
ACTIONS['office-invite'] = el => { const inc = ((State as any).incidents || []).filter((x: any) => x.id === el.getAttribute('data-id'))[0]; if (!inc) return; closeAll(); OfficeRoom.open(inc); };

/* ---------- the conversation window (conduct reports, talks, court): drag it where you like ---------- */
/** Drag the window by its grip or its heading; it stays inside the view and is kept where you left it
 *  (each room its own place). A double-click or double-tap on the grip puts it back. */
function roomBoxDrag(root: HTMLElement, key: string) {
  const box = root.querySelector('.ct-box') as HTMLElement; if (!box) return;
  const S: any = State.settings, z = () => (window as any).__uiZoom || 1;
  const place = (fx: number, fy: number) => {
    const rr = root.getBoundingClientRect(), br = box.getBoundingClientRect(), Z = z();
    const W = rr.width / Z, H = rr.height / Z, w = br.width / Z, h = br.height / Z;
    const x = clamp(fx * W, 4, Math.max(4, W - w - 4)), y = clamp(fy * H, 4, Math.max(4, H - h - 4));
    if (!box.style.width) box.style.width = w + 'px';   // keeps its width once it is free of the edges
    box.style.left = x + 'px'; box.style.top = y + 'px'; box.style.right = 'auto'; box.style.bottom = 'auto'; box.style.transform = 'none'; box.classList.add('moved');
  };
  const reset = () => { box.style.left = box.style.top = box.style.right = box.style.bottom = box.style.transform = box.style.width = ''; box.classList.remove('moved'); S.boxPos = S.boxPos || {}; delete S.boxPos[key]; Store.save(); };
  const saved = S.boxPos && S.boxPos[key];
  if (saved) { const apply = () => { if (!box.hidden) place(saved[0], saved[1]); }; new MutationObserver(apply).observe(box, { attributes: true, attributeFilter: ['hidden'] }); }
  let d: any = null;
  const start = (e: PointerEvent) => {
    const t = e.target as HTMLElement;
    if (!t.closest('.box-grip') && !(t.closest('.ct-who') && !t.closest('button'))) return;
    const br = box.getBoundingClientRect(), Z = z();
    d = { id: e.pointerId, x: e.clientX, y: e.clientY, l: (br.left - root.getBoundingClientRect().left) / Z, t: (br.top - root.getBoundingClientRect().top) / Z, moved: false };
    box.setPointerCapture(e.pointerId); e.preventDefault(); e.stopPropagation();
  };
  box.addEventListener('pointerdown', start);
  box.addEventListener('pointermove', e => {
    if (!d || e.pointerId !== d.id) return;
    const Z = z(), dx = (e.clientX - d.x) / Z, dy = (e.clientY - d.y) / Z; if (!d.moved && Math.hypot(dx, dy) < 4) return;
    d.moved = true; box.classList.add('dragging');
    const rr = root.getBoundingClientRect(); place((d.l + dx) / (rr.width / Z), (d.t + dy) / (rr.height / Z));
  });
  const end = (e: PointerEvent) => {
    if (!d || e.pointerId !== d.id) return; box.classList.remove('dragging');
    if (d.moved) { const rr = root.getBoundingClientRect(), br = box.getBoundingClientRect(); S.boxPos = S.boxPos || {}; S.boxPos[key] = [(br.left - rr.left) / rr.width, (br.top - rr.top) / rr.height]; Store.save(); }
    if (d.moved) { const eat = (ev: Event) => { ev.stopPropagation(); ev.preventDefault(); }; box.addEventListener('click', eat, { capture: true, once: true }); setTimeout(() => box.removeEventListener('click', eat, true), 300); }   // a drag isn't a click
    d = null;
  };
  box.addEventListener('pointerup', end); box.addEventListener('pointercancel', end);
  box.addEventListener('dblclick', e => { if ((e.target as HTMLElement).closest('.box-grip')) reset(); });
  let lastTap = 0; box.addEventListener('pointerup', e => { if (!(e.target as HTMLElement).closest('.box-grip')) return; const n = Date.now(); if (n - lastTap < 320) reset(); lastTap = n; });
}
