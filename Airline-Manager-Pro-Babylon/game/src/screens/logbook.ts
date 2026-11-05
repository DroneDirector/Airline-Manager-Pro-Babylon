// Logbook: every flight you fly, with landing rate, load and incidents.
SCREENS.logbook = {
  title: 'Flight logs', icon: 'logbook',
  render() {
    const me = myPilot();
    const rows0 = State.logbook.filter(l => (plane(l.reg) && plane(l.reg).companyId === State.companyId || (l as any).coopBy) && coopMineFilter(l));
    const rows = sortList('log', rows0, LOG_SORTS, (l: any) => `${l.from} ${l.to} ${l.reg} ${l.date} ${l.notes || ''}`);
    const counted = rows0.filter(l => l.decision !== 'disregarded' && l.result !== 'crash' || l.decision === 'registered');
    const landings = counted.filter(l => l.result !== 'crash');
    const avg = landings.length ? landings.reduce((s, l) => s + Math.abs(l.landingFpm), 0) / landings.length : 0;
    const best = landings.length ? Math.min.apply(null, landings.map(l => Math.abs(l.landingFpm))) : 0;
    return `
    <div class="screen-head">
      <div><h1>Flight logs</h1><p class="sub">${esc(me.name)}${coopOn() ? ' · co-op' : ''}</p></div>
      ${expButtons('log')}
    </div>${coopWhoChips(true)}
    <div class="log-totals">
      <div class="stat"><small>Total hours</small><b>${hours(me.hoursMin)}</b></div>
      <div class="stat"><small>Landings</small><b>${num(me.landings)}</b></div>
      <div class="stat"><small>Average landing</small><b>${Math.round(avg)}<span> fpm</span></b></div>
      <div class="stat"><small>Softest</small><b class="green">${best}<span> fpm</span></b></div>
      <div class="stat"><small>Crashes</small><b>${rows.filter(l => l.decision === 'registered').length}<span> registered</span></b></div>
    </div>
    ${sortBar('log', LOG_SORTS, 'Find a flight')}
    <div class="log-table" role="table">
      <div class="lt-head" role="row"><span>Date</span><span>Route</span><span>Aircraft</span><span>Block</span><span>Landing</span><span>Load</span><span>ATC</span><span>Score</span><span>Result</span></div>
      ${rows.map((l, i) => {
        const t = acType(plane(l.reg).typeId);
        const fpmCls = l.result === 'crash' ? 'red' : Math.abs(l.landingFpm) > 300 ? 'amber' : Math.abs(l.landingFpm) < 150 ? 'green' : '';
        return `<div class="lt-row ${l.result === 'crash' && l.decision === 'pending' ? 'pending' : ''} ${l.decision === 'disregarded' ? 'voided' : ''}" role="row" style="--i:${i}" data-act="log-open" data-id="${l.id}" tabindex="0" aria-label="Open ${esc(l.reg)}, ${esc(l.from)} to ${esc(l.to)}">
          <span>${esc(l.date.slice(5, 10).replace('-', '/'))}<small>${esc(l.date.slice(11))}</small></span>
          <span><b>${esc(l.from)}</b> to <b>${esc(l.to)}</b></span>
          <span>${esc(l.reg)}<small>${esc(t.model)}</small></span>
          <span>${hours(l.blockMin)}</span>
          <span class="${fpmCls}">${num(l.landingFpm)} fpm<small>${l.g.toFixed(2)} g</small></span>
          <span>${l.pax} pax</span>
          <span>${esc(l.atc)}</span>
          <span class="${(l as any).score == null ? '' : (l as any).score >= 90 ? 'green' : (l as any).score >= 75 ? '' : (l as any).score >= 60 ? 'amber' : 'red'}">${(l as any).score != null ? (l as any).score : '—'}</span>
          <span>${l.result === 'crash' && l.decision === 'pending'
            ? `<button class="btn danger sm" data-act="open-crash" data-id="${l.id}">Decide</button>`
            : l.decision === 'disregarded' ? '<span class="chip chip-dim">Disregarded</span>' : statusChip(l.result)}${l.notes ? `<small>${esc(l.notes)}</small>` : ''}</span>
        </div>`;
      }).join('')}
    </div>`;
  },
};

/* ---------- one flight: opens the aircraft with this flight's log ---------- */
ACTIONS['log-open'] = el => {
  const l = State.logbook.filter(x => x.id === el.getAttribute('data-id'))[0]; if (!l || !plane(l.reg)) return;
  Sound.tick();
  _acLog = l.id;
  ACTIONS['ac-detail']({ getAttribute: () => l.reg } as any, null);
};

/** The flight's own log inside the aircraft's page: what happened, the landing, the load, damage found and the money. */
function flightLogHtml(l: LogEntry): string {
  const L: any = l, a = plane(l.reg), t = acType(L.typeId || (a ? a.typeId : '')) || (a ? acType(a.typeId) : null);
  const day = String(l.date).slice(0, 10), fpm = Math.abs(l.landingFpm);
  const fpmCls = l.result === 'crash' ? 'red' : fpm > 300 ? 'amber' : fpm < 150 ? 'green' : '';
  // damage reported on this aircraft that day, and the flight's money
  const issues = State.issues.filter(i => i.reg === l.reg && i.date === day);
  const tx = State.txns.filter((x: any) => x.reg === l.reg && x.date === day && x.route === `${l.from} → ${l.to}`)[0];
  const verdict = l.result === 'crash' ? (l.decision === 'registered' ? 'Crash, registered' : l.decision === 'disregarded' ? 'Crash, disregarded (flight voided)' : 'Crash, waiting for your decision')
    : l.result === 'incident' ? 'Incident: damage that grounds the aircraft' : l.result === 'hard' ? 'Hard landing: the mechanic inspects it' : fpm < 150 ? 'Smooth landing' : 'Normal landing';
  return `<div class="flog ${l.result}">
    <div class="flog-h"><span>${statusChip(l.decision === 'disregarded' ? 'voided' : l.result)}</span><b>${esc(l.from)} → ${esc(l.to)}</b><small>${esc(l.date)}${t ? ', ' + esc(t.maker + ' ' + t.model) : ''}</small></div>
    <p class="flog-v">${esc(verdict)}</p>
    <div class="kv-row">
      <div><small>Landing</small><b class="${fpmCls}">${num(l.landingFpm)} fpm</b></div>
      <div><small>G-force</small><b>${l.g.toFixed(2)} g</b></div>
      <div><small>Block time</small><b>${hours(l.blockMin)}</b></div>
      <div><small>Passengers</small><b>${num(l.pax)}</b></div>
      <div><small>ATC</small><b>${esc(l.atc)}</b></div>
      ${tx ? `<div><small>Result</small><b class="${tx.amount >= 0 ? 'green' : 'red'}">${money(tx.amount, { sign: true, compact: true })}</b></div>` : ''}
    </div>
    ${l.notes ? `<p class="fine-print">${icon('info')}${esc(l.notes)}</p>` : ''}
    ${flightScoreHtml(l)}
    ${photoStrip(l.id)}
    ${issues.length ? `<div class="flog-iss"><small>Found after this flight</small>${issues.map(i => `<button class="mini-row" data-act="open-issue" data-id="${i.id}">${statusChip(i.severity)}<span>${esc(i.title)}</span><small>${money(i.cost, { compact: true })}</small></button>`).join('')}</div>` : ''}
    <div class="btn-row">${replayBtn(l)}${l.result === 'crash' && l.decision === 'pending' ? `<button class="btn danger sm" data-act="open-crash" data-id="${l.id}">Decide about the crash</button>` : ''}${tx ? `<button class="btn ghost sm" data-act="tx-detail" data-id="${tx.id}">${icon('finance')}Money in and out</button>` : ''}</div>
  </div>`;
}
