// The bar in the lounge: a bartender who is always there, the bottles on the shelf, the glasses hanging over the
// counter, drinks poured in front of you, and what too many of them do to you.
//  - The bartender stands behind the counter swaying a little. Come within about 2.5 m and he turns to you and waves;
//    tap him for the drinks: what each is, how strong (ABV) and how much alcohol is in a serving.
//  - He turns to the shelf, takes the bottle, sets a glass on the counter and pours: the drink rises in the glass until
//    he stops. He puts the bottle back; the glass is yours to pick up.
//  - In your hand the drink moves as you move (a hard swing spills some), and each sip is alcohol: how much depends on
//    the drink's strength (grams of alcohol, Widmark's formula for the blood alcohol).
//  - Drunk: your walk wobbles and drifts, your knees give a little now and then, the view sways, blurs and doubles.
//    It wears off in about 10 to 25 seconds, the more you drank the longer.
// In the lounge's own frame (Babylon.js: x across, z towards the room from the back wall), the bar where the lounge has it.
import { Scene, Vector3, Color3, Mesh, MeshBuilder, PBRMaterial, TransformNode, AbstractMesh, PostProcess, Effect, Camera } from '@babylonjs/core';
import { buildPerson, posePerson, stridePerson, Person } from '../court/people';
import { LW, LD } from './build';

interface Drink { id: string; name: string; what: string; abv: number; ml: number; glass: string; col: string; op: number }
export const DRINKS: Drink[] = [
  { id: 'red', name: 'Red wine', what: 'Bordeaux, dry and full', abv: 13.5, ml: 150, glass: 'wine', col: '#5E0B16', op: 0.92 },
  { id: 'white', name: 'White wine', what: 'Chablis, crisp and dry', abv: 12.5, ml: 150, glass: 'wine', col: '#E9D98A', op: 0.55 },
  { id: 'champagne', name: 'Champagne', what: 'Brut, from Reims', abv: 12, ml: 125, glass: 'flute', col: '#F0DE96', op: 0.5 },
  { id: 'whisky', name: 'Single malt whisky', what: '12 years old, from Speyside', abv: 40, ml: 40, glass: 'tumbler', col: '#B8661C', op: 0.78 },
  { id: 'gin', name: 'London dry gin', what: 'Juniper and citrus', abv: 40, ml: 40, glass: 'tumbler', col: '#EAF4F6', op: 0.25 },
  { id: 'vodka', name: 'Vodka', what: 'Clean and neutral, ice cold', abv: 40, ml: 40, glass: 'shot', col: '#F4F8FA', op: 0.2 },
  { id: 'aquavit', name: 'Aquavit', what: 'Nordic, caraway and dill', abv: 42, ml: 40, glass: 'shot', col: '#F2EAC8', op: 0.25 },
  { id: 'rum', name: 'Dark rum', what: 'Aged in oak, from the Caribbean', abv: 40, ml: 40, glass: 'tumbler', col: '#6E3410', op: 0.85 },
  { id: 'cognac', name: 'Cognac', what: 'VSOP, warm and smooth', abv: 40, ml: 40, glass: 'snifter', col: '#A4561A', op: 0.8 },
  { id: 'port', name: 'Port', what: 'Tawny, 10 years old', abv: 20, ml: 75, glass: 'small', col: '#7A2412', op: 0.9 },
  { id: 'amaretto', name: 'Amaretto', what: 'Almond liqueur, sweet', abv: 28, ml: 40, glass: 'tumbler', col: '#9A4A14', op: 0.8 },
  { id: 'water', name: 'Sparkling water', what: 'With a slice of lemon', abv: 0, ml: 250, glass: 'tumbler', col: '#EEF6F8', op: 0.15 },
];
export const grams = (d: Drink) => d.ml * d.abv / 100 * 0.789;
const GLASSES: { [k: string]: { out: number[][]; inn: number[][]; base: number; top: number } } = {
  wine: { out: [[0, 0], [0.036, 0.001], [0.036, 0.004], [0.005, 0.008], [0.0035, 0.02], [0.0035, 0.085], [0.012, 0.095], [0.036, 0.12], [0.043, 0.15], [0.041, 0.18], [0.035, 0.215]], inn: [[0, 0], [0.03, 0.022], [0.04, 0.052], [0.039, 0.08], [0.033, 0.115]], base: 0.096, top: 0.05 },
  flute: { out: [[0, 0], [0.032, 0.001], [0.032, 0.004], [0.004, 0.008], [0.003, 0.02], [0.003, 0.09], [0.012, 0.1], [0.026, 0.13], [0.028, 0.2], [0.025, 0.235]], inn: [[0, 0], [0.022, 0.025], [0.025, 0.08], [0.023, 0.13]], base: 0.1, top: 0.095 },
  tumbler: { out: [[0, 0], [0.04, 0], [0.042, 0.012], [0.044, 0.09]], inn: [[0, 0], [0.038, 0.002], [0.041, 0.078]], base: 0.012, top: 0.028 },
  shot: { out: [[0, 0], [0.022, 0], [0.023, 0.012], [0.026, 0.065]], inn: [[0, 0], [0.02, 0.002], [0.024, 0.052]], base: 0.012, top: 0.04 },
  snifter: { out: [[0, 0], [0.034, 0.001], [0.034, 0.004], [0.006, 0.008], [0.005, 0.04], [0.02, 0.05], [0.048, 0.085], [0.05, 0.11], [0.04, 0.14], [0.034, 0.155]], inn: [[0, 0], [0.04, 0.025], [0.046, 0.055], [0.036, 0.09]], base: 0.05, top: 0.028 },
  small: { out: [[0, 0], [0.03, 0.001], [0.03, 0.004], [0.004, 0.008], [0.003, 0.02], [0.003, 0.07], [0.01, 0.078], [0.028, 0.1], [0.031, 0.125], [0.027, 0.155]], inn: [[0, 0], [0.024, 0.02], [0.029, 0.045], [0.025, 0.075]], base: 0.079, top: 0.04 },
};

// the drunk view: swaying, blurred, doubled (any screen shape)
Effect.ShadersStore['drunkFragmentShader'] = `precision highp float; varying vec2 vUV; uniform sampler2D textureSampler; uniform float uK; uniform float uT;
void main() { vec2 uv = vUV; float k = uK; uv += vec2(sin(uT * 1.3 + uv.y * 4.0), cos(uT * 1.1 + uv.x * 3.0)) * 0.004 * k;
  vec2 off = vec2(0.012 + 0.006 * sin(uT * 0.7), 0.004 * cos(uT * 0.9)) * k; vec4 a = texture2D(textureSampler, uv), b = texture2D(textureSampler, uv + off);
  vec4 bl = (texture2D(textureSampler, uv + vec2(0.003, 0.0) * k) + texture2D(textureSampler, uv - vec2(0.003, 0.0) * k) + texture2D(textureSampler, uv + vec2(0.0, 0.003) * k) + texture2D(textureSampler, uv - vec2(0.0, 0.003) * k)) * 0.25;
  vec4 c = mix(a, bl, min(1.0, k * 0.8)); gl_FragColor = mix(c, b, 0.35 * min(1.0, k)); }`;

export interface Bar {
  bartender: Person; menuOpen: boolean; holding: boolean; drunk: number; hits: AbstractMesh[];
  near(px: number, pz: number): boolean; order(id: string): string; pickUp(): string; sip(): string; putDown(): void;
  step(t: number, dt: number, local: Vector3, camYawRate: number): { dYaw: number; dx: number; dz: number; roll: number; eye: number };
  dispose(): void;
}

export function buildBar(sc: Scene, root: TransformNode, cam: Camera, accent: string): Bar {
  const X0 = -LW / 2, Z1 = LD / 2, V = (x: number, y: number, z: number) => new Vector3(x, y, -z);
  const bxp = X0 + 3.2, bz = Z1 - 1.2, counterY = 1.13;
  const mats = new Map<string, PBRMaterial>(), hits: AbstractMesh[] = [];
  // the bartender, behind the counter, in a dark waistcoat with your colour's tie
  const home = V(bxp, 0, bz + 0.62), seat = { id: 'bartender', x: home.x, y: 0, z: home.z, yaw: 0, sit: 0 };
  const P = buildPerson(sc, { key: 'counsel-bartender', seat: 'bartender', sex: 'm', name: 'Marco', sit: 0 }, seat, accent, mats);
  P.root.parent = root; for (const m of P.meshes) { m.isPickable = true; m.metadata = { act: 'bartender' }; hits.push(m); }
  const apron = MeshBuilder.CreateBox('bar-apron', { width: 0.36, height: 0.55, depth: 0.02 }, sc), am = new PBRMaterial('bar-apronM', sc); am.albedoColor = Color3.FromHexString('#141414'); am.roughness = 0.8; am.metallic = 0;
  apron.material = am; apron.parent = P.hip; apron.position.set(0, -0.12, 0.13); apron.isPickable = true; apron.metadata = { act: 'bartender' }; hits.push(apron);
  // the bottle he pours from, and the glass that is poured
  const glassM = new PBRMaterial('bar-glassM', sc); glassM.albedoColor = Color3.FromHexString('#F4FAFF'); glassM.alpha = 0.22; glassM.roughness = 0.04; glassM.metallic = 0; glassM.backFaceCulling = false;
  const bottle = MeshBuilder.CreateLathe('bar-bottle', { shape: [[0, 0], [0.036, 0.002], [0.037, 0.2], [0.033, 0.225], [0.02, 0.245], [0.014, 0.26], [0.0135, 0.31], [0, 0.31]].map(p => new Vector3(p[0], p[1], 0)), tessellation: 18, closed: true }, sc);
  const bm = new PBRMaterial('bar-bottleM', sc); bm.albedoColor = Color3.FromHexString('#1E3A1E'); bm.alpha = 0.65; bm.roughness = 0.08; bm.metallic = 0; bottle.material = bm; bottle.parent = root; bottle.setEnabled(false); bottle.isPickable = false;
  let glass: { node: TransformNode; outer: Mesh; liquid: Mesh; lm: PBRMaterial; d: Drink; fill: number; sips: number; G: any } | null = null;
  const makeGlass = (d: Drink) => {
    const G = GLASSES[d.glass], node = new TransformNode('bar-glass', sc); node.parent = root;
    const outer = MeshBuilder.CreateLathe('bar-glassO', { shape: G.out.map(p => new Vector3(p[0], p[1], 0)), tessellation: 28, sideOrientation: Mesh.DOUBLESIDE }, sc); outer.material = glassM; outer.parent = node; outer.isPickable = true; outer.metadata = { act: 'drink' };
    const lm = new PBRMaterial('bar-liq', sc); lm.albedoColor = Color3.FromHexString(d.col); lm.alpha = d.op; lm.roughness = 0.05; lm.metallic = 0;
    const liquid = MeshBuilder.CreateLathe('bar-liq', { shape: G.inn.map(p => new Vector3(p[0] * 0.97, p[1], 0)), tessellation: 24, closed: true }, sc); liquid.material = lm; liquid.parent = node; liquid.position.y = G.base; liquid.isPickable = true; liquid.metadata = { act: 'drink' };
    liquid.scaling.y = 0.001; hits.push(outer, liquid);
    return { node, outer, liquid, lm, d, fill: 0, sips: 0, G };
  };
  const S: any = { st: 'idle', t: 0, order: null as Drink | null, waved: 0, drunk: 0, knee: 0, kneeT: 4, spillT: 0, holding: false };
  const glassSpot = V(bxp + 0.15, counterY, bz - 0.12);
  const api: Bar = {
    bartender: P, menuOpen: false, get holding() { return S.holding; }, get drunk() { return S.drunk; }, hits,
    near(px, pz) { return Math.hypot(px - home.x, pz - home.z) < 2.6; },
    order(id) {
      const d = DRINKS.filter(x => x.id === id)[0]; if (!d) return ''; if (S.st !== 'idle') return 'One at a time…'; if (glass && !S.holding) return 'Your drink is on the counter';
      if (glass && S.holding) return 'Finish the one in your hand first';
      S.order = d; S.st = 'turn'; S.t = 0; return `${d.name}, coming up`;
    },
    pickUp() { if (!glass || S.st !== 'idle' || S.holding) return ''; S.holding = true; glass.node.parent = cam; glass.node.position.set(0.16, -0.24, 0.48); glass.node.rotation.set(0, 0, 0); return `${glass.d.name} · ${glass.d.abv} % · tap to sip`; },
    sip() {
      if (!glass || !S.holding) return ''; glass.sips++; const share = 1 / 3; S.drunk = Math.min(1.6, S.drunk + grams(glass.d) * share * 0.03);
      glass.fill = Math.max(0, glass.fill - share); glass.liquid.scaling.y = Math.max(0.001, glass.fill); glass.node.rotation.x = -0.6; setTimeout(() => { if (glass) glass.node.rotation.x = 0; }, 450);
      if (glass.fill <= 0.01) { const n = glass.d.name; glass.node.dispose(); glass = null; S.holding = false; return `${n}: finished`; }
      return glass.d.abv ? `A sip of ${glass.d.name.toLowerCase()}` : 'Refreshing';
    },
    putDown() { if (!glass || !S.holding) return; S.holding = false; glass.node.parent = root; glass.node.position.copyFrom(glassSpot); glass.node.rotation.set(0, 0, 0); },
    step(t, dt, me, yawRate) {
      // the bartender: turns to you and waves when you come near, sways; serves an order
      const d = Math.hypot(me.x - home.x, me.z - home.z), toMe = Math.atan2(me.x - P.root.position.x, me.z - P.root.position.z);
      let want = 0, walking = 0;
      if (S.st === 'idle') { want = d < 2.6 ? toMe : 0; if (d < 2.6 && !S.waved) { S.waved = 1.6; } if (d > 4) S.waved = 0; }
      else { S.t += dt;
        if (S.st === 'turn') { want = Math.PI; if (S.t > 0.9) { S.st = 'take'; S.t = 0; bottle.setEnabled(true); bm.albedoColor = Color3.FromHexString(S.order.col).scale(0.6); } }
        else if (S.st === 'take') { want = Math.PI; bottle.position.set(home.x + 0.18, 1.2, home.z - 0.35); if (S.t > 0.6) { S.st = 'back'; S.t = 0; } }
        else if (S.st === 'back') { want = 0; bottle.position.set(home.x + 0.2, 1.15, home.z + 0.25); if (S.t > 0.8) { S.st = 'pour'; S.t = 0; glass = makeGlass(S.order); glass.node.position.copyFrom(glassSpot); } }
        else if (S.st === 'pour') { want = 0; const k = Math.min(1, S.t / 2.2); bottle.position.set(glassSpot.x - 0.06, counterY + glass!.G.base + 0.14, glassSpot.z + 0.03); bottle.rotation.z = -1.9 * Math.min(1, S.t / 0.4) * (k < 0.95 ? 1 : (1 - k) * 20);
          glass!.fill = k; glass!.liquid.scaling.y = Math.max(0.001, k); if (S.t > 2.5) { S.st = 'return'; S.t = 0; bottle.rotation.z = 0; } }
        else if (S.st === 'return') { want = Math.PI; bottle.position.set(home.x + 0.18, 1.2, home.z - 0.35); if (S.t > 0.7) { bottle.setEnabled(false); S.st = 'idle'; S.t = 0; } } }
      let da = want - P.root.rotation.y; da = Math.atan2(Math.sin(da), Math.cos(da)); P.root.rotation.y += da * Math.min(1, dt * 5); seat.yaw = P.root.rotation.y; walking = Math.abs(da) > 0.3 ? 0.4 : 0;
      posePerson(P, t, S.st === 'idle' && d < 2.6, d < 3 ? new Vector3(me.x, 1.6, me.z) : null, dt); stridePerson(P, t * 6, walking);
      if (S.waved > 0) { S.waved = Math.max(0, S.waved - dt); if (S.waved > 0.01) { const w = S.waved; P.arms[1].rotation.x = -2.6 + 0.2 * Math.sin(t * 12); P.arms[1].rotation.z = 0.3; P.fore[1].rotation.x = -0.3 * w; } }
      if (S.st === 'pour' || S.st === 'take' || S.st === 'back' || S.st === 'return') { P.arms[1].rotation.x = -1.1; P.fore[1].rotation.x = -0.6; }
      // the drink in your hand moves as you do; a hard swing spills some
      if (glass && S.holding) { glass.node.rotation.z = Math.max(-0.5, Math.min(0.5, -yawRate * 0.06)); if (Math.abs(yawRate) > 5 && S.spillT <= 0 && glass.fill > 0.05) { glass.fill = Math.max(0, glass.fill - 0.12); glass.liquid.scaling.y = Math.max(0.001, glass.fill); S.spillT = 1.2; S.spilled = true; } }
      if (S.spillT > 0) S.spillT -= dt;
      // being drunk wears off: about 10 to 25 seconds
      S.drunk = Math.max(0, S.drunk - dt * 0.065); const k = Math.min(1, S.drunk);
      if (k > 0.25) { S.kneeT -= dt; if (S.kneeT <= 0) { S.knee = 0.6; S.kneeT = 3 + Math.random() * 6; } }
      S.knee = Math.max(0, S.knee - dt * 1.5); drunkPP.uK = k; drunkPP.uT = t;
      if (k > 0.01 && !S.pp) { cam.attachPostProcess(pp); S.pp = true; } else if (k <= 0.01 && S.pp) { cam.detachPostProcess(pp); S.pp = false; }
      return { dYaw: Math.sin(t * 0.9) * 0.25 * k * dt, dx: Math.sin(t * 0.7) * 0.25 * k * dt, dz: Math.cos(t * 0.55) * 0.22 * k * dt, roll: Math.sin(t * 0.8) * 0.06 * k, eye: -Math.sin(Math.min(1, S.knee) * Math.PI) * 0.18 };
    },
    dispose() { try { pp.dispose(cam); } catch (e) { /* gone */ } },
  };
  const drunkPP = { uK: 0, uT: 0 };
  const pp = new PostProcess('drunk', 'drunk', ['uK', 'uT'], null, 1.0, cam);
  pp.onApply = (e) => { e.setFloat('uK', drunkPP.uK); e.setFloat('uT', drunkPP.uT); }; cam.detachPostProcess(pp);
  void counterY;
  return api;
}
