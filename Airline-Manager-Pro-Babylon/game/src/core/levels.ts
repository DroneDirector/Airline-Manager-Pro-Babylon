// Levels for hired pilots, co-pilots, flight attendants and mechanics, from 1 to 500. They gain experience
// from their own work and rise level by level, slowly and steadily over a whole career: a few flights for
// the first levels, a year and a half of flying to reach about level 100, some thirty years for 500. Each
// level makes them a little better (their rating, and with it landings, delays, mistakes and passengers'
// mood). New people arrive with the level their aviation background gives them, from a fresh start to a
// long career. Someone very unprofessional can be below zero, and warnings take levels away.
// They don't earn badges: badges are only yours (Ranking).
//  - Pilots and co-pilots: every flight they fly (block minutes plus each landing).
//  - Flight attendants: every flight they work on; an aircraft needs one per 50 seats.
//  - Mechanics: the turnaround check after each landing at their base, and every repair.

const LEVEL_MAX = 500;
const LEVEL_XP = { length: LEVEL_MAX };   // "Level x of 500"
/** Experience needed for a level (1 at 0; about 4,300 for 10, 325,000 for 100, 6,000,000 for 500). */
function xpForLevel(l: number): number { return l <= 1 ? 0 : Math.round(83 * Math.pow(l - 1, 1.8)); }
// titles by level: the first from level 1, the next from the level shown, and so on
const LEVEL_STEPS = [1, 15, 40, 80, 130, 190, 260, 340, 420, 480];
const LEVEL_TITLES: { [role: string]: string[] } = {
  captain: ['New captain', 'Line captain', 'Established captain', 'Experienced captain', 'Senior captain', 'Senior captain', 'Training captain', 'Check captain', 'Chief captain', 'Master captain'],
  fo: ['Junior first officer', 'First officer', 'First officer', 'Experienced first officer', 'Senior first officer', 'Senior first officer', 'Command-ready first officer', 'Command-ready first officer', 'Command-ready first officer', 'Command-ready first officer'],
  fa: ['Trainee attendant', 'Flight attendant', 'Experienced attendant', 'Senior attendant', 'Purser', 'Purser', 'Senior purser', 'Senior purser', 'Chief purser', 'Chief purser'],
  ground: ['Trainee', 'Ground handler', 'Ground handler', 'Experienced handler', 'Senior handler', 'Senior handler', 'Team leader', 'Team leader', 'Ramp supervisor', 'Ground operations manager'],
  mech: ['Apprentice mechanic', 'Mechanic', 'Licensed engineer', 'Licensed engineer', 'Senior engineer', 'Senior engineer', 'Lead engineer', 'Lead engineer', 'Chief engineer', 'Chief engineer'],
};
const NEG_TITLES: { [role: string]: string } = { ground: 'Handler on probation', captain: 'Captain on probation', fo: 'First officer on probation', fa: 'Attendant on probation', mech: 'Mechanic on probation' };

function levelOf(xp: number): { level: number; from: number; to: number; p: number } {
  xp = xp || 0;
  if (xp < 0) {
    // below zero: a level down for every 200 points, down to -50
    const level = -Math.min(50, Math.ceil(-xp / 200)), from = -(-level) * 200, to = (-level - 1) * -200;
    return { level, from, to, p: clamp((xp - from) / (to - from), 0, 1) };
  }
  let lo = 1, hi = LEVEL_MAX;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (xpForLevel(m) <= xp) lo = m; else hi = m - 1; }
  const from = xpForLevel(lo), to = lo < LEVEL_MAX ? xpForLevel(lo + 1) : from;
  return { level: lo, from, to, p: to > from ? clamp((xp - from) / (to - from), 0, 1) : 1 };
}
function levelTitle(p: any): string {
  const r = personRole(p), l = levelOf(p.xp).level;
  if (l < 0) return NEG_TITLES[r] || NEG_TITLES.captain;
  let i = 0; while (i < LEVEL_STEPS.length - 1 && l >= LEVEL_STEPS[i + 1]) i++;
  return (LEVEL_TITLES[r] || LEVEL_TITLES.captain)[i];
}

/** The experience a new person brings from their working life before (the same person always gets the same):
 *  pilots by their flying hours, cabin crew and mechanics by their years in aviation; a few start fresh,
 *  and a few have a poor record that puts them below zero. */
function startingXp(seed: string, role: string, ageYears: number, hoursMin?: number): number {
  const r = seeded(seed + '|career'), roll = r();
  if (roll < 0.05) return -Math.round((1 + r() * 29) * 200 - 100);          // a poor record: level -1 to -30
  if (roll < 0.15) return Math.round(r() * xpForLevel(5));                  // just starting out: level 1 to 5
  if (hoursMin) return Math.round(hoursMin * (1 + r() * 0.4));                // pilots: about a point per minute flown
  const years = Math.max(0, (ageYears - 21) * (0.3 + r() * 0.7));
  return Math.round(years * (role === 'mech' ? 30000 : 38000) * (0.7 + r() * 0.6));
}

/** Experience for one person; announces a new level. */
function gainXp(p: any, amount: number, quiet?: boolean) {
  if (!p || p.you || !amount) return;
  const before = levelOf(p.xp).level, title0 = levelTitle(p);
  p.xp = Math.round((p.xp || 0) + amount);
  const after = levelOf(p.xp).level;
  if (after <= before) return;
  // each level a little better: about +0.004 rating per level, so a long career adds up to two stars
  p.rating = clamp(Math.round(((p.rating || 4) + 0.004 * (after - before)) * 1000) / 1000, 1, 5);
  // news only at milestones and promotions, not for every level
  const milestone = Math.floor(after / (after <= 100 ? 10 : 25)) > Math.floor(before / (before <= 100 ? 10 : 25)) || (before < 1 && after >= 1);
  if (quiet || (!milestone && levelTitle(p) === title0)) return;
  State.notices.unshift({ id: uid(), kind: 'staff' as any, title: `${p.name} reached level ${after}`, body: `${levelTitle(p)}. More experience means a better rating and fewer mistakes.`, time: 'Now', read: false, ref: p.id } as any);
}

/** After any flight of the airline: the pilot, co-pilot, cabin crew and the mechanic on the turnaround. */
function crewAfterLeg(cid: string, opts: { pilotId?: string; coPilot?: boolean; typeId?: string; from?: string; to?: string; blockMin: number; quiet?: boolean }) {
  const q = opts.quiet, block = Math.max(10, opts.blockMin || 60);
  if (opts.pilotId) gainXp(pilot(opts.pilotId), block + 20, q);
  if (opts.coPilot) { const co: any = State.pilots.filter((x: any) => x.coPilotFor === cid)[0]; if (co) gainXp(co, block + 20, q); }
  const t = opts.typeId ? acType(opts.typeId) : null;
  // cabin crew: one attendant per 50 seats (none on small aircraft), those based at the departure airport first
  const need = t && t.seats >= 20 ? Math.ceil(t.seats / 50) : 0;
  if (need) {
    const fas = staffOf(cid, 'fa').filter((s: any) => s.status !== 'off');
    const here = fas.filter(s => s.base === opts.from), rest = fas.filter(s => s.base !== opts.from);
    const turn = _hashStr((opts.from || '') + (opts.to || '') + Date.now()) ;
    const pick = here.concat(rest.slice(turn % Math.max(1, rest.length)).concat(rest.slice(0, turn % Math.max(1, rest.length)))).slice(0, need);
    pick.forEach(s => gainXp(s, block, q));
  }
  // the turnaround check at the arrival airport
  const mechs = staffOf(cid, 'mech').filter((s: any) => s.status !== 'off');
  const m = mechs.filter(s => s.base === opts.to)[0] || mechs[_hashStr((opts.to || '') + block) % Math.max(1, mechs.length)];
  if (m) gainXp(m, 25, q);
  // the airline's own ground crew on the turnaround at either end (drivers, baggage, ramp, dispatch)
  const grd = staffOf(cid, 'ground').filter((s: any) => s.status !== 'off' && !s.apronLeave);
  [opts.from, opts.to].forEach(k => grd.filter(s => s.base === k).slice(0, 4).forEach(s => gainXp(s, 20, q)));
}

/** A finished repair: experience for the airline's mechanics at that base. */
function crewAfterRepair(cid: string, base: string, minutes: number) {
  const mechs = staffOf(cid, 'mech'), here = mechs.filter(s => s.base === base);
  (here.length ? here : mechs.slice(0, 1)).forEach(s => gainXp(s, Math.max(20, minutes)));
}

/** Level chip for cards and lists. */
function levelChip(p: any): string {
  if (!p || p.you) return '';
  const l = levelOf(p.xp);
  return `<span class="lvl ${l.level < 0 ? 'neg' : ''}" title="${esc(levelTitle(p))}"><b>Lv ${l.level}</b><i><s style="width:${(l.p * 100).toFixed(0)}%"></s></i></span>`;
}
