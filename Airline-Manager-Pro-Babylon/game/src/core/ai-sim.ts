// Hired pilots fly on the real clock. Each flight has an off-blocks time and follows the real-world
// profile for its aircraft and route (see flightperf.ts), so where it is, how high, how fast and how
// far it still has to go all follow from the time alone. When the app opens, it works out
// everything that happened while it was closed (landings, turnarounds, next legs, rest, money),
// and before it closes it schedules phone notifications for the landings coming up.
// "Virtual pilot speed" in Settings can run their flights faster than real time; 1× is real time.

const AI_TURN_MIN = 50;          // turnaround on the ground between legs
const AI_REST_H = 12;            // rest after a duty day
const AI_MAX_CATCHUP_D = 14;     // never simulate more than two weeks of absence
const AI_NOTIFY_BASE = 5000;     // notification ids 5000-5099

function aiOn(f: LiveFlight): boolean { return !f.you && !f.real; }
function aiSpeed(): number { return Math.max(1, +(State.settings as any).aiSpeed || 1); }

function aiProfile(f: any): FlightProfile {
  if (f.from === f.to) return aiTestProfile();
  const a = plane(f.reg);
  return flightProfile(a ? a.typeId : 'a320-fenix', f.from, f.to, f.depAt);
}
/** A test flight: about 45 minutes from the gate back to the same gate, climbing to 10,000 ft over the area. */
function aiTestProfile(): FlightProfile {
  const T = AI_TEST_MIN * 60, seg = (k: number) => Math.round(T * k);
  // each point carries the phase flown on the way to it
  const pts: any[] = [
    { s: 0, d: 0, alt: 0, gs: 0, ph: 'Taxi out' }, { s: seg(.12), d: 0, alt: 0, gs: 0, ph: 'Taxi out' }, { s: seg(.14), d: 0, alt: 0, gs: 150, ph: 'Takeoff' },
    { s: seg(.32), d: 0, alt: 10000, gs: 250, ph: 'Climb' }, { s: seg(.62), d: 0, alt: 10000, gs: 250, ph: 'Test flight' },
    { s: seg(.8), d: 0, alt: 2500, gs: 180, ph: 'Descent' }, { s: seg(.86), d: 0, alt: 1200, gs: 140, ph: 'Approach' }, { s: seg(.9), d: 0, alt: 0, gs: 130, ph: 'Final' },
    { s: seg(.92), d: 0, alt: 0, gs: 15, ph: 'Landing' }, { s: T, d: 0, alt: 0, gs: 0, ph: 'Taxi in' }];
  return { routeNm: 0, totalS: T, airS: seg(.76), cruiseAlt: 10000, pts } as any;
}
/** Real time (ms) at which the flight reaches the gate. */
function aiEndAt(f: any): number { return f.depAt + f.durMs / (f.spd || 1); }

/** Position, phase, altitude, speed, miles to go and time to go of a hired pilot's flight right now. */
function aiUpdate(f: LiveFlight, now: number) {
  const F: any = f;
  if (!F.depAt) return;
  const p = aiProfile(F), fe = flightEl(F, now), el = fe.el, q = profileAt(p, el);
  f.t = p.routeNm > 0 ? clamp(q.d / p.routeNm, 0, 1) : 0;
  f.alt = q.alt; f.gs = q.gs; f.phase = q.ph;
  if (fe.hold) { if (fe.hold.kind !== 'gate') noteHold(F, fe.hold); f.phase = holdLabel(fe.hold); if (fe.hold.kind === 'gate' || fe.hold.kind === 'runway') f.gs = 0; }
  const extra = holdsLeft(F, fe);
  F.leftNm = q.left; F.toGoS = (q.toGoS + extra) / (F.spd || 1); F.routeNm = p.routeNm;
  // the boarding scan, while the flight is still at the gate (only while you are watching)
  if (!F.scanned && el < 600 && now - F.depAt < 15 * 60000) { F.scanned = true; try { boardingScan(f); } catch (e) { /* ignore */ } }
  if (F.medical && !F.medical.noted && el > 1200) { try { medicalNote(F); } catch (e) { /* ignore */ } }
  if (F.emerg && !F.emerg.noted && el > F.emerg.at) { try { failureNote(F); } catch (e) { /* ignore */ } }
  // the ground crew load the catering from the storage before the doors close (unless you did it by hand)
  if (!F.catLoaded && !F.ferry && f.pax && /take-?off|climb|cruise|lift/i.test(f.phase || '') && typeof cateringOn === 'function' && cateringOn()) {
    try { const a = plane(f.reg), pJF = (F.paxJ || 0) + (F.paxF || 0), r = catLoad(F, a ? a.companyId : State.companyId, catNeed(f.pax - pJF, pJF, Math.round((F.durMs || 3600e3) / 60000))); F.catStockUsd = r.stockUsd; } catch (e) { /* bought at the airport */ }
  }
  if (F.wxDivert && !F.wxDivert.noted && F.toGoS < 1800) { try { wxDivertNote(F); } catch (e) { /* ignore */ } }
  const td = p.pts.filter(x => x.ph === 'Landing')[0];
  F.toTdS = td ? (Math.max(0, td.s - el) + extra) / (F.spd || 1) : F.toGoS;
  // the arrival countdown runs from take-off to touchdown on the planned air time; holds after take-off
  // (weather, traffic) take it below zero, and it shows zero on the ground
  const tk = p.pts.filter(x => x.ph === 'Takeoff')[0], spd = F.spd || 1;
  if (td && tk) {
    let before = 0; for (const h of (F.holds || []) as Hold[]) if (h.at < tk.s) before += h.s;
    F.planTdAt = F.depAt + (tk.s + before + (td.s - tk.s)) * 1000 / spd;
    F.airborne = el >= tk.s && el < td.s;
  } else { F.planTdAt = 0; F.airborne = f.alt > 50; }
  // vertical speed (ft/min) along the profile; level while holding
  F.vs = fe.hold ? 0 : Math.round((profileAt(p, el + 15).alt - profileAt(p, Math.max(0, el - 15)).alt) * 2 / 50) * 50 * (el > 15 ? 1 : 2);
}

/** Your flight before the simulator is linked (the demo): flown on the real clock along its real profile and
 *  procedures like every other flight, at the type's real speeds; after landing it waits at the gate and
 *  then flies the leg again. */
function demoUpdate(f: LiveFlight, now: number) {
  const F: any = f;
  if (f.noDest) return;
  if (!F.depAt) { const p0 = aiProfile(Object.assign({}, F, { depAt: now })); F.depAt = now - profileTimeAtFrac(p0, clamp(f.t || 0, 0, 0.98)) * 1000; F.spd = 1; }
  let p = aiProfile(F);
  if (now - F.depAt > (p.totalS + 20 * 60) * 1000) { F.depAt = now; p = aiProfile(F); }
  const q = profileAt(p, (now - F.depAt) / 1000);
  f.t = p.routeNm > 0 ? clamp(q.d / p.routeNm, 0, 1) : 0; f.alt = q.alt; f.gs = q.gs; f.phase = q.ph;
  F.leftNm = q.left; F.toGoS = q.toGoS; F.routeNm = p.routeNm;
  const td = p.pts.filter(x => x.ph === 'Landing')[0], tk = p.pts.filter(x => x.ph === 'Takeoff')[0];
  F.toTdS = td ? Math.max(0, td.s - (now - F.depAt) / 1000) : F.toGoS;
  if (td && tk) { F.planTdAt = F.depAt + td.s * 1000; const el = (now - F.depAt) / 1000; F.airborne = el >= tk.s && el < td.s; }
  F.vs = Math.round((profileAt(p, (now - F.depAt) / 1000 + 15).alt - profileAt(p, Math.max(0, (now - F.depAt) / 1000 - 15)).alt) * 2 / 50) * 50;
}

/** "Arrives in": counts down from take-off to touchdown, below zero when late, zero on the ground. */
function arrivesIn(f: LiveFlight): string {
  const F: any = f;
  if (f.noDest) return '—';
  if (!f.real && F.depAt) {
    if (!F.airborne || !F.planTdAt) return '0:00';
    const s = (F.planTdAt - Date.now()) / 1000;
    return s >= 0 ? countdown(s) : '−' + countdown(-s);
  }
  // your flight and co-op flights: from distance and ground speed once airborne
  if (f.alt < 50 && !(f.gs > 60)) return '0:00';
  const B = apt(f.to); if (!B) return '—';
  const A0 = apt(f.from);
  const left = f.real && f.pos ? gcDistanceNm(f.pos, B.pos) : A0 ? gcDistanceNm(A0.pos, B.pos) * (1 - f.t) : 0;
  return countdown(left / Math.max(60, f.gs || acType(flightTypeId(f)).cruiseKt) * 3600);
}

/** Heading (°) and vertical speed (ft/min) of a flight right now. */
function flightMotion(f: LiveFlight): { hdg: number; vs: number } {
  const F: any = f;
  if (f.real && f.you && Link.sim && Link.sim.lat) return { hdg: Math.round(Link.sim.hdg), vs: Math.round(Link.sim.vsFpm / 10) * 10 };
  if (f.real && f.hdg != null) return { hdg: Math.round(f.hdg), vs: F.vs || 0 };
  const pp = flightPathPos(f);
  return { hdg: Math.round(pp ? pp.hdg : 0), vs: F.vs || 0 };
}

// Messages at the real points of each flight: top of descent and established on final. Only phase
// changes seen while the app is open are announced, so opening the app doesn't bring a burst of old news.
const _aiLastPh = new Map<string, string>();
function aiAnnounce(f: LiveFlight) {
  const F: any = f, was = _aiLastPh.get(f.id);
  _aiLastPh.set(f.id, f.phase);
  if (!was || was === f.phase) return;
  const p = pilot(f.pilotId), who = p ? p.name : f.callsign, A = apt(f.from), B = apt(f.to);
  const mins = (s: number) => Math.max(1, Math.round(s / 60)), minTxt = (s: number) => mins(s) + (mins(s) === 1 ? ' minute' : ' minutes');
  const fl = f.alt >= 18000 ? 'FL' + Math.round(f.alt / 100) : num(Math.round(f.alt / 100) * 100) + ' ft';
  let title = '', body = '';
  if (f.phase === 'Descent') {
    title = `${who} is descending into ${f.to}`;
    body = `${f.callsign} from ${A ? A.city : f.from}: top of descent ${Math.round(F.leftNm)} nm out at ${fl}. At the gate in about ${minTxt(F.toGoS)}.`;
  } else if (f.phase === 'Final') {
    title = `${who} is on final at ${f.to}`;
    body = `${f.callsign} from ${A ? A.city : f.from}, established ${Math.round(F.leftNm)} nm out at ${fl}${B ? ', ' + B.name : ''}. Landing in about ${minTxt(F.toTdS)}.`;
  } else return;
  State.notices.unshift({ id: uid(), kind: 'pilot', title, body, time: 'Now', read: false, ref: f.id } as any);
  try {
    renderTopbar();
    // a pop-up for finals at normal speed; faster speeds would make them too frequent
    if (f.phase === 'Final' && aiSpeed() <= 2) { Sound.chime(); toast(title, 'info', { label: 'Show', act: 'show-flight', data: f.id }); }
  } catch (e) { /* interface not ready */ }
}

/** Give flights from older saves (and the demo) real off-blocks times, keeping where they are now. */
function aiAdopt(now: number) {
  for (const f of State.live) {
    const F: any = f;
    if (!aiOn(f) || F.depAt) continue;
    const p = aiProfile({ reg: f.reg, from: f.from, to: f.to, depAt: now });
    F.spd = aiSpeed(); F.durMs = p.totalS * 1000;
    F.depAt = now - profileTimeAtFrac(p, f.t || 0) * 1000 / F.spd;
    F.dutyMin = 0; F.leg = 0;
  }
}

/** When the speed setting changes, keep every flight where it is and run the rest at the new speed. */
function aiSetSpeed(spd: number) {
  const now = Date.now(), S: any = State;
  for (const f of State.live) {
    const F: any = f; if (!aiOn(f) || !F.depAt) continue;
    const elSim = (now - F.depAt) * (F.spd || 1);
    F.spd = spd; F.depAt = now - elSim / spd;
  }
  for (const n of (S.aiNext || [])) {
    const wait = Math.max(0, n.depAt - now) * (n.spd || 1);
    n.spd = spd; n.depAt = now + wait / spd;
  }
}

/** The leg after landing at `at`: the next stop of the route you assigned the pilot. Hired pilots only
 *  fly routes you created and scheduled: without one they wait on the ground. They never take off and
 *  land at the same airport, except on a test flight you set up. */
function aiNextLeg(pilotId: string, from: string, at: string): string {
  const rs = State.routes.filter(x => x.pilotId === pilotId && x.legs.indexOf(at) >= 0);
  const test = rs.filter(x => x.test && !x.flownAt)[0];
  if (test) return at;
  const r = rs.filter(x => !x.test)[0];
  if (!r) return null;
  // the stop after this one; a route never sends the aircraft back to where it is
  const i = r.legs.indexOf(at);
  for (let k = 1; k < r.legs.length; k++) { const nx = r.legs[(i + k) % r.legs.length]; if (nx !== at) return nx; }
  return null;
}
function aiTestRoute(pilotId: string, at: string): RouteDef { return State.routes.filter(x => x.pilotId === pilotId && x.test && !x.flownAt && x.legs[0] === at)[0] || null; }
const AI_TEST_MIN = 45;

/** Book a hired pilot's landing: hours, landings, aircraft, revenue, fuel and fees. */
function aiLand(f: LiveFlight, at: number, summary: { legs: number; net: number; names: string[]; tx?: string[] }) {
  const F: any = f, a = plane(f.reg), p: any = pilot(f.pilotId);
  if (!a) return;
  const t = acType(a.typeId), c = company(a.companyId), prof = aiProfile(F), blockMin = Math.round(prof.totalS / 60);
  if (p) { p.hoursMin += blockMin; p.landings += 1; }
  a.hoursMin += blockMin; a.cycles += 1; a.location = f.to; a.status = 'parked';
  // a repair paid for while it flew starts now that it is on the ground
  for (const i of State.issues as any[]) if (i.reg === a.reg && i.status === 'scheduled') { i.startedAt = at; a.status = 'maintenance'; }
  try { FlightTrace.arrived(f, at); } catch (e) { /* ignore */ }
  // for the turnaround at the gate: when it got there, who got off, the fuel left
  (a as any).lastGateAt = at; (a as any).lastPax = f.pax || 0; (a as any).lastFlightId = f.id; (a as any).lastFrom = f.from; (a as any).lastPaxJ = (f as any).paxJ || 0; (a as any).lastPaxF = (f as any).paxF || 0;
  try { (a as any).lastFuelKg = legFuel(a.typeId, f.pax || 0, f.from, f.to).land; } catch (e) { /* ignore */ }
  // real-world fares, on-board sales and costs (economics.ts)
  const burnH = (BURN_KG_H[t.cls] || 2000) * engineBurn(a.reg);
  const burnKg = Math.round(prof.airS / 3600 * burnH + burnH * 0.08 * (prof.totalS - prof.airS) / 900);
  const m = f.from === f.to
    ? (() => { const fuel = Math.round(burnKg * 0.95), crew = Math.round(t.costPerHr * blockMin / 60 * 0.35); return { net: -(fuel + crew), revenue: 0, costs: fuel + crew, lines: [['Test flight fuel', -fuel], ['Aircraft and crew time', -crew]] } as any; })()
    : legEconomics(a.typeId, f.from, f.to, f.pax, F.cargoKg || 0, blockMin, burnKg, false, { book: true, cat: F.catStockUsd, reg: a.reg, paxJ: F.paxJ, paxF: F.paxF, ferry: !!F.ferry, job: F.job ? jobPayFor(F.job) : undefined });
  const net = m.net, d = new Date(at), ds = dateStr(d);
  const txId = uid(); (summary.tx = summary.tx || []).push(txId);
  State.txns.unshift({ id: txId, companyId: c.id, date: ds.slice(0, 10), time: ds.slice(11), label: `${f.from === f.to ? 'Test flight ' + f.reg + ' at ' + f.from : (F.ferry ? 'Ferry ' : F.job ? 'Charter ' : '') + f.callsign + ' ' + f.from + ' to ' + f.to}${p ? ' (' + p.name.split(' ')[0] + ')' : ''}`,
    amount: net, kind: net >= 0 ? 'revenue' : 'fees', reg: a.reg, flight: f.callsign, route: `${f.from} → ${f.to}`, lines: m.lines, byPilot: f.pilotId } as any);
  c.balance += net;
  try { if (f.from !== f.to && !F.ferry) hubOnLand(c.id, f.from, f.to, at, f.pax || 0, Math.round((at - (F.schedEnd || at)) / 60000), F.schedEnd || at); } catch (e) { /* ignore */ }
  try { if (f.from !== f.to && !F.ferry) firstVisitCheck(c.id, f.to, a.reg, at); } catch (e) { /* ignore */ }
  // keep the day's flown legs for the schedule (the last two days)
  const S: any = State; S.aiDay = (S.aiDay || []).filter((x: any) => x.end > Date.now() - 2 * 864e5);
  S.aiDay.push({ reg: a.reg, from: f.from, to: f.to, start: F.depAt, end: at, sched: F.sched || F.depAt, schedEnd: F.schedEnd || at, why: aiDelayWhy(F), retry: !!F.retry, callsign: f.callsign });
  summary.legs++; summary.net += net; if (p && summary.names.indexOf(p.name) < 0) summary.names.push(p.name);
  try { Ratings.aiLanding(f, at); } catch (e) { /* ignore */ }
  try { vaAiLanded(f, at); const rr: any = Ratings.list()[0], own = rr && rr.who === f.pilotId; if (f.from !== f.to && !F.ferry) vaStatLeg({ onTime: !F.sched || F.depAt - F.sched <= 15 * 60e3, pax: f.pax || 0, net, fpm: own ? rr.fpm : 0, score: own ? rr.score : undefined }); } catch (e) { /* ignore */ }
  try { if (F.job) Jobs.delivered(F.job, at, net, txId); } catch (e) { /* ignore */ }
  try { if (f.from !== f.to && !F.ferry) Online.discordAiLanding(f, net); } catch (e) { /* ignore */ }
}

/** Why a flight ran late: what held it on the ground before it left, then the delays on the way. */
function aiDelayWhy(F: any): string {
  const w: string[] = [];
  if (F.waitWhy) w.push(F.waitWhy);
  ((F.holds || []) as Hold[]).forEach(h => w.push(h.why));
  return w.join(', ');
}
const AI_CANCEL_AFTER_H = 5;
/** A leg that has to wait until `until`: moved later, or past five hours cancelled (passengers rebooked)
 *  and flown at the same time the next day. Returns the leg to put back in the plan. */
function aiWait(n: any, until: number, why: string, a: any): any {
  const spd = n.spd || 1, late = (until - n.sched) * spd;
  if (late <= AI_CANCEL_AFTER_H * 3600e3) return Object.assign({}, n, { depAt: until, why });
  const S: any = State, block = (n.schedEnd || n.sched + 3600e3) - n.sched;
  if (!n.cancelNoted) {
    S.aiDay = S.aiDay || [];
    S.aiDay.push({ reg: n.reg, from: n.from, to: n.to, start: n.sched, end: n.sched + block, sched: n.sched, schedEnd: n.sched + block, cancelled: true, why, callsign: n.callsign });
  }
  // the same time the next day (or the day after, until the reason is over)
  let retry = n.sched + 864e5 / spd; while (retry < until) retry += 864e5 / spd;
  State.notices.unshift({ id: uid(), kind: 'pilot', title: `${n.callsign || n.reg} ${n.from} to ${n.to} cancelled`, body: `${why}. The passengers are rebooked; ${n.reg} tries again ${dateStr(new Date(retry)).slice(0, 16).replace('T', ' ')}.`, time: 'Now', at: n.sched, read: false, ref: n.reg } as any);
  return Object.assign({}, n, { depAt: retry, sched: retry, schedEnd: retry + block, why: '', retry: true, cancelNoted: false });
}

/** Move every hired pilot on to `now`: land flights that have arrived, start the next legs that are due. */
function aiAdvance(now?: number, quiet?: boolean, away?: boolean) {
  now = now || Date.now();
  const S: any = State;
  S.aiNext = S.aiNext || [];
  aiAdopt(now);
  const earliest = now - AI_MAX_CATCHUP_D * 864e5;
  const summary = { legs: 0, net: 0, names: [] as string[], tx: [] as string[] };
  const before = company().balance;
  noticesAt(now);   // anything already waiting is from now
  let lastEvAt = 0;
  for (let guard = 0; guard < 2000; guard++) {
    // the next thing that happens, in time order
    let ev: any = null;
    for (const f of State.live) { const F: any = f; if (aiOn(f) && F.depAt) { const e = aiEndAt(F); if (e <= now && (!ev || e < ev.at)) ev = { kind: 'land', f, at: e }; } }
    for (const n of S.aiNext) if (n.depAt <= now && (!ev || n.depAt < ev.at)) ev = { kind: 'dep', n, at: n.depAt };
    if (!ev) { if (lastEvAt) noticesAt(lastEvAt); break; }
    // messages from the event before this one carry that event's time
    if (lastEvAt) noticesAt(lastEvAt);
    lastEvAt = Math.max(ev.at, earliest);
    if (ev.kind === 'land') {
      const f: LiveFlight = ev.f, F: any = f, at = Math.max(ev.at, earliest), spd = F.spd || 1;
      aiLand(f, at, summary);
      try { const pa: any = plane(f.reg); if (pa) { conditionAfterFlight(pa, F.durMs / 60000); conditionRisk(pa, f); } } catch (e) { /* ignore */ }
      try { rateAiFlight(f, at); } catch (e) { /* ignore */ }
      if (F.medical && !F.medical.noted) { try { medicalNote(F); } catch (e) { /* ignore */ } }
      if (F.wxDivert && !F.wxDivert.noted) { try { wxDivertNote(F); } catch (e) { /* ignore */ } }
      try { paxOnAiLanding(f); Progress.afterAiLeg(f.pax, (plane(f.reg) || {} as any).typeId, f.to); } catch (e) { /* ignore */ }
      try { const pa: any = plane(f.reg); if (pa) crewAfterLeg(pa.companyId, { pilotId: f.pilotId, typeId: pa.typeId, from: f.from, to: f.to, blockMin: F.durMs / 60000 }); } catch (e) { /* ignore */ }
      State.live = State.live.filter(x => x !== f);
      // duty: rest once the next leg would take the pilot past the duty limit, otherwise turn around
      const p: any = pilot(f.pilotId), maxDuty = ((p && p.rules && p.rules.maxDutyHrs) || 10) * 60;
      const dutyMin = (F.dutyMin || 0) + Math.round(F.durMs / 60000) + AI_TURN_MIN;
      // a test flight you set up is done once it is back at the gate
      if (f.from === f.to) { const tr = aiTestRoute(f.pilotId, f.from); if (tr) tr.flownAt = at;
        State.notices.unshift({ id: uid(), kind: 'pilot', title: `Test flight completed: ${f.reg}`, body: `${p ? p.name : 'The pilot'} took ${f.reg} up from ${f.from} and back. ${f.reg} is at the gate.`, time: 'Now', read: false } as any); }
      // a charter: after the ferry to its airport comes the job itself; after the job, back to the route
      const jn = Jobs.afterAiLanding(f, at, spd);
      if (jn) { if (p) p.status = 'flying'; S.aiNext.push(jn); continue; }
      // after a diversion (medical or weather) the same flight carries on to where it was going
      const dv = F.medical || F.wxDivert;
      if (!dv) { const qn = Jobs.queuedAfterLanding(f.pilotId, f.to, at, spd, dutyMin); if (qn) { S.aiNext.push(qn); continue; } }
      const next = dv ? dv.orig : aiNextLeg(f.pilotId, F.routeFrom || f.from, f.to), a = plane(f.reg);
      // no route of yours to fly next: the pilot waits on the ground until you assign one
      if (!next) { if (p) p.status = 'standby'; continue; }
      const nextBlock = aiProfile({ reg: f.reg, from: f.to, to: next, depAt: at }).totalS / 60;
      const rest = dutyMin + nextBlock > maxDuty;
      if (p) p.status = rest ? 'resting' : 'flying';
      const plan = at + (rest ? AI_REST_H * 3600e3 : AI_TURN_MIN * 60e3) / spd;
      S.aiNext.push({ reg: f.reg, pilotId: f.pilotId, from: f.to, to: next, spd, depAt: plan, sched: plan, schedEnd: plan + nextBlock * 60e3 / spd,
        dutyMin: rest ? 0 : dutyMin, leg: (F.leg || 0) + 1, callsign: f.callsign, paxMax: f.paxMax,
        ...(dv ? { medicalDone: true, routeFrom: dv.from, carry: { pax: Math.max(0, f.pax - (F.medical ? 1 : 0)), paxJ: F.paxJ, paxF: F.paxF, cargoKg: F.cargoKg || 0 }, why: F.medical ? `Medical diversion to ${f.to}` : `Weather diversion to ${f.to}` } : {}) });
    } else {
      const n: any = ev.n, a = plane(n.reg), p: any = pilot(n.pilotId);
      S.aiNext = S.aiNext.filter((x: any) => x !== n);
      if (!n.sched) { n.sched = n.depAt; }
      // waiting for something: the leg moves later; past five hours it is cancelled and tried again the next day
      const wait = (until: number, why: string) => { const w = aiWait(n, until, why, a); if (w) S.aiNext.push(w); };
      // an aircraft that went to maintenance, was sold or lost its pilot stays on the ground
      // a repair you paid for comes first: the leg waits until the aircraft is out of the hangar
      const rep = a ? (State.issues as any[]).filter(i => i.reg === a.reg && i.status === 'scheduled') : [];
      if (a && p && p.status !== 'off' && rep.length) { const end = Math.max.apply(null, rep.map(i => (i.startedAt || n.depAt) + (i.durMin || 30) * 60000)); wait(Math.max(n.depAt, end) + 10 * 60e3, 'Repair in the hangar'); continue; }
      // the weather, when it is happening now (catching up on hours the app was closed, today's weather says nothing)
      if (a && ev.at > now - 30 * 60e3) { const wv = wxDepartureBlock(n, a); if (!wv.ok) { wait(wv.kind === 'cancel' ? n.sched + (AI_CANCEL_AFTER_H + 1) * 3600e3 : now + 30 * 60e3, wv.why); continue; } }
      // ground handling: at your bases your own ground crew turn the aircraft round; without them it can't leave
      if (a) { const gb = groundBlock(a.companyId, n.from, a.typeId);
        if (gb.why) { wait(now + 60 * 60e3, gb.why); continue; }
        if (gb.slowMin > 5 && !n.groundSlowed) { const w2 = aiWait(Object.assign({}, n, { groundSlowed: true }), now + gb.slowMin * 60e3, `Short of ground crew at ${n.from}: a slower turnaround`, a); if (w2) S.aiNext.push(w2); continue; } }
      // off sick: the leg waits for cover (a stand-in or a contract pilot), cabin crew and mechanics likewise
      if (a && p) { const sk = sickBlock(n, a); if (sk) { wait(now + 60 * 60e3, sk); continue; } }
      const sickCovered = p && isSick(p) && p.coverAgency > now;
      if (!a || a.status === 'grounded' || a.status === 'maintenance' || !p || (p.status === 'off' && !sickCovered)) continue;
      // away on a type rating course: the leg waits until the pilot is back
      if (p.status === 'training') { wait(Math.max(now, p.trainingUntil || now) + 60e3, 'Pilot away on a course'); continue; }
      // no stand at its base: refused take-off until it gets a base with a free stand
      if ((a as any).noBase) { p.status = 'standby'; wait(now + 15 * 60e3, 'No free stand at its base'); continue; }
      // operating certificate suspended by a court: the airline's aircraft stay on the ground
      const gu = (S.groundedUntil || {})[a.companyId]; if (gu && gu > n.depAt) { wait(gu, 'Operating certificate suspended'); continue; }
      // a strike: the leg waits (and is cancelled after five hours)
      const sb = strikeBlock(a.companyId, a.typeId, n.from); if (sb) { wait(now + 60 * 60e3, sb); continue; }
      // night curfew at the airport: the departure waits until it opens
      try { const d0 = Math.max(n.depAt, earliest); if (curfewAt(n.from, d0)) { wait(curfewEnd(n.from, d0) + 60e3, `Night curfew at ${n.from}`); continue; } } catch (e) { /* ignore */ }
      // never off and back onto the same airport, except a test flight you set up
      const test = n.from === n.to;
      if (!n.to || (test && !aiTestRoute(n.pilotId, n.from))) { p.status = 'standby'; continue; }
      // passengers and cargo from demand on the route (none on a test or ferry flight; a charter's own load)
      const ld = n.carry || aiPlannedLoad(n);
      const depAt = Math.max(n.depAt, earliest); let prof = aiProfile({ reg: n.reg, from: n.from, to: n.to, depAt });
      // and timed so it doesn't land while the destination's night curfew is on
      try { const arr = depAt + prof.totalS * 1000 / (n.spd || 1); if (!test && curfewAt(n.to, arr)) { wait(depAt + (curfewEnd(n.to, arr) - arr) + 60e3, `Night curfew at ${n.to}: timed to land when it opens`); continue; } } catch (e) { /* ignore */ }
      const f: any = { id: 'ai-' + uid(), reg: n.reg, pilotId: n.pilotId, from: n.from, to: n.to, t: 0, rate: 0, callsign: n.callsign, pax: ld.pax, paxJ: ld.paxJ, paxF: ld.paxF, cargoKg: ld.cargoKg, paxMax: cabinSeats(acType(a.typeId), a) || n.paxMax, test,
        alt: 0, phase: 'Taxi out', depAt, spd: n.spd || 1, durMs: prof.totalS * 1000, dutyMin: n.dutyMin, leg: n.leg, ferry: !!n.ferry, job: n.job || undefined, jobNext: n.jobNext || undefined,
        sched: n.sched || depAt, waitWhy: n.why || '', retry: !!n.retry, paxSeed: n.paxSeed || undefined };   // paxSeed: its passengers already waiting in the lounge
      f.schedEnd = f.sched + prof.totalS * 1000 / (n.spd || 1);
      if (n.medicalDone) { f.medicalDone = true; f.routeFrom = n.routeFrom; }
      // rarely, a passenger falls ill on the way: the flight will divert (planned now, told when it happens)
      if (!test && maybeMedical(f, a)) { f.medical.from = n.from; prof = aiProfile({ reg: n.reg, from: n.from, to: f.to, depAt }); f.durMs = prof.totalS * 1000; }
      if (!test) assignDelays(f, prof);
      // very rarely, something fails on the way (decided now, shown when it happens)
      if (!test) { try { if (maybeFailure(f, a, prof)) f.durMs = prof.totalS * 1000 + (f.holds || []).reduce((s2: number, h: Hold) => s2 + h.s, 0) * 1000; } catch (e) { /* no failure */ } }
      // real weather on the way: reroutes, holding, or a diversion to an alternate
      if (!test && ev.at > now - 30 * 60e3) {
        try {
          const before = (f.holds || []).reduce((s2: number, h: Hold) => s2 + h.s, 0);
          const dvWhy = wxEnroute(f, a, prof);
          if (dvWhy) {
            const alt = wxAlternate(a.typeId, f.from, f.to, f.pax);
            if (alt) { f.wxDivert = { orig: f.to, from: n.routeFrom || n.from, why: dvWhy === 'fog' ? 'fog' : 'thunderstorms' }; f.to = alt; prof = aiProfile({ reg: n.reg, from: n.from, to: alt, depAt }); }
          }
          const after = (f.holds || []).reduce((s2: number, h: Hold) => s2 + h.s, 0);
          f.delayS = after; f.durMs = prof.totalS * 1000 + after * 1000;
        } catch (e) { /* the weather never stops the simulation */ }
      }
      // diverted soon after take-off: too heavy to land, so the crew hold to dump or burn off fuel first
      if (!test && (f.medical || f.wxDivert)) {
        try { heavyLandingHold(f, a, prof, (f.medical || f.wxDivert).orig); const hs = (f.holds || []).reduce((s2: number, h: Hold) => s2 + h.s, 0); f.delayS = hs; f.durMs = prof.totalS * 1000 + hs * 1000; } catch (e) { /* lands as planned */ }
      }
      a.status = 'flying'; if (!isSick(p)) p.status = 'flying';
      if (sickCovered) f.coverBy = 'Contract pilot (covering ' + p.name + ')';
      State.live.push(f);
      try { loadsheetOf(f); } catch (e) { /* the loaders keep it within the limits before boarding */ }
    }
  }
  for (const f of State.live) if (aiOn(f)) aiUpdate(f, now);
  if (summary.legs) {
    if (!quiet) {
      State.notices.unshift({ id: uid(), kind: 'pilot', title: away ? `While you were away: ${summary.legs} flight${summary.legs > 1 ? 's' : ''} landed` : summary.legs > 1 ? `${summary.legs} flights landed` : `${summary.names[0] || 'A hired pilot'} landed`,
        body: `${summary.names.slice(0, 3).join(', ')}${summary.names.length > 3 ? ' and others' : ''}. ${money(summary.net, { sign: true })} after fuel and fees. Tap for the money in and out.`, time: 'Now', read: false, tx: summary.tx.length === 1 ? summary.tx[0] : undefined, txs: summary.tx.length > 1 ? summary.tx.slice() : undefined } as any);
      try { Sound.chime(); } catch (e) { /* sound not ready */ }
    }
    Store.save();
    try { renderTopbar(); animateBalance(before, company().balance); } catch (e) { /* the interface isn't up yet */ }
  }
  return summary;
}

/** Phone notifications for the hired pilots' landings in the next day, shown even when the app is closed. */
function aiScheduleNotifications() {
  const cap = (window as any).Capacitor, LN = cap && cap.Plugins && cap.Plugins.LocalNotifications;
  if (!LN) return;
  const ids = Array.from({ length: 100 }, (_, i) => ({ id: AI_NOTIFY_BASE + i }));
  Promise.resolve(LN.cancel({ notifications: ids })).catch(() => { /* none scheduled */ }).then(() => {
    if (!(State.settings as any).aiNotify) return;
    const now = Date.now(), horizon = now + 24 * 3600e3, out: any[] = [];
    for (const f of State.live) {
      const F: any = f; if (!aiOn(f) || !F.depAt) continue;
      const at = aiEndAt(F); if (at <= now + 60e3 || at > horizon) continue;
      try { if (quietAt(at) || ntRule('flight') === 'off') continue; } catch (e) { /* ignore */ }
      const p = pilot(f.pilotId);
      out.push({ id: AI_NOTIFY_BASE + out.length, title: `${p ? p.name : f.callsign} is at the gate in ${f.to}`, body: `${f.callsign} from ${f.from}, ${f.pax} passengers.`, schedule: { at: new Date(at), allowWhileIdle: true } });
      if (out.length >= 60) break;
    }
    if (out.length) return LN.schedule({ notifications: out });
  }).catch(() => { /* notifications not allowed */ });
}

/** Keep any open flight card (Overview and Map) counting down. */
function aiRefreshCards() {
  for (const el of $all('[data-fc]')) {
    const f = State.live.filter(x => x.id === el.getAttribute('data-fc'))[0];
    if (!f) { const pop = el.closest('.sel-pop'); if (pop) pop.remove(); continue; }
    if (f.real) continue;
    const tmp = document.createElement('div'); tmp.innerHTML = flightCard(f).trim();
    patchNode(el, tmp.firstElementChild);
  }
  // aircraft at the gate: the turnaround counts on
  for (const el of $all('[data-ob]')) { const a = plane(el.getAttribute('data-ob')), o = a ? onBoardParked(a) : null; if (o) patchHtml(el, onBoardHtml(o)); }
}

function startAiClock() {
  aiAdvance(Date.now(), false, true);
  setInterval(() => { if (!document.hidden) aiAdvance(); }, 15000);
  setInterval(() => {
    if (document.hidden) return;
    const now = Date.now();
    for (const f of State.live) if (aiOn(f)) { aiUpdate(f, now); aiAnnounce(f); } else if (!f.real) demoUpdate(f, now);
    aiRefreshCards();
  }, 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { aiScheduleNotifications(); Store.save(); }
    else { aiScheduleNotificationsCancel(); _aiLastPh.clear(); aiAdvance(Date.now(), false, true); try { refresh(); } catch (e) { /* nothing on screen yet */ } }
  });
  window.addEventListener('pagehide', () => aiScheduleNotifications());
  // opening the app cancels the reminders; they are set again when it goes to the background
  aiScheduleNotificationsCancel();
}

function aiScheduleNotificationsCancel() {
  const cap = (window as any).Capacitor, LN = cap && cap.Plugins && cap.Plugins.LocalNotifications;
  if (LN) Promise.resolve(LN.cancel({ notifications: Array.from({ length: 100 }, (_, i) => ({ id: AI_NOTIFY_BASE + i })) })).catch(() => { /* none */ });
}


/** A hired pilot's day for the schedule, in minutes after midnight: legs flown, the one in progress, and the
 *  next ones projected with real-world block times, turnarounds and rest, until the end of the day. */
function aiDayBlocks(reg: string, day?: number): { from: string; to: string; start: number; end: number; live?: boolean; delayMin?: number; cancelled?: boolean; why?: string; retry?: boolean; sched?: number }[] {
  const S: any = State, a = plane(reg); if (!a) return [];
  const mid = new Date(); mid.setHours(0, 0, 0, 0); mid.setDate(mid.getDate() + (day || 0)); const m0 = mid.getTime(), m1 = m0 + 864e5;
  const toMin = (ms: number) => (ms - m0) / 60000;
  const late = (end: number, schedEnd: number) => schedEnd ? Math.max(0, Math.round((end - schedEnd) / 60000)) : 0;
  const out: any[] = [];
  for (const x of (S.aiDay || [])) if (x.reg === reg && x.end > m0 && x.start < m1) out.push({ from: x.from, to: x.to, start: toMin(x.start), end: toMin(x.end), sched: x.sched ? toMin(x.sched) : undefined,
    delayMin: x.cancelled ? 0 : late(x.end, x.schedEnd), cancelled: !!x.cancelled, why: x.why || '', retry: !!x.retry });
  const f: any = State.live.filter(x => x.reg === reg && aiOn(x))[0];
  let at = 0, from = '', prev = '', spd = aiSpeed(), dutyMin = 0, pilotId = '', knock = 0;
  if (f && f.depAt) { const end = aiEndAt(f); const d = late(end, f.schedEnd); knock = d;
    if (end > m0 && f.depAt < m1) out.push({ from: f.from, to: f.to, start: toMin(f.depAt), end: toMin(end), live: true, sched: f.sched ? toMin(f.sched) : undefined, delayMin: d, why: aiDelayWhy(f), retry: !!f.retry });
    at = end; from = f.to; prev = f.from; spd = f.spd || 1; dutyMin = (f.dutyMin || 0) + f.durMs / 60000 + AI_TURN_MIN; pilotId = f.pilotId; }
  const n: any = (S.aiNext || []).filter((x: any) => x.reg === reg)[0];
  if (!f && n) { at = n.depAt - AI_TURN_MIN * 60e3 / (n.spd || 1); from = n.from; prev = n.from === n.to ? n.from : ''; spd = n.spd || 1; dutyMin = n.dutyMin || 0; pilotId = n.pilotId; knock = n.sched ? Math.max(0, Math.round((n.depAt - n.sched) / 60000)) : 0; }
  if (!at) return out;
  // project the rest of the day; a delay knocks on to the legs after it
  const p: any = pilot(pilotId), maxDuty = ((p && p.rules && p.rules.maxDutyHrs) || 10) * 60;
  let to = n && !f ? n.to : aiNextLeg(pilotId, prev, from);
  for (let k = 0; k < 40 && at < m1; k++) {
    if (!to || to === from) break;
    const blockMin = flightProfile(a.typeId, from, to, at).totalS / 60;
    let dep = at + AI_TURN_MIN * 60e3 / spd;
    if (dutyMin + AI_TURN_MIN + blockMin > maxDuty) { dep = at + AI_REST_H * 3600e3 / spd; dutyMin = 0; knock = 0; }   // a night's rest absorbs the delay
    const first = k === 0 && n && !f;
    if (first) dep = n.depAt;
    const end = dep + blockMin * 60e3 / spd;
    if (dep >= m1) break;
    if (end > m0) out.push({ from, to, start: toMin(dep), end: toMin(end), delayMin: knock, sched: first && n.sched ? toMin(n.sched) : toMin(dep - knock * 60000),
      why: first ? (n.why || '') : knock ? 'Knock-on from an earlier delay' : '', retry: first && !!n.retry });
    dutyMin += AI_TURN_MIN + blockMin; at = end;
    const nx = aiNextLeg(pilotId, from, to); prev = from; from = to; to = nx;
  }
  return out;
}

/** You assigned a route: a pilot waiting on the ground starts on it with a free aircraft of the route's type. */
function aiStartRoute(pilotId: string, r: RouteDef): string {
  const S: any = State, p: any = pilot(pilotId); if (!p || !r) return '';
  if (State.live.some(f => f.pilotId === pilotId) || (S.aiNext || []).some((n: any) => n.pilotId === pilotId)) return 'flying';
  const busy = (reg: string) => State.live.some(f => f.reg === reg) || (S.aiNext || []).some((n: any) => n.reg === reg) || !!(plane(reg) as any || {}).jobHold;
  const c = company(r.companyId), mine = S.myReg[r.companyId];
  if (!Ratings.rated(p, r.typeId)) return 'not-rated';
  if (!r.test && routeRunwayProblem(r.typeId, r.legs)) return 'runway';
  if (p.status === 'training') return 'training';
  const free = fleetOf(r.companyId).filter(a => a.typeId === r.typeId && a.reg !== mine && !busy(a.reg) && a.status === 'parked');
  const a = free.filter(x => r.legs.indexOf(x.location) >= 0)[0] || free[0];
  if (!a) return 'no-aircraft';
  const from = r.test ? r.legs[0] : (r.legs.indexOf(a.location) >= 0 ? a.location : r.legs[0]);
  a.location = from;
  const to = r.test ? from : aiNextLeg(pilotId, '', from); if (!to) return 'no-leg';
  const t = acType(a.typeId);
  S.aiNext = S.aiNext || [];
  S.aiNext.push({ reg: a.reg, pilotId, from, to, spd: aiSpeed(), depAt: Date.now() + AI_TURN_MIN * 60e3 / aiSpeed(), dutyMin: 0, leg: 0,
    callsign: r.test ? c.icao + 'T' + (1 + (_hashStr(a.reg) % 9)) : r.code, paxMax: t ? t.seats : 0 });
  p.status = 'flying';
  return 'ok';
}
