// Joins the shards into the packs the game loads: game/www/layouts/<first two letters of the code>.json.
// An airport whose tile no server answered this time keeps its layout from the last build (oldDir), if any.
import fs from 'node:fs';
const [dir, outDir, oldDir] = [process.argv[2], process.argv[3], process.argv[4]];
const all = {}; for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) Object.assign(all, JSON.parse(fs.readFileSync(dir + '/' + f)));
let kept = 0;
if (oldDir && fs.existsSync(oldDir)) for (const f of fs.readdirSync(oldDir).filter(f => /^[A-Z0-9-]{1,2}\.json$/.test(f))) { const old = JSON.parse(fs.readFileSync(oldDir + '/' + f)); for (const [k, v] of Object.entries(old)) if (!(k in all)) { all[k] = v; kept++; } }
fs.rmSync(outDir, { recursive: true, force: true }); fs.mkdirSync(outDir, { recursive: true }); const packs = {};
for (const [icao, v] of Object.entries(all)) { if (!v) continue; const p = icao.slice(0, 2); (packs[p] = packs[p] || {})[icao] = v; }
let bytes = 0; for (const [p, v] of Object.entries(packs)) { const s = JSON.stringify(v); bytes += s.length; fs.writeFileSync(`${outDir}/${p}.json`, s); }
fs.writeFileSync(`${outDir}/README.md`, '# Airport layouts\n\nRunways, taxiways, aprons, terminals and stands of the airports, from OpenStreetMap: © OpenStreetMap contributors, available under the Open Database License (ODbL 1.0, https://opendatacommons.org/licenses/odbl/). This database is made available under the ODbL.\n');
console.log(Object.keys(all).length, 'airports answered,', Object.values(all).filter(Boolean).length, 'with a layout,', kept, 'kept from the last build;', Object.keys(packs).length, 'packs,', (bytes / 1e6).toFixed(1), 'MB');
