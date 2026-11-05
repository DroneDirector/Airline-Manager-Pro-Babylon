// The courtroom's textures, drawn (ported from the main game's courtroom): wood grain, herringbone parquet, marble,
// carpet, buttoned leather, the emblem of justice, the exit sign, paintings, the windows, the light shafts, the clock
// and the court's screens.
export function ctCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d') as CanvasRenderingContext2D]; }
export function ctRng(seed: number) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; }
/** Wood: long grain lines with figure, pores and a little colour change from board to board. */
export function ctWood(base: string, dark: string, seed: number, w = 512, h = 512, figure = 1): HTMLCanvasElement {
  const [c, x] = ctCanvas(w, h), r = ctRng(seed);
  x.fillStyle = base; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) {
    const y0 = r() * h, a = 2 + r() * 10 * figure, f = 0.004 + r() * 0.01, ph = r() * 6.3, lw = 0.4 + r() * 2.2;
    x.strokeStyle = dark; x.globalAlpha = 0.04 + r() * 0.16; x.lineWidth = lw; x.beginPath();
    for (let X = 0; X <= w; X += 8) { const Y = y0 + Math.sin(X * f + ph) * a + Math.sin(X * f * 3.1 + ph * 2) * a * 0.3; X ? x.lineTo(X, Y) : x.moveTo(X, Y); }
    x.stroke();
  }
  x.globalAlpha = 0.25; for (let i = 0; i < 1800; i++) { x.fillStyle = r() < 0.5 ? dark : '#000'; x.fillRect(r() * w, r() * h, 1 + r() * 3, 0.6); }
  x.globalAlpha = 1; return c;
}
/** Herringbone parquet from the wood above, every plank its own shade (tiles seamlessly). */
export function ctParquet(): HTMLCanvasElement {
  const [c, x] = ctCanvas(1024, 1024), wood = ctWood('#7A4E2C', '#3A2212', 11, 512, 64, 0.6), r = ctRng(7), W = 32, L = 128;
  x.fillStyle = '#3A2414'; x.fillRect(0, 0, 1024, 1024);
  const plank = (px: number, py: number, vert: boolean) => {
    x.save(); x.filter = `brightness(${0.75 + r() * 0.45}) saturate(${0.85 + r() * 0.3})`;
    if (vert) { x.translate(px + W, py); x.rotate(Math.PI / 2); } else x.translate(px, py);
    x.drawImage(wood, Math.floor(r() * 380), 0, L, 60, 0.5, 0.5, L - 1, W - 1); x.restore();
  };
  for (let b = -12; b <= 12; b++) for (let n = -40; n <= 40; n++) {
    const ox = n * W + b * 4 * W, oy = n * W - b * 4 * W;
    for (const [dx, dy] of [[0, 0], [1024, 0], [-1024, 0], [0, 1024], [0, -1024]]) {
      const hx = ox + dx, hy = oy + dy; if (hx > -L && hx < 1024 && hy > -L && hy < 1024) { plank(hx, hy, false); plank(hx, hy + W, true); }
    }
  }
  x.filter = 'none'; return c;
}
/** Marble: soft cloudy veins. */
export function ctMarble(base: number[], vein: number[], seed: number, n = 256): HTMLCanvasElement {
  const [c, x] = ctCanvas(n, n), d = x.createImageData(n, n), r = ctRng(seed), P: number[] = []; for (let i = 0; i < 12; i++) P.push(r() * 6.3);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const u = i / n * 6.283, v = j / n * 6.283;
    const turb = Math.sin(u * 2 + P[0]) * 0.6 + Math.sin(v * 3 + P[1]) * 0.5 + Math.sin((u + v) * 5 + P[2]) * 0.25 + Math.sin((u * 3 - v * 2) * 2 + P[3]) * 0.2 + Math.sin(u * 11 + v * 7 + P[4]) * 0.08;
    const k = Math.pow(1 - Math.abs(Math.sin((u + v * 0.6) * 2 + turb * 2.2)), 9) * 0.85 + (Math.sin(u * 23 + v * 19 + P[5]) * 0.03);
    const o = (j * n + i) * 4; for (let ch = 0; ch < 3; ch++) d.data[o + ch] = base[ch] + (vein[ch] - base[ch]) * Math.max(0, Math.min(1, k)); d.data[o + 3] = 255;
  }
  x.putImageData(d, 0, 0); return c;
}
export function ctNoise(base: string, amt: number, seed: number, n = 256, dots = 6000): HTMLCanvasElement {
  const [c, x] = ctCanvas(n, n), r = ctRng(seed); x.fillStyle = base; x.fillRect(0, 0, n, n);
  for (let i = 0; i < dots; i++) { x.fillStyle = r() < 0.5 ? `rgba(0,0,0,${amt * r()})` : `rgba(255,255,255,${amt * r() * 0.6})`; x.fillRect(r() * n, r() * n, 1 + r() * 2, 1 + r() * 2); }
  return c;
}
export function ctCarpet(): HTMLCanvasElement {
  const [c, x] = ctCanvas(256, 256); x.fillStyle = '#5C1A22'; x.fillRect(0, 0, 256, 256);
  x.strokeStyle = 'rgba(214,168,92,.35)'; x.lineWidth = 2; for (let i = -1; i < 3; i++) for (let j = -1; j < 3; j++) { x.beginPath(); x.moveTo(i * 128 + 64, j * 128); x.lineTo(i * 128 + 128, j * 128 + 64); x.lineTo(i * 128 + 64, j * 128 + 128); x.lineTo(i * 128, j * 128 + 64); x.closePath(); x.stroke(); }
  x.fillStyle = 'rgba(214,168,92,.45)'; for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { x.beginPath(); x.arc(i * 128 + 64, j * 128 + 64, 6, 0, 6.3); x.fill(); }
  const r = ctRng(3); for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(0,0,0,${0.12 * r()})`; x.fillRect(r() * 256, r() * 256, 1, 1); }
  return c;
}
export function ctLeather(col: string): HTMLCanvasElement {
  const c = ctNoise(col, 0.18, 21, 256, 9000), x = c.getContext('2d') as CanvasRenderingContext2D;
  // buttoned (tufted) diamonds
  x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 1.5;
  for (let i = -1; i < 5; i++) for (let j = -1; j < 5; j++) { x.beginPath(); x.moveTo(i * 64 + 32, j * 64); x.lineTo(i * 64 + 64, j * 64 + 32); x.lineTo(i * 64 + 32, j * 64 + 64); x.lineTo(i * 64, j * 64 + 32); x.closePath(); x.stroke(); x.fillStyle = 'rgba(0,0,0,.5)'; x.beginPath(); x.arc(i * 64 + 32, j * 64 + 32, 3, 0, 6.3); x.fill(); }
  return c;
}
/** The emblem above the bench: the scales of justice in a laurel wreath, gilt on deep blue. */
export function ctEmblem(): HTMLCanvasElement {
  const [c, x] = ctCanvas(512, 512), g = x.createRadialGradient(256, 230, 30, 256, 256, 250);
  g.addColorStop(0, '#22385E'); g.addColorStop(1, '#0D1A30'); x.fillStyle = g; x.beginPath(); x.arc(256, 256, 250, 0, 6.3); x.fill();
  const gold = x.createLinearGradient(0, 60, 0, 460); gold.addColorStop(0, '#F6DB8E'); gold.addColorStop(0.5, '#C8963E'); gold.addColorStop(1, '#8A5E22');
  x.strokeStyle = gold; x.fillStyle = gold; x.lineWidth = 10; x.beginPath(); x.arc(256, 256, 236, 0, 6.3); x.stroke();
  x.lineWidth = 3; x.beginPath(); x.arc(256, 256, 220, 0, 6.3); x.stroke();
  // laurel
  for (const sd of [-1, 1]) for (let i = 0; i < 13; i++) { const a = Math.PI / 2 + sd * (0.35 + i * 0.17), R = 188; x.save(); x.translate(256 + Math.cos(a) * R, 256 + Math.sin(a) * R); x.rotate(a + sd * 0.9); x.beginPath(); x.ellipse(0, 0, 22, 8, 0, 0, 6.3); x.fill(); x.restore(); }
  // the scales
  x.lineWidth = 9; x.beginPath(); x.moveTo(256, 130); x.lineTo(256, 370); x.stroke();
  x.beginPath(); x.moveTo(150, 170); x.quadraticCurveTo(256, 150, 362, 170); x.stroke();
  x.beginPath(); x.arc(256, 122, 14, 0, 6.3); x.fill();
  x.fillRect(206, 366, 100, 14); x.fillRect(186, 380, 140, 12);
  for (const px of [150, 362]) { x.lineWidth = 3; x.beginPath(); x.moveTo(px, 170); x.lineTo(px - 42, 262); x.moveTo(px, 170); x.lineTo(px + 42, 262); x.stroke(); x.beginPath(); x.moveTo(px - 52, 262); x.quadraticCurveTo(px, 300, px + 52, 262); x.closePath(); x.fill(); }
  return c;
}
export function ctExit(): HTMLCanvasElement {
  const [c, x] = ctCanvas(256, 96); x.fillStyle = '#0E8A3E'; x.fillRect(0, 0, 256, 96); x.fillStyle = '#EFFFF3';
  x.font = 'bold 54px Inter, Arial, sans-serif'; x.textBaseline = 'middle'; x.fillText('EXIT', 102, 50);
  // a running figure and an arrow
  x.beginPath(); x.arc(46, 22, 8, 0, 6.3); x.fill(); x.lineWidth = 8; x.lineCap = 'round'; x.strokeStyle = '#EFFFF3';
  x.beginPath(); x.moveTo(42, 34); x.lineTo(36, 58); x.lineTo(52, 74); x.moveTo(36, 58); x.lineTo(20, 78); x.moveTo(40, 40); x.lineTo(58, 48); x.moveTo(40, 40); x.lineTo(24, 46); x.stroke();
  x.beginPath(); x.moveTo(70, 48); x.lineTo(90, 48); x.moveTo(82, 40); x.lineTo(90, 48); x.lineTo(82, 56); x.lineWidth = 6; x.stroke();
  return c;
}
/** A painting in a gilt frame: a calm landscape (sky, sea, hills), different each time. */
export function ctPainting(seed: number): HTMLCanvasElement {
  const [c, x] = ctCanvas(384, 256), r = ctRng(seed), sky = x.createLinearGradient(0, 0, 0, 170);
  sky.addColorStop(0, ['#6F8FB0', '#B48A62', '#7E9AA8'][seed % 3]); sky.addColorStop(1, '#E8D9B8'); x.fillStyle = sky; x.fillRect(0, 0, 384, 256);
  for (let k = 0; k < 3; k++) { x.fillStyle = ['#56604A', '#46503C', '#343C2C'][k]; x.beginPath(); x.moveTo(0, 256); let y = 120 + k * 35 + r() * 20; x.lineTo(0, y); for (let X = 0; X <= 384; X += 24) { y += (r() - 0.5) * 26; x.lineTo(X, Math.min(240, Math.max(90 + k * 30, y))); } x.lineTo(384, 256); x.fill(); }
  x.fillStyle = 'rgba(70,95,110,.85)'; x.fillRect(0, 205, 384, 51);
  for (let i = 0; i < 2500; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,240,210'},${0.05 * r()})`; x.fillRect(r() * 384, r() * 256, 2, 2); }   // brush texture and old varnish
  x.fillStyle = 'rgba(120,80,20,.12)'; x.fillRect(0, 0, 384, 256);
  return c;
}
export function ctWindow(): HTMLCanvasElement {
  const [c, x] = ctCanvas(128, 256), g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#DDEBFA'); g.addColorStop(0.6, '#F7F2E6'); g.addColorStop(1, '#FFF6DE'); x.fillStyle = g; x.fillRect(0, 0, 128, 256);
  x.strokeStyle = '#2B2117'; x.lineWidth = 5; for (let i = 1; i < 3; i++) { x.beginPath(); x.moveTo(i * 128 / 3, 0); x.lineTo(i * 128 / 3, 256); x.stroke(); }
  for (let j = 1; j < 6; j++) { x.beginPath(); x.moveTo(0, j * 256 / 6); x.lineTo(128, j * 256 / 6); x.stroke(); }
  return c;
}
export function ctShaft(): HTMLCanvasElement {
  const [c, x] = ctCanvas(64, 256), g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, 'rgba(255,236,200,.9)'); g.addColorStop(1, 'rgba(255,236,200,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 256); const s = x.createLinearGradient(0, 0, 64, 0); s.addColorStop(0, 'rgba(0,0,0,1)'); s.addColorStop(0.2, 'rgba(0,0,0,0)'); s.addColorStop(0.8, 'rgba(0,0,0,0)'); s.addColorStop(1, 'rgba(0,0,0,1)');
  x.globalCompositeOperation = 'destination-out'; x.fillStyle = s; x.fillRect(0, 0, 64, 256); return c;
}
export function ctClock(): HTMLCanvasElement {
  const [c, x] = ctCanvas(256, 256); x.fillStyle = '#F4EEDF'; x.beginPath(); x.arc(128, 128, 124, 0, 6.3); x.fill();
  x.strokeStyle = '#2A2016'; x.lineWidth = 6; x.stroke(); x.fillStyle = '#2A2016'; x.font = '600 26px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'].forEach((n, i) => { const a = i / 12 * 6.283 - Math.PI / 2; x.fillText(n, 128 + Math.cos(a) * 96, 128 + Math.sin(a) * 96); });
  return c;
}
/** An exhibit on the court's screens. */
export function ctExhibitDraw(cv: HTMLCanvasElement, ex: any) {
  const x = cv.getContext('2d') as CanvasRenderingContext2D, W = cv.width, H = cv.height;
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0E1E33'); g.addColorStop(1, '#08121F'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  if (!ex) { x.fillStyle = '#C8963E'; x.font = '600 44px Georgia, serif'; x.textAlign = 'center'; x.fillText('Court in session', W / 2, H / 2); x.textAlign = 'left'; return; }
  x.fillStyle = '#F2D18A'; x.font = '700 40px Inter, Arial, sans-serif'; x.fillText(ex.title, 48, 76);
  x.fillStyle = 'rgba(242,209,138,.5)'; x.fillRect(48, 96, W - 96, 3);
  x.font = '30px Inter, Arial, sans-serif';
  (ex.rows || []).slice(0, 6).forEach((r: string[], i: number) => { x.fillStyle = '#8FA6BD'; x.fillText(r[0], 48, 156 + i * 62); x.fillStyle = '#EAF2FA'; const v = String(r[1]); x.fillText(v.length > 44 ? v.slice(0, 43) + '…' : v, 420, 156 + i * 62); });
}

/* ---------- building the room ---------- */
