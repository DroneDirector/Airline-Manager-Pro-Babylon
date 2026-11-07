// Car rental at your airport (Airport → Services and concessions): the rental companies in the rental car centre, each
// with its own cars, day rates, deposits, insurance, extras and return terms, renting to the passengers who arrive.
//  - Concessions: a company works at your airport once you sign its concession: it pays you a share of what it takes
//    (the concession fee) and a monthly rent for its desk and its bays. Three ways to sign: standard, low rent with a
//    higher share, or high rent with a lower share. End a concession whenever you like (its cars leave at once).
//  - Rentals run on the real clock: passengers pick up a car (an agreement: who, which car, how long, the rate, the
//    extras they took, the deposit held on their card), drive off, and bring it back when it is due, sometimes late,
//    with the tank not full, sandy, or with a stone chip in the windscreen; the return is checked against the terms
//    and the final bill made. Your share of every closed agreement is paid in, and the rents on the first of the month.
//  - The cars in the rental car centre's bays are the same: a car that is out is not in its bay.
// Prices are what car rental at an airport in Iceland costs (2025–26), in US dollars.

interface RentalCo { id: string; name: string; tier: 'Budget' | 'Standard' | 'Premium' | 'Electric'; color: string; fleet: { [type: string]: number }; rate: { [type: string]: number }; deposit: { [type: string]: number }; excess: number; zero: number; gravel: number; ash: number; km: number; kmFee: number; young: number; driver: number; late: number; fuel: number; clean: number; desk: number; open: string; note: string }
const CR_TYPES: { [k: string]: { name: string; ex: string; seats: number } } = {
  sedan: { name: 'Sedan', ex: 'Toyota Corolla class, automatic', seats: 5 }, station: { name: 'Station car', ex: 'Skoda Octavia Combi class, 4×4', seats: 5 },
  jeep: { name: 'Jeep / SUV', ex: 'Toyota Land Cruiser class, 4×4, for the highland roads', seats: 5 }, sports: { name: 'Sports car', ex: 'Porsche 911 class, two seats', seats: 2 },
};
const CR_COS: RentalCo[] = [
  { id: 'NORDRIVE', name: 'Nordrive', tier: 'Standard', color: '#0F3B66', fleet: { sedan: 10, station: 6, jeep: 10, sports: 1 }, rate: { sedan: 78, station: 95, jeep: 145, sports: 260 }, deposit: { sedan: 800, station: 1000, jeep: 1500, sports: 3000 }, excess: 2500, zero: 29, gravel: 12, ash: 10, km: 0, kmFee: 0, young: 15, driver: 8, late: 0.25, fuel: 3.2, clean: 90, desk: 2400, open: '05:00–01:00', note: 'The big one: every kind of car, desks open for the early and late flights.' },
  { id: 'AURORA', name: 'Aurora Rent', tier: 'Premium', color: '#2E7D78', fleet: { sedan: 4, station: 6, jeep: 8, sports: 3 }, rate: { sedan: 98, station: 118, jeep: 185, sports: 320 }, deposit: { sedan: 1200, station: 1500, jeep: 2000, sports: 4000 }, excess: 1800, zero: 25, gravel: 0, ash: 0, km: 0, kmFee: 0, young: 18, driver: 0, late: 0.2, fuel: 3.4, clean: 120, desk: 3200, open: 'Every flight', note: 'New cars, gravel and ash protection and an extra driver included.' },
  { id: 'FJORD', name: 'Fjord Motors', tier: 'Budget', color: '#A3262A', fleet: { sedan: 12, station: 4, jeep: 6, sports: 0 }, rate: { sedan: 59, station: 74, jeep: 118, sports: 0 }, deposit: { sedan: 600, station: 800, jeep: 1200, sports: 0 }, excess: 3500, zero: 32, gravel: 14, ash: 12, km: 300, kmFee: 0.35, young: 15, driver: 9, late: 0.33, fuel: 3.0, clean: 70, desk: 1600, open: '06:00–23:00', note: 'The cheapest rates, a higher excess and 300 km a day.' },
  { id: 'VELO', name: 'Velo Cars', tier: 'Budget', color: '#E0B12E', fleet: { sedan: 8, station: 6, jeep: 4, sports: 0 }, rate: { sedan: 64, station: 79, jeep: 125, sports: 0 }, deposit: { sedan: 700, station: 800, jeep: 1300, sports: 0 }, excess: 3000, zero: 30, gravel: 12, ash: 10, km: 0, kmFee: 0, young: 12, driver: 7, late: 0.25, fuel: 3.1, clean: 70, desk: 1800, open: '06:00–00:00', note: 'Simple and friendly; small cars and station cars.' },
  { id: 'SKYLINE', name: 'Skyline', tier: 'Premium', color: '#14202E', fleet: { sedan: 4, station: 2, jeep: 6, sports: 4 }, rate: { sedan: 109, station: 129, jeep: 210, sports: 360 }, deposit: { sedan: 1500, station: 1800, jeep: 2500, sports: 5000 }, excess: 1500, zero: 22, gravel: 0, ash: 0, km: 0, kmFee: 0, young: 25, driver: 0, late: 0.2, fuel: 3.5, clean: 150, desk: 3600, open: 'Every flight, meet and greet', note: 'Luxury and sports cars, delivered to the kerb.' },
  { id: 'GREENLINE', name: 'Greenline EV', tier: 'Electric', color: '#4F9A3A', fleet: { sedan: 8, station: 6, jeep: 6, sports: 1 }, rate: { sedan: 72, station: 88, jeep: 139, sports: 240 }, deposit: { sedan: 800, station: 900, jeep: 1400, sports: 2500 }, excess: 2500, zero: 27, gravel: 12, ash: 10, km: 0, kmFee: 0, young: 15, driver: 8, late: 0.25, fuel: 0.45, clean: 90, desk: 2200, open: '05:30–00:30', note: 'All electric; returned with less than 70 % charge costs the charging.' },
];
const CR_TERMS = [
  { id: 'std', name: 'Standard', fee: 12, rentK: 1, bay: 85 },
  { id: 'share', name: 'Low rent, higher share', fee: 16, rentK: 0.5, bay: 40 },
  { id: 'rent', name: 'High rent, lower share', fee: 8, rentK: 1.7, bay: 130 },
];
const CR_EXTRAS: { [k: string]: { name: string; per: 'day' | 'once'; take: number } } = {
  zero: { name: 'Zero excess (SCDW)', per: 'day', take: 0.45 }, gravel: { name: 'Gravel protection', per: 'day', take: 0.35 }, ash: { name: 'Sand and ash protection', per: 'day', take: 0.2 },
  driver: { name: 'Additional driver', per: 'day', take: 0.22 }, gps: { name: 'GPS', per: 'day', take: 0.1 }, wifi: { name: 'Wi-Fi hotspot', per: 'day', take: 0.16 }, child: { name: 'Child seat', per: 'day', take: 0.08 },
};
const CR_EXTRA_PRICE: { [k: string]: number } = { gps: 9, wifi: 10, child: 7 };

interface CrAgreement { id: string; co: string; type: string; plate: string; who: string; nat: string; age: number; out: number; due: number; days: number; rate: number; extras: string[]; deposit: number; km?: number; back?: number; bill?: [string, number][]; total?: number; fee?: number; state: 'out' | 'closed'; notes?: string[] }
interface CrState { signed: { [co: string]: { since: number; terms: string } }; open: CrAgreement[]; closed: CrAgreement[]; next: number; month: string; n: number; income: { at: number; amt: number; what: string }[] }

function crState(): CrState {
  const S: any = State; if (!S.carRental) S.carRental = { signed: {}, open: [], closed: [], next: Date.now(), month: '', n: 1000, income: [] };
  return S.carRental as CrState;
}
const crCo = (id: string) => CR_COS.filter(c => c.id === id)[0];
const crTerms = (id: string) => CR_TERMS.filter(t => t.id === id)[0] || CR_TERMS[0];
function crBays(c: RentalCo): number { let n = 0; for (const k in c.fleet) n += c.fleet[k]; return n; }
function crRent(c: RentalCo, terms: string): number { const t = crTerms(terms); return Math.round(c.desk * t.rentK + crBays(c) * t.bay); }
function crOut(co: string, type?: string): number { return crState().open.filter(a => a.co === co && (!type || a.type === type)).length; }
function crPlate(co: string, type: string, i: number): string { const L = 'ABCDEFGHJKLMNPRSTUVXYZ', h = (co + type).split('').reduce((s, ch) => s * 31 + ch.charCodeAt(0), 7) + i * 97; return `${L[h % 22]}${L[(h >> 3) % 22]} ${String(100 + (h * 13) % 900).padStart(3, '0')}`; }
function crExtraDay(c: RentalCo, k: string): number { return k === 'zero' ? c.zero : k === 'gravel' ? c.gravel : k === 'ash' ? c.ash : k === 'driver' ? c.driver : CR_EXTRA_PRICE[k] || 0; }
function crPick<T>(a: T[]): T { return a[Math.floor(Math.random() * a.length)]; }

/** How many passengers a day want a car at your airport: more with more of your flights. */
function crDemandPerDay(): number { let fleet = 0; try { fleet = fleetOf().length; } catch (e) { /* none */ } return Math.min(140, 6 + fleet * 1.6); }

/** The clock: new rentals as passengers arrive, cars coming back when they are due, the rents on the first of the month. */
function crTick() {
  const R = crState(), now = Date.now(), c0 = company(); if (!c0) return;
  const cos = Object.keys(R.signed).map(crCo).filter(Boolean);
  // the rents, on the first of each month for the month begun
  const m = new Date(now).toISOString().slice(0, 7);
  if (R.month !== m) { if (R.month && cos.length) { let sum = 0; const lines: [string, number][] = []; for (const c of cos) { const v = crRent(c, R.signed[c.id].terms); sum += v; lines.push([`${c.name}: desk and ${crBays(c)} bays`, v]); }
      payTxn(c0.id, 'Car rental concessions: monthly rent', sum, 'revenue', lines); R.income.unshift({ at: now, amt: sum, what: 'Monthly rents' }); }
    R.month = m; }
  // cars due back
  for (const a of R.open.slice()) if (a.due <= now - (Math.random() < 0.85 ? 0 : 3600e3 * (1 + Math.random() * 4))) crReturn(a, Math.max(now, a.due));
  // new rentals since the last look (at most a day's worth at once)
  if (!cos.length) { R.next = now; return; }
  const hrs = Math.min(24, (now - (R.next || now)) / 3600e3); if (hrs < 0.25) return; R.next = now;
  const hr = new Date().getHours(), dayK = hr < 5 ? 0.25 : hr < 8 ? 0.8 : hr < 22 ? 1.2 : 0.6;
  let n = crDemandPerDay() / 24 * hrs * dayK; let made = 0;
  while (n > 0 && made < 60) { if (Math.random() < Math.min(1, n)) { if (crRentOne(cos)) made++; } n -= 1; }
}
/** One passenger picks a car: the company (its kind, price and what is left), the car, how long, the extras. */
function crRentOne(cos: RentalCo[]): boolean {
  const R = crState(), want = Math.random(), type = want < 0.42 ? 'sedan' : want < 0.66 ? 'station' : want < 0.96 ? 'jeep' : 'sports';
  const opts = cos.filter(c => (c.fleet[type] || 0) > crOut(c.id, type)); if (!opts.length) return false;
  const budget = Math.random() < 0.55, w = opts.map(c => (budget ? 150 / c.rate[type] : c.tier === 'Premium' ? 1.6 : 1) * (c.tier === 'Electric' ? 0.9 : 1) * (0.6 + Math.random() * 0.8));
  let pick = opts[0], best = -1; opts.forEach((c, i) => { if (w[i] > best) { best = w[i]; pick = c; } });
  const nats = ['US', 'GB', 'DE', 'FR', 'ES', 'IT', 'NL', 'IS', 'NO', 'DK', 'SE', 'CA', 'CN', 'JP', 'KR', 'PL'], nat = crPick(nats), sex = Math.random() < 0.5 ? 'm' : 'f', N: any = (NAMES as any)[nat] || (NAMES as any).GB;
  const who = `${crPick(N[sex] as string[])} ${crPick(N.last as string[])}`, age = 21 + Math.floor(Math.pow(Math.random(), 1.4) * 50), days = Math.max(1, Math.min(14, Math.round(1 + Math.pow(Math.random(), 1.3) * 8)));
  const extras: string[] = []; for (const k in CR_EXTRAS) { if ((k === 'gravel' || k === 'ash') && !crExtraDay(pick, k)) continue; if (k === 'driver' && !pick.driver) continue; if (Math.random() < CR_EXTRAS[k].take * (k === 'zero' && type === 'sports' ? 1.6 : 1)) extras.push(k); }
  const used = R.open.filter(a => a.co === pick.id && a.type === type).map(a => a.plate);
  let plate = ''; for (let i = 0; i < 40 && (!plate || used.indexOf(plate) >= 0); i++) plate = crPlate(pick.id, type, i);
  const now = Date.now(), a: CrAgreement = { id: `${pick.id.slice(0, 2)}-${++R.n}`, co: pick.id, type, plate, who, nat, age, out: now, due: now + days * 864e5, days, rate: pick.rate[type], extras, deposit: pick.deposit[type] + (extras.indexOf('zero') >= 0 ? 0 : 0), state: 'out' };
  R.open.unshift(a); return true;
}
/** The car comes back: checked against the terms, the final bill, the deposit released (less any charge), your share paid in. */
function crReturn(a: CrAgreement, at: number) {
  const R = crState(), c = crCo(a.co); if (!c) { R.open = R.open.filter(x => x !== a); return; }
  const bill: [string, number][] = [], notes: string[] = [], zero = a.extras.indexOf('zero') >= 0;
  bill.push([`${CR_TYPES[a.type].name}: ${a.days} ${a.days === 1 ? 'day' : 'days'} × ${money(a.rate)}`, a.rate * a.days]);
  for (const k of a.extras) { const p = crExtraDay(c, k); if (p) bill.push([`${CR_EXTRAS[k].name}: ${a.days} × ${money(p)}`, p * a.days]); }
  if (a.age < 25 && c.young) bill.push([`Young driver (under 25): ${a.days} × ${money(c.young)}`, c.young * a.days]);
  const kmDriven = Math.round(a.days * (90 + Math.random() * 260)); a.km = kmDriven;
  if (c.km && kmDriven > c.km * a.days) { const over = kmDriven - c.km * a.days; bill.push([`${over} km over ${c.km} km a day × ${money(c.kmFee)}`, Math.round(over * c.kmFee)]); notes.push(`${kmDriven} km driven`); }
  const lateH = Math.max(0, Math.ceil((at - a.due) / 3600e3 - 59 / 60)); if (lateH > 0) { const f = Math.min(a.rate, Math.round(a.rate * c.late * lateH)); bill.push([`Returned ${lateH} h late (${Math.round(c.late * 100)} % of a day for each hour started)`, f]); notes.push('Late'); }
  if (Math.random() < 0.2) { if (c.tier === 'Electric') { const kwh = Math.round(10 + Math.random() * 30); bill.push([`Charging: ${kwh} kWh × ${money(c.fuel)} and the charging fee`, Math.round(kwh * c.fuel + 25)]); notes.push('Under 70 % charge'); }
    else { const l = Math.round(5 + Math.random() * 35); bill.push([`Fuel: ${l} l × ${money(c.fuel)} and the refuelling fee`, Math.round(l * c.fuel + 30)]); notes.push('Tank not full'); } }
  if (Math.random() < 0.07) { bill.push(['Cleaning (sand, mud or pets)', c.clean]); notes.push('Cleaning'); }
  if (Math.random() < 0.05 && a.extras.indexOf('gravel') < 0 && c.gravel) { const v = 380 + Math.round(Math.random() * 260); bill.push(['Windscreen: a stone chip (no gravel protection)', v]); notes.push('Stone chip'); }
  if (Math.random() < 0.04) { const dmg = 150 + Math.round(Math.pow(Math.random(), 2) * 3000), pay = zero ? 0 : Math.min(c.excess, dmg); bill.push([zero ? `Damage ${money(dmg)}: covered (zero excess)` : `Damage ${money(dmg)} (up to the ${money(c.excess)} excess)`, pay]); notes.push('Damage'); }
  const total = bill.reduce((s, b) => s + b[1], 0), fee = Math.round(total * crTerms(R.signed[a.co] ? R.signed[a.co].terms : 'std').fee / 100);
  a.back = at; a.bill = bill; a.total = total; a.fee = fee; a.notes = notes; a.state = 'closed';
  R.open = R.open.filter(x => x !== a); R.closed.unshift(a); if (R.closed.length > 80) R.closed.length = 80;
  const c0 = company(); if (c0 && fee > 0) { payTxn(c0.id, `Car rental: ${c.name} ${a.id}`, fee, 'revenue', [[`Concession fee on ${money(total)}`, fee]]); R.income.unshift({ at, amt: fee, what: `${c.name} ${a.id}` }); if (R.income.length > 120) R.income.length = 120; }
}
setInterval(() => { try { crTick(); } catch (e) { /* the next time */ } }, 60000);
setTimeout(() => { try { crTick(); } catch (e) { /* later */ } }, 5000);

/** What the rental car centre's bays should show: how many of each company's cars of each kind are out. */
function crBaysOut(): any { const out: any = {}, R = crState(); for (const id in R.signed) { out[id] = {}; for (const k in CR_TYPES) out[id][k] = crOut(id, k); } return { signed: Object.keys(R.signed), out }; }

/* ---------- the screen ---------- */
let _crTab = 'companies', _crOpen = '';
SCREENS.rental = {
  title: 'Car rental', icon: 'key', nav: false,
  render() {
    const R = crState(), c0: any = company(), hub = c0 ? (apt(c0.hub) || { name: c0.hub }) : { name: 'your airport' };
    const month = R.income.filter(x => new Date(x.at).toISOString().slice(0, 7) === new Date().toISOString().slice(0, 7)).reduce((s, x) => s + x.amt, 0);
    const tabs = [['companies', 'Companies', CR_COS.length], ['agreements', 'Agreements', R.open.length], ['returned', 'Returned', R.closed.length], ['terms', 'Return terms', 0], ['income', 'Income', 0]];
    return `
    <div class="screen-head"><div><h1>Car rental</h1><p class="sub">Airport → Services and concessions · the rental car centre at ${esc((hub as any).name || '')}</p></div>
      ${/Android/i.test(navigator.userAgent) ? '' : `<button class="btn ghost sm" data-act="cr-site">${icon('land')}Go to the rental car centre</button>`}</div>
    <div class="log-totals">
      <div class="stat"><small>Companies signed</small><b>${Object.keys(R.signed).length}<span> of ${CR_COS.length}</span></b></div>
      <div class="stat"><small>Cars out now</small><b>${R.open.length}</b></div>
      <div class="stat"><small>Your income this month</small><b class="green">${money(month)}</b></div>
      <div class="stat"><small>Passengers wanting a car</small><b>${Math.round(crDemandPerDay())}<span> a day</span></b></div>
    </div>
    <div class="tabs">${tabs.map(([k, l, n]) => `<button class="tab ${_crTab === k ? 'on' : ''}" data-act="cr-tab" data-k="${k}">${l}${n ? `<i>${n}</i>` : ''}</button>`).join('')}</div>
    ${_crTab === 'companies' ? crCompaniesHtml() : _crTab === 'agreements' ? crListHtml(R.open, true) : _crTab === 'returned' ? crListHtml(R.closed, false) : _crTab === 'terms' ? crTermsHtml() : crIncomeHtml()}
    ${_crOpen ? crAgreementHtml(_crOpen) : ''}`;
  },
};
function crCompaniesHtml(): string {
  const R = crState();
  return `<div class="cr-cos">${CR_COS.map(c => {
    const s = R.signed[c.id], types = Object.keys(CR_TYPES).filter(k => c.fleet[k]);
    return `<div class="card cr-co" style="--co:${c.color}"><div class="cr-co-h"><i class="cr-dot"></i><div><b>${esc(c.name)}</b><small>${c.tier} · ${crBays(c)} cars · desk open ${esc(c.open)}</small></div>${s ? `<span class="chip green">Signed · ${esc(crTerms(s.terms).name)}</span>` : '<span class="chip">Not at your airport</span>'}</div>
      <p class="fine-print">${esc(c.note)}</p>
      <div class="cr-rates">${types.map(k => `<div><small>${CR_TYPES[k].name}</small><b>${money(c.rate[k])}<span>/day</span></b><small>Deposit ${money(c.deposit[k])} · ${c.fleet[k]} cars${s ? ` · ${crOut(c.id, k)} out` : ''}</small></div>`).join('')}</div>
      <p class="fine-print">Insurance (CDW) included, excess ${money(c.excess)} · zero excess ${money(c.zero)}/day${c.gravel ? ` · gravel ${money(c.gravel)}/day · sand and ash ${money(c.ash)}/day` : ' · gravel, sand and ash included'} · ${c.km ? `${c.km} km a day, then ${money(c.kmFee)}/km` : 'unlimited km'}${c.driver ? ` · extra driver ${money(c.driver)}/day` : ' · extra driver included'}</p>
      ${s ? `<p class="fine-print">Since ${dateStr(new Date(s.since)).slice(0, 10)} · they pay you ${crTerms(s.terms).fee} % of what they take and ${money(crRent(c, s.terms))} a month</p><button class="btn ghost sm" data-act="cr-end" data-co="${c.id}">End the concession</button>`
        : `<div class="cr-sign">${CR_TERMS.map(t => `<button class="btn sm" data-act="cr-sign" data-co="${c.id}" data-t="${t.id}"><b>${esc(t.name)}</b><small>${t.fee} % share · ${money(crRent(c, t.id))}/month</small></button>`).join('')}</div>`}
    </div>`; }).join('')}</div>`;
}
function crListHtml(list: CrAgreement[], open: boolean): string {
  if (!list.length) return `<p class="fine-print">${icon('info')}${open ? (Object.keys(crState().signed).length ? 'No cars out right now: the next passengers pick theirs up as they arrive.' : 'Sign a rental company\'s concession (Companies) and passengers start renting its cars.') : 'Nothing returned yet.'}</p>`;
  return `<div class="cr-list">${list.slice(0, 60).map(a => { const c = crCo(a.co); return `<button class="cr-row" data-act="cr-open" data-id="${a.id}" style="--co:${c ? c.color : '#888'}"><i class="cr-dot"></i>
    <span><b>${esc(a.id)}</b><small>${esc(c ? c.name : a.co)}</small></span><span><b>${esc(a.who)}</b><small>${esc(a.nat)} · ${a.age}</small></span><span><b>${CR_TYPES[a.type].name}</b><small>${esc(a.plate)}</small></span>
    <span><b>${open ? 'Due ' + dateStr(new Date(a.due)).slice(5, 16) : money(a.total || 0)}</b><small>${open ? `${a.days} ${a.days === 1 ? 'day' : 'days'} · deposit ${money(a.deposit)} held` : `your share ${money(a.fee || 0)}${a.notes && a.notes.length ? ' · ' + esc(a.notes.join(', ')) : ''}`}</small></span></button>`; }).join('')}</div>`;
}
function crTermsHtml(): string {
  return `<div class="cr-cos">${CR_COS.map(c => `<div class="card cr-co" style="--co:${c.color}"><div class="cr-co-h"><i class="cr-dot"></i><div><b>${esc(c.name)}</b><small>Rental and return terms</small></div></div><ul class="cr-terms">
    <li>Driver at least 20 with a licence held for a year; under 25 pays ${money(c.young)} a day.</li>
    <li>A deposit is held on the driver's credit card at pick-up and released at the return, less any charge.</li>
    <li>Insurance (CDW) included with an excess of ${money(c.excess)}; zero excess for ${money(c.zero)} a day.</li>
    <li>${c.gravel ? `Gravel protection ${money(c.gravel)} a day, sand and ash ${money(c.ash)} a day; without it, windscreen and paint damage from stones, sand or ash is yours.` : 'Gravel, sand and ash protection included.'}</li>
    <li>${c.km ? `${c.km} km a day included, then ${money(c.kmFee)} a km.` : 'Unlimited kilometres.'}</li>
    <li>${c.tier === 'Electric' ? `Return with at least 70 % charge, or the charging is billed at ${money(c.fuel)} a kWh with a ${money(25)} fee.` : `Full to full: a tank not full is refilled at ${money(c.fuel)} a litre with a ${money(30)} fee.`}</li>
    <li>59 minutes' grace; after that ${Math.round(c.late * 100)} % of a day's rate for each hour started, at most a full day.</li>
    <li>Cleaning ${money(c.clean)} for a car returned with sand, mud or pet hair; no smoking (${money(250)}).</li>
    <li>No driving on F-roads (highland roads) except in a 4×4; no river crossings; no off-road driving (forbidden by law).</li>
    <li>Return after hours to the key box at the rental car centre; the car is checked the next morning.</li>
  </ul></div>`).join('')}</div>`;
}
function crIncomeHtml(): string {
  const R = crState(), rents = Object.keys(R.signed).map(id => { const c = crCo(id); return c ? [c.name, crRent(c, R.signed[id].terms), crTerms(R.signed[id].terms).fee] : null; }).filter(Boolean) as any[];
  return `${rents.length ? `<div class="card"><b>Monthly rents (paid on the first of the month)</b>${rents.map(r => `<div class="cr-inc"><span>${esc(r[0])} · ${r[2]} % share</span><b>${money(r[1])}</b></div>`).join('')}</div>` : ''}
    <div class="card"><b>Paid in</b>${R.income.length ? R.income.slice(0, 40).map(x => `<div class="cr-inc"><span>${dateStr(new Date(x.at)).slice(0, 16)} · ${esc(x.what)}</span><b class="green">${money(x.amt)}</b></div>`).join('') : '<p class="fine-print">Nothing yet.</p>'}</div>`;
}
/** The agreement itself: who, the car, the dates, the rate, the extras, the deposit, the terms, and the final bill once back. */
function crAgreementHtml(id: string): string {
  const R = crState(), a = R.open.concat(R.closed).filter(x => x.id === id)[0]; if (!a) return '';
  const c = crCo(a.co); if (!c) return '';
  return `<div class="cr-agr-bg" data-act="cr-close"></div><div class="card cr-agr" style="--co:${c.color}" role="dialog" aria-label="Rental agreement ${esc(a.id)}">
    <div class="cr-co-h"><i class="cr-dot"></i><div><b>${esc(c.name)} · rental agreement ${esc(a.id)}</b><small>${a.state === 'out' ? 'The car is out' : 'Closed'}</small></div><button class="btn ghost sm" data-act="cr-close">Close</button></div>
    <div class="cr-grid">
      <div><small>Renter</small><b>${esc(a.who)}</b><small>Licence ${esc(a.nat)} · age ${a.age}</small></div>
      <div><small>Car</small><b>${CR_TYPES[a.type].name} · ${esc(a.plate)}</b><small>${esc(CR_TYPES[a.type].ex)}</small></div>
      <div><small>Picked up</small><b>${dateStr(new Date(a.out)).slice(0, 16)}</b><small>The rental car centre</small></div>
      <div><small>${a.back ? 'Returned' : 'Due back'}</small><b>${dateStr(new Date(a.back || a.due)).slice(0, 16)}</b><small>${a.days} ${a.days === 1 ? 'day' : 'days'} · ${money(a.rate)} a day</small></div>
      <div><small>Deposit held</small><b>${money(a.deposit)}</b><small>${a.state === 'out' ? 'On the card until the return' : 'Released' + (a.bill && a.bill.some(b => /Damage|Windscreen/.test(b[0])) ? ', less the damage' : '')}</small></div>
      <div><small>Insurance</small><b>${a.extras.indexOf('zero') >= 0 ? 'Zero excess' : `CDW, excess ${money(c.excess)}`}</b><small>${a.extras.filter(k => k !== 'zero').map(k => CR_EXTRAS[k].name).join(' · ') || 'No extras'}</small></div>
    </div>
    ${a.bill ? `<b>The final bill</b>${a.bill.map(b => `<div class="cr-inc"><span>${esc(b[0])}</span><b>${money(b[1])}</b></div>`).join('')}<div class="cr-inc tot"><span>Total</span><b>${money(a.total || 0)}</b></div><div class="cr-inc"><span>Your concession share (${crTerms(R.signed[a.co] ? R.signed[a.co].terms : 'std').fee} %)</span><b class="green">${money(a.fee || 0)}</b></div>`
      : `<p class="fine-print">${icon('info')}Return by ${dateStr(new Date(a.due)).slice(0, 16)}: 59 minutes' grace, then ${Math.round(c.late * 100)} % of a day for each hour started. ${c.tier === 'Electric' ? 'At least 70 % charge.' : 'Full to full.'} ${c.km ? `${c.km} km a day included.` : 'Unlimited km.'}</p>`}
  </div>`;
}
ACTIONS['cr-tab'] = el => { _crTab = el.getAttribute('data-k') || 'companies'; _crOpen = ''; refresh(); };
ACTIONS['cr-open'] = el => { _crOpen = el.getAttribute('data-id') || ''; refresh(); };
ACTIONS['cr-close'] = () => { _crOpen = ''; refresh(); };
ACTIONS['cr-sign'] = el => { const id = el.getAttribute('data-co'), t = el.getAttribute('data-t') || 'std', c = crCo(id); if (!c) return; const R = crState(); R.signed[id] = { since: Date.now(), terms: t }; R.next = Date.now();
  toast(`${c.name} signed: ${crTerms(t).fee} % of what they take and ${money(crRent(c, t))} a month`, 'ok'); refresh(); };
ACTIONS['cr-end'] = el => { const id = el.getAttribute('data-co'), c = crCo(id), R = crState(); if (!c) return; for (const a of R.open.filter(x => x.co === id).slice()) crReturn(a, Date.now()); delete R.signed[id]; toast(`${c.name}'s concession ended: its cars have left`, 'info'); refresh(); };
ACTIONS['cr-site'] = () => { try { ACTIONS['airport-open'](null as any, null as any); } catch (e) { /* the airport */ } };
ACTIONS['rental-open'] = () => go('rental');
