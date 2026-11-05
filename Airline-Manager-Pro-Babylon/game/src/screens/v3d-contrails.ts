// Contrails in the 3D view: aircraft cruising where the air is colder than about −40 °C (above about 8,500 m in
// the standard atmosphere, lower in winter and near the poles) leave white trails from their engines. In dry air
// they fade within seconds; in damp air they linger and spread for a minute or more. Each engine leaves a
// ribbon that always faces the camera, widening and fading with age. On the PC the trails are longer
// and finer (more points, longer life); Settings → Graphics → Sky and water switches them off.

const CT_N = () => hiQ() ? 420 : 220;          // samples kept per engine
const CT_DT = () => hiQ() ? 0.18 : 0.3;        // seconds between samples
let _ctMat: any = null;
function v3dContrailMat(): any {
  if (_ctMat) return _ctMat;
  const T = THREE;
  _ctMat = new T.ShaderMaterial({
    uniforms: { uNow: { value: 0 }, uCol: { value: new T.Color(0.97, 0.98, 1) } },
    vertexShader: `attribute float aBirth; attribute float aSide; attribute float aLife; attribute vec3 aDir; uniform float uNow; varying float vA; varying float vS;
      void main() {
        float age = max(0.0, uNow - aBirth), k = clamp(age / max(1.0, aLife), 0.0, 1.0);
        // faint just behind the engines, full a little further back, then fading gently towards the far end
        vA = aBirth <= 0.0 ? 0.0 : smoothstep(0.0, 2.5, age) * pow(1.0 - k, 1.6) * 0.6;
        vS = aSide;
        vec3 c = position + vec3(0.0, -age * 0.08, 0.0);
        vec4 mv = modelViewMatrix * vec4(c, 1.0);
        // across the trail as seen from here; looking along it (where that has no direction) it lies flat across the view
        vec3 v = normalize(mv.xyz), d = normalize((modelViewMatrix * vec4(aDir, 0.0)).xyz + vec3(0.0001));
        vec3 sd = cross(d, v); float L = length(sd);
        vec3 flat0 = normalize(cross(v, vec3(0.0, 1.0, 0.0)) + vec3(0.0001));
        vec3 side = normalize(mix(flat0, sd / max(L, 0.0001), smoothstep(0.05, 0.3, L)));
        float wdt = 1.3 + age * (aLife > 50.0 ? 0.2 : 0.09);   // half width in metres: thin at first, spreading as it ages
        mv.xyz += side * aSide * wdt;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform vec3 uCol; varying float vA; varying float vS;
      void main() { float e = 1.0 - vS * vS; if (vA * e <= 0.003) discard; gl_FragColor = vec4(uCol, vA * e); }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  return _ctMat;
}
/** Is the air cold enough for a contrail here (about −40 °C or colder)? */
function v3dContrailCold(altM: number, lat: number): boolean {
  const month = new Date().getMonth(), winter = (lat >= 0 ? [11, 0, 1, 2] : [5, 6, 7, 8]).indexOf(month) >= 0;
  const surf = 28 - Math.abs(lat) * 0.45 - (winter ? 10 : 0);   // a rough surface temperature for the latitude and season
  return surf - 6.5 * altM / 1000 <= -40;
}
function v3dContrailRibbon(n: number): any {
  const T = THREE, geo = new T.BufferGeometry(), idx: number[] = [];
  geo.setAttribute('position', new T.BufferAttribute(new Float32Array(n * 2 * 3), 3));
  geo.setAttribute('aDir', new T.BufferAttribute(new Float32Array(n * 2 * 3), 3));
  geo.setAttribute('aBirth', new T.BufferAttribute(new Float32Array(n * 2), 1));
  geo.setAttribute('aLife', new T.BufferAttribute(new Float32Array(n * 2), 1));
  const side = new Float32Array(n * 2); for (let i = 0; i < n; i++) { side[i * 2] = -1; side[i * 2 + 1] = 1; }
  geo.setAttribute('aSide', new T.BufferAttribute(side, 1));
  for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  geo.setIndex(idx); geo.setDrawRange(0, 0);
  const m = new T.Mesh(geo, v3dContrailMat()); m.frustumCulled = false; m.renderOrder = 20; return m;
}
/** One aircraft's trails: a ribbon per engine. The newest point stays on the engine; older ones are left behind. */
function v3dContrailStep(P: any, g: any, w: any, now: number) {
  const S: any = State.settings;
  const drop = () => { if (P.ct) { for (const r of P.ct.rb) { V3d.scene.remove(r.mesh); r.mesh.geometry.dispose(); } P.ct = null; } };
  if (S.v3dContrails === false) { drop(); return; }
  const T = THREE, t = now / 1000, M = v3dContrailMat(); M.uniforms.uNow.value = t;
  // lit like the sky around it: white by day, warm at sunset, dim at night
  try { const fc = V3d.scene.fog && V3d.scene.fog.color; if (fc) { const l = Math.max(0.6, Math.min(1, 0.4 + (fc.r + fc.g + fc.b) / 1.2)); M.uniforms.uCol.value.setRGB(0.97, 0.98, 1).lerp(fc.clone().multiplyScalar(2.2), 0.25).multiplyScalar(l); } } catch (e) { /* white */ }
  // on while it is cold enough up there, and kept on through short changes (no flicker on and off)
  const want = !w.onGround && v3dContrailCold(w.altM, w.lat) && (g.gs || 0) > 200, PC: any = P;
  if (want) PC.ctLast = t;
  const on = want || (PC.ctLast != null && t - PC.ctLast < 20 && !w.onGround);
  if (!on && !P.ct) return;
  const body = P.model.userData.body; P.model.updateMatrixWorld(true);
  const E: any[] = (body.userData.engPts || []).filter((e: any) => e.exh);
  const src = E.length ? E.map(e => e.exh) : [new T.Vector3(shapeOf(P.type).L * 0.6, 0, 0)];
  if (!P.ct) {
    // damp or dry air up there: the same for a while for each aircraft
    const damp = (_hashStr(String(g.id) + Math.floor(Date.now() / 3600e3)) % 100) < 55;
    P.ct = { rb: src.map(() => { const mesh = v3dContrailRibbon(CT_N()); V3d.scene.add(mesh); return { mesh, n: 0 }; }), at: 0, life: damp ? (hiQ() ? 75 : 60) : 22 + (_hashStr(String(g.id)) % 10) };
  }
  const C = P.ct, N = CT_N(), add = on && t - C.at >= CT_DT();
  if (add) C.at = t;
  src.forEach((lp: any, k: number) => {
    const R = C.rb[k]; if (!R) return;
    const geo = R.mesh.geometry, pos = geo.attributes.position.array as Float32Array, dir = geo.attributes.aDir.array as Float32Array, bi = geo.attributes.aBirth.array as Float32Array, li = geo.attributes.aLife.array as Float32Array;
    const p = body.localToWorld(lp.clone());
    // the view moved its centre (a long way flown): the whole trail moves with the world, so it stays behind the engines
    if (R.n > 1) {
      const jx = p.x - pos[0], jy = p.y - pos[1], jz = p.z - pos[2], lv = R.lv || [0, 0, 0];
      if (Math.abs(jx - lv[0]) + Math.abs(jy - lv[1]) + Math.abs(jz - lv[2]) > 1500) {
        const ox = jx - lv[0], oy = jy - lv[1], oz = jz - lv[2];
        for (let i = 0; i < R.n * 2; i++) { pos[i * 3] += ox; pos[i * 3 + 1] += oy; pos[i * 3 + 2] += oz; }
      }
      R.lv = [p.x - pos[0], p.y - pos[1], p.z - pos[2]];
    }
    if (add || !R.n) {
      // a new sample at the front: everything else moves one place back
      pos.copyWithin(6, 0, (N - 1) * 6); dir.copyWithin(6, 0, (N - 1) * 6); bi.copyWithin(2, 0, (N - 1) * 2); li.copyWithin(2, 0, (N - 1) * 2);
      R.n = Math.min(N, R.n + 1);
      for (const j of [0, 1]) { bi[j] = on ? t : 0; li[j] = C.life; }
    }
    // the front follows the engine
    for (const j of [0, 1]) { pos[j * 3] = p.x; pos[j * 3 + 1] = p.y; pos[j * 3 + 2] = p.z; }
    if (R.n > 1) { const dx = pos[0] - pos[6], dy = pos[1] - pos[7], dz = pos[2] - pos[8]; for (const j of [0, 1]) { dir[j * 3] = dx; dir[j * 3 + 1] = dy; dir[j * 3 + 2] = dz; } if (add && R.n > 2) for (const j of [2, 3]) { dir[j * 3] = pos[6] - pos[12]; dir[j * 3 + 1] = pos[7] - pos[13]; dir[j * 3 + 2] = pos[8] - pos[14]; } }
    geo.attributes.position.needsUpdate = true; geo.attributes.aDir.needsUpdate = true; geo.attributes.aBirth.needsUpdate = true; geo.attributes.aLife.needsUpdate = true;
    geo.setDrawRange(0, Math.max(0, (R.n - 1) * 6));
  });
  // a trail that has fully faded is put away
  if (!on && t - C.at > C.life + 2) drop();
}

/* ---------- heat haze behind the engines (the PC) ---------- */
// While the engines run on the ground (taxiing, lined up, the take-off roll), the hot exhaust makes what is behind
// them shimmer: a clear patch behind each engine bends the view through it, moving with the flow.
let _hazeMat: any = null;
function v3dHazeMat(): any {
  if (_hazeMat) return _hazeMat;
  const T = THREE, c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d') as CanvasRenderingContext2D, img = x.createImageData(128, 128);
  for (let i = 0; i < 128 * 128; i++) { const u = (i % 128) / 128, v = Math.floor(i / 128) / 128; const a = Math.sin(u * 25 + Math.sin(v * 13) * 2) * 0.5 + Math.sin(v * 31 + u * 7) * 0.5; img.data[i * 4] = 128 + a * 60; img.data[i * 4 + 1] = 128 + Math.cos(u * 19 - v * 23) * 60; img.data[i * 4 + 2] = 255; img.data[i * 4 + 3] = 255; }
  x.putImageData(img, 0, 0); const tex = new T.CanvasTexture(c); tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.repeat.set(2, 1);
  // soft edges: strongest in the middle of the plume, nothing at its edges
  const ac = document.createElement('canvas'); ac.width = ac.height = 64; const ax = ac.getContext('2d') as CanvasRenderingContext2D, gr = ax.createRadialGradient(32, 32, 2, 32, 32, 31);
  gr.addColorStop(0, '#fff'); gr.addColorStop(0.5, '#888'); gr.addColorStop(1, '#000'); ax.fillStyle = gr; ax.fillRect(0, 0, 64, 64);
  _hazeMat = new T.MeshPhysicalMaterial({ transmission: 1, roughness: 0, metalness: 0, thickness: 0.25, ior: 1.02, normalMap: tex, normalScale: new T.Vector2(0.35, 0.35), alphaMap: new T.CanvasTexture(ac), transparent: true, opacity: 1, depthWrite: false, side: T.DoubleSide, specularIntensity: 0 });
  return _hazeMat;
}
function v3dHazeStep(P: any, w: any, now: number) {
  const S: any = State.settings, ph = String(P.ph || '').toLowerCase();
  const on = hiQ() && S.v3dHaze !== false && w.onGround && /taxi|line|take-?off|roll|hold|push/.test(ph);
  if (!on) { if (P.haze) P.haze.visible = false; return; }
  const body = P.model.userData.body; if (!body) return;
  if (!P.haze) {
    const T = THREE, g = new T.Group(), E: any[] = (body.userData.engPts || []).filter((e: any) => e.exh);
    for (const e of E) for (const r of [0, Math.PI / 2]) { const q = new T.Mesh(new T.PlaneGeometry(r ? (e.d || 1.5) * 1.4 : 7, (e.d || 1.5) * 1.5), v3dHazeMat()); q.rotation.x = r ? 0 : 0; q.rotation.y = r; q.position.copy(e.exh).add(new T.Vector3(r ? 5 : 3.8, 0, 0)); q.renderOrder = 30; g.add(q); }   // seen from the side and from behind
    body.add(g); P.haze = g;
  }
  P.haze.visible = true;
  const M = v3dHazeMat(); M.normalMap.offset.set(-now / 1000 * 1.8, Math.sin(now / 700) * 0.05);
}
