// Passengers in your lounge can drink at the bar while they wait for their flight. One who has had too much is
// reported to you before boarding: you decide whether they may fly. If you don't answer before boarding (you're away,
// asleep), the cabin crew deny them boarding, as airlines do with passengers who are visibly drunk, and you are told
// why. Seen in the lounge, a guest's drinks are their own (each sip counts); while you are not there, now and then a
// business or first class passenger in one of your lounges with a bar arrives at the gate drunk.
// Blood alcohol as for you (lounge-bar.ts): the Widmark formula, worn off at 0.15 per mille an hour (the real rate).

interface DrunkPax { key: string; name: string; cls: string; callsign: string; reg: string; from: string; to: string; dep: number; bac: number; at: number; decided?: 'allow' | 'deny' | ''; crew?: boolean; told?: boolean }
const DRUNK_NOTIFY = 1.0;   // per mille: drunk enough to be a concern at the gate (visibly drunk)

function drunkList(): DrunkPax[] { const S: any = State; return S.drunkPax || (S.drunkPax = []); }
function drunkKey(name: string, callsign: string, dep: number): string { return name + '|' + callsign + '|' + Math.round(dep / 60000); }
/** A guest's blood alcohol now (what they drank in the lounge, worn off since). */
function guestBac(key: string): number {
  const S: any = State, M = S.loungeBac || (S.loungeBac = {}), r = M[key]; if (!r) return 0;
  return Math.max(0, r.bac - (Date.now() - r.at) / 3600e3 * 0.15);
}
/** A sip in the lounge: alcohol into the guest; drunk enough, and you are told before boarding. */
function guestDrink(P: any, grams: number) {
  const S: any = State, M = S.loungeBac || (S.loungeBac = {}), key = drunkKey(P.name, P.callsign, P.dep);
  const f = P.look && P.look.sex === 'f', bac = guestBac(key) + grams / ((f ? 0.55 : 0.68) * (f ? 65 : 80));
  M[key] = { bac, at: Date.now() };
  if (bac >= DRUNK_NOTIFY) drunkReport({ key, name: P.name, cls: P.cls, callsign: P.callsign, reg: P.reg || '', from: P.from || '', to: P.to, dep: P.dep, bac, at: Date.now(), decided: '' });
  return bac;
}
/** Report a drunk passenger (once), and ask you. */
function drunkReport(d: DrunkPax) {
  const L = drunkList(), old = L.filter(x => x.key === d.key)[0];
  if (old) { old.bac = Math.max(old.bac, d.bac); return; }
  L.push(d); if (L.length > 60) L.splice(0, L.length - 60);
  const A: any = apt(d.to);
  State.notices.unshift({ id: uid(), kind: 'flight', title: `${d.name} has had too much to drink`, body: `${d.cls} class passenger on ${d.callsign} to ${A ? A.city || d.to : d.to} (${dateStr(new Date(d.dep)).slice(11, 16)}): about ${d.bac.toFixed(1)} per mille in the lounge. Decide before boarding whether they may fly; if you don't, the cabin crew will deny boarding.`, time: 'Now', read: false } as any);
  try { Store.soon(); renderTopbar(); } catch (e) { /* later */ }
  drunkAsk();
}
/** The question on screen (one at a time), when you are here to answer it. */
function drunkAsk() {
  if (document.hidden || document.querySelector('.drunk-ask')) return;
  const d = drunkList().filter(x => !x.decided && x.dep > Date.now())[0]; if (!d) return;
  const A: any = apt(d.to), very = d.bac >= 1.5;
  try {
    openLayer('modal', `<div class="drunk-ask"><h2>${icon('alert')}A passenger is ${very ? 'very ' : ''}drunk</h2>
      <p><b>${esc(d.name)}</b>, ${esc(d.cls.toLowerCase())} class on <b>${esc(d.callsign)}</b> to ${esc(A ? A.city || d.to : d.to)}, departing ${esc(dateStr(new Date(d.dep)).slice(11, 16))}, has been drinking in your lounge: about <b>${d.bac.toFixed(1)} per mille</b>${very ? ', unsteady on their feet and slurring' : ', loud and unsteady'}.</p>
      <p class="fine-print">${icon('info')}Airlines may refuse anyone who is drunk: a drunk passenger can be a danger to themselves and others, and can't follow the crew in an emergency. If you don't decide before boarding, the cabin crew will deny boarding.</p>
      ${typeof secStaff === 'function' && secStaff(d.from).length ? `<p class="fine-print">${icon('user')}Security at ${esc(d.from)} spotted them at the gate. You can send an officer to collect them from the lounge.</p>` : ''}
      <div class="btn-row"><button class="btn" data-act="drunk-allow" data-k="${esc(d.key)}">Let them board</button>${typeof secStaff === 'function' && secStaff(d.from).length ? `<button class="btn" data-act="drunk-escort" data-k="${esc(d.key)}">Send Security</button>` : ''}<button class="btn primary" data-act="drunk-deny" data-k="${esc(d.key)}">Deny boarding</button></div></div>`, { cls: 'drunk-pop' });
  } catch (e) { /* asked later */ }
}
function drunkDecide(key: string, how: 'allow' | 'deny', crew?: boolean) {
  const d = drunkList().filter(x => x.key === key)[0]; if (!d || d.decided) return;
  d.decided = how; d.crew = !!crew;
  const A: any = apt(d.to), dest = A ? A.city || d.to : d.to;
  if (how === 'deny') {
    // one passenger fewer on that departure (their seat flies empty; no refund for a passenger refused for being drunk)
    try { const n = ((State as any).aiNext || []).filter((x: any) => x.callsign === d.callsign && Math.abs(x.depAt - d.dep) < 120000)[0]; if (n) { const ld = aiPlannedLoad(n); if (ld.pax > 0) { ld.pax--; if (d.cls === 'First' && ld.paxF > 0) ld.paxF--; else if (ld.paxJ > 0) ld.paxJ--; } } } catch (e) { /* as planned */ }
    State.notices.unshift({ id: uid(), kind: 'flight', title: `${d.name} was denied boarding`, body: crew
      ? `The cabin crew of ${d.callsign} to ${dest} refused ${d.name} at the gate: too drunk to fly safely (about ${d.bac.toFixed(1)} per mille). You weren't available to decide, so they followed the rule: a drunk passenger doesn't board.`
      : `You refused ${d.name} on ${d.callsign} to ${dest}: too drunk to fly (about ${d.bac.toFixed(1)} per mille). The seat flies empty.`, time: 'Now', read: false } as any);
  } else {
    // letting a drunk passenger fly: the other passengers notice, and so does word of mouth
    try { Progress.popularity(-(d.bac >= 1.5 ? 1.5 : 0.8), `${d.name} flew drunk on ${d.callsign}`); } catch (e) { const co: any = company(); if (co) co.reputation = clamp(Math.round(((co.reputation || 50) - (d.bac >= 1.5 ? 1.5 : 0.8)) * 10) / 10, 0, 100); }
    State.notices.unshift({ id: uid(), kind: 'flight', title: `${d.name} may board`, body: `${d.name} boards ${d.callsign} to ${dest}. The cabin crew will keep an eye on them and serve no more alcohol on board; the other passengers notice (your popularity drops a little).`, time: 'Now', read: false } as any);
  }
  try { Store.soon(); renderTopbar(); } catch (e) { /* later */ }
}
ACTIONS['drunk-allow'] = el => { drunkDecide(el.getAttribute('data-k') || '', 'allow'); Sound.tick(); closeTop(); setTimeout(drunkAsk, 400); };
ACTIONS['drunk-deny'] = el => { drunkDecide(el.getAttribute('data-k') || '', 'deny'); Sound.tick(); closeTop(); setTimeout(drunkAsk, 400); };
/** Every half minute: boarding time without a decision means the crew deny boarding; and, while you are not in the
 *  lounge, now and then one of its business or first class passengers turns up drunk. */
function drunkAdvance() {
  const now = Date.now();
  for (const d of drunkList()) if (!d.decided && d.dep - now < 10 * 60e3) drunkDecide(d.key, 'deny', true);
  if ((State as any).finHold) return;
  try {
    let L: any = null; try { L = loyalty(); } catch (e) { L = null; }
    const lounges = L && L.lounges ? L.lounges : {}, S: any = State;
    for (const n of (S.aiNext || []) as any[]) {
      if (!n || n.drunkRolled || !lounges[n.from] || (lounges[n.from].lvl || 0) < 1 || typeof LoungeRoom !== 'undefined' && LoungeRoom.on && LoungeRoom.k === n.from) continue;
      if (n.depAt - now > 60 * 60e3 || n.depAt < now) continue;
      n.drunkRolled = true;
      let ld: any = null; try { ld = aiPlannedLoad(n); } catch (e) { ld = null; } const prem = ld ? (ld.paxJ || 0) + (ld.paxF || 0) : 0; if (!prem) continue;
      if (Math.random() > 0.05) continue;   // seldom: about one departure in twenty has a passenger that drunk
      const pseudo: any = { id: n.paxSeed || 'lp-' + n.callsign, paxSeed: n.paxSeed || 'lp-' + n.callsign, reg: n.reg, typeId: plane(n.reg) ? plane(n.reg).typeId : '', from: n.from, to: n.to, pax: ld.pax, paxJ: ld.paxJ, paxF: ld.paxF };
      let list: any[] = []; try { list = manifestOf(pseudo).filter((p: any) => p.cls !== 'Y'); } catch (e) { list = []; }
      const p = list[Math.floor(Math.random() * list.length)]; if (!p) continue;
      drunkReport({ key: drunkKey(p.name, n.callsign || n.reg, n.depAt), name: p.name, cls: p.cls === 'F' ? 'First' : 'Business', callsign: n.callsign || n.reg, reg: n.reg, from: n.from, to: n.to, dep: n.depAt, bac: 1.1 + Math.random() * 1.0, at: now, decided: '' });
    }
  } catch (e) { /* next time */ }
  drunkAsk();
}
setInterval(() => { try { drunkAdvance(); } catch (e) { /* next time */ } }, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(() => { try { drunkAdvance(); } catch (e) { /* later */ } }, 1500); });

/* ---------- the bars' spirits: bought into storage, sold at your lounges' bars ---------- */
// Each drink the bartenders serve is bought by the bottle into your storage (Finance → Storage, Spirits) and taken
// from it a serving at a time: by you, by the guests you see, and by the guests at your lounges while you are not
// there (their drinks are paid into your balance). A drink that has run out can't be served; with nothing left at
// all, the bar serves nothing. Wholesale bottle prices are typical trade prices (US dollars).
const SPIRIT_BOTTLE: { [id: string]: { ml: number; usd: number; per: string } } = {
  red: { ml: 750, usd: 11, per: 'bottle' }, white: { ml: 750, usd: 10, per: 'bottle' }, champagne: { ml: 750, usd: 32, per: 'bottle' },
  whisky: { ml: 700, usd: 34, per: 'bottle' }, gin: { ml: 700, usd: 21, per: 'bottle' }, vodka: { ml: 700, usd: 16, per: 'bottle' },
  aquavit: { ml: 700, usd: 24, per: 'bottle' }, rum: { ml: 700, usd: 22, per: 'bottle' }, cognac: { ml: 700, usd: 39, per: 'bottle' },
  port: { ml: 750, usd: 17, per: 'bottle' }, amaretto: { ml: 700, usd: 19, per: 'bottle' },
};
function spiritStore(cid?: string): any {
  const S: any = State, id = cid || State.companyId; S.spiritStore = S.spiritStore || {};
  // a new bar opens with a few bottles of each
  return S.spiritStore[id] || (S.spiritStore[id] = Object.assign({ used: [] }, ...Object.keys(SPIRIT_BOTTLE).map(k => ({ [k]: spiritServes(k) * 3 }))));
}
/** Servings in one bottle. */
function spiritServes(id: string): number { const d = lgSpirit(id), b = SPIRIT_BOTTLE[id]; return d && b ? Math.floor(b.ml / d.ml) : 1; }
function spiritLeft(id: string): number { return Math.max(0, Math.floor(spiritStore()[id] || 0)); }
function spiritAny(): boolean { return LG_SPIRITS.some(d => spiritLeft(d.id) > 0); }
/** A serving out of storage (false when it has run out); counted for the daily use. */
function spiritTake(id: string, cid?: string): boolean {
  const st = spiritStore(cid); if (!((st[id] || 0) >= 1)) return false;
  st[id] -= 1; const day = dateStr(new Date()).slice(0, 10); let u = st.used[0]; if (!u || u.d !== day) { u = { d: day }; st.used.unshift(u); if (st.used.length > 14) st.used.length = 14; }
  u[id] = (u[id] || 0) + 1; return true;
}
function spiritDaily(id: string): number { const u = spiritStore().used.slice(0, 7); return u.length ? u.reduce((a: number, x: any) => a + (x[id] || 0), 0) / u.length : 0; }
/** A guest's drink: paid into your balance. */
function spiritSale(id: string, cid?: string) {
  const d = lgSpirit(id), c = company(cid); if (!d || !c) return;
  try { payTxn(c.id, `Lounge bar: ${d.name}`, d.price, 'catering' as any, [[d.name, d.price]]); } catch (e) { /* booked later */ }
}
ACTIONS['spirit-buy'] = el => {
  const id = el.getAttribute('data-k') || '', n = +(el.getAttribute('data-n') || 6), b = SPIRIT_BOTTLE[id], d = lgSpirit(id), c = company(); if (!b || !d || !c) return;
  if (typeof coopCanBuy === 'function' && !coopCanBuy()) { toast('In this co-op only the owner buys stock', 'warn'); return; }
  const cost = Math.round(n * b.usd * diff().cost); if (c.balance < cost) { toast('Not enough money', 'warn'); return; }
  spiritStore()[id] = (spiritStore()[id] || 0) + n * spiritServes(id);
  payTxn(c.id, `Spirits for the lounge bars: ${n} bottles of ${d.name.toLowerCase()}`, -cost, 'catering' as any, [[`${n} × ${money(b.usd * diff().cost)}`, -cost]]);
  try { Sound.purchase(); } catch (e) { /* quiet */ } Store.soon(); refresh();
};
/** The Spirits section of the storage: every drink the bartenders serve, what is left and what is used. */
function spiritsRowsHtml(): string {
  const rows = LG_SPIRITS.map(d => {
    const have = spiritLeft(d.id), per = spiritDaily(d.id), b = SPIRIT_BOTTLE[d.id], bottles = have / spiritServes(d.id), days = per ? have / per : 0;
    const adv = !have ? '<span class="st-bad">Run out: the bars can\'t serve it</span>' : per && days < 2 ? '<span class="st-bad">Order now: under 2 days left</span>' : per && days < 5 ? `<span class="st-warn">Order soon: about ${Math.round(days)} days left</span>` : '<span class="st-ok">Enough</span>';
    return `<div class="st-row"><div class="st-name"><b>${esc(d.name)}</b><small>${num(have)} servings (${bottles.toFixed(1)} bottles) · ${money(b.usd * diff().cost)} a bottle of ${b.ml} ml · sells for ${money(d.price)} a glass</small></div>
      <div class="st-bar"><i style="width:${Math.min(100, have / (spiritServes(d.id) * 24) * 100).toFixed(1)}%"></i></div>
      <div class="st-adv">${adv}<small>${per ? `uses about ${num(Math.round(per))} a day` : ''}</small></div><div class="st-mkt"></div>
      <div class="st-buy">${[6, 12, 24].map(n => `<button class="btn ghost sm" data-act="spirit-buy" data-k="${d.id}" data-n="${n}">+${n} bottles</button>`).join('')}</div></div>`;
  }).join('');
  return `<h4 class="st-sub">Spirits (your lounges' bars)</h4>${rows}<p class="fine-print">${icon('info')}${spiritAny() ? '' : 'The bars have run out of everything: they serve nothing until you order. '}Every drink the bartenders serve comes from here; your guests\' drinks are paid into your balance.</p>`;
}
/** While you are not there: your lounges' guests buy drinks before each departure (business and first class). */
function spiritsAdvance() {
  if ((State as any).finHold) return;
  let L: any = null; try { L = loyalty(); } catch (e) { L = null; }
  const lounges = L && L.lounges ? L.lounges : {}, now = Date.now();
  for (const n of ((State as any).aiNext || []) as any[]) {
    if (!n || n.barSold || !lounges[n.from] || (lounges[n.from].lvl || 0) < 1 || n.depAt - now > 45 * 60e3 || n.depAt < now) continue;
    if (typeof LoungeRoom !== 'undefined' && LoungeRoom.on && LoungeRoom.k === n.from) continue;   // you're there: you see them buy
    n.barSold = true;
    let ld: any = null; try { ld = aiPlannedLoad(n); } catch (e) { ld = null; } const prem = ld ? (ld.paxJ || 0) + (ld.paxF || 0) : 0;
    let drinks = Math.round(prem * (0.25 + Math.random() * 0.25));
    while (drinks-- > 0) { const have = LG_SPIRITS.filter(d => spiritLeft(d.id) > 0); if (!have.length) break; const d = have[Math.floor(Math.random() * have.length)]; if (spiritTake(d.id)) spiritSale(d.id); }
  }
}
setInterval(() => { try { spiritsAdvance(); } catch (e) { /* next time */ } }, 60000);
