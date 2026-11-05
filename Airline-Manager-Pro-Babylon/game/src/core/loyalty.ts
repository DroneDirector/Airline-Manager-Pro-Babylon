// Passengers who come back, fuel bought ahead, fares that follow demand, and lounges at your hubs.
//  - Frequent-flyer programme: launched once, members join from the passengers you fly; Silver, Gold and Platinum
//    tiers; the members choose you more often (more so with richer perks). A co-branded card pays you every month;
//    the reward seats and perks cost you every month. Members show their tier on the passenger list.
//  - Fuel hedging: a share of your fuel for the next months at today's fuel index. If fuel goes up you save; if it
//    falls you pay more than the market. A small premium up front.
//  - Flexible fares (per route): fares rise as flights fill and drop when seats stay empty, every day, special days
//    and seasons included.
//  - Lounges at your hubs, in three sizes: premium travellers choose you more where you have one, members more so.

interface FfState { on: boolean; name: string; since: number; perks: number; members: number; month: string; joinedToday: number; day: string }
interface HedgeState { pct: number; k0: number; until: number; since: number; premium: number }
interface LoungeState { lvl: number; since: number; name: string }
interface LoyaltyState { ff: FfState; hedge: HedgeState | null; lounges: { [icao: string]: LoungeState }; cid: string }

const FF_PERKS = [
  { name: 'Basic', sub: 'Points on every flight, free seat choice', pull: 1, cost: 0.35 },
  { name: 'Plus', sub: 'Also priority boarding, an extra bag and upgrades when seats are free', pull: 1.3, cost: 0.7 },
  { name: 'Premium', sub: 'Also lounge access for Gold and up, guaranteed seats on full flights', pull: 1.6, cost: 1.15 },
];
const FF_TIERS: [string, number][] = [['Platinum', 0.006], ['Gold', 0.03], ['Silver', 0.1]];
const FF_LAUNCH = 250000;
const LOUNGE_LEVELS = [
  { name: 'Lounge', cost: 1200000, month: 25000, pull: 0.12 },
  { name: 'Business lounge', cost: 3500000, month: 60000, pull: 0.24 },
  { name: 'Flagship lounge', cost: 8000000, month: 140000, pull: 0.36 },
];

function loyalty(): LoyaltyState {
  const S: any = State, cid = State.companyId;
  S.loyalty = S.loyalty || {};
  const L = S.loyalty[cid] || (S.loyalty[cid] = { ff: { on: false, name: '', since: 0, perks: 0, members: 0, month: '', joinedToday: 0, day: '' }, hedge: null, lounges: {}, cid });
  return L;
}
function loyaltyOf(cid: string): LoyaltyState | null { const S: any = State; return S.loyalty && S.loyalty[cid] || null; }

/* ---------- frequent flyers ---------- */
/** About how many passengers the airline flies a day (from its routes). */
function ffDailyPax(cid: string): number {
  let n = 0;
  for (const r of State.routes.filter(x => x.companyId === cid && !x.test)) {
    const spd = seatsPerDay(r);
    for (let i = 1; i < r.legs.length; i++) { try { n += Math.min(spd, routeOutlook(cid, r.legs[i - 1], r.legs[i], spd).lf * spd); } catch (e) { /* skip */ } }
  }
  return Math.round(n);
}
/** How much more often travellers choose you because of the programme (0.05 = 5%). */
function ffPull(cid: string): number {
  const L = loyaltyOf(cid); if (!L || !L.ff.on) return 0;
  const daily = Math.max(50, ffDailyPaxCached(cid)), m = L.ff.members;
  return Math.min(0.16, m / (m + daily * 90) * 0.25 * FF_PERKS[L.ff.perks].pull * (typeof allianceFf === 'function' ? allianceFf(cid) : 1));
}
const _ffPaxCache: { [cid: string]: { day: string; n: number } } = {};
function ffDailyPaxCached(cid: string): number {
  const day = new Date().toDateString(), c = _ffPaxCache[cid];
  if (c && c.day === day) return c.n;
  _ffPaxCache[cid] = { day, n: 0 };   // while it's worked out, no loop back here
  const n = ffDailyPax(cid); _ffPaxCache[cid] = { day, n }; return n;
}
/** A passenger's tier in your programme (from their name, the same every flight), or ''. */
function ffTier(name: string): string {
  const L = loyaltyOf(State.companyId); if (!L || !L.ff.on || !L.ff.members) return '';
  const share = Math.min(0.6, L.ff.members / Math.max(1, ffDailyPaxCached(State.companyId) * 200));   // how many of your travellers are members
  const h = (_hashStr('ff' + name) % 10000) / 10000;
  if (h >= share) return '';
  const k = h / share;   // where in the membership they are
  for (const [t, f] of FF_TIERS) if (k < f) return t;
  return 'Member';
}
function ffTierChip(name: string): string {
  const t = ffTier(name); if (!t) return '';
  return `<i class="ff-chip ff-${t.toLowerCase()}" title="${esc(loyalty().ff.name)} ${esc(t)}">${esc(t)}</i>`;
}

/* ---------- fuel hedging ---------- */
/** The price you pay for fuel compared with the market's, with the hedge (1 = the market's). */
function hedgeFactor(cid: string, idxNow: number): number {
  const L = loyaltyOf(cid), H = L && L.hedge; if (!H || H.until < Date.now() || !idxNow) return 1;
  return (1 - H.pct) + H.pct * H.k0 / idxNow;
}
/** About what the airline spends on fuel in 30 days (from the last 30 days of its accounts). */
function fuelSpend30(cid: string): number {
  const since = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  let t = 0; for (const x of State.txns as any[]) { if (x.companyId !== cid || x.date < since) continue; if (x.kind === 'fuel') t -= x.amount; else if (x.lines) for (const l of x.lines) if (/fuel/i.test(l[0]) && l[1] < 0) t -= l[1]; }
  return Math.max(t, fleetOf(cid).length * 150000);
}

/* ---------- flexible fares ---------- */
let _flexBusy = false;
/** A route's flexible fare level now: up to 30% dearer on full flights, down to 25% cheaper on empty ones. */
function flexK(r: any): number {
  if (!r || !r.flex || _flexBusy || r.legs.length < 2) return 1;
  const day = new Date().toDateString();
  if (r._flexDay === day && r._flexK) return r._flexK;
  _flexBusy = true;
  let lf = 0.7;
  try { lf = routeOutlook(r.companyId, r.legs[0], r.legs[1], seatsPerDay(r)).lf; } catch (e) { /* the middle */ }
  _flexBusy = false;
  const k = Math.round(clamp(0.8 + (lf - 0.55) * 1.15, 0.75, 1.3) * 100) / 100;
  r._flexDay = day; r._flexK = k; return k;
}

/* ---------- lounges ---------- */
/** How much more premium travellers choose you on a leg, from your lounges at either end (0.24 = 24%). */
function loungePull(cid: string, from: string, to: string): number {
  const L = loyaltyOf(cid); if (!L) return 0;
  const al = typeof allianceHubs === 'function' ? allianceHubs(cid) : [];
  const lv = (k: string) => L.lounges[k] ? LOUNGE_LEVELS[L.lounges[k].lvl].pull : al.indexOf(k) >= 0 ? LOUNGE_LEVELS[0].pull : 0;
  return Math.max(lv(from), lv(to)) + Math.min(lv(from), lv(to)) * 0.3;
}

/* ---------- once a day ---------- */
function loyaltyDaily() {
  if (Store.nogame() || !soloMode()) return;
  const L = loyalty(), cid = State.companyId, now = new Date(), day = now.toDateString(), month = now.toISOString().slice(0, 7);
  const F = L.ff;
  if (F.on && F.day !== day) {
    F.day = day;
    const daily = ffDailyPax(cid); _ffPaxCache[cid] = { day, n: daily };
    const join = Math.round(daily * 0.035 * (1 + F.perks * 0.3) * (0.85 + Math.random() * 0.3)), leave = Math.round(F.members * 0.0004);
    F.members = Math.max(0, F.members + join - leave); F.joinedToday = join;
  }
  if (F.on && F.month !== month) {
    F.month = month;
    const card = Math.round(F.members * 0.45), cost = Math.round(F.members * FF_PERKS[F.perks].cost + 15000);
    if (card) payTxn(cid, `${F.name}: co-branded card`, card, 'revenue', [[`${num(F.members)} members`, card]]);
    payTxn(cid, `${F.name}: reward seats and perks`, -cost, 'fees', [['Running the programme', -15000], [`Reward seats and ${FF_PERKS[F.perks].name.toLowerCase()} perks`, -(cost - 15000)]]);
  }
  for (const k of Object.keys(L.lounges)) {
    const G: any = L.lounges[k]; if (G.month === month) continue; G.month = month;
    const m = LOUNGE_LEVELS[G.lvl].month; payTxn(cid, `${LOUNGE_LEVELS[G.lvl].name} at ${k}: running costs`, -m, 'fees', [['Staff, food and drink, rent', -m]]);
  }
  if (L.hedge && L.hedge.until < Date.now() && !(L.hedge as any).ended) {
    (L.hedge as any).ended = true;
    State.notices.unshift({ id: uid(), kind: 'info', title: 'Your fuel hedge has ended', body: `The ${Math.round(L.hedge.pct * 100)}% of your fuel bought ahead is used up: you pay the market price again. Finance → Fuel hedging to buy more.`, time: 'Now', at: Date.now(), read: false } as any);
  }
  Store.soon();
}
setInterval(() => { try { loyaltyDaily(); } catch (e) { /* next time */ } }, 60000);
setTimeout(() => { try { loyaltyDaily(); } catch (e) { /* later */ } }, 15000);

/* ---------- the cards ---------- */
function ffCardHtml(): string {
  const L = loyalty(), F = L.ff, c = company();
  if (!F.on) return `<div class="card loy"><div class="card-h"><b>${icon('star')}Frequent-flyer programme</b><small>Members earn points on every flight, reach Silver, Gold and Platinum, and choose you over your rivals.</small></div>
    <p class="muted">Launch costs ${money(FF_LAUNCH)}. Members join from the passengers you fly; a co-branded card pays you every month; reward seats and perks cost you every month.</p>
    <div class="loy-row"><input class="le-in ff-name" placeholder="${esc(c.name.split(' ')[0])} Miles" maxlength="28" value="${esc(c.name.split(' ')[0])} Miles"><button class="btn primary sm" data-act="ff-launch">${icon('star')}Launch</button></div></div>`;
  const pull = ffPull(c.id), tiers = FF_TIERS.map(([t, f]) => [t, Math.round(F.members * f)] as [string, number]);
  const card = Math.round(F.members * 0.45), cost = Math.round(F.members * FF_PERKS[F.perks].cost + 15000);
  return `<div class="card loy"><div class="card-h"><b>${icon('star')}${esc(F.name)}</b><small>Since ${esc(dateStr(new Date(F.since)).slice(0, 10))} · ${F.joinedToday ? `${num(F.joinedToday)} joined today` : 'members join every day'}</small></div>
    <div class="kv-row"><div><small>Members</small><b>${num(F.members)}</b></div>${tiers.map(([t, n]) => `<div><small>${t}</small><b class="ff-t-${t.toLowerCase()}">${num(n)}</b></div>`).join('')}<div><small>Choose you more often</small><b class="green">+${(pull * 100).toFixed(1)}%</b></div></div>
    <div class="kv-row"><div><small>Card income a month</small><b class="green">${money(card)}</b></div><div><small>Rewards and perks a month</small><b class="red">${money(-cost)}</b></div></div>
    <div class="ch-row"><span><b>Perks</b><small>${esc(FF_PERKS[F.perks].sub)}. Richer perks win more travellers and cost more per member.</small></span><div class="seg">${FF_PERKS.map((p, i) => `<button class="${F.perks === i ? 'on' : ''}" data-act="ff-perks" data-v="${i}">${p.name}</button>`).join('')}</div></div></div>`;
}
ACTIONS['ff-launch'] = el => {
  const L = loyalty(), c = company(), inp = document.querySelector('.ff-name') as HTMLInputElement, name = ((inp && inp.value) || '').trim() || c.name.split(' ')[0] + ' Miles';
  if (c.balance < FF_LAUNCH) { toast(`Launching needs ${money(FF_LAUNCH)}`, 'warn'); return; }
  payTxn(c.id, `${name}: launch`, -FF_LAUNCH, 'fees', [['Systems, cards and advertising', -FF_LAUNCH]]);
  Object.assign(L.ff, { on: true, name, since: Date.now(), members: Math.round(ffDailyPax(c.id) * 2), month: new Date().toISOString().slice(0, 7), day: new Date().toDateString(), joinedToday: 0 });
  try { Progress.popularity(0.5, `${name} launched`); } catch (e) { /* none */ }
  try { newsPost(c, c.hub, { section: 'Business', headline: `${c.name} launches ${name}`, standfirst: `${c.name} has launched its own frequent-flyer programme, ${name}, with Silver, Gold and Platinum tiers.`, body: [`Members earn points on every ${c.name} flight and can spend them on reward seats.`, `Frequent travellers climb from Silver to Gold and Platinum, with priority boarding, extra bags and upgrades along the way.`], quote: ['We want our passengers to come back, and to feel it when they do.', `${c.name}`] }); } catch (e) { /* no news */ }
  Store.soon(); Sound.tick(); toast(`${name} is launched`, 'ok'); refresh();
};
ACTIONS['ff-perks'] = el => { const L = loyalty(); L.ff.perks = clamp(+el.getAttribute('data-v') || 0, 0, 2); Store.soon(); Sound.tick(); refresh(); };

function hedgeCardHtml(): string {
  const L = loyalty(), H = L.hedge, idx = typeof marketIdx === 'function' ? marketIdx('fuel') : 1, cid = State.companyId;
  const spend = fuelSpend30(cid);
  if (H && H.until > Date.now()) {
    const k = hedgeFactor(cid, idx), save = Math.round(spend * (1 - k));
    return `<div class="card loy"><div class="card-h"><b>${icon('finance')}Fuel hedging</b><small>${Math.round(H.pct * 100)}% of your fuel at the fuel index of ${H.k0.toFixed(2)} until ${esc(dateStr(new Date(H.until)).slice(0, 10))}</small></div>
      <div class="kv-row"><div><small>Fuel index then</small><b>${H.k0.toFixed(2)}</b></div><div><small>Fuel index now</small><b>${idx.toFixed(2)}</b></div><div><small>You pay</small><b class="${k <= 1 ? 'green' : 'red'}">${Math.round(k * 100)}% of the market</b></div><div><small>About a month</small><b class="${save >= 0 ? 'green' : 'red'}">${money(save, { sign: true })}</b></div></div>
      <p class="fine-print">${icon('info')}${k <= 1 ? 'Fuel is dearer than when you bought: the hedge is saving you money.' : 'Fuel is cheaper than when you bought: you pay more than the market on the hedged share.'}</p></div>`;
  }
  const opt = (pct: number, mo: number) => { const prem = Math.round(spend * pct * mo * 0.02); return `<button class="btn sm ghost" data-act="hedge-buy" data-p="${pct}" data-m="${mo}">${Math.round(pct * 100)}% for ${mo} month${mo > 1 ? 's' : ''}<small>${money(prem)} up front</small></button>`; };
  return `<div class="card loy"><div class="card-h"><b>${icon('finance')}Fuel hedging</b><small>Buy a share of your fuel ahead at today's fuel index (${idx.toFixed(2)}). If fuel rises you save; if it falls you pay more than the market on that share.</small></div>
    <p class="muted">You spend about ${money(spend)} on fuel a month.</p>
    <div class="loy-opts">${[0.25, 0.5, 0.75].map(p => [1, 3, 6].map(m => opt(p, m)).join('')).join('')}</div></div>`;
}
ACTIONS['hedge-buy'] = el => {
  const L = loyalty(), c = company(), pct = +el.getAttribute('data-p'), mo = +el.getAttribute('data-m'), spend = fuelSpend30(c.id), prem = Math.round(spend * pct * mo * 0.02);
  if (c.balance < prem) { toast(`That needs ${money(prem)}`, 'warn'); return; }
  payTxn(c.id, `Fuel hedge: ${Math.round(pct * 100)}% for ${mo} months`, -prem, 'fuel', [['Premium to the fuel supplier', -prem]]);
  L.hedge = { pct, k0: typeof marketIdx === 'function' ? marketIdx('fuel') : 1, until: Date.now() + mo * 30 * 864e5, since: Date.now(), premium: prem };
  Store.soon(); Sound.tick(); toast(`${Math.round(pct * 100)}% of your fuel is bought ahead for ${mo} month${mo > 1 ? 's' : ''}`, 'ok'); refresh();
};

function loungesCardHtml(): string {
  const L = loyalty(), c: any = company(), hubs = [c.hub].concat(((State as any).bases || []).filter((b: any) => b.companyId === c.id).map((b: any) => b.icao)).filter((x: string, i: number, a: string[]) => x && a.indexOf(x) === i);
  const row = (k: string) => {
    const G = L.lounges[k], nxt = G ? G.lvl + 1 : 0, N = LOUNGE_LEVELS[nxt];
    return `<div class="lg-row"><span class="lg-ic">${icon('star')}</span><span><b>${esc(k)}${apt(k) ? ' · ' + esc(apt(k).city || apt(k).name) : ''}</b><small>${G ? `${esc(G.name)}: premium travellers choose you ${Math.round(LOUNGE_LEVELS[G.lvl].pull * 100)}% more often · ${money(LOUNGE_LEVELS[G.lvl].month)} a month` : 'No lounge yet'}</small></span>
      ${N ? `<button class="btn sm ${G ? 'ghost' : 'primary'}" data-act="lounge-build" data-k="${esc(k)}">${G ? 'Upgrade to ' : 'Build a '}${N.name.toLowerCase()}<small>${money(N.cost)} · ${money(N.month)} a month</small></button>` : '<span class="pill">The finest</span>'}
</div>`;
  };
  return `<div class="card loy"><div class="card-h"><b>${icon('star')}Lounges</b><small>At your hubs and bases: business and first class travellers choose you more often on flights from and to them${L.ff.on ? `, and ${esc(L.ff.name)} Gold and Platinum members value them most` : ''}.</small></div>${hubs.map(row).join('')}</div>`;
}
ACTIONS['lounge-build'] = el => {
  const L = loyalty(), c = company(), k = el.getAttribute('data-k'), G = L.lounges[k], nxt = G ? G.lvl + 1 : 0, N = LOUNGE_LEVELS[nxt]; if (!N) return;
  if (c.balance < N.cost) { toast(`That needs ${money(N.cost)}`, 'warn'); return; }
  payTxn(c.id, `${N.name} at ${k}`, -N.cost, 'fees', [['Building and fitting out', -N.cost]]);
  L.lounges[k] = { lvl: nxt, since: Date.now(), name: N.name } as any; (L.lounges[k] as any).month = new Date().toISOString().slice(0, 7);
  try { Progress.popularity(0.3 + nxt * 0.2, `A new ${N.name.toLowerCase()} at ${k}`); } catch (e) { /* none */ }
  Store.soon(); Sound.tick(); toast(`Your ${N.name.toLowerCase()} at ${k} is open`, 'ok'); refresh();
};
