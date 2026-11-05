// Airport layouts for the airport view, best first:
//  1. Linked to the simulator: the simulator's own layout through the PC app (runways, taxiways, stands
//     and gates exactly as Microsoft Flight Simulator has them, add-on scenery included).
//  2. The real airport from OpenStreetMap (© OpenStreetMap contributors, ODbL): runways, taxiways,
//     taxilanes, aprons, terminals and numbered stands. Downloaded once per airport (usually 20-300 KB)
//     and kept on the device, so it is only fetched again after three months.
//  3. Offline, or where OpenStreetMap has nothing: the airport's real runways from the world airport data.

interface AirportLayout {
  icao: string; name: string; lat: number; lon: number; alt: number; magvar: number;
  runways: { lat: number; lon: number; hdg: number; len: number; wid: number; surf: number; a: string; b: string }[];
  points: number[][];   // [east m, north m, type]
  parks: number[][];    // [east m, north m, heading, radius m, type, name code, number]
  paths: number[][];    // [type, width m, start, end, name index, runway number, runway designator]
  names: string[];
  parkNames?: string[];                                  // stand names ("A12", "214") where known
  areas?: { k: 'apron' | 'terminal'; pts: number[][] }[]; // aprons and terminal buildings (metres)
  source: 'sim' | 'osm' | 'runways';
  gen?: boolean;                                         // taxiways laid out from the runways (not mapped)
}

/** Does a layout belong to the airport it is for? Its middle and its runways must be at that airport (within
 *  12 km). If not, it is another airport's (a mix-up in reading it): error APT-01 in Settings > Updates and errors. */
function layoutFits(icao: string, l: AirportLayout, from: string): boolean {
  const a: any = apt(icao); if (!a || !l) return true;
  const far = (lat: number, lon: number) => lat || lon ? gcDistanceNm([lon, lat], a.pos) * 1.852 : 0;
  const dMid = far(l.lat, l.lon), dRw = Math.max(0, ...(l.runways || []).map(r => far(r.lat, r.lon)));
  if (dMid <= 12 && dRw <= 12) return true;
  try {
    ErrorLog.add('3d', `APT-01 · ${a.name || icao}: another airport's layout`,
      `The layout ${from === 'sim' ? 'Flight Simulator gave' : 'kept on this device'} for ${icao} lies ${Math.round(Math.max(dMid, dRw))} km from ${a.name || icao}${l.name ? ` (it says "${l.name}")` : ''}. It was not used: the right one is read again.`,
      [`Code: APT-01 (layout belongs to another place)`, `Airport: ${icao} ${a.name || ''} at ${a.pos[1].toFixed(4)}, ${a.pos[0].toFixed(4)}`,
        `Layout: source ${l.source}, from ${from}, name "${l.name || ''}", centre ${(+l.lat || 0).toFixed(4)}, ${(+l.lon || 0).toFixed(4)} (${dMid.toFixed(1)} km away), ${(l.runways || []).length} runways (farthest ${dRw.toFixed(1)} km away)`,
        `Runways: ${(l.runways || []).map(r => `${r.a}/${r.b}`).join(', ')}`, `App ${APP.version}, linked: ${Link.status}`].join('\n'));
  } catch (e) { /* no log */ }
  return false;
}

const AirportLayouts = {
  cache: {} as { [icao: string]: AirportLayout },
  waiting: {} as { [icao: string]: { ok: (l: AirportLayout) => void; timer: any }[] },

  /** The best layout to show right now (straight away: the real runways if nothing better is kept), and
   *  `better` is called when a fuller one arrives: the simulator's when linked, else OpenStreetMap's;
   *  or with null when there is nothing better to come. */
  get(icao: string, better?: (l: AirportLayout) => void): Promise<AirportLayout> {
    icao = String(icao || '').toUpperCase();
    let c0 = this.cache[icao] || this.kept(icao);
    if (c0 && !layoutFits(icao, c0, 'kept')) { c0 = null; this.forget(icao); }
    if (c0) return this.getWith(icao, c0, better);
    return LayoutDb.get(icao).then(l => { if (l && !layoutFits(icao, l, 'kept')) { l = null; this.forget(icao); } if (l) this.cache[icao] = l; return this.getWith(icao, l, better); });
  },
  /** A kept layout that turned out to be another airport's: gone, so the right one is read again. */
  forget(icao: string) {
    delete this.cache[icao];
    for (const k of ['amp-sim:' + icao, 'amp-osm:' + icao]) try { localStorage.removeItem(k); } catch (e) { /* none */ }
    try { LayoutDb.del(icao); } catch (e) { /* none */ }
  },
  getWith(icao: string, c: AirportLayout, better?: (l: AirportLayout) => void): Promise<AirportLayout> {
    const linked = Link.status === 'connected';
    if (c && (c.source === 'sim' || (!linked && c.source === 'osm'))) return Promise.resolve(c);
    const now = c ? Promise.resolve(c) : this.fromRunways(icao);
    now.then(first => {
      const upgrade = (l: AirportLayout) => { if (better) better(l && l !== first && l.source !== 'runways' ? l : null); };
      const viaOsm = () => (c && c.source === 'osm' ? Promise.resolve(c) : this.fromOsm(icao)).then(l => upgrade(l && (!c || c.source !== 'osm') ? l : null)).catch(() => upgrade(null));
      if (linked && linkSend({ type: 'layout', icao })) {
        const w = { ok: (l: AirportLayout) => { if (l && l.source === 'sim') upgrade(l); else viaOsm(); }, timer: setTimeout(() => this.received(icao, null, 'timeout'), 20000) };   // the PC app gives the simulator 15 s
        (this.waiting[icao] = this.waiting[icao] || []).push(w);
      } else viaOsm();
    });
    return now;
  },

  /** A layout kept on the device from an earlier download. */
  kept(icao: string): AirportLayout {
    // the simulator's layout (saved when the app was linked) first, then OpenStreetMap's
    for (const key of ['amp-sim:' + icao, 'amp-osm:' + icao]) {
      try { const k = JSON.parse(localStorage.getItem(key) || 'null'); if (k && k.l && (key.indexOf('amp-sim') === 0 || Date.now() - k.at < this.OSM_KEEP_MS)) return (this.cache[icao] = k.l); } catch (e) { /* none */ }
    }
    return null;
  },

  /** The PC app answered (a layout, or why there isn't one). */
  received(icao: string, layout: any, error?: string) {
    icao = String(icao || '').toUpperCase();
    const ws = this.waiting[icao] || []; delete this.waiting[icao];
    ws.forEach(w => clearTimeout(w.timer));
    let l: AirportLayout = null;
    if (layout && (layout.runways || []).length) {
      l = Object.assign({ points: [], parks: [], paths: [], names: [] }, layout, { icao, source: 'sim' as const });
      if (!layoutFits(icao, l, 'sim')) l = null;   // another airport's layout: not used, and noted in the error log
      else { this.cache[icao] = l; LayoutDb.put(icao, l); }
    }
    ws.forEach(w => w.ok(l));
    // it came after the app had stopped waiting, for the airport in the 3D view: drawn now (not only next time)
    if (!ws.length && l) { try { const VP: any = V3d; if (V3d.open && V3d.icao === icao && (!VP.lastL || VP.lastL.source !== 'sim')) { V3d.elev = l.alt || 0; v3dBuildAirport(l); } } catch (e) { /* not open */ } }
  },

  /** A layout with the airport's real runways (world airport data), when the simulator can't give one. */
  fromRunways(icao: string): Promise<AirportLayout> {
    return World.loadRunways().then(rw => {
      const a: any = apt(icao);
      const l: AirportLayout = { icao, name: a ? a.name : icao, lat: a ? a.pos[1] : 0, lon: a ? a.pos[0] : 0, alt: a && a.elev ? a.elev * 0.3048 : 0, magvar: 0,
        runways: [], points: [], parks: [], paths: [], names: [], source: 'runways' };
      for (const r of (rw[icao] || []) as any[]) {
        const [id1, id2, lenFt, widFt, surf, la1, lo1, la2, lo2, hdg1] = r;
        let lat: number, lon: number, hdg: number, len = (lenFt || 0) * 0.3048;
        if (la1 != null && la2 != null) {
          lat = (la1 + la2) / 2; lon = (lo1 + lo2) / 2;
          const k = Math.cos(lat * Math.PI / 180), dx = (lo2 - lo1) * k, dy = la2 - la1;
          hdg = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
          if (!len) len = Math.hypot(dx, dy) * 111120;
        } else if (a && (hdg1 != null || /^\d{1,2}/.test(id1))) {
          // no runway ends in the data: centred on the airport, heading from its number
          lat = a.pos[1]; lon = a.pos[0]; hdg = hdg1 != null ? hdg1 : (parseInt(id1, 10) || 0) * 10;
        } else continue;
        if (!len) continue;
        l.runways.push({ lat, lon, hdg, len, wid: Math.max(18, (widFt || 100) * 0.3048), surf: /ASP|CON|BIT|PEM/i.test(surf || '') ? 4 : /GRS|TURF|GRASS/i.test(surf || '') ? 1 : /WAT/i.test(surf || '') ? 9 : 2, a: String(id1 || ''), b: String(id2 || '') });
      }
      try { layoutGenerate(l, a); } catch (e) { /* the runways alone */ }
      this.cache[icao] = l;
      return l;
    });
  },

  /* ---------- OpenStreetMap ---------- */
  OSM_SERVERS: ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'],
  /** Why the last OpenStreetMap download for an airport gave nothing: 'busy' (no server answered) or 'none' (not mapped). */
  osmWhy: {} as { [icao: string]: 'busy' | 'none' },
  OSM_KEEP_MS: 90 * 864e5,

  fromOsm(icao: string): Promise<AirportLayout> {
    const key = 'amp-osm:' + icao;
    const kept = this.kept(icao); if (kept) return Promise.resolve(kept);
    if (navigator.onLine === false) return Promise.resolve(null);
    const a: any = apt(icao); if (!a) return Promise.resolve(null);
    return World.loadRunways().then(() => this.osmFetch(icao, a, key));
  },

  osmFetch(icao: string, a: any, key: string): Promise<AirportLayout> {
    // a box around the airport, sized from its runways: much quicker for the server than an outline search
    const k = Math.cos(a.pos[1] * Math.PI / 180);
    let far = 1500;
    for (const r of ((World.runways || {})[icao] || []) as any[]) for (const e of [[r[5], r[6]], [r[7], r[8]]]) if (e[0] != null) far = Math.max(far, Math.hypot((e[1] - a.pos[0]) * 111320 * k, (e[0] - a.pos[1]) * 110540));
    const R = Math.min(9000, far + 1200), dLat = R / 110540, dLon = R / (111320 * k);
    const bb = [a.pos[1] - dLat, a.pos[0] - dLon, a.pos[1] + dLat, a.pos[0] + dLon].map(v => v.toFixed(5)).join(',');
    const q = `[out:json][timeout:25][bbox:${bb}];(way["aeroway"~"^(runway|taxiway|taxilane|apron|parking_position|terminal)$"];node["aeroway"~"^(parking_position|gate)$"];);out body geom qt;`;
    return this.overpass(q).then(d => {
      const l = d ? this.parseOsm(icao, a, d.elements || []) : null;
      if (!d) this.osmWhy[icao] = 'busy'; else if (!l) this.osmWhy[icao] = 'none'; else delete this.osmWhy[icao];
      if (!l) return null;
      this.cache[icao] = l;
      this.keep(key, l);
      return l;
    });
  },

  overpass(q: string, n = 0, round = 0): Promise<any> {
    const url = this.OSM_SERVERS[n];
    // every server busy: one more round after a short pause
    if (!url) return round ? Promise.resolve(null) : new Promise(ok => setTimeout(ok, 3000)).then(() => this.overpass(q, 0, 1));
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const t = setTimeout(() => ctl && ctl.abort(), 20000);
    return fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: ctl ? ctl.signal : undefined } as any)
      .then(r => { clearTimeout(t); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(d => { if (d && d.remark && /timed out|runtime error|out of memory/i.test(d.remark) && !(d.elements || []).length) throw new Error(d.remark); return d; })
      .catch(() => { clearTimeout(t); return this.overpass(q, n + 1, round); });
  },

  /** Keep up to 30 airports on the device, the oldest go first. */
  keep(key: string, l: AirportLayout) {
    try {
      const idx: string[] = JSON.parse(localStorage.getItem('amp-osm-index') || '[]').filter((k: string) => k !== key);
      idx.push(key);
      while (idx.length > 30) localStorage.removeItem(idx.shift());
      localStorage.setItem(key, JSON.stringify({ at: Date.now(), l }));
      localStorage.setItem('amp-osm-index', JSON.stringify(idx));
    } catch (e) { /* storage full: kept for this session only */ }
  },

  /** Runways mapped in several pieces become one; short unnamed pieces lying on a runway (pads, displaced
   *  thresholds) are dropped. */
  joinRunways(list: AirportLayout['runways']): AirportLayout['runways'] {
    const k = Math.cos((list[0] ? list[0].lat : 0) * Math.PI / 180);
    const ends = (r: any) => { const h = r.hdg * Math.PI / 180, dLat = Math.cos(h) * r.len / 2 / 110540, dLon = Math.sin(h) * r.len / 2 / (111320 * k); return [[r.lat - dLat, r.lon - dLon], [r.lat + dLat, r.lon + dLon]]; };
    const groups: { [key: string]: any[] } = {}, loose: any[] = [];
    for (const r of list) { const key = [r.a, r.b].filter(Boolean).sort().join('|'); if (key) (groups[key] = groups[key] || []).push(r); else loose.push(r); }
    // unnamed pieces lying in line with a named runway are part of it
    const named = Object.keys(groups).map(key => ({ key, r: groups[key].slice().sort((x, y) => y.len - x.len)[0] }));
    const lying = (r: any, o: any) => { const dx = (r.lon - o.lon) * 111320 * k, dy = (r.lat - o.lat) * 110540, h = o.hdg * Math.PI / 180;
      const along = dx * Math.sin(h) + dy * Math.cos(h), across = Math.abs(dx * Math.cos(h) - dy * Math.sin(h));
      const par = Math.abs((((r.hdg - o.hdg) % 180) + 270) % 180 - 90) < 5;
      return par && across < Math.max(30, o.wid) && Math.abs(along) < o.len / 2 + r.len / 2 + 80; };
    for (const r of loose.slice()) { const n = named.filter(x => lying(r, x.r))[0]; if (n) { groups[n.key].push(r); loose.splice(loose.indexOf(r), 1); } }
    const out: any[] = [];
    for (const key of Object.keys(groups)) {
      const g = groups[key]; if (g.length === 1) { out.push(g[0]); continue; }
      const pts: number[][] = []; g.forEach(r => pts.push.apply(pts, ends(r)));
      let A = pts[0], B = pts[1], best = 0;
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) { const d = (pts[i][0] - pts[j][0]) ** 2 + ((pts[i][1] - pts[j][1]) * k) ** 2; if (d > best) { best = d; A = pts[i]; B = pts[j]; } }
      const ref = g.slice().sort((x, y) => y.len - x.len)[0];
      let hdg = (Math.atan2((B[1] - A[1]) * k, B[0] - A[0]) * 180 / Math.PI + 360) % 360;
      if (Math.abs((((hdg - ref.hdg) % 360) + 540) % 360 - 180) > 90) { const t = A; A = B; B = t; hdg = (hdg + 180) % 360; }
      out.push(Object.assign({}, ref, { lat: (A[0] + B[0]) / 2, lon: (A[1] + B[1]) / 2, hdg, len: Math.round(Math.sqrt(best) * 110540), wid: Math.max.apply(null, g.map(r => r.wid)) }));
    }
    // other unnamed pieces: kept when long enough to be a runway of their own
    for (const r of loose) if (r.len >= 600 && !out.some(o => lying(r, o))) out.push(r);
    return out;
  },

  /** OpenStreetMap elements → layout, in metres east and north of the airport's reference point. */
  parseOsm(icao: string, a: any, els: any[]): AirportLayout {
    const lat0 = a.pos[1], lon0 = a.pos[0], k = Math.cos(lat0 * Math.PI / 180);
    const xy = (g: any) => [Math.round((g.lon - lon0) * 111320 * k * 10) / 10, Math.round((g.lat - lat0) * 110540 * 10) / 10];
    const l: AirportLayout = { icao, name: a.name, lat: lat0, lon: lon0, alt: a.elev ? a.elev * 0.3048 : 0, magvar: 0, runways: [], points: [], parks: [], paths: [], names: [''], parkNames: [], areas: [], source: 'osm' };
    const pIdx: { [id: string]: number } = {}, use: { [id: string]: number } = {};
    const ways = els.filter(e => e.type === 'way' && e.geometry && e.geometry.length >= 2 && e.tags);
    ways.forEach(w => (w.nodes || []).forEach((n: number) => use[n] = (use[n] || 0) + 1));
    const pt = (id: number, g: any, type: number) => { const key = String(id); if (pIdx[key] == null) { l.points.push(xy(g).concat([type])); pIdx[key] = l.points.length - 1; } return pIdx[key]; };
    const widthOf = (w: any, d: number) => { const v = parseFloat(String((w.tags.width || '')).replace(',', '.')); return v > 3 && v < 120 ? v : d; };
    const nameIdx = (n: string) => { if (!n) return 0; let i = l.names.indexOf(n); if (i < 0) { l.names.push(n); i = l.names.length - 1; } return i; };
    const closed = (w: any) => w.nodes && w.nodes.length > 3 && w.nodes[0] === w.nodes[w.nodes.length - 1];
    const addPark = (x: number, y: number, hdg: number, ref: string, big: boolean) => { l.parks.push([x, y, Math.round(((hdg % 360) + 360) % 360), big ? 20 : 12, big ? 9 : 2, 0, 0]); l.parkNames.push(ref || ''); return l.parks.length - 1; };
    const standWays: any[] = [];
    for (const w of ways) {
      const t = w.tags.aeroway, g = w.geometry;
      if (t === 'runway') {
        let A = g[0], B = g[g.length - 1];
        if (closed(w)) { let best = 0; for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) { const d = (g[i].lat - g[j].lat) ** 2 + ((g[i].lon - g[j].lon) * k) ** 2; if (d > best) { best = d; A = g[i]; B = g[j]; } } }
        const pa = xy(A), pb = xy(B), len = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]); if (len < 150) continue;
        let hdg = (Math.atan2(pb[0] - pa[0], pb[1] - pa[1]) * 180 / Math.PI + 360) % 360;
        const refs = String(w.tags.ref || '').split('/').map((x: string) => x.trim());
        let ra = refs[0] || '', rb = refs[1] || '';
        const num = parseInt(ra, 10);
        // the end called "09" is the one you take off from heading about 090
        if (num && Math.abs((((num * 10 - hdg) % 360) + 540) % 360 - 180) > 90) { const tt = ra; ra = rb; rb = tt; }
        const surf = String(w.tags.surface || 'asphalt');
        l.runways.push({ lat: (A.lat + B.lat) / 2, lon: (A.lon + B.lon) / 2, hdg, len: Math.round(len), wid: widthOf(w, 45), surf: /grass|ground|dirt|gravel|sand/.test(surf) ? 1 : /water/.test(surf) ? 9 : 4, a: ra, b: rb });
        if (!closed(w)) for (let i = 1; i < g.length; i++) l.paths.push([2, widthOf(w, 45), pt(w.nodes[i - 1], g[i - 1], 2), pt(w.nodes[i], g[i], 2), 0, 0, 0]);
      } else if (t === 'taxiway' || t === 'taxilane') {
        if (closed(w)) continue;   // a taxiway drawn as an area
        const wid = widthOf(w, t === 'taxiway' ? 23 : 15), ni = nameIdx(w.tags.ref || '');
        for (let i = 1; i < g.length; i++) l.paths.push([t === 'taxiway' ? 1 : 4, wid, pt(w.nodes[i - 1], g[i - 1], 1), pt(w.nodes[i], g[i], 1), ni, 0, 0]);
      } else if (t === 'parking_position') {
        standWays.push(w);   // read after the taxiways, below
      } else if ((t === 'apron' || t === 'terminal') && closed(w)) {
        l.areas.push({ k: t, pts: g.map(xy) });
      }
    }
    // ---- stands ----
    // In OpenStreetMap a stand is usually a numbered point where the aircraft stops, with one or more
    // painted lead-in lines (also tagged as parking positions) running from the taxilane to it. Lines
    // without such a point are grouped by stand number; the stop is the end furthest from the taxiways.
    const taxiPts = l.points.slice();                                           // taxiways and runways only
    const near = (p: number[], max: number, list = l.points) => { let best = -1, bd = max * max; list.forEach((q, i) => { const d = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2; if (d < bd) { bd = d; best = i; } }); return best; };
    const taxiDist = (p: number[]) => { let bd = 1e18; for (const q of taxiPts) { const d = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2; if (d < bd) bd = d; } return Math.sqrt(bd); };
    const stopNodes = els.filter(e => e.type === 'node' && e.tags && e.tags.aeroway === 'parking_position');
    const stopById: { [id: string]: any } = {}; stopNodes.forEach(n => stopById[String(n.id)] = n);
    const leadIns: { [id: string]: any[] } = {};   // stop node id -> its lead-in lines
    const loose: { [ref: string]: any[] } = {};
    for (const w of standWays) {
      if (closed(w)) { const g = w.geometry, c = g.reduce((s2: number[], q: any) => [s2[0] + q.lat / g.length, s2[1] + q.lon / g.length], [0, 0]); (loose['#area' + w.id] = []).push({ area: xy({ lat: c[0], lon: c[1] }), ref: w.tags.ref || w.tags.name || '' }); continue; }
      const stop = (w.nodes || []).map(String).filter((id: string) => stopById[id])[0];
      if (stop) (leadIns[stop] = leadIns[stop] || []).push(w);
      else { const ref = String(w.tags.ref || w.tags.name || '#' + w.id); (loose[ref] = loose[ref] || []).push(w); }
    }
    // lead-in lines are drawn and taxied along (thin, type 9)
    const addLine = (w: any) => { const g = w.geometry; for (let i = 1; i < g.length; i++) l.paths.push([9, 3, pt(w.nodes[i - 1], g[i - 1], 1), pt(w.nodes[i], g[i], 1), 0, 0, 0]); };
    // join the open end of a lead-in to the taxi network when the map leaves a small gap
    const joinEnd = (w: any) => { for (const e of [0, w.nodes.length - 1]) { const id = String(w.nodes[e]); if ((use[id] || 0) > 1 || stopById[id]) continue; const p = xy(w.geometry[e]), j = near(p, 60, taxiPts); if (j >= 0) l.paths.push([9, 3, pIdx[id], j, 0, 0, 0]); } };
    const standAt = (p: number[], hdg: number, ref: string, from: number) => { const pk = addPark(p[0], p[1], hdg, ref, true); if (from >= 0) l.paths.push([3, 3, from, pk, 0, 0, 0]); return pk; };
    for (const n of stopNodes) {
      const p = xy(n), lines = leadIns[String(n.id)] || [];
      // facing: along the straightest lead-in line, towards the stop
      let hdg: number = null, bestLen = 0;
      for (const w of lines) {
        const g = w.geometry, i = w.nodes.map(String).indexOf(String(n.id)), far = i === 0 ? g[g.length - 1] : g[0], q = xy(far);
        const len = Math.hypot(q[0] - p[0], q[1] - p[1]); if (len > bestLen) { bestLen = len; hdg = Math.atan2(p[0] - q[0], p[1] - q[1]) * 180 / Math.PI; }
        addLine(w); joinEnd(w);
      }
      const j = lines.length ? pIdx[String(n.id)] : near(p, 250, taxiPts);
      if (hdg == null) { const q = j >= 0 ? l.points[j] : null; hdg = q ? Math.atan2(p[0] - q[0], p[1] - q[1]) * 180 / Math.PI : 0; }
      standAt(p, hdg, n.tags.ref || n.tags.name || '', j == null ? -1 : j);
    }
    const stopRefs: { [ref: string]: boolean } = {}; stopNodes.forEach(n => { const r = n.tags.ref || n.tags.name; if (r) stopRefs[String(r)] = true; });
    for (const ref of Object.keys(loose)) {
      const group = loose[ref];
      // more lead-in lines for a stand that already has its stop point
      if (stopRefs[ref] && !group[0].area) { group.forEach(w => { addLine(w); joinEnd(w); }); continue; }
      if (group[0].area) { const g0 = group[0], j = near(g0.area, 250, taxiPts); standAt(g0.area, 0, g0.ref, j); continue; }
      // the stop: of all the line ends, the one furthest from the taxiways
      let best: any = null, bd = -1;
      for (const w of group) for (const e of [0, w.nodes.length - 1]) { const q = xy(w.geometry[e]), d = taxiDist(q); if (d > bd) { bd = d; best = { w, e, q }; } }
      group.forEach(w => { addLine(w); joinEnd(w); });
      const g = best.w.geometry, prev = xy(best.e === 0 ? g[Math.min(1, g.length - 1)] : g[g.length - 2]);
      const hdg = Math.atan2(best.q[0] - prev[0], best.q[1] - prev[1]) * 180 / Math.PI;
      standAt(best.q, hdg, ref.charAt(0) === '#' ? '' : ref, pIdx[String(best.w.nodes[best.e])]);
    }
    // gates without a stand nearby (some airports only map the gates)
    for (const n of els.filter(e => e.type === 'node' && e.tags && e.tags.aeroway === 'gate')) {
      const p = xy(n); if (l.parks.some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < 120)) continue;
      const j = near(p, 250, taxiPts), q = j >= 0 ? l.points[j] : null;
      standAt(p, q ? Math.atan2(p[0] - q[0], p[1] - q[1]) * 180 / Math.PI : 0, n.tags.ref || n.tags.name || '', j);
    }
    l.runways = this.joinRunways(l.runways);
    // the official runway length where the map's differs (stopways and pads are often drawn as runway)
    const official = (World.runways || {})[icao] || [];
    for (const r of l.runways) {
      const o = official.filter((x: any) => [x[0], x[1]].sort().join('|') === [r.a, r.b].sort().join('|'))[0];
      const len = o && o[2] ? o[2] * 0.3048 : 0;
      if (len > 300 && Math.abs(len - r.len) / len > 0.02) r.len = Math.round(len);
      if (o && o[3] > 0 && r.wid === 45) r.wid = Math.max(18, o[3] * 0.3048);
    }
    if (!l.runways.length) return null;
    // mapped runways but no taxiways (common at smaller airports): laid out to the standard dimensions
    if (!l.paths.some(p => p[0] === 1 || p[0] === 4)) try { layoutGenerate(l, a); } catch (e) { /* as mapped */ }
    // mapped taxiways and aprons but no stands: stands laid out on the mapped aprons
    else if (!l.parks.length) try { standsOnAprons(l); } catch (e) { /* as mapped */ }
    return l;
  },
};
/* ---------- stands on mapped aprons ---------- */
/** For airports whose aprons are mapped but not their stands: stands in rows across each apron, a stand's
 * size from the longest runway, the nose pointing away from the nearest taxiway, joined to it. */
function standsOnAprons(l: AirportLayout) {
  const aprons = (l.areas || []).filter(a => a.k === 'apron' && a.pts.length >= 3); if (!aprons.length) return;
  const taxi: number[] = []; const seen: { [i: number]: 1 } = {};
  for (const p of l.paths) if ((p[0] === 1 || p[0] === 4) && l.points[p[2]] && l.points[p[3]]) for (const i of [p[2], p[3]]) if (!seen[i]) { seen[i] = 1; taxi.push(i); }
  if (!taxi.length) return;
  const segs = l.paths.filter(p => (p[0] === 1 || p[0] === 4) && l.points[p[2]] && l.points[p[3]]);
  const rl = Math.max(0, ...l.runways.map(r => r.surf === 4 ? r.len : 0));
  const kind = rl >= 2400 ? { sp: 52, r: 24, t: 9 } : rl >= 1500 ? { sp: 40, r: 18, t: 9 } : { sp: 24, r: 12, t: 2 };
  const inside = (x: number, y: number, P: number[][]) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
  l.parkNames = l.parkNames || [];
  let made = 0;
  for (const A of aprons) {
    const xs = A.pts.map(q => q[0]), ys = A.pts.map(q => q[1]), m = kind.r * 0.75;
    for (let y = Math.min(...ys) + kind.sp / 2; y < Math.max(...ys) && made < 80; y += kind.sp)
      for (let x = Math.min(...xs) + kind.sp / 2; x < Math.max(...xs) && made < 80; x += kind.sp) {
        if (![[0, 0], [m, 0], [-m, 0], [0, m], [0, -m]].every(o => inside(x + o[0], y + o[1], A.pts))) continue;
        let j = -1, bd = 400 * 400; for (const i of taxi) { const q = l.points[i], d = (q[0] - x) ** 2 + (q[1] - y) ** 2; if (d < bd) { bd = d; j = i; } }
        if (j < 0) continue;
        // the nearest point on a taxiway: the nose points straight away from it; only the rows next to one
        let px = l.points[j][0], py = l.points[j][1], sd = 1e18;
        for (const p of segs) { const A2 = l.points[p[2]], B2 = l.points[p[3]], dx = B2[0] - A2[0], dy = B2[1] - A2[1], L2 = dx * dx + dy * dy || 1, t = clamp(((x - A2[0]) * dx + (y - A2[1]) * dy) / L2, 0, 1), cx = A2[0] + dx * t, cy = A2[1] + dy * t, d = (cx - x) ** 2 + (cy - y) ** 2; if (d < sd) { sd = d; px = cx; py = cy; } }
        if (Math.sqrt(sd) > kind.sp * 2.2) continue;
        const hdg = (Math.atan2(x - px, y - py) * 180 / Math.PI + 360) % 360;
        const ni = l.parkNames.length; l.parkNames.push(String(++made));
        l.parks.push([Math.round(x * 10) / 10, Math.round(y * 10) / 10, Math.round(hdg), kind.r, kind.t, 0, ni]);
        l.paths.push([3, 8, j, l.parks.length - 1, 0, 0, 0]);
      }
  }
  if (made) (l as any).genStands = true;
}

/* ---------- taxiways laid out from the runways ---------- */
// For airports with no mapped taxiways: a taxi system built from the real runways (position, length, width,
// heading) with the ICAO Annex 14 dimensions for that size of runway: the parallel taxiway's distance from the
// runway centre line, taxiway widths, exits at both ends and along the runway, and an apron with stands on the
// side of the airport's reference point (where the terminal usually is). Realistic in size and place; not an
// exact copy of the real airport.
function layoutGenerate(l: AirportLayout, a: any) {
  const paved = l.runways.filter(r => r.surf === 4 && r.len >= 700).sort((x, y) => y.len - x.len);
  if (!paved.length) return;
  const size = a && a.size != null ? a.size : paved[0].len > 2500 ? 2 : paved[0].len > 1400 ? 1 : 0;
  const pts: number[][] = l.points, paths: number[][] = l.paths, parks: number[][] = l.parks;
  const P = (x: number, y: number, t: number) => { pts.push([Math.round(x * 10) / 10, Math.round(y * 10) / 10, t]); return pts.length - 1; };
  const k = Math.cos(l.lat * Math.PI / 180), xy = (lat: number, lon: number) => [(lon - l.lon) * 111320 * k, (lat - l.lat) * 110540];
  const arp = a && a.pos ? xy(a.pos[1], a.pos[0]) : [0, 0];
  paved.slice(0, 3).forEach((r, ri) => {
    // ICAO aerodrome code by runway size: separation to the parallel taxiway and taxiway width
    const code = r.wid >= 44 || r.len >= 2800 ? 'E' : r.wid >= 29 || r.len >= 1800 ? 'C' : r.wid >= 22 ? 'B' : 'A';
    const sep = code === 'E' ? 182.5 : code === 'C' ? 168 : code === 'B' ? 87 : 52, tw = code === 'E' ? 23 : code === 'C' ? 18 : code === 'B' ? 10.5 : 7.5;
    const c = xy(r.lat, r.lon), h = r.hdg * Math.PI / 180, ux = Math.sin(h), uy = Math.cos(h);
    // the side towards the reference point (the terminal side); a coin toss when it sits on the runway
    let px = Math.cos(h), py = -Math.sin(h); const side = (arp[0] - c[0]) * px + (arp[1] - c[1]) * py;
    if (side < 0 || (Math.abs(side) < 60 && _hashStr(l.icao + r.a) % 2)) { px = -px; py = -py; }
    const at = (s0: number, o: number) => [c[0] + ux * s0 + px * o, c[1] + uy * s0 + py * o];
    const half = r.len / 2, exits = r.len > 2600 ? 3 : r.len > 1500 ? 2 : 1;
    const ss = [-half + 25]; for (let i = 1; i <= exits; i++) ss.push(-half + r.len * i / (exits + 1)); ss.push(half - 25);
    const rw = ss.map(s0 => { const q = at(s0, 0); return P(q[0], q[1], 2); }), tx = ss.map(s0 => { const q = at(s0, sep); return P(q[0], q[1], 1); });
    for (let i = 0; i < ss.length; i++) {
      if (i) { paths.push([2, r.wid, rw[i - 1], rw[i], 0, 0, 0]); paths.push([1, tw, tx[i - 1], tx[i], 0, 0, 0]); }
      paths.push([1, tw, rw[i], tx[i], 0, 0, 0]);
    }
    // the apron and its stands: once, next to the longest runway, abreast of the reference point
    if (ri !== 0) return;
    const sA = clamp((arp[0] - c[0]) * ux + (arp[1] - c[1]) * uy, -half * 0.55, half * 0.55);
    const W = size >= 2 ? Math.min(r.len * 0.55, 1300) : size === 1 ? Math.min(r.len * 0.4, 520) : Math.min(r.len * 0.3, 180);
    const kind = size >= 2 ? { sp: 70, r: 32, t: 10, depth: 95 } : size === 1 ? { sp: 42, r: 20, t: 9, depth: 62 } : { sp: 24, r: 11, t: 3, depth: 34 };
    const oF = sep + tw / 2 + 12, oL = oF + 22, oB = oL + kind.depth;
    const n = Math.max(2, Math.floor(W / kind.sp)), s0 = sA - (n - 1) * kind.sp / 2;
    // apron taxilane along the front of the apron, linked to the parallel taxiway at both ends
    const lane: number[] = [];
    for (let i = 0; i < n; i++) { const q = at(s0 + i * kind.sp, oL); lane.push(P(q[0], q[1], 1)); if (i) paths.push([4, Math.max(10, tw - 4), lane[i - 1], lane[i], 0, 0, 0]); }
    for (const [li, sx] of [[0, s0], [n - 1, s0 + (n - 1) * kind.sp]] as number[][]) {
      const q = at(sx, sep), j = P(q[0], q[1], 1); paths.push([1, tw, j, lane[li], 0, 0, 0]);
      // and the new junction joined into the parallel taxiway between its neighbours
      let lo = -1, hi = -1; ss.forEach((v, i) => { if (v <= sx && (lo < 0 || v > ss[lo])) lo = i; if (v >= sx && (hi < 0 || v < ss[hi])) hi = i; });
      if (lo >= 0) paths.push([1, tw, tx[lo], j, 0, 0, 0]); if (hi >= 0 && hi !== lo) paths.push([1, tw, j, tx[hi], 0, 0, 0]);
    }
    // stands: nose towards the terminal, the nose wheel stop near the back of the apron
    const hdgOut = (Math.atan2(px, py) * 180 / Math.PI + 360) % 360;
    l.parkNames = l.parkNames || [];
    for (let i = 0; i < n; i++) {
      const q = at(s0 + i * kind.sp, oB - 8), ni = l.parkNames.length; l.parkNames.push(String((size >= 1 ? 1 : 0) * 10 + i + 1));
      parks.push([Math.round(q[0] * 10) / 10, Math.round(q[1] * 10) / 10, Math.round(hdgOut), kind.r, kind.t, 0, ni]);
      paths.push([3, 8, lane[i], parks.length - 1, 0, 0, 0]);
    }
    const poly = (o1: number, o2: number) => [at(s0 - kind.sp * 0.7, o1), at(s0 + (n - 1) * kind.sp + kind.sp * 0.7, o1), at(s0 + (n - 1) * kind.sp + kind.sp * 0.7, o2), at(s0 - kind.sp * 0.7, o2)].map(q => [Math.round(q[0]), Math.round(q[1])]);
    l.areas = (l.areas || []).concat([{ k: 'apron', pts: poly(oF, oB) }]);
    if (size >= 1) l.areas.push({ k: 'terminal', pts: poly(oB + 6, oB + 6 + (size >= 2 ? 55 : 32)) });
  });
  if (l.names && !l.names.length) l.names.push('');
  l.gen = true;
}

/* ---------- the device's store of airport layouts ---------- */
// Layouts from your simulator (its SDK facility data, read by the PC app) and OpenStreetMap, kept on this
// device in its database (no small limit): up to 1,500 airports, the simulator's kept for good.
const LayoutDb = {
  _db: null as Promise<IDBDatabase>,
  db(): Promise<IDBDatabase> {
    if (this._db) return this._db;
    this._db = new Promise((ok, no) => { try { const r = indexedDB.open('amp-layouts', 1); r.onupgradeneeded = () => r.result.createObjectStore('l', { keyPath: 'k' }); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); } catch (e) { no(e); } });
    return this._db;
  },
  get(icao: string): Promise<AirportLayout> {
    return this.db().then(d => new Promise<AirportLayout>(ok => { const r = d.transaction('l').objectStore('l').get(icao); r.onsuccess = () => ok(r.result ? r.result.l : null); r.onerror = () => ok(null); })).catch(() => null);
  },
  del(icao: string) { this.db().then(d => { d.transaction('l', 'readwrite').objectStore('l').delete(icao); }).catch(() => { /* none */ }); },
  put(icao: string, l: AirportLayout) {
    this.db().then(d => { const t = d.transaction('l', 'readwrite'); t.objectStore('l').put({ k: icao, at: Date.now(), src: l.source, l }); }).catch(() => { /* not available: kept for this session */ });
  },
  /** The airports kept, with where each came from. */
  keys(): Promise<{ [icao: string]: string }> {
    return this.db().then(d => new Promise<{ [icao: string]: string }>(ok => { const out: { [k: string]: string } = {}, r = d.transaction('l').objectStore('l').openCursor(); r.onsuccess = () => { const c = r.result; if (c) { out[c.value.k] = c.value.src; c.continue(); } else ok(out); }; r.onerror = () => ok(out); })).catch(() => ({}));
  },
};
/** When linked: the airports that matter to you (bases, routes, flights, bookings, jobs and the big airports
 *  around your home base) are read from the simulator by the PC app in the background and kept here. */
let _lpAt = 0;
function layoutPrefetch() {
  if (Link.status !== 'connected' || !Link.sim || !Link.sim.connected || Date.now() - _lpAt < 6 * 3600e3) return;
  _lpAt = Date.now();
  const c = company(), set: { [k: string]: 1 } = {}, add = (k: string) => { if (k && /^[A-Z0-9]{3,4}$/.test(k)) set[k] = 1; };
  try { companyBases(c.id).forEach(add); } catch (e) { /* ignore */ }
  State.routes.filter(r => r.companyId === c.id).forEach(r => r.legs.forEach(add));
  State.live.forEach((f: any) => { if (!f.tfc) { add(f.from); add(f.to); } });
  try { bookings().forEach((b: any) => { add(b.from); add(b.to); }); } catch (e) { /* ignore */ }
  try { ((State as any).jobs && (State as any).jobs.list || []).forEach((j: any) => { add(j.from); add(j.to); }); } catch (e) { /* ignore */ }
  const H = apt(c.hub);
  if (H && World.ready) (World.list as any[]).filter(w => w.size === 2 && w.pos && /^[A-Z]{4}$/.test(w.icao)).map(w => [w.icao, gcDistanceNm(H.pos, w.pos)] as [string, number]).sort((a, b) => a[1] - b[1]).slice(0, 150).forEach(x => add(x[0]));
  LayoutDb.keys().then(have => { const list = Object.keys(set).filter(k => have[k] !== 'sim'); if (list.length) linkSend({ type: 'layout-prefetch', list }); });
}
setInterval(() => { try { layoutPrefetch(); } catch (e) { /* ignore */ } }, 120e3);

/** The paved parking area around the stands, as polygons in the layout's metres: under every stand (the
 *  aircraft's whole footprint and the gap to the next stand), along the lead-in lines and stand connectors,
 *  and along the taxilanes that run between the stands. Where the map has no apron outline (or an
 *  incomplete one) this fills it, so no grass shows between parked aircraft. Plain taxiways away from
 *  the stands are not touched: they stay strips. */
function layoutParkingFill(L: AirportLayout): number[][][] {
  const out: number[][][] = [], parks = L.parks || [], P = L.points || [];
  if (!parks.length) return out;
  const rect = (A: number[], B: number[], w: number) => {
    const dx = B[0] - A[0], dy = B[1] - A[1], len = Math.hypot(dx, dy); if (len < 0.5) return;
    const nx = -dy / len * w / 2, ny = dx / len * w / 2;
    out.push([[A[0] + nx, A[1] + ny], [A[0] - nx, A[1] - ny], [B[0] - nx, B[1] - ny], [B[0] + nx, B[1] + ny]]);
  };
  const disc = (C: number[], r: number) => { const q: number[][] = []; for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; q.push([C[0] + Math.cos(a) * r, C[1] + Math.sin(a) * r]); } out.push(q); };
  const nearStand = (x: number, y: number) => { let best = 1e9, r = 0; for (const k of parks) { const d = Math.hypot(x - k[0], y - k[1]); if (d < best) { best = d; r = k[3] || 15; } } return { d: best, r }; };
  // the stands: from just past the stop bar back over the whole aircraft, a little wider than its wings
  for (const k of parks) {
    const r = Math.max(8, k[3] || 15), h = (k[2] || 0) * Math.PI / 180, ux = Math.sin(h), uy = Math.cos(h);
    rect([k[0] + ux * r * 0.4, k[1] + uy * r * 0.4], [k[0] - ux * r * 2.4, k[1] - uy * r * 2.4], 2 * r + 14);
  }
  // lead-in lines and stand connectors: wide enough for the aircraft that follow them
  for (const p of L.paths || []) {
    const A = P[p[2]];
    if (p[0] === 9) { const B = P[p[3]]; if (!A || !B) continue; const n = nearStand((A[0] + B[0]) / 2, (A[1] + B[1]) / 2); if (n.d < n.r * 4 + 40) rect(A, B, 2 * n.r + 10); }
    else if (p[0] === 3) { const k = parks[p[3]]; if (!A || !k) continue; const r = Math.max(8, k[3] || 15); rect(A, k, 2 * r + 10); disc(A, r + 5); }
  }
  // taxilanes: taxi paths running among the stands get pavement out to the stands on both sides
  for (const p of L.paths || []) {
    if (!(p[0] === 1 || p[0] === 4)) continue;
    const A = P[p[2]], B = P[p[3]]; if (!A || !B) continue;
    const na = nearStand(A[0], A[1]), nb = nearStand(B[0], B[1]), r = Math.max(na.r, nb.r);
    if (na.d < r * 2.6 + 25 && nb.d < r * 2.6 + 25) { rect(A, B, Math.min(40, Math.max(10, p[1] || 18)) + 2 * r + 20); disc(A, r + 15); disc(B, r + 15); }
  }
  return out;
}
