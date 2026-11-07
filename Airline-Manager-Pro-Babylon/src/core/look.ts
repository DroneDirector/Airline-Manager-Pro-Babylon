// The airport's extra graphics, each its own switch in Settings → Graphics (on by default where the device can carry it):
//  sky shadows (light and shade from the whole sky), many real lights (every light panel lights its surroundings),
//  volumetric light (sun rays and haze), height fog, real-time reflections, softer contact shadows, temporal
//  anti-aliasing, eye adaptation (indoors and out), lens flares, depth of field, motion blur, surface depth (relief on
//  floors, cladding and tyres), rain on the ground (wet, darker and glossy while it rains).
// applyLook() sets them up once the place is built and returns the step to run every frame.
import { Scene, Camera, Vector3, Color3, Color4, Mesh, MeshBuilder, StandardMaterial, DynamicTexture, Texture, PostProcess, Effect, Light, PointLight, Ray,
  ClusteredLightContainer, IblShadowsRenderPipeline, TAARenderingPipeline, SSRRenderingPipeline, MotionBlurPostProcess, VolumetricLightScatteringPostProcess,
  LensFlareSystem, LensFlare, DefaultRenderingPipeline, ShadowGenerator, PBRMaterial, AbstractMesh, Constants } from '@babylonjs/core';
import { S } from './settings';
import { MaterialPluginBase, MirrorTexture, RawTexture, Plane } from '@babylonjs/core';
import { IS_PC } from './app';

/** The lights that would like to join the many-lights container (the jetways' panels and the like), added by their builders. */
export const EXTRA_LIGHTS: PointLight[] = [];
import { SUN } from '../sections/terminal/weather';
const WX = { get rain() { return SUN.rain; }, get sunAlt() { return SUN.alt; } };

Effect.ShadersStore.heightFogFragmentShader = `
precision highp float; varying vec2 vUV; uniform sampler2D textureSampler; uniform sampler2D depthSampler;
uniform mat4 invView; uniform vec3 camPos; uniform vec3 fogColor; uniform float tanHalf; uniform float aspect; uniform float density; uniform float falloff; uniform float base;
void main(void) { vec4 c = texture2D(textureSampler, vUV); float z = texture2D(depthSampler, vUV).r; if (z <= 0.0) { gl_FragColor = c; return; }
  vec2 p = vUV * 2.0 - 1.0; vec3 vp = vec3(p.x * tanHalf * aspect, p.y * tanHalf, 1.0) * z; vec3 wp = (invView * vec4(vp, 1.0)).xyz;
  vec3 d = wp - camPos; float dist = length(d); float h0 = camPos.y - base, dh = d.y; float k = falloff;
  float integ = abs(dh) > 0.01 ? (exp(-k * h0) - exp(-k * (h0 + dh))) / (k * dh) : exp(-k * h0);
  float f = 1.0 - exp(-density * dist * max(integ, 0.0)); f = clamp(f, 0.0, 0.92);
  gl_FragColor = vec4(mix(c.rgb, fogColor, f), c.a); }`;

/** How wet the ground is now (0 dry, 1 soaked), how hard it rains, a clock for the ripples, and the puddles' mirror
 *  (the scene seen upside down from the ground: what the puddles reflect). Read by the ground's shaders. */
export const WET: { wet: number; rain: number; snow: number; t: number; sun: number[]; sunCol: number[]; mirror: MirrorTexture | null; blank: RawTexture | null } = { wet: 0, rain: 0, snow: 0, t: 0, sun: [0, 1, 0], sunCol: [0, 0, 0], mirror: null, blank: null };
export const WET_UNIFORMS = [{ name: 'wtWet', size: 1, type: 'float' }, { name: 'wtRain', size: 1, type: 'float' }, { name: 'wtT', size: 1, type: 'float' }, { name: 'wtRes', size: 2, type: 'vec2' }, { name: 'wtMirOn', size: 1, type: 'float' }, { name: 'wtSnow', size: 1, type: 'float' }, { name: 'wtSunDir', size: 3, type: 'vec3' }, { name: 'wtSunCol', size: 3, type: 'vec3' }];
export const WET_DECL = 'uniform float wtWet; uniform float wtRain; uniform float wtT; uniform vec2 wtRes; uniform float wtMirOn; uniform float wtSnow; uniform vec3 wtSunDir; uniform vec3 wtSunCol;';
export const bindWet = (ubo: any, scene: Scene) => { const E = scene.getEngine(); ubo.updateFloat('wtWet', WET.wet); ubo.updateFloat('wtRain', WET.rain); ubo.updateFloat('wtT', WET.t); ubo.updateFloat('wtSnow', WET.snow); ubo.updateFloat3('wtSunDir', WET.sun[0], WET.sun[1], WET.sun[2]); ubo.updateFloat3('wtSunCol', WET.sunCol[0], WET.sunCol[1], WET.sunCol[2]);
  ubo.updateFloat2('wtRes', E.getRenderWidth(), E.getRenderHeight()); const on = !!WET.mirror && WET.wet > 0.03; ubo.updateFloat('wtMirOn', on ? 1 : 0);
  if (!WET.blank) WET.blank = new RawTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, Constants.TEXTUREFORMAT_RGBA, scene);
  ubo.setTexture('wtMir', on ? WET.mirror : WET.blank); };
/** The wet ground in GLSL: wetIt(plan position, how paved (0 grass, 1 asphalt/concrete), along (1 on the runway: puddles
 *  drawn out along it, in the wheel ruts), bias (low spots: more water), colour, roughness, relief).
 *  Damp: darker, asphalt and concrete most, grass only a little. A damp sheen first, then shallow sheets of water in the
 *  hollows, broad and ragged at the edges, spreading the longer it rains and drying from the edges after; mirror-smooth,
 *  reflecting what stands round them (wtFinal), rippled by the drops while it rains. */
export const WET_GLSL = `
uniform sampler2D wtMir; float wtPud = 0.; float wtFilm = 0.; float wtGl = 0.; float wtSpk = 0.;
float wtH1(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float wtN(vec2 p){ vec2 i = floor(p), q = fract(p); vec2 u = q * q * (3. - 2. * q); return mix(mix(wtH1(i), wtH1(i + vec2(1., 0.)), u.x), mix(wtH1(i + vec2(0., 1.)), wtH1(i + vec2(1., 1.)), u.x), u.y); }
float wtRip(vec2 p, float t){ float h = 0.; for (int k = 0; k < 3; k++) { vec2 q = p * 2.6 + float(k) * 7.31; vec2 c = floor(q), f = fract(q); vec2 o = vec2(wtH1(c), wtH1(c + 13.7)) * .7 + .15;
  float ph = fract(t * (.7 + .3 * wtH1(c + 3.3)) + wtH1(c + 5.1)), d = length(f - o), r = ph * .42; h += sin((d - r) * 75.) * (1. - ph) * (1. - smoothstep(0., .06, abs(d - r))); } return h; }
float wtVor(vec2 p){ vec2 i = floor(p), f = fract(p); float d1 = 8., d2 = 8.; for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 g = vec2(float(x), float(y));
  vec2 o = vec2(wtH1(i + g), wtH1(i + g + 19.3)); float d = length(g + o - f); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; } return d2 - d1; }
void wetIt(vec2 p, float pave, float along, float bias, inout vec3 col, inout float rr, inout float hh){
  wtGl = pave; wtSpk = smoothstep(.62, .9, wtN(p * 7.3));
  float w = wtWet; if (w < .002) return;
  float damp = w * mix(.4, 1., pave); col *= 1. - damp * mix(.2, .4, pave); rr = mix(rr, rr * mix(.88, .45, pave), damp);
  vec2 q = p * vec2(mix(1., .28, along), 1.);
  float n = wtN(q * .03) * .42 + wtN(q * .09 + 3.1) * .3 + wtN(q * .3 + 7.7) * .17 + wtN(p * 1.3 + 1.9) * .07 + wtN(p * 4.1) * .04 + bias;
  float th = mix(.86, .55, w);
  wtFilm = smoothstep(th - .09, th, n) * pave * w; col *= 1. - .18 * wtFilm; rr = mix(rr, min(rr, .14), wtFilm);
  wtPud = smoothstep(th, th + .015, n) * pave;
  if (wtPud > 0.) { col = mix(col, col * .42, wtPud); rr = mix(rr, .015, wtPud); hh = mix(hh, wtRain * .0022 * wtRip(p, wtT), wtPud); } }
/** Snow: off the pavement it lies all over; on the pavement it is ploughed, and left in the cracks, in patches and
 *  streaks (drawn out along the runway), thicker along the edges (edge) and thinner in the wheel tracks (track). */
void snowIt(vec2 p, float pave, float along, float edge, float track, inout vec3 col, inout float rr, inout float hh){
  float s = wtSnow; if (s < .002) return;
  vec3 sc = vec3(.88, .9, .94) * (.9 + .1 * wtN(p * .7));
  float cov = (1. - pave) * smoothstep(0., .45, s) * (.8 + .2 * smoothstep(.3, .7, wtN(p * .15)));
  vec2 q = p * vec2(mix(1., .2, along), 1.); float th = mix(.98, .6, s);
  float spot = smoothstep(th, th + .05, wtN(q * .06) * .5 + wtN(q * .21 + 4.) * .3 + wtN(p * 1.7) * .2 + edge * .45 - track * .3);
  float crack = (1. - smoothstep(0., .035, wtVor(p * .16))) * smoothstep(.08, .35, s) * (.4 + .6 * wtN(p * .9 + 2.));
  float bits = smoothstep(.82, .88, wtN(p * 2.3)) * smoothstep(.15, .6, s) * (1. - track);
  cov = max(cov, max(max(spot, crack * .95), bits * .8) * pave);
  col = mix(col, sc, cov); rr = mix(rr, .7, cov); hh = mix(hh, cov * .0025 * wtN(p * 6.), cov);
  wtPud *= 1. - cov; wtFilm *= 1. - cov; wtGl *= 1. - cov * .7; }
`;
/** The puddles' reflection, at the end of the shader: the mirror image, stronger towards the horizon (as water is). */
export const WET_FINAL = `{ if (wtGl > .001 && wtSunDir.y > 0.) { vec3 Vg = normalize(vEyePosition.xyz - vPositionW), Hg = normalize(wtSunDir + Vg);
  float nh = max(dot(normalW, Hg), 0.), vh = max(dot(Vg, Hg), 0.), Fg = .04 + .96 * pow(1. - vh, 5.);
  float lobe = pow(nh, mix(70., 240., wtWet)) * .45 + pow(nh, 900.) * 3. * wtSpk;
  finalColor.rgb += wtSunCol * lobe * Fg * wtGl * (1. + 1.8 * wtWet); } }
{ float wq = max(wtPud, wtFilm * .3); if (wtMirOn > .5 && wq > .001) {
  vec3 Vw = normalize(vEyePosition.xyz - vPositionW); float cs = clamp(Vw.y, 0., 1.), fr = .02 + .98 * pow(1. - cs, 5.);
  vec3 rc = texture2D(wtMir, gl_FragCoord.xy / wtRes + normalW.xz * .05).rgb;
  finalColor.rgb = mix(finalColor.rgb, rc, clamp(.1 + fr * 1.15, 0., .92) * wq); } }`;
/** Wet ground and puddles on a plain paved material (the roads, the kerb and paths behind the terminal, the stands). */
/** Is this something big enough to matter in the extra passes (a building, a wall, a jetway's body, an aircraft, a mast,
 *  the sky)? Small things (chairs, fittings, wheels, signs on poles) only matter in the picture itself. */
const BIGW = new WeakMap<AbstractMesh, boolean>();
export function isBig(m: AbstractMesh): boolean { let b = BIGW.get(m); if (b != null) return b;
  try { const bi = m.getBoundingInfo(); const e = bi.boundingBox.extendSizeWorld; b = /sky/i.test(m.name) || Math.hypot(e.x, e.y, e.z) * 2 > 4; } catch (e) { b = true; } BIGW.set(m, b); return b; }
/** Does it glow (lights, signs, screens)? */
function glows(m: AbstractMesh): boolean { const src: any = (m as any).sourceMesh || m, mt: any = src.material; if (!mt || mt._soft) return false;
  const c = mt.emissiveColor; return !!mt.emissiveTexture || !!(c && c.r + c.g + c.b > 0.02); }
/** The glow layer draws only what glows, and the big things that stand in front of lights (so a halo never shows
 *  through a wall, a jetway or an aircraft): the look of the glow stays the same, at a fraction of the draw calls. */
export function slimGlow(glow: any, sc: Scene, cam?: Camera, near = 120) {
  // what glows is always in; the big things that only stop glow showing through walls are in only near you (beyond 120 m
  // a glow they would hide is too small to see), kept up to date twice a second
  const T = glow._thinEffectLayer || glow, skip = new Set<number>(((T._excludedMeshes || glow._excludedMeshes) || []) as number[]);
  const blockers = new Set<AbstractMesh>(), inNow = new Set<AbstractMesh>();
  const take = (m: AbstractMesh) => { if (skip.has(m.uniqueId) || (m as any).isAnInstance) return;
    if (glows(m)) glow.addIncludedOnlyMesh(m as Mesh); else if (!(m as any).hasInstances && isBig(m)) { blockers.add(m); if (!cam) { glow.addIncludedOnlyMesh(m as Mesh); inNow.add(m); } } };
  for (const m of sc.meshes) take(m);
  sc.onNewMeshAddedObservable.add(m => setTimeout(() => { if (!m.isDisposed()) take(m); }, 0));
  if (!cam) return;
  const tick = () => { const p = cam.globalPosition;
    for (const m of blockers) { if (m.isDisposed()) { blockers.delete(m); inNow.delete(m); continue; } const bs = m.getBoundingInfo().boundingSphere, want = Vector3.Distance(p, bs.centerWorld) - bs.radiusWorld < near;
      if (want && !inNow.has(m)) { glow.addIncludedOnlyMesh(m as Mesh); inNow.add(m); } else if (!want && inNow.has(m)) { glow.removeIncludedOnlyMesh(m as Mesh); inNow.delete(m); } } };
  tick(); const t = setInterval(tick, 500); sc.onDisposeObservable.addOnce(() => clearInterval(t));
}
let nextPave = 1;
export class WetPlugin extends MaterialPluginBase {
  pave: number;
  // (the base class asks for the shader code while it is being made, before this.pave is set: hence nextPave)
  constructor(mat: any, pave = 1) { nextPave = pave; super(mat, 'Wet', 220, { WETGROUND: false }); this.pave = pave; this._enable(true); }
  getClassName() { return 'WetPlugin'; }
  prepareDefines(d: any) { d.WETGROUND = true; }
  getSamplers(s: string[]) { s.push('wtMir'); }
  getUniforms() { return { ubo: WET_UNIFORMS, fragment: WET_DECL }; }
  bindForSubMesh(ubo: any, scene: Scene) { bindWet(ubo, scene); }
  getCustomCode(type: string, lang?: any): any { if (lang || type === 'vertex') return null;
    return { CUSTOM_FRAGMENT_DEFINITIONS: 'float wtR = 1.; float wtHH = 0.;\n' + WET_GLSL,
      CUSTOM_FRAGMENT_UPDATE_ALPHA: `{ vec3 c = surfaceAlbedo; wetIt(vPositionW.xz, ${(this.pave ?? nextPave).toFixed(2)}, 0., 0., c, wtR, wtHH); snowIt(vPositionW.xz, ${(this.pave ?? nextPave).toFixed(2)}, 0., 0., 0., c, wtR, wtHH); surfaceAlbedo = c;
        vec3 dpx = dFdx(vPositionW), dpy = dFdy(vPositionW); vec3 r1 = cross(dpy, normalW), r2 = cross(normalW, dpx); float det = dot(dpx, r1);
        vec3 grd = sign(det) * (dFdx(wtHH) * r1 + dFdy(wtHH) * r2); normalW = normalize(abs(det) * normalW - grd * 1.6); }`,
      CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR: WET_FINAL,
      '!float roughness=reflectivityOut\\.roughness;': 'float roughness=clamp(reflectivityOut.roughness*wtR,.015,1.);' }; }
}
/** Every paved surface outside that is not the airfield's own ground, and the grass and landscape round it: these get the wet plugin. */
const PAVED = /^(ROAD|asphalt|apron|kerb)$/, SOFT = /^(groundM|grass)$/;
const NOT_REFLECTED = /^(AIRFIELD\/(GROUND|MARKINGS|PAINT)|ground|sea|ROAD|SITE\/(ROAD|APRON|KERB|SIDE-PATH|GRASS))|^look-/;

const glowDot = (sz: number, a: number, col: string) => { const c = document.createElement('canvas'); c.width = c.height = sz; const x = c.getContext('2d')!, g = x.createRadialGradient(sz / 2, sz / 2, 0, sz / 2, sz / 2, sz / 2);
  g.addColorStop(0, col.replace('A', String(a))); g.addColorStop(1, col.replace('A', '0')); x.fillStyle = g; x.fillRect(0, 0, sz, sz); return c; };

export interface LookParts { sc: Scene; cam: Camera; sun: { direction: Vector3 }; dp: DefaultRenderingPipeline; shadows: (ShadowGenerator | null)[]; ground: AbstractMesh[]; base: number; casters: AbstractMesh[] }

export function applyLook(P: LookParts): (dt: number) => void {
  const g: any = S.gfx, { sc, cam, dp } = P, steps: ((dt: number) => void)[] = [], E = sc.getEngine();
  WET.mirror = null; WET.blank = null; WET.wet = 0;
  const tryIt = (f: () => void) => { try { f(); } catch (e) { console.warn('look', e); } };

  // softer contact shadows: sharp where things meet the ground, softer further from it
  for (const sg of P.shadows) if (sg) tryIt(() => { if (g.pcss) { (sg as any).useContactHardeningShadow = true; (sg as any).contactHardeningLightSizeUVRatio = 0.04; } });

  // surface depth: relief (parallax occlusion) on every material with a relief map
  if (g.parallax) for (const m of sc.materials) if (m instanceof PBRMaterial && m.bumpTexture) { m.useParallax = true; m.useParallaxOcclusion = true; m.parallaxScaleBias = 0.025; }

  // many real lights: the light panels and the like light their surroundings (in a clustered container: cheap per light)
  if (g.manyLights && EXTRA_LIGHTS.length) tryIt(() => { const cl = new ClusteredLightContainer('look-lights', EXTRA_LIGHTS.filter(l => !l.isDisposed()), sc); cl.horizontalTiles = 32; cl.verticalTiles = 32; });

  // sky shadows: shade and light from the whole sky (voxelised scene; heavy)
  if (g.iblShadows && sc.environmentTexture) tryIt(() => { const ib = new IblShadowsRenderPipeline('look-sky-shadows', sc, { resolutionExp: IS_PC ? 7 : 6, sampleDirections: IS_PC ? 3 : 1, shadowOpacity: 0.85, shadowRemanence: 0.85, triPlanarVoxelization: true, ssShadowsEnabled: true } as any, [cam]);
    ib.addShadowCastingMesh(P.casters.filter(m => m instanceof Mesh) as Mesh[]); ib.addShadowReceivingMaterial(); ib.updateVoxelization(); });

  // real-time reflections: glossy floors, glass and the wet apron reflect what is round them (heavy)
  // screen reflections (Settings → Graphics → Reflections: Screen), their quality from the slider (kept up to date)
  if (g.reflMode === 'screen' || g.reflMode === 'both') tryIt(() => { const ssr = new SSRRenderingPipeline('look-ssr', sc, [cam], false, Constants.TEXTURETYPE_UNSIGNED_BYTE); ssr.reflectionSpecularFalloffExponent = 2; ssr.thickness = 0.6; ssr.maxDistance = 240; ssr.roughnessFactor = 0.15; ssr.enableAutomaticThicknessComputation = false; ssr.selfCollisionNumSkip = 2;
    let lastQ = -1; const setQ = () => { const q = Math.max(0.1, Math.min(1, (S.gfx as any).ssrQ ?? 0.5)); if (Math.abs(q - lastQ) < 0.01) return; lastQ = q;
      ssr.step = Math.round(4 - 3 * q); ssr.maxSteps = Math.round(80 + 420 * q); ssr.ssrDownsample = q < 0.4 ? 2 : q < 0.75 ? 1 : 0; ssr.strength = 0.5 + 0.5 * q; ssr.blurDispersionStrength = 0.06 - 0.04 * q; };
    setQ(); let t = 0; steps.push(dt => { t += dt; if (t > 0.5) { t = 0; setQ(); } }); });

  // temporal anti-aliasing: no shimmer on handrails, trusses and fences
  if (g.taa) tryIt(() => { const taa = new TAARenderingPipeline('look-taa', sc, [cam]); taa.samples = 8; });

  // motion blur
  if (g.mblur) tryIt(() => { const mb = new MotionBlurPostProcess('look-mblur', sc, 1, cam); mb.motionStrength = 0.6; mb.motionBlurSamples = IS_PC ? 32 : 12; });

  // depth of field: focused on what the camera looks at
  if (g.dof) tryIt(() => { dp.depthOfFieldEnabled = true; dp.depthOfField.fStop = 2.4; dp.depthOfField.focalLength = 50; let t = 0;
    steps.push(dt => { t += dt; if (t < 0.2) return; t = 0; const hit = sc.pickWithRay(new Ray(cam.globalPosition, cam.getDirection(Vector3.Forward()), 2000), m => m.isPickable && m.isVisible); const d = hit && hit.hit ? hit.distance : 400; dp.depthOfField.focusDistance += (d * 1000 - dp.depthOfField.focusDistance) * 0.5; }); });

  // the sun's disc for the rays and the flares: kept far out along the sun's direction, hidden below the horizon
  let sunDisc: Mesh | null = null;
  if (g.volLight || g.flares) { sunDisc = MeshBuilder.CreateSphere('look-sun', { diameter: 40, segments: 12 }, sc); const sm = new StandardMaterial('look-sun', sc); sm.emissiveColor = new Color3(1, 0.86, 0.62); sm.disableLighting = true; sunDisc.material = sm; sunDisc.isPickable = false; sunDisc.applyFog = false;
    steps.push(() => { const d = P.sun.direction; sunDisc!.position.set(cam.globalPosition.x - d.x * 780, cam.globalPosition.y - d.y * 780, cam.globalPosition.z - d.z * 780); const up = -d.y; sunDisc!.setEnabled(up > -0.03); sm.emissiveColor.set(1, 0.72 + 0.2 * Math.min(1, up * 4), 0.45 + 0.3 * Math.min(1, up * 4)); }); }
  // volumetric light: rays from the sun past the buildings, the jetways and through the glass
  if (g.volLight && sunDisc) tryIt(() => { const vls = new VolumetricLightScatteringPostProcess('look-rays', IS_PC ? 0.75 : 0.5, cam, sunDisc!, IS_PC ? 90 : 40, Texture.BILINEAR_SAMPLINGMODE, E, false); vls.exposure = 0.18; vls.decay = 0.965; vls.weight = 0.55; vls.density = 0.92;
    vls.excludedMeshes = sc.meshes.filter(m => m !== sunDisc && !isBig(m));   // only big things block the sun's rays (small ones never show in them)
    steps.push(() => { vls.exposure = 0.18 * Math.max(0, Math.min(1, (-P.sun.direction.y + 0.03) * 6)); }); });
  // lens flares on the sun
  if (g.flares && sunDisc) tryIt(() => { const fs = new LensFlareSystem('look-flares', sunDisc, sc); const tx = (a: number, c: string) => { const t = new DynamicTexture('flare', glowDot(128, a, c), sc, false); t.hasAlpha = true; t.update(); return t as any as Texture; };
    // small and faint ghosts (no big discs across the middle of the view); only big solid things hide the sun
    const fl: [LensFlare, number[]][] = []; const add = (sz: number, p: number, rgb: number[], a: number, c: string) => { const f = new LensFlare(sz, p, new Color3(rgb[0], rgb[1], rgb[2]), null as any, fs); f.texture = tx(a, c); fl.push([f, rgb]); };
    add(0.16, 0, [1, 0.95, 0.85], 0.8, 'rgba(255,240,220,A)'); for (const [sz, p, c] of [[0.025, 0.3, 'rgba(255,200,140,A)'], [0.04, 0.55, 'rgba(180,220,255,A)'], [0.02, 0.8, 'rgba(255,180,120,A)'], [0.05, 1.15, 'rgba(160,200,255,A)']] as [number, number, string][]) add(sz, p, [0.35, 0.35, 0.35], 0.3, c);
    fs.meshesSelectionPredicate = (m: AbstractMesh) => m !== sunDisc && m.isVisible && m.isEnabled() && !!m.material && ((m.material as any).alpha === undefined || (m.material as any).alpha > 0.9) && isBig(m) && !/sky|look-/i.test(m.name);
    // shown only while the sun is up and seen through the clouds, fading with how much of it shows
    steps.push(() => { const k = Math.max(0, Math.min(1, (SUN.alt + 1) / 5)) * Math.max(0, Math.min(1, (SUN.vis - 0.35) / 0.5)); fs.isEnabled = k > 0.02;
      if (fs.isEnabled) for (const [f, rgb] of fl) f.color.set(rgb[0] * k, rgb[1] * k, rgb[2] * k); }); });

  // height fog: a low haze over the ground that thins with height (the distance gets depth)
  if (g.heightFog) tryIt(() => { const dr = sc.enableDepthRenderer(cam, false, true, Texture.NEAREST_SAMPLINGMODE, true);
 const pp = new PostProcess('look-fog', 'heightFog', ['invView', 'camPos', 'fogColor', 'tanHalf', 'aspect', 'density', 'falloff', 'base'], ['depthSampler'], 1, cam);
    pp.onApply = ef => { ef.setTexture('depthSampler', dr.getDepthMap()); const inv = cam.getViewMatrix().clone().invert(); ef.setMatrix('invView', inv); ef.setVector3('camPos', cam.globalPosition);
      const fc = sc.fogColor || new Color3(0.7, 0.75, 0.82), day = Math.max(0.15, Math.min(1, (WX.sunAlt + 6) / 20)); ef.setColor3('fogColor', new Color3(fc.r * day, fc.g * day, fc.b * day)); ef.setFloat('tanHalf', Math.tan((cam as any).fov / 2)); ef.setFloat('aspect', E.getAspectRatio(cam));
      ef.setFloat('density', 0.0016 + 0.004 * WX.rain); ef.setFloat('falloff', 0.035); ef.setFloat('base', P.base); }; });

  // eye adaptation: brighter indoors (under a roof), back down outside, eased like an eye
  if (g.eyeAdapt) { let target = 1, cur = 1, t = 0; const ip = dp.imageProcessing, baseExp = ip.exposure;
    steps.push(dt => { t += dt; if (t > 0.3) { t = 0; const hit = sc.pickWithRay(new Ray(cam.globalPosition, Vector3.Up(), 25), m => m.isPickable && m.isVisible && !(m as any).isAnInstance && isBig(m) && !/sky|look-|COLLIDE|ground|GROUND|sea|ROAD|APRON|GRASS/i.test(m.name), true); target = hit && hit.hit ? 1.32 : 1; }
      cur += (target - cur) * Math.min(1, dt * (target > cur ? 0.6 : 1.4)); const e = baseExp * cur, cfg: any = ip.imageProcessingConfiguration;
      // set straight on the screen pass's settings: through ip.exposure Babylon would tell every material in the place
      // to re-check itself, every frame (hundreds of milliseconds a frame on a phone, indoors and in the jetways)
      if (Math.abs(cfg._exposure - e) > 0.002) cfg._exposure = e; }); }

  // rain and snow on the ground, and the sun glinting on it: wet, darker and glossier while it rains, puddles spreading
  // as it goes on, drying slowly after; snow settling while it snows, melting (and wetting) after; all in the shaders
  // of the airfield, its markings, every paved surface and the grass and landscape round them
  if (g.wetRain || g.glint !== false) for (const mt of sc.materials as any[]) if (mt instanceof PBRMaterial && (PAVED.test(mt.name) || SOFT.test(mt.name)) && !(mt as any)._wet) (mt as any)._wet = new WetPlugin(mt, SOFT.test(mt.name) ? 0 : 1);
  if (g.wetRain) {
    // the puddles' mirror: everything standing (buildings, jetways, masts, aircraft, the sky), seen from below the ground
    if (S.gfx.mirror !== 'off') tryIt(() => { const mt = new MirrorTexture('look-puddles', { ratio: S.gfx.mirror === 'high' ? (IS_PC ? 0.5 : 0.35) : 0.25 }, sc, true);
      mt.mirrorPlane = new Plane(0, -1, 0, P.base + 0.02); mt.renderListPredicate = (m: AbstractMesh) => m.isVisible && m.isEnabled() && isBig(m) && !NOT_REFLECTED.test(m.name) && !(m.material && NOT_REFLECTED.test(m.material.name));
      mt.refreshRate = 100000; sc.customRenderTargets.push(mt); WET.mirror = mt; });
    let wet = 0, snow = 0, was = false; steps.push(dt => { const r = WX.rain, sn = SUN.snow;
      // snow settles in about four minutes of snowfall and melts in about ten; melting snow wets the ground
      snow += sn > 0.05 ? (Math.min(1, 0.3 + sn) - snow) * Math.min(1, dt * 0.008) : -Math.min(snow, dt * 0.0017);
      const wantWet = r > 0.05 ? Math.min(1, 0.4 + r) : snow > 0.05 && sn <= 0.05 ? 0.55 : sn > 0.05 ? 0.3 : 0;
      wet += (wantWet - wet) * Math.min(1, dt * (wantWet > wet ? 0.012 : 0.004));
      WET.wet = wet; WET.snow = snow; WET.rain = Math.min(1, r * 1.4); WET.t = (WET.t + dt) % 1000;
      const on = wet > 0.03; if (WET.mirror && on !== was) { WET.mirror.refreshRate = on ? (IS_PC ? 1 : 2) : 100000; was = on; } }); }
  // the sun glinting on the tarmac, the concrete and the markings: from the sun's side only, and only when the sun
  // gets through the clouds (sunshine through a gap in them glints too)
  steps.push(() => { const d = P.sun.direction, L = Math.hypot(d.x, d.y, d.z) || 1; WET.sun[0] = -d.x / L; WET.sun[1] = -d.y / L; WET.sun[2] = -d.z / L;
    const sl: any = P.sun, k = g.glint === false ? 0 : (sl.intensity || 0) * SUN.vis * 0.55 * Math.max(0, Math.min(1, (SUN.alt + 1) / 6)), c = sl.diffuse || { r: 1, g: 1, b: 1 };
    WET.sunCol[0] = c.r * k; WET.sunCol[1] = c.g * k; WET.sunCol[2] = c.b * k; });

  void Color4; void Light;
  return (dt: number) => { for (const s of steps) s(dt); };
}
