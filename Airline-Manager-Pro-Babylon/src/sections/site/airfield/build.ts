// @ts-nocheck
// Your airport's airfield in 3D, from the same plan and the same drawing as the architect sheets:
//  · the ground is ONE mesh: grass, asphalt (runway, taxiways, the terminal apron, shoulders) and the concrete cargo
//    apron come from a pavement mask drawn with the sheets' own field drawing; every surface is worked out in the shader
//    from its place on the plan (grain, lanes, sealed cracks, dirt, rubber in the touchdown zones, tyre and oil marks on
//    the stands, slabs and joints), so nothing tiles and the surfaces join seamlessly; the edge against the grass wavers;
//  · every painted marking is ONE mesh, recorded from the sheets' drawing (the same lines at the same places), painted
//    onto the asphalt: its grain shows through, worn, chipped, dirty, rubbered; lines too thin for the screen are widened
//    and fainter, so the holding positions and the edge lines stay visible from far away;
//  · the signs one mesh, the lights thin instances, the runway guard lights flashing in turn (wig-wag).
// buildAirfield(sc, parent, opts) -> { frame, ground, marks, signs, lights, casters, exclude, step(t), dispose() }
import { fileTex } from '../../../core/filetex';
import { TransformNode, Mesh, VertexData, PBRMaterial, StandardMaterial, Color3, RawTexture, Texture, DynamicTexture, MaterialPluginBase, Matrix, Vector3, MeshBuilder } from '@babylonjs/core';
import { AIRFIELD as AF, TERMINAL as TL } from './plan';
import { field } from './field';
import { WET_GLSL, WET_FINAL, WET_UNIFORMS, WET_DECL, bindWet } from '../../../core/look';

const R = AF.runway, Y = AF.ys, PU = AF.airport.planU, PV = AF.airport.planV;
const M0 = [-2060, -230], M1 = [2300, 1380];
/** A number as a GLSL float. */
const f = (n: number) => { const s = String(Math.round(n * 1e4) / 1e4); return /[.e]/.test(s) ? s : s + '.'; };
/** Plan metres (x along the runway, y towards it) and a height -> the airfield frame's local position. */
export const planToLocal = (x: number, y: number, h = 0) => new Vector3(x + PU, h, y + PV);

// ---------- shaders: noise and the surfaces, shared by the ground and the paint ----------
const standCode = () => {
  const st = AF.stands.map(s => [s.x, s.nose, s.dir, s.code === 'F' ? 2 : 1]);
  return `float standOne(vec2 p, vec4 s, float fi, inout float oil){ float dx = abs(p.x - s.x); float a = (p.y - s.y) * s.z; if (a < -2. || a > 95.) return 0.;
      float fade = 1. - smoothstep(40., 95., a); float w6 = s.w > 1.5 ? 6. : 3.8, w12 = s.w > 1.5 ? 12. : 5.7, oz = s.w > 1.5 ? 30. : 14.;
      oil += smoothstep(.62, .9, fbm(p * .5 + fi * 7.)) * exp(-pow((dx - w12) / 2.5, 2.)) * (1. - smoothstep(4., 22., abs(a - oz)));
      return (exp(-pow((dx - w6) / .55, 2.)) * .9 + exp(-pow(dx / .35, 2.)) * .7) * fade; }
    float standMarks(vec2 p, out float oil){ oil = 0.; float t = 0.;
      if ((p.y < ${f(TL.PN - 4)} || p.y > ${f(Y.TY + 10)}) && (p.y < ${f(Y.KY + 20)} || p.y > ${f(AF.cargoBuilding.y0)})) return 0.;
      ${st.map((s, i) => `t += standOne(p, vec4(${s.map(f).join(', ')}), ${f(i)}, oil);`).join('\n      ')}
      return t; }`;
};
const glNoise = (low: boolean) => `uniform sampler2D afSkid;
    float h21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    float vn(vec2 p){ vec2 i = floor(p), q = fract(p); vec2 u = q * q * (3. - 2. * q); return mix(mix(h21(i), h21(i + vec2(1., 0.)), u.x), mix(h21(i + vec2(0., 1.)), h21(i + vec2(1., 1.)), u.x), u.y); }
    float fbm(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < ${low ? 3 : 5}; i++) { s += a * vn(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p + 7.7; a *= .5; } return s; }
    float vnA(vec2 p, float w){ return mix(vn(p), .5, smoothstep(.3, .9, w)); }
    vec2 vor(vec2 p){ vec2 i = floor(p), q = fract(p); float d1 = 8., d2 = 8.; for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 g = vec2(float(x), float(y)); vec2 o = vec2(h21(i + g), h21(i + g + 19.7)); vec2 r = g + o - q; float d = dot(r, r); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; } return vec2(sqrt(d1), sqrt(d2) - sqrt(d1)); }
    // the grain of the asphalt (aggregate), fading out when smaller than a pixel
    float grain(vec2 pl, float w){ return (vnA(pl * 34., w * 34.) - .5) * .32 + (vnA(pl * 95., w * 95.) - .5) * .42 + (vnA(pl * 230., w * 230.) - .5) * .34; }
    // rubber and skid marks in the two touchdown zones (from the landing thresholds)
    // (the marks from the skid-mark picture: 96 m long, tiling along the runway, 30 m across the centre line; turned round
    //  for the far end, so they start heavy where the wheels touch and fade the way the aircraft rolls)
    float rubber(vec2 p){ float y = p.y - ${f(R.y)}; if (abs(y) > 15.) return 0.;
      float d0 = p.x - ${f(R.x0 + R.ends[0].disp)}, d1 = ${f(R.x1 - R.ends[1].disp)} - p.x;
      float z0 = smoothstep(-30., 140., d0) * (1. - smoothstep(700., 1400., d0)), z1 = smoothstep(-30., 140., d1) * (1. - smoothstep(700., 1400., d1));
      float z = max(z0 + z1, .14 * step(${f(R.x0)}, p.x) * step(p.x, ${f(R.x1)})); if (z < .001) return 0.;
      float u = z0 >= z1 ? (d0 + 18.) / 96. : (d1 + 18.) / 96.; float sk = texture2D(afSkid, vec2(u, y / 30. + .5)).r;
      return clamp(z * sk * (.8 + .4 * vn(vec2(p.x * .004, 1.7))) * 1.15, 0., 1.); }
    // dirt in patches
    float dirt(vec2 p){ return smoothstep(.55, .86, fbm(p * .055 + 20.)) * .9 + smoothstep(.7, .95, fbm(p * .4 + 3.)) * .3; }
    ${standCode()}
`;
const glSurf = (low: boolean) => `
    vec4 maskAt(vec2 p){ vec2 u = vec2((p.x - ${f(M0[0])}) / ${f(M1[0] - M0[0])}, (${f(M1[1])} - p.y) / ${f(M1[1] - M0[1])}); if (u.x < 0. || u.y < 0. || u.x > 1. || u.y > 1.) return vec4(0.); return texture2D(afMask, u); }
    // grass: mown in stripes along the runway, greener and drier patches, rougher clumps
    vec3 grassCol(vec2 p, vec2 pl, float w, out float h){ float n1 = fbm(p * .018), n2 = fbm(p * .11 + 3.), n3 = vnA(pl * 2.6, w * 2.6), n4 = vnA(pl * 11., w * 11.), n5 = vnA(pl * 40., w * 40.);
      vec3 c = mix(vec3(.13, .2, .07), vec3(.24, .3, .11), n1); c = mix(c, vec3(.34, .33, .17), smoothstep(.55, .82, n2) * .55);
      c *= .93 + .1 * step(.5, fract(p.y / 9.)); c *= .78 + .44 * n3; c *= .82 + .36 * n4; c *= .85 + .3 * n5; h = n4 * .03 + n5 * .015; return c; }
    vec3 asphCol(vec2 p, vec2 pl, float w, float kind, float rw, out float h, out float r){
      vec3 base = mix(vec3(.112, .108, .103), vec3(.2, .195, .185), kind); base = mix(base, vec3(.092, .09, .088), rw);
      float m1 = fbm(p * .006), m2 = fbm(p * .04 + 5.), m3 = vn(pl * .9 + 2.), m4 = vn(pl * 3.1 + 7.), g = grain(pl, w);
      vec3 c = base * (.84 + .32 * m1) * (.9 + .2 * m2) * (.94 + .12 * m3) * (.96 + .08 * m4) * (1. + g * 1.35);
      c += vec3(.5, .48, .45) * pow(max(vnA(pl * 160., w * 160.) - .6, 0.) * 2.5, 3.) * (1. - smoothstep(.0, .012, w));
      // the runway: laid in 5 m lanes (a slightly different tone each, a fine joint between), tyre-polished down its middle
      float ly = (p.y - ${f(R.y)}) / 5. + .5, lane = floor(ly), lf = fract(ly); c *= 1. + (h21(vec2(lane, 3.)) - .5) * .035 * rw;
      float lj = (1. - smoothstep(.004, .004 + w, min(lf, 1. - lf) * 5.)) * rw * (1. - smoothstep(.02, .15, w)); c = mix(c, c * .72, lj * .5);
      c = mix(c, c * .86, rw * (1. - smoothstep(3., 11., abs(p.y - ${f(R.y)}))) * .5);
      // cracks: a few transverse ones across the runway and taxiways, mostly sealed with tar; rare fine ones elsewhere
      float tx = p.x + (vn(vec2(p.y * .08, p.x * .01)) - .5) * 3. + (vn(pl * 1.3) - .5) * .4; float cell = floor(tx / 31.), ct = abs(fract(tx / 31.) - .5) * 31.;
      float on = step(.55, h21(vec2(cell, 7.))) * smoothstep(.2, .45, vn(vec2(p.y * .15, cell * 3.)));
      float sealed = (1. - smoothstep(.02, .02 + w * .8 + .015, ct)) * on, fine = (1. - smoothstep(.002, .002 + w * .8, ct)) * (1. - on) * step(.86, h21(vec2(cell, 11.))) * smoothstep(.45, .6, vn(vec2(p.y * .09, cell * 5.))) * .6;
      float net = 0.;
      ${low ? '' : `vec2 wq = pl + (vec2(vn(pl * .6), vn(pl * .6 + 9.)) - .5) * 1.4; vec2 v = vor(wq * .25);
      net = (1. - smoothstep(.0012, .0012 + w * .25, v.y * .25)) * smoothstep(.8, .88, fbm(p * .02 + 9.));`}
      c = mix(c, vec3(.014, .014, .015), clamp(sealed * .9 + fine * .7 + net * .7, 0., 1.));
      float d = dirt(p); c = mix(c, c * vec3(1.32, 1.16, .88) + vec3(.03, .024, .01), d * .4 * (1. - rw * .5));
      float oil; float tr = (1. - rw) * standMarks(p, oil); c = mix(c, c * .7, clamp(tr * .3, 0., .5)); c = mix(c, vec3(.035, .033, .03), clamp(oil * (1. - rw), 0., 1.) * .6);
      float ru = rw * rubber(p); c = mix(c, vec3(.02, .02, .022), ru * .86);
      h = g * .008 - (sealed - .3 * sealed) * .002 - fine * .004 - net * .004; r = .93 - ru * .28 - g * .08 - sealed * .35; return c; }
    vec3 concCol(vec2 p, vec2 pl, float w, out float h, out float r){
      vec2 q = p / 5., fq = fract(q), cell = floor(q); float ed = min(min(fq.x, 1. - fq.x), min(fq.y, 1. - fq.y)) * 5.;
      float joint = (1. - smoothstep(.011, .011 + w * 1.1, ed)) * (1. - smoothstep(.015, .08, w)); float tint = h21(cell) * .07 + h21(cell + 3.1) * .04;
      float g = (vnA(pl * 60., w * 60.) - .5) * .18 + (vnA(pl * 170., w * 170.) - .5) * .14 + (vnA(pl * 8., w * 8.) - .5) * .1;
      vec3 c = vec3(.33, .322, .305) * (.93 + tint) * (1. + g) * (.9 + .16 * fbm(p * .03));
      float oil; float tr = standMarks(p, oil); c = mix(c, c * .62, clamp(tr * .35, 0., .6)); c = mix(c, vec3(.13, .12, .11), clamp(oil, 0., 1.) * .7);
      float d = dirt(p); c = mix(c, c * vec3(1.15, 1.06, .9), d * .3); c = mix(c, c * .45, joint * .7);
      h = g * .004 - joint * .006; r = .78 - oil * .3; return c; }
`;
const BUMP = `{ vec3 dpx = dFdx(vPositionW), dpy = dFdy(vPositionW); vec3 r1 = cross(dpy, normalW), r2 = cross(normalW, dpx); float det = dot(dpx, r1);
      vec3 grd = sign(det) * (dFdx(afH) * r1 + dFdy(afH) * r2); normalW = normalize(abs(det) * normalW - grd * 1.6); }`;

/** The runway's skid marks (own picture, tiling along the runway). */
let SKID: Texture | null = null;
const skidTex = (scene) => { if (!SKID || SKID.getScene() !== scene) { SKID = fileTex('runway-skid', scene); SKID.wrapU = Texture.WRAP_ADDRESSMODE; SKID.wrapV = Texture.CLAMP_ADDRESSMODE; SKID.anisotropicFilteringLevel = 8; } return SKID; };
/** Where the camera is on the plan, rounded to 256 m: the fine noise is worked out from there (keeps its precision). */
const orgOf = (scene, mesh) => { const cam = scene.activeCamera; if (!cam) return [0, 0]; const inv = mesh.getWorldMatrix().clone(); inv.invert();
  const lp = Vector3.TransformCoordinates(cam.globalPosition, inv); return [Math.floor((lp.x - PU) / 256) * 256, Math.floor((lp.z - PV) / 256) * 256]; };

class AirfieldGroundPlugin extends MaterialPluginBase {
  constructor(mat, mask, low) { super(mat, 'AirfieldGround', 210, { AFGROUND: false }); this.mask = mask; this.low = low; this._code = null; this._enable(true); }
  getClassName() { return 'AirfieldGroundPlugin'; }
  prepareDefines(defines) { defines.AFGROUND = true; }
  isReadyForSubMesh() { return !this.mask || this.mask.isReady(); }
  getSamplers(samplers) { samplers.push('afMask', 'afSkid', 'wtMir'); }
  getUniforms() { return { ubo: [{ name: 'afOrg', size: 2, type: 'vec2' }, ...WET_UNIFORMS], vertex: 'uniform vec2 afOrg;', fragment: 'uniform vec2 afOrg; ' + WET_DECL }; }
  bindForSubMesh(ubo, scene, engine, subMesh) { const o = orgOf(scene, subMesh.getMesh()); ubo.updateFloat2('afOrg', o[0], o[1]); ubo.setTexture('afMask', this.mask); ubo.setTexture('afSkid', skidTex(scene)); bindWet(ubo, scene); }
  getCustomCode(type, lang) {
    if (lang) return null;
    if (type === 'vertex') return { CUSTOM_VERTEX_DEFINITIONS: 'varying vec2 vPlan;', CUSTOM_VERTEX_MAIN_END: `vPlan = positionUpdated.xz - vec2(${f(PU)}, ${f(PV)});` };
    return this._code || (this._code = {
      CUSTOM_FRAGMENT_DEFINITIONS: `varying vec2 vPlan; uniform sampler2D afMask; float afH = 0.; float afR = .9; float afRw = 0.;\n${glNoise(this.low)}\n${glSurf(this.low)}\n${WET_GLSL}`,
      CUSTOM_FRAGMENT_UPDATE_ALPHA: `{
        vec2 p = vPlan, pl = p - afOrg; float fw = max(length(fwidth(p)), 1e-4);
        vec4 ms = maskAt(p);
        // the edge against the grass: the pavement's own outline, wavering gently and worn
        vec2 wp = p + (vec2(vn(p * .21), vn(p * .21 + 17.)) - .5) * 1.1 + (vec2(vn(pl * 1.9 + 5.), vn(pl * 1.9 + 9.)) - .5) * .32;
        vec4 mw = maskAt(wp); float pa = max(max(mw.r, mw.g), mw.b);
        float pave = smoothstep(.47, .53, pa + (vnA(pl * 9., fw * 9.) - .5) * .14);
        float gh; vec3 gc = grassCol(p, pl, fw, gh);
        // dirt and sand where the grass meets the pavement
        float band = smoothstep(.12, .46, pa) * (1. - pave); gc = mix(gc, vec3(.27, .24, .18) * (.8 + .4 * vn(pl * 3.)), band * .7);
        vec3 col = gc; float hh = gh, rr = .96;
        if (pa > .3) {
          float isC = smoothstep(.45, .55, ms.g), isS = smoothstep(.45, .55, ms.b);
          float isR = (1. - smoothstep(${f(R.w / 2 - 0.4)}, ${f(R.w / 2 + 0.4)}, abs(p.y - ${f(R.y)}))) * step(${f(R.x0 - R.stopway)}, p.x) * step(p.x, ${f(R.x1 + R.stopway)});
          float ah, ar; vec3 ac = asphCol(p, pl, fw, isS, isR * (1. - isS), ah, ar); vec3 pc = ac; float ph = ah, pr = ar;
          if (isC > .001) { float ch, cr; vec3 cc = concCol(p, pl, fw, ch, cr); pc = mix(ac, cc, isC); ph = mix(ah, ch, isC); pr = mix(ar, cr, isC); }
          float worn = (1. - smoothstep(.5, .78, pa)) * (1. - isC); pc = mix(pc, pc * vec3(1.18, 1.1, .92) + .02, worn * .5);
          float tuft = smoothstep(.62, .75, vnA(pl * 5.5, fw * 5.5)) * worn; pc = mix(pc, gc * 1.1, tuft * .8);
          col = mix(gc, pc, pave); hh = mix(gh, ph, pave); rr = mix(.96, pr, pave); afRw = isR * (1. - isS);
        }
        { float yy = abs(p.y - ${f(R.y)}); wetIt(p, pave, afRw, afRw * (.07 * exp(-pow((yy - 4.4) / 2.4, 2.)) + .03 * exp(-pow(yy / 1.6, 2.))), col, rr, hh);
          snowIt(p, pave, afRw, max(1. - smoothstep(.55, .95, pa), afRw * smoothstep(${f(R.w / 2 - 9)}, ${f(R.w / 2 - 1)}, yy)), afRw * (exp(-pow((yy - 4.4) / 1.6, 2.)) + .6 * exp(-pow(yy / 1.2, 2.))), col, rr, hh); }
        surfaceAlbedo = col; afH = hh; afR = rr; }
        ${BUMP}`,
      '!float roughness=reflectivityOut\\.roughness;': 'float roughness=clamp(afR,.015,1.);',
      CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR: WET_FINAL,
    });
  }
}
class AirfieldPaintPlugin extends MaterialPluginBase {
  constructor(mat, atlas, low) { super(mat, 'AirfieldPaint', 210, { AFPAINT: false }); this.atlas = atlas; this.low = low; this.pix = 0.0012; this._code = null; this._enable(true); }
  getClassName() { return 'AirfieldPaintPlugin'; }
  prepareDefines(defines) { defines.AFPAINT = true; }
  isReadyForSubMesh() { return !this.atlas || this.atlas.isReady(); }
  getAttributes(attributes) { attributes.push('aCol', 'aInfo', 'aSide'); }
  getSamplers(samplers) { samplers.push('afAtlas', 'afSkid', 'wtMir'); }
  getUniforms() { return { ubo: [{ name: 'afOrg', size: 2, type: 'vec2' }, { name: 'afPix', size: 1, type: 'float' }, ...WET_UNIFORMS], vertex: 'uniform vec2 afOrg; uniform float afPix;', fragment: 'uniform vec2 afOrg; uniform float afPix; ' + WET_DECL }; }
  bindForSubMesh(ubo, scene, engine, subMesh) { const o = orgOf(scene, subMesh.getMesh()), cam = scene.activeCamera;
    ubo.updateFloat2('afOrg', o[0], o[1]); ubo.updateFloat('afPix', cam ? (cam.fov || 0.8) / Math.max(1, engine.getRenderHeight()) : this.pix); ubo.setTexture('afAtlas', this.atlas); ubo.setTexture('afSkid', skidTex(scene)); bindWet(ubo, scene); }
  getCustomCode(type, lang) {
    if (lang) return null;
    if (type === 'vertex') return {
      CUSTOM_VERTEX_DEFINITIONS: 'attribute vec4 aCol; attribute vec4 aInfo; attribute vec3 aSide; varying vec4 vCol; varying vec4 vInfo; varying vec2 vPlan;',
      // a line thinner than about 1.3 pixels is widened to that, and made fainter by as much (it keeps its coverage)
      CUSTOM_VERTEX_UPDATE_POSITION: `vCol = aCol; vInfo = aInfo;
        if (abs(aSide.z) > .5) { vec3 wpos = (world * vec4(positionUpdated, 1.)).xyz; float dist = length(vEyePosition.xyz - wpos); vec3 vw = normalize(wpos - vEyePosition.xyz);
          vec3 vd = vec3(dot(vw, world[0].xyz), dot(vw, world[1].xyz), dot(vw, world[2].xyz));
          vec2 n2 = aSide.xy; float sinE = max(abs(vd.y), .03); float face = abs(dot(normalize(vd.xz + 1e-5), n2));
          float need = 1.3 * dist * afPix * mix(1., 1. / sinE, face); float w = aInfo.y; float we = max(w, need);
          positionUpdated.xz += n2 * aSide.z * (we - w) * .5; vCol.a *= min(1., w / we * 1.7); vInfo.y = we; vInfo.w = we > w * 1.05 ? 1. : 0.; }`,
      CUSTOM_VERTEX_MAIN_END: `vPlan = positionUpdated.xz - vec2(${f(PU)}, ${f(PV)});`,
    };
    return this._code || (this._code = {
      CUSTOM_FRAGMENT_DEFINITIONS: `varying vec4 vCol; varying vec4 vInfo; varying vec2 vPlan; uniform sampler2D afAtlas; float afR = .7;\n${glNoise(this.low)}\n${WET_GLSL}`,
      CUSTOM_FRAGMENT_UPDATE_ALPHA: `{
        vec2 p = vPlan, pl = p - afOrg; float fw = max(length(fwidth(p)), 1e-4);
        vec3 col = vCol.rgb; float a = vCol.a; float edge = (vnA(pl * 28., fw * 28.) - .5) * .012;
        if (vInfo.z > .5) { vec4 t = texture2D(afAtlas, vInfo.xy); col = pow(t.rgb, vec3(2.2)); a *= t.a; }
        else if (vInfo.w < .5) { float ed = min(vInfo.x, 1. - vInfo.x) * vInfo.y; a *= smoothstep(0., .01 + fw * .8, ed + edge); }
        // painted on asphalt: its grain shows through, worn, chipped, dirty, rubbered
        float g = grain(pl, fw); col *= .9 + g * 1.1;
        float wear = fbm(p * .33 + 40.); a *= mix(1., smoothstep(.14, .36, wear), .6);
        a *= mix(1., smoothstep(.12, .32, vnA(pl * 7., fw * 7.)), .45);
        col = mix(col, col * vec3(.72, .68, .6), dirt(p) * .45);
        float ru = rubber(p); col = mix(col, vec3(.03), ru * .88); a *= 1. - ru * .25;
        afR = .62 + ru * .2; { float wH = 0.; float yy = abs(p.y - ${f(R.y)}); float rw = (1. - smoothstep(${f(R.w / 2 - 0.4)}, ${f(R.w / 2 + 0.4)}, yy)) * step(${f(R.x0)}, p.x) * step(p.x, ${f(R.x1)}); wetIt(p, 1., rw, rw * (.07 * exp(-pow((yy - 4.4) / 2.4, 2.)) + .03 * exp(-pow(yy / 1.6, 2.))), col, afR, wH); snowIt(p, 1., rw, rw * smoothstep(${f(R.w / 2 - 9)}, ${f(R.w / 2 - 1)}, yy), rw * (exp(-pow((yy - 4.4) / 1.6, 2.)) + .6 * exp(-pow(yy / 1.2, 2.))), col, afR, wH); wtGl *= 1.35; } surfaceAlbedo = col; alpha = clamp(a, 0., 1.); }`,
      '!float roughness=reflectivityOut\\.roughness;': 'float roughness=clamp(afR,.015,1.);',
      CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR: WET_FINAL,
    });
  }
}

// ---------- recording the sheets' drawing as geometry ----------
class Rec {
  constructor() { this.ops = []; this.m = [1, 0, 0, 1, 0, 0]; this.st = []; this.path = []; this.cur = null; this.clipP = null; this.lineWidth = 1; this.strokeStyle = '#000'; this.fillStyle = '#000'; this.dash = []; this.font = '10px Arial'; this.textAlign = 'left'; this.textBaseline = 'alphabetic'; this.__rec = true; this.lineCap = 'butt'; this.lineJoin = 'round'; this.globalAlpha = 1; this._mc = document.createElement('canvas').getContext('2d'); }
  tp(x, y) { const m = this.m; return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; }
  save() { this.st.push([this.m.slice(), this.clipP, this.fillStyle, this.strokeStyle, this.lineWidth, this.dash, this.font, this.textAlign]); }
  restore() { const a = this.st.pop(); if (a) [this.m, this.clipP, this.fillStyle, this.strokeStyle, this.lineWidth, this.dash, this.font, this.textAlign] = a; }
  translate(x, y) { const m = this.m; m[4] += m[0] * x + m[2] * y; m[5] += m[1] * x + m[3] * y; }
  rotate(a) { const m = this.m, c = Math.cos(a), s = Math.sin(a), a0 = m[0], b0 = m[1], c0 = m[2], d0 = m[3]; m[0] = a0 * c + c0 * s; m[1] = b0 * c + d0 * s; m[2] = -a0 * s + c0 * c; m[3] = -b0 * s + d0 * c; }
  scale(sx, sy) { const m = this.m; m[0] *= sx; m[1] *= sx; m[2] *= sy; m[3] *= sy; }
  beginPath() { this.path = []; this.cur = null; }
  moveTo(x, y) { this.cur = [this.tp(x, y)]; this.path.push(this.cur); }
  lineTo(x, y) { if (!this.cur) return this.moveTo(x, y); this.cur.push(this.tp(x, y)); }
  closePath() { if (this.cur) this.cur.closed = true; }
  arc(cx, cy, r, a0, a1, ccw) { let d = a1 - a0; if (!ccw && d < 0) d += Math.PI * 2; if (ccw && d > 0) d -= Math.PI * 2; if (Math.abs(a1 - a0) >= 6.28) d = Math.PI * 2; const n = Math.max(12, Math.ceil(Math.abs(d) * 16)); for (let i = 0; i <= n; i++) { const a = a0 + d * i / n; this.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } }
  ellipse(cx, cy, rx, ry, rot, a0, a1) { const n = 64; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; this.lineTo(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry); } }
  rect(x, y, w, h) { this.moveTo(x, y); this.lineTo(x + w, y); this.lineTo(x + w, y + h); this.lineTo(x, y + h); this.closePath(); }
  roundRect(x, y, w, h) { this.rect(x, y, w, h); }
  setLineDash(d) { this.dash = d || []; }
  fillRect(x, y, w, h) { this.beginPath(); this.rect(x, y, w, h); this.fill(); this.beginPath(); }
  strokeRect(x, y, w, h) { this.beginPath(); this.rect(x, y, w, h); this.stroke(); this.beginPath(); }
  stroke() { for (const p of this.path) if (p.length > 1) this.ops.push({ k: 'S', pts: p.closed ? p.concat([p[0]]) : p.slice(), w: this.lineWidth * Math.hypot(this.m[0], this.m[1]), col: this.strokeStyle, dash: this.dash.slice(), clip: this.clipP }); }
  fill() { for (const p of this.path) if (p.length > 2) this.ops.push({ k: 'F', pts: p.slice(), col: this.fillStyle, clip: this.clipP }); }
  clip() { this.clipP = this.path[0] ? this.path[0].slice() : null; }
  measureText(t) { this._mc.font = this.font; return this._mc.measureText(t); }
  fillText(t, x, y) { this.ops.push({ k: 'T', t: String(t), x, y, m: this.m.slice(), font: this.font, align: this.textAlign, col: this.fillStyle }); }
  strokeText() { } createLinearGradient() { return { addColorStop() { } }; } setTransform() { } fillStyleSet() { }
}
const parseCol = (c) => { if (typeof c !== 'string') return null; if (c[0] === '#') { const n = c.length === 4 ? c.slice(1).split('').map(h => h + h).join('') : c.slice(1, 7); return [parseInt(n.slice(0, 2), 16) / 255, parseInt(n.slice(2, 4), 16) / 255, parseInt(n.slice(4, 6), 16) / 255, 1]; }
  const m = /rgba?\(([^)]+)\)/.exec(c); if (!m) return null; const v = m[1].split(',').map(Number); return [v[0] / 255, v[1] / 255, v[2] / 255, v.length > 3 ? v[3] : 1]; };
const inPoly = (pt, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) c = !c; } return c; };
/** Triangles of a simple polygon (ear clipping): indices into pts. */
const triangulate = (pts) => {
  const n = pts.length, idx = []; if (n < 3) return idx; let area = 0; for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
  const V = []; for (let i = 0; i < n; i++) V.push(area > 0 ? i : n - 1 - i);
  const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  let guard = 0;
  while (V.length > 3 && guard++ < n * n) {
    let cut = false;
    for (let i = 0; i < V.length; i++) { const i0 = V[(i + V.length - 1) % V.length], i1 = V[i], i2 = V[(i + 1) % V.length], a = pts[i0], b = pts[i1], c = pts[i2];
      if (cross(a, b, c) <= 1e-12) continue; let inside = false;
      for (const j of V) { if (j === i0 || j === i1 || j === i2) continue; const p = pts[j]; if (cross(a, b, p) >= 0 && cross(b, c, p) >= 0 && cross(c, a, p) >= 0) { inside = true; break; } }
      if (inside) continue; idx.push(i0, i1, i2); V.splice(i, 1); cut = true; break; }
    if (!cut) break;
  }
  if (V.length === 3) idx.push(V[0], V[1], V[2]);
  return idx;
};

// ---------- the pavement mask, drawn with the sheets' own field drawing (R asphalt, G concrete, B shoulders) ----------
function makeMask(sc, mpx) {
  const W = Math.ceil((M1[0] - M0[0]) / mpx), H = Math.ceil((M1[1] - M0[1]) / mpx), s = 1 / mpx, P = (x, y) => [(x - M0[0]) * s, (M1[1] - y) * s];
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d', { willReadFrequently: true }); x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
  field(x, P, s, { pal: { '#3A3F46': '#FF0000', RWY: '#FF0000', STOP: '#FF0000', TAP: '#FF0000', '#6B6F73': '#00FF00', '#4E545C': '#0000FF' }, maskOnly: true });
  const d = x.getImageData(0, 0, W, H).data; for (let i = 3; i < d.length; i += 4) d[i] = 255;
  const t = RawTexture.CreateRGBATexture(new Uint8Array(d.buffer, d.byteOffset, d.byteLength), W, H, sc, false, false, Texture.BILINEAR_SAMPLINGMODE);
  t.wrapU = t.wrapV = Texture.CLAMP_ADDRESSMODE; t.name = 'afMask'; c.width = c.height = 1;
  return t;
}

// ---------- the markings: the sheets' drawing recorded at full scale, turned into one mesh ----------
function makeMarks(sc, parent, low) {
  const s = 20, rec = new Rec(), P = (x, y) => [x * s, -y * s];
  field(rec, P, s, { marks: true, planes: false });
  const toM = (p) => [p[0] / s, -p[1] / s];
  // black contrast borders under the thin yellow and red lines on the cargo apron's light concrete
  const onConc = (p) => (p[0] > 176 && p[0] < 644 && p[1] > Y.KY - 26 && p[1] < AF.cargoBuilding.y0);
  const extra = []; for (const op of rec.ops) if (op.k === 'S' && (op.col === '#FFD34D' || op.col === '#FF4A3D') && op.w / s <= 0.35) { const mid = toM(op.pts[Math.floor(op.pts.length / 2)]); if (onConc(mid)) extra.push(Object.assign({}, op, { col: '#101010', w: op.w + 0.2 * s })); }
  rec.ops = extra.concat(rec.ops);
  // the texts: packed into one atlas first
  const AW = low ? 1024 : 2048, FS = low ? 80 : 160, texts = rec.ops.filter(o => o.k === 'T'); const ac = document.createElement('canvas'); ac.width = AW; ac.height = 64; const ax0 = ac.getContext('2d');
  let cx = 0, cy = 0, rowH = 0; const CH = Math.round(FS * 1.25);
  for (const op of texts) { ax0.font = op.font.replace(/(\d+(?:\.\d+)?)px/, FS + 'px'); const tw = ax0.measureText(op.t).width, cw = Math.ceil(tw + FS * 0.15);
    if (cx + cw > AW) { cx = 0; cy += rowH; rowH = 0; } op.box = [cx, cy, cw, CH, tw]; rowH = Math.max(rowH, CH); cx += cw; }
  let AH = 64; while (AH < cy + rowH) AH *= 2; ac.height = AH; const ax = ac.getContext('2d'); ax.clearRect(0, 0, AW, AH);
  for (const op of texts) { const [bx, by] = op.box; ax.font = op.font.replace(/(\d+(?:\.\d+)?)px/, FS + 'px'); ax.fillStyle = op.col; ax.textAlign = 'left'; ax.textBaseline = 'alphabetic'; ax.fillText(op.t, bx + FS * 0.075, by + FS); }
  const pos = [], col = [], info = [], side = [], idx = []; let vi = 0; const H0 = 0.03; let SN = null;
  const pushV = (q, cl, inf, sd) => { pos.push(q[0] + PU, H0, q[1] + PV); col.push(cl[0], cl[1], cl[2], cl[3]); info.push(inf[0], inf[1], inf[2], inf[3]); side.push(sd[0], sd[1], sd[2]); };
  const pushQuad = (a, b, c, d, cl, ia, ib, ic, id) => { [a, b, c, d].forEach((q, k) => pushV(q, cl, [ia, ib, ic, id][k], SN ? [SN[0], SN[1], k < 2 ? 1 : -1] : [0, 0, 0])); idx.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3); vi += 4; };
  for (const op of rec.ops) {
    const cl = parseCol(op.col); if (!cl || cl[3] < 0.5) continue;
    const clipM = op.clip ? op.clip.map(toM) : null;
    if (op.k === 'F') { const pts = op.pts.map(toM); if (pts.length === 4 || (pts.length === 5 && Math.hypot(pts[4][0] - pts[0][0], pts[4][1] - pts[0][1]) < 1e-6)) { const q = pts.slice(0, 4), z = [0.5, 99, 0, 0]; pushQuad(q[0], q[1], q[2], q[3], cl, z, z, z, z); continue; }
      const tri = triangulate(pts); const base = vi; for (const p of pts) { pushV(p, cl, [0.5, 99, 0, 0], [0, 0, 0]); vi++; } for (let k = 0; k < tri.length; k += 3) idx.push(base + tri[k], base + tri[k + 1], base + tri[k + 2]); continue; }
    if (op.k === 'S') { const pts = op.pts.map(toM); const w = op.w / s; if (w < 0.02) continue;
      // dashes
      const segs = []; if (op.dash && op.dash.length) { const dl = op.dash.map(d => d / s); let on = true, left = dl[0], di = 0, cur = [pts[0]]; for (let i = 1; i < pts.length; i++) { let a = pts[i - 1]; const b = pts[i]; let L = Math.hypot(b[0] - a[0], b[1] - a[1]); while (L > 1e-6) { const st = Math.min(L, left), fr = st / L, m = [a[0] + (b[0] - a[0]) * fr, a[1] + (b[1] - a[1]) * fr]; if (on) cur.push(m); L -= st; left -= st; a = m; if (left <= 1e-6) { if (on && cur.length > 1) segs.push(cur); on = !on; di = (di + 1) % dl.length; left = dl[di]; cur = [m]; } } } if (on && cur.length > 1) segs.push(cur); } else segs.push(pts);
      for (const sg of segs) for (let i = 1; i < sg.length; i++) { const a = sg[i - 1], b = sg[i]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1e-4) continue;
        if (clipM) { const n = Math.ceil(L / 0.25); for (let k = 0; k < n; k++) { const p0 = [a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n], p1 = [a[0] + (b[0] - a[0]) * (k + 1) / n, a[1] + (b[1] - a[1]) * (k + 1) / n]; if (!inPoly([(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2], clipM)) continue; const ux = (p1[0] - p0[0]) / (L / n), uy = (p1[1] - p0[1]) / (L / n), nx = -uy * w / 2, ny = ux * w / 2; SN = [-uy, ux]; pushQuad([p0[0] + nx, p0[1] + ny], [p1[0] + nx, p1[1] + ny], [p1[0] - nx, p1[1] - ny], [p0[0] - nx, p0[1] - ny], cl, [0, w, 0, 0], [0, w, 0, 0], [1, w, 0, 0], [1, w, 0, 0]); } SN = null; continue; }
        const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L, nx = -uy * w / 2, ny = ux * w / 2, ext = Math.min(w * 0.5, 0.08); SN = [-uy, ux]; const a2 = [a[0] - ux * ext, a[1] - uy * ext], b2 = [b[0] + ux * ext, b[1] + uy * ext];
        pushQuad([a2[0] + nx, a2[1] + ny], [b2[0] + nx, b2[1] + ny], [b2[0] - nx, b2[1] - ny], [a2[0] - nx, a2[1] - ny], cl, [0, w, 0, 0], [0, w, 0, 0], [1, w, 0, 0], [1, w, 0, 0]); SN = null; }
      continue; }
    if (op.k === 'T') { const fsm = /(\d+(?:\.\d+)?)px/.exec(op.font), fs = fsm ? parseFloat(fsm[1]) : 10, ss = FS / fs; const [bx, by, cw, ch, tw] = op.box;
      const u0 = bx / AW, v0 = 1 - by / AH, u1 = (bx + cw) / AW, v1 = 1 - (by + ch) / AH;
      const wpx = cw / ss, hpx = ch / ss, ox = op.align === 'center' ? -tw / ss / 2 : op.align === 'right' ? -tw / ss : 0; const lx0 = op.x + ox - FS * 0.075 / ss, ly0 = op.y - FS / ss;
      const m = op.m, tp = (xx, yy) => toM([m[0] * xx + m[2] * yy + m[4], m[1] * xx + m[3] * yy + m[5]]);
      pushQuad(tp(lx0, ly0), tp(lx0 + wpx, ly0), tp(lx0 + wpx, ly0 + hpx), tp(lx0, ly0 + hpx), [1, 1, 1, 1], [u0, v0, 1, 0], [u1, v0, 1, 0], [u1, v1, 1, 0], [u0, v1, 1, 0]); }
  }
  const mesh = new Mesh('AIRFIELD/MARKINGS', sc); mesh.parent = parent;
  const vd = new VertexData(); vd.positions = pos; vd.indices = idx; const nr = new Float32Array(pos.length); for (let i = 1; i < nr.length; i += 3) nr[i] = 1; vd.normals = nr; vd.applyToMesh(mesh, false);
  mesh.setVerticesData('aCol', new Float32Array(col), false, 4); mesh.setVerticesData('aInfo', new Float32Array(info), false, 4); mesh.setVerticesData('aSide', new Float32Array(side), false, 3);
  const atlas = new DynamicTexture('afAtlas', ac, sc, true); atlas.hasAlpha = true; atlas.update(true); atlas.anisotropicFilteringLevel = 8; atlas.wrapU = atlas.wrapV = Texture.CLAMP_ADDRESSMODE;
  const mat = new PBRMaterial('AIRFIELD/PAINT', sc); mat.albedoColor = Color3.White(); mat.metallic = 0; mat.roughness = 0.7; mat.environmentIntensity = 0.4;
  mat.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND; mat.alpha = 0.999; mat.disableDepthWrite = true; mat.backFaceCulling = false; mat.zOffset = -4; mat.zOffsetUnits = -4;
  mat.useRadianceOverAlpha = false; mat.useSpecularOverAlpha = false;
  mat._afPlugin = new AirfieldPaintPlugin(mat, atlas, low);
  mesh.material = mat; mesh.receiveShadows = true; mesh.isPickable = false; mesh.alphaIndex = 1; mesh.metadata = { id: 'AIRFIELD/MARKINGS', kind: 'markings' };
  return { mesh, mat, atlas };
}

// ---------- the signs: one mesh, their faces from one atlas ----------
function makeSigns(sc, parent, low) {
  const k = low ? 0.5 : 1, fs = Math.round(120 * k), hpx = Math.round(230 * k), AW = low ? 2048 : 4096;
  const c0 = document.createElement('canvas').getContext('2d'); c0.font = `800 ${fs}px Arial`;
  const items = []; let cx = 0, cy = 0;
  for (const g of AF.signs) { const ws = g.panels.map(([kk, t]) => c0.measureText(t).width + fs * 0.9), w = ws.reduce((a, b) => a + b, 0);
    if (cx + w + 8 > AW) { cx = 0; cy += hpx + 8; } items.push({ g, ws, w, x: cx, y: cy }); cx += w + 8; }
  let AH = 64; while (AH < cy + hpx + 40) AH *= 2;
  const c = document.createElement('canvas'); c.width = AW; c.height = AH; const ax = c.getContext('2d'); ax.fillStyle = '#6E7378'; ax.fillRect(0, 0, AW, AH);
  for (const it of items) { let xx = it.x; it.g.panels.forEach(([kk, t], i) => { const [bg, fg] = kk === 'man' ? ['#C8231C', '#FFFFFF'] : kk === 'dir' ? ['#F2C230', '#111111'] : ['#111111', '#F2C230'];
      ax.fillStyle = bg; ax.fillRect(xx, it.y, it.ws[i], hpx); if (kk === 'loc') { ax.strokeStyle = '#F2C230'; ax.lineWidth = 10 * k; ax.strokeRect(xx + 10 * k, it.y + 10 * k, it.ws[i] - 20 * k, hpx - 20 * k); }
      ax.fillStyle = fg; ax.font = `800 ${fs}px Arial`; ax.textAlign = 'center'; ax.fillText(t, xx + it.ws[i] / 2, it.y + hpx / 2 + fs * 0.36); xx += it.ws[i]; }); }
  const pos = [], nor = [], uv = [], idx = []; let vi = 0;
  const grey = [[2 / AW, 1 - 2 / AH], [30 / AW, 1 - 2 / AH], [30 / AW, 1 - 30 / AH], [2 / AW, 1 - 30 / AH]];
  const quad = (pts, n, uvs) => { for (let i = 0; i < 4; i++) { pos.push(pts[i][0] + PU, pts[i][2], pts[i][1] + PV); nor.push(n[0], n[2], n[1]); uv.push(uvs[i][0], uvs[i][1]); } idx.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3); vi += 4; };
  // a box on the plan: centre c [x, y, h], r its right (plan), n its face normal (plan), half sizes a (along r), b (up), d (along n)
  const box = (c, r, n, a, b, d, front) => { const P = (i, j, l) => [c[0] + r[0] * a * i + n[0] * d * l, c[1] + r[1] * a * i + n[1] * d * l, c[2] + b * j];
    quad([P(-1, -1, 1), P(1, -1, 1), P(1, 1, 1), P(-1, 1, 1)], [n[0], n[1], 0], front || grey); quad([P(1, -1, -1), P(-1, -1, -1), P(-1, 1, -1), P(1, 1, -1)], [-n[0], -n[1], 0], grey);
    quad([P(-1, 1, 1), P(1, 1, 1), P(1, 1, -1), P(-1, 1, -1)], [0, 0, 1], grey); quad([P(1, -1, 1), P(1, 1, 1), P(1, 1, -1), P(1, -1, -1)], [r[0], r[1], 0], grey); quad([P(-1, -1, -1), P(-1, 1, -1), P(-1, 1, 1), P(-1, -1, 1)], [-r[0], -r[1], 0], grey); };
  for (const it of items) { const g = it.g;
    // facing the aircraft that read it; its right as they see it
    const n = g.face === 'east' ? [-1, 0] : g.face === 'west' ? [1, 0] : g.face === 'north' ? [0, -1] : g.face === 'south' ? [0, 1] : [0, -g.face], r = [-n[1], n[0]];
    const Wm = it.w / hpx * 1.2, Hm = 1.2, u0 = it.x / AW, u1 = (it.x + it.w) / AW, vT = 1 - it.y / AH, vB = 1 - (it.y + hpx) / AH;
    box([g.x, g.y, 1.25], r, n, Wm / 2, Hm / 2, 0.12, [[u0, vB], [u1, vB], [u1, vT], [u0, vT]]);
    for (const sx of [-0.35, 0.35]) box([g.x + r[0] * sx * Wm, g.y + r[1] * sx * Wm, 0.32], r, n, 0.05, 0.32, 0.05); }
  const mesh = new Mesh('AIRFIELD/SIGNS', sc); mesh.parent = parent; const vd = new VertexData(); vd.positions = pos; vd.normals = nor; vd.uvs = uv; vd.indices = idx; vd.applyToMesh(mesh, false);
  const t = new DynamicTexture('afSigns', c, sc, true); t.update(true); t.anisotropicFilteringLevel = 8; t.wrapU = t.wrapV = Texture.CLAMP_ADDRESSMODE;
  const m = new StandardMaterial('AIRFIELD/SIGNS', sc); m.diffuseTexture = t; m.emissiveColor = new Color3(0.16, 0.16, 0.16); m.specularColor = new Color3(0.08, 0.08, 0.08); m.backFaceCulling = false;
  mesh.material = m; mesh.isPickable = false; mesh.receiveShadows = true; mesh.metadata = { id: 'AIRFIELD/SIGNS', kind: 'signs' };
  return { mesh, mat: m, tex: t };
}

// ---------- the lights: posts and lenses as thin instances ----------
function lightPoints() {
  const L = [];
  for (const t of AF.taxiways) { if (t.kind === 'taxilane') continue; const [a, b] = t.pts, hz = a[1] === b[1], len = Math.hypot(b[0] - a[0], b[1] - a[1]); for (let d = 0; d < len; d += 30) for (const sg of [-1, 1]) { const q = [a[0] + (b[0] - a[0]) * d / len, a[1] + (b[1] - a[1]) * d / len]; if (Math.abs(q[1] - R.y) < 50) continue; L.push(hz ? [q[0], q[1] + sg * 14.2, '#2D6BFF'] : [q[0] + sg * 14.2, q[1], '#2D6BFF']); } }
  for (const k of AF.corners) for (let i = 0; i <= 8; i++) { const cx = k.x + k.sx * k.r, cyy = k.y + k.oy * k.r, a1 = Math.atan2(-k.oy, 0); let a2 = Math.atan2(0, -k.sx); if (a2 - a1 > Math.PI) a2 -= 2 * Math.PI; if (a2 - a1 < -Math.PI) a2 += 2 * Math.PI; const a = a1 + (a2 - a1) * i / 8; for (const rr of [k.r - 14.2, k.r + 14.2]) L.push([cx + Math.cos(a) * rr, cyy + Math.sin(a) * rr, '#2D6BFF']); }
  for (let xx = R.x0; xx <= R.x1; xx += 60) for (const sg of [-1, 1]) L.push([xx, R.y + sg * 31.5, (xx > R.x1 - 600 || xx < R.x0 + 600) ? '#FFD27A' : '#FFFFFF']);
  for (const e of R.ends) { const xt = e.x + e.dir * e.disp; for (let yy = -27; yy <= 27; yy += 3) L.push([xt - e.dir * 0.5, R.y + yy, '#3CFF7A']); for (let yy = -27; yy <= 27; yy += 4.5) L.push([e.x - e.dir * 0.4, R.y + yy, '#FF3030']); }
  return L;
}
function makeLights(sc, parent) {
  const pts = lightPoints(), lenses = [], made = [];
  const inst = (mesh, list, h, rot) => { const buf = new Float32Array(list.length * 16); list.forEach((p, i) => { const v = planToLocal(p[0], p[1], h); (rot ? rot.multiply(Matrix.Translation(v.x, v.y, v.z)) : Matrix.Translation(v.x, v.y, v.z)).copyToArray(buf, i * 16); }); mesh.thinInstanceSetBuffer('matrix', buf, 16, true); };
  const post = MeshBuilder.CreateCylinder('AIRFIELD/LIGHT-POSTS', { diameterTop: 0.12, diameterBottom: 0.16, height: 0.36, tessellation: 8 }, sc); post.parent = parent;
  const pm = new PBRMaterial('AIRFIELD/LIGHT-POST', sc); pm.albedoColor = Color3.FromHexString('#8A8F95'); pm.metallic = 0.6; pm.roughness = 0.4; post.material = pm; made.push(pm); inst(post, pts, 0.18);
  const byC = {}; pts.forEach(p => (byC[p[2]] = byC[p[2]] || []).push(p));
  for (const col of Object.keys(byC)) { const lens = MeshBuilder.CreateCylinder('AIRFIELD/LIGHTS ' + col, { diameterTop: 0.22, diameterBottom: 0.18, height: 0.12, tessellation: 10 }, sc); lens.parent = parent;
    const lm = new StandardMaterial('AIRFIELD/LENS ' + col, sc); lm.emissiveColor = Color3.FromHexString(col).scale(1.6); lm.diffuseColor = Color3.Black(); lm.specularColor = Color3.Black(); lm.disableLighting = true; lens.material = lm; made.push(lm);
    inst(lens, byC[col], 0.42); lenses.push(lens); }
  // inset centre line lights along the runway
  const inset = []; for (let xx = R.x0 + 15; xx < R.x1; xx += 15) inset.push([xx, R.y + 0.3]);
  const ins = MeshBuilder.CreateCylinder('AIRFIELD/CENTRE-LIGHTS', { diameterTop: 0.34, diameterBottom: 0.4, height: 0.03, tessellation: 12 }, sc); ins.parent = parent;
  const im = new PBRMaterial('AIRFIELD/CENTRE-LIGHT', sc); im.albedoColor = Color3.FromHexString('#9AA0A6'); im.metallic = 0.8; im.roughness = 0.3; ins.material = im; made.push(im); inst(ins, inset, 0.045);
  // runway guard lights at every holding position: two yellow lamps flashing in turn
  const units = []; for (const h of AF.holds) for (const [gx, gy] of h.guard) units.push([gx, gy, h.side]);
  const gpost = MeshBuilder.CreateCylinder('AIRFIELD/GUARD-POSTS', { diameterTop: 0.12, diameterBottom: 0.16, height: 0.5, tessellation: 8 }, sc); gpost.parent = parent; gpost.material = pm; inst(gpost, units, 0.25);
  const hous = MeshBuilder.CreateBox('AIRFIELD/GUARD-LIGHTS', { width: 0.9, height: 0.42, depth: 0.34 }, sc); hous.parent = parent;
  const hm = new PBRMaterial('AIRFIELD/GUARD-HOUSING', sc); hm.albedoColor = Color3.FromHexString('#E2B21E'); hm.metallic = 0; hm.roughness = 0.5; hous.material = hm; made.push(hm); inst(hous, units, 0.7);
  const wig = [];
  for (const lx of [-0.22, 0.22]) { const l = MeshBuilder.CreateCylinder('AIRFIELD/GUARD-LAMPS', { diameter: 0.3, height: 0.06, tessellation: 16 }, sc); l.parent = parent;
    const m = new StandardMaterial('AIRFIELD/GUARD-LAMP', sc); m.diffuseColor = Color3.Black(); m.specularColor = new Color3(0.3, 0.3, 0.3); m.emissiveColor = Color3.FromHexString('#FFB800').scale(2.2); m.disableLighting = true; l.material = m; made.push(m);
    const buf = new Float32Array(units.length * 16); units.forEach((u, i) => { const v = planToLocal(u[0] + lx, u[1] + u[2] * 0.19, 0.7); Matrix.RotationX(Math.PI / 2).multiply(Matrix.Translation(v.x, v.y, v.z)).copyToArray(buf, i * 16); }); l.thinInstanceSetBuffer('matrix', buf, 16, true);
    wig.push(m); lenses.push(l); }
  const all = [post, ins, gpost, hous].concat(lenses);
  for (const m of all) { m.isPickable = false; m.alwaysSelectAsActiveMesh = true; }
  return { lenses, all, made, wig, casters: [hous, gpost] };
}

// ---------- buildings: the cargo terminal; in the 3D viewer also the terminal's massing ----------
function makeBuildings(sc, parent, massing) {
  const made = [], meshes = [];
  const pbr = (hex, rough, metal, alpha) => { const m = new PBRMaterial('AIRFIELD/BUILDING', sc); m.albedoColor = Color3.FromHexString(hex); m.roughness = rough; m.metallic = metal; if (alpha) { m.alpha = alpha; m.backFaceCulling = false; } made.push(m); return m; };
  const bx = (id, x0, y0, z0, x1, y1, z1, m) => { const b = MeshBuilder.CreateBox(id, { width: x1 - x0, height: z1 - z0, depth: y1 - y0 }, sc); const c = planToLocal((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); b.position.copyFrom(c); b.material = m; b.parent = parent; b.receiveShadows = true; b.isPickable = false; b.metadata = { id, kind: 'building' }; meshes.push(b); return b; };
  const cb = AF.cargoBuilding, steel = pbr('#8E969E', 0.45, 0.5), door = pbr('#3A4048', 0.4, 0.6);
  bx(cb.id, cb.x0, cb.y0, 0, cb.x1, cb.y1, 18, steel); let n = 0; for (let xx = cb.x0 + 15; xx < cb.x1 - 10; xx += 30) bx(cb.id + '/DOOR-' + String(++n).padStart(2, '0'), xx, cb.y0 - 0.25, 0, xx + 12, cb.y0 + 0.1, 9, door);
  if (massing) {
    const wall = pbr('#A9B2BC', 0.45, 0.3), glass = pbr('#5E7E96', 0.08, 0.4), white = pbr('#F2F3F5', 0.3, 0);
    for (const [id, b, h, m] of [['TERMINAL/HALL', [36, 0, 114, 30], 18, glass], ['TERMINAL/MUSEUM', [0, 0, 36, 30], 14, wall], ['TERMINAL/OFFICES', [114, 0, 156, 30], 12, wall], ['TERMINAL/LANDSIDE', [0, 30, 156, 52], 12, wall],
      ['TERMINAL/PIER', [TL.pier[0], 52, TL.pier[1], TL.PN], 12, glass], ['RENTAL/HALL', TL.rental.hall, 7.5, glass], ['RENTAL/GARAGE', TL.rental.garage, TL.rental.garageH, wall], ['RENTAL/WALK', TL.rental.walk, 4.2, glass]]) bx(id, b[0], b[1], 0, b[2], b[3], h, m);
    bx('TERMINAL/ROOF', 24, -14, 18, 126, 36, 19.2, white);
  }
  return { made, meshes };
}

// ---------- the fence on the boundary ----------
function makeFence(sc, parent, heightAt) {
  const b = AF.boundary, pos = [], idx = []; let vi = 0;
  for (const [x0, y0, x1, y1] of [[b.x0, b.y0, b.x1, b.y0], [b.x1, b.y0, b.x1, b.y1], [b.x1, b.y1, b.x0, b.y1], [b.x0, b.y1, b.x0, b.y0]]) {
    const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(L / 40));
    for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n, v = planToLocal(x, y), h = heightAt ? (heightAt(v.x, v.z) || 0) : 0; pos.push(v.x, h, v.z, v.x, h + 2.6, v.z); if (i) idx.push(vi - 2, vi, vi + 1, vi - 2, vi + 1, vi - 1); vi += 2; }
  }
  const m = new Mesh('AIRFIELD/FENCE', sc); m.parent = parent; const vd = new VertexData(), nr = []; vd.positions = pos; vd.indices = idx; VertexData.ComputeNormals(pos, idx, nr); vd.normals = nr; vd.applyToMesh(m);
  const fm = new PBRMaterial('AIRFIELD/FENCE', sc); fm.albedoColor = Color3.FromHexString('#9EA4A8'); fm.metallic = 0.5; fm.roughness = 0.5; fm.alpha = 0.5; fm.backFaceCulling = false; m.material = fm; m.isPickable = false; m.metadata = { id: 'AIRFIELD/FENCE', kind: 'fence' };
  return { mesh: m, mat: fm };
}

// ---------- the ground: one mesh over the whole airport (the boundary), on the levelled ground ----------
function makeGround(sc, parent, mask, low, heightAt) {
  const b = AF.boundary, st = heightAt ? 20 : 400, nx = Math.ceil((b.x1 - b.x0) / st), ny = Math.ceil((b.y1 - b.y0) / st), pos = [], idx = [];
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) { const x = b.x0 + (b.x1 - b.x0) * i / nx, y = b.y0 + (b.y1 - b.y0) * j / ny, v = planToLocal(x, y); const h = heightAt ? (heightAt(v.x, v.z) || 0) : 0; pos.push(v.x, h, v.z); }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, c = a + nx + 1; idx.push(a, a + 1, c, a + 1, c + 1, c); }
  const m = new Mesh('AIRFIELD/GROUND', sc); m.parent = parent; const vd = new VertexData(), nr = []; vd.positions = pos; vd.indices = idx; VertexData.ComputeNormals(pos, idx, nr); vd.normals = nr; vd.applyToMesh(m);
  const mat = new PBRMaterial('AIRFIELD/GROUND', sc); mat.albedoColor = Color3.White(); mat.metallic = 0; mat.roughness = 0.9; mat.environmentIntensity = 0.5;
  mat._afPlugin = new AirfieldGroundPlugin(mat, mask, low);
  m.material = mat; m.receiveShadows = true; m.isPickable = false; m.metadata = { id: 'AIRFIELD/GROUND', kind: 'ground' };
  return { mesh: m, mat };
}

/** The whole airfield, in a frame node under parent whose local x is u (along the runway) and z is v (to its left),
 *  the plan's origin at (planU, planV). opts: low (phones), heightAt(u, v) the levelled ground's height there (m, from
 *  the frame; none: flat), massing (the terminal as plain blocks, for the 3D viewer), fence. */
export function buildAirfield(sc, parent, opts: any = {}) {
  const low = !!opts.low, frame = new TransformNode('AIRFIELD', sc); frame.parent = parent || null; frame.metadata = { id: 'AIRFIELD', kind: 'airfield', icao: AF.airport.icao };
  let mpx = low ? 1.4 : 0.8; try { const max = sc.getEngine().getCaps().maxTextureSize || 4096; mpx = Math.max(mpx, (M1[0] - M0[0]) / max); } catch (e) { /* the default */ }
  const mask = makeMask(sc, mpx);
  const ground = makeGround(sc, frame, mask, low, opts.heightAt);
  const marks = makeMarks(sc, frame, low), signs = makeSigns(sc, frame, low), lights = makeLights(sc, frame), bld = makeBuildings(sc, frame, !!opts.massing);
  const fence = opts.fence === false ? null : makeFence(sc, frame, opts.heightAt);
  const meshes = frame.getChildMeshes(false); for (const m of meshes) m.renderingGroupId = opts.group == null ? 1 : opts.group;
  const casters = [signs.mesh].concat(lights.casters, bld.meshes);
  let lastT = -1;
  return {
    frame, ground: ground.mesh, marks: marks.mesh, signs: signs.mesh, lights: lights.lenses, casters, exclude: [ground.mesh, marks.mesh, signs.mesh, fence ? fence.mesh : null].filter(Boolean), buildings: bld.meshes,
    /** The guard lights' wig-wag: about once a second each side. */
    step(t: number) { const ph = Math.floor(t * 2) % 2; if (ph === lastT) return; lastT = ph; const on = Color3.FromHexString('#FFB800').scale(2.2), off = new Color3(0.08, 0.06, 0.02); lights.wig[0].emissiveColor = ph ? on : off; lights.wig[1].emissiveColor = ph ? off : on; },
    dispose() { try { mask.dispose(); marks.atlas.dispose(); signs.tex.dispose(); } catch (e) { /* gone */ } for (const m of [ground.mat, marks.mat, signs.mat, fence && fence.mat].concat(lights.made, bld.made)) { try { if (m) m.dispose(); } catch (e) { /* gone */ } } frame.dispose(); },
  };
}

/** The views in the plan (for the site's ready-made views): where, height, and what it looks at. */
export const AIRFIELD_VIEWS = [
  { id: 'threshold', name: 'Threshold 08', at: [R.x0 + 150, R.y - 24, 11], look: [R.x0 + 330, R.y + 2, 0] },
  { id: 'hold', name: 'Holding point A1', at: [R.x0 + 20 - 3.5, R.y - 107.5 - 62, 5], look: [R.x0 + 22, R.y - 30, 0.5] },
  { id: 'tdz', name: 'Touchdown zone', at: [R.x0 + 330, R.y + 24, 7], look: [R.x0 + 900, R.y - 4, 0] },
  { id: 'exit', name: 'Middle exit A2', at: [81 - 230, Y.AY - 70, 55], look: [81 + 20, R.y - 60, 0] },
  { id: 'a380', name: 'A380 stand 9', at: [470, 260, 48], look: [170, 125, 0] },
  { id: 'cargo', name: 'Cargo apron', at: [120, Y.KY - 80, 40], look: [420, Y.KY + 90, 0] },
  { id: 'air', name: 'From the air', at: [-700, -560, 430], look: [160, 520, 0] },
  { id: 'flyby', name: 'Low fly-by', at: [2600, 300, 140], look: [0, R.y, 40] },
];
