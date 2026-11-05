/* The ground model: where an aircraft near an airport is, the same for every view (the world map at any zoom, the
 * airport view, the 3D view, the flight trace). Near its departure or arrival airport an aircraft is placed by that
 * airport's taxi model (src/screens/airport-view.ts): it lands on the runway, leaves by an exit, taxis along the
 * taxiways, holds short where it must and parks on its own stand; it pushes back, taxis out, holds short and lines up.
 * Every airport and every type, with the airport's real layout, or a simple one where there is none. Further out it
 * follows its route. Positions come from the flight's own clock, so after the app was away the aircraft is simply
 * where its route has taken it by then; between two looks a few seconds apart it never moves faster than it can roll
 * (AirportView.groundSmooth). */

const GROUND_RANGE_NM = 7;   // within this of an airport (the airport model's range): placed by the airport
const GroundSim = {
  /** The last place each flight was shown near an airport (lon/lat), when, how high and how fast. */
  last: {} as { [id: string]: { ll: number[]; t: number; alt: number; kt: number } },
  /** When a flight was set down at its place on purpose (a placement, not movement). */
  placed: {} as { [id: string]: number },
  _c: {} as { [id: string]: { t: number; ll: number[] | null; p: any } },
  /** The airport whose model places a flight now (its departure or arrival airport, when close). */
  airportOf(f: LiveFlight): string {
    const F: any = f; if (!F.depAt || (f.real && f.you)) return '';
    const pp = flightPathPos(f); if (!pp) return '';
    for (const k of [f.from, f.noDest ? null : f.to]) { const a = k && apt(k); if (a && gcDistanceNm(pp.pos, a.pos) < GROUND_RANGE_NM) return k; }
    return '';
  },
  /** The airport model's aircraft for a flight (or null: far from the airports, or the layout isn't loaded yet). */
  plane(f: LiveFlight): any {
    const now = Date.now(), C = this._c[f.id];
    if (C && now - C.t < 200) return C.p;
    let p: any = null, ll: number[] = null;
    try {
      const icao = this.airportOf(f);
      if (icao) {
        // a few airports at a time (each loads its layout once): the rest follow their route until there is room
        const have = _aptScenes[icao] && (_aptScenes[icao] as any).alive, n = Object.keys(_aptScenes).length;
        const sc: any = have || n < 12 ? makeAirportScene(icao, null as any) : null;
        if (sc && sc.L && sc.graph) {
          if (!sc._cpT || now - sc._cpT >= 200) { sc._cpT = now; sc.computePlanes(now); }
          p = (sc.planes || []).filter((x: ApvPlane) => x.id === f.id)[0] || null;
          if (p) ll = sc.lonLat(p.x, p.y);
        }
      }
    } catch (e) { p = null; ll = null; }
    this._c[f.id] = { t: now, ll, p };
    return p;
  },
  /** Where a flight near an airport is (lon/lat), or null to follow its route. */
  pos(f: LiveFlight): number[] | null { this.plane(f); const C = this._c[f.id]; return C ? C.ll : null; },
};
// flights that have ended are forgotten; airport models nobody has used for a while are let go
setInterval(() => {
  try {
    const ids: any = {}; for (const f of State.live) ids[f.id] = 1;
    for (const k of Object.keys(GroundSim.last)) if (!ids[k]) delete GroundSim.last[k];
    for (const k of Object.keys(GroundSim._c)) if (!ids[k]) delete GroundSim._c[k];
    for (const k of Object.keys(GroundSim.placed)) if (!ids[k]) delete GroundSim.placed[k];
    const now = Date.now(); for (const k of Object.keys(_aptScenes)) { const sc: any = _aptScenes[k]; if (now - (sc.usedAt || 0) > 15 * 60e3 && now - (sc._cpT || 0) > 15 * 60e3) { sc.alive = false; delete _aptScenes[k]; } }
  } catch (e) { /* next time */ }
}, 60000);
