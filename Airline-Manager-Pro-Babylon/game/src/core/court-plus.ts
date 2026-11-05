// The court cases in depth (court.ts runs the timeline):
//  - Your choices: a lawyer (none, standard, good or top), the airline's stance (stand by them, stay
//    neutral, hand over your internal evidence), the employee's status meanwhile, advising a guilty plea,
//    settling with victims or their families, acting on the accident investigators' recommendations, and
//    an appeal. The court decides; your choices weigh in, they never buy a verdict.
//  - Court systems by country: a jury (United States, United Kingdom, Canada, Australia, Ireland, New
//    Zealand), a professional judge with lay judges (the Nordic countries, Germany, Austria), or a panel of
//    professional judges (most other countries).
//  - Accidents: an investigation report with causes and recommendations comes before the charges.
//  - The airline in the dock: your record counts (underpaid mechanics, missing ground crew, repairs left open).
//  - Civil claims from victims beside the criminal case; insurance covers most, not all.
//  - The papers report the charges and the verdict; a case in the news costs bookings for a while.
//  - The sentence in full: prison, suspended, time already served in custody, likely release, fine,
//    licence, community service, probation. Released people may ask for their job back.
//  - Whistleblowers: someone inside reports a safety problem; deal with it, ignore it, or (unlawfully) fire them.
// The case types follow real prosecutions in aviation (docs/reference/court-cases.txt); people and airlines are made up.

interface CourtChoices { lawyer: 'none' | 'basic' | 'good' | 'top'; stance: 'support' | 'neutral' | 'evidence' | 'cooperate'; emp: 'paid' | 'unpaid' | 'dismissed'; plea: boolean; settled: boolean; acted: boolean; appeal: number }
interface CourtResult { prisonM: number; suspended: boolean; life: boolean; servedM: number; fine: number; licence: boolean; community: number; probationM: number; certDays: number; releaseM: number }

const JURY_COUNTRIES = ['United States', 'United Kingdom', 'Canada', 'Australia', 'Ireland', 'New Zealand'];
const LAY_COUNTRIES = ['Faroe Islands', 'Denmark', 'Norway', 'Sweden', 'Finland', 'Iceland', 'Germany', 'Austria', 'Greenland'];
function courtSystem(country: string): 'jury' | 'lay' | 'judges' { return JURY_COUNTRIES.indexOf(country) >= 0 ? 'jury' : LAY_COUNTRIES.indexOf(country) >= 0 ? 'lay' : 'judges'; }
function courtBench(c: any): string { return c.sys === 'jury' ? 'the jury' : c.sys === 'lay' ? 'the court (a professional judge and two lay judges)' : 'the panel of judges'; }
const LAWYER_FEE: { [k: string]: number } = { none: 0, basic: 8000, good: 25000, top: 70000 };
const LAWYER_NAME: { [k: string]: string } = { none: 'No lawyer (a public defender)', basic: 'A standard defence lawyer', good: 'A good defence firm', top: 'A top criminal defence firm' };
function courtVictims(c: any): boolean { return !!c.fatal || /assault|theft|withheld help|accident/i.test(c.offence); }
function courtOffence(c: any): any { if (c.offDef) return c.offDef; return (OFFENCES[c.role] || OFFENCES.fa).filter((x: any) => x.title === c.offence)[0] || OFFENCES.fa[0]; }

/** Set a new case up: its court system, your default choices, the investigation report for accidents. */
function courtSetup(c: any) {
  c.sys = courtSystem(c.country);
  c.ch = { lawyer: 'basic', stance: c.role === 'airline' ? 'cooperate' : 'neutral', emp: 'paid', plea: false, settled: false, acted: false, appeal: 0 } as CourtChoices;
  c.court = c.sys === 'jury' ? c.court.replace('District Court', 'Crown Court').replace('the Crown Court in', c.country === 'United States' ? 'the Federal District Court in' : 'the Crown Court in') : c.court;
  if (c.fatal || c.role === 'airline') {
    const at = c.stages[0].at + (c.stages[1].at - c.stages[0].at) * 0.6;
    const rec = c.role === 'airline' ? ['Make sure every repair is done and signed off before an aircraft flies', 'Pay and staff the maintenance department properly', 'Audit the maintenance records every month']
      : c.role === 'mech' ? ['Require a second, independent inspection of flight-control work', 'Lock access to aircraft systems after maintenance', 'Screen staff with access to aircraft regularly']
      : ['Never leave one person alone on the flight deck', 'Check the mental health of flight crew regularly, with support that does not end careers', 'Give crews a confidential way to report concerns about colleagues'];
    c.rec = rec;
    c.stages.splice(1, 0, { at, key: 'report', title: 'Accident investigation report', text: `The investigation board published its final report. It found that ${c.summary.charAt(0).toLowerCase() + c.summary.slice(1).replace(/\.$/, '')}. Its recommendations: ${rec.map((x: string, i: number) => `${i + 1}. ${x}`).join(' ')}.` });
  }
  // remand in custody for the most serious cases, counted towards a sentence later
  c.custodyM = c.fatal ? Math.round(10 + Math.random() * 8) : 0;
  const co: any = company(c.companyId); if (co && c.role !== 'pax') co.mediaHit = Math.max(co.mediaHit || 0, Date.now() + 10 * 864e5);
}
/** How much a case in the news costs your airline in bookings (1 = nothing). */
function mediaFactor(cid: string): number {
  const S: any = State, co: any = company(cid); if (!co || !co.mediaHit || co.mediaHit < Date.now()) return 1;
  const cases = ((S.cases || []) as any[]).filter(c => c.companyId === cid && (c.status === 'open' || Date.now() - c.opened < 14 * 864e5) && c.role !== 'pax');
  if (!cases.length) return 1;
  const worst = Math.max(...cases.map(c => c.fatal || c.role === 'airline' ? 0.1 : 0.03));
  const fair = cases.every(c => !c.ch || c.ch.stance === 'cooperate' || c.ch.stance === 'evidence' || c.ch.stance === 'neutral');
  return 1 - worst * (fair ? 0.6 : 1);
}

/** The court's decision, weighing the evidence and your choices. */
function courtDecide(c: any): { guilty: boolean; r: CourtResult } {
  const ch: CourtChoices = c.ch || { lawyer: 'basic', stance: 'neutral', emp: 'paid', plea: false, settled: false, acted: false, appeal: 0 };
  let p = c.guiltyP;
  p += ({ none: 0.05, basic: 0, good: -0.08, top: -0.15 } as any)[ch.lawyer] || 0;
  if (ch.stance === 'evidence') p += 0.07;
  if (c.role === 'airline' && !(c.hear && c.hear.kind === 'perjury')) {
    if (ch.stance === 'cooperate') p -= 0.05; if (ch.acted) p -= 0.1;
    // your record as the accountable manager
    try { if (groupPayRatio(c.companyId, 'mech').ratio < 0.9) p += 0.1; } catch (e) { /* ignore */ }
    if ((State.issues as any[]).filter(i => (plane(i.reg) || {} as any).companyId === c.companyId && i.status === 'open').length > 3) p += 0.05;
  }
  if (c.hear) p += c.hear.pAdj || 0;   // what was said in court
  const guilty = ch.plea || Math.random() < clamp(p, 0.05, 0.99);
  const o = courtOffence(c);
  let sev = 1;
  if (ch.plea) sev *= 0.7; sev *= ({ none: 1.1, basic: 1, good: 0.85, top: 0.75 } as any)[ch.lawyer] || 1;
  if (c.hear) sev *= c.hear.sevK || 1;
  if (ch.settled) sev *= 0.85; if (ch.acted) sev *= 0.85; if (c.role === 'airline' && ch.stance === 'cooperate') sev *= 0.9;
  const r: CourtResult = { prisonM: 0, suspended: false, life: false, servedM: 0, fine: 0, licence: !!o.licence, community: 0, probationM: 0, certDays: 0, releaseM: 0 };
  if (!guilty) return { guilty, r };
  if (o.months[0] === -2) { r.prisonM = Math.round(_rand(24, 48) * sev); r.suspended = true; r.certDays = Math.round(_rand(7, 21) * sev); }
  else if (o.months[0] === -3) r.certDays = Math.round(_rand(2, 7) * sev);
  else if (o.months[0] < 0) { if (Math.random() < 0.5 && sev > 0.8) r.life = true; else r.prisonM = Math.round(_rand(18, 25) * 12 * sev); }
  else { r.prisonM = Math.round(_rand(o.months[0], o.months[1]) * sev); if (r.prisonM > 0 && r.prisonM <= 8 && Math.random() < 0.55) r.suspended = true; }
  if (o.fine[1] > 0) r.fine = Math.round(_rand(o.fine[0], o.fine[1]) * sev / 500) * 500;
  if (!r.prisonM && !r.life && !r.certDays && r.fine < 20000) r.community = Math.round(_rand(40, 200) / 10) * 10;
  if (r.suspended) r.probationM = 24;
  // time already served in custody counts; release after about two thirds (85% in the US)
  r.servedM = r.suspended ? 0 : Math.min(c.custodyM || 0, r.prisonM || 999);
  if (r.prisonM && !r.suspended) r.releaseM = Math.max(0, Math.round(r.prisonM * (c.country === 'United States' ? 0.85 : 0.67)) - r.servedM);
  return { guilty, r };
}
function sentenceLine(r: CourtResult): string {
  const yrs = (m: number) => m >= 12 ? `${Math.floor(m / 12)} year${Math.floor(m / 12) > 1 ? 's' : ''}${m % 12 ? ` ${m % 12} month${m % 12 > 1 ? 's' : ''}` : ''}` : `${m} month${m > 1 ? 's' : ''}`;
  const p: string[] = [];
  if (r.life) p.push('life imprisonment');
  else if (r.prisonM) p.push(`${yrs(r.prisonM)} in prison${r.suspended ? ', suspended' : ''}`);
  if (r.certDays) p.push(`the operating certificate suspended for ${r.certDays} days`);
  if (r.fine) p.push(`a fine of ${money(r.fine)}`);
  if (r.licence) p.push('loss of the licence');
  if (r.community) p.push(`${r.community} hours of community service`);
  return p.join(', ') || 'a discharge with no penalty';
}
/** The sentence card: everything the court decided, in plain rows. */
function sentenceCardHtml(c: any): string {
  const r: CourtResult = c.res; if (!r) return '';
  const yrs = (m: number) => m >= 12 ? `${Math.floor(m / 12)} y ${m % 12 ? (m % 12) + ' m' : ''}`.trim() : `${m} month${m === 1 ? '' : 's'}`;
  const rows: [string, string][] = [];
  if (r.life) rows.push(['Prison', 'Life imprisonment, a minimum of 20 years before parole can be considered']);
  else if (r.prisonM) rows.push(['Prison', `${yrs(r.prisonM)}${r.suspended ? ', suspended: not served unless they offend again' : ''}`]);
  else rows.push(['Prison', 'None']);
  if (r.servedM) rows.push(['Time served', `${yrs(r.servedM)} in custody before the trial, counted towards the sentence`]);
  if (r.prisonM && !r.suspended && !r.life) rows.push(['Likely release', r.releaseM ? `In about ${yrs(r.releaseM)} (after ${c.country === 'United States' ? '85%' : 'two thirds'} of the sentence, with time served deducted)` : 'Released now: time served covers it']);
  if (r.probationM) rows.push(['Probation', `${r.probationM} months`]);
  if (r.fine) rows.push(['Fine', money(r.fine)]);
  if (r.community) rows.push(['Community service', `${r.community} hours`]);
  if (r.licence) rows.push(['Licence', 'Revoked by the authority']);
  if (r.certDays) rows.push(['Operating certificate', `Suspended for ${r.certDays} days: the airline's aircraft stay on the ground`]);
  return `<div class="sent-card"><b>${c.status === 'guilty' ? 'Sentence' : 'Verdict'}</b>${rows.map(x => `<div><small>${esc(x[0])}</small><span>${esc(x[1])}</span></div>`).join('')}</div>`;
}

/** Your choices on an open case (and the appeal or the aftermath on a decided one). */
function courtChoicesHtml(c: any): string {
  if (c.role === 'pax') return '';
  const ch: CourtChoices = c.ch; if (!ch) return '';
  const seg = (k: string, opts: [string, string][], cur: string, off?: boolean) => `<div class="seg">${opts.map(o => `<button class="${cur === o[0] ? 'on' : ''}" data-act="cc-set" data-id="${esc(c.id)}" data-k="${k}" data-v="${o[0]}" ${off ? 'disabled' : ''}>${esc(o[1])}</button>`).join('')}</div>`;
  const open = c.status === 'open', staff = c.role !== 'airline';
  let h = '';
  if (open) {
    h += `<div class="cc-row"><span><b>Defence</b><small>${esc(LAWYER_NAME[ch.lawyer])}${LAWYER_FEE[ch.lawyer] ? ', ' + money(LAWYER_FEE[ch.lawyer] * (c.role === 'airline' ? 6 : 1)) : ''}</small></span>${seg('lawyer', [['none', 'None'], ['basic', 'Standard'], ['good', 'Good'], ['top', 'Top']], ch.lawyer)}</div>`;
    h += staff ? `<div class="cc-row"><span><b>The airline's stance</b><small>${ch.stance === 'support' ? 'You stand by them in public' : ch.stance === 'evidence' ? 'You hand your internal records to the prosecutor' : 'You stay neutral and let the court decide'}</small></span>${seg('stance', [['support', 'Stand by them'], ['neutral', 'Neutral'], ['evidence', 'Hand over evidence']], ch.stance)}</div>`
      : `<div class="cc-row"><span><b>Your stance</b><small>${ch.stance === 'cooperate' ? 'Full cooperation with the investigators' : 'Defend the airline\'s record'}</small></span>${seg('stance', [['cooperate', 'Cooperate fully'], ['support', 'Defend the record']], ch.stance)}</div>`;
    if (staff) h += `<div class="cc-row"><span><b>Meanwhile</b><small>${ch.emp === 'paid' ? 'Suspended on full pay' : ch.emp === 'unpaid' ? 'Suspended without pay' : 'Dismissed now'}</small></span>${seg('emp', [['paid', 'Suspended, paid'], ['unpaid', 'Unpaid'], ['dismissed', 'Dismiss']], ch.emp)}</div>`;
    if (staff) h += `<div class="cc-row"><span><b>Plea</b><small>${ch.plea ? 'Your lawyer advises a guilty plea: a certain conviction, about 30% off the sentence' : 'Not guilty: the court weighs the evidence'}</small></span>${seg('plea', [['0', 'Not guilty'], ['1', 'Advise guilty plea']], ch.plea ? '1' : '0')}</div>`;
    if (courtVictims(c)) h += `<div class="cc-row"><span><b>Victims</b><small>${ch.settled ? 'Settled: compensation paid, the court takes it into account' : `Settle with the ${c.fatal ? 'families' : 'victims'} now (your insurer pays most of it)`}</small></span>${ch.settled ? '<b class="green">Settled</b>' : `<button class="btn ghost sm" data-act="cc-settle" data-id="${esc(c.id)}">Settle, ${money(courtSettleCost(c))}</button>`}</div>`;
    if (c.rec && c.stages.some((s: any) => s.key === 'report' && s.done)) h += `<div class="cc-row"><span><b>Recommendations</b><small>${ch.acted ? 'Acted on: the court takes it into account' : 'Act on the investigators\' recommendations before the trial'}</small></span>${ch.acted ? '<b class="green">Done</b>' : `<button class="btn ghost sm" data-act="cc-act" data-id="${esc(c.id)}">Act on them, ${money(courtActCost(c))}</button>`}</div>`;
  } else if (c.status === 'guilty' && !ch.appeal && c.role !== 'pax') {
    h += `<div class="cc-row"><span><b>Appeal</b><small>A higher court looks at the case again: the conviction may be overturned, the sentence reduced, or both upheld</small></span><button class="btn ghost sm" data-act="cc-appeal" data-id="${esc(c.id)}">Appeal, ${money(Math.round(Math.max(LAWYER_FEE[ch.lawyer], 8000) * 1.5 * (c.role === 'airline' ? 6 : 1)))}</button></div>`;
  }
  if (c.keepAsk) h += `<div class="cc-row"><span><b>${esc(c.name)}'s job</b><small>No prison to serve: keep them on (with a warning on their record), or let them go</small></span><span class="btn-row"><button class="btn ghost sm" data-act="cc-keep" data-id="${esc(c.id)}" data-v="1">Keep on</button><button class="btn ghost sm" data-act="cc-keep" data-id="${esc(c.id)}" data-v="0">Let go</button></span></div>`;
  return h ? `<div class="cc-box"><b class="cc-h">Your choices</b><small class="fine-print">${esc(courtBench(c).replace(/^the/, 'The'))} decides. Your choices weigh in, they never buy a verdict.</small>${h}</div>` : '';
}
function courtSettleCost(c: any): number { return c.fatal || c.role === 'airline' ? Math.round((c.fatal ? 2.4e6 : 6e5) * 0.3 / 1000) * 1000 : 15000; }   // your share after insurance
function courtActCost(c: any): number { return c.role === 'airline' ? 250000 : 120000; }

ACTIONS['cc-set'] = el => {
  const c: any = ((State as any).cases || []).filter((x: any) => x.id === el.getAttribute('data-id'))[0]; if (!c || c.status !== 'open') return;
  const k = el.getAttribute('data-k'), v = el.getAttribute('data-v'), ch: CourtChoices = c.ch;
  if (k === 'lawyer') {
    const add = (LAWYER_FEE[v] - LAWYER_FEE[ch.lawyer]) * (c.role === 'airline' ? 6 : 1);
    if (add > 0) payTxn(c.companyId, `Defence lawyer: ${c.name}`, -add, 'fees', [[LAWYER_NAME[v], -add]]);
    ch.lawyer = v as any;
  } else if (k === 'plea') ch.plea = v === '1';
  else if (k === 'emp') {
    ch.emp = v as any; const p: any = staffById(c.staffId);
    if (p) { if (v === 'dismissed') { courtRemove(p); c.dismissed = true; } else { p.suspendPay = v === 'paid' ? 1 : 0; if (v === 'unpaid') staffMoodAdd(p, -15); } }
  } else (ch as any)[k] = v;
  Store.save(); Sound.tick(); courtPopup(c.id);
};
ACTIONS['cc-settle'] = el => {
  const c: any = ((State as any).cases || []).filter((x: any) => x.id === el.getAttribute('data-id'))[0]; if (!c) return;
  const cost = courtSettleCost(c); payTxn(c.companyId, `Settlement with the ${c.fatal ? 'families' : 'victims'}: ${c.offence}`, -cost, 'fees', [['Your share after insurance', -cost]]);
  c.ch.settled = true; try { Progress.popularity(1, 'Settled fairly with victims'); } catch (e) { /* ignore */ }
  Store.save(); Sound.tick(); courtPopup(c.id);
};
ACTIONS['cc-act'] = el => {
  const c: any = ((State as any).cases || []).filter((x: any) => x.id === el.getAttribute('data-id'))[0]; if (!c) return;
  const cost = courtActCost(c); payTxn(c.companyId, 'Acting on the accident investigators\' recommendations', -cost, 'fees', (c.rec || []).map((x: string) => [x, -Math.round(cost / 3)]));
  c.ch.acted = true; Store.save(); Sound.tick(); courtPopup(c.id);
};
ACTIONS['cc-appeal'] = el => {
  const c: any = ((State as any).cases || []).filter((x: any) => x.id === el.getAttribute('data-id'))[0]; if (!c) return;
  const fee = Math.round(Math.max(LAWYER_FEE[c.ch.lawyer], 8000) * 1.5 * (c.role === 'airline' ? 6 : 1));
  payTxn(c.companyId, `Appeal: ${c.name}`, -fee, 'fees', [['Appeal lawyers and court costs', -fee]]);
  c.ch.appeal = 1; c.status = 'open'; c.appealing = true;
  if (c.hear) { c.hear.verdictSeen = true; c.stages.push({ at: Date.now() + 14 * H * (0.85 + Math.random() * 0.3), key: 'hearA', title: 'Appeal hearing', text: '' }); }
  c.stages.push({ at: Date.now() + 30 * H * (0.85 + Math.random() * 0.3), key: 'appeal', title: 'Appeal decided', text: '' });
  courtNotice(c, { at: Date.now(), key: 'appeal-filed', title: 'Appeal filed', text: `An appeal has been filed against the verdict. The appeal court will decide in about a day.` });
  Store.save(); Sound.tick(); courtPopup(c.id);
};
ACTIONS['cc-keep'] = el => {
  const c: any = ((State as any).cases || []).filter((x: any) => x.id === el.getAttribute('data-id'))[0]; if (!c) return;
  const p: any = staffById(c.staffId); c.keepAsk = false;
  if (p) { if (el.getAttribute('data-v') === '1') { p.suspended = ''; p.status = 'standby'; p.warnings = (p.warnings || 0) + 1; staffMoodAdd(p, 10); toast(`${p.name} stays on`, 'ok'); } else courtRemove(p); }
  Store.save(); courtPopup(c.id);
};

/** The verdict (and an appeal): applied to the case, the person, the airline; the papers report it. */
function courtVerdictApply(c: any, st: any) {
  const { guilty, r } = courtDecide(c);
  c.status = guilty ? 'guilty' : 'acquitted'; c.res = r; c.sentence = guilty ? sentenceLine(r) : '';
  const bench = courtBench(c);
  st.title = guilty ? 'Guilty' : 'Not guilty';
  st.text = guilty ? `${bench.charAt(0).toUpperCase() + bench.slice(1)} found ${c.name} guilty of ${c.charge.toLowerCase()}${c.ch && c.ch.plea ? ', on a guilty plea' : ''}. Sentence: ${c.sentence}.${r.servedM ? ` ${r.servedM} months already served in custody count towards it.` : ''}`
    : `${bench.charAt(0).toUpperCase() + bench.slice(1)} found ${c.name} not guilty.`;
  courtAftermath(c, guilty);
  courtCivil(c, guilty);
  newsCourt(c, 'verdict');
  try { hearingAftermath(c, guilty); } catch (e) { /* ignore */ }
}
function courtAppealApply(c: any, st: any) {
  const roll = Math.random() - (c.hear ? c.hear.appealAdj || 0 : 0), lawyerBonus = ({ none: 0, basic: 0, good: 0.05, top: 0.1 } as any)[c.ch.lawyer] || 0;
  c.appealing = false;
  if (roll < 0.22 + lawyerBonus) { c.status = 'acquitted'; c.res = Object.assign({}, c.res, { prisonM: 0, fine: 0, licence: false, community: 0, certDays: 0, releaseM: 0, life: false }); c.sentence = ''; st.title = 'Appeal: conviction overturned'; st.text = `The appeal court overturned the conviction of ${c.name}.`; }
  else if (roll < 0.6 + lawyerBonus) { const r = c.res; r.prisonM = Math.round(r.prisonM * 0.6); r.fine = Math.round(r.fine * 0.6 / 500) * 500; r.releaseM = Math.round(r.releaseM * 0.55); r.certDays = Math.round(r.certDays * 0.5); c.status = 'guilty'; c.sentence = sentenceLine(r); st.title = 'Appeal: sentence reduced'; st.text = `The appeal court upheld the conviction but reduced the sentence to ${c.sentence}.`; }
  else { c.status = 'guilty'; st.title = 'Appeal: verdict upheld'; st.text = `The appeal court upheld the verdict and the sentence: ${c.sentence}.`; }
  newsCourt(c, 'appeal');
}
/** After the verdict: the person's job, prison and release; the airline's punishment. */
function courtAftermath(c: any, guilty: boolean) {
  const p: any = c.role === 'airline' || c.role === 'pax' ? null : staffById(c.staffId), r: CourtResult = c.res;
  if (c.role === 'airline') {
    const co: any = company(c.companyId); if (!co) return;
    if (!guilty) { co.reputation = Math.min(100, co.reputation + 5); return; }
    if (r.fine) payTxn(co.id, `Court fine: ${c.offence}`, -r.fine, 'fees', [[c.court, -r.fine]]);
    if (r.certDays) (State as any).groundedUntil = Object.assign((State as any).groundedUntil || {}, { [co.id]: Date.now() + r.certDays * 864e5 });
    co.reputation = Math.max(0, co.reputation - (c.ch && c.ch.stance === 'cooperate' ? 6 : 12));
    return;
  }
  if (!p || c.dismissed) { if (guilty && r.prisonM && !r.suspended) c.releaseAt = Date.now() + Math.min(45, Math.max(1, r.releaseM)) * 864e5; return; }
  if (!guilty) { p.suspended = ''; p.status = 'standby'; if (c.ch && c.ch.stance === 'evidence') staffMoodAdd(p, -20); else if (c.ch && c.ch.stance === 'support') staffMoodAdd(p, 15); return; }
  if (r.life || (r.prisonM && !r.suspended)) {
    courtRemove(p);
    if (!r.life) c.releaseAt = Date.now() + Math.min(45, Math.max(1, r.releaseM)) * 864e5;   // a month of the sentence is a day here
  } else if (r.licence && (personRole(p) === 'captain' || personRole(p) === 'fo' || personRole(p) === 'mech')) courtRemove(p);
  else c.keepAsk = true;   // no prison: you decide about the job
  // standing by someone who is then convicted costs the airline some trust
  if (c.ch && c.ch.stance === 'support') { const co: any = company(c.companyId); if (co) co.reputation = Math.max(0, co.reputation - 4); }
}
/** Civil claims from victims or families, beside the criminal case. */
function courtCivil(c: any, guilty: boolean) {
  if (!courtVictims(c) || (c.ch && c.ch.settled) || !guilty || c.role === 'pax') return;
  const total = c.fatal || c.role === 'airline' ? Math.round(_rand(1.5e6, 4e6) / 1000) * 1000 : Math.round(_rand(20000, 80000) / 100) * 100;
  const share = Math.round(total * 0.4);   // insurance covers 60% once a court orders it
  payTxn(c.companyId, `Civil claims: ${c.offence}`, -share, 'fees', [[`Damages ordered: ${money(total)}`, -total], ['Paid by the insurer', total - share]]);
  State.notices.unshift({ id: uid(), kind: 'finance' as any, title: `Civil claims after ${c.name}'s conviction`, body: `The ${c.fatal ? 'families' : 'victims'} sued the airline and won ${money(total)}. Your insurer pays ${money(total - share)}; ${money(share)} is yours, and the premium will rise. Settling early would have cost less.`, time: 'Now', at: Date.now(), read: false } as any);
}
/** Released from prison: some ask for their job back. */
function courtReleases() {
  const S: any = State;
  for (const c of (S.cases || []) as any[]) {
    if (!c.releaseAt || c.released || Date.now() < c.releaseAt || c.status !== 'guilty') continue;
    c.released = true;
    if (Math.random() < 0.6) State.notices.unshift({ id: uid(), kind: 'staff' as any, title: `${c.name} has been released and asks for a second chance`, body: `${c.name} served their sentence for ${c.offence.toLowerCase()} and would like to work for you again${c.res && c.res.licence ? ', in a job that needs no licence' : ''}. Open the case to decide.`, time: 'Now', at: Date.now(), read: false, ref: c.id } as any);
    c.rehireAsk = true;
  }
}
ACTIONS['cc-rehire'] = el => {
  const c: any = ((State as any).cases || []).filter((x: any) => x.id === el.getAttribute('data-id'))[0]; if (!c) return;
  c.rehireAsk = false;
  if (el.getAttribute('data-v') === '1') {
    const role = c.res && c.res.licence && (c.role === 'pilot' || c.role === 'fo' || c.role === 'mech') ? 'ground' : c.role === 'pilot' ? 'fo' : c.role;
    const p: any = makePerson('rehire-' + c.id, role as any, c.companyId, company(c.companyId).hub);
    p.name = c.name; if (c.look) p.look = c.look; p.warnings = 1; p.rating = Math.max(2.8, p.rating - 0.6); p.secondChance = true;
    (State as any).staff.push(p); toast(`${c.name} is back, as ${ROLE_NAMES[role].toLowerCase()}`, 'ok');
  }
  Store.save(); closeAll(); refresh();
};

/* ---------- in the papers ---------- */
function newsCourt(c: any, kind: 'charge' | 'verdict' | 'appeal') {
  const co = company(c.companyId), base = apt((staffById(c.staffId) || {} as any).base || (co ? co.hub : '')) || apt(co ? co.hub : 'EKVG');
  const who = c.role === 'pax' ? `a passenger` : c.role === 'airline' ? `${co.name}` : `${ROLE_NAMES[c.role === 'pilot' ? 'captain' : c.role] || 'A crew member'} ${c.name}`;
  const city = base ? base.city : '', prosecutor: any = makePerson('pros-' + c.id, 'captain', '', base ? base.icao : 'EKVG'), lawyer: any = makePerson('law-' + c.id, 'captain', '', base ? base.icao : 'EKVG');
  const st = c.ch ? c.ch.stance : 'neutral', me: any = myPilot();
  const airlineSays = c.role === 'pax' ? `Our crew acted quickly and professionally. Behaviour like this is never acceptable on our flights.`
    : st === 'support' ? (kind === 'charge' ? `We stand by our colleague and trust the court to reach a fair decision.` : c.status === 'guilty' ? `We are disappointed, but we respect the court's decision.` : `We are glad our colleague has been cleared.`)
    : st === 'evidence' || st === 'cooperate' ? `We cooperated fully with the authorities. Safety and honesty come first.` : kind === 'charge' ? `We respect the court's process and will not comment further while it is under way.` : `We respect the court's decision.`;
  let headline = '', sf = '', body: string[] = [];
  if (kind === 'charge') {
    headline = c.role === 'airline' ? `${co.name} charged after ${c.fatal ? 'fatal ' : ''}accident` : c.role === 'pax' ? `Passenger charged after trouble on ${co.name} flight` : `${co.name} ${(ROLE_NAMES[c.role === 'pilot' ? 'captain' : c.role] || 'employee').toLowerCase()} charged`;
    sf = `${c.name} faces a charge of ${c.charge.toLowerCase()} before ${c.court}.`;
    body = [c.summary, `Prosecutors charged ${c.role === 'airline' ? 'the airline and its accountable manager' : c.name} with ${c.charge.toLowerCase()}. ${c.sys === 'jury' ? 'A jury will hear the case.' : c.sys === 'lay' ? 'A professional judge and two lay judges will hear the case.' : 'A panel of judges will hear the case.'}`, c.role === 'pax' ? '' : `${co.name} said the ${c.role === 'airline' ? 'airline' : 'employee'} ${c.role === 'airline' ? 'would defend itself' : 'has been suspended while the case is heard'}.`].filter(Boolean);
  } else {
    const guilty = c.status === 'guilty';
    headline = kind === 'appeal' ? `Appeal court rules in ${c.name} case` : guilty ? (c.res && (c.res.life || c.res.prisonM >= 12) && !c.res.suspended ? `${c.role === 'airline' ? co.name + "'s manager" : c.name} jailed for ${c.charge.split(' and ')[0].toLowerCase()}` : `${c.name} convicted of ${c.charge.split(' and ')[0].toLowerCase()}`) : `${c.name} cleared by ${c.sys === 'jury' ? 'jury' : 'court'}`;
    sf = guilty ? `Sentence: ${c.sentence}.` : `${c.name} walked free from ${c.court} today.`;
    body = [`${courtBench(c).charAt(0).toUpperCase() + courtBench(c).slice(1)} at ${c.court} ${guilty ? 'found' : 'did not find'} ${who === co.name ? co.name : c.name} guilty of ${c.charge.toLowerCase()}${kind === 'appeal' ? ' on appeal' : ''}.`,
      c.summary, guilty && c.res ? `${c.res.servedM ? `The ${c.res.servedM} months already spent in custody count towards the sentence. ` : ''}${c.res.releaseM ? `With time off for good behaviour, release could come in about ${c.res.releaseM >= 12 ? Math.round(c.res.releaseM / 12) + ' years' : c.res.releaseM + ' months'}.` : ''}` : '', c.ch && c.ch.settled ? `${co.name} had already settled with the ${c.fatal ? 'families' : 'victims'}, which the court took into account.` : ''].filter(Boolean);
  }
  newsPublish({ paper: newsPaper(c.country), section: kind === 'charge' ? 'Courts' : 'Courts · Verdict', place: city, headline, standfirst: sf, body,
    quote: [kind === 'charge' ? `The evidence will show what happened, and the court will decide.` : c.status === 'guilty' ? `Today's verdict shows that aviation safety is taken seriously.` : `We accept the court's decision.`, `${prosecutor.name}, prosecutor`],
    quote2: c.role === 'pax' ? [airlineSays, `${me.name}, ${co.name}`] : [st === 'support' || c.role === 'airline' ? `${kind === 'charge' ? 'We will show the court the full picture.' : c.status === 'guilty' ? 'We will study the judgment and consider an appeal.' : 'Justice has been done.'}` : airlineSays, st === 'support' || c.role === 'airline' ? `${lawyer.name}, for the defence` : `${me.name}, ${co.name}`],
    art: c.role === 'pax' || c.role === 'airline' || !c.look ? { kind: 'court' } : { kind: 'person', look: c.look, role: c.role === 'pilot' ? 'captain' : c.role, color: co.color }, companyId: c.companyId }, kind !== 'charge' || c.fatal || c.role === 'airline');
}

/* ---------- whistleblowers ---------- */
function whistleAdvance() {
  const S: any = State, day = new Date().toDateString(); if (S.wbDay === day) return; S.wbDay = day;
  if (S.whistle && S.whistle.open) return;
  for (const c of State.companies) {
    const risks: string[] = [];
    try { if (groupPayRatio(c.id, 'mech').n >= 3 && groupPayRatio(c.id, 'mech').ratio < 0.9) risks.push('mechanics are so underpaid and overworked that inspections are being rushed'); } catch (e) { /* ignore */ }
    const open = (State.issues as any[]).filter(i => (plane(i.reg) || {} as any).companyId === c.id && i.status === 'open');
    if (open.length > 3) risks.push(`${open.length} known defects are being left open while the aircraft keep flying`);
    if (companyBases(c.id).some(k => (typeof groundBlock === 'function') && groundCrewFree(c.id, k).length === 0 && fleetOf(c.id).some(a => (a.base || c.hub) === k))) risks.push('a base has no ground crew and aircraft are turned round without proper checks');
    if (!risks.length || Math.random() > 0.04) continue;
    const pool = staffOf(c.id, 'mech').concat(staffOf(c.id, 'ground')).filter((p: any) => !p.suspended);
    const p: any = pool[Math.floor(Math.random() * pool.length)]; if (!p) continue;
    S.whistle = { open: true, cid: c.id, staffId: p.id, name: p.name, what: risks[0], at: Date.now() };
    State.notices.unshift({ id: uid(), kind: 'staff' as any, title: `${p.name} reports a safety problem`, body: `${p.name} came to you in confidence: ${risks[0]}. What do you do?`, time: 'Now', at: Date.now(), read: false, ref: 'wb-' + p.id } as any);
    try { renderTopbar(); } catch (e) { /* ignore */ }
    return;
  }
}
function whistlePopup() {
  const w = (State as any).whistle; if (!w || !w.open) return;
  const p: any = staffById(w.staffId);
  closeAll();
  openLayer('modal', `<div class="modal-head"><div><h2>${esc(w.name)} reports a safety problem</h2><small>In confidence, to you</small></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
    <div class="modal-body"><div class="mood-face">${p && p.look ? avatarSvg(p.look, personRole(p), { view: 'bust', accent: company(w.cid).color, still: true }) : ''}<p class="lede">“I have to tell someone: ${esc(w.what)}. If nothing changes, someone will get hurt.”</p></div>
    <div class="btn-col strike-opts">
      <button class="btn primary" data-act="wb-do" data-v="fix">${icon('check')}Thank them and fix it<small>About ${money(150000)}; staff trust grows</small></button>
      <button class="btn ghost" data-act="wb-do" data-v="ignore">${icon('clock')}Thank them, do nothing<small>Cheaper today; if it comes out later, it is far worse</small></button>
      <button class="btn danger" data-act="wb-do" data-v="fire">${icon('trash')}Dismiss them<small>Firing a whistleblower is against the law in most countries</small></button>
    </div></div>`, { cls: 'strike-modal' });
}
ACTIONS['wb-do'] = el => {
  const S: any = State, w = S.whistle; if (!w) return; w.open = false;
  const v = el.getAttribute('data-v'), p: any = staffById(w.staffId), co = company(w.cid); w.choice = v;
  if (v !== 'fix' && Math.random() < 0.6) { try { newsWhistle(co, p, w.what || 'safety'); } catch (e) { /* ignore */ } }
  if (v === 'fix') { payTxn(w.cid, 'Safety review after a staff report', -150000, 'fees', [['Inspections, staffing and records', -150000]]); staffOf(w.cid).forEach((x: any) => staffMoodAdd(x, 3)); if (p) staffMoodAdd(p, 15); toast('Fixed. Your staff noticed.', 'ok'); }
  else if (v === 'ignore') { if (Math.random() < 0.4 && p) setTimeout(() => { openCourtCase({ id: 'airline-' + co.id, name: co.name, look: null, base: co.hub, companyId: co.id }, 'airline', 2, 'staff warnings about safety were ignored: ' + w.what); }, 2000); }
  else { if (p) courtRemove(p); if (Math.random() < 0.6) setTimeout(() => { openCourtCase({ id: 'airline-' + co.id, name: co.name, look: null, base: co.hub, companyId: co.id }, 'airline', 2, `the airline dismissed ${w.name} for reporting that ${w.what}`); }, 2000); }
  Store.save(); closeAll(); refresh();
};
