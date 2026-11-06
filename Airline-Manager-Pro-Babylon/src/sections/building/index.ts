// The joined building, to the main game's plan: your office and the Operations office off the staff corridor; at the
// corridor's end the door onto the concourse, and at the concourse's far end the lounge's sliding doors. You walk
// through all of it (W A S D, the stick, a controller). Every door opens and shuts with a tap or a click (the lounge's
// slide open as you come up to them). Each room works as it does on its own: in your office the laptop, the monitor, the
// route map and the reports open the game's screens; in Operations the curved monitor shows your schedule and the
// buttons open Operations, the Schedule, Dispatch and the Flight planner; the chairs sit you down. Opened from the game
// (My office, Operations, Lounges, or Airport in the menu, which brings you into the concourse), always onto open floor.
import {
  Scene, Vector3, Color3, Color4, UniversalCamera, HemisphericLight, DirectionalLight, ShadowGenerator, GlowLayer, DefaultRenderingPipeline,
  ImageProcessingConfiguration, ReflectionProbe, RenderTargetTexture, Mesh, AbstractMesh, ParticleSystem, Space, TransformNode,
} from '@babylonjs/core';
import { registerSection, Section, SectionCtx } from '../../core/sections';
import { S } from '../../core/settings';
import { runLoop } from '../../core/engine';
import { inputFrame, onButton, isPlay, vibrate } from '../../core/input';
import { IS_PC, IS_TOUCH } from '../../core/app';
import { icon, toast, esc } from '../../ui/icons';
import { perfAttach, perfDetach, perfShow, perfBegin, perfEnd } from '../../core/perf-meter';
import { gameSend, onGameMonitor } from '../../ui/game-frame';
import { buildOffice, officeBlocked, Office, OfficeData } from '../office/build';
import { buildOps, opsBlocked, opsMonitor, opsClock, Ops } from '../ops/build';
import { buildLounge, blockedAt, Lounge, DOOR_X, DOOR_W } from '../lounge/build';
import * as P from '../lounge/pictures';
import { buildHalls, Halls, COR, CON, STAFF_DOOR, LOUNGE_DOOR, OFFICE_DOOR, OPS_AT, OPS_DOOR, MUSEUM_DOOR } from './concourse';
import { buildMuseum, museumBlocked, Museum, Exhibit } from './museum';
import { buildTraining, Training, TRN, TRN_DOOR } from '../training/build';
import { buildSuite, Suite, SUITE, SUITE_DOOR } from './suite';
import { buildBar, Bar, DRINKS, grams } from '../lounge/bar';
import { Matrix } from '@babylonjs/core';

const EYE = 1.65, SIT = 1.2;
const LG = { x: 37, z: -7.3 };   // the lounge's middle; turned a quarter so its doors face the concourse
const B: any = { scene: null as Scene | null };
const HINTS: { [k: string]: string } = {
  laptop: 'Laptop: open the game at the Overview', planner: 'Monitor: the Flight planner', map: 'Route map: your routes', reports: 'Conduct reports: your crew', phone: 'The phone',
  globe: 'The globe', pet: 'Your pet', 'bowl-food': 'The food bowl: fill it up', 'bowl-water': 'The water bowl: fill it up', model: 'A model of one of your aircraft', poster: 'An aviation poster', window: 'The view', monitor: 'Monitor: your schedule', files: 'The archive',
  piece: 'Take it in your hands', museumdoor: 'The museum', trndoor: 'The door', trn: 'Who is this?', whiteboard: 'The whiteboard: today\'s lesson', teacherdesk: 'The instructor\'s desk',
  desk: 'A student\'s desk', books: 'Aviation books', clock: 'The clock',
  bartender: 'The bartender: the drinks', drink: 'Your drink: pick it up',
  'suitedoor-office': 'The door to your suite', 'suitedoor-bath': 'The bathroom', 'suitedoor-bed': 'The bedroom', toilet: 'The toilet: use it', basin: 'The basin: wash your hands', shower: 'The shower: on or off',
  bath: 'The bath: run it', mirror: 'The mirror', lamp: 'The lamp: on or off', switch: 'The light: on or off', wardrobe: 'The wardrobe: your look', bed: 'The bed: lie down', armchair: 'An armchair',
  chair: 'A chair: sit down', door: 'The door', staffdoor: 'The staff door', shop: 'A shop', seat: 'A seat by the window', board: 'The flight boards',
};
onGameMonitor((d: any) => { if (B.scene && B.ops && d.url) opsMonitor(B.ops, d.url); });

/** Where you are: which room, the corridor or the concourse. */
function where(x: number, z: number): 'office' | 'ops' | 'corridor' | 'concourse' | 'lounge' | 'museum' | 'training' | 'suite' | '' {
  if (x > TRN.x0 && x < TRN.x1 && z > TRN.z0 && z < TRN.z1) return 'training';
  if (x > SUITE.x0 && x < SUITE.x1 && z > SUITE.z0 && z < SUITE.z1) return 'suite';
  const M: Museum = B.museum; if (M && x < CON.x0 && x > CON.x0 - M.D && Math.abs(z - MUSEUM_DOOR.z) < M.W / 2) return 'museum';
  if (x > -3.2 && x < 3.2 && z > -3.2 && z < 3.2) return 'office';
  if (x > OPS_AT.x - 3.0 && x < OPS_AT.x + 3.0 && z > OPS_AT.z - 2.7 && z < OPS_AT.z + 2.7) return 'ops';
  if (x > COR.x0 && x < COR.x1 && z > COR.z0 && z < COR.z1) return 'corridor';
  if (x > CON.x0 && x < CON.x1 && z > CON.z0 && z < CON.z1) return 'concourse';
  if (x > CON.x1 && x < CON.x1 + 14 && z > LG.z - 11 && z < LG.z + 11) return 'lounge';
  return '';
}
/** A point of the building in the lounge's own plan (the main game's coordinates: x east, z towards its back wall). */
function loungeLocal(x: number, z: number): [number, number] { const xl = -(z - LG.z), zl = x - LG.x; return [xl, -zl]; }
/** A point of the building in the museum's own plan. */
function museumLocal(x: number, z: number): [number, number] { return [-(z - MUSEUM_DOOR.z), x - (CON.x0 - B.museum.D / 2)]; }
/** Can you stand there: in a room, the corridor or the concourse, or in a doorway that is open. */
function walkable(x: number, z: number): boolean {
  const D = B.doors, r = 0.25;
  if (D.office.k > 0.6 && x > COR.x1 - 0.5 && x < COR.x1 + 0.6 && z > OFFICE_DOOR.z0 + 0.1 && z < OFFICE_DOOR.z1 - 0.1) return true;
  if (D.suiteOffice && D.suiteOffice.k > 0.6 && x > SUITE.x0 - 0.6 && x < SUITE.x0 + 0.6 && z > SUITE_DOOR.z0 + 0.1 && z < SUITE_DOOR.z1 - 0.1) return true;
  if (D.trnA.k > 0.6 && x > COR.x0 - 0.6 && x < COR.x0 + 0.5 && z > TRN_DOOR.z0 + 0.1 && z < TRN_DOOR.z1 - 0.1) return true;
  if (D.ops.k > 0.6 && x > COR.x1 - 0.5 && x < COR.x1 + 0.6 && z > OPS_DOOR.z0 + 0.1 && z < OPS_DOOR.z1 - 0.1) return true;
  if (D.staff.k > 0.6 && x > STAFF_DOOR.x0 + 0.1 && x < STAFF_DOOR.x1 - 0.1 && z > CON.z1 - 0.6 && z < CON.z1 + 0.6) return true;
  if (D.lounge.k > 0.6 && x > CON.x1 - 0.6 && x < CON.x1 + 0.9 && z > LOUNGE_DOOR.z - DOOR_W / 2 + 0.15 && z < LOUNGE_DOOR.z + DOOR_W / 2 - 0.15) return true;
  if (D.museum.k > 0.6 && x > CON.x0 - 0.9 && x < CON.x0 + 0.6 && z > MUSEUM_DOOR.z - MUSEUM_DOOR.w / 2 + 0.15 && z < MUSEUM_DOOR.z + MUSEUM_DOOR.w / 2 - 0.15) return true;
  switch (where(x, z)) {
    case 'museum': { const [mx, mz] = museumLocal(x, z); return !museumBlocked(B.museum, mx, mz); }
    case 'office': return !officeBlocked(B.office, x, z);
    case 'suite': return B.suite.walkable(x, z, { bath: D.suiteBath.k, bed: D.suiteBed.k });
    case 'training': { if (x < TRN.x0 + 0.3 || x > TRN.x1 - 0.3 || z < TRN.z0 + 0.3 || z > TRN.z1 - 0.3) return false; for (const b of B.trn.blocks) if (x > b[0] - r && x < b[2] + r && z > b[1] - r && z < b[3] + r) return false; return true; }
    case 'ops': return !opsBlocked(B.ops, x - OPS_AT.x, z - OPS_AT.z);
    case 'corridor': return x > COR.x0 + 0.3 && x < COR.x1 - 0.3 && z > COR.z0 + 0.3 && z < COR.z1 - 0.3;
    case 'concourse': { if (x < CON.x0 + 0.4 || x > CON.x1 - 0.4 || z < CON.z0 + 0.5 || z > CON.z1 - 0.4) return false; for (const b of B.halls.blocks) if (x > b[0] - r && x < b[2] + r && z > b[1] - r && z < b[3] + r) return false; return true; }
    case 'lounge': { const [lx, lz] = loungeLocal(x, z); return !blockedAt(B.lounge, lx, lz); }
  }
  return false;
}
/** The nearest open floor to a point (so you never arrive inside a wall, a seat or a counter). */
function freeNear(x: number, z: number): [number, number] {
  if (walkable(x, z)) return [x, z];
  for (let rr = 0.2; rr < 6; rr += 0.2) for (let a = 0; a < Math.PI * 2; a += 0.3) { const nx = x + Math.cos(a) * rr, nz = z + Math.sin(a) * rr; if (walkable(nx, nz)) return [nx, nz]; }
  return [x, z];
}

function apply(what: string) {
  const sc: Scene = B.scene; if (!sc) return; const g = S.gfx, all = what === 'all' || what === 'preset', cam: UniversalCamera = B.cam;
  if (all || what === 'fov') cam.fov = g.fov * Math.PI / 180;
  if (all || what === 'shadows') {
    if (B.sg) { B.sg.dispose(); B.sg = null; }
    if (g.shadows !== 'off') { const sg = new ShadowGenerator(g.shadows === 'high' ? (IS_PC ? 4096 : 2048) : 1024, B.sun); sg.usePercentageCloserFiltering = true; sg.filteringQuality = g.shadows === 'high' ? ShadowGenerator.QUALITY_HIGH : ShadowGenerator.QUALITY_LOW; sg.bias = 0.0008; sg.normalBias = 0.02;
      for (const m of B.casters as AbstractMesh[]) sg.addShadowCaster(m, false); B.sg = sg; }
  }
  if (all || what === 'probe') {
    if (B.probe) { for (const m of B.metals) m.reflectionTexture = null; B.probe.dispose(); B.probe = null; }
    if (g.probe) { const pr = new ReflectionProbe('probe', IS_PC ? 256 : 128, sc); pr.position = new Vector3(10, 2, -12); pr.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE; for (const m of sc.meshes) if (m.isVisible) pr.renderList.push(m); for (const m of B.metals) { m.reflectionTexture = pr.cubeTexture; m.environmentIntensity = 0.7; } B.probe = pr; }
  }
  if (all || what === 'glow') B.glow.isEnabled = g.glow;
  const dp: DefaultRenderingPipeline = B.dp;
  if (all || what === 'aa') { dp.fxaaEnabled = g.aa === 'fxaa'; dp.samples = g.aa === 'msaa' ? 4 : 1; }
  if (all || what === 'bloom') { dp.bloomEnabled = g.bloom; dp.bloomThreshold = 0.8; dp.bloomWeight = 0.3; dp.bloomKernel = 64; dp.bloomScale = 0.5; }
  if (all || what === 'aces' || what === 'exposure') { dp.imageProcessingEnabled = true; const ip = dp.imageProcessing; ip.toneMappingEnabled = g.aces; ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES; ip.exposure = g.exposure; ip.contrast = 1.08; }
  if (all || what === 'sharpen') { dp.sharpenEnabled = g.sharpen; dp.sharpen.edgeAmount = 0.22; }
  if (all || what === 'particles') makeFire();
  if (all || /^show(Fps|Cpu|Gpu|Mem)$/.test(what)) perfShow();
}
/** The lounge's fire. */
function makeFire() {
  const lo: Lounge = B.lounge, sc: Scene = B.scene; if (!lo) return; if (lo.fire.ps) { lo.fire.ps.dispose(); lo.fire.ps = null; }
  const hi = S.gfx.particles === 'high', ps = new ParticleSystem('fire', hi ? 900 : 300, sc); ps.particleTexture = lo.fire.tex;
  lo.root.computeWorldMatrix(true); ps.emitter = Vector3.TransformCoordinates(lo.fire.at, lo.root.getWorldMatrix());
  ps.minEmitBox = new Vector3(-0.42, 0, -0.04); ps.maxEmitBox = new Vector3(0.42, 0.04, 0.06);
  ps.color1 = new Color4(1, 0.62, 0.22, 1); ps.color2 = new Color4(1, 0.38, 0.06, 1); ps.colorDead = new Color4(0.25, 0.05, 0, 0);
  ps.minSize = 0.1; ps.maxSize = hi ? 0.3 : 0.36; ps.minLifeTime = 0.25; ps.maxLifeTime = 0.65; ps.emitRate = hi ? 320 : 110; ps.blendMode = ParticleSystem.BLENDMODE_ONEONE; ps.gravity = new Vector3(0, 1.1, 0);
  ps.direction1 = new Vector3(-0.08, 0.9, -0.05); ps.direction2 = new Vector3(0.08, 1.3, 0.08); ps.minEmitPower = 0.15; ps.maxEmitPower = 0.45; ps.updateSpeed = 0.016; ps.start(); lo.fire.ps = ps;
}
/** The lights made by one room's builder light only that room (each material takes only so many lights). */
function keepLights(sc: Scene, from: number, root: TransformNode) { const ms = root.getChildMeshes(); for (const l of sc.lights.slice(from)) { l.includedOnlyMeshes = ms; if (!l.parent) l.parent = root; } }

/** A door that swings on its hinge (the rooms' and the staff door): the meshes, the hinge, which way it opens. */
function swingDoor(meshes: AbstractMesh[], hinge: Vector3, dir: number) { for (const m of meshes) { m.computeWorldMatrix(true); m.setPivotPoint(hinge, Space.WORLD); } return { meshes, dir, k: 0, to: 0 }; }

const Building: Section = {
  id: 'building', title: 'The airport',
  async open(ctx: SectionCtx) {
    const { engine, ui, progress } = ctx; B.ctx = ctx;
    const at: string = (ctx.opts && ctx.opts.at) || 'concourse', D: OfficeData = Object.assign({ airline: 'Your airline', icao: 'AMP', color: '#1C2A4A', color2: '#3FD3E6', hub: '', pilot: 'Captain', balance: '', flying: 0, fleet: 0, routes: [], reports: 0 }, (ctx.opts && ctx.opts.data) || {});
    progress(5, 'Unlocking the building…'); await new Promise(r => setTimeout(r, 30));
    const sc = new Scene(engine); B.scene = sc; sc.clearColor = new Color4(0.02, 0.02, 0.03, 1); sc.skipPointerMovePicking = true;
    const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), sc); hemi.diffuse = Color3.FromHexString('#FFF3E2'); hemi.groundColor = Color3.FromHexString('#3A2A1A');
    const sunK = P.daylight(); hemi.intensity = 0.35 + 0.35 * sunK;
    const sun = new DirectionalLight('sun', new Vector3(0.3, -0.6, 1).normalize(), sc); sun.position = new Vector3(10, 18, -40); sun.intensity = 0.3 + 2.0 * sunK; sun.diffuse = Color3.FromHexString(sunK > 0.3 ? '#FFF0DA' : '#9FB4E0'); B.sun = sun;
    // the rooms, each built by its own builder and set in its place
    let l0 = sc.lights.length; const office = buildOffice(sc, Object.assign({}, D, { suite: true }) as any, (p, s) => progress(5 + p * 0.2, s)); B.office = office; keepLights(sc, l0, office.root);
    l0 = sc.lights.length; const ops = buildOps(sc, D.color, (p, s) => progress(25 + p * 0.15, s)); ops.root.position.set(OPS_AT.x, 0, OPS_AT.z); B.ops = ops; keepLights(sc, l0, ops.root); opsClock(ops);
    l0 = sc.lights.length; const lounge = buildLounge(sc, (p, s) => progress(40 + p * 0.2, s)); lounge.root.rotation.y = Math.PI / 2; lounge.root.position.set(LG.x, 0, LG.z); B.lounge = lounge; keepLights(sc, l0, lounge.root);
    if (lounge.backdrop) lounge.backdrop.setEnabled(false);
    l0 = sc.lights.length; const halls = buildHalls(sc, (p, s) => progress(p, s), sunK); B.halls = halls; keepLights(sc, l0, halls.root);
    // the museum, off the concourse's west wall (turned so its doors face the concourse)
    progress(84, 'Dusting the museum…');
    const items: Exhibit[] = ((ctx.opts && ctx.opts.data && ctx.opts.data.museum) || []) as Exhibit[]; B.items = items;
    l0 = sc.lights.length; const museum = buildMuseum(sc, items, D.color, D.color2, D.airline); museum.root.rotation.y = Math.PI / 2; museum.root.position.set(CON.x0 - museum.D / 2, 0, MUSEUM_DOOR.z); B.museum = museum; keepLights(sc, l0, museum.root);
    museum.root.computeWorldMatrix(true);
    // the Training room, off the corridor's west side, with today's class
    progress(86, 'Setting out the notebooks…');
    l0 = sc.lights.length; const trn = buildTraining(sc, D.airline, D.color, D.color2, (D as any).training || {}); B.trn = trn; keepLights(sc, l0, trn.root);
    B.say = { i: -1, t: 0, line: '' };
    // your suite, through the door in the office's right-hand wall: lit only by its own lights (it can be completely dark)
    l0 = sc.lights.length; const suite: Suite = buildSuite(sc, D.color); B.suite = suite; keepLights(sc, l0, suite.root);
    for (const m of suite.meshes()) { hemi.excludedMeshes.push(m); sun.excludedMeshes.push(m); }
    B.casters = [...office.casters, ...ops.casters, ...lounge.casters, ...halls.casters, ...museum.casters, ...trn.casters, ...suite.casters]; B.metals = [...office.metals, ...ops.metals, ...lounge.metals, ...halls.metals, ...museum.metals, ...trn.metals, ...suite.metals];
    // the doors
    progress(88, 'Opening the doors…');
    const doorOf = (root: TransformNode) => root.getChildMeshes().filter(m => m.metadata && m.metadata.act === 'door');
    lounge.door.metadata = { act: 'loungedoor' };
    B.doors = {
      office: swingDoor(doorOf(office.root), new Vector3(COR.x1, 0, OFFICE_DOOR.z1), 1),
      ops: swingDoor(doorOf(ops.root), new Vector3(COR.x1, 0, OPS_DOOR.z1), 1),
      staff: swingDoor([halls.staffDoor], new Vector3(STAFF_DOOR.x1, 0, CON.z1), -1),
      suiteOffice: swingDoor(suite.doors.office.meshes, suite.doors.office.hinge, suite.doors.office.dir), suiteBath: swingDoor(suite.doors.bath.meshes, suite.doors.bath.hinge, suite.doors.bath.dir), suiteBed: swingDoor(suite.doors.bed.meshes, suite.doors.bed.hinge, suite.doors.bed.dir),
      trnA: swingDoor(trn.doors[0], new Vector3(TRN.x1, 0, TRN_DOOR.z0), -1), trnB: swingDoor(trn.doors[1], new Vector3(TRN.x1, 0, TRN_DOOR.z1), 1),
      lounge: { meshes: lounge.leaves, dir: 1, k: 0, to: 0, base: lounge.leaves.map(m => m.position.clone()) },
      museum: { k: 0, to: 0, near: false, leaves: museum.doors.map((m, i) => ({ m, x0: museum.doorBase[i].x, sgn: Math.sign(museum.doorBase[i].x) || 1 })) },   // the portal's glass leaves slide apart
    };
    for (const m of doorOf(office.root).concat(doorOf(ops.root))) m.metadata = { act: m.parent === ops.root ? 'opsdoor' : 'officedoor' };
    halls.staffDoor.metadata = { act: 'staffdoor' };
    // where you arrive, always on open floor
    const spots: { [k: string]: [number, number, number] } = { museum: [CON.x0 - 2.2, MUSEUM_DOOR.z, -Math.PI / 2], office: [office.spawn.x + 0.4, office.spawn.z + 0.2, office.spawn.yaw], ops: [OPS_AT.x + 0.7, OPS_AT.z - 1.2, 0], lounge: [CON.x1 + 2.6, LOUNGE_DOOR.z, Math.PI / 2], concourse: [8, -10.2, Math.PI / 2], training: [trn.spawn.x, trn.spawn.z, trn.spawn.yaw] };
    const sp = spots[at] || spots.concourse, [fx, fz] = freeNear(sp[0], sp[1]);
    if (at === 'lounge') B.doors.lounge.k = B.doors.lounge.to = 1;
    if (at === 'training') { B.doors.trnA.k = B.doors.trnA.to = 1; B.doors.trnB.k = B.doors.trnB.to = 1; for (const d of [B.doors.trnA, B.doors.trnB]) for (const m of d.meshes) m.rotation.y = d.dir * Math.PI * 0.55; }
    B.hold = null;
    const F = { x: fx, z: fz, yaw: sp[2], pitch: -0.04, v: 0, bob: 0, sit: '' as string }; B.F = F;
    const cam = new UniversalCamera('eyes', new Vector3(F.x, EYE, F.z), sc); cam.minZ = 0.03; cam.maxZ = 260; cam.inertia = 0; B.cam = cam; sc.activeCamera = cam;
    B.glow = new GlowLayer('glow', sc, { mainTextureRatio: IS_PC ? 0.5 : 0.35, blurKernelSize: 40 }); B.glow.intensity = 0.55;
    B.dp = new DefaultRenderingPipeline('dp', true, sc, [cam]);
    // the bar in the lounge: the bartender, the drinks, and what they do to you
    try { const bar: Bar = buildBar(sc, lounge.root, cam, D.color); B.bar = bar; const bm = bar.bartender.meshes;
      for (const l of sc.lights) if (l.parent === lounge.root && l.includedOnlyMeshes) for (const m of bm) l.includedOnlyMeshes.push(m); } catch (e) { console.error(e); B.bar = null; }
    apply('all');
    gameSend({ ampb: 'monitor', on: true });
    // on the screen: back to the game, where you are, and in Operations its buttons
    const hud = document.createElement('div'); hud.className = 'hud';
    hud.innerHTML = `<div class="aim" hidden></div><div class="of-hint" hidden></div>
      <div class="v3d-top"><button class="v3d-b" data-go="">${icon('back')}<span>Back to the game</span></button><div class="bd-where v3d-info"><b class="v3d-cs"></b></div></div>
      <button class="v3d-b bd-coll" data-coll="1">${icon('star')}<span>Collection (${items.length})</span></button>
      <div class="bd-list" hidden><div class="bd-lh"><b>Your collection</b><small>${items.length ? 'Everything you and your airline have been given or earned. Tap one to go to it and hold it.' : 'Nothing yet: gifts from the airports, awards and badges appear here.'}</small></div>
        <div class="bd-items">${items.map((e, i) => `<button class="bd-it" data-piece="${i}"><b>${esc(e.title)}</b><small>${esc(e.sub)}</small></button>`).join('')}</div></div>
      <div class="bar-menu" hidden><div class="bar-mh"><b>The bar</b><small>What would you like?</small><button class="v3d-b" data-bar="close">✕</button></div>
        <div class="bar-list">${DRINKS.map(d => `<button class="bar-it" data-bar="${d.id}"><b>${esc(d.name)}</b><small>${esc(d.what)} · ${d.abv} % · ${d.ml} ml${d.abv ? ` · ${grams(d).toFixed(1)} g alcohol` : ''}</small></button>`).join('')}</div></div>
      <div class="bar-hold" hidden><button class="v3d-b" data-bar="sip">Sip</button><button class="v3d-b" data-bar="down">Put it down</button></div>
      <div class="trn-say" hidden><b></b><span></span><button class="v3d-b trn-voice" data-trn="voice">Voice: off</button></div>
      <div class="trn-box" hidden><button class="v3d-b trn-x" data-trn="close" aria-label="Close">✕</button><b class="trn-n"></b><small class="trn-r"></small><p class="trn-c"></p></div>
      <div class="ops-bar" hidden>${[['ops', 'Operations'], ['schedule', 'Schedule'], ['dispatch', 'Dispatch'], ['planner', 'Flight planner']].map(([k, l]) => `<button class="v3d-b" data-go="${k}">${l}</button>`).join('')}</div>`;
    ui.appendChild(hud); B.hud = hud; perfAttach(engine, sc, hud); perfShow();
    hud.addEventListener('click', (e: Event) => {
      const t = e.target as HTMLElement, b = t.closest('[data-go]') as HTMLElement; if (b && ctx.toGame) { ctx.toGame(b.getAttribute('data-go') || ''); return; }
      const bb = t.closest('[data-bar]') as HTMLElement; if (bb && B.bar) { const k = bb.getAttribute('data-bar') as string, menu = hud.querySelector('.bar-menu') as HTMLElement;
        if (k === 'close') menu.hidden = true; else if (k === 'sip') { const r = B.bar.sip(); if (r) toast(r); } else if (k === 'down') B.bar.putDown(); else { menu.hidden = true; const r = B.bar.order(k); if (r) toast(r); } return; }
      const tb = t.closest('[data-trn]') as HTMLElement; if (tb) { const k = tb.getAttribute('data-trn'); if (k === 'close') (hud.querySelector('.trn-box') as HTMLElement).hidden = true; else if (k === 'voice') { B.voice = !B.voice; tb.textContent = B.voice ? 'Voice: on' : 'Voice: off'; if (!B.voice) try { speechSynthesis.cancel(); } catch (err) { /* none */ } } return; }
      if (t.closest('[data-coll]')) { const l = hud.querySelector('.bd-list') as HTMLElement; l.hidden = !l.hidden; return; }
      const pc = t.closest('[data-piece]') as HTMLElement; if (pc) { (hud.querySelector('.bd-list') as HTMLElement).hidden = true; goToPiece(Number(pc.getAttribute('data-piece'))); }
    });
    // opened for one piece of the collection ("in 3D" in the game): straight to it, in your hands
    { const ft = ctx.opts && ctx.opts.data && ctx.opts.data.focus; if (ft) { const i = items.findIndex(e => e.title === ft); if (i >= 0) setTimeout(() => { try { goToPiece(i); } catch (e) { /* the museum */ } }, 300); } }
    if (ctx.opts && ctx.opts.data && ctx.opts.data.stress) { S.gfx.showFps = true; perfShow(); }
    toast(IS_TOUCH ? 'Left thumb: walk · Right: drag to look · tap a door to open it' : 'W A S D to walk · click to look with the mouse · E or click a door to open it');
    let down: any = null; const cv = ctx.canvas;
    B.pd = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; };
    B.pu = (e: PointerEvent) => { if (!down) return; const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), quick = performance.now() - down.t < 350; down = null; if (moved < 8 && quick && isPlay() && !document.pointerLockElement) use(e.clientX, e.clientY); };
    cv.addEventListener('pointerdown', B.pd); cv.addEventListener('pointerup', B.pu);
    B.btn = (b: string) => { if (B.scene && b === 'confirm' && isPlay()) use(); }; onButton(B.btn);
    let hintT = 0, clockT = 0, boardT = 0, here = '';
    runLoop(() => {
      perfBegin();
      const dt = Math.min(0.05, engine.getDeltaTime() / 1000), now = performance.now() / 1000, inp = inputFrame(dt);
      F.yaw += inp.lx; F.pitch = Math.max(-1.2, Math.min(1.0, F.pitch - inp.ly));
      if (F.sit) { const s = F.sit === 'bed' ? { x: B.suite.bed.x, z: B.suite.bed.z, yaw: B.suite.bed.yaw } : F.sit === 'office' ? { x: office.seat.x, z: office.seat.z - 0.05, yaw: office.seat.yaw } : { x: OPS_AT.x + ops.seat.x, z: OPS_AT.z + ops.seat.z, yaw: ops.seat.yaw };
        F.yaw = Math.max(s.yaw - 1.5, Math.min(s.yaw + 1.5, F.yaw)); cam.position.set(s.x, F.sit === 'bed' ? 0.95 : SIT, s.z); }
      else {
        const vmax = inp.run ? 2.6 : 1.4, mag = Math.min(1, Math.hypot(inp.mx, inp.my)); F.v += ((mag > 0.05 ? vmax * mag : 0) - F.v) * Math.min(1, dt * 6);
        if (mag > 0.05) { const fx2 = Math.sin(F.yaw), fz2 = Math.cos(F.yaw), rx = Math.cos(F.yaw), rz = -Math.sin(F.yaw);
          let mx = fx2 * inp.my + rx * inp.mx, mz = fz2 * inp.my + rz * inp.mx; const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml;
          const st = F.v * dt, nx = F.x + mx * st, nz = F.z + mz * st;
          if (walkable(nx, nz)) { F.x = nx; F.z = nz; } else if (walkable(nx, F.z)) F.x = nx; else if (walkable(F.x, nz)) F.z = nz; F.bob += st; }
        cam.position.set(F.x, EYE - (B.office && B.office.pet ? B.office.pet.kneel * 0.95 : 0) + Math.sin(F.bob / 0.65 * Math.PI) * 0.015 * Math.min(1, F.v / 1.1), F.z);
      }
      const cp = Math.cos(F.pitch); cam.setTarget(cam.position.add(new Vector3(Math.sin(F.yaw) * cp, Math.sin(F.pitch), Math.cos(F.yaw) * cp)));
      // the lounge's doors slide open as you come up to them, and shut behind you
      const Lg = B.doors.lounge, near = Math.hypot(F.x - CON.x1, F.z - LOUNGE_DOOR.z) < 2.6; Lg.to = near ? 1 : Lg.to === 1 && !near ? 0 : Lg.to;
      // the Vortex Gallery's glass doors slide apart as you come up to them (either side), and shut behind you
      { const Md = B.doors.museum, nr = Math.hypot(F.x - CON.x0, F.z - MUSEUM_DOOR.z) < 2.8; if (nr !== Md.near) { Md.near = nr; Md.to = nr ? 1 : 0; }
        if (Math.abs(Md.k - Md.to) > 0.001) { Md.k += Math.sign(Md.to - Md.k) * Math.min(Math.abs(Md.to - Md.k), dt * 1.8); const e = Md.k * Md.k * (3 - 2 * Md.k); for (const L of Md.leaves) L.m.position.x = L.x0 + L.sgn * e * (MUSEUM_DOOR.w / 2 - 0.08); } }
      // a piece in your hands: it turns slowly
      if (B.hold) B.hold.node.rotation.y += dt * 0.6;
      // the Training room: the instructor's lesson, line by line, on the board and spoken if you like
      trainStep(now, dt);
      for (const k of ['office', 'ops', 'staff', 'lounge', 'trnA', 'trnB', 'suiteOffice', 'suiteBath', 'suiteBed']) { const d = B.doors[k]; if (Math.abs(d.k - d.to) > 0.001) { d.k += Math.sign(d.to - d.k) * Math.min(Math.abs(d.to - d.k), dt * (k === 'lounge' ? 2.2 : 1.6)); const e = d.k * d.k * (3 - 2 * d.k);
        if (k === 'lounge') d.meshes.forEach((m: AbstractMesh, i: number) => { const b0: Vector3 = d.base[i], s = b0.x > DOOR_X ? 1 : -1; m.position.x = b0.x + s * e * (DOOR_W / 2 - 0.05); });
        else for (const m of d.meshes) m.rotation.y = d.dir * e * Math.PI * 0.55; } }
      // where you are
      const w = where(F.x, F.z); if (w && w !== here) { here = w; (hud.querySelector('.bd-where .v3d-cs') as HTMLElement).textContent = ({ office: 'Your office', ops: 'The Operations office', corridor: 'The staff corridor', concourse: 'The concourse', lounge: 'The Business lounge', museum: 'The museum', training: 'The Training room', suite: 'Your suite' } as any)[w]; (hud.querySelector('.ops-bar') as HTMLElement).hidden = w !== 'ops'; }
      if (now > hintT) { hintT = now + 0.15; const h = pick(); const el = hud.querySelector('.of-hint') as HTMLElement; let t = h ? HINTS[h.replace(/^(office|ops)door$/, 'door').replace('loungedoor', 'door')] || '' : ''; if (h === 'chair' && F.sit) t = 'Stand up'; el.hidden = !t || IS_TOUCH; if (t) el.textContent = t; }
      if (now > clockT) { clockT = now + 10; opsClock(ops); }
      if (now > boardT) { boardT = now + 30; for (const b of [...lounge.boards, ...halls.boards]) { P.board(b.c, b.kind); (b.tex.getContext() as any).drawImage(b.c, 0, 0); b.tex.update(true); } }
      if (lounge.fire.light) lounge.fire.light.intensity = 2.6 + 0.9 * Math.sin(now * 9) * Math.sin(now * 4.7);
      (hud.querySelector('.aim') as HTMLElement).hidden = !(IS_PC && document.pointerLockElement);
      if (B.office && B.office.pet) B.office.pet.step(now, dt);
      if (B.suite) B.suite.step(now, dt);
      if (B.bar) { const lr = B.lounge.root as TransformNode, inv = Matrix.Invert(lr.getWorldMatrix()), me = Vector3.TransformCoordinates(new Vector3(F.x, 0, F.z), inv), yr = dt > 0 ? (F.yaw - (B.lastYaw ?? F.yaw)) / dt : 0; B.lastYaw = F.yaw;
        const r = B.bar.step(now, dt, me, yr); if (B.bar.drunk > 0.01 && !F.sit) { F.yaw += r.dYaw; const nx = F.x + r.dx, nz = F.z + r.dz; if (walkable(nx, nz)) { F.x = nx; F.z = nz; } cam.position.y += r.eye; cam.rotation.z = r.roll; } else cam.rotation.z = 0;
        (hud.querySelector('.bar-hold') as HTMLElement).hidden = !B.bar.holding; }
      sc.render(); perfEnd();
    });
  },
  close() {
    const sc: Scene = B.scene; if (!sc) return;
    try { speechSynthesis.cancel(); } catch (e) { /* none */ }
    gameSend({ ampb: 'monitor', on: false });
    try { B.ctx.canvas.removeEventListener('pointerdown', B.pd); B.ctx.canvas.removeEventListener('pointerup', B.pu); } catch (e) { /* gone */ }
    perfDetach(); if (B.hud) B.hud.remove(); sc.dispose(); B.scene = null;
  },
  onSettings(what: string) { apply(what === 'preset' ? 'all' : what); },
};
function pick(px?: number, py?: number): string { const m = pickMeta(px, py); return m ? m.act : ''; }
function pickMeta(px?: number, py?: number): any {
  const sc: Scene = B.scene, cv = B.ctx.canvas as HTMLCanvasElement; if (!sc) return null;
  const e = sc.getEngine(), x = px != null ? px * (e.getRenderWidth() / cv.clientWidth) : e.getRenderWidth() / 2, y = py != null ? py * (e.getRenderHeight() / cv.clientHeight) : e.getRenderHeight() / 2;
  const hit = sc.pick(x, y, (m: any) => !!(m.metadata && m.metadata.act) && m.isEnabled());
  return hit && hit.hit && hit.distance < 3.4 && hit.pickedMesh ? (hit.pickedMesh as Mesh).metadata : null;
}
/** Take a piece in your hands (in front of you, turning slowly), or put it back on its plinth. */
function holdPiece(i: number) {
  const M: Museum = B.museum; if (B.hold) { const h = B.hold; h.node.parent = h.parent; h.node.position.copyFrom(h.pos); h.node.rotation.copyFrom(h.rot); B.hold = null; if (h.i === i) return; }
  const pc = M && M.pieces[i]; if (!pc) return;
  B.hold = { i, node: pc.node, parent: pc.node.parent, pos: pc.node.position.clone(), rot: pc.node.rotation.clone() };
  pc.node.parent = B.cam; pc.node.position.set(0, -0.32, 0.85); pc.node.rotation.set(0.15, 0, 0);
  toast(`${pc.e.title} · ${pc.e.sub}`);
}
/** From the Collection list: to the piece (into the museum if you are elsewhere), facing it, and into your hands. */
function goToPiece(i: number) {
  const M: Museum = B.museum, pc = M && M.pieces[i], F = B.F; if (!pc) return;
  M.root.computeWorldMatrix(true); const w = Vector3.TransformCoordinates(pc.at, M.root.getWorldMatrix()), p = Vector3.TransformCoordinates(pc.node.position, M.root.getWorldMatrix());
  F.sit = ''; const [x, z] = freeNear(w.x, w.z); F.x = x; F.z = z; F.yaw = Math.atan2(p.x - x, p.z - z); F.pitch = -0.25;
  if (B.hold) holdPiece(B.hold.i); holdPiece(i);
}
function use(px?: number, py?: number) {
  const a = pick(px, py), F = B.F, ctx: SectionCtx = B.ctx; if (!a) { if (B.hold) holdPiece(B.hold.i); return; }
  const toGame = (screen: string) => { if (ctx.toGame) ctx.toGame(screen); };
  const door = (k: string) => { const d = B.doors[k]; d.to = d.to > 0.5 ? 0 : 1; vibrate(60, 0.2, 0.3); };
  if (a === 'officedoor') return door('office');
  if (a === 'opsdoor') return door('ops');
  if (a === 'staffdoor') return door('staff');
  if (a === 'trndoor') { const o = B.doors.trnA.to > 0.5 ? 0 : 1; B.doors.trnA.to = o; B.doors.trnB.to = o; vibrate(60, 0.2, 0.3); return; }
  if (a === 'trn') { const m = pickMeta(px, py); if (m) showPerson(m.id); return; }
  if (a === 'whiteboard') { const T: Training = B.trn; toast(T.subject ? `Today: ${Array.from(new Set(Object.values(T.people).filter(q => q.s).map(q => q.s!.course))).join(' · ')}` : 'No class today: courses are booked in Crew → Training'); return; }
  if (a === 'books') { toast('Aviation books: flight, cabin crew, ground operations, maintenance and more'); return; }
  if (a === 'teacherdesk' || a === 'desk') { toast(a === 'desk' ? 'A desk with the Academy notebook' : 'The instructor\'s desk'); return; }
  if (a === 'clock') { toast(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })); return; }
  if (a === 'loungedoor') return door('lounge');
  if (a === 'museumdoor') { const d = B.doors.museum; d.to = d.to > 0.5 ? 0 : 1; vibrate(60, 0.2, 0.3); return; }
  if (a === 'piece') { const m = pickMeta(px, py); if (m) holdPiece(m.i); return; }
  if (/^suitedoor-/.test(a)) return door(a === 'suitedoor-office' ? 'suiteOffice' : a === 'suitedoor-bath' ? 'suiteBath' : 'suiteBed');
  if (a === 'wardrobe') { if (ctx.toGame) { ctx.toGame(''); setTimeout(() => gameSend({ ampb: 'wardrobe' }), 150); } else toast('Your wardrobe: open it from the game'); return; }
  if (a === 'bed') { if (F.sit === 'bed') { F.sit = ''; const [x, z] = freeNear(B.suite.bed.x, B.suite.bed.z - 1.6); F.x = x; F.z = z; F.pitch = -0.05; return; } F.sit = 'bed'; F.yaw = B.suite.bed.yaw; F.pitch = 0.55; toast('Lying down · tap the bed again to get up'); return; }
  if (['toilet', 'basin', 'shower', 'bath', 'mirror', 'clock', 'armchair', 'lamp', 'switch'].indexOf(a) >= 0 && B.suite) { const t = B.suite.use(a); if (t) toast(t); vibrate(40, 0.1, 0.2); return; }
  if (a === 'bartender' && B.bar) { (B.hud.querySelector('.bar-menu') as HTMLElement).hidden = false; return; }
  if (a === 'drink' && B.bar) { const r = B.bar.holding ? B.bar.sip() : B.bar.pickUp(); if (r) toast(r); return; }
  if (a === 'chair') { const w = where(F.x, F.z); if (F.sit) { F.sit = ''; if (w === 'office' || F.x < 3.2 && F.z < 3.2 && F.z > -3.2) { F.x = B.office.seat.x + 0.7; F.z = B.office.seat.z - 0.3; } else { F.x = OPS_AT.x + 0.7; F.z = OPS_AT.z + B.ops.seat.z - 0.4; } return; }
    F.sit = w === 'ops' ? 'ops' : 'office'; F.yaw = F.sit === 'office' ? B.office.seat.yaw : B.ops.seat.yaw; F.pitch = -0.2; return; }
  if (a === 'laptop') return toGame('ops');
  if (a === 'planner') return toGame('planner');
  if (a === 'map') return toGame('routes');
  if (a === 'reports') return toGame('pilots');
  if (a === 'monitor') return toGame('schedule');
  if (a === 'files') { toast('The archive: every flight on file'); return; }
  if (a === 'shop') { toast('The shops open with the passengers'); return; }
  if (a === 'seat') { toast('A seat by the window, onto the apron'); return; }
  if (a === 'board') { toast('Departures and Arrivals'); return; }
  if (a === 'phone') { toast('No calls right now'); return; }
  if (a === 'pet' && B.office.pet) { B.office.pet.stir(); return; }
  if (a === 'bowl-food' && B.office.pet) { B.office.pet.cam = B.office.pet.cam || (B.cam); if (!B.office.pet.pickup()) toast('Just a moment'); return; }
  if ((a === 'bowl-water' || a === 'bowl-food') && B.office.pet) { if (!B.office.pet.refill(a === 'bowl-food' ? 'food' : 'water')) toast(a === 'bowl-food' ? 'The bowl is full' : 'The water bowl is full'); return; }
  if (a === 'globe') { toast('The world your airline flies'); return; }
  if (a === 'model') { toast('A model of one of your aircraft, in the company colours'); return; }
}
/** The lesson: the instructor's lines one after another while there is a class, on the board, under the screen and spoken. */
function trainStep(now: number, dt: number) {
  const T: Training = B.trn, S2 = B.say; if (!T) return;
  const inRoom = where(B.F.x, B.F.z) === 'training', lines = T.lines;
  T.step(now, dt, !!S2.line && inRoom);
  if (now - (B.clk || 0) > 5) { B.clk = now; T.clock(); }
  const bar = B.hud.querySelector('.trn-say') as HTMLElement;
  if (!inRoom || !lines.length) { bar.hidden = true; S2.line = ''; return; }
  if (now > S2.t) { S2.i = (S2.i + 1) % lines.length; S2.line = lines[S2.i]; S2.t = now + Math.max(6, S2.line.length / 13 + 2); T.board(S2.line);
    (bar.querySelector('b') as HTMLElement).textContent = (T.teacher && (B.ctx.opts?.data?.training?.teacher?.name)) || 'Daniel Brandt'; (bar.querySelector('span') as HTMLElement).textContent = S2.line;
    if (B.voice) try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(S2.line); u.rate = 0.98; u.lang = 'en-GB'; speechSynthesis.speak(u); } catch (e) { /* no voice */ } }
  bar.hidden = false;
}
/** Who someone in the Training room is: their name, their job, the course and how long it still runs. */
function showPerson(id: string) {
  const T: Training = B.trn, q = T && T.people[id], box = B.hud.querySelector('.trn-box') as HTMLElement; if (!q) return;
  const t = B.ctx.opts?.data?.training?.teacher || { name: 'Daniel Brandt', title: 'Instructor, the Academy' };
  if (id === 'teacher') { (box.querySelector('.trn-n') as HTMLElement).textContent = t.name; (box.querySelector('.trn-r') as HTMLElement).textContent = t.title; (box.querySelector('.trn-c') as HTMLElement).textContent = B.say.line || (T.lines.length ? 'Teaching the class.' : 'Getting the next class ready.'); }
  else { const s = q.s!, left = Math.max(0, s.until - Date.now()), hrs = left / 36e5;
    (box.querySelector('.trn-n') as HTMLElement).textContent = s.name; (box.querySelector('.trn-r') as HTMLElement).textContent = s.role;
    (box.querySelector('.trn-c') as HTMLElement).textContent = `${s.course} · ${hrs >= 24 ? Math.round(hrs / 24) + ' days' : hrs >= 1 ? Math.round(hrs) + ' h' : Math.max(1, Math.round(left / 6e4)) + ' min'} to go`; }
  box.hidden = false;
}
registerSection(Building);
export {};
