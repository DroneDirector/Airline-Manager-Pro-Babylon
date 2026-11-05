// Wet runways in the 3D view: after rain or snow at the airport (from the real weather reports, or the simulator's
// when linked) the runways turn darker and glossier, and at night the runway and approach lights shine back from
// the wet surface as long streaks, as they do on a real wet runway. It dries out over about half an hour.

const V3D_WET = { value: 0 };
let _wetAt = 0, _wetWant = 0;
/** How wet the airport is now: 1 in rain or snow, less in drizzle or showers nearby, 0 dry. */
function v3dWetWant(icao: string): number {
  if (!icao || (State.settings as any).v3dWet === false) return 0;
  try {
    const m: any = LiveWx.get(icao), wx = String((m && (m.wx || m.raw)) || '');
    if (/\+RA|TSRA|\+SHRA|RA\b|SN\b|\+SN/.test(wx)) return 1;
    if (/DZ|SHRA|VCSH|FZRA|SG|PL/.test(wx)) return 0.7;
    if (/BR|FG/.test(wx) && m && m.temp != null && m.temp <= 2) return 0.4;
  } catch (e) { /* dry */ }
  return 0;
}
/** Each frame: the wetness eases towards the weather's (wet quickly, dry slowly), and the runways follow it. */
function v3dWetTick(now: number) {
  if (now - _wetAt > 20000) { _wetAt = now; _wetWant = v3dWetWant(V3d.icao); }
  const w = V3D_WET.value, k = _wetWant > w ? 0.02 : 0.0006;
  V3D_WET.value = w + (_wetWant - w) * k;
  const A: any = V3d.airport; if (!A || !A.userData.rwyMats) return;
  const c = 1 - 0.4 * V3D_WET.value;
  for (const m of A.userData.rwyMats) if (Math.abs(m.color.r - c) > 0.005) m.color.setScalar(c);
}
/** The lights seen in the wet surface: each runway light mirrored in the ground, placed where the line from the
 *  camera to its mirror image meets the surface, drawn as a streak. Shown only while it is wet. */
function v3dWetReflections(pos: number[], col: number[], gnd: number[]): any {
  if (!pos.length) return null;
  const T = THREE, U = v3dSkyUniforms(), geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new T.Float32BufferAttribute(col, 3));
  geo.setAttribute('aG', new T.Float32BufferAttribute(gnd, 1));
  const mat = new T.ShaderMaterial({
    uniforms: { uOn: U.uLightsOn, uGlow: U.uGlow, uWet: V3D_WET, uScale: U.uPxScale },
    transparent: true, depthWrite: false, blending: T.AdditiveBlending, vertexColors: true,
    vertexShader: `#include <common>
#include <logdepthbuf_pars_vertex>
attribute float aG; uniform float uScale; uniform float uWet; varying vec3 vCol; varying float vK;
void main() {
  vec3 L = (modelMatrix * vec4(position, 1.0)).xyz, C = cameraPosition;
  vec3 M = vec3(L.x, 2.0 * aG - L.y, L.z);                      // the light's mirror image under the surface
  float t = (C.y - aG) / max(0.01, C.y - M.y);
  vec3 P = C + (M - C) * clamp(t, 0.0, 1.0); P.y = aG + 0.08;    // where it is seen on the surface
  vec4 mv = viewMatrix * vec4(P, 1.0);
  vCol = color; vK = uWet * smoothstep(0.5, 3.0, C.y - aG);
  gl_PointSize = clamp(24.0 * uScale / max(1.0, -mv.z), 3.0, 120.0);
  gl_Position = projectionMatrix * mv;
  #include <logdepthbuf_vertex>
}`,
    fragmentShader: `#include <common>
#include <logdepthbuf_pars_fragment>
uniform float uOn; uniform float uGlow; varying vec3 vCol; varying float vK;
void main() {
  #include <logdepthbuf_fragment>
  vec2 d = gl_PointCoord - 0.5;
  float a = exp(-d.x * d.x * 700.0) * exp(-d.y * d.y * 16.0) * vK * uOn * max(uGlow, 0.3) * 0.5;   // a tall, thin streak
  if (a < 0.003) discard;
  gl_FragColor = vec4(vCol, a);
}`,
  });
  const pts = new T.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 19;
  return pts;
}
