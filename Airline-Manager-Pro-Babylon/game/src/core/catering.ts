/* Catering and storage.
 * The airline buys hot meals, other food (sandwiches, salads), sweets and snacks, soft drinks (water, juice,
 * coffee, tea) and alcohol into its own storage, alongside its jet fuel and spare parts. Before each flight
 * the ground crew load what it needs from the storage: by hand (you choose, for a flight still boarding),
 * or automatically when you don't. Automatic loading very rarely gets it wrong (as rarely as conduct
 * reports, Settings → Staff), and then something runs out on board and passengers notice. What a flight
 * needs the storage doesn't have is bought from the airport's caterer at the day's price plus their margin.
 * Hot meals keep a few days; the rest keeps well.
 * Prices follow the real US price indices (Bureau of Labor Statistics, public domain: food away from home,
 * food at home, candy, non-alcoholic and alcoholic drinks) when real-world prices are on (Settings →
 * Realism → Economy); otherwise they drift gently on their own. */

type CatItem = 'hot' | 'food' | 'candy' | 'soft' | 'liquor';
const CAT_ITEMS: { id: CatItem; name: string; unit: string; usd: number; keepDays: number; icon: string }[] = [
  { id: 'hot', name: 'Hot meals', unit: 'meals', usd: 6.4, keepDays: 5, icon: 'pax' },
  { id: 'food', name: 'Other food', unit: 'portions', usd: 3.1, keepDays: 30, icon: 'pax' },
  { id: 'candy', name: 'Sweets and snacks', unit: 'packs', usd: 1.05, keepDays: 240, icon: 'star' },
  { id: 'soft', name: 'Soft drinks, coffee and tea', unit: 'servings', usd: 0.55, keepDays: 365, icon: 'fuel' },
  { id: 'liquor', name: 'Alcohol', unit: 'servings', usd: 2.3, keepDays: 720, icon: 'star' },
];
interface CatStore { hot: number; food: number; candy: number; soft: number; liquor: number; at: number; used: { d: string; hot: number; food: number; candy: number; soft: number; liquor: number }[] }

function cateringOn(): boolean { return (State.settings as any).cateringStore !== false; }
function catStore(cid: string): CatStore {
  const S: any = State; S.catStore = S.catStore || {};
  const c = S.catStore[cid] || (S.catStore[cid] = { hot: 0, food: 0, candy: 0, soft: 0, liquor: 0, at: Date.now(), used: [] });
  // hot meals go off: a share of the stock is thrown away every day it sits
  const days = (Date.now() - (c.at || Date.now())) / 864e5;
  if (days > 0.04) { c.hot = Math.max(0, Math.floor(c.hot * Math.pow(1 - 1 / CAT_ITEMS[0].keepDays, days))); c.at = Date.now(); }
  return c;
}
function catCap(cid: string): number { return 3000 + 2500 * fleetOf(cid).length; }   // servings of each, per item

/** Today's price of one serving (USD): real price index when on, else a gentle drift. */
function catPrice(id: CatItem): number {
  const it = CAT_ITEMS.filter(x => x.id === id)[0]; return it.usd * catIdx(id) * diff().cost;
}
function catIdx(id: CatItem): number {
  const r: any = typeof realMarkets === 'function' ? realMarkets() : null, s: [string, number][] = r && r.catering && r.catering[id] && r.catering[id].series;
  if (s && s.length > 12) { const base = s.slice(-36).reduce((a, x) => a + x[1], 0) / Math.min(36, s.length); return clamp(s[s.length - 1][1] / base, 0.6, 1.8); }
  const d = Math.floor(Date.now() / 864e5), k = CAT_ITEMS.findIndex(x => x.id === id) + 1;
  return 1 + 0.04 * Math.sin(d / 37 + k) + 0.02 * Math.sin(d / 11 + k * 3);
}
/** How prices moved: the last month and the last year (real figures when on), for the storage card. */
function catTrend(id: CatItem): { m: number; y: number; real: boolean; series: number[] } {
  const r: any = typeof realMarkets === 'function' ? realMarkets() : null, s: [string, number][] = r && r.catering && r.catering[id] && r.catering[id].series;
  if (s && s.length > 13) { const L = s[s.length - 1][1]; return { m: L / s[s.length - 2][1] - 1, y: L / s[s.length - 13][1] - 1, real: true, series: s.slice(-24).map(x => x[1]) }; }
  const now = Date.now(), at = (dd: number) => { const d = Math.floor((now - dd * 864e5) / 864e5), k = CAT_ITEMS.findIndex(x => x.id === id) + 1; return 1 + 0.04 * Math.sin(d / 37 + k) + 0.02 * Math.sin(d / 11 + k * 3); };
  return { m: at(0) / at(30) - 1, y: at(0) / at(365) - 1, real: false, series: Array.from({ length: 24 }, (_, i) => at((23 - i) * 15)) };
}

/** What a flight needs: by its passengers, their classes and how long it is. */
function catNeed(pY: number, pJF: number, blockMin: number): { [k in CatItem]: number } {
  const h = blockMin / 60, long = h > 3.5, mid = h > 1.6;
  return {
    hot: Math.round((long ? pY * 1.05 * Math.max(1, Math.floor(h / 6) + 1) : 0) + (mid ? pJF * 1.1 : 0)),
    food: Math.round(!long && mid ? pY * 0.7 : long ? pY * 0.4 : pY * 0.25),
    candy: Math.round((pY + pJF) * (0.35 + (h > 1 ? 0.2 : 0))),
    soft: Math.round((pY + pJF) * (1.2 + h * 0.6)),
    liquor: Math.round(pY * (long ? 0.35 : 0.12) + pJF * (1 + h * 0.3)),
  };
}

/** Loading a flight before it leaves: by hand (`manual`, amounts chosen) or automatically. Takes what it can
 *  from the storage; returns what that was worth (USD at normal prices) and whether anything ran short. */
function catLoad(f: any, cid: string, need: { [k in CatItem]: number }, manual?: { [k in CatItem]?: number }): { stockUsd: number; shortItem: CatItem | null } {
  const st = catStore(cid); let stockUsd = 0;
  const load: any = {};
  for (const it of CAT_ITEMS) {
    const want = manual && manual[it.id] != null ? manual[it.id] : need[it.id];
    const take = Math.min(st[it.id], want); st[it.id] -= take; stockUsd += take * it.usd; load[it.id] = want;
  }
  // a mistake in automatic loading: very rare (follows the conduct reports' setting); by hand, only if you loaded too little
  let shortItem: CatItem | null = null;
  if (!manual) {
    const k = typeof conductLevel === 'function' ? [0, 0.3, 0.5, 0.67, 1.2][conductLevel()] : 0.67;
    if (Math.random() < 0.006 * k) { const cands = CAT_ITEMS.filter(it => need[it.id] > 4); if (cands.length) shortItem = cands[Math.floor(Math.random() * cands.length)].id; }
  } else for (const it of CAT_ITEMS) if (need[it.id] > 4 && (manual[it.id] || 0) < need[it.id] * 0.85) { shortItem = it.id; break; }
  // the day's use, for the storage's "days left"
  const d = dateStr(new Date()).slice(0, 10); let u = st.used[0];
  if (!u || u.d !== d) { u = { d, hot: 0, food: 0, candy: 0, soft: 0, liquor: 0 }; st.used.unshift(u); if (st.used.length > 14) st.used.length = 14; }
  for (const it of CAT_ITEMS) (u as any)[it.id] += load[it.id];
  if (f) { f.catLoaded = load; if (shortItem) f.catShort = shortItem; }
  return { stockUsd, shortItem };
}
const CAT_SHORT_TEXT: { [k in CatItem]: string } = { hot: 'The hot meals ran out before everyone was served', food: 'The sandwiches ran out halfway down the cabin', candy: 'No snacks left for the back of the cabin', soft: 'The drinks trolley ran dry', liquor: 'No wine or beer left on the trolley' };

/** Per day of use over the last week, for advice on ordering. */
function catDaily(cid: string, id: CatItem): number {
  const u = catStore(cid).used.slice(0, 7); if (!u.length) return 0;
  return u.reduce((a, x) => a + ((x as any)[id] || 0), 0) / Math.max(1, Math.min(7, u.length));
}

/* ---------- buying ---------- */
ACTIONS['cat-buy'] = el => {
  const id = el.getAttribute('data-k') as CatItem, q = +el.getAttribute('data-q'), c = company(), st = catStore(c.id);
  if (typeof coopCanBuy === 'function' && !coopCanBuy()) { toast('In this co-op only the owner buys stock', 'warn'); return; }
  const it = CAT_ITEMS.filter(x => x.id === id)[0]; if (!it) return;
  const room = Math.max(0, catCap(c.id) - st[id]), n = Math.min(q, room); if (!n) { toast('The storage is full for ' + it.name.toLowerCase(), 'info'); return; }
  const cost = Math.round(n * catPrice(id));
  if (c.balance < cost) { toast('Not enough money', 'warn'); return; }
  st[id] += n; payTxn(c.id, `Catering for storage: ${num(n)} ${it.unit} of ${it.name.toLowerCase()}`, -cost, 'catering' as any, [[`${num(n)} × ${money(catPrice(id))}`, -cost]]);
  try { Sound.purchase(); } catch (e) { /* quiet */ }
  Store.soon(); refresh();
};

/* ---------- the storage card ---------- */
/** Food and drink in storage, one row each, with what to order and how prices move (the Food and drink market). */
function catRowsParts(): { rows: string; real: boolean } {
  const c = company(), st = catStore(c.id), real = !!(typeof realMarkets === 'function' && realMarkets());
  const spark = (v: number[]) => { if (v.length < 2) return ''; const lo = Math.min(...v), hi = Math.max(...v), r = hi - lo || 1; return `<svg class="st-spark" viewBox="0 0 60 18" preserveAspectRatio="none"><polyline points="${v.map((x, i) => `${(i / (v.length - 1) * 60).toFixed(1)},${(16 - (x - lo) / r * 14).toFixed(1)}`).join(' ')}"/></svg>`; };
  const pct = (x: number) => `<b class="${x > 0.005 ? 'up' : x < -0.005 ? 'down' : ''}">${x > 0 ? '+' : ''}${(x * 100).toFixed(1)}%</b>`;
  const advice = (have: number, perDay: number, cap: number) => {
    if (!perDay) return have ? '<span class="st-ok">No recent use</span>' : '<span class="st-mute">Nothing in store</span>';
    const days = have / perDay;
    return days < 2 ? `<span class="st-bad">Order now: under 2 days left</span>` : days < 5 ? `<span class="st-warn">Order soon: about ${Math.round(days)} days left</span>` : have > cap * 0.95 ? `<span class="st-ok">Full: ${Math.round(days)} days</span>` : `<span class="st-ok">Enough for about ${Math.round(days)} days</span>`;
  };
  const rows = CAT_ITEMS.map(it => {
    const have = st[it.id], per = catDaily(c.id, it.id), tr = catTrend(it.id), cap = catCap(c.id), need = Math.max(0, Math.round(per * 7 - have));
    return `<div class="st-row">
      <div class="st-name"><b>${esc(it.name)}</b><small>${num(have)} ${it.unit} · ${money(catPrice(it.id))} each${it.id === 'hot' ? ' · keeps about 5 days' : ''}</small></div>
      <div class="st-bar"><i style="width:${Math.min(100, have / cap * 100).toFixed(1)}%"></i></div>
      <div class="st-adv">${advice(have, per, cap)}<small>${per ? `uses about ${num(Math.round(per))} a day` : ''}</small></div>
      <div class="st-mkt">${spark(tr.series)}<small>month ${pct(tr.m)} · year ${pct(tr.y)}</small></div>
      <div class="st-buy">${[need > 0 ? need : 0, 500, 2000].filter((q, i) => q > 0 || i > 0).slice(0, 3).map((q, i) => `<button class="btn ghost sm" data-act="cat-buy" data-k="${it.id}" data-q="${Math.max(50, Math.round(q / 50) * 50)}">${i === 0 && need > 0 ? 'A week\'s worth' : '+' + num(q)}</button>`).join('')}</div>
    </div>`;
  }).join('');
  return { rows, real };
}
/** Everything in storage: food and drink, jet fuel and spare parts, with what to order and how prices move. */
function storageCardHtml(): string {
  const c = company(), s = stockOf(c.id), { rows, real } = catRowsParts();
  const pct = (x: number) => `<b class="${x > 0.005 ? 'up' : x < -0.005 ? 'down' : ''}">${x > 0 ? '+' : ''}${(x * 100).toFixed(1)}%</b>`;
  const fuelDays = '', fuelM = marketIdx('fuel'), partsM = marketIdx('parts');
  const fuelRow = `<div class="st-row"><div class="st-name"><b>Jet fuel</b><small>${num(Math.round(s.fuelKg / 1000))} t at your bases · price ${pct(fuelM - 1)} against normal</small></div><div class="st-bar"><i style="width:${Math.min(100, s.fuelKg / fuelCapKg(c.id) * 100).toFixed(1)}%"></i></div><div class="st-adv">${s.fuelKg < fuelCapKg(c.id) * 0.1 ? '<span class="st-warn">Low: flights buy at the day\'s price</span>' : '<span class="st-ok">In stock</span>'}${fuelDays}</div><div class="st-mkt"><small>${real ? 'real US jet fuel price' : 'simulated market'}</small></div><div class="st-buy"><button class="btn ghost sm" data-act="go-finance-markets" data-k="fuel">Buy fuel</button></div></div>`;
  const partsRow = `<div class="st-row"><div class="st-name"><b>Spare parts</b><small>${money(s.parts, { compact: true })} in stock · price ${pct(partsM - 1)} against normal</small></div><div class="st-bar"><i style="width:${Math.min(100, s.parts / partsCap(c.id) * 100).toFixed(1)}%"></i></div><div class="st-adv">${s.parts < partsCap(c.id) * 0.1 ? '<span class="st-warn">Low: repairs buy at the day\'s price</span>' : '<span class="st-ok">In stock</span>'}</div><div class="st-mkt"><small>${real ? 'real US parts price index' : 'simulated market'}</small></div><div class="st-buy"><button class="btn ghost sm" data-act="go-finance-markets" data-k="parts">Buy parts</button></div></div>`;
  return `<div class="card storage-card"><div class="card-h"><b>${icon('layers')}Storage</b><small>${cateringOn() ? 'Food, drink, fuel and parts in your stores' : 'Catering storage is off (Settings → Passenger services): flights buy at each airport'}</small></div>
    ${cateringOn() ? rows : ''}${fuelRow}${partsRow}${typeof spiritsRowsHtml === 'function' ? spiritsRowsHtml() : ''}
    <p class="fine-print">${icon('info')}${real ? 'Prices follow the real US price indices for food, drinks and alcohol (Bureau of Labor Statistics), jet fuel (Energy Information Administration) and aircraft parts.' : 'Prices move on a simulated market (real-world prices are off or not available).'} The ground crew load each flight from these stores; what a flight needs that isn't in store is bought from the airport's caterer at the day's price plus their margin.</p></div>`;
}
/** The Food and drink market: drinks and soft drinks, sweets and snacks, food and hot meals. */
function foodMarketHtml(): string {
  const { rows, real } = catRowsParts();
  if (!cateringOn()) return `<p class="fine-print">${icon('info')}Catering storage is off (Settings → Passenger services): flights buy their food and drink at each airport.</p>`;
  return `<div class="storage-card st-food">${rows}</div><p class="fine-print">${icon('info')}${real ? 'Prices follow the real US price indices for food, drinks and alcohol (Bureau of Labor Statistics).' : 'Prices move on a simulated market.'} Flights take what they need from your stores first.</p>`;
}
ACTIONS['go-finance-markets'] = el => {
  // to that market's tab in Finance, and to its buy buttons
  _mktTab = (el.getAttribute('data-k') || 'fuel') as any; Sound.tick();
  if (State.screen !== 'finance') { closeAll(); go('finance'); } else refresh();
  setTimeout(() => { const m = document.querySelector('.mkt-card'); if (m) m.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 120);
};

/* ---------- loading a flight by hand ---------- */
/** For a flight still boarding: what it needs, what's in store, and the ground crew loading it as you set it. */
function cateringPopup(fid: string) {
  const f: any = State.live.filter(x => x.id === fid)[0]; if (!f) return;
  const t: any = acType(flightTypeId(f)) || {}, pax = f.pax || 0, pJF = (f.paxJ || 0) + (f.paxF || 0), blk = Math.round((f.durMs || 3600e3) / 60000);
  const need = catNeed(pax - pJF, pJF, blk), st = catStore(company().id);
  const loaded = f.catLoaded;
  openLayer('modal', `<div class="modal-head"><div><small>${esc(f.callsign)} · ${esc(f.from)} to ${esc(f.to)} · ${pax} passengers</small><h2>${icon('pax')}Catering</h2></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
    <div class="modal-body">${loaded ? `<p class="lede">${icon('check')}Loaded${f.catManual ? ' as you set it' : ' automatically'}.</p>` : `<p class="lede">The ground crew load what you set here before the doors close. If you don't, they load it themselves.</p>`}
    <div class="cat-load">${CAT_ITEMS.map(it => `<label class="cat-li"><span><b>${esc(it.name)}</b><small>needs about ${num(need[it.id])} · ${num(st[it.id])} in store</small></span><input type="number" min="0" step="5" class="cat-q le-in" data-k="${it.id}" value="${loaded ? loaded[it.id] : need[it.id]}" ${loaded ? 'disabled' : ''}></label>`).join('')}</div>
    ${loaded ? '' : `<div class="modal-actions"><button class="btn ghost" data-act="close-layer">Let the crew decide</button><button class="btn primary" data-act="cat-load-do" data-id="${esc(fid)}">${icon('check')}Load</button></div>`}</div>`, { cls: 'narrow' });
}
ACTIONS['cat-load-do'] = el => {
  const f: any = State.live.filter(x => x.id === el.getAttribute('data-id'))[0]; if (!f) return;
  const q: any = {}; document.querySelectorAll('.cat-q').forEach((i: any) => { q[i.getAttribute('data-k')] = Math.max(0, Math.round(+i.value || 0)); });
  const pJF = (f.paxJ || 0) + (f.paxF || 0), need = catNeed((f.pax || 0) - pJF, pJF, Math.round((f.durMs || 3600e3) / 60000));
  const r = catLoad(f, f.reg && plane(f.reg) ? plane(f.reg).companyId : State.companyId, need, q); f.catManual = true; f.catStockUsd = r.stockUsd;
  closeTop(); toast(`${f.callsign}: catering loaded`, 'ok'); Store.soon();
};
ACTIONS['cat-open'] = el => cateringPopup(el.getAttribute('data-id'));
