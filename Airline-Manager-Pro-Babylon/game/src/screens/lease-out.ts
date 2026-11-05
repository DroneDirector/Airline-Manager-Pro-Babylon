// Leasing your own aircraft out to other airlines, and closing routes.
//
// Lease out: an aircraft you own (not one you lease yourself) goes to another airline for one to five
// years. They pay you rent every month; it comes back with more hours and some wear. You can recall it
// early for three months' rent. Rents follow the aircraft's value and the difficulty.

interface LeaseOut { to: string; monthly: number; since: number; endAt: number; nextAt: number; years: number }
function leaseOutOf(a: any): LeaseOut { return a && a.leasedOut || null; }
let _lo = { reg: '', i: 0, years: 2 };
function leaseOutOffers(a: Aircraft): { to: string; rate: number; note: string }[] {
  const seed = a.reg + Math.floor(Date.now() / (7 * 864e5)), out: { to: string; rate: number; note: string }[] = [];
  const notes = ['Needs extra capacity for the season', 'Growing fast on new routes', 'Replacing an aircraft out for heavy maintenance', 'Starting a new base'];
  for (let i = 0; i < 3; i++) {
    const h = _hashStr(seed + ':' + i), name = COMPETITOR_NAMES[h % COMPETITOR_NAMES.length];
    if (out.some(o => o.to === name)) continue;
    out.push({ to: name, rate: 0.0075 + (h % 40) / 10000, note: notes[(h >>> 5) % notes.length] });
  }
  return out;
}
function leaseOutMonthly(a: Aircraft, rate: number, years: number): number {
  // longer terms pay a little less a month; the difficulty sets how generous airlines are
  return Math.round(aircraftValue(a) * rate * (1 - (years - 1) * 0.03) * diff().income / 100) * 100;
}
function leaseOutHtml(): string {
  const a = plane(_lo.reg); if (!a) return '';
  const t = acType(a.typeId), offers = leaseOutOffers(a), o = offers[Math.min(_lo.i, offers.length - 1)];
  const monthly = leaseOutMonthly(a, o.rate, _lo.years);
  return `<div class="modal-head"><div><h2>Lease out ${esc(a.reg)}</h2><small>${esc(t.maker)} ${esc(t.model)} to another airline. They fly it; you get rent every month.</small></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
    <div class="modal-body">
      <h3>Offers</h3><div class="route-pick">${offers.map((x, i) => `<button class="rp ${i === _lo.i ? 'on' : ''}" data-act="lo-pick" data-i="${i}"><span class="chain"><b>${esc(x.to)}</b><em class="green">${money(leaseOutMonthly(a, x.rate, _lo.years), { compact: true })}/month</em></span><small>${esc(x.note)}</small></button>`).join('')}</div>
      <h3>How long</h3><div class="seg">${[1, 2, 3, 5].map(y => `<button class="${_lo.years === y ? 'on' : ''}" data-act="lo-years" data-y="${y}">${y} year${y > 1 ? 's' : ''}</button>`).join('')}</div>
      <div class="kv-row"><div><small>Rent a month</small><b class="green">${money(monthly)}</b></div><div><small>Over the whole term</small><b>${money(monthly * 12 * _lo.years, { compact: true })}</b></div><div><small>Worth today</small><b>${money(aircraftValue(a), { compact: true })}</b></div></div>
      <p class="fine-print">${icon('info')}While it's away it isn't in your schedule. It comes back to ${esc(a.base)} with about ${num(_lo.years * 2600)} more flying hours and some wear. Recalling it early costs three months' rent.</p>
      <div class="modal-actions"><button class="btn ghost" data-act="close-layer">Cancel</button><button class="btn primary" data-act="lo-go">${icon('check')}Lease it to ${esc(o.to)}</button></div>
    </div>`;
}
function rerenderLo() { const p = $('.lo-pop .panel'); if (p) patchHtml(p, leaseOutHtml()); }
ACTIONS['ac-lease-out'] = el => {
  if (!canTrade()) return;
  const a = plane(el.getAttribute('data-reg')); if (!a) return;
  if ((a as any).lease) { toast(`${a.reg} is leased by you: you can't lease it on`, 'warn'); return; }
  if (a.status !== 'parked' || State.live.some(f => f.reg === a.reg) || ((State as any).aiNext || []).some((n: any) => n.reg === a.reg) || (State as any).myReg[a.companyId] === a.reg) { toast(`${a.reg} must be on the ground, free and not your own aircraft`, 'warn'); return; }
  _lo = { reg: a.reg, i: 0, years: 2 }; closeAll(); Sound.tick(); openLayer('modal', leaseOutHtml(), { cls: 'wide lo-pop' });
};
ACTIONS['lo-pick'] = el => { _lo.i = +el.getAttribute('data-i'); Sound.tick(); rerenderLo(); };
ACTIONS['lo-years'] = el => { _lo.years = +el.getAttribute('data-y'); Sound.tick(); rerenderLo(); };
ACTIONS['lo-go'] = () => {
  const a = plane(_lo.reg); if (!a) return; const o = leaseOutOffers(a)[_lo.i], monthly = leaseOutMonthly(a, o.rate, _lo.years);
  confirmChange(`Lease ${a.reg} to ${o.to}?`, `${money(monthly)} a month for ${_lo.years} year${_lo.years > 1 ? 's' : ''}. ${a.reg} leaves your fleet's schedule until ${dateStr(new Date(Date.now() + _lo.years * 12 * LEASE_MONTH)).slice(0, 10)}.`, 'Yes, lease it out', 'Not yet', () => {
    closeTop(); const now = Date.now(), c = company(a.companyId), from = c.balance;
    (a as any).leasedOut = { to: o.to, monthly, since: now, endAt: now + _lo.years * 12 * LEASE_MONTH, nextAt: now + LEASE_MONTH, years: _lo.years } as LeaseOut;
    a.status = 'leased' as any;
    // the first month is paid on signing
    payTxn(c.id, `Lease income: ${a.reg} to ${o.to}`, monthly, 'lease' as any, [[`First month's rent from ${o.to}`, monthly]]);
    Store.save(); closeAll(); Sound.purchase(); try { animateBalance(from, c.balance); } catch (e) { /* ignore */ } refresh();
    toast(`${a.reg} is leased to ${o.to}`, 'ok');
  }, () => closeTop());
};
ACTIONS['ac-recall'] = el => {
  const a = plane(el.getAttribute('data-reg')), L = leaseOutOf(a); if (!a || !L) return;
  const fee = L.monthly * 3;
  confirmChange(`Recall ${a.reg} from ${L.to}?`, `Ending the lease early costs three months' rent (${money(fee)}). ${a.reg} comes back to ${a.base}.`, `Recall for ${money(fee, { compact: true })}`, 'Keep it leased', () => {
    closeTop(); payTxn(a.companyId, `Early end of lease: ${a.reg}`, -fee, 'lease' as any, [[`Three months' rent to ${L.to}`, -fee]]);
    leaseOutReturn(a, 'You recalled it early'); Store.save(); closeAll(); refresh();
  }, () => closeTop());
};
/** The aircraft comes home: more hours and cycles, some wear. */
function leaseOutReturn(a: Aircraft, why: string) {
  const L = leaseOutOf(a); if (!L) return;
  const months = Math.max(1, (Date.now() - L.since) / LEASE_MONTH), hrs = Math.round(months * 215);
  a.hoursMin += hrs * 60; a.cycles += Math.round(hrs / 2.2); a.condition = Math.max(35, Math.round(a.condition - months * 0.6));
  delete (a as any).leasedOut; a.status = 'parked'; a.location = a.base;
  State.notices.unshift({ id: uid(), kind: 'mechanic' as any, title: `${a.reg} is back from ${L.to}`, body: `${why}. It flew about ${num(hrs)} hours for them and is at ${a.base}, condition ${a.condition}%.`, time: 'Now', at: Date.now(), read: false } as any);
}
/** Rent comes in every month; at the end of the term the aircraft comes home. */
function leaseOutAdvance() {
  const now = Date.now(); let changed = false;
  for (const a of State.fleet) {
    const L = leaseOutOf(a); if (!L) continue; const c = company(a.companyId); if (!c) continue;
    let n = 0;
    while (L.nextAt <= now && L.nextAt < L.endAt && n < 6) { payTxn(c.id, `Lease income: ${a.reg} from ${L.to}`, L.monthly, 'lease' as any, [[`Monthly rent from ${L.to}`, L.monthly]], L.nextAt); L.nextAt += LEASE_MONTH; n++; changed = true; }
    if (now >= L.endAt) { leaseOutReturn(a, 'The lease has ended'); changed = true; }
  }
  if (changed) { Store.save(); try { renderTopbar(); } catch (e) { /* ignore */ } }
}

/* ---------- closing a route ---------- */
ACTIONS['rd-close'] = () => {
  const r: any = State.routes.filter(x => x.id === _rdId)[0]; if (!r) return;
  const p: any = r.pilotId ? pilot(r.pilotId) : null, flying = State.live.some(f => f.pilotId === r.pilotId);
  confirmChange(`Close ${r.code}?`, `${r.legs.join(' → ')} will no longer be flown.${p ? ` ${p.name} ${flying ? 'finishes the flight in the air, then waits' : 'waits'} for a new assignment.` : ''} Travellers and the airports on the route will notice.`, 'Yes, close the route', 'Keep it', () => {
    closeTop();
    const ri = State.routes.indexOf(r);
    State.routes = State.routes.filter(x => x !== r);
    try { slotsToSpare(r.id, r.companyId); } catch (e) { /* none */ }
    // legs not yet flown are cancelled; a flight in the air lands as planned
    const S: any = State, gone = (S.aiNext || []).filter((n: any) => n.pilotId === r.pilotId && !n.job && !n.jobNext && !n.ferry), pst = p ? p.status : '';
    S.aiNext = (S.aiNext || []).filter((n: any) => gone.indexOf(n) < 0);
    if (p && !flying) p.status = 'standby';
    try { Progress.popularity(-0.5, `Closed route ${r.code}`); } catch (e) { /* ignore */ }
    const news = setTimeout(() => { try { newsRouteClosed(r); Store.soon(); } catch (e) { /* ignore */ } }, 7000);
    Store.save(); closeAll(); refresh();
    undoToast(`${r.code} closed`, () => { clearTimeout(news); State.routes.splice(Math.min(ri, State.routes.length), 0, r); S.aiNext = (S.aiNext || []).concat(gone); if (p && pst) p.status = pst; try { Progress.popularity(0.5, `Reopened route ${r.code}`); } catch (e) { /* ignore */ } });
  }, () => closeTop());
};
function newsRouteClosed(r: any) {
  const c = company(r.companyId), A = apt(r.legs[0]), B = apt(r.legs[r.legs.length - 1]); if (!c || !A || !B) return;
  if (!newsOnce('rc:' + r.id, 'rc', 0)) return;
  newsPost(c, B.icao, { section: 'Travel and business', art: { kind: 'aircraft', typeId: r.typeId, color: c.color, color2: c.color2 },
    headline: `${c.name} pulls out of ${B.city}`, standfirst: `${c.name} has stopped flying between ${A.city} and ${B.city}.`,
    body: [`Flight ${r.code} has been withdrawn. Passengers with bookings are being offered refunds or other flights.`, `Local businesses called the news disappointing.`],
    quote: ['The route did not work out for us. We may come back one day.', `${newsSpokes(c)}, ${c.name}`], quote2: [`We are sorry to see ${c.name} go.`, `Director, ${B.name}`] });
}
