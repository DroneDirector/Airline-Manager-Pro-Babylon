/* The sky of the 3D view: the real sun, moon (with its phase) and stars for the place and time you look at,
 * day and night with twilight in between, living water that reflects the sky, the sun and the moon, the lights
 * of airports, aircraft and towns at night. The time is the simulator's when linked, otherwise the real time. */

/* ---------- settings ---------- */
function skyOpt(k: string): boolean { return (State.settings as any)[k] !== false; }
function v3dWaterMode(): string { const v = (State.settings as any).v3dWater; return v === 'simple' || v === 'mirror' ? v : 'living'; }
/** The time the sky shows: the simulator's when linked (and switched on), otherwise now. */
/** The time the sky shows. Linked to Flight Simulator (and the setting on): the simulator's own time, which
 * keeps running from where it was if the link drops for a while; otherwise this device's clock. It never
 * flips back and forth: a change (linking, unlinking, a time jump in the simulator) is eased in over a few
 * seconds, so the sun and the light move there instead of jumping. */
const SkyClock = { off: 0, target: 0, at: 0, simAt: 0 };
function skyTime(): number {
  const now = Date.now(), L: any = typeof Link !== 'undefined' ? (Link as any).sim : null;
  if (skyOpt('v3dSimTime') && L && L.simTime && L.t && now - L.t < 20000) { SkyClock.target = L.simTime - L.t; SkyClock.simAt = now; }
  else if (!skyOpt('v3dSimTime') || now - SkyClock.simAt > 5 * 60e3) SkyClock.target = 0;   // not linked any more: back to this device's time
  const dt = SkyClock.at ? Math.min(5000, now - SkyClock.at) : 1e9; SkyClock.at = now;
  const d = SkyClock.target - SkyClock.off;
  if (Math.abs(d) < 2000 || dt >= 1e9) SkyClock.off = SkyClock.target;
  else SkyClock.off += d * Math.min(1, 1 - Math.exp(-dt / 2500));
  return now + SkyClock.off;
}

/* ---------- where the sun and the moon are ---------- */
function astroD(ms: number): number { return ms / 86400000 + 2440587.5 - 2451545.0; }   // days from J2000
function astroSun(d: number): { ra: number; dec: number } {
  const g = (357.529 + 0.98560028 * d) * D2R, q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * D2R, e = (23.439 - 0.00000036 * d) * D2R;
  return { ra: Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)) / D2R, dec: Math.asin(Math.sin(e) * Math.sin(L)) / D2R };
}
/** The moon (low precision, about a quarter of a degree): position and horizontal parallax. */
function astroMoon(d: number): { ra: number; dec: number; par: number } {
  const T = d / 36525, s = (a: number) => Math.sin(a * D2R), c = (a: number) => Math.cos(a * D2R);
  const lam = 218.32 + 481267.881 * T + 6.29 * s(135.0 + 477198.87 * T) - 1.27 * s(259.3 - 413335.36 * T) + 0.66 * s(235.7 + 890534.22 * T)
    + 0.21 * s(269.9 + 954397.74 * T) - 0.19 * s(357.5 + 35999.05 * T) - 0.11 * s(186.5 + 966404.03 * T);
  const bet = 5.13 * s(93.3 + 483202.02 * T) + 0.28 * s(228.2 + 960400.89 * T) - 0.28 * s(318.3 + 6003.15 * T) - 0.17 * s(217.6 - 407332.21 * T);
  const par = 0.9508 + 0.0518 * c(135.0 + 477198.87 * T) + 0.0095 * c(259.3 - 413335.36 * T) + 0.0078 * c(235.7 + 890534.22 * T) + 0.0028 * c(269.9 + 954397.74 * T);
  const e = (23.439 - 0.00000036 * d) * D2R, l = lam * D2R, b = bet * D2R;
  const x = Math.cos(b) * Math.cos(l), y = Math.cos(e) * Math.cos(b) * Math.sin(l) - Math.sin(e) * Math.sin(b), z = Math.sin(e) * Math.cos(b) * Math.sin(l) + Math.cos(e) * Math.sin(b);
  return { ra: Math.atan2(y, x) / D2R, dec: Math.asin(z) / D2R, par };
}
function astroLst(d: number, lon: number): number { return ((280.46061837 + 360.98564736629 * d + lon) % 360 + 360) % 360; }
/** Right ascension and declination seen from a place: altitude and azimuth (degrees, azimuth from north through east). */
function astroAltAz(ra: number, dec: number, lat: number, lst: number): { alt: number; az: number } {
  const H = (lst - ra) * D2R, f = lat * D2R, dl = dec * D2R;
  const alt = Math.asin(Math.sin(f) * Math.sin(dl) + Math.cos(f) * Math.cos(dl) * Math.cos(H));
  const az = Math.atan2(-Math.sin(H) * Math.cos(dl), Math.cos(f) * Math.sin(dl) - Math.sin(f) * Math.cos(dl) * Math.cos(H));
  return { alt: alt / D2R, az: ((az / D2R) + 360) % 360 };
}
function astroRefract(alt: number): number { return alt > -1.5 ? alt + 1.02 / Math.tan((alt + 10.3 / (alt + 5.11)) * D2R) / 60 : alt; }
/** Altitude/azimuth as a direction in the 3D view (x east, y up, z south). */
function astroVec(alt: number, az: number): number[] { const a = alt * D2R, z = az * D2R; return [Math.cos(a) * Math.sin(z), Math.sin(a), -Math.cos(a) * Math.cos(z)]; }

/* ---------- the sky's colour (the same in the sky, the fog and the water's reflections) ---------- */
const SKY_GLSL = `
uniform vec3 uSun; uniform vec3 uMoon; uniform float uSunAlt; uniform float uDay; uniform float uMoonK; uniform float uCloud;
vec3 skyCol(vec3 d) {
  float h = max(d.y, 0.0);
  vec3 zen = mix(vec3(0.006, 0.010, 0.026), vec3(0.17, 0.36, 0.74), uDay);
  vec3 hor = mix(vec3(0.022, 0.032, 0.058), vec3(0.64, 0.76, 0.90), uDay);
  // sunrise and sunset: a deep orange band towards the sun, a soft pink belt opposite, a richer violet-blue overhead
  float tw = clamp(1.0 - abs(uSunAlt + 0.02) * 4.6, 0.0, 1.0);
  vec2 dh = normalize(d.xz + 1e-5), sh = normalize(uSun.xz + 1e-5);
  float toward = pow(dot(dh, sh) * 0.5 + 0.5, 2.5), away = pow(0.5 - dot(dh, sh) * 0.5, 2.0);
  hor = mix(hor, mix(vec3(1.0, 0.40, 0.12), vec3(1.0, 0.55, 0.22), h * 3.0) * (0.3 + 0.7 * uDay), tw * (0.28 + 0.72 * toward) * 0.88);
  hor = mix(hor, vec3(0.80, 0.50, 0.62) * (0.25 + 0.75 * uDay), tw * away * 0.32 * smoothstep(-0.03, 0.04, uSunAlt));
  zen = mix(zen, zen * vec3(0.85, 0.7, 1.18), tw * 0.55);
  vec3 c = mix(hor, zen, pow(h, 0.42));
  float sd = max(dot(d, uSun), 0.0);
  c += vec3(1.0, 0.82, 0.58) * (pow(sd, 700.0) * 1.2 + pow(sd, 14.0) * 0.16 + pow(sd, 3.0) * 0.06 * tw) * smoothstep(-0.06, 0.03, uSunAlt);
  c += vec3(1.0, 0.5, 0.2) * pow(sd, 6.0) * 0.14 * tw * smoothstep(-0.08, 0.02, uSunAlt);   // the warm glow round a low sun
  c += vec3(0.55, 0.6, 0.72) * pow(max(dot(d, uMoon), 0.0), 260.0) * 0.12 * uMoonK;
  float g = dot(c, vec3(0.33));
  c = mix(c, vec3(g) * 0.82, uCloud * 0.6);
  if (d.y < 0.0) c = mix(c, hor * 0.75, clamp(-d.y * 5.0, 0.0, 1.0));
  return c;
}`;
/** The light aircraft throw on the ground (landing and taxi lights), added to what is there. */
const SPOT_GLSL = `
uniform vec3 uSpotPos[4]; uniform vec3 uSpotDir[4]; uniform vec4 uSpotK; uniform vec4 uSpotR; uniform float uLightsOn;
vec3 spotLight(vec3 wp) {
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    float k = i == 0 ? uSpotK.x : i == 1 ? uSpotK.y : i == 2 ? uSpotK.z : uSpotK.w;
    float rr = i == 0 ? uSpotR.x : i == 1 ? uSpotR.y : i == 2 ? uSpotR.z : uSpotR.w;
    if (k <= 0.0) continue;
    vec3 L = wp - uSpotPos[i]; float d = length(L);
    float cone = smoothstep(0.93, 0.985, dot(L / max(d, 0.001), uSpotDir[i]));
    float fall = 1.0 / (1.0 + (d / rr) * (d / rr) * 6.0);
    acc += vec3(1.0, 0.93, 0.8) * k * cone * fall * 2.4;
  }
  return acc * uLightsOn;
}`;
/** Plain (unlit) materials of the scene that should catch aircraft lights: the runways and the airport's paint. */
function v3dSpotHook(m: any) {
  if (m.userData.spotHook || m.userData.ground || !m.map) return;
  m.userData.spotHook = true;
  const U = v3dSkyUniforms();
  m.onBeforeCompile = (sh: any) => {
    Object.assign(sh.uniforms, { uSpotPos: U.uSpotPos, uSpotDir: U.uSpotDir, uSpotK: U.uSpotK, uSpotR: U.uSpotR, uLightsOn: U.uLightsOn });
    sh.vertexShader = 'varying vec3 vWposS;\n' + sh.vertexShader.replace('#include <fog_vertex>', 'vWposS = (modelMatrix * vec4(position, 1.0)).xyz;\n#include <fog_vertex>');
    sh.fragmentShader = 'varying vec3 vWposS;\n' + SPOT_GLSL + '\n' + sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb += (sampledDiffuseColor.rgb + vec3(0.05)) * spotLight(vWposS);');
  };
  m.customProgramCacheKey = () => 'v3d-spot';
  m.needsUpdate = true;
}
/** The same as the shader's skyCol, for the fog and the background (display values 0–1). */
function skyColJs(d: number[], u: any): number[] {
  const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);
  const h = Math.max(d[1], 0), day = u.uDay.value, sa = u.uSunAlt.value, S = u.uSun.value;
  let zen = mix([0.006, 0.010, 0.026], [0.17, 0.36, 0.74], day), hor = mix([0.022, 0.032, 0.058], [0.64, 0.76, 0.90], day);
  const tw = clamp(1 - Math.abs(sa + 0.02) * 4.6, 0, 1);
  const dl = Math.hypot(d[0], d[2]) || 1, sl = Math.hypot(S.x, S.z) || 1, cs = (d[0] * S.x + d[2] * S.z) / dl / sl, toward = Math.pow(cs * 0.5 + 0.5, 2.5), away = Math.pow(0.5 - cs * 0.5, 2);
  const band = mix([1.0, 0.40, 0.12], [1.0, 0.55, 0.22], clamp(h * 3, 0, 1));
  hor = mix(hor, band.map(v => v * (0.3 + 0.7 * day)), tw * (0.28 + 0.72 * toward) * 0.88);
  hor = mix(hor, [0.80, 0.50, 0.62].map(v => v * (0.25 + 0.75 * day)), tw * away * 0.32 * clamp((sa + 0.03) / 0.07, 0, 1));
  zen = mix(zen, [zen[0] * 0.85, zen[1] * 0.7, zen[2] * 1.18], tw * 0.55);
  let c = mix(hor, zen, Math.pow(h, 0.42));
  const g = (c[0] + c[1] + c[2]) * 0.33; c = mix(c, [g * 0.82, g * 0.82, g * 0.82], u.uCloud.value * 0.6);
  return c;
}

/* ---------- state ---------- */
const V3dSky: any = {
  U: null, dome: null, sun: null, moon: null, stars: null, rt: null, mcam: null, astroAt: 0, dimAt: 0, a: null, tint: [1, 1, 1], amb: 1, spots: [] as any[],
};
function v3dSkyUniforms(): any {
  if (V3dSky.U) return V3dSky.U;
  const T = THREE;
  V3dSky.U = {
    uSun: { value: new T.Vector3(0, 1, 0) }, uMoon: { value: new T.Vector3(0, -1, 0) }, uSunAlt: { value: 0.7 }, uDay: { value: 1 }, uMoonK: { value: 0 }, uCloud: { value: 0 },
    uSunCol: { value: new T.Color(1, 1, 1) }, uSunVis: { value: 1 }, uMoonVis: { value: 0 }, uAmb: { value: 1 }, uNight: { value: 0 },
    uTime: { value: 0 }, uWind: { value: 0.3 }, uWindDir: { value: 0 }, uWater: { value: 1 }, uMirror: { value: 0 }, uMirrorPass: { value: 0 },
    uMirrorTex: { value: null }, uMirrorMat: { value: new T.Matrix4() }, uLightsOn: { value: 0 }, uPxScale: { value: 800 }, uGlow: { value: 1 },
    uMist: { value: 0 },
    // up to four aircraft lights shining on the ground (landing and taxi lights): position, aim, strength, reach
    uSpotPos: { value: [0, 1, 2, 3].map(() => new T.Vector3()) }, uSpotDir: { value: [0, 1, 2, 3].map(() => new T.Vector3(0, -1, 0)) }, uSpotK: { value: new T.Vector4() }, uSpotR: { value: new T.Vector4(1, 1, 1, 1) },
  };
  return V3dSky.U;
}

/* ---------- the ground's material: the map or the satellite picture, with living water and town lights ---------- */
/** A ring's water as a picture: sea and lakes white, land black (soft at the coast). */
function v3dWetTexture(size: number, wet: (i: number) => number): any {
  const n = Math.min(640, size), cv = document.createElement('canvas'); cv.width = cv.height = n;
  const g = cv.getContext('2d'), img = g.createImageData(n, n), D = img.data, k = size / n;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const v = wet(Math.floor(y * k) * size + Math.floor(x * k)), o = (y * n + x) * 4; D[o] = D[o + 1] = D[o + 2] = v; D[o + 3] = 255; }
  g.putImageData(img, 0, 0);
  const T = THREE, tex = new T.CanvasTexture(cv); tex.generateMipmaps = true; tex.minFilter = T.LinearMipmapLinearFilter; tex.magFilter = T.LinearFilter;
  return tex;
}
function v3dGroundMat(map: any, wetTex: any): any {
  const T = THREE, U = v3dSkyUniforms();
  const m = new T.MeshBasicMaterial({ map });
  const own = { uWet: { value: wetTex }, uCity: { value: null as any }, uCityOn: { value: 0 } };
  m.userData.u = own; m.userData.ground = true;
  m.onBeforeCompile = (sh: any) => {
    Object.assign(sh.uniforms, U, own);
    sh.vertexShader = 'attribute float aFlat; varying float vFlat; varying vec3 vWpos; varying vec2 vUv2;\n' + sh.vertexShader.replace('#include <fog_vertex>', 'vWpos = (modelMatrix * vec4(position, 1.0)).xyz; vUv2 = uv; vFlat = aFlat;\n#include <fog_vertex>');
    sh.fragmentShader = `varying float vFlat; varying vec3 vWpos; varying vec2 vUv2;
uniform sampler2D uWet; uniform sampler2D uCity; uniform float uCityOn;
uniform vec3 uSunCol; uniform float uSunVis; uniform float uMoonVis; uniform float uAmb; uniform float uNight; uniform float uTime;
uniform float uWind; uniform float uWindDir; uniform float uWater; uniform float uMirror; uniform float uMirrorPass; uniform sampler2D uMirrorTex; uniform mat4 uMirrorMat;
float wh(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float wvn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(wh(i), wh(i + vec2(1.0, 0.0)), f.x), mix(wh(i + vec2(0.0, 1.0)), wh(i + vec2(1.0, 1.0)), f.x), f.y); }
${SKY_GLSL}
${SPOT_GLSL}
` + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
{
  // water only where the ground is water: flat, at the water's own level (never on a slope or on land)
  float wet = texture2D(uWet, vUv2).r * smoothstep(0.85, 1.0, vFlat);
  if (uMirrorPass > 0.5 && wet > 0.5) discard;
  // cliffs and steep slopes: the ground's picture is taken from straight above, so on a near-vertical face it would
  // smear into streaks; there the face is shaded as rock instead, in the area's own colour, lit by the sun
  {
    vec3 nrm = normalize(cross(dFdx(vWpos), dFdy(vWpos))); if (nrm.y < 0.0) nrm = -nrm;
    float steep = smoothstep(0.62, 0.32, nrm.y) * (1.0 - smoothstep(0.2, 0.5, wet));
    if (steep > 0.001) {
      vec3 area = textureLod(map, vMapUv, 4.5).rgb;
      float lit = 0.62 + 0.5 * max(dot(nrm, normalize(uSun)), 0.0) * uSunVis;
      float strata = 0.9 + 0.1 * wvn(vec2(vWpos.y * 0.22, (vWpos.x + vWpos.z) * 0.035)) + 0.06 * wvn(vec2(vWpos.y * 1.3, (vWpos.x - vWpos.z) * 0.2));
      diffuseColor.rgb = mix(diffuseColor.rgb, area * lit * strata, steep);
    }
  }
  vec3 cityL = vec3(0.0);
  if (uCityOn > 0.5 && uNight > 0.01) { vec3 cc = texture2D(uCity, vUv2).rgb; float lum = max(dot(cc, vec3(0.35, 0.45, 0.2)) - 0.09, 0.0) / 0.91; cityL = vec3(1.0, 0.7, 0.36) * pow(lum, 1.5) * 1.5 * uNight * (1.0 - smoothstep(0.3, 0.6, wet)); }
  if (uWater > 0.5 && wet > 0.25) {
    vec3 V = normalize(cameraPosition - vWpos); float dist = length(cameraPosition - vWpos); vec2 P = vWpos.xz; float w = uWind;
    vec2 g = vec2(0.0);
    float foot = dist * 0.0012 / max(V.y, 0.03);   // the size of a pixel on the water there (long at a low angle)
    // the sea's surface: many waves of different lengths, heights and directions, on a slowly wandering grid
    // (so no straight lines or repeating pattern show), plus irregular small ripples; waves too small to
    // see from here are faded out and turn into a rougher, softer sheen instead of a striped one
    vec2 Pw = P + vec2(sin(P.y * 0.0091 + uTime * 0.05) + sin(P.y * 0.0037 - P.x * 0.002), sin(P.x * 0.0083 - uTime * 0.04) + sin(P.x * 0.0029 + P.y * 0.0031)) * 22.0;
    float tot = 0.0, seen = 0.0;
    for (int i = 0; i < 14; i++) {
      float fi = float(i), r1 = fract(sin(fi * 12.9898 + 1.3) * 43758.5453), r2 = fract(sin(fi * 78.233 + 4.1) * 12345.678), r3 = fract(sin(fi * 39.425 + 7.7) * 24634.634);
      float lam = 170.0 * pow(0.71, fi) * mix(0.6, 1.3, w) * (0.7 + 0.6 * r1);
      float ang = uWindDir + (r2 - 0.5) * (1.6 + fi * 0.18);
      vec2 dir = vec2(cos(ang), sin(ang)); float k = 6.2831853 / lam;
      float ph = dot(dir, Pw) * k - uTime * sqrt(9.81 * k) + r3 * 6.2831853;
      float a0 = mix(0.025, 0.11, w) * (0.55 + 0.9 * r3), vis = smoothstep(foot * 4.0, foot * 16.0, lam);
      g += dir * cos(ph) * a0 * vis; tot += a0; seen += a0 * vis;
    }
    // small irregular ripples (noise), drifting with the wind
    vec2 wd = vec2(cos(uWindDir), sin(uWindDir)) * uTime * (0.6 + 1.5 * w);
    for (int j = 0; j < 2; j++) {
      float sc = j == 0 ? 6.5 : 2.2, vis = smoothstep(foot * 3.0, foot * 12.0, sc);
      vec2 q = (P - wd * (j == 0 ? 1.0 : 1.7)) / sc, e = vec2(0.37, 0.0);
      g += vec2(wvn(q + e.xy) - wvn(q - e.xy), wvn(q + e.yx) - wvn(q - e.yx)) * mix(0.18, 0.5, w) * vis * (j == 0 ? 1.0 : 0.6);
      tot += 0.08; seen += 0.08 * vis;
    }
    float rough = 1.0 - seen / max(tot, 1e-4);   // how much of the surface's detail is too small to see from here
    vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
    float F = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
    vec3 R = reflect(-V, N); R.y = abs(R.y) + 0.002; R = normalize(R);
    // far away, the unseen ripples blur the reflection: the sky a little higher up and softer
    vec3 refl = pow(skyCol(normalize(R + vec3(0.0, rough * 0.12 * (0.4 + w), 0.0))), vec3(2.2));
    if (uMirror > 0.5) { vec4 mp = uMirrorMat * vec4(vWpos, 1.0); vec2 st = mp.xy / mp.w * 0.5 + 0.5 + N.xz * 0.05; if (mp.w > 0.0 && st.x > 0.0 && st.x < 1.0 && st.y > 0.0 && st.y < 1.0) refl = mix(texture2D(uMirrorTex, st).rgb, refl, rough * 0.35); }
    vec3 body = vec3(0.006, 0.03, 0.045) * uAmb;
    vec3 wc = mix(body, refl, F);
    float shn = mix(2200.0, 260.0, w) * (1.0 - 0.75 * rough);
    wc += uSunCol * pow(max(dot(R, uSun), 0.0), shn) * mix(40.0, 7.0, w) * uSunVis;
    wc += vec3(0.55, 0.6, 0.7) * pow(max(dot(R, uMoon), 0.0), shn * 0.6) * mix(3.0, 1.0, w) * uMoonVis;
    float shore = smoothstep(0.28, 0.45, wet) * (1.0 - smoothstep(0.45, 0.7, wet));
    float surf = shore * (0.55 + 0.45 * sin(dot(P, vec2(0.11, 0.07)) - uTime * 1.3)) * (0.35 + w);
    wc = mix(wc, vec3(0.85) * uAmb, clamp(surf, 0.0, 0.7));
    diffuseColor.rgb = mix(diffuseColor.rgb, wc, smoothstep(0.3, 0.6, wet));
  }
  diffuseColor.rgb += cityL + (sampledDiffuseColor.rgb + vec3(0.05)) * spotLight(vWpos) * (1.0 - smoothstep(0.3, 0.6, wet) * 0.7);
}`);
  };
  m.customProgramCacheKey = () => 'v3d-ground';
  return m;
}

/* ---------- town lights at night (NASA Black Marble, public domain) ---------- */
const CITY_URLS = [
  'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png',
  'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_CityLights_2012/default/2012-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpg',
];
function v3dCityLoad(r: any) {
  if (!skyOpt('v3dCity') || !r.mesh) { r.cityDone = true; return; }
  const gen = V3dTerrain.gen, zc = Math.min(8, r.z), sh = r.z - zc;
  const x0 = r.x0 >> sh, y0 = r.y0 >> sh, x1 = (r.x0 + r.N - 1) >> sh, y1 = (r.y0 + r.N - 1) >> sh, M = Math.max(x1 - x0, y1 - y0) + 1;
  const tryUrl = (k: number) => {
    if (k >= CITY_URLS.length) { r.cityDone = true; return; }
    V3dTerrain.tiles(CITY_URLS[k], zc, x0, y0, M, 'city').then((cv: HTMLCanvasElement) => {
      if (gen !== V3dTerrain.gen || !V3d.open || !r.mesh) { r.cityDone = true; return; }
      if (!cv) { tryUrl(k + 1); return; }
      // the part of the tiles the ring covers
      const out = document.createElement('canvas'); out.width = out.height = 512;
      const f = 256 / (1 << sh), sx = (r.x0 / (1 << sh) - x0) * 256, sy = (r.y0 / (1 << sh) - y0) * 256;
      out.getContext('2d').drawImage(cv, sx, sy, r.N * f, r.N * f, 0, 0, 512, 512);
      const T = THREE, tex = new T.CanvasTexture(out); tex.generateMipmaps = true; tex.minFilter = T.LinearMipmapLinearFilter;
      const u = r.mesh.material.userData.u; if (u) { u.uCity.value = tex; u.uCityOn.value = 1; }
      r.cityTex = tex; r.cityDone = true;
    });
  };
  tryUrl(0);
}

/* ---------- the sky's objects ---------- */
const SKY_BILLBOARD_VS = `
#include <common>
#include <logdepthbuf_pars_vertex>
uniform float uSize; varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  mv.xy += position.xy * uSize;
  gl_Position = projectionMatrix * mv;
  #include <logdepthbuf_vertex>
}`;
const SUN_GLOW = 40;   // the sun's picture reaches this many sun radii (the disc in the middle, its glow around it)
const MOON_GLOW = 1.6;
function v3dSkyInit() {
  const T = THREE, U = v3dSkyUniforms(), sc = V3d.scene;
  // the sky: a dome around the camera, drawn first, behind everything
  const dome = new T.Mesh(new T.SphereGeometry(1, 48, 24), new T.ShaderMaterial({
    uniforms: U, side: T.BackSide, depthTest: false, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: SKY_GLSL + '\nvarying vec3 vDir; void main() { vec3 c = skyCol(normalize(vDir)); c += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0; gl_FragColor = vec4(c, 1.0); }',
  }));
  dome.renderOrder = -1000; dome.frustumCulled = false; sc.add(dome); V3dSky.dome = dome;
  // the sun: its disc at its true size (about half a degree), and the glow around it
  const sun = new T.Mesh(new T.PlaneGeometry(1, 1), new T.ShaderMaterial({
    uniforms: { uSize: { value: 1 }, uCol: { value: new T.Color(1, 1, 1) }, uVis: { value: 1 }, uFlat: { value: 1 }, uHaze: { value: 0 }, uTime: { value: 0 } },
    transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false,
    vertexShader: SKY_BILLBOARD_VS,
    fragmentShader: `#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uCol; uniform float uVis; uniform float uFlat; uniform float uHaze; uniform float uTime; varying vec2 vUv;
void main() {
  #include <logdepthbuf_fragment>
  vec2 q = (vUv - 0.5) * 2.0 * ${SUN_GLOW.toFixed(1)};
  float r = length(q);
  // the disc, squashed near the horizon by the air bending its light, with darker edges (limb darkening)
  float rd = length(vec2(q.x, q.y / uFlat));
  float disc = 1.0 - smoothstep(0.94, 1.04, rd);
  float limb = 0.55 + 0.45 * pow(max(0.0, 1.0 - min(rd, 1.0) * min(rd, 1.0)), 0.4);
  // too bright to look at: white-hot in the middle, its colour only in the glare around it
  vec3 core = mix(uCol, vec3(1.0), 0.75 - 0.55 * uHaze) * disc * limb * (3.2 - 1.6 * uHaze);
  // glare and bloom: a tight bright halo and a wide soft one; wider and softer in haze
  float bloom = exp(-r * (0.55 - 0.25 * uHaze)) * 0.85 + exp(-r * (0.16 - 0.06 * uHaze)) * 0.28 + exp(-r * 0.045) * 0.1 * (1.0 + uHaze);
  // faint rays from the glare, slowly shimmering
  float a = atan(q.y, q.x);
  float rays = pow(abs(cos(a * 3.0 + 0.3)), 40.0) * 0.6 + pow(abs(cos(a * 7.0 + uTime * 0.05)), 60.0) * 0.35 + pow(abs(cos(a * 11.0 - uTime * 0.03)), 80.0) * 0.25;
  rays *= exp(-r * 0.12) * (1.0 - smoothstep(0.0, 1.0, uHaze)) * smoothstep(1.0, 2.5, r);
  vec3 c = core + uCol * (bloom + rays * 0.5);
  float edge = 1.0 - smoothstep(0.8, 1.0, length(vUv - 0.5) * 2.0);
  gl_FragColor = vec4(c * uVis * edge, 1.0);
}` }));
  sun.renderOrder = -990; sun.frustumCulled = false; sc.add(sun); V3dSky.sun = sun;
  // the moon: a lit ball, its phase from where the sun is, and faint dark patches (the seas)
  const moon = new T.Mesh(new T.PlaneGeometry(1, 1), new T.ShaderMaterial({
    uniforms: { uSize: { value: 1 }, uL: { value: new T.Vector3(0, 0, 1) }, uVis: { value: 1 }, uDayK: { value: 0 }, uIllum: { value: 1 } }, transparent: true, depthWrite: false, fog: false,
    vertexShader: SKY_BILLBOARD_VS,
    fragmentShader: `#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uL; uniform float uVis; uniform float uDayK; uniform float uIllum; varying vec2 vUv;
float mare(vec2 p, vec2 c, float r) { return 1.0 - smoothstep(r * 0.6, r, length(p - c)); }
void main() {
  #include <logdepthbuf_fragment>
  vec2 p = (vUv - 0.5) * 2.0 * ${MOON_GLOW.toFixed(1)}; float r = length(p);
  vec3 n = vec3(p, sqrt(max(0.0, 1.0 - r * r)));
  float lit = smoothstep(-0.06, 0.1, dot(n, normalize(uL)));
  float m = mare(p, vec2(-0.3, 0.35), 0.3) + mare(p, vec2(0.12, 0.33), 0.18) + mare(p, vec2(0.28, 0.1), 0.22) + mare(p, vec2(-0.5, 0.0), 0.36)
          + mare(p, vec2(-0.15, -0.35), 0.2) + mare(p, vec2(0.5, -0.06), 0.15) + mare(p, vec2(0.62, 0.3), 0.11);
  float alb = 1.0 - 0.22 * clamp(m, 0.0, 1.0);
  float disc = 1.0 - smoothstep(0.97, 1.01, r);
  vec3 c = vec3(0.97, 0.95, 0.9) * alb;
  c = mix(c, vec3(0.86, 0.9, 1.0), uDayK * 0.35);
  float a = disc * clamp(lit * mix(1.0, 0.5, uDayK) + 0.035 * (1.0 - uDayK), 0.0, 1.0);
  float glow = r > 1.0 ? exp(-(r - 1.0) * 5.0) * 0.14 * uIllum * (1.0 - uDayK) : 0.0;
  gl_FragColor = vec4(c, (a + glow) * uVis);
}` }));
  moon.renderOrder = -989; moon.frustumCulled = false; sc.add(moon); V3dSky.moon = moon;
  // the stars: the real ones, brighter ones bigger, in their colours; they turn with the sky
  const N = STARS.length / 4, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), size = new Float32Array(N), br = new Float32Array(N);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  for (let i = 0; i < N; i++) {
    const ra = STARS[i * 4] * D2R, dec = STARS[i * 4 + 1] * D2R, mag = STARS[i * 4 + 2], bv = STARS[i * 4 + 3];
    pos[i * 3] = Math.cos(dec) * Math.cos(ra); pos[i * 3 + 1] = Math.cos(dec) * Math.sin(ra); pos[i * 3 + 2] = Math.sin(dec);
    const t = clamp((bv + 0.3) / 2.0, 0, 1), c = t < 0.45 ? [0.72 + t * 0.6, 0.8 + t * 0.4, 1] : [1, 1 - (t - 0.45) * 0.5, 1 - (t - 0.45) * 1.1];
    col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = Math.max(0.4, c[2]);
    size[i] = (1.0 + 2.6 * clamp((5.6 - mag) / 7, 0, 1)) * dpr; br[i] = clamp(Math.pow(10, -0.4 * (mag - 2.2)), 0.2, 1.8);
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('color', new T.BufferAttribute(col, 3));
  geo.setAttribute('aSize', new T.BufferAttribute(size, 1)); geo.setAttribute('aB', new T.BufferAttribute(br, 1));
  const stars = new T.Points(geo, new T.ShaderMaterial({
    uniforms: { uNight: U.uNight, uTime: U.uTime, uCloud: U.uCloud }, transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false, vertexColors: true,
    vertexShader: `#include <common>
#include <logdepthbuf_pars_vertex>
attribute float aSize; attribute float aB; uniform float uTime; varying vec3 vCol; varying float vB;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0); vec3 dir = normalize(wp.xyz - cameraPosition);
  float tw = 0.82 + 0.18 * sin(uTime * (2.0 + fract(position.x * 91.7) * 3.0) + position.y * 400.0);
  vCol = color; vB = aB * tw * smoothstep(-0.01, 0.16, dir.y);
  gl_PointSize = aSize;
  gl_Position = projectionMatrix * viewMatrix * wp;
  #include <logdepthbuf_vertex>
}`,
    fragmentShader: `#include <common>
#include <logdepthbuf_pars_fragment>
uniform float uNight; uniform float uCloud; varying vec3 vCol; varying float vB;
void main() {
  #include <logdepthbuf_fragment>
  float d = length(gl_PointCoord - 0.5) * 2.0;
  gl_FragColor = vec4(vCol, smoothstep(1.0, 0.15, d) * vB * uNight * (1.0 - 0.85 * uCloud));
}` }));
  stars.renderOrder = -995; stars.frustumCulled = false; stars.matrixAutoUpdate = false; sc.add(stars); V3dSky.stars = stars;
  V3dSky.astroAt = 0; V3dSky.dimAt = 0;
}
function v3dSkyClear() {
  if (V3dSky.envRt) { try { V3dSky.envRt.dispose(); } catch (e) { /* gone */ } V3dSky.envRt = null; } V3dSky.envKey = ''; V3dSky.envAt = 0; if (V3dSky.pm) { try { V3dSky.pm.dispose(); } catch (e) { /* gone */ } V3dSky.pm = null; }
  if (V3dSky.rt) { try { V3dSky.rt.dispose(); } catch (e) { /* gone */ } }
  V3dSky.dome = V3dSky.sun = V3dSky.moon = V3dSky.stars = V3dSky.rt = V3dSky.mcam = null; V3dSky.bow = null; V3dSky.bowK = 0; V3dSky.aurora = null;
}

/** The weather nearest the view: wind (0–1 and the direction it blows to) and how overcast it is. */
function v3dSkyWeather(lon: number, lat: number): { wind: number; dir: number; cloud: number; visM: number } {
  const L: any = typeof Link !== 'undefined' ? (Link as any).sim : null;
  let kt = -1, from = 0, cloud = 0, visM = -1;
  if (L && L.wx && L.lat && gcDistanceNm([L.lon, L.lat], [lon, lat]) < 30) { kt = L.wx.windKt; from = L.wx.windDir; visM = L.wx.inCloud ? 300 : L.wx.visM || -1; }
  // the reports nearby, blended by distance, so the weather changes smoothly between airports
  const cache: any = LiveWx.cache, near: [number, any][] = [];
  for (const k in cache) { const A = apt(k); if (!A) continue; const d = gcDistanceNm(A.pos, [lon, lat]); if (d < 120) near.push([d, cache[k]]); }
  near.sort((a, b) => a[0] - b[0]);
  let sw = 0, skt = 0, sx = 0, sy = 0, scl = 0, svis = 0;
  for (const [d, w] of near.slice(0, 4)) {
    const k = 1 / (Math.max(3, d) * Math.max(3, d));
    let v = 16000; const mi = parseFloat(String(w.vis || ''));   // the report's visibility is in statute miles ("10+" is ten or more)
    if (isFinite(mi)) v = /\+/.test(String(w.vis)) ? 16000 : mi * 1609;
    if (/FG|BR|HZ/.test(w.wx || '')) v = Math.min(v, /FG/.test(w.wx || '') ? 800 : 4000);
    let c = 0; for (const q of w.clouds || []) c = Math.max(c, q.cover === 'OVC' ? 1 : q.cover === 'BKN' ? 0.6 : q.cover === 'SCT' ? 0.2 : 0);
    const dir = (w.dir >= 0 ? w.dir : 0) * D2R;
    sw += k; skt += k * (w.kt || 0); sx += k * Math.sin(dir); sy += k * Math.cos(dir); scl += k * c; svis += k * v;
  }
  if (sw > 0) {
    if (kt < 0) { kt = skt / sw; from = (Math.atan2(sx, sy) / D2R + 360) % 360; }
    if (visM < 0) visM = svis / sw;
    cloud = scl / sw;
  }
  if (kt < 0) kt = 8;
  // the waves run with the wind: towards where it blows (x east, z south)
  const to = (from + 180) * D2R;
  return { wind: clamp(kt / 32, 0, 1), dir: Math.atan2(-Math.cos(to), Math.sin(to)), cloud, visM: visM < 0 ? 16000 : visM };
}

/** Each frame: the sun, moon and stars where they are now, the light and colours to match, the water, the mirror picture. */
function v3dSkyStep(now: number) {
  const T = THREE, U = v3dSkyUniforms(), cam = V3d.cam; if (!cam || !V3d.origin) return;
  if (!V3dSky.dome || V3dSky.dome.parent !== V3d.scene) v3dSkyInit();
  U.uTime.value = now / 1000;
  const ll = v3dLonLat(cam.position.x, cam.position.z), dn = skyOpt('v3dDayNight');
  // the sun and the moon: worked out a few times a second (they move slowly, but you may fly fast)
  if (!V3dSky.a || now - V3dSky.astroAt > 400) {
    V3dSky.astroAt = now;
    const t = skyTime(), d = astroD(t), lst = astroLst(d, ll[0]);
    const s = astroSun(d), sp = astroAltAz(s.ra, s.dec, ll[1], lst);
    const m = astroMoon(d), mp = astroAltAz(m.ra, m.dec, ll[1], lst);
    const mAlt = mp.alt - m.par * Math.cos(mp.alt * D2R);   // seen from the surface, not the centre of the Earth
    let sunAlt = astroRefract(sp.alt), moonAlt = astroRefract(mAlt);
    if (!dn) { sunAlt = Math.max(sunAlt, 38); moonAlt = -30; }
    const sv = astroVec(sunAlt, sp.az), mv = astroVec(moonAlt, mp.az);
    const el = Math.acos(clamp(sv[0] * mv[0] + sv[1] * mv[1] + sv[2] * mv[2], -1, 1)), illum = (1 - Math.cos(el)) / 2;
    // the stars: the sky's turning as one rotation (the equator's axes as seen from here)
    const e = (ra: number, dec: number) => { const q = astroAltAz(ra, dec, ll[1], lst); return astroVec(q.alt, q.az); };
    const ex = e(0, 0), ey = e(90, 0), ez = e(0, 90);
    // the weather eases from one state to the next over half a minute or so, never in a jump
    const w1 = v3dSkyWeather(ll[0], ll[1]), w0 = V3dSky.a && V3dSky.a.wx, dt = V3dSky.wxAt ? now - V3dSky.wxAt : 0; V3dSky.wxAt = now;
    let wx = w1;
    if (w0 && dt > 0) {
      const k = 1 - Math.exp(-dt / 9000), lerp = (a: number, b: number) => a + (b - a) * k;
      let dd = w1.dir - w0.dir; while (dd > Math.PI) dd -= 2 * Math.PI; while (dd < -Math.PI) dd += 2 * Math.PI;
      wx = { wind: lerp(w0.wind, w1.wind), dir: w0.dir + dd * k, cloud: lerp(w0.cloud, w1.cloud), visM: Math.exp(lerp(Math.log(w0.visM), Math.log(w1.visM))) };
    }
    V3dSky.a = { sunAlt, moonAlt, sv, mv, illum, ex, ey, ez, wx };
  }
  const A = V3dSky.a, sunAlt = A.sunAlt, moonAlt = A.moonAlt;
  const sstep = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  U.uSun.value.set(A.sv[0], A.sv[1], A.sv[2]); U.uMoon.value.set(A.mv[0], A.mv[1], A.mv[2]);
  U.uSunAlt.value = Math.sin(sunAlt * D2R);
  U.uDay.value = Math.pow(sstep(-12, 8, sunAlt), 1.4);
  U.uCloud.value = A.wx.cloud; U.uWind.value = A.wx.wind; U.uWindDir.value = A.wx.dir;
  U.uMist.value = clamp((8000 - A.wx.visM) / 7000, 0, 1);   // mist and fog: the beams of landing lights show
  // the four aircraft lights nearest the camera shine on the ground
  {
    const cp0 = cam.position, list = (V3dSky.spots as any[]).sort((a, b) => a.pos.distanceToSquared(cp0) - b.pos.distanceToSquared(cp0)).slice(0, 4);
    const ks = [0, 0, 0, 0], rs = [1, 1, 1, 1];
    list.forEach((sp, i) => { U.uSpotPos.value[i].copy(sp.pos); U.uSpotDir.value[i].copy(sp.dir).normalize(); ks[i] = sp.k; rs[i] = sp.range; });
    U.uSpotK.value.set(ks[0], ks[1], ks[2], ks[3]); U.uSpotR.value.set(rs[0], rs[1], rs[2], rs[3]);
    V3dSky.spots = [];
  }
  const sunVis = sstep(-1.2, 1.5, sunAlt) * (1 - 0.85 * A.wx.cloud), moonUp = sstep(-1, 2, moonAlt);
  U.uSunVis.value = sunVis;
  U.uMoonK.value = moonUp * A.illum * (1 - U.uDay.value);
  U.uMoonVis.value = moonUp * A.illum * (1 - sstep(-6, 4, sunAlt)) * (1 - 0.8 * A.wx.cloud) * 0.6;
  U.uNight.value = 1 - sstep(-14, -3, sunAlt);
  // the sun's colour: white high up, gold and then red near the horizon
  const ts = sstep(0, 24, sunAlt), sunCol = [1, 0.38 + 0.6 * ts, 0.12 + 0.8 * ts];   // white high up; gold, then a deep orange-red near the horizon
  U.uSunCol.value.setRGB(sunCol[0], sunCol[1], sunCol[2], T.SRGBColorSpace);
  // the light on everything: daylight, warm at sunset, blue-grey moonlight at night
  const day = sstep(-7, 14, sunAlt) * (1 - 0.32 * A.wx.cloud), moon = U.uMoonK.value * 0.09, amb = 0.055 + day * 0.945 + moon;
  const warm = sstep(-6, 0, sunAlt) * (1 - sstep(3, 12, sunAlt)) * (1 - A.wx.cloud * 0.7);   // golden light while the sun is low (a little longer and warmer than before)
  const nightTint = [0.62, 0.7, 0.95], dayTint = [1, 1, 1], warmTint = [1, 0.72, 0.5];
  const tint = [0, 1, 2].map(i => (nightTint[i] + (dayTint[i] - nightTint[i]) * sstep(-6, 6, sunAlt)) * (1 - warm * 0.68) + warmTint[i] * warm * 0.68);
  V3dSky.amb = amb; V3dSky.tint = tint;
  U.uAmb.value = amb * amb;   // as linear light
  U.uLightsOn.value = 1 - sstep(-2, 5, sunAlt) * (1 - A.wx.cloud * 0.6);
  U.uGlow.value = 0.45 + 0.55 * U.uNight.value;
  U.uWater.value = v3dWaterMode() === 'simple' ? 0 : 1;
  // the lights of the scene
  const H: any = (V3d as any).hemi, D: any = (V3d as any).sunL;
  if (H) { H.intensity = 1.6 * amb; H.color.setRGB(0.87 * tint[0], 0.91 * tint[1], tint[2], T.SRGBColorSpace); H.groundColor.setRGB(0.13 * tint[0], 0.2 * tint[1], 0.28 * tint[2], T.SRGBColorSpace); }
  if (D) {
    if (sunVis > 0.02 || !(moonUp > 0)) { D.intensity = 1.9 * sunVis; D.color.setRGB(sunCol[0], sunCol[1], sunCol[2], T.SRGBColorSpace); D.position.set(A.sv[0] * 1e4, Math.max(0.05, A.sv[1]) * 1e4, A.sv[2] * 1e4); }
    else { D.intensity = 0.35 * A.illum * moonUp * (1 - A.wx.cloud * 0.8); D.color.setRGB(0.62, 0.7, 0.9, T.SRGBColorSpace); D.position.set(A.mv[0] * 1e4, Math.max(0.05, A.mv[1]) * 1e4, A.mv[2] * 1e4); }
  }
  // the fog and the background take the colour of the horizon in front of you
  const fwd = new T.Vector3(0, 0, -1).applyQuaternion(cam.quaternion); fwd.y = 0; if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1); fwd.normalize();
  const hc = skyColJs([fwd.x, 0.02, fwd.z], U);
  if (V3d.scene.fog) V3d.scene.fog.color.setRGB(hc[0], hc[1], hc[2], T.SRGBColorSpace);
  if (V3d.scene.background && V3d.scene.background.isColor) V3d.scene.background.setRGB(hc[0], hc[1], hc[2], T.SRGBColorSpace);
  // the sky's objects follow the camera
  const far = cam.far, Dd = far * 0.86, cp = cam.position;
  V3dSky.dome.position.copy(cp); V3dSky.dome.scale.setScalar(far * 0.9);
  const show = skyOpt('v3dSky');
  V3dSky.sun.visible = show && sunAlt > -2;
  V3dSky.sun.position.set(cp.x + A.sv[0] * Dd, cp.y + A.sv[1] * Dd, cp.z + A.sv[2] * Dd);
  V3dSky.sun.material.uniforms.uSize.value = 2 * Dd * Math.tan(0.2666 * D2R) * SUN_GLOW;
  V3dSky.sun.material.uniforms.uCol.value.setRGB(sunCol[0], sunCol[1], sunCol[2]);
  V3dSky.sun.material.uniforms.uVis.value = sstep(-1.5, 0.5, sunAlt) * (1 - 0.92 * A.wx.cloud);
  { const su = V3dSky.sun.material.uniforms;
    su.uFlat.value = 1 - 0.18 * (1 - sstep(-0.5, 4, sunAlt));                                   // flattened just above the horizon
    su.uHaze.value = clamp((1 - sstep(0, 12, sunAlt)) * 0.7 + U.uMist.value * 0.5 + A.wx.cloud * 0.3, 0, 1);   // low sun, mist, thin cloud: diffused
    su.uTime.value = now / 1000; }
  try { v3dFlareStep(cam, A, sstep(-0.5, 1.5, sunAlt) * (1 - 0.95 * A.wx.cloud) * (show ? 1 : 0)); } catch (e) { /* no flare */ }
  V3dSky.moon.visible = show && moonAlt > -1;
  V3dSky.moon.position.set(cp.x + A.mv[0] * Dd * 0.98, cp.y + A.mv[1] * Dd * 0.98, cp.z + A.mv[2] * Dd * 0.98);
  V3dSky.moon.material.uniforms.uSize.value = 2 * Dd * 0.98 * Math.tan(0.259 * D2R) * MOON_GLOW;
  const Lv = new T.Vector3(A.sv[0], A.sv[1], A.sv[2]).transformDirection(cam.matrixWorldInverse);
  V3dSky.moon.material.uniforms.uL.value.copy(Lv);
  V3dSky.moon.material.uniforms.uDayK.value = U.uDay.value;
  V3dSky.moon.material.uniforms.uIllum.value = A.illum;
  V3dSky.moon.material.uniforms.uVis.value = sstep(-1, 1, moonAlt) * (1 - 0.9 * A.wx.cloud);
  V3dSky.stars.visible = show && U.uNight.value > 0.01;
  if (V3dSky.stars.visible) {
    const M = new T.Matrix4().makeBasis(new T.Vector3(A.ex[0], A.ex[1], A.ex[2]), new T.Vector3(A.ey[0], A.ey[1], A.ey[2]), new T.Vector3(A.ez[0], A.ez[1], A.ez[2]));
    V3dSky.stars.matrix.makeTranslation(cp.x, cp.y, cp.z).multiply(M).multiply(new T.Matrix4().makeScale(Dd * 0.97, Dd * 0.97, Dd * 0.97));
    V3dSky.stars.matrixWorldNeedsUpdate = true;
  }
  // the size of a light's glow on screen
  U.uPxScale.value = (V3d.r ? V3d.r.domElement.height : 800) / (2 * Math.tan(cam.fov * D2R / 2));
  // the clouds take the light too
  try {
    const C: any = V3dClouds.mesh; if (C) {
      const k = 0.08 + 0.92 * sstep(-8, 10, sunAlt) + U.uMoonK.value * 0.08;
      C.material.uniforms.uLight.value.setRGB(0.97 * k * (tint[0] * 0.85 + 0.15), 0.98 * k * (tint[1] * 0.85 + 0.15), k * (tint[2] * 0.85 + 0.15));   // lit clouds take the sunset's colour
      C.material.uniforms.uDark.value.setRGB(0.5 * k * tint[0], 0.55 * k * tint[1], 0.63 * k * tint[2]);
      const useSun = sunAlt > -4 || !(moonUp > 0), v = useSun ? A.sv : A.mv;
      C.material.uniforms.uSun.value.set(v[0], Math.max(0.03, v[1]), v[2]).normalize();
      C.material.uniforms.uSunK.value = useSun ? sstep(-4, 3, sunAlt) : moonUp * A.illum * 0.35;
    }
  } catch (e) { /* no clouds */ }
  // everything drawn without lighting (the ground, runways, the airport's paint) is dimmed and tinted the same way
  if (now - V3dSky.dimAt > 300) {
    V3dSky.dimAt = now;
    const k = [tint[0] * amb, tint[1] * amb, tint[2] * amb];
    V3d.scene.traverse((o: any) => {
      const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      for (const m of ms) {
        if (!m || !(m.isMeshBasicMaterial || m.isSpriteMaterial) || m.userData.noDim) continue;
        if (m.isMeshBasicMaterial && o.isMesh && !m.userData.ground && V3d.airport && o.parent === V3d.airport) v3dSpotHook(m);
        if (!m.userData.c0) m.userData.c0 = m.color.clone();
        m.color.setRGB(m.userData.c0.r * k[0], m.userData.c0.g * k[1], m.userData.c0.b * k[2]);
      }
    });
  }
  // the mirror: the scene seen from under the water's surface, for the reflections (fast computers)
  const mirror = v3dWaterMode() === 'mirror';
  U.uMirror.value = mirror ? 1 : 0;
  if (mirror && V3d.r) {
    const R = V3d.r, w = Math.max(64, Math.floor(R.domElement.width / 2)), h = Math.max(64, Math.floor(R.domElement.height / 2));
    if (!V3dSky.rt || V3dSky.rt.width !== w || V3dSky.rt.height !== h) {
      if (V3dSky.rt) V3dSky.rt.dispose();
      V3dSky.rt = new T.WebGLRenderTarget(w, h); V3dSky.rt.texture.colorSpace = T.SRGBColorSpace;
      V3dSky.mcam = new T.PerspectiveCamera();
    }
    const mc = V3dSky.mcam; mc.copy(cam);
    const p = cam.position.clone(); p.y = -p.y;
    const f = new T.Vector3(0, 0, -1).applyQuaternion(cam.quaternion); f.y = -f.y;
    const up = new T.Vector3(0, 1, 0).applyQuaternion(cam.quaternion); up.y = -up.y;
    mc.position.copy(p); mc.up.copy(up); mc.lookAt(p.clone().add(f)); mc.updateMatrixWorld(); mc.updateProjectionMatrix();
    // nothing below the water's surface may show in the mirror (land dipping away with the Earth's curve, the
    // undersides of flat ground pieces): the camera's near plane is tilted to lie on the surface itself
    { const pl = new T.Plane(new T.Vector3(0, 1, 0), 0.5).applyMatrix4(mc.matrixWorldInverse);
      const cp = new T.Vector4(pl.normal.x, pl.normal.y, pl.normal.z, pl.constant), e = mc.projectionMatrix.elements;
      const q = new T.Vector4((Math.sign(cp.x) + e[8]) / e[0], (Math.sign(cp.y) + e[9]) / e[5], -1, (1 + e[10]) / e[14]);
      cp.multiplyScalar(2 / cp.dot(q));
      e[2] = cp.x; e[6] = cp.y; e[10] = cp.z + 1; e[14] = cp.w;
      mc.projectionMatrixInverse.copy(mc.projectionMatrix).invert(); }
    U.uMirrorMat.value.multiplyMatrices(mc.projectionMatrix, mc.matrixWorldInverse);
    U.uMirrorPass.value = 1;
    R.setRenderTarget(V3dSky.rt); R.render(V3d.scene, mc); R.setRenderTarget(null);
    U.uMirrorPass.value = 0; U.uMirrorTex.value = V3dSky.rt.texture;
  }
}

/* ---------- airport lights ---------- */
/** Glow around lights at night (Settings → Graphics: on by default on the PC, off on phones and tablets). */
function v3dHalo(): number { const v = (State.settings as any).v3dGlow; return (v == null ? hiQ() : !!v) ? 1 : 0; }
function v3dLightPoints(pos: number[], col: number[], size: number[], kind?: number[], dir?: number[], phase?: number[]): any {
  const T = THREE, U = v3dSkyUniforms(), geo = new T.BufferGeometry(), n = size.length;
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new T.Float32BufferAttribute(col, 3));
  geo.setAttribute('aSize', new T.Float32BufferAttribute(size, 1));
  geo.setAttribute('aKind', new T.Float32BufferAttribute(kind || new Array(n).fill(0), 1));
  geo.setAttribute('aDir', new T.Float32BufferAttribute(dir || new Array(n * 3).fill(0), 3));
  geo.setAttribute('aPhase', new T.Float32BufferAttribute(phase || new Array(n).fill(0), 1));
  const mat = new T.ShaderMaterial({
    uniforms: { uOn: U.uLightsOn, uScale: U.uPxScale, uTime: U.uTime, uGlow: U.uGlow, uFlags: { value: new T.Vector4(1, 1, 1, 0) }, uFlags2: { value: new T.Vector4(0, 0, 0, 0) }, uAlways: { value: 0 }, uHalo: { value: v3dHalo() } },
    transparent: true, depthWrite: false, blending: T.AdditiveBlending, vertexColors: true, fog: false,
    vertexShader: `#include <common>
#include <logdepthbuf_pars_vertex>
attribute float aSize; attribute float aKind; attribute vec3 aDir; attribute float aPhase;
uniform float uScale; uniform float uHalo; uniform float uTime; uniform vec4 uFlags; uniform vec4 uFlags2; varying vec3 vCol; varying float vOn; varying float vDay;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  float on = uFlags.x;
  if (aKind > 0.5 && aKind < 1.5) { float ph = fract(uTime * 0.9 + aPhase); on = (step(ph, 0.05) + step(0.12, ph) * step(ph, 0.17)) * uFlags.y; }
  else if (aKind > 1.5 && aKind < 2.5) { float ph = fract(uTime * 0.8 + aPhase); on = step(ph, 0.14) * uFlags.z; }
  else if (aKind > 2.5 && aKind < 4.5) { vec3 wd = normalize(mat3(modelMatrix) * aDir); vec3 tc = normalize(cameraPosition - wp.xyz); on = (aKind < 3.5 ? uFlags.w : uFlags2.x) * (0.15 + 2.6 * pow(max(dot(wd, tc), 0.0), 8.0)); }
  else if (aKind > 4.5 && aKind < 5.5) on = uFlags2.y;
  vCol = color; vDay = 0.0;
  if (aKind > 5.5 && aKind < 6.5) {
    vec3 tc = cameraPosition - wp.xyz; float hd = length(tc.xz);
    float ang = degrees(atan(tc.y, max(hd, 0.001)));
    vCol = ang > aPhase ? vec3(1.0, 0.97, 0.92) : vec3(1.0, 0.12, 0.08);
    on = smoothstep(0.0, 0.3, dot(normalize(tc.xz), normalize(aDir.xz)));   // only towards the approach
    vDay = 1.0;
  } else if (aKind > 6.5) {
    float ph = fract(uTime * 2.0);
    on = 1.0 - smoothstep(0.0, 0.05, abs(ph - aPhase * 0.8));
    on *= smoothstep(-0.2, 0.3, dot(normalize((cameraPosition - wp.xyz).xz), normalize(aDir.xz)));
  }
  vOn = on;
  vec4 mv = viewMatrix * wp;
  gl_PointSize = clamp(aSize * (aKind > 2.5 && aKind < 4.5 ? 1.0 + on : 1.0) * (1.0 + uHalo * 1.6) * uScale / max(1.0, -mv.z), 1.6, 34.0 * (1.0 + uHalo * 1.6));
  gl_Position = projectionMatrix * mv;
  #include <logdepthbuf_vertex>
}`,
    fragmentShader: `#include <common>
#include <logdepthbuf_pars_fragment>
uniform float uOn; uniform float uGlow; uniform float uAlways; uniform float uHalo; varying vec3 vCol; varying float vOn; varying float vDay;
void main() {
  #include <logdepthbuf_fragment>
  float d = length(gl_PointCoord - 0.5) * 2.0 * (1.0 + uHalo * 1.6);
  float a = (exp(-d * d * 5.0) + 0.6 * exp(-d * d * 40.0) + uHalo * 0.22 * exp(-d * d * 0.8)) * vOn * max(max(uOn, uAlways), vDay) * max(uGlow, vDay * 0.9);
  gl_FragColor = vec4(vCol * 1.4, clamp(a, 0.0, 1.0));
}` });
  const pts = new T.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 20;
  return pts;
}
/** The lights of an airport from its layout: runway edges, centre lines, thresholds and approach lights, taxiway centre and edge lights, apron floodlights. */
function v3dAirportLights(L: AirportLayout, loc: (x: number, y: number) => number[], gy: (x: number, z: number) => number): any {
  if (!skyOpt('v3dAptLights')) return null;
  const pos: number[] = [], col: number[] = [], size: number[] = [];
  const kind: number[] = [], dirs: number[] = [], phs: number[] = [];
  let rwy = true; const wp: number[] = [], wc: number[] = [], wg: number[] = [];   // runway lights, for their reflections on a wet runway
  const add = (x: number, z: number, h: number, c: number[], s: number, k?: number, d?: number[], ph?: number) => { if (rwy && !(k > 0)) { const g0 = gy(x, z); wp.push(x, g0 + h, z); wc.push(c[0], c[1], c[2]); wg.push(g0); } pos.push(x, gy(x, z) + h, z); col.push(c[0], c[1], c[2]); size.push(s); kind.push(k || 0); dirs.push(...(d || [0, 0, 0])); phs.push(ph || 0); };
  const W = [1, 0.95, 0.85], RED = [1, 0.15, 0.1], GRN = [0.2, 1, 0.45], BLU = [0.25, 0.45, 1], AMB = [1, 0.75, 0.25], FLOOD = [1, 0.72, 0.42];
  for (const r of L.runways) {
    if (r.surf === 9) continue;
    const q = v3dXY(r.lon, r.lat), h = r.hdg * D2R, f = [Math.sin(h), -Math.cos(h)], s = [Math.cos(h), Math.sin(h)], half = r.len / 2, w = (r.wid || 45) / 2 + 1.5;
    const at = (a: number, b: number) => [q[0] + f[0] * a + s[0] * b, q[1] + f[1] * a + s[1] * b];
    // edges every 60 m (amber over the last 600 m for the direction taken off in)
    for (let a = -half; a <= half + 0.1; a += 60) for (const b of [-w, w]) { const p = at(a, b); add(p[0], p[1], 0.9, a > half - 600 ? AMB : W, 2.2); }
    // centre line every 30 m on longer runways: white, then red and white, then red towards the end
    if (r.len >= 1500) for (let a = -half + 15; a < half; a += 30) { const left = half - a, c = left < 300 ? RED : left < 900 ? ((Math.round(a / 30) % 2) ? RED : W) : W; const p = at(a, 0); add(p[0], p[1], 0.7, c, 1.6); }
    // thresholds green, ends red
    for (let b = -w; b <= w + 0.1; b += (2 * w) / 8) { const p1 = at(-half, b), p2 = at(half, b); add(p1[0], p1[1], 0.8, GRN, 2.2); add(p2[0], p2[1], 0.8, RED, 2.2); }
    for (const dirn of [-1, 1]) {
      const out = [f[0] * dirn, 0, f[1] * dirn];   // from the threshold out towards the aircraft on approach
      // approach lights before the threshold, at every airport: on long runways the full system (900 m of white
      // bars, a cross bar at 300 m, red side bars in the last 300 m, and flashing lights running towards the
      // runway twice a second); on medium runways (Vágar's 1,799 m among them) a shorter one (420 m with
      // flashers); on short runways a simple one (a lit centre line of 210 m with a cross bar at 150 m)
      if (r.len < 1200) {
        for (let a = 30; a <= 210; a += 30) { const p = at(dirn * (half + a), 0); add(p[0], p[1], 1.2, W, 2.0); }
        for (let b = -9; b <= 9; b += 1.5) { const p = at(dirn * (half + 150), b); add(p[0], p[1], 1.2, W, 1.9); }
      } else {
        const full = r.len >= 2400, reach = full ? 900 : 420;
        for (let a = 30; a <= reach; a += 30) for (const b of [-2, -1, 0, 1, 2]) { const p = at(dirn * (half + a), b * 1.05); add(p[0], p[1], 1.5, W, 2.0); }
        for (let b = -15; b <= 15; b += 1.5) { const p = at(dirn * (half + (full ? 300 : 150)), b); add(p[0], p[1], 1.5, W, 2.0); }
        if (full) {
          for (let b = -7; b <= 7; b += 1) if (Math.abs(b) > 2) { const p = at(dirn * (half + 150), b); add(p[0], p[1], 1.5, W, 1.8); }
          for (let a = 30; a <= 270; a += 30) for (const sd of [-1, 1]) for (const bb of [0, 1, 2]) { const p = at(dirn * (half + a), sd * (11 + bb * 1.5)); add(p[0], p[1], 1.2, RED, 1.7); }
        }
        // the sequenced flashers ("the rabbit"), from the far end in to the cross bar
        const f0 = full ? 330 : 180;
        for (let a = reach; a >= f0; a -= 30) { const p = at(dirn * (half + a), 0); add(p[0], p[1], 2.2, [1, 1, 1], 4.2, 7, out, (reach - a) / Math.max(30, reach - f0 + 30)); }
      }
      // glide path lights beside the touchdown zone, on the left: PAPI (four lights) on longer runways, VASI
      // (two bars) on shorter ones. Each shows white above its angle and red below; on the 3° path two white,
      // two red (PAPI), or white over red (VASI)
      if (r.len >= 1200) {
        const left = dirn, edge = (r.wid || 45) / 2;   // the left of an aircraft landing on this end
        const th = (a: number) => dirn < 0 ? -half + a : half - a;
        if (r.len >= 1500) {   // PAPI from 1,500 m (Vágar has one), VASI on shorter runways
          const angles = [2.5, 2.8333, 3.1667, 3.5];   // from the outermost light in towards the runway (the one nearest the runway is set highest)
          angles.forEach((ang, i) => { const p = at(th(300), left * (edge + 15 + (3 - i) * 9)); add(p[0], p[1], 1.0, RED, 3.4, 6, out, ang); });
        } else {
          for (const [a0, ang] of [[150, 2.5], [300, 3.0]] as number[][]) for (const k of [0, 1, 2]) { const p = at(th(a0), left * (edge + 12 + k * 4)); add(p[0], p[1], 1.0, RED, 2.2, 6, out, ang); }
        }
      }
    }
  }
  rwy = false;
  // taxiways: green centre line every 30 m, blue edges every 60 m
  for (const p of L.paths || []) {
    if (!(p[0] === 1 || p[0] === 4)) continue;
    const A = L.points[p[2]], B = L.points[p[3]]; if (!A || !B) continue;
    const a = loc(A[0], A[1]), b = loc(B[0], B[1]), len = Math.hypot(b[0] - a[0], b[1] - a[1]); if (len < 1) continue;
    const ux = (b[0] - a[0]) / len, uz = (b[1] - a[1]) / len, wd = (p[1] || 18) / 2 + 1;
    for (let d = 0; d < len; d += 30) add(a[0] + ux * d, a[1] + uz * d, 0.6, GRN, 1.3);
    if (p[0] === 1) for (let d = 0; d < len; d += 60) for (const sd of [-wd, wd]) add(a[0] + ux * d - uz * sd, a[1] + uz * d + ux * sd, 0.6, BLU, 1.3);
  }
  // aprons: floodlight masts as at real airports, well apart (about 120–150 m), beside the stands on the
  // terminal side (in the gaps between stands, near the stands' noses) and never on a taxiway or a stand
  const masts = v3dApronMasts(L, loc);
  for (const m of masts) add(m[0], m[1], 27, FLOOD.map(v => v * 0.75), 7);
  if (!size.length) return null;
  const pts = v3dLightPoints(pos, col, size, kind, dirs, phs);
  const wet = typeof v3dWetReflections === 'function' ? v3dWetReflections(wp, wc, wg) : null;
  if (!masts.length && !wet) return pts;
  const grp = new THREE.Group(); grp.add(pts); if (masts.length) grp.add(v3dMastMeshes(masts, gy)); if (wet) grp.add(wet);
  return grp;
}

/** Where the apron floodlight masts stand ([x, z] in the view). */
function v3dApronMasts(L: AirportLayout, loc: (x: number, y: number) => number[]): number[][] {
  const segs: number[][] = [];   // taxiways: [ax, az, bx, bz, half width]
  for (const p of L.paths || []) {
    const A = L.points[p[2]], B = L.points[p[3]]; if (!A || !B) continue;
    const a = loc(A[0], A[1]), b = loc(B[0], B[1]); segs.push([a[0], a[1], b[0], b[1], (p[1] || 18) / 2]);
  }
  const stands = (L.parks || []).map(k => { const q = loc(k[0], k[1]); return [q[0], q[1], k[2], Math.max(12, k[3] || 20)]; });
  const terms = (L.areas || []).filter(a => a.k === 'terminal' && a.pts.length >= 3).map(a => a.pts.map(p => loc(p[0], p[1])));
  const segD = (x: number, z: number, g: number[]) => {
    const dx = g[2] - g[0], dz = g[3] - g[1], l2 = dx * dx + dz * dz || 1, t = clamp(((x - g[0]) * dx + (z - g[1]) * dz) / l2, 0, 1);
    return Math.hypot(x - g[0] - dx * t, z - g[1] - dz * t);
  };
  const inPoly = (x: number, z: number, P: number[][]) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i][1] > z) !== (P[j][1] > z) && x < (P[j][0] - P[i][0]) * (z - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]) c = !c; return c; };
  const ok = (x: number, z: number) => {
    for (const g of segs) if (segD(x, z, g) < g[4] + 9) return false;          // clear of every taxiway and taxilane
    for (const t of stands) if (Math.hypot(x - t[0], z - t[1]) < t[3] + 4) return false;   // never on a stand
    for (const P of terms) if (inPoly(x, z, P)) return false;                  // not inside the building
    return true;
  };
  const cand: number[][] = [];   // [x, z, preference]
  // beside each stand's nose (the terminal side), in the gap to the next stand
  for (const t of stands) {
    const h = t[2] * D2R, fx = Math.sin(h), fz = -Math.cos(h), rx = Math.cos(h), rz = Math.sin(h);
    for (const side of [-1, 1]) for (const ahead of [0.85, 0.5]) {
      const x = t[0] + fx * t[3] * ahead + rx * side * (t[3] + 6), z = t[1] + fz * t[3] * ahead + rz * side * (t[3] + 6);
      cand.push([x, z, ahead]);
    }
  }
  // no stands mapped: along the apron's edge, the stretches nearest the terminal first
  if (!stands.length) for (const ar of L.areas || []) {
    if (ar.k !== 'apron' || ar.pts.length < 3) continue;
    const P = ar.pts.map(p => loc(p[0], p[1]));
    for (let i = 0; i < P.length; i++) {
      const P1 = P[i], P2 = P[(i + 1) % P.length], len = Math.hypot(P2[0] - P1[0], P2[1] - P1[1]);
      for (let d = 10; d < len; d += 40) {
        const x = P1[0] + (P2[0] - P1[0]) * d / len, z = P1[1] + (P2[1] - P1[1]) * d / len;
        let near = 1e9; for (const T of terms) for (const q of T) near = Math.min(near, Math.hypot(x - q[0], z - q[1]));
        if (terms.length && near > 300) continue;
        cand.push([x, z, -near / 1000]);
      }
    }
  }
  cand.sort((a, b) => b[2] - a[2]);
  const out: number[][] = [], SEP = 130;
  for (const c of cand) {
    if (!ok(c[0], c[1])) continue;
    if (out.some(o => Math.hypot(o[0] - c[0], o[1] - c[1]) < SEP)) continue;
    out.push([c[0], c[1]]);
    if (out.length >= 80) break;
  }
  return out;
}

/** The masts themselves: a tall grey pole with a head of lamps, and a pool of light on the apron beneath at night. */
function v3dMastMeshes(masts: number[][], gy: (x: number, z: number) => number): any {
  const T = THREE, U = v3dSkyUniforms(), g = new T.Group(), n = masts.length, M = new T.Matrix4();
  const pole = new T.InstancedMesh(new T.CylinderGeometry(0.25, 0.45, 27, 6).translate(0, 13.5, 0), new T.MeshLambertMaterial({ color: 0x9AA1A8 }), n);
  const head = new T.InstancedMesh(new T.BoxGeometry(3.2, 1.1, 1.6).translate(0, 27.4, 0), new T.MeshLambertMaterial({ color: 0x6E757C }), n);
  const poolMat = new T.ShaderMaterial({
    uniforms: { uOn: U.uLightsOn }, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    vertexShader: '#include <common>\n#include <logdepthbuf_pars_vertex>\nvarying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);\n#include <logdepthbuf_vertex>\n}',
    fragmentShader: '#include <common>\n#include <logdepthbuf_pars_fragment>\nuniform float uOn; varying vec2 vUv; void main() {\n#include <logdepthbuf_fragment>\nfloat r = length(vUv - 0.5) * 2.0; float k = (1.0 - smoothstep(0.0, 1.0, r)); k = k * (0.55 + 0.45 * k); gl_FragColor = vec4(vec3(1.0, 0.78, 0.5) * k * 0.22 * uOn, 1.0); }',
    polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -8,
  });
  const pool = new T.InstancedMesh(new T.PlaneGeometry(270, 270).rotateX(-Math.PI / 2), poolMat, n);   // the floodlit area: about 135 m around each mast
  masts.forEach((m, i) => {
    const y = gy(m[0], m[1]), r = cloudHash(Math.round(m[0]), Math.round(m[1]), 7) * Math.PI;
    M.makeRotationY(r).setPosition(m[0], y, m[1]); pole.setMatrixAt(i, M); head.setMatrixAt(i, M);
    M.makeTranslation(m[0], y + 0.7, m[1]); pool.setMatrixAt(i, M);
  });
  pole.renderOrder = head.renderOrder = 9; pool.renderOrder = 8;
  g.add(pole, head, pool);
  return g;
}


/* ---------- aircraft lights ---------- */
/** Navigation lights (red left, green right, white tail), white strobes, red beacons and landing lights, on the model itself. */
function v3dPlaneLightsAdd(body: any, typeId: string) {
  if (!skyOpt('v3dAcLights')) return;
  const s = shapeOf(typeId), W = s.wing, heli = typeof isHeli === 'function' && isHeli(typeId), semi = heli ? s.w / 2 + 0.15 : s.span / 2, rootY = s.w / 2 * 0.9;
  // helicopters: the red and green lights sit on the sides of the cabin (no wings)
  const wz0 = s.ground + W.z * s.h + (W.z > 0.9 ? -0.05 : 0.06), tipX = heli ? s.L * 0.3 : W.x + (semi - rootY) * Math.tan(W.sweep * D2R) + W.tip * 0.5, tipZ = heli ? s.ground + s.h * 0.45 : wz0 + (semi - rootY) * Math.tan(W.dih * D2R);
  const v = (x: number, y: number, z: number) => _av(x, y, z);
  const pos: number[] = [], col: number[] = [], size: number[] = [], kind: number[] = [], dir: number[] = [], ph: number[] = [];
  const add = (p: any, c: number[], sz: number, k: number, d?: number[], phase?: number) => { pos.push(p.x, p.y, p.z); col.push(c[0], c[1], c[2]); size.push(sz); kind.push(k); dir.push(...(d || [0, 0, 0])); ph.push(phase || 0); };
  const span = Math.max(1, s.span / 30);
  add(v(tipX, -semi, tipZ), [1, 0.12, 0.1], 1.6 * span, 0);            // left: red
  add(v(tipX, semi, tipZ), [0.15, 1, 0.35], 1.6 * span, 0);             // right: green
  add(v(s.L - 0.2, 0, s.ground + s.h * 0.55), [1, 1, 0.95], 1.4 * span, 0);   // tail: white
  add(v(tipX, -semi, tipZ), [1, 1, 1], 2.6 * span, 1, undefined, 0);   // strobes
  add(v(tipX, semi, tipZ), [1, 1, 1], 2.6 * span, 1, undefined, 0);
  add(v(s.L * 0.42, 0, s.ground + s.h + 0.15), [1, 0.1, 0.05], 1.8 * span, 2, undefined, 0);   // beacons, top and bottom
  add(v(s.L * 0.5, 0, s.ground - 0.1), [1, 0.1, 0.05], 1.8 * span, 2, undefined, 0.5);
  // the nose points along −x of the model; the lights are aimed a little down
  const nrm = (a: number[]) => { const l = Math.hypot(a[0], a[1], a[2]); return a.map(q => q / l); };
  const landDir = nrm([-1, -0.1, 0]), taxiDir = nrm([-1, -0.22, 0]);
  // the landing lights sit in the leading edge of each wing, a short way out from the fuselage, so the light
  // (and its beam) comes out of the front of the wing
  const ly = rootY + (semi - rootY) * 0.16, lx = W.x + (ly - rootY) * Math.tan(W.sweep * D2R) - 0.12, lz = wz0 + (ly - rootY) * Math.tan(W.dih * D2R) - 0.04;
  const lA = v(lx, -ly, lz), lB = v(lx, ly, lz);
  add(lA, [1, 0.97, 0.88], 3.2 * span, 3, landDir); add(lB, [1, 0.97, 0.88], 3.2 * span, 3, landDir);           // landing lights, under the wings
  const nl = v(s.gear.nose, 0, Math.max(0.6, s.ground * 0.55));
  add(nl, [1, 0.96, 0.85], 2.4 * span, 4, taxiDir);                                                            // taxi and take-off light, on the nose gear
  add(nl, [1, 0.96, 0.85], 1.8 * span, 4, nrm([-0.7, -0.12, 0.7])); add(nl, [1, 0.96, 0.85], 1.8 * span, 4, nrm([-0.7, -0.12, -0.7]));   // runway turn-off lights
  add(v(s.fin.x + 0.8, 0, s.ground + s.h + 0.4), [1, 0.98, 0.92], 2.2 * span, 5);                               // logo light on the fin
  body.userData.lightSrc = { land: [lA, lB], nose: nl, landDir, taxiDir };
  // the beams of the landing lights, seen in mist and fog
  const T = THREE, beamMat = new T.ShaderMaterial({
    uniforms: { uK: { value: 0 } }, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false,
    vertexShader: `#include <common>
#include <logdepthbuf_pars_vertex>
varying float vA; varying vec3 vN; varying vec3 vV;
void main() { vA = uv.y; vec4 wp = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp;
#include <logdepthbuf_vertex>
}`,
    fragmentShader: `#include <common>
#include <logdepthbuf_pars_fragment>
uniform float uK; varying float vA; varying vec3 vN; varying vec3 vV;
void main() {
  #include <logdepthbuf_fragment>
  float edge = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 1.5);
  gl_FragColor = vec4(1.0, 0.95, 0.85, pow(vA, 2.2) * (1.0 - edge * 0.85) * 0.16 * uK);
}` });
  const beams: any[] = [];
  for (const p0 of [lA, lB]) {
    const len = 160, cone = new T.ConeGeometry(len * 0.13, len, 20, 1, true);
    cone.translate(0, -len / 2, 0);                       // the tip at the light
    const m = new T.Mesh(cone, beamMat); m.position.copy(p0);
    m.quaternion.setFromUnitVectors(new T.Vector3(0, -1, 0), new T.Vector3(landDir[0], landDir[1], landDir[2]));
    m.renderOrder = 30; m.frustumCulled = false; m.visible = false; body.add(m); beams.push(m);
  }
  body.userData.beams = beams; body.userData.beamMat = beamMat;
  const pts = v3dLightPoints(pos, col, size, kind, dir, ph);
  pts.material.uniforms.uAlways.value = 1;   // aircraft lights are on by day too (only less bright)
  body.add(pts); body.userData.lights = pts;
  // cabin lights: a warm glow in every passenger window, and a faint one in the cockpit windows; seen at
  // dusk and at night only
  const cp: number[] = [], cc: number[] = [], cs: number[] = [], zw = s.ground + s.win.z * s.h;
  const airliner = s.L > 20;
  for (let x = s.win.from; x <= s.win.to + 1e-6; x += s.win.pitch) {
    if (s.doors.some(d => Math.abs(d - x) < (airliner ? 0.75 : 0.55))) continue;
    const hw = fusSection(s, x).hw + 0.04;
    for (const side of [-1, 1]) { const q = v(x, side * hw, zw); cp.push(q.x, q.y, q.z); cc.push(0.62, 0.5, 0.32); cs.push(airliner ? 0.5 : 0.36); }
  }
  // the cockpit: the front windscreen and the side windows, softly lit from inside (seen from outside only)
  const fw = s.nose * 0.5, fs = s.nose * 0.66, ckz = s.ground + s.h * 0.76;
  const hwF = fusSection(s, fw).hw, hwS = fusSection(s, fs).hw;
  // a soft, dim glow spread across the windscreen and the side windows (the crew keep it low at night)
  const ckPts: number[][] = [];
  for (const f of [-0.75, -0.45, -0.15, 0.15, 0.45, 0.75]) ckPts.push([fw + Math.abs(f) * 0.35, f * hwF]);
  for (const sd of [-1, 1]) for (const dx of [0, 0.45]) ckPts.push([fs + dx, sd * (fusSection(s, fs + dx).hw + 0.03)]);
  for (const [x, yy] of ckPts) { const q = v(x, yy, ckz); cp.push(q.x, q.y, q.z); cc.push(0.34, 0.31, 0.25); cs.push(airliner ? 0.45 : 0.32); }
  if (cs.length) { const cab = v3dLightPoints(cp, cc, cs); body.add(cab); body.userData.cabin = cab; }
}
/** Which lights are on, as airline crews switch them through a flight:
 * navigation lights whenever the aircraft has power; the red beacon from pushback and engine start until the
 * engines are off at the gate; the white strobes from lining up until the runway is vacated after landing;
 * landing lights for take-off and the climb to 10,000 ft, and again from 10,000 ft on the way down until the
 * runway is vacated; the nose gear's taxi light for taxiing and its take-off light (with the runway turn-off
 * lights) on the runway, until the gear comes up, and again with the gear down on approach; the logo light
 * on the ground and below 10,000 ft. (They show in the dark; strobes and beacons by day too.) */
function v3dPlaneLightsSet(model: any, ph: string, agl: number, onGround: boolean, altFt?: number, gs?: number) {
  const body = model.userData.body, L = body && body.userData.lights; if (!L) return;
  const parked = /park|gate|boarding|deboard|arrived|turnaround/.test(ph);
  const push = /pushback/.test(ph), taxi = /taxi|holding short/.test(ph), lineUp = /lining up/.test(ph);
  const toRoll = /take-?off|lift-?off/.test(ph), onRwyLanding = onGround && /touchdown|landing|roll/.test(ph);
  const alt = altFt == null ? agl : altFt, low = alt < 10000;
  const nav = 1, beacon = parked ? 0 : 1;
  const strobe = lineUp || toRoll || !onGround || onRwyLanding ? 1 : 0;
  const landing = parked ? 0 : toRoll || (!onGround && low) || (onRwyLanding && (gs == null || gs > 30)) ? 1 : 0;
  const gearDown = onGround || /final|landing|approach|lift-?off|take-?off/.test(ph) || agl < 2000;
  // standing still on the ground for a while (at the gate, or stopped before it): the taxi light goes off, as crews
  // switch it off when they stop; parked at the gate it is always off
  const ud = model.userData || {}, now = performance.now();
  if (onGround && gs != null && gs < 1.5) { if (!ud.stillSince) ud.stillSince = now; } else ud.stillSince = 0;
  const stopped = onGround && !lineUp && !toRoll && ud.stillSince && now - ud.stillSince > 8000;
  const nose = push || parked || stopped ? 0 : taxi || lineUp || toRoll || onRwyLanding || (!onGround && gearDown && low && !/climb/.test(ph)) ? 1 : 0;
  // the light sits on the nose gear: only lit when that gear is fully down (never while it is retracting or stowed)
  const gearNow = model && model.userData ? model.userData.gearNow : null;
  const noseOn = gearNow == null || gearNow > 0.97 ? nose : 0;
  const logo = onGround || low ? 1 : 0;
  L.material.uniforms.uFlags.value.set(nav, strobe, beacon, landing);
  L.material.uniforms.uFlags2.value.set(noseOn, logo, 0, 0);
  // the light they throw on the ground, and their beams in mist
  const src = body.userData.lightSrc, U = v3dSkyUniforms();
  if (src && (landing || noseOn) && U.uLightsOn.value > 0.02) {
    body.updateMatrixWorld();
    const T = THREE, at = (p: any) => p.clone().applyMatrix4(body.matrixWorld), dirOf = (d: number[]) => new T.Vector3(d[0], d[1], d[2]).transformDirection(body.matrixWorld);
    const a = at(src.land[0]), b = at(src.land[1]);
    if (landing) V3dSky.spots.push({ pos: a.add(b).multiplyScalar(0.5), dir: dirOf(src.landDir), k: 1, range: 420 });
    // the nose gear's taxi light: as bright on the ground as the landing lights, reaching well ahead
    if (noseOn) V3dSky.spots.push({ pos: at(src.nose), dir: dirOf(src.taxiDir), k: landing ? 0.75 : 1, range: 220 });
  }
  const beams = body.userData.beams;
  if (beams) { const k = landing * U.uMist.value * U.uLightsOn.value; body.userData.beamMat.uniforms.uK.value = k; for (const m of beams) m.visible = k > 0.01; }
}

/* ---------- day and night on the 2D map ---------- */
const MapNight: any = { cv: null, key: '', at: 0 };
function nightMapDraw(c: CanvasRenderingContext2D, m: any) {
  if (!skyOpt('mapNight')) return;
  const W = m.w, H = m.h; if (!W || !H) return;
  const sc = 1 / 8, w = Math.ceil(W * sc), h = Math.ceil(H * sc);
  const a0 = m.ll(0, 0), a1 = m.ll(W, H); if (!a0 || !a1) return;
  const key = [a0[0].toFixed(2), a0[1].toFixed(2), a1[0].toFixed(2), a1[1].toFixed(2), W, H, Math.floor(Date.now() / 60000)].join(',');
  if (key !== MapNight.key && Date.now() - MapNight.at > 120) {
    MapNight.key = key; MapNight.at = Date.now();
    if (!MapNight.cv) MapNight.cv = document.createElement('canvas');
    const cv = MapNight.cv as HTMLCanvasElement; cv.width = w; cv.height = h;
    const g = cv.getContext('2d'), img = g.createImageData(w, h), D = img.data;
    const d = astroD(Date.now()), s = astroSun(d), gm = astroLst(d, 0), sd = Math.sin(s.dec * D2R), cd = Math.cos(s.dec * D2R);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const ll = m.ll((x + 0.5) / sc, (y + 0.5) / sc); if (!ll) continue;
      const f = ll[1] * D2R, Hh = (gm + ll[0] - s.ra) * D2R, alt = Math.asin(Math.sin(f) * sd + Math.cos(f) * cd * Math.cos(Hh)) / D2R;
      const dark = clamp((0.5 - alt) / 18, 0, 1), o = (y * w + x) * 4;
      // the night side darker, the day side a touch lighter, so the line between them shows on the dark map
      if (dark > 0.02) { D[o] = 0; D[o + 1] = 2; D[o + 2] = 10; D[o + 3] = Math.round(255 * dark * 0.62); }
      else { D[o] = 120; D[o + 1] = 160; D[o + 2] = 220; D[o + 3] = 16; }
    }
    g.putImageData(img, 0, 0);
  }
  if (!MapNight.cv) return;
  c.save(); c.imageSmoothingEnabled = true; c.drawImage(MapNight.cv, 0, 0, W, H); c.restore();
}

/* ---------- the lens flare ---------- */

/** Looking towards the sun: a glare and a row of soft rings and spots along the line from the sun through
 * the middle of the picture, as in a camera lens. Drawn on top of the view; fades as the sun leaves the
 * picture, sets or goes behind cloud. */
const FLARE_PARTS: [number, number, string, number][] = [   // position along the line (1 = sun, -1 = mirrored), size (share of picture height), colour, strength
  [1, 0.55, '255,240,215', 0.22], [0.62, 0.05, '255,200,140', 0.35], [0.38, 0.09, '170,220,255', 0.18], [0.12, 0.03, '255,255,255', 0.4],
  [-0.15, 0.13, '150,255,190', 0.12], [-0.32, 0.05, '255,170,120', 0.3], [-0.55, 0.2, '170,190,255', 0.1], [-0.78, 0.07, '255,220,170', 0.25], [-1.05, 0.3, '255,160,200', 0.07],
];
function v3dFlareStep(cam: any, A: any, vis: number) {
  const host = V3d.r && V3d.r.domElement && V3d.r.domElement.parentElement; if (!host) return;
  let el: HTMLElement = V3dSky.flare;
  const on = skyOpt('v3dFlare') && vis > 0.01 && !(A.wx && A.wx.visM < 1500) && V3d.mode !== 'cabin';
  if (!on) { if (el) el.style.opacity = '0'; return; }
  if (!el || el.parentElement !== host) {
    el = document.createElement('div'); el.className = 'v3d-flare';
    el.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;mix-blend-mode:screen;z-index:2;transition:opacity .25s';
    el.innerHTML = FLARE_PARTS.map(() => '<i style="position:absolute;border-radius:50%;left:0;top:0"></i>').join('');
    host.appendChild(el); V3dSky.flare = el;
  }
  const T = THREE, p = new T.Vector3(A.sv[0], A.sv[1], A.sv[2]).multiplyScalar(1e5).add(cam.position).project(cam);
  if (p.z > 1 || Math.abs(p.x) > 1.6 || Math.abs(p.y) > 1.6) { el.style.opacity = '0'; return; }
  // what hides the sun: the ground or the aircraft in front of it (checked a few times a second)
  const now = performance.now();
  if (!V3dSky.flareAt || now - V3dSky.flareAt > 250) {
    V3dSky.flareAt = now;
    let hit = false;
    try {
      // hills and mountains: walk along the line towards the sun and compare with the ground
      const d = new T.Vector3(A.sv[0], A.sv[1], A.sv[2]).normalize(), c = cam.position;
      if (V3dTerrain.rings.length) for (let t = 60; t < 60000 && !hit; t *= 1.25) {
        const x = c.x + d.x * t, y = c.y + d.y * t, z = c.z + d.z * t, ll = v3dLonLat(x, z);
        if (y < V3dTerrain.ground(ll[0], ll[1]) - v3dCurve(x, z)) hit = true;
      }
      // aircraft in front of the sun
      if (!hit) {
        const objs: any[] = []; for (const k in V3d.planes || {}) { const P = (V3d.planes as any)[k]; if (P && P.model && P.model.position.distanceTo(c) < 3000) objs.push(P.model); }
        hit = new T.Raycaster(c.clone(), d, 0.5, 5000).intersectObjects(objs, true).length > 0;
      }
    } catch (e) { /* nothing to test against */ }
    V3dSky.flareHid = hit;
  }
  const w = host.clientWidth, h = host.clientHeight, sx = (p.x * 0.5 + 0.5) * w, sy = (0.5 - p.y * 0.5) * h, cx = w / 2, cy = h / 2;
  const edge = 1 - clamp((Math.max(Math.abs(p.x), Math.abs(p.y)) - 0.9) / 0.7, 0, 1);
  const k = vis * edge * (V3dSky.flareHid ? 0 : 1);
  el.style.opacity = k.toFixed(3);
  const items = el.children;
  for (let i = 0; i < FLARE_PARTS.length; i++) {
    const f = FLARE_PARTS[i], x = cx + (sx - cx) * f[0], y = cy + (sy - cy) * f[0], s = f[1] * h, it = items[i] as HTMLElement;
    const ring = i === 2 || i === 6;
    it.style.width = it.style.height = s + 'px';
    it.style.transform = `translate(${(x - s / 2).toFixed(1)}px,${(y - s / 2).toFixed(1)}px)`;
    it.style.background = ring ? `radial-gradient(circle, rgba(${f[2]},0) 55%, rgba(${f[2]},${f[3]}) 68%, rgba(${f[2]},0) 74%)`
      : `radial-gradient(circle, rgba(${f[2]},${f[3]}) 0%, rgba(${f[2]},${(f[3] * 0.5).toFixed(3)}) 35%, rgba(${f[2]},0) 70%)`;
  }
}

/* ---------- reflections on the aircraft ---------- */

/** The sky as the aircraft reflect it: worked out from the sky's own colours (with the sun's glow), the
 *  ground below dark, made again as the light changes (sunrise, sunset, cloud, night). */
function v3dEnvStep(now: number) {
  const T = THREE, U = v3dSkyUniforms(); if (!V3d.r || !V3d.scene) return;
  const tint = V3dSky.tint || [1, 1, 1], amb = V3dSky.amb || 1, key = [tint[0], tint[1], tint[2], amb].map(v => Math.round(v * 20)).join(',');
  if (V3dSky.envKey === key && V3d.scene.environment && now - (V3dSky.envAt || 0) < 120000) return;
  if (V3dSky.envAt && now - V3dSky.envAt < 4000) return;
  V3dSky.envKey = key; V3dSky.envAt = now;
  try {
    const geo = new T.SphereGeometry(1, 32, 16), pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const d = [pos.getX(i), pos.getY(i), pos.getZ(i)];
      let c: number[];
      if (d[1] >= -0.02) c = skyColJs([d[0], Math.max(0.02, d[1]), d[2]], U).map(v => Math.pow(Math.max(0, v), 2.2));   // the sky's colours are screen colours: to light
      else { const k = amb * 0.22; c = [0.32 * k * tint[0], 0.34 * k * tint[1], 0.36 * k * tint[2]]; }
      col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
    }
    geo.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    const sc = new T.Scene(); sc.add(new T.Mesh(geo, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide })));
    // the sun as a bright spot, so it glints on the fuselage
    const a = V3dSky.a; if (a && a.sunAlt > -2) { const sun = new T.Mesh(new T.SphereGeometry(0.06, 8, 6), new T.MeshBasicMaterial({ color: new T.Color(4, 3.8, 3.4) })); sun.position.set(a.sv[0] * 0.9, a.sv[1] * 0.9, a.sv[2] * 0.9); sc.add(sun); }
    if (!V3dSky.pm) V3dSky.pm = new T.PMREMGenerator(V3d.r);
    const rt = V3dSky.pm.fromScene(sc, 0.03);
    if (V3dSky.envRt) V3dSky.envRt.dispose();
    V3dSky.envRt = rt; V3d.scene.environment = rt.texture;
    geo.dispose();
  } catch (e) { /* no reflections */ }
}

/* ---------- rainbows ---------- */

/** A rainbow: with the sun low behind you (under 42°) and not hidden by cloud, where rain is falling in
 *  front of you. The main bow at about 42° from the point opposite the sun (red outside, violet inside),
 *  the fainter second bow at about 51° with its colours the other way round, and the sky a little brighter
 *  inside the main bow. A full arc when you are in the rain; parts of one where the rain is only in some
 *  directions. */
function v3dRainbowStep() {
  const T = THREE, cam = V3d.cam, A = V3dSky.a; if (!cam || !A) return;
  let M = V3dSky.bow;
  if (!M || M.parent !== V3d.scene) {
    M = V3dSky.bow = new T.Mesh(new T.SphereGeometry(1, 64, 32), new T.ShaderMaterial({
      uniforms: { uAnti: { value: new T.Vector3() }, uK: { value: 0 }, uFull: { value: 0 }, uShafts: { value: Array.from({ length: 8 }, () => new T.Vector3()) } },
      vertexShader: '#include <common>\n#include <logdepthbuf_pars_vertex>\nvarying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n#include <logdepthbuf_vertex>\n}',
      fragmentShader: `#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uAnti; uniform float uK; uniform float uFull; uniform vec3 uShafts[8]; varying vec3 vDir;
vec3 spec(float h) { return clamp(abs(fract(h + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0) - 1.0, 0.0, 1.0); }
void main() {
  #include <logdepthbuf_fragment>
  vec3 d = normalize(vDir);
  float th = degrees(acos(clamp(dot(d, uAnti), -1.0, 1.0)));
  // where along the bow the rain is: everywhere, or only towards the rain curtains around you
  float m = uFull;
  vec2 hz = normalize(d.xz + 1e-5);
  for (int i = 0; i < 8; i++) { if (uShafts[i].z <= 0.0) continue; float a = acos(clamp(dot(hz, uShafts[i].xy), -1.0, 1.0)); m = max(m, 1.0 - smoothstep(uShafts[i].z * 0.6, uShafts[i].z, a)); }
  float b1 = 1.0 - smoothstep(0.0, 1.0, abs(th - 41.5) / 1.1);   // the main bow, about 2° wide
  float b2 = 1.0 - smoothstep(0.0, 1.0, abs(th - 51.9) / 1.6);   // the second bow
  vec3 c = spec(clamp((th - 40.4) / 2.2, 0.0, 1.0) * 0.78) * b1 + spec(clamp((54.0 - th) / 3.4, 0.0, 1.0) * 0.78) * b2 * 0.42;
  c += vec3(0.05) * (1.0 - smoothstep(38.0, 41.0, th));   // brighter inside the bow
  c *= m * uK * smoothstep(-0.02, 0.06, d.y + 0.03);
  gl_FragColor = vec4(c, 1.0);
}`,
      side: T.BackSide, transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false,
    }));
    M.renderOrder = 6; M.frustumCulled = false; V3d.scene.add(M);
  }
  // how much rain there is in front of you, and where
  const U = M.material.uniforms, cp = cam.position, sunAlt = A.sunAlt;
  const anti = new T.Vector3(-A.sv[0], -A.sv[1], -A.sv[2]).normalize();
  const shafts = ((V3dClouds as any).list || []).filter((p: any) => p.m === 3 && p.dies == null && !p.dx);   // rain curtains (not snow)
  const dirs: number[][] = [];
  for (const p of shafts) {
    const dx = p.x - cp.x, dz = p.z - cp.z, d = Math.hypot(dx, dz); if (d < 800 || d > 25000) continue;
    if (dx * anti.x + dz * anti.z < 0) continue;   // only on the side away from the sun
    dirs.push([dx / d, dz / d, Math.min(0.6, Math.atan2(p.s * 0.7, d)), d]);
  }
  dirs.sort((a, b) => a[3] - b[3]);
  const here = V3dWx.snow1 ? 0 : V3dWx.k;
  for (let i = 0; i < 8; i++) { const s = dirs[i]; U.uShafts.value[i].set(s ? s[0] : 0, s ? s[1] : 0, s ? s[2] : 0); }
  const sunOk = sunAlt > 0 && sunAlt < 42 ? Math.min(1, sunAlt / 3) * (1 - Math.max(0, sunAlt - 36) / 6) : 0;
  const wantK = skyOpt('v3dRainbow') ? sunOk * (1 - 0.85 * (A.wx ? A.wx.cloud : 0)) * Math.min(1, here * 1.5 + Math.min(1, dirs.length / 2) * 0.8) * 0.4 : 0;
  V3dSky.bowK = (V3dSky.bowK || 0) + (wantK - (V3dSky.bowK || 0)) * 0.03;   // forms and fades over a few seconds
  U.uK.value = V3dSky.bowK; U.uFull.value = Math.min(1, here * 2); U.uAnti.value.copy(anti);
  M.visible = V3dSky.bowK > 0.003;
  M.position.copy(cp); M.scale.setScalar(Math.min(cam.far * 0.8, 20000));
}

/* ---------- the northern and southern lights ---------- */

/** NOAA's aurora forecast (OVATION, from the Space Weather Prediction Center: US government data, public
 *  domain): the chance of aurora overhead on a 1° grid, renewed every few minutes. Kept as a small picture
 *  the sky shader looks up. */
const AuroraData: any = { tex: null, at: 0, busy: false, max: 0 };
function auroraFetch() {
  if (AuroraData.busy || Date.now() - AuroraData.at < 15 * 60e3) return;
  AuroraData.busy = true;
  Net.json('https://services.swpc.noaa.gov/json/ovation_aurora_latest.json').then((j: any) => {
    const pts: number[][] = (j && j.coordinates) || []; if (!pts.length) return;
    const W = 360, H = 181, d = new Uint8Array(W * H * 4); let max = 0;
    for (const p of pts) {
      const lon = ((Math.round(p[0]) % 360) + 360) % 360, lat = Math.round(p[1]) + 90, v = clamp(+p[2] || 0, 0, 100);
      if (lat < 0 || lat >= H) continue;
      const i = (lat * W + lon) * 4; d[i] = Math.round(v * 2.55); d[i + 3] = 255; max = Math.max(max, v);
    }
    auroraSetGrid(d, W, H); AuroraData.max = max; AuroraData.at = Date.now();
  }).catch(() => { AuroraData.at = Date.now() - 10 * 60e3; /* try again in five minutes */ }).then(() => { AuroraData.busy = false; });
}
function auroraSetGrid(d: Uint8Array, W: number, H: number) {
  const T = THREE, tex = new T.DataTexture(d, W, H, T.RGBAFormat);
  tex.wrapS = T.RepeatWrapping; tex.wrapT = T.ClampToEdgeWrapping; tex.magFilter = T.LinearFilter; tex.minFilter = T.LinearFilter; tex.needsUpdate = true;
  if (AuroraData.tex) AuroraData.tex.dispose();
  AuroraData.tex = tex;
  if (V3dSky.aurora) V3dSky.aurora.material.uniforms.uOv.value = tex;
}

function v3dAuroraStep(now: number) {
  const T = THREE, cam = V3d.cam, U = v3dSkyUniforms(); if (!cam || !V3dSky.a) return;
  const night = U.uNight.value, A = V3dSky.a;
  if (!skyOpt('v3dAurora') || night < 0.05) { if (V3dSky.aurora) V3dSky.aurora.visible = false; return; }
  auroraFetch();
  if (!AuroraData.tex || AuroraData.max < 3) { if (V3dSky.aurora) V3dSky.aurora.visible = false; return; }
  let M = V3dSky.aurora;
  if (!M || M.parent !== V3d.scene) {
    M = V3dSky.aurora = new T.Mesh(new T.SphereGeometry(1, 64, 32), new T.ShaderMaterial({
      uniforms: { uOv: { value: AuroraData.tex }, uLL: { value: new T.Vector2() }, uH: { value: 0 }, uK: { value: 0 }, uTime: { value: 0 } },
      vertexShader: '#include <common>\n#include <logdepthbuf_pars_vertex>\nvarying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n#include <logdepthbuf_vertex>\n}',
      fragmentShader: `#include <common>
#include <logdepthbuf_pars_fragment>
uniform sampler2D uOv; uniform vec2 uLL; uniform float uH; uniform float uK; uniform float uTime; varying vec3 vDir;
float h31(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vn(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1, 0, 0)), f.x), mix(h31(i + vec3(0, 1, 0)), h31(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(h31(i + vec3(0, 0, 1)), h31(i + vec3(1, 0, 1)), f.x), mix(h31(i + vec3(0, 1, 1)), h31(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
void main() {
  #include <logdepthbuf_fragment>
  vec3 d = normalize(vDir);
  if (d.y < -0.08) discard;
  float e = asin(clamp(d.y, -1.0, 1.0)), az = atan(d.x, -d.z), R = 6371.0;
  float la1 = uLL.y, lo1 = uLL.x;
  vec3 col = vec3(0.0);
  float jit = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);   // a different start for every pixel: no bands
  for (int i = 0; i < 12; i++) {
    float H = 95.0 + (float(i) + jit) * 18.0;
    // where the line of sight is at this height (over the curved Earth), and the forecast there
    float g = acos(clamp((R + uH) / (R + H) * cos(e), -1.0, 1.0)) - e;
    float la2 = asin(sin(la1) * cos(g) + cos(la1) * sin(g) * cos(az));
    float lo2 = lo1 + atan(sin(az) * sin(g) * cos(la1), cos(g) - sin(la1) * sin(la2));
    float p = texture2D(uOv, vec2(fract(lo2 / 6.2831853), (degrees(la2) + 90.0) / 181.0 + 0.5 / 181.0)).r;
    if (p < 0.02) continue;
    // curtains: bright vertical rays in slowly moving folds along the oval
    float fold = sin(lo2 * 45.0 + sin(la2 * 25.0 + uTime * 0.04) * 3.0 + uTime * 0.03);
    float rays = pow(vn(vec3(lo2 * 260.0 + fold * 2.0, la2 * 40.0, uTime * 0.12)), 3.5) * 2.0 + 0.05 * (0.5 + 0.5 * fold);
    float band = smoothstep(0.25, 0.9, 0.5 + 0.5 * sin(la2 * 220.0 + fold * 1.5 + uTime * 0.02));   // separate curtains, not one glow
    rays *= 0.35 + 0.65 * band;
    float hf = (H - 95.0) / 200.0;
    vec3 c = mix(vec3(0.12, 1.0, 0.38), vec3(0.85, 0.12, 0.32), smoothstep(0.4, 0.85, hf));   // green low down (oxygen, 558 nm), red high up (630 nm)
    float prof = exp(-hf * 3.2) + 0.3 * smoothstep(0.35, 0.7, hf) * (1.0 - hf);
    col += c * smoothstep(0.02, 0.5, p) * rays * prof;
  }
  col *= uK / 6.0 * smoothstep(-0.06, 0.05, d.y);
  gl_FragColor = vec4(col, 1.0);
}`,
      side: T.BackSide, transparent: true, depthWrite: false, depthTest: false, blending: T.AdditiveBlending, fog: false,
    }));
    M.renderOrder = -985; M.frustumCulled = false; V3d.scene.add(M);
  }
  const ll = v3dLonLat(cam.position.x, cam.position.z), u = M.material.uniforms;
  u.uLL.value.set(ll[0] * D2R, ll[1] * D2R); u.uH.value = Math.max(0, (cam.position.y + v3dCurve(cam.position.x, cam.position.z)) / 1000);
  u.uTime.value = now / 1000;
  // only on dark nights, dimmed by the moon and hidden by overcast
  u.uK.value = night * (1 - 0.5 * (U.uMoonK ? U.uMoonK.value : 0)) * (1 - 0.92 * (A.wx ? A.wx.cloud : 0)) * 1.05;
  M.visible = u.uK.value > 0.01;
  M.position.copy(cam.position); M.scale.setScalar(cam.far * 0.88);
}
