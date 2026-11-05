// More of the airline business.
//  Both modes:     connecting passengers at your hubs, ETOPS for twin-engine aircraft, night curfews and
//                  slots at busy airports, sustainable fuel (SAF) and emission charges.
//  Single player:  taking over rival airlines, shares and investors, rivals reacting to your fares, scenarios.
//  Co-op:          profit sharing, the company radio, the co-op league, live positions of real members.
// Single-player features don't exist in co-op and co-op features don't exist in single player.

function soloMode(): boolean { return !Mode.coop(); }
function bizState(): any { const S: any = State; return S.biz || (S.biz = { etops: {}, slots: {}, rival: {}, shares: {}, scen: {}, taken: [], hub: {}, day: '', month: '' }); }

/* ======================= connecting passengers at your hubs (both) ======================= */
const MCT_MIN = 40, CONNECT_MAX_MIN = 150;
/** A flight of yours reached one of your bases: some passengers fly on with your next departures there; when
 *  it is late, some of them miss theirs (rebooked and looked after, at your cost). */
function hubOnLand(cid: string, from: string, to: string, at: number, pax: number, lateMin: number, schedArr: number) {
  if (!pax || !isBase(cid, to)) return;
  const S: any = State, own = (reg: string) => { const a = plane(reg); return a && a.companyId === cid; };
  const later = (S.aiNext || []).filter((n: any) => n.from === to && own(n.reg) && n.to !== from && n.depAt >= at + MCT_MIN * 60e3 && n.depAt <= at + CONNECT_MAX_MIN * 60e3).length;
  const missedDeps = lateMin > 15 ? State.live.filter((f: any) => f.from === to && own(f.reg) && f.to !== from && f.depAt >= schedArr + MCT_MIN * 60e3 && f.depAt < at + MCT_MIN * 60e3).length : 0;
  const k = Math.min(3, later), share = 0.07, hs = bizState().hub, m = _monthKey(at); const st = hs[m] || (hs[m] = { made: 0, missed: 0, rev: 0, cost: 0 });
  if (k) {
    const n = Math.round(pax * share * k), rev = Math.round(n * 62);
    if (n) { payTxn(cid, `Connecting passengers at ${to}`, rev, 'revenue', [[`${n} passengers connecting at ${to} to ${k} onward flight${k > 1 ? 's' : ''}`, rev]], at); st.made += n; st.rev += rev; }
  }
  if (missedDeps) {
    const n = Math.max(1, Math.round(pax * share * missedDeps)), cost = n * 165;
    payTxn(cid, `Missed connections at ${to}`, -cost, 'fees', [[`${n} passengers rebooked, meals and hotel vouchers`, -cost]], at); st.missed += n; st.cost += cost;
    try { Progress.popularity(-0.15 * missedDeps, `Missed connections at ${to}`); } catch (e) { /* ignore */ }
    if (at > Date.now() - 600e3) State.notices.unshift({ id: uid(), kind: 'flight', title: `${n} missed connection${n > 1 ? 's' : ''} at ${to}`, body: `An arrival from ${from} was ${lateMin} min late; ${n} passengers missed their onward flight and were rebooked (${money(cost)}).`, time: 'Now', at, read: false } as any);
  }
}
/** Hubs card (Routes): this month's connections, and today's departure waves at each base. */
function hubCardHtml(): string {
  const c = company(), bases = companyBases(c.id), st = bizState().hub[_monthKey()] || { made: 0, missed: 0, rev: 0, cost: 0 }, S: any = State;
  if (!bases.length) return '';
  const day0 = new Date(); day0.setHours(0, 0, 0, 0);
  const waves = (b: string) => { const h = new Array(24).fill(0); (S.aiNext || []).concat(State.live).forEach((n: any) => { const a = plane(n.reg); if (!a || a.companyId !== c.id || n.from !== b || !n.depAt || n.depAt < day0.getTime() || n.depAt > day0.getTime() + 864e5) return; h[new Date(n.depAt).getHours()]++; }); return h; };
  return `<div class="card hub-card"><div class="card-h"><b>Hubs and connections</b><small>This month: ${num(st.made)} connecting passengers (${money(st.rev, { compact: true })}), ${num(st.missed)} missed (${money(st.cost, { compact: true })})</small></div>
    ${bases.slice(0, 4).map(b => { const h = waves(b), mx = Math.max(1, Math.max.apply(null, h)); return `<div class="hub-row"><b>${esc(b)}</b><span class="hub-bars">${h.map((v, i) => `<i style="height:${Math.round(v / mx * 100)}%" title="${String(i).padStart(2, '0')}:00 · ${v}"></i>`).join('')}</span></div>`; }).join('')}
    <small class="muted">Departures by hour today. Passengers connect when your arrivals land ${MCT_MIN} to ${CONNECT_MAX_MIN} minutes before a departure from the same base: bunch them into waves to earn more. Late arrivals miss connections.</small></div>`;
}

/* ======================= ETOPS (both) ======================= */
function engineCount(typeId: string): number { const s: any = shapeOf(typeId); return s && s.eng ? s.eng.reduce((n: number, e: any) => n + (e.y === 0 ? 1 : 2), 0) : 2; }
const ETOPS_STEPS = [60, 75, 90, 120, 138, 180, 207, 240, 330];
function etopsMax(typeId: string): number { const t = acType(typeId); if (!t || engineCount(typeId) !== 2) return 999; return t.cls === 'widebody' ? 330 : t.cls === 'airliner' ? 180 : t.cls === 'turboprop' ? 120 : t.cls === 'regional' ? 0 : 0; }
let _altList: any[] = null; const _etopsCache: { [k: string]: number } = {};
/** Minutes from the furthest point of a route to the nearest suitable airport, at one-engine speed (twins only). */
function etopsNeed(typeId: string, legs: string[]): number {
  if (engineCount(typeId) !== 2) return 0;
  const t = acType(typeId); if (!t || t.cls === 'ga' || t.cls === 'bush') return 0;
  const key = typeId + ':' + legs.join('-'); if (_etopsCache[key] != null) return _etopsCache[key];
  if (!_altList) _altList = World.ready ? (World.list as any[]).filter(w => (w.size === 1 || w.size === 2) && w.pos) : (Object.keys(AIRPORTS).map(k => AIRPORTS[k]) as any[]);
  const kt = t.cls === 'turboprop' ? 230 : 400; let worst = 0;
  for (let i = 1; i < legs.length; i++) {
    const A = apt(legs[i - 1]), B = apt(legs[i]); if (!A || !B) continue;
    const nm = gcDistanceNm(A.pos, B.pos), n = Math.max(2, Math.ceil(nm / 60));
    for (let s = 1; s < n; s++) {
      const p = gcInterpolate(A.pos, B.pos, s / n); let best = 1e9;
      for (const w of _altList) { const d = gcDistanceNm(p, w.pos); if (d < best) best = d; if (best < 60) break; }
      worst = Math.max(worst, best / kt * 60);
    }
  }
  const need = worst <= 60 ? 0 : ETOPS_STEPS.filter(x => x >= worst)[0] || 999;
  return (_etopsCache[key] = need);
}
function etopsApproved(cid: string, typeId: string): number { const e = (bizState().etops[cid] || {})[typeId]; return e && e.at <= Date.now() ? e.min : 0; }
function etopsCost(min: number): number { return min <= 120 ? 240000 : min <= 180 ? 580000 : 950000; }
function etopsPopup(typeId: string, need: number) {
  const t = acType(typeId), c = company(), cost = etopsCost(need);
  confirmChange(`ETOPS-${need} approval for the ${t.model}?`, `The authority checks your maintenance programme, crew training and the aircraft's equipment for flights up to ${need} minutes from an alternate airport on one engine. ${money(cost)}; approved in 3 days.`, `Apply for ${money(cost, { compact: true })}`, 'Not now', () => {
    payTxn(c.id, `ETOPS-${need} approval: ${t.maker} ${t.model}`, -cost, 'fees', [['Authority approval, maintenance programme and crew training', -cost]]);
    (bizState().etops[c.id] = bizState().etops[c.id] || {})[typeId] = { min: need, at: Date.now() + 3 * 864e5 / Math.max(1, Math.min(10, aiSpeed())) };
    Store.save(); closeTop(); toast(`ETOPS-${need} applied for: approved in 3 days`, 'ok');
  }, () => closeTop());
}
ACTIONS['etops-apply'] = el => etopsPopup(el.getAttribute('data-t'), +el.getAttribute('data-m'));

/* ======================= night curfews and slots (both) ======================= */
// The best-known published night curfews (simplified: the hours without the exceptions), in local time.
const CURFEWS: { [icao: string]: [string, string, string] } = {
  EDDF: ['23:00', '05:00', 'Europe/Berlin'], EDDL: ['23:00', '06:00', 'Europe/Berlin'], EGLL: ['23:30', '06:00', 'Europe/London'], EGLC: ['22:30', '06:30', 'Europe/London'],
  LSZH: ['23:30', '06:00', 'Europe/Zurich'], LFPO: ['23:30', '06:00', 'Europe/Paris'], LIML: ['23:00', '06:00', 'Europe/Rome'], YSSY: ['23:00', '06:00', 'Australia/Sydney'],
  RJAA: ['00:00', '06:00', 'Asia/Tokyo'], KSNA: ['22:00', '07:00', 'America/Los_Angeles'],
};
// Slot-coordinated airports: a slot pair is needed for each daily service (A: the hardest to get).
const SLOTS: { [icao: string]: 'A' | 'B' } = { EGLL: 'A', KJFK: 'A', KLGA: 'A', KDCA: 'A', RJTT: 'A', EGKK: 'B', EGLC: 'B', EDDF: 'B', EDDM: 'B', EHAM: 'B', LFPG: 'B', LFPO: 'B', LIRF: 'B', LEMD: 'B', LEBL: 'B', LSZH: 'B', LOWW: 'B', EKCH: 'B', ESSA: 'B', ENGM: 'B', RJAA: 'B', VHHH: 'B', WSSS: 'B', ZBAA: 'B', ZSPD: 'B', YSSY: 'B', OMDB: 'B', LTFM: 'B', EIDW: 'B' };
function _localMin(tz: string, t: number): number {
  try { const p = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(t)).split(':'); return (+p[0] % 24) * 60 + +p[1]; }
  catch (e) { return new Date(t).getUTCHours() * 60 + new Date(t).getUTCMinutes(); }
}
function curfewAt(icao: string, t: number): boolean {
  const c = CURFEWS[icao]; if (!c) return false;
  const m = _localMin(c[2], t), a = +c[0].slice(0, 2) * 60 + +c[0].slice(3), b = +c[1].slice(0, 2) * 60 + +c[1].slice(3);
  return a > b ? m >= a || m < b : m >= a && m < b;
}
function curfewEnd(icao: string, t: number): number { let x = t; for (let i = 0; i < 90 && curfewAt(icao, x); i++) x += 10 * 60e3; return x; }
function curfewText(icao: string): string { const c = CURFEWS[icao]; return c ? `Night curfew ${c[0]}–${c[1]} local time` : ''; }
function slotLease(icao: string): number { return SLOTS[icao] === 'A' ? 60000 : 15000; }
/** Free slot pairs this month for a new service (few at the busiest airports). */
function slotsFree(icao: string): number { const r = seeded('slots:' + icao + _monthKey())(); return SLOTS[icao] === 'A' ? (r < 0.6 ? 0 : 1) : Math.floor(r * 4); }
/** Before a new route is saved: ETOPS and slots. Returns true when it may be saved now. */
let _slotOk = '';
function bizRouteGate(typeId: string, stops: string[]): boolean {
  const c = company(), t = acType(typeId);
  const need = etopsNeed(typeId, stops);
  if (need) {
    const max = etopsMax(typeId);
    if (need > max) { toast(`The ${t.model} can't fly this route: it goes up to ${need} minutes from an alternate airport${max ? ` (it may fly at most ${max})` : ' (it has no ETOPS approval possible)'}`, 'warn'); return false; }
    if (etopsApproved(c.id, typeId) < need) { etopsPopup(typeId, need); return false; }
  }
  const sl = stops.filter((k, i) => SLOTS[k] && stops.indexOf(k) === i && !slotSpareHas(c.id, k)); const key = stops.join('-');
  if (sl.length && _slotOk !== key) {
    const rows = sl.map(k => { const free = slotsFree(k); return { k, free, lease: slotLease(k), buy: slotLease(k) * 24 }; });
    const body = rows.map(r => r.free ? `${r.k}: a free slot pair, ${money(r.lease)} a month` : `${r.k}: none free this month; buy a pair from another airline for ${money(r.buy)} (then ${money(r.lease)} a month)`).join('. ');
    const once = rows.filter(r => !r.free).reduce((s, r) => s + r.buy, 0);
    confirmChange('Slots needed', `${body}. Leases are paid at the start of each month while the route runs.`, once ? `Buy for ${money(once, { compact: true })}` : 'Take the slots', 'Not now', () => {
      if (once) payTxn(c.id, `Slot pairs bought: ${rows.filter(r => !r.free).map(r => r.k).join(', ')}`, -once, 'fees', rows.filter(r => !r.free).map(r => [`Slot pair at ${r.k}`, -r.buy] as [string, number]));
      _slotOk = key; closeTop(); ACTIONS['nr-save'](null, null);
    }, () => closeTop());
    return false;
  }
  return true;
}
function bizRouteCreated(r: any) { const sl = r.legs.filter((k: string, i: number) => SLOTS[k] && r.legs.indexOf(k) === i); sl.forEach((k: string) => slotSpareTake(r.companyId || State.companyId, k)); if (sl.length) bizState().slots[r.id] = sl; _slotOk = ''; }
/* ---------- spare slot pairs: kept from closed routes, used again, sold, or lost when unused ---------- */
// Slots are "use it or lose it": a spare pair is kept for two months (its lease still paid), then the airport
// hands it back. Until then a new route there uses it, or it can be sold to another airline.
function slotSpares(cid: string): { k: string; since: number }[] { const b = bizState(); b.spare = b.spare || {}; return b.spare[cid] || (b.spare[cid] = []); }
function slotSpareHas(cid: string, k: string): boolean { return slotSpares(cid).some(x => x.k === k); }
function slotSpareTake(cid: string, k: string) { const l = slotSpares(cid), i = l.findIndex(x => x.k === k); if (i >= 0) l.splice(i, 1); }
function slotsToSpare(routeId: string, cid: string) { const b = bizState(), sl: string[] = b.slots[routeId] || []; delete b.slots[routeId]; sl.forEach(k => slotSpares(cid).push({ k, since: Date.now() })); if (sl.length) toast(`Slot pairs kept at ${sl.join(', ')}: use them for a new route or sell them within two months`, 'info'); }
function slotSellPrice(k: string): number { return Math.round(slotLease(k) * (SLOTS[k] === 'A' ? 30 : 18) * (0.9 + seeded('sell:' + k + _monthKey())() * 0.3) / 1000) * 1000; }
function slotsSpareHtml(): string {
  const l = slotSpares(State.companyId); if (!l.length) return '';
  return `<div class="card loy"><div class="card-h"><b>${icon('clock')}Spare slot pairs</b><small>From routes you closed. Use it or lose it: a new route there takes one, or sell it; after two months unused the airport takes it back.</small></div>
    ${l.map((x, i) => { const left = Math.max(0, Math.ceil((x.since + 60 * 864e5 - Date.now()) / 864e5)); return `<div class="lg-row"><span class="lg-ic">${icon('clock')}</span><span><b>${esc(x.k)}${SLOTS[x.k] === 'A' ? ' · one of the hardest airports' : ''}</b><small>${money(slotLease(x.k))} a month · ${left} days left to use it</small></span><button class="btn sm ghost" data-act="slot-sell" data-i="${i}">Sell to another airline<small>${money(slotSellPrice(x.k))}</small></button></div>`; }).join('')}</div>`;
}
ACTIONS['slot-sell'] = el => {
  const c = company(), l = slotSpares(c.id), x = l[+el.getAttribute('data-i')]; if (!x) return;
  const p = slotSellPrice(x.k); l.splice(l.indexOf(x), 1);
  payTxn(c.id, `Slot pair at ${x.k} sold`, p, 'sale', [[`Slot pair at ${x.k}`, p]]); Store.soon(); Sound.tick(); toast(`Slot pair at ${x.k} sold for ${money(p)}`, 'ok'); refresh();
};
/** The route's page: ETOPS, curfews, slots and emissions. */
function bizRouteInfo(r: any): string {
  const out: string[] = [], need = etopsNeed(r.typeId, r.legs);
  if (need) out.push(`ETOPS-${need}: up to ${need} minutes from an alternate on one engine${etopsApproved(r.companyId, r.typeId) >= need ? ' (approved)' : ' (not approved)'}`);
  r.legs.filter((k: string, i: number) => r.legs.indexOf(k) === i).forEach((k: string) => { if (CURFEWS[k]) out.push(`${k}: ${curfewText(k).toLowerCase()}`); if (SLOTS[k]) out.push(`${k}: slot-coordinated, ${money(slotLease(k))} a month`); });
  return out.length ? `<div class="biz-info">${out.map(x => `<span>${icon('info')}${esc(x)}</span>`).join('')}</div>` : '';
}

/* ======================= sustainable fuel and emission charges (both) ======================= */
// EU and UK emission trading: flights within the European Economic Area, the UK and Switzerland pay for
// their CO2 (3.16 kg for each kg of jet fuel). Sustainable aviation fuel (SAF) costs about 2.8 times as much
// and cuts the counted CO2 by 80% of the share blended in.
const ETS_COUNTRIES = ['Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Cyprus', 'Czechia', 'Czech Republic', 'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Ireland', 'Italy', 'Latvia', 'Lithuania', 'Luxembourg', 'Malta', 'Netherlands', 'Poland', 'Portugal', 'Romania', 'Slovakia', 'Slovenia', 'Spain', 'Sweden', 'Iceland', 'Norway', 'Liechtenstein', 'United Kingdom', 'Switzerland'];
const ETS_USD_T = 85, SAF_PREMIUM = 1.8;
function inEts(icao: string): boolean { const a: any = apt(icao); return !!a && ETS_COUNTRIES.indexOf(a.country) >= 0; }
function safShare(cid: string): number { const c: any = company(cid); return clamp((c && c.saf) || 0, 0, 0.5); }
function bizEmissionLines(cid: string, from: string, to: string, burnKg: number, price: number, lines: [string, number][], book: boolean) {
  if (!burnKg) return;
  const saf = safShare(cid), co2 = burnKg * 3.16 / 1000;
  if (saf) lines.push([`Sustainable fuel: ${Math.round(saf * 100)}% blended (extra cost)`, -Math.round(burnKg * saf * price * SAF_PREMIUM)]);
  if (inEts(from) && inEts(to)) { const t = co2 * (1 - saf * 0.8); lines.push([`Emission allowances, ${t.toFixed(1)} t CO2`, -Math.round(t * ETS_USD_T)]); }
  if (book) { const s: any = vaStats(); s.co2 = (s.co2 || 0) + co2 * (1 - saf * 0.8); }
}
function safCardHtml(): string {
  const c: any = company(), s: any = vaStats(), saf = safShare(c.id);
  return `<div class="card"><div class="card-h"><b>Sustainable fuel and emissions</b><small>This month: ${num(Math.round(s.co2 || 0))} t CO2</small></div>
    <div class="fare-row"><span><b>Sustainable fuel (SAF) blend</b><small>Costs about 2.8 times as much as jet fuel; cuts counted CO2 and the emission charges, and passengers like it.</small></span><span class="seg">${[0, 0.02, 0.05, 0.1, 0.2, 0.5].map(v => `<button class="${Math.abs(saf - v) < 0.001 ? 'on' : ''}" data-act="saf-set" data-v="${v}">${Math.round(v * 100)}%</button>`).join('')}</span></div>
    <small class="muted">Flights within the EU, EEA, UK and Switzerland pay for their CO2 under emission trading (about $${ETS_USD_T} a tonne).</small></div>`;
}
ACTIONS['saf-set'] = el => { const c: any = company(); c.saf = +el.getAttribute('data-v'); Store.save(); Sound.tick(); refresh(); };

/* ======================= taking over rival airlines (single player) ======================= */
function takeoverPrice(A: TrafficAirline): { price: number; weak: boolean } {
  const rows = league(); const r = rows.filter(x => x.name === A.name)[0], rank = rows.indexOf(r), weak = rank >= rows.length - 4;
  const fleet = A.fleet.reduce((s, c) => s + (acType(c.typeId) ? acType(c.typeId).price : 50e6) * 0.45, 0);
  return { price: Math.round(fleet * (0.6 + A.quality * 0.5) * (weak ? 0.7 : 1) / 1e5) * 1e5, weak };
}
ACTIONS['tko-buy'] = el => {
  if (!soloMode()) return;
  const A = Traffic.airlines().filter(x => x.name === el.getAttribute('data-n'))[0]; if (!A) return;
  const c = company(), { price } = takeoverPrice(A);
  if (c.balance < price) { toast(`You need ${money(price, { compact: true })} to take over ${A.name}`, 'warn'); return; }
  confirmChange(`Take over ${A.name}?`, `${money(price)} for the airline: its ${A.fleet.length} aircraft join your fleet at ${A.hub} as a new division, and ${A.name} stops flying under its own name. Hire pilots to fly them.`, `Take over for ${money(price, { compact: true })}`, 'Not now', () => {
    closeAll();
    payTxn(c.id, `Takeover of ${A.name}`, -price, 'purchase', [[`${A.name}: ${A.fleet.length} aircraft and its base at ${A.hub}`, -price]]);
    const div = { id: uid(), name: A.name, color: A.color }; c.divisions.push(div as any);
    try { registerWorldAirport(A.hub); } catch (e) { /* ignore */ }
    const regs = nextRegs(c, Math.min(30, A.fleet.length));
    A.fleet.slice(0, regs.length).forEach((x, i) => State.fleet.push({ engine: engineFor(x.typeId, regs[i]) || undefined, reg: regs[i], typeId: x.typeId, companyId: c.id, divisionId: div.id, base: A.hub, location: A.hub, hoursMin: Math.round((4000 + Math.random() * 30000) * 60), cycles: Math.round(3000 + Math.random() * 20000), condition: Math.round(70 + Math.random() * 22), status: 'parked', delivered: dateStr(new Date()).slice(0, 10) } as any));
    bizState().taken.push(A.name); Traffic.lines = null; Traffic._cache = null;
    try { Progress.popularity(1, `Took over ${A.name}`); } catch (e) { /* ignore */ }
    try { newsPost(c, A.hub, { section: 'Business', headline: `${c.name} takes over ${A.name}`, standfirst: `${A.fleet.length} aircraft and the base at ${A.hub} change hands for ${money(price, { compact: true })}.`, body: [`${A.name} will fly as part of ${c.name}.`] }); } catch (e) { /* ignore */ }
    Store.save(); refresh(); toast(`${A.name} is yours: ${regs.length} aircraft at ${A.hub}`, 'ok');
  }, () => closeTop());
};

/* ======================= shares and investors (single player) ======================= */
function sharesOf(cid: string): any { const b = bizState(); return b.shares[cid] || (b.shares[cid] = { pub: false, mine: 100, price: 0, hist: [], board: 70, div: 0, holders: [] }); }
function airlineValue(cid: string): number {
  const c = company(cid), fv = fleetOf(cid).reduce((s, a) => s + aircraftValue(a), 0), S: any = State;
  const nets = Object.keys(S.vaStats || {}).sort().slice(-3).map(k => S.vaStats[k].net || 0), avg = nets.length ? nets.reduce((a, b) => a + b, 0) / nets.length : 0;
  return Math.max(1e6, fv + c.balance + Math.max(0, avg) * 12 * 3);
}
function sharesHtml(): string {
  const c = company(), sh = sharesOf(c.id), val = airlineValue(c.id);
  if (!sh.pub) {
    const ok = fleetOf(c.id).length >= 5;
    return `<div class="card"><div class="card-h"><b>Shares and investors</b><small>${ok ? 'Your airline could go public' : 'Go public from 5 aircraft'}</small></div>
      <p class="fine-print">${icon('info')}Sell part of the airline on the stock market to raise money. Investors then expect profits and dividends; a board that loses patience causes trouble. Valued today at about ${money(val, { compact: true })}.</p>
      <div class="btn-row">${[20, 30, 49].map(p => `<button class="btn ghost sm" data-act="ipo" data-p="${p}" ${ok ? '' : 'disabled'}>Sell ${p}% · ${money(val * p / 100 * 0.95, { compact: true })}</button>`).join('')}</div></div>`;
  }
  const hist = sh.hist.slice(-60).map((h: any) => h.p);
  return `<div class="card"><div class="card-h"><b>Shares and investors</b><small>You own ${sh.mine}% · board confidence ${Math.round(sh.board)}%</small></div>
    <div class="mkt-row"><div class="mkt-now"><small>Share price</small><b>$${sh.price.toFixed(2)}</b></div><div class="mkt-spark">${hist.length > 1 ? sparkline(hist, 220, 46) : ''}<small>Last ${hist.length} days</small></div></div>
    <div class="fare-row"><span><b>Dividend</b><small>Share of each month's profit paid to the other shareholders</small></span><span class="seg">${[0, 0.2, 0.4, 0.6].map(v => `<button class="${sh.div === v ? 'on' : ''}" data-act="div-set" data-v="${v}">${v * 100}%</button>`).join('')}</span></div>
    ${sh.holders.length ? `<small class="muted">Shareholders: ${sh.holders.map((h: any) => `${esc(h.name)} ${h.pct}%`).join(', ')}</small>` : ''}
    <div class="btn-row">${sh.mine < 100 ? `<button class="btn ghost sm" data-act="buyback">Buy back 10% · ${money(airlineValue(c.id) * 0.1 * 1.1, { compact: true })}</button>` : ''}</div></div>`;
}
ACTIONS['ipo'] = el => {
  if (!soloMode()) return; const c = company(), p = +el.getAttribute('data-p'), val = airlineValue(c.id), cash = Math.round(val * p / 100 * 0.95);
  confirmChange(`Sell ${p}% of ${c.name}?`, `Investors pay ${money(cash)} (after bank fees). From then on they expect profits and dividends, and a share price shows how they rate you.`, 'Go public', 'Not now', () => {
    const sh = sharesOf(c.id); sh.pub = true; sh.mine = 100 - p; sh.price = val / 1e7; sh.hist = [{ d: dateStr(new Date()).slice(0, 10), p: sh.price }]; sh.holders = [{ name: 'Investors on the stock market', pct: p }];
    payTxn(c.id, `Shares sold on the stock market (${p}%)`, cash, 'revenue', [[`${p}% of ${c.name}`, cash]]);
    try { newsPost(c, c.hub, { section: 'Business', headline: `${c.name} goes public`, standfirst: `${p}% of the airline sold to investors for ${money(cash, { compact: true })}.`, body: ['Analysts expect a steady dividend.'] }); } catch (e) { /* ignore */ }
    Store.save(); closeTop(); refresh();
  }, () => closeTop());
};
ACTIONS['div-set'] = el => { const sh = sharesOf(company().id); sh.div = +el.getAttribute('data-v'); Store.save(); Sound.tick(); refresh(); };
ACTIONS['buyback'] = () => {
  const c = company(), sh = sharesOf(c.id), cost = Math.round(airlineValue(c.id) * 0.1 * 1.1);
  if (c.balance < cost) { toast('Not enough money', 'warn'); return; }
  payTxn(c.id, 'Shares bought back (10%)', -cost, 'purchase', [['10% of the airline back from shareholders', -cost]]);
  sh.mine = Math.min(100, sh.mine + 10); let left = 10; for (const h of sh.holders) { const t = Math.min(h.pct, left); h.pct -= t; left -= t; } sh.holders = sh.holders.filter((h: any) => h.pct > 0);
  if (sh.mine >= 100) sh.pub = false; sh.board = Math.min(100, sh.board + 8); Store.save(); refresh(); toast('10% bought back', 'ok');
};
function sharesDaily() {
  if (!soloMode()) return; const c = company(), sh = sharesOf(c.id);
  if (sh.pub) {
    const rows = league(), me = rows.filter(r => r.you)[0], rank = rows.indexOf(me) / Math.max(1, rows.length - 1);
    const target = airlineValue(c.id) / 1e7 * (1.15 - rank * 0.3) * (0.85 + (c.reputation || 50) / 333);
    sh.price = Math.max(0.05, sh.price + (target - sh.price) * 0.2 + sh.price * (Math.random() - 0.5) * 0.04);
    const d = dateStr(new Date()).slice(0, 10); if (!sh.hist.length || sh.hist[sh.hist.length - 1].d !== d) sh.hist.push({ d, p: Math.round(sh.price * 100) / 100 }); if (sh.hist.length > 180) sh.hist.shift();
  }
  // struggling: a rival offers to invest
  if (c.balance < 0) { sh.redDays = (sh.redDays || 0) + 1; if (sh.redDays >= 7 && !sh.offerAt) { sh.offerAt = Date.now(); const A = Traffic.airlines()[Math.floor(Math.random() * Math.max(1, Traffic.airlines().length))]; const amt = Math.round(airlineValue(c.id) * 0.25 / 1e5) * 1e5; State.notices.unshift({ id: uid(), kind: 'company', title: `${A ? A.name : 'A rival'} offers to invest`, body: `25% of ${c.name} for ${money(amt)}. Tap to decide.`, time: 'Now', at: Date.now(), read: false, ref: 'va-invest-' + amt + '-' + (A ? A.name : 'A rival') } as any); } } else sh.redDays = 0;
}
function investOffer(ref: string) {
  const m = /^va-invest-(\d+)-(.+)$/.exec(ref); if (!m) return; const amt = +m[1], who = m[2], c = company(), sh = sharesOf(c.id);
  confirmChange(`${who} offers ${money(amt)}`, `They buy 25% of ${c.name} and become a shareholder expecting dividends.`, 'Accept', 'Decline', () => {
    sh.pub = true; sh.mine = Math.max(0, sh.mine - 25); sh.holders.push({ name: who, pct: 25 }); if (!sh.price) sh.price = airlineValue(c.id) / 1e7;
    payTxn(c.id, `Investment by ${who} (25%)`, amt, 'revenue', [[`25% of ${c.name}`, amt]]); State.notices = State.notices.filter((n: any) => n.ref !== ref); Store.save(); closeTop(); refresh();
  }, () => { State.notices = State.notices.filter((n: any) => n.ref !== ref); sharesOf(c.id).offerAt = 0; closeTop(); });
}
function sharesMonthEnd(month: string) {
  if (!soloMode()) return; const c = company(), sh = sharesOf(c.id); if (!sh.pub) return;
  const net = vaStats(month).net || 0, others = (100 - sh.mine) / 100;
  if (sh.div && net > 0) { const pay = Math.round(net * sh.div * others); payTxn(c.id, `Dividend to shareholders (${Math.round(sh.div * 100)}% of profit)`, -pay, 'fees', [[`${Math.round(others * 100)}% held by others`, -pay]]); }
  sh.board = clamp(sh.board + (net > 0 ? 6 : -10) + sh.div * 10 - (sh.hist.length > 30 && sh.price < sh.hist[sh.hist.length - 30].p * 0.85 ? 8 : 0), 0, 100);
  if (sh.board < 25) { State.notices.unshift({ id: uid(), kind: 'company', title: 'The board is losing patience', body: `Confidence ${Math.round(sh.board)}%. Investors want profits or dividends; buying shares back also helps.`, time: 'Now', at: Date.now(), read: false } as any); try { Progress.popularity(-1, 'Board unrest'); newsPost(c, c.hub, { section: 'Business', headline: `Investors unhappy with ${c.name}`, standfirst: 'Shareholders call for change after a weak month.', body: [`The share price stands at $${sh.price.toFixed(2)}.`] }); } catch (e) { /* ignore */ } }
}

/* ======================= rivals reacting to your fares (single player) ======================= */
/** The other airlines on a route, with any reaction to you in force: a price war, more flights, or gone. */
function rivalApply(key: string, out: Competitor[]): Competitor[] {
  if (Mode.coop()) return out; const r = bizState().rival[key]; if (!r || r.until < Date.now()) return out;
  return out.filter(c => !(r.kind === 'out' && c.name === r.name)).map(c => c.name !== r.name ? c : Object.assign({}, c, r.kind === 'war' ? { fare: c.fare * 0.8 } : r.kind === 'freq' ? { daily: c.daily + 2 } : {}));
}
function rivalsDaily() {
  if (!soloMode()) return; const c = company(), b = bizState();
  for (const rt of State.routes.filter(x => x.companyId === c.id && !x.test)) {
    if (rt.legs.length < 2) continue; const key = [rt.legs[0], rt.legs[1]].sort().join('-'), cur = b.rival[key];
    if (cur && cur.until > Date.now()) continue;
    const fare = routeFares(rt).y, comp = competitorsOn(rt.legs[0], rt.legs[1]); if (!comp.length || fare > 0.92 || Math.random() > 0.12) continue;
    const x = comp[Math.floor(Math.random() * comp.length)], kind = x.quality > 65 ? (Math.random() < 0.5 ? 'war' : 'freq') : 'out';
    b.rival[key] = { name: x.name, kind, until: Date.now() + (30 + Math.random() * 30) * 864e5 };
    const txt = kind === 'war' ? `${x.name} cut its fares by 20% on ${rt.legs[0]}–${rt.legs[1]} to fight back` : kind === 'freq' ? `${x.name} added two daily flights on ${rt.legs[0]}–${rt.legs[1]}` : `${x.name} pulled out of ${rt.legs[0]}–${rt.legs[1]}: your low fares won`;
    State.notices.unshift({ id: uid(), kind: 'company', title: kind === 'out' ? 'A rival gave up' : 'A rival fights back', body: `${txt}.`, time: 'Now', at: Date.now(), read: false } as any);
    try { newsPost(c, rt.legs[0], { section: 'Business', headline: kind === 'war' ? `Price war on ${rt.legs[0]}–${rt.legs[1]}` : kind === 'freq' ? `${x.name} steps up against ${c.name}` : `${x.name} leaves ${rt.legs[0]}–${rt.legs[1]}`, standfirst: txt + '.', body: ['Travellers stand to benefit.'] }); } catch (e) { /* ignore */ }
  }
}

/* ======================= scenarios (single player) ======================= */
interface Scenario { id: string; name: string; desc: string; hub: string; kind: string; cash: number; fleet: [string, number, number][]; days: number; goals: { k: string; n: number; label: string }[] }
const SCENARIOS: Scenario[] = [
  { id: 'islands', name: 'Island hopper', desc: 'Start a small airline in the Faroe Islands with one turboprop and link the North Atlantic.', hub: 'EKVG', kind: 'regional', cash: 9e6, fleet: [['atr72', 1, 90]], days: 60, goals: [{ k: 'dests', n: 10, label: 'Fly to 10 destinations' }, { k: 'flights', n: 150, label: 'Fly 150 flights' }] },
  { id: 'rescue', name: 'Rescue mission', desc: 'An airline in Oslo on the edge of bankruptcy: worn aircraft and debts. Turn it round.', hub: 'ENGM', kind: 'major', cash: -2e6, fleet: [['a320neo', 4, 58]], days: 45, goals: [{ k: 'balance', n: 5e6, label: 'Reach $5M in the bank' }, { k: 'pop', n: 60, label: 'Popularity 60' }] },
  { id: 'atlantic', name: 'Atlantic bridge', desc: 'Two long-haul jets in Reykjavík: build a transatlantic network.', hub: 'BIKF', kind: 'major', cash: 25e6, fleet: [['b78x', 2, 95]], days: 60, goals: [{ k: 'routes', n: 4, label: 'Run 4 routes' }, { k: 'profit', n: 10e6, label: 'Earn $10M profit' }] },
  { id: 'bush', name: 'Alaska bush', desc: 'A float plane and a Caravan in the Alaskan wilderness.', hub: 'PALH', kind: 'bush', cash: 1.5e6, fleet: [['c208', 1, 85], ['dhc2', 1, 80]], days: 45, goals: [{ k: 'dests', n: 15, label: 'Land at 15 airports' }, { k: 'flights', n: 200, label: 'Fly 200 flights' }] },
];
function scenarioProgress(cid: string, sc: Scenario, start: number): { k: string; have: number; n: number; label: string }[] {
  const c = company(cid), logs = State.logbook.filter((l: any) => plane(l.reg) && plane(l.reg).companyId === cid && _logTime(l) >= start);
  const S: any = State, ai = (S.aiDay || []).filter((x: any) => plane(x.reg) && plane(x.reg).companyId === cid);
  const done = bizState().scen[cid] || {}, flights = (done.legs || 0) + logs.length;
  const dests = new Set<string>(); logs.forEach((l: any) => dests.add(l.to)); (done.dests || []).forEach((d: string) => dests.add(d)); ai.forEach((x: any) => dests.add(x.to));
  const profit = State.txns.filter((t: any) => t.companyId === cid && Date.parse(t.date) >= start - 864e5).reduce((s: number, t: any) => s + t.amount, 0);
  const val = (k: string) => k === 'dests' ? dests.size : k === 'flights' ? flights : k === 'balance' ? c.balance : k === 'pop' ? Math.round(c.reputation || 0) : k === 'routes' ? State.routes.filter(r => r.companyId === cid && !r.test).length : k === 'profit' ? profit : 0;
  return sc.goals.map(g => ({ k: g.k, have: val(g.k), n: g.n, label: g.label }));
}
function scenariosHtml(): string {
  const S: any = State, mine = State.companies.filter((c: any) => c.scenario);
  return `${mine.map((c: any) => { const sc = SCENARIOS.filter(x => x.id === c.scenario.id)[0]; if (!sc) return ''; const pr = scenarioProgress(c.id, sc, c.scenario.start), left = Math.ceil((c.scenario.start + sc.days * 864e5 - Date.now()) / 864e5);
      return `<div class="card"><div class="card-h"><b>${esc(sc.name)}: ${esc(c.name)}</b><small>${c.scenario.medal ? icon('trophy') + ' ' + esc(c.scenario.medal) + ' medal' : left > 0 ? left + ' days left' : 'Time is up: finish for a bronze medal'}</small></div>
        ${pr.map(g => `<div class="ev-row"><span><b>${esc(g.label)}</b><small>${g.k === 'balance' || g.k === 'profit' ? money(g.have, { compact: true }) : num(g.have)} of ${g.k === 'balance' || g.k === 'profit' ? money(g.n, { compact: true }) : num(g.n)}</small></span><span class="mkt-bar"><i style="width:${Math.min(100, Math.max(0, g.have / g.n * 100)).toFixed(0)}%"></i></span></div>`).join('')}
        ${State.companyId !== c.id ? `<div class="modal-actions"><button class="btn ghost sm" data-act="scen-go" data-id="${esc(c.id)}">Switch to it</button></div>` : ''}</div>`; }).join('')}
    <div class="card"><div class="card-h"><b>Scenarios</b><small>Ready-made challenges, each as a new company of its own; your airline carries on as it is</small></div>
    ${SCENARIOS.map(sc => `<div class="ev-row"><span><b>${esc(sc.name)}</b><small>${esc(sc.desc)} ${sc.goals.map(g => g.label).join(' · ')} within ${sc.days} days.</small></span><button class="btn primary sm" data-act="scen-start" data-id="${sc.id}" ${mine.some((c: any) => c.scenario.id === sc.id && !c.scenario.medal) ? 'disabled' : ''}>Start</button></div>`).join('')}
    <small class="muted">Medals: gold when every goal is reached within half the time, silver within the time, bronze later.</small></div>`;
}
ACTIONS['scen-start'] = el => {
  if (!soloMode()) return; const sc = SCENARIOS.filter(x => x.id === el.getAttribute('data-id'))[0]; if (!sc) return;
  confirmChange(`Start "${sc.name}"?`, `A new company at ${sc.hub} with ${sc.fleet.map(f => f[1] + '× ' + acType(f[0]).model).join(' and ')} and ${money(sc.cash, { compact: true })}. Your own airline stays as it is: switch between them at the top.`, 'Start', 'Not now', () => {
    closeAll(); const cur = company(), id = uid();
    try { registerWorldAirport(sc.hub); } catch (e) { /* ignore */ }
    const names: { [k: string]: [string, string, string] } = { islands: ['Atlantic Hopper', 'AHP', '#2E9CCA'], rescue: ['Nordic Phoenix', 'NPX', '#E07A5F'], atlantic: ['Bridge Atlantic', 'BRA', '#5E60CE'], bush: ['Wilderness Air', 'WLD', '#8AB17D'] };
    const n = names[sc.id];
    State.companies.push({ id, profileId: profileOfCompany(cur.id).id, name: n[0], icao: n[1], callsign: n[0].split(' ')[0].toUpperCase(), hub: sc.hub, color: n[2], color2: '#1A2433', balance: sc.cash, reputation: sc.id === 'rescue' ? 35 : 50, founded: dateStr(new Date()).slice(0, 10), kind: sc.kind, divisions: [], scenario: { id: sc.id, start: Date.now() } } as any);
    (State as any).coPilot[id] = { sex: 'f', id: '' };
    const co = State.companies[State.companies.length - 1];
    sc.fleet.forEach(([tid, cnt, cond]) => nextRegs(co, cnt).forEach(reg => State.fleet.push({ engine: engineFor(tid, reg) || undefined, reg, typeId: tid, companyId: id, base: sc.hub, location: sc.hub, hoursMin: Math.round((cond > 80 ? 500 : 30000) * 60), cycles: cond > 80 ? 300 : 22000, condition: cond, status: 'parked', delivered: dateStr(new Date()).slice(0, 10) } as any)));
    State.companyId = id; State.divisionId = 'all'; applyCompanyTheme(true); Store.save(); go('ops'); renderTopbar();
    toast(`"${sc.name}" started: ${n[0]} at ${sc.hub}. Hire a mechanic to start flying.`, 'ok');
  }, () => closeTop());
};
ACTIONS['scen-go'] = el => { State.companyId = el.getAttribute('data-id'); State.divisionId = 'all'; applyCompanyTheme(true); Store.save(); go('ops'); renderTopbar(); };
function scenariosDaily() {
  if (!soloMode()) return;
  for (const c of State.companies as any[]) {
    if (!c.scenario || c.scenario.medal) continue; const sc = SCENARIOS.filter(x => x.id === c.scenario.id)[0]; if (!sc) continue;
    const pr = scenarioProgress(c.id, sc, c.scenario.start); if (!pr.every(g => g.have >= g.n)) continue;
    const used = (Date.now() - c.scenario.start) / 864e5, medal = used <= sc.days / 2 ? 'Gold' : used <= sc.days ? 'Silver' : 'Bronze';
    c.scenario.medal = medal; c.scenario.doneAt = Date.now();
    State.notices.unshift({ id: uid(), kind: 'staff', title: `Scenario complete: ${sc.name}`, body: `${medal} medal, in ${Math.ceil(used)} days.`, time: 'Now', at: Date.now(), read: false } as any);
    try { newsPost(c, c.hub, { section: 'Business', headline: `${c.name} meets every goal`, standfirst: `"${sc.name}" finished in ${Math.ceil(used)} days: a ${medal.toLowerCase()} medal.`, body: [sc.desc] }); } catch (e) { /* ignore */ }
  }
}

/* ======================= co-op: profit sharing ======================= */
function coopMonthStat(memberId: string, blockMin: number) {
  if (!coopOn()) return; const cr: any = crewRoom(), m = _monthKey(); cr.mstats = cr.mstats || {}; const ms = cr.mstats[m] = cr.mstats[m] || {};
  const x = ms[memberId] = ms[memberId] || { flights: 0, min: 0 }; x.flights++; x.min += blockMin || 0;
}
function shareRules(): { pct: number; basis: string } { const c: any = coopState(); c.rules.share = c.rules.share || { pct: 0, basis: 'flights' }; return c.rules.share; }
function profitShareHtml(): string {
  const r = shareRules(), owner = ((coopMe() as any) || {}).role === 'owner', cr: any = crewRoom(), ms = (cr.mstats || {})[_monthKey()] || {}, net = vaStats().net || 0;
  return `<div class="card"><div class="card-h"><b>Profit sharing</b><small>Paid out on the 1st from last month's profit</small></div>
    <div class="fare-row"><span><b>Share of the profit</b></span><span class="seg">${[0, 0.1, 0.2, 0.3, 0.5].map(v => `<button class="${r.pct === v ? 'on' : ''}" data-act="ps-set" data-k="pct" data-v="${v}" ${owner ? '' : 'disabled'}>${v * 100}%</button>`).join('')}</span></div>
    <div class="fare-row"><span><b>Split by</b></span><span class="seg">${[['flights', 'Flights'], ['hours', 'Hours flown']].map(([v, l]) => `<button class="${r.basis === v ? 'on' : ''}" data-act="ps-set" data-k="basis" data-v="${v}" ${owner ? '' : 'disabled'}>${l}</button>`).join('')}</span></div>
    <small class="muted">This month so far: ${money(net, { compact: true })} profit; ${Object.keys(ms).length} pilots have flown. Shares go into each pilot's wallet.</small></div>`;
}
ACTIONS['ps-set'] = el => { const r: any = shareRules(), k = el.getAttribute('data-k'), v = el.getAttribute('data-v'); r[k] = k === 'pct' ? +v : v; coopPost('staff', k === 'pct' ? `Profit sharing set to ${+v * 100}%` : `Profit shared by ${v}`); Store.save(); Sound.tick(); refresh(); };
function profitShareMonthEnd(month: string) {
  if (!coopOn()) return; const r = shareRules(), net = vaStats(month).net || 0; if (!r.pct || net <= 0) return;
  const cr: any = crewRoom(), ms = (cr.mstats || {})[month] || {}, ids = Object.keys(ms); if (!ids.length) return;
  const pool = Math.round(net * r.pct), tot = ids.reduce((s, id) => s + (r.basis === 'hours' ? ms[id].min : ms[id].flights), 0) || 1;
  payTxn(company().id, `Profit sharing for ${_monthName(month)}`, -pool, 'salary', ids.map(id => [`${(coopMember(id) || {} as any).name || 'A pilot'}`, -Math.round(pool * (r.basis === 'hours' ? ms[id].min : ms[id].flights) / tot)] as [string, number]));
  ids.forEach(id => { const share = Math.round(pool * (r.basis === 'hours' ? ms[id].min : ms[id].flights) / tot), m: any = coopMember(id); if (!m) return; if (m.you) meCareer().wallet += share; else m.wallet = (m.wallet || 0) + share; });
  coopPost('staff', `Profit sharing for ${_monthName(month)}: ${money(pool)} shared between ${ids.length} pilots`);
}

/* ======================= co-op: the company radio ======================= */
function radioList(): any[] { const cr: any = crewRoom(); return cr.radio || (cr.radio = []); }
function radioSay(who: string, text: string, mine?: boolean) {
  const l = radioList(); l.push({ at: Date.now(), who, text, mine: !!mine }); if (l.length > 60) l.splice(0, l.length - 60);
  if ((State.settings as any).radioVoice && !mine && !document.hidden) { try { Voice.speak(`${who}: ${text}`, undefined, 'pilot'); } catch (e) { /* no voice */ } }
}
let _radioT = 0;
/** Position reports from co-op flights now and then (and yours, when you fly). */
function radioTick() {
  if (!coopOn() || Date.now() - _radioT < 90e3) return; _radioT = Date.now();
  const flying = State.live.filter((f: any) => f.coop && f.pilotId && (f.alt || 0) > 3000);
  const f: any = flying[Math.floor(Math.random() * flying.length)];
  if (f && Math.random() < 0.6) { const m: any = coopMember(f.pilotId); const B = apt(f.to), pos = f.pos || (flightPathPos(f) || {} as any).pos; const nm = B && pos ? Math.round(gcDistanceNm(pos, B.pos)) : 0;
    radioSay(f.callsign, `${m ? m.name.split(' ')[0] + ' here, ' : ''}flight level ${Math.round((f.alt || 0) / 100)}, ${nm} miles from ${f.to}${f.phase ? ', ' + String(f.phase).toLowerCase() : ''}.`); if (State.screen === 'coop') try { refresh(); } catch (e) { /* ignore */ } }
}
const RADIO_QUICK = ['Ready for pushback', 'Airborne', 'Top of descent', 'On the ground', 'Anyone near ' + 'my destination?', 'Weather looks good here'];
function radioHtml(): string {
  const S: any = State.settings, l = radioList().slice(-12).reverse();
  return `<div class="card radio"><div class="card-h"><b>${icon('radio')} Company radio</b><small>Position reports and short messages between the co-op's pilots</small></div>
    <div class="radio-list">${l.map((x: any) => `<div class="radio-m ${x.mine ? 'me' : ''}"><em>${esc(x.who)}</em><span>${esc(x.text)}</span><small>${new Date(x.at).toTimeString().slice(0, 5)}</small></div>`).join('') || '<p class="muted pad">Quiet on the frequency.</p>'}</div>
    <div class="radio-quick">${RADIO_QUICK.map((q, i) => `<button class="fchip sm" data-act="radio-q" data-i="${i}">${esc(q)}</button>`).join('')}</div>
    <label class="tg-row"><span><b>Read messages aloud</b><small>With the app's voices</small></span><button class="tg ${S.radioVoice ? 'on' : ''}" data-act="radio-voice" role="switch"><i></i></button></label></div>`;
}
ACTIONS['radio-q'] = el => {
  const q = RADIO_QUICK[+el.getAttribute('data-i')], me: any = coopMe(), f: any = State.live.filter(x => x.you)[0];
  const text = /destination/.test(q) && f ? `Anyone near ${f.to}?` : q; radioSay(f ? f.callsign || me.name : me.name, text, true); Store.soon(); Sound.tick(); refresh();
  if (coopState().backend === 'demo' && Math.random() < 0.5) setTimeout(() => { const o: any = coopState().members.filter((m: any) => !m.you)[0]; if (o) { radioSay(o.name.split(' ')[0], ['Copy that.', 'Roger.', 'Have a good one.', 'Smooth air at my end.'][Math.floor(Math.random() * 4)]); if (State.screen === 'coop') refresh(); } }, 3000 + Math.random() * 4000);
};
ACTIONS['radio-voice'] = () => { const S: any = State.settings; S.radioVoice = !S.radioVoice; Store.save(); Sound.tick(); refresh(); };

/* ======================= co-op: the league of co-op airlines ======================= */
function coopRivalRows(month: string, upto: number): LeagueRow[] {
  const r = seeded('cooplg:' + company().id), names = COMPETITOR_NAMES.slice().sort(() => r() - 0.5).slice(0, 8);
  const d0 = Date.parse(month + '-01T00:00:00Z'), end = Math.min(upto, Date.parse(_nextMonth(month) + '-01T00:00:00Z')), frac = clamp((end - d0) / (30 * 864e5), 0, 1);
  return names.map((n, i) => {
    const q = seeded('coopq:' + n + month), members = 5 + Math.floor(q() * 35), legs = Math.round(members * (8 + q() * 17) * frac);
    const row: any = { name: n + ' (co-op)', you: false, legs, onTime: Math.round((70 + q() * 26) * 10) / 10, score: Math.round(70 + q() * 26), fpm: Math.round(110 + q() * 160), pop: Math.round(45 + q() * 45), pax: legs * 140 };
    row.index = _idx(row); row.ok = legs >= LEAGUE_MIN_LEGS; void i; return row;
  });
}

/* ======================= co-op: live positions of real members ======================= */
// With the online service, each member's app sends its simulator position every few seconds and receives the
// others': their aircraft then fly exactly as they really are, on the map and in the 3D view.
function coopApplyPositions(list: { id: string; lat: number; lon: number; altFt: number; hdg: number; gs: number; at: number }[]) {
  for (const p of list || []) {
    const f: any = State.live.filter((x: any) => x.coop && x.pilotId === p.id)[0]; if (!f) continue;
    f.real = Date.now() - p.at < 60e3; f.pos = [p.lon, p.lat]; f.alt = p.altFt; f.hdg = p.hdg; f.gs = p.gs; f.posAt = p.at;
  }
}
let _posSent = 0;
function coopSendPosition() {
  if (!coopOn() || Date.now() - _posSent < 5000) return; const s: any = Link.sim, be: any = coopBackend();
  if (!s || !s.connected || !be.sendPosition) return; _posSent = Date.now();
  try { be.sendPosition({ id: (coopMe() as any).id, lat: s.lat, lon: s.lon, altFt: s.altFt, hdg: s.hdg, gs: s.gs, at: Date.now() }); } catch (e) { /* offline */ }
}

/* ======================= the clocks ======================= */
function bizDaily() { try { rivalsDaily(); } catch (e) { /* ignore */ } try { sharesDaily(); } catch (e) { /* ignore */ } try { scenariosDaily(); } catch (e) { /* ignore */ } }
function bizMonthly(month: string) {
  const c = company(), b = bizState();
  // slot leases
  const routes = State.routes.filter(r => r.companyId === c.id && b.slots[r.id]); let lease = 0; const lines: [string, number][] = [];
  routes.forEach(r => (b.slots[r.id] as string[]).forEach(k => { lease += slotLease(k); lines.push([`${r.code}: slot pair at ${k}`, -slotLease(k)]); }));
  const sp = slotSpares(c.id), lost = sp.filter(x => Date.now() - x.since > 60 * 864e5);
  sp.filter(x => lost.indexOf(x) < 0).forEach(x => { lease += slotLease(x.k); lines.push([`Spare slot pair at ${x.k}`, -slotLease(x.k)]); });
  lost.forEach(x => { sp.splice(sp.indexOf(x), 1); State.notices.unshift({ id: uid(), kind: 'authority', title: `Slot pair at ${x.k} lost`, body: `It went unused for two months, so ${x.k} has given it to another airline (use it or lose it).`, time: 'Now', at: Date.now(), read: false } as any); });
  if (lease) payTxn(c.id, `Slot leases for ${_monthName(_monthKey())}`, -lease, 'fees', lines);
  // sustainable fuel: passengers notice
  const saf = safShare(c.id); if (saf) try { Progress.popularity(Math.min(2, saf * 10), 'Sustainable fuel'); } catch (e) { /* ignore */ }
  try { sharesMonthEnd(month); } catch (e) { /* ignore */ } try { profitShareMonthEnd(month); } catch (e) { /* ignore */ }
}
function startBiz() {
  setInterval(() => {
    if (document.hidden) return;
    const b = bizState(), d = new Date().toISOString().slice(0, 10), m = _monthKey();
    if (b.day !== d) { const first = !b.day; b.day = d; if (!first) bizDaily(); }
    if (b.month !== m) { const was = b.month; b.month = m; if (was) bizMonthly(was); }
    try { radioTick(); coopSendPosition(); } catch (e) { /* ignore */ }
    try { const be: any = coopOn() ? coopBackend() : null; if (be && be.positions) coopApplyPositions(be.positions()); } catch (e) { /* ignore */ }
  }, 20000);
}
function takeoverBtnHtml(A: TrafficAirline): string {
  if (!soloMode()) return ''; const t = takeoverPrice(A);
  return `<div class="card coop-note">${icon('trophy')}<span><b>Take over ${esc(A.name)}</b><small>${A.fleet.length} aircraft at ${esc(A.hub)}${t.weak ? ' · struggling, so cheaper' : ''}: ${money(t.price, { compact: true })}</small></span><button class="btn primary sm" data-act="tko-buy" data-n="${esc(A.name)}">Take over</button></div>`;
}
