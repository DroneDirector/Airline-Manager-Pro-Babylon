// The airport map while you walk: a square, holographic blue map in the corner, always centred on you and turned
// the way you face. It is drawn from the terminal's plan: the walls (with their doorways open), the stairs, the
// lifts, the columns, the rooms' names, the kerb, the apron and the rental car centre. The floor you are on is drawn
// clearly; the other floor only faintly. Places show up as you get near them and stay shown (kept on the device).
// M (or a tap on the map) makes it bigger or smaller.
import { ROOMS, DOORS, STAIRS, LIFTS, OUTSIDE, COLUMNS, Fl } from '../sections/terminal/plan';
import { IS_TOUCH } from '../core/app';

export interface HoloState { x: number; z: number; f: Fl; yaw: number }

type Seg = [number, number, number, number];
const CELL = 4, GX0 = -120, GZ0 = -40, GW = 120, GH = 60;   // the reveal grid: 4 m cells over x -120..360, z -40..200
const REVEAL = 26;                                          // seen within this many metres
const KEY = 'ampb.holomap';

/** Splits a wall into pieces of at most 4 m (so each piece shows when its own part of the plan is revealed). */
function chop(s: Seg, out: Seg[]) { const L = Math.hypot(s[2] - s[0], s[3] - s[1]), n = Math.max(1, Math.ceil(L / 4));
  for (let i = 0; i < n; i++) out.push([s[0] + (s[2] - s[0]) * i / n, s[1] + (s[3] - s[1]) * i / n, s[0] + (s[2] - s[0]) * (i + 1) / n, s[1] + (s[3] - s[1]) * (i + 1) / n]); }

/** The walls of one floor: every room's sides, less the doorways in them; shared sides only once. */
function wallsOf(f: Fl): Seg[] {
  const seen = new Set<string>(), out: Seg[] = [];
  const doors = DOORS.filter(d => d.f === f);
  for (const r of ROOMS.filter(q => q.f === f)) {
    const sides: Seg[] = [[r.x0, r.z0, r.x1, r.z0], [r.x0, r.z1, r.x1, r.z1], [r.x0, r.z0, r.x0, r.z1], [r.x1, r.z0, r.x1, r.z1]];
    for (const s of sides) {
      const key = s.map(v => Math.round(v * 10)).join(','); if (seen.has(key)) continue; seen.add(key);
      const alongX = s[1] === s[3];
      // the doorways on this side: [from, to] along it
      const gaps: [number, number][] = [];
      for (const d of doors) { if (alongX ? d.along !== 'x' : d.along !== 'z') continue;
        if (alongX ? Math.abs(d.z - s[1]) > 0.8 : Math.abs(d.x - s[0]) > 0.8) continue;
        const c = alongX ? d.x : d.z; gaps.push([c - d.w / 2, c + d.w / 2]); }
      gaps.sort((a, b) => a[0] - b[0]);
      let a = alongX ? s[0] : s[1]; const b = alongX ? s[2] : s[3];
      for (const g of gaps) { if (g[0] > a) chop(alongX ? [a, s[1], Math.min(g[0], b), s[1]] : [s[0], a, s[0], Math.min(g[0], b)], out); a = Math.max(a, g[1]); }
      if (a < b) chop(alongX ? [a, s[1], b, s[1]] : [s[0], a, s[0], b], out);
    }
  }
  return out;
}
const rectSegs = (r: { x0: number; z0: number; x1: number; z1: number }) => { const out: Seg[] = []; for (const s of [[r.x0, r.z0, r.x1, r.z0], [r.x1, r.z0, r.x1, r.z1], [r.x1, r.z1, r.x0, r.z1], [r.x0, r.z1, r.x0, r.z0]] as Seg[]) chop(s, out); return out; };
/** A room's name for the map: short, without the notes in brackets. */
const short = (n: string) => n.replace(/\s*\(.*$/, '').replace(/^Rental car centre · /, 'Rental · ').toUpperCase();

export function holoMap(host: HTMLElement, get: () => HoloState | null) {
  if (!document.getElementById('holomap-css')) { const st = document.createElement('style'); st.id = 'holomap-css'; st.textContent = `
.holomap { position: absolute; right: max(14px, env(safe-area-inset-right)); top: max(14px, env(safe-area-inset-top)); width: ${IS_TOUCH ? 150 : 214}px; height: ${IS_TOUCH ? 150 : 214}px;
  pointer-events: auto; cursor: pointer; transition: width .25s, height .25s; filter: drop-shadow(0 0 10px rgba(40,150,255,.28)); }
.holomap.big { width: min(${IS_TOUCH ? 300 : 420}px, 70vmin); height: min(${IS_TOUCH ? 300 : 420}px, 70vmin); }
.holomap canvas { width: 100%; height: 100%; display: block; }
.holomap::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: repeating-linear-gradient(0deg, rgba(120,210,255,.05) 0 1px, transparent 1px 3px); mix-blend-mode: screen; }
.holomap .hm-head { position: absolute; left: 0; right: 0; top: -17px; font: 600 9.5px Inter, sans-serif; letter-spacing: .18em; color: rgba(150,220,255,.9); text-shadow: 0 0 6px rgba(60,170,255,.8); display: flex; justify-content: space-between; text-transform: uppercase; }
`; document.head.appendChild(st); }
  const box = document.createElement('div'); box.className = 'holomap'; box.innerHTML = '<div class="hm-head"><span>Terminal</span><span class="hm-fl"></span></div><canvas></canvas>';
  host.appendChild(box);
  const cv = box.querySelector('canvas') as HTMLCanvasElement, cx = cv.getContext('2d')!, flEl = box.querySelector('.hm-fl') as HTMLElement;
  let big = false; const toggle = () => { big = !big; box.classList.toggle('big', big); };
  box.addEventListener('click', toggle);
  const onKey = (e: KeyboardEvent) => { if ((e.key === 'm' || e.key === 'M') && !(e.target as HTMLElement)?.closest?.('input,textarea')) toggle(); };
  window.addEventListener('keydown', onKey);

  // the plan, once: walls per floor, the outside areas (ground level), stairs, lifts, columns, names
  const WALLS: { [f: number]: Seg[] } = { 1: wallsOf(1), 2: wallsOf(2) };
  const OUT: Seg[] = []; for (const o of OUTSIDE) if (!/DOOR/.test(o.id)) rectSegs(o).forEach(s => OUT.push(s));
  const NAMES = [...ROOMS.map(r => ({ f: r.f, x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2, w: r.x1 - r.x0, h: r.z1 - r.z0, t: short(r.name), r })),
    ...OUTSIDE.filter(o => o.name && !/DOOR/.test(o.id)).map(o => ({ f: 1 as Fl, x: (o.x0 + o.x1) / 2, z: (o.z0 + o.z1) / 2, w: o.x1 - o.x0, h: o.z1 - o.z0, t: short(o.name!), r: o })),
    ...OUTSIDE.filter(o => o.id === 'KERB' || o.id === 'APRON').map(o => ({ f: 1 as Fl, x: (o.x0 + o.x1) / 2, z: o.id === 'APRON' ? o.z0 + 8 : (o.z0 + o.z1) / 2, w: o.x1 - o.x0, h: 10, t: o.id === 'KERB' ? 'KERB · DEPARTURES' : 'APRON', r: o }))];

  // what has been seen, per floor (kept on the device)
  const seen: { [f: number]: Uint8Array } = { 1: new Uint8Array(GW * GH), 2: new Uint8Array(GW * GH) };
  try { const k = JSON.parse(localStorage.getItem(KEY) || 'null'); if (k) for (const f of [1, 2]) if (k[f]) { const b = atob(k[f]); for (let i = 0; i < Math.min(b.length, GW * GH); i++) seen[f][i] = b.charCodeAt(i); } } catch (e) { /* a fresh map */ }
  let dirty = false, saveT = 0;
  const cellOf = (x: number, z: number) => { const i = Math.floor((x - GX0) / CELL), j = Math.floor((z - GZ0) / CELL); return i < 0 || j < 0 || i >= GW || j >= GH ? -1 : j * GW + i; };
  const isSeen = (f: Fl, x: number, z: number) => { const c = cellOf(x, z); return c >= 0 && seen[f][c] === 1; };
  const reveal = (f: Fl, x: number, z: number) => { const n = Math.ceil(REVEAL / CELL); for (let dj = -n; dj <= n; dj++) for (let di = -n; di <= n; di++) {
    if (di * di + dj * dj > n * n) continue; const c = cellOf(x + di * CELL, z + dj * CELL); if (c >= 0 && !seen[f][c]) { seen[f][c] = 1; dirty = true; } } };

  let last: HoloState | null = null, t0 = performance.now();
  const draw = () => {
    if (!box.isConnected) { dispose(); return; }
    const st = get(); if (!st) { box.style.display = 'none'; return; } box.style.display = '';
    reveal(st.f, st.x, st.z); last = st;
    const now = performance.now(); if (dirty && now > saveT) { saveT = now + 4000; dirty = false; try { const enc = (a: Uint8Array) => btoa(String.fromCharCode.apply(null, Array.from(a))); localStorage.setItem(KEY, JSON.stringify({ 1: enc(seen[1]), 2: enc(seen[2]) })); } catch (e) { /* kept for now */ } }
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = Math.round(box.clientWidth * dpr), H = Math.round(box.clientHeight * dpr);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const R = W / 2, view = big ? 150 : 90, k = W / view;                     // metres across the square
    const sy = Math.sin(st.yaw), cy = Math.cos(st.yaw);
    const P = (x: number, z: number): [number, number] => { const dx = x - st.x, dz = z - st.z; return [R + (dx * cy - dz * sy) * k, R - (dx * sy + dz * cy) * k]; };
    const inView = (x: number, z: number) => Math.abs(x - st.x) < view * 0.75 && Math.abs(z - st.z) < view * 0.75;
    cx.clearRect(0, 0, W, H);
    // the panel: deep blue glass, a faint grid (turning with the map), a soft edge glow
    const bg = cx.createRadialGradient(R, R, R * 0.1, R, R, R * 1.45); bg.addColorStop(0, 'rgba(10,40,70,.78)'); bg.addColorStop(1, 'rgba(3,12,26,.86)');
    cx.fillStyle = bg; cx.fillRect(0, 0, W, H);
    cx.save(); cx.beginPath(); cx.rect(0, 0, W, H); cx.clip();
    cx.lineWidth = 1 * dpr; cx.strokeStyle = 'rgba(90,180,255,.07)'; cx.beginPath();
    const g0x = Math.floor((st.x - view) / 10) * 10, g0z = Math.floor((st.z - view) / 10) * 10;
    for (let gx = g0x; gx <= st.x + view; gx += 10) { const a = P(gx, st.z - view), b = P(gx, st.z + view); cx.moveTo(a[0], a[1]); cx.lineTo(b[0], b[1]); }
    for (let gz = g0z; gz <= st.z + view; gz += 10) { const a = P(st.x - view, gz), b = P(st.x + view, gz); cx.moveTo(a[0], a[1]); cx.lineTo(b[0], b[1]); }
    cx.stroke();
    const segs = (list: Seg[], f: Fl, col: string, w: number, dash: number[] = []) => { cx.strokeStyle = col; cx.lineWidth = w * dpr; cx.setLineDash(dash.map(v => v * dpr)); cx.beginPath();
      for (const s of list) { const mx = (s[0] + s[2]) / 2, mz = (s[1] + s[3]) / 2; if (!inView(mx, mz) || !isSeen(f, mx, mz)) continue; const a = P(s[0], s[1]), b = P(s[2], s[3]); cx.moveTo(a[0], a[1]); cx.lineTo(b[0], b[1]); }
      cx.stroke(); cx.setLineDash([]); };
    const other: Fl = st.f === 1 ? 2 : 1;
    // the other floor first, barely there
    segs(WALLS[other], other, 'rgba(110,190,255,.14)', 1);
    // the room you are in, lit
    const here = ROOMS.find(r => r.f === st.f && st.x > r.x0 && st.x < r.x1 && st.z > r.z0 && st.z < r.z1) || OUTSIDE.find(o => st.f === 1 && st.x > o.x0 && st.x < o.x1 && st.z > o.z0 && st.z < o.z1);
    if (here) { const c = [P(here.x0, here.z0), P(here.x1, here.z0), P(here.x1, here.z1), P(here.x0, here.z1)]; cx.fillStyle = 'rgba(60,170,255,.10)'; cx.beginPath(); cx.moveTo(c[0][0], c[0][1]); for (const p of c.slice(1)) cx.lineTo(p[0], p[1]); cx.closePath(); cx.fill(); }
    // this floor: the outside (ground floor), the walls glowing, the stairs, the lifts, the columns
    if (st.f === 1) segs(OUT, 1, 'rgba(120,200,255,.38)', 1, [4, 3]);
    cx.shadowColor = 'rgba(50,160,255,.9)'; cx.shadowBlur = 6 * dpr;
    segs(WALLS[st.f], st.f, 'rgba(140,215,255,.95)', 1.6);
    cx.shadowBlur = 0;
    for (const s of STAIRS) { const mx = (s.x0 + s.x1) / 2, mz = (s.z0 + s.z1) / 2; if (!inView(mx, mz) || !(isSeen(1, mx, mz) || isSeen(2, mx, mz))) continue;
      const a = .85; cx.strokeStyle = `rgba(160,235,255,${a})`; cx.lineWidth = 1 * dpr; cx.beginPath();
      const c = [P(s.x0, s.z0), P(s.x1, s.z0), P(s.x1, s.z1), P(s.x0, s.z1)]; cx.moveTo(c[0][0], c[0][1]); for (const p of c.slice(1)) cx.lineTo(p[0], p[1]); cx.closePath();
      const alongX = s.dir[0] === 'x', n = Math.round((alongX ? s.x1 - s.x0 : s.z1 - s.z0) / 0.6);
      for (let i = 1; i < n; i++) { const t = i / n; const p = alongX ? [P(s.x0 + (s.x1 - s.x0) * t, s.z0), P(s.x0 + (s.x1 - s.x0) * t, s.z1)] : [P(s.x0, s.z0 + (s.z1 - s.z0) * t), P(s.x1, s.z0 + (s.z1 - s.z0) * t)]; cx.moveTo(p[0][0], p[0][1]); cx.lineTo(p[1][0], p[1][1]); }
      cx.stroke(); }
    for (const l of LIFTS) { if (!inView(l.x, l.z) || !(isSeen(1, l.x, l.z) || isSeen(2, l.x, l.z))) continue; const p = P(l.x, l.z), s = 1.4 * k;
      cx.strokeStyle = 'rgba(160,235,255,.9)'; cx.lineWidth = 1 * dpr; cx.strokeRect(p[0] - s, p[1] - s, s * 2, s * 2);
      cx.fillStyle = 'rgba(160,235,255,.9)'; cx.beginPath(); cx.moveTo(p[0], p[1] - s * .7); cx.lineTo(p[0] - s * .45, p[1] - s * .1); cx.lineTo(p[0] + s * .45, p[1] - s * .1); cx.closePath(); cx.moveTo(p[0], p[1] + s * .7); cx.lineTo(p[0] - s * .45, p[1] + s * .1); cx.lineTo(p[0] + s * .45, p[1] + s * .1); cx.closePath(); cx.fill(); }
    cx.fillStyle = 'rgba(140,215,255,.5)';
    for (const [, x, z] of COLUMNS) { if (!inView(x, z) || !isSeen(st.f, x, z)) continue; const p = P(x, z); cx.fillRect(p[0] - 1.5 * dpr, p[1] - 1.5 * dpr, 3 * dpr, 3 * dpr); }
    // the names, upright, where they fit
    cx.textAlign = 'center'; cx.textBaseline = 'middle';
    for (const n of NAMES) { if (!inView(n.x, n.z) || !isSeen(n.f, n.x, n.z)) continue; const mine = n.f === st.f; if (!mine) continue;
      const fit = Math.min(n.w, n.h) * k; if (fit < 22 * dpr) continue;
      const size = Math.max(7, Math.min(10, fit / dpr / 9)) * dpr; cx.font = `600 ${size}px Inter, sans-serif`;
      const p = P(n.x, n.z); cx.fillStyle = n.r === here ? 'rgba(220,245,255,.95)' : 'rgba(150,215,255,.7)'; cx.shadowColor = 'rgba(40,150,255,.8)'; cx.shadowBlur = 4 * dpr;
      const words = n.t.split(' '), lines: string[] = []; let line = ''; for (const w of words) { if (line && cx.measureText(line + ' ' + w).width > Math.max(n.w, n.h) * k * 0.8) { lines.push(line); line = w; } else line = line ? line + ' ' + w : w; } lines.push(line);
      if (Math.hypot(p[0] - R, p[1] - R) < 16 * dpr) p[1] = R + 20 * dpr;                      // not under you
      const tw = Math.max(...lines.slice(0, 3).map(l => cx.measureText(l).width)) / 2; if (p[0] - tw < 6 * dpr || p[0] + tw > W - 6 * dpr || p[1] < 10 * dpr || p[1] > H - 10 * dpr) { cx.shadowBlur = 0; continue; }
      lines.slice(0, 3).forEach((ln, i) => cx.fillText(ln, p[0], p[1] + (i - (Math.min(3, lines.length) - 1) / 2) * size * 1.15)); cx.shadowBlur = 0; }
    // you: a bright chevron with a soft view cone, always in the middle, always pointing up
    const cone = cx.createRadialGradient(R, R, 0, R, R, 34 * dpr); cone.addColorStop(0, 'rgba(120,210,255,.32)'); cone.addColorStop(1, 'rgba(120,210,255,0)');
    cx.fillStyle = cone; cx.beginPath(); cx.moveTo(R, R); cx.arc(R, R, 34 * dpr, -Math.PI / 2 - 0.55, -Math.PI / 2 + 0.55); cx.closePath(); cx.fill();
    const pulse = 0.75 + 0.25 * Math.sin((now - t0) / 260);
    cx.shadowColor = 'rgba(120,220,255,1)'; cx.shadowBlur = 10 * dpr * pulse; cx.fillStyle = '#EAF8FF';
    cx.beginPath(); cx.moveTo(R, R - 7 * dpr); cx.lineTo(R + 5 * dpr, R + 5 * dpr); cx.lineTo(R, R + 2.5 * dpr); cx.lineTo(R - 5 * dpr, R + 5 * dpr); cx.closePath(); cx.fill(); cx.shadowBlur = 0;
    cx.restore();
    // the frame: thin edge, corner brackets
    cx.strokeStyle = 'rgba(110,200,255,.45)'; cx.lineWidth = 1 * dpr; cx.strokeRect(.5 * dpr, .5 * dpr, W - dpr, H - dpr);
    cx.strokeStyle = 'rgba(170,230,255,.95)'; cx.lineWidth = 2 * dpr; const L = 14 * dpr;
    for (const [x, y, dx, dy] of [[0, 0, 1, 1], [W, 0, -1, 1], [0, H, 1, -1], [W, H, -1, -1]]) { cx.beginPath(); cx.moveTo(x + dx * dpr, y + dy * L); cx.lineTo(x + dx * dpr, y + dy * dpr); cx.lineTo(x + dx * L, y + dy * dpr); cx.stroke(); }
    flEl.textContent = `Floor ${st.f}`;
  };
  const iv = setInterval(draw, 50);
  function dispose() { clearInterval(iv); window.removeEventListener('keydown', onKey); box.remove(); }
  void last;
  return { dispose, el: box };
}
