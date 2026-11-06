// The people in court, for now: simple figures in their clothes (the judges in black with white bands, counsel in dark
// suits, the police in navy with caps, the relatives in black, you in a suit with a tie in your airline's colour, the
// public in everyday colours), each at their seat. They sit and stand (counsel and you stand to speak), sway a little,
// look at whoever is speaking and nod as they talk. The full characters come later, with their animations.
import { Scene, Vector3, Color3, MeshBuilder, Mesh, PBRMaterial, TransformNode, AbstractMesh } from '@babylonjs/core';
import type { Seat } from './seats';

export interface PersonData { key: string; seat: string; sex: string; name?: string; title?: string; vis?: number; sit?: number; look?: any }
export interface Person { key: string; seat: Seat; root: TransformNode; hip: TransformNode; head: TransformNode; thighs: TransformNode[]; shins: TransformNode[]; arms: TransformNode[]; fore: TransformNode[]; sk: number; want: number; gaze: number; ph: number; meshes: AbstractMesh[] }

const SKIN = ['#F1D3BC', '#E8BE9F', '#D5A27C', '#B47C55', '#8A5A3A', '#5E3B26'], HAIR = ['#1E1712', '#3A2618', '#5A3A22', '#8A6038', '#B98A52', '#D8C08A', '#8C8C8C', '#C9C9C9', '#E6E6E6'];
const EVERY = ['#3B4A5E', '#6A3A2E', '#2F5A48', '#7A6A4A', '#4A3A6A', '#8A8A8A', '#2A2A30', '#5A6A7A', '#9A5A3A', '#3A5A7A'];
function rng(seed: string) { let h = 2166136261; for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); } let s = h >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; }

export function buildPerson(sc: Scene, d: PersonData, seat: Seat, accent: string, mats: Map<string, PBRMaterial>): Person {
  const r = rng(d.key + d.seat + (d.name || '')), f = d.sex === 'f', k = d.key;
  const mat = (hex: string, rough = 0.75) => { const id = hex + rough; let m = mats.get(id); if (!m) { m = new PBRMaterial('pm' + id, sc); m.albedoColor = Color3.FromHexString(hex); m.roughness = rough; m.metallic = 0; m.maxSimultaneousLights = 8; mats.set(id, m); } return m; };
  const kind = /^judge/.test(k) ? 'judge' : /^police/.test(k) ? 'police' : /^relative/.test(k) ? 'mourn' : k === 'you' ? 'you' : /^(clerk|prosecutor|lawyer|famlawyer|investigator)/.test(k) ? 'counsel' : 'public';
  const skin = mat(SKIN[Math.floor(r() * SKIN.length)], 0.6), hair = mat(kind === 'judge' && r() < 0.6 ? HAIR[6 + Math.floor(r() * 3)] : HAIR[Math.floor(r() * 9)], 0.55);
  const top = kind === 'judge' ? '#121216' : kind === 'police' ? '#1A2440' : kind === 'mourn' ? '#141418' : kind === 'counsel' ? ['#1E2430', '#2A2A2E', '#24304A'][Math.floor(r() * 3)] : kind === 'you' ? '#22262E' : EVERY[Math.floor(r() * EVERY.length)];
  const legs = kind === 'public' ? ['#2A2E38', '#3A3A3A', '#4A4030', '#1E2A3A'][Math.floor(r() * 4)] : top;
  const topM = mat(top, kind === 'judge' ? 0.85 : 0.7), legM = mat(legs, 0.75), shoe = mat('#141210', 0.4);
  const root = new TransformNode('person-' + k, sc), meshes: AbstractMesh[] = [];
  root.position.set(seat.x, seat.y, seat.z); root.rotation.y = seat.yaw; const sc1 = (f ? 0.95 : 1.0) * (0.96 + r() * 0.08); root.scaling.setAll(sc1);
  const add = (m: Mesh, mt: any, par: TransformNode, x: number, y: number, z: number) => { m.material = mt; m.parent = par; m.position.set(x, y, z); m.receiveShadows = true; m.isPickable = false; meshes.push(m); return m; };
  const node = (par: TransformNode, x: number, y: number, z: number) => { const t = new TransformNode('pj', sc); t.parent = par; t.position.set(x, y, z); return t; };
  const hip = node(root, 0, 0.93, 0);
  add(MeshBuilder.CreateBox('pel', { width: f ? 0.34 : 0.32, height: 0.16, depth: 0.2 }, sc), legM, hip, 0, 0, 0);
  const chest = add(MeshBuilder.CreateCapsule('torso', { radius: 0.16, height: 0.58, tessellation: 12 }, sc), topM, hip, 0, 0.3, 0); chest.scaling.set(f ? 1.0 : 1.12, 1, 0.7);
  if (kind === 'judge') add(MeshBuilder.CreateBox('band', { width: 0.07, height: 0.12, depth: 0.01 }, sc), mat('#F4F4F0', 0.8), hip, 0, 0.47, 0.115);
  if (kind === 'counsel' || kind === 'you' || kind === 'police' || (kind === 'public' && r() < 0.4)) {
    add(MeshBuilder.CreateBox('shirt', { width: 0.09, height: 0.2, depth: 0.01 }, sc), mat('#ECEEF0', 0.8), hip, 0, 0.42, 0.112);
    if (!f) add(MeshBuilder.CreateBox('tie', { width: 0.035, height: 0.2, depth: 0.012 }, sc), mat(kind === 'you' ? accent : kind === 'police' ? '#101010' : ['#6A1A22', '#1A2A5A', '#3A3A3A'][Math.floor(r() * 3)], 0.5), hip, 0, 0.4, 0.12);
  }
  const neck = node(hip, 0, 0.57, 0); add(MeshBuilder.CreateCylinder('neck', { diameter: 0.09, height: 0.1, tessellation: 10 }, sc), skin, neck, 0, 0.03, 0);
  const head = node(neck, 0, 0.08, 0);
  const hd = add(MeshBuilder.CreateSphere('head', { diameter: 0.21, segments: 14 }, sc), skin, head, 0, 0.1, 0.01); hd.scaling.set(0.92, 1.08, 1);
  add(MeshBuilder.CreateSphere('nose', { diameter: 0.035, segments: 6 }, sc), skin, head, 0, 0.09, 0.105);
  const hr = add(MeshBuilder.CreateSphere('hair', { diameter: 0.225, segments: 12, slice: 0.55 }, sc), hair, head, 0, 0.11, -0.005); hr.scaling.set(0.95, 1.05, 1.03);
  if (f && r() < 0.75) { const lh = add(MeshBuilder.CreateBox('hairL', { width: 0.2, height: 0.22, depth: 0.08 }, sc), hair, head, 0, 0.0, -0.08); void lh; }
  if (kind === 'police') { add(MeshBuilder.CreateCylinder('cap', { diameter: 0.23, height: 0.06, tessellation: 18 }, sc), mat('#141C34', 0.6), head, 0, 0.21, 0); add(MeshBuilder.CreateBox('peak', { width: 0.16, height: 0.012, depth: 0.08 }, sc), mat('#0A0A0A', 0.3), head, 0, 0.185, 0.12); }
  // the arms: from the shoulders; the forearms from the elbows
  const arms: TransformNode[] = [], fore: TransformNode[] = [];
  for (const s of [-1, 1]) { const a = node(hip, s * (f ? 0.19 : 0.21), 0.5, 0); add(MeshBuilder.CreateCapsule('ua', { radius: 0.045, height: 0.3, tessellation: 8 }, sc), topM, a, 0, -0.14, 0);
    const e = node(a, 0, -0.28, 0); add(MeshBuilder.CreateCapsule('fa', { radius: 0.04, height: 0.28, tessellation: 8 }, sc), topM, e, 0, -0.13, 0); add(MeshBuilder.CreateSphere('hand', { diameter: 0.075, segments: 8 }, sc), skin, e, 0, -0.29, 0.005);
    arms.push(a); fore.push(e); }
  // the legs: thighs from the hips, shins from the knees, the shoes
  const thighs: TransformNode[] = [], shins: TransformNode[] = [];
  for (const s of [-1, 1]) { const t = node(hip, s * 0.095, -0.03, 0); add(MeshBuilder.CreateCapsule('th', { radius: 0.065, height: 0.47, tessellation: 8 }, sc), legM, t, 0, -0.215, 0);
    const kn = node(t, 0, -0.44, 0); add(MeshBuilder.CreateCapsule('sh', { radius: 0.05, height: 0.46, tessellation: 8 }, sc), legM, kn, 0, -0.22, 0); add(MeshBuilder.CreateBox('shoe', { width: 0.09, height: 0.06, depth: 0.25 }, sc), shoe, kn, 0, -0.45, 0.05);
    thighs.push(t); shins.push(kn); }
  const sk = d.sit != null ? d.sit : seat.sit;
  const p: Person = { key: k, seat, root, hip, head, thighs, shins, arms, fore, sk, want: sk, gaze: 0, ph: r() * 10, meshes };
  root.setEnabled(d.vis !== 0); posePerson(p, 0, false, null, 0);
  return p;
}
/** Each frame: sitting down or standing up, the sway, the look at the speaker, the nod and the hand of whoever talks. */
export function posePerson(p: Person, t: number, talking: boolean, spk: Vector3 | null, dt: number) {
  p.sk += Math.sign(p.want - p.sk) * Math.min(Math.abs(p.want - p.sk), dt * 1.2);
  const s = p.sk * p.sk * (3 - 2 * p.sk), tt = t + p.ph;
  p.hip.position.y = 0.93 - s * 0.38; p.hip.position.z = -0.02 * s;
  for (const th of p.thighs) th.rotation.x = -Math.PI / 2 * s + 0.02;
  for (const kn of p.shins) kn.rotation.x = Math.PI / 2 * s;
  const amp = s > 0.5 ? 1 : 1.3; p.hip.rotation.x = amp * (0.012 * Math.sin(tt * 0.37) + 0.006 * Math.sin(tt * 0.91 + 1)) - 0.04 * s; p.hip.rotation.z = amp * (0.014 * Math.sin(tt * 0.29 + 2) + 0.005 * Math.sin(tt * 0.77));
  // the arms: on the lap or the desk when seated, by the sides standing; whoever speaks standing explains with a hand
  for (let i = 0; i < 2; i++) { const a = p.arms[i], e = p.fore[i], sd = i === 0 ? -1 : 1; a.rotation.z = sd * 0.08; a.rotation.x = -0.35 * s; e.rotation.x = -1.05 * s - 0.1;
    if (talking && s < 0.5 && i === 1) { a.rotation.x = -0.45 - 0.18 * Math.sin(tt * 1.9); e.rotation.x = -0.9 - 0.3 * Math.sin(tt * 2.7 + 1); a.rotation.z = 0.15; } }
  // the head: to whoever speaks (within a comfortable turn), a nod while talking
  let want = 0;
  if (spk) { const sp = p.root.position, dx = spk.x - sp.x, dz = spk.z - sp.z, a = Math.atan2(dx, dz) - p.seat.yaw; want = Math.max(-1.1, Math.min(1.1, Math.atan2(Math.sin(a), Math.cos(a)))); }
  p.gaze += (want - p.gaze) * Math.min(1, dt * 2.2);
  p.head.rotation.y = p.gaze; p.head.rotation.x = talking ? 0.05 * Math.sin(tt * 3.3) : 0.02 * Math.sin(tt * 0.5); p.head.rotation.z = talking ? 0.03 * Math.sin(tt * 1.1) : 0;
}
/** Where a person's head is (for the camera and for the others to look at). */
export function headOf(p: Person): Vector3 { const s = p.sk; return new Vector3(p.seat.x, p.seat.y + (s > 0.5 ? 1.28 : 1.66), p.seat.z); }
/** Walking (after posePerson, standing): the legs in step, the knees bending as each foot comes through, the arms
 *  swinging against the legs, a little rise and fall. ph is the step's phase (it goes on with the distance walked),
 *  k how much of a walk it is (0 standing still … 1 walking). */
export function stridePerson(p: Person, ph: number, k: number) {
  if (k < 0.01) return;
  for (let i = 0; i < 2; i++) { const s = Math.sin(ph + i * Math.PI);
    p.thighs[i].rotation.x += -s * 0.42 * k; p.shins[i].rotation.x += Math.max(0, Math.sin(ph + i * Math.PI + 1.3)) * 0.75 * k;
    p.arms[i].rotation.x += s * 0.34 * k; p.fore[i].rotation.x += -0.18 * k; }
  p.hip.position.y += (Math.abs(Math.cos(ph)) - 0.6) * 0.035 * k; p.hip.rotation.y = Math.sin(ph) * 0.06 * k;
}
