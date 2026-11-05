// Every airport in the world, not just the ones in the demo: about 49,000 open airports and seaplane
// bases from OurAirports (public domain), loaded once at start-up from airports-world.json. When the app
// is linked to the simulator, the simulator's own airport list is added on top, so every airport the
// simulator has is available, add-on airports included. Runways (runways-world.json) load when needed.

/** Lower case without accents, so "vagar" finds Vágar and "reykjavik" finds Reykjavík. */
function fold(s: string): string { return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ð/g, 'd').replace(/þ/g, 'th').replace(/ø/g, 'o').replace(/æ/g, 'ae').replace(/å/g, 'a').toLowerCase(); }

interface WorldAirport extends Airport { elev?: number; size?: number; iata?: string; sched?: boolean; sim?: boolean; hk?: string }   // size 4: a heliport (hk h hospital, o offshore, c other)

const World = {
  ready: false,
  list: [] as WorldAirport[],
  helis: [] as WorldAirport[],   // heliports and helidecks (helicopters only), kept apart from the airports
  by: {} as { [ident: string]: WorldAirport },
  countries: {} as { [code: string]: string },
  runways: null as { [ident: string]: any[] },
  simCount: 0,
  _loading: null as Promise<void>,

  load(): Promise<void> {
    if (this._loading) return this._loading;
    this._loading = fetch('airports-world.json').then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(d => {
      this.countries = d.countries || {};
      for (const r of d.airports as any[]) {
        const a: WorldAirport = { icao: r[0], name: r[1] || r[0], city: r[2] || r[1] || r[0], country: this.countries[r[3]] || r[3] || '', pos: [r[5], r[4]], elev: r[6], size: r[7], iata: r[8] || '', sched: !!r[9] };
        this.list.push(a); this.by[a.icao] = a;
      }
      // airports saved earlier with only their code (from routes or the simulator) get their names
      for (const k of Object.keys(AIRPORTS)) { const x = AIRPORTS[k], w = this.by[k]; if (w && x.name === k) { x.name = w.name; x.city = w.city; x.country = w.country; } }
      this.ready = true;
      this.loadHelis();
      try { if (typeof refresh === 'function' && /routes|ops|map/.test(State.screen)) refresh(); } catch (e) { /* not ready */ }
    }).catch(e => { try { ErrorLog.add('airports', 'The world airport list couldn\'t be loaded', (e && e.message) || String(e), 'Only the main airports are available until the app is restarted.', false); } catch (er) { /* ignore */ } });
    return this._loading;
  },

  /** Heliports, hospital pads and offshore helidecks worldwide (OurAirports, public domain). */
  loadHelis() {
    fetch('heliports-world.json').then(r => r.json()).then(d => {
      for (const r of d.heliports as any[]) {
        if (this.by[r[0]]) continue;
        const a: WorldAirport = { icao: r[0], name: r[1] || r[0], city: r[2] || r[1] || r[0], country: this.countries[r[3]] || r[3] || '', pos: [r[5], r[4]], elev: r[6], size: 4, hk: r[7] };
        this.helis.push(a); this.by[a.icao] = a;
      }
    }).catch(() => { /* airports only */ });
  },

  loadRunways(): Promise<{ [ident: string]: any[] }> {
    if (this.runways) return Promise.resolve(this.runways);
    return fetch('runways-world.json').then(r => r.json()).then(d => (this.runways = d)).catch(() => (this.runways = {}));
  },

  /** The simulator's own airports (ident, latitude, longitude): every one becomes available in the app. */
  addSim(list: { icao: string; lat: number; lon: number }[]) {
    let n = 0;
    for (const s of list || []) {
      const id = String(s.icao || '').trim().toUpperCase(); if (!/^[A-Z0-9]{2,6}$/.test(id)) continue;
      const a = this.by[id];
      if (a) { a.sim = true; continue; }
      const w: WorldAirport = { icao: id, name: id, city: id, country: '', pos: [s.lon, s.lat], sim: true };
      this.list.push(w); this.by[id] = w; n++;
    }
    this.simCount = this.list.filter(a => a.sim).length;
    return n;
  },

  get(id: string): WorldAirport { return this.by[id] || null; },

  /** Search by ICAO, IATA, name or city; bigger airports first. */
  search(q: string, limit?: number, filter?: (a: WorldAirport) => boolean, heli?: boolean): WorldAirport[] {
    q = fold((q || '').trim()); limit = limit || 40;
    const curated = Object.keys(AIRPORTS).map(k => AIRPORTS[k] as WorldAirport).filter(a => heli || !isHelipad(a.icao));
    let all = this.ready ? curated.concat(this.list.filter(a => !AIRPORTS[a.icao])) : curated;
    if (heli) all = all.concat(this.helis.filter(a => !AIRPORTS[a.icao]));
    if (!q) return all.filter(a => !filter || filter(a)).slice(0, limit);
    const out: [number, WorldAirport][] = [];
    for (const a of all) {
      if (filter && !filter(a)) continue;
      const A: any = a; if (A._f == null) { A._f = fold(a.name || ''); A._g = fold(a.city || ''); }
      const id = a.icao.toLowerCase(), ia = (a.iata || '').toLowerCase(), nm = A._f, ct = A._g;
      let s = -1;
      if (id === q || ia === q) s = 100; else if (id.indexOf(q) === 0) s = 80; else if (ct.indexOf(q) === 0) s = 60; else if (nm.indexOf(q) === 0) s = 55;
      else if (q.length >= 3 && (nm.indexOf(q) >= 0 || ct.indexOf(q) >= 0)) s = 30;
      if (s < 0) continue;
      s += (a.size === 4 && a.hk !== 'c' ? 5 : 0) + (a.size === 2 ? 12 : a.size === 1 ? 6 : 0) + (a.sched ? 4 : 0) + (AIRPORTS[a.icao] ? 20 : 0);
      out.push([s, a]);
    }
    return out.sort((x, y) => y[0] - x[0]).slice(0, limit).map(x => x[1]);
  },

  /** Helipads near a place (hospital and offshore first when asked for). */
  helisNear(pos: number[], maxNm: number, kind?: string): WorldAirport[] {
    const dLat = maxNm / 60;
    return this.helis.filter(a => (!kind || a.hk === kind) && Math.abs(a.pos[1] - pos[1]) < dLat && gcDistanceNm(pos, a.pos) <= maxNm)
      .sort((a, b) => gcDistanceNm(pos, a.pos) - gcDistanceNm(pos, b.pos));
  },

  /** The closest airport to a position, within maxNm. */
  nearest(lon: number, lat: number, maxNm: number): string {
    let best = '', bd = maxNm;
    const dLat = maxNm / 60, cosL = Math.max(0.05, Math.cos(lat * Math.PI / 180)), dLon = maxNm / 60 / cosL;
    const check = (a: Airport) => {
      if (Math.abs(a.pos[1] - lat) > dLat || Math.abs(((a.pos[0] - lon + 540) % 360) - 180) > dLon) return;
      const d = gcDistanceNm([lon, lat], a.pos); if (d < bd) { bd = d; best = a.icao; }
    };
    for (const k of Object.keys(AIRPORTS)) check(AIRPORTS[k]);
    for (const a of this.list) check(a);
    return best;
  },
};

/** A heliport, hospital pad or offshore helideck: helicopters only. */
function isHelipad(icao: string): boolean { const a: any = World.by[icao] || AIRPORTS[icao]; return !!a && a.size === 4; }
/** What kind of helipad: 'Hospital', 'Offshore' or 'Helipad' ('' for an airport). */
function helipadKind(icao: string): string { const a: any = World.by[icao] || AIRPORTS[icao]; return !a || a.size !== 4 ? '' : a.hk === 'h' ? 'Hospital' : a.hk === 'o' ? 'Offshore' : 'Helipad'; }
