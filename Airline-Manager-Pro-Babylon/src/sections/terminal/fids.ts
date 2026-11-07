// The timetable screens (departures and arrivals): the real rows from the game (your own flights and the other airlines'
// traffic at this airport, as the game's own boards show them), asked for every 4 seconds while the game runs, so a change
// shows within a few seconds. Sample flights only while there is no information at all (the game isn't running, or this
// airport has no flights yet); DEMO_DATA goes off at alpha, and then a screen with nothing to show says so.
// Each shape of screen has its own picture, drawn like a real monitor (bezel, lit panel, header with the icon, status
// pills, the glass's sheen): the hall's walls with every column, the totems and the small screens with the four that
// matter in large type, and the operations room's video wall with six monitors side by side, departures and arrivals
// in turn, each showing the next page of its kind (pages repeat in order while there are too few flights to fill the
// wall, and new flights take the repeats' places as traffic grows).
// A picture is drawn again only when what it shows has changed (and each minute, for the clock).
import { Scene, DynamicTexture, StandardMaterial, Color3, Texture } from '@babylonjs/core';
import { gameSend, gameExists, onGameFids } from '../../ui/game-frame';
import { IS_PC } from '../../core/app';

/** Sample flights while there's no information. Set to false at alpha: no dummy data from then on. */
export const DEMO_DATA = true;

type Row = { sched: number; exp: number; flight: string; place: string; ac: string; status: string; col: string };
type Kind = 'dep' | 'arr';
export type Shape = 'wall' | 'totem' | 'wide' | 'opswall';
const SIZE: { [k in Shape]: [number, number] } = { wall: [2048, 745], totem: [1024, 760], wide: [1024, 576], opswall: IS_PC ? [4096, 722] : [3072, 542] };
/** The operations wall: how many monitors across, and the rows each shows. */
export const OPS_W = SIZE.opswall, OPS_PANELS = 6; const OPS_ROWS = 11;
const hm = (t: number) => { const d = new Date(t); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
const hms = (t: number) => hm(t) + ':' + String(new Date(t).getSeconds()).padStart(2, '0');
const ACC: { [k in Kind]: [string, string] } = { dep: ['#FFD24A', '#E8A417'], arr: ['#5FD6FF', '#1E9BD8'] };

/** Sample flights round now, for when there's no information. */
function sample(kind: Kind, now: number, n = 10): Row[] {
  const P = ['Reykjavík', 'Copenhagen', 'Oslo', 'London', 'Vágar', 'Amsterdam', 'Frankfurt', 'Stockholm', 'Bergen', 'Edinburgh', 'Paris', 'Helsinki'];
  const C = ['KEF', 'CPH', 'OSL', 'LHR', 'FAE', 'AMS', 'FRA', 'ARN', 'BGO', 'EDI', 'CDG', 'HEL'], out: Row[] = [], base = Math.floor(now / 9e5) * 9e5;
  for (let i = -2; i < 12; i++) { const k = (Math.floor(base / 9e5) + i + (kind === 'arr' ? 5 : 0)) % P.length, sched = base + i * 1.8e6, late = (k * 7) % 5 === 0 ? 20 * 6e4 : 0, exp = sched + late;
    let status = 'On time', col = '#7FC4F5';
    if (kind === 'dep') { if (now >= exp) { status = 'Departed'; col = '#8FA3B8'; } else if (exp - now < 40 * 6e4) { status = late ? 'Delayed, boarding' : 'Boarding'; col = '#3FD0A0'; } else if (late) { status = 'Delayed'; col = '#F2B544'; } }
    else { if (now >= exp) { status = 'Landed'; col = '#3FD0A0'; } else if (late) { status = 'Delayed'; col = '#F2B544'; } else if (exp - now < 30 * 6e4) { status = 'Expected'; col = '#7FC4F5'; } }
    out.push({ sched, exp, flight: 'VT ' + (200 + k * 37 + (kind === 'arr' ? 1 : 0)), place: `${C[k]} ${P[k]}`, ac: ['A320', 'B737', 'A321', 'E195'][k % 4], status, col }); }
  return out.filter(r => r.exp > now - 25 * 6e4).slice(0, n);
}

/** Text cut to fit a width, with … at the end. */
function fit(x: CanvasRenderingContext2D, t: string, w: number) { if (x.measureText(t).width <= w) return t; while (t.length > 1 && x.measureText(t + '…').width > w) t = t.slice(0, -1); return t + '…'; }
function rr(x: CanvasRenderingContext2D, X: number, Y: number, w: number, h: number, r: number) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); }

/** A small airliner, nose right, climbing (departures) or descending (arrivals). */
function plane(x: CanvasRenderingContext2D, cx: number, cy: number, s: number, kind: Kind, col: string) {
  x.save(); x.translate(cx, cy); x.rotate(kind === 'dep' ? -0.42 : 0.42); x.scale(s / 100, s / 100); x.fillStyle = col; x.beginPath();
  x.moveTo(50, 0); x.quadraticCurveTo(50, -6, 40, -6); x.lineTo(8, -6); x.lineTo(-14, -44); x.lineTo(-26, -44); x.lineTo(-12, -6); x.lineTo(-34, -6); x.lineTo(-44, -20); x.lineTo(-52, -20);
  x.lineTo(-46, 0); x.lineTo(-52, 20); x.lineTo(-44, 20); x.lineTo(-34, 6); x.lineTo(-12, 6); x.lineTo(-26, 44); x.lineTo(-14, 44); x.lineTo(8, 6); x.lineTo(40, 6); x.quadraticCurveTo(50, 6, 50, 0); x.fill(); x.restore();
}

/** One monitor in the rectangle (X, Y, W, H): the bezel, the lit panel and the timetable on it. */
function monitor(x: CanvasRenderingContext2D, X: number, Y: number, W: number, H: number, kind: Kind, full: boolean, rows: Row[], maxRows: number, airport: string, now: number, live: boolean, at: number, note: string) {
  // the bezel: dark satin metal with a lit top edge, the panel set into it
  const bz = Math.max(6, Math.round(Math.min(W, H) * 0.022));
  let g = x.createLinearGradient(0, Y, 0, Y + H); g.addColorStop(0, '#2A2F36'); g.addColorStop(0.5, '#14171C'); g.addColorStop(1, '#0A0C0F'); x.fillStyle = g; rr(x, X, Y, W, H, bz * 1.2); x.fill();
  x.strokeStyle = 'rgba(255,255,255,0.18)'; x.lineWidth = Math.max(1, bz * 0.18); x.beginPath(); x.moveTo(X + bz, Y + x.lineWidth); x.lineTo(X + W - bz, Y + x.lineWidth); x.stroke();
  const sx = X + bz, sy = Y + bz, sw = W - bz * 2, sh = H - bz * 2;
  x.save(); rr(x, sx, sy, sw, sh, bz * 0.4); x.clip();
  g = x.createLinearGradient(0, sy, 0, sy + sh); g.addColorStop(0, '#0E1E3A'); g.addColorStop(0.55, '#09152B'); g.addColorStop(1, '#060D1B'); x.fillStyle = g; x.fillRect(sx, sy, sw, sh);
  // the panel's fine pixel grid
  x.fillStyle = 'rgba(255,255,255,0.018)'; const step = Math.max(3, Math.round(sh / 180)); for (let yy = sy; yy < sy + sh; yy += step) x.fillRect(sx, yy, sw, 1);
  // the header: the kind's colour, the icon, the name, the airport and the clock
  const head = Math.round(sh * (full ? 0.15 : 0.145)), pad = Math.round(sw * 0.03), [a1, a2] = ACC[kind];
  g = x.createLinearGradient(0, sy, 0, sy + head); g.addColorStop(0, a1); g.addColorStop(1, a2); x.fillStyle = g; x.fillRect(sx, sy, sw, head);
  x.fillStyle = 'rgba(255,255,255,0.22)'; x.fillRect(sx, sy, sw, Math.max(1, head * 0.06));
  x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(sx, sy + head - Math.max(1, head * 0.05), sw, Math.max(1, head * 0.05));
  const ic = head * 0.62; plane(x, sx + pad + ic * 0.5, sy + head / 2, ic, kind, '#0A1424');
  x.fillStyle = '#0A1424'; x.textBaseline = 'middle'; x.textAlign = 'left'; x.font = `800 ${Math.round(head * 0.52)}px Arial, sans-serif`;
  const title = (kind === 'dep' ? 'Departures' : 'Arrivals') + (full ? '  ·  ' + (kind === 'dep' ? 'Brottfarir' : 'Komur') : '');
  const clock = hm(now), right = (full && airport ? airport + '   ' : '') + clock; x.font = `700 ${Math.round(head * 0.46)}px Arial, sans-serif`; const rw = x.measureText(right).width;
  x.font = `800 ${Math.round(head * 0.52)}px Arial, sans-serif`; x.fillText(fit(x, title, sw - pad * 3 - ic - rw), sx + pad * 1.6 + ic, sy + head / 2 + head * 0.03);
  x.textAlign = 'right'; x.font = `700 ${Math.round(head * 0.46)}px Arial, sans-serif`; x.fillText(right, sx + sw - pad, sy + head / 2 + head * 0.03);
  // the columns for this screen (fractions of the width)
  const cols: [string, number, (r: Row) => string, number][] = full
    ? [['Time', 0.09, r => hm(r.sched), 0], ['Expected', 0.11, r => r.exp !== r.sched ? hm(r.exp) : '', 1], ['Flight', 0.13, r => r.flight, 0], [kind === 'dep' ? 'To' : 'From', 0.32, r => r.place, 0], ['Aircraft', 0.13, r => r.ac, 0], ['Status', 0.22, r => r.status, 2]]
    : [['Time', 0.16, r => (r.exp !== r.sched && r.status !== 'Departed' && r.status !== 'Landed' ? hm(r.exp) : hm(r.sched)), 0], ['Flight', 0.21, r => r.flight, 0], [kind === 'dep' ? 'To' : 'From', 0.33, r => r.place, 0], ['Status', 0.30, r => r.status, 2]];
  const tot = cols.reduce((a, c) => a + c[1], 0), inner = sw - pad * 2, foot = Math.round(sh * 0.07);
  const sub = Math.round(sh * 0.072), top = sy + head + sub, rh = Math.floor((sh - head - sub - foot) / maxRows);
  x.fillStyle = 'rgba(255,255,255,0.04)'; x.fillRect(sx, sy + head, sw, sub);
  x.font = `700 ${Math.round(sub * 0.46)}px Arial, sans-serif`; x.fillStyle = '#8FA6BD'; x.textAlign = 'left';
  let cx = sx + pad; for (const c of cols) { x.fillText(fit(x, c[0].toUpperCase(), inner * c[1] / tot - pad * 0.4), cx, sy + head + sub / 2); cx += inner * c[1] / tot; }
  if (!rows.length) { x.fillStyle = '#C9D6E6'; x.textAlign = 'center'; x.font = `600 ${Math.round(rh * 0.5)}px Arial, sans-serif`; x.fillText(fit(x, kind === 'dep' ? 'No departures at this time' : 'No arrivals at this time', sw - pad * 2), sx + sw / 2, top + rh * 2); }
  rows.slice(0, maxRows).forEach((r, i) => { const y = top + i * rh;
    if (i % 2 === 0) { x.fillStyle = 'rgba(120,170,255,0.055)'; x.fillRect(sx, y, sw, rh); }
    x.fillStyle = 'rgba(255,255,255,0.05)'; x.fillRect(sx + pad * 0.5, y + rh - 1, sw - pad, 1);
    let cx2 = sx + pad; x.textAlign = 'left';
    for (const c of cols) { const w = inner * c[1] / tot - pad * 0.5, t = c[2](r), fs = Math.round(rh * 0.5);
      if (c[3] === 2 && t) { // the status as a pill in its colour
        x.font = `700 ${Math.round(fs * 0.92)}px Arial, sans-serif`; const tt = fit(x, t, w - fs * 0.9), tw = Math.min(w, x.measureText(tt).width + fs * 0.9), col = r.col || '#7FC4F5';
        x.globalAlpha = 0.2; x.fillStyle = col; rr(x, cx2, y + rh * 0.17, tw, rh * 0.66, rh * 0.2); x.fill(); x.globalAlpha = 1;
        x.strokeStyle = col; x.lineWidth = Math.max(1, rh * 0.035); x.stroke(); x.fillStyle = col; x.fillText(tt, cx2 + fs * 0.45, y + rh / 2 + 1);
      } else { x.fillStyle = c[3] === 1 ? '#F2B544' : c[0] === 'Flight' ? '#FFE9A8' : '#FFFFFF'; x.font = `${c[0] === 'Flight' || c[0] === 'Time' ? 700 : 600} ${fs}px Arial, sans-serif`; x.fillText(fit(x, t, w), cx2, y + rh / 2 + 1); }
      cx2 += inner * c[1] / tot; } });
  // the footer: a live light, when it last changed, and the page
  const fy = sy + sh - foot; x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(sx, fy, sw, foot);
  x.fillStyle = live ? '#3FD0A0' : '#8FA3B8'; x.beginPath(); x.arc(sx + pad + foot * 0.16, fy + foot / 2, foot * 0.16, 0, Math.PI * 2); x.fill();
  x.font = `600 ${Math.round(foot * 0.44)}px Arial, sans-serif`; x.fillStyle = '#8FA6BD'; x.textAlign = 'left';
  x.fillText(fit(x, live ? 'Live · updated ' + hms(at) : 'Sample timetable', sw * 0.6), sx + pad + foot * 0.5, fy + foot / 2);
  if (note) { x.textAlign = 'right'; x.fillText(note, sx + sw - pad, fy + foot / 2); }
  // the glass: a soft sheen across the top corner and darker edges
  g = x.createLinearGradient(sx, sy, sx + sw * 0.55, sy + sh); g.addColorStop(0, 'rgba(255,255,255,0.10)'); g.addColorStop(0.35, 'rgba(255,255,255,0.025)'); g.addColorStop(0.36, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(sx, sy, sw, sh);
  const v = x.createRadialGradient(sx + sw / 2, sy + sh / 2, Math.min(sw, sh) * 0.35, sx + sw / 2, sy + sh / 2, Math.max(sw, sh) * 0.75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.32)'); x.fillStyle = v; x.fillRect(sx, sy, sw, sh);
  x.restore();
}

/** The rows' pages: pages of n rows, in order. */
const pages = (rows: Row[], n: number) => { const out: Row[][] = []; for (let i = 0; i < rows.length; i += n) out.push(rows.slice(i, i + n)); return out; };

/** The screens' materials, one set per scene (one per kind and shape, shared by every screen of that kind and shape) and their upkeep. */
const ONE = new WeakMap<Scene, { get: (kind: Kind, shape: Shape) => StandardMaterial }>();
export function makeFids(sc: Scene, icao: string) { let f = ONE.get(sc); if (!f) { f = build(sc, icao); ONE.set(sc, f); } return f; }
function build(sc: Scene, icao: string) {
  type E = { m: StandardMaterial; t: DynamicTexture; kind: Kind; shape: Shape; last: string };
  const mats = new Map<string, E>();
  let data: { dep: Row[]; arr: Row[]; base: string; live: boolean; at: number } = { dep: [], arr: [], base: icao, live: false, at: Date.now() }, sig = '';
  const get = (kind: Kind, shape: Shape) => { const k = shape === 'opswall' ? 'opswall' : kind + shape; let e = mats.get(k);
    if (!e) { const [w, h] = SIZE[shape], t = new DynamicTexture(`fids-${k}`, { width: w, height: h }, sc, true, Texture.TRILINEAR_SAMPLINGMODE); t.anisotropicFilteringLevel = 8;
      const m = new StandardMaterial(`fids-${k}`, sc); m.diffuseTexture = t; m.emissiveTexture = t; m.emissiveColor = new Color3(0.95, 0.95, 0.95); m.specularColor = new Color3(0.04, 0.04, 0.04); m.disableLighting = true;
      e = { m, t, kind, shape, last: '' }; mats.set(k, e); paint(e); }
    return e.m; };
  const paint = (e: E) => { const now = Date.now(), none = !data.dep.length && !data.arr.length, demo = DEMO_DATA && none, live = data.live && !demo;
    const rowsOf = (k: Kind, n: number) => demo ? sample(k, now, n) : (k === 'dep' ? data.dep : data.arr);
    const key = hm(now) + (demo ? 'demo' : sig) + data.base; if (key === e.last) return; e.last = key;
    const x = e.t.getContext() as CanvasRenderingContext2D, [w, h] = SIZE[e.shape];
    x.clearRect(0, 0, w, h); x.fillStyle = '#050608'; x.fillRect(0, 0, w, h);
    if (e.shape === 'opswall') {
      // six monitors: departures, arrivals, departures… each the next page of its kind, repeating in order when short
      const gap = Math.round(w * 0.006), pw = (w - gap * (OPS_PANELS + 1)) / OPS_PANELS, P = { dep: pages(rowsOf('dep', OPS_ROWS * 3), OPS_ROWS), arr: pages(rowsOf('arr', OPS_ROWS * 3), OPS_ROWS) };
      for (let i = 0; i < OPS_PANELS; i++) { const k: Kind = i % 2 ? 'arr' : 'dep', pg = P[k], n = Math.floor(i / 2), pi = pg.length ? n % pg.length : 0;
        monitor(x, gap + i * (pw + gap), gap, pw, h - gap * 2, k, false, pg[pi] || [], OPS_ROWS, data.base, now, live, data.at, pg.length > 1 ? `${pi + 1} / ${pg.length}` : ''); }
    } else { const full = e.shape === 'wall', n = full ? 10 : 8, all = rowsOf(e.kind, n);
      monitor(x, 0, 0, w, h, e.kind, full, all.slice(0, n), n, data.base, now, live, data.at, ''); }
    e.t.update(true); };
  const repaint = () => { for (const e of mats.values()) paint(e); };
  // the game's rows, asked for every 4 s while the game runs (a change shows within seconds); drawn again only when
  // they change, and the clocks checked every 5 s
  const off = onGameFids(d => { const dep = (d.dep || []) as Row[], arr = (d.arr || []) as Row[], s = JSON.stringify([dep, arr].map(l => l.map(r => [r.flight, r.sched, r.exp, r.status, r.place, r.ac])));
    if (s !== sig || !data.live) { sig = s; data = { dep, arr, base: String(d.base || icao), live: true, at: Date.now() }; repaint(); } });
  const ask = () => { if (gameExists()) gameSend({ ampb: 'fids', icao }); };
  ask(); const t1 = setInterval(ask, 4000), t2 = setInterval(repaint, 5000);
  sc.onDisposeObservable.addOnce(() => { clearInterval(t1); clearInterval(t2); off(); });
  return { get };
}
