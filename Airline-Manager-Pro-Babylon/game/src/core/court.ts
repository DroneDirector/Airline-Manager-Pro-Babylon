// Criminal cases. Very rarely (about 3% of conduct reports, so roughly 1 in 30) what a hired pilot,
// co-pilot, flight attendant or mechanic did is a crime. The police and the country's civil aviation
// authority investigate, the prosecutor brings charges, and the case goes to court over two to three
// real days: arrest, charges, a preliminary hearing, two days of trial and the verdict. The sentence
// follows the offence: fines and suspended sentences for the lightest, long prison terms when something
// was done on purpose and people died. It only ever happens to the AI crew, never to you.

const CRIMINAL_SHARE = 0.03;   // share of conduct reports that are criminal (asked for: between 1 and 5%)

interface CourtStage { at: number; key: string; title: string; text: string; done?: boolean }
interface CourtCase {
  id: string; staffId: string; name: string; role: string; look: any; companyId: string;
  offence: string; charge: string; summary: string; country: string; court: string; authority: string;
  opened: number; stages: CourtStage[]; status: 'open' | 'guilty' | 'acquitted';
  sentence?: string; guiltyP: number; fatal?: boolean; reg?: string;
}

// Offences by role. weight: relative chance; sentence: [min, max] months in prison (0 = no prison),
// with a fine range in dollars; fatal: deliberate act that cost lives (by far the rarest).
const OFFENCES: { [role: string]: { w: number; title: string; charge: string; text: string; months: number[]; fine: number[]; licence?: boolean; fatal?: boolean }[] } = {
  pilot: [
    { w: 6, title: 'Flew a whole flight over the alcohol limit', charge: 'Operating an aircraft while under the influence of alcohol', text: 'Tipped off by a witness at the hotel bar, police met {n}\'s flight at {b}. Blood tests after landing showed {n} had flown the whole flight over the legal limit.', months: [10, 18], fine: [5000, 25000], licence: true },
    { w: 40, title: 'Reported for duty over the alcohol limit', charge: 'Attempting to operate an aircraft while impaired by alcohol', text: '{n} failed a breath test at {b} before a departure and was removed from the flight deck.', months: [0, 9], fine: [5000, 25000], licence: true },
    { w: 25, title: 'Falsified flight and duty records', charge: 'Forgery of flight time and duty records', text: 'The authority found that {n} altered logbook and duty-time entries to hide flying beyond the legal limits.', months: [0, 12], fine: [8000, 40000], licence: true },
    { w: 20, title: 'Smuggling on company flights', charge: 'Smuggling of prohibited goods through {b}', text: 'Customs at {b} found prohibited goods hidden in {n}\'s flight bag after a flight.', months: [12, 48], fine: [10000, 60000], licence: true },
    { w: 2, title: 'Deliberately crashed an aircraft', charge: 'Murder and endangering the safety of aviation', text: 'Investigators found that {n} deliberately flew {r} into the ground. The flight data and cockpit voice recorders leave no doubt. People on board died.', months: [-1, -1], fine: [0, 0], licence: true, fatal: true },
  ],
  fa: [
    { w: 40, title: 'Theft from passengers', charge: 'Theft from passengers\' belongings on board', text: 'Several passengers reported valuables missing from their bags. They were found in {n}\'s luggage at {b}.', months: [0, 12], fine: [2000, 10000] },
    { w: 30, title: 'Smuggling through the crew channel', charge: 'Smuggling of prohibited goods through {b}', text: 'Customs at {b} stopped {n} in the crew channel with prohibited goods in a trolley bag.', months: [6, 36], fine: [5000, 40000] },
    { w: 25, title: 'Assault on a passenger', charge: 'Assault causing bodily harm', text: '{n} struck a passenger during an argument in the cabin. The passenger needed hospital treatment.', months: [0, 18], fine: [2000, 15000] },
    { w: 2, title: 'Deliberately withheld help from a dying passenger', charge: 'Manslaughter by gross negligence', text: '{n} ignored repeated calls for help and kept the medical kit locked away from a passenger having a heart attack, on purpose. The passenger died.', months: [48, 144], fine: [0, 0], fatal: true },
  ],
  mech: [
    { w: 3, title: 'Left a pressurisation switch in the wrong position', charge: 'Manslaughter by gross negligence', text: 'After a pressurisation test on {r}, {n} left a switch in the wrong position and the error was not caught. The crew and passengers lost consciousness at altitude and the aircraft crashed.', months: [24, 72], fine: [0, 0], licence: true, fatal: true },
    { w: 40, title: 'Signed off work that was never done', charge: 'Falsifying maintenance records and endangering the safety of aviation', text: 'An audit at {b} found that {n} certified inspections on {r} that were never carried out.', months: [0, 24], fine: [10000, 60000], licence: true },
    { w: 35, title: 'Stole aircraft parts', charge: 'Theft of aircraft parts and handling stolen goods', text: '{n} took parts from the company stores at {b} and sold them on. Some ended up in other aircraft without paperwork.', months: [6, 36], fine: [5000, 50000], licence: true },
    { w: 3, title: 'Sabotaged an aircraft', charge: 'Murder and sabotage of an aircraft', text: 'Investigators found that {n} deliberately disabled a flight control on {r}. The aircraft crashed and people on board died.', months: [-1, -1], fine: [0, 0], licence: true, fatal: true },
  ],
};
OFFENCES.fo = OFFENCES.pilot;
OFFENCES.ground = [
  { w: 40, title: 'Loaded undeclared dangerous goods', charge: 'Carrying dangerous goods without declaring them and endangering the safety of an aircraft', text: '{n} loaded boxes of hazardous material into the hold of {r} at {b} with false paperwork. A fire warning on the next flight brought the aircraft back.', months: [0, 18], fine: [5000, 50000] },
  { w: 40, title: 'Stole from passengers\' bags', charge: 'Theft from checked baggage', text: 'Cameras in the baggage hall at {b} caught {n} taking valuables from passengers\' suitcases.', months: [3, 24], fine: [1000, 8000] },
  { w: 20, title: 'Drove a vehicle into an aircraft and hid it', charge: 'Endangering the safety of an aircraft and failing to report damage', text: '{n} struck {r} with a ground vehicle at {b} and did not report it. The dent was found by the next crew\'s walk-round.', months: [0, 12], fine: [2000, 15000] },
];
// the airline itself, after an accident that investigators blame on poor maintenance (you are the accountable manager)
OFFENCES.airline = [
  { w: 1, title: 'Crews flew beyond their duty limits', charge: 'Breaching flight time limitations and endangering the safety of aircraft', text: 'The authority found that {why}.', months: [-3, -3], fine: [200000, 900000] },
  { w: 1, title: 'Accident caused by poor maintenance, with fatalities', charge: 'Corporate manslaughter and breaching aviation safety law', text: 'The investigation found that the accident was caused by poor maintenance: {why}.', months: [-2, -2], fine: [20000000, 80000000], fatal: true },
  { w: 1, title: 'Accident caused by poor maintenance', charge: 'Breaching aviation safety law and endangering the safety of aircraft', text: 'The investigation found that the accident was caused by poor maintenance: {why}.', months: [-3, -3], fine: [2000000, 15000000] },
];
// passengers (prosecuted after the police meet the aircraft)
OFFENCES.pax = [
  { w: 50, title: 'Drunk and disruptive on board', charge: 'Being drunk on an aircraft and disruptive behaviour towards the crew', text: '{n} was severely drunk, refused crew instructions and had to be restrained by the cabin crew. Police met the aircraft at {b}.', months: [0, 6], fine: [1500, 9000] },
  { w: 35, title: 'Assaulted a crew member', charge: 'Assault on a member of the cabin crew and endangering the safety of an aircraft', text: '{n} attacked a flight attendant during the flight. Passengers helped restrain them, and police arrested them at {b}.', months: [6, 30], fine: [3000, 20000] },
  { w: 15, title: 'Tried to open a door in flight', charge: 'Endangering the safety of an aircraft', text: '{n} tried to open an emergency exit in flight and was overpowered by the crew. Police arrested them on arrival at {b}.', months: [12, 48], fine: [5000, 30000] },
];

// Civil aviation authorities by country (as named in that country).
const AUTHORITIES: { [country: string]: string } = {
  'Faroe Islands': 'the Danish Civil Aviation and Railway Authority (Trafikstyrelsen)', Denmark: 'the Danish Civil Aviation and Railway Authority (Trafikstyrelsen)',
  Iceland: 'the Icelandic Transport Authority', Norway: 'the Civil Aviation Authority of Norway', Sweden: 'the Swedish Transport Agency', Finland: 'Traficom, the Finnish Transport and Communications Agency',
  'United Kingdom': 'the UK Civil Aviation Authority', Netherlands: 'the Human Environment and Transport Inspectorate', Germany: 'the Luftfahrt-Bundesamt', France: 'the DGAC, the French civil aviation authority',
  Spain: 'AESA, the Spanish Aviation Safety Agency', Portugal: 'ANAC, the Portuguese civil aviation authority', Italy: 'ENAC, the Italian civil aviation authority', Greece: 'the Hellenic Civil Aviation Authority',
  'United Arab Emirates': 'the UAE General Civil Aviation Authority', 'United States': 'the Federal Aviation Administration', Canada: 'Transport Canada', Greenland: 'the Danish Civil Aviation and Railway Authority (Trafikstyrelsen)',
};

const H = 3600e3;
function _pickW<T extends { w: number }>(a: T[]): T { const tot = a.reduce((s, x) => s + x.w, 0); let r = Math.random() * tot; for (const x of a) { r -= x.w; if (r <= 0) return x; } return a[0]; }
function _rand(a: number, b: number) { return a + Math.random() * (b - a); }

/** Maybe turn a conduct report into a criminal case. Returns true when it did. */
function maybeCriminal(who: any, role: string): boolean {
  if (Math.random() >= CRIMINAL_SHARE) return false;
  if (who.id === 'you' || who.coPilotFor === undefined && role === 'captain' && who.id === myPilot().id) return false;   // never you
  openCourtCase(who, role);
  return true;
}

function openCourtCase(who: any, role: string, offenceIdx?: number, why?: string) {
  if (role === 'airline' && !courtOn()) return;   // Settings → Court: the airline is never taken to court
  const S: any = State, list = OFFENCES[role] || OFFENCES.fa;
  const o = offenceIdx != null ? list[offenceIdx] : _pickW(list);
  const base = apt(who.base) || apt(company().hub), country = base ? base.country : '';
  const fleet = fleetOf(who.companyId || State.companyId), ac = fleet[Math.floor(Math.random() * fleet.length)];
  const fill = (t: string) => t.replace(/\{why\}/g, why || 'repairs left undone').replace(/\{n\}/g, who.name).replace(/\{b\}/g, base ? base.city : who.base).replace(/\{r\}/g, ac ? ac.reg : 'one of your aircraft');
  const now = Date.now(), d = (h: number) => now + h * H * (0.85 + 0.3 * Math.random());
  const authority = AUTHORITIES[country] || 'the national civil aviation authority';
  const court = base ? `the District Court in ${base.city}` : 'the district court';
  const c: CourtCase = {
    id: 'case-' + uid(), staffId: who.id, name: who.name, role, look: who.look, companyId: who.companyId || State.companyId,
    offence: o.title, charge: fill(o.charge), summary: fill(o.text), country, court, authority, opened: now, status: 'open',
    guiltyP: role === 'airline' ? 0.85 : o.fatal ? 0.97 : 0.8, fatal: !!o.fatal, reg: ac ? ac.reg : '',
    stages: [
      { at: now, key: 'arrest', title: o.fatal ? 'Arrested' : 'Police and authority investigation', text: `${fill(o.text)} The police and ${authority} have opened an investigation.${role === 'airline' || role === 'pax' ? '' : ' ' + who.name + ' is suspended from all duties.'}` },
      { at: d(6), key: 'charge', title: 'Charged', text: `The prosecutor has charged ${who.name} with ${fill(o.charge).toLowerCase()}. ${o.licence ? 'The authority has suspended the licence until the case is decided.' : ''}` },
      { at: d(20), key: 'hearing', title: 'Preliminary hearing', text: `At a preliminary hearing at ${court}, ${who.name} ${Math.random() < 0.5 ? 'pleaded not guilty' : 'did not enter a plea'}. ${o.fatal ? 'The judge ordered that the defendant stay in custody until the trial.' : 'The trial was set for the next day.'}` },
      { at: d(32), key: 'trial1', title: 'Trial, day one', text: `The prosecution presented its case: ${o.fatal ? 'flight data, recordings and expert witnesses from the accident investigation' : 'witness statements, records and evidence from ' + authority.replace(/^the /, 'the ')}.` },
      { at: d(46), key: 'trial2', title: 'Trial, day two', text: `The defence called its witnesses, and both sides made their closing arguments. The court will announce its verdict.` },
      { at: d(60), key: 'verdict', title: 'Verdict', text: '' },
    ],
  };
  try { courtSetup(c); } catch (e) { /* the basic case still runs */ }
  try { hearingSetup(c); } catch (e) { /* the case runs without hearings */ }
  S.cases = S.cases || []; S.cases.unshift(c);
  // staff are suspended: off duty, their flights stop
  if (role !== 'pax' && role !== 'airline') { who.status = 'off'; who.suspended = c.id; }
  if (o.fatal && ac && role !== 'airline') {
    const typeId = ac.typeId, reg = ac.reg, co = company(ac.companyId), f = State.live.filter(x => x.reg === reg)[0];
    courtWriteOff(ac, c);
    try { setTimeout(() => newsCrash({ key: 'case-' + c.id, c: co, typeId, reg, callsign: f ? f.callsign : undefined, from: f ? f.from : undefined, to: f ? f.to : co.hub, pax: f ? f.pax : undefined, dead: true, cause: fill(o.text) }), 5000); } catch (e) { /* ignore */ }
  }
  courtNotice(c, c.stages[0]);
  c.stages[0].done = true;
  Store.save();
  try { renderTopbar(); refresh(); Sound.chime(); toast(`${who.name}: ${o.title.toLowerCase()}`, 'warn', { label: 'Open', act: 'court-open', data: c.id }); } catch (e) { /* not ready */ }
}

/** A deliberate crash: the aircraft is lost; insurance pays most of its value. */
function courtWriteOff(a: Aircraft, c: CourtCase) {
  const S: any = State, t = acType(a.typeId), co = company(a.companyId), pay = Math.round(t.price * 0.75);
  State.live = State.live.filter(f => f.reg !== a.reg); S.aiNext = (S.aiNext || []).filter((n: any) => n.reg !== a.reg);
  State.fleet = State.fleet.filter(x => x !== a);
  co.balance += pay; co.reputation = Math.max(0, (co.reputation || 50) - 25);
  State.txns.unshift({ id: uid(), companyId: co.id, date: dateStr(new Date()).slice(0, 10), time: dateStr(new Date()).slice(11), label: `Insurance for ${a.reg}, written off`, amount: pay, kind: 'revenue', reg: a.reg, lines: [[`${t.model}, hull insurance`, pay]] } as any);
}

function courtNotice(c: CourtCase, st: CourtStage) {
  if (st.key === 'charge') { try { newsCourt(c, 'charge'); } catch (e) { /* ignore */ } }
  State.notices.unshift({ id: uid(), kind: 'staff' as any, title: `${c.name}: ${st.title.toLowerCase()}`, body: st.text || c.sentence || '', time: 'Now', read: false, ref: c.id } as any);
}

function sentenceText(o: { months: number[]; fine: number[]; licence?: boolean; fatal?: boolean }, role: string): string {
  const parts: string[] = [];
  if (o.months[0] === -2) parts.push(`${Math.round(_rand(2, 4))} years in prison for the accountable manager, suspended, and the operating certificate suspended for ${Math.round(_rand(7, 21))} days`);
  else if (o.months[0] === -3) parts.push(`the operating certificate suspended for ${Math.round(_rand(2, 7))} days`);
  else if (o.months[0] < 0) parts.push(Math.random() < 0.5 ? 'life imprisonment' : `${Math.round(_rand(18, 25))} years in prison`);
  else {
    const m = Math.round(_rand(o.months[0], o.months[1]));
    if (m >= 12) parts.push(`${Math.round(m / 6) / 2} years in prison`);
    else if (m > 0) parts.push(`${m} months in prison${m <= 6 && Math.random() < 0.5 ? ', suspended' : ''}`);
  }
  if (o.fine[1] > 0) parts.push(`a fine of ${money(Math.round(_rand(o.fine[0], o.fine[1]) / 500) * 500)}`);
  if (o.licence) parts.push(role === 'mech' ? 'loss of the maintenance licence' : 'loss of the pilot\'s licence');
  return parts.length ? parts.join(', ') : 'community service';
}

/** The airline's punishment: the fine is paid, popularity falls, and a suspended operating certificate grounds the fleet for a while. */
function courtPunishAirline(c: CourtCase, guilty: boolean) {
  const co = company(c.companyId); if (!co) return;
  if (!guilty) { const before = co.reputation; co.reputation = Math.min(100, co.reputation + 5); void before; return; }
  const m = /fine of \$([\d,]+)/.exec(c.sentence || ''), fine = m ? +m[1].replace(/,/g, '') : 0;
  if (fine) { co.balance -= fine; State.txns.unshift({ id: uid(), companyId: co.id, date: dateStr(new Date()).slice(0, 10), time: dateStr(new Date()).slice(11), label: `Court fine: ${c.offence}`, amount: -fine, kind: 'fees', lines: [[c.court, -fine]] } as any); }
  const d = /suspended for (\d+) days/.exec(c.sentence || '');
  if (d) (State as any).groundedUntil = Object.assign((State as any).groundedUntil || {}, { [co.id]: Date.now() + (+d[1]) * 864e5 });
  co.reputation = Math.max(0, co.reputation - 10);
}

/** Move every open case on to now (also catches up after the app was closed). */
function courtAdvance() {
  const S: any = State; if (!S.cases) return;
  const conduct = conductOn();   // crew cases pause while conduct reports are switched off; the airline's follow Settings → Court
  if (conduct) try { courtReleases(); whistleAdvance(); } catch (e) { /* ignore */ }
  try { hearingReminders(); hearingWatchDaily(); courtLeakCheck(); } catch (e) { /* ignore */ }
  try { investigationsAdvance(); } catch (e) { /* ignore */ }
  try { mailTick(); } catch (e) { /* ignore */ }
  const now = Date.now(); let changed = false;
  for (const c of S.cases as CourtCase[]) {
    if (c.status !== 'open' && !(c as any).appealing) continue;
    if (!conduct && c.role !== 'airline') continue;
    for (const st of c.stages) {
      if (st.done || st.at > now) continue;
      if ((c as any).hear && /^hear[0-9A]$/.test(st.key)) { if (hearingDue(c, st) === 'wait') break; changed = true; continue; }
      if ((c as any).hear && st.key === 'verdict' && !hearingVerdictReady(c)) break;   // your decisions first
      st.done = true; changed = true;
      if (st.key === 'prelim' && (c as any).hear && (c as any).hear.kind === 'accident') invPrelimApply(c, st);
      if (st.key === 'verdict') { courtVerdictApply(c, st); if ((c as any).hear && (c as any).hear.kind === 'accident') invAccusedOutcome(c, c.status === 'guilty'); }
      if (st.key === 'appeal') courtAppealApply(c, st);
      courtNotice(c, st);
    }
  }
  if (changed) { Store.save(); try { renderTopbar(); refresh(); } catch (e) { /* not ready */ } }
}

function courtRemove(p: any) {
  const S: any = State;
  if (S.staff.indexOf(p) >= 0) S.staff.splice(S.staff.indexOf(p), 1);
  else if (State.pilots.indexOf(p) >= 0) {
    State.pilots.splice(State.pilots.indexOf(p), 1);
    if (p.coPilotFor) { const cp = S.coPilot[p.coPilotFor]; if (cp) cp.gen = (cp.gen || 0) + 1; ensureCoPilot(p.coPilotFor); }
  }
}

function startCourtClock() { courtAdvance(); setInterval(courtAdvance, 60000); document.addEventListener('visibilitychange', () => { if (!document.hidden) courtAdvance(); }); }

/** The case file: what happened, the charge and every stage of the proceedings so far. */
function courtPopup(id: string) {
  const c: CourtCase = ((State as any).cases || []).filter((x: CourtCase) => x.id === id)[0]; if (!c) return;
  closeAll();
  const when = (t: number) => dateStr(new Date(t));
  const next = c.stages.filter(s => !s.done)[0];
  openLayer('modal', `
    <div class="inc">
      <div class="inc-av">${c.role === 'pax' || c.role === 'airline' ? `<span class="pax-av">${icon(c.role === 'airline' ? 'fleet' : 'user')}</span>` : avatarSvg(c.look, c.role === 'pilot' ? 'captain' : c.role as any, { accent: company().color, still: true })}</div>
      <div class="inc-main">
        <div class="modal-head"><div><small>Criminal case, ${esc(c.court)} · opened ${esc(atText(c.opened))}</small><h2>${esc(c.offence)}</h2></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
        <div class="inc-who"><b>${esc(c.name)}</b><small>${esc(c.role === 'pax' ? 'Passenger' : c.role === 'airline' ? 'The airline, with you as the accountable manager' : ROLE_NAMES[c.role === 'pilot' ? 'captain' : c.role] || 'Crew')}. Charge: ${esc(c.charge)}</small>
          <small class="${c.status === 'guilty' ? 'amber' : c.status === 'acquitted' ? 'green' : ''}">${c.status === 'open' ? (next ? `Next: ${esc(next.title.toLowerCase())}, around ${esc(when(next.at))}` : 'Awaiting the verdict') : c.status === 'guilty' ? `Guilty: ${esc(c.sentence || '')}` : 'Not guilty'}</small></div>
        <div class="say-row">${voiceButton(courtSpeech(c, next), 'legal', 'Play the lawyer\'s update')}${voiceNoteEl('Company lawyer')}</div>
        ${typeof sentenceCardHtml === 'function' ? sentenceCardHtml(c) : ''}
        ${typeof hearingCaseHtml === 'function' ? hearingCaseHtml(c) : ''}
        ${typeof courtChoicesHtml === 'function' ? courtChoicesHtml(c) : ''}
        ${(c as any).rehireAsk ? `<div class="cc-box"><b class="cc-h">${esc(c.name)} asks for a second chance</b><div class="btn-row"><button class="btn primary sm" data-act="cc-rehire" data-id="${esc(c.id)}" data-v="1">Take them back</button><button class="btn ghost sm" data-act="cc-rehire" data-id="${esc(c.id)}" data-v="0">Decline</button></div></div>` : ''}
        <ol class="court-tl">${c.stages.map(s => `<li class="${s.done ? 'done' : ''}"><time>${s.done || s === next ? esc(when(s.at)) : ''}</time><b>${esc(s.title)}</b>${s.done ? `<p>${esc(s.text)}</p>` : ''}</li>`).join('')}</ol>
      </div>
    </div>`, { cls: 'wide', onClose: () => Voice.stop() });
}
/** The company lawyer's update on a case: where it stands and what comes next. */
function courtSpeech(c: CourtCase, next: any): string {
  const done = c.stages.filter(s => s.done), last = done[done.length - 1];
  const head = `An update on the case against ${c.name}: ${c.offence.toLowerCase()}, before ${c.court}.`;
  const now = last ? ` ${last.text}` : '';
  const end = c.status === 'guilty' ? ` The verdict is guilty. ${c.sentence || ''}` : c.status === 'acquitted' ? ' The verdict is not guilty.' : next ? ` Next comes the ${next.title.toLowerCase()}, around ${dateStr(new Date(next.at))}.` : ' We are waiting for the verdict.';
  return head + now + end;
}
ACTIONS['court-open'] = el => { const t = el.closest('.toast'); if (t) t.remove(); courtPopup(el.getAttribute('data-id')); };
