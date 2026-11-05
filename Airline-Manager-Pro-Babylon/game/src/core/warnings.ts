// What happens after a formal warning. Most people take it to heart; some shrug it off, and now and then
// one pushes back (refuses it, complains to colleagues, files a grievance). Then you choose again: a
// stronger, final warning, or dismissal. Warning the same person again and again has a price:
// passengers notice, reviews and popularity suffer, a colleague or passenger may tell the papers, and a
// mechanic who never learns makes mistakes on the aircraft.

const REVOLTS: [string, string][] = [
  ['Refused to accept the warning', '{n} told the duty manager the warning was unfair and refused to sign it.'],
  ['Complained about the warning in front of passengers', '{n} complained loudly about the warning at the gate in {b}, in front of passengers.'],
  ['Filed a grievance against the airline', '{n} filed a formal grievance with the union over the warning.'],
  ['Ignored instructions after the warning', '{n} carried on exactly as before and ignored the supervisor\'s instructions in {b}.'],
  ['Called the warning a joke on social media', '{n} posted about the warning online, calling it a joke. Colleagues saw it, and so did some passengers.'],
];

/** Called when a warning is given: the outcome shows over the next hours. */
function warnGiven(p: any, inc: any, strong: boolean) {
  p.warnPending = { at: Date.now() + (1 + Math.random() * 3) * 3600e3, strong, inc: inc.id, sev: inc.sev || 'moderate' };
  warnRepeatCost(p);
}
/** The chance a warning sinks in: lower with every warning and every one already ignored, higher for a final one. */
function warnLearnChance(p: any, strong: boolean): number { return clamp(0.78 - 0.11 * ((p.warnings || 1) - 1) - 0.1 * (p.stubborn || 0) + (strong ? 0.15 : 0), 0.15, 0.92); }

function warnAdvance() {
  const S: any = State, now = Date.now();
  const people: any[] = ((S.staff || []) as any[]).concat(State.pilots as any[]);
  for (const p of people) {
    const w = p.warnPending; if (!w || w.at > now || p.left) continue;
    delete p.warnPending;
    const cid = p.companyId || State.companyId, c = company(cid) || company();
    if (Math.random() < warnLearnChance(p, w.strong)) {
      p.learned = (p.learned || 0) + 1; p.rating = clamp(Math.round(((p.rating || 3.5) + 0.1) * 100) / 100, 1, 5);
      const nid = uid();
      State.notices.unshift({ id: nid, kind: 'staff' as any, title: `${p.name} took the warning to heart`, body: `Since the ${w.strong ? 'final ' : ''}warning, ${p.name} has been more careful. Supervisors in ${p.base || c.hub} have noticed.`, time: 'Now', at: now, read: false, ref: 'wo-' + nid, wo: { pid: p.id, inc: w.inc, strong: w.strong, learned: true } } as any);
      continue;
    }
    p.stubborn = (p.stubborn || 0) + 1;
    // pushing back is rare; it gets likelier with every warning they ignored
    const revolt = Math.random() < clamp(0.1 + 0.07 * (p.stubborn - 1) + (w.strong ? 0.04 : 0), 0, 0.42);
    if (!revolt) {
      const nid = uid();
      State.notices.unshift({ id: nid, kind: 'staff' as any, title: `${p.name} didn't learn from the warning`, body: `${p.name} carries on as before. More trouble is likely.${personRole(p) === 'mech' ? ' A mechanic who doesn\'t learn makes mistakes on the aircraft.' : ''}`, time: 'Now', at: now, read: false, ref: 'wo-' + nid, wo: { pid: p.id, inc: w.inc, strong: w.strong, learned: false } } as any);
      continue;
    }
    const t = REVOLTS[Math.floor(Math.random() * REVOLTS.length)];
    const inc: any = { id: uid(), staffId: p.id, sev: 'moderate', title: t[0], text: t[1].replace('{n}', p.name).replace('{b}', p.base || c.hub), date: dateStr(new Date()).slice(0, 10), status: 'open', revolt: true };
    S.incidents.unshift(inc);
    p.rating = clamp(Math.round(((p.rating || 3.5) - 0.15) * 100) / 100, 1, 5);
    try { (staffMoodAdd as any)(p, -6); } catch (e) { /* ignore */ }
    if (/passengers|online/.test(t[0])) { try { Progress.popularity(-1, `${p.name} complained in public`); } catch (e) { /* ignore */ } }
    State.notices.unshift({ id: 'n-' + inc.id, kind: 'staff' as any, title: `${p.name} pushes back against your warning`, body: `${t[0]}. Give a stronger warning or dismiss them.`, time: 'Now', at: now, read: false, ref: inc.id } as any);
    try { renderTopbar(); Sound.chime(); toast(`${p.name} pushes back against your warning`, 'warn', { label: 'Open', act: 'open-incident', data: inc.id }); } catch (e) { /* not ready */ }
  }
}
/** The whole report on how a warning went: who, what it was for, how they took it, their record, and what you can do. */
function warnOutcomeReport(n: any): { text: string; p: any; inc: any } {
  const o = n.wo || {}, S: any = State, p = staffById(o.pid), inc = (S.incidents || []).filter((x: any) => x.id === o.inc)[0];
  if (!p) return { text: n.body, p: null, inc };
  const role = personRole(p), log = (p.warnLog || []).filter((x: any) => x.inc === o.inc)[0];
  const ord = (k: number) => ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'][k] || k + (k % 10 === 1 && k % 100 !== 11 ? 'st' : k % 10 === 2 && k % 100 !== 12 ? 'nd' : k % 10 === 3 && k % 100 !== 13 ? 'rd' : 'th');
  const parts: string[] = [];
  parts.push(`${p.name}, ${ROLE_NAMES[role].toLowerCase()} based in ${p.base || company().hub}, was given a ${o.strong ? 'final' : 'formal'} warning${log && log.given ? ' on ' + dateStr(new Date(log.given)).slice(0, 10) : ''}${inc ? ` for "${inc.title}"` : ''}.`);
  if (inc && inc.text) parts.push(`What happened: ${inc.text}`);
  if (o.learned) parts.push(`Since then ${p.name} has been more careful, and the supervisors in ${p.base || company().hub} have noticed. Their rating goes up a little.`);
  else parts.push(`Since then ${p.name} has carried on as before. The warning has not changed anything, and more trouble is likely.${role === 'mech' ? ' A mechanic who doesn\'t learn makes mistakes on the aircraft: the risk of a maintenance error grows with every warning ignored.' : ''}`);
  parts.push(`This was their ${ord(p.warnings || 1)} warning.${p.learned ? ` They improved after ${p.learned}.` : ''}${p.stubborn ? ` They have ignored ${p.stubborn === 1 ? 'one' : p.stubborn}.` : ''}${(p.warnings || 0) >= 3 ? ' Passengers are starting to hear about it, which lowers your ratings and popularity for a while.' : ''}`);
  if (!o.learned) parts.push(`What you can do: if it happens again you can give a final warning or dismiss ${p.name}. Every further warning is less likely to work than the last.`);
  return { text: parts.join(' '), p, inc };
}
function warnOutcomePopup(nid: string) {
  const n: any = State.notices.filter(x => x.id === nid)[0]; if (!n) return;
  const r = warnOutcomeReport(n), p = r.p, at = n.at;
  closeAll();
  const role = p ? personRole(p) : 'fa';
  const wrap = openLayer('modal', `
    <div class="inc">
      ${p ? `<div class="inc-av">${avatarSvg(p.look, role, { accent: company().color })}</div>` : ''}
      <div class="inc-main">
        <div class="modal-head"><div><small>Report from the head of operations${at ? ' · ' + esc(receivedText(at)) : ''}</small><h2>${esc(n.title)}</h2></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
        <div class="say-row">${voiceButton(r.text, 'ops', 'Play the report')}${voiceNoteEl('Head of operations')}</div>
        <p class="speech">${esc(r.text)}</p>
        ${p ? `<div class="inc-who"><b>${esc(p.name)}</b><small>${ROLE_NAMES[role]}, ${natLabel(p.nat)}, ${ageOf(p.dob)}, base ${esc(p.base)}</small></div>${warnHistory(p)}
        <div class="modal-actions"><button class="btn ghost" data-act="staff-detail" data-id="${esc(p.id)}">${icon('user')}Open ${esc(p.name.split(' ')[0])}'s record</button>${r.inc ? `<button class="btn ghost" data-act="open-incident" data-id="${esc(r.inc.id)}">${icon('alert')}The original report</button>` : ''}</div>` : '<p class="lede">This person no longer works for you.</p>'}
      </div>
    </div>`, { cls: 'wide', onClose: () => Voice.stop() });
  try { autoSpeak(wrap); } catch (e) { /* ignore */ }
}
function startWarnClock() { setTimeout(warnAdvance, 15000); setInterval(warnAdvance, 60000); }

/** Warning after warning, without letting them go: passengers notice, and it may reach the papers. */
function warnRepeatCost(p: any) {
  const w = p.warnings || 0; if (w < 3) return;
  const S: any = State, cid = p.companyId || State.companyId, c = company(cid) || company(), extra = w - 2;
  try { Progress.popularity(-Math.min(4, 0.8 * extra), `${p.name} kept on after ${w} warnings`); } catch (e) { /* ignore */ }
  S.conductDrama = S.conductDrama || {};
  const d = S.conductDrama[cid] || { level: 0, until: 0 };
  S.conductDrama[cid] = { level: Math.min(5, (d.until > Date.now() ? d.level : 0) + extra), until: Date.now() + 10 * 864e5 };
  State.notices.unshift({ id: uid(), kind: 'staff' as any, title: `Passengers are talking about ${p.name}`, body: `${p.name} has had ${w} formal warnings and still works for you. Word gets around: passengers rate flights lower for a while, and your popularity drops. Each further warning makes it worse.`, time: 'Now', at: Date.now(), read: false } as any);
  // a colleague or a passenger may go to the press (not every time)
  if (Math.random() < clamp(0.12 + 0.1 * (w - 3), 0, 0.6)) setTimeout(() => { try { newsWarnings(c, p, w); } catch (e) { /* ignore */ } }, (30 + Math.random() * 120) * 1000);
}
/** How much passengers have heard about trouble with the airline's staff (0 = nothing). */
function conductDrama(cid: string): number { const d = ((State as any).conductDrama || {})[cid]; return d && d.until > Date.now() ? d.level : 0; }

/** Mechanics who keep getting warnings and never learn: mistakes on the aircraft, more likely each time. */
function mechRiskFactor(cid: string, base?: string): number {
  const bad = staffOf(cid, 'mech').filter((m: any) => (m.warnings || 0) >= 2 && (m.stubborn || 0) > 0 && !m.left && (!base || !m.base || m.base === base));
  return Math.min(5, 1 + bad.reduce((s: number, m: any) => s + 0.45 * m.stubborn + 0.15 * (m.warnings - 2), 0));
}
/** Before each flight's condition check: a maintenance error by a careless mechanic. */
function mechErrorRisk(a: any, f: any): boolean {
  const k = mechRiskFactor(a.companyId, a.base); if (k <= 1) return false;
  const m: any = staffOf(a.companyId, 'mech').filter((x: any) => (x.stubborn || 0) > 0 && (x.warnings || 0) >= 2).sort((x: any, y: any) => (y.stubborn || 0) - (x.stubborn || 0))[0];
  if (Math.random() < 0.0007 * (k - 1)) { conditionAccident(a, f); return true; }
  if (Math.random() < 0.006 * (k - 1)) {
    const what = ['a panel left unfastened', 'an oil cap not tightened', 'a torque check skipped', 'a wrong part fitted', 'a tool left in the wheel well'][Math.floor(Math.random() * 5)];
    State.issues.unshift({ id: uid(), reg: a.reg, title: 'Maintenance error', detail: `${f.callsign} turned back with ${what}. ${m ? m.name + ', who has ' + m.warnings + ' warnings on record, signed off the work.' : ''}`, source: 'Maintenance', sev: 'major', date: dateStr(new Date()).slice(0, 10) } as any);
    State.notices.unshift({ id: uid(), kind: 'mechanic' as any, title: `Maintenance error: ${a.reg}`, body: `${f.callsign} landed safely after ${what}.${m ? ` ${m.name} signed off the work; they have ignored ${m.stubborn} warning${m.stubborn > 1 ? 's' : ''}.` : ''} The risk grows the longer they stay.`, time: 'Now', at: Date.now(), read: false } as any);
    try { Progress.popularity(-2, 'A maintenance error'); } catch (e) { /* ignore */ }
  }
  return false;
}

/** In the papers: an airline that keeps warning, and keeping, the same person. */
function newsWarnings(c: Company, p: any, w: number) {
  if (!newsOnce('warn:' + p.id + ':' + w, 'warn', 3 * 864e5)) return;
  const fromPax = Math.random() < 0.45, role = (levelTitle(p) || 'crew member').toLowerCase();
  try { Progress.popularity(-2, 'Bad press about staff warnings'); } catch (e) { /* ignore */ }
  newsPost(c, p.base || c.hub, { section: 'Investigation', art: p.look ? { kind: 'person', look: p.look, role: personRole(p) || 'fa', color: c.color } : { kind: 'court' },
    headline: `${w} warnings, still on duty: questions for ${c.name}`,
    standfirst: `${fromPax ? 'A passenger' : 'A colleague'} has revealed that a ${role} at ${c.name} has had ${w} formal warnings and still works there.`,
    body: [fromPax ? 'The passenger says they overheard staff talking about it at the gate, and later saw the same person on their flight.' : 'The colleague, who asked not to be named, says morale is suffering and the same problems keep happening.',
      `${c.name} would not discuss individual staff, but said it "follows its procedures".`, personRole(p) === 'mech' ? 'Safety experts say repeated problems with the same mechanic should ring alarm bells.' : 'Passengers say they expect better.'],
    quote: fromPax ? ['You expect an airline to deal with that kind of thing. It doesn\'t make you feel safe.', 'A passenger'] : ['Everyone knows. Nothing changes.', 'A colleague'] });
}
