// Schedule: your own legs for the day and a timeline of every aircraft's flights.

interface Block { reg: string; from: string; to: string; start: number; end: number; kind: 'flight' | 'maint'; you?: boolean; code?: string; delayMin?: number; cancelled?: boolean; why?: string; retry?: boolean; sched?: number }
let _schedDay = 0;   // 0 today, 1 tomorrow

function scheduleBlocks(): Block[] {
  const out: Block[] = [];
  const c = company();
  const toMin = (s: string) => parseInt(s.slice(0, 2), 10) * 60 + parseInt(s.slice(3), 10);
  fleetOf().forEach((a, i) => {
    const t = acType(a.typeId);
    if (a.reg === State.myReg[c.id] && State.today.length) {
      if (_schedDay) return;
      State.today.forEach(l => {
        // flown legs use their real block time; others the real-world estimate for this aircraft and route
        const L: any = l, d = L.blockMin || (l.to && apt(l.to) ? flightProfile(a.typeId, l.from, l.to).totalS / 60 : 60);
        out.push({ reg: a.reg, from: l.from, to: l.to || '?', start: toMin(l.dep), end: toMin(l.dep) + d, kind: 'flight', you: true });
      });
      return;
    }
    if (fleetState(a) === 'maint' && !_schedDay) {
      out.push({ reg: a.reg, from: a.location, to: a.location, start: 6 * 60, end: 22 * 60, kind: 'maint' });
      return;
    }
    // hired pilots: the day as they really fly it (see ai-sim.ts)
    const ai = aiDayBlocks(a.reg, _schedDay);
    if (ai.length || State.live.some(f => f.reg === a.reg) || ((State as any).aiNext || []).some((n: any) => n.reg === a.reg)) {
      ai.forEach(b => out.push({ reg: a.reg, from: b.from, to: b.to, start: b.start, end: b.end, kind: 'flight', delayMin: b.delayMin, cancelled: b.cancelled, why: b.why, retry: b.retry, sched: b.sched })); return; }
    const rt = State.routes.filter(r => r.typeId === a.typeId && r.companyId === c.id)[0];
    const legs = rt ? rt.legs : [a.base, a.base];
    let tm = 5 * 60 + (i * 47) % 180;
    for (let k = 0; k < 6 && tm < 22 * 60; k++) {
      const from = legs[k % (legs.length - 1)] || legs[0], to = legs[(k % (legs.length - 1)) + 1] || legs[1];
      const d = Math.max(gcDistanceNm(apt(from).pos, apt(to).pos) / t.cruiseKt * 60 + 25, 40);
      out.push({ reg: a.reg, from, to, start: tm, end: tm + d, kind: 'flight', code: rt ? rt.code : '' });
      tm += d + 50 + (k * 13) % 40;
    }
  });
  return out;
}

// The aircraft whose day is shown at the top: your own by default, or any aircraft tapped in the timeline.
let _schedReg = '';
function schedSelected(): string {
  const fl = fleetOf();
  if (_schedReg && fl.some(a => a.reg === _schedReg)) return _schedReg;
  const mine = State.myReg[State.companyId];
  return fl.some(a => a.reg === mine) ? mine : (fl[0] ? fl[0].reg : '');
}

/** The day for the selected aircraft: past legs, the leg in progress (with how far it has got) and the ones still to come. */
function scheduleDayCard(blocks: Block[], nowMin: number): string {
  const reg = schedSelected(); if (!reg) return '';
  const a = plane(reg), t = acType(a.typeId), mine = reg === State.myReg[State.companyId];
  const hm = (m: number) => { m = Math.round(m) % 1440; const h = Math.floor(m / 60), mm = m % 60; return (h < 10 ? '0' : '') + h + ':' + (mm < 10 ? '0' : '') + mm; };
  const live = State.live.filter(f => f.reg === reg)[0];
  const route = State.routes.filter(r => r.companyId === a.companyId && r.typeId === a.typeId)[0];
  const who = live ? pilot(live.pilotId) : route && route.pilotId ? pilot(route.pilotId) : null;
  const mineLegs = mine && State.today.length;
  const mb = blocks.filter(b => b.reg === reg).sort((x, y) => x.start - y.start);
  let nextSet = false;
  const legs = mb.map((b, i) => {
    let st: string, prog = 0;
    if (mineLegs && State.today[i]) st = State.today[i].status;
    else if (b.kind === 'maint') st = nowMin >= b.start && nowMin <= b.end ? 'active' : nowMin > b.end ? 'done' : 'planned';
    else if (b.cancelled) st = 'cancelled';
    else st = b.end < nowMin ? 'done' : b.start <= nowMin ? 'active' : 'planned';
    if (st === 'active') {
      prog = live && live.from === b.from && live.to === b.to ? live.t : clamp((nowMin - b.start) / ((b.end - b.start) || 1), 0, 1);
    }
    if (st === 'next') nextSet = true;
    if (_schedDay && st !== 'cancelled') st = 'planned';
    return { b, st, prog };
  });
  if (!nextSet) { const n = legs.filter(l => l.st === 'planned')[0]; if (n) n.st = 'next'; }
  const title = mine && !_schedDay ? `Your day in ${esc(reg)}` : `${esc(reg)} ${_schedDay ? 'tomorrow' : 'today'}`;
  const sub = `${esc(t.model)}${who ? ', flown by ' + esc(who.name) : ''}, ${legs.length} ${legs.length === 1 ? 'leg' : 'legs'}`;
  return `<div class="card day-card">
      <div class="card-h"><b>${title}</b><small>${sub}</small><button class="text-btn" data-act="show-aircraft" data-reg="${esc(reg)}">${icon('map')}Show on map</button></div>
      ${legs.length ? `<div class="day-track">${legs.map((l, i) => `<div class="day-leg ${l.st}" style="--i:${i}">
        <time>${hm(l.b.start)}</time><span class="dl-r">${l.b.kind === 'maint' ? `<b>Maintenance at ${esc(l.b.from)}</b>` : `<b>${esc(l.b.from)}</b><i>${l.st === 'active' ? `<em class="dl-prog" style="width:${(l.prog * 100).toFixed(1)}%"></em>` : ''}</i><b>${esc(l.b.to)}</b>`}</span>
        <small>${l.st === 'cancelled' ? 'Cancelled' : l.st === 'done' ? 'Landed' : l.st === 'active' ? (l.b.kind === 'maint' ? 'In the hangar' : 'Flying now') : l.st === 'next' ? 'Next' : 'Planned'}${l.b.retry ? ' · second try' : ''}</small>
        ${schedLateNote(l.b, hm)}${l.st === 'next' && l.b.kind !== 'maint' && !_schedDay ? turnaroundHtml(l.b.reg) : ''}</div>`).join('')}</div>`
      : `<p class="muted">No flights planned for ${esc(reg)} ${_schedDay ? 'tomorrow' : 'today'}.</p>`}
    </div>`;
}

/* ---------- refreshing: by the button, and by itself every 30 seconds ---------- */
const SCHED_EVERY = 30000;
let _schedAt = Date.now();
/** Draw every open schedule again (the app, the laptop, the Operations computer) with the latest flights and delays. */
function schedRefreshAll() {
  _schedAt = Date.now();
  document.querySelectorAll('.screen-schedule, section.screen[data-k="schedule"]').forEach((el: any) => { try { patchHtml(el, SCREENS.schedule.render()); } catch (e) { /* next time */ } });
}
ACTIONS['sched-refresh'] = el => {
  Sound.tick(); schedRefreshAll();
  const b = document.querySelector('.sched-refresh') as HTMLElement; if (b) { b.classList.remove('spin'); void b.offsetWidth; b.classList.add('spin'); }
  toast('Schedule refreshed', 'ok');
};
setInterval(() => {
  if (document.hidden || !document.querySelector('.screen-schedule, section.screen[data-k="schedule"]')) { _schedAt = Math.max(_schedAt, Date.now() - SCHED_EVERY + 1000); return; }
  const left = SCHED_EVERY - (Date.now() - _schedAt);
  if (left <= 0) { schedRefreshAll(); const b = document.querySelector('.sched-refresh') as HTMLElement; if (b) { b.classList.remove('spin'); void b.offsetWidth; b.classList.add('spin'); } }
  const s = String(Math.max(1, Math.ceil((SCHED_EVERY - (Date.now() - _schedAt)) / 1000))) + ' s';
  document.querySelectorAll('[data-sched-next]').forEach((e: any) => { if (e.textContent !== s) e.textContent = s; });
}, 1000);

function schedRepaintDay() {
  const card = $('.day-card'), html = scheduleDayCard(scheduleBlocks(), new Date().getHours() * 60 + new Date().getMinutes());
  if (card && html) { const d = document.createElement('div'); d.innerHTML = html.trim(); const n = d.firstElementChild as HTMLElement; n.style.animation = 'none'; n.querySelectorAll('.day-leg').forEach((x: any) => x.style.animation = 'none'); card.replaceWith(n); }
}
/** Late or cancelled: the planned time, how late, and why. */
function schedLateNote(b: Block, hm: (m: number) => string): string {
  if (b.cancelled) return `<em class="dl-late cxl">Planned ${hm(b.start)}. ${esc(b.why || 'Cancelled')}. Flown the next day at the same time.</em>${crewShortHtml(b)}`;
  if ((b.delayMin || 0) < 5) return '';
  return `<em class="dl-late">${b.delayMin} min late${b.sched != null ? `, planned ${hm(b.sched)}` : ''}${b.why ? '. ' + esc(b.why) : ''}</em>${crewShortHtml(b)}${forceDepHtml(b.reg, b.from, b.to)}`;
}

/** A delay or cancellation for want of people: exactly who is missing, how many are needed, how many there are
 *  and why the rest can't work (sick, on strike, on leave, busy with another aircraft), worked out now. */
function crewShortHtml(b: Block): string {
  if (!b.why || !/crew|sick|pilot|mechanic|cabin|ground|strike|stand-in|cover/i.test(b.why)) return '';
  const a: any = plane(b.reg); if (!a) return '';
  const cid = a.companyId, t = acType(a.typeId), rows: [string, string, string, boolean][] = [];   // what, need/have, why not, short
  const tally = (list: any[]) => { const sick = list.filter(x => isSick(x)).length, strike = list.filter(x => x.onStrike).length, leave = list.filter(x => x.apronLeave || x.status === 'off' && !isSick(x)).length;
    return { ok: list.filter(x => !isSick(x) && !x.onStrike && !x.apronLeave && !x.left).length, sick, strike, leave }; };
  const whyNot = (k: { sick: number; strike: number; leave: number }) => [k.sick ? `${k.sick} off sick` : '', k.strike ? `${k.strike} on strike` : '', k.leave ? `${k.leave} on leave` : ''].filter(Boolean).join(', ');
  // the pilot
  const n = forceDepLeg(b.reg, b.from, b.to) || (((State as any).aiNext || []) as any[]).filter(x => x.reg === b.reg)[0];
  const p: any = n ? pilot(n.pilotId) : null;
  if (!p) rows.push(['Pilot', '1 needed · none assigned', 'Assign a pilot to the route', true]);
  else {
    const sick = isSick(p), cover = p.coverAgency && p.coverAgency > Date.now();
    const back = sick && p.sickUntil ? Math.max(1, Math.ceil((p.sickUntil - Date.now()) / 864e5)) : 0;
    const st = sick ? `${p.name} off sick${back ? `, back in about ${back} day${back > 1 ? 's' : ''}` : ''}${cover ? ' (a contract pilot covers)' : ''}` : p.onStrike ? `${p.name} on strike` : p.status === 'training' ? `${p.name} away on a course` : p.status === 'off' ? `${p.name} off duty` : p.name;
    rows.push(['Pilot', `1 needed · ${sick && !cover || p.onStrike || p.status === 'training' || p.status === 'off' ? '0' : '1'} available`, st, sick && !cover || !!p.onStrike || p.status === 'training']);
  }
  // cabin crew for this aircraft
  const faN = t ? faNeeded(t) : 0;
  if (faN) { const k = tally(staffOf(cid, 'fa')), agency = agencyOn(cid, 'fa');
    rows.push(['Cabin crew', `${faN} needed for the ${t.model} · ${k.ok} available${agency ? ' + agency cover' : ''}`, whyNot(k) || '—', !agency && k.ok < faN]); }
  // a mechanic to release the aircraft
  const mechs = staffOf(cid, 'mech');
  if (mechs.length || /mechanic/i.test(b.why)) { const k = tally(mechs), agency = agencyOn(cid, 'mech');
    rows.push(['Mechanics', `1 needed to release it · ${k.ok} available${agency ? ' + agency cover' : ''}`, whyNot(k) || (mechs.length ? '—' : 'none hired'), !agency && k.ok < 1]); }
  // ground crew at the airport, if it is one of your bases
  try {
    if (isBase(cid, b.from) && !groundGraceOn(cid)) {
      const gN = GROUND_NEED[t ? t.cls : 'airliner'] || 0, all = ((State as any).staff || []).filter((x: any) => x.companyId === cid && x.role === 'ground' && x.base === b.from && !x.left);
      const k = tally(all), free = groundCrewFree(cid, b.from).length, now = Date.now();
      const busy = (((State as any).aiNext || []) as any[]).filter(x => x.reg !== b.reg && x.from === b.from && plane(x.reg) && plane(x.reg).companyId === cid && x.depAt > now && x.depAt - now < AI_TURN_MIN * 60e3).length;
      if (gN) rows.push(['Ground crew at ' + b.from, `${gN} needed for one turnaround · ${free} at work of ${all.length} hired`, [whyNot(k), busy ? `${busy} other aircraft being turned round` : ''].filter(Boolean).join(', ') || (all.length ? '—' : 'none hired'), free < 1 || free < gN]);
    }
  } catch (e) { /* no ground data */ }
  if (!rows.length) return '';
  return `<div class="crew-short"><b>${icon('pilots')}Who is missing</b><table>${rows.map(r => `<tr class="${r[3] ? 'short' : ''}"><th>${esc(r[0])}</th><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join('')}</table>
    <button class="text-btn" data-act="go" data-screen="pilots">${icon('pilots')}Open Crew</button></div>`;
}

/* ---------- forcing a delayed departure at your home hub, once what held it up is fixed ---------- */
/** The leg waiting to leave (a delayed departure that hasn't gone yet). */
function forceDepLeg(reg: string, from: string, to: string): any {
  return (((State as any).aiNext || []) as any[]).filter(n => n.reg === reg && n.from === from && n.to === to && n.why && n.depAt > Date.now())[0] || null;
}
/** Whether what held the leg up is fixed now: the repair is done, there is a pilot and cabin crew, ground crew,
 *  a stand... Things you can't change (the weather, a curfew, a strike, a court order) never count as fixed. */
function forceDepCheck(n: any): { ok: boolean; why: string } {
  const a: any = plane(n.reg), p: any = pilot(n.pilotId), now = Date.now();
  if (!a) return { ok: false, why: 'The aircraft is no longer in the fleet' };
  if ((State.issues as any[]).some(i => i.reg === a.reg && (i.status === 'scheduled' || (i.severity === 'grounding' && i.status !== 'fixed' && i.status !== 'done')))) return { ok: false, why: 'The technical fault isn\'t fixed yet' };
  if (a.status === 'grounded' || a.status === 'maintenance') return { ok: false, why: `${a.reg} is ${a.status === 'grounded' ? 'grounded' : 'in maintenance'}` };
  if (!p || (p.status === 'off' && !(isSick(p) && p.coverAgency > now))) return { ok: false, why: 'No pilot assigned' };
  if (p.status === 'training') return { ok: false, why: 'The pilot is away on a course' };
  if (a.noBase) return { ok: false, why: 'No free stand at its base' };
  try { const sk = sickBlock(n, a); if (sk) return { ok: false, why: sk }; } catch (e) { /* none */ }
  try { const gb = groundBlock(a.companyId, n.from, a.typeId); if (gb.why) return { ok: false, why: gb.why }; } catch (e) { /* none */ }
  try { const sb = strikeBlock(a.companyId, a.typeId, n.from); if (sb) return { ok: false, why: sb + ' (can\'t be overridden)' }; } catch (e) { /* none */ }
  const gu = ((State as any).groundedUntil || {})[a.companyId]; if (gu && gu > now) return { ok: false, why: 'Operating certificate suspended (can\'t be overridden)' };
  try { const wv = wxDepartureBlock(n, a); if (!wv.ok) return { ok: false, why: wv.why + ' (can\'t be overridden)' }; } catch (e) { /* none */ }
  try { if (curfewAt(n.from, now)) return { ok: false, why: `Night curfew at ${n.from} (can't be overridden)` }; } catch (e) { /* none */ }
  return { ok: true, why: '' };
}
function forceDepHtml(reg: string, from: string, to: string): string {
  const n = forceDepLeg(reg, from, to), a: any = n && plane(reg), c: any = a && company(a.companyId);
  if (!n || !c || c.hub !== from || _schedDay) return '';
  const ck = forceDepCheck(n);
  return `<span class="force-dep ${ck.ok ? 'ok' : ''}"><button class="btn sm ${ck.ok ? 'primary' : 'ghost'}" data-act="force-dep" data-reg="${esc(reg)}" data-from="${esc(from)}" data-to="${esc(to)}" ${ck.ok ? '' : 'disabled'}>${icon('play')}Force departure</button><small>${ck.ok ? 'Fixed: it can leave now' : esc(ck.why)}</small></span>`;
}
ACTIONS['force-dep'] = el => {
  const n = forceDepLeg(el.getAttribute('data-reg'), el.getAttribute('data-from'), el.getAttribute('data-to')); if (!n) { refresh(); return; }
  const ck = forceDepCheck(n); if (!ck.ok) { toast(ck.why, 'warn'); refresh(); return; }
  n.depAt = Date.now(); n.why = ''; Sound.tick(); Haptics.success();
  try { aiAdvance(); } catch (e) { /* the next tick */ }
  toast(`${n.callsign || n.reg} cleared to depart ${n.from} → ${n.to}`, 'ok');
  Store.soon(); schedRefreshAll ? schedRefreshAll() : refresh();
};
ACTIONS['sched-day'] = el => { _schedDay = +el.getAttribute('data-d') || 0; Sound.tick(); refresh(); };
ACTIONS['sched-pick'] = el => {
  const reg = el.getAttribute('data-reg'); if (!reg) return;
  _schedReg = reg; Sound.tick();
  const card = $('.day-card'), html = scheduleDayCard(scheduleBlocks(), new Date().getHours() * 60 + new Date().getMinutes());
  if (card) { const d = document.createElement('div'); d.innerHTML = html.trim(); card.replaceWith(d.firstElementChild); }
  else refresh();
  $all('.g-row').forEach(r => r.classList.toggle('sel', r.getAttribute('data-reg') === reg));
};

SCREENS.schedule = {
  title: 'Schedule', icon: 'clock',
  mount(root: HTMLElement) {
    _schedAt = Date.now();   // the next refresh by itself in 30 seconds from opening it
    const iv = setInterval(() => { if (!root.isConnected) { clearInterval(iv); return; } if (!document.hidden) schedRepaintDay(); }, 5000);
  },
  render() {
    const c = company();
    const blocks = scheduleBlocks();
    const fl = fleetOf();
    const now = new Date(); const nowMin = now.getHours() * 60 + now.getMinutes();
    const pct = (m: number) => (clamp(m, 0, 1440) / 1440 * 100).toFixed(2) + '%';
    return `
    <div class="screen-head"><div><h1>Schedule</h1><p class="sub">${_schedDay ? 'Tomorrow' : 'Today'}, ${fl.length} aircraft · delays move the legs after them; a leg more than five hours late is cancelled and flown the next day</p></div>
      <span class="seg"><button class="${!_schedDay ? 'on' : ''}" data-act="sched-day" data-d="0">Today</button><button class="${_schedDay ? 'on' : ''}" data-act="sched-day" data-d="1">Tomorrow</button></span>
      <button class="btn ghost sched-refresh" data-act="sched-refresh" aria-label="Refresh the schedule (it also refreshes by itself every 30 seconds)">${icon('reload')}<span>Refresh</span><small data-sched-next>${Math.max(1, Math.ceil((SCHED_EVERY - (Date.now() - _schedAt)) / 1000))} s</small></button>
      <button class="btn ghost sched-opsroom" data-act="ops-room">${icon('clock')}Operations office</button>
      <button class="btn primary" data-act="new-route">${icon('plus')}New route</button></div>
    ${scheduleDayCard(blocks, nowMin)}
    <div class="card gantt">
      <div class="g-axis"><span></span><div class="g-hours">${[0, 3, 6, 9, 12, 15, 18, 21].map(h => `<i style="left:${pct(h * 60)}">${h < 10 ? '0' : ''}${h}:00</i>`).join('')}</div></div>
      ${fl.map((a, i) => `<div class="g-row ${a.reg === schedSelected() ? 'sel' : ''}" style="--i:${i}" data-act="sched-pick" data-reg="${esc(a.reg)}" role="button" aria-label="Show the day for ${esc(a.reg)}">
        <span class="g-reg st-${fleetState(a)}"><i class="fs-led"></i><b>${esc(a.reg)}</b><small>${esc(acType(a.typeId).model)}</small></span>
        <div class="g-lane">${blocks.filter(b => b.reg === a.reg).map(b => {
          const late = !b.cancelled && (b.delayMin || 0) >= 5 && b.sched != null;
          const ghost = late ? `<span class="g-ghost" style="left:${pct(b.sched)};width:calc(${pct(b.sched + (b.end - b.start))} - ${pct(b.sched)})"></span>` : '';
          const tip = `${b.from} to ${b.to}${b.cancelled ? ', cancelled' : late ? `, ${b.delayMin} min late` : ''}${b.why ? ': ' + b.why : ''}`;
          return ghost + `<span class="g-blk ${b.kind} ${b.you ? 'you' : ''} ${late ? 'late' : ''} ${b.cancelled ? 'cxl' : ''} ${b.end < nowMin && !_schedDay ? 'past' : ''}" style="left:${pct(b.start)};width:calc(${pct(b.end)} - ${pct(b.start)})" title="${esc(tip)}">${b.kind === 'maint' ? 'Maintenance' : b.cancelled ? 'Cancelled' : esc(b.from) + '–' + esc(b.to) + (late ? ` +${b.delayMin}′` : '')}</span>`;
        }).join('')}</div>
      </div>`).join('')}
      ${_schedDay ? '' : `<div class="g-now" style="left:calc(var(--g-label) + (100% - var(--g-label)) * ${(nowMin / 1440).toFixed(4)})"><i>${now.getHours() < 10 ? '0' : ''}${now.getHours()}:${now.getMinutes() < 10 ? '0' : ''}${now.getMinutes()}</i></div>`}
    </div>`;
  },
};

/** The "now" line on every schedule that is open (the app, the laptop, the Operations computer) moves on and shows
 *  the time, every second, without drawing the whole schedule again. */
setInterval(() => {
  if (document.hidden) return;
  const ls = document.querySelectorAll('.g-now'); if (!ls.length) return;
  const now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60, p = (n: number) => String(n).padStart(2, '0'), t = p(now.getHours()) + ':' + p(now.getMinutes());
  ls.forEach((el: any) => {
    el.style.left = `calc(var(--g-label) + (100% - var(--g-label)) * ${(nowMin / 1440).toFixed(5)})`;
    const i = el.querySelector('i'); if (i && i.textContent !== t) i.textContent = t;
  });
}, 1000);
