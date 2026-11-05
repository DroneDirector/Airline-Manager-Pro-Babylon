// Delays, rare as in real life, for hired (AI) pilots only: never for co-op players or for you. When a
// hired pilot's flight sets off it may get one, for a real reason:
//   at the gate: de-icing, a late inbound crew, a departure slot (ATC flow control), a technical check,
//     a baggage offload, fog at the destination, thunderstorms on the route, strong crosswind;
//   at the holding point: a departure queue, a runway inspection, bird activity, a runway change;
//   before landing: a holding pattern (arrival traffic, weather at the airport, a short runway closure);
//   on final: a go-around (wind shear, runway not clear, unstable approach) and a second approach.
// The chances are small and go up with the weather: strong wind at the airports, winter at higher
// latitudes for de-icing. The delay is stored with the flight, so it is the same everywhere (the map,
// the airport, the schedule and the arrival time) and survives closing the app.

interface Hold { at: number; s: number; kind: 'gate' | 'runway' | 'air' | 'goaround'; why: string; noted?: boolean }

const DELAY_REASONS = {
  gate: [['De-icing', 10, 25], ['Late inbound crew', 10, 30], ['Departure slot (ATC flow control)', 10, 40], ['Technical check', 15, 45], ['Baggage offload', 10, 20], ['Fog at the destination', 20, 60], ['Thunderstorms on the route', 15, 45], ['Strong crosswind', 15, 40]],
  runway: [['Departure queue', 3, 10], ['Runway inspection', 5, 15], ['Bird activity', 5, 10], ['Runway change after a wind shift', 5, 12]],
  air: [['Holding: arrival traffic', 5, 15], ['Holding: weather at the airport', 10, 25], ['Holding: runway closed for a short time', 10, 20]],
  goaround: [['Go-around: wind shear', 6, 10], ['Go-around: runway not clear', 6, 9], ['Go-around: unstable approach', 6, 9]],
} as { [k: string]: [string, number, number][] };

/** Pick the delays of a flight that is setting off now (most flights get none). Only for hired (AI)
 *  pilots: co-op flights are flown by real people, and your own flights by you. */
function assignDelays(F: any, prof: FlightProfile) {
  if (F.holds) return;
  if (F.coop || F.you || F.real) { F.holds = []; return; }
  const A: any = apt(F.from), B: any = apt(F.to); if (!A || !B) { F.holds = []; return; }
  const wa = airportWind(F.from, A.pos), wb = airportWind(F.to, B.pos), month = new Date().getMonth();
  const winter = (month >= 10 || month <= 2) && Math.abs(A.pos[1]) > 45, windy = (w: any) => w.kt >= 25 ? 2.5 : w.kt >= 18 ? 1.5 : 1;
  const pick = (k: string, ok?: (name: string) => boolean) => { const l = DELAY_REASONS[k].filter(r => !ok || ok(r[0])); const r = l[Math.floor(Math.random() * l.length)]; return { why: r[0], s: Math.round((r[1] + Math.random() * (r[2] - r[1])) * 60) }; };
  const holds: Hold[] = [];
  // at the gate: about 1 in 100 flights, more in winter and wind
  if (Math.random() < 0.012 * windy(wa) + (winter ? 0.008 : 0)) {
    const r = pick('gate', n => (n !== 'De-icing' || winter) && (n !== 'Strong crosswind' || wa.kt >= 20));
    holds.push({ at: 0, s: r.s, kind: 'gate', why: r.why });
  }
  const span = (ph: string) => { const pts = prof.pts; let a = -1, b = -1; for (let i = 1; i < pts.length; i++) if (pts[i].ph === ph) { if (a < 0) a = pts[i - 1].s; b = pts[i].s; } return a < 0 ? null : [a, b]; };
  // at the holding point, before the take-off: about 6 in 1,000
  const tx = span('Taxi out');
  if (tx && Math.random() < 0.006 * windy(wa)) { const r = pick('runway'); holds.push({ at: tx[1] - 1, s: r.s, kind: 'runway', why: r.why }); }
  // a holding pattern before the approach: about 6 in 1,000; a go-around: about 2 in 1,000
  const ld = span('Landing'), dc = span('Descent') || span('Approach');
  if (dc && Math.random() < 0.006 * windy(wb)) { const r = pick('air'); holds.push({ at: dc[1] - 1, s: r.s, kind: 'air', why: r.why }); }
  else if (ld && Math.random() < 0.002 * windy(wb)) { const r = pick('goaround', n => n !== 'Go-around: wind shear' || wb.kt >= 15); holds.push({ at: Math.max(0, ld[0] - 40), s: r.s, kind: 'goaround', why: r.why }); }
  F.holds = holds.sort((x, y) => x.at - y.at);
  F.delayS = holds.reduce((t, h) => t + h.s, 0);
  F.durMs = (F.durMs || prof.totalS * 1000) + F.delayS * 1000;
  // the people at the airline hear about it straight away for the delays known before the flight
  for (const h of holds) if (h.kind === 'gate') {
    h.noted = true;
    State.notices.unshift({ id: uid(), kind: 'pilot', title: `${F.callsign} delayed at ${F.from}`, body: `${h.why}: about ${Math.round(h.s / 60)} minutes. ${F.from} to ${F.to}.`, time: 'Now', read: false, ref: F.id } as any);
  }
}

/** Seconds into the flight's profile right now (sim time), and the delay it is in, if any. */
function flightEl(F: any, now: number): { el: number; hold: Hold; inHold: number } {
  let raw = Math.max(0, (now - F.depAt) * (F.coop ? 1 : (F.spd || 1)) / 1000);
  for (const h of (F.holds || []) as Hold[]) {
    if (raw <= h.at) break;
    if (raw < h.at + h.s) return { el: h.at, hold: h, inHold: raw - h.at };
    raw -= h.s;
  }
  return { el: raw, hold: null, inHold: 0 };
}

/** Seconds of delay still ahead of a flight (the rest of the current one, and the ones to come). */
function holdsLeft(F: any, fe: { el: number; hold: Hold; inHold: number }): number {
  let t = 0;
  for (const h of (F.holds || []) as Hold[]) { if (h === fe.hold) t += h.s - fe.inHold; else if (h.at > fe.el || (h.at === fe.el && !fe.hold)) t += h.s; }
  return t;
}

/** A delay that has just begun: a notice for the ones that happen on the way. */
function noteHold(F: any, h: Hold) {
  if (!h || h.noted) return; h.noted = true;
  const where = h.kind === 'runway' ? `holding short at ${F.from}` : h.kind === 'air' ? `holding before ${F.to}` : h.kind === 'goaround' ? `went around at ${F.to}` : `delayed at ${F.from}`;
  State.notices.unshift({ id: uid(), kind: 'pilot', title: `${F.callsign} ${where}`, body: `${h.why}: about ${Math.round(h.s / 60)} more minutes.`, time: 'Now', read: false, ref: F.id } as any);
  try { renderTopbar(); } catch (e) { /* not ready */ }
}

/** The label shown for a flight in a delay. */
function holdLabel(h: Hold): string {
  return h.kind === 'gate' ? 'Delayed: ' + h.why : h.kind === 'runway' ? 'Holding short: ' + h.why : h.why;
}
