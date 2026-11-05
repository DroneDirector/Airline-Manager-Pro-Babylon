// Flight trace: a log of how every aircraft in the app flies, for checking that the simulation behaves.
// Every flight is sampled while the app is open (every 30 seconds, and at every change of phase): where it
// is, how high, its speed from the flight plan and its real speed over the ground worked out from how far it
// moved, its heading and its runway. Problems are marked:
//   JUMP        the aircraft moved much further than its speed allows (a glitch)
//   FAST        its speed over the ground is far above what the type can fly
//   OFF RUNWAY  it touched down away from the runway it was cleared to
//   RUNWAY      its approach was planned for one runway but it touched down on another
//   NO TOUCHDOWN it was logged as arrived without being seen to touch down (app closed, or a glitch)
// The log is kept on this device (the newest 8,000 lines) and saved as a text file from
// Settings → Updates and errors, together with the error log.

interface TraceLast { t: number; pos: number[]; ph: string; alt: number; logged: number; td?: boolean; tdRwy?: string; gapTd?: boolean }

const TRACE_KEY = 'airline-manager-pro.flight-trace';
const TRACE_MAX = 8000;

const FlightTrace = {
  lines: [] as string[],
  last: new Map<string, TraceLast>(),
  problems: 0,
  dirty: false,

  init() {
    try { this.lines = JSON.parse(localStorage.getItem(TRACE_KEY) || '[]') || []; } catch (e) { this.lines = []; }
    this.problems = this.lines.filter(l => / ! /.test(l)).length;
    setInterval(() => { if (!document.hidden) this.sample(Date.now()); }, 5000);
    setInterval(() => this.save(), 60000);
    window.addEventListener('pagehide', () => this.save());
  },
  save() {
    if (!this.dirty) return;
    if (this.lines.length > TRACE_MAX) this.lines.splice(0, this.lines.length - TRACE_MAX);
    try { localStorage.setItem(TRACE_KEY, JSON.stringify(this.lines)); this.dirty = false; } catch (e) { this.lines.splice(0, Math.floor(this.lines.length / 3)); }
  },
  stamp(t: number) { const d = new Date(t); return d.toISOString().slice(0, 10) + ' ' + d.toTimeString().slice(0, 8); },
  add(t: number, f: LiveFlight, text: string, problem?: string) {
    this.lines.push(`${this.stamp(t)}  ${(f.callsign || f.id).padEnd(8)} ${f.reg.padEnd(7)} ${f.from}>${f.to}  ${problem ? '! ' + problem + ' ! ' : ''}${text}`);
    if (problem) { this.problems++; try { ErrorLog.add('flight', `Flight ${f.callsign}: ${problem.toLowerCase()}`, text, undefined, false); } catch (e) { /* ignore */ } }
    this.dirty = true;
  },

  /** Where a flight is right now and its runway, as the app shows it. */
  where(f: LiveFlight): { pos: number[]; hdg: number; rwy: string } {
    const F: any = f;
    const m: any = (typeof _bigMap !== 'undefined' && _bigMap) || (typeof _opsMap !== 'undefined' && _opsMap);
    if (m && m.inScene && m.inScene[f.id]) {
      for (const k in m.scenes) { const sc = m.scenes[k], p = sc.planes && sc.planes.filter((x: ApvPlane) => x.id === f.id)[0]; if (p) return { pos: m.inScene[f.id], hdg: p.hdg, rwy: p.rwy || '' }; }
    }
    // near an airport: the same ground model every view uses
    if (!(f.real && f.pos)) { const g = GroundSim.pos(f); if (g) { const p = GroundSim.plane(f); return { pos: g, hdg: p ? p.hdg : 0, rwy: p && p.rwy || '' }; } }
    if (f.real && f.pos) return { pos: f.pos, hdg: f.hdg || 0, rwy: '' };
    const pp = F.depAt ? flightPathPos(f) : null;
    if (pp) return { pos: pp.pos, hdg: pp.hdg, rwy: '' };
    const A = apt(f.from), B = apt(f.noDest ? f.from : f.to);
    return { pos: A && B ? gcInterpolate(A.pos, B.pos, f.t) : [0, 0], hdg: 0, rwy: '' };
  },

  sample(now: number) {
    for (const f of State.live) {
      const F: any = f, w = this.where(f), L = this.last.get(f.id);
      const t = acType(flightTypeId(f)) || AIRCRAFT[0];
      const ph = String(f.phase || ''), alt = Math.round(f.alt || 0), gs = Math.round(f.gs || 0);
      let moved = 0, actual = 0;
      if (L) { const dt = (now - L.t) / 1000; moved = gcDistanceNm(L.pos, w.pos); actual = dt > 0 ? Math.round(moved / dt * 3600) : 0; }
      const fp = F.depAt ? flightPathPos(f) : null;
      const plan = fp ? fp.fp : null;
      const rwyPlan = plan ? (ph.match(/taxi out|take-?off|lift-?off|pushback|boarding/i) ? plan.dep && plan.dep.name : plan.arr && plan.arr.name) : '';
      const text = `${ph || '—'} · ${alt < 50 ? 'ground' : alt + ' ft'} · ${gs} kt planned · ${L ? actual + ' kt over the ground' : 'first sample'} · hdg ${String(Math.round(w.hdg) % 360).padStart(3, '0')}° · ${w.pos[1].toFixed(4)},${w.pos[0].toFixed(4)}${rwyPlan ? ' · runway ' + rwyPlan : ''}${w.rwy && w.rwy !== rwyPlan ? ' (shown on ' + w.rwy + ')' : ''}`;
      // what the type can do over the ground: its cruise speed plus a strong jet stream, at least 200 kt
      const maxGs = Math.max(200, (t.cruiseKt || 250) * 1.15 + 160) * (F.spd || 1);
      let problem = '';
      if (L && (now - L.t) < 120000 && moved > 0.5) {
        const dt = (now - L.t) / 1000;
        const placed = (GroundSim.placed[f.id] || 0) > L.t;   // set down at its place on purpose (another airport's position before): not a jump
        if (placed) problem = '';
        else if (moved > maxGs * 2.5 * dt / 3600 + 1) problem = 'JUMP';
        else if (actual > maxGs) problem = 'FAST';
        // on the ground nothing rolls faster than a take-off: anything more is a jump the ground model let through
        if (!problem && !placed && alt < 50 && /taxi|push|gate|holding|lining/i.test(ph) && actual > 60) problem = 'FAST';
      }
      // touchdown: on the runway it was cleared to?
      // (on the runway now, or it already landed between two looks: then it is taxiing in or at the gate)
      const onRwyNow = /touchdown|landing roll/i.test(ph) || (/^landing$/i.test(ph) && alt < 30);
      const landedBetween = L && /taxi in|arrived|at the gate/i.test(ph) && /approach|descent|final|landing|touchdown|roll/i.test(L.ph);   // the landing was shorter than the time between two looks
      if (L && !L.td && (onRwyNow || landedBetween)) {
        L.td = true;
        if (onRwyNow) { const chk = this.onRunway(f, w.pos, plan); L.tdRwy = chk.rwy; this.add(now, f, `touchdown · ${chk.text}`, chk.ok ? '' : chk.problem); }
        else { L.tdRwy = plan && plan.arr ? plan.arr.name : ''; this.add(now, f, `landed between two looks${L.tdRwy ? ' on runway ' + L.tdRwy : ''}, now ${ph.toLowerCase()}`); }
      }
      const phaseChanged = !L || L.ph !== ph;
      if (problem || phaseChanged || !L || now - L.logged >= 30000) {
        this.add(now, f, text, problem);
        this.last.set(f.id, { t: now, pos: w.pos, ph, alt, logged: now, td: L && L.td, tdRwy: L && L.tdRwy, gapTd: !!(L && (L.gapTd || this.gapOverTd(f, L.t, now))) });
      } else { if (this.gapOverTd(f, L.t, now)) L.gapTd = true; L.t = now; L.pos = w.pos; L.ph = ph; L.alt = alt; }   // a gap: the app was away (screen off, in the background) since L.t
    }
    // flights that ended
    for (const id of Array.from(this.last.keys())) if (!State.live.some(f => f.id === id)) this.last.delete(id);
  },

  /** Was the app away (no look for over 15 seconds) across the flight's planned touchdown, between a and b? */
  gapOverTd(f: LiveFlight, a: number, b: number): boolean { const td = (f as any).planTdAt || 0; return !!td && b - a > 15000 && a <= td + 5000 && b >= td - 5000; },
  /** Is a position on the runway the flight was planned to land on? */
  onRunway(f: LiveFlight, pos: number[], plan: any): { ok: boolean; text: string; problem: string; rwy: string } {
    const re: RunwayEnd = plan && plan.arr; if (!re) return { ok: true, text: 'no runway data for ' + f.to, problem: '', rwy: '' };
    const brg = geoBrg(re.thr, re.end), d = gcDistanceNm(re.thr, pos) * NM, b = geoBrg(re.thr, pos);
    const along = d * Math.cos((b - brg) * Math.PI / 180), across = Math.abs(d * Math.sin((b - brg) * Math.PI / 180));
    const ok = across < 45 && along > -80 && along < re.lenM + 80;
    return { ok, rwy: re.name, problem: across < 45 && along >= -1500 && along <= re.lenM + 1500 ? 'OFF RUNWAY' : 'RUNWAY',
      text: `runway ${re.name}: ${Math.round(along)} m past the threshold, ${Math.round(across)} m from the centre line${ok ? ', on the runway' : ''}` };
  },

  /** A flight reached the gate (called when it is closed). */
  arrived(f: LiveFlight, at: number) {
    const L = this.last.get(f.id);
    // only a problem if the app was watching at the moment it should have touched down
    // watched means looked at just before AND after the touchdown, with no gap across it (screen off, the app in the
    // background): a first look after a gap finds it taxiing in, which isn't a missing touchdown
    const F: any = f, tdAt = F.planTdAt || 0;
    const watched = L && tdAt && L.t >= tdAt && L.t > at - 15 * 60000 && !L.gapTd && !this.gapOverTd(f, L.t, at) && !/hold|go-?around|delayed/i.test(L.ph);
    if (L && !L.td && watched) this.add(at, f, 'arrived at the gate without being seen to touch down', 'NO TOUCHDOWN');
    else if (L && !L.td) this.add(at, f, 'arrived at the gate (the app was not watching during the landing)');
    else this.add(at, f, `arrived at the gate${L && L.tdRwy ? ' after landing on runway ' + L.tdRwy : ' (the app was closed during the landing)'}`);
  },

  text(): string {
    return `Airline Manager Pro ${APP.version} · flight trace · ${this.stamp(Date.now())}\n` +
      'Each line: time, callsign, registration, route, then phase · altitude · planned speed · speed over the ground · heading · position · runway.\n' +
      'Problems are marked between "!": JUMP, FAST, OFF RUNWAY, RUNWAY, NO TOUCHDOWN.\n\n' + this.lines.join('\n');
  },
  clear() { this.lines = []; this.problems = 0; this.dirty = true; this.save(); },
};

/** The flight trace and the error log in one text file. */
function diagnosticsText(): string {
  let err = ''; try { err = ErrorLog.report(); } catch (e) { err = 'The error log could not be read.'; }
  return FlightTrace.text() + '\n\n==================== ERROR LOG ====================\n' + err;
}
ACTIONS['trace-save'] = () => {
  FlightTrace.save();
  const name = `airline-manager-pro-log-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.txt`;
  saveTextFile(name, 'text/plain', diagnosticsText()).then(ok => toast(ok ? 'Log file saved' : 'Not saved', ok ? 'ok' : 'warn')).catch(() => toast('The log file couldn\'t be saved', 'warn'));
};
ACTIONS['trace-clear'] = () => { FlightTrace.clear(); rerenderSettingsBody(); toast('Flight trace cleared', 'ok'); };
