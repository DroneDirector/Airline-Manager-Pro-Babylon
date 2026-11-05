// Where the sun and the moon are in the sky, for a place and a moment (low-precision formulas from the
// Astronomical Almanac, good to a fraction of a degree), and the sidereal time that turns the real stars with them.
const D2R = Math.PI / 180;
const norm = (d: number) => ((d % 360) + 360) % 360;

/** Days since 1 January 2000, 12:00 UTC. */
function days(ms: number): number { return ms / 86400000 + 2440587.5 - 2451545.0; }
/** Local sidereal time (degrees) at a longitude. */
export function lst(ms: number, lon: number): number { return norm(280.46061837 + 360.98564736629 * days(ms) + lon); }
/** Height above the horizon and the bearing (degrees, from north towards east) of a point in the sky. */
export function altAz(raDeg: number, decDeg: number, ms: number, lat: number, lon: number): { alt: number; az: number } {
  const H = (lst(ms, lon) - raDeg) * D2R, d = decDeg * D2R, p = lat * D2R;
  const alt = Math.asin(Math.sin(p) * Math.sin(d) + Math.cos(p) * Math.cos(d) * Math.cos(H));
  const az = Math.atan2(-Math.sin(H) * Math.cos(d), Math.cos(p) * Math.sin(d) - Math.sin(p) * Math.cos(d) * Math.cos(H));
  return { alt: alt / D2R, az: norm(az / D2R) };
}
function eqOf(lam: number, beta: number, n: number): { ra: number; dec: number } {
  const e = (23.439 - 0.0000004 * n) * D2R, l = lam * D2R, b = beta * D2R;
  const ra = Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l));
  const dec = Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l));
  return { ra: norm(ra / D2R), dec: dec / D2R };
}
export function sunAt(ms: number, lat: number, lon: number): { alt: number; az: number } {
  const n = days(ms), L = norm(280.460 + 0.9856474 * n), g = norm(357.528 + 0.9856003 * n) * D2R;
  const lam = L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g), q = eqOf(lam, 0, n);
  return altAz(q.ra, q.dec, ms, lat, lon);
}
export function moonAt(ms: number, lat: number, lon: number): { alt: number; az: number } {
  const n = days(ms), L0 = 218.316 + 13.176396 * n, M = (134.963 + 13.064993 * n) * D2R, F = (93.272 + 13.229350 * n) * D2R;
  const q = eqOf(norm(L0 + 6.289 * Math.sin(M)), 5.128 * Math.sin(F), n);
  return altAz(q.ra, q.dec, ms, lat, lon);
}
/** A point in the sky as a direction in the scene: x east, y up, z north. */
export function dirOf(p: { alt: number; az: number }): [number, number, number] {
  const a = p.alt * D2R, z = p.az * D2R;
  return [Math.cos(a) * Math.sin(z), Math.sin(a), Math.cos(a) * Math.cos(z)];
}
/** The colour of sunlight after the air it comes through (thicker and redder near the horizon), seen from height. */
export function sunlight(altDeg: number): [number, number, number] {
  if (altDeg < -4) return [0, 0, 0];
  const a = Math.max(altDeg, -3.5), m = 1 / (Math.sin(Math.max(a, 0.5) * D2R) + 0.15 * Math.pow(Math.max(0.1, a + 3.885), -1.253));
  const fade = altDeg < 0 ? Math.max(0, (altDeg + 4) / 4) : 1, k = 0.55;   // at 30,000 ft only part of the air is above
  return [Math.exp(-m * 0.035 * k) * fade, Math.exp(-m * 0.095 * k) * fade, Math.exp(-m * 0.24 * k) * fade];
}
