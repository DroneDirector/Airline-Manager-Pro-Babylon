/* Failures and emergencies.
 * - Your own flight, linked to Flight Simulator: only what the simulator reports (engine fire, engine
 *   failure, and the other failures the PC app reads). Nothing is made up for it.
 * - Hired pilots' flights (and your flight with no simulator): the app's own failures, by chance and very
 *   rarely, more often on aircraft in poor condition or poorly maintained. Most are small (a fault the crew
 *   handle, written up for the mechanics); serious ones are much rarer, an engine fire rarest of all.
 * - After an engine fire or an engine shut down, the aircraft lands as an emergency: it stops on the
 *   runway, the fire crews meet it (and put the fire out), and after a fire it is towed to the stand.
 *   Without a fire, with one engine still running, it taxis in by itself. */

interface Failure { id: string; title: string; sev: 'minor' | 'moderate' | 'severe'; w: number; text: string; eng?: boolean; fire?: boolean; stopS?: number; cost: number }
const FAILURES: Failure[] = [
  { id: 'elec', title: 'Electrical fault', sev: 'minor', w: 5, text: 'A generator dropped off line; the crew switched to the backup and carried on.', cost: 9000 },
  { id: 'hyd', title: 'Hydraulic leak', sev: 'minor', w: 3, text: 'One hydraulic system lost fluid; the others took over and the flight carried on normally.', cost: 14000 },
  { id: 'bleed', title: 'Bleed air fault', sev: 'minor', w: 4, text: 'A bleed air valve failed; the crew flew a little lower with one air conditioning pack.', cost: 7000 },
  { id: 'radar', title: 'Weather radar failure', sev: 'minor', w: 3, text: 'The weather radar failed; the crew got the weather from air traffic control instead.', cost: 11000 },
  { id: 'pack', title: 'Air conditioning pack failure', sev: 'minor', w: 3, text: 'One air conditioning pack failed; the cabin was a little warm.', cost: 6000 },
  { id: 'gear', title: 'Landing gear indication', sev: 'moderate', w: 3, text: 'The gear did not show down and locked; the crew lowered it by the alternate system and flew past the tower to have it checked before landing.', stopS: 0, cost: 26000 },
  { id: 'flaps', title: 'Flap failure', sev: 'moderate', w: 3, text: 'The flaps jammed; the crew made a faster landing with fire crews standing by.', stopS: 60, cost: 38000 },
  { id: 'press', title: 'Loss of cabin pressure', sev: 'moderate', w: 2, text: 'The cabin lost pressure; the oxygen masks dropped and the crew made an emergency descent before carrying on lower.', cost: 45000 },
  { id: 'engout', title: 'Engine shut down in flight', sev: 'moderate', w: 3, eng: true, text: 'An engine lost oil pressure and the crew shut it down, declared an emergency and landed on the other engine.', stopS: 90, cost: 160000 },
  { id: 'fire', title: 'Engine fire', sev: 'severe', w: 1, eng: true, fire: true, text: 'An engine caught fire. The crew shut it down and fired the extinguishers, declared an emergency and landed with fire crews waiting; the aircraft was towed in.', stopS: 240, cost: 620000 },
];

/** At departure: does this flight get a failure on the way (decided now, shown when it happens)? */
function maybeFailure(f: any, a: any, prof: FlightProfile): boolean {
  if (!f || f.you || f.real || f.coop || f.emerg) return false;
  const cond = a && a.condition != null ? a.condition : 90;
  let mq = 0.75; try { mq = maintQuality(a.companyId).q; } catch (e) { /* average */ }
  const k = (0.6 + Math.max(0, 85 - cond) / 25) * (1.4 - mq * 0.8);
  const r = Math.random(), pick = (sev: string) => { const l = FAILURES.filter(x => x.sev === sev), tw = l.reduce((s, x) => s + x.w, 0); let q = Math.random() * tw; for (const x of l) { q -= x.w; if (q <= 0) return x; } return l[0]; };
  const F = r < 0.000025 * k ? pick('severe') : r < 0.0004 * k ? pick('moderate') : r < 0.004 * k ? pick('minor') : null;
  if (!F) return false;
  if (F.eng && (acType(a.typeId) || {} as any).engines < 2) return false;   // single-engine aircraft: not this
  const pts = prof.pts, cr = pts.filter(x => /cruise|climb/i.test(x.ph)), at = cr.length ? cr[Math.floor(cr.length * (0.2 + Math.random() * 0.6))].s : prof.totalS * 0.4;
  f.emerg = { id: F.id, at, eng: Math.random() < 0.5 ? 0 : 1, noted: false };
  // the stop on the runway after landing (fire crews, inspection): a hold where the landing roll ends
  if (F.stopS) {
    const ti = pts.findIndex(x => /taxi in/i.test(x.ph)), s = ti > 0 ? pts[ti - 1].s : prof.totalS - 300;
    f.holds = (f.holds || []).concat([{ at: s, s: F.stopS, kind: 'runway', why: F.fire ? 'Stopped on the runway: fire crews at the engine' : 'Stopped on the runway: fire crews checking the aircraft' } as Hold]).sort((x: Hold, y: Hold) => x.at - y.at);
    f.emerg.stopAt = s; f.emerg.stopS = F.stopS;
  }
  f.emerg.tow = !!F.fire;
  return true;
}
function failureOf(f: any): Failure { return f && f.emerg ? FAILURES.filter(x => x.id === f.emerg.id)[0] || null : null; }

/** When it happens: the notice, the news for the serious ones, the write-up for the mechanics. */
function failureNote(f: any) {
  const e = f.emerg, F = failureOf(f); if (!e || e.noted || !F) return; e.noted = true;
  const a = plane(f.reg);
  const emergency = F.sev !== 'minor';
  State.notices.unshift({ id: uid(), kind: 'pilot', title: `${f.callsign}: ${F.title.toLowerCase()}${emergency ? ', emergency declared' : ''}`, body: `${F.text} ${f.from} to ${f.to}${a ? ', ' + a.reg : ''}.${F.fire ? ' The fire is out.' : ''}`, time: 'Now', read: false, ref: f.id } as any);
  if (a) State.issues.unshift({ id: uid(), reg: a.reg, title: F.title, detail: F.text, source: `${f.callsign}, ${f.from} to ${f.to}`, severity: F.sev === 'severe' ? 'grounding' : F.sev === 'moderate' ? 'major' : 'minor', cost: F.cost, days: F.sev === 'severe' ? 6 : F.sev === 'moderate' ? 2 : 0, status: 'open', date: dateStr(new Date()).slice(0, 10) } as any);
  try { if (F.sev !== 'minor') Progress.popularity(F.sev === 'severe' ? -4 : -1, F.title); } catch (e2) { /* ignore */ }
  try { renderTopbar(); Sound.chime(); } catch (e2) { /* not ready */ }
}

/** Is an engine burning right now (own flight: from the simulator; hired flights: the planned fire, until it is out)? */
function engineFire(f: any, el?: number): number {
  if (!f) return -1;
  if (f.you || f.real) { const L: any = typeof Link !== 'undefined' ? (Link as any).sim : null; const fires: boolean[] = L && L.fires; if (fires && L.t && Date.now() - L.t < 15000) { const i = fires.indexOf(true); return i; } return -1; }
  const e = f.emerg, F = failureOf(f); if (!e || !F || !F.fire || el == null) return -1;
  return el >= e.at && el < e.at + 75 ? e.eng : -1;   // the extinguishers put it out in about a minute
}
/** A failed engine (stopped): from the simulator for your own flight, from the planned failure for hired ones. */
function engineOut(f: any, el?: number): number {
  if (!f) return -1;
  if (f.you || f.real) { const L: any = typeof Link !== 'undefined' ? (Link as any).sim : null; const fl: boolean[] = L && L.engFailed; if (fl && L.t && Date.now() - L.t < 15000) return fl.indexOf(true); return -1; }
  const e = f.emerg, F = failureOf(f); if (!e || !F || !F.eng || el == null) return -1;
  return el >= e.at ? e.eng : -1;
}
