// The ground in the 3D view, in rings of detail: the finest heights around the aircraft (about 30 m
// apart), coarser further out, as far as the view distance chosen in Settings → Graphics. The earth's
// curvature is included, so distant mountains sink below the horizon as they do in reality.
//
// Coastlines, fjords, lakes and rivers come from the OpenStreetMap water outlines (OpenMapTiles via
// OpenFreeMap, the same data as the world map), drawn exactly, not guessed from the heights. The ground is
// painted like the world map (dark blue land shaded by its slopes, cyan coastlines) or, with Satellite on,
// with Sentinel-2 cloudless 2016 imagery by EOX (CC BY 4.0).
//
// Heights: Terrain Tiles on AWS (Mapzen / Tilezen terrarium tiles), credited in Settings → About.

/** The view distance chosen in Settings → Graphics (km), 20 to 800. */
function v3dKm(): number { return clamp(+(State.settings as any).v3dKm || 150, 20, 800); }
const EARTH_R = 6371000;
const SAT_URL = 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/';
/** Satellite detail, 0 (standard) to 3 (highest); Settings → Graphics. */
/** The biggest single picture this device's graphics can safely hold. Phones and tablets share their memory
 *  between the app and the graphics, and Android closes an app that asks for too much without a word, so
 *  they get 4096 pixels (2048 with little memory); a PC can take 8192. */
function v3dTexCap(): number {
  const gl = (V3d.r && V3d.r.capabilities && V3d.r.capabilities.maxTextureSize) || 4096, mem = (navigator as any).deviceMemory || 4;
  const cap = DESKTOP ? (mem >= 8 ? 8192 : 4096) : mem <= 3 ? 2048 : 4096;
  return Math.min(gl, cap);
}
/** Terrain detail (Settings → Graphics): 0 low … 3 very high on phones and tablets, 4 ultra on the PC.
 *  It sets how many points the ground's mesh has in every ring (Medium is the standard), and at Ultra adds a
 *  finer ring of heights around you (about 19 m apart). */
const TERRAIN_Q_NAMES = ['Low', 'Medium', 'High', 'Very high', 'Ultra'];
const TERRAIN_DENSITY = [0.6, 1, 1.5, 2, 3];
function v3dTerrainQ(): number { const v = (State.settings as any).v3dTerrainQ; return v == null ? 1 : clamp(Math.round(+v), 0, DESKTOP ? 4 : 3); }
/** Smooth mountain ridges: the heights between the mesh's points are averaged instead of picked one by one, so
 *  ridges and coastlines don't turn into spikes and saw teeth. */
function v3dTerrainSmooth(): boolean { return (State.settings as any).v3dTerrainSmooth !== false; }
/** A softened copy of the heights for a mesh whose points are `step` pixels apart (two box passes each way). */
function v3dSoften(H: Float32Array, size: number, step: number): Float32Array {
  const rad = Math.floor(step / 2); if (rad < 1) return H;
  let a = Float32Array.from(H), b = new Float32Array(H.length);
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < size; y++) { const o = y * size; let sum = 0, n = 0;
      for (let x = -rad; x <= rad; x++) if (x >= 0 && x < size) { sum += a[o + x]; n++; }
      for (let x = 0; x < size; x++) { b[o + x] = sum / n; const xo = x - rad, xi = x + rad + 1; if (xo >= 0) { sum -= a[o + xo]; n--; } if (xi < size) { sum += a[o + xi]; n++; } } }
    for (let x = 0; x < size; x++) { let sum = 0, n = 0;
      for (let y = -rad; y <= rad; y++) if (y >= 0 && y < size) { sum += b[y * size + x]; n++; }
      for (let y = 0; y < size; y++) { a[y * size + x] = sum / n; const yo = y - rad, yi = y + rad + 1; if (yo >= 0) { sum -= b[yo * size + x]; n--; } if (yi < size) { sum += b[yi * size + x]; n++; } } }
  }
  // the sea and the shore stay as they were (soften only land that is clearly above the sea)
  return a;
}
/** How far each pixel is from the coast (pixels; + on land, − at sea), from the sea mask: two passes of a chamfer
 *  distance. The ground's height near the coast follows it, so the coastline (where the ground meets the sea's
 *  level surface) runs where the map has it, smoothly between the ground's points instead of along their grid. */
function v3dCoastDist(size: number, sea: (i: number) => boolean): Float32Array {
  const n = size * size, INF = 1e6, dl = new Float32Array(n), ds = new Float32Array(n), D = 1, Dg = 1.4142;
  for (let i = 0; i < n; i++) { const s = sea(i); dl[i] = s ? 0 : INF; ds[i] = s ? INF : 0; }
  for (const d of [dl, ds]) {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const i = y * size + x; let v = d[i];
      if (x > 0) v = Math.min(v, d[i - 1] + D); if (y > 0) { v = Math.min(v, d[i - size] + D); if (x > 0) v = Math.min(v, d[i - size - 1] + Dg); if (x < size - 1) v = Math.min(v, d[i - size + 1] + Dg); } d[i] = v; }
    for (let y = size - 1; y >= 0; y--) for (let x = size - 1; x >= 0; x--) { const i = y * size + x; let v = d[i];
      if (x < size - 1) v = Math.min(v, d[i + 1] + D); if (y < size - 1) { v = Math.min(v, d[i + size] + D); if (x < size - 1) v = Math.min(v, d[i + size + 1] + Dg); if (x > 0) v = Math.min(v, d[i + size - 1] + Dg); } d[i] = v; }
  }
  const out = new Float32Array(n); for (let i = 0; i < n; i++) out[i] = dl[i] > 0 ? dl[i] - 0.5 : -(ds[i] - 0.5);
  return out;
}
/** The sea's level surface under the whole view (curving with the earth), with the living water on it. */
function v3dSeaPlane(x0: number, z0: number, x1: number, z1: number) {
  const T = THREE, n = 96, geo = new T.PlaneGeometry(1, 1, n, n); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, flat = new Float32Array(pos.count).fill(1);
  for (let k = 0; k < pos.count; k++) { const x = x0 + (pos.getX(k) + 0.5) * (x1 - x0), z = z0 + (pos.getZ(k) + 0.5) * (z1 - z0); pos.setXYZ(k, x, -v3dCurve(x, z), z); }
  pos.needsUpdate = true; geo.setAttribute('aFlat', new T.BufferAttribute(flat, 1)); geo.computeBoundingSphere();
  const one = (r: number, g: number, b: number) => { const c = document.createElement('canvas'); c.width = c.height = 2; const x = c.getContext('2d') as CanvasRenderingContext2D; x.fillStyle = `rgb(${r},${g},${b})`; x.fillRect(0, 0, 2, 2); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t; };
  const VT: any = V3dTerrain;
  if (VT.seaPlane) { V3d.scene.remove(VT.seaPlane); VT.seaPlane.geometry.dispose(); }
  const m = new T.Mesh(geo, v3dGroundMat(one(4, 11, 22), one(255, 255, 255))); m.renderOrder = -30; m.frustumCulled = false;
  VT.seaPlane = m; V3d.scene.add(m); if (VT.old) m.visible = false;   // shown with the rest of the new ground
}
function v3dSatQ(): number { const v = (State.settings as any).v3dSatQ; return v == null ? 1 : clamp(Math.round(+v), 0, 3); }

interface V3dRing { z: number; x0: number; y0: number; N: number; size: number; H: Float32Array; mask: Uint8ClampedArray; mesh: any; mapTex: any; satTex: any; inner: V3dRing; ok: boolean }

/** The rings of ground for the view distance: finest first, coarser ones added until they reach it.
 *  Fog starts at a quarter of the distance and closes at the distance; the camera sees a little further. */
function v3dRange(lat?: number): { rings: number[]; fog: number[]; far: number } {
  const km = v3dKm(), k = Math.cos(((lat == null ? 50 : lat)) * D2R), rings: number[] = [];
  for (const z of (v3dTerrainQ() >= 4 ? [13, 12, 10, 8, 7, 6, 5] : [12, 10, 8, 7, 6, 5])) { rings.push(z); if (2.5 * 40075 / (1 << z) * k >= km) break; }
  return { rings, fog: [km * 250, km * 1000], far: km * 1300 };
}
/** How far below the flat plane the ground lies at a distance (m), from the earth's curvature. */
function v3dCurve(x: number, z: number): number { return (x * x + z * z) / (2 * EARTH_R); }

/** Free a ground mesh: its shape, its material and every picture the material uses. */
function v3dFreeMesh(m: any) {
  try {
    m.geometry.dispose(); const mt: any = m.material; if (!mt) return;
    for (const k in mt) if (mt[k] && mt[k].isTexture) mt[k].dispose();
    if (mt.uniforms) for (const k in mt.uniforms) { const v = mt.uniforms[k] && mt.uniforms[k].value; if (v && v.isTexture) v.dispose(); }
    mt.dispose();
  } catch (e) { /* gone */ }
}
const V3dTerrain = {
  rings: [] as V3dRing[], done: false, gen: 0, origin: null as number[], prog: { got: 0, want: 1, sat: 0 } as any, _satBusy: false, _satQ: [] as V3dRing[],

  /** Load the rings around a point (the view's origin), finest first, so the near ground shows quickly. */
  load(centre: number[]) {
    const gen = ++this.gen;
    // moving the view's centre (flying on, or arriving at an airport): the ground already there stays on screen,
    // moved to the new centre, while the new ground loads unseen; the new comes in all at once when it is complete
    // (with its satellite pictures), so nothing disappears and pops back
    if (this.rings.length && this.origin) this.retire(); else this.clear();
    this.origin = centre.slice();
    const zs = v3dRange(centre[1]).rings;
    this.prog = { got: 0, want: 27 + (V3d.icao ? 1 : 0), sat: 0 }; this._satQ = []; this._satBusy = false;
    let prev: V3dRing = null; this.done = false;
    const next = (i: number) => {
      if (gen !== this.gen || !V3d.open) return;
      if (i >= zs.length) { this.done = true; if (this.old) this.swapIn(gen); return; }   // every ring within the view distance is in
      this.loadRing(zs[i], centre, prev, gen).then(r => { if (r) { this.rings.push(r); prev = r; if (this.old && r.mesh) r.mesh.visible = false; if (this.rings.length === 1 && (V3d as any).lastL && V3d.icao && (V3d as any).lastL.icao === V3d.icao) { try { v3dBuildAirport((V3d as any).lastL); } catch (e) { /* ignore */ } } } setTimeout(() => next(i + 1), V3d.loaded ? 30 : 90); });
    };
    next(0);
  },
  /** The ground on screen, kept until the new ground is ready: moved and tilted to sit right around the new centre. */
  old: null as any[],
  retire() {
    const VT: any = this, pending = !!this.old;
    // still waiting for a swap: the ground that never showed is let go, the ground on screen stays and moves again
    const keep: any[] = (this.old || []).slice();
    const place = (m: any, o: number[]) => { const q = v3dXY(o[0], o[1]), dx = q[0], dz = q[1]; m.position.set(dx, -(dx * dx + dz * dz) / (2 * EARTH_R), dz); m.rotation.set(dz / EARTH_R, 0, -dx / EARTH_R); m.updateMatrixWorld(true); };
    if (pending) { for (const r of this.rings) if (r.mesh) { V3d.scene.remove(r.mesh); v3dFreeMesh(r.mesh); } if (VT.seaPlane) { V3d.scene.remove(VT.seaPlane); v3dFreeMesh(VT.seaPlane); } }
    else {
      for (const r of this.rings) if (r.mesh) { r.mesh.userData.o0 = this.origin.slice(); keep.push(r.mesh); }
      if (VT.seaPlane) { VT.seaPlane.userData.o0 = this.origin.slice(); keep.push(VT.seaPlane); }
    }
    for (const m of keep) place(m, m.userData.o0);
    VT.seaPlane = null; VT.seaSpan = 0; this.rings = []; this.old = keep;
  },
  /** The new ground is complete: shown, and the old taken away, in the same frame (waiting for the satellite
   *  pictures when they are on, at most 20 seconds). */
  swapIn(gen: number) {
    const t0 = performance.now(), sat = !!(State.settings as any).v3dSat;
    const tick = () => {
      if (gen !== this.gen || !V3d.open) return;
      if (sat && performance.now() - t0 < 20000 && this.rings.some(r => r.mesh && !r.satTex)) { setTimeout(tick, 250); return; }
      for (const r of this.rings) if (r.mesh) r.mesh.visible = true;
      const VT: any = this; if (VT.seaPlane) VT.seaPlane.visible = true;
      this.dropOld();
    };
    tick();
  },
  dropOld() { for (const m of this.old || []) { V3d.scene.remove(m); v3dFreeMesh(m); } this.old = null; },
  clear() {
    this.dropOld();
    { const VT: any = V3dTerrain; if (VT.seaPlane) { V3d.scene.remove(VT.seaPlane); VT.seaPlane.geometry.dispose(); VT.seaPlane = null; VT.seaSpan = 0; } }
    for (const r of this.rings) { if (r.mesh) { V3d.scene.remove(r.mesh); r.mesh.geometry.dispose(); } if (r.mapTex) r.mapTex.dispose(); if (r.satTex) r.satTex.dispose(); const R: any = r; if (R.wetTex) R.wetTex.dispose(); if (R.cityTex) R.cityTex.dispose(); if (r.mesh && r.mesh.material) r.mesh.material.dispose(); }
    this.rings = [];
  },

  loadRing(z: number, centre: number[], inner: V3dRing, gen: number): Promise<V3dRing> {
    const n = 1 << z, N = 5, size = 256 * N;
    const fx = (centre[0] + 180) / 360 * n, fy = (1 - Math.log(Math.tan(centre[1] * D2R) + 1 / Math.cos(centre[1] * D2R)) / Math.PI) / 2 * n;
    const x0 = Math.floor(fx) - 2, y0 = Math.floor(fy) - 2;
    const ring: V3dRing = { z, x0, y0, N, size, H: null, mask: null, mesh: null, mapTex: null, satTex: null, inner, ok: false };
    const heights = this.tiles(TERRAIN_URL, z, x0, y0, N, 'png').then(cv => {
      if (!cv) return null;
      const d = cv.getContext('2d').getImageData(0, 0, size, size).data, H = new Float32Array(size * size);
      for (let i = 0; i < size * size; i++) H[i] = d[i * 4] * 256 + d[i * 4 + 1] + d[i * 4 + 2] / 256 - 32768;
      v3dDespike(H, size);
      return H;
    }).catch(() => null);
    const water = this.waterMask(z, x0, y0, N).catch(() => null);
    return Promise.all([heights, water]).then(([H, mask]) => {
      if (gen !== this.gen || !V3d.open) return null;
      if (!H) { H = new Float32Array(size * size); if (!inner) H.fill(V3d.elev || 0); }
      ring.H = H; ring.mask = mask; ring.ok = true;
      // the heavy work in its own turn, after a frame has been drawn, so the screen never freezes for long
      return new Promise<void>(res => requestAnimationFrame(() => setTimeout(res, 0)));
    }).then(() => {
      if (!ring.ok || gen !== this.gen || !V3d.open) return null;
      this.build(ring);
      if (z === 12) this.prog.got++;
      if ((State.settings as any).v3dSat) this.loadSat(ring);
      return ring;
    });
  },

  /** N × N tiles of a tile service into one canvas (null when none could be loaded). */
  tiles(base: string, z: number, x0: number, y0: number, N: number, ext: string, fill?: string): Promise<HTMLCanvasElement> {
    const n = 1 << z, cv = document.createElement('canvas'); cv.width = cv.height = 256 * N;
    const c = cv.getContext('2d');
    if (ext === 'png') { c.fillStyle = 'rgb(128,0,0)'; c.fillRect(0, 0, cv.width, cv.height); }   // terrarium 0 m
    else if (fill) { c.fillStyle = fill; c.fillRect(0, 0, cv.width, cv.height); }   // never black where a picture is missing
    const url = (zz: number, x: number, y: number) => base.indexOf('{z}') >= 0 ? base.replace('{z}', String(zz)).replace('{x}', String(x)).replace('{y}', String(y)) : ext === 'png' ? `${base}${zz}/${x}/${y}.png` : `${base}${zz}/${y}/${x}.jpg`;
    let left = N * N, got = 0;
    return new Promise(ok => {
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const x = (x0 + i + n) % n, y = y0 + j;
        const done = () => { if (z === 12 && ext === 'png') this.prog.got++; if (--left === 0) ok(got ? cv : null); };
        // a picture that won't come (the imagery server busy, or a gap in it): tried again a few times, then
        // the same place from the less detailed imagery above it, enlarged, so there is never a black square
        let tries = 0, up = 0;
        const im = new Image(); im.crossOrigin = 'anonymous';
        im.onload = () => {
          try {
            if (!up) c.drawImage(im, i * 256, j * 256);
            else { const k = 1 << up, sx = (x % k) * 256 / k, sy = (y % k) * 256 / k; c.drawImage(im, sx, sy, 256 / k, 256 / k, i * 256, j * 256, 256, 256); }
            got++;
          } catch (e) { /* out of memory: skip this tile */ }
          done();
        };
        im.onerror = () => {
          if (ext === 'png') { done(); return; }
          if (tries < 3) { tries++; setTimeout(() => { im.src = url(z - up, x >> up, y >> up) + (tries ? (url(z, x, y).indexOf('?') < 0 ? '?r=' : '&r=') + tries : ''); }, 900 * tries + Math.random() * 1500); return; }
          if (up < 4 && z - up > 2) { up++; tries = 0; im.src = url(z - up, x >> up, y >> up); return; }
          done();
        };
        im.src = url(z, x, y);
      }
    });
  },

  /** Where the water is: the OpenStreetMap sea, lakes (red) and rivers (green), drawn by the map engine
   *  off screen at exactly the ring's tiles, then read back. Null when the map engine or the data isn't there. */
  waterMask(z: number, x0: number, y0: number, N: number): Promise<Uint8ClampedArray> {
    const ML = (window as any).maplibregl; if (!ML) return Promise.resolve(null);
    const size = 256 * N, n = 1 << z;
    const cx = x0 + N / 2, cy = y0 + N / 2;
    const lon = cx / n * 360 - 180, k = Math.PI - 2 * Math.PI * cy / n, lat = Math.atan(0.5 * (Math.exp(k) - Math.exp(-k))) / D2R;
    const div = document.createElement('div');
    div.style.cssText = `position:fixed;left:-${size + 50}px;top:0;width:${size}px;height:${size}px;pointer-events:none;opacity:0`;
    document.body.appendChild(div);
    return new Promise<Uint8ClampedArray>(ok => {
      let map: any = null, done = false;
      const finish = (data: Uint8ClampedArray) => { if (done) return; done = true; if (z === 12) this.prog.got++; try { map && map.remove(); } catch (e) { /* gone */ } div.remove(); ok(data); };
      try {
        map = new ML.Map({
          container: div, interactive: false, attributionControl: false, fadeDuration: 0, pixelRatio: 1, preserveDrawingBuffer: true, renderWorldCopies: true,
          center: [lon, lat], zoom: z - 1,   // 512-pixel map tiles: one zoom level down gives 256 pixels per terrain tile
          style: { version: 8, sources: { omt: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' } }, layers: [
            { id: 'bg', type: 'background', paint: { 'background-color': '#000000' } },
            { id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water', paint: { 'fill-color': '#ff0000', 'fill-antialias': false } },
            { id: 'river', type: 'line', source: 'omt', 'source-layer': 'waterway', paint: { 'line-color': '#00ff00', 'line-width': z >= 11 ? 2 : 1 } },
          ] },
        });
        map.on('error', () => { /* tiles missing: whatever loaded is used */ });
        map.once('idle', () => {
          try {
            const cv = document.createElement('canvas'); cv.width = cv.height = size;
            const c = cv.getContext('2d'); c.drawImage(map.getCanvas(), 0, 0, size, size);
            finish(c.getImageData(0, 0, size, size).data);
          } catch (e) { finish(null); }
        });
        setTimeout(() => finish(null), 15000);
      } catch (e) { finish(null); }
    });
  },

  /** The mesh and the map-look paint of a ring. */
  build(r: V3dRing) {
    const T = THREE, size = r.size, n = 1 << r.z, H = r.H, M = r.mask;
    // water from the map outlines, checked against the ground: the sea is at (or near) sea level; a lake is
    // level ground higher up; "water" on clearly sloping land is a mismatch between the two sources, and is
    // drawn and shaped as the land it really is (never flattened, so the coastline keeps its shape)
    const mapWater = (i: number) => M ? M[i * 4] > 110 : H[i] <= 0.5;
    const level = (i: number) => { const x = i % size, y = (i / size) | 0, h = H[i]; let d = 0;
      if (x > 0) d = Math.max(d, Math.abs(H[i - 1] - h)); if (x < size - 1) d = Math.max(d, Math.abs(H[i + 1] - h));
      if (y > 0) d = Math.max(d, Math.abs(H[i - size] - h)); if (y < size - 1) d = Math.max(d, Math.abs(H[i + size] - h)); return d < 4; };
    const seaArr = v3dSeaMap(H, size, mapWater); (r as any).sea = seaArr;
    const sea = (i: number) => seaArr[i] === 1;
    const water = (i: number) => mapWater(i) && (H[i] <= 8 || level(i));
    const river = (i: number) => M ? M[i * 4 + 1] > 110 && M[i * 4] <= 110 : false;
    // the map look: dark blue land shaded by its slopes, the sea darker, cyan along the coasts
    const cv = document.createElement('canvas'); cv.width = cv.height = size; const c = cv.getContext('2d'), img = c.createImageData(size, size), D = img.data;
    const mPerPx = 40075016 * Math.cos(this.origin[1] * D2R) / (n * 256);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const i = y * size + x; let R = 11, G = 29, B = 51;
      if (water(i)) {
        const isSea = sea(i);
        R = isSea ? 4 : 6; G = isSea ? 11 : 18; B = isSea ? 22 : 34;
      } else if (river(i)) { R = 18; G = 60; B = 92; }
      else {
        const hx = H[i + (x < size - 1 ? 1 : 0)] - H[i - (x > 0 ? 1 : 0)], hy = H[i + (y < size - 1 ? size : 0)] - H[i - (y > 0 ? size : 0)];
        const shade = clamp(1 + (-hx * 0.8 - hy) / (mPerPx * 2) * 0.9, 0.5, 1.75);
        const lift = clamp(H[i] / 2200, 0, 1);
        R = 11 * shade + 16 * lift; G = 29 * shade + 24 * lift; B = 51 * shade + 30 * lift;
        // the coast, as on the map
        if (H[i] < 25 && ((x > 0 && water(i - 1)) || (x < size - 1 && water(i + 1)) || (y > 0 && water(i - size)) || (y < size - 1 && water(i + size)))) { R = 63; G = 208; B = 232; }
      }
      D[i * 4] = R; D[i * 4 + 1] = G; D[i * 4 + 2] = B; D[i * 4 + 3] = 255;
    }
    c.putImageData(img, 0, 0);
    r.mapTex = new T.CanvasTexture(cv); r.mapTex.colorSpace = T.SRGBColorSpace; r.mapTex.anisotropy = 8; r.mapTex.generateMipmaps = true;

    // the mesh: finest near the aircraft; the part an inner ring covers is left out
    const G = Math.round((r.z >= 12 ? 220 : r.z >= 10 ? 140 : 110) * TERRAIN_DENSITY[v3dTerrainQ()]);
    const Hs = v3dTerrainSmooth() ? v3dSoften(H, size, size / G) : H;
    // near its edge a ring takes on the coarser shape of the ring around it (which has half its detail), so the two
    // meet at the same height instead of a step
    const outer = this.rings.length < v3dRange(this.origin ? this.origin[1] : 50).rings.length - 1;   // rings are built finest first
    const Hc = outer ? v3dSoften(H, size, 2 * size / G) : null;
    const lonOf = (px: number) => (r.x0 + px / 256) / n * 360 - 180;
    const latOf = (py: number) => { const k = Math.PI - 2 * Math.PI * (r.y0 + py / 256) / n; return Math.atan(0.5 * (Math.exp(k) - Math.exp(-k))) / D2R; };
    const aptLL = V3d.icao ? apt(V3d.icao).pos : null, aElev = V3d.elev || 0;
    // the ground is levelled only where the airport is (a big airport's runways reach further), blending out over
    // a good distance beyond, so no terrace is cut into the hills around it
    const aBig = V3d.icao && aptSize(V3d.icao) === 2, aR0 = aBig ? 2600 : 1500, aR1 = aR0 + (aBig ? 1800 : 1500);
    const pos = new Float32Array((G + 1) * (G + 1) * 3), uv = new Float32Array((G + 1) * (G + 1) * 2), idx: number[] = [], mh = new Float32Array((G + 1) * (G + 1));
    const flat = new Float32Array((G + 1) * (G + 1));   // 1 where the mesh is water: flat, at the water's level
    // the coast: distance in metres from it (+ land, − sea), from the map's sea outline
    const SD = v3dCoastDist(size, sea), CLIFF = 3;   // near the coast the ground rises at most 3 m for each metre inland
    const sdAt = (px: number, py: number) => { const x = clamp(px, 0, size - 1.001), y = clamp(py, 0, size - 1.001), xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, i = yi * size + xi;
      return (SD[i] * (1 - fx) * (1 - fy) + SD[i + 1] * fx * (1 - fy) + SD[i + size] * (1 - fx) * fy + SD[i + size + 1] * fx * fy) * mPerPx; };
    const sample = (px: number, py: number) => {
      const x = clamp(px, 0, size - 1.001), y = clamp(py, 0, size - 1.001), xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, i = yi * size + xi;
      let h = Hs[i] * (1 - fx) * (1 - fy) + Hs[i + 1] * fx * (1 - fy) + Hs[i + size] * (1 - fx) * fy + Hs[i + size + 1] * fx * fy;
      if (Hc) { const e = Math.max(Math.abs(px / size - 0.5), Math.abs(py / size - 0.5)) * 2, t = clamp((e - 0.8) / 0.18, 0, 1);
        if (t > 0) { const hc = Hc[i] * (1 - fx) * (1 - fy) + Hc[i + 1] * fx * (1 - fy) + Hc[i + size] * (1 - fx) * fy + Hc[i + size + 1] * fx * fy; h += (hc - h) * t * t * (3 - 2 * t); } }
      const k = Math.round(y) * size + Math.round(x);
      return { h, wet: sea(k), lake: !sea(k) && water(k) ? H[k] : null };
    };
    for (let j = 0; j <= G; j++) for (let i = 0; i <= G; i++) {
      const px = i / G * size, py = j / G * size, lon = lonOf(px), lat = latOf(py);
      const s = sample(px, py);
      // the sea is a level surface of its own (v3dSeaPlane); the ground runs on beneath it, and near the coast its height
      // follows the distance from the coast, so the two meet exactly along the map's coastline
      const sd = sdAt(px, py);
      let h = Math.max(0.6, s.h), wl = -1, y = 0;
      if (s.lake != null && !s.wet) { h = Math.max(0, s.lake); wl = h; }  // a lake: flat at its own level
      if (s.wet) { y = Math.max(-40, Math.min(sd, -0.3) * CLIFF); h = 0; }
      else if (wl < 0) { y = h = Math.min(h, Math.max(0.6, sd * CLIFF + 0.6)); }
      else y = h;
      if (aptLL) { const d = gcDistanceNm([lon, lat], aptLL) * NM, k = clamp((d - aR0) / (aR1 - aR0), 0, 1); h = aElev + (h - aElev) * k; }
      const p = v3dXY(lon, lat), o = j * (G + 1) + i;
      flat[o] = wl >= 0 && Math.abs(h - wl) < 0.5 ? 1 : 0;
      // outer rings sit a little lower so the finer ring always shows where they meet
      if (aptLL && !s.wet) { const d = gcDistanceNm([lon, lat], aptLL) * NM, k = clamp((d - aR0) / (aR1 - aR0), 0, 1); y = aElev + (y - aElev) * k; }
      mh[o] = h - (aptLL ? 1.5 : 0) - (r.inner ? 4 : 0);   // the surface (the sea's at sea), for what stands or floats on it
      // land never dips under the sea's surface (the small offsets above are for where rings and the airport meet)
      pos[o * 3] = p[0]; pos[o * 3 + 1] = (s.wet ? y : wl >= 0 ? mh[o] : Math.max(Math.min(h, 0.5), mh[o])) - v3dCurve(p[0], p[1]); pos[o * 3 + 2] = p[1];
      uv[o * 2] = i / G; uv[o * 2 + 1] = 1 - j / G;
    }
    // where the finer ring lies: this ring's ground there sinks well below it (out of sight), so the two never
    // overlap at nearly the same height (that flickered as saw teeth); the finer ring's skirt covers the step
    const innerBox = (() => { const q = r.inner; if (!q) return null; const qn = 1 << q.z, lt = (y: number) => { const k = Math.PI - 2 * Math.PI * y / qn; return Math.atan(0.5 * (Math.exp(k) - Math.exp(-k))) / D2R; };
      return [q.x0 / qn * 360 - 180, (q.x0 + q.N) / qn * 360 - 180, lt(q.y0 + q.N), lt(q.y0)]; })();
    const inside = (lon: number, lat: number, shrink: number) => { const B = innerBox; if (!B) return false; const px = (B[1] - B[0]) * shrink, py = (B[3] - B[2]) * shrink; return lon > B[0] + px && lon < B[1] - px && lat > B[2] + py && lat < B[3] - py; };
    if (innerBox) for (let j = 0; j <= G; j++) for (let i = 0; i <= G; i++) {
      if (!inside(lonOf(i / G * size), latOf(j / G * size), 0)) continue;
      const o = j * (G + 1) + i; const cv = v3dCurve(pos[o * 3], pos[o * 3 + 2]), y0 = pos[o * 3 + 1] + cv; if (y0 > 4) pos[o * 3 + 1] -= 3;
    }
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
      if (r.inner && inside(lonOf((i + 0.5) / G * size), latOf((j + 0.5) / G * size), 0.04)) continue;
      const a = j * (G + 1) + i, b = a + 1, d = a + G + 1, e = d + 1; idx.push(a, d, b, b, d, e);
    }
    (r as any).mh = mh; (r as any).G = G;
    // a skirt round the ring's edge, hanging 60 m down: no crack shows where it meets the coarser ring around it
    const nv = (G + 1) * (G + 1), edge: number[] = [];
    for (let i = 0; i <= G; i++) edge.push(i);
    for (let j = 1; j <= G; j++) edge.push(j * (G + 1) + G);
    for (let i = G - 1; i >= 0; i--) edge.push(G * (G + 1) + i);
    for (let j = G - 1; j >= 0; j--) edge.push(j * (G + 1));
    const P2 = new Float32Array((nv + edge.length) * 3), U2 = new Float32Array((nv + edge.length) * 2), F2 = new Float32Array(nv + edge.length);
    P2.set(pos); U2.set(uv); F2.set(flat);
    edge.forEach((v, k) => { const o = nv + k; P2[o * 3] = pos[v * 3]; P2[o * 3 + 1] = pos[v * 3 + 1] - 60; P2[o * 3 + 2] = pos[v * 3 + 2]; U2[o * 2] = uv[v * 2]; U2[o * 2 + 1] = uv[v * 2 + 1]; F2[o] = flat[v]; });
    for (let k = 0; k < edge.length - 1; k++) { const a = edge[k], b = edge[k + 1], a2 = nv + k, b2 = nv + k + 1; idx.push(a, a2, b, b, a2, b2, a, b, a2, b, b2, a2); }
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(P2, 3)); geo.setAttribute('uv', new T.BufferAttribute(U2, 2)); geo.setAttribute('aFlat', new T.BufferAttribute(F2, 1)); geo.setIndex(idx);
    // the water as its own picture (the sea and lakes; rivers half), for the living water and the coastline
    const wetTex = v3dWetTexture(size, (i: number) => water(i) ? 255 : river(i) ? 150 : 0);
    r.mesh = new T.Mesh(geo, v3dGroundMat((State.settings as any).v3dSat && r.satTex ? r.satTex : r.mapTex, wetTex));
    (r as any).wetTex = wetTex;
    r.mesh.renderOrder = -r.z;
    // the sea's surface under this ring (the largest ring's replaces the smaller ones')
    { const VT: any = V3dTerrain; const a = v3dXY(lonOf(0), latOf(0)), b = v3dXY(lonOf(size), latOf(size)), span = Math.abs(b[0] - a[0]);
      if (!VT.seaPlane || span > (VT.seaSpan || 0)) { VT.seaSpan = span; v3dSeaPlane(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])); } }
    V3d.scene.add(r.mesh);
    try { v3dCityLoad(r); } catch (e) { (r as any).cityDone = true; }
  },

  /** Satellite imagery for a ring (loaded once, when first wanted). */
  loadSat(r: V3dRing) {
    if (r.satTex) { if (r.mesh) r.mesh.material.map = r.satTex, r.mesh.material.needsUpdate = true; return; }
    // finer imagery than the terrain tiles: up to three zoom levels more near you (Settings → Satellite
    // detail), one less for each ring further out, never past zoom 15 (the imagery is about 10 m a pixel),
    // and never a bigger picture than the device's graphics can take
    const q = v3dSatQ(), maxTex = v3dTexCap();
    let k = Math.max(0, q - (r.z >= 12 ? 0 : r.z >= 10 ? 1 : 2));
    // never more tiles than fit the safe picture size (no huge picture in memory first, then shrunk)
    while (k > 0 && (r.z + k > 15 || 256 * r.N * (1 << k) > maxTex)) k--;
    // one ring's imagery at a time, so the memory never has several big pictures at once
    if (this._satBusy) { this._satQ = (this._satQ || []).concat([r]); return; }
    this._satBusy = true; const gen = this.gen;
    const next = () => { this._satBusy = false; const n2 = (this._satQ || []).shift(); if (n2 && gen === this.gen && V3d.open) this.loadSat(n2); };
    const z = r.z + k, N = r.N << k;
    this.tiles(SAT_URL, z, r.x0 << k, r.y0 << k, N, 'jpg', '#5E6B55').then(cv0 => {
      if (!V3d.open || gen !== this.gen || !cv0) { next(); return; }
      this.finishSat(r, cv0, maxTex, gen, next);
    });
  },
  finishSat(r: V3dRing, cv0: HTMLCanvasElement, maxTex: number, gen: number, next: () => void) {
    {
      if (!V3d.open || gen !== this.gen) { next(); return; }
      let cv = cv0;
      if (cv0.width > maxTex) { cv = document.createElement('canvas'); cv.width = cv.height = maxTex; const g = cv.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(cv0, 0, 0, maxTex, maxTex); }
      const T = THREE; r.satTex = new T.CanvasTexture(cv); r.satTex.colorSpace = T.SRGBColorSpace;
      // the sharpest filtering the device has, so the ground stays crisp at a low angle from high up
      r.satTex.anisotropy = (V3d.r && V3d.r.capabilities && V3d.r.capabilities.getMaxAnisotropy) ? V3d.r.capabilities.getMaxAnisotropy() : 8;
      r.satTex.generateMipmaps = true; r.satTex.minFilter = T.LinearMipmapLinearFilter;
      // once the picture is on the graphics card, its copy in the app's memory is let go
      const tex = r.satTex; tex.onUpdate = () => { const im: any = tex.image; tex.onUpdate = null; setTimeout(() => { try { if (im && im.width) { im.width = 1; im.height = 1; } } catch (e) { /* ignore */ } }, 0); };
      if ((State.settings as any).v3dSat && r.mesh) { r.mesh.material.map = r.satTex; r.mesh.material.needsUpdate = true; }
      this.prog.sat = (this.prog.sat || 0) + 1;
      setTimeout(next, 60);
    }
  },
  setSat(on: boolean) {
    for (const r of this.rings) { if (on) this.loadSat(r); else if (r.mesh) { r.mesh.material.map = r.mapTex; r.mesh.material.needsUpdate = true; } }
  },

  /** Is this point on the sea (from the finest ring that covers it)? */
  isSea(lon: number, lat: number): boolean {
    for (const r of this.rings) {
      const n = 1 << r.z, px = ((lon + 180) / 360 * n - r.x0) * 256, py = ((1 - Math.log(Math.tan(lat * D2R) + 1 / Math.cos(lat * D2R)) / Math.PI) / 2 * n - r.y0) * 256;
      if (px < 0 || py < 0 || px >= r.size - 1 || py >= r.size - 1) continue;
      const i = Math.floor(py) * r.size + Math.floor(px), R: any = r;
      return R.sea ? R.sea[i] === 1 : !!(r.mask && r.mask[i * 4] > 110 && r.H[i] < 3);
    }
    return false;
  },

  /** Ground height above the sea (m) at a point, from the finest ring that covers it. */
  ground(lon: number, lat: number): number {
    for (const r of this.rings) {
      const n = 1 << r.z, px = ((lon + 180) / 360 * n - r.x0) * 256, py = ((1 - Math.log(Math.tan(lat * D2R) + 1 / Math.cos(lat * D2R)) / Math.PI) / 2 * n - r.y0) * 256;
      if (px < 0 || py < 0 || px >= r.size - 1 || py >= r.size - 1) continue;
      // the height of the surface as drawn: the same triangles the ground is made of (levelled at the
      // airport, the sea flat), so aircraft, runways, taxiways and photos sit exactly on it
      const R: any = r;
      if (R.mh) {
        const G = R.G, gx = px / r.size * G, gy = py / r.size * G, i0 = Math.min(G - 1, Math.floor(gx)), j0 = Math.min(G - 1, Math.floor(gy)), fx = gx - i0, fy = gy - j0, W = G + 1;
        const ha = R.mh[j0 * W + i0], hb = R.mh[j0 * W + i0 + 1], hd = R.mh[(j0 + 1) * W + i0], he = R.mh[(j0 + 1) * W + i0 + 1];
        return fx + fy <= 1 ? ha + (hb - ha) * fx + (hd - ha) * fy : he + (hd - he) * (1 - fx) + (hb - he) * (1 - fy);
      }
      const i = Math.floor(py) * r.size + Math.floor(px);
      if ((r as any).sea ? (r as any).sea[i] : (r.mask && r.mask[i * 4] > 110 && r.H[i] < 3)) return 0;
      return Math.max(0, r.H[i]);
    }
    return V3d.elev || 0;
  },
};

ACTIONS['v3d-sat'] = () => {
  const S: any = State.settings; S.v3dSat = !S.v3dSat; Sound.tick();
  V3dTerrain.setSat(S.v3dSat);
  const P = (V3d as any).patch; if (P) P.visible = !!S.v3dSat; if (S.v3dSat && !P) v3dAirportPatch();
  const b = V3d.root && V3d.root.querySelector('[data-act=v3d-sat]'); if (b) b.classList.toggle('on', !!S.v3dSat);
  Store.save();
};

/* ---------- the detail patch: the sharpest picture at the airport ---------- */
// The rings cover tens of kilometres each, so their pictures can't be sharper than about 10 m a pixel.
// Around the airport a separate 5 km patch gets its own
// picture: the satellite imagery at its full detail, or your own imagery service (Settings) when set.
function satCustom(): { url: string; max: number } | null {
  const S: any = State.settings, u = String(S.v3dSatUrl || '').trim();
  return /^https:\/\/.+\{z\}.+\{x\}.+\{y\}|^https:\/\/.+\{z\}.+\{y\}.+\{x\}/.test(u) ? { url: u, max: clamp(+S.v3dSatMax || 19, 15, 20) } : null;
}
const _patch = { busy: false, at: null as number[], size: 0, src: '' };
function v3dAirportPatch(tries?: number) { v3dDetailPatch(null, tries); }
/** Build (or rebuild) the detail patch around a point (lon, lat); the airport when none is given. */
function v3dDetailPatch(centre: number[], tries?: number) {
  if (!V3d.open || !(State.settings as any).v3dSat || !V3d.origin || _patch.busy) return;
  if (!V3dTerrain.rings.length) { if ((tries || 0) < 15) setTimeout(() => v3dDetailPatch(centre, (tries || 0) + 1), 1500); return; }
  const T = THREE, ctr = centre || V3d.origin.slice(), gen = V3dTerrain.gen, icao = V3d.icao;
  // how big: smaller and sharper the lower you are
  const cam = V3d.cam ? V3d.cam.position : null, cll = cam ? v3dLonLat(cam.x, cam.z) : ctr, agl = cam ? cam.y - v3dGround(cll[0], cll[1]) : 1e4;
  const size = 5000; void agl;
  const cust = satCustom(), cap = v3dTexCap(), W = cap;
  // the zoom whose pixels best match the picture's pixels, within what the source has (and at most ~400 tiles)
  const lat = ctr[1], mpp = size / W, tileM = (z: number) => 40075016 * Math.cos(lat * D2R) / (1 << z);
  const maxZ = cust ? cust.max : 15;
  let z = 12; while (z < maxZ && tileM(z + 1) / 256 >= mpp * 0.7 && Math.pow(size / tileM(z + 1) + 1, 2) <= 400) z++;
  const n = 1 << z, tx = (lon: number) => (lon + 180) / 360 * n, ty = (la: number) => (1 - Math.log(Math.tan(la * D2R) + 1 / Math.cos(la * D2R)) / Math.PI) / 2 * n;
  // the patch's corners in the 3D view's metres, and on the map
  const q0 = v3dXY(ctr[0], ctr[1]), half = size / 2, llA = v3dLonLat(q0[0] - half, q0[1] + half), llB = v3dLonLat(q0[0] + half, q0[1] - half);   // south-west, north-east
  const fx0 = tx(llA[0]), fx1 = tx(llB[0]), fy0 = ty(llB[1]), fy1 = ty(llA[1]);
  const cv = document.createElement('canvas'); cv.width = cv.height = W; const g = cv.getContext('2d');
  const px = (fx: number, fy: number) => [(fx - fx0) / (fx1 - fx0) * W, (fy - fy0) / (fy1 - fy0) * W];
  _patch.busy = true;
  const done = (credit: string) => {
    _patch.busy = false;
    if (!V3d.open || gen !== V3dTerrain.gen || V3d.icao !== icao) return;
    // soft round edges, so the sharp patch melts into the ground around it
    const grad = g.createRadialGradient(W / 2, W / 2, W * 0.36, W / 2, W / 2, W * 0.5); grad.addColorStop(0, 'rgba(0,0,0,1)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalCompositeOperation = 'destination-in'; g.fillStyle = grad; g.fillRect(0, 0, W, W); g.globalCompositeOperation = 'source-over';
    const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = V3d.r.capabilities.getMaxAnisotropy ? V3d.r.capabilities.getMaxAnisotropy() : 8;
    tex.onUpdate = () => { tex.onUpdate = null; setTimeout(() => { try { cv.width = 1; cv.height = 1; } catch (e) { /* ignore */ } }, 0); };
    const seg = 128, geo = new T.PlaneGeometry(size, size, seg, seg); geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const x = q0[0] + pos.getX(i), zz = q0[1] + pos.getZ(i), ll = v3dLonLat(x, zz);
      pos.setXYZ(i, x, v3dGround(ll[0], ll[1]) - v3dCurve(x, zz) + 0.25, zz);
      uv.setXY(i, (tx(ll[0]) - fx0) / (fx1 - fx0), 1 - (ty(ll[1]) - fy0) / (fy1 - fy0));
    }
    pos.needsUpdate = true; uv.needsUpdate = true; geo.computeBoundingSphere();
    const mesh = new T.Mesh(geo, new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -16 }));
    mesh.renderOrder = 1;
    const VP: any = V3d; if (VP.patch) { V3d.scene.remove(VP.patch); try { VP.patch.geometry.dispose(); VP.patch.material.map.dispose(); } catch (e) { /* ignore */ } }
    VP.patch = mesh; V3d.scene.add(mesh); _patch.at = ctr.slice(); _patch.size = size; _patch.src = credit;
    const cr = V3d.root && V3d.root.querySelector('.v3d-credit'); if (cr) { const base = (cr as any).base || ((cr as any).base = cr.textContent); cr.textContent = credit ? base + ' · ' + credit : base; }
  };
  // underneath: the satellite imagery (so any gap in your own service is still covered)
  const sz = Math.min(15, z), sn = 1 << sz, sx0 = Math.floor(fx0 / n * sn), sy0 = Math.floor(fy0 / n * sn), sN = Math.max(Math.ceil(fx1 / n * sn) - sx0, Math.ceil(fy1 / n * sn) - sy0);
  V3dTerrain.tiles(SAT_URL, sz, sx0, sy0, sN, 'jpg').then(bg => {
    if (bg) { const a = px(sx0 * n / sn, sy0 * n / sn), b = px((sx0 + sN) * n / sn, (sy0 + sN) * n / sn); g.drawImage(bg, a[0], a[1], b[0] - a[0], b[1] - a[1]); bg.width = 1; }
    // on top: your own service
    const url = cust ? cust.url : '';
    if (!url) { done(''); return; }
    const x0 = Math.floor(fx0), y0 = Math.floor(fy0), N = Math.max(Math.ceil(fx1) - x0, Math.ceil(fy1) - y0);
    let left = N * N, got = 0;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const im = new Image(); im.crossOrigin = 'anonymous';
      const fin = () => { if (--left === 0) done(got ? 'Imagery: your own service' : ''); };
      im.onload = () => { try { if (!orthoBlank(im)) { const a = px(x0 + i, y0 + j), b = px(x0 + i + 1, y0 + j + 1); g.drawImage(im, a[0], a[1], b[0] - a[0] + 0.5, b[1] - a[1] + 0.5); got++; } } catch (e) { /* skip */ } fin(); };
      im.onerror = fin;
      im.src = url.replace('{z}', String(z)).replace('{x}', String((x0 + i + n) % n)).replace('{y}', String(y0 + j));
    }
  });
}
/** A tile with nothing on it (outside the coverage, sent as plain white or black): leave the satellite under it. */
function orthoBlank(im: HTMLImageElement): boolean {
  try {
    const c = document.createElement('canvas'); c.width = c.height = 8; const g = c.getContext('2d'); g.drawImage(im, 0, 0, 8, 8);
    const d = g.getImageData(0, 0, 8, 8).data; let mn = 255, mx = 0;
    for (let i = 0; i < d.length; i += 4) { const v = (d[i] + d[i + 1] + d[i + 2]) / 3; if (v < mn) mn = v; if (v > mx) mx = v; }
    return mx - mn < 6 && (mx > 245 || mx < 10);
  } catch (e) { return false; }
}
/** While you fly low or move around: the patch follows (one at a time, when you've moved a good way). */
function v3dPatchFollow() {
  return;   // the airport patch stays where it is
  if (!V3d.open || !(State.settings as any).v3dSat || _patch.busy || !V3d.cam || !V3dTerrain.rings.length) return;
  const c = V3d.cam.position, ll = v3dLonLat(c.x, c.z), agl = c.y - v3dGround(ll[0], ll[1]);
  if (agl > 3000 && V3d.icao) return;   // high up: the airport patch stays
  const want = agl < 350 ? 1500 : agl < 1500 ? 3000 : 5000;
  // the ground point the camera looks at (or under it)
  const dir = new THREE.Vector3(); V3d.cam.getWorldDirection(dir);
  const t = dir.y < -0.05 ? Math.min(want * 0.4, agl / -dir.y) : want * 0.2, gp = v3dLonLat(c.x + dir.x * t, c.z + dir.z * t);
  if (!_patch.at || want !== _patch.size || gcDistanceNm(_patch.at, gp) * 1852 > _patch.size * 0.28) v3dDetailPatch(gp);
}

/** Heights with errors in them show as spikes out of the sea: a point or two standing high where nearly
 *  everything around is at sea level. Those are lowered to the level around them. Mountains are never
 *  touched (their neighbours are high too), so real peaks and cliffs stay. */
function v3dDespike(H: Float32Array, size: number) {
  const nb: number[] = [];
  for (let pass = 0; pass < 2; pass++) for (let y = 1; y < size - 1; y++) for (let x = 1; x < size - 1; x++) {
    const i = y * size + x, h = H[i]; if (h <= 12) continue;
    let low = 0; nb.length = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const v = H[i + dy * size + dx]; nb.push(v); if (v <= 8) low++; }
    if (low >= 6) { nb.sort((a, b) => a - b); H[i] = Math.min(h, nb[3]); }   // the middle of its neighbours
  }
}
/** Where the sea is (1) and isn't (0). The sea is the map's water that joins up with water at sea level:
 *  all of it is the sea, so wrong heights out in the water (spikes, common near steep islands such as the
 *  Faroes) are flattened, however high and however many. Only right at the shore is a high value kept
 *  (a cliff that the map's outline overlaps by a pixel), so the coast keeps its shape. Lakes (water that
 *  never reaches sea level) are not touched. */
function v3dSeaMap(H: Float32Array, size: number, mapWater: (i: number) => boolean): Uint8Array {
  const N = size * size, wet = new Uint8Array(N);
  for (let i = 0; i < N; i++) wet[i] = mapWater(i) ? 1 : 0;
  // distance (in pixels) from the nearest land on the map
  const dist = new Float32Array(N);
  for (let i = 0; i < N; i++) dist[i] = wet[i] ? 1e6 : 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const i = y * size + x; if (!dist[i]) continue;
    if (x > 0) dist[i] = Math.min(dist[i], dist[i - 1] + 1); if (y > 0) dist[i] = Math.min(dist[i], dist[i - size] + 1); }
  for (let y = size - 1; y >= 0; y--) for (let x = size - 1; x >= 0; x--) { const i = y * size + x; if (!dist[i]) continue;
    if (x < size - 1) dist[i] = Math.min(dist[i], dist[i + 1] + 1); if (y < size - 1) dist[i] = Math.min(dist[i], dist[i + size] + 1); }
  // the water connected to water at sea level
  const s = new Uint8Array(N), q = new Int32Array(N); let qh = 0, qt = 0;
  for (let i = 0; i < N; i++) if (wet[i] && H[i] <= 8) { s[i] = 1; q[qt++] = i; }
  while (qh < qt) {
    const i = q[qh++], x = i % size, y = (i / size) | 0;
    const go = (j: number) => { if (!s[j] && wet[j]) { s[j] = 1; q[qt++] = j; } };
    if (x > 0) go(i - 1); if (x < size - 1) go(i + 1); if (y > 0) go(i - size); if (y < size - 1) go(i + size);
  }
  // at the shore itself, a high value is the land (the outline and the heights a pixel apart)
  for (let i = 0; i < N; i++) if (s[i] && H[i] > 8 && dist[i] <= 2 && H[i] > 40) s[i] = 0;
  return s;
}
