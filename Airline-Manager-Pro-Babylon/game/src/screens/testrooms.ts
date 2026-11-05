// Test rooms: your office, the Operations office and a lounge joined into one building you walk through, from the
// title screen (Testing). It is for trying the connected layout before it goes into the game:
//  - The rooms are copies, built by their own builders (ofBuild, opsBuild, lgBuild): every piece of furniture,
//    the monitors, the phone, the family photo, the pet with its bed, ball and bowls are there as in each room. The
//    rooms in the game are not changed by it.
//  - A staff corridor joins your office and the Operations office; at its end a door opens onto the concourse, a
//    long hall with a glass wall onto the apron, and at the far end of it the lounge's sliding doors.
//  - Every door opens and shuts with a click; you walk through. Each has an airport-style sign beside it.
//  - A visitor walks down the corridor, knocks, comes into your office and sits down in the chair facing your desk.
//  - The monitors show their screens; clicking one opens the computer to look round, but nothing in it can be used
//    (it is a test, nothing in the game changes).
//  - Exit testing goes back to the title screen.

const TestRooms: any = { on: false };

/** The layout, in metres: x east, z south, the floor at 0. */
const TR_L = {
  cor: [-5.6, -18.5, -3.2, 6] as number[],     // the staff corridor [x0, z0, x1, z1]
  con: [-9, 6, 30, 18] as number[],            // the concourse
  ops: { x: -0.7, z: -14, ry: -Math.PI / 2 },  // the Operations office (its door wall faces the corridor)
  ofDoor: [-3.1, -2.1] as number[],            // your office's door, along the corridor wall (z)
  opsDoor: [-12.725, -11.775] as number[],     // the Operations office's door
  staffDoor: [-5.05, -4.05] as number[],       // corridor → concourse (x, in the concourse's north wall)
  lgDoorZ: 12,                                 // the lounge's doors, in the concourse's east wall (z)
  corH: 3.0, conH: 5.2,
};

TestRooms.open = function (opts?: any) {
  const R = TestRooms; if (R.on) return; R.stressMode = !!(opts && opts.stress);
  R.game = !!(opts && opts.game); R.gameRoom = opts && opts.room || 'office'; R.gameInc = opts && opts.inc || null; R.lgWant = opts && opts.lk || ''; R.in = 'halls';
  if (typeof company !== 'function' || !company()) { toast('Start or load a game first: the rooms are your own', 'info'); return; }
  const q = Gfx.roomQ();
  R.on = true; R.q = q; R.pct = 0; R.keys = {}; R.stick = [0, 0]; R.loading = true; R.loadT0 = performance.now(); R.overlay = null;
  const root = document.createElement('div'); root.className = 'court3d office3d tr3d'; R.root = root;
  root.innerHTML = `<canvas></canvas><div class="tr-halls-ui">
    <div class="ct-top tr-top"><div><small>${R.game ? esc(company().name) : opts && opts.stress ? 'Graphics' : 'Testing'}</small><b>${R.game ? 'Staff corridor and concourse' : opts && opts.stress ? 'Stress test' : 'Office · Operations · Lounge'}</b></div></div>
    <button class="ct-leave tr-leave" data-tr="exit">${icon('close')}<span>${R.game ? 'Leave' : opts && opts.stress ? 'Stop the test' : 'Exit testing'}</span><kbd>Esc</kbd></button>
    <div class="ct-spots tr-go"><button data-tr="go" data-k="office">Your office</button><button data-tr="go" data-k="corridor">Corridor</button><button data-tr="go" data-k="ops">Operations</button><button data-tr="go" data-k="training">Training</button><button data-tr="go" data-k="concourse">Concourse</button><button data-tr="go" data-k="lounge">Lounge</button><button data-tr="visitor">A visitor</button></div>
    <div class="walk-pad ct-pad op-pad"><i></i></div><div class="of-aim op-dot" hidden>+</div><div class="tr-hint" hidden></div></div>
    ${R.game ? ctLoaderHtml(R.gameRoom === 'ops' ? 'Operations' : R.gameRoom === 'lounge' ? 'Your lounge' : R.gameRoom === 'training' ? 'Training room' : 'Your office', 'Unlocking the doors…', R.gameRoom === 'ops' ? OPS_EMBLEM : R.gameRoom === 'lounge' ? LG_EMBLEM : OF_WINGS) : ctLoaderHtml('Test rooms', 'Joining the rooms…', '')}`;
  if (R.game) root.classList.add('tr-game');
  document.body.appendChild(root);
  setTimeout(() => { if (R.on && R.root === root) trOpen2(root, q); }, 60);
};

function trOpen2(root: HTMLElement, q: number) {
  const R = TestRooms, T = THREE, cv = root.querySelector('canvas') as HTMLCanvasElement;
  const ren = new T.WebGLRenderer({ canvas: cv, antialias: q >= 1, powerPreference: 'high-performance' }); R.ren = ren;
  ren.setPixelRatio(Gfx.pr(Gfx.placeSharp('room', q))); ren.outputColorSpace = T.SRGBColorSpace; ren.toneMapping = T.ACESFilmicToneMapping; ren.toneMappingExposure = 1.0;
  ren.shadowMap.enabled = q >= 2; ren.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene(); R.scene = scene; scene.background = new T.Color(0x101820);
  const cam = new T.PerspectiveCamera(62, 1, 0.06, 300); R.cam = cam;
  scene.add(new T.HemisphereLight(0xFFF3E2, 0x3A2A1A, 0.55));
  try { const pm = new T.PMREMGenerator(ren), env = new T.Scene(); env.add(new T.Mesh(new T.BoxGeometry(8, 4, 8), new T.MeshBasicMaterial({ color: 0x4A4438, side: T.BackSide }))); scene.environment = pm.fromScene(env, 0.04).texture; pm.dispose(); } catch (e) { /* no reflections */ }
  const steps: [number, string, () => void][] = [
    [15, 'Your office…', () => trOffice(scene, q)],
    [40, 'The Operations office…', () => trOps(scene, q, ren)],
    [60, 'The lounge…', () => trLounge(scene, q)],
    [70, 'The training room…', () => trTraining(scene, q)],
    [80, 'The corridor and the concourse…', () => trHalls(scene, q)],
  ];
  R.hits = []; R.doors = []; R.walk = []; R.walkOf = {};
  let i = 0;
  const next = () => {
    if (!R.on) return;
    if (i >= steps.length) { trReady(); return; }
    const [pct, txt, f] = steps[i++]; ctProgress(pct, txt, R);
    setTimeout(() => { try { f(); } catch (e) { console.error(e); try { ErrorLog.add('testing', 'Test rooms: a part could not be built', (e && (e as any).message) || String(e), txt); } catch (x) { /* no log */ } } next(); }, 30);
  };
  const fit = () => { const w = root.clientWidth, h = root.clientHeight; ren.setSize(w, h, false); for (const c of [cam, R.of && R.of.cam, R.ops && R.ops.cam, R.lg && R.lg.cam]) if (c) { c.aspect = w / Math.max(1, h); c.updateProjectionMatrix(); } };
  fit(); R.fit = fit; window.addEventListener('resize', fit);
  if (R.game) R.host = trHost(root, cv);
  trInput(root, cv);
  next();
}

/** Build a room with its own builder into a scene of its own, then move all of it into one group in the building. */
function trCopy(scene: any, build: (s: any) => any, x: number, z: number, ry: number): any {
  const T = THREE, tmp = new T.Scene(), A = build(tmp) || {};
  if (A.root) A.root.updateMatrixWorld(true);
  const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
  for (const o of tmp.children.slice()) g.add(o);
  g.updateMatrixWorld(true); A.group = g; return A;
}
/** Cut a doorway through what crosses it: walls, panelling and skirtings that run along the wall (planes and boxes
 *  built along their own x), within `root` (in the room's own coordinates, before it is moved). Door parts and what
 *  only touches the opening are kept. a, b: the two ends of the opening (room coordinates), top: its height. */
function trCut(root: any, a: number[], b: number[], top: number, keep: any[] = []) {
  const T = THREE, kill: any[] = [], add: any[] = [];
  root.updateMatrixWorld(true);
  for (const m of root.children) {
    if (!m.isMesh || keep.indexOf(m) >= 0 || !m.geometry || !m.geometry.parameters || !m.visible) continue;
    const P = m.geometry.parameters, isPlane = m.geometry.type === 'PlaneGeometry', isBox = m.geometry.type === 'BoxGeometry';
    if (!isPlane && !isBox) continue;
    const w = P.width, h = P.height, d = isBox ? P.depth : 0;
    if (!(w > 1.4) || (isBox && d > 0.2)) continue;   // only long, thin things along the wall
    const la = m.worldToLocal(new T.Vector3(a[0], 0, a[1])), lb = m.worldToLocal(new T.Vector3(b[0], 0, b[1]));
    if (Math.abs(la.z) > 0.16 || Math.abs(lb.z) > 0.16) continue;   // not in this wall
    const x0 = Math.min(la.x, lb.x), x1 = Math.max(la.x, lb.x);
    if (x1 < -w / 2 + 0.01 || x0 > w / 2 - 0.01) continue;
    const bottom = m.position.y - h / 2; if (bottom > top - 0.01) continue;   // above the door: keep it
    // the pieces: left of the opening, right of it, and over it (to the top)
    const pieces: number[][] = [[-w / 2, x0, -h / 2, h / 2], [x1, w / 2, -h / 2, h / 2]];
    const lt = m.worldToLocal(new T.Vector3(a[0], top, a[1])).y; if (lt < h / 2 - 0.01) pieces.push([x0, x1, lt, h / 2]);
    for (const [px0, px1, py0, py1] of pieces) {
      if (px1 - px0 < 0.01 || py1 - py0 < 0.01) continue;
      const geo = isPlane ? new T.PlaneGeometry(px1 - px0, py1 - py0) : new T.BoxGeometry(px1 - px0, py1 - py0, d);
      const n = new T.Mesh(geo, m.material); n.castShadow = m.castShadow; n.receiveShadow = m.receiveShadow;
      n.position.copy(m.localToWorld(new T.Vector3((px0 + px1) / 2, (py0 + py1) / 2, 0))); n.quaternion.copy(m.quaternion);
      add.push(n);
    }
    kill.push(m);
  }
  for (const m of kill) root.remove(m); for (const n of add) root.add(n);
}

/* ---------- the rooms ---------- */
function trOffice(scene: any, q: number) {
  const R = TestRooms;
  const A = trCopy(scene, s => { const A2 = ofBuild(s, q); trCut(A2.root, [-3.2, -3.1], [-3.2, -2.1], 2.2); return A2; }, 0, 0, 0);
  A.cam = trRoomCam(A.group, 58, 0.03);
  R.of = A; R.hits.push(...A.hits.map((h: any) => { h.userData.room = 'office'; return h; }));
  // its door: hinged, swinging into the room
  R.doors.push({ k: 'office', name: 'your office', mat: 'wood', k0: 0, to: 0, n: 'x', mid: [-3.2, -2.6], half: 0.5, set: (e: number) => { if (A.doorLeaf) A.doorLeaf.rotation.y = -1.5 * e; },
    pass: [-3.55, -3.0, -2.75, -2.2] });   // where you walk through when it is open [x0, z0, x1, z1]
  // the visitor's chair and the route in, as in the office
  R.ofWalk = (x: number, z: number) => x > -3.2 && x < 3.2 && z > -10.6 && z < 3.0 && !ofBlocked(x, z);   // with your suite behind it
  R.walk.push(R.walkOf.office = (x: number, z: number) => R.ofWalk(x, z));
}
function trOps(scene: any, q: number, ren: any) {
  const R = TestRooms, L = TR_L.ops, ren0 = OpsRoom.ren; OpsRoom.ren = ren;
  let A: any;
  try { A = trCopy(scene, s => { const A2 = opsBuild(s, q); trCut(A2.root, [1.75 - 0.5, 2.5], [1.75 + 0.5, 2.5], 2.15); return A2; }, L.x, L.z, L.ry); } finally { OpsRoom.ren = ren0; }
  A.cam = trRoomCam(A.group, 56, 0.03);
  R.ops = A; R.hits.push(...A.hits.map((h: any) => { h.userData.room = 'ops'; return h; }));
  try { opsMonitorDraw(A); } catch (e) { /* the screen stays dark */ }
  R.doors.push({ k: 'ops', name: 'the Operations office', mat: 'wood', k0: 0, to: 0, n: 'x', mid: [-3.2, (TR_L.opsDoor[0] + TR_L.opsDoor[1]) / 2], half: (TR_L.opsDoor[1] - TR_L.opsDoor[0]) / 2, set: (e: number) => { if (A.door) A.door.rotation.y = e * 1.35; },
    pass: [-3.55, TR_L.opsDoor[0] + 0.22, -2.75, TR_L.opsDoor[1] - 0.22] });
  // walking inside it: its own floor plan, turned into the building's
  const g = A.group, inv = new THREE.Matrix4();
  R.opsLocal = (x: number, z: number) => { inv.copy(g.matrixWorld).invert(); const v = new THREE.Vector3(x, 0, z).applyMatrix4(inv); return [v.x, v.z]; };
  R.walk.push(R.walkOf.ops = (x: number, z: number) => { const [lx, lz] = R.opsLocal(x, z); return lx > -2.8 && lx < 2.8 && lz > -2.9 && lz < 2.5 && !opsBlocked(lx, lz); });
}
/** A room's camera inside the building: it lives in the room's own coordinates (the room may be turned), so where it
 *  is told to look is in those coordinates too, as when the room stands on its own. */
function trRoomCam(group: any, fov: number, near: number): any {
  const T = THREE, cam = new T.PerspectiveCamera(fov, 1, near, 300), v = new T.Vector3(); group.add(cam);
  cam.lookAt = function (x: any, y?: number, z?: number) { if (x && x.isVector3) v.copy(x); else v.set(x, y, z); group.updateWorldMatrix(true, false); group.localToWorld(v); T.Object3D.prototype.lookAt.call(cam, v); };
  return cam;
}
function trLounge(scene: any, q: number) {
  const R = TestRooms, LR = LoungeRoom, k = R.game ? trLgPick(R.lgWant) : company().hub, L = loyalty(), have = L && L.lounges && L.lounges[k];
  const lv = have ? clamp(have.lvl || 0, 0, 2) : R.game ? 0 : 1, sp = LG_SPECS[lv];
  const keep = { spec: LR.spec, lvl: LR.lvl, k: LR.k, linked: LR.linked };
  LR.spec = sp; LR.lvl = lv; LR.k = k; LR.linked = true;
  const ox = TR_L.con[2] + sp.D / 2, oz = TR_L.lgDoorZ - (sp.W / 2 - 6.3);
  let A: any;
  try { A = trCopy(scene, s => { const A2 = lgBuild(s, q); try { lgLights(s, q); } catch (e) { /* the building's light */ } return A2; }, ox, oz, -Math.PI / 2); } finally { Object.assign(LR, keep); }
  R.lgKey = k; R.lgShut = !!(R.game && !have);   // none of your own yet: there, built and lit, but shut behind a hoarding
  A.cam = trRoomCam(A.group, 62, 0.06);
  R.lg = A; R.lgSpec = sp; R.lgLv = lv;
  R.hits.push(...A.hits.map((h: any) => { h.userData.room = 'lounge'; return h; }));
  R.doors.push({ k: 'lounge', name: 'the lounge', mat: 'sliding', k0: 0, to: 0, slide: true, n: 'x', mid: [TR_L.con[2], TR_L.lgDoorZ], half: LG_DOOR_W / 2, locked: R.lgShut, set: (e: number) => { for (const Lf of A.doorLeaves || []) Lf.position.x = Lf.userData.x0 + (Lf.userData.x1 - Lf.userData.x0) * e; },
    pass: [TR_L.con[2] - 0.6, TR_L.lgDoorZ - 0.7, TR_L.con[2] + 0.6, TR_L.lgDoorZ + 0.7] });
  const g = A.group, inv = new THREE.Matrix4();
  R.lgLocal = (x: number, z: number) => { inv.copy(g.matrixWorld).invert(); const v = new THREE.Vector3(x, 0, z).applyMatrix4(inv); return [v.x, v.z]; };
  R.walk.push(R.walkOf.lounge = (x: number, z: number) => {
    const [lx, lz] = R.lgLocal(x, z), r = 0.25; if (lx < -sp.W / 2 + 0.45 || lx > sp.W / 2 - 0.45 || lz < -sp.D / 2 + 0.5 || lz > sp.D / 2 - 0.4) return false;
    for (const b of A.blocks) if (lx > b[0] - r && lx < b[2] + r && lz > b[1] - r && lz < b[3] + r) return false;
    return true; });
}

/* ---------- the corridor and the concourse ---------- */
function trHalls(scene: any, q: number) {
  const R = TestRooms, T = THREE, C = TR_L.cor, K = TR_L.con, H = TR_L.corH, HC = TR_L.conH, g = new T.Group(); scene.add(g); R.halls = g;
  const shadow = q >= 2;
  const M = (o: any) => new T.MeshStandardMaterial(Object.assign({ roughness: 0.7 }, o));
  const vinyl = M({ map: ctTex(ctNoise('#7E868E', 0.06, 21), 8, 30), roughness: 0.5 }), wall = M({ color: 0xE9E7E1, roughness: 0.85 }), ceil = M({ color: 0xF2F2F0, roughness: 0.9, emissive: 0xF2F0EA, emissiveIntensity: 0.15 });
  const stone = M({ map: ctTex(ctNoise('#B8B2A6', 0.07, 5), 20, 6), roughness: 0.42 }), dark = M({ color: 0x2B3036, roughness: 0.5, metalness: 0.3 }), rail = M({ color: 0xB9BEC4, roughness: 0.45, metalness: 0.4 });
  const lamp = new T.MeshBasicMaterial({ color: 0xFFF8EC, toneMapped: false });
  const quad = (w: number, h: number, m: any, x: number, y: number, z: number, ry: number, rx = 0) => { const o = new T.Mesh(new T.PlaneGeometry(w, h), m); o.position.set(x, y, z); o.rotation.set(rx, ry, 0, 'YXZ'); o.receiveShadow = true; g.add(o); return o; };
  const box = (w: number, h: number, d: number, m: any, x: number, y: number, z: number, ry = 0) => { const o = new T.Mesh(new T.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.rotation.y = ry; o.castShadow = shadow; o.receiveShadow = true; g.add(o); return o; };
  /** A wall along x (at z, facing +z when f = 1) or along z (at x, facing +x when f = 1), with openings [a, b, top]. */
  const wallX = (x0: number, x1: number, z: number, f: number, h: number, holes: number[][], m = wall) => {
    let x = x0; const hs = holes.slice().sort((p, r) => p[0] - r[0]);
    for (const [a, b, top] of hs) { if (a > x) quad(a - x, h, m, (x + a) / 2, h / 2, z, f > 0 ? 0 : Math.PI); quad(b - a, h - top, m, (a + b) / 2, top + (h - top) / 2, z, f > 0 ? 0 : Math.PI); x = b; }
    if (x1 > x) quad(x1 - x, h, m, (x + x1) / 2, h / 2, z, f > 0 ? 0 : Math.PI);
  };
  const wallZ = (z0: number, z1: number, x: number, f: number, h: number, holes: number[][], m = wall) => {
    let z = z0; const hs = holes.slice().sort((p, r) => p[0] - r[0]);
    for (const [a, b, top] of hs) { if (a > z) quad(a - z, h, m, x, h / 2, (z + a) / 2, f > 0 ? Math.PI / 2 : -Math.PI / 2); quad(b - a, h - top, m, x, top + (h - top) / 2, (a + b) / 2, f > 0 ? Math.PI / 2 : -Math.PI / 2); z = b; }
    if (z1 > z) quad(z1 - z, h, m, x, h / 2, (z + z1) / 2, f > 0 ? Math.PI / 2 : -Math.PI / 2);
  };
  // the staff corridor: vinyl floor, a guard rail, panel lights, the rooms' doors on its east side
  quad(C[2] - C[0], C[3] - C[1], vinyl, (C[0] + C[2]) / 2, 0, (C[1] + C[3]) / 2, 0, -Math.PI / 2);
  quad(C[2] - C[0], C[3] - C[1], ceil, (C[0] + C[2]) / 2, H, (C[1] + C[3]) / 2, 0, Math.PI / 2);
  wallZ(C[1], C[3], C[2] - 0.02, -1, H, [[TR_L.ofDoor[0], TR_L.ofDoor[1], 2.2], [TR_L.opsDoor[0], TR_L.opsDoor[1], 2.15]]);
  const future = [[-9.0, -8.0]];
  wallZ(C[1], C[3], C[0], 1, H, [[TRN_L.door[0], TRN_L.door[1], 2.25]]);   // the training room's double doors
  wallX(C[0], C[2], C[1], 1, H, []);
  wallX(C[0], C[2], C[3] - 0.02, -1, H, [[TR_L.staffDoor[0], TR_L.staffDoor[1], 2.2]]);
  // the guard rail and the kick strip along both walls: stopping at every doorway and its frame, never across them
  const sideDoors: number[][][] = [future.concat([TRN_L.door]), [TR_L.ofDoor, TR_L.opsDoor]];
  for (const [i, [x, f]] of ([[C[0] + 0.03, 1], [C[2] - 0.05, -1]] as number[][]).entries()) {
    const gaps = sideDoors[i].map(d => [Math.min(d[0], d[1]) - 0.09, Math.max(d[0], d[1]) + 0.09]).sort((a, b) => a[0] - b[0]);
    let z = C[1];
    for (const [a, b] of gaps.concat([[C[3], C[3]]])) {
      if (a - z > 0.05) { box(0.04, 0.15, a - z, rail, x, 0.95, (z + a) / 2); box(0.012, 0.12, a - z, dark, x - f * 0.01, 0.06, (z + a) / 2); }
      z = Math.max(z, b);
    }
  }
  for (let z = C[1] + 1.5; z < C[3]; z += 3) { const p = quad(1.2, 0.6, lamp, (C[0] + C[2]) / 2, H - 0.01, z, 0, Math.PI / 2); void p; }
  // real lamps cost every surface a little more to draw, so fewer on lighter settings (the panels still glow, and
  // a soft fill light stands in for them); phones and tablets keep their speed
  const lampStep = q >= 2 ? 6 : q >= 1 ? 12 : 0;
  if (lampStep) for (let z = C[1] + 3; z < C[3]; z += lampStep) { const L = new T.PointLight(0xFFF4E2, q >= 2 ? 9 : 14, q >= 2 ? 9 : 14, 2); L.position.set((C[0] + C[2]) / 2, H - 0.3, z); g.add(L); }
  else g.add(new T.HemisphereLight(0xFFF6E8, 0x6A6458, 0.45));
  // the rooms still to come: shut doors with their signs (west side)
  for (const [i, [a, b]] of future.entries()) {
    const pv = new T.Group(); pv.position.set(C[0] + 0.03, 0, a); pv.rotation.y = -Math.PI / 2; g.add(pv); Props.place(pv, 'door-1', 0, 0, 0, q, { w: b - a, h: 2.12, color: 0x7D8790 });
    const hit = new T.Mesh(new T.BoxGeometry(0.3, 2.1, b - a), new T.MeshBasicMaterial({ visible: false })); hit.position.set(C[0] + 0.15, 1.05, (a + b) / 2); hit.userData.act = 'future'; hit.userData.name = i ? 'Training room' : 'Crew room'; g.add(hit); R.hits.push(hit);
    Props.place(g, 'room-sign', C[0] + 0.03, b + 0.36, Math.PI / 2, q, { name: i ? 'Training\nroom' : 'Crew room', sub: 'Coming later', num: i ? '2.22' : '2.20', pict: i ? 'ops' : 'break', staff: true }, 1.25);
  }
  // signs by the rooms' doors (corridor side)
  Props.place(g, 'room-sign', C[2] - 0.04, TR_L.ofDoor[1] + 0.38, -Math.PI / 2, q, { name: 'Your office', sub: 'Director', num: '2.14', pict: 'office', staff: true }, 1.25);
  Props.place(g, 'room-sign', C[2] - 0.04, TR_L.opsDoor[1] + 0.38, -Math.PI / 2, q, { name: 'Operations\nroom', sub: 'Flight operations', num: '2.18', pict: 'ops', staff: true }, 1.25);
  Props.place(g, 'plant-3', C[0] + 0.45, C[1] + 0.6, 0, q, { seed: 11 });
  // the door at the end of the corridor, onto the concourse (opens outwards, into the concourse)
  { const pv = new T.Group(); pv.position.set(TR_L.staffDoor[0], 0, C[3]); g.add(pv); Props.place(pv, 'door-1', 0, 0, 0, q, { w: TR_L.staffDoor[1] - TR_L.staffDoor[0], h: 2.13, color: 0x5B636C });
    const hit = new T.Mesh(new T.BoxGeometry(TR_L.staffDoor[1] - TR_L.staffDoor[0], 2.1, 0.3), new T.MeshBasicMaterial({ visible: false })); hit.position.set((TR_L.staffDoor[1] - TR_L.staffDoor[0]) / 2, 1.05, 0); hit.userData.act = 'door'; hit.userData.room = 'staff'; pv.add(hit); R.hits.push(hit);
    R.doors.push({ k: 'staff', name: 'the concourse', mat: 'metal', k0: 0, to: 0, n: 'z', mid: [(TR_L.staffDoor[0] + TR_L.staffDoor[1]) / 2, C[3]], half: (TR_L.staffDoor[1] - TR_L.staffDoor[0]) / 2, set: (e: number) => { pv.rotation.y = -e * Math.PI * 0.55; }, pass: [TR_L.staffDoor[0] + 0.22, C[3] - 0.6, TR_L.staffDoor[1] - 0.22, C[3] + 0.6] });
    Props.place(g, 'room-sign', TR_L.staffDoor[1] + 0.4, C[3] + 0.02, 0, q, { name: 'Offices', sub: 'Operations · Director', num: 'L2', pict: 'office', staff: true }, 1.25);
    // a frame round it on both sides
    for (const z of [C[3] - 0.03, C[3] + 0.03]) { box(0.06, 2.2, 0.06, dark, TR_L.staffDoor[0] - 0.03, 1.1, z); box(0.06, 2.2, 0.06, dark, TR_L.staffDoor[1] + 0.03, 1.1, z); box(TR_L.staffDoor[1] - TR_L.staffDoor[0] + 0.12, 0.06, 0.06, dark, (TR_L.staffDoor[0] + TR_L.staffDoor[1]) / 2, 2.2, z); } }
  // the concourse: a long hall, stone floor, a glass wall onto the apron (south), shops along the north wall
  quad(K[2] - K[0], K[3] - K[1], stone, (K[0] + K[2]) / 2, 0, (K[1] + K[3]) / 2, 0, -Math.PI / 2);
  { const slat = ctTex((() => { const [c, x] = ctCanvas(256, 256); x.fillStyle = '#C9A77C'; x.fillRect(0, 0, 256, 256); for (let i = 0; i < 16; i++) { x.fillStyle = i % 2 ? '#B48E61' : '#D8B98E'; x.fillRect(0, i * 16, 256, 10); } return c; })(), 1, 30);
    quad(K[2] - K[0], K[3] - K[1], M({ map: slat, roughness: 0.8 }), (K[0] + K[2]) / 2, HC, (K[1] + K[3]) / 2, 0, Math.PI / 2); }
  wallX(K[0], K[2], K[1], 1, HC, [[TR_L.staffDoor[0], TR_L.staffDoor[1], 2.2]]);
  wallZ(K[1], K[3], K[0], 1, HC, []);
  wallZ(K[1], K[3], K[2] - 0.02, -1, HC, R.lg ? [[TR_L.lgDoorZ - LG_DOOR_W / 2, TR_L.lgDoorZ + LG_DOOR_W / 2, LG_DOOR_H]] : []);
  // the glass wall: mullions, a sill, and the apron beyond it
  { const view = new T.Mesh(new T.PlaneGeometry(90, 26), new T.MeshBasicMaterial({ map: ctTex(ofView()), toneMapped: false })); view.position.set((K[0] + K[2]) / 2, 9, K[3] + 26); view.rotation.y = Math.PI; g.add(view);
    const gl = new T.Mesh(new T.PlaneGeometry(K[2] - K[0], HC), new T.MeshPhysicalMaterial({ color: 0xD6E8F5, roughness: 0.03, transparent: true, opacity: 0.12, depthWrite: false })); gl.position.set((K[0] + K[2]) / 2, HC / 2, K[3]); gl.renderOrder = 3; g.add(gl);
    for (let x = K[0]; x <= K[2] + 0.01; x += 2.6) box(0.1, HC, 0.14, dark, x, HC / 2, K[3]);
    box(K[2] - K[0], 0.12, 0.3, dark, (K[0] + K[2]) / 2, 0.06, K[3]); box(K[2] - K[0], 0.2, 0.2, dark, (K[0] + K[2]) / 2, HC - 0.1, K[3]); }
  // shop fronts on the north wall
  ['Café', 'Books', 'Duty free', 'Deli', 'Pharmacy'].forEach((nm, i) => {
    const x = -1 + i * 6.2; if (x + 5 > K[2]) return; const [c, cx] = ctCanvas(512, 128); cx.fillStyle = ['#2E5C8A', '#8A2F2A', '#3A6B4A', '#6E4128', '#2B6E7A'][i]; cx.fillRect(0, 0, 512, 128); cx.fillStyle = '#fff'; cx.font = '600 58px Inter, Arial, sans-serif'; cx.fillText(nm, 28, 84);
    quad(4.6, 1.1, new T.MeshBasicMaterial({ map: ctTex(c), toneMapped: false }), x + 2.6, 3.4, K[1] + 0.03, 0);
    const gw = new T.Mesh(new T.PlaneGeometry(4.6, 2.6), new T.MeshPhysicalMaterial({ color: 0xBFD6E8, roughness: 0.05, transparent: true, opacity: 0.25 })); gw.position.set(x + 2.6, 1.3, K[1] + 0.03); g.add(gw);
    const inside = new T.Mesh(new T.PlaneGeometry(4.6, 2.6), new T.MeshBasicMaterial({ color: new T.Color(['#E9D9B8', '#E2D6C2', '#E6E2D8', '#E8D3B9', '#DDE8E6'][i]) })); inside.position.set(x + 2.6, 1.3, K[1] + 0.01); g.add(inside);
  });
  // moving walkways (to look at; you walk beside them), seats along the glass
  for (const z of [10.2, 12.9]) { box(22, 0.22, 2.0, M({ color: 0x5D646C, metalness: 0.5, roughness: 0.4 }), 12, 0.11, z); box(21.8, 0.02, 1.7, M({ color: 0x2B2F34, roughness: 0.6 }), 12, 0.23, z);
    for (const s of [-1, 1]) { box(22, 0.9, 0.04, new T.MeshPhysicalMaterial({ color: 0xDDEBF4, transparent: true, opacity: 0.25, roughness: 0.05 }), 12, 0.67, z + s * 0.96); box(22, 0.1, 0.12, M({ color: 0x1C1F23 }), 12, 1.15, z + s * 0.96); } }
  { // the seats along the glass: one shape each for the seat, the back and the legs, drawn as copies (a single draw call each)
    const xs: number[] = []; for (let x = -6; x < 26; x += 0.62) xs.push(x);
    const seatM = M({ color: 0x2F3D52, roughness: 0.55 }), legM = M({ color: 0x9AA0A6, metalness: 0.6, roughness: 0.35 }), m4 = new T.Matrix4();
    for (const [geo, mat, y, z] of [[new T.BoxGeometry(0.54, 0.05, 0.5), seatM, 0.45, 16.6], [new T.BoxGeometry(0.54, 0.5, 0.06), seatM, 0.72, 16.88], [new T.BoxGeometry(0.04, 0.43, 0.42), legM, 0.215, 16.65]] as any[]) {
      const im = new T.InstancedMesh(geo, mat, xs.length); xs.forEach((x, i) => im.setMatrixAt(i, m4.makeTranslation(x, y, z))); im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.castShadow = shadow; im.receiveShadow = true; g.add(im); } }
  for (const x of [-7.5, 7, 27]) Props.place(g, 'plant-2', x, 16.9, 0.3, q, { seed: Math.round(x) });
  // lights: a row of pendants and the ceiling's glow
  for (let x = K[0] + 3; x < K[2]; x += 6) { if (lampStep && Math.round((x - K[0] - 3) / 6) % (lampStep / 6) === 0) { const L = new T.PointLight(0xFFF6E8, q >= 2 ? 22 : 34, q >= 2 ? 18 : 26, 2); L.position.set(x, HC - 0.6, (K[1] + K[3]) / 2); g.add(L); }
    const d = new T.Mesh(new T.CylinderGeometry(0.35, 0.35, 0.05, 24), lamp); d.position.set(x, HC - 0.03, (K[1] + K[3]) / 2); g.add(d); }
  // overhead signs: yellow on dark grey (as in many airports)
  const way = (x: number, z: number, ry: number, w: number, text: string) => {
    const [c, cx] = ctCanvas(Math.round(w * 200), 200); cx.fillStyle = '#2B3036'; cx.fillRect(0, 0, c.width, 200); cx.fillStyle = '#F4C542'; cx.font = '700 96px Inter, Arial, sans-serif'; cx.textBaseline = 'middle'; cx.fillText(text, 40, 106);
    const sg = new T.Group(); sg.position.set(x, 3.4, z); sg.rotation.y = ry; g.add(sg);
    const bxm = new T.Mesh(new T.BoxGeometry(w + 0.1, 1.02, 0.14), dark); sg.add(bxm);
    for (const s of [-1, 1]) { const p = new T.Mesh(new T.PlaneGeometry(w, 0.92), new T.MeshBasicMaterial({ map: ctTex(c), toneMapped: false })); p.position.z = s * 0.072; p.rotation.y = s > 0 ? 0 : Math.PI; sg.add(p); }
    for (const s of [-1, 1]) { const r2 = new T.Mesh(new T.CylinderGeometry(0.02, 0.02, HC - 3.9, 6), rail); r2.position.set(s * (w / 2 - 0.4), (HC - 3.9) / 2 + 0.51, 0); sg.add(r2); }
  };
  way(4, 12, Math.PI / 2, 7, 'Lounge  →   Gates 21–23');
  way(22, 12, -Math.PI / 2, 5.5, '←  Offices · Staff');
  // the lounge's entrance seen from the concourse: its name over the doors, its sign beside them
  if (R.lg) { const [c, cx] = ctCanvas(1400, 260); cx.fillStyle = '#E6C98E'; cx.font = '600 120px Georgia, serif'; cx.textAlign = 'center'; cx.fillText(String(company().name || 'Lounge'), 700, 120); cx.font = '500 64px Inter, Arial, sans-serif'; cx.fillStyle = '#F2EADB'; cx.fillText(R.lgShut ? 'C O M I N G   S O O N' : R.lgSpec ? R.lgSpec.name.toUpperCase().split('').join(' ') : 'L O U N G E', 700, 215);
    if (R.lgShut) {   // a hoarding over the shut doors until you own a lounge
      const [hc, hx] = ctCanvas(640, 760), W = 640, Hh = 760;
      hx.fillStyle = '#1D2026'; hx.fillRect(0, 0, W, Hh);
      for (const y0 of [0, Hh - 70]) { hx.save(); hx.beginPath(); hx.rect(0, y0, W, 70); hx.clip(); for (let i = -2; i < 14; i++) { hx.fillStyle = i % 2 ? '#F2C230' : '#22252B'; hx.beginPath(); hx.moveTo(i * 60, y0 + 70); hx.lineTo(i * 60 + 60, y0 + 70); hx.lineTo(i * 60 + 130, y0); hx.lineTo(i * 60 + 70, y0); hx.fill(); } hx.restore(); }
      hx.textAlign = 'center'; hx.fillStyle = '#E6C98E'; hx.font = '600 92px Georgia, serif'; hx.fillText('Lounge', W / 2, 260);
      hx.fillStyle = '#F2EADB'; hx.font = '600 50px Inter, Arial, sans-serif'; hx.fillText('COMING SOON', W / 2, 350);
      hx.fillStyle = '#9AA3AE'; hx.font = '500 32px Inter, Arial, sans-serif'; hx.fillText('Under construction', W / 2, 430);
      hx.fillText('We are sorry for the', W / 2, 520); hx.fillText('inconvenience', W / 2, 562);
      const hw = LG_DOOR_W + 0.7, hh = LG_DOOR_H + 0.12, dk = M({ color: 0x1D2026, roughness: 0.7 });
      const hb = new T.Mesh(new T.BoxGeometry(0.06, hh, hw), [dk, new T.MeshStandardMaterial({ map: ctTex(hc), roughness: 0.65 }), dk, dk, dk, dk]);
      hb.position.set(K[2] - 0.09, hh / 2, TR_L.lgDoorZ); hb.userData = { act: 'door', room: 'lounge' }; g.add(hb); R.hits.push(hb); }
    quad(5.6, 1.4, M({ color: 0x2A2C30, roughness: 0.6 }), K[2] - 0.04, LG_DOOR_H + 0.75, TR_L.lgDoorZ, -Math.PI / 2);
    const n = new T.Mesh(new T.PlaneGeometry(4.4, 0.82), new T.MeshBasicMaterial({ map: ctTex(c), transparent: true, toneMapped: false })); n.position.set(K[2] - 0.06, LG_DOOR_H + 0.75, TR_L.lgDoorZ); n.rotation.y = -Math.PI / 2; g.add(n);
    Props.place(g, 'room-sign', K[2] - 0.04, TR_L.lgDoorZ + LG_DOOR_W / 2 + 0.45, -Math.PI / 2, q, { name: 'Lounge', sub: R.lgSpec ? R.lgSpec.name : 'Members', num: 'L', pict: 'lounge', staff: false }, 1.25); }
  // a security officer by the staff door (on the concourse side), when you have one at this airport
  try { const hub = R.lgKey || (company() && company().hub) || '', o = typeof secPick === 'function' ? secPick(hub) : null;
    if (o && Human.ready) { const m = Human.build(dressed(Object.assign({}, o.look, { sec: true }), 'ground' as any), 'ground', '#1C1F26', av3Style(), q >= 2 ? 0.6 : 0.45);
      const pv = new T.Group(); pv.add(m.root); pv.position.set(TR_L.staffDoor[1] + 0.9, 0, C[3] + 0.6); pv.rotation.y = -0.3; g.add(pv);
      m.pose({ t: 1, yaw: 0, gaze: [0, 0], blink: 0, g: humanGesture(null, 1) }); R.guard = { m, pv }; } } catch (e) { /* no guard */ }
  // the flight boards hanging over the concourse before the lounge: Departures and Arrivals, 30 cm apart, facing you as
  // you walk towards the lounge
  { const fx = K[2] - 3.2, fy = 4.35, fz = TR_L.lgDoorZ;
    try { R.fids = fidsPair(g, R.lgKey || (company() && company().hub) || '', fx, fy, fz, -Math.PI / 2, 1.6); } catch (e) { R.fids = []; }
    const rodM = M({ color: 0x2B3036, metalness: 0.6, roughness: 0.4 });
    for (const s of [-1.7, -0.3, 0.3, 1.7]) { const rod = new T.Mesh(new T.CylinderGeometry(0.012, 0.012, HC - fy - 0.45, 6), rodM); rod.position.set(fx, fy + 0.45 + (HC - fy - 0.45) / 2, fz + s); g.add(rod); } }
  // walking: the corridor and the concourse (keeping off the walls, the walkways and the seats)
  const r = 0.28;
  R.walk.push((x: number, z: number) => x > C[0] + r && x < C[2] - r && z > C[1] + r && z < C[3] - r);
  R.walk.push((x: number, z: number) => {
    if (!(x > K[0] + r && x < K[2] - r && z > K[1] + r && z < K[3] - 0.5)) return false;
    if (x > 0.7 && x < 23.3 && ((z > 9.1 && z < 11.3) || (z > 11.8 && z < 14.0))) return false;   // the walkways
    if (z > 16.2 && x > -6.4 && x < 26) return false;   // the seats
    return true; });
}

/* ---------- ready, the loop ---------- */
function trReady() {
  const R = TestRooms; if (!R.on) return;
  ctProgress(95, 'Ready to walk…', R);
  R.free = { x: -4.4, z: -6, v: 0, bob: 0 }; R.look = { yaw: Math.PI, pitch: -0.05 };
  try { R.ren.compile(R.scene, R.cam); } catch (e) { /* first frame */ }
  R.loading = false; R.t0 = performance.now();
  ctProgress(100, 'Ready', R);
  setTimeout(() => { const L = R.root && R.root.querySelector('.ct-loader') as HTMLElement; if (L) { L.classList.add('out'); setTimeout(() => L.remove(), 800); } }, 500);
  R.perf = Perf.state();
  const loop = () => { if (!R.on) return; R.raf = requestAnimationFrame(loop); if (!R.loading && !R.overlay && (R.stress || !Perf.skip(R.perf))) trFrame(); };   // the stress test measures every frame, uncapped
  R.raf = requestAnimationFrame(loop);
  R.iv = setInterval(() => { if (R.on && !document.hidden && R.ops) { try { opsMonitorDraw(R.ops); } catch (e) { /* next time */ } } }, 5000);
  try { R.fit(); } catch (e) { /* later */ }
  if (R.stressMode) setTimeout(() => { if (R.on) gfxStressStart(); }, 900);
  else if (R.game && R.gameRoom === 'training') { const s = TR_SPOTS.training; R.free.x = s.x; R.free.z = s.z; R.look = { yaw: s.yaw, pitch: -0.05 }; }   // into the Training room, at its doors
  else if (R.game) trEnter(R.gameRoom, null, R.gameInc);   // straight into your chair (or the lounge)
  else setTimeout(() => { if (R.on) trVisitor(); }, 6000);
}
function trFrame() {
  const R = TestRooms, T = THREE, now = (performance.now() - R.t0) / 1000, raw = Math.max(0, now - (R.last || now)), dt = Math.min(0.05, raw); R.last = now;
  if (R.stress) { const c0 = performance.now(); try { petStep(R.of, now, dt); } catch (e) { /* no pet */ } for (const D of R.doors) D.set(D.k0); gfxStressFrame(raw); if (R.stress) { R.stress.frameCpu = performance.now() - c0; gfxStressDraw(() => R.ren.render(R.scene, R.cam)); } return; }
  if (R.in && R.in !== 'halls') { trRoomFrame(dt); return; }
  try { if (R.of) petStep(R.of, now, dt); } catch (e) { /* no pet */ }
  for (const D of R.doors) if (D.k0 !== D.to) { D.k0 += Math.sign(D.to - D.k0) * Math.min(Math.abs(D.to - D.k0), dt * (D.slide ? 1.6 : 1.4)); const e = D.k0 * D.k0 * (3 - 2 * D.k0); D.set(e); }
  try { trVisStep(dt, now); } catch (e) { R.vis = null; }
  try { trnStep(dt, now); } catch (e) { /* no clock */ }
  try { fidsStep(R.fids); } catch (e) { /* the boards wait */ }
  try { if (R.guard) R.guard.m.pose({ t: now, yaw: 0, gaze: [Math.sin(now * 0.2) * 0.4, 0], blink: (now % 4.1) < 0.12 ? 1 : 0, g: humanGesture(null, now) }); } catch (e) { R.guard = null; }   // the officer stands and looks round
  trWalk(dt);
  trAim();
  FrameGen.draw(R.perf, R.ren, R.scene, R.cam); Perf.frame(R.perf, R.ren);
}
/** Can you stand at x, z: in a room, the corridor or the concourse, or in a doorway that is open. */
/** Going through a doorway: walking towards an open door (not a locked one), within a step or so of it, you are eased
 *  onto the line through its middle, so you go straight through instead of catching on the frame. Sideways and away
 *  from it, nothing changes. Returns the direction to move (building coordinates). */
function trDoorAssist(x: number, z: number, mx: number, mz: number): [number, number] {
  const R = TestRooms;
  for (const D of R.doors || []) {
    if (!D.mid || D.locked || D.k0 < 0.4) continue;
    const nx = D.n === 'x', dN = nx ? D.mid[0] - x : D.mid[1] - z, dL = nx ? z - D.mid[1] : x - D.mid[0];   // to the doorway (across the wall), and off its middle (along it)
    if (Math.abs(dN) > 1.4 || Math.abs(dL) > D.half + 0.75) continue;
    const toward = (nx ? mx : mz) * Math.sign(dN || 1); if (toward < 0.25) continue;   // only when heading through
    const room = Math.max(0, D.half - 0.33), off = Math.abs(dL) > room ? dL - Math.sign(dL) * room : 0;   // anywhere across the middle of its width is fine
    const pull = clamp(-off * 6, -1, 1) * (1 - Math.min(1, Math.abs(dN) / 1.4) * 0.4);
    let ax = mx, az = mz; if (nx) az += pull; else ax += pull;
    // straight through once in the opening
    if (Math.abs(dN) < 0.45) { if (nx) az *= 0.35; else ax *= 0.35; }
    const l = Math.hypot(ax, az) || 1; return [ax / l, az / l];
  }
  return [mx, mz];
}
function trFree(x: number, z: number): boolean {
  const R = TestRooms;
  for (const D of R.doors) { const p = D.pass; if (x > p[0] && x < p[2] && z > p[1] && z < p[3]) return !D.locked && D.k0 > 0.55; }
  for (const f of R.walk) if (f(x, z)) return true;
  return false;
}
function trWalk(dt: number) {
  const R = TestRooms, F = R.free, K = R.keys || {}, T = THREE;
  const f = (K.w || K.arrowup ? 1 : 0) - (K.s || K.arrowdown ? 1 : 0) + R.stick[1], rr = (K.d || K.arrowright ? 1 : 0) - (K.a || K.arrowleft ? 1 : 0) + R.stick[0];
  if (K.q) R.look.yaw += dt * 1.6; if (K.e) R.look.yaw -= dt * 1.6;
  const yaw = R.look.yaw, want = Math.min(1, Math.hypot(f, rr)) * (K.shift ? 2.6 : 1.4);
  F.v += Math.max(-4 * dt, Math.min(4 * dt, want - F.v));
  if (F.v > 0.01) {
    const n = Math.max(0.001, Math.hypot(f, rr)), fx = (Math.sin(yaw) * f - Math.cos(yaw) * rr) / n, fz = (Math.cos(yaw) * f + Math.sin(yaw) * rr) / n;
    const [gx, gz] = trDoorAssist(F.x, F.z, fx, fz), step = F.v * dt, nx = F.x + gx * step, nz = F.z + gz * step;
    if (trFree(nx, nz)) { F.x = nx; F.z = nz; } else if (trFree(nx, F.z)) F.x = nx; else if (trFree(F.x, nz)) F.z = nz;
    F.bob += step;
    if (R.game) { for (const k of ['office', 'ops', 'lounge']) { const fn = R.walkOf && R.walkOf[k]; if (fn && fn(F.x, F.z)) { trEnter(k, { x: F.x, z: F.z, yaw: R.look.yaw, pitch: R.look.pitch, v: F.v }); return; } } }
    try { Sound.steps(F, F.bob, F.z > TR_L.con[1] ? 'tile' : 'carpet', F.v); } catch (e) { /* quiet */ }
  }
  const bob = Math.sin(F.bob / 0.65 * Math.PI) * 0.016 * Math.min(1, F.v / 1.1);
  R.cam.position.set(F.x, 1.64 + bob, F.z);
  const p = R.look.pitch; R.cam.lookAt(new T.Vector3(F.x + Math.sin(yaw) * Math.cos(p), 1.64 + bob + Math.sin(p), F.z + Math.cos(yaw) * Math.cos(p)));
}
/** What you look at (or point at), within reach. */
function trAimedObj(e?: PointerEvent): any {
  const R = TestRooms, T = THREE, rc = new T.Raycaster();
  if (e && !aimLocked()) { const r = (R.root.querySelector('canvas') as HTMLElement).getBoundingClientRect(); rc.setFromCamera(new T.Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), R.cam); }
  else rc.setFromCamera(new T.Vector2(0, 0), R.cam);
  const h = rc.intersectObjects(R.hits, false)[0];
  return h && h.distance < 3.0 ? h.object : null;
}
function trHintOf(o: any): string {
  if (!o) return ''; const a = o.userData.act, room = o.userData.room;
  if (a === 'trn') return o.userData.id === 'teacher' ? `${TRN_TEACHER.name}: click to see what he says` : 'Click to see who this is';
  if (TestRooms.game && a !== 'door' && a !== 'future') return '';
  if (a === 'door') { const D = TestRooms.doors.filter((d: any) => d.k === room)[0]; return D ? D.locked ? 'Lounge: coming soon. Buy your first lounge to open it' : (D.to ? `Click to shut the door` : `Click to open the door to ${D.name}`) : ''; }
  if (a === 'future') return `${o.userData.name}: coming later`;
  if (a === 'monitor' || a === 'laptop') return 'Click to look at the computer (looking only)';
  if (a === 'pet') return 'Your pet';
  return 'In the test, only to look at';
}
function trAim() {
  const R = TestRooms, o = trAimedObj(), tx = trHintOf(o), el = R.root.querySelector('.tr-hint') as HTMLElement;
  if (el) { el.hidden = !tx; el.textContent = tx; }
}
function trClickAt(e?: PointerEvent) {
  const R = TestRooms; if (R.loading || R.overlay) return;
  const o = trAimedObj(e); if (!o) return;
  const a = o.userData.act, room = o.userData.room;
  if (a === 'trn') { trnShow(o.userData.id); return; }
  if (R.game && a !== 'door' && a !== 'future') return;
  if (a === 'door') { const D = R.doors.filter((d: any) => d.k === room)[0]; if (!D) return;
    if (D.to) { const F = R.free, p = D.pass; if (F.x > p[0] - 0.4 && F.x < p[2] + 0.4 && F.z > p[1] - 0.4 && F.z < p[3] + 0.4) { toast('Step out of the doorway first', 'info'); return; } }
    if (D.locked) { toast('Your lounge opens here once you own your first one (Lounges)', 'info'); return; }
    D.to = D.to ? 0 : 1; try { sfxDoor(D.mat || 'wood', D.to === 1); } catch (x) { /* quiet */ } return; }
  if (a === 'future') { toast(`${o.userData.name}: this room comes later`, 'info'); return; }
  if (a === 'monitor' || a === 'laptop') { trComputer(room === 'ops' ? 'schedule' : ''); return; }
  toast('Test rooms: this is only to look at here', 'info');
}

/* ---------- the computer, to look round only ---------- */
/** The same desktop as in the game (mail, calendar, bank, the browser, the operations screens), shown over the room.
 *  Opening apps and switching tabs works; anything that would change the game is stopped with a note. */
const TR_LOOK = /^(lap-app|lap-close|lap-mail|lap-mail-back|lap-mail-reports|lap-cal-m|lap-cal-day|lap-bank-tab|lap-bank-kind|lap-bank-fil|lap-web|[a-z]+-tab)$/;
function trComputer(app: string) {
  const R = TestRooms; if (R.overlay) return;
  aimUnlock();
  const ov = document.createElement('div'); ov.className = 'of-planner op-screen lap-screen tr-look'; R.root.appendChild(ov); R.overlay = ov; document.body.classList.add('of-over');
  const bar = document.createElement('div'); bar.className = 'tr-look-bar'; bar.innerHTML = `<span>${icon('info')}Test rooms: looking only, nothing here changes the game</span><button class="btn sm" data-tr="lookclose">${icon('close')}Back to the room</button>`;
  try { lapMount(ov); (Lap as any).ops = true; if (app && SCREENS[app]) { Lap.app = 'scr:' + app; lapRender(); } } catch (e) { ov.innerHTML = '<p class="muted">The computer could not start.</p>'; }
  R.root.appendChild(bar); R.lookBar = bar;
  const stop = (ev: Event) => {
    const t = ev.target as HTMLElement, b = t && t.closest && t.closest('[data-act]') as HTMLElement;
    if (b && !TR_LOOK.test(b.getAttribute('data-act') || '')) { ev.preventDefault(); ev.stopImmediatePropagation(); toast('Test rooms: looking only', 'info'); return; }
    if (t && t.closest && t.closest('form') && ev.type === 'submit') { ev.preventDefault(); ev.stopImmediatePropagation(); }
  };
  ov.addEventListener('click', stop, true); ov.addEventListener('submit', stop, true);
  ov.addEventListener('change', (ev: Event) => { const t = ev.target as HTMLElement; if (t && t.closest && t.closest('[data-act]')) { ev.stopImmediatePropagation(); } }, true);
}
function trComputerClose() {
  const R = TestRooms; if (!R.overlay) return;
  try { lapUnmount(); } catch (e) { /* closed */ }
  R.overlay.remove(); R.overlay = null; if (R.lookBar) { R.lookBar.remove(); R.lookBar = null; } document.body.classList.remove('of-over');
}

/* ---------- a visitor: down the corridor, a knock, into your office and down into the chair ---------- */
function trVisitor() {
  const R = TestRooms, T = THREE; if (!R.on || !R.of) return;
  if (R.vis && R.vis.state !== 'gone') { toast('A visitor is already on the way', 'info'); return; }
  const go = () => {
    if (!R.on) return;
    const all = ((State as any).staff || []).filter((p: any) => p && p.look && p.companyId === State.companyId);
    const p = all.length ? all[Math.floor(Math.random() * all.length)] : null;
    if (!p) { toast('No staff to visit you yet', 'info'); return; }
    if (R.vis && R.vis.pivot) { try { R.of.root.remove(R.vis.pivot); } catch (e) { /* gone */ } }
    const m = Human.build(p.look, personRole(p), company().color || '#2C8CFF', av3Style(), 0.85);
    const pivot = new T.Group(), holder = new T.Group(); pivot.rotation.order = 'YXZ'; holder.add(m.root); pivot.add(holder); R.of.root.add(pivot);
    m.root.traverse((o: any) => { if (o.isMesh) { o.castShadow = R.q >= 1; o.receiveShadow = true; } });
    // from the far end of the corridor to your door, then round the furniture to the chair
    const path = [[-4.4, -2.6], [-3.8, -2.6]].concat(ofRoute(-3.8, -2.6, -0.6, -0.9)).concat([[0, -0.86]]);
    R.vis = { p, m, pivot, holder, x: -4.4, z: -10.5, yaw: 0, sitK: 0, wantSit: 0, dist: 0, v: 0, path, state: 'walking', g: null, knocked: false };
    toast(`${p.name} is coming to see you`, 'info');
  };
  if (Human.ready) go(); else Human.load().then(go, () => toast('The people could not be loaded', 'info'));
}
function trVisStep(dt: number, now: number) {
  const R = TestRooms, V = R.vis; if (!V || V.state === 'gone') return;
  const T = THREE, top = V.m.top || 1.7, t = now + 3, D = R.doors.filter((d: any) => d.k === 'office')[0];
  if (V.state === 'walking' && V.path.length) {
    // at the door: a knock, the door opens, a moment, then in
    if (!V.knocked && V.z > -3.2) { V.knocked = true; V.wait = 1.6; try { Sound.tick(); } catch (e) { /* quiet */ } if (D) D.to = 1; }
    if (V.wait > 0) { V.wait -= dt; V.v = 0; }
    else {
      const [tx, tz] = V.path[0], dx = tx - V.x, dz = tz - V.z, d = Math.hypot(dx, dz);
      const vWant = Math.min(1.0, Math.sqrt(2 * 1.4 * (d + (V.path.length > 1 ? 1 : 0)))); V.v += Math.max(-1.4 * dt, Math.min(1.4 * dt, vWant - V.v));
      const step = Math.min(d, V.v * dt); if (d > 1e-4) { V.x += dx / d * step; V.z += dz / d * step; V.dist += step; }
      const yawT = Math.atan2(dx, dz); let dy = yawT - V.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI; V.yaw += dy * Math.min(1, dt * 5);
      if (d < 0.03) { V.path.shift(); if (!V.path.length) { V.v = 0; V.state = 'turning'; } }
      if (D && D.to && V.x > -1.5) D.to = 0;   // the door shuts behind them
    }
  } else if (V.state === 'turning') {
    let dy = 0 - V.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI; V.yaw += dy * Math.min(1, dt * 3.5);
    if (Math.abs(dy) < 0.04) { V.yaw = 0; V.state = 'sitting'; V.wantSit = 1; }
  }
  V.sitK += Math.sign(V.wantSit - V.sitK) * Math.min(Math.abs(V.wantSit - V.sitK), dt * 1.0);
  const sk = V.sitK * V.sitK * (3 - 2 * V.sitK), chairZ = R.of.visitor ? R.of.visitor.z : -0.98;
  const zz = V.state === 'walking' ? V.z : V.z + (chairZ - V.z) * sk;
  V.pivot.position.set(V.x, sk * 0.49, zz); V.holder.position.y = -sk * top * 0.52; V.pivot.rotation.y = V.yaw;
  let gT = V.state === 'walking' ? cabinLerpG(humanGesture(null, t), humanGesture({ kind: 'walk', v: Math.max(0.6, V.v), seed: V.p.name }, V.dist / 1.25), Math.min(1, V.v / 0.6)) : humanGesture(null, t);
  gT = humanSitMove(cabinLerpG(gT, humanGesture({ kind: 'sit', v: 0 }, t), sk), sk);
  V.g = V.g ? cabinLerpG(V.g, gT, Math.min(1, dt * 6)) : gT;
  V.m.pose({ t, yaw: 0, gaze: [0, 0.05], blink: (t % 4.1) < 0.12 ? 1 : 0, g: V.g, talk: 0 });
}

/* ---------- moving about: keys, the mouse, touch ---------- */
const TR_SPOTS: any = {
  office: { x: 0.9, z: 1.6, yaw: Math.PI + 0.3 }, corridor: { x: -4.4, z: -6, yaw: Math.PI }, training: { x: -6.5, z: -15.1, yaw: -Math.PI / 2 }, ops: { x: -2.1, z: -12.4, yaw: Math.PI / 2 },
  concourse: { x: -4.4, z: 8, yaw: Math.PI / 2 }, lounge: { x: 31.5, z: 12, yaw: Math.PI / 2 },
};
function trInput(root: HTMLElement, cv: HTMLCanvasElement) {
  const R = TestRooms;
  let drag: any = null, moved = 0, justLocked = false;
  const mine = () => !R.in || R.in === 'halls';   // in a room, the room's own controls have it
  cv.addEventListener('pointerdown', e => {
    if (!mine()) { drag = null; return; }
    if (DESKTOP && e.pointerType === 'mouse') { drag = null; if (!aimLocked(cv)) { justLocked = true; aimLock(cv); } return; }
    drag = { x: e.clientX, y: e.clientY, yaw: R.look ? R.look.yaw : 0, pitch: R.look ? R.look.pitch : 0 }; moved = 0; cv.setPointerCapture(e.pointerId); });
  R.mm$ = (e: MouseEvent) => { if (R.on && mine() && R.look && aimLocked(cv)) aimTurn(R.look, e, -1.25, 0.9); };
  document.addEventListener('mousemove', R.mm$);
  cv.addEventListener('pointermove', e => { if (!drag || !R.look || !mine()) return; moved = Math.max(moved, Math.hypot(e.clientX - drag.x, e.clientY - drag.y)); R.look.yaw = drag.yaw - (e.clientX - drag.x) * 0.004; R.look.pitch = clamp(drag.pitch - (e.clientY - drag.y) * 0.004, -1.2, 0.9); });
  cv.addEventListener('pointerup', e => { if (!mine()) { drag = null; return; } if (aimLocked(cv)) { if (justLocked) justLocked = false; else trClickAt(); return; } justLocked = false; if (drag && moved < 6) trClickAt(e); drag = null; });
  root.addEventListener('click', ev => {
    const b = (ev.target as HTMLElement).closest('[data-tr]') as HTMLElement; if (!b) return; const k = b.getAttribute('data-tr');
    if (k === 'exit') { if (R.stress) { gfxStressEnd(true); return; } if (R.game) { trLeaveBuilding(); return; } TestRooms.close(); return; }
    if (k === 'lookclose') { trComputerClose(); return; }
    if (k === 'visitor') { trVisitor(); return; }
    if (k === 'trnclose') { const B = R.root.querySelector('.trn-box') as HTMLElement; if (B) B.hidden = true; if (R.trn) R.trn.boxWho = ''; Sound.tick(); return; }
    if (k === 'trnvoice') { const S: any = State.settings; S.trainingVoice = !trnVoiceOn(); if (!S.trainingVoice) { try { if (/Daniel Brandt/.test(Voice.who)) Voice.stop(); } catch (e) { /* no voice */ } } Store.soon(); Sound.tick(); trnBoxUpdate(); return; }
    if (k === 'go') { const s = TR_SPOTS[b.getAttribute('data-k') || '']; if (s && R.free) { Sound.tick(); R.free.x = s.x; R.free.z = s.z; R.free.v = 0; R.look = { yaw: s.yaw, pitch: -0.05 }; } }
  });
  R.key$ = (e: KeyboardEvent) => {
    if (!R.on || !mine()) return; const k = e.key.toLowerCase();
    if (k === 'escape') { e.preventDefault(); e.stopImmediatePropagation(); if (R.overlay) { trComputerClose(); return; } if (aimLocked()) { aimUnlock(); return; } if (R.stress) { gfxStressEnd(true); return; } if (R.game) { trLeaveBuilding(); return; } TestRooms.close(); return; }
    if (R.overlay) return;
    if (/^(w|a|s|d|q|e|arrow\w+|shift)$/.test(k)) { R.keys[k] = true; e.preventDefault(); e.stopImmediatePropagation(); }
  };
  R.ku$ = (e: KeyboardEvent) => { if (R.on) R.keys[e.key.toLowerCase()] = false; };
  window.addEventListener('keydown', R.key$, true); window.addEventListener('keyup', R.ku$, true);
  // the walking pad (phones and tablets)
  const pad = root.querySelector('.walk-pad') as HTMLElement, knob = pad && pad.querySelector('i') as HTMLElement;
  if (pad) {
    let pid = -1, c = [0, 0];
    pad.addEventListener('pointerdown', e => { pid = e.pointerId; pad.setPointerCapture(pid); const r = pad.getBoundingClientRect(); c = [r.left + r.width / 2, r.top + r.height / 2]; e.stopPropagation(); });
    pad.addEventListener('pointermove', e => { if (e.pointerId !== pid) return; const r = pad.getBoundingClientRect(), mx = r.width / 2; let dx = (e.clientX - c[0]) / mx, dy = (e.clientY - c[1]) / mx; const n = Math.hypot(dx, dy); if (n > 1) { dx /= n; dy /= n; } R.stick = [dx, -dy]; if (knob) knob.style.transform = `translate(${dx * mx * 0.6}px, ${dy * mx * 0.6}px)`; });
    const end = () => { pid = -1; R.stick = [0, 0]; if (knob) knob.style.transform = ''; };
    pad.addEventListener('pointerup', end); pad.addEventListener('pointercancel', end);
  }
}

TestRooms.close = function (quiet?: boolean) {
  const R = TestRooms; if (!R.on) return;
  if (R.in && R.in !== 'halls') { const RR = TR_ROOMS[R.in] && TR_ROOMS[R.in](); try { if (RR && RR.on && RR.host) RR.close(true); } catch (e) { /* closed */ } }
  for (const RR of [OfficeRoom, OpsRoom, LoungeRoom]) { try { RR.me = null; RR.meTried = false; RR.guests = []; } catch (e) { /* none */ } }
  R.on = false; R.in = 'halls'; R.host = null; R.hallsUi = null;
  trComputerClose();
  cancelAnimationFrame(R.raf); clearInterval(R.iv);
  window.removeEventListener('keydown', R.key$, true); window.removeEventListener('keyup', R.ku$, true); window.removeEventListener('resize', R.fit);
  document.removeEventListener('mousemove', R.mm$); aimUnlock();
  try { FrameGen.dispose(R.perf); } catch (e) { /* none */ }
  try { exitFreeRenderer(R.ren, R.scene); } catch (e) { /* gone */ }
  try { for (const m of (R.lg && R.lg.mirrors) || []) m.userData.dispose(); } catch (e) { /* gone */ }
  R.ren = null; R.scene = null; R.of = null; R.ops = null; R.lg = null; R.vis = null; R.hits = []; R.doors = []; R.walk = [];
  if (R.root) R.root.remove(); R.root = null;
  if (R.stress) { R.stress = null; }
  if (!quiet && !R.stressMode && !R.game) { try { titleOpen(); } catch (e) { /* the game */ } }
  if (!quiet && R.game) { try { refresh(); } catch (e) { /* the game */ } }
};

/* ---------- in the game: the rooms run inside the building ---------- */
// Each room (your office, Operations, your lounge) keeps all of its own code: sitting, the laptop, the phone, the
// photo, visitors and interviews, the monitor and its screens, the guests and the coffee. In the building it draws
// into the building's view with its own camera (a child of the room, so its own coordinates still work) and puts its
// controls on the building's screen. Walking out of its open door hands you to the corridor; walking in through an
// open door hands you to the room.
const TR_ROOMS: any = { office: () => OfficeRoom, ops: () => OpsRoom, lounge: () => LoungeRoom };
function trRoomA(k: string): any { const R = TestRooms; return k === 'office' ? R.of : k === 'ops' ? R.ops : k === 'lounge' ? R.lg : null; }
/** The building's side of the rooms' hosted mode. */
function trHost(root: HTMLElement, cv: HTMLCanvasElement): any {
  const R = TestRooms, T = THREE, glows: any = {};
  const toWorld = (k: string, x: number, z: number) => { const A = trRoomA(k); const v = new T.Vector3(x, 0, z).applyMatrix4(A.group.matrixWorld); return [v.x, v.z]; };
  const ry = (k: string) => trRoomA(k).group.rotation.y;
  return {
    root, cv,
    get ren() { return R.ren; }, get scene() { return R.scene; },
    cam: (k: string) => trRoomA(k).cam,
    A: (k: string) => trRoomA(k),
    glow: (k: string) => glows[k] || (glows[k] = new AimGlow(R.scene)),
    /** The room's controls onto the building's screen; the building's own go. */
    mount(k: string, html: string) {
      trUnmountUi(); trHallsUiOff();
      const el = document.createElement('div'); el.className = 'tr-room-ui'; el.innerHTML = html; root.appendChild(el);
      root.classList.add('tr-in-room', k === 'office' ? 'of-in' : k === 'ops' ? 'ops3d' : 'lg3d', ...(k === 'lounge' ? ['ops3d', 'hg3d'] : []));
      R.in = k;
      // the door as it is now; you in the room
      const D = R.doors.filter((d: any) => d.k === k)[0], RR = TR_ROOMS[k]();
      if (D) { if (k === 'office') RR.doorT = D.to; else if (k === 'ops') { RR.doorT = D.to; RR.doorK = D.k0; } else { const A = trRoomA(k); A.doorTo = D.to; A.doorK = D.k0; } }
      trMeShow(k, true);
    },
    /** The room has let go: its controls off the screen, the door's state back to the building. */
    unmount(k: string, door: number) {
      trUnmountUi(); root.classList.remove('tr-in-room', 'of-in', 'ops3d', 'lg3d', 'hg3d');
      const D = R.doors.filter((d: any) => d.k === k)[0], A = trRoomA(k);
      if (D) { D.to = door; D.k0 = k === 'office' ? clamp(-(A.doorLeaf ? A.doorLeaf.rotation.y : 0) / 1.5, 0, 1) : k === 'ops' ? clamp((A.door ? A.door.rotation.y : 0) / 1.35, 0, 1) : clamp(A.doorK || 0, 0, 1); }
      if (glows[k]) { try { glows[k].hide(); } catch (e) { /* none */ } }
      trMeShow(k, false);
      if (R.in === k) R.in = 'halls';
    },
    /** In the room's own coordinates: in its doorway? 1 open, −1 shut, 0 not in it. */
    pass(k: string, x: number, z: number): number {
      const D = R.doors.filter((d: any) => d.k === k)[0]; if (!D) return 0; const [wx, wz] = toWorld(k, x, z), p = D.pass;
      if (wx > p[0] && wx < p[2] && wz > p[1] && wz < p[3]) { const RR = TR_ROOMS[k](), open = !D.locked && (k === 'lounge' ? (trRoomA(k).doorK || 0) > 0.55 : k === 'ops' ? (RR.doorK || 0) > 0.55 : -(trRoomA(k).doorLeaf ? trRoomA(k).doorLeaf.rotation.y : 0) > 0.8); return open ? 1 : -1; }
      return 0;
    },
    /** The doorway help from inside a room (its own coordinates in, its own coordinates out). */
    assist(k: string, x: number, z: number, mx: number, mz: number): [number, number] {
      const A = trRoomA(k); if (!A) return [mx, mz]; const g = A.group, [wx, wz] = toWorld(k, x, z), r = g.rotation.y, c = Math.cos(r), s = Math.sin(r);
      const dx = mx * c + mz * s, dz = -mx * s + mz * c, [ax, az] = trDoorAssist(wx, wz, dx, dz);
      return [ax * c - az * s, ax * s + az * c];
    },
    /** Out of the room into the corridor or the concourse? Then the building takes over. */
    out(k: string, x: number, z: number, look: any, v: number): boolean {
      const [wx, wz] = toWorld(k, x, z), inRoom = R.walkOf[k] && R.walkOf[k](wx, wz);
      const halls = R.walk.slice(-2).some((f: any) => f(wx, wz));
      if (inRoom || !halls) return false;
      const yaw = look.yaw + ry(k) + Math.PI;   // the room's way of turning to the building's
      R.free = { x: wx, z: wz, v: v || 0, bob: 0 }; R.look = { yaw, pitch: look.pitch || 0 };
      TR_ROOMS[k]().close(true);
      return true;
    },
    enterAt: null as any,
    leaveAll() { /* a room closing by itself closes the building too */ trLeaveBuilding(); },
    closeAll() { TestRooms.close(true); },
  };
}
function trUnmountUi() {
  const R = TestRooms; if (!R.root) return;
  R.root.querySelectorAll('.tr-room-ui').forEach(e => e.remove());
  if (R.hallsUi && !R.hallsUi.isConnected) { const cv = R.root.querySelector('canvas'); R.root.insertBefore(R.hallsUi, cv ? cv.nextSibling : R.root.firstChild); }
}
/** The corridor's own controls off the screen (a room's go on in their place). */
function trHallsUiOff() { const R = TestRooms; if (!R.root) return; R.hallsUi = R.hallsUi || R.root.querySelector('.tr-halls-ui'); if (R.hallsUi && R.hallsUi.isConnected) R.hallsUi.remove(); }
/** Your own figure: each room has its own, shown only in the room you are in (in its own coordinates). */
function trMeShow(k: string, on: boolean) {
  const RR = TR_ROOMS[k](), me = RR.me || (trRoomA(k) && trRoomA(k).me), A = trRoomA(k);
  if (me && me.g) { if (A && A.group && me.g.parent !== A.group) A.group.add(me.g); me.g.visible = on; }
}
/** Into a room: at the door (walking in), or straight to your chair (from the game's buttons). */
function trEnter(k: string, at: any, inc?: any) {
  const R = TestRooms; if (!trRoomA(k) || !R.host) { if (k !== 'office') trEnter('office', null, inc); return; }
  if (at) { const A = trRoomA(k), inv = new THREE.Matrix4().copy(A.group.matrixWorld).invert(), v = new THREE.Vector3(at.x, 0, at.z).applyMatrix4(inv);
    R.host.enterAt = { x: v.x, z: v.z, yaw: at.yaw - A.group.rotation.y - Math.PI, pitch: at.pitch, v: at.v }; }
  else R.host.enterAt = null;
  try {
    if (k === 'office') OfficeRoom.open(inc || null, R.host);
    else if (k === 'ops') OpsRoom.open(R.host);
    else LoungeRoom.open(R.lgKey, R.host);
  } catch (e) { console.error(e); R.in = 'halls'; trUnmountUi(); toast('That room could not be opened', 'warn'); }
}
/** A frame while you are in a room: the room's own frame (it draws); the other doors keep moving. */
function trRoomFrame(dt: number) {
  const R = TestRooms, k = R.in, RR = TR_ROOMS[k] && TR_ROOMS[k]();
  for (const D of R.doors) if (D.k !== k && D.k0 !== D.to) { D.k0 += Math.sign(D.to - D.k0) * Math.min(Math.abs(D.to - D.k0), dt * (D.slide ? 1.6 : 1.4)); const e = D.k0 * D.k0 * (3 - 2 * D.k0); D.set(e); }
  if (!RR || !RR.on) { R.in = 'halls'; return; }
  const me = RR.me; if (me && me.g && trRoomA(k) && me.g.parent !== trRoomA(k).group) trRoomA(k).group.add(me.g);   // made by the room itself: into the room's coordinates
  if (RR.loading || (RR.overlay && !RR.lapZ && !RR.zoomAnim)) { if (!RR.overlay) R.ren.render(R.scene, trRoomA(k).cam); return; }
  try { if (k === 'office') ofFrame(); else if (k === 'ops') opsFrame(); else lgFrame(); } catch (e) { console.error(e); }
}
/** Leaving the building (from the corridor, or a room asking): its loading screen, then back to the game. */
function trLeaveBuilding(to?: string) {
  const R = TestRooms; if (!R.on || ExitSplash.on) return;
  exitSplash('office', 'Leaving the building', [
    { pct: 30, step: 'Closing the doors…', run: () => TestRooms.close(true) },
    { pct: 55, step: 'Clearing the rooms from memory…', run: exitFreeMemory },
    { pct: 85, step: 'Loading your airline…', run: () => { if (to) { try { roomGoTo(to); } catch (e) { refresh(); } } else refresh(); } },
  ]);
}
/** Should the game's Office, Operations and Lounge buttons open the joined building? (Settings → Graphics.) */
/** Which lounge the building ends in: the one asked for, else your hub's, else any of yours, else a plain lounge at your hub. */
function trLgPick(want?: string): string {
  const ks = lgList().map(l => l.k), hub = company().hub;
  if (want && ks.indexOf(want) >= 0) return want;
  return ks.indexOf(hub) >= 0 ? hub : ks[0] || hub;
}
function trJoined(): boolean { return (State.settings as any).joinedRooms !== false && typeof company === 'function' && !!company(); }
