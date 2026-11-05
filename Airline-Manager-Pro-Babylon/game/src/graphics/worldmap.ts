// Live world map: dot-matrix land, great-circle routes and moving aircraft on a canvas.
// Canvas 2D only, so it also runs inside the simulator's toolbar panel.

const MAP_LAT_MAX = 84, MAP_LAT_MIN = -58;

// Optional online base maps (MapLibre), chosen with the layer button on the map.
// Classic dot map stays the default and the offline fallback.
const EOX_ATTRIB = 'Sentinel-2 cloudless 2016 by <a href="https://cloudless.eox.at">EOX IT Services GmbH</a> (contains modified Copernicus Sentinel data 2016)';
const OFM_ATTRIB = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>, <a href="https://openmaptiles.org">OpenMapTiles</a>, <a href="https://openfreemap.org">OpenFreeMap</a>';
/** The classic look with real geography at every zoom: coastlines, water and country borders (and,
 *  zoomed in, regional borders and main roads) in the same dark colours, from OpenStreetMap vector
 *  tiles (OpenFreeMap, free to use with credit). The dotted world is only the offline fallback. */
function classicVectorStyle(): any {
  // zoom-dependent values must be a top-level interpolate, so each fade carries its own end value
  const fade = (a: number, b: number, to = 1) => ['interpolate', ['linear'], ['zoom'], a, 0, b, to];
  return {
    version: 8,
    sources: { omt: { type: 'vector', url: 'https://tiles.openfreemap.org/planet', attribution: OFM_ATTRIB } },
    layers: [
      { id: 'land', type: 'background', paint: { 'background-color': '#0B1D33' } },
      { id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water', paint: { 'fill-color': '#040B16' } },
      { id: 'coast', type: 'line', source: 'omt', 'source-layer': 'water', paint: { 'line-color': '#3FD0E8', 'line-opacity': ['interpolate', ['linear'], ['zoom'], 0, 0.6, 6, 0.5, 12, 0.32], 'line-width': ['interpolate', ['linear'], ['zoom'], 0, 0.7, 5, 0.8, 12, 1.2] } },
      { id: 'rivers', type: 'line', source: 'omt', 'source-layer': 'waterway', minzoom: 8, paint: { 'line-color': '#1E4A73', 'line-opacity': 0.5, 'line-width': 0.8 } },
      { id: 'roads', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 7, filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary']]], paint: { 'line-color': '#24486F', 'line-opacity': fade(7, 9), 'line-width': ['interpolate', ['linear'], ['zoom'], 7, 0.5, 14, 2] } },
      { id: 'borders-region', type: 'line', source: 'omt', 'source-layer': 'boundary', minzoom: 4, filter: ['all', ['>=', ['get', 'admin_level'], 3], ['<=', ['get', 'admin_level'], 4], ['!=', ['get', 'maritime'], 1]], paint: { 'line-color': '#93A9C1', 'line-opacity': fade(4, 6, 0.18), 'line-width': 0.7, 'line-dasharray': [3, 3] } },
      { id: 'borders', type: 'line', source: 'omt', 'source-layer': 'boundary', filter: ['all', ['<=', ['get', 'admin_level'], 2], ['!=', ['get', 'maritime'], 1]], paint: { 'line-color': '#93A9C1', 'line-opacity': 0.5, 'line-width': ['interpolate', ['linear'], ['zoom'], 0, 0.7, 6, 1], 'line-dasharray': [4, 3] } },
    ],
  };
}
function baseMapStyle(): any {
  switch (State.settings.mapStyle) {
    case 'street': return 'https://tiles.openfreemap.org/styles/liberty';
    case 'satellite': return {
      version: 8,
      sources: { s2: { type: 'raster', tileSize: 256, maxzoom: 14, attribution: EOX_ATTRIB,
        tiles: ['https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg'] } },
      layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#0A1A2E' } }, { id: 's2', type: 'raster', source: 's2' }],
    };
    default: return classicVectorStyle();
  }
}

// Familiar light street-map colours applied on top of the OpenStreetMap style.
function streetLook(map: any) {
  const layers = (map.getStyle() && map.getStyle().layers) || [];
  const set = (id: string, k: string, v: any) => { try { map.setPaintProperty(id, k, v); } catch (e) { /* property not on this layer */ } };
  for (const l of layers) {
    const id = String(l.id).toLowerCase();
    if (l.type === 'background') set(l.id, 'background-color', '#F8F7F3');
    else if (l.type === 'fill') {
      if (/water|ocean|sea|lake|river/.test(id)) set(l.id, 'fill-color', '#9CC0F9');
      else if (/park|wood|forest|grass|wetland|scrub|garden|green|cemetery|golf|pitch/.test(id)) set(l.id, 'fill-color', '#CEEAD6');
      else if (/glacier|ice|snow/.test(id)) set(l.id, 'fill-color', '#FFFFFF');
      else if (/sand|beach|bare|rock/.test(id)) set(l.id, 'fill-color', '#F1EADB');
      else if (/building/.test(id)) { set(l.id, 'fill-color', '#EEEDEA'); set(l.id, 'fill-outline-color', '#E0DED9'); }
      else if (/aeroway|airport/.test(id)) set(l.id, 'fill-color', '#E6E8EC');
      else if (/residential|landuse|urban|industrial|commercial|retail|school|hospital/.test(id)) set(l.id, 'fill-color', '#F1F0EC');
    } else if (l.type === 'fill-extrusion') { set(l.id, 'fill-extrusion-color', '#EEEDEA'); }
    else if (l.type === 'line') {
      if (/water|river|stream|canal/.test(id)) set(l.id, 'line-color', '#9CC0F9');
      else if (/boundary|admin/.test(id)) set(l.id, 'line-color', '#A8ABB0');
      else if (/motorway|trunk/.test(id)) set(l.id, 'line-color', /casing|outline/.test(id) ? '#E9B949' : '#FDE293');
      else if (/road|street|highway|primary|secondary|tertiary|minor|service|link|bridge|tunnel/.test(id)) set(l.id, 'line-color', /casing|outline/.test(id) ? '#DADCE0' : '#FFFFFF');
      else if (/rail/.test(id)) set(l.id, 'line-color', '#C9CCD1');
      else if (/aeroway|runway|taxiway/.test(id)) set(l.id, 'line-color', '#D3D6DB');
    } else if (l.type === 'symbol') {
      set(l.id, 'text-halo-color', '#FFFFFF'); set(l.id, 'text-halo-width', 1.4);
      set(l.id, 'text-color', /water|ocean|sea|lake|river/.test(id) ? '#4C79B8' : /park|poi/.test(id) ? '#3E7E52' : /country|continent/.test(id) ? '#202124' : '#3C4043');
    }
  }
}

function baseMapAvailable(): boolean { return !!(window as any).maplibregl && navigator.onLine !== false && !!baseMapStyle(); }
function millerY(lat: number): number { const p = lat * D2R; return 1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * p)); }
function millerLat(y: number): number { return (Math.atan(Math.exp(y / 1.25)) - Math.PI / 4) / 0.4 / D2R; }
/** Zoomed in to airport level the map is drawn (pixels per radian) down to a few pixels per metre. */
const MAP_R_MAX = 1.6e7;
/** From this zoom (screen pixels per degree) airports are drawn with their real layout. */
const AIRPORT_DEG_PX = 1800;
const MY_MAX = millerY(MAP_LAT_MAX), MY_MIN = millerY(MAP_LAT_MIN);

interface MapOpts { interactive?: boolean; labels?: boolean; onSelect?: (id: string) => void; compact?: boolean; insetRight?: number; memoKey?: string;
  /** The Flight planner: draws its own route instead of the flights, and takes taps and drags (true: handled). */
  overlay?: (c: CanvasRenderingContext2D, m: WorldMap) => void; onTap?: (x: number, y: number) => boolean;
  onDown?: (x: number, y: number) => boolean; onMove?: (x: number, y: number) => void; onUp?: (x: number, y: number) => void }

/** The aircraft each map is following and its zoom, kept while you visit other screens. */
const _followMemo: { [key: string]: { id: string; z: number } } = {};

/** Where a flight is now: its real position when it comes from the simulator, otherwise along its route. */
function flightPos(f: LiveFlight): number[] {
  if (f.pos) return f.pos;
  const g = GroundSim.pos(f); if (g) return g;   // near an airport: where the airport's taxi model has it
  const fp = flightPathPos(f); if (fp) return fp.pos;   // along its departure, route, arrival and approach
  const A = apt(f.from), B = apt(f.to); if (!A || !B) return f.pos || (A || B || { pos: [0, 0] } as any).pos;
  return gcInterpolate(A.pos, B.pos, f.t);
}

class WorldMap {
  el: HTMLElement; cv: HTMLCanvasElement; ctx: CanvasRenderingContext2D;
  base: HTMLCanvasElement; baseDirty = true;
  w = 0; h = 0; dpr = 1;
  cx = 0; cy = 0; R = 200; // view centre in radians-space, pixels per radian
  shownAps: string[] = [];
  lastInput = 0;
  _tfcPos: any = null; _tfcAt = 0;
  opts: MapOpts; selected: string = null; mark: string = null; raf = 0; alive = true; last = 0;
  ptrs: { [id: number]: { x: number; y: number } } = {}; pinch0 = 0; R0 = 0; moved = false;
  anim: any = null; colors: any; lastFit: any = null; userMoved = false;
  ro: any; ml: any = null; mlHost: HTMLElement = null;
  following: string = null; followT = 0;   // see _followMemo
  /** Airports drawn with their real layout when zoomed in to airport level. */
  scenes: { [icao: string]: AirportView } = {}; scenesT = 0; inScene: { [flightId: string]: number[] } = {}; sceneDraws = false;

  constructor(el: HTMLElement, opts?: MapOpts) {
    this.el = el; this.opts = opts || {};
    this.cv = document.createElement('canvas');
    this.cv.className = 'map-canvas';
    el.appendChild(this.cv);
    this.ctx = this.cv.getContext('2d');
    if (baseMapAvailable()) this.initBaseMap();
    this.base = document.createElement('canvas');
    const cs = getComputedStyle(document.documentElement);
    const v = (n: string) => cs.getPropertyValue(n).trim();
    this.colors = { bg: v('--map-bg'), dot: v('--map-dot'), dotHi: v('--map-dot-hi'), grid: v('--map-grid'), mag: v('--magenta'), cyan: v('--cyan'), ink: v('--ink'), dim: v('--ink-2'), green: v('--green'), amber: v('--amber') };
    this.resize();
    const ResizeObs = (window as any).ResizeObserver;
    if (ResizeObs) { this.ro = new ResizeObs(() => this.resize()); this.ro.observe(el); }
    else window.addEventListener('resize', () => this.resize());
    if (this.ml) { /* MapLibre handles pan, zoom and taps */ }
    else if (this.opts.interactive) this.bindInput();
    else this.cv.addEventListener('click', e => this.tapAt(e.offsetX, e.offsetY));
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  destroy() { this.alive = false; cancelAnimationFrame(this.raf); if (this.ro) this.ro.disconnect(); if (this.ml) { try { this.ml.remove(); } catch (e) { /* already gone */ } this.ml = null; } }

  mlFail = false;
  initBaseMap() {
    const ML = (window as any).maplibregl;
    this.mlHost = document.createElement('div');
    this.mlHost.className = 'ml-host';
    this.el.insertBefore(this.mlHost, this.cv);
    this.cv.classList.add('overlay');
    try {
      this.ml = new ML.Map({
        container: this.mlHost, style: baseMapStyle(), center: [-10, 58], zoom: 2,
        attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false, touchPitch: false,
        renderWorldCopies: false, interactive: !!this.opts.interactive, maxZoom: 18,
      });
      this.ml.touchZoomRotate.disableRotation();
      this.ml.on('move', () => { this.baseDirty = true; this.lastInput = performance.now(); });   // the overlay keeps up at full speed while the map moves
      this.ml.on('dragstart', () => { this.userMoved = true; this.followT = performance.now() + 2500; });
      this.ml.on('zoomstart', (e: any) => { if (e.originalEvent) this.userMoved = true; });
      this.ml.on('click', (e: any) => this.tapAt(e.point.x, e.point.y));
      if (this.opts.onDown) {
        // dragging something of the planner's (a waypoint) instead of the map
        let own = false;
        const dn = (e: any) => { if (e.point && this.opts.onDown(e.point.x, e.point.y)) { own = true; this.ml.dragPan.disable(); } };
        const mv = (e: any) => { if (own && e.point) { this.opts.onMove(e.point.x, e.point.y); this.lastInput = performance.now(); } };
        const upf = (e: any) => { if (!own) return; own = false; this.ml.dragPan.enable(); this.ownUpT = performance.now(); if (e.point) this.opts.onUp(e.point.x, e.point.y); };
        for (const [ev, fn] of [['mousedown', dn], ['touchstart', dn], ['mousemove', mv], ['touchmove', mv], ['mouseup', upf], ['touchend', upf]] as [string, any][]) this.ml.on(ev, fn);
      }
      // tiles failing (offline): the dotted world is drawn instead until tiles load again
      this.ml.on('error', () => { if (!this.mlFail) { this.mlFail = true; this.baseDirty = true; } });
      this.ml.on('sourcedata', (e: any) => { if (this.mlFail && e.tile && e.sourceId !== undefined) { this.mlFail = false; this.baseDirty = true; } });
      if (State.settings.mapStyle === 'street') this.ml.on('style.load', () => streetLook(this.ml));
    } catch (e) {
      this.ml = null; this.mlHost.remove(); this.cv.classList.remove('overlay');
    }
  }

  resize() {
    const r = this.el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    // at most 2 canvas pixels per screen point: as sharp to the eye on a phone, and less than half the pixels to fill each frame
    this.dpr = Math.min((window.devicePixelRatio || 1) * uiScale(), 2);
    this.w = r.width; this.h = r.height;
    for (const c of [this.cv, this.base]) { c.width = Math.round(this.w * this.dpr); c.height = Math.round(this.h * this.dpr); }
    this.cv.style.width = this.w + 'px'; this.cv.style.height = this.h + 'px';
    this.baseDirty = true;
    if (this.ml) this.ml.resize();
    if (this.lastFit && !this.userMoved) this.fit(this.lastFit.points, this.lastFit.pad, false, true, this.lastFit.deep);
  }

  // lon/lat -> screen
  px(lon: number, lat: number): number[] {
    if (this.ml) { const p = this.ml.project([lon, lat]); return [p.x, p.y]; }
    const x = lon * D2R, y = millerY(clamp(lat, MAP_LAT_MIN, MAP_LAT_MAX));
    return [(x - this.cx) * this.R + this.w / 2, (this.cy - y) * this.R * this.yq() + this.h / 2];
  }
  /** Screen -> lon/lat. */
  ll(sx: number, sy: number): number[] {
    if (this.ml) { const p = this.ml.unproject([sx, sy]); return [p.lng, p.lat]; }
    return [((sx - this.w / 2) / this.R + this.cx) / D2R, millerLat(this.cy - (sy - this.h / 2) / (this.R * this.yq()))];
  }
  /** The world map squeezes north-south at high latitudes; zoomed in towards airport level that is
   *  undone around the centre of the view, so runways and buildings keep their true shape. */
  _yqR = -1; _yqY = 0; _yqV = 1;
  yq(): number {
    if (this.R === this._yqR && this.cy === this._yqY) return this._yqV;
    this._yqR = this.R; this._yqY = this.cy; return (this._yqV = this.yqCalc());
  }
  yqCalc(): number {
    if (this.R < 3e4) return 1;
    const t = clamp((Math.log(this.R) - Math.log(3e4)) / (Math.log(6e5) - Math.log(3e4)), 0, 1), lat = millerLat(this.cy) * D2R;
    return 1 + (Math.cos(0.8 * lat) / Math.cos(lat) - 1) * t;
  }
  /** Screen pixels per metre at the centre of the view. */
  pxPerM(): number { const c = this.ll(this.w / 2, this.h / 2), a = this.px(c[0], c[1]), b = this.px(c[0] + 0.01, c[1]); return Math.abs(b[0] - a[0]) / (0.01 * 111320 * Math.cos(c[1] * D2R)); }
  /** Screen pixels per degree of longitude at the current view. */
  degPx(): number {
    if (this.ml) { const a = this.ml.project([0, 50]), b = this.ml.project([1, 50]); return Math.abs(b.x - a.x); }
    return this.R * D2R;
  }
  minR() { return Math.max(this.w / (2 * Math.PI), this.h / (MY_MAX - MY_MIN)); }
  clampView() {
    this.R = clamp(this.R, this.minR(), MAP_R_MAX);
    const hw = this.w / 2 / this.R, hh = this.h / 2 / (this.R * this.yq());
    this.cx = clamp(this.cx, -Math.PI + hw, Math.PI - hw);
    this.cy = clamp(this.cy, MY_MIN + hh, MY_MAX - hh);
  }

  /** Frame a set of points with padding. */
  /** Show these points. deep: allow zooming in further than the usual overview (down to airport level). */
  fit(points: number[][], pad?: number, animate?: boolean, keep?: boolean, deep?: boolean) {
    if (!keep) { this.lastFit = { points, pad, deep }; this.userMoved = false; }
    if (!this.w) return;
    pad = pad == null ? 60 : pad;
    if (this.ml) {
      let a = 999, b = 999, c = -999, d = -999;
      for (const p of points) { a = Math.min(a, p[0]); b = Math.min(b, p[1]); c = Math.max(c, p[0]); d = Math.max(d, p[1]); }
      const insR = this.w > 600 ? (this.opts.insetRight || 0) : 0;
      this.ml.resize();
      this.ml.fitBounds([[a, b], [c, d]], { padding: { top: pad, bottom: pad, left: pad, right: pad + insR }, duration: animate && !reducedMotion() ? 1200 : 0, maxZoom: deep ? 17 : 7 });
      return;
    }
    let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
    for (const p of points) { const x = p[0] * D2R, y = millerY(p[1]); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const ins = this.w > 600 ? (this.opts.insetRight || 0) : 0;
    const minSpan = deep ? 2e-5 : 0.02;
    const R = Math.min((this.w - ins - pad * 2) / Math.max(x1 - x0, minSpan), (this.h - pad * 2) / Math.max(y1 - y0, minSpan));
    const Rc = clamp(R, this.minR(), deep ? MAP_R_MAX : 2600);
    const target = { cx: (x0 + x1) / 2 + ins / 2 / Rc, cy: (y0 + y1) / 2, R: Rc };
    if (animate && !reducedMotion()) this.anim = { from: { cx: this.cx, cy: this.cy, R: this.R }, to: target, t0: performance.now(), dur: 900 };
    else { this.cx = target.cx; this.cy = target.cy; this.R = target.R; this.clampView(); this.baseDirty = true; }
  }

  /** Zoom in on a flight and keep it centred while it moves (until you drag the map). */
  follow(id: string) {
    const f = State.live.filter(x => x.id === id)[0]; if (!f) return;
    this.following = id; this.selected = id;
    const p = this.inScene[id] || flightPos(f), ph = String(f.phase || '');
    const A = apt(f.from), B = !f.noDest ? apt(f.to) : null;
    const dTo = B ? gcDistanceNm(p, B.pos) : 1e9, dFrom = A ? gcDistanceNm(p, A.pos) : 1e9;
    const near = dTo <= dFrom ? B : A, dNear = Math.min(dTo, dFrom);
    const onGround = /taxi|pushback|gate|boarding|take-?off roll|lift-off|touchdown|landing roll|holding short|parked|deplaning/i.test(ph) || ((f.alt || 0) < 80 && dNear < 3);
    const half = (deg: number) => { const k = Math.cos(p[1] * D2R) || 1; return [[p[0] - deg / k, p[1] - deg * 0.6], [p[0] + deg / k, p[1] + deg * 0.6]]; };
    if (onGround) {
      // on the runway or the taxiways: right in at the airport
      const w = Math.max(320, this.w) / (AIRPORT_DEG_PX * 2.4);
      this.fit([[p[0] - w / 2, p[1] - w * 0.3], [p[0] + w / 2, p[1] + w * 0.3]], 0, true, false, true);
    } else if (near && dNear < 40) {
      // on final or just after take-off: the aircraft and the airport together, close in
      const pad = Math.max(0.02, dNear / 60 * 0.25);
      this.fit([[Math.min(p[0], near.pos[0]) - pad, Math.min(p[1], near.pos[1]) - pad * 0.6], [Math.max(p[0], near.pos[0]) + pad, Math.max(p[1], near.pos[1]) + pad * 0.6]], 50, true, false, true);
    } else {
      // en route: the region around it on the world map, not the whole world
      this.fit(half(4.5), 40, true);
    }
    this.userMoved = false;
  }

  /** Back on the map: carry on following the aircraft you were following, at the same zoom. */
  resumeFollow(): boolean {
    const m = this.opts.memoKey && _followMemo[this.opts.memoKey];
    const f = m && State.live.filter(x => x.id === m.id)[0];
    if (!f) return false;
    const p = this.inScene[f.id] || flightPos(f);
    this.following = f.id; this.selected = f.id; this.mark = null;
    if (this.ml) this.ml.jumpTo({ center: p, zoom: m.z });
    else { this.R = m.z; this.cx = p[0] * D2R; this.cy = millerY(p[1]); this.clampView(); this.baseDirty = true; }
    return true;
  }

  zoomBy(f: number, ax?: number, ay?: number) {
    if (this.ml) { this.userMoved = true; this.ml.easeTo({ zoom: this.ml.getZoom() + Math.log(f) / Math.LN2, duration: 300 }); return; }
    ax = ax == null ? this.w / 2 : ax; ay = ay == null ? this.h / 2 : ay;
    const wx = this.cx + (ax - this.w / 2) / this.R, wy = this.cy - (ay - this.h / 2) / (this.R * this.yq());
    this.R *= f; this.clampView();
    this.cx = wx - (ax - this.w / 2) / this.R; this.cy = wy + (ay - this.h / 2) / (this.R * this.yq());
    this.clampView(); this.baseDirty = true;
  }

  bindInput() {
    const cv = this.cv;
    cv.style.touchAction = 'none';
    cv.addEventListener('pointerdown', e => {
      this.lastInput = performance.now();
      if (this.opts.onDown && this.opts.onDown(e.offsetX, e.offsetY)) { this.ownPtr = e.pointerId; cv.setPointerCapture(e.pointerId); return; }
      cv.setPointerCapture(e.pointerId);
      this.ptrs[e.pointerId] = { x: e.offsetX, y: e.offsetY }; this.moved = false; this.anim = null;
      const ids = Object.keys(this.ptrs);
      if (ids.length === 2) { const a = this.ptrs[+ids[0]], b = this.ptrs[+ids[1]]; this.pinch0 = Math.hypot(a.x - b.x, a.y - b.y); this.R0 = this.R; }
    });
    cv.addEventListener('pointermove', e => {
      if (this.ownPtr === e.pointerId) { this.lastInput = performance.now(); if (this.opts.onMove) this.opts.onMove(e.offsetX, e.offsetY); return; }
      const p = this.ptrs[e.pointerId]; if (!p) return;
      this.lastInput = performance.now();
      const ids = Object.keys(this.ptrs);
      if (ids.length === 1) {
        const dx = e.offsetX - p.x, dy = e.offsetY - p.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) { this.moved = true; this.userMoved = true; this.followT = performance.now() + 2500; }
        this.cx -= dx / this.R; this.cy += dy / (this.R * this.yq()); this.clampView(); this.baseDirty = true;
      }
      p.x = e.offsetX; p.y = e.offsetY;
      if (ids.length === 2) {
        const a = this.ptrs[+ids[0]], b = this.ptrs[+ids[1]];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const f = (this.R0 * d / this.pinch0) / this.R;
        this.zoomBy(f, (a.x + b.x) / 2, (a.y + b.y) / 2); this.moved = true; this.userMoved = true;
      }
    });
    const up = (e: PointerEvent) => {
      if (this.ownPtr === e.pointerId) { this.ownPtr = -1; this.ownUpT = performance.now(); if (this.opts.onUp) this.opts.onUp(e.offsetX, e.offsetY); return; }
      if (!this.moved && Object.keys(this.ptrs).length === 1) this.tapAt(e.offsetX, e.offsetY);
      delete this.ptrs[e.pointerId];
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', e => { delete this.ptrs[e.pointerId]; });
    cv.addEventListener('wheel', e => { e.preventDefault(); this.userMoved = true; this.lastInput = performance.now(); this.zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.offsetX, e.offsetY); }, { passive: false } as any);
    cv.addEventListener('dblclick', e => this.zoomBy(1.8, e.offsetX, e.offsetY));
  }

  ownPtr = -1; ownUpT = 0;
  tapAt(x: number, y: number) {
    if (this.opts.onTap) { if (performance.now() - this.ownUpT < 350) return; if (this.opts.onTap(x, y)) return; }
    try { if (crashMapTap(this, x, y)) return; } catch (e) { /* not a crash mark */ }
    let best: string = null, bd = 28;
    for (const f of liveOf()) {
      const p = this.px.apply(this, this.inScene[f.id] || flightPos(f));
      const d = Math.hypot(p[0] - x, p[1] - y);
      if (d < bd) { bd = d; best = f.id; }
    }
    // an airport on the map opens its card, when it is closer to the tap than any flight
    {
      let ap: string = null, ad = 18;
      for (const k of this.shownAps) { const a = apt(k); if (!a) continue; const p = this.px(a.pos[0], a.pos[1]), d = Math.hypot(p[0] - x, p[1] - y); if (d < ad) { ad = d; ap = k; } }
      // a weather mark (any airport with a report on the map)
      if (!ap && WxLayer.on() && (State.settings as any).wxMetar !== false) {
        for (const k in LiveWx.cache) { const w: any = LiveWx.cache[k]; if (!w.raw) continue; const a = apt(k); if (!a) continue; const p = this.px(a.pos[0], a.pos[1]); const d = Math.hypot(p[0] - x, p[1] - y); if (d < Math.min(ad, 14)) { ad = d; ap = k; } }
      }
      // any other airport, when zoomed in far enough to tell them apart
      if (!ap && this.degPx() > 2.5) {
        const ll = this.ll(x, y), ll2 = this.ll(x + 16, y);
        if (ll && ll2) { const nm = gcDistanceNm(ll, ll2), k = World.nearest(ll[0], ll[1], nm); if (k) { const a = apt(k), p = a ? this.px(a.pos[0], a.pos[1]) : null; if (p) { ad = Math.hypot(p[0] - x, p[1] - y); ap = k; } } }
      }
      if (ap && (!best || ad + 3 < bd) && typeof focusAirport === 'function') { this.selected = null; this.closeBubble(); Sound.tick(); focusAirport(ap, true); return; }
    }
    // another airline's aircraft: a short card (who, where from and to, how high and fast), nothing more
    if (Traffic.on()) {
      let tb: any = null, td = Math.min(bd, 20); const now = Date.now();
      for (const f of Traffic.live()) { const pp = flightPathPos(f, now); if (!pp) continue; const p = this.px(pp.pos[0], pp.pos[1]); if (!p) continue; const d = Math.hypot(p[0] - x, p[1] - y); if (d < td) { td = d; tb = f; } }
      if (tb) { this.selected = null; this.closeBubble(); Sound.tick(); trafficCard(tb); return; }
    }
    this.selected = best;
    if (best) this.openBubble(best); else this.closeBubble();
    if (this.opts.onSelect) this.opts.onSelect(best);
  }

  drawBase() {
    const c = this.base.getContext('2d'), col = this.colors;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.w, this.h);
    if (!this.ml) { c.fillStyle = col.bg; c.fillRect(0, 0, this.w, this.h); }
    // the dotted world: only offline, when the real coastlines and borders can't be shown
    const dots = !this.ml || this.mlFail ? 1 : 0;
    if (dots > 0) {
      c.globalAlpha = dots;
      // graticule every 15°
      c.strokeStyle = col.grid; c.lineWidth = 1;
      c.beginPath();
      for (let lon = -180; lon <= 180; lon += 15) { const a = this.px(lon, MAP_LAT_MIN), b = this.px(lon, MAP_LAT_MAX); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); }
      for (let lat = -45; lat <= 75; lat += 15) { const a = this.px(-180, lat), b = this.px(180, lat); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); }
      c.stroke();
      // land dots
      const degPx = this.degPx();
      const step = degPx > 26 ? 0.25 : degPx > 9 ? 0.5 : degPx > 4 ? 1 : 2;
      const r = clamp(degPx * step * 0.2, 0.55, 2.1);
      c.fillStyle = col.dot;
      c.beginPath();
      // only the dots in view (zoomed in, that is a tiny part of the world)
      const ca = this.ll(-8, -8), cb = this.ll(this.w + 8, this.h + 8);
      const lo0 = Math.min(ca[0], cb[0]), lo1 = Math.max(ca[0], cb[0]), la0 = Math.min(ca[1], cb[1]), la1 = Math.max(ca[1], cb[1]);
      const bands = landDotBands(step), b0 = clamp(Math.floor((lo0 + 180) / 2), 0, 179), b1 = clamp(Math.floor((lo1 + 180) / 2), 0, 179);
      for (let bi = b0; bi <= b1; bi++) for (const d of bands[bi]) {
        if (d[0] < lo0 || d[0] > lo1 || d[1] < la0 || d[1] > la1) continue;
        const p = this.px(d[0], d[1]);
        if (p[0] < -4 || p[1] < -4 || p[0] > this.w + 4 || p[1] > this.h + 4) continue;
        c.moveTo(p[0] + r, p[1]); c.arc(p[0], p[1], r, 0, Math.PI * 2);
      }
      c.fill();
      c.globalAlpha = 1;
    }
    // only the airports that matter: on your routes (yours, your hired pilots' and co-op pilots'), where
    // flights are going right now, and the airport you searched for; the other 49,000 stay hidden
    const used: { [k: string]: boolean } = {};
    for (const rt of State.routes) if (rt.companyId === State.companyId && !rt.flownAt) for (const l of rt.legs) used[l] = true;
    for (const f of State.live) { used[f.from] = true; if (!f.noDest) used[f.to] = true; }
    used[company().hub] = true;
    if (this.mark) used[this.mark] = true;
    this.shownAps = Object.keys(used);
    c.font = '600 10px Inter, sans-serif';
    const degPx2 = this.degPx();
    const inDetail = degPx2 >= AIRPORT_DEG_PX;
    for (const k in used) {
      const a = apt(k); if (!a) continue;
      if (inDetail && this.scenes[k] && this.scenes[k].L) continue;   // drawn with its real layout instead
      const p = this.px(a.pos[0], a.pos[1]);
      const hub = k === company().hub, marked = k === this.mark;
      if (marked) { c.beginPath(); c.arc(p[0], p[1], 11, 0, Math.PI * 2); c.strokeStyle = col.mag; c.lineWidth = 2; c.stroke(); }
      c.save(); c.translate(p[0], p[1]); c.rotate(Math.PI / 4);
      c.fillStyle = col.bg; c.strokeStyle = hub ? col.cyan : col.dim; c.lineWidth = 1.4;
      const s = hub ? 4.2 : 3;
      c.fillRect(-s, -s, s * 2, s * 2); c.strokeRect(-s, -s, s * 2, s * 2);
      c.restore();
      if (degPx2 > 1.4 && this.opts.labels !== false) {
        if (this.ml) { c.lineWidth = 3; c.lineJoin = 'round'; c.strokeStyle = 'rgba(5,15,28,.85)'; c.strokeText(k, p[0] + 7, p[1] + 3.5); }
        c.fillStyle = marked ? col.mag : hub ? col.cyan : (this.ml ? col.ink : col.dim); c.fillText(k, p[0] + 7, p[1] + 3.5);
      }
    }
    this.baseDirty = false;
  }

  loop(now: number) {
    if (!this.alive) return;
    this.raf = requestAnimationFrame(this.loop);
    if (!this.el.isConnected) { this.destroy(); return; }
    // Game Booster: while the 3D view covers the map, the map doesn't draw at all
    if (typeof V3d !== 'undefined' && V3d.open && gameBoost()) return;
    // smoother: full speed while you pan, zoom or a move is animating; otherwise about 24 pictures a second
    // (the aircraft move a few pixels a second at most), which leaves the device time for everything else
    { const busy = this.anim || Object.keys(this.ptrs || {}).length || (this.lastInput && now - this.lastInput < 1200);
      const M: any = this; if (!busy && M._fr && now - M._fr < 1000 / 24 - 2) return; M._fr = now; }
    if (_saverWas && !this.anim) { const T: any = this; if (T._svT && now - T._svT < 100) return; T._svT = now; }
    const dt = this.last ? Math.min((now - this.last) / 1000, 0.1) : 0; this.last = now;
    if (this.anim && !this.ml) {
      const k = clamp((now - this.anim.t0) / this.anim.dur, 0, 1), e = 1 - Math.pow(1 - k, 3);
      this.cx = this.anim.from.cx + (this.anim.to.cx - this.anim.from.cx) * e;
      this.cy = this.anim.from.cy + (this.anim.to.cy - this.anim.from.cy) * e;
      this.R = this.anim.from.R * Math.pow(this.anim.to.R / this.anim.from.R, e);
      this.clampView(); this.baseDirty = true;
      if (k >= 1) this.anim = null;
    }
    if (!this.w) return;
    // a followed aircraft stays followed (at the zoom you chose) until its Follow button is tapped again;
    // a drag looks around for a moment, then the map comes back to it
    const mk = this.opts.memoKey;
    if (mk) { if (this.following) _followMemo[mk] = { id: this.following, z: this.ml ? this.ml.getZoom() : this.R }; else delete _followMemo[mk]; }
    if (this.following && !this.anim && now - this.followT > 250 && !Object.keys(this.ptrs).length) {
      this.followT = now;
      const ff = State.live.filter(x => x.id === this.following)[0];
      if (ff) {
        const p = this.inScene[ff.id] || flightPos(ff);
        const ins = this.w > 600 ? (this.opts.insetRight || 0) : 0;
        if (this.ml) { if (!this.ml.isMoving()) this.ml.easeTo({ center: p, offset: [-ins / 2, 0], duration: 240, easing: (x: number) => x }); }
        else { this.cx = p[0] * D2R + ins / 2 / this.R; this.cy = millerY(p[1]); this.clampView(); this.baseDirty = true; }
      }
    }
    if (this.baseDirty) this.drawBase();
    const c = this.ctx, col = this.colors;
    c.setTransform(1, 0, 0, 1, 0, 0);
    if (this.ml) c.clearRect(0, 0, this.cv.width, this.cv.height);
    c.drawImage(this.base, 0, 0);
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const degPx = this.degPx();
    if (this.opts.overlay) { try { this.opts.overlay(c, this); } catch (e) { /* never stop the map */ } return; }   // the planner's own picture
    this.inScene = {}; this.sceneDraws = false;
    if (degPx >= AIRPORT_DEG_PX * 0.5) {
      if (now - this.scenesT > 700) { this.scenesT = now; this.pickScenes(); }
      // the aircraft at an airport are placed by the airport (taxiing, take-off, landing) whatever the zoom,
      // so a followed aircraft never jumps; the layout itself fades in from airport level
      const ppm = this.pxPerM(), fade = clamp((degPx - AIRPORT_DEG_PX) / AIRPORT_DEG_PX, 0, 1);
      for (const icao of Object.keys(this.scenes)) {
        const sc = this.scenes[icao]; if (!sc.L || !sc.graph) continue;
        sc.map = this; sc.ctx = c; sc.s = ppm; sc.track = this.following || this.selected;
        try { sc.computePlanes(Date.now()); } catch (e) { continue; }   // one airport's trouble never stops the map
        if (fade > 0) sc.drawLayoutEmbedded(c, fade);
        for (const pl of sc.planes) if (!pl.parked) this.inScene[pl.id] = sc.lonLat(pl.x, pl.y);
      }
      this.sceneDraws = fade > 0;
      if (fade > 0) for (const icao of Object.keys(this.scenes)) { const sc = this.scenes[icao]; if (sc.L && sc.graph) { sc.map = this; sc.drawAircraftTo(c, now); } }
    }
    try { nightMapDraw(c, this); } catch (e) { /* never stop the map */ }
    try { WxLayer.draw(c, this, degPx); } catch (e) { /* never stop the map */ }
    try { crashMapDraw(c, this); } catch (e) { /* never stop the map */ }
    try { if (typeof Network !== 'undefined') Network.drawOnMap(c, this, degPx); } catch (e) { /* never stop the map */ }
    try { this.drawTraffic(c, degPx); } catch (e) { /* never stop the map */ }
    for (const f of liveOf()) {
      // (your demo flight moves on the real clock along its profile: demoUpdate in ai-sim.ts)
      const Af = apt(f.from), Bf = apt(f.to); if (!Af || !Bf) continue;   // an airport not loaded yet: drawn once it is
      const a = Af.pos, b = Bf.pos;
      const N = 48;
      let pts: number[][] = [], cut = -1;
      const fpp = !f.noDest ? flightPathPos(f) : null;
      if (fpp) {
        // the flight's own path: departure, route, arrival and approach
        pts = fpp.fp.pts.map(q => this.px(q[0], q[1]));
        let i = 1; while (i < fpp.fp.cum.length && fpp.fp.cum[i] < fpp.d) i++; cut = i - 1;
        this.procLabels(c, fpp.fp, f, degPx);
      } else if (!f.noDest) for (let i = 0; i <= N; i++) pts.push(this.px.apply(this, gcInterpolate(a, b, i / N)));
      const sel = this.selected === f.id, mine = !!f.you;
      const here = this.px.apply(this, this.inScene[f.id] || flightPos(f));
      if (pts.length) {
        // remaining route: dashed
        // at airport level the long route lines fade, so the airport stays readable
        const rf = degPx >= AIRPORT_DEG_PX ? 0.22 : 1;
        // only the parts on screen are drawn: zoomed in, a route is millions of pixels long
        c.setLineDash([4, 5]); c.lineWidth = 1.2; c.strokeStyle = mine ? col.cyan : col.mag; c.globalAlpha = 0.45 * rf;
        c.beginPath(); this.clippedLine(c, pts); c.stroke();
        // flown part: solid
        c.setLineDash([]); c.globalAlpha = rf; c.lineWidth = sel || mine ? 2.4 : 1.8;
        const upto = cut >= 0 ? cut : Math.max(1, Math.floor(f.t * N));
        c.beginPath(); this.clippedLine(c, pts.slice(0, upto + 1).concat([here])); c.stroke();
      }
      c.setLineDash([]); c.globalAlpha = 1;
      if (this.inScene[f.id] && this.sceneDraws) continue;   // drawn by the airport, on its taxiway or runway
      // heading: the real one for your flight, otherwise from a point just ahead on the route
      let hdg: number;
      if (f.real && f.hdg != null) hdg = f.hdg;
      else if (fpp) { const h2 = this.px.apply(this, geoDest(fpp.pos, fpp.hdg, 0.5)); hdg = Math.atan2(h2[0] - here[0], -(h2[1] - here[1])) / D2R; }
      else { const ah = this.px.apply(this, gcInterpolate(a, b, Math.min(f.t + 0.01, 1))); hdg = Math.atan2(ah[0] - here[0], -(ah[1] - here[1])) / D2R; }
      const t = acType(flightTypeId(f));
      const prop = t.cls === 'bush' || t.cls === 'turboprop' || t.cls === 'ga';
      if (sel || mine) {
        const pulse = (now / 1000) % 1.6 / 1.6;
        c.beginPath(); c.arc(here[0], here[1], 10 + pulse * 16, 0, Math.PI * 2);
        c.strokeStyle = mine ? col.cyan : col.mag; c.globalAlpha = 0.5 * (1 - pulse); c.lineWidth = 1.5; c.stroke(); c.globalAlpha = 1;
      }
      const light = this.ml && State.settings.mapStyle === 'street';
      drawPlaneGlyph(c, here[0], here[1], hdg, mine ? 22 : 18, prop, mine ? (light ? '#0B8FB0' : col.cyan) : (light ? '#14243A' : col.ink), light ? '#FFFFFF' : col.bg);
      if (this.opts.labels !== false && (degPx > 3.2 || sel || mine)) {
        c.font = '600 11px Inter, sans-serif';
        const fav = !!((State as any).favs || {})[f.pilotId] && !mine;
        const label = (fav ? '★ ' : '') + f.callsign, w = c.measureText(label).width;
        const lx = here[0] + 14, ly = here[1] - 12;
        c.fillStyle = 'rgba(6,16,30,.82)'; c.fillRect(lx - 4, ly - 11, w + 8, 16);
        c.fillStyle = mine ? col.cyan : fav ? col.amber : col.ink; c.fillText(label, lx, ly + 1);
      }
    }
    this.placeBubble();
  }

  /** Other airlines' aircraft: small grey glyphs, the airline's name when zoomed in. */
  drawTraffic(c: CanvasRenderingContext2D, degPx: number) {
    const list = Traffic.live(); if (!list.length) return;
    const light = this.ml && State.settings.mapStyle === 'street', now = Date.now(), used: number[][] = [];
    if (!this._tfcPos || now - this._tfcAt > 250) { this._tfcAt = now; const m: any = {}; for (const f of list) m[f.id] = flightPathPos(f, now); this._tfcPos = m; }
    for (const f of list) {
      const pp = this._tfcPos[f.id]; if (!pp) continue;
      const here = this.px(pp.pos[0], pp.pos[1]); if (!here || here[0] < -30 || here[1] < -30 || here[0] > this.w + 30 || here[1] > this.h + 30) continue;
      const ah = this.px.apply(this, geoDest(pp.pos, pp.hdg, 0.5)), hdg = Math.atan2(ah[0] - here[0], -(ah[1] - here[1])) / D2R;
      const t = acType(f.typeId), prop = t && (t.cls === 'turboprop' || t.cls === 'bush');
      c.globalAlpha = 0.72; drawPlaneGlyph(c, here[0], here[1], hdg, 13, prop, light ? '#5B6B80' : '#8C9BB0', light ? '#FFFFFF' : '#0B1626'); c.globalAlpha = 1;
      if (this.opts.labels !== false && degPx > 10) {
        c.font = '500 10px Inter, sans-serif'; const lab = `${tfcLabel(f.tfc)} ${f.callsign}`, w = c.measureText(lab).width;
        // a name only where it doesn't sit on another one
        const box = [here[0] + 10, here[1] - 19, here[0] + 16 + w, here[1] - 6];
        if (used.some(u => box[0] < u[2] && box[2] > u[0] && box[1] < u[3] && box[3] > u[1])) continue;
        used.push(box);
        c.fillStyle = light ? 'rgba(255,255,255,.75)' : 'rgba(6,16,30,.6)'; c.fillRect(here[0] + 10, here[1] - 19, w + 6, 13);
        c.fillStyle = light ? '#3B4A5E' : '#A9B6C8'; c.fillText(lab, here[0] + 13, here[1] - 9);
      }
    }
  }

  /** Add a polyline to the current path, cut to the screen (plus a margin). */
  clippedLine(c: CanvasRenderingContext2D, pts: number[][]) {
    const m = 40, x0 = -m, y0 = -m, x1 = this.w + m, y1 = this.h + m;
    let open = false;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      if (!a || !b || !isFinite(a[0] + a[1] + b[0] + b[1])) { open = false; continue; }
      // Liang-Barsky
      let t0 = 0, t1 = 1; const dx = b[0] - a[0], dy = b[1] - a[1];
      const edge = (p: number, q: number) => { if (p === 0) return q >= 0; const r = q / p; if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; } return true; };
      if (!(edge(-dx, a[0] - x0) && edge(dx, x1 - a[0]) && edge(-dy, a[1] - y0) && edge(dy, y1 - a[1]))) { open = false; continue; }
      const sx = a[0] + dx * t0, sy = a[1] + dy * t0, ex = a[0] + dx * t1, ey = a[1] + dy * t1;
      if (!open || t0 > 0) c.moveTo(sx, sy);
      c.lineTo(ex, ey); open = t1 >= 1;
    }
  }

  /** Names of the departure, arrival and approach along a flight's path, when zoomed in enough to read them. */
  procLabels(c: CanvasRenderingContext2D, fp: FlightPath, f: LiveFlight, degPx: number) {
    const sel = this.selected === f.id || this.following === f.id;
    if (degPx < (sel ? 60 : 300) || this.opts.labels === false) return;
    c.save(); c.font = '600 10px Inter, sans-serif'; c.textAlign = 'center';
    for (const part of fp.parts) {
      if (part.kind === 'route' || !part.name) continue;
      const mid = pathAt(fp, (part.from + part.to) / 2), q = this.px(mid.pos[0], mid.pos[1]);
      if (q[0] < 0 || q[1] < 0 || q[0] > this.w || q[1] > this.h) continue;
      const text = part.name, w = c.measureText(text).width;
      c.fillStyle = 'rgba(6,16,30,.78)'; c.fillRect(q[0] - w / 2 - 5, q[1] - 17, w + 10, 15);
      c.fillStyle = part.kind === 'app' ? (f.you ? this.colors.cyan : this.colors.mag) : this.colors.dim; c.fillText(text, q[0], q[1] - 6);
    }
    c.restore();
  }

  /** The airports in view (up to three, nearest the centre first) get their real layout. */
  pickScenes() {
    const a = this.ll(-this.w * 0.25, -this.h * 0.25), b = this.ll(this.w * 1.25, this.h * 1.25), c = this.ll(this.w / 2, this.h / 2);
    const lo0 = Math.min(a[0], b[0]), lo1 = Math.max(a[0], b[0]), la0 = Math.min(a[1], b[1]), la1 = Math.max(a[1], b[1]);
    const near: [number, string][] = [];
    const look = (ap: any) => { const p = ap.pos; if (p[0] >= lo0 && p[0] <= lo1 && p[1] >= la0 && p[1] <= la1) near.push([(p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2, ap.icao]); };
    for (const k of Object.keys(AIRPORTS)) look(AIRPORTS[k]);
    if (World.ready) {
      const G: any = (World as any)._grid || ((World as any)._grid = (() => { const g: { [k: string]: any[] } = {}; for (const ap of World.list) if ((ap.size || 0) >= 1 && !AIRPORTS[ap.icao]) { const k = Math.floor(ap.pos[0] / 2) + ',' + Math.floor(ap.pos[1] / 2); (g[k] = g[k] || []).push(ap); } return g; })());
      for (let gx = Math.floor(lo0 / 2); gx <= Math.floor(lo1 / 2); gx++) for (let gy = Math.floor(la0 / 2); gy <= Math.floor(la1 / 2); gy++) for (const ap of G[gx + ',' + gy] || []) look(ap);
    }
    near.sort((x, y) => x[0] - y[0]);
    const want = near.slice(0, 3).map(n => n[1]);
    // the airports of the aircraft you follow, while it is near them, even with the airport off-screen
    const ff: any = this.following && State.live.filter(x => x.id === this.following)[0];
    if (ff) { const p = flightPos(ff); for (const k of [ff.from, ff.noDest ? null : ff.to]) { const ap = k && apt(k); if (ap && gcDistanceNm(p, ap.pos) < 25 && want.indexOf(k) < 0) want.unshift(k); } }
    for (const k of want) if (!this.scenes[k]) this.scenes[k] = makeAirportScene(k, this);
    // keep a few recent ones, let the rest go
    const keys = Object.keys(this.scenes);
    if (keys.length > 6) for (const k of keys) if (want.indexOf(k) < 0 && Object.keys(this.scenes).length > 6) delete this.scenes[k];   // the scene itself stays for the ground model
    if (want.length) this.baseDirty = true;
  }

  /** Fly down to an airport at its real place on the map, keeping an eye on an aircraft if one is given. */
  flyToAirport(icao: string, track?: string) {
    const a: any = apt(icao); if (!a) return;
    const lon = a.pos[0], lat = a.pos[1], span = 2600;   // metres across the view
    this.mark = null; this.selected = track || null; this.following = track || null; this.userMoved = false;
    if (!this.scenes[icao]) this.scenes[icao] = makeAirportScene(icao, this);
    if (this.ml) {
      const z = Math.log(156543 * Math.cos(lat * D2R) / (span / Math.max(320, this.w))) / Math.LN2;
      this.ml.flyTo({ center: [lon, lat], zoom: Math.min(18, z), duration: reducedMotion() ? 0 : 1800, essential: true });
      return;
    }
    const R = clamp((Math.max(320, this.w) / span) * 6371000 * Math.cos(lat * D2R), this.minR(), MAP_R_MAX);
    const to = { cx: lon * D2R, cy: millerY(lat), R };
    if (reducedMotion()) { this.cx = to.cx; this.cy = to.cy; this.R = to.R; this.clampView(); this.baseDirty = true; }
    else this.anim = { from: { cx: this.cx, cy: this.cy, R: this.R }, to, t0: performance.now(), dur: 1800 };
  }

  /* ---------- the flight's speech bubble: follow, favourite, details ---------- */
  bubbleId: string = null; bubbleEl: HTMLElement = null;
  openBubble(id: string) {
    this.bubbleId = id;
    if (!this.bubbleEl) { this.bubbleEl = document.createElement('div'); this.bubbleEl.className = 'fbub'; this.el.appendChild(this.bubbleEl); }
    this.bubbleEl.innerHTML = flightBubbleHtml(id, this.following === id);
    this.bubbleEl.classList.remove('in'); void this.bubbleEl.offsetWidth; this.bubbleEl.classList.add('in');
    this.placeBubble();
  }
  closeBubble() { this.bubbleId = null; if (this.bubbleEl) { this.bubbleEl.remove(); this.bubbleEl = null; } }
  placeBubble() {
    if (!this.bubbleId || !this.bubbleEl) return;
    const f = State.live.filter(x => x.id === this.bubbleId)[0];
    if (!f) { this.closeBubble(); return; }
    const p = this.px.apply(this, this.inScene[f.id] || flightPos(f));
    const off = p[0] < -20 || p[1] < -20 || p[0] > this.w + 20 || p[1] > this.h + 20;
    this.bubbleEl.style.visibility = off ? 'hidden' : '';
    // keep the box inside the map; the pointer line still ends on the aircraft
    // the box is as wide as its buttons need; it stays centred over the aircraft unless that would push it off the map
    const half = ((this.bubbleEl.firstElementChild as HTMLElement || this.bubbleEl).offsetWidth / 2) || 100;
    const shift = clamp(p[0], half + 6, Math.max(half + 6, this.w - half - 6)) - p[0];
    this.bubbleEl.style.transform = `translate(${p[0].toFixed(1)}px, ${p[1].toFixed(1)}px)`;
    this.bubbleEl.style.setProperty('--shift', shift.toFixed(1) + 'px');
  }
}
