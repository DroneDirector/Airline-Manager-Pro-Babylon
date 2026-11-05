// Every seat in the courtroom, with its id: where a person's hips are, which way they face (yaw, the main game's way:
// 0 faces +z, towards the court), and whether they sit there. The game has the same list (game/src/ui/embed.ts,
// courtSeatsData): the hearing names seats by these ids.
export interface Seat { id: string; x: number; y: number; z: number; yaw: number; sit: number; row?: number; side?: number }
export const X0 = -8, X1 = 8, Z0 = -9, Z1 = 10.5, HH = 7.4, BAR = 1.6, DAIS = 0.75;
export function benchW(judges: number) { return judges > 3 ? 9.8 : 7.4; }
export function courtSeats(judges: number): { [id: string]: Seat } {
  const out: { [id: string]: Seat } = {}, add = (s: Seat) => { out[s.id] = s; };
  const bw = benchW(judges), fz = -6.6 + 0.85;
  for (let i = 0; i < judges; i++) add({ id: 'judge' + i, x: (i - (judges - 1) / 2) * (bw / judges) * 0.95, y: DAIS, z: fz - 0.95, yaw: 0, sit: 1 });
  add({ id: 'clerk', x: 0, y: 0, z: fz + 1.25 - 0.55, yaw: 0, sit: 1 });
  const wr = -0.55; add({ id: 'witness', x: 5.0 - 0.22 * Math.sin(wr), y: 0.3, z: -4.8 - 0.22 * Math.cos(wr), yaw: wr, sit: 1 });
  [-4.2, -2.8].forEach((x, i) => add({ id: 'pros' + i, x, y: 0, z: -1.15 + 0.98, yaw: Math.PI, sit: 1 }));
  [2.8, 4.2].forEach((x, i) => add({ id: 'def' + i, x, y: 0, z: -1.15 + 0.98, yaw: Math.PI, sit: 1 }));
  add({ id: 'fam', x: -6.3, y: 0, z: 0.9, yaw: Math.PI, sit: 1 });
  [[-2.1, Z1 - 0.7, Math.PI], [2.1, Z1 - 0.7, Math.PI], [6.9, -2.4, -Math.PI / 2 - 0.25]].forEach((p, i) => add({ id: 'police' + i, x: p[0], y: 0, z: p[1], yaw: p[2], sit: 0 }));
  let n = 0;
  for (let r = 0; r < 7; r++) { const hz = BAR + 1.2 + r * 1.02; for (const s of [-1, 1]) { const xa = s * 1.0, len = 6.3, k = Math.floor(len / 0.62); for (let i = 0; i < k; i++) add({ id: 'pub' + (n++), x: xa + s * (0.42 + i * (len - 0.6) / (k - 1)), y: 0, z: hz, yaw: Math.PI, sit: 1, row: r, side: s }); } }
  return out;
}
/** Where you can't walk: the bench and its dais, the clerk's desk, the witness box, the tables, the bar (but its gate,
 *  when it is open), the pews and the walls. */
export function courtBlocked(x: number, z: number, gateOpen: boolean): boolean {
  if (x < -7.6 || x > 7.6 || z < -8.6 || z > 10.1) return true;
  const B: number[][] = [[-4.6, -9, 4.6, -5.2], [-1.25, -5.0, 1.25, -3.6], [4.1, -5.8, 5.9, -3.8], [-5.2, -1.75, -1.8, -0.0], [1.8, -1.75, 5.2, -0.0], [-7.2, -0.5, -5.4, 1.2], [-8, 1.45, -0.85, 1.75], [0.85, 1.45, 8, 1.75]];
  for (const r of B) if (x > r[0] && x < r[2] && z > r[1] && z < r[3]) return true;
  if (Math.abs(x) < 0.85 && Math.abs(z - 1.6) < 0.14 && !gateOpen) return true;
  if (z > 2.55 && z < 2.55 + 7 * 1.02 && Math.abs(x) > 0.85 && Math.abs(x) < 7.45) { const rz = (z - 2.55) / 1.02 - Math.floor((z - 2.55) / 1.02); if (rz < 0.7) return true; }
  return false;
}
