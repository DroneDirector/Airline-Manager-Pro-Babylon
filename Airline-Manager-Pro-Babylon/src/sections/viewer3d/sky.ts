// The world round the aircraft in the 3D viewer, drawn in one pass on a dome that goes with the camera:
//  - the sky: its blue overhead and paler towards the horizon, red and orange round the sun at sunrise and sunset,
//    dark blue at night; the sun's disc and the bright glow round it;
//  - the real stars (the Hipparcos catalogue) where they really are for the time and the place, turning through the
//    night, and the moon in its place with its phase lit by the sun;
//  - volumetric clouds: a layer of cumulus and stratocumulus below the aircraft, marched through in 3D and lit by the
//    sun (or the moon) with their own shade, silver edges towards the light and the colour of the hour;
//  - the sea under them on the curve of the Earth, with the sun's glitter on it, and the haze of the distance.
// Everything is in metres; x east, y up, z north; the camera is at the middle.
import { Scene, ShaderMaterial, Mesh, MeshBuilder, Effect, DynamicTexture, Texture, Vector3, Vector2, Color3 } from '@babylonjs/core';
import { STARS } from './stars';

Effect.ShadersStore['amSkyVertexShader'] = `precision highp float;
attribute vec3 position;
uniform mat4 worldViewProjection;
varying vec3 vDir;
void main(void) { vDir = position; gl_Position = worldViewProjection * vec4(position, 1.0); }`;

Effect.ShadersStore['amSkyFragmentShader'] = `precision highp float;
varying vec3 vDir;
uniform vec3 sunDir; uniform vec3 sunCol; uniform vec3 moonDir; uniform vec3 litDir; uniform vec3 litCol;
uniform float alt; uniform vec2 drift; uniform float time; uniform float cover; uniform float steps; uniform float lsteps;
uniform float lat; uniform float lst; uniform float starK; uniform float nightK; uniform float gnd; uniform float landK;
uniform sampler2D stars;
uniform float BASE; uniform float TOP;
const float R = 6371000.0, PI = 3.14159265;

float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * noise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return s; }
vec2 sphere(vec3 o, vec3 d, vec3 c, float r) {
  vec3 oc = o - c; float b = dot(oc, d), q = dot(oc, oc) - r * r, h = b * b - q;
  if (h < 0.0) return vec2(-1.0); h = sqrt(h); return vec2(-b - h, -b + h);
}
float hg(float c, float g) { float g2 = g * g; return (1.0 - g2) / (4.0 * PI * pow(1.0 + g2 - 2.0 * g * c, 1.5)); }

// the cloud layer's density at a point (x, z across the ground, h the height above the sea)
float cloud(vec3 p, float h, float detail) {
  float hn = (h - BASE) / (TOP - BASE); if (hn < 0.0 || hn > 1.0) return 0.0;
  vec2 g = p.xz + drift;
  float big = noise(vec3(g * 0.000035, 0.5)) * 0.65 + noise(vec3(g * 0.00011, 2.5)) * 0.35;      // where the fields of cloud are
  float shape = fbm(vec3(g.x * 0.00032, h * 0.00055, g.y * 0.00032) + vec3(time * 0.004, 0.0, time * 0.002));
  float prof = smoothstep(0.0, 0.12, hn) * smoothstep(1.0, 0.35 + 0.35 * big, hn);              // flat bases, rounded tops
  float d = shape * 0.9 + big * 0.75 - (1.55 - cover);
  d = d * prof;
  if (detail > 0.5 && d > 0.0) d -= (1.0 - d) * (noise(vec3(g.x, h * 1.5, g.y) * 0.0021) - 0.5) * 0.35;
  return clamp(d * 2.4, 0.0, 1.0);
}

vec3 skyCol(vec3 d) {
  float day = smoothstep(-0.12, 0.25, sunDir.y), y = max(d.y + 0.055, 0.0);
  vec3 zen = mix(vec3(0.004, 0.007, 0.02), vec3(0.05, 0.16, 0.48), day);
  vec3 hor = mix(vec3(0.02, 0.03, 0.06), vec3(0.50, 0.66, 0.88), day);
  float to = 0.5 + 0.5 * dot(normalize(d.xz + 1e-5), normalize(sunDir.xz + 1e-5));
  float low = smoothstep(0.42, 0.0, abs(sunDir.y + 0.02));                                    // sunrise and sunset
  hor = mix(hor, mix(vec3(0.85, 0.32, 0.12), vec3(1.0, 0.58, 0.22), to), low * (0.35 + 0.65 * to * to));
  zen = mix(zen, vec3(0.12, 0.12, 0.30), low * 0.35);
  vec3 c = mix(hor, zen, pow(min(1.0, y * 2.2), 0.55));
  float cs = dot(d, sunDir);
  c += sunCol * (hg(cs, 0.82) * 0.10 + hg(cs, 0.3) * 0.06);
  c += sunCol * smoothstep(0.99996, 0.99999, cs) * 60.0;                                      // the sun's disc
  // the moon, its phase lit by the sun
  float cm = dot(d, moonDir);
  if (cm > 0.99997) {
    vec3 up = abs(moonDir.y) < 0.99 ? vec3(0, 1, 0) : vec3(1, 0, 0), rx = normalize(cross(up, moonDir)), ry = cross(moonDir, rx);
    vec2 q = vec2(dot(d, rx), dot(d, ry)) / 0.0078; float r2 = dot(q, q);
    if (r2 < 1.0) { vec3 n = normalize(rx * q.x + ry * q.y - moonDir * sqrt(1.0 - r2)); float lit = max(dot(n, sunDir), 0.0);
      float maria = 0.75 + 0.25 * noise(vec3(q * 3.0, 1.0)); c = mix(c, vec3(1.0, 0.97, 0.9) * (0.04 + lit * 1.6 * maria), smoothstep(1.0, 0.9, r2)); }
  }
  // the stars, from the catalogue: the direction made into right ascension and declination for here and now
  if (starK > 0.001 && d.y > -0.06) {
    float el = asin(clamp(d.y, -1.0, 1.0)), az = atan(d.x, d.z);
    float sd = sin(lat) * sin(el) + cos(lat) * cos(el) * cos(az), dec = asin(clamp(sd, -1.0, 1.0));
    float H = atan(-sin(az) * cos(el), cos(lat) * sin(el) - sin(lat) * cos(el) * cos(az));
    float ra = mod(lst - H, 2.0 * PI);
    vec3 s = texture2D(stars, vec2(ra / (2.0 * PI), 0.5 - dec / PI)).rgb;
    c += s * starK * smoothstep(-0.06, 0.08, d.y);
  }
  return c;
}

void main(void) {
  vec3 d = normalize(vDir), o = vec3(0.0), C = vec3(0.0, -(R + alt), 0.0);
  vec3 bg; float far = 1e9;
  vec2 e = sphere(o, d, C, R + gnd);
  if (e.x > 0.0 && landK > 0.5) {
    // land round an airport: fields, woods and towns, in the light of the hour
    vec3 p = d * e.x; vec2 g = p.xz + drift;
    float f1 = noise(vec3(g * 0.0009, 1.3)), f2 = noise(vec3(g * 0.004, 7.1)), f3 = noise(vec3(g * 0.00015, 3.3));
    vec3 lc = mix(vec3(0.20, 0.27, 0.13), vec3(0.33, 0.35, 0.18), f1); lc = mix(lc, vec3(0.12, 0.18, 0.09), smoothstep(0.62, 0.75, f2)); lc = mix(lc, vec3(0.32, 0.31, 0.29), smoothstep(0.7, 0.85, f3) * 0.7);
    float sunk = max(sunDir.y, 0.0) * 0.9 + 0.1 * smoothstep(-0.1, 0.2, sunDir.y);
    bg = lc * (sunCol * sunk * 1.1 + skyCol(vec3(0.0, 1.0, 0.0)) * 0.5);
    far = e.x; bg = mix(bg, skyCol(vec3(d.x, 0.0, d.z)), 1.0 - exp(-far / 90000.0));
  } else if (e.x > 0.0) {
    // the sea, on the curve of the Earth
    vec3 p = d * e.x, n = normalize(p - C), r = reflect(d, n);
    float fr = 0.02 + 0.98 * pow(1.0 - max(dot(-d, n), 0.0), 5.0);
    vec3 sky = skyCol(vec3(r.x, max(r.y, 0.02), r.z));
    float glint = pow(max(dot(r, sunDir), 0.0), 900.0) * 30.0 + pow(max(dot(r, sunDir), 0.0), 60.0) * 0.4;
    bg = mix(vec3(0.004, 0.02, 0.035) * (0.2 + 0.8 * smoothstep(-0.1, 0.3, sunDir.y)), sky, fr) + sunCol * glint;
    far = e.x;
    bg = mix(bg, skyCol(vec3(d.x, 0.0, d.z)), 1.0 - exp(-far / 140000.0));
  } else bg = skyCol(d);

  // the clouds: from the top of the layer down to its base (or out the other side of it), at most 90 km of it
  vec2 t = sphere(o, d, C, R + TOP), b = sphere(o, d, C, R + BASE);
  float t0 = max(t.x, 0.0), t1 = b.x > 0.0 ? b.x : t.y;
  vec3 acc = vec3(0.0); float T = 1.0;
  if (t.y > 0.0 && t1 > t0 && t0 < 260000.0) {
    float len = min(t1 - t0, 90000.0), n = steps, dt = len / n;
    float j = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    float cl = dot(d, litDir), ph = mix(hg(cl, 0.62), hg(cl, -0.25), 0.35) * 4.0 * PI;
    float dayAmb = smoothstep(-0.15, 0.3, sunDir.y);
    vec3 amb = mix(vec3(0.02, 0.025, 0.05), vec3(0.42, 0.52, 0.72), dayAmb) * mix(1.0, 0.75, smoothstep(0.3, 0.0, abs(sunDir.y)));
    float fd = 1.0 - exp(-t0 / 120000.0);
    for (int i = 0; i < 96; i++) {
      if (float(i) >= n || T < 0.02) break;
      float tt = t0 + (float(i) + j) * dt; vec3 p = d * tt; float h = length(p - C) - R;
      float den = cloud(p, h, steps > 40.0 ? 1.0 : 0.0);
      if (den > 0.002) {
        // light reaching this point through the cloud above it, towards the sun (or the moon)
        float sh = 0.0;
        for (int k = 1; k <= 6; k++) { if (float(k) > lsteps) break; vec3 q = p + litDir * (float(k * k) * 110.0); sh += cloud(q, length(q - C) - R, 0.0) * float(k) * 110.0; }
        float tl = exp(-sh * 0.0075), pw = 1.0 - exp(-den * 2.0);
        float hn = clamp((h - BASE) / (TOP - BASE), 0.0, 1.0);
        vec3 S = litCol * tl * ph * pw * 1.9 + amb * (0.35 + 0.65 * hn);
        float a = 1.0 - exp(-den * dt * 0.0105);
        acc += T * a * S; T *= 1.0 - a;
      }
    }
    // the haze of the distance on the clouds
    vec3 hz = skyCol(vec3(d.x, 0.0, d.z));
    acc = mix(acc, hz * (1.0 - T), fd * 0.85);
  }
  gl_FragColor = vec4(bg * T + acc, 1.0);
}`;

export interface Sky { dome: Mesh; mat: ShaderMaterial }
export function makeSky(sc: Scene): Sky {
  const dome = MeshBuilder.CreateSphere('sky', { diameter: 30000, segments: 24, sideOrientation: Mesh.BACKSIDE }, sc);
  dome.infiniteDistance = false; dome.isPickable = false; dome.renderingGroupId = 0;
  const mat = new ShaderMaterial('skyMat', sc, { vertex: 'amSky', fragment: 'amSky' }, {
    attributes: ['position'],
    uniforms: ['worldViewProjection', 'sunDir', 'sunCol', 'moonDir', 'litDir', 'litCol', 'alt', 'drift', 'time', 'cover', 'steps', 'lsteps', 'lat', 'lst', 'starK', 'nightK', 'gnd', 'landK', 'BASE', 'TOP'],
    samplers: ['stars'],
  });
  mat.backFaceCulling = false; mat.disableDepthWrite = true;
  mat.setTexture('stars', starTexture(sc));
  dome.material = mat;
  return { dome, mat };
}
/** The real stars painted on a map of the sky (right ascension across, declination up), their brightness and colour
 *  from the catalogue. */
function starTexture(sc: Scene): DynamicTexture {
  const W = 4096, H = 2048, t = new DynamicTexture('stars', { width: W, height: H }, sc, false, Texture.BILINEAR_SAMPLINGMODE);
  const x = t.getContext() as CanvasRenderingContext2D; x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
  // the Milky Way, faintly: a band along the galactic plane
  for (let l = 0; l < 360; l += 0.5) {
    const g = l * Math.PI / 180, b = 0, ra0 = 192.859 * Math.PI / 180, dec0 = 27.128 * Math.PI / 180, l0 = 122.932 * Math.PI / 180;
    const dec = Math.asin(Math.sin(dec0) * Math.sin(b) + Math.cos(dec0) * Math.cos(b) * Math.cos(l0 - g));
    const ra = ra0 + Math.atan2(Math.cos(b) * Math.sin(l0 - g), Math.cos(dec0) * Math.sin(b) - Math.sin(dec0) * Math.cos(b) * Math.cos(l0 - g));
    const px = (((ra * 180 / Math.PI) % 360 + 360) % 360) / 360 * W, py = (0.5 - (dec * 180 / Math.PI) / 180) * H;
    const k = 0.5 + 0.5 * Math.cos((l > 180 ? l - 360 : l) * Math.PI / 180), r = 60 + 50 * k;
    const gr = x.createRadialGradient(px, py, 0, px, py, r); gr.addColorStop(0, `rgba(150,160,190,${0.05 + 0.06 * k})`); gr.addColorStop(1, 'rgba(150,160,190,0)');
    x.fillStyle = gr; x.fillRect(px - r, py - r, r * 2, r * 2);
  }
  for (let i = 0; i < STARS.length; i += 4) {
    const ra = STARS[i], dec = STARS[i + 1], mag = STARS[i + 2], bv = STARS[i + 3];
    const px = ra / 360 * W, py = (0.5 - dec / 180) * H, br = Math.pow(10, -0.4 * (mag - 1.0)), r = 1.1 + Math.min(3.2, br * 1.6);
    const c = bvColour(bv), a = Math.min(1, 0.25 + br * 0.9);
    const g = x.createRadialGradient(px, py, 0, px, py, r * 1.8); g.addColorStop(0, `rgba(${c},${a})`); g.addColorStop(0.4, `rgba(${c},${a * 0.6})`); g.addColorStop(1, `rgba(${c},0)`);
    x.fillStyle = g; x.fillRect(px - r * 2, py - r * 2, r * 4, r * 4);
  }
  t.update(false); t.wrapU = Texture.WRAP_ADDRESSMODE; t.wrapV = Texture.CLAMP_ADDRESSMODE;
  return t;
}
/** A star's colour from its B–V index: blue-white hot stars to orange-red cool ones. */
function bvColour(bv: number): string {
  const k = Math.max(0, Math.min(1, (bv + 0.3) / 2.1));
  const r = Math.round(170 + 85 * Math.min(1, k * 1.6)), g = Math.round(190 + 50 * (1 - Math.abs(k - 0.35) * 1.6)), b = Math.round(255 - 150 * k);
  return `${r},${Math.max(140, Math.min(255, g))},${Math.max(90, b)}`;
}
/** Each frame: the sun, the moon, the light on the clouds, the camera's height, how far the ground has moved. */
export function skyFrame(s: Sky, o: { sun: number[]; sunCol: number[]; moon: number[]; lit: number[]; litCol: number[]; alt: number; drift: number[]; time: number; cover: number; steps: number; lsteps: number; lat: number; lst: number; starK: number; nightK: number; gnd?: number; landK?: number; base?: number; top?: number }) {
  const m = s.mat;
  m.setVector3('sunDir', new Vector3(o.sun[0], o.sun[1], o.sun[2])); m.setColor3('sunCol', new Color3(o.sunCol[0], o.sunCol[1], o.sunCol[2]));
  m.setVector3('moonDir', new Vector3(o.moon[0], o.moon[1], o.moon[2])); m.setVector3('litDir', new Vector3(o.lit[0], o.lit[1], o.lit[2]));
  m.setColor3('litCol', new Color3(o.litCol[0], o.litCol[1], o.litCol[2]));
  m.setFloat('alt', o.alt); m.setVector2('drift', new Vector2(o.drift[0], o.drift[1]));
  m.setFloat('time', o.time); m.setFloat('cover', o.cover); m.setFloat('BASE', o.base || 2100); m.setFloat('TOP', o.top || 5600); m.setFloat('steps', o.steps); m.setFloat('lsteps', o.lsteps);
  m.setFloat('lat', o.lat); m.setFloat('lst', o.lst); m.setFloat('starK', o.starK); m.setFloat('nightK', o.nightK); m.setFloat('gnd', o.gnd || 0); m.setFloat('landK', o.landK || 0);
}
