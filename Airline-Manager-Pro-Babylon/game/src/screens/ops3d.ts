// The Operations office: where the flying is planned. You sit in a high-backed chair at a long desk with an
// ultra-wide curved monitor, a keyboard and a mouse; the monitor shows your schedule as it is now (the same
// timeline as the Schedule screen, kept up to date). Click the monitor (or a button below) and Operations, the
// Schedule, Dispatch or the Flight planner open over the room, working exactly as in the app: it is the same data,
// so every change shows at once on the Schedule screen, in your office and on the monitor. Back or Esc returns to
// the desk; with nothing open, Back or Esc leaves the room (through its own loading screen).
// Around you: archive folders stacked on the desk and a tall archive rack full of binders and boxes.

const OpsRoom: any = { on: false };

const OPS_EMBLEM = `<svg class="ctl-scales ops-emb" viewBox="0 0 200 200" aria-hidden="true"><defs><linearGradient id="opG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#BFF2FF"/><stop offset=".55" stop-color="#3FB8E8"/><stop offset="1" stop-color="#1D5E9A"/></linearGradient></defs>
  <circle cx="100" cy="100" r="94" fill="#0B1A2C" stroke="url(#opG)" stroke-width="4"/>
  <g fill="none" stroke="url(#opG)" stroke-width="4" stroke-linejoin="round"><path d="M38 66 Q100 54 162 66 L162 124 Q100 112 38 124 Z"/></g>
  <g fill="url(#opG)"><rect class="ops-b1" x="52" y="76" width="34" height="8" rx="3"/><rect class="ops-b2" x="92" y="76" width="22" height="8" rx="3"/><rect class="ops-b3" x="70" y="91" width="44" height="8" rx="3"/><rect class="ops-b1" x="120" y="91" width="26" height="8" rx="3"/><rect class="ops-b2" x="56" y="106" width="28" height="8" rx="3"/><rect class="ops-b3" x="98" y="106" width="40" height="8" rx="3"/>
  <rect x="96" y="124" width="8" height="18" rx="2"/><rect x="74" y="140" width="52" height="6" rx="3"/></g>
  <path class="ops-now" d="M110 70 L110 120" stroke="#F2D18A" stroke-width="2.5"/>
  <text x="100" y="168" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-weight="700" font-size="13" fill="url(#opG)" letter-spacing="4">OPERATIONS</text></svg>`;
// the scene behind: an airport's control tower and apron at dusk
const OPS_SCENE = `<svg class="ctl-house ops-scene" viewBox="0 0 560 260" aria-hidden="true"><rect x="0" y="236" width="560" height="24"/>
  <path d="M250 236 L256 120 L304 120 L310 236 Z"/><path d="M236 120 L324 120 L314 92 L246 92 Z"/><rect x="252" y="80" width="56" height="12"/><rect x="276" y="56" width="4" height="24"/>
  <rect x="40" y="200" width="160" height="36"/><rect x="360" y="190" width="180" height="46"/><path d="M60 230 l40 -6 l30 0 l10 -8 l6 0 l-4 8 l18 0 l0 4 z"/></svg>`;

OpsRoom.open = function (host?: any) {
  const R = OpsRoom; if (R.on) return;
  if (!host && trJoined()) { if (TestRooms.on && TestRooms.game) trEnter('ops', null); else TestRooms.open({ game: true, room: 'ops' }); return; }   // the joined building
  R.host = host || null;
  const T = THREE; if (!T) { toast('3D is not available on this device', 'warn'); return; }
  try { if (typeof OfficeRoom !== 'undefined' && OfficeRoom.on) OfficeRoom.close(true); } catch (e) { /* none */ }
  R.on = true; R.pct = 0; R.loading = true; R.overlay = null; R.keys = {}; R.last = 0; R.loadT0 = performance.now(); R.tab = 'schedule'; R.seat = true; R.free = { x: 0.3, z: 1.3, v: 0, bob: 0 }; R.stick = [0, 0]; R.doorT = 0; R.doorK = 0;
  const q = Gfx.roomQ(), co = company();
  const root = host ? host.root : document.createElement('div'); if (!host) root.className = 'court3d office3d ops3d'; R.root = root;
  const ui = `${host ? '' : '<canvas></canvas>'}
    <div class="ct-top"><div><small>${esc(co.name)}</small><b>Operations</b></div></div>
    <button class="ct-leave" data-op="leave">${icon('close')}<span>Leave Operations</span><kbd>Esc</kbd></button>
    <div class="ct-spots of-spots op-spots" hidden></div><div class="of-aim op-aim" hidden></div><div class="walk-pad ct-pad op-pad" hidden><i></i></div><div class="of-aim op-dot" hidden>+</div>
    ${host ? '' : ctLoaderHtml('Operations', 'Switching on the screens…', OPS_EMBLEM, OPS_SCENE)}`;
  if (host) { host.mount('ops', ui); opsOpen2(root, q); return; }   // in the building: built already, straight in
  root.innerHTML = ui;
  document.body.appendChild(root);
  setTimeout(() => { if (R.on && R.root === root) opsOpen2(root, q); }, 80);
};

/* ---------- the room ---------- */
function opsBuild(scene: any, q: number) {
  const T = THREE, A: any = { hits: [] }, co = company();
  const M = (o: any) => new T.MeshPhysicalMaterial(Object.assign({ roughness: 0.6, envMapIntensity: 0.7 }, o));
  const oak = ctTex(ctWood('#8A6440', '#3E2814', 7));
  const mat = {
    floor: M({ map: ctTex(ctNoise('#2A3340', 0.12, 14), 6, 6), roughness: 0.95 }), wall: M({ color: 0x1B2735, roughness: 0.9 }), panel: M({ map: ctTex(ctNoise('#2C3A4C', 0.1, 4), 3, 2), roughness: 0.95 }),
    ceiling: M({ color: 0xE9ECEF, roughness: 0.9 }), oak: M({ map: oak, roughness: 0.32, clearcoat: 0.6 }), black: M({ color: 0x15171B, roughness: 0.4 }), metal: M({ color: 0x5D636B, metalness: 0.85, roughness: 0.35 }),
    chrome: M({ color: 0xDDE2E8, metalness: 1, roughness: 0.15 }), leather: M({ map: ctTex(ctLeather('#1E1E22')), roughness: 0.45, sheen: 0.4, sheenColor: new T.Color(0x555566) }),
    stitch: M({ color: co.color || '#2C8CFF', roughness: 0.5 }), card: M({ color: 0xB89366, roughness: 0.85 }), paper: M({ color: 0xF2EFE6, roughness: 0.9 }), steel: M({ color: 0x7D858F, metalness: 0.6, roughness: 0.45 }),
    plant: M({ color: 0x2F6B34, roughness: 0.7, side: T.DoubleSide }), pot: M({ color: 0x30343A, roughness: 0.5 }), glow: new T.MeshBasicMaterial({ color: 0xEAF4FF }),
  };
  const root = new T.Group(); scene.add(root); A.root = root;
  const add = (g: any, m: any, x: number, y: number, z: number, ry?: number, par?: any) => { const o = new T.Mesh(g, m); o.position.set(x, y, z); if (ry) o.rotation.y = ry; o.castShadow = q >= 1; o.receiveShadow = true; (par || root).add(o); return o; };
  const bx = (w: number, h: number, d: number, m: any, x: number, y: number, z: number, ry?: number, par?: any) => add(new T.BoxGeometry(w, h, d), m, x, y, z, ry, par);
  const slab = (w: number, d: number, h: number, r: number, m: any, x: number, yTop: number, z: number, ry?: number, par?: any) => {
    const s = new T.Shape(), hw = w / 2 - r, hd = d / 2 - r;
    s.moveTo(-hw, -d / 2); s.lineTo(hw, -d / 2); s.quadraticCurveTo(w / 2, -d / 2, w / 2, -hd); s.lineTo(w / 2, hd); s.quadraticCurveTo(w / 2, d / 2, hw, d / 2); s.lineTo(-hw, d / 2); s.quadraticCurveTo(-w / 2, d / 2, -w / 2, hd); s.lineTo(-w / 2, -hd); s.quadraticCurveTo(-w / 2, -d / 2, -hw, -d / 2);
    const bv = Math.min(0.012, h * 0.3), g = new T.ExtrudeGeometry(s, { depth: h - bv * 2, bevelEnabled: true, bevelThickness: bv, bevelSize: bv, bevelSegments: 3, curveSegments: 6 });
    g.rotateX(Math.PI / 2); g.translate(0, -bv, 0);
    return add(g, m, x, yTop, z, ry, par);
  };
  const plane = (w: number, h: number, m: any, x: number, y: number, z: number, ry: number) => { const o = new T.Mesh(new T.PlaneGeometry(w, h), m); o.position.set(x, y, z); o.rotation.y = ry; o.receiveShadow = true; root.add(o); return o; };
  // the room: 5.6 m by 5.4 m, 2.9 m high; you sit at the desk facing the back wall (−z)
  const X0 = -2.8, X1 = 2.8, Z0 = -2.9, Z1 = 2.5, HH = 2.9;
  const fl = plane(X1 - X0, Z1 - Z0, mat.floor, 0, 0, (Z0 + Z1) / 2, 0); fl.rotation.x = -Math.PI / 2;
  const ce = plane(X1 - X0, Z1 - Z0, mat.ceiling, 0, HH, (Z0 + Z1) / 2, 0); ce.rotation.x = Math.PI / 2;
  plane(X1 - X0, HH, mat.wall, 0, HH / 2, Z0, 0); plane(X1 - X0, HH, mat.wall, 0, HH / 2, Z1, Math.PI); plane(Z1 - Z0, HH, mat.wall, X0, HH / 2, (Z0 + Z1) / 2, Math.PI / 2); plane(Z1 - Z0, HH, mat.wall, X1, HH / 2, (Z0 + Z1) / 2, -Math.PI / 2);
  // acoustic panels on the back wall, a skirting all round
  for (let i = -3; i <= 3; i++) bx(0.7, 1.3, 0.04, mat.panel, i * 0.78, 1.55, Z0 + 0.03);
  for (const [x, z, len, ry] of [[0, Z0 + 0.02, X1 - X0, 0], [0, Z1 - 0.02, X1 - X0, Math.PI], [X0 + 0.02, (Z0 + Z1) / 2, Z1 - Z0, Math.PI / 2], [X1 - 0.02, (Z0 + Z1) / 2, Z1 - Z0, -Math.PI / 2]] as number[][]) bx(len, 0.1, 0.03, mat.black, x, 0.05, z, ry);
  // the route network on the right wall, lit from above
  { const g = new T.Group(); g.position.set(X1 - 0.03, 1.6, -0.6); g.rotation.y = -Math.PI / 2; root.add(g);
    const pic = new T.Mesh(new T.PlaneGeometry(2.0, 1.12), new T.MeshBasicMaterial({ map: ctTex(ofRouteMap(co)), toneMapped: false })); pic.position.z = 0.02; g.add(pic);
    bx(2.06, 1.18, 0.03, mat.black, 0, 0, 0, 0, g); }
  // the clock over the desk: your hub's time
  { const [c] = ctCanvas(512, 128); A.clockCv = c; const m = new T.Mesh(new T.PlaneGeometry(0.9, 0.225), new T.MeshBasicMaterial({ map: ctTex(c), toneMapped: false })); m.position.set(0, 2.45, Z0 + 0.06); root.add(m); A.clock = m; bx(0.96, 0.27, 0.04, mat.black, 0, 2.45, Z0 + 0.03); }
  // the desk: an oak top on black steel legs
  slab(2.2, 0.85, 0.045, 0.03, mat.oak, 0, 0.75, -0.25);
  for (const sx of [-1, 1]) { bx(0.06, 0.71, 0.7, mat.black, sx * 1.0, 0.355, -0.25); bx(0.08, 0.02, 0.76, mat.black, sx * 1.0, 0.01, -0.25); }
  bx(1.94, 0.3, 0.02, mat.black, 0, 0.55, -0.6);   // the modesty panel
  // the ultra-wide monitor: a curved 49-inch screen on a stand
  { const r = 1.25, wA = 1.08, hA = 0.32, L = wA / r, y0 = 1.12, zc = -0.3 + r;   // 30 cm behind the keyboard
    const sg = new T.CylinderGeometry(r, r, hA, 48, 1, true, Math.PI - L / 2, L); const uv = sg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
    // drawn at the screen's own proportions (1.08 m by 0.32 m), sharp: twice the pixels on the PC
    const MW = DESKTOP ? 4096 : 2560, [c] = ctCanvas(MW, Math.round(MW * hA / wA)); A.monCv = c; const tex = ctTex(c); A.monTex = tex;
    try { tex.anisotropy = OpsRoom.ren ? Math.min(16, OpsRoom.ren.capabilities.getMaxAnisotropy()) : 16; } catch (e) { /* default */ }
    const scr = new T.Mesh(sg, new T.MeshBasicMaterial({ map: tex, toneMapped: false, side: T.DoubleSide })); scr.position.set(0, y0, zc); root.add(scr); A.monScr = scr; A.monY = y0; A.monZ = zc - r;
    // the glass over it: the room's light glints off it as you move, as on your phone
    const gsg = new T.CylinderGeometry(r - 0.004, r - 0.004, hA + 0.006, 64, 1, true, Math.PI - (L + 0.004) / 2, L + 0.004);
    const glass = new T.Mesh(gsg, roomGlassMat(T, 0.12)); glass.position.set(0, y0, zc); glass.renderOrder = 2; root.add(glass);
    const sh = new T.Mesh(new T.CylinderGeometry(r + 0.012, r + 0.012, hA + 0.03, 48, 1, true, Math.PI - (L + 0.03) / 2, L + 0.03), new T.MeshPhysicalMaterial({ color: 0x0E1013, roughness: 0.35, side: T.DoubleSide })); sh.position.set(0, y0, zc + 0.0); root.add(sh);
    const back = new T.Mesh(new T.CylinderGeometry(r + 0.045, r + 0.045, hA + 0.02, 48, 1, true, Math.PI - L / 2, L), mat.black); back.position.set(0, y0, zc); root.add(back);
    bx(0.08, 0.28, 0.05, mat.metal, 0, 0.93, -0.37); bx(0.36, 0.012, 0.22, mat.metal, 0, 0.778, -0.35);
    const hit = new T.Mesh(new T.BoxGeometry(1.15, 0.38, 0.3), new T.MeshBasicMaterial({ visible: false })); hit.position.set(0, y0, -0.32); hit.userData.act = 'monitor'; root.add(hit); A.hits.push(hit);
    const glow = new T.PointLight(0x9CC8FF, 0.9, 2.4, 1.6); glow.position.set(0, 1.12, -0.1); root.add(glow); }
  // the keyboard: a full-size board with real keys and a number pad, and the mouse on its mat
  { const kb = new T.Group(); kb.position.set(-0.05, 0.775, 0.0); root.add(kb);
    slab(0.44, 0.14, 0.018, 0.008, mat.black, 0, 0.018, 0, 0, kb);
    const keys: number[][] = [], u = 0.0186, gap = 0.0028;
    const rows: number[][] = [[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2], [1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5], [1.8, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.2], [2.3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.7], [1.3, 1.3, 1.3, 6.2, 1.3, 1.3, 1.3, 1.3]];
    rows.forEach((r, ri) => { let x = -0.205; const z = -0.05 + ri * u * 1.02; r.forEach(w => { keys.push([x + w * u / 2, z, w * u - gap, u - gap]); x += w * u; }); });
    for (let ri = 0; ri < 5; ri++) for (let c = 0; c < 4; c++) keys.push([0.13 + c * u + u / 2, -0.05 + ri * u * 1.02, u - gap, u - gap]);   // the number pad
    const km = new T.InstancedMesh(new T.BoxGeometry(1, 0.008, 1), new T.MeshStandardMaterial({ color: 0x24272C, roughness: 0.55 }), keys.length), m4 = new T.Matrix4();
    keys.forEach((k, i) => { m4.makeScale(k[2], 1, k[3]); m4.setPosition(k[0], 0.022, k[1]); km.setMatrixAt(i, m4); }); km.castShadow = q >= 1; kb.add(km);
    const pad = new T.Mesh(new T.PlaneGeometry(0.26, 0.22), new T.MeshStandardMaterial({ color: 0x1B2028, roughness: 0.95 })); pad.rotation.x = -Math.PI / 2; pad.position.set(0.42, 0.7765, 0.02); root.add(pad);
    const mouse = new T.Mesh(new T.SphereGeometry(1, 24, 16), new T.MeshPhysicalMaterial({ color: 0x1A1C20, roughness: 0.3, clearcoat: 0.6 })); mouse.scale.set(0.032, 0.019, 0.058); mouse.position.set(0.42, 0.779, 0.03); root.add(mouse);
    const wheel = new T.Mesh(new T.CylinderGeometry(0.006, 0.006, 0.004, 12), mat.metal); wheel.rotation.z = Math.PI / 2; wheel.position.set(0.42, 0.798, 0.0); root.add(wheel);
    const hit = new T.Mesh(new T.BoxGeometry(0.9, 0.06, 0.3), new T.MeshBasicMaterial({ visible: false })); hit.position.set(0.1, 0.8, 0.02); hit.userData.act = 'monitor'; root.add(hit); A.hits.push(hit); }
  // archive folders stacked on the desk (left), a coffee cup and a phone
  { const cols = [0x2E4F7A, 0x8A2E2E, 0x2F6B4A, 0xB8862E, 0x3A3F46, 0x6B4A8A, 0x2E4F7A, 0xB8862E], r = ctRng(31);
    let y = 0.775; for (let i = 0; i < 8; i++) { const h = 0.028 + r() * 0.02; bx(0.33, h, 0.25, M({ color: cols[i], roughness: 0.7 }), -0.86 + (r() - 0.5) * 0.03, y + h / 2, -0.18 + (r() - 0.5) * 0.03, (r() - 0.5) * 0.12); bx(0.31, 0.004, 0.23, mat.paper, -0.86 + (r() - 0.5) * 0.02, y + h + 0.002, -0.18, (r() - 0.5) * 0.08); y += h + 0.004; }
    for (let i = 0; i < 4; i++) bx(0.06, 0.3, 0.24, M({ color: cols[(i + 3) % cols.length], roughness: 0.6 }), -0.99 + i * 0.065, 0.925, -0.52);   // upright binders behind the stack
    const hit = new T.Mesh(new T.BoxGeometry(0.6, 0.4, 0.4), new T.MeshBasicMaterial({ visible: false })); hit.position.set(-0.88, 0.95, -0.35); hit.userData.act = 'archives'; root.add(hit); A.hits.push(hit);
    add(new T.CylinderGeometry(0.04, 0.034, 0.1, 20), M({ color: 0xF4F4F2, roughness: 0.3 }), 0.72, 0.825, -0.1); add(new T.CylinderGeometry(0.036, 0.036, 0.004, 20), M({ color: 0x3A2216 }), 0.72, 0.872, -0.1);
  }
  // your phone, on the desk to the right of the keyboard, screen on
  phoneMesh(T, root, A, [0.68, 0.7875, 0.02], -0.3);   // on the desk, right of the mouse mat
  // the fancy chair: a high-backed leather chair with a headrest, stitched in the company colour, on five wheels
  { const g = new T.Group(); g.position.set(0, 0, 0.72); g.rotation.y = Math.PI; root.add(g);
    { const hit = new T.Mesh(new T.BoxGeometry(0.7, 1.5, 0.7), new T.MeshBasicMaterial({ visible: false })); hit.position.set(0, 0.75, 0); hit.userData.act = 'sit'; g.add(hit); A.hits.push(hit); }
    slab(0.56, 0.54, 0.11, 0.07, mat.leather, 0, 0.52, 0.02, 0, g);
    const back = new T.Mesh(new T.BoxGeometry(0.54, 0.82, 0.1), mat.leather); back.position.set(0, 0.98, -0.27); back.rotation.x = -0.1; back.castShadow = q >= 1; g.add(back);
    const head = new T.Mesh(new T.BoxGeometry(0.36, 0.17, 0.11), mat.leather); head.position.set(0, 1.5, -0.33); head.rotation.x = -0.12; g.add(head);
    for (const sx of [-1, 1]) { const st = new T.Mesh(new T.BoxGeometry(0.008, 0.8, 0.004), mat.stitch); st.position.set(sx * 0.17, 0.98, -0.218); st.rotation.x = -0.1; g.add(st);
      bx(0.07, 0.05, 0.4, mat.leather, sx * 0.32, 0.72, 0.0, 0, g); bx(0.04, 0.2, 0.04, mat.chrome, sx * 0.32, 0.6, 0.08, 0, g); bx(0.12, 0.18, 0.46, mat.leather, sx * 0.26, 0.98, -0.25, sx * 0.25, g); }
    add(new T.CylinderGeometry(0.03, 0.03, 0.32, 12), mat.chrome, 0, 0.3, 0, 0, g);
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; bx(0.33, 0.04, 0.05, mat.chrome, Math.cos(a) * 0.16, 0.1, Math.sin(a) * 0.16, -a, g); add(new T.SphereGeometry(0.03, 10, 8), mat.black, Math.cos(a) * 0.32, 0.03, Math.sin(a) * 0.32, 0, g); } }
  // the archive rack: a tall steel rack against the left wall, full of binders and archive boxes
  { const rx = X0 + 0.3, rz = -1.4, W = 1.8, D = 0.45, Hr = 2.45, g = new T.Group(); g.position.set(rx, 0, rz); g.rotation.y = Math.PI / 2; root.add(g);
    for (const [px, pz] of [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [W / 2, D / 2]]) bx(0.04, Hr, 0.04, mat.steel, px, Hr / 2, pz, 0, g);
    const lv = [0.08, 0.5, 0.92, 1.34, 1.76, 2.18, 2.42];
    for (const y of lv) { bx(W, 0.025, D, mat.steel, 0, y, 0, 0, g); bx(W, 0.04, 0.012, mat.steel, 0, y + 0.02, D / 2, 0, g); }
    bx(W, Hr, 0.01, mat.steel, 0, Hr / 2, -D / 2, 0, g);
    // binders (thin, upright, with a white label) and cardboard archive boxes, shelf by shelf
    const r = ctRng(9), binders: number[][] = [], boxes: number[][] = [];
    const bcol = [0x2E4F7A, 0x8A2E2E, 0x2F6B4A, 0x3A3F46, 0xB8862E, 0x1F3550, 0x5A2A4A];
    for (let s = 0; s < 6; s++) {
      let x = -W / 2 + 0.03; const y = lv[s] + 0.013, top = lv[s + 1] - lv[s] - 0.06;
      while (x < W / 2 - 0.1) {
        if (r() < 0.25) { const w = 0.32; if (x + w > W / 2 - 0.02) break; boxes.push([x + w / 2, y, 0, w, Math.min(0.26, top), 0.36]); x += w + 0.01; }
        else { const n = 4 + Math.floor(r() * 7); for (let i = 0; i < n && x < W / 2 - 0.08; i++) { const h = Math.min(top, 0.3 + r() * 0.04); binders.push([x + 0.03, y, 0.01, 0.055, h, 0.29, bcol[Math.floor(r() * bcol.length)], (r() - 0.5) * 0.04]); x += 0.06; } x += 0.02; }
      }
    }
    const bm = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), M({ roughness: 0.55 }), binders.length), lm = new T.InstancedMesh(new T.PlaneGeometry(1, 1), mat.paper, binders.length), m4 = new T.Matrix4(), Q = new T.Quaternion(), E = new T.Euler(), S = new T.Vector3(), P = new T.Vector3();
    binders.forEach((b, i) => { E.set(0, 0, b[7]); Q.setFromEuler(E); m4.compose(P.set(b[0], b[1] + b[4] / 2, b[2]), Q, S.set(b[3], b[4], b[5])); bm.setMatrixAt(i, m4); bm.setColorAt(i, new T.Color(b[6]));
      m4.compose(P.set(b[0], b[1] + b[4] * 0.62, b[2] + b[5] / 2 + 0.001), Q, S.set(b[3] * 0.7, b[4] * 0.22, 1)); lm.setMatrixAt(i, m4); });
    g.add(bm); g.add(lm);
    const xm = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), mat.card, boxes.length);
    boxes.forEach((b, i) => { m4.compose(P.set(b[0], b[1] + b[4] / 2, b[2]), Q.identity(), S.set(b[3], b[4], b[5])); xm.setMatrixAt(i, m4); });
    g.add(xm);
    const hit = new T.Mesh(new T.BoxGeometry(W, Hr, D), new T.MeshBasicMaterial({ visible: false })); hit.position.set(0, Hr / 2, 0); hit.userData.act = 'archives'; g.add(hit); A.hits.push(hit); }
  // the door: in the wall behind your chair, a panelled oak leaf on its hinges, a steel handle; it opens inwards
  { const dx = 1.75, dw = 0.95, dh = 2.1, z = Z1 - 0.02;
    for (const sx of [-1, 1]) bx(0.07, dh + 0.04, 0.09, mat.black, dx + sx * (dw / 2 + 0.035), (dh + 0.04) / 2, z - 0.02);
    bx(dw + 0.14, 0.07, 0.09, mat.black, dx, dh + 0.04, z - 0.02);
    const hinge = new T.Group(); hinge.position.set(dx - dw / 2, 0, z - 0.03); root.add(hinge); A.door = hinge;
    const leaf = new T.Mesh(new T.BoxGeometry(dw, dh, 0.045), mat.oak); leaf.position.set(dw / 2, dh / 2, -0.0225); leaf.castShadow = q >= 1; hinge.add(leaf);
    for (const [py, ph] of [[0.55, 0.7], [1.45, 0.75]]) { const pn = new T.Mesh(new T.BoxGeometry(dw - 0.22, ph, 0.012), M({ map: oak, roughness: 0.4, clearcoat: 0.4, color: 0xC8B49A })); pn.position.set(dw / 2, py, -0.05); hinge.add(pn); }
    const hd = new T.Mesh(new T.BoxGeometry(0.14, 0.025, 0.03), mat.chrome); hd.position.set(dw - 0.1, 1.02, -0.07); hinge.add(hd);
    const sign = new T.Mesh(new T.PlaneGeometry(0.34, 0.09), new T.MeshBasicMaterial({ color: 0x1FA36B, toneMapped: false })); sign.position.set(dx, dh + 0.2, z - 0.07); sign.rotation.y = Math.PI; root.add(sign);
    const hit = new T.Mesh(new T.BoxGeometry(dw, dh, 0.3), new T.MeshBasicMaterial({ visible: false })); hit.position.set(dx, dh / 2, z - 0.15); hit.userData.act = 'door'; root.add(hit); A.hits.push(hit); }
  // a plant in the corner
  Props.place(root, 'plant-2', X1 - 0.42, Z0 + 0.42, 0.3, q, { seed: 8 });
  // the lights: linear ceiling lights, cool white
  for (const z of [-1.6, 0.2, 1.6]) { const ln = new T.Mesh(new T.BoxGeometry(2.6, 0.02, 0.08), mat.glow); ln.position.set(0, HH - 0.012, z); root.add(ln); }
  for (const [x, z] of (q >= 1 ? [[-1.3, -1.6], [1.3, -1.6], [-1.3, 1.0], [1.3, 1.0], [0, -0.3]] : [[0, -1.3], [0, 0.8]])) { const L = new T.SpotLight(0xF2F6FF, q >= 1 ? 4.5 : 10, q >= 1 ? 7 : 9, q >= 1 ? 0.95 : 1.15, 0.7, 1.6); L.position.set(x, HH - 0.05, z); L.target.position.set(x, 0, z); if (q >= 2 && x === 0 && (!DESKTOP || Gfx.lights() >= 2)) { L.castShadow = true; L.shadow.mapSize.set(1024, 1024); } root.add(L); root.add(L.target); }
  return A;
}

/** The monitor: your schedule as on the Schedule screen (the same day, the same blocks, delays and cancellations),
 *  with the time now; drawn again every few seconds and after every change. */
function opsMonitorDraw(AA?: any) {
  const R = OpsRoom, A = AA || R.A; if (!A || !A.monCv) return;
  const c = A.monCv as HTMLCanvasElement, x = c.getContext('2d') as CanvasRenderingContext2D, W = c.width, H = c.height, co = company();
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0C1A2B'); g.addColorStop(1, '#081321'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  let blocks: Block[] = []; try { blocks = scheduleBlocks(); } catch (e) { /* none */ }
  let fl: any[] = []; try { fl = fleetOf(); } catch (e) { /* none */ }
  const now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes(), hm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(Math.round(m % 60)).padStart(2, '0')}`;
  // drawn for the screen's size (sizes below are for a 2048-pixel-wide screen), at the screen's own proportions:
  // the departures on the left, the timeline of the next hours on the right, so nothing looks stretched
  const s = W / 2048, F = (w: number, px: number) => `${w} ${Math.round(px * s)}px Inter, Arial, sans-serif`;
  const rr = (X: number, Y: number, w: number, h: number, r: number) => { x.beginPath(); (x as any).roundRect ? (x as any).roundRect(X, Y, w, h, r) : x.rect(X, Y, w, h); };
  const hdr = 64 * s; x.fillStyle = '#12263D'; x.fillRect(0, 0, W, hdr); x.fillStyle = co.color || '#2C8CFF'; x.fillRect(0, hdr - 2 * s, W, 3 * s);
  x.fillStyle = '#EAF2FA'; x.font = F(700, 30); x.textBaseline = 'middle'; x.fillText(`${co.name} · Operations`, 28 * s, hdr / 2);
  x.textAlign = 'right'; x.fillStyle = '#9FB6CC'; x.font = F(600, 24);
  x.fillText(`${_schedDay ? 'Tomorrow' : 'Today'} · ${fl.length} aircraft · ${blocks.filter(b => b.kind === 'flight').length} legs`, W - 160 * s, hdr / 2);
  x.fillStyle = '#EAF2FA'; x.font = F(700, 30); x.fillText(hm(nowMin), W - 28 * s, hdr / 2); x.textAlign = 'left';
  // the departures board
  const PW = 470 * s, top0 = hdr + 18 * s;
  x.fillStyle = 'rgba(255,255,255,.035)'; x.fillRect(0, hdr, PW, H - hdr); x.fillStyle = 'rgba(255,255,255,.08)'; x.fillRect(PW, hdr, 2 * s, H - hdr);
  x.fillStyle = '#9FB6CC'; x.font = F(700, 18); x.fillText(_schedDay ? 'FIRST DEPARTURES' : 'NEXT DEPARTURES', 24 * s, top0 + 12 * s);
  const legs = blocks.filter(b => b.kind === 'flight' && (_schedDay || b.end >= nowMin)).sort((a, b) => a.start - b.start), drh = 46 * s, nRows = Math.max(1, Math.floor((H - top0 - 40 * s) / drh));
  legs.slice(0, nRows).forEach((b, i) => {
    const y = top0 + 34 * s + i * drh, air = !_schedDay && b.start <= nowMin && b.end > nowMin && !b.cancelled, late = !b.cancelled && (b.delayMin || 0) >= 5;
    if (i % 2) { x.fillStyle = 'rgba(255,255,255,.03)'; x.fillRect(0, y, PW, drh); }
    x.fillStyle = '#EAF2FA'; x.font = F(700, 20); x.fillText(hm(b.start), 24 * s, y + drh / 2);
    x.fillText(`${b.from} – ${b.to}`, 104 * s, y + drh / 2);
    x.fillStyle = '#7F98B0'; x.font = F(600, 17); x.fillText(b.reg, 262 * s, y + drh / 2);
    const st = b.cancelled ? ['Cancelled', '#E05A5A'] : air ? ['In the air', '#3FD0A0'] : late ? [`+${b.delayMin} min`, '#F2B544'] : ['On time', '#7FC4F5'];
    x.fillStyle = st[1]; x.font = F(700, 16); x.textAlign = 'right'; x.fillText(st[0], PW - 20 * s, y + drh / 2); x.textAlign = 'left';
  });
  if (!legs.length) { x.fillStyle = '#7F98B0'; x.font = F(600, 18); x.fillText('Nothing planned.', 24 * s, top0 + 56 * s); }
  // the timeline: two hours back and ten ahead (tomorrow: from 05:00), an hour every column
  const t0 = _schedDay ? 300 : Math.max(0, Math.min(1440 - 720, Math.floor((nowMin - 120) / 60) * 60)), t1 = t0 + 720;
  const L = PW + 170 * s, Rr = W - 24 * s, top = hdr + 56 * s, rows = Math.max(1, fl.length), rh = Math.min(56 * s, (H - top - 14 * s) / rows), px = (m: number) => L + (Math.max(t0, Math.min(t1, m)) - t0) / (t1 - t0) * (Rr - L);
  x.font = F(600, 18); x.fillStyle = '#7F98B0';
  for (let h = Math.ceil(t0 / 60); h * 60 <= t1; h++) { const X = px(h * 60); x.fillStyle = h % 2 ? 'rgba(127,152,176,.25)' : 'rgba(127,152,176,.55)'; x.fillRect(X, top - 8 * s, Math.max(1, s), H - top); if (h % 2 === 0 && h * 60 < t1 && (_schedDay || Math.abs(X + 30 * s - px(nowMin)) > 70 * s)) { x.fillStyle = '#7F98B0'; x.fillText(`${String(h % 24).padStart(2, '0')}:00`, X + 6 * s, top - 22 * s); } }
  fl.forEach((a: any, i: number) => {
    const y = top + i * rh;
    if (i % 2) { x.fillStyle = 'rgba(255,255,255,.03)'; x.fillRect(PW + 2 * s, y, W, rh); }
    x.fillStyle = '#EAF2FA'; x.font = F(700, Math.min(22, rh / s * 0.44)); x.fillText(a.reg, PW + 22 * s, y + rh * 0.36);
    x.fillStyle = '#7F98B0'; x.font = F(500, Math.min(16, rh / s * 0.3)); try { x.fillText(acType(a.typeId).model, PW + 22 * s, y + rh * 0.72); } catch (e) { /* no type */ }
    for (const b of blocks.filter(bb => bb.reg === a.reg)) {
      if (b.end < t0 || b.start > t1) continue;
      const x0 = px(b.start), x1 = Math.max(x0 + 4 * s, px(b.end)), late = !b.cancelled && (b.delayMin || 0) >= 5;
      x.globalAlpha = b.end < nowMin && !_schedDay ? 0.45 : 1;
      x.fillStyle = b.kind === 'maint' ? '#C98A1E' : b.cancelled ? '#9A2E2E' : (co.color || '#2C8CFF');
      rr(x0, y + rh * 0.16, x1 - x0, rh * 0.68, Math.min(8 * s, rh * 0.2)); x.fill();
      if (late) { x.strokeStyle = '#F2B544'; x.lineWidth = 3 * s; x.stroke(); }
      if (x1 - x0 > 80 * s) { x.save(); x.beginPath(); x.rect(x0, y, x1 - x0 - 6 * s, rh); x.clip(); x.fillStyle = '#FFFFFF'; x.font = F(600, Math.min(18, rh / s * 0.34)); x.fillText(b.kind === 'maint' ? 'Maintenance' : b.cancelled ? 'Cancelled' : `${b.from}–${b.to}`, x0 + 8 * s, y + rh * 0.5); x.restore(); }
      x.globalAlpha = 1;
    }
  });
  if (!fl.length) { x.fillStyle = '#9FB6CC'; x.font = F(600, 28); x.fillText('No aircraft yet: buy or lease one to plan its flying.', L, top + 60 * s); }
  // now
  if (!_schedDay) { const X = px(nowMin); x.fillStyle = '#F2B544'; x.fillRect(X - 1.5 * s, top - 10 * s, 3 * s, H - top + 10 * s); rr(X - 36 * s, top - 46 * s, 72 * s, 26 * s, 6 * s); x.fill(); x.fillStyle = '#1A120A'; x.font = F(700, 17); x.textAlign = 'center'; x.fillText(hm(nowMin), X, top - 33 * s); x.textAlign = 'left'; }
  A.monTex.needsUpdate = true;
  // the wall clock: your hub's time (the device's clock, as the schedule uses)
  if (A.clockCv) { const cc = A.clockCv as HTMLCanvasElement, y = cc.getContext('2d') as CanvasRenderingContext2D; y.fillStyle = '#05080C'; y.fillRect(0, 0, 512, 128); y.fillStyle = '#FF5A3C'; y.font = '700 84px "Courier New", monospace'; y.textAlign = 'center'; y.textBaseline = 'middle'; y.fillText(hm(nowMin), 256, 68); A.clock.material.map.needsUpdate = true; }
}

function opsOpen2(root: HTMLElement, q: number) {
  const R = OpsRoom, T = THREE, cv = root.querySelector('canvas') as HTMLCanvasElement, H = R.host;
  R.ac = new AbortController(); R.sig = R.ac.signal;   // the room's own controls, all let go of together when it closes
  const ren = H ? H.ren : new T.WebGLRenderer({ canvas: cv, antialias: q >= 1, powerPreference: 'high-performance' }); R.ren = ren;
  if (!H) { ren.setPixelRatio(Gfx.pr(Gfx.placeSharp('room', q))); ren.outputColorSpace = T.SRGBColorSpace; ren.toneMapping = T.ACESFilmicToneMapping; ren.toneMappingExposure = 1.0;
    ren.shadowMap.enabled = Gfx.placeShadow('room', q >= 2); ren.shadowMap.type = T.PCFSoftShadowMap; }
  const scene = H ? H.scene : new T.Scene(); R.scene = scene; if (!H) scene.background = new T.Color(0x0B121B);
  const cam = H ? H.cam('ops') : new T.PerspectiveCamera(56, 1, 0.03, 30); R.cam = cam;
  if (!H) scene.add(new T.HemisphereLight(0xEAF2FF, 0x1A222C, 0.75));
  ctProgress(15, 'Setting up the desk…', R);
  setTimeout(() => {
    if (!R.on) return;
    if (!H) try {
      const pm = new T.PMREMGenerator(ren), env = new T.Scene(); env.add(new T.Mesh(new T.BoxGeometry(6, 3, 6), new T.MeshBasicMaterial({ color: 0x26303C, side: T.BackSide })));
      const l = new T.Mesh(new T.PlaneGeometry(3, 0.2), new T.MeshBasicMaterial({ color: 0xFFFFFF })); l.position.set(0, 1.4, 0); l.rotation.x = Math.PI / 2; env.add(l);
      scene.environment = pm.fromScene(env, 0.04).texture; pm.dispose();
    } catch (e) { /* no reflections */ }
    ctProgress(35, 'Filling the archive…', R);
    R.A = H ? H.A('ops') : opsBuild(scene, q); R.glow = H ? H.glow('ops') : new AimGlow(scene);
    ctProgress(65, 'Loading the schedule…', R);
    opsMonitorDraw();
    const fit = () => { const w = root.clientWidth, h = root.clientHeight; ren.setSize(w, h, false); cam.aspect = w / Math.max(1, h); cam.updateProjectionMatrix(); };
    if (!H) { fit(); R.fit = fit; window.addEventListener('resize', fit); } else R.fit = null;
    // looking around from the chair: drag, or the arrow keys
    R.look = { yaw: 0, pitch: -0.16 }; R.pk = null; R.phoneAfter = () => opsUi();
    if (H && H.enterAt) { const e = H.enterAt; H.enterAt = null; R.seat = false; R.free = { x: e.x, z: e.z, v: e.v || 0, bob: 0 }; R.look = { yaw: e.yaw, pitch: e.pitch || 0 }; }
    let drag: any = null, moved = 0;
    let justLocked = false;
    cv.addEventListener('pointerdown', e => {
      // walking on the PC: the view takes the mouse (no pointer, turn as far as you like); a click then uses what glows
      if (!R.seat && DESKTOP && e.pointerType === 'mouse') { drag = null; if (!aimLocked(cv)) { justLocked = true; aimLock(cv); } return; }
      drag = { x: e.clientX, y: e.clientY, yaw: R.look.yaw, pitch: R.look.pitch }; moved = 0; try { cv.setPointerCapture(e.pointerId); } catch (x) { /* none */ } }, { signal: R.sig });
    R.mm$ = (e: MouseEvent) => { if (R.on && !R.seat && aimLocked(cv)) aimTurn(R.look, e, -1.25, 0.9); };
    document.addEventListener('mousemove', R.mm$);
    // the walking stick on touch screens
    { const pad = root.querySelector('.op-pad') as HTMLElement, knob = pad && pad.firstElementChild as HTMLElement; let id = -1;
      if (pad) {
        const mv = (e: PointerEvent) => { const r = pad.getBoundingClientRect(), Rr = r.width / 2; let dx = (e.clientX - r.left - Rr) / Rr, dy = (e.clientY - r.top - Rr) / Rr; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } R.stick = [dx, -dy]; knob.style.transform = `translate(${dx * Rr * 0.55}px, ${dy * Rr * 0.55}px)`; };
        pad.addEventListener('pointerdown', e => { e.stopPropagation(); id = e.pointerId; pad.setPointerCapture(id); mv(e); });
        pad.addEventListener('pointermove', e => { if (e.pointerId === id) mv(e); });
        const up = (e: PointerEvent) => { if (e.pointerId !== id) return; id = -1; R.stick = [0, 0]; knob.style.transform = ''; };
        pad.addEventListener('pointerup', up); pad.addEventListener('pointercancel', up);
      } }
    cv.addEventListener('pointermove', e => { if (drag) { moved = Math.max(moved, Math.hypot(e.clientX - drag.x, e.clientY - drag.y)); R.look.yaw = drag.yaw - (e.clientX - drag.x) * 0.004; R.look.pitch = clamp(drag.pitch - (e.clientY - drag.y) * 0.003, -1.1, 0.8); } else opsHover(e); }, { signal: R.sig });
    cv.addEventListener('pointerup', e => { if (aimLocked(cv)) { if (justLocked) justLocked = false; else opsClickAt(); return; } justLocked = false; if (drag && moved < 6) opsClickAt(e); drag = null; }, { signal: R.sig });
    root.addEventListener('click', ev => { const b = (ev.target as HTMLElement).closest('[data-op]') as HTMLElement; if (b) opsClick(b); }, { signal: R.sig });
    R.key$ = (e: KeyboardEvent) => {
      if (!R.on) return; const k = e.key.toLowerCase();
      if (R.overlay) { if (k === 'escape' && !document.querySelector('.layer')) { e.preventDefault(); e.stopImmediatePropagation(); if (R.overlay.classList.contains('ph-screen')) phoneClose(R); else opsScreenClose(); } return; }
      if (k === 'escape' && R.pk && R.pk.st === 'hold') { e.preventDefault(); e.stopImmediatePropagation(); phonePut(R); return; }   // the screens have the keys (typing)
      if (k === 'escape') { e.preventDefault(); e.stopImmediatePropagation(); if (aimLocked()) { aimUnlock(); return; } if (aimEscUsed()) return; opsLeave(); return; }   // the first Esc only gives the mouse back
      if (/^arrow\w+$/.test(k) || (!R.seat && /^(w|a|s|d|shift)$/.test(k))) { R.keys[k] = true; e.preventDefault(); e.stopImmediatePropagation(); }
    };
    R.ku$ = (e: KeyboardEvent) => { if (R.on) R.keys[e.key.toLowerCase()] = false; };
    window.addEventListener('keydown', R.key$, true); window.addEventListener('keyup', R.ku$, true);
    ctProgress(90, 'Switching on the screens…', R);
    setTimeout(() => {
      if (!R.on) return;
      try { ren.compile(scene, cam); } catch (e) { /* first frame */ }
      R.loading = false; R.t0 = performance.now(); opsFrame();
      ctProgress(100, 'Ready', R);
      const wait = Math.max(300, 3000 - (performance.now() - R.loadT0));
      setTimeout(() => { const L = R.root && R.root.querySelector('.ct-loader') as HTMLElement; if (L) { L.classList.add('out'); setTimeout(() => L.remove(), 800); } opsUi(); }, wait);
    }, 40);
    R.iv = setInterval(() => { if (R.on && !document.hidden) opsMonitorDraw(); }, 5000);
    R.perf = Perf.state();
    if (H) return;   // the building draws it
    const loop = () => { if (!R.on) return; R.raf = requestAnimationFrame(loop); if (!R.loading && (!R.overlay || R.zoomAnim) && !Perf.skip(R.perf)) opsFrame(); };   // the room rests while a screen is open (not while it grows or shrinks)
    R.raf = requestAnimationFrame(loop);
  }, 30);
}

function opsFrame() {
  const R = OpsRoom, T = THREE, now = performance.now() / 1000, dt = Math.min(0.05, now - (R.last || now)); R.last = now;
  const k = R.keys || {};
  if (k.arrowleft) R.look.yaw += dt * 1.4; if (k.arrowright) R.look.yaw -= dt * 1.4;   // the chair turns all the way round
  if (k.arrowup) R.look.pitch = clamp(R.look.pitch + dt, -1.1, 0.8); if (k.arrowdown) R.look.pitch = clamp(R.look.pitch - dt, -1.1, 0.8);
  // the view eases to where you look (a button below turns you to the monitor or the archives)
  if (R.aim) { R.look.yaw += (R.aim.yaw - R.look.yaw) * Math.min(1, dt * 4); R.look.pitch += (R.aim.pitch - R.look.pitch) * Math.min(1, dt * 4); if (Math.abs(R.aim.yaw - R.look.yaw) < 0.005) R.aim = null; }
  // the glide towards the monitor (0 in the chair … 1 close to the screen), eased at both ends
  // the door swings open (and shut again)
  R.doorK = (R.doorK || 0) + ((R.doorT || 0) - (R.doorK || 0)) * Math.min(1, dt * 3.5); if (R.A && R.A.door) R.A.door.rotation.y = R.doorK * 1.35;
  const zk = opsZoomK(), ze = zk * zk * (3 - 2 * zk);
  // you: your own figure (built once the figures are loaded), seen from your eyes
  if (!R.meTried) { R.meTried = true; const mk = () => { try { if (!R.on || !R.scene) return; const me: any = myPilot(); R.me = selfBody(R.scene, me && me.look ? Object.assign({}, me.look, { hat: 'none' }) : ctLook('me', 'm', 'public'), company().color); if (R.me) { R.me.chair = new T.Vector3(0, 0.66, 0.86); R.me.eye0 = R.me.chair.clone().add(selfEyeOff(R.me, Math.PI, 0)); } /* on the cushion, back in the chair */ } catch (e) { R.me = null; } }; if (Human.ready) mk(); else Human.load().then(mk, () => { /* without */ }); }
  if (!R.seat) opsWalk(dt, now);
  else {
    R.cam.position.set(0, 1.2 - 0.075 * ze, 0.76 - 0.5 * ze);
    const P = R.pk ? phoneStep(R, dt, now) : null;   // your phone: reaching for it, holding it
    if (R.me) { try { const by = Math.PI + R.look.yaw * (1 - ze) * (P ? 1 - P.lookK : 1) + (P ? P.turn : 0); R.me.pitch = R.look.pitch * (1 - ze) * (P ? 1 - P.lookK : 1); const hip = P && P.slide ? R.me.chair.clone().add(new T.Vector3(0, 0, -P.slide)) : R.me.chair; const eye = selfPose(R.me, hip, by, 0.2 * ze + (P ? P.lean : 0), 1, 0, 0, P && P.t != null ? P.t : now, dt, P ? P.arms : undefined); R.cam.position.lerpVectors(eye, R.cam.position, ze); } catch (e) { R.me = null; } }
    const yaw = Math.PI + R.look.yaw * (1 - ze), p = R.look.pitch * (1 - ze) + 0.0 * ze;
    const ahead = R.cam.position.clone().add(new T.Vector3(Math.sin(yaw) * Math.cos(p), Math.sin(p), Math.cos(yaw) * Math.cos(p)));
    if (P && P.at && P.lookK > 0) ahead.lerp(P.at, P.lookK);   // your eyes on the phone
    R.cam.lookAt(ahead);
  }
  if (R.glow) { if (R.overlay || R.zoomAnim || (R.seat && !R.hover)) R.glow.hide(); R.glow.step(dt); }
  if (R.A && R.A.monScr) R.A.monScr.material.color.setScalar(1 + 0.6 * Math.sin(Math.PI * Math.min(1, zk * 1.4)));   // the screen lights up as it opens
  FrameGen.draw(R.perf, R.ren, R.scene, R.cam); Perf.frame(R.perf, R.ren);
}
function opsAimed(e?: PointerEvent): string { const o = opsAimedObj(e); return o ? o.userData.act : ''; }
/** What you can use at the mouse (or, walking with the mouse taken, at the dot in the middle), within reach. */
function opsAimedObj(e?: PointerEvent): any {
  const R = OpsRoom, T = THREE, rc = new T.Raycaster();
  if (e && !aimLocked()) { const r = (R.root.querySelector('canvas') as HTMLElement).getBoundingClientRect(); rc.setFromCamera(new T.Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), R.cam); }
  else rc.setFromCamera(new T.Vector2(0, 0), R.cam);
  const h = R.A ? rc.intersectObjects(R.A.hits, false)[0] : null;
  return h && (R.seat || h.distance < 2.8) ? h.object : null;
}
/* ---------- walking about the room ---------- */
function opsBlocked(x: number, z: number): boolean {
  const H = OpsRoom.host; if (H) { const d = H.pass('ops', x, z); if (d) return d < 0; }   // the doorway to the corridor: open or shut
  if (x < -2.55 || x > 2.55 || z < -2.65 || z > 2.25) return true;
  const B = [[-1.25, -0.8, 1.25, 0.32], [-0.42, 0.32, 0.42, 1.08], [-2.85, -2.45, -2.1, -0.35], [2.0, -2.9, 2.85, -2.05]];   // the desk, the chair, the archive rack, the plant
  for (const r of B) if (x > r[0] && x < r[2] && z > r[1] && z < r[3]) return true;
  return false;
}
function opsWalk(dt: number, now?: number) {
  const R = OpsRoom, F = R.free, K = R.keys || {}, T = THREE;
  const f = (K.w || K.arrowup ? 1 : 0) - (K.s || K.arrowdown ? 1 : 0) + R.stick[1], rr = (K.d || K.arrowright ? 1 : 0) - (K.a || K.arrowleft ? 1 : 0) + R.stick[0];
  const mag = Math.min(1, Math.hypot(f, rr)), vmax = K.shift ? 2.0 : 1.2; F.v += ((mag > 0.05 ? vmax * mag : 0) - F.v) * Math.min(1, dt * 6);
  const yaw = R.look.yaw, fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  let mx = fx * f + rx * rr, mz = fz * f + rz * rr; const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml; if (R.host && R.host.assist && ml > 0.05) { const g2 = R.host.assist('ops', F.x, F.z, mx, mz); mx = g2[0]; mz = g2[1]; }   // eased through an open doorway
  const step = F.v * dt;
  if (step > 0) { const nx = F.x + mx * step, nz = F.z + mz * step; if (!opsBlocked(nx, nz)) { F.x = nx; F.z = nz; } else if (!opsBlocked(nx, F.z)) F.x = nx; else if (!opsBlocked(F.x, nz)) F.z = nz; F.bob += step; }
  if (R.host && R.host.out('ops', F.x, F.z, R.look, F.v)) return;   // through the door: the corridor takes over
  Sound.steps(F, F.bob, 'carpet', F.v);   // carpet tiles all over the operations room
  const bobY = Math.sin(F.bob / 0.65 * Math.PI) * 0.016 * Math.min(1, F.v / 1.1);
  R.cam.position.set(F.x, 1.64 + bobY, F.z);
  // your body under you: feet stepping, arms swinging; your eyes at your own height
  if (R.me) { try { const S = R.me, yb = yaw + Math.PI, o = selfEyeOff(S, yb, 0); S.pitch = R.look.pitch; const eye = selfPose(S, new T.Vector3(F.x - o.x, S.hipY, F.z - o.z), yb, 0, 0, F.v, F.bob, now || 0, dt); R.cam.position.set(eye.x, eye.y + bobY, eye.z); } catch (e) { R.me = null; } }
  const p = R.look.pitch; R.cam.lookAt(R.cam.position.clone().add(new T.Vector3(fx * Math.cos(p), Math.sin(p), fz * Math.cos(p))));
  // what's in front of you glows: the door (leave), the chair (sit), the monitor, the archives
  const obj = opsAimedObj(), hint = obj ? obj.userData.act : '', aim = R.root.querySelector('.op-dot') as HTMLElement;
  if (R.glow) { if (obj) R.glow.showObj(obj); else R.glow.hide(); }
  if (aim) { aim.hidden = false; aim.textContent = hint === 'door' ? (R.host ? (R.doorT ? 'Click to shut the door' : 'Click to open the door to the corridor') : 'Click the door to leave Operations') : hint === 'sit' ? 'Click to sit in your chair' : hint === 'monitor' ? 'Click to work at the monitor' : hint === 'phone' ? 'Click to pick up your phone' : hint === 'archives' ? 'The archives' : '·'; aim.classList.toggle('on', !!hint); }
}
function opsSit() { const R = OpsRoom; aimUnlock(); R.seat = true; R.look = { yaw: 0, pitch: -0.16 }; const d = R.root.querySelector('.op-dot') as HTMLElement; if (d) d.hidden = true; Sound.tick(); opsUi(); }
function opsStand() { const R = OpsRoom; phoneReset(R); R.seat = false; R.free = { x: 0.3, z: 1.3, v: 0, bob: 0 }; R.look = { yaw: 0, pitch: -0.05 }; Sound.tick(); opsUi(); }
/** Through the door: it opens, and you are back in the Overview. */
function opsDoor() { const R = OpsRoom; if (R.host) { R.doorT = R.doorT ? 0 : 1; sfxDoor('wood', R.doorT === 1); return; } Sound.tick(); aimUnlock(); roomExitMenu(R.root, 'ops', to => { R.doorT = 1; setTimeout(() => opsLeave(to), 650); }); }
function opsHover(e: PointerEvent) {
  const R = OpsRoom; if (R.loading || R.overlay || !R.seat) return;
  const T = THREE, rc = new T.Raycaster(), r = (R.root.querySelector('canvas') as HTMLElement).getBoundingClientRect();
  rc.setFromCamera(new T.Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), R.cam);
  const h = R.A ? rc.intersectObjects(R.A.hits, false)[0] : null, cv = R.root.querySelector('canvas') as HTMLElement;
  cv.style.cursor = h ? 'pointer' : '';
  R.hover = !!h; if (R.glow) { if (h) R.glow.showObj(h.object); else R.glow.hide(); }   // what you can use glows softly under the mouse
}
function opsClickAt(e?: PointerEvent) {
  const R = OpsRoom; if (R.loading) return;
  // the monitor's screen is up: a click beside it puts it away (and on the phone, picks the phone up after)
  if (R.overlay) { if (R.overlay.classList.contains('op-screen') && !R.zoomAnim) { const a = opsAimed(e); opsScreenClose(); if (a === 'phone') setTimeout(() => { if (!R.overlay) phonePick(R); }, 800); } return; }
  // the phone in your hand: a tap brings its screen up; a click on the monitor puts the phone down first, then opens it
  if (R.pk && R.pk.st !== 'idle') { if (R.pk.st === 'hold') { const a0 = opsAimed(e); if (a0 === 'monitor') phoneThen(R, () => opsScreenOpen(R.tab || 'schedule')); else if (a0 === 'phone') phoneOpen(R); else phonePut(R); } return; }   // a click on the phone uses it; anywhere else puts it back on the desk
  const a = opsAimed(e);
  if (a === 'phone') { if (!R.seat) opsSit(); setTimeout(() => phonePick(R), R.seat ? 0 : 300); return; }
  if (a === 'door') { opsDoor(); return; }
  if (a === 'sit') { if (!R.seat) opsSit(); return; }
  if (a === 'monitor' && !R.seat) { opsSit(); setTimeout(() => opsScreenOpen(R.tab || 'schedule'), 250); return; }
  if (a === 'monitor') { Sound.tick(); opsScreenOpen(R.tab || 'schedule'); }
  else if (a === 'archives') { Sound.tick(); R.aim = { yaw: 1.3, pitch: 0.05 }; }
}

/* ---------- the buttons below, the screens over the room ---------- */
const OPS_TABS: [string, string, string][] = [['ops', 'Operations', 'ops'], ['schedule', 'Schedule', 'clock'], ['dispatch', 'Dispatch', 'routes'], ['planner', 'Flight planner', 'map']];
function opsUi() {
  const R = OpsRoom; if (!R.on) return;
  const sp = R.root.querySelector('.op-spots') as HTMLElement; sp.hidden = false;
  sp.innerHTML = OPS_TABS.filter(t => SCREENS[t[0]]).map(t => `<button data-op="tab" data-k="${t[0]}">${t[1]}</button>`).join('')
    + (R.seat ? `<button data-op="look" data-k="desk">At the desk</button><button data-op="look" data-k="archives">The archives</button><button data-op="walk">Walk around</button>` : `<button data-op="sit" class="on">Sit in my chair</button>`);
  const pad = R.root.querySelector('.op-pad') as HTMLElement; if (pad) pad.hidden = R.seat || DESKTOP;
  const hint = R.root.querySelector('.op-aim') as HTMLElement; if (hint) { hint.hidden = false; hint.textContent = !R.seat ? (DESKTOP ? 'W A S D to walk · the mouse looks around · click what glows · the door takes you out' : 'Stick to walk · drag to look · tap what glows') : DESKTOP ? 'Click the monitor to work · drag to look around · Esc to leave' : 'Tap the monitor to work · drag to look around'; hint.classList.add('op-hint'); setTimeout(() => { if (hint) hint.hidden = true; }, 6000); }
}
const OPS_ZOOM_MS = 750;
function opsReduced(): boolean { try { return !!(State.settings as any).reduceMotion || matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
/** Where the camera is in the glide: 0 in the chair … 1 at the monitor. */
function opsZoomK(): number {
  const R = OpsRoom, Z = R.zoomAnim; if (!Z) return R.overlay ? 1 : 0;
  const k = Math.min(1, (performance.now() - Z.t0) / OPS_ZOOM_MS);
  if (k >= 1) { R.zoomAnim = null; if (Z.done) Z.done(); return Z.dir > 0 ? 1 : 0; }
  return Z.dir > 0 ? k : 1 - k;
}
/** The monitor's screen on your screen, from the chair: the rectangle the screens grow out of and go back into. */
function opsMonRect(): { x: number; y: number; w: number; h: number } {
  const R = OpsRoom, T = THREE, cam = R.cam, A = R.A, rr = R.root.getBoundingClientRect();
  const keep = cam.position.clone(), q = cam.quaternion.clone();
  if (R.me && R.me.eye0) cam.position.copy(R.me.eye0); else cam.position.set(0, 1.2, 0.76); const yaw = Math.PI + R.look.yaw, p = R.look.pitch;
  cam.lookAt(cam.position.clone().add(new T.Vector3(Math.sin(yaw) * Math.cos(p), Math.sin(p), Math.cos(yaw) * Math.cos(p)))); cam.updateMatrixWorld();
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [x, y, z] of [[-0.54, 0.16, -0.185], [0.54, 0.16, -0.185], [-0.54, -0.16, -0.185], [0.54, -0.16, -0.185], [0, 0.16, -0.3], [0, -0.16, -0.3]]) {
    const v = new T.Vector3(x, (A ? A.monY : 1.12) + y, z).project(cam), sx = (v.x + 1) / 2 * rr.width, sy = (1 - v.y) / 2 * rr.height;
    x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
  }
  cam.position.copy(keep); cam.quaternion.copy(q); cam.updateMatrixWorld();
  return { x: x0, y: y0, w: Math.max(40, x1 - x0), h: Math.max(30, y1 - y0) };
}
function opsScreenOpen(key: string) {
  const R = OpsRoom; if (!R.on || !SCREENS[key] || R.zoomAnim) return;
  if (R.overlay) { opsScreenSwitch(key); return; }
  R.tab = key;
  for (const sel of ['.op-spots', '.op-aim']) { const e = R.root.querySelector(sel) as HTMLElement; if (e) e.hidden = true; }
  // the computer: the same desktop as your laptop (mail, calendar, bank, the markets, the browser…) with the operations
  // screens as apps of their own; it opens on the one you chose, the taskbar below
  const ov = document.createElement('div'); ov.className = 'of-planner op-screen lap-screen'; ov.setAttribute('data-screen', key);
  R.root.appendChild(ov); R.overlay = ov; document.body.classList.add('of-over');
  try { lapMount(ov); (Lap as any).ops = true; Lap.app = 'scr:' + key; lapRender(); } catch (e) { ov.innerHTML = '<p class="muted">The computer could not start.</p>'; }
  if (opsReduced()) return;
  // the screen grows out of the monitor while you lean in towards it
  const m = opsMonRect(), W = ov.offsetWidth || R.root.clientWidth, H = ov.offsetHeight || R.root.clientHeight;
  ov.classList.add('op-zoom'); ov.style.transformOrigin = '0 0';
  ov.style.transform = `translate(${m.x - ov.offsetLeft}px, ${m.y - ov.offsetTop}px) scale(${m.w / W}, ${m.h / H})`; ov.style.opacity = '0';
  const fx = document.createElement('div'); fx.className = 'op-zoom-fx'; fx.style.left = m.x + 'px'; fx.style.top = m.y + 'px'; fx.style.width = m.w + 'px'; fx.style.height = m.h + 'px'; R.root.appendChild(fx);
  R.zoomAnim = { t0: performance.now(), dir: 1, done: () => { ov.classList.remove('op-zoom', 'op-zoom-go'); ov.style.transform = ''; ov.style.opacity = ''; ov.style.transformOrigin = ''; } };
  void ov.offsetWidth;
  requestAnimationFrame(() => { ov.classList.add('op-zoom-go'); ov.style.transform = 'translate(0px, 0px) scale(1, 1)'; ov.style.opacity = '1'; fx.classList.add('go'); setTimeout(() => fx.remove(), 900); });
}
function opsScreenFill(key: string) {
  const R = OpsRoom; if (R.overlay && Lap.root === R.overlay) { R.tab = key; R.overlay.setAttribute('data-screen', key); Lap.app = 'scr:' + key; lapRender(); return; }
  const body = R.overlay && R.overlay.querySelector('.of-pl-body') as HTMLElement; if (!body) return;
  R.tab = key; R.overlay.setAttribute('data-screen', key);
  R.overlay.querySelectorAll('.op-tabs button').forEach((b: any) => b.classList.toggle('on', b.getAttribute('data-k') === key));
  body.innerHTML = `<section class="screen screen-${key}">${SCREENS[key].render()}</section>`;
  try { if (SCREENS[key].mount) SCREENS[key].mount(body.querySelector('.screen') as HTMLElement); } catch (e) { /* the screen shows what it can */ }
}
function opsScreenSwitch(key: string) { Sound.tick(); opsScreenFill(key); }
/** Back to the desk (you stay in the Operations office); the monitor shows any change at once. */
function opsScreenClose() {
  const R = OpsRoom; if (!R.overlay || R.zoomAnim) return;
  const ov = R.overlay; Sound.tick(); opsMonitorDraw();
  const finish = () => { try { if (Lap.root === ov) lapUnmount(); } catch (e) { /* closed */ } ov.remove(); if (R.overlay === ov) R.overlay = null; document.body.classList.remove('of-over'); opsUi(); };
  if (opsReduced()) { finish(); return; }
  // back into the monitor while you sit back in your chair, and the office comes into view around it
  const m = opsMonRect(), W = ov.offsetWidth || R.root.clientWidth, H = ov.offsetHeight || R.root.clientHeight;
  ov.style.pointerEvents = 'none'; ov.style.transformOrigin = '0 0'; ov.classList.add('op-zoom', 'op-zoom-go', 'op-zoom-back');
  R.zoomAnim = { t0: performance.now(), dir: -1, done: finish };
  requestAnimationFrame(() => { ov.style.transform = `translate(${m.x - ov.offsetLeft}px, ${m.y - ov.offsetTop}px) scale(${m.w / W}, ${m.h / H})`; ov.style.opacity = '0'; });
}
/** After a change anywhere (a leg moved, a route added): the screen over the room and the monitor show it too. */
function opsRefresh() {
  const R = OpsRoom; if (!R.on) return;
  try { opsMonitorDraw(); } catch (e) { /* next time */ }
  if (!R.overlay) return;
  const key = R.overlay.getAttribute('data-screen'); if (!key || key === 'planner' || !SCREENS[key]) return;   // the planner redraws itself
  if (Lap.root === R.overlay) { try { lapRefresh(); } catch (e) { /* next time */ } return; }
  const sec = R.overlay.querySelector('.of-pl-body .screen') as HTMLElement; if (sec) patchHtml(sec, SCREENS[key].render());
}
function opsClick(b: HTMLElement) {
  const R = OpsRoom, k = b.getAttribute('data-op');
  if (k === 'leave') opsLeave();
  else if (k === 'close') opsScreenClose();
  else if (k === 'tab') { Sound.tick(); opsScreenOpen(b.getAttribute('data-k')); }
  else if (k === 'walk') opsStand();
  else if (k === 'sit') opsSit();
  else if (k === 'look') { Sound.tick(); R.aim = b.getAttribute('data-k') === 'archives' ? { yaw: 1.3, pitch: 0.05 } : { yaw: 0, pitch: -0.16 }; }
}

/* ---------- leaving ---------- */
OpsRoom.close = function (quiet?: boolean) {
  const R = OpsRoom; if (!R.on) return; R.on = false;
  if (R.host) {   // in the building: only the room's own controls go; the building keeps the room
    const H = R.host; R.host = null;
    if (R.overlay) { try { if (R.overlay.classList.contains('lap-screen')) lapUnmount(); R.overlay.remove(); } catch (e) { /* gone */ } } R.overlay = null; document.body.classList.remove('of-over');
    clearInterval(R.iv); window.removeEventListener('keydown', R.key$, true); window.removeEventListener('keyup', R.ku$, true); document.removeEventListener('mousemove', R.mm$);
    try { R.ac && R.ac.abort(); } catch (e) { /* none */ }
    H.unmount('ops', R.doorT ? 1 : 0); R.ren = null; R.scene = null; R.A = null; R.glow = null; R.root = null;
    if (!quiet) H.leaveAll();
    return;
  }
  R.overlay = null; document.body.classList.remove('of-over');
  cancelAnimationFrame(R.raf); clearInterval(R.iv); window.removeEventListener('keydown', R.key$, true); window.removeEventListener('keyup', R.ku$, true); window.removeEventListener('resize', R.fit);
  document.removeEventListener('mousemove', R.mm$); aimUnlock();
  FrameGen.dispose(R.perf); exitFreeRenderer(R.ren, R.scene); R.ren = null; R.scene = null; R.A = null; R.glow = null; R.me = null; R.meTried = false;
  R.root.remove();
  if (!quiet) { try { refresh(); } catch (e) { /* ignore */ } }
};
/** Out of Operations: its own loading screen while the room is cleared from memory and the app comes back. */
function opsLeave(toOverview?: boolean | string) {
  if (!OpsRoom.on || ExitSplash.on) return;
  exitSplash('ops', 'Leaving Operations', [
    { pct: 30, step: 'Switching off the screens…', run: () => { const H = OpsRoom.host; OpsRoom.close(true); if (H) H.closeAll(); } },
    { pct: 55, step: 'Clearing the room from memory…', run: exitFreeMemory },
    { pct: 85, step: toOverview ? 'On your way…' : 'Loading your airline…', run: () => { if (toOverview) { try { roomGoTo(typeof toOverview === 'string' ? toOverview : 'overview'); } catch (e) { refresh(); } } else refresh(); } },
  ]);
}

ACTIONS['ops-room'] = () => { closeAll(); OpsRoom.open(); };
