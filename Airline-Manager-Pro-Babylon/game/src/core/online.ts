// Online services the app works with. Each one is optional and switched on in Settings → Online services.
//  - SimBrief: your latest flight plan (OFP) by your SimBrief username or pilot ID: route, cruise
//    level, fuel, weights, passengers; sent to the simulator as a flight plan, or used for your next leg.
//  - Live weather: real METAR and TAF reports (aviationweather.gov, from the US National Weather
//    Service, free and public). The wind decides the runway in use and the weather delays.
//  - VATSIM and IVAO: who is online. The air traffic controllers at your airports, your airline's
//    flights on the networks, and their traffic on the map.
//  - Hoppie ACARS: company messages sent to your aircraft's ACARS in the simulator (load sheet before
//    departure, arrival information before landing), and messages you send to your airline from the
//    aircraft show up in the app. Needs your own free Hoppie logon code.
//  - Discord: posts to your airline's Discord channel through a webhook you create there.
// On the phone the requests go out through Android itself; in the PC app through the PC app; so the
// services don't need to allow requests from web pages.

const Net = {
  /** GET or POST, returning the text. */
  request(url: string, opts?: { method?: string; body?: string; headers?: { [k: string]: string }; timeout?: number }): Promise<{ status: number; text: string }> {
    opts = opts || {};
    const method = opts.method || 'GET', headers = opts.headers || {};
    const cap: any = (window as any).Capacitor;
    const native = cap && cap.isNativePlatform && cap.isNativePlatform() && cap.Plugins && cap.Plugins.CapacitorHttp;
    if (native) {
      return native.request({ url, method, headers, data: opts.body, responseType: 'text', connectTimeout: opts.timeout || 15000, readTimeout: opts.timeout || 15000 })
        .then((r: any) => ({ status: r.status, text: typeof r.data === 'string' ? r.data : JSON.stringify(r.data) }));
    }
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = setTimeout(() => { try { ctl && ctl.abort(); } catch (e) { /* ignore */ } }, opts.timeout || 15000);
    const done = (p: Promise<Response>) => p.then(r => r.text().then(t => { clearTimeout(timer); return { status: r.status, text: t }; }), (e: any) => { clearTimeout(timer); throw e; });
    if (DESKTOP) return done(fetch('/api/fetch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, method, headers, body: opts.body }), signal: ctl ? ctl.signal : undefined }));
    return done(fetch(url, { method, headers, body: opts.body, signal: ctl ? ctl.signal : undefined }));
  },
  json(url: string, opts?: any): Promise<any> {
    return this.request(url, opts).then(r => { if (r.status >= 400) throw new Error('HTTP ' + r.status); return JSON.parse(r.text); });
  },
};

function onlineSet(): any { return State.settings as any; }
/** Services switched on in app.config.json once their provider has given permission for a paid app. */
function svcOk(k: 'vatsim' | 'ivao' | 'simbriefApi' | 'hoppie'): boolean { const s: any = (APP as any).services || {}; return s[k] === true; }
function netChoices(): string[][] { const o = [['off', 'Off']]; if (svcOk('vatsim')) o.push(['vatsim', 'VATSIM']); if (svcOk('ivao')) o.push(['ivao', 'IVAO']); if (svcOk('vatsim') && svcOk('ivao')) o.push(['both', 'Both']); return o; }

/* ---------- Saving a file (flight plans, the airline page) ---------- */
function saveTextFile(name: string, mime: string, text: string): Promise<boolean> {
  const T = Store.native();
  if (T && T.backupExport) return T.backupExport({ data: text, name, mime }).then((r: any) => !!(r && r.saved));
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: mime })); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  return Promise.resolve(true);
}

/* ---------- SimBrief ---------- */
interface OfpFix { ident: string; type: string; lat: number; lon: number; alt: number; via: string; stage: string; ias?: number; mach?: number; proc?: boolean }
interface Ofp {
  at: number; from: string; to: string; altn: string; flight: string; airline: string; acType: string; reg: string; route: string; cruiseFt: number;
  blockMin: number; airMin: number; nm: number; pax: number; cargoKg: number; zfwKg: number; towKg: number; lawKg: number;
  fuel: { ramp: number; trip: number; reserve: number; altn: number; taxi: number; extra: number }; units: string; fixes: OfpFix[]; sid: string; star: string; costIndex: string;
}
const SimBrief = {
  busy: false, error: '',
  ofp(): Ofp { return (State as any).ofp || null; },
  user(): string { return svcOk('simbriefApi') ? String(onlineSet().sbUser || '').trim() : ''; },
  /** Your latest OFP from SimBrief. */
  fetch(): Promise<Ofp> {
    const u = this.user(); if (!u) return Promise.reject(new Error('Enter your SimBrief username or pilot ID in Settings → Online services'));
    this.busy = true; this.error = '';
    const q = /^\d+$/.test(u) ? 'userid=' + encodeURIComponent(u) : 'username=' + encodeURIComponent(u);
    return Net.json(`https://www.simbrief.com/api/xml.fetcher.php?${q}&json=1`).then((d: any) => {
      this.busy = false;
      if (d && d.fetch && d.fetch.status && !/success/i.test(d.fetch.status)) throw new Error(d.fetch.status);
      const lbs = d.params && /lbs/i.test(d.params.units), kg = (v: any) => Math.round((+v || 0) * (lbs ? 0.453592 : 1));
      const g = d.general || {}, w = d.weights || {}, f = d.fuel || {}, t = d.times || {};
      const fx = (d.navlog && d.navlog.fix) ? (Array.isArray(d.navlog.fix) ? d.navlog.fix : [d.navlog.fix]) : [];
      const mach = (x: any) => { const m = +x.mach; return m > 0 && m < 1 ? m : +x.mach_thousandths > 0 ? +x.mach_thousandths / 1000 : 0; };
      const fixes: OfpFix[] = fx.map((x: any) => ({ ident: String(x.ident || ''), type: String(x.type || ''), lat: +x.pos_lat, lon: +x.pos_long, alt: +x.altitude_feet || 0, via: String(x.via_airway || ''), stage: String(x.stage || ''),
        ias: +x.ind_airspeed || 0, mach: mach(x), proc: String(x.is_sid_star) === '1' }))
        .filter((x: OfpFix) => isFinite(x.lat) && isFinite(x.lon));
      const o: Ofp = {
        at: Date.now(), from: (d.origin || {}).icao_code || '', to: (d.destination || {}).icao_code || '', altn: (d.alternate || {}).icao_code || '',
        flight: (g.icao_airline || '') + (g.flight_number || ''), airline: g.icao_airline || '', acType: (d.aircraft || {}).icaocode || '', reg: (d.aircraft || {}).reg || '',
        route: g.route || '', cruiseFt: +g.initial_altitude || 0, blockMin: Math.round((+t.est_block || 0) / 60), airMin: Math.round((+t.est_time_enroute || 0) / 60), nm: +g.route_distance || +g.gc_distance || 0,
        pax: +w.pax_count || 0, cargoKg: kg(w.cargo), zfwKg: kg(w.est_zfw), towKg: kg(w.est_tow), lawKg: kg(w.est_ldw),
        fuel: { ramp: kg(f.plan_ramp), trip: kg(f.est_burn), reserve: kg(f.reserve), altn: kg(f.alternate_burn), taxi: kg(f.taxi), extra: kg(f.extra) },
        units: 'kg', fixes, sid: fixes.filter(x => x.stage === 'CLB' && /\d[A-Z]?$/.test(x.via))[0] ? fixes.filter(x => x.stage === 'CLB' && /\d[A-Z]?$/.test(x.via))[0].via : '', star: '', costIndex: String(g.costindex || ''),
      };
      if (!o.from || !o.to) throw new Error('SimBrief returned no flight plan. Plan a flight on SimBrief first.');
      [o.from, o.to, o.altn].forEach(k => { if (k) try { registerWorldAirport(k); } catch (e) { /* ignore */ } });
      (State as any).ofp = o; Store.soon();
      return o;
    }).catch((e: any) => { this.busy = false; this.error = (e && e.message) || String(e); throw e; });
  },
  /** SimBrief's planner, filled in with a leg. */
  planUrl(from: string, to: string, reg?: string): string {
    const c = company(), a = reg ? plane(reg) : null, t = a ? acType(a.typeId) : null;
    const q: string[] = [`orig=${from}`, `dest=${to}`, `airline=${encodeURIComponent(c.icao)}`, `fltnum=${100 + (_hashStr(from + to) % 800)}`];
    if (t) q.push(`type=${encodeURIComponent(icaoTypeOf(t))}`);
    if (a) q.push(`reg=${encodeURIComponent(a.reg)}`);
    return 'https://dispatch.simbrief.com/options/custom?' + q.join('&');
  },
};
/** The ICAO type designator for SimBrief and the networks. */
function icaoTypeOf(t: AircraftType): string {
  const m: { [k: string]: string } = { 'a320-fenix': 'A320', a320neo: 'A20N', 'a350-ini': 'A359', 'a310-ini': 'A310', 'b738-pmdg': 'B738', 'b736-pmdg': 'B736', 'b77w-pmdg': 'B77W', b78x: 'B78X', b748: 'B748',
    'crj9-aero': 'CRJ9', 'crj7-aero': 'CRJ7', atr72: 'AT76', 'dhc6-aero': 'DHC6', dhc2: 'DHC2', c208: 'C208', kodiak: 'KODI', pc12: 'PC12', c172: 'C172' };
  return m[t.id] || t.model.replace(/[^A-Z0-9]/gi, '').slice(0, 4).toUpperCase();
}

/* ---------- Flight plan file for the simulator (.PLN) ---------- */
function plnLLA(lat: number, lon: number, altFt: number): string {
  const f = (v: number, p: string, n: string) => { const a = Math.abs(v), d = Math.floor(a), mf = (a - d) * 60, m = Math.floor(mf), s = (mf - m) * 60; return `${v >= 0 ? p : n}${d}° ${m}' ${s.toFixed(2)}"`; };
  return `${f(lat, 'N', 'S')},${f(lon, 'E', 'W')},${altFt >= 0 ? '+' : '-'}${String(Math.abs(Math.round(altFt))).padStart(6, '0')}.00`;
}
function xmlEsc(s: string): string { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
/** A flight plan Microsoft Flight Simulator 2024 opens (World map → Load/Save → Load). */
function buildPln(from: string, to: string, cruiseFt?: number): { name: string; text: string } {
  const A: any = apt(from), B: any = apt(to); if (!A || !B) return null;
  const ofp = SimBrief.ofp(), useOfp = ofp && ofp.from === from && ofp.to === to && ofp.fixes.length;
  let pts: { id: string; lat: number; lon: number; alt: number; type: string; via?: string }[] = [];
  if (useOfp) pts = ofp.fixes.filter(x => x.ident !== from && x.ident !== to && x.type !== 'apt' && !/TOC|TOD/.test(x.ident)).map(x => ({ id: x.ident.slice(0, 10), lat: x.lat, lon: x.lon, alt: x.alt, type: 'User', via: x.via }));
  else {
    // the app's own path between the runways in use, a point every 40 nm or so
    const fp: any = typeof flightPathFor === 'function' ? flightPathFor(from, to) : null;
    const line: number[][] = fp && fp.pts && fp.pts.length > 2 ? fp.pts : [A.pos, B.pos];
    let last = line[0], n = 0;
    for (let i = 1; i < line.length - 1; i++) if (gcDistanceNm(last, line[i]) >= 40) { last = line[i]; n++; pts.push({ id: 'WP' + String(n).padStart(2, '0'), lat: line[i][1], lon: line[i][0], alt: cruiseFt || 0, type: 'User' }); }
  }
  const cruise = cruiseFt || (useOfp ? ofp.cruiseFt : 0) || 33000;
  const wp = (id: string, type: string, lat: number, lon: number, alt: number, icao?: string, via?: string) => `    <ATCWaypoint id="${xmlEsc(id)}">
      <ATCWaypointType>${type}</ATCWaypointType>
      <WorldPosition>${plnLLA(lat, lon, alt)}</WorldPosition>${via && via !== 'DCT' && !/SID|STAR/.test(via) ? `\n      <ATCAirway>${xmlEsc(via)}</ATCAirway>` : ''}${icao ? `\n      <ICAO>\n        <ICAOIdent>${xmlEsc(icao)}</ICAOIdent>\n      </ICAO>` : ''}
    </ATCWaypoint>`;
  const elevA = (A.elev || 0), elevB = (B.elev || 0);
  const text = `<?xml version="1.0" encoding="UTF-8"?>
<SimBase.Document Type="AceXML" version="1,0">
  <Descr>AceXML Document</Descr>
  <FlightPlan.FlightPlan>
    <Title>${xmlEsc(from)} to ${xmlEsc(to)}</Title>
    <FPType>IFR</FPType>
    <RouteType>HighAlt</RouteType>
    <CruisingAlt>${cruise}</CruisingAlt>
    <DepartureID>${xmlEsc(from)}</DepartureID>
    <DepartureLLA>${plnLLA(A.pos[1], A.pos[0], elevA)}</DepartureLLA>
    <DestinationID>${xmlEsc(to)}</DestinationID>
    <DestinationLLA>${plnLLA(B.pos[1], B.pos[0], elevB)}</DestinationLLA>
    <Descr>${xmlEsc(from)}, ${xmlEsc(to)}${useOfp ? ' ' + xmlEsc(ofp.route) : ''}</Descr>
    <DepartureName>${xmlEsc(A.name || from)}</DepartureName>
    <DestinationName>${xmlEsc(B.name || to)}</DestinationName>
    <AppVersion>
      <AppVersionMajor>12</AppVersionMajor>
      <AppVersionBuild>1</AppVersionBuild>
    </AppVersion>
${wp(from, 'Airport', A.pos[1], A.pos[0], elevA, from)}
${pts.map(p => wp(p.id, p.type, p.lat, p.lon, p.alt, '', p.via)).join('\n')}
${wp(to, 'Airport', B.pos[1], B.pos[0], elevB, to)}
  </FlightPlan.FlightPlan>
</SimBase.Document>
`;
  return { name: `${from}${to}.pln`, text };
}
/** Send a flight plan to the simulator PC (saved in Documents\Airline Manager Pro\Flight plans), or save the file. */
function sendPlnToPc(from: string, to: string): Promise<string> {
  const p = buildPln(from, to); if (!p) return Promise.reject(new Error('Unknown airport'));
  if (DESKTOP) return fetch('/api/flightplan', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) }).then(r => r.json()).then(r => { if (!r.ok) throw new Error(r.error || 'Not saved'); return r.path; });
  if (Link.status !== 'connected') return Promise.reject(new Error('Link your PC first'));
  return new Promise((ok, bad) => {
    (window as any).__plnWait = { ok, bad };
    try { linkSend({ type: 'flightplan', name: p.name, text: p.text }); } catch (e) { bad(e); }
    setTimeout(() => { const w = (window as any).__plnWait; if (w && w.ok === ok) { (window as any).__plnWait = null; bad(new Error('The PC app didn\'t answer. Update the PC app to this version.')); } }, 8000);
  });
}
function plnSaved(path: string, error?: string) { const w = (window as any).__plnWait; (window as any).__plnWait = null; if (!w) return; if (error) w.bad(new Error(error)); else w.ok(path); }

/* ---------- Live weather: METAR and TAF ---------- */
/** The cloud layers of one report (base in feet above the station), with towering cumulus and thunderstorm clouds marked. */
function metarClouds(m: any): { cover: string; base: number; type?: string }[] {
  const raw = String(m.rawOb || ''), out: { cover: string; base: number; type?: string }[] = [];
  for (const c of m.clouds || []) {
    const cov = String(c.cover || ''); if (!/FEW|SCT|BKN|OVC|VV/.test(cov)) continue;
    const base = +c.base || 0, t = new RegExp(cov.slice(0, 3) + String(Math.round(base / 100)).padStart(3, '0') + '(CB|TCU)').exec(raw);
    out.push({ cover: cov === 'VV' ? 'OVC' : cov.slice(0, 3), base, type: t ? t[1] : undefined });
  }
  return out;
}
interface Metar { icao: string; raw: string; taf: string; dir: number; kt: number; gust: number; vis: string; temp: number; qnh: number; cat: string; at: number; obs: string; wx?: string; ceil?: number; clouds?: { cover: string; base: number; type?: string }[]; elev?: number }
const LiveWx = {
  cache: {} as { [icao: string]: Metar }, pending: {} as { [icao: string]: boolean }, failed: 0,
  on(): boolean { return true; },   // real-world weather is always used
  /** The latest report, if fetched (asks for it in the background otherwise). */
  get(icao: string): Metar {
    if (!this.on() || !icao || icao.length !== 4) return null;
    const m = this.cache[icao];
    if ((!m || Date.now() - m.at > 15 * 60e3) && !this.pending[icao] && Date.now() - this.failed > 120e3 && this.queue.indexOf(icao) < 0) {
      // asked for together: one request for many airports
      this.queue.push(icao);
      if (!this.qTimer) this.qTimer = setTimeout(() => { const q = this.queue.splice(0, 40); this.qTimer = 0; this.fetch(q); if (this.queue.length) this.get(this.queue.shift()); }, 400);
    }
    return m || null;
  },
  queue: [] as string[], qTimer: 0 as any,
  /** One report from the Aviation Weather Center (also used by the map's weather layer). */
  store(m: any, taf: string) {
    const k = m.icaoId, old = this.cache[k];
    const ceil = (m.clouds || []).filter((c: any) => /BKN|OVC|VV/.test(c.cover)).map((c: any) => +c.base).sort((a: number, b: number) => a - b)[0];
    this.cache[k] = { icao: k, raw: m.rawOb || '', taf: taf || (old ? old.taf : ''), dir: typeof m.wdir === 'number' ? m.wdir : -1, kt: +m.wspd || 0, gust: +m.wgst || 0, vis: String(m.visib == null ? '' : m.visib),
      temp: +m.temp, qnh: Math.round(+m.altim || 0), cat: m.fltCat || metarCat(m), at: Date.now(), obs: m.reportTime || '', wx: m.wxString || '', ceil: ceil == null ? 0 : ceil,
      clouds: metarClouds(m), elev: +m.elev || 0 };
  },
  fetch(ids: string[]): Promise<void> {
    ids = ids.filter(k => k && k.length === 4 && !this.pending[k]); if (!ids.length) return Promise.resolve();
    ids.forEach(k => this.pending[k] = true);
    const q = ids.join(',');
    return Promise.all([Net.json(`https://aviationweather.gov/api/data/metar?ids=${q}&format=json`), Net.json(`https://aviationweather.gov/api/data/taf?ids=${q}&format=json`).catch(() => [])]).then(([ms, ts]: any[]) => {
      for (const k of ids) {
        const m = (ms || []).filter((x: any) => x.icaoId === k)[0], t = (ts || []).filter((x: any) => x.icaoId === k)[0];
        if (!m) { this.cache[k] = this.cache[k] || ({ icao: k, raw: '', taf: '', dir: -1, kt: 0, gust: 0, vis: '', temp: NaN, qnh: 0, cat: '', at: Date.now(), obs: '' } as Metar); continue; }
        this.store(m, t ? t.rawTAF || '' : '');
      }
      try { if (/ops|map|dispatch/.test(State.screen)) refreshSoft(); } catch (e) { /* ignore */ }
    }).catch(() => { this.failed = Date.now(); }).then(() => { ids.forEach(k => delete this.pending[k]); });
  },
};
function metarCat(m: any): string {
  const vis = parseFloat(String(m.visib).replace('+', '')) || 10;
  const cl = (m.clouds || []).filter((c: any) => /BKN|OVC|VV/.test(c.cover)).map((c: any) => +c.base).sort((a: number, b: number) => a - b)[0] || 99999;
  return vis < 1 || cl < 500 ? 'LIFR' : vis < 3 || cl < 1000 ? 'IFR' : vis <= 5 || cl <= 3000 ? 'MVFR' : 'VFR';
}
/** Redraw without moving the screen (the weather or the networks came in). */
let _softT = 0;
function refreshSoft() { if (Date.now() - _softT < 1500 || document.querySelector('.layer')) return; _softT = Date.now(); if (State.screen === 'dispatch') refresh(); }

/* ---------- VATSIM and IVAO ---------- */
interface NetPilot { net: 'VATSIM' | 'IVAO'; callsign: string; id: string; lat: number; lon: number; alt: number; gs: number; hdg: number; from: string; to: string; type: string }
interface NetAtc { net: 'VATSIM' | 'IVAO'; callsign: string; freq: string; name: string; atis?: string }
const Network = {
  pilots: [] as NetPilot[], atc: [] as NetAtc[], at: 0, error: '', timer: 0 as any,
  which(): string { const w = onlineSet().network || 'off'; return netChoices().some(o => o[0] === w) ? w : 'off'; },
  start() {
    clearInterval(this.timer); if (this.which() === 'off') { this.pilots = []; this.atc = []; return; }
    const go = () => { if (!document.hidden) this.fetch(); };
    go(); this.timer = setInterval(go, 60000);
  },
  fetch(): Promise<void> {
    const w = this.which(), jobs: Promise<any>[] = [];
    const pilots: NetPilot[] = [], atc: NetAtc[] = [];
    if (w === 'vatsim' || w === 'both') jobs.push(Net.json('https://data.vatsim.net/v3/vatsim-data.json', { timeout: 20000 }).then((d: any) => {
      for (const p of d.pilots || []) { const fp = p.flight_plan || {}; pilots.push({ net: 'VATSIM', callsign: p.callsign, id: String(p.cid), lat: p.latitude, lon: p.longitude, alt: p.altitude, gs: p.groundspeed, hdg: p.heading, from: fp.departure || '', to: fp.arrival || '', type: fp.aircraft_short || '' }); }
      for (const c of (d.controllers || []).concat(d.atis || [])) if (c.facility > 0 || /ATIS/.test(c.callsign)) atc.push({ net: 'VATSIM', callsign: c.callsign, freq: c.frequency, name: c.name || '', atis: (c.text_atis || []).join(' ') });
    }));
    if (w === 'ivao' || w === 'both') jobs.push(Net.json('https://api.ivao.aero/v2/tracker/whazzup', { timeout: 20000 }).then((d: any) => {
      const cl = d.clients || {};
      for (const p of cl.pilots || []) { const t = p.lastTrack || {}, fp = p.flightPlan || {}; if (t.latitude == null) continue; pilots.push({ net: 'IVAO', callsign: p.callsign, id: String(p.userId), lat: t.latitude, lon: t.longitude, alt: t.altitude, gs: t.groundSpeed, hdg: t.heading, from: fp.departureId || '', to: fp.arrivalId || '', type: (fp.aircraft && fp.aircraft.icaoCode) || fp.aircraftId || '' }); }
      for (const c of cl.atcs || []) atc.push({ net: 'IVAO', callsign: c.callsign, freq: c.atcSession ? String(c.atcSession.frequency) : '', name: '', atis: c.atis && c.atis.lines ? c.atis.lines.join(' ') : '' });
    }));
    return Promise.all(jobs.map(j => j.catch((e: any) => { this.error = (e && e.message) || String(e); }))).then(() => {
      if (pilots.length || atc.length) { this.pilots = pilots; this.atc = atc; this.at = Date.now(); this.error = ''; }
      try { refreshSoft(); } catch (e) { /* ignore */ }
    });
  },
  /** Controllers online at an airport (ATIS, delivery, ground, tower, approach). */
  atcAt(icao: string): NetAtc[] { return this.atc.filter(a => a.callsign.indexOf(icao + '_') === 0 || a.callsign === icao + '_ATIS'); },
  /** Your airline's flights online, by callsign prefix, and you by your member ID. */
  ours(): NetPilot[] { const c = company(); return this.pilots.filter(p => p.callsign.indexOf(c.icao) === 0 && /\d/.test(p.callsign.slice(3, 4))); },
  me(): NetPilot { const ids = [String(onlineSet().vatsimId || ''), String(onlineSet().ivaoId || '')].filter(Boolean); return this.pilots.filter(p => ids.indexOf(p.id) >= 0)[0] || null; },
  /** Network traffic on the world map: small grey aircraft, with callsigns when zoomed in. */
  drawOnMap(c: CanvasRenderingContext2D, m: any, degPx: number) {
    if (!this.pilots.length || onlineSet().netOnMap === false || degPx < 0.6) return;
    const light = m.ml && State.settings.mapStyle === 'street';
    c.save(); c.globalAlpha = 0.75;
    let drawn = 0;
    for (const p of this.pilots) {
      const q = m.px(p.lon, p.lat); if (!q || q[0] < -20 || q[1] < -20 || q[0] > m.w + 20 || q[1] > m.h + 20) continue;
      drawPlaneGlyph(c, q[0], q[1], p.hdg || 0, 12, false, light ? '#5A6B80' : '#9FB0C4', light ? '#FFFFFF' : '#06111F');
      if (degPx > 6) { c.font = '500 10px Inter, sans-serif'; c.fillStyle = light ? '#33445A' : '#9FB0C4'; c.fillText(p.callsign, q[0] + 9, q[1] - 7); }
      if (++drawn > 1500) break;
    }
    c.restore();
  },
};

/* ---------- Hoppie ACARS ---------- */
interface AcarsMsg { at: number; from: string; to: string; text: string; out: boolean }
const Acars = {
  timer: 0 as any, error: '',
  code(): string { return svcOk('hoppie') ? String(onlineSet().hoppieCode || '').trim() : ''; },
  station(): string { return (company().icao + 'OPS').toUpperCase(); },
  log(): AcarsMsg[] { const S: any = State; return S.acars = S.acars || []; },
  add(m: AcarsMsg) { const l = this.log(); l.unshift(m); if (l.length > 120) l.length = 120; },
  send(to: string, text: string): Promise<boolean> {
    const code = this.code(); if (!code) return Promise.reject(new Error('Enter your Hoppie logon code in Settings → Online services'));
    const from = this.station();
    const url = `https://www.hoppie.nl/acars/system/connect.html?logon=${encodeURIComponent(code)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to.toUpperCase())}&type=telex&packet=${encodeURIComponent(text.toUpperCase().slice(0, 220))}`;
    return Net.request(url).then(r => {
      if (!/^ok/i.test(r.text.trim())) throw new Error(r.text.trim().slice(0, 120) || 'Hoppie refused the message');
      this.add({ at: Date.now(), from, to: to.toUpperCase(), text: text.toUpperCase(), out: true }); this.error = ''; Store.soon(); return true;
    }).catch((e: any) => { this.error = (e && e.message) || String(e); throw e; });
  },
  /** Messages sent from the aircraft to the airline. */
  poll() {
    const code = this.code(); if (!code) return;
    const from = this.station();
    Net.request(`https://www.hoppie.nl/acars/system/connect.html?logon=${encodeURIComponent(code)}&from=${encodeURIComponent(from)}&to=SERVER&type=poll`).then(r => {
      const t = r.text.trim(); if (!/^ok/i.test(t)) { this.error = t.slice(0, 120); return; }
      const re = /\{(\S+)\s+(\w+)\s+\{([^}]*)\}\}/g; let m: RegExpExecArray;
      while ((m = re.exec(t))) {
        this.add({ at: Date.now(), from: m[1], to: from, text: m[3], out: false });
        State.notices.unshift({ id: uid(), kind: 'flight', title: `ACARS from ${m[1]}`, body: m[3], time: 'Now', read: false } as any);
      }
      try { renderTopbar(); } catch (e) { /* ignore */ }
    }).catch((e: any) => { this.error = (e && e.message) || String(e); });
  },
  start() { clearInterval(this.timer); if (!this.code()) return; this.timer = setInterval(() => { if (!document.hidden) this.poll(); }, 75000); },
  /** Company messages to your aircraft at the right moments of your flight. */
  onMyEvent(kind: string, f: { callsign: string; from: string; to: string }) {
    if (!this.code() || onlineSet().hoppieAuto === false || !f || !f.callsign) return;
    const L: any = (State as any).myLoad || {}, a = plane((State as any).myReg[State.companyId]);
    if (kind === 'blocks-off') {
      const text = `LOADSHEET ${f.callsign} ${f.from}-${f.to} ${a ? a.reg : ''} PAX ${L.pax || 0} BAGS ${num(L.bagsKg || 0)}KG CARGO ${num(L.cargoKg || 0)}KG FUEL ${num(L.fuelKg || 0)}KG. HAVE A GOOD FLIGHT. ${company().name.toUpperCase()} OPS`;
      this.send(f.callsign, text).catch(() => { /* shown in Dispatch */ });
    } else if (kind === 'descent') {
      const m = LiveWx.get(f.to), stand = (typeof Bases !== 'undefined' && (Bases as any).standFor) ? (Bases as any).standFor(f.to) : '';
      const text = `ARRIVAL INFO ${f.to}${stand ? ' STAND ' + stand : ''}. ${m && m.raw ? 'METAR ' + m.raw : ''} WELCOME TO ${f.to}`;
      this.send(f.callsign, text).catch(() => { /* shown in Dispatch */ });
    }
  },
};

/* ---------- Discord ---------- */
const Online = {
  _last: {} as { [k: string]: number },
  webhook(): string { const u = String(onlineSet().discordUrl || '').trim(); return /^https:\/\/(discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+/.test(u) ? u : ''; },
  /** Post to your airline's Discord channel, for the kinds of news switched on. */
  discord(kind: 'mine' | 'ai' | 'fleet' | 'jobs' | 'any', title: string, text: string, fields?: [string, string][]) {
    const url = this.webhook(), S = onlineSet(); if (!url) return;
    const on: any = { mine: S.discordMine, ai: S.discordAi, fleet: S.discordFleet, jobs: S.discordJobs, any: true }; if (!on[kind]) return;
    const c = company(), col = parseInt((c.color || '#2C8CFF').slice(1), 16);
    const body = { username: c.name, embeds: [{ title, description: text, color: col, timestamp: new Date().toISOString(), footer: { text: `${c.icao} · ${APP.name}` }, fields: (fields || []).map(f => ({ name: f[0], value: f[1], inline: true })) }] };
    Net.request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => { /* offline: skipped */ });
  },
  /** A hired pilot's landing; at most one post a minute, so fast virtual pilots don't flood the channel. */
  discordAiLanding(f: LiveFlight, net: number) {
    if (Date.now() - (this._last.ai || 0) < 60000) return; this._last.ai = Date.now();
    const p = pilot(f.pilotId);
    this.discord('ai', `${f.callsign} landed at ${f.to}`, `${p ? p.name : 'A hired pilot'} flew ${f.from} → ${f.to} with ${f.pax} passengers.`, [['Result', money(net, { sign: true })]]);
  },
  test(): Promise<boolean> {
    const url = this.webhook(); if (!url) return Promise.reject(new Error('That isn\'t a Discord webhook address'));
    const c = company();
    return Net.request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: c.name, content: `${c.name} is connected to ${APP.name}. Flights and news will show up here.` }) }).then(r => { if (r.status >= 300) throw new Error('Discord answered ' + r.status); return true; });
  },
};

/* ---------- The public airline page ---------- */
/** A page about the airline to share anywhere: fleet, routes, numbers, pilots and the latest flights. */
function airlinePageHtml(): string {
  const c = company(), fl = fleetOf(c.id), rs = State.routes.filter(r => r.companyId === c.id && !r.test);
  const log = State.logbook.filter(l => plane(l.reg) ? plane(l.reg).companyId === c.id : true).filter(l => l.result !== 'crash').slice(0, 15);
  const pax = State.logbook.reduce((t, l) => t + (l.pax || 0), 0), hrs = fl.reduce((t, a) => t + a.hoursMin, 0) / 60;
  const pilots = State.pilots.filter((p: any) => !p.coPilotFor && (p.you ? profileOfCompany(c.id).pilotId === p.id : p.companyId === c.id));
  const types: { [k: string]: number } = {}; fl.forEach(a => types[a.typeId] = (types[a.typeId] || 0) + 1);
  const best = Ratings.list().filter(r => r.fpm > 0).slice().sort((a, b) => a.fpm - b.fpm).slice(0, 5);
  const e = esc;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${e(c.name)}</title><style>
:root{--c:${c.color};--c2:${c.color2};--bg:#F5F7FA;--card:#fff;--ink:#0E1A2B;--mut:#5B6B80;--line:#E2E8F0}
@media (prefers-color-scheme:dark){:root{--bg:#07111E;--card:#0E1B2C;--ink:#E8EEF6;--mut:#93A3B8;--line:#1E2E44}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
header{background:linear-gradient(135deg,var(--c),var(--c2));color:#fff;padding:40px 16px 32px}
.w{max-width:960px;margin:0 auto;padding:0 16px}header .w{padding:0}h1{margin:0;font-size:34px;letter-spacing:-.02em}header p{margin:6px 0 0;opacity:.85}
.badge{display:inline-block;border:1.5px solid rgba(255,255,255,.7);border-radius:8px;padding:2px 10px;font-weight:700;letter-spacing:.08em;margin-bottom:12px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin:-22px auto 0;position:relative}
.st{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px}.st b{display:block;font-size:22px}.st small{color:var(--mut)}
h2{font-size:18px;margin:28px 0 10px}table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}
td,th{text-align:left;padding:9px 12px;border-bottom:1px solid var(--line);font-size:14px}th{color:var(--mut);font-weight:600}tr:last-child td{border-bottom:0}
footer{color:var(--mut);font-size:12px;text-align:center;padding:30px 16px}
</style></head><body>
<header><div class="w"><span class="badge">${e(c.icao)}</span><h1>${e(c.name)}</h1><p>Callsign ${e(c.callsign)} · Hub ${e(c.hub)}${apt(c.hub) ? ', ' + e(apt(c.hub).name) : ''} · Founded ${e(c.founded)}</p></div></header>
<div class="w">
<div class="stats"><div class="st"><b>${fl.length}</b><small>Aircraft</small></div><div class="st"><b>${rs.length}</b><small>Routes</small></div><div class="st"><b>${num(State.logbook.length)}</b><small>Flights logged</small></div><div class="st"><b>${num(pax)}</b><small>Passengers</small></div><div class="st"><b>${num(hrs)}</b><small>Fleet hours</small></div><div class="st"><b>${Math.round(c.reputation || 0)}/100</b><small>Popularity</small></div></div>
<h2>Fleet</h2><table><tr><th>Aircraft</th><th>Number</th><th>Registrations</th></tr>${Object.keys(types).map(k => `<tr><td>${e(acType(k).maker + ' ' + acType(k).model)}</td><td>${types[k]}</td><td>${fl.filter(a => a.typeId === k).map(a => e(a.reg)).join(', ')}</td></tr>`).join('')}</table>
<h2>Routes</h2><table><tr><th>Flight</th><th>Route</th><th>Days</th><th>Aircraft</th></tr>${rs.map(r => `<tr><td>${e(r.code)}</td><td>${r.legs.map(e).join(' – ')}</td><td>${e(r.days)}</td><td>${e(acType(r.typeId).model)}</td></tr>`).join('') || '<tr><td colspan="4">No routes yet</td></tr>'}</table>
<h2>Pilots</h2><table><tr><th>Name</th><th>Rank</th><th>Hours</th><th>Landings</th></tr>${pilots.map((p: any) => `<tr><td>${e(p.name)}</td><td>${e(p.rank || '')}</td><td>${num(p.hoursMin / 60)}</td><td>${num(p.landings)}</td></tr>`).join('')}</table>
${best.length ? `<h2>Smoothest landings</h2><table><tr><th>Pilot</th><th>Landing</th><th>Airport</th></tr>${best.map(b => `<tr><td>${e(b.name)}</td><td>${b.fpm} fpm</td><td>${e(b.to)}</td></tr>`).join('')}</table>` : ''}
<h2>Latest flights</h2><table><tr><th>Date</th><th>Route</th><th>Aircraft</th><th>Landing</th></tr>${log.map(l => `<tr><td>${e(l.date.slice(0, 10))}</td><td>${e(l.from)} – ${e(l.to)}</td><td>${e(l.reg)}</td><td>${Math.abs(l.landingFpm)} fpm</td></tr>`).join('') || '<tr><td colspan="4">No flights yet</td></tr>'}</table>
</div><footer>${e(c.name)} is a virtual airline flying in Microsoft Flight Simulator 2024 · ${e(APP.name)} · ${e(dateStr(new Date()).slice(0, 10))}</footer></body></html>`;
}

/* ---------- Aircraft installed in the simulator ---------- */
// The PC app looks through the simulator's package folders (Community and the bought add-ons) for
// aircraft packages and sends the list. Each one is matched to the app's aircraft types; Microsoft's
// own aircraft come with the simulator and are always there.
interface SimPackage { name: string; title: string; creator: string; titles?: string[] }
const AC_MATCH: { [id: string]: RegExp } = {
  'a320-fenix': /fenix.*a32|a32.*fenix/i, 'a350-ini': /inibuilds.*a350|a350.*inibuilds/i, 'a310-ini': /inibuilds.*a310|a310.*inibuilds/i,
  'b738-pmdg': /pmdg.*(738|737-800|b738)/i, 'b736-pmdg': /pmdg.*(736|737-600|b736)/i, 'b77w-pmdg': /pmdg.*(77w|777-300|777w)/i,
  'crj9-aero': /(aerosoft|crj).*(crj.?900|crj9)|crj.?900/i, 'crj7-aero': /(aerosoft|crj).*(crj.?700|crj7)|crj.?700/i, 'dhc6-aero': /(aerosoft.*twin.?otter|dhc.?6)/i, kodiak: /kodiak/i,
  'a321lr': /inibuilds.*a321|a321.*inibuilds/i, 'b737-max8': /ifly.*(max|38m|7m8)|(max|38m).*ifly/i,
};
const InstalledAircraft = {
  list: [] as SimPackage[], at: 0, error: '',
  received(list: SimPackage[], error?: string) {
    this.error = error || ''; if (error && !list.length) return;
    this.list = list; this.at = Date.now();
    const text = (p: SimPackage) => [p.name, p.title, p.creator].concat(p.titles || []).join(' ');
    for (const t of AIRCRAFT) {
      if (t.devKind === 'default') { t.installed = true; continue; }
      const re = AC_MATCH[t.id]; if (!re) continue;
      t.installed = list.some(p => re.test(text(p)));
    }
    (State as any).simInstalled = { at: this.at, ids: AIRCRAFT.filter(t => t.installed).map(t => t.id), other: list.filter(p => !AIRCRAFT.some(t => AC_MATCH[t.id] && AC_MATCH[t.id].test(text(p)))).map(p => p.title || p.name).slice(0, 200) };
    Store.soon();
    try { if (State.screen === 'market') refresh(); } catch (e) { /* ignore */ }
  },
  /** On start: what the PC app found last time. */
  restore() {
    const s: any = (State as any).simInstalled; if (!s || !s.ids) return;
    for (const t of AIRCRAFT) if (t.devKind !== 'default' && AC_MATCH[t.id]) t.installed = s.ids.indexOf(t.id) >= 0;
  },
};
