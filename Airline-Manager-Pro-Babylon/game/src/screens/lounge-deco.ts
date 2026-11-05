/* The lounge's finishes: the copper-wave ceiling (every level), the herringbone oak floor and plaster walls of the
 * Business lounge, the dark gold-veined stone of the bar, and the soft reflections every metal in the lounge shows
 * (brass, copper, gold, chrome): a small picture of a bright room with its windows and warm lights, made once. */

/** Light oak laid in herringbone. */
function lgHerringbone(): HTMLCanvasElement {
  const N = DESKTOP ? 2048 : 1024, s = N / 1024, [c, x] = ctCanvas(N, N), r = ctRng(64), pw = 64 * s, pl = 4 * pw / 2;
  x.fillStyle = '#B48A5C'; x.fillRect(0, 0, N, N);
  // planks of 4:1 alternating at ±45°, in columns
  for (let i = -2; i < N / pw + 2; i++) for (let j = -4; j < N / pw * 2 + 4; j++) {
    const tone = 0.86 + r() * 0.26, col = `rgb(${Math.round(214 * tone)},${Math.round(178 * tone)},${Math.round(128 * tone)})`;
    x.save(); x.translate(i * pw * 2 + (j % 2 ? pw : 0), j * pw / 2); x.rotate(j % 2 ? -Math.PI / 4 : Math.PI / 4);
    const g = x.createLinearGradient(-pl / 2, 0, pl / 2, 0); g.addColorStop(0, col); g.addColorStop(0.5, `rgb(${Math.round(200 * tone)},${Math.round(164 * tone)},${Math.round(116 * tone)})`); g.addColorStop(1, col);
    x.fillStyle = g; x.fillRect(-pl / 2, -pw / 4, pl, pw / 2);
    x.strokeStyle = 'rgba(70,44,20,.10)'; x.lineWidth = 1; for (let k = 0; k < 5; k++) { const yy = -pw / 4 + r() * pw / 2; x.beginPath(); x.moveTo(-pl / 2, yy); x.lineTo(pl / 2, yy + (r() - 0.5) * 3); x.stroke(); }
    x.strokeStyle = 'rgba(60,36,16,.45)'; x.lineWidth = 1.5 * s; x.strokeRect(-pl / 2, -pw / 4, pl, pw / 2);
    x.restore();
  }
  return c;
}
/** Black stone with fine gold veins (the bar's top). */
function lgDarkMarble(): HTMLCanvasElement {
  const [c, x] = ctCanvas(1024, 1024), r = ctRng(77); x.fillStyle = '#1B1B1D'; x.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(255,255,255,${r() * 0.03})`; x.fillRect(r() * 1024, r() * 1024, 2, 2); }
  for (let i = 0; i < 9; i++) { x.strokeStyle = `rgba(${190 + r() * 40},${150 + r() * 30},${80 + r() * 20},${0.25 + r() * 0.4})`; x.lineWidth = 0.6 + r() * 1.8; x.beginPath(); let X = r() * 1024, Y = 0; x.moveTo(X, Y); while (Y < 1024) { X += (r() - 0.5) * 80; Y += 15 + r() * 45; x.lineTo(X, Y); } x.stroke(); }
  return c;
}
/** Plaster, warm white. */
function lgPlaster(): HTMLCanvasElement {
  const [c, x] = ctCanvas(512, 512), r = ctRng(31); x.fillStyle = '#EDE8E0'; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 40; i++) { const X = r() * 512, Y = r() * 512, R = 30 + r() * 90, gg = x.createRadialGradient(X, Y, 0, X, Y, R); gg.addColorStop(0, `rgba(${r() < 0.5 ? '255,255,255' : '120,110,100'},${0.025 + r() * 0.03})`); gg.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gg; x.fillRect(X - R, Y - R, R * 2, R * 2); }
  return c;
}

/** The ceiling: dark above, rows of copper strips in slow parallel waves, warm light hidden along the walls.
 *  One mesh for every strip (one draw). File: lounge-props/ceiling-copper-waves.glb. */
function lgCeilingWaves(root: any, W: number, D: number, H: number, q: number): any {
  const T = THREE, g = new T.Group(); g.name = 'ceiling-copper-waves'; root.add(g);
  const dark = new T.Mesh(new T.PlaneGeometry(W, D), new T.MeshStandardMaterial({ color: 0x1A1612, roughness: 0.85 })); dark.rotation.x = Math.PI / 2; dark.position.y = H; g.add(dark);
  const n = Math.max(8, Math.round(D / 0.53)), step = D / n, seg = DESKTOP || q >= 2 ? 120 : 64, rad = q >= 1 ? 6 : 5;
  const pos: number[] = [], nor: number[] = [], idx: number[] = [];
  for (let j = 0; j < n; j++) {
    const z = -D / 2 + step * (j + 0.5), pts: any[] = [];
    for (let i = 0; i <= 40; i++) pts.push(new T.Vector3(-W / 2 + 0.08 + i * (W - 0.16) / 40, H - 0.5 - 0.4 * Math.sin(i / 40 * Math.PI * 3 + j * 0.25), z));
    const tg = new T.TubeGeometry(new T.CatmullRomCurve3(pts), seg, 0.05, rad, false), base = pos.length / 3;
    const p = tg.attributes.position.array, nn = tg.attributes.normal.array, ix = tg.index.array;
    for (let k = 0; k < p.length; k++) { pos.push(p[k]); nor.push(nn[k]); }
    for (let k = 0; k < ix.length; k++) idx.push(ix[k] + base);
    tg.dispose();
  }
  const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); geo.setIndex(idx);
  const cu = new T.Mesh(geo, new T.MeshStandardMaterial({ color: 0xB86F3E, metalness: 0.9, roughness: 0.3, emissive: 0x3A1A08, emissiveIntensity: 0.35 }));
  cu.castShadow = false; cu.receiveShadow = false; g.add(cu);
  // the hidden light: warm strips along the window wall and the back wall, just under the ceiling
  const glow = new T.MeshBasicMaterial({ color: 0xFFC27A, toneMapped: false });
  for (const z of [-D / 2 + 0.3, D / 2 - 0.12]) { const s = new T.Mesh(new T.BoxGeometry(W - 0.2, 0.03, 0.08), glow); s.position.set(0, H - 0.05, z); g.add(s); }
  try { Models.swap(g, 'lounge-props/ceiling-copper-waves.glb', false); } catch (e) { /* the app's own */ }
  return g;
}

/** Soft reflections for the lounge's metals: a picture of a bright room (the windows, warm lamps), made once. */
let _lgMetalEnv: any = null;
function lgMetalEnv(ren: any): any {
  if (_lgMetalEnv || !ren) return _lgMetalEnv;
  try {
    const T = THREE, pm = new T.PMREMGenerator(ren), env = new T.Scene();
    env.add(new T.Mesh(new T.BoxGeometry(12, 5, 12), new T.MeshBasicMaterial({ color: 0x3A322A, side: T.BackSide })));
    const pane = (w: number, h: number, col: number, x: number, y: number, z: number, ry: number, rx = 0) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: col, side: T.DoubleSide })); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); env.add(m); };
    pane(10, 2.6, 0xDCE8F4, 0, 1.6, -5.9, 0);                 // the windows onto the apron
    pane(10, 0.3, 0xFFD9A0, 0, 2.4, 5.9, Math.PI);           // the warm strip on the back wall
    for (const x of [-3, 0, 3]) pane(1.2, 1.2, 0xFFF0D8, x, 2.45, 0, 0, Math.PI / 2);   // lamps above
    pane(12, 0.6, 0x6A5440, 0, -2.4, 0, 0, -Math.PI / 2);     // the floor
    _lgMetalEnv = pm.fromScene(env, 0.04).texture; pm.dispose();
  } catch (e) { _lgMetalEnv = null; }
  return _lgMetalEnv;
}
/** Every metal in the lounge: a subtle reflection (not a mirror). */
function lgMetalShine(root: any, ren: any) {
  const env = lgMetalEnv(ren); if (!root) return;
  const done = new Set<any>();
  root.traverse((o: any) => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!m || done.has(m) || !m.isMeshStandardMaterial || (m.metalness || 0) < 0.6) continue; done.add(m);
      if (env) m.envMap = env;
      m.envMapIntensity = 0.7; m.roughness = clamp(m.roughness, 0.2, 0.45); m.needsUpdate = true;
    }
  });
}

/** A real mirror (the wall behind the bar's bottles): the room drawn again from the mirrored view into a picture,
 *  cut at the mirror's plane, each frame you can see it. Its own tint (a warm smoked glass). */
function lgMirror(par: any, w: number, h: number, x: number, y: number, z: number, ry: number, tint: number): any {
  const T = THREE, res = DESKTOP ? 1024 : 512;
  const rt = new T.WebGLRenderTarget(res, Math.round(res * h / w), { samples: DESKTOP ? 4 : 0 }); rt.texture.colorSpace = T.SRGBColorSpace;
  const tm = new T.Matrix4();
  const mat = new T.ShaderMaterial({ uniforms: { tex: { value: rt.texture }, tm: { value: tm }, tint: { value: new T.Color(tint) } },
    vertexShader: 'uniform mat4 tm; varying vec4 vU; varying vec2 vUv; void main(){ vUv = uv; vU = tm * vec4(position,1.0); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform sampler2D tex; uniform vec3 tint; varying vec4 vU; varying vec2 vUv; void main(){ vec3 c = texture2DProj(tex, vU).rgb * tint; float g = smoothstep(0.0, 1.0, 1.0 - abs(vUv.x - vUv.y - 0.15) * 3.0) * 0.05; float e = smoothstep(0.0, 0.03, min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y))); gl_FragColor = vec4(c * (0.9 + 0.1 * e) + g, 1.0); }' });
  const m = new T.Mesh(new T.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.y = ry; m.name = 'bar-mirror-glass'; par.add(m);
  const vc = new T.PerspectiveCamera(), n = new T.Vector3(), mp = new T.Vector3(), cp = new T.Vector3(), rot = new T.Matrix4(), look = new T.Vector3(), view = new T.Vector3(), target = new T.Vector3(), plane = new T.Plane(), clip = new T.Vector4(), q = new T.Vector4();
  const fr = new T.Frustum(), pv = new T.Matrix4(); let tick = 0;
  m.userData.update = (ren: any, scene: any, cam: any) => {
    if (!DESKTOP && (tick++ % 2)) return;   // phones and tablets: every other frame
    m.updateMatrixWorld(); cam.updateMatrixWorld(); mp.setFromMatrixPosition(m.matrixWorld); cp.setFromMatrixPosition(cam.matrixWorld);
    if (cp.distanceTo(mp) > 16) return;
    rot.extractRotation(m.matrixWorld); n.set(0, 0, 1).applyMatrix4(rot);
    view.subVectors(mp, cp); if (view.dot(n) > 0) return;
    pv.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); fr.setFromProjectionMatrix(pv); if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
    const bs = m.geometry.boundingSphere.clone().applyMatrix4(m.matrixWorld); if (!fr.intersectsSphere(bs)) return;
    view.reflect(n).negate().add(mp);
    rot.extractRotation(cam.matrixWorld); look.set(0, 0, -1).applyMatrix4(rot).add(cp); target.subVectors(mp, look).reflect(n).negate().add(mp);
    vc.position.copy(view); vc.up.set(0, 1, 0).applyMatrix4(rot).reflect(n); vc.lookAt(target); vc.far = cam.far; vc.near = cam.near; vc.updateMatrixWorld(); vc.projectionMatrix.copy(cam.projectionMatrix);
    tm.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1); tm.multiply(vc.projectionMatrix); tm.multiply(vc.matrixWorldInverse); tm.multiply(m.matrixWorld);
    plane.setFromNormalAndCoplanarPoint(n, mp); plane.applyMatrix4(vc.matrixWorldInverse); clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const P = vc.projectionMatrix.elements; q.x = (Math.sign(clip.x) + P[8]) / P[0]; q.y = (Math.sign(clip.y) + P[9]) / P[5]; q.z = -1; q.w = (1 + P[10]) / P[14];
    clip.multiplyScalar(2 / clip.dot(q)); P[2] = clip.x; P[6] = clip.y; P[10] = clip.z + 1 - 0.003; P[14] = clip.w;
    const au = ren.shadowMap.autoUpdate, was = ren.getRenderTarget(), xr = ren.xr && ren.xr.enabled;
    m.visible = false; ren.shadowMap.autoUpdate = false; if (ren.xr) ren.xr.enabled = false;
    try { ren.setRenderTarget(rt); ren.clear(); ren.render(scene, vc); } finally { ren.setRenderTarget(was); ren.shadowMap.autoUpdate = au; if (ren.xr) ren.xr.enabled = xr; m.visible = true; }
  };
  m.userData.dispose = () => { try { rt.dispose(); mat.dispose(); } catch (e) { /* gone */ } };
  return m;
}
/** Each frame: the lounge's mirrors drawn before the room. */
function lgMirrorsStep(R: any) {
  const A = R.A; if (!A || !A.mirrors || !R.ren || !R.scene || !R.cam) return;
  for (const m of A.mirrors) { try { m.userData.update(R.ren, R.scene, R.cam); } catch (e) { /* that one rests */ } }
}

/** Our own paintings for the lounge walls, painted here: brush strokes over a gradient. Northern lights over the
 *  hills, an aircraft climbing into the dusk, a storm over the sea with a lit harbour, and arcs of gold. */
const LG_PAINT_PAL: { [k: string]: string[] } = {
  aurora: ['#07131F', '#0E2C3A', '#2BD49A', '#9BF2C9', '#6B5BD6', '#1E3B2E'], dusk: ['#2A1A3A', '#C2556A', '#F1A25B', '#FBE3A8', '#3A2A4A', '#1A1424'],
  storm: ['#1D2830', '#46606E', '#9DB4BE', '#E7EEF0', '#2A3540', '#C7A15A'], gold: ['#1A1206', '#6A4A1A', '#D9A441', '#F5DFA0', '#3C2A12', '#FFF4D6'],
};
function lgPainting(kind: string, w: number, h: number): HTMLCanvasElement {
  const N = DESKTOP ? 1024 : 768, W2 = N, H2 = Math.round(N * h / w), [c, x] = ctCanvas(W2, H2), r = ctRng(kind.length * 97 + 3), pal = LG_PAINT_PAL[kind] || LG_PAINT_PAL.gold, k = N / 768;
  const stroke = (col: string, x0: number, y0: number, len: number, ang: number, wd: number) => { x.save(); x.translate(x0, y0); x.rotate(ang); x.fillStyle = col; x.globalAlpha = 0.35 + r() * 0.5; x.beginPath(); x.ellipse(0, 0, len * k, wd * k, 0, 0, 7); x.fill(); x.restore(); };
  const g = x.createLinearGradient(0, 0, 0, H2); g.addColorStop(0, pal[0]); g.addColorStop(0.55, pal[1]); g.addColorStop(1, pal[5]); x.fillStyle = g; x.fillRect(0, 0, W2, H2);
  for (let i = 0; i < 1400; i++) { const y = r() * H2, t = y / H2; stroke(pal[t < 0.5 ? (r() < 0.6 ? 1 : 0) : (r() < 0.5 ? 4 : 5)], r() * W2, y, 10 + r() * 30, (r() - 0.5) * 0.4, 1.5 + r() * 3); }
  if (kind === 'aurora') { for (let b = 0; b < 3; b++) for (let i = 0; i < 260; i++) { const xx = i / 260 * W2, yy = H2 * (0.15 + b * 0.12) + Math.sin(i / 30 + b) * 40 * k; stroke(pal[2 + (b % 2)], xx, yy + r() * 60 * k, 4 + r() * 6, Math.PI / 2 + (r() - 0.5) * 0.3, 1 + r() * 2); }
    x.globalAlpha = 1; x.fillStyle = '#0A1410'; x.beginPath(); x.moveTo(0, H2 * 0.78); for (let i = 0; i <= 20; i++) x.lineTo(i / 20 * W2, H2 * (0.7 + 0.12 * Math.sin(i * 1.3) * r())); x.lineTo(W2, H2); x.lineTo(0, H2); x.fill(); }
  if (kind === 'dusk') { x.globalAlpha = 0.9; const sg = x.createRadialGradient(W2 * 0.3, H2 * 0.62, 5, W2 * 0.3, H2 * 0.62, H2 * 0.45); sg.addColorStop(0, '#FFF0C0'); sg.addColorStop(0.2, 'rgba(250,180,90,.8)'); sg.addColorStop(1, 'rgba(250,120,90,0)'); x.fillStyle = sg; x.fillRect(0, 0, W2, H2);
    x.globalAlpha = 1; x.strokeStyle = 'rgba(255,240,220,.85)'; x.lineWidth = 3 * k; x.beginPath(); x.moveTo(W2 * 0.05, H2 * 0.5); x.quadraticCurveTo(W2 * 0.5, H2 * 0.25, W2 * 0.95, H2 * 0.12); x.stroke();
    x.fillStyle = '#2A1A30'; x.beginPath(); x.moveTo(W2 * 0.95, H2 * 0.12); x.lineTo(W2 * 0.88, H2 * 0.13); x.lineTo(W2 * 0.86, H2 * 0.16); x.closePath(); x.fill(); }
  if (kind === 'storm') { for (let i = 0; i < 500; i++) stroke(pal[3], r() * W2, H2 * (0.2 + r() * 0.35), 20 + r() * 50, (r() - 0.5) * 0.2, 4 + r() * 8); x.globalAlpha = 1; x.fillStyle = '#C7A15A'; for (let i = 0; i < 30; i++) { x.beginPath(); x.arc(W2 * (0.1 + i * 0.028), H2 * (0.82 + Math.sin(i) * 0.01), 2.5 * k, 0, 7); x.fill(); } }
  if (kind === 'gold') { x.globalAlpha = 0.85; for (let i = 0; i < 9; i++) { x.strokeStyle = i % 2 ? pal[3] : pal[2]; x.lineWidth = (3 + i) * k; x.beginPath(); x.arc(W2 * 0.5, H2 * 1.4, H2 * (0.6 + i * 0.09), Math.PI * 1.15, Math.PI * 1.85); x.stroke(); } }
  x.globalAlpha = 1; x.fillStyle = 'rgba(255,255,255,.04)'; for (let i = 0; i < 4000; i++) x.fillRect(r() * W2, r() * H2, 1, 1);
  return c;
}
/** A painting in a brass frame with a black slip and a small brass picture light over it, hung on a wall
 *  (x, y, z its centre on the wall; ry so it faces into the room). Its own file: lounge-props/<name>.glb. */
function lgHangPainting(root: any, name: string, kind: string, w: number, h: number, x: number, y: number, z: number, ry: number): any {
  const T = THREE, g = new T.Group(); g.name = name; g.position.set(x, y, z); g.rotation.y = ry; root.add(g);
  const brass = new T.MeshStandardMaterial({ color: 0xC9A25E, metalness: 0.95, roughness: 0.28 }), black = new T.MeshStandardMaterial({ color: 0x141414, roughness: 0.6 });
  const box = (bw: number, bh: number, bd: number, m: any, px: number, py: number, pz: number) => { const o = new T.Mesh(new T.BoxGeometry(bw, bh, bd), m); o.position.set(px, py, pz); o.castShadow = false; o.receiveShadow = true; g.add(o); return o; };
  box(w + 0.14, h + 0.14, 0.05, brass, 0, 0, 0.025); box(w + 0.04, h + 0.04, 0.06, black, 0, 0, 0.03);
  const pic = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshStandardMaterial({ map: ctTex(lgPainting(kind, w, h)), roughness: 0.75 })); pic.position.z = 0.062; pic.userData.keep = true; g.add(pic);
  // the picture light: an arm and a brass hood with a warm strip under it
  box(0.02, 0.02, 0.18, brass, 0, h / 2 + 0.14, 0.1); box(Math.min(0.7, w * 0.45), 0.05, 0.07, brass, 0, h / 2 + 0.14, 0.2);
  const lit = new T.Mesh(new T.BoxGeometry(Math.min(0.66, w * 0.43), 0.008, 0.04), new T.MeshBasicMaterial({ color: 0xFFE2B0, toneMapped: false })); lit.position.set(0, h / 2 + 0.112, 0.2); g.add(lit);
  try { Models.swap(g, 'lounge-props/' + name + '.glb', false); } catch (e) { /* the app's own */ }
  return g;
}
/** On the bar's corner, behind the counter: the bartender's mixing station (shaker, jigger, bar spoon, strainer,
 *  muddler on a rubber mat, a garnish tray with lemon, lime and orange). File: lounge-props/mixing-station.glb. */
function lgMixStation(root: any, x: number, y: number, z: number): any {
  const T = THREE, g = new T.Group(); g.name = 'mixing-station'; g.position.set(x, y, z); root.add(g);
  const steel = new T.MeshStandardMaterial({ color: 0xD8DCE0, metalness: 1, roughness: 0.18 }), wood = new T.MeshStandardMaterial({ map: ctTex(ctWood('#6B4428', '#2E1A0E', 5)), roughness: 0.45 });
  const add = (geo: any, m: any, px: number, py: number, pz: number) => { const o = new T.Mesh(geo, m); o.position.set(px, py, pz); o.castShadow = false; g.add(o); return o; };
  const lathe = (p: number[][], m: any, px: number, pz: number) => add(new T.LatheGeometry(p.map(q => new T.Vector2(q[0], q[1])), 24), m, px, 0, pz);
  add(new T.BoxGeometry(0.32, 0.01, 0.6), new T.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 }), 0, 0.005, 0);
  lathe([[0, 0], [0.042, 0], [0.046, 0.12], [0.045, 0.16], [0.038, 0.18], [0.03, 0.22], [0.016, 0.24], [0, 0.245]], steel, 0, -0.18);   // shaker
  lathe([[0, 0], [0.024, 0], [0.006, 0.045], [0.024, 0.09], [0, 0.09]], steel, -0.02, 0);                                                  // jigger
  add(new T.CylinderGeometry(0.003, 0.003, 0.32, 6), steel, 0.06, 0.014, 0.1).rotation.x = Math.PI / 2;                                    // bar spoon
  add(new T.CylinderGeometry(0.04, 0.04, 0.008, 20), steel, -0.08, 0.014, 0.18);                                                           // strainer
  add(new T.CylinderGeometry(0.012, 0.016, 0.24, 10), wood, 0.08, 0.022, -0.02).rotation.x = Math.PI / 2;                                  // muddler
  add(new T.BoxGeometry(0.16, 0.04, 0.28), wood, 0.2, 0.02, 0.05);                                                                          // garnish tray
  [0xF2D23A, 0x7BC043, 0xF28C28].forEach((col, i) => add(new T.CylinderGeometry(0.02, 0.02, 0.006, 16), new T.MeshStandardMaterial({ color: col, roughness: 0.6 }), 0.2, 0.045, -0.04 + i * 0.08));
  try { Models.swap(g, 'lounge-props/mixing-station.glb', false); } catch (e) { /* the app's own */ }
  return g;
}
