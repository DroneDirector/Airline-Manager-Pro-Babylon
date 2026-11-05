// Co-op: several real pilots flying for the same airline (your own or a real-world one). Everyone's
// flights land in one shared airline: the same balance, fleet, logbook, popularity and rankings.
//
// How it is built: the airline's shared history is a list of events (a pilot joined, a flight landed,
// an aircraft was bought…). Each app sends its own events and applies everyone else's exactly once,
// so all members end up with the same airline. Where the events live is up to the backend:
//  - 'demo': no online service yet. Three sample pilots join your airline and fly its routes on the
//    real clock, so co-op can be tried and every screen shows real behaviour.
//  - 'supabase': the online service (being set up). Same events, stored and shared through Supabase,
//    with sign-in, invite codes and checks that flights are genuine.

interface CoopMember {
  id: string; name: string; role: 'owner' | 'pilot'; you?: boolean; sex: 'm' | 'f'; nat: string; base: string;
  flights: number; hoursMin: number; revenue: number; rating: number; joined: number; lastSeen: number; look?: any;
}
interface CoopEvent { id: string; at: number; by: string; type: 'start' | 'join' | 'flight' | 'buy' | 'leave' | 'rule' | 'pirep' | 'sell' | 'offer' | 'offer-reply'; text: string; amount?: number; tx?: string }
interface CoopState {
  on: boolean; backend: 'demo' | 'supabase'; code: string; companyId: string; started: number;
  members: CoopMember[]; feed: CoopEvent[]; applied: { [id: string]: 1 };
  rules: { ownerBuys: boolean; reviewPireps?: boolean }; next: { [memberId: string]: number }; pireps?: CoopPirep[];
}

/** The online service (Supabase) plugs in here; until then the demo backend is used. */
interface CoopBackend {
  name: string; online: boolean;
  start(c: Company): string;                    // returns the invite code
  join(code: string): Promise<boolean>;
  publish(ev: CoopEvent): void;
  tick(now: number): void;                      // brings in other pilots' events
}

const COOP_DEMO_PILOTS = 3;

function coopState(): CoopState { return (State as any).coop || null; }
function coopOn(): boolean { const c = coopState(); return !!(c && c.on && c.companyId === State.companyId); }
function coopMe(): CoopMember { const c = coopState(); return c ? c.members.filter(m => m.you)[0] : null; }
function coopMember(id: string): CoopMember { const c = coopState(); return c ? c.members.filter(m => m.id === id)[0] : null; }

function coopCode(): string {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = '';
  for (let i = 0; i < 8; i++) s += A[Math.floor(Math.random() * A.length)] + (i === 3 ? '-' : '');
  return s;
}

/** Add an event to the shared history (once) and remember it. */
function coopRecord(ev: CoopEvent) {
  const c = coopState(); if (!c || c.applied[ev.id]) return;
  c.applied[ev.id] = 1;
  c.feed.unshift(ev); if (c.feed.length > 200) c.feed.length = 200;
}

/* ---------------- demo backend: sample pilots who fly the airline's routes on the real clock ---------------- */

const CoopDemo: CoopBackend = {
  name: 'Demo', online: false,
  start(co: Company) {
    const c = coopState(), now = Date.now();
    for (let i = 0; i < COOP_DEMO_PILOTS; i++) {
      const p = makePerson('coop-' + co.id + '-' + i + '-' + now, 'captain', '', co.hub);
      const m: CoopMember = { id: 'coop-' + uid(), name: p.name, role: 'pilot', sex: p.sex, nat: p.nat, base: co.hub,
        flights: 0, hoursMin: 0, revenue: 0, rating: Math.round((3.8 + Math.random() * 1.1) * 10) / 10, joined: now - (i + 1) * 3600e3, lastSeen: now, look: randomLook('coop' + p.name, p.sex, 'captain') };
      c.members.push(m);
      coopEnsurePilot(m);
      coopRecord({ id: uid(), at: m.joined, by: m.id, type: 'join', text: `${m.name} joined the airline` });
      // the first one is already in the air, the others take off over the next hour or two
      c.next[m.id] = i === 0 ? now - 1 : now + (20 + i * 45 + Math.random() * 30) * 60e3;
    }
    return coopCode();
  },
  join() { return Promise.resolve(false); },
  publish() { /* the demo keeps everything on this device */ },
  tick(now: number) {
    const c = coopState(); if (!c) return;
    // flights that reached the gate
    for (const f of State.live.slice()) { const F: any = f; if (F.coop && F.depAt + F.durMs <= now) coopLand(F, F.depAt + F.durMs); }
    // pilots ready for their next flight
    for (const m of c.members) {
      if (m.you || !c.next[m.id] || c.next[m.id] > now) continue;
      if (State.live.some((f: any) => f.coop && f.pilotId === m.id)) continue;
      coopDepart(m, Math.max(c.next[m.id], now - 6 * 3600e3));
    }
    for (const f of State.live) if ((f as any).coop) coopUpdate(f, now);
    try { coopJobsTick(now); } catch (e) { /* ignore */ }
    try { coopConnTick(now); } catch (e) { /* ignore */ }
    try { coopPlusTick(); } catch (e) { /* ignore */ }
  },
};

/** Co-op pilots appear as pilots (for the map and flight cards) but belong to no company's payroll. */
function coopEnsurePilot(m: CoopMember) {
  if (State.pilots.some(p => p.id === m.id)) return;
  State.pilots.push({ id: m.id, name: m.name, rank: 'Co-op pilot', hoursMin: m.hoursMin, landings: m.flights, base: m.base, status: 'standby', types: [],
    sex: m.sex, nat: m.nat, look: m.look, salary: 0, rating: m.rating, companyId: 'coop:' + coopState().companyId } as any);
}

function coopDepart(m: CoopMember, at: number) {
  const c = coopState(), co = company();
  const routes = State.routes.filter(r => r.companyId === co.id);
  const r = routes[Math.floor(Math.random() * routes.length)];
  const legs = r ? r.legs : [co.hub, (co.hub === 'EKCH' ? 'ENGM' : 'EKCH')];
  const i = Math.floor(Math.random() * Math.max(1, legs.length - 1));
  const from = legs[i], to = legs[i + 1] || legs[0];
  if (!from || !to || from === to) { c.next[m.id] = at + 3600e3; return; }
  // an aircraft of the airline that's free; otherwise the type the route is flown with
  const busy = (reg: string) => State.live.some(f => f.reg === reg);
  const assigned = (reg: string) => (State as any).aiNext && (State as any).aiNext.some((n: any) => n.reg === reg);
  const a = fleetOf(co.id).filter(x => x.status === 'parked' && x.reg !== (State as any).myReg[co.id] && !busy(x.reg) && !assigned(x.reg))[0];
  const typeId = a ? a.typeId : r ? r.typeId : 'a320-fenix', t = acType(typeId);
  const prof = flightProfile(typeId, from, to, at);
  const seats = t ? t.seats : 180, pax = Math.round(seats * (0.7 + Math.random() * 0.25));
  const f: any = { id: 'coop-' + uid(), reg: a ? a.reg : '', pilotId: m.id, from, to, t: 0, rate: 0, callsign: (co.icao || 'CO') + (300 + (_hashStr(m.id + at) % 600)),
    pax, paxMax: seats, alt: 0, phase: 'Taxi out', real: true, coop: true, typeId, depAt: at, durMs: prof.totalS * 1000 };
  if (a) a.status = 'flying';
  const p = pilot(m.id); if (p) p.status = 'flying';
  try { f.fo = sharedPairFor(m.id); } catch (e) { /* ignore */ }
  State.live.push(f);
  m.lastSeen = Date.now();
  if (at > Date.now() - 60e3) State.notices.unshift({ id: uid(), kind: 'pilot', title: `${m.name} departed ${from}`, body: `Co-op flight ${f.callsign} to ${to}${a ? ' in ' + a.reg : ''}, ${pax} passengers.`, time: 'Now', read: false } as any);
  coopUpdate(f, Date.now());
}

/** Position, phase and altitude of a co-op pilot's flight right now. */
function coopUpdate(f: LiveFlight, now: number) {
  const F: any = f, p = flightProfile(F.typeId, f.from, f.to, F.depAt), fe = flightEl(F, now), el = fe.el, q = profileAt(p, el);
  f.t = clamp(q.d / p.routeNm, 0, 1); f.alt = q.alt; f.gs = q.gs; f.phase = q.ph;
  if (fe.hold) { if (fe.hold.kind !== 'gate') noteHold(F, fe.hold); f.phase = holdLabel(fe.hold); }
  F.leftNm = q.left; F.toGoS = q.toGoS; F.routeNm = p.routeNm;
}

/** A co-op pilot reached the gate: the flight report (PIREP) goes to the owner for review when that rule
 *  is on, otherwise it is booked to the shared airline straight away. */
function coopLand(f: any, at: number) {
  const c = coopState(), co = company(), m = coopMember(f.pilotId);
  State.live = State.live.filter(x => x !== f);
  const blockMin = Math.round(f.durMs / 60000);
  const fpm = Math.round(-(90 + Math.random() * 260));
  const pr: CoopPirep = { id: 'pr-' + f.id, at, by: f.pilotId, name: m ? m.name : 'A co-op pilot', callsign: f.callsign, from: f.from, to: f.to, reg: f.reg || '', typeId: f.typeId,
    blockMin, fpm, g: Math.round((1.08 + Math.random() * .35) * 100) / 100, pax: f.pax, cargoKg: f.cargoKg || 0, fuelKg: Math.round(blockMin / 60 * (BURN_KG_H[(acType(f.typeId) || AIRCRAFT[0]).cls] || 2000) * (0.88 + Math.random() * 0.1)), status: 'pending' };
  (pr as any).fo = f.fo || '';
  try { const mm: any = coopMember(f.pilotId), sc = procScore(f.id, clamp((((mm && mm.rating) || 4) - 2.5) / 2.5, 0, 1), pr.fpm, pr.g); (pr as any).score = sc.score; (pr as any).pens = sc.pens; } catch (e) { /* ignore */ }
  // a job leg: the client pays and the job is delivered
  if (f.job) { try { const j = jobById(f.job); if (j) { payTxn(co.id, `Charter: ${j.title} (${m ? m.name : 'co-op'})`, j.pay, 'charter', [[`${j.client} pays for ${j.from} to ${j.to}`, j.pay]], at); Jobs.delivered(j.id, at, j.pay, ''); } } catch (e) { /* ignore */ } }
  // the aircraft and the pilot are back on the ground either way
  const a = f.reg ? plane(f.reg) : null;
  if (a) { a.status = 'parked'; a.location = f.to; }
  const p = pilot(f.pilotId); if (p) p.status = 'standby';
  if (m) { m.lastSeen = at; m.base = f.to; }
  c.pireps = c.pireps || [];
  try { coopChatOnLanding(m, f.from, f.to, fpm); eventsAfterLeg(f.pilotId, f.from, f.to); } catch (e) { /* ignore */ }
  const autoWhy = (() => { try { const r = autoRules(); return r.on ? pirepCheck(pr) : 'review'; } catch (e) { return 'review'; } })();
  if (c.rules.reviewPireps && !(m && m.role === 'owner') && autoWhy) {
    (pr as any).why = autoWhy === 'review' ? '' : autoWhy;
    c.pireps.unshift(pr); c.pireps = c.pireps.slice(0, 200);
    coopRecord({ id: 'pr-' + f.id, at, by: f.pilotId, type: 'pirep', text: `${pr.name} filed a flight report: ${f.from} to ${f.to}, ${Math.abs(fpm)} fpm. Waiting for your review.` });
    State.notices.unshift({ id: uid(), kind: 'pilot', title: `Flight report to review: ${pr.name}`, body: `${f.callsign} ${f.from} to ${f.to}, ${hours(blockMin)} block, landing ${Math.abs(fpm)} fpm, ${f.pax} passengers. Accept or reject it under Co-op.`, time: at > Date.now() - 120e3 ? 'Now' : dateStr(new Date(at)).slice(11), read: false } as any);
  } else { pr.status = 'accepted'; c.pireps.unshift(pr); c.pireps = c.pireps.slice(0, 200); coopBook(pr, at > Date.now() - 120e3); }
  // the next flight after a turnaround, or a rest
  c.next[f.pilotId] = at + (Math.random() < 0.3 ? 8 * 3600e3 : (45 + Math.random() * 75) * 60e3);
}

interface CoopPirep { id: string; at: number; by: string; name: string; callsign: string; from: string; to: string; reg: string; typeId: string; blockMin: number; fpm: number; g: number; pax: number; cargoKg: number; fuelKg: number; status: 'pending' | 'accepted' | 'rejected'; why?: string; tx?: string }

/** Book an accepted flight report: money, logbook, hours, the pilot's record. */
function coopBook(pr: CoopPirep, live: boolean) {
  const co = company(), m = coopMember(pr.by);
  const money0 = legEconomics(pr.typeId, pr.from, pr.to, Math.round(pr.pax * (1 + codeshareBoost())), pr.cargoKg, pr.blockMin, pr.fuelKg, false, { book: true, reg: pr.reg || undefined });
  const d = new Date(pr.at), day = dateStr(d).slice(0, 10), time = dateStr(d).slice(11);
  const txId = uid(); pr.tx = txId;
  State.txns.unshift({ id: txId, companyId: co.id, date: day, time, label: `${pr.callsign} ${pr.from} to ${pr.to} (${pr.name})`, amount: money0.net, kind: money0.net >= 0 ? 'revenue' : 'fees',
    reg: pr.reg || undefined, flight: pr.callsign, route: `${pr.from} → ${pr.to}`, lines: money0.lines, coopBy: pr.by } as any);
  const before = co.balance; co.balance += money0.net;
  State.logbook.unshift({ id: uid(), date: dateStr(d), from: pr.from, to: pr.to, reg: pr.reg || '—', blockMin: pr.blockMin, landingFpm: pr.fpm, g: pr.g, pax: pr.pax,
    result: pr.fpm < -500 ? 'hard' : 'ok', atc: 'Co-op', notes: `Flown by ${pr.name}`, typeId: pr.typeId, coopBy: pr.by } as any);
  try { const L0: any = State.logbook[0], P: any = pr; L0.score = P.score; L0.pens = P.pens; const tr = trackFromProfile(pr.typeId, pr.from, pr.to, pr.at - pr.blockMin * 60e3); if (tr) trackSave(L0.id, tr); if (P.fo) { const fo: any = coopMember(P.fo); if (fo) { fo.flights++; fo.hoursMin += pr.blockMin; fo.foMin = (fo.foMin || 0) + pr.blockMin; L0.notes += `, shared cockpit with ${fo.name} (first officer)`; } } vaStatLeg({ onTime: true, pax: pr.pax, net: money0.net, fpm: pr.fpm, score: P.score }); coopMemberCheckRide(pr, L0.id, P.score); } catch (e) { /* ignore */ }
  const a = pr.reg ? plane(pr.reg) : null;
  if (a) { a.hoursMin += pr.blockMin; a.cycles += 1; try { conditionAfterFlight(a, pr.blockMin); } catch (e) { /* ignore */ } }
  const p = pilot(pr.by); if (p) { p.hoursMin += pr.blockMin; p.landings += 1; }
  try { crewAfterLeg(co.id, { typeId: pr.typeId, from: pr.from, to: pr.to, blockMin: pr.blockMin }); } catch (e) { /* ignore */ }
  try { coopMonthStat(pr.by, pr.blockMin); } catch (e) { /* ignore */ }
  if (m) { m.flights++; m.hoursMin += pr.blockMin; m.revenue += money0.net; try { newsCoopMilestone(m); } catch (e) { /* ignore */ } }
  try { Progress.popularity(pr.fpm > -250 ? 0.2 : 0, 'A good co-op flight'); } catch (e) { /* ignore */ }
  try { Ratings.record({ who: pr.by, name: pr.name, fpm: Math.abs(pr.fpm), g: pr.g, at: pr.at, from: pr.from, to: pr.to, typeId: pr.typeId, kind: 'coop' }); } catch (e) { /* ignore */ }
  coopRecord({ id: 'fl-' + pr.id, at: pr.at, by: pr.by, type: 'flight', text: `${pr.name} landed at ${pr.to} from ${pr.from}`, amount: money0.net, tx: txId });
  State.notices.unshift({ id: uid(), kind: 'flight', title: `${pr.name} landed at ${pr.to}`, body: `Co-op flight ${pr.callsign} from ${pr.from}, ${hours(pr.blockMin)} block, ${pr.pax} passengers. ${money(money0.net, { sign: true })} for the airline. Tap for the money in and out.`,
    time: live ? 'Now' : time, read: false, tx: txId } as any);
  if (live) try { animateBalance(before, co.balance); } catch (e) { /* not ready */ }
}

/** The owner's decision on a flight report. */
function coopReview(id: string, ok: boolean, why?: string) {
  const c = coopState(); if (!c) return;
  const pr = (c.pireps || []).filter(x => x.id === id)[0]; if (!pr || pr.status !== 'pending') return;
  pr.status = ok ? 'accepted' : 'rejected'; pr.why = why;
  if (ok) coopBook(pr, true);
  else coopRecord({ id: 'rj-' + pr.id, at: Date.now(), by: 'coop-you', type: 'pirep', text: `Flight report rejected: ${pr.name}, ${pr.from} to ${pr.to}${why ? ' (' + why + ')' : ''}` });
}

/** Your own flights count for the co-op too (called after a leg is booked). */
function coopAfterMyLeg(from: string, to: string, blockMin: number, net: number, txId: string) {
  if (!coopOn()) return;
  const me = coopMe(); if (!me) return;
  me.flights++; me.hoursMin += blockMin; me.revenue += net; me.lastSeen = Date.now();
  try { coopMonthStat(me.id, blockMin); } catch (e) { /* ignore */ }
  const ev: CoopEvent = { id: 'fl-' + txId, at: Date.now(), by: me.id, type: 'flight', text: `${me.name} landed at ${to} from ${from}`, amount: net, tx: txId };
  coopRecord(ev); coopBackend().publish(ev);
}

/** Buying, selling and leasing aircraft: in a co-op only the owner does that. Hired pilots never do. */
function coopCanBuy(): boolean {
  if (!coopOn()) return true;
  const me = coopMe();
  return !!(me && me.role === 'owner');
}
function coopAfterBuy(text: string, amount: number) {
  if (!coopOn()) return;
  const me = coopMe(); const ev: CoopEvent = { id: uid(), at: Date.now(), by: me ? me.id : '', type: 'buy', text: `${me ? me.name : 'You'} bought ${text}`, amount: -amount };
  coopRecord(ev); coopBackend().publish(ev);
}

function coopBackend(): CoopBackend { return CoopDemo; }

/** Start a co-op with the airline you are flying for now. You are its owner. */
function coopStart() {
  const co = company(), me: any = myPilot(), now = Date.now();
  const S: any = State;
  S.coop = { on: true, backend: 'demo', code: '', companyId: co.id, started: now, members: [], feed: [], applied: {}, rules: { ownerBuys: true, reviewPireps: true }, next: {}, pireps: [] } as CoopState;
  const mine: CoopMember = { id: 'coop-you', name: me ? me.name : 'You', role: 'owner', you: true, sex: me && me.sex || 'm', nat: me && me.nat || '', base: co.hub,
    flights: 0, hoursMin: 0, revenue: 0, rating: me && me.rating || 4.5, joined: now, lastSeen: now };
  S.coop.members.push(mine);
  coopRecord({ id: uid(), at: now, by: mine.id, type: 'start', text: `${mine.name} started co-op for ${co.name}` });
  S.coop.code = coopBackend().start(co);
  Store.save();
}

/** Leave co-op: the shared pilots leave, everything the airline earned and logged stays. */
function coopLeave() {
  const S: any = State, c = coopState(); if (!c) return;
  const ids = c.members.filter(m => !m.you).map(m => m.id);
  for (const f of State.live.filter((x: any) => x.coop)) { const a = f.reg ? plane(f.reg) : null; if (a && a.status === 'flying') a.status = 'parked'; }
  State.live = State.live.filter((x: any) => !x.coop);
  State.pilots = State.pilots.filter(p => ids.indexOf(p.id) < 0);
  S.coop = null;
  Store.save();
}

function startCoopClock() {
  const run = () => { if (!coopState() || !coopState().on) return; try { coopBackend().tick(Date.now()); } catch (e) { /* never stop the app */ } };
  run();
  setInterval(() => { run(); if (State.screen === 'coop') { try { refresh(); } catch (e) { /* ignore */ } } }, 5000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) run(); });
}
