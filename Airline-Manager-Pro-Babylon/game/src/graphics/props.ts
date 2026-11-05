// Furniture and fittings shared by the rooms (lounges, your office, the Operations office, the hangars), built by the
// app. Each one is a standalone object with its own file name in www/models/props/ (see www/models/README.md): put a
// .glb file with that name there and it is used instead, everywhere that piece stands. Where there are several kinds
// of the same thing they are numbered: plant-1, plant-2, plant-3, sofa-1, sofa-2, sofa-3 and so on.
//  - Front towards +Z (where you sit, or the side you face it from), standing on the floor at 0, centred, in metres.
//  - The detail follows the graphics settings: q 0 (light), 1 (normal), 2 (high, the PC).
//  - Each is built of as few meshes as it can (one per material), so a room full of them stays quick.

const PROP_DIR = 'props/';
type PropQ = 0 | 1 | 2 | number;

/** Collects geometry by material, then makes one mesh per material. */
class PropKit {
  parts = new Map<any, any[]>();
  put(geo: any, mat: any, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    const T = THREE, m = new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz, 'YXZ')), new T.Vector3(sx, sy, sz));
    this.putM(geo, mat, m);
  }
  putM(geo: any, mat: any, m: any) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone(); g.applyMatrix4(m);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
    (this.parts.get(mat) || this.parts.set(mat, []).get(mat)).push(g);
  }
  /** One mesh per material, in a group. */
  make(name: string, shadow: boolean): any {
    const T = THREE, g = new T.Group(); g.name = name;
    this.parts.forEach((list, mat) => {
      let n = 0; for (const p of list) n += p.attributes.position.count;
      const P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2); let o = 0;
      for (const p of list) { P.set(p.attributes.position.array, o * 3); N.set(p.attributes.normal.array, o * 3); U.set(p.attributes.uv.array, o * 2); o += p.attributes.position.count; p.dispose(); }
      const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(P, 3)); geo.setAttribute('normal', new T.BufferAttribute(N, 3)); geo.setAttribute('uv', new T.BufferAttribute(U, 2));
      geo.computeBoundingSphere();
      const m = new T.Mesh(geo, mat); m.castShadow = shadow && !mat.transparent; m.receiveShadow = true; g.add(m);
    });
    return g;
  }
}

/** A box with rounded edges, centred; `puff` swells the top (a cushion), `puffZ` the front (a back cushion). */
function prRound(w: number, h: number, d: number, r: number, seg: number, puff = 0, puffZ = 0): any {
  const T = THREE; r = Math.max(0.002, Math.min(r, w / 2 - 0.002, h / 2 - 0.002, d / 2 - 0.002));
  const iw = w - 2 * r, ih = h - 2 * r, c = Math.max(0.0005, Math.min(r, iw / 2, ih / 2) * 0.9);
  const s = new T.Shape(), x0 = -iw / 2, x1 = iw / 2, y0 = -ih / 2, y1 = ih / 2;
  s.moveTo(x0 + c, y0); s.lineTo(x1 - c, y0); s.quadraticCurveTo(x1, y0, x1, y0 + c); s.lineTo(x1, y1 - c); s.quadraticCurveTo(x1, y1, x1 - c, y1);
  s.lineTo(x0 + c, y1); s.quadraticCurveTo(x0, y1, x0, y1 - c); s.lineTo(x0, y0 + c); s.quadraticCurveTo(x0, y0, x0 + c, y0);
  const g = new T.ExtrudeGeometry(s, { depth: Math.max(0.001, d - 2 * r), bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: seg, curveSegments: Math.max(2, seg) });
  g.translate(0, 0, -(d - 2 * r) / 2);
  if (puff || puffZ) {
    const p = g.attributes.position, hw = w / 2, hh = h / 2, hd = d / 2;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), fx = Math.max(0, 1 - (x / hw) ** 2);
      if (puff && y > 0) p.setY(i, y + puff * fx * Math.max(0, 1 - (z / hd) ** 2) * (y / hh));
      if (puffZ && z > 0) p.setZ(i, z + puffZ * fx * Math.max(0, 1 - (y / hh) ** 2) * (z / hd)); }
    g.computeVertexNormals();
  }
  // texture coordinates in metres (so the weave or the grain is the same size on every part)
  const p = g.attributes.position, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = p.getX(i) + p.getZ(i) * 0.7; uv[i * 2 + 1] = p.getY(i) + p.getZ(i) * 0.3; }
  g.setAttribute('uv', new T.BufferAttribute(uv, 2));
  return g;
}
/** A leaf (or a leaflet) as a ribbon along +Y, its face towards +Z: `wf(t)` the half-width along it, `fold` the V of
 *  its midrib, `curl` how far it bends over towards the front, `twist` a turn along it. */
function prLeaf(len: number, wf: (t: number) => number, n: number, fold: number, curl: number, twist = 0, droop = 0): any {
  const T = THREE, P: number[] = [], U: number[] = [], I: number[] = [];
  let y = 0, z = 0;
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = curl * t * t + droop * t; if (i) { y += Math.cos(a) * len / n; z += Math.sin(a) * len / n; }
    const w = wf(t), tw = twist * t;
    for (let j = -1; j <= 1; j++) { const x = j * w, fz = (j === 0 ? fold * w : 0); P.push(x * Math.cos(tw), y, z + fz + x * Math.sin(tw)); U.push((j + 1) / 2, t); }
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < 2; j++) { const a = i * 3 + j, b = a + 1, c = a + 3, d = a + 4; I.push(a, b, d, a, d, c); }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(U, 2)); g.setIndex(I); g.computeVertexNormals();
  return g;
}

/* ---------- textures (drawn once) ---------- */
const PR_TEX: any = {};
function prTex(key: string, draw: (x: CanvasRenderingContext2D, w: number, h: number) => void, w = 256, h = 256, rep = 1): any {
  if (PR_TEX[key]) return PR_TEX[key];
  const [c, x] = ctCanvas(w, h); draw(x, w, h); return (PR_TEX[key] = ctTex(c, rep, rep));
}
const prRng = (s: number) => ctRng(s);
/** A woven upholstery fabric: fine threads both ways over a little colour noise. */
function prWeave(col: string): any {
  return prTex('weave' + col, (x, w, h) => {
    x.fillStyle = col; x.fillRect(0, 0, w, h); const r = prRng(7);
    for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${0.03 + r() * 0.05})`; x.fillRect(r() * w, r() * h, 1 + r() * 2, 1); }
    for (let i = 0; i < w; i += 2) { x.fillStyle = 'rgba(0,0,0,0.07)'; x.fillRect(i, 0, 1, h); x.fillRect(0, i, w, 1); }
  }, 256, 256, 6);
}
/** A soft grain for leather. */
function prHide(col: string): any {
  return prTex('hide' + col, (x, w, h) => {
    x.fillStyle = col; x.fillRect(0, 0, w, h); const r = prRng(11);
    for (let i = 0; i < 14000; i++) { const a = r(); x.fillStyle = `rgba(${a < 0.5 ? '255,240,225' : '20,10,5'},${0.03 + r() * 0.05})`; x.beginPath(); x.arc(r() * w, r() * h, 0.6 + r() * 1.6, 0, 6.3); x.fill(); }
    x.strokeStyle = 'rgba(0,0,0,0.06)'; for (let i = 0; i < 60; i++) { x.beginPath(); const a = r() * w, b = r() * h; x.moveTo(a, b); x.bezierCurveTo(a + 20, b + r() * 20, a + 40, b - r() * 20, a + 60, b); x.stroke(); }
  }, 256, 256, 4);
}
/** A leaf: deep green with a lighter midrib and side veins, darker at the edges. */
function prLeafTex(key: string, base: string, rib: string, veins: number, edge?: string): any {
  return prTex(key, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, edge || 'rgba(0,0,0,0)'); g.addColorStop(0.5, base); g.addColorStop(1, edge || 'rgba(0,0,0,0)');
    x.fillStyle = base; x.fillRect(0, 0, w, h); if (edge) { x.fillStyle = g; x.fillRect(0, 0, w, h); }
    const sh = x.createLinearGradient(0, 0, w, 0); sh.addColorStop(0, 'rgba(0,0,0,0.25)'); sh.addColorStop(0.45, 'rgba(255,255,255,0.06)'); sh.addColorStop(0.55, 'rgba(255,255,255,0.06)'); sh.addColorStop(1, 'rgba(0,0,0,0.25)'); x.fillStyle = sh; x.fillRect(0, 0, w, h);
    x.strokeStyle = rib; x.lineWidth = w * 0.035; x.beginPath(); x.moveTo(w / 2, 0); x.lineTo(w / 2, h); x.stroke();
    x.lineWidth = w * 0.012; x.globalAlpha = 0.55;
    for (let i = 1; i <= veins; i++) { const y = h * i / (veins + 1); for (const s of [-1, 1]) { x.beginPath(); x.moveTo(w / 2, y - h * 0.02); x.quadraticCurveTo(w / 2 + s * w * 0.25, y + h * 0.03, w / 2 + s * w * 0.48, y + h * 0.08); x.stroke(); } }
    x.globalAlpha = 1;
  }, 128, 256, 1);
}

/* ---------- materials, shared ---------- */
const PR_MAT: any = {};
function prMat(key: string, make: () => any): any { return PR_MAT[key] || (PR_MAT[key] = make()); }
function prM(o: any): any { return new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.6 }, o)); }
function prP(o: any): any { return new THREE.MeshPhysicalMaterial(Object.assign({ roughness: 0.6 }, o)); }

/* ---------- the props ---------- */
/** Props already built, by name, detail and options: a second one of the same shares its shapes and materials
 *  (nothing is built or held twice; a room full of the same chair costs the memory of one). */
const PR_BUILT: { [k: string]: any } = {};
const Props = {
  /** Build one prop (front +Z, on the floor, centred). The same one again is a copy sharing its shapes. */
  make(name: string, q: PropQ = 1, o: any = {}): any {
    const f = (PROP_BUILD as any)[name]; if (!f) return new THREE.Group();
    const key = name === 'room-sign' ? '' : name + '|' + q + '|' + JSON.stringify(o);
    if (key && PR_BUILT[key]) { const c = PR_BUILT[key].clone(); c.userData = Object.assign({}, PR_BUILT[key].userData); return c; }
    const g = f(q, o); g.name = name; g.userData.prop = name;
    if (key) PR_BUILT[key] = g;
    return key ? this.make(name, q, o) : g;
  },
  /** Build it, stand it in `parent` at x, z (y), turned ry, and use the file in its place if there is one. */
  place(parent: any, name: string, x: number, z: number, ry = 0, q: PropQ = 1, o: any = {}, y = 0): any {
    const g = this.make(name, q, o); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g);
    try { Models.swap(g, PROP_DIR + name + '.glb', false); } catch (e) { /* the app's own */ }
    return g;
  },
  /** Many of the same prop (a row of seats, a lounge full of armchairs) drawn together: each of its parts is drawn
   *  once for all of them (one draw call per material, not one per chair), which phones and tablets feel most. With
   *  a model file in its place, each is placed on its own so the file is used. at: [x, z, ry, y?] each. */
  placeMany(parent: any, name: string, at: number[][], q: PropQ = 1, o: any = {}): any {
    const T = THREE;
    if (!at.length) return new T.Group();
    if (Models.has(PROP_DIR + name + '.glb') || at.length < 2) { const g = new T.Group(); g.name = name + '-set'; parent.add(g); for (const p of at) this.place(g, name, p[0], p[1], p[2] || 0, q, o, p[3] || 0); return g; }
    const tpl = this.make(name, q, o), g = new T.Group(); g.name = name + '-set'; g.userData.prop = name; g.userData.many = at.length; parent.add(g);
    tpl.updateMatrixWorld(true);
    const m4 = new T.Matrix4(), Q = new T.Quaternion(), P = new T.Vector3(), S = new T.Vector3(1, 1, 1), Y = new T.Vector3(0, 1, 0);
    tpl.traverse((mesh: any) => {
      if (!mesh.isMesh) return;
      const im = new T.InstancedMesh(mesh.geometry, mesh.material, at.length); im.castShadow = mesh.castShadow; im.receiveShadow = mesh.receiveShadow;
      at.forEach((p, i) => { m4.compose(P.set(p[0], p[3] || 0, p[1]), Q.setFromAxisAngle(Y, p[2] || 0), S); m4.multiply(mesh.matrixWorld); im.setMatrixAt(i, m4); });
      im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); g.add(im);
    });
    return g;
  },
};

/* --- plants --- */
function prPot(kit: PropKit, kind: number, q: PropQ): number {
  const T = THREE, seg = q >= 2 ? 48 : q >= 1 ? 32 : 20;
  const V = (a: number[][]) => a.map(p => new T.Vector2(p[0], p[1]));
  const soil = prMat('soil', () => prM({ color: 0x3B2A1E, roughness: 1, map: prTex('soil', (x, w, h) => { x.fillStyle = '#3B2A1E'; x.fillRect(0, 0, w, h); const r = prRng(3); for (let i = 0; i < 3000; i++) { x.fillStyle = `rgba(${r() < 0.3 ? '160,140,120' : '15,10,6'},${0.2 + r() * 0.4})`; x.beginPath(); x.arc(r() * w, r() * h, 0.5 + r() * 2, 0, 6.3); x.fill(); } }, 128, 128, 2) }));
  if (kind === 1) {   // a glazed ceramic pot: a rounded belly, a rolled rim
    const glaze = prMat('glaze-cream', () => prP({ color: 0xEDE6DA, roughness: 0.18, clearcoat: q >= 2 ? 1 : 0.6, clearcoatRoughness: 0.1 }));
    kit.put(new T.LatheGeometry(V([[0, 0], [0.13, 0], [0.155, 0.012], [0.19, 0.08], [0.215, 0.2], [0.218, 0.32], [0.208, 0.39], [0.218, 0.405], [0.226, 0.42], [0.22, 0.435], [0.2, 0.432], [0.196, 0.4]]), seg), glaze);
    kit.put(new T.CircleGeometry(0.198, seg), soil, 0, 0.395, 0, -Math.PI / 2);
    return 0.395;
  }
  if (kind === 2) {   // a tall square planter in dark fibre stone
    const stone = prMat('planter-dark', () => prM({ color: 0x3A3D41, roughness: 0.85, flatShading: true, map: prTex('fibre', (x, w, h) => { x.fillStyle = '#3A3D41'; x.fillRect(0, 0, w, h); const r = prRng(9); for (let i = 0; i < 5000; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${0.04 + r() * 0.06})`; x.fillRect(r() * w, r() * h, 1, 1); } }, 128, 128, 3) }));
    const g = new T.LatheGeometry(V([[0, 0], [0.24, 0], [0.24, 0.02], [0.3, 0.6], [0.3, 0.62], [0.27, 0.62], [0.27, 0.58]]), 4); g.rotateY(Math.PI / 4);
    kit.put(g, stone);
    kit.put(new T.PlaneGeometry(0.38, 0.38), soil, 0, 0.585, 0, -Math.PI / 2);
    return 0.585;
  }
  // a low concrete bowl
  const conc = prMat('bowl-concrete', () => prM({ color: 0xA9A69F, roughness: 0.9, map: prTex('conc', (x, w, h) => { x.fillStyle = '#A9A69F'; x.fillRect(0, 0, w, h); const r = prRng(13); for (let i = 0; i < 4000; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '40,40,40'},${0.04 + r() * 0.08})`; x.beginPath(); x.arc(r() * w, r() * h, r() * 1.8, 0, 6.3); x.fill(); } }, 128, 128, 2) }));
  kit.put(new T.LatheGeometry(V([[0, 0], [0.17, 0], [0.2, 0.02], [0.26, 0.12], [0.28, 0.24], [0.28, 0.255], [0.255, 0.255], [0.25, 0.23]]), seg), conc);
  kit.put(new T.CircleGeometry(0.252, seg), soil, 0, 0.228, 0, -Math.PI / 2);
  return 0.228;
}
function prPlant(kind: number, q: PropQ, seed = 1): any {
  const T = THREE, kit = new PropKit(), r = prRng(seed * 7 + kind), top = prPot(kit, kind, q);
  const stemM = prMat('stem', () => prM({ color: 0x5A4632, roughness: 0.85 }));
  if (kind === 1) {   // fiddle-leaf fig: a trunk with a few branches, big violin-shaped glossy leaves
    const leafM = prMat('leaf-fig', () => prM({ map: prLeafTex('leaf-fig', '#2E5A26', 'rgba(170,200,120,0.75)', 7), roughness: 0.42, side: T.DoubleSide }));
    const trunk = new T.CatmullRomCurve3([new T.Vector3(0, top - 0.02, 0), new T.Vector3(0.02, top + 0.4, 0.01), new T.Vector3(-0.015, top + 0.8, -0.01), new T.Vector3(0.01, top + 1.15, 0)]);
    kit.put(new T.TubeGeometry(trunk, 12, 0.022, q >= 1 ? 8 : 5, false), stemM);
    const stems: any[] = [trunk];
    for (let b = 0; b < 3; b++) { const a = b * 2.1 + r(), y = top + 0.55 + b * 0.18, L = 0.28 + r() * 0.12;
      const c = new T.CatmullRomCurve3([new T.Vector3(0, y, 0), new T.Vector3(Math.cos(a) * L * 0.5, y + L * 0.5, Math.sin(a) * L * 0.5), new T.Vector3(Math.cos(a) * L, y + L * 0.95, Math.sin(a) * L)]);
      kit.put(new T.TubeGeometry(c, 6, 0.012, q >= 1 ? 6 : 4, false), stemM); stems.push(c); }
    const n = q >= 2 ? 52 : q >= 1 ? 36 : 22;
    const wf = (t: number) => 0.105 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.02)), 0.75) * (1 - 0.22 * Math.exp(-(((t - 0.45) / 0.1) ** 2))) * (0.55 + 0.45 * t);
    const leaf = prLeaf(0.34, wf, q >= 1 ? 8 : 5, 0.25, -0.5, 0, 0);
    for (let i = 0; i < n; i++) {
      const c = stems[i % stems.length], t = c === trunk ? 0.35 + r() * 0.65 : 0.3 + r() * 0.7, p = c.getPointAt(t);
      const s = 0.75 + r() * 0.5, az = r() * 6.283, pitch = 0.6 + r() * 0.8;
      kit.put(leaf, leafM, p.x, p.y, p.z, pitch, az, (r() - 0.5) * 0.6, s, s, s);
    }
    // a few young leaves at the very top, upright
    for (let i = 0; i < 4; i++) { const p = trunk.getPointAt(1); kit.put(leaf, leafM, p.x, p.y, p.z, 0.25 + r() * 0.2, i * 1.6, 0, 0.6, 0.6, 0.6); }
  } else if (kind === 2) {   // kentia palm: arching fronds of many slim leaflets
    const leafM = prMat('leaf-palm', () => prM({ map: prLeafTex('leaf-palm', '#3D6B2C', 'rgba(150,180,90,0.6)', 0), roughness: 0.55, side: T.DoubleSide }));
    const nf = q >= 2 ? 9 : q >= 1 ? 7 : 5, pairs = q >= 2 ? 22 : q >= 1 ? 17 : 12;
    const leaflet = prLeaf(0.36, t => 0.013 * Math.sin(Math.PI * Math.min(1, t * 1.05)) + 0.002, 4, 0.5, 0.25, 0, 0.6);
    for (let f = 0; f < nf; f++) {
      const az = f / nf * 6.283 + r() * 0.4, reach = 0.55 + r() * 0.3, up = 0.9 + r() * 0.5, d = new T.Vector3(Math.cos(az), 0, Math.sin(az));
      const c = new T.CatmullRomCurve3([new T.Vector3(0, top, 0), d.clone().multiplyScalar(reach * 0.2).setY(top + up * 0.6), d.clone().multiplyScalar(reach * 0.65).setY(top + up), d.clone().multiplyScalar(reach * 1.1).setY(top + up * 0.75)]);
      kit.put(new T.TubeGeometry(c, 10, 0.008, 4, false), stemM);
      for (let k = 0; k < pairs; k++) {
        const t = 0.3 + 0.68 * k / pairs, p = c.getPointAt(t), tan = c.getTangentAt(t), sc = 0.45 + Math.sin(Math.PI * (k + 1) / (pairs + 1)) * 0.65;
        const ya = Math.atan2(tan.x, tan.z);
        for (const s of [-1, 1]) kit.put(leaflet, leafM, p.x, p.y, p.z, 1.15 + r() * 0.2, ya + s * 1.1, s * 0.5, sc, sc, sc);
      }
    }
  } else {   // snake plant: upright sword leaves with yellow margins
    const leafM = prMat('leaf-snake', () => prM({ roughness: 0.5, side: T.DoubleSide, map: prTex('leaf-snake', (x, w, h) => {
      x.fillStyle = '#2C4A26'; x.fillRect(0, 0, w, h); const r2 = prRng(17);
      for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(${r2() < 0.5 ? '140,170,110' : '10,25,10'},0.35)`; const y = r2() * h; x.fillRect(0, y, w, 2 + r2() * 6); }
      const g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#D8C25A'); g.addColorStop(0.1, '#C9B44E'); g.addColorStop(0.16, 'rgba(201,180,78,0)'); g.addColorStop(0.84, 'rgba(201,180,78,0)'); g.addColorStop(0.9, '#C9B44E'); g.addColorStop(1, '#D8C25A');
      x.fillStyle = g; x.fillRect(0, 0, w, h); }, 128, 256, 1) }));
    const n = q >= 2 ? 15 : q >= 1 ? 12 : 9;
    for (let i = 0; i < n; i++) {
      const a = i / n * 6.283 * 1.6 + r() * 0.5, rr = 0.04 + r() * 0.12, L = 0.45 + r() * 0.45;
      const leaf = prLeaf(L, t => (0.032 + r() * 0.0) * (t < 0.8 ? 0.75 + 0.25 * Math.sin(Math.PI * t / 0.8) : (1 - t) / 0.2), q >= 1 ? 7 : 4, 0.35, 0.15 + r() * 0.2, (r() - 0.5) * 1.6);
      kit.put(leaf, leafM, Math.cos(a) * rr, top - 0.02, Math.sin(a) * rr, 0.05 + rr * 1.2, a + Math.PI / 2 + (r() - 0.5), 0);
    }
  }
  return kit.make('plant-' + kind, q >= 1);
}

/* --- sofas and armchairs --- */
/** A sofa (seats ≥ 2) or an armchair (1 seat). style 1 fabric, 2 leather buttoned, 3 velvet Chesterfield. */
function prSofa(seats: number, style: number, q: PropQ, col?: number): any {
  const T = THREE, kit = new PropKit(), seg = q >= 2 ? 4 : q >= 1 ? 3 : 2;
  const cover = style === 1 ? prMat('fab-' + (col || 0x3E6A8A), () => prP({ color: 0xFFFFFF, map: prWeave('#' + new T.Color(col || 0x3E6A8A).getHexString()), roughness: 0.92, sheen: 0.6, sheenRoughness: 0.8, sheenColor: new T.Color(0xFFFFFF) }))
    : style === 2 ? prMat('hide-' + (col || 0x6E3A1E), () => prP({ color: 0xFFFFFF, map: prHide('#' + new T.Color(col || 0x6E3A1E).getHexString()), roughness: 0.38, clearcoat: 0.25, clearcoatRoughness: 0.5 }))
    : prMat('velvet-' + (col || 0x1F5C4A), () => prP({ color: col || 0x1F5C4A, roughness: 0.75, sheen: 1, sheenRoughness: 0.35, sheenColor: new T.Color(col || 0x1F5C4A).lerp(new T.Color(0xFFFFFF), 0.45) }));
  const button = prMat('button-' + style + (col || 0), () => prM({ color: new T.Color((cover.color && cover.map) ? (style === 2 ? 0x2A160B : 0x222222) : (col || 0x1F5C4A)).multiplyScalar(0.6), roughness: 0.5 }));
  const oak = prMat('oak-leg', () => prM({ map: ctTex(ctWood('#B89466', '#7A5A36', 6, 128, 256)), roughness: 0.5 }));
  const chrome = prMat('chrome', () => prM({ color: 0xE6EAEE, metalness: 0.65, roughness: 0.22 }));
  const gold = prMat('gold', () => prM({ color: 0xD4AF37, metalness: 1, roughness: 0.25 }));
  const sw = style === 3 ? 0.62 : 0.64, aw = style === 3 ? 0.2 : style === 2 ? 0.12 : 0.16, W = seats * sw + 2 * aw, D = style === 3 ? 0.92 : 0.88;
  const legH = style === 2 ? 0.16 : style === 3 ? 0.1 : 0.14, baseH = 0.18, seatTop = legH + baseH + 0.14;
  const backD = style === 3 ? 0.2 : 0.18, backH = style === 3 ? 0.42 : style === 2 ? 0.36 : 0.44, armH = style === 3 ? 0.36 : style === 2 ? 0.3 : 0.26;
  // the frame under the seat
  kit.put(prRound(W - 0.02, baseH, D - 0.02, 0.04, seg), cover, 0, legH + baseH / 2, 0);
  // the seat cushions (a single long one on the Chesterfield)
  const cz = backD / 2 + 0.01, cd = D - backD - 0.02;
  if (style === 3) kit.put(prRound(W - 2 * aw, 0.15, cd, 0.06, seg, 0.025), cover, 0, legH + baseH + 0.07, cz);
  else for (let i = 0; i < seats; i++) kit.put(prRound(sw - 0.012, 0.15, cd, 0.06, seg, 0.03), cover, -W / 2 + aw + sw * (i + 0.5), legH + baseH + 0.07, cz);
  // the back
  const bz = -D / 2 + backD / 2, by = legH + baseH + backH / 2;
  kit.put(prRound(W, backH + 0.02, backD, style === 3 ? 0.08 : 0.04, seg, style === 3 ? 0.02 : 0), cover, 0, by + 0.02, bz, -0.05);
  if (style === 1) for (let i = 0; i < seats; i++) kit.put(prRound(sw - 0.02, backH - 0.05, 0.18, 0.07, seg, 0, 0.035), cover, -W / 2 + aw + sw * (i + 0.5), seatTop + backH / 2 - 0.06, bz + backD / 2 + 0.08, -0.16);
  // buttons (tufting) on the back of the leather and the velvet ones
  if (style >= 2 && q >= 1) {
    const bg = new T.SphereGeometry(0.011, 8, 6), rows = style === 3 ? 3 : 2, cols = Math.round((W - 2 * aw) / 0.16);
    for (let rI = 0; rI < rows; rI++) for (let c = 0; c <= cols; c++) {
      const x = -W / 2 + aw + (c + (rI % 2 ? 0.5 : 0)) * (W - 2 * aw) / cols; if (x > W / 2 - aw + 0.001) continue;
      kit.put(bg, button, x, seatTop + 0.08 + rI * 0.11, bz + backD / 2 + 0.012 - rI * 0.005);
    }
  }
  // the arms
  for (const s of [-1, 1]) {
    const ax = s * (W / 2 - aw / 2);
    if (style === 3) {   // rolled arms: a panel with a roll on top, turned outwards
      kit.put(prRound(aw, armH + baseH - 0.02, D, 0.05, seg), cover, ax, legH + (armH + baseH) / 2, 0);
      const roll = new T.CylinderGeometry(0.11, 0.11, D, q >= 1 ? 20 : 12); kit.put(roll, cover, ax + s * 0.03, legH + armH + baseH - 0.03, 0, Math.PI / 2, 0, 0);
      if (q >= 1) for (let k = 0; k < 4; k++) kit.put(new T.SphereGeometry(0.01, 8, 6), button, ax - s * aw / 2 - s * 0.002, legH + baseH + 0.06 + (k % 2) * 0.1, -D / 2 + 0.2 + k * 0.16);
    } else kit.put(prRound(aw, armH + baseH, D, style === 1 ? 0.06 : 0.035, seg, style === 1 ? 0.02 : 0), cover, ax, legH + (armH + baseH) / 2, 0);
  }
  // legs
  const legsX = seats >= 3 ? [-1, 0, 1] : [-1, 1];
  if (style === 1) {   // tapered oak legs, splayed a little
    const lg = new T.CylinderGeometry(0.026, 0.015, legH + 0.02, q >= 1 ? 12 : 6);
    for (const lx of legsX) for (const lz of [-1, 1]) { const x = lx * (W / 2 - 0.08), z = lz * (D / 2 - 0.08); kit.put(lg, oak, x + lx * 0.01, legH / 2, z + lz * 0.01, lz * 0.12, 0, -lx * 0.12); }
  } else if (style === 2) {   // chrome sled legs: a bar on the floor and two posts, each side
    for (const lx of [-1, 1]) { const x = lx * (W / 2 - 0.1);
      kit.put(new T.CylinderGeometry(0.012, 0.012, D - 0.12, 10), chrome, x, 0.012, 0, Math.PI / 2, 0, 0);
      for (const lz of [-1, 1]) kit.put(new T.CylinderGeometry(0.012, 0.012, legH, 10), chrome, x, legH / 2, lz * (D / 2 - 0.06)); }
    if (seats >= 3) kit.put(new T.BoxGeometry(0.04, legH, 0.04), button, 0, legH / 2, 0);
  } else {   // turned gold legs
    const lg = new T.LatheGeometry([[0.0, 0], [0.02, 0], [0.024, 0.02], [0.016, 0.05], [0.028, 0.07], [0.03, legH]].map(p => new T.Vector2(p[0], p[1])), q >= 1 ? 14 : 8);
    for (const lx of legsX) for (const lz of [-1, 1]) kit.put(lg, gold, lx * (W / 2 - 0.07), 0, lz * (D / 2 - 0.07));
  }
  const g = kit.make((seats > 1 ? 'sofa-' : 'armchair-') + style, q >= 1);
  g.userData.seatTop = seatTop; g.userData.W = W; g.userData.D = D;
  return g;
}

/* --- the coffee machine --- */
function prCoffee(q: PropQ): any {
  const T = THREE, kit = new PropKit(), seg = q >= 1 ? 3 : 2;
  const steel = prMat('brushed', () => prM({ color: 0xC9CDD2, metalness: 0.85, roughness: 0.32, map: prTex('brushed', (x, w, h) => { x.fillStyle = '#C9CDD2'; x.fillRect(0, 0, w, h); const r = prRng(5); for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(${r() < 0.5 ? 255 : 0},${r() < 0.5 ? 255 : 0},${r() < 0.5 ? 255 : 0},0.05)`; x.fillRect(0, r() * h, w, 1); } }, 64, 256, 2) }));
  const black = prMat('piano-black', () => prP({ color: 0x0E0F11, roughness: 0.2, clearcoat: 0.8, clearcoatRoughness: 0.1 }));
  const matte = prMat('matte-black', () => prM({ color: 0x1A1C1F, roughness: 0.7 }));
  const chrome = prMat('chrome', () => prM({ color: 0xE6EAEE, metalness: 0.65, roughness: 0.22 }));
  const smoke = prMat('smoke-glass', () => prP({ color: 0x3A2A20, roughness: 0.1, transparent: true, opacity: 0.55, depthWrite: false }));
  const beans = prMat('beans', () => prM({ color: 0xFFFFFF, roughness: 0.55, map: prTex('beans', (x, w, h) => { x.fillStyle = '#3A2214'; x.fillRect(0, 0, w, h); const r = prRng(19); for (let i = 0; i < 400; i++) { const a = r() * w, b = r() * h; x.fillStyle = ['#5A3420', '#6E4128', '#2A170C'][i % 3]; x.beginPath(); x.ellipse(a, b, 5, 3.4, r() * 3, 0, 6.3); x.fill(); x.strokeStyle = 'rgba(0,0,0,0.6)'; x.beginPath(); x.moveTo(a - 3, b); x.lineTo(a + 3, b); x.stroke(); } }, 128, 128, 1) }));
  const screen = prMat('coffee-screen', () => { const t = prTex('coffee-ui', (x, w, h) => {
      x.fillStyle = '#101317'; x.fillRect(0, 0, w, h); x.fillStyle = '#E8EDF2'; x.font = '600 22px Inter, Arial, sans-serif'; x.fillText('Choose your drink', 18, 34);
      const names = ['Espresso', 'Cappuccino', 'Latte', 'Americano', 'Hot chocolate', 'Tea'], cols = ['#6E4128', '#B98A5E', '#D9B48A', '#4A2A18', '#5A3020', '#8A4A16'];
      names.forEach((n, i) => { const cx = 18 + (i % 3) * 120, cy = 54 + Math.floor(i / 3) * 96; x.fillStyle = '#1E242B'; x.fillRect(cx, cy, 108, 84);
        x.fillStyle = cols[i]; x.beginPath(); x.ellipse(cx + 54, cy + 30, 18, 6, 0, 0, 6.3); x.fill(); x.fillStyle = '#F2F2F0'; x.fillRect(cx + 37, cy + 30, 34, 4); x.beginPath(); x.moveTo(cx + 36, cy + 30); x.lineTo(cx + 40, cy + 50); x.lineTo(cx + 68, cy + 50); x.lineTo(cx + 72, cy + 30); x.fill();
        x.fillStyle = '#C9D2DB'; x.font = '500 14px Inter, Arial, sans-serif'; x.textAlign = 'center'; x.fillText(n, cx + 54, cy + 72); x.textAlign = 'left'; });
    }, 384, 256, 1); t.wrapS = t.wrapT = T.ClampToEdgeWrapping; t.repeat.set(1, 1); return new T.MeshBasicMaterial({ map: t, toneMapped: false }); });
  const led = prMat('led-warm', () => new T.MeshBasicMaterial({ color: 0xFFE2B0, toneMapped: false }));
  const grid = prMat('drip-grid', () => { const t = prTex('drip', (x, w, h) => { x.fillStyle = '#C9CDD2'; x.fillRect(0, 0, w, h); x.fillStyle = '#1A1C1F'; for (let i = 0; i < 10; i++) x.fillRect(8 + i * 12, 10, 6, h - 20); }, 128, 64, 1); t.repeat.set(1, 1); return prM({ map: t, metalness: 0.8, roughness: 0.3 }); });
  const Wm = 0.4, Hm = 0.68, Dm = 0.54;
  // the body: steel sides and top, a gloss black front
  kit.put(prRound(Wm, Hm, Dm, 0.025, seg), steel, 0, Hm / 2 + 0.015, 0);
  kit.put(prRound(Wm - 0.03, Hm - 0.04, 0.03, 0.012, seg), black, 0, Hm / 2 + 0.02, Dm / 2 + 0.005);
  // the cup bay: a dark recess in the lower front
  const bay = prMat('cup-bay', () => prM({ color: 0x3A3F45, roughness: 0.5, metalness: 0.4 }));
  kit.put(new T.BoxGeometry(Wm - 0.1, 0.22, 0.02), bay, 0, 0.16, Dm / 2 + 0.015);
  kit.put(new T.BoxGeometry(Wm - 0.12, 0.008, 0.012), led, 0, 0.268, Dm / 2 + 0.03);   // a light over the cup
  // the outlet over the cup: a chrome block with two coffee spouts and a milk spout
  kit.put(prRound(0.13, 0.05, 0.1, 0.012, seg), chrome, 0, 0.3, Dm / 2 + 0.06);
  for (const x of [-0.025, 0.025]) kit.put(new T.CylinderGeometry(0.007, 0.005, 0.03, 10), chrome, x, 0.265, Dm / 2 + 0.08);
  kit.put(new T.CylinderGeometry(0.005, 0.004, 0.026, 8), chrome, 0, 0.268, Dm / 2 + 0.1);
  // the drip tray with its grid
  kit.put(prRound(Wm - 0.06, 0.04, 0.16, 0.01, seg), steel, 0, 0.035, Dm / 2 + 0.05);
  kit.put(new T.PlaneGeometry(Wm - 0.1, 0.13), grid, 0, 0.0556, Dm / 2 + 0.05, -Math.PI / 2);
  // the touchscreen and a lit strip down each side of the front
  kit.put(new T.PlaneGeometry(0.24, 0.16), screen, 0, 0.5, Dm / 2 + 0.022);
  for (const s of [-1, 1]) kit.put(new T.BoxGeometry(0.006, Hm - 0.12, 0.004), led, s * (Wm / 2 - 0.022), Hm / 2 + 0.02, Dm / 2 + 0.022);
  // two bean hoppers on top, smoked glass with beans in them, and their lids
  for (const s of [-1, 1]) { const x = s * 0.09;
    kit.put(new T.BoxGeometry(0.15, 0.06, 0.2), beans, x, Hm + 0.045, -0.06);
    kit.put(prRound(0.16, 0.11, 0.21, 0.012, seg), smoke, x, Hm + 0.07, -0.06);
    kit.put(prRound(0.165, 0.018, 0.215, 0.008, seg), matte, x, Hm + 0.13, -0.06); }
  // feet
  for (const [x, z] of [[-0.16, -0.22], [0.16, -0.22], [-0.16, 0.2], [0.16, 0.2]]) kit.put(new T.CylinderGeometry(0.015, 0.018, 0.015, 10), matte, x, 0.0075, z);
  const g = kit.make('coffee-machine-1', q >= 1); g.userData.cupAt = new T.Vector3(0, 0.058, Dm / 2 + 0.07); return g;
}

/* --- doors --- */
/** A painted steel door leaf: hinge at x = 0, the leaf along +X, thickness about z = 0. A narrow glass panel, lever
 *  handles both sides, kick plates, three hinges and a closer. */
function prDoor1(q: PropQ, o: any = {}): any {
  const T = THREE, kit = new PropKit(), w = o.w || 1.0, h = o.h || 2.1, t = 0.045, col = o.color || 0x2E5C8A;
  const paint = prMat('door-paint-' + col, () => prP({ color: col, roughness: 0.42, metalness: 0.25, clearcoat: q >= 2 ? 0.4 : 0 }));
  const steel = prMat('door-steel', () => prM({ color: 0xE0E4E8, metalness: 0.6, roughness: 0.25 }));
  const rubber = prMat('rubber', () => prM({ color: 0x15171A, roughness: 0.8 }));
  const glass = prMat('door-glass', () => prP({ color: 0xCFE0EC, roughness: 0.04, transparent: true, opacity: 0.3, depthWrite: false }));
  const gx0 = w - 0.36, gx1 = w - 0.2, gy0 = 1.1, gy1 = 1.95;   // the glass panel
  const slab = (x0: number, x1: number, y0: number, y1: number) => kit.put(new T.BoxGeometry(x1 - x0, y1 - y0, t), paint, (x0 + x1) / 2, (y0 + y1) / 2, 0);
  slab(0, gx0, 0, h); slab(gx1, w, 0, h); slab(gx0, gx1, 0, gy0); slab(gx0, gx1, gy1, h);
  kit.put(new T.BoxGeometry(gx1 - gx0, gy1 - gy0, 0.006), glass, (gx0 + gx1) / 2, (gy0 + gy1) / 2, 0);
  for (const s of [-1, 1]) {   // both faces
    const z = s * (t / 2 + 0.004);
    for (const [a, b, c, d] of [[gx0 - 0.015, gx1 + 0.015, gy0 - 0.015, gy0], [gx0 - 0.015, gx1 + 0.015, gy1, gy1 + 0.015], [gx0 - 0.015, gx0, gy0, gy1], [gx1, gx1 + 0.015, gy0, gy1]]) kit.put(new T.BoxGeometry(b - a, d - c, 0.008), rubber, (a + b) / 2, (c + d) / 2, z);
    kit.put(new T.BoxGeometry(w - 0.06, 0.25, 0.003), steel, w / 2, 0.15, s * (t / 2 + 0.0015));   // kick plate
    kit.put(new T.CylinderGeometry(0.028, 0.028, 0.01, q >= 1 ? 20 : 10), steel, w - 0.08, 1.02, s * (t / 2 + 0.005), Math.PI / 2, 0, 0);   // rose
    kit.put(new T.CylinderGeometry(0.009, 0.009, 0.05, 10), steel, w - 0.08, 1.02, s * (t / 2 + 0.03), Math.PI / 2, 0, 0);
    kit.put(prRound(0.15, 0.02, 0.022, 0.008, 2), steel, w - 0.08 - 0.07, 1.02, s * (t / 2 + 0.055));   // lever, towards the hinge
    kit.put(new T.BoxGeometry(0.035, 0.07, 0.006), steel, w - 0.08, 0.93, s * (t / 2 + 0.003));   // the key plate
  }
  for (const y of [0.25, 1.05, 1.85]) kit.put(new T.CylinderGeometry(0.009, 0.009, 0.1, 10), steel, -0.004, y, t / 2 + 0.002);   // hinges
  kit.put(prRound(0.28, 0.055, 0.05, 0.01, 2), prMat('closer', () => prM({ color: 0x9BA1A7, metalness: 0.6, roughness: 0.35 })), 0.2, h - 0.08, -(t / 2 + 0.03));
  return kit.make('door-1', q >= 1);
}
/** One leaf of an automatic sliding glass door: frameless glass, slim rails top and bottom, a vertical edge
 *  profile. Centred on x = 0, standing on the floor. */
function prDoor2(q: PropQ, o: any = {}): any {
  const T = THREE, kit = new PropKit(), w = o.w || 0.95, h = o.h || 2.3;
  const rail = prMat('door2-rail-' + (o.rail || 0), () => prM({ color: o.rail || 0x2A2C30, metalness: 0.85, roughness: 0.3 }));
  const glass = prMat('door2-glass', () => prP({ color: 0xE4EEF5, roughness: 0.02, transparent: true, opacity: 0.16, depthWrite: false }));
  kit.put(new T.BoxGeometry(w - 0.02, h - 0.12, 0.012), glass, 0, h / 2, 0);
  kit.put(new T.BoxGeometry(w, 0.06, 0.04), rail, 0, h - 0.03, 0); kit.put(new T.BoxGeometry(w, 0.06, 0.04), rail, 0, 0.03, 0);
  for (const s of [-1, 1]) kit.put(new T.BoxGeometry(0.02, h - 0.12, 0.03), rail, s * (w / 2 - 0.01), h / 2, 0);
  return kit.make('door-2', q >= 1);
}

/* --- the room sign: an airport-style plaque by a door --- */
/** Dark grey, a yellow line at the top, a pictogram, the room's name and number, and a red "authorised staff only"
 *  band where it applies. o: { name, sub, num, pict: 'office'|'ops'|'lounge'|'break'|'tools'|'exit', staff } */
function prSign(q: PropQ, o: any = {}): any {
  const T = THREE, g = new T.Group(), W = 0.36, H = 0.54;
  const frame = new T.Mesh(prRound(W + 0.02, H + 0.02, 0.016, 0.006, 2), prMat('sign-frame', () => prM({ color: 0x22262B, metalness: 0.5, roughness: 0.35 }))); frame.position.z = 0.008; frame.castShadow = q >= 1; g.add(frame);
  const [c, x] = ctCanvas(480, 720), w = 480, h = 720;
  x.fillStyle = '#2B3036'; x.fillRect(0, 0, w, h); x.fillStyle = '#F4C542'; x.fillRect(0, 0, w, 12);
  x.fillStyle = '#FFFFFF'; x.fillRect(40, 56, 160, 160); x.fillStyle = '#2B3036'; prPict(x, o.pict || 'office', 40, 56, 160);
  if (o.num) { x.fillStyle = '#9AA3AD'; x.font = '600 42px Inter, Arial, sans-serif'; x.textAlign = 'right'; x.fillText(o.num, w - 40, 96); x.textAlign = 'left'; }
  x.fillStyle = '#FFFFFF'; let y = 300, fs = 60; x.font = `700 ${fs}px Inter, Arial, sans-serif`;
  for (const ln of String(o.name || '').split('\n')) { while (x.measureText(ln).width > w - 80 && fs > 30) { fs -= 2; x.font = `700 ${fs}px Inter, Arial, sans-serif`; } x.fillText(ln, 40, y); y += fs + 8; }
  if (o.sub) { x.fillStyle = '#B9C1CA'; x.font = '500 32px Inter, Arial, sans-serif'; x.fillText(o.sub, 40, y + 8); }
  if (o.staff) { x.fillStyle = '#C8102E'; x.fillRect(0, h - 120, w, 120); x.fillStyle = '#FFFFFF'; x.font = '700 36px Inter, Arial, sans-serif'; x.fillText('AUTHORISED', 40, h - 70); x.fillText('STAFF ONLY', 40, h - 28); }
  const tx = ctTex(c); tx.wrapS = tx.wrapT = T.ClampToEdgeWrapping;
  const face = new T.Mesh(new T.PlaneGeometry(W, H), new T.MeshStandardMaterial({ map: tx, roughness: 0.4, emissive: 0xFFFFFF, emissiveMap: tx, emissiveIntensity: 0.12 }));
  face.position.z = 0.0175; face.userData.keep = true; g.add(face);
  return g;
}
/** The pictograms on the signs, drawn in the current fill colour in a square at x, y of size s. */
function prPict(c: CanvasRenderingContext2D, k: string, x: number, y: number, s: number) {
  const R = (a: number, b: number, w: number, h: number) => c.fillRect(x + s * a, y + s * b, s * w, s * h);
  if (k === 'office') { R(0.15, 0.55, 0.7, 0.07); R(0.2, 0.62, 0.06, 0.22); R(0.74, 0.62, 0.06, 0.22); R(0.35, 0.2, 0.32, 0.25); R(0.48, 0.45, 0.06, 0.1); }
  else if (k === 'ops') { c.lineWidth = s * 0.07; c.strokeStyle = c.fillStyle as string; c.beginPath(); c.arc(x + s * 0.5, y + s * 0.5, s * 0.32, 0, 6.3); c.stroke(); c.beginPath(); c.moveTo(x + s * 0.5, y + s * 0.5); c.lineTo(x + s * 0.72, y + s * 0.32); c.stroke(); c.beginPath(); c.arc(x + s * 0.5, y + s * 0.5, s * 0.05, 0, 6.3); c.fill(); }
  else if (k === 'lounge') { R(0.18, 0.5, 0.5, 0.12); R(0.18, 0.28, 0.1, 0.3); R(0.58, 0.42, 0.1, 0.2); R(0.22, 0.62, 0.05, 0.15); R(0.58, 0.62, 0.05, 0.15); R(0.72, 0.42, 0.14, 0.14); R(0.84, 0.45, 0.05, 0.07); }
  else if (k === 'break') { R(0.22, 0.35, 0.4, 0.38); R(0.62, 0.42, 0.12, 0.06); R(0.68, 0.42, 0.06, 0.2); R(0.62, 0.56, 0.12, 0.06); R(0.16, 0.76, 0.58, 0.05); for (let i = 0; i < 3; i++) R(0.28 + i * 0.12, 0.14 + (i % 2) * 0.04, 0.04, 0.14); }
  else if (k === 'tools') { c.save(); c.translate(x + s / 2, y + s / 2); c.rotate(-Math.PI / 4); c.fillRect(-s * 0.05, -s * 0.3, s * 0.1, s * 0.62); c.beginPath(); c.arc(0, -s * 0.3, s * 0.13, 0, 6.3); c.fill(); c.restore(); }
  else if (k === 'exit') { R(0.4, 0.14, 0.14, 0.14); R(0.36, 0.32, 0.14, 0.28); R(0.3, 0.58, 0.08, 0.26); R(0.48, 0.58, 0.08, 0.26); R(0.6, 0.34, 0.22, 0.06); }
}

const PROP_BUILD: any = {
  'plant-1': (q: PropQ, o: any) => prPlant(1, q, o.seed || 1), 'plant-2': (q: PropQ, o: any) => prPlant(2, q, o.seed || 2), 'plant-3': (q: PropQ, o: any) => prPlant(3, q, o.seed || 3),
  'sofa-1': (q: PropQ, o: any) => prSofa(o.seats || 3, 1, q, o.color), 'sofa-2': (q: PropQ, o: any) => prSofa(o.seats || 3, 2, q, o.color), 'sofa-3': (q: PropQ, o: any) => prSofa(o.seats || 3, 3, q, o.color),
  'armchair-1': (q: PropQ, o: any) => prSofa(1, 1, q, o.color), 'armchair-2': (q: PropQ, o: any) => prSofa(1, 2, q, o.color), 'armchair-3': (q: PropQ, o: any) => prSofa(1, 3, q, o.color),
  'coffee-machine-1': (q: PropQ) => prCoffee(q),
  'door-1': (q: PropQ, o: any) => prDoor1(q, o), 'door-2': (q: PropQ, o: any) => prDoor2(q, o),
  'room-sign': (q: PropQ, o: any) => prSign(q, o),
};
