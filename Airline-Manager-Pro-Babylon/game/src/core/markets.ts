// Difficulty, and the markets for jet fuel and spare parts.
//
// Difficulty (chosen when you found your first airline; Settings → Economy): from Cruising along to
// Extreme. It sets aircraft prices, what aircraft sell for, what flights earn and cost, loan rates and how
// wildly the markets swing. Your own airline and the co-op airline each have their own.
//
// Markets: jet fuel and spare parts prices move like real markets: mostly calm, now and then a jump or a
// fall with a reason (a conflict, a refinery fire, a factory strike, a mild winter...). Bad news is often
// seen coming: analysts warn a day or three ahead. Buy stock while it's cheap; flights from your bases use
// the stored fuel first, maintenance uses the stored parts first, and when the stock runs out you pay
// whatever the price is that day.

type Difficulty = 'cruise' | 'easy' | 'normal' | 'hard' | 'extreme';
const DIFFICULTY: { [k in Difficulty]: { name: string; hint: string; buy: number; sell: number; income: number; cost: number; vol: number; loan: number; start: number } } = {
  cruise: { name: 'Cruising along', hint: 'Cheap aircraft, generous passengers, calm markets. Just enjoy flying.', buy: 0.7, sell: 1.1, income: 1.3, cost: 0.75, vol: 0.6, loan: -2, start: 1.6 },
  easy: { name: 'Easy', hint: 'A forgiving start with room for mistakes.', buy: 0.85, sell: 1.05, income: 1.15, cost: 0.88, vol: 0.8, loan: -1, start: 1.25 },
  normal: { name: 'Normal', hint: 'Real-world prices and margins.', buy: 1, sell: 1, income: 1, cost: 1, vol: 1, loan: 0, start: 1 },
  hard: { name: 'Hard', hint: 'Thin margins, pricier aircraft, rougher markets.', buy: 1.15, sell: 0.93, income: 0.9, cost: 1.1, vol: 1.25, loan: 1.5, start: 0.8 },
  extreme: { name: 'Extreme', hint: 'Every dollar counts. Markets swing hard. For experts.', buy: 1.35, sell: 0.85, income: 0.78, cost: 1.22, vol: 1.6, loan: 3, start: 0.6 },
};
function difficulty(): Difficulty { const d = (State as any).difficulty; return DIFFICULTY[d as Difficulty] ? d : 'normal'; }
function diff() { return DIFFICULTY[difficulty()]; }
/** Aircraft list prices follow the difficulty (everything built on them follows: leasing, used, value). */
function applyDifficultyPrices() {
  const m = diff().buy;
  for (const t of AIRCRAFT as any[]) { if (t.basePrice == null) t.basePrice = t.price; t.price = Math.round(t.basePrice * m / 1000) * 1000; }
}
function setDifficulty(d: Difficulty) { (State as any).difficulty = d; applyDifficultyPrices(); Store.soon(); }

/* ---------- markets ---------- */
type MarketId = 'fuel' | 'parts';
interface MarketEvent { at: number; text: string; delta: number; kind: 'news' | 'warn'; due?: number }
interface Market { idx: number; target: number; hist: { d: string; v: number }[]; events: MarketEvent[]; next: number; pending?: { at: number; delta: number; text: string } ; last: number }
const MARKET_UP: { [k in MarketId]: [string, number][] } = {
  fuel: [['Fighting in an oil-producing region threatens supplies', 0.22], ['Oil producers agree to cut output', 0.1], ['A fire shuts a large refinery', 0.07], ['Hurricane season disrupts Gulf refineries', 0.06], ['Tankers rerouted around a conflict zone', 0.09], ['A cold winter pushes up demand for heating oil', 0.05], ['Sanctions on a major exporter', 0.14], ['Pipeline sabotage cuts deliveries', 0.08]],
  parts: [['A strike at an engine maker halts deliveries', 0.12], ['A chip shortage hits avionics suppliers', 0.09], ['A key titanium supplier faces sanctions', 0.14], ['Shipping delays at major ports', 0.06], ['Demand surges as airlines bring back parked aircraft', 0.08], ['A fire at a parts warehouse', 0.07]],
};
const MARKET_DOWN: { [k in MarketId]: [string, number][] } = {
  fuel: [['Oil producers raise output', -0.08], ['A mild winter cuts demand', -0.05], ['A ceasefire eases supply fears', -0.12], ['A slowing world economy cuts demand', -0.1], ['New refinery capacity comes online', -0.06], ['Stockpiles are higher than expected', -0.04]],
  parts: [['A new parts factory opens', -0.07], ['Suppliers clear their backlog', -0.06], ['Lots of aircraft retired: used parts flood the market', -0.1], ['The engine makers\' strike ends', -0.08]],
};
const MARKET_NAME: { [k in MarketId]: string } = { fuel: 'Jet fuel', parts: 'Spare parts' };
function marketsState(): { [k in MarketId]: Market } {
  const S: any = State; S.mkt = S.mkt || {};
  for (const k of ['fuel', 'parts'] as MarketId[]) if (!S.mkt[k]) { const t0 = Date.now() - 60 * 864e5; S.mkt[k] = { idx: 1, target: 1, hist: [], events: [], next: t0 + (1 + Math.random() * 3) * 864e5, last: t0 }; }   // with two months of history
  return S.mkt;
}
function marketIdx(k: MarketId): number { const m = marketsState()[k]; return m ? m.idx : 1; }
/* ---------- real-world prices ---------- */
// Jet fuel follows the real US Gulf Coast jet fuel spot price (U.S. Energy Information Administration),
// spare parts the real US producer price index for aircraft parts (U.S. Bureau of Labor Statistics); both
// public domain, fetched once a day by the app's own update service. Offline or switched off (Settings →
// Economy): the simulated market.
const MARKET_REAL_URL = 'https://raw.githubusercontent.com/DroneDirector/Microsoft-Flight-Simulator-Projects/amp-market-data/amp-market.json';
const FUEL_NORMAL_USD_GAL = 2.58;   // the app's normal fuel price (0.85 $/kg) in dollars a gallon
function realMarkets(): any { const S: any = State; const d = S.mktReal; return (State.settings as any).realMarkets !== false && d && d.fuel && Date.now() - Date.parse(d.updated) < 14 * 864e5 ? d : null; }
function fetchRealMarkets() {
  if ((State.settings as any).realMarkets === false) return;
  fetch(MARKET_REAL_URL + '?t=' + Math.floor(Date.now() / 3600e3), { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => {
    if (!d || !d.fuel || !d.parts) return;
    const S: any = State, was = S.mktReal && S.mktReal.updated; S.mktReal = d;
    if (was !== d.updated) { marketsAdvance(); Store.soon(); try { if (State.screen === 'finance') refresh(); } catch (e) { /* ignore */ } }
  }).catch(() => { /* offline: the simulated market carries on */ });
}
/** One market from the real figures: its level against normal, its last months, and what moved it. */
function marketFromReal(k: MarketId, m: Market, d: any, vol: number) {
  const s: [string, number][] = (k === 'fuel' ? d.fuel.series : d.parts.series) || []; if (s.length < 2) return;
  const base = k === 'fuel' ? FUEL_NORMAL_USD_GAL : s.slice(-36).reduce((a, x) => a + x[1], 0) / Math.min(36, s.length);
  const idxOf = (v: number) => clamp(1 + (v / base - 1) * vol, 0.4, 3);
  const last = s[s.length - 1];
  m.idx = m.target = idxOf(last[1]); m.last = Date.now(); m.pending = undefined;
  m.hist = s.slice(k === 'fuel' ? -90 : -36).map(x => ({ d: x[0], v: Math.round(idxOf(x[1]) * 1000) / 1000 }));
  // what moved it: the week's change for fuel, the month's for parts (each reported once)
  const back = k === 'fuel' ? s[Math.max(0, s.length - 6)] : s[s.length - 2], ch = (last[1] - back[1]) / back[1];
  const key = k + ':' + last[0];
  if ((m as any).realKey !== key) {
    (m as any).realKey = key; m.events = m.events.filter(e => (e as any).real);
    const pct = Math.round(Math.abs(ch) * 1000) / 10, up = ch > 0;
    if (Math.abs(ch) >= (k === 'fuel' ? 0.02 : 0.002)) {
      const text = k === 'fuel'
        ? `Jet fuel ${up ? 'rose' : 'fell'} ${pct}% in a week on the world market: the US Gulf Coast spot price is $${last[1].toFixed(2)} a gallon (EIA, ${last[0]})`
        : `Aircraft parts prices ${up ? 'rose' : 'fell'} ${pct}% in a month (US producer price index for aircraft parts, BLS, ${last[0].slice(0, 7)})`;
      const ev: any = { at: Date.parse(last[0]) || Date.now(), text, delta: ch, kind: 'news', real: true };
      m.events.unshift(ev);
      if (Math.abs(ch) >= (k === 'fuel' ? 0.05 : 0.01)) marketNotice(k, `${MARKET_NAME[k]} prices ${up ? 'up' : 'down'} ${pct}%`, `${text}. ${marketStockText(k)}`, Date.now());
    } else m.events.unshift({ at: Date.parse(last[0]) || Date.now(), text: k === 'fuel' ? `Jet fuel steady on the world market: $${last[1].toFixed(2)} a gallon on the US Gulf Coast (EIA, ${last[0]})` : `Aircraft parts prices steady (US producer price index, BLS, ${last[0].slice(0, 7)})`, delta: ch, kind: 'news', real: true } as any);
    if (m.events.length > 40) m.events.length = 40;
  }
  marketOutlook(k, m, d, s);
}
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** What's coming: the EIA's forecast for jet fuel; for parts, where the last year's trend leads (not a forecast). */
function marketOutlook(k: MarketId, m: Market, d: any, s: [string, number][]) {
  let o: any = null;
  if (k === 'fuel') {
    const f: [string, number][] = (d.outlook && d.outlook.series) || [], now = new Date().toISOString().slice(0, 7);
    const i = f.map(x => x[0]).lastIndexOf(f.filter(x => x[0] <= now).map(x => x[0]).pop() || '');
    if (i >= 0 && f[i][1] > 0) {
      const j = Math.min(f.length - 1, i + 3);
      if (j > i) {
        const ch = f[j][1] / f[i][1] - 1, mon = MONTH_NAMES[Number(f[j][0].slice(5, 7)) - 1] || f[j][0];
        const at = s[s.length - 1][1] * (1 + ch);
        o = { ch, key: 'fuel:' + f[f.length - 1][0] + ':' + f[j][0] + ':' + Math.round(ch * 100), forecast: true,
          text: Math.abs(ch) < 0.02 ? `The EIA expects jet fuel to stay about where it is through ${mon} (Short-Term Energy Outlook).`
            : `The EIA expects jet fuel about ${ch > 0 ? '+' : ''}${Math.round(ch * 100)}% by ${mon}, around $${at.toFixed(2)} a gallon (Short-Term Energy Outlook).` };
      }
    }
  } else if (s.length >= 13) {
    const back = s[s.length - 13][1], last = s[s.length - 1][1];
    if (back > 0) {
      const rate = Math.pow(last / back, 1 / 12) - 1, ch = Math.pow(1 + rate, 3) - 1;
      o = { ch, key: 'parts:' + s[s.length - 1][0], forecast: false,
        text: Math.abs(ch) < 0.003 ? 'Parts prices have been flat over the last year (trend, not a forecast).'
          : `At the last year's pace, parts prices would be about ${ch > 0 ? '+' : ''}${(Math.round(ch * 1000) / 10).toFixed(1)}% in three months (trend, not a forecast).` };
    }
  }
  const was = (m as any).outlook; (m as any).outlook = o;
  if (o && (!was || was.key !== o.key) && Math.abs(o.ch) >= (k === 'fuel' ? 0.05 : 0.01))
    marketNotice(k, `${MARKET_NAME[k]} prices expected to ${o.ch > 0 ? 'rise' : 'fall'}`, `${o.text} ${o.ch > 0 ? 'Buying stock now could pay off. ' : 'Holding off on stock could save money. '}${marketStockText(k)}`, Date.now());
}
/** Run the markets up to now (also after the app was closed for a while). */
function marketsAdvance() {
  const ms = marketsState(), now = Date.now(), vol = diff().vol, real = realMarkets();
  for (const k of ['fuel', 'parts'] as MarketId[]) {
    const m = ms[k];
    if (real) { marketFromReal(k, m, real, vol); continue; }
    let t = Math.max(m.last || now, now - 60 * 864e5);
    while (t < now) {
      const step = Math.min(3600e3, now - t); t += step; const h = step / 3600e3;
      // a warning comes true
      if (m.pending && t >= m.pending.at) { marketMove(k, m, m.pending.delta, m.pending.text, t); m.pending = undefined; }
      // the next piece of news: often seen coming (rises especially), sometimes out of the blue
      if (t >= m.next) {
        const gap = m.target - 1, upBias = gap > 0.25 ? 0.25 : gap < -0.15 ? 0.75 : 0.55;
        const up = Math.random() < upBias, list = up ? MARKET_UP[k] : MARKET_DOWN[k], e = list[Math.floor(Math.random() * list.length)];
        const delta = e[1] * vol * (0.7 + Math.random() * 0.6);
        if (Math.random() < (up ? 0.65 : 0.3)) {
          const due = t + (1 + Math.random() * 2) * 864e5;
          m.pending = { at: due, delta, text: e[0] };
          m.events.unshift({ at: t, text: `Analysts expect ${MARKET_NAME[k].toLowerCase()} prices to ${up ? 'rise' : 'fall'} soon: ${e[0].charAt(0).toLowerCase() + e[0].slice(1)}`, delta, kind: 'warn', due });
          marketNotice(k, `${MARKET_NAME[k]} prices may ${up ? 'rise' : 'fall'} soon`, `${e[0]}. Analysts expect about ${up ? '+' : ''}${Math.round(delta * 100)}% within a few days.${up ? ' Buying stock now could pay off.' : ''}`, t);
        } else marketMove(k, m, delta, e[0], t);
        m.next = t + (3 + Math.random() * 7) * 864e5 / Math.max(0.6, vol);
      }
      // prices drift towards where the news put them, and slowly back towards normal; a little noise
      m.target += (1 - m.target) * 0.004 * h;
      m.idx += (m.target - m.idx) * Math.min(1, 0.05 * h) + (Math.random() - 0.5) * 0.002 * vol * Math.sqrt(h);
      m.idx = clamp(m.idx, 0.55, 2.2);
      const d = new Date(t).toISOString().slice(0, 10);
      if (!m.hist.length || m.hist[m.hist.length - 1].d !== d) { m.hist.push({ d, v: Math.round(m.idx * 1000) / 1000 }); if (m.hist.length > 120) m.hist.shift(); }
      else m.hist[m.hist.length - 1].v = Math.round(m.idx * 1000) / 1000;
    }
    m.last = now; if (m.events.length > 40) m.events.length = 40;
  }
}
function marketMove(k: MarketId, m: Market, delta: number, text: string, t: number) {
  m.target = clamp(m.target * (1 + delta), 0.6, 2);
  m.events.unshift({ at: t, text, delta, kind: 'news' });
  marketNotice(k, `${MARKET_NAME[k]} prices ${delta > 0 ? 'up' : 'down'}: ${text.charAt(0).toLowerCase() + text.slice(1)}`, `Prices are heading ${delta > 0 ? 'up' : 'down'} by about ${Math.abs(Math.round(delta * 100))}% over the coming days. ${marketStockText(k)}`, t);
  if (Math.abs(delta) >= 0.1 && t > Date.now() - 3600e3) { try { const c = company(); newsPost(c, c.hub, { section: 'Business', art: { kind: 'aircraft', typeId: (fleetOf(c.id)[0] || { typeId: 'a320neo' } as any).typeId, color: c.color, color2: c.color2 }, headline: `${MARKET_NAME[k]} prices ${delta > 0 ? 'soar' : 'tumble'}`, standfirst: `${text}. Airlines face ${delta > 0 ? 'higher' : 'lower'} costs.`, body: [`${MARKET_NAME[k]} ${delta > 0 ? 'rose' : 'fell'} sharply. Airlines with ${k === 'fuel' ? 'fuel' : 'parts'} in stock are ${delta > 0 ? 'protected for now' : 'paying more than they need to'}.`], quote: [delta > 0 ? 'Those who stocked up early will be glad they did.' : 'Good news for airlines.', 'A market analyst'] } as any); } catch (e) { /* ignore */ } }
}
function marketNotice(k: MarketId, title: string, body: string, t: number) {
  if (t < Date.now() - 2 * 864e5) return;   // long-past news (the app was closed): only in the market history
  State.notices.unshift({ id: uid(), kind: 'finance' as any, title, body, time: t > Date.now() - 120e3 ? 'Now' : dateStr(new Date(t)).slice(5, 16), at: t, read: false } as any);
}
function startMarkets() { marketsAdvance(); fetchRealMarkets(); setInterval(() => { if (!document.hidden) marketsAdvance(); }, 60000); setInterval(() => { if (!document.hidden) fetchRealMarkets(); }, 6 * 3600e3); }

/* ---------- stock ---------- */
interface Stock { fuelKg: number; fuelPaid: number; parts: number; partsPaid: number }
function stockOf(cid: string): Stock { const S: any = State; S.stock = S.stock || {}; return S.stock[cid] || (S.stock[cid] = { fuelKg: 0, fuelPaid: 0, parts: 0, partsPaid: 0 }); }
function fuelCapKg(cid: string): number { return 400000 + 150000 * fleetOf(cid).length; }
function partsCap(cid: string): number { return 500000 + 250000 * fleetOf(cid).length; }
function marketStockText(k: MarketId): string {
  const s = stockOf(State.companyId);
  return k === 'fuel' ? (s.fuelKg ? `You have ${num(Math.round(s.fuelKg / 1000))} t of fuel in stock.` : 'You have no fuel in stock.') : (s.parts ? `You have ${money(s.parts, { compact: true })} of parts in stock.` : 'You have no spare parts in stock.');
}
/** Flights from your bases take fuel from stock first (what's left is bought at today's price). */
function fuelFromStock(cid: string, from: string, kg: number): number {
  const s = stockOf(cid); if (!s.fuelKg || !isBase(cid, from)) return 0;
  const use = Math.min(s.fuelKg, kg); s.fuelKg -= use; return use;
}
/** Maintenance takes parts from stock first (stock is counted at normal prices). */
function partsFromStock(cid: string, base: number): number { const s = stockOf(cid); if (!s.parts) return 0; const use = Math.min(s.parts, base); s.parts -= use; return use; }

/* ---------- Finance: the markets card ---------- */
let _mktTab: MarketId = 'fuel';
function marketsCardHtml(): string {
  marketsAdvance();
  // food and drink has its own market tab, next to spare parts
  const tabs = `<span class="seg">${(['fuel', 'parts', 'food'] as any[]).map(x => `<button class="${_mktTab === x ? 'on' : ''}" data-act="mkt-tab" data-k="${x}">${x === 'food' ? 'Food and drink' : MARKET_NAME[x as MarketId]}</button>`).join('')}</span>`;
  if ((_mktTab as any) === 'food') return `<div class="card mkt mkt-card"><div class="card-h"><b>Markets</b>${tabs}</div>${typeof foodMarketHtml === 'function' ? foodMarketHtml() : ''}</div>`;
  const k = _mktTab, m = marketsState()[k], c = company(), s = stockOf(c.id), pct = Math.round((m.idx - 1) * 100);
  const warn = m.events.filter(e => e.kind === 'warn' && e.due > Date.now())[0], last = m.events.filter(e => e.kind === 'news')[0];
  const price = k === 'fuel' ? fuelPrice(c.hub) : m.idx, cap = k === 'fuel' ? fuelCapKg(c.id) : partsCap(c.id), have = k === 'fuel' ? s.fuelKg : s.parts;
  const buys = k === 'fuel' ? [50000, 200000, 500000] : [100000, 400000, 1000000];
  const trend = m.hist.slice(-60).map(h => h.v);
  return `<div class="card mkt mkt-card">
    <div class="card-h"><b>Markets</b>${tabs}</div>
    <div class="mkt-row">
      <div class="mkt-now"><small>${k === 'fuel' ? `Today at ${esc(c.hub)}` : 'Parts prices'}</small><b>${k === 'fuel' ? '$' + price.toFixed(2) + '<small>/kg</small>' : Math.round(m.idx * 100) + '<small>% of normal</small>'}</b>
        <em class="${pct > 3 ? 'red' : pct < -3 ? 'green' : ''}">${pct > 0 ? '+' : ''}${pct}% vs normal</em></div>
      <div class="mkt-spark">${trend.length > 1 ? sparkline(trend, 220, 46) : ''}<small>Last ${trend.length} days</small></div>
      <div class="mkt-stock"><small>In stock</small><b>${k === 'fuel' ? num(Math.round(have / 1000)) + ' t' : money(have, { compact: true })}</b><span class="mkt-bar"><i style="width:${Math.min(100, have / cap * 100).toFixed(0)}%"></i></span><small>room for ${k === 'fuel' ? num(Math.round(cap / 1000)) + ' t' : money(cap, { compact: true })}</small></div>
    </div>
    ${realMarkets() ? `<p class="mkt-real">${icon('wifi')}Real-world prices: ${esc(k === 'fuel' ? realMarkets().fuel.name : realMarkets().parts.name)}, ${esc(k === 'fuel' ? realMarkets().fuel.source : realMarkets().parts.source)}. Updated ${esc(String(realMarkets().updated).slice(0, 10))}.</p>` : ''}
    ${realMarkets() && (m as any).outlook ? `<p class="mkt-warn mkt-outlook">${icon(Math.abs((m as any).outlook.ch) >= 0.05 ? 'alert' : 'info')}Outlook: ${esc((m as any).outlook.text)}</p>` : ''}
    ${warn && !realMarkets() ? `<p class="mkt-warn">${icon('alert')}${esc(warn.text)} (expected by ${esc(dateStr(new Date(warn.due)).slice(5, 10))}).</p>` : ''}
    ${last ? `<p class="mkt-why">${icon('info')}Latest: ${esc(last.text)} (${last.delta > 0 ? '+' : ''}${Math.round(last.delta * 100)}%, ${esc(dateStr(new Date(last.at)).slice(5, 10))}).</p>` : `<p class="mkt-why">${icon('info')}A calm market for now.</p>`}
    <div class="btn-row">${buys.map(q => { const cost = k === 'fuel' ? Math.round(q * price) : Math.round(q * m.idx); return `<button class="btn ghost sm" data-act="mkt-buy" data-k="${k}" data-q="${q}" ${have + q > cap ? 'disabled' : ''}>${icon('plus')}${k === 'fuel' ? num(q / 1000) + ' t' : money(q, { compact: true })}<small>${money(cost, { compact: true })}</small></button>`; }).join('')}</div>
    <p class="fine-print">${k === 'fuel' ? 'Flights leaving your bases use the stored fuel first; elsewhere, and when it runs out, fuel is bought at the day\'s price.' : 'Maintenance uses parts from stock first; when it runs out, parts are bought at the day\'s price.'} Difficulty: ${esc(diff().name)}.</p>
    <details class="mkt-hist"><summary>What moved the price</summary>${m.events.slice(0, 12).map(e => `<div><small>${esc(dateStr(new Date(e.at)).slice(0, 10))}</small> ${e.kind === 'warn' ? 'Warning: ' : ''}${esc(e.text)} <em class="${e.delta > 0 ? 'red' : 'green'}">${e.delta > 0 ? '+' : ''}${Math.round(e.delta * 100)}%</em></div>`).join('') || '<p class="muted">Nothing yet.</p>'}</details>
  </div>`;
}
ACTIONS['mkt-tab'] = el => { _mktTab = el.getAttribute('data-k') as MarketId; Sound.tick(); refresh(); };
ACTIONS['mkt-buy'] = el => {
  const k = el.getAttribute('data-k') as MarketId, q = +el.getAttribute('data-q'), c = company(), s = stockOf(c.id);
  if (typeof coopCanBuy === 'function' && !coopCanBuy()) { toast('In this co-op only the owner buys stock', 'warn'); return; }
  const cost = k === 'fuel' ? Math.round(q * fuelPrice(c.hub)) : Math.round(q * marketIdx('parts'));
  if (c.balance < cost) { toast('Not enough money', 'warn'); return; }
  confirmChange(`Buy ${k === 'fuel' ? num(q / 1000) + ' t of jet fuel' : money(q, { compact: true }) + ' of spare parts'}?`, `${money(cost)} at today's price, stored ${k === 'fuel' ? 'at your bases' : 'in your stores'} and used before buying more.`, `Buy for ${money(cost, { compact: true })}`, 'Not yet', () => {
    closeTop(); const from = c.balance;
    if (k === 'fuel') { s.fuelKg += q; s.fuelPaid += cost; } else { s.parts += q; s.partsPaid += cost; }
    payTxn(c.id, k === 'fuel' ? `Jet fuel for stock: ${num(q / 1000)} t` : 'Spare parts for stock', -cost, k === 'fuel' ? 'fuel' : 'maint', [[k === 'fuel' ? `${num(q)} kg × $${fuelPrice(c.hub).toFixed(2)}` : `Parts at ${Math.round(marketIdx('parts') * 100)}% of normal prices`, -cost]]);
    const tx0: any = State.txns[0];
    Sound.purchase(); try { animateBalance(from, c.balance); } catch (e) { /* ignore */ } Store.save(); refresh();
    undoToast('Bought and stored', () => { if (k === 'fuel') { s.fuelKg = Math.max(0, s.fuelKg - q); s.fuelPaid = Math.max(0, s.fuelPaid - cost); } else { s.parts = Math.max(0, s.parts - q); s.partsPaid = Math.max(0, s.partsPaid - cost); } c.balance += cost; State.txns = State.txns.filter(t => t !== tx0); }, 'ok');
  }, () => closeTop());
};

/* ---------- choosing the difficulty ---------- */
function difficultyPickHtml(cur: Difficulty, act: string): string {
  return `<div class="diff-pick">${(Object.keys(DIFFICULTY) as Difficulty[]).map(k => `<button class="diff-opt ${cur === k ? 'on' : ''}" data-act="${act}" data-d="${k}"><b>${esc(DIFFICULTY[k].name)}</b><small>${esc(DIFFICULTY[k].hint)}</small></button>`).join('')}</div>`;
}
function difficultySettingsHtml(): string {
  return `<div class="set-row-html"><b>Difficulty${Mode.coop() ? ' (co-op airline)' : ''}</b><small>Aircraft prices, sale prices, what flights earn and cost, loan rates and how much fuel and parts prices swing.</small>${difficultyPickHtml(difficulty(), 'diff-set')}</div>`;
}
ACTIONS['diff-set'] = el => {
  const d = el.getAttribute('data-d') as Difficulty; if (d === difficulty()) return;
  confirmChange(`Change to ${DIFFICULTY[d].name}?`, 'Prices, earnings and costs change from now on. What you already own and earned stays.', 'Change', 'Keep', () => { closeTop(); setDifficulty(d); try { rerenderSettingsBody(); } catch (e) { /* ignore */ } toast(`Difficulty: ${DIFFICULTY[d].name}`, 'ok'); }, () => closeTop());
};
let _fsDiff: Difficulty = 'normal';
ACTIONS['fs-diff'] = el => { _fsDiff = el.getAttribute('data-d') as Difficulty; document.querySelectorAll('.fs-modal .diff-opt').forEach(b => b.classList.toggle('on', b === el)); Sound.tick(); };
