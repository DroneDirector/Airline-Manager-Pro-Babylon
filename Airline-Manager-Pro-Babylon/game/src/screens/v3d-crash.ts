/* Crash sites. After a crash (yours once you register it, a hired pilot's, or one from a court case) the
 * airport keeps the site for three days: the aircraft broken in three (nose, centre with the wings, tail),
 * scorched and lying where it came to rest beyond the runway, wreckage strewn back along its path, burnt
 * ground, fires burning for the first hours and a column of smoke drifting with the wind, and fire engines
 * and ambulances around it with their lights flashing. It shows in the 3D view, and on the map as a marker
 * you can tap to go there. */

interface CrashSite { id: string; apt: string; typeId: string; color: string; color2: string; cid: string; reg: string; at: number; dead: boolean; pos?: number[]; hdg?: number; level?: 'destroyed' | 'damaged'; parts?: string[] }
const CRASH_KEEP_MS = 3 * 86400e3, CRASH_FIRE_MS = 6 * 3600e3, CRASH_SMOKE_MS = 30 * 3600e3;

function crashSites(): CrashSite[] {
  const S: any = State; S.crashSites = (S.crashSites || []).filter((c: CrashSite) => Date.now() - c.at < CRASH_KEEP_MS);
  return S.crashSites;
}
/** Remember a crash where it happened (the airport it was arriving at; your own simulator position when you were there). */
function crashSiteAdd(o: { key: string; c: Company; typeId: string; reg: string; to: string; dead?: boolean; level?: 'destroyed' | 'damaged'; parts?: string[] }) {
  if (!o || !o.to || !apt(o.to)) return;
  const list = crashSites(); if (list.some(c => c.id === o.key)) return;
  const site: CrashSite = { id: o.key, apt: o.to, typeId: o.typeId || 'a320neo', color: (o.c && o.c.color) || '#2C8CFF', color2: (o.c && (o.c as any).color2) || '#FFFFFF', cid: (o.c && o.c.id) || '', reg: o.reg || '', at: Date.now(), dead: !!o.dead, level: o.level || 'destroyed', parts: o.parts || [] };
  try {
    const L: any = typeof Link !== 'undefined' ? (Link as any).sim : null;
    if (L && L.lat && L.t && Date.now() - L.t < 15 * 60e3 && gcDistanceNm([L.lon, L.lat], apt(o.to).pos) < 8) { site.pos = [L.lon, L.lat]; site.hdg = L.hdg || 0; }
  } catch (e) { /* the airport, then */ }
  list.unshift(site); if (list.length > 12) list.length = 12;
  try { Store.save(); } catch (e) { /* saved later */ }
}
/** The active crash site at an airport, if there is one. */
function crashSiteAt(icao: string): CrashSite { return crashSites().filter(c => c.apt === icao)[0] || null; }
ACTIONS['crash-3d'] = el => { const k = el.getAttribute('data-apt'); if (!k) return; closeAll(); (V3d as any).crashFocus = k; v3dOpenAirport(k); };

/* ---------- in the 3D view ---------- */

const V3dCrash: any = { list: [] as any[], mat: null };

/** Where the wreck lies (in the view) and which way: given, or past the end of the longest runway, off to one side. */
function crashPlace(site: CrashSite, L: AirportLayout, loc: (x: number, y: number) => number[]): { x: number; z: number; hdg: number } {
  if (site.pos) { const q = v3dXY(site.pos[0], site.pos[1]); return { x: q[0], z: q[1], hdg: site.hdg || 0 }; }
  const r = (L.runways || []).slice().sort((a, b) => b.len - a.len)[0], rnd = (k: number) => cloudHash(site.id.length * 131 + k, site.at % 100000, 7);
  if (!r) { const q = v3dXY(L.lon + 0.004, L.lat + 0.002); return { x: q[0], z: q[1], hdg: rnd(1) * 360 }; }
  const end = rnd(2) < 0.5 ? 1 : -1, h = (r.hdg + (end < 0 ? 180 : 0)) * D2R, c = v3dXY(r.lon, r.lat);
  const fx = Math.sin(h), fz = -Math.cos(h), along = r.len / 2 + 120 + rnd(3) * 380, side = (rnd(4) - 0.5) * 140;
  return { x: c[0] + fx * along + Math.cos(h) * side, z: c[1] + fz * along + Math.sin(h) * side, hdg: (r.hdg + (end < 0 ? 180 : 0) + (rnd(5) - 0.5) * 70 + 360) % 360 };
}

/** The shared fire and smoke shader: soft billboards that move entirely on the graphics card. */
function crashFxMat(kind: 'fire' | 'smoke'): any {
  const T = THREE, fire = kind === 'fire', map = Models.tex('crash/crash-' + kind + '.png');   // a picture from the folder instead of the drawn one
  return new T.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uK: { value: 1 }, uWind: { value: new T.Vector2() }, uAmb: { value: 1 }, uMap: { value: map }, uUse: { value: map ? 1 : 0 } },
    vertexShader: `
      #include <common>
      #include <logdepthbuf_pars_vertex>
      attribute vec4 iSrc; attribute vec4 iP;   // source (x, y, z, size); seed, life, rise, spread
      uniform float uTime; uniform float uK; uniform vec2 uWind;
      varying vec2 vUv; varying float vAge; varying float vSeed;
      void main() {
        float age = fract(uTime / iP.y + iP.x); vAge = age; vSeed = iP.x; vUv = uv;
        float sz = iSrc.w * ${fire ? 'mix(1.0, 0.35, age) * (0.8 + 0.4 * sin(uTime * 9.0 + iP.x * 40.0))' : 'mix(0.6, 3.2, sqrt(age))'} * (0.4 + 0.6 * uK);
        vec3 p = iSrc.xyz + vec3(uWind.x, 0.0, uWind.y) * age * iP.y * ${fire ? '0.15' : '1.0'}
          + vec3(sin(iP.x * 91.0) * iP.w, age * iP.z * iP.y, cos(iP.x * 57.0) * iP.w) * ${fire ? 'age' : '(0.4 + age)'};
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        mv.xy += (position.xy) * sz;
        gl_Position = projectionMatrix * mv;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform float uK; uniform float uAmb; uniform float uTime; uniform sampler2D uMap; uniform float uUse;
      varying vec2 vUv; varying float vAge; varying float vSeed;
      void main() {
        #include <logdepthbuf_fragment>
        vec2 q = vUv * 2.0 - 1.0; float r = length(q);
        float n = sin(q.x * 7.0 + vSeed * 30.0 + uTime * 3.0) * sin(q.y * 6.0 - uTime * 4.0 + vSeed * 11.0) * 0.18;
        float a = (1.0 - smoothstep(0.35 + n, 1.0, r));
        vec4 tx = uUse > 0.5 ? texture2D(uMap, vUv) : vec4(1.0);
        if (uUse > 0.5) a = tx.a;
        ${fire
        ? `vec3 c = mix(vec3(1.0, 0.95, 0.6), vec3(1.0, 0.35, 0.05), smoothstep(0.0, 0.6, vAge + r * 0.3));
        c = mix(c, vec3(0.5, 0.08, 0.02), smoothstep(0.55, 1.0, vAge));
        a *= (1.0 - smoothstep(0.6, 1.0, vAge)) * uK;
        gl_FragColor = vec4(c * 1.6 * mix(vec3(1.0), tx.rgb * 1.4, uUse), a);`
        : `float g = mix(0.06, 0.32, smoothstep(0.0, 0.8, vAge)) * mix(0.35, 1.0, uAmb);
        a *= 0.55 * smoothstep(0.0, 0.08, vAge) * (1.0 - smoothstep(0.55, 1.0, vAge)) * uK;
        gl_FragColor = vec4(mix(vec3(g, g * 0.97, g * 0.95), tx.rgb * mix(0.35, 1.0, uAmb), uUse), a);`}
        if (gl_FragColor.a < 0.01) discard;
      }`,
    transparent: true, depthWrite: false, blending: fire ? T.AdditiveBlending : T.NormalBlending, fog: false,
  });
}
function crashFx(kind: 'fire' | 'smoke', src: number[][], n: number): any {
  const T = THREE, geo = new T.InstancedBufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
  geo.setAttribute('uv', new T.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2)); geo.setIndex([0, 1, 2, 0, 2, 3]);
  const a = new Float32Array(n * 4), b = new Float32Array(n * 4), fire = kind === 'fire';
  for (let i = 0; i < n; i++) {
    const s = src[i % src.length];
    a.set([s[0] + (Math.random() - 0.5) * s[3] * 0.6, s[1], s[2] + (Math.random() - 0.5) * s[3] * 0.6, s[3] * (0.6 + Math.random() * 0.6)], i * 4);
    b.set([Math.random(), fire ? 0.7 + Math.random() * 0.8 : 14 + Math.random() * 10, fire ? 6 + Math.random() * 6 : 4 + Math.random() * 3, fire ? s[3] * 0.25 : 6 + Math.random() * 10], i * 4);
  }
  geo.setAttribute('iSrc', new T.InstancedBufferAttribute(a, 4)); geo.setAttribute('iP', new T.InstancedBufferAttribute(b, 4));
  geo.instanceCount = n;
  const m = new T.Mesh(geo, crashFxMat(kind)); m.frustumCulled = false; m.renderOrder = fire ? 14 : 13;
  return m;
}

/** Builds the sites at an airport into its group (called when the airport is built). */
function v3dCrashBuild(L: AirportLayout, loc: (x: number, y: number) => number[], gy: (x: number, z: number) => number, g: any) {
  V3dCrash.list = V3dCrash.list.filter((c: any) => c.obj && c.obj.parent && c.obj.parent.parent);
  for (const site of crashSites()) {
    if (site.apt !== L.icao) continue;
    try { const c = v3dCrashSite(site, L, loc, gy); g.add(c.obj); V3dCrash.list.push(c); } catch (e) { /* a site that can't be built is left out */ }
  }
}

function v3dCrashSite(site: CrashSite, L: AirportLayout, loc: (x: number, y: number) => number[], gy: (x: number, z: number) => number): any {
  const T = THREE, grp = new T.Group(), P = crashPlace(site, L, loc), y0 = gy(P.x, P.z), s = shapeOf(site.typeId), len = s.L;
  // in the sea: the wreck partly sunk, burning fuel and oil spread on the water, rescue boats instead of fire engines
  const llP = v3dLonLat(P.x, P.z), sea = (() => { try { return V3dTerrain.isSea(llP[0], llP[1]); } catch (e) { return false; } })();
  const rnd = (k: number) => cloudHash(site.id.length * 17 + k, site.at % 99991, 3);
  const h = P.hdg * D2R, fx = Math.sin(h), fz = -Math.cos(h), rx = Math.cos(h), rz = Math.sin(h);
  const at = (along: number, side: number) => [P.x + fx * along + rx * side, P.z + fz * along + rz * side];
  // the aircraft, broken in three, scorched
  const lv = liveryFor(site.color, site.color2, site.cid);
  // damaged but in one piece (structural damage): the aircraft whole, down on a collapsed gear leg where one
  // broke, with the parts that came off lying near it; destroyed: broken in three, burnt
  const dmg = site.level === 'damaged', parts = site.parts || [], has = (k: string) => parts.some(p => p.indexOf(k) >= 0);
  const cuts = dmg ? [[0, 1.01]] : [[0, 0.34], [0.34, 0.7], [0.7, 1.01]];
  const lay = dmg ? [[0, 0, has('main gear') ? 1.0 : has('nose gear') ? 0.5 : 0, (rnd(6) - 0.5) * 10, has('nose gear') ? -3.5 : has('tail') ? 2 : 0, has('main gear') ? 5 + rnd(7) * 3 : 0]] : [   // where each piece came to rest: [along, side, sink, yaw, pitch, roll]
    [len * 0.55 + 18 + rnd(1) * 25, (rnd(2) - 0.5) * 18, 1.2, (rnd(3) - 0.5) * 50, -7 - rnd(4) * 8, 25 + rnd(5) * 40],
    [0, 0, 1.6, (rnd(6) - 0.5) * 16, 2, (rnd(7) - 0.5) * 18],
    [-len * 0.45 - 14 - rnd(8) * 30, (rnd(9) - 0.5) * 30, 0.8, 60 + rnd(10) * 70, 4, -30 - rnd(11) * 40],
  ];
  // a helicopter comes down short and steep: the cabin on its side where it hit, the tail boom torn off a few
  // metres away, the rotor blades broken and thrown around it
  const heli = typeof isHeli === 'function' && isHeli(site.typeId);
  if (heli && !dmg) {
    cuts.length = 0; cuts.push([0, 0.46], [0.46, 1.01]);
    lay.length = 0; lay.push([len * 0.05, 0, 0.5, (rnd(3) - 0.5) * 40, -15 - rnd(4) * 10, 70 + rnd(5) * 25], [-len * 0.45 - 3 - rnd(8) * 6, (rnd(9) - 0.5) * 9, 0.25, 40 + rnd(10) * 90, 6, -25 - rnd(11) * 30]);
  }
  if (V3d.r) V3d.r.localClippingEnabled = true;
  cuts.forEach((cut, i) => {
    const m = buildAircraftModel(site.typeId, lv); try { m.userData.set && m.userData.set({ flaps: 0.3, gear: 0, spoilers: 1 }); } catch (e) { /* static */ }
    // the cut: two planes across the fuselage (set in the world once the piece is placed)
    const planes = [new T.Plane(), new T.Plane()], local = [new T.Plane(new T.Vector3(1, 0, 0), -cut[0] * len), new T.Plane(new T.Vector3(-1, 0, 0), cut[1] * len)];
    m.traverse((o: any) => {
      if (!o.material) return;
      const one = (mt: any) => { const c = mt.clone(); c.clippingPlanes = planes; c.clipShadows = true; c.side = T.DoubleSide;
        const k = dmg ? 0.82 + rnd(i * 13 + (o.id % 7)) * 0.15 : 0.16 + rnd(i * 13 + (o.id % 7)) * 0.24; if (c.color) c.color.multiplyScalar(k); if ('roughness' in c) c.roughness = 0.95; if ('metalness' in c) c.metalness = 0.05; if (c.envMapIntensity != null) c.envMapIntensity = 0.1; return c; };
      o.material = Array.isArray(o.material) ? o.material.map(one) : one(o.material);
    });
    const piv = new T.Group(); m.position.x = -(cut[0] + cut[1]) / 2 * len; piv.add(m);
    const l = lay[i], q = at(l[0], l[1]);
    piv.position.set(q[0], gy(q[0], q[1]) - l[2] + s.h * (sea ? -0.32 : 0.15), q[1]);
    if (sea) { l[4] *= 2.2; l[5] *= 1.3; }
    piv.rotation.set(0, 0, 0); piv.rotateY(-(P.hdg + 90 + l[3]) * D2R); piv.rotateZ(l[4] * D2R); piv.rotateX(l[5] * D2R);
    grp.add(piv); piv.updateMatrixWorld(true);
    // the scene places the airport's group at the origin, so this is where the cut lies in the world
    const body = m.userData && m.userData.body ? m.userData.body : m;
    planes[0].copy(local[0]).applyMatrix4(m.matrixWorld); planes[1].copy(local[1]).applyMatrix4(m.matrixWorld); void body;
  });
  // scorched ground and the scar back along the path it slid
  // soot and churned earth: ragged, patchy edges (a picture made once), never a hard-edged shape
  if (!V3dCrash.sootTex) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 256; const x = cv.getContext('2d');
    for (let i = 0; i < 90; i++) { const a = Math.random() * 6.28, d = Math.pow(Math.random(), 0.7) * 100, cx = 128 + Math.cos(a) * d, cy = 128 + Math.sin(a) * d, r = 18 + Math.random() * 42;
      const gr = x.createRadialGradient(cx, cy, 0, cx, cy, r); gr.addColorStop(0, `rgba(12,10,8,${0.35 + Math.random() * 0.3})`); gr.addColorStop(1, 'rgba(12,10,8,0)'); x.fillStyle = gr; x.beginPath(); x.arc(cx, cy, r, 0, 6.28); x.fill(); }
    V3dCrash.sootTex = new T.CanvasTexture(cv);
  }
  const scar = new T.Mesh(new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: 0xffffff, map: Models.tex('crash/crash-soot.png') || V3dCrash.sootTex, transparent: true, opacity: 0.95, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -10, polygonOffsetUnits: -10 }));
  scar.material.userData.noDim = true;
  const sc = at(heli ? -len * 0.2 : -len * 0.6 - 60, 0); scar.position.set(sc[0], gy(sc[0], sc[1]) + 0.6, sc[1]); scar.scale.set(s.span * 0.9, 1, heli ? len * 1.4 + 8 : len * 2.6 + 140); scar.rotation.y = -h; scar.renderOrder = 7;
  if (heli && !dmg) {   // the broken rotor blades
    const mB = new T.MeshStandardMaterial({ color: 0x1E2126, roughness: 0.9 }), bl = s.span / 2;
    for (let k = 0; k < 5; k++) {
      const piece = new T.Mesh(new T.BoxGeometry(bl * (0.25 + rnd(40 + k) * 0.6), 0.06, 0.45), mB), q = at((rnd(50 + k) - 0.5) * len * 1.4, (rnd(60 + k) - 0.5) * s.span * 1.2);
      const w = new T.Group(); w.add(piece); w.position.set(q[0], gy(q[0], q[1]) + 0.08, q[1]); w.rotation.set((rnd(70 + k) - 0.5) * 0.4, rnd(80 + k) * 6.28, (rnd(90 + k) - 0.5) * 0.3); piece.castShadow = true; grp.add(w);
      crashSwap(w, ['crash/crash-rotor-blade.glb'], false);
    }
  }
  const burn = new T.Mesh(new T.CircleGeometry(1, 28).rotateX(-Math.PI / 2), scar.material); burn.position.set(P.x, y0 + 0.65, P.z); burn.scale.set(s.span * 1.3, 1, len * 1.2); burn.renderOrder = 7;
  if (dmg) { scar.scale.set(s.span * 0.4, 1, len * 1.2 + 40); burn.scale.set(s.span * 0.35, 1, len * 0.4); }
  if (!sea) grp.add(scar, burn);
  else {
    // the slick: dark, ragged, with an oily rainbow sheen, spreading out from the wreck
    if (!V3dCrash.oilTex) {
      const cv = document.createElement('canvas'); cv.width = cv.height = 256; const x = cv.getContext('2d');
      for (let i = 0; i < 70; i++) { const a = Math.random() * 6.28, d = Math.pow(Math.random(), 0.6) * 105, cx = 128 + Math.cos(a) * d, cy = 128 + Math.sin(a) * d, r = 14 + Math.random() * 40;
        const gr = x.createRadialGradient(cx, cy, 0, cx, cy, r); gr.addColorStop(0, `rgba(8,8,10,${0.45 + Math.random() * 0.3})`); gr.addColorStop(1, 'rgba(8,8,10,0)'); x.fillStyle = gr; x.beginPath(); x.arc(cx, cy, r, 0, 6.28); x.fill(); }
      x.globalCompositeOperation = 'source-atop';
      for (let i = 0; i < 40; i++) { const cx = 30 + Math.random() * 196, cy = 30 + Math.random() * 196, r = 6 + Math.random() * 20, hue = Math.random() * 360;
        const gr = x.createRadialGradient(cx, cy, r * 0.4, cx, cy, r); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.6, `hsla(${hue},80%,55%,.22)`); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.beginPath(); x.arc(cx, cy, r, 0, 6.28); x.fill(); }
      V3dCrash.oilTex = new T.CanvasTexture(cv);
    }
    const oil = new T.Mesh(new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ map: Models.tex('crash/crash-oil.png') || V3dCrash.oilTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -10, polygonOffsetUnits: -10 }));
    oil.material.userData.noDim = true; oil.position.set(P.x - fx * len * 0.4, y0 + 0.15, P.z - fz * len * 0.4); oil.scale.set(len * 3.2, 1, len * 4.2); oil.rotation.y = -h; oil.renderOrder = 7; grp.add(oil);
  }
  // debris: hundreds of pieces strewn back along the path, thickest near the wreck
  const debF = crashDebrisGeo(), nD = dmg ? 45 : heli ? 90 : 260, deb = new T.InstancedMesh(debF ? debF.geo : new T.BoxGeometry(1, 1, 1), debF ? debF.mat : new T.MeshLambertMaterial({ color: 0x3A3C40 }), nD), M = new T.Matrix4(), Q = new T.Quaternion(), E = new T.Euler(), Sv = new T.Vector3();
  for (let i = 0; i < nD; i++) {
    const t = Math.pow(Math.random(), 1.8), p = heli ? at(-t * (len * 1.5 + 25) + (Math.random() - 0.5) * len * 0.5, (Math.random() - 0.5) * (s.span * 0.9 + t * 12)) : at(-t * (len * 3 + 220) + (Math.random() - 0.3) * len * 0.6, (Math.random() - 0.5) * (s.span * 0.5 + t * 50));   // a helicopter comes down short: its pieces lie close by
    const sz = (0.25 + Math.pow(Math.random(), 3) * 2.6);
    E.set(Math.random() * 6, Math.random() * 6, Math.random() * 6); Q.setFromEuler(E); Sv.set(sz * (0.5 + Math.random()), sz * 0.25, sz * (0.4 + Math.random()));
    M.compose(new T.Vector3(p[0], gy(p[0], p[1]) + (sea ? 0.05 : sz * 0.1), p[1]), Q, Sv); deb.setMatrixAt(i, M);
    deb.setColorAt(i, new T.Color(Math.random() < 0.25 ? site.color : Math.random() < 0.5 ? 0xD9DCE0 : 0x2A2C30).multiplyScalar(0.35 + Math.random() * 0.4));
  }
  grp.add(deb);
  // fire and smoke from the wreck (wing roots, engines, the nose)
  const src: number[][] = [];
  // the parts that broke off (damaged aircraft): an engine, a wing tip, the gear, lying where they fell
  if (dmg) {
    const metal = new T.MeshLambertMaterial({ color: 0xBFC4CA }), dark = new T.MeshLambertMaterial({ color: 0x3A3D42 });
    const n0 = grp.children.length;
    if (has('engine')) { const q = at(-len * 0.25 - rnd(20) * 20, s.span * 0.42 + rnd(21) * 10), e = new T.Mesh(new T.CylinderGeometry(s.w * 0.28, s.w * 0.24, s.w * 0.9, 18), metal); e.rotation.set(Math.PI / 2, rnd(22) * 3, 0.3); e.position.set(q[0], gy(q[0], q[1]) + s.w * 0.24, q[1]); grp.add(e); }
    if (has('wing')) { const q = at(-len * 0.4 - rnd(23) * 30, -s.span * 0.5 - 6), w = new T.Mesh(new T.BoxGeometry(s.span * 0.12, 0.35, len * 0.06), new T.MeshLambertMaterial({ color: site.color })); w.rotation.set(0.2, rnd(24) * 3, 0.15); w.position.set(q[0], gy(q[0], q[1]) + 0.3, q[1]); grp.add(w); }
    if (has('gear')) { const q = at(-len * 0.15 - rnd(25) * 25, (rnd(26) - 0.5) * 12); for (let k = 0; k < 2; k++) { const wh = new T.Mesh(new T.CylinderGeometry(0.6, 0.6, 0.45, 16), dark); wh.rotation.set(Math.PI / 2, 0, rnd(27 + k)); wh.position.set(q[0] + k * 1.6, gy(q[0], q[1]) + 0.25, q[1] + k); grp.add(wh); } }
    // each broken-off part can come from its own file (crash-engine, crash-wing-piece, crash-wheel)
    for (const o of grp.children.slice(n0)) {
      const geo = o.geometry && o.geometry.type, name = geo === 'BoxGeometry' ? 'crash-wing-piece' : geo === 'CylinderGeometry' && o.geometry.parameters.radiusTop < 0.7 && o.geometry.parameters.height < 0.5 ? 'crash-wheel' : 'crash-engine';
      const w = new T.Group(); w.position.copy(o.position); w.quaternion.copy(o.quaternion); grp.add(w); o.position.set(0, 0, 0); o.quaternion.identity(); w.add(o);
      crashSwap(w, ['crash/' + name + '.glb'], false);
    }
  }
  const fireAt: number[][] = dmg ? (has('fire') ? [[len * 0.05, -s.span * 0.22, 3]] : []) : heli ? [[len * 0.05, 0, 7], [len * 0.15, 1.5, 5], [lay[1][0] * 0.6, lay[1][1] * 0.5, 3]]   // a helicopter: the engine deck over the cabin, and fuel along the way to the tail
    : [[0, 0, 9], [len * 0.05, -s.span * 0.22, 8], [len * 0.05, s.span * 0.22, 8], [lay[0][0], lay[0][1], 6], [-len * 0.2, s.span * 0.35, 5], [lay[2][0] * 0.5, 4, 4]];
  if (dmg && !fireAt.length) fireAt.push([len * 0.05, s.span * 0.2, 1.2]);   // a little smoke where it was hurt
  for (const [al, sd, sz] of fireAt) {
    const q = at(al, sd); src.push([q[0], gy(q[0], q[1]) + 0.5, q[1], sz * Math.max(0.6, len / 40)]);
  }
  if (sea) {
    // burning fuel on the water: many low, wide fires across the slick, the wreck's own fires lower down
    for (const q of src) q[1] = y0 + 0.3;
    for (let i = 0; i < 12; i++) { const a = Math.random() * 6.28, d = Math.sqrt(Math.random()) * len * 1.3, q = at(-len * 0.4 + Math.cos(a) * d, Math.sin(a) * d * 0.7); src.push([q[0], y0 + 0.2, q[1], (3 + Math.random() * 5) * Math.max(0.6, len / 40)]); }
  }
  const fire = crashFx('fire', src, dmg ? (has('fire') ? 30 : 0) : sea ? 150 : 90), smoke = crashFx('smoke', src.slice(0, sea ? 5 : 3).map(q => [q[0], q[1] + 4, q[2], q[3] * (sea ? 1.8 : 1.4)]), sea ? 100 : 70);
  if (sea) { fire.material.uniforms.uK.value = 1; for (let i = 0; i < 150; i++) { const b = fire.geometry.attributes.iP; b.setZ(i, b.getZ(i) * 0.55); } fire.geometry.attributes.iP.needsUpdate = true; }
  grp.add(fire, smoke);
  // the fire's glow on the ground at night
  const glow = new T.Mesh(new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new T.ShaderMaterial({
    uniforms: { uK: { value: 0 }, uMap: { value: Models.tex('crash/crash-glow.png') }, uUse: { value: Models.has('crash/crash-glow.png') ? 1 : 0 } }, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    vertexShader: '#include <common>\n#include <logdepthbuf_pars_vertex>\nvarying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n#include <logdepthbuf_vertex>\n}',
    fragmentShader: '#include <common>\n#include <logdepthbuf_pars_fragment>\nuniform float uK; uniform sampler2D uMap; uniform float uUse; varying vec2 vUv; void main() {\n#include <logdepthbuf_fragment>\nfloat r = length(vUv - 0.5) * 2.0; float k = 1.0 - smoothstep(0.0, 1.0, r); vec3 c = vec3(1.0, 0.45, 0.12) * k * k; if (uUse > 0.5) { vec4 t = texture2D(uMap, vUv); c = t.rgb * t.a; } gl_FragColor = vec4(c * uK, 1.0); }',
    polygonOffset: true, polygonOffsetFactor: -12, polygonOffsetUnits: -12,
  }));
  glow.position.set(P.x, y0 + 0.8, P.z); glow.scale.set(260, 1, 260); glow.renderOrder = 8; grp.add(glow);
  // fire engines and ambulances around it, lights flashing
  const veh: any[] = [], lights: any[] = [];
  const mRed = new T.MeshLambertMaterial({ color: 0xB3151B }), mWhite = new T.MeshLambertMaterial({ color: 0xE8EAEC }), mYel = new T.MeshLambertMaterial({ color: 0xD8C21A });
  const nV = 6;
  for (let i = 0; i < nV; i++) {
    const amb = !sea && i >= 4, ang = (i / nV) * Math.PI * 2 + rnd(40 + i) * 0.6, rr = (sea ? len * 1.6 + 70 : len * 0.7 + 35) + rnd(50 + i) * 25;
    const x = P.x + Math.cos(ang) * rr, z = P.z + Math.sin(ang) * rr, v = new T.Group();
    if (sea) {   // a rescue boat: a pointed hull with a cabin
      const hl = new T.Shape(); hl.moveTo(-5, -1.4); hl.lineTo(3, -1.4); hl.quadraticCurveTo(6.5, 0, 3, 1.4); hl.lineTo(-5, 1.4); hl.lineTo(-5, -1.4);
      const hull = new T.Mesh(new T.ExtrudeGeometry(hl, { depth: 1.2, bevelEnabled: false }).rotateX(-Math.PI / 2), i % 2 ? mRed : new T.MeshLambertMaterial({ color: 0xE8641B }));
      const cab = new T.Mesh(new T.BoxGeometry(3.2, 1.6, 2.2), mWhite); cab.position.set(-1.2, 2, 0); v.add(hull, cab);
    } else {
    const body = new T.Mesh(new T.BoxGeometry(amb ? 6 : 10.5, amb ? 2.6 : 3.3, amb ? 2.3 : 2.6), amb ? mWhite : (i === 0 ? mYel : mRed)); body.position.y = (amb ? 2.6 : 3.3) / 2 + 0.4; v.add(body);
    }
    for (const sd of [-0.8, 0.8]) {
      const lm = new T.Mesh(new T.SphereGeometry(0.28, 8, 6), new T.MeshBasicMaterial({ color: 0x2040FF })); lm.material.userData.noDim = true;
      lm.position.set((amb ? 3 : 5.25) - 0.4, (amb ? 2.6 : 3.3) + 0.6, sd); v.add(lm); lights.push({ m: lm, ph: i * 0.37 + (sd > 0 ? 0.5 : 0), amb });
    }
    for (const o of v.children) if (o.geometry && o.geometry.type === 'SphereGeometry') o.userData.keep = true;   // the flashing lights stay the app's own
    crashSwap(v, sea ? ['crash/crash-rescue-boat.glb'] : amb ? ['crash/crash-ambulance.glb'] : i === 0 ? ['crash/crash-command-vehicle.glb', 'crash/crash-fire-engine.glb', 'vehicles/fire-truck.glb'] : ['crash/crash-fire-engine.glb', 'vehicles/fire-truck.glb'], true);
    v.position.set(x, gy(x, z) + (sea ? -0.3 : 0), z); v.rotation.y = -ang + Math.PI;   // facing the wreck
    grp.add(v); veh.push(v); if (sea) v.userData.boat = true;
  }
  if (sea) glow.scale.set(380, 1, 380);
  return { site, obj: grp, fire, smoke, glow, lights, veh, sea, x: P.x, y: y0, z: P.z };
}

/** A crash-scene model from the folder (the first of `paths` that is there) in place of the app's own. With
 *  `frontPlusX`, the app's own faces +X (the vehicles drive towards the wreck), so the file's front is turned that way. */
function crashSwap(g: any, paths: string[], frontPlusX: boolean) {
  const path = Models.first(paths); if (!path) return;
  try {
    if (!frontPlusX) { Models.swap(g, path, false); return; }
    const T = THREE, inner = new T.Group(); inner.rotation.y = Math.PI; g.add(inner); g.updateMatrixWorld(true);
    for (const o of g.children.slice()) if (o !== inner && !o.userData.keep) inner.attach(o);
    Models.swap(inner, path, true);
  } catch (e) { /* the app's own */ }
}
/** The debris piece from crash/crash-debris.glb: its first mesh, centred and scaled to about a metre, for the instanced debris. */
function crashDebrisGeo(): { geo: any; mat: any } {
  const P = 'crash/crash-debris.glb'; if (!Models.has(P)) return null;
  const g = Models.ready[P]; if (!g) { Models.load(P); return null; }   // next time it is built
  let mesh: any = null; g.scene.traverse((o: any) => { if (!mesh && o.isMesh) mesh = o; }); if (!mesh) return null;
  const geo = mesh.geometry.clone(); geo.computeBoundingBox(); const b = geo.boundingBox, c = b.getCenter(new THREE.Vector3()), sz = b.getSize(new THREE.Vector3());
  geo.translate(-c.x, -c.y, -c.z); geo.scale(1 / Math.max(0.001, sz.x, sz.y, sz.z), 1 / Math.max(0.001, sz.x, sz.y, sz.z), 1 / Math.max(0.001, sz.x, sz.y, sz.z));
  return { geo, mat: Array.isArray(mesh.material) ? mesh.material[0] : mesh.material };
}

/** Each frame: the fires flicker and die down over the hours, the smoke drifts with the wind, the lights flash. */
function v3dCrashStep(now: number) {
  if (!V3dCrash.list.length) return;
  const t = now / 1000, a: any = (V3dSky as any).a, wind = a && a.wx ? [Math.cos(a.wx.dir) * a.wx.wind * 9, Math.sin(a.wx.dir) * a.wx.wind * 9] : [2, 1];
  const night = (V3dSky as any).U ? (V3dSky as any).U.uNight.value : 0, amb = (V3dSky as any).amb || 1;
  for (const c of V3dCrash.list) {
    if (!c.obj.parent) continue;
    const age = Date.now() - c.site.at, fk = clamp(1 - age / CRASH_FIRE_MS, 0, 1), sk = clamp(1 - age / CRASH_SMOKE_MS, 0.12, 1);
    const fu = c.fire.material.uniforms, su = c.smoke.material.uniforms;
    fu.uTime.value = t; fu.uK.value = fk; fu.uWind.value.set(wind[0], wind[1]); c.fire.visible = fk > 0.01;
    su.uTime.value = t; su.uK.value = sk; su.uWind.value.set(wind[0], wind[1]); su.uAmb.value = amb;
    c.glow.material.uniforms.uK.value = fk * (0.12 + 0.55 * night) * (0.85 + 0.15 * Math.sin(t * 11) * Math.sin(t * 7.3));
    const vehOn = age < 12 * 3600e3;
    if (c.sea) for (const v of c.veh || []) { if (v.userData.y0 == null) v.userData.y0 = v.position.y; v.position.y = v.userData.y0 + Math.sin(t * 1.3 + v.id) * 0.25; v.rotation.z = Math.sin(t * 1.1 + v.id) * 0.04; }
    for (const l of c.lights) {
      const on = vehOn && Math.sin((t * 2.6 + l.ph) * Math.PI * 2) > 0;
      l.m.material.color.setHex(on ? (l.amb && l.ph % 1 > 0.4 ? 0xFF2020 : 0x2448FF) : 0x0A0A14);
    }
  }
}
function v3dCrashClear() { V3dCrash.list = []; }

/** Opened from a crash notification or the map: once the view is ready, the free camera looks at the wreck from a little way off. */
function v3dCrashFocusStep() {
  const VC: any = V3d; if (!VC.crashFocus || !V3d.loaded) return;
  const c = V3dCrash.list.filter((x: any) => x.site.apt === VC.crashFocus)[0]; if (!c) return;
  VC.crashFocus = null;
  try {
    const e = document.createElement('b'); e.setAttribute('data-m', 'free'); ACTIONS['v3d-mode'](e, null);
    const F: any = (V3d as any).fc; if (!F) return;
    const T = THREE, ang = 0.7, d = 230;
    F.pos = new T.Vector3(c.x + Math.cos(ang) * d, c.y + 70, c.z + Math.sin(ang) * d);
    const dir = new T.Vector3(c.x, c.y + 8, c.z).sub(F.pos).normalize();
    F.yaw = Math.atan2(dir.x, -dir.z); F.pitch = Math.asin(clamp(dir.y, -1, 1));
  } catch (e) { /* the normal view */ }
}

/** The map: a pulsing fire mark at airports with a crash site; tapping it goes there in 3D. */
function crashMapDraw(c: CanvasRenderingContext2D, m: any) {
  const list = crashSites(); if (!list.length) return;
  const t = Date.now() / 1000; m._crashHits = [];
  for (const s of list) {
    const A = apt(s.apt); if (!A) continue;
    const p = m.px(A.pos[0], A.pos[1]); if (!p || p[0] < -20 || p[1] < -20 || p[0] > m.w + 20 || p[1] > m.h + 20) continue;
    const age = Date.now() - s.at, hot = age < CRASH_FIRE_MS, k = 0.5 + 0.5 * Math.sin(t * 3);
    c.save();
    c.globalAlpha = 0.35 * k; c.fillStyle = hot ? '#FF5A1F' : '#8A8F98'; c.beginPath(); c.arc(p[0] + 14, p[1] - 14, 13 + 4 * k, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 1; c.fillStyle = hot ? '#FF5A1F' : '#5B616B'; c.strokeStyle = '#0B1726'; c.lineWidth = 2;
    c.beginPath(); c.arc(p[0] + 14, p[1] - 14, 9, 0, Math.PI * 2); c.fill(); c.stroke();
    // a little flame
    c.fillStyle = '#FFE08A'; c.beginPath(); c.moveTo(p[0] + 14, p[1] - 21); c.quadraticCurveTo(p[0] + 19, p[1] - 14, p[0] + 14, p[1] - 9); c.quadraticCurveTo(p[0] + 9, p[1] - 14, p[0] + 14, p[1] - 21); c.fill();
    c.restore();
    m._crashHits.push([p[0] + 14, p[1] - 14, s.apt]);
  }
}
/** A tap on a crash mark: [true] when it was one. */
function crashMapTap(m: any, x: number, y: number): boolean {
  for (const h of m._crashHits || []) if (Math.hypot(h[0] - x, h[1] - y) < 16) { const e = document.createElement('b'); e.setAttribute('data-apt', h[2]); ACTIONS['crash-3d'](e, null); return true; }
  return false;
}

/* ---------- turbulence ---------- */

/** How rough the air is for an aircraft (0 calm – 1 severe): what Flight Simulator reports for your own
 *  aircraft when linked; otherwise the real hazard reports (SIGMET areas of severe turbulence, mountain waves
 *  and thunderstorms at its height), nearby storm clouds, flying in or just under heap clouds, and strong
 *  wind low down. Worked out every couple of seconds. */
function v3dTurbAt(P: any, lon: number, lat: number, altFt: number, aglFt: number, you: boolean): number {
  const now = Date.now(); if (P._turbAt && now - P._turbAt < 2000) return P._turb || 0;
  P._turbAt = now;
  let k = 0.04;   // the air is never perfectly still
  try {
    const L: any = typeof Link !== 'undefined' ? (Link as any).sim : null;
    if (you && L && L.wx && L.t && now - L.t < 20000) {
      k = ({ none: 0.04, light: 0.3, moderate: 0.62, severe: 0.95 } as any)[L.wx.turb] || 0.04;
    } else {
      if (aglFt > 20) for (const s of Sigmets.active()) {
        if (!/TURB|MTW|TS/.test(s.hazard)) continue;
        if (s.top && (altFt < (s.base || 0) - 1000 || altFt > s.top + 1000)) continue;
        if (Sigmets.inside([lon, lat], s.poly)) k = Math.max(k, s.hazard === 'TS' ? 0.7 : s.hazard === 'MTW' ? 0.6 : 0.85);
      }
      const q = v3dXY(lon, lat), cam = V3d.cam ? V3d.cam.position : null; void cam;
      for (const st of (V3dClouds as any).storms || []) { const d = Math.hypot(st[0] - q[0], st[2] - q[1]); if (d < st[4] * 3) k = Math.max(k, 0.65 * (1 - d / (st[4] * 3)) + 0.2); }
      const ll = [lon, lat], list = cloudStations(lon, lat, 60), stn = cloudNearest(list, lon, lat, 60);
      if (stn && aglFt > 50) for (const l of stn.layers) {
        const kind = cloudKind(l), base = l.base + (stn.elev || 0) / 0.3048;
        if ((kind === 'cu' || kind === 'tcu') && altFt > base - 1500 && altFt < base + 4000) k = Math.max(k, kind === 'tcu' ? 0.45 : 0.22);
      }
      const A: any = (V3dSky as any).a, wind = A && A.wx ? A.wx.wind * 32 : 0;   // knots
      if (aglFt < 3000 && wind > 18) k = Math.max(k, Math.min(0.5, (wind - 18) / 30 + 0.15) * (1 - aglFt / 3000));
      void ll;
    }
  } catch (e) { /* calm */ }
  if (aglFt < 15) k *= 0.15;   // on the ground: hardly anything
  P._turb = k; return k;
}
/** The aircraft's motion in the air: a gentle sway in light turbulence, sharp drops and rolls in severe;
 *  [up m, roll °, pitch °, wing flex]. Visual only. */
function v3dTurbMotion(P: any, k: number, t: number): number[] {
  P._tk = (P._tk || 0) + (k - (P._tk || 0)) * 0.02;   // eases in and out
  const K = P._tk, sd = P._tseed || (P._tseed = Math.random() * 100), f = (a: number, b: number, c: number) => Math.sin(t * a + sd * b) * Math.sin(t * c + sd);
  const up = K * K * 9 * (0.6 * f(1.3, 1.7, 0.37) + 0.4 * f(2.9, 3.1, 0.71)) + K * 0.6 * Math.sin(t * 5.3 + sd);
  return [up, K * 7 * f(1.7, 2.3, 0.53), K * 2.5 * f(1.1, 0.7, 0.29), K * (0.6 * Math.sin(t * 2.4 + sd) + 0.4 * Math.sin(t * 4.1 + sd * 2))];
}

/* ---------- emergencies in flight and on the runway ---------- */

/** An engine on fire: flames from the nacelle streaming back, a trail of black smoke. On the runway after an
 *  emergency landing: fire engines around the aircraft spraying the engine; then a tug tows it in. */
function v3dEmergencyStep(P: any, f: any, fireI: number, fe: any, now: number, ground: number, w: any) {
  const T = THREE, body = P.model.userData.body, pts: any[] = body && body.userData.engPts; if (!pts) return;
  // the flames, fixed to the engine
  if (fireI >= 0 && pts[fireI]) {
    if (!P.fireFx) { P.fireFx = crashFx('fire', [[0, 0, 0, Math.max(2.5, pts[fireI].d * 1.6)]], 40); body.add(P.fireFx); }
    const e = pts[fireI]; P.fireFx.position.copy(e.exh); P.fireFx.visible = true;
    const u = P.fireFx.material.uniforms; u.uTime.value = now / 1000; u.uK.value = 1; u.uWind.value.set(w.onGround ? 4 : 40, 0);   // streaming back along the fuselage
    if (now - (P.fireSmokeAt || 0) > 70) { P.fireSmokeAt = now; body.updateMatrixWorld(); const wp = body.localToWorld(e.exh.clone()); v3dSmokePuff(wp.x, wp.y, wp.z, 1.4, 0x1A1A1A); }
  } else if (P.fireFx) P.fireFx.visible = false;
  // the stop on the runway: fire engines around the aircraft, spraying the engine that burned
  const em = f && f.emerg, onStop = !!(em && fe && fe.hold && fe.hold.kind === 'runway' && em.stopAt != null && Math.abs(fe.hold.at - em.stopAt) < 1);
  if (onStop) {
    if (!P.trucks) {
      P.trucks = new T.Group(); const mRed = new T.MeshLambertMaterial({ color: 0xB3151B }), mYel = new T.MeshLambertMaterial({ color: 0xD8C21A });
      for (let i = 0; i < 3; i++) { const v = new T.Group(); const b = new T.Mesh(new T.BoxGeometry(10.5, 3.3, 2.6), i === 2 ? mYel : mRed); b.position.y = 2.05; v.add(b);
        const lt = new T.Mesh(new T.SphereGeometry(0.3, 8, 6), new T.MeshBasicMaterial({ color: 0x2448FF })); lt.position.set(4.6, 3.9, 0); v.add(lt); v.userData.lt = lt; P.trucks.add(v); }
      V3d.scene.add(P.trucks);
    }
    const h = P.hdg * D2R, fx = Math.sin(h), fz = -Math.cos(h), rx = Math.cos(h), rz = Math.sin(h), e = pts[f.emerg.eng] || pts[0];
    body.updateMatrixWorld(); const ep = body.localToWorld(e.mid.clone());
    P.trucks.children.forEach((v: any, i: number) => {
      const side = (i === 1 ? -1 : 1) * (ep.clone().sub(P.pos).dot(new T.Vector3(rx, 0, rz)) >= 0 ? 1 : -1), along = [8, -6, 22][i], off = [24, 26, 30][i];
      v.position.set(ep.x + fx * along + rx * side * off, ground, ep.z + fz * along + rz * side * off);
      v.lookAt(ep.x, ground, ep.z); v.rotateY(-Math.PI / 2);
      v.userData.lt.material.color.setHex(Math.sin(now / 1000 * 16 + i) > 0 ? 0x2448FF : 0xFF2020);
      // the water and foam from the roof cannon onto the engine
      if (i < 2 && now - (v.userData.sprayAt || 0) > 80) {
        v.userData.sprayAt = now; const k = Math.random();
        const s0 = new T.Vector3(v.position.x, ground + 4, v.position.z), mid = s0.clone().lerp(ep, k); mid.y += Math.sin(k * Math.PI) * 6;
        v3dSmokePuff(mid.x, mid.y, mid.z, 0.5 + k * 0.5);
      }
    });
    P.trucks.visible = true;
  } else if (P.trucks) { V3d.scene.remove(P.trucks); P.trucks = null; }
  // towed in after a fire: a tug at the nose wheel
  const towing = !!(em && em.tow && em.noted && w.onGround && /taxi in|parking|arrived/i.test(String(w.phase || '')) && !onStop);
  if (towing) {
    if (!P.tug) {
      P.tug = new T.Group(); const tug = new T.Mesh(new T.BoxGeometry(5, 1.4, 2.6), new T.MeshLambertMaterial({ color: 0xE3C21C })); tug.position.y = 0.9; P.tug.add(tug);
      const cab = new T.Mesh(new T.BoxGeometry(1.4, 1.1, 1.6), new T.MeshLambertMaterial({ color: 0x30343A })); cab.position.set(1.2, 2, 0); P.tug.add(cab);
      const bar = new T.Mesh(new T.CylinderGeometry(0.08, 0.08, 6, 6), new T.MeshLambertMaterial({ color: 0x555A60 })); bar.rotation.z = Math.PI / 2; bar.position.set(-5, 0.6, 0); P.tug.add(bar);
      V3d.scene.add(P.tug);
    }
    const s = shapeOf(P.type), h = P.hdg * D2R, fx = Math.sin(h), fz = -Math.cos(h), nose = (body.position.x) + s.gear.nose;   // the nose wheel, from the model's middle
    const ahead = -nose + 8;
    P.tug.position.set(P.pos.x + fx * ahead, ground, P.pos.z + fz * ahead); P.tug.rotation.set(0, -h + Math.PI / 2, 0);
    P.tug.visible = true;
  } else if (P.tug) { V3d.scene.remove(P.tug); P.tug = null; }
}
