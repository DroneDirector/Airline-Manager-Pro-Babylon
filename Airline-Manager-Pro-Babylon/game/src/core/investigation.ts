// Accident investigations. When one of your aircraft crashes (a flight you flew and registered, or one flown by your
// hired crew), the country's accident investigation board opens an investigation:
//  - The preliminary report comes after one, two or three days, or within minutes (Settings → Staff → Court). Until
//    you have opened it, it stays in the notification bell and you are reminded of it again and again.
//  - Nothing in it is chance. The investigators follow the chain of events back from the crash: the aircraft's
//    condition and its unrepaired defects, the mechanics who looked after it (how many for the fleet, how qualified,
//    how they are paid, how they feel at work, quarrels between them), the pilot (their record, warnings, mood, and
//    how the aircraft was flown), and the airline above them (staffing, pay, warnings you were given). The cause is
//    either the aircraft or the pilot; working conditions are found behind either when they played a part.
//  - Eyewitnesses: near an airport someone always saw it (the tower, ground crew, people in the terminal); far from
//    one, maybe a farmer or a fisherman, maybe no one. Survivors are heard when there are any.
//  - You sign the report, or disagree and take it to court. When the airline, a mechanic or a pilot is found at fault
//    (or you disagree), the authority takes the case to court. You, the accountable manager, are always called; the
//    mechanic or pilot at fault is there too. Day one: the witnesses and the investigator are heard and you answer
//    the judge and the prosecutor. Only then comes the preliminary hearing, where the court decides whether there is
//    a case to answer. Then the trial: the person at fault on the stand, more questions, the plea and your last word,
//    and the verdict. The more serious the accident, the more you are asked, and the harder; if people died, it is
//    relentless. Every answer is checked against the records and moves your company rating, and the verdict follows.
//  - You are reminded in the bell until you go to court: the case waits for you.

interface InvFactor { key: string; side: 'aircraft' | 'pilot' | 'org'; w: number; text: string }
interface InvWitness { key: string; name: string; sex: 'm' | 'f'; title: string; saw: boolean; text: string }
interface Investigation {
  id: string; cid: string; reg: string; typeId: string; model: string; from: string; to: string; at: number; place: string; near: boolean;
  pax: number; dead: number; injured: number; level: 'minor' | 'substantial' | 'destroyed'; parts: string[]; you: boolean; notes: string;
  pilotId: string; pilotName: string; pilotDied: boolean; mechId: string; mechName: string;
  factors: InvFactor[]; cause: 'aircraft' | 'pilot' | 'none'; org: boolean; score: { aircraft: number; pilot: number; org: number }; chain: string[];
  witnesses: InvWitness[]; authority: string; country: string;
  readyAt: number; ready: boolean; seen: boolean; nagAt: number; choice?: 'signed' | 'contested'; decideAt?: number; caseId?: string; closed?: boolean; facts?: any;
}

/* ---------- timing (Settings → Staff → Court) ---------- */
const INV_TIMING_NAMES: [string, string][] = [['min', 'Within minutes'], ['1', 'After 1 day'], ['2', 'After 2 days'], ['3', 'After 3 days']];
function invTiming(): string { const v = String((State.settings as any).invTiming || '1'); return /^(min|1|2|3)$/.test(v) ? v : '1'; }
function invQuick(): boolean { return invTiming() === 'min'; }
/** When the preliminary report comes. */
function invReportDelay(): number { return invQuick() ? 5 * 60e3 : (+invTiming()) * 864e5; }
/** Between the report and the court's summons, and between the days in court. */
function invGap(): number { return invQuick() ? 6 * 60e3 : 20 * 3600e3; }
/** How often you are reminded of an unread report or a court that waits for you. */
function invNag(): number { return invQuick() ? 4 * 60e3 : 2 * 3600e3; }

function invList(): Investigation[] { const S: any = State; return S.investigations = S.investigations || []; }
function invById(id: string): Investigation { return invList().filter(x => x.id === id)[0] || null; }
function _invRng(seed: string) { let s = 0; for (const ch of seed) s = (s * 31 + ch.charCodeAt(0)) >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

/* ---------- opening an investigation ---------- */
/** A crash of one of your aircraft: the investigation starts (once per crash). */
function investigationOpen(o: { key: string; cid: string; reg: string; typeId: string; from: string; to: string; pax: number; dead: number; injured: number;
  level: 'minor' | 'substantial' | 'destroyed'; parts?: string[]; you: boolean; pilotId?: string; notes?: string; fpm?: number; g?: number; cond?: number; issues?: string[] }) {
  if (invList().some(x => x.id === 'inv-' + o.key)) return;
  const co: any = company(o.cid); if (!co) return;
  const A = apt(o.to) || apt(co.hub), country = A ? A.country : '', t = acType(o.typeId);
  const authority = (typeof AUTHORITIES !== 'undefined' && AUTHORITIES[country]) || 'the national civil aviation authority';
  const near = !/terrain|cfit|cruise|en route|mountain/i.test(o.notes || '');
  const now = Date.now();
  const inv: Investigation = {
    id: 'inv-' + o.key, cid: o.cid, reg: o.reg, typeId: o.typeId, model: t ? t.model : 'aircraft', from: o.from, to: o.to, at: now,
    place: near ? `on arrival at ${A ? A.name : o.to}` : `on the way to ${A ? A.name : o.to}, away from any airport`, near,
    pax: o.pax || 0, dead: o.dead || 0, injured: o.injured || 0, level: o.level, parts: o.parts || [], you: o.you, notes: o.notes || '',
    pilotId: o.pilotId || '', pilotName: '', pilotDied: false, mechId: '', mechName: '',
    factors: [], cause: 'none', org: false, score: { aircraft: 0, pilot: 0, org: 0 }, chain: [], witnesses: [], authority, country,
    readyAt: now + invReportDelay(), ready: false, seen: false, nagAt: 0,
  };
  invAnalyse(inv, o);
  invWitnesses(inv);
  invList().unshift(inv);
  State.notices.unshift({ id: uid(), kind: 'authority' as any, title: `Accident investigation opened: ${o.reg}`, body: `${authority.charAt(0).toUpperCase() + authority.slice(1)} has opened an investigation into the accident of ${o.reg} ${inv.place}. The investigators are securing the wreckage and the flight recorders, and interviewing the crew, the mechanics and any witnesses. Their preliminary report comes ${invQuick() ? 'within minutes' : `in ${invTiming()} ${invTiming() === '1' ? 'day' : 'days'}`}.`, time: 'Now', at: now, read: false, ref: inv.id } as any);
  Store.save();
}

/** Follow the chain back from the crash: what in the airline led to it. Only real factors count. */
function invAnalyse(inv: Investigation, o: any) {
  const cid = inv.cid, a: any = plane(inv.reg), F: InvFactor[] = [];
  const add = (key: string, side: 'aircraft' | 'pilot' | 'org', w: number, text: string) => { if (w > 0.04) F.push({ key, side, w: Math.round(w * 100) / 100, text }); };
  // the aircraft and its maintenance
  const cond = o.cond != null ? o.cond : a ? a.condition : 70, issues: string[] = (o.issues || (State.issues as any[]).filter(i => i.reg === inv.reg && i.status === 'open').map(i => i.title)).filter((x: string) => !/rash/.test(x));
  if (cond < 45) add('cond', 'aircraft', (45 - cond) / 30, `${inv.reg} was in poor condition (${Math.round(cond)}%)`);
  if (issues.length) add('defects', 'aircraft', issues.length * 0.3, `${issues.length} known ${issues.length === 1 ? 'defect was' : 'defects were'} left unrepaired (${issues.slice(0, 3).join(', ').toLowerCase()})`);
  const mq = maintQuality(cid), mechs: any[] = staffOf(cid, 'mech');
  if (mq.coverage < 0.85) add('mechs', 'aircraft', (0.85 - mq.coverage) * 1.6, `there were too few mechanics for the fleet (${mechs.length}), so they worked long, tiring shifts`);
  if (mechs.length && mq.skill < 0.65) add('skill', 'aircraft', (0.65 - mq.skill) * 1.8, 'mechanics did work they were not well enough trained for');
  let mpay = 1; try { mpay = groupPayRatio(cid, 'mech').ratio || 1; } catch (e) { /* no pay scale */ }
  if (mpay < 0.95) add('mpay', 'aircraft', (0.95 - mpay) * 2.2, `mechanics were paid ${Math.round(mpay * 100)}% of the going rate, and some had second jobs`);
  const mmood = mechs.length ? mechs.reduce((s, m) => s + (typeof m.mood === 'number' ? m.mood : 60), 0) / mechs.length : 60;
  if (mmood < 50) add('mmood', 'aircraft', (50 - mmood) / 45, 'the mechanics were unhappy at work, and it showed in how carefully they worked');
  const quarrels = ((State as any).incidents || []).filter((i: any) => { const p: any = staffById(i.staffId); return p && p.companyId === cid && personRole(p) === 'mech' && /argument|colleague|quarrel|conflict|shout/i.test(i.title); }).length;
  if (quarrels) add('quarrel', 'aircraft', quarrels * 0.2, `there ${quarrels === 1 ? 'was a quarrel' : `were ${quarrels} quarrels`} between mechanics, and work was handed over badly`);
  // the pilot
  const pil: any = inv.you ? myPilot() : inv.pilotId ? staffById(inv.pilotId) : null;
  inv.pilotName = pil ? pil.name : '';
  if (inv.you) {
    const fpm = Math.abs(o.fpm || 0), g = o.g || 0;
    if (fpm > 600) add('sink', 'pilot', (fpm - 600) / 900, `the aircraft touched down at ${num(fpm)} feet per minute${g ? ` and ${g.toFixed(1)} g` : ''}, far beyond what it is built for`);
    if (/stall|spin/i.test(inv.notes)) add('stall', 'pilot', 1.2, 'the aircraft was allowed to slow down until it stalled');
    if (/terrain|cfit/i.test(inv.notes)) add('cfit', 'pilot', 1.3, 'the aircraft was flown into the ground while under control');
    if (/water/i.test(inv.notes)) add('water', 'pilot', 0.9, 'the aircraft was put down on water');
  } else if (pil) {
    if ((pil.rating || 3.5) < 3.3) add('prating', 'pilot', (3.3 - (pil.rating || 3.5)) * 0.7, `${pil.name}'s training and check results were below the airline's standard`);
    if (pil.warnings) add('pwarn', 'pilot', pil.warnings * 0.3, `${pil.name} had ${pil.warnings} ${pil.warnings === 1 ? 'warning' : 'warnings'} on their record`);
    if (typeof pil.mood === 'number' && pil.mood < 45) add('pmood', 'pilot', (45 - pil.mood) / 50, `${pil.name} was worn out and unhappy at work`);
    const drink = ((State as any).incidents || []).some((i: any) => i.staffId === pil.id && /alcohol|drunk|breath/i.test(i.title));
    if (drink) add('drink', 'pilot', 0.9, `${pil.name} had been reported for alcohol before`);
  }
  // the airline above them: working conditions
  const S: any = State;
  if (S.whistle && S.whistle.cid === cid && (S.whistle.choice === 'ignore' || S.whistle.choice === 'fire')) add('warned', 'org', 0.6, `${S.whistle.name} warned you about safety, and nothing was done`);
  let ppay = 1; try { ppay = groupPayRatio(cid, 'pilots').ratio || 1; } catch (e) { /* none */ }
  if (ppay < 0.9) add('ppay', 'org', (0.9 - ppay) * 1.5, `pilots were paid ${Math.round(ppay * 100)}% of the going rate`);
  const crew = staffOf(cid, 'fa'), fl = fleetOf(cid).length || 1;
  if (crew.length < fl * 2) add('crew', 'org', Math.min(0.5, (fl * 2 - crew.length) / (fl * 6)), 'crews were short-staffed across the airline');
  F.sort((x, y) => y.w - x.w);
  const sum = (s: string) => F.filter(f => f.side === s).reduce((t, f) => t + f.w, 0);
  inv.score = { aircraft: Math.round(sum('aircraft') * 100) / 100, pilot: Math.round(sum('pilot') * 100) / 100, org: Math.round(sum('org') * 100) / 100 };
  inv.factors = F;
  inv.cause = inv.score.aircraft < 0.3 && inv.score.pilot < 0.3 ? 'none' : inv.score.aircraft >= inv.score.pilot ? 'aircraft' : 'pilot';
  // working conditions behind it: low pay, too few people, unhappy staff, ignored warnings
  inv.org = inv.score.org >= 0.3 || F.some(f => /mechs|mpay|mmood|quarrel|pmood/.test(f.key) && f.w >= 0.25);
  // who is looked at: the mechanic who looked after it (the least qualified at its base), or the pilot who survived
  if (inv.cause === 'aircraft' && mechs.length) {
    const base = a ? a.base : '', pool = mechs.filter(m => m.base === base).length ? mechs.filter(m => m.base === base) : mechs;
    const m = pool.slice().sort((x, y) => ((x.rating || 3) + (x.mood || 60) / 100) - ((y.rating || 3) + (y.mood || 60) / 100))[0];
    inv.mechId = m.id; inv.mechName = m.name;
  }
  const r = _invRng(inv.id);
  inv.pilotDied = !inv.you && inv.level === 'destroyed' && inv.dead > 0 && r() < Math.min(0.85, inv.dead / Math.max(1, inv.pax) + 0.2);
  // the chain of events, from the root to the crash
  const root = F.filter(f => f.side === 'org' || /mpay|mmood|quarrel|mechs|pmood|ppay/.test(f.key)).map(f => f.text);
  const mid = F.filter(f => /skill|defects|cond|prating|pwarn|drink/.test(f.key)).map(f => f.text);
  const last = inv.cause === 'aircraft'
    ? `${invPart(inv)} caused a failure in flight${inv.near ? ' on the approach' : ''}, and the crew could not save the aircraft`
    : inv.cause === 'pilot' ? (F.filter(f => f.side === 'pilot' && /sink|stall|cfit|water/.test(f.key)).map(f => f.text)[0] || 'the approach was flown outside the airline\'s limits and not abandoned in time')
    : 'no fault in the aircraft or its crew has been found so far';
  inv.chain = root.concat(mid).slice(0, 5).concat([last]);
}
/** The part that gave way, from what was damaged and what was left unrepaired. */
function invPart(inv: Investigation): string {
  const issue = (State.issues as any[]).filter(i => i.reg === inv.reg && i.status === 'open')[0];
  if (issue) return `the ${String(issue.title).replace(/^(a|an|the)\s+/i, '').toLowerCase()}, reported earlier and never repaired,`;
  const p = inv.parts.filter(x => /engine|gear|flap|fuel|control/i.test(x))[0];
  return p ? `a worn part in the ${p.toLowerCase()}` : 'a worn part that should have been replaced';
}

/** Who saw it: near an airport someone always did; far from one, maybe no one. Survivors when there are any. */
function invWitnesses(inv: Investigation) {
  const r = _invRng(inv.id + 'w'), co: any = company(inv.cid), W: InvWitness[] = [];
  const person = (k: string, title: string, sexP = 0.5) => { const sex: 'm' | 'f' = r() < sexP ? 'f' : 'm'; return { key: k, sex, title, name: makePerson(inv.id + k, 'fo' as any, '', co.hub, sex).name }; };
  const how = inv.cause === 'aircraft' ? [`I saw smoke, or something coming off it, before it came down. It didn't sound right either.`, `It wobbled, then dropped. It looked like something had broken on it.`]
    : inv.cause === 'pilot' ? [`It came in far too steep and far too fast. I remember thinking: they're not going to stop that in time.`, `It was all over the place on the approach, and it never went around.`]
    : [`It looked normal until the very last moment. Then it was down.`, `I couldn't tell you why. It just came down.`];
  if (inv.near) {
    W.push(Object.assign(person('ew0', 'Air traffic controller, eyewitness'), { saw: true, text: `I was working the tower. I cleared ${inv.reg} to land and watched it in. ${how[0]} I pressed the crash alarm straight away.` }));
    W.push(Object.assign(person('ew1', 'Airport firefighter, eyewitness', 0.3), { saw: true, text: `We were rolling within a minute. ${inv.level === 'destroyed' ? 'There was fire when we got there.' : 'The aircraft was badly damaged.'} ${how[1]}` }));
    if (r() < 0.6) W.push(Object.assign(person('ew2', 'Passenger waiting in the terminal, eyewitness'), { saw: true, text: `I was watching the aircraft from the window, waiting for my own flight. ${how[r() < 0.5 ? 0 : 1]}` }));
  } else if (r() < 0.4) {
    W.push(Object.assign(person('ew0', r() < 0.5 ? 'Farmer, eyewitness' : 'Fisherman, eyewitness', 0.35), { saw: true, text: `I heard it before I saw it. It was low, much too low. ${how[1]} I called the emergency number.` }));
  } else {
    W.push(Object.assign(person('ew0', 'Search and rescue officer'), { saw: false, text: `No one saw the accident. It was far from any town. The investigators rely on the flight recorders and the wreckage.` }));
  }
  if (inv.pax > inv.dead && inv.pax > 0) W.push(Object.assign(person('survivor', 'Surviving passenger, witness'), { saw: true, text: inv.cause === 'aircraft' ? `There was a bang, and the aircraft shook. The crew stayed calm and told us to brace. I'm alive because of them.` : `The approach felt wrong, much faster than usual. Then the impact. The cabin crew got us out.` }));
  inv.witnesses = W;
}

/* ---------- the clock: reports, reminders, the authority's decision ---------- */
function investigationsAdvance() {
  const now = Date.now(); let changed = false;
  for (const inv of invList()) {
    if (inv.closed) continue;
    if (!inv.ready && now >= inv.readyAt) { inv.ready = true; inv.nagAt = 0; changed = true; }
    // the report waits for you: reminded until you have opened it
    if (inv.ready && !inv.seen && now - (inv.nagAt || 0) >= invNag()) {
      const first = !inv.nagAt; inv.nagAt = now; changed = true;
      State.notices = State.notices.filter((n: any) => !(n.ref === inv.id && n.invNag));
      State.notices.unshift({ id: uid(), kind: 'authority' as any, title: `${first ? 'Preliminary accident report' : 'Reminder: the preliminary accident report'}: ${inv.reg}`, body: `The preliminary report on the accident of ${inv.reg} ${inv.place} is ready. Read it, then sign it or take it to court if you disagree.`, time: 'Now', at: now, read: false, ref: inv.id, invNag: true } as any);
      try { toast(`${first ? 'Preliminary accident report' : 'Reminder: unread accident report'}: ${inv.reg}`, 'warn', { label: 'Read it', act: 'inv-open', data: inv.id }); Sound.chime(); } catch (e) { /* not ready */ }
    }
    // after you signed or disagreed: the authority decides whether it goes to court
    if (inv.choice && !inv.caseId && inv.decideAt && now >= inv.decideAt) { invDecide(inv); changed = true; }
  }
  // a court that waits for you: reminded until you go in
  for (const c of ((State as any).cases || []) as any[]) {
    if (!c.hear || c.hear.kind !== 'accident' || c.status !== 'open') continue;
    const st = c.stages.filter((s: any) => /^hear/.test(s.key) && s.called && !s.done)[0]; if (!st) continue;
    if (now - (st.nagAt || st.called) >= invNag()) {
      st.nagAt = now; changed = true;
      State.notices.unshift({ id: uid(), kind: 'authority' as any, title: `Reminder: the court is waiting for you`, body: `${c.court.charAt(0).toUpperCase() + c.court.slice(1)} is sitting in the case about the accident of ${c.reg}. It waits for you, the accountable manager. Go to court.`, time: 'Now', at: now, read: false, ref: c.id } as any);
      try { toast('The court is waiting for you', 'warn', { label: 'Go to court', act: 'court-attend', data: c.id }); Sound.chime(); } catch (e) { /* not ready */ }
    }
  }
  if (changed) { Store.save(); try { renderTopbar(); } catch (e) { /* not ready */ } }
}

/** Is anyone at fault enough for the authority to go to court? */
function invAtFault(inv: Investigation): boolean { return inv.cause !== 'none' && (inv.dead > 0 || inv.level !== 'minor' || Math.max(inv.score.aircraft, inv.score.pilot) >= 0.8 || inv.org); }

function invDecide(inv: Investigation) {
  if (!courtOn() || (!invAtFault(inv) && inv.choice !== 'contested')) {
    inv.closed = true;
    State.notices.unshift({ id: uid(), kind: 'authority' as any, title: `Accident investigation closed: ${inv.reg}`, body: inv.cause === 'none' ? `The investigation found no fault with the aircraft, its maintenance or its crew. No one will be prosecuted.` : `The authority will not take the case to court. Its safety recommendations stand, and it will follow how they are put in place.`, time: 'Now', at: Date.now(), read: false, ref: inv.id } as any);
    return;
  }
  invOpenCase(inv);
}

/* ---------- the report ---------- */
function invPopup(id: string) {
  const inv = invById(id); if (!inv) return;
  closeAll();
  if (!inv.ready) {
    openLayer('modal', `<div class="modal-head"><div><small>${esc(inv.authority)}</small><h2>Investigation under way: ${esc(inv.reg)}</h2></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
      <p>The investigators are at work. Their preliminary report comes around ${esc(dateStr(new Date(inv.readyAt)))}.</p>`, { cls: 'narrow' });
    return;
  }
  if (!inv.seen) { inv.seen = true; State.notices = State.notices.filter((n: any) => !(n.ref === inv.id && n.invNag)); Store.save(); try { renderTopbar(); } catch (e) { /* not ready */ } }
  const ppl = inv.dead ? `${inv.dead} ${inv.dead === 1 ? 'person' : 'people'} died, ${inv.injured} injured` : inv.injured ? `No one died, ${inv.injured} injured` : 'No one was hurt';
  const causeTxt = inv.cause === 'aircraft' ? 'A technical failure of the aircraft, after shortcomings in its maintenance' : inv.cause === 'pilot' ? `How the aircraft was flown${inv.you ? ' (you were the pilot)' : inv.pilotName ? ` by ${inv.pilotName}` : ''}` : 'Not determined: no fault found so far';
  const looked = inv.cause === 'aircraft' ? (inv.mechName ? `The investigators are looking into your mechanics, in particular ${inv.mechName}, who looked after ${inv.reg}.` : 'The investigators are looking into your maintenance department.')
    : inv.cause === 'pilot' ? (inv.you ? 'The investigators are looking into how you flew the aircraft.' : inv.pilotDied ? `${inv.pilotName || 'The pilot'} did not survive. The investigators are looking into the airline's training and rostering.` : `The investigators are looking into ${inv.pilotName || 'the pilot'}, who survived.`) : '';
  const say = `Preliminary report on the accident of ${inv.reg}, a ${inv.model}, ${inv.place}. ${ppl}. Probable cause: ${causeTxt.toLowerCase()}. ${inv.chain.length > 1 ? 'The chain of events: ' + inv.chain.join('. Then, ') + '.' : ''} ${looked} ${inv.org ? 'Working conditions in the airline played a part, and the investigators are looking into the airline itself.' : ''}`;
  const done = inv.choice ? `<p class="v3d-note">${icon('check')}${inv.choice === 'signed' ? 'You signed the report.' : 'You disagreed with the report and took it to court.'}${inv.caseId ? ' The case is in court.' : inv.closed ? ' The investigation is closed.' : ' The authority is deciding whether the case goes to court.'}</p>` : '';
  openLayer('modal', `
    <div class="modal-head crash"><span class="crash-ic">${icon('shield')}</span><div><small>${esc(inv.authority.charAt(0).toUpperCase() + inv.authority.slice(1))} · Preliminary report</small><h2>Accident of ${esc(inv.reg)}</h2></div>
      <button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
    <div class="modal-body inv-rep">
      <div class="kv-row">
        <div><small>Aircraft</small><b>${esc(inv.reg)} · ${esc(inv.model)}</b></div>
        <div><small>Flight</small><b>${esc(inv.from)} to ${esc(inv.to)}</b></div>
        <div><small>Where</small><b>${esc(inv.place.charAt(0).toUpperCase() + inv.place.slice(1))}</b></div>
        <div><small>People</small><b class="${inv.dead ? 'red' : ''}">${esc(ppl)}</b></div>
      </div>
      <div class="inv-cause"><small>Probable cause</small><b>${esc(causeTxt)}</b>${inv.org ? `<span class="chip amber">Working conditions played a part</span>` : ''}</div>
      ${inv.chain.length ? `<small>The chain of events</small><ol class="inv-chain">${inv.chain.map(x => `<li>${esc(x.charAt(0).toUpperCase() + x.slice(1))}</li>`).join('')}</ol>` : ''}
      ${looked ? `<p>${esc(looked)}</p>` : ''}
      <small>Witnesses</small><ul class="inv-wit">${inv.witnesses.map(w => `<li><b>${esc(w.name)}</b>, ${esc(w.title.toLowerCase())}${w.saw ? '' : ': no one saw it'}</li>`).join('')}</ul>
      <p class="fine-print">${icon('info')}A preliminary report sets out the facts found so far. It is not a finding of guilt; the investigation continues.</p>
      <div class="say-row">${voiceButton(say, 'authority', 'Play the report')}${voiceNoteEl(inv.authority)}</div>
      ${done || `<div class="decide">
        <button class="decide-card" data-act="inv-sign" data-id="${esc(inv.id)}"><b>Sign the report</b><small>You accept the facts as the investigators found them. Owning up counts in your favour${invAtFault(inv) ? ', though the authority may still take the case to court' : ''}.</small></button>
        ${inv.cause !== 'none' ? `<button class="decide-card bad" data-act="inv-contest" data-id="${esc(inv.id)}"><b>I disagree: take it to court</b><small>The court weighs the evidence. If the records back the report, disagreeing counts against you.</small></button>` : ''}
      </div>`}
    </div>`, { cls: 'wide', onClose: () => Voice.stop() });
}
ACTIONS['inv-open'] = el => { const t = el.closest && el.closest('.toast'); if (t) t.remove(); invPopup(el.getAttribute('data-id')); };
ACTIONS['inv-sign'] = el => {
  const inv = invById(el.getAttribute('data-id')); if (!inv || inv.choice) return;
  inv.choice = 'signed'; inv.decideAt = Date.now() + invGap();
  const co: any = company(inv.cid); if (co && inv.cause !== 'none') { co.reputation = clamp(Math.round(((co.reputation || 50) + 1) * 10) / 10, 0, 100); }
  Store.save(); Sound.tick(); toast('Report signed. The authority will decide on the next steps.', 'ok'); invPopup(inv.id);
};
ACTIONS['inv-contest'] = el => {
  const inv = invById(el.getAttribute('data-id')); if (!inv || inv.choice) return;
  inv.choice = 'contested'; inv.decideAt = Date.now() + invGap();
  Store.save(); Sound.tick(); toast('You disagree with the report. The case goes to court.', 'warn'); invPopup(inv.id);
};

/* ---------- the court case ---------- */
/** Was disagreeing reasonable? Only when the other side of the story weighs almost as much. */
function invContestFair(inv: Investigation): boolean {
  const a = inv.score.aircraft, p = inv.score.pilot, hi = Math.max(a, p), lo = Math.min(a, p);
  return inv.cause === 'none' || hi < 0.45 || lo >= hi * 0.75;
}
function invOpenCase(inv: Investigation) {
  const co: any = company(inv.cid), A = apt(inv.to) || apt(co.hub), now = Date.now(), gap = invGap();
  const fatal = inv.dead > 0;
  const offDef = inv.cause === 'pilot'
    ? { w: 1, title: fatal ? 'Accident with fatalities: how the aircraft was flown' : 'Accident: how the aircraft was flown', charge: 'Endangering the safety of an aircraft and its passengers, and failing to ensure the crew flew it safely', text: '', months: [-3, -3], fine: [150000, fatal ? 1500000 : 600000] }
    : fatal ? OFFENCES.airline[1] : OFFENCES.airline[2];
  const why = inv.factors.map(f => f.text).slice(0, 4).join('; ') || 'the cause is disputed';
  const summary = inv.cause === 'none' ? `The airline has challenged the findings of the accident investigation into ${inv.reg}.` : `${inv.reg}, a ${inv.model}, crashed ${inv.place}. The investigation found ${inv.cause === 'aircraft' ? 'a technical failure after shortcomings in its maintenance' : 'that the way the aircraft was flown caused it'}: ${why}.`;
  const crash = { reg: inv.reg, typeId: inv.typeId, from: inv.from, to: inv.to, pax: inv.pax, dead: inv.dead, cond: (plane(inv.reg) || { condition: 60 } as any).condition, issues: (State.issues as any[]).filter(i => i.reg === inv.reg && i.status === 'open').map(i => i.title) };
  const c: any = {
    id: 'case-' + uid(), staffId: '', name: co.name, role: 'airline', look: null, companyId: co.id, offDef,
    offence: offDef.title, charge: offDef.charge, summary, country: inv.country, court: A ? `the District Court in ${A.city}` : 'the district court', authority: inv.authority,
    opened: now, status: 'open', guiltyP: inv.choice === 'contested' && invContestFair(inv) ? 0.45 : inv.org ? 0.85 : 0.7, fatal, reg: inv.reg,
    stages: [
      { at: now, key: 'summons', title: 'Summoned to court', text: `${inv.authority.charAt(0).toUpperCase() + inv.authority.slice(1)} has taken the accident of ${inv.reg} to ${A ? `the District Court in ${A.city}` : 'court'}. You, the accountable manager, are summoned${inv.mechName && inv.cause === 'aircraft' ? `, and so is ${inv.mechName}` : inv.cause === 'pilot' && !inv.you && !inv.pilotDied && inv.pilotName ? `, and so is ${inv.pilotName}` : ''}. ${inv.choice === 'contested' ? 'The court will also weigh your objections to the report.' : ''}` },
      { at: now + gap * 0.5, key: 'hear1', title: 'Hearing, day one: the witnesses and your evidence', text: '' },
      { at: now + gap * 1.5, key: 'prelim', title: 'Preliminary hearing', text: '' },
      { at: now + gap * 2, key: 'hear2', title: 'The trial', text: '' },
      { at: now + gap * 3, key: 'verdict', title: 'Verdict', text: '' },
    ],
  };
  try { courtSetup(c); } catch (e) { /* the basic case still runs */ }
  c.stages = c.stages.filter((s: any) => s.key !== 'report');   // the investigators' report is the one you have read
  c.hear = { kind: 'accident', inv: inv.id, facts: hearingFacts(co.id, crash), pAdj: inv.choice === 'contested' && !invContestFair(inv) ? 0.06 : 0, sevK: 1, lies: 0, honest: 0, absent: 0, rating: 0, standIn: null, log: [] as string[], appealAdj: 0 };
  c.rec = inv.cause === 'pilot' ? ['Check every pilot\'s training and records against the airline\'s standard', 'Limit duty hours and give crews proper rest', 'Give crews a way to report fatigue without fear'] : c.rec;
  const S: any = State; S.cases = S.cases || []; S.cases.unshift(c);
  inv.caseId = c.id;
  // the person at fault is suspended while the case runs
  const acc: any = inv.cause === 'aircraft' && inv.mechId ? staffById(inv.mechId) : inv.cause === 'pilot' && !inv.you && !inv.pilotDied && inv.pilotId ? staffById(inv.pilotId) : null;
  if (acc) { acc.status = 'off'; acc.suspended = c.id; }
  courtNotice(c, c.stages[0]); c.stages[0].done = true;
  Store.save();
  try { renderTopbar(); refresh(); Sound.chime(); toast(`Summoned to court: the accident of ${inv.reg}`, 'warn', { label: 'Open', act: 'court-open', data: c.id }); } catch (e) { /* not ready */ }
}

/** The preliminary hearing, after the witnesses and your evidence: is there a case to answer? */
function invPrelimApply(c: any, st: any) {
  const inv = invById(c.hear.inv), h = c.hear;
  const weak = (inv && inv.choice === 'contested' && invContestFair(inv) && h.lies === 0) || (h.honest >= 2 && h.lies === 0 && inv && !inv.org && inv.dead === 0 && inv.level !== 'destroyed');
  if (weak) {
    st.text = `At the preliminary hearing, ${c.court} found that the evidence heard did not give the airline a case to answer. The charges were dropped.${inv && inv.choice === 'contested' ? ' The court accepted the airline\'s objections to the report.' : ''}`;
    c.status = 'acquitted'; c.sentence = '';
    for (const s of c.stages) if (!s.done && s !== st) { s.done = true; s.title += ' (not needed)'; }
    hearRate(c, 2, 'The charges were dropped');
    invAccusedOutcome(c, false);
    if (inv) inv.closed = true;
  } else st.text = `At the preliminary hearing, after the witnesses and your evidence, ${c.court} found that there is a case to answer. The trial goes ahead${inv && inv.mechName && inv.cause === 'aircraft' ? `, and ${inv.mechName} will be heard` : inv && inv.cause === 'pilot' && inv.pilotName && !inv.pilotDied && !inv.you ? `, and ${inv.pilotName} will be heard` : ''}.`;
}
/** After the verdict: the mechanic or pilot at fault. */
function invAccusedOutcome(c: any, guilty: boolean) {
  const inv = invById(c.hear && c.hear.inv); if (!inv) return;
  inv.closed = true;
  const acc: any = inv.cause === 'aircraft' && inv.mechId ? staffById(inv.mechId) : inv.cause === 'pilot' && !inv.you && !inv.pilotDied && inv.pilotId ? staffById(inv.pilotId) : null;
  if (!acc) return;
  if (!guilty) { acc.suspended = ''; acc.status = 'standby'; return; }
  if (inv.dead > 0) { State.notices.unshift({ id: uid(), kind: 'staff' as any, title: `${acc.name} loses their licence`, body: `After the verdict, the authority withdrew ${acc.name}'s licence. They can no longer work for the airline.`, time: 'Now', at: Date.now(), read: false } as any); courtRemove(acc); }
  else { acc.suspended = ''; acc.status = 'standby'; acc.warnings = (acc.warnings || 0) + 1; try { staffMoodAdd(acc, -15, 'Found at fault for the accident'); } catch (e) { /* ignore */ } }
}

/* ---------- what is said in court ---------- */
/** How many questions you get: more the worse it was; relentless when people died. */
function invQCount(inv: Investigation): number { return inv.dead ? 6 + (inv.dead >= 10 ? 2 : inv.dead >= 3 ? 1 : 0) : inv.level === 'destroyed' ? 5 : inv.level === 'substantial' ? 4 : 3; }

function invQuestions(c: any, inv: Investigation): HearQ[] {
  const f: HearFacts = c.hear.facts, me: any = myPilot(), you = me ? me.name : 'the accountable manager', hard = inv.org || inv.dead > 0;
  const has = (k: string) => inv.factors.some(x => x.key === k), Q: HearQ[] = [];
  const tq = has('defects') || has('cond');
  Q.push({ id: 'defects', asker: 'judge', truth: tq, text: `${you}, did you know that ${inv.reg} ${tq ? (f.open ? `had ${f.open} unrepaired ${f.open === 1 ? 'defect' : 'defects'}` : 'was in poor condition') : 'had any problems'} when it was sent on that flight?`,
    opts: tq ? [{ t: `Yes. There were known problems with ${inv.reg} that should have been fixed first. That is on us.`, kind: 'honest' }, { t: 'Those decisions are made by our maintenance department, not by me.', kind: 'deflect' }, { t: `No. ${inv.reg} had no known problems.`, kind: 'lie' }]
      : [{ t: `${inv.reg} had no open defects, as the records show.`, kind: 'honest' }, { t: 'I would have to check with our maintenance department.', kind: 'deflect' }],
    after: { honest: 'The court notes it.', deflect: 'You are the accountable manager. It is your responsibility.', lie: 'The records show otherwise. The court notes that your answer was not true.' } });
  if (inv.cause === 'aircraft' || has('mpay') || has('mechs')) {
    const tp = has('mpay');
    Q.push({ id: 'pay', asker: 'prosecutor', truth: tp, text: hard ? `Isn't it the truth, ${you}, that you saved money on the people who keep your aircraft safe? Your mechanics were paid ${Math.round(f.payRatio * 100)}% of the going rate.` : `Your mechanics were paid ${Math.round(f.payRatio * 100)}% of the going rate. Did that affect their work?`,
      opts: tp ? [{ t: 'Yes. We paid them less than we should have, and I accept that it affected their work.', kind: 'honest' }, { t: 'Pay is set by the market, like at any airline.', kind: 'deflect' }, { t: 'No, our mechanics are paid well above the market.', kind: 'lie' }]
        : [{ t: 'No. They are paid at or above the going rate, as the payroll shows.', kind: 'honest' }, { t: 'Pay is set by the market, like at any airline.', kind: 'deflect' }],
      after: { honest: 'No further questions on pay.', deflect: 'That is not an answer.', lie: 'The payroll says otherwise.' } });
    const ts = has('mechs') || has('skill');
    Q.push({ id: 'staff', asker: 'judge', truth: ts, text: `You had ${f.mechs} ${f.mechs === 1 ? 'mechanic' : 'mechanics'} for ${f.fleet} aircraft. Were there enough of them, rested and qualified?`,
      opts: ts ? [{ t: 'No. There were too few, they worked long, tiring shifts, and some were not qualified enough.', kind: 'honest' }, { t: 'Staffing is a challenge across the whole industry.', kind: 'deflect' }, { t: 'Yes, we were fully staffed with qualified, rested people.', kind: 'lie' }]
        : [{ t: 'Yes. We had the mechanics the fleet needs, and they were qualified.', kind: 'honest' }, { t: 'Staffing is a challenge across the whole industry.', kind: 'deflect' }],
      after: { honest: 'Thank you.', deflect: 'The court asked about your airline, not the industry.', lie: 'The records show otherwise.' } });
    const tm = has('mmood') || has('quarrel');
    Q.push({ id: 'morale', asker: 'prosecutor', truth: tm, text: `The investigators describe your maintenance hangar as ${tm ? 'an unhappy place, with quarrels and work handed over badly' : 'a calm workplace'}. Did you know how your mechanics felt at work?`,
      opts: tm ? [{ t: 'Yes. I knew there were problems between them, and I didn\'t deal with them in time.', kind: 'honest' }, { t: 'People have their differences in every workplace.', kind: 'deflect' }, { t: 'There were no problems at all. They were a happy team.', kind: 'lie' }]
        : [{ t: 'Yes. It was a good team, and the records show no quarrels.', kind: 'honest' }, { t: 'People have their differences in every workplace.', kind: 'deflect' }],
      after: { honest: 'The court notes it.', deflect: 'The court will rely on the investigators.', lie: 'The witnesses say otherwise. The court notes it.' } });
  }
  if (inv.cause === 'pilot') {
    if (inv.you) {
      const tf = inv.score.pilot >= 0.3;
      Q.push({ id: 'flew', asker: 'judge', truth: tf, text: `${you}, you were flying ${inv.reg} yourself. Tell the court what happened on that approach.`,
        opts: tf ? [{ t: 'I flew it badly. I should have gone around, and I didn\'t.', kind: 'honest' }, { t: 'It was a difficult approach. Many things happened at once.', kind: 'deflect' }, { t: 'The aircraft didn\'t respond as it should. It was a technical fault.', kind: 'lie' }]
          : [{ t: 'The approach was flown by the book. I don\'t believe I caused it.', kind: 'honest' }, { t: 'It was a difficult approach. Many things happened at once.', kind: 'deflect' }],
        after: { honest: 'Thank you for your candour.', deflect: 'The flight data will tell the court.', lie: 'The flight data show the aircraft did exactly what it was told. The court notes it.' } });
    } else {
      const tp = has('prating') || has('pwarn') || has('drink') || has('pmood');
      Q.push({ id: 'pilotfit', asker: hard ? 'prosecutor' : 'judge', truth: tp, text: `${inv.pilotName || 'Your pilot'} ${tp ? `had ${[has('pwarn') ? 'warnings on their record' : '', has('prating') ? 'check results below standard' : '', has('drink') ? 'been reported for alcohol' : '', has('pmood') ? 'complained of exhaustion' : ''].filter(Boolean).join(', ')}` : 'had a clean record'}. Why was that pilot flying your passengers?`,
        opts: tp ? [{ t: 'We should have taken them off flying, or trained them again. We didn\'t.', kind: 'honest' }, { t: 'Every one of our pilots holds a valid licence.', kind: 'deflect' }, { t: 'There was nothing in their record to worry about.', kind: 'lie' }]
          : [{ t: 'Their record was clean, and their training up to date.', kind: 'honest' }, { t: 'Every one of our pilots holds a valid licence.', kind: 'deflect' }],
        after: { honest: 'The court notes it.', deflect: 'A licence is the minimum. The court asked about this pilot.', lie: 'The staff records say otherwise.' } });
    }
  }
  if (has('warned')) Q.push({ id: 'warned', asker: 'prosecutor', truth: true, text: `${you}, were you warned about safety before the accident?`,
    opts: [{ t: 'Yes. I was warned, and I did not act on it as I should have.', kind: 'honest' }, { t: 'We receive a lot of feedback. I can\'t recall every message.', kind: 'deflect' }, { t: 'No one ever raised a safety concern with me.', kind: 'lie' }],
    after: { honest: 'Thank you.', deflect: 'Then the court will rely on the records.', lie: 'The court has heard otherwise.' } });
  if (hard) Q.push({ id: 'profit', asker: 'prosecutor', truth: inv.org, text: `${you}, ${inv.dead ? `${inv.dead} ${inv.dead === 1 ? 'person' : 'people'} are dead. ` : ''}Did your airline put money before the safety of the people who flew with it?`,
    opts: inv.org ? [{ t: 'We cut corners we should never have cut. I accept that, and I am sorry.', kind: 'honest' }, { t: 'Every airline has to watch its costs.', kind: 'deflect' }, { t: 'Never. Safety always came first at this airline.', kind: 'lie' }]
      : [{ t: 'No. We never cut corners on safety, and the records show it.', kind: 'honest' }, { t: 'Every airline has to watch its costs.', kind: 'deflect' }],
    after: { honest: 'The court notes it.', deflect: 'That is not an answer to the question.', lie: 'The records tell a different story. The court notes it.' } });
  if (inv.choice === 'contested') { const fair = invContestFair(inv);
    Q.push({ id: 'contest', asker: 'judge', truth: !fair, text: `${you}, you refused to sign the preliminary report. On what grounds?`,
      opts: fair ? [{ t: `The evidence points as much to ${inv.cause === 'aircraft' ? 'how the aircraft was flown' : 'the aircraft and its maintenance'} as to what the report blames.`, kind: 'honest' }, { t: 'My lawyers advised me not to sign.', kind: 'deflect' }]
        : [{ t: 'I hoped the court would see it differently. The report is right, and I accept it now.', kind: 'honest' }, { t: 'My lawyers advised me not to sign.', kind: 'deflect' }, { t: 'The investigators made it up. None of it is true.', kind: 'lie' }],
      after: { honest: fair ? 'The court will weigh that.' : 'The court notes that you now accept it.', deflect: 'The court asked for your grounds, not your lawyers\'.', lie: 'The evidence supports the report. The court notes that your answer was not true.' } }); }
  else if (inv.choice === 'signed') Q.push({ id: 'signed', asker: 'judge', truth: true, text: `${you}, you signed the preliminary report. Do you accept its findings?`,
    opts: [{ t: 'Yes. I accept them, and we are putting things right.', kind: 'honest' }, { t: 'I signed it. I leave the rest to my lawyer.', kind: 'deflect' }],
    after: { honest: 'Thank you.', deflect: 'Very well.' } });
  const acted = !!(c.ch && c.ch.acted);
  Q.push({ id: 'changed', asker: 'judge', truth: !acted, text: `${you}, what has the airline changed since the accident?`,
    opts: acted ? [{ t: 'We have acted on every recommendation, and we report on it to the authority.', kind: 'honest' }, { t: 'We are reviewing our procedures.', kind: 'deflect' }]
      : [{ t: `We will act on every recommendation, starting today (${money(courtActCost(c))}).`, kind: 'act' }, { t: 'Not enough yet. I accept that.', kind: 'honest' }, { t: 'We are reviewing our procedures.', kind: 'deflect' }, { t: 'We have already put every recommendation in place.', kind: 'lie' }],
    after: { honest: 'The court notes it.', act: 'The court notes the airline\'s commitment.', deflect: 'That is vague.', lie: 'The authority tells the court that nothing has changed yet. Your answer was not true.' } });
  return Q.slice(0, invQCount(inv));
}

function hearingScriptAccident(c: any, key: string): HearLine[] {
  const inv = invById(c.hear.inv), co = company(c.companyId), me: any = myPilot(), you = me ? me.name : 'the accountable manager', court = c.court.replace(/^the /, 'The ');
  const L: HearLine[] = []; if (!inv) return L;
  const qs = invQuestions(c, inv), half = Math.ceil(qs.length / 2);
  const ask = (q: HearQ) => L.push({ who: q.asker === 'judge' ? 'judge' : 'prosecutor', text: '', q });
  const ppl = inv.dead ? `${inv.dead} ${inv.dead === 1 ? 'person' : 'people'} died and ${inv.injured} were injured` : inv.injured ? `${inv.injured} people were injured` : 'no one was hurt';
  if (key === 'hear1') {
    L.push({ who: 'clerk', text: `All rise. ${court} is now in session: the case concerning the accident of ${inv.reg}, brought by ${inv.authority}.` });
    L.push({ who: 'judge', text: `Please be seated. ${you}, you appear as the accountable manager of ${co.name}. Today the court hears the investigators and the witnesses, and then your evidence. Only after that will the court decide, at the preliminary hearing, whether there is a case to answer.` });
    L.push({ who: 'investigator', text: `Your honour, ${inv.reg}, a ${inv.model}, crashed ${inv.place}. ${ppl.charAt(0).toUpperCase() + ppl.slice(1)}. Our preliminary report is before the court.`, ex: { title: `Exhibit 1 · Preliminary report, ${inv.reg}`, rows: [['Aircraft', `${inv.reg} · ${inv.model}`], ['Flight', `${inv.from} to ${inv.to}`], ['People', ppl], ['Probable cause', inv.cause === 'aircraft' ? 'Technical failure after poor maintenance' : inv.cause === 'pilot' ? 'How the aircraft was flown' : 'Not determined'], ['Working conditions', inv.org ? 'Played a part' : 'Not found to play a part']] } });
    if (inv.chain.length) L.push({ who: 'investigator', text: `The chain of events, as we found it: ${inv.chain.map(x => x.charAt(0).toUpperCase() + x.slice(1)).join('. ')}.` });
    for (const w of inv.witnesses) L.push({ who: w.key, text: w.text, mood: w.key === 'survivor' ? 'sorry' : '' });
    if (inv.choice === 'contested') L.push({ who: 'lawyer', text: 'Your honour, the airline does not accept the report\'s findings, and asks the court to weigh the evidence for itself.' });
    qs.slice(0, half).forEach(ask);
    L.push({ who: 'judge', text: 'Thank you. The court will hold the preliminary hearing next, and decide whether there is a case to answer. The court is adjourned.' });
  } else if (key === 'hear2') {
    const accName = inv.cause === 'aircraft' ? inv.mechName : inv.cause === 'pilot' && !inv.you && !inv.pilotDied ? inv.pilotName : '';
    L.push({ who: 'clerk', text: `All rise. The trial concerning the accident of ${inv.reg} continues.` });
    L.push({ who: 'judge', text: `Please be seated.${accName ? ` The court calls ${accName}.` : ''}` });
    if (accName) {
      const p: any = inv.cause === 'aircraft' ? staffById(inv.mechId) : staffById(inv.pilotId), att = p ? ofAttitude(p) : 'defensive';
      const blame = inv.org ? ` We were ${inv.factors.filter(f => /mechs|mpay|mmood|quarrel|pmood|ppay|crew/.test(f.key)).map(f => f.text.replace(/^there (were|was) /, '')).slice(0, 2).join(', and ')}. We told management.` : '';
      L.push({ who: 'accused', text: att === 'honest' ? `I won't hide from it. ${inv.cause === 'aircraft' ? 'I signed off that aircraft, and I should not have.' : 'I flew that approach, and I should have gone around.'}${blame}` : att === 'lying' ? `I did everything by the book. Whatever happened, it wasn't me.` : att === 'dismissive' ? `I did my job. If the airline had given us what we needed, we wouldn't be here.${blame}` : `It wasn't as simple as the report makes it.${blame || ' We did our best with what we had.'}`, mood: att === 'honest' ? 'sorry' : att === 'dismissive' ? 'angry' : '' });
      if (inv.org) L.push({ who: 'prosecutor', text: `The court has heard it: the people who worked for ${co.name} were not given what they needed to work safely. That is a decision made at the top.` });
    }
    if (inv.dead) L.push({ who: 'relative', text: `My ${['husband', 'wife', 'daughter', 'son', 'father', 'mother'][_invRng(inv.id + 'r')() * 6 | 0]} was on that flight. We just want to know why, and that it never happens again.`, mood: 'sorry' });
    qs.slice(half).forEach(ask);
    L.push({ who: 'lawyer', text: '', q: { id: 'plea', asker: 'judge', truth: true, decision: true, text: `${you}, how does the airline plead? A guilty plea means a certain conviction, but the sentence is usually about a third lighter.`,
      opts: [{ t: 'Plead guilty', kind: 'plea' }, { t: 'Maintain not guilty: let the court weigh the evidence', kind: 'noplea' }], after: { plea: 'The court records the guilty plea.', noplea: 'The court records the plea of not guilty.' } } });
    L.push({ who: 'judge', text: '', q: { id: 'last', asker: 'judge', truth: true, text: `${you}, you have the last word.`,
      opts: [{ t: `I am deeply sorry. ${inv.dead ? 'People died, and nothing I say changes that. ' : ''}I will make sure it never happens again.`, kind: 'sorry' }, { t: 'This airline has a good safety record, and I stand by the people who work for it.', kind: 'defend' }, { t: 'I have nothing to add.', kind: 'silent' }],
      after: { sorry: 'Thank you.', defend: 'Thank you.', silent: 'Very well.' } } });
    L.push({ who: 'judge', text: 'The court will consider its verdict. The court is adjourned.' });
  } else if (key === 'verdict') {
    const g = c.status === 'guilty', h = c.hear;
    L.push({ who: 'clerk', text: 'All rise.' });
    L.push({ who: 'judge', text: `Please be seated. In the case concerning the accident of ${inv.reg}, the court has reached its verdict.` });
    L.push({ who: 'judge', text: g ? `The court finds ${co.name} guilty of ${c.charge.toLowerCase()}. The sentence is ${c.sentence}.${h.lies ? ' The court has taken into account that some of your answers were not true.' : h.honest ? ' The court has taken into account that you answered openly.' : ''}` : `The court finds ${co.name} not guilty.${h.honest ? ' Your openness has not gone unnoticed.' : ''}` });
    const accName = inv.cause === 'aircraft' ? inv.mechName : inv.cause === 'pilot' && !inv.you && !inv.pilotDied ? inv.pilotName : '';
    if (accName) L.push({ who: 'judge', text: g ? (inv.dead ? `The court finds that ${accName} bears part of the blame. The authority will withdraw their licence.` : `The court finds that ${accName} bears part of the blame. It is noted on their record.`) : `${accName} is cleared.` });
    if (inv.dead) L.push({ who: 'relative', text: g ? 'It doesn\'t bring them back. But at least the truth has been said.' : 'How can that be? Someone has to answer for this.', mood: g ? 'sorry' : 'angry' });
    L.push({ who: 'judge', text: 'This case is closed. The court is adjourned.' });
  }
  return L;
}
