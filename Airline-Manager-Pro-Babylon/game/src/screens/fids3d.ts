/* Flight boards in the 3D places: a Departures screen and an Arrivals screen side by side (in the lounge, and hanging
 * in the concourse just before it). They show your own flights and the other airlines' real traffic at that airport:
 * scheduled time, expected time (a new time when it changes), flight, destination or origin, aircraft and status
 * (On time, Boarding, Delayed, Departed, Landed, Cancelled), as real boards do. Changed text turns over like the
 * yellow split-flap text on the flight cards, character by character; a glass over the screen catches the light like
 * the monitors and the phone. */

interface FidsRow { key: string; sched: number; exp: number; flight: string; place: string; ac: string; status: string; col: string }

/** The day's rows for a board (departures from, or arrivals at, the airport). */
function fidsRows(kind: 'dep' | 'arr', base: string, now: number): FidsRow[] {
  const out: FidsRow[] = [], mid = new Date(now); mid.setHours(0, 0, 0, 0); const day0 = mid.getTime();
  // your own flights (the schedule's day, minutes since midnight)
  let blocks: any[] = []; try { blocks = scheduleBlocks().filter((b: any) => b.kind === 'flight'); } catch (e) { blocks = []; }
  const c = company(), code = (c && (c.icao || '').toUpperCase()) || 'YOU';
  for (const b of blocks) {
    if (kind === 'dep' ? b.from !== base : b.to !== base) continue;
    const late = b.delayMin || 0, depE = day0 + b.start * 60e3, arrE = day0 + b.end * 60e3;
    const sched = kind === 'dep' ? depE - late * 60e3 : arrE - late * 60e3, exp = kind === 'dep' ? depE : arrE;
    const place = kind === 'dep' ? b.to : b.from, A: any = apt(place), live = State.live.filter(f => f.reg === b.reg)[0];
    out.push({ key: 'c' + b.reg + b.start, sched, exp, flight: live ? live.callsign : b.code || (code + ' ' + b.reg.slice(-3)), place: `${place} ${A ? (A.city || A.name || '').slice(0, 13) : ''}`, ac: b.reg, status: b.cancelled ? 'Cancelled' : '', col: '' });
  }
  // other airlines' traffic
  try {
    if (Traffic.on()) { const D = Math.floor(now / 864e5);
      for (const AL of Traffic.airlines()) for (const cr of AL.fleet) for (const d of [D - 1, D, D + 1]) for (const l of Traffic.day(cr, d, AL.quality)) {
        if (kind === 'dep' ? l.from !== base : l.to !== base) continue;
        const dur = l.arr - l.dep, sched = kind === 'dep' ? l.sched : l.sched + dur, exp = kind === 'dep' ? l.dep : l.arr;
        const place = kind === 'dep' ? l.to : l.from, A: any = apt(place);
        out.push({ key: 't' + cr.id + d + l.num, sched, exp, flight: (cr.dcode || cr.code) + l.num, place: `${place} ${A ? (A.city || A.name || '').slice(0, 13) : ''}`, ac: tfcLabel(cr).slice(0, 10), status: '', col: '' });
      } }
  } catch (e) { /* no traffic */ }
  // the status, as real boards show it
  for (const r of out) {
    const late = Math.round((r.exp - r.sched) / 60e3);
    if (r.status === 'Cancelled') r.col = '#FF6B5A';
    else if (kind === 'dep') {
      if (now >= r.exp) { r.status = 'Departed'; r.col = '#8FA3B8'; }
      else if (r.exp - now < 40 * 60e3) { r.status = late >= 5 ? 'Delayed, boarding' : 'Boarding'; r.col = '#3FD0A0'; }
      else if (late >= 5) { r.status = 'Delayed'; r.col = '#F2B544'; }
      else { r.status = 'On time'; r.col = '#7FC4F5'; }
    } else {
      if (now >= r.exp) { r.status = 'Landed'; r.col = '#3FD0A0'; }
      else if (late >= 5) { r.status = 'Delayed'; r.col = '#F2B544'; }
      else if (r.exp - now < 30 * 60e3) { r.status = 'Expected'; r.col = '#7FC4F5'; }
      else { r.status = 'On time'; r.col = '#7FC4F5'; }
    }
  }
  return out.filter(r => r.exp > now - 25 * 60e3 && r.sched < now + 18 * 3600e3).sort((a, b) => a.sched - b.sched).slice(0, 10);
}
function fidsHm(t: number): string { const d = new Date(t); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }

/** One board: a frame, the screen (its own canvas) and the glass over it. Returns what fidsStep needs. */
function fidsBoard(kind: 'dep' | 'arr', base: string, w: number): any {
  const T = THREE, h = w * 9 / 16, g = new T.Group(); g.name = kind === 'dep' ? 'departures-screen' : 'arrivals-screen';
  const [cv] = ctCanvas(1600, 900), tex = ctTex(cv);
  const frame = new T.Mesh(new T.BoxGeometry(w + 0.07, h + 0.07, 0.05), new T.MeshStandardMaterial({ color: 0x15171B, roughness: 0.35, metalness: 0.4 })); frame.position.z = -0.026; g.add(frame);
  const scr = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: tex, toneMapped: false })); scr.userData.keep = true; g.add(scr);
  try { const gl = new T.Mesh(new T.PlaneGeometry(w + 0.01, h + 0.01), roomGlassMat(T, 0.14)); gl.position.z = 0.004; gl.renderOrder = 2; gl.userData.keep = true; g.add(gl); } catch (e) { /* no glass */ }
  try { Models.swap(g, 'lounge-props/' + g.name + '.glb', false); } catch (e) { /* the app's own */ }
  const B: any = { kind, base, g, cv, tex, cells: {}, rows: [], at: 0, anim: 0, drawn: 0 };
  fidsData(B, Date.now()); fidsDraw(B, performance.now());
  return B;
}
const FIDS_COLS: { [k: string]: [string, number][] } = {
  dep: [['Sched', 40], ['Expected', 210], ['Flight', 420], ['To', 640], ['Aircraft', 1050], ['Status', 1300]],
  arr: [['Sched', 40], ['Expected', 210], ['Flight', 420], ['From', 640], ['Aircraft', 1050], ['Status', 1300]],
};
/** New data: every cell that changed starts turning over. */
function fidsData(B: any, now: number) {
  const rows = fidsRows(B.kind, B.base, now), t = performance.now(), seen: any = {};
  rows.forEach((r, i) => {
    const vals = [fidsHm(r.sched), r.exp - r.sched >= 60e3 * 5 || r.status === 'Departed' || r.status === 'Landed' ? fidsHm(r.exp) : '', r.flight, r.place, r.ac, r.status];
    vals.forEach((v, j) => { const k = i + ':' + j, C = B.cells[k]; seen[k] = 1;
      if (!C) B.cells[k] = { text: v, prev: '', at: t + i * 60, col: j === 5 ? r.col : '' };
      else if (C.text !== v) { C.prev = C.text; C.text = v; C.at = t + i * 60; C.col = j === 5 ? r.col : ''; }
      else if (j === 5) C.col = r.col; });
  });
  for (const k in B.cells) if (!seen[k]) { const C = B.cells[k]; if (C.text) { C.prev = C.text; C.text = ''; C.at = t; } }
  B.rows = rows; B.anim = t + 2500; B.at = now;
}
/** The screen: the heading, the columns, and the rows, each changed character flipping in yellow. */
function fidsDraw(B: any, t: number) {
  const x = B.cv.getContext('2d') as CanvasRenderingContext2D, W = B.cv.width, H = B.cv.height;
  x.fillStyle = '#070C16'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#F2C230'; x.font = '700 58px Inter, Arial, sans-serif'; x.textBaseline = 'alphabetic';
  x.fillText(`${B.kind === 'dep' ? 'Departures' : 'Arrivals'} · ${B.base}`, 40, 84);
  x.fillStyle = '#9FB6CC'; x.font = '600 40px Inter, Arial, sans-serif'; x.fillText(fidsHm(Date.now()), W - 150, 84);
  x.font = '600 26px Inter, Arial, sans-serif'; x.fillStyle = '#6F86A0';
  for (const [nm, cx] of FIDS_COLS[B.kind]) x.fillText(nm.toUpperCase(), cx, 140);
  x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(30, 154, W - 60, 2);
  const rowH = 72, cw = 25.5; x.font = '700 42px "DejaVu Sans Mono", "Roboto Mono", ui-monospace, monospace';
  let busy = false;
  const nRows = Math.max(B.rows.length, ...Object.keys(B.cells).map(k => parseInt(k, 10) + 1));
  for (let i = 0; i < nRows; i++) {
    const y = 214 + i * rowH; if (y > H - 20) break;
    if (i % 2) { x.fillStyle = 'rgba(255,255,255,.035)'; x.fillRect(30, y - 50, W - 60, rowH); }
    FIDS_COLS[B.kind].forEach(([, cx], j) => {
      const C = B.cells[i + ':' + j]; if (!C) return;
      const txt = C.text, prev = C.prev || '', base = j === 5 ? C.col || '#7FC4F5' : j === 1 ? '#F2B544' : '#EAF2FA';
      for (let n = 0; n < Math.max(txt.length, prev.length); n++) {
        const ch = txt[n] || ' ', was = prev[n] || ' ', d0 = C.at + n * 28, k = (t - d0) / 500;
        let sy = 1, col = base, ch2 = ch;
        if (ch !== was && k < 1) {
          busy = true;
          if (k < 0) { ch2 = was; } else { const e = 1 - Math.pow(1 - k, 3), ang = (-92 + 92 * e + 14 * Math.sin(Math.PI * e) * (1 - e)) * Math.PI / 180; sy = Math.max(0.05, Math.cos(ang)); const yk = Math.max(0, 1 - k * 1.6); col = yk > 0.05 ? '#FFC861' : base; }
        }
        if (ch2 === ' ') continue;
        x.save(); x.translate(cx + n * cw, y - 14); x.scale(1, sy); x.fillStyle = col;
        if (col === '#FFC861') { x.shadowColor = 'rgba(255,200,97,.9)'; x.shadowBlur = 14; }
        x.fillText(ch2, 0, 14); x.restore();
      }
    });
  }
  if (!nRows) { x.fillStyle = '#9FB6CC'; x.font = '600 38px Inter, Arial, sans-serif'; x.fillText(B.kind === 'dep' ? 'No more departures today' : 'No more arrivals today', 40, 230); }
  B.tex.needsUpdate = true; B.drawn = t;
  return busy;
}
/** Each frame: new data every 20 seconds, and the turning text drawn while it turns (else once a minute for the clock). */
function fidsStep(list: any[]) {
  if (!list || !list.length) return;
  const t = performance.now(), now = Date.now();
  for (const B of list) {
    if (now - B.at > 20000) fidsData(B, now);
    if (t < B.anim) { if (t - B.drawn > 45) fidsDraw(B, t); }
    else if (t - B.drawn > 30000) fidsDraw(B, t);
  }
}
/** A pair of boards (Departures, Arrivals), 30 cm apart, centred at (x, y, z) facing the way ry turns +z. */
function fidsPair(par: any, base: string, x: number, y: number, z: number, ry: number, w: number): any[] {
  const T = THREE, out: any[] = [], grp = new T.Group(); grp.position.set(x, y, z); grp.rotation.y = ry; par.add(grp);
  (['dep', 'arr'] as ('dep' | 'arr')[]).forEach((k, i) => { const B = fidsBoard(k, base, w); B.g.position.x = (i ? 1 : -1) * (w / 2 + 0.15 + 0.035); grp.add(B.g); out.push(B); });
  return out;
}
