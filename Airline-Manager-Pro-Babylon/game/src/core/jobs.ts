// Jobs: one-off work offered to the airline, on top of its scheduled routes.
//  - Charters: a group that wants an aircraft of its own (a football team, a wedding party, a tour
//    group, a film crew, guests for a fishing lodge…), paid as a whole, about 40% above normal fares.
//  - Cargo jobs: a load to take somewhere by a deadline (fresh fish, engine parts, medical supplies,
//    mail; groceries, fuel drums and building materials for bush strips), about 70% above normal rates.
//  - New jobs come in every few hours from your bases and wherever your aircraft are. Accept one and fly
//    it yourself, or give it to a hired pilot rated on a suitable aircraft: the pilot ferries the aircraft
//    to the job's airport if needed, flies the job and goes back to their route. Deliver late and the
//    customer takes 30% off; don't deliver at all and you pay 20% of the price and lose some popularity.
//  - Tours: a set of legs you fly yourself, in order, for a reward. One weekly challenge, a new one
//    every Monday.

interface Job {
  id: string; companyId: string; kind: 'pax' | 'cargo'; title: string; client: string; from: string; to: string;
  pax: number; kg: number; pay: number; nm: number; posted: number; expires: number; due: number;
  status: 'open' | 'accepted' | 'flying' | 'done' | 'late' | 'failed'; by?: string; reg?: string; queued?: boolean; doneAt?: number; tx?: string;
}
/** Special cargo: loads that need the right aircraft, and pay for it. */
const SPECIAL_CARGO: { id: string; title: string; client: string; chip: string; needText: string; need: (a: Aircraft, t: AircraftType, nm: number) => boolean; mult: number; dueH?: number }[] = [
  { id: 'animals', title: 'Live animals: racehorses with their grooms', client: 'Bloodstock agent', chip: 'Live animals', needText: 'a jet with a heated, pressurised hold', need: (a, t) => t.cls === 'widebody' || t.cls === 'airliner', mult: 2.2 },
  { id: 'cold', title: 'Vaccines kept at 2 to 8 °C', client: 'Pharmaceutical company', chip: 'Keep cold', needText: 'a flight of under 7 hours (as long as the cool boxes last)', need: (a, t, nm) => nm / Math.max(100, t.cruiseKt) < 7, mult: 2.0 },
  { id: 'oversize', title: 'A helicopter in a crate', client: 'Helicopter operator', chip: 'Oversized', needText: 'a freighter or a widebody', need: (a, t) => !!cabinOf(a).freighter || t.cls === 'widebody', mult: 2.4 },
  { id: 'aog', title: 'An engine part for a grounded airliner (AOG)', client: 'Another airline', chip: 'Urgent: AOG', needText: '', need: () => true, mult: 3, dueH: 10 },
];
/** Helicopter missions: who asks, where to, what for. Only helicopters fly them. */
const HELI_MISSIONS: { id: string; chip: string; role: string[]; to: string; titles: string[][]; pax: [number, number]; kg?: [number, number]; rate: number; dueH: number; back?: boolean }[] = [
  { id: 'hems', chip: 'Air ambulance', role: ['hems'], to: 'h', titles: [['Patient transfer to a specialist hospital', 'Regional hospital'], ['Trauma patient from a road accident', 'Air ambulance service'], ['Newborn intensive-care transfer', 'Children\'s hospital'], ['Organ for a transplant', 'Transplant coordinator']], pax: [1, 3], rate: 95, dueH: 3 },
  { id: 'sar', chip: 'Search and rescue', role: ['sar'], to: 'any', titles: [['Hoist rescue: an injured walker on a mountain', 'Rescue coordination centre'], ['Search for a missing fishing boat', 'Coastguard'], ['Medical evacuation from a ship', 'Maritime rescue centre'], ['Rescue from a flooded farm', 'Emergency services']], pax: [1, 4], rate: 110, dueH: 2, back: true },
  { id: 'offshore', chip: 'Offshore', role: ['offshore'], to: 'o', titles: [['Offshore crew change', 'Oil and gas operator'], ['Wind-farm technicians to a platform', 'Offshore wind operator'], ['Supplies to a helideck', 'Platform logistics']], pax: [6, 19], rate: 70, dueH: 18, back: true },
  { id: 'vip', chip: 'VIP', role: ['vip', 'passenger', 'corporate'], to: 'c', titles: [['Executive shuttle to a city heliport', 'Corporate travel office'], ['Wedding couple to their venue', 'A family'], ['Guests to a race meeting', 'Event agency'], ['Business leaders to a summit', 'Conference organiser']], pax: [2, 8], rate: 55, dueH: 20 },
  { id: 'tour', chip: 'Sightseeing', role: ['sightseeing', 'passenger', 'vip'], to: 'c', titles: [['Sightseeing flight over the coast', 'Tour operator'], ['Glacier and fjord tour', 'Adventure travel'], ['Photo flight for a property agent', 'Estate agent']], pax: [2, 6], rate: 45, dueH: 30, back: true },
  { id: 'sling', chip: 'Sling load', role: ['utility', 'cargo', 'firefighting'], to: 'c', titles: [['Sling load: building materials to a mountain hut', 'Contractor'], ['Sling load: a power-line pylon section', 'Power company'], ['Water bucket for a forest fire', 'Fire service']], pax: [0, 0], kg: [300, 1800], rate: 4.2, dueH: 24 },
];
/** What a helicopter can lift on its cargo hook (about 55% of the difference between its maximum and empty weights). */
function slingLimitKg(t: AircraftType): number { const S = speedSpec(t.id); return Math.round(Math.max(0, (S.mtow - S.oew) * 1000 * 0.55) / 50) * 50; }
function heliMission(j: Job): typeof HELI_MISSIONS[0] { const k = (j as any).heli; return k ? HELI_MISSIONS.filter(x => x.id === k)[0] || null : null; }
function specialCargo(j: Job): typeof SPECIAL_CARGO[0] { const k = (j as any).special; return k ? SPECIAL_CARGO.filter(x => x.id === k)[0] || null : null; }
interface Tour { id: string; name: string; desc: string; legs: string[]; reward: number; bush?: boolean }
interface JobsState { list: Job[]; next: { [cid: string]: number }; tours: { [id: string]: { start: number; idx: number; done?: number } }; weekly: { [week: string]: number } }

const PAX_JOBS = [['Football team to an away match', 'Supporters\' club'], ['Wedding party', 'A family'], ['Company conference group', 'Event agency'], ['Tour group', 'Tour operator'], ['Orchestra on tour', 'Concert agency'],
  ['School trip', 'A school'], ['Film crew and their kit', 'Production company'], ['Medical team', 'Health service'], ['Ski club', 'Sports club'], ['Rescue team going home', 'Search and rescue']];
const BUSH_PAX = [['Fishing lodge guests', 'Fishing lodge'], ['Hunting party', 'Outfitter'], ['Survey team', 'Geology survey'], ['Park rangers', 'National park'], ['Doctor\'s visit to a village', 'Health clinic']];
const CARGO_JOBS = [['Fresh fish', 'Seafood exporter'], ['Spare engine parts', 'Maintenance shop'], ['Medical supplies', 'Hospital'], ['Mail', 'Postal service'], ['Machinery', 'Factory'], ['Flowers', 'Flower wholesaler'], ['Live lobsters', 'Seafood exporter'], ['Electronics', 'Freight forwarder']];
const BUSH_CARGO = [['Groceries for a remote village', 'Village store'], ['Fuel drums', 'Fishing lodge'], ['Building materials', 'Contractor'], ['Mail and parcels', 'Postal service'], ['Spare parts for a generator', 'Village council']];

const TOURS: Tour[] = [
  { id: 'north-atlantic', name: 'North Atlantic islands', desc: 'The Faroes, Iceland and Greenland: short runways, wind and weather.', legs: ['EKVG', 'BIKF', 'BGSF', 'BGBW', 'BIKF', 'EKVG'], reward: 120000 },
  { id: 'nordic', name: 'Nordic capitals', desc: 'Copenhagen, Oslo, Stockholm and Helsinki.', legs: ['EKCH', 'ENGM', 'ESSA', 'EFHK', 'EKCH'], reward: 90000 },
  { id: 'europe', name: 'Grand tour of Europe', desc: 'Nine of Europe\'s great airports in a row.', legs: ['EGLL', 'LFPG', 'LEMD', 'LPPT', 'LIRF', 'LGAV', 'LOWW', 'EDDF', 'EHAM'], reward: 250000 },
  { id: 'atlantic', name: 'Across the Atlantic', desc: 'From Copenhagen by way of Iceland to North America and back to London.', legs: ['EKCH', 'BIKF', 'KBOS', 'KJFK', 'CYYZ', 'EGLL'], reward: 300000 },
  { id: 'alaska', name: 'Alaska bush circuit', desc: 'Lake Hood to Talkeetna, Fairbanks, Nome, King Salmon, Homer and Kenai.', legs: ['PALH', 'PATK', 'PAFA', 'PAOM', 'PAKN', 'PAHO', 'PAEN', 'PALH'], reward: 40000, bush: true },
  { id: 'asia', name: 'Gulf to the Far East', desc: 'Doha, Delhi, Singapore, Hong Kong, Seoul and Tokyo.', legs: ['OTHH', 'VIDP', 'WSSS', 'VHHH', 'RKSI', 'RJTT'], reward: 400000 },
  { id: 'americas', name: 'The Americas', desc: 'Seattle down the west of the Americas to Santiago.', legs: ['KSEA', 'KLAX', 'KDFW', 'MPTO', 'SKBO', 'SCEL'], reward: 350000 },
  { id: 'world', name: 'Around the world', desc: 'Amsterdam, Dubai, Singapore, Sydney, Auckland, Los Angeles, New York and home.', legs: ['EHAM', 'OMDB', 'WSSS', 'YSSY', 'NZAA', 'KLAX', 'KJFK', 'EHAM'], reward: 1200000 },
];

const CHALLENGES = [
  { id: 'butter', name: 'Butter week', desc: 'Five landings under 150 fpm.', target: 5, reward: 45000 },
  { id: 'legs', name: 'Busy week', desc: 'Fly 8 legs yourself.', target: 8, reward: 40000 },
  { id: 'distance', name: 'Long way round', desc: 'Fly 3,000 nm yourself.', target: 3000, reward: 50000 },
  { id: 'airports', name: 'Explorer', desc: 'Land at 5 different airports.', target: 5, reward: 35000 },
  { id: 'pax', name: 'Full cabins', desc: 'Carry 600 passengers yourself.', target: 600, reward: 45000 },
  { id: 'streak', name: 'Steady hands', desc: 'Three landings in a row under 250 fpm.', target: 3, reward: 30000 },
];

function jobsState(): JobsState {
  const S: any = State; if (!S.jobs) S.jobs = {};
  // a save started from scratch (or a new co-op airline) can have an empty jobs record: fill in what's missing
  const J = S.jobs; J.list = J.list || []; J.next = J.next || {}; J.tours = J.tours || {}; J.weekly = J.weekly || {};
  return J;
}
function jobById(id: string): Job { return jobsState().list.filter(j => j.id === id)[0] || null; }
function jobPayFor(id: string): { pay: number; title: string } { const j = jobById(id); return j ? { pay: j.pay, title: j.title + ' ' + j.from + '–' + j.to } : undefined; }

/** Can this aircraft fly this job: enough seats or cargo room, and the range. */
function jobFits(j: Job, a: Aircraft): string {
  const t = acType(a.typeId);
  if (j.kind === 'pax' && cabinSeats(t, a) < j.pax) return `${cabinSeats(t, a)} seats, needs ${j.pax}`;
  if (heliMission(j) && heliMission(j).id === 'sling') { const lim = slingLimitKg(t); if (lim < j.kg) return `${num(lim)} kg on the hook, the load is ${num(j.kg)} kg`; }
  else if (j.kind === 'cargo' && cargoCapacity(a) < j.kg) return `${num(cargoCapacity(a))} kg of cargo room, needs ${num(j.kg)} kg`;
  if (heliMission(j) && t.cls !== 'helicopter') return 'a helicopter mission';
  if (heliMission(j) && heliMission(j).id === 'sar' && !hoistHeli(t)) return 'search and rescue needs a helicopter with a rescue hoist';
  if (heliMission(j) && heliMission(j).id === 'hems' && ((t as any).roles || []).indexOf('hems') < 0) return 'an air-ambulance helicopter';
  const sp = specialCargo(j); if (sp && !sp.need(a, t, j.nm)) return `${sp.chip.toLowerCase()}: needs ${sp.needText}`;
  if (j.nm > usableRange(t)) return `range ${num(usableRange(t))} nm, the job is ${num(j.nm)} nm`;
  const rc = legRunwayCheck(t.id, j.from, j.to, j.kind === 'pax' ? j.pax : 0);
  if (!rc.ok || (j.kind === 'pax' && rc.maxPax < j.pax)) return rc.why || 'the runways are too short for this load';
  return '';
}

/** The ISO week of a date, as 2026-W44. */
function weekKey(d: Date): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())), day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear(), w = Math.ceil(((t.getTime() - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7);
  return `${y}-W${String(w).padStart(2, '0')}`;
}

const Jobs = {
  /** New jobs, and jobs that ran out. */
  advance(quiet?: boolean) {
    const J = jobsState(), now = Date.now(); let changed = false;
    for (const j of J.list) {
      if (j.status === 'open' && j.expires < now) { j.status = 'failed'; j.doneAt = now; (j as any).expired = true; changed = true; }
      if ((j.status === 'accepted') && j.due < now) {
        j.status = 'failed'; j.doneAt = now; changed = true;
        const fee = Math.round(j.pay * 0.2);
        payTxn(j.companyId, `Charter cancelled: ${j.title}`, -fee, 'charter', [[`Not delivered to ${j.to} in time: 20% of ${money(j.pay)}`, -fee]]);
        try { Progress.popularity(-1, 'A charter not delivered'); } catch (e) { /* ignore */ }
noticesAt(Date.now());
        State.notices.unshift({ id: uid(), kind: 'company', title: `Job not delivered: ${j.title}`, body: `${j.from} to ${j.to} was due ${dateStr(new Date(j.due))}. ${money(fee)} paid to ${j.client}.`, time: 'Now', read: false } as any);
        noticesAt(j.due);
      }
    }
    // keep the last 60 finished jobs
    const fin = J.list.filter(j => j.status !== 'open' && j.status !== 'accepted' && j.status !== 'flying');
    if (fin.length > 60) { const drop = fin.slice(0, fin.length - 60).map(j => j.id); J.list = J.list.filter(j => drop.indexOf(j.id) < 0); }
    for (const c of State.companies) {
      if (!fleetOf(c.id).length) continue;
      const open = J.list.filter(j => j.companyId === c.id && j.status === 'open').length;
      if ((J.next[c.id] || 0) <= now || open < 3) {
        const n = Math.max(0, 8 - open);
        for (let i = 0; i < n; i++) { const j = this.make(c, now + i); if (j) { J.list.push(j); changed = true; } }
        J.next[c.id] = now + 3 * 3600e3;
      }
    }
    // the weekly challenge
    try { this.checkWeekly(quiet); } catch (e) { /* ignore */ }
    if (changed) Store.soon();
  },

  /** One new job for an airline, from a base or where an aircraft is, to an airport its fleet can reach. */
  make(c: Company, seed: number): Job {
    const fl = fleetOf(c.id); if (!fl.length) return null;
    const bush = c.kind === 'bush';
    const a = fl[Math.floor(Math.random() * fl.length)], t = acType(a.typeId);
    if (t.cls === 'helicopter') return this.makeHeli(c, a, t);
    const starts = [c.hub].concat(fl.map(x => x.base), fl.map(x => x.location)).filter(x => !!apt(x));
    const from = starts[Math.floor(Math.random() * starts.length)]; if (!from) return null;
    const A = apt(from), max = usableRange(t) * 0.9, min = bush ? 15 : 90;
    let cands: string[] = Object.keys(AIRPORTS).filter(k => k !== from && k !== 'DEP' && (bush ? bushApt(k) : airlineApt(k)));
    try { if (World.ready && !bush) cands = cands.concat((World.list as any[]).filter(w => w.size >= 1 && w.sched && Math.abs(w.pos[1] - A.pos[1]) < max / 60).map(w => w.icao).slice(0, 4000)); } catch (e) { /* not loaded */ }
    cands = cands.filter(k => { const B = apt(k); if (!B) return false; const d = gcDistanceNm(A.pos, B.pos); return d >= min && d <= max; });
    if (!cands.length) return null;
    const to = cands[Math.floor(Math.random() * cands.length)]; registerWorldAirport(to);
    const nm = Math.round(gcDistanceNm(A.pos, apt(to).pos));
    const cargo = Math.random() < (cabinOf(a).freighter ? 0.8 : 0.4);
    const pick = (l: string[][]) => l[Math.floor(Math.random() * l.length)];
    const [title, client] = cargo ? pick(bush ? BUSH_CARGO : CARGO_JOBS) : pick(bush ? BUSH_PAX : PAX_JOBS);
    const now = Date.now();
    let pax = 0, kg = 0, pay = 0;
    if (cargo) {
      const cap = cabinOf(a).freighter ? cargoCapacity(a) : Math.max(cargoCapacity(a), bush ? 400 : 1500);
      kg = Math.max(bush ? 80 : 300, Math.round(cap * (0.3 + Math.random() * 0.6) / 10) * 10);
      pay = Math.round(kg * cargoRate(from, to, t.cls) * 1.7 + (bush ? 350 : 1500));
    } else {
      pax = Math.max(bush ? 2 : 12, Math.round(cabinSeats(t, a) * (0.45 + Math.random() * 0.55)));
      pay = Math.round(pax * economyFare(t.id, from, to) * 1.4 + (bush ? 250 : 2500));
    }
    const hrs = 6 + Math.floor(Math.random() * 18);
    const job: any = { id: 'job-' + uid(), companyId: c.id, kind: cargo ? 'cargo' : 'pax', title, client, from, to, pax, kg, pay: Math.round(pay / 10) * 10, nm, posted: now, expires: now + hrs * 3600e3,
      due: now + (hrs + 24 + Math.floor(Math.random() * 48) + Math.round(nm / 300)) * 3600e3, status: 'open' };
    // now and then a special load: it needs the right aircraft, and pays for it
    if (cargo && !bush && Math.random() < 0.25) {
      const sp = SPECIAL_CARGO[Math.floor(Math.random() * SPECIAL_CARGO.length)];
      job.special = sp.id; job.title = sp.title; job.client = sp.client; job.pay = Math.round(pay * sp.mult / 10) * 10;
      if (sp.id === 'oversize') job.kg = Math.max(job.kg, 2500);
      if (sp.dueH) { job.expires = now + 2 * 3600e3; job.due = now + (sp.dueH + Math.round(nm / 400)) * 3600e3; }
    }
    return job;
  },

  /** A helicopter mission from where the helicopter is based: hospitals, helidecks, heliports nearby. */
  makeHeli(c: Company, a: Aircraft, t: AircraftType): Job {
    const roles: string[] = (t as any).roles || ['passenger'];
    const ms = HELI_MISSIONS.filter(m => m.role.some(r => roles.indexOf(r) >= 0) && (m.id !== 'sar' || hoistHeli(t)));
    const from = apt(a.location) ? a.location : apt(a.base) ? a.base : c.hub, A = apt(from); if (!A) return null;
    const list = (ms.length ? ms : HELI_MISSIONS.filter(x => x.id === 'vip')).slice().sort(() => Math.random() - 0.5);
    let m = list[0], pool: string[] = [], max = 0;
    for (const mm of list) {   // the first mission that has somewhere to go from here (no helidecks inland, say)
      m = mm; max = Math.min(usableRange(t) * (m.back ? 0.42 : 0.85), 160);
      pool = World.helisNear(A.pos, max, m.to === 'any' || m.to === 'c' ? undefined : m.to).filter(w => w.icao !== from && gcDistanceNm(A.pos, w.pos) >= 6).map(w => w.icao);
      if (m.to === 'c' || m.to === 'any') pool = pool.concat((World.list as any[]).filter(w => Math.abs(w.pos[1] - A.pos[1]) < max / 60 && gcDistanceNm(A.pos, w.pos) <= max && gcDistanceNm(A.pos, w.pos) >= 10).map(w => w.icao).slice(0, 200));
      if (pool.length) break;
    }
    if (!pool.length) return null;
    const to = pool[Math.floor(Math.random() * Math.min(pool.length, 40))]; registerWorldAirport(to);
    const nm = Math.max(5, Math.round(gcDistanceNm(A.pos, apt(to).pos))), [title, client] = m.titles[Math.floor(Math.random() * m.titles.length)];
    const seats = Math.max(1, cabinSeats(t, a)), pax = m.pax[1] ? Math.min(seats, m.pax[0] + Math.floor(Math.random() * (m.pax[1] - m.pax[0] + 1))) : 0;
    const kg = m.kg ? Math.max(100, Math.min(slingLimitKg(t), Math.round((m.kg[0] + Math.random() * (m.kg[1] - m.kg[0])) / 10) * 10)) : 0;
    const legs = m.back ? 2 : 1, now = Date.now();
    const pay = Math.round(((kg ? kg * m.rate : 0) + t.costPerHr * (nm * legs / Math.max(80, t.cruiseKt)) * 1.9 + nm * legs * m.rate + (m.id === 'sar' || m.id === 'hems' ? 6500 : 1800)) / 10) * 10;
    return { id: 'job-' + uid(), companyId: c.id, kind: kg ? 'cargo' : 'pax', title, client, from, to, pax, kg, pay, nm, posted: now, expires: now + (m.dueH <= 3 ? 1.5 : 8) * 3600e3,
      due: now + (m.dueH + nm / 100) * 3600e3, status: 'open', heli: m.id, back: !!m.back } as any;
  },

  /** You fly it yourself. */
  acceptMine(id: string): string {
    const j = jobById(id); if (!j || j.status !== 'open') return 'gone';
    const a = plane((State as any).myReg[j.companyId]); if (!a) return 'no-aircraft';
    const why = jobFits(j, a); if (why) return why;
    j.status = 'accepted'; j.by = 'you'; j.reg = a.reg;
    return 'ok';
  },
  /** A hired pilot flies it, in an aircraft that suits it (ferried to the job's airport first if needed). */
  acceptPilot(id: string, pilotId: string, reg: string): string {
    const j = jobById(id), p: any = pilot(pilotId), a = plane(reg), S: any = State;
    if (!j || j.status !== 'open') return 'The job is gone';
    if (!p || !a) return 'Choose a pilot and an aircraft';
    if (!Ratings.rated(p, a.typeId)) return `${p.name} isn't rated on the ${acType(a.typeId).model}`;
    if (p.status === 'training') return `${p.name} is on a course`;
    if (jobsState().list.some(x => x.queued && x.by === pilotId && x.status === 'accepted')) return `${p.name} already has a job waiting for after this flight`;
    if (State.live.some(f => f.reg === reg) || (S.aiNext || []).some((n: any) => n.reg === reg) || a.status !== 'parked' || ((a as any).jobHold && (a as any).jobHold !== id)) return `${reg} isn't free`;
    const why = jobFits(j, a); if (why) return `${reg}: ${why}`;
    // a pilot in the air takes the job after landing: the aircraft is kept for it, and they travel to it then
    if (State.live.some(f => f.pilotId === pilotId)) {
      j.status = 'accepted'; j.by = pilotId; j.reg = reg; j.queued = true; (a as any).jobHold = j.id;
      return 'queued';
    }
    // a pilot on the ground between route legs: the job comes first, the route waits
    S.aiNext = (S.aiNext || []).filter((n: any) => !(n.pilotId === pilotId && !n.job && !n.jobNext));
    const c = company(j.companyId), t = acType(a.typeId), spd = aiSpeed();
    const callsign = c.icao + (8000 + (_hashStr(j.id) % 1000));
    const base = { reg, pilotId, spd, depAt: Date.now() + AI_TURN_MIN * 60e3 / spd, dutyMin: 0, leg: 0, callsign, paxMax: cabinSeats(t, a) };
    S.aiNext = S.aiNext || [];
    jobLegsStart(j, p, a, base);
    return 'ok';
  },
  /** A pilot who was flying when you gave them a job has landed: they go to the job's aircraft and fly it.
   *  Returns the first leg (null when nothing is waiting for them). */
  queuedAfterLanding(pilotId: string, at: string, landedAt: number, spd: number, dutyMin: number): any {
    const j = jobsState().list.filter(x => x.queued && x.by === pilotId && x.status === 'accepted')[0]; if (!j) return null;
    const p: any = pilot(pilotId), a = plane(j.reg), c = company(j.companyId);
    j.queued = false; if (a) delete (a as any).jobHold;
    if (!p || !a || a.status !== 'parked' || State.live.some(f => f.reg === a.reg)) { j.status = 'open'; j.by = undefined; j.reg = undefined;
      State.notices.unshift({ id: uid(), kind: 'pilot', title: `Job back on the board: ${j.title}`, body: `${j.reg || 'The aircraft'} was no longer free when ${p ? p.name : 'the pilot'} landed, so ${j.from} to ${j.to} is open again.`, time: 'Now', at: landedAt, read: false } as any); return null; }
    // travel to the aircraft (on the next flight out, or across the apron), and rest first if the duty day is used up
    const A = apt(at), B = apt(a.location), nm = A && B && at !== a.location ? gcDistanceNm(A.pos, B.pos) : 0;
    const travelMin = nm ? Math.round(90 + nm / 420 * 60) : AI_TURN_MIN;
    const maxDuty = ((p.rules && p.rules.maxDutyHrs) || 10) * 60, rest = dutyMin + travelMin > maxDuty - 120;
    const depAt = landedAt + ((rest ? AI_REST_H * 60 : 0) + travelMin) * 60e3 / spd;
    p.status = 'flying';
    State.notices.unshift({ id: uid(), kind: 'pilot', title: `${p.name} is on the way to ${a.reg}`, body: `${p.name} landed at ${at}${nm ? ` and travels to ${a.location} (about ${Math.round(travelMin / 60 * 10) / 10} h)` : ''}${rest ? ' after a rest' : ''} to fly ${j.title}: ${j.from} to ${j.to}.`, time: 'Now', at: landedAt, read: false } as any);
    const t = acType(a.typeId), callsign = c.icao + (8000 + (_hashStr(j.id) % 1000));
    return jobLegsStart(j, p, a, { reg: a.reg, pilotId, spd, depAt, dutyMin: 0, leg: 0, callsign, paxMax: cabinSeats(t, a) }, true);
  },
  release(id: string) { const j = jobById(id); if (j && j.status === 'accepted' && j.by === 'you') { j.status = 'open'; j.by = undefined; j.reg = undefined; } },

  loadFor(id: string): { pax: number; paxJ: number; paxF: number; cargoKg: number } {
    const j = jobById(id); return j ? { pax: j.pax, paxJ: 0, paxF: 0, cargoKg: j.kg } : { pax: 0, paxJ: 0, paxF: 0, cargoKg: 0 };
  },
  /** Your own leg: the job you accepted for this city pair, if your aircraft can carry it. */
  forMyLeg(from: string, to: string, reg: string): Job {
    return jobsState().list.filter(j => j.status === 'accepted' && j.by === 'you' && j.from === from && j.to === to && (!plane(reg) || !jobFits(j, plane(reg))))[0] || null;
  },
  /** The job's flight reached the gate. The pay is in the flight's money; a late delivery costs 30%. */
  delivered(id: string, at: number, net: number, txId: string) {
    const j = jobById(id); if (!j || (j.status !== 'accepted' && j.status !== 'flying')) return;
    j.doneAt = at; j.tx = txId;
    if (at > j.due) {
      j.status = 'late'; const cut = Math.round(j.pay * 0.3);
      payTxn(j.companyId, `Late delivery: ${j.title}`, -cut, 'charter', [[`${j.client} takes 30% off for the late delivery`, -cut]], at);
    } else { j.status = 'done'; try { Progress.popularity(0.5, 'A charter delivered on time'); } catch (e) { /* ignore */ } }
    const who = j.by === 'you' ? 'You' : (pilot(j.by) || { name: 'Your pilot' } as any).name;
    State.notices.unshift({ id: uid(), kind: 'company', title: `${j.status === 'late' ? 'Delivered late' : 'Job done'}: ${j.title}`, body: `${who} flew ${j.from} to ${j.to} for ${j.client}. ${money(j.pay)}${j.status === 'late' ? ' less 30% for being late' : ''}.`, time: 'Now', read: false, tx: txId } as any);
    try { Online.discord('jobs', `Job done: ${j.title}`, `${who} flew ${j.from} → ${j.to} for ${j.client}. ${money(j.pay)}.`); } catch (e) { /* ignore */ }
  },
  /** After a hired pilot lands: the next leg of a job (the job itself after the ferry, then back to the route). */
  afterAiLanding(f: any, at: number, spd: number): any {
    const base = { reg: f.reg, pilotId: f.pilotId, spd, depAt: at + AI_TURN_MIN * 60e3 / spd, dutyMin: 0, leg: (f.leg || 0) + 1, callsign: f.callsign, paxMax: f.paxMax };
    if (f.ferry && f.jobNext) { const j = jobById(f.jobNext); if (j && j.status === 'accepted') { j.status = 'flying'; return Object.assign({ from: f.to, to: j.to, job: j.id }, base); } return null; }
    if (f.job) {
      const r = State.routes.filter(x => x.pilotId === f.pilotId && !x.test && !x.flownAt)[0];
      if (r && r.legs.indexOf(f.to) < 0) return Object.assign({ from: f.to, to: r.legs[0], ferry: true }, base, { callsign: r.code });
    }
    return null;
  },

  /* ---------- Tours ---------- */
  tourStart(id: string) { jobsState().tours[id] = { start: Date.now(), idx: 0 }; },
  tourStop(id: string) { delete jobsState().tours[id]; },
  /** Your own leg: the next leg of any tour you are flying. */
  afterMyLeg(from: string, to: string, fpm: number) {
    const J = jobsState();
    for (const t of TOURS) {
      const st = J.tours[t.id]; if (!st || st.done) continue;
      if (t.legs[st.idx] === from && t.legs[st.idx + 1] === to) {
        st.idx++;
        if (st.idx >= t.legs.length - 1) {
          st.done = Date.now();
          payTxn(company().id, `Tour completed: ${t.name}`, t.reward, 'charter', [[`${t.legs.length - 1} legs flown: ${t.legs.join(' – ')}`, t.reward]]);
          try { Progress.popularity(3, 'A tour completed'); } catch (e) { /* ignore */ }
          State.notices.unshift({ id: uid(), kind: 'company', title: `Tour completed: ${t.name}`, body: `All ${t.legs.length - 1} legs flown. ${money(t.reward)} for the airline.`, time: 'Now', read: false } as any);
          try { toast(`Tour completed: ${t.name}, ${money(t.reward, { sign: true })}`, 'ok'); Online.discord('jobs', `Tour completed: ${t.name}`, t.legs.join(' → ')); } catch (e) { /* ignore */ }
        } else try { toast(`${t.name}: leg ${st.idx} of ${t.legs.length - 1} done. Next ${t.legs[st.idx]} to ${t.legs[st.idx + 1]}`, 'info'); } catch (e) { /* ignore */ }
      }
    }
  },

  /* ---------- Weekly challenge ---------- */
  challenge(d?: Date) { const wk = weekKey(d || new Date()), n = parseInt(wk.slice(-2), 10) + parseInt(wk.slice(0, 4), 10); return { wk, c: CHALLENGES[n % CHALLENGES.length] }; },
  /** Your own legs this week (Monday to Sunday). */
  myWeek(): LogEntry[] {
    const wk = weekKey(new Date());
    return State.logbook.filter((l: any) => !l.coopBy && l.atc !== 'Co-op' && l.result !== 'crash' && l.decision !== 'disregarded' && weekKey(new Date(l.date.replace(' ', 'T'))) === wk);
  },
  progress(): number {
    const { c } = this.challenge(), ls = this.myWeek();
    switch (c.id) {
      case 'butter': return ls.filter(l => Math.abs(l.landingFpm) < 150).length;
      case 'legs': return ls.length;
      case 'distance': return Math.round(ls.reduce((t, l) => { const A = apt(l.from), B = apt(l.to); return t + (A && B ? gcDistanceNm(A.pos, B.pos) : 0); }, 0));
      case 'airports': return new Set(ls.map(l => l.to)).size;
      case 'pax': return ls.reduce((t, l) => t + (l.pax || 0), 0);
      case 'streak': { let best = 0, run = 0; ls.slice().reverse().forEach(l => { run = Math.abs(l.landingFpm) < 250 ? run + 1 : 0; best = Math.max(best, run); }); return best; }
    }
    return 0;
  },
  checkWeekly(quiet?: boolean) {
    const J = jobsState(), { wk, c } = this.challenge();
    if (J.weekly[wk] || this.progress() < c.target) return;
    J.weekly[wk] = Date.now();
    payTxn(company().id, `Weekly challenge: ${c.name}`, c.reward, 'charter', [[c.desc, c.reward]]);
    try { Progress.popularity(1, 'The weekly challenge'); } catch (e) { /* ignore */ }
    State.notices.unshift({ id: uid(), kind: 'company', title: `Weekly challenge done: ${c.name}`, body: `${c.desc} ${money(c.reward)} for the airline.`, time: 'Now', read: false } as any);
    if (!quiet) try { toast(`Weekly challenge done: ${c.name}, ${money(c.reward, { sign: true })}`, 'ok'); } catch (e) { /* ignore */ }
  },
};

/** The job's first leg for an AI pilot: a ferry to the job's airport when the aircraft is elsewhere. */
function jobLegsStart(j: Job, p: any, a: Aircraft, base: any, ret?: boolean): any {
  const S: any = State; S.aiNext = S.aiNext || [];
  const leg = a.location !== j.from ? Object.assign({ from: a.location, to: j.from, ferry: true, jobNext: j.id }, base) : Object.assign({ from: j.from, to: j.to, job: j.id }, base);
  j.status = 'accepted'; j.by = p.id; j.reg = a.reg; j.queued = false; p.status = 'flying';
  if (ret) return leg;
  S.aiNext.push(leg); return leg;
}
