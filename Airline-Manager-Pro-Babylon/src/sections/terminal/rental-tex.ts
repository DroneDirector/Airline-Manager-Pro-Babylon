// The rental car centre's textures, painted on canvases: the timber of the wing's underside, the perforated aluminium
// of the garage's skin (its holes growing and shrinking in waves), the decks with their bay lines, paving, asphalt,
// terrazzo, the hall's ceiling slats, bark and leaves.
let seed = 911; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const cv = (w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d') as CanvasRenderingContext2D]; };
const speckle = (x: CanvasRenderingContext2D, w: number, h: number, amt: number, dots: number, size = 2) => { for (let i = 0; i < dots; i++) { const v = (rnd() - 0.5) * amt; x.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`; x.fillRect(rnd() * w, rnd() * h, size * rnd() + 0.5, size * rnd() + 0.5); } };

export const RT = {
  /** timber boards with grain and dark joints; vertical or horizontal */
  planks(base: string, dark: string, vertical = true, boards = 12, n = 1024) { const [c, x] = cv(n, n), bw = n / boards;
    for (let b = 0; b < boards; b++) { const sh = (rnd() - 0.5) * 0.24, o = b * bw; x.fillStyle = base; if (vertical) x.fillRect(o, 0, bw, n); else x.fillRect(0, o, n, bw);
      x.fillStyle = sh > 0 ? `rgba(255,236,210,${sh})` : `rgba(40,18,4,${-sh})`; if (vertical) x.fillRect(o, 0, bw, n); else x.fillRect(0, o, n, bw);
      for (let g = 0; g < 34; g++) { x.strokeStyle = dark; x.globalAlpha = 0.06 + rnd() * 0.16; x.lineWidth = 0.6 + rnd() * 1.8; x.beginPath(); const p = o + rnd() * bw, f = 50 + rnd() * 40, ph = rnd() * 6;
        for (let t = 0; t <= n; t += 12) { const w = Math.sin(t / f + ph) * 2.4; if (vertical) x.lineTo(p + w, t); else x.lineTo(t, p + w); } x.stroke(); }
      for (let k = 0; k < 2; k++) if (rnd() > 0.55) { x.globalAlpha = 0.35; x.fillStyle = dark; x.beginPath(); const a = vertical ? o + bw * (0.3 + rnd() * 0.4) : rnd() * n, bb = vertical ? rnd() * n : o + bw * (0.3 + rnd() * 0.4); x.ellipse(a, bb, vertical ? 3 : 7, vertical ? 7 : 3, 0, 0, 7); x.fill(); }
      x.globalAlpha = 1; x.fillStyle = 'rgba(25,12,4,.8)'; if (vertical) x.fillRect(o, 0, 3, n); else x.fillRect(0, o, n, 3); }
    return c; },
  /** perforated aluminium: holes cut right through (alpha), growing and shrinking in slow waves */
  perforated(base = '#D8DDE3', n = 1024, step = 22) { const [c, x] = cv(n, n); const g = x.createLinearGradient(0, 0, n, n); g.addColorStop(0, base); g.addColorStop(0.5, '#E9EDF1'); g.addColorStop(1, base); x.fillStyle = g; x.fillRect(0, 0, n, n); speckle(x, n, n, 0.05, 12000);
    x.strokeStyle = 'rgba(80,90,100,.35)'; x.lineWidth = 2; x.strokeRect(1, 1, n - 2, n - 2);
    x.globalCompositeOperation = 'destination-out'; for (let j = 0; j < n / step; j++) for (let i = 0; i < n / step; i++) { const r = step * (0.08 + 0.3 * (0.5 + 0.5 * Math.sin(i / 6 + j / 10) * Math.cos(j / 7 - i / 13))); x.beginPath(); x.arc(i * step + (j % 2) * step / 2 + step / 2, j * step + step / 2, r, 0, 7); x.fill(); }
    x.globalCompositeOperation = 'source-over'; return c; },
  /** board-marked concrete */
  concrete(base = '#BEBBB4', n = 512) { const [c, x] = cv(n, n); x.fillStyle = base; x.fillRect(0, 0, n, n); for (let i = 0; i < 46; i++) { x.fillStyle = `rgba(${rnd() > 0.5 ? '255,255,255' : '60,55,50'},${0.05 * rnd()})`; x.beginPath(); x.ellipse(rnd() * n, rnd() * n, 30 + rnd() * 90, 20 + rnd() * 60, rnd() * 3, 0, 7); x.fill(); }
    speckle(x, n, n, 0.14, 18000); for (let y = 0; y < n; y += n / 8) { x.fillStyle = 'rgba(70,65,58,.12)'; x.fillRect(0, y, n, 2); } x.strokeStyle = 'rgba(70,65,60,.3)'; x.lineWidth = 1.5; x.strokeRect(1, 1, n - 2, n - 2);
    for (const [a, b] of [[n / 4, n / 4], [3 * n / 4, n / 4], [n / 4, 3 * n / 4], [3 * n / 4, 3 * n / 4]]) { x.fillStyle = 'rgba(60,55,50,.35)'; x.beginPath(); x.arc(a, b, 3, 0, 7); x.fill(); } return c; },
  /** a garage deck strip, 2.5 m across and 46 m along: concrete, the bays' white lines, arrows in the aisles */
  deck() { const [c, x] = cv(64, 1178); x.fillStyle = '#A09E98'; x.fillRect(0, 0, 64, 1178); speckle(x, 64, 1178, 0.16, 7000, 1.5); const s = 1178 / 46; x.fillStyle = '#F2F2EE';
    for (const [a, b] of [[1, 6], [12, 22], [28, 38]]) x.fillRect(0, a * s, 3, (b - a) * s); for (const z of [1, 6, 12, 17, 22, 28, 33, 38]) x.fillRect(0, z * s - 1, 64, 2);
    x.fillStyle = 'rgba(255,255,255,.6)'; for (const z of [9, 25, 42]) x.fillRect(28, z * s - 10, 8, 20); for (let k = 0; k < 6; k++) { x.fillStyle = 'rgba(40,40,40,.08)'; x.fillRect(rnd() * 64, rnd() * 1178, 10, 30); } return c; },
  paving(n = 1024) { const [c, x] = cv(n, n), w = n / 4, h = n / 8; x.fillStyle = '#CFCAC0'; x.fillRect(0, 0, n, n);
    for (let j = 0; j < 8; j++) for (let i = -1; i < 4; i++) { const s = (rnd() - 0.5) * 0.14; x.fillStyle = s > 0 ? `rgba(255,255,255,${s})` : `rgba(0,0,0,${-s})`; x.fillRect(i * w + (j % 2) * w / 2, j * h, w - 2, h - 2); }
    speckle(x, n, n, 0.14, 26000); x.strokeStyle = 'rgba(95,90,82,.55)'; x.lineWidth = 2.5;
    for (let j = 0; j <= 8; j++) { x.beginPath(); x.moveTo(0, j * h); x.lineTo(n, j * h); x.stroke(); for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * w + (j % 2) * w / 2, j * h); x.lineTo(i * w + (j % 2) * w / 2, j * h + h); x.stroke(); } } return c; },
  asphalt(n = 512) { const [c, x] = cv(n, n); x.fillStyle = '#3A3D42'; x.fillRect(0, 0, n, n); speckle(x, n, n, 0.3, 60000, 1.4); for (let i = 0; i < 24; i++) { x.fillStyle = 'rgba(18,18,20,.12)'; x.beginPath(); x.ellipse(rnd() * n, rnd() * n, 20 + rnd() * 70, 10 + rnd() * 30, rnd() * 3, 0, 7); x.fill(); } return c; },
  terrazzo(n = 1024) { const [c, x] = cv(n, n); x.fillStyle = '#E8E6EA'; x.fillRect(0, 0, n, n); for (let i = 0; i < 26000; i++) { x.fillStyle = ['#9AA0A8', '#C8B8A0', '#FFFFFF', '#6E7680', '#B9C4CC'][i % 5]; x.globalAlpha = 0.5 + rnd() * 0.5; const r = 0.6 + rnd() * 2.4; x.beginPath(); x.ellipse(rnd() * n, rnd() * n, r, r * (0.5 + rnd() * 0.5), rnd() * 3, 0, 7); x.fill(); }
    x.globalAlpha = 1; x.strokeStyle = 'rgba(150,150,155,.5)'; x.lineWidth = 2; x.strokeRect(1, 1, n - 2, n - 2); return c; },
  bark() { const [c, x] = cv(128, 512); x.fillStyle = '#E8E4DC'; x.fillRect(0, 0, 128, 512); for (let i = 0; i < 90; i++) { x.fillStyle = 'rgba(40,36,32,.8)'; x.fillRect(rnd() * 128, rnd() * 512, 6 + rnd() * 26, 2 + rnd() * 3); } speckle(x, 128, 512, 0.2, 3000); return c; },
  leaves(base: string) { const [c, x] = cv(256, 256); x.fillStyle = base; x.fillRect(0, 0, 256, 256); for (let i = 0; i < 2600; i++) { x.fillStyle = `rgba(${rnd() > 0.5 ? '170,200,110' : '20,45,20'},${0.15 + rnd() * 0.3})`; x.beginPath(); x.ellipse(rnd() * 256, rnd() * 256, 2 + rnd() * 4, 1 + rnd() * 2, rnd() * 3, 0, 7); x.fill(); } return c; },
  /** the number plate */
  plate(text: string) { const [c, x] = cv(256, 64); x.fillStyle = '#F4F4F0'; x.fillRect(0, 0, 256, 64); x.fillStyle = '#1F4E8C'; x.fillRect(0, 0, 30, 64); x.strokeStyle = '#111'; x.lineWidth = 4; x.strokeRect(2, 2, 252, 60); x.fillStyle = '#111'; x.font = '700 40px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 143, 34); return c; },
};
