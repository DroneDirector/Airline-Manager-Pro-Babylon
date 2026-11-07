// The jetways J-1 to J-4: apron-drive passenger boarding bridges, one design for every jetway gate, each its own object
// with its id. As built:
// - the Fixed corridor: glazed, straight out from the gate's jetway door (its floor flush with the gate's floor at
//   +6.00), sloping down at JETWAY.tiltDeg; both its ends are cut plumb, flush with the gate's glass and with the
//   Rotunda's round wall. The Gate trim (a 15 cm steel frame) closes it against the gate's glass.
// - the Rotunda (3.6 m): it never moves. Inside it a turning sleeve with the Rotunda bellows' flange turns with the
//   jetway, so the bellows never stretch sideways, only when the jetway tilts.
// - the Tunnel: three glazed telescopic sections (walkway 2.5 m, a steel X truss outside the glass), the Cab bellows,
//   the round Cab with its own turning sleeve, its front turning to face the fuselage, the Canopy and the roll-up
//   shutter, the operator's console; the Drive unit (two lift columns, one each side of the tunnel: a wide sleeve on the
//   tunnel rides over a thinner leg on the base; the steered bogie, two pairs of wheels in tandem), the Service stair (its steps stay level).
// Inside: studded grey rubber floors, yellow and black edge strips at every joint, white ceiling panels with a
// continuous LED line, round handrails on brackets, backlit advertising panels, vents, a camera dome, exit signs, a
// fire extinguisher in its cabinet, the gate's sign, the access marking, the service door with its push bar.
// The wheels are the master: everything is worked out from where the drive unit is (docking and undocking below).
// Parts with a slot (wheels, bogie, lift columns, cab front, console, canopy, rotunda drum and machinery, stair,
// beacon, fire extinguisher; the bellows' and floors' pictures) can be replaced by your own models: models/README.md.
import { fileTex } from '../../core/filetex';
import { MeshBuilder, Mesh, Vector3, TransformNode, Matrix, VertexData, PointLight, SpotLight, Color3, Texture, StandardMaterial } from '@babylonjs/core';
import { SUN } from './weather';
import { Kit, P } from './kit';
import { F2Y, PN, jetwayAt } from './plan';
import { Geo } from './jw-geo';
import * as JX from './jw-tex';
import { slot, textureSlot, mediaSlot } from '../../core/replace';
import { IS_PC } from '../../core/app';
import { S as SET } from '../../core/settings';
import { EXTRA_LIGHTS } from '../../core/look';

/** The aircraft's front door (plan x, height, z) at a stand: 2.4 m left of the centre line, 5.5 m behind the nose, sill at 3.3 m. */
export const DOOR = (standX: number, nz: number) => [standX + 2.4, 3.3, nz + 5.5];

/** Settings for the jetways: the Fixed corridor's slope down from the gate (degrees). */
export const JETWAY = { tiltDeg: 5 };
/** The real times (seconds): docking (drive, final crawl with the cab turning, canopy and door), undocking (canopy, back away, drive home). */
export const JW_TIMES = { drive: 75, crawl: 30, canopy: 15, back: 20, home: 60 };

export type JetwayState = 'parked' | 'docking' | 'docked' | 'undocking';
export interface JetwayRig {
  id: string; node: TransformNode; state: JetwayState; moving: boolean; rest: any; pose: any; setPose(p: any): void; bellows: Mesh[];
  /** start docking / undocking (false if it cannot now) */ dock(): boolean; undock(): boolean;
  /** the test button: docks a parked jetway, undocks a docked one */ test(): void;
  /** put it straight into a state */ snap(s: 'parked' | 'docked'): void;
  update(dt: number): void; meshes(): any[];
}

// the shared finishes (made once per scene)
function mats(K: Kit) {
  const A: any = (K as any)._jwMats; if (A) return A;
  const { M } = K, alu = K.tex(JX.brushedAlu(), 0.5, 0.5), [sf, sh] = JX.studFloor();
  const floor = K.pbr({ key: 'jwStud', tex: K.tex(sf, 1, 1), metal: 0.05, rough: 0.62 }); floor.bumpTexture = K.tex(JX.normalMap(sh), 1, 1); (floor.bumpTexture as any).level = 0.8;
  const haz = K.tex(JX.hazard(), 1, 8);
  const m: any = {
    JS: K.pbr({ key: 'jwAluB', tex: alu, metal: 0.25, rough: 0.36 }), JT: K.pbr({ key: 'jwTruss', col: '#B3BAC1', metal: 0.2, rough: 0.35 }),
    JW: K.pbr({ key: 'jwPanel', col: '#E7EAED', rough: 0.5 }), JB: K.pbr({ key: 'jwBellows', col: '#2B2D31', rough: 0.8 }), JF: floor,
    JC: K.pbr({ key: 'jwCeil', tex: K.tex(JX.ceiling(), 1, 1), rough: 0.6, emis: '#FFFFFF', emisK: 0.14 }), JH: K.pbr({ key: 'jwHaz', tex: haz, rough: 0.6 }),
    JR: K.pbr({ key: 'jwRubber', col: '#1C1D20', rough: 0.92 }), JRed: K.pbr({ key: 'jwRed', col: '#C21E1A', rough: 0.28, coat: 0.5 }), JD: K.pbr({ key: 'jwDark', col: '#3A3F46', rough: 0.5 }),
    JG: K.pbr({ key: 'jwDome', col: '#101215', rough: 0.08, coat: 0.6 }), JGa: K.pbr({ key: 'jwGauge', col: '#F4F4F2', rough: 0.3 }), JBr: M.brass,
    JK: K.pbr({ key: 'jwFolds', col: '#B4BAC0', metal: 0.2, rough: 0.55 }), JKD: K.pbr({ key: 'jwFoldsDark', col: '#8E959C', metal: 0.2, rough: 0.6 }),
    JTy: (() => { const [rc, rh] = JX.rubber(), m = K.pbr({ key: 'jwTyre', tex: K.tex(rc, 8, 8), rough: 0.82 }); m.bumpTexture = K.tex(JX.normalMap(rh, 1.5), 8, 8); (m.bumpTexture as any).level = 0.6; return m; })(),
    JRim: K.pbr({ key: 'jwRim', tex: K.tex(JX.rimPaint(), 3, 3), metal: 0.35, rough: 0.42 }), JCap: K.pbr({ key: 'jwHubCap', col: '#D6DADE', metal: 0.6, rough: 0.22 }),
    JY: K.pbr({ key: 'jwHose', tex: K.tex(JX.hoseFabric(), 24, 1), rough: 0.55 }),
    JTread: (() => { const t = fileTex('jetway-tread', K.sc), b = fileTex('jetway-tread-normal', K.sc), m = K.pbr({ key: 'jwTread', rough: 0.86 }); m.albedoTexture = t; m.bumpTexture = b; (b as any).level = 1.1; return m; })(),
    JSide: (() => { const m = K.pbr({ key: 'jwTyreSide', rough: 0.8 }); const t = fileTex('jetway-tyre-side', K.sc); t.uScale = t.vScale = 4; m.albedoTexture = t; return m; })(),
    JClMid: (() => { const m = K.pbr({ key: 'jwCladMid', metal: 0.45, rough: 0.38 }); m.albedoTexture = fileTex('rotunda-clad-mid', K.sc); m.bumpTexture = fileTex('rotunda-clad-mid-normal', K.sc); (m.bumpTexture as any).level = 0.8; return m; })(),
    JClTop: (() => { const m = K.pbr({ key: 'jwCladTop', metal: 0.45, rough: 0.4 }); m.albedoTexture = fileTex('rotunda-clad-top', K.sc); (m.albedoTexture as any).wrapV = Texture.CLAMP_ADDRESSMODE; return m; })(),
    JClBot: (() => { const m = K.pbr({ key: 'jwCladBot', metal: 0.45, rough: 0.42 }); m.albedoTexture = fileTex('rotunda-clad-bot', K.sc); (m.albedoTexture as any).wrapV = Texture.CLAMP_ADDRESSMODE; return m; })(),
    JClEnd: (() => { const m = K.pbr({ key: 'jwCladEnd', metal: 0.45, rough: 0.4 }); m.albedoTexture = fileTex('rotunda-clad-end', K.sc); return m; })(),
    JRoof: (() => { const m = K.pbr({ key: 'jwRoof', metal: 0.3, rough: 0.6 }); const t = fileTex('rotunda-roof', K.sc); t.uScale = t.vScale = 0.4; m.albedoTexture = t; return m; })(),
    JUnder: (() => { const m = K.pbr({ key: 'jwUnder', metal: 0.25, rough: 0.7 }); const t = fileTex('rotunda-under', K.sc); t.uScale = t.vScale = 0.4; m.albedoTexture = t; return m; })(),
    JChrome: K.pbr({ key: 'jwChrome', col: '#EEF1F4', metal: 1, rough: 0.05 }),
    JL: K.pbr({ key: 'jwWall', tex: K.tex(JX.wallPanel(), 1 / 1.2, 1), metal: 0.1, rough: 0.42 }),
    JN: K.pbr({ key: 'jwSignBlue', col: '#1C2D72', rough: 0.4 }),
    JCarp: K.pbr({ key: 'jwCarpet', tex: K.tex(JX.carpet(), 1, 1), rough: 0.97 }),
    JSlat: (() => { const [sc0, sh] = JX.slatCeiling(), m = K.pbr({ key: 'jwSlats', tex: K.tex(sc0, 1, 1), metal: 0.35, rough: 0.3 }); m.bumpTexture = K.tex(JX.normalMap(sh, 2), 1, 1); (m.bumpTexture as any).level = 0.7; return m; })(),
    JSh: K.pbr({ key: 'jwShutter', tex: K.tex(JX.shutter(), 1, 1), metal: 0.3, rough: 0.4 }), glass: M.glass, yellow: M.yellow,
  };
  // the bellows: dark rubber with its fine lines running along every fold (assets/textures; 4 m to a picture, a line every 5 mm), its relief
  { const t = fileTex('jetway-bellows-rubber', K.sc), b = fileTex('jetway-bellows-rubber-normal', K.sc);
    for (const x of [t, b]) { x.uScale = x.vScale = 0.25; x.wrapU = x.wrapV = Texture.WRAP_ADDRESSMODE; x.anisotropicFilteringLevel = 16; }
    m.JK.albedoTexture = t; m.JK.albedoColor = new Color3(1, 1, 1); m.JK.bumpTexture = b; (b as any).level = 0.9; m.JK.metallic = 0; m.JK.roughness = 0.72; }
  // your own pictures for these, if you put them in models/ (see its README)
  textureSlot('jetway.floor', m.JF, 'Jetway floor'); textureSlot('jetway.bellows', m.JK, 'Jetway bellows'); textureSlot('jetway.cladding', m.JS, 'Jetway cladding'); textureSlot('jetway.ceiling', m.JC, 'Jetway ceiling');
  const pics = new Map<string, any>(); m.pic = (key: string, make: () => HTMLCanvasElement, glow = 1) => { let p = pics.get(key); if (!p) { p = K.picture(make(), glow); p.backFaceCulling = true; pics.set(key, p); } return p; };
  for (const v of Object.values(m)) if (v && (v as any).maxSimultaneousLights) (v as any).maxSimultaneousLights = 6;   // the sun, the sky and its own lights inside
  (K as any)._jwMats = m; return m;
}

export function buildJetway(K: Kit, n: number, gateX: number, stand: { x: number; nz: number }) {
  const { M, sc } = K, o = K.obj('APRON', 'JETWAY', gateX, F2Y, PN, 0, `J-${n}`); o.metadata.kind = 'jetway';
  const X = mats(K), { JS, JT, JW, JB, JF, JC, JH, JR, JRed, JD, JG, JGa, JBr, JK, JKD, JSh, JTy, JRim, JCap, JCarp, JSlat, JTread, JSide, JClMid, JClTop, JClBot, JClEnd, JRoof, JUnder } = X, JWa = X.JL, GL = M.glassOuter || M.glass;
  const MARK = K.glow('#FF8A00', 0.6); MARK.name = `J-${n}/MARKERS`;
  const LED = K.glow('#FFFFFF', 1.1); LED.name = `J-${n}/LED`;   // its own lights (brighter when docked)
  const meta = o.metadata, V = (x: number, y: number, z: number) => new Vector3(x, y, z);
  const node = (par: TransformNode, x: number, y: number, z: number, ry = 0, rx = 0, id?: string) => { const t = new TransformNode(id || K.nm('jw'), sc); t.parent = par; t.position.set(x, y, z); t.rotation.y = ry; t.rotation.x = rx; t.metadata = meta; return t; };
  const made: Mesh[] = [];
  const done = (g: Geo, par: TransformNode, id: string, deform?: (v: Vector3) => Vector3) => { const ms = g.build(sc, par, id, meta, deform); for (const m of ms) { made.push(m); K.casters.push(m); } return ms; };
  /** A picture on a plane (w × h) facing the yaw `face`; flat: lying face up (1) or face down (-1). */
  const pic = (par: TransformNode, mat: any, w: number, h: number, x: number, y: number, z: number, face: number, flat = 0) => {
    const p = MeshBuilder.CreatePlane(K.nm('jwp'), { width: w, height: h }, sc); p.material = mat; p.parent = par; p.position.set(x, y, z); p.metadata = meta; p.isPickable = false;
    if (flat) { p.rotation.x = flat * Math.PI / 2; p.rotation.y = flat > 0 ? face : face + Math.PI; } else p.rotation.y = face + Math.PI; made.push(p); return p; };
  /** A bellows (the flexible accordion joint) from frame a to frame b (four corners each in the jetway's frame: bottom
   *  left, bottom right, top right, top left, as you walk from a to b), sealed all round. One mesh, kind 'bellows'. */
  const bellowsMesh = (id: string, a: Vector3[], b: Vector3[], folds: number) => {
    const m = new Mesh(id, sc); m.parent = o; m.material = JK; m.receiveShadows = true;
    m.metadata = { id, kind: 'bellows', jetway: `J-${n}`, room: 'APRON', folds, a: a.map(v => v.asArray()), b: b.map(v => v.asArray()), pleat: 0.09 };
    applyBellows(m, a, b, folds, 0.09); K.casters.push(m); return m; };
  /** A yellow air hose (the aircraft's preconditioned air), hanging in a U between two metal pipes that come down from
   *  par at (x, y, z) and s further along x: each pipe with its bracket and clamp, the hose ribbed (corrugated, a rib
   *  every 7.5 cm), clamped into the pipes' ends. */
  const hoseU = (par: TransformNode, x: number, y: number, z: number, drop: number, s: number) => { const r = s / 2, PL = 0.7, y0 = y - PL + 0.08, pts: Vector3[] = [];
    const g = new Geo(); for (const xx of [x, x + s]) { g.box(JS, xx, y + 0.04, z, 0.42, 0.08, 0.42); g.lathe(JT, V(xx, y, z), V(xx, y - PL, z), [[0.19, 0], [0.19, 1]], 20); g.lathe(JD, V(xx, y - PL + 0.12, z), V(xx, y - PL - 0.02, z), [[0.205, 0], [0.205, 1]], 20);
      g.lathe(JD, V(xx, y - PL, z), V(xx, y - PL + 0.002, z), [[0.19, 0], [0.165, 1]], 20); for (const e of [-1, 1]) g.box(JD, xx + e * 0.21, y - PL + 0.05, z, 0.03, 0.06, 0.06); }
    done(g, par, `J-${n}/PCA-PIPES`);
    // the hose's centre line, densely: down, round the bottom, up again
    const d0 = Math.max(0.1, drop - PL - r), step = 0.0125;
    for (let t = 0; t < d0; t += step) pts.push(V(x, y0 - t, z));
    const arc = Math.PI * r; for (let t = 0; t <= arc; t += step) { const a = t / r; pts.push(V(x + r - r * Math.cos(a), y0 - d0 - r * Math.sin(a), z)); }
    for (let t = d0; t >= 0; t -= step) pts.push(V(x + s, y0 - t, z));
    // a soft hose: a chain of points held at both pipes, springing back to this shape, swaying in the wind, pushed aside by what it touches
    const NN = 22, idx = (k: number) => pts[Math.round(k / (NN - 1) * (pts.length - 1))], rest = Array.from({ length: NN }, (_, k) => idx(k).clone());
    hoses.push({ par, rest, x: [], p: [], len: rest.slice(1).map((v, k) => Vector3.Distance(v, rest[k])), M: Math.round(pts.length * 0.5), mesh: null, ph: hoses.length * 1.7, last: null }); };
  /** The hoses' simulation (in the jetway's frame), one step: the wind, the spring back to the hanging shape, gravity, their length kept, the colliders, both ends on their pipes. */
  const hoses: any[] = [], colliders: { nd: TransformNode; c: Vector3; h: Vector3 }[] = [], HR = 0.17;
  const collide = (nd: TransformNode, c: Vector3, h: Vector3) => colliders.push({ nd, c, h });
  // the hoses' cloth: worked out in place (no new objects every frame), the tube rebuilt only when a hose has really
  // moved (half a centimetre) and at most 30 times a second, and nothing at all while you are more than 90 m away
  const HW = V(0.75, 0, 0.66), HG = V(0, -1.5, 0), hv = V(0, 0, 0), ha = V(0, 0, 0), hdv = V(0, 0, 0), hl = V(0, 0, 0), hm = new Matrix();
  let hoseT = 0, hoseMats = false, hoseAcc = 0;
  const stepHoses = (dt: number, iters = 1) => {
    const cam = sc.activeCamera; if (cam && Vector3.Distance(cam.globalPosition, o.getAbsolutePosition()) > 90) return;
    // out of view: nothing to see, so nothing worked out (it carries on from where it was when it comes back into view)
    const hm0 = hoses.length && hoses[0].mesh; if (cam && hm0 && !cam.isInFrustum(hm0)) return;
    // where the hoses hang from and what they touch only moves while the jetway does: worked out again only then
    const still = (rig as any) && !rig.moving && (rig.state === 'parked' || rig.state === 'docked');
    if (!still || !hoseMats) { hoseMats = true;
      for (const cl of colliders as any[]) { if (!cl.m) { cl.m = new Matrix(); cl.inv = new Matrix(); } cl.nd.computeWorldMatrix(true).multiplyToRef(oInv, cl.m); cl.m.invertToRef(cl.inv); }
      for (const H of hoses) { if (!H.pm) H.pm = new Matrix(); H.par.computeWorldMatrix(true).multiplyToRef(oInv, H.pm); H.rwOk = false; } }
    if (!still) hoseMats = false;
    const now = performance.now(), mayBuild = now >= hoseT; if (mayBuild) hoseT = now + 33;
    for (const H of hoses) {
      if (!H.rw) H.rw = H.rest.map(() => V(0, 0, 0));
      if (!H.rwOk) { for (let k = 0; k < H.rest.length; k++) Vector3.TransformCoordinatesToRef(H.rest[k], H.pm, H.rw[k]); H.rwOk = true; }
      const rw: Vector3[] = H.rw;
      if (!H.x.length) { H.x = rw.map((v: Vector3) => v.clone()); H.p = rw.map((v: Vector3) => v.clone()); }
      for (let it = 0; it < iters; it++) { const t = clock + it * dt, gust = 0.5 + 0.35 * Math.sin(t * 0.8 + H.ph) + 0.15 * Math.sin(t * 2.3 + H.ph * 2);
        for (let k = 1; k < H.x.length - 1; k++) { const x: Vector3 = H.x[k], sag = Math.sin(Math.PI * k / (H.x.length - 1));
          x.subtractToRef(H.p[k], hv).scaleInPlace(0.94);
          rw[k].subtractToRef(x, ha).scaleInPlace(22).addInPlace(HG); ha.addInPlaceFromFloats(HW.x * 0.9 * gust * sag, 0, HW.z * 0.9 * gust * sag);
          H.p[k].copyFrom(x); x.addInPlace(hv).addInPlaceFromFloats(ha.x * dt * dt, ha.y * dt * dt, ha.z * dt * dt); }
        for (let pass = 0; pass < 4; pass++) {
          for (let k = 0; k < H.x.length - 1; k++) { H.x[k + 1].subtractToRef(H.x[k], hdv); const L0 = hdv.length() || 1e-6, e = (L0 - H.len[k]) / L0 * 0.5; const w0 = k === 0 ? 0 : 1, w1 = k + 1 === H.x.length - 1 ? 0 : 1, sw = w0 + w1 || 1;
            const f0 = e * 2 * w0 / sw, f1 = e * 2 * w1 / sw; H.x[k].addInPlaceFromFloats(hdv.x * f0, hdv.y * f0, hdv.z * f0); H.x[k + 1].addInPlaceFromFloats(-hdv.x * f1, -hdv.y * f1, -hdv.z * f1); }
          for (let k = 1; k < H.x.length - 1; k++) for (const C of colliders as any[]) { Vector3.TransformCoordinatesToRef(H.x[k], C.inv, hl); hl.subtractInPlace(C.c); const ex = C.h.x + HR - Math.abs(hl.x), ey = C.h.y + HR - Math.abs(hl.y), ez = C.h.z + HR - Math.abs(hl.z);
            if (ex > 0 && ey > 0 && ez > 0) { if (ex < ey && ex < ez) hl.x += Math.sign(hl.x || 1) * ex; else if (ey < ez) hl.y += Math.sign(hl.y || 1) * ey; else hl.z += Math.sign(hl.z || 1) * ez; hl.addInPlace(C.c); Vector3.TransformCoordinatesToRef(hl, C.m, H.x[k]); } }
          H.x[0].copyFrom(rw[0]); H.x[H.x.length - 1].copyFrom(rw[rw.length - 1]); } }
      // the tube again only when it has moved
      if (!mayBuild) continue;
      const moved = !H.last || H.x.some((v: Vector3, k: number) => Vector3.DistanceSquared(v, H.last[k]) > 2.5e-5); if (!moved) continue;
      if (!H.last) H.last = H.x.map((v: Vector3) => v.clone()); else for (let k = 0; k < H.x.length; k++) H.last[k].copyFrom(H.x[k]);
      if (!H.path) H.path = Array.from({ length: H.M }, () => V(0, 0, 0));
      const path: Vector3[] = H.path; for (let m = 0; m < H.M; m++) { const f = m / (H.M - 1) * (H.x.length - 1), k = Math.min(H.x.length - 2, Math.floor(f)), u = f - k;
        path[m].copyFrom(Vector3.CatmullRom(H.x[Math.max(0, k - 1)], H.x[k], H.x[k + 1], H.x[Math.min(H.x.length - 1, k + 2)], u)); }
      const rf = H.rf || (H.rf = (_i: number, dist: number) => 0.15 * (0.95 + 0.06 * Math.pow(0.5 + 0.5 * Math.cos(dist * Math.PI * 2 / 0.075), 2)));
      if (!H.mesh) { H.mesh = MeshBuilder.CreateTube(`J-${n}/PCA-HOSE`, { path, tessellation: 16, cap: Mesh.CAP_ALL, radiusFunction: rf, updatable: true } as any, sc); H.mesh.material = X.JY; H.mesh.parent = o; H.mesh.metadata = meta; H.mesh.receiveShadows = true; K.casters.push(H.mesh); made.push(H.mesh); }
      else MeshBuilder.CreateTube('', { path, radiusFunction: rf, instance: H.mesh } as any); } };
  const angD = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  /** A tyre from p to q (axis), outside radius R, bead r0, width w: rounded shoulders and sidewalls (rim guard, fine rings)
   *  in the tread's own colours; the tread band wrapped round in the tread picture, its chevrons at their true size. */
  const tyre = (g: Geo, p: Vector3, q: Vector3, R: number, r0: number, w: number) => { const full = tyreProfile(R, r0), n2 = full.length / 2, half = full.slice(0, n2);
    const side = half.filter(([, t]) => t <= 0.15), sideB = side.map(([r, t]) => [r, 1 - t]).reverse(), Rt = side[side.length - 1][0], ts = side[side.length - 1][1];
    g.lathe(JSide, p, q, side, 48); g.lathe(JSide, p, q, sideB, 48);
    const band = (1 - 2 * ts) * w, Nrep = Math.max(3, Math.round(2 * Math.PI * R / (band * 1.04)));
    g.lathe(JTread, p, q, [[Rt, ts], [Rt + 0.004 * R / 0.56, 0.5], [Rt, 1 - ts]], 72, (a, kk) => [kk / 2, a * Nrep]); };
  /** A round wall of radius rr, height h from y0, seg panels; skip(a) leaves a panel out (a: its yaw from the centre). */
  const drum = (g: Geo, rr: number, y0: number, h: number, seg: number, skip: (a: number) => boolean, ribs = true, mat: any = JWa) => { for (let i = 0; i < seg; i++) { const a = (i + 0.5) / seg * Math.PI * 2; if (skip(a)) continue;
    g.box(mat, Math.sin(a) * rr, y0 + h / 2, Math.cos(a) * rr, 2 * Math.PI * rr / seg * 1.06, h, 0.08, V(a, 0, 0));
    if (ribs && i % 2) g.box(JW, Math.sin(a) * (rr + 0.05), y0 + h / 2, Math.cos(a) * (rr + 0.05), 0.05, h, 0.12, V(a, 0, 0)); } };
  /** A disc (floor, roof) of radius r from y0 to y1. */
  const disc = (g: Geo, mat: any, r: number, y0: number, y1: number, seg = 32) => g.lathe(mat, V(0, y0, 0), V(0, y1, 0), [[0, 0], [r, 0], [r, 1], [0, 1]], seg);
  /** The flange round a drum's opening (radius rr, floor y0, top y1, half width hx), facing +z of g's frame; side -1
   *  turns its left and right (for a flange that is walked towards). Its four corners, for the bellows. */
  const flangeG = (g: Geo, rr: number, y0: number, y1: number, hx: number, side = 1) => { const d = Math.sqrt(Math.max(0.01, rr * rr - hx * hx));
    const Pq = [V(-hx * side, y0 - 0.24, d), V(hx * side, y0 - 0.24, d), V(hx * side, y1, d), V(-hx * side, y1, d)];
    for (const [p, q] of [[Pq[0], Pq[3]], [Pq[1], Pq[2]]]) { g.beam(JS, p, q, 0.18, 0.18);
      const rad = V(p.x, 0, p.z).normalize(); let tan = V(rad.z, 0, -rad.x); if (Vector3.Dot(tan, V(p.x, 0, 0)) < 0) tan = tan.scale(-1);
      g.box(JS, p.x + tan.x * 0.3, (p.y + q.y) / 2, p.z + tan.z * 0.3, 0.1, q.y - p.y, 0.7, V(Math.atan2(tan.x, tan.z), 0, 0)); }
    g.beam(JS, Pq[3], Pq[2], 0.18, 0.18); g.beam(JS, Pq[0], Pq[1], 0.18, 0.18); return Pq; };
  /** A handrail (polished chrome): a round rail at 0.95 m from p to q (along z), on brackets to the wall (wx: the wall's side, +1 / -1) every 1.5 m. */
  const rail = (g: Geo, x: number, y: number, z0: number, z1: number, wx: number, dy = (z: number) => 0) => {
    g.rod(X.JChrome, V(x, y + dy(z0), z0), V(x, y + dy(z1), z1), 0.022, 10);
    for (let z = z0 + 0.3; z < z1; z += 1.5) { g.rod(X.JChrome, V(x, y + dy(z) - 0.03, z), V(x, y + dy(z) - 0.09, z), 0.012, 6); g.rod(X.JChrome, V(x, y + dy(z) - 0.09, z), V(x + wx * 0.09, y + dy(z) - 0.09, z), 0.012, 6); g.box(X.JChrome, x + wx * 0.1, y + dy(z) - 0.09, z, 0.01, 0.08, 0.08); } };
  /** A ceiling hung sign (w × h) with a picture each side: front faces `face`. */
  const hung = (g: Geo, par: TransformNode, mf: any, mb: any, w: number, h: number, x: number, y: number, z: number, face: number) => {
    g.box(JW, x, y, z, w + 0.04, h + 0.04, 0.05, V(face, 0, 0)); g.rod(JS, V(x - w * 0.35, y + h / 2, z), V(x - w * 0.35, y + h / 2 + 0.25, z), 0.008, 6); g.rod(JS, V(x + w * 0.35, y + h / 2, z), V(x + w * 0.35, y + h / 2 + 0.25, z), 0.008, 6);
    const f = V(Math.sin(face), 0, Math.cos(face)).scale(0.027); pic(par, mf, w, h, x + f.x, y, z + f.z, face); if (mb) pic(par, mb, w, h, x - f.x, y, z - f.z, face + Math.PI); };

  // ---- the plan: the gate's door at the origin (its floor y = 0), x east, z out onto the apron ----
  const R = jetwayAt(gateX, stand.x, stand.nz).rotunda, D = DOOR(stand.x, stand.nz);
  const TILT = (JETWAY.tiltDeg || 0) * Math.PI / 180, k = Math.tan(TILT);
  const rx = R[0] - gateX, rz = R[1] - PN, dx = D[0] - gateX, dy = D[1] - F2Y, dz = D[2] - PN;
  const IW = 2.5, IH = 2.4, T = 0.14, RR = 1.8, CR = 1.7, FRONT = 1.4, GW = IW / 2 + 0.3, CH = 2.75;
  const cx = dx + 0.15 + FRONT + CR, cz = dz;                         // the cab's round part (the canopy's face at the door)
  const ax = rx - cx, az = rz - cz, hd = Math.hypot(ax, az), ux = -ax / hd, uz = -az / hd;   // rotunda -> cab, on the ground
  const ZC = rz - RR;                                                  // where the corridor meets the rotunda (on its axis)
  const tunYaw = Math.atan2(ux, uz), yR = -(ZC + 0.04) * k;            // the rotunda's floor, level with the corridor's end
  const hxA = IW / 2 + T / 2 + 0.11 + 0.18, hxB = IW / 2 + T / 2 + 0.18, gapR = Math.asin(Math.min(0.99, hxA / RR)), gapC = Math.asin(Math.min(0.99, hxB / CR)), gGate = Math.asin(Math.min(0.99, GW / RR));

  // ---- the Fixed corridor: built level and straight, then sloped by a shear (so it stays plumb: its uprights, glass
  // and both ends are vertical) and its far end cut to the rotunda's round wall; nothing in it ever moves ----
  { const g = new Geo(), END = 1000, ZM = END / 2, ends = (x: number) => rz - Math.sqrt(Math.max(0.0004, RR * RR - x * x)) + 0.05;
    const Lh = ZC;   // its length on its axis
    // the floor slab, the studded floor, the roof, the ceiling panels (to the rotunda's wall: cut there)
    g.box(JS, 0, -0.15, ZM, 2 * GW + 0.3, 0.3, END, undefined, 16); g.box(JF, 0, 0.01, ZM, 2 * GW, 0.02, END, undefined, 16);
    g.box(JS, 0, CH + 0.25, ZM, 2 * GW + 0.3, 0.2, END, undefined, 16); g.box(JC, 0, CH, ZM, 2 * GW - 0.1, 0.05, END, undefined, 16);
    // the continuous LED line down the middle and the light bars across it (as in the photograph)
    // the LED line and the light bars, kept clear of the hanging signs (no sign under a light)
    { const signsZ = [0.6, Lh - 1.2], cuts = signsZ.map(z => [z - 0.45, z + 0.45]).sort((a, b) => a[0] - b[0]); let z0 = 0.3;
      for (const [c0, c1] of cuts.concat([[Lh - 0.3, Lh]])) { if (c0 > z0 + 0.1) g.box(LED, 0, CH - 0.03, (z0 + c0) / 2, 0.06, 0.02, c0 - z0); z0 = Math.max(z0, c1); }
      for (let z = 1.2; z < Lh - 0.6; z += 2.4) if (signsZ.every(sz => Math.abs(sz - z) > 0.55)) g.box(LED, 0, CH - 0.035, z, 1.7, 0.02, 0.08); }
    // the yellow and black strips at its two ends (the joint with the gate, the step into the rotunda)
    g.box(JH, 0, 0.025, 0.08, 2 * GW - 0.04, 0.012, 0.14); g.box(JH, 0, 0.025, Lh - 0.12, 2 * Math.min(GW, RR - 0.1) - 0.1, 0.012, 0.14);
    for (const sx of [-1, 1]) { const gx = sx * GW;
      g.box(JW, gx, 0.13, ZM, 0.12, 0.26, END, undefined, 1); g.box(GL, gx, 0.26 + (CH - 0.26) / 2, ZM, 0.04, CH - 0.26, END); g.box(JW, gx, CH - 0.05, ZM, 0.16, 0.3, END);
      g.box(JS, gx + sx * 0.14, CH + 0.12, ZM, 0.04, 0.45, END);   // the fascia outside
      // the mullions: an upright every 2.4 m and a diagonal across every bay, zigzag
      const bays = Math.max(1, Math.round(Lh / 2.4)), bl = (Lh - 0.3) / bays, mx = gx - sx * 0.12;
      for (let i = 0; i <= bays; i++) { g.box(JT, mx, 0.26 + (CH - 0.26) / 2, Math.max(0.05, i * bl), 0.12, CH - 0.26, 0.1); g.box(JWa, mx - sx * 0.062, 0.26 + (CH - 0.26) / 2, Math.max(0.05, i * bl), 0.004, CH - 0.27, 0.1); }   // the uprights, clad inside
      for (let i = 0; i < bays; i++) { const a = i % 2 ? [i * bl, CH - 0.2] : [i * bl, 0.3], b = i % 2 ? [(i + 1) * bl, 0.3] : [(i + 1) * bl, CH - 0.2]; g.beam(JT, V(mx, a[1], a[0]), V(mx, b[1], b[0]), 0.1, 0.16); }
      rail(g, gx - sx * 0.3, 0.95, sx > 0 ? 2.5 : 0.3, Lh - 0.5, sx); }
    // a solid wall bay each side by the gate: the fire extinguisher's cabinet on the right, a backlit advert on the left
    for (const sx of [-1, 1]) g.box(JW, sx * (GW - 0.1), CH / 2, 1.5, 0.06, CH - 0.1, 1.6);
    { const cbx = GW - 0.3, cz0 = 1.5;
      // an open red cabinet (white inside) with a glazed door in a red frame
      g.box(JW, cbx + 0.14, 1.1, cz0, 0.02, 0.8, 0.42); for (const e of [-1, 1]) { g.box(JRed, cbx + 0.03, 1.1, cz0 + e * 0.2, 0.22, 0.8, 0.02); g.box(JRed, cbx + 0.03, 1.1 + e * 0.39, cz0, 0.22, 0.02, 0.42); }
      for (const e of [-1, 1]) { g.box(JRed, cbx - 0.085, 1.1, cz0 + e * 0.19, 0.02, 0.8, 0.04); g.box(JRed, cbx - 0.085, 1.1 + e * 0.38, cz0, 0.02, 0.04, 0.42); }
      g.box(GL, cbx - 0.082, 1.1, cz0, 0.008, 0.72, 0.34); g.box(JS, cbx - 0.1, 1.2, cz0 - 0.15, 0.03, 0.1, 0.02); }   // the glass, its handle
    { const ab = -GW + 0.2; g.box(JW, ab, 1.45, 1.5, 0.12, 2.0, 1.0); }
    // the vents and the camera dome in the ceiling
    for (let z = 3.6; z < Lh - 1; z += 4.8) for (const sx of [-1, 1]) g.box(JD, sx * 0.9, CH - 0.03, z, 0.6, 0.02, 0.3);
    g.lathe(JW, V(0.8, CH - 0.02, 0.9), V(0.8, CH - 0.05, 0.9), [[0, 0], [0.1, 0], [0.1, 1], [0, 1]], 20);
    g.lathe(JG, V(0.8, CH - 0.05, 0.9), V(0.8, CH - 0.14, 0.9), [[0.075, 0], [0.072, 0.35], [0.06, 0.65], [0.035, 0.9], [0, 1]], 20);
    // shear it (the floor drops k per metre out from the gate) and cut its end to the rotunda's wall
    done(g, o, `J-${n}/CORRIDOR`, v => { const z = v.z >= END - 1 ? ends(v.x) : v.z; return V(v.x, v.y - z * k, z); });
    // its pictures (after the shear: each at its own height)
    const yk = (y: number, z: number) => y - z * k;
    pic(o, X.pic('ad0', () => JX.adPanel('#1C3A8A', '#3FD3E6', 0), 1.3), 0.8, 1.6, -GW + 0.265, yk(1.45, 1.5), 1.5, Math.PI / 2);
    mediaSlot(['jetway.ad-1', 'jetway.ad'], X.pic('ad0', () => JX.adPanel('#1C3A8A', '#3FD3E6', 0), 1.3), 0.5, 'Corridor advertising panel');
    pic(o, X.pic('ext', () => JX.extSign(), 1), 0.22, 0.29, GW - 0.135, yk(1.78, 1.5), 1.5, -Math.PI / 2);
    const gs = new Geo();
    hung(gs, o, X.pic(`gate${n}`, () => P.sign(`Gate ${n}`, '#14202E', '#F2C230', 512, 128, '700 70px Arial, sans-serif'), 1.2), X.pic('exitL', () => JX.exitSign(-1), 1.2), 1.2, 0.3, 0, yk(CH - 0.32, 0.6), 0.6, Math.PI);
    hung(gs, o, X.pic('exitR', () => JX.exitSign(1), 1.2), null, 0.6, 0.3, 0, yk(CH - 0.32, Lh - 1.2), Lh - 1.2, 0);
    for (let z = 3.6; z < Lh - 1; z += 4.8) for (const sx of [-1, 1]) pic(o, X.pic('grille', () => JX.grille(), 0), 0.56, 0.26, sx * 0.9, yk(CH - 0.045, z), z, 0, -1);
    done(gs, o, `J-${n}/CORRIDOR-SIGNS`);
    // the fire extinguisher in its cabinet (a slot: your own model can take its place)
    const fe = slot(node(o, GW - 0.27, yk(0.78, 1.5), 1.5, -Math.PI / 2, 0, `J-${n}/FIRE-EXTINGUISHER`), 'jetway.fire-extinguisher', { title: 'Jetway fire extinguisher', size: [0.2, 0.6, 0.2], origin: 'base' });
    extinguisher(fe);
    // the Gate trim: a 15 cm steel frame on the gate's glass round the corridor (its sides and top; none below, so it is walked through)
    const gt = new Geo(), tx = GW + 0.15 + 0.075; for (const sx of [-1, 1]) gt.box(JT, sx * tx, (CH + 0.2) / 2, 0.07, 0.15, CH + 0.8, 0.16);
    gt.box(JT, 0, CH + 0.425, 0.07, 2 * tx + 0.15, 0.15, 0.16);
    // the corridor's columns down to the apron
    for (let z = Math.min(4, Lh / 2); z < Lh - 1; z += 6) for (const sx of [-1, 1]) { const top = -z * k - 0.3; gt.box(JS, sx * (GW - 0.1), (top - F2Y) / 2, z, 0.3, top + F2Y, 0.3); K.block(1, gateX + sx * (GW - 0.1) - 0.3, PN + z - 0.3, gateX + sx * (GW - 0.1) + 0.3, PN + z + 0.3); }
    done(gt, o, `J-${n}/GATE-TRIM`); }

  // ---- the Rotunda: round, 3.6 m, fixed on two columns (it never turns or tilts); open towards the corridor and, on the
  // apron's side, as far as the jetway turns: there its turning sleeve closes it ----
  const SW = 0.45;   // how far the jetway turns either way (radians)
  const tR = node(o, rx, yR, rz, 0, 0, `J-${n}/ROTUNDA`), RC = CH;   // its ceiling flush with the corridor's, its roof with the corridor's roof
  { const g = new Geo(); disc(g, JUnder, RR + 0.05, -0.22, 0); disc(g, JCarp, RR - 0.05, 0, 0.02); disc(g, JRoof, RR + 0.12, RC + 0.04, RC + 0.35); disc(g, JSlat, RR + 0.02, RC, RC + 0.04);
    g.lathe(LED, V(0, RC - 0.002, 0), V(0, RC - 0.012, 0), [[0.62, 0], [0.62, 1], [0.56, 1], [0.56, 0]], 32);
    // the access marking and the edge strip at the tunnel's mouth (floor)
    g.box(JH, Math.sin(tunYaw) * (RR - 0.45), 0.03, Math.cos(tunYaw) * (RR - 0.45), 2 * hxA - 0.5, 0.012, 0.14, V(tunYaw, 0, 0));
    // the columns down to the apron, a cross brace, the footing
    for (const sx of [-0.7, 0.7]) { g.box(JS, sx, -(F2Y + yR) / 2 - 0.11, 0.6, 0.36, F2Y + yR - 0.22, 0.36); collide(tR, V(sx, -(F2Y + yR) / 2 - 0.11, 0.6), V(0.18, (F2Y + yR - 0.22) / 2, 0.18)); }
    if (F2Y + yR > 2.2) { g.beam(JS, V(-0.7, -(F2Y + yR) + 0.6, 0.6), V(0.7, -1.2, 0.6), 0.12, 0.12); g.beam(JS, V(0.7, -(F2Y + yR) + 0.6, 0.6), V(-0.7, -1.2, 0.6), 0.12, 0.12); }
    g.box(JS, 0, -(F2Y + yR) + 0.15, 0.6, 2.0, 0.3, 1.0);
    g.box(JW, RR + 0.3, 1.2, 0.3, 0.7, 1.6, 1.0); g.box(JS, RR + 0.66, 1.2, 0.3, 0.02, 1.2, 0.8);
    done(g, tR, `J-${n}/ROTUNDA`);
    pic(tR, X.pic('access', () => JX.access(), 0), 0.7, 0.7, -0.5, 0.025, -0.6, 0, 1);
    // the drum (fixed; a slot) and the machinery on top (a slot)
    const dr = slot(node(tR, 0, 0, 0, 0, 0, `J-${n}/ROTUNDA-DRUM`), 'jetway.rotunda-drum', { title: 'Jetway rotunda drum', size: [3.7, 2.7, 3.7], origin: 'base' });
    { const gd = new Geo(), H = RC + 0.05, seg = 32, skip = (a: number) => angD(a, Math.PI) < gGate || angD(a, tunYaw) < gapR + SW; drum(gd, RR, 0, H, seg, skip, false);
      // its cladding, outside only: the ribbed panels (1.2 m to a picture, square, seamless), the top band with its rim
      // and a real lip, the bottom band with its rivets, an end strip where each run of cladding stops at an opening
      const CW = 1.2, HB = 0.32, HT = 0.3, RO = RR + 0.046, da = Math.PI * 2 / seg, P = (a: number, y: number, r = RO) => V(Math.sin(a) * r, y, Math.cos(a) * r);
      for (let i = 0; i < seg; i++) { const a0 = i * da, a1 = (i + 1) * da; if (skip((i + 0.5) * da)) continue;
        const u0 = a0 * RO / CW, u1 = a1 * RO / CW, nm = V(Math.sin((a0 + a1) / 2), 0, Math.cos((a0 + a1) / 2));
        gd.quad(JClBot, P(a0, 0), P(a1, 0), P(a1, HB), P(a0, HB), nm, [u0, 0, u1, 0, u1, 1, u0, 1]);
        gd.quad(JClMid, P(a0, HB), P(a1, HB), P(a1, H - HT), P(a0, H - HT), nm, [u0, HB / CW, u1, HB / CW, u1, (H - HT) / CW, u0, (H - HT) / CW]);
        gd.quad(JClTop, P(a0, H - HT), P(a1, H - HT), P(a1, H), P(a0, H), nm, [u0, 0, u1, 0, u1, 1, u0, 1]);
        gd.box(JS, Math.sin((a0 + a1) / 2) * (RR + 0.085), H - 0.035, Math.cos((a0 + a1) / 2) * (RR + 0.085), 2 * Math.PI * (RR + 0.085) / seg * 1.04, 0.06, 0.07, V((a0 + a1) / 2, 0, 0));   // the lip
        for (const [e, ae] of [[skip((i - 0.5) * da), a0], [skip((i + 1.5) * da), a1]] as [boolean, number][]) if (e) {   // the end of a run: the folded end strip, its picture
          const t = V(Math.cos(ae), 0, -Math.sin(ae)), sg = ae === a0 ? 1 : -1, c = P(ae, H / 2, RR + 0.07);
          void sg; gd.box(JS, c.x, H / 2, c.z, 0.05, H, 0.1, V(ae, 0, 0)); const q0 = P(ae, 0, RR + 0.121).add(t.scale(-0.025)), q1 = q0.add(t.scale(0.05));
          gd.quad(JClEnd, q0, q1, q1.add(V(0, H, 0)), q0.add(V(0, H, 0)), V(Math.sin(ae), 0, Math.cos(ae)), [0, 0, 1, 0, 1, H / CW, 0, H / CW]); } }
      done(gd, dr, `J-${n}/ROTUNDA-DRUM`); }
    const mc = slot(node(tR, 0.2, RC + 0.35, 0.1, 0, 0, `J-${n}/ROTUNDA-MACHINERY`), 'jetway.rotunda-machinery', { title: 'Jetway rotunda machinery', size: [1.6, 0.8, 1.2], origin: 'base' });
    { const gm = new Geo(); gm.box(JW, 0, 0.35, 0, 1.6, 0.7, 1.2); gm.box(JS, 0, 0.74, 0, 1.5, 0.08, 1.1); gm.lathe(JD, V(-0.5, 0.78, 0), V(-0.5, 0.95, 0), [[0.18, 0], [0.18, 1], [0, 1]], 16); done(gm, mc, `J-${n}/ROTUNDA-MACHINERY`); }
    { const hdp = Math.max(0.9, Math.min(2.6, F2Y + yR - 1.0)); hoseU(tR, -0.85, -0.22, -0.45, hdp, 0.62); hoseU(tR, 0.2, -0.22, -0.85, hdp * 0.86, 0.62); }   // under the rotunda's floor, beside its columns
    K.block(1, R[0] - 1.2, R[1] - 0.4, R[0] + 1.2, R[1] + 1.6); }

  // ---- the moving jetway, round the fixed rotunda: it turns (yaw) and tilts (pitch) about the rotunda's opening, its three
  // sections telescope, the cab at its end stays level and turns to face the fuselage ----
  const A = V(rx + ux * (RR - 0.25), yR, rz + uz * (RR - 0.25)), B = V(cx - ux * (CR - 0.25), dy, cz - uz * (CR - 0.25)), AB = B.subtract(A), L = AB.length();
  const tunPitch = -Math.atan2(AB.y, Math.hypot(AB.x, AB.z)), BD = 1.25;
  const boom = node(o, rx, yR, rz, tunYaw, 0, `J-${n}/ROTUNDA-SLEEVE`), bp = node(boom, 0, 0, RR - 0.25, 0, tunPitch);
  // the rotunda's turning sleeve: a ring of wall inside the drum round the bellows' opening, its flange; it turns with the jetway
  let fa: Vector3[];
  { const g = new Geo(); drum(g, RR - 0.07, 0.02, RC - 0.02, 32, a => angD(a, 0) < gapR || angD(a, 0) > gapR + 2 * SW + 0.12 || angD(a, Math.PI - tunYaw) < gGate + 0.1, false);
    g.lathe(JD, V(0, RC + 0.07, 0), V(0, RC + 0.11, 0), [[RR - 0.12, 0], [RR - 0.02, 0], [RR - 0.02, 1], [RR - 0.12, 1]], 40);   // the slewing ring (in the roof, above the ceiling)
    fa = flangeG(g, RR, 0, IH + 0.3, hxA); g.box(JWa, 0, (IH + 0.39 + RC) / 2, Math.sqrt(RR * RR - hxA * hxA) - 0.12, 2 * hxA + 0.4, RC - IH - 0.38, 0.05); done(g, boom, `J-${n}/ROTUNDA-SLEEVE`);
    pic(boom, X.pic('mind', () => P.sign('MIND THE STEP', '#F2C230', '#111111', 512, 96, '800 52px Arial, sans-serif'), 0.9), 1.1, 0.2, 0, IH + 0.05, Math.sqrt(RR * RR - hxA * hxA) - 0.16, Math.PI); }
  // the three sections: fixed lengths, each nesting inside the one before; every joint keeps at least OV of overlap, so
  // the tunnel telescopes from 8.0 m (fully in) to 19.8 m (fully out) and never shows a section detached
  const SEC = [{ l: 8.0, g: 0.22 }, { l: 7.6, g: 0.11 }, { l: 7.2, g: 0 }], OV = 1.5;
  const fyOf = (g: number) => 0.012 * (0.22 - g) / 0.11;
  // where the drive unit is on the last section (from its back end)
  const reach = Math.hypot(D[0] - R[0], D[2] - R[1]), zW = Math.max(1, SEC[2].l - 1.0), zL = Math.max(0.8, zW - 1.6);   // the drive unit, the stair's landing
  const secNodes = SEC.map((s0, si) => { const t = node(bp, 0, 0, 0, 0, 0, `J-${n}/TUNNEL-${si + 1}`), { l, g: gg } = s0, zm = l / 2, hw = IW / 2 + T / 2 + gg / 2, fy = fyOf(gg), G = new Geo();
    G.box(JS, 0, fy - 0.11, zm, IW + 0.3 + gg, 0.22, l); G.box(JCarp, 0, fy + 0.01, zm, IW + gg * 0.5, 0.02, l); for (const sx of [-1, 1]) G.box(JH, sx * (IW / 2 + gg * 0.25 - 0.04), fy + 0.022, zm, 0.06, 0.006, l - 0.1);
    G.box(JSlat, 0, IH + gg - 0.01, zm, IW + gg * 0.5 + 0.1, 0.04, l);
    for (let z = 1.0; z < l - 0.6; z += 2.6) { G.box(JW, 0, IH + gg - 0.034, z, 0.72, 0.012, 1.22); G.box(LED, 0, IH + gg - 0.036, z, 0.62, 0.012, 1.12); }
    for (const sx of [-1, 1]) { const x = sx * hw;
      G.box(JWa, x, 0.225, zm, T, 0.45, l); G.box(GL, x, 0.45 + (IH - 0.45 + gg) / 2, zm, T * 0.4, IH - 0.45 + gg, l); G.box(JS, x, IH + gg + 0.11, zm, T + 0.04, 0.22, l);
      rail(G, sx * (IW / 2 - 0.1), 0.95, 0.2, l - 0.2, sx);
      // the X truss outside the glass, a bay every 2 m
      const so = x + sx * 0.12, bays = Math.max(1, Math.round(l / 2)), bl = l / bays;
      for (let i = 0; i <= bays; i++) G.box(JS, so, 0.45 + (IH + gg - 0.45) / 2, i * bl, 0.1, IH + gg - 0.2, 0.1);
      G.box(JS, so, 0.45, zm, 0.1, 0.1, l); G.box(JS, so, IH + gg, zm, 0.1, 0.1, l);
      for (let i = 0; i < bays; i++) { const b0 = i * bl; G.beam(JT, V(so, 0.45, b0), V(so, IH + gg, b0 + bl), 0.08, 0.08); G.beam(JT, V(so, IH + gg, b0), V(so, 0.45, b0 + bl), 0.08, 0.08); } }
    G.box(JW, 0, IH + gg + 0.29, zm, IW + 2 * T + gg + 0.1, 0.14, l); for (let z = 0.6; z < l; z += 1.2) G.box(JS, 0, IH + gg + 0.37, z, IW + 2 * T + gg + 0.14, 0.03, 0.06);
    for (const ze of [0.08, l - 0.08]) for (const sx of [-1, 1]) G.box(JWa, sx * (hw + 0.012), (IH + gg) / 2 + 0.01, ze, 0.006, IH + gg - 0.02, 0.16);   // the uprights, clad inside
    for (const ze of [0.08, l - 0.08]) { G.box(JS, 0, IH + gg + 0.2, ze, IW + 2 * T + gg + 0.3, 0.16, 0.16); for (const sx of [-1, 1]) G.box(JS, sx * (hw + 0.1), (IH + gg) / 2, ze, 0.16, IH + gg + 0.3, 0.16); }
    // the sliding floor plate at its back end (it rides on the bigger section's floor), its yellow and black leading edge
    if (si > 0) { const gp = SEC[si - 1].g, hp = IW / 2 + T / 2 + gp / 2;
      // the joint with the bigger section: a sloped slatted ceiling up to its ceiling (a white edge), the side walls closed
      G.beam(JSlat, V(0, IH + gg - 0.035, 0.06), V(0, IH + gp - 0.032, -0.5), IW + gg * 0.5 + 0.06, 0.02); G.box(JW, 0, IH + gg - 0.045, 0.07, IW + gg * 0.5 + 0.06, 0.02, 0.04);
      for (const sx of [-1, 1]) G.box(JWa, sx * (hw + hp) / 2 - sx * 0.04, (IH + gp) / 2, -0.3, hp - hw + 0.04, IH + gp - 0.02, 0.03); }
    if (si > 0) { const fyp = fyOf(SEC[si - 1].g); G.beam(JS, V(0, fyp + 0.025, -0.45), V(0, fy + 0.03, 0.05), IW - 0.1, 0.02); G.box(JH, 0, fyp + 0.034, -0.4, IW - 0.12, 0.012, 0.1); }
    // vents, a camera, the exit signs, an advert (section 1), the service door with its push bar (section 3, by the stair)
    G.box(JD, 0.75, IH + gg - 0.03, zm, 0.5, 0.02, 0.26);
    if (si === 0) { G.box(JW, -(IW / 2 - 0.02), 1.45, zm, 0.1, 1.9, 0.95); pic(t, X.pic('ad1', () => JX.adPanel('#1C3A8A', '#3FD3E6', 1), 1.3), 0.78, 1.56, -(IW / 2 - 0.08), 1.45, zm, Math.PI / 2); mediaSlot(['jetway.ad-2', 'jetway.ad'], X.pic('ad1', () => JX.adPanel('#1C3A8A', '#3FD3E6', 1), 1.3), 0.5, 'Tunnel advertising panel');
      G.lathe(JW, V(-0.8, IH + gg - 0.03, 0.6), V(-0.8, IH + gg - 0.06, 0.6), [[0, 0], [0.1, 0], [0.1, 1], [0, 1]], 20); G.lathe(JG, V(-0.8, IH + gg - 0.06, 0.6), V(-0.8, IH + gg - 0.15, 0.6), [[0.075, 0], [0.072, 0.35], [0.06, 0.65], [0.035, 0.9], [0, 1]], 20); }
    if (si === 2) { const zd = Math.max(0.8, Math.min(l - 0.8, zL)), x = IW / 2 - 0.02;
      G.box(JW, x, 1.08, zd, 0.06, 2.1, 0.95); G.box(JS, x - 0.035, 1.08, zd, 0.02, 2.12, 0.04); G.box(GL, x - 0.04, 1.6, zd, 0.012, 0.5, 0.3);
      G.rod(JS, V(x - 0.1, 1.0, zd - 0.38), V(x - 0.1, 1.0, zd + 0.38), 0.02, 10); for (const e of [-0.38, 0.38]) G.box(JS, x - 0.06, 1.0, zd + e, 0.08, 0.06, 0.04);
      hung(G, t, X.pic('exitL', () => JX.exitSign(-1), 1.2), X.pic('exitR', () => JX.exitSign(1), 1.2), 0.6, 0.3, 0, IH + gg - 0.3, l > 3 ? 2.3 : Math.max(0.4, l - 0.5), Math.PI);   // between the ceiling's light panels
      pic(t, X.pic('svc', () => P.sign('SERVICE STAIR · STAFF ONLY', '#14202E', '#F2F4F7', 512, 80, '700 34px Arial, sans-serif'), 0.6), 0.8, 0.12, x - 0.04, 2.28, zd, -Math.PI / 2); }
    done(G, t, `J-${n}/TUNNEL-${si + 1}`); return t; });
  /** A section end as a bellows frame (in the section's own frame). */
  const secFrame = (z: number, g: number) => { const hx = IW / 2 + T / 2 + g / 2 + 0.18; return [V(-hx, -0.24, z), V(hx, -0.24, z), V(hx, IH + g + 0.38, z), V(-hx, IH + g + 0.38, z)]; };

  // ---- the Cab: level, at the tunnel's end; it turns about its middle (pose.cab) to face the fuselage. Its round wall
  // has a turning sleeve with the Cab bellows' flange, turning with the tunnel ----
  const cabN = node(o, cx, dy, cz, 0, 0, `J-${n}/CAB`);
  const fx0 = -CR + 0.3, fx1 = -CR - FRONT, fm = (fx0 + fx1) / 2, fw = fx0 - fx1, FG = 0.9;
  { const g = new Geo(); disc(g, JS, CR + 0.05, -0.22, 0, 28); disc(g, JCarp, CR - 0.05, 0, 0.02, 28); disc(g, JS, CR + 0.1, IH + 0.2, IH + 0.4, 28); disc(g, JSlat, CR, IH + 0.16, IH + 0.2, 28);
    g.lathe(LED, V(0, IH + 0.15, 0), V(0, IH + 0.14, 0), [[0.5, 0], [0.5, 1], [0.44, 1], [0.44, 0]], 28);
    drum(g, CR, 0, IH + 0.2, 26, a => angD(a, -Math.PI / 2) < FG || angD(a, tunYaw + Math.PI) < gapC + 0.4);
    // the walls closing the corners between the round wall's ends and the front's side walls (full height, no gaps)
    for (const e of [-1, 1]) { const a0 = -Math.PI / 2 - e * (FG - 0.06), p0 = V(Math.sin(a0) * CR, 0, Math.cos(a0) * CR), p1 = V(-CR + 0.32, 0, Math.sign(Math.cos(a0)) * 1.79), d = p1.subtract(p0), L0 = d.length(), mid = p0.add(p1).scale(0.5);
      g.box(JWa, mid.x, (IH + 0.2) / 2, mid.z, 0.08, IH + 0.2, L0 + 0.1, V(Math.atan2(d.x, d.z), 0, 0));
      { const sg = Math.sign(Math.cos(a0)), fx0 = -CR + 0.3, aq = Math.atan2(fx0, sg * Math.sqrt(CR * CR - fx0 * fx0)), apex = V(fx0 - 0.02, 0.0205, sg * 1.79), N0 = 8;   // the floor: carpet out to the walls
        for (let k2 = 0; k2 < N0; k2++) { const b0 = a0 + (aq - a0) * k2 / N0, b1 = a0 + (aq - a0) * (k2 + 1) / N0, q0 = V(Math.sin(b0) * (CR + 0.01), 0.0205, Math.cos(b0) * (CR + 0.01)), q1 = V(Math.sin(b1) * (CR + 0.01), 0.0205, Math.cos(b1) * (CR + 0.01));
          g.quad(JCarp, apex, q0, q1, q1, V(0, 1, 0)); } } g.box(JSlat, mid.x, IH + 0.178, mid.z - Math.sign(Math.cos(a0)) * 0.12, 0.5, 0.036, L0, V(Math.atan2(d.x, d.z), 0, 0)); }
    done(g, cabN, `J-${n}/CAB`); }
  const cabSl = node(cabN, 0, 0, 0, Math.PI + tunYaw, 0, `J-${n}/CAB-SLEEVE`); let fbL: Vector3[];
  { const g = new Geo(); drum(g, CR - 0.07, 0.02, IH + 0.16, 26, a => angD(a, 0) < gapC || angD(a, 0) > gapC + 0.7 || angD(a + Math.PI + tunYaw, -Math.PI / 2) < FG + 0.5, false);
    g.lathe(JD, V(0, IH + 0.24, 0), V(0, IH + 0.28, 0), [[CR - 0.12, 0], [CR - 0.02, 0], [CR - 0.02, 1], [CR - 0.12, 1]], 32);
    fbL = flangeG(g, CR, 0, IH + 0.2, hxB, -1); done(g, cabSl, `J-${n}/CAB-SLEEVE`); }
  // the cab front (a slot): from the round part to the door (towards -x, the aircraft), 3.6 m wide, its side windows
  const cf = slot(node(cabN, fm, 0, 0, 0, 0, `J-${n}/CAB-FRONT`), 'jetway.cab-front', { title: 'Jetway cab front', size: [fw + 0.3, IH + 0.4, 3.7], origin: 'base' });
  { const g = new Geo(); g.box(JS, 0, -0.11, 0, fw + 0.2, 0.22, 3.6); g.box(JCarp, 0, 0.0115, 0, fw + 0.02, 0.021, 3.4); g.box(JS, 0, IH + 0.3, 0, fw + 0.3, 0.18, 3.7); g.box(JSlat, 0, IH + 0.177, 0, fw + 0.02, 0.038, 3.6);
    for (const sz of [-1, 1]) { const zi = sz * 1.744, ww = fw * 0.74, side = (fw - ww) / 2;   // the grey wall covering inside, round the window
      g.box(JWa, 0, 0.56, zi, fw, 1.08, 0.008); g.box(JWa, 0, (2.0 + IH + 0.16) / 2, zi, fw, IH + 0.16 - 2.0, 0.008); for (const e of [-1, 1]) g.box(JWa, e * (ww / 2 + side / 2), 1.55, zi, side, 0.9, 0.008); }
    for (const sz of [-1, 1]) { g.box(JS, 0, (IH + 0.2) / 2, sz * 1.8, fw, IH + 0.2, 0.1); g.box(GL, 0, 1.55, sz * 1.86, fw * 0.7, 0.8, 0.03); g.box(JW, 0, 1.12, sz * 1.84, fw * 0.74, 0.05, 0.05); g.box(JW, 0, 1.98, sz * 1.84, fw * 0.74, 0.05, 0.05); }
    g.box(JH, -fw / 2 + 0.12, 0.025, 0, 0.14, 0.012, 3.0);
    // the doorway's surround on the cab's front (the canopy's folds behind it hidden from inside): its jambs and its head
    for (const e of [-1, 1]) g.box(X.JL, -fw / 2 + 0.035, (IH + 0.2) / 2, e * 1.485, 0.05, IH + 0.2, 0.63);
    g.box(X.JL, -fw / 2 + 0.035, IH + 0.3, 0, 0.05, 0.2, 3.6);
    // the fixed panel beside the doors, its window; the doors' head
    { const zc = (0.35 + 1.17) / 2, wz = 1.17 - 0.35, xx = -fw / 2 + 0.1; g.box(JWa, xx, (IH - 0.04) / 2, zc, 0.05, IH - 0.04, wz); g.box(GL, xx - 0.005, 1.5, zc, 0.055, 0.8, wz - 0.2); g.box(JD, xx, 1.5, zc, 0.06, 0.86, wz - 0.14, undefined, 1, 48); g.box(M.yellow, xx - 0.06, 0.6, 1.08, 0.1, 1.0, 0.12); }
    g.box(JWa, -fw / 2 + 0.1, IH - 0.01, -0.41, 0.06, 0.06, 1.6);
    // the yellow padded bumper along the sill's front edge, in two lengths, with black end caps
    { const bx = -fw / 2 - 0.09; g.box(M.yellow, bx, 0.02, -0.42, 0.18, 0.2, 1.5); g.box(M.yellow, bx, 0.02, 0.76, 0.18, 0.2, 0.86); for (const z of [-1.2, 0.35, 1.2]) g.box(JR, bx, 0.02, z, 0.19, 0.21, 0.06); g.box(JD, bx + 0.1, 0.02, 0, 0.02, 0.14, 2.5); }
    // under the cab's floor: the machinery frame, cable loops, the marker lamps
    g.box(JS, 0.1, -0.42, 0, fw - 0.1, 0.38, 3.0); g.box(JD, -0.2, -0.66, 0.4, 0.7, 0.12, 1.2); g.box(JW, 0.4, -0.7, -0.6, 0.5, 0.36, 0.6);
    for (const [zc, dd] of [[0.9, 0.5], [1.1, 0.75], [-1.0, 0.4]]) { const pts: Vector3[] = []; for (let k = 0; k <= 10; k++) { const t = k / 10; pts.push(V(-0.25 + t * 0.6, -0.6 - Math.sin(Math.PI * t) * dd, zc)); } g.tube(JR, pts, 0.025, 6); }
    for (const sz of [-1, 1]) g.box(MARK, -fw / 2 + 0.06, -0.3, sz * 1.62, 0.04, 0.08, 0.14);
    // the roll-up shutter's housing over the doorway
    g.box(JW, -fw / 2 + 0.2, IH + 0.02, 0, 0.3, 0.3, 3.2);
    done(g, cf, `J-${n}/CAB-FRONT`); }
  // the roll-up shutter (closed when the jetway moves, rolled up when docked)
  // the cab's front doors (as on the real cab): a pair of doors with small windows, hinged at their outer edges, opening
  // into the cab when it is docked; beside them a fixed panel with a window
  const DZ0 = -1.17, DZ1 = 0.35, DM = (DZ0 + DZ1) / 2, DW = (DZ1 - DZ0) / 2, DH = IH - 0.06, DX = fx1 + 0.1;
  const leaves = [[DZ0, 1], [DZ1, -1]].map(([hz, sgn]) => { const lf = node(cabN, DX, 0.02, hz, 0, 0, `J-${n}/CAB-DOOR`), g = new Geo(), zc = sgn * DW / 2;
    g.box(JWa, 0, DH / 2, zc, 0.05, DH, DW - 0.02); g.box(GL, 0, 1.55, zc + sgn * 0.02, 0.055, 0.55, 0.26); g.box(JD, 0, 1.55, zc + sgn * 0.02, 0.06, 0.6, 0.3, undefined, 1, 48);
    g.box(JS, 0.035, 1.0, sgn * (DW - 0.12), 0.012, 0.3, 0.08); g.box(JR, 0, DH / 2, sgn * (DW - 0.015), 0.06, DH, 0.02); g.box(JS, 0, 0.12, zc, 0.06, 0.2, DW - 0.04);
    done(g, lf, `J-${n}/CAB-DOOR`); (lf as any)._sgn = sgn; return lf; });
  const shut = leaves[0];
  // the operator's console (a slot): desk, two screens, the joystick, the buttons and the emergency stop
  const con = slot(node(cabN, fm + 0.15, 0, 1.28, 0, 0, `J-${n}/CAB-CONSOLE`), 'jetway.cab-console', { title: 'Jetway cab console', size: [0.8, 1.1, 0.6], origin: 'base' });
  { const g = new Geo(); g.box(JD, 0, 0.45, 0, 0.8, 0.9, 0.55); g.box(JD, 0, 0.86, -0.02, 0.8, 0.16, 0.56, V(0, -0.25, 0)); g.box(JW, 0, 0.93, -0.02, 0.84, 0.05, 0.6, V(0, -0.25, 0)); g.box(JD, 0, 1.06, 0.2, 0.72, 0.26, 0.08);
    g.rod(JD, V(0.2, 0.96, -0.08), V(0.2, 1.08, -0.08), 0.012, 8); g.lathe(JR, V(0.2, 1.06, -0.08), V(0.2, 1.13, -0.08), [[0.02, 0], [0.026, 0.4], [0.022, 0.85], [0, 1]], 12);
    for (let i = 0; i < 4; i++) g.lathe(i ? M.tealUI || JW : JRed, V(-0.25 + i * 0.08, 0.95, -0.12), V(-0.25 + i * 0.08, 0.975, -0.12), [[0.016, 0], [0.016, 1], [0, 1]], 10);
    g.lathe(JRed, V(-0.3, 0.95, 0.08), V(-0.3, 1.0, 0.08), [[0.012, 0], [0.012, 0.5], [0.035, 0.6], [0.035, 1], [0, 1]], 16); g.box(M.yellow, -0.3, 0.952, 0.08, 0.09, 0.01, 0.09);
    for (const e of [-0.2, 0.2]) g.box(JD, e, 1.25, 0.22, 0.36, 0.26, 0.04, V(0, 0.2, 0));
    done(g, con, `J-${n}/CAB-CONSOLE`);
    pic(con, X.pic('scrCam', () => JX.screen('cam'), 1.4), 0.33, 0.22, -0.2, 1.25, 0.195, Math.PI); pic(con, X.pic('scrSt', () => JX.screen('status'), 1.4), 0.33, 0.22, 0.2, 1.25, 0.195, Math.PI);
    for (const p of con.getChildMeshes(false)) if (p.name.startsWith('jwp')) p.rotation.x = -0.2; }
  // the Canopy (a slot): the folding hood round the doorway, the rubber bumper inside it at the sill
  const canopy = node(cabN, 0, 0, 0, 0, 0, `J-${n}/CANOPY`), cs = slot(node(canopy, fx1, 0, 0), 'jetway.canopy', { title: 'Jetway canopy', size: [0.6, 2.9, 3.8], origin: 'base' });
  { const g = new Geo(); 
    for (let kk = 0; kk < 5; kk++) { const xk = -0.05 - kk * 0.11, grow = kk * 0.08, wz = 3.4 + grow, hy = IH + 0.4 + grow;
      g.box(JK, xk, hy, 0, 0.12, 0.18, wz); for (const sz of [-1, 1]) g.box(JK, xk, hy / 2, sz * (wz / 2 - 0.25 - grow / 4), 0.12, hy, 0.5 + grow / 2); }
    done(g, cs, `J-${n}/CANOPY`); }
  // the canopy's lining: a smooth panel over its sides and top inside the folds, from the cab's doorway to its outer
  // frame (it stretches as the canopy pushes out and folds back)
  const canLin = new Mesh(`J-${n}/CANOPY-LINING`, sc); canLin.parent = cabN; canLin.material = X.JL; canLin.receiveShadows = true; canLin.metadata = { id: `J-${n}/CANOPY-LINING`, kind: 'canopy-lining', jetway: `J-${n}`, room: 'APRON' };
  const layCanopy = (ext: number) => { const x0 = fx1 + 0.03, x1 = fx1 - 0.53 + ext, zz = 1.17, y0 = 0.02, y1 = IH + 0.2, Q = (a: number[], b: number[], c: number[], d: number[], nn: number[]) => ({ P: [a, b, c, d].map(q => V(q[0], q[1], q[2])), n: V(nn[0], nn[1], nn[2]) });
    quadsMesh(canLin, [Q([x0, y0, zz], [x1, y0, zz], [x1, y1 + 0.08, zz + 0.05], [x0, y1, zz], [0, 0, -1]), Q([x0, y0, -zz], [x1, y0, -zz], [x1, y1 + 0.08, -zz - 0.05], [x0, y1, -zz], [0, 0, 1]),
      Q([x0, y1, -zz], [x1, y1 + 0.08, -zz - 0.05], [x1, y1 + 0.08, zz + 0.05], [x0, y1, zz], [0, -1, 0])]); };
  // the gate's number on the cab's roof: a blue box sign, white figures on both faces
  const GNUM = new StandardMaterial(`J-${n}/GATE-NUMBER`, sc);
  { const gn = node(cabN, fm - 0.2, IH + 0.4, 0.9), g = new Geo(); g.box(JS, 0, 0.04, 0, 0.36, 0.08, 0.6); for (const e of [-0.3, 0.3]) g.box(JS, 0, 0.32, e, 0.08, 0.5, 0.08); g.box(X.JN, 0, 0.92, 0, 0.16, 0.7, 1.1); g.box(JS, 0, 0.56, 0, 0.18, 0.03, 1.12); done(g, gn, `J-${n}/GATE-NUMBER`);
    // its faces: lit from inside at dusk, through the night and until just after sunrise; unlit (off) by day
    const t = K.tex(P.sign(String(n), '#1C2D72', '#FFFFFF', 256, 160, '800 130px Arial, sans-serif')); GNUM.diffuseTexture = t; GNUM.emissiveTexture = t; GNUM.specularColor = new Color3(0.08, 0.08, 0.08); GNUM.emissiveColor = new Color3(0, 0, 0);
    for (const f of [-1, 1]) pic(gn, GNUM, 1.04, 0.64, f * 0.082, 0.92, 0, f * Math.PI / 2); }
  // the amber beacon on the cab's roof (a slot): it turns while the jetway moves
  const BEA = K.glow('#FFA000', 0.15); BEA.name = `J-${n}/BEACON`;
  const bea = slot(node(cabN, 0.4, IH + 0.4, -0.6, 0, 0, `J-${n}/BEACON`), 'jetway.beacon', { title: 'Jetway beacon', size: [0.2, 0.25, 0.2], origin: 'base' });
  { const g = new Geo(); g.lathe(JD, V(0, 0, 0), V(0, 0.06, 0), [[0, 0], [0.09, 0], [0.09, 1], [0, 1]], 16); g.lathe(BEA, V(0, 0.06, 0), V(0, 0.22, 0), [[0.07, 0], [0.07, 0.6], [0.05, 0.9], [0, 1]], 16); done(g, bea, `J-${n}/BEACON`); }
  const beaRot = node(bea, 0, 0.13, 0, 0, 0, `J-${n}/BEACON-REFLECTOR`); { const g = new Geo(); g.box(JCap, 0, 0, -0.025, 0.09, 0.07, 0.008); g.lathe(JW, V(0, -0.035, 0), V(0, 0.03, 0), [[0.012, 0], [0.012, 1]], 8); done(g, beaRot, `J-${n}/BEACON-REFLECTOR`); }
  let beaSpot: any = null;
  if (IS_PC) { beaSpot = new SpotLight(`J-${n}/BEACON-LIGHT`, V(0, 0, 0), V(0, -0.25, 1), 0.7, 6, sc); beaSpot.parent = beaRot; beaSpot.diffuse = new Color3(1, 0.62, 0.1); beaSpot.specular = new Color3(0.6, 0.4, 0.1); beaSpot.range = 28; beaSpot.intensity = 0; beaSpot.shadowEnabled = false; beaSpot.renderPriority = -2; beaSpot.setEnabled(false); }
  K.block(1, cx + gateX - CR - FRONT - 1.2, cz + PN - 1.9, cx + gateX + CR, cz + PN + 1.9);
  // the bellows (they stretch: rebuilt from their frames whenever the jetway moves)
  // the floor plates across the bellows (from the rotunda's floor to the tunnel's, from the tunnel's to the cab's), their
  // yellow and black edges: laid again whenever the jetway moves
  const plates = [0, 1].map(() => ({ p: K.box(o, IW - 0.2, 0.03, 1, JF, 0, 0, 0), a: K.box(o, IW - 0.2, 0.034, 0.12, JH, 0, 0, 0), b: K.box(o, IW - 0.2, 0.034, 0.12, JH, 0, 0, 0) }));
  const lay = (k: number, p: Vector3, q: Vector3) => { const d = q.subtract(p), L0 = d.length(), yaw = Math.atan2(d.x, d.z), pit = -Math.atan2(d.y, Math.hypot(d.x, d.z)), P0 = plates[k];
    P0.p.position.copyFrom(p.add(q).scale(0.5)); P0.p.rotation.set(pit, yaw, 0); P0.p.scaling.z = L0 + 0.1;
    for (const [m, t] of [[P0.a, 0.06], [P0.b, L0 - 0.06]] as [any, number][]) { m.position.copyFrom(p.add(d.scale(t / L0)).add(V(0, 0.003, 0))); m.rotation.set(pit, yaw, 0); } };
  const belA = bellowsMesh(`J-${n}/BELLOWS-ROTUNDA`, fa, fa.map(v => v.clone()), 9), belB = bellowsMesh(`J-${n}/BELLOWS-CAB`, fbL.map(v => v.clone()), fbL.map(v => v.clone()), 9);
  // their linings: a smooth panel inside each, the colour of the tunnel's walls, flush with them; seen only from inside
  // (the rubber outside), stretched with the bellows whenever the jetway moves
  const lining = (id: string) => { const m = new Mesh(id, sc); m.parent = o; m.material = X.JL; m.receiveShadows = true; m.metadata = { id, kind: 'bellows-lining', jetway: `J-${n}`, room: 'APRON' }; return m; };
  const linA = lining(`J-${n}/BELLOWS-ROTUNDA-LINING`), linB = lining(`J-${n}/BELLOWS-CAB-LINING`);

  // ---- the Drive unit, as built: two lift columns, one each side of the tunnel. Each is a wide sleeve clamped to the
  // tunnel's side (from above its roof, a motor housing on top, braced to the roof, down to below its floor) that rides
  // up and down over a thinner leg standing on the base. The base (the yoke between the legs, on a turntable) turns with
  // the tunnel; under it the bogie steers, two pairs of wheels in tandem, one pair under each column ----
  const CX = 1.78, YK = 1.38, WR = 0.55, SB = 1.25, SH = IH + 0.75 + SB;   // the columns' spacing, the yoke's top, the sleeves' drop below the floor and their height
  const bog = node(o, 0, -F2Y, 0, 0, 0, `J-${n}/DRIVE-UNIT`), legIn = node(o, 0, 0, 0, 0, 0, `J-${n}/LIFT-SLEEVES`);
  const steer = node(bog, 0, 0, 0, 0, 0, `J-${n}/BOGIE-STEER`);
  const DLAMP = K.glow('#FF8A00', 0.25); DLAMP.name = `J-${n}/DRIVE-LAMP`;
  // the yoke: a box beam across under both columns, their base plates and gussets, the drive's cabinet, the turntable
  { const g = new Geo(); g.box(JS, 0, YK - 0.18, 0, 2 * CX + 0.6, 0.36, 0.72); g.box(JD, 0, YK - 0.38, 0, 2 * CX + 0.4, 0.04, 0.6);
    for (const sx of [-1, 1]) { g.box(JS, sx * CX, YK + 0.06, 0, 0.7, 0.12, 0.7);
      for (const sz of [-1, 1]) g.beam(JS, V(sx * CX, YK + 0.5, sz * 0.2), V(sx * (CX - 0.45), YK + 0.05, sz * 0.2), 0.03, 0.2);
      for (let b = 0; b < 4; b++) g.lathe(JD, V(sx * CX + (b % 2 ? 0.28 : -0.28), YK + 0.12, b < 2 ? 0.28 : -0.28), V(sx * CX + (b % 2 ? 0.28 : -0.28), YK + 0.16, b < 2 ? 0.28 : -0.28), [[0, 0], [0.03, 0], [0.03, 1], [0, 1]], 6); }
    g.box(JW, 0.55, YK + 0.3, -0.12, 1.0, 0.6, 0.42); g.box(JD, 0.55, YK + 0.3, -0.335, 0.9, 0.5, 0.01); g.box(JS, 0.95, YK + 0.3, -0.34, 0.03, 0.12, 0.02);
    g.box(JW, -0.7, YK + 0.22, 0.05, 0.6, 0.44, 0.5);
    g.lathe(DLAMP, V(-0.2, YK, 0.36), V(-0.2, YK + 0.12, 0.36), [[0.05, 0], [0.05, 0.7], [0.035, 1], [0, 1]], 12);
    g.lathe(JD, V(0, YK - 0.4, 0), V(0, YK - 0.58, 0), [[0, 0], [0.55, 0], [0.55, 1], [0, 1]], 28);
    done(g, bog, `J-${n}/DRIVE-YOKE`); }
  collide(bog, V(0, YK - 0.18, 0), V(CX + 0.3, 0.2, 0.36)); collide(bog, V(0.55, YK + 0.3, -0.12), V(0.5, 0.3, 0.21)); collide(bog, V(-0.7, YK + 0.22, 0.05), V(0.3, 0.22, 0.25)); collide(steer, V(0, 0.8, 0), V(1.3, 0.25, 1.05));
  // the bogie (a slot): its frame, the axle housings and the drive motors, the wheels (slots), two in tandem each side
  const bf = slot(node(steer, 0, 0, 0), 'jetway.bogie', { title: 'Jetway bogie', size: [3.0, 0.6, 2.2], origin: 'any' });
  { const g = new Geo(); g.box(JS, 0, 0.88, 0, 2.5, 0.28, 2.0); g.box(JS, 0, 0.66, 0, 1.6, 0.16, 1.7);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { g.box(JD, sx * 1.12, WR, sz * 0.66, 0.36, 0.3, 0.3); g.box(JS, sx * 1.12, WR + 0.25, sz * 0.66, 0.42, 0.22, 0.46);
      g.box(JD, sx * 0.72, 0.6, sz * 0.66, 0.42, 0.34, 0.34); g.lathe(JD, V(sx * 0.5, 0.6, sz * 0.66), V(sx * 0.46, 0.6, sz * 0.66), [[0, 0], [0.14, 0], [0.14, 1], [0, 1]], 14); }
    for (const sz of [-1, 1]) g.box(M.yellow, 0, 0.88, sz * 1.005, 2.4, 0.08, 0.01);
    // a thin black mudguard over each wheel, on its bracket; amber markers on the frame's corners
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const arc: Vector3[] = []; for (let k = 0; k <= 14; k++) { const t = 0.35 + k / 14 * 2.1; arc.push(V(sx * 1.55, WR + Math.sin(t) * 0.64, sz * 0.66 + Math.cos(t) * 0.64)); }
      g.tube(JR, arc, 0.012, 6); g.box(JR, sx * 1.55, WR + 0.66, sz * 0.66, 0.36, 0.008, 0.5); g.box(JS, sx * 1.38, 1.02, sz * 0.66, 0.3, 0.04, 0.05);
      g.box(MARK, sx * 1.26, 0.94, sz * 1.0, 0.06, 0.08, 0.03); }
    done(g, bf, `J-${n}/BOGIE`); }
  const wheels: TransformNode[] = [];
  for (const sx of [-1.55, 1.55]) for (const sz of [-0.66, 0.66]) { const wn = node(steer, sx, WR, sz), ws = slot(node(wn, 0, 0, 0), 'jetway.wheel', { title: 'Jetway wheels', size: [0.4, 1.1, 1.1], origin: 'centre' }), g = new Geo(), sgn = Math.sign(sx);
    // as on the real drive unit: a road tyre with rounded shoulders, bulging sidewalls with a rim guard and fine rings,
    // three grooves round the tread; a deep silver dished steel rim (its lip, the barrel, the disc set well in and coned
    // to the hub), four holes in the cone, eight nuts on washers round the raised hub flange, the domed hub cap
    const f = (v: number) => V(v * sgn, 0, 0);
    tyre(g, f(-0.2), f(0.2), 0.56, 0.31, 0.4);
    g.lathe(JRim, f(0.2), f(0.02), [[0.3, 0], [0.336, 0], [0.343, 0.03], [0.34, 0.08], [0.318, 0.16], [0.31, 0.28], [0.31, 1], [0.3, 1]], 40);
    // closed behind: the barrel's inner half and its back lip, the barrel seen from inside the dish (both faces), and the
    // brake back plate, so nothing shows through the rim or the holes from any side
    g.lathe(JRim, f(-0.2), f(0.02), [[0.3, 0], [0.336, 0], [0.343, 0.03], [0.34, 0.08], [0.318, 0.16], [0.31, 0.28], [0.31, 1], [0.3, 1]], 40);
    for (const pr of [[[0.302, 0], [0.302, 1]], [[0.302, 1], [0.302, 0]]]) g.lathe(JRim, f(-0.2), f(0.2), pr, 40);
    for (const pr of [[[0, 0], [0.305, 0], [0.305, 1], [0, 1]], [[0, 1], [0.305, 1], [0.305, 0], [0, 0]]]) g.lathe(JD, f(-0.12), f(-0.1), pr, 32);
    g.lathe(JRim, f(0.11), f(0.15), [[0.31, 0], [0.31, 0.25], [0.3, 0.32], [0.215, 0.62], [0.205, 0.7], [0.145, 0.7], [0.14, 0.8], [0.14, 1], [0, 1]], 40);
    g.lathe(JRim, f(0.15), f(0.17), [[0.14, 0], [0.13, 0.2], [0.13, 0.8], [0.12, 1], [0, 1]], 28);
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.39, rr = 0.258; g.lathe(JG, V(0.134 * sgn, Math.sin(a) * rr, Math.cos(a) * rr), V(0.14 * sgn, Math.sin(a) * rr, Math.cos(a) * rr), [[0, 0], [0.034, 0], [0.034, 1], [0, 1]], 14); }
    for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * Math.PI * 2, y = Math.sin(a) * 0.172, z = Math.cos(a) * 0.172;
      g.lathe(JD, V(0.138 * sgn, y, z), V(0.144 * sgn, y, z), [[0, 0], [0.024, 0], [0.024, 1], [0, 1]], 12);
      g.lathe(JD, V(0.144 * sgn, y, z), V(0.164 * sgn, y, z), [[0, 0], [0.019, 0], [0.019, 0.75], [0.013, 1], [0, 1]], 6); g.lathe(JD, V(0.164 * sgn, y, z), V(0.176 * sgn, y, z), [[0.007, 0], [0.007, 1], [0, 1]], 8); }
    g.lathe(JCap, f(0.17), f(0.232), [[0.095, 0], [0.095, 0.12], [0.088, 0.35], [0.07, 0.62], [0.044, 0.85], [0, 1]], 28);
    done(g, ws, `J-${n}/WHEEL`); wheels.push(wn); }
  // the sleeves (slots) on the tunnel: wide box columns with their seams, a clamp collar at the foot, the motor housing
  // and its louvres on top, braces to the roof, brackets to the tunnel's side; the cross beam under the tunnel's floor
  for (const sx of [-1, 1]) { const sl = slot(node(legIn, sx * CX, -SB, 0, 0, 0, `J-${n}/LIFT-SLEEVE`), 'jetway.lift-column-outer', { title: 'Jetway lift columns (outer sleeves)', size: [0.5, SH, 0.56], origin: 'base', slides: 'y' });
    const g = new Geo(); g.box(JS, 0, SH / 2, 0, 0.5, SH, 0.56);
    for (const e of [-1, 1]) g.box(JT, e * 0.18, SH / 2, 0.285, 0.04, SH - 0.1, 0.012); g.box(JT, sx * 0.255, SH / 2, 0, 0.012, SH - 0.1, 0.4);
    g.box(JD, 0, 0.1, 0, 0.6, 0.2, 0.66); g.box(JS, 0, 0.28, 0, 0.56, 0.06, 0.62);
    for (let b = 0; b < 6; b++) g.lathe(JD, V((b % 3 - 1) * 0.15, 0.42 + Math.floor(b / 3) * 0.16, 0.28), V((b % 3 - 1) * 0.15, 0.42 + Math.floor(b / 3) * 0.16, 0.3), [[0, 0], [0.022, 0], [0.022, 1], [0, 1]], 6);
    g.box(JW, 0, SH + 0.24, 0, 0.42, 0.48, 0.46); g.box(JS, 0, SH + 0.5, 0, 0.48, 0.05, 0.52);
    g.box(JS, 0, SH - 0.05, 0, 0.6, 0.1, 0.66);
    for (const sz of [-1, 1]) g.beam(JS, V(-sx * 0.2, SH - 0.1, sz * 0.25), V(-sx * (CX - 1.42), SB + IH + 0.45, sz * 0.75), 0.07, 0.07);
    for (const yy of [SB - 0.1, SB + IH + 0.15]) g.box(JS, -sx * (CX - 1.5) / 2 - sx * 0.12, yy, 0, CX - 1.5 + 0.1, 0.18, 0.4);
    done(g, sl, `J-${n}/LIFT-SLEEVE`);
    for (const f of [0, 1]) pic(sl, X.pic('grille', () => JX.grille(), 0), 0.34, 0.2, f ? sx * 0.212 : 0, SH + 0.24, f ? 0 : 0.232, f ? sx * Math.PI / 2 : 0); }
  { const g = new Geo(); g.box(JS, 0, -0.42, 0, 2 * CX + 0.2, 0.32, 0.5); g.box(JD, 0, -0.6, 0, 2 * CX, 0.04, 0.4); done(g, legIn, `J-${n}/LIFT-BEAM`); }
  { const lt = node(legIn, 0, 0, 0); hoseU(lt, 0.45, -0.6, 0.55, 1.9, 0.6); hoseU(lt, 0.45, -0.6, 1.05, 1.5, 0.6); }
  // the power cables from each sleeve down to the yoke: hanging loops, laid again as the sleeves ride up and down
  const CAB = [-1, 1].map(() => null as any), cablePath = (sx: number) => { const p = toO(legIn, V(sx * (CX + 0.3), -SB + 0.25, 0.18)), q = toO(bog, V(sx * (CX + 0.36), YK + 0.1, 0.18)), out = toO(legIn, V(sx * (CX + 0.75), -SB + 0.25, 0.18)).subtract(p);
    const pts: Vector3[] = []; for (let i = 0; i <= 14; i++) { const t = i / 14, a = Vector3.Lerp(p, q, t); pts.push(a.add(out.scale(0.35 * Math.sin(Math.PI * t))).add(V(0, -0.25 * Math.sin(Math.PI * t), 0))); } return pts; };
  // ---- the Service stair: hung from its landing on the last section, its foot on the apron; its steps stay level ----
  const land = node(secNodes[2], IW / 2 + 0.9 + 0.2, -0.25, zL), LW = 0.6, LD = 0.7, WX = -(IW / 2 + 0.9 + 0.2) + IW / 2 + T + 0.14;   // the landing's half sizes; the jetway's side (landing frame)
  { const g = new Geo(); g.box(JS, 0, -0.05, 0, 2 * LW, 0.1, 2 * LD); g.box(JS, 0, -0.16, 0, 2 * LW - 0.1, 0.12, 0.12); g.box(JH, 0, 0.003, -LD + 0.05, 2 * LW - 0.04, 0.006, 0.06);
    // its guardrails: up the outer side, across its far end to the jetway's side, and from the stair's inner rail to the jetway
    const post = (px: number, pz: number) => { g.rod(JS, V(px, 0, pz), V(px, 1.0, pz), 0.022, 8); g.box(JS, px, 0.005, pz, 0.08, 0.01, 0.08); };
    for (const pz of [-LD, 0, LD]) post(0.5, pz); post(-0.1, LD);
    for (const yy of [1.0, 0.5]) { g.rod(JS, V(0.5, yy, -LD), V(0.5, yy, LD), yy > 0.9 ? 0.024 : 0.016, 10); g.rod(JS, V(0.5, yy, LD), V(WX, yy, LD), yy > 0.9 ? 0.024 : 0.016, 10); g.rod(JS, V(-0.5, yy, -LD), V(WX, yy, -LD), yy > 0.9 ? 0.024 : 0.016, 10); }
    for (const pz of [-LD, LD]) g.box(JS, WX + 0.02, 0.75, pz, 0.04, 0.6, 0.12);   // the brackets on the jetway's side
    g.box(JS, 0.5, 0.06, 0, 0.012, 0.12, 2 * LD); g.box(JS, (0.5 + WX) / 2, 0.06, LD, 0.5 - WX, 0.12, 0.012);   // toe boards
    done(g, land, `J-${n}/STAIR-LANDING`); }
  const stair = node(o, 0, 0, 0, 0, 0, `J-${n}/SERVICE-STAIR`), SL = 7.2, NS = 26, FOOT = 0.3, SWR = 0.1;   // its length, its foot's height (the wheels under it)
  const sa = slot(node(stair, 0, 0, 0), 'jetway.service-stair', { title: 'Jetway service stair', size: [1.2, 1.2, SL], origin: 'any' });
  const steps: TransformNode[] = [], ups: TransformNode[] = [], rails: TransformNode[] = [], swheels: TransformNode[] = [];
  { const g = new Geo(); for (const so of [-0.5, 0.5]) { g.beam(JS, V(so, 0, 0), V(so, 0, SL), 0.08, 0.25); g.box(JD, so, 0, SL - 0.05, 0.1, 0.27, 0.1); } done(g, sa, `J-${n}/STAIR`);
    for (let i = 1; i < NS; i++) { const st = node(sa, 0, 0.02, SL * i / NS), gs = new Geo(); gs.box(JS, 0, 0, 0, 1.0, 0.04, 0.26); gs.box(JH, 0, 0.022, -0.11, 1.0, 0.006, 0.04); done(gs, st, `J-${n}/STEP`); steps.push(st); }
    // the handrails: upright posts (they stay plumb), the top rail and a knee rail, parallel to the stringers
    for (const so of [-0.5, 0.5]) { for (let i = 0; i <= 5; i++) { const pn = node(sa, so, 0.12, SL * i / 5 * 0.98 + 0.05), gp = new Geo(); gp.rod(JS, V(0, 0, 0), V(0, 0.88, 0), 0.02, 8); done(gp, pn, `J-${n}/STAIR-POST`); ups.push(pn); }
      for (const k of [1.0, 0.5]) { const rn = node(sa, so, 0, 0), gr = new Geo(); gr.rod(JS, V(0, 0, 0), V(0, 0, SL), k > 0.9 ? 0.024 : 0.016, 10); done(gr, rn, `J-${n}/STAIR-RAIL`); (rn as any)._k = k; rails.push(rn); } }
    // the wheels at its foot: a small solid wheel in a steel fork under each stringer, rolling as the jetway drags the stair
    for (const so of [-0.5, 0.5]) { const fk = node(sa, so, 0, SL - 0.05), gf = new Geo();
      gf.box(JS, 0, -0.03, 0, 0.18, 0.02, 0.2); for (const e of [-1, 1]) gf.box(JS, e * 0.055, -(FOOT - SWR) / 2 - 0.04, 0, 0.012, FOOT - SWR + 0.06, 0.16);
      gf.lathe(JD, V(-0.07, -(FOOT - SWR), 0), V(0.07, -(FOOT - SWR), 0), [[0, 0], [0.018, 0], [0.018, 1], [0, 1]], 8); done(gf, fk, `J-${n}/STAIR-FORK`);
      const wn = node(fk, 0, -(FOOT - SWR), 0), gw = new Geo();
      tyre(gw, V(-0.035, 0, 0), V(0.035, 0, 0), SWR, 0.055, 0.07);
      for (const e of [-1, 1]) { gw.lathe(JRim, V(e * 0.034, 0, 0), V(e * 0.02, 0, 0), [[0.055, 0], [0.058, 0.3], [0.055, 1], [0.03, 1], [0.025, 0.5], [0, 0.5]], 20); gw.lathe(JCap, V(e * 0.038, 0, 0), V(e * 0.046, 0, 0), [[0.016, 0], [0.016, 0.5], [0.01, 1], [0, 1]], 6); }
      done(gw, wn, `J-${n}/STAIR-WHEEL`); ups.push(fk); swheels.push(wn); } }

  // ---- the pose ----
  const oInv = new Matrix(); const toO = (nd: TransformNode, p: Vector3) => Vector3.TransformCoordinates(p, nd.computeWorldMatrix(true).multiply(oInv));
  const rest = { yaw: tunYaw, pitch: tunPitch, len: L, cab: 0, canopy: 1, shutter: 1 };
  const pose = { ...rest };
  const LMIN = SEC[0].l + 2 * BD, LMAX = SEC[0].l + SEC[1].l + SEC[2].l - 2 * OV + 2 * BD;
  /** Put the jetway in a pose: yaw (about the rotunda), pitch (+ down), len (the tunnel), cab (the cab's turn), canopy and shutter (0 to 1). */
  const setPose = (p: any) => {
    Object.assign(pose, p); const len = Math.max(LMIN, Math.min(LMAX, pose.len));
    o.computeWorldMatrix(true).invertToRef(oInv);
    boom.rotation.y = pose.yaw; bp.rotation.x = pose.pitch;
    // the first section at the rotunda's bellows, the last at the cab's; the middle one slides where both its joints keep
    // their overlap (half way between its limits), never past the first's back end or the last's front end
    const z0 = BD, z3 = len - BD - SEC[2].l, lo = Math.max(z0, z3 + OV - SEC[1].l), hi = Math.min(z0 + SEC[0].l - OV, z3, z3 + SEC[2].l - SEC[1].l);
    secNodes[0].position.z = z0; secNodes[2].position.z = z3; secNodes[1].position.z = lo <= hi ? (lo + hi) / 2 : (z0 + z3) / 2;
    // the cab: level at the tunnel's end, turned by pose.cab; its sleeve faces back along the tunnel
    const end = toO(bp, V(0, 0, len)), dirH = V(Math.sin(pose.yaw), 0, Math.cos(pose.yaw));
    cabN.position.copyFrom(end.add(dirH.scale(CR - 0.25))); cabN.rotation.y = pose.cab; cabSl.rotation.y = pose.yaw + Math.PI - pose.cab;
    canopy.position.x = (1 - pose.canopy) * 0.35; layCanopy(canopy.position.x); for (const lf of leaves) lf.rotation.y = (lf as any)._sgn * 1.53 * ((u: number) => u * u * (3 - 2 * u))(Math.max(0, Math.min(1, pose.shutter))); void shut;
    // the bellows, tight against the flanges (they turn with the jetway) and the sections' ends
    applyBellows(belA, fa.map(q => toO(boom, q)), secFrame(0, SEC[0].g).map(q => toO(secNodes[0], q)), 9, 0.09);
    applyBellows(belB, secFrame(SEC[2].l, SEC[2].g).map(q => toO(secNodes[2], q)), fbL.map(q => toO(cabSl, q)), 9, 0.09);
    applyLining(linA, belA.metadata._a, belA.metadata._b); applyLining(linB, belB.metadata._a, belB.metadata._b);
    const dA = Math.sqrt(RR * RR - hxA * hxA) - 0.1, dC = Math.sqrt(CR * CR - hxB * hxB) - 0.1;
    lay(0, toO(boom, V(0, 0.02, dA)), toO(secNodes[0], V(0, fyOf(SEC[0].g) + 0.02, 0.1)));
    lay(1, toO(secNodes[2], V(0, fyOf(SEC[2].g) + 0.02, SEC[2].l - 0.1)), toO(cabSl, V(0, 0.02, dC)));
    // the drive unit under its point on the last section
    const w = toO(secNodes[2], V(0, 0, zW)); bog.position.set(w.x, -F2Y, w.z); bog.rotation.y = pose.yaw; legIn.position.copyFrom(w); legIn.rotation.y = pose.yaw;
    [-1, 1].forEach((sx, k) => { const path = cablePath(sx); if (!CAB[k]) { CAB[k] = MeshBuilder.CreateTube(`J-${n}/LIFT-CABLE`, { path, radius: 0.035, tessellation: 8, updatable: true }, sc); CAB[k].parent = o; CAB[k].material = JR; CAB[k].metadata = meta; }
      else MeshBuilder.CreateTube('', { path, radius: 0.035, tessellation: 8, instance: CAB[k] } as any); });
    // the stair from its landing to the apron (towards the terminal), its steps level
    const top = toO(land, V(0, 0, -LD)), h = top.y + F2Y - FOOT, sl = Math.asin(Math.max(0.15, Math.min(0.98, h / SL)));
    stair.position.copyFrom(top); stair.rotation.y = pose.yaw + Math.PI; stair.rotation.x = sl; for (const s of steps) s.rotation.x = -sl; for (const u of ups) u.rotation.x = -sl;
    for (const rn of rails) { const k = (rn as any)._k; rn.position.y = k * Math.cos(sl); rn.position.z = -k * Math.sin(sl); }
    // the foot's wheels roll by the distance the foot moves along the stair's line
    { const f = toO(sa, V(0, 0, SL)), fl = (stair as any)._foot; if (fl) { const d = f.subtract(fl), dir = V(Math.sin(pose.yaw + Math.PI), 0, Math.cos(pose.yaw + Math.PI)); const ds = Vector3.Dot(V(d.x, 0, d.z), dir); for (const w of swheels) w.rotation.x += ds / SWR; } (stair as any)._foot = f; }
  };
  setPose(rest);
  // the legs (slots) on the base, inside the sleeves: long enough to stay 2 m inside them from 0.6 m below the docked
  // height to 1.5 m above it; their rack (the lifting screw's track) up the front, the guide shoes at the foot
  { const sb = legIn.position.y + F2Y - SB, LL = Math.max(1.5, sb + SH - 0.9 - (YK + 0.12));
    for (const sx of [-1, 1]) { const il = slot(node(bog, sx * CX, YK + 0.12, 0, 0, 0, `J-${n}/LIFT-LEG`), 'jetway.lift-column-inner', { title: 'Jetway lift columns (inner legs)', size: [0.36, LL, 0.42], origin: 'base', slides: 'y' });
      const g = new Geo(); g.box(JT, 0, LL / 2, 0, 0.36, LL, 0.42); g.box(JD, 0, LL / 2, 0.215, 0.08, LL, 0.012); for (let y = 0.1; y < LL; y += 0.12) g.box(JD, 0, y, 0.224, 0.07, 0.03, 0.01);
      g.box(JS, 0, 0.15, 0, 0.46, 0.3, 0.52); for (const e of [-1, 1]) g.box(JT, e * 0.183, LL / 2, -0.1, 0.008, LL - 0.2, 0.06);
      done(g, il, `J-${n}/LIFT-LEG`); collide(il, V(0, LL / 2, 0), V(0.23, LL / 2, 0.26)); } }

  // ---- driving it: the wheels are the master. The drive unit's point on the apron (and the tunnel's height there) is
  // moved along its path; the jetway's turn, tilt and length are worked out from it every frame (the rotunda and the
  // wheels' point fix the tunnel's line), the bogie steers to where it is going and its wheels roll by the distance ----
  const fk = () => { const w = toO(secNodes[2], V(0, 0, zW)); return { x: w.x, z: w.z, h: w.y }; };
  const ik = (x: number, z: number, h: number) => { const yaw = Math.atan2(x - rx, z - rz), dh = Math.hypot(x - rx, z - rz) - (RR - 0.25), pitch = Math.atan2(yR - h, dh), s = Math.hypot(dh, yR - h);
    return { yaw, pitch, len: s + BD + SEC[2].l - zW }; };
  const Wd = fk();
  // parked: the wheels on the painted box (0.62 of the way from the rotunda to the door), the tunnel short, a little lower
  const th = Math.atan2(D[0] - R[0], D[2] - R[1]); let Wp = { x: rx + Math.sin(th) * reach * 0.62, z: rz + Math.cos(th) * reach * 0.62, h: Wd.h - 0.35 };
  { const q = ik(Wp.x, Wp.z, Wp.h); if (q.len < LMIN + 0.2) { const ex = LMIN + 0.2 - q.len; Wp = { x: Wp.x + Math.sin(q.yaw) * ex, z: Wp.z + Math.cos(q.yaw) * ex, h: Wp.h }; } }
  // a gentle curve from the box to the door, bowing away from the building
  const mid = { x: (Wp.x + Wd.x) / 2, z: (Wp.z + Wd.z) / 2 }, ddx = Wd.x - Wp.x, ddz = Wd.z - Wp.z, dl = Math.hypot(ddx, ddz) || 1; let pxv = -ddz / dl, pzv = ddx / dl; if (pzv < 0) { pxv = -pxv; pzv = -pzv; }
  const C = { x: mid.x + pxv * dl * 0.18, z: mid.z + pzv * dl * 0.18 };
  const ease = (t: number) => t * t * (3 - 2 * t), clamp = (t: number) => Math.max(0, Math.min(1, t));
  const path = (s: number) => { const a = (1 - s) * (1 - s), b = 2 * s * (1 - s), c = s * s; return { x: a * Wp.x + b * C.x + c * Wd.x, z: a * Wp.z + b * C.z + c * Wd.z, h: Wp.h + (Wd.h - Wp.h) * ease(s) }; };
  // the cab: on the way it faces along the tunnel; in the final crawl it turns square to the fuselage
  const front0 = -Math.PI / 2, turn0 = Math.sign(Math.atan2(Math.sin(tunYaw - front0), Math.cos(tunYaw - front0))) * 0.3;
  let S = 1, turn = 0, canopyE = 1, shutterE = 1, TT = 0, spin = 0, steerA = 0, last = { x: Wd.x, z: Wd.z }, lightK = 1, clock = 0, signK = SUN.alt < 4 ? 1 : 0;
  const apply = () => { const w = path(S), q = ik(w.x, w.z, w.h);
    setPose({ yaw: q.yaw, pitch: q.pitch, len: q.len, cab: (q.yaw - tunYaw) + turn, canopy: canopyE, shutter: shutterE });
    // the wheels: steer to the way it is going (reversing when it backs), roll by the distance
    const mx = w.x - last.x, mz = w.z - last.z, d = Math.hypot(mx, mz);
    if (d > 1e-5) { let head = Math.atan2(mx, mz) - q.yaw, sg = 1; head = Math.atan2(Math.sin(head), Math.cos(head)); if (Math.abs(head - steerA) > Math.PI / 2) { head = Math.atan2(Math.sin(head + Math.PI), Math.cos(head + Math.PI)); sg = -1; }
      steerA += (head - steerA) * 0.25; spin += sg * d / WR; }
    steer.rotation.y = steerA; for (const wn of wheels) wn.rotation.x = spin; last = { x: w.x, z: w.z }; };
  const rig: JetwayRig = { id: `J-${n}`, node: o, state: 'docked', moving: false, rest, pose, setPose, bellows: [belA, belB],
    dock() { if (rig.state !== 'parked') return false; rig.state = 'docking'; TT = 0; return true; },
    undock() { if (rig.state !== 'docked') return false; rig.state = 'undocking'; TT = 0; return true; },
    test() { if (rig.state === 'parked') rig.dock(); else if (rig.state === 'docked') rig.undock(); },
    snap(s) { void 0; rig.state = s; S = s === 'docked' ? 1 : 0; turn = s === 'docked' ? 0 : turn0; canopyE = shutterE = s === 'docked' ? 1 : 0; const w = path(S); last = { x: w.x, z: w.z }; steerA = 0; apply(); lights(); for (const H of hoses) { H.x = []; H.p = []; } stepHoses(1 / 60, 150); },
    update(dt: number) { clock += dt; const t0 = JW_TIMES; let mv = false;
      if (rig.state === 'docking') { TT += dt; const a = t0.drive, b = a + t0.crawl, c = b + t0.canopy;
        if (TT < a) { S = 0.92 * ease(clamp(TT / a)); mv = true; } else if (TT < b) { const u = (TT - a) / t0.crawl; S = 0.92 + 0.08 * u; turn = turn0 * (1 - ease(u)); mv = true; }
        else if (TT < c) { S = 1; turn = 0; const u = clamp((TT - b) / t0.canopy); canopyE = ease(clamp(u * 1.6)); shutterE = ease(clamp(u * 1.6 - 0.6)); } else { canopyE = shutterE = 1; rig.state = 'docked'; }
        apply(); }
      else if (rig.state === 'undocking') { TT += dt; const a = t0.canopy, b = a + t0.back, c = b + t0.home;
        if (TT < a) { const u = clamp(TT / a); shutterE = 1 - ease(clamp(u * 1.6)); canopyE = 1 - ease(clamp(u * 1.6 - 0.6)); }
        else if (TT < b) { const u = (TT - a) / t0.back; S = 1 - 0.08 * ease(u); turn = turn0 * ease(u); canopyE = shutterE = 0; mv = true; }
        else if (TT < c) { S = 0.92 * (1 - ease(clamp((TT - b) / t0.home))); mv = true; } else { S = 0; rig.state = 'parked'; }
        apply(); }
      rig.moving = mv;
      // the beacon turns (flashes) while it moves; the lights inside come up when it is docked
      // the beacon: 75 turns a minute; its dome flashes as the reflector sweeps past, its light sweeps the apron; off when still
      { const RPM = 75, ph = clock * RPM / 60 * Math.PI * 2, fl = mv ? Math.pow(Math.max(0, Math.cos(ph)), 6) : 0; beaRot.rotation.y = ph;
        BEA.emissiveColor.set(1, 0.6, 0.05).scaleInPlace(mv ? 0.35 + 2.4 * fl : 0.12); DLAMP.emissiveColor.set(1, 0.54, 0).scaleInPlace(mv ? 0.15 + 1.6 * fl : 0.1);
        if (beaSpot) { beaSpot.setEnabled(mv); beaSpot.intensity = mv ? 40 : 0; } }
      const want = rig.state === 'docked' ? 1.5 : 0.85; lightK += (want - lightK) * Math.min(1, dt * 1.5); lights(); hoseAcc += dt; if (hoseAcc >= 1 / 30) { const st = Math.min(0.1, hoseAcc); hoseAcc = 0; stepHoses(Math.min(1 / 30, st), st > 0.04 ? 2 : 1); }   // the hoses 30 times a second
      // the gate number: on once the sun is under 4° (sunset, the night, until just after sunrise), off by day
      const on = SUN.alt < 4 ? 1 : 0; signK += (on - signK) * Math.min(1, dt * 0.8); GNUM.emissiveColor.set(signK, signK, signK); },
    meshes() { const out: any[] = [belA, belB, linA, linB, canLin, ...hoses.map(H => H.mesh).filter(Boolean), ...CAB, ...plates.flatMap(q => [q.p, q.a, q.b])]; for (const nd of moving) out.push(...nd.getChildMeshes(false)); return out; } };
  const moving = [boom, bp, ...secNodes, cabN, bog, legIn, stair, land];
  // real lights inside (the PC): the corridor, the rotunda, the tunnel and the cab, each lighting only this jetway
  const PL: PointLight[] = [];
  if (IS_PC || SET.gfx.manyLights) { const add = (par: TransformNode, x: number, y: number, z: number, i: number) => { const l = new PointLight(`J-${n}/LIGHT`, V(x, y, z), sc); l.parent = par; l.diffuse = new Color3(1, 0.97, 0.92); l.specular = new Color3(0.4, 0.4, 0.4); l.intensity = i; l.range = 7; l.shadowEnabled = false; l.renderPriority = -1; (l as any)._base = i; PL.push(l); EXTRA_LIGHTS.push(l); };
    add(o, 0, CH - 0.35 - ZC * 0.5 * k, ZC * 0.5, 9); add(tR, 0, IH - 0.2, 0, 7); add(secNodes[1], 0, IH - 0.3, SEC[1].l / 2, 8); add(cabN, -0.6, IH - 0.2, 0, 6);
    const mine = o.getChildMeshes(false); for (const l of PL) l.includedOnlyMeshes = mine; sc.requireLightSorting = true; }
  function lights() { GNUM.emissiveColor.set(signK, signK, signK); LED.emissiveColor.set(1, 1, 1).scaleInPlace(1.1 * lightK); for (const l of PL) l.intensity = (l as any)._base * lightK; }
  // in the game it waits parked on its box until an aircraft is on its stand
  rig.snap('parked');
  o.metadata.rig = rig; (K as any).jetways = ((K as any).jetways || []).concat([rig]);
  return o;

  /** The fire extinguisher (6 kg, 0.16 m across): the turned red body, its base ring, the brass neck, the valve with its
   *  pressure gauge, the carrying handle and the lever with its safety pin, the hose and the nozzle in its clip, the
   *  wall bracket's strap. In node par (its origin under it, the wall behind it at -z). */
  function extinguisher(par: TransformNode) { const g = new Geo();
    g.lathe(JRed, V(0, 0.02, 0), V(0, 1.02, 0), [[0, 0], [0.07, 0], [0.08, 0.02], [0.08, 0.38], [0.075, 0.42], [0.062, 0.45], [0.03, 0.47], [0, 0.47]], 28);
    g.lathe(JR, V(0, 0, 0), V(0, 0.035, 0), [[0, 0], [0.083, 0], [0.083, 1], [0, 1]], 28);
    g.lathe(JBr, V(0, 0.48, 0), V(0, 0.515, 0), [[0.02, 0], [0.02, 1]], 12);
    g.box(JD, 0, 0.535, 0, 0.045, 0.05, 0.07);
    g.lathe(JD, V(0.024, 0.535, 0.015), V(0.04, 0.535, 0.015), [[0, 0], [0.021, 0], [0.021, 1], [0, 1]], 16); g.lathe(JGa, V(0.04, 0.535, 0.015), V(0.041, 0.535, 0.015), [[0, 0], [0.017, 0], [0, 1]], 16);
    g.box(JD, 0, 0.555, -0.045, 0.03, 0.012, 0.11);                                    // the carrying handle (lower, fixed)
    g.beam(JD, V(0, 0.585, 0.01), V(0, 0.575, -0.11), 0.032, 0.012);                    // the lever
    g.rod(M.yellow, V(-0.03, 0.565, -0.01), V(0.03, 0.565, -0.01), 0.004, 6); g.lathe(M.yellow, V(0.03, 0.565, -0.01), V(0.034, 0.565, -0.01), [[0.012, 0], [0.012, 1]], 10);
    g.tube(JR, [V(0, 0.53, 0.04), V(0.03, 0.5, 0.075), V(0.065, 0.45, 0.085), V(0.085, 0.35, 0.07), V(0.09, 0.22, 0.05)], 0.011, 8);
    g.lathe(JD, V(0.09, 0.22, 0.05), V(0.09, 0.15, 0.05), [[0.016, 0], [0.016, 0.35], [0.01, 1], [0, 1]], 10);
    g.box(JS, 0.085, 0.22, 0.03, 0.03, 0.03, 0.03);                                     // the nozzle's clip
    g.lathe(JS, V(0, 0.3, 0), V(0, 0.325, 0), [[0.081, 0], [0.086, 0], [0.086, 1], [0.081, 1]], 28); g.box(JS, 0, 0.32, -0.09, 0.07, 0.16, 0.012);   // the bracket
    g.build(sc, par, `J-${n}/FIRE-EXTINGUISHER`, meta).forEach(m => made.push(m)); }
}

/** A bellows' pleats between its two frames (a, b: four corners each, bottom left, bottom right, top right, top left):
 *  2 × folds rings from a to b, every other one standing out by pleat, each face its own (sharp folds). Call it again
 *  with moved frames to stretch or squeeze it (e.g. as the jetway telescopes or tilts). */
export function applyBellows(m: Mesh, a: Vector3[], b: Vector3[], folds: number, pleat = 0.09) {
  if (m.metadata) { m.metadata._a = a; m.metadata._b = b; }
  const rings: Vector3[][] = [], N = folds * 2;
  for (let i = 0; i <= N; i++) { const t = i / N, q = [0, 1, 2, 3].map(k => Vector3.Lerp(a[k], b[k], t)), out = i % 2 && i < N ? pleat : 0;
    if (!out) { rings.push(q); continue; }
    const c = q[0].add(q[1]).add(q[2]).add(q[3]).scale(0.25), rv = q[1].subtract(q[0]).normalize(), uv = q[3].subtract(q[0]).normalize();
    rings.push(q.map(p => { const d = p.subtract(c); return p.add(rv.scale(Math.sign(Vector3.Dot(d, rv)) * out)).add(uv.scale(Math.sign(Vector3.Dot(d, uv)) * out)); })); }
  const pos: number[] = [], idx: number[] = [], uvs: number[] = []; let vi = 0;
  // the picture laid in metres: u round the frame (along each fold), v across the pleats (their slant), so its lines follow the folds
  const per = (q: Vector3[], k: number) => { let d = 0; for (let j = 0; j < k; j++) d += Vector3.Distance(q[j], q[j + 1]); return d; };
  const vAt: number[][] = [[0, 0, 0, 0]]; for (let i = 0; i < N; i++) vAt.push([0, 1, 2, 3].map(k => { const k2 = (k + 1) % 4, a0 = rings[i][k].add(rings[i][k2]).scale(0.5), a1 = rings[i + 1][k].add(rings[i + 1][k2]).scale(0.5); return vAt[i][k] + Vector3.Distance(a0, a1); }));
  for (let i = 0; i < N; i++) for (let k = 0; k < 4; k++) { const k2 = (k + 1) % 4, P = [rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k]];
    const u0 = per(rings[i], k), u1 = u0 + Vector3.Distance(rings[i][k], rings[i][k2]), w0 = per(rings[i + 1], k), w1 = w0 + Vector3.Distance(rings[i + 1][k], rings[i + 1][k2]), v0 = vAt[i][k], v1 = vAt[i + 1][k];
    for (const p of P) pos.push(p.x, p.y, p.z); uvs.push(u0, v0, u1, v0, w1, v1, w0, v1); idx.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3); vi += 4; }
  const vd = new VertexData(), nr: number[] = []; VertexData.ComputeNormals(pos, idx, nr); vd.positions = pos; vd.indices = idx; vd.normals = nr; vd.uvs = uvs; vd.applyToMesh(m, true);
  if (m.material) { (m.material as any).backFaceCulling = false; (m.material as any).twoSidedLighting = true; }
}

/** A tyre's turned profile (radius, across its width 0 to 1): rounded shoulders, sidewalls that bulge, a rim guard and
 *  two fine rings on each, three grooves round the tread. R its outside radius, r0 its bead (the rim's edge). */
function tyreProfile(R: number, r0: number): number[][] { const k = R / 0.56, q = (r: number) => r0 + (r - 0.31) * (R - r0) / (0.56 - 0.31);
  const half = [[0.31, 0.02], [0.35, 0], [0.36, -0.016], [0.372, 0], [0.42, -0.02], [0.425, -0.026], [0.43, -0.02], [0.455, -0.024], [0.46, -0.03], [0.465, -0.022], [0.49, -0.01], [0.515, 0.03], [0.535, 0.07], [0.549, 0.12], [0.556, 0.17], [0.56, 0.23], [0.549, 0.252], [0.549, 0.29], [0.56, 0.312], [0.56, 0.47], [0.549, 0.488]];
  const all = half.concat(half.slice().reverse().map(([r, t]) => [r, 1 - t])); void k; return all.map(([r, t]) => [q(r), t]); }

/** A bellows' lining: one smooth panel all round inside it (its sides 0.2 m in, its roof 0.38 m down, its floor 0.22 m up,
 *  flush with the tunnel's walls, ceiling and floor), from frame a to frame b, facing inwards only. */
export function applyLining(m: Mesh, a: Vector3[], b: Vector3[], sx = 0.2, top = 0.38, bot = 0.22) {
  if (!a || !b) return;
  const shrink = (q: Vector3[]) => { const rv = q[1].subtract(q[0]).normalize(), uv = q[3].subtract(q[0]).normalize();
    return [q[0].add(rv.scale(sx)).add(uv.scale(bot)), q[1].subtract(rv.scale(sx)).add(uv.scale(bot)), q[2].subtract(rv.scale(sx)).subtract(uv.scale(top)), q[3].add(rv.scale(sx)).subtract(uv.scale(top))]; };
  const A = shrink(a), B = shrink(b), c = A.concat(B).reduce((s, v) => s.add(v), Vector3.Zero()).scale(1 / 8);
  const pos: number[] = [], idx: number[] = [], nor: number[] = [], uvs: number[] = []; let vi = 0;
  for (let k = 0; k < 4; k++) { const k2 = (k + 1) % 4, P = [A[k], A[k2], B[k2], B[k]], fc = P[0].add(P[1]).add(P[2]).add(P[3]).scale(0.25);
    let n = P[1].subtract(P[0]).cross(P[3].subtract(P[0])).normalize(); if (Vector3.Dot(n, c.subtract(fc)) < 0) n = n.scale(-1);
    for (const p of P) { pos.push(p.x, p.y, p.z); nor.push(n.x, n.y, n.z); } const w = Vector3.Distance(P[0], P[1]), l = Vector3.Distance(P[0], P[3]); uvs.push(0, 0, w, 0, w, l, 0, l);
    const f = P[0].subtract(P[1]).cross(P[2].subtract(P[1])); if (Vector3.Dot(f, n) >= 0) idx.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3); else idx.push(vi, vi + 2, vi + 1, vi, vi + 3, vi + 2); vi += 4; }
  const vd = new VertexData(); vd.positions = pos; vd.indices = idx; vd.normals = nor; vd.uvs = uvs; vd.applyToMesh(m, true);
}

/** A mesh from flat four-cornered faces, each facing its own way (n): rebuilt in place (for parts that stretch). */
export function quadsMesh(m: Mesh, quads: { P: Vector3[]; n: Vector3 }[]) {
  const pos: number[] = [], idx: number[] = [], nor: number[] = [], uvs: number[] = []; let vi = 0;
  for (const { P, n } of quads) { for (const p of P) { pos.push(p.x, p.y, p.z); nor.push(n.x, n.y, n.z); } const w = Vector3.Distance(P[0], P[1]), l = Vector3.Distance(P[0], P[3]); uvs.push(0, 0, w, 0, w, l, 0, l);
    const f = P[0].subtract(P[1]).cross(P[2].subtract(P[1])); if (Vector3.Dot(f, n) >= 0) idx.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3); else idx.push(vi, vi + 2, vi + 1, vi, vi + 3, vi + 2); vi += 4; }
  const vd = new VertexData(); vd.positions = pos; vd.indices = idx; vd.normals = nor; vd.uvs = uvs; vd.applyToMesh(m, true);
}
