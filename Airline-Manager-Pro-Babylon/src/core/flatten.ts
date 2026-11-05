// Levelled ground under the things placed in the world. A flat zone is a footprint on the Earth (its middle's
// latitude and longitude, its heading, its half length and half width, or a radius), the height the ground is
// levelled to there, and how far out the ground slopes back to its own height (smoothly). Every terrain in the game
// (the airport site, the 3D viewer's ground) asks flatHeight() for each point it lays out, so wherever a model is put
// and a zone added for it, the ground under it is flat at the height the model sits at, anywhere in the world.
//
//   addFlatZone({ id, lat, lon, hdg, hu, hv, elev, blend })   a rectangle along hdg (true degrees)
//   addFlatZone({ id, lat, lon, r, elev, blend })            a circle
//   zoneForModel(node, frame, opts)                          the zone that fits a model's footprint
//   onFlatChange(fn)                                         a terrain is told, so it can lay its ground out again
const D2R = Math.PI / 180;
export interface FlatZone { id: string; lat: number; lon: number; hdg?: number; hu?: number; hv?: number; r?: number; elev: number; blend: number }
const zones: FlatZone[] = [], listeners: (() => void)[] = [];

export function addFlatZone(z: FlatZone) { const i = zones.findIndex(q => q.id === z.id); if (i >= 0) zones[i] = z; else zones.push(z); for (const f of listeners) f(); return z; }
export function removeFlatZone(id: string) { const i = zones.findIndex(q => q.id === id); if (i >= 0) { zones.splice(i, 1); for (const f of listeners) f(); } }
export function clearFlatZones(prefix = '') { for (let i = zones.length - 1; i >= 0; i--) if (zones[i].id.indexOf(prefix) === 0) zones.splice(i, 1); for (const f of listeners) f(); }
export function flatZones() { return zones.slice(); }
export function onFlatChange(fn: () => void) { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; }

/** How far (m) a place is outside a zone's footprint (0 inside it). */
function outside(z: FlatZone, lat: number, lon: number) {
  const e = (lon - z.lon) * 111320 * Math.cos(z.lat * D2R), n = (lat - z.lat) * 110540;
  if (z.r != null) return Math.max(0, Math.hypot(e, n) - z.r);
  const h = (z.hdg || 0) * D2R, u = e * Math.sin(h) + n * Math.cos(h), v = -e * Math.cos(h) + n * Math.sin(h);
  return Math.hypot(Math.max(0, Math.abs(u) - (z.hu || 0)), Math.max(0, Math.abs(v) - (z.hv || 0)));
}
/** The ground's height at a place once the zones have levelled it, and how much it was levelled (1 = fully flat). */
export function flatHeight(lat: number, lon: number, h: number): { h: number; k: number } {
  let k = 0;
  for (const z of zones) { const d = outside(z, lat, lon); if (d >= z.blend) continue;
    const t = d <= 0 ? 1 : 1 - d / z.blend, s = t * t * (3 - 2 * t); h = h * (1 - s) + z.elev * s; k = Math.max(k, s); }
  return { h, k };
}

/** The zone fitting a model's footprint: its bounding box seen from above, turned with it, plus a margin; levelled to
 *  the height given, or else to the middle of the ground's heights under it (heightAt gives the ground's own). */
export function zoneForModel(id: string, box: { cx: number; cz: number; hu: number; hv: number; hdg: number }, frame: { lat: number; lon: number },
  heightAt: (lat: number, lon: number) => number | null, opts: { elev?: number; margin?: number; blend?: number } = {}): FlatZone {
  const kx = 111320 * Math.cos(frame.lat * D2R), lat = frame.lat + box.cz / 110540, lon = frame.lon + box.cx / kx, m = opts.margin ?? 15;
  let elev = opts.elev;
  if (elev == null) { const hs: number[] = [], h = box.hdg * D2R; for (let a = -1; a <= 1.001; a += 0.25) for (let b = -1; b <= 1.001; b += 0.25) {
      const u = a * box.hu, v = b * box.hv, e = u * Math.sin(h) - v * Math.cos(h), n = u * Math.cos(h) + v * Math.sin(h), g = heightAt(lat + n / 110540, lon + e / kx); if (g != null) hs.push(g); }
    hs.sort((p, q) => p - q); elev = hs.length ? hs[Math.floor(hs.length / 2)] : 0; }
  return { id, lat, lon, hdg: box.hdg, hu: box.hu + m, hv: box.hv + m, elev, blend: opts.blend ?? Math.max(60, Math.min(700, (box.hu + box.hv) * 0.4)) };
}
