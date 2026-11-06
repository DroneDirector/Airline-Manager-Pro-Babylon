// Builds the airport layouts that ship inside the game (no downloads while playing), for every airport in the game's
// airport list (game/www/airports-world.json, about 49,000), so new airports added to the list are covered on the next
// run. The world is fetched from OpenStreetMap once, in map tiles (5° squares that hold airports, split smaller when a
// tile is too big for the server), politely: one request at a time, a pause between, spread over the public servers.
// Each airport then takes from its tile what lies in the box round it (the same box the game used to ask for: its
// runways plus 1.2 km), kept compact: the points in millionths of a degree from the airport, each once; the ways as
// lists of points; only the tags the game reads. © OpenStreetMap contributors, ODbL.
// Usage: node fetch.mjs <shard> <shards> <out.json>
import fs from 'node:fs';
const [shard, shards, out] = [Number(process.argv[2] || 0), Number(process.argv[3] || 1), process.argv[4] || 'out.json'];
const ROOT = new URL('../../Airline-Manager-Pro-Babylon/game/www/', import.meta.url);
const AP = JSON.parse(fs.readFileSync(new URL('airports-world.json', ROOT))).airports.filter(r => /^[A-Z0-9-]{2,8}$/.test(r[0]) && isFinite(r[4]) && isFinite(r[5]));
const RW = JSON.parse(fs.readFileSync(new URL('runways-world.json', ROOT)));
const SERVERS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
const KEEP = ['aeroway', 'ref', 'name', 'width', 'surface'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const T = 5;                                                     // tile size, degrees
// each airport's box (as the game drew it)
const box = r => { const lat = r[4], lon = r[5], k = Math.max(0.05, Math.cos(lat * Math.PI / 180)); let far = 1500;
  for (const x of RW[r[0]] || []) for (const e of [[x[5], x[6]], [x[7], x[8]]]) if (e[0] != null) far = Math.max(far, Math.hypot((e[1] - lon) * 111320 * k, (e[0] - lat) * 110540));
  const R = Math.min(9000, far + 1200); return [lat - R / 110540, lon - R / (111320 * k), lat + R / 110540, lon + R / (111320 * k)]; };
// the tiles that hold airports, this shard's share
const tiles = new Map(); for (const r of AP) { const key = Math.floor(r[4] / T) + ',' + Math.floor(r[5] / T); (tiles.get(key) || tiles.set(key, []).get(key)).push(r); }
const mine = Array.from(tiles.keys()).sort().filter((k, i) => i % shards === shard);
let res = {}; try { res = JSON.parse(fs.readFileSync(out)); } catch (e) { /* fresh */ }

async function query(bb, first) {
  const q = `[out:json][timeout:180][maxsize:1073741824][bbox:${bb.map(v => v.toFixed(4)).join(',')}];(way["aeroway"~"^(runway|taxiway|taxilane|apron|parking_position|terminal)$"];node["aeroway"~"^(parking_position|gate)$"];);out body geom qt;`;
  for (let k = 0; k < SERVERS.length * 2; k++) { const url = SERVERS[(first + k) % SERVERS.length];
    try { const r = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'AirlineManagerPro-layout-build/2 (occasional build of bundled airport layouts)' }, signal: AbortSignal.timeout(240000) });
      if (r.status === 429 || r.status === 504) { await sleep(30000); continue; } if (!r.ok) { await sleep(5000); continue; }
      const d = await r.json(); if (d.remark && /timed out|runtime error|out of memory/i.test(d.remark)) return 'big'; return d.elements || []; }
    catch (e) { await sleep(5000); } }
  return null; }
/** A tile's elements; too big for the server: its four quarters (down to 0.625°). */
async function fetchTile(bb, depth) {
  const els = await query(bb, shard); await sleep(2000);
  if (Array.isArray(els)) return els;
  if (depth >= 3) return els === 'big' ? [] : null;
  const [s, w, n, e] = bb, ms = (s + n) / 2, me = (w + e) / 2, all = [];
  for (const q of [[s, w, ms, me], [s, me, ms, e], [ms, w, n, me], [ms, me, n, e]]) { const part = await fetchTile(q, depth + 1); if (part == null) return null; all.push(...part); }
  return all; }
function compact(lat0, lon0, els) {
  const idx = new Map(), c = []; const node = (id, lat, lon) => { let i = idx.get(id); if (i == null) { i = c.length / 2; idx.set(id, i); c.push(Math.round((lat - lat0) * 1e6), Math.round((lon - lon0) * 1e6)); } return i; };
  const tags = t => { const o = {}; for (const k of KEEP) if (t && t[k] != null) o[k] = t[k]; return o; };
  const w = [], n = [];
  for (const e of els) {
    if (e.type === 'way' && e.geometry && e.nodes && e.geometry.length === e.nodes.length) w.push([tags(e.tags), e.nodes.map((id, j) => node(id, e.geometry[j].lat, e.geometry[j].lon))]);
    else if (e.type === 'node' && e.tags) n.push([node(e.id, e.lat, e.lon), tags(e.tags)]);
  }
  return w.length || n.length ? { c, w, n } : null; }

let done = 0; const t0 = Date.now();
for (const key of mine) {
  const list = tiles.get(key); if (list.every(r => r[0] in res)) { done++; continue; }
  const [ty, tx] = key.split(',').map(Number), M = 0.12;           // a margin, so boxes reaching over the edge are whole
  const els = await fetchTile([ty * T - M, tx * T - M, ty * T + T + M, tx * T + T + M], 0);
  if (els == null) { console.log('tile', key, 'not answered; next run'); done++; continue; }
  // a quick index: each way's and node's extent
  const items = els.map(e => { if (e.type === 'node') return { e, s: e.lat, w: e.lon, n: e.lat, x: e.lon };
    let s = 90, w = 180, n = -90, x = -180; for (const g of e.geometry || []) { s = Math.min(s, g.lat); n = Math.max(n, g.lat); w = Math.min(w, g.lon); x = Math.max(x, g.lon); } return { e, s, w, n, x }; });
  for (const r of list) { const b = box(r); const near = items.filter(i => i.n >= b[0] && i.s <= b[2] && i.x >= b[1] && i.w <= b[3]).map(i => i.e); res[r[0]] = near.length ? compact(r[4], r[5], near) : null; }
  done++; fs.writeFileSync(out, JSON.stringify(res));
  console.log(`${Math.round(done / mine.length * 100)}% tile ${done}/${mine.length} (${key}, ${els.length} elements, ${list.length} airports) ${Math.round((Date.now() - t0) / 60000)} min`);
}
fs.writeFileSync(out, JSON.stringify(res)); console.log('100%', Object.keys(res).length, 'airports');
