// Money matters beyond the flights, as real airlines have them:
//  - Loans from a bank: up to about 60% of what the airline's own aircraft are worth (plus a little of
//    its cash). The interest depends on the airline's popularity, the loan is paid back in equal monthly
//    instalments (interest and repayment), and can be paid off early for a 1% fee.
//  - Insurance for the fleet: hull and liability cover. Basic pays 70% of accident repairs over a
//    $25,000 excess; full cover pays 95% with no excess, and also the passenger compensation after an
//    incident. Wear and tear is never covered. The premium is a small share of the fleet's value each month.
//  - Marketing campaigns: for the whole airline or one route, for one to four weeks. They bring extra
//    passengers while they run and lift the airline's popularity.
//  - Hangar and stand rent at each base, every month, for the aircraft based there.
// Everything is paid on the real clock every 30 days, like the leases, also while the app is closed.

interface Loan { id: string; companyId: string; lender: string; amount: number; rate: number; months: number; monthly: number; left: number; paid: number; since: number; nextAt: number }
interface Campaign { id: string; companyId: string; kind: 'airline' | 'route'; routeId?: string; name: string; cost: number; start: number; end: number; boost: number }
interface BankState { loans: Loan[]; insurance: { [cid: string]: 'none' | 'basic' | 'full' }; insNext: { [cid: string]: number }; campaigns: Campaign[]; rentNext: { [cid: string]: number } }

const BANK_MONTH = 30 * 864e5;
const LENDERS = ['Nordic Investment Bank', 'Atlantic Commerce Bank', 'Harbour Savings Bank', 'Meridian Credit', 'Aviation Finance Partners'];
const INS_RATE = { none: 0, basic: 0.0004, full: 0.0007 };

function bankState(): BankState {
  const S: any = State;
  if (!S.bank) S.bank = { loans: [], insurance: {}, insNext: {}, campaigns: [], rentNext: {} };
  return S.bank;
}
function insuranceOf(cid: string): 'none' | 'basic' | 'full' { return bankState().insurance[cid] || 'none'; }

function payTxn(cid: string, label: string, amount: number, kind: string, lines: [string, number][], at?: number) {
  const c = company(cid); if (!c || (State as any).finHold) return;   // a new career: nothing is booked until it starts
  const d = new Date(at || Date.now());
  c.balance += amount;
  State.txns.unshift({ id: uid(), companyId: cid, date: dateStr(d).slice(0, 10), time: dateStr(d).slice(11), label, amount, kind: kind as any, lines } as any);
}

const Bank = {
  /** How much the bank lends the airline now, and at what interest. */
  offer(cid: string): { max: number; rate: number } {
    const c = company(cid), owed = bankState().loans.filter(l => l.companyId === cid).reduce((t, l) => t + l.left, 0);
    const max = Math.max(0, Math.round((fleetValue(cid) * 0.6 + Math.max(0, c.balance) * 0.2 - owed) / 100000) * 100000);
    const rate = Math.round((5.2 + (100 - (c.reputation || 50)) / 100 * 4.5 + (c.balance < 0 ? 2 : 0)) * 10) / 10;
    const lr = typeof diff === 'function' ? diff().loan : 0;
    return { max, rate: Math.max(1, Math.round((rate + lr) * 10) / 10) };
  },
  monthly(amount: number, ratePct: number, months: number): number {
    const r = ratePct / 100 / 12;
    return Math.round(r ? amount * r / (1 - Math.pow(1 + r, -months)) : amount / months);
  },
  borrow(cid: string, amount: number, years: number) {
    const o = this.offer(cid); amount = Math.min(amount, o.max); if (amount <= 0) return null;
    const months = years * 12, monthly = this.monthly(amount, o.rate, months), now = Date.now();
    const l: Loan = { id: uid(), companyId: cid, lender: LENDERS[_hashStr(cid + bankState().loans.length) % LENDERS.length], amount, rate: o.rate, months, monthly, left: amount, paid: 0, since: now, nextAt: now + BANK_MONTH };
    bankState().loans.push(l);
    try { newsLoan(cid, amount, l.lender); } catch (e) { /* ignore */ }
    payTxn(cid, `Loan from ${l.lender}`, amount, 'loan', [[`${years}-year loan at ${o.rate}% a year`, amount]]);
    try { Online.discord('fleet', `${company(cid).name} took a loan`, `${money(amount)} over ${years} years at ${o.rate}%.`); } catch (e) { /* ignore */ }
    return l;
  },
  /** Pay off the rest early: what is still owed plus a 1% fee. */
  repay(id: string) {
    const b = bankState(), l = b.loans.filter(x => x.id === id)[0]; if (!l) return;
    const fee = Math.round(l.left * 0.01), total = l.left + fee;
    payTxn(l.companyId, `Loan paid off: ${l.lender}`, -total, 'loan', [['What was still owed', -l.left], ['Early repayment fee (1%)', -fee]]);
    b.loans = b.loans.filter(x => x !== l);
  },
  setInsurance(cid: string, level: 'none' | 'basic' | 'full') {
    const b = bankState(); b.insurance[cid] = level;
    if (level !== 'none') { const prem = this.premium(cid, level); payTxn(cid, `Insurance: ${level === 'full' ? 'full cover' : 'basic cover'}, first month`, -prem, 'insurance', [[`Hull and liability, fleet worth ${money(fleetValueAll(cid), { compact: true })}`, -prem]]); b.insNext[cid] = Date.now() + BANK_MONTH; }
  },
  premium(cid: string, level?: string): number { return Math.round(fleetValueAll(cid) * (INS_RATE as any)[level || insuranceOf(cid)]); },
  /** A repair after an accident: what the insurance pays back. Wear and tear isn't covered. */
  claim(reg: string, issues: Issue[]) {
    const a = plane(reg); if (!a) return;
    const lvl = insuranceOf(a.companyId); if (lvl === 'none') return;
    const acc = issues.filter(i => i.severity !== 'minor' && !/wear|inspection|service|check due/i.test(i.title + ' ' + i.source));
    const dmg = acc.reduce((t, i) => t + i.cost, 0); if (!dmg) return;
    const pay = lvl === 'full' ? Math.round(dmg * 0.95) : Math.max(0, Math.round((dmg - 25000) * 0.7));
    if (!pay) return;
    payTxn(a.companyId, `Insurance claim: ${reg}`, pay, 'insurance', [[`${acc.map(i => i.title).join(', ')}`, dmg], [lvl === 'full' ? 'Your share (5%)' : 'Excess and your share (30%)', -(dmg - pay)]]);
    try { toast(`Insurance pays ${money(pay)} of the repair`, 'ok'); } catch (e) { /* ignore */ }
  },
  /** Marketing: the cost, and the extra passengers it brings while it runs. */
  campaignBoost(cid: string, kind: 'airline' | 'route', cost: number): number {
    const size = Math.max(1, fleetOf(cid).length);
    const per = cost / (kind === 'airline' ? size * 60000 : 45000);
    return Math.round(Math.min(kind === 'airline' ? 0.2 : 0.35, 0.03 + Math.sqrt(per) * (kind === 'airline' ? 0.06 : 0.09)) * 100) / 100;
  },
  startCampaign(cid: string, kind: 'airline' | 'route', routeId: string, cost: number, weeks: number) {
    const r = State.routes.filter(x => x.id === routeId)[0];
    const now = Date.now(), boost = this.campaignBoost(cid, kind, cost);
    const name = kind === 'airline' ? 'Airline campaign' : `Route campaign ${r ? r.code + ' ' + r.legs.join('–') : ''}`;
    bankState().campaigns.push({ id: uid(), companyId: cid, kind, routeId: kind === 'route' ? routeId : undefined, name, cost, start: now, end: now + weeks * 7 * 864e5, boost });
    payTxn(cid, `Marketing: ${name}`, -cost, 'marketing', [[`${weeks} week${weeks > 1 ? 's' : ''} of advertising, about ${Math.round(boost * 100)}% more passengers`, -cost]]);
    try { Progress.popularity(Math.min(4, 0.6 + cost / 250000), 'A marketing campaign'); } catch (e) { /* ignore */ }
  },

  /** Loan instalments, insurance premiums and hangar rent that are due, on the real clock. */
  advance(quiet?: boolean) {
    const b = bankState(), now = Date.now(); let changed = false;
    for (const l of b.loans.slice()) {
      let n = 0;
      while (l.nextAt <= now && l.left > 0 && n < 12) {
        const interest = Math.round(l.left * l.rate / 100 / 12), principal = Math.min(l.left, l.monthly - interest);
        payTxn(l.companyId, `Loan instalment: ${l.lender}`, -(interest + principal), 'loan', [['Interest', -interest], ['Repayment', -principal]], l.nextAt);
        l.left -= principal; l.paid += interest + principal; l.nextAt += BANK_MONTH; n++; changed = true;
      }
      if (l.left <= 0) { noticesAt(now); b.loans = b.loans.filter(x => x !== l); State.notices.unshift({ id: uid(), kind: 'finance', title: `Loan paid off: ${l.lender}`, body: `The ${money(l.amount)} loan is fully paid back.`, time: 'Now', read: false } as any); noticesAt(l.nextAt - BANK_MONTH); }
    }
    for (const c of State.companies) {
      const lvl = insuranceOf(c.id);
      if (lvl !== 'none') {
        if (!b.insNext[c.id]) b.insNext[c.id] = now + BANK_MONTH;
        let n = 0;
        while (b.insNext[c.id] <= now && n < 12) { const prem = this.premium(c.id); payTxn(c.id, `Insurance premium: ${lvl === 'full' ? 'full cover' : 'basic cover'}`, -prem, 'insurance', [[`Hull and liability, fleet worth ${money(fleetValueAll(c.id), { compact: true })}`, -prem]], b.insNext[c.id]); b.insNext[c.id] += BANK_MONTH; n++; changed = true; }
      }
      // hangar and stand rent at each base
      if (!b.rentNext[c.id]) { b.rentNext[c.id] = now + BANK_MONTH; changed = true; }
      let n = 0;
      while (b.rentNext[c.id] <= now && n < 12) {
        const bases: { [k: string]: Aircraft[] } = {};
        fleetOf(c.id).forEach(a => { (bases[a.base] = bases[a.base] || []).push(a); });
        const lines: [string, number][] = Object.keys(bases).map(k => [`${k}: ${bases[k].length} aircraft`, -hangarRent(k, bases[k])] as [string, number]);
        const total = lines.reduce((t, l) => t + l[1], 0);
        if (total) payTxn(c.id, 'Hangar and stand rent', total, 'fees', lines, b.rentNext[c.id]);
        b.rentNext[c.id] += BANK_MONTH; n++; changed = true;
      }
    }
    if (changed) { Store.save(); if (!quiet) try { renderTopbar(); } catch (e) { /* ignore */ } }
  },
};
/** Value of every aircraft flown, owned or leased (what the insurance covers). */
function fleetValueAll(cid: string): number { return fleetOf(cid).reduce((t, a) => t + aircraftValue(a), 0); }
