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
export const WET: { wet: number; rain: number; t: number; mirror: MirrorTexture | null; blank: RawTexture | null } = { wet: 0, rain: 0, t: 0, mirror: null, blank: null };
export const WET_UNIFORMS = [{ name: 'wtWet', size: 1, type: 'float' }, { name: 'wtRain', size: 1, type: 'float' }, { name: 'wtT', size: 1, type: 'float' }, { name: 'wtRes', size: 2, type: 'vec2' }, { name: 'wtMirOn', size: 1, type: 'float' }];
export const WET_DECL = 'uniform float wtWet; uniform float wtRain; uniform float wtT; uniform vec2 wtRes; uniform float wtMirOn;';
export const bindWet = (ubo: any, scene: Scene) => { const E = scene.getEngine(); ubo.updateFloat('wtWet', WET.wet); ubo.updateFloat('wtRain', WET.rain); ubo.updateFloat('wtT', WET.t);
  ubo.updateFloat2('wtRes', E.getRenderWidth(), E.getRenderHeight()); const on = !!WET.mirror && WET.wet > 0.03; ubo.updateFloat('wtMirOn', on ? 1 : 0);
  if (!WET.blank) WET.blank = new RawTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, Constants.TEXTUREFORMAT_RGBA, scene);
  ubo.setTexture('wtMir', on ? WET.mirror : WET.blank); };
/** The wet ground in GLSL: wetIt(plan position, how paved (0 grass, 1 asphalt/concrete), along (1 on the runway: puddles
 *  drawn out along it, in the wheel ruts), bias (low spots: more water), colour, roughness, relief).
 *  Damp: darker, asphalt and concrete most, grass only a little. A damp sheen first, then shallow sheets of water in the
 *  hollows, broad and ragged at the edges, spreading the longer it rains and drying from the edges after; mirror-smooth,
 *  reflecting what stands round them (wtFinal), rippled by the drops while it rains. */
export const WET_GLSL = `
uniform sampler2D wtMir; float wtPud = 0.; float wtFilm = 0.;
float wtH1(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float wtN(vec2 p){ vec2 i = floor(p), q = fract(p); vec2 u = q * q * (3. - 2. * q); return mix(mix(wtH1(i), wtH1(i + vec2(1., 0.)), u.x), mix(wtH1(i + vec2(0., 1.)), wtH1(i + vec2(1., 1.)), u.x), u.y); }
float wtRip(vec2 p, float t){ float h = 0.; for (int k = 0; k < 3; k++) { vec2 q = p * 2.6 + float(k) * 7.31; vec2 c = floor(q), f = fract(q); vec2 o = vec2(wtH1(c), wtH1(c + 13.7)) * .7 + .15;
  float ph = fract(t * (.7 + .3 * wtH1(c + 3.3)) + wtH1(c + 5.1)), d = length(f - o), r = ph * .42; h += sin((d - r) * 75.) * (1. - ph) * (1. - smoothstep(0., .06, abs(d - r))); } return h; }
void wetIt(vec2 p, float pave, float along, float bias, inout vec3 col, inout float rr, inout float hh){
  float w = wtWet; if (w < .002) return;
  float damp = w * mix(.4, 1., pave); col *= 1. - damp * mix(.2, .4, pave); rr = mix(rr, rr * mix(.88, .45, pave), damp);
  vec2 q = p * vec2(mix(1., .28, along), 1.);
  float n = wtN(q * .03) * .42 + wtN(q * .09 + 3.1) * .3 + wtN(q * .3 + 7.7) * .17 + wtN(p * 1.3 + 1.9) * .07 + wtN(p * 4.1) * .04 + bias;
  float th = mix(.86, .55, w);
  wtFilm = smoothstep(th - .09, th, n) * pave * w; col *= 1. - .18 * wtFilm; rr = mix(rr, min(rr, .14), wtFilm);
  wtPud = smoothstep(th, th + .015, n) * pave;
  if (wtPud > 0.) { col = mix(col, col * .42, wtPud); rr = mix(rr, .015, wtPud); hh = mix(hh, wtRain * .0022 * wtRip(p, wtT), wtPud); } }
`;
/** The puddles' reflection, at the end of the shader: the mirror image, stronger towards the horizon (as water is). */
export const WET_FINAL = `{ float wq = max(wtPud, wtFilm * .3); if (wtMirOn > .5 && wq > .001) {
  vec3 Vw = normalize(vEyePosition.xyz - vPositionW); float cs = clamp(Vw.y, 0., 1.), fr = .02 + .98 * pow(1. - cs, 5.);
  vec3 rc = texture2D(wtMir, gl_FragCoord.xy / wtRes + normalW.xz * .05).rgb;
  finalColor.rgb = mix(finalColor.rgb, rc, clamp(.1 + fr * 1.15, 0., .92) * wq); } }`;
/** Wet ground and puddles on a plain paved material (the roads, the kerb and paths behind the terminal, the stands). */
export class WetPlugin extends MaterialPluginBase {
  constructor(mat: any) { super(mat, 'Wet', 220, { WETGROUND: false }); this._enable(true); }
  getClassName() { return 'WetPlugin'; }
  prepareDefines(d: any) { d.WETGROUND = true; }
  getSamplers(s: string[]) { s.push('wtMir'); }
  getUniforms() { return { ubo: WET_UNIFORMS, fragment: WET_DECL }; }
  bindForSubMesh(ubo: any, scene: Scene) { bindWet(ubo, scene); }
  getCustomCode(type: string, lang?: any): any { if (lang || type === 'vertex') return null;
    return { CUSTOM_FRAGMENT_DEFINITIONS: 'float wtR = 1.; float wtHH = 0.;\n' + WET_GLSL,
      CUSTOM_FRAGMENT_UPDATE_ALPHA: `{ vec3 c = surfaceAlbedo; wetIt(vPositionW.xz, 1., 0., 0., c, wtR, wtHH); surfaceAlbedo = c;
        vec3 dpx = dFdx(vPositionW), dpy = dFdy(vPositionW); vec3 r1 = cross(dpy, normalW), r2 = cross(normalW, dpx); float det = dot(dpx, r1);
        vec3 grd = sign(det) * (dFdx(wtHH) * r1 + dFdy(wtHH) * r2); normalW = normalize(abs(det) * normalW - grd * 1.6); }`,
      CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR: WET_FINAL,
      '!float roughness=reflectivityOut\\.roughness;': 'float roughness=clamp(reflectivityOut.roughness*wtR,.015,1.);' }; }
}
/** Every paved surface outside that is not the airfield's own ground: these get the wet plugin. */
const PAVED = /^(ROAD|asphalt|apron|kerb)$/;
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
  if (g.ssr) tryIt(() => { const ssr = new SSRRenderingPipeline('look-ssr', sc, [cam], false, Constants.TEXTURETYPE_UNSIGNED_BYTE); ssr.strength = 0.9; ssr.reflectionSpecularFalloffExponent = 2; ssr.thickness = 0.6; ssr.maxDistance = 240; ssr.step = IS_PC ? 1 : 3; ssr.maxSteps = IS_PC ? 500 : 160; ssr.blurDispersionStrength = 0.03; ssr.roughnessFactor = 0.15; ssr.enableAutomaticThicknessComputation = false; ssr.selfCollisionNumSkip = 2; });

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
    steps.push(() => { const d = P.sun.direction; sunDisc!.position.copyFrom(cam.globalPosition.subtract(d.scale(780))); const up = -d.y; sunDisc!.setEnabled(up > -0.03); sm.emissiveColor.set(1, 0.72 + 0.2 * Math.min(1, up * 4), 0.45 + 0.3 * Math.min(1, up * 4)); }); }
  // volumetric light: rays from the sun past the buildings, the jetways and through the glass
  if (g.volLight && sunDisc) tryIt(() => { const vls = new VolumetricLightScatteringPostProcess('look-rays', IS_PC ? 0.75 : 0.5, cam, sunDisc!, IS_PC ? 90 : 40, Texture.BILINEAR_SAMPLINGMODE, E, false); vls.exposure = 0.18; vls.decay = 0.965; vls.weight = 0.55; vls.density = 0.92;
    steps.push(() => { vls.exposure = 0.18 * Math.max(0, Math.min(1, (-P.sun.direction.y + 0.03) * 6)); }); });
  // lens flares on the sun
  if (g.flares && sunDisc) tryIt(() => { const fs = new LensFlareSystem('look-flares', sunDisc, sc); const tx = (a: number, c: string) => { const t = new DynamicTexture('flare', glowDot(128, a, c), sc, false); t.hasAlpha = true; t.update(); return t as any as Texture; };
    new LensFlare(0.32, 0, new Color3(1, 0.95, 0.85), null as any, fs).texture = tx(0.9, 'rgba(255,240,220,A)'); for (const [s, p, c] of [[0.06, 0.25, 'rgba(255,200,140,A)'], [0.1, 0.5, 'rgba(180,220,255,A)'], [0.05, 0.75, 'rgba(255,180,120,A)'], [0.14, 1.1, 'rgba(160,200,255,A)']] as [number, number, string][]) new LensFlare(s, p, new Color3(1, 1, 1), null as any, fs).texture = tx(0.35, c); });

  // height fog: a low haze over the ground that thins with height (the distance gets depth)
  if (g.heightFog) tryIt(() => { const dr = sc.enableDepthRenderer(cam, false, true, Texture.NEAREST_SAMPLINGMODE, true); const pp = new PostProcess('look-fog', 'heightFog', ['invView', 'camPos', 'fogColor', 'tanHalf', 'aspect', 'density', 'falloff', 'base'], ['depthSampler'], 1, cam);
    pp.onApply = ef => { ef.setTexture('depthSampler', dr.getDepthMap()); const inv = cam.getViewMatrix().clone().invert(); ef.setMatrix('invView', inv); ef.setVector3('camPos', cam.globalPosition);
      const fc = sc.fogColor || new Color3(0.7, 0.75, 0.82), day = Math.max(0.15, Math.min(1, (WX.sunAlt + 6) / 20)); ef.setColor3('fogColor', new Color3(fc.r * day, fc.g * day, fc.b * day)); ef.setFloat('tanHalf', Math.tan((cam as any).fov / 2)); ef.setFloat('aspect', E.getAspectRatio(cam));
      ef.setFloat('density', 0.0016 + 0.004 * WX.rain); ef.setFloat('falloff', 0.035); ef.setFloat('base', P.base); }; });

  // eye adaptation: brighter indoors (under a roof), back down outside, eased like an eye
  if (g.eyeAdapt) { let target = 1, cur = 1, t = 0; const ip = dp.imageProcessing, baseExp = ip.exposure;
    steps.push(dt => { t += dt; if (t > 0.3) { t = 0; const hit = sc.pickWithRay(new Ray(cam.globalPosition, Vector3.Up(), 25), m => m.isPickable && m.isVisible && !/sky|look-/i.test(m.name)); target = hit && hit.hit ? 1.32 : 1; }
      cur += (target - cur) * Math.min(1, dt * (target > cur ? 0.6 : 1.4)); ip.exposure = baseExp * cur; }); }

  // rain on the ground: wet, darker and glossier while it rains, puddles spreading as it goes on, drying slowly after
  //  (the airfield, its markings and every paved surface in their shaders; the far landscape here: a little darker)
  if (g.wetRain) { const mats = new Map<any, { r: number; c: Color3 | null }>(); for (const m of P.ground) { const mt: any = m.material; if (mt && 'roughness' in mt && !mats.has(mt) && !/^AIRFIELD\/(GROUND|PAINT)$/.test(mt.name) && !PAVED.test(mt.name)) mats.set(mt, { r: mt.roughness ?? 0.9, c: mt.albedoColor ? mt.albedoColor.clone() : null }); }
    for (const mt of sc.materials as any[]) if (mt instanceof PBRMaterial && PAVED.test(mt.name) && !(mt as any)._wet) (mt as any)._wet = new WetPlugin(mt);
    // the puddles' mirror: everything standing (buildings, jetways, masts, aircraft, the sky), seen from below the ground
    if (S.gfx.mirror !== 'off') tryIt(() => { const mt = new MirrorTexture('look-puddles', { ratio: S.gfx.mirror === 'high' ? (IS_PC ? 0.5 : 0.35) : 0.25 }, sc, true);
      mt.mirrorPlane = new Plane(0, -1, 0, P.base + 0.02); mt.renderListPredicate = (m: AbstractMesh) => m.isVisible && m.isEnabled() && !NOT_REFLECTED.test(m.name) && !(m.material && NOT_REFLECTED.test(m.material.name));
      mt.refreshRate = 100000; sc.customRenderTargets.push(mt); WET.mirror = mt; });
    let wet = 0, was = false; steps.push(dt => { const r = WX.rain; wet += ((r > 0.05 ? Math.min(1, 0.4 + r) : 0) - wet) * Math.min(1, dt * (r > 0.05 ? 0.012 : 0.004));
      WET.wet = wet; WET.rain = Math.min(1, r * 1.4); WET.t = (WET.t + dt) % 1000;
      const on = wet > 0.03; if (WET.mirror && on !== was) { WET.mirror.refreshRate = on ? (IS_PC ? 1 : 2) : 100000; was = on; }
      for (const [mt, b] of mats) { mt.roughness = b.r * (1 - 0.15 * wet); if (b.c && mt.albedoColor) mt.albedoColor.copyFrom(b.c.scale(1 - 0.2 * wet)); } }); }

  void Color4; void Light;
  return (dt: number) => { for (const s of steps) s(dt); };
}
