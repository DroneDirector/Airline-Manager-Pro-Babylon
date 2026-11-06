// One-off build of the airport layouts that ship inside the game (no downloads while playing).
// For each airport with scheduled service or an airline code (about 10,800), the same OpenStreetMap query the game
// used to send (runways, taxiways, taxilanes, aprons, terminals, stands, gates in a box round the airport) is sent
// once, politely (one at a time, a pause between, spread over the public servers), and kept in a compact form:
// the coordinates in millionths of a degree from the airport, each node once, the ways as lists of nodes, and only
// the tags the game reads. © OpenStreetMap contributors, ODbL.
// Usage: node fetch.mjs <shard> <shards> <out.json>
import fs from 'node:fs';
const [shard, shards, out] = [Number(process.argv[2] || 0), Number(process.argv[3] || 1), process.argv[4] || 'out.json'];
const ROOT = new URL('../../Airline-Manager-Pro-Babylon/game/www/', import.meta.url);
const AP = JSON.parse(fs.readFileSync(new URL('airports-world.json', ROOT))).airports;
const RW = JSON.parse(fs.readFileSync(new URL('runways-world.json', ROOT)));
const SERVERS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
const KEEP = ['aeroway', 'ref', 'name', 'width', 'surface'];
const list = AP.filter(r => (r[7] >= 1 || r[8]) && /^[A-Z0-9]{3,4}$/.test(r[0])).sort((a, b) => a[0] < b[0] ? -1 : 1).filter((r, i) => i % shards === shard);
const sleep = ms => new Promise(r => setTimeout(r, ms));
let res = {}; try { res = JSON.parse(fs.readFileSync(out)); } catch (e) { /* fresh */ }
async function query(q, first) {
  for (let round = 0; round < 3; round++) for (let k = 0; k < SERVERS.length; k++) { const url = SERVERS[(first + k) % SERVERS.length];
    try { const r = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'AirlineManagerPro-layout-build/1 (one-off build of bundled airport layouts)' }, signal: AbortSignal.timeout(90000) });
      if (r.status === 429 || r.status === 504) { await sleep(20000); continue; } if (!r.ok) continue;
      const d = await r.json(); if (d.remark && /timed out|runtime error|out of memory/i.test(d.remark) && !(d.elements || []).length) continue; return d; } catch (e) { /* the next server */ } await sleep(3000); }
  return null; }
function compact(lat0, lon0, els) {
  const idx = new Map(), c = []; const node = (id, lat, lon) => { let i = idx.get(id); if (i == null) { i = c.length / 2; idx.set(id, i); c.push(Math.round((lat - lat0) * 1e6), Math.round((lon - lon0) * 1e6)); } return i; };
  const tags = t => { const o = {}; for (const k of KEEP) if (t && t[k] != null) o[k] = t[k]; return o; };
  const w = [], n = [];
  for (const e of els) {
    if (e.type === 'way' && e.geometry && e.nodes && e.geometry.length === e.nodes.length) w.push([tags(e.tags), e.nodes.map((id, j) => node(id, e.geometry[j].lat, e.geometry[j].lon))]);
    else if (e.type === 'node' && e.tags) n.push([node(e.id, e.lat, e.lon), tags(e.tags)]);
  }
  return w.length || n.length ? { c, w, n } : null; }
let done = 0, t0 = Date.now();
for (const r of list) {
  const icao = r[0]; if (icao in res) { done++; continue; }
  const lat = r[4], lon = r[5], k = Math.cos(lat * Math.PI / 180); let far = 1500;
  for (const x of RW[icao] || []) for (const e of [[x[5], x[6]], [x[7], x[8]]]) if (e[0] != null) far = Math.max(far, Math.hypot((e[1] - lon) * 111320 * k, (e[0] - lat) * 110540));
  const R = Math.min(9000, far + 1200), dLat = R / 110540, dLon = R / (111320 * k);
  const bb = [lat - dLat, lon - dLon, lat + dLat, lon + dLon].map(v => v.toFixed(5)).join(',');
  const q = `[out:json][timeout:60][bbox:${bb}];(way["aeroway"~"^(runway|taxiway|taxilane|apron|parking_position|terminal)$"];node["aeroway"~"^(parking_position|gate)$"];);out body geom qt;`;
  const d = await query(q, shard);
  res[icao] = d ? compact(lat, lon, d.elements || []) : 'busy';
  done++; if (done % 25 === 0) { fs.writeFileSync(out, JSON.stringify(res)); const pc = Math.round(done / list.length * 100); console.log(`${pc}% ${done}/${list.length} ${Math.round((Date.now() - t0) / 60000)} min`); }
  await sleep(1200);
}
// a second pass for the ones no server answered
for (const icao of Object.keys(res).filter(k => res[k] === 'busy')) { delete res[icao]; }
fs.writeFileSync(out, JSON.stringify(res)); console.log('100%', Object.keys(res).length, 'airports');
