// On-board and ground services: what each airline offers its passengers. Every choice changes what the
// airline earns and pays per flight, how many people choose it, and how passengers rate the trip.
// Small aircraft (bush and GA) have no cabin service; long flights always serve at least a snack.

interface SvcOpt { id: string; label: string; hint: string }
interface SvcDef { key: string; title: string; icon: string; opts: SvcOpt[]; def: string }

const SERVICES: SvcDef[] = [
  { key: 'food', title: 'Food', icon: 'pax', def: 'bob', opts: [
    { id: 'bob', label: 'Buy on board', hint: 'Passengers buy snacks and meals. Cheapest; earns on sales.' },
    { id: 'snack', label: 'Free snack', hint: 'A snack and a soft drink included.' },
    { id: 'meal', label: 'Free meals', hint: 'Hot meals on longer flights, included in the fare.' },
    { id: 'chef', label: 'Chef menu', hint: 'Free meals, and a chef-designed menu in business and first.' }] },
  { key: 'drinks', title: 'Drinks', icon: 'pax', def: 'paid', opts: [
    { id: 'paid', label: 'Paid', hint: 'Water free, everything else sold.' },
    { id: 'soft', label: 'Free soft drinks', hint: 'Coffee, tea, juice and soft drinks included.' },
    { id: 'all', label: 'All included', hint: 'Also beer and wine.' }] },
  { key: 'specialMeals', title: 'Special meals', icon: 'pax', def: 'yes', opts: [
    { id: 'no', label: 'None', hint: '' },
    { id: 'yes', label: 'On request', hint: 'Vegetarian, vegan, halal, kosher, gluten-free and children\'s meals, ordered with the ticket.' }] },
  { key: 'wifi', title: 'Wi-Fi', icon: 'wifi', def: 'none', opts: [
    { id: 'none', label: 'None', hint: '' },
    { id: 'paid', label: 'Paid', hint: 'Passengers pay per flight.' },
    { id: 'free', label: 'Free', hint: 'Free messaging and browsing for everyone.' }] },
  { key: 'ife', title: 'Entertainment', icon: 'play', def: 'none', opts: [
    { id: 'none', label: 'None', hint: '' },
    { id: 'stream', label: 'To own devices', hint: 'Films and shows streamed to passengers\' phones and tablets.' },
    { id: 'seatback', label: 'Seat-back screens', hint: 'A screen in every seat. Costly; long-haul travellers love it.' }] },
  { key: 'comfort', title: 'Comfort', icon: 'star', def: 'basic', opts: [
    { id: 'basic', label: 'Basic', hint: '' },
    { id: 'kits', label: 'Blankets and kits', hint: 'Pillows, blankets, and amenity kits on long flights.' }] },
  { key: 'dutyFree', title: 'Duty-free sales', icon: 'finance', def: 'yes', opts: [
    { id: 'no', label: 'No', hint: '' },
    { id: 'yes', label: 'Yes', hint: 'On international flights.' }] },
  { key: 'bags', title: 'Checked bag', icon: 'jobs', def: 'paid', opts: [
    { id: 'paid', label: 'Paid', hint: 'A fee per checked bag.' },
    { id: 'incl', label: 'Included', hint: 'One checked bag in every fare.' }] },
  { key: 'seats', title: 'Seat selection', icon: 'pax', def: 'paid', opts: [
    { id: 'paid', label: 'Paid', hint: '' },
    { id: 'free', label: 'Free', hint: '' }] },
  { key: 'priority', title: 'Priority boarding', icon: 'clock', def: 'premium', opts: [
    { id: 'none', label: 'None', hint: '' },
    { id: 'premium', label: 'Business and first', hint: 'Priority check-in, security and boarding.' },
    { id: 'sold', label: 'Also sold', hint: 'Economy passengers can buy it too.' }] },
  { key: 'lounge', title: 'Lounge at the home base', icon: 'key', def: 'no', opts: [
    { id: 'no', label: 'No', hint: '' },
    { id: 'yes', label: 'Yes', hint: 'Business and first class passengers wait in your lounge.' }] },
  { key: 'pets', title: 'Pets', icon: 'pax', def: 'cabin', opts: [
    { id: 'no', label: 'Not allowed', hint: 'Assistance dogs only.' },
    { id: 'cabin', label: 'In the cabin', hint: 'Small dogs and cats in a carrier under the seat in front.' },
    { id: 'hold', label: 'Cabin and hold', hint: 'Bigger pets travel in the heated hold where the aircraft has one.' }] },
];

function servicesOf(cid?: string): { [k: string]: string } {
  const c: any = company(cid || State.companyId);
  if (!c.services) { c.services = {}; }
  const out: any = {};
  SERVICES.forEach(s => out[s.key] = c.services[s.key] || s.def);
  return out;
}

/** What the services mean on one flight: money, demand and a 0–100 score passengers feel. */
function serviceEffects(cid: string, cls: string, nm: number, intl: boolean, pY: number, pP: number): {
  onboard: number; bags: number; cateringMul: number; cateringPrem: number; extraCost: number; extraLines: [string, number][]; demand: number; score: number } {
  const s = servicesOf(cid), small = cls === 'bush' || cls === 'ga', long = nm > 2000, mid = nm > 700;
  const pax = pY + pP, lines: [string, number][] = [];
  if (small) return { onboard: 0, bags: 0, cateringMul: 1, cateringPrem: 1, extraCost: 0, extraLines: [], demand: 1, score: 60 };
  // on-board sales: what passengers buy; less when food and drinks are included
  const food = s.food, drinks = s.drinks;
  let sales = pY * (long ? 3.5 : cls === 'turboprop' ? 2.5 : 6.5);
  if (food !== 'bob') sales *= 0.45; if (drinks === 'soft') sales *= 0.75; if (drinks === 'all') sales *= 0.4;
  let onboard = sales;
  if (s.dutyFree === 'yes' && intl) onboard += pax * (long ? 4.2 : 1.6);
  if (s.wifi === 'paid') onboard += pax * (long ? 2.8 : mid ? 1.1 : 0.4);
  if (s.priority === 'sold') onboard += pY * 0.9;
  // bags and seats
  let bags = 0;
  if (s.bags === 'paid') bags += pY * (long ? 6.5 : 5);
  if (s.seats === 'paid') bags += pY * (long ? 2.5 : 2);
  bags += pax * petFeePerPax(s.pets);   // pet tickets
  // catering cost: buy-on-board stock is cheap, included food costs more, a chef menu more again up front
  const cateringMul = (food === 'bob' ? (long ? 0.7 : 0.45) : food === 'snack' ? 1 : (long ? 1.15 : 2.2)) * (drinks === 'all' ? 1.25 : drinks === 'soft' ? 1.1 : 1);
  const cateringPrem = food === 'chef' ? 1.6 : 1;
  const bh = nm / 430 + 0.4;
  if (s.specialMeals === 'yes' && food !== 'bob') lines.push(['Special meals on request', -Math.round(pax * 0.4)]);
  if (s.wifi !== 'none') lines.push([`Wi-Fi (${s.wifi === 'free' ? 'free for everyone' : 'paid'})`, -Math.round(45 + bh * 38)]);
  if (s.ife === 'stream') lines.push(['Entertainment streamed to devices', -Math.round(18 + bh * 12)]);
  if (s.ife === 'seatback') lines.push(['Seat-back entertainment', -Math.round(pax * 0.9 + bh * 40)]);
  if (s.comfort === 'kits' && (long || mid)) lines.push(['Blankets, pillows and amenity kits', -Math.round(pY * (long ? 2.6 : 0.8) + pP * (long ? 18 : 5))]);
  if (s.lounge === 'yes' && pP) lines.push(['Lounge for business and first class', -Math.round(pP * 22)]);
  if (s.priority !== 'none') lines.push(['Priority lanes and boarding', -Math.round(20 + pP * 1)]);
  const extraCost = lines.reduce((a, l) => a - l[1], 0);
  // how attractive the airline is: each service weighs more on longer flights
  const w = long ? 1.6 : mid ? 1 : 0.6;
  let pts = 0;
  pts += ({ bob: 0, snack: 2, meal: 4, chef: 5 } as any)[food] * w;
  pts += ({ paid: 0, soft: 1.5, all: 2.5 } as any)[drinks] * w;
  pts += s.specialMeals === 'yes' ? 0.5 : 0;
  pts += ({ none: 0, paid: 1, free: 3 } as any)[s.wifi] * w;
  pts += ({ none: 0, stream: 1.5, seatback: 3.5 } as any)[s.ife] * w;
  pts += s.comfort === 'kits' ? 1.5 * w : 0;
  pts += s.bags === 'incl' ? 3 : 0;
  pts += s.seats === 'free' ? 1.5 : 0;
  pts += s.priority !== 'none' ? 0.5 : 0;
  pts += s.lounge === 'yes' ? 1 : 0;
  pts += s.pets !== 'no' ? 0.5 : 0;
  // fully no-frills short haul is normal; fully no-frills long haul puts people off
  // the cabin crew make the service: well-paid, happy, experienced crew lift it; cheap, unhappy crew drag it down
  const fas = typeof staffOf === 'function' ? staffOf(cid, 'fa').filter((p: any) => !p.onStrike) : [];
  const crewQ = fas.length ? fas.reduce((a2: number, p: any) => a2 + workRating(p), 0) / fas.length : 4;
  pts += (crewQ - 4) * 4;
  const expect = long ? 9 : mid ? 4 : 2;
  const demand = clamp(1 + (pts - expect) * 0.008, 0.88, 1.1);
  const score = Math.round(clamp(50 + (pts - expect) * 4, 10, 100));
  return { onboard: Math.round(onboard), bags: Math.round(bags), cateringMul, cateringPrem, extraCost, extraLines: lines, demand, score };
}

/** Settings → Services, for the airline in use. */
function servicesHtml(): string {
  const c = company(), s = servicesOf(c.id);
  if (c.kind === 'bush') return `<p class="fine-print">${icon('info')}${esc(c.name)} flies small aircraft without cabin service. Pets can still come along.</p>` + svcRow(SERVICES.filter(x => x.key === 'pets')[0], s);
  const e = serviceEffects(c.id, 'airliner', 1200, true, 150, 12), el = serviceEffects(c.id, 'widebody', 4500, true, 280, 40);
  return `<p class="fine-print">${icon('info')}What ${esc(c.name)} offers its passengers. More service costs more per flight, brings more passengers, and better ratings; long-haul passengers expect the most.</p>
    <div class="svc-sum"><span><small>Passengers' view, medium haul</small><b>${e.score}/100</b></span><span><small>Long haul</small><b>${el.score}/100</b></span><span><small>Demand effect</small><b>${e.demand >= 1 ? '+' : ''}${Math.round((e.demand - 1) * 100)}% · ${el.demand >= 1 ? '+' : ''}${Math.round((el.demand - 1) * 100)}%</b></span></div>`
    + SERVICES.map(d => svcRow(d, s)).join('');
}
function svcRow(d: SvcDef, s: any): string {
  const cur = d.opts.filter(o => o.id === s[d.key])[0] || d.opts[0];
  return `<div class="ch-row"><span><b>${esc(d.title)}</b><small>${esc(cur.hint)}</small></span><div class="seg">${d.opts.map(o => `<button class="${s[d.key] === o.id ? 'on' : ''}" data-act="svc-set" data-k="${d.key}" data-v="${o.id}">${esc(o.label)}</button>`).join('')}</div></div>`;
}
ACTIONS['svc-set'] = el => {
  if (typeof coopOn === 'function' && coopOn() && !coopCanBuy()) { toast('In this co-op only the owner changes the airline\'s services', 'warn'); return; }
  const c: any = company(); c.services = c.services || {};
  c.services[el.getAttribute('data-k')] = el.getAttribute('data-v');
  Store.save(); Sound.tick(); rerenderSettingsBody();
};
