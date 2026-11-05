/* Mods: replacement models, pictures and sounds for the game's own, by slot.
 * A slot is a stable ID for one replaceable thing, the same as its file name in www/models/ (aircraft/airbus-a320neo,
 * lounge-props/bottle-gin, people/person-female-european …). A mod is a package (a .zip) with an info file, mod.json:
 *   { "id": "nordic-ramp-trucks", "name": "Nordic ramp trucks", "author": "…", "version": "1.2.0", "game": "0.9.150",
 *     "category": "vehicles", "description": "…", "files": { "vehicles/fuel-truck": "fuel-truck.glb" },
 *     "depends": ["other-mod-id"], "changelog": ["1.2.0: …"], "screenshots": ["shot-1.jpg"] }
 * Mods never overwrite the game's files: they are kept apart (on this device, in its own storage) and used in place of
 * the game's own while they are switched on. No code: only models (.glb), pictures (.png .jpg .webp) and sounds
 * (.ogg .mp3 .wav), checked on install. PC: the Mods folder (Documents\Airline Manager Pro\Mods); phone: open a .zip.
 * See docs/modding-guide.md. */

interface ModSlot { id: string; cat: string; name: string; type: 'glb' | 'png'; maxMb: number; maxTris: number; scale: string; front: string }
interface ModRec {
  id: string; name: string; author: string; version: string; game: string; cat: string; desc: string;
  files: { [slot: string]: string }; depends: string[]; changelog: string[]; shots: string[];
  size: number; installed: number; updated: number; on: boolean; demo?: boolean; official?: boolean; source: 'zip' | 'folder' | 'demo'; key?: string;
}
interface ModsState { mods: ModRec[]; order: string[]; winners: { [slot: string]: string }; profiles: { [name: string]: { on: string[]; order: string[] } }; profile: string; allOff: boolean; favs: string[]; ratings: { [id: string]: number }; undo: string[] }

const MOD_CATS: [string, string][] = [['aircraft', 'Aircraft'], ['helicopters', 'Helicopters'], ['vehicles', 'Vehicles'], ['people', 'People'], ['buildings', 'Buildings'], ['props', 'Props and furniture'], ['items', 'Items'], ['security', 'Security'], ['effects', 'Effects']];
/** What each kind of slot must be (shown in the Mod Manager and checked on install). */
const MOD_SPECS: { [cat: string]: { type: 'glb' | 'png'; maxMb: number; maxTris: number; scale: string; front: string } } = {
  aircraft: { type: 'glb', maxMb: 40, maxTris: 300000, scale: 'Metres, real size (fitted to the type\'s length)', front: 'Nose towards +Z' },
  helicopters: { type: 'glb', maxMb: 30, maxTris: 200000, scale: 'Metres, real size', front: 'Nose towards +Z' },
  vehicles: { type: 'glb', maxMb: 15, maxTris: 100000, scale: 'Metres, real size', front: 'Front towards +Z, wheels on the ground' },
  people: { type: 'glb', maxMb: 20, maxTris: 80000, scale: 'Metres (fitted to each person\'s height); Idle and Walk clips and a jaw bone are used', front: 'Facing +Z' },
  buildings: { type: 'glb', maxMb: 60, maxTris: 400000, scale: 'Metres, real size', front: 'Doors towards +Z' },
  props: { type: 'glb', maxMb: 5, maxTris: 30000, scale: 'Metres, standing on the floor', front: 'Front towards +Z' },
  items: { type: 'glb', maxMb: 2, maxTris: 10000, scale: 'Metres', front: 'Label towards +Z' },
  security: { type: 'glb', maxMb: 3, maxTris: 15000, scale: 'Metres', front: 'Towards +Z' },
  effects: { type: 'png', maxMb: 4, maxTris: 0, scale: 'Up to 2048 × 2048 pixels, transparent background', front: '-' },
};
let _modSlots: ModSlot[] | null = null;
/** Every slot in the game, from the lists of replaceable files. */
function modSlots(): ModSlot[] {
  if (_modSlots) return _modSlots;
  const out: ModSlot[] = [], add = (id: string, cat: string, name: string) => { const S = MOD_SPECS[cat]; out.push({ id, cat, name, type: S.type, maxMb: S.maxMb, maxTris: S.maxTris, scale: S.scale, front: S.front }); };
  try { for (const a of AIRCRAFT) { const f = aircraftModelFile(a.id); if (f) add(f.replace(/\.glb$/, ''), 'aircraft', `${a.maker} ${a.model}`); } } catch (e) { /* none */ }
  try { for (const id of Object.keys(HELI_SPECS)) { const f = helicopterModelFile(id), t = acType(id); if (f) add(f.replace(/\.glb$/, ''), 'helicopters', t ? `${t.maker} ${t.model}` : id); } } catch (e) { /* none */ }
  for (const [f, n] of VEHICLE_FILES) add('vehicles/' + f, 'vehicles', n);
  for (const [f, n] of JETWAY_FILES) add('jetways/' + f, 'buildings', n);
  for (const [f, n] of HANGAR_FILES) add('hangars/' + f, 'buildings', n);
  for (const sx of ['female', 'male']) { add(`people/person-${sx}`, 'people', `Person, ${sx} (any group)`); for (const [g, n] of PEOPLE_GROUPS) add(`people/person-${sx}-${g}`, 'people', `Person, ${sx}, ${n}`); }
  for (const [f, n] of HANGAR_PROP_FILES) add('hangar-props/' + f, 'props', n);
  for (const [f, n] of LOUNGE_PROP_FILES) add('lounge-props/' + f, 'props', n);
  for (const [f, n] of SUITE_PROP_FILES) add('suite-props/' + f, 'props', n);
  for (const [f, n] of TRAINING_PROP_FILES) add('training-props/' + f, 'props', n);
  for (const [f, n] of PROP_FILES) add('props/' + f, 'props', n);
  for (const [f, n] of ITEM_FILES) add('items/' + f, 'items', n);
  for (const [f, n] of SECURITY_PROP_FILES) add('security-props/' + f, 'security', n);
  for (const [f, n] of CRASH_FILES) add('crash/' + f, 'vehicles', n);
  for (const [f, n] of CRASH_FX_FILES) add('crash/' + f, 'effects', n);
  return (_modSlots = out);
}
function modSlot(id: string): ModSlot | null { return modSlots().filter(s => s.id === id)[0] || null; }
/** The file the game looks for, for a slot. */
function modSlotPath(s: ModSlot): string { return s.id + (s.type === 'png' ? '.png' : '.glb'); }

/* ---------- the manager's own record (on this device, apart from the saves) ---------- */
const MODS_KEY = 'amp-mods';
let _mods: ModsState | null = null;
function modsState(): ModsState {
  if (_mods) return _mods;
  let s: any = null; try { s = JSON.parse(localStorage.getItem(MODS_KEY) || 'null'); } catch (e) { s = null; }
  _mods = Object.assign({ mods: [], order: [], winners: {}, profiles: {}, profile: 'Default', allOff: false, favs: [], ratings: {}, undo: [] }, s || {});
  return _mods!;
}
function modsSave() { try { localStorage.setItem(MODS_KEY, JSON.stringify(modsState())); } catch (e) { /* full: kept for this session */ } }
/** Before any change: a step back to undo (the last 20). */
function modsMark() { const S = modsState(), snap = JSON.stringify(Object.assign({}, S, { undo: [] })); S.undo.push(snap); if (S.undo.length > 20) S.undo.shift(); }
function modsUndo(): boolean {
  const S = modsState(), snap = S.undo.pop(); if (!snap) return false;
  const old = JSON.parse(snap), files = S.mods.filter(m => !old.mods.some((o: ModRec) => o.id === m.id));
  _mods = Object.assign(old, { undo: S.undo }); for (const m of files) modFilesDrop(m.id);   // an install undone: its files go too
  modsSave(); modsApply(); return true;
}
function modById(id: string): ModRec | null { return modsState().mods.filter(m => m.id === id)[0] || null; }

/* ---------- the files (IndexedDB), never in the game's own folder ---------- */
let _modDb: Promise<IDBDatabase> | null = null;
function modDb(): Promise<IDBDatabase> {
  if (_modDb) return _modDb;
  return (_modDb = new Promise((res, rej) => { try { const r = indexedDB.open('amp-mods', 1); r.onupgradeneeded = () => r.result.createObjectStore('files'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); } }));
}
function modFilePut(key: string, b: Blob): Promise<void> { return modDb().then(db => new Promise<void>((res, rej) => { const t = db.transaction('files', 'readwrite'); t.objectStore('files').put(b, key); t.oncomplete = () => res(); t.onerror = () => rej(t.error); })); }
function modFileGet(key: string): Promise<Blob | null> { return modDb().then(db => new Promise<Blob | null>(res => { const t = db.transaction('files', 'readonly'), r = t.objectStore('files').get(key); r.onsuccess = () => res(r.result || null); r.onerror = () => res(null); })).catch(() => null); }
function modFilesDrop(modId: string) {
  modDb().then(db => { const t = db.transaction('files', 'readwrite'), st = t.objectStore('files'), r = st.openCursor(); r.onsuccess = () => { const c: any = r.result; if (!c) return; if (String(c.key).indexOf(modId + '/') === 0) c.delete(); c.continue(); }; }).catch(() => { /* none */ });
}

/* ---------- which mod wins each slot ---------- */
/** The mods that are on, in load order (later ones win a slot unless you chose a winner). */
function modsActive(): ModRec[] { const S = modsState(); if (S.allOff) return []; const by: any = {}; for (const m of S.mods) by[m.id] = m; return S.order.map(id => by[id]).filter((m: ModRec) => m && m.on); }
/** Slots that more than one switched-on mod replaces. */
function modConflicts(): { slot: string; mods: string[]; winner: string }[] {
  const S = modsState(), map: { [s: string]: string[] } = {};
  for (const m of modsActive()) for (const s of Object.keys(m.files)) (map[s] = map[s] || []).push(m.id);
  return Object.keys(map).filter(s => map[s].length > 1).map(s => ({ slot: s, mods: map[s], winner: map[s].indexOf(S.winners[s]) >= 0 ? S.winners[s] : map[s][map[s].length - 1] }));
}
function modWinnerMap(): { [slot: string]: ModRec } {
  const S = modsState(), out: { [slot: string]: ModRec } = {};
  for (const m of modsActive()) for (const s of Object.keys(m.files)) { if (S.winners[s] && S.winners[s] !== m.id && modsActive().some(x => x.id === S.winners[s])) continue; out[s] = m; }
  return out;
}
/** Use the winners' files in place of the game's own (from now on: anything built after this uses them). */
let _modUrls: string[] = [];
function modsApply(): Promise<void> {
  const M: any = Models; M.over = M.over || {};
  for (const u of _modUrls) { try { URL.revokeObjectURL(u); } catch (e) { /* gone */ } } _modUrls = [];
  const before = Object.keys(M.over); M.over = {};
  const W = modWinnerMap(), jobs: Promise<void>[] = [];
  for (const slot of Object.keys(W)) {
    const m = W[slot], sl = modSlot(slot); if (!sl || m.demo) continue;
    jobs.push(modFileGet(m.id + '/' + m.files[slot]).then(b => { if (!b) return; const u = URL.createObjectURL(b); _modUrls.push(u); M.over[modSlotPath(sl)] = u; }));
  }
  return Promise.all(jobs).then(() => { for (const p of before.concat(Object.keys(M.over))) { delete M.cache[p]; delete M.ready[p]; if (M._tex) delete M._tex[p]; if (M.over[p]) M.load(p); } });
}

/* ---------- versions ---------- */
function modVer(a: string): number[] { return String(a || '0').split(/[.\-]/).map(x => parseInt(x, 10) || 0); }
function modVerCmp(a: string, b: string): number { const A = modVer(a), B = modVer(b); for (let i = 0; i < Math.max(A.length, B.length); i++) { const d = (A[i] || 0) - (B[i] || 0); if (d) return d < 0 ? -1 : 1; } return 0; }
/** Made for this version of the game or an earlier one of the same series. */
function modCompatible(m: { game: string }): boolean { const g = modVer(m.game), a = modVer(APP.version); return modVerCmp(m.game, APP.version) <= 0 && g[0] === a[0]; }

/* ---------- reading a .zip (stored or deflated), without code from anywhere else ---------- */
async function modUnzip(buf: ArrayBuffer): Promise<{ [name: string]: Uint8Array }> {
  const v = new DataView(buf), u8 = new Uint8Array(buf), out: { [name: string]: Uint8Array } = {};
  let e = -1; for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) if (v.getUint32(i, true) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error('This isn\'t a .zip file');
  const n = v.getUint16(e + 10, true); let p = v.getUint32(e + 16, true);
  for (let k = 0; k < n; k++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error('The .zip is damaged');
    const meth = v.getUint16(p + 10, true), csz = v.getUint32(p + 20, true), nl = v.getUint16(p + 28, true), xl = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true), lo = v.getUint32(p + 42, true);
    const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl)); p += 46 + nl + xl + cl;
    if (/\/$/.test(name)) continue;
    const ds = lo + 30 + v.getUint16(lo + 26, true) + v.getUint16(lo + 28, true), raw = u8.subarray(ds, ds + csz);
    if (meth === 0) out[name] = raw.slice();
    else if (meth === 8) { const st = new Blob([raw]).stream().pipeThrough(new (window as any).DecompressionStream('deflate-raw')); out[name] = new Uint8Array(await new Response(st).arrayBuffer()); }
    else throw new Error(`${name}: packed in a way the game can't read (use normal zip compression)`);
  }
  return out;
}

/* ---------- checking a package ---------- */
const MOD_OK_EXT = /\.(glb|png|jpe?g|webp|ogg|mp3|wav|json|txt|md)$/i;
/** Triangles in a .glb (from its index or position counts), and whether it points to files outside itself. */
function modGlbInfo(b: Uint8Array): { ok: boolean; tris: number; external: boolean; err?: string } {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (b.length < 20 || v.getUint32(0, true) !== 0x46546c67) return { ok: false, tris: 0, external: false, err: 'not a .glb model (glTF binary)' };
  const jl = v.getUint32(12, true); let j: any;
  try { j = JSON.parse(new TextDecoder().decode(b.subarray(20, 20 + jl))); } catch (e) { return { ok: false, tris: 0, external: false, err: 'its model data can\'t be read' }; }
  let tris = 0; const acc = j.accessors || [];
  for (const m of j.meshes || []) for (const pr of m.primitives || []) { const a = pr.indices != null ? acc[pr.indices] : acc[(pr.attributes || {}).POSITION]; if (a) tris += Math.floor((a.count || 0) / 3); }
  const external = (j.buffers || []).concat(j.images || []).some((x: any) => x && x.uri && !/^data:/.test(x.uri));
  return { ok: true, tris, external };
}
interface ModCheck { ok: boolean; errors: string[]; warnings: string[]; info: any; files: { [name: string]: Uint8Array } }
function modCheck(files: { [name: string]: Uint8Array }): ModCheck {
  const errors: string[] = [], warnings: string[] = [];
  // a package may sit in one folder inside the zip
  const names = Object.keys(files), root = names.filter(n => /(^|\/)mod\.json$/i.test(n)).sort((a, b) => a.length - b.length)[0];
  if (!root) return { ok: false, errors: ['There is no mod.json (the info file) in the package.'], warnings, info: null, files };
  const pre = root.slice(0, root.length - 'mod.json'.length), F: { [name: string]: Uint8Array } = {};
  for (const n of names) if (n.indexOf(pre) === 0) F[n.slice(pre.length)] = files[n];
  let info: any = null; try { info = JSON.parse(new TextDecoder().decode(F['mod.json'])); } catch (e) { errors.push('mod.json can\'t be read: ' + (e as any).message); }
  for (const n of Object.keys(F)) if (!MOD_OK_EXT.test(n)) errors.push(`${n}: not allowed. A mod may only hold models (.glb), pictures (.png, .jpg, .webp) and sounds (.ogg, .mp3, .wav).`);
  if (info) {
    if (!/^[a-z0-9][a-z0-9.\-]{2,63}$/.test(String(info.id || ''))) errors.push('"id" must be 3 to 64 small letters, digits, dots or dashes (it never changes between versions).');
    if (!info.name) errors.push('"name" is missing.'); if (!info.author) errors.push('"author" is missing.');
    if (!/^\d+(\.\d+){0,3}$/.test(String(info.version || ''))) errors.push('"version" must look like 1.0.0.');
    if (!info.game) warnings.push('"game" (the game version it was made for) is missing.'); else if (!modCompatible(info)) warnings.push(`Made for game version ${info.game}; you have ${APP.version}.`);
    const fl = info.files || {}; if (!Object.keys(fl).length) errors.push('"files" lists no slots to replace.');
    for (const slot of Object.keys(fl)) {
      const sl = modSlot(slot), f = fl[slot], b = F[f];
      if (!sl) { errors.push(`${slot}: no such slot in this game (see the slot list in the Mod Manager).`); continue; }
      if (!b) { errors.push(`${slot}: the file ${f} isn't in the package.`); continue; }
      if (b.length > sl.maxMb * 1048576) errors.push(`${f}: ${(b.length / 1048576).toFixed(1)} MB, over the ${sl.maxMb} MB limit for this slot.`);
      if (sl.type === 'glb') { const g = modGlbInfo(b); if (!g.ok) errors.push(`${f}: ${g.err}.`); else { if (g.external) errors.push(`${f}: it uses files outside itself; pack everything into the .glb.`); if (g.tris > sl.maxTris) errors.push(`${f}: ${g.tris.toLocaleString()} triangles, over the ${sl.maxTris.toLocaleString()} limit for this slot.`); } }
      else if (!(b[0] === 0x89 && b[1] === 0x50)) errors.push(`${f}: must be a .png picture.`);
    }
    for (const d of info.depends || []) if (!modById(d)) warnings.push(`Needs the mod "${d}", which isn't installed.`);
  }
  return { ok: !errors.length, errors, warnings, info, files: F };
}

/** Install a checked package (a new mod, or a new version of one you have: its files replaced, its place kept). */
async function modInstall(C: ModCheck, source: 'zip' | 'folder', key?: string): Promise<ModRec> {
  const S = modsState(), i = C.info, old = modById(i.id); modsMark();
  if (old) modFilesDrop(old.id);
  let size = 0; const shots: string[] = [];
  for (const n of Object.keys(C.files)) { if (n === 'mod.json') continue; size += C.files[n].length; await modFilePut(i.id + '/' + n, new Blob([C.files[n] as any])); }
  for (const s of (i.screenshots || []).slice(0, 6)) { const b = C.files[s]; if (b && b.length < 2e6) shots.push(await new Promise<string>(res => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(new Blob([b as any], { type: /png$/i.test(s) ? 'image/png' : /webp$/i.test(s) ? 'image/webp' : 'image/jpeg' })); })); }
  const m: ModRec = { id: i.id, name: String(i.name), author: String(i.author), version: String(i.version), game: String(i.game || ''), cat: MOD_SPECS[i.category] ? i.category : (modSlot(Object.keys(i.files)[0]) || { cat: 'props' }).cat,
    desc: String(i.description || ''), files: i.files, depends: i.depends || [], changelog: (i.changelog || []).map(String), shots, size, installed: old ? old.installed : Date.now(), updated: Date.now(), on: old ? old.on : true, source, key };
  S.mods = S.mods.filter(x => x.id !== m.id).concat([m]); if (S.order.indexOf(m.id) < 0) S.order.push(m.id);
  modsSave(); await modsApply(); return m;
}
function modRemove(id: string) { const S = modsState(); modsMark(); S.mods = S.mods.filter(m => m.id !== id); S.order = S.order.filter(x => x !== id); for (const s of Object.keys(S.winners)) if (S.winners[s] === id) delete S.winners[s]; modFilesDrop(id); modsSave(); modsApply(); }
function modToggle(id: string, on?: boolean) { const m = modById(id); if (!m) return; modsMark(); m.on = on == null ? !m.on : on; modsSave(); modsApply(); }
function modsAllOff(v: boolean) { const S = modsState(); modsMark(); S.allOff = v; modsSave(); modsApply(); }
function modMove(id: string, to: number) { const S = modsState(), i = S.order.indexOf(id); if (i < 0) return; modsMark(); S.order.splice(i, 1); S.order.splice(Math.max(0, Math.min(S.order.length, to)), 0, id); modsSave(); modsApply(); }
function modWin(slot: string, id: string) { const S = modsState(); modsMark(); S.winners[slot] = id; modsSave(); modsApply(); }
/** Profiles: which mods are on, and their order, saved under a name. */
function modProfileSave(name: string) { const S = modsState(); S.profiles[name] = { on: S.mods.filter(m => m.on).map(m => m.id), order: S.order.slice() }; S.profile = name; modsSave(); }
function modProfileLoad(name: string) { const S = modsState(), P = S.profiles[name]; if (!P) return; modsMark(); for (const m of S.mods) m.on = P.on.indexOf(m.id) >= 0; S.order = P.order.filter(id => modById(id)).concat(S.order.filter(id => P.order.indexOf(id) < 0)); S.profile = name; modsSave(); modsApply(); }

/** Everything checked: files there, slots still in the game, versions, what each needs, clashes. */
async function modHealth(): Promise<{ ok: boolean; lines: [string, string][] }> {
  const lines: [string, string][] = [], S = modsState();
  for (const m of S.mods) {
    if (!m.on) continue;
    for (const s of Object.keys(m.files)) { if (!modSlot(s)) lines.push(['bad', `${m.name}: the slot ${s} is no longer in the game.`]); else if (!m.demo && !(await modFileGet(m.id + '/' + m.files[s]))) lines.push(['bad', `${m.name}: ${m.files[s]} is missing. Install the mod again.`]); }
    if (m.game && !modCompatible(m)) lines.push(['warn', `${m.name} was made for game version ${m.game} (you have ${APP.version}).`]);
    for (const d of m.depends) { const x = modById(d); if (!x) lines.push(['bad', `${m.name} needs "${d}", which isn't installed.`]); else if (!x.on) lines.push(['warn', `${m.name} needs ${x.name}, which is switched off.`]); }
  }
  for (const c of modConflicts()) lines.push(['warn', `${c.slot}: ${c.mods.length} mods replace it; ${(modById(c.winner) || { name: c.winner }).name} is used.`]);
  if (!lines.length) lines.push(['ok', `All ${S.mods.filter(m => m.on).length} switched-on mods are in order.`]);
  return { ok: !lines.some(l => l[0] === 'bad'), lines };
}
async function modStorage(): Promise<{ mods: number; used: number; quota: number }> {
  const mods = modsState().mods.reduce((a, m) => a + (m.demo ? 0 : m.size), 0); let used = 0, quota = 0;
  try { const e = await (navigator as any).storage.estimate(); used = e.usage || 0; quota = e.quota || 0; } catch (e) { /* unknown */ }
  return { mods, used, quota };
}

/* ---------- the PC's Mods folder ---------- */
/** On the PC: packages in Documents\Airline Manager Pro\Mods are installed (new or changed ones) when the Mod Manager opens. */
async function modsFolderScan(): Promise<{ added: string[]; failed: [string, string][] }> {
  const added: string[] = [], failed: [string, string][] = [];
  if (!DESKTOP) return { added, failed };
  let L: any = null; try { L = await (await fetch('/api/mods')).json(); } catch (e) { return { added, failed }; }
  for (const f of (L && L.files) || []) {
    const key = f.name + '|' + f.size + '|' + f.mtime; if (modsState().mods.some(m => m.key === key)) continue;
    try { const buf = await (await fetch('/mods/' + encodeURIComponent(f.name))).arrayBuffer(), C = modCheck(await modUnzip(buf));
      if (!C.ok) { failed.push([f.name, C.errors[0]]); continue; } await modInstall(C, 'folder', key); added.push(C.info.name); } catch (e: any) { failed.push([f.name, String(e && e.message || e)]); }
  }
  return { added, failed };
}

/* ---------- co-op: the same mods? ---------- */
function modsMine(): { id: string; name: string; version: string }[] { return modsActive().map(m => ({ id: m.id, name: m.name, version: m.version })); }
/** A co-op partner's mods (sent with their other details; the sample pilots of the demo have some of the demo mods). */
function modsOfMember(mem: any): { id: string; name: string; version: string }[] {
  if (mem && mem.mods) return mem.mods;
  const pool = MOD_DEMO, h = _hashStr(String(mem && mem.id || '')), out: any[] = [];
  for (let i = 0; i < pool.length; i++) if (((h >>> i) & 3) === 0) out.push({ id: pool[i].id, name: pool[i].name, version: pool[i].version });
  return out;
}
function modCoopCompare(): { both: any[]; mineOnly: any[]; theirsOnly: { who: string; mod: any }[] } {
  const mine = modsMine(), both: any[] = [], theirsOnly: { who: string; mod: any }[] = [], seen: any = {};
  let members: any[] = []; try { const c = coopState(); members = c && c.on ? c.members.filter((m: any) => !m.you) : []; } catch (e) { members = []; }
  for (const mem of members) for (const x of modsOfMember(mem)) { if (mine.some(y => y.id === x.id)) { if (!seen[x.id]) { both.push(x); seen[x.id] = 1; } } else theirsOnly.push({ who: mem.name, mod: x }); }
  const mineOnly = mine.filter(y => !members.some(mem => modsOfMember(mem).some(x => x.id === y.id)));
  return { both, mineOnly, theirsOnly };
}
/** In co-op: does a mod match your partners'? */
function modCoopMark(id: string): '' | 'both' | 'mine' | 'theirs' {
  let members: any[] = []; try { const c = coopState(); members = c && c.on ? c.members.filter((m: any) => !m.you) : []; } catch (e) { return ''; }
  if (!members.length) return '';
  const mine = modsActive().some(m => m.id === id), theirs = members.some(mem => modsOfMember(mem).some(x => x.id === id));
  return mine && theirs ? 'both' : mine ? 'mine' : theirs ? 'theirs' : '';
}

/* ---------- demo content (until there is a place to get real mods) ---------- */
interface ModDemo { id: string; name: string; author: string; version: string; game: string; cat: string; desc: string; slots: string[]; size: number; downloads: number; rating: number; date: string; official: boolean; tint: string; changelog: string[] }
const MOD_DEMO: ModDemo[] = [
  { id: 'nordic-ramp-trucks', name: 'Nordic ramp trucks', author: 'Fjord Works', version: '1.3.0', game: '0.9.150', cat: 'vehicles', desc: 'Fuel, catering and de-icing trucks in the white and red of Nordic airports, with winter tyres and amber beacons.', slots: ['vehicles/fuel-truck', 'vehicles/catering-truck', 'vehicles/de-icing-truck'], size: 18.4e6, downloads: 48210, rating: 4.7, date: '2026-10-21', official: false, tint: '#D8423A', changelog: ['1.3.0: de-icing truck added', '1.2.0: sharper textures', '1.0.0: first version'] },
  { id: 'classic-pushback', name: 'Classic towbar tug', author: 'RampRat', version: '2.0.1', game: '0.9.140', cat: 'vehicles', desc: 'An older low-profile towbar tug, yellow with worn paint and a cab.', slots: ['vehicles/pushback-tug'], size: 6.1e6, downloads: 22950, rating: 4.4, date: '2026-09-02', official: false, tint: '#E3B23C', changelog: ['2.0.1: wheels turn the right way', '2.0.0: new cab'] },
  { id: 'lounge-mid-century', name: 'Mid-century lounge furniture', author: 'Studio Teak', version: '1.1.0', game: '0.9.148', cat: 'props', desc: 'Teak bar stools, low oak tables and brass floor lamps for your lounges.', slots: ['lounge-props/bar-stool', 'lounge-props/coffee-table-oak', 'lounge-props/floor-lamp'], size: 9.8e6, downloads: 15320, rating: 4.8, date: '2026-10-12', official: false, tint: '#B4703C', changelog: ['1.1.0: floor lamp added'] },
  { id: 'premium-spirits', name: 'Premium spirits bottles', author: 'Airline Manager Pro', version: '1.0.0', game: '0.9.151', cat: 'props', desc: 'Detailed bottles for the lounge bar: gin, vodka, whisky and rum with labels and glass.', slots: ['lounge-props/bottle-gin', 'lounge-props/bottle-vodka', 'lounge-props/bottle-whisky', 'lounge-props/bottle-rum'], size: 4.2e6, downloads: 31004, rating: 4.6, date: '2026-10-30', official: true, tint: '#5A8F6A', changelog: ['1.0.0: first version'] },
  { id: 'hq-a320neo', name: 'A320neo, high detail', author: 'Wingspan Models', version: '3.2.0', game: '0.9.150', cat: 'aircraft', desc: 'A high-detail A320neo with sharklets, LEAP and PW1100G engines, opening doors and a lit cabin.', slots: ['aircraft/airbus-a320neo'], size: 36.5e6, downloads: 90412, rating: 4.9, date: '2026-10-25', official: false, tint: '#3C7BD8', changelog: ['3.2.0: engine choice follows your aircraft', '3.1.0: lit cabin windows', '3.0.0: rebuilt'] },
  { id: 'b737-max-pack', name: '737 MAX family', author: 'Wingspan Models', version: '1.4.0', game: '0.9.145', cat: 'aircraft', desc: 'The 737 MAX 8 with split-scimitar winglets and LEAP-1B engines.', slots: ['aircraft/boeing-737-max-8'], size: 33.0e6, downloads: 61203, rating: 4.5, date: '2026-08-30', official: false, tint: '#2E5FA8', changelog: ['1.4.0: gear doors'] },
  { id: 'faces-europe', name: 'European faces', author: 'People Lab', version: '1.0.2', game: '0.9.140', cat: 'people', desc: 'New base people for the European group, with Idle and Walk animations and a talking jaw.', slots: ['people/person-female-european', 'people/person-male-european'], size: 24.7e6, downloads: 12840, rating: 4.2, date: '2026-07-18', official: false, tint: '#C98C6A', changelog: ['1.0.2: lighter files'] },
  { id: 'security-gear', name: 'Security gear', author: 'Airline Manager Pro', version: '1.0.0', game: '0.9.154', cat: 'security', desc: 'A detailed taser and hinged handcuffs for your security officers and the police.', slots: ['security-props/taser', 'security-props/handcuffs'], size: 1.3e6, downloads: 4210, rating: 4.6, date: '2026-11-04', official: true, tint: '#F2C230', changelog: ['1.0.0: first version'] },
  { id: 'hangar-steel', name: 'Steel truss hangars', author: 'Hangar Nine', version: '1.0.0', game: '0.9.130', cat: 'buildings', desc: 'Medium and large hangars with steel trusses, skylights and folding doors.', slots: ['hangars/hangar-medium', 'hangars/hangar-large'], size: 52.0e6, downloads: 8740, rating: 4.3, date: '2026-06-03', official: false, tint: '#8892A0', changelog: ['1.0.0: first version'] },
  { id: 'retro-vending', name: 'Retro vending machine', author: 'Snack Shack', version: '0.9.0', game: '0.9.120', cat: 'items', desc: 'A 1980s vending machine with a chrome front, and retro cans.', slots: ['items/vending-machine', 'items/can-cola'], size: 3.4e6, downloads: 5530, rating: 3.9, date: '2026-05-11', official: false, tint: '#C2364A', changelog: ['0.9.0: test version'] },
  { id: 'red-jet-bridge', name: 'Glass jet bridge', author: 'Fjord Works', version: '1.0.1', game: '0.9.148', cat: 'buildings', desc: 'A modern glass-walled jet bridge.', slots: ['jetways/jet-bridge'], size: 12.9e6, downloads: 9940, rating: 4.4, date: '2026-10-02', official: false, tint: '#7FB6D8', changelog: ['1.0.1: rotunda lights'] },
  { id: 'crash-fx-hd', name: 'Sharper crash effects', author: 'Ember FX', version: '1.2.0', game: '0.9.110', cat: 'effects', desc: 'Sharper fire, smoke and soot pictures for crash sites.', slots: ['crash/crash-fire', 'crash/crash-smoke', 'crash/crash-soot'], size: 7.6e6, downloads: 7120, rating: 4.1, date: '2026-04-20', official: false, tint: '#E2733A', changelog: ['1.2.0: night glow'] },
  { id: 'lounge-alt-armchair', name: 'Leather bar stools', author: 'Club Room', version: '1.0.0', game: '0.9.148', cat: 'props', desc: 'Deep leather bar stools with brass footrests (replaces the bar stool, like Mid-century lounge furniture).', slots: ['lounge-props/bar-stool'], size: 2.8e6, downloads: 6630, rating: 4.0, date: '2026-10-28', official: false, tint: '#6B3A26', changelog: ['1.0.0: first version'] },
];
/** Newer versions of demo mods "out there" (for the updates badge). */
const MOD_DEMO_LATEST: { [id: string]: string } = { 'nordic-ramp-trucks': '1.4.0', 'hq-a320neo': '3.3.0', 'classic-pushback': '2.0.1' };
/** A demo mod into the Installed list (it has no files: it shows how it works and is marked Demo). */
function modDemoInstall(id: string, version?: string): ModRec | null {
  const d = MOD_DEMO.filter(x => x.id === id)[0]; if (!d) return null;
  const S = modsState(), old = modById(id); modsMark();
  const files: any = {}; for (const s of d.slots) if (modSlot(s)) files[s] = s.split('/')[1] + (MOD_SPECS[d.cat].type === 'png' ? '.png' : '.glb');
  const m: ModRec = { id: d.id, name: d.name, author: d.author, version: version || (old ? MOD_DEMO_LATEST[id] || d.version : d.version), game: d.game, cat: d.cat, desc: d.desc, files, depends: [], changelog: (version && MOD_DEMO_LATEST[id] && version === MOD_DEMO_LATEST[id] ? [`${version}: fixes and improvements`] : []).concat(d.changelog), shots: [], size: d.size, installed: old ? old.installed : Date.now(), updated: Date.now(), on: old ? old.on : true, demo: true, official: d.official, source: 'demo' };
  S.mods = S.mods.filter(x => x.id !== id).concat([m]); if (S.order.indexOf(id) < 0) S.order.push(id); modsSave(); return m;
}
/** A newer version of an installed mod, if there is one. */
function modUpdate(m: ModRec): string { const v = MOD_DEMO_LATEST[m.id]; return m.demo && v && modVerCmp(v, m.version) > 0 ? v : ''; }
/** The first time: a few demo mods installed so there is something to see (once). */
function modsSeed() { const S: any = modsState(); if (S.seeded) return; S.seeded = 1; for (const [id, v] of [['nordic-ramp-trucks', '1.3.0'], ['hq-a320neo', '3.2.0'], ['lounge-mid-century', ''], ['lounge-alt-armchair', ''], ['premium-spirits', '']]) { const m = modDemoInstall(id, v || undefined); if (m && v) m.version = v; } S.undo = []; modsSave(); }

/* the game uses switched-on mods from the start */
setTimeout(() => { try { modsApply(); } catch (e) { /* the game's own */ } }, 0);
