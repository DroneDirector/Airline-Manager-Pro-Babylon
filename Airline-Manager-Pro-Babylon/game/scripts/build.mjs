// Builds the web app into www/.
//  1. Reads app.config.json and writes src/generated/config.ts + the page title.
//  2. Compiles all TypeScript into one plain script (www/app.js) so the same
//     output runs in Android, a Windows wrapper and the MSFS toolbar panel.
//  3. With --preview, also writes dist/preview.html: one self-contained file.
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(readFileSync(join(root, 'app.config.json'), 'utf8'));

// "What's new" in the app: the three newest release notes (release-notes/<version>.md) up to this version.
// The lines about the download files are left out; headings and points are kept.
const verNum = v => v.split('.').map(Number);
const cmpVer = (a, b) => { const x = verNum(a), y = verNum(b); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); return 0; };
const notesDir = join(root, 'release-notes');
const inline = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');
const whatsNew = (existsSync(notesDir) ? readdirSync(notesDir) : [])
  .filter(f => /^\d+\.\d+\.\d+\.md$/.test(f)).map(f => f.slice(0, -3))
  .filter(v => cmpVer(v, cfg.version) <= 0).sort((a, b) => cmpVer(b, a)).slice(0, 3)
  .map(v => {
    const lines = readFileSync(join(notesDir, v + '.md'), 'utf8').split(/\r?\n/);
    let title = '', groups = [], cur = null;
    for (const raw of lines) {
      const l = raw.trim(); if (!l) continue;
      const head = /^\*\*([^*]+)\*\*$/.exec(l);
      if (head && !title && /\d+\.\d+\.\d+/.test(head[1])) { title = head[1].replace(/^.*?\d+\.\d+\.\d+\s*[:–-]?\s*/, ''); continue; }
      if (head) { cur = { h: head[1], items: [] }; groups.push(cur); continue; }
      if (/\.(apk|zip)\b/i.test(l) && !cur) continue; // the download files
      const item = l.replace(/^[-*]\s+/, '');
      if (!cur) { cur = { h: '', items: [] }; groups.push(cur); }
      cur.items.push(inline(item));
    }
    return { v, title, groups: groups.filter(g => g.items.length) };
  });

mkdirSync(join(root, 'src/generated'), { recursive: true });
writeFileSync(
  join(root, 'src/generated/config.ts'),
  `// Generated from app.config.json and release-notes/. Do not edit by hand.\nconst APP = ${JSON.stringify({
    name: cfg.appName, shortName: cfg.shortName, id: cfg.appId, version: cfg.version, updates: cfg.updates || null, online: cfg.online || null, services: cfg.services || {},
  }, null, 2)};\nconst WHATS_NEW: { v: string; title: string; groups: { h: string; items: string[] }[] }[] = ${JSON.stringify(whatsNew)};\n`
);

// Capacitor (Android wrapper) settings come from the same config
writeFileSync(join(root, 'capacitor.config.json'), JSON.stringify({
  appId: cfg.appId, appName: cfg.appName, webDir: 'www',
  // allowMixedContent lets the app open ws:// links to the PC on the local network without
  // changing the app's https://localhost origin, so saved airlines are kept.
  android: { backgroundColor: '#06111F', allowMixedContent: true },
  server: { cleartext: true },
  plugins: { SplashScreen: { launchShowDuration: 0 } },
}, null, 2) + '\n');

// Map library for the optional street and satellite maps (BSD-3-Clause)
const ml = join(root, 'node_modules/maplibre-gl/dist');
if (existsSync(ml)) {
  mkdirSync(join(root, 'www/vendor'), { recursive: true });
  for (const f of ['maplibre-gl.js', 'maplibre-gl.css']) copyFileSync(join(ml, f), join(root, 'www/vendor', f));
}

// the 3D places are the Babylon.js edition's own (the edition's src/sections): no other 3D library here
mkdirSync(join(root, 'www/vendor'), { recursive: true });
const three = '';
// replaceable sounds: the files in www/sounds and the guide with every name the game looks for (src/core/sfx.ts)
{
  const dir = join(root, 'www/sounds'); mkdirSync(dir, { recursive: true });
  const files = readdirSync(dir).filter(f => /\.(ogg|mp3|wav|m4a)$/i.test(f)).sort();
  writeFileSync(join(dir, 'index.json'), JSON.stringify({ files }, null, 1));
  const src = readFileSync(join(root, 'src/core/sfx.ts'), 'utf8'), names = [...src.slice(src.indexOf('const SFX_NAMES')).split('];')[0].matchAll(/\['([^']+)', '((?:[^'\\]|\\.)*)'\]/g)].map(m => [m[1], m[2].replace(/\\'/g, "'")]);
  const have = n => files.some(f => f.replace(/\.[a-z0-9]+$/i, '') === n) ? ' (in use)' : '';
  writeFileSync(join(dir, 'README.md'), ['# Replaceable sounds', '',
    'Put a sound file with one of these names in this folder (`.ogg`, `.mp3`, `.wav` or `.m4a`) and build the app: the game',
    'plays it instead of making that sound itself. Remove it and the game\'s own sound comes back. This list is written by',
    'the build. Short, clean recordings work best; the game sets their volume (footsteps by how fast you walk).',
    'Licences of sounds you use must allow commercial sale (CC0 is simplest).', '', '| File | Sound |', '|---|---|',
    ...names.map(([n, d]) => `| \`${n}.ogg\`${have(n)} | ${d} |`), ''].join('\n'));
  if (files.length) console.log(`Sounds from files: ${files.length} (${files.join(', ')})`);
}
// replaceable models: the list of the .glb files in www/models (see www/models/README.md)
{
  const dir = join(root, 'www/models'), files = [];
  const walk = (d, rel) => { if (!existsSync(d)) return; for (const f of readdirSync(d, { withFileTypes: true })) { if (f.isDirectory()) walk(join(d, f.name), rel + f.name + '/'); else if (/\.(glb|png|jpe?g|webp)$/i.test(f.name)) files.push(rel + f.name); } };
  walk(dir, '');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.json'), JSON.stringify({ files: files.sort() }, null, 1));
  if (files.length) console.log(`Models from files: ${files.length} (${files.join(', ')})`);
  // the guide with every file name the app looks for (from the aircraft list and the vehicle, jet bridge and people
  // slots in src/graphics/models.ts), written on every build so a new aircraft type appears in it straight away
  const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const acSrc = readFileSync(join(root, 'src/data/aircraft.ts'), 'utf8'), ac = [], seen = {};
  const helis = [];
  for (const m of acSrc.matchAll(/\{ id: '([^']+)', maker: '([^']+)', model: '([^']+)'[^\n]*/g)) {
    if (/cls: 'helicopter'/.test(m[0])) { { const hm = slug(m[2].replace(/ Helicopters?$/i, '')), hd = slug(m[3]); helis.push([`helicopter-${hd.startsWith(hm + '-') ? hd : hm + '-' + hd}.glb`, `${m[2]} ${m[3]}`]); } continue; }
    const mk = slug(m[2]), md = slug(m[3]), f = (md.startsWith(mk + '-') ? md : mk + '-' + md) + '.glb';
    if (seen[f]) { seen[f].push(m[1]); continue; } seen[f] = [m[1]]; ac.push([f, `${m[2]} ${m[3]}`]);
  }
  const mSrc = readFileSync(join(root, 'src/graphics/models.ts'), 'utf8');
  const pairs = name => { const b = mSrc.slice(mSrc.indexOf('const ' + name)); return [...b.slice(0, b.indexOf('];') + 2).matchAll(/\['([^']+)', '([^']+)'\]/g)].map(x => [x[1], x[2]]); };
  const veh = pairs('VEHICLE_FILES'), jw = pairs('JETWAY_FILES'), ppl = pairs('PEOPLE_GROUPS'), itm = pairs('ITEM_FILES'), hgr = pairs('HANGAR_FILES'), hpr = pairs('HANGAR_PROP_FILES'), lpr = pairs('LOUNGE_PROP_FILES'), tpr = pairs('TRAINING_PROP_FILES'), spr = pairs('SECURITY_PROP_FILES'), sup = pairs('SUITE_PROP_FILES'), shp = pairs('PROP_FILES'), crm = pairs('CRASH_FILES'), crx = pairs('CRASH_FX_FILES');
  const have = f => files.includes(f) ? ' (in use)' : '';
  const md = [
    '# Replaceable models', '',
    'Put a `.glb` file (glTF binary) with one of these names in this folder, in the sub-folder shown, and build the app.',
    'The app then uses it instead of its own model everywhere that model appears: the 3D view, the pictures, the',
    'water salute, the museum. Remove the file and the app\'s own model comes back. This list is written by the build.', '',
    '**How the files should be made**', '',
    '- glTF 2.0 binary (`.glb`), textures inside the file. Metres. **+Y up, the front (the nose) towards +Z** (glTF\'s own convention).',
    '- The app fits each model to the real size of the thing it replaces (length), sets it on the ground and centres it across, so small differences in scale or origin do not matter.',
    '- Aircraft: the app\'s own model still moves its gear, flaps and lights; a file\'s model is shown as it is (its own paint).',
    '- Licences of bought models must allow commercial sale (see CLAUDE.md).', '',
    '## Aircraft (`aircraft/`)', '', '| File | Aircraft |', '|---|---|',
    ...ac.map(([f, n]) => `| \`aircraft/${f}\`${have('aircraft/' + f)} | ${n} |`), '',
    '## Helicopters (`helicopters/`)', '',
    'Each helicopter type, named so it is clear it is a helicopter and which one. Metres, +Y up, the nose towards +Z; the',
    'rotor is shown as it is in the file (the app\'s own model turns its rotors).', '',
    '| File | Helicopter |', '|---|---|',
    ...helis.map(([f, n]) => `| \`helicopters/${f}\`${have('helicopters/' + f)} | ${n} |`), '',
    '## Ground vehicles (`vehicles/`)', '', '| File | Vehicle |', '|---|---|',
    ...veh.map(([f, n]) => `| \`vehicles/${f}.glb\`${have('vehicles/' + f + '.glb')} | ${n} |`), '',
    '## Jet bridges (`jetways/`)', '', '| File | What |', '|---|---|',
    ...jw.map(([f, n]) => `| \`jetways/${f}.glb\`${have('jetways/' + f + '.glb')} | ${n} |`), '',
    '## Hangars (`hangars/`)', '',
    'The hangar building for each size: walls, roof, columns, windows and the doors (the floor, the rooms along the back wall,',
    'the aircraft, the people and the equipment stay the app\'s own). Metres, the doors towards +Z, the floor at 0, centred.',
    'It is fitted to the size shown. Meshes named `window`, `glass` or `skylight` show the sky at the base (day, sunrise,',
    'sunset, night). For the PC only, a file with `-pc` at the end (e.g. `hangars/hangar-large-pc.glb`) is used first, so',
    'a heavier, higher-quality building can go to the PC while phones keep the lighter one.', '',
    '| File | Size |', '|---|---|',
    ...hgr.flatMap(([f, n]) => [`| \`hangars/${f}.glb\`${have('hangars/' + f + '.glb')} | ${n} |`, `| \`hangars/${f}-pc.glb\`${have('hangars/' + f + '-pc.glb')} | The same, PC only |`]), '',
    '## Furniture and fittings used in several rooms (`props/`)', '',
    'Plants, sofas, armchairs, the coffee machine, the doors and the room signs, in the lounges, your office, the Operations',
    'office and the hangars. Where there are several kinds they are numbered (`plant-1`, `plant-2`…); one file stands for',
    'every one of that kind. Metres, front towards +Z (where you sit or the side you face it from), standing on the floor,',
    'centred; fitted to the size of the app\'s own. Doors: `door-1` is one leaf with its hinge on the left edge; `door-2` one',
    'sliding glass leaf (two are used). The room sign\'s name and pictogram stay the app\'s own, drawn in front of the file\'s frame.', '',
    '| File | What |', '|---|---|',
    ...shp.map(([f, n]) => `| \`props/${f}.glb\`${have('props/' + f + '.glb')} | ${n} |`), '',
    '## Hangar equipment and furniture (`hangar-props/`)', '',
    'One file for each kind: every one of that kind in the hangars uses it. Metres, front towards +Z (the side you face it',
    'from: a chair\'s front is where you sit, a desk\'s where you work), standing on the floor. It is fitted to the size of the',
    'app\'s own. Tables, counters and trolleys keep working as places to put things down. The tug by the doors is the apron\'s',
    'own (`vehicles/pushback-tug.glb`).', '',
    '| File | What |', '|---|---|',
    ...hpr.map(([f, n]) => `| \`hangar-props/${f}.glb\`${have('hangar-props/' + f + '.glb')} | ${n} |`), '',
    '## Lounge furniture and equipment (`lounge-props/`)', '',
    'One file for each kind, used for every one of that kind in your lounges. Where the levels differ (Lounge, Business',
    'lounge, Flagship lounge) each level has its own file: the carpets, armchairs, sofas and coffee tables. Metres, front',
    'towards +Z (where you sit or stand to use it), standing on the floor; fitted to the size of the app\'s own.', '',
    '| File | What |', '|---|---|',
    ...lpr.map(([f, n]) => `| \`lounge-props/${f}.glb\`${have('lounge-props/' + f + '.glb')} | ${n} |`), '',
    '## Training room (`training-props/`)', '',
    'One file for each kind of thing in the Training room (the Academy), used for every one of that kind. Metres, front',
    'towards +Z (the side you sit at or look at), standing on the floor (or the desk); fitted to the size of the app\'s own.',
    'The plants are the shared ones (`props/plant-3.glb`). The people are the people files.', '',
    '| File | What |', '|---|---|',
    ...tpr.map(([f, n]) => `| \`training-props/${f}.glb\`${have('training-props/' + f + '.glb')} | ${n} |`), '',
    '## Your private suite (`suite-props/`)', '',
    'The hall, bathroom, bedroom and dressing alcove behind your office. Metres, front towards +Z, standing on the floor;',
    'fitted to the size of the app\'s own. The water, the lights, the mirror\'s reflection and the clock\'s time are the app\'s own.', '',
    '| File | What |', '|---|---|',
    ...sup.map(([f, n]) => `| \`suite-props/${f}.glb\`${have('suite-props/' + f + '.glb')} | ${n} |`), '',
    '## Security (`security-props/`)', '',
    'What the security officers and the police carry. Metres, the front towards +Z. The officers and the police themselves are',
    'the people files; the officers\' print (the airline name and SECURITY GUARD) is drawn by the app on their jacket or shirt.', '',
    '| File | What |', '|---|---|',
    ...spr.map(([f, n]) => `| \`security-props/${f}.glb\`${have('security-props/' + f + '.glb')} | ${n} |`), '',
    '## Crash scene (`crash/`)', '',
    'What is at a crash site besides the aircraft itself (the wreck is the aircraft\'s own model, broken and scorched).',
    'Models: metres, +Y up, the front towards +Z, standing on the ground; each is fitted to the size of the app\'s own.',
    'The vehicles keep the app\'s flashing lights. Effects: square PNG pictures with transparency, used instead of the',
    'app\'s own drawing (the app still moves, fades and tints them).', '',
    '| File | What |', '|---|---|',
    ...crm.map(([f, n]) => `| \`crash/${f}.glb\`${have('crash/' + f + '.glb')} | ${n} |`),
    ...crx.map(([f, n]) => `| \`crash/${f}.png\`${have('crash/' + f + '.png')} | ${n} |`), '',
    '## The vending machine\'s parts (`items/vending-machine.glb`)', '',
    'Name these parts (nodes or meshes) in your file and the machine works with them; any part left out stays the app\'s own.',
    'Rows are A (top), B, C; columns 1 (left), 2, 3: nine products, as in the app.', '',
    '| Name | What it is | How the app uses it |', '|---|---|---|',
    '| `slot-A1` … `slot-C3` | An empty node where each product stands, at the front of its shelf | The products (the app\'s, or their own files below) are set there, more of the same behind it |',
    '| `coil-A1` … `coil-C3` | The spiral behind each product | Turns once round its own Z axis when that product is chosen |',
    '| `flap` | The tray\'s flap, its origin on the hinge (top edge) | Swings in round its X axis when you take the product |',
    '| `tray` | An empty node on the floor of the tray | Where the chosen product drops to |',
    '| `display` | A flat mesh facing the front | The machine\'s messages are drawn on it (Make a choice, Take your item …) |',
    '| anything else | The cabinet, glass, keypad, lights, name | Shown as it is |', '',
    'Put each `slot-` node on the shelf, under the middle of the front product; the others stand behind it, 14 cm apart.',
    'Which product is in which slot: A1 cola, A2 lemon soda, A3 orange soda, B1 chocolate bar, B2 peanut bar, B3 sparkling water,',
    'C1 oat bar, C2 iced tea, C3 caramel bar. Names may also use capitals or an underscore (`Slot_A1`).', '',
    '## Hangar items (`items/`)', '',
    'The break room\'s vending machine and what it sells. Fitted to the size of the app\'s own model; cans and bars stand',
    'upright (top towards +Y), the machine\'s front towards +Z.', '',
    '| File | What |', '|---|---|',
    ...itm.map(([f, n]) => `| \`items/${f}.glb\`${have('items/' + f + '.glb')} | ${n} |`), '',
    '## People (`people/`)', '',
    'A base model for each gender and group of looks. The app picks the group from each person\'s look (skin tone and eyes);',
    'when that file is missing it uses `person-male.glb` or `person-female.glb`, and when that is missing too its own figure.',
    'Rig them with a skeleton; a bone named `Jaw` (or containing "jaw") opens the mouth while the person talks, and',
    'animations named `Idle` and `Walk` are played when they stand and walk. Height is fitted to the person\'s own.', '',
    '| File | People |', '|---|---|',
    ...['male', 'female'].flatMap(sx => ppl.map(([g, n]) => `| \`people/person-${sx}-${g}.glb\`${have('people/person-' + sx + '-' + g + '.glb')} | ${sx === 'male' ? 'Men' : 'Women'}: ${n} |`)),
    `| \`people/person-male.glb\` | Men (any group without its own file) |`, `| \`people/person-female.glb\` | Women (any group without its own file) |`, '',
  ].join('\n');
  writeFileSync(join(dir, 'README.md'), md);
}

// Runs the voice model in the app (ONNX Runtime Web, MIT License): the WebAssembly build only
const ort = join(root, 'node_modules/onnxruntime-web/dist');
if (existsSync(ort)) {
  mkdirSync(join(root, 'www/vendor/ort'), { recursive: true });
  for (const f of ['ort.wasm.min.js', 'ort-wasm-simd-threaded.wasm', 'ort-wasm-simd-threaded.mjs']) copyFileSync(join(ort, f), join(root, 'www/vendor/ort', f));
}

// Crew body data (made from the CC0 MakeHuman model, see tools/human-data)
const humans = join(root, 'assets/humans.bin');
copyFileSync(humans, join(root, 'www/humans.bin'));

// Every airport and runway in the world (OurAirports, public domain; see tools/airports)
for (const f of ['airports-world.json', 'heliports-world.json', 'runways-world.json', 'navaids-world.json']) copyFileSync(join(root, 'assets', f), join(root, 'www', f));
// Published procedures for US airports (FAA CIFP, public domain; fetched by the build, see tools/navdata)
const navSrc = join(root, 'assets/navdata/cifp');
if (existsSync(navSrc)) {
  mkdirSync(join(root, 'www/navdata/cifp'), { recursive: true });
  for (const f of readdirSync(navSrc)) copyFileSync(join(navSrc, f), join(root, 'www/navdata/cifp', f));
}

const tpl = readFileSync(join(root, 'www/index.template.html'), 'utf8');
writeFileSync(join(root, 'www/index.html'), tpl.replace(/%APP_NAME%/g, cfg.appName).replace(/%APP_VERSION%/g, cfg.version));

const tsc = existsSync(join(root, 'node_modules/.bin/tsc')) ? join(root, 'node_modules/.bin/tsc') : 'tsc';
execSync(`"${tsc}" -p "${join(root, 'tsconfig.json')}"`, { stdio: 'inherit' });
// Join the compiled files in tsconfig order into one classic script (no module loader needed).
const tsFiles = JSON.parse(readFileSync(join(root, 'tsconfig.json'), 'utf8')).files;
const bundle = tsFiles.map(f => readFileSync(join(root, 'build/js', f.replace(/^src\//, '').replace(/\.ts$/, '.js')), 'utf8')
  .replace(/^"use strict";\s*/, '')).join('\n');
writeFileSync(join(root, 'www/app.js'), '"use strict";\n' + bundle);

if (process.argv.includes('--preview')) {
  let html = readFileSync(join(root, 'www/index.html'), 'utf8');
  let css = readFileSync(join(root, 'www/styles.css'), 'utf8');
  css = css.replace(/url\(\s*['"]?fonts\/([^'")]+)['"]?\s*\)/g, (_, f) =>
    `url(data:font/woff;base64,${readFileSync(join(root, 'www/fonts', f)).toString('base64')})`);
  const js = readFileSync(join(root, 'www/app.js'), 'utf8');
  html = html
    .replace(/\s*<link rel="stylesheet" href="vendor\/[^"]+">/g, '')
    
    .replace(/\s*<script src="vendor\/maplibre[^"]+"><\/script>/g, '')
    .replace(/<link rel="stylesheet" href="styles.css">/, () => `<style>${css}</style>`)
    .replace(/<script src="app.js"><\/script>/, () => `<script>window.__HUMANS_B64="${readFileSync(humans).toString('base64')}";</script><script>${js.replace(/<\/script/g, '<\\/script')}</script>`);
  mkdirSync(join(root, 'dist'), { recursive: true });
  writeFileSync(join(root, 'dist/preview.html'), html);
  console.log('Preview written to dist/preview.html');
}
{
  const sv = cfg.services || {}, off = ['vatsim', 'ivao', 'simbriefApi', 'hoppie'].filter(k => sv[k] !== true);
  if (parseInt(String(cfg.version).split('.')[0], 10) >= 1 && off.length) console.log(`\nREMINDER before the final release: ${off.join(', ')} still switched off. VATSIM: its user agreement forbids using its data in a paid app without written permission. IVAO, SimBrief's flight plan import and Hoppie ACARS: none of them publish terms for paid apps, and SimBrief issues access keys on request. See CLAUDE.md.\n`);
}
console.log(`Built ${cfg.appName} ${cfg.version}`);
