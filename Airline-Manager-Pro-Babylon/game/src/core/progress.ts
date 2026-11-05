// Progress: ranks for you and for the airline, the airline's popularity, and badges.
// Badges come in ladders (1, 5, 10, 25… flights; hours; smooth landings; every aircraft type, airport and
// country; fleet size, revenue, staff…), well over a thousand in all, in six tiers from Bronze to Legendary.
// Everything is worked out from what is already saved (flight log, fleet, money, staff), so nothing is lost.
// Badges are yours: only flights you fly yourself count. Hired pilots don't earn badges, and in co-op every
// pilot earns their own badges on their own device, from their own flights.

interface BadgeDef { id: string; group: 'pilot' | 'airline' | 'crew'; cat: string; title: string; desc: string; tier: number; metric: string; need: number; icon: string }

const TIER_NAMES = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Legendary'];
const PILOT_RANKS: [number, string][] = [[0, 'Cadet'], [500, 'Second Officer'], [2000, 'First Officer'], [6000, 'Senior First Officer'], [15000, 'Captain'], [35000, 'Senior Captain'], [70000, 'Training Captain'], [130000, 'Chief Pilot'], [250000, 'Master Aviator'], [500000, 'Legend of the Skies']];
const AIRLINE_RANKS: [number, string][] = [[0, 'Start-up'], [2000, 'Air Taxi Operator'], [8000, 'Regional Carrier'], [25000, 'National Carrier'], [70000, 'International Airline'], [160000, 'Major Airline'], [350000, 'Flag Carrier'], [700000, 'Global Airline'], [1500000, 'Alliance Leader'], [3000000, 'Aviation Empire']];

const LADDERS = {
  count: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
  small: [1, 3, 5, 10, 20, 35, 50, 75, 100],
  hours: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
  nm: [500, 1000, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000],
  pax: [100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000, 5000000],
  money: [100000, 500000, 1000000, 5000000, 10000000, 50000000, 100000000, 500000000, 1000000000],
  type: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
  typeH: [1, 10, 25, 50, 100, 250, 500, 1000],
  airport: [1, 5, 10, 25, 50, 100],
  country: [1, 10, 25, 50, 100, 250],
  fleetType: [1, 2, 5, 10],
  pop: [55, 60, 65, 70, 75, 80, 85, 90, 95, 100],
};

function _tierOf(i: number, n: number): number { return Math.min(5, Math.floor(i / Math.max(1, n) * 6)); }
function _fmtN(v: number): string { return v >= 1e6 ? (v / 1e6) + ' million' : num(v); }

let _badgeDefs: BadgeDef[] = null, _badgeKey = '';
function badgeDefs(): BadgeDef[] {
  // airport and country badges exist for the places you have landed (there are about 49,000 airports)
  const landed = Array.from(new Set(State.logbook.map(l => l.to).concat(State.logbook.map(l => l.from)))).filter(k => apt(k)).sort();
  const key = landed.join(',');
  if (_badgeDefs && key === _badgeKey) return _badgeDefs;
  _badgeKey = key;
  const out: BadgeDef[] = [];
  const ladder = (group: BadgeDef['group'], cat: string, metric: string, steps: number[], icon: string, title: (v: number, i: number) => string, desc: (v: number) => string) =>
    steps.forEach((v, i) => out.push({ id: metric + ':' + v, group, cat, metric, need: v, tier: _tierOf(i, steps.length), icon, title: title(v, i), desc: desc(v) }));
  // ---- you as a pilot
  ladder('pilot', 'Flights', 'p.flights', LADDERS.count, 'fleet', v => v === 1 ? 'First flight' : `${_fmtN(v)} flights`, v => `Fly ${_fmtN(v)} ${v === 1 ? 'leg' : 'legs'} in the simulator.`);
  ladder('pilot', 'Hours', 'p.hours', LADDERS.hours, 'clock', v => `${_fmtN(v)} hours`, v => `Log ${_fmtN(v)} block hours as a pilot.`);
  ladder('pilot', 'Landings', 'p.smooth', LADDERS.count, 'check', v => v === 1 ? 'Smooth operator' : `${_fmtN(v)} smooth landings`, v => `Land under 200 ft/min ${_fmtN(v)} ${v === 1 ? 'time' : 'times'}.`);
  ladder('pilot', 'Landings', 'p.butter', LADDERS.count, 'check', v => v === 1 ? 'Butter' : `${_fmtN(v)} butter landings`, v => `Land under 80 ft/min ${_fmtN(v)} ${v === 1 ? 'time' : 'times'}.`);
  ladder('pilot', 'Landings', 'p.streak', LADDERS.small, 'check', v => `${v} good landings in a row`, v => `Land ${v} times in a row without a hard landing.`);
  ladder('pilot', 'Distance', 'p.nm', LADDERS.nm, 'map', v => `${_fmtN(v)} nautical miles`, v => `Fly ${_fmtN(v)} nm in total.`);
  ladder('pilot', 'Explorer', 'p.airports', LADDERS.small, 'pin', v => v === 1 ? 'Off we go' : `${v} airports`, v => `Land at ${v} different ${v === 1 ? 'airport' : 'airports'}.`);
  ladder('pilot', 'Explorer', 'p.countries', [1, 2, 3, 5, 8, 10, 15, 20, 30, 50], 'map', v => `${v} ${v === 1 ? 'country' : 'countries'}`, v => `Land in ${v} different ${v === 1 ? 'country' : 'countries'}.`);
  ladder('pilot', 'Type ratings', 'p.types', [1, 2, 3, 5, 8, 10, 15, 20], 'fleet', v => `${v} aircraft ${v === 1 ? 'type' : 'types'}`, v => `Fly ${v} different aircraft ${v === 1 ? 'type' : 'types'}.`);
  ladder('pilot', 'Long haul', 'p.longhaul', LADDERS.count, 'map', v => v === 1 ? 'Long hauler' : `${_fmtN(v)} long-haul flights`, v => `Fly ${_fmtN(v)} legs longer than 2,500 nm.`);
  ladder('pilot', 'Short hops', 'p.shorthop', LADDERS.count, 'pin', v => v === 1 ? 'Island hopper' : `${_fmtN(v)} short hops`, v => `Fly ${_fmtN(v)} legs shorter than 150 nm.`);
  ladder('pilot', 'Passengers', 'p.pax', LADDERS.pax, 'pax', v => `${_fmtN(v)} passengers flown`, v => `Carry ${_fmtN(v)} passengers on your own flights.`);
  for (const t of AIRCRAFT) {
    ladder('pilot', 'Aircraft', 'p.type.' + t.id, LADDERS.type, 'fleet', v => `${t.model}: ${_fmtN(v)} ${v === 1 ? 'flight' : 'flights'}`, v => `Fly the ${t.maker} ${t.model} ${_fmtN(v)} ${v === 1 ? 'time' : 'times'}.`);
    ladder('pilot', 'Aircraft', 'p.typeh.' + t.id, LADDERS.typeH, 'clock', v => `${t.model}: ${_fmtN(v)} hours`, v => `Log ${_fmtN(v)} hours in the ${t.maker} ${t.model}.`);
  }
  for (const k of landed) {
    const a = apt(k); if (!a || k === 'DEP') continue;
    ladder('pilot', 'Airports', 'p.apt.' + k, LADDERS.airport, 'pin', v => `${a.city} ${v === 1 ? 'visitor' : '×' + v}`, v => `Land at ${a.name} (${k}) ${_fmtN(v)} ${v === 1 ? 'time' : 'times'}.`);
  }
  const countries = Array.from(new Set(landed.map(k => apt(k).country).filter(Boolean)));
  for (const c of countries) ladder('pilot', 'Countries', 'p.cty.' + c, LADDERS.country, 'map', v => `${c}: ${_fmtN(v)} ${v === 1 ? 'landing' : 'landings'}`, v => `Land in ${c} ${_fmtN(v)} ${v === 1 ? 'time' : 'times'}.`);
  // ---- the airline
  ladder('airline', 'Fleet', 'a.fleet', [1, 2, 3, 5, 8, 10, 15, 20, 30, 50, 75, 100, 150, 200], 'fleet', v => `Fleet of ${v}`, v => `Own ${v} ${v === 1 ? 'aircraft' : 'aircraft'} at once.`);
  for (const t of AIRCRAFT) ladder('airline', 'Fleet', 'a.ftype.' + t.id, LADDERS.fleetType, 'fleet', v => `${t.model} operator${v > 1 ? ' ×' + v : ''}`, v => `Have ${v} ${t.maker} ${t.model} in the fleet.`);
  for (const t of AIRCRAFT) ladder('airline', 'Operations', 'a.tlegs.' + t.id, [10, 50, 100, 250, 500, 1000, 2500], 'clock', v => `${t.model} fleet: ${_fmtN(v)} flights`, v => `Fly your airline's ${t.maker} ${t.model} ${_fmtN(v)} times yourself.`);
  for (const k of landed) { const a = apt(k); if (!a || k === 'DEP') continue;
    ladder('airline', 'Airports', 'a.apt.' + k, [10, 100, 500, 1000], 'pin', v => `${a.city} station ×${_fmtN(v)}`, v => `Land your airline at ${a.name} (${k}) ${_fmtN(v)} times yourself.`); }
  ladder('airline', 'Money', 'a.revenue', LADDERS.money, 'finance', v => `${money(v, { compact: true })} revenue`, v => `Earn ${money(v)} in revenue.`);
  ladder('airline', 'Money', 'a.balance', LADDERS.money, 'finance', v => `${money(v, { compact: true })} in the bank`, v => `Have a balance of ${money(v)}.`);
  ladder('airline', 'Network', 'a.routes', [1, 2, 3, 5, 10, 15, 20, 30, 50, 75, 100], 'routes', v => v === 1 ? 'First route' : `${v} routes`, v => `Run ${v} ${v === 1 ? 'route' : 'routes'}.`);
  ladder('airline', 'Network', 'a.dests', [2, 3, 5, 10, 15, 20, 30, 50, 75, 100], 'pin', v => `${v} destinations`, v => `Fly to ${v} different airports as an airline.`);
  ladder('airline', 'Operations', 'a.legs', LADDERS.count, 'clock', v => `${_fmtN(v)} airline ${v === 1 ? 'flight' : 'flights'}`, v => `Fly ${_fmtN(v)} ${v === 1 ? 'flight' : 'flights'} for your airline yourself.`);
  ladder('airline', 'Operations', 'a.pax', LADDERS.pax, 'pax', v => `${_fmtN(v)} passengers`, v => `Carry ${_fmtN(v)} passengers for your airline on your own flights.`);
  ladder('airline', 'Staff', 'a.staff', [1, 5, 10, 25, 50, 100, 250, 500, 1000], 'pilots', v => `${v} ${v === 1 ? 'employee' : 'employees'}`, v => `Employ ${v} people.`);
  ladder('airline', 'Staff', 'a.pilots', [1, 2, 3, 5, 10, 20, 50, 100], 'pilots', v => `${v} hired ${v === 1 ? 'pilot' : 'pilots'}`, v => `Hire ${v} ${v === 1 ? 'pilot' : 'pilots'}.`);
  ladder('airline', 'Awards', 'a.aotm', [1, 2, 3, 5, 10, 12, 24], 'trophy', v => v === 1 ? 'Airline of the Month' : `Airline of the Month ×${v}`, v => `Be named Airline of the Month ${v} ${v === 1 ? 'time' : 'times'}: the best airline of the league that month.`);
  ladder('airline', 'Awards', 'a.aoty', [1, 2, 3, 5, 10], 'trophy', v => v === 1 ? 'Airline of the Year' : `Airline of the Year ×${v}`, v => `Be named Airline of the Year ${v} ${v === 1 ? 'time' : 'times'}.`);
  ladder('pilot', 'Flight score', 'p.perfect', LADDERS.count, 'check', v => v === 1 ? 'Perfect flight' : `${_fmtN(v)} perfect flights`, v => `Fly ${_fmtN(v)} ${v === 1 ? 'flight' : 'flights'} with a flight score of 100.`);
  ladder('airline', 'Popularity', 'a.pop', LADDERS.pop, 'star', v => v === 100 ? 'Everyone\'s favourite' : `Popularity ${v}`, v => `Reach a popularity of ${v} out of 100.`);
  // ---- the crew
  ladder('crew', 'Crew', 'c.topRated', [1, 3, 5, 10, 25, 50, 100], 'star', v => `${v} top-rated crew`, v => `Have ${v} flight attendants or mechanics rated 4.5 or higher.`);
  ladder('crew', 'Crew', 'c.avgRating', [3.5, 3.8, 4, 4.2, 4.4, 4.6, 4.8], 'star', v => `Crew rated ${v}`, v => `Average crew rating of ${v} or higher.`);
  ladder('crew', 'Crew', 'c.clean', [7, 14, 30, 60, 90, 180, 365], 'shield', v => `${v} clean days`, v => `${v} days in a row without a conduct report.`);
  _badgeDefs = out;
  return out;
}

const Progress = {
  stats: {} as { [k: string]: number },

  /** Everything the badges and ranks measure, worked out from what is saved. */
  compute(): { [k: string]: number } {
    const S: any = State, st: { [k: string]: number } = {}, c = company(), me: any = myPilot();
    const inc = (k: string, v?: number) => { st[k] = (st[k] || 0) + (v == null ? 1 : v); };
    // only your own flights: not hired pilots' and not other co-op pilots'
    const mine = State.logbook.filter((l: any) => l.result !== 'crash' && !l.coopBy && l.atc !== 'Co-op');
    const apts = new Set<string>(), ctys = new Set<string>(), types = new Set<string>();
    let streak = 0, best = 0;
    for (const l of mine.slice().reverse()) {
      inc('p.flights'); inc('p.pax', l.pax || 0);
      const fpm = Math.abs(l.landingFpm || 0);
      if (fpm < 200) inc('p.smooth'); if (fpm < 80) inc('p.butter');
      if (l.result === 'ok' && fpm < 400) { streak++; best = Math.max(best, streak); } else streak = 0;
      const A = apt(l.from), B = apt(l.to), nm = A && B ? gcDistanceNm(A.pos, B.pos) : 0;
      inc('p.nm', nm); if (nm > 2500) inc('p.longhaul'); if (nm > 0 && nm < 150) inc('p.shorthop');
      if (B) { apts.add(l.to); ctys.add(B.country); inc('p.apt.' + l.to); inc('p.cty.' + B.country); }
      const tid = (l as any).typeId || (plane(l.reg) || {} as any).typeId;
      if (tid) { types.add(tid); inc('p.type.' + tid); inc('p.typeh.' + tid, (l.blockMin || 0) / 60); }
    }
    st['p.streak'] = best; st['p.airports'] = apts.size; st['p.countries'] = ctys.size; st['p.types'] = types.size;
    st['p.hours'] = me ? Math.floor(me.hoursMin / 60) : 0;
    // airline
    const fl = State.fleet.filter(a => a.companyId === c.id);
    st['a.fleet'] = fl.length; fl.forEach(a => inc('a.ftype.' + a.typeId));
    st['a.revenue'] = State.txns.filter(t => t.companyId === c.id && t.amount > 0 && !txByOthers(t)).reduce((s, t) => s + t.amount, 0);
    st['a.balance'] = c.balance;
    st['a.routes'] = State.routes.filter(r => r.companyId === c.id).length;
    const dests = new Set<string>(); State.routes.filter(r => r.companyId === c.id).forEach(r => r.legs.forEach(x => dests.add(x))); apts.forEach(x => dests.add(x));
    st['a.dests'] = dests.size;
    const pr = S.progress || {};
    st['a.legs'] = mine.length;
    st['a.pax'] = st['p.pax'] || 0;
    for (const t of Object.keys(st)) if (t.indexOf('p.type.') === 0) st['a.tlegs.' + t.slice(7)] = (st['a.tlegs.' + t.slice(7)] || 0) + st[t];
    for (const t of Object.keys(st)) if (t.indexOf('p.apt.') === 0) st['a.apt.' + t.slice(6)] = (st['a.apt.' + t.slice(6)] || 0) + st[t];
    const staff = staffOf(c.id), pilots = State.pilots.filter((p: any) => p.companyId === c.id && !p.you);
    st['a.staff'] = staff.length + pilots.length; st['a.pilots'] = pilots.filter((p: any) => !p.coPilotFor).length;
    st['a.pop'] = Math.round(c.reputation || 0);
    { const aw: any[] = (S.airlineAwards || []); st['a.aotm'] = aw.filter(x => x.kind === 'month').length; st['a.aoty'] = aw.filter(x => x.kind === 'year').length; st['p.perfect'] = State.logbook.filter((l: any) => !l.coopBy && l.score === 100).length; }
    const crew = staff.filter(x => x.role === 'fa' || x.role === 'mech');
    st['c.topRated'] = crew.filter(x => (x.rating || 0) >= 4.5).length;
    st['c.avgRating'] = crew.length ? Math.floor(crew.reduce((s, x) => s + (x.rating || 0), 0) / crew.length * 10) / 10 : 0;
    const lastInc = (S.incidents || [])[0];
    st['c.clean'] = Math.floor((Date.now() - (lastInc ? new Date(lastInc.date).getTime() : (pr.since || Date.now()))) / 864e5);
    this.stats = st;
    return st;
  },

  pilotXp(st: any): number {
    const S: any = State, earned = Object.keys(S.badges || {}).filter(k => (badgeDefs().filter(b => b.id === k)[0] || {} as any).group === 'pilot').length;
    return Math.round((st['p.flights'] || 0) * 60 + (st['p.hours'] || 0) * 25 + (st['p.smooth'] || 0) * 30 + (st['p.butter'] || 0) * 60 + (st['p.airports'] || 0) * 50 + (st['p.nm'] || 0) * 0.5 + earned * 40);
  },
  airlineXp(st: any): number {
    const S: any = State, earned = Object.keys(S.badges || {}).filter(k => (badgeDefs().filter(b => b.id === k)[0] || {} as any).group !== 'pilot').length;
    return Math.round((st['a.legs'] || 0) * 45 + (st['a.fleet'] || 0) * 600 + (st['a.revenue'] || 0) / 2000 + (st['a.dests'] || 0) * 150 + (st['a.pop'] || 0) * 200 + earned * 40);
  },
  rankOf(xp: number, table: [number, string][]): { name: string; level: number; from: number; to: number } {
    let i = 0; while (i < table.length - 1 && xp >= table[i + 1][0]) i++;
    return { name: table[i][1], level: i + 1, from: table[i][0], to: i < table.length - 1 ? table[i + 1][0] : table[i][0] };
  },

  /** Award every badge whose goal is met; announce new ones. */
  check(quiet?: boolean) {
    const S: any = State; S.badges = S.badges || {}; S.progress = S.progress || { since: Date.now() };
    const st = this.compute(), fresh: BadgeDef[] = [];
    // only your personal badges are awarded
    for (const b of badgeDefs()) if (b.group === 'pilot' && !S.badges[b.id] && (st[b.metric] || 0) >= b.need) { S.badges[b.id] = Date.now(); fresh.push(b); }
    if (!fresh.length) return;
    Store.soon();
    if (quiet) return;
    try {
      const top = fresh.sort((a, b) => b.tier - a.tier)[0];
      State.notices.unshift({ id: uid(), kind: 'staff' as any, title: fresh.length === 1 ? `Badge earned: ${top.title}` : `${fresh.length} badges earned`, body: fresh.slice(0, 4).map(b => `${b.title} (${TIER_NAMES[b.tier]})`).join(', ') + (fresh.length > 4 ? ' and more' : '') + '.', time: 'Now', read: false, ref: 'badges' } as any);
      renderTopbar();
      // revealed like a special card as soon as nothing else is open
      let tries = 0; const show = () => { if (document.hidden || document.querySelector('.layer.open') || document.body.classList.contains('v3d-on')) { if (++tries < 40) setTimeout(show, 2500); else toast(fresh.length === 1 ? `Badge earned: ${top.title}` : `${fresh.length} badges earned`, 'ok', { label: 'See', act: 'go-ranking' }); return; } badgeReveal(fresh); };
      setTimeout(show, 900);
    } catch (e) { /* interface not ready */ }
  },

  /** Raise or lower the airline's popularity (0-100) and remember why. */
  popularity(delta: number, why: string) {
    const S: any = State, c = company();
    c.reputation = clamp(Math.round(((c.reputation || 50) + delta) * 10) / 10, 0, 100);
    S.popLog = S.popLog || []; S.popLog.unshift({ t: Date.now(), cid: c.id, d: delta, why, v: c.reputation }); S.popLog = S.popLog.slice(0, 200);
  },

  /** After each of your legs: popularity and your rating follow how the flight went. */
  afterMyLeg(fpm: number, result: string) {
    const me: any = myPilot();
    const d = result === 'crash' ? -15 : result === 'incident' ? -3 : fpm >= 600 ? -1.5 : fpm < 120 ? 0.6 : fpm < 250 ? 0.3 : 0.1;
    this.popularity(d, d >= 0 ? 'A good flight' : 'A rough landing');
    if (me) me.rating = clamp(Math.round(((me.rating || 4) + (d > 0 ? 0.02 : d / 10)) * 100) / 100, 1, 5);
    this.check();
  },
  afterAiLeg(pax: number, typeId?: string, to?: string) {
    const S: any = State; S.progress = S.progress || { since: Date.now() };
    S.progress.aiLegs = (S.progress.aiLegs || 0) + 1; S.progress.aiPax = (S.progress.aiPax || 0) + (pax || 0);
    if (typeId) { S.progress.tlegs = S.progress.tlegs || {}; S.progress.tlegs[typeId] = (S.progress.tlegs[typeId] || 0) + 1; }
    if (to) { S.progress.alegs = S.progress.alegs || {}; S.progress.alegs[to] = (S.progress.alegs[to] || 0) + 1; }
    if (Math.random() < 0.3) this.popularity(0.1, 'Flights on time');
  },
};

/** Money earned by hired pilots or other co-op pilots: it goes to the airline but doesn't earn you badges. */
function txByOthers(t: any): boolean {
  if (t.coopBy || t.byPilot) return true;
  // older entries from hired pilots name the pilot in brackets after the route
  return t.kind === 'revenue' && !!t.flight && / \([^)]+\)$/.test(t.label || '');
}

/** How likely a crew member is to misbehave, from their rating: top-rated staff rarely do, poorly rated ones often. */
function conductFactor(rating: number): number { return clamp((5.4 - (rating || 3.5)) / 1.6, 0.15, 1.8); }

/** Crew ratings drift with behaviour: a little up for every quiet day, down for each conduct report. */
function crewRatingsDaily() {
  const S: any = State, day = new Date().toDateString();
  if (S.ratingDay === day) return; S.ratingDay = day;
  for (const p of (S.staff || [])) p.rating = clamp(Math.round(((p.rating || 3.5) + 0.02) * 100) / 100, 1, 5);
}

function startProgress() {
  Progress.check(true);
  crewRatingsDaily();
  setInterval(() => { crewRatingsDaily(); Progress.check(); }, 60000);
}

ACTIONS['go-ranking'] = el => { const t = el && el.closest('.toast'); if (t) t.remove(); closeAll(); go('ranking'); };
