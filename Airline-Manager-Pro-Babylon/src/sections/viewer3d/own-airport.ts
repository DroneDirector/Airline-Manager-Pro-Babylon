// Your own airport in the 3D viewer: Mýrdalssandur (BIAP / VTX) as it stands at its site, from the same plan and the
// same graphics (the airfield's ground, its markings, signs and lights, the cargo terminal, the fence), with the
// terminal as plain blocks; the real ground under it levelled inside the airport boundary, as at the site.
import { Scene, TransformNode, MeshBuilder, StandardMaterial, Color3 } from '@babylonjs/core';
import { IS_PC } from '../../core/app';
import { addFlatZone, removeFlatZone } from '../../core/flatten';
import { buildAirfield } from '../site/airfield/build';
import { AIRFIELD, designate } from '../site/airfield/plan';
import type { Airport, Layout } from './airport';

const D2R = Math.PI / 180;
/** Is this layout your own airport's (built from its plan, not from a map)? */
export function isOwnLayout(L: any): boolean { return !!(L && L.own && L.icao === AIRFIELD.airport.icao); }

export function buildOwnAirport(sc: Scene, L: Layout): Airport {
  const A = AIRFIELD.airport, R = AIRFIELD.runway, B = AIRFIELD.boundary, h = A.hdg * D2R, root = new TransformNode('airport-' + L.icao, sc);
  designate('08', '26');
  // the wide grass round it, where there is no real terrain (as every airport has)
  const far = MeshBuilder.CreateDisc('aptFar', { radius: 26000, tessellation: 64 }, sc); far.rotation.x = Math.PI / 2; far.position.y = -0.3; far.parent = root;
  const fm = new StandardMaterial('aptFarM', sc); fm.diffuseColor = Color3.FromHexString('#4A5236'); fm.specularColor = Color3.Black(); far.material = fm; far.renderingGroupId = 1; far.isPickable = false;
  // the plan's frame: u along the runway, v to its left; the layout's reference point is the runway's middle
  const frame = new TransformNode('airport-' + L.icao + '/FRAME', sc); frame.parent = root; frame.rotation.y = (A.hdg - 90) * D2R;
  const en = (u: number, v: number) => [u * Math.sin(h) - v * Math.cos(h), u * Math.cos(h) + v * Math.sin(h)];
  const uR = (R.x0 + R.x1) / 2 + A.planU, vR = R.y + A.planV, o = en(-uR, -vR); frame.position.set(o[0], 0, o[1]);
  const AFB = buildAirfield(sc, frame, { low: !IS_PC, massing: true }); AFB.step(0);
  // the real terrain levelled inside the boundary (blending within its outer 100 m), at the airport's height
  const zid = 'V3D/' + L.icao, cu = (B.x0 + B.x1) / 2 + A.planU - uR, cv = (B.y0 + B.y1) / 2 + A.planV - vR, c = en(cu, cv), kx = 111320 * Math.cos(L.lat * D2R), fl = AIRFIELD.flatten.blendInsideM;
  try { addFlatZone({ id: zid, lat: L.lat + c[1] / 110540, lon: L.lon + c[0] / kx, hdg: A.hdg, hu: (B.x1 - B.x0) / 2 - fl, hv: (B.y1 - B.y0) / 2 - fl, elev: L.alt || 0, blend: fl }); } catch (e) { /* the ground as it is */ }
  root.getChildMeshes().forEach(m => { m.renderingGroupId = 1; m.isPickable = false; });
  return { icao: L.icao, lat: L.lat, lon: L.lon, elev: L.alt || 0, root, lights: AFB.lights as any,
    dispose() { try { removeFlatZone(zid); } catch (e) { /* gone */ } try { AFB.dispose(); } catch (e) { /* gone */ } try { fm.dispose(); } catch (e) { /* gone */ } root.dispose(); } };
}
