// What happens on board, live: passengers getting off and on, the aircraft cleaned and catered, fuel going
// in at the gate and burning off in the air, bags loaded. Worked out from each flight's own timeline, so the
// numbers count up and down smoothly while you watch:
//   at the gate after landing   deboarding (first quarter of the turnaround), cleaning, catering, refuelling
//   before push-back            boarding and the bags, up to the passengers booked on the next flight
//   in the air                  the fuel burning off from the take-off fuel to the landing fuel

interface OnBoard { stage: string; pax: number; paxMax: number; fuelKg: number; fuelTo: number; fuelNote: string; catering: number; bags: number; clean: number; next?: string }

/** Seconds at the gate before push-back in the "taxi out" part of a flight (boarding and bags). */
function gateWaitS(prof: FlightProfile): number {
  const tk = prof.pts.filter(x => x.ph === 'Takeoff')[0]; if (!tk) return 0;
  const taxi = clamp(tk.s * 0.45, 180, 900);
  return Math.max(0, tk.s - (75 + taxi + 60));
}

/** Fuel (kg) at take-off and at landing for a flight. */
function legFuel(typeId: string, pax: number, from: string, to: string): { to: number; land: number } {
  const A = apt(from), B = apt(to), d = A && B ? gcDistanceNm(A.pos, B.pos) : 300;
  const W = flightWeights(typeId, pax, d);
  return { to: Math.round((W.tow - W.zfw) * 1000), land: Math.round((W.lw - W.zfw) * 1000) };
}

/** On board a flight right now. */
function onBoardFlight(f: LiveFlight, now?: number): OnBoard {
  // only hired pilots' flights: your own flight's passengers and fuel come from the simulator alone
  if (f.you || f.real) return null;
  now = now || Date.now();
  const F: any = f, t = acType(flightTypeId(f)) || AIRCRAFT[0], paxMax = f.paxMax || t.seats;
  const fuel = legFuel(t.id, f.pax || 0, f.from, f.noDest ? f.from : f.to);
  const out: OnBoard = { stage: 'In the air', pax: f.pax || 0, paxMax, fuelKg: fuel.to, fuelTo: fuel.to, fuelNote: '', catering: 1, bags: 1, clean: 1 };
  if (!F.depAt || f.real) return out;
  const prof = aiProfile(F), el = flightEl(F, now).el, wait = gateWaitS(prof);
  const tk = prof.pts.filter(x => x.ph === 'Takeoff')[0], td = prof.pts.filter(x => x.ph === 'Landing')[0];
  const taxiBurn = Math.round(fuel.to * 0.012);
  if (el < wait) {
    // everyone boarded during the turnaround; doors closed, waiting for push-back
    out.stage = 'Doors closed'; out.fuelKg = fuel.to + taxiBurn; out.fuelNote = 'Fuelled';
  } else if (tk && el < tk.s) {
    out.stage = 'Taxi'; out.fuelKg = Math.round(fuel.to + taxiBurn * (1 - (el - wait) / Math.max(1, tk.s - wait))); out.fuelNote = 'Burning';
  } else if (tk && td && el < td.s) {
    // in flight: the trip fuel burns along the way (a little faster in the climb)
    const k = clamp((el - tk.s) / (td.s - tk.s), 0, 1), kb = Math.pow(k, 0.9);
    out.fuelKg = Math.round(fuel.to - (fuel.to - fuel.land) * kb); out.fuelNote = 'Burning';
    out.stage = /descent|approach|final/i.test(f.phase) ? 'Descending' : /climb/i.test(f.phase) ? 'Climbing' : 'Cruising';
    out.catering = 1 - 0.8 * clamp(k * 1.6 - 0.15, 0, 1);   // the meal service
  } else {
    out.stage = 'Taxi in'; out.fuelKg = fuel.land - taxiBurn; out.fuelNote = 'Landed with'; out.catering = 0.2;
  }
  return out;
}

/** On board an aircraft standing at the gate between flights (the turnaround). */
function onBoardParked(a: Aircraft, now?: number): OnBoard {
  // the aircraft you fly yourself: nothing is boarded or fuelled for you
  if (a.reg === (State as any).myReg[a.companyId]) return null;
  now = now || Date.now();
  const A: any = a, t = acType(a.typeId), S: any = State;
  const next = (S.aiNext || []).filter((n: any) => n.reg === a.reg)[0];
  const gate = A.lastGateAt || 0, dep = next ? next.depAt : 0;
  if (!gate || !dep || dep <= gate || now < gate) return null;
  const W = dep - gate, k = clamp((now - gate) / W, 0, 1);
  const booked = aiPlannedLoad(next).pax;
  const fuelIn = A.lastFuelKg || 0, nextFuel = legFuel(a.typeId, booked, next.from, next.to).to;
  const seg = (a0: number, a1: number) => clamp((k - a0) / (a1 - a0), 0, 1);
  // a real turnaround: off, clean, cater and fuel, then the next passengers on with their bags
  // as in real life, from the number of people: the door opens about a minute after arrival and some 22 people a
  // minute leave; boarding takes about a minute for every 10 people and ends five minutes before departure (doors
  // closed). The cleaning, catering and fuelling fit in between.
  const MIN = 60e3, debEnd = Math.min(0.45, (MIN + (A.lastPax || 0) / 22 * MIN) / W), brdLen = Math.min(0.5, (booked / 10 * MIN + MIN) / W), brdEnd = Math.max(debEnd + 0.1, 1 - 5 * MIN / W), brdStart = Math.max(debEnd + 0.05, brdEnd - brdLen);
  const deb = seg(Math.min(MIN / W, debEnd * 0.5), debEnd), clean = seg(debEnd * 0.75, brdStart), cat = seg(debEnd, Math.max(debEnd + 0.05, brdStart - 0.02)), fuel = seg(debEnd + 0.02, Math.max(debEnd + 0.08, brdStart)), board = seg(brdStart, brdEnd);
  const stage = deb < 1 ? 'Deboarding' : board > 0 ? (board < 1 ? 'Boarding' : 'Doors closed') : fuel > 0 && fuel < 1 ? 'Refuelling' : clean < 1 || cat < 1 ? 'Cleaning and catering' : 'Ready for boarding';
  const pax = deb < 1 ? Math.round((A.lastPax || 0) * (1 - deb)) : Math.round(booked * board);
  return { stage, pax, paxMax: t.seats, fuelKg: Math.round(fuelIn + (Math.max(fuelIn, nextFuel) - fuelIn) * fuel), fuelTo: nextFuel,
    fuelNote: fuel > 0 && fuel < 1 ? 'Refuelling' : fuel >= 1 ? 'Fuelled' : 'On board', catering: cat, bags: deb < 1 ? 1 - deb : board, clean, next: `${next.from} → ${next.to} at ${new Date(dep).toTimeString().slice(0, 5)}` };
}

/** The on-board chips for a flight card or an aircraft. */
function onBoardHtml(o: OnBoard): string {
  if (!o) return '';
  const pct = (x: number) => Math.round(x * 100) + '%';
  // passengers on board out of the seats in the aircraft (the tickets sold for this flight), and how full that is
  const lf = o.paxMax ? Math.round(o.pax / o.paxMax * 100) : 0;
  // always three lines each (what it is, the number, how it stands), so the card keeps its size as they change
  return `<div class="sync-item ob">${icon('pax')}<span><small>Passengers</small><b>${num(o.pax)} <em class="ob-of">of ${num(o.paxMax)}</em></b><small class="ob-d">${esc(o.stage)}${/boarding|deboarding/i.test(o.stage) ? '' : ` · ${lf}% full`}</small></span></div>
    <div class="sync-item ob">${icon('fuel')}<span><small>Fuel</small><b>${num(o.fuelKg)} kg</b><small class="ob-d">${o.fuelNote ? esc(o.fuelNote) : '&nbsp;'}</small></span></div>
    <div class="sync-item ob">${icon('jobs')}<span><small>Catering and bags</small><b>${o.catering >= 1 && o.bags >= 1 ? 'Loaded' : `${pct(o.catering)} · ${pct(o.bags)}`}</b><small class="ob-d">&nbsp;</small></span></div>
    ${o.next ? `<div class="sync-item ob">${icon('clock')}<span><small>Next flight</small><b>${esc(o.next)}</b></span></div>` : ''}`;
}

/** The load booked on an aircraft's next leg, worked out once (the same numbers board and fly). */
function aiPlannedLoad(n: any): { pax: number; paxJ: number; paxF: number; cargoKg: number } {
  if (n.ld) return n.ld;
  const test = n.from === n.to;
  try { n.ld = test || n.ferry ? { pax: 0, paxJ: 0, paxF: 0, cargoKg: 0 } : n.job ? Jobs.loadFor(n.job) : aiLoad(n.reg, n.from, n.to, n.leg || 0); }
  catch (e) { n.ld = { pax: 0, paxJ: 0, paxF: 0, cargoKg: 0 }; }
  // a runway that limits the weight limits the passengers
  // the loaders keep within the runway's weight limit: cargo comes off first, then passengers
  try {
    const a = plane(n.reg), L = n.ld;
    if (a) {
      RW_PERF = (engineOf(a) && engineOf(a).perf) || 1;   // this aircraft's own engines
      const cargo = L.cargoKg || 0, full = legRunwayCheck(a.typeId, n.from, n.to, L.pax, cargo);
      if (full.maxPax < L.pax) {
        if (cargo && legRunwayCheck(a.typeId, n.from, n.to, L.pax, 0).maxPax >= L.pax) {
          let lo = 0, hi = cargo; while (hi - lo > 50) { const m = (lo + hi) / 2; if (legRunwayCheck(a.typeId, n.from, n.to, L.pax, m).maxPax >= L.pax) lo = m; else hi = m; }
          n.ld = Object.assign({}, L, { cargoKg: Math.floor(lo / 10) * 10, offloadKg: cargo - Math.floor(lo / 10) * 10 });
        } else {
          const rc = legRunwayCheck(a.typeId, n.from, n.to, L.pax, 0), k = rc.maxPax / Math.max(1, L.pax);
          n.ld = Object.assign({}, L, { cargoKg: 0, offloadKg: cargo, pax: rc.maxPax, paxJ: Math.floor((L.paxJ || 0) * k), paxF: Math.floor((L.paxF || 0) * k), offloadPax: L.pax - rc.maxPax });
        }
      }
    }
  } catch (e) { /* ignore */ }
  RW_PERF = 1;
  return n.ld;
}
