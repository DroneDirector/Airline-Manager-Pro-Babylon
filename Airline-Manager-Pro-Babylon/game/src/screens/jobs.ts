// Jobs: the charter and cargo board, accepted jobs, tours and the weekly challenge.
let _jobsTab = 'board';

function untilTxt(t: number): string {
  const m = Math.round((t - Date.now()) / 60000);
  if (m <= 0) return 'now';
  return m < 60 ? `${m} min` : m < 48 * 60 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} days`;
}

function jobCard(j: Job, i: number): string {
  const by = j.by === 'you' ? 'You' : j.by ? (pilot(j.by) || { name: '' } as any).name : '';
  const st = j.status;
  return `<div class="job-card ${j.kind} st-${st}" style="--i:${Math.min(i, 20)}">
    <span class="job-ic">${icon(j.kind === 'cargo' ? 'fleet' : 'pax')}</span>
    <span class="job-main"><b>${esc(j.title)}${specialCargo(j) ? ` <i class="job-sp sp-${(j as any).special}">${esc(specialCargo(j).chip)}</i>` : ''}${heliMission(j) ? ` <i class="job-sp sp-heli sp-${(j as any).heli}">${esc(heliMission(j).chip)}${(j as any).back ? ' · and back' : ''}</i>` : ''}</b><small>${esc(j.client)}</small>
      <span class="chain"><b>${esc(j.from)}</b><i></i><b>${esc(j.to)}</b></span><small>${num(j.nm)} nm · ${j.kind === 'cargo' ? num(j.kg) + ' kg' : j.pax + ' passengers'}</small></span>
    <span class="job-k"><small>Pays</small><b class="green">${money(j.pay, { compact: true })}</b></span>
    <span class="job-k"><small>${st === 'open' ? 'Take it within' : st === 'accepted' || st === 'flying' ? 'Deliver within' : 'Finished'}</small><b>${st === 'open' ? untilTxt(j.expires) : st === 'accepted' || st === 'flying' ? untilTxt(j.due) : esc(dateStr(new Date(j.doneAt || Date.now())).slice(5, 16))}</b></span>
    <span class="job-btns">${st === 'open' ? `<button class="btn ghost sm" data-act="job-mine" data-id="${j.id}">${icon('user')}Fly it myself</button><button class="btn primary sm" data-act="job-pilot" data-id="${j.id}">${icon('pilots')}Give to a pilot</button>`
      : st === 'accepted' || st === 'flying' ? `<span class="chip">${st === 'flying' ? 'Flying' : (j as any).queued ? 'After current flight' : 'Accepted'}: ${esc(by)}${j.reg ? ', ' + esc(j.reg) : ''}</span>${j.by === 'you' ? `<button class="text-btn" data-act="job-release" data-id="${j.id}">Give it back</button><button class="text-btn" data-act="sb-plan" data-from="${esc(j.from)}" data-to="${esc(j.to)}">SimBrief</button>` : ''}`
      : `<span class="chip ${st === 'done' ? 'ok' : st === 'late' ? '' : 'bad'}">${st === 'done' ? 'Delivered' : st === 'late' ? 'Delivered late' : (j as any).expired ? 'Taken by someone else' : 'Not delivered'}</span>${j.tx ? `<button class="text-btn" data-act="tx-detail" data-id="${j.tx}">Money</button>` : ''}`}</span>
  </div>`;
}

SCREENS.jobs = {
  title: 'Jobs', icon: 'jobs',
  render() {
    const c = company(), J = jobsState(), mine = J.list.filter(j => j.companyId === c.id);
    const open = mine.filter(j => j.status === 'open').sort((a, b) => a.expires - b.expires);
    const acc = mine.filter(j => j.status === 'accepted' || j.status === 'flying');
    const done = mine.filter(j => j.status === 'done' || j.status === 'late' || (j.status === 'failed' && !(j as any).expired)).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
    const ch = Jobs.challenge(), prog = Jobs.progress(), chDone = !!J.weekly[ch.wk];
    const tabs = [['board', 'Job board', open.length], ['accepted', 'Accepted', acc.length], ['tours', 'Tours', TOURS.filter(t => J.tours[t.id] && !J.tours[t.id].done).length], ['challenge', 'Weekly challenge', chDone ? '✓' : `${Math.min(prog, ch.c.target)}/${ch.c.target}`], ['done', 'Done', done.length]];
    let body = '';
    if (_jobsTab === 'board') body = `<div class="job-list">${open.map(jobCard).join('') || emptyState('No jobs right now', 'New charters and cargo come in every few hours from your bases and wherever your aircraft are.')}</div>
      <p class="fine-print">${icon('info')}Charters pay about 40% above normal fares, cargo about 70% above normal rates. Deliver late and the customer takes 30% off; not at all and you pay 20% of the price.</p>`;
    else if (_jobsTab === 'accepted') body = `<div class="job-list">${acc.map(jobCard).join('') || emptyState('No accepted jobs', 'Take one from the job board.')}</div>
      <p class="fine-print">${icon('info')}A job you fly yourself counts when you fly from its airport to its destination in your aircraft before the deadline: the pay comes with that flight.</p>`;
    else if (_jobsTab === 'done') body = `<div class="job-list">${done.map(jobCard).join('') || emptyState('Nothing finished yet', 'Delivered jobs show up here.')}</div>`;
    else if (_jobsTab === 'tours') body = `<div class="tour-grid">${TOURS.filter(t => c.kind === 'bush' ? t.bush : true).map((t, i) => {
      const st = J.tours[t.id], n = t.legs.length - 1, idx = st ? st.idx : 0;
      return `<div class="card tour ${st && st.done ? 'done' : st ? 'on' : ''}" style="--i:${i}">
        <div class="tour-h"><b>${esc(t.name)}</b><em class="green">${money(t.reward, { compact: true })}</em></div><small>${esc(t.desc)}</small>
        <div class="tour-legs">${t.legs.map((l, k) => `${k ? `<i class="${st && k <= idx ? 'flown' : ''}"></i>` : ''}<b class="${st && (k < idx || (st.done && k <= idx)) ? 'flown' : st && k === idx && !st.done ? 'next' : ''}">${esc(l)}</b>`).join('')}</div>
        <div class="tour-f">${st && st.done ? `<span class="chip ok">${icon('check')}Completed ${esc(dateStr(new Date(st.done)).slice(0, 10))}</span>` : st ? `<span><b>Leg ${idx + 1} of ${n}</b><small>Next: ${esc(t.legs[idx])} to ${esc(t.legs[idx + 1])}</small></span><button class="text-btn" data-act="tour-stop" data-id="${t.id}">Stop</button><button class="btn ghost sm" data-act="sb-plan" data-from="${esc(t.legs[idx])}" data-to="${esc(t.legs[idx + 1])}">SimBrief</button>`
          : `<span><small>${n} legs, flown by you, in order</small></span><button class="btn primary sm" data-act="tour-start" data-id="${t.id}">Start</button>`}</div>
      </div>`;
    }).join('')}</div><p class="fine-print">${icon('info')}Tours are flown by you yourself, leg by leg in order, with any of your aircraft. There's no time limit.</p>`;
    else {
      const left = (() => { const d = new Date(), day = d.getDay() || 7, end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 8 - day); return end.getTime(); })();
      body = `<div class="card challenge ${chDone ? 'done' : ''}">
        <span class="ch-ic">${icon('trophy')}</span>
        <span class="ch-t"><small>This week's challenge · ${esc(ch.wk)}</small><b>${esc(ch.c.name)}</b><span>${esc(ch.c.desc)}</span>
          <span class="rk-bar"><i style="width:${Math.min(100, prog / ch.c.target * 100).toFixed(1)}%"></i></span><small>${num(Math.min(prog, ch.c.target))} of ${num(ch.c.target)}${chDone ? ' · done!' : ` · ${untilTxt(left)} left`}</small></span>
        <em class="green">${money(ch.c.reward, { compact: true })}</em>
      </div><p class="fine-print">${icon('info')}A new challenge every Monday. Only flights you fly yourself count. The reward goes to the airline as soon as it's done.</p>
      <p class="fine-print">${Object.keys(J.weekly).length} weekly challenge${Object.keys(J.weekly).length === 1 ? '' : 's'} done so far.</p>`;
    }
    return `<div class="screen-head"><div><h1>Jobs</h1><p class="sub">Charters, cargo, tours and the weekly challenge for ${esc(c.name)}</p></div></div>
      <div class="tabs big">${tabs.map(t => `<button class="tab ${_jobsTab === t[0] ? 'on' : ''}" data-act="jobs-tab" data-t="${t[0]}">${t[1]}<i>${t[2]}</i></button>`).join('')}</div>
      ${body}`;
  },
};

ACTIONS['jobs-tab'] = el => { _jobsTab = el.getAttribute('data-t'); Sound.tick(); refresh(); };
ACTIONS['tour-start'] = el => { Jobs.tourStart(el.getAttribute('data-id')); Store.save(); Sound.tick(); refresh(); toast('Tour started: fly the first leg', 'ok'); };
ACTIONS['tour-stop'] = el => { Jobs.tourStop(el.getAttribute('data-id')); Store.save(); Sound.tick(); refresh(); };
ACTIONS['job-release'] = el => { Jobs.release(el.getAttribute('data-id')); Store.save(); Sound.tick(); refresh(); };
ACTIONS['job-mine'] = el => {
  const r = Jobs.acceptMine(el.getAttribute('data-id'));
  if (r === 'ok') { const j = jobById(el.getAttribute('data-id')); Store.save(); Sound.tick(); _jobsTab = 'accepted'; refresh(); toast(`Yours: fly ${j.from} to ${j.to} in ${j.reg} before ${dateStr(new Date(j.due)).slice(5, 16)}`, 'ok'); }
  else toast(r === 'no-aircraft' ? 'Choose the aircraft you fly yourself first' : r === 'gone' ? 'That job is gone' : `Your aircraft can't do it: ${r}`, 'warn');
};

let _ja = { id: '', reg: '' };
function jobPilotHtml(): string {
  const j = jobById(_ja.id); if (!j) return '';
  const S: any = State, c = company(j.companyId), mine = S.myReg[c.id];
  const busyReg = (reg: string) => State.live.some(f => f.reg === reg) || (S.aiNext || []).some((n: any) => n.reg === reg);
  const busyPilot = (id: string) => State.live.some(f => f.pilotId === id) || (S.aiNext || []).some((n: any) => n.pilotId === id);
  const acs = fleetOf(c.id).filter(a => a.reg !== mine && a.status === 'parked' && !busyReg(a.reg) && !(a as any).jobHold && !jobFits(j, a) && !(a as any).noBase);
  const a = plane(_ja.reg);
  const pilots = a ? crewOf().filter((p: any) => Ratings.rated(p, a.typeId)) : [];
  return `<div class="modal-head"><div><h2>${coopOn() ? 'Give the job to a co-op pilot' : 'Give the job to a pilot'}</h2><small>${esc(j.title)}: ${esc(j.from)} to ${esc(j.to)}, ${j.kind === 'cargo' ? num(j.kg) + ' kg' : j.pax + ' passengers'}</small></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
  <div class="modal-body">
    <h3>Aircraft</h3><p class="fine-print">${icon('info')}About what the job leaves after fuel, fees, crew and maintenance, with the ferry flight if needed.</p>
    <div class="route-pick">${acs.map(x => { const e = jobEstimate(j, x); return `<button class="rp ${_ja.reg === x.reg ? 'on' : ''}" data-act="ja-ac" data-reg="${esc(x.reg)}"><span class="chain"><b>${esc(x.reg)}</b><em class="${e >= 0 ? 'green' : 'red'}">${money(e, { sign: true, compact: true })}</em></span><small>${esc(acType(x.typeId).model)} at ${esc(x.location)}${x.location !== j.from ? ', ferried to ' + esc(j.from) + ' first' : ''}</small></button>`; }).join('') || `<p class="fine-print">${icon('info')}No free aircraft can do this job: it needs ${j.kind === 'cargo' ? num(j.kg) + ' kg of cargo room' : j.pax + ' seats'} and ${num(j.nm)} nm of range.</p>`}</div>
    ${a && coopOn() ? coopJobPilotsHtml(j, a.reg) : a ? `<h3>Pilot</h3><div class="route-pick">${pilots.map((p: any) => `<button class="rp ${p.status === 'training' ? 'off' : ''}" data-act="ja-go" data-id="${esc(p.id)}" ${p.status === 'training' ? 'disabled' : ''}><span class="chain"><b>${esc(p.name)}</b></span><small>${p.status === 'training' ? 'On a course' : State.live.some(f => f.pilotId === p.id) ? 'In the air: takes the job after landing' : busyPilot(p.id) ? 'Between route legs: the job comes first' : 'Free'}${State.routes.some(r => r.pilotId === p.id && !r.test) ? ', goes back to the route after' : ''}</small></button>`).join('') || `<p class="fine-print">${icon('info')}None of your pilots is rated on the ${esc(acType(a.typeId).model)}. Send one on a course under Pilots.</p>`}</div>` : ''}
  </div>`;
}
/** About what the job leaves after costs with this aircraft, ferry flight included. */
function jobEstimate(j: Job, a: Aircraft): number {
  const t = acType(a.typeId), block = (nm: number) => Math.round(nm / t.cruiseKt * 60 + 25);
  const m = legEconomics(a.typeId, j.from, j.to, j.pax, j.kg, block(j.nm), undefined, false, { job: { pay: j.pay, title: j.title } });
  let ferry = 0;
  if (a.location !== j.from && apt(a.location) && apt(j.from)) { const nm = gcDistanceNm(apt(a.location).pos, apt(j.from).pos); ferry = -legEconomics(a.typeId, a.location, j.from, 0, 0, block(nm), undefined, false, { ferry: true }).net; }
  return Math.round(m.net - ferry);
}
function rerenderJa() { const p = $('.ja-pop .panel'); if (p) patchHtml(p, jobPilotHtml()); }
ACTIONS['job-pilot'] = el => { _ja = { id: el.getAttribute('data-id'), reg: '' }; Sound.tick(); openLayer('modal', jobPilotHtml(), { cls: 'wide ja-pop' }); };
ACTIONS['ja-ac'] = el => { _ja.reg = el.getAttribute('data-reg'); Sound.tick(); rerenderJa(); };
ACTIONS['ja-go'] = el => {
  const r = Jobs.acceptPilot(_ja.id, el.getAttribute('data-id'), _ja.reg);
  if (r !== 'ok' && r !== 'queued') { toast(r, 'warn'); return; }
  Store.save(); closeAll(); Sound.tick(); _jobsTab = 'accepted'; refresh();
  toast(r === 'queued' ? `${pilot(el.getAttribute('data-id')).name} flies it after landing, in ${_ja.reg}` : `${pilot(el.getAttribute('data-id')).name} takes the job in ${_ja.reg}`, 'ok');
};
