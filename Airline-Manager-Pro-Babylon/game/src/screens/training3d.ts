/* The Training room (2.22, the Academy): a classroom off the staff corridor, west of it, opposite the Operations room.
 * Through inward-opening double doors from the corridor; always open to walk into, with or without a class.
 *  - The front is the west wall: the whiteboard, the teacher's desk and chair; two windows near the front (north wall).
 *  - 12 student desks in three rows of four, an aisle down the middle from the doors to the front, each with its chair.
 *  - On every desk the airline's notebook (its mark, its name and "Academy" below); pens of different colours, pencils,
 *    calculators and paper on some of them, never all the same.
 *  - Bookshelves along the south wall with aviation books (pilots, cabin crew, ground operations and more), a poster,
 *    a clock and plants.
 * Built in the building's own coordinates (metres: x east, z south). Many small things are drawn as instanced meshes,
 * so the room stays light on phones and tablets. */

const TRN_L = {
  x0: -14.6, x1: -5.6, z0: -18.5, z1: -11, h: 3.0,
  door: [-16.0, -14.2] as number[],             // the double doors, in the corridor's west wall (z)
  rows: [-11.0, -9.3, -7.6] as number[],        // the desks' rows (x), front to back
  cols: [-17.55, -16.7, -13.5, -12.65] as number[], // the desks' places across the room (z), the aisle between
  wins: [[-13.9, -12.1], [-11.3, -9.5]] as number[][],
};
/** Where each student sits (x, z, facing the front: west). */
function trnSeats(): number[][] { const out: number[][] = []; for (const x of TRN_L.rows) for (const z of TRN_L.cols) out.push([x + 0.58, z]); return out; }
const TRN_BOOKS = ['Principles of Flight', 'Piloting for Beginners', 'Becoming Cabin Crew', 'Ground Operations Handbook', 'Aviation Weather', 'Air Law',
  'Human Factors', 'Navigation', 'Aircraft Systems', 'Safety & Emergency Procedures', 'Ramp & Baggage Handling', 'Dangerous Goods', 'Radio Telephony',
  'First Aid on Board', 'Mass & Balance', 'Aircraft Maintenance Basics', 'Dispatch & Flight Planning', 'Customer Service in the Air'];

/** The airline's notebook cover: its mark, its name, and Academy below. */
function trnNotebookCanvas(): HTMLCanvasElement {
  const c = company(), acc = (c && c.color) || '#1E5AA8', name = (c && c.name) || 'Airline';
  const [cv, k] = ctCanvas(300, 420), w = 300;
  k.fillStyle = acc; k.fillRect(0, 0, w, 420); k.fillStyle = 'rgba(0,0,0,.18)'; k.fillRect(0, 0, 18, 420);
  k.save(); k.translate(w / 2 + 9, 140); k.beginPath(); k.arc(0, 0, 64, 0, Math.PI * 2); k.lineWidth = 4; k.strokeStyle = 'rgba(255,255,255,.6)'; k.stroke();
  k.fillStyle = '#fff'; k.beginPath(); const s = 64 / 14.5;
  for (const [a, b] of [[0, -11.5], [2, -2], [11.5, 0], [2, 2], [0, 11.5], [-2, 2], [-11.5, 0], [-2, -2]]) k.lineTo(a * s, b * s);
  k.closePath(); k.fill(); k.restore();
  k.textAlign = 'center'; k.fillStyle = '#fff'; let fs = 34; k.font = `700 ${fs}px Inter, Arial, sans-serif`;
  while (k.measureText(name).width > w - 50 && fs > 16) { fs -= 2; k.font = `700 ${fs}px Inter, Arial, sans-serif`; }
  k.fillText(name, w / 2 + 9, 270); k.font = '600 30px Inter, Arial, sans-serif'; k.fillStyle = 'rgba(255,255,255,.85)'; k.fillText('Academy', w / 2 + 9, 315);
  return cv;
}
/** A book's front cover. */
function trnCoverCanvas(title: string, col: string): HTMLCanvasElement {
  const [cv, k] = ctCanvas(300, 400), w = 300; k.fillStyle = col; k.fillRect(0, 0, w, 400);
  k.fillStyle = 'rgba(255,255,255,.93)'; k.fillRect(18, 18, w - 36, 128); k.fillStyle = '#111'; k.font = '700 32px Inter, Arial, sans-serif';
  let line = '', y = 62; for (const wd of title.split(' ')) { if (k.measureText(line + wd).width > w - 64) { k.fillText(line, 30, y); y += 38; line = ''; } line += wd + ' '; } k.fillText(line, 30, y);
  k.strokeStyle = '#fff'; k.lineWidth = 7; k.beginPath(); k.moveTo(60, 300); k.lineTo(240, 252); k.moveTo(130, 232); k.lineTo(168, 334); k.stroke();
  return cv;
}

function trTraining(scene: any, q: number) {
  const R = TestRooms, T = THREE, L = TRN_L, g = new T.Group(); scene.add(g); R.trn = { g, people: {} };
  const shadow = q >= 2, c = company(), acc = (c && c.color) || '#1E5AA8', name = (c && c.name) || 'Airline';
  const M = (o: any) => new T.MeshStandardMaterial(Object.assign({ roughness: 0.7 }, o));
  const box = (w: number, h: number, d: number, m: any, x: number, y: number, z: number, ry = 0, par: any = g) => { const o = new T.Mesh(new T.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.rotation.y = ry; o.castShadow = shadow; o.receiveShadow = true; par.add(o); return o; };
  const carpet = M({ map: ctTex(ctNoise('#4C5A6B', 0.07, 31), 6, 5), roughness: 0.95 });
  const wall = M({ color: 0xEDEBE5, roughness: 0.9 }), wood = M({ color: 0xC49A6C, roughness: 0.55 }), shelfWood = M({ color: 0xA67C52, roughness: 0.6 });
  const metal = M({ color: 0x3A4048, roughness: 0.4, metalness: 0.6 }), frame = M({ color: 0x2E343B, roughness: 0.5, metalness: 0.3 });
  const glass = new T.MeshStandardMaterial({ color: 0xCFE6F5, roughness: 0.05, transparent: true, opacity: 0.22, depthWrite: false });
  // floor and ceiling
  box(L.x1 - L.x0, 0.02, L.z1 - L.z0, carpet, (L.x0 + L.x1) / 2, -0.01, (L.z0 + L.z1) / 2);
  box(L.x1 - L.x0, 0.04, L.z1 - L.z0, M({ color: 0xF5F5F3, roughness: 0.9, emissive: 0xF2F0EA, emissiveIntensity: 0.06 }), (L.x0 + L.x1) / 2, L.h + 0.02, (L.z0 + L.z1) / 2);
  const lamp = new T.MeshBasicMaterial({ color: 0xFFFBF0, toneMapped: false });
  for (const x of [-12.6, -9.6, -7.0]) for (const z of [-16.6, -13.0]) box(1.2, 0.02, 0.6, lamp, x, L.h - 0.01, z);
  // walls: openings for the windows (north) and the doors (east, the corridor's wall: its room side)
  const wx = (x0: number, x1: number, z: number, holes: number[][]) => { let x = x0; for (const [a, b, top, bot] of holes) { if (a > x) box(a - x, L.h, 0.12, wall, (x + a) / 2, L.h / 2, z); box(b - a, L.h - top, 0.12, wall, (a + b) / 2, top + (L.h - top) / 2, z); if (bot) box(b - a, bot, 0.12, wall, (a + b) / 2, bot / 2, z); x = b; } if (x1 > x) box(x1 - x, L.h, 0.12, wall, (x + x1) / 2, L.h / 2, z); };
  const wz = (z0: number, z1: number, x: number, holes: number[][]) => { let z = z0; for (const [a, b, top] of holes) { if (a > z) box(0.12, L.h, a - z, wall, x, L.h / 2, (z + a) / 2); box(0.12, L.h - top, b - a, wall, x, top + (L.h - top) / 2, (a + b) / 2); z = b; } if (z1 > z) box(0.12, L.h, z1 - z, wall, x, L.h / 2, (z + z1) / 2); };
  wx(L.x0, L.x1, L.z0 - 0.06, L.wins.map(w => [w[0], w[1], 2.35, 0.85]));
  wx(L.x0, L.x1, L.z1 + 0.06, []);
  wz(L.z0, L.z1, L.x0 - 0.06, []);
  wz(L.z0, L.z1, L.x1 - 0.08, [[L.door[0], L.door[1], 2.25]]);
  // a skirting along the walls, stopping at the doors and their frame
  const skirt = M({ color: 0x3A3F46, roughness: 0.6 });
  box(L.x1 - L.x0, 0.08, 0.015, skirt, (L.x0 + L.x1) / 2, 0.04, L.z0 + 0.008); box(L.x1 - L.x0, 0.08, 0.015, skirt, (L.x0 + L.x1) / 2, 0.04, L.z1 - 0.008);
  box(0.015, 0.08, L.z1 - L.z0, skirt, L.x0 + 0.008, 0.04, (L.z0 + L.z1) / 2);
  box(0.015, 0.08, L.door[0] - 0.1 - L.z0, skirt, L.x1 - 0.15, 0.04, (L.z0 + L.door[0] - 0.1) / 2); box(0.015, 0.08, L.z1 - L.door[1] - 0.1, skirt, L.x1 - 0.15, 0.04, (L.door[1] + 0.1 + L.z1) / 2);
  // the windows: frames, glass, sills, and a view out over the apron
  for (const [a, b] of L.wins) {
    box(b - a, 0.05, 0.28, M({ color: 0xF4F4F2 }), (a + b) / 2, 0.86, L.z0 + 0.1);
    for (const x of [a, (a + b) / 2, b]) box(0.06, 1.5, 0.1, frame, x, 1.6, L.z0 - 0.06);
    box(b - a, 0.06, 0.1, frame, (a + b) / 2, 2.35, L.z0 - 0.06); box(b - a, 0.06, 0.1, frame, (a + b) / 2, 0.85, L.z0 - 0.06);
    const gl = new T.Mesh(new T.PlaneGeometry(b - a, 1.5), glass); gl.position.set((a + b) / 2, 1.6, L.z0 - 0.06); g.add(gl);
  }
  { const [cv, k] = ctCanvas(1024, 440), w = 1024, h = 440, gr = k.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#7FB2E0'); gr.addColorStop(0.55, '#D6E8F4'); gr.addColorStop(0.62, '#8E9AA3'); gr.addColorStop(1, '#5F676C'); k.fillStyle = gr; k.fillRect(0, 0, w, h);
    k.fillStyle = '#C9CFD4'; k.fillRect(0, 262, w, 6); k.fillStyle = '#AEB7BE'; for (let i = 0; i < 9; i++) k.fillRect(60 + i * 110, 200 - (i % 3) * 14, 70, 62 + (i % 3) * 14);
    const v = new T.Mesh(new T.PlaneGeometry(14, 6), new T.MeshBasicMaterial({ map: ctTex(cv), toneMapped: false })); v.position.set(-11, 1.8, L.z0 - 3); g.add(v); }
  // ---- the things in the room: each kind has its own file name (training-props/<name>.glb, see Models). Without the
  // file, the app's own, drawn as one instanced mesh per part (light on phones and tablets); with it, the file's model
  // in each place, fitted to the size of the app's own.
  const mm = new T.Matrix4(), qq = new T.Quaternion(), up = new T.Vector3(0, 1, 0);
  const P = (x: number, y: number, z: number, ry = 0, sx = 1, sy = 1, sz = 1, rz = 0) => new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(0, ry, rz, 'YXZ')), new T.Vector3(sx, sy, sz));
  const part = (geo: any, mat: any, x = 0, y = 0, z = 0, ry = 0, tint = false) => ({ geo, mat, m: new T.Matrix4().compose(new T.Vector3(x, y, z), qq.setFromAxisAngle(up, ry).clone(), new T.Vector3(1, 1, 1)), tint });
  /** One kind of thing in many places: parts (in the thing's own coordinates, front towards +Z, on the floor or the
   *  desk at y = 0), places (matrices), and a colour for each place for the tinted parts. Returns the groups made
   *  (with a file) or the instanced meshes (without). */
  const kind = (name: string, parts: any[], places: any[], cols?: any[]) => {
    const path = 'training-props/' + name + '.glb', out: any[] = [];
    if (!places.length) return out;
    if (Models.has(path)) {
      places.forEach((pm, i) => {
        const grp = new T.Group(); grp.name = name; pm.decompose(grp.position, grp.quaternion, grp.scale);
        for (const pt of parts) { const o = new T.Mesh(pt.geo, pt.tint && cols ? pt.mat.clone() : pt.mat); if (pt.tint && cols) o.material.color = new T.Color(cols[i]); pt.m.decompose(o.position, o.quaternion, o.scale); o.castShadow = shadow; o.receiveShadow = true; grp.add(o); }
        g.add(grp); Models.swap(grp, path, false); out.push(grp);
      });
      return out;
    }
    for (const pt of parts) {
      const I = new T.InstancedMesh(pt.geo, pt.mat, places.length); I.name = name; I.castShadow = shadow; I.receiveShadow = true;
      places.forEach((pm, i) => { I.setMatrixAt(i, mm.multiplyMatrices(pm, pt.m)); if (pt.tint && cols) I.setColorAt(i, new T.Color(cols[i])); });
      I.instanceMatrix.needsUpdate = true; if (I.instanceColor) I.instanceColor.needsUpdate = true; g.add(I); out.push(I);
    }
    return out;
  };
  // the double doors: they open inwards, into the room (each leaf: training-props/double-door-leaf.glb)
  const dw = (L.door[1] - L.door[0]) / 2, doorM = M({ color: 0x8A6A4A, roughness: 0.5 }), steel = M({ color: 0xC9CDD2, roughness: 0.3, metalness: 0.8 });
  const leaves: any[] = [];
  for (const s of [-1, 1]) {
    const pv = new T.Group(); pv.position.set(L.x1 - 0.1, 0, s < 0 ? L.door[0] + 0.02 : L.door[1] - 0.02); g.add(pv);
    const leaf = new T.Group(); leaf.name = 'double-door-leaf'; pv.add(leaf);
    box(0.05, 2.2, dw - 0.03, doorM, -0.025, 1.1, -s * (dw - 0.03) / 2, 0, leaf);
    const gl = new T.Mesh(new T.PlaneGeometry(dw * 0.5, 0.85), glass); gl.position.set(-0.025, 1.45, -s * dw / 2); gl.rotation.y = Math.PI / 2; leaf.add(gl);
    for (const f of [-1, 1]) box(0.04, 0.03, 0.03, steel, -0.025 + f * 0.05, 1.0, -s * (dw - 0.14), 0, leaf);   // a handle on each side
    try { Models.swap(leaf, 'training-props/double-door-leaf.glb', false); } catch (e) { /* the app's own */ }
    leaves.push({ pv, s });
    const hit = new T.Mesh(new T.BoxGeometry(0.3, 2.1, dw), new T.MeshBasicMaterial({ visible: false })); hit.position.set(0, 1.05, -s * dw / 2); hit.userData.act = 'door'; hit.userData.room = 'training'; hit.userData.keep = true; pv.add(hit); R.hits.push(hit);
  }
  for (const xx of [L.x1 - 0.12, L.x1 + 0.02]) {   // the frame, on both sides of the wall
    box(0.06, 2.28, 0.08, frame, xx, 1.14, L.door[0] - 0.04); box(0.06, 2.28, 0.08, frame, xx, 1.14, L.door[1] + 0.04);
    box(0.06, 0.08, L.door[1] - L.door[0] + 0.16, frame, xx, 2.26, (L.door[0] + L.door[1]) / 2);
  }
  R.doors.push({ k: 'training', name: 'the training room', mat: 'wood', k0: 0, to: 0, n: 'x', mid: [L.x1, (L.door[0] + L.door[1]) / 2], half: dw,
    set: (e: number) => { for (const Lf of leaves) Lf.pv.rotation.y = Lf.s * e * 1.4; },
    pass: [L.x1 - 0.5, L.door[0] + 0.12, L.x1 + 0.45, L.door[1] - 0.12] });
  // the sign beside the doors (corridor side)
  Props.place(g, 'room-sign', L.x1 + 0.03, L.door[1] + 0.42, Math.PI / 2, q, { name: 'Training\nroom', sub: 'Academy', num: '2.22', pict: 'ops', staff: true }, 1.25);
  // the whiteboard (the west wall) with a lesson on it
  { const [cv, k] = ctCanvas(1200, 400);
    k.fillStyle = '#FBFBF8'; k.fillRect(0, 0, 1200, 400); k.strokeStyle = '#2B5AA8'; k.lineWidth = 5; k.fillStyle = '#2B5AA8'; k.font = '700 46px "Comic Sans MS", Arial, sans-serif'; k.fillText('Principles of flight', 40, 70);
    k.beginPath(); k.moveTo(120, 230); k.quadraticCurveTo(330, 140, 560, 220); k.quadraticCurveTo(330, 260, 120, 230); k.stroke();
    k.fillStyle = '#C0392B'; k.font = '34px Arial, sans-serif'; k.fillText('lift ↑', 300, 140); k.fillText('drag ←', 40, 300); k.fillText('thrust →', 470, 300); k.fillText('weight ↓', 280, 340);
    k.fillStyle = '#222'; k.font = '32px Arial, sans-serif'; k.fillText('L = ½ ρ v² S CL', 700, 180); k.fillText('V1 · VR · V2', 700, 250);
    const boardTex = ctTex(cv);
    // its writing is the app's: a model's material named "board" shows it
    R.trn.boardTex = boardTex;
    R.trn.board = kind('whiteboard', [part(new T.PlaneGeometry(3.6, 1.2), new T.MeshStandardMaterial({ map: boardTex, roughness: 0.3 }), 0, 1.55, 0.03), part(new T.BoxGeometry(3.68, 1.28, 0.03), M({ color: 0xB8BEC4, metalness: 0.5, roughness: 0.4 }), 0, 1.55, 0),
      part(new T.BoxGeometry(3.6, 0.04, 0.12), M({ color: 0x9AA0A6 }), 0, 0.93, 0.07)], [P(L.x0 + 0.01, 0, -15.1, Math.PI / 2)]); }
  // the teacher's desk and chair
  const dk = M({ color: 0x5A616A, roughness: 0.6 }), seatM = M({ color: new T.Color(acc).multiplyScalar(0.8), roughness: 0.6 });
  kind('teacher-desk', [part(new T.BoxGeometry(1.6, 0.05, 0.75), wood, 0, 0.75, 0), part(new T.BoxGeometry(0.05, 0.72, 0.7), dk, -0.78, 0.37, 0), part(new T.BoxGeometry(0.05, 0.72, 0.7), dk, 0.78, 0.37, 0),
    part(new T.BoxGeometry(1.5, 0.6, 0.04), dk, 0, 0.45, -0.34)], [P(-13.0, 0, -15.1, -Math.PI / 2)]);
  const chairParts = (m: any) => [part(new T.BoxGeometry(0.44, 0.04, 0.42), m, 0, 0.46, 0), part(new T.BoxGeometry(0.44, 0.42, 0.03), m, 0, 0.7, -0.2),
    ...[[-0.19, -0.17], [0.19, -0.17], [-0.19, 0.17], [0.19, 0.17]].map(([a, b]) => part(new T.BoxGeometry(0.025, 0.46, 0.025), metal, a, 0.23, b))];
  kind('teacher-chair', chairParts(M({ color: 0x2C3440, roughness: 0.6 })), [P(-13.75, 0, -15.1, Math.PI / 2)]);
  // the students' desks and chairs (front of a desk: the side the student sits at)
  const seats = trnSeats(), deskP: any[] = [], chairP: any[] = [];
  for (const x of TRN_L.rows) for (const z of TRN_L.cols) { deskP.push(P(x, 0, z, Math.PI / 2)); chairP.push(P(x + 0.62, 0, z, -Math.PI / 2)); }
  kind('student-desk', [part(new T.BoxGeometry(0.78, 0.04, 0.55), M({ color: 0xE6E2D8, roughness: 0.6 }), 0, 0.74, 0),
    ...[[-0.36, -0.24], [0.36, -0.24], [-0.36, 0.24], [0.36, 0.24]].map(([a, b]) => part(new T.BoxGeometry(0.03, 0.72, 0.03), metal, a, 0.36, b))], deskP);
  kind('student-chair', chairParts(seatM), chairP);
  // what is on each desk: the notebook always (the same everywhere), the rest differs from desk to desk
  const nbTex = ctTex(trnNotebookCanvas()), paperW = M({ color: 0xF4F1EA }); R.trn.nbTex = nbTex;
  const pens = ['#1F3A93', '#111111', '#C0392B', '#27AE60', '#8E44AD', '#2E86C1'];
  const rnd = (i: number, k: number) => ((i * 7919 + k * 104729 + 13) % 1000) / 1000;
  const nbP: any[] = [], penP: any[] = [], penC: string[] = [], pencilP: any[] = [], calcP: any[] = [], paperP: any[] = [];
  seats.forEach((s, i) => {
    const x = s[0] - 0.58, z = s[1];
    nbP.push(P(x + 0.05, 0.761, z - 0.12, Math.PI / 2 + (i % 3 - 1) * 0.12));
    if (rnd(i, 1) < 0.75) { penP.push(P(x + 0.02, 0.761, z + 0.15, rnd(i, 3) * 2)); penC.push(pens[Math.floor(rnd(i, 2) * pens.length)]); }
    if (rnd(i, 4) < 0.5) pencilP.push(P(x - 0.12, 0.761, z + 0.22, 0.4 + rnd(i, 5)));
    if (rnd(i, 6) < 0.45) calcP.push(P(x - 0.1, 0.761, z + 0.05, rnd(i, 9) - 0.5 + Math.PI / 2));
    if (rnd(i, 7) < 0.6) paperP.push(P(x - 0.05, 0.761, z + 0.2, rnd(i, 8) - 0.5));
  });
  R.trn.notebooks = kind('academy-notebook', [part(new T.BoxGeometry(0.21, 0.012, 0.29), [paperW, paperW, M({ map: nbTex, roughness: 0.6 }), M({ color: 0xEDE9E0 }), paperW, paperW], 0, 0.006, 0)], nbP);
  kind('pen', [part(new T.CylinderGeometry(0.005, 0.005, 0.14, 8).rotateZ(Math.PI / 2), M({ color: 0xffffff, roughness: 0.4 }), 0, 0.005, 0, 0, true)], penP, penC);
  kind('pencil', [part(new T.CylinderGeometry(0.004, 0.004, 0.17, 6).rotateZ(Math.PI / 2), M({ color: 0xF4D03F }), 0, 0.004, 0)], pencilP);
  kind('calculator', [part(new T.BoxGeometry(0.09, 0.012, 0.15), M({ color: 0x2C2F33, roughness: 0.5 }), 0, 0.006, 0), part(new T.BoxGeometry(0.07, 0.003, 0.04), M({ color: 0x9FB89A, emissive: 0x223322 }), 0, 0.013, -0.04)], calcP);
  kind('paper-sheet', [part(new T.BoxGeometry(0.21, 0.002, 0.297), M({ color: 0xFFFFFF, roughness: 0.9 }), 0, 0.001, 0)], paperP);
  // the bookshelves (south wall), full of aviation books
  const spineCols = ['#1F4E79', '#B03A2E', '#F1C40F', '#117A65', '#6C3483', '#D35400', '#2E4053', '#7D6608', '#1ABC9C', '#922B21'];
  const shelfP: any[] = [], bookP: any[] = [], bookC: string[] = [];
  for (const [sx0, sx1] of [[-13.9, -11.2], [-8.6, -5.9]]) {
    shelfP.push(P((sx0 + sx1) / 2, 0, L.z1 - 0.2, Math.PI, (sx1 - sx0) / 2.7));
    for (let s = 0; s < 5; s++) { const y = 0.12 + s * 0.4; let x = sx0 + 0.08, i = s * 7 + Math.round(sx0);
      while (x < sx1 - 0.12) { const k2 = Math.abs(i), bw = 0.035 + ((k2 * 37) % 5) * 0.008, bh = 0.24 + ((k2 * 13) % 5) * 0.025;
        bookP.push(P(x + bw / 2, y + 0.015, L.z1 - 0.26, Math.PI, bw / 0.04, bh / 0.26, 1, k2 % 11 === 0 ? 0.16 : 0)); bookC.push(spineCols[k2 % spineCols.length]); x += bw + 0.004; i++; } }
  }
  kind('bookshelf', [part(new T.BoxGeometry(2.7, 2.0, 0.04), wood, 0, 1.0, -0.15), part(new T.BoxGeometry(0.04, 2.0, 0.34), wood, -1.33, 1.0, 0), part(new T.BoxGeometry(0.04, 2.0, 0.34), wood, 1.33, 1.0, 0),
    ...[0, 1, 2, 3, 4, 5].map(i => part(new T.BoxGeometry(2.64, 0.03, 0.3), shelfWood, 0, 0.105 + i * 0.4 - (i === 5 ? 0.11 : 0), -0.02))], shelfP);
  kind('book', [part(new T.BoxGeometry(0.04, 0.26, 0.22), M({ color: 0xffffff, roughness: 0.8 }), 0, 0.13, 0, 0, true)], bookP, bookC);
  // books facing out on the shelves and on the teacher's desk, their covers readable (training-props/book-cover.glb:
  // a material named "cover" shows the app's cover)
  const white = M({ color: 0xffffff });
  const covers: [string, string, any][] = [['Piloting for Beginners', '#1F4E79', P(-12.9, 1.71, L.z1 - 0.13, Math.PI)], ['Becoming Cabin Crew', '#B03A2E', P(-12.62, 1.71, L.z1 - 0.13, Math.PI)],
    ['Ground Operations Handbook', '#117A65', P(-7.4, 1.71, L.z1 - 0.13, Math.PI)], ['Principles of Flight', '#2E4053', new T.Matrix4().compose(new T.Vector3(-13.05, 0.79, -14.55), new T.Quaternion().setFromEuler(new T.Euler(-Math.PI / 2, Math.PI / 2 + 0.2, 0, 'YXZ')), new T.Vector3(1, 1, 1))]];
  R.trn.covers = [];
  for (const [t, col, pm] of covers) { const tex = ctTex(trnCoverCanvas(t, col));
    const o = kind('book-cover', [part(new T.BoxGeometry(0.21, 0.28, 0.025), [white, white, white, white, M({ map: tex, roughness: 0.7 }), M({ color: new T.Color(col) })], 0, t === 'Principles of Flight' ? 0 : 0.14, 0)], [pm]);
    R.trn.covers.push([o, tex]); }
  // a poster and a clock (the hands are the app's: they keep the time)
  { const [cv, k] = ctCanvas(500, 350), gr = k.createLinearGradient(0, 0, 0, 350); gr.addColorStop(0, acc); gr.addColorStop(1, '#0B1A2B'); k.fillStyle = gr; k.fillRect(0, 0, 500, 350);
    k.fillStyle = '#fff'; k.font = '700 40px Inter, Arial, sans-serif'; k.fillText(name.slice(0, 22), 30, 70); k.font = '600 30px Inter, Arial, sans-serif'; k.fillText('Academy', 30, 112);
    k.font = '22px Inter, Arial, sans-serif'; k.fillText('Pilots · Cabin crew · Ground operations', 30, 310);
    k.save(); k.translate(330, 210); k.rotate(-0.3); k.fillRect(-120, -8, 240, 16); k.fillRect(-14, -70, 28, 140); k.fillRect(-120, -34, 14, 34); k.restore();
    kind('poster', [part(new T.PlaneGeometry(1.0, 0.7), new T.MeshStandardMaterial({ map: ctTex(cv), roughness: 0.5 }), 0, 0, 0.005), part(new T.BoxGeometry(1.04, 0.74, 0.01), frame, 0, 0, 0)], [P(-9.8, 1.65, L.z1 - 0.01, Math.PI)]); }
  { const [cv, k] = ctCanvas(200, 200); k.fillStyle = '#fff'; k.beginPath(); k.arc(100, 100, 96, 0, 7); k.fill(); k.lineWidth = 8; k.strokeStyle = '#222'; k.stroke();
    for (let i = 0; i < 12; i++) { const a2 = i / 12 * Math.PI * 2; k.fillStyle = '#222'; k.fillRect(100 + Math.sin(a2) * 78 - 3, 100 - Math.cos(a2) * 78 - 3, 6, 6); }
    kind('wall-clock', [part(new T.CircleGeometry(0.17, 32), new T.MeshStandardMaterial({ map: ctTex(cv), roughness: 0.4 }), 0, 0, 0.012), part(new T.CylinderGeometry(0.18, 0.18, 0.024, 32).rotateX(Math.PI / 2), frame, 0, 0, 0)], [P(L.x1 - 0.14, 2.45, -13.0, -Math.PI / 2)]);
    const hand = (len: number, wdt: number) => { const h2 = new T.Mesh(new T.BoxGeometry(0.004, len, wdt), M({ color: 0x111111 })); h2.geometry.translate(0, len / 2, 0); h2.position.set(L.x1 - 0.17, 2.45, -13.0); g.add(h2); return h2; };
    R.trn.clock = [hand(0.09, 0.012), hand(0.13, 0.008)]; }
  for (const [x, z, sd] of [[-14.1, -11.5, 3], [-6.1, -18.0, 5]] as number[][]) { try { Props.place(g, 'plant-3', x, z, 0, q, { seed: sd }); } catch (e) { /* no plant */ } }
  // light: the panels glow; real lamps on the higher settings, a soft fill on the lighter ones
  if (q >= 1) for (const x of [-12.6, -8.6]) { const P = new T.PointLight(0xFFF4E2, q >= 2 ? 9 : 13, 10, 2); P.position.set(x, L.h - 0.3, -14.8); g.add(P); }
  // walking: the room, round the desks, the teacher's desk and the shelves
  const r = 0.26;
  R.walk.unshift((x: number, z: number) => {
    if (!(x > L.x0 + r && x < L.x1 - r && z > L.z0 + r && z < L.z1 - r - 0.32)) return false;
    if (x > -13.45 - r && x < -12.6 + r && z > -15.95 - r && z < -14.25 + r) return false;   // the teacher's desk
    for (const xr of TRN_L.rows) for (const zc of TRN_L.cols) if (x > xr - 0.3 - r * 0.6 && x < xr + 0.3 + r * 0.4 && z > zc - 0.4 - r * 0.6 && z < zc + 0.4 + r * 0.6) return false;   // the desks
    return true;
  });
  R.trn.seats = seats;
}
/** A model from a file keeps the app's own pictures: the airline's notebook cover, the books' covers and the lesson on
 *  the board go on its materials named "cover" (or "board"). */
function trnPictures() {
  const R = TestRooms, N = R.trn; if (!N) return;
  const put = (objs: any[], tex: any, mat: string) => { for (const o of objs || []) if (o && o.isGroup) o.traverse((m: any) => { if (m.isMesh && m.material && !Array.isArray(m.material) && m.material.name === mat && m.material.map !== tex) { m.material.map = tex; m.material.needsUpdate = true; } }); };
  put(N.notebooks, N.nbTex, 'cover'); put(N.board, N.boardTex, 'board');
  for (const [o, tex] of N.covers || []) put(o, tex, 'cover');
}
/** The clock on the wall keeps the time. */
function trnStep(dt = 0, now = 0) {
  const R = TestRooms, C = R.trn && R.trn.clock; if (!C) return;
  try { trnClassStep(dt, now); } catch (e) { /* the class waits */ }
  if (!R.trn.picAt || performance.now() - R.trn.picAt > 2000) { R.trn.picAt = performance.now(); try { trnPictures(); } catch (e) { /* the file's own */ } }
  const d = new Date(), h = (d.getHours() % 12 + d.getMinutes() / 60) / 12 * Math.PI * 2, m = d.getMinutes() / 60 * Math.PI * 2;
  C[0].rotation.x = h; C[1].rotation.x = m;   // seen from the room (looking east), clockwise
}

/* ---------- the class: the people on a course, in their seats, and the teacher ---------- */
// The students are the people you hired, as they are (their own names and looks): everyone on a course, up to 12,
// the longest there first. They sit at their desks, swaying a little, and look at the teacher. The teacher talks all
// through the lesson, about what this class is learning (pilots, cabin crew, mechanics or ground staff), and goes
// round his routine: he looks at the class for a few seconds, then down at the book in his hand, back up, over to the
// window to look out (still talking), back behind his desk to sit for three to four minutes, up again with the book
// to read from it for 27 seconds, and from the start. Click him (or a student) to see what is said; his voice is
// heard while you are in the room.
const TRN_TEACHER = { name: 'Daniel Brandt', title: 'Instructor, the Academy', sex: 'm' as 'm' | 'f' };
const TRN_LESSONS: { [who: string]: string[] } = {
  pilot: [
    'Good morning, everyone. Today we look at what keeps the aircraft safe when things stop going to plan.',
    'Let us start with the take-off. V one is the speed at which you are committed. After it, you go, whatever happens.',
    'Below V one, a serious failure means you stop. Above it, you fly the aircraft, you climb, and then you sort it out.',
    'Rotate at V R, smoothly, to the attitude in your briefing. Not faster: you risk a tail strike.',
    'If an engine fails after V one, keep it straight with the rudder. Dead foot, dead engine.',
    'Climb at V two until you are clear of obstacles, then accelerate and clean up the flaps.',
    'Now, crew resource management. The best captains ask the first officer what they think, and listen to the answer.',
    'When something unusual happens, aviate first, then navigate, then communicate. In that order, every time.',
    'An upset: the nose is high and the speed is falling. Push. Unload the wing first, then roll level, then recover.',
    'Read the checklist out loud, and wait for the answer. Silence is not an answer.',
    'Weather. A thunderstorm is never worth it. Twenty miles round it, and never underneath.',
    'Fuel. Land with your final reserve still in the tanks. If you might not, declare it early.',
    'Right. Open your books at the chapter on stabilised approaches. One thousand feet, stable, or we go around.',
  ],
  fa: [
    'Good morning, everyone. Today is about safety, the reason you are on board.',
    'Before every flight you check your emergency equipment: the oxygen, the extinguishers, the torch and the first aid kit.',
    'Your door is armed before push-back. If it opens now, the slide inflates, so cross-check with your colleague.',
    'In an evacuation you have ninety seconds. Shout your commands: release your seat belts, get out!',
    'Look outside before you open the door. Fire, water or debris on that side, and that door stays shut.',
    'A fire in the cabin: find it, fight it, and tell the flight deck at once. Never open a hot locker wide.',
    'Smoke hood first, then the extinguisher. Aim at the base of the fire, not the smoke.',
    'Lithium batteries can catch fire long after they are switched off. Cool it with water, then put it in the bag.',
    'First aid. Someone collapses: check for breathing, call for the defibrillator, and start compressions.',
    'Thirty compressions, two breaths. Hard and fast, about two a second. Swap every two minutes.',
    'A difficult passenger. Stay calm, keep your voice low, and keep the purser and the captain informed.',
    'Turbulence: when the seat belt sign comes on, you sit down too. Your safety comes first.',
    'Open your books at the chapter on ditching. Life jackets on, but not inflated until you are outside.',
  ],
  mech: [
    'Good morning. Today we talk about doing the job right, every time, and signing for it.',
    'Every task follows the maintenance manual. Not memory, not the way we did it last time. The manual.',
    'Human factors. Fatigue, pressure and distraction are behind most maintenance mistakes.',
    'If you are interrupted during a task, go back one step and check it again before you carry on.',
    'Torque. Use a calibrated wrench, and check the value in the manual for that bolt, every time.',
    'Wiring. Look for chafing where the wires pass structure, and keep power and signal wires apart.',
    'A borescope inspection: you look for nicks, cracks and burns on the blades, and you measure them against the limits.',
    'An engine run-up. Chocks in, a fire guard outside, and the area in front and behind the engine clear.',
    'Foreign object damage. One loose nut in an intake can destroy an engine. Count your tools in and out.',
    'Hot work in the hangar needs a permit and a fire watch, until thirty minutes after the last spark.',
    'When you release an aircraft to service, your signature says it is safe. Only sign what you have seen.',
    'Open your books at the chapter on the minimum equipment list, and what you may defer.',
  ],
  ground: [
    'Good morning, everyone. Today is about the ramp, the busiest and most dangerous place at the airport.',
    'On the apron, aircraft always have right of way. Always.',
    'Keep to the speed limits: walking pace near the aircraft, and never drive under a wing.',
    'Before an aircraft moves, the anti-collision beacon comes on. When it flashes, stay clear of the engines.',
    'Pushback. Connect the towbar, insert the bypass pin, and only then tell the flight deck you are ready.',
    'Keep talking to the captain on the headset: brakes released, pushback approved, and when you stop, set the brakes.',
    'Loading. The load plan tells you what goes where. Heavy items low, and everything secured.',
    'Dangerous goods. Check the labels, and never load a damaged or leaking package. Tell your supervisor.',
    'The loadsheet must match what is really on board. A last-minute change means a new figure for the captain.',
    'De-icing. The critical surfaces must be clean before take-off, and the hold-over time starts when you begin.',
    'A fuel spill: stop the fuelling, keep people away, and call the fire service. No engines, no sparks.',
    'Open your books at the chapter on airside driving, and the markings you must know for your test.',
  ],
};
/** The class now: who sits where (up to 12, the longest there first). */
function trnClassList(): any[] { try { return inTrainingNow().slice(0, 12); } catch (e) { return []; } }
/** What the class is learning: the kind most of them are. */
function trnTopic(list: any[]): string {
  const n: any = {}; for (const p of list) { const k = courseGroupOf(p); n[k] = (n[k] || 0) + 1; }
  return Object.keys(n).sort((a, b) => n[b] - n[a])[0] || 'pilot';
}
function trnPersonQ(): number { const q = Gfx.roomQ(); return q >= 2 ? 0.75 : q >= 1 ? 0.5 : 0.35; }
/** Seat the class, add or take away students as courses start and end, and the teacher with them. */
function trnClassSync() {
  const R = TestRooms, N = R.trn; if (!N || !R.scene) return;
  const T = THREE, c = company(), list = trnClassList(), seats = N.seats, want: any = {};
  list.forEach((p, i) => want[p.id] = i);
  for (const id in N.people) if (!(id in want) || N.people[id].seat !== want[id]) { const s = N.people[id]; N.g.remove(s.pivot); R.hits = R.hits.filter((h: any) => h !== s.hit); delete N.people[id]; }
  list.forEach((p, i) => {
    if (N.people[p.id]) return;
    try {
      const m = Human.build(p.look, personRole(p), (c && c.color) || '#2C8CFF', av3Style(), trnPersonQ()); try { modelsPeople(m, p.look); } catch (e) { /* the app's own */ }
      const pivot = new T.Group(), holder = new T.Group(); holder.add(m.root); pivot.add(holder); pivot.rotation.order = 'YXZ'; N.g.add(pivot);
      const top = m.top || 1.7; pivot.position.set(seats[i][0] - 0.02, 0.49, seats[i][1]); holder.position.y = -top * 0.52; pivot.rotation.y = -Math.PI / 2;
      const hit = new T.Mesh(new T.BoxGeometry(0.5, 1.3, 0.5), new T.MeshBasicMaterial({ visible: false })); hit.position.set(seats[i][0], 0.75, seats[i][1]); hit.userData = { act: 'trn', id: p.id, keep: true }; N.g.add(hit); R.hits.push(hit);
      N.people[p.id] = { p, m, pivot, holder, seat: i, hit, ph: i * 1.37 + Math.random() * 3, g: null };
    } catch (e) { /* this one stays away */ }
  });
  N.topic = trnTopic(list);
  // the teacher: there while there is a class
  if (list.length && !N.teacher) {
    try {
      const L: any = randomLook('academy-teacher-1', TRN_TEACHER.sex, 'captain'); L.civil = true; L.top = 'jacket'; L.neck = 'tie'; L.uniform = 2; L.hat = 'none'; L.glasses = 'rect'; L.bottom = 'trousers'; L.shoes = 'oxford';
      const m = Human.build(L, 'captain', (c && c.color) || '#2C8CFF', av3Style(), Math.max(0.5, trnPersonQ())); try { modelsPeople(m, L); } catch (e) { /* the app's own */ }
      const pivot = new T.Group(), holder = new T.Group(); holder.add(m.root); pivot.add(holder); pivot.rotation.order = 'YXZ'; N.g.add(pivot);
      const book = new T.Mesh(new T.BoxGeometry(0.2, 0.27, 0.03), new T.MeshStandardMaterial({ map: ctTex(trnCoverCanvas('Principles of Flight', '#1F4E79')), roughness: 0.7 })); N.g.add(book);
      const hit = new T.Mesh(new T.BoxGeometry(0.6, 1.8, 0.6), new T.MeshBasicMaterial({ visible: false })); hit.userData = { act: 'trn', id: 'teacher', keep: true }; N.g.add(hit); R.hits.push(hit);
      N.teacher = { m, pivot, holder, book, hit, x: -12.2, z: -15.1, yaw: Math.PI / 2, step: 0, stepAt: 0, sit: 0, g: null, line: -1, say: '', sayAt: 0, next: 0 };
    } catch (e) { N.teacher = null; }
  } else if (!list.length && N.teacher) {
    const t = N.teacher; N.g.remove(t.pivot); N.g.remove(t.book); N.g.remove(t.hit); R.hits = R.hits.filter((h: any) => h !== t.hit); N.teacher = null;
    try { if (Voice.speaking && /Daniel Brandt/.test(Voice.who)) Voice.stop(); } catch (e) { /* no voice */ }
  }
}
// the teacher's routine: [what, seconds, where he stands (x, z, facing)]
const TRN_FRONT = [-12.2, -15.1, Math.PI / 2], TRN_WINDOW = [-12.95, -17.75, Math.PI], TRN_DESK = [-13.75, -15.1, Math.PI / 2];
function trnRoutine(): [string, number, number[]][] {
  return [['look', 4, TRN_FRONT], ['book', 5, TRN_FRONT], ['look', 4, TRN_FRONT], ['walk', 0, TRN_WINDOW], ['window', 6, TRN_WINDOW], ['walk', 0, TRN_DESK],
    ['sit', 180 + Math.random() * 60, TRN_DESK], ['stand', 1.6, TRN_DESK], ['read', 27, TRN_DESK], ['walk', 0, TRN_FRONT]];
}
/** Are you in the Training room (to hear the lesson)? */
function trnHere(): boolean { const R = TestRooms, F = R.free; return !!(F && R.in === 'halls' && F.x > TRN_L.x0 && F.x < TRN_L.x1 + 0.3 && F.z > TRN_L.z0 && F.z < TRN_L.z1); }
function trnClassStep(dt: number, now: number) {
  const R = TestRooms, N = R.trn; if (!N) return;
  if (!N.syncAt || now - N.syncAt > 3) { N.syncAt = now; trnClassSync(); }
  const t0 = N.teacher, tx = t0 ? t0.x : -12.2, tz = t0 ? t0.z : -15.1;
  // the students: seated, swaying a little, looking at the teacher, now and then down at their notes
  for (const id in N.people) {
    const s = N.people[id], t = now + s.ph;
    s.pivot.rotation.x = 0.012 * Math.sin(t * 0.37) + 0.006 * Math.sin(t * 0.91 + 1);
    s.pivot.rotation.z = 0.014 * Math.sin(t * 0.29 + 2) + 0.005 * Math.sin(t * 0.77);
    const gT = humanGesture({ kind: 'sit', v: 0 }, t);
    gT.L = [0.42, 0.12, 0.1, 0.95]; gT.R = [0.42, 0.12, 0.1, 0.95];
    const sx = s.pivot.position.x, sz = s.pivot.position.z, a = Math.atan2(tx - sx, tz - sz) - s.pivot.rotation.y, want = clamp(Math.atan2(Math.sin(a), Math.cos(a)), -1, 1);
    const notes = (Math.sin(t * 0.21) > 0.75) ? 0.35 : 0.05;   // writing a note now and then
    gT.shake += want * 0.7 * (1 - notes); gT.nod += notes;
    s.g = s.g ? cabinLerpG(s.g, gT, Math.min(1, dt * 3)) : gT;
    s.m.pose({ t, yaw: 0, gaze: [want * 0.3, 0], blink: (t % 4.7) < 0.12 ? 1 : 0, g: s.g });
  }
  const T = N.teacher; if (!T) return;
  // the routine
  const plan = N.plan || (N.plan = trnRoutine());
  if (!T.stepAt) T.stepAt = now;
  let [what, secs, at] = plan[T.step];
  if (what === 'walk') {
    const dx = at[0] - T.x, dz = at[1] - T.z, d = Math.hypot(dx, dz), sp = 0.9 * dt;
    if (d < 0.05) { T.x = at[0]; T.z = at[1]; T.step = (T.step + 1) % plan.length; T.stepAt = now; if (!T.step) N.plan = trnRoutine(); }
    else { T.x += dx / d * Math.min(d, sp); T.z += dz / d * Math.min(d, sp); const yw = Math.atan2(dx, dz); T.yaw += Math.atan2(Math.sin(yw - T.yaw), Math.cos(yw - T.yaw)) * Math.min(1, dt * 6); }
  } else {
    T.yaw += Math.atan2(Math.sin(at[2] - T.yaw), Math.cos(at[2] - T.yaw)) * Math.min(1, dt * 4);
    if (now - T.stepAt >= secs) { T.step = (T.step + 1) % plan.length; T.stepAt = now; if (!T.step) N.plan = trnRoutine(); }
  }
  [what] = plan[T.step];
  // sitting down behind the desk and getting up
  const wantSit = what === 'sit' ? 1 : 0; T.sit += Math.sign(wantSit - T.sit) * Math.min(Math.abs(wantSit - T.sit), dt * 1.1);
  const sk = T.sit * T.sit * (3 - 2 * T.sit), top = T.m.top || 1.75;
  T.pivot.position.set(T.x, sk * 0.49, T.z); T.holder.position.y = -sk * top * 0.52; T.pivot.rotation.y = T.yaw;
  T.hit.position.set(T.x, 0.9, T.z);
  const tt = now;
  let gT = what === 'walk' ? humanWalk(tt, { v: 0.9, seed: 'teacher' }) : humanGesture(null, tt);
  const holding = what === 'book' || what === 'read' || what === 'look' || what === 'walk' && T.step !== 5 || what === 'window';
  if (holding && what !== 'walk') { gT.L = [0.45, 0.12, 0.08, 1.2]; }
  if (what === 'book' || what === 'read') { gT.R = [0.5, 0.05, 0, 1.25]; gT.nod += 0.38; }
  else if (what === 'look') { gT.R = [0.25 + 0.15 * Math.sin(tt * 1.3), 0.15, 0, 0.6 + 0.3 * Math.sin(tt * 0.9)]; gT.shake += 0.35 * Math.sin(tt * 0.4); }   // talking with his hand, looking round the class
  else if (what === 'window') { gT.nod -= 0.05; gT.shake += 0.15 * Math.sin(tt * 0.3); }
  if (sk > 0.01) gT = humanSitMove(cabinLerpG(gT, humanGesture({ kind: 'sit', v: 0 }, tt), sk), sk);
  T.g = T.g ? cabinLerpG(T.g, gT, Math.min(1, dt * 5)) : gT;
  // talking all the time: the lesson, line after line (heard while you are in the room)
  const lines = TRN_LESSONS[N.topic || 'pilot'] || TRN_LESSONS.pilot, here = trnHere();
  const voiceName = `pax|${TRN_TEACHER.sex}|neutral|${TRN_TEACHER.name}`;
  const busy = (() => { try { return Voice.speaking && Voice.who === voiceName; } catch (e) { return false; } })();
  if (!busy && performance.now() > T.next) {
    T.line = (T.line + 1) % lines.length; T.say = lines[T.line]; T.sayAt = Date.now(); T.next = performance.now() + Math.max(4500, T.say.length * 75);
    trnBoxUpdate();
    if (here && trnVoiceOn()) { try { if (!Voice.speaking) { Voice.speak(T.say, () => { T.next = performance.now() + 700; }, voiceName); T.next = performance.now() + 60000; } } catch (e) { /* no voice */ } }
  }
  T.m.pose({ t: tt, yaw: 0, gaze: [0, 0], blink: (tt % 3.9) < 0.12 ? 1 : 0, g: T.g, talk: humanTalk(voiceName, T.say, T.sayAt) });
  // his book: in his hands, or on the desk while he sits
  const B = T.book, fx = Math.sin(T.yaw), fz = Math.cos(T.yaw);
  if (what === 'sit' || what === 'stand' && sk > 0.5) { B.position.set(-13.15, 0.785, -14.75); B.rotation.set(-Math.PI / 2, 0, 0.3); }
  else { const lift = what === 'book' || what === 'read' ? 1.18 : 0.98; B.position.set(T.x + fx * 0.3, lift, T.z + fz * 0.3); B.rotation.set(what === 'book' || what === 'read' ? -0.9 : -0.2, T.yaw, 0, 'YXZ'); }
}
function trnVoiceOn(): boolean { const S: any = State.settings; return S.mechanicVoice !== false && S.trainingVoice !== false; }
/* the speech box: what the teacher is saying (follows him line by line), or what a student is doing */
function trnBoxEl(): HTMLElement {
  const R = TestRooms; let b = R.root && R.root.querySelector('.trn-box') as HTMLElement;
  if (!b && R.root) { b = document.createElement('div'); b.className = 'ct-box trn-box'; b.hidden = true;
    b.innerHTML = `<button class="of-x" data-tr="trnclose" aria-label="Close">${icon('close')}</button><div class="ct-who"><b></b><small></small></div><p class="ct-text"></p><div class="ct-ctl"><button class="btn sm ghost" data-tr="trnvoice"></button></div>`;
    R.root.appendChild(b); }
  return b;
}
function trnBoxUpdate() {
  const R = TestRooms, N = R.trn, b = trnBoxEl(); if (!b || b.hidden || !N) return;
  if (N.boxWho === 'teacher' && N.teacher) {
    (b.querySelector('.ct-who b') as HTMLElement).textContent = TRN_TEACHER.name; (b.querySelector('.ct-who small') as HTMLElement).textContent = TRN_TEACHER.title + ' · ' + ({ pilot: 'pilots', fa: 'cabin crew', mech: 'mechanics', ground: 'ground staff' } as any)[N.topic || 'pilot'];
    (b.querySelector('.ct-text') as HTMLElement).textContent = N.teacher.say || '…';
  }
  (b.querySelector('[data-tr="trnvoice"]') as HTMLElement).textContent = trnVoiceOn() ? 'Voice: on' : 'Voice: off';
}
function trnShow(id: string) {
  const R = TestRooms, N = R.trn, b = trnBoxEl(); if (!b || !N) return;
  N.boxWho = id; b.hidden = false; Sound.tick();
  if (id === 'teacher') { trnBoxUpdate(); return; }
  const s = N.people[id]; if (!s) { b.hidden = true; return; }
  const p = s.p, C = p.course ? CrewTraining.course(p.course.id) : null, ty = p.training ? acType(p.training.typeId) : null;
  (b.querySelector('.ct-who b') as HTMLElement).textContent = p.name; (b.querySelector('.ct-who small') as HTMLElement).textContent = roleNameOf(p);
  (b.querySelector('.ct-text') as HTMLElement).textContent = `${C ? C.name : ty ? `Type rating: ${ty.maker} ${ty.model}` : 'On a course'}. Listening and taking notes${p.course || p.training ? `, until ${dateStr(new Date((p.course || p.training).until)).slice(5, 16)}` : ''}.`;
  (b.querySelector('[data-tr="trnvoice"]') as HTMLElement).textContent = trnVoiceOn() ? 'Voice: on' : 'Voice: off';
}
