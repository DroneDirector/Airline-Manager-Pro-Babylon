// Leasing aircraft. Instead of paying the full price, the airline pays a monthly rent to a leasing
// company, as most real airlines do for much of their fleet:
//  - Rent is a share of the aircraft's price each month (the "lease rate factor"): 1.0% on a 1-year
//    lease, 0.85% on 3 years and 0.75% on 6 years. A security deposit of two months' rent is paid at
//    signing with the first month's rent, and paid back when the aircraft is returned.
//  - Rent is taken from the balance every 30 days on the real clock, like the weekly payroll, also
//    while the app is closed, and listed in Finance.
//  - At the end of the term the aircraft goes back to the leasing company (after it lands, if it is
//    flying) and the deposit comes back. Before that it can be extended by a year, bought out, or
//    returned early for three months' rent.

const LEASE_TERMS: { years: number; rate: number }[] = [{ years: 1, rate: 0.010 }, { years: 3, rate: 0.0085 }, { years: 6, rate: 0.0075 }];
const LEASE_MONTH = 30 * 864e5;

interface LeaseInfo { since: number; months: number; monthly: number; deposit: number; nextAt: number; endAt: number; lessor: string }

const LESSORS = ['AerCap', 'SMBC Aviation Capital', 'Air Lease Corporation', 'Avolon', 'BOC Aviation', 'Carlyle Aviation Partners'];

function leaseOf(a: Aircraft): LeaseInfo { return (a as any).lease || null; }
function leaseMonthly(price: number, years: number): number {
  const t = LEASE_TERMS.filter(x => x.years === years)[0] || LEASE_TERMS[0];
  return Math.round(price * t.rate / 100) * 100;
}

/* ---------- Rent, and the end of the term, on the real clock ---------- */
function leaseAdvance(quiet?: boolean) {
  const now = Date.now();
  let changed = false;
  for (const a of State.fleet.slice()) {
    const L = leaseOf(a); if (!L) continue;
    const c = company(a.companyId); if (!c) continue;
    let n = 0;
    while (L.nextAt <= now && L.nextAt < L.endAt && n < 6) {
      const day = dateStr(new Date(L.nextAt)).slice(0, 10), before = c.balance;
      c.balance -= L.monthly;
      State.txns.unshift({ id: uid(), companyId: c.id, date: day, time: '06:00', kind: 'lease' as any, label: `Lease: ${a.reg}`, amount: -L.monthly, reg: a.reg,
        lines: [[`Monthly rent to ${L.lessor}`, -L.monthly]], link: { kind: 'aircraft', id: a.reg } } as any);
      if (!quiet && c.id === State.companyId) { try { animateBalance(before, c.balance); } catch (e) { /* not ready */ } }
      L.nextAt += LEASE_MONTH; n++; changed = true;
    }
    if (L.nextAt <= now && L.nextAt < L.endAt) L.nextAt = now + LEASE_MONTH;
    // the term is over: back to the leasing company once it is on the ground
    if (now >= L.endAt && a.status !== 'flying' && !State.live.some(f => f.reg === a.reg)) { leaseHandBack(a, 0, 'The lease has ended'); changed = true; }
  }
  if (changed) { Store.save(); try { renderTopbar(); } catch (e) { /* ignore */ } }
  try { leaseOutAdvance(); } catch (e) { /* ignore */ }
}

/** The aircraft goes back to the leasing company; the deposit comes back, less any fee. */
function leaseHandBack(a: Aircraft, fee: number, why: string) {
  const L = leaseOf(a), c = company(a.companyId); if (!L || !c) return;
  const back = L.deposit - fee, before = c.balance;
  c.balance += back;
  State.txns.unshift({ id: uid(), companyId: c.id, date: dateStr(new Date()).slice(0, 10), time: new Date().toTimeString().slice(0, 5), kind: 'lease' as any, label: `Lease returned: ${a.reg}`, amount: back, reg: a.reg,
    lines: ([['Security deposit back', L.deposit]] as [string, number][]).concat(fee ? [['Early return fee (three months\' rent)', -fee] as [string, number]] : []) } as any);
  State.fleet = State.fleet.filter(x => x.reg !== a.reg);
  State.routes.forEach((r: any) => { if (r.reg === a.reg) r.reg = ''; });
  State.issues = State.issues.filter(i => i.reg !== a.reg);
  if (State.myReg[a.companyId] === a.reg) { const other = State.fleet.filter(x => x.companyId === a.companyId)[0]; if (other) State.myReg[a.companyId] = other.reg; }
  State.notices.unshift({ id: uid(), kind: 'mechanic', title: `${a.reg} returned to ${L.lessor}`, body: `${why}. ${back >= 0 ? money(back) + ' of the deposit paid back.' : money(-back) + ' paid on top of the deposit.'}`, time: 'Now', read: false } as any);
  try { if (c.id === State.companyId) animateBalance(before, c.balance); } catch (e) { /* ignore */ }
}

/* ---------- The lease sheet ---------- */
let _lease = { id: '', qty: 1, div: '', years: 3, base: '' };

function leaseSheetHtml(): string {
  const t = acType(_lease.id), c = company();
  const monthly = leaseMonthly(Math.round(t.price * ((engineOptions(t.id).filter(e => e.id === (_lease as any).eng)[0] || { price: 1 } as any).price)), _lease.years), deposit = monthly * 2;
  const today = (monthly + deposit) * _lease.qty, after = c.balance - today;
  const regs = nextRegs(c, _lease.qty);
  return `
    <div class="modal-head"><div><h2>Lease ${esc(t.maker)} ${esc(t.model)}</h2><small>${esc(t.variant)}, ${esc(t.dev)}</small></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
    <div class="modal-body buy">
      <div class="buy-art">${aircraftArt(t.id, { color: c.color, color2: c.color2, reg: regs[0] })}</div>
      <div class="buy-form">
        <div class="field"><small>How many</small>
          <div class="stepper"><button class="icon-btn" data-act="lease-qty" data-d="-1" aria-label="One less"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M5 12h14"/></svg></button><b>${_lease.qty}</b><button class="icon-btn" data-act="lease-qty" data-d="1" aria-label="One more">${icon('plus')}</button></div></div>
        ${enginePickHtml(t.id, (_lease as any).eng, 'lease-eng')}
        <div class="field"><small>Lease term</small><div class="seg">${LEASE_TERMS.map(x => `<button class="${_lease.years === x.years ? 'on' : ''}" data-act="lease-term" data-y="${x.years}">${x.years} year${x.years > 1 ? 's' : ''}</button>`).join('')}</div></div>
        ${c.divisions.length ? `<div class="field"><small>Division</small><div class="seg">${c.divisions.map(d => `<button class="${_lease.div === d.id ? 'on' : ''}" data-act="lease-div" data-div="${d.id}">${esc(d.name)}</button>`).join('')}</div></div>` : ''}
        <div class="field"><small>Registration${_lease.qty > 1 ? 's' : ''}</small><div class="regs">${regs.map(r => `<span>${esc(r)}</span>`).join('')}</div></div>
        ${baseFieldHtml(_lease.base || c.hub, _lease.qty, 'lease')}
        <div class="lease-terms">
          <div><small>Rent per month</small><b>${money(monthly * _lease.qty)}</b></div>
          <div><small>Security deposit</small><b>${money(deposit * _lease.qty)}</b><em>paid back at the end</em></div>
          <div><small>Over ${_lease.years} year${_lease.years > 1 ? 's' : ''}</small><b>${money(monthly * 12 * _lease.years * _lease.qty, { compact: true })}</b><em>buying costs ${money(t.price * _lease.qty, { compact: true })}</em></div>
        </div>
        <div class="buy-sum">
          <div><small>Due today</small><b>${money(today)}</b></div>
          <div><small>Balance after</small><b class="${after < 0 ? 'red' : ''}">${money(after)}</b></div>
        </div>
        ${(() => { const nb = noStandsFor(_lease.base || c.hub, _lease.qty); return `<button class="btn primary big" data-act="lease-confirm" ${after < 0 || nb ? 'disabled' : ''}>${nb ? `Not enough stands at ${esc(_lease.base || c.hub)}` : after < 0 ? 'Not enough money' : `Lease for ${money(monthly * _lease.qty, { compact: true })} a month`}</button>`; })()}
        <p class="fine-print">${icon('info')}The first month's rent and the deposit are paid today, then the rent every 30 days. You can extend, buy it out or return it early from the aircraft's page.</p>
      </div>
    </div>`;
}
ACTIONS['lease-eng'] = el => { (_lease as any).eng = el.getAttribute('data-e'); Sound.tick(); rerenderLease(); };
function rerenderLease() { const p = $('.lease-pop .panel'); if (p) patchHtml(p, leaseSheetHtml()); }

ACTIONS.lease = el => {
  if (!canTrade()) return;
  Sound.tick();
  const c = company();
  _lease = { id: el.getAttribute('data-id'), qty: 1, years: 3, base: company().hub, div: c.divisions.length ? (State.divisionId !== 'all' ? State.divisionId : c.divisions[0].id) : '' };
  openLayer('modal', leaseSheetHtml(), { cls: 'wide buy-pop lease-pop' });
};
ACTIONS['lease-qty'] = el => { _lease.qty = clamp(_lease.qty + parseInt(el.getAttribute('data-d'), 10), 1, 12); Sound.tick(); rerenderLease(); };
ACTIONS['lease-term'] = el => { _lease.years = +el.getAttribute('data-y'); Sound.tick(); rerenderLease(); };
ACTIONS['lease-div'] = el => { _lease.div = el.getAttribute('data-div'); Sound.tick(); rerenderLease(); };

ACTIONS['lease-confirm'] = () => {
  if (noStandsFor(_lease.base || company().hub, _lease.qty)) { toast('Not enough free stands there: choose another base', 'warn'); return; }
  if (!canTrade()) return;
  const t = acType(_lease.id), c = company();
  const monthly = leaseMonthly(t.price, _lease.years), deposit = monthly * 2, now = Date.now();
  const regs = nextRegs(c, _lease.qty), from = c.balance;
  const lessor = LESSORS[_hashStr(t.id + c.id) % LESSORS.length];
  c.balance -= (monthly + deposit) * _lease.qty;
  regs.forEach(r => State.fleet.push({ engine: (engineOptions(t.id).filter(e => e.id === (_lease as any).eng)[0] || engineOptions(t.id)[0] || {} as any).id, reg: r, typeId: t.id, companyId: c.id, divisionId: _lease.div || undefined, base: _lease.base || c.hub, location: _lease.base || c.hub, hoursMin: 0, cycles: 0, condition: 100, status: 'parked', delivered: dateStr(new Date()).slice(0, 10),
    lease: { since: now, months: _lease.years * 12, monthly, deposit, nextAt: now + LEASE_MONTH, endAt: now + _lease.years * 12 * LEASE_MONTH, lessor } } as any));
  State.txns.unshift({ id: uid(), companyId: c.id, date: dateStr(new Date()).slice(0, 10), time: new Date().toTimeString().slice(0, 5), label: `Lease: ${_lease.qty}× ${t.maker} ${t.model}`, amount: -(monthly + deposit) * _lease.qty, kind: 'lease' as any,
    reg: regs.join(', '), lines: regs.map(r => [`${r}: first month's rent and deposit, ${lessor}`, -(monthly + deposit)] as [string, number]), link: { kind: 'aircraft', id: regs[0] } } as any);
  try { coopAfterBuy(`${_lease.qty}× ${t.maker} ${t.model} (leased)`, (monthly + deposit) * _lease.qty); } catch (e) { /* ignore */ }
  closeAll(); Bases.ensure(); Store.save();
  Sound.purchase(); Haptics.success();
  animateBalance(from, c.balance);
  openLayer('modal', `
    <div class="delivered">
      <div class="dl-stage"><div class="dl-plane">${aircraftArt(t.id, { color: c.color, color2: c.color2, reg: regs[0] })}</div><div class="dl-runway"></div></div>
      <div class="dl-stamp"><small>Leased</small><b>${regs.map(esc).join(', ')}</b></div>
      <h2>${_lease.qty > 1 ? `${_lease.qty} leased ${esc(t.model)}s` : `Your leased ${esc(t.model)}`} ${_lease.qty > 1 ? 'are' : 'is'} at ${esc(c.hub)}</h2>
      <p class="muted">From ${esc(lessor)} for ${_lease.years} year${_lease.years > 1 ? 's' : ''}, ${money(monthly)} a month${_lease.qty > 1 ? ' each' : ''}. Ready to assign to routes.</p>
      <div class="modal-actions center">
        <button class="btn ghost" data-act="close-layer">Keep looking</button>
        <button class="btn primary" data-act="see-fleet" data-regs="${esc(regs.join(','))}">See it in the fleet</button>
      </div>
    </div>`, { cls: 'narrow celebrate' });
};

/* ---------- On the aircraft's page: extend, buy out, return ---------- */
function leaseBuyout(a: Aircraft): number {
  const L = leaseOf(a), t = acType(a.typeId); if (!L) return 0;
  const yrs = (Date.now() - L.since) / (365 * 864e5);
  return Math.max(Math.round(t.price * 0.35), Math.round(t.price * Math.pow(0.93, yrs) / 1000) * 1000);
}
function leasePanelHtml(a: Aircraft): string {
  const L = leaseOf(a); if (!L) return '';
  const left = Math.max(0, Math.ceil((L.endAt - Date.now()) / LEASE_MONTH));
  const flying = a.status === 'flying' || State.live.some(f => f.reg === a.reg);
  return `<div class="lease-box">
    <div class="lb-h">${icon('key')}<b>Leased from ${esc(L.lessor)}</b><small>${left} month${left === 1 ? '' : 's'} left, until ${esc(dateStr(new Date(L.endAt)).slice(0, 10))}</small></div>
    <div class="kv-row">
      <div><small>Rent per month</small><b>${money(L.monthly)}</b></div>
      <div><small>Next payment</small><b>${esc(dateStr(new Date(L.nextAt)).slice(0, 10))}</b></div>
      <div><small>Deposit held</small><b>${money(L.deposit)}</b></div>
    </div>
    <div class="btn-row">
      <button class="btn ghost sm" data-act="lease-extend" data-reg="${esc(a.reg)}">${icon('clock')}Extend 1 year</button>
      <button class="btn ghost sm" data-act="lease-buyout" data-reg="${esc(a.reg)}">${icon('market')}Buy it for ${money(leaseBuyout(a), { compact: true })}</button>
      <button class="btn ghost sm danger-txt" data-act="lease-return" data-reg="${esc(a.reg)}" ${flying ? 'disabled title="It can be returned once it has landed"' : ''}>${icon('close')}Return early</button>
    </div></div>`;
}

ACTIONS['lease-extend'] = el => {
  if (!canTrade()) return;
  const a = plane(el.getAttribute('data-reg')), L = a && leaseOf(a); if (!L) return;
  confirmChange(`Extend the lease of ${a.reg}?`, `One more year with ${L.lessor} at ${money(L.monthly)} a month. The lease then runs until ${dateStr(new Date(L.endAt + 12 * LEASE_MONTH)).slice(0, 10)}.`, 'Yes, extend', 'No',
    () => { L.endAt += 12 * LEASE_MONTH; L.months += 12; Store.save(); closeAll(); Sound.tick(); toast(`${a.reg}: lease extended by a year`, 'ok'); },
    () => closeTop());
};
ACTIONS['lease-buyout'] = el => {
  if (!canTrade()) return;
  const a = plane(el.getAttribute('data-reg')), L = a && leaseOf(a); if (!L) return;
  const c = company(a.companyId), price = leaseBuyout(a), net = price - L.deposit;
  if (c.balance < net) { toast('Not enough money to buy it out', 'warn'); return; }
  confirmChange(`Buy ${a.reg} from ${L.lessor}?`, `${money(price)} for the aircraft, less the ${money(L.deposit)} deposit: ${money(net)} to pay. No more rent, and it is yours.`, `Buy for ${money(net, { compact: true })}`, 'No',
    () => {
      const from = c.balance; c.balance -= net;
      State.txns.unshift({ id: uid(), companyId: c.id, date: dateStr(new Date()).slice(0, 10), time: new Date().toTimeString().slice(0, 5), kind: 'purchase', label: `Lease buy-out: ${a.reg}`, amount: -net, reg: a.reg,
        lines: [['Purchase price', -price], ['Security deposit set against it', L.deposit]], link: { kind: 'aircraft', id: a.reg } } as any);
      delete (a as any).lease; Store.save(); closeAll(); Sound.purchase(); Haptics.success(); animateBalance(from, c.balance); refresh();
      toast(`${a.reg} is now yours`, 'ok');
    }, () => closeTop());
};
ACTIONS['lease-return'] = el => {
  if (!canTrade()) return;
  const a = plane(el.getAttribute('data-reg')), L = a && leaseOf(a); if (!L) return;
  const fee = L.monthly * 3;
  confirmChange(`Return ${a.reg} early?`, `It goes back to ${L.lessor} now. The early return fee is three months' rent (${money(fee)}), taken from the ${money(L.deposit)} deposit; ${L.deposit - fee >= 0 ? money(L.deposit - fee) + ' comes back' : money(fee - L.deposit) + ' more to pay'}.`, 'Yes, return it', 'Keep it',
    () => { leaseHandBack(a, fee, 'Returned early'); Store.save(); closeAll(); refresh(); toast(`${a.reg} returned to ${L.lessor}`, 'info'); },
    () => closeTop());
};
