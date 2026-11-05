/* Clouds from the real-world airport reports: clouds built in three dimensions in the 3D view, see-through layers on the map. */

const CLOUD_COV: { [k: string]: number } = { FEW: 0.19, SCT: 0.44, BKN: 0.75, OVC: 1 };

function cloudKm(): number { const v = (State.settings as any).cloudKm; return clamp(v == null ? 80 : +v, 0, 300); }
function cloudDetail(): number { const v = (State.settings as any).cloudDetail; return clamp(v == null ? 2 : Math.round(+v), 1, 4); }
const CLOUD_DETAIL_NAMES = ['Light', 'Normal', 'Detailed', 'Very detailed'];
/** 2D clouds: flat layers instead of clouds built in three dimensions (lighter to draw). They come from the same
 *  reports: the cover, the height of each layer, rain, snow and storms. */
function cloudFlat(): boolean { return (State.settings as any).cloud2d === true; }

/* ---------- shared: noise and the reports near a place ---------- */

function cloudHash(x: number, y: number, s: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
/** Smooth value noise (0–1) over kilometres, two octaves; the same everywhere for the same place. */
function cloudNoise(xKm: number, yKm: number, scaleKm: number, seed: number): number {
  const one = (x: number, y: number, s: number) => {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const a = cloudHash(ix, iy, s), b = cloudHash(ix + 1, iy, s), c = cloudHash(ix, iy + 1, s), d = cloudHash(ix + 1, iy + 1, s);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  };
  const n = one(xKm / scaleKm, yKm / scaleKm, seed) * 0.65 + one(xKm / scaleKm * 2.7, yKm / scaleKm * 2.7, seed + 7) * 0.35;
  return clamp((n - 0.5) * 2.1 + 0.5, 0, 1);   // spread out, so the share under a threshold is close to the coverage
}
interface CloudStation { pos: number[]; elev: number; layers: { cover: string; base: number; type?: string }[]; wx?: string; temp?: number }
/** Reports with cloud information within reach of a point (lon, lat), at most a few minutes old in the cache. */
function cloudStations(lon: number, lat: number, rKm: number): CloudStation[] {
  const out: CloudStation[] = [], cache: any = LiveWx.cache;
  for (const k in cache) {
    const w = cache[k]; if (!w || !w.clouds || Date.now() - w.at > 3 * 3600e3) continue;
    const A = apt(k); if (!A) continue;
    if (gcDistanceNm([lon, lat], A.pos) * 1.852 > rKm) continue;
    out.push({ pos: A.pos, elev: w.elev || (A as any).elev || 0, layers: w.clouds, wx: w.wx || '', temp: w.temp });
  }
  return out;
}
/** The nearest report to a point, with the borders between reports made irregular. */
function cloudNearest(list: CloudStation[], lon: number, lat: number, maxKm: number): CloudStation {
  const k = Math.cos(lat * D2R), xk = lon * 111.32 * k, yk = lat * 110.54;
  const wx = (cloudNoise(xk, yk, 30, 91) - 0.5) * 40, wy = (cloudNoise(xk, yk, 30, 92) - 0.5) * 40;
  let best: CloudStation = null, bd = maxKm * maxKm;
  for (const s of list) {
    const dx = (s.pos[0] - lon) * 111.32 * k - wx, dy = (s.pos[1] - lat) * 110.54 - wy, d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}
/** What kind of cloud a layer is: thunderstorm, towering, high (cirrus), a sheet (broken or overcast), or heaps. */
function cloudKind(l: { cover: string; base: number; type?: string }): string {
  return l.type === 'CB' ? 'cb' : l.type === 'TCU' ? 'tcu' : l.base >= 18000 ? 'ci' : l.cover === 'OVC' || (l.cover === 'BKN' && l.base < 5000) ? 'st' : 'cu';
}

/** What falls from a report's clouds: rain or snow, how hard (0–1), thunder, and whether it is only nearby (VC). */
function cloudPrecip(wx: string): { kind: string; k: number; ts: boolean; vc: boolean } {
  wx = String(wx || ''); if (!wx) return null;
  const ts = /TS/.test(wx), sn = /SN|SG|GS|PL/.test(wx), ra = /RA|DZ|SH|GR|UP/.test(wx);
  if (!ts && !sn && !ra) return null;
  const k = /\+/.test(wx) ? 1 : /(^|\s)-/.test(wx) ? 0.4 : /DZ/.test(wx) && !/RA/.test(wx) ? 0.3 : 0.7;
  const vc = !/(^|\s)[-+]?(TS|RA|SN|DZ|SH|GR|SG|PL)/.test(wx.replace(/VC\w+/g, '').trim()) && /VC/.test(wx);
  return { kind: sn && !/RA/.test(wx) ? 'sn' : 'ra', k, ts, vc };
}

/* ---------- the 3D view ---------- */

/* Each cloud is built in three dimensions: a heap of round puffs placed in the world (cumulus, towers, anvils)
 * or stacked flat sheets (overcast, high cloud). A puff is drawn as a soft sphere: its surface, its light and
 * its ragged edge are worked out in world space, so a cloud keeps its shape and its sunny side from every
 * angle while you circle around it. Clouds that come or go (a new report, a layer that moved) fade in and out. */

interface CloudPuff { x: number; y: number; z: number; m: number; s: number; h: number; a: number; sd: number; dx: number; dy: number; dz: number; id: string; w?: number; born?: number; dies?: number }
const CLOUD_FADE_S = 25;   // seconds for a cloud to form or dissolve
const V3dClouds: any = { mesh: null, key: '', at: 0, cx: 0, cz: 0, list: [] as CloudPuff[], sortAt: 0, sx: 1e9, sz: 1e9, fetchAt: 0, fetchKey: '', built: false, storms: [] as number[][] };
function cloudClock(): number { return performance.now() / 1000; }

function v3dCloudMesh(max: number): any {
  const T = THREE, geo = new T.InstancedBufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
  geo.setAttribute('uv', new T.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  for (const [n, k] of [['iOff', 4], ['iData', 4], ['iDir', 4], ['iFade', 2]] as [string, number][])
    geo.setAttribute(n, new T.InstancedBufferAttribute(new Float32Array(max * k), k).setUsage(T.DynamicDrawUsage));
  geo.instanceCount = 0;
  const mat = new T.ShaderMaterial({
    uniforms: T.UniformsUtils.merge([T.UniformsLib.fog, {
      uFar: { value: 1e5 }, uTime: { value: 0 }, uFadeT: { value: CLOUD_FADE_S }, uDetail: { value: 1 },
      uLight: { value: new T.Color(0.97, 0.98, 1) }, uDark: { value: new T.Color(0.5, 0.55, 0.63) },
      uSun: { value: new T.Vector3(0, 1, 0) }, uSunK: { value: 1 },
      uFlashPos: { value: new T.Vector3() }, uFlashK: { value: 0 }, uCut: { value: 0.006 },
    }]),
    vertexShader: `
      #include <common>
      #include <fog_pars_vertex>
      #include <logdepthbuf_pars_vertex>
      attribute vec4 iOff; attribute vec4 iData; attribute vec4 iDir; attribute vec2 iFade;
      uniform float uTime; uniform float uFadeT;
      varying vec2 vUv; varying vec3 vCen; varying vec4 vData; varying vec3 vDir; varying float vMode; varying float vFade; varying float vHgt;
      void main() {
        float s = iData.x; vHgt = iDir.w;
        vec4 mvPosition;
        if (iOff.w > 0.5 && iOff.w < 1.5) {
          // a round puff: a disc facing the camera, shaded in the fragment shader as the sphere it stands for
          mvPosition = modelViewMatrix * vec4(iOff.xyz, 1.0);
          mvPosition.xy += position.xy * s;
          float d = length(mvPosition.xyz);
          mvPosition.xyz *= max(0.05, (d - s * 0.5) / d);
        } else if (iOff.w > 2.5) {
          // rain or snow falling from the cloud base to the ground: upright, turned to face the camera around its own axis
          vec3 rh = normalize(vec3(viewMatrix[0][0], 0.0, viewMatrix[2][0]) + vec3(1e-5, 0.0, 0.0));
          mvPosition = modelViewMatrix * vec4(iOff.xyz + rh * position.x * s + vec3(0.0, (position.y - 0.5) * iDir.w, 0.0), 1.0);
        } else {
          // a sheet: lies flat in the world
          mvPosition = modelViewMatrix * vec4(iOff.xyz + vec3(position.x * s, 0.0, position.y * s), 1.0);
        }
        vUv = uv; vCen = (modelMatrix * vec4(iOff.xyz, 1.0)).xyz; vData = iData; vDir = iDir.xyz; vMode = iOff.w;
        vFade = smoothstep(iFade.x, iFade.x + uFadeT, uTime) * (1.0 - smoothstep(iFade.y, iFade.y + uFadeT, uTime));
        gl_Position = projectionMatrix * mvPosition;
        if (vFade < 0.001) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        #include <logdepthbuf_vertex>
        #include <fog_vertex>
      }`,
    fragmentShader: `
      #include <common>
      #include <fog_pars_fragment>
      #include <logdepthbuf_pars_fragment>
      uniform vec3 uLight; uniform vec3 uDark; uniform vec3 uSun; uniform float uSunK; uniform float uFar; uniform float uDetail; uniform float uTime; uniform float uCut;
      uniform vec3 uFlashPos; uniform float uFlashK;
      varying vec2 vUv; varying vec3 vCen; varying vec4 vData; varying vec3 vDir; varying float vMode; varying float vFade; varying float vHgt;
      float h31(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float vn(vec3 x) {
        vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(h31(i), h31(i + vec3(1.0, 0.0, 0.0)), f.x), mix(h31(i + vec3(0.0, 1.0, 0.0)), h31(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
                   mix(mix(h31(i + vec3(0.0, 0.0, 1.0)), h31(i + vec3(1.0, 0.0, 1.0)), f.x), mix(h31(i + vec3(0.0, 1.0, 1.0)), h31(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
      }
      void main() {
        #include <logdepthbuf_fragment>
        vec2 q = vUv * 2.0 - 1.0; float r2 = dot(q, q);
        if (r2 >= 1.0) discard;
        float s = vData.x, hgt = vData.y, a0 = vData.z, sd = vData.w;
        vec3 R = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 U = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        vec3 B = vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);
        vec3 col; float a;
        if (vMode > 0.5 && vMode < 1.5) {
          // the point of the sphere under this pixel, in the world
          vec3 n = normalize(R * q.x + U * q.y + B * sqrt(1.0 - r2));
          vec3 p = vCen + n * s * 0.5;
          float nz = vn(p / (s * 0.3) + sd * 17.0) * (1.0 - 0.38 * uDetail) + vn(p / (s * 0.11) + sd * 5.0) * 0.38 * uDetail;
          float den = (1.0 - r2) * 1.3 - (nz - 0.3) * 0.95;
          a = smoothstep(0.0, 0.5, den) * a0;
          // light: the side towards the sun is bright, the bottom and the inside of the heap are grey
          vec3 N = normalize(n + vDir * 0.9);
          float dif = clamp(dot(N, uSun) * 0.55 + 0.45, 0.0, 1.0);
          float lit = clamp(0.16 + 0.3 * hgt + uSunK * dif * (0.45 + 0.55 * hgt) * 0.78 + (nz - 0.5) * 0.14, 0.0, 1.0);
          col = mix(uDark, uLight, lit);
          // the bright rim when the sun is behind the cloud
          col += uLight * pow(max(dot(-B, uSun), 0.0), 10.0) * uSunK * (1.0 - smoothstep(0.0, 0.6, den)) * 0.9;
          // lightning lights the cloud up from inside
          col += vec3(0.82, 0.86, 1.0) * uFlashK * exp(-distance(p, uFlashPos) / 2500.0) * (0.6 + 0.4 * (1.0 - hgt));
          float dc = distance(vCen, cameraPosition);
          a *= smoothstep(s * 0.3, s * 1.1, dc) * (1.0 - smoothstep(uFar * 0.75, uFar, dc));
        } else if (vMode > 2.5) {
          // a curtain of rain (streaks falling fast) or snow (soft, slow): thickest in the middle, fading at the
          // cloud base and near the ground, and never in the way when you fly through it
          float snow = vDir.x;
          float y = vCen.y + (vUv.y - 1.0) * vHgt;
          float fall = mix(9.0, 1.3, snow);
          float st = vn(vec3(q.x * s / mix(25.0, 60.0, snow) + sd * 7.0, (y + uTime * fall) / mix(140.0, 60.0, snow), sd));
          float dens = (1.0 - q.x * q.x) * smoothstep(0.0, 0.12, vUv.y) * (1.0 - smoothstep(0.88, 1.0, vUv.y));
          a = dens * a0 * (0.55 + 0.45 * st);
          col = mix(mix(uDark, uLight, 0.35), mix(uDark, uLight, 0.8), snow);
          vec2 hd = cameraPosition.xz - vCen.xz;
          a *= smoothstep(s * 0.25, s * 0.7, length(hd)) * (1.0 - smoothstep(uFar * 0.75, uFar, length(hd)));
          col += vec3(0.8, 0.85, 1.0) * uFlashK * exp(-distance(vec3(vCen.x, y, vCen.z), uFlashPos) / 4000.0) * 0.6;
        } else {
          vec3 p = vCen + vec3(q.x, 0.0, q.y) * s * 0.5;
          float nz = vMode > 1.5
            ? vn(vec3(p.x / 2500.0, p.y / 400.0, p.z / 9000.0) + sd * 13.0) * 0.6 + vn(vec3(p.x / 700.0, 0.0, p.z / 2600.0) + sd) * 0.4
            : vn(p / 1800.0 + sd * 11.0) * 0.6 + vn(p / 600.0 + sd * 3.0) * 0.4;
          float den = pow(1.0 - r2, 0.6) * 1.2 - (nz - 0.35) * 1.1;
          a = smoothstep(0.0, 0.5, den) * a0;
          float below = step(cameraPosition.y, vCen.y);
          float lit = mix(0.55 + 0.4 * uSunK, 0.18 + 0.25 * hgt, below) + (nz - 0.5) * 0.15;
          col = mix(uDark, uLight, clamp(lit, 0.0, 1.0));
          col += vec3(0.82, 0.86, 1.0) * uFlashK * exp(-distance(p, uFlashPos) / 3000.0) * 0.7;
          float dc = distance(p, cameraPosition);
          a *= smoothstep(30.0, 260.0, abs(cameraPosition.y - vCen.y)) * (1.0 - smoothstep(uFar * 0.75, uFar, dc));
        }
        a *= vFade;
        if (a < uCut) discard;   // frame generation's motion layer asks only for the thicker parts
        gl_FragColor = vec4(col, a);
        #include <fog_fragment>
      }`,
    transparent: true, depthWrite: false, fog: true, side: T.DoubleSide,
  });
  const mesh = new T.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 5; mesh.userData.max = max;
  return mesh;
}

/** Asks for the reports around the 3D view (one request for the whole area, at most every ten minutes). */
function v3dCloudFetch(lon: number, lat: number, km: number) {
  const r = Math.min(4, km / 100 + 0.8), k = Math.max(0.3, Math.cos(lat * D2R));
  const s = Math.floor(lat - r), n = Math.ceil(lat + r), w = Math.floor(lon - r / k), e = Math.ceil(lon + r / k), key = [s, w, n, e].join(',');
  if (key === V3dClouds.fetchKey && Date.now() - V3dClouds.fetchAt < 10 * 60e3) return;
  if (Date.now() - V3dClouds.fetchAt < 15e3) return;
  V3dClouds.fetchKey = key; V3dClouds.fetchAt = Date.now(); V3dClouds.pending = true;
  Net.json(`https://aviationweather.gov/api/data/metar?bbox=${Math.max(-89, s)},${Math.max(-180, w)},${Math.min(89, n)},${Math.min(180, e)}&format=json`).then((ms: any[]) => {
    for (const x of ms || []) { if (!x || !x.icaoId) continue; LiveWx.store(x, ''); }
    V3dClouds.key = '';   // build again with the new reports
    V3dClouds.pending = false;
  }).catch(() => { V3dClouds.pending = false; /* offline: no clouds */ });
}

/** The puffs and sheets within reach of the camera. Every one has a name made from where and what it is, so
 * the same cloud is recognised when the clouds are built again and only real changes fade in or out. */
function v3dCloudBuild(cx: number, cz: number, km: number, detail: number): CloudPuff[] {
  const R = km * 1000, ll0 = v3dLonLat(cx, cz), list = cloudStations(ll0[0], ll0[1], km + 160), out: CloudPuff[] = [];
  V3dClouds.storms = [];
  if (!list.length) return out;
  const per = [5, 8, 12, 18][detail - 1], budget = [2000, 4500, 7500, 11000][detail - 1], flat = cloudFlat();
  // the size of one cloud cell: smaller cells mean more, better-shaped clouds; the area must fit the budget
  let cell = [3200, 2600, 2000, 1600][detail - 1];
  cell = Math.max(cell, Math.sqrt(Math.PI * R * R / (budget / (per * 0.45))));
  cell = Math.round(cell / 100) * 100;
  const cells: number[][] = [];
  const x0 = Math.floor((cx - R) / cell), x1 = Math.ceil((cx + R) / cell), z0 = Math.floor((cz - R) / cell), z1 = Math.ceil((cz + R) / cell);
  for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) {
    const x = i * cell, z = j * cell, d = Math.hypot(x - cx, z - cz); if (d <= R) cells.push([x, z, d, i, j]);
  }
  cells.sort((a, b) => a[2] - b[2]);   // nearest first, so the budget is spent close by
  const add = (p: CloudPuff) => { if (p.m !== 3) { const L = Math.hypot(p.dx, p.dy, p.dz) || 1; p.dx /= L; p.dy /= L; p.dz /= L; } out.push(p); };
  for (const c of cells) {
    if (out.length >= budget) break;
    const ll = v3dLonLat(c[0], c[1]), st = cloudNearest(list, ll[0], ll[1], 150); if (!st) continue;
    const xk = ll[0] * 111.32 * Math.cos(ll[1] * D2R), yk = ll[1] * 110.54, curve = v3dCurve(c[0], c[1]);
    const lod = clamp(1.35 - c[2] / R * 1.1, 0.3, 1);
    const pr = cloudPrecip(st.wx), firstHeap = st.layers.findIndex(q => CLOUD_COV[q.cover] && cloudKind(q) !== 'ci');
    st.layers.forEach((l, li) => {
      const cov = CLOUD_COV[l.cover] || 0; let kind = cloudKind(l); if (!cov) return;
      // a thunderstorm reported without a CB layer: the lowest heap cloud grows into one
      if (pr && pr.ts && li === firstHeap && (kind === 'cu' || kind === 'tcu')) kind = 'cb';
      // rain or snow falls only from the lowest layer (and from storm clouds); reported nearby only: from some of them
      const rains = !!pr && kind !== 'ci' && (li === firstHeap || kind === 'cb') && (!pr.vc || cloudHash(c[3], c[4], 501) < 0.35);
      const n = cloudNoise(xk, yk, kind === 'st' ? 14 : kind === 'ci' ? 22 : kind === 'cb' ? 18 : 6, 11 + li * 17);
      if (n > cov) return;
      const dens = cov >= 1 ? 1 : clamp((cov - n) / Math.max(0.12, cov) * 1.6, 0.25, 1);
      const base = st.elev + l.base * 0.3048 - curve, rnd = (k: number) => cloudHash(c[3], c[4], li * 131 + k);
      const tag = `${c[3]},${c[4]},${li},${kind},${Math.round(l.base / 100)},${Math.round(dens * 4)},${cell}`;
      const sd = rnd(999) * 10;
      if ((kind === 'cb' || kind === 'tcu') && flat) {
        // 2D: a dark, dense layer at the base, the anvil spread high above a thunderstorm, rain or snow under it
        const cxx = c[0] + (rnd(1) - 0.5) * cell * 0.3, czz = c[1] + (rnd(2) - 0.5) * cell * 0.3, top = base + (kind === 'cb' ? 9000 - l.base * 0.3048 * 0.5 : 3500);
        for (let s = 0; s < 2; s++) add({ x: cxx + (rnd(s + 30) - 0.5) * cell * 0.3, y: base + 60 + s * 180, z: czz + (rnd(s + 31) - 0.5) * cell * 0.3, m: 0, s: cell * 1.9, h: s * 0.35, a: 0.95, sd, dx: 0, dy: 1, dz: 0, id: `${tag}|f${s}` });
        if (kind === 'cb') add({ x: cxx, y: top, z: czz, m: 0, s: cell * 3.4, h: 1, a: 0.7, sd, dx: 0, dy: 1, dz: 0, id: `${tag}|anvil` });
        if (rains || kind === 'cb') add({ x: cxx, y: base + 60, z: czz, m: 3, s: cell * 1.1, h: 0, a: 0.55 * (pr ? 0.6 + 0.4 * pr.k : 0.8), sd, dx: pr && pr.kind === 'sn' ? 1 : 0, dy: 0, dz: 0, w: base + 60 - (st.elev - curve), id: `${tag}|shaft` });
        if (kind === 'cb') V3dClouds.storms.push([cxx, base, czz, top, cell, pr && pr.ts ? 1 : 0.25]);
        return;
      }
      if (kind === 'cb' || kind === 'tcu') {
        // a tower of puffs up to about 9 km (thunderstorm) or 3.5 km (towering cumulus); a thunderstorm spreads into an anvil at the top
        const top = base + (kind === 'cb' ? 9000 - l.base * 0.3048 * 0.5 : 3500), lv = clamp(Math.round((top - base) / (cell * 0.45)), 5, 14);
        const np = detail >= 3 ? 4 : 3, cxx = c[0] + (rnd(1) - 0.5) * cell * 0.3, czz = c[1] + (rnd(2) - 0.5) * cell * 0.3;
        for (let s = 0; s < lv; s++) {
          const f = s / (lv - 1), anvil = kind === 'cb' && f > 0.82, spread = anvil ? cell * 1.5 : cell * (0.28 + 0.12 * f);
          for (let k = 0; k < (anvil ? np + 3 : np); k++) {
            const ang = rnd(s * 17 + k * 3 + 5) * Math.PI * 2, rr = Math.sqrt(rnd(s * 17 + k * 3 + 6)) * spread;
            const dx = Math.cos(ang) * rr, dz = Math.sin(ang) * rr;
            add({ x: cxx + dx, y: base + f * (top - base), z: czz + dz, m: 1, s: cell * (anvil ? 0.9 : 0.95 + 0.25 * f), h: kind === 'cb' ? 0.05 + f * 0.95 : 0.25 + f * 0.75, a: 0.9, sd,
              dx, dy: (f - 0.4) * cell, dz, id: `${tag}|${s}|${k}` });
          }
        }
        if (kind === 'cb') add({ x: cxx, y: top + 150, z: czz, m: 0, s: cell * 4, h: 1, a: 0.75, sd, dx: 0, dy: 1, dz: 0, id: `${tag}|anvil` });
        if (rains || kind === 'cb') add({ x: cxx, y: base + 60, z: czz, m: 3, s: cell * 1.1, h: 0, a: 0.55 * (pr ? 0.6 + 0.4 * pr.k : 0.8), sd, dx: pr && pr.kind === 'sn' ? 1 : 0, dy: 0, dz: 0, w: base + 60 - (st.elev - curve), id: `${tag}|shaft` });
        if (kind === 'cb') V3dClouds.storms.push([cxx, base, czz, top, cell, pr && pr.ts ? 1 : 0.25]);
        return;
      }
      if (kind === 'ci') {   // thin, see-through high cloud in streaks
        add({ x: c[0] + (rnd(1) - 0.5) * cell, y: base + rnd(2) * 300, z: c[1] + (rnd(3) - 0.5) * cell, m: 2, s: cell * 2.2, h: 1, a: 0.32 * dens, sd, dx: 0, dy: 1, dz: 0, id: `${tag}|ci` });
        return;
      }
      if (kind === 'st') {   // a layer: stacked flat sheets, grey underneath, with a lumpy top on the detailed settings
        const th = l.cover === 'OVC' ? 420 : 300;
        for (let s = 0; s < 3; s++) add({ x: c[0] + (rnd(s) - 0.5) * cell * 0.5, y: base + 40 + s * th / 2, z: c[1] + (rnd(s + 9) - 0.5) * cell * 0.5, m: 0, s: cell * 1.75, h: s / 2, a: 0.8, sd, dx: 0, dy: 1, dz: 0, id: `${tag}|st${s}` });
        if (rains && rnd(77) < 0.45) add({ x: c[0] + (rnd(78) - 0.5) * cell * 0.4, y: base + 40, z: c[1] + (rnd(79) - 0.5) * cell * 0.4, m: 3, s: cell * 1.5, h: 0, a: 0.3 + 0.3 * pr.k, sd, dx: pr.kind === 'sn' ? 1 : 0, dy: 0, dz: 0, w: base + 40 - (st.elev - curve), id: `${tag}|shaft` });
        if (!flat && detail >= 3 && lod > 0.6) for (let s = 0; s < 2; s++)
          add({ x: c[0] + (rnd(s + 40) - 0.5) * cell * 0.8, y: base + th, z: c[1] + (rnd(s + 50) - 0.5) * cell * 0.8, m: 1, s: cell * 0.7, h: 0.9, a: 0.7, sd, dx: 0, dy: 1, dz: 0, id: `${tag}|top${s}` });
        return;
      }
      if (flat) {   // 2D: a heap is a soft patch of cloud at its base, fuller and greyer underneath where it is denser
        const W = cell * (0.75 + 0.6 * dens), ccx = c[0] + (rnd(1) - 0.5) * cell * 0.35, ccz = c[1] + (rnd(2) - 0.5) * cell * 0.35;
        // a few overlapping, offset sheets, each fainter: their edges break up into an irregular, soft-edged patch
        const nf = 3 + (dens > 0.6 ? 1 : 0) + (detail >= 3 ? 1 : 0);
        for (let f = 0; f < nf; f++) {
          const ang = rnd(f * 7 + 60) * Math.PI * 2, rr = (f ? 0.18 + 0.2 * rnd(f * 7 + 61) : 0) * W;
          add({ x: ccx + Math.cos(ang) * rr, y: base + 30 + f * 45, z: ccz + Math.sin(ang) * rr, m: 0, s: W * (0.62 + 0.3 * rnd(f * 7 + 62)), h: 0.1 + f * 0.15, a: 0.3 + 0.28 * dens, sd: sd + f * 1.7, dx: 0, dy: 1, dz: 0, id: `${tag}|f${f}` });
        }
        if (rains && dens > 0.45) add({ x: ccx, y: base + 50, z: ccz, m: 3, s: W * 0.6, h: 0, a: 0.25 + 0.35 * pr.k, sd, dx: pr.kind === 'sn' ? 1 : 0, dy: 0, dz: 0, w: base + 50 - (st.elev - curve), id: `${tag}|shaft` });
        return;
      }
      // a heap (cumulus): round puffs in a dome with a flat base, bigger and taller where the cell is denser
      const W = cell * (0.5 + 0.45 * dens), Hh = Math.min(2500, 250 + dens * 1000);
      const ccx = c[0] + (rnd(1) - 0.5) * cell * 0.35, ccz = c[1] + (rnd(2) - 0.5) * cell * 0.35, mid = base + Hh * 0.35;
      const k = Math.max(3, Math.round(per * (0.55 + 0.45 * dens) * lod));
      for (let s = 0; s < k; s++) {
        const ang = rnd(s * 5 + 100) * Math.PI * 2, rr = s === 0 ? 0 : Math.sqrt(rnd(s * 5 + 101));
        const f = s === 0 ? 0.3 : Math.pow(rnd(s * 5 + 102), 1.3) * Math.sqrt(Math.max(0, 1 - rr * rr * 0.85));
        const rad = W * 0.28 * (1.15 - 0.45 * f) * (0.75 + 0.5 * rnd(s * 5 + 103));
        const x = ccx + Math.cos(ang) * rr * W * 0.5, z = ccz + Math.sin(ang) * rr * W * 0.5, y = base + rad * 0.45 + f * Hh;
        add({ x, y, z, m: 1, s: rad * 2, h: clamp((y - base) / (Hh + rad * 0.5), 0, 1), a: 0.88, sd, dx: x - ccx, dy: (y - mid) * 1.4, dz: z - ccz, id: `${tag}|${s}` });
      }
      if (rains && dens > 0.45) add({ x: ccx, y: base + 50, z: ccz, m: 3, s: W * 0.8, h: 0, a: 0.25 + 0.35 * pr.k, sd, dx: pr.kind === 'sn' ? 1 : 0, dy: 0, dz: 0, w: base + 50 - (st.elev - curve), id: `${tag}|shaft` });
    });
  }
  return out;
}

/** Puts the new set of clouds in place of the old one: clouds that stay keep going, new ones form, gone ones dissolve. */
function v3dCloudMerge(fresh: CloudPuff[]) {
  const t = cloudClock(), old = new Map<string, CloudPuff>(), first = !V3dClouds.built;
  for (const p of V3dClouds.list as CloudPuff[]) old.set(p.id, p);
  const out: CloudPuff[] = [];
  for (const p of fresh) {
    const o = old.get(p.id);
    if (o && o.dies == null) { out.push(o); old.delete(p.id); continue; }
    p.born = first ? -1e4 : t; out.push(p);
  }
  old.forEach(o => { if (o.dies == null) o.dies = t; if (t - o.dies < CLOUD_FADE_S) out.push(o); });
  V3dClouds.list = out; V3dClouds.built = true;
}

/** Each frame: rebuild the clouds when the camera has moved far, the reports changed or the settings changed; keep them sorted far to near. */
function v3dCloudsStep(now: number) {
  const km = cloudKm();
  if (!km || !V3d.origin || !V3d.cam) { if (V3dClouds.mesh) V3dClouds.mesh.visible = false; return; }
  const cam = V3d.cam.position, detail = cloudDetail();
  const ll = v3dLonLat(cam.x, cam.z);
  v3dCloudFetch(ll[0], ll[1], km);
  // the view's centre moved (flying on): the clouds stay where they are in the world, only their place in the scene
  // is worked out again, so nothing disappears or pops in; later changes fade in and out as usual
  const oKey = V3d.origin.join(',');
  if (V3dClouds.oKey && V3dClouds.oKey !== oKey && V3dClouds.list.length) v3dCloudReplace();
  V3dClouds.oKey = oKey;
  const key = km + '|' + detail + '|' + (cloudFlat() ? '2d' : '3d');
  if (!V3dClouds.mesh || V3dClouds.mesh.parent !== V3d.scene) { V3dClouds.mesh = v3dCloudMesh(12000); V3d.scene.add(V3dClouds.mesh); V3dClouds.key = ''; V3dClouds.list = []; V3dClouds.built = false; }
  const M: any = V3dClouds.mesh, t = cloudClock();
  M.visible = V3d.mode !== 'cabin'; M.material.uniforms.uTime.value = t;
  if (key !== V3dClouds.key || Math.hypot(cam.x - V3dClouds.cx, cam.z - V3dClouds.cz) > Math.max(3000, km * 120) || now - V3dClouds.at > 5 * 60e3) {
    // a different place or different settings: start over without fading; otherwise the changes fade
    const restart = !!V3dClouds.key && V3dClouds.key !== key;
    if (restart) { V3dClouds.list = []; V3dClouds.built = false; }
    V3dClouds.key = key; V3dClouds.at = now; V3dClouds.cx = cam.x; V3dClouds.cz = cam.z; V3dClouds.cll = v3dLonLat(cam.x, cam.z);
    v3dCloudMerge(v3dCloudBuild(cam.x, cam.z, km, detail).map(p => { const P: any = p, q = v3dLonLat(p.x, p.z); P.lon = q[0]; P.lat = q[1]; P.cv = v3dCurve(p.x, p.z); return p; }));
    V3dClouds.sx = 1e9;   // sort and upload now
    M.material.uniforms.uFar.value = km * 1000; M.material.uniforms.uDetail.value = detail >= 2 ? 1 : 0;
  }
  // far to near, so the see-through puffs blend properly
  if ((now - V3dClouds.sortAt > 400 && Math.hypot(cam.x - V3dClouds.sx, cam.y - (V3dClouds.sy || 0), cam.z - V3dClouds.sz) > 120) || now - V3dClouds.sortAt > 5000) {
    V3dClouds.sortAt = now; V3dClouds.sx = cam.x; V3dClouds.sy = cam.y; V3dClouds.sz = cam.z;
    let L: CloudPuff[] = V3dClouds.list;
    L = V3dClouds.list = L.filter(p => p.dies == null || t - p.dies < CLOUD_FADE_S);
    const d = (p: CloudPuff) => (p.x - cam.x) * (p.x - cam.x) + (p.y - cam.y) * (p.y - cam.y) + (p.z - cam.z) * (p.z - cam.z);
    for (const p of L) (p as any)._d = d(p);
    L.sort((a: any, b: any) => b._d - a._d);
    const g = M.geometry, o = g.attributes.iOff.array as Float32Array, a = g.attributes.iData.array as Float32Array,
      r = g.attributes.iDir.array as Float32Array, f = g.attributes.iFade.array as Float32Array, n = Math.min(L.length, M.userData.max);
    for (let i = 0; i < n; i++) {
      const p = L[i];
      o[i * 4] = p.x; o[i * 4 + 1] = p.y; o[i * 4 + 2] = p.z; o[i * 4 + 3] = p.m;
      a[i * 4] = p.s; a[i * 4 + 1] = p.h; a[i * 4 + 2] = p.a; a[i * 4 + 3] = p.sd;
      r[i * 4] = p.dx; r[i * 4 + 1] = p.dy; r[i * 4 + 2] = p.dz; r[i * 4 + 3] = p.w || 0;
      f[i * 2] = p.born == null ? -1e4 : p.born; f[i * 2 + 1] = p.dies == null ? 1e9 : p.dies;
    }
    g.instanceCount = n;
    for (const k of ['iOff', 'iData', 'iDir', 'iFade']) g.attributes[k].needsUpdate = true;
  }
}
/** After the view's centre moved: every cloud to where its place in the world now is in the scene (the earth's curve too). */
function v3dCloudReplace() {
  for (const p of V3dClouds.list as any[]) {
    if (p.lon == null) continue;
    const q = v3dXY(p.lon, p.lat), cv = v3dCurve(q[0], q[1]);
    p.y += (p.cv || 0) - cv; p.x = q[0]; p.z = q[1]; p.cv = cv;
  }
  if (V3dClouds.cll) { const q = v3dXY(V3dClouds.cll[0], V3dClouds.cll[1]); V3dClouds.cx = q[0]; V3dClouds.cz = q[1]; }
  V3dClouds.sx = 1e9;   // sorted and sent to the graphics card again
}
function v3dCloudsClear() { V3dClouds.oKey = ''; V3dClouds.mesh = null; V3dClouds.key = ''; V3dClouds.list = []; V3dClouds.built = false; }

/* ---------- the map: see-through layers ---------- */

const Clouds2d: any = { cv: null, key: '', at: 0, blob: null };
function clouds2dBlob(): HTMLCanvasElement {
  if (Clouds2d.blob) return Clouds2d.blob;
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return (Clouds2d.blob = cv);
}
/** Draws the cloud layers of every report in view: low and middle cloud as one soft white layer, high cloud fainter, thunderstorm cores grey. */
function clouds2dDraw(c: CanvasRenderingContext2D, m: any, degPx: number) {
  const W = m.w, H = m.h; if (!W || !H) return;
  const ctr = m.ll(W / 2, H / 2); if (!ctr) return;
  const pxKm = degPx / 111.32;
  const a = m.px(ctr[0], ctr[1]), b = m.px(ctr[0], ctr[1] + 1), pxPerKm = a && b ? Math.abs(b[1] - a[1]) / 110.54 : pxKm;
  const sc = 0.25, w = Math.ceil(W * sc), h = Math.ceil(H * sc);
  const key = [Math.round(a ? a[0] : 0), Math.round(a ? a[1] : 0), Math.round(pxPerKm * 1000), W, H, Object.keys(LiveWx.cache).length].join(',');
  if (key !== Clouds2d.key && Date.now() - Clouds2d.at > 90) {
    Clouds2d.key = key; Clouds2d.at = Date.now();
    if (!Clouds2d.cv) Clouds2d.cv = [document.createElement('canvas'), document.createElement('canvas'), document.createElement('canvas')];
    const [lo, hi, cb] = Clouds2d.cv as HTMLCanvasElement[];
    for (const cv of Clouds2d.cv as HTMLCanvasElement[]) { cv.width = w; cv.height = h; }
    const gl = lo.getContext('2d'), gh = hi.getContext('2d'), gc = cb.getContext('2d'), blob = clouds2dBlob();
    const c0 = m.ll(W / 2, H / 2), list = c0 ? cloudStations(c0[0], c0[1], Math.hypot(W, H) / 2 / pxPerKm + 160) : [];
    // one cell every few pixels: its weather is the nearest report's, with the cloud cover shaped by noise
    const step = 4, cellKm = step / sc / pxPerKm;
    if (list.length) for (let y = 0; y < h + step; y += step) for (let x = 0; x < w + step; x += step) {
      const ll = m.ll(x / sc, y / sc); if (!ll) continue;
      const st = cloudNearest(list, ll[0], ll[1], 150); if (!st) continue;
      const xk = ll[0] * 111.32 * Math.cos(ll[1] * D2R), yk = ll[1] * 110.54;
      st.layers.forEach((l, li) => {
        const cov = CLOUD_COV[l.cover] || 0, kind = cloudKind(l); if (!cov) return;
        const n = cloudNoise(xk, yk, Math.max(kind === 'st' ? 14 : kind === 'ci' ? 22 : 6, cellKm * 3), 11 + li * 17);
        if (n > cov) return;
        const d = cov >= 1 ? 1 : clamp((cov - n) / Math.max(0.12, cov) * 1.6, 0.3, 1), sz = step * (2.2 + 1.2 * d);
        (kind === 'ci' ? gh : gl).drawImage(blob, x - sz / 2, y - sz / 2, sz, sz);
        if (kind === 'cb' || kind === 'tcu') { gc.globalAlpha = kind === 'cb' ? 1 : 0.4; gc.drawImage(blob, x - sz / 2, y - sz / 2, sz, sz); }
      });
    }
    // soften the cells into one layer
    if (Clouds2d.filterOk !== false) for (const cv of [lo, hi, cb]) {
      const t = document.createElement('canvas'); t.width = w; t.height = h; const tg = t.getContext('2d');
      tg.filter = 'blur(2px)'; if (tg.filter !== 'blur(2px)') { Clouds2d.filterOk = false; break; }
      tg.drawImage(cv, 0, 0); const g2 = cv.getContext('2d'); g2.clearRect(0, 0, w, h); g2.drawImage(t, 0, 0);
    }
  }
  if (!Clouds2d.cv) return;
  const [lo, hi, cb] = Clouds2d.cv as HTMLCanvasElement[];
  c.save(); c.imageSmoothingEnabled = true;
  c.globalAlpha = 0.16; c.drawImage(hi, 0, 0, W, H);
  c.globalAlpha = 0.3; c.drawImage(lo, 0, 0, W, H);
  c.globalAlpha = 0.22; c.drawImage(cb, 0, 0, W, H);
  c.restore();
}
