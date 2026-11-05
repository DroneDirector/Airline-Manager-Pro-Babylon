// Ground vehicles and jet bridges at the gate in the 3D view. Around an airliner standing at its stand, the
// turnaround happens as it does in real life:
//  - a jet bridge to the front left door at big airports (or a stairs truck at smaller ones), with a ground power
//    unit at the nose;
//  - on the right: a belt loader at the forward hold with a baggage tractor and its carts, a catering truck lifted
//    to the rear door, and a fuel truck under the wing;
//  - at push-back a tug at the nose wheel (it moves with the aircraft); everything else drives away and the jet
//    bridge pulls back.
// The vehicles drive in and out (a few seconds each way). Each kind is built here and has its own file name for
// a replacement model (src/graphics/models.ts: vehicles/…, jetways/jet-bridge.glb). Front of every vehicle: −X.

const GV_COL = { white: 0xEDEFF2, yellow: 0xF2B21B, grey: 0x5C636B, dark: 0x22262B, glass: 0x1C2A38, steel: 0xB7BDC4, rubber: 0x16191C, blue: 0x2C6FB8, orange: 0xE8731C };
let _gvMats: any = null;
function gvMats(): any {
  if (_gvMats) return _gvMats;
  const T = THREE, m = (c: number, r = 0.55, mt = 0.15) => new T.MeshStandardMaterial({ color: c, roughness: r, metalness: mt });
  _gvMats = { white: m(GV_COL.white, 0.45), yellow: m(GV_COL.yellow, 0.5), grey: m(GV_COL.grey), dark: m(GV_COL.dark, 0.8), glass: m(GV_COL.glass, 0.1, 0.6), steel: m(GV_COL.steel, 0.3, 0.8), rubber: m(GV_COL.rubber, 0.9, 0), blue: m(GV_COL.blue, 0.45), orange: m(GV_COL.orange, 0.5), beacon: new T.MeshBasicMaterial({ color: 0xFFA020 }) };
  return _gvMats;
}
/** A box, a wheel and a beacon, for building the vehicles. */
function gvBox(g: any, w: number, h: number, d: number, mat: any, x: number, y: number, z: number): any { const T = THREE, b = new T.Mesh(new T.BoxGeometry(w, h, d), mat); b.position.set(x, y, z); b.castShadow = true; b.receiveShadow = true; g.add(b); return b; }
function gvWheels(g: any, xs: number[], track: number, r: number) {
  const T = THREE, M = gvMats(), seg = hiQ() ? 20 : 10;
  for (const x of xs) for (const s of [-1, 1]) { const w = new T.Mesh(new T.CylinderGeometry(r, r, r * 0.7, seg), M.rubber); w.rotation.x = Math.PI / 2; w.position.set(x, r, s * track / 2); w.castShadow = true; g.add(w); }
}
function gvBeacon(g: any, x: number, y: number) { const T = THREE, b = new T.Mesh(new T.SphereGeometry(0.12, 8, 6), gvMats().beacon); b.position.set(x, y, 0); b.userData.keep = true; b.userData.beacon = true; g.add(b); }

/** The vehicles (front towards −X, standing on y = 0). */
const GV_BUILD: { [k: string]: () => any } = {
  'fuel-truck': () => { const g = new THREE.Group(), M = gvMats(); gvBox(g, 2.4, 2.3, 2.5, M.white, -3.6, 1.55, 0); gvBox(g, 0.1, 1.0, 2.2, M.glass, -4.82, 2.0, 0); gvBox(g, 7.0, 0.4, 2.3, M.dark, 0.6, 0.75, 0);
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 6.2, hiQ() ? 28 : 14), M.white); tank.rotation.z = Math.PI / 2; tank.position.set(1.0, 2.1, 0); tank.castShadow = true; g.add(tank);
    gvBox(g, 6.2, 0.12, 2.36, M.yellow, 1.0, 1.6, 0); gvWheels(g, [-3.4, 1.5, 3.2], 2.1, 0.55); gvBeacon(g, -3.6, 2.8); return g; },
  'catering-truck': () => { const g = new THREE.Group(), M = gvMats(); gvBox(g, 2.2, 2.2, 2.4, M.white, -3.3, 1.5, 0); gvBox(g, 0.1, 1.0, 2.1, M.glass, -4.42, 1.95, 0); gvBox(g, 6.4, 0.4, 2.3, M.dark, 0.6, 0.75, 0);
    const box = gvBox(g, 4.6, 2.5, 2.4, M.white, 1.2, 1.45 + 2.8, 0); box.userData.lift = 2.8; gvBox(g, 4.6, 0.18, 2.42, M.blue, 1.2, 0.3 + 2.8 + 0.15, 0).userData.lift = 2.8;
    gvBox(g, 0.12, 2.8, 0.12, M.steel, -0.4, 2.2, 0.9); gvBox(g, 0.12, 2.8, 0.12, M.steel, 2.8, 2.2, -0.9); gvWheels(g, [-3.2, 2.4], 2.0, 0.5); gvBeacon(g, -3.3, 2.7); return g; },
  'belt-loader': () => { const g = new THREE.Group(), M = gvMats(); gvBox(g, 6.5, 0.6, 1.8, M.yellow, 0, 0.75, 0);
    const belt = gvBox(g, 7.2, 0.18, 1.0, M.dark, -0.6, 2.0, 0); belt.rotation.z = 0.36; gvBox(g, 1.3, 1.4, 1.1, M.yellow, 2.2, 1.6, 0.4); gvWheels(g, [-2.2, 2.2], 1.6, 0.35); gvBeacon(g, 2.2, 2.4); return g; },
  'baggage-tractor': () => { const g = new THREE.Group(), M = gvMats(); gvBox(g, 2.8, 0.9, 1.5, M.orange, 0, 0.85, 0); gvBox(g, 0.9, 1.0, 1.3, M.dark, 0.4, 1.8, 0); gvBox(g, 0.05, 0.8, 1.2, M.glass, -0.08, 1.85, 0); gvWheels(g, [-0.9, 0.9], 1.4, 0.38); gvBeacon(g, 0.4, 2.4); return g; },
  'baggage-cart': () => { const g = new THREE.Group(), M = gvMats(); gvBox(g, 3.0, 0.15, 1.5, M.grey, 0, 0.5, 0); gvBox(g, 3.0, 1.4, 0.05, M.steel, 0, 1.25, 0.72); gvBox(g, 3.0, 0.05, 1.5, M.grey, 0, 1.95, 0);
    for (let i = 0; i < 4; i++) gvBox(g, 0.55, 0.42 + (i % 2) * 0.1, 0.8, [M.blue, M.dark, M.orange, M.grey][i], -1.1 + i * 0.7, 0.8, -0.1); gvWheels(g, [-1.1, 1.1], 1.3, 0.22); return g; },
  'pushback-tug': () => { const g = new THREE.Group(), M = gvMats(); gvBox(g, 5.2, 1.1, 2.6, M.yellow, 0, 0.95, 0); gvBox(g, 1.2, 1.0, 1.1, M.dark, 1.6, 2.0, 0.6); gvBox(g, 0.05, 0.8, 1.0, M.glass, 0.98, 2.0, 0.6); gvWheels(g, [-1.6, 1.6], 2.4, 0.55); gvBeacon(g, 1.6, 2.6); return g; },
  'passenger-stairs': () => { const g = new THREE.Group(), M = gvMats(); gvBox(g, 2.0, 1.6, 2.2, M.white, -3.6, 1.2, 0); gvBox(g, 6.0, 0.4, 2.0, M.dark, 0.2, 0.7, 0);
    const st = gvBox(g, 5.4, 0.25, 1.5, M.steel, 0.9, 2.5, 0); st.rotation.z = -0.62; gvBox(g, 1.6, 0.15, 1.6, M.steel, -1.4, 4.1, 0); gvBox(g, 5.4, 0.9, 0.05, M.white, 0.9, 3.0, 0.78).rotation.z = -0.62; gvBox(g, 5.4, 0.9, 0.05, M.white, 0.9, 3.0, -0.78).rotation.z = -0.62;
    gvWheels(g, [-3.0, 2.4], 1.9, 0.45); return g; },
  'ground-power-unit': () => { const g = new THREE.Group(), M = gvMats(); gvBox(g, 2.2, 1.3, 1.3, M.yellow, 0, 0.95, 0); gvBox(g, 0.4, 0.6, 1.0, M.dark, -1.2, 0.7, 0); gvWheels(g, [-0.7, 0.7], 1.2, 0.3); return g; },
  'de-icing-truck': () => { const g = new THREE.Group(), M = gvMats(); gvBox(g, 2.3, 2.3, 2.5, M.orange, -3.6, 1.55, 0); gvBox(g, 0.1, 1.0, 2.2, M.glass, -4.77, 2.0, 0); gvBox(g, 5.8, 1.6, 2.4, M.orange, 0.9, 1.6, 0);
    const boom = gvBox(g, 5.4, 0.35, 0.35, M.steel, 0.4, 3.6, 0); boom.rotation.z = -0.5; gvBox(g, 1.3, 1.1, 1.2, M.white, -1.9, 5.0, 0); gvWheels(g, [-3.4, 1.4, 3.0], 2.1, 0.55); gvBeacon(g, -3.6, 2.8); return g; },
};
function gvMake(kind: string): any {
  const g = (GV_BUILD[kind] || GV_BUILD['ground-power-unit'])(); g.userData.kind = kind;
  try { Models.swap(g, 'vehicles/' + kind + '.glb'); } catch (e) { /* the app's own */ }
  return g;
}
/** A jet bridge from its rotunda (at the origin) out to its cab at the door (along −X, `len` metres), at door height. */
function gvJetBridge(len: number, doorY: number): any {
  const T = THREE, g = new T.Group(), M = gvMats();
  const col = new T.Mesh(new T.CylinderGeometry(1.4, 1.4, doorY, hiQ() ? 28 : 14), M.grey); col.position.set(0, doorY / 2, 0); col.castShadow = true; g.add(col);
  const rot = new T.Mesh(new T.CylinderGeometry(2.0, 2.0, 3.0, hiQ() ? 28 : 14), M.white); rot.position.set(0, doorY + 0.4, 0); rot.castShadow = true; g.add(rot);
  const arm = new T.Group(); arm.position.set(0, doorY + 0.4, 0); g.add(arm);
  const tun = gvBox(arm, 1, 2.9, 2.8, M.white, 0, 0, 0); tun.userData.tunnel = true;
  for (const z of [-1.41, 1.41]) { const wn = gvBox(arm, 1, 0.5, 0.04, M.glass, 0, 0.55, z); wn.userData.tunnel = true; }
  const cab = new T.Group(); arm.add(cab); gvBox(cab, 3.2, 3.1, 3.6, M.white, 0, 0, 0); gvBox(cab, 0.6, 2.6, 3.2, M.dark, -1.8, -0.1, 0);
  const leg = new T.Group(); arm.add(leg); gvBox(leg, 0.5, 1, 0.5, M.steel, 0, 0, -1.0); gvBox(leg, 0.5, 1, 0.5, M.steel, 0, 0, 1.0); gvWheels(leg, [0], 2.4, 0.5);
  g.userData.set = (L: number) => {
    // the tunnel telescopes out to the cab; the wheeled leg stands under its outer end
    L = Math.max(6, L); cab.position.set(-L, 0, 0);
    arm.children.forEach((c: any) => { if (c.userData.tunnel) { c.scale.x = L - 1.6; c.position.x = -(L - 1.6) / 2 - 0.8; } });
    leg.position.set(-L * 0.72, -(doorY + 0.4), 0); leg.children.forEach((c: any) => { if (c.geometry && c.geometry.type === 'BoxGeometry') { c.scale.y = doorY - 0.2; c.position.y = (doorY - 0.2) / 2 + 0.5; } });
  };
  g.userData.set(len); g.userData.doorY = doorY;
  try { Models.swap(g, 'jetways/jet-bridge.glb'); } catch (e) { /* the app's own */ }
  return g;
}

/** Where things go round an aircraft, in its model's own space (x from the nose aft, y up, z: + left, − right). */
function gvLayout(P: any): any {
  const s = shapeOf(P.type), body = P.model.userData.body, bx = body ? body.position.x : -s.L / 2;
  if (!P.gvGround) { body.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(body); const inv = new THREE.Matrix4().copy(P.model.matrixWorld).invert(); b.applyMatrix4(inv); P.gvGround = b.min.y; }
  const y0 = P.gvGround, half = s.w / 2, d0 = s.doors[0] || s.L * 0.12, d1 = s.doors[s.doors.length - 1] || s.L * 0.8, wx = s.wing.x + s.wing.root * 0.55;
  const at = (x: number, z: number, hdg: number) => ({ p: new THREE.Vector3(bx + x, y0, z), h: hdg });
  return {
    y0, doorY: y0 + s.ground + s.h * 0.55, s,
    bridge: at(d0 - 10, half + 11, 0), bridgeDoor: new THREE.Vector3(bx + d0, 0, half + 0.6),
    stairs: at(d0 + 0.6, half + 3.2, -Math.PI / 2),
    gpu: at(3, half + 2.4, 0),
    belt: at(Math.max(d0 + 3.5, s.L * 0.21), -(half + 3.3), -1.3),
    tractor: at(Math.max(d0 + 3.5, s.L * 0.21) - 11, -(half + 9), 0), cart1: at(Math.max(d0 + 3.5, s.L * 0.21) - 7.4, -(half + 9), 0), cart2: at(Math.max(d0 + 3.5, s.L * 0.21) - 4, -(half + 9), 0),
    catering: at(d1, -(half + 3.7), -Math.PI / 2),
    fuel: at(wx, -(half + s.span * 0.18 + 2), 0),
    tug: at(-3.4, 0, Math.PI),
  };
}
/** Each frame for an aircraft: what is needed now, driven in and out. */
function v3dGroundStep(P: any, g: any, w: any, now: number) {
  const ph = String(P.ph || '').toLowerCase(), S: any = State.settings;
  const t = acType(P.type), big = t && (t.cls === 'airliner' || t.cls === 'widebody' || t.cls === 'regional');
  const atGate = big && w.onGround && (P.kt || 0) < 3 && /gate|board|parked|deboard|doors|stand|turnaround|clean|cater|refuel/.test(ph);
  const push = big && w.onGround && /push/.test(ph);
  const G = P.gv || (P.gv = { items: {} as any });
  if (S.v3dGroundVeh === false || (!atGate && !push && !Object.keys(G.items).length)) { gvClear(P); return; }
  const L = gvLayout(P), bigApt = !!V3d.icao && aptSize(V3d.icao) === 2 && REMOTE_AIRPORTS.indexOf(V3d.icao) < 0 && !!t && t.cls !== 'regional';
  const want: { [k: string]: any } = {};
  if (atGate) {
    if (bigApt) want.bridge = L.bridge; else want['passenger-stairs'] = L.stairs;
    want['ground-power-unit'] = L.gpu; want['belt-loader'] = L.belt; want['baggage-tractor'] = L.tractor; want['baggage-cart'] = L.cart1; want['baggage-cart#2'] = L.cart2;
    if (!/doors|push/.test(ph)) { want['catering-truck'] = L.catering; want['fuel-truck'] = L.fuel; }
    try { if (V3d.icao && taIcing(V3d.icao) && /board|doors/.test(ph)) want['de-icing-truck'] = { p: L.fuel.p.clone().add(new THREE.Vector3(0, 0, -6)), h: 0.4 }; } catch (e) { /* dry */ }
  }
  if (push) { want['pushback-tug'] = L.tug; if (bigApt) want.bridge = L.bridge; }
  const T = THREE, dt = 1 / 30;
  for (const k of Object.keys(want)) {
    let it = G.items[k];
    if (!it) {
      const kind = k.split('#')[0];
      const obj = kind === 'bridge' ? gvJetBridge(14, L.doorY - L.y0) : gvMake(kind);
      P.model.add(obj); it = G.items[k] = { obj, k: 0, out: false };
    }
    it.out = false; it.at = want[k];
  }
  for (const k of Object.keys(G.items)) {
    const it = G.items[k]; if (!want[k]) it.out = true;
    it.k = clamp(it.k + (it.out ? -dt / 5 : dt / 6), 0, 1);
    if (it.out && it.k <= 0) { P.model.remove(it.obj); delete G.items[k]; continue; }
    const A = it.at, e = it.k * it.k * (3 - 2 * it.k);
    if (k === 'bridge') {
      // the rotunda stays; the tunnel reaches out to the door and pulls back again
      it.obj.position.copy(A.p); it.obj.rotation.y = 0;
      const toDoor = L.bridgeDoor.clone().sub(A.p); toDoor.y = 0; const full = toDoor.length() - 1.6;
      it.obj.rotation.y = Math.atan2(toDoor.z, -toDoor.x);
      it.obj.userData.set && it.obj.userData.set(6 + (full - 6) * (push ? 0 : e));
      continue;
    }
    // vehicles drive in from (and out to) the side, away from the aircraft
    const away = new T.Vector3(0, 0, A.p.z >= 0 ? 1 : -1).multiplyScalar(30 * (1 - e)).add(new T.Vector3(18 * (1 - e), 0, 0));
    it.obj.position.copy(A.p).add(away); it.obj.rotation.y = A.h;
    if (k === 'catering-truck') it.obj.children.forEach((c: any) => { if (c.userData.lift) c.position.y = c.userData.base == null ? (c.userData.base = c.position.y) : c.userData.base - c.userData.lift * (1 - e) + (L.doorY - L.y0 - 4.3) * e * 0.4; });
    if (now % 1000 < 500) it.obj.children.forEach((c: any) => { if (c.userData.beacon) c.visible = true; }); else it.obj.children.forEach((c: any) => { if (c.userData.beacon) c.visible = false; });
  }
}
function gvClear(P: any) { const G = P.gv; if (!G) return; for (const k of Object.keys(G.items)) P.model.remove(G.items[k].obj); G.items = {}; }
