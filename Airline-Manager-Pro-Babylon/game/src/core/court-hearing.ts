// The airline in court, in person. When an accident with deaths is blamed on how the airline is run
// (an aircraft flown with known defects or in poor condition, mechanics underpaid, too few, tired or not
// qualified, staff warnings ignored), the airline is prosecuted and you, the accountable manager, attend
// the hearing in the courtroom (court3d.ts) over a couple of days:
//  - Day one: the charges and the evidence. The investigation report and your own records (maintenance,
//    open defects, mechanics' numbers, qualifications and pay) are shown as exhibits; the judge and the
//    prosecutor ask you about them.
//  - Day two: the witnesses: your chief mechanic, a survivor, a relative; more questions.
//  - Day three: the families' settlement offer, your plea, the closing speeches and your last word.
//  - Then the verdict, read out in court, and an appeal hearing if you appeal.
// Your answers are checked against the records: honesty is taken into account, an answer the records
// contradict counts against you, and every answer moves your company rating. Your lawyer sits beside you,
// suggests answers and can object to the prosecutor's questions. Each day is in the papers.
// You may leave the courtroom (Esc) before the court rises only by paying for a board member to stand in for
// you; they then attend the rest of the case, and the big decisions (a settlement, a plea, an appeal) still
// come to you. A day you miss without a stand-in counts against you. Settings → Court switches it all off.

interface HearQ {
  id: string; asker: 'judge' | 'prosecutor'; text: string; truth: boolean;
  opts: { t: string; kind: 'honest' | 'deflect' | 'lie' | 'act' | 'settle' | 'nosettle' | 'plea' | 'noplea' | 'sorry' | 'defend' | 'silent' }[];
  after?: { [kind: string]: string };
  decision?: boolean;
}
interface HearLine { who: string; text: string; ex?: { title: string; rows: [string, string][]; note?: string }; q?: HearQ; mood?: string; ask?: { id: string; opts: { t: string; kind: string }[] } }
interface HearFacts { reg: string; model: string; from: string; to: string; pax: number; dead: number; open: number; openTitles: string[]; cond: number; payRatio: number; coverage: number; skill: number; mechs: number; need: number; fleet: number; warned: string }

function courtOn(): boolean { return (State.settings as any).courtOn !== false; }

/** Set just before a case is opened for an accident, so the hearing knows which flight it was about. */
let _courtCrash: any = null;

/** The airline's record at the time of the accident: what the court will see. */
function hearingFacts(cid: string, crash: any): HearFacts {
  const S: any = State, mq = maintQuality(cid), fl = fleetOf(cid), a = crash && crash.reg ? (plane(crash.reg) || null) : null;
  let need = 0; try { fl.forEach(x => need += (MECH_RATIO as any)[acType(x.typeId).cls] || 1); } catch (e) { need = fl.length; }
  const issues = crash && crash.issues ? crash.issues : (State.issues as any[]).filter(i => crash && i.reg === crash.reg && i.status === 'open').map(i => i.title);
  let pay = 1; try { pay = groupPayRatio(cid, 'mech').ratio || 1; } catch (e) { /* no pay scale */ }
  const w = S.whistle && S.whistle.cid === cid && (S.whistle.choice === 'ignore' || S.whistle.choice === 'fire') ? `${S.whistle.name} warned you that ${S.whistle.what}` : '';
  const t = acType((crash && crash.typeId) || (a ? a.typeId : (fl[0] ? fl[0].typeId : 'a320neo')));
  return {
    reg: (crash && crash.reg) || (fl[0] ? fl[0].reg : ''), model: t ? t.model : 'aircraft', from: (crash && crash.from) || '', to: (crash && crash.to) || company(cid).hub,
    pax: (crash && crash.pax) || 0, dead: (crash && crash.dead) || 0, open: issues.length, openTitles: issues.slice(0, 4),
    cond: Math.round(crash && crash.cond != null ? crash.cond : a ? a.condition : 70), payRatio: Math.round(pay * 100) / 100, coverage: Math.round(mq.coverage * 100) / 100, skill: Math.round(mq.skill * 100) / 100,
    mechs: staffOf(cid, 'mech').length, need: Math.max(1, Math.ceil(need)), fleet: fl.length, warned: w,
  };
}
function hearNeglect(f: HearFacts): string[] {
  const why: string[] = [];
  if (f.open) why.push(`${f.open} known ${f.open === 1 ? 'defect' : 'defects'} left unrepaired on ${f.reg}`);
  if (f.cond < 35) why.push(`${f.reg} was flown in poor condition (${f.cond}%)`);
  if (f.payRatio < 0.9) why.push(`mechanics paid ${Math.round(f.payRatio * 100)}% of the going rate`);
  if (f.coverage < 0.8) why.push(`too few mechanics for the fleet, working long, tiring hours (${f.mechs} for ${f.fleet} aircraft)`);
  if (f.skill && f.skill < 0.65) why.push('poorly qualified mechanics doing work they were not trained for');
  if (f.warned) why.push('staff warnings about safety were ignored');
  return why;
}

/** A crash you registered, with deaths: if the airline's neglect is behind it, the airline goes to court. */
function courtNeglectCheck(a: any, l: any, d: any) {
  if (!courtOn() || !a) return;
  const co = company(a.companyId); if (!co) return;
  if (((State as any).cases || []).some((c: any) => c.role === 'airline' && c.companyId === co.id && c.status === 'open')) return;
  const crash = { reg: a.reg, typeId: a.typeId, from: l.from, to: l.to, pax: l.pax, dead: d.dead, cond: l.condBefore != null ? l.condBefore : a.condition, issues: (State.issues as any[]).filter(i => i.reg === a.reg && i.status === 'open' && i.title.indexOf('rash') < 0).map(i => i.title) };
  const why = hearNeglect(hearingFacts(co.id, crash));
  if (!why.length || Math.random() > 0.75) return;   // investigators don't always prove it
  _courtCrash = crash;
  setTimeout(() => { try { openCourtCase({ id: 'airline-' + co.id, name: co.name, look: null, base: co.hub, companyId: co.id }, 'airline', 1, why.join('; ')); } finally { _courtCrash = null; } }, 9000);
}
(window as any).courtNeglectCheck = courtNeglectCheck;

/** A new case against the airline: the trial days become hearings you attend. */
function hearingSetup(c: any) {
  if (c.role !== 'airline') return;
  const f = hearingFacts(c.companyId, _courtCrash);
  if (_courtCrash) { c.reg = f.reg; c.fatal = f.dead > 0 || c.fatal; }
  c.hear = { facts: f, pAdj: 0, sevK: 1, lies: 0, honest: 0, absent: 0, rating: 0, standIn: null, log: [] as string[], appealAdj: 0 };
  const st = c.stages, i1 = st.findIndex((s: any) => s.key === 'trial1'), i2 = st.findIndex((s: any) => s.key === 'trial2'), iv = st.findIndex((s: any) => s.key === 'verdict');
  if (i1 < 0 || i2 < 0 || iv < 0) return;
  Object.assign(st[i1], { key: 'hear1', title: 'Hearing, day one: the charges and the evidence', text: '' });
  Object.assign(st[i2], { key: 'hear2', title: 'Hearing, day two: the witnesses', text: '' });
  st.splice(iv, 0, { at: st[i2].at + (st[iv].at - st[i2].at) * 0.55, key: 'hear3', title: 'Hearing, day three: the families, the plea and the last word', text: '' });
}

const HEAR_TITLES: { [k: string]: string } = { hear1: 'Day one', hear2: 'Day two', hear3: 'Day three', hearA: 'Appeal hearing', verdict: 'The verdict' };

/** A hearing stage has come: call you to court; after a while without you, it goes ahead without you. */
function hearingDue(c: any, st: any): 'wait' | 'done' {
  const now = Date.now();
  if (!courtOn()) { hearingAuto(c, st, 'off'); return 'done'; }
  if (c.hear.standIn) { hearingAuto(c, st, 'standin'); return 'done'; }
  if (!st.called) {
    st.called = now; st.deadline = now + 8 * 3600e3;
    State.notices.unshift({ id: uid(), kind: 'authority' as any, title: `Court is in session: ${st.title.toLowerCase()}`, body: `${c.court} is sitting now in the case against ${c.name}. Go to court to answer the questions yourself. If you don't come within 8 hours, it goes ahead without you, and that counts against you.`, time: 'Now', at: now, read: false, ref: c.id } as any);
    try { Sound.chime(); toast(`Court is in session: ${HEAR_TITLES[st.key] || 'hearing'}`, 'warn', { label: 'Go to court', act: 'court-attend', data: c.id }); renderTopbar(); } catch (e) { /* not ready */ }
    Store.save(); return 'wait';
  }
  if (now > st.deadline && c.hear.kind !== 'accident') { hearingAuto(c, st, 'absent'); return 'done'; }   // after an accident the court waits for you
  return 'wait';
}
/** The verdict waits (up to 12 hours) for decisions only you can make: the settlement and the plea. */
function hearingVerdictReady(c: any): boolean {
  const h = c.hear; if (!h.pending || !h.pending.length) return true;
  if (!h.pendingBy) { h.pendingBy = Date.now() + 12 * 3600e3; Store.save(); }
  if (Date.now() < h.pendingBy) return false;
  h.pending = []; return true;   // no answer: no settlement, not guilty
}
/** Reminders the day before each hearing. */
function hearingReminders() {
  const now = Date.now();
  for (const c of ((State as any).cases || []) as any[]) {
    if (!c.hear || (c.status !== 'open' && !c.appealing)) continue;
    for (const st of c.stages) {
      if (st.done || st.reminded || !/^hear[0-9A]$/.test(st.key) || st.at - now > 14 * 3600e3 || st.at < now) continue;
      st.reminded = true;
      const d = new Date(st.at), when = `${d.toDateString() === new Date().toDateString() ? 'today' : 'tomorrow'} at ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      State.notices.unshift({ id: uid(), kind: 'authority' as any, title: `Court resumes ${when}`, body: `${st.title} in the case against ${c.name}, at ${c.court}.${c.hear.standIn ? ` ${c.hear.standIn.name} will attend for you.` : ' Be there to answer for the airline.'}`, time: 'Now', at: now, read: false, ref: c.id } as any);
    }
  }
}

/** The next hearing waiting for you (called, not yet held). */
function hearingWaiting(c: any): any { return c && c.hear ? c.stages.filter((s: any) => /^hear[0-9A]$/.test(s.key) && s.called && !s.done)[0] || null : null; }

/** A hearing held without you: by your stand-in, in your absence, or with court hearings switched off. */
function hearingAuto(c: any, st: any, how: 'standin' | 'absent' | 'off', skip?: string[]) {
  const h = c.hear, lines = hearingScript(c, st.key), si = h.standIn;
  for (const ln of lines) {
    if (!ln.q || (skip && skip.indexOf(ln.q.id) >= 0)) continue;
    const q = ln.q;
    if (q.decision) { if (how === 'standin' && /settle|plea/.test(q.opts.map(o => o.kind).join())) { h.pending = h.pending || []; if (h.pending.indexOf(q.id) < 0) h.pending.push(q.id); } continue; }
    if (how === 'off') continue;
    const kind = how === 'absent' ? 'deflect' : Math.random() < si.skill ? (q.opts.some(o => o.kind === 'honest') ? 'honest' : 'deflect') : 'deflect';
    hearingScore(c, q, kind as any, true);
  }
  if (how === 'absent') { h.absent++; h.pAdj += h.kind === 'staff' ? -0.08 : 0.05; hearRate(c, -2, 'Did not come to court'); }   // without your evidence, a case you brought is weaker
  st.done = true; st.held = how;
  st.text = how === 'standin' ? `${si.name} attended for you. ${hearingDaySummary(c, st.key)}` : how === 'absent' ? `You did not come to court. The hearing went ahead without you, and the court noted your absence. ${hearingDaySummary(c, st.key)}` : hearingDaySummary(c, st.key);
  if (how === 'standin') { h.lastStandIn = si; h.standIn = null; }   // one court day at a time: you decide again for the next
  hearingAfterDay(c, st);
  if (how === 'standin' && h.pending && h.pending.length) {
    State.notices.unshift({ id: uid(), kind: 'authority' as any, title: `${si.name} needs your decision`, body: `In the case against ${c.name}: ${h.pending.map((k: string) => k === 'settle' ? 'the families offer a settlement' : 'your lawyer asks how the airline pleads').join(', and ')}. These are your decisions to make.`, time: 'Now', at: Date.now(), read: false, ref: c.id } as any);
  }
}
/** What happened on a day, for the case file and the papers. */
function hearingDaySummary(c: any, key: string): string {
  const h = c.hear, f: HearFacts = h.facts;
  if (h.kind === 'perjury') return key === 'hear1' ? `You stood trial for perjury. The court heard the transcript of your evidence and the records that contradict it.${c.ch && c.ch.plea ? ' You pleaded guilty.' : ''}` : '';
  if (h.kind === 'accident') return key === 'hear1' ? `The court heard the accident investigators, the witnesses and your evidence.${h.lies ? ' Some of your answers did not match the records.' : h.honest ? ' You answered openly.' : ''}` : key === 'hear2' ? `The trial: the court heard the person at fault, the families and your last word.${c.ch && c.ch.plea ? ' The airline pleaded guilty.' : ''}` : '';
  if (h.kind === 'staff') return key === 'hear1' ? `The court heard the airline's evidence about ${c.name}: the conduct report and the staff record.${h.lies ? ' Parts of the airline\'s evidence did not match the records.' : ''}` : key === 'hear2' ? `${c.name} took the stand and answered the airline's questions.${h.caught ? ' The answers did not always match the evidence.' : ''} Both sides closed their case.` : '';
  if (key === 'hear1') return `The prosecution presented the investigation report and the airline's maintenance records${f.open ? `, including ${f.open} unrepaired ${f.open === 1 ? 'defect' : 'defects'} on ${f.reg}` : ''}. ${h.lies ? 'Some of the airline\'s answers were contradicted by its own records.' : h.honest ? 'The airline answered the court\'s questions openly.' : 'The airline gave guarded answers.'}`;
  if (key === 'hear2') return `The court heard the airline's chief mechanic, a surviving passenger and the family of one of the victims.`;
  if (key === 'hear3') return `${c.ch && c.ch.settled ? 'The airline settled with the families. ' : 'No settlement was reached with the families. '}${c.ch && c.ch.plea ? 'The airline pleaded guilty. ' : 'The airline maintained it was not guilty. '}Both sides made their closing speeches, and the court will give its verdict.`;
  if (key === 'hearA') return `The appeal court heard both sides and will give its decision.`;
  return '';
}
/** After a day in court: the next days move so there's always time between them; the papers report it. */
function hearingAfterDay(c: any, st: any) {
  const now = Date.now(); let t = now;
  const gap = c.hear && c.hear.kind === 'accident' ? invGap() * 0.5 : 5 * 3600e3;
  for (const s of c.stages) { if (s.done || s === st) continue; t = Math.max(s.at, t + gap); s.at = t; s.reminded = false; }
  State.notices.unshift({ id: uid(), kind: 'authority' as any, title: `${c.name}: ${st.title.toLowerCase()}`, body: st.text, time: 'Now', at: now, read: false, ref: c.id } as any);
  try { newsHearing(c, st); } catch (e) { /* no paper today */ }
  Store.save(); try { renderTopbar(); refresh(); } catch (e) { /* not ready */ }
}

/** Your company rating moves with what you say in court. */
function hearRate(c: any, d: number, why: string) {
  c.hear.rating = Math.round(((c.hear.rating || 0) + d) * 10) / 10;
  const co: any = company(c.companyId); if (!co) return;
  co.reputation = clamp(Math.round(((co.reputation || 50) + d) * 10) / 10, 0, 100);
  const S: any = State; S.popLog = S.popLog || []; S.popLog.unshift({ t: Date.now(), cid: co.id, d, why: 'In court: ' + why, v: co.reputation }); S.popLog = S.popLog.slice(0, 200);
}

/** Weigh an answer: against the records, for the verdict and the sentence, and for your company rating.
 *  Returns what is said next (the judge's reaction) and the rating change. */
function hearingScore(c: any, q: HearQ, kind: string, quiet?: boolean): { say: string; d: number } {
  if (c.hear && c.hear.kind === 'staff') return hearingScoreStaff(c, q, kind, quiet);
  const h = c.hear; let d = 0, say = (q.after && q.after[kind]) || '';
  switch (kind) {
    case 'honest': h.honest++; if (q.truth) { h.pAdj += 0.02; h.sevK *= 0.93; d = 0.6; } else { h.pAdj -= 0.05; d = 0.8; } break;
    case 'deflect': h.pAdj += 0.02; d = -0.4; break;
    case 'lie': h.lies++; h.pAdj += 0.08; h.sevK *= 1.08; d = -2; break;
    case 'act': h.honest++; d = 1.2; break;
    case 'settle': case 'nosettle': h.log.push(q.id + ':' + kind); return { say, d: kind === 'settle' ? 1.5 : -1 };   // rated where it is decided (hearDecide)
    case 'plea': d = 0.5; break;
    case 'noplea': d = 0; break;
    case 'sorry': h.sevK *= 0.95; d = 1.5; break;
    case 'defend': h.pAdj += hearNeglect(h.facts).length ? 0.02 : -0.02; d = hearNeglect(h.facts).length ? -0.6 : 0.3; break;
    case 'silent': d = 0; break;
  }
  if (q.id === 'appeal') h.appealAdj += kind === 'honest' ? 0.08 : kind === 'defend' ? -0.04 : 0;
  if (!quiet || c.hear.standIn) hearRate(c, d, kind === 'lie' ? 'An answer the records contradicted' : kind === 'honest' ? 'An honest answer' : kind === 'deflect' ? 'An evasive answer' : kind === 'sorry' ? 'A sincere apology' : kind === 'settle' ? 'Settled with the families' : kind === 'nosettle' ? 'Refused the families\' settlement' : kind === 'act' ? 'Acted on the recommendations' : 'In court');
  h.log.push(q.id + ':' + kind);
  return { say, d };
}

/** Your lawyer's suggestion: the better the lawyer, the better the advice. */
function hearingSuggest(c: any, q: HearQ): number {
  if (c.hear && c.hear.kind === 'staff') return q.decision ? -1 : q.opts.findIndex(o => o.kind === 'honest');   // the prosecutor's advice: tell it as it is
  const lw = (c.ch && c.ch.lawyer) || 'basic', good = q.opts.findIndex(o => o.kind === 'honest' || o.kind === 'act' || o.kind === 'sorry' || o.kind === 'settle');
  if (lw === 'none') return -1;
  if (lw === 'basic' && !q.decision) { const df = q.opts.findIndex(o => o.kind === 'deflect'); return Math.random() < 0.5 && df >= 0 ? df : good; }
  return good;
}
/** Can your lawyer object to this question? */
function hearingCanObject(c: any, q: HearQ): boolean { return !(c.hear && c.hear.kind === 'staff') && q.asker === 'prosecutor' && !q.decision && c.ch && (c.ch.lawyer === 'good' || c.ch.lawyer === 'top'); }
function hearingObject(c: any): boolean { const p = c.ch.lawyer === 'top' ? 0.65 : 0.45; return Math.random() < p; }

/* ---------- what is said in court ---------- */
function hearingScript(c: any, key: string): HearLine[] {
  if (c.hear && c.hear.kind === 'accident') return hearingScriptAccident(c, key);   // after an accident investigation (investigation.ts)
  if (c.hear && c.hear.kind === 'staff') return hearingScriptStaff(c, key);   // a case you brought against your staff
  if (c.hear && c.hear.kind === 'perjury') return hearingScriptPerjury(c, key);   // your own trial, for lying in one
  const h = c.hear, f: HearFacts = h.facts, co = company(c.companyId), me: any = myPilot();
  const you = me ? me.name : 'the accountable manager', court = c.court.replace(/^the /, 'The ');
  const pct = (x: number) => Math.round(x * 100) + '%', when = (k: string) => { const s = c.stages.filter((x: any) => x.key === k)[0]; return s ? dateStr(new Date(s.at)) : 'the next sitting'; };
  const why = hearNeglect(f), dead = f.dead || (c.fatal ? 1 : 0);
  const L: HearLine[] = [];
  const nextKey = key === 'hear1' ? 'hear2' : key === 'hear2' ? 'hear3' : 'verdict';
  if (key === 'hear1') {
    L.push({ who: 'clerk', text: `All rise. ${court} is now in session. The case of the prosecution against ${co.name} and its accountable manager, ${you}.` });
    L.push({ who: 'judge', text: `Please be seated. This court will hear the charge of ${c.charge.toLowerCase()}. ${you}, you appear for the airline as its accountable manager. You will be asked questions. I remind you that the court has the airline's records before it.` });
    L.push({ who: 'prosecutor', text: `${c.summary} ${dead ? `${dead} ${dead === 1 ? 'person' : 'people'} lost their lives${f.reg ? ` on board ${f.reg}` : ''}.` : ''} The prosecution will show that this was not bad luck, but the result of decisions made by the airline.` });
    L.push({ who: 'prosecutor', text: 'Exhibit one: the final report of the accident investigation board.', ex: { title: 'Exhibit 1 · Accident investigation report', rows: [['Aircraft', `${f.reg} · ${f.model}`], ['Flight', f.from ? `${f.from} to ${f.to}` : f.to], ['On board', f.pax ? `${f.pax} passengers and crew` : 'Passengers and crew'], ['Fatalities', String(dead || 'None')], ['Finding', why.length ? why[0].charAt(0).toUpperCase() + why[0].slice(1) : 'Maintenance shortcomings']], note: (c.rec || []).length ? 'Recommendations: ' + c.rec.join('; ') : '' } });
    L.push({ who: 'prosecutor', text: `Exhibit two: the airline's maintenance records for ${f.reg}.`, ex: { title: `Exhibit 2 · Maintenance records, ${f.reg}`, rows: [['Open defects when it flew', f.open ? `${f.open}: ${f.openTitles.join(', ')}` : 'None'], ['Condition', `${f.cond}%`], ['Status', f.cond < 35 ? 'Below the safe limit' : 'Within limits']] } });
    const tq = f.open > 0 || f.cond < 35;
    L.push({ who: 'judge', text: '', q: { id: 'defects', asker: 'judge', truth: tq, text: `${you}, did you know that ${f.reg} ${tq ? (f.open ? `had ${f.open} unrepaired ${f.open === 1 ? 'defect' : 'defects'}` : 'was in poor condition') : 'had any problems'} when it was sent on that flight?`,
      opts: tq ? [{ t: `Yes. There were known problems with ${f.reg} that should have been fixed before it flew. That is on us.`, kind: 'honest' }, { t: 'Those decisions are made by our maintenance department, not by me personally.', kind: 'deflect' }, { t: `No. ${f.reg} had no known problems.`, kind: 'lie' }]
        : [{ t: `${f.reg} had no open defects. Its maintenance was up to date, as the records show.`, kind: 'honest' }, { t: 'I would have to check with our maintenance department.', kind: 'deflect' }],
      after: { honest: tq ? 'Thank you for being frank. The court notes it.' : 'The records agree with you. The court notes it.', deflect: `As the accountable manager, it is your responsibility. The court will draw its own conclusions.`, lie: `The records show otherwise. Exhibit two lists ${f.open || 'the'} open ${f.open === 1 ? 'defect' : 'defects'}. The court notes that your answer was not true.` } } });
    L.push({ who: 'prosecutor', text: 'Exhibit three: the maintenance department.', ex: { title: 'Exhibit 3 · Maintenance department', rows: [['Mechanics', `${f.mechs} for ${f.fleet} aircraft (${f.need} needed)`], ['Staffing', pct(f.coverage)], ['Qualifications', f.skill ? `${(f.skill * 5).toFixed(1)} of 5` : 'No mechanics'], ['Pay', `${pct(f.payRatio)} of the going rate`]] } });
    const tp = f.payRatio < 0.9;
    L.push({ who: 'prosecutor', text: '', q: { id: 'pay', asker: 'prosecutor', truth: tp, text: `Your mechanics were paid ${pct(f.payRatio)} of the going rate. Did the airline save money on maintenance?`,
      opts: tp ? [{ t: 'Yes. We paid them less than we should have, and I accept that it affected their work.', kind: 'honest' }, { t: 'Pay is set by the market and by our budget, like at any airline.', kind: 'deflect' }, { t: 'No, our mechanics are paid well above the market.', kind: 'lie' }]
        : [{ t: 'No. Our mechanics are paid at or above the going rate, as the payroll shows.', kind: 'honest' }, { t: 'Pay is set by the market and by our budget, like at any airline.', kind: 'deflect' }],
      after: { honest: tp ? 'No further questions on pay.' : 'The payroll confirms it. No further questions.', deflect: 'That is not an answer to my question.', lie: 'Exhibit three shows the payroll. The figures say otherwise.' } } });
    const ts = f.coverage < 0.8 || (!!f.skill && f.skill < 0.65);
    L.push({ who: 'judge', text: '', q: { id: 'staff', asker: 'judge', truth: ts, text: `You had ${f.mechs} ${f.mechs === 1 ? 'mechanic' : 'mechanics'} for ${f.fleet} aircraft. Were there enough of them, rested and qualified for the work?`,
      opts: ts ? [{ t: 'No. There were too few of them, they worked long, tiring hours, and some were not qualified enough for what they did.', kind: 'honest' }, { t: 'Staffing is a challenge across the whole industry.', kind: 'deflect' }, { t: 'Yes, we were fully staffed with well qualified, rested people.', kind: 'lie' }]
        : [{ t: 'Yes. We had the mechanics the fleet needs, and they were qualified for their work.', kind: 'honest' }, { t: 'Staffing is a challenge across the whole industry.', kind: 'deflect' }],
      after: { honest: 'Thank you.', deflect: 'The court asked about your airline, not the industry.', lie: 'Exhibit three shows otherwise. The court notes it.' } } });
    L.push({ who: 'judge', text: `That concludes today's hearing. The court will hear the witnesses on ${when(nextKey)}. The court is adjourned.` });
  } else if (key === 'hear2') {
    const mechs: any[] = staffOf(c.companyId, 'mech'), chief: any = mechs.slice().sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0))[0];
    const chiefName = chief ? chief.name : makePerson('chief-' + c.id, 'mech', c.companyId, co.hub).name;
    L.push({ who: 'clerk', text: `All rise. The court is in session. The case against ${co.name} continues.` });
    L.push({ who: 'judge', text: `Please be seated. Today the court hears the witnesses. The prosecution calls the airline's chief mechanic, ${chiefName}.` });
    L.push({ who: 'witness', text: why.length ? `We told management more than once that we were stretched. ${why.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('. ')}. We did what we could, but some work was signed off in a hurry. I think about that every day.` : `We followed the maintenance programme to the letter. The aircraft was signed off properly. I have nothing to hide, and neither does the airline.`, mood: why.length ? 'sorry' : '' });
    const tw = !!f.warned;
    L.push({ who: 'prosecutor', text: '', q: { id: 'warned', asker: 'prosecutor', truth: tw, text: `${you}, did anyone in your company warn you about safety before the accident?`,
      opts: tw ? [{ t: 'Yes. A member of staff warned me, and I did not act on it as I should have.', kind: 'honest' }, { t: 'We receive a lot of feedback from staff. I can\'t recall every message.', kind: 'deflect' }, { t: 'No one ever raised a safety concern with me.', kind: 'lie' }]
        : [{ t: 'No. No one raised a safety concern with me before the accident.', kind: 'honest' }, { t: 'We receive a lot of feedback from staff. I can\'t recall every message.', kind: 'deflect' }],
      after: { honest: tw ? 'Thank you. No further questions.' : 'No further questions.', deflect: 'Then the court will rely on the records.', lie: `The court has heard otherwise: ${f.warned}.` } } });
    if (f.pax > dead) L.push({ who: 'survivor', text: `I was in row ${8 + Math.floor(Math.random() * 14)}. I remember the noise, and then the smoke. The cabin crew got us out. They were so brave. Some of the people around me never got out. I still can't sleep through a night.`, mood: 'sorry' });
    if (dead) L.push({ who: 'relative', text: `My ${['husband', 'wife', 'daughter', 'son', 'father', 'mother'][Math.floor(Math.random() * 6)]} was on that flight. We trusted the airline to bring them home. All we want is the truth, and that it never happens to another family.`, mood: 'sorry' });
    const acted = !!(c.ch && c.ch.acted), cost = courtActCost(c);
    L.push({ who: 'judge', text: '', q: { id: 'changed', asker: 'judge', truth: !acted, text: `${you}, what has the airline changed since the accident?`,
      opts: acted ? [{ t: 'We have acted on every recommendation of the investigators, and we report to the authority on it.', kind: 'honest' }, { t: 'We are reviewing our procedures.', kind: 'deflect' }]
        : [{ t: `We will act on every recommendation of the investigators, starting today (${money(cost)}).`, kind: 'act' }, { t: 'Not enough yet. I accept that.', kind: 'honest' }, { t: 'We are reviewing our procedures.', kind: 'deflect' }, { t: 'We have already put every recommendation in place.', kind: 'lie' }],
      after: { honest: 'The court notes it.', act: 'The court notes the airline\'s commitment.', deflect: 'That is vague. The court notes it.', lie: 'The authority has told the court that none of the recommendations has been put in place. Your answer was not true.' } } });
    L.push({ who: 'judge', text: `Thank you to the witnesses. The court will hear the closing words on ${when(nextKey)}. The court is adjourned.` });
  } else if (key === 'hear3') {
    L.push({ who: 'clerk', text: 'All rise. The court is in session.' });
    L.push({ who: 'judge', text: 'Please be seated. Before the closing speeches, counsel for the families has asked to address the court.' });
    if (!(c.ch && c.ch.settled)) {
      const cost = courtSettleCost(c);
      L.push({ who: 'famlawyer', text: '', q: { id: 'settle', asker: 'prosecutor', truth: true, decision: true, text: `The families are prepared to settle their claims against the airline now. The airline's share, after insurance, would be ${money(cost)}. If the airline refuses, the families will sue, and the court may award more.`,
        opts: [{ t: `Accept the settlement (${money(cost)})`, kind: 'settle' }, { t: 'Decline: let the court decide the claims', kind: 'nosettle' }],
        after: { settle: 'The court notes that the airline has settled with the families.', nosettle: 'Very well. The claims will be decided separately.' } } });
    }
    L.push({ who: 'lawyer', text: '', q: { id: 'plea', asker: 'judge', truth: true, decision: true, text: `${you}, before the closing speeches: how does the airline plead? A guilty plea means a certain conviction, but the sentence is usually about a third lighter.`,
      opts: [{ t: 'Plead guilty', kind: 'plea' }, { t: 'Maintain not guilty: let the court weigh the evidence', kind: 'noplea' }],
      after: { plea: 'The court records the airline\'s guilty plea.', noplea: 'The court records the airline\'s plea of not guilty.' } } });
    L.push({ who: 'prosecutor', text: why.length ? `The evidence is clear. ${why[0].charAt(0).toUpperCase() + why[0].slice(1)}. The airline knew, or should have known. ${dead ? 'People died because of it. ' : ''}The prosecution asks the court to find the airline guilty.` : `The accident happened on the airline's watch. The prosecution asks the court to weigh whether the airline did everything it should have.` });
    L.push({ who: 'lawyer', text: `${h.honest > h.lies ? 'My client has answered every question openly. ' : ''}${c.ch && c.ch.acted ? 'The airline has acted on every recommendation of the investigators. ' : ''}${c.ch && c.ch.settled ? 'It has settled with the families. ' : ''}We ask the court to take all of this into account.` });
    L.push({ who: 'judge', text: '', q: { id: 'last', asker: 'judge', truth: true, decision: false, text: `${you}, you have the last word.`,
      opts: [{ t: 'I am deeply sorry. We failed the people who trusted us, and their families. I will make sure it never happens again.', kind: 'sorry' }, { t: 'This airline has a good safety record, and I stand by the people who work for it.', kind: 'defend' }, { t: 'I have nothing to add.', kind: 'silent' }],
      after: { sorry: 'Thank you.', defend: 'Thank you.', silent: 'Very well.' } } });
    L.push({ who: 'judge', text: `The court will consider its verdict and give it on ${when('verdict')}. The court is adjourned.` });
  } else if (key === 'hearA') {
    L.push({ who: 'clerk', text: `All rise. The appeal court is in session. The appeal of ${co.name}.` });
    L.push({ who: 'judge', text: 'Please be seated. This court will hear the airline\'s appeal against the verdict and the sentence.' });
    L.push({ who: 'lawyer', text: `The district court did not give enough weight to ${c.ch && c.ch.acted ? 'what the airline has done since the accident' : 'the airline\'s record'}. We ask this court to look at the case again.` });
    L.push({ who: 'prosecutor', text: 'The verdict was sound. The prosecution asks the court to uphold it.' });
    L.push({ who: 'judge', text: '', q: { id: 'appeal', asker: 'judge', truth: true, text: `${you}, why should this court reach a different conclusion?`,
      opts: [{ t: c.ch && c.ch.acted ? 'Because we have changed: every recommendation is in place, and we report on it to the authority.' : 'Because we have learned, and we are putting things right.', kind: c.ch && c.ch.acted ? 'honest' : 'deflect' }, { t: 'Because the first court got it wrong. We did nothing wrong.', kind: 'defend' }, { t: 'I leave it to my lawyer.', kind: 'silent' }],
      after: { honest: 'The court notes it.', deflect: 'The court notes it.', defend: 'The court notes it.', silent: 'Very well.' } } });
    L.push({ who: 'judge', text: 'The court will give its decision in writing. The court is adjourned.' });
  } else if (key === 'verdict') {
    const g = c.status === 'guilty';
    L.push({ who: 'clerk', text: 'All rise.' });
    L.push({ who: 'judge', text: `Please be seated. In the case of the prosecution against ${co.name}, the court has reached its verdict.` });
    L.push({ who: 'judge', text: g ? `The court finds the airline guilty of ${c.charge.toLowerCase()}. The sentence is ${c.sentence}.${h.lies ? ' In reaching it, the court has taken into account that some of the airline\'s answers were not true.' : h.honest ? ' The court has taken into account that the airline answered openly.' : ''}` : 'The court finds the airline not guilty.', mood: g ? '' : '' });
    L.push({ who: 'relative', text: g ? 'It doesn\'t bring them back. But at least the truth has been said out loud.' : 'How can that be? Someone has to answer for this.', mood: g ? 'sorry' : 'angry' });
    L.push({ who: 'judge', text: 'This case is closed. The court is adjourned.' });
  }
  return L;
}

/** The papers after a day in court. */
function newsHearing(c: any, st: any) {
  if (c.hear && c.hear.kind === 'staff') { newsStaffCase(c, st.key); return; }
  if (c.hear && c.hear.kind === 'perjury') return;   // in the papers when it came out
  const co = company(c.companyId), h = c.hear, base = apt(co.hub);
  const day = HEAR_TITLES[st.key] || 'Hearing';
  const headline = st.held === 'absent' ? `Empty chair: ${co.name} boss fails to appear in court` : st.held === 'standin' ? `${co.name} sends board member to face court` : h.lies ? `${co.name} caught out in court over safety records` : h.honest >= 2 ? `${co.name} boss admits failings in court` : `${co.name} trial: ${day.toLowerCase()}`;
  newsPublish({ paper: newsPaper(c.country), section: 'Courts', place: base ? base.city : '', headline, standfirst: st.text, body: [c.summary, hearingDaySummary(c, st.key), `The case continues at ${c.court}.`],
    quote: [h.lies ? 'The airline\'s answers did not match its own records. The court noticed, and so did the families.' : 'The families sat through every minute. They want answers, and today they got some.', 'A court reporter'],
    art: { kind: 'court' }, companyId: c.companyId } as any);
}

/** After the verdict: an audit, closer watch by the authority and higher insurance for a while. */
function hearingAftermath(c: any, guilty: boolean) {
  if (c.hear && c.hear.kind === 'staff') { courtStaffAftermath(c, guilty); return; }
  if (c.hear && c.hear.kind === 'perjury') { c.hear.verdictReady = true; try { toast('The verdict in your perjury trial is in', 'warn', { label: 'Hear it in court', act: 'court-verdict', data: c.id }); } catch (e) { /* not ready */ } return; }
  if (!c.hear || c.role !== 'airline') return;
  const co: any = company(c.companyId); if (!co) return;
  if (guilty) {
    payTxn(co.id, 'Mandatory safety audit ordered by the court', -350000, 'fees', [['Independent auditors, records and inspections', -350000]]);
    co.safetyWatch = Date.now() + 30 * 864e5;
    State.notices.unshift({ id: uid(), kind: 'authority' as any, title: 'Under closer watch', body: 'After the verdict, the court ordered a safety audit. For the next 30 days the authority will inspect your aircraft more often, and your insurer has raised the premium.', time: 'Now', at: Date.now(), read: false, ref: c.id } as any);
  }
  c.hear.verdictReady = true;
  try { toast('The verdict is in', 'warn', { label: 'Hear it in court', act: 'court-verdict', data: c.id }); } catch (e) { /* not ready */ }
}
ACTIONS['court-verdict'] = el => { const t = el.closest && el.closest('.toast'); if (t) t.remove(); const c = hearCase(el.getAttribute('data-id')); if (c && c.hear) { closeAll(); CourtRoom.open(c, { key: 'verdict', title: 'The verdict' }); } };
/** Each day under closer watch: the higher premium, and now and then a ramp inspection. */
function hearingWatchDaily() {
  const S: any = State, day = new Date().toDateString(); if (S.watchDay === day) return; S.watchDay = day;
  for (const co of State.companies as any[]) {
    if (!co.safetyWatch || co.safetyWatch < Date.now()) continue;
    const n = fleetOf(co.id).length; if (!n) continue;
    payTxn(co.id, 'Insurance: higher premium after the court case', -n * 1500, 'fees', [[`${n} aircraft`, -n * 1500]]);
    if (Math.random() < 0.3) { const a = fleetOf(co.id)[Math.floor(Math.random() * n)]; State.notices.unshift({ id: uid(), kind: 'authority' as any, title: `Ramp inspection: ${a.reg}`, body: `Inspectors from the authority checked ${a.reg} at ${a.base || co.hub}. ${a.condition < 50 ? 'They found items to fix before its next flight.' : 'Everything was in order.'}`, time: 'Now', at: Date.now(), read: false } as any); if (a.condition < 50) State.issues.unshift({ id: uid(), reg: a.reg, title: 'Ramp inspection findings', detail: 'Items found by the authority\'s inspectors.', source: 'Ramp inspection', severity: 'grounding', cost: 18000, days: 1, status: 'open', date: dateStr(new Date()).slice(0, 10) } as any); }
  }
}

/** The price of a board member standing in for you for one court day: a large sum, more for a bigger airline. */
function standInCost(c: any): number { return Math.round(clamp(150000 + fleetOf(c.companyId).length * 30000, 150000, 1200000) / 10000) * 10000; }
function standInPick(c: any): any {
  const p: any = makePerson('board-' + c.id, 'captain', c.companyId, company(c.companyId).hub);
  const r = seeded('board-skill-' + c.id)(); return { name: p.name, sex: p.sex, look: p.look, skill: Math.round((0.45 + r * 0.45) * 100) / 100 };
}
function standInHire(c: any) {
  if (c.hear.standIn) return;
  const cost = standInCost(c), s = standInPick(c);
  payTxn(c.companyId, `Board member stands in for you in court: ${s.name}`, -cost, 'fees', [[c.court, -cost]]);
  c.hear.standIn = Object.assign(s, { cost });
  State.notices.unshift({ id: uid(), kind: 'authority' as any, title: `${s.name} will stand in for you in court`, body: `${s.name}, from the board, attends the next court day for the airline (${s.skill > 0.75 ? 'experienced and calm in court' : s.skill > 0.6 ? 'capable' : 'not much experience in court'}). The big decisions still come to you.`, time: 'Now', at: Date.now(), read: false, ref: c.id } as any);
  Store.save();
}

/* ---------- the case file: go to court, a stand-in, decisions, a memorial ---------- */
function hearingCaseHtml(c: any): string {
  if (!c.hear) return '';
  const h = c.hear, wait = hearingWaiting(c);
  let x = '';
  if (wait && !h.standIn) x += `<div class="cc-row hear-now"><span><b>Court is in session</b><small>${esc(wait.title)}. ${wait.deadline ? `It goes ahead without you after ${esc(dateStr(new Date(wait.deadline)).slice(11))}.` : ''}</small></span><button class="btn primary sm" data-act="court-attend" data-id="${esc(c.id)}">Go to court</button></div>`;
  if (h.verdictReady && !h.verdictSeen) x += `<div class="cc-row hear-now"><span><b>The verdict</b><small>Hear it read out in court</small></span><button class="btn primary sm" data-act="court-attend" data-id="${esc(c.id)}" data-k="verdict">Go to court</button></div>`;
  const nextDay = c.stages.filter((s: any) => /^hear[0-9A]$/.test(s.key) && !s.done)[0];
  if ((c.status === 'open' || c.appealing) && nextDay && !h.standIn) x += `<div class="cc-row"><span><b>Stand-in</b><small>A board member attends the next court day (${esc(nextDay.title.toLowerCase())}) for you. You decide again for each day. The big decisions still come to you.${h.lastStandIn ? ` Last time: ${esc(h.lastStandIn.name)}.` : ''}</small></span><button class="btn ghost sm" data-act="court-standin" data-id="${esc(c.id)}">Send a board member, ${money(standInCost(c))}</button></div>`;
  if (h.standIn) x += `<div class="cc-row"><span><b>Stand-in</b><small>${esc(h.standIn.name)} attends the next court day${nextDay ? ` (${esc(nextDay.title.toLowerCase())})` : ''} for the airline. After that, you decide again.</small></span><button class="btn ghost sm" data-act="court-standin-off" data-id="${esc(c.id)}">I'll go myself</button></div>`;
  for (const k of h.pending || []) {
    if (k === 'settle' && !(c.ch && c.ch.settled) && c.status === 'open') x += `<div class="cc-row hear-now"><span><b>Your decision: the families' settlement</b><small>Your share after insurance: ${money(courtSettleCost(c))}</small></span><span class="btn-row"><button class="btn primary sm" data-act="hear-pend" data-id="${esc(c.id)}" data-k="settle" data-v="1">Accept</button><button class="btn ghost sm" data-act="hear-pend" data-id="${esc(c.id)}" data-k="settle" data-v="0">Decline</button></span></div>`;
    if (k === 'plea' && c.status === 'open') x += `<div class="cc-row hear-now"><span><b>Your decision: the plea</b><small>Guilty: a certain conviction, a lighter sentence</small></span><span class="btn-row"><button class="btn ghost sm" data-act="hear-pend" data-id="${esc(c.id)}" data-k="plea" data-v="1">Guilty</button><button class="btn primary sm" data-act="hear-pend" data-id="${esc(c.id)}" data-k="plea" data-v="0">Not guilty</button></span></div>`;
  }
  if (c.status !== 'open' && c.fatal && !h.memorial) x += `<div class="cc-row"><span><b>A memorial</b><small>A memorial for the victims and a fund for their families</small></span><button class="btn ghost sm" data-act="hear-memorial" data-id="${esc(c.id)}">Fund it, ${money(300000)}</button></div>`;
  if (h.rating) x += `<div class="cc-row"><span><b>Your company rating in court</b><small>${h.honest} honest ${h.honest === 1 ? 'answer' : 'answers'}${h.lies ? `, ${h.lies} contradicted by the records` : ''}${h.absent ? `, ${h.absent} ${h.absent === 1 ? 'day' : 'days'} missed` : ''}</small></span><b class="${h.rating >= 0 ? 'green' : 'red'}">${h.rating > 0 ? '+' : ''}${h.rating}</b></div>`;
  return x ? `<div class="cc-box"><b class="cc-h">In court</b>${x}</div>` : '';
}
function hearCase(id: string): any { return ((State as any).cases || []).filter((x: any) => x.id === id)[0]; }
ACTIONS['court-attend'] = el => {
  const t = el.closest && el.closest('.toast'); if (t) t.remove();
  const c = hearCase(el.getAttribute('data-id')); if (!c || !c.hear) return;
  const k = el.getAttribute('data-k'), st = k === 'verdict' ? { key: 'verdict', title: 'The verdict' } : hearingWaiting(c);
  if (!st) { courtPopup(c.id); return; }
  closeAll(); CourtRoom.open(c, st);
};
ACTIONS['court-standin'] = el => {
  const c = hearCase(el.getAttribute('data-id')); if (!c) return;
  standInHire(c); const w = hearingWaiting(c); if (w) hearingAuto(c, w, 'standin');
  Sound.tick(); courtPopup(c.id);
};
/** Changed your mind before the day: you go yourself, and the board member's fee is paid back. */
ACTIONS['court-standin-off'] = el => {
  const c = hearCase(el.getAttribute('data-id')); if (!c || !c.hear || !c.hear.standIn) return;
  const s = c.hear.standIn, back = s.cost || 0; c.hear.standIn = null;
  if (back) payTxn(c.companyId, `Stand-in cancelled, fee returned: ${s.name}`, back, 'fees', [[c.court, back]]);
  Store.save(); Sound.tick(); courtPopup(c.id);
};
ACTIONS['hear-pend'] = el => {
  const c = hearCase(el.getAttribute('data-id')); if (!c) return;
  const k = el.getAttribute('data-k'), v = el.getAttribute('data-v') === '1';
  c.hear.pending = (c.hear.pending || []).filter((x: string) => x !== k);
  hearDecide(c, k, v);
  Store.save(); Sound.tick(); courtPopup(c.id);
};
ACTIONS['hear-memorial'] = el => {
  const c = hearCase(el.getAttribute('data-id')); if (!c) return;
  payTxn(c.companyId, 'A memorial for the victims and a fund for their families', -300000, 'fees', [['Memorial and family fund', -300000]]);
  c.hear.memorial = true; hearRate(c, 3, 'A memorial for the victims');
  Store.save(); Sound.tick(); toast('The memorial is funded. The families have been told.', 'ok'); courtPopup(c.id);
};
/** The settlement and the plea, wherever you decide them. */
function hearDecide(c: any, k: string, yes: boolean) {
  if (k === 'settle') { if (yes && !c.ch.settled) { const cost = courtSettleCost(c); payTxn(c.companyId, `Settlement with the families: ${c.offence}`, -cost, 'fees', [['Your share after insurance', -cost]]); c.ch.settled = true; } hearRate(c, yes ? 1.5 : -1, yes ? 'Settled with the families' : 'Refused the families\' settlement'); }
  if (k === 'plea') c.ch.plea = yes;
  if (k === 'act' && !c.ch.acted) { const cost = courtActCost(c); payTxn(c.companyId, 'Acting on the accident investigators\' recommendations', -cost, 'fees', (c.rec || []).map((x: string) => [x, -Math.round(cost / 3)])); c.ch.acted = true; }
}

/** The day in court is over (you stayed to the end). */
function hearingFinish(c: any, st: any) {
  if (st.key === 'verdict') { c.hear.verdictSeen = true; Store.save(); return; }
  const real = c.stages.filter((s: any) => s.key === st.key)[0] || st;
  if (real.done) return;
  real.done = true; real.held = 'you'; real.text = hearingDaySummary(c, st.key);
  hearingAfterDay(c, real);
}
