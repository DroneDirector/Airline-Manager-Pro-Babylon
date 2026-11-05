// Dispatch: everything for your next flight in one place. Your SimBrief flight plan, the flight plan for
// the simulator, the real weather, who is online on VATSIM and IVAO, ACARS messages, and the airline's
// public page.
let _wxQ = '', _acarsTo = '', _acarsTxt = '';

function nextLeg(): { from: string; to: string } {
  const ofp = SimBrief.ofp();
  const l: any = State.today.filter(x => x.status === 'active')[0] || State.today.filter(x => x.status === 'next')[0];
  if (l && l.from && l.to) return { from: l.from, to: l.to };
  if (ofp) return { from: ofp.from, to: ofp.to };
  const a = plane((State as any).myReg[State.companyId]);
  return { from: a ? a.location : company().hub, to: '' };
}

function metarCard(icao: string, role: string): string {
  const A = apt(icao); if (!A) return '';
  const m = LiveWx.get(icao);
  return `<div class="wx-card"><div class="wx-h"><b>${esc(icao)}</b><small>${esc(role)} · ${esc(A.name)}</small>${m && m.cat ? `<span class="wx-cat c-${esc(m.cat)}">${esc(m.cat)}</span>` : ''}</div>
    ${m && m.raw ? `<code>${esc(m.raw)}</code>${m.taf ? `<code class="taf">${esc(m.taf)}</code>` : ''}<small class="muted">${m.dir >= 0 ? `Wind ${String(m.dir).padStart(3, '0')}° ${m.kt} kt${m.gust ? ' gusting ' + m.gust : ''}` : m.kt ? 'Wind variable' : 'Calm'}${isFinite(m.temp) ? `, ${m.temp}°C` : ''}${m.qnh ? `, QNH ${m.qnh}` : ''}. Runway in use: ${(() => { const r = activeRunway(icao); return r ? esc(r.name) : '—'; })()}</small>`
      : `<small class="muted">${!LiveWx.on() ? 'Live weather is off (Settings → Online services).' : m ? 'No weather report from this airport.' : 'Getting the latest report…'}</small>`}
    ${Network.which() !== 'off' ? (() => { const at = Network.atcAt(icao); return at.length ? `<div class="wx-atc">${at.map(x => `<span class="chip">${esc(x.net)} ${esc(x.callsign)} ${esc(x.freq)}</span>`).join('')}</div>` : `<small class="muted">No ${esc(Network.which() === 'both' ? 'VATSIM or IVAO' : Network.which().toUpperCase())} controllers online here.</small>`; })() : ''}
  </div>`;
}

SCREENS.dispatch = {
  title: 'Dispatch', icon: 'dispatch',
  render() {
    const S: any = State.settings, c = company(), leg = nextLeg(), ofp = SimBrief.ofp();
    const a = plane((State as any).myReg[c.id]);
    const ids = [leg.from, leg.to, ofp && ofp.altn, c.hub].filter((x, i, arr) => x && arr.indexOf(x) === i);
    if (LiveWx.on()) LiveWx.fetch(ids.filter(k => !LiveWx.cache[k] || Date.now() - LiveWx.cache[k].at > 15 * 60e3));
    const ours = Network.ours(), me = Network.me();
    return `<div class="screen-head"><div><h1>Dispatch</h1><p class="sub">Your next flight: plan, flight plan for the simulator, weather${netChoices().length > 1 ? ', networks' : ''}${svcOk('hoppie') ? ', messages' : ''}</p></div>
      <button class="btn ghost" data-act="settings" data-section="online">${icon('gear')}Online services</button></div>
    ${myRecencyNote()}${fuelPlanHtml(leg.from, leg.to)}${briefingHtml([leg.from, leg.to, ofp && ofp.altn])}
    <div class="disp">
      <div class="card disp-leg">
        <div class="card-h"><b>Next flight</b><small>${a ? esc(a.reg) + ', ' + esc(acType(a.typeId).model) : 'No aircraft chosen'}</small></div>
        <div class="dl-route"><b>${esc(leg.from || '—')}</b><i></i><b>${esc(leg.to || '—')}</b></div>
        ${leg.from && leg.to ? `<small class="muted">${num(gcDistanceNm(apt(leg.from).pos, apt(leg.to).pos))} nm · ${seasonLabel(routeSeason(leg.from, leg.to))} · fuel at ${esc(leg.from)} $${fuelPrice(leg.from).toFixed(2)}/kg</small>` : '<small class="muted">Plan a flight on SimBrief or add a leg to today\'s schedule.</small>'}
        <div class="btn-row">
          ${leg.from && leg.to ? `<button class="btn primary sm" data-act="sb-plan" data-from="${esc(leg.from)}" data-to="${esc(leg.to)}">${icon('routes')}Plan on SimBrief</button>
          <button class="btn ghost sm" data-act="pln-send" data-from="${esc(leg.from)}" data-to="${esc(leg.to)}">${icon('pc')}Flight plan to the simulator</button>
          <button class="btn ghost sm" data-act="pln-save" data-from="${esc(leg.from)}" data-to="${esc(leg.to)}">${icon('download')}Save .PLN</button>` : ''}
        </div>
      </div>

      ${svcOk('simbriefApi') ? `<div class="card disp-ofp">
        <div class="card-h"><b>SimBrief flight plan</b>${SimBrief.user() ? `<button class="btn ghost sm" data-act="sb-fetch" ${SimBrief.busy ? 'disabled' : ''}>${icon('sync')}${SimBrief.busy ? 'Getting it…' : 'Get my latest'}</button>` : `<button class="btn ghost sm" data-act="settings" data-section="online">Add your SimBrief name</button>`}</div>
        ${SimBrief.error ? `<p class="lic-msg bad">${icon('alert')}${esc(SimBrief.error)}</p>` : ''}
        ${ofp ? `<div class="ofp-h"><b>${esc(ofp.flight || '')} ${esc(ofp.from)} → ${esc(ofp.to)}</b><small>${esc(ofp.acType)} ${esc(ofp.reg)} · FL${Math.round(ofp.cruiseFt / 100)} · ${num(ofp.nm)} nm · ${hours(ofp.blockMin)} block${ofp.altn ? ' · alternate ' + esc(ofp.altn) : ''}</small></div>
          <code class="ofp-route">${esc(ofp.route)}</code>
          <div class="kv-row">
            <div><small>Passengers</small><b>${num(ofp.pax)}</b></div><div><small>Cargo</small><b>${num(ofp.cargoKg)} kg</b></div><div><small>Zero fuel weight</small><b>${num(ofp.zfwKg)} kg</b></div>
            <div><small>Block fuel</small><b>${num(ofp.fuel.ramp)} kg</b></div><div><small>Trip</small><b>${num(ofp.fuel.trip)} kg</b></div><div><small>Reserve</small><b>${num(ofp.fuel.reserve)} kg</b></div>
            <div><small>Take-off weight</small><b>${num(ofp.towKg)} kg</b></div><div><small>Landing weight</small><b>${num(ofp.lawKg)} kg</b></div><div><small>Fuel cost here</small><b>${money(Math.round(ofp.fuel.ramp * fuelPrice(ofp.from)), { compact: true })}</b></div>
          </div>
          <div class="btn-row"><button class="btn ghost sm" data-act="ofp-plan">${icon('routes')}Use in the Flight planner</button><button class="btn primary sm" data-act="pln-send" data-from="${esc(ofp.from)}" data-to="${esc(ofp.to)}">${icon('pc')}Send to the simulator</button><button class="btn ghost sm" data-act="pln-save" data-from="${esc(ofp.from)}" data-to="${esc(ofp.to)}">${icon('download')}Save .PLN</button><button class="btn ghost sm" data-act="ofp-use">${icon('routes')}Make it my next leg</button></div>
          <small class="muted">Fetched ${esc(dateStr(new Date(ofp.at)))}. The simulator flight plan follows SimBrief's waypoints.</small>`
        : `<p class="fine-print">${icon('info')}Plan your flight on SimBrief, then get it here: route, fuel and weights, and a flight plan for the simulator in one tap.</p>`}
      </div>` : ''}

      <div class="card disp-wx">
        <div class="card-h"><b>Weather</b><span class="wx-q"><input id="wx-q" class="inp" maxlength="4" placeholder="ICAO" value="${esc(_wxQ)}" autocomplete="off" autocapitalize="characters"><button class="btn ghost sm" data-act="wx-look">${icon('search')}</button></span></div>
        <div class="wx-list">${(_wxQ && apt(_wxQ) ? [metarCard(_wxQ, 'Looked up')] : []).concat([leg.from && metarCard(leg.from, 'Departure'), leg.to && metarCard(leg.to, 'Arrival'), ofp && ofp.altn && ofp.to === leg.to && metarCard(ofp.altn, 'Alternate')].filter(Boolean)).join('') || '<p class="fine-print">No flight planned.</p>'}</div>
        <small class="muted">Real reports from aviationweather.gov. The wind sets the runway in use for every flight in the app.</small>
      </div>

      ${netChoices().length > 1 ? `<div class="card disp-net">
        <div class="card-h"><b>Online networks</b><small>${Network.which() === 'off' ? 'Off' : Network.at ? 'Updated ' + Math.max(0, Math.round((Date.now() - Network.at) / 60000)) + ' min ago' : 'Connecting…'}</small></div>
        ${Network.which() === 'off' ? `<p class="fine-print">${icon('info')}Show VATSIM or IVAO: controllers at your airports, your airline's flights online and their traffic on the map.</p><button class="btn ghost sm" data-act="settings" data-section="online">Switch on</button>`
          : `${Network.error && !Network.at ? `<p class="lic-msg bad">${icon('alert')}${esc(Network.error)}</p>` : ''}
          <div class="kv-row"><div><small>Pilots online</small><b>${num(Network.pilots.length)}</b></div><div><small>Controllers</small><b>${num(Network.atc.filter(x => !/ATIS/.test(x.callsign)).length)}</b></div><div><small>You</small><b>${me ? esc(me.net + ' ' + me.callsign) : 'Not online'}</b></div></div>
          <h4>${esc(c.name)} online</h4>
          <div class="net-ours">${ours.map(p => `<span class="chip">${esc(p.net)} ${esc(p.callsign)} ${esc(p.from)}→${esc(p.to)} ${p.alt ? 'FL' + Math.round(p.alt / 100) : ''}</span>`).join('') || `<small class="muted">No flights with callsigns starting ${esc(c.icao)} online right now.</small>`}</div>`}
      </div>` : ''}

      ${svcOk('hoppie') ? `<div class="card disp-acars">
        <div class="card-h"><b>ACARS</b><small>${Acars.code() ? 'Hoppie, as ' + esc(Acars.station()) : 'Not set up'}</small></div>
        ${Acars.code() ? `${Acars.error ? `<p class="lic-msg bad">${icon('alert')}${esc(Acars.error)}</p>` : ''}
          <div class="acars-send"><input id="acars-to" class="inp" maxlength="8" placeholder="Callsign" value="${esc(_acarsTo || (_myCallsign ? _myCallsign.callsign : c.icao + (100 + (_hashStr(a ? a.reg : '') % 800))))}" autocapitalize="characters"><input id="acars-txt" class="inp" maxlength="200" placeholder="Message to the aircraft" value="${esc(_acarsTxt)}"><button class="btn primary sm" data-act="acars-send">${icon('radio')}Send</button></div>
          <div class="acars-log">${Acars.log().slice(0, 20).map(m => `<div class="acars-m ${m.out ? 'out' : 'in'}"><small>${esc(dateStr(new Date(m.at)).slice(11))} ${m.out ? '→ ' + esc(m.to) : '← ' + esc(m.from)}</small><span>${esc(m.text)}</span></div>`).join('') || '<small class="muted">No messages yet. The load sheet goes to your aircraft at blocks off, the arrival information at top of descent.</small>'}</div>`
          : `<p class="fine-print">${icon('info')}With a free Hoppie logon code, the airline sends your load sheet and arrival information to your aircraft's ACARS (Fenix, PMDG, iniBuilds and others), and your messages from the aircraft show up here.</p><button class="btn ghost sm" data-act="settings" data-section="online">Set up ACARS</button>`}
      </div>` : ''}

      <div class="card disp-page">
        <div class="card-h"><b>Public airline page</b></div>
        <p class="fine-print">${icon('info')}A page about ${esc(c.name)} to share anywhere: fleet, routes, numbers, pilots, smoothest landings and the latest flights. It opens in any browser.</p>
        <div class="btn-row"><button class="btn ghost sm" data-act="page-preview">${icon('focus')}Preview</button><button class="btn primary sm" data-act="page-save">${icon('share')}Save the page</button>${Online.webhook() ? `<button class="btn ghost sm" data-act="page-discord">Post a summary to Discord</button>` : ''}</div>
      </div>
    </div>`;
  },
};

ACTIONS['sb-plan'] = el => {
  const url = SimBrief.planUrl(el.getAttribute('data-from'), el.getAttribute('data-to'), (State as any).myReg[State.companyId]);
  Sound.tick();
  try { window.open(url, '_blank'); } catch (e) { toast(url, 'info'); }
};
ACTIONS['sb-fetch'] = () => { Sound.tick(); const p = SimBrief.fetch(); refresh(); p.then(o => { refresh(); toast(`SimBrief: ${o.from} to ${o.to}`, 'ok'); }, () => refresh()); };
ACTIONS['pln-send'] = el => {
  const f = el.getAttribute('data-from'), t = el.getAttribute('data-to'); Sound.tick();
  sendPlnToPc(f, t).then(path => toast(`Flight plan saved on the PC: ${path}. Load it in the simulator's world map.`, 'ok'), (e: any) => toast((e && e.message) || 'Not sent', 'warn'));
};
ACTIONS['pln-save'] = el => { const p = buildPln(el.getAttribute('data-from'), el.getAttribute('data-to')); if (!p) return; saveTextFile(p.name, 'application/octet-stream', p.text).then(ok => { if (ok) toast(`${p.name} saved`, 'ok'); }); };
ACTIONS['ofp-use'] = () => {
  const o = SimBrief.ofp(); if (!o) return;
  const S: any = State, a = plane(S.myReg[State.companyId]);
  State.today.forEach(l => { if (l.status === 'next') l.status = 'planned'; });
  State.today.push({ from: o.from, to: o.to, dep: dateStr(new Date()).slice(11), reg: a ? a.reg : '', status: 'next' } as any);
  if (S.myLoad && o.pax) { S.myLoad.pax = o.pax; S.myLoad.cargoKg = o.cargoKg; S.myLoad.fuelKg = o.fuel.ramp; S.myLoad.tripFuelKg = o.fuel.trip; S.myLoad.reserveKg = o.fuel.reserve; }
  Store.save(); Sound.tick(); refresh(); toast(`${o.from} to ${o.to} is your next leg`, 'ok');
};
ACTIONS['wx-look'] = () => { const v = (($('#wx-q') as HTMLInputElement || {} as any).value || '').trim().toUpperCase(); _wxQ = v; if (v && !apt(v)) { try { registerWorldAirport(v); } catch (e) { /* ignore */ } } if (v && !apt(v)) { toast(`${v} isn't an airport the app knows`, 'warn'); return; } if (v) LiveWx.fetch([v]); refresh(); };
ACTIONS['acars-send'] = () => {
  const to = (($('#acars-to') as HTMLInputElement || {} as any).value || '').trim().toUpperCase(), txt = (($('#acars-txt') as HTMLInputElement || {} as any).value || '').trim();
  _acarsTo = to; _acarsTxt = txt;
  if (!to || !txt) { toast('Enter a callsign and a message', 'warn'); return; }
  Acars.send(to, txt).then(() => { _acarsTxt = ''; refresh(); toast(`Sent to ${to}`, 'ok'); }, (e: any) => { refresh(); toast((e && e.message) || 'Not sent', 'warn'); });
};
ACTIONS['page-preview'] = () => {
  const html = airlinePageHtml();
  openLayer('modal', `<div class="modal-head"><div><h2>${esc(company().name)}</h2><small>The public airline page</small></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
    <div class="modal-body page-prev"><iframe sandbox="" title="Airline page" srcdoc="${esc(html)}"></iframe></div>`, { cls: 'wide' });
};
ACTIONS['page-save'] = () => { const c = company(); saveTextFile(`${c.name.replace(/[^A-Za-z0-9]+/g, '-')}.html`, 'text/html', airlinePageHtml()).then(ok => { if (ok) toast('Airline page saved. Share it or put it on any website.', 'ok'); }); };
ACTIONS['page-discord'] = () => {
  const c = company(), fl = fleetOf(c.id);
  Online.discord('any', c.name, `${fl.length} aircraft, ${State.routes.filter(r => r.companyId === c.id && !r.test).length} routes, popularity ${Math.round(c.reputation || 0)}/100.`, [['Hub', c.hub], ['Balance', money(c.balance, { compact: true })], ['Flights logged', num(State.logbook.length)]]);
  toast('Posted to Discord', 'ok');
};

/** Your SimBrief flight plan as the plan flights on its route fly (Flight planner). */
ACTIONS['ofp-plan'] = () => {
  const P = planFromOfp(SimBrief.ofp()); if (!P) { toast('This flight plan has no route between two known airports', 'warn'); return; }
  const old = plansAll()[P.key]; if (old) P.v = old.v; planSave(P);
  PlannerUi.from = P.from; PlannerUi.to = P.to; PlannerUi.sel = '';
  const b = document.createElement('b'); b.setAttribute('data-screen', 'planner'); ACTIONS.go(b, null);
  toast(`Flights ${P.from} → ${P.to} now fly your SimBrief route`, 'ok');
};
