// Selling aircraft, the used-aircraft market and cabin layouts. Only you, the airline's owner, buy, sell
// and lease aircraft: hired pilots never do, and in a co-op only the owner can.
//  - Selling: an aircraft broker buys it at its market value (new price, less about 7% a year of age,
//    less for poor condition), minus a 6% fee. Leased aircraft belong to the lessor: return them or buy
//    them out first.
//  - Used aircraft: a new list every week of second-hand aircraft of the types you can fly, with their
//    age, hours, cycles and condition, where they are now, and the ferry flight to your base.
//  - Cabin: seats per class (a business seat takes the room of two economy seats, first class three),
//    or a freighter conversion. The work is paid for and done before the next flight.

interface UsedAc { id: string; typeId: string; ageY: number; hoursMin: number; cycles: number; condition: number; location: string; seller: string; price: number; was: string }

const USED_SELLERS = ['AerCap', 'Avolon', 'BOC Aviation', 'Air Lease Corporation', 'SMBC Aviation Capital', 'A private owner', 'An airline closing down', 'A charter company', 'An aircraft broker'];
const FOREIGN_REGS = ['D-A', 'G-', 'F-H', 'EI-', 'SE-R', 'LN-', 'OH-', 'N', 'C-F', 'VH-', 'PH-', 'HB-J', 'EC-', 'I-'];

function canTrade(): boolean {
  if (!coopCanBuy()) { toast('In this co-op only the owner buys, sells and leases aircraft', 'warn'); return false; }
  return true;
}

/** This week's used aircraft (the same list all week, less the ones you bought). */
function usedList(): UsedAc[] {
  const S: any = State, wk = weekKey(new Date()), c = company();
  if (S.usedMarket && S.usedMarket.wk === wk && S.usedMarket.cid === c.id && S.usedMarket.v === 2) return S.usedMarket.items;
  const types = AIRCRAFT.filter(t => t.installed && (c.kind === 'bush' ? t.cls === 'bush' || t.cls === 'ga' || t.cls === 'turboprop' : t.cls !== 'bush' && t.cls !== 'ga'));
  const near = Object.keys(AIRPORTS).filter(k => k !== 'DEP' && (c.kind === 'bush' ? bushApt(k) : airlineApt(k)));
  const items: UsedAc[] = [];
  const helis = c.kind === 'bush' ? [] : AIRCRAFT.filter(t => t.cls === 'helicopter');   // two used helicopters every week as well
  for (let i = 0; i < 14 && types.length; i++) {
    const h = hashMix(wk + c.id + i), t = i >= 12 ? helis[h % Math.max(1, helis.length)] : types[h % types.length]; if (!t) continue;
    const perYear = ({ widebody: 4300, airliner: 3000, regional: 2600, turboprop: 2200, bush: 700, ga: 300, helicopter: 650 } as any)[t.cls] || 2500;
    const ageY = 2 + (h >>> 5) % 20 + ((h >>> 9) % 10) / 10, hrs = Math.round(ageY * perYear * (0.8 + ((h >>> 3) % 40) / 100));
    const cond = 60 + (h >>> 11) % 36;
    const pseudo: any = { typeId: t.id, hoursMin: hrs * 60, condition: cond, ageY, delivered: '' };
    const value = aircraftValue(pseudo), price = Math.round(value * (0.95 + ((h >>> 15) % 14) / 100) / 10000) * 10000;
    const pre = FOREIGN_REGS[(h >>> 7) % FOREIGN_REGS.length], L = 'ABCDEFGHJKLMNPRSTUVWXYZ';
    const was = pre === 'N' ? 'N' + (100 + (h % 899)) + L[(h >>> 2) % L.length] + L[(h >>> 4) % L.length] : pre + L[(h >>> 2) % L.length] + L[(h >>> 4) % L.length] + L[(h >>> 6) % L.length];
    items.push({ id: 'u' + wk + i, typeId: t.id, ageY: Math.round(ageY * 10) / 10, hoursMin: hrs * 60, cycles: Math.round(hrs / (t.cls === 'widebody' ? 6 : t.cls === 'bush' || t.cls === 'ga' || t.cls === 'helicopter' ? 0.8 : 1.6)), condition: cond,
      location: near[(h >>> 13) % near.length], seller: USED_SELLERS[(h >>> 17) % USED_SELLERS.length], price, was: was.replace(/-$/, '') });
  }
  S.usedMarket = { wk, cid: c.id, items, v: 2 };
  return items;
}

function ferryCost(t: AircraftType, from: string, to: string): number {
  const A = apt(from), B = apt(to); if (!A || !B || from === to) return 0;
  const nm = gcDistanceNm(A.pos, B.pos), legs = Math.max(1, Math.ceil(nm / Math.max(200, usableRange(t))));
  return Math.round((nm / t.cruiseKt + 0.5 * legs) * t.costPerHr * 0.7 + legs * landingFee(to, t));
}

function usedMarketHtml(): string {
  const c = company(), list = usedList().filter(u => mkKindOk(u.typeId));   // the kind chosen above (jets, turboprops, helicopters)
  if (!list.length) return `<p class="fine-print">${icon('info')}No used aircraft of this kind for sale this week.</p>`;
  return `<div class="mk-grid">${list.map((u, i) => {
    const t = acType(u.typeId);
    return `<div class="mk-card used" style="--i:${i}">
      <div class="mk-stage">${aircraftArt(t.id, { color: '#C9D2DE', color2: '#5D6B7E', reg: u.was })}</div>
      <div class="mk-body">
        <div class="mk-name"><b>${esc(t.maker)} ${esc(t.model)}</b><span class="dev-tag ${t.devKind}">${esc(t.dev)}</span></div>
        <div class="mk-cap">${icon('pax')}<span>${esc(capacityText(t.id))}</span></div>
        ${engineFor(t.id, u.id) ? `<div class="mk-cap mk-eng">${icon('fuel')}<span>${esc(engineOptions(t.id).filter(x => x.id === engineFor(t.id, u.id))[0].name)}</span></div>` : ''}
        <div class="mk-specs"><span><small>Age</small>${u.ageY} yrs</span><span><small>Hours</small>${num(u.hoursMin / 60)}</span><span><small>Cycles</small>${num(u.cycles)}</span><span><small>Condition</small>${u.condition}%</span></div>
        <small class="muted">${esc(u.was)} at ${esc(u.location)}, sold by ${esc(u.seller)}. New: ${money(t.price, { compact: true })}</small>
        <div class="mk-foot"><b class="mk-price">${money(u.price, { compact: true })}</b><button class="btn ghost mk-view" title="See it in a hangar and walk round it" data-act="mk-view" data-id="${t.id}" data-used="${u.id}">${icon('focus')}View</button><button class="btn primary" data-act="buy-used" data-id="${u.id}">Buy</button></div>
      </div>
    </div>`;
  }).join('') || emptyState('No used aircraft this week', 'A new list comes every Monday.')}</div>
  <p class="fine-print">${icon('info')}A new list every Monday. Used aircraft cost less but come with hours, cycles and wear: their condition goes into maintenance from day one. Prices follow age and condition.</p>`;
}

let _used = { id: '', base: '' };
function usedSheetHtml(): string {
  const u = usedList().filter(x => x.id === _used.id)[0]; if (!u) return '';
  const t = acType(u.typeId), c = company(), base = _used.base || c.hub, ferry = ferryCost(t, u.location, base), total = u.price + ferry, after = c.balance - total;
  const reg = nextRegs(c, 1)[0], nb = noStandsFor(base, 1);
  return `<div class="modal-head"><div><h2>Buy used ${esc(t.maker)} ${esc(t.model)}</h2><small>${esc(u.was)}, ${u.ageY} years old, from ${esc(u.seller)}</small></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
    <div class="modal-body buy">
      <div class="buy-art">${aircraftArt(t.id, { color: c.color, color2: c.color2, reg })}</div>
      <div class="buy-form">
        <div class="kv-row"><div><small>Hours</small><b>${num(u.hoursMin / 60)}</b></div><div><small>Cycles</small><b>${num(u.cycles)}</b></div><div><small>Condition</small><b>${u.condition}%</b></div><div><small>Now at</small><b>${esc(u.location)}</b></div></div>
        ${(() => { const e = engineOptions(t.id).filter(x => x.id === engineFor(t.id, u.id))[0]; return e ? `<div class="field"><small>Engines</small><b>${esc(e.name)}</b>${e.note ? `<small class="muted">${esc(e.note)}</small>` : ''}</div>` : ''; })()}
        <div class="field"><small>New registration</small><div class="regs"><span>${esc(reg)}</span></div></div>
        ${baseFieldHtml(base, 1, 'used')}
        <div class="txd-lines"><div><span>Price</span><b>${money(u.price)}</b></div><div><span>Ferry flight ${esc(u.location)} to ${esc(base)}</span><b>${money(ferry)}</b></div></div>
        <div class="buy-sum"><div><small>Total</small><b>${money(total)}</b></div><div><small>Balance after</small><b class="${after < 0 ? 'red' : ''}">${money(after)}</b></div></div>
        <button class="btn primary big" data-act="buy-used-go" ${after < 0 || nb ? 'disabled' : ''}>${nb ? `Not enough stands at ${esc(base)}` : after < 0 ? 'Not enough money' : `Buy for ${money(total, { compact: true })}`}</button>
      </div>
    </div>`;
}
function rerenderUsed() { const p = $('.used-pop .panel'); if (p) patchHtml(p, usedSheetHtml()); }
ACTIONS['buy-used'] = el => { if (!canTrade()) return; Sound.tick(); _used = { id: el.getAttribute('data-id'), base: company().hub }; openLayer('modal', usedSheetHtml(), { cls: 'wide used-pop' }); };
ACTIONS['buy-used-go'] = () => {
  if (!canTrade()) return;
  const S: any = State, list = usedList(), u = list.filter(x => x.id === _used.id)[0]; if (!u) return;
  const t = acType(u.typeId), c = company(), base = _used.base || c.hub;
  if (noStandsFor(base, 1)) { toast('Not enough free stands there: choose another base', 'warn'); return; }
  const ferry = ferryCost(t, u.location, base), total = u.price + ferry, reg = nextRegs(c, 1)[0], from = c.balance;
  c.balance -= total;
  State.fleet.push({ engine: engineFor(t.id, u.id) || undefined, reg, typeId: t.id, companyId: c.id, base, location: base, hoursMin: u.hoursMin, cycles: u.cycles, condition: u.condition, status: 'parked', delivered: dateStr(new Date()).slice(0, 10), ageY: u.ageY, wasReg: u.was } as any);
  State.txns.unshift({ id: uid(), companyId: c.id, date: dateStr(new Date()).slice(0, 10), time: new Date().toTimeString().slice(0, 5), label: `Used aircraft: ${t.maker} ${t.model} ${reg}`, amount: -total, kind: 'purchase', reg,
    lines: [[`${t.maker} ${t.model}, ${u.ageY} years, ex ${u.was}, from ${u.seller}`, -u.price], [`Ferry flight ${u.location} to ${base}`, -ferry]], link: { kind: 'aircraft', id: reg } } as any);
  S.usedMarket.items = list.filter(x => x !== u);
  try { coopAfterBuy(`used ${t.maker} ${t.model}`, total); } catch (e) { /* ignore */ }
  try { Online.discord('fleet', `New aircraft: ${reg}`, `${company().name} bought a used ${t.maker} ${t.model} (ex ${u.was}), based at ${base}.`); } catch (e) { /* ignore */ }
  closeAll(); Bases.ensure(); Sound.purchase(); Haptics.success(); animateBalance(from, c.balance); Store.save(); refresh();
  toast(`${reg} is yours and on its way to ${base}`, 'ok', { label: 'See it in the fleet', act: 'see-fleet', data: reg });
};

/* ---------- Selling ---------- */
ACTIONS['ac-sell'] = el => {
  if (!canTrade()) return;
  const a = plane(el.getAttribute('data-reg')); if (!a) return;
  const t = acType(a.typeId), S: any = State;
  if ((a as any).lease) { toast(`${a.reg} is leased: return it or buy it out first`, 'warn'); return; }
  if ((a as any).leasedOut) { toast(`${a.reg} is leased out: recall it first`, 'warn'); return; }
  if (a.status === 'flying' || State.live.some(f => f.reg === a.reg) || (S.aiNext || []).some((n: any) => n.reg === a.reg)) { toast(`${a.reg} is flying. Sell it when it's on the ground and has no flight planned.`, 'warn'); return; }
  const value = aircraftValue(a), fee = value - sellPrice(a), get = sellPrice(a);
  const open = State.issues.filter(i => i.reg === a.reg && i.status === 'open');
  closeAll();
  openLayer('modal', `<div class="modal-head"><div><h2>Sell ${esc(a.reg)}?</h2><small>${esc(t.maker)} ${esc(t.model)}, about ${Math.round(aircraftAge(a) * 10) / 10} years old, ${num(a.hoursMin / 60)} hours, ${Math.round(a.condition)}% condition</small></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
    <div class="modal-body">
      <div class="txd-lines"><div><span>Market value</span><b>${money(value)}</b></div><div><span>Aircraft broker's fee (6%)</span><b>${money(-fee)}</b></div>${open.length ? `<div><span>${open.length} open maintenance report${open.length > 1 ? 's' : ''} go with it</span><b>—</b></div>` : ''}</div>
      <div class="txd-total"><span>You receive</span><b class="green">${money(get)}</b></div>
      <p class="fine-print">${icon('info')}New it cost ${money(t.price)}. Routes flown with it stay; a hired pilot on them waits for another ${esc(t.model)}.${S.myReg[a.companyId] === a.reg ? ' It is the aircraft you fly yourself: another one of yours takes its place.' : ''}</p>
      <div class="modal-actions"><button class="btn ghost" data-act="close-layer">Keep it</button><button class="btn primary" data-act="ac-sell-go" data-reg="${esc(a.reg)}">${icon('market')}Sell for ${money(get, { compact: true })}</button></div>
    </div>`, { cls: 'narrow' });
};
ACTIONS['ac-sell-go'] = el => {
  if (!canTrade()) return;
  const a = plane(el.getAttribute('data-reg')); if (!a) return;
  const t = acType(a.typeId), c = company(a.companyId), get = sellPrice(a), value = aircraftValue(a), from = c.balance, S: any = State;
  c.balance += get;
  State.txns.unshift({ id: uid(), companyId: c.id, date: dateStr(new Date()).slice(0, 10), time: new Date().toTimeString().slice(0, 5), label: `Sold: ${t.maker} ${t.model} ${a.reg}`, amount: get, kind: 'sale', reg: a.reg,
    lines: [['Market value', value], ['Aircraft broker\'s fee (6%)', get - value]] } as any);
  State.fleet = State.fleet.filter(x => x.reg !== a.reg);
  State.issues = State.issues.filter(i => i.reg !== a.reg);
  if (S.myReg[a.companyId] === a.reg) { const other = State.fleet.filter(x => x.companyId === a.companyId)[0]; if (other) S.myReg[a.companyId] = other.reg; }
  try { coopRecord({ id: uid(), at: Date.now(), by: 'coop-you', type: 'sell', text: `Sold ${t.maker} ${t.model} ${a.reg}`, amount: get }); } catch (e) { /* not in co-op */ }
  try { Online.discord('fleet', `Aircraft sold: ${a.reg}`, `${c.name} sold its ${t.maker} ${t.model} ${a.reg}.`); } catch (e) { /* ignore */ }
  try { Bases.ensure(); } catch (e) { /* ignore */ }
  closeAll(); Sound.purchase(); Haptics.success(); animateBalance(from, c.balance); Store.save(); refresh();
  toast(`${a.reg} sold for ${money(get)}`, 'ok');
};

/* ---------- Cabin layout ---------- */
let _cab: { reg: string; c: Cabin } = { reg: '', c: null };
function cabinCost(t: AircraftType, from: Cabin, to: Cabin): number {
  if (!!from.freighter !== !!to.freighter) return Math.round(t.price * (to.freighter ? 0.12 : 0.09) / 1000) * 1000;
  const changed = Math.abs(from.j - to.j) + Math.abs(from.f - to.f) * 1.5 + Math.abs(from.y - to.y) * 0.15;
  return changed ? Math.round((8000 + changed * (t.cls === 'widebody' ? 42000 : 18000)) / 100) * 100 : 0;
}
function cabinSheetHtml(): string {
  const a = plane(_cab.reg); if (!a) return '';
  const t = acType(a.typeId), cur = cabinOf(a), c = _cab.c, units = t.seats, used = cabinUnits(c), cost = cabinCost(t, cur, c);
  const row = (k: 'f' | 'j' | 'y', label: string, sub: string, ok: boolean) => ok ? `<div class="cab-row"><span><b>${label}</b><small>${sub}</small></span>
    <div class="stepper"><button class="icon-btn" data-act="cab-step" data-k="${k}" data-d="-${k === 'y' ? 6 : 2}" aria-label="Fewer">−</button><b>${c[k]}</b><button class="icon-btn" data-act="cab-step" data-k="${k}" data-d="${k === 'y' ? 6 : 2}" aria-label="More">${icon('plus')}</button></div></div>` : '';
  return `<div class="modal-head"><div><h2>Cabin of ${esc(a.reg)}</h2><small>${esc(t.maker)} ${esc(t.model)}: room for ${t.seats} economy seats</small></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
    <div class="modal-body">
      <div class="seg cab-mode"><button class="${!c.freighter ? 'on' : ''}" data-act="cab-mode" data-m="pax">${icon('pax')}Passengers</button><button class="${c.freighter ? 'on' : ''}" data-act="cab-mode" data-m="cargo">${icon('fleet')}Freighter</button></div>
      ${c.freighter ? `<p class="lede">${icon('fleet')}No seats: the main deck carries cargo, about ${num(t.seats * (FREIGHT_PER_SEAT[t.cls] || 100))} kg. It flies cargo on its routes and can take cargo jobs.</p>` : `
      ${row('f', 'First class', 'Takes the room of 3 economy seats. About 5 to 7 times the economy fare.', canHaveFirst(t))}
      ${row('j', 'Business class', 'Takes the room of 2 economy seats. About 2.4 to 4 times the economy fare.', canHaveBusiness(t))}
      ${row('y', 'Economy', 'The usual fare. Most of the passengers.', true)}
      <div class="cab-bar"><i style="width:${Math.min(100, used / units * 100).toFixed(1)}%" class="${used > units ? 'over' : ''}"></i></div>
      <small class="${used > units ? 'red' : 'muted'}">${used > units ? `Too many seats: ${used} of ${units} spaces used` : `${used} of ${units} spaces used, ${c.f + c.j + c.y} seats`}</small>`}
      <div class="txd-total"><span>${cost ? (c.freighter !== !!cur.freighter ? (c.freighter ? 'Freighter conversion' : 'Back to passengers') : 'Cabin work') : 'No change'}</span><b>${money(-cost)}</b></div>
      <div class="modal-actions"><button class="btn ghost" data-act="close-layer">Cancel</button><button class="btn primary" data-act="cab-save" ${used > units && !c.freighter || !cost || a.status === 'flying' ? 'disabled' : ''}>${a.status === 'flying' ? 'Wait until it lands' : 'Change the cabin'}</button></div>
    </div>`;
}
function rerenderCab() { const p = $('.cab-pop .panel'); if (p) patchHtml(p, cabinSheetHtml()); }
ACTIONS['ac-cabin'] = el => { const a = plane(el.getAttribute('data-reg')); if (!a) return; if (!canTrade()) return; _cab = { reg: a.reg, c: Object.assign({}, cabinOf(a)) }; closeAll(); openLayer('modal', cabinSheetHtml(), { cls: 'narrow cab-pop' }); };
ACTIONS['cab-step'] = el => {
  const a = plane(_cab.reg), t = acType(a.typeId), k = el.getAttribute('data-k') as 'f' | 'j' | 'y', d = +el.getAttribute('data-d');
  _cab.c[k] = Math.max(0, _cab.c[k] + d);
  // keep it full: economy fills what premium leaves free
  if (k !== 'y') _cab.c.y = Math.max(0, t.seats - _cab.c.j * 2 - _cab.c.f * 3);
  Sound.tick(); rerenderCab();
};
ACTIONS['cab-mode'] = el => { const a = plane(_cab.reg), t = acType(a.typeId); _cab.c = el.getAttribute('data-m') === 'cargo' ? { y: 0, j: 0, f: 0, freighter: true } : defaultCabin(t); Sound.tick(); rerenderCab(); };
ACTIONS['cab-save'] = () => {
  if (!canTrade()) return;
  const a = plane(_cab.reg); if (!a) return;
  const t = acType(a.typeId), cur = cabinOf(a), cost = cabinCost(t, cur, _cab.c), c = company(a.companyId), from = c.balance;
  c.balance -= cost;
  (a as any).cabin = _cab.c.freighter ? { y: 0, j: 0, f: 0, freighter: true } : { y: _cab.c.y, j: _cab.c.j, f: _cab.c.f };
  State.txns.unshift({ id: uid(), companyId: c.id, date: dateStr(new Date()).slice(0, 10), time: new Date().toTimeString().slice(0, 5), label: `Cabin: ${a.reg}, ${cabinText((a as any).cabin)}`, amount: -cost, kind: 'maint', reg: a.reg,
    lines: [[`${cabinText(cur)} → ${cabinText((a as any).cabin)}`, -cost]], link: { kind: 'aircraft', id: a.reg } } as any);
  closeAll(); Sound.payOut(); animateBalance(from, c.balance); Store.save(); refresh();
  toast(`${a.reg}: ${cabinText((a as any).cabin)}`, 'ok');
};

/* ---------- the final step of buying, leasing or selling an aircraft: are you sure? ---------- */
function confirmTrade(act: string, ask: (el: HTMLElement) => [string, string, string] | null) {
  const run = ACTIONS[act];
  ACTIONS[act] = (el, ev) => {
    if (!canTrade()) return;
    const q = ask(el); if (!q) { run(el, ev); return; }
    Sound.tick();
    confirmChange(q[0], q[1], q[2], 'Not yet', () => { closeTop(); run(el, ev); }, () => closeTop());
  };
}
confirmTrade('buy-confirm', () => {
  const t = acType(_buy.id); if (!t) return null;
  const eng = engineOptions(t.id).filter(e => e.id === (_buy as any).eng)[0] || engineOptions(t.id)[0], unit = Math.round(t.price * (eng ? eng.price : 1));
  return [`Buy ${_buy.qty > 1 ? _buy.qty + ' ' + t.model + 's' : 'the ' + t.maker + ' ' + t.model}?`, `${money(unit * _buy.qty)} is paid now from ${company().name}'s account${eng ? `, with ${eng.name} engines` : ''}. Delivered to ${_buy.base || company().hub}.`, `Yes, buy for ${money(unit * _buy.qty, { compact: true })}`];
});
confirmTrade('lease-confirm', () => {
  const t = acType(_lease.id); if (!t) return null;
  const monthly = leaseMonthly(t.price, _lease.years);
  return [`Lease ${_lease.qty > 1 ? _lease.qty + ' ' + t.model + 's' : 'the ' + t.maker + ' ' + t.model}?`, `${money(monthly * _lease.qty)} a month for ${_lease.years} year${_lease.years > 1 ? 's' : ''}, plus a deposit of two months' rent paid now. Returning it early costs three months' rent.`, 'Yes, sign the lease'];
});
confirmTrade('buy-used-go', () => {
  const u = usedList().filter(x => x.id === _used.id)[0]; if (!u) return null; const t = acType(u.typeId);
  return [`Buy this used ${t.model}?`, `${money(u.price)} for the aircraft, plus the ferry flight to ${_used.base || company().hub}. Used aircraft are sold as they are.`, `Yes, buy for ${money(u.price, { compact: true })}`];
});
confirmTrade('ac-sell-go', el => {
  const a = plane(el.getAttribute('data-reg')); if (!a) return null;
  return [`Sell ${a.reg}?`, `${acType(a.typeId).maker} ${acType(a.typeId).model}, for ${money(sellPrice(a))}. Once it's sold it's gone: its history stays in your logs.`, `Yes, sell ${a.reg}`];
});
