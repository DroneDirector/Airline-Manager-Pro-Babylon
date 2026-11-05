// Finance: balance, profit by day, week, month and year, and every transaction.
let _finPeriod = 'day';
let _txFilter = 'all';
const TX_KINDS: { [k: string]: string } = { revenue: 'Revenue', fuel: 'Fuel', crew: 'Crew', maint: 'Maintenance', fine: 'Fine', purchase: 'Aircraft', lease: 'Lease', fees: 'Fees', salary: 'Salary', payroll: 'Salaries', sale: 'Aircraft sale', loan: 'Loan', insurance: 'Insurance', marketing: 'Marketing', charter: 'Charter', training: 'Training' };
const TX_FILTERS = [['all', 'All'], ['revenue', 'Revenue'], ['salary', 'Salaries'], ['maint', 'Maintenance'], ['fuel', 'Fuel'], ['fees', 'Fees'], ['fine', 'Fines'], ['purchase', 'Aircraft'], ['sale', 'Sales'], ['lease', 'Leases'], ['loan', 'Loans'], ['insurance', 'Insurance'], ['marketing', 'Marketing'], ['training', 'Training']];

function staffCountFor(cid: string): number { return State.pilots.filter((p: any) => !p.you && pilotCompany(p) === cid).length + staffOf(cid).length; }

function txRows(cid: string): string {
  const all = State.txns.filter(t => (t.companyId || 'atn') === cid && (!coopOn() || _coopWho === 'all' || (_coopWho === 'me' ? !(t as any).coopBy : (t as any).coopBy === _coopWho)));
  let rows: any[];
  if (_txFilter === 'all') {
    const sal = all.filter(t => t.kind === 'salary');
    rows = all.filter(t => t.kind !== 'salary');
    if (sal.length) rows.push({ id: 'payroll', kind: 'payroll', date: sal[0].date, label: `Weekly payroll, ${sal.length} people`, amount: sal.reduce((s, t) => s + t.amount, 0) });
    rows.sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));
  } else rows = all.filter(t => t.kind === _txFilter);
  if (!rows.length) return `<p class="muted pad">No ${_txFilter === 'all' ? '' : TX_FILTERS.filter(x => x[0] === _txFilter)[0][1].toLowerCase() + ' '}transactions yet.</p>`;
  return rows.map(t => {
    const who = t.personId ? staffById(t.personId) : null;
    return `<button class="tx" data-act="tx-detail" data-id="${t.id}">
      ${who ? `<span class="tx-av">${avatarSvg(who.look, personRole(who), { view: 'bust', still: true })}</span>` : `<span class="tx-k k-${t.kind}">${esc(TX_KINDS[t.kind])}</span>`}
      <span class="tx-l">${esc(t.label)}<small>${esc(t.date)}${who ? ', ' + ROLE_NAMES[personRole(who)] : ''}</small></span><b class="${t.amount >= 0 ? 'green' : ''}">${money(t.amount, { sign: true })}</b></button>`;
  }).join('');
}

SCREENS.finance = {
  title: 'Finance', icon: 'finance',
  render() {
    const c = company();
    const series = profitSeries(_finPeriod);
    const sim = State.settings.timeMode === 'sim';
    const max = Math.max.apply(null, series.map(p => Math.max(p.rev, p.cost))) * 1.12;
    const W = 560, H = 170, n = series.length, gap = W / n, bw = Math.min(22, gap * 0.32);
    const bars = series.map((p, i) => {
      const x = i * gap + gap / 2, hr = p.rev / max * H, hc = p.cost / max * H;
      return `<g class="bar-g" style="--i:${i}">
        <rect class="bar rev" x="${(x - bw - 1).toFixed(1)}" y="${(H - hr).toFixed(1)}" width="${bw.toFixed(1)}" height="${hr.toFixed(1)}" rx="3"><title>${p.label}: revenue ${money(p.rev)}</title></rect>
        <rect class="bar cost" x="${(x + 1).toFixed(1)}" y="${(H - hc).toFixed(1)}" width="${bw.toFixed(1)}" height="${hc.toFixed(1)}" rx="3"><title>${p.label}: costs ${money(p.cost)}</title></rect>
        <text x="${x.toFixed(1)}" y="${H + 16}" text-anchor="middle">${esc(p.label)}</text></g>`;
    }).join('');
    const profits = series.map(p => p.rev - p.cost);
    const pmax = Math.max.apply(null, profits.map(Math.abs)) || 1;
    const line = profits.map((v, i) => (i ? 'L' : 'M') + (i * gap + gap / 2).toFixed(1) + ',' + (H * 0.5 - v / pmax * H * 0.42).toFixed(1)).join(' ');
    const last = series[n - 1], lastP = last.rev - last.cost;
    const tot = series.reduce((s, p) => s + p.rev - p.cost, 0);
    
    const unit: { [k: string]: string } = { day: 'Daily', week: 'Weekly', month: 'Monthly', year: 'Yearly' };
    return `
    <div class="screen-head"><div><h1>Finance</h1><p class="sub">${esc(c.name)}, ${sim ? 'simulated years' : 'real-world calendar'}</p></div>
      ${expButtons('tx')}<div class="seg">${['day', 'week', 'month', 'year'].map(k => `<button class="${_finPeriod === k ? 'on' : ''}" data-act="fin-period" data-p="${k}">${unit[k]}</button>`).join('')}</div></div>
    ${marketsCardHtml()}
    ${soloMode() ? `<div class="loy-grid">${hedgeCardHtml()}${ffCardHtml()}</div>` : ''}
    ${safCardHtml()}${soloMode() ? sharesHtml() : ''}
    <div class="fin">
      <div class="card fin-chart">
        <div class="fin-top">
          <div><small>Balance</small><b class="fin-bal">${money(c.balance)}</b></div>
          <div><small>${_finPeriod === 'year' ? (sim ? 'Sim year ' : 'Year ') + esc(last.label) : PERIOD_NAMES[_finPeriod]}</small><b class="${lastP >= 0 ? 'green' : 'red'}">${money(lastP, { sign: true, compact: true })}</b></div>
          <div><small>Revenue</small><b>${money(last.rev, { compact: true })}</b></div>
          <div><small>All ${n} ${_finPeriod}s shown</small><b class="${tot >= 0 ? 'green' : 'red'}">${money(tot, { sign: true, compact: true })}</b></div>
        </div>
        <svg class="chart" viewBox="0 -6 ${W} ${H + 26}" preserveAspectRatio="none" role="img" aria-label="${unit[_finPeriod]} revenue, costs and profit">
          ${[0.25, 0.5, 0.75].map(k => `<line x1="0" x2="${W}" y1="${H * k}" y2="${H * k}" class="gl"/>`).join('')}
          ${bars}
          <path d="${line}" class="pline"/>
        </svg>
        <div class="legend"><span><i class="rev"></i>Revenue</span><span><i class="cost"></i>Costs</span><span><i class="pl"></i>Profit</span>
          ${_finPeriod === 'year' ? `<button class="text-btn" data-act="settings" data-section="time">${sim ? 'Using simulated years' : 'Using real-world years'}, change</button>` : ''}</div>
        ${_finPeriod === 'year' ? `<div class="years">${series.slice().reverse().map(p => `<div class="yr"><b>${sim ? 'Sim ' : ''}${esc(p.label)}</b><span>${money(p.rev, { compact: true })} revenue</span><span>${money(p.cost, { compact: true })} costs</span><em class="${p.rev - p.cost >= 0 ? 'green' : 'red'}">${money(p.rev - p.cost, { sign: true, compact: true })}</em></div>`).join('')}</div>` : ''}
      </div>
      ${bankCardsHtml(c.id)}
      <div class="card fin-tx">
        <div class="card-h"><b>Transactions</b><small>Tap one for details</small></div>
        ${coopWhoChips(true)}<div class="tx-filter">${TX_FILTERS.map(fl => `<button class="fchip ${_txFilter === fl[0] ? 'on' : ''}" data-act="tx-filter" data-f="${fl[0]}">${fl[1]}</button>`).join('')}</div>
        ${_txFilter === 'salary' || _txFilter === 'all' ? `<div class="payroll"><span>${icon('pilots')}<b>Next payroll in 6 days</b><small>${staffCountFor(c.id)} people, paid every week</small></span><b class="red">${money(-weeklyPayroll(c.id))}</b></div>` : ''}
        ${txRows(c.id)}
      </div>
    </div>`;
  },
};
ACTIONS['tx-filter'] = el => { _txFilter = el.getAttribute('data-f'); Sound.tick(); refresh(); };
ACTIONS['tx-detail'] = el => {
  const id = el.getAttribute('data-id');
  Sound.tick();
  if (id === 'payroll') { _txFilter = 'salary'; refresh(); return; }
  const t = State.txns.filter(x => x.id === id)[0]; if (!t) return;
  const who: any = t.personId ? staffById(t.personId) : null;
  const c = company(t.companyId || 'atn');
  const linkBtn = t.link ? (t.link.kind === 'log' ? `<button class="btn ghost" data-act="tx-open-log">${icon('logbook')}Open flight log</button>`
    : t.link.kind === 'aircraft' && plane(t.link.id) ? `<button class="btn ghost" data-act="ac-detail" data-reg="${t.link.id}">${icon('fleet')}Open ${esc(t.link.id)}</button>`
      : t.link.kind === 'staff' && who ? `<button class="btn ghost" data-act="staff-detail" data-id="${who.id}">${icon('user')}Open ${esc(who.name.split(' ')[0])}'s profile</button>` : '') : '';
  openLayer('modal', `
    <div class="modal-head"><span class="tx-k big k-${t.kind}">${esc(TX_KINDS[t.kind])}</span><div><h2>${esc(t.label)}</h2><small>${esc(t.date)}${t.time ? ' at ' + esc(t.time) : ''}, ${esc(c.name)}</small></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
    <div class="modal-body txd">
      ${who ? `<div class="txd-who"><span class="tx-av lg">${avatarSvg(who.look, personRole(who), { view: 'bust', accent: c.color })}</span><span><b>${esc(who.name)}</b><small>${ROLE_NAMES[personRole(who)]}, ${natLabel(who.nat)}, base ${esc(who.base)}</small></span></div>` : ''}
      <div class="kv-row">
        ${t.reg ? `<div><small>Aircraft</small><b>${esc(t.reg)}</b></div>` : ''}
        ${t.flight ? `<div><small>Flight</small><b>${esc(t.flight)}</b></div>` : ''}
        ${t.route ? `<div><small>Route</small><b>${esc(t.route)}</b></div>` : ''}
        <div><small>Category</small><b>${esc(TX_KINDS[t.kind])}</b></div>
      </div>
      ${txLinesHtml(t.lines)}
      <div class="txd-total"><span>Total</span><b class="${t.amount >= 0 ? 'green' : 'red'}">${money(t.amount, { sign: true })}</b></div>
      <div class="modal-actions">${linkBtn}<button class="btn primary" data-act="close-layer">Done</button></div>
    </div>`, { cls: 'narrow' });
};
/** Money in and money out, each with its subtotal. */
function txLinesHtml(lines: [string, number][]): string {
  if (!lines || !lines.length) return '';
  const inc = lines.filter(l => l[1] >= 0), exp = lines.filter(l => l[1] < 0);
  const sec = (title: string, ls: [string, number][], cls: string) => ls.length ? `<div class="txd-sec"><div class="txd-sh"><b>${title}</b><b class="${cls}">${money(ls.reduce((s, l) => s + l[1], 0), { sign: true })}</b></div>
    <div class="txd-lines">${ls.map(l => `<div><span>${esc(l[0])}</span><b class="${l[1] >= 0 ? 'green' : ''}">${money(l[1], { sign: true })}</b></div>`).join('')}</div></div>` : '';
  return sec('Income', inc, 'green') + sec('Expenses', exp, 'red');
}

/** Several flights at once (landed while you were away): each one opens its own breakdown. */
function flightsMoneyPopup(ids: string[]) {
  const ts = ids.map(id => State.txns.filter(x => x.id === id)[0]).filter(Boolean);
  closeAll();
  openLayer('modal', `<div class="modal-head"><div><h2>${ts.length} flights</h2><small>Tap a flight for its income and expenses</small></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
    <div class="modal-body"><div class="tx-list">${ts.map(t => `<button class="tx" data-act="tx-detail" data-id="${t.id}"><span class="tx-k k-${t.kind}">${esc(TX_KINDS[t.kind])}</span><span class="tx-l"><b>${esc(t.label)}</b><small>${esc(t.date)} ${esc(t.time || '')}</small></span><b class="${t.amount >= 0 ? 'green' : 'red'}">${money(t.amount, { sign: true })}</b></button>`).join('')}</div>
    <div class="txd-total"><span>Total</span><b class="${ts.reduce((s, t) => s + t.amount, 0) >= 0 ? 'green' : 'red'}">${money(ts.reduce((s, t) => s + t.amount, 0), { sign: true })}</b></div></div>`, { cls: 'narrow' });
}

ACTIONS['tx-open-log'] = () => { closeAll(); go('logbook'); };
ACTIONS['fin-period'] = el => { _finPeriod = el.getAttribute('data-p'); _ovPeriod = _finPeriod; Sound.tick(); refresh(); };

/* ---------- Loans, insurance and marketing ---------- */
function bankCardsHtml(cid: string): string {
  const b = bankState(), loans = b.loans.filter(l => l.companyId === cid), owed = loans.reduce((t, l) => t + l.left, 0), lvl = insuranceOf(cid);
  const camps = b.campaigns.filter(x => x.companyId === cid && x.end > Date.now());
  const rentMonth = (() => { const bases: { [k: string]: Aircraft[] } = {}; fleetOf(cid).forEach(a => { (bases[a.base] = bases[a.base] || []).push(a); }); return Object.keys(bases).reduce((t, k) => t + hangarRent(k, bases[k]), 0); })();
  return `<div class="fin-bank">
    <button class="card bank-tile" data-act="bank-loans"><span class="bt-ic">${icon('finance')}</span><span><small>Loans</small><b>${owed ? money(owed, { compact: true }) + ' owed' : 'No loans'}</b><small>${loans.length ? `${money(loans.reduce((t, l) => t + l.monthly, 0), { compact: true })} a month` : `Up to ${money(Bank.offer(cid).max, { compact: true })} at ${Bank.offer(cid).rate}%`}</small></span>${icon('chevron')}</button>
    <button class="card bank-tile" data-act="bank-ins"><span class="bt-ic">${icon('shield')}</span><span><small>Insurance</small><b>${lvl === 'full' ? 'Full cover' : lvl === 'basic' ? 'Basic cover' : 'Not insured'}</b><small>${lvl === 'none' ? 'Accidents are paid in full by you' : money(Bank.premium(cid), { compact: true }) + ' a month'}</small></span>${icon('chevron')}</button>
    <button class="card bank-tile" data-act="mk-campaign"><span class="bt-ic">${icon('star')}</span><span><small>Marketing</small><b>${camps.length ? camps.length + ' campaign' + (camps.length > 1 ? 's' : '') + ' running' : 'No campaigns'}</b><small>${camps.length ? 'Until ' + dateStr(new Date(Math.max.apply(null, camps.map(x => x.end)))).slice(0, 10) : 'More passengers and popularity'}</small></span>${icon('chevron')}</button>
    <div class="card bank-tile static"><span class="bt-ic">${icon('pin')}</span><span><small>Hangar and stand rent</small><b>${money(rentMonth, { compact: true })} a month</b><small>At your bases, every 30 days</small></span></div>
  </div>`;
}

let _loan = { amount: 0, years: 5 };
function loansHtml(): string {
  const c = company(), o = Bank.offer(c.id), loans = bankState().loans.filter(l => l.companyId === c.id);
  if (!_loan.amount) _loan.amount = Math.min(o.max, Math.max(100000, Math.round(o.max / 2 / 100000) * 100000));
  _loan.amount = Math.min(_loan.amount, o.max);
  const monthly = Bank.monthly(_loan.amount, o.rate, _loan.years * 12), total = monthly * _loan.years * 12;
  return `<div class="modal-head"><div><h2>Loans</h2><small>${esc(c.name)} can borrow up to ${money(o.max)} at ${o.rate}% a year</small></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
  <div class="modal-body">
    ${loans.map(l => `<div class="loan-row"><span><b>${esc(l.lender)}</b><small>${money(l.amount)} at ${l.rate}%, ${l.months / 12} years, since ${dateStr(new Date(l.since)).slice(0, 10)}</small></span>
      <span class="pr-k"><small>Still owed</small><b>${money(l.left)}</b></span><span class="pr-k"><small>Monthly</small><b>${money(l.monthly)}</b></span>
      <button class="btn ghost sm" data-act="loan-repay" data-id="${l.id}" ${c.balance < l.left * 1.01 ? 'disabled' : ''}>Pay off ${money(Math.round(l.left * 1.01), { compact: true })}</button></div>`).join('')}
    ${o.max > 0 ? `<h3>New loan</h3>
    <div class="range-row"><span><b>Amount</b><small>${money(_loan.amount)}</small></span><input type="range" id="loan-amt" min="100000" max="${Math.max(100000, o.max)}" step="100000" value="${_loan.amount}"><output>${money(_loan.amount, { compact: true })}</output></div>
    <div class="field"><small>Paid back over</small><div class="seg">${[1, 3, 5, 10].map(y => `<button class="${_loan.years === y ? 'on' : ''}" data-act="loan-years" data-y="${y}">${y} year${y > 1 ? 's' : ''}</button>`).join('')}</div></div>
    <div class="txd-lines"><div><span>Monthly instalment</span><b>${money(monthly)}</b></div><div><span>Interest in total</span><b>${money(total - _loan.amount)}</b></div></div>
    <p class="fine-print">${icon('info')}The interest depends on your popularity. Instalments are taken every 30 days, also while the app is closed. Pay it off early any time for a 1% fee.</p>
    <div class="modal-actions"><button class="btn ghost" data-act="close-layer">Close</button><button class="btn primary" data-act="loan-take">Borrow ${money(_loan.amount, { compact: true })}</button></div>`
    : `<p class="fine-print">${icon('info')}The bank lends against the aircraft you own. Buy aircraft (not leased) or pay back what you owe to borrow more.</p>`}
  </div>`;
}
function rerenderLoans() { const p = $('.loan-pop .panel'); if (p) patchHtml(p, loansHtml()); }
ACTIONS['bank-loans'] = () => { if (!canTrade()) return; _loan.amount = 0; Sound.tick(); openLayer('modal', loansHtml(), { cls: 'narrow loan-pop' }); };
ACTIONS['loan-years'] = el => { _loan.years = +el.getAttribute('data-y'); Sound.tick(); rerenderLoans(); };
document.addEventListener('change', e => { const el = e.target as HTMLInputElement; if (el && el.id === 'loan-amt') { _loan.amount = +el.value; rerenderLoans(); } });
document.addEventListener('input', e => { const el = e.target as HTMLInputElement; if (el && el.id === 'loan-amt') { const o = el.nextElementSibling; if (o) o.textContent = money(+el.value, { compact: true }); } });
ACTIONS['loan-take'] = () => {
  const c = company(), from = c.balance, l = Bank.borrow(c.id, _loan.amount, _loan.years); if (!l) return;
  Store.save(); Sound.purchase(); animateBalance(from, c.balance); rerenderLoans(); refresh(); toast(`${money(l.amount)} from ${l.lender}`, 'ok');
};
ACTIONS['loan-repay'] = el => { const c = company(), from = c.balance; Bank.repay(el.getAttribute('data-id')); Store.save(); Sound.payOut(); animateBalance(from, c.balance); rerenderLoans(); refresh(); toast('Loan paid off', 'ok'); };

ACTIONS['bank-ins'] = () => {
  if (!canTrade()) return;
  const c = company(), lvl = insuranceOf(c.id), val = fleetValueAll(c.id);
  const opt = (k: string, name: string, text: string) => `<button class="ins-opt ${lvl === k ? 'on' : ''}" data-act="ins-set" data-l="${k}"><b>${name}</b><small>${text}</small><em>${k === 'none' ? '$0' : money(Bank.premium(c.id, k))} a month</em></button>`;
  openLayer('modal', `<div class="modal-head"><div><h2>Fleet insurance</h2><small>Hull and liability for ${fleetOf(c.id).length} aircraft worth ${money(val, { compact: true })}</small></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
    <div class="modal-body"><div class="ins-opts">
      ${opt('none', 'No insurance', 'You pay every repair after an accident yourself.')}
      ${opt('basic', 'Basic cover', 'Pays 70% of accident repairs above a $25,000 excess.')}
      ${opt('full', 'Full cover', 'Pays 95% of accident repairs with no excess.')}
    </div><p class="fine-print">${icon('info')}Accidents are damage from hard landings, tail strikes, overspeed, engine failures, severe turbulence and crashes. Wear and tear and routine checks are never covered. The premium is taken every 30 days.</p></div>`, { cls: 'narrow' });
};
ACTIONS['ins-set'] = el => { const c = company(), from = c.balance, l = el.getAttribute('data-l') as any; if (l === insuranceOf(c.id)) { closeAll(); return; } Bank.setInsurance(c.id, l); Store.save(); closeAll(); animateBalance(from, c.balance); refresh(); toast(l === 'none' ? 'Insurance cancelled' : `Insured: ${l === 'full' ? 'full cover' : 'basic cover'}`, 'ok'); };

let _camp = { kind: 'airline' as 'airline' | 'route', route: '', cost: 100000, weeks: 2 };
function campaignHtml(): string {
  const c = company(), rs = State.routes.filter(r => r.companyId === c.id && !r.test), boost = Bank.campaignBoost(c.id, _camp.kind, _camp.cost);
  const running = bankState().campaigns.filter(x => x.companyId === c.id && x.end > Date.now());
  return `<div class="modal-head"><div><h2>Marketing</h2><small>Advertising brings more passengers while it runs, and lifts your popularity</small></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
  <div class="modal-body">
    ${running.map(x => `<div class="loan-row"><span><b>${esc(x.name)}</b><small>Until ${dateStr(new Date(x.end)).slice(0, 16)}, about ${Math.round(x.boost * 100)}% more passengers</small></span><span class="pr-k"><small>Cost</small><b>${money(x.cost, { compact: true })}</b></span></div>`).join('')}
    <h3>New campaign</h3>
    <div class="seg"><button class="${_camp.kind === 'airline' ? 'on' : ''}" data-act="camp-kind" data-k="airline">Whole airline</button><button class="${_camp.kind === 'route' ? 'on' : ''}" data-act="camp-kind" data-k="route" ${rs.length ? '' : 'disabled'}>One route</button></div>
    ${_camp.kind === 'route' ? `<div class="route-pick">${rs.map(r => `<button class="rp ${_camp.route === r.id ? 'on' : ''}" data-act="camp-route" data-id="${r.id}">${legChain(r.legs)}<small>${esc(r.code)}</small></button>`).join('')}</div>` : ''}
    <div class="field"><small>Budget</small><div class="seg wrap">${[25000, 50000, 100000, 250000, 500000, 1000000].map(v => `<button class="${_camp.cost === v ? 'on' : ''}" data-act="camp-cost" data-v="${v}">${money(v, { compact: true })}</button>`).join('')}</div></div>
    <div class="field"><small>Runs for</small><div class="seg">${[1, 2, 3, 4].map(w => `<button class="${_camp.weeks === w ? 'on' : ''}" data-act="camp-weeks" data-w="${w}">${w} week${w > 1 ? 's' : ''}</button>`).join('')}</div></div>
    <div class="txd-total"><span>About ${Math.round(boost * 100)}% more passengers${_camp.kind === 'route' ? ' on the route' : ' on every route'}</span><b>${money(-_camp.cost)}</b></div>
    <div class="modal-actions"><button class="btn ghost" data-act="close-layer">Close</button><button class="btn primary" data-act="camp-go" ${_camp.kind === 'route' && !_camp.route || c.balance < _camp.cost ? 'disabled' : ''}>${c.balance < _camp.cost ? 'Not enough money' : 'Start the campaign'}</button></div>
  </div>`;
}
function rerenderCamp() { const p = $('.camp-pop .panel'); if (p) patchHtml(p, campaignHtml()); }
ACTIONS['mk-campaign'] = el => { const r = el && el.getAttribute('data-route'); if (r) { _camp.kind = 'route'; _camp.route = r; } Sound.tick(); closeAll(); openLayer('modal', campaignHtml(), { cls: 'narrow camp-pop' }); };
ACTIONS['camp-kind'] = el => { _camp.kind = el.getAttribute('data-k') as any; Sound.tick(); rerenderCamp(); };
ACTIONS['camp-route'] = el => { _camp.route = el.getAttribute('data-id'); Sound.tick(); rerenderCamp(); };
ACTIONS['camp-cost'] = el => { _camp.cost = +el.getAttribute('data-v'); Sound.tick(); rerenderCamp(); };
ACTIONS['camp-weeks'] = el => { _camp.weeks = +el.getAttribute('data-w'); Sound.tick(); rerenderCamp(); };
ACTIONS['camp-go'] = () => { const c = company(), from = c.balance; Bank.startCampaign(c.id, _camp.kind, _camp.route, _camp.cost, _camp.weeks); Store.save(); Sound.payOut(); closeAll(); animateBalance(from, c.balance); refresh(); toast('Campaign started', 'ok'); };
