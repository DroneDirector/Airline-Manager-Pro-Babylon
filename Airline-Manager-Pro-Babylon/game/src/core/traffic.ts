// Other airlines (made up): each has its own home base, its own fleet and its own schedule every day, flown
// automatically on the real clock. You never set anything for them. Their aircraft fly rotations out of
// their hub (several short legs a day, or one long-haul round trip), sometimes late, and the delays carry
// through the day. Their results feed the airline league (Airline of the Month and of the Year).
// Shown on the map (many) and in the 3D view (only the ones in front of the camera), in single player; in
// co-op they aren't drawn, but still compete in the league. The fleets never grow, so performance stays fair.

interface TrafficCraft { id: string; airline: string; code: string; dname?: string; dcode?: string; color: string; color2: string; typeId: string; reg: string; hub: string; seats: number }
interface TrafficAirline { name: string; code: string; color: string; color2: string; hub: string; quality: number; fleet: TrafficCraft[] }
interface TrafficLeg { craft: TrafficCraft; from: string; to: string; sched: number; dep: number; arr: number; num: number; delayMin: number }
const TRAFFIC_N = 140;            // aircraft in all: about half at airlines based near your home base
const TRAFFIC_AIRLINES = 12;
const TRAFFIC_COLORS = [['#C8102E', '#1B2A44'], ['#0B6E4F', '#F2C14E'], ['#3A86FF', '#0B1F3A'], ['#F77F00', '#22333B'], ['#7B2CBF', '#F1F1F1'], ['#2EC4B6', '#011627'], ['#E63946', '#F1FAEE'], ['#FFB703', '#023047'], ['#118AB2', '#073B4C'], ['#8D99AE', '#2B2D42']];
const Traffic = {
  fleet: null as TrafficCraft[],
  lines: null as TrafficAirline[],
  _key: '',
  _pools: {} as { [k: string]: any[] },
  _days: new Map<string, TrafficLeg[]>(),
  _dur: {} as { [k: string]: number },
  on(): boolean { return !Mode.coop() && (State.settings as any).otherTraffic !== false; },
  /** The airlines and their fleets: the same every day for the same home base of yours. */
  airlines(): TrafficAirline[] {
    const real = tfcRealNames(), hub = company() ? company().hub : 'EKVG', key = hub + ':' + (World.ready ? World.list.length : 0) + ':' + World.helis.length + (real ? ':real' : '');
    if (this.lines && this._key === key) return this.lines;
    this._key = key; this._pools = {}; this._days.clear();
    const H = apt(hub), big = (World.ready ? World.list : []).filter((w: any) => w.size === 2 && w.sched && w.pos && /^[A-Z]{4}$/.test(w.icao));
    if (big.length < 20 || !H) { this.lines = []; this.fleet = []; return this.lines; }
    const near = big.filter((w: any) => gcDistanceNm(H.pos, w.pos) < 1300 && w.icao !== hub);
    const r = seeded('traffic2:' + hub), names = COMPETITOR_NAMES.slice().sort(() => r() - 0.5).slice(0, TRAFFIC_AIRLINES), out: TrafficAirline[] = [], fleet: TrafficCraft[] = [];
    // with real airline names: real airlines at their own main bases, half of them the ones nearest you
    const reals = real ? (() => {
      const have = REAL_AIRLINES.filter(R => R.kind !== 'bush' && R.hub !== hub && big.some((w: any) => w.icao === R.hub));
      const byNear = have.slice().sort((a, b) => gcDistanceNm(H.pos, apt(a.hub).pos) - gcDistanceNm(H.pos, apt(b.hub).pos));
      const pick: RealAirline[] = [];
      for (const R of byNear) { if (pick.length >= TRAFFIC_AIRLINES / 2) break; pick.push(R); }
      const rest = have.filter(R => pick.indexOf(R) < 0).sort(() => r() - 0.5);
      while (pick.length < TRAFFIC_AIRLINES && rest.length) pick.push(rest.shift());
      return pick;
    })() : [];
    names.forEach((al, i) => {
      const R = reals[i];
      const pool = i % 2 === 0 && near.length > 6 ? near : big, home: any = R ? big.filter((w: any) => w.icao === R.hub)[0] : pool[Math.floor(r() * pool.length)];
      const code = al.split(' ').map(w => w[0]).join('').toUpperCase().padEnd(2, 'X') + String.fromCharCode(65 + (_hashStr(al) % 26)), col = TRAFFIC_COLORS[_hashStr(al) % TRAFFIC_COLORS.length];
      const A: TrafficAirline = { name: al, code, color: col[0], color2: col[1], hub: home.icao, quality: 0.6 + r() * 0.35, fleet: [] };
      const n = Math.round(TRAFFIC_N / TRAFFIC_AIRLINES * (0.5 + r()));
      // a mix that suits the airline: regional, short-haul and (for some) long-haul aircraft
      let longHaul = r() < 0.4, regional = r() < 0.5;
      const rTypes = R ? R.fleet.filter(t => !!acType(t) && acType(t).cls !== 'bush' && acType(t).cls !== 'ga') : [];
      for (let k = 0; k < n; k++) {
        const x = r(), typeId = longHaul && x < 0.25 ? ['b78x', 'a350-ini', 'b77w-pmdg', 'b787-9', 'a330-900neo', 'b787-8'][Math.floor(r() * 6)] : regional && x < 0.45 ? (r() < 0.6 ? 'atr72' : 'crj9-aero') : ['a320neo', 'b738-pmdg', 'a320-fenix', 'b736-pmdg', 'a321neo', 'b737-max8', 'a321ceo', 'b737-max9'][Math.floor(r() * 8)];
        const tId = rTypes.length ? rTypes[Math.floor(r() * rTypes.length)] : typeId;
        if (!acType(tId)) continue;
        const c: TrafficCraft = { id: `tfc-${i}-${k}`, airline: al, code, color: R ? R.color : col[0], color2: R ? '#14233A' : col[1], typeId: tId, reg: code.slice(0, 2) + '-' + String.fromCharCode(65 + Math.floor(r() * 26), 65 + Math.floor(r() * 26), 65 + Math.floor(r() * 26)), hub: home.icao, seats: acType(tId).seats || 180 };
        if (R) { c.dname = R.name; c.dcode = R.icao; c.reg = realReg(R.hub, r); }
        A.fleet.push(c); fleet.push(c);
      }
      out.push(A);
    });
    // helicopter operators near your home base: air ambulance, offshore and charter, flying between helipads
    for (const [hi, [hn, hcode, kind, types]] of ([['Northern Air Ambulance', 'NAA', 'h', ['h145', 'h135', 'aw169', 'h145']], ['Coastline Offshore Helicopters', 'COH', 'o', ['aw189', 's92', 'h175', 'aw139']], ['Skyline Heli Charter', 'SHC', 'c', ['h125', 'bell407', 'bell505', 'h130']]] as any[]).entries()) {
      // based where its kind of work is: the airport near you with the most hospital pads, helidecks or heliports around it
      const homes: any[] = [Object.assign({}, H, { icao: hub })].concat(near.slice().sort((a: any, b: any) => gcDistanceNm(H.pos, a.pos) - gcDistanceNm(H.pos, b.pos)).slice(0, 10));
      const score = (w: any) => World.helisNear(w.pos, kind === 'o' ? 140 : 90, kind === 'c' ? undefined : kind).length;
      const home: any = homes.map(w => ({ w, n: score(w) })).sort((a, b) => b.n - a.n)[0].w;
      const col = TRAFFIC_COLORS[(_hashStr(hn) + 3) % TRAFFIC_COLORS.length];
      const A: TrafficAirline = { name: hn, code: hcode, color: kind === 'h' ? '#D7263D' : col[0], color2: kind === 'h' ? '#FFD23F' : col[1], hub: home.icao, quality: 0.85, fleet: [] };
      (A as any).heli = kind;
      for (let k = 0; k < 4 + Math.floor(r() * 3); k++) {
        const tId = types[k % types.length]; if (!acType(tId)) continue;
        const c: TrafficCraft = { id: `tfc-h${hi}-${k}`, airline: hn, code: hcode, color: A.color, color2: A.color2, typeId: tId, reg: hcode.slice(0, 2) + '-H' + String.fromCharCode(65 + Math.floor(r() * 26), 65 + Math.floor(r() * 26)), hub: home.icao, seats: acType(tId).seats };
        (c as any).heli = kind; A.fleet.push(c); fleet.push(c);
      }
      out.push(A);
    }
    // airlines you took over fly under your name now
    const taken: string[] = ((State as any).biz && (State as any).biz.taken) || [];
    const keep = out.filter(A => taken.indexOf(A.name) < 0);
    this.lines = keep; this.fleet = fleet.filter(c => taken.indexOf(c.airline) < 0); return keep;
  },
  build(): TrafficCraft[] { this.airlines(); return this.fleet || []; },
  /** Destinations an aircraft type can fly from its hub. */
  pool(c: TrafficCraft): any[] {
    const t = acType(c.typeId), cls = t.cls, k = c.hub + ':' + cls + ((c as any).heli ? ':' + (c as any).heli : '');
    if (this._pools[k]) return this._pools[k];
    const H = apt(c.hub) || (World.list as any[]).filter((w: any) => w.icao === c.hub)[0]; if (!H) return (this._pools[k] = []);
    if (cls === 'helicopter') {   // helipads of its kind (hospitals, helidecks) and heliports near its base
      const kind = (c as any).heli, hp = World.helisNear(H.pos, kind === 'o' ? 140 : 90, kind === 'c' ? undefined : kind).filter(w => gcDistanceNm(H.pos, w.pos) > 8);
      return (this._pools[k + ':' + kind] = this._pools[k] = hp.slice(0, 60));
    }
    const [mn, mx] = cls === 'widebody' ? [2600, 6500] : cls === 'turboprop' || cls === 'regional' ? [90, 450] : [200, 1900];
    const list = (World.list as any[]).filter((w: any) => w.size === 2 && w.sched && w.pos && /^[A-Z]{4}$/.test(w.icao) && w.icao !== c.hub).filter((w: any) => { const d = gcDistanceNm(H.pos, w.pos); return d >= mn && d <= mx; });
    return (this._pools[k] = list);
  },
  estMin(typeId: string, a: string, b: string): number { const A: any = apt(a) || (World.list as any[]).filter((w: any) => w.icao === a)[0], B: any = apt(b) || (World.list as any[]).filter((w: any) => w.icao === b)[0]; const nm = A && B ? gcDistanceNm(A.pos, B.pos) : 500; return nm / ((acType(typeId) || {} as any).cruiseKt || 420) * 60 + 25; },
  /** One aircraft's schedule for a day (UTC day number): rotations out of its hub, with the day's delays. */
  day(c: TrafficCraft, D: number, quality: number): TrafficLeg[] {
    const key = c.id + ':' + D; const hit = this._days.get(key); if (hit) return hit;
    if (this._days.size > 4000) this._days.clear();
    const r = seeded('tday:' + key), pool = this.pool(c), out: TrafficLeg[] = []; if (!pool.length) { this._days.set(key, out); return out; }
    const H: any = apt(c.hub) || (World.list as any[]).filter((w: any) => w.icao === c.hub)[0], tz = Math.round((H ? H.pos[0] : 0) / 15);
    const day0 = D * 864e5 - tz * 3600e3, long = acType(c.typeId).cls === 'widebody';
    const heli = acType(c.typeId).cls === 'helicopter';
    let t = day0 + (long ? 9 + r() * 5 : heli ? 6 + r() * 6 : 5.5 + r() * 2.5) * 3600e3, late = 0, num = 100 + Math.floor(r() * 700) * 2;
    const end = day0 + 22 * 3600e3;
    for (let rot = 0; rot < (long ? 1 : heli ? 3 + Math.floor(r() * 3) : 4) && t < end; rot++) {
      const B: any = pool[Math.floor(r() * pool.length)];
      for (const [from, to] of [[c.hub, B.icao], [B.icao, c.hub]]) {
        const dur = this.estMin(c.typeId, from, to) * 60e3, sched = t, d = r() > (1 - quality) * 0.55 ? Math.floor(r() * 9) : 15 + Math.floor(r() * 60);
        late = Math.max(0, late * 0.35 - 10 * 60e3) + d * 60e3; const dep = sched + late;
        out.push({ craft: c, from, to, sched, dep, arr: dep + dur, num: num++, delayMin: Math.round(late / 60e3) });
        t = sched + dur + (long ? 120 : heli ? 15 + r() * 25 : 35 + r() * 20) * 60e3;
      }
      if (!long) t += r() * (heli ? 150 : 90) * 60e3;
    }
    this._days.set(key, out); return out;
  },
  /** The flights in the air (or taxiing) right now, as flights the map and 3D view can draw. */
  _cache: null as any[], _cacheAt: 0,
  live(now?: number): any[] {
    if (!this.on()) return [];
    now = now || Date.now();
    if (this._cache && now - this._cacheAt < 15000) return this._cache;
    const out: any[] = [], D = Math.floor(now / 864e5);
    for (const A of this.airlines()) for (const c of A.fleet) for (const d of [D - 1, D]) for (const l of this.day(c, d, A.quality)) {
      if (now < l.dep || now > l.arr + 30 * 60e3) continue;
      if (!apt(l.from) || !apt(l.to)) { try { registerWorldAirport(l.from); registerWorldAirport(l.to); } catch (e) { /* ignore */ } if (!apt(l.from) || !apt(l.to)) continue; }
      const pk = c.typeId + l.from + l.to; let durMs = this._dur[pk];
      if (!durMs) { try { durMs = flightProfile(c.typeId, l.from, l.to, 0).totalS * 1000; } catch (e) { durMs = l.arr - l.dep; } this._dur[pk] = durMs || l.arr - l.dep; }
      if (now >= l.dep + durMs) continue;
      out.push({ id: `${c.id}-${d}-${l.num}`, tfc: c, reg: '', from: l.from, to: l.to, typeId: c.typeId, depAt: l.dep, durMs, coop: true, real: false, callsign: (c.dcode || c.code) + l.num, t: (now - l.dep) / durMs, alt: 0, phase: '' });
    }
    if (out.length) { this._cache = out; this._cacheAt = now; }   // nothing yet (airports still loading): try again next time
    return out;
  },
  /** Today's departures of one airline, for its board. */
  board(name: string, now?: number): TrafficLeg[] {
    now = now || Date.now(); const A = this.airlines().filter(x => x.name === name)[0]; if (!A) return [];
    const D = Math.floor(now / 864e5), all: TrafficLeg[] = [];
    A.fleet.forEach(c => this.day(c, D, A.quality).forEach(l => all.push(l)));
    return all.sort((a, b) => a.sched - b.sched);
  },
};
ACTIONS['tfc-toggle'] = () => {
  const S: any = State.settings; S.otherTraffic = !Traffic.on(); Traffic._cache = null; Store.soon(); Sound.tick();
  document.querySelectorAll('.tfc-btn').forEach(b => b.classList.toggle('on', Traffic.on()));
  toast(Traffic.on() ? 'Other airlines\' aircraft shown' : 'Other airlines\' aircraft hidden', 'info');
  try { if (typeof v3dTrafficSync === 'function') v3dTrafficSync(); } catch (e) { /* ignore */ }
};
/** Other airlines' aircraft shown with real airline names (Settings → Realism); only how they are
 * labelled: the league, takeovers and the papers keep the made-up airlines. */
function tfcRealNames(): boolean { return !!(State.settings as any).tfcRealNames; }
/** The airline name shown on another airline's aircraft. */
function tfcLabel(c: TrafficCraft): string { return c.dname || c.airline; }
function trafficBtn(): string { return Mode.coop() ? '' : `<button class="icon-btn tfc-btn ${Traffic.on() ? 'on' : ''}" data-act="tfc-toggle" aria-label="Other airlines' aircraft" title="Other airlines' aircraft">${icon('fleet')}</button>`; }
