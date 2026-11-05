// Crew pop-ups: staff details, conduct reports, co-pilot, birthday greeting, connection panel and weights.

function natLabel(code: string): string { return code ? `${flag(code)} ${esc(countryName(code))}` : ''; }

function personRole(p: any): CrewRole {
  if (p.role) return p.role;
  return /first officer/i.test(p.rank || '') ? 'fo' : 'captain';
}

/* ---------- Staff card used in lists ---------- */
function staffCard(p: any, i: number, opts?: { hire?: boolean }): string {
  const role = personRole(p);
  return `<button class="staff-card ${opts && opts.hire ? 'hire' : ''}" data-act="${opts && opts.hire ? 'hire-staff' : 'staff-detail'}" data-id="${p.id}" style="--i:${i}">
    <span class="sc-av">${avatarSvg(p.look, role, { view: 'bust', accent: company().color })}</span>
    <span class="sc-txt"><b>${esc(p.name)}</b><small>${levelChip(p) + ' '}${role === 'ground' ? esc(groundJobName(p)) : opts && opts.hire ? roleNameOf(p) : esc(isWinchOp(p) ? 'Winch operator' : levelTitle(p))}, ${flag(p.nat || 'GB')} ${ageOf(p.dob)}</small>
      <small>${opts && opts.hire ? `${esc(apt(p.base) ? apt(p.base).city : p.base)}, ${money(p.salary)}/wk` : `${esc(p.base)}, ${money(p.salary)}/wk`}</small></span>
    ${p.warnings ? `<i class="warn-dot" title="${p.warnings} warning${p.warnings > 1 ? 's' : ''}">${p.warnings}</i>` : ''}
    ${opts && opts.hire ? `<span class="sc-hire">${icon('plus')}Hire</span>` : ''}
  </button>`;
}

/* ---------- Staff details ---------- */
ACTIONS['staff-detail'] = el => openStaff(el.getAttribute('data-id'));
function openStaff(id: string) {
  const p = staffById(id); if (!p) return;
  const role = personRole(p), editable = role === 'fa' || role === 'mech';
  const isCo = !!p.coPilotFor;
  Sound.tick();
  openLayer('modal', `
    <div class="staff-pop">
      <div class="sp-stage"><div class="le-spot"></div>${avatarSvg(p.look, role, { accent: company().color })}</div>
      <div class="sp-info">
        <div class="modal-head"><div><h2>${esc(p.name)}</h2><small>${roleNameOf(p)}${isCo ? ', your co-pilot' : ''}</small></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
        <div class="kv-row">
          <div><small>Nationality</small><b>${natLabel(p.nat)}</b></div>
          <div><small>Age</small><b>${ageOf(p.dob)}</b></div>
          <div><small>Base</small><b>${esc(p.base)}</b></div>
          ${role === 'fa' ? (() => { const regs = (State.fleet || []).filter((a: any) => a.companyId === p.companyId && planeCabinCrew(a.reg).some((x: any) => x.id === p.id)).map((a: any) => a.reg); return `<div><small>Flies on</small><b>${regs.length ? esc(regs.join(', ')) : 'Not on an aircraft yet'}</b></div>`; })() : ''}
          <div><small>Salary</small><b>${money(p.salary)}/wk</b></div>
          <div><small>Rating</small><b>${(p.rating || 4).toFixed(1)} ★</b></div>
          ${p.you ? '' : (l => `<div class="kv-lvl"><small>Level ${l.level} of ${LEVEL_MAX}</small><b>${esc(levelTitle(p))}</b><span class="lvl-bar"><i style="width:${(l.p * 100).toFixed(0)}%"></i></span><small>${num(p.xp || 0)} XP${l.to > l.from ? ` · ${num(l.to - (p.xp || 0))} to level ${l.level + 1}` : ' · highest level'}</small></div>`)(levelOf(p.xp))}
          ${p.you ? '' : `<button class="kv-btn" data-act="mood-open" data-id="${esc(p.id)}"><small>Mood</small><b class="${staffMood(p) < 40 ? 'amber' : staffMood(p) >= 62 ? 'green' : ''}">${esc(moodWord(staffMood(p)))} ${staffMood(p)}%${icon('chevron')}</b></button>`}
          ${typeof isSick === 'function' && isSick(p) ? `<button class="kv-btn" data-act="sick-open" data-id="${esc(p.id)}"><small>Health</small><b class="amber">Off sick${icon('chevron')}</b></button>` : ''}
          ${p.onStrike ? `<div><small>Status</small><b class="amber">On strike</b></div>` : ''}
          ${p.warnings ? `<button class="kv-btn" data-act="warn-open" data-id="${esc(p.id)}"><small>Conduct</small><b class="amber">${p.warnings} warning${p.warnings > 1 ? 's' : ''}${icon('chevron')}</b></button>` : `<div><small>Conduct</small><b class="green">Clean record</b></div>`}
        </div>
        ${warnHistory(p)}
        <div class="modal-actions">
          ${editable ? `<button class="btn ghost" data-act="edit-staff-look" data-id="${p.id}">${icon('user')}Change look</button>` : ''}
          ${isCo ? `<button class="btn ghost" data-act="copilot-sex">${icon('swap')}Male or female</button>` : ''}
          ${p.you || isCo ? '' : `<button class="btn ghost" data-act="xfer-open" data-id="${p.id}">${icon('swap')}Transfer</button>`}
          ${role === 'fa' && !isWinchOp(p) && !p.winchFrom ? `<button class="btn ghost" data-act="winch-train" data-id="${p.id}">${icon('plus')}Winch training</button>` : role === 'fa' && p.winchFrom > Date.now() ? `<button class="btn ghost" disabled>Winch training until ${new Date(p.winchFrom).toLocaleDateString()}</button>` : ''}
          ${p.you ? '' : `<button class="btn ghost" data-act="commend-open" data-id="${p.id}">${icon('trophy')}Commend</button>`}
          <button class="btn danger" data-act="dismiss-ask" data-id="${p.id}">Dismiss</button>
        </div>
      </div>
    </div>`, { cls: 'wide staff-modal' });
}

/** Train a flight attendant as a rescue winch operator: 12 days and a course fee. */
ACTIONS['winch-train'] = el => {
  const p: any = staffById(el.getAttribute('data-id')); if (!p) return;
  const c = company(p.companyId), cost = 14500;
  if (c.balance < cost) { toast(`Winch training costs ${money(cost)}`); return; }
  p.winchFrom = Date.now() + 12 * 864e5;
  payTxn(c.id, `Winch operator course: ${p.name}`, -cost, 'training', [['Hoist and rescue training', -Math.round(cost * 0.7)], ['Medical and survival course', -(cost - Math.round(cost * 0.7))]]);
  Store.save(); closeTop(); toast(`${p.name} starts the winch operator course: ready in 12 days`); openStaff(p.id);
};
ACTIONS['edit-staff-look'] = el => {
  const p = staffById(el.getAttribute('data-id')); if (!p) return;
  closeTop();
  openLookEditor({ title: `${p.name}'s look`, role: personRole(p), look: p.look, confirmName: p.name, onAccept: look => { p.look = look; Store.save(); refresh(); toast('Look saved', 'ok'); } });
};

ACTIONS['dismiss-ask'] = el => {
  const p = staffById(el.getAttribute('data-id')); if (!p) return;
  const beg = dismissMood(p);
  openLayer('modal', `${beg ? `<div class="dis-beg">${avatarSvg(p.look, personRole(p), { accent: company().color, mood: beg })}<p class="speech">${esc(['Please, don\'t do this. I\'ll change, I promise.', 'I need this job. Give me one more chance, please.', 'I know I messed up. It won\'t happen again, I swear.', 'Please, think of my family. One more chance.', 'Please, please. I\'ll do anything to make it right.'][beg.v])}</p></div>` : ''}<div class="modal-head del-head"><span class="sc-av mini">${avatarSvg(p.look, personRole(p), { view: 'bust', still: true })}</span><div><h2>Dismiss ${esc(p.name)}?</h2><small>Are you sure? You'll need to hire a replacement.</small></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
    <div class="modal-body"><p class="lede warn">${icon('alert')}${personRole(p) === 'mech' ? 'Without enough mechanics, some aircraft can\'t fly.' : personRole(p) === 'fa' ? 'Airliners can\'t fly without the flight attendants they need.' : 'Two-pilot aircraft can\'t fly without a co-pilot.'}</p>
    <div class="modal-actions"><button class="btn ghost" data-act="close-layer">Keep ${esc(p.name.split(' ')[0])}</button><button class="btn danger" data-act="dismiss-do" data-id="${p.id}">Yes, dismiss</button></div></div>`, { cls: 'narrow' });
};
ACTIONS['dismiss-do'] = el => dismissStaff(el.getAttribute('data-id'));

function dismissStaff(id: string, incId?: string) {
  const S: any = State;
  const p = staffById(id); if (!p) return;
  if (p.coPilotFor) {
    const cp = S.coPilot[p.coPilotFor]; cp.gen = (cp.gen || 0) + 1;
    State.pilots.splice(State.pilots.indexOf(p), 1);
    const np = ensureCoPilot(p.coPilotFor);
    closeAll(); Store.save(); refresh();
    toast(`${p.name} dismissed. ${np ? np.name + ' is your new co-pilot.' : ''}`, 'warn');
    return;
  }
  const inStaff = S.staff.indexOf(p) >= 0, idx = inStaff ? S.staff.indexOf(p) : State.pilots.indexOf(p);
  if (inStaff) S.staff.splice(idx, 1);
  else State.pilots.splice(idx, 1);
  const inc0 = incId ? S.incidents.filter((x: Incident) => x.id === incId)[0] : null, incSt = inc0 ? inc0.status : '';
  if (inc0) inc0.status = 'dismissed';
  const goneN = State.notices.filter(n => incId && n.ref === incId);
  State.notices = State.notices.filter(n => n.ref !== incId);
  closeAll(); Haptics.pulse(30); Store.save(); refresh();
  undoToast(`${p.name} dismissed. Hire a replacement under Crew → Hire staff.`, () => { if (inStaff) S.staff.splice(Math.min(idx, S.staff.length), 0, p); else State.pilots.splice(Math.min(idx, State.pilots.length), 0, p); if (inc0) inc0.status = incSt; State.notices = State.notices.concat(goneN); }, 'warn');
}
ACTIONS['go-hire'] = el => {
  const t = el.closest('.toast'); if (t) t.remove(); _pilotTab = 'hire'; _hireRole = el.getAttribute('data-id') || 'all';
  // already in Crew: just the hiring list (no page change, no flash); then straight down to it
  if (State.screen === 'pilots' && !document.querySelector('.layer')) { Sound.tick(); refresh(); } else { closeAll(); go('pilots'); }
  // (after the page has drawn the list: a second look in case it was drawn again)
  const down = (smooth: boolean) => { const tb = document.querySelector('.tabs.big') as HTMLElement; if (!tb) return; tb.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' }); tb.classList.add('hire-flash'); setTimeout(() => tb.classList.remove('hire-flash'), 1400); };
  setTimeout(() => down(true), 150); setTimeout(() => { const tb = document.querySelector('.tabs.big') as HTMLElement; if (tb && tb.getBoundingClientRect().top > window.innerHeight * 0.5) down(false); }, 700);
};

/** Warnings so far, by severity: "2 light, 1 severe". */
function warnSummary(p: any): string {
  const w = p.warnLog || [], n = (k: string) => w.filter((x: any) => x.sev === k).length;
  const old = (p.warnings || 0) - w.length;   // warnings given before severities were recorded
  const parts = [n('severe') ? n('severe') + ' severe' : '', n('moderate') + Math.max(0, old) ? (n('moderate') + Math.max(0, old)) + ' moderate' : '', n('light') ? n('light') + ' light' : ''].filter(Boolean);
  return parts.length ? parts.join(', ') : 'none';
}
function warnHistory(p: any): string {
  const w = (p.warnLog || []).slice().reverse();
  if (!w.length && !p.warnings) return '';
  return `<div class="warn-hist"><small>Warnings: ${esc(warnSummary(p))}${p.learned ? `, improved after ${p.learned}` : ''}${p.stubborn ? `, ignored ${p.stubborn}` : ''}</small>
    ${w.slice(0, 6).map((x: any) => `<span class="wh-row sev-${x.sev}"><i>${esc(x.sev)}</i>${esc(x.title)}<em>${esc(x.date)}</em></span>`).join('')}</div>`;
}

/* ---------- Conduct reports ---------- */
const INCIDENTS: { [role: string]: string[][] } = {
  fa: [['Late for duty', '{n} arrived late for the pre-flight briefing at {b}, and boarding started 15 minutes behind schedule.', 'light'],
    ['Rude to a passenger', 'A passenger complained that {n} was dismissive and rude during the meal service.', 'moderate'],
    ['Skipped a safety check', '{n} signed off the cabin safety check without checking the emergency equipment.', 'severe'],
    ['Argument with a colleague', '{n} had a loud argument with another crew member in the galley, in front of passengers.', 'moderate']],
  ground: [['Late for the turnaround', '{n} arrived late at the aircraft at {b}, and the bags were loaded 15 minutes behind schedule.', 'light'],
    ['Drove too fast on the apron', '{n} was seen driving a vehicle well over the apron speed limit near parked aircraft at {b}.', 'moderate'],
    ['Hit an aircraft with a vehicle', '{n} reversed a vehicle into an aircraft door at {b}. The aircraft needed an inspection before it could fly.', 'severe'],
    ['Threw passengers\' bags', 'Passengers filmed {n} throwing their suitcases onto the belt loader at {b}.', 'moderate'],
    ['Left a vehicle unattended', '{n} left a vehicle running and unattended next to an aircraft at {b}.', 'light']],
  mech: [['Missed a deadline', '{n} didn\'t finish a scheduled inspection on time, so an aircraft left {b} 40 minutes late.', 'moderate'],
    ['Tools left on the apron', '{n} left a toolbox on the apron at {b}. Ramp staff found it before it caused damage.', 'severe'],
    ['Paperwork not signed', '{n} returned an aircraft to service without completing the maintenance paperwork.', 'severe'],
    ['Late for shift', '{n} turned up an hour late for the night shift at {b}.', 'light']],
  fo: [['Late for the flight', '{n} reported for duty late, and the departure from {b} was delayed.', 'light'],
    ['Checklist shortcuts', 'The flight data shows {n} skipped parts of the before-take-off checklist.', 'severe'],
    ['Unprofessional radio calls', 'ATC filed a complaint about {n}\'s radio manners on a recent flight.', 'light']],
};
const MISCONDUCT_P: { [k: string]: number } = { never: 0, rare: 0.02, normal: 0.07, often: 0.2 };

/** How often conduct reports happen overall (Settings → Staff → Conduct): 0 never … 3 normal (a third fewer than
 * before) … 4 often; it scales the chances set for each kind of staff. */
const CONDUCT_LEVEL_K = [0, 0.3, 0.5, 0.67, 1.2];
function conductLevel(): number { const v = (State.settings as any).conductLevel; return v == null ? 3 : clamp(Math.round(+v), 0, 4); }
/** How many conduct reports a day: most days none; on a day with one it is usually one or two, now and then
 *  three; a few days pass in between. Settings → Staff → Conduct makes them rarer or more frequent. The day's
 *  reports come at random times through the day. */
function conductPlanToday(): any {
  const S: any = State, day = dateStr(new Date()).slice(0, 10);
  if (S.conductPlan && S.conductPlan.day === day) return S.conductPlan;
  const lvl = conductLevel(), pDay = [0, 0.08, 0.17, 0.3, 0.55][lvl], r = Math.random();
  let n = 0;
  if (Math.random() < pDay) n = r < 0.68 ? 1 : r < 0.94 ? 2 : 3;
  if (n && lvl >= 4 && Math.random() < 0.35) n++;
  // never two report days in a row unless reports are set to often
  if (n && lvl < 4 && S.conductPlan && S.conductPlan.n > 0 && S.conductPlan.day === dateStr(new Date(Date.now() - 864e5)).slice(0, 10)) n = 0;
  const now = Date.now(), end = new Date(); end.setHours(23, 0, 0, 0);
  const span = Math.max(30 * 60e3, end.getTime() - now), at: number[] = [];
  for (let k = 0; k < n; k++) at.push(now + 10 * 60e3 + Math.random() * span);
  at.sort((a, b) => a - b);
  S.conductPlan = { day, n, at };
  return S.conductPlan;
}
/** How bad it is: usually light, sometimes moderate, now and then severe. */
function conductSeverity(): 'light' | 'moderate' | 'severe' { const r = Math.random(); return r < 0.72 ? 'light' : r < 0.94 ? 'moderate' : 'severe'; }
function maybeIncident() {
  const S: any = State;
  if (!conductOn()) return;   // switched off in Settings: nothing new happens, nothing is removed
  const plan = conductPlanToday(); if (!plan.at.length || Date.now() < plan.at[0]) return;
  plan.at.shift(); Store.soon();
  const cid = State.companyId;
  // the AI crew only: hired pilots, co-pilots, flight attendants and mechanics (never you); who it is follows
  // the per-kind settings (Settings → Staff), and well-rated staff are less likely to be the one
  const roles: string[] = ['fa', 'mech', 'ground', 'fo', 'pilot'];
  const me = myPilot(), cands: { r: string; who: any; w: number }[] = [];
  for (const r of roles) {
    const p = MISCONDUCT_P[S.settings.misconduct[r === 'pilot' ? 'fo' : r]] || 0; if (!p) continue;
    const pool = (r === 'fo' ? State.pilots.filter((x: any) => x.coPilotFor === cid)
      : r === 'pilot' ? State.pilots.filter((x: any) => x.companyId === cid && !x.coPilotFor && x !== me && x.id !== 'you' && x.status !== 'off')
      : staffOf(cid, r as CrewRole)).filter((x: any) => !x.suspended);
    for (const who of pool as any[]) cands.push({ r, who, w: p * conductFactor(workRating(who)) * Math.pow(0.6, who.learned || 0) * (1 + 0.5 * (who.stubborn || 0)) });
  }
  const tot = cands.reduce((a, c) => a + c.w, 0); if (!tot) return;
  let x = Math.random() * tot, pick = cands[0]; for (const c of cands) { x -= c.w; if (x <= 0) { pick = c; break; } }
  const r = pick.r, who: any = pick.who, sev = conductSeverity();
  // very rarely it's a crime: police, the aviation authority and a court case (only on a severe day)
  if (sev === 'severe' && maybeCriminal(who, r)) return;
  const list = INCIDENTS[r === 'pilot' ? 'fo' : r], same = list.filter(t => (t[2] || 'moderate') === sev), from = same.length ? same : list;
  const t = from[Math.floor(Math.random() * from.length)];
  const inc: Incident = { id: uid(), staffId: who.id, sev: (same.length ? sev : (t[2] || 'moderate')) as any, title: t[0], text: t[1].replace('{n}', who.name).replace('{b}', who.base), date: dateStr(new Date()).slice(0, 10), at: Date.now(), status: 'open' } as any;
  S.incidents.unshift(inc);
  try { Voice.prepare(inc.text, 'ops'); } catch (e) { /* not ready */ }
  // being late, skipping work and the like costs rating (and for mechanics, the quality of their work)
  who.rating = clamp(Math.round(((who.rating || 3.5) - (inc.sev === 'severe' ? 0.3 : inc.sev === 'moderate' ? 0.15 : 0.08)) * 100) / 100, 1, 5);
  State.notices.unshift({ id: 'n-' + inc.id, kind: 'staff' as any, title: `Conduct report: ${who.name}`, body: `${t[0]}. Discipline or dismiss.`, time: 'Now', at: Date.now(), read: false, ref: inc.id } as any);
  renderTopbar(); Sound.chime(); Store.soon();
  toast(`Conduct report: ${who.name}`, 'warn', { label: 'Open', act: 'open-incident', data: inc.id });
}
function startConductClock() { setInterval(maybeIncident, 4 * 60 * 1000); }

/** How the person looks in the report: furious after violence (hitting someone, throwing bags, a fight), one of ten ways. */
function incidentMood(inc: any): { kind: string; v: number } {
  const t = String((inc && (inc.title + ' ' + inc.text)) || '');
  if (!/hit|struck|strike|punch|slap|kick|assault|attack|fight|violen|threw|thrown|throw|hurl|smash|slam|shov|push|grab|threat|rough|aggress/i.test(t)) return undefined;
  return { kind: 'angry', v: Math.floor(cloudHash(String(inc.id || '').length * 31 + t.length, t.charCodeAt(0) || 1, 5) * 10) };
}
/** Someone with serious trouble on record, about to be dismissed: begging to keep the job, one of five ways. */
function dismissMood(p: any): { kind: string; v: number } {
  const inc = ((State as any).incidents || []).filter((x: any) => x.staffId === p.id && (x.sev === 'severe' || incidentMood(x)))[0];
  if (!inc && !(p.warnings >= 2)) return undefined;
  return { kind: 'beg', v: Math.floor(Math.random() * 5) };
}
ACTIONS['inc-court'] = el => {
  const inc = ((State as any).incidents || []).filter((x: any) => x.id === el.getAttribute('data-id'))[0]; if (!inc || !courtReportable(inc)) return;
  const p = staffById(inc.staffId), c = courtBringCase(inc); closeAll();
  if (c) toast(`${p.name} is reported to the police. You will be called to court as a witness.`, 'warn');
};
ACTIONS['open-incident'] = el => { const t = el.closest('.toast'); if (t) t.remove(); incidentPopup(el.getAttribute('data-id')); };
function incidentPopup(id: string) {
  const inc = (State as any).incidents.filter((x: Incident) => x.id === id)[0]; if (!inc) return;
  const p = staffById(inc.staffId);
  if (!p) { toast('This person no longer works for you', 'info'); return; }
  closeAll();
  const role = personRole(p);
  openLayer('modal', `
    <div class="inc">
      <div class="inc-av">${avatarSvg(p.look, role, { accent: company().color, mood: incidentMood(inc) })}</div>
      <div class="inc-main">
        <div class="modal-head"><div><small>Conduct report, ${esc((inc as any).at ? atText((inc as any).at) : inc.date)}</small><h2>${esc(inc.title)}</h2></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
        <div class="say-row">${voiceButton(inc.text + conductDetailSpeech(inc, p), 'ops', 'Play the report')}${voiceNoteEl('Head of operations')}</div>
        <p class="speech">${esc(inc.text)}</p>
        ${conductDetailHtml(inc, p)}
        ${inc.status === 'open' ? `<button class="btn ghost of-invite" data-act="office-invite" data-id="${inc.id}">${icon('user')}Invite ${esc(p.name.replace(/^Capt\.\s*/, '').split(/\s+/)[0])} to my office</button>` : ''}
        ${courtReportable(inc) ? `<button class="btn ghost of-invite" data-act="inc-court" data-id="${inc.id}">${icon('alert')}Report ${esc(p.name.replace(/^Capt\.\s*/, '').split(/\s+/)[0])} to the police</button>` : ''}
        <div class="inc-who"><b>${esc(p.name)}</b><small>${ROLE_NAMES[role]}, ${natLabel(p.nat)}, ${ageOf(p.dob)}, base ${esc(p.base)}</small><small class="${p.warnings ? 'amber' : ''}">${p.warnings ? `Already ${p.warnings} warning${p.warnings > 1 ? 's' : ''} on record: ${esc(warnSummary(p))}` : 'No earlier warnings'}</small><small>This report: <b class="sev-${inc.sev || 'moderate'}">${esc(inc.sev || 'moderate')}</b></small></div>
        ${warnHistory(p)}
        ${inc.status === 'open' ? `<div class="decide">
          ${(inc as any).revolt || (p.warnings || 0) >= 1 ? `<button class="decide-card" data-act="discipline" data-id="${inc.id}" data-strong="1"><b>${(inc as any).revolt ? 'Stronger warning' : 'Final warning'}</b><small>A final written warning. More likely to sink in, but ${(p.warnings || 0) >= 2 ? 'passengers and staff notice when someone stays on after warning after warning' : 'some people push back'}.</small></button>` : ''}
          ${(inc as any).revolt ? '' : `<button class="decide-card" data-act="discipline" data-id="${inc.id}"><b>Discipline</b><small>A formal warning on their record. They stay on the team.${(p.warnings || 0) >= 2 ? ' Passengers start to notice repeated warnings.' : ''}</small></button>`}
          <button class="decide-card bad" data-act="dismiss-inc" data-id="${inc.id}"><b>Dismiss</b><small>They leave the company. You'll need to hire a replacement.</small></button>
        </div>` : `<p class="lede">${icon('check')}Handled: ${inc.status}.</p>`}
      </div>
    </div>`, { cls: 'wide' });
}
ACTIONS.discipline = el => {
  const inc = (State as any).incidents.filter((x: Incident) => x.id === el.getAttribute('data-id'))[0]; if (!inc) return;
  const p = staffById(inc.staffId);
  if (p) {
    p.warnings = (p.warnings || 0) + 1;
    // a warning costs experience: light 2 levels' worth early on, severe much more; it can go below zero
    p.xp = Math.round((p.xp || 0) - ({ light: 400, moderate: 1500, severe: 5000 } as any)[inc.sev || 'moderate']);
    p.warnLog = (p.warnLog || []).concat([{ date: inc.date, title: inc.title, sev: inc.sev || 'moderate', text: inc.text, inc: inc.id, given: Date.now() }]);
    p.rating = clamp(Math.round(((p.rating || 3.5) - (inc.sev === 'severe' ? 0.4 : inc.sev === 'light' ? 0.1 : 0.25)) * 100) / 100, 1, 5);
    // whether it sinks in shows over the next hours (see warnings.ts)
    if (el.getAttribute('data-strong') === '1') p.warnLog[p.warnLog.length - 1].final = true;
    try { warnGiven(p, inc, el.getAttribute('data-strong') === '1'); } catch (e) { /* ignore */ }
  }
  inc.status = 'disciplined';
  State.notices = State.notices.filter(n => n.ref !== inc.id);
  closeAll(); Sound.tick(); Store.save(); refresh();
  toast(`${p ? p.name : 'Staff member'} has been given a ${el.getAttribute('data-strong') === '1' ? 'final' : 'formal'} warning`, 'ok');
};
ACTIONS['dismiss-inc'] = el => {
  const inc = (State as any).incidents.filter((x: Incident) => x.id === el.getAttribute('data-id'))[0]; if (!inc) return;
  dismissStaff(inc.staffId, inc.id);
};

/* ---------- Co-pilot ---------- */
ACTIONS['copilot-sex'] = () => {
  const cid = State.companyId, cp = (State as any).coPilot[cid];
  const cur = State.pilots.filter((p: any) => p.coPilotFor === cid)[0];
  closeAll();
  openLookEditor({ title: 'Your co-pilot', role: 'fo', look: cur ? cur.look : defaultLook(cp.sex, 'fo'), sexOnly: true, confirmName: cur ? cur.name : undefined,
    onAccept: look => {
      cp.sex = look.sex; cp.gen = (cp.gen || 0) + 1;
      const p: any = ensureCoPilot(cid);
      if (p) p.look = Object.assign({}, look); // keep exactly the look shown, cap included
      Store.save(); refresh(); toast('Co-pilot updated', 'ok');
    } });
};

/* ---------- Hire ---------- */
ACTIONS['hire-staff'] = el => {
  const S: any = State;
  const id = el.getAttribute('data-id');
  const p = S.staffCandidates.filter((x: Staff) => x.id === id)[0]; if (!p) return;
  const c = company();
  openLayer('modal', `
    <div class="staff-pop">
      <div class="sp-stage"><div class="le-spot"></div>${avatarSvg(p.look, p.role, { accent: c.color })}</div>
      <div class="sp-info">
        <div class="modal-head"><div><h2>Hire ${esc(p.name)}?</h2><small>${roleNameOf(p)}</small></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
        <div class="kv-row">
          <div><small>Nationality</small><b>${natLabel(p.nat)}</b></div>
          <div><small>Age</small><b>${ageOf(p.dob)}</b></div>
          <div><small>Rating</small><b>${p.rating.toFixed(1)} ★</b></div>
          <div><small>Salary</small><b>${money(p.salary)}/wk</b></div>
          <div><small>Based at</small>${(p.role === 'mech' || p.role === 'ground') && apronAirports(c.id).length > 1 ? `<select class="le-in hire-base">${apronAirports(c.id).map(k => `<option value="${k}" ${k === c.hub ? 'selected' : ''}>${k}, ${esc(apt(k) ? apt(k).city || apt(k).name : k)}</option>`).join('')}</select>` : `<b>${esc(c.hub)}</b>`}</div>
        </div>
        <p class="lede">${icon('info')}The salary is paid from ${esc(c.name)}'s balance every week.</p>
        <div class="modal-actions"><button class="btn ghost" data-act="close-layer">Not now</button>
          ${p.role !== 'fo' ? `<button class="btn ghost" data-act="hire-look" data-id="${p.id}">${icon('user')}Change look</button>` : ''}
          <button class="btn primary" data-act="hire-do" data-id="${p.id}">${icon('plus')}Hire for ${money(p.salary)}/wk</button></div>
      </div>
    </div>`, { cls: 'wide staff-modal' });
};
ACTIONS['hire-look'] = el => {
  const p = (State as any).staffCandidates.filter((x: Staff) => x.id === el.getAttribute('data-id'))[0]; if (!p) return;
  closeTop();
  openLookEditor({ title: `${p.name}'s look`, role: p.role, look: p.look, onAccept: look => { p.look = look; ACTIONS['hire-staff']({ getAttribute: () => p.id } as any, null); } });
};
ACTIONS['hire-do'] = el => {
  const S: any = State;
  const id = el.getAttribute('data-id');
  const p = S.staffCandidates.filter((x: Staff) => x.id === id)[0]; if (!p) return;
  const c = company();
  S.staffCandidates = S.staffCandidates.filter((x: Staff) => x.id !== id);
  const hb = $('.hire-base') as HTMLSelectElement;
  if (p.role === 'mech' || p.role === 'ground') {
    const where = hb && hb.value ? hb.value : c.hub;
    if (isBase(c.id, where)) {
      const lim = apronLimits(c.id, where), have = staffOf(c.id, p.role).filter((x: any) => x.base === where && !x.apronLeave).length, max = p.role === 'mech' ? lim.mech : lim.ground;
      if (have >= max) { toast(`${where} has room for ${max} ${p.role === 'mech' ? 'mechanics' : 'ground staff'} with the aircraft based there (you have ${have})`, 'warn'); return; }
    }
  }
  p.companyId = c.id; p.base = hb && hb.value ? hb.value : c.hub; p.hired = dateStr(new Date()).slice(0, 10); p.status = 'on duty';
  chargeHiring(p);
  if (p.role === 'fo') State.pilots.push({ id: p.id, name: p.name, rank: 'First officer', hoursMin: 1500 * 60, landings: 900, base: c.hub, salary: p.salary, rating: p.rating, status: 'standby', types: (() => { const ft = State.fleet.filter(a => a.companyId === c.id && multiCrew(acType(a.typeId))).map(a => a.typeId); return ft.length ? [ft[_hashStr(p.id) % ft.length]] : []; })(), sex: p.sex, nat: p.nat, dob: p.dob, look: p.look, companyId: c.id, warnings: 0, rules: { maxDutyHrs: 10, maxLandingFpm: 500, ifrOnly: true, homeBaseReturn: true } } as any);
  else S.staff.push(p);
  // the hiring list refills over time (staffing.ts)
  closeAll(); Haptics.success(); Store.save(); refresh();
  toast(`${p.name} joined ${c.name}`, 'ok');
};

/* ---------- Birthday ---------- */
function checkBirthday() {
  const S: any = State;
  const now = companyDate();
  const pr = profileOfCompany(State.companyId), me: any = pilot(pr.pilotId);
  if (!me || !me.dob) return;
  const p = me.dob.split('-').map(Number);
  const key = me.id;
  if (p[1] === now.getMonth() + 1 && p[2] === now.getDate() && S.birthdayGreeted[key] !== now.getFullYear()) {
    S.birthdayGreeted[key] = now.getFullYear();
    State.notices.unshift({ id: uid(), kind: 'birthday' as any, title: `Happy birthday, ${me.name.replace(/^Capt\.\s*/, '')}!`, body: `Everyone at ${company().name} wishes you a great day. ${ageOf(me.dob)} today.`, time: 'Today', read: false });
    renderTopbar(); Store.soon();
    setTimeout(() => birthdayPopup(me), 1800);
  }
}
function birthdayPopup(me: any) {
  const age = ageOf(me.dob);
  // a thank-you bow, once for each birthday
  const S: any = State, yr = companyDate().getFullYear(); S.birthdayBowed = S.birthdayBowed || {};
  const bow = S.birthdayBowed[me.id] !== yr; if (bow) { S.birthdayBowed[me.id] = yr; Store.soon(); }
  const confetti = Array.from({ length: 36 }, (_, i) => `<i style="--x:${Math.random() * 100}%;--d:${(Math.random() * 1.2).toFixed(2)}s;--r:${Math.round(Math.random() * 360)}deg;--c:${['#3FD0E8', '#E04BD6', '#F2B33D', '#3DDC97', '#FF7A7E', '#9C7CFF'][i % 6]}"></i>`).join('');
  Sound.chime(); Haptics.success();
  openLayer('modal', `
    <div class="bday">
      <div class="bday-confetti">${confetti}</div>
      <div class="bday-av">${avatarSvg(me.look, 'captain', Object.assign({ accent: company().color }, bow ? { mood: { kind: 'bow', v: Math.floor(Date.now() / 1000) } } : {}))}</div>
      <div class="bday-txt">
        <small>${esc(company().name)}</small>
        <h2>Happy birthday, ${esc(me.name.replace(/^Capt\.\s*/, ''))}!</h2>
        <p class="muted">${age} today. The whole crew wishes you smooth air and soft landings.</p>
        <div class="modal-actions"><button class="btn primary" data-act="close-layer">Thank you</button></div>
      </div>
    </div>`, { cls: 'narrow bday-pop' });
}
ACTIONS['bday-preview'] = () => { const me: any = pilot(profileOfCompany(State.companyId).pilotId); closeAll(); birthdayPopup(me); };

/** Phone notification on your birthday, also when the app is closed (real-world calendar only). */
function scheduleBirthdayNotification() {
  const cap = (window as any).Capacitor, LN = cap && cap.Plugins && cap.Plugins.LocalNotifications;
  if (!LN) return;
  const me: any = pilot(profileOfCompany(State.companyId).pilotId);
  if (!me || !me.dob) return;
  const p = me.dob.split('-').map(Number);
  const name = me.name.replace(/^Capt\.\s*/, '');
  Promise.resolve(LN.requestPermissions ? LN.requestPermissions() : null).then(() => {
    LN.cancel({ notifications: [{ id: 4401 }] }).catch(() => { /* none scheduled yet */ });
    if (State.settings.timeMode !== 'real') return;
    LN.schedule({ notifications: [{ id: 4401, title: `Happy birthday, ${name}!`, body: `Everyone at ${company().name} wishes you a great day.`, schedule: { on: { month: p[1], day: p[2], hour: 9, minute: 0 }, allowWhileIdle: true } }] });
  }).catch(() => { /* notifications not allowed */ });
}

/* ---------- Connection panel: same Wi-Fi, or the PC on the phone's hotspot ---------- */
ACTIONS['link-panel'] = async () => {
  Sound.tick(); closeAll();
  const wi = await Link.wifiInfo(true);
  const bars = Math.max(0, Math.min(4, wi.level || 0));
  const hs = !!wi.hotspot, hsName = wi.hotspotKind === 'usb' ? 'USB tethering' : 'hotspot';
  const where = hs && !wi.wifi ? 'your ' + hsName : esc(wi.ssid || 'your Wi-Fi') + (hs ? ' and your ' + hsName : '');
  const wrap = openLayer('modal', `
    <div class="modal-head"><div><h2>Connection</h2><small>The app links to the PC that runs Flight Simulator over your Wi-Fi, or over your phone's hotspot.</small></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
    <div class="modal-body link">
      ${hs ? `<div class="ln-card ok"><span class="ln-ic">${icon('cell')}</span><span><b>Phone ${hsName} on</b><small>This phone ${esc(wi.hotspotIp || '')}. A PC connected to it uses your mobile data.</small></span></div>` : ''}
      ${!hs || wi.wifi ? `<div class="ln-card ${wi.wifi ? 'ok' : ''}"><span class="ln-ic">${icon('wifi')}</span><span><b>${wi.wifi ? esc(wi.ssid || 'Wi-Fi') : 'Not on Wi-Fi'}</b><small>${wi.wifi ? `Wi-Fi${wi.ip ? ', this phone ' + esc(wi.ip) : ''}${wi.ssid ? '' : (lanPlugin() ? '. Allow location access to show the network name' : '')}` : 'Connect this phone to the same Wi-Fi as your PC, or turn on your hotspot'}</small></span>
        <span class="bars">${[1, 2, 3, 4].map(i => `<i class="${i <= bars ? 'on' : ''}" style="height:${i * 4 + 2}px"></i>`).join('')}</span></div>` : ''}
      <div class="ln-radar"><div class="rd"><i></i><i></i><i></i><span class="sweep"></span><b class="pc-dot"></b></div>
        <div class="ln-scan" data-scan><b>Scanning ${where} for the PC app…</b><small>Make sure the ${esc(APP.shortName)} PC app is running next to Flight Simulator.</small></div></div>
      <div data-pcs></div>
      ${hs ? '' : `<div class="ln-card"><span class="ln-ic">${icon('cell')}</span><span><b>Mobile data</b><small>${wi.cellular ? 'On. ' : ''}To link over mobile data, turn on this phone's hotspot and connect the PC to it.</small></span></div>`}
      <p class="fine-print">${icon('info')}The phone and the PC must be on the same Wi-Fi, or the PC connected to your phone's hotspot.${hs ? ' The link itself uses about 5 MB an hour; Flight Simulator streams scenery and can use far more, which you can limit in its Data settings.' : ''}</p>
    </div>`, { cls: 'narrow link-pop' });
  linkScan(wrap);
};

async function linkScan(wrap: HTMLElement) {
  const sc = $('[data-scan]', wrap), list = $('[data-pcs]', wrap);
  const pcs = await Link.discover();
  if (!wrap.isConnected) return;
  const cur = Link.pc;
  if (pcs.length) wrap.querySelector('.ln-radar').classList.add('found');
  sc.innerHTML = pcs.length ? `<b>${icon('check')}Found ${pcs.length === 1 ? esc(pcs[0].pcName) : pcs.length + ' PCs'}</b><small>Tap your PC to link it.</small>`
    : `<b>No PC app found yet</b><small>Start the ${esc(APP.shortName)} PC app on the PC with Flight Simulator, then <button class="text-btn" data-act="link-rescan">scan again</button>.</small>`;
  list.innerHTML = pcs.map(p => {
    const isCur = cur && cur.name === p.pcName, on = isCur && Link.status === 'connected';
    const simTxt = on && Link.sim ? (Link.sim.connected ? `${esc(Link.sim.sim)} running${Link.sim.gsx.running ? ', GSX Pro detected' : ''}` : 'Flight Simulator not running') : `PC app ${esc(p.version)}`;
    return `<button class="ln-card ln-pc ${on ? 'ok' : ''}" data-act="link-pick" data-ip="${esc(p.ip)}" data-name="${esc(p.pcName)}">
      <span class="ln-ic">${icon('pc')}</span><span><b>${esc(p.pcName)}</b><small>${esc(p.ip)}, ${simTxt}</small></span>
      <span class="ln-go">${on ? `${icon('check')}Linked` : isCur ? 'Reconnect' : 'Link'}</span></button>`;
  }).join('') + `<button class="text-btn ln-manual" data-act="link-manual">Enter the PC's address instead</button>`;
}
ACTIONS['link-rescan'] = el => { const w = el.closest('.layer') as HTMLElement; const sc = $('[data-scan]', w); sc.innerHTML = '<b>Scanning…</b>'; linkScan(w); };

ACTIONS['link-pick'] = el => {
  const ip = el.getAttribute('data-ip'), name = el.getAttribute('data-name');
  if (Link.pc && Link.pc.name === name) {
    if (Link.status === 'connected') return;
    (State as any).linkPc.ip = ip;
    el.querySelector('.ln-go').textContent = 'Connecting…';
    Link.connect(ip).then(r => { if (r.ok) closeAll(); else el.querySelector('.ln-go').textContent = 'Try again'; });
    return;
  }
  pairPopup(ip, name);
};

ACTIONS['link-manual'] = () => {
  closeAll();
  openLayer('modal', `<div class="modal-head"><div><h2>PC address</h2><small>Shown in the PC app's window, for example 192.168.1.24</small></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
    <div class="modal-body"><input class="le-in" data-ip-in inputmode="decimal" placeholder="192.168.1.24" autocomplete="off">
    <p class="fine-print" data-ip-err></p>
    <div class="modal-actions"><button class="btn ghost" data-act="close-layer">Cancel</button><button class="btn primary" data-act="link-manual-go">Continue</button></div></div>`, { cls: 'narrow' });
  setTimeout(() => { const i = $('[data-ip-in]') as HTMLInputElement; if (i) i.focus(); }, 300);
};
ACTIONS['link-manual-go'] = async () => {
  const ip = (($('[data-ip-in]') as HTMLInputElement).value || '').trim();
  const err = $('[data-ip-err]');
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) { err.innerHTML = `${icon('alert')}That doesn't look like an address. Use four numbers with dots.`; return; }
  err.innerHTML = 'Checking…';
  try {
    const ctl = new AbortController(); setTimeout(() => ctl.abort(), 2500);
    const j = await (await fetch(`http://${ip}:${LINK_PORT}/info`, { signal: ctl.signal })).json();
    closeAll(); pairPopup(ip, j.pcName || ip);
  } catch (e) { err.innerHTML = `${icon('alert')}No PC app answered at ${esc(ip)}. Check that it's running and on the same Wi-Fi or your phone's hotspot.`; }
};

function pairPopup(ip: string, name: string) {
  closeAll();
  openLayer('modal', `<div class="modal-head"><div><h2>Link ${esc(name)}</h2><small>Enter the 6-digit code shown in the PC app's window.</small></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
    <div class="modal-body pair">
      <div class="pair-code entry">${[0, 1, 2, 3, 4, 5].map(i => `${i === 3 ? '<i></i>' : ''}<input class="pc-digit" data-d="${i}" inputmode="numeric" maxlength="1" autocomplete="one-time-code" aria-label="Digit ${i + 1}">`).join('')}</div>
      <p class="fine-print" data-pair-err></p>
      <div class="modal-actions center"><button class="btn ghost" data-act="close-layer">Cancel</button><button class="btn primary" data-act="pair-go" data-ip="${esc(ip)}">${icon('check')}Link</button></div>
    </div>`, { cls: 'narrow pair-pop' });
  const digits = $all('.pc-digit');
  digits.forEach((d, i) => {
    d.addEventListener('input', () => {
      const v = (d as HTMLInputElement).value.replace(/\D/g, '');
      if (v.length > 1) { v.split('').slice(0, 6 - i).forEach((ch, k) => (digits[i + k] as HTMLInputElement).value = ch); }
      else (d as HTMLInputElement).value = v;
      const next = digits[Math.min(5, i + Math.max(1, v.length))]; if (v && next) next.focus();
      if (digits.every(x => (x as HTMLInputElement).value)) ACTIONS['pair-go']($('[data-act=pair-go]'), null);
    });
    d.addEventListener('keydown', (e: KeyboardEvent) => { if (e.key === 'Backspace' && !(d as HTMLInputElement).value && i > 0) digits[i - 1].focus(); });
  });
  setTimeout(() => digits[0] && digits[0].focus(), 350);
}
ACTIONS['pair-go'] = async el => {
  const code = $all('.pc-digit').map(x => (x as HTMLInputElement).value).join('');
  const err = $('[data-pair-err]');
  if (code.length < 6) { err.innerHTML = `${icon('info')}Enter all 6 digits.`; return; }
  err.innerHTML = 'Linking…';
  const r = await Link.connect(el.getAttribute('data-ip'), code);
  if (r.ok) { closeAll(); Haptics.success(); }
  else { err.innerHTML = `${icon('alert')}${esc(r.reason || 'Linking failed.')}`; $all('.pc-digit').forEach(x => (x as HTMLInputElement).value = ''); const f = $('.pc-digit'); if (f) f.focus(); }
};

/* ---------- Weights ---------- */
function kg(n: number): string { return State.settings.units === 'metric' ? num(n) + ' kg' : num(n) + ' kg'; }
ACTIONS.weights = () => {
  const L: any = (State as any).myLoad;
  const paxW = L.pax * L.paxKg;
  const total = L.emptyKg + paxW + L.bagsKg + L.cargoKg + L.mailKg + L.fuelKg;
  const pct = Math.min(100, total / L.mtowKg * 100);
  const rows: [string, number, string][] = [['Empty aircraft', L.emptyKg, '#5D7590'], [`Passengers, ${L.pax} × ${L.paxKg} kg`, paxW, '#3FD0E8'], ['Baggage', L.bagsKg, '#4DA3FF'], ['Cargo', L.cargoKg, '#9C7CFF'], ['Mail', L.mailKg, '#E04BD6'], ['Fuel', L.fuelKg, '#F2B33D']];
  const fuelOk = L.fuelKg >= L.tripFuelKg + L.reserveKg;
  Sound.tick();
  openLayer('modal', `
    <div class="modal-head"><div><h2>Weights, ${esc(State.myReg[State.companyId])}</h2><small>Read from Flight Simulator${L.source === 'gsx' ? ', boarding numbers from GSX Pro' : ', no GSX: from the sim\'s own payload data'}</small></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
    <div class="modal-body wt">
      <div class="wt-bar">${rows.map(r => `<i style="width:${(r[1] / L.mtowKg * 100).toFixed(2)}%;background:${r[2]}"></i>`).join('')}<span class="mtow" style="left:100%"></span></div>
      <div class="wt-top"><b>${kg(total)}</b><small>of ${kg(L.mtowKg)} maximum take-off weight (${pct.toFixed(0)}%)</small></div>
      ${rows.map(r => `<div class="wt-row"><i style="background:${r[2]}"></i><span>${r[0]}</span><b>${kg(r[1])}</b></div>`).join('')}
      <div class="wt-fuel ${fuelOk ? 'ok' : 'bad'}">${icon(fuelOk ? 'check' : 'alert')}<span>${fuelOk ? 'Enough fuel' : 'Not enough fuel'}: trip ${kg(L.tripFuelKg)} plus reserves ${kg(L.reserveKg)}</span></div>
      <span class="src-chip">${L.source === 'gsx' ? 'GSX Pro detected' : 'Flight Simulator data'}</span>
    </div>`, { cls: 'narrow' });
};

/* ---------- A person's warnings: what each was for ---------- */
ACTIONS['warn-open'] = el => {
  const p: any = staffById(el.getAttribute('data-id')); if (!p) return;
  Sound.tick();
  const incs: Incident[] = (State as any).incidents || [];
  const log = (p.warnLog || []).slice().reverse().map((w: any) => {
    // older warnings: the report they came from, found by its title and date
    const inc = w.inc ? incs.filter(x => x.id === w.inc)[0] : incs.filter(x => x.staffId === p.id && x.title === w.title && x.date === w.date)[0];
    return Object.assign({}, w, { text: w.text || (inc && inc.text) || '' });
  });
  const older = Math.max(0, (p.warnings || 0) - log.length);
  const sevName: { [k: string]: string } = { light: 'Light', moderate: 'Moderate', severe: 'Severe' };
  const items = log.map((w: any, i: number) => `
    <div class="warn-item sev-${esc(w.sev || 'moderate')}">
      <div class="wi-h"><span class="wi-sev">${esc(sevName[w.sev] || 'Moderate')}</span><b>${esc(w.title)}</b><time>${esc(w.date)}</time></div>
      ${w.text ? `<p>${esc(w.text)}</p>` : '<p class="muted">The report for this warning is no longer kept.</p>'}
      ${w.text ? `<div class="say-row">${voiceButton(`Warning ${log.length - i} for ${p.name}: ${w.title}. ${w.text}`, 'ops', 'Play the report')}</div>` : ''}
    </div>`).join('');
  openLayer('modal', `<div class="modal-head"><div><h2>Warnings: ${esc(p.name)}</h2><small>${esc(warnSummary(p))}${p.learned ? ` · took ${p.learned} to heart` : ''}${p.stubborn ? ` · ignored ${p.stubborn}` : ''}</small></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
    <div class="modal-body warn-list">${items}${older ? `<p class="fine-print">${icon('info')}${older} earlier warning${older > 1 ? 's' : ''} from before reports were kept with each warning.</p>` : ''}</div>`, { cls: 'narrow', onClose: () => Voice.stop() });
};

/* ---------- Commending loyal staff ---------- */
/** Years with the company (from the day they were hired). */
function serviceYears(p: any): number { const t = Date.parse(p.hired || ''); return isFinite(t) ? Math.max(0, (Date.now() - t) / (365.25 * 864e5)) : 0; }
function weeklyPay(p: any): number { return p.salary || 1000; }

const COMMENDS: { id: string; title: string; text: (p: any) => string; cost: (p: any) => number; mood: number }[] = [
  { id: 'thanks', title: 'A personal thank-you', text: p => `A letter from you, read out at the next briefing at ${p.base}.`, cost: () => 0, mood: 6 },
  { id: 'award', title: 'Long-service award', text: p => `A framed award and a pin for ${Math.max(1, Math.floor(serviceYears(p)))} year${Math.floor(serviceYears(p)) === 1 ? '' : 's'} with the company, handed over in front of the team.`, cost: () => 450, mood: 12 },
  { id: 'medal', title: 'Medal of excellence', text: () => 'The company\'s medal for outstanding work, with a dinner for the whole crew room.', cost: () => 1800, mood: 18 },
  { id: 'bonus', title: 'Bonus: a month\'s pay', text: p => `${money(weeklyPay(p) * 4)} on top of the next pay.`, cost: p => weeklyPay(p) * 4, mood: 20 },
  { id: 'days', title: 'Three extra days off', text: () => 'Paid, starting tomorrow. Someone else covers the duties.', cost: p => Math.round(weeklyPay(p) * 0.6), mood: 14 },
  { id: 'trip', title: 'A family holiday on your airline', text: () => 'Them and their family flown to a destination they choose on one of your aircraft, hotel and all paid for by the company.', cost: p => 2500 + 900 * familySize(p), mood: 30 },
];
function familySize(p: any): number { return 2 + (_hashStr(p.id + 'fam') % 3); }

ACTIONS['commend-open'] = el => {
  const p: any = staffById(el.getAttribute('data-id')); if (!p) return;
  closeTop(); Sound.tick();
  const yrs = serviceYears(p), last = (p.commends || []).slice(-3).reverse();
  const dests = Array.from(new Set(State.routes.filter(r => r.companyId === (p.companyId || State.companyId)).reduce((a: string[], r) => a.concat(r.legs), []))).filter(k => apt(k)).slice(0, 14);
  openLayer('modal', `<div class="modal-head"><div><h2>Commend ${esc(p.name)}</h2><small>${yrs >= 1 ? Math.floor(yrs) + ' year' + (Math.floor(yrs) === 1 ? '' : 's') : 'Less than a year'} with the company · mood ${Math.round(staffMood(p))}%</small></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
    <div class="modal-body commend">
      ${COMMENDS.map(c => `<button class="commend-opt" data-act="commend-do" data-id="${esc(p.id)}" data-c="${c.id}"><b>${esc(c.title)}</b><small>${esc(c.text(p))}</small><span>${c.cost(p) ? money(c.cost(p)) : 'Free'}</span></button>`).join('')}
      ${dests.length ? `<div class="le-group"><b>Holiday destination (their choice)</b><select class="le-in commend-dest">${dests.map(k => `<option value="${k}">${k}, ${esc(apt(k).city || apt(k).name)}</option>`).join('')}</select></div>` : ''}
      ${last.length ? `<p class="fine-print">${icon('info')}Earlier: ${last.map((x: any) => esc(x.title + ' (' + x.date + ')')).join(', ')}</p>` : ''}
    </div>`, { cls: 'narrow' });
};
ACTIONS['commend-do'] = el => {
  const p: any = staffById(el.getAttribute('data-id')), c = COMMENDS.filter(x => x.id === el.getAttribute('data-c'))[0]; if (!p || !c) return;
  const cost = c.cost(p), co = company(p.companyId || State.companyId);
  let title = c.title;
  if (c.id === 'trip') { const d = ($('.commend-dest') as HTMLSelectElement); const k = d ? d.value : ''; title = `Family holiday${k ? ' to ' + (apt(k).city || k) : ''}`; p.status = 'off'; p.offUntil = Date.now() + 5 * 864e5; }
  if (c.id === 'days') { p.status = 'off'; p.offUntil = Date.now() + 3 * 864e5; }
  if (cost) payTxn(co.id, `${title}: ${p.name}`, -cost, 'salary', [[title, -cost]]);
  p.commends = (p.commends || []).concat([{ id: c.id, title, date: dateStr(new Date()).slice(0, 10) }]);
  // repeating the same commendation soon after counts for less
  const recent = (p.commends || []).filter((x: any) => x.id === c.id).length;
  staffMoodAdd(p, c.mood / Math.max(1, recent * 0.7), title);
  p.loyalty = clamp((p.loyalty || 50) + c.mood / 2, 0, 100);
  // they come back to you with their thanks a little later
  try { const d = $('.commend-dest') as HTMLSelectElement, k = d ? d.value : ''; thanksQueue(p, c.id, title, k && apt(k) ? apt(k).city : ''); } catch (e) { /* ignore */ }
  closeAll(); Sound.tick(); Store.save(); refresh();
  toast(`${p.name}: ${title.toLowerCase()}${cost ? ', ' + money(cost) : ''}. Mood up.`, 'ok');
};

/** Airports where the airline can keep its own apron crew: its base, and with "every airport", every airport it flies to. */
function apronAirports(cid: string): string[] {
  const set: string[] = companyBases(cid);   // the hub and every base always have your own apron crew
  if ((State.settings as any).groundHandling === 'everywhere') {
    State.routes.filter(r => r.companyId === cid).forEach(r => r.legs.forEach(k => { if (set.indexOf(k) < 0) set.push(k); }));
  }
  return set.filter(k => apt(k));
}
/* ---------- Transfers: to another airport of the airline, or to another of your airlines ---------- */
const XFER_REASONS = ['Needed more there', 'Career step for them', 'Their own request, closer to family', 'Fresh start after a dispute', 'Opening a new base', 'Fewer flights here now', 'Their skills fit that airline better'];
/** Airports a person of this role can be based at: apron staff only where the airline keeps its own apron crew; flying crew anywhere the airline flies. */
function xferAirports(p: any, cid: string): string[] {
  const role = personRole(p);
  if (role === 'mech' || role === 'ground') return apronAirports(cid);
  const c = company(cid), set: string[] = [c.hub];
  State.routes.filter(r => r.companyId === cid).forEach(r => r.legs.forEach(k => { if (set.indexOf(k) < 0) set.push(k); }));
  fleetOf(cid).forEach(a => { if (a.base && set.indexOf(a.base) < 0) set.push(a.base); });
  return set.filter(k => apt(k));
}
/** Room for one more apron worker at that airport (home base limits; other airports have none). */
function xferRoom(p: any, cid: string, icao: string): string {
  const role = personRole(p); if (role !== 'mech' && role !== 'ground') return '';
  if (!isBase(cid, icao)) return '';
  const lim = apronLimits(cid, icao), max = role === 'mech' ? lim.mech : lim.ground;
  const have = staffOf(cid, role).filter((x: any) => x.base === icao && !x.apronLeave && x.id !== p.id).length;
  return have >= max ? `${icao} already has ${have} of ${max} ${role === 'mech' ? 'mechanics' : 'ground staff'} allowed for its size and the aircraft based there.` : '';
}
let _xferTo: 'apt' | 'co' = 'apt';
ACTIONS['xfer-open'] = el => {
  const p: any = staffById(el.getAttribute('data-id')); if (!p) return;
  if (coopOn() && !coopCanBuy()) { toast('In this co-op only the owner transfers staff', 'warn'); return; }
  const cid = p.companyId || State.companyId, apts = xferAirports(p, cid).filter(k => k !== p.base);
  const others = State.companies.filter(c => c.id !== cid);
  if (!apts.length && !others.length) { toast(personRole(p) === 'mech' || personRole(p) === 'ground' ? 'Apron staff work at the home base only. Choose "Own crew at every airport" in Settings to base them elsewhere.' : 'There is nowhere else to transfer them to yet', 'warn'); return; }
  if (!apts.length) _xferTo = 'co'; if (!others.length) _xferTo = 'apt';
  const tab = (k: string, t: string, on: boolean) => `<button class="${_xferTo === k ? 'on' : ''}" data-act="xfer-to" data-k="${k}" data-id="${esc(p.id)}" ${on ? '' : 'disabled'}>${t}</button>`;
  closeTop();
  openLayer('modal', `<div class="modal-head"><div><h2>Transfer ${esc(p.name)}</h2><small>${ROLE_NAMES[personRole(p)]} · now at ${esc(p.base)}, ${esc(company(cid).name)}</small></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
    <span class="seg xfer-seg">${tab('apt', 'Another airport', apts.length > 0)}${tab('co', 'Another airline', others.length > 0)}</span>
    ${_xferTo === 'apt' ? `<label class="field"><span>Airport</span><select class="le-in xfer-apt">${apts.map(k => `<option value="${k}">${k} · ${esc(apt(k).city || apt(k).name)}</option>`).join('')}</select></label>`
      : `<label class="field"><span>Airline</span><select class="le-in xfer-co">${others.map(c => `<option value="${c.id}">${esc(c.name)} · based at ${c.hub}</option>`).join('')}</select></label><p class="fine-print">${icon('info')}They start at the other airline's home base, keep their level, pay and record.</p>`}
    <label class="field"><span>Reason</span><select class="le-in xfer-why">${XFER_REASONS.map(r => `<option>${esc(r)}</option>`).join('')}<option value="">Other (write it below)</option></select></label>
    <label class="field"><span>Note to ${esc(p.name.split(' ')[0])}</span><input class="le-in xfer-note" maxlength="140" placeholder="Optional"></label>
    <div class="modal-actions"><button class="btn ghost" data-act="close-layer">Cancel</button><button class="btn primary" data-act="xfer-do" data-id="${esc(p.id)}">${icon('swap')}Transfer</button></div>`, { cls: 'xfer-modal' });
};
ACTIONS['xfer-to'] = el => { _xferTo = el.getAttribute('data-k') as any; closeTop(); ACTIONS['xfer-open'](el, null); };
ACTIONS['xfer-do'] = el => {
  const p: any = staffById(el.getAttribute('data-id')); if (!p) return;
  const val = (q: string) => { const e = $(q) as HTMLInputElement; return e ? e.value : ''; };
  const why = (val('.xfer-why') || val('.xfer-note') || 'No reason given').trim(), note = val('.xfer-note').trim();
  const fromCo = p.companyId || State.companyId, fromApt = p.base;
  let toCo = fromCo, toApt = fromApt;
  if (_xferTo === 'co') { toCo = val('.xfer-co'); toApt = company(toCo).hub; } else toApt = val('.xfer-apt');
  if (!toApt) return;
  const full = xferRoom(p, toCo, toApt); if (full) { toast(full, 'warn'); return; }
  if (toCo !== fromCo) { p.companyId = toCo; if (p.coPilotFor) p.coPilotFor = null; }
  p.base = toApt; p.apronLeave = false; if (p.status === 'off' && p.leavePay) { p.status = 'on duty'; p.leavePay = false; }
  (p.transfers = p.transfers || []).unshift({ at: Date.now(), fromCo, toCo, fromApt, toApt, why, note });
  // moving is a change: a wanted move lifts the mood a little, a move away from family lowers it
  if (typeof staffMoodAdd === 'function') staffMoodAdd(p, /family|career|request/i.test(why) ? 6 : /dispute|fewer/i.test(why) ? -4 : -1);
  Store.save(); closeAll(); refresh();
  const where = toCo !== fromCo ? `${company(toCo).name} at ${toApt}` : toApt;
  toast(`${p.name} transferred to ${where}`, 'ok');
  State.notices.unshift({ id: uid(), kind: 'staff' as any, title: `${p.name} transferred`, body: `${ROLE_NAMES[personRole(p)]} from ${fromApt}${toCo !== fromCo ? ` (${company(fromCo).name})` : ''} to ${where}. Reason: ${why}.${note ? ` Note: "${note}"` : ''}`, time: 'Now', at: Date.now(), read: false, ref: p.id } as any);
};

/* ---------- Apron crew limits and the change back to "home base only" ---------- */
/** How many mechanics and ground staff the home base supports, by its size and the aircraft based there
 *  (about one turnaround team per aircraft for ground handling, line-maintenance staffing per aircraft
 *  for mechanics, more for bigger aircraft; a bigger airport allows more shifts). */
function apronLimits(cid: string, icao: string): { mech: number; ground: number } {
  const size = typeof aptSize === 'function' ? aptSize(icao) : 1;   // 0 small, 1 regional, 2 large
  const mechPer: { [c: string]: number } = { widebody: 4, airliner: 3, regional: 2, turboprop: 1.5, bush: 1, ga: 0.5 };
  let mech = 0, ground = 0;
  for (const a of fleetOf(cid)) if ((a.base || company(cid).hub) === icao) { const cls = acType(a.typeId).cls; mech += mechPer[cls] || 2; ground += GROUND_PER_BASED[cls] || 8; }
  const shifts = [1, 1.5, 2.2][clamp(size, 0, 2)];
  return { mech: Math.max(2, Math.ceil(mech * shifts) + 1), ground: Math.max(3, Math.ceil(ground * (size >= 2 ? 1.15 : 1)) + 2) };
}
function apronCrewChanged() {
  const S: any = State, cid = State.companyId, c = company(cid);
  if ((S.settings.groundHandling || 'base') !== 'base') {
    // back to every airport: people on leave can come back
    const back = (S.staff || []).filter((p: any) => p.companyId === cid && p.apronLeave);
    back.forEach((p: any) => { p.apronLeave = false; p.status = 'on duty'; });
    if (back.length) toast(`${back.length} on leave back at work at their airports`, 'ok');
    return;
  }
  const away = (S.staff || []).filter((p: any) => p.companyId === cid && (p.role === 'mech' || p.role === 'ground') && !isBase(cid, p.base) && !p.apronLeave);
  if (!away.length) return;
  const lim = apronLimits(cid, c.hub);
  openLayer('modal', `<div class="modal-head"><div><h2>Apron crew at other airports</h2><small>${away.length} people no longer have work under "home base only". Room at ${esc(c.hub)}: ${lim.mech} mechanics, ${lim.ground} ground staff.</small></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
    <div class="modal-body apron-move">
      ${away.map((p: any) => `<div class="am-row" data-id="${p.id}"><span class="sc-av">${avatarSvg2d(p.look, personRole(p), { view: 'bust', still: true })}</span><span><b>${esc(p.name)}</b><small>${esc(personRole(p) === 'ground' ? groundJobName(p) : 'Mechanic')} at ${esc(p.base)}</small></span>
        <select class="le-in am-what"><option value="move">Move to ${esc(c.hub)}</option><option value="leave">Put on leave</option><option value="dismiss">Dismiss</option></select></div>`).join('')}
      <div class="modal-actions"><button class="btn ghost" data-act="am-all" data-v="leave">All on leave</button><button class="btn ghost" data-act="am-all" data-v="dismiss">Dismiss all</button><button class="btn primary" data-act="am-go">${icon('check')}Done</button></div>
      <p class="fine-print">${icon('info')}On leave: kept on half pay without working, back at their airport if you switch to "Every airport" again. Moving is limited by the room at your home base; anyone who doesn't fit goes on leave.</p>
    </div>`, { cls: 'narrow' });
}
ACTIONS['am-all'] = el => { const v = el.getAttribute('data-v'); $all('.am-what').forEach((s: any) => s.value = v); };
ACTIONS['am-go'] = () => {
  const S: any = State, cid = State.companyId, c = company(cid), lim = apronLimits(cid, c.hub);
  let mech = staffOf(cid, 'mech').filter((p: any) => p.base === c.hub).length, ground = staffOf(cid, 'ground').filter((p: any) => p.base === c.hub).length;
  const res = { move: 0, leave: 0, dismiss: 0 } as any;
  for (const row of $all('.am-row') as HTMLElement[]) {
    const p: any = staffById(row.getAttribute('data-id')); if (!p) continue;
    let what = (row.querySelector('.am-what') as HTMLSelectElement).value;
    if (what === 'move') { const isM = p.role === 'mech'; if (isM ? mech < lim.mech : ground < lim.ground) { p.base = c.hub; if (isM) mech++; else ground++; } else what = 'leave'; }
    if (what === 'leave') { p.apronLeave = true; p.status = 'off'; p.leavePay = true; }
    if (what === 'dismiss') { S.staff = S.staff.filter((x: any) => x !== p); }
    res[what]++;
  }
  closeAll(); Store.save(); refresh();
  toast([res.move ? res.move + ' moved' : '', res.leave ? res.leave + ' on leave' : '', res.dismiss ? res.dismiss + ' dismissed' : ''].filter(Boolean).join(', ') || 'Nothing changed', 'ok');
};
