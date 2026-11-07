// The terminal's fittings, each its own object with its id: the timetable screens (departures and arrivals walls,
// totems, pairs, gate screens), the stairs between the floors (S-01, S-STAFF, S-G1–4) with their glass balustrades and
// the openings round them on Floor 2, the lifts (E-01, E-G1–4), the museum (the Vortex Gallery) in F1-MUSEUM with its
// entrance on the Grand Hall, an airliner on each stand and the jetways J-1 to J-4 from gates 1–4.
import { MeshBuilder, Mesh, Vector3, TransformNode, PointLight, SpotLight, Light } from '@babylonjs/core';
import { Kit, P, signC } from './kit';
import { buildLifts, LiftCtl } from './lifts';
import { SCREENS, STAIRS, LIFTS, STANDS, MOD, F2Y, F2CEIL, Stair, PN } from './plan';
import { buildMuseum, Museum, Exhibit } from '../building/museum';
import { buildAirliner, repaint, setGear, Airliner } from '../viewer3d/airliner';
import { IS_PC } from '../../core/app';
import { buildJetway } from './jetway';
import { makeFids } from './fids';

export interface Fixtures { museum: Museum | null; museumDoor: { k: number; base: Vector3[] }; aircraft: Airliner[]; lifts: LiftCtl[]; jetways: any[] }

export function buildFixtures(K: Kit, c1: string, c2: string, airline: string, progress: (p: number, s: string) => void): Fixtures {
  const { sc, M } = K;
  progress(62, 'Switching on the timetable screens…');
  // ---- the screens: one departures and one arrivals picture shared by all, the gate screens each their own ----
  // the real timetable from the game (sample flights when the game isn't running), one picture per kind and shape of screen
  const fids = makeFids(sc, 'BIAP'), F = (k: 'dep' | 'arr', sh: 'wall' | 'totem' | 'wide') => fids.get(k, sh);
  for (const s of SCREENS) {
    const y = (s.f === 2 ? F2Y : 0) + s.y, o = K.obj(s.room, 'SCREEN', s.x, y, s.z, s.face, s.id); o.metadata.kind = 'screen'; o.metadata.screen = s.kind;
    const face = (w: number, h: number, m: any, ox = 0, oy = 0, back = false) => { const p = MeshBuilder.CreatePlane(K.nm('scr'), { width: w, height: h }, sc); p.material = m; p.parent = o; p.position.set(ox, oy, back ? 0.07 : -0.05); p.rotation.y = back ? 0 : Math.PI; p.metadata = o.metadata; return p; };
    if (s.kind === 'departures wall' || s.kind === 'arrivals wall') { K.box(o, 5.2, 2.0, 0.12, M.screenBlack, 0, 0, 0); face(5, 1.82, F(s.kind === 'arrivals wall' ? 'arr' : 'dep', 'wall')); }
    else if (s.kind === 'departures totem' || s.kind === 'arrivals totem') { // a little wider than before (its stand too), so the timetable's columns fit in large type
      K.box(o, 1.95, 2.6, 0.32, M.screenBlack, 0, 1.6, 0); K.box(o, 1.25, 0.3, 0.5, M.black, 0, 0.15, 0); const m = F(s.kind === 'arrivals totem' ? 'arr' : 'dep', 'totem');
      const f1 = face(1.75, 1.3, m, 0, 1.75); f1.position.z = -0.17; const f2 = face(1.75, 1.3, m, 0, 1.75, true); f2.position.z = 0.17; K.circle(s.f, s.x, s.z, 1.0); }
    else if (s.kind === 'departures pair') { for (const [k, m] of [[-1, F('dep', 'wide')], [1, F('arr', 'wide')]] as [number, any][]) { K.box(o, 1.7, 0.98, 0.08, M.screenBlack, k * 0.9, 0, 0); face(1.6, 0.9, m, k * 0.9, 0); } }
    else if (s.kind === 'departures') { K.box(o, 2.1, 1.22, 0.08, M.screenBlack, 0, 0, 0); face(2.0, 1.12, F('dep', 'wide')); }
    else { const g = s.id.replace(/^M-F\d-G/, ''), [c, x] = P.canvas(512, 288); x.fillStyle = '#0B1A33'; x.fillRect(0, 0, 512, 288); x.fillStyle = '#F2C230'; x.fillRect(0, 0, 512, 64); x.fillStyle = '#14202E'; x.font = '700 44px Arial, sans-serif'; x.fillText(`GATE ${g}`, 20, 48);
      x.fillStyle = '#FFFFFF'; x.font = '700 40px Arial, sans-serif'; x.fillText(['AM 210 · Copenhagen', 'AM 344 · London', 'AM 118 · Oslo', 'AM 512 · Reykjavik', 'AM 230 · Amsterdam', 'AM 610 · Barcelona', 'AM 402 · Frankfurt', 'AM 120 · Vágar'][(+g - 1) % 8], 20, 130);
      x.fillStyle = '#3BD16F'; x.font = '700 36px Arial, sans-serif'; x.fillText(+g % 3 === 0 ? 'Boarding' : 'Gate open', 20, 200); x.fillStyle = '#8FA6BD'; x.font = '500 28px Arial, sans-serif'; x.fillText('Scheduled ' + ['06:40', '07:35', '07:20', '07:55', '08:10', '08:35', '09:00', '09:25'][(+g - 1) % 8], 20, 254);
      K.box(o, 1.7, 0.98, 0.08, M.screenBlack, 0, 0, 0); face(1.6, 0.9, K.picture(c, 1)); }
  }
  progress(68, 'Building the stairs…');
  // ---- the stairs: steps up the run, glass sides with handrails; the opening on Floor 2 has a glass balustrade ----
  for (const s of STAIRS) {
    const o = K.obj(s.from, 'STAIRS', 0, 0, 0, 0, s.id); o.metadata.kind = 'stairs'; const n = 34, run = s.dir[0] === 'x' ? s.x1 - s.x0 : s.z1 - s.z0, wid = s.dir[0] === 'x' ? s.z1 - s.z0 : s.x1 - s.x0;
    const at = (t: number, lat: number): [number, number] => { const u = s.dir[1] === '+' ? t : 1 - t; return s.dir[0] === 'x' ? [s.x0 + u * run, s.z0 + lat] : [s.x0 + lat, s.z0 + u * run]; };
    for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, [x, z] = at(t, wid / 2), y = F2Y * (i + 1) / n, h = 0.25 + (i ? 0.1 : 0);
      K.box(o, s.dir[0] === 'x' ? run / n + 0.01 : wid, h, s.dir[0] === 'x' ? wid : run / n + 0.01, i % 2 ? M.oak : M.walnut, x, y - h / 2, z); K.box(o, s.dir[0] === 'x' ? 0.04 : wid, 0.01, s.dir[0] === 'x' ? wid : 0.04, M.light, ...shiftNose(s, x, y, z, run / n)); }
    // the glass sides and handrails, drawn straight along the slope (bottom to top)
    for (const lat of [0.06, wid - 0.06]) { const [xa, za] = at(0, lat), [xb, zb] = at(1, lat);
      const g = MeshBuilder.CreateRibbon(K.nm('bal'), { pathArray: [[new Vector3(xa, 0.1, za), new Vector3(xb, F2Y + 0.1, zb)], [new Vector3(xa, 1.05, za), new Vector3(xb, F2Y + 1.05, zb)]], sideOrientation: Mesh.DOUBLESIDE }, sc); g.material = M.glass; g.parent = o; g.metadata = o.metadata;
      const rl = MeshBuilder.CreateTube(K.nm('rail'), { path: [new Vector3(xa, 1.07, za), new Vector3(xb, F2Y + 1.07, zb)], radius: 0.03, tessellation: 8 }, sc); rl.material = M.chrome; rl.parent = o; rl.metadata = o.metadata; }
    // the opening's balustrade on Floor 2 (not at the top of the stairs, where you step off)
    const top = s.dir === 'x+' ? 'e' : s.dir === 'x-' ? 'w' : s.dir === 'z+' ? 'n' : 's';
    for (const side of ['n', 's', 'e', 'w']) { if (side === top) continue; const ax = side === 'n' || side === 's', line = side === 'n' ? s.z1 : side === 's' ? s.z0 : side === 'e' ? s.x1 : s.x0, a = ax ? s.x0 : s.z0, b = ax ? s.x1 : s.z1;
      K.box(o, ax ? b - a : 0.04, 1.05, ax ? 0.04 : b - a, M.glass, ax ? (a + b) / 2 : line, F2Y + 0.53, ax ? line : (a + b) / 2); K.box(o, ax ? b - a : 0.07, 0.05, ax ? 0.07 : b - a, M.chrome, ax ? (a + b) / 2 : line, F2Y + 1.07, ax ? line : (a + b) / 2); }
    void Mesh;
  }
  // ---- the lifts: each in its shaft through both floors, the car riding inside it, the doors on each floor ----
  const lifts = buildLifts(K, signC);
  progress(72, 'Opening the museum…');
  // ---- the museum: the Vortex Gallery, its entrance on the Grand Hall's west wall (door D-F1-MUSEUM-1) ----
  let museum: Museum | null = null; const museumDoor = { k: 0, base: [] as Vector3[] };
  try {
    const items: Exhibit[] = [{ title: 'Airline of the Year', sub: 'Gold trophy', kind: 'trophy' }, { title: 'Your first aircraft', sub: 'Model, 1:200', kind: 'model' }, { title: 'Safety award', sub: 'Medal', kind: 'medal' },
      { title: 'Best regional airline', sub: 'Silver trophy', kind: 'trophy' }, { title: 'Founding certificate', sub: 'Framed', kind: 'cert', color: '#8A6A2A', lines: ['Certificate', airline, 'Air operator', 'founded'] }, { title: 'Ten thousand flights', sub: 'Badge', kind: 'badge', tier: 3 },
      { title: 'Fleet model', sub: 'Model, 1:400', kind: 'model' }, { title: 'Crew of the year', sub: 'Plaque', kind: 'plaque', lines: ['Crew', 'of the year'] }, { title: 'A gift from Tórshavn', sub: 'Vase', kind: 'vase', color: '#2E6AA8' }];
    const l0 = sc.lights.length;
    museum = buildMuseum(sc, items, c1, c2, airline);
    museum.root.parent = K.rooms['F1-MUSEUM']; museum.root.position.set(26, 0, 15); museum.root.rotation.y = Math.PI / 2;
    // its lights light only the museum
    const mm = museum.root.getChildMeshes(); for (const L of sc.lights.slice(l0) as Light[]) { L.includedOnlyMeshes = mm; if (L instanceof PointLight || L instanceof SpotLight) L.range = Math.min(L.range || 26, 26); }
    for (const d of museum.doors) d.metadata = { id: 'D-F1-MUSEUM-1', kind: 'door', room: 'F1-MUSEUM', act: 'museumdoor' };
    museumDoor.base = museum.doorBase.map(v => v.clone());
    K.casters.push(...museum.casters); K.metals.push(...museum.metals);
  } catch (e) { console.error(e); museum = null; }
  progress(78, 'Parking the aircraft…');
  // ---- an airliner on each stand (in your colours, and others), the jetways from gates 1–4 ----
  const aircraft: Airliner[] = [], liveries: [string, string][] = [[c1, c2], ['#B3261E', '#F2F4F7'], ['#1C3A8A', '#3FD3E6'], [c1, c2], ['#2E7D32', '#F2C230'], ['#1C2D52', '#E8A33D'], [c1, c2], ['#6A3FA0', '#F2F4F7']];
  const standList = IS_PC ? STANDS : STANDS.filter(s => s.kind === 'jetway');
  standList.forEach((s, i) => {
    try { const ac = buildAirliner(sc); repaint(ac, liveries[i % liveries.length][0], liveries[i % liveries.length][1]); setGear(ac, 1);
      const holder = K.obj('APRON', 'AIRCRAFT', s.x, 3.9, s.nz + 18.8, Math.PI, `${s.id}/AIRCRAFT`); ac.root.parent = holder; for (const m of [...ac.strobes, ...ac.beacons]) m.setEnabled(false);
      aircraft.push(ac); K.casters.push(...ac.casters); K.metals.push(...ac.paint);
      K.block(1, s.x - 2.3, s.nz, s.x + 2.3, s.nz + 37.6); K.block(1, s.x - 18, s.nz + 15, s.x + 18, s.nz + 22); K.block(1, s.x - 6.5, s.nz + 32, s.x + 6.5, s.nz + 37);
    } catch (e) { console.error(e); }
  });
  // the jetways J-1 to J-4 from the gates' jetway doors (x0 + 22, on the gate floor) to the front doors at stands 1-4
  for (let k = 0; k < 4; k++) buildJetway(K, k + 1, MOD[k] + 22, STANDS[k * 2]);
  return { museum, museumDoor, aircraft, lifts, jetways: (K as any).jetways || [] };
}
/** Where a step's light strip goes (its front edge). */
function shiftNose(s: Stair, x: number, y: number, z: number, d: number): [number, number, number] {
  const k = d / 2; if (s.dir === 'x+') return [x - k, y + 0.005, z]; if (s.dir === 'x-') return [x + k, y + 0.005, z]; if (s.dir === 'z+') return [x, y + 0.005, z - k]; return [x, y + 0.005, z + k];
}
