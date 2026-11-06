// Joins the shards into the packs the game loads: game/www/layouts/<first two letters of the code>.json.
import fs from 'node:fs';
const [dir, outDir] = [process.argv[2], process.argv[3]];
const all = {}; for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) Object.assign(all, JSON.parse(fs.readFileSync(dir + '/' + f)));
fs.mkdirSync(outDir, { recursive: true }); const packs = {};
for (const [icao, v] of Object.entries(all)) { if (!v || v === 'busy') continue; const p = icao.slice(0, 2); (packs[p] = packs[p] || {})[icao] = v; }
let bytes = 0; for (const [p, v] of Object.entries(packs)) { const s = JSON.stringify(v); bytes += s.length; fs.writeFileSync(`${outDir}/${p}.json`, s); }
fs.writeFileSync(`${outDir}/index.json`, JSON.stringify(Object.keys(all).filter(k => all[k] && all[k] !== 'busy').sort()));
fs.writeFileSync(`${outDir}/README.md`, '# Airport layouts\n\nRunways, taxiways, aprons, terminals and stands of the airports, from OpenStreetMap: © OpenStreetMap contributors, available under the Open Database License (ODbL 1.0, https://opendatacommons.org/licenses/odbl/). This database is made available under the ODbL.\n');
console.log(Object.keys(packs).length, 'packs', (bytes / 1e6).toFixed(1), 'MB');
