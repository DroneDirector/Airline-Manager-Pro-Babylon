// Routes: scheduled routes with any number of stops, plus a route builder.

function legChain(legs: string[]): string {
  return `<span class="chain">${legs.map((l, i) => `${i ? '<i></i>' : ''}<b>${esc(l)}</b>`).join('')}</span>`;
}

function routeDistance(legs: string[]): number {
  let d = 0; for (let i = 1; i < legs.length; i++) d += gcDistanceNm(apt(legs[i - 1]).pos, apt(legs[i]).pos); return d;
}

SCREENS.routes = {
  title: 'Routes', icon: 'routes',
  render() {
    const rs = State.routes.filter(r => r.companyId === State.companyId);
    const countries: { [k: string]: boolean } = {};
    rs.forEach(r => r.legs.forEach(l => countries[apt(l).country] = true));
    return `
    <div class="screen-head">
      <div><h1>Routes</h1><p class="sub">${rs.length} routes to ${Object.keys(countries).length} countries</p></div>
      <button class="btn primary" data-act="new-route">${icon('plus')}New route</button>
    </div>
    ${hubCardHtml()}
    ${soloMode() ? partnersHtml() + loungesCardHtml() + alliancesHtml() + slotsSpareHtml() : ''}
    ${sortBar('routes', ROUTE_SORTS, 'Find a route')}
    <div class="route-list">${sortList('routes', rs, ROUTE_SORTS, (r: any) => `${r.code} ${r.legs.join(' ')} ${acType(r.typeId).model}`).map((r, i) => {
      const t = acType(r.typeId), p = r.pilotId ? pilot(r.pilotId) : null;
      const dist = routeDistance(r.legs);
      const dem = routeDemandPct(r), fa = r.legs.length > 1 && !r.test ? classFares(r.typeId, r.legs[0], r.legs[1], r).y : 0, comp = r.test ? 0 : competitorsOn(r.legs[0], r.legs[1]).length;
      return `<button class="route-row" data-act="route-detail" data-id="${r.id}" style="--i:${i}">
        <span class="rr-code">${esc(r.code)}</span>
        <span class="rr-chain">${r.test ? `<span class="chain"><b>${esc(r.legs[0])}</b></span><small>Test flight${r.flownAt ? ', flown ' + esc(dateStr(new Date(r.flownAt)).slice(0, 16)) : ', not flown yet'}</small>` : `${legChain(r.legs)}<small>${r.legs.length - 1} leg${r.legs.length > 2 ? 's' : ''}, ${num(dist)} nm, ${esc(r.days)}</small>`}</span>
        <span class="rr-ac">${esc(t.model)}<small>${p ? (p.you ? 'You fly this' : esc(p.name)) : 'No pilot yet'}</small></span>
        <span class="rr-demand"><small>${r.test ? 'Demand' : `Load ${dem}%${comp ? ' · ' + comp + ' rival' + (comp > 1 ? 's' : '') : ''}`}</small><span class="cond cond-${dem > 80 ? 'good' : dem > 60 ? 'fair' : 'poor'}"><i style="width:${Math.min(100, dem)}%"></i></span></span>
        <span class="rr-yield"><small>Economy fare</small><b>${r.test ? '—' : money(fa)}</b></span>
      </button>`;
    }).join('') || emptyState('No routes yet', 'Create your first route from your hub.', 'New route', 'new-route')}</div>`;
  },
};

let _nr = { stops: [] as string[], typeId: '', test: false, q: '' };
/** Usable range: published range minus an IFR reserve (about 45 minutes at cruise speed). */
function usableRange(t: AircraftType): number { return Math.round(t.rangeNm - t.cruiseKt * 0.75); }
function legBlockMin(t: AircraftType, nm: number): number { return Math.round(nm / t.cruiseKt * 60 + 25); }

function newRouteHtml(): string {
  const c = company();
  const fleetTypes = State.fleet.filter(a => a.companyId === c.id).map(a => a.typeId).filter((t, i, arr) => arr.indexOf(t) === i);
  const t = _nr.typeId ? acType(_nr.typeId) : null;
  const max = t ? usableRange(t) : 99999;
  const legs = _nr.stops.slice(1).map((s, i) => { const d = gcDistanceNm(apt(_nr.stops[i]).pos, apt(s).pos); return { from: _nr.stops[i], to: s, d, ok: d <= max, block: t ? legBlockMin(t, d) : 0 }; });
  const bad = legs.filter(l => !l.ok);
  const last = _nr.stops[_nr.stops.length - 1];
  const crewMax = t ? Math.max.apply(null, legs.map(l => pilotsNeeded(t, l.block)).concat([multiCrew(t) ? 2 : 1])) : 0;
  return `
    <div class="modal-head"><div><h2>${_nr.test ? 'New test flight' : 'New route'}</h2><small>${_nr.test ? 'Take off and land at the same airport, for example after maintenance. Only you can set one up.' : 'Add as many stops as you like. Every leg must be within the aircraft\'s real-world range.'}</small></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
    <div class="modal-body nr">
      <label class="tg-row nr-test"><span><b>Test flight</b><small>From one airport and back to the same airport, without passengers</small></span><button class="tg ${_nr.test ? 'on' : ''}" role="switch" aria-checked="${_nr.test}" data-act="nr-test"><i></i></button></label>
      <div class="nr-chain">${_nr.stops.map((s, i) => `<span class="nr-stop ${i && !legs[i - 1].ok ? 'bad' : ''}">${i ? `<i></i><em>${num(legs[i - 1].d)} nm</em>` : ''}<b>${esc(s)}</b><small>${esc(apt(s).city)}</small>${i ? `<button class="x" data-act="nr-remove" data-i="${i}" aria-label="Remove ${esc(s)}">${icon('close')}</button>` : ''}</span>`).join('')}
        <span class="nr-hint">${_nr.stops.length < 2 ? 'Pick a destination below' : `${_nr.stops.length - 1} legs, ${num(routeDistance(_nr.stops))} nm`}</span></div>
      ${t ? `<div class="nr-range ${bad.length ? 'bad' : ''}">${icon(bad.length ? 'alert' : 'fuel')}<span>${bad.length
        ? `${bad.map(l => `${l.from} to ${l.to} is ${num(l.d)} nm`).join(', ')}: too far for the ${esc(t.model)} (${num(max)} nm with fuel reserves). Add a fuel stop or pick a longer-range aircraft.`
        : `${esc(t.model)}: up to ${num(max)} nm per leg with fuel reserves (range ${num(t.rangeNm)} nm).${crewMax > 2 ? ` The longest leg needs ${crewMax} pilots.` : ''}`}</span></div>` : ''}
      <h3>${_nr.test ? 'Airport' : 'Add a stop'}</h3>
      <label class="apt-search">${icon('pin')}<input id="nr-q" type="search" placeholder="Search ${World.ready ? num(World.list.length + Object.keys(AIRPORTS).length + (_nr.typeId && acType(_nr.typeId).cls === 'helicopter' ? World.helis.length : 0)) : ''} ${_nr.typeId && acType(_nr.typeId).cls === 'helicopter' ? 'airports and helipads' : 'airports'} by ICAO, IATA, name or city" value="${esc(_nr.q)}" autocomplete="off"></label>
      <div class="apt-grid" id="nr-grid">${nrGridHtml()}</div>
      <h3>Aircraft</h3>
      <div class="seg wrap">${fleetTypes.map(id => `<button class="${_nr.typeId === id ? 'on' : ''}" data-act="nr-type" data-t="${id}">${esc(acType(id).model)} <small>${num(usableRange(acType(id)))} nm</small></button>`).join('')}</div>
      <div class="modal-actions"><button class="btn ghost" data-act="close-layer">Cancel</button><button class="btn primary" data-act="nr-save" ${(_nr.test ? _nr.stops.length < 1 : _nr.stops.length < 2 || bad.length) ? 'disabled' : ''}>${_nr.test ? 'Create test flight' : 'Create route'}</button></div>
    </div>`;
}
ACTIONS['new-route'] = () => {
  const c = company();
  const ft = State.fleet.filter(a => a.companyId === c.id)[0];
  _nr = { stops: [c.hub], typeId: ft ? ft.typeId : '', test: false, q: '' };
  openLayer('modal', newRouteHtml(), { cls: 'wide nr-pop' });
};
function rerenderNr() { const p = $('.nr-pop .panel'); if (p) patchHtml(p, newRouteHtml()); }
/** Airports to add: your search across every airport, otherwise the main airports near the last stop. */
function nrGridHtml(): string {
  const c = company(), last = _nr.stops[_nr.stops.length - 1], t = _nr.typeId ? acType(_nr.typeId) : null, max = t ? usableRange(t) : 99999;
  const L = apt(last);
  const heli = !!t && t.cls === 'helicopter';
  let list: Airport[] = _nr.q.trim() ? World.search(_nr.q, 36, a => _nr.test || a.icao !== last, heli)
    : Object.keys(AIRPORTS).map(k => AIRPORTS[k]).filter(a => a.icao !== 'DEP' && (_nr.test || a.icao !== last) && (heli || !isHelipad(a.icao)) && (c.kind === 'bush' ? bushApt(a.icao) : airlineApt(a.icao)));
  if (heli && !_nr.q.trim() && L) list = list.concat(World.helisNear(L.pos, 60).filter(a => a.icao !== last).slice(0, 30));   // hospitals, helidecks and heliports nearby
  if (!_nr.q.trim() && L) list = list.slice().sort((a, b) => gcDistanceNm(L.pos, a.pos) - gcDistanceNm(L.pos, b.pos));
  if (!_nr.q.trim()) list = list.slice(0, 60);   // the nearest ones; the search finds the rest
  return list.map(a => {
    const d = L ? gcDistanceNm(L.pos, a.pos) : 0, far = !!t && d > max && !_nr.test;
    return `<button class="apt-btn ${far ? 'far' : ''}" data-act="nr-add" data-icao="${esc(a.icao)}" ${far ? 'disabled' : ''}><b>${esc(a.icao)}${isHelipad(a.icao) ? ` <em class="hp-chip">${helipadKind(a.icao)}</em>` : ''}</b><small>${esc(a.name !== a.icao ? a.name : a.city)}${a.country ? ', ' + esc(a.country) : ''}</small><small class="d">${_nr.test ? '' : num(d) + ' nm' + (far ? ', too far' : '')}</small></button>`;
  }).join('') || `<p class="fine-print">No airport matches "${esc(_nr.q)}".</p>`;
}
document.addEventListener('input', e => {
  const el = e.target as HTMLInputElement;
  if (el && el.id === 'nr-q') { _nr.q = el.value; const g = $('#nr-grid'); if (g) g.innerHTML = nrGridHtml(); }
});
ACTIONS['nr-add'] = el => { const k = el.getAttribute('data-icao'); registerWorldAirport(k); if (_nr.test) _nr.stops = [k]; else _nr.stops.push(k); _nr.q = ''; Sound.tick(); rerenderNr(); };
ACTIONS['nr-test'] = () => { _nr.test = !_nr.test; _nr.stops = [_nr.stops[0] || company().hub]; Sound.tick(); rerenderNr(); };
ACTIONS['nr-remove'] = el => { _nr.stops.splice(parseInt(el.getAttribute('data-i'), 10), 1); Sound.tick(); rerenderNr(); };
ACTIONS['nr-type'] = el => { _nr.typeId = el.getAttribute('data-t'); Sound.tick(); rerenderNr(); };
ACTIONS['nr-save'] = () => {
  const t = acType(_nr.typeId);
  if (_nr.test) {
    const c = company(), code = c.icao + 'T' + (State.routes.filter(r => r.test).length + 1);
    State.routes.push({ id: uid(), companyId: c.id, code, legs: [_nr.stops[0], _nr.stops[0]], days: 'Once', typeId: _nr.typeId, demand: 0, yieldPerPax: 0, test: true });
    closeAll(); refresh(); toast(`Test flight ${code} created. Assign a pilot under Pilots.`, 'ok'); return;
  }
  if (t && _nr.stops.slice(1).some((x, i) => gcDistanceNm(apt(_nr.stops[i]).pos, apt(x).pos) > usableRange(t))) { toast('A leg is too far for this aircraft', 'warn'); return; }
  // runways: long enough, wide enough and the right surface at every airport on the route
  const rwy = t ? routeRunwayProblem(t.id, _nr.stops) : '';
  if (rwy) { toast(rwy, 'warn'); return; }
  if (t && !bizRouteGate(t.id, _nr.stops)) return;
  const lim = t ? _nr.stops.map((x, i) => i ? legRunwayCheck(t.id, _nr.stops[i - 1], x) : null).filter(x => x && !x.full)[0] : null;
  if (lim) toast(lim.why, 'info');
  const c = company();
  const code = c.icao + (700 + State.routes.length);
  State.routes.push({ id: uid(), companyId: c.id, code, legs: _nr.stops.slice(), days: 'Daily', typeId: _nr.typeId, demand: 60 + Math.round(Math.random() * 30), yieldPerPax: 140 + Math.round(Math.random() * 200) });
  try { bizRouteCreated(State.routes[State.routes.length - 1]); } catch (e) { /* ignore */ }
  closeAll(); refresh(); toast(`Route ${code} created`, 'ok');
  // the local paper writes about it
  try { const nr = State.routes[State.routes.length - 1]; setTimeout(() => newsRouteLaunch(nr), 1200); } catch (e) { /* ignore */ }
};

/* ---------- A route's business: fares, demand, competitors, fuel and fees ---------- */
let _rdId = '';
function routeDetailHtml(): string {
  const r = State.routes.filter(x => x.id === _rdId)[0]; if (!r) return '';
  const t = acType(r.typeId), fb: any = (r as any).fares || {}, f = { y: fb.y || 1, j: fb.j || 1, f: fb.f || 1 }, spd = seatsPerDay(r), boost = marketingBoost(r.companyId, r.id);
  const legs = r.legs.slice(1).map((to, i) => ({ from: r.legs[i], to }));
  const fr = legs.length ? classFares(r.typeId, legs[0].from, legs[0].to, r) : { y: 0, j: 0, f: 0 };
  const step = (k: 'y' | 'j' | 'f', label: string, val: number) => `<div class="fare-row"><span><b>${label}</b><small>${money(val)} on ${esc(legs[0].from)}–${esc(legs[0].to)}</small></span>
    <div class="stepper"><button class="icon-btn" data-act="rd-fare" data-k="${k}" data-d="-5" aria-label="Lower">−</button><b class="${f[k] > 1.001 ? 'amber' : f[k] < 0.999 ? 'green' : ''}">${Math.round(f[k] * 100)}%</b><button class="icon-btn" data-act="rd-fare" data-k="${k}" data-d="5" aria-label="Higher">${icon('plus')}</button></div></div>`;
  const prem = State.fleet.some(a => a.typeId === r.typeId && a.companyId === r.companyId && (cabinOf(a).j || cabinOf(a).f));
  return `<div class="modal-head"><div><h2>${esc(r.code)} ${legChain(r.legs)}</h2><small>${esc(t.maker)} ${esc(t.model)}, ${esc(r.days)}, about ${num(spd)} seats a day each way</small></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
  <div class="modal-body rdet">
    ${bizRouteInfo(r)}
    <h3>Your fares</h3>
    <p class="fine-print">${icon('info')}100% is the usual market fare. Lower fares win passengers from your rivals and bring extra travellers; higher fares earn more per seat but fill fewer.</p>
    <label class="tg-row"><span><b>Flexible fares</b><small>${(r as any).flex ? `Today your fares are at ${Math.round(flexK(r) * 100)}% of what you set below. ` : ''}Fares rise as flights fill and drop when seats stay empty, every day, with the seasons and special days. Up to 30% dearer on full flights, down to 25% cheaper on empty ones.</small></span><button class="tg ${(r as any).flex ? 'on' : ''}" role="switch" aria-checked="${!!(r as any).flex}" data-act="rd-flex"><i></i></button></label>
    ${step('y', 'Economy', fr.y)}${prem ? step('j', 'Business', fr.j) + step('f', 'First', fr.f) : ''}
    <h3>Legs</h3>
    <div class="rd-legs">${legs.map(l => {
      const o = routeOutlook(r.companyId, l.from, l.to, spd);
      return `<div class="rd-leg">
        <div class="rd-lh"><b>${esc(l.from)} → ${esc(l.to)}</b><small>${seasonLabel(o.season)} · ${num(gcDistanceNm(apt(l.from).pos, apt(l.to).pos))} nm</small></div>
        <div class="kv-row">
          <div><small>Travellers a day</small><b>${num(o.market)}</b></div>
          <div><small>Choose you</small><b>${Math.round(o.share * 100)}%</b></div>
          <div><small>Expected load</small><b class="${o.lf > 0.8 ? 'green' : o.lf < 0.55 ? 'red' : ''}">${Math.round(o.lf * 100)}%</b></div>
          <div><small>Fuel at ${esc(l.from)}</small><b>$${fuelPrice(l.from).toFixed(2)}/kg</b></div>
          <div><small>Landing at ${esc(l.to)}</small><b>${money(landingFee(l.to, t))}</b></div>
          <div><small>Parking at ${esc(l.to)}</small><b>${money(parkingFee(l.to, t))}</b></div>
        </div>
        <div class="rd-comp">${o.comp.length ? o.comp.map(c => `<span class="comp"><b>${esc(c.name)}</b><small>${c.daily} a day · fares ${Math.round(c.fare * 100)}% · rated ${(c.quality / 20).toFixed(1)}/5 · since ${esc(c.since)}</small></span>`).join('') : `<span class="comp none">${icon('check')}<b>No other airline on this route</b></span>`}</div>
      </div>`;
    }).join('')}</div>
    <label class="tg-row"><span><b>Tanker fuel</b><small>Where the next stop's fuel costs more, carry the next leg's fuel from here. It costs about 3.5% extra burn per hour to carry the weight, so the app only does it when it saves money.</small></span><button class="tg ${(r as any).tanker ? 'on' : ''}" role="switch" aria-checked="${!!(r as any).tanker}" data-act="rd-tanker"><i></i></button></label>
    <div class="rd-mk"><span>${icon('star')}<b>${boost ? `Marketing running: about ${Math.round(boost * 100)}% more passengers` : 'No marketing on this route'}</b><small>A route campaign brings extra passengers while it runs.</small></span><button class="btn ghost sm" data-act="mk-campaign" data-route="${r.id}">Promote</button></div>
    <div class="modal-actions"><button class="btn ghost danger" data-act="rd-close">${icon('trash')}Close route</button><button class="btn ghost" data-act="sb-plan" data-from="${esc(r.legs[0])}" data-to="${esc(r.legs[1] || r.legs[0])}">${icon('routes')}Plan on SimBrief</button><button class="btn primary" data-act="close-layer">Done</button></div>
  </div>`;
}
function rerenderRd() { const p = $('.rd-pop .panel'); if (p) patchHtml(p, routeDetailHtml()); }
ACTIONS['route-detail'] = el => {
  const r = State.routes.filter(x => x.id === el.getAttribute('data-id'))[0]; if (!r || r.test) return;
  _rdId = r.id; Sound.tick(); openLayer('modal', routeDetailHtml(), { cls: 'wide rd-pop' });
};
ACTIONS['rd-fare'] = el => {
  const r: any = State.routes.filter(x => x.id === _rdId)[0]; if (!r) return;
  const k = el.getAttribute('data-k'), d = +el.getAttribute('data-d') / 100;
  r.fares = r.fares || { y: 1, j: 1, f: 1 };
  r.fares[k] = Math.round(clamp(r.fares[k] + d, 0.6, 1.6) * 100) / 100;
  Sound.tick(); Store.soon(); rerenderRd();
};
ACTIONS['rd-flex'] = () => { const r: any = State.routes.filter(x => x.id === _rdId)[0]; if (!r) return; r.flex = !r.flex; r._flexDay = ''; Sound.tick(); Store.soon(); rerenderRd(); };
ACTIONS['rd-tanker'] = () => { const r: any = State.routes.filter(x => x.id === _rdId)[0]; if (!r) return; r.tanker = !r.tanker; Sound.tick(); Store.soon(); rerenderRd(); };
