// The jetways' own pictures, painted here (our own work): the studded rubber floor and its relief, the yellow and
// black edge strips, brushed aluminium, the white ceiling panels, the safety signs (ISO 7010 style exit and fire
// extinguisher signs, the access symbol), the backlit advertising panels, the vent grilles, the roll-up shutter's
// slats and the operator's screens. Each is one canvas; one metre of surface is one picture unless said otherwise.
import { canvas, rng } from '../lounge/pictures';

/** Grey studded rubber floor (1 m square): round raised studs on a fine grain. Returns [colour, height]. */
export function studFloor(base = '#5B5F66'): [HTMLCanvasElement, HTMLCanvasElement] {
  const N = 512, [c, x] = canvas(N, N), [h, y] = canvas(N, N), r = rng(77), pitch = 32, rad = 9.5;
  x.fillStyle = base; x.fillRect(0, 0, N, N); y.fillStyle = '#000'; y.fillRect(0, 0, N, N);
  for (let i = 0; i < 9000; i++) { const v = r(); x.fillStyle = v < 0.5 ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.07)'; x.fillRect(r() * N, r() * N, 1.5, 1.5); }
  for (let gy = 0; gy < N / pitch; gy++) for (let gx = 0; gx < N / pitch; gx++) { const cx = gx * pitch + pitch / 2, cy = gy * pitch + pitch / 2;
    const g = x.createRadialGradient(cx - 3, cy - 3, 1, cx, cy, rad); g.addColorStop(0, 'rgba(255,255,255,0.30)'); g.addColorStop(0.7, 'rgba(255,255,255,0.06)'); g.addColorStop(1, 'rgba(0,0,0,0.35)');
    x.fillStyle = g; x.beginPath(); x.arc(cx, cy, rad, 0, Math.PI * 2); x.fill();
    const k = y.createRadialGradient(cx, cy, 1, cx, cy, rad); k.addColorStop(0, '#FFF'); k.addColorStop(0.75, '#E0E0E0'); k.addColorStop(1, '#000'); y.fillStyle = k; y.beginPath(); y.arc(cx, cy, rad, 0, Math.PI * 2); y.fill(); }
  return [c, h];
}

/** A normal map from a height picture (white high, black low). */
export function normalMap(h: HTMLCanvasElement, strength = 2.5): HTMLCanvasElement {
  const W = h.width, H = h.height, src = (h.getContext('2d') as CanvasRenderingContext2D).getImageData(0, 0, W, H).data, [c, x] = canvas(W, H), out = x.createImageData(W, H);
  const at = (i: number, j: number) => src[(((j + H) % H) * W + ((i + W) % W)) * 4] / 255;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const dx = (at(i + 1, j) - at(i - 1, j)) * strength, dy = (at(i, j + 1) - at(i, j - 1)) * strength, l = Math.hypot(dx, dy, 1), o = (j * W + i) * 4;
    out.data[o] = (-dx / l * 0.5 + 0.5) * 255; out.data[o + 1] = (dy / l * 0.5 + 0.5) * 255; out.data[o + 2] = (1 / l * 0.5 + 0.5) * 255; out.data[o + 3] = 255; }
  x.putImageData(out, 0, 0); return c;
}

/** Yellow and black diagonal stripes (one metre long, the picture's width; any height). */
export function hazard(): HTMLCanvasElement {
  const [c, x] = canvas(512, 64); x.fillStyle = '#F2C230'; x.fillRect(0, 0, 512, 64); x.fillStyle = '#16171A';
  for (let s = -64; s < 512 + 64; s += 64) { x.beginPath(); x.moveTo(s, 64); x.lineTo(s + 32, 64); x.lineTo(s + 96, 0); x.lineTo(s + 64, 0); x.closePath(); x.fill(); }
  const r = rng(5); for (let i = 0; i < 1500; i++) { x.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.08)'; x.fillRect(r() * 512, r() * 64, 2, 1); }
  return c;
}

/** Brushed aluminium cladding (2 m square): fine streaks along it, faint panel seams every metre. */
export function brushedAlu(base = '#C3C9CE'): HTMLCanvasElement {
  const N = 512, [c, x] = canvas(N, N), r = rng(19); x.fillStyle = base; x.fillRect(0, 0, N, N);
  for (let i = 0; i < 2600; i++) { const yy = r() * N, l = 30 + r() * 220; x.strokeStyle = r() < 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(40,50,60,0.08)'; x.lineWidth = 0.6 + r(); x.beginPath(); x.moveTo(r() * N, yy); x.lineTo(r() * N + l, yy); x.stroke(); }
  x.fillStyle = 'rgba(60,70,80,0.35)'; for (const p of [0, N / 2]) { x.fillRect(p, 0, 2, N); x.fillRect(0, p, N, 2); }
  return c;
}

/** White ceiling panels (1 m square): 0.5 m tiles with grey seams and fine perforations. */
export function ceiling(): HTMLCanvasElement {
  const N = 512, [c, x] = canvas(N, N); x.fillStyle = '#F1F3F5'; x.fillRect(0, 0, N, N);
  x.fillStyle = 'rgba(120,128,136,0.12)'; for (let j = 8; j < N; j += 12) for (let i = 8; i < N; i += 12) if ((i % 256) > 18 && (i % 256) < 238 && (j % 256) > 18 && (j % 256) < 238) x.fillRect(i, j, 2, 2);
  x.fillStyle = '#9BA3AB'; for (const p of [0, 256]) { x.fillRect(p, 0, 4, N); x.fillRect(0, p, N, 4); }
  return c;
}

/** The emergency exit sign (ISO 7010 E001 style): white running figure leaving through a door, an arrow. dir: 1 right, -1 left. */
export function exitSign(dir = 1): HTMLCanvasElement {
  const W = 512, H = 256, [c, x] = canvas(W, H); x.fillStyle = '#00843D'; x.fillRect(0, 0, W, H); x.fillStyle = '#FFF'; x.strokeStyle = '#FFF';
  x.save(); if (dir < 0) { x.translate(W, 0); x.scale(-1, 1); }
  // the door (an open doorway on the right)
  x.fillRect(300, 30, 120, 196); x.fillStyle = '#00843D'; x.fillRect(318, 48, 84, 178); x.fillStyle = '#FFF';
  // the running figure, entering the doorway
  x.lineCap = 'round'; x.lineJoin = 'round'; x.lineWidth = 26; x.beginPath(); x.arc(330, 70, 20, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.moveTo(318, 100); x.lineTo(300, 160); x.stroke();                       // the body
  x.beginPath(); x.moveTo(300, 160); x.lineTo(335, 185); x.lineTo(345, 222); x.stroke();      // the front leg
  x.beginPath(); x.moveTo(300, 160); x.lineTo(275, 190); x.lineTo(240, 196); x.stroke();      // the back leg
  x.beginPath(); x.moveTo(316, 110); x.lineTo(350, 128); x.lineTo(372, 112); x.stroke();      // the front arm
  x.beginPath(); x.moveTo(314, 112); x.lineTo(282, 118); x.lineTo(262, 140); x.stroke();      // the back arm
  // the arrow
  x.lineWidth = 22; x.beginPath(); x.moveTo(40, 128); x.lineTo(200, 128); x.stroke(); x.beginPath(); x.moveTo(150, 80); x.lineTo(205, 128); x.lineTo(150, 176); x.stroke();
  x.restore(); return c;
}

/** The fire extinguisher sign (ISO 7010 F001 style): a white extinguisher on red, with its wording under it. */
export function extSign(): HTMLCanvasElement {
  const W = 256, H = 340, [c, x] = canvas(W, H); x.fillStyle = '#C8231C'; x.fillRect(0, 0, W, H); x.fillStyle = '#FFF'; x.strokeStyle = '#FFF';
  x.beginPath(); x.roundRect ? x.roundRect(96, 70, 64, 150, 26) : x.rect(96, 70, 64, 150); x.fill();   // the body
  x.fillRect(116, 46, 24, 26); x.fillRect(104, 40, 60, 10);                                   // the valve, the lever
  x.lineWidth = 9; x.lineCap = 'round'; x.beginPath(); x.moveTo(140, 50); x.quadraticCurveTo(200, 50, 190, 130); x.stroke(); // the hose
  x.beginPath(); x.moveTo(190, 130); x.lineTo(205, 170); x.stroke();
  x.font = '800 30px Arial, sans-serif'; x.textAlign = 'center'; x.fillText('FIRE', W / 2, 270); x.fillText('EXTINGUISHER', W / 2, 306);
  return c;
}

/** The access symbol (ISO 7001 style) for the floor: white on blue. */
export function access(): HTMLCanvasElement {
  const N = 256, [c, x] = canvas(N, N); x.fillStyle = '#1F5BA8'; x.fillRect(0, 0, N, N); x.strokeStyle = '#FFF'; x.fillStyle = '#FFF'; x.lineCap = 'round'; x.lineJoin = 'round';
  x.beginPath(); x.arc(112, 52, 18, 0, Math.PI * 2); x.fill(); x.lineWidth = 20;
  x.beginPath(); x.moveTo(108, 84); x.lineTo(112, 150); x.lineTo(166, 150); x.lineTo(186, 206); x.lineTo(204, 200); x.stroke();
  x.beginPath(); x.moveTo(110, 110); x.lineTo(156, 110); x.stroke();
  x.lineWidth = 14; x.beginPath(); x.arc(114, 170, 52, Math.PI * 0.55, Math.PI * 1.75); x.stroke();
  return c;
}

/** A backlit advertising panel (portrait, 1 × 2): the airline's colours, an aircraft in the sky, the airport's name. */
export function adPanel(col = '#1C3A8A', accent = '#3FD3E6', n = 0): HTMLCanvasElement {
  const W = 512, H = 1024, [c, x] = canvas(W, H), g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, n % 2 ? '#F6B26B' : '#7FC4EA'); g.addColorStop(0.55, n % 2 ? '#F9D9A8' : '#D7EEF8'); g.addColorStop(0.551, col); g.addColorStop(1, col);
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  // a mountain line and the aircraft climbing out
  x.fillStyle = 'rgba(40,60,80,0.35)'; x.beginPath(); x.moveTo(0, 560); for (let i = 0; i <= 8; i++) x.lineTo(i * 64, 520 - Math.sin(i * 1.7 + n) * 40 - (i % 3) * 18); x.lineTo(W, 564); x.closePath(); x.fill();
  x.save(); x.translate(250, 300); x.rotate(-0.22); x.fillStyle = '#FFF';
  x.beginPath(); x.ellipse(0, 0, 170, 22, 0, 0, Math.PI * 2); x.fill();                         // the fuselage
  x.beginPath(); x.moveTo(-10, 0); x.lineTo(-70, 120); x.lineTo(-30, 120); x.lineTo(60, 4); x.closePath(); x.fill(); // the wing
  x.beginPath(); x.moveTo(-130, -6); x.lineTo(-175, -80); x.lineTo(-150, -80); x.lineTo(-100, -6); x.closePath(); x.fill(); // the fin
  x.fillStyle = col; x.fillRect(-120, -4, 250, 6); x.restore();
  x.fillStyle = accent; x.fillRect(0, 566, W, 10);
  x.fillStyle = '#FFF'; x.textAlign = 'center'; x.font = '800 64px Arial, sans-serif'; x.fillText(n % 2 ? 'Fly the' : 'Welcome to', W / 2, 700); x.fillText(n % 2 ? 'south coast' : 'Mýrdalssandur', W / 2, 776);
  x.font = '600 36px Arial, sans-serif'; x.fillStyle = accent; x.fillText(n % 2 ? 'Daily departures from VTX' : 'Iceland · VTX / BIAP', W / 2, 860);
  return c;
}

/** A vent grille: dark slats in a frame. */
export function grille(): HTMLCanvasElement {
  const [c, x] = canvas(256, 128); x.fillStyle = '#D9DDE1'; x.fillRect(0, 0, 256, 128); x.fillStyle = '#4A5058'; for (let i = 14; i < 242; i += 12) x.fillRect(i, 12, 7, 104);
  x.strokeStyle = '#AEB5BC'; x.lineWidth = 6; x.strokeRect(3, 3, 250, 122); return c;
}

/** The roll-up shutter's slats (1 m square). */
export function shutter(): HTMLCanvasElement {
  const N = 256, [c, x] = canvas(N, N); for (let j = 0; j < N; j += 16) { const g = x.createLinearGradient(0, j, 0, j + 16); g.addColorStop(0, '#C9CED3'); g.addColorStop(0.6, '#A9B0B7'); g.addColorStop(1, '#6E757C'); x.fillStyle = g; x.fillRect(0, j, N, 16); }
  return c;
}

/** The operator's screens: 'cam' the docking camera (the aircraft's door, guide lines), 'status' the jetway's state. */
export function screen(kind: 'cam' | 'status'): HTMLCanvasElement {
  const W = 512, H = 320, [c, x] = canvas(W, H); x.fillStyle = '#0B1016'; x.fillRect(0, 0, W, H);
  if (kind === 'cam') { const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#5A6470'); g.addColorStop(1, '#2A3038'); x.fillStyle = g; x.fillRect(10, 10, W - 20, H - 20);
    x.fillStyle = '#D9DEE3'; x.fillRect(10, 40, W - 20, 200); x.strokeStyle = '#5A6068'; x.lineWidth = 5; x.strokeRect(200, 70, 110, 160);   // the fuselage, its door
    x.strokeStyle = '#3FE06A'; x.lineWidth = 3; x.beginPath(); x.moveTo(W / 2, 10); x.lineTo(W / 2, H - 10); x.moveTo(140, 250); x.lineTo(372, 250); x.stroke();
    x.fillStyle = '#3FE06A'; x.font = '700 22px monospace'; x.fillText('CAM 1  ·  DOOR 1L', 22, 34); x.fillText('DIST 0.20 m', 22, H - 22); }
  else { x.font = '700 24px monospace'; const L = [['JETWAY', '#3FD3E6'], ['DOCKED  ·  AUTO-LEVEL', '#3FE06A'], ['CANOPY  EXTENDED', '#3FE06A'], ['GPU  400 Hz  ON', '#3FE06A'], ['PCA  ON', '#3FE06A'], ['WIND  12 kt', '#D9DEE3'], ['E-STOP  READY', '#F2C230']];
    L.forEach(([t, cl], i) => { x.fillStyle = cl; x.fillText(t, 24, 44 + i * 40); }); }
  return c;
}

/** The yellow air hose's fabric: worn yellow with darker grooves between its ribs, grime and scuffs (wraps round and along it). */
export function hoseFabric(): HTMLCanvasElement {
  const W = 512, H = 128, [c, x] = canvas(W, H), r = rng(23); x.fillStyle = '#D9A92C'; x.fillRect(0, 0, W, H);
  for (let i = 0; i < W; i += 8) { const g = x.createLinearGradient(i, 0, i + 8, 0); g.addColorStop(0, 'rgba(90,60,10,0.45)'); g.addColorStop(0.3, 'rgba(255,230,140,0.25)'); g.addColorStop(0.6, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(90,60,10,0.4)'); x.fillStyle = g; x.fillRect(i, 0, 8, H); }
  for (let i = 0; i < 2600; i++) { x.fillStyle = r() < 0.6 ? `rgba(60,45,20,${0.05 + r() * 0.12})` : `rgba(255,240,180,${0.04 + r() * 0.08})`; x.fillRect(r() * W, r() * H, 1 + r() * 3, 1 + r() * 2); }
  for (let i = 0; i < 18; i++) { x.fillStyle = 'rgba(50,40,25,0.10)'; x.beginPath(); x.ellipse(r() * W, r() * H, 10 + r() * 40, 4 + r() * 12, r() * 3, 0, Math.PI * 2); x.fill(); }
  return c;
}

/** Tyre rubber (1 m = 8 repeats): black-grey with a fine grain, light wear and dust. Returns [colour, height]. */
export function rubber(): [HTMLCanvasElement, HTMLCanvasElement] {
  const N = 256, [c, x] = canvas(N, N), [h, y] = canvas(N, N), r = rng(41); x.fillStyle = '#2C2D30'; x.fillRect(0, 0, N, N); y.fillStyle = '#808080'; y.fillRect(0, 0, N, N);
  for (let i = 0; i < 7000; i++) { const px = r() * N, py = r() * N, v = r(); x.fillStyle = v < 0.5 ? 'rgba(0,0,0,0.25)' : `rgba(120,118,112,${0.05 + r() * 0.1})`; x.fillRect(px, py, 1, 1); y.fillStyle = v < 0.5 ? '#6a6a6a' : '#999'; y.fillRect(px, py, 1, 1); }
  for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(140,132,118,${0.03 + r() * 0.05})`; x.beginPath(); x.ellipse(r() * N, r() * N, 6 + r() * 30, 3 + r() * 10, r() * 3, 0, Math.PI * 2); x.fill(); }
  return [c, h];
}

/** The rims' paint (1 m square): silver-grey enamel, grime towards the edges, rust bleeding from round the nuts, scratches. */
export function rimPaint(): HTMLCanvasElement {
  const N = 512, [c, x] = canvas(N, N), r = rng(57); x.fillStyle = '#BFC3C7'; x.fillRect(0, 0, N, N);
  for (let i = 0; i < 5000; i++) { x.fillStyle = r() < 0.5 ? `rgba(70,70,65,${0.04 + r() * 0.08})` : `rgba(255,255,255,${0.04 + r() * 0.06})`; x.fillRect(r() * N, r() * N, 1 + r() * 2, 1 + r() * 2); }
  for (let i = 0; i < 22; i++) { const px = r() * N, py = r() * N, g = x.createRadialGradient(px, py, 0, px, py, 6 + r() * 18); g.addColorStop(0, 'rgba(120,75,35,0.22)'); g.addColorStop(0.5, 'rgba(140,95,50,0.10)'); g.addColorStop(1, 'rgba(140,90,45,0)'); x.fillStyle = g; x.fillRect(px - 20, py - 20, 40, 40);
    x.strokeStyle = 'rgba(120,80,40,0.10)'; x.lineWidth = 1 + r() * 1.5; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (r() - 0.5) * 6, py + 10 + r() * 30); x.stroke(); }
  for (let i = 0; i < 60; i++) { x.strokeStyle = `rgba(255,255,255,${0.1 + r() * 0.2})`; x.lineWidth = 0.6; x.beginPath(); const px = r() * N, py = r() * N; x.moveTo(px, py); x.lineTo(px + (r() - 0.5) * 40, py + (r() - 0.5) * 12); x.stroke(); }
  return c;
}

/** The tunnel's ceiling (1 m square): brushed stainless slats 100 mm wide across it, dark shadow gaps between them,
 *  the brushing along each slat. Returns [colour, height]. */
export function slatCeiling(): [HTMLCanvasElement, HTMLCanvasElement] {
  const N = 512, [c, x] = canvas(N, N), [h, y] = canvas(N, N), r = rng(91), S = N / 10;
  for (let k = 0; k < 10; k++) { const y0 = k * S, g = x.createLinearGradient(0, y0, 0, y0 + S); g.addColorStop(0, '#5C6268'); g.addColorStop(0.08, '#9AA1A8'); g.addColorStop(0.5, '#B4BAC0'); g.addColorStop(0.92, '#8D949B'); g.addColorStop(1, '#3A3E43');
    x.fillStyle = g; x.fillRect(0, y0, N, S); x.fillStyle = '#1F2226'; x.fillRect(0, y0 + S - 3, N, 3);
    for (let i = 0; i < 160; i++) { const yy = y0 + 3 + r() * (S - 8); x.strokeStyle = r() < 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(30,35,40,0.10)'; x.lineWidth = 0.7; x.beginPath(); x.moveTo(r() * N, yy); x.lineTo(r() * N, yy); x.stroke(); }
    y.fillStyle = '#E0E0E0'; y.fillRect(0, y0, N, S - 3); y.fillStyle = '#000'; y.fillRect(0, y0 + S - 3, N, 3); }
  return [c, h];
}

/** The jetway's carpet (1 m square): dark grey with blue-grey and light flecks streaked along the walk, a faint grain. */
export function carpet(): HTMLCanvasElement {
  const N = 512, [c, x] = canvas(N, N), r = rng(13); x.fillStyle = '#3B4048'; x.fillRect(0, 0, N, N);
  for (let i = 0; i < 9000; i++) { const px = r() * N, py = r() * N, l = 4 + r() * 26, v = r();
    x.strokeStyle = v < 0.45 ? `rgba(20,24,30,${0.3 + r() * 0.3})` : v < 0.8 ? `rgba(120,132,150,${0.2 + r() * 0.3})` : `rgba(200,206,214,${0.15 + r() * 0.25})`; x.lineWidth = 1 + r();
    x.beginPath(); x.moveTo(px, py); x.lineTo(px, py + l); x.stroke(); }
  for (let i = 0; i < 20000; i++) { x.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.05)'; x.fillRect(r() * N, r() * N, 1, 1); }
  return c;
}

/** The interior wall panels (1.2 m wide, 1 m to the picture's height): satin light grey, a soft sheen, a dark seam at each edge. */
export function wallPanel(): HTMLCanvasElement {
  const N = 512, [c, x] = canvas(N, N), r = rng(29), g = x.createLinearGradient(0, 0, N, 0); g.addColorStop(0, '#C9CDD1'); g.addColorStop(0.5, '#DADDE0'); g.addColorStop(1, '#C6CACE');
  x.fillStyle = g; x.fillRect(0, 0, N, N);
  for (let i = 0; i < 3000; i++) { x.fillStyle = r() < 0.5 ? 'rgba(90,95,100,0.05)' : 'rgba(255,255,255,0.06)'; x.fillRect(r() * N, r() * N, 1 + r() * 2, 1); }
  x.fillStyle = '#7E858C'; x.fillRect(0, 0, 3, N); x.fillStyle = 'rgba(255,255,255,0.5)'; x.fillRect(3, 0, 1, N);
  return c;
}
