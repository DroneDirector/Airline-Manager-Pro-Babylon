// Ground handling. At your hub and every other airport where you base aircraft, your own ground crew
// turn the aircraft round: unloading and loading bags and cargo, fuelling, catering, toilets and water,
// stairs and power, de-icing and the push-back. Without them nothing leaves: no ground crew at a base
// (none hired, all off sick, on leave or on strike) means the aircraft there can't fly; too few means a
// slower turnaround. At every other airport the local handling company does it for a fee.

// Your own ramp team on one turnaround, by aircraft class (docs/reference/ground-handling.txt): loaders for bags
// and cargo, the push-back driver and a ramp lead. Fuel and catering come from the airport's companies.
// A small aircraft's pilot handles it alone.
const GROUND_NEED: { [cls: string]: number } = { ga: 0, bush: 1, turboprop: 3, regional: 4, airliner: 6, widebody: 10, helicopter: 1 };
// Ground staff a base supports for each aircraft based there (two shifts a day, days off and leave):
// about two ramp teams per based aircraft.
const GROUND_PER_BASED: { [cls: string]: number } = { ga: 1, bush: 2, turboprop: 6, regional: 8, airliner: 12, widebody: 22 };

/** Your bases: the hub and every airport where one of the airline's aircraft is based. */
function companyBases(cid: string): string[] {
  const c = company(cid), set: string[] = c && c.hub ? [c.hub] : [];
  fleetOf(cid).forEach(a => { if (a.base && set.indexOf(a.base) < 0) set.push(a.base); });
  return set.filter(k => apt(k));
}
function isBase(cid: string, icao: string): boolean { return companyBases(cid).indexOf(icao) >= 0; }
/** Your own ground crew at work at an airport right now. */
function groundCrewFree(cid: string, icao: string): any[] {
  const S: any = State;
  return ((S.staff || []) as any[]).filter(p => p.companyId === cid && p.role === 'ground' && p.base === icao && !p.onStrike && !p.apronLeave && !p.left
    && !(typeof isSick === 'function' && isSick(p)));   // off shift can be called in
}
function groundGraceOn(cid: string): boolean { const c: any = company(cid); return !!(c && c.groundGrace && c.groundGrace > Date.now()); }

/** Can this aircraft be turned round here? '' when yes; the reason when not; slowMin when short-handed. */
function groundBlock(cid: string, icao: string, typeId: string): { why: string; slowMin: number } {
  if (!isBase(cid, icao) || groundGraceOn(cid)) return { why: '', slowMin: 0 };    // the local handling company
  const t = acType(typeId), need = GROUND_NEED[t ? t.cls : 'airliner'] != null ? GROUND_NEED[t.cls] : 4;
  if (!need) return { why: '', slowMin: 0 };
  // other aircraft being turned round at the same base at the same time take their own teams
  const S: any = State, now = Date.now();
  const busy = ((S.aiNext || []) as any[]).filter(x => x.from === icao && plane(x.reg) && plane(x.reg).companyId === cid && x.depAt > now && x.depAt - now < AI_TURN_MIN * 60e3)
    .reduce((s2, x) => s2 + (GROUND_NEED[acType(plane(x.reg).typeId).cls] || 0), 0);
  const all = groundCrewFree(cid, icao).length, free = Math.max(Math.min(all, 1), all - busy);   // a busy base still has someone, just slower
  if (!free) {
    const hired = staffOf(cid, 'ground').filter((p: any) => p.base === icao).length;
    const why = `No ground crew at ${icao}${hired ? (staffOf(cid, 'ground').some((p: any) => p.base === icao && p.onStrike) ? ' (on strike)' : ' (all off sick or on leave)') : ''}: nobody to unload, load, fuel or push back`;
    groundWarn(cid, icao, hired);
    return { why, slowMin: 0 };
  }
  if (free < need) return { why: '', slowMin: Math.min(120, Math.round(AI_TURN_MIN * (need / free - 1))) };
  return { why: '', slowMin: 0 };
}
/** Once a day per base: tell you the aircraft there are stuck, and how to fix it. */
function groundWarn(cid: string, icao: string, hired: number) {
  const S: any = State, k = cid + ':' + icao, day = new Date().toDateString();
  S.groundWarned = S.groundWarned || {}; if (S.groundWarned[k] === day) return; S.groundWarned[k] = day;
  State.notices.unshift({ id: uid(), kind: 'staff' as any, title: `No ground crew at ${icao}: aircraft can't leave`, body: hired
    ? `Your ground crew at ${icao} are all unavailable (sick, on leave or on strike). Nobody can unload, load, fuel, cater or push back, so your aircraft there wait. Bring people back, settle the dispute, or transfer ground staff to ${icao}.`
    : `${icao} is one of your bases, and bases need your own ground crew: baggage handlers, push-back and fuel drivers, ramp agents. Hire them under Crew → Hire → Ground staff. Until then your aircraft at ${icao} can't leave.`, time: 'Now', at: Date.now(), read: false } as any);
  try { renderTopbar(); } catch (e) { /* not ready */ }
}

/** Once, on the update that brought this in: airlines without ground crew at a base get three days to hire,
 *  with the local handling company standing in (and you are told). */
function groundMigrate() {
  const S: any = State; if (S.groundV1) return; S.groundV1 = true;
  for (const c of State.companies) {
    const missing = companyBases(c.id).filter(k => fleetOf(c.id).some(a => (a.base || c.hub) === k && (GROUND_NEED[acType(a.typeId).cls] || 0) > 0) && !staffOf(c.id, 'ground').some((p: any) => p.base === k));
    if (!missing.length) continue;
    (c as any).groundGrace = Date.now() + 3 * 864e5;
    State.notices.unshift({ id: uid(), kind: 'staff' as any, title: `${c.name} needs its own ground crew`, body: `Your bases (${missing.join(', ')}) now need your own ground crew to turn aircraft round. The local handling company stands in for three more days; hire ground staff under Crew → Hire before then, or the aircraft there can't leave.`, time: 'Now', at: Date.now(), read: false } as any);
  }
}
