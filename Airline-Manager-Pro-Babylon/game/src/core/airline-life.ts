// Airline life: things that happen to your airline and need a decision from you, with consequences you see.
//  - Events (about one every two or three days): an aircraft stuck at an outstation waiting for a part, a VIP
//    charter at short notice, a ticket sale gone viral, a fuel supplier's fixed-price offer.
//  - Rivals: they answer a new route of yours on a city pair they fly (more flights or lower fares), and try to
//    hire your people away (match the offer, or let them go).
//  - Partners: codeshares with other airlines. Their passengers connect onto your flights to and from their hub
//    (you are paid for each), for a monthly fee; their troubles can rub off on you.
// Each one arrives as a notice you can open; when you are on a screen where it fits, the card opens by itself.

interface LifeOpt { id: string; label: string; sub: string }
interface LifeEv { id: string; kind: string; at: number; title: string; text: string; opts: LifeOpt[]; data: any; done?: string }
interface Partner { id: string; name: string; hub: string; fee: number; share: number; since: number; until?: number }

function lifeState(): { ev: LifeEv[]; day: string; partners: Partner[]; offers: Partner[]; offersDay: string; fuelFix?: any } {
  const S: any = State; return S.life || (S.life = { ev: [], day: '', partners: [], offers: [], offersDay: '' });
}
function lifeAdd(e: LifeEv) {
  const L = lifeState(); L.ev.unshift(e); if (L.ev.length > 40) L.ev.length = 40;
  State.notices.unshift({ id: uid(), kind: 'company' as any, title: e.title, body: e.text.slice(0, 160) + ' Tap to decide.', time: 'Now', at: e.at, read: false, ref: e.id } as any);
  try { renderTopbar(); } catch (er) { /* not ready */ }
  Store.soon();
  // straight away when it fits: not over your work in the busy screens, nor over anything else
  setTimeout(() => { if (!e.done && !(typeof TitleScreen !== 'undefined' && TitleScreen.on) && ['ops', 'ranking', 'logbook', 'map'].indexOf(State.screen) >= 0 && !document.querySelector('.layer.open, .bdr, .v3v, .sal3d')) lifeOpen(e.id); }, 2500);
}

/* ---------- the events ---------- */
function lifeRoll() {
  if (!soloMode() || Store.nogame()) return;
  const c: any = company(), cid = c.id, rnd = Math.random(), fl = fleetOf(cid) as any[];
  if (!fl.length) return;
  const now = Date.now(), id = 'life-' + uid();
  if (rnd < 0.3) {
    // an aircraft stuck away from home for want of a part
    const away = fl.filter(a => a.status === 'parked' && a.location && a.location !== c.hub)[0] || fl.filter(a => a.status === 'parked')[0];
    if (!away) return;
    const part = ['a starter valve', 'a brake unit', 'a weather radar', 'an air data computer', 'a cabin pressure controller', 'a fuel pump'][Math.floor(Math.random() * 6)];
    lifeAdd({ id, kind: 'aog', at: now, title: `${away.reg} stuck at ${away.location}`, text: `${away.reg} needs ${part} before it can fly again, and there isn't one at ${away.location}. Every hour on the ground costs flights and passengers.`,
      data: { reg: away.reg, part }, opts: [
        { id: 'charter', label: 'Fly the part in on a charter', sub: `${money(38000)}; flying again in about 6 hours` },
        { id: 'courier', label: 'Send it by courier', sub: `${money(4500)}; flying again in about 30 hours` },
        { id: 'robbing', label: 'Take one from another aircraft at the hub', sub: 'Free; this one flies in 3 hours, the other is grounded for 24 hours' },
      ] });
  } else if (rnd < 0.55) {
    // a VIP charter at short notice
    const big = ['EGLL', 'LFPG', 'EDDF', 'LEMD', 'LIRF', 'EHAM', 'LSZH', 'LOWW', 'EKCH', 'ENGM', 'ESSA', 'BIKF', 'EIDW', 'LPPT'].filter(k => k !== c.hub && apt(k));
    const to = big[Math.floor(Math.random() * big.length)], who = ['the national football team', 'an orchestra on tour', 'a government delegation', 'a film crew and their equipment', 'a cup-winning handball team'][Math.floor(Math.random() * 5)];
    const nm = apt(c.hub) && apt(to) ? gcDistanceNm(apt(c.hub).pos, apt(to).pos) : 800, pay = Math.round((40000 + nm * 55) / 1000) * 1000;
    lifeAdd({ id, kind: 'vip', at: now, title: `A charter for ${who}`, text: `They want to fly from ${c.hub} to ${to} tomorrow morning and will pay ${money(pay)}. It ties up one aircraft for the day; the press will be there.`,
      data: { to, pay, who }, opts: [
        { id: 'yes', label: 'Accept', sub: `${money(pay)}; reputation up if it goes well, down if it doesn't` },
        { id: 'no', label: 'Decline politely', sub: 'Nothing changes' },
      ] });
  } else if (rnd < 0.8) {
    // a fare sale gone viral by mistake
    lifeAdd({ id, kind: 'viral', at: now, title: 'A mistake fare has gone viral', text: `A booking error put ${c.name}'s fares at ${money(9)} on one route, and thousands of people have shared it. About 900 tickets are already sold.`,
      data: {}, opts: [
        { id: 'honour', label: 'Honour every ticket', sub: `About ${money(-180000)} in lost revenue; reputation and goodwill up` },
        { id: 'cancel', label: 'Cancel them and refund', sub: 'No loss; an angry week on social media' },
        { id: 'voucher', label: 'Cancel, with a voucher for each', sub: `About ${money(-45000)}; a little goodwill kept` },
      ] });
  } else {
    // a fuel supplier's fixed price
    const k = 0.92 + Math.random() * 0.12;
    lifeAdd({ id, kind: 'fuel', at: now, title: 'A fuel supplier offers a fixed price', text: `Your fuel supplier at ${c.hub} offers to fix the price at ${Math.round(k * 100)}% of today's for the next 30 days. If prices rise you save; if they fall you pay more.`,
      data: { k }, opts: [
        { id: 'fix', label: 'Fix the price for 30 days', sub: `${money(-15000)} arrangement fee` },
        { id: 'no', label: 'Stay on the market price', sub: 'Nothing changes' },
      ] });
  }
}

/** Your answer, and what follows from it. */
function lifeDecide(evId: string, opt: string) {
  const L = lifeState(), e = L.ev.filter(x => x.id === evId)[0]; if (!e || e.done) return;
  const c: any = company(), cid = c.id, now = Date.now(), d = e.data;
  const hold = (reg: string, hours: number, title: string) => { const a: any = plane(reg); if (!a) return;
    (State.issues as any[]).unshift({ id: uid(), reg, title, detail: title, source: 'Event', severity: 'grounding', cost: 0, days: 0, status: 'scheduled', date: dateStr(new Date()).slice(0, 10), startedAt: now, durMin: Math.round(hours * 60), fromCond: a.condition || 90, toCond: a.condition || 90 }); a.status = 'maintenance'; };
  let out = '';
  if (e.kind === 'aog') {
    if (opt === 'charter') { payTxn(cid, `Part flown to ${(plane(d.reg) as any || {}).location || ''} for ${d.reg}`, -38000, 'maint', [[`${d.part} on a charter flight`, -38000]]); hold(d.reg, 6, `Waiting for ${d.part} (charter)`); out = `${d.reg} flies again in about 6 hours.`; }
    else if (opt === 'courier') { payTxn(cid, `Part sent by courier for ${d.reg}`, -4500, 'maint', [[`${d.part} by courier`, -4500]]); hold(d.reg, 30, `Waiting for ${d.part} (courier)`); out = `${d.reg} flies again in about 30 hours.`; }
    else { const donor = (fleetOf(cid) as any[]).filter(a => a.reg !== d.reg && a.status === 'parked' && a.location === c.hub)[0]; hold(d.reg, 3, `${d.part} taken from ${donor ? donor.reg : 'another aircraft'}`); if (donor) hold(donor.reg, 24, `${d.part} given to ${d.reg}; waiting for a new one`); out = donor ? `${d.reg} flies in 3 hours; ${donor.reg} is grounded for a day.` : `${d.reg} flies in 3 hours.`; }
  } else if (e.kind === 'vip') {
    if (opt === 'yes') {
      const ok = Math.random() < 0.85;
      payTxn(cid, `VIP charter ${c.hub}–${d.to}`, d.pay, 'charter', [[`Charter for ${d.who}`, d.pay]]);
      try { Progress.popularity(ok ? 1.2 : -1.5, ok ? 'A VIP charter that went well' : 'A VIP charter that went badly'); } catch (er) { /* none */ }
      try { newsPost(c, c.hub, { section: 'Aviation', headline: ok ? `${c.name} flies ${d.who} to ${d.to}` : `Delays for ${d.who} on ${c.name} charter`, standfirst: ok ? 'On time and in style, said the passengers.' : 'A two-hour wait at the gate did not go down well.', body: [`${c.name} took the charter at a day's notice.`] } as any); } catch (er) { /* none */ }
      out = ok ? `${money(d.pay)} earned, and good press.` : `${money(d.pay)} earned, but the flight was late and the press noticed.`;
    } else out = 'They found another airline.';
  } else if (e.kind === 'viral') {
    if (opt === 'honour') { payTxn(cid, 'Mistake fare honoured', -180000, 'marketing', [['About 900 tickets at the mistake fare', -180000]]); try { Progress.popularity(2.5, 'Honoured a mistake fare'); } catch (er) { /* none */ } out = 'Your goodwill is the talk of the internet.'; }
    else if (opt === 'voucher') { payTxn(cid, 'Vouchers after a mistake fare', -45000, 'marketing', [['Vouchers for about 900 passengers', -45000]]); try { Progress.popularity(0.3, 'Vouchers after a mistake fare'); } catch (er) { /* none */ } out = 'Most people took the voucher well.'; }
    else { try { Progress.popularity(-2, 'Cancelled a mistake fare'); } catch (er) { /* none */ } out = 'An angry week online: reputation down.'; }
  } else if (e.kind === 'fuel') {
    if (opt === 'fix') { payTxn(cid, 'Fixed-price fuel arrangement', -15000, 'fuel', [['Arrangement fee', -15000]]); L.fuelFix = { k: d.k, until: now + 30 * 864e5, cid, hub: c.hub, price: Math.round(fuelPrice(c.hub) * d.k * 1000) / 1000 }; out = `Your fuel at ${c.hub} costs ${Math.round(d.k * 100)}% of today's price for 30 days.`; }
    else out = 'You stay on the market price.';
  } else if (e.kind === 'poach') {
    const p: any = (((State as any).staff || []) as any[]).concat(State.pilots as any[]).filter(x => x.id === d.pid)[0];
    if (p && opt === 'match') { const add = Math.round(p.salary * 0.12 / 10) * 10; p.salary += add; out = `${p.name} stays, at ${money(p.salary)} a month.`; }
    else if (p) { p.left = true; if (p.status !== undefined && !p.role) p.status = 'off'; out = `${p.name} leaves for ${d.rival}.`; try { Progress.popularity(-0.2, 'Lost staff to a rival'); } catch (er) { /* none */ } }
  } else if (e.kind === 'wx-ice' || e.kind === 'wx-ts') {
    out = wxDecide(e, opt);
  } else if (e.kind === 'partner-trouble') {
    const P = L.partners.filter(x => x.id === d.pid)[0];
    if (opt === 'stay') { try { Progress.popularity(-0.8, `Stood by ${d.name}`); } catch (er) { /* none */ } out = `You stand by ${d.name}. Some passengers are unhappy.`; }
    else { if (P) P.until = now; L.partners = L.partners.filter(x => x.id !== d.pid); out = `The codeshare with ${d.name} has ended.`; }
  }
  e.done = opt; Store.soon();
  try { closeAll(); } catch (er) { /* none */ }
  toast(out || 'Done', 'ok');
  try { refresh(); } catch (er) { /* not ready */ }
}

function lifeOpen(id: string) {
  const e = lifeState().ev.filter(x => x.id === id)[0]; if (!e) return;
  const icons: any = { aog: 'wrench', vip: 'star', viral: 'bell', fuel: 'finance', poach: 'pilots', 'partner-trouble': 'alert', 'wx-ice': 'cloud', 'wx-ts': 'cloud' };
  openLayer('modal', `<div class="life">
    <div class="life-h">${icon(icons[e.kind] || 'bell')}<span><small>${esc(dateStr(new Date(e.at)).slice(0, 16).replace('T', ' '))}</small><h2>${esc(e.title)}</h2></span></div>
    <p class="lede">${esc(e.text)}</p>
    ${e.done ? `<p class="life-done">${icon('check')}Decided: ${esc((e.opts.filter(o => o.id === e.done)[0] || { label: e.done } as any).label)}</p>` : `<div class="btn-col life-opts">${e.opts.map((o, i) => `<button class="btn ${i ? 'ghost' : 'primary'}" data-act="life-pick" data-id="${esc(e.id)}" data-o="${esc(o.id)}">${esc(o.label)}<small>${esc(o.sub)}</small></button>`).join('')}</div>`}
    <div class="modal-actions"><button class="btn ghost" data-act="close-layer">${e.done ? 'Close' : 'Decide later'}</button></div></div>`, { cls: 'life-pop' });
}
ACTIONS['life-pick'] = el => { lifeDecide(el.getAttribute('data-id'), el.getAttribute('data-o')); };

/* ---------- rivals answering new routes, and hiring your people away ---------- */
function rivalsLife() {
  if (!soloMode()) return;
  const c: any = company(), cid = c.id, b = bizState(), now = Date.now();
  for (const rt of (State.routes as any[]).filter(x => x.companyId === cid && !x.test && x.legs && x.legs.length >= 2)) {
    const key = [rt.legs[0], rt.legs[1]].sort().join('-');
    b.seenRoutes = b.seenRoutes || {}; if (b.seenRoutes[key]) continue; b.seenRoutes[key] = now;
    if (!b.lifeStarted) continue;   // routes you had before this came in are left alone
    const comp = competitorsOn(rt.legs[0], rt.legs[1]); if (!comp.length || (b.rival[key] && b.rival[key].until > now)) continue;
    const x = comp.sort((p, q) => q.quality - p.quality)[0], kind = x.quality > 60 ? 'freq' : 'war';
    b.rival[key] = { name: x.name, kind, until: now + 45 * 864e5 };
    State.notices.unshift({ id: uid(), kind: 'company', title: `${x.name} answers your new route`, body: kind === 'freq' ? `${x.name} adds two daily flights on ${rt.legs[0]}–${rt.legs[1]} for the next six weeks.` : `${x.name} cuts its fares by 20% on ${rt.legs[0]}–${rt.legs[1]} for the next six weeks.`, time: 'Now', at: now, read: false } as any);
    try { newsPost(c, rt.legs[0], { section: 'Business', headline: `${x.name} fights ${c.name} on ${rt.legs[0]}–${rt.legs[1]}`, standfirst: kind === 'freq' ? 'More flights to keep its passengers.' : 'A fare war on the new route.', body: [`${c.name} opened the route this week.`] } as any); } catch (e) { /* none */ }
  }
  b.lifeStarted = true;
  // one of your people gets an offer
  if (Math.random() < 0.12) {
    const staff = (((State as any).staff || []) as any[]).filter(p => p.companyId === cid && !p.left && (p.rating || 0) >= 4.2);
    const comp: string[] = []; for (const rt of (State.routes as any[]).filter(x => x.companyId === cid)) if (rt.legs && rt.legs.length > 1) for (const q of competitorsOn(rt.legs[0], rt.legs[1])) if (comp.indexOf(q.name) < 0) comp.push(q.name);
    const p = staff[Math.floor(Math.random() * staff.length)];
    if (p && comp.length) {
      const rival = comp[Math.floor(Math.random() * comp.length)], role = ({ fa: 'flight attendant', mech: 'mechanic', ground: 'ground crew', captain: 'captain', fo: 'first officer' } as any)[p.role] || 'staff member';
      lifeAdd({ id: 'life-' + uid(), kind: 'poach', at: now, title: `${rival} wants ${p.name}`, text: `${rival} has offered your ${role} ${p.name} a job with better pay. ${p.name} is one of your best (rated ${(p.rating || 4).toFixed(1)}).`,
        data: { pid: p.id, rival }, opts: [{ id: 'match', label: 'Match the offer', sub: `+12% pay: ${money(Math.round(p.salary * 1.12 / 10) * 10)} a month` }, { id: 'go', label: 'Let them go', sub: 'Wish them well; one less on the team' }] });
    }
  }
}

/* ---------- partners: codeshares ---------- */
const PARTNER_HUBS = ['EGLL', 'LFPG', 'EDDF', 'EHAM', 'LEMD', 'LIRF', 'LSZH', 'LOWW', 'EKCH', 'ENGM', 'ESSA', 'EFHK', 'BIKF', 'EIDW', 'LPPT', 'KJFK', 'KBOS', 'CYYZ', 'OMDB', 'LTFM'];
function partnerOffers(): Partner[] {
  const L = lifeState(), c: any = company(), day = new Date().toISOString().slice(0, 7);
  if (L.offersDay === day && L.offers.length) return L.offers;
  const names: string[] = []; for (const rt of (State.routes as any[]).filter(x => x.companyId === c.id)) if (rt.legs && rt.legs.length > 1) for (const q of competitorsOn(rt.legs[0], rt.legs[1])) if (names.indexOf(q.name) < 0) names.push(q.name);
  const have = L.partners.map(p => p.name), hubs = PARTNER_HUBS.filter(k => k !== c.hub && apt(k));
  L.offers = names.filter(n => have.indexOf(n) < 0).slice(0, 3).map(n => { const h = hubs[_hashStr(n) % hubs.length]; return { id: 'pt-' + uid(), name: n, hub: h, fee: 20000 + (_hashStr(n + 'f') % 6) * 5000, share: 0.08 + (_hashStr(n + 's') % 6) / 100, since: 0 }; });
  L.offersDay = day; Store.soon();
  return L.offers;
}
/** Each day: the partners' passengers connecting onto your flights to and from their hubs, paid to you; once a
 *  month, the fees. Now and then a partner's trouble makes the news, and you choose to stand by them or not. */
function partnersDaily() {
  const L = lifeState(), c: any = company(), cid = c.id, now = Date.now();
  for (const P of L.partners) {
    let pax = 0;
    for (const rt of (State.routes as any[]).filter(x => x.companyId === cid && x.legs && x.legs.indexOf(P.hub) >= 0)) {
      for (let i = 1; i < rt.legs.length; i++) if (rt.legs[i] === P.hub || rt.legs[i - 1] === P.hub) { try { pax += Math.round(marketPax(rt.legs[i - 1], rt.legs[i]) * P.share); } catch (e) { /* none */ } }
    }
    if (pax) { const rev = pax * 74; payTxn(cid, `Codeshare passengers from ${P.name}`, rev, 'revenue', [[`${pax} passengers connecting at ${P.hub}`, rev]]); }
    if (new Date(now).getDate() === 1 && (P as any).feeMonth !== new Date(now).toISOString().slice(0, 7)) { (P as any).feeMonth = new Date(now).toISOString().slice(0, 7); payTxn(cid, `Codeshare fee to ${P.name}`, -P.fee, 'fees', [['Monthly codeshare fee', -P.fee]]); }
    if (Math.random() < 0.015) lifeAdd({ id: 'life-' + uid(), kind: 'partner-trouble', at: now, title: `${P.name} in the news`, text: `${P.name}, your codeshare partner at ${P.hub}, is in the news after a string of cancellations and lost bags. Your passengers on their flights are affected too.`,
      data: { pid: P.id, name: P.name }, opts: [{ id: 'stay', label: 'Stand by them', sub: 'Keep the codeshare; reputation a little down' }, { id: 'end', label: 'End the codeshare', sub: 'No more connecting passengers from them' }] });
  }
}
function partnersHtml(): string {
  const L = lifeState(), offers = partnerOffers();
  const card = (P: Partner, mine: boolean) => `<div class="pt-card ${mine ? 'mine' : ''}"><span class="pt-logo">${esc(P.name.slice(0, 2).toUpperCase())}</span><span class="pt-t"><b>${esc(P.name)}</b><small>Hub ${esc(P.hub)} · ${Math.round(P.share * 100)}% of your passengers there connect from them · ${money(P.fee)} a month</small></span>
    ${mine ? `<button class="btn sm ghost" data-act="pt-end" data-id="${esc(P.id)}">End</button>` : `<button class="btn sm primary" data-act="pt-sign" data-id="${esc(P.id)}">${icon('check')}Sign</button>`}</div>`;
  return `<div class="card pt"><div class="card-h"><b>Partners and codeshares</b><small>Their passengers connect onto your flights to and from their hub; you pay a monthly fee</small></div>
    ${L.partners.length ? L.partners.map(p => card(p, true)).join('') : '<p class="muted">No partners yet.</p>'}
    ${offers.length ? `<h4 class="pl-h">Offers this month</h4>${offers.map(p => card(p, false)).join('')}` : ''}</div>`;
}
ACTIONS['pt-sign'] = el => { const L = lifeState(), P = L.offers.filter(x => x.id === el.getAttribute('data-id'))[0]; if (!P) return; P.since = Date.now(); L.partners.push(P); L.offers = L.offers.filter(x => x !== P); Store.soon(); Sound.tick(); toast(`Codeshare with ${P.name} signed`, 'ok'); try { newsPost(company(), company().hub, { section: 'Business', headline: `${company().name} and ${P.name} sign a codeshare`, standfirst: `Passengers can connect at ${P.hub}.`, body: [`The partnership starts today.`] } as any); } catch (e) { /* none */ } refresh(); };
ACTIONS['pt-end'] = el => { const L = lifeState(); L.partners = L.partners.filter(x => x.id !== el.getAttribute('data-id')); Store.soon(); Sound.tick(); toast('Codeshare ended', 'info'); refresh(); };

/* ---------- once a day ---------- */
setInterval(() => {
  try {
    if (Store.nogame() || (typeof TitleScreen !== 'undefined' && TitleScreen.on)) return;
    const L = lifeState(), day = new Date().toDateString(); if (L.day === day) return; L.day = day;
    if (Math.random() < 0.45) lifeRoll();
    rivalsLife(); partnersDaily(); Store.soon();
  } catch (e) { /* the next time */ }
}, 60000);
