// The airport map while you walk: a square, holographic blue map in the corner, always centred on you and turned
// the way you face. Its walls are traced from the terminal's 3D model; the stairs, lifts, columns, the rooms' names,
// the kerb, the apron and the rental car centre come from the plan. The floor you are on is drawn clearly; the other
// floors only as a faint ghost. Navigation: the tab under the map (or M, or a tap on the map) opens it full screen;
// tap where you want to go and a route is drawn there (through the doors, up or down the stairs or the lift), bright
// on your floor and faint on the others; it follows you as you walk and clears when you arrive (or with ✕).
import { ROOMS, DOORS, STAIRS, LIFTS, OUTSIDE, COLUMNS, Fl } from '../sections/terminal/plan';
import { IS_TOUCH } from '../core/app';
import { toast } from './icons';
import { perfPart } from '../core/perf-meter';
import { TransformNode, Matrix, Vector3, VertexBuffer, Mesh } from '@babylonjs/core';
import { F2Y } from '../sections/terminal/plan';

/** The walls as they are really built: every wall, column and glass pane of the terminal's 3D model (and the rental
 *  car centre) cut through at waist height on a floor (y, in the terminal's own frame), as lines. Only one face of each
 *  wall is kept (so a wall is one line, not two) and the tiny end pieces are dropped. */
export function traceWalls(root: TransformNode, y: number, floor?: number): Seg[] {
  const inv = Matrix.Invert(root.computeWorldMatrix(true)), out: Seg[] = [];
  const meshes = root.getChildMeshes(false).filter(m => m instanceof Mesh && m.getTotalVertices() > 0 && (/STRUCTURE/.test(m.name) || (m.metadata && m.metadata.kind === 'glass')) && !/COLLIDE/.test(m.name) && !/^(ROOF|STAIRS|DOORS)\b|\/ROOF|STAIR/.test(m.name) && !(m.metadata && /ROOF|STAIR/.test(String(m.metadata.id || ''))));
  // each wall belongs to the floor of its room (a tall wall rising past the floor above still belongs to its own floor)
  const floorOf = (m: Mesh) => { const id = (m.metadata && m.metadata.room) || m.name.split('/')[0], r = ROOMS.find(q => q.id === id); return r ? r.f : 1; };
  for (const m of meshes as Mesh[]) {
    if (floor != null && floorOf(m) !== floor) continue;
    const pos = m.getVerticesData(VertexBuffer.PositionKind), idx = m.getIndices(); if (!pos || !idx) continue;
    const M = m.computeWorldMatrix(true).multiply(inv), v = new Vector3(), P: number[] = new Array(pos.length);
    for (let i = 0; i < pos.length; i += 3) { Vector3.TransformCoordinatesFromFloatsToRef(pos[i], pos[i + 1], pos[i + 2], M, v); P[i] = v.x; P[i + 1] = v.y; P[i + 2] = v.z; }
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
      const ya = P[a + 1] - y, yb = P[b + 1] - y, yc = P[c + 1] - y;
      if ((ya > 0 && yb > 0 && yc > 0) || (ya < 0 && yb < 0 && yc < 0)) continue;
      // the face's direction across the ground: keep one side of each wall only
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], wx = P[c] - P[a], wy = P[c + 1] - P[a + 1], wz = P[c + 2] - P[a + 2];
      const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx, nl = Math.hypot(nx, ny, nz) || 1;
      if (Math.abs(ny / nl) > 0.5) continue;                                   // floors, ceilings, tops of walls
      if (nx / nl + 0.37 * nz / nl <= 0.02) continue;
      const pts: number[] = [];
      for (const [p, q, yp, yq] of [[a, b, ya, yb], [b, c, yb, yc], [c, a, yc, ya]] as number[][]) {
        if ((yp <= 0 && yq > 0) || (yp > 0 && yq <= 0)) { const k = yp / (yp - yq); pts.push(P[p] + (P[q] - P[p]) * k, P[p + 2] + (P[q + 2] - P[p + 2]) * k); } }
      if (pts.length >= 4 && Math.hypot(pts[2] - pts[0], pts[3] - pts[1]) > 0.25) out.push([pts[0], pts[1], pts[2], pts[3]]);
    }
  }
  // joined: pieces of the same straight wall that meet end to end become one line
  const key = (x: number, z: number) => Math.round(x * 20) + ',' + Math.round(z * 20);
  const ends = new Map<string, number[]>(); out.forEach((s, i) => { for (const k of [key(s[0], s[1]), key(s[2], s[3])]) { const l = ends.get(k); if (l) l.push(i); else ends.set(k, [i]); } });
  const dead = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) { if (dead[i]) continue; let grew = true; while (grew) { grew = false; const s = out[i];
    for (const end of [0, 1]) { const k = end ? key(s[2], s[3]) : key(s[0], s[1]); for (const j of ends.get(k) || []) { if (j === i || dead[j]) continue; const o = out[j];
      const dx1 = s[2] - s[0], dz1 = s[3] - s[1], dx2 = o[2] - o[0], dz2 = o[3] - o[1]; if (Math.abs(dx1 * dz2 - dz1 * dx2) > 0.02 * Math.hypot(dx1, dz1) * Math.hypot(dx2, dz2)) continue;
      const pts = [[s[0], s[1]], [s[2], s[3]], [o[0], o[1]], [o[2], o[3]]], ax = Math.abs(dx1) > Math.abs(dz1) ? 0 : 1; pts.sort((p, q) => p[ax] - q[ax]);
      s[0] = pts[0][0]; s[1] = pts[0][1]; s[2] = pts[3][0]; s[3] = pts[3][1]; dead[j] = 1; grew = true;
      for (const kk of [key(s[0], s[1]), key(s[2], s[3])]) { const l = ends.get(kk); if (l) l.push(i); else ends.set(kk, [i]); } } } } }
  const res: Seg[] = []; out.forEach((s, i) => { if (!dead[i]) chop(s, res); }); return res;
}

export interface HoloState { x: number; z: number; f: Fl; yaw: number }

export type Seg = [number, number, number, number];

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

// ---------- the route: through the doors, the stairs and the lifts ----------
interface Area { id: string; f: number; x0: number; z0: number; x1: number; z1: number; name: string }
interface NNode { x: number; z: number; f: number; areas: string[]; pen?: number; oneway?: { a: string; b: string }; link?: number; kind?: 'stair' | 'lift'; cost?: number }
export interface RoutePt { x: number; z: number; f: number; via?: 'stair' | 'lift' }
const AREAS: Area[] = [...ROOMS.map(r => ({ id: r.id, f: r.f as number, x0: r.x0, z0: r.z0, x1: r.x1, z1: r.z1, name: r.name })),
  ...OUTSIDE.map(o => ({ id: o.id, f: 1, x0: o.x0, z0: o.z0, x1: o.x1, z1: o.z1, name: o.name || o.id }))];
const inA = (a: Area, x: number, z: number, m = 0) => x > a.x0 - m && x < a.x1 + m && z > a.z0 - m && z < a.z1 + m;
function areaAt(f: number, x: number, z: number): Area | null {
  const on = AREAS.filter(a => a.f === f); return on.find(a => inA(a, x, z)) || on.find(a => inA(a, x, z, 0.8)) || null; }
function nearestArea(f: number, x: number, z: number): Area | null {
  let best: Area | null = null, bd = 1e9; for (const a of AREAS) { if (a.f !== f) continue; const dx = Math.max(a.x0 - x, 0, x - a.x1), dz = Math.max(a.z0 - z, 0, z - a.z1), d = Math.hypot(dx, dz); if (d < bd) { bd = d; best = a; } } return best; }
let NODES: NNode[] | null = null;
function buildNodes(): NNode[] {
  const N: NNode[] = [], ids = new Set(AREAS.map(a => a.id));
  for (const d of DOORS) { const ar = [d.a, d.b].filter(i => ids.has(i)); if (!ar.length) continue; N.push({ x: d.x, z: d.z, f: d.f, areas: ar, oneway: d.type === 'oneway' ? { a: d.a, b: d.b } : undefined }); }
  for (const s of STAIRS) { const xc = (s.x0 + s.x1) / 2, zc = (s.z0 + s.z1) / 2;
    const [b, t] = s.dir === 'x+' ? [[s.x0, zc], [s.x1, zc]] : s.dir === 'x-' ? [[s.x1, zc], [s.x0, zc]] : s.dir === 'z+' ? [[xc, s.z0], [xc, s.z1]] : [[xc, s.z1], [xc, s.z0]];
    const i = N.length, pen = 0; N.push({ x: b[0], z: b[1], f: 1, areas: [s.from], pen, link: i + 1, kind: 'stair', cost: Math.hypot(t[0] - b[0], t[1] - b[1]) * 1.4 + 4 }, { x: t[0], z: t[1], f: 2, areas: [s.to], pen, link: i, kind: 'stair', cost: Math.hypot(t[0] - b[0], t[1] - b[1]) * 1.4 + 4 }); }
  for (const l of LIFTS) { const i = N.length; N.push({ x: l.x, z: l.z, f: 1, areas: [l.from], link: i + 1, kind: 'lift', cost: 22 }, { x: l.x, z: l.z, f: 2, areas: [l.to], link: i, kind: 'lift', cost: 22 }); }
  // outside areas that touch or overlap (the kerb, the rental car centre's front, hall, walk and garage) join where they meet
  const out = AREAS.filter(a => OUTSIDE.some(o => o.id === a.id));
  for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) { const a = out[i], b = out[j];
    const x0 = Math.max(a.x0, b.x0), x1 = Math.min(a.x1, b.x1), z0 = Math.max(a.z0, b.z0), z1 = Math.min(a.z1, b.z1);
    if (x0 <= x1 + 0.6 && z0 <= z1 + 0.6) N.push({ x: (x0 + Math.min(x1, x0 + 1e9)) / 2 || x0, z: (z0 + z1) / 2, f: 1, areas: [a.id, b.id] }); }
  return N;
}
/** May a route go from node u to node v inside area X? (a one-way door is walked only from its b side to its a side) */
const okIn = (u: NNode | null, v: NNode | null, X: string) => !(v && v.oneway && X === v.oneway.a) && !(u && u.oneway && X === u.oneway.b);
/** The route search on its own (it uses nothing from outside itself), so it can run in a background thread:
 *  from where you are, through the doors (one-way ones only the right way), the stairs and the lifts, to the waypoint. */
function routeCore(D: { areas: any[]; nodes: any[] }, from: { x: number; z: number; f: number }, to: { x: number; z: number; f: number }): any[] | null {
  const inA = (a: any, x: number, z: number, m = 0) => x > a.x0 - m && x < a.x1 + m && z > a.z0 - m && z < a.z1 + m;
  const areaAt = (f: number, x: number, z: number) => { const on = D.areas.filter((a: any) => a.f === f); return on.find((a: any) => inA(a, x, z)) || on.find((a: any) => inA(a, x, z, 0.8)) || null; };
  const nearest = (f: number, x: number, z: number) => { let best: any = null, bd = 1e9; for (const a of D.areas) { if (a.f !== f) continue; const d = Math.hypot(Math.max(a.x0 - x, 0, x - a.x1), Math.max(a.z0 - z, 0, z - a.z1)); if (d < bd) { bd = d; best = a; } } return best; };
  const okIn = (u: any, v: any, X: string) => !(v && v.oneway && X === v.oneway.a) && !(u && u.oneway && X === u.oneway.b);
  const N = D.nodes, S = areaAt(from.f, from.x, from.z) || nearest(from.f, from.x, from.z), T = areaAt(to.f, to.x, to.z) || nearest(to.f, to.x, to.z); if (!S || !T) return null;
  if (S.id === T.id && from.f === to.f) return [{ x: from.x, z: from.z, f: from.f }, { x: to.x, z: to.z, f: to.f }];
  const n = N.length, dist = new Float64Array(n + 1).fill(Infinity), prev = new Int32Array(n + 1).fill(-2), done = new Uint8Array(n + 1);
  for (let i = 0; i < n; i++) if (N[i].f === from.f && N[i].areas.includes(S.id) && okIn(null, N[i], S.id)) { dist[i] = Math.hypot(N[i].x - from.x, N[i].z - from.z) + (N[i].pen || 0); prev[i] = -1; }
  const goal = n;
  for (;;) { let u = -1, bd = Infinity; for (let i = 0; i <= n; i++) if (!done[i] && dist[i] < bd) { bd = dist[i]; u = i; } if (u < 0 || u === goal) break; done[u] = 1; const U = N[u];
    if (U.f === to.f && U.areas.includes(T.id) && okIn(U, null, T.id)) { const d = bd + Math.hypot(to.x - U.x, to.z - U.z); if (d < dist[goal]) { dist[goal] = d; prev[goal] = u; } }
    if (U.link != null) { const v = U.link; const d = bd + (U.cost || 20); if (d < dist[v]) { dist[v] = d; prev[v] = u; } }
    for (let v = 0; v < n; v++) { if (done[v] || v === u) continue; const V = N[v]; if (V.f !== U.f) continue;
      const shared = U.areas.find((a: string) => V.areas.includes(a) && okIn(U, V, a)); if (!shared) continue;
      const d = bd + Math.hypot(V.x - U.x, V.z - U.z) + (V.pen || 0); if (d < dist[v]) { dist[v] = d; prev[v] = u; } } }
  if (!isFinite(dist[goal])) return null;
  const chain: number[] = []; for (let c = prev[goal]; c >= 0; c = prev[c]) chain.unshift(c);
  const pts: any[] = [{ x: from.x, z: from.z, f: from.f }];
  for (let i = 0; i < chain.length; i++) { const A = N[chain[i]], B = i > 0 ? N[chain[i - 1]] : null; pts.push({ x: A.x, z: A.z, f: A.f, via: B && B.link === chain[i] ? B.kind : undefined }); }
  pts.push({ x: to.x, z: to.z, f: to.f }); return pts;
}
export function findRoute(from: { x: number; z: number; f: number }, to: { x: number; z: number; f: number }): RoutePt[] | null {
  if (!NODES) NODES = buildNodes(); return routeCore({ areas: AREAS, nodes: NODES }, from, to);
}
/** The route search in a background thread (phone and PC alike); where a thread can't be made, it runs here. */
let routeWorker: Worker | null | false = null; let routeAsk = 0; const routeWait = new Map<number, (r: RoutePt[] | null) => void>();
function findRouteAsync(from: { x: number; z: number; f: number }, to: { x: number; z: number; f: number }): Promise<RoutePt[] | null> {
  if (routeWorker === null) { try {
      const src = `const routeCore = ${routeCore.toString()}; let D = null; onmessage = e => { const m = e.data; if (m.D) { D = m.D; return; } let r = null; try { r = routeCore(D, m.from, m.to); } catch (err) { r = null; } postMessage({ id: m.id, r }); };`;
      const w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      if (!NODES) NODES = buildNodes(); w.postMessage({ D: { areas: AREAS, nodes: NODES } });
      w.onmessage = e => { const f = routeWait.get(e.data.id); if (f) { routeWait.delete(e.data.id); f(e.data.r); } };
      w.onerror = () => { routeWorker = false; for (const [, f] of routeWait) f(null); routeWait.clear(); };
      routeWorker = w;
    } catch (e) { routeWorker = false; } }
  if (!routeWorker) return Promise.resolve(findRoute(from, to));
  const id = ++routeAsk; return new Promise(ok => { routeWait.set(id, ok); (routeWorker as Worker).postMessage({ id, from: { x: from.x, z: from.z, f: from.f }, to: { x: to.x, z: to.z, f: to.f } }); setTimeout(() => { if (routeWait.has(id)) { routeWait.delete(id); ok(findRoute(from, to)); } }, 1500); });
}

export function holoMap(host: HTMLElement, get: () => HoloState | null, root?: TransformNode) {
  const LIGHT = IS_TOUCH;   // phones and tablets: no glow blur (slow there), drawn 10 times a second
  if (!document.getElementById('holomap-css')) { const st = document.createElement('style'); st.id = 'holomap-css'; st.textContent = `
.holomap { position: absolute; right: max(14px, env(safe-area-inset-right)); top: max(14px, env(safe-area-inset-top)); width: ${IS_TOUCH ? 150 : 214}px; height: ${IS_TOUCH ? 150 : 214}px;
  pointer-events: auto; cursor: pointer; filter: drop-shadow(0 0 10px rgba(40,150,255,.28)); }
.holomap canvas { width: 100%; height: 100%; display: block; }
.holomap::after, .hm-full::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: repeating-linear-gradient(0deg, rgba(120,210,255,.05) 0 1px, transparent 1px 3px); mix-blend-mode: screen; }
.hm-tab { position: absolute; left: 0; right: 0; top: calc(100% + 4px); display: flex; gap: 4px; }
.hm-tab button { pointer-events: auto; flex: 1; min-height: ${IS_TOUCH ? 32 : 26}px; border: 1px solid rgba(110,200,255,.55); background: rgba(6,24,44,.82); color: #BFEAFF; font: 700 10px Inter, sans-serif; letter-spacing: .14em;
  text-transform: uppercase; border-radius: 3px; cursor: pointer; text-shadow: 0 0 6px rgba(60,170,255,.8); box-shadow: inset 0 0 12px rgba(60,160,255,.18); }
.hm-tab button.x { flex: 0 0 ${IS_TOUCH ? 34 : 28}px; color: #FFD58A; border-color: rgba(255,200,110,.55); }
.hm-full { position: fixed; inset: max(18px, env(safe-area-inset-top)) max(18px, env(safe-area-inset-right)) max(18px, env(safe-area-inset-bottom)) max(18px, env(safe-area-inset-left)); z-index: 30; pointer-events: auto;
  border: 1px solid rgba(110,200,255,.55); box-shadow: 0 0 40px rgba(40,150,255,.35), inset 0 0 60px rgba(40,150,255,.12); background: rgba(2,10,22,.55); backdrop-filter: blur(3px); transform-origin: 0 0; touch-action: none; }
.hm-full canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; cursor: crosshair; }
.hm-full .hm-bar { position: absolute; left: 0; right: 0; top: 0; padding: 10px 12px; background: linear-gradient(rgba(2,10,22,.92), rgba(2,10,22,.7) 75%, rgba(2,10,22,0)); display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.hm-full .hm-bar b { font: 700 12px Inter, sans-serif; letter-spacing: .2em; color: #CFF0FF; text-shadow: 0 0 8px rgba(60,170,255,.9); margin-right: auto; text-transform: uppercase; }
.hm-full .hm-bar small { display: block; font: 500 10.5px Inter, sans-serif; letter-spacing: .06em; color: rgba(160,215,255,.8); text-transform: none; margin-top: 2px; }
.hm-full button { pointer-events: auto; min-height: ${IS_TOUCH ? 38 : 30}px; padding: 0 12px; border: 1px solid rgba(110,200,255,.55); background: rgba(6,24,44,.85); color: #BFEAFF; font: 700 10.5px Inter, sans-serif;
  letter-spacing: .14em; text-transform: uppercase; border-radius: 3px; cursor: pointer; text-shadow: 0 0 6px rgba(60,170,255,.8); }
.hm-full button.on { background: rgba(40,130,220,.45); color: #fff; box-shadow: 0 0 12px rgba(60,170,255,.6); }
.hm-full button.warm { color: #FFD58A; border-color: rgba(255,200,110,.6); }
.hm-full .hm-min { position: absolute; right: 12px; bottom: 12px; }
@keyframes hm-flick { 0% { opacity: .35 } 18% { opacity: .95 } 26% { opacity: .55 } 40% { opacity: 1 } 100% { opacity: 1 } }
.hm-full.flick canvas { animation: hm-flick .45s linear; }
`; document.head.appendChild(st); }
  const box = document.createElement('div'); box.className = 'holomap';
  box.innerHTML = '<canvas></canvas><div class="hm-tab"><button class="go">◎ Navigate</button><button class="x" hidden title="Remove waypoint">✕</button></div>';
  host.appendChild(box);
  const cv = box.querySelector('canvas') as HTMLCanvasElement, cx = cv.getContext('2d')!;
  const goBtn = box.querySelector('.hm-tab .go') as HTMLButtonElement, xBtn = box.querySelector('.hm-tab .x') as HTMLButtonElement;

  // the walls: traced from the 3D model when it is there (so the map follows any change to it), else from the plan
  // (every floor the plan has, so more floors added later show too; each floor's walls cut at waist height)
  const FLOORS = Array.from(new Set(ROOMS.map(r => r.f as number))).sort((a, b) => a - b);
  const WALLS: { [f: number]: Seg[] } = {}; for (const f of FLOORS) WALLS[f] = wallsOf(f as Fl);
  if (root) try { const t: { [f: number]: Seg[] } = {}; for (const f of FLOORS) t[f] = traceWalls(root, (f - 1) * F2Y + 1.2, f); if (t[FLOORS[0]].length > 20) Object.assign(WALLS, t); } catch (e) { /* the plan's walls */ }
  const OUT: Seg[] = []; for (const o of OUTSIDE) if (!/DOOR/.test(o.id)) rectSegs(o).forEach(s => OUT.push(s));
  const NAMES = [...ROOMS.map(r => ({ f: r.f as number, x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2, w: r.x1 - r.x0, h: r.z1 - r.z0, t: short(r.name), r: r as any })),
    ...OUTSIDE.filter(o => o.name && !/DOOR/.test(o.id)).map(o => ({ f: 1, x: (o.x0 + o.x1) / 2, z: (o.z0 + o.z1) / 2, w: o.x1 - o.x0, h: o.z1 - o.z0, t: short(o.name!), r: o as any })),
    ...OUTSIDE.filter(o => o.id === 'KERB' || o.id === 'APRON').map(o => ({ f: 1, x: (o.x0 + o.x1) / 2, z: o.id === 'APRON' ? o.z0 + 8 : (o.z0 + o.z1) / 2, w: o.x1 - o.x0, h: 10, t: o.id === 'KERB' ? 'KERB · DEPARTURES' : 'APRON', r: o as any }))];

  // the waypoint and its route
  let dest: { x: number; z: number; f: number; name: string } | null = null, route: RoutePt[] | null = null, routeT = 0, routeLen = 0, routeBusy = false;
  const setDest = (d: typeof dest) => { dest = d; route = null; routeT = 0; xBtn.hidden = !d; goBtn.textContent = d ? '◎ Route' : '◎ Navigate'; };

  // ---------- drawing one view of the map ----------
  interface View { cx: number; cz: number; yaw: number; k: number; f: number; full: boolean }
  const t0 = performance.now();
  const PP: [number, number][] = Array.from({ length: 32 }, () => [0, 0] as [number, number]); let pi = 0;
  const render = (c0: CanvasRenderingContext2D, W: number, H: number, dpr: number, V: View, st: HoloState) => {
    const c: CanvasRenderingContext2D = LIGHT ? new Proxy(c0, { set(t: any, k, v) { if (k !== 'shadowBlur') t[k] = v; return true; }, get(t: any, k) { const v = t[k]; return typeof v === 'function' ? v.bind(t) : v; } }) : c0;
    const now = performance.now(), sy = Math.sin(V.yaw), cy = Math.cos(V.yaw), k = V.k, X0 = W / 2, Y0 = H / 2;
    // a point on the map: written into one of a small ring of reused pairs (no new objects for every point drawn)
    const P = (x: number, z: number): [number, number] => { const dx = x - V.cx, dz = z - V.cz, r = PP[pi = (pi + 1) & 31]; r[0] = X0 + (dx * cy - dz * sy) * k; r[1] = Y0 - (dx * sy + dz * cy) * k; return r; };
    const reach = Math.max(W, H) / k * 0.75, inView = (x: number, z: number) => Math.abs(x - V.cx) < reach && Math.abs(z - V.cz) < reach;
    c.clearRect(0, 0, W, H);
    const bg = c.createRadialGradient(X0, Y0, Math.min(W, H) * 0.05, X0, Y0, Math.max(W, H) * 0.75); bg.addColorStop(0, 'rgba(10,40,70,.78)'); bg.addColorStop(1, 'rgba(3,12,26,.86)');
    c.fillStyle = bg; c.fillRect(0, 0, W, H);
    c.save(); c.beginPath(); c.rect(0, 0, W, H); c.clip();
    // the grid, every 10 m
    c.lineWidth = 1 * dpr; c.strokeStyle = 'rgba(90,180,255,.07)'; c.beginPath();
    for (let gx = Math.floor((V.cx - reach) / 10) * 10; gx <= V.cx + reach; gx += 10) { const a = P(gx, V.cz - reach), b = P(gx, V.cz + reach); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); }
    for (let gz = Math.floor((V.cz - reach) / 10) * 10; gz <= V.cz + reach; gz += 10) { const a = P(V.cx - reach, gz), b = P(V.cx + reach, gz); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); }
    c.stroke();
    const segs = (list: Seg[], col: string, w: number, dash: number[] = []) => { c.strokeStyle = col; c.lineWidth = w * dpr; c.setLineDash(dash.map(v => v * dpr)); c.beginPath();
      for (const s of list) { if (!inView((s[0] + s[2]) / 2, (s[1] + s[3]) / 2)) continue; const a = P(s[0], s[1]), b = P(s[2], s[3]); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); }
      c.stroke(); c.setLineDash([]); };
    // the other floors: only a ghost (floors above lifted up the panel, floors below sunk down it, thin, dashed, dim)
    for (const f of FLOORS) if (f !== V.f && WALLS[f]) { c.save(); c.translate(0, (V.f - f) * 7 * dpr); segs(WALLS[f], 'rgba(90,150,230,.16)', 0.7, [2, 2.5]); c.restore(); }
    // the room you are in, lit (on the floor shown)
    const here = st.f === V.f ? areaAt(st.f, st.x, st.z) : null;
    if (here) { const q = [P(here.x0, here.z0), P(here.x1, here.z0), P(here.x1, here.z1), P(here.x0, here.z1)]; c.fillStyle = 'rgba(60,170,255,.10)'; c.beginPath(); c.moveTo(q[0][0], q[0][1]); for (const p of q.slice(1)) c.lineTo(p[0], p[1]); c.closePath(); c.fill(); }
    if (V.f === 1) segs(OUT, 'rgba(120,200,255,.38)', 1, [4, 3]);
    c.shadowColor = 'rgba(50,160,255,.9)'; c.shadowBlur = 6 * dpr; segs(WALLS[V.f] || [], 'rgba(140,215,255,.95)', 1.6); c.shadowBlur = 0;
    for (const s of STAIRS) { const mx = (s.x0 + s.x1) / 2, mz = (s.z0 + s.z1) / 2; if (!inView(mx, mz)) continue;
      c.strokeStyle = 'rgba(160,235,255,.85)'; c.lineWidth = 1 * dpr; c.beginPath();
      const q = [P(s.x0, s.z0), P(s.x1, s.z0), P(s.x1, s.z1), P(s.x0, s.z1)]; c.moveTo(q[0][0], q[0][1]); for (const p of q.slice(1)) c.lineTo(p[0], p[1]); c.closePath();
      const alongX = s.dir[0] === 'x', nn = Math.round((alongX ? s.x1 - s.x0 : s.z1 - s.z0) / 0.6);
      for (let i = 1; i < nn; i++) { const t = i / nn; const p = alongX ? [P(s.x0 + (s.x1 - s.x0) * t, s.z0), P(s.x0 + (s.x1 - s.x0) * t, s.z1)] : [P(s.x0, s.z0 + (s.z1 - s.z0) * t), P(s.x1, s.z0 + (s.z1 - s.z0) * t)]; c.moveTo(p[0][0], p[0][1]); c.lineTo(p[1][0], p[1][1]); }
      c.stroke(); }
    for (const l of LIFTS) { if (!inView(l.x, l.z)) continue; const p = P(l.x, l.z), s = 1.4 * k;
      c.strokeStyle = 'rgba(160,235,255,.9)'; c.lineWidth = 1 * dpr; c.strokeRect(p[0] - s, p[1] - s, s * 2, s * 2);
      c.fillStyle = 'rgba(160,235,255,.9)'; c.beginPath(); c.moveTo(p[0], p[1] - s * .7); c.lineTo(p[0] - s * .45, p[1] - s * .1); c.lineTo(p[0] + s * .45, p[1] - s * .1); c.closePath(); c.moveTo(p[0], p[1] + s * .7); c.lineTo(p[0] - s * .45, p[1] + s * .1); c.lineTo(p[0] + s * .45, p[1] + s * .1); c.closePath(); c.fill(); }
    c.fillStyle = 'rgba(140,215,255,.5)'; if (V.f === 1) for (const [, x, z] of COLUMNS) { if (!inView(x, z)) continue; const p = P(x, z); c.fillRect(p[0] - 1.5 * dpr, p[1] - 1.5 * dpr, 3 * dpr, 3 * dpr); }
    // the route: a warm, flowing line on this floor; a faint one on the others; the stairs and lifts marked
    if (route && route.length > 1) {
      const flow = -((now - t0) / 40) % 18;
      for (let pass = 0; pass < 2; pass++) for (let i = 1; i < route.length; i++) { const A = route[i - 1], B = route[i];
        const change = A.f !== B.f, mine = (A.f === V.f && B.f === V.f) || (change && (A.f === V.f || B.f === V.f));
        if ((pass === 0) === mine) continue;          // the faint parts first, the bright ones over them
        const a = P(A.x, A.z), b = P(B.x, B.z);
        if (!mine) { c.save(); c.translate(0, (V.f - (change ? Math.max(A.f, B.f) : A.f)) * 7 * dpr); c.strokeStyle = 'rgba(255,190,100,.2)'; c.lineWidth = 1.2 * dpr; c.setLineDash([3 * dpr, 3 * dpr]); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); c.setLineDash([]); c.restore(); continue; }
        c.shadowColor = 'rgba(255,170,60,.95)'; c.shadowBlur = 8 * dpr;
        c.strokeStyle = 'rgba(255,200,110,.35)'; c.lineWidth = 5 * dpr; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
        c.strokeStyle = change ? 'rgba(255,240,200,1)' : 'rgba(255,214,140,1)'; c.lineWidth = 2 * dpr; c.setLineDash(change ? [2 * dpr, 3 * dpr] : [10 * dpr, 8 * dpr]); c.lineDashOffset = flow * dpr;
        c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); c.setLineDash([]); c.lineDashOffset = 0; c.shadowBlur = 0;
        if (change) { // the stairs or the lift: a tag saying so, which way
          const up = B.f > A.f, m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], txt = `${up ? '▲' : '▼'} ${B.via === 'lift' ? 'LIFT' : 'STAIRS'} ${up ? 'UP' : 'DOWN'} · FLOOR ${B.f}`;
          c.font = `700 ${9 * dpr}px Inter, sans-serif`; const tw = c.measureText(txt).width; c.fillStyle = 'rgba(40,24,6,.85)'; c.fillRect(m[0] - tw / 2 - 5 * dpr, m[1] - 18 * dpr, tw + 10 * dpr, 13 * dpr);
          c.strokeStyle = 'rgba(255,200,110,.9)'; c.lineWidth = 1 * dpr; c.strokeRect(m[0] - tw / 2 - 5 * dpr, m[1] - 18 * dpr, tw + 10 * dpr, 13 * dpr);
          c.fillStyle = '#FFE2AE'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, m[0], m[1] - 11.5 * dpr); } }
    }
    if (dest) { const p = P(dest.x, dest.z), mine = dest.f === V.f, pulse = 0.5 + 0.5 * Math.sin((now - t0) / 220);
      c.save(); if (!mine) c.translate(0, (V.f - dest.f) * 7 * dpr); c.globalAlpha = mine ? 1 : 0.3;
      c.strokeStyle = `rgba(255,200,110,${0.35 + 0.4 * pulse})`; c.lineWidth = 1.5 * dpr; c.beginPath(); c.arc(p[0], p[1], (8 + 6 * pulse) * dpr, 0, Math.PI * 2); c.stroke();
      c.fillStyle = '#FFD58A'; c.shadowColor = 'rgba(255,170,60,1)'; c.shadowBlur = 10 * dpr; c.beginPath(); c.moveTo(p[0], p[1] - 6 * dpr); c.lineTo(p[0] + 5 * dpr, p[1]); c.lineTo(p[0], p[1] + 6 * dpr); c.lineTo(p[0] - 5 * dpr, p[1]); c.closePath(); c.fill(); c.restore(); c.shadowBlur = 0; }
    // the names on this floor only, upright, where they fit, never on top of each other
    c.textAlign = 'center'; c.textBaseline = 'middle'; const taken: number[][] = [];
    for (const n of here ? [...NAMES.filter(q => q.r.id === here.id), ...NAMES.filter(q => q.r.id !== here.id)] : NAMES) { if (n.f !== V.f || !inView(n.x, n.z)) continue;
      const fit = Math.min(n.w, n.h) * k; if (fit < 22 * dpr) continue;
      const size = Math.max(7, Math.min(V.full ? 13 : 10, fit / dpr / 9)) * dpr; c.font = `600 ${size}px Inter, sans-serif`;
      const p = P(n.x, n.z), you = st.f === V.f ? P(st.x, st.z) : null; c.fillStyle = here && n.r.id === here.id ? 'rgba(220,245,255,.95)' : 'rgba(150,215,255,.7)'; c.shadowColor = 'rgba(40,150,255,.8)'; c.shadowBlur = 4 * dpr;
      const words = n.t.split(' '), lines: string[] = []; let line = ''; for (const w of words) { if (line && c.measureText(line + ' ' + w).width > Math.max(n.w, n.h) * k * 0.8) { lines.push(line); line = w; } else line = line ? line + ' ' + w : w; } lines.push(line);
      if (you && Math.hypot(p[0] - you[0], p[1] - you[1]) < 16 * dpr) p[1] = you[1] + 20 * dpr;
      const tw = Math.max(...lines.slice(0, 3).map(l => c.measureText(l).width)) / 2; if (p[0] - tw < 6 * dpr || p[0] + tw > W - 6 * dpr || p[1] < 10 * dpr || p[1] > H - 10 * dpr) { c.shadowBlur = 0; continue; }
      const th = Math.min(3, lines.length) * size * 1.15 / 2, bx = [p[0] - tw - 3 * dpr, p[1] - th, p[0] + tw + 3 * dpr, p[1] + th];
      if (taken.some(b => bx[0] < b[2] && bx[2] > b[0] && bx[1] < b[3] && bx[3] > b[1])) { c.shadowBlur = 0; continue; } taken.push(bx);
      lines.slice(0, 3).forEach((ln, i) => c.fillText(ln, p[0], p[1] + (i - (Math.min(3, lines.length) - 1) / 2) * size * 1.15)); c.shadowBlur = 0; }
    // you: a bright chevron with a soft view cone (dim when you are on another floor than the one shown)
    { const p = P(st.x, st.z), a = st.yaw - V.yaw, other = st.f !== V.f; c.save(); c.translate(p[0], p[1] + (other ? (V.f - st.f) * 7 * dpr : 0)); c.rotate(a); c.globalAlpha = other ? 0.3 : 1;
      const cone = c.createRadialGradient(0, 0, 0, 0, 0, 34 * dpr); cone.addColorStop(0, 'rgba(120,210,255,.32)'); cone.addColorStop(1, 'rgba(120,210,255,0)');
      c.fillStyle = cone; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 34 * dpr, -Math.PI / 2 - 0.55, -Math.PI / 2 + 0.55); c.closePath(); c.fill();
      const pulse = 0.75 + 0.25 * Math.sin((now - t0) / 260); c.shadowColor = 'rgba(120,220,255,1)'; c.shadowBlur = 10 * dpr * pulse; c.fillStyle = '#EAF8FF';
      c.beginPath(); c.moveTo(0, -7 * dpr); c.lineTo(5 * dpr, 5 * dpr); c.lineTo(0, 2.5 * dpr); c.lineTo(-5 * dpr, 5 * dpr); c.closePath(); c.fill(); c.restore(); c.shadowBlur = 0; }
    c.restore();
    // the frame: thin edge, corner brackets; which floor, in the corner and as a stack at the side (the one shown lit)
    c.strokeStyle = 'rgba(110,200,255,.45)'; c.lineWidth = 1 * dpr; c.strokeRect(.5 * dpr, .5 * dpr, W - dpr, H - dpr);
    c.strokeStyle = 'rgba(170,230,255,.95)'; c.lineWidth = 2 * dpr; const L = 14 * dpr;
    for (const [x, y, dx, dy] of [[0, 0, 1, 1], [W, 0, -1, 1], [0, H, 1, -1], [W, H, -1, -1]]) { c.beginPath(); c.moveTo(x + dx * dpr, y + dy * L); c.lineTo(x + dx * dpr, y + dy * dpr); c.lineTo(x + dx * L, y + dy * dpr); c.stroke(); }
    if (!V.full) { c.textAlign = 'left'; c.textBaseline = 'top'; c.font = `700 ${10 * dpr}px Inter, sans-serif`; c.fillStyle = 'rgba(205,240,255,.95)'; c.shadowColor = 'rgba(40,150,255,.9)'; c.shadowBlur = 5 * dpr;
      c.fillText(`FLOOR ${V.f}`, 10 * dpr, 9 * dpr); c.shadowBlur = 0;
      FLOORS.slice().reverse().forEach((f, i) => { const y = 10 * dpr + i * 9 * dpr, on = f === V.f; c.fillStyle = on ? 'rgba(170,230,255,.95)' : 'rgba(110,170,230,.25)';
        if (on) { c.shadowColor = 'rgba(60,170,255,1)'; c.shadowBlur = 6 * dpr; } c.fillRect(W - 30 * dpr, y, 20 * dpr, 4 * dpr); c.shadowBlur = 0; });
      if (dest && routeLen > 0) { c.textAlign = 'left'; c.textBaseline = 'bottom'; c.font = `700 ${9.5 * dpr}px Inter, sans-serif`; c.fillStyle = '#FFD58A'; c.shadowColor = 'rgba(255,170,60,.9)'; c.shadowBlur = 5 * dpr;
        c.fillText(`${dest.name} · ${Math.round(routeLen)} m`, 10 * dpr, H - 8 * dpr); c.shadowBlur = 0; } }
  };

  // ---------- the full-screen map: pan, zoom, pick a floor, tap where you want to go ----------
  let full: HTMLDivElement | null = null, fv: View | null = null;
  const openFull = () => {
    if (full) return; const st = get(); if (!st) return;
    try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* no lock */ }
    full = document.createElement('div'); full.className = 'hm-full';
    full.innerHTML = `<canvas></canvas><div class="hm-bar"><b>Terminal navigation<small>Tap where you want to go. Drag to move the map${IS_TOUCH ? ', pinch' : ', scroll'} to zoom.</small></b>
      ${FLOORS.slice().reverse().map(f => `<button data-fl="${f}">Floor ${f}</button>`).join('')}<button data-me>Centre on me</button><button class="warm" data-clear ${dest ? '' : 'hidden'}>✕ Remove waypoint</button></div>
      <button class="hm-min" data-min title="Minimise">▾ Minimise</button>`;
    host.appendChild(full);
    fv = { cx: st.x, cz: st.z, yaw: 0, k: 0, f: st.f, full: true };
    const fc = full.querySelector('canvas') as HTMLCanvasElement;
    const fit = () => { const r = full!.getBoundingClientRect(); fv!.k = Math.min(r.width, r.height) / 150 * Math.min(2, window.devicePixelRatio || 1); };
    fit();
    const tabs = () => full!.querySelectorAll('[data-fl]').forEach(b => b.classList.toggle('on', Number(b.getAttribute('data-fl')) === fv!.f));
    tabs();
    full.addEventListener('click', e => { const b = (e.target as HTMLElement).closest('button'); if (!b) return; e.stopPropagation();
      if (b.hasAttribute('data-fl')) { fv!.f = Number(b.getAttribute('data-fl')); tabs(); }
      if (b.hasAttribute('data-me')) { const s2 = get(); if (s2) { fv!.cx = s2.x; fv!.cz = s2.z; fv!.f = s2.f; tabs(); } }
      if (b.hasAttribute('data-clear')) { setDest(null); (b as HTMLElement).hidden = true; toast('Waypoint removed'); }
      if (b.hasAttribute('data-min')) closeFull(); });
    // pan, zoom and tap
    const pts = new Map<number, { x: number; y: number }>(); let moved = 0, pinch0 = 0, k0 = 0;
    fc.addEventListener('pointerdown', e => { fc.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = 0; if (pts.size === 2) { const [a, b] = Array.from(pts.values()); pinch0 = Math.hypot(a.x - b.x, a.y - b.y); k0 = fv!.k; } });
    fc.addEventListener('pointermove', e => { const p = pts.get(e.pointerId); if (!p) return; const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (pts.size === 2) { pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); const [a, b] = Array.from(pts.values()); const d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch0 > 0) fv!.k = Math.max(0.4 * dpr, Math.min(30 * dpr, k0 * d / pinch0)); moved = 99; return; }
      const dx = e.clientX - p.x, dy = e.clientY - p.y; moved += Math.abs(dx) + Math.abs(dy); fv!.cx -= dx * dpr / fv!.k; fv!.cz += dy * dpr / fv!.k; pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); });
    const up = (e: PointerEvent) => { const had = pts.has(e.pointerId); pts.delete(e.pointerId); if (!had || moved > 8 || pts.size) return;
      // a tap: the waypoint there (on the floor shown), snapped into the nearest place you can walk
      const r = fc.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1), W = r.width * dpr, H = r.height * dpr;
      let x = fv!.cx + ((e.clientX - r.left) * dpr - W / 2) / fv!.k, z = fv!.cz - ((e.clientY - r.top) * dpr - H / 2) / fv!.k;
      const a = areaAt(fv!.f, x, z) || nearestArea(fv!.f, x, z); if (!a) return;
      x = Math.max(a.x0 + 0.8, Math.min(a.x1 - 0.8, x)); z = Math.max(a.z0 + 0.8, Math.min(a.z1 - 0.8, z));
      setDest({ x, z, f: fv!.f, name: short(a.name) }); const cb = full!.querySelector('[data-clear]') as HTMLElement; if (cb) cb.hidden = false;
      toast(`Waypoint: ${short(a.name).toLowerCase().replace(/(^|\s)\S/g, s => s.toUpperCase())}, floor ${fv!.f}`); setTimeout(closeFull, 450); };
    fc.addEventListener('pointerup', up); fc.addEventListener('pointercancel', e => pts.delete(e.pointerId));
    fc.addEventListener('wheel', e => { e.preventDefault(); const dpr = Math.min(2, window.devicePixelRatio || 1); fv!.k = Math.max(0.4 * dpr, Math.min(30 * dpr, fv!.k * Math.exp(-e.deltaY * 0.0015))); }, { passive: false });
    // the pop-up: from the corner map out to the full screen, with a hologram's flicker
    const a = box.getBoundingClientRect(), b = full.getBoundingClientRect();
    full.style.transform = `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(${a.width / b.width}, ${a.height / b.height})`; full.style.opacity = '0.4';
    requestAnimationFrame(() => requestAnimationFrame(() => { if (!full) return; full.style.transition = 'transform .42s cubic-bezier(.2,.8,.2,1), opacity .3s'; full.style.transform = ''; full.style.opacity = '1'; full.classList.add('flick'); }));
  };
  const closeFull = () => {
    const f = full; if (!f) return; full = null; fv = null;
    const a = box.getBoundingClientRect(), b = f.getBoundingClientRect(); f.classList.remove('flick');
    f.style.transition = 'transform .34s cubic-bezier(.5,0,.75,0), opacity .34s'; f.style.transform = `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(${a.width / b.width}, ${a.height / b.height})`; f.style.opacity = '0';
    setTimeout(() => f.remove(), 360);
  };
  box.addEventListener('click', e => { const b = (e.target as HTMLElement).closest('button'); if (b === xBtn) { e.stopPropagation(); setDest(null); toast('Waypoint removed'); return; } openFull(); });
  const onKey = (e: KeyboardEvent) => { if ((e.target as HTMLElement)?.closest?.('input,textarea')) return;
    if (e.key === 'm' || e.key === 'M') { if (full) closeFull(); else openFull(); } else if (e.key === 'Escape' && full) closeFull(); };
  window.addEventListener('keydown', onKey);

  const draw = () => {
    if (!box.isConnected) { dispose(); return; }
    const st = get(); if (!st) { box.style.display = 'none'; return; } box.style.display = '';
    const now = performance.now();
    // the route, kept up as you walk; arriving clears it
    if (dest) { if (st.f === dest.f && Math.hypot(st.x - dest.x, st.z - dest.z) < 2.5) { toast(`You've arrived: ${dest.name.toLowerCase().replace(/(^|\s)\S/g, s => s.toUpperCase())}`); setDest(null); }
      else if (now > routeT && !routeBusy) { routeT = now + 400; routeBusy = true; const d0 = dest;
        findRouteAsync(st, dest).then(r => { routeBusy = false; if (dest !== d0) return; route = r; routeLen = 0; if (r) for (let i = 1; i < r.length; i++) routeLen += Math.hypot(r[i].x - r[i - 1].x, r[i].z - r[i - 1].z); }); } }
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = Math.round(box.clientWidth * dpr), H = Math.round(box.clientHeight * dpr);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    render(cx, W, H, dpr, { cx: st.x, cz: st.z, yaw: st.yaw, k: W / 90, f: st.f, full: false }, st);
    if (full && fv) { const fc = full.querySelector('canvas') as HTMLCanvasElement, r = full.getBoundingClientRect(), FW = Math.round(full.clientWidth * dpr), FH = Math.round(full.clientHeight * dpr);
      if (r.width > 0 && (fc.width !== FW || fc.height !== FH)) { fc.width = FW; fc.height = FH; } render(fc.getContext('2d')!, FW, FH, dpr, fv, st); }
  };
  // out of the way of the place's own buttons: if anything else sits where the map would be, it goes below the left-hand panels
  const place = () => { if (!box.isConnected || full) return; box.style.top = ''; box.style.left = ''; box.style.right = ''; const a = box.getBoundingClientRect();
    const others = Array.from(host.querySelectorAll('button, .site-top, .tm-where')).filter(e => !box.contains(e) && !(full && full.contains(e)) && (e as HTMLElement).offsetParent) as HTMLElement[];
    const hits = (r: DOMRect) => others.some(e => { const b = e.getBoundingClientRect(); return b.width && r.left < b.right && r.right > b.left && r.top < b.bottom + 34 && r.bottom + 34 > b.top; });
    if (!hits(a)) return;
    const left = others.filter(e => e.getBoundingClientRect().left < window.innerWidth * 0.4), bottom = Math.max(14, ...left.map(e => e.getBoundingClientRect().bottom));
    box.style.right = 'auto'; box.style.left = 'max(14px, env(safe-area-inset-left))'; box.style.top = (bottom + 12) + 'px'; };
  setTimeout(place, 300); const pv = setInterval(place, 3000);
  const iv = setInterval(() => { const t = performance.now(); draw(); perfPart('map', performance.now() - t); }, LIGHT ? 100 : 50);
  function dispose() { clearInterval(iv); clearInterval(pv); window.removeEventListener('keydown', onKey); box.remove(); if (full) full.remove(); }
  return { dispose, el: box, open: openFull, close: closeFull };
}
