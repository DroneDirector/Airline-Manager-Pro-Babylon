// What a flight earns and costs, from real-world airline figures (USD, one way, averages):
//  - Fares: short turboprop sectors have a high price per mile (about $90-180 for under 300 nm); jets
//    on short and medium haul about $45 + $0.16/nm; long-haul widebodies about $120 + $0.12/nm in
//    economy, with business and premium cabins lifting the average; international routes cost more than
//    domestic. Bush and air-taxi seats are priced like charters.
//  - On-board sales and bags: food, drinks and duty-free on short haul (where they aren't included),
//    checked bags and seat fees.
//  - Costs: fuel at about $0.85 per kg, landing fees by aircraft weight, passenger handling, en-route
//    air navigation charges by distance and weight, and maintenance reserves per block hour split over
//    engines, airframe, components, landing gear and APU (an A320 about $1,000 an hour, a 777 about
//    $2,800, an ATR 72 about $450, a Cessna 172 about $40).
//  - Fuel prices, airport charges, fares per class and cargo rates come from business.ts.

interface LegMoney { revenue: number; costs: number; net: number; lines: [string, number][]; fare: number; fuelKg: number }

// maintenance reserve per block hour, by class (USD)
const MX_PER_BH: { [cls: string]: number } = { widebody: 2700, airliner: 1000, regional: 650, turboprop: 450, bush: 180, ga: 45 };
const MX_SPLIT: [string, number][] = [['Engines', 0.4], ['Airframe checks', 0.2], ['Components', 0.24], ['Landing gear', 0.06], ['APU', 0.05], ['Line maintenance', 0.05]];
// typical maximum take-off weight in tonnes, by class (for landing and navigation charges)
const MTOW_T: { [cls: string]: number } = { widebody: 300, airliner: 75, regional: 37, turboprop: 23, bush: 4, ga: 1.1 };

function isDomestic(from: string, to: string): boolean {
  const A = apt(from), B = apt(to);
  return !!(A && B && A.country === B.country);
}

/** Average one-way fare per passenger for a route on an aircraft type. */
function averageFare(typeId: string, from: string, to: string): number {
  const t = acType(typeId), A = apt(from), B = apt(to);
  const nm = A && B ? gcDistanceNm(A.pos, B.pos) : 300, intl = !isDomestic(from, to);
  let fare: number;
  switch (t ? t.cls : 'airliner') {
    case 'turboprop': fare = Math.min(60 + 0.42 * nm, 70 + 0.3 * nm); break;
    case 'regional': fare = 55 + 0.26 * nm; break;
    case 'widebody': fare = (120 + 0.12 * nm) * 1.25; break;              // cabin mix: business and premium economy
    case 'bush': case 'ga': fare = 80 + 1.1 * nm; break;                   // seats sold like a charter
    default: fare = (45 + 0.16 * nm) * (nm > 1500 ? 1.1 : 1);
  }
  if (intl) fare *= 1.12;
  return Math.round(fare);
}

/** Extra facts about a leg: the aircraft (cabin, tankered fuel, route fares), passengers by class, a
 *  charter job it flies, or a ferry flight without anyone on board. */
interface LegX { reg?: string; paxJ?: number; paxF?: number; job?: { pay: number; title: string }; ferry?: boolean; book?: boolean; cat?: number }

/** Everything a leg earns and costs, with the lines shown in Finance. fuelKg: actual burn if known. */
function legEconomics(typeId: string, from: string, to: string, pax: number, cargoKg: number, blockMin: number, fuelKg?: number, gsxCharged?: boolean, x?: LegX): LegMoney {
  x = x || {};
  const t = acType(typeId) || AIRCRAFT[0], cls = t.cls, A = apt(from), B = apt(to);
  const nm = A && B ? gcDistanceNm(A.pos, B.pos) : 200, km = nm * 1.852, bh = blockMin / 60;
  const a = x.reg ? plane(x.reg) : null, cid = a ? a.companyId : State.companyId;
  const route = routeOf(cid, from, to);
  const cf = classFares(typeId, from, to, route);
  if (x.ferry) pax = 0;
  // passengers by class: given, or spread over the aircraft's cabin
  let pJ = x.paxJ, pF = x.paxF;
  if (pJ == null || pF == null) {
    const cab = a ? cabinOf(a) : defaultCabin(t), seats = cab.y + cab.j + cab.f || 1;
    pF = Math.round(pax * cab.f / seats); pJ = Math.round(pax * cab.j / seats);
  }
  pJ = Math.min(pJ, pax); pF = Math.min(pF, pax - pJ);
  const pY = pax - pJ - pF;
  const tickets = x.job ? 0 : pY * cf.y + pJ * cf.j + pF * cf.f;
  const fare = pax ? Math.round(tickets / pax) : cf.y;
  const longHaul = nm > 2000, small = cls === 'bush' || cls === 'ga';
  // on-board sales: buy-on-board on short haul, mostly included on long haul; bags and seats everywhere
  // services the airline offers (Settings → Services): on-board sales, bag and seat fees, service costs
  const svc = serviceEffects(cid, cls, nm, !isDomestic(from, to), pY, pJ + pF);
  const onboard = x.job || x.ferry ? 0 : svc.onboard;
  const bags = x.job || x.ferry ? 0 : svc.bags;
  const svcCost = x.job || x.ferry || !pax ? 0 : svc.extraCost;
  const cargo = x.job ? 0 : Math.round(cargoKg * cargoRate(from, to, cls));
  const jobPay = x.job ? x.job.pay : 0;
  const burn = fuelKg != null ? fuelKg : Math.round(bh * (BURN_KG_H[cls] || 2000) * 0.92 * engineBurn(x.reg));
  // fuel at this airport's price, less what was carried here from a cheaper airport on the leg before
  const price = fuelPrice(from), A2: any = a;
  let tankUsed = 0;
  if (A2 && A2.tankKg > 0 && A2.tankAt === from) { tankUsed = Math.min(A2.tankKg, burn); A2.tankKg = 0; A2.tankAt = ''; }
  // from your own stock at your bases (bookings only, not estimates)
  const stockUsed = x.book ? fuelFromStock(cid, from, burn - tankUsed) : 0;
  const fuel = Math.round((burn - tankUsed - stockUsed) * price);
  // tankering: the route asks for it and the next stop's fuel costs more: carry the next leg's fuel now
  let tankCost = 0, tankKg = 0, tankNext = '';
  if (a && route && (route as any).tanker && !x.ferry) {
    const i = route.legs.indexOf(to), nx = route.legs[(i + 1) % route.legs.length];
    if (nx && nx !== to && apt(nx)) {
      const n2 = gcDistanceNm(B.pos, apt(nx).pos), nb = Math.round((n2 / t.cruiseKt + 0.4) * (BURN_KG_H[cls] || 2000) * 0.92);
      const p2 = fuelPrice(to), extraBurn = Math.round(nb * 0.035 * bh);
      if (p2 > price * 1.03 && (p2 - price) * nb > extraBurn * price) { tankKg = nb; tankNext = to; tankCost = Math.round(nb * price + extraBurn * price); }
    }
  }
  const mtow = MTOW_T[cls] || 60;
  const landing = landingFee(to, t), parking = parkingFee(to, t);
  const handling = x.ferry ? 0 : Math.round(pax * (isDomestic(from, to) ? 6 : 9) + (cls === 'widebody' ? 900 : cls === 'airliner' ? 350 : small ? 0 : 150));
  const nav = small ? 0 : Math.round(km / 100 * Math.sqrt(mtow / 50) * 82);
  const mxBase = Math.round(bh * (MX_PER_BH[cls] || 800) * engineMx(x.reg)), partsUsed = x.book ? partsFromStock(cid, Math.round(mxBase * 0.45)) : 0;
  // parts are about 45% of maintenance: those follow the parts market (or come from stock)
  const mx = Math.round(mxBase * 0.55 + (mxBase * 0.45 - partsUsed) * marketIdx('parts'));
  const sales = Math.round(tickets * (small ? 0.03 : 0.06));                         // booking systems, agents, card fees
  let catering = gsxCharged || x.ferry ? 0 : Math.round(pY * (small ? 0 : longHaul ? 24 : cls === 'turboprop' ? 1.5 : 4) * svc.cateringMul + (pJ + pF) * (small ? 0 : longHaul ? 85 : 18) * svc.cateringPrem);
  // from the airline's own storage (Settings → Passenger services): what was loaded from it is already paid
  // for; the rest is bought from the airport's caterer at the day's prices plus their margin
  if (catering > 0 && x.book && typeof cateringOn === 'function' && cateringOn()) {
    try {
      const need = catNeed(pY, pJ + pF, blockMin), needUsd = CAT_ITEMS.reduce((a, it) => a + need[it.id] * it.usd, 0);
      const fromStock = x.cat != null ? x.cat : catLoad(null, cid, need).stockUsd;
      const covered = needUsd > 0 ? clamp(fromStock / needUsd, 0, 1) : 0;
      catering = Math.round(catering * (1 - covered) * (1.15 * (CAT_ITEMS.reduce((a, it) => a + catIdx(it.id), 0) / CAT_ITEMS.length)));
    } catch (e) { /* the usual catering cost */ }
  }
  const crewN = small ? 1 : 2 + (typeof faNeeded === 'function' ? faNeeded(t) : 0);
  const crewTrip = Math.round(crewN * (longHaul ? 260 : bh > 3 ? 120 : 45));             // allowances, hotels and transport away from base
  const overhead = Math.round(revenueBase(tickets, onboard, bags, cargo, jobPay) * (small ? 0.06 : 0.09)); // offices, IT, head office staff
  const lines: [string, number][] = [];
  if (x.job) lines.push([`Charter: ${x.job.title}`, jobPay]);
  else if (!x.ferry) {
    if (pF) lines.push([`${pF} first class × ${money(cf.f)}`, pF * cf.f]);
    if (pJ) lines.push([`${pJ} business class × ${money(cf.j)}`, pJ * cf.j]);
    lines.push([`${pY} ${pJ || pF ? 'economy' : 'passengers'} × ${money(cf.y)}${route && routeFares(route).y !== 1 ? ' (your fare)' : ' average fare'}`, pY * cf.y]);
  }
  if (onboard) lines.push(['Food, drinks and duty-free on board', onboard]);
  if (bags) lines.push(['Bags, paid seats and pet tickets', bags]);
  if (cargo) lines.push([`Cargo ${num(cargoKg)} kg × ${money(cargoRate(from, to, cls))}`, cargo]);
  // with GSX, handling and catering are charged per service as GSX does them (see gsxOnState)
  // apron crew: your own at this airport costs only materials (their pay is in the payroll); otherwise the local handling company's fee
  const ownCid = x && x.reg && plane(x.reg) ? plane(x.reg).companyId : State.companyId;
  const ownHere = ownApronCrewAt(ownCid, to);
  const hd = gsxCharged ? 0 : ownHere ? Math.round(handling * 0.3) : handling;
  if (tankUsed) lines.push([`Fuel, ${num(tankUsed)} kg tankered (paid on the leg before)`, 0]);
  if (stockUsed) lines.push([`Fuel from your stock, ${num(stockUsed)} kg (paid when bought)`, 0]);
  if (burn - tankUsed - stockUsed > 0) lines.push([`Fuel at ${from}, ${num(burn - tankUsed - stockUsed)} kg × $${price.toFixed(2)}`, -fuel]);
  if (partsUsed) lines.push([`Spare parts from your stock (paid when bought)`, 0]);
  if (tankCost) lines.push([`Tankering: ${num(tankKg)} kg for the next leg (fuel at ${tankNext} costs $${fuelPrice(tankNext).toFixed(2)})`, -tankCost]);
  lines.push([`Landing fee at ${to}`, -landing], [`Parking and gate at ${to}`, -parking]);
  if (hd) lines.push([ownHere ? `Handling by your own apron crew at ${to} (materials)` : `Handling by the local handling company at ${to}`, -hd]);
  if (nav) lines.push([`Air navigation charges, ${num(km)} km`, -nav]);
  for (const [part, share] of MX_SPLIT) lines.push([`Maintenance reserve: ${part.toLowerCase()}`, -Math.round(mx * share)]);
  if (sales) lines.push(['Ticket sales and booking fees', -sales]);
  if (catering) lines.push(['Catering', -catering]);
  if (svcCost) svc.extraLines.forEach(l => lines.push(l));
  lines.push(['Crew allowances and hotels', -crewTrip], ['Overheads: offices and IT', -overhead]);
  if (A2 && tankKg) { A2.tankKg = tankKg; A2.tankAt = tankNext; }
  try { bizEmissionLines(cid, from, to, burn, price, lines, !!x.book); } catch (e) { /* ignore */ }
  // difficulty: what flights earn and cost
  const dd = diff();
  if (dd.income !== 1 || dd.cost !== 1) for (const l of lines) l[1] = Math.round(l[1] * (l[1] > 0 ? dd.income : dd.cost));
  const revenue = lines.reduce((s, l) => s + Math.max(0, l[1]), 0), costs = -lines.reduce((s, l) => s + Math.min(0, l[1]), 0);
  return { revenue, costs, net: revenue - costs, lines, fare, fuelKg: burn };
}

function revenueBase(...v: number[]): number { return v.reduce((a, b) => a + b, 0); }

/* ---------- Ground services from GSX ----------
   With "I use GSX Pro" switched on and GSX running, each ground service is charged when GSX finishes it,
   at real-world ground handling rates for the size of aircraft. GSX itself has no prices, so the app
   prices what GSX actually did; without GSX the leg gets the app's standard handling and catering. */
const GSX_SERVICES: { key: string; name: string; price: { [cls: string]: number }; perPax?: { [cls: string]: number } }[] = [
  { key: 'boarding', name: 'Boarding (gate, jet bridge or stairs and buses)', price: { widebody: 520, airliner: 260, regional: 160, turboprop: 110, bush: 30, ga: 15 }, perPax: { widebody: 2.2, airliner: 1.8, regional: 1.6, turboprop: 1.5, bush: 0, ga: 0 } },
  { key: 'deboarding', name: 'Deboarding and bags', price: { widebody: 480, airliner: 240, regional: 150, turboprop: 100, bush: 30, ga: 15 }, perPax: { widebody: 2, airliner: 1.6, regional: 1.4, turboprop: 1.3, bush: 0, ga: 0 } },
  { key: 'catering', name: 'Catering service', price: { widebody: 1400, airliner: 380, regional: 220, turboprop: 120, bush: 0, ga: 0 }, perPax: { widebody: 14, airliner: 3.5, regional: 2.5, turboprop: 1.2, bush: 0, ga: 0 } },
  { key: 'refueling', name: 'Into-plane fuelling service', price: { widebody: 450, airliner: 220, regional: 160, turboprop: 120, bush: 60, ga: 35 } },
  { key: 'departure', name: 'Pushback and towing', price: { widebody: 650, airliner: 310, regional: 210, turboprop: 150, bush: 0, ga: 0 } },
  { key: 'deicing', name: 'De-icing (fluid and truck)', price: { widebody: 14000, airliner: 4200, regional: 2600, turboprop: 1800, bush: 450, ga: 250 } },
];
const _gsxDone: { [k: string]: boolean } = {};
let _gsxUsedThisLeg = false;

function gsxOnState(s: any, airport: string) {
  if (!s || !s.gsx || !s.gsx.running || !(State.settings as any).gsx) return;
  const a = plane((State as any).myReg[State.companyId]); if (!a) return;
  const t = acType(a.typeId), cls = t.cls, pax = (State as any).myLoad ? (State as any).myLoad.pax || 0 : 0;
  for (const sv of GSX_SERVICES) {
    const st = sv.key === 'boarding' ? s.gsx.boardingState : s.gsx[sv.key];
    if (st !== 6) { if (st && st < 5) _gsxDone[sv.key] = false; continue; }
    if (_gsxDone[sv.key]) continue;
    _gsxDone[sv.key] = true; _gsxUsedThisLeg = true;
    let pp = sv.perPax ? (sv.perPax[cls] || 0) * pax : 0; const base = sv.price[cls] || 0;
    // GSX's catering truck loads from your own storage: you pay their service, the food comes from stock
    if (sv.key === 'catering' && typeof cateringOn === 'function' && cateringOn()) { try { const lf: any = State.live.filter(x => x.you)[0]; if (!lf || !lf.catLoaded) { const pJF = Math.round(pax * 0.1), need = catNeed(pax - pJF, pJF, lf && lf.durMs ? lf.durMs / 60000 : 120), r = catLoad(lf, a.companyId, need); if (lf) lf.catStockUsd = r.stockUsd; pp *= 0.25; } } catch (e) { /* the usual charge */ } }
    const cost = Math.round(base + pp);
    if (!cost) continue;
    const c = company(), before = c.balance;
    c.balance -= cost;
    const lines: [string, number][] = [[`${sv.name}, ${t.model}`, -Math.round(base)]];
    if (pp) lines.push([`${pax} passengers`, -Math.round(pp)]);
    State.txns.unshift({ id: uid(), companyId: c.id, date: dateStr(new Date()).slice(0, 10), time: dateStr(new Date()).slice(11), kind: 'fees', label: `GSX: ${sv.name.split(' (')[0].toLowerCase().replace(/^./, x => x.toUpperCase())} at ${airport || '—'}`, amount: -cost, reg: a.reg, lines, link: { kind: 'aircraft', id: a.reg } } as any);
    try { animateBalance(before, c.balance); toast(`GSX ${sv.name.split(' (')[0].toLowerCase()}: ${money(-cost, { sign: true })}`, 'info'); } catch (e) { /* not ready */ }
    Store.soon();
  }
}
/** Whether GSX charged the ground services for the leg just flown (then the leg itself doesn't). */
function gsxTakeLegFlag(): boolean { const u = _gsxUsedThisLeg; _gsxUsedThisLeg = false; return u; }

/** Does the airline have its own apron crew (ground staff) at an airport? With "home base only",
 *  only at its main base. */
function ownApronCrewAt(cid: string, icao: string): boolean {
  const S: any = State, c = company(cid); if (!c) return false;
  if ((S.settings.groundHandling || 'base') === 'base' && !isBase(cid, icao)) return false;
  return groundCrewFree(cid, icao).length > 0;
}
