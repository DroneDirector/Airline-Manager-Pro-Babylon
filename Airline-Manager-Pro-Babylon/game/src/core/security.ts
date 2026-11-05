// Security: your airline's own security officers (airport police work for the state; an airline hires its own
// security staff). They check passengers at the gate, guard the aircraft parked overnight, and deal with drunk or
// unruly passengers. Hired like ground staff (Crew → Security), paid weekly at an aviation security officer's going
// rate (about $40,000 to $48,000 a year in the US, £25,000 in the UK, €37,000 in Germany), trained in the Training room.
// How good they are at an airport (how many, and their rating) decides:
//  - Gate checks: a very drunk passenger is spotted at the gate; you can send Security to collect them from the lounge,
//    where you see an officer walk over and lead them out (a weak officer may cause a scene the other guests notice).
//  - On board: a drunk passenger you let fly is less likely to make trouble when Security has briefed the crew.
//  - Aircraft parked overnight: guarded, or now and then a security incident (a breached fence, a stolen item).
//  - Reports now and then: what they checked and found, and sometimes a staff member's conduct (a conduct report).
// Everything here is behind one switch (secOn: Settings → Staff → Security), so the feature can be paused at any time
// without losing anyone hired or anything recorded.

function secOn(): boolean { return (State.settings as any).security !== false; }
function isSecurity(p: any): boolean { return !!p && p.role === 'ground' && p.job === 'security'; }
/** Your security officers (at an airport, or all of them). */
function secStaff(base?: string): any[] {
  const c = company(); if (!c || !secOn()) return [];
  return staffOf(c.id, 'ground').filter((p: any) => isSecurity(p) && p.status !== 'training' && (!base || p.base === base));
}
/** How well an airport is covered, 0 to 1: enough officers for its departures, and how good they are. */
function secQuality(base: string): number {
  const L = secStaff(base); if (!L.length) return 0;
  const deps = State.fleet.filter(a => a.companyId === State.companyId && a.base === base).length || 1;
  const enough = clamp(L.length / Math.max(1, Math.ceil(deps / 3)), 0, 1), r = L.reduce((a: number, p: any) => a + (p.rating || 3.5), 0) / L.length;
  return clamp(enough * (0.35 + 0.65 * clamp((r - 2.5) / 2.5, 0, 1)), 0, 1);
}
/** The best officer at an airport (the one sent to collect a passenger). */
function secPick(base: string): any { return secStaff(base).sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0))[0] || null; }
/** A new security officer for the hiring list. */
function makeSecurity(seed: string, base: string, cid: string): any {
  const p: any = makePerson(seed, 'ground', cid, base); p.job = 'security'; p.id = 'sec-' + p.id;
  p.salary = Math.round(p.salary * 1.4 / 10) * 10;   // an aviation security officer's pay, above the ramp's
  p.look.sec = true; p.look.top = 'jacket'; p.look.uniform = 1; p.look.neck = 'tie'; p.look.hat = 'none';
  return p;
}
/** Where an officer leads someone out of a place: its way out (one place to change when there is a way outside). */
const SEC_EXIT: { [place: string]: string } = { lounge: 'door' };
function secExit(place: string): string { return SEC_EXIT[place] || 'door'; }

/* ---------- the drunk passenger: sent for ---------- */
/** "Send Security": an officer collects the passenger from the lounge and they don't board. A good officer does it
 *  calmly; a weak one may cause a scene. Seen in the lounge when you are there. */
function secEscort(key: string) {
  const d = drunkList().filter(x => x.key === key)[0]; if (!d || d.decided) return;
  const L = secStaff(d.from).sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0)), o = L[0] || null;
  d.decided = 'deny'; d.crew = false; (d as any).escort = o ? o.name : '';
  try { const n = ((State as any).aiNext || []).filter((x: any) => x.callsign === d.callsign && Math.abs(x.depAt - d.dep) < 120000)[0]; if (n) { const ld = aiPlannedLoad(n); if (ld.pax > 0) { ld.pax--; if (d.cls === 'First' && ld.paxF > 0) ld.paxF--; else if (ld.paxJ > 0) ld.paxJ--; } } } catch (e) { /* as planned */ }
  if (!o) {
    State.notices.unshift({ id: uid(), kind: 'staff' as any, title: `${d.name} turned away at the gate`, body: `No security officer at ${d.from}: the cabin crew turned ${d.name} away at the gate instead. ${d.name} doesn't board ${d.callsign}.`, time: 'Now', read: false } as any);
    try { Store.soon(); renderTopbar(); } catch (e) { /* later */ } return;
  }
  // a second officer: another of yours there, or the airport's officer on duty with them
  const o2 = L[1] || { name: 'Duty officer', look: Object.assign(randomLook('duty-' + d.from, Math.random() < 0.6 ? 'm' : 'f', 'ground' as any), { sec: true, top: 'jacket', uniform: 1, neck: 'tie', hat: 'none' }), rating: 3.5 };
  const plan = secPlan(d.bac, (d as any).heavy || d.bac >= 1.6, Math.random, o.rating || 3.5);
  secOutcome(d, o, plan);
  const seen = typeof LoungeRoom !== 'undefined' && LoungeRoom.on && LoungeRoom.k === d.from;
  if (seen) { try { const G = (LoungeRoom.guests || []).filter((g: any) => g.P && g.P.name === d.name && !g.gone)[0]; if (!G || !secIncident(G, plan, o, o2)) lgSecurityEscort(d.name, o, plan.refusals > 2); } catch (e) { /* not seen */ } }
  try { Store.soon(); renderTopbar(); } catch (e) { /* later */ }
}
/** What came of it: the notice, popularity, and the officer's record (rules kept: up; broken: down and a conduct report). */
function secOutcome(d: DrunkPax, o: any, plan: SecPlan) {
  const how = plan.refusals <= 0 ? `${d.name} came along quietly`
    : plan.refusals <= 3 ? `${d.name} argued for a while, then walked out with them`
    : plan.police ? `${d.name} refused every warning; tasers aren't allowed by your rules, so the officers called the police, who ${plan.refusals >= 7 ? 'tased, cuffed and arrested' : 'cuffed and arrested'} ${d.name}`
    : plan.refusals >= 7 || plan.early || plan.rogue ? `${d.name} refused every warning and was tased, cuffed and led out`
    : `${d.name} refused several warnings, gave in when the taser came out, and was cuffed and led out`;
  const loud = plan.refusals >= 4;
  if (loud) { try { Progress.popularity(plan.refusals >= 7 ? -0.6 : -0.3, `A guest was ${plan.police ? 'arrested' : 'restrained'} in your lounge`); } catch (e) { /* as it was */ } }
  let rec = '';
  const S: any = State;
  if (plan.rogue || plan.early) {
    o.rating = Math.max(1, Math.round(((o.rating || 3.5) - (plan.rogue ? 0.3 : 0.15)) * 100) / 100);
    const why = plan.rogue ? 'used a taser although your rules forbid tasers' : 'used the taser before giving all the warnings';
    S.incidents = S.incidents || []; S.incidents.unshift({ id: uid(), staffId: o.id, sev: plan.rogue ? 'serious' : 'minor', title: `Use of force: ${o.name}`, text: `${o.name} ${why} with ${d.name} in the lounge at ${d.from}.`, date: Date.now(), status: 'open' });
    rec = ` A conduct report was filed: ${o.name} ${why}.`;
  } else if (plan.refusals >= 1) { o.rating = Math.min(5, Math.round(((o.rating || 3.5) + 0.05) * 100) / 100); rec = ` ${o.name} kept to your rules: their rating rises a little.`; }
  State.notices.unshift({ id: uid(), kind: 'staff' as any, title: `Security collected ${d.name}`, body: `${o.name} went to the lounge at ${d.from}: ${how}. ${d.name} doesn't board ${d.callsign}.${loud ? ' Other guests saw it (your popularity drops a little).' : ''}${rec}`, time: 'Now', read: false } as any);
}
ACTIONS['drunk-escort'] = el => { secEscort(el.getAttribute('data-k') || ''); Sound.tick(); closeTop(); setTimeout(drunkAsk, 400); };

/* ---------- now and then: reports, aircraft at night, trouble on board ---------- */
const SEC_FINDS: [string, string][] = [
  ['A knife in a cabin bag', 'A folding knife was found in a passenger\'s cabin bag at the gate; it was taken and the passenger boarded.'],
  ['Liquids over the limit', 'Several passengers had liquids over 100 ml in their cabin bags; they were thrown away.'],
  ['A power bank in a checked bag', 'A large power bank was found in a checked bag and moved to the cabin, as the rules say.'],
  ['An unattended bag', 'An unattended bag by the gate: the area was cleared until its owner came back. A short delay.'],
  ['A fake boarding pass', 'A passenger tried to board with someone else\'s boarding pass and was handed to the airport police.'],
  ['Nothing to report', 'A quiet day: every passenger and bag checked, nothing found.'],
];
const SEC_CONDUCT: [string, string][] = [
  ['Asleep on the overnight watch', '{n} was found asleep while guarding the aircraft at {b} overnight.'],
  ['Rude to passengers at the gate', 'Passengers at {b} complained that {n} was rude to them during the gate checks.'],
  ['Let a colleague skip the check', '{n} waved a colleague through the staff checkpoint at {b} without checking their bag.'],
];
function secAdvance() {
  if (!secOn() || (State as any).finHold) return;
  const S: any = State, now = Date.now(), c = company(); if (!c) return;
  S.secNext = S.secNext || {};
  const bases: { [b: string]: boolean } = {};
  for (const p of secStaff()) bases[p.base] = true;
  for (const a of State.fleet.filter(x => x.companyId === c.id)) bases[a.base] = true;
  for (const b of Object.keys(bases)) {
    if (!S.secNext[b]) { S.secNext[b] = now + (12 + Math.random() * 24) * 3600e3; continue; }
    if (S.secNext[b] > now) continue;
    S.secNext[b] = now + (18 + Math.random() * 30) * 3600e3;
    const L = secStaff(b), q = secQuality(b);
    // the aircraft parked here overnight: guarded, or now and then an incident
    if (Math.random() < 0.06 * (1 - 0.85 * q)) {
      const cost = Math.round(600 + Math.random() * 2400);
      try { payTxn(c.id, `Security incident at ${b}: equipment stolen from a parked aircraft`, -cost, 'other' as any, [['Replacement', -cost]]); } catch (e) { /* booked later */ }
      try { Progress.popularity(-0.5, `A security incident at ${b}`); } catch (e) { /* as it was */ }
      State.notices.unshift({ id: uid(), kind: 'staff' as any, title: `Security incident at ${b}`, body: `Someone got through the fence at ${b} overnight and took equipment from a parked aircraft (${money(cost)}). ${L.length ? 'Your officers there missed it.' : 'You have no security officers there: hire some under Crew → Security.'}`, time: 'Now', read: false } as any);
      continue;
    }
    if (!L.length) continue;
    // a report from the officers: what they checked and found
    const f = SEC_FINDS[Math.floor(Math.random() * SEC_FINDS.length)], screened = Math.round(80 + Math.random() * 400);
    const avg = L.reduce((a: number, p: any) => a + (p.rating || 3.5), 0) / L.length;
    State.notices.unshift({ id: uid(), kind: 'staff' as any, title: `Security report, ${b}: ${f[0].toLowerCase()}`, body: `${f[1]} ${num(screened)} passengers and their bags checked at the gates; ${L.length} officer${L.length > 1 ? 's' : ''} on duty, rated ${avg.toFixed(1)} on average${q < 0.4 ? ': too few or not good enough for the queues, consider hiring or training' : ''}.`, time: 'Now', read: false } as any);
    // now and then the officers' own conduct (a conduct report, when those are on)
    if (conductOn() && Math.random() < 0.08 * (1.4 - q)) {
      const p = L.sort((x: any, y: any) => (x.rating || 0) - (y.rating || 0))[0], t = SEC_CONDUCT[Math.floor(Math.random() * SEC_CONDUCT.length)];
      const inc: any = { id: uid(), staffId: p.id, sev: 'light', title: t[0], text: t[1].replace('{n}', p.name).replace('{b}', b), date: dateStr(new Date()).slice(0, 10), status: 'open' };
      S.incidents = S.incidents || []; S.incidents.unshift(inc);
      State.notices.unshift({ id: 'n-' + inc.id, kind: 'staff' as any, title: `Conduct report: ${p.name}`, body: `${t[0]}. See them in your office.`, time: 'Now', read: false, ref: inc.id } as any);
    }
  }
  // drunk passengers you let fly: trouble on board, less likely when Security has briefed the crew
  for (const d of drunkList()) {
    if (d.decided !== 'allow' || (d as any).flown || d.dep > now) continue; (d as any).flown = true;
    const q = secQuality(d.from);
    if (Math.random() < (d.bac >= 1.5 ? 0.55 : 0.3) * (1 - 0.6 * q)) {
      try { Progress.popularity(-1, `A drunk passenger on ${d.callsign}`); } catch (e) { /* as it was */ }
      State.notices.unshift({ id: uid(), kind: 'flight', title: `Trouble on ${d.callsign}`, body: `${d.name} became loud and abusive on board; the cabin crew had to restrain them and the airport police met the aircraft at ${d.to}. Other passengers were upset.`, time: 'Now', read: false } as any);
    } else if (q > 0.4) State.notices.unshift({ id: uid(), kind: 'flight', title: `${d.callsign}: a quiet flight after all`, body: `Security briefed the crew about ${d.name}; they slept most of the way.`, time: 'Now', read: false } as any);
  }
  try { Store.soon(); renderTopbar(); } catch (e) { /* later */ }
}
setInterval(() => { try { secAdvance(); } catch (e) { /* next time */ } }, 60000);
