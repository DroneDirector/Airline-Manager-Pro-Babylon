// Replaceable parts: any part built with a slot (a node with a stable id, e.g. 'jetway.wheel') can be swapped for
// your own model. Put <slot id>.glb in models/ (see models/README.md); the build lists it in www/models/index.json.
// On every start each replacement is loaded into every node of its slot (the built part is hidden, the node and
// everything that moves it stay, so the animation drives the new model the same way) and checked against the
// slot's rules: its size, where its origin sits, which way it slides. What was replaced, and any problem, is
// written to the game's log (Settings → Updates and errors) and told on screen, each time.
import { logIssue } from './errlog';
import { Scene, TransformNode, Vector3, AbstractMesh, LoadAssetContainerAsync, Texture, VideoTexture } from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { gameSend } from '../ui/game-frame';
import { toast } from '../ui/icons';

/** A slot's rules: its size in metres [w, h, d] (the model should be within half to double of it), where its origin
 *  is ('base': the middle of its underside, 'centre': its middle), and for a sliding part the axis it slides along. */
export interface SlotRule { title: string; size: [number, number, number]; origin: 'base' | 'centre' | 'any'; slides?: 'y' | 'z' }
const RULES: { [id: string]: SlotRule } = {};
const NODES: { [id: string]: TransformNode[] } = {};

/** Make a node a slot: its children are the part as built (hidden when a replacement is loaded). */
export function slot(node: TransformNode, id: string, rule: SlotRule) { node.metadata = Object.assign({}, node.metadata || {}, { slot: id }); RULES[id] = rule; (NODES[id] = NODES[id] || []).push(node); return node; }

/** A picture slot: models/<id>.png (or .jpg) becomes the material's picture (one metre square on the part; a bellows: one
 *  fold by one fold). */
const TEX: { id: string; mat: any; title: string }[] = [];
export function textureSlot(id: string, mat: any, title: string) { if (!TEX.some(t => t.id === id && t.mat === mat)) TEX.push({ id, mat, title }); }

/** A picture-or-video slot (an advertising panel): models/<id>.png|jpg|mp4|webm fills the panel (aspect = its width /
 *  height), cropped to fill it without stretching; a video plays muted and loops. The first id found is used. */
const MEDIA: { ids: string[]; mat: any; aspect: number; title: string }[] = [];
export function mediaSlot(ids: string[], mat: any, aspect: number, title: string) { if (!MEDIA.some(m => m.mat === mat)) MEDIA.push({ ids, mat, aspect, title }); }

/** Every slot and its rules (for the README and the settings). */
export function slotRules() { return RULES; }

const LOG_KEY = 'ampb.partlog';
function tell(kind: 'info' | 'problem', title: string, message: string, detail = '') {
  try { const q = JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); q.push({ kind, title, message, detail, at: Date.now() }); localStorage.setItem(LOG_KEY, JSON.stringify(q.slice(-50))); } catch (e) { /* no storage */ }
  gameSend({ ampb: 'partlog' }); toast(title + ': ' + message);
}

let index: string[] | null = null;
async function listModels(): Promise<string[]> {
  if (index) return index;
  try { const r = await fetch('models/index.json', { cache: 'no-store' }); index = r.ok ? ((await r.json()).files || []) : []; } catch (e) { index = []; }
  return index as string[];
}

/** Load the replacements for every slot built in this scene (call once its parts are built). */
export async function applyReplacements(sc: Scene) {
  const files = await listModels(); if (!files.length) return;
  for (const md of MEDIA) { if (!md.mat || md.mat.getScene() !== sc) continue; let file = ''; for (const id of md.ids) { file = files.find(f => ['png', 'jpg', 'jpeg', 'mp4', 'webm'].some(e => f.toLowerCase() === id.toLowerCase() + '.' + e)) || ''; if (file) break; } if (!file) continue;
    try { const video = /\.(mp4|webm)$/i.test(file); let tx: any, a = 1;
      if (video) { tx = new VideoTexture(md.title, 'models/' + file, sc, true, true, Texture.TRILINEAR_SAMPLINGMODE, { autoPlay: true, loop: true, muted: true, autoUpdateTexture: true }); const v = tx.video as HTMLVideoElement; v.muted = true; v.playsInline = true;
        await new Promise<void>((ok, bad) => { if (v.readyState >= 1) ok(); else { v.onloadedmetadata = () => ok(); v.onerror = () => bad(new Error('unreadable video')); } }); a = v.videoWidth / Math.max(1, v.videoHeight); v.play().catch(() => { /* starts on the first touch */ }); }
      else { tx = await new Promise<Texture>((ok, bad) => { const t = new Texture('models/' + file, sc, false, true, Texture.TRILINEAR_SAMPLINGMODE, () => ok(t), (m: any) => bad(new Error(m || 'unreadable'))); }); const z = tx.getSize(); a = z.width / Math.max(1, z.height); }
      tx.wrapU = tx.wrapV = Texture.CLAMP_ADDRESSMODE;
      if (a > md.aspect) { tx.uScale = md.aspect / a; tx.uOffset = (1 - tx.uScale) / 2; } else { tx.vScale = a / md.aspect; tx.vOffset = (1 - tx.vScale) / 2; }   // fill the panel, cropped, never stretched
      md.mat.diffuseTexture = tx; md.mat.emissiveTexture = tx;
      tell('info', `${md.title} replaced`, `${file} is shown${video ? ' (video, muted, looping)' : ''}`); } catch (e: any) { tell('problem', `${md.title}: ${file} could not be used`, String((e && e.message) || e)); } }
  for (const t of TEX) { if (!t.mat || t.mat.getScene() !== sc) continue; const file = files.find(f => ['png', 'jpg', 'jpeg'].some(e => f.toLowerCase() === t.id.toLowerCase() + '.' + e)); if (!file) continue;
    try { await new Promise<void>((ok, bad) => { const tx = new Texture('models/' + file, sc, false, true, Texture.TRILINEAR_SAMPLINGMODE, () => { ok(); }, (m: any) => bad(new Error(m || 'unreadable')));
        tx.wrapU = tx.wrapV = Texture.WRAP_ADDRESSMODE; tx.anisotropicFilteringLevel = 8; const old = t.mat.albedoTexture; if (old) { tx.uScale = old.uScale; tx.vScale = old.vScale; } t.mat.albedoTexture = tx; t.mat.albedoColor && t.mat.albedoColor.set(1, 1, 1); });
      tell('info', `${t.title} picture replaced`, `${file} is used`); } catch (e: any) { tell('problem', `${t.title}: ${file} could not be loaded`, String((e && e.message) || e)); } }
  for (const id of Object.keys(NODES)) {
    const file = files.find(f => f.toLowerCase() === id.toLowerCase() + '.glb'); if (!file) continue;
    const rule = RULES[id], nodes = NODES[id].filter(n => !n.isDisposed() && n.getScene() === sc); if (!nodes.length) continue;
    try {
      const box = await LoadAssetContainerAsync('models/' + file, sc);
      const probs: string[] = []; const all = box.meshes.filter(m => m.getTotalVertices() > 0);
      if (!all.length) probs.push('it has no visible mesh');
      else { let mn = new Vector3(Infinity, Infinity, Infinity), mx = mn.scale(-1); box.addAllToScene(); for (const m of all) { m.computeWorldMatrix(true); const b = m.getBoundingInfo().boundingBox; mn = Vector3.Minimize(mn, b.minimumWorld); mx = Vector3.Maximize(mx, b.maximumWorld); } box.removeAllFromScene();
        const sz = mx.subtract(mn), want = rule.size, names = ['width', 'height', 'depth'], got = [sz.x, sz.y, sz.z];
        got.forEach((g, i) => { if (g < want[i] * 0.5 || g > want[i] * 2) probs.push(`its ${names[i]} is ${g.toFixed(2)} m (the slot is ${want[i]} m)`); });
        const c = mn.add(mx).scale(0.5), o = rule.origin === 'base' ? new Vector3(c.x, mn.y, c.z) : c;
        if (rule.origin !== 'any' && o.length() > Math.max(...want) * 0.25) probs.push(`its origin is ${o.length().toFixed(2)} m off its ${rule.origin === 'base' ? 'underside' : 'middle'}`);
        if (rule.slides === 'y' && sz.y < Math.max(sz.x, sz.z)) probs.push('it should be longest upright (it slides up and down)');
        if (rule.slides === 'z' && sz.z < Math.max(sz.x, sz.y)) probs.push('it should be longest along its length (it slides along it)'); }
      // the same model in several slots: instances of one model (drawn together); a model with bones or shape animation
      // is copied in full for each (those can't be shared). If instancing fails, full copies, and the problem is logged.
      const share = nodes.length > 1 && !box.skeletons.length && !box.morphTargetManagers.length && !box.animationGroups.length;
      const place = (n: TransformNode, inst: boolean) => box.instantiateModelsToScene(nm => `${id}:${nm}`, false, { doNotInstantiate: !inst });
      for (const n of nodes) { let inst: any;
        try { inst = place(n, share); } catch (e: any) { logIssue('Your models', `${file}: drawn as full copies`, String((e && e.message) || e), `slot ${id}`); inst = place(n, false); }
        for (const ch of n.getChildren()) (ch as any).setEnabled && (ch as any).setEnabled(false);
        for (const r of inst.rootNodes) { r.parent = n; (r as TransformNode).position && (r as TransformNode).position.setAll(0); for (const m of r.getChildMeshes(false) as AbstractMesh[]) { m.metadata = n.metadata; m.receiveShadows = true; } } }
      tell('info', `${rule.title} replaced`, `${file} is used on ${nodes.length} part${nodes.length > 1 ? 's' : ''}`);
      if (probs.length) tell('problem', `${rule.title}: check ${file}`, probs.join('; '), `slot ${id}: size ${rule.size.join(' × ')} m, origin at its ${rule.origin}${rule.slides ? ', slides along ' + rule.slides : ''}`);
    } catch (e: any) { tell('problem', `${rule.title}: ${file} could not be loaded`, String((e && e.message) || e)); }
  }
}
