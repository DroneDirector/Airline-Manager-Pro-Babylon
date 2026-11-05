// Flight replay, flight score and the fuel check.
//
// Replay: every flight you fly (and every co-op pilot's flight) keeps its track: position, altitude and
// speed every few seconds, with take-off, top of climb, top of descent and touchdown marked. Open it from
// the flight's log: the route on a map, a chart of altitude and speed, and a slider to play it back.
//
// Flight score: 100 points, minus points for breaking the airline's flying rules:
//  - more than 250 kt below 10,000 ft          - taxiing faster than 30 kt
//  - flaps or gear out above their limit speed - an unstable approach (sinking fast, gear still up)
//  - a hard landing or high g                  - touching down far from the centre line or past the touchdown zone
//  - fuel below the final reserve at the gate
// Your own flights are scored from the simulator's data, so a rule is only checked when the PC app reads
// what it needs (lights, beacon and stall warnings are listed as "not checked yet" until it does).
// Hired pilots and co-op pilots fly by procedure: their score comes from their skill and the day, and a
// pilot who misses an important step is reported to you.
//
// Fuel check: the fuel planned for the leg against the fuel used and the fuel left at the gate.

interface TrackPt { t: number; lon: number; lat: number; alt: number; gs: number }
interface Track { pts: number[][]; marks: { k: string; i: number }[]; sim?: boolean }
interface ScorePen { k: string; text: string; pts: number }

const TRACK_KEY = 'airline-manager-pro.tracks';
function tracksKey(): string { return TRACK_KEY + (typeof Mode !== 'undefined' && Mode.coop() ? '.coop' : ''); }
function tracksAll(): { [logId: string]: Track } { try { return JSON.parse(localStorage.getItem(tracksKey()) || '{}') || {}; } catch (e) { return {}; } }
function trackSave(logId: string, tr: Track) {
  if (!tr || tr.pts.length < 3) return;
  const all = tracksAll(); all[logId] = tr;
  const ids = Object.keys(all); if (ids.length > 60) ids.slice(0, ids.length - 60).forEach(k => delete all[k]);
  for (let i = 0; i < 3; i++) { try { localStorage.setItem(tracksKey(), JSON.stringify(all)); return; } catch (e) { const k = Object.keys(all); k.slice(0, Math.ceil(k.length / 3)).forEach(x => delete all[x]); } }
}
function trackOf(logId: string): Track { return tracksAll()[logId] || null; }
/** At most n points, keeping the shape (and the marks pointing at the right places). */
function trackThin(pts: number[][], marks: { k: string; i: number }[], n: number): Track {
  if (pts.length <= n) return { pts, marks };
  const step = pts.length / n, keep: number[] = [];
  for (let i = 0; i < n; i++) keep.push(Math.floor(i * step));
  marks.forEach(m => { if (keep.indexOf(m.i) < 0) keep.push(m.i); }); keep.push(pts.length - 1);
  const ks = Array.from(new Set(keep)).sort((a, b) => a - b);
  return { pts: ks.map(i => pts[i]), marks: marks.map(m => ({ k: m.k, i: ks.indexOf(m.i) })) };
}
/** Top of climb and top of descent from the altitudes. */
function trackMarks(pts: number[][], marks: { k: string; i: number }[]): { k: string; i: number }[] {
  if (pts.length < 4) return marks;
  const mx = Math.max.apply(null, pts.map(p => p[3]));
  if (mx > 3000) {
    const toc = pts.findIndex(p => p[3] >= mx - 400); let tod = -1;
    for (let i = pts.length - 1; i >= 0; i--) if (pts[i][3] >= mx - 400) { tod = i; break; }
    if (toc > 0 && !marks.some(m => m.k === 'toc')) marks.push({ k: 'toc', i: toc });
    if (tod > toc && !marks.some(m => m.k === 'tod')) marks.push({ k: 'tod', i: tod });
  }
  return marks.sort((a, b) => a.i - b.i);
}

/* ---------- your own flight: recorded from the simulator ---------- */
const MyRec = {
  pts: [] as number[][], marks: [] as { k: string; i: number }[], last: 0, t0: 0,
  pens: [] as ScorePen[], seen: {} as { [k: string]: number }, taxiFastSince: 0, flapSince: 0, gearSince: 0, unstable: false, airborne: false,
  fuelOut: 0, fuelPlan: 0,
  reset() { this.pts = []; this.marks = []; this.last = 0; this.t0 = 0; this.pens = []; this.seen = {}; this.taxiFastSince = 0; this.flapSince = 0; this.gearSince = 0; this.unstable = false; this.airborne = false; this.fuelOut = 0; this.fuelPlan = 0; },
  pen(k: string, text: string, pts: number, max: number) {
    const now = Date.now(); if (this.seen[k] && now - this.seen[k] < 90e3) return; this.seen[k] = now;
    const had = this.pens.filter(p => p.k === k).reduce((s, p) => s + p.pts, 0); if (had >= max) return;
    this.pens.push({ k, text, pts: Math.min(pts, max - had) });
    try { toast(`Flight rules: ${text} (−${Math.min(pts, max - had)})`, 'warn'); } catch (e) { /* ignore */ }
  },
  /** Every snapshot from the simulator while your flight is on. */
  onState(s: SimSnapshot) {
    if (!s || !s.connected || s.paused || !State.live.some(f => f.id === 'me')) return;
    const now = Date.now();
    if (!this.t0) {
      this.t0 = now; this.fuelOut = s.fuelKg || 0;
      try { const leg = nextLeg(), a = plane((State as any).myReg[State.companyId]); if (a && leg.to) this.fuelPlan = legFuel(a.typeId, 0, leg.from, leg.to).to; } catch (e) { /* ignore */ }
    }
    if (now - this.last >= 5000) {
      this.last = now; this.pts.push([Math.round((now - this.t0) / 1000), +s.lon.toFixed(5), +s.lat.toFixed(5), Math.round(s.altFt || 0), Math.round(s.gs || 0)]);
      if (this.pts.length > 4000) { const t = trackThin(this.pts, this.marks, 2000); this.pts = t.pts; this.marks = t.marks; }
    }
    if (!s.onGround && !this.airborne && (s.aglFt || 0) > 50) { this.airborne = true; this.marks.push({ k: 'to', i: Math.max(0, this.pts.length - 1) }); }
    this.rules(s, now);
  },
  rules(s: SimSnapshot, now: number) {
    const a = plane((State as any).myReg[State.companyId]), spec = a ? configSpec(a.typeId) : null;
    // 250 kt below 10,000 ft (above the airport)
    if (!s.onGround && s.altFt < 9800 && s.ias > 262) this.pen('250', `${Math.round(s.ias)} kt below 10,000 ft (limit 250 kt)`, 5, 15);
    // taxi speed: over 30 kt on the ground for more than 10 s (a take-off or landing roll passes through quickly)
    if (s.onGround && s.gs > 30 && s.gs < 50) { if (!this.taxiFastSince) this.taxiFastSince = now; else if (now - this.taxiFastSince > 10000) this.pen('taxi', `taxied at ${Math.round(s.gs)} kt (limit 30 kt)`, 3, 9); } else this.taxiFastSince = 0;
    if (spec) {
      // flaps above their limit speed
      const fi = Math.min(s.flapsIndex || 0, spec.flaps.length), vfe = fi > 0 ? spec.flaps[fi - 1].vfe : 0;
      if (vfe && s.ias > vfe + 5 && !s.onGround) { if (!this.flapSince) this.flapSince = now; else if (now - this.flapSince > 3000) this.pen('flap', `flaps ${spec.flaps[fi - 1].n} at ${Math.round(s.ias)} kt (limit ${vfe} kt)`, 8, 16); } else this.flapSince = 0;
      // gear out above its limit speed
      const g: any = spec.gear;
      if (g !== 'fixed' && g && s.gearDown && !s.onGround && s.ias > g.vle + 5) { if (!this.gearSince) this.gearSince = now; else if (now - this.gearSince > 3000) this.pen('gear', `gear down at ${Math.round(s.ias)} kt (limit ${g.vle} kt)`, 8, 16); } else this.gearSince = 0;
    }
    // stable approach: below 1,000 ft on the way down
    if (!s.onGround && this.airborne && s.aglFt < 1000 && s.aglFt > 50 && s.vsFpm < -200) {
      const gearUp = spec && spec.gear !== 'fixed' && !s.gearDown && s.aglFt < 500;
      if (s.vsFpm < -1300 || gearUp) { if (!this.unstable) { this.unstable = true; this.pen('stable', gearUp ? 'gear still up below 500 ft' : `sinking ${Math.round(-s.vsFpm)} fpm below 1,000 ft (unstable approach)`, 10, 10); } }
    }
  },
};

/** The points taken off a landing: firmness, g, and where it touched down on the runway. */
function landingPens(fpm: number, g: number, td?: { lon: number; lat: number; icao: string }): ScorePen[] {
  const out: ScorePen[] = [], f = Math.abs(fpm);
  if (f > 600) out.push({ k: 'hard', text: `hard landing, ${f} fpm`, pts: 15 }); else if (f > 400) out.push({ k: 'firm', text: `firm landing, ${f} fpm`, pts: 8 });
  if (g > 1.6) out.push({ k: 'g', text: `${g.toFixed(2)} g on landing`, pts: 6 });
  if (td && td.icao) {
    try {
      const re = activeRunway(td.icao);
      if (re) {
        const pos = [td.lon, td.lat], brg = geoBrg(re.thr, re.end), d = gcDistanceNm(re.thr, pos) * NM, b = geoBrg(re.thr, pos);
        const along = d * Math.cos((b - brg) * D2R), across = Math.abs(d * Math.sin((b - brg) * D2R));
        if (across < 200 && along > -300 && along < re.lenM + 300) {
          if (across > 12) out.push({ k: 'cl', text: `touched down ${Math.round(across)} m from the centre line`, pts: across > 25 ? 6 : 3 });
          if (along > 900) out.push({ k: 'tdz', text: `touched down ${Math.round(along)} m past the threshold (beyond the touchdown zone)`, pts: 5 });
          if (along < 0) out.push({ k: 'short', text: 'touched down before the runway threshold', pts: 10 });
        }
      }
    } catch (e) { /* no runway data */ }
  }
  return out;
}
const RULES_LATER = ['Landing lights on below 10,000 ft', 'Beacon on before engine start', 'Strobes on the runway', 'No stall warnings'];

/** The fuel planned for a leg, and what the reserve at the gate should be (final reserve: 30 minutes). */
function fuelCheck(typeId: string, from: string, to: string, usedKg: number, outKg: number): { planKg: number; reserveKg: number; landKg: number; note: string; pen?: ScorePen } {
  const t = acType(typeId) || AIRCRAFT[0], burnH = (BURN_KG_H[t.cls] || 2000), reserve = Math.round(burnH * 0.5);
  let plan = 0; try { plan = legFuel(typeId, 0, from, to).to; } catch (e) { /* ignore */ }
  const land = Math.max(0, Math.round(outKg - usedKg));
  if (!outKg || !usedKg) return { planKg: plan, reserveKg: reserve, landKg: 0, note: '' };
  if (land < reserve) return { planKg: plan, reserveKg: reserve, landKg: land, note: `Landed with ${num(land)} kg, below the final reserve of ${num(reserve)} kg. A safety report goes to the chief pilot.`, pen: { k: 'fuel', text: `fuel at the gate below the final reserve (${num(land)} kg)`, pts: 15 } };
  if (plan && outKg > plan * 1.35) { const extra = outKg - plan, cost = Math.round(extra * 0.035 * Math.max(0.5, usedKg / burnH) * fuelPrice(from)); return { planKg: plan, reserveKg: reserve, landKg: land, note: `Took ${num(Math.round(extra))} kg more than planned. Carrying it burned about ${money(cost)} of extra fuel.` }; }
  return { planKg: plan, reserveKg: reserve, landKg: land, note: `Fuel as planned: ${num(land)} kg left at the gate (reserve ${num(reserve)} kg).` };
}

/** After your leg is logged: its track, score and fuel check go with the log entry. */
function vaAfterMyLeg(l: any, sm: any, typeId: string, td?: any) {
  const pens = MyRec.pens.slice().concat(landingPens(l.landingFpm, l.g, td));
  const fc = fuelCheck(typeId, l.from, l.to, sm.fuelUsedKg || 0, MyRec.fuelOut);
  if (fc.pen) pens.push(fc.pen);
  l.score = Math.max(0, 100 - pens.reduce((s, p) => s + p.pts, 0)); l.pens = pens; l.fuel = { plan: fc.planKg, out: Math.round(MyRec.fuelOut), used: Math.round(sm.fuelUsedKg || 0), land: fc.landKg, reserve: fc.reserveKg, note: fc.note };
  l.scoreSim = true;
  if (MyRec.pts.length > 2) { const tr = trackThin(MyRec.pts, trackMarks(MyRec.pts.slice(), MyRec.marks.concat(MyRec.airborne ? [] : []).concat([{ k: 'td', i: MyRec.pts.length - 1 }])), 500); tr.sim = true; trackSave(l.id, tr); }
  MyRec.reset();
  try { const r = Ratings.list()[0]; if (r && r.kind === 'you') (r as any).score = l.score; } catch (e) { /* ignore */ }
}

/* ---------- procedural flights: hired pilots and co-op pilots ---------- */
const PROC_STEPS: [string, string, number, boolean][] = [
  // key, what was missed, points, important
  ['lights', 'landing lights not on below 10,000 ft', 3, false],
  ['taxi', 'taxied too fast', 3, false],
  ['250', 'over 250 kt below 10,000 ft', 5, false],
  ['checklist', 'skipped the before-take-off checklist', 10, true],
  ['flap', 'flaps out above their limit speed', 8, true],
  ['stable', 'continued an unstable approach instead of going around', 12, true],
  ['fuel', 'landed below the final fuel reserve', 15, true],
];
/** A procedural flight's score: the better (and happier) the pilot, the fewer steps missed. */
function procScore(id: string, skill: number, fpm: number, g: number): { score: number; pens: ScorePen[]; serious: ScorePen[] } {
  const r = (k: string) => (hashMix(id + ':' + k) % 1000) / 1000, pens: ScorePen[] = [];
  const care = clamp(skill, 0, 1);   // 0 sloppy … 1 careful
  for (const [k, text, pts, imp] of PROC_STEPS) { const p = (imp ? 0.035 : 0.12) * (1.6 - care * 1.3); if (r(k) < p) pens.push({ k, text, pts }); }
  landingPens(fpm, g).forEach(p => pens.push(p));
  return { score: Math.max(0, 100 - pens.reduce((s, p) => s + p.pts, 0)), pens, serious: pens.filter(p => PROC_STEPS.some(x => x[0] === p.k && x[3])) };
}
/** A hired pilot landed: their score goes on the landing record; a missed important step is reported. */
function vaAiLanded(f: LiveFlight, at: number) {
  const p: any = pilot(f.pilotId), rec: any = Ratings.list()[0]; if (!p || !rec || rec.who !== p.id) return;
  const skill = clamp(((p.rating || 4) - 2.5) / 2.5, 0, 1) - clamp(5 - workRating(p), 0, 2.6) * 0.15;
  const sc = procScore(f.id, skill, rec.fpm, rec.g); rec.score = sc.score; rec.pens = sc.pens;
  if (sc.serious.length) {
    const s = sc.serious[0];
    State.notices.unshift({ id: uid(), kind: 'pilot', title: `${p.name} missed an important step`, body: `${f.callsign} ${f.from} to ${f.to}: ${s.text}. Flight score ${sc.score}/100. ${s.k === 'flap' ? 'The aircraft needs a flap inspection.' : s.k === 'fuel' ? 'A fuel safety report was filed.' : 'A note went on their record.'}`, time: at > Date.now() - 120e3 ? 'Now' : dateStr(new Date(at)).slice(11), at, read: false } as any);
    p.misses = (p.misses || 0) + 1;
    if (s.k === 'flap') try { const a = plane(f.reg); if (a) State.issues.unshift({ id: uid(), reg: a.reg, title: 'Flap overspeed inspection', detail: `Flaps reported extended above their limit speed on ${f.callsign}.`, source: p.name, severity: 'minor', cost: 4200, days: 0.3, status: 'open', date: dateStr(new Date(at)).slice(0, 10) } as any); } catch (e) { /* ignore */ }
  }
}

/* ---------- the flight's log: score, fuel and the replay button ---------- */
function flightScoreHtml(l: any): string {
  if (l.score == null) return '';
  const cls = l.score >= 90 ? 'green' : l.score >= 75 ? '' : l.score >= 60 ? 'amber' : 'red';
  const pens: ScorePen[] = l.pens || [];
  return `<div class="fscore"><div class="fscore-h"><b class="${cls}">${l.score}<small>/100</small></b><span><b>Flight score</b><small>${pens.length ? pens.length + ' rule' + (pens.length > 1 ? 's' : '') + ' broken' : 'Every checked rule kept'}</small></span></div>
    ${pens.map(p => `<div class="fs-pen"><span>${esc(p.text.charAt(0).toUpperCase() + p.text.slice(1))}</span><em>−${p.pts}</em></div>`).join('')}
    ${l.scoreSim ? `<small class="muted">Not checked yet (the PC app doesn't read these from the simulator yet): ${RULES_LATER.join(', ').toLowerCase()}.</small>` : ''}
    ${l.fuel && l.fuel.note ? `<p class="fine-print">${icon('fuel')}${esc(l.fuel.note)}${l.fuel.plan ? ` Planned ${num(l.fuel.plan)} kg, took ${num(l.fuel.out)} kg, used ${num(l.fuel.used)} kg.` : ''}</p>` : ''}</div>`;
}
function replayBtn(l: any): string { return trackOf(l.id) ? `<button class="btn ghost sm" data-act="replay-open" data-id="${esc(l.id)}">${icon('play')}Replay the flight</button>` : ''; }

let _rp: { tr: Track; i: number; timer: any; l: any } = null;
ACTIONS['replay-open'] = el => {
  const l: any = State.logbook.filter(x => x.id === el.getAttribute('data-id'))[0], tr = l ? trackOf(l.id) : null; if (!tr) return;
  _rp = { tr, i: tr.pts.length - 1, timer: null, l };
  openLayer('modal', `<div class="modal-head"><div><h2>Replay: ${esc(l.from)} → ${esc(l.to)}</h2><small>${esc(l.date)} · ${esc(l.reg)}${l.score != null ? ' · flight score ' + l.score + '/100' : ''}${tr.sim ? ' · recorded from the simulator' : ''}</small></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
    <div class="modal-body"><div class="rp-map">${replayMapSvg(tr)}</div><div class="rp-chart">${replayChartSvg(tr)}</div>
      <div class="rp-ctl"><button class="btn primary sm rp-play" data-act="replay-play">${icon('play')}Play</button><input type="range" class="rp-slider" min="0" max="${tr.pts.length - 1}" value="${tr.pts.length - 1}"><span class="rp-now"></span></div>
      <div class="rp-legend">${[['to', 'Take-off'], ['toc', 'Top of climb'], ['tod', 'Top of descent'], ['td', 'Touchdown']].map(([k, n]) => `<span><i class="rp-m rp-${k}"></i>${n}</span>`).join('')}</div></div>`,
    { cls: 'wide rp-pop', onClose: () => { if (_rp && _rp.timer) clearInterval(_rp.timer); _rp = null; } });
  replayAt(_rp.i);
  const sl = document.querySelector('.rp-slider') as HTMLInputElement; if (sl) sl.addEventListener('input', () => { if (_rp && _rp.timer) { clearInterval(_rp.timer); _rp.timer = null; } replayAt(+sl.value); });
};
ACTIONS['replay-play'] = () => {
  if (!_rp) return;
  if (_rp.timer) { clearInterval(_rp.timer); _rp.timer = null; replayPlayLabel(false); return; }
  if (_rp.i >= _rp.tr.pts.length - 1) _rp.i = 0;
  replayPlayLabel(true);
  const step = Math.max(1, Math.round(_rp.tr.pts.length / 300));
  _rp.timer = setInterval(() => { if (!_rp) return; const n = Math.min(_rp.tr.pts.length - 1, _rp.i + step); replayAt(n); if (n >= _rp.tr.pts.length - 1) { clearInterval(_rp.timer); _rp.timer = null; replayPlayLabel(false); } }, 50);
};
function replayPlayLabel(on: boolean) { const b = document.querySelector('.rp-play'); if (b) b.innerHTML = `${icon(on ? 'stop' : 'play')}${on ? 'Pause' : 'Play'}`; }
function _rpBox(tr: Track) {
  const lo = tr.pts.map(p => p[1]), la = tr.pts.map(p => p[2]);
  let x0 = Math.min.apply(null, lo), x1 = Math.max.apply(null, lo), y0 = Math.min.apply(null, la), y1 = Math.max.apply(null, la);
  const k = Math.cos((y0 + y1) / 2 * D2R), w = Math.max(0.02, (x1 - x0) * k), h = Math.max(0.02, y1 - y0), pad = 0.08;
  const W = 640, H = 300, s = Math.min(W / (w * (1 + 2 * pad)), H / (h * (1 + 2 * pad)));
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  return { W, H, x: (lon: number) => W / 2 + (lon - cx) * k * s, y: (lat: number) => H / 2 - (lat - cy) * s };
}
function _altCol(alt: number, mx: number): string { const f = clamp(alt / Math.max(1000, mx), 0, 1); return `hsl(${Math.round(200 - f * 170)},80%,${Math.round(55 + f * 5)}%)`; }
function replayMapSvg(tr: Track): string {
  const B = _rpBox(tr), mx = Math.max.apply(null, tr.pts.map(p => p[3]));
  let segs = ''; for (let i = 1; i < tr.pts.length; i++) { const a = tr.pts[i - 1], b = tr.pts[i]; segs += `<line x1="${B.x(a[1]).toFixed(1)}" y1="${B.y(a[2]).toFixed(1)}" x2="${B.x(b[1]).toFixed(1)}" y2="${B.y(b[2]).toFixed(1)}" stroke="${_altCol(b[3], mx)}"/>`; }
  const marks = tr.marks.filter(m => tr.pts[m.i]).map(m => `<circle class="rp-m rp-${m.k}" cx="${B.x(tr.pts[m.i][1]).toFixed(1)}" cy="${B.y(tr.pts[m.i][2]).toFixed(1)}" r="5"/>`).join('');
  const a = tr.pts[0], z = tr.pts[tr.pts.length - 1];
  return `<svg viewBox="0 0 ${B.W} ${B.H}" class="rp-svg"><rect width="${B.W}" height="${B.H}" rx="12" class="rp-bg"/><g stroke-width="3" stroke-linecap="round">${segs}</g>${marks}
    <text x="${B.x(a[1]) + 8}" y="${B.y(a[2]) - 8}" class="rp-lbl">${esc(_rp ? _rp.l.from : '')}</text><text x="${B.x(z[1]) + 8}" y="${B.y(z[2]) - 8}" class="rp-lbl">${esc(_rp ? _rp.l.to : '')}</text>
    <g class="rp-plane"><circle r="7"/></g></svg>`;
}
function replayChartSvg(tr: Track): string {
  const W = 640, H = 150, n = tr.pts.length, T = tr.pts[n - 1][0] || 1, mxA = Math.max(1000, Math.max.apply(null, tr.pts.map(p => p[3]))), mxS = Math.max(100, Math.max.apply(null, tr.pts.map(p => p[4])));
  const x = (t: number) => 36 + t / T * (W - 48), ya = (a: number) => H - 20 - a / mxA * (H - 34), ys = (s: number) => H - 20 - s / mxS * (H - 34);
  const alt = tr.pts.map((p, i) => (i ? 'L' : 'M') + x(p[0]).toFixed(1) + ' ' + ya(p[3]).toFixed(1)).join(' '), spd = tr.pts.map((p, i) => (i ? 'L' : 'M') + x(p[0]).toFixed(1) + ' ' + ys(p[4]).toFixed(1)).join(' ');
  const marks = tr.marks.filter(m => tr.pts[m.i]).map(m => `<line class="rp-ml rp-${m.k}" x1="${x(tr.pts[m.i][0])}" x2="${x(tr.pts[m.i][0])}" y1="10" y2="${H - 20}"/>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="rp-svg"><rect width="${W}" height="${H}" rx="12" class="rp-bg"/>${marks}
    <path d="${alt} L${x(T)} ${H - 20} L${x(0)} ${H - 20} Z" class="rp-alt-a"/><path d="${alt}" class="rp-alt"/><path d="${spd}" class="rp-spd"/>
    <text x="8" y="16" class="rp-ax">${num(mxA)} ft</text><text x="${W - 8}" y="16" class="rp-ax rp-axs" text-anchor="end">${mxS} kt</text><text x="8" y="${H - 6}" class="rp-ax">${hours(Math.round(T / 60))}</text>
    <line class="rp-cur" x1="0" x2="0" y1="10" y2="${H - 20}"/></svg>`;
}
function replayAt(i: number) {
  if (!_rp) return; _rp.i = i; const tr = _rp.tr, p = tr.pts[i]; if (!p) return;
  const B = _rpBox(tr), g = document.querySelector('.rp-plane'); if (g) g.setAttribute('transform', `translate(${B.x(p[1]).toFixed(1)},${B.y(p[2]).toFixed(1)})`);
  const T = tr.pts[tr.pts.length - 1][0] || 1, cx = 36 + p[0] / T * (640 - 48), c = document.querySelector('.rp-cur'); if (c) { c.setAttribute('x1', String(cx)); c.setAttribute('x2', String(cx)); }
  const sl = document.querySelector('.rp-slider') as HTMLInputElement; if (sl && +sl.value !== i) sl.value = String(i);
  const ph = tr.marks.filter(m => m.i <= i).pop(), names: any = { to: 'climbing out', toc: 'cruise', tod: 'descending', td: 'landed' };
  const nw = document.querySelector('.rp-now'); if (nw) nw.textContent = `${hours(Math.round(p[0] / 60))} · ${num(p[3])} ft · ${p[4]} kt${ph ? ' · ' + names[ph.k] : i === 0 ? ' · at the gate' : ''}`;
}

/** A co-op pilot's flight: the app flew it by the flight profile, so its track comes from there. */
function trackFromProfile(typeId: string, from: string, to: string, depAt: number): Track {
  try {
    const p = flightProfile(typeId, from, to, depAt), f: any = { typeId, from, to, depAt, durMs: p.totalS * 1000, id: 'trk-' + from + to + depAt, coop: true };
    const pts: number[][] = [], n = 160, marks: { k: string; i: number }[] = [];
    for (let i = 0; i <= n; i++) {
      const t = depAt + p.totalS * 1000 * i / n, q = profileAt(p, flightEl(f, t).el), pos = flightPathPos(f, t);
      const ll = pos ? pos.pos : gcInterpolate(apt(from).pos, apt(to).pos, clamp(q.d / p.routeNm, 0, 1));
      pts.push([Math.round(p.totalS * i / n), +ll[0].toFixed(5), +ll[1].toFixed(5), Math.round(q.alt || 0), Math.round(q.gs || 0)]);
      if (!marks.some(m => m.k === 'to') && q.alt > 50) marks.push({ k: 'to', i });
    }
    let td = pts.length - 1; for (let i = pts.length - 1; i > 0; i--) if (pts[i][3] > 50) { td = Math.min(pts.length - 1, i + 1); break; }
    marks.push({ k: 'td', i: td });
    return { pts, marks: trackMarks(pts, marks) };
  } catch (e) { return null; }
}

/** Dispatch: the fuel plan for your next leg (take-off fuel and the reserve to land with). */
function fuelPlanHtml(from: string, to: string): string {
  const a = plane((State as any).myReg[State.companyId]); if (!a || !from || !to || !apt(from) || !apt(to)) return '';
  let plan = 0; try { plan = legFuel(a.typeId, 0, from, to).to; } catch (e) { return ''; }
  const t = acType(a.typeId), reserve = Math.round((BURN_KG_H[t.cls] || 2000) * 0.5);
  return `<div class="card brief">${icon('fuel')}<span><b>Fuel plan: ${num(plan)} kg for take-off</b><small>Land with at least the final reserve of ${num(reserve)} kg (30 minutes). Less is a safety report and costs flight score; far more than planned costs money to carry.</small></span></div>`;
}
