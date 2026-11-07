// Shared materials and texture arrays: fewer materials, so far more things can be merged into one draw call.
//
// Every fixed object's material is looked at when a place has been built (so anything added to the game later is
// included on its own). Materials that are the same in everything but their colour and their picture become one:
//  - the colour moves into the object's own points (vertex colours), so a red and a blue chair share one material;
//  - the pictures (drawn by the game) go into texture arrays: stacks of same-sized pictures, one stack per size and per
//    way of repeating, at most 64 MB each. Every layer keeps its own edges, so pictures that repeat across a surface
//    (carpet, cladding, floors) still repeat cleanly. Which layer an object uses travels in its points too.
// Everything else about a material is kept exactly: reflections, see-through, refraction, clear coat, glow, the
// lighting and the shadows. Only how the picture and the colour are read changes.
// Never changed: glowing pictures and cut-out (see-through) pictures (the glow and the shadows read those straight
// from the material), anything that moves or opens, screens, clocks and boards whose pictures change, swappable models,
// pictures loaded from files (they may be compressed), materials with their own shader code (the wet ground, puddles,
// markings), objects with their own colours already, instanced objects. Needs WebGL2 or WebGPU; otherwise nothing changes.
import { Scene, Mesh, AbstractMesh, Material, StandardMaterial, PBRMaterial, DynamicTexture, Texture, BaseTexture, RawTexture, RawTexture2DArray,
  MaterialPluginBase, Constants, VertexBuffer, Color3, UniformBuffer, Node, MultiMaterial } from '@babylonjs/core';

const NEVER = /STRUCTURE|COLLIDE|sky|look-|ramp-|GROUND|PAINT|MARKINGS|ROAD|holo|SCREEN|MONITOR|DOOR|LIFT|CLOCK|BOARD|FIDS|VIDEO|AIRFIELD\//i;
const blocked = (n: Node | null): boolean => { for (let p: any = n; p; p = p.parent) { const md = p.metadata; if (md && (md.slot || md.rental || md.door || md.lift || md.live)) return true; } return false; };
const BUILTIN = /^(PBRBRDF|PBRClearCoat|PBRIridescence|PBRAnisotropic|Sheen|PBRSubSurface|DetailMap)$/;
const MAXB = 64 * 1024 * 1024;
const LIVE = /disp|live|clock|board|screen|monitor|fids|video|wx-/i;
// pictures redrawn while playing (a lift's floor display, ...) are counted, so they are never put in an array
const redraws = new WeakMap<object, number>();
{ const P: any = DynamicTexture.prototype, up = P.update; P.update = function (this: any, ...args: any[]) { redraws.set(this, (redraws.get(this) || 0) + 1); return up.apply(this, args); }; }

/** Reads its picture from a layer of a texture array (the layer is in the vertex colour's fourth number). */
class TexArrayPlugin extends MaterialPluginBase {
  arr: BaseTexture; pbr: boolean; emis: boolean;
  constructor(mat: Material, arr: BaseTexture, emis: boolean) { super(mat, 'TexArray', 310, { TEXARR: false }); this.arr = arr; this.pbr = mat instanceof PBRMaterial; this.emis = emis; this._enable(true); }
  getClassName() { return 'TexArrayPlugin'; }
  isCompatible(lang: number) { return lang === 0; }   // GLSL (WebGPU runs with GLSL here)
  prepareDefines(d: any) { d.TEXARR = true; }
  isReadyForSubMesh() { return this.arr.isReady(); }
  getSamplers(s: string[]) { s.push('texArrSampler'); }
  bindForSubMesh(ubo: UniformBuffer) { ubo.setTexture('texArrSampler', this.arr); }
  getCustomCode(type: string): any {
    if (type === 'vertex') return { CUSTOM_VERTEX_DEFINITIONS: 'varying float vArrLayer;', CUSTOM_VERTEX_MAIN_END: '#ifdef VERTEXCOLOR\nvArrLayer=color.a;\n#else\nvArrLayer=0.;\n#endif' };
    const L = 'vec3(%UV%+uvOffset,floor(vArrLayer+0.5))', code: any = { CUSTOM_FRAGMENT_DEFINITIONS: 'varying float vArrLayer; uniform highp sampler2DArray texArrSampler;' };
    if (this.pbr) { code['!vec4 albedoTexture=TEXRD\\(albedoSampler,vAlbedoUV\\+uvOffset\\);'] = `vec4 albedoTexture=texture(texArrSampler,${L.replace('%UV%', 'vAlbedoUV')});`;
      if (this.emis) code['!vec3 emissiveColorTex=TEXRD\\(emissiveSampler,vEmissiveUV\\+uvOffset\\)\\.rgb;'] = `vec3 emissiveColorTex=texture(texArrSampler,${L.replace('%UV%', 'vEmissiveUV')}).rgb;`; }
    else { code['!baseColor=TEXRD\\(diffuseSampler,vDiffuseUV\\+uvOffset\\);'] = `baseColor=texture(texArrSampler,${L.replace('%UV%', 'vDiffuseUV')});`;
      if (this.emis) code['!emissiveColor\\+=TEXRD\\(emissiveSampler,vEmissiveUV\\+uvOffset\\)\\.rgb'] = `emissiveColor+=texture(texArrSampler,${L.replace('%UV%', 'vEmissiveUV')}).rgb`; }
    return code;
  }
}

type Cand = { m: Mesh; mat: StandardMaterial | PBRMaterial; tex: DynamicTexture | null; emis: boolean; col: Color3; sig: string };
const isBlack = (c: Color3 | undefined) => !c || (c.r < 1e-4 && c.g < 1e-4 && c.b < 1e-4);
const texSig = (t: BaseTexture) => { const x: any = t; return [x.uScale, x.vScale, x.uOffset, x.vOffset, x.uAng, x.vAng, x.wAng, x.wrapU, x.wrapV, x.level, x.hasAlpha, x.getAlphaFromRGB, x.coordinatesIndex, x.gammaSpace].join(','); };

/** The material's look without its colour and picture, as text (two materials with the same text can be one). */
function signature(mat: StandardMaterial | PBRMaterial, keepColour: boolean): string {
  const a: any = mat, keep: any = {}, slots = mat instanceof PBRMaterial ? ['albedoTexture', 'emissiveTexture'] : ['diffuseTexture', 'emissiveTexture'];
  for (const s of slots) { keep[s] = a[s]; a[s] = null; }
  let j: any; try { j = mat.serialize(); } finally { for (const s of slots) a[s] = keep[s]; }
  delete j.name; delete j.id; delete j.uniqueId; delete j.tags; delete j.metadata; delete j.uniqueIdInternal;
  if (!keepColour) { delete j.albedo; delete j.diffuse; delete j.albedoColor; delete j.diffuseColor; }
  return mat.getClassName() + JSON.stringify(j) + '|' + (keep[slots[0]] ? texSig(keep[slots[0]]) : 'none') + '|' + (keep.emissiveTexture ? 'E' : '');
}

/** Shares materials and fills texture arrays for the fixed objects in `sc` that `ok` allows. Returns how many materials were saved. */
export function shareMaterials(sc: Scene, ok: (m: AbstractMesh) => boolean): number {
  const eng: any = sc.getEngine(); if (!(eng.isWebGPU || eng.webGLVersion >= 2)) return 0;
  // 1. who may change: fixed, single-material meshes with Standard or PBR materials and nothing unusual
  const cands: Cand[] = [], usersOf = new Map<Material, number>();
  for (const m of sc.meshes) if (m.material) usersOf.set(m.material, (usersOf.get(m.material) || 0) + 1);
  const sigCache = new Map<Material, string | null>();
  for (const am of sc.meshes) {
    const m = am as Mesh;
    if (!(m instanceof Mesh) || (m as any).isAnInstance || m.hasInstances || m.hasThinInstances || m.skeleton || m.morphTargetManager || !m.isEnabled() || m.getTotalVertices() <= 0 || !m.isWorldMatrixFrozen) continue;
    const mat = m.material; if (!mat || mat instanceof MultiMaterial || !(mat instanceof StandardMaterial || mat instanceof PBRMaterial)) continue;
    if (NEVER.test(m.name) || NEVER.test(mat.name) || blocked(m) || !ok(m) || m.isVerticesDataPresent(VertexBuffer.ColorKind) || !m.isVerticesDataPresent(VertexBuffer.UVKind) && hasAnyTex(mat)) continue;
    let sig = sigCache.get(mat);
    if (sig === undefined) { sig = materialSig(mat); sigCache.set(mat, sig); }
    if (sig === null) continue;
    const a: any = mat, tex = (mat instanceof PBRMaterial ? a.albedoTexture : a.diffuseTexture) as DynamicTexture | null;
    const col: Color3 = (mat instanceof PBRMaterial ? mat.albedoColor : mat.diffuseColor).clone();
    cands.push({ m, mat, tex, emis: !!a.emissiveTexture, col, sig });
  }
  if (cands.length < 2) return 0;
  // 2. the arrays: one per (picture size, way of repeating, see-through), at most 64 MB each
  const p2 = (v: number) => { const c = 1 << Math.ceil(Math.log2(Math.max(4, v))), f = c >> 1; return Math.min(4096, c / v > 1.5 && f >= 4 ? f : c); };
  const texInfo = new Map<DynamicTexture, { key: string; w: number; h: number }>();
  for (const c of cands) if (c.tex && !texInfo.has(c.tex)) { const s = c.tex.getSize(); const w = p2(s.width), h = p2(s.height); texInfo.set(c.tex, { key: `${w}x${h}|${(c.tex as any).wrapU},${(c.tex as any).wrapV}|${c.tex.hasAlpha ? 1 : 0}`, w, h }); }
  const buckets = new Map<string, DynamicTexture[]>(); for (const [t, i] of texInfo) (buckets.get(i.key) || buckets.set(i.key, []).get(i.key)!).push(t);
  const layerOf = new Map<DynamicTexture, { arr: RawTexture2DArray; layer: number; id: string }>();
  let arrN = 0;
  for (const [key, list] of buckets) {
    const { w, h } = texInfo.get(list[0])!, per = Math.max(1, Math.floor(MAXB / (w * h * 4)));
    for (let s = 0; s < list.length; s += per) {
      const part = list.slice(s, s + per), data = new Uint8Array(w * h * 4 * part.length), cv = document.createElement('canvas'); cv.width = w; cv.height = h; const cx = cv.getContext('2d', { willReadFrequently: true })!;
      part.forEach((t, i) => { const src = (t.getContext() as any).canvas as HTMLCanvasElement; cx.clearRect(0, 0, w, h); cx.drawImage(src, 0, 0, w, h); const px = cx.getImageData(0, 0, w, h).data, inv = (t as any)._invertY !== false, row = w * 4, base = i * w * h * 4;
        for (let y = 0; y < h; y++) data.set(px.subarray((inv ? h - 1 - y : y) * row, (inv ? h - y : y + 1) * row), base + y * row); });
      const arr = new RawTexture2DArray(data, w, h, part.length, Constants.TEXTUREFORMAT_RGBA, sc, true, false, Texture.TRILINEAR_SAMPLINGMODE);
      arr.name = `texarray/${key}/${arrN++}`; arr.wrapU = (part[0] as any).wrapU; arr.wrapV = (part[0] as any).wrapV; arr.hasAlpha = part[0].hasAlpha; (arr as any).gammaSpace = part[0].gammaSpace; arr.anisotropicFilteringLevel = 4;
      part.forEach((t, i) => layerOf.set(t, { arr, layer: i, id: arr.name }));
    }
  }
  // 3. one shared material per (look, array): a copy of the first, its colour white, its picture a 1×1 stand-in whose
  //    tiling matches (the real picture comes from the array)
  const shared = new Map<string, Material>(); let made = 0;
  const groupKey = (c: Cand) => c.sig + '#' + (c.tex ? layerOf.get(c.tex)!.id : 'colour');
  const counts = new Map<string, number>(); for (const c of cands) counts.set(groupKey(c), (counts.get(groupKey(c)) || 0) + 1);
  const keepColour = (c: Cand) => c.mat instanceof StandardMaterial && (!isBlack(c.mat.emissiveColor) || !isBlack(c.mat.ambientColor));
  for (const c of cands) {
    const k = groupKey(c); if ((counts.get(k) || 0) < 2) continue;   // alone in its group: nothing to gain
    let sm = shared.get(k);
    if (!sm) { sm = c.mat.clone('shared/' + c.mat.name)!; const a: any = sm; made++;
      if (!keepColour(c)) { if (sm instanceof PBRMaterial) sm.albedoColor = Color3.White(); else (sm as StandardMaterial).diffuseColor = Color3.White(); }
      if (c.tex) { const L = layerOf.get(c.tex)!, st = new RawTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, Constants.TEXTUREFORMAT_RGBA, sc, false, false, Texture.NEAREST_SAMPLINGMODE); const o: any = c.tex;
        for (const p of ['uScale', 'vScale', 'uOffset', 'vOffset', 'uAng', 'vAng', 'wAng', 'wrapU', 'wrapV', 'level', 'hasAlpha', 'getAlphaFromRGB', 'coordinatesIndex', 'gammaSpace']) (st as any)[p] = o[p];
        st.name = 'texarray-standin'; if (sm instanceof PBRMaterial) sm.albedoTexture = st; else (sm as StandardMaterial).diffuseTexture = st;
        if (c.emis) a.emissiveTexture = st;
        new TexArrayPlugin(sm, L.arr, c.emis); }
      shared.set(k, sm); }
    // the colour (and the layer) into the mesh's points; a shape shared with another mesh is given its own copy first
    if (c.m.geometry && c.m.geometry.meshes.length > 1) c.m.makeGeometryUnique();
    const n = c.m.getTotalVertices(), cols = new Float32Array(n * 4), col = keepColour(c) ? Color3.White() : c.col, layer = c.tex ? layerOf.get(c.tex)!.layer : 0;
    for (let i = 0; i < n; i++) { cols[i * 4] = col.r; cols[i * 4 + 1] = col.g; cols[i * 4 + 2] = col.b; cols[i * 4 + 3] = layer; }
    c.m.setVerticesData(VertexBuffer.ColorKind, cols, false, 4); c.m.useVertexColors = true; c.m.hasVertexAlpha = false; c.m.material = sm;
  }
  // 4. what is no longer used anywhere goes
  const inUse = new Set<Material>(); for (const m of sc.meshes) if (m.material) inUse.add(m.material);
  const texInUse = new Set<BaseTexture>(); for (const mt of inUse) for (const t of mt.getActiveTextures()) texInUse.add(t);
  let gone = 0; for (const c of cands) if (!inUse.has(c.mat) && !(c.mat as any)._disposed) { (c.mat as any)._disposed = true; (c.mat as any).dispose(false, false); gone++; }
  for (const t of texInfo.keys()) if (!texInUse.has(t)) { (t as any).update = () => { /* its picture lives in an array now */ }; t.dispose(); }
  for (const [k, sm] of shared) if (!inUse.has(sm)) sm.dispose();
  return gone - made;
}

function hasAnyTex(mat: Material) { return mat.getActiveTextures().length > 0; }

/** null when the material can't be shared (other pictures, its own shader code, file pictures, see-through by a picture). */
function materialSig(mat: StandardMaterial | PBRMaterial): string | null {
  const a: any = mat;
  const plugins: any[] = a.pluginManager ? a.pluginManager._plugins : []; if (plugins.some(p => !BUILTIN.test(p.name))) return null;
  const main = mat instanceof PBRMaterial ? a.albedoTexture : a.diffuseTexture;
  if (main && !(main instanceof DynamicTexture)) return null;
  if (main && (LIVE.test(main.name) || (redraws.get(main) || 0) > 1)) return null;
  if (main && (main as any).isCube) return null;
  // the glow and the shadows read glowing and cut-out pictures straight from the material: those keep their own
  if (a.emissiveTexture || (main && main.hasAlpha) || a.opacityTexture) return null;
  const others = mat.getActiveTextures().filter(t => t !== main && t !== a.emissiveTexture && t !== a.reflectionTexture && t !== a.refractionTexture && t !== (sceneEnv(mat)));
  if (others.length) return null;
  const keepColour = mat instanceof StandardMaterial && (!isBlack(mat.emissiveColor) || !isBlack(mat.ambientColor));
  try { return signature(mat, keepColour); } catch (e) { return null; }
}
const sceneEnv = (mat: Material) => mat.getScene().environmentTexture;
