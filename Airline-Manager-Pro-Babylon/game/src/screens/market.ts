// Aircraft market: buy or lease one or several aircraft of any type. Types not in your simulator are flown by your
// hired pilots (you fly only what you have installed).
let _mkMaker = 'All';
let _mkMode: 'buy' | 'lease' | 'used' | 'sell' = 'buy';
/** What kind of aircraft the market shows: everything, jets, turboprops (and the other propeller aircraft) or helicopters. */
let _mkKind: 'all' | 'jet' | 'prop' | 'heli' = 'all';
function mkKindOf(t: AircraftType): 'jet' | 'prop' | 'heli' { return t.cls === 'helicopter' ? 'heli' : /^prop/.test(String((t as any).art && (t as any).art.eng || '')) || t.cls === 'turboprop' || t.cls === 'bush' || t.cls === 'ga' ? 'prop' : 'jet'; }
function mkKindOk(typeId: string): boolean { const t = acType(typeId); return !!t && (_mkKind === 'all' || mkKindOf(t) === _mkKind); }
let _mkInstalled = true;

SCREENS.market = {
  title: 'Aircraft market', icon: 'market', nav: false,
  render() {
    const c = company();
    const kinds = AIRCRAFT.filter(a => mkKindOk(a.id));
    const makers = ['All'].concat(kinds.map(a => a.maker).filter((m, i, arr) => arr.indexOf(m) === i));
    if (makers.indexOf(_mkMaker) < 0) _mkMaker = 'All';   // that maker builds none of this kind
    const list = kinds.filter(a => (_mkMaker === 'All' || a.maker === _mkMaker) && (!_mkInstalled || a.installed));
    return `
    ${subHead('fleet', _mkMode === 'sell' ? 'Sell aircraft' : _mkMode === 'lease' ? 'Lease aircraft' : _mkMode === 'used' ? 'Used aircraft' : 'Buy aircraft', _mkMode === 'sell' ? 'Your own aircraft and what an aircraft broker pays for each' : _mkMode === 'lease' ? 'Pay a monthly rent instead of the full price, for 1, 3 or 6 years' : _mkMode === 'used' ? 'Second-hand aircraft for sale this week, of the types you have installed' : `${AIRCRAFT.filter(a => a.installed).length} types ${(State as any).simInstalled ? 'found in your simulator' : 'in your simulator (demo list until your PC is linked)'}, including add-ons`,
      _mkMode === 'used' || _mkMode === 'sell' ? '' : `<label class="tg-inline"><span>Only what I have installed</span>${toggle('mk-installed', _mkInstalled)}</label>`)}
    <div class="mk-menus"><div class="mk-mode seg">${[['buy', 'Buy new'], ['used', 'Used'], ['lease', 'Lease'], ['sell', 'Sell']].map(m => `<button class="${_mkMode === m[0] ? 'on' : ''}" data-act="mk-mode" data-m="${m[0]}">${icon(m[0] === 'buy' ? 'market' : m[0] === 'used' ? 'clock' : m[0] === 'sell' ? 'swap' : 'key')}${m[1]}</button>`).join('')}</div>
      <div class="mk-kind seg">${[['all', 'All aircraft'], ['jet', 'Jets'], ['prop', 'Turboprops'], ['heli', 'Helicopters']].map(m => `<button class="${_mkKind === m[0] ? 'on' : ''}" data-act="mk-kind" data-k="${m[0]}" ${m[0] === 'prop' ? 'title="Turboprops and the other propeller aircraft"' : ''}>${m[1]}<i>${m[0] === 'all' ? AIRCRAFT.length : AIRCRAFT.filter(t => mkKindOf(t) === m[0]).length}</i></button>`).join('')}</div></div>
    ${!coopCanBuy() ? `<p class="fine-print warn">${icon('info')}In this co-op only the owner buys, sells and leases aircraft.</p>` : ''}
    ${_mkMode === 'used' ? usedMarketHtml() : _mkMode === 'sell' ? mkSellHtml() : `
    <div class="filter-row">${makers.map(m => `<button class="fchip ${_mkMaker === m ? 'on' : ''}" data-act="mk-maker" data-m="${esc(m)}">${esc(m)}</button>`).join('')}</div>
    <div class="mk-grid">${list.map((t, i) => {
      const owned = State.fleet.filter(a => a.typeId === t.id && a.companyId === c.id).length;
      return `<div class="mk-card ${t.installed ? '' : 'not-inst'}" style="--i:${i}">
        <div class="mk-stage">${aircraftArt(t.id, { color: c.color, color2: c.color2 })}</div>
        <div class="mk-body">
          <div class="mk-name"><b>${esc(t.maker)} ${esc(t.model)}</b><span class="dev-tag ${t.devKind}">${esc(t.dev)}</span></div>
          <div class="mk-cap">${icon('pax')}<span>${esc(capacityText(t.id))}</span></div>
          ${engineOptions(t.id).length ? `<div class="mk-cap mk-eng">${icon('fuel')}<span>${engineOptions(t.id).map(e => esc(e.name)).join(' or ')}</span></div>` : ''}
          <div class="mk-specs"><span><small>Seats</small>${t.seats}</span><span><small>Range</small>${num(t.rangeNm)} nm</span><span><small>Cruise</small>${t.cruiseKt} kt</span><span><small>Per hour</small>${money(t.costPerHr)}</span></div>
          <div class="mk-foot">
            ${_mkMode === 'lease' ? `<b class="mk-price"><small>from </small>${money(leaseMonthly(t.price, 6), { compact: true })}<small> /month</small></b>` : `<b class="mk-price">${money(t.price, { compact: true })}</b>`}
            ${owned ? `<small class="owned">You have ${owned}</small>` : ''}
            ${t.installed ? '' : `<small class="muted" title="You can't fly it yourself until it is in your simulator; your hired pilots fly it">Not in your sim: your pilots fly it</small>`}<button class="btn ghost mk-view" title="See it in a hangar and walk round it" data-act="mk-view" data-id="${t.id}">${icon('focus')}View</button>${_mkMode === 'lease' ? `<button class="btn primary" data-act="lease" data-id="${t.id}">Lease</button>` : `<button class="btn primary" data-act="buy" data-id="${t.id}">Buy</button>`}
          </div>
        </div>
      </div>`;
    }).join('')}</div>`}`;
  },
};

ACTIONS['mk-mode'] = el => { _mkMode = el.getAttribute('data-m') as any; Sound.tick(); refresh(); };
ACTIONS['mk-kind'] = el => { _mkKind = el.getAttribute('data-k') as any; Sound.tick(); refresh(); };
/** Sell: your own aircraft of the kind chosen, with what each would fetch. */
function mkSellHtml(): string {
  const c = company(), mine = State.fleet.filter(a => a.companyId === c.id && mkKindOk(a.typeId));
  if (!mine.length) return `<p class="fine-print">${icon('info')}You have no ${_mkKind === 'all' ? 'aircraft' : _mkKind === 'jet' ? 'jets' : _mkKind === 'prop' ? 'turboprops' : 'helicopters'} to sell.</p>`;
  return `<div class="mk-grid">${mine.map((a, i) => { const t = acType(a.typeId), A: any = a, busy = a.status === 'flying' || State.live.some(f => f.reg === a.reg);
    return `<div class="mk-card sell" style="--i:${i}">
      <div class="mk-stage">${aircraftArt(t.id, { color: c.color, color2: c.color2, reg: a.reg })}</div>
      <div class="mk-body">
        <div class="mk-name"><b>${esc(a.reg)} · ${esc(t.maker)} ${esc(t.model)}</b></div>
        <div class="mk-specs"><span><small>Age</small>${Math.round(aircraftAge(a) * 10) / 10} yrs</span><span><small>Hours</small>${num(a.hoursMin / 60)}</span><span><small>Condition</small>${Math.round(a.condition)}%</span><span><small>Base</small>${esc(a.base || c.hub)}</span></div>
        <div class="mk-foot"><b class="mk-price"><small>you get </small>${money(sellPrice(a), { compact: true })}</b>
          ${A.lease ? `<small class="muted">Leased: return it or buy it out first</small>` : busy ? `<small class="muted">Flying: sell it when it's on the ground</small>` : ''}
          <button class="btn primary" data-act="ac-sell" data-reg="${esc(a.reg)}" ${A.lease || A.leasedOut ? 'disabled' : ''}>Sell</button></div>
      </div></div>`; }).join('')}</div>`;
}
ACTIONS['mk-maker'] = el => { _mkMaker = el.getAttribute('data-m'); Sound.tick(); refresh(); };

let _buy = { id: '', qty: 1, div: '', base: '' };

function nextRegs(c: Company, n: number): string[] {
  const used: { [k: string]: boolean } = {};
  State.fleet.forEach(a => used[a.reg] = true);
  const out: string[] = [];
  const L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const cands: string[] = [];
  if (c.kind === 'bush') for (let i = 0; i < 600; i++) cands.push(`N${400 + i}RB`);
  else {
    const two = c.icao[0] + c.icao[2];
    for (const x of L) cands.push(`OY-${two}${x}`);
    for (const x of L) for (const y of L) cands.push(`OY-${c.icao[0]}${x}${y}`);
  }
  for (const r of cands) { if (out.length >= n) break; if (!used[r]) out.push(r); }
  return out;
}

function buySheetHtml(): string {
  const t = acType(_buy.id), c = company();
  const ePrice = (engineOptions(t.id).filter(e => e.id === (_buy as any).eng)[0] || { price: 1 } as any).price, unit = Math.round(t.price * ePrice), total = unit * _buy.qty;
  const regs = nextRegs(c, _buy.qty);
  const after = c.balance - total;
  return `
    <div class="modal-head"><div><h2>Buy ${esc(t.maker)} ${esc(t.model)}</h2><small>${esc(t.variant)}, ${esc(t.dev)}</small></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
    <div class="modal-body buy">
      <div class="buy-art">${aircraftArt(t.id, { color: c.color, color2: c.color2, reg: regs[0] })}</div>
      <div class="buy-form">
        <div class="field"><small>How many</small>
          <div class="stepper"><button class="icon-btn" data-act="buy-qty" data-d="-1" aria-label="One less"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M5 12h14"/></svg></button><b>${_buy.qty}</b><button class="icon-btn" data-act="buy-qty" data-d="1" aria-label="One more">${icon('plus')}</button></div></div>
        ${enginePickHtml(t.id, (_buy as any).eng, 'buy-eng')}
        ${c.divisions.length ? `<div class="field"><small>Division</small><div class="seg">${c.divisions.map(d => `<button class="${_buy.div === d.id ? 'on' : ''}" data-act="buy-div" data-div="${d.id}">${esc(d.name)}</button>`).join('')}</div></div>` : ''}
        <div class="field"><small>Registration${_buy.qty > 1 ? 's' : ''}</small><div class="regs">${regs.map(r => `<span>${esc(r)}</span>`).join('')}</div></div>
        ${baseFieldHtml(_buy.base || c.hub, _buy.qty, 'buy')}
        <div class="buy-sum">
          <div><small>Total</small><b>${money(total)}</b></div>
          <div><small>Balance after</small><b class="${after < 0 ? 'red' : ''}">${money(after)}</b></div>
        </div>
        ${(() => { const nb = noStandsFor(_buy.base || c.hub, _buy.qty); return `<button class="btn primary big" data-act="buy-confirm" ${after < 0 || nb ? 'disabled' : ''}>${nb ? `Not enough stands at ${esc(_buy.base || c.hub)}` : after < 0 ? 'Not enough money' : `Buy for ${money(total, { compact: true })}`}</button>`; })()}
      </div>
    </div>`;
}

ACTIONS.buy = el => {
  if (!canTrade()) return;
  Sound.tick();
  const c = company();
  _buy = { id: el.getAttribute('data-id'), qty: 1, base: company().hub, div: c.divisions.length ? (State.divisionId !== 'all' ? State.divisionId : c.divisions[0].id) : '' };
  openLayer('modal', buySheetHtml(), { cls: 'wide buy-pop' });
};
/** The base for new aircraft, with its free stands; a full base is pointed out with a way to choose another. */
function baseFieldHtml(base: string, qty: number, kind: string): string {
  const f = Bases.free(base), short = f != null && f < qty;
  return `<div class="field"><small>Delivered to and based at</small><div class="base-pick-row"><b>${esc(apt(base) ? apt(base).name : base)} (${esc(base)})</b><button class="text-btn" data-act="new-base" data-k="${kind}">Change</button></div>
    <small class="${short ? 'red' : 'muted'}">${short ? `${f <= 0 ? 'No free stands' : 'Only ' + f + ' free stand' + (f === 1 ? '' : 's')} at ${esc(base)}. Choose another base${f > 0 ? ' or fewer aircraft' : ''}.` : esc(Bases.standLabel(base))}</small></div>`;
}
ACTIONS['new-base'] = el => {
  const k = el.getAttribute('data-k');
  openBasePicker('Base for the new aircraft', 'Where it is delivered and parked', icao => { if (k === 'lease') { _lease.base = icao; rerenderLease(); } else if (k === 'used') { _used.base = icao; rerenderUsed(); } else { _buy.base = icao; rerenderBuy(); } });
};
function rerenderBuy() { const p = $('.buy-pop .panel'); if (p) patchHtml(p, buySheetHtml()); }
ACTIONS['buy-qty'] = el => { _buy.qty = clamp(_buy.qty + parseInt(el.getAttribute('data-d'), 10), 1, 12); Sound.tick(); rerenderBuy(); };
ACTIONS['buy-eng'] = el => { (_buy as any).eng = el.getAttribute('data-e'); Sound.tick(); rerenderBuy(); };
ACTIONS['buy-div'] = el => { _buy.div = el.getAttribute('data-div'); Sound.tick(); rerenderBuy(); };

ACTIONS['buy-confirm'] = () => {
  if (!canTrade()) return;
  if (noStandsFor(_buy.base || company().hub, _buy.qty)) { toast('Not enough free stands there: choose another base', 'warn'); return; }
  const t = acType(_buy.id), c = company();
  try { coopAfterBuy(`${_buy.qty}× ${t.maker} ${t.model}`, Math.round(t.price * ((engineOptions(t.id).filter(e => e.id === (_buy as any).eng)[0] || { price: 1 } as any).price)) * _buy.qty); } catch (e) { /* ignore */ }
  const regs = nextRegs(c, _buy.qty), _firstEver = !fleetOf(c.id).length, _newType = !fleetOf(c.id).some(a => a.typeId === t.id);
  const from = c.balance, eng = (engineOptions(t.id).filter(e => e.id === (_buy as any).eng)[0] || engineOptions(t.id)[0]);
  const unit = Math.round(t.price * (eng ? eng.price : 1));
  c.balance -= unit * _buy.qty;
  regs.forEach(r => State.fleet.push({ engine: eng ? eng.id : undefined, reg: r, typeId: t.id, companyId: c.id, divisionId: _buy.div || undefined, base: _buy.base || c.hub, location: _buy.base || c.hub, hoursMin: 0, cycles: 0, condition: 100, status: 'parked', delivered: dateStr(new Date()).slice(0, 10) }));
  State.txns.unshift({ id: uid(), companyId: c.id, date: dateStr(new Date()).slice(0, 10), time: new Date().toTimeString().slice(0, 5), label: `Purchase: ${_buy.qty}× ${t.maker} ${t.model}`, amount: -unit * _buy.qty, kind: 'purchase',
    reg: regs.join(', '), lines: regs.map(r => [`${t.maker} ${t.model} ${r}, ${t.dev}`, -t.price] as [string, number]), link: { kind: 'aircraft', id: regs[0] } });
  closeAll();
  Bases.ensure();
  try { Online.discord('fleet', `New aircraft: ${regs.join(', ')}`, `${c.name} bought ${_buy.qty > 1 ? _buy.qty + ' new ' + t.maker + ' ' + t.model + 's' : 'a new ' + t.maker + ' ' + t.model}, based at ${_buy.base || c.hub}.`); } catch (e) { /* ignore */ }
  Sound.purchase(); Haptics.success();
  try { newsDelivery(c, t.id, regs, _firstEver, _newType); } catch (e) { /* ignore */ }
  animateBalance(from, c.balance);
  // delivery celebration
  openLayer('modal', `
    <div class="delivered">
      <div class="dl-stage"><div class="dl-plane">${aircraftArt(t.id, { color: c.color, color2: c.color2, reg: regs[0] })}</div><div class="dl-runway"></div></div>
      <div class="dl-stamp"><small>Delivered</small><b>${regs.map(esc).join(', ')}</b></div>
      <h2>${_buy.qty > 1 ? `${_buy.qty} new ${esc(t.model)}s` : `Your new ${esc(t.model)}`} ${_buy.qty > 1 ? 'are' : 'is'} at ${esc(c.hub)}</h2>
      <p class="muted">${money(Math.round(t.price * ((engineOptions(t.id).filter(e => e.id === (_buy as any).eng)[0] || { price: 1 } as any).price)) * _buy.qty)} paid. ${_buy.qty > 1 ? 'They are' : 'It is'} ready to assign to routes.</p>
      <div class="modal-actions center">
        <button class="btn ghost" data-act="close-layer">Keep shopping</button>
        <button class="btn primary" data-act="see-fleet" data-regs="${esc(regs.join(','))}">See it in the fleet</button>
      </div>
    </div>`, { cls: 'narrow celebrate' });
};
ACTIONS['see-fleet'] = el => { const t = el.closest('.toast'); if (t) t.remove(); closeAll(); fleetSpotlight((el.getAttribute('data-regs') || el.getAttribute('data-id') || '').split(',').filter(Boolean)); };
/** Open the fleet at the new aircraft: scrolled to it, and its card flashes three times. */
function fleetSpotlight(regs: string[]) {
  const a = plane(regs[0]);
  // a filter that hides it (or the types overview) gives way to the whole fleet
  if (a && !(_fleetFilter === 'all' || _fleetFilter === a.typeId || acType(a.typeId).cls === _fleetFilter)) _fleetFilter = 'all';
  go('fleet');
  const spot = (tries: number) => {
    const cards = regs.map(r => document.querySelector(`.ac-card[data-reg="${r}"]`) as HTMLElement).filter(Boolean);
    if (!cards.length) { if (tries < 10) setTimeout(() => spot(tries + 1), 150); return; }
    cards[0].scrollIntoView({ behavior: State.settings.reduceMotion ? 'auto' : 'smooth', block: 'center' });
    setTimeout(() => cards.forEach(c => { c.classList.remove('spot'); void c.offsetWidth; c.classList.add('spot'); setTimeout(() => c.classList.remove('spot'), 2600); }), State.settings.reduceMotion ? 0 : 450);
  };
  setTimeout(() => spot(0), 250);
}
