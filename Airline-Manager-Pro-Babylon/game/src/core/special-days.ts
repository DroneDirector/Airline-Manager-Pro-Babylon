// Special days: the holidays, festivals and events that fill (or empty) aircraft, on top of the seasons
// (business.ts). Each one has its dates (fixed, Easter-based, a weekday of a month, or a list), where it
// counts (countries, or particular airports), how much it changes demand to and from there, and how many days
// before and after people travel. They are known ahead, so you can plan: raise fares, add flights, move an
// aircraft. The morning briefing (ui/briefing.ts) and Routes show the ones coming up on your network.

interface SpecialDay { id: string; name: string; why: string; where: string[]; factor: number; before: number; after: number; dates: (y: number) => Date[] }

/** Easter Sunday (Gregorian), the anonymous Gregorian algorithm. */
function easterDate(y: number): Date {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(y, mo - 1, da));
}
/** The n-th weekday of a month (wd 0 = Sunday; n = -1 for the last). */
function nthWeekday(y: number, m: number, wd: number, n: number): Date {
  if (n > 0) { const d = new Date(Date.UTC(y, m, 1)); const add = (wd - d.getUTCDay() + 7) % 7 + (n - 1) * 7; return new Date(Date.UTC(y, m, 1 + add)); }
  const d = new Date(Date.UTC(y, m + 1, 0)); const back = (d.getUTCDay() - wd + 7) % 7; return new Date(Date.UTC(y, m, d.getUTCDate() - back));
}
const D = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
const addD = (x: Date, n: number) => new Date(x.getTime() + n * 864e5);
// Lunar New Year (first day), a list (it follows the moon)
// Eid al-Fitr (first day), a list (it follows the moon)
const EID: { [y: number]: [number, number] } = { 2025: [3, 30], 2026: [3, 20], 2027: [3, 10], 2028: [2, 27], 2029: [2, 14], 2030: [2, 4], 2031: [1, 24], 2032: [1, 14] };
const LUNAR_NY: { [y: number]: [number, number] } = { 2025: [1, 29], 2026: [2, 17], 2027: [2, 6], 2028: [1, 26], 2029: [2, 13], 2030: [2, 3], 2031: [1, 23], 2032: [2, 11] };

const SPECIAL_DAYS: SpecialDay[] = [
  { id: 'xmas', name: 'Christmas and New Year', why: 'Families travelling home and holidays in the sun', where: ['*'], factor: 1.2, before: 6, after: 9, dates: y => [D(y, 12, 24)] },
  { id: 'easter', name: 'Easter', why: 'The Easter holidays', where: ['EU', 'GB', 'IE', 'NO', 'IS', 'FO', 'US', 'CA', 'AU', 'NZ', 'BR', 'MX', 'ZA'], factor: 1.15, before: 5, after: 2, dates: y => [easterDate(y)] },
  { id: 'olavsoka', name: 'Ólavsøka', why: 'The Faroe Islands\' national festival in Tórshavn: Faroese from abroad come home', where: ['FO'], factor: 1.6, before: 4, after: 2, dates: y => [D(y, 7, 29)] },
  { id: 'no17mai', name: 'Norway\'s Constitution Day', why: '17 May: Norwegians come home for the parades', where: ['NO'], factor: 1.25, before: 3, after: 1, dates: y => [D(y, 5, 17)] },
  { id: 'is17jun', name: 'Iceland\'s National Day', why: '17 June in Reykjavík', where: ['IS'], factor: 1.15, before: 2, after: 1, dates: y => [D(y, 6, 17)] },
  { id: 'midsummer', name: 'Midsummer', why: 'Midsummer weekend: cities empty for the countryside and the islands', where: ['SE', 'FI', 'NO', 'DK', 'EE', 'LV'], factor: 1.18, before: 3, after: 2, dates: y => { const d = nthWeekday(y, 5, 6, 3); return [d.getUTCDate() < 20 ? addD(d, 7) : d]; } },
  { id: 'thanksgiving', name: 'Thanksgiving', why: 'The busiest travel days of the American year', where: ['US'], factor: 1.3, before: 3, after: 4, dates: y => [nthWeekday(y, 10, 4, 4)] },
  { id: 'july4', name: 'Independence Day', why: 'The 4th of July long weekend', where: ['US'], factor: 1.12, before: 3, after: 2, dates: y => [D(y, 7, 4)] },
  { id: 'lunar', name: 'Lunar New Year', why: 'The world\'s biggest family journey home', where: ['CN', 'HK', 'TW', 'SG', 'KR', 'VN', 'MY'], factor: 1.35, before: 8, after: 7, dates: y => LUNAR_NY[y] ? [D(y, LUNAR_NY[y][0], LUNAR_NY[y][1])] : [] },
  { id: 'oktoberfest', name: 'Oktoberfest', why: 'Six million visitors in Munich', where: ['EDDM'], factor: 1.3, before: 1, after: 16, dates: y => { let d = D(y, 9, 16); while (d.getUTCDay() !== 6) d = addD(d, 1); return [d]; } },
  { id: 'carnival', name: 'Carnival', why: 'Carnival in Rio and Salvador', where: ['SBGL', 'SBRJ', 'SBSV', 'SBRF'], factor: 1.45, before: 4, after: 2, dates: y => [addD(easterDate(y), -47)] },
  { id: 'skiweek', name: 'Winter half-term', why: 'School ski week: families to the Alps and the mountains', where: ['LOWI', 'LOWS', 'LSGS', 'LSZS', 'LFLB', 'LFLS', 'LFLP', 'LIMJ', 'ENSN', 'ESNZ', 'EFKT', 'EFRO', 'EFIV'], factor: 1.3, before: 2, after: 8, dates: y => [nthWeekday(y, 1, 6, 2)] },
  { id: 'dksummer', name: 'Danish school summer holidays', why: 'Danish families go south', where: ['DK', 'FO', 'GL'], factor: 1.15, before: 0, after: 20, dates: y => [nthWeekday(y, 5, 6, 4)] },
  { id: 'ukbank', name: 'Late summer bank holiday', why: 'A long weekend away', where: ['GB'], factor: 1.12, before: 3, after: 1, dates: y => [nthWeekday(y, 7, 1, -1)] },
  { id: 'eid', name: 'Eid al-Fitr', why: 'Families meeting at the end of Ramadan', where: ['SA', 'AE', 'QA', 'KW', 'BH', 'OM', 'EG', 'JO', 'MA', 'TR', 'PK', 'ID', 'MY'], factor: 1.25, before: 4, after: 4,
    dates: y => EID[y] ? [D(y, EID[y][0], EID[y][1])] : [] },
  { id: 'final', name: 'The cup final', why: 'A big football final: fans fly in from all over', where: ['@final'], factor: 1.5, before: 2, after: 1, dates: y => [nthWeekday(y, 4, 6, -1)] },
];
/** The city of this year's cup final: a large European airport, the same one all year. */
function finalAirport(y: number): string {
  const L = ['EGLL', 'LEMD', 'LFPG', 'EDDM', 'LIRF', 'EHAM', 'LPPT', 'LTFM', 'EKCH', 'ENGM', 'ESSA', 'LOWW', 'EBBR', 'EIDW', 'LEBL'];
  return L[_hashStr('final' + y) % L.length];
}
/** The two-letter country code of an airport (or ''); EU member states count as 'EU' too. */
function sdCountry(icao: string): string { try { return salCc(apt(icao)); } catch (e) { return ''; } }
const EU_CC = /^(AT|BE|BG|HR|CY|CZ|DK|EE|FI|FR|DE|GR|HU|IE|IT|LV|LT|LU|MT|NL|PL|PT|RO|SK|SI|ES|SE)$/;
function sdApplies(ev: SpecialDay, icao: string, y: number): boolean {
  const cc = sdCountry(icao);
  return ev.where.some(w => w === '*' || w === icao || w === cc || (w === 'EU' && EU_CC.test(cc)) || (w === '@final' && finalAirport(y) === icao));
}
/** The special days around a date at an airport: [event, its day, how strong (0..1 at the edges of its window)]. */
function specialAt(icao: string, d: Date): [SpecialDay, Date][] {
  const out: [SpecialDay, Date][] = [], y = d.getUTCFullYear(), t = d.getTime();
  for (const ev of SPECIAL_DAYS) for (const yy of [y - 1, y, y + 1]) for (const day of ev.dates(yy)) {
    if (t >= day.getTime() - ev.before * 864e5 && t <= day.getTime() + (ev.after + 1) * 864e5 && sdApplies(ev, icao, yy)) out.push([ev, day]);
  }
  return out;
}
/** How much busier a route is that day (1 = no special day). The strongest event at either end counts. */
function routeSpecial(from: string, to: string, d?: Date): number {
  try {
    const day = d || companyDateSafe();
    let f = 1; for (const k of [from, to]) for (const [ev] of specialAt(k, day)) f = Math.max(f, ev.factor);
    return f;
  } catch (e) { return 1; }
}
/** The special days in the next `days` days on an airline's network: each event once, with the airports it touches. */
function specialUpcoming(cid: string, days: number): { ev: SpecialDay; day: Date; airports: string[]; startsIn: number }[] {
  const icaos: string[] = [], add = (k: string) => { if (k && icaos.indexOf(k) < 0) icaos.push(k); };
  try { for (const r of (State.routes as any[]).filter(x => x.companyId === cid)) for (const l of r.legs || []) add(l); } catch (e) { /* none */ }
  try { add((company(cid) as any).hub); } catch (e) { /* none */ }
  const now = companyDateSafe(), y = now.getUTCFullYear(), out: any[] = [];
  for (const ev of SPECIAL_DAYS) for (const yy of [y, y + 1]) for (const day of ev.dates(yy)) {
    const start = day.getTime() - ev.before * 864e5, end = day.getTime() + (ev.after + 1) * 864e5;
    if (end < now.getTime() || start > now.getTime() + days * 864e5) continue;
    const ap = icaos.filter(k => sdApplies(ev, k, yy)); if (!ap.length) continue;
    out.push({ ev, day, airports: ap, startsIn: Math.max(0, Math.ceil((start - now.getTime()) / 864e5)) });
  }
  return out.sort((a, b) => a.startsIn - b.startsIn);
}
