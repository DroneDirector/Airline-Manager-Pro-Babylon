// The demo flight's plan: Vágar (Faroe Islands) to Copenhagen along the great circle, in the cruise at flight
// level 300. Positions, headings and distances on the round Earth.
export const D2R = Math.PI / 180;
export interface Place { icao: string; name: string; lat: number; lon: number }
export const FROM: Place = { icao: 'EKVG', name: 'Vágar', lat: 62.0636, lon: -7.2772 };
export const TO: Place = { icao: 'EKCH', name: 'Copenhagen', lat: 55.6181, lon: 12.6561 };
const RE = 6371000;
/** Distance in metres. */
export function gcDist(a: number[], b: number[]): number {
  const p1 = a[0] * D2R, p2 = b[0] * D2R, dp = p2 - p1, dl = (b[1] - a[1]) * D2R;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * RE * Math.asin(Math.min(1, Math.sqrt(h)));
}
/** The point a share f of the way along the great circle (lat, lon). */
export function gcAt(a: number[], b: number[], f: number): number[] {
  const p1 = a[0] * D2R, l1 = a[1] * D2R, p2 = b[0] * D2R, l2 = b[1] * D2R, d = gcDist(a, b) / RE;
  if (d < 1e-9) return a.slice();
  const A = Math.sin((1 - f) * d) / Math.sin(d), B = Math.sin(f * d) / Math.sin(d);
  const x = A * Math.cos(p1) * Math.cos(l1) + B * Math.cos(p2) * Math.cos(l2), y = A * Math.cos(p1) * Math.sin(l1) + B * Math.cos(p2) * Math.sin(l2), z = A * Math.sin(p1) + B * Math.sin(p2);
  return [Math.atan2(z, Math.hypot(x, y)) / D2R, Math.atan2(y, x) / D2R];
}
/** The initial bearing from a to b (degrees from north). */
export function gcBrg(a: number[], b: number[]): number {
  const p1 = a[0] * D2R, p2 = b[0] * D2R, dl = (b[1] - a[1]) * D2R;
  return ((Math.atan2(Math.sin(dl) * Math.cos(p2), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl)) / D2R) + 360) % 360;
}
export const ROUTE_M = gcDist([FROM.lat, FROM.lon], [TO.lat, TO.lon]);
