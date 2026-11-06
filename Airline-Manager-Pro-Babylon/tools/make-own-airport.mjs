// Writes the game's layout of your own airport (game/src/data/own-airport-layout.ts) from its plan
// (src/sections/site/airfield/plan.ts): the runway, the taxiways and links (with their curved ends), the taxilanes, the
// stands with their names, the holding positions, the aprons and the buildings, in metres east and north of the
// runway's middle (the airport's reference point). Run it again whenever the plan changes: node tools/make-own-airport.mjs
import { buildSync } from 'esbuild';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(mkdtempSync(join(tmpdir(), 'own-apt-')), 'plan.cjs');
buildSync({ entryPoints: [join(root, 'src/sections/site/airfield/plan.ts')], bundle: true, format: 'cjs', platform: 'node', outfile: out, logLevel: 'silent' });
const { AIRFIELD: AF, TERMINAL: TL } = createRequire(import.meta.url)(out);
const SITE = { lat: 63.465, lon: -18.72 };   // the site's reference point (src/sections/site/index.ts, SITES[0])
const A = AF.airport, R = AF.runway, Y = AF.ys, D2R = Math.PI / 180, s = Math.sin(A.hdg * D2R), c = Math.cos(A.hdg * D2R);
const uR = (R.x0 + R.x1) / 2 + A.planU, vR = R.y + A.planV;
const kx = 111320 * Math.cos(SITE.lat * D2R);
const lat = SITE.lat + (uR * c + vR * s) / 110540, lon = SITE.lon + (uR * s - vR * c) / kx;
const r1 = (v) => Math.round(v * 10) / 10;
/** plan (x, y) -> [east, north] of the reference point */
const EN = (x, y) => { const u = x + A.planU - uR, v = y + A.planV - vR; return [r1(u * s - v * c), r1(u * c + v * s)]; };
const hdgOf = (dx, dy) => Math.round((((A.hdg - Math.atan2(dy, dx) / D2R) % 360) + 360) % 360);   // a plan direction -> true heading
const L = { icao: A.icao, name: A.name, lat: +lat.toFixed(6), lon: +lon.toFixed(6), alt: Math.round(A.elevFt * 0.3048), magvar: A.magvar, own: true, iata: A.iata,
  runways: [{ lat: +lat.toFixed(6), lon: +lon.toFixed(6), hdg: A.hdg, len: R.x1 - R.x0, wid: R.w, surf: 4, a: R.ends[0].id, b: R.ends[1].id }],
  points: [], parks: [], paths: [], names: [''], parkNames: [], areas: [], holds: [], labels: [], source: 'sim' };
const key = {}, pt = (x, y, type = 1) => { const k = r1(x) + ',' + r1(y); if (key[k] == null) { L.points.push(EN(x, y).concat([type])); key[k] = L.points.length - 1; } return key[k]; };
const nameIdx = (n) => { if (!n) return 0; let i = L.names.indexOf(n); if (i < 0) { L.names.push(n); i = L.names.length - 1; } return i; };
const line = (type, w, pts, name) => { for (let i = 1; i < pts.length; i++) L.paths.push([type, w, pt(pts[i - 1][0], pts[i - 1][1], type === 2 ? 2 : 1), pt(pts[i][0], pts[i][1], type === 2 ? 2 : 1), nameIdx(name), 0, 0]); };
const sorted = (xs) => [...new Set(xs.map(r1))].sort((a, b) => a - b);
const XW = R.x0 + 20, XE = R.x1 - 20;
const tw = (id) => AF.taxiways.find(t => t.id === id);
// the runway, broken at every link
line(2, R.w, sorted([R.x0, R.x1, XW, XE, tw('A2').pts[0][0]]).map(x => [x, R.y]), '');
// A and B, broken where every link meets them; their curved ends into A1/A3 and B1/B3
for (const [id, y, links] of [['A', Y.AY, ['A2', 'P1', 'P2', 'P3']], ['B', Y.BY, ['B2', 'Q1', 'Q2']]]) {
  const t = tw(id); line(1, t.w, sorted([t.pts[0][0], t.pts[1][0]].concat(links.map(l => tw(l).pts[0][0]))).map(x => [x, y]), id); }
for (const k of AF.corners) { const cx = k.x + k.sx * k.r, cy = k.y + k.oy * k.r, a1 = Math.atan2(-k.oy, 0); let a2 = Math.atan2(0, -k.sx); if (a2 - a1 > Math.PI) a2 -= 2 * Math.PI; if (a2 - a1 < -Math.PI) a2 += 2 * Math.PI;
  const pts = []; for (let i = 0; i <= 6; i++) { const a = a1 + (a2 - a1) * i / 6; pts.push([cx + Math.cos(a) * k.r, cy + Math.sin(a) * k.r]); } line(1, k.w, pts, k.main); }
for (const t of AF.taxiways.filter(q => q.kind === 'link')) line(1, t.w, t.pts, t.id);
// the taxilanes, broken at every stand and link
for (const [id, y, links, cargo] of [['T', Y.TY, ['P1', 'P2', 'P3'], false], ['K', Y.KY, ['Q1', 'Q2'], true]]) { const t = tw(id);
  line(4, t.w, sorted([t.pts[0][0], t.pts[1][0]].concat(links.map(l => tw(l).pts[0][0]), AF.stands.filter(st => !!st.cargo === cargo).map(st => st.x))).map(x => [x, y]), id); }
// the stands: the nose wheel at the stop bar, the nose pointing in; joined to their taxilane
for (const st of AF.stands) { const n = st.id.replace('STAND-', ''), stop = EN(st.x, st.nose - st.dir * 5), big = st.code === 'F';
  L.parks.push([stop[0], stop[1], hdgOf(0, st.dir), big ? 26 : 18, st.cargo ? 13 : big ? 9 : st.jetway ? 8 : 3, 0, Number(n.replace(/\D/g, '')) || 0]); L.parkNames.push(n);
  L.paths.push([3, big ? 30 : 20, pt(st.x, st.cargo ? Y.KY : Y.TY), L.parks.length - 1, 0, 0, 0]); }
// the holding positions (pattern A) across their links, with the link's name
for (const h of AF.holds) { const p = EN(h.x, h.y); L.holds.push([p[0], p[1], hdgOf(1, 0), AF.CODE.twyWidth / 2 + 1]); L.labels.push([p[0], p[1], h.twy, 1]); }
// the taxiways' names beside them
for (const t of AF.taxiways) { const [a, b] = t.pts, m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; if (/^[AB]$/.test(t.id)) for (const x of [-1300, 1300]) L.labels.push(EN(x, m[1]).concat([t.id, 0])); else if (!/^[AB][123]$/.test(t.id)) L.labels.push(EN(m[0], m[1]).concat([t.id, 0])); else L.labels.push(EN(m[0], (m[1] + (t.pts[0][1] < R.y ? Y.AY : Y.BY)) / 2).concat([t.id, 0])); }
// aprons and buildings
const rect = (x0, y0, x1, y1) => [EN(x0, y0), EN(x1, y0), EN(x1, y1), EN(x0, y1)];
L.areas.push({ k: 'apron', pts: rect(-150, TL.PN, 382, Y.TY + 28) }, { k: 'apron', pts: rect(252, 54, 352, TL.PN + 1) }, { k: 'apron', pts: rect(176, Y.KY - 26, 644, AF.cargoBuilding.y0) });
for (const b of [[0, 0, 156, 52], [TL.pier[0], 52, TL.pier[1], TL.PN], TL.rental.hall, TL.rental.garage, [AF.cargoBuilding.x0, AF.cargoBuilding.y0, AF.cargoBuilding.x1, AF.cargoBuilding.y1]]) L.areas.push({ k: 'terminal', pts: rect(b[0], b[1], b[2], b[3]) });
const ends = [EN(R.x0, R.y), EN(R.x1, R.y)].map(p => [lat + p[1] / 110540, lon + p[0] / (111320 * Math.cos(lat * D2R))]);
const src = `// Your own airport's layout for the game (the airport view, the world map's drawing at airport level, the taxiing, the
// 3D viewer): written by tools/make-own-airport.mjs from the airport's plan (src/sections/site/airfield/plan.ts).
// Metres east and north of the runway's middle. Do not edit by hand: change the plan and run the tool again.
const OWN_AIRPORT_LAYOUTS: { [icao: string]: any } = { ${A.icao}: ${JSON.stringify(L)} };
/** Your own airports for the airport lists: [icao, iata, name, city, country, lon, lat, elevation ft, runway ends]. */
const OWN_AIRPORT_LIST: any[] = [${JSON.stringify([A.icao, A.iata, A.name, A.city, A.country, +lon.toFixed(6), +lat.toFixed(6), A.elevFt, { id1: R.ends[0].id, id2: R.ends[1].id, lenFt: Math.round((R.x1 - R.x0) / 0.3048), widFt: Math.round(R.w / 0.3048), e1: ends[0].map(v => +v.toFixed(6)), e2: ends[1].map(v => +v.toFixed(6)), hdg: A.hdg }])}];
`;
writeFileSync(join(root, 'game/src/data/own-airport-layout.ts'), src);
console.log(`${A.icao}: ${L.points.length} points, ${L.paths.length} paths, ${L.parks.length} stands, ${L.holds.length} holding positions, reference ${L.lat}, ${L.lon}`);
