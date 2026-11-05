// Crew: nationalities, names, ages, staff generation and real-world crew requirements.

interface Staff {
  id: string; name: string; role: CrewRole; sex: 'm' | 'f'; look: Look; dob: string; nat: string;
  companyId: string; base: string; salary: number; hired: string; warnings: number; rating: number; xp?: number;
  status: 'on duty' | 'off' | 'resting';
}
interface Incident { id: string; staffId: string; title: string; text: string; date: string; status: 'open' | 'disciplined' | 'dismissed'; sev?: 'light' | 'moderate' | 'severe' }

// ISO 3166 country codes. Names come from the device's language data, flags from the code.
const COUNTRY_CODES = ('AF AL DZ AD AO AG AR AM AU AT AZ BS BH BD BB BY BE BZ BJ BT BO BA BW BR BN BG BF BI CV KH CM CA CF TD CL CN CO KM CG CD CR CI HR CU CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FO FJ FI FR GA GM GE DE GH GR GL GD GT GN GW GY HT HN HK HU IS IN ID IR IQ IE IL IT JM JP JO KZ KE KI KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MR MU MX FM MD MC MN ME MA MZ MM NA NR NP NL NZ NI NE NG KP MK NO OM PK PW PS PA PG PY PE PH PL PT PR QA RO RU RW KN LC VC WS SM ST SA SN RS SC SL SG SK SI SB SO ZA KR SS ES LK SD SR SE CH SY TW TJ TZ TH TL TG TO TT TN TR TM TV UG UA AE GB US UY UZ VU VA VE VN YE ZM ZW').split(' ');

let _regionNames: any = null;
function countryName(code: string): string {
  try {
    if (!_regionNames && (Intl as any).DisplayNames) _regionNames = new (Intl as any).DisplayNames(['en'], { type: 'region' });
    if (_regionNames) return _regionNames.of(code);
  } catch (e) { /* fall through */ }
  return code;
}
function flag(code: string): string {
  return code.toUpperCase().replace(/./g, ch => String.fromCodePoint(127397 + ch.charCodeAt(0)));
}
function countriesSorted(): string[][] {
  return COUNTRY_CODES.map(c => [c, countryName(c)]).sort((a, b) => a[1].localeCompare(b[1]));
}

// Name pools used for generated staff
const NAMES: { [nat: string]: { m: string[]; f: string[]; last: string[] } } = {
  FO: { m: ['Jóannes', 'Rógvi', 'Bárður', 'Heðin', 'Sámal', 'Óli'], f: ['Rakul', 'Guðrun', 'Sólja', 'Elin', 'Marjun', 'Turið'], last: ['Joensen', 'Hansen', 'Jacobsen', 'Poulsen', 'Olsen', 'Dam', 'Petersen'] },
  DK: { m: ['Mads', 'Frederik', 'Rasmus', 'Søren', 'Anders'], f: ['Freja', 'Ida', 'Mette', 'Signe', 'Line'], last: ['Nielsen', 'Jensen', 'Larsen', 'Kristensen', 'Holm'] },
  NO: { m: ['Henrik', 'Lars', 'Eirik', 'Ola'], f: ['Ingrid', 'Sigrid', 'Nora', 'Kari'], last: ['Berg', 'Haugen', 'Solberg', 'Lie', 'Dahl'] },
  SE: { m: ['Erik', 'Johan', 'Oskar'], f: ['Hanna', 'Elsa', 'Maja'], last: ['Lindqvist', 'Andersson', 'Nyström', 'Ek'] },
  IS: { m: ['Gunnar', 'Einar', 'Bjarki'], f: ['Katla', 'Sóley', 'Hildur'], last: ['Jónsson', 'Gunnarsdóttir', 'Sigurðsson', 'Einarsdóttir'] },
  GB: { m: ['James', 'Oliver', 'Callum', 'Rhys'], f: ['Emily', 'Charlotte', 'Amelia', 'Grace'], last: ['Smith', 'Walker', 'Patel', 'Hughes', 'Campbell'] },
  IE: { m: ['Conor', 'Seán'], f: ['Aoife', 'Niamh'], last: ['Murphy', 'O\'Brien', 'Byrne'] },
  DE: { m: ['Lukas', 'Jonas', 'Felix'], f: ['Lena', 'Anna', 'Sophie'], last: ['Müller', 'Schmidt', 'Becker', 'Wagner'] },
  NL: { m: ['Daan', 'Sem'], f: ['Fleur', 'Sanne'], last: ['de Vries', 'Bakker', 'Visser'] },
  FR: { m: ['Hugo', 'Louis', 'Théo'], f: ['Camille', 'Léa', 'Chloé'], last: ['Martin', 'Bernard', 'Dubois', 'Moreau'] },
  ES: { m: ['Pablo', 'Javier'], f: ['Lucía', 'Carmen'], last: ['García', 'Fernández', 'López'] },
  IT: { m: ['Marco', 'Luca', 'Matteo'], f: ['Giulia', 'Chiara'], last: ['Rinaldi', 'Rossi', 'Bianchi', 'Esposito'] },
  PL: { m: ['Piotr', 'Kacper'], f: ['Dana', 'Zofia', 'Magda'], last: ['Kowalczyk', 'Nowak', 'Wiśniewska'] },
  PT: { m: ['Tiago', 'Rui'], f: ['Inês', 'Beatriz'], last: ['Silva', 'Costa', 'Ferreira'] },
  US: { m: ['Michael', 'Tyler', 'Marcus', 'Daniel'], f: ['Ashley', 'Jasmine', 'Megan', 'Kayla'], last: ['Johnson', 'Williams', 'Brown', 'Davis', 'Rivera'] },
  CA: { m: ['Tom', 'Liam', 'Noah'], f: ['Chloe', 'Maya'], last: ['Whitehorse', 'Tremblay', 'Roy', 'MacDonald'] },
  NG: { m: ['Chinedu', 'Tunde', 'Emeka'], f: ['Adaeze', 'Ngozi', 'Funmi'], last: ['Okafor', 'Adeyemi', 'Eze'] },
  GH: { m: ['Kwame', 'Kofi'], f: ['Ama', 'Akosua'], last: ['Mensah', 'Owusu', 'Boateng'] },
  KE: { m: ['Brian', 'David'], f: ['Wanjiru', 'Akinyi'], last: ['Otieno', 'Kamau', 'Mwangi'] },
  ZA: { m: ['Sipho', 'Thabo'], f: ['Lerato', 'Zanele'], last: ['Dlamini', 'Nkosi', 'van der Merwe'] },
  IN: { m: ['Ravi', 'Arjun', 'Vikram'], f: ['Priya', 'Ananya', 'Kavya'], last: ['Menon', 'Sharma', 'Iyer', 'Reddy'] },
  PK: { m: ['Ahmed', 'Bilal'], f: ['Ayesha', 'Fatima'], last: ['Khan', 'Qureshi'] },
  PH: { m: ['Jose', 'Mark'], f: ['Maria', 'Angela'], last: ['Santos', 'Reyes', 'Cruz'] },
  JP: { m: ['Haruto', 'Kenji', 'Ren'], f: ['Yui', 'Sakura', 'Aoi'], last: ['Sato', 'Tanaka', 'Suzuki'] },
  KR: { m: ['Minjun', 'Jiho'], f: ['Seoyeon', 'Jiwoo'], last: ['Kim', 'Park', 'Lee'] },
  CN: { m: ['Wei', 'Hao'], f: ['Mei', 'Lin'], last: ['Wang', 'Zhang', 'Chen'] },
  VN: { m: ['Minh', 'Duc'], f: ['Lan', 'Thu'], last: ['Nguyen', 'Tran', 'Pham'] },
  BR: { m: ['Lucas', 'Gabriel'], f: ['Ana', 'Larissa'], last: ['Souza', 'Oliveira', 'Santos'] },
  MX: { m: ['Luis', 'Diego'], f: ['Sofía', 'Valeria'], last: ['Ortega', 'Hernández', 'Ramírez'] },
  TR: { m: ['Emre', 'Can'], f: ['Elif', 'Zeynep'], last: ['Yılmaz', 'Demir', 'Kaya'] },
  EG: { m: ['Omar', 'Youssef'], f: ['Nour', 'Mariam'], last: ['Hassan', 'Mahmoud'] },
  MA: { m: ['Yassine', 'Hamza'], f: ['Salma', 'Imane'], last: ['El Amrani', 'Benali'] },
  AU: { m: ['Jack', 'Lachlan'], f: ['Isla', 'Ruby'], last: ['Thompson', 'Kelly', 'Mitchell'] },
  NZ: { m: ['Nikau', 'Sam'], f: ['Aroha', 'Mia'], last: ['Ngata', 'Wilson'] },
};
const NAT_SKIN: { [n: string]: number[] } = {
  NG: [7, 9], GH: [7, 9], KE: [7, 9], ZA: [3, 9], IN: [4, 7], PK: [3, 6], PH: [3, 5], JP: [0, 3], KR: [0, 3], CN: [0, 3], VN: [1, 4],
  BR: [1, 8], MX: [2, 6], TR: [1, 4], EG: [3, 6], MA: [3, 6], US: [0, 9], GB: [0, 8], CA: [0, 8], AU: [0, 7], NZ: [0, 6], FR: [0, 8],
};
const NAT_FOR_HUB: { [hub: string]: string[] } = {
  EKVG: ['FO', 'FO', 'FO', 'DK', 'IS', 'NO', 'GB', 'PH', 'NG', 'IN', 'PL'],
  EKCH: ['DK', 'DK', 'SE', 'NO', 'DE', 'GB', 'PL', 'IN', 'KE', 'IT', 'ES', 'TR'],
  EKBI: ['DK', 'DK', 'DE', 'NL', 'PL', 'PT'],
  PALH: ['US', 'US', 'CA', 'MX', 'PH', 'KR', 'NZ'],
};

function _hash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function seeded(seed: string) { let h = _hash(seed) || 1; return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; }; }

function makePerson(seed: string, role: CrewRole, companyId: string, base: string, sexIn?: 'm' | 'f', natIn?: string): Staff {
  const r = seeded(seed);
  const pick = <T>(a: T[]): T => a[Math.floor(r() * a.length)];
  const sex: 'm' | 'f' = sexIn || (r() < (role === 'fa' ? 0.65 : role === 'mech' ? 0.25 : role === 'ground' ? 0.3 : 0.3) ? 'f' : 'm');
  const nat = natIn || pick(NAT_FOR_HUB[base] || Object.keys(NAMES));
  const pool = NAMES[nat] || NAMES.GB;
  // patronymic surnames follow the person: -son/-sson for men, -dóttir for women (Iceland, the Faroes)
  const lasts = pool.last.filter(l => sex === 'f' ? !/sson$|son$/.test(l) || !pool.last.some(x => /dóttir$/.test(x)) : !/dóttir$/.test(l));
  const name = pick(sex === 'f' ? pool.f : pool.m) + ' ' + pick(lasts.length ? lasts : pool.last);
  const look = randomLook(seed, sex, role);
  if (role === 'ground') look.uniform = 6 + Math.floor(r() * 2);   // hi-vis yellow or orange
  const range = NAT_SKIN[nat] || [0, 4];
  look.skin = range[0] + Math.floor(r() * (range[1] - range[0] + 1));
  if (look.skin > 5 && [4, 5, 6, 7].indexOf(look.hairColor) >= 0) look.hairColor = 0;
  const age = role === 'captain' ? 34 + r() * 24 : role === 'fo' ? 24 + r() * 16 : 21 + r() * 30;
  const y = 2026 - Math.floor(age), m = 1 + Math.floor(r() * 12), d = 1 + Math.floor(r() * 28);
  if (age < 45 && look.hairColor >= 8) look.hairColor = look.skin > 5 ? 0 : 2;
  const salary = (typeof goingRate === 'function' ? goingRate({ xp: 0 }, role, base, companyId || undefined) : ({ captain: 2900, fo: 1500, fa: 620, mech: 1100, ground: 560 } as any)[role]) * (0.9 + r() * 0.25);
  return {
    id: role + '-' + _hash(seed).toString(36), name, role, sex, look, dob: `${y}-${m < 10 ? '0' : ''}${m}-${d < 10 ? '0' : ''}${d}`, nat,
    companyId, base, salary: Math.round(salary / 10) * 10, hired: '2026-09-' + (10 + Math.floor(r() * 18)), warnings: 0, rating: 3.6 + r() * 1.4,
    status: pick(['on duty', 'on duty', 'off', 'resting'] as any),
    xp: startingXp(seed, role, age),
    job: role === 'ground' ? GROUND_JOBS[Math.floor(r() * GROUND_JOBS.length)][0] : undefined,
    winch: role === 'fa' && seeded(seed + 'winch')() < 0.22 ? true : undefined,   // some cabin crew are trained rescue winch operators
  } as any;
}

/** Fill in everything people-related that a save from an older version doesn't have yet. */
function ensurePeople() {
  const S: any = State;
  if (!S.staff) {
    S.staff = [];
    const add = (co: string, role: CrewRole, n: number, bases: string[]) => {
      for (let i = 0; i < n; i++) S.staff.push(makePerson(`${co}-${role}-${i}`, role, co, bases[i % bases.length]));
    };
    add('atn', 'fa', 28, ['EKVG', 'EKCH']); add('atn', 'mech', 24, ['EKVG', 'EKCH']);
    add('ndc', 'fa', 3, ['EKBI']); add('ndc', 'mech', 3, ['EKBI']);
    add('rba', 'mech', 2, ['PALH']);
    add('atn', 'ground', 16, ['EKVG', 'EKCH']); add('ndc', 'ground', 4, ['EKBI']); add('rba', 'ground', 2, ['PALH']);
  }
  if (!S.staffCandidates) {
    S.staffCandidates = [];
    const roles: CrewRole[] = ['fa', 'fa', 'fa', 'fa', 'mech', 'mech', 'mech', 'fo', 'fo', 'fa', 'mech', 'fa', 'ground', 'ground', 'ground', 'ground'];
    roles.forEach((role, i) => S.staffCandidates.push(makePerson('cand-' + role + i, role, '', ['EKVG', 'EKCH', 'PALH', 'EKBI'][i % 4])));
  }
  if (!S.incidents) {
    const fa = S.staff.filter((x: Staff) => x.role === 'fa' && x.companyId === 'atn')[3];
    S.incidents = [{ id: 'inc1', staffId: fa.id, title: 'Late for duty', text: `${fa.name} arrived 40 minutes late for the morning briefing at ${fa.base}, and the departure was delayed by 15 minutes.`, date: '2026-10-28', status: 'open' }];
    S.notices.unshift({ id: 'n-inc1', kind: 'staff', title: `Conduct report: ${fa.name}`, body: 'Late for duty, departure delayed. Discipline or dismiss.', time: '09:12', read: false, ref: 'inc1' });
  }
  if (!S.coPilot) S.coPilot = { atn: { sex: 'f', id: '' }, ndc: { sex: 'm', id: '' }, rba: { sex: 'm', id: '' } };
  if (!S.birthdayGreeted) S.birthdayGreeted = {};
  if (!S.simDate) S.simDate = '2030-05-14';
  // pilots: identity and looks
  const pilotInfo: { [id: string]: [string, string] } = {
    'you': ['m', 'FO'], 'you2': ['m', 'FO'], 'p-hl': ['f', 'SE'], 'p-jo': ['m', 'FO'], 'p-mr': ['m', 'IT'], 'p-sb': ['f', 'NO'], 'p-dk': ['f', 'PL'], 'p-tw': ['m', 'CA'],
    'c1': ['f', 'NO'], 'c2': ['m', 'IN'], 'c3': ['f', 'IS'], 'c4': ['m', 'MX'],
  };
  const today = new Date();
  const mm = today.getMonth() + 1, dd = today.getDate();
  for (const p of (S.pilots as any[]).concat(S.candidates)) {
    const info = pilotInfo[p.id] || ['m', 'GB'];
    if (!p.sex) p.sex = info[0];
    if (!p.nat) p.nat = info[1];
    const role: CrewRole = /first officer/i.test(p.rank) ? 'fo' : 'captain';
    if (!p.look) {
      p.look = randomLook('pilot-' + p.id, p.sex, role);
      const range = NAT_SKIN[p.nat] || [0, 3];
      p.look.skin = range[0] + (_hash(p.id) % (range[1] - range[0] + 1));
      if (p.look.hairColor >= 8) p.look.hairColor = 2;
      if (p.you) p.look = Object.assign(defaultLook('m', 'captain'), { skin: 1, hair: 'side', hairColor: 2, face: 'square', eyes: 'almond', facial: 'stubble', glasses: 'none' });
    }
    if (!p.dob) p.dob = p.you ? `1986-${mm < 10 ? '0' : ''}${mm}-${dd < 10 ? '0' : ''}${dd}` : makePerson('dob-' + p.id, role, '', 'EKVG').dob;
    if (p.you && p.lookAccepted == null) p.lookAccepted = true;
  }
  // realistic weekly salaries
  const wk: { [id: string]: number } = { 'p-hl': 4800, 'p-jo': 2300, 'p-mr': 3900, 'p-sb': 3700, 'p-dk': 2200, 'p-tw': 1700, 'c1': 3800, 'c2': 2250, 'c3': 4900, 'c4': 1750 };
  if (!S.salaryV2) { for (const p of (S.pilots as any[]).concat(S.candidates)) if (wk[p.id]) p.salary = wk[p.id]; S.salaryV2 = true; }
  if (!S.settings.misconduct) S.settings.misconduct = { fa: 'normal', mech: 'normal', fo: 'normal', ground: 'normal' };
  if (!S.settings.misconduct.ground) S.settings.misconduct.ground = 'normal';
  // ground staff on the job market (older saves had none)
  if (S.staffCandidates && !S.staffCandidates.some((x: any) => x.role === 'ground')) for (let i = 0; i < 5; i++) S.staffCandidates.push(makePerson('cand-ground' + i, 'ground', '', ['EKVG', 'EKCH', 'PALH', 'EKBI'][i % 4]));
  ensureCoPilot(State.companyId);
}

function staffOf(cid: string, role?: CrewRole): Staff[] { return (State as any).staff.filter((s: Staff) => s.companyId === cid && (!role || s.role === role)); }
function staffById(id: string): any { return (State as any).staff.filter((s: Staff) => s.id === id)[0] || State.pilots.filter(p => p.id === id)[0]; }

/** Your co-pilot for the current company: generated automatically, you only choose male or female. */
function ensureCoPilot(cid: string) {
  const S: any = State;
  const cp = S.coPilot[cid] || (S.coPilot[cid] = { sex: 'f', id: '' });
  const a = plane(S.myReg[cid]);
  if (!a || !multiCrew(acType(a.typeId))) return null;
  let p = State.pilots.filter((x: any) => x.coPilotFor === cid)[0] as any;
  if (!p || p.sex !== cp.sex) {
    if (p) State.pilots.splice(State.pilots.indexOf(p), 1);
    const c = company(cid);
    const st = makePerson(`copilot-${cid}-${cp.sex}-${cp.gen || 0}`, 'fo', cid, c.hub, cp.sex);
    p = { id: 'cp-' + cid, name: st.name, rank: 'First officer', hoursMin: 1900 * 60, landings: 1100, base: c.hub, salary: st.salary, rating: 4.4, status: 'flying',
      types: [a.typeId], sex: st.sex, nat: st.nat, dob: st.dob, look: st.look, coPilotFor: cid, warnings: 0 };
    State.pilots.push(p);
  }
  cp.id = p.id;
  return p;
}

function multiCrew(t: AircraftType): boolean { return t.cls === 'airliner' || t.cls === 'widebody' || t.cls === 'regional' || t.cls === 'turboprop' || t.cls === 'helicopter'; }   // helicopters: two pilots

/** Age from date of birth, on the company's calendar (real or simulated). */
function companyDate(): Date {
  if (State.settings.timeMode === 'sim') { const p = ((State as any).simDate || '2030-05-14').split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  return new Date();
}
function ageOf(dob: string): number {
  if (!dob) return 0;
  const p = dob.split('-').map(Number), now = companyDate();
  let a = now.getFullYear() - p[0];
  if (now.getMonth() + 1 < p[1] || (now.getMonth() + 1 === p[1] && now.getDate() < p[2])) a--;
  return a;
}

/* ---------- Real-world crew requirements ---------- */
// Flight attendants: aircraft with 20+ passenger seats need 1 per 50 seats (rounded up).
function faNeeded(t: AircraftType): number { return t.cls === 'helicopter' ? (hoistHeli(t) ? 1 : 0) : t.seats >= 20 ? Math.ceil(t.seats / 50) : 0; }
/** Search-and-rescue and air-ambulance helicopters fitted with a rescue hoist fly with a third crew member: the winch operator. */
function hoistHeli(t: AircraftType): boolean {
  if (!t || t.cls !== 'helicopter') return false;
  const roles: string[] = (t as any).roles || [], sp: any = typeof heliSpec === 'function' ? heliSpec(t.id) : null;
  return (roles.indexOf('sar') >= 0 || roles.indexOf('hems') >= 0) && !!(sp && sp.hoist);
}
/** A trained winch operator (hired as one, or trained up from the cabin crew). */
function isWinchOp(p: any): boolean { return !!p && (p.winch === true || (p.winchFrom && p.winchFrom <= Date.now())); }
/** What to call a person: their role, or winch operator for rescue crew. */
function roleNameOf(p: any): string { const r = personRole(p); return r === 'fa' && isWinchOp(p) ? 'Winch operator' : ROLE_NAMES[r]; }
/** The flight attendants who fly on an aircraft: your own hired cabin crew, each aircraft its own team (as many
 *  as its seats need), kept from flight to flight so the same faces are on the same aircraft. People who leave,
 *  are dismissed, suspended, ill, on strike or off duty are replaced from the rest of the cabin crew, first
 *  those based where the aircraft is, and only shared with another aircraft when there aren't enough. */
function planeCabinCrew(reg: string): Staff[] {
  const S: any = State, a = plane(reg); if (!a) return [];
  const t = acType(a.typeId); if (!t) return [];
  S.faCrew = S.faCrew || {};
  const ok = (x: any) => x && !x.suspended && !x.left && !x.onStrike && x.status !== 'off' && !(x.sickUntil && x.sickUntil > Date.now());
  const all: Staff[] = staffOf(a.companyId, 'fa').filter((x: any) => !hoistHeli(t) || isWinchOp(x)), byId = (id: string) => all.filter(x => x.id === id)[0];
  const need = Math.max(1, faNeeded(t));
  const taken: { [id: string]: boolean } = {};
  for (const r of Object.keys(S.faCrew)) if (r !== reg && plane(r)) for (const id of S.faCrew[r]) taken[id] = true;
  const mine: string[] = (S.faCrew[reg] || []).filter((id: string) => ok(byId(id)));
  const free = all.filter(x => ok(x) && mine.indexOf(x.id) < 0).sort((x, y) => (taken[x.id] ? 1 : 0) - (taken[y.id] ? 1 : 0) || (x.base === a.location ? 0 : 1) - (y.base === a.location ? 0 : 1) || (x.id < y.id ? -1 : 1));
  while (mine.length < need && free.length) mine.push(free.shift().id);
  if (JSON.stringify(mine) !== JSON.stringify(S.faCrew[reg] || [])) { S.faCrew[reg] = mine; try { Store.soon(); } catch (e) { /* saved later */ } }
  return mine.map(byId).filter(Boolean);
}
// Line-maintenance staffing per aircraft, by class (airline staffing ratios; no single law sets these).
const MECH_RATIO: { [cls: string]: number } = { ga: 1 / 3, bush: 1 / 3, turboprop: 2, regional: 2, airliner: 3, widebody: 5, helicopter: 1.5 };
// Pilots on a leg: two-pilot aircraft need 2; long legs need augmented crews.
function pilotsNeeded(t: AircraftType, blockMin: number): number {
  if (!multiCrew(t)) return 1;
  return blockMin > 13 * 60 ? 4 : blockMin > 9 * 60 ? 3 : 2;
}

interface CrewCheck { winchNeed?: number; winchHave?: number; faNeed: number; faHave: number; mechNeed: number; mechHave: number; blocked: { [reg: string]: string[] } }
function crewCheck(cid?: string): CrewCheck {
  const c = cid || State.companyId;
  const fl = State.fleet.filter(a => a.companyId === c);
  const active = fl.filter(a => a.status !== 'grounded' && a.status !== 'maintenance');
  const order = active.slice().sort((a, b) => (a.status === 'flying' ? 0 : 1) - (b.status === 'flying' ? 0 : 1));
  const faHave = staffOf(c, 'fa').filter((s: any) => s.status !== 'training').length, mechHave = staffOf(c, 'mech').filter((s: any) => s.status !== 'training').length;   // on a course: not at work
  let faNeed = 0, faLeft = faHave, winchNeed = 0, winchLeft = staffOf(c, 'fa').filter(isWinchOp).length;
  const winchHave = winchLeft;
  const blocked: { [reg: string]: string[] } = {};
  for (const a of order) {
    const at = acType(a.typeId);
    if (hoistHeli(at)) { winchNeed++; if (winchLeft < 1) (blocked[a.reg] = blocked[a.reg] || []).push('needs a winch operator'); winchLeft--; faLeft--; continue; }
    const n = faNeeded(at); faNeed += n;
    if (n > faLeft) (blocked[a.reg] = blocked[a.reg] || []).push(`needs ${n - Math.max(faLeft, 0)} more flight attendant${n - Math.max(faLeft, 0) > 1 ? 's' : ''}`);
    faLeft -= n;
  }
  const bases: { [b: string]: boolean } = {};
  fl.forEach(a => bases[a.base] = true);
  let ratio = 0; fl.forEach(a => ratio += MECH_RATIO[acType(a.typeId).cls] || 1);
  const mechNeed = Math.max(Object.keys(bases).length, Math.ceil(ratio));
  if (mechHave === 0) fl.forEach(a => (blocked[a.reg] = blocked[a.reg] || []).push('no mechanic'));
  else if (mechHave < mechNeed) {
    let cover = mechHave;
    for (const a of order) { cover -= MECH_RATIO[acType(a.typeId).cls] || 1; if (cover < 0) (blocked[a.reg] = blocked[a.reg] || []).push('not enough mechanics'); }
  }
  const myA = plane((State as any).myReg[c]);
  if (myA && multiCrew(acType(myA.typeId)) && !State.pilots.some((p: any) => p.coPilotFor === c)) (blocked[myA.reg] = blocked[myA.reg] || []).push('needs a co-pilot');
  return { faNeed, faHave, mechNeed, mechHave, blocked, winchNeed, winchHave };
}

/** The jobs on the ramp: who drives what and who handles what. */
const GROUND_JOBS: [string, string][] = [
  ['baggage', 'Baggage handler'], ['pushback', 'Push-back tug driver'], ['fuel', 'Fuel truck driver'], ['catering', 'Catering truck driver'],
  ['deice', 'De-icing operator'], ['bus', 'Apron bus driver'], ['ramp', 'Ramp agent'], ['stairs', 'Stairs and power unit operator'],
];
function groundJobName(p: any): string { if (p && p.job === 'security') return 'Security officer'; const j = GROUND_JOBS.filter(x => x[0] === p.job)[0]; return j ? j[1] : 'Ground staff'; }
const ROLE_NAMES: { [r: string]: string } = { captain: 'Captain', fo: 'First officer', fa: 'Flight attendant', mech: 'Mechanic', ground: 'Ground staff' };

/** Weekly payroll history: one salary payment per person, shown in Finance. */
function ensurePayroll() {
  const S: any = State;
  if (S.txns.some((t: Txn) => t.kind === 'salary')) return;
  for (const c of State.companies) {
    const people: any[] = (State.pilots.filter((p: any) => !p.you && pilotCompany(p) === c.id) as any[]).concat(staffOf(c.id));
    for (const p of people) S.txns.push({ id: 'sal-' + p.id, companyId: c.id, date: '2026-10-27', time: '06:00', kind: 'salary',
      label: `Salary: ${p.name}`, amount: -p.salary, personId: p.id,
      lines: [['Weekly salary', -Math.round(p.salary * 0.86)], ['Pension and insurance', -Math.round(p.salary * 0.14)]], link: { kind: 'staff', id: p.id } });
  }
}
/** Which company a hired pilot works for (pilots are matched by base and aircraft types). */
function pilotCompany(p: any): string {
  if (p.coPilotFor) return p.coPilotFor;
  if (p.companyId) return p.companyId;
  if (p.base && p.base[0] === 'P') return 'rba';
  return 'atn';
}
function weeklyPayroll(cid: string): number {
  return State.pilots.filter((p: any) => !p.you && pilotCompany(p) === cid).reduce((s: number, p: any) => s + (p.salary || 0), 0)
    + staffOf(cid).reduce((s, p) => s + p.salary, 0);
}
