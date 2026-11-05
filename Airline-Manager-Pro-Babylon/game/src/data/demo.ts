// Demo data that fills every screen until the real simulator sync is wired in.

interface Pilot {
  id: string; name: string; rank: string; hoursMin: number; landings: number; base: string;
  you?: boolean; profileId?: string; salary?: number; rating?: number; status: 'flying' | 'resting' | 'standby' | 'off';
  rules?: { maxDutyHrs: number; maxLandingFpm: number; ifrOnly: boolean; homeBaseReturn: boolean };
  types: string[];
  sex?: 'm' | 'f'; nat?: string; dob?: string; look?: any; lookAccepted?: boolean; coPilotFor?: string; warnings?: number; companyId?: string;
}
interface Aircraft {
  engine?: string;   // the engine option (data/engines.ts); the type's first when not set
  reg: string; typeId: string; companyId: string; divisionId?: string; base: string; location: string;
  hoursMin: number; cycles: number; condition: number; status: 'parked' | 'flying' | 'grounded' | 'maintenance' | 'leased';
  delivered: string; name?: string;
}
interface LiveFlight {
  id: string; reg: string; pilotId: string; from: string; to: string; t: number; rate: number;
  callsign: string; pax: number; paxMax: number; alt: number; phase: string; you?: boolean;
  real?: boolean; pos?: number[]; hdg?: number; noDest?: boolean; gs?: number;
}
interface Leg { from: string; to: string; dep: string; reg: string; status: 'done' | 'active' | 'next' | 'planned' }
interface RouteDef { id: string; companyId: string; code: string; legs: string[]; days: string; typeId: string; pilotId?: string; demand: number; yieldPerPax: number; test?: boolean; flownAt?: number }
interface LogEntry {
  id: string; date: string; from: string; to: string; reg: string; blockMin: number; landingFpm: number; g: number;
  pax: number; result: 'ok' | 'hard' | 'crash' | 'incident'; decision?: 'pending' | 'registered' | 'disregarded'; atc: string; notes?: string;
}
interface Issue {
  id: string; reg: string; title: string; detail: string; source: string; severity: 'minor' | 'major' | 'grounding';
  cost: number; days: number; status: 'open' | 'scheduled' | 'fixed'; date: string;
}
interface Notice {
  id: string; kind: 'mechanic' | 'authority' | 'finance' | 'pilot' | 'company' | 'flight' | 'staff' | 'birthday';
  title: string; body: string; time: string; read: boolean; ref?: string;
}
interface Txn {
  id: string; date: string; label: string; amount: number; kind: 'revenue' | 'fuel' | 'crew' | 'maint' | 'fine' | 'purchase' | 'lease' | 'fees' | 'salary' | 'sale' | 'loan' | 'insurance' | 'marketing' | 'charter' | 'training';
  companyId?: string; time?: string; reg?: string; flight?: string; route?: string; personId?: string;
  lines?: [string, number][]; note?: string; link?: { kind: 'log' | 'issue' | 'staff' | 'aircraft'; id: string };
}
interface Division { id: string; name: string; color: string }
interface Company {
  id: string; profileId: string; name: string; icao: string; callsign: string; hub: string; color: string; color2: string; livery?: Partial<Livery>;
  balance: number; reputation: number; founded: string; kind: 'major' | 'bush' | 'regional'; divisions: Division[];
}
interface Profile { id: string; pilotId: string; label: string }

const State = {
  screen: 'ops',
  companyId: 'atn',
  // The one aircraft you fly yourself (per company). The PC bridge checks the aircraft loaded in the sim against it.
  myReg: { atn: 'OY-ANA', ndc: 'OY-NCA', rba: 'N100RB' } as { [co: string]: string },
  // Weights for your current flight, as read from the simulator (GSX or the sim's own payload data)
  myLoad: { source: 'gsx' as 'gsx' | 'sim', emptyKg: 42600, pax: 168, paxKg: 84, bagsKg: 2520, cargoKg: 1150, mailKg: 180, fuelKg: 6840, tripFuelKg: 4920, reserveKg: 1350, mtowKg: 78000 },
  simAircraft: { title: 'Fenix A320 CFM', typeId: 'a320-fenix', reg: 'OY-ANA' },
  divisionId: 'all',
  bridge: { pc: 'connected' as 'connected' | 'searching' | 'offline', link: 'wifi' as 'wifi' | 'none', sim: 'MSFS 2024', latencyMs: 38,
    wifi: 'Heima-5G', signal: 4, phoneIp: '192.168.1.37', pcName: 'SIM-PC', pcIp: '192.168.1.24', gsx: true },
  settings: {
    appMode: 'shared' as 'shared' | 'separate',
    atcSource: 'builtin' as 'builtin' | 'beyondatc',
    atcListen: true, atcFines: true, atcTranscripts: true, sttQuality: 'balanced' as 'light' | 'balanced' | 'accurate',
    damage: true, turbulence: true, crashPrompt: true, repairTime: 'auto', gsx: true,
    mechanicVoice: true, voiceEngine: 'neural' as 'clips' | 'neural' | 'device', voicePack: false,
    muteAll: false, onlyVoices: false, v3dKm: 150, v3dSat: false, v3dSatQ: 1, cloudKm: 80, cloudDetail: 2, v3dWater: 'living', v3dSky: true, v3dDayNight: true, v3dCity: true, v3dAptLights: true, v3dAcLights: true, v3dSimTime: true, mapNight: true, wxLayer: false, wxSigmet: true, wxMetar: true, groundHandling: 'base', crewStyle: 'balanced' as 'natural' | 'balanced' | 'stylised', mapStyle: 'classic' as 'classic' | 'street' | 'satellite', purchaseSound: true, paySound: true, uiSounds: true, titleMusic: true, haptics: true, reduceMotion: false, newsMode: 'popup', otherTraffic: true, v3dFreeSpeed: 1, realMarkets: true,
    units: 'imperial' as 'imperial' | 'metric', clock24: true,
    timeMode: 'real' as 'real' | 'sim', simRate: 'month' as 'week' | 'month' | 'quarter',
    aiSpeed: '1', autosaveMin: '0', morningBrief: true, aiNotify: true, conduct: true, security: true, courtOn: true, invTiming: '1', officeAutoVoice: false,
    // online services (Settings → Online services)
    liveWx: true, network: 'off' as 'off' | 'vatsim' | 'ivao' | 'both', netOnMap: true, vatsimId: '', ivaoId: '', sbUser: '',
    hoppieCode: '', hoppieAuto: true, discordUrl: '', discordMine: true, discordAi: false, discordFleet: true, discordJobs: true,
  },
  profiles: [
    { id: 'p1', pilotId: 'you', label: 'Main profile' },
    { id: 'p2', pilotId: 'you2', label: 'Bush profile' },
  ] as Profile[],
  companies: [
    { id: 'atn', profileId: 'p1', name: 'Atlantic North', icao: 'ATN', callsign: 'NORTHWIND', hub: 'EKVG', color: '#2C8CFF', color2: '#0B2A55',
      balance: 61840000, reputation: 78, founded: '2026-09-02', kind: 'major',
      divisions: [{ id: 'main', name: 'Mainline', color: '#2C8CFF' }, { id: 'reg', name: 'Regional', color: '#7FC4FF' }] },
    { id: 'ndc', profileId: 'p1', name: 'Nordic Cargo Lines', icao: 'NDC', callsign: 'NORDCARGO', hub: 'EKBI', color: '#9C7CFF', color2: '#261A55',
      balance: 12600000, reputation: 54, founded: '2026-10-11', kind: 'regional', divisions: [] },
    { id: 'rba', profileId: 'p2', name: 'Ridgeline Bush Air', icao: 'RBA', callsign: 'RIDGELINE', hub: 'PALH', color: '#E5683F', color2: '#3A1A10',
      balance: 2480000, reputation: 66, founded: '2026-09-20', kind: 'bush', divisions: [] },
  ] as Company[],
  pilots: [
    { id: 'you', name: 'Capt. A. Mikkelsen', rank: 'Captain', hoursMin: 412 * 60 + 35, landings: 238, base: 'EKVG', you: true, profileId: 'p1', status: 'flying', types: ['a320-fenix', 'b738-pmdg', 'a350-ini'], rating: 4.8 },
    { id: 'you2', name: 'Capt. A. Mikkelsen', rank: 'Bush captain', hoursMin: 96 * 60 + 10, landings: 141, base: 'PALH', you: true, profileId: 'p2', status: 'standby', types: ['dhc2', 'kodiak', 'c208'], rating: 4.6 },
    { id: 'p-hl', name: 'Hanna Lindqvist', rank: 'Captain', hoursMin: 8420 * 60, landings: 4120, base: 'EKCH', salary: 14200, rating: 4.7, status: 'flying', types: ['b77w-pmdg', 'a350-ini'],
      rules: { maxDutyHrs: 13, maxLandingFpm: 400, ifrOnly: true, homeBaseReturn: true } },
    { id: 'p-jo', name: 'Jóannes Olsen', rank: 'First officer', hoursMin: 2310 * 60, landings: 1650, base: 'EKVG', salary: 7800, rating: 4.3, status: 'flying', types: ['b738-pmdg', 'b736-pmdg'],
      rules: { maxDutyHrs: 10, maxLandingFpm: 500, ifrOnly: true, homeBaseReturn: true } },
    { id: 'p-mr', name: 'Marco Rinaldi', rank: 'Captain', hoursMin: 6105 * 60, landings: 3980, base: 'EKVG', salary: 11900, rating: 4.5, status: 'flying', types: ['crj9-aero', 'crj7-aero', 'atr72'],
      rules: { maxDutyHrs: 11, maxLandingFpm: 450, ifrOnly: true, homeBaseReturn: false } },
    { id: 'p-sb', name: 'Sigrid Berg', rank: 'Captain', hoursMin: 5530 * 60, landings: 4410, base: 'ENGM', salary: 11400, rating: 4.6, status: 'flying', types: ['atr72', 'dhc6-aero'],
      rules: { maxDutyHrs: 11, maxLandingFpm: 450, ifrOnly: false, homeBaseReturn: true } },
    { id: 'p-dk', name: 'Dana Kowalczyk', rank: 'First officer', hoursMin: 1490 * 60, landings: 980, base: 'EKCH', salary: 6900, rating: 4.1, status: 'resting', types: ['a320-fenix', 'a320neo'],
      rules: { maxDutyHrs: 10, maxLandingFpm: 500, ifrOnly: true, homeBaseReturn: true } },
    { id: 'p-tw', name: 'Tom Whitehorse', rank: 'Bush pilot', hoursMin: 3720 * 60, landings: 5210, base: 'PALH', salary: 6100, rating: 4.9, status: 'flying', types: ['dhc2', 'c208', 'kodiak'],
      rules: { maxDutyHrs: 10, maxLandingFpm: 600, ifrOnly: false, homeBaseReturn: true } },
  ] as Pilot[],
  candidates: [
    { id: 'c1', name: 'Elin Dahl', rank: 'Captain', hoursMin: 7200 * 60, landings: 3900, base: 'ENBR', salary: 12800, rating: 4.6, status: 'off', types: ['a320neo', 'a320-fenix'] },
    { id: 'c2', name: 'Ravi Menon', rank: 'First officer', hoursMin: 1820 * 60, landings: 1100, base: 'EGLL', salary: 7100, rating: 4.2, status: 'off', types: ['b738-pmdg', 'b736-pmdg'] },
    { id: 'c3', name: 'Katla Gunnarsdóttir', rank: 'Captain', hoursMin: 9100 * 60, landings: 5200, base: 'BIKF', salary: 14900, rating: 4.8, status: 'off', types: ['b77w-pmdg', 'b78x'] },
    { id: 'c4', name: 'Luis Ortega', rank: 'Bush pilot', hoursMin: 2600 * 60, landings: 4400, base: 'PAFA', salary: 5600, rating: 4.4, status: 'off', types: ['kodiak', 'c208', 'dhc6-aero'] },
  ] as Pilot[],
  fleet: [
    { reg: 'OY-ANA', typeId: 'a320-fenix', companyId: 'atn', divisionId: 'main', base: 'EKVG', location: 'EKVG', hoursMin: 1840 * 60, cycles: 1210, condition: 94, status: 'flying', delivered: '2026-09-02' },
    { reg: 'OY-ANB', typeId: 'a320-fenix', companyId: 'atn', divisionId: 'main', base: 'EKVG', location: 'EKCH', hoursMin: 1655 * 60, cycles: 1102, condition: 97, status: 'parked', delivered: '2026-09-02' },
    { reg: 'OY-ANC', typeId: 'b738-pmdg', companyId: 'atn', divisionId: 'main', base: 'EKVG', location: 'BIKF', hoursMin: 6120 * 60, cycles: 4310, condition: 81, status: 'flying', delivered: '2026-09-05' },
    { reg: 'OY-AND', typeId: 'b738-pmdg', companyId: 'atn', divisionId: 'main', base: 'EKVG', location: 'EKVG', hoursMin: 5980 * 60, cycles: 4122, condition: 58, status: 'grounded', delivered: '2026-09-05' },
    { reg: 'OY-ANE', typeId: 'b77w-pmdg', companyId: 'atn', divisionId: 'main', base: 'EKCH', location: 'EKCH', hoursMin: 12400 * 60, cycles: 2100, condition: 88, status: 'flying', delivered: '2026-09-28' },
    { reg: 'OY-ANF', typeId: 'a350-ini', companyId: 'atn', divisionId: 'main', base: 'EKCH', location: 'EKCH', hoursMin: 3120 * 60, cycles: 540, condition: 99, status: 'parked', delivered: '2026-10-19' },
    { reg: 'OY-ANR', typeId: 'crj9-aero', companyId: 'atn', divisionId: 'reg', base: 'EKVG', location: 'EKVG', hoursMin: 9800 * 60, cycles: 8900, condition: 84, status: 'flying', delivered: '2026-09-10' },
    { reg: 'OY-ANS', typeId: 'atr72', companyId: 'atn', divisionId: 'reg', base: 'EKVG', location: 'ENBR', hoursMin: 7400 * 60, cycles: 9100, condition: 90, status: 'flying', delivered: '2026-09-14' },
    { reg: 'OY-NCA', typeId: 'b736-pmdg', companyId: 'ndc', base: 'EKBI', location: 'EKBI', hoursMin: 8300 * 60, cycles: 6200, condition: 76, status: 'parked', delivered: '2026-10-11' },
    { reg: 'N512RB', typeId: 'dhc2', companyId: 'rba', base: 'PALH', location: 'PALH', hoursMin: 14200 * 60, cycles: 21000, condition: 86, status: 'flying', delivered: '2026-09-20' },
    { reg: 'N208RB', typeId: 'c208', companyId: 'rba', base: 'PALH', location: 'PATK', hoursMin: 5100 * 60, cycles: 6900, condition: 71, status: 'maintenance', delivered: '2026-09-22' },
    { reg: 'N100RB', typeId: 'kodiak', companyId: 'rba', base: 'PALH', location: 'PAKN', hoursMin: 1900 * 60, cycles: 2400, condition: 95, status: 'parked', delivered: '2026-10-03' },
    { reg: 'N300RB', typeId: 'dhc6-aero', companyId: 'rba', base: 'PALH', location: 'PAHO', hoursMin: 22100 * 60, cycles: 30100, condition: 79, status: 'parked', delivered: '2026-10-15' },
  ] as Aircraft[],
  live: [
    { id: 'f1', reg: 'OY-ANA', pilotId: 'you', from: 'EKVG', to: 'EKCH', t: 0.46, rate: 1 / 900, callsign: 'ATN201', pax: 168, paxMax: 180, alt: 35000, phase: 'Cruise', you: true },
    { id: 'f2', reg: 'OY-ANC', pilotId: 'p-jo', from: 'BIKF', to: 'ENGM', t: 0.71, rate: 1 / 700, callsign: 'ATN318', pax: 171, paxMax: 189, alt: 37000, phase: 'Cruise' },
    { id: 'f3', reg: 'OY-ANE', pilotId: 'p-hl', from: 'EKCH', to: 'KJFK', t: 0.28, rate: 1 / 2600, callsign: 'ATN11', pax: 362, paxMax: 396, alt: 39000, phase: 'Cruise' },
    { id: 'f4', reg: 'OY-ANR', pilotId: 'p-mr', from: 'EKVG', to: 'EGPH', t: 0.12, rate: 1 / 600, callsign: 'ATN540', pax: 74, paxMax: 90, alt: 21000, phase: 'Climb' },
    { id: 'f5', reg: 'OY-ANS', pilotId: 'p-sb', from: 'ENBR', to: 'EKVG', t: 0.88, rate: 1 / 800, callsign: 'ATN612', pax: 61, paxMax: 72, alt: 9000, phase: 'Descent' },
    { id: 'f6', reg: 'N512RB', pilotId: 'p-tw', from: 'PALH', to: 'PATK', t: 0.55, rate: 1 / 500, callsign: 'RBA12', pax: 5, paxMax: 6, alt: 2500, phase: 'Cruise' },
  ] as LiveFlight[],
  today: [
    { from: 'EKVG', to: 'BIKF', dep: '06:40', reg: 'OY-ANA', status: 'done' },
    { from: 'BIKF', to: 'EKVG', dep: '09:15', reg: 'OY-ANA', status: 'done' },
    { from: 'EKVG', to: 'EKCH', dep: '13:05', reg: 'OY-ANA', status: 'active' },
    { from: 'EKCH', to: 'ENGM', dep: '17:30', reg: 'OY-ANA', status: 'next' },
    { from: 'ENGM', to: 'EKVG', dep: '20:10', reg: 'OY-ANA', status: 'planned' },
  ] as Leg[],
  routes: [
    { id: 'r1', companyId: 'atn', code: 'ATN201', legs: ['EKVG', 'EKCH'], days: 'Daily', typeId: 'a320-fenix', pilotId: 'you', demand: 92, yieldPerPax: 210 },
    { id: 'r2', companyId: 'atn', code: 'ATN318', legs: ['BIKF', 'ENGM'], days: 'Mon Wed Fri Sun', typeId: 'b738-pmdg', pilotId: 'p-jo', demand: 84, yieldPerPax: 175 },
    { id: 'r3', companyId: 'atn', code: 'ATN11', legs: ['EKCH', 'KJFK'], days: 'Daily', typeId: 'b77w-pmdg', pilotId: 'p-hl', demand: 95, yieldPerPax: 640 },
    { id: 'r4', companyId: 'atn', code: 'ATN540', legs: ['EKVG', 'EGPH', 'EGLL'], days: 'Tue Thu Sat', typeId: 'crj9-aero', pilotId: 'p-mr', demand: 71, yieldPerPax: 160 },
    { id: 'r5', companyId: 'atn', code: 'ATN612', legs: ['EKVG', 'ENBR', 'EKVG'], days: 'Daily', typeId: 'atr72', pilotId: 'p-sb', demand: 77, yieldPerPax: 120 },
    { id: 'r6', companyId: 'atn', code: 'ATN900', legs: ['EKVG', 'BIKF', 'BGBW', 'BGSF'], days: 'Weekly', typeId: 'b736-pmdg', demand: 58, yieldPerPax: 260 },
    { id: 'r7', companyId: 'rba', code: 'RBA12', legs: ['PALH', 'PATK', 'PAFA'], days: 'Daily', typeId: 'dhc2', pilotId: 'p-tw', demand: 81, yieldPerPax: 340 },
    { id: 'r8', companyId: 'rba', code: 'RBA30', legs: ['PALH', 'PAEN', 'PAHO', 'PAKN'], days: 'Mon Thu', typeId: 'c208', demand: 69, yieldPerPax: 290 },
  ] as RouteDef[],
  logbook: [
    { id: 'l0', date: '2026-10-28 11:52', from: 'BIKF', to: 'EKVG', reg: 'OY-ANA', blockMin: 92, landingFpm: -142, g: 1.18, pax: 172, result: 'ok', atc: 'Built-in' },
    { id: 'l1', date: '2026-10-28 08:31', from: 'EKVG', to: 'BIKF', reg: 'OY-ANA', blockMin: 88, landingFpm: -96, g: 1.09, pax: 165, result: 'ok', atc: 'Built-in' },
    { id: 'l2', date: '2026-10-27 19:44', from: 'EKCH', to: 'EKVG', reg: 'OY-AND', blockMin: 141, landingFpm: -388, g: 1.62, pax: 181, result: 'incident', atc: 'BeyondATC', notes: 'Tail strike on landing (pitch 11.2° at touchdown)' },
    { id: 'l3', date: '2026-10-27 14:10', from: 'PALH', to: 'PATK', reg: 'N512RB', blockMin: 48, landingFpm: -1840, g: 3.9, pax: 4, result: 'crash', decision: 'pending', atc: 'Built-in', notes: 'Impact with water during landing flare' },
    { id: 'l4', date: '2026-10-26 21:03', from: 'ENGM', to: 'EKVG', reg: 'OY-ANA', blockMin: 118, landingFpm: -211, g: 1.24, pax: 159, result: 'ok', atc: 'BeyondATC' },
    { id: 'l5', date: '2026-10-26 16:22', from: 'EKCH', to: 'ENGM', reg: 'OY-ANA', blockMin: 64, landingFpm: -305, g: 1.41, pax: 174, result: 'hard', atc: 'BeyondATC' },
    { id: 'l6', date: '2026-10-25 10:15', from: 'PATK', to: 'PAFA', reg: 'N208RB', blockMin: 71, landingFpm: -655, g: 2.1, pax: 9, result: 'hard', atc: 'Built-in', notes: 'Hard landing, gear inspection raised' },
    { id: 'l7', date: '2026-10-24 07:40', from: 'EKVG', to: 'EGPH', reg: 'OY-ANR', blockMin: 79, landingFpm: -118, g: 1.12, pax: 82, result: 'ok', atc: 'Built-in' },
  ] as LogEntry[],
  issues: [
    { id: 'i1', reg: 'OY-AND', title: 'Tail strike', detail: 'Aft fuselage skin abrasion and tail skid compressed. Structural check required before next flight.', source: 'Detected at touchdown: pitch 11.2°', severity: 'grounding', cost: 184000, days: 3, status: 'open', date: '2026-10-27' },
    { id: 'i2', reg: 'OY-ANC', title: 'Severe turbulence inspection', detail: 'Peak load +2.4 g / −0.6 g in cruise. Mandatory inspection of wing attach fittings, engine mounts and cabin interior.', source: 'G-load spikes over 4 min, FL370', severity: 'major', cost: 62000, days: 1, status: 'open', date: '2026-10-28' },
    { id: 'i3', reg: 'OY-ANC', title: 'Cabin interior damage', detail: 'Two overhead bin latches and galley cart restraint damaged during turbulence.', source: 'Follows severe turbulence event', severity: 'minor', cost: 8400, days: 0, status: 'open', date: '2026-10-28' },
    { id: 'i4', reg: 'N208RB', title: 'Hard landing gear inspection', detail: 'Main gear leg and attach points to be inspected after a 655 fpm touchdown.', source: 'Detected at touchdown: −655 fpm, 2.1 g', severity: 'major', cost: 9800, days: 1, status: 'scheduled', date: '2026-10-25' },
    { id: 'i5', reg: 'OY-ANA', title: 'Flap overspeed', detail: 'Flaps 2 extended 14 kt above limit for 9 s. Flap track inspection due within 10 cycles.', source: 'Flap position vs. airspeed', severity: 'minor', cost: 12500, days: 0, status: 'open', date: '2026-10-26' },
  ] as Issue[],
  notices: [
    { id: 'n1', kind: 'mechanic', title: 'OY-AND grounded after tail strike', body: 'Structural check needed before she flies again.', time: '19:58', read: false, ref: 'i1' },
    { id: 'n2', kind: 'authority', title: 'Fine: takeoff without clearance', body: 'Civil Aviation Authority, flight ATN540 from EKVG. $25,000.', time: '18:12', read: false, ref: 'fine1' },
    { id: 'n3', kind: 'mechanic', title: 'OY-ANC turbulence inspection', body: 'Severe turbulence over the Norwegian Sea. Inspection required.', time: '15:40', read: false, ref: 'i2' },
    { id: 'n4', kind: 'flight', title: 'Crash on PALH → PATK', body: 'Register or disregard the crash of N512RB.', time: 'Yesterday', read: false, ref: 'l3' },
    { id: 'n5', kind: 'pilot', title: 'Hanna Lindqvist departed EKCH', body: 'ATN11 to New York, 362 passengers on board.', time: '12:31', read: true, ref: 'f3' },
    { id: 'n6', kind: 'finance', title: 'Lease income received', body: 'OY-NCA wet-lease payment: $310,000.', time: 'Yesterday', read: true },
    { id: 'n7', kind: 'company', title: 'Reputation up to 78', body: 'On-time departures and smooth landings this week.', time: 'Mon', read: true },
  ] as Notice[],
  txns: [
    { id: 't1', companyId: 'atn', date: '2026-10-28', time: '11:58', label: 'Ticket revenue BIKF to EKVG', amount: 35280, kind: 'revenue', reg: 'OY-ANA', flight: 'ATN201', route: 'BIKF → EKVG',
      lines: [['172 economy seats', 30960], ['Baggage fees', 2580], ['Onboard sales', 1740]], link: { kind: 'log', id: 'l0' } },
    { id: 't2', companyId: 'atn', date: '2026-10-28', time: '12:40', label: 'Fuel uplift at EKVG', amount: -18420, kind: 'fuel', reg: 'OY-ANA', flight: 'ATN201', route: 'EKVG → EKCH',
      lines: [['Jet A-1, 6,840 kg', -17330], ['Into-plane service', -1090]] },
    { id: 't4', companyId: 'atn', date: '2026-10-27', time: '19:20', label: 'Ticket revenue EKCH to KJFK', amount: 231680, kind: 'revenue', reg: 'OY-ANE', flight: 'ATN11', route: 'EKCH → KJFK',
      lines: [['42 business seats', 105000], ['320 economy seats', 118400], ['Cargo 6.2 t', 8280]] },
    { id: 't6', companyId: 'atn', date: '2026-10-27', time: '23:59', label: 'Landing and handling fees', amount: -22900, kind: 'fees',
      lines: [['Landing fees, 9 movements', -11800], ['Ground handling', -7600], ['Navigation charges', -3500]] },
    { id: 't7', companyId: 'atn', date: '2026-10-26', time: '07:10', label: 'Flap inspection OY-ANB', amount: -6400, kind: 'maint', reg: 'OY-ANB',
      lines: [['Labour, 6 h', -3600], ['Parts', -2800]], link: { kind: 'aircraft', id: 'OY-ANB' } },
    { id: 't8', companyId: 'atn', date: '2026-10-19', time: '10:00', label: 'Purchase: Airbus A350-900 (OY-ANF)', amount: -317400000, kind: 'purchase', reg: 'OY-ANF',
      lines: [['Aircraft, iniBuilds A350-900', -317400000]], link: { kind: 'aircraft', id: 'OY-ANF' } },
  ] as Txn[],
  // Last 7 days, thousands of dollars
  week: { days: ['Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed'], rev: [412, 388, 455, 501, 437, 468, 396], cost: [301, 322, 340, 361, 318, 344, 351] },
  fines: {
    fine1: {
      title: 'Takeoff without clearance', authority: 'Civil Aviation Authority', amount: 25000, flight: 'ATN540', reg: 'OY-ANR', airport: 'EKVG', runway: '12', time: '18:04:51',
      transcript: [
        { t: '18:03:40', who: 'TWR', text: 'Northwind five four zero, hold short runway one two.' },
        { t: '18:03:46', who: 'You', text: 'Holding short one two, Northwind five four zero.' },
        { t: '18:04:51', who: 'SYS', text: 'Takeoff roll started. No takeoff clearance heard.' },
        { t: '18:05:02', who: 'TWR', text: 'Northwind five four zero, you were not cleared for takeoff.' },
      ],
    },
  } as any,
};

function company(id?: string): Company { const k = id || State.companyId; for (const c of State.companies) if (c.id === k) return c; return State.companies[0]; }
function pilot(id: string): Pilot { for (const p of State.pilots) if (p.id === id) return p; return null; }
function plane(reg: string): Aircraft { for (const a of State.fleet) if (a.reg === reg) return a; return null; }
function fleetOf(cid?: string): Aircraft[] {
  const c = cid || State.companyId;
  return State.fleet.filter(a => a.companyId === c && (State.divisionId === 'all' || !a.divisionId || a.divisionId === State.divisionId || cid));
}
function liveOf(cid?: string): LiveFlight[] {
  const c = cid || State.companyId, co: any = (State as any).coop;
  // co-op pilots' flights belong to the co-op airline even when they fly without one of its aircraft
  const list = State.live.filter(f => { const a = plane(f.reg); return a ? a.companyId === c : !!((f as any).coop && co && co.on && co.companyId === c); });
  // favourites first
  const fav = (State as any).favs || {};
  return list.filter(f => fav[f.pilotId]).concat(list.filter(f => !fav[f.pilotId]));
}
/** The aircraft type of a flight (co-op flights may have no aircraft of the fleet). */
function flightTypeId(f: LiveFlight): string { const a = plane(f.reg); return a ? a.typeId : (f as any).typeId || 'a320-fenix'; }
function profileOfCompany(cid: string): Profile { const c = company(cid); for (const p of State.profiles) if (p.id === c.profileId) return p; return State.profiles[0]; }
function myPilot(): Pilot { const pr = profileOfCompany(State.companyId); return pilot(pr.pilotId); }
function unreadCount(): number { pruneNotices(); stampNotices(); return State.notices.filter(n => !n.read).length; }

/** Messages made just now for something that happened at `at` (catching up after the app was closed):
 *  they carry the real time of that event. */
function noticesAt(at: number) {
  if (!at || !isFinite(at)) return;
  const t = Math.min(at, Date.now());
  for (const n of State.notices as any[]) { if (n.at) break; n.at = t; n.time = new Date(t).toTimeString().slice(0, 5); }
}

/** Every notification gets the moment it arrived (older saves: worked out from the time they show). */
function stampNotices() {
  const now = Date.now();
  for (const n of State.notices as any[]) {
    if (n.at) continue;
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(n.time || ''));
    if (m) { const d = new Date(); d.setHours(+m[1], +m[2], 0, 0); n.at = d.getTime() > now ? d.getTime() - 864e5 : d.getTime(); }
    else if (/yesterday/i.test(n.time || '')) n.at = now - 864e5;
    else n.at = now;
  }
}

/** How long ago something arrived, as a phone shows it: "Now", "5 min ago", "2 h ago", "Yesterday 14:05", "Mon 14:05", "28 Oct". */
function agoText(at: number, now?: number): string {
  now = now || Date.now();
  const s = Math.max(0, (now - at) / 1000), d = new Date(at), hm = d.toTimeString().slice(0, 5);
  if (s < 45) return 'Now';
  if (s < 3600) return Math.round(s / 60) + ' min ago';
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  if (at >= today.getTime()) return Math.floor(s / 3600) + ' h ago';
  if (at >= today.getTime() - 864e5) return 'Yesterday ' + hm;
  if (at >= today.getTime() - 6 * 864e5) return d.toLocaleDateString('en-GB', { weekday: 'short' }) + ' ' + hm;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + (d.getFullYear() !== today.getFullYear() ? ' ' + d.getFullYear() : '');
}
/** The full time something arrived: "Today 14:05", "Yesterday 09:12", "Wed 28 Oct, 14:05". */
function receivedText(at: number): string {
  const d = new Date(at), hm = d.toTimeString().slice(0, 5), today = new Date(); today.setHours(0, 0, 0, 0);
  if (at >= today.getTime()) return 'Today ' + hm;
  if (at >= today.getTime() - 864e5) return 'Yesterday ' + hm;
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + ', ' + hm;
}
/** Mechanic's reports that are paid for leave the notifications (the repair carries on under Maintenance). */
function pruneNotices() {
  if (State.notices.some(n => n.kind === 'mechanic' && n.ref && State.issues.some(i => i.id === n.ref && i.status !== 'open')))
    State.notices = State.notices.filter(n => !(n.kind === 'mechanic' && n.ref && State.issues.some(i => i.id === n.ref && i.status !== 'open')));
}

// Profit history per period (dollars). Generated once so numbers stay stable while browsing.
interface ProfitPoint { label: string; rev: number; cost: number }
const PROFIT: { [period: string]: ProfitPoint[]; } = (function () {
  let seed = 7;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const make = (labels: string[], base: number, spread: number, margin: number) => labels.map(l => {
    const rev = base * (0.82 + rnd() * spread);
    return { label: l, rev, cost: rev * (1 - margin + (rnd() - 0.5) * 0.18) };
  });
  const days: string[] = [];
  for (let i = 13; i >= 0; i--) { const d = new Date(2026, 9, 28 - i); days.push(d.getDate() + '/' + (d.getMonth() + 1)); }
  const weeks: string[] = [];
  for (let i = 11; i >= 0; i--) weeks.push('W' + (44 - i));
  return {
    day: make(days, 430000, 0.35, 0.17),
    week: make(weeks, 2950000, 0.4, 0.16),
    month: make(['Sep', 'Oct'], 12600000, 0.25, 0.15),
    yearReal: make(['2026'], 26500000, 0.1, 0.14),
    yearSim: make(['2026', '2027', '2028', '2029', '2030'], 152000000, 0.6, 0.13),
    monthSim: make(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], 12900000, 0.4, 0.14),
  };
})();
function profitSeries(period: string): ProfitPoint[] {
  if ((State as any).fresh) return profitFromBooks(period);   // a game of your own: from your own books, not the demo's
  const sim = State.settings.timeMode === 'sim';
  if (period === 'year') return sim ? PROFIT.yearSim : PROFIT.yearReal;
  if (period === 'month') return sim ? PROFIT.monthSim : PROFIT.month;
  return PROFIT[period];
}
function lastProfit(period: string): number { const s = profitSeries(period); const p = s[s.length - 1]; return p.rev - p.cost; }

/** Money in and out per day (the last 14), week (12), month (12) or year, from the airline's own books. */
function profitFromBooks(period: string): ProfitPoint[] {
  const cid = State.companyId, now = new Date(), out: ProfitPoint[] = [], idx: { [k: string]: ProfitPoint } = {};
  const keyOf = (d: Date) => period === 'day' ? d.toISOString().slice(0, 10) : period === 'week' ? d.getFullYear() + '-W' + Math.ceil(((d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 864e5 + new Date(d.getFullYear(), 0, 1).getDay() + 1) / 7) : period === 'month' ? d.toISOString().slice(0, 7) : String(d.getFullYear());
  const n = period === 'day' ? 14 : period === 'week' ? 12 : period === 'month' ? 12 : 5, MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now); if (period === 'day') d.setDate(d.getDate() - i); else if (period === 'week') d.setDate(d.getDate() - 7 * i); else if (period === 'month') d.setMonth(d.getMonth() - i, 1); else d.setFullYear(d.getFullYear() - i);
    const k = keyOf(d); if (idx[k]) continue;
    const p = { label: period === 'day' ? d.getDate() + '/' + (d.getMonth() + 1) : period === 'week' ? 'W' + k.split('-W')[1] : period === 'month' ? MON[d.getMonth()] : String(d.getFullYear()), rev: 0, cost: 0 };
    idx[k] = p; out.push(p);
  }
  for (const t of State.txns as any[]) {
    if (t.companyId !== cid || !t.date) continue;
    const p = idx[keyOf(new Date(t.date + 'T12:00:00'))]; if (!p) continue;
    if (t.amount >= 0) p.rev += t.amount; else p.cost -= t.amount;
  }
  return out;
}

// Fleet status in the three states shown everywhere: in flight, available, maintenance
function fleetState(a: Aircraft): 'flight' | 'avail' | 'maint' {
  return a.status === 'flying' ? 'flight' : a.status === 'parked' ? 'avail' : 'maint';
}
function availabilityPct(list: Aircraft[]): number {
  if (!list.length) return 0;
  return Math.round(list.filter(a => fleetState(a) !== 'maint').length / list.length * 100);
}
