// Airport view: a digital map of one airport in the live operations' style, with the aircraft taxiing,
// taking off, landing and taxiing in.
//  - The layout: linked to the simulator, its own runways, taxiways and stands (through the PC app);
//    otherwise the airport's real runways, with the apron and taxiway drawn schematically.
//  - The active runway follows the wind (the simulator's weather when linked).
//  - Your flight is drawn where the simulator says it is. Hired and co-op pilots' flights follow their
//    real flight profile: taxi from the stand along the taxiways, take-off roll and climb-out; approach,
//    landing roll and taxi in to a stand. Aircraft parked here stand at their gates.
//  - Track an aircraft and the view follows it; when it leaves the airport, the world map takes over
//    and keeps following it.

interface ApvPlane { id: string; x: number; y: number; hdg: number; alt: number; phase: string; label: string; you: boolean; span: number; prop: boolean; nose?: number; parked?: boolean; kt?: number; rwy?: string; stype?: number; reg?: string }

const APV_RANGE = 14000;       // metres from the airport within which aircraft are shown

let _apv: AirportView = null;

class AirportView {
  host: HTMLElement; root: HTMLElement; cv: HTMLCanvasElement; ctx: CanvasRenderingContext2D;
  icao: string; L: AirportLayout = null; w = 0; h = 0; dpr = 1;
  cx = 0; cy = 0; s = 0.25; raf = 0; alive = true;
  track: string = null; seen = false; userMoved = false; fromWorld: WorldMap = null;
  ptrs: { [id: number]: { x: number; y: number } } = {}; pinch0 = 0; s0 = 0; moved = false;
  graph: { pts: number[][]; adj: { [k: string]: [string, number][] }; parks: number[][]; schematic: boolean } = null;
  active: { tx: number; ty: number; ux: number; uy: number; len: number; wid: number; name: string; wind: number; windKt: number } = null;
  planes: ApvPlane[] = [];
  lastList = 0;
  /** Drawn inside the world map (zoomed in to airport level) instead of on its own screen. */
  embedded = false; map: WorldMap = null; col: any = null;

  constructor(host: HTMLElement, icao: string, track: string, fromWorld: WorldMap) {
    this.host = host; this.icao = icao; this.track = track; this.fromWorld = fromWorld;
    const a: any = apt(icao);
    this.root = document.createElement('div'); this.root.className = 'apv';
    this.root.innerHTML = `<canvas></canvas>
      <div class="apv-head"><button class="icon-btn apv-back" data-act="apv-close" aria-label="Back to the world map">${icon('chevron', 'flip')}</button>
        <span class="apv-t"><b>${esc(icao)}</b><small>${esc(a ? a.name : icao)}</small></span><span class="apv-src" id="apv-src">Loading the layout…</span></div>
      <div class="apv-tools"><button class="icon-btn" data-act="apv-zoom" data-f="1.5" aria-label="Zoom in">${icon('plus')}</button><button class="icon-btn" data-act="apv-zoom" data-f="0.667" aria-label="Zoom out"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M5 12h14"/></svg></button><button class="icon-btn" data-act="apv-fit" aria-label="Whole airport">${icon('focus')}</button></div>
      <div class="apv-rwy" id="apv-rwy"></div>
      <div class="apv-list" id="apv-list"></div>
      <div class="apv-note" id="apv-note"></div>`;
    host.appendChild(this.root);
    this.cv = this.root.querySelector('canvas'); this.ctx = this.cv.getContext('2d');
    this.size(); this.bind();
    this.loop = this.loop.bind(this);
    this.fetching = navigator.onLine !== false || Link.status === 'connected';
    AirportLayouts.get(icao, L => {
      if (!this.alive) return;
      if (!L) { this.fetching = false; if (this.L) this.setLayout(this.L, true); return; }   // nothing better: say so
      this.setLayout(L, true); toast(L.source === 'sim' ? 'Layout from your simulator' : 'Real airport layout loaded', 'ok');
    })
      .then(L => { if (!this.alive) return; this.setLayout(L); if (L.source !== 'runways') this.fetching = false; this.labelSource();
        // nothing better came within 45 seconds: stop saying it is coming
        setTimeout(() => { if (this.alive && this.fetching) { this.fetching = false; this.labelSource(); } }, 45000); });
    this.raf = requestAnimationFrame(this.loop);
  }

  close(resumeWorld: boolean) {
    this.alive = false; cancelAnimationFrame(this.raf); this.root.remove(); _apv = null;
    const m = this.fromWorld;
    if (m && resumeWorld && this.track && State.live.some(f => f.id === this.track)) { m.mark = null; m.follow(this.track); m.openBubble(this.track); }
  }

  size() { const r = this.host.getBoundingClientRect(); this.dpr = Math.min(2, window.devicePixelRatio || 1); this.w = r.width; this.h = r.height; this.cv.width = Math.round(this.w * this.dpr); this.cv.height = Math.round(this.h * this.dpr); }

  /* ---------- geometry ---------- */
  xy(lat: number, lon: number): number[] {
    const L = this.L, k = Math.cos(L.lat * Math.PI / 180);
    return [(lon - L.lon) * 111320 * k, (lat - L.lat) * 110540];
  }
  scr(x: number, y: number): number[] {
    if (this.embedded) { const L = this.L; return this.map.px(L.lon + x / (111320 * Math.cos(L.lat * Math.PI / 180)), L.lat + y / 110540); }
    return [this.w / 2 + (x - this.cx) * this.s, this.h / 2 - (y - this.cy) * this.s];
  }
  /** Local metres -> lon/lat. */
  lonLat(x: number, y: number): number[] { const L = this.L; return [L.lon + x / (111320 * Math.cos(L.lat * Math.PI / 180)), L.lat + y / 110540]; }

  fetching = false;
  setLayout(L: AirportLayout, upgrade?: boolean) {
    this.L = L; this.routes = {}; this.reachCache = {}; this.joins = null; this.joinsBy = {}; this.frames = {};
    if (this.embedded) { this.buildGraph(); this.pickRunway(); this.pc = null; return; }
    if (L.source !== 'runways') this.fetching = false;
    this.labelSource();
    this.buildGraph(); this.pickRunway();
    if (!upgrade || !this.userMoved) { const keepS = upgrade ? this.s : 0; this.fit(); if (keepS && this.track) this.s = keepS; }
    const note = $('#apv-note');
    const why = AirportLayouts.osmWhy[this.icao];
    if (note) note.innerHTML = L.source !== 'runways' || this.fetching ? ''
      : navigator.onLine === false ? `${icon('info')}<span>You're offline: showing the real runways. The full layout loads when you're back online.</span><button class="text-btn" data-act="apv-retry">Try again</button>`
      : why === 'busy' ? `${icon('info')}<span>The map servers are busy right now, so the real runways are shown.</span><button class="text-btn" data-act="apv-retry">Try again</button>`
      : `${icon('info')}<span>${this.icao} isn't mapped in detail on OpenStreetMap yet, so the real runways are shown.${Link.status === 'connected' ? '' : ' Link the app to the simulator for its full layout.'}</span>`;
    if (note && note.innerHTML) { note.style.transition = ''; note.style.opacity = '1'; if (why !== 'busy' && navigator.onLine !== false) setTimeout(() => { note.style.transition = 'opacity .6s'; note.style.opacity = '0'; }, 9000); }
  }
  labelSource() {
    const src = $('#apv-src'), L = this.L; if (!src || !L) return;
    src.innerHTML = L.source === 'sim' ? 'Layout from your simulator' : L.source === 'osm' ? (L.gen ? 'Real runways · taxiways and apron laid out to the standard dimensions · © OpenStreetMap contributors' : (L as any).genStands ? 'Real airport layout, stands laid out on the aprons · © OpenStreetMap contributors' : 'Real airport layout · © OpenStreetMap contributors')
      : this.fetching ? '<span class="apv-spin"></span>Real runways · getting the full layout…' : L.runways.length ? (L.gen ? 'Real runways · taxiways and apron laid out to the standard dimensions' : 'Real runways · taxiways and apron drawn simplified') : 'No runway data for this airport';
    src.classList.toggle('sim', L.source !== 'runways');
  }

  /** Taxi network: from the simulator's taxi paths, or a schematic parallel taxiway and apron. */
  buildGraph() {
    (this as any)._adjFull = null;
    const L = this.L, adj: { [k: string]: [string, number][] } = {};
    const link = (a: string, b: string, d: number) => { (adj[a] = adj[a] || []).push([b, d]); (adj[b] = adj[b] || []).push([a, d]); };
    if ((L.source !== 'runways' || L.gen) && L.points.length && L.paths.length) {
      const P = L.points;
      for (const p of L.paths) {
        const [type, , st, en] = p;
        if (type === 3) { const a = P[st], k = L.parks[en]; if (a && k) link('n' + st, 'p' + en, Math.hypot(a[0] - k[0], a[1] - k[1])); }
        else if (type === 1 || type === 2 || type === 4 || type === 9) { const a = P[st], b = P[en]; if (a && b) link('n' + st, 'n' + en, Math.hypot(a[0] - b[0], a[1] - b[1]) * (type === 2 ? 3 : 1)); }
      }
      this.graph = { pts: P, adj, parks: L.parks, schematic: false };
      return;
    }
    // schematic: along the longest runway, a parallel taxiway, an apron with stands, links at both ends and the middle
    const r = L.runways.slice().sort((a, b) => b.len - a.len)[0];
    if (!r) { this.graph = { pts: [], adj, parks: [], schematic: true }; return; }
    const c = this.xy(r.lat, r.lon), h = r.hdg * Math.PI / 180, ux = Math.sin(h), uy = Math.cos(h), px = Math.cos(h), py = -Math.sin(h);
    const half = r.len / 2, off = Math.max(140, r.wid * 3), apr = off + 120;
    const P: number[][] = [], at = (s: number, o: number) => { P.push([c[0] + ux * s + px * o, c[1] + uy * s + py * o, 1]); return P.length - 1; };
    const ends = [-half + 40, -half / 2, 0, half / 2, half - 40];
    const tw = ends.map(s => at(s, off)), rw = ends.map(s => at(s, 0));
    for (let i = 0; i < tw.length; i++) { link('n' + tw[i], 'n' + rw[i], off); if (i) link('n' + tw[i - 1], 'n' + tw[i], ends[i] - ends[i - 1]); }
    const parks: number[][] = [], n = Math.max(4, Math.min(14, Math.round(r.len / 220)));
    for (let i = 0; i < n; i++) {
      const s = (i - (n - 1) / 2) * Math.min(70, (r.len * 0.6) / n), k = [c[0] + ux * s + px * apr, c[1] + uy * s + py * apr];
      parks.push([k[0], k[1], (r.hdg + 270) % 360, r.len > 1800 ? 30 : 14, r.len > 1800 ? 9 : 2, 10, i + 1]);
      const lead = at(s, off + 55); link('n' + lead, 'p' + i, 65);
      let best = tw[0], bd = 1e9; for (const t of tw) { const d = Math.hypot(P[t][0] - P[lead][0], P[t][1] - P[lead][1]); if (d < bd) { bd = d; best = t; } }
      link('n' + lead, 'n' + best, bd);
    }
    this.graph = { pts: P, adj, parks, schematic: true };
  }

  /** The runway in use: the longest one with the most headwind. */
  pickRunway() {
    const L = this.L; if (!L.runways.length) { this.active = null; return; }
    const sw: any = Link.sim && Link.sim.wx && Link.sim.lat && gcDistanceNm([Link.sim.lon, Link.sim.lat], [L.lon, L.lat]) < 60 ? Link.sim.wx : null;
    const wind = sw ? sw.windDir : (_hashStr(this.icao + new Date().toDateString()) % 360), windKt = sw ? Math.round(sw.windKt) : 6 + (_hashStr(this.icao) % 12);
    let best: any = null, bs = -1e9;
    const ar = typeof activeRunway === 'function' ? activeRunway(this.icao) : null;   // the one the flights use
    for (const r of L.runways) for (const dir of [0, 1]) {
      const hd = (r.hdg + dir * 180) % 360, head = Math.cos((wind - hd) * Math.PI / 180);
      const score = ar ? -Math.abs(angDiff(ar.hdg, hd)) * 10 + Math.min(r.len, 4000) / 1500 : head * 2 + Math.min(r.len, 4000) / 1500;
      if (score > bs) { bs = score; best = { r, dir, hd }; }
    }
    const r = best.r, c = this.xy(r.lat, r.lon), h = best.hd * Math.PI / 180, ux = Math.sin(h), uy = Math.cos(h);
    this.active = { tx: c[0] - ux * r.len / 2, ty: c[1] - uy * r.len / 2, ux, uy, len: r.len, wid: r.wid || 45, name: best.dir ? r.b : r.a, wind, windKt };
    this.joins = null;
    const el = $('#apv-rwy');
    if (el) el.innerHTML = `<b>Runway ${esc(this.active.name || '')}</b><small>Wind ${String(Math.round(wind)).padStart(3, '0')}° at ${windKt} kt${sw ? '' : ' (estimated)'}</small>`;
  }

  fit() {
    const L = this.L; const xs: number[] = [], ys: number[] = [];
    for (const r of L.runways) { const c = this.xy(r.lat, r.lon), h = r.hdg * Math.PI / 180; for (const k of [-.5, .5]) { xs.push(c[0] + Math.sin(h) * r.len * k); ys.push(c[1] + Math.cos(h) * r.len * k); } }
    for (const p of (this.graph ? this.graph.parks : [])) { xs.push(p[0]); ys.push(p[1]); }
    if (!xs.length) { xs.push(-1000, 1000); ys.push(-1000, 1000); }
    const x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    this.cx = (x0 + x1) / 2; this.cy = (y0 + y1) / 2;
    this.s = clamp(Math.min(this.w / Math.max(400, x1 - x0) , this.h / Math.max(400, y1 - y0)) * 0.82, 0.01, 4);
    this.userMoved = false;
  }

  /* ---------- where each aircraft is ---------- */
  routes: { [k: string]: number[][] } = {};
  route(fromKey: string, toKey: string): number[][] {
    const rk = fromKey + '>' + toKey; if (this.routes[rk]) return this.routes[rk];
    return (this.routes[rk] = this.findRoute(fromKey, toKey));
  }
  findRoute(fromKey: string, toKey: string): number[][] {
    const g = this.graph; if (!g || !g.adj[fromKey] || !g.adj[toKey]) return [];
    const dist: { [k: string]: number } = { [fromKey]: 0 }, prev: { [k: string]: string } = {}, done: { [k: string]: boolean } = {};
    for (let guard = 0; guard < 20000; guard++) {
      let u: string = null, ud = 1e18; for (const k in dist) if (!done[k] && dist[k] < ud) { ud = dist[k]; u = k; }
      if (!u || u === toKey) break; done[u] = true;
      for (const [v, d] of g.adj[u] || []) if (!done[v] && ud + d < (dist[v] == null ? 1e18 : dist[v])) { dist[v] = ud + d; prev[v] = u; }
    }
    if (dist[toKey] == null) return [];
    const out: number[][] = []; let k = toKey;
    while (k) { out.unshift(this.nodeXY(k)); k = prev[k]; }
    return out;
  }
  /** Where taxiways join the runway in use: the taxi network's points on the runway, by distance along it. */
  joins: { k: string; along: number }[] = null;
  joinsBy: { [k: string]: { k: string; along: number }[] } = {};
  frames: { [k: string]: any } = {};
  /** The runway of this layout that matches a planned runway end (its threshold and direction). */
  frameFor(re: RunwayEnd): any {
    const L = this.L; if (!re || !L || !L.runways.length) return null;
    const key = re.name + '|' + Math.round(re.hdg);
    if (this.frames[key] !== undefined) return this.frames[key];
    const t = this.xy(re.thr[1], re.thr[0]);
    let best: any = null, bs = 1e18;
    for (const r of L.runways) for (const dir of [0, 1]) {
      const hd = (r.hdg + dir * 180) % 360, c = this.xy(r.lat, r.lon), h = hd * Math.PI / 180, ux = Math.sin(h), uy = Math.cos(h);
      const tx = c[0] - ux * r.len / 2, ty = c[1] - uy * r.len / 2;
      const sc = Math.abs(angDiff(hd, re.hdg)) * 60 + Math.hypot(tx - t[0], ty - t[1]);
      if (sc < bs) { bs = sc; best = { tx, ty, ux, uy, len: r.len, wid: r.wid || 45, name: (dir ? r.b : r.a) || re.name, wind: this.active ? this.active.wind : 0, windKt: this.active ? this.active.windKt : 0 }; }
    }
    // too far from any runway of this layout (a different layout source): use the planned end itself
    if (bs > 1500) { const e = this.xy(re.end[1], re.end[0]), len = Math.hypot(e[0] - t[0], e[1] - t[1]) || 2500; best = { tx: t[0], ty: t[1], ux: (e[0] - t[0]) / len, uy: (e[1] - t[1]) / len, len, wid: 45, name: re.name, wind: this.active ? this.active.wind : 0, windKt: this.active ? this.active.windKt : 0 }; }
    return (this.frames[key] = best);
  }
  runwayJoins(): { k: string; along: number }[] {
    if (this.joins) return this.joins;
    const jk = this.active ? this.active.name + '|' + Math.round(this.active.tx) : '';
    if (this.joinsBy[jk]) return (this.joins = this.joinsBy[jk]);
    const g = this.graph, A = this.active, out: { k: string; along: number }[] = [];
    if (g && A) for (const k in g.adj) {
      if (k[0] !== 'n') continue;
      const p = g.pts[+k.slice(1)], dx = p[0] - A.tx, dy = p[1] - A.ty;
      const along = dx * A.ux + dy * A.uy, across = Math.abs(dx * A.uy - dy * A.ux);
      if (along > -60 && along < A.len + 60 && across < Math.max(A.wid / 2 + 12, 30)) out.push({ k, along });
    }
    return (this.joins = this.joinsBy[jk] = out.sort((a, b) => a.along - b.along));
  }
  /** The point on the runway centre line level with a point of the taxi network. */
  onCentreline(k: string): number[] { const A = this.active, p = this.nodeXY(k), along = (p[0] - A.tx) * A.ux + (p[1] - A.ty) * A.uy; return [A.tx + A.ux * along, A.ty + A.uy * along]; }
  /** Every point of the taxi network that can be reached from one point (and how far). */
  reachCache: { [k: string]: { [k: string]: number } } = {};
  reach(fromKey: string): { [k: string]: number } {
    if (this.reachCache[fromKey]) return this.reachCache[fromKey];
    const g = this.graph, dist: { [k: string]: number } = { [fromKey]: 0 }, done: { [k: string]: boolean } = {};
    for (let guard = 0; guard < 20000; guard++) {
      let u: string = null, ud = 1e18; for (const k in dist) if (!done[k] && dist[k] < ud) { ud = dist[k]; u = k; }
      if (!u) break; done[u] = true;
      for (const [v, d] of (g.adj[u] || [])) if (!done[v] && ud + d < (dist[v] == null ? 1e18 : dist[v])) dist[v] = ud + d;
    }
    return (this.reachCache[fromKey] = dist);
  }
  /** After landing: roll on along the runway to a taxiway that leaves it, then follow the taxiways to a stand. */
  arrivalPath(endAlong: number, seed: string, big: boolean): number[][] {
    const A = this.active, exitPt = [A.tx + A.ux * endAlong, A.ty + A.uy * endAlong];
    const joins = this.runwayJoins(), ahead = joins.filter(j => j.along >= endAlong - 30), behind = joins.filter(j => j.along < endAlong - 30).reverse();
    for (const j of ahead.concat(behind)) {
      const stand = this.standFor(seed, big, j.k); if (!stand) continue;
      const r = this.route(j.k, stand); if (r.length < 2) continue;
      return [exitPt, this.onCentreline(j.k)].concat(r);
    }
    // no taxiway on the runway (a simple layout): the nearest point of the network, then the taxiways
    const exit = this.nearestNode(A.tx + A.ux * (endAlong + 80), A.ty + A.uy * (endAlong + 80)), stand = exit ? this.standFor(seed, big, exit) : null;
    return [exitPt].concat(exit && stand ? this.route(exit, stand) : []);
  }
  /** Leaving: from the stand along the taxiways onto the runway near its start, then to the threshold. */
  departurePath(seed: string, big: boolean): { path: number[][]; stand: string } {
    const A = this.active, joins = this.runwayJoins().filter(j => j.along < A.len * 0.5);
    for (const j of joins) {
      const stand = this.standFor(seed, big, j.k); if (!stand) continue;
      const r = this.route(stand, j.k); if (r.length < 2) continue;
      const on = this.onCentreline(j.k), path = r.concat([on]);
      if (Math.hypot(on[0] - A.tx, on[1] - A.ty) > 5) path.push([A.tx, A.ty]);
      return { path, stand };
    }
    const hold = this.nearestNode(A.tx + A.ux * 60, A.ty + A.uy * 60), stand = hold ? this.standFor(seed, big, hold) : null;
    return { path: stand && hold ? this.route(stand, hold).concat([[A.tx, A.ty]]) : [], stand };
  }
  /** Split a departure path at the holding point: about 50 m before the taxiway reaches the runway's edge
   *  (the hold-short line). The aircraft waits there, off the runway, until cleared to line up. */
  holdSplit(path: number[][]): { hold: number[][]; line: number[][] } {
    const A = this.active; if (!A || path.length < 2) return { hold: path, line: [] };
    const onRwy = (x: number, y: number) => { const dx = x - A.tx, dy = y - A.ty, al = dx * A.ux + dy * A.uy, ac = Math.abs(dx * A.uy - dy * A.ux); return al > -60 && al < A.len + 60 && ac < A.wid / 2 + 8; };
    // walk the path in 4 m steps, remembering the distance travelled, until it first touches the runway
    const pts: number[][] = [], cum: number[] = []; let d = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i], b = path[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / 4));
      for (let j = 0; j < n; j++) { const k = j / n; pts.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, i]); cum.push(d + L * k); }
      d += L;
    }
    pts.push([path[path.length - 1][0], path[path.length - 1][1], path.length - 1]); cum.push(d);
    let e = pts.findIndex(q => onRwy(q[0], q[1]));
    if (e <= 0) return { hold: path, line: [] };
    const want = Math.max(0, cum[e] - 50); let h = e; while (h > 0 && cum[h] > want) h--;
    const hp = pts[h], seg = hp[2];
    const hold = path.slice(0, seg + 1).concat([[hp[0], hp[1]]]), line = [[hp[0], hp[1]]].concat(path.slice(seg + 1));
    return { hold, line };
  }
  /** The heading of an aircraft parked at stand i: its nose wheel on the stop mark and its main wheels on the
   *  lead-in line behind it (a wheelbase back along the painted line), so both sit on the line, also where the
   *  line curves into the stand. Falls back to the stand's own heading where there is no line to follow. */
  standHdg(i: number, typeId: string): number {
    const g = this.graph, pk = g && g.parks[i]; if (!pk) return 0;
    const own = pk[2] || 0;
    if (g.schematic || !this.L || !this.L.paths) return own;
    const S0 = shapeOf(typeId), wb = S0 && S0.gear ? Math.max(1.5, S0.gear.main - S0.gear.nose) : 12;
    const adj: any = (this as any)._adjFull || ((this as any)._adjFull = (() => { const a: any = {}; const P = this.L.points;
      for (const p of this.L.paths) { const [type, , st, en] = p;
        if (type === 3) { (a['p' + en] = a['p' + en] || []).push('n' + st); (a['n' + st] = a['n' + st] || []).push('p' + en); }
        else if ((type === 9 || type === 1 || type === 4) && P[st] && P[en]) { (a['n' + st] = a['n' + st] || []).push('n' + en); (a['n' + en] = a['n' + en] || []).push('n' + st); } }
      return a; })());
    // walk back from the stand along the line, keeping straight on at each junction
    const S = [pk[0], pk[1]], line: number[][] = [S];
    let cur = 'p' + i, prev = '', run = 0, guard = 0;
    while (run < wb && guard++ < 40) {
      const nb: string[] = (adj[cur] || []).filter((k: string) => k !== prev && k[0] === 'n'); if (!nb.length) break;
      const here = this.nodeXY(cur), last = line.length > 1 ? line[line.length - 2] : null;
      let best = nb[0], bestTurn = 1e9;
      if (last) for (const k of nb) { const q = this.nodeXY(k), a1 = Math.atan2(here[0] - last[0], here[1] - last[1]), a2 = Math.atan2(q[0] - here[0], q[1] - here[1]); let d = Math.abs(a2 - a1) % (2 * Math.PI); if (d > Math.PI) d = 2 * Math.PI - d; if (d < bestTurn) { bestTurn = d; best = k; } }
      const q = this.nodeXY(best), seg = Math.hypot(q[0] - here[0], q[1] - here[1]);
      if (run + seg >= wb && seg > 0) { const t = (wb - run) / seg; line.push([here[0] + (q[0] - here[0]) * t, here[1] + (q[1] - here[1]) * t]); run = wb; break; }
      line.push(q); run += seg; prev = cur; cur = best;
    }
    if (run < Math.min(wb, 4)) return own;
    const Q = line[line.length - 1], h = (Math.atan2(S[0] - Q[0], S[1] - Q[1]) * 180 / Math.PI + 360) % 360;
    let d = Math.abs(h - own) % 360; if (d > 180) d = 360 - d;
    return d > 100 ? own : h;   // a line from an odd side: keep the stand's own heading
  }
  nodeXY(k: string): number[] { const g = this.graph, i = +k.slice(1); return k[0] === 'p' ? [g.parks[i][0], g.parks[i][1]] : [g.pts[i][0], g.pts[i][1]]; }
  nearestNode(x: number, y: number): string {
    const g = this.graph; let best: string = null, bd = 1e18;
    for (const k in g.adj) if (k[0] === 'n') { const p = g.pts[+k.slice(1)], d = (p[0] - x) ** 2 + (p[1] - y) ** 2; if (d < bd) { bd = d; best = k; } }
    return best;
  }
  /** The stand of an aircraft at this airport. It keeps the same stand from taxiing in, through the time it
   *  stands parked, until it pushes back for its next flight, and no two aircraft share a stand. With `from`,
   *  only a stand the taxiways lead to from there (null when its stand can't be reached from there). */
  standFor(reg: string, big: boolean, from?: string): string {
    const g = this.graph; if (!g || !g.parks.length) return null;
    const book = gateBook(this.icao, this.L), R = from ? this.reach(from) : null, linked = (i: number) => !!g.adj['p' + i];
    const mine = book[reg];
    if (mine && g.adj[mine]) return !R || R[mine] != null ? mine : null;
    const taken: { [k: string]: boolean } = {}; for (const r in book) if (r !== reg) taken[book[r]] = true;
    const sized = g.parks.map((p, i) => i).filter(i => linked(i) && (big ? [5, 8, 9, 10, 15].indexOf(g.parks[i][4]) >= 0 || g.schematic : [1, 2, 3, 4, 14, 11].indexOf(g.parks[i][4]) >= 0 || g.schematic));
    const pick = (list: number[]) => {
      if (!list.length) return null;
      const h = _hashStr(reg + this.icao) % list.length;
      for (let n = 0; n < list.length; n++) { const k = 'p' + list[(h + n) % list.length]; if (!taken[k] && (!R || R[k] != null)) return k; }
      return null;
    };
    const k = pick(sized) || pick(g.parks.map((p, i) => i).filter(linked));
    if (k) book[reg] = k;
    return k;
  }
  along(path: number[][], fr: number): number[] {
    if (!path.length) return null; if (path.length === 1) return [path[0][0], path[0][1], 0];
    let total = 0; const seg: number[] = []; for (let i = 1; i < path.length; i++) { const d = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); seg.push(d); total += d; }
    let want = clamp(fr, 0, 1) * total;
    for (let i = 0; i < seg.length; i++) {
      if (want <= seg[i] || i === seg.length - 1) { const k = seg[i] ? Math.min(1, want / seg[i]) : 0, a = path[i], b = path[i + 1];
        return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, Math.atan2(b[0] - a[0], b[1] - a[1]) * 180 / Math.PI]; }
      want -= seg[i];
    }
    return null;
  }
  /** Start and end (seconds into the flight) of a phase of the profile. */
  span(p: FlightProfile, ph: string): number[] {
    const pts = p.pts; let a = -1, b = -1;
    for (let i = 1; i < pts.length; i++) if (pts[i].ph === ph) { if (a < 0) a = pts[i - 1].s; b = pts[i].s; }
    return a < 0 ? null : [a, b];
  }

  /** The landing roll: speed over the ground at touchdown (m/s), braking (m/s²) to 15 kt, its length (m from the threshold) and time. */
  landingRoll(SP: any, hw: number, big: boolean): { v0: number; dec: number; t: number; end: number } {
    const A = this.active, v0 = Math.max(25, SP.vtd - hw) * KT, v1 = 15 * KT;
    // brake harder on a short runway, so the aircraft is down to taxi speed before 80% of it
    const room = Math.max(250, A.len * 0.8 - 400), dec = Math.max(big ? 1.7 : 1.4, (v0 * v0 - v1 * v1) / (2 * room));
    const t = (v0 - v1) / dec;
    return { v0, dec, t, end: 400 + v0 * t - 0.5 * dec * t * t };
  }
  /** A taxi route with speeds (knots) that follow it: 5-10 in tight turns and the last 100 m before the
   *  runway or stand, 15-25 on straight taxiways, up to about 30 on long straight ones; gentle speeding
   *  up and slowing down in between. Returns points every 10 m with the time (s) to reach each. */
  taxiTimed(path: number[][], v0kt: number, endKt: number): { p: number[][]; t: number[]; v: number[]; total: number } {
    const key = path.length ? path[0].join() + '>' + path[path.length - 1].join() + '|' + path.length + '|' + v0kt : '';
    const C: any = this.timedCache || (this.timedCache = {});
    if (C[key]) return C[key];
    const pts: number[][] = [], vmax: number[] = [];
    // resample every 10 m, remembering how sharp the turn is at each original corner
    const turnAt: number[] = path.map((q, i) => {
      if (i === 0 || i === path.length - 1) return 0;
      const a = Math.atan2(q[0] - path[i - 1][0], q[1] - path[i - 1][1]), b = Math.atan2(path[i + 1][0] - q[0], path[i + 1][1] - q[1]);
      return Math.abs(((b - a) * 180 / Math.PI + 540) % 360 - 180);
    });
    const segLen = (i: number) => Math.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1]);
    // length of the straight stretch each segment belongs to (bends under 20° count as straight)
    const straight: number[] = []; let run = 0, from = 0;
    for (let i = 0; i < path.length - 1; i++) {
      run += segLen(i);
      if (i === path.length - 2 || turnAt[i + 1] > 20) { for (let k = from; k <= i; k++) straight[k] = run; run = 0; from = i + 1; }
    }
    const cornerKt: { [i: number]: number } = {};
    path.forEach((q, i) => { const a = turnAt[i]; if (a > 60) cornerKt[i] = 8; else if (a > 30) cornerKt[i] = 12; else if (a > 15) cornerKt[i] = 18; });
    // round every corner into a curve (about 35 m turning radius, less where the stretches are short), so the
    // aircraft turns smoothly through it instead of pivoting at the node
    const rp: number[][] = [], rseg: number[] = [], rc: number[] = [];
    if (path.length) { rp.push(path[0].slice(0, 2)); rseg.push(0); rc.push(0); }
    for (let i = 1; i < path.length - 1; i++) {
      const P = path[i - 1], Q = path[i], N = path[i + 1], ang = turnAt[i];
      if (ang < 4) { rp.push(Q.slice(0, 2)); rseg.push(i); rc.push(0); continue; }
      const L1 = Math.hypot(Q[0] - P[0], Q[1] - P[1]) || 1, L2 = Math.hypot(N[0] - Q[0], N[1] - Q[1]) || 1;
      const th = Math.min(ang, 150) * Math.PI / 180, d = Math.min(35 * Math.tan(th / 2), 0.45 * Math.min(L1, L2));
      const T1 = [Q[0] - (Q[0] - P[0]) / L1 * d, Q[1] - (Q[1] - P[1]) / L1 * d], T2 = [Q[0] + (N[0] - Q[0]) / L2 * d, Q[1] + (N[1] - Q[1]) / L2 * d];
      const steps = Math.max(2, Math.ceil(2 * d / 3));
      for (let k = 0; k <= steps; k++) {
        const t = k / steps, a = (1 - t) * (1 - t), b = 2 * t * (1 - t), c = t * t;
        rp.push([a * T1[0] + b * Q[0] + c * T2[0], a * T1[1] + b * Q[1] + c * T2[1]]); rseg.push(t < 0.5 ? i - 1 : i); rc.push(cornerKt[i] || 0);
      }
    }
    if (path.length > 1) { rp.push(path[path.length - 1].slice(0, 2)); rseg.push(path.length - 2); rc.push(0); }
    for (let j = 0; j < rp.length - 1; j++) {
      const L = Math.hypot(rp[j + 1][0] - rp[j][0], rp[j + 1][1] - rp[j][1]), n = Math.max(1, Math.round(L / 10));
      const st = straight[rseg[j]] || 0, top = st > 700 ? 30 : st > 300 ? 25 : 18;
      for (let k = 0; k < n; k++) {
        const f = k / n; pts.push([rp[j][0] + (rp[j + 1][0] - rp[j][0]) * f, rp[j][1] + (rp[j + 1][1] - rp[j][1]) * f]);
        vmax.push(rc[j] && rc[j + 1] ? rc[j] : top);
      }
    }
    if (rp.length) { pts.push(rp[rp.length - 1]); vmax.push(endKt); }
    // the last 100 m before the runway or the stand: 5-10 kt
    let back = 0; for (let i = pts.length - 1; i > 0 && back < 100; i--) { vmax[i] = Math.min(vmax[i], back < 40 ? 6 : 9); back += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); }
    // speeding up and slowing down at about 0.6 m/s² and 1 m/s²
    const v = vmax.map(x => x * KT); v[0] = Math.min(v[0], v0kt * KT);
    for (let i = 1; i < v.length; i++) { const ds = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); v[i] = Math.min(v[i], Math.sqrt(v[i - 1] * v[i - 1] + 2 * 0.6 * ds)); }
    v[v.length - 1] = Math.min(v[v.length - 1], endKt * KT);
    for (let i = v.length - 2; i >= 0; i--) { const ds = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); v[i] = Math.min(v[i], Math.sqrt(v[i + 1] * v[i + 1] + 2 * 1.0 * ds)); }
    const t = [0];
    for (let i = 1; i < pts.length; i++) { const ds = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); t.push(t[i - 1] + ds / Math.max(0.8, (v[i] + v[i - 1]) / 2)); }
    return (C[key] = { p: pts, t, v: v.map(x => x / KT), total: t[t.length - 1] });
  }
  timedCache: any = null;
  _park: number[][][] = null; _parkL: AirportLayout = null;
  /** Where along a timed route the aircraft is after `s` seconds: [x, y, heading], and its speed. */
  timedAt(r: { p: number[][]; t: number[]; v: number[]; total: number }, s: number): { pos: number[]; kt: number } {
    const p = r.p; if (!p || !p.length) return null;
    // a path of a single point (a stand right on the taxiway): standing there
    if (p.length === 1 || !r.t || r.t.length < 2) return { pos: [p[0][0], p[0][1], 0], kt: 0 };
    if (s <= 0) { const h = p.length > 1 ? Math.atan2(p[1][0] - p[0][0], p[1][1] - p[0][1]) * 180 / Math.PI : 0; return { pos: [p[0][0], p[0][1], h], kt: 0 }; }
    const last = Math.min(r.t.length, p.length) - 1;
    let i = 1; while (i < last && r.t[i] < s) i++;
    const k = clamp((s - r.t[i - 1]) / ((r.t[i] - r.t[i - 1]) || 1), 0, 1), a = p[i - 1], b = p[i];
    // the heading turns gradually from one short piece to the next, so it never steps
    let hd = Math.atan2(b[0] - a[0], b[1] - a[1]) * 180 / Math.PI;
    if (i + 1 <= last && k > 0.5) { const c = p[i + 1], h2 = Math.atan2(c[0] - b[0], c[1] - b[1]) * 180 / Math.PI; hd += (((h2 - hd) + 540) % 360 - 180) * (k - 0.5); }
    else if (i >= 2 && k < 0.5) { const z = p[i - 2], h0 = Math.atan2(a[0] - z[0], a[1] - z[1]) * 180 / Math.PI; hd += (((h0 - hd) + 540) % 360 - 180) * (0.5 - k); }
    return { pos: [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, (hd + 360) % 360], kt: s >= r.total || !r.v || r.v[i] == null ? 0 : Math.round(r.v[i - 1] + (r.v[i] - r.v[i - 1]) * k) };
  }

  computePlanes(now: number) {
    (this as any).usedAt = now;
    const out: ApvPlane[] = [], L = this.L, g = this.graph, A0 = this.active;
    let A = A0;
    const icao = this.icao, typeOf = (f: any) => acType(flightTypeId(f));
    const spanOf = (t: AircraftType) => t.cls === 'ga' || t.cls === 'bush' ? 12 : t.cls === 'turboprop' ? 27 : t.seats > 300 ? 64 : t.seats > 200 ? 58 : t.seats > 100 ? 35 : 26;
    for (const f of liveOf()) {
      const F: any = f, t = typeOf(f), big = t.seats >= 60, prop = t.cls === 'bush' || t.cls === 'turboprop' || t.cls === 'ga';
      const base = { id: f.id, label: f.callsign, you: !!f.you, span: spanOf(t), prop, nose: noseWheelAhead(t.id) };
      // your flight: where the simulator has it
      if (f.you && f.real && Link.sim && Link.sim.lat) {
        const p = this.xy(Link.sim.lat, Link.sim.lon);
        if (Math.hypot(p[0], p[1]) < APV_RANGE) out.push(Object.assign(base, { x: p[0], y: p[1], hdg: Link.sim.hdg, alt: Link.sim.aglFt || 0, phase: f.phase || (Link.sim.onGround ? 'On the ground' : 'Flying'), kt: Link.sim.gs }));
        continue;
      }
      if (!A0 || !F.depAt || !g) continue;
      const prof: FlightProfile = F.coop ? flightProfile(F.typeId, f.from, f.to, F.depAt) : aiProfile(F);
      const fe = flightEl(F, now), el = fe.el;
      let pos: number[] = null, alt = 0, phase = '', kt = 0;
      // the speeds of this flight (docs/reference) and the wind along the runway in use
      const SP = flightSpeeds(flightTypeId(f), f.pax || Math.round(t.seats * 0.8), (() => { const A1 = apt(f.from), B1 = apt(f.noDest ? f.from : f.to); return A1 && B1 ? gcDistanceNm(A1.pos, B1.pos) : 300; })());
      // each flight uses the runway its own departure or approach was planned for (the wind can change the
      // runway in use while it flies; it still lands where its approach leads)
      const fpx = flightPathPos(F, now);
      const useRunway = (re: RunwayEnd) => { const fr = re ? this.frameFor(re) : null; A = fr || A0; this.active = A; this.joins = this.joinsBy[A.name + '|' + Math.round(A.tx)] || null; };
      let hw = 0, rwyHdg = 0, roll = 0, lift: number[] = null;
      const setRunway = (re: RunwayEnd) => { useRunway(re); rwyHdg = Math.atan2(A.ux, A.uy) * 180 / Math.PI; hw = headwind(A.wind, A.windKt, rwyHdg); roll = Math.min(A.len * 0.65, big ? 2200 : 700); lift = [A.tx + A.ux * roll, A.ty + A.uy * roll]; };
      setRunway(fpx && f.from === icao ? fpx.fp.dep : null);
      void lift;
      // departing from here
      if (f.from === icao) {
        const tx = this.span(prof, 'Taxi out'), to = this.span(prof, 'Takeoff'), cl = this.span(prof, 'Climb');
        if (tx && el < tx[1]) {
          const dp = this.departurePath(f.reg, big), stand = dp.stand, path = dp.path;
          const PUSH = 75;   // pushback: about 75 s at 3-5 kt, nose pointing the other way
          // taxi to the holding point before the runway, hold short until cleared, then line up
          const sp = this.holdSplit(path), rH = sp.hold.length > 1 ? this.taxiTimed(sp.hold, 0, 0) : null, rL = sp.line.length > 1 ? this.taxiTimed(sp.line, 0, 0) : null;
          const LINE = rL ? rL.total + 8 : 0, holdPt = sp.hold.length ? sp.hold[sp.hold.length - 1] : null;
          // it waits at the gate and pushes back in time to reach the holding point about a minute before its slot
          const need = path.length > 1 ? PUSH + (rH ? rH.total : 0) + 40 + LINE : 0, wait = Math.max(0, (tx[1] - tx[0]) - need);
          const sIn = el - tx[0] - wait, holdHdg = sp.hold.length > 1 ? Math.atan2(holdPt[0] - sp.hold[sp.hold.length - 2][0], holdPt[1] - sp.hold[sp.hold.length - 2][1]) * 180 / Math.PI : rwyHdg;
          const runwayHold = fe.hold && fe.hold.kind === 'runway';
          if (path.length > 1 && sIn < 0) { const k = this.nodeXY(stand), pk = g.parks[+stand.slice(1)]; pos = [k[0], k[1], pk ? this.standHdg(+stand.slice(1), t.id) : 0]; phase = 'At the gate, boarding'; kt = 0; }
          else if (path.length > 1 && sIn < PUSH) {
            const r = this.taxiTimed(path, 0, 0), q = this.timedAt(r, 0), back = Math.min(1, sIn / PUSH) * 35;
            const sp = this.along(path, Math.min(0.999, back / Math.max(1, r.p.length * 10)));
            pos = sp ? [sp[0], sp[1], ((sp[2] || q.pos[2]) + 180) % 360] : q.pos; phase = 'Pushback'; kt = sIn < PUSH - 10 ? 4 : 0;
          } else if (path.length > 1) {
            const sTaxi = sIn - PUSH + 35 / 4.5;   // continues where the pushback left off
            const lineAt = (tx[1] - tx[0]) - wait - LINE - PUSH + 35 / 4.5;   // when it is cleared to line up
            if (rH && sTaxi < rH.total && !runwayHold) { const q = this.timedAt(rH, sTaxi); pos = q.pos; kt = q.kt; phase = 'Taxi out'; }
            else if (!rL || runwayHold || sTaxi < lineAt) { pos = holdPt ? [holdPt[0], holdPt[1], holdHdg] : [A.tx, A.ty, rwyHdg]; kt = 0; phase = 'Holding short ' + (A.name || ''); }
            else { const q = this.timedAt(rL, sTaxi - lineAt); pos = q.pos; kt = q.kt; phase = 'Lining up ' + (A.name || ''); }
          } else { pos = [A.tx, A.ty, rwyHdg]; phase = 'Taxi out'; }
        } else if (to && el < to[1]) {
          // take-off roll: accelerate to rotation speed (over the ground: minus the headwind), lift off, climb at V2
          const vrGs = Math.max(20, SP.vr - hw) * KT, acc = big ? 2.0 : 2.4, tRoll = vrGs / acc, sIn = el - to[0];
          if (sIn < tRoll) { const d = 0.5 * acc * sIn * sIn; pos = [A.tx + A.ux * d, A.ty + A.uy * d, rwyHdg]; phase = 'Take-off roll'; kt = Math.round(acc * sIn / KT + hw); }
          else { const dRoll = 0.5 * acc * tRoll * tRoll, v2 = Math.max(20, SP.v2 - hw) * KT, d = dRoll + v2 * (sIn - tRoll); pos = [A.tx + A.ux * d, A.ty + A.uy * d, rwyHdg]; alt = Math.round((sIn - tRoll) * 30); phase = 'Lift-off'; kt = SP.v2; }
        } else if (cl) {
          const tt = el - (to ? to[1] : cl[0]), fpp = flightPathPos(F, now);
          if (fpp) { const q = this.xy(fpp.pos[1], fpp.pos[0]); if (Math.hypot(q[0], q[1]) < APV_RANGE) { pos = [q[0], q[1], fpp.hdg]; alt = Math.round(tt * 30); phase = fpp.fp.parts[0].name; kt = Math.min(250, SP.v2 + 10 + Math.round(tt * 0.6)); } }
          else { const d = tt * SP.v2 * KT; if (d < APV_RANGE) { pos = [A.tx + A.ux * d, A.ty + A.uy * d, rwyHdg]; alt = Math.round(tt * 30); phase = 'Climbing out'; kt = SP.v2 + 10; } }
        }
      }
      // arriving here
      if (!pos && f.to === icao && !f.noDest) {
        setRunway(fpx ? fpx.fp.arr : null);
        const ld = this.span(prof, 'Landing'), ti = this.span(prof, 'Taxi in');
        const td = ld ? ld[0] : prof.totalS;
        if (el < td) {
          const fpp = flightPathPos(F, now);
          if (fpp) {
            const q = this.xy(fpp.pos[1], fpp.pos[0]), dist = Math.hypot(q[0], q[1]), left = (fpp.fp.len - fpp.d) * NM;
            const part = fpp.fp.parts.filter(x => fpp.d >= x.from && fpp.d <= x.to + 0.01)[0];
            if (dist < APV_RANGE) { pos = [q[0], q[1], fpp.hdg]; alt = Math.round(Math.min(left * 0.0525 * 3.28, 6000)); phase = part && part.kind === 'app' ? (left < 10000 ? 'Final' : '') + (left < 10000 ? ' · ' : '') + part.name : part && part.kind === 'star' ? part.name : 'Approach'; kt = left < 600 ? SP.vthr : left < 12000 ? SP.vapp : Math.min(210, SP.vapp + Math.round((left - 12000) / 400)); }
          } else {
          const d = (td - el) * 72;
          if (d < APV_RANGE) { pos = [A.tx - A.ux * d, A.ty - A.uy * d, Math.atan2(A.ux, A.uy) * 180 / Math.PI]; alt = Math.round(d * 0.0525 * 3.28); phase = d < 6000 ? 'Final' : 'Approach'; kt = SP.vapp; }
          }
        } else if (ld && el >= ld[0]) {
          // landing: touch down about 400 m past the threshold, brake to taxi speed, then taxi to the stand
          const land = this.landingRoll(SP, hw, big), sIn = el - ld[0];
          if (sIn < land.t) {
            const v0 = land.v0, d = 400 + v0 * sIn - 0.5 * land.dec * sIn * sIn;
            pos = [A.tx + A.ux * d, A.ty + A.uy * d, rwyHdg]; phase = sIn < 2 ? 'Touchdown' : 'Landing roll'; kt = Math.round((v0 - land.dec * sIn) / KT + hw);
          } else {
            const path = this.arrivalPath(land.end, f.reg, big);
            const r = this.taxiTimed(path, 15, 0), q = this.timedAt(r, sIn - land.t);
            // then it stays at its stand (it becomes one of the parked aircraft when the flight is closed)
            if (q) { pos = q.pos; kt = q.kt; phase = sIn - land.t >= r.total ? 'At the gate' : 'Taxi in';
              // at the gate: nose wheel on the stop mark, main wheels on the lead-in line
              if (phase === 'At the gate') { const pi = g.parks.findIndex(pk => Math.hypot(pk[0] - pos[0], pk[1] - pos[1]) < 1.5); if (pi >= 0) pos = [pos[0], pos[1], this.standHdg(pi, t.id)]; } }
          }
        }
      }
      if (pos && fe.hold) { phase = holdLabel(fe.hold); if (fe.hold.kind === 'gate' || fe.hold.kind === 'runway') kt = 0; }
      if (pos) out.push(Object.assign(base, { x: pos[0], y: pos[1], hdg: pos[2] || 0, alt, phase, kt, rwy: A.name }));
      this.active = A0; this.joins = this.joinsBy[A0.name + '|' + Math.round(A0.tx)] || null; A = A0;
    }
    // the fleet's aircraft parked here
    const used: { [k: string]: boolean } = {}; out.forEach(p => used[p.id] = true);
    for (const a of fleetOf(State.companyId)) {
      if (a.location !== icao || a.status === 'flying' || State.live.some(f => f.reg === a.reg)) continue;
      const j0 = this.runwayJoins()[0], t = acType(a.typeId), st = this.standFor(a.reg, t.seats >= 60, j0 ? j0.k : undefined) || this.standFor(a.reg, t.seats >= 60); if (!st) continue;
      const k = this.nodeXY(st), park = g.parks[+st.slice(1)];
      out.push({ reg: a.reg, stype: park ? park[4] : 0, id: 'park-' + a.reg, x: k[0], y: k[1], hdg: park ? this.standHdg(+st.slice(1), a.typeId) : 0, alt: 0, phase: a.status === 'maintenance' || a.status === 'grounded' ? 'In maintenance' : 'Parked', label: a.reg, you: a.reg === (State as any).myReg[State.companyId], span: spanOf(t), nose: noseWheelAhead(t.id), prop: t.cls === 'bush' || t.cls === 'turboprop' || t.cls === 'ga', parked: true });
    }
    this.groundSmooth(out, now);
    this.planes = out;
    // stands are freed when their aircraft has left (taken off) or isn't here any more
    const book = gateBook(icao, L), here: { [r: string]: boolean } = {};
    for (const p of out) if (p.alt < 1 && !/take-off|lift-off|climb/i.test(p.phase)) here[p.parked ? p.id.slice(5) : (State.live.filter(f => f.id === p.id)[0] || {} as any).reg] = true;
    for (const r in book) if (!here[r]) delete book[r];
  }

  /** No aircraft ever jumps on the ground: when its place moves on further than it can roll (its route was worked out
   *  again from another point, the airport's layout got more detailed, it was shown elsewhere before), it rolls there
   *  at taxi speed instead. A move of kilometres is a placement (another airport's position before), taken as it is. */
  groundSmooth(out: ApvPlane[], now: number) {
    for (const p of out) {
      if (p.parked || p.you) continue;
      const prev = GroundSim.last[p.id], dt = prev ? (now - prev.t) / 1000 : 0;
      if (prev && dt > 0 && dt < 8 && (p.alt < 1 || prev.alt < 1)) {
        const q = this.xy(prev.ll[1], prev.ll[0]), d = Math.hypot(p.x - q[0], p.y - q[1]);
        const lim = Math.max(30, Math.max(p.kt || 0, prev.kt || 0) + 20) * KT * dt + 1;
        if (d > 3000) GroundSim.placed[p.id] = now;
        else if (d > lim) { const k = lim / d; p.x = q[0] + (p.x - q[0]) * k; p.y = q[1] + (p.y - q[1]) * k; p.hdg = (Math.atan2(p.x - q[0], p.y - q[1]) * 180 / Math.PI + 360) % 360; }
      } else if (!prev || dt >= 8) GroundSim.placed[p.id] = now;   // first seen by the airport model (or after a while away): set down where it is
      else if (prev && dt === 0) { const q = this.xy(prev.ll[1], prev.ll[0]); if (Math.hypot(p.x - q[0], p.y - q[1]) < 3000) { p.x = q[0]; p.y = q[1]; } }
      GroundSim.last[p.id] = { ll: this.lonLat(p.x, p.y), t: now, alt: p.alt || 0, kt: p.kt || 0 };
    }
  }

  /* ---------- drawing ---------- */
  loop(now: number) {
    if (!this.alive) return;
    this.raf = requestAnimationFrame(this.loop);
    if (!this.root.isConnected) { this.alive = false; _apv = null; return; }
    const r = this.host.getBoundingClientRect(); if (Math.abs(r.width - this.w) > 1 || Math.abs(r.height - this.h) > 1) this.size();
    if (!this.L) return;
    this.computePlanes(Date.now());
    // follow the tracked aircraft; hand over to the world map when it leaves the airport
    if (this.track) {
      const p = this.planes.filter(x => x.id === this.track)[0];
      if (p) { this.seen = true; if (!this.userMoved) { this.cx += (p.x - this.cx) * 0.12; this.cy += (p.y - this.cy) * 0.12; } }
      else if (this.seen && State.live.some(f => f.id === this.track) && this.fromWorld) { toast('The aircraft has left the airport, following it on the map', 'info'); this.close(true); return; }
    }
    this.draw(now);
    if (now - this.lastList > 1000) { this.lastList = now; this.renderList(); }
  }

  draw(now: number) {
    const c = this.ctx, L = this.L, s = this.s, col = this.col || { bg: cssVar('--map-bg'), line: cssVar('--line'), line2: cssVar('--line-2'), ink: cssVar('--ink'), dim: cssVar('--ink-2'), dim3: cssVar('--ink-3'), cyan: cssVar('--cyan'), mag: cssVar('--magenta'), green: cssVar('--green'), amber: cssVar('--amber'), panel: cssVar('--panel'), panel3: cssVar('--panel-3') };
    if (!this.embedded) {
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.fillStyle = col.bg; c.fillRect(0, 0, this.w, this.h);
    // dot grid every 100 m (or 500 m far out)
    const step = s > 0.12 ? 100 : 500, x0 = this.cx - this.w / 2 / s, x1 = this.cx + this.w / 2 / s, y0 = this.cy - this.h / 2 / s, y1 = this.cy + this.h / 2 / s;
    c.fillStyle = cssVar('--map-dot');
    if ((x1 - x0) / step < 160) for (let x = Math.ceil(x0 / step) * step; x < x1; x += step) for (let y = Math.ceil(y0 / step) * step; y < y1; y += step) { const p = this.scr(x, y); c.fillRect(p[0] - 0.8, p[1] - 0.8, 1.6, 1.6); }
    }
    const sat = this.embedded && State.settings.mapStyle === 'satellite';
    if (sat) c.globalAlpha = 0.62;
    const g = this.graph;
    // the paved parking areas (stands, lead-ins, taxilanes), then the mapped aprons and terminal buildings
    if (g && !g.schematic) {
      if (!this._park || this._parkL !== L) { this._park = layoutParkingFill(L); this._parkL = L; }
      c.fillStyle = '#0f2238'; c.beginPath();
      for (const poly of this._park) poly.forEach((q, i) => { const p = this.scr(q[0], q[1]); i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); });
      c.fill('nonzero');
    }
    for (const ar of L.areas || []) {
      c.beginPath(); ar.pts.forEach((q, i) => { const p = this.scr(q[0], q[1]); i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); }); c.closePath();
      if (ar.k === 'apron') { c.fillStyle = '#0f2238'; c.fill(); c.strokeStyle = 'rgba(147,169,193,.18)'; c.lineWidth = 1; c.stroke(); }
      else { c.fillStyle = '#1a3352'; c.fill(); c.strokeStyle = 'rgba(63,208,232,.35)'; c.lineWidth = 1; c.stroke(); }
    }
    // taxiways (wide pavement, then a centre line)
    if (g) {
      const paths = g.schematic ? null : L.paths;
      const drawSeg = (a: number[], b: number[], wm: number, fill: string) => { const p = this.scr(a[0], a[1]), q = this.scr(b[0], b[1]); c.strokeStyle = fill; c.lineWidth = Math.max(1.5, wm * s); c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]); c.stroke(); };
      c.lineCap = 'round';
      if (paths) {
        for (const p of paths) { const [type, wid, st, en] = p; if (type === 1 || type === 4) { const a = g.pts[st], b = g.pts[en]; if (a && b) drawSeg(a, b, wid || 20, '#1a3554'); } else if (type === 3 && L.source !== 'osm') { const a = g.pts[st], k = g.parks[en]; if (a && k) drawSeg(a, k, Math.max(10, wid || 15), '#16304d'); } }
        if (s > 0.25) { c.setLineDash([]); for (const p of paths) { const [type, , st, en] = p; if (type === 1 || type === 4) { const a = g.pts[st], b = g.pts[en]; if (a && b) drawSeg(a, b, 0.3 / s, 'rgba(242,179,61,.45)'); } } }
      } else {
        const seen: { [k: string]: boolean } = {};
        for (const k in g.adj) for (const [v] of g.adj[k]) { const key = k < v ? k + v : v + k; if (seen[key]) continue; seen[key] = true; drawSeg(this.nodeXY(k), this.nodeXY(v), 22, '#122840'); }
      }
      // painted stand lead-in lines (OpenStreetMap)
      if (paths && L.source === 'osm' && s > 0.12) {
        c.strokeStyle = 'rgba(242,179,61,.55)'; c.lineWidth = Math.max(1, 0.3 * s); c.beginPath();
        for (const p of paths) if (p[0] === 9) { const a = g.pts[p[2]], b = g.pts[p[3]]; if (a && b) { const q1 = this.scr(a[0], a[1]), q2 = this.scr(b[0], b[1]); c.moveTo(q1[0], q1[1]); c.lineTo(q2[0], q2[1]); } }
        c.stroke();
      }
      // stands: a lead-in line, a stop bar across it, and the stand's name in front
      g.parks.forEach((p, i) => {
        const q = this.scr(p[0], p[1]), r = p[3] || 15, h = (p[2] || 0) * Math.PI / 180, ux = Math.sin(h), uy = Math.cos(h);
        const at = (al: number, ac: number) => this.scr(p[0] + ux * al + uy * ac, p[1] + uy * al - ux * ac);
        if (g.schematic) { c.fillStyle = '#10243c'; c.beginPath(); c.arc(q[0], q[1], Math.max(2.5, r * s), 0, Math.PI * 2); c.fill(); }
        c.strokeStyle = 'rgba(242,179,61,.8)'; c.lineWidth = Math.max(1.2, 0.5 * s);
        if (L.source !== 'osm') { const b0 = at(-r * 2.2, 0); c.beginPath(); c.moveTo(b0[0], b0[1]); c.lineTo(q[0], q[1]); c.stroke(); }
        const half = Math.max(3 / s, r * 0.35), e1 = at(0, -half), e2 = at(0, half);
        c.lineWidth = Math.max(1.6, 0.9 * s); c.beginPath(); c.moveTo(e1[0], e1[1]); c.lineTo(e2[0], e2[1]); c.stroke();
        const name = L.parkNames && L.parkNames[i] ? L.parkNames[i] : p[6] ? standName(p) : '';
        if (name && s > 0.45) { const t = at(Math.max(6 / s, r * 0.45), 0); c.fillStyle = col.dim; c.font = `600 ${s > 1.5 ? 11 : 9.5}px Inter, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(name, t[0], t[1]); c.textBaseline = 'alphabetic'; }
      });
      c.textAlign = 'left';
    }
    c.globalAlpha = 1;
    // runways
    for (const r of L.runways) {
      const cc = this.xy(r.lat, r.lon), h = r.hdg * Math.PI / 180, ux = Math.sin(h), uy = Math.cos(h), px = Math.cos(h), py = -Math.sin(h);
      const corner = (a: number, b: number) => this.scr(cc[0] + ux * a + px * b, cc[1] + uy * a + py * b);
      const hl = r.len / 2, hw = Math.max(r.wid / 2, 1.5 / s);
      const act = this.active && Math.abs(Math.abs(((this.active.ux * ux + this.active.uy * uy))) - 1) < 1e-3 && Math.hypot(this.active.tx + this.active.ux * this.active.len / 2 - cc[0], this.active.ty + this.active.uy * this.active.len / 2 - cc[1]) < 5;
      c.fillStyle = r.surf === 1 ? '#1d3a2c' : r.surf === 9 ? '#123553' : '#1f3049';
      c.beginPath(); [[-hl, -hw], [hl, -hw], [hl, hw], [-hl, hw]].forEach((k, i) => { const p = corner(k[0], k[1]); i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); }); c.closePath(); c.fill();
      c.strokeStyle = act ? col.cyan : 'rgba(230,238,247,.55)'; c.lineWidth = act ? 1.6 : 1; c.stroke();
      // centre line and threshold bars
      if (s * r.wid > 6) {
        c.setLineDash([Math.max(3, 30 * s), Math.max(3, 20 * s)]); c.strokeStyle = 'rgba(230,238,247,.6)'; c.lineWidth = 1;
        const a = corner(-hl + 60, 0), b = corner(hl - 60, 0); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); c.setLineDash([]);
        for (const e of [-1, 1]) for (let k = -3; k <= 3; k++) { if (!k) continue; const o = (k / 3.6) * hw, p = corner(e * (hl - 8), o), q = corner(e * (hl - 40), o); c.strokeStyle = 'rgba(230,238,247,.6)'; c.lineWidth = Math.max(1, 1.8 * s); c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]); c.stroke(); }
      }
      // numbers at both ends
      c.font = '700 11px Inter, sans-serif'; c.textAlign = 'center';
      for (const [e, name] of [[-1, r.a], [1, r.b]] as [number, string][]) {
        if (!name) continue; const p = corner(e * (hl + 70 / Math.max(s, 0.05) * 0.02 + 30), 0);
        c.fillStyle = act && this.active.name === name ? col.cyan : col.dim; c.fillText(name, p[0], p[1] + 4);
      }
      c.textAlign = 'left';
    }
    // approach path to the active runway
    if (this.active) {
      const A = this.active, a = this.scr(A.tx, A.ty), b = this.scr(A.tx - A.ux * 12000, A.ty - A.uy * 12000);
      c.setLineDash([4, 6]); c.strokeStyle = 'rgba(224,75,214,.35)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); c.setLineDash([]);
    }
    // aircraft
    for (const p of this.planes) {
      const q = this.scr(p.x, p.y), size = Math.max(p.parked ? 14 : 19, p.span * s * 1.05);
      // on the ground the point is the nose wheel: the aircraft's middle is behind it
      if (p.nose && p.alt < 30) { const h = p.hdg * Math.PI / 180, f = this.scr(p.x + Math.sin(h) * p.nose, p.y + Math.cos(h) * p.nose); q[0] -= f[0] - q[0]; q[1] -= f[1] - q[1]; }
      const tracked = p.id === this.track;
      if (tracked) { const pulse = (now / 1000) % 1.6 / 1.6; c.beginPath(); c.arc(q[0], q[1], size * 0.7 + 6 + pulse * 14, 0, Math.PI * 2); c.strokeStyle = col.mag; c.globalAlpha = 0.6 * (1 - pulse); c.lineWidth = 1.5; c.stroke(); c.globalAlpha = 1; }
      if (p.alt > 50) { c.globalAlpha = 0.25; drawPlaneGlyph(c, q[0] + Math.min(18, p.alt / 120), q[1] + Math.min(18, p.alt / 120), p.hdg, size, p.prop, '#000', 'transparent'); c.globalAlpha = 1; }
      drawPlaneGlyph(c, q[0], q[1], p.hdg, size, p.prop, p.you ? col.cyan : p.parked ? col.dim : col.ink, col.bg);
      if (!p.parked || s > 0.5 || tracked) {
        c.font = '600 10.5px Inter, sans-serif';
        const text = p.label + (p.parked ? '' : ' · ' + p.phase + (p.kt ? ' · ' + p.kt + ' kt' : '')), w = c.measureText(text).width, lx = q[0] + size * 0.55 + 6, ly = q[1] - size * 0.4;
        c.fillStyle = 'rgba(6,16,30,.82)'; c.fillRect(lx - 4, ly - 10, w + 8, 15);
        c.fillStyle = p.you ? col.cyan : tracked ? col.mag : p.parked ? col.dim : col.ink; c.fillText(text, lx, ly + 1);
      }
    }
    try { this.drawWalkersTo(c, now); } catch (e) { /* never stop the drawing */ }
    if (this.embedded) return;
    // scale bar
    const m = [50, 100, 200, 500, 1000, 2000, 5000].filter(v => v * s >= 50)[0] || 5000;
    c.fillStyle = col.dim3; c.font = '500 10px Inter, sans-serif';
    c.fillRect(14, this.h - 18, m * s, 2); c.fillText(m >= 1000 ? m / 1000 + ' km' : m + ' m', 14, this.h - 24);
  }

  /* ---------- drawn inside the world map: prepared once, drawn in one go ---------- */
  pc: any = null;   // the static layout as ready-made shapes, in metres
  bbox: number[] = null;
  prepare() {
    const L = this.L, g = this.graph; if (!L || !g) return;
    const P = (pts: number[][], close?: boolean) => { const q = new Path2D(); pts.forEach((p, i) => i ? q.lineTo(p[0], p[1]) : q.moveTo(p[0], p[1])); if (close) q.closePath(); return q; };
    const pc: any = { aprons: new Path2D(), terms: new Path2D(), pave: {} as { [w: string]: Path2D }, centre: new Path2D(), lanes: new Path2D(), bars: new Path2D(), leads: new Path2D(), dots: new Path2D() };
    for (const ar of L.areas || []) (ar.k === 'apron' ? pc.aprons : pc.terms).addPath(P(ar.pts, true));
    pc.park = new Path2D(); if (!g.schematic) for (const poly of layoutParkingFill(L)) pc.park.addPath(P(poly, true));
    const seg = (to: Path2D, a: number[], b: number[]) => { to.moveTo(a[0], a[1]); to.lineTo(b[0], b[1]); };
    const pave = (w: number) => { const k = String(Math.max(5, Math.round(w / 5) * 5)); return pc.pave[k] || (pc.pave[k] = new Path2D()); };
    if (!g.schematic) {
      for (const p of L.paths) {
        const [type, wid, st, en] = p, a = g.pts[st];
        if (type === 1 || type === 4) { const b = g.pts[en]; if (a && b) { seg(pave(wid || 20), a, b); seg(pc.centre, a, b); } }
        else if (type === 3 && L.source !== 'osm') { const k = g.parks[en]; if (a && k) seg(pave(Math.max(10, wid || 15)), a, k); }
        else if (type === 9) { const b = g.pts[en]; if (a && b) seg(pc.lanes, a, b); }
      }
    } else {
      const seen: { [k: string]: boolean } = {};
      for (const k in g.adj) for (const [v] of g.adj[k]) { const key = k < v ? k + v : v + k; if (seen[key]) continue; seen[key] = true; seg(pave(22), this.nodeXY(k), this.nodeXY(v)); }
    }
    g.parks.forEach(p => {
      const r = p[3] || 15, h = (p[2] || 0) * Math.PI / 180, ux = Math.sin(h), uy = Math.cos(h);
      const at = (al: number, ac: number) => [p[0] + ux * al + uy * ac, p[1] + uy * al - ux * ac];
      seg(pc.bars, at(0, -r * 0.35), at(0, r * 0.35));
      if (L.source !== 'osm') seg(pc.leads, at(-r * 2.2, 0), [p[0], p[1]]);
      if (g.schematic) { pc.dots.moveTo(p[0] + r, p[1]); pc.dots.arc(p[0], p[1], r, 0, Math.PI * 2); }
    });
    // extent, for leaving out airports that are off-screen
    const xs: number[] = [], ys: number[] = [];
    const add = (q: number[]) => { xs.push(q[0]); ys.push(q[1]); };
    g.pts.forEach(add); g.parks.forEach(add); (L.areas || []).forEach(a => a.pts.forEach(add));
    for (const r of L.runways) { const c = this.xy(r.lat, r.lon), h = r.hdg * Math.PI / 180; add([c[0] + Math.sin(h) * r.len / 2, c[1] + Math.cos(h) * r.len / 2]); add([c[0] - Math.sin(h) * r.len / 2, c[1] - Math.cos(h) * r.len / 2]); }
    this.bbox = xs.length ? [Math.min.apply(null, xs) - 300, Math.min.apply(null, ys) - 300, Math.max.apply(null, xs) + 300, Math.max.apply(null, ys) + 300] : [-3000, -3000, 3000, 3000];
    this.pc = pc;
  }

  /** Is any part of the airport on screen? */
  onScreen(): boolean {
    if (!this.bbox) return true;
    const b = this.bbox, cs = [this.scr(b[0], b[1]), this.scr(b[2], b[1]), this.scr(b[0], b[3]), this.scr(b[2], b[3])], m = this.map;
    const x0 = Math.min(cs[0][0], cs[1][0], cs[2][0], cs[3][0]), x1 = Math.max(cs[0][0], cs[1][0], cs[2][0], cs[3][0]), y0 = Math.min(cs[0][1], cs[1][1], cs[2][1], cs[3][1]), y1 = Math.max(cs[0][1], cs[1][1], cs[2][1], cs[3][1]);
    return x1 >= 0 && y1 >= 0 && x0 <= m.w && y0 <= m.h;
  }

  /** The layout (runways, taxiways, stands): skipped when the airport is off-screen. `fade` 0-1. */
  drawLayoutEmbedded(c: CanvasRenderingContext2D, fade: number) {
    if (!this.L || !this.graph) return;
    if (!this.pc) this.prepare();
    if (!this.onScreen()) return;
    const s = this.s, col = this.col, L = this.L, pc = this.pc, dpr = this.map.dpr;
    const sat = State.settings.mapStyle === 'satellite';
    // the map's projection is a plain linear one at airport scale: metres -> screen
    const o = this.scr(0, 0), ex = this.scr(1000, 0), ey = this.scr(0, 1000);
    const a = (ex[0] - o[0]) / 1000, b = (ex[1] - o[1]) / 1000, cc = (ey[0] - o[0]) / 1000, d = (ey[1] - o[1]) / 1000;
    c.save();
    c.setTransform(a * dpr, b * dpr, cc * dpr, d * dpr, o[0] * dpr, o[1] * dpr);
    c.globalAlpha = fade * (sat ? 0.62 : 1);
    c.lineCap = 'round'; c.lineJoin = 'round';
    const px = (n: number) => n / s;   // n screen pixels, in metres
    c.fillStyle = '#0f2238'; if (pc.park) c.fill(pc.park, 'nonzero'); c.fill(pc.aprons); c.strokeStyle = 'rgba(147,169,193,.18)'; c.lineWidth = px(1); c.stroke(pc.aprons);
    c.fillStyle = '#1a3352'; c.fill(pc.terms); c.strokeStyle = 'rgba(63,208,232,.35)'; c.stroke(pc.terms);
    for (const w of Object.keys(pc.pave)) { c.strokeStyle = this.graph.schematic ? '#122840' : '#1a3554'; c.lineWidth = Math.max(px(1.5), +w); c.stroke(pc.pave[w]); }
    if (s > 0.25 && !this.graph.schematic) { c.strokeStyle = 'rgba(242,179,61,.45)'; c.lineWidth = px(1.5); c.stroke(pc.centre); }
    if (s > 0.12) { c.strokeStyle = 'rgba(242,179,61,.55)'; c.lineWidth = Math.max(px(1), 0.3); c.stroke(pc.lanes); }
    if (this.graph.schematic) { c.fillStyle = '#10243c'; c.fill(pc.dots); }
    c.strokeStyle = 'rgba(242,179,61,.8)'; c.lineWidth = Math.max(px(1.2), 0.5); c.stroke(pc.leads);
    c.lineWidth = Math.max(px(1.6), 0.9); c.stroke(pc.bars);
    c.restore();
    c.save(); c.globalAlpha = fade;
    // runways (a handful: drawn directly), stand names (only those on screen), approach line
    this.drawRunwaysTo(c, s, col);
    if (s > 0.45) {
      const g = this.graph, m = this.map;
      c.fillStyle = col.dim; c.font = `600 ${s > 1.5 ? 11 : 9.5}px Inter, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      g.parks.forEach((p, i) => {
        const name = L.parkNames && L.parkNames[i] ? L.parkNames[i] : p[6] ? standName(p) : ''; if (!name) return;
        const r = p[3] || 15, h = (p[2] || 0) * Math.PI / 180, al = Math.max(6 / s, r * 0.45), t = this.scr(p[0] + Math.sin(h) * al, p[1] + Math.cos(h) * al);
        if (t[0] < -20 || t[1] < -20 || t[0] > m.w + 20 || t[1] > m.h + 20) return;
        c.fillText(name, t[0], t[1]);
      });
      c.textBaseline = 'alphabetic'; c.textAlign = 'left';
    }
    c.restore();
  }

  drawRunwaysTo(c: CanvasRenderingContext2D, s: number, col: any) {
    const L = this.L;
    for (const r of L.runways) {
      const cc = this.xy(r.lat, r.lon), h = r.hdg * Math.PI / 180, ux = Math.sin(h), uy = Math.cos(h), px = Math.cos(h), py = -Math.sin(h);
      const corner = (a: number, b: number) => this.scr(cc[0] + ux * a + px * b, cc[1] + uy * a + py * b);
      const hl = r.len / 2, hw = Math.max(r.wid / 2, 1.5 / s);
      const act = this.active && Math.abs(Math.abs(((this.active.ux * ux + this.active.uy * uy))) - 1) < 1e-3 && Math.hypot(this.active.tx + this.active.ux * this.active.len / 2 - cc[0], this.active.ty + this.active.uy * this.active.len / 2 - cc[1]) < 5;
      c.fillStyle = r.surf === 1 ? '#1d3a2c' : r.surf === 9 ? '#123553' : '#1f3049';
      c.beginPath(); [[-hl, -hw], [hl, -hw], [hl, hw], [-hl, hw]].forEach((k, i) => { const p = corner(k[0], k[1]); i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); }); c.closePath(); c.fill();
      c.strokeStyle = act ? col.cyan : 'rgba(230,238,247,.55)'; c.lineWidth = act ? 1.6 : 1; c.stroke();
      if (s * r.wid > 6) {
        c.setLineDash([Math.max(3, 30 * s), Math.max(3, 20 * s)]); c.strokeStyle = 'rgba(230,238,247,.6)'; c.lineWidth = 1;
        const a = corner(-hl + 60, 0), b = corner(hl - 60, 0); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); c.setLineDash([]);
        c.lineWidth = Math.max(1, 1.8 * s); c.beginPath();
        for (const e of [-1, 1]) for (let k = -3; k <= 3; k++) { if (!k) continue; const o = (k / 3.6) * hw, p = corner(e * (hl - 8), o), q = corner(e * (hl - 40), o); c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]); }
        c.stroke();
      }
      c.font = '700 11px Inter, sans-serif'; c.textAlign = 'center';
      for (const [e, name] of [[-1, r.a], [1, r.b]] as [number, string][]) {
        if (!name) continue; const p = corner(e * (hl + 70 / Math.max(s, 0.05) * 0.02 + 30), 0);
        c.fillStyle = act && this.active.name === name ? col.cyan : col.dim; c.fillText(name, p[0], p[1] + 4);
      }
      c.textAlign = 'left';
    }
  }

  /** Passengers walking across the apron between the terminal and the aircraft door (boarding or
   *  deboarding), where there is no jet bridge: small airports such as Vágar, propeller and regional
   *  aircraft, ramp stands, and stands away from the terminal. Each wears the colours of their passenger
   *  card; dogs and cats walk beside their owners. At a jet bridge they are inside, out of sight. */
  drawWalkersTo(c: CanvasRenderingContext2D, now: number) {
    const s = this.s; if (s < 0.45 || !this.L) return;
    const L = this.L, terms = (L.areas || []).filter(a => a.k === 'terminal'), big = (typeof aptSize === 'function' ? aptSize(this.icao) : 1) >= 2;
    for (const p of this.planes) {
      if (!p.parked || !p.reg) continue;
      const a = plane(p.reg); if (!a) continue;
      const o = typeof onBoardParked === 'function' ? onBoardParked(a, Date.now()) : null; if (!o || !/^(Boarding|Deboarding)$/.test(o.stage)) continue;
      const t = acType(a.typeId), h = p.hdg * D2R, fx = Math.sin(h), fy = Math.cos(h), lx = -Math.cos(h), ly = Math.sin(h);
      const len = Math.max(8, p.span * 0.95), door = [p.x + fx * len * 0.36 + lx * 3.2, p.y + fy * len * 0.36 + ly * 3.2];
      // the terminal door: the nearest terminal edge, or ahead of the aircraft's nose
      let term: number[] = null, td = 1e9;
      for (const ar of terms) for (let i = 0; i < ar.pts.length; i++) {
        const A0 = ar.pts[i], B0 = ar.pts[(i + 1) % ar.pts.length], vx = B0[0] - A0[0], vy = B0[1] - A0[1], k = clamp(((door[0] - A0[0]) * vx + (door[1] - A0[1]) * vy) / (vx * vx + vy * vy || 1), 0, 1);
        const q = [A0[0] + vx * k, A0[1] + vy * k], d = Math.hypot(q[0] - door[0], q[1] - door[1]); if (d < td) { td = d; term = q; }
      }
      const gate = [8, 9, 10, 15].indexOf(p.stype || 0) >= 0, jetSize = t && (t.cls === 'airliner' || t.cls === 'widebody');
      if (big && gate && jetSize && (!term || td < 45)) continue;   // a jet bridge: inside, out of sight
      if (!term || td > 260) { if (big) continue; term = [door[0] + fx * 70 + lx * 25, door[1] + fy * 70 + ly * 25]; td = 75; }   // far: a bus at big airports
      // a stream along door → foot of the stairs → terminal, walking at about 1.3 m/s, 2.5 m apart
      const foot = [door[0] + lx * 4, door[1] + ly * 4], path = o.stage === 'Boarding' ? [term, foot, door] : [door, foot, term];
      const seg = [Math.hypot(path[1][0] - path[0][0], path[1][1] - path[0][1]), Math.hypot(path[2][0] - path[1][0], path[2][1] - path[1][1])], total = seg[0] + seg[1];
      const at = (d: number) => d <= seg[0] ? [path[0][0] + (path[1][0] - path[0][0]) * d / seg[0], path[0][1] + (path[1][1] - path[0][1]) * d / seg[0]] : [path[1][0] + (path[2][0] - path[1][0]) * (d - seg[0]) / (seg[1] || 1), path[1][1] + (path[2][1] - path[1][1]) * (d - seg[0]) / (seg[1] || 1)];
      const people = typeof walkersFor === 'function' ? walkersFor(a, o.stage) : [];
      if (!people.length) continue;
      const left = o.stage === 'Boarding' ? Math.max(0, people.length - o.pax) : o.pax;   // still to walk
      const shown = Math.min(left, Math.ceil(total / 2.5) + 1), head = (now / 1000) * 1.3;
      const r = Math.max(1.6, 0.32 * s);
      for (let i = 0; i < shown; i++) {
        const d = ((head - i * 2.5) % (total + 6) + total + 6) % (total + 6); if (d > total) continue;
        const pt = at(d), q = this.scr(pt[0], pt[1]), w = people[(Math.floor((head - i * 2.5) / (total + 6)) * shown + i) % people.length & 0xffff] || people[i % people.length];
        const bob = Math.sin(now / 160 + i) * 0.15 * r;
        c.beginPath(); c.ellipse(q[0], q[1] + bob, r * 1.05, r * 0.8, -h, 0, Math.PI * 2); c.fillStyle = w.cloth; c.fill();
        c.beginPath(); c.arc(q[0], q[1] + bob, r * 0.48, 0, Math.PI * 2); c.fillStyle = w.skin; c.fill();
        if (w.pet) { const pq = this.scr(pt[0] + lx * 0.9, pt[1] + ly * 0.9); c.beginPath(); c.ellipse(pq[0], pq[1] + bob * 0.5, r * 0.75, r * 0.42, -h, 0, Math.PI * 2); c.fillStyle = w.pet; c.fill(); }
      }
    }
  }
  /** The aircraft at the airport: always drawn, at full strength, whatever the zoom. */
  drawAircraftTo(c: CanvasRenderingContext2D, now: number) {
    const s = this.s, col = this.col;
    for (const p of this.planes) {
      const q = this.scr(p.x, p.y), size = Math.max(p.parked ? 14 : 19, p.span * s * 1.05);
      // on the ground the point is the nose wheel: the aircraft's middle is behind it
      if (p.nose && p.alt < 30) { const h = p.hdg * Math.PI / 180, f = this.scr(p.x + Math.sin(h) * p.nose, p.y + Math.cos(h) * p.nose); q[0] -= f[0] - q[0]; q[1] -= f[1] - q[1]; }
      if (q[0] < -60 || q[1] < -60 || q[0] > this.map.w + 60 || q[1] > this.map.h + 60) continue;
      const tracked = p.id === this.track;
      if (tracked) { const pulse = (now / 1000) % 1.6 / 1.6; c.beginPath(); c.arc(q[0], q[1], size * 0.7 + 6 + pulse * 14, 0, Math.PI * 2); c.strokeStyle = col.mag; c.globalAlpha = 0.6 * (1 - pulse); c.lineWidth = 1.5; c.stroke(); c.globalAlpha = 1; }
      if (p.alt > 50) { c.globalAlpha = 0.25; drawPlaneGlyph(c, q[0] + Math.min(18, p.alt / 120), q[1] + Math.min(18, p.alt / 120), p.hdg, size, p.prop, '#000', 'transparent'); c.globalAlpha = 1; }
      drawPlaneGlyph(c, q[0], q[1], p.hdg, size, p.prop, p.you ? col.cyan : p.parked ? col.dim : col.ink, col.bg);
      if (!p.parked || s > 0.5 || tracked) {
        c.font = '600 10.5px Inter, sans-serif';
        const text = p.label + (p.parked ? '' : ' · ' + p.phase + (p.kt ? ' · ' + p.kt + ' kt' : '')), w = c.measureText(text).width, lx = q[0] + size * 0.55 + 6, ly = q[1] - size * 0.4;
        c.fillStyle = 'rgba(6,16,30,.82)'; c.fillRect(lx - 4, ly - 10, w + 8, 15);
        c.fillStyle = p.you ? col.cyan : tracked ? col.mag : p.parked ? col.dim : col.ink; c.fillText(text, lx, ly + 1);
      }
    }
    try { this.drawWalkersTo(c, now); } catch (e) { /* never stop the drawing */ }
  }

  renderList() {
    const el = $('#apv-list'); if (!el) return;
    const moving = this.planes.filter(p => !p.parked);
    const away: any = this.track && !this.planes.some(p => p.id === this.track) ? State.live.filter(f => f.id === this.track)[0] : null;
    const awayHtml = away ? `<div class="apv-row away"><b>${esc(away.callsign)}</b><small>${esc(away.phase || 'Flying')}, ${away.from === this.icao ? 'has left ' + esc(this.icao) : away.to === this.icao ? 'on its way here' : 'not coming here'}${away.to === this.icao && Math.round((away.left || 0)) ? ' · ' + num(away.left) + ' nm to go' : ''}</small></div>` : '';
    el.innerHTML = awayHtml + (moving.length ? moving.map(p => `<button class="apv-row ${p.id === this.track ? 'on' : ''} ${p.you ? 'you' : ''}" data-act="apv-track" data-id="${esc(p.id)}"><b>${esc(p.label)}</b><small>${esc(p.phase)}${p.kt ? ` · ${p.kt} kt` : ''}${p.alt > 50 ? ` · ${num(p.alt)} ft` : ''}</small></button>`).join('')
      : `<p class="fine-print">No arrivals or departures right now.${this.planes.length ? ` ${this.planes.length} of your aircraft parked here.` : ''}</p>`);
  }

  /* ---------- touch and mouse ---------- */
  bind() {
    const cv = this.cv; cv.style.touchAction = 'none';
    cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); this.ptrs[e.pointerId] = { x: e.offsetX, y: e.offsetY }; this.moved = false; const ids = Object.keys(this.ptrs); if (ids.length === 2) { const a = this.ptrs[+ids[0]], b = this.ptrs[+ids[1]]; this.pinch0 = Math.hypot(a.x - b.x, a.y - b.y); this.s0 = this.s; } });
    cv.addEventListener('pointermove', e => {
      const p = this.ptrs[e.pointerId]; if (!p) return; const ids = Object.keys(this.ptrs);
      if (ids.length === 1) { const dx = e.offsetX - p.x, dy = e.offsetY - p.y; if (Math.abs(dx) + Math.abs(dy) > 3) { this.moved = true; this.userMoved = true; } this.cx -= dx / this.s; this.cy += dy / this.s; }
      p.x = e.offsetX; p.y = e.offsetY;
      if (ids.length === 2) { const a = this.ptrs[+ids[0]], b = this.ptrs[+ids[1]]; this.s = clamp(this.s0 * Math.hypot(a.x - b.x, a.y - b.y) / this.pinch0, 0.01, 6); this.moved = true; }
    });
    const up = (e: PointerEvent) => { if (!this.moved && Object.keys(this.ptrs).length === 1) this.tap(e.offsetX, e.offsetY); delete this.ptrs[e.pointerId]; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', e => { delete this.ptrs[e.pointerId]; });
    cv.addEventListener('wheel', e => { e.preventDefault(); this.zoom(e.deltaY < 0 ? 1.2 : 1 / 1.2, e.offsetX, e.offsetY); }, { passive: false } as any);
  }
  zoom(f: number, x?: number, y?: number) {
    x = x == null ? this.w / 2 : x; y = y == null ? this.h / 2 : y;
    const wx = this.cx + (x - this.w / 2) / this.s, wy = this.cy - (y - this.h / 2) / this.s;
    this.s = clamp(this.s * f, 0.01, 6);
    this.cx = wx - (x - this.w / 2) / this.s; this.cy = wy + (y - this.h / 2) / this.s;
  }
  tap(x: number, y: number) {
    let best: ApvPlane = null, bd = 30;
    for (const p of this.planes) { const q = this.scr(p.x, p.y), d = Math.hypot(q[0] - x, q[1] - y); if (d < bd) { bd = d; best = p; } }
    if (best && !best.parked) { this.track = best.id; this.userMoved = false; Sound.tick(); this.renderList(); }
  }
}

/** Which aircraft stands on which stand, per airport (for the layout in use). */
const _gateBooks: { [icao: string]: { src: string; book: { [reg: string]: string } } } = {};
function gateBook(icao: string, L: AirportLayout): { [reg: string]: string } {
  const src = L ? L.source + ':' + L.parks.length : '';
  const e = _gateBooks[icao];
  if (!e || e.src !== src) return (_gateBooks[icao] = { src, book: {} }).book;
  return e.book;
}

function standName(p: number[]): string {
  const n = p[5], num = p[6];
  if (n >= 12 && n <= 37) return String.fromCharCode(65 + n - 12) + num;   // GATE_A … GATE_Z
  return String(num || '');
}
function cssVar(n: string): string { return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#3FD0E8'; }

/** Go to an airport: the map flies down to it at its real place and shows its layout, still following the
 *  aircraft if one is given (it stays followed when it taxis out, takes off and flies on). */
function openAirportView(icao: string, track?: string) {
  const m = _curMap(); if (!m) return;
  if (_apv) _apv.close(false);
  m.closeBubble();
  m.flyToAirport(icao, track || m.following || null);
  Sound.tick();
}

ACTIONS['apv-close'] = () => { if (_apv) { const t = _apv.track; _apv.close(!!t); } };
ACTIONS['apv-zoom'] = el => { if (_apv) _apv.zoom(parseFloat(el.getAttribute('data-f'))); };
ACTIONS['apv-fit'] = () => { if (_apv) _apv.fit(); };
ACTIONS['apv-track'] = el => { if (_apv) { _apv.track = el.getAttribute('data-id'); _apv.userMoved = false; _apv.renderList(); Sound.tick(); } };
ACTIONS['apv-retry'] = () => {
  const v = _apv; if (!v) return;
  Sound.tick(); v.fetching = true; v.labelSource(); const note = $('#apv-note'); if (note) note.innerHTML = '';
  delete AirportLayouts.osmWhy[v.icao];
  AirportLayouts.fromOsm(v.icao).then(L => { if (!v.alive) return; v.fetching = false; if (L) { v.setLayout(L, true); toast('Real airport layout loaded', 'ok'); } else v.setLayout(v.L, true); })
    .catch(() => { if (v.alive) { v.fetching = false; v.setLayout(v.L, true); } });
};

const _aptScenes: { [icao: string]: AirportView } = {};
/** An airport drawn inside the world map: its layout loads in the background (runways first). */
function makeAirportScene(icao: string, map: WorldMap): AirportView {
  // one scene per airport for the whole app (the maps, the 3D view and the ground model share it), so an aircraft on
  // the ground is in one place whatever shows it
  const had = _aptScenes[icao]; if (had && had.alive) { if (map) had.map = map; (had as any).usedAt = Date.now(); return had; }
  const v: AirportView = Object.create(AirportView.prototype); _aptScenes[icao] = v; (v as any).usedAt = Date.now();
  Object.assign(v, { embedded: true, map, icao, alive: true, track: null, planes: [], routes: {}, reachCache: {}, joins: null, joinsBy: {}, frames: {}, ptrs: {}, s: 1, w: 0, h: 0, cx: 0, cy: 0, fetching: true,
    col: { bg: cssVar('--map-bg'), line: cssVar('--line'), line2: cssVar('--line-2'), ink: cssVar('--ink'), dim: cssVar('--ink-2'), dim3: cssVar('--ink-3'), cyan: cssVar('--cyan'), mag: cssVar('--magenta'), green: cssVar('--green'), amber: cssVar('--amber'), panel: cssVar('--panel'), panel3: cssVar('--panel-3') } });
  AirportLayouts.get(icao, L => { if (L && v.alive) v.setLayout(L, true); v.fetching = false; }).then(L => { if (v.alive && L && (!v.L || v.L.source === 'runways' || L.source !== 'runways')) v.setLayout(L); });
  return v;
}
