// Real-world airlines you can fly for, from the big network carriers to small island and bush operators.
// Names, codes and callsigns only identify the airlines; no logos or liveries are used, and the app
// isn't connected with or endorsed by any of them. Fleets use the aircraft available in the app that
// match what each airline flies (or its nearest equivalents).

interface RealAirline { name: string; icao: string; iata: string; callsign: string; country: string; hub: string; color: string; kind: 'major' | 'regional' | 'bush'; region: string; fleet: string[]; note: string }

const REAL_AIRLINES: RealAirline[] = ([
  // Nordic and North Atlantic
  ['Atlantic Airways', 'FLI', 'RC', 'FAROELINE', 'Faroe Islands', 'EKVG', '#1F4E9C', 'major', 'Nordic and North Atlantic', 'a320neo,a320-fenix', 'The Faroe Islands\' own airline, flying from Vágar to Scandinavia, Iceland and the UK.'],
  ['Icelandair', 'ICE', 'FI', 'ICEAIR', 'Iceland', 'BIKF', '#1B3B6F', 'major', 'Nordic and North Atlantic', 'b737-max8,b737-max9,a321lr,b738-pmdg,b78x', 'Transatlantic hub at Keflavík between Europe and North America.'],
  ['PLAY', 'FPY', 'OG', 'PLAY', 'Iceland', 'BIKF', '#E3002B', 'major', 'Nordic and North Atlantic', 'a320neo,a321neo', 'Low-cost flights over the North Atlantic through Keflavík.'],
  ['Air Greenland', 'GRL', 'GL', 'GREENLAND', 'Greenland', 'BGSF', '#C8102E', 'regional', 'Nordic and North Atlantic', 'dhc6-aero,atr72', 'Short runways, ice and long distances across Greenland.'],
  ['SAS Scandinavian Airlines', 'SAS', 'SK', 'SCANDINAVIAN', 'Denmark', 'EKCH', '#00205B', 'major', 'Nordic and North Atlantic', 'a320neo,a321lr,a350-ini,crj9-aero,atr72', 'Scandinavia\'s network airline, with hubs in Copenhagen, Oslo and Stockholm.'],
  ['Norwegian', 'NOZ', 'DY', 'NOR SHUTTLE', 'Norway', 'ENGM', '#D81939', 'major', 'Nordic and North Atlantic', 'b738-pmdg', 'All-737 low-cost airline across Norway and Europe.'],
  ['Widerøe', 'WIF', 'WF', 'WIDEROE', 'Norway', 'ENBO', '#2D8C3C', 'regional', 'Nordic and North Atlantic', 'atr72,dhc6-aero', 'Short-field turboprops up and down the Norwegian coast.'],
  ['Finnair', 'FIN', 'AY', 'FINNAIR', 'Finland', 'EFHK', '#0B1560', 'major', 'Nordic and North Atlantic', 'a320neo,a350-ini,atr72', 'Helsinki hub between Europe and Asia.'],
  ['Loganair', 'LOG', 'LM', 'LOGAN', 'United Kingdom', 'EGPF', '#1E3264', 'regional', 'Nordic and North Atlantic', 'atr72,dhc6-aero', 'Scottish island flying, including the shortest scheduled flight in the world.'],
  // Europe
  ['British Airways', 'BAW', 'BA', 'SPEEDBIRD', 'United Kingdom', 'EGLL', '#075AAA', 'major', 'Europe', 'a320-fenix,a320neo,b77w-pmdg,b78x,a350-ini', 'London Heathrow flag carrier, short and long haul.'],
  ['Lufthansa', 'DLH', 'LH', 'LUFTHANSA', 'Germany', 'EDDF', '#05164D', 'major', 'Europe', 'a320neo,a350-ini,b748,crj9-aero', 'Frankfurt hub, one of the last big 747-8 operators.'],
  ['Air France', 'AFR', 'AF', 'AIRFRANS', 'France', 'LFPG', '#002157', 'major', 'Europe', 'a320neo,b77w-pmdg,a350-ini,b78x', 'Paris Charles de Gaulle hub.'],
  ['KLM Royal Dutch Airlines', 'KLM', 'KL', 'KLM', 'Netherlands', 'EHAM', '#00A1DE', 'major', 'Europe', 'b738-pmdg,b77w-pmdg,b78x', 'The world\'s oldest airline still flying under its original name, from Amsterdam.'],
  ['Iberia', 'IBE', 'IB', 'IBERIA', 'Spain', 'LEMD', '#D7192D', 'major', 'Europe', 'a320neo,a350-ini', 'Madrid hub, strong across the South Atlantic.'],
  ['TAP Air Portugal', 'TAP', 'TP', 'AIR PORTUGAL', 'Portugal', 'LPPT', '#00A651', 'major', 'Europe', 'a320neo', 'Lisbon hub to Brazil, Africa and North America.'],
  ['ITA Airways', 'ITY', 'AZ', 'ITARROW', 'Italy', 'LIRF', '#1B2A6B', 'major', 'Europe', 'a320neo,a350-ini', 'Rome Fiumicino flag carrier.'],
  ['Aegean Airlines', 'AEE', 'A3', 'AEGEAN', 'Greece', 'LGAV', '#0A2B64', 'major', 'Europe', 'a320neo,atr72', 'Athens hub and the Greek islands.'],
  ['Turkish Airlines', 'THY', 'TK', 'TURKISH', 'Turkey', 'LTFM', '#C70A0C', 'major', 'Europe', 'a320neo,b738-pmdg,b77w-pmdg,a350-ini,b78x', 'Flies to more countries than any other airline, from Istanbul.'],
  ['Swiss International Air Lines', 'SWR', 'LX', 'SWISS', 'Switzerland', 'LSZH', '#E30613', 'major', 'Europe', 'a320neo,b77w-pmdg', 'Zurich hub.'],
  ['Austrian Airlines', 'AUA', 'OS', 'AUSTRIAN', 'Austria', 'LOWW', '#E2001A', 'major', 'Europe', 'a320-fenix,b77w-pmdg', 'Vienna hub to Central and Eastern Europe.'],
  ['Brussels Airlines', 'BEL', 'SN', 'BEE-LINE', 'Belgium', 'EBBR', '#0B2343', 'major', 'Europe', 'a320-fenix', 'Brussels hub with a big African network.'],
  ['Aer Lingus', 'EIN', 'EI', 'SHAMROCK', 'Ireland', 'EIDW', '#008374', 'major', 'Europe', 'a320neo', 'Dublin hub, Europe and transatlantic.'],
  ['Ryanair', 'RYR', 'FR', 'RYANAIR', 'Ireland', 'EIDW', '#073590', 'major', 'Europe', 'b738-pmdg', 'Europe\'s biggest low-cost airline, all 737s.'],
  ['easyJet', 'EZY', 'U2', 'EASY', 'United Kingdom', 'EGKK', '#FF6600', 'major', 'Europe', 'a320-fenix,a320neo', 'Low-cost A320 family flying all over Europe.'],
  ['Wizz Air', 'WZZ', 'W6', 'WIZZAIR', 'Hungary', 'LHBP', '#C6007E', 'major', 'Europe', 'a320neo', 'Ultra-low-cost, Central and Eastern Europe.'],
  // North America
  ['Delta Air Lines', 'DAL', 'DL', 'DELTA', 'United States', 'KATL', '#003366', 'major', 'North America', 'a320-fenix,b738-pmdg,a350-ini,crj9-aero', 'Atlanta, the world\'s busiest airport.'],
  ['United Airlines', 'UAL', 'UA', 'UNITED', 'United States', 'KORD', '#002244', 'major', 'North America', 'b738-pmdg,b77w-pmdg,b78x,crj7-aero', 'Chicago O\'Hare and a worldwide network.'],
  ['American Airlines', 'AAL', 'AA', 'AMERICAN', 'United States', 'KDFW', '#0078D2', 'major', 'North America', 'a320-fenix,b738-pmdg,b77w-pmdg,b78x,crj9-aero', 'Dallas/Fort Worth hub, the world\'s largest airline by fleet.'],
  ['Southwest Airlines', 'SWA', 'WN', 'SOUTHWEST', 'United States', 'KDAL', '#304CB2', 'major', 'North America', 'b738-pmdg,b736-pmdg', 'Point-to-point, all 737s.'],
  ['Alaska Airlines', 'ASA', 'AS', 'ALASKA', 'United States', 'KSEA', '#01426A', 'major', 'North America', 'b738-pmdg', 'Seattle hub, the West Coast and Alaska.'],
  ['JetBlue', 'JBU', 'B6', 'JETBLUE', 'United States', 'KJFK', '#0033A0', 'major', 'North America', 'a320-fenix,a320neo', 'New York JFK, the Caribbean and transatlantic.'],
  ['Air Canada', 'ACA', 'AC', 'AIR CANADA', 'Canada', 'CYYZ', '#D22630', 'major', 'North America', 'a320-fenix,b77w-pmdg,b78x,crj9-aero', 'Toronto Pearson hub.'],
  ['WestJet', 'WJA', 'WS', 'WESTJET', 'Canada', 'CYYC', '#00AAA5', 'major', 'North America', 'b738-pmdg,b78x', 'Calgary hub.'],
  ['Ravn Alaska', 'RVF', '7H', 'RAVN FLIGHT', 'United States', 'PANC', '#1C3F94', 'regional', 'Bush and regional', 'dhc6-aero,atr72,c208', 'Anchorage to towns across Alaska.'],
  ['Wright Air Service', 'WRF', '8V', 'WRIGHT FLYER', 'United States', 'PAFA', '#B5121B', 'bush', 'Bush and regional', 'c208,dhc6-aero', 'Fairbanks to villages in the Alaskan interior.'],
  ['Alaska Seaplanes', 'X4A', 'X4', 'SEAPLANE', 'United States', 'PAJN', '#0F6EA8', 'bush', 'Bush and regional', 'dhc2,c208,kodiak', 'Juneau to Southeast Alaska by float and wheel.'],
  ['Harbour Air', 'HES', 'H3', 'HARBOUR', 'Canada', 'CYHC', '#1E5AA8', 'bush', 'Bush and regional', 'dhc2,dhc6-aero', 'Floatplanes from downtown Vancouver.'],
  // Middle East, Asia and Oceania
  ['Emirates', 'UAE', 'EK', 'EMIRATES', 'United Arab Emirates', 'OMDB', '#D71921', 'major', 'Middle East', 'b77w-pmdg', 'Dubai hub, the world\'s biggest 777 operator.'],
  ['Qatar Airways', 'QTR', 'QR', 'QATARI', 'Qatar', 'OTHH', '#5C0632', 'major', 'Middle East', 'b77w-pmdg,a350-ini,b78x', 'Doha Hamad hub.'],
  ['Etihad Airways', 'ETD', 'EY', 'ETIHAD', 'United Arab Emirates', 'OMAA', '#BD8B13', 'major', 'Middle East', 'b78x,a350-ini,b77w-pmdg', 'Abu Dhabi hub.'],
  ['Singapore Airlines', 'SIA', 'SQ', 'SINGAPORE', 'Singapore', 'WSSS', '#1D2F6F', 'major', 'Asia', 'a350-ini,b77w-pmdg,b78x', 'Singapore Changi, including some of the longest flights in the world.'],
  ['Cathay Pacific', 'CPA', 'CX', 'CATHAY', 'Hong Kong', 'VHHH', '#006564', 'major', 'Asia', 'a350-ini,b77w-pmdg', 'Hong Kong hub.'],
  ['Japan Airlines', 'JAL', 'JL', 'JAPANAIR', 'Japan', 'RJTT', '#C8102E', 'major', 'Asia', 'b738-pmdg,b77w-pmdg,b78x,a350-ini', 'Tokyo Haneda and Narita.'],
  ['All Nippon Airways', 'ANA', 'NH', 'ALL NIPPON', 'Japan', 'RJTT', '#13448F', 'major', 'Asia', 'b78x,b77w-pmdg,a320neo', 'Tokyo Haneda, a big 787 operator.'],
  ['Korean Air', 'KAL', 'KE', 'KOREANAIR', 'South Korea', 'RKSI', '#00256C', 'major', 'Asia', 'b77w-pmdg,b748,b78x', 'Seoul Incheon hub.'],
  ['Air India', 'AIC', 'AI', 'AIRINDIA', 'India', 'VIDP', '#DA0E29', 'major', 'Asia', 'b77w-pmdg,b78x,a320neo', 'Delhi hub.'],
  ['IndiGo', 'IGO', '6E', 'IFLY', 'India', 'VIDP', '#001B94', 'major', 'Asia', 'a320neo,atr72', 'India\'s biggest airline, A320neos and ATRs.'],
  ['Qantas', 'QFA', 'QF', 'QANTAS', 'Australia', 'YSSY', '#E40000', 'major', 'Oceania', 'b738-pmdg,b78x', 'Sydney hub, Australia and the world.'],
  ['Air New Zealand', 'ANZ', 'NZ', 'NEW ZEALAND', 'New Zealand', 'NZAA', '#00274D', 'major', 'Oceania', 'a320neo,b78x,atr72', 'Auckland hub.'],
  // Latin America
  ['LATAM Airlines', 'LAN', 'LA', 'LAN CHILE', 'Chile', 'SCEL', '#1B0088', 'major', 'Latin America', 'a320-fenix,b78x', 'Santiago hub, all of South America.'],
  ['Avianca', 'AVA', 'AV', 'AVIANCA', 'Colombia', 'SKBO', '#DA291C', 'major', 'Latin America', 'a320neo,b78x', 'Bogotá hub.'],
  ['Copa Airlines', 'CMP', 'CM', 'COPA', 'Panama', 'MPTO', '#0E3B83', 'major', 'Latin America', 'b738-pmdg', 'Panama City hub of the Americas.'],
] as any[]).map(r => ({ name: r[0], icao: r[1], iata: r[2], callsign: r[3], country: r[4], hub: r[5], color: r[6], kind: r[7], region: r[8], fleet: r[9].split(','), note: r[10] }));

let _alQuery = '', _alRegion = 'all';

function realAirlinePicker() {
  closeAll();
  openLayer('modal', `<div class="modal-head"><div><h2>Fly for a real airline</h2><small>Join a real-world airline as one of its pilots. You start at its home base with part of its fleet.</small></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
    <div class="al-search"><input class="le-in" data-al-q placeholder="Search by name, code or country" value="${esc(_alQuery)}" autocomplete="off"></div>
    <div class="al-regions">${['all'].concat(Array.from(new Set(REAL_AIRLINES.map(a => a.region)))).map(r => `<button class="fchip ${_alRegion === r ? 'on' : ''}" data-act="al-region" data-r="${esc(r)}">${r === 'all' ? 'All' : esc(r)}</button>`).join('')}</div>
    <div class="al-list" data-al-list>${realAirlineList()}</div>
    <p class="fine-print">${icon('info')}Airline names and codes are used only to identify the airlines. ${esc(APP.name)} isn't connected with or endorsed by any of them.</p>`, { cls: 'wide' });
  const q = $('[data-al-q]') as HTMLInputElement;
  if (q) q.addEventListener('input', () => { _alQuery = q.value; const l = $('[data-al-list]'); if (l) l.innerHTML = realAirlineList(); });
}
function realAirlineList(): string {
  const q = _alQuery.trim().toLowerCase();
  const list = REAL_AIRLINES.filter(a => (_alRegion === 'all' || a.region === _alRegion) && (!q || (a.name + ' ' + a.icao + ' ' + a.iata + ' ' + a.country + ' ' + a.callsign).toLowerCase().indexOf(q) >= 0));
  if (!list.length) return `<p class="muted">No airline found. Try another name or code.</p>`;
  return list.map(a => `<button class="al-row" data-act="al-pick" data-icao="${esc(a.icao)}">
      <span class="al-code" style="--c:${a.color}">${esc(a.iata)}</span>
      <span class="al-txt"><b>${esc(a.name)}</b><small>${esc(a.country)} · hub ${esc(a.hub)} · ${a.fleet.map(id => esc(acType(id).model)).join(', ')}</small><small>${esc(a.note)}</small></span>
      ${icon('chevron')}</button>`).join('');
}
ACTIONS['al-region'] = el => { _alRegion = el.getAttribute('data-r'); Sound.tick(); $all('.al-regions .fchip').forEach(b => b.classList.toggle('on', b.getAttribute('data-r') === _alRegion)); const l = $('[data-al-list]'); if (l) l.innerHTML = realAirlineList(); };
ACTIONS['al-pick'] = el => {
  const a = REAL_AIRLINES.filter(x => x.icao === el.getAttribute('data-icao'))[0]; if (!a) return;
  if (State.companies.some(c => c.icao === a.icao)) { toast(`You already fly for ${a.name}`, 'info'); return; }
  const id = uid(), cur = company(), prof = profileOfCompany(cur.id);
  const regPrefix: { [c: string]: string } = { 'Faroe Islands': 'OY-', Denmark: 'OY-', Iceland: 'TF-', Greenland: 'OY-', Norway: 'LN-', Sweden: 'SE-', Finland: 'OH-', 'United Kingdom': 'G-', Germany: 'D-', France: 'F-', Netherlands: 'PH-', Spain: 'EC-', Portugal: 'CS-', Italy: 'EI-', Greece: 'SX-', Turkey: 'TC-', Switzerland: 'HB-', Austria: 'OE-', Belgium: 'OO-', Ireland: 'EI-', Hungary: 'HA-', 'United States': 'N', Canada: 'C-', 'United Arab Emirates': 'A6-', Qatar: 'A7-', Singapore: '9V-', 'Hong Kong': 'B-', Japan: 'JA', 'South Korea': 'HL', India: 'VT-', Australia: 'VH-', 'New Zealand': 'ZK-', Chile: 'CC-', Colombia: 'HK-', Panama: 'HP-' };
  const pre = regPrefix[a.country] || 'X-';
  State.companies.push({ id, profileId: prof.id, name: a.name, icao: a.icao, callsign: a.callsign, hub: a.hub, color: a.color, color2: '#0B1A2E', balance: a.kind === 'bush' ? 2500000 : a.kind === 'regional' ? 20000000 : 150000000,
    reputation: 70, founded: dateStr(new Date()).slice(0, 10), kind: a.kind, divisions: [], real: true } as any);
  // part of the airline's fleet, based at its hub
  const regs: string[] = [];
  a.fleet.forEach((tid, i) => {
    const n = a.kind === 'major' ? (i === 0 ? 3 : 1) : 2;
    for (let k = 0; k < n; k++) {
      let reg = '', k2 = regs.length;
      do {
        const L = (n: number) => String.fromCharCode(65 + (n % 26));
        const h = _hashStr(a.icao + k2);
        reg = pre === 'N' ? 'N' + (101 + k2) + a.iata.replace(/[^A-Z]/g, '').slice(0, 2)
          : /^(JA|HL)$/.test(pre) ? pre + (8100 + k2) : pre + L(h) + L(h >> 5) + L(h >> 10);
        k2++;
      } while (plane(reg) || regs.indexOf(reg) >= 0);
      regs.push(reg);
      State.fleet.push({ engine: engineFor(tid, reg) || undefined, reg, typeId: tid, companyId: id, base: a.hub, location: a.hub, hoursMin: Math.round((3000 + Math.random() * 20000) * 60), cycles: Math.round(2000 + Math.random() * 12000), condition: Math.round(78 + Math.random() * 18), status: 'parked', delivered: dateStr(new Date()).slice(0, 10), built: new Date().getFullYear() - Math.round(2 + Math.random() * 14) } as any);
    }
  });
  (State as any).coPilot[id] = { sex: Math.random() < 0.5 ? 'f' : 'm', id: '' };
  State.myReg[id] = regs[0];
  const me: any = myPilot(); if (me) a.fleet.forEach(t => { if ((me.types || []).indexOf(t) < 0) (me.types = me.types || []).push(t); });
  State.companyId = id; State.divisionId = 'all';
  closeAll(); applyCompanyTheme(true); Store.save(); go('ops'); renderTopbar();
  toast(`Welcome to ${a.name}. You're based at ${a.hub} and fly the ${acType(a.fleet[0]).model}.`, 'ok');
};
