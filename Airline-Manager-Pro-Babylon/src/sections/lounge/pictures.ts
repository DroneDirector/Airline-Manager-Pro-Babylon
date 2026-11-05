// The lounge's drawn pictures (our own, made in code): wood, plaster, stone, leather, the carpet, the view from the
// windows, the paintings, the flight boards, the fire's flames, the welcome mat. The same as the main game's.

export function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d') as CanvasRenderingContext2D]; }
export function rng(seed: number) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; }

export function wood(base: string, dark: string, seed: number, w = 512, h = 512, figure = 1): HTMLCanvasElement {
  const [c, x] = canvas(w, h), r = rng(seed);
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
export function noise(base: string, amt: number, seed: number, n = 256, dots = 6000): HTMLCanvasElement {
  const [c, x] = canvas(n, n), r = rng(seed); x.fillStyle = base; x.fillRect(0, 0, n, n);
  for (let i = 0; i < dots; i++) { x.fillStyle = r() < 0.5 ? `rgba(0,0,0,${amt * r()})` : `rgba(255,255,255,${amt * r() * 0.6})`; x.fillRect(r() * n, r() * n, 1 + r() * 2, 1 + r() * 2); }
  return c;
}
export function leather(col: string): HTMLCanvasElement {
  const c = noise(col, 0.18, 21, 256, 9000), x = c.getContext('2d') as CanvasRenderingContext2D;
  x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 1.5;
  for (let i = -1; i < 5; i++) for (let j = -1; j < 5; j++) { x.beginPath(); x.moveTo(i * 64 + 32, j * 64); x.lineTo(i * 64 + 64, j * 64 + 32); x.lineTo(i * 64 + 32, j * 64 + 64); x.lineTo(i * 64, j * 64 + 32); x.closePath(); x.stroke(); x.fillStyle = 'rgba(0,0,0,.5)'; x.beginPath(); x.arc(i * 64 + 32, j * 64 + 32, 3, 0, 6.3); x.fill(); }
  return c;
}
/** Light oak laid in herringbone. */
export function herringbone(big: boolean): HTMLCanvasElement {
  const N = big ? 2048 : 1024, s = N / 1024, [c, x] = canvas(N, N), r = rng(64), pw = 64 * s, pl = 4 * pw / 2;
  x.fillStyle = '#B48A5C'; x.fillRect(0, 0, N, N);
  for (let i = -2; i < N / pw + 2; i++) for (let j = -4; j < N / pw * 2 + 4; j++) {
    const tone = 0.86 + r() * 0.26, col = `rgb(${Math.round(214 * tone)},${Math.round(178 * tone)},${Math.round(128 * tone)})`;
    x.save(); x.translate(i * pw * 2 + (j % 2 ? pw : 0), j * pw / 2); x.rotate(j % 2 ? -Math.PI / 4 : Math.PI / 4);
    const g = x.createLinearGradient(-pl / 2, 0, pl / 2, 0); g.addColorStop(0, col); g.addColorStop(0.5, `rgb(${Math.round(200 * tone)},${Math.round(164 * tone)},${Math.round(116 * tone)})`); g.addColorStop(1, col);
    x.fillStyle = g; x.fillRect(-pl / 2, -pw / 4, pl, pw / 2);
    x.strokeStyle = 'rgba(70,44,20,.10)'; x.lineWidth = 1; for (let k = 0; k < 5; k++) { const yy = -pw / 4 + r() * pw / 2; x.beginPath(); x.moveTo(-pl / 2, yy); x.lineTo(pl / 2, yy + (r() - 0.5) * 3); x.stroke(); }
    x.strokeStyle = 'rgba(60,36,16,.45)'; x.lineWidth = 1.5 * s; x.strokeRect(-pl / 2, -pw / 4, pl, pw / 2);
    x.restore();
  }
  return c;
}
export function plaster(base = '#EDE8E0'): HTMLCanvasElement {
  const [c, x] = canvas(512, 512), r = rng(31); x.fillStyle = base; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 40; i++) { const X = r() * 512, Y = r() * 512, R = 30 + r() * 90, gg = x.createRadialGradient(X, Y, 0, X, Y, R); gg.addColorStop(0, `rgba(${r() < 0.5 ? '255,255,255' : '120,110,100'},${0.025 + r() * 0.03})`); gg.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gg; x.fillRect(X - R, Y - R, R * 2, R * 2); }
  return c;
}
/** Black stone with fine gold veins. */
export function darkMarble(): HTMLCanvasElement {
  const [c, x] = canvas(1024, 1024), r = rng(77); x.fillStyle = '#1B1B1D'; x.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(255,255,255,${r() * 0.03})`; x.fillRect(r() * 1024, r() * 1024, 2, 2); }
  for (let i = 0; i < 9; i++) { x.strokeStyle = `rgba(${190 + r() * 40},${150 + r() * 30},${80 + r() * 20},${0.25 + r() * 0.4})`; x.lineWidth = 0.6 + r() * 1.8; x.beginPath(); let X = r() * 1024, Y = 0; x.moveTo(X, Y); while (Y < 1024) { X += (r() - 0.5) * 80; Y += 15 + r() * 45; x.lineTo(X, Y); } x.stroke(); }
  return c;
}
/** The Business lounge's carpet: navy with a gold lattice. */
export function carpet(): HTMLCanvasElement {
  const N = 1024, [c, x] = canvas(N, N), r = rng(92), s = 1;
  x.fillStyle = '#1C2C4A'; x.fillRect(0, 0, N, N);
  for (let i = 0; i < 80000; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '120,150,200' : '0,0,0'},${r() * 0.07})`; x.fillRect(r() * N, r() * N, 1.5, 1.5); }
  x.strokeStyle = 'rgba(201,165,91,.75)'; x.lineWidth = 3 * s; const g = N / 12;
  for (let i = -12; i <= 24; i++) { x.beginPath(); x.moveTo(i * g, 0); x.lineTo(i * g + N, N); x.stroke(); x.beginPath(); x.moveTo(i * g, N); x.lineTo(i * g + N, 0); x.stroke(); }
  for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) { x.fillStyle = 'rgba(201,165,91,.85)'; x.beginPath(); x.arc((i + 0.5) * g, (j + 0.5) * g, 5, 0, 6.3); x.fill(); }
  x.strokeStyle = '#C9A55B'; x.lineWidth = 10; x.strokeRect(30, 30, N - 60, N - 60); x.strokeStyle = '#0E1729'; x.lineWidth = 50; x.strokeRect(0, 0, N, N);
  return c;
}
/** The view from the windows: the apron and the runway beyond, aircraft at their stands, the sky at this hour. */
export function view(): HTMLCanvasElement {
  const [c, x] = canvas(2048, 512), r = rng(17), h = new Date().getHours() + new Date().getMinutes() / 60;
  const night = h < 6.5 || h > 20.5, low = !night && (h < 8.5 || h > 18.5);
  const top = night ? '#070D1C' : low ? '#3E5C8E' : '#5E95D4', hz = night ? '#141E36' : low ? '#F2A86A' : '#CFE2F2';
  const g = x.createLinearGradient(0, 0, 0, 330); g.addColorStop(0, top); g.addColorStop(1, hz); x.fillStyle = g; x.fillRect(0, 0, 2048, 512);
  if (night) for (let i = 0; i < 300; i++) { x.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.6})`; x.fillRect(r() * 2048, r() * 260, 1.5, 1.5); }
  x.fillStyle = night ? '#1A2027' : '#6E7880'; x.fillRect(0, 300, 2048, 40);
  for (let i = 0; i < 6; i++) { x.fillStyle = night ? '#232A33' : '#8C969F'; const X = 80 + i * 340, w = 220 + r() * 80; x.fillRect(X, 260 - r() * 30, w, 80); }
  x.fillStyle = night ? '#16191E' : '#5C636B'; x.fillRect(0, 340, 2048, 172);
  x.strokeStyle = night ? '#C9A227' : '#E8D27A'; x.lineWidth = 3; x.setLineDash([24, 18]); x.beginPath(); x.moveTo(0, 420); x.lineTo(2048, 400); x.stroke(); x.setLineDash([]);
  for (let i = 0; i < 4; i++) { const X = 160 + i * 480, Y = 395 - i * 4, k = 0.8 + r() * 0.3; x.save(); x.translate(X, Y); x.scale(k, k);
    x.fillStyle = night ? '#9AA4AE' : '#F2F4F6'; x.beginPath(); x.ellipse(0, 0, 150, 16, 0, 0, 6.3); x.fill();
    x.fillStyle = '#2C8CFF'; x.beginPath(); x.moveTo(110, -6); x.lineTo(150, -70); x.lineTo(168, -70); x.lineTo(150, -4); x.fill();
    x.fillStyle = night ? '#7A848E' : '#D3D9DF'; x.beginPath(); x.moveTo(-20, 6); x.lineTo(70, 34); x.lineTo(90, 34); x.lineTo(30, 4); x.fill();
    if (night) { x.fillStyle = '#FFE9A8'; for (let w = 0; w < 18; w++) x.fillRect(-110 + w * 11, -4, 5, 4); x.fillStyle = '#FF3B30'; x.fillRect(-2, -18, 4, 4); }
    x.restore(); }
  if (night) for (let i = 0; i < 40; i++) { x.fillStyle = i % 3 ? '#4FA3FF' : '#FFD27A'; x.fillRect(i * 52 + 10, 345, 4, 3); }
  return c;
}
/** How light it is outside now (0 night … 1 midday), for the sunlight through the windows. */
export function daylight(): number { const h = new Date().getHours() + new Date().getMinutes() / 60; return Math.max(0, Math.min(1, Math.sin((h - 6) / 14 * Math.PI) * 1.3)); }

const PAL: { [k: string]: string[] } = {
  aurora: ['#07131F', '#0E2C3A', '#2BD49A', '#9BF2C9', '#6B5BD6', '#1E3B2E'], dusk: ['#2A1A3A', '#C2556A', '#F1A25B', '#FBE3A8', '#3A2A4A', '#1A1424'],
  storm: ['#1D2830', '#46606E', '#9DB4BE', '#E7EEF0', '#2A3540', '#C7A15A'], gold: ['#1A1206', '#6A4A1A', '#D9A441', '#F5DFA0', '#3C2A12', '#FFF4D6'],
};
/** The lounge's paintings: the northern lights, a climb into the dusk, a storm over the sea, arcs of gold. */
export function painting(kind: string, w: number, h: number): HTMLCanvasElement {
  const N = 768, W2 = N, H2 = Math.round(N * h / w), [c, x] = canvas(W2, H2), r = rng(kind.length * 97 + 3), pal = PAL[kind] || PAL.gold;
  const stroke = (col: string, x0: number, y0: number, len: number, ang: number, wd: number) => { x.save(); x.translate(x0, y0); x.rotate(ang); x.fillStyle = col; x.globalAlpha = 0.35 + r() * 0.5; x.beginPath(); x.ellipse(0, 0, len, wd, 0, 0, 7); x.fill(); x.restore(); };
  const g = x.createLinearGradient(0, 0, 0, H2); g.addColorStop(0, pal[0]); g.addColorStop(0.55, pal[1]); g.addColorStop(1, pal[5]); x.fillStyle = g; x.fillRect(0, 0, W2, H2);
  for (let i = 0; i < 1400; i++) { const y = r() * H2, t = y / H2; stroke(pal[t < 0.5 ? (r() < 0.6 ? 1 : 0) : (r() < 0.5 ? 4 : 5)], r() * W2, y, 10 + r() * 30, (r() - 0.5) * 0.4, 1.5 + r() * 3); }
  if (kind === 'aurora') { for (let b = 0; b < 3; b++) for (let i = 0; i < 260; i++) { const xx = i / 260 * W2, yy = H2 * (0.15 + b * 0.12) + Math.sin(i / 30 + b) * 40; stroke(pal[2 + (b % 2)], xx, yy + r() * 60, 4 + r() * 6, Math.PI / 2 + (r() - 0.5) * 0.3, 1 + r() * 2); }
    x.globalAlpha = 1; x.fillStyle = '#0A1410'; x.beginPath(); x.moveTo(0, H2 * 0.78); for (let i = 0; i <= 20; i++) x.lineTo(i / 20 * W2, H2 * (0.7 + 0.12 * Math.sin(i * 1.3) * r())); x.lineTo(W2, H2); x.lineTo(0, H2); x.fill(); }
  if (kind === 'dusk') { x.globalAlpha = 0.9; const sg = x.createRadialGradient(W2 * 0.3, H2 * 0.62, 5, W2 * 0.3, H2 * 0.62, H2 * 0.45); sg.addColorStop(0, '#FFF0C0'); sg.addColorStop(0.2, 'rgba(250,180,90,.8)'); sg.addColorStop(1, 'rgba(250,120,90,0)'); x.fillStyle = sg; x.fillRect(0, 0, W2, H2);
    x.globalAlpha = 1; x.strokeStyle = 'rgba(255,240,220,.85)'; x.lineWidth = 3; x.beginPath(); x.moveTo(W2 * 0.05, H2 * 0.5); x.quadraticCurveTo(W2 * 0.5, H2 * 0.25, W2 * 0.95, H2 * 0.12); x.stroke();
    x.fillStyle = '#2A1A30'; x.beginPath(); x.moveTo(W2 * 0.95, H2 * 0.12); x.lineTo(W2 * 0.88, H2 * 0.13); x.lineTo(W2 * 0.86, H2 * 0.16); x.closePath(); x.fill(); }
  if (kind === 'storm') { for (let i = 0; i < 500; i++) stroke(pal[3], r() * W2, H2 * (0.2 + r() * 0.35), 20 + r() * 50, (r() - 0.5) * 0.2, 4 + r() * 8); x.globalAlpha = 1; x.fillStyle = '#C7A15A'; for (let i = 0; i < 30; i++) { x.beginPath(); x.arc(W2 * (0.1 + i * 0.028), H2 * (0.82 + Math.sin(i) * 0.01), 2.5, 0, 7); x.fill(); } }
  if (kind === 'gold') { x.globalAlpha = 0.85; for (let i = 0; i < 9; i++) { x.strokeStyle = i % 2 ? pal[3] : pal[2]; x.lineWidth = 3 + i; x.beginPath(); x.arc(W2 * 0.5, H2 * 1.4, H2 * (0.6 + i * 0.09), Math.PI * 1.15, Math.PI * 1.85); x.stroke(); } }
  x.globalAlpha = 1; x.fillStyle = 'rgba(255,255,255,.04)'; for (let i = 0; i < 4000; i++) x.fillRect(r() * W2, r() * H2, 1, 1);
  return c;
}
/** A demonstration timetable for the flight boards (the main game's own flights come when its data is brought over). */
const CITIES = ['Copenhagen', 'Reykjavík', 'Bergen', 'Edinburgh', 'Oslo', 'Billund', 'London', 'Aalborg', 'Paris', 'Stockholm', 'Amsterdam', 'Barcelona'];
export function board(c: HTMLCanvasElement, kind: 'dep' | 'arr') {
  const x = c.getContext('2d') as CanvasRenderingContext2D, W = c.width, H = c.height, now = new Date(), nm = now.getHours() * 60 + now.getMinutes();
  x.fillStyle = '#0A1220'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#F2C230'; x.font = '700 64px Arial, sans-serif'; x.fillText(kind === 'dep' ? 'Departures' : 'Arrivals', 50, 95);
  x.fillStyle = '#9FB6CC'; x.font = '600 40px Arial, sans-serif'; x.fillText(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`, W - 170, 92);
  x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(40, 125, W - 80, 3);
  const hm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(Math.round(m % 60)).padStart(2, '0')}`;
  x.font = '600 46px Arial, sans-serif';
  for (let i = 0; i < 8; i++) {
    const m = Math.floor(nm / 20) * 20 + 20 * i + (kind === 'dep' ? 5 : 0), city = CITIES[(Math.floor(m / 20) * 7 + (kind === 'dep' ? 3 : 5)) % CITIES.length], y = 200 + i * 86;
    x.fillStyle = i % 2 ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,0)'; x.fillRect(0, y - 58, W, 86);
    x.fillStyle = '#EAF2FA'; x.fillText(hm(m), 50, y); x.fillText(city, 250, y); x.fillStyle = '#9FB6CC'; x.fillText('AMP' + (100 + (Math.floor(m / 20) * 13) % 900), W - 640, y);
    const soon = m - nm < 35; x.fillStyle = soon ? (kind === 'dep' ? '#3FD0A0' : '#7FC4F5') : '#7FC4F5'; x.fillText(soon ? (kind === 'dep' ? 'Boarding' : 'Landed') : 'On time', W - 330, y);
  }
}
/** A flame for the fire's particles: soft, hot in the middle. */
export function flame(): HTMLCanvasElement {
  const [c, x] = canvas(128, 128), g = x.createRadialGradient(64, 64, 2, 64, 64, 62);
  g.addColorStop(0, 'rgba(255,245,210,1)'); g.addColorStop(0.3, 'rgba(255,170,60,.85)'); g.addColorStop(0.7, 'rgba(255,80,10,.35)'); g.addColorStop(1, 'rgba(255,40,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return c;
}
export function welcomeMat(): HTMLCanvasElement {
  const [c, x] = canvas(512, 256); x.fillStyle = '#23262B'; x.fillRect(0, 0, 512, 256); x.strokeStyle = '#C9A25E'; x.lineWidth = 6; x.strokeRect(14, 14, 484, 228);
  x.fillStyle = '#C9A25E'; x.font = '600 44px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('WELCOME', 256, 130); return c;
}
export function sign(text: string, bg: string, fg: string, w = 512, h = 128, font = '700 48px Georgia, serif'): HTMLCanvasElement {
  const [c, x] = canvas(w, h); x.fillStyle = bg; x.fillRect(0, 0, w, h); x.fillStyle = fg; x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, w / 2, h / 2 + 2); return c;
}
export function label(name: string, bg: string): HTMLCanvasElement {
  const [c, k] = canvas(256, 128); k.fillStyle = bg; k.fillRect(0, 0, 256, 128);
  const dark = parseInt(bg.slice(1), 16) < 0x808080; k.fillStyle = dark ? '#E9D9A6' : '#2A1E14'; k.strokeStyle = k.fillStyle; k.lineWidth = 3; k.strokeRect(10, 10, 236, 108);
  k.textAlign = 'center'; k.font = '700 26px Georgia, serif'; k.fillText(name.toUpperCase().slice(0, 16), 128, 70); return c;
}
