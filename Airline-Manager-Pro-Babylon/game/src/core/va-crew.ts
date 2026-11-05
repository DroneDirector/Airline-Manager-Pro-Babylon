// Crew features: recency on each aircraft type, shared cockpit flights, instructors signing off check
// rides, Pilot of the Month and staff awards, screenshots and the photo contest, base transfer requests
// and NOTAMs in the briefings.

/* ---------- recency: 3 landings on a type in the last 90 days ---------- */
// As at real airlines: a pilot who hasn't landed a type 3 times in 90 days isn't current on it. Hired
// pilots then spend half a day in the simulator before flying it again (paid by the airline). You fly
// your next leg on that type as a recency flight: circuits or a leg without passengers.
const RECENCY_DAYS = 90, RECENCY_N = 3;
function recencyStart(): number { const S: any = State; return S.recencyStart || (S.recencyStart = Date.now()); }
function _logTime(l: any): number { return Date.parse(String(l.date).replace(' ', 'T')) || 0; }
/** Landings on a type in the last 90 days (yours from the logbook, a hired pilot's from the landing records). */
function recentLandings(who: any, typeId: string): number {
  const since = Date.now() - RECENCY_DAYS * 864e5;
  if (!who || who.you) return State.logbook.filter((l: any) => !l.coopBy && l.result !== 'crash' && (l.typeId || (plane(l.reg) || {} as any).typeId) === typeId && _logTime(l) > since).length;
  return Ratings.list().filter((r: any) => r.who === who.id && r.typeId === typeId && r.at > since).length;
}
/** Current on a type: 3 landings in 90 days, a recency flight or session in that time, or the rule is newer than 90 days for this type. */
function isCurrent(who: any, typeId: string): boolean {
  if (!who || !typeId) return true;
  const rc = (who.recency = who.recency || {}), since = Date.now() - RECENCY_DAYS * 864e5;
  if ((rc[typeId] || 0) > since) return true;
  if (recencyStart() > since) return true;
  return recentLandings(who, typeId) >= RECENCY_N;
}
function recencyText(who: any, typeId: string): string {
  const n = recentLandings(who, typeId), t = acType(typeId);
  return isCurrent(who, typeId) ? `Current on the ${t ? t.model : typeId} (${n} landing${n === 1 ? '' : 's'} in 90 days)` : `Not current on the ${t ? t.model : typeId}: ${n} of ${RECENCY_N} landings in 90 days`;
}
/** Hired pilots who lost recency on the type of their route go to the simulator first. */
function recencyTick() {
  const now = Date.now();
  for (const p of State.pilots as any[]) {
    if (p.you || String(p.id).indexOf('coop') === 0 || (p.companyId && String(p.companyId).indexOf('coop:') === 0)) continue;
    if (p.recencySim) {
      if (p.recencySim.until <= now) { (p.recency = p.recency || {})[p.recencySim.typeId] = now; p.status = 'standby'; delete p.trainingUntil; delete p.recencySim; Store.soon(); }
      continue;
    }
    if (p.status !== 'standby') continue;
    const r = State.routes.filter(x => x.pilotId === p.id)[0]; if (!r || !Ratings.rated(p, r.typeId) || isCurrent(p, r.typeId)) continue;
    const t = acType(r.typeId), cost = Math.round(Ratings.cost(r.typeId) * 0.15), c = company(p.companyId && State.companies.some(x => x.id === p.companyId) ? p.companyId : State.companyId);
    const until = now + 0.5 * 864e5 / Math.max(1, Math.min(10, aiSpeed()));
    payTxn(c.id, `Recency session: ${p.name}, ${t.maker} ${t.model}`, -cost, 'training', [['Full flight simulator: 3 take-offs and landings', -cost]]);
    p.status = 'training'; p.trainingUntil = until; p.recencySim = { typeId: r.typeId, until };
    State.notices.unshift({ id: uid(), kind: 'pilot', title: `${p.name} needs a recency session`, body: `No ${RECENCY_N} landings on the ${t.model} in the last ${RECENCY_DAYS} days. Half a day in the simulator (${money(cost)}) before flying it again.`, time: 'Now', at: now, read: false } as any);
  }
}
/** Your next leg: are you current on the aircraft? */
function myRecencyNote(): string {
  const me: any = myPilot(), a = plane((State as any).myReg[State.companyId]); if (!me || !a) return '';
  if (isCurrent(me, a.typeId)) return '';
  return `<div class="card brief warn">${icon('alert')}<span><b>Recency flight: ${esc(acType(a.typeId).model)}</b><small>${esc(recencyText(me, a.typeId))}. Your next leg in it flies without passengers (circuits or an empty leg); after that you're current again. Or book a simulator session now.</small></span><button class="btn ghost sm" data-act="rc-sim">${money(Math.round(Ratings.cost(a.typeId) * 0.15))}</button></div>`;
}
ACTIONS['rc-sim'] = () => {
  const me: any = myPilot(), a = plane((State as any).myReg[State.companyId]); if (!a) return;
  const cost = Math.round(Ratings.cost(a.typeId) * 0.15), k = meCareer();
  confirmChange('Book a simulator session?', `3 take-offs and landings in the ${acType(a.typeId).model} simulator, ${money(cost)} from your wallet. You're current again straight away.`, 'Book it', 'Not now', () => {
    k.wallet -= cost; (me.recency = me.recency || {})[a.typeId] = Date.now(); Store.save(); closeTop(); refresh(); toast('Recency session done: current again', 'ok');
  }, () => closeTop());
};
/** Called when your leg is logged: a leg flown while not current is the recency flight (no passengers). */
function recencyMyLeg(typeId: string, sm: any): string {
  const me: any = myPilot(); if (!me || isCurrent(me, typeId)) return '';
  sm.pax = 0; (me.recency = me.recency || {})[typeId] = Date.now();
  return 'Recency flight, no passengers';
}

/* ---------- co-op crew room helpers ---------- */
function crewRoom(): any { const c: any = coopState(); if (!c) return {}; return c.crew || (c.crew = { shared: [], rides: [], awards: [], votes: {}, transfers: [], photos: [] }); }
function _member(id: string): any { return coopMember(id) || {}; }
function _monthKey(t?: number): string { return new Date(t || Date.now()).toISOString().slice(0, 7); }
function _monthName(k: string): string { const d = new Date(k + '-15'); return d.toLocaleString('en-GB', { month: 'long', year: 'numeric' }); }

/* ---------- shared cockpit (co-op) ---------- */
// Two real pilots on one flight: one captain, one first officer. Both log it; the pay is split 60/40 and
// the first officer's hours count towards the next rank. Needs an aircraft that supports Flight Simulator's
// shared cockpit.
let _sc = { who: '', role: 'captain', leg: 0 };
function sharedCockpitHtml(): string {
  const cr = crewRoom(), me: any = coopMe(), others = coopState().members.filter((m: any) => !m.you), legs = legOptions();
  const mine = cr.shared.filter((x: any) => x.status !== 'flown' && (x.captain === me.id || x.fo === me.id));
  return `<div class="card"><div class="card-h"><b>Shared cockpit</b><small>Fly a leg together: captain and first officer</small></div>
    ${mine.map((x: any) => `<div class="ev-row"><span><b>${esc(x.from)} → ${esc(x.to)}</b><small>Captain ${esc(_member(x.captain).name || '')}, first officer ${esc(_member(x.fo).name || '')} · ${x.status === 'invited' ? 'waiting for an answer' : x.status === 'declined' ? 'declined' : 'accepted: fly it in the shared cockpit'}</small></span><button class="text-btn" data-act="sc-cancel" data-id="${esc(x.id)}">Cancel</button></div>`).join('')}
    <div class="fs-fields"><label class="field"><span>Fly with</span><select class="le-in sc-who">${others.map((m: any) => `<option value="${esc(m.id)}" ${_sc.who === m.id ? 'selected' : ''}>${esc(m.name)}${m.online ? ' (online)' : ''}</option>`).join('')}</select></label>
      <label class="field"><span>You fly as</span><select class="le-in sc-role"><option value="captain" ${_sc.role === 'captain' ? 'selected' : ''}>Captain</option><option value="fo" ${_sc.role === 'fo' ? 'selected' : ''}>First officer</option></select></label>
      <label class="field"><span>Leg</span><select class="le-in sc-leg">${legs.map((l, i) => `<option value="${i}" ${_sc.leg === i ? 'selected' : ''}>${esc(l[0])} → ${esc(l[1])}</option>`).join('')}</select></label></div>
    <div class="modal-actions"><button class="btn primary" data-act="sc-invite" ${others.length && legs.length ? '' : 'disabled'}>${icon('coop')}Invite</button></div>
    <small class="muted">Both log the flight. Pay is split 60% captain, 40% first officer; first officer hours count towards the next rank. Both of you need an aircraft that supports Flight Simulator's shared cockpit.</small></div>`;
}
ACTIONS['sc-invite'] = () => {
  const w = ($('.sc-who') as HTMLSelectElement).value, role = ($('.sc-role') as HTMLSelectElement).value, li = +($('.sc-leg') as HTMLSelectElement).value, leg = legOptions()[li]; if (!w || !leg) return;
  _sc = { who: w, role, leg: li };
  const me: any = coopMe(), m: any = coopMember(w), x = { id: uid(), captain: role === 'captain' ? me.id : w, fo: role === 'captain' ? w : me.id, from: leg[0], to: leg[1], at: Date.now(), status: 'invited' };
  crewRoom().shared.push(x); coopPost('crew', `${me.name} invited ${m.name} to fly ${leg[0]} → ${leg[1]} in the shared cockpit`); Store.save(); refresh(); toast(`Invitation sent to ${m.name}`, 'info');
  if (coopState().backend === 'demo') setTimeout(() => { const ok = Math.random() < 0.75; x.status = ok ? 'accepted' : 'declined'; coopPost('crew', `${m.name} ${ok ? 'accepted' : 'declined'} the shared cockpit flight ${x.from} → ${x.to}`, m); State.notices.unshift({ id: uid(), kind: 'pilot', title: `${m.name} ${ok ? 'will fly with you' : 'can\'t fly with you'}`, body: `Shared cockpit ${x.from} → ${x.to}${ok ? ': fly it whenever you are both ready.' : '.'}`, time: 'Now', at: Date.now(), read: false } as any); Store.save(); try { renderTopbar(); if (State.screen === 'coop') refresh(); } catch (e) { /* ignore */ } }, 4000 + Math.random() * 6000);
};
ACTIONS['sc-cancel'] = el => { const cr = crewRoom(); cr.shared = cr.shared.filter((x: any) => x.id !== el.getAttribute('data-id')); Store.save(); refresh(); };
/** Your leg was logged: was it a shared cockpit flight? The partner logs it, and the pay is split. */
function sharedAfterMyLeg(l: any, blockMin: number): string {
  if (!coopOn()) return '';
  const cr = crewRoom(), me: any = coopMe(), x = cr.shared.filter((s: any) => s.status === 'accepted' && s.from === l.from && s.to === l.to && (s.captain === me.id || s.fo === me.id))[0]; if (!x) return '';
  x.status = 'flown'; const other: any = coopMember(x.captain === me.id ? x.fo : x.captain), cap = x.captain === me.id;
  if (other) { other.flights++; other.hoursMin += blockMin; if (!cap) other.capMin = (other.capMin || 0) + blockMin; else other.foMin = (other.foMin || 0) + blockMin; other.lastSeen = Date.now(); }
  if (!cap) { (me as any).foMin = ((me as any).foMin || 0) + blockMin; }
  const pay = Math.round(myPayRate() * blockMin / 60), k = meCareer(); k.wallet -= Math.round(pay * (cap ? 0.4 : 0.6));
  coopPost('crew', `${_member(x.captain).name} and ${_member(x.fo).name} flew ${l.from} → ${l.to} together`);
  return `Shared cockpit: ${cap ? 'captain' : 'first officer'}, with ${other ? other.name : 'a co-op pilot'}`;
}
/** Demo co-op pilots fly together now and then. */
function sharedPairFor(memberId: string): string {
  if (Math.random() > 0.12) return '';
  const o = coopState().members.filter((m: any) => !m.you && m.id !== memberId && !State.live.some((f: any) => f.pilotId === m.id))[0];
  return o ? o.id : '';
}

/* ---------- instructors sign off check rides (co-op) ---------- */
// In co-op a check ride isn't judged by the app alone: a trainer (instructor) looks at the flight, its
// landing, score and replay, and passes or fails it with comments.
function checkRideQueue(): any[] { return crewRoom().rides || []; }
/** Your own check ride in co-op goes to a trainer instead of passing straight away. */
function coopMyCheckRide(typeId: string, fpm: number, g: number, damaged: boolean): boolean {
  if (!coopOn()) return false;
  if (checkRideQueue().some((r: any) => r.mine && r.typeId === typeId && r.status === 'pending')) return true;
  const me: any = myPilot(), l: any = State.logbook[0];
  const x = { id: uid(), by: (coopMe() as any).id, name: me.name, typeId, from: l ? l.from : '', to: l ? l.to : '', at: Date.now(), fpm: Math.abs(fpm), g, score: l && l.score != null ? l.score : null, logId: l ? l.id : '', damaged, status: 'pending', mine: true };
  checkRideQueue().push(x);
  coopPost('crew', `${me.name} flew a check ride on the ${acType(typeId).model}. Waiting for a trainer.`);
  State.notices.unshift({ id: uid(), kind: 'pilot', title: `Check ride sent to a trainer`, body: `${acType(typeId).maker} ${acType(typeId).model}: a trainer looks at your landing, score and replay, then signs it off.`, time: 'Now', at: Date.now(), read: false } as any);
  if (coopState().backend === 'demo') setTimeout(() => demoTrainerDecide(x), (90 + Math.random() * 120) * 1000);
  return true;
}
function demoTrainerDecide(x: any) {
  if (x.status !== 'pending') return;
  const tr: any = coopState().members.filter((m: any) => !m.you && ((m.staff || []).indexOf('trainer') >= 0 || m.role === 'owner'))[0];
  const ok = !x.damaged && x.fpm < 400 && x.g < 1.6 && (x.score == null || x.score >= 70);
  const why = ok ? (x.fpm < 150 ? 'Lovely landing, well flown.' : 'Solid flying, procedures followed.') : x.damaged ? 'The aircraft was damaged. Let\'s fly it again.' : x.fpm >= 400 ? `Landing too firm (${x.fpm} fpm). Work on the flare.` : x.g >= 1.6 ? 'Too much g on touchdown.' : `Too many rules broken (score ${x.score}).`;
  checkRideDecide(x, ok, why, tr ? tr.name : 'An outside examiner');
}
function checkRideDecide(x: any, ok: boolean, why: string, trainer: string) {
  x.status = ok ? 'passed' : 'failed'; x.comment = why; x.trainer = trainer; x.decidedAt = Date.now();
  const t = acType(x.typeId);
  if (x.mine) {
    const me: any = myPilot(); if (ok) { me.types = me.types || []; if (me.types.indexOf(x.typeId) < 0) me.types.push(x.typeId); }
    State.notices.unshift({ id: uid(), kind: 'pilot', title: `Check ride ${ok ? 'passed' : 'not passed'}: ${t.model}`, body: `${trainer}: "${why}"${ok ? ` The ${t.model} is on your licence.` : ' Fly it again to retry.'}`, time: 'Now', at: Date.now(), read: false } as any);
  } else { const m: any = coopMember(x.by); if (m && ok) { m.types = m.types || []; m.types.push(x.typeId); } }
  coopPost('crew', `${trainer} ${ok ? 'passed' : 'failed'} ${x.name}'s check ride on the ${t.model}: ${why}`);
  Store.save(); try { renderTopbar(); if (State.screen === 'coop') refresh(); } catch (e) { /* ignore */ }
}
/** A demo co-op pilot's flight was sometimes a check ride on a new type. */
function coopMemberCheckRide(pr: any, logId: string, score: number) {
  if (Math.random() > 0.06) return;
  const x = { id: uid(), by: pr.by, name: pr.name, typeId: pr.typeId, from: pr.from, to: pr.to, at: pr.at, fpm: Math.abs(pr.fpm), g: pr.g, score, logId, status: 'pending' };
  checkRideQueue().push(x);
  if (coopCan('trainer')) State.notices.unshift({ id: uid(), kind: 'pilot', title: `Check ride to sign off: ${pr.name}`, body: `${acType(pr.typeId).model}, ${pr.from} → ${pr.to}: landing ${Math.abs(pr.fpm)} fpm, score ${score}. Pass or fail it under Co-op → Crew room.`, time: 'Now', at: Date.now(), read: false } as any);
  else setTimeout(() => demoTrainerDecide(x), (60 + Math.random() * 180) * 1000);
}
let _crComment = '';
function checkRidesHtml(): string {
  const q = checkRideQueue(), can = coopCan('trainer'), me: any = coopMe(), pend = q.filter((x: any) => x.status === 'pending'), done = q.filter((x: any) => x.status !== 'pending').slice(-5).reverse();
  return `<div class="card"><div class="card-h"><b>Check rides</b><small>${can ? 'You sign off as trainer' : 'Signed off by the co-op\'s trainers'}</small></div>
    ${pend.map((x: any) => `<div class="cr-ride"><div class="ev-row"><span><b>${esc(x.name)} · ${esc(acType(x.typeId).model)}</b><small>${esc(x.from)} → ${esc(x.to)} · landing ${x.fpm} fpm, ${x.g.toFixed(2)} g${x.score != null ? ' · score ' + x.score : ''}</small></span>${x.logId && trackOf(x.logId) ? `<button class="btn ghost sm" data-act="replay-open" data-id="${esc(x.logId)}">${icon('play')}Replay</button>` : ''}</div>
      ${can && x.by !== me.id ? `<div class="chat-in"><input class="le-in cr-c" data-id="${esc(x.id)}" maxlength="200" placeholder="Comments for the pilot" value="${esc(_crComment)}"><button class="btn primary sm" data-act="cr-decide" data-id="${esc(x.id)}" data-v="1">${icon('check')}Pass</button><button class="btn danger sm" data-act="cr-decide" data-id="${esc(x.id)}" data-v="0">Fail</button></div>` : `<small class="muted">Waiting for a trainer${x.by === me.id && can ? ' (you can\'t sign off your own)' : ''}.</small>`}</div>`).join('') || '<p class="muted pad">No check rides waiting.</p>'}
    ${done.map((x: any) => `<div class="ev-row"><span><b>${esc(x.name)} · ${esc(acType(x.typeId).model)}: ${x.status === 'passed' ? 'passed' : 'not passed'}</b><small>${esc(x.trainer || '')}: "${esc(x.comment || '')}"</small></span></div>`).join('')}</div>`;
}
ACTIONS['cr-decide'] = el => {
  const x = checkRideQueue().filter((r: any) => r.id === el.getAttribute('data-id'))[0]; if (!x || x.status !== 'pending') return;
  const i = document.querySelector(`.cr-c[data-id="${x.id}"]`) as HTMLInputElement, ok = el.getAttribute('data-v') === '1';
  const why = (i && i.value.trim()) || (ok ? 'Well flown.' : 'Not up to the standard yet. Fly it again.');
  _crComment = ''; checkRideDecide(x, ok, why, (coopMe() as any).name);
};

/* ---------- Pilot of the Month and staff awards ---------- */
const AWARD_KINDS: [string, string][] = [['potm', 'Pilot of the Month'], ['landing', 'Best landing'], ['helpful', 'Most helpful'], ['events', 'Event star'], ['service', 'Long service']];
function awardsOf(id: string): any[] { const S: any = State; return ((S.pilotAwards || []) as any[]).concat(crewRoom().awards || []).filter(a => a.to === id); }
function _addAward(a: any) { if (coopOn()) crewRoom().awards.push(a); else { const S: any = State; (S.pilotAwards = S.pilotAwards || []).push(a); } }
/** Single player: the month's best hired pilot (at least 5 landings): best flight scores and softest landings. */
function potmPickAi(month: string): { p: any; why: string } {
  const recs = Ratings.list().filter((r: any) => r.kind === 'ai' && _monthKey(r.at) === month), by: { [id: string]: any[] } = {};
  recs.forEach((r: any) => (by[r.who] = by[r.who] || []).push(r));
  let best: any = null, bs = -1;
  for (const id of Object.keys(by)) {
    const l = by[id]; if (l.length < 5) continue; const p: any = pilot(id); if (!p || p.companyId !== State.companyId) continue;
    const sc = l.filter(r => r.score != null), avgS = sc.length ? sc.reduce((s, r) => s + r.score, 0) / sc.length : 85, avgF = l.reduce((s, r) => s + r.fpm, 0) / l.length;
    const v = avgS * 0.6 + clamp(100 - (avgF - 60) / 3, 0, 100) * 0.3 + Math.min(10, l.length / 3);
    if (v > bs) { bs = v; best = { p, why: `${l.length} flights, average flight score ${Math.round(avgS)}, average landing ${Math.round(avgF)} fpm` }; }
  }
  return best;
}
/** Co-op: members vote during the month; at the end the most votes wins (ties: most hours flown). */
function potmVoteHtml(): string {
  const cr = crewRoom(), m = _monthKey(), v = (cr.votes[m] = cr.votes[m] || {}), me: any = coopMe(), mine = v[me.id];
  const tally: { [id: string]: number } = {}; Object.keys(v).forEach(k => tally[v[k]] = (tally[v[k]] || 0) + 1);
  const owner = (me || {}).role === 'owner' || coopCan('chief');
  return `<div class="card"><div class="card-h"><b>Pilot of the Month: ${esc(_monthName(m))}</b><small>One vote each; the winner is announced on the 1st</small></div>
    ${coopState().members.filter((x: any) => !x.you).map((x: any) => `<div class="ev-row"><span><b>${esc(x.name)} ${x.nat ? flag(x.nat) : ''}</b><small>${esc(coopRankOf(x).name)} · ${hours(x.hoursMin)}${tally[x.id] ? ' · ' + tally[x.id] + ' vote' + (tally[x.id] > 1 ? 's' : '') : ''}${awardsOf(x.id).length ? ' · ' + awardsOf(x.id).length + ' award' + (awardsOf(x.id).length > 1 ? 's' : '') : ''}</small></span><button class="btn ${mine === x.id ? 'primary' : 'ghost'} sm" data-act="potm-vote" data-id="${esc(x.id)}">${mine === x.id ? icon('check') + 'Your vote' : 'Vote'}</button></div>`).join('')}
    ${owner ? `<h3>Give an award</h3><div class="fs-fields"><label class="field"><span>Pilot</span><select class="le-in aw-to">${coopState().members.map((x: any) => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('')}</select></label><label class="field"><span>Award</span><select class="le-in aw-k">${AWARD_KINDS.slice(1).map(a => `<option value="${a[0]}">${a[1]}</option>`).join('')}</select></label><label class="field"><span>Why</span><input class="le-in aw-why" maxlength="140" placeholder="For the perfect crosswind landing at EKVG"></label></div><div class="modal-actions"><button class="btn primary" data-act="aw-give">${icon('trophy')}Give the award</button></div>` : ''}
    ${(cr.awards || []).slice(-6).reverse().map((a: any) => `<div class="ev-row"><span><b>${icon('trophy')} ${esc(a.title)}: ${esc(_member(a.to).name || a.name || '')}</b><small>${esc(a.why)} · ${esc(a.by)}</small></span></div>`).join('')}</div>`;
}
ACTIONS['potm-vote'] = el => { const cr = crewRoom(), m = _monthKey(), me: any = coopMe(); (cr.votes[m] = cr.votes[m] || {})[me.id] = el.getAttribute('data-id'); Store.save(); Sound.tick(); refresh(); };
ACTIONS['aw-give'] = () => {
  const to = ($('.aw-to') as HTMLSelectElement).value, k = ($('.aw-k') as HTMLSelectElement).value, why = (($('.aw-why') as HTMLInputElement).value || '').trim();
  if (!why) { toast('Say why the award is given', 'warn'); return; }
  const title = AWARD_KINDS.filter(a => a[0] === k)[0][1], m: any = coopMember(to), me: any = coopMe();
  _addAward({ id: uid(), to, name: m.name, kind: k, title, why, by: me.name, at: Date.now() });
  coopPost('crew', `${me.name} gave ${m.name} the "${title}" award: ${why}`); Store.save(); refresh(); toast(`${title} given to ${m.name}`, 'ok');
};
/** The month ended: Pilot of the Month (single player: your best hired pilot; co-op: the vote). */
function potmMonthEnd(month: string) {
  const c = company();
  if (coopOn()) {
    const cr = crewRoom(), v = cr.votes[month] = cr.votes[month] || {};
    // demo members vote too: for the pilot who flew the most
    coopState().members.filter((m: any) => !m.you && !v[m.id]).forEach((m: any) => { const o = coopState().members.filter((x: any) => x.id !== m.id).sort((a: any, b: any) => (b.flights + Math.random() * 6) - (a.flights + Math.random() * 6))[0]; if (o) v[m.id] = o.id; });
    const tally: { [id: string]: number } = {}; Object.keys(v).forEach(k => tally[v[k]] = (tally[v[k]] || 0) + 1);
    const win = Object.keys(tally).sort((a, b) => tally[b] - tally[a] || (_member(b).hoursMin || 0) - (_member(a).hoursMin || 0))[0]; if (!win) return null;
    const m: any = coopMember(win), why = `${tally[win]} of ${Object.keys(v).length} votes from the co-op`;
    _addAward({ id: uid(), to: win, name: m.name, kind: 'potm', title: 'Pilot of the Month', why: `${_monthName(month)}: ${why}`, by: 'The co-op', at: Date.now() });
    coopPost('crew', `Pilot of the Month for ${_monthName(month)}: ${m.name}, with ${why}!`);
    if (m.you) State.notices.unshift({ id: uid(), kind: 'staff', title: `You are Pilot of the Month!`, body: `${_monthName(month)}: ${why}.`, time: 'Now', at: Date.now(), read: false } as any);
    try { newsPost(c, c.hub, { section: 'Aviation', headline: `${m.name} named Pilot of the Month`, standfirst: `The ${c.name} co-op picked its pilot of ${_monthName(month)}.`, body: [`${m.name} received ${why}.`, `"It's an honour to fly with this crew," ${m.name.split(' ')[0]} said.`] }); } catch (e) { /* ignore */ }
    return { name: m.name, why };
  }
  const best = potmPickAi(month); if (!best) return null;
  const p = best.p; p.awards = p.awards || [];
  _addAward({ id: uid(), to: p.id, name: p.name, kind: 'potm', title: 'Pilot of the Month', why: `${_monthName(month)}: ${best.why}`, by: c.name, at: Date.now() });
  State.notices.unshift({ id: uid(), kind: 'staff', title: `Pilot of the Month: ${p.name}`, body: `${_monthName(month)}: ${best.why}. Tap to give a bonus.`, time: 'Now', at: Date.now(), read: false, ref: 'va-potm-' + p.id } as any);
  try { newsPost(c, c.hub, { section: 'Aviation', headline: `${c.name} names its Pilot of the Month`, standfirst: `${p.name} topped the airline's pilots in ${_monthName(month)}.`, body: [`${best.why}.`] }); } catch (e) { /* ignore */ }
  return { name: p.name, why: best.why };
}
function potmBonusPopup(pid: string) {
  const p: any = pilot(pid); if (!p) return;
  openLayer('modal', `<div class="modal-head"><div><h2>Pilot of the Month</h2><small>${esc(p.name)}</small></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
    <div class="modal-body"><p class="lede">${esc((awardsOf(p.id).filter(a => a.kind === 'potm').pop() || {} as any).why || '')}</p><div class="btn-row">${[0, 1000, 2500, 5000].map(v => `<button class="btn ${v ? 'primary' : 'ghost'}" data-act="potm-bonus" data-id="${esc(p.id)}" data-v="${v}">${v ? 'Bonus ' + money(v) : 'Just the award'}</button>`).join('')}</div></div>`, { cls: 'narrow' });
}
ACTIONS['potm-bonus'] = el => {
  const p: any = pilot(el.getAttribute('data-id')), v = +el.getAttribute('data-v'); if (!p) return;
  if (v) { payTxn(State.companyId, `Pilot of the Month bonus: ${p.name}`, -v, 'salary', [['Bonus', -v]]); p.bonusMood = Date.now(); }
  closeAll(); Store.save(); toast(v ? `${p.name.split(' ')[0]} gets a ${money(v)} bonus` : 'Award given', 'ok');
};

/* ---------- screenshots ---------- */
// Pictures you take in the simulator, added to a flight. Kept on this device (not in the backup file).
const PhotoDb = {
  _db: null as Promise<IDBDatabase>,
  db(): Promise<IDBDatabase> {
    if (this._db) return this._db;
    this._db = new Promise((ok, no) => { try { const r = indexedDB.open('amp-photos', 1); r.onupgradeneeded = () => { const s = r.result.createObjectStore('photos', { keyPath: 'id' }); s.createIndex('log', 'log'); }; r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); } catch (e) { no(e); } });
    return this._db;
  },
  put(p: any): Promise<void> { return this.db().then(d => new Promise<void>((ok, no) => { const t = d.transaction('photos', 'readwrite'); t.objectStore('photos').put(p); t.oncomplete = () => ok(); t.onerror = () => no(t.error); })); },
  all(): Promise<any[]> { return this.db().then(d => new Promise<any[]>((ok, no) => { const r = d.transaction('photos').objectStore('photos').getAll(); r.onsuccess = () => ok((r.result || []).sort((a: any, b: any) => b.at - a.at)); r.onerror = () => no(r.error); })); },
  del(id: string): Promise<void> { return this.db().then(d => new Promise<void>(ok => { const t = d.transaction('photos', 'readwrite'); t.objectStore('photos').delete(id); t.oncomplete = () => ok(); })); },
};
function photoStrip(logId: string): string { setTimeout(photosFill, 0); return `<div class="ph-strip" data-log="${esc(logId)}"></div>`; }
function photosFill() {
  const els = Array.from(document.querySelectorAll('.ph-strip:not(.filled)')) as HTMLElement[]; if (!els.length) return;
  PhotoDb.all().then(all => {
    for (const el of els) {
      const k = el.getAttribute('data-log'), mine = (k === '*' ? all.filter(p => p.mode === (Mode.coop() ? 'coop' : 'solo')).slice(0, 12) : all.filter(p => p.log === k));
      el.classList.add('filled');
      el.innerHTML = mine.map(p => `<button class="ph-th" data-act="ph-open" data-id="${esc(p.id)}"><img src="${p.thumb}" alt="${esc(p.cap || 'Screenshot')}"></button>`).join('') + (k !== '*' ? `<label class="ph-add">${icon('plus')}<span>Screenshots</span><input type="file" accept="image/*" multiple class="ph-in" data-log="${esc(k)}" hidden></label>` : mine.length ? '' : '<small class="muted">Add screenshots to your flights from their log.</small>');
    }
  }).catch(() => els.forEach(el => { el.classList.add('filled'); el.innerHTML = '<small class="muted">Screenshots can\'t be stored on this device.</small>'; }));
}
function _shrink(file: File, max: number, q: number): Promise<{ data: string; w: number; h: number }> {
  return new Promise((ok, no) => { const url = URL.createObjectURL(file), im = new Image(); im.onload = () => { const s = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url); ok({ data: c.toDataURL('image/jpeg', q), w: c.width, h: c.height }); }; im.onerror = no; im.src = url; });
}
document.addEventListener('change', e => {
  const el = e.target as HTMLInputElement; if (!el || !el.classList || !el.classList.contains('ph-in') || !el.files) return;
  const log = el.getAttribute('data-log'), l: any = State.logbook.filter(x => x.id === log)[0], files = Array.from(el.files).slice(0, 8);
  Promise.all(files.map(f => Promise.all([_shrink(f, 1600, 0.85), _shrink(f, 320, 0.7)]).then(([big, th]) => PhotoDb.put({ id: uid(), log, at: Date.now(), data: big.data, thumb: th.data, w: big.w, h: big.h, cap: l ? `${l.from} → ${l.to}, ${String(l.date).slice(0, 10)}` : '', mode: Mode.coop() ? 'coop' : 'solo' }))))
    .then(() => { document.querySelectorAll('.ph-strip').forEach(x => x.classList.remove('filled')); photosFill(); toast(`${files.length} screenshot${files.length > 1 ? 's' : ''} added`, 'ok'); })
    .catch(() => toast('The screenshots could not be saved', 'warn'));
});
ACTIONS['ph-open'] = el => {
  const id = el.getAttribute('data-id');
  PhotoDb.all().then(all => {
    const p = all.filter(x => x.id === id)[0]; if (!p) return;
    const inContest = coopOn() && (crewRoom().photos || []).some((x: any) => x.photo === id && x.month === _monthKey());
    openLayer('modal', `<div class="modal-head"><div><h2>Screenshot</h2><small>${esc(p.cap || '')}</small></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
      <div class="modal-body"><img class="ph-big" src="${p.data}" alt="${esc(p.cap || 'Screenshot')}"><div class="modal-actions">${coopOn() && !inContest ? `<button class="btn primary" data-act="pc-enter" data-id="${esc(id)}">${icon('trophy')}Enter the photo contest</button>` : ''}<button class="btn ghost" data-act="ph-del" data-id="${esc(id)}">${icon('trash')}Delete</button></div></div>`, { cls: 'wide' });
  });
};
ACTIONS['ph-del'] = el => { PhotoDb.del(el.getAttribute('data-id')).then(() => { closeAll(); document.querySelectorAll('.ph-strip').forEach(x => x.classList.remove('filled')); photosFill(); refresh(); }); };

/* ---------- the photo contest (co-op) ---------- */
function _demoPhotoArt(seed: string): string {
  const r = seeded(seed), h1 = Math.floor(r() * 360), h2 = (h1 + 40) % 360, y = 40 + r() * 40, rot = -10 + r() * 20;
  return `<svg viewBox="0 0 160 100" class="pc-art"><defs><linearGradient id="g${seed.length}${Math.floor(r() * 1e5)}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${h1},60%,45%)"/><stop offset="1" stop-color="hsl(${h2},70%,75%)"/></linearGradient></defs><rect width="160" height="100" fill="hsl(${h1},55%,55%)"/><rect y="${70 + r() * 10}" width="160" height="40" fill="hsl(${(h1 + 180) % 360},25%,${25 + r() * 15}%)"/><g transform="translate(${50 + r() * 50},${y}) rotate(${rot})" fill="#fff"><path d="M-30 0 L28 -2 Q34 0 28 2 L-30 1 Z"/><path d="M-4 0 L-14 -16 L-8 -16 L8 0 Z"/><path d="M-4 1 L-14 16 L-8 16 L8 1 Z"/><path d="M-28 0 L-34 -9 L-30 -9 L-22 0 Z"/></g></svg>`;
}
function photoContestHtml(): string {
  const cr = crewRoom(), m = _monthKey(), list = (cr.photos || []).filter((x: any) => x.month === m), me: any = coopMe();
  // the demo co-op's pilots enter pictures of their own as the month goes on
  if (coopState().backend === 'demo') { const want = Math.min(5, Math.floor(new Date().getDate() / 5) + 1), others = coopState().members.filter((x: any) => !x.you); while (list.filter((x: any) => !x.photo).length < want && others.length) { const o: any = others[list.length % others.length], x = { id: uid(), month: m, by: o.id, name: o.name, title: ['Golden hour over the fjord', 'Final approach in the rain', 'Night stop', 'Above the clouds', 'Winter ops'][list.length % 5], votes: Math.floor(Math.random() * 4) }; (cr.photos = cr.photos || []).push(x); list.push(x); } }
  const myVote = (cr.pcVote || {})[m];
  return `<div class="card"><div class="card-h"><b>Photo contest: ${esc(_monthName(m))}</b><small>Enter a screenshot from one of your flights; the winner is announced on the 1st</small></div>
    <div class="pc-grid">${list.map((x: any) => `<div class="pc-item"><div class="pc-pic" data-pc="${esc(x.photo || '')}">${x.photo ? '' : _demoPhotoArt(x.id)}</div><span><b>${esc(x.title || 'Screenshot')}</b><small>${esc(x.name)} · ${x.votes + (myVote === x.id ? 1 : 0)} vote${x.votes + (myVote === x.id ? 1 : 0) === 1 ? '' : 's'}</small></span>${x.by !== me.id ? `<button class="btn ${myVote === x.id ? 'primary' : 'ghost'} sm" data-act="pc-vote" data-id="${esc(x.id)}">${myVote === x.id ? icon('check') + 'Voted' : 'Vote'}</button>` : '<small class="muted">Your entry</small>'}</div>`).join('') || '<p class="muted pad">No entries yet. Open one of your screenshots and enter it.</p>'}</div></div>`;
}
function photoContestFill() {
  const els = Array.from(document.querySelectorAll('.pc-pic[data-pc]:not([data-pc=""]):not(.filled)')) as HTMLElement[]; if (!els.length) return;
  PhotoDb.all().then(all => els.forEach(el => { const p = all.filter(x => x.id === el.getAttribute('data-pc'))[0]; el.classList.add('filled'); el.innerHTML = p ? `<img src="${p.thumb}" alt="">` : ''; })).catch(() => { /* ignore */ });
}
ACTIONS['pc-enter'] = el => {
  const id = el.getAttribute('data-id'), cr = crewRoom(), m = _monthKey(), me: any = coopMe();
  cr.photos = (cr.photos || []).filter((x: any) => !(x.month === m && x.by === me.id));
  PhotoDb.all().then(all => { const p = all.filter(x => x.id === id)[0]; cr.photos.push({ id: uid(), month: m, by: me.id, name: me.name, photo: id, title: p ? p.cap : 'Screenshot', votes: 0 }); coopPost('crew', `${me.name} entered the photo contest`); Store.save(); closeAll(); toast('Entered in this month\'s photo contest', 'ok'); });
};
ACTIONS['pc-vote'] = el => { const cr = crewRoom(); (cr.pcVote = cr.pcVote || {})[_monthKey()] = el.getAttribute('data-id'); Store.save(); Sound.tick(); refresh(); };
function photoContestMonthEnd(month: string) {
  const cr = crewRoom(), list = (cr.photos || []).filter((x: any) => x.month === month); if (!list.length) return;
  const mv = (cr.pcVote || {})[month]; list.forEach((x: any) => { x.total = x.votes + (mv === x.id ? 1 : 0) + Math.floor(Math.random() * 3); });
  const w = list.sort((a: any, b: any) => b.total - a.total)[0];
  coopPost('crew', `Photo of the month for ${_monthName(month)}: "${w.title}" by ${w.name} (${w.total} votes)`);
  _addAward({ id: uid(), to: w.by, name: w.name, kind: 'photo', title: 'Photo of the Month', why: `${_monthName(month)}: "${w.title}"`, by: 'The co-op', at: Date.now() });
}

/* ---------- base transfer requests (co-op) ---------- */
function transfersHtml(): string {
  const cr = crewRoom(), me: any = coopMe(), can = (me || {}).role === 'owner' || coopCan('chief'), bases = companyBases(company().id);
  const pend = (cr.transfers || []).filter((x: any) => x.status === 'pending');
  return `<div class="card"><div class="card-h"><b>Base transfers</b><small>Your base: ${esc(me.base || company().hub)}</small></div>
    ${pend.map((x: any) => `<div class="ev-row"><span><b>${esc(x.name)}: ${esc(x.fromB)} → ${esc(x.toB)}</b><small>${esc(x.why || '')}</small></span>${can && x.by !== me.id ? `<span class="btn-row"><button class="btn primary sm" data-act="tr-do" data-id="${esc(x.id)}" data-v="1">Approve</button><button class="btn ghost sm" data-act="tr-do" data-id="${esc(x.id)}" data-v="0">Decline</button></span>` : '<small class="muted">Waiting</small>'}</div>`).join('')}
    ${me.role !== 'owner' ? `<div class="fs-fields"><label class="field"><span>Move to</span><select class="le-in tr-to">${bases.filter(b => b !== me.base).map(b => `<option value="${esc(b)}">${esc(b)}${apt(b) ? ' · ' + esc(apt(b).city) : ''}</option>`).join('')}</select></label><label class="field"><span>Why</span><input class="le-in tr-why" maxlength="120" placeholder="Closer to home"></label></div>
      <div class="modal-actions"><button class="btn primary" data-act="tr-ask" ${bases.length > 1 && !pend.some((x: any) => x.by === me.id) ? '' : 'disabled'}>${icon('swap')}Request the transfer</button></div>` : '<small class="muted">As the owner you choose your own base.</small>'}
    ${(cr.transfers || []).filter((x: any) => x.status !== 'pending').slice(-4).reverse().map((x: any) => `<div class="ev-row"><span><b>${esc(x.name)}: ${esc(x.fromB)} → ${esc(x.toB)}</b><small>${x.status === 'approved' ? 'Approved' : 'Declined'} by ${esc(x.decidedBy || '')}</small></span></div>`).join('')}</div>`;
}
ACTIONS['tr-ask'] = () => {
  const me: any = coopMe(), to = ($('.tr-to') as HTMLSelectElement).value, why = (($('.tr-why') as HTMLInputElement).value || '').trim(); if (!to) return;
  const x = { id: uid(), by: me.id, name: me.name, fromB: me.base || company().hub, toB: to, why, at: Date.now(), status: 'pending' };
  crewRoom().transfers.push(x); coopPost('crew', `${me.name} asked to move to ${to}`); Store.save(); refresh(); toast('Transfer request sent', 'info');
  if (coopState().backend === 'demo') setTimeout(() => transferDecide(x, Math.random() < 0.8, (coopState().members.filter((m: any) => m.role === 'owner' && !m.you)[0] || { name: 'The owner' }).name), (60 + Math.random() * 120) * 1000);
};
ACTIONS['tr-do'] = el => { const x = (crewRoom().transfers || []).filter((t: any) => t.id === el.getAttribute('data-id'))[0]; if (x) transferDecide(x, el.getAttribute('data-v') === '1', (coopMe() as any).name); };
function transferDecide(x: any, ok: boolean, by: string) {
  if (x.status !== 'pending') return; x.status = ok ? 'approved' : 'declined'; x.decidedBy = by;
  const m: any = coopMember(x.by); if (ok && m) { m.base = x.toB; const p: any = pilot(m.id); if (p) p.base = x.toB; if (m.you) { meCareer().loc = x.toB; } }
  coopPost('crew', `${x.name}'s move to ${x.toB} was ${ok ? 'approved' : 'declined'} by ${by}`);
  if (m && m.you) State.notices.unshift({ id: uid(), kind: 'pilot', title: `Transfer to ${x.toB} ${ok ? 'approved' : 'declined'}`, body: ok ? `Your base is ${x.toB} now; your next flight starts there.` : `${by} declined the move for now.`, time: 'Now', at: Date.now(), read: false } as any);
  Store.save(); try { renderTopbar(); if (State.screen === 'coop') refresh(); } catch (e) { /* ignore */ }
}
/** Demo co-op pilots ask to move now and then. */
function transfersDemoTick() {
  if (!coopOn() || coopState().backend !== 'demo' || Math.random() > 0.004) return;
  const bases = companyBases(company().id); if (bases.length < 2) return;
  const m: any = coopState().members.filter((x: any) => !x.you && x.role !== 'owner')[Math.floor(Math.random() * coopState().members.length)]; if (!m) return;
  const to = bases.filter(b => b !== m.base)[0]; if (!to || (crewRoom().transfers || []).some((t: any) => t.by === m.id && t.status === 'pending')) return;
  const x = { id: uid(), by: m.id, name: m.name, fromB: m.base, toB: to, why: ['Closer to family', 'Want to fly the long routes', 'Moving house', 'Better rosters there'][Math.floor(Math.random() * 4)], at: Date.now(), status: 'pending' };
  crewRoom().transfers.push(x);
  const me: any = coopMe();
  if (me.role === 'owner' || coopCan('chief')) State.notices.unshift({ id: uid(), kind: 'pilot', title: `${m.name} asks to move to ${to}`, body: `${x.why}. Approve or decline under Co-op → Crew room.`, time: 'Now', at: Date.now(), read: false } as any);
  else setTimeout(() => transferDecide(x, Math.random() < 0.7, 'The owner'), 120e3);
}

/* ---------- the Crew room tab (co-op) ---------- */
function crewRoomHtml(): string {
  setTimeout(photoContestFill, 0);
  return sharedCockpitHtml() + checkRidesHtml() + potmVoteHtml() + photoContestHtml() + transfersHtml();
}

/* ---------- NOTAMs ---------- */
// Notices to airmen, made up for the day: a closed runway, a taxiway under works, an ILS out of service,
// a crane near the approach, birds. A closed runway isn't used and an ILS that's out isn't flown.
interface Notam { id: string; kind: 'rwy' | 'ils' | 'twy' | 'crane' | 'birds' | 'apron'; rwy?: string; text: string; until: string }
const _notamCache: { [k: string]: Notam[] } = {};
function notamsFor(icao: string, d?: Date): Notam[] {
  const day = (d || new Date()).toISOString().slice(0, 10), key = icao + day;
  if (_notamCache[key]) return _notamCache[key];
  const r = seeded('notam:' + key), A: any = apt(icao), out: Notam[] = [];
  const rows: any[] = ((typeof World !== 'undefined' && World.runways || {})[icao] || []) as any[];
  if (A && r() < (A.size === 2 ? 0.3 : 0.15)) {
    const n = 1 + (r() < 0.35 ? 1 : 0), hh = String(14 + Math.floor(r() * 9)).padStart(2, '0'), until = `${day.slice(5).replace('-', '/')} ${hh}00Z`;
    for (let i = 0; i < n; i++) {
      const k = r();
      if (k < 0.2 && rows.length > 1) { const rw = rows[Math.floor(r() * rows.length)]; out.push({ id: icao + 'R' + i, kind: 'rwy', rwy: `${rw[0]}/${rw[1]}`, text: `Runway ${rw[0]}/${rw[1]} closed for maintenance`, until }); }
      else if (k < 0.42 && rows.length) { const rw = rows[Math.floor(r() * rows.length)], e = r() < 0.5 ? rw[0] : rw[1]; out.push({ id: icao + 'I' + i, kind: 'ils', rwy: String(e), text: `ILS runway ${e} out of service; expect an RNP approach`, until }); }
      else if (k < 0.65) { const t = 'ABCDEFGHKLMNPRSTWYZ'[Math.floor(r() * 19)]; out.push({ id: icao + 'T' + i, kind: 'twy', text: `Taxiway ${t} closed between ${t}${1 + Math.floor(r() * 4)} and ${t}${5 + Math.floor(r() * 4)} (works)`, until }); }
      else if (k < 0.8) out.push({ id: icao + 'C' + i, kind: 'crane', text: `Crane ${150 + Math.floor(r() * 250)} ft high, ${(0.8 + r() * 1.6).toFixed(1)} nm on the final approach, lit at night`, until });
      else if (k < 0.92) out.push({ id: icao + 'B' + i, kind: 'birds', text: 'Increased bird activity around the airport, especially at dawn and dusk', until });
      else out.push({ id: icao + 'A' + i, kind: 'apron', text: `Stands ${1 + Math.floor(r() * 20)} to ${21 + Math.floor(r() * 10)} closed; expect a remote stand`, until });
    }
  }
  _notamCache[key] = out; return out;
}
function notamRwyClosed(icao: string, id1: string, id2: string): boolean { return notamsFor(icao).some(n => n.kind === 'rwy' && n.rwy === `${id1}/${id2}`); }
function notamIlsOut(icao: string, end: string): boolean { return notamsFor(icao).some(n => n.kind === 'ils' && n.rwy === String(end)); }
function notamHtml(icaos: string[]): string {
  const list = icaos.filter((k, i) => k && icaos.indexOf(k) === i).map(k => [k, notamsFor(k)] as [string, Notam[]]).filter(x => x[1].length);
  return list.map(([k, ns]) => `<div class="card brief notam">${icon('radio')}<span><b>NOTAMs for ${esc(k)}${apt(k) ? ', ' + esc(apt(k).name) : ''}</b>${ns.map(n => `<small>${esc(n.text)} (until ${esc(n.until)})</small>`).join('')}</span></div>`).join('');
}
