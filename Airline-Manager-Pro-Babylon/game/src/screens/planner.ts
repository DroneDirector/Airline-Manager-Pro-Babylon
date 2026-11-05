// Flight planner: the route, the weather and the NOTAMs together on one map.
//  - The route: waypoints from the departure to the arrival, each with the level to fly from it on and, if you
//    want one, a speed (Mach or indicated knots); climb and descent speeds and an alternate. Drag a waypoint on
//    the map to move it, tap "Add waypoints" and tap the map to add one on the nearest leg, or type an airport
//    or a position. The vertical profile below shows the climb, the step climbs, the top of descent and the
//    weather the route passes through, worked out exactly as the flight will fly it.
//  - "Flights fly this plan": every flight between the two airports then follows it, on the map, in 3D, at the
//    airports and in its times (core/flightplan.ts).
//  - Weather: the live reports and forecasts at the departure, the arrival and the alternate; the SIGMETs the
//    route crosses at its planned levels (drawn on the map); the winds along it.
//  - NOTAMs: real ones from the FAA's NOTAM service with your own free key (Settings → Online services), and
//    the airline's own for the day (the ones its flights act on).

const PlannerUi: any = { from: '', to: '', typeId: '', sel: '', drag: '', map: null, tab: 'route', addMode: false, prev: null, path: null };

/** The planned route and its profile, worked out as if it were flown (even before it is switched on). */
function plPreview(P: FlightPlanR): { prof: FlightProfile; path: FlightPath } {
  _planPreview = P.key;
  try { const path = flightPathFor(P.from, P.to), prof = flightProfile(PlannerUi.typeId || P.typeId || plType(), P.from, P.to); return { prof, path }; }
  catch (e) { return { prof: null, path: null }; }
  finally { _planPreview = null; }
}
function plType(): string { const a = plane((State as any).myReg[State.companyId]); return (a && a.typeId) || (fleetOf(State.companyId)[0] || { typeId: 'a320' } as any).typeId; }

/** City pairs to plan: your routes' legs and your next leg. */
function plPairs(): [string, string][] {
  const out: [string, string][] = [], seen: any = {};
  const add = (a: string, b: string) => { const k = a + '-' + b; if (a && b && a !== b && !seen[k]) { seen[k] = 1; out.push([a, b]); } };
  try { const l = nextLeg(); add(l.from, l.to); } catch (e) { /* none */ }
  for (const r of (State.routes as any[]).filter(x => x.companyId === State.companyId)) for (let i = 1; i < (r.legs || []).length; i++) add(r.legs[i - 1], r.legs[i]);
  for (const k in plansAll()) { const p = plansAll()[k]; add(p.from, p.to); }
  return out.slice(0, 60);
}
function plCur(): FlightPlanR {
  const U = PlannerUi; if (!U.from || !U.to) return null;
  let P = plansAll()[planKey(U.from, U.to)];
  if (!P) { P = planDefault(U.from, U.to, U.typeId || plType()); if (!P) return null; plansAll()[P.key] = P; Store.soon(); }
  return P;
}
function plRecalc() { const P = plCur(); if (!P) { PlannerUi.prev = null; PlannerUi.path = null; return; } const r = plPreview(P); PlannerUi.prev = r.prof; PlannerUi.path = r.path; }

/** Where along the path each waypoint is (nm), and the time there from take-off. */
function plWpD(P: FlightPlanR, id: string): number { const p = PlannerUi.path; return p && p.wpD && p.wpD[id] != null ? p.wpD[id] : null; }
function plTimeAt(d: number): number {
  const pr: FlightProfile = PlannerUi.prev, path: FlightPath = PlannerUi.path; if (!pr || d == null) return null;
  const dd = path ? d / path.len * pr.routeNm : d, t0 = (pr.pts.filter(p => p.ph === 'Takeoff')[0] || pr.pts[0]).s;
  for (let i = 1; i < pr.pts.length; i++) if (pr.pts[i].d >= dd) { const a = pr.pts[i - 1], b = pr.pts[i], k = (dd - a.d) / ((b.d - a.d) || 1); return a.s + (b.s - a.s) * clamp(k, 0, 1) - t0; }
  return pr.pts[pr.pts.length - 1].s - t0;
}
function plHm(s: number): string { if (s == null) return '—'; const m = Math.round(s / 60); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; }

/** The SIGMETs the route passes through at its planned levels: [sigmet, from nm, to nm]. */
function plHazards(): [Sigmet, number, number][] {
  const path: FlightPath = PlannerUi.path, pr: FlightProfile = PlannerUi.prev; if (!path || !pr) return [];
  const out: [Sigmet, number, number][] = [];
  for (const sg of Sigmets.active()) {
    let a = -1, b = -1;
    for (let d = 0; d <= path.len; d += 10) {
      const p = pathAt(path, d).pos, q = profileAtD(pr, d / path.len * pr.routeNm), alt = q ? q.alt : 0;
      const inBand = (!sg.base || alt >= sg.base - 1000) && (!sg.top || alt <= sg.top + 1000);
      if (inBand && Sigmets.inside(p, sg.poly)) { if (a < 0) a = d; b = d; }
    }
    if (a >= 0) out.push([sg, a, b]);
  }
  return out;
}
function profileAtD(pr: FlightProfile, d: number): ProfilePoint { for (let i = 1; i < pr.pts.length; i++) if (pr.pts[i].d >= d) return pr.pts[i]; return pr.pts[pr.pts.length - 1]; }

/** Real NOTAMs from the FAA's NOTAM service, with your own key (kept on this device only). */
const FaaNotams = {
  cache: {} as { [icao: string]: { at: number; list: { id: string; text: string; from: string; to: string }[]; err?: string } }, busy: {} as any,
  key(): { id: string; secret: string } { const S: any = State.settings; return S.faaId && S.faaSecret ? { id: String(S.faaId).trim(), secret: String(S.faaSecret).trim() } : null; },
  get(icao: string) {
    const k = this.key(); if (!k || !icao) return null;
    const c = this.cache[icao];
    if ((!c || Date.now() - c.at > 30 * 60e3) && !this.busy[icao]) {
      this.busy[icao] = true;
      Net.json(`https://external-api.faa.gov/notamapi/v1/notams?icaoLocation=${encodeURIComponent(icao)}&pageSize=60`, { headers: { client_id: k.id, client_secret: k.secret, Accept: 'application/json' } })
        .then((r: any) => {
          const list = ((r && r.items) || []).map((it: any) => { const n = (it.properties && it.properties.coreNOTAMData && it.properties.coreNOTAMData.notam) || {}; return { id: String(n.number || n.id || ''), text: String(n.text || ''), from: String(n.effectiveStart || ''), to: String(n.effectiveEnd || '') }; }).filter((x: any) => x.text);
          this.cache[icao] = { at: Date.now(), list };
        })
        .catch((e: any) => { this.cache[icao] = { at: Date.now(), list: [], err: /401|403/.test(String(e && e.message)) ? 'The FAA did not accept the key.' : 'The FAA NOTAM service could not be reached.' }; })
        .then(() => { delete this.busy[icao]; if (State.screen === 'planner' && PlannerUi.tab === 'notam') plPanelRedraw(); });
    }
    return c || null;
  },
};

SCREENS.planner = {
  title: 'Flight planner', icon: 'routes',
  render() {
    const U = PlannerUi, pairs = plPairs();
    if (!U.from && pairs.length) { U.from = pairs[0][0]; U.to = pairs[0][1]; }
    if (!U.typeId) U.typeId = plType();
    const types = fleetOf(State.companyId).map(a => a.typeId).filter((x, i, a) => a.indexOf(x) === i);
    return `<div class="screen planner">
      <div class="pl-top">
        <div class="pl-pick"><label><small>Route</small><select class="pl-pair" aria-label="Route">${pairs.map(p => `<option value="${p[0]}-${p[1]}" ${p[0] === U.from && p[1] === U.to ? 'selected' : ''}>${p[0]} → ${p[1]}</option>`).join('')}<option value="">Other airports…</option></select></label>
          <label class="pl-other"><small>From</small><input class="pl-from" value="${esc(U.from)}" maxlength="4" aria-label="Departure airport"></label><label class="pl-other"><small>To</small><input class="pl-to" value="${esc(U.to)}" maxlength="4" aria-label="Arrival airport"></label>
          <label><small>Aircraft</small><select class="pl-type" aria-label="Aircraft type">${types.map(t => `<option value="${t}" ${t === U.typeId ? 'selected' : ''}>${esc((acType(t) || { model: t } as any).model)}</option>`).join('')}</select></label></div>
        <div class="pl-sum"></div>
      </div>
      <div class="pl-body"><div class="pl-map" id="pl-map"><div class="pl-maptools"><button class="btn sm ${U.addMode ? 'primary' : 'ghost'}" data-act="pl-addmode">${icon('plus')}${U.addMode ? 'Tap the map to add' : 'Add waypoints'}</button><button class="btn sm ghost" data-act="pl-zoom" data-w="dep">${icon('fleet')}Departure</button><button class="btn sm ghost" data-act="pl-zoom" data-w="arr">${icon('pin')}Arrival</button><button class="btn sm ghost" data-act="pl-fit">${icon('focus')}Whole route</button></div></div>
        <div class="pl-side"><div class="seg pl-tabs">${[['route', 'Route'], ['rwy', 'Runways'], ['wx', 'Weather'], ['notam', 'NOTAMs']].map(t => `<button class="${U.tab === t[0] ? 'on' : ''}" data-act="pl-tab" data-t="${t[0]}">${t[1]}</button>`).join('')}</div><div class="pl-panel"></div></div></div>
      <div class="pl-prof"><canvas class="pl-prof-cv"></canvas></div>
    </div>`;
  },
  mount(root) {
    plRecalc();
    const U = PlannerUi, el = $('#pl-map', root);
    const near = (x: number, y: number) => { const P = plCur(); if (!P || !U.map) return null; let best: PlanWp = null, bd = 16; for (const w of P.wps) { const p = U.map.px(w.lon, w.lat), d = Math.hypot(p[0] - x, p[1] - y); if (d < bd) { bd = d; best = w; } } return best; };
    U.map = new WorldMap(el, {
      interactive: true, labels: false, memoKey: 'planner',
      overlay: (c, m) => plOverlay(c, m),
      onDown: (x, y) => { const w = near(x, y); if (!w) return false; U.drag = w.id; U.sel = w.id; return true; },
      onMove: (x, y) => { const P = plCur(), w = P && P.wps.filter(q => q.id === U.drag)[0]; if (!w) return; const ll = U.map.ll(x, y); w.lon = ll[0]; w.lat = ll[1]; if (!w.apt) w.name = coordName(w.lat, w.lon); },
      onUp: () => { const P = plCur(); U.drag = ''; if (P) { planSave(P); plRecalc(); plPanelRedraw(); } },
      onTap: (x, y) => {
        const w = near(x, y); if (w) { U.sel = w.id; plPanelRedraw(); return true; }
        if (!U.addMode) return true;   // the planner's map doesn't open flights
        const ll = U.map.ll(x, y); plInsert({ id: uid(), name: coordName(ll[1], ll[0]), lat: ll[1], lon: ll[0], alt: 0 }); return true;
      },
    });
    plFit(false);
    root.querySelector('.pl-pair').addEventListener('change', (e: any) => { const v = e.target.value; if (!v) { root.querySelector('.planner').classList.add('other'); return; } const [a, b] = v.split('-'); U.from = a; U.to = b; U.sel = ''; plRecalc(); plFit(true); plPanelRedraw(); });
    const ab = () => { const a = (root.querySelector('.pl-from') as HTMLInputElement).value.trim().toUpperCase(), b = (root.querySelector('.pl-to') as HTMLInputElement).value.trim().toUpperCase(); if (apt(a) && apt(b) && a !== b) { U.from = a; U.to = b; U.sel = ''; plRecalc(); plFit(true); plPanelRedraw(); } };
    root.querySelector('.pl-from').addEventListener('change', ab); root.querySelector('.pl-to').addEventListener('change', ab);
    root.querySelector('.pl-type').addEventListener('change', (e: any) => { U.typeId = e.target.value; plRecalc(); plPanelRedraw(); });
    plPanelRedraw();
    // the weather fills in as it arrives
    const tick = setInterval(() => { if (!root.isConnected) { clearInterval(tick); return; } if (U.tab !== 'route') plPanelRedraw(true); plProfileDraw(); }, 4000);
  },
};

function plFit(animate: boolean) {
  const U = PlannerUi, P = plCur(); if (!U.map || !P) return;
  const A = apt(P.from), B = apt(P.to), pts = [A && A.pos, B && B.pos].concat(P.wps.map(w => [w.lon, w.lat])).filter(Boolean);
  if (pts.length) U.map.fit(pts, 60, animate);
}
/** A new waypoint on the leg it fits best (the smallest detour), at the level of the leg. */
function plInsert(w: PlanWp, afterId?: string) {
  const P = plCur(); if (!P) return;
  const A = apt(P.from), B = apt(P.to), nodes = [A.pos].concat(P.wps.map(q => [q.lon, q.lat]), [B.pos]), p = [w.lon, w.lat];
  let at = P.wps.length;
  if (afterId) at = P.wps.findIndex(q => q.id === afterId) + 1;
  else { let bd = 1e9; for (let i = 1; i < nodes.length; i++) { const det = gcDistanceNm(nodes[i - 1], p) + gcDistanceNm(p, nodes[i]) - gcDistanceNm(nodes[i - 1], nodes[i]); if (det < bd) { bd = det; at = i - 1; } } }
  const ref = P.wps[Math.min(at, P.wps.length - 1)] || P.wps[at - 1];
  if (!w.alt) w.alt = ref ? ref.alt : (PlannerUi.prev ? PlannerUi.prev.cruiseAlt : 35000);
  P.wps.splice(at, 0, w); PlannerUi.sel = w.id;
  planSave(P); plRecalc(); plPanelRedraw();
}

/** The route view: hazard areas, the planned path, the airports with their weather, the waypoints, TOC and TOD. */
function plOverlay(c: CanvasRenderingContext2D, m: WorldMap) {
  const U = PlannerUi, P = plCur(); if (!P) return;
  const col = m.colors, degPx = m.degPx();
  // SIGMETs: filled areas by hazard
  const HC: any = { TS: '255,77,77', TC: '255,77,77', TURB: '255,176,32', ICE: '90,200,255', VA: '190,120,255', MTW: '255,176,32' };
  for (const sg of Sigmets.active()) {
    const rgb = HC[sg.hazard] || '255,176,32', pts = sg.poly.map(q => m.px(q[0], q[1]));
    c.beginPath(); pts.forEach((q, i) => i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])); c.closePath();
    c.fillStyle = `rgba(${rgb},.14)`; c.fill(); c.strokeStyle = `rgba(${rgb},.7)`; c.lineWidth = 1.2; c.stroke();
    if (degPx > 1.5) { const cx = pts.reduce((s, q) => s + q[0], 0) / pts.length, cy = pts.reduce((s, q) => s + q[1], 0) / pts.length; c.font = '700 10px Inter, sans-serif'; c.fillStyle = `rgba(${rgb},.95)`; c.fillText(sg.hazard + (sg.top ? ` FL${Math.round(sg.top / 100)}` : ''), cx - 14, cy); }
  }
  // the path: as flown (departure, waypoints, arrival and approach), or straight through the waypoints
  const A = apt(P.from), B = apt(P.to);
  const ll: number[][] = U.path ? U.path.pts : (() => { const n = [A.pos].concat(P.wps.map(w => [w.lon, w.lat]), [B.pos]), o: number[][] = []; for (let i = 1; i < n.length; i++) for (let k = 0; k <= 16; k++) o.push(gcInterpolate(n[i - 1], n[i], k / 16)); return o; })();
  const sp = ll.map(q => m.px(q[0], q[1]));
  c.lineWidth = 2.6; c.strokeStyle = col.mag; c.beginPath(); m.clippedLine(c, sp); c.stroke();
  // top of climb and top of descent
  const pr: FlightProfile = U.prev, path: FlightPath = U.path;
  if (pr && path) {
    const toc = pr.pts.filter(p => p.ph === 'Cruise')[0], tod = pr.pts.filter(p => p.ph === 'Descent')[0];
    for (const [p, lab] of [[toc, 'TOC'], [tod, 'TOD']] as [ProfilePoint, string][]) {
      if (!p) continue; const q = pathAt(path, p.d / pr.routeNm * path.len).pos, s = m.px(q[0], q[1]);
      c.fillStyle = col.cyan; c.beginPath(); c.arc(s[0], s[1], 4, 0, 6.3); c.fill(); c.font = '700 10px Inter, sans-serif'; c.fillText(lab, s[0] + 7, s[1] + 12);
    }
  }
  // the airports, coloured by their flight category
  const CAT: any = { VFR: '#3DDC84', MVFR: '#4FA3FF', IFR: '#FF5A5A', LIFR: '#E04BD6' };
  for (const [k, role] of [[P.from, 'DEP'], [P.to, 'ARR'], [P.altn, 'ALTN']] as [string, string][]) {
    const a = k && apt(k); if (!a) continue; const s = m.px(a.pos[0], a.pos[1]), wx = LiveWx.get(k);
    c.fillStyle = wx && wx.cat ? CAT[wx.cat] || col.ink : col.ink; c.beginPath(); c.arc(s[0], s[1], 6, 0, 6.3); c.fill();
    c.strokeStyle = 'rgba(6,16,30,.9)'; c.lineWidth = 2; c.stroke();
    c.font = '700 11px Inter, sans-serif'; const lab = `${k} ${role}${wx && wx.cat ? ' · ' + wx.cat : ''}`, w = c.measureText(lab).width;
    c.fillStyle = 'rgba(6,16,30,.85)'; c.fillRect(s[0] + 9, s[1] - 9, w + 8, 16); c.fillStyle = col.ink; c.fillText(lab, s[0] + 13, s[1] + 3);
  }
  // the departure, arrival and approach waypoints, with their altitude rules (when zoomed in enough to read)
  const fx: ProcFix[] = (U.path && (U.path as any).fixes) || [];
  if (fx.length && degPx > 6) {
    c.font = '600 10px Inter, sans-serif';
    const taken: number[][] = [];   // labels never drawn over one another
    for (const f of fx) {
      const q = m.px(f.pos[0], f.pos[1]);
      c.fillStyle = col.cyan; c.strokeStyle = 'rgba(6,16,30,.9)'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(q[0], q[1] - 5); c.lineTo(q[0] + 4.5, q[1] + 3.5); c.lineTo(q[0] - 4.5, q[1] + 3.5); c.closePath(); c.fill(); c.stroke();
      if (degPx > 14) {
        const al = f.alt ? (f.ad === '+' ? '≥' : f.ad === '-' ? '≤' : '') + (f.alt >= 18000 ? 'FL' + Math.round(f.alt / 100) : num(f.alt)) : '';
        const lab = f.name + (al ? '  ' + al : '') + (f.spd ? ' ' + f.spd + 'kt' : ''), tw = c.measureText(lab).width;
        const r = [q[0] + 6, q[1] - 14, tw + 6, 13];
        if (taken.some(t => r[0] < t[0] + t[2] && t[0] < r[0] + r[2] && r[1] < t[1] + t[3] && t[1] < r[1] + r[3])) continue;
        taken.push(r);
        c.fillStyle = 'rgba(6,16,30,.78)'; c.fillRect(r[0], r[1], r[2], r[3]); c.fillStyle = '#9FE8F4'; c.fillText(lab, q[0] + 9, q[1] - 4);
      }
    }
  }
  // the waypoints: the selected one larger, each with its name and level
  for (const w of P.wps) {
    const s = m.px(w.lon, w.lat), sel = w.id === U.sel;
    c.fillStyle = sel ? '#FFFFFF' : col.mag; c.strokeStyle = 'rgba(6,16,30,.9)'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(s[0], s[1] - (sel ? 8 : 6)); c.lineTo(s[0] + (sel ? 7 : 5), s[1] + (sel ? 5 : 4)); c.lineTo(s[0] - (sel ? 7 : 5), s[1] + (sel ? 5 : 4)); c.closePath(); c.fill(); c.stroke();
    if (degPx > 0.9 || sel) {
      c.font = `${sel ? 700 : 600} 10.5px Inter, sans-serif`;
      const lab = `${w.name}  ${altText(w.alt)}${w.mach ? ' M' + w.mach.toFixed(2).slice(1) : w.spd ? ' ' + w.spd + 'kt' : ''}`, tw = c.measureText(lab).width;
      c.fillStyle = sel ? 'rgba(224,75,214,.92)' : 'rgba(6,16,30,.8)'; c.fillRect(s[0] + 8, s[1] - 18, tw + 8, 15); c.fillStyle = '#fff'; c.fillText(lab, s[0] + 12, s[1] - 7);
    }
  }
}

/** The vertical profile: altitude along the route, the waypoints, TOC and TOD, the hazards at their levels. */
function plProfileDraw() {
  const cv = document.querySelector('.pl-prof-cv') as HTMLCanvasElement; if (!cv) return;
  const U = PlannerUi, pr: FlightProfile = U.prev, path: FlightPath = U.path, P = plCur();
  const w = cv.clientWidth, h = cv.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  if (!pr || !P) { g.fillStyle = '#5D7590'; g.font = '12px Inter, sans-serif'; g.fillText('The route\'s profile shows here once the airports are known.', 12, h / 2); return; }
  const L = 46, R = 12, T = 14, B = 22, top = Math.max(10000, Math.ceil((Math.max(...pr.pts.map(p => p.alt)) + 4000) / 5000) * 5000);
  const X = (d: number) => L + d / pr.routeNm * (w - L - R), Y = (a: number) => h - B - a / top * (h - T - B);
  // grid and levels
  g.strokeStyle = 'rgba(147,169,193,.15)'; g.fillStyle = '#5D7590'; g.font = '10px Inter, sans-serif'; g.lineWidth = 1;
  for (let a = 0; a <= top; a += top > 30000 ? 10000 : 5000) { g.beginPath(); g.moveTo(L, Y(a)); g.lineTo(w - R, Y(a)); g.stroke(); g.fillText(a ? altText(a) : '0', 4, Y(a) + 3); }
  // hazards at their levels along the route
  for (const [sg, a, b] of plHazards()) {
    const k = path ? pr.routeNm / path.len : 1, rgb = sg.hazard === 'TS' || sg.hazard === 'TC' ? '255,77,77' : sg.hazard === 'ICE' ? '90,200,255' : '255,176,32';
    g.fillStyle = `rgba(${rgb},.22)`; g.fillRect(X(a * k), Y(sg.top || top), Math.max(3, X(b * k) - X(a * k)), Y(sg.base || 0) - Y(sg.top || top));
    g.fillStyle = `rgba(${rgb},.95)`; g.font = '700 10px Inter, sans-serif'; g.fillText(sg.hazard, X(a * k) + 3, Y(sg.top || top) + 11);
  }
  // the profile
  g.beginPath(); pr.pts.forEach((p, i) => i ? g.lineTo(X(p.d), Y(p.alt)) : g.moveTo(X(p.d), Y(p.alt)));
  g.strokeStyle = '#E04BD6'; g.lineWidth = 2; g.stroke();
  g.lineTo(X(pr.routeNm), Y(0)); g.lineTo(X(0), Y(0)); g.closePath(); g.fillStyle = 'rgba(224,75,214,.08)'; g.fill();
  // waypoints
  g.font = '600 10px Inter, sans-serif';
  for (const wp of P.wps) {
    const d = plWpD(P, wp.id); if (d == null || !path) continue;
    const x = X(d / path.len * pr.routeNm); g.strokeStyle = wp.id === U.sel ? '#fff' : 'rgba(224,75,214,.45)'; g.beginPath(); g.moveTo(x, T); g.lineTo(x, h - B); g.stroke();
    g.fillStyle = wp.id === U.sel ? '#fff' : '#93A9C1'; g.save(); g.translate(x + 3, h - B - 4); g.rotate(-Math.PI / 2); g.fillText(wp.name, 0, 0); g.restore();
  }
  // the procedures' altitude limits at their fixes: a bar at the limit (above it: at or above; below it: at or below)
  if (path && (path as any).fixes) {
    g.font = '600 9.5px Inter, sans-serif';
    for (const f of (path as any).fixes as ProcFix[]) {
      if (!f.alt) continue;
      let bi = 0, bd = 1e9; for (let i = 0; i < path.pts.length; i++) { const d = gcDistanceNm(path.pts[i], f.pos); if (d < bd) { bd = d; bi = i; } }
      if (bd > 3) continue;
      const x = X(path.cum[bi] / path.len * pr.routeNm), y = Y(f.alt);
      g.strokeStyle = '#3FD0E8'; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 6, y); g.lineTo(x + 6, y); g.stroke();
      if (f.ad === '+' || f.ad === '-') { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + (f.ad === '+' ? -6 : 6)); g.stroke(); }
      g.fillStyle = '#9FE8F4'; g.fillText(f.name, x + 4, y - 4);
    }
  }
  // TOC, TOD and the distance scale
  const toc = pr.pts.filter(p => p.ph === 'Cruise')[0], tod = pr.pts.filter(p => p.ph === 'Descent')[0];
  g.fillStyle = '#3FD0E8'; g.font = '700 10px Inter, sans-serif';
  if (toc) g.fillText('TOC', X(toc.d) - 10, Y(toc.alt) - 6); if (tod) g.fillText('TOD', X(tod.d) - 10, Y(tod.alt) - 6);
  g.fillStyle = '#5D7590'; g.font = '10px Inter, sans-serif'; g.fillText(`${num(Math.round(path ? path.len : pr.routeNm))} nm`, w - R - 50, h - 6); g.fillText(P.from, L, h - 6); g.fillText(P.to, w - R - 90, h - 6);
}

function plPanelRedraw(soft?: boolean) {
  const panel = document.querySelector('.planner .pl-panel') as HTMLElement; if (!panel) return;
  const U = PlannerUi, P = plCur();
  const sum = document.querySelector('.planner .pl-sum') as HTMLElement;
  if (sum) sum.innerHTML = plSummaryHtml(P);
  if (soft && document.activeElement && panel.contains(document.activeElement)) return;   // don't redraw under your fingers
  panel.innerHTML = !P ? '<p class="muted">Pick a route, or type two airports.</p>' : U.tab === 'wx' ? plWxHtml(P) : U.tab === 'notam' ? plNotamHtml(P) : U.tab === 'rwy' ? plRwyHtml(P) : plRouteHtml(P);
  plProfileDraw();
}
function plSummaryHtml(P: FlightPlanR): string {
  const pr: FlightProfile = PlannerUi.prev, path: FlightPath = PlannerUi.path; if (!P || !pr) return '';
  const chip = (l: string, v: string) => `<span><small>${l}</small><b>${v}</b></span>`;
  return chip('Distance', `${num(Math.round(path ? path.len : pr.routeNm))} nm`) + chip('In the air', plHm(pr.airS)) + chip('Block', plHm(pr.totalS)) + chip('Highest level', altText(pr.cruiseAlt))
    + `<label class="tg-row pl-on"><span><b>Flights fly this plan</b><small>${P.on ? `Every flight ${P.from} → ${P.to} follows it` : 'Off: flights fly their own route'}</small></span><button class="tg ${P.on ? 'on' : ''}" role="switch" aria-checked="${P.on}" data-act="pl-on"><i></i></button></label>`;
}
function plRouteHtml(P: FlightPlanR): string {
  const U = PlannerUi, t = acType(U.typeId || plType()), jet = !!(t && (perfFor(t) as any).jet);
  const rows = P.wps.map((w, i) => {
    const d = plWpD(P, w.id), et = plTimeAt(d), wind = d != null && U.path ? Math.round(tailwindKt(w.alt, w.lat, pathAt(U.path, d).hdg, new Date().getMonth())) : null;
    return `<tr class="${w.id === U.sel ? 'sel' : ''}" data-act="pl-sel" data-id="${w.id}"><td>${i + 1}</td><td><b>${esc(w.name)}</b><small>${w.via ? 'via ' + esc(w.via) + ' · ' : ''}${w.lat.toFixed(2)}, ${w.lon.toFixed(2)}</small></td>
      <td><input class="pl-alt ${t && w.alt > (perfFor(t) as any).maxAlt ? 'warn' : ''}" data-id="${w.id}" value="${altText(w.alt)}" aria-label="Level at ${esc(w.name)}" ${t && w.alt > (perfFor(t) as any).maxAlt ? `title="Above the ${esc(t.model)}'s ceiling: flown at ${altText((perfFor(t) as any).maxAlt)}"` : ''}>${t && w.alt > (perfFor(t) as any).maxAlt ? `<small class="amber">Ceiling ${altText((perfFor(t) as any).maxAlt)}</small>` : ''}</td>
      <td><input class="pl-spd" data-id="${w.id}" value="${w.mach ? 'M' + w.mach.toFixed(2).slice(1) : w.spd ? w.spd : ''}" placeholder="${jet ? 'Auto (M.78)' : 'Auto'}" aria-label="Speed from ${esc(w.name)}"></td>
      <td>${plHm(et)}</td><td class="${wind == null ? '' : wind >= 0 ? 'tail' : 'head'}">${wind == null ? '—' : (wind >= 0 ? '+' : '−') + Math.abs(wind)}</td>
      <td><button class="icon-btn sm" data-act="pl-del" data-id="${w.id}" aria-label="Remove ${esc(w.name)}">${icon('close')}</button></td></tr>`;
  }).join('');
  return `<div class="pl-glob">
      <label><small>Climb speed</small><input class="pl-g" data-k="climbIas" value="${P.climbIas || ''}" placeholder="Type's own" inputmode="numeric"></label>
      <label><small>Descent speed</small><input class="pl-g" data-k="descIas" value="${P.descIas || ''}" placeholder="Type's own" inputmode="numeric"></label>
      <label><small>Alternate</small><input class="pl-g" data-k="altn" value="${esc(P.altn || '')}" placeholder="ICAO" maxlength="4"></label></div>
    <table class="pl-wps"><thead><tr><th></th><th>Waypoint</th><th>Level</th><th>Speed</th><th>Time</th><th title="Wind along the route: + tailwind, − headwind (kt)">Wind</th><th></th></tr></thead>
      <tbody><tr class="apt"><td></td><td><b>${esc(P.from)}</b><small>${esc((apt(P.from) || { name: '' } as any).name)}</small></td><td colspan="5"><small>Departure</small></td></tr>${rows}<tr class="apt"><td></td><td><b>${esc(P.to)}</b><small>${esc((apt(P.to) || { name: '' } as any).name)}</small></td><td colspan="5"><small>Arrival${PlannerUi.prev ? ' · ' + plHm(PlannerUi.prev.airS) : ''}</small></td></tr></tbody></table>
    <div class="pl-add"><input class="pl-addin" placeholder="Add: an airport (EKVG), a position (6200N00700W) or 62.0 -7.0" aria-label="Add a waypoint"><button class="btn sm" data-act="pl-addtxt">${icon('plus')}Add</button></div>
    <small class="muted">Levels: FL350 or 35000; a waypoint's level is flown from it on (step climbs and descents at the waypoint). Speeds: M.82 or 280 (indicated knots), empty for the aircraft's own. Drag a waypoint on the map to move it.</small>
    <div class="pl-btns">${typeof svcOk === 'function' && svcOk('simbriefApi') && SimBrief.user() ? `<button class="btn sm" data-act="pl-simbrief">${icon('download')}From my SimBrief flight plan</button>` : ''}<button class="btn sm" data-act="pl-awy">${icon('routes')}Real airways (Flight Simulator)</button><button class="btn ghost sm" data-act="pl-reset">Start again: straight route</button><button class="btn ghost sm" data-act="pl-remove">Remove this plan</button></div>`;
}
/** Runways: the take-off and landing runway for every flight on this route (yours and your pilots'), by the wind or
 *  assigned, with the wind along each, and the departure, arrival and approach the flights then fly. */
function plRwyHtml(P: FlightPlanR): string {
  const path: FlightPath = PlannerUi.path, RR = routeRunways(P.from, P.to);
  const SRC: any = { faa: 'published (FAA)', sim: 'published (Flight Simulator)', nav: 'built from the navaids around it' };
  const side = (icao: string, k: 'depRwy' | 'arrRwy', title: string) => {
    const ends = runwayEnds(icao), act = activeRunway(icao), cur = (P as any)[k] || '', use = k === 'depRwy' ? RR.dep : RR.arr;
    const wtxt = (r: RunwayEnd) => { const w = runwayWind(r); return w.kt < 1 ? 'calm' : w.head >= 0 ? `head ${w.head} kt` : `tail ${-w.head} kt`; };
    const opt = (r: RunwayEnd) => `<option value="${esc(r.name)}" ${rwyMatch(cur, r.name) ? 'selected' : ''}>${esc(r.name)} · ${num(Math.round(r.lenM))} m · ${wtxt(r)}${r.ils ? ' · ILS' : ''}</option>`;
    const sel = cur ? runwayByName(icao, cur) : null, ws = sel ? runwayWind(sel) : null, w = use ? runwayWind(use) : null, lim = wxLimit(PlannerUi.typeId || plType());
    const warn = sel && ws && -ws.head > RWY_TAIL_MAX ? `Tailwind ${-ws.head} kt on ${sel.name}: flights take off and land on ${use ? use.name : 'the runway in use'} until the wind turns.`
      : w && use && w.cross > lim.xw ? `Crosswind ${w.cross} kt on ${use.name}: more than the ${lim.xw} kt this aircraft is allowed.` : '';
    const part = path ? path.parts.filter(q => q.kind === (k === 'depRwy' ? 'sid' : 'star'))[0] : null, app = path && k === 'arrRwy' ? path.parts.filter(q => q.kind === 'app')[0] : null;
    const src = path ? (path as any)[k === 'depRwy' ? 'depSrc' : 'arrSrc'] : '';
    return `<div class="pl-rwy"><h4 class="pl-h">${title} · ${esc(icao)} <small>${esc((apt(icao) || { name: '' } as any).name)}</small></h4>
      <label><small>Runway</small><select class="pl-rwysel" data-k="${k}" aria-label="${title} runway"><option value="" ${!cur ? 'selected' : ''}>By the wind${act ? ` (now ${esc(act.name)})` : ''}</option>${ends.map(opt).join('')}</select></label>
      ${ends.length ? '' : '<small class="muted">The runways of this airport aren\'t known yet.</small>'}
      ${warn ? `<p class="pl-warn">${icon('alert')}${esc(warn)}</p>` : ''}
      ${use ? plProcPickers(P, use, k === 'depRwy') : ''}
      <div class="pl-procs">${part ? `<span><small>${k === 'depRwy' ? 'Departure' : 'Arrival'}</small><b>${esc(part.name)}</b></span>` : ''}${app ? `<span><small>Approach</small><b>${esc(app.name)}</b></span>` : ''}
        <span><small>Procedures</small><b>${src ? SRC[src] || 'published' : 'built from the runway'}</b></span></div></div>`;
  };
  return `${side(P.from, 'depRwy', 'Take-off')}${side(P.to, 'arrRwy', 'Landing')}
    <small class="muted">Every flight ${esc(P.from)} → ${esc(P.to)} uses these runways: yours and the ones your pilots fly. "By the wind" takes the runway in use, the way the tower does. US airports fly the FAA's published departures, arrivals and approaches (they come with the app, so Flight Simulator doesn't need to be running); elsewhere the ones read from Flight Simulator when it has been linked, otherwise ones built from the runway.</small>`;
}
/** The departure (SID and its transition), or the arrival (STAR and its transition) and the approach (and its
 *  transition), for the runway: by the route (the best one, as now), or the one you pick. */
function plProcPickers(P: FlightPlanR, re: RunwayEnd, dep: boolean): string {
  const Q: any = P, sel = (k: string, label: string, opts: [string, string][], auto: string) => opts.length ? `<label><small>${label}</small><select class="pl-procsel" data-k="${k}" aria-label="${label}">
      <option value="">${esc(auto)}</option>${opts.map(o => `<option value="${esc(o[0])}" ${Q[k] === o[0] ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select></label>` : '';
  const trs = (pr: SimProc) => pr ? pr.enroute.filter(e => e.name).map(e => [e.name, e.name] as [string, string]) : [];
  if (dep) {
    const L = sidsFor(re), cur = L.filter(x => x.name === Q.sid)[0];
    if (!L.length) return '';
    return `<div class="pl-pk">${sel('sid', 'Departure (SID)', L.map(x => [x.name, x.name] as [string, string]), 'The best one for the route')}${cur ? sel('sidTr', 'Transition', trs(cur), 'The best one for the route') : ''}</div>`;
  }
  const S = starsFor(re), A = appsFor(re), cs = S.filter(x => x.name === Q.star)[0], ca = A.filter(x => x.name === Q.app)[0];
  if (!S.length && !A.length) return '';
  return `<div class="pl-pk">${sel('star', 'Arrival (STAR)', S.map(x => [x.name, x.name] as [string, string]), 'The best one for the route')}${cs ? sel('starTr', 'Transition', trs(cs), 'The best one for the route') : ''}
    ${sel('app', 'Approach', A.map(x => [x.name, appName(x)] as [string, string]), 'The best one (ILS first)')}${ca ? sel('appTr', 'Approach transition', trs(ca), 'Where the arrival ends') : ''}</div>`;
}
function plWxHtml(P: FlightPlanR): string {
  const hz = plHazards(), path: FlightPath = PlannerUi.path, pr: FlightProfile = PlannerUi.prev;
  const ids = [[P.from, 'Departure'], [P.to, 'Arrival'], [P.altn, 'Alternate']].filter(x => x[0] && apt(x[0]));
  // winds along the route, leg by leg, at the planned levels
  const legs: string[] = [];
  if (path && pr) for (let d = 0; d < path.len; d += Math.max(50, path.len / 8)) { const q = profileAtD(pr, d / path.len * pr.routeNm), at = pathAt(path, d), wk = Math.round(tailwindKt(q.alt, at.pos[1], at.hdg, new Date().getMonth())); if (q.alt > 5000) legs.push(`<span><small>${num(Math.round(d))} nm · ${altText(q.alt)}</small><b class="${wk >= 0 ? 'tail' : 'head'}">${wk >= 0 ? 'Tail ' : 'Head '}${Math.abs(wk)} kt</b></span>`); }
  return `${ids.map(x => metarCard(x[0], x[1])).join('')}
    <h4 class="pl-h">SIGMETs on the route</h4>
    ${hz.length ? hz.map(([s, a, b]) => `<div class="pl-hz hz-${esc(s.hazard)}"><b>${esc(s.hazard)}${s.qual ? ' · ' + esc(s.qual) : ''}</b><small>${s.base ? altText(s.base) : 'Surface'} to ${s.top ? altText(s.top) : '—'} · ${num(Math.round(a))}–${num(Math.round(b))} nm along the route · until ${s.to ? new Date(s.to).toISOString().slice(11, 16) + 'Z' : '—'}</small>${s.raw ? `<details><summary>Full text</summary><code>${esc(s.raw)}</code></details>` : ''}</div>`).join('') : '<p class="muted">None at the planned levels. The ones nearby are drawn on the map.</p>'}
    <h4 class="pl-h">Winds along the route</h4><div class="pl-winds">${legs.join('') || '<small class="muted">—</small>'}</div>
    <small class="muted">Reports, forecasts and SIGMETs: Aviation Weather Center (NOAA), refreshed every 15 minutes. Winds: the ones the flight's times are worked out with.</small>`;
}
function plNotamHtml(P: FlightPlanR): string {
  const ids = [P.from, P.to, P.altn].filter((x, i, a) => x && apt(x) && a.indexOf(x) === i), key = FaaNotams.key();
  const real = key ? ids.map(k => { const c = FaaNotams.get(k); return `<div class="pl-notams"><h4 class="pl-h">${esc(k)} · ${esc(apt(k).name)}</h4>${!c ? '<small class="muted">Getting the NOTAMs…</small>' : c.err ? `<small class="amber">${esc(c.err)}</small>` : c.list.length ? c.list.map(n => `<div class="pl-notam"><b>${esc(n.id)}</b><code>${esc(n.text)}</code>${n.to ? `<small>${esc(n.from.slice(0, 16).replace('T', ' '))} to ${esc(n.to.slice(0, 16).replace('T', ' '))}</small>` : ''}</div>`).join('') : '<small class="muted">No NOTAMs.</small>'}</div>`; }).join('')
    : `<p class="v3d-note">${icon('info')}For real-world NOTAMs, add your free FAA NOTAM API key in Settings → Online services. The ones below are the airline's own for the day: its flights act on them (a closed runway isn't used, an ILS that is out isn't flown).</p>`;
  const own = ids.map(k => { const ns = notamsFor(k); return ns.length ? `<div class="pl-notams"><h4 class="pl-h">${esc(k)} · the airline's NOTAMs</h4>${ns.map(n => `<div class="pl-notam"><code>${esc(n.text)}</code><small>until ${esc(n.until)}</small></div>`).join('')}</div>` : ''; }).join('');
  return real + (own || (key ? '' : '<p class="muted">No NOTAMs for these airports today.</p>'));
}

/* ---------- editing ---------- */
function plParseAlt(v: string): number { const s = String(v).trim().toUpperCase().replace(/\s/g, ''); const fl = /^FL(\d{2,3})$/.exec(s); if (fl) return +fl[1] * 100; const n = parseInt(s.replace(/[^0-9]/g, ''), 10); return isFinite(n) ? (n < 1000 ? n * 100 : n) : 0; }
function plParseSpd(v: string): { spd?: number; mach?: number } { const s = String(v).trim().toUpperCase(); if (!s) return {}; const m = /^M?\.?(\d{2,3})$/.exec(s.replace('M0.', 'M.').replace('0.', '.')); if (/^M/.test(s) || /^0?\.\d+$/.test(s)) { const x = parseFloat(s.replace(/^M/, '').replace(/^\./, '0.')); return isFinite(x) ? { mach: x > 1 ? x / 100 : x } : {}; } void m; const k = parseInt(s, 10); return isFinite(k) && k >= 60 && k <= 400 ? { spd: k } : {}; }
/** "EKVG", "6200N00700W" or "62.0 -7.0" as a waypoint. */
function plParseWp(v: string): PlanWp {
  const s = v.trim().toUpperCase(); if (!s) return null;
  const a = apt(s); if (a) return { id: uid(), name: s, lat: a.pos[1], lon: a.pos[0], alt: 0, apt: s };
  const c = /^(\d{2})(\d{2})([NS])(\d{3})(\d{2})([EW])$/.exec(s); if (c) { const lat = (+c[1] + +c[2] / 60) * (c[3] === 'S' ? -1 : 1), lon = (+c[4] + +c[5] / 60) * (c[6] === 'W' ? -1 : 1); return { id: uid(), name: s, lat, lon, alt: 0 }; }
  const d = /^(-?\d+(?:\.\d+)?)[ ,]+(-?\d+(?:\.\d+)?)$/.exec(s); if (d) { const lat = +d[1], lon = +d[2]; if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) return { id: uid(), name: coordName(lat, lon), lat, lon, alt: 0 }; }
  return null;
}
document.addEventListener('change', e => {
  const el = e.target as HTMLInputElement; if (!el || !el.closest || !el.closest('.planner')) return;
  const P = plCur(); if (!P) return;
  if (el.classList.contains('pl-alt') || el.classList.contains('pl-spd')) {
    const w = P.wps.filter(q => q.id === el.getAttribute('data-id'))[0]; if (!w) return;
    if (el.classList.contains('pl-alt')) { const a = plParseAlt(el.value); if (a >= 1000 && a <= 51000) w.alt = a; }
    else { const sp = plParseSpd(el.value); w.spd = sp.spd; w.mach = sp.mach; if (!sp.spd) delete w.spd; if (!sp.mach) delete w.mach; }
  } else if (el.classList.contains('pl-rwysel') || el.classList.contains('pl-procsel')) {
    const k = el.getAttribute('data-k'); (P as any)[k] = el.value || undefined; if (!el.value) delete (P as any)[k];
    // a new runway or procedure: what depends on it starts again from the best one
    const dep: any = { depRwy: ['sid', 'sidTr'], sid: ['sidTr'], arrRwy: ['star', 'starTr', 'app', 'appTr'], star: ['starTr'], app: ['appTr'] };
    for (const d of dep[k] || []) delete (P as any)[d];
  } else if (el.classList.contains('pl-g')) {
    const k = el.getAttribute('data-k'), v = el.value.trim().toUpperCase();
    if (k === 'altn') P.altn = apt(v) ? v : ''; else { const n = parseInt(v, 10); (P as any)[k] = isFinite(n) && n >= 120 && n <= 360 ? n : undefined; }
  } else return;
  planSave(P); plRecalc(); plPanelRedraw();
});
ACTIONS['pl-tab'] = el => { PlannerUi.tab = el.getAttribute('data-t'); Sound.tick(); document.querySelectorAll('.pl-tabs button').forEach(b => b.classList.toggle('on', b === el)); plPanelRedraw(); };
ACTIONS['pl-sel'] = (el, ev) => { if (ev && (ev.target as HTMLElement).closest('input, button')) return; PlannerUi.sel = el.getAttribute('data-id'); const P = plCur(), w = P && P.wps.filter(q => q.id === PlannerUi.sel)[0]; if (w && PlannerUi.map) PlannerUi.map.fit([[w.lon, w.lat]], 200, true); plPanelRedraw(); };
ACTIONS['pl-del'] = el => { const P = plCur(); if (!P) return; P.wps = P.wps.filter(w => w.id !== el.getAttribute('data-id')); planSave(P); plRecalc(); plPanelRedraw(); };
ACTIONS['pl-addmode'] = el => { PlannerUi.addMode = !PlannerUi.addMode; el.classList.toggle('primary', PlannerUi.addMode); el.classList.toggle('ghost', !PlannerUi.addMode); el.innerHTML = icon('plus') + (PlannerUi.addMode ? 'Tap the map to add' : 'Add waypoints'); Sound.tick(); };
ACTIONS['pl-fit'] = () => plFit(true);
/** Close in on the departure or the arrival: the procedure's waypoints, with their names and altitudes. */
ACTIONS['pl-zoom'] = el => {
  const P = plCur(), U = PlannerUi; if (!P || !U.map) return;
  const dep = el.getAttribute('data-w') === 'dep', A = apt(dep ? P.from : P.to); if (!A) return;
  const fx: ProcFix[] = ((U.path && (U.path as any).fixes) || []).filter((f: ProcFix) => gcDistanceNm(f.pos, A.pos) < 90);
  const pts = [A.pos].concat(fx.map(f => f.pos)); if (pts.length < 2) pts.push([A.pos[0] + 0.3, A.pos[1] + 0.2], [A.pos[0] - 0.3, A.pos[1] - 0.2]);
  U.map.fit(pts, 50, true, false, true); Sound.tick();
};
ACTIONS['pl-addtxt'] = () => { const inp = document.querySelector('.pl-addin') as HTMLInputElement, w = inp && plParseWp(inp.value); if (!w) { toast('Not an airport code or a position', 'warn'); return; } plInsert(w, PlannerUi.sel || undefined); };
ACTIONS['pl-reset'] = () => { const P = plCur(); if (!P) return; const d = planDefault(P.from, P.to, PlannerUi.typeId || plType()); if (!d) return; P.wps = d.wps; planSave(P); plRecalc(); plFit(true); plPanelRedraw(); };
ACTIONS['pl-remove'] = () => { const P = plCur(); if (!P) return; delete plansAll()[P.key]; Store.soon(); try { for (const k in _profiles) if (k.indexOf('|' + P.from + '|' + P.to + '|') >= 0) delete _profiles[k]; } catch (e) { /* none */ } toast('Plan removed: flights fly their own route', 'info'); plRecalc(); plPanelRedraw(); };
ACTIONS['pl-on'] = () => { const P = plCur(); if (!P) return; P.on = !P.on; planSave(P); plRecalc(); Sound.tick(); plPanelRedraw(); toast(P.on ? `Flights ${P.from} → ${P.to} now fly this plan` : 'Flights fly their own route again', 'ok'); };

ACTIONS['pl-simbrief'] = () => {
  toast('Getting your SimBrief flight plan…', 'info');
  SimBrief.fetch().then((o: Ofp) => {
    const P = planFromOfp(o); if (!P) { toast('The SimBrief flight plan has no route between two known airports', 'warn'); return; }
    const old = plansAll()[P.key]; if (old) P.v = old.v;
    PlannerUi.from = P.from; PlannerUi.to = P.to; PlannerUi.sel = '';
    planSave(P); plRecalc(); plFit(true); plPanelRedraw();
    toast(`SimBrief plan ${P.from} → ${P.to}: ${P.wps.length} waypoints. Flights on this route now fly it.`, 'ok');
  }, (e: any) => toast((e && e.message) || 'SimBrief could not be reached', 'warn'));
};

/** The plan along the real airways (from the simulator through the PC app): its fixes with the airway to each. */
function plFillAirways(route: AwyFixA[]) {
  const P = plCur(); if (!P || !route || !route.length) return;
  const alt = PlannerUi.prev ? PlannerUi.prev.cruiseAlt : (P.wps[0] ? P.wps[0].alt : 35000);
  P.wps = route.map(x => ({ id: uid(), name: x.id, lat: x.lat, lon: x.lon, alt, via: x.via && x.via !== 'DCT' ? x.via : '' }));
  planSave(P); plRecalc(); plFit(true); plPanelRedraw();
  toast(`${P.wps.length} waypoints along the airways`, 'ok');
}
ACTIONS['pl-awy'] = () => {
  const P = plCur(); if (!P) return;
  const cls = awyClass(PlannerUi.typeId || plType()), k = AirwayRoutes.key(P.from, P.to, cls);
  const have = AirwayRoutes.data[k]; if (have) { plFillAirways(have.route); return; }
  if (Link.status !== 'connected') { toast('Link the PC app with Flight Simulator running to get the real airways', 'warn'); return; }
  PlannerUi.awyWait = k; delete AirwayRoutes.asked[k]; delete AirwayRoutes.data[k];
  AirwayRoutes.ask(P.from, P.to, cls);
  toast(`Asking Flight Simulator for the ${cls === 'H' ? 'high' : 'low'} airways ${P.from} → ${P.to}…`, 'info');
};
