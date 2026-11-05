// Operations overview: live map, your current flight, today's legs and anything that needs you.
let _opsMap: WorldMap = null;

function yourFlight(): LiveFlight { return liveOf().filter(f => f.you)[0]; }

function coPilotChip(): string {
  const co: any = State.pilots.filter((p: any) => p.coPilotFor === State.companyId)[0];
  if (!co) return '';
  return `<button class="sync-item cp" data-act="staff-detail" data-id="${co.id}"><span class="cp-av">${avatarSvg(co.look, 'fo', { view: 'bust', accent: company().color })}</span><span><small>Co-pilot</small><b>${esc(co.name)}</b></span></button>`;
}

/** Weather where you are flying: from Flight Simulator when linked, made-up demo weather otherwise. */
function weatherChip(f: LiveFlight): string {
  const w: SimWeather = (f as any).wx || (f.real ? null : { windDir: 260, windKt: 64, visM: 10000, tempC: -52, qnhHpa: 1009, precip: 'none', precipMm: 0, inCloud: false, turb: 'light' });
  if (!w) return '';
  const vis = w.visM >= 9999 ? '10 km+' : w.visM >= 1000 ? (w.visM / 1000).toFixed(w.visM < 5000 ? 1 : 0) + ' km' : Math.round(w.visM / 50) * 50 + ' m';
  const sky = w.precip === 'snow' ? 'Snow' : w.precip === 'rain' ? (w.precipMm > 4 ? 'Heavy rain' : 'Rain') : w.inCloud ? 'In cloud' : w.visM < 5000 ? 'Mist' : 'Clear';
  const turb = { none: 'Smooth', light: 'Light turbulence', moderate: 'Moderate turbulence', severe: 'Severe turbulence' }[w.turb] || 'Smooth';
  const bad = w.turb === 'severe' || w.turb === 'moderate';
  return `<div class="sync-item wx ${bad ? 'warn' : ''}">${icon('wind')}<span><small>${f.real ? 'Weather in the sim' : 'Weather (demo)'}</small>
    <b>${String(Math.round(w.windDir)).padStart(3, '0')}° ${w.windKt} kt, ${vis}, ${w.tempC}°C</b><small>${sky}, ${turb}, QNH ${w.qnhHpa}</small></span></div>`;
}

/** The flight card made small (or full size again): on the map, the Overview and in the 3D view, all at once.
 *  It shrinks downwards and stays where it is (its bottom edge doesn't move); it can still be dragged. */
ACTIONS['fc-min'] = () => {
  const S: any = State.settings; S.fcMini = !S.fcMini; Store.save(); Sound.tick();
  document.querySelectorAll('.flight-card').forEach((c: Element) => {
    const box = (c.closest('.sel-pop') || c).parentElement as HTMLElement, b0 = c.getBoundingClientRect().bottom;
    c.classList.toggle('mini', !!S.fcMini);
    if (!box || !c.closest('.sel-pop')) return;
    const b1 = c.getBoundingClientRect().bottom, m = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(box.style.transform || ''), x = m ? +m[1] : 0, y = m ? +m[2] : 0;
    box.style.transform = `translate(${x}px, ${y + (b0 - b1)}px)`;
  });
  try { if (typeof V3d !== 'undefined' && V3d.open && V3d.root) { V3d.root.classList.toggle('v3d-mini', !!S.fcMini); v3dShowInfo(); } } catch (e) { /* not open */ }
};

function flightCard(f: LiveFlight): string {
  const a = plane(f.reg), t = acType(a.typeId), A = apt(f.from), B = apt(f.to);
  const dist = A && B ? gcDistanceNm(A.pos, B.pos) : 0;
  const F: any = f, ai = !f.real && F.depAt;
  // hired pilots: miles along the planned route and time to the gate from the real-world flight profile
  const left = ai ? F.leftNm : f.real ? (f.noDest ? 0 : F.leftNm != null && !f.pos ? F.leftNm : gcDistanceNm(f.pos, B ? B.pos : null)) : dist * (1 - f.t);
  const mo = flightMotion(f);
  const altTxt = f.alt < 50 ? 'Ground' : f.alt < 18000 ? num(Math.round(f.alt / 100) * 100) + ' ft' : 'FL' + Math.round(f.alt / 100);
  const fuelOk = (State as any).myLoad.fuelKg >= (State as any).myLoad.tripFuelKg + (State as any).myLoad.reserveKg;
  return `
  <div class="card flight-card ${(State.settings as any).fcMini ? 'mini' : ''}" data-fc="${esc(f.id)}">
    <div class="fc-mini"><span class="fc-cs">${esc(f.callsign)}</span>
      <span><small>Arrives in</small><b>${arrivesIn(f)}</b></span><span><small>Remaining</small><b>${f.noDest ? '—' : num(left) + ' nm'}</b></span>
      <span><small>Altitude</small><b>${altTxt}</b></span><span><small>Ground speed</small><b>${f.gs ? num(f.gs) + ' kt' : '—'}</b></span>
      <button class="icon-btn fc-min" data-act="fc-min" aria-label="Show all the details" title="Show all the details">${icon('down', 'flip-v')}</button></div>
    <div class="fc-top"><span class="fc-cs">${esc(f.callsign)}</span>${liveChip(f.reg, 'flying')}<span class="fc-ac">${esc(f.reg)}, ${esc(t.model)}</span><button class="icon-btn fc-min" data-act="fc-min" aria-label="Minimise" title="Minimise">${icon('down')}</button></div>
    <div class="fc-route">
      <div><b>${esc(f.from)}</b><small>${esc(A.city)}</small></div>
      <div class="fc-track"><i class="fc-fill" style="width:${(f.t * 100).toFixed(1)}%"></i><i class="fc-plane" style="left:${(f.t * 100).toFixed(1)}%">${icon('fleet')}</i></div>
      <div class="r"><b>${f.noDest ? '—' : esc(f.to)}</b><small>${f.noDest ? 'No destination yet' : esc(B.city)}</small></div>
    </div>
    <div class="fc-grid">
      <div class="fc-ph"><small>Phase</small><b>${esc(f.phase)}</b></div>
      <div><small>Altitude</small><b>${altTxt}</b></div>
      <div><small>Remaining</small><b>${f.noDest ? '—' : num(left) + ' nm'}</b></div>
      <div><small>Arrives in</small><b>${arrivesIn(f)}</b></div>
      <div><small>Heading</small><b>${String(mo.hdg % 360).padStart(3, '0')}°</b></div>
      <div class="fc-vs"><small>Vertical speed</small><b>${mo.vs > 0 ? '+' : mo.vs < 0 ? '−' : ''}${num(Math.abs(mo.vs))} ft/min</b></div>
      <div><small>Ground speed</small><b>${f.gs ? num(f.gs) + ' kt' : '—'}</b></div>
    </div>
    ${f.you ? `<div class="fc-sync">
      <div class="sync-item">${icon('pax')}<span><small>Passengers from ${(State as any).myLoad.source === 'gsx' ? 'GSX' : 'the sim'}</small><b>${f.pax} / ${f.paxMax}</b></span></div>
      <button class="sync-item" data-act="weights">${icon('fuel')}<span><small>Fuel on board</small><b>${num((State as any).myLoad.fuelKg)} kg</b></span><i class="si-ok ${fuelOk ? '' : 'bad'}">${icon(fuelOk ? 'check' : 'alert')}</i></button>
      <div class="sync-item">${icon('radio')}<span><small>ATC, ${State.settings.atcSource === 'beyondatc' ? 'BeyondATC' : 'built-in'}</small>
        <span class="clr">${f.real ? '<i>Taxi</i><i>Takeoff</i><i>Landing</i>' : '<i class="ok">Taxi</i><i class="ok">Takeoff</i><i>Landing</i>'}</span></span></div>
      ${weatherChip(f)}
      ${coPilotChip()}
    </div>` : `<div class="fc-sync"><div class="sync-item">${icon('user')}<span><small>Flown by</small><b>${esc(pilot(f.pilotId).name)}</b></span></div>
      ${onBoardHtml(onBoardFlight(f))}</div>`}
    <div class="fc-docs"><button class="btn ghost sm" data-act="pax-list" data-id="${esc(f.id)}">${icon('pax')}Passenger list</button><button class="btn ghost sm" data-act="loadsheet" data-id="${esc(f.id)}">${icon('fuel')}Loadsheet</button></div>
  </div>`;
}

let _ovPeriod = 'day';
const PERIOD_NAMES: { [k: string]: string } = { day: 'Today', week: 'This week', month: 'This month', year: 'This year' };

function widget(page: string, title: string, body: string, cls?: string, i?: number, extra?: string): string {
  return `<button class="widget ${cls || ''}" data-act="go" data-screen="${page}" style="--i:${i || 0}" aria-label="${esc(title)}, open ${esc(SCREENS[page].title)}">
    <span class="w-h"><span>${esc(title)}</span>${extra || ''}${icon('chevron', 'w-go')}</span>${body}</button>`;
}

function sparkline(vals: number[], w: number, h: number): string {
  if (vals.length < 2) return '';
  const mn = Math.min.apply(null, vals.concat([0])), mx = Math.max.apply(null, vals);
  const x = (i: number) => (i / (vals.length - 1)) * w, y = (v: number) => h - 2 - (v - mn) / ((mx - mn) || 1) * (h - 4);
  const d = vals.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(v).toFixed(1)).join(' ');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><path d="${d} L${w},${h} L0,${h} Z" class="sp-fill"/><path d="${d}" class="sp-line"/><circle cx="${x(vals.length - 1)}" cy="${y(vals[vals.length - 1])}" r="2.6" class="sp-dot"/></svg>`;
}

function ring(pct: number): string {
  const r = 26, c = 2 * Math.PI * r;
  return `<svg class="ring" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="${r}" class="rg-bg"/><circle cx="32" cy="32" r="${r}" class="rg-fg" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - pct / 100)).toFixed(1)}"/></svg>`;
}

function fleetStatusTile(a: Aircraft, i: number): string {
  const t = acType(a.typeId), st = fleetState(a);
  const f = State.live.filter(x => x.reg === a.reg)[0];
  const mine = State.myReg[State.companyId] === a.reg;
  const where = f ? `${f.from} → ${f.to}` : a.location;
  return `<button class="fs-tile st-${st}" data-act="ac-detail" data-reg="${a.reg}" style="--i:${i}">
    <i class="fs-led"></i><b>${esc(a.reg)}</b><small>${esc(t.model)}</small><span>${esc(where)}</span>${mine ? '<em>You</em>' : ''}</button>`;
}

SCREENS.ops = {
  title: 'Overview', icon: 'ops',
  render() {
    const c = company();
    const mine = yourFlight();
    const fl = fleetOf(), live = liveOf();
    const nFlight = fl.filter(a => fleetState(a) === 'flight').length, nAvail = fl.filter(a => fleetState(a) === 'avail').length, nMaint = fl.length - nFlight - nAvail;
    const avail = availabilityPct(fl);
    const series = profitSeries(_ovPeriod), last = series[series.length - 1];
    const profit = last.rev - last.cost;
    const openIssues = State.issues.filter(i => i.status === 'open' && plane(i.reg).companyId === c.id);
    const pendingCrash = State.logbook.filter(l => l.result === 'crash' && l.decision === 'pending' && plane(l.reg).companyId === c.id);
    const fines = State.notices.filter(n => n.kind === 'authority' && n.ref && State.fines[n.ref]);
    const myA = plane(State.myReg[c.id]);
    const cc = crewCheck(c.id);
    const sim = State.simAircraft;
    const match = myA && sim.typeId === myA.typeId;
    const pct = (n: number) => fl.length ? (n / fl.length * 100).toFixed(1) : '0';
    return `
    <div class="ov">
      <button class="bf-open" data-act="briefing">${icon('sun') || icon('star')}Morning briefing</button>
      ${typeof firstWeekHtml === 'function' ? firstWeekHtml() : ''}
      <div class="w-row">
        ${widget('fleet', 'Fleet size', `<span class="w-big">${fl.length}<small>aircraft owned</small></span>
          <span class="w-stack"><i class="flight" style="width:${pct(nFlight)}%"></i><i class="avail" style="width:${pct(nAvail)}%"></i><i class="maint" style="width:${pct(nMaint)}%"></i></span>
          <span class="w-legend"><span><i class="flight"></i>${nFlight} in flight</span><span><i class="avail"></i>${nAvail} available</span><span><i class="maint"></i>${nMaint} maintenance</span></span>`, 'w-fleet', 0)}
        ${(() => {
          // truly in the air, or still on the ground (boarding, taxiing, holding at the gate, taxiing in), with the phase
          const isAir = flightInAir;
          const air = live.filter(isAir), gnd = live.filter((f: any) => !isAir(f));
          const phases: { [k: string]: number } = {};
          gnd.forEach((f: any) => { const k = String(f.phase || 'On the ground').replace(/^Delayed: .*/, 'Delayed at the gate').replace(/^Holding short: .*/, 'Holding short'); phases[k] = (phases[k] || 0) + 1; });
          const gTxt = Object.keys(phases).map(k => `${phases[k]} ${k.toLowerCase()}`).join(', ');
          const dvs = live.filter((f: any) => flightDiverted(f));
          const dvTxt = dvs.length ? `<span class="w-sub w-divert">${dvs.slice(0, 3).map((f: any) => `<span class="chip chip-divert chip-link" role="button" tabindex="0" data-act="show-flight" data-id="${esc(f.id)}" title="${esc(flightDiverted(f).why)}">${icon('alert')}${esc(f.callsign || f.reg)} diverted to ${esc(f.to)}${icon('map')}</span>`).join('')}${dvs.length > 3 ? `<small>+${dvs.length - 3} more</small>` : ''}</span>` : '';
          return widget('map', 'Active flights', `<span class="w-big">${air.length}<small>in the air now</small></span>
          <span class="w-sub">${gnd.length ? `<i class="gnd-dot"></i>${gnd.length} on the ground: ${esc(gTxt)}` : `<i class="live-dot"></i>${mine ? 'You and ' + (live.length - 1) + ' pilot' + (live.length - 1 === 1 ? '' : 's') : live.length + ' pilot' + (live.length === 1 ? '' : 's') + ' flying'}`}</span>${dvTxt}`, 'w-active', 1);
        })()}
        ${widget('maint', 'Fleet availability', `<span class="w-ring">${ring(avail)}<b class="${avail >= 100 ? 'w3' : ''}">${avail}<small>%</small></b></span>
          <span class="w-sub">${fl.length - nMaint} of ${fl.length} ready to fly</span>`, 'w-avail', 2)}
        ${widget('finance', 'Profit', `
          <span class="w-big ${profit >= 0 ? 'green' : 'red'}">${money(profit, { sign: true, compact: true })}<small>${_ovPeriod === 'year' ? (State.settings.timeMode === 'sim' ? 'Sim year ' : '') + esc(last.label) : PERIOD_NAMES[_ovPeriod]}</small></span>
          ${sparkline(series.map(p => p.rev - p.cost), 120, 28)}`, 'w-profit', 3,
          `<span class="w-seg" role="tablist">${['day', 'week', 'month', 'year'].map(k => `<span class="${_ovPeriod === k ? 'on' : ''}" data-act="ov-period" data-p="${k}" role="tab" aria-label="${PERIOD_NAMES[k]}">${k[0].toUpperCase()}</span>`).join('')}</span>`)}
      </div>
      <div class="ov-main">
        <div class="ops-map">
          <div class="map-host" id="ops-map"></div>
          <div class="map-legend"><b>Live operations</b><span>${live.length} airborne</span></div>
          <div class="map-sel" id="ops-sel"></div>
          <div class="map-tools">${mapSearchBtn()}${layerBtn()}${wxBtn()}${trafficBtn()}${view3dBtn()}</div>
          <button class="map-expand" data-act="go" data-screen="map" aria-label="Open the full map">${icon('map')}Full map</button>
        </div>
        <aside class="ops-side">
          ${myAircraftCard()}
          ${mine ? flightCard(mine) : ''}
          <div class="card attn-card">
            <div class="card-h"><b>Needs you</b></div>
            ${pendingCrash.map(l => `<button class="attn red" data-act="open-crash" data-id="${l.id}">${icon('alert')}<span><b>Crash on ${esc(l.from)} to ${esc(l.to)}</b><small>Register or disregard</small></span>${icon('chevron')}</button>`).join('')}
            ${fines.map(n => `<button class="attn amber" data-act="open-fine" data-ref="${n.ref}">${icon('shield')}<span><b>${esc(n.title)}</b><small>${esc(n.body)}</small></span>${icon('chevron')}</button>`).join('')}
            ${(State as any).incidents.filter((x: Incident) => x.status === 'open' && staffById(x.staffId) && (staffById(x.staffId).companyId === c.id || staffById(x.staffId).coPilotFor === c.id)).map((x: Incident) => `<button class="attn amber" data-act="open-incident" data-id="${x.id}">${icon('user')}<span><b>Conduct: ${esc(staffById(x.staffId).name)}</b><small>${esc(x.title)}. Discipline or dismiss</small></span>${icon('chevron')}</button>`).join('')}
          ${Object.keys(cc.blocked).map(reg => `<button class="attn red" data-act="go-hire" data-id="${/attendant/.test(cc.blocked[reg].join()) ? 'fa' : /mechanic/.test(cc.blocked[reg].join()) ? 'mech' : 'fo'}">${icon('pilots')}<span><b>${esc(reg)} can't fly</b><small>${esc(cc.blocked[reg].join(', '))}</small></span>${icon('chevron')}</button>`).join('')}
          ${openIssues.slice(0, 3).map(i => `<button class="attn ${i.severity === 'grounding' ? 'red' : 'amber'}" data-act="open-issue" data-id="${i.id}">${icon('wrench')}<span><b>${esc(i.reg)}: ${esc(i.title)}</b><small>${i.severity === 'grounding' ? 'Grounded' : 'Mechanic report'}</small></span>${icon('chevron')}</button>`).join('')}
            ${!pendingCrash.length && !fines.length && !openIssues.length && !Object.keys(cc.blocked).length && !(State as any).incidents.some((x: Incident) => x.status === 'open') ? `<p class="muted pad">All clear. Nothing needs your attention.</p>` : ''}
          </div>
        </aside>
      </div>
      <div class="card fs-card">
        <div class="card-h"><b>Fleet status</b><span class="w-legend"><span><i class="flight"></i>In flight</span><span><i class="avail"></i>Available</span><span><i class="maint"></i>Maintenance</span></span><button class="text-btn" data-act="go" data-screen="fleet">All aircraft</button></div>
        <div class="fs-grid">${fl.map(fleetStatusTile).join('')}</div>
      </div>
      ${placesCardHtml()}
    </div>`;
  },
  mount(root) {
    const host = $('#ops-map', root);
    // tapping a flight (yours, a hired pilot's or a co-op pilot's) follows it
    // tapping a flight (yours, a hired pilot's or a co-op pilot's) opens its bubble: follow, favourite, details
    _opsMap = new WorldMap(host, { interactive: true, memoKey: 'ops', onSelect: id => { if (!id) showSel(null); } });
    const pts: number[][] = [];
    liveOf().forEach(f => { const A = apt(f.from), B = f.noDest ? null : apt(f.to); if (A) pts.push(A.pos); if (B) pts.push(B.pos); if (f.pos) pts.push(f.pos); });   // an airport not loaded yet is skipped
    if (!pts.length) pts.push(apt(company().hub).pos, [apt(company().hub).pos[0] + 8, apt(company().hub).pos[1] + 4]);
    if (!_opsMap.resumeFollow()) _opsMap.fit(pts, 40);
    const mine = yourFlight(); if (mine && !_opsMap.following) _opsMap.selected = mine.id;
    (window as any).__opsShowSel = showSel;
    function showSel(id: string) {
      const box = $('#ops-sel', root); if (!box) return;
      const f = State.live.filter(x => x.id === id)[0];
      box.innerHTML = f ? `<div class="sel-pop"><button class="icon-btn sel-x" data-act="ops-sel-close" aria-label="Close">${icon('close')}</button>${flightCard(f)}</div>` : '';
    }
  },
};

/** "Your aircraft" card: the aircraft you fly, and whether the sim has the same type loaded. */
function myAircraftCard(): string {
  const c = company();
  const myA = plane(State.myReg[c.id]);
  if (!myA) return '';
  const sim: any = State.simAircraft;
  const linked = Link.status === 'connected';
  const loaded = !linked || (Link.sim && Link.sim.connected && sim.title);
  const match = loaded && sim.typeId === myA.typeId;
  const t = acType(myA.typeId);
  const msg = !linked && (State as any).linkedOnce ? `Not linked to your PC right now`
    : linked && !(Link.sim && Link.sim.connected) ? `Waiting for Flight Simulator on ${esc(Link.pc.name)}`
      : !loaded ? 'No aircraft loaded in the sim yet'
        : match ? `Matches the aircraft loaded in the sim (${esc(sim.title)})`
          : `The sim has a ${esc(sim.title)} loaded. Load the ${esc(t.model)} to fly ${esc(myA.reg)}.`;
  const ok = match && (linked || !(State as any).linkedOnce);
  return `<div class="card my-ac ${ok ? 'ok' : 'warn'}">
            <div class="card-h"><b>Your aircraft</b><button class="text-btn" data-act="pick-my-ac">Change</button></div>
            <div class="my-ac-row"><span class="my-art">${aircraftArt(myA.typeId, { color: c.color, color2: c.color2, ground: false })}</span>
              <span><b>${esc(myA.reg)}</b><small>${esc(t.maker)} ${esc(t.model)}</small></span></div>
            <div class="sim-match">${icon(ok ? 'check' : 'alert')}<span>${msg}</span></div>
          </div>`;
}

ACTIONS['ov-period'] = (el, ev) => {
  ev.stopPropagation();
  _ovPeriod = el.getAttribute('data-p'); _finPeriod = _ovPeriod; Sound.tick();
  refresh();
};

ACTIONS['pick-my-ac'] = () => {
  const c = company();
  const flyingMine = yourFlight();
  const list = State.fleet.filter(a => a.companyId === c.id);
  openLayer('modal', `
    <div class="modal-head"><div><h2>Which aircraft are you flying?</h2><small>You fly one aircraft at a time. The PC bridge checks that the same type is loaded in the simulator.</small></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
    <div class="modal-body">
      ${flyingMine ? `<p class="fine-print">${icon('info')}You're flying ${esc(flyingMine.reg)} right now. You can switch once you've landed.</p>` : ''}
      <div class="pick-grid">${list.map(a => {
        const st = fleetState(a), sel = State.myReg[c.id] === a.reg;
        const can = !flyingMine && st === 'avail';
        return `<button class="pick-ac st-${st} ${sel ? 'on' : ''}" data-act="set-my-ac" data-reg="${a.reg}" ${can || sel ? '' : 'disabled'}>
          <span class="pa-art">${aircraftArt(a.typeId, { color: c.color, color2: c.color2, ground: false })}</span>
          <b>${esc(a.reg)}</b><small>${esc(acType(a.typeId).model)}</small>${liveChip(a.reg, a.status)}</button>`;
      }).join('')}</div>
    </div>`, { cls: 'wide' });
};
ACTIONS['set-my-ac'] = el => {
  State.myReg[State.companyId] = el.getAttribute('data-reg');
  closeAll(); Sound.tick(); refresh(); toast(`You're now flying ${State.myReg[State.companyId]}`, 'ok');
};

ACTIONS['open-crash'] = el => crashPopup(el.getAttribute('data-id'));
ACTIONS['open-fine'] = el => finePopup(el.getAttribute('data-ref'));
ACTIONS['open-issue'] = el => mechanicPopup(el.getAttribute('data-id'));
ACTIONS['ops-sel-close'] = () => { const box = $('#ops-sel'); if (box) box.innerHTML = ''; Sound.tick(); };

/* ---------- Overview: your office and the courtroom ---------- */
function placesCardHtml(): string {
  const cases: any[] = ((State as any).cases || []).filter((c: any) => c.hear && c.companyId === State.companyId);
  const live = cases.filter(c => hearingWaiting(c) && !c.hear.standIn)[0], verdict = cases.filter(c => c.hear.verdictReady && !c.hear.verdictSeen)[0];
  const reports = ((State as any).incidents || []).filter((x: any) => x.status === 'open' && staffById(x.staffId)).length;
  return `<div class="card places-card">
    <button class="place office" data-act="office-open">${icon('jobs')}<span><b>My office</b><small>${reports ? `${reports} conduct ${reports === 1 ? 'report' : 'reports'} to look at: call them in` : 'Your desk, the view, the family photo'}</small></span>${icon('chevron')}</button>
    <button class="place opsroom" data-act="ops-room">${icon('clock')}<span><b>Operations</b><small>The schedule on the big screen: plan and change the flying</small></span>${icon('chevron')}</button>
    <button class="place hangar" data-act="go" data-screen="hangars">${icon('wrench')}<span><b>Hangars</b><small>${hgBusyLine()}</small></span>${icon('chevron')}</button>
    <button class="place lounge" data-act="go" data-screen="lounges">${icon('star')}<span><b>Lounges</b><small>${(() => { const n = typeof lgList === 'function' ? lgList().length : 0; return n ? `${n} ${n === 1 ? 'lounge' : 'lounges'}: walk in and have a coffee` : 'Build one at a hub, then walk in'; })()}</small></span>${icon('chevron')}</button>
    <button class="place court ${live || verdict ? 'live' : ''}" data-act="court-enter">${icon('shield')}<span><b>${live ? 'Court is in session' : verdict ? 'The verdict is in' : 'The courtroom'}</b><small>${live ? 'Go to court and answer for the airline' : verdict ? 'Hear it read out in court' : 'No hearing today: walk in and look around'}</small></span>${icon('chevron')}</button>
  </div>`;
}
/** The menu's Court entry lights up while a hearing or a verdict waits for you. */
setInterval(() => {
  try {
    const d = document.querySelector('[data-court-dot]') as HTMLElement; if (!d) return;
    const on = ((State as any).cases || []).some((c: any) => c.hear && c.companyId === State.companyId && ((hearingWaiting(c) && !c.hear.standIn) || (c.hear.verdictReady && !c.hear.verdictSeen)));
    d.hidden = !on;
  } catch (e) { /* not ready */ }
}, 3000);
