// Aircraft models built from each type's real dimensions (src/data/aircraft-shapes.ts): the fuselage with
// its nose, tail cone and windows, swept and tapered wings with their wingtips, flaps, the tail, engines
// with pylons or propellers, landing gear, floats, struts and pods, painted in the airline's livery.
// The same model is drawn in the 3D view and, rendered once per type and livery, as the aircraft pictures
// throughout the app. Light to draw: a few dozen simple meshes and one painted texture per aircraft.


/** How an airline paints its aircraft. */
interface Livery {
  style: 'swoosh' | 'stripe' | 'belly' | 'tail' | 'full' | 'nose';
  body: string;        // fuselage
  c1: string;          // main colour
  c2: string;          // second colour
  belly: string;       // underside
  tail: 'gradient' | 'solid' | 'split' | 'white';
  engines: 'body' | 'c1' | 'c2' | 'metal';
  titles: string;      // name on the fuselage ('' for none)
  emblem: boolean;     // the star on the fin
}

function defaultLivery(color: string, color2: string, name?: string): Livery {
  return { style: 'swoosh', body: '#F4F6F8', c1: color || '#2C8CFF', c2: color2 || '#0B2A55', belly: '#C9D0D8', tail: 'gradient', engines: 'c1', titles: name || '', emblem: true };
}

/* ---------- the fuselage's shape ---------- */

function _ss(x: number) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }

/** Top, bottom (z) and half width of the fuselage at x. */
function fusSection(s: ShapeSpec, x: number): { zt: number; zb: number; hw: number; zc: number } {
  const g = s.ground, h = s.h, top = g + h, bot = g;
  let zt = top, zb = bot, hw = s.w / 2;
  if (x < s.nose) {
    const u = Math.max(0.012, x / s.nose), tipZ = g + s.tip * h;
    const f = (p: number) => Math.pow(1 - Math.pow(1 - u, p), 1 / p);
    zt = tipZ + (top - tipZ) * f(s.pTop);
    zb = tipZ - (tipZ - bot) * f(s.pBot);
    hw = s.w / 2 * f(2.15);
  } else if (x > s.L - s.tail) {
    const v = clamp((x - (s.L - s.tail)) / s.tail, 0, 1);
    const endC = g + s.tailEnd * h, endH = Math.max(0.08, h * 0.07);
    zb = bot + (endC - endH - bot) * Math.pow(v, 1.35);
    zt = top + (endC + endH - top) * Math.pow(v, s.drop ? 1.05 : 2.4);
    hw = s.w / 2 * (1 - 0.9 * Math.pow(v, 1.25));
  }
  const zc = (zt + zb) / 2;   // the centre without the upper deck: the deck only raises the top
  if (s.hump) { const u = clamp(x / (s.nose * 0.95), 0, 1); zt += s.hump.h * Math.pow(1 - Math.pow(1 - u, 2.2), 1 / 2.2) * (1 - _ss((x - (s.hump.end - 7)) / 7)); }
  return { zt, zb, hw, zc };
}

/** How square the fuselage is (2 round, larger for the boxy utility aircraft). */
function fusSquare(s: ShapeSpec) { return s.cockpit === 'utility' ? 2.9 : s.cockpit === 'ga' ? 2.4 : s.cockpit === 'atr' || s.cockpit === 'crj' ? 2.1 : 2.02; }

/** A point on the fuselage surface: angle a from the bottom (0) round the right side (π/2) to the top (π). */
function fusPoint(s: ShapeSpec, sec: { zt: number; zb: number; hw: number; zc: number }, a: number): number[] {
  const n = fusSquare(s), sn = Math.sin(a), cs = Math.cos(a);
  const sp = (v: number) => Math.sign(v) * Math.pow(Math.abs(v), 2 / n);
  return [sec.hw * sp(sn), sec.zc - (cs > 0 ? sec.zc - sec.zb : sec.zt - sec.zc) * sp(cs)];
}

/** The angle of the window line (height z) at x, on the right side. */
function fusAngleAt(s: ShapeSpec, x: number, z: number): number {
  const sec = fusSection(s, x), n = fusSquare(s), zc0 = sec.zc;
  const r = z < zc0 ? (zc0 - z) / Math.max(0.01, zc0 - sec.zb) : -(z - zc0) / Math.max(0.01, sec.zt - zc0);
  const c = Math.sign(r) * Math.pow(Math.min(1, Math.abs(r)), n / 2);
  return Math.acos(clamp(c, -1, 1));
}

/* ---------- the livery, painted on the fuselage ---------- */

const AC_TEX_W = 2048, AC_TEX_H = 512;

function paintFuselage(s: ShapeSpec, lv: Livery): HTMLCanvasElement {
  const cv = document.createElement('canvas'); cv.width = AC_TEX_W; cv.height = AC_TEX_H;
  const c = cv.getContext('2d'), W = AC_TEX_W, Hh = AC_TEX_H;
  const U = (x: number) => x / s.L * W, V = (a: number) => a / (2 * Math.PI) * Hh;
  const both = (fn: (sideV: (a: number) => number, right: boolean) => void) => { fn(a => V(a), true); fn(a => V(2 * Math.PI - a), false); };
  const angle = (x: number, z: number) => fusAngleAt(s, clamp(x, 0.05, s.L - 0.05), z);
  // a band between two heights along the whole fuselage, on both sides
  const band = (z0: number, z1: number, x0: number, x1: number, col: string) => {
    both(sv => {
      c.beginPath();
      const N = 60;
      for (let i = 0; i <= N; i++) { const x = x0 + (x1 - x0) * i / N; const p = [U(x), sv(angle(x, z0))]; i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); }
      for (let i = N; i >= 0; i--) { const x = x0 + (x1 - x0) * i / N; c.lineTo(U(x), sv(angle(x, z1))); }
      c.closePath(); c.fillStyle = col; c.fill();
    });
  };
  // a shape given in (x, height) points
  const poly = (pts: number[][], col: string) => {
    both(sv => { c.beginPath(); pts.forEach((p, i) => { const q = [U(p[0]), sv(angle(p[0], p[1]))]; i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }); c.closePath(); c.fillStyle = col; c.fill(); });
  };
  const g = s.ground, h = s.h, zw = g + s.win.z * h;

  c.fillStyle = lv.body; c.fillRect(0, 0, W, Hh);
  // the underside
  const airliner = s.L > 20;
  if (airliner || lv.style === 'belly') { c.fillStyle = lv.belly; c.fillRect(0, 0, W, V(lv.style === 'belly' ? 0.95 : 0.62)); c.fillRect(0, V(2 * Math.PI - (lv.style === 'belly' ? 0.95 : 0.62)), W, Hh); }

  const tailX0 = s.L - s.tail;
  if (lv.style === 'full') {
    band(g - 1, zw - h * 0.14, -1, s.L + 1, lv.c1);
  } else if (lv.style === 'stripe') {
    band(zw - h * 0.2, zw - h * 0.12, -1, s.L + 1, lv.c1);
    band(zw - h * 0.11, zw - h * 0.085, -1, s.L + 1, lv.c2);
  } else if (lv.style === 'nose') {
    poly([[-0.1, g - 1], [s.nose * 1.2, g - 1], [s.nose * 0.6, g + h * 2], [-0.1, g + h * 2]], lv.c1);
    band(zw - h * 0.17, zw - h * 0.12, -1, s.L + 1, lv.c1);
  } else if (lv.style === 'belly') {
    band(zw - h * 0.17, zw - h * 0.13, -1, s.L + 1, lv.c1);
  } else if (lv.style === 'swoosh') {
    band(zw - h * 0.19, zw - h * 0.11, -1, s.L * 0.7, lv.c1);
    band(zw - h * 0.1, zw - h * 0.075, -1, s.L * 0.7, lv.c2);
  }
  if (lv.style === 'swoosh' || lv.style === 'tail') {
    // a sweep of colour rising from the belly to the fin
    const x0 = tailX0 - s.tail * (lv.style === 'tail' ? 0.15 : 0.55);
    const pts: number[][] = [];
    for (let i = 0; i <= 20; i++) { const k = i / 20, x = x0 + (s.L + 0.5 - x0) * k; pts.push([x, g - 0.5 + (h * 1.6) * Math.pow(k, 1.6)]); }
    pts.push([s.L + 1, g + h * 3], [s.L + 1, g - 1]);
    poly(pts, lv.c2);
    if (lv.style === 'swoosh') {
      const pts2: number[][] = [];
      for (let i = 0; i <= 20; i++) { const k = i / 20, x = x0 - s.tail * 0.25 + (s.L + 0.5 - x0 + s.tail * 0.25) * k; pts2.push([x, zw - h * 0.11 + h * 1.4 * Math.pow(k, 1.8)]); }
      for (let i = 20; i >= 0; i--) { const k = i / 20, x = x0 - s.tail * 0.25 + (s.L + 0.5 - x0 + s.tail * 0.25) * k; pts2.push([x, zw - h * 0.19 + h * 1.25 * Math.pow(k, 1.8)]); }
      poly(pts2, lv.c1);
    }
  }

  // passenger windows
  const ww = s.win.ww || 0.25, wh = s.win.wh || 0.36, big = !!s.win.big;
  const wx: number[] = [];
  for (let x = s.win.from; x <= s.win.to + 1e-6; x += s.win.pitch) {
    if (s.doors.some(d => Math.abs(d - x) < (airliner ? 0.75 : 0.55))) continue;
    if (airliner && s.eng.some(e => e.kind === 'tprop' && Math.abs(e.x + 0.2 - x) < 0.2)) continue;
    wx.push(x);
  }
  c.fillStyle = '#1C2531';
  both(sv => {
    for (const x of wx) {
      const a0 = angle(x, zw + wh / 2), a1 = angle(x, zw - wh / 2);
      const x0 = U(x - ww / 2), x1 = U(x + ww / 2), y0 = Math.min(sv(a0), sv(a1)), y1 = Math.max(sv(a0), sv(a1));
      const r = Math.min(x1 - x0, y1 - y0) * (big ? 0.18 : 0.48);
      c.beginPath(); (c as any).roundRect ? (c as any).roundRect(x0, y0, x1 - x0, y1 - y0, r) : c.rect(x0, y0, x1 - x0, y1 - y0); c.fill();
    }
  });
  // doors
  const dw = airliner ? 1.07 : 0.78, dh = airliner ? Math.min(1.93, h * 0.48) : h * 0.62;
  c.strokeStyle = 'rgba(70,82,96,.75)'; c.lineWidth = 2.2;
  both(sv => {
    for (const x of s.doors) {
      const zb = airliner ? zw - dh * 0.7 : g + h * 0.12, zt = zb + dh;
      const y0 = sv(angle(x, zt)), y1 = sv(angle(x, zb)), x0 = U(x - dw / 2), x1 = U(x + dw / 2);
      c.beginPath(); (c as any).roundRect ? (c as any).roundRect(x0, Math.min(y0, y1), x1 - x0, Math.abs(y1 - y0), 6) : c.rect(x0, Math.min(y0, y1), x1 - x0, Math.abs(y1 - y0)); c.stroke();
    }
  });
  // cockpit windows: each type family's own shape
  const ck = cockpitShape(s);
  for (const pane of ck) poly(pane, '#141C26');
  // the windscreen across the front
  const fx0 = ck.length ? ck[0][0][0] : s.nose * 0.4;
  c.fillStyle = '#141C26';
  const aF = angle(fx0 + 0.05, (ck.length ? ck[0][0][1] : zw) + h * 0.02), aT = Math.PI - 0.12;
  c.fillRect(U(fx0 - 0.02), V(aF), U(s.nose * 0.13), V(2 * Math.PI - aF) - V(aF));
  c.fillStyle = lv.body; c.fillRect(U(fx0 - 0.03), V(aT) - 1.5, U(s.nose * 0.15), V(2 * Math.PI - aT) - V(aT) + 3);

  // the airline's name, ahead of the wing above the windows
  if (lv.titles && airliner) {
    const fh = Math.min(h * 0.12, 0.85), zt0 = zw + (s.win.wh || 0.36) / 2 + h * 0.05;
    const x0 = s.doors[0] + 1.6, px = (fh / s.L) * W * 1.0;
    c.font = `700 ${Math.round(Math.abs(V(angle(x0 + 2, zt0)) - V(angle(x0 + 2, zt0 + fh))) * 0.95)}px Inter, Arial, sans-serif`;
    c.fillStyle = lv.c2; c.textBaseline = 'alphabetic';
    // left side: read nose to tail; right side: drawn turned round so it reads from the nose too
    const yL = V(2 * Math.PI - angle(x0, zt0));
    c.save(); c.translate(U(x0), yL); c.scale(1, 1); c.fillText(lv.titles.toUpperCase(), 0, 0); c.restore();
    const yR = V(angle(x0, zt0));
    c.save(); c.translate(U(x0), yR); c.scale(-1, -1);
    const tw = c.measureText(lv.titles.toUpperCase()).width; c.fillText(lv.titles.toUpperCase(), -tw * 0 - tw, 0); c.restore();
    void px;
  }
  return cv;
}

/** Cockpit side windows as shapes in (x, height) on the fuselage. */
function cockpitShape(s: ShapeSpec): number[][][] {
  const g = s.ground, h = s.h, n = s.nose, hz = (f: number) => g + f * h;
  switch (s.cockpit) {
    case 'airbus': return [[[n * 0.33, hz(0.66)], [n * 0.45, hz(0.8)], [n * 0.54, hz(0.83)], [n * 0.52, hz(0.67)]],
      [[n * 0.56, hz(0.66)], [n * 0.57, hz(0.83)], [n * 0.7, hz(0.85)], [n * 0.72, hz(0.69)], [n * 0.66, hz(0.66)]],
      [[n * 0.75, hz(0.7)], [n * 0.75, hz(0.85)], [n * 0.84, hz(0.86)], [n * 0.84, hz(0.72)]]];
    case 'a350': return [[[n * 0.3, hz(0.62)], [n * 0.42, hz(0.8)], [n * 0.6, hz(0.84)], [n * 0.74, hz(0.84)], [n * 0.76, hz(0.7)], [n * 0.56, hz(0.62)]]];
    case 'b737': return [[[n * 0.3, hz(0.64)], [n * 0.43, hz(0.82)], [n * 0.52, hz(0.83)], [n * 0.5, hz(0.66)]],
      [[n * 0.54, hz(0.67)], [n * 0.56, hz(0.83)], [n * 0.68, hz(0.86)], [n * 0.66, hz(0.7)]],
      [[n * 0.7, hz(0.72)], [n * 0.72, hz(0.86)], [n * 0.8, hz(0.88)], [n * 0.79, hz(0.74)]]];
    case 'b777': return [[[n * 0.33, hz(0.64)], [n * 0.46, hz(0.8)], [n * 0.55, hz(0.82)], [n * 0.53, hz(0.66)]],
      [[n * 0.57, hz(0.67)], [n * 0.58, hz(0.82)], [n * 0.7, hz(0.85)], [n * 0.68, hz(0.7)]]];
    case 'b787': return [[[n * 0.32, hz(0.63)], [n * 0.44, hz(0.79)], [n * 0.6, hz(0.83)], [n * 0.66, hz(0.82)], [n * 0.62, hz(0.66)]]];
    case 'b747': return [[[n * 0.18, hz(0.98)], [n * 0.27, hz(1.1)], [n * 0.36, hz(1.13)], [n * 0.36, hz(1.0)]],
      [[n * 0.39, hz(1.0)], [n * 0.39, hz(1.14)], [n * 0.5, hz(1.16)], [n * 0.5, hz(1.02)]]];
    case 'crj': return [[[n * 0.36, hz(0.64)], [n * 0.5, hz(0.84)], [n * 0.6, hz(0.86)], [n * 0.6, hz(0.66)]],
      [[n * 0.63, hz(0.66)], [n * 0.63, hz(0.86)], [n * 0.76, hz(0.87)], [n * 0.74, hz(0.67)]]];
    case 'atr': return [[[n * 0.36, hz(0.66)], [n * 0.5, hz(0.84)], [n * 0.6, hz(0.86)], [n * 0.6, hz(0.67)]],
      [[n * 0.63, hz(0.67)], [n * 0.63, hz(0.86)], [n * 0.78, hz(0.86)], [n * 0.76, hz(0.68)]]];
    case 'utility': return [[[n * 0.78, hz(0.6)], [n * 0.92, hz(0.92)], [n * 1.22, hz(0.94)], [n * 1.22, hz(0.6)]]];
    default: return [[[n * 0.9, hz(0.58)], [n * 1.05, hz(0.92)], [n * 1.6, hz(0.95)], [n * 1.6, hz(0.58)]]];
  }
}

/** The fin, painted: gradient or solid colours and an original star emblem. */
function paintFin(lv: Livery): HTMLCanvasElement {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256;
  const c = cv.getContext('2d');
  if (lv.tail === 'white') c.fillStyle = lv.body;
  else if (lv.tail === 'solid') c.fillStyle = lv.c1;
  else if (lv.tail === 'split') { c.fillStyle = lv.c1; c.fillRect(0, 0, 256, 256); c.fillStyle = lv.c2; c.beginPath(); c.moveTo(0, 256); c.lineTo(256, 70); c.lineTo(256, 256); c.fill(); c.fillStyle = 'transparent'; }
  else { const gr = c.createLinearGradient(0, 256, 256, 0); gr.addColorStop(0, lv.c2); gr.addColorStop(1, lv.c1); c.fillStyle = gr; }
  if (lv.tail !== 'split') c.fillRect(0, 0, 256, 256);
  if (lv.emblem) {
    const ex = 150, ey = 120, er = 46;
    c.fillStyle = lv.tail === 'white' ? lv.c1 : '#FFFFFF'; c.globalAlpha = 0.94; c.beginPath();
    const P = [[0, -1], [0.22, -0.22], [1, 0], [0.22, 0.22], [0, 1], [-0.22, 0.22], [-1, 0], [-0.22, -0.22]];
    P.forEach((p, i) => { const x = ex + p[0] * er, y = ey + p[1] * er; i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.closePath(); c.fill(); c.globalAlpha = 1;
  }
  return cv;
}

/* ---------- geometry ---------- */

/** Aircraft (x aft, y right, z up) to the 3D view's axes (x aft, y up, z left). */
function _av(x: number, y: number, z: number) { return new THREE.Vector3(x, z, -y); }

function buildFuselage(s: ShapeSpec): any {
  const xs: number[] = [];
  for (let i = 0; i <= 22; i++) xs.push(s.nose * Math.pow(i / 22, 1.6));
  const mid0 = s.nose, mid1 = s.L - s.tail;
  for (let i = 1; i < 6; i++) xs.push(mid0 + (mid1 - mid0) * i / 6);
  if (s.hump) for (let x = s.nose; x < s.hump.end + 1; x += 1.2) xs.push(x);
  for (let i = 0; i <= 18; i++) xs.push(mid1 + s.tail * i / 18);
  xs.sort((a, b) => a - b);
  const X = xs.filter((x, i) => i === 0 || x - xs[i - 1] > 1e-3);
  const SEG = 40, pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i < X.length; i++) {
    const sec = fusSection(s, X[i]);
    for (let j = 0; j <= SEG; j++) {
      const a = j / SEG * 2 * Math.PI, p = fusPoint(s, sec, a);
      const v = _av(X[i], p[0], p[1]); pos.push(v.x, v.y, v.z);
      uv.push(X[i] / s.L, j / SEG);
    }
  }
  for (let i = 0; i < X.length - 1; i++) for (let j = 0; j < SEG; j++) {
    const a = i * (SEG + 1) + j, b = a + SEG + 1;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}

/** A lifting surface from its root leading edge to its tip leading edge (aircraft axes), with chords
 *  along x and thickness along `thick` ('z' for wings, 'y' for fins). */
function panelGeo(r: number[], rc: number, t: number[], tc: number, tr: number, tt: number, thick: 'z' | 'y'): any {
  const C = [0, 0.015, 0.05, 0.12, 0.25, 0.4, 0.55, 0.7, 0.85, 1];
  const yt = (x: number, th: number) => 5 * th * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x * x * x - 0.1036 * x * x * x * x);
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const ring = (p: number[], ch: number, th: number, v: number) => {
    // upper surface front to back, then lower back to front
    const pts: number[][] = [];
    for (const x of C) pts.push([x, yt(x, th) * 1.1]);
    for (let i = C.length - 2; i >= 1; i--) pts.push([C[i], -yt(C[i], th) * 0.75]);
    for (const q of pts) {
      const d = q[1] * ch, P = thick === 'z' ? _av(p[0] + q[0] * ch, p[1], p[2] + d) : _av(p[0] + q[0] * ch, p[1] + d, p[2]);
      pos.push(P.x, P.y, P.z); uv.push(q[0], v);
    }
    return pts.length;
  };
  const n = ring(r, rc, tr, 0); ring(t, tc, tt, 1);
  for (let j = 0; j < n; j++) { const a = j, b = (j + 1) % n; idx.push(a, n + a, b, b, n + a, n + b); }
  // closing the root and the tip
  for (let j = 1; j < n - 1; j++) { idx.push(0, j + 1, j); idx.push(n, n + j, n + j + 1); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}

/** A body of revolution along x (aircraft axes) from a profile of [x, radius]. */
function latheX(profile: number[][], at: number[], seg?: number, sy?: number, sz?: number): any {
  const geo = new THREE.LatheGeometry(profile.map(p => new THREE.Vector2(Math.max(0.001, p[1]), p[0])), seg || 22);
  // the lathe turns around its y axis: lay it along x
  geo.rotateZ(-Math.PI / 2);
  if (sy || sz) geo.scale(1, sz || 1, sy || 1);
  const v = _av(at[0], at[1], at[2]); geo.translate(v.x, v.y, v.z);
  return geo;
}

function cylBetween(a: number[], b: number[], r: number, mat: any, seg?: number): any {
  const A = _av(a[0], a[1], a[2]), B = _av(b[0], b[1], b[2]), d = B.clone().sub(A), L = d.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, seg || 8), mat);
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return m;
}

const _acMats: { [k: string]: any } = {};
function acMat(key: string, make: () => any) { return _acMats[key] || (_acMats[key] = make()); }
/** Wings that flex: the tips move up and down with the bending (more towards the tip), set per aircraft just
 *  before it is drawn (userData.flex on the model, in metres at the tip; userData.semi, the half span). */
function wingFlex(m: any): any {
  m.userData.flex = { value: 0 }; m.userData.semi = { value: 15 };
  m.onBeforeCompile = (sh: any) => {
    sh.uniforms.uFlex = m.userData.flex; sh.uniforms.uSemi = m.userData.semi;
    sh.vertexShader = 'uniform float uFlex; uniform float uSemi;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  { float sf = clamp(abs(position.y) / max(1.0, uSemi), 0.0, 1.2); transformed.z += uFlex * sf * sf; }');
  };
  return m;
}

/** Build the model of a type in a livery. userData.set({ flaps: 0..1, gear: 0..1, prop: angle }) moves its parts. */
function buildAircraftModel(typeId: string, lv: Livery): any {
  if (typeof isHeli === 'function' && isHeli(typeId)) return buildHelicopterModel(typeId, lv);   // helicopters have their own builder
  const s = shapeOf(typeId), T = THREE;
  const root = new T.Group(); root.name = typeId;
  const tex = new T.CanvasTexture(paintFuselage(s, lv)); tex.flipY = false; tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
  const finTex = new T.CanvasTexture(paintFin(lv)); finTex.flipY = false; finTex.colorSpace = T.SRGBColorSpace;
  const std = (o: any) => new T.MeshStandardMaterial(Object.assign({ roughness: 0.42, metalness: 0.08 }, o));
  // the painted fuselage, tail and engines are glossy (they reflect the sky and the sun); the wings stay satin
  const mBody = std({ map: tex, side: T.DoubleSide, roughness: 0.24, metalness: 0.12 });
  const mFin = std({ map: finTex, side: T.DoubleSide, roughness: 0.26, metalness: 0.12 });
  const mWing = acMat('wing', () => wingFlex(std({ color: 0xAFB9C5, roughness: 0.5, metalness: 0.25, side: T.DoubleSide, envMapIntensity: 0.35 })));
  const mWingTop = acMat('wing2', () => std({ color: 0xB7C0CB, roughness: 0.55, metalness: 0.2, side: T.DoubleSide, envMapIntensity: 0.35 }));
  const engCol = lv.engines === 'c1' ? lv.c1 : lv.engines === 'c2' ? lv.c2 : lv.engines === 'body' ? lv.body : '#C9D1DA';
  const mEng = std({ color: new T.Color(engCol), roughness: 0.22, metalness: lv.engines === 'metal' ? 0.6 : 0.18 });
  const mMetal = acMat('metal', () => std({ color: 0x9BA4AE, roughness: 0.35, metalness: 0.7 }));
  const mFloat = acMat('float', () => std({ color: 0xD9DEE4, roughness: 0.45, metalness: 0.3 }));
  const mDark = acMat('dark', () => std({ color: 0x1A1F26, roughness: 0.7, metalness: 0.1 }));
  const mTyre = acMat('tyre', () => std({ color: 0x16191D, roughness: 0.9, metalness: 0 }));
  const mBlade = acMat('blade', () => std({ color: 0x23282F, roughness: 0.6, metalness: 0.2 }));
  const mDisc = acMat('disc', () => new T.MeshBasicMaterial({ color: 0xC8D2DC, transparent: true, opacity: 0.16, depthWrite: false, side: T.DoubleSide }));
  const flexSemi = s.span / 2;
  const add = (geo: any, mat: any, parent?: any) => {
    const m = new T.Mesh(geo, mat); (parent || root).add(m);
    if (mat === mWing) m.onBeforeRender = () => {   // this aircraft's wing bending, from its model
      let o: any = m, f = 0; while (o) { if (typeof o.userData.flex === 'number') { f = o.userData.flex; break; } o = o.parent; }
      mWing.userData.flex.value = f; mWing.userData.semi.value = flexSemi; mWing.uniformsNeedUpdate = true;
    };
    return m;
  };

  add(buildFuselage(s), mBody).userData.fus = true;   // hidden from the cabin window views (you sit inside it)

  /* wings, both sides */
  const W = s.wing, semi = s.span / 2, rootY = s.w / 2 * 0.9;
  const wz0 = s.ground + W.z * s.h + (W.z > 0.9 ? -0.05 : 0.06);
  const tanS = Math.tan(W.sweep * D2R), tanD = Math.tan(W.dih * D2R);
  const raked = W.tipDev === 'raked';
  const yOut = raked ? semi - 3.2 : semi;
  const jet = W.sweep > 15;
  const kinkY = jet ? rootY + (semi - rootY) * 0.34 : 0;
  const leAt = (y: number) => W.x + (y - rootY) * tanS, zAt = (y: number) => wz0 + (y - rootY) * tanD;
  const chordAt = (y: number) => {
    if (jet && y <= kinkY) { const ck = W.root - (kinkY - rootY) * tanS * 0.95; return W.root + (ck - W.root) * (y - rootY) / (kinkY - rootY); }
    const y0 = jet ? kinkY : rootY, c0 = jet ? W.root - (kinkY - rootY) * tanS * 0.95 : W.root;
    return c0 + (W.tip - c0) * clamp((y - y0) / (semi - y0), 0, 1);
  };
  const th = W.t || 0.13;
  const flapParts: any[] = [], spoilerParts: any[] = [];
  for (const side of [1, -1]) {
    const wg = new T.Group(); root.add(wg);
    const P = (y: number) => [leAt(y), side * y, zAt(y)];
    const stations = jet ? [rootY, kinkY, yOut] : [rootY, yOut];
    for (let i = 0; i < stations.length - 1; i++) {
      const a = stations[i], b = stations[i + 1];
      add(panelGeo(P(a), chordAt(a), P(b), chordAt(b), th * (i ? 0.85 : 1), th * (b === yOut ? 0.75 : 0.85), 'z'), mWing, wg);
    }
    if (raked) {
      const a = yOut, b = semi, le = [leAt(a) + 0.2, side * b, zAt(b)];
      le[0] = leAt(a) + (b - a) * Math.tan((W.sweep + 18) * D2R);
      add(panelGeo(P(a), chordAt(a), le, W.tip * 0.45, th * 0.75, th * 0.6, 'z'), mWing, wg);
    }
    // wingtip devices
    const tipY = semi, tipX = raked ? leAt(yOut) + (semi - yOut) * Math.tan((W.sweep + 18) * D2R) : leAt(semi), tipZ = zAt(semi), tc = raked ? W.tip * 0.45 : chordAt(semi);
    const up = (hgt: number, cant: number, sweepD: number, rc: number, tcc: number) => {
      const top = [tipX + hgt * Math.tan(sweepD * D2R) + (rc - tcc) * 0.6, side * (tipY + hgt * Math.tan(cant * D2R)), tipZ + hgt];
      add(panelGeo([tipX, side * tipY, tipZ], rc, top, tcc, 0.09, 0.07, 'y'), mWing, wg);
    };
    if (W.tipDev === 'fence') {
      add(panelGeo([tipX - 0.15, side * tipY, tipZ - 0.5], tc * 1.05, [tipX + tc * 0.55, side * tipY, tipZ + 0.75], tc * 0.4, 0.07, 0.06, 'y'), mWing, wg);
    } else if (W.tipDev === 'sharklet') {
      // a short curved transition, then the tall blade
      const mid = [tipX + 0.35, side * (tipY + 0.28), tipZ + 0.45];
      add(panelGeo([tipX, side * tipY, tipZ], tc, mid, tc * 0.8, 0.09, 0.08, 'y'), mWing, wg);
      add(panelGeo(mid, tc * 0.8, [mid[0] + 1.55, side * (tipY + 0.5), tipZ + 2.4], 0.42, 0.08, 0.07, 'y'), mWing, wg);
    } else if (W.tipDev === 'blended') {
      const mid = [tipX + 0.45, side * (tipY + 0.32), tipZ + 0.5];
      add(panelGeo([tipX, side * tipY, tipZ], tc, mid, tc * 0.82, 0.09, 0.08, 'y'), mWing, wg);
      add(panelGeo(mid, tc * 0.82, [mid[0] + 1.5, side * (tipY + 0.62), tipZ + 2.45], 0.5, 0.08, 0.07, 'y'), mWing, wg);
    } else if (W.tipDev === 'curved') {
      let p = [tipX, side * tipY, tipZ], c0 = tc;
      for (let i = 1; i <= 4; i++) {
        const k = i / 4, q = [tipX + 2.1 * Math.pow(k, 1.4), side * (tipY + 0.7 * Math.sin(k * Math.PI / 2)), tipZ + 2.1 * (1 - Math.cos(k * Math.PI / 2)) + 0.25 * k], c1 = tc * (1 - 0.7 * k);
        add(panelGeo(p, c0, q, c1, 0.09, 0.08, 'y'), mWing, wg); p = q; c0 = c1;
      }
    } else if (W.tipDev === 'small') up(s.L > 20 ? 1.2 : 0.55, 8, 40, tc * 0.9, tc * 0.5);

    // flaps along the inner trailing edge, folding down and back
    const fy0 = rootY + 0.2, fy1 = rootY + (semi - rootY) * (jet ? 0.72 : 0.62);
    const nF = jet ? 2 : 1;
    for (let i = 0; i < nF; i++) {
      const a = fy0 + (fy1 - fy0) * i / nF, b = fy0 + (fy1 - fy0) * (i + 1) / nF;
      const fc = (y: number) => chordAt(y) * 0.26;
      const hinge = (y: number) => [leAt(y) + chordAt(y) * 0.74, side * y, zAt(y) + chordAt(y) * 0.01];
      const pivot = new T.Group(); wg.add(pivot);
      const ha = hinge(a), hb = hinge(b), A = _av(ha[0], ha[1], ha[2]), B = _av(hb[0], hb[1], hb[2]);
      pivot.position.copy(A);
      const geo = panelGeo([0, 0, 0], fc(a), [hb[0] - ha[0], hb[1] - ha[1], hb[2] - ha[2]], fc(b), 0.1, 0.1, 'z');
      const m = new T.Mesh(geo, mWingTop); pivot.add(m);
      // the hinge line runs outwards on both wings, so both flaps fold down together
      pivot.userData.axis = B.clone().sub(A).normalize().multiplyScalar(-side);
      pivot.userData.slide = new T.Vector3(1, 0, 0).multiplyScalar(chordAt((a + b) / 2) * 0.16);
      flapParts.push(pivot);
      // spoilers on top of the wing, just ahead of the flaps: flat in flight, up after touchdown
      const sh = (y: number) => [leAt(y) + chordAt(y) * 0.6, side * y, zAt(y) + chordAt(y) * 0.045];
      const sa = sh(a), sb = sh(b), SA = _av(sa[0], sa[1], sa[2]), SB = _av(sb[0], sb[1], sb[2]);
      const sp = new T.Group(); wg.add(sp); sp.position.copy(SA);
      sp.add(new T.Mesh(panelGeo([0, 0, 0], chordAt(a) * 0.13, [sb[0] - sa[0], sb[1] - sa[1], sb[2] - sa[2]], chordAt(b) * 0.13, 0.04, 0.04, 'z'), mWingTop));
      sp.userData.axis = SB.clone().sub(SA).normalize().multiplyScalar(-side);
      sp.visible = false; spoilerParts.push(sp);
    }
  }

  /* fin and dorsal fin */
  const F = s.fin, finRootZ = fusSection(s, F.x + F.root * 0.3).zt - 0.15;
  const finTipX = F.x + (s.H - finRootZ) * Math.tan(F.sweep * D2R);
  add(panelGeo([F.x, 0, finRootZ], F.root, [finTipX, 0, s.H], F.tip, 0.11, 0.09, 'y'), mFin);
  if (F.dorsal) {
    const dz = finRootZ + (s.H - finRootZ) * 0.2;
    add(panelGeo([F.x - F.dorsal, 0, fusSection(s, F.x - F.dorsal).zt - 0.1], F.dorsal + F.root * 0.3, [F.x + (dz - finRootZ) * Math.tan(F.sweep * D2R), 0, dz], 0.3, 0.06, 0.06, 'y'), mFin);
  }

  /* horizontal tail */
  const S = s.stab;
  const sx = S.T ? finTipX + F.tip * 0.05 : S.x, sz = S.T ? s.H - 0.12 : s.ground + S.z * s.h;
  const sRootY = S.T ? 0 : fusSection(s, sx + S.root * 0.4).hw * 0.85;
  for (const side of [1, -1]) {
    const ty = S.span / 2;
    add(panelGeo([sx, side * sRootY, sz], S.root, [sx + (ty - sRootY) * Math.tan(S.sweep * D2R), side * ty, sz + (ty - sRootY) * Math.tan(S.dih * D2R)], S.tip, 0.1, 0.09, 'z'), S.T ? mFin : mWing);
  }

  /* engines */
  const props: any[] = [], revParts: any[] = [], engPts: any[] = [], fans: any[] = [];
  for (const E of s.eng) for (const side of E.y ? [1, -1] : [1]) {
    const y = side * E.y, d = E.d, L = E.l;
    engPts.push({ y, mid: _av(E.x + L * 0.55, y, E.z), exh: _av(E.x + L * (E.kind === 'tprop' ? 0.9 : 1.08), y, E.z), d });
    if (E.kind === 'fan' || E.kind === 'rear') {
      const prof = [[0, d * 0.43], [L * 0.012, d * 0.495], [L * 0.06, d * 0.5], [L * 0.42, d * 0.5], [L * 0.7, d * 0.44], [L * 0.86, d * 0.34], [L * 0.9, d * 0.31]];
      add(latheX(prof, [E.x, y, E.z], 26, 1, s.cockpit === 'b737' ? 0.9 : 1), mEng);
      // the inside of the cowl: a dark duct from the intake to the exhaust, seen from within, so the engine is solid
      // from every side (before, looking into its back at an angle, you saw straight through its wall)
      add(latheX(prof.map(q => [q[0], q[1] * 0.96]), [E.x, y, E.z], 26, 1, s.cockpit === 'b737' ? 0.9 : 1), acMat('duct', () => std({ color: 0x15191F, roughness: 0.85, metalness: 0.15, side: THREE.BackSide })));
      add(latheX([[L * 0.86, d * 0.3], [L * 1.02, d * 0.22], [L * 1.12, 0.02]], [E.x, y, E.z], 18), mMetal);
      // the fan behind the intake
      // the fan behind the intake: a dark disc behind, the titanium blades (twisted, as real fan blades are) round the
      // hub, and the spinner pointing forwards; the blades turn while the engine runs (see userData.set)
      const fan = new T.Mesh(new T.CircleGeometry(d * 0.44, 24), mDark); fan.position.copy(_av(E.x + L * 0.1, y, E.z)); fan.rotation.y = -Math.PI / 2; root.add(fan);
      { const fg = new T.Group(); fg.position.copy(_av(E.x + L * 0.075, y, E.z)); root.add(fg);
        const nB = d > 2.6 ? 22 : d > 1.8 ? 24 : 18, rIn = d * 0.12, rOut = d * 0.435, parts: any[] = [];
        for (let i = 0; i < nB; i++) {
          const g = new T.BoxGeometry(L * 0.012, rOut - rIn, d * 0.075); g.translate(0, rIn + (rOut - rIn) / 2, 0);
          g.rotateY(0.62); g.rotateX(i / nB * Math.PI * 2); parts.push(g);   // twisted, then round the hub (the model's axes: x along the engine)
        }
        const BGU: any = (window as any).BufferGeometryUtils, mFan = acMat('fanblade', () => std({ color: 0xA9B2BC, metalness: 0.85, roughness: 0.32 }));
        if (BGU && BGU.mergeGeometries) { const mg = BGU.mergeGeometries(parts); if (mg) fg.add(new T.Mesh(mg, mFan)); else parts.forEach(g => fg.add(new T.Mesh(g, mFan))); }
        else parts.forEach(g => fg.add(new T.Mesh(g, mFan)));
        fans.push(fg); }
      add(latheX([[L * 0.03, 0.02], [L * 0.05, d * 0.08], [L * 0.085, d * 0.13]], [E.x, y, E.z], 16), acMat('spinner', () => std({ color: 0xD8DDE2, metalness: 0.6, roughness: 0.3 })));
      // thrust reverser (jet airliners): the cowl's sleeve slides back and opens the cascade vanes
      if (s.cockpit !== 'ga') {
        const casc = add(latheX([[L * 0.4, d * 0.503], [L * 0.6, d * 0.49]], [E.x, y, E.z], 26), acMat('cascade', () => std({ color: 0x24282E, roughness: 0.9, metalness: 0.3 })));
        const sleeve = add(latheX([[L * 0.4, d * 0.508], [L * 0.7, d * 0.448], [L * 0.72, d * 0.43]], [E.x, y, E.z], 26, 1, s.cockpit === 'b737' ? 0.9 : 1), mEng);
        casc.visible = false;
        revParts.push({ casc, sleeve, slide: _av(L * 0.2, 0, 0).sub(_av(0, 0, 0)), at: _av(E.x + L * 0.5, y, E.z) });
      }
      if (E.kind === 'fan') {
        // pylon up to the wing
        const wzAt = zAt(Math.abs(E.y)), wle = leAt(Math.abs(E.y));
        add(panelGeo([E.x + L * 0.25, y, E.z + d * 0.38], L * 0.95, [wle - 0.4, y, wzAt + 0.05], chordAt(Math.abs(E.y)) * 0.75, 0.16, 0.16, 'y'), mWing);
      } else {
        // stub pylon into the fuselage side
        const sec = fusSection(s, E.x + L * 0.5);
        add(panelGeo([E.x + L * 0.3, side * sec.hw * 0.7, E.z], L * 0.5, [E.x + L * 0.32, y - side * d * 0.35, E.z], L * 0.45, 0.14, 0.14, 'z'), mWing);
      }
    } else if (E.kind === 'tprop') {
      const prof = [[0, d * 0.18], [L * 0.04, d * 0.36], [L * 0.14, d * 0.5], [L * 0.45, d * 0.52], [L * 0.75, d * 0.42], [L, d * 0.12]];
      add(latheX(prof, [E.x, y, E.z], 20, 1, 1.15), mEng);
      // the nacelle's top flows into the wing
      const wle = leAt(Math.abs(E.y));
      add(panelGeo([E.x + L * 0.1, y, E.z + d * 0.4], L * 0.75, [wle, y, zAt(Math.abs(E.y)) + 0.02], chordAt(Math.abs(E.y)) * 0.9, 0.5, 0.2, 'y'), mEng);
      props.push(Object.assign(makeProp(E, [E.x - 0.2, y, E.z], side, mBlade, mDisc, mEng, root), { y }));
    } else {
      // engine in the nose: the fuselage is the cowling; a propeller in front (and a ring cowl for a radial)
      if (E.kind === 'radial') add(latheX([[0, d * 0.42], [0.05, d * 0.5], [E.l, d * 0.5], [E.l + 0.3, d * 0.44]], [E.x + 0.1, 0, E.z], 24), mEng);
      props.push(Object.assign(makeProp(E, [E.x - 0.08, 0, E.z], 1, mBlade, mDisc, mEng, root), { y: 0 }));
    }
  }

  /* pods and sponsons */
  if (s.pod === 'cargo') add(latheX([[0, 0.05], [0.5, 0.25], [1.6, 0.32], [5.2, 0.3], [6.4, 0.06]], [s.nose * 0.95, 0, s.ground - 0.15], 16, 2.2, 0.85), mBody);
  if (s.pod === 'sponson') for (const side of [1, -1]) add(latheX([[0, 0.05], [1.0, 0.42], [3.5, 0.5], [5.6, 0.3], [6.4, 0.05]], [s.gear.main - 3.2, side * (s.w / 2 - 0.1), s.ground + 0.42], 16, 1.1, 1.2), mBody);

  /* struts of braced high wings */
  if (s.strut) for (const side of [1, -1]) {
    const y = semi * 0.52, x = leAt(y) + chordAt(y) * 0.3;
    root.add(cylBetween([W.x + 0.3, side * s.w * 0.45, s.ground + s.h * 0.12], [x, side * y, zAt(y) - 0.06], Math.max(0.035, s.h * 0.03), mMetal));
  }

  /* landing gear */
  const gearG = new T.Group(); root.add(gearG);
  const G = s.gear;
  const wheel = (x: number, y: number, r: number, wdt: number) => {
    const m = new T.Mesh(new T.CylinderGeometry(r, r, wdt, 16), mTyre); m.rotation.x = Math.PI / 2; m.position.copy(_av(x, y, r)); gearG.add(m);
    const hub = new T.Mesh(new T.CylinderGeometry(r * 0.5, r * 0.5, wdt * 1.04, 12), mMetal); hub.rotation.x = Math.PI / 2; hub.position.copy(_av(x, y, r)); gearG.add(hub);
  };
  // amphibious floats: wheels inside each float (two at the bow, two just behind the step), lowered to land on a
  // runway and drawn up into the float for water
  const ampG = new T.Group(); ampG.visible = false; root.add(ampG);
  const AMP_OUT = G.floats ? 0.34 : 0;   // how far the wheels stand out below the floats when down (m)
  if (G.floats) {
    const fl = G.floats, wr = 0.19, wd = 0.12;
    for (const side of [1, -1]) for (const fx of [fl.x + fl.l * 0.1, fl.x + fl.l * 0.47]) {
      const front = fx < fl.x + fl.l * 0.3, r = front ? wr * 0.8 : wr, y = side * fl.y;
      const leg = cylBetween([fx, y, r - AMP_OUT + fl.d * 0.02], [fx, y, fl.d * 0.3], front ? 0.03 : 0.04, mMetal); ampG.add(leg);
      const m = new T.Mesh(new T.CylinderGeometry(r, r, wd, 14), mTyre); m.rotation.x = Math.PI / 2; m.position.copy(_av(fx, y, r - AMP_OUT)); ampG.add(m);
      const hub = new T.Mesh(new T.CylinderGeometry(r * 0.5, r * 0.5, wd * 1.04, 10), mMetal); hub.rotation.x = Math.PI / 2; hub.position.copy(_av(fx, y, r - AMP_OUT)); ampG.add(hub);
    }
  }
  if (G.floats) {
    const fl = G.floats;
    for (const side of [1, -1]) {
      add(latheX([[0, 0.06], [0.5, fl.d * 0.38], [1.6, fl.d * 0.5], [fl.l * 0.62, fl.d * 0.5], [fl.l * 0.85, fl.d * 0.3], [fl.l, 0.06]], [fl.x, side * fl.y, fl.d * 0.42], 14, 0.75, 1), mFloat);
      for (const fx of [W.x - 0.2, W.x + W.root + 0.2]) root.add(cylBetween([fx, side * fl.y, fl.d * 0.8], [fx, side * s.w * 0.4, s.ground + 0.05], 0.05, mMetal));
      root.add(cylBetween([W.x - 0.2, side * fl.y, fl.d * 0.8], [W.x + W.root + 0.2, side * s.w * 0.4, s.ground + 0.05], 0.04, mMetal));
    }
  } else {
    const big = s.L > 20, wr = big ? clamp(s.L * 0.0165, 0.38, 0.68) : s.L > 12 ? 0.32 : 0.24, wd = wr * 0.62;
    // nose leg
    const nr = wr * (big ? 0.72 : 0.85);
    gearG.add(cylBetween([G.nose, 0, nr], [G.nose, 0, fusSection(s, G.nose).zb + 0.1], big ? 0.1 : 0.05, mMetal));
    if (big) { wheel(G.nose, 0.25, nr, wd * 0.8); wheel(G.nose, -0.25, nr, wd * 0.8); } else wheel(G.nose, 0, nr, wd * 0.8);
    // main legs
    for (const side of [1, -1]) {
      const y = side * G.track / 2, topZ = W.z > 0.9 ? s.ground + 0.15 : zAt(G.track / 2) + 0.1;
      const legTop = G.fixed && W.z > 0.9 ? [G.main - 0.2, side * s.w * 0.4, s.ground + 0.1] : [G.main, y, topZ];
      gearG.add(cylBetween(legTop, [G.main, y, wr], big ? 0.14 : 0.05, mMetal));
      const rows = G.wheels >= 6 ? 3 : G.wheels >= 4 ? 2 : 1, cols = G.wheels >= 2 ? 2 : 1;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const wx = G.main + (r - (rows - 1) / 2) * wr * 2.3, wy = y + (cols > 1 ? (c - 0.5) * wd * 2.3 : 0);
        wheel(wx, wy, wr, wd);
      }
      if (G.wheels >= 4) gearG.add(cylBetween([G.main - wr * 2.4 * (rows - 1) / 2, y, wr], [G.main + wr * 2.4 * (rows - 1) / 2, y, wr], 0.09, mMetal));
    }
  }

  root.userData.shape = s;
  root.userData.gear = gearG;
  root.userData.flaps = flapParts;
  root.userData.props = props;
  /** Flaps 0..1 (full), gear 0 (up) .. 1 (down), propellers turning. */
  root.userData.revPts = revParts.map(r => r.at);
  // engines numbered as in the simulator: from the left wing tip to the right
  engPts.sort((a, b) => a.y - b.y); root.userData.engPts = engPts;
  const propIdx = props.map(p => engPts.findIndex(e => Math.abs(e.y - p.y) < 0.01));
  root.userData.set = (o: { flaps?: number; gear?: number; spin?: number; spoilers?: number; reverse?: number; amphib?: number }) => {
    if (o.reverse != null) for (const r of revParts) { const k = clamp(o.reverse, 0, 1); r.sleeve.position.copy(r.slide).multiplyScalar(k); r.casc.visible = k > 0.01; }
    if (o.spoilers != null) for (const p of spoilerParts) { const k = clamp(o.spoilers, 0, 1); p.visible = k > 0.02; p.quaternion.setFromAxisAngle(p.userData.axis, k * 0.85); }
    if (o.flaps != null) for (const p of flapParts) {
      const k = clamp(o.flaps, 0, 1);
      p.quaternion.setFromAxisAngle(p.userData.axis, -k * 0.62);
      p.children[0].position.copy(p.userData.slide).multiplyScalar(k);
    }
    // amphibian wheels: 0 up inside the floats (water), 1 down below them (a runway); they slide straight down
    if ((o as any).amphib != null && s.gear.floats) { const k = clamp((o as any).amphib, 0, 1); ampG.visible = k > 0.02; ampG.position.y = (1 - k) * AMP_OUT; root.userData.ampLift = k * AMP_OUT; }
    if (o.gear != null && !s.gear.fixed && !s.gear.floats) { gearG.visible = o.gear > 0.02; gearG.scale.y = 0.2 + 0.8 * clamp(o.gear, 0, 1); gearG.position.y = (1 - clamp(o.gear, 0, 1)) * s.ground * 0.55; }
    if (o.spin != null) fans.forEach((g, i) => { if ((o as any).stopped !== i) g.rotation.x = -o.spin * 0.28; });   // the jet engines' fans turning (a stopped engine's stands still)
    if (o.spin != null) props.forEach((p, i) => { const out = (o as any).stopped === propIdx[i]; if (!out) p.blades.rotation.x = o.spin; p.disc.visible = !out; });   // a stopped engine's propeller stands still (feathered)
  };
  try { Models.swap(root, aircraftModelFile(typeId)); } catch (e) { /* the app's own model */ }
  return root;
}

function makeProp(E: ShapeEng, at: number[], side: number, mBlade: any, mDisc: any, mSpin: any, root: any): any {
  const T = THREE, R = (E.prop || 2.5) / 2, g = new T.Group();
  g.position.copy(_av(at[0], at[1], at[2]));
  const blades = new T.Group(); g.add(blades);
  const n = E.blades || 3;
  for (let i = 0; i < n; i++) {
    const b = new T.Mesh(new T.BoxGeometry(0.05, R * 0.95, R * 0.14), mBlade);
    b.geometry.translate(0, R * 0.5, 0);
    b.rotation.x = i / n * Math.PI * 2; b.rotation.y = 0.35 * side;
    const holder = new T.Group(); holder.rotation.x = i / n * Math.PI * 2; holder.add(b); b.rotation.x = 0; blades.add(holder);
  }
  const spinner = new T.Mesh(new T.ConeGeometry(R * 0.16, R * 0.38, 18), mSpin); spinner.rotation.z = Math.PI / 2; spinner.position.x = -R * 0.12; g.add(spinner);
  const disc = new T.Mesh(new T.CircleGeometry(R, 32), mDisc); disc.rotation.y = Math.PI / 2; g.add(disc);
  root.add(g);
  return { group: g, blades, disc };
}

/* ---------- the aircraft pictures ---------- */

const AcPic = { r: null as any, failed: false, cache: new Map<string, { url: string; w: number; h: number; reg: number[]; s: number }>(), scene: null as any, cam: null as any };

function acPicSupported(): boolean {
  if (AcPic.failed) return false;
  if (AcPic.r) return true;
  try {
    if (!(window as any).THREE) { AcPic.failed = true; return false; }
    const cv = document.createElement('canvas');
    const r = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true, preserveDrawingBuffer: true });
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.NoToneMapping; r.setClearColor(0x000000, 0);
    AcPic.r = r;
    const sc = new THREE.Scene();
    sc.add(new THREE.HemisphereLight(0xF2F6FF, 0x6B7686, 1.55));
    const key = new THREE.DirectionalLight(0xFFFFFF, 2.1); key.position.set(-30, 40, 60); sc.add(key);
    const rim = new THREE.DirectionalLight(0xCFE3FF, 0.7); rim.position.set(40, 15, -40); sc.add(rim);
    AcPic.scene = sc;
    cv.addEventListener('webglcontextlost', () => { AcPic.failed = true; AcPic.r = null; });
    return true;
  } catch (e) { AcPic.failed = true; return false; }
}

/** A picture of a type in a livery, seen from its left side and a little ahead and above, as an image. */
function acPicture(typeId: string, lv: Livery, ground: boolean): { url: string; w: number; h: number; reg: number[]; s: number } {
  const key = typeId + '|' + JSON.stringify(lv) + '|' + ground;
  const hit = AcPic.cache.get(key); if (hit) return hit;
  const T = THREE, s = shapeOf(typeId);
  const model = buildAircraftModel(typeId, lv);
  model.userData.set({ flaps: 0, gear: 1 });
  AcPic.scene.add(model);
  // the camera: on the left of the aircraft, turned 10° towards the nose and 15° above
  const yaw = 10 * D2R, pitch = 15 * D2R;
  const dir = new T.Vector3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  const box = new T.Box3().setFromObject(model), ctr = box.getCenter(new T.Vector3());
  const cam = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
  cam.position.copy(ctr).addScaledVector(dir, 300); cam.lookAt(ctr); cam.updateMatrixWorld();
  // fit the frame around the model
  // tight around what is seen: every vertex in the camera's view (skipping the faint propeller discs)
  const inv = cam.matrixWorldInverse, v = new T.Vector3();
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  model.updateMatrixWorld(true);
  model.traverse((o: any) => {
    if (!o.isMesh || !o.visible || (o.material && o.material.transparent)) return;
    const pa = o.geometry.attributes.position, m = o.matrixWorld;
    for (let i = 0; i < pa.count; i++) { v.fromBufferAttribute(pa, i).applyMatrix4(m).applyMatrix4(inv); if (v.x < x0) x0 = v.x; if (v.x > x1) x1 = v.x; if (v.y < y0) y0 = v.y; if (v.y > y1) y1 = v.y; }
  });
  const pad = 0.2; x0 -= pad; x1 += pad; y0 -= pad; y1 += pad;
  cam.left = x0; cam.right = x1; cam.top = y1; cam.bottom = y0; cam.updateProjectionMatrix();
  // pixels: a longer aircraft is drawn larger, as in a line-up
  const ppm = clamp(150 + s.L * 3.4, 165, 400) / s.L;
  const wPx = (x1 - x0) * ppm, hPx = (y1 - y0) * ppm, res = 2.2;
  const r = AcPic.r; r.setPixelRatio(1); r.setSize(Math.round(wPx * res), Math.round(hPx * res), false);
  r.render(AcPic.scene, cam);
  let url = '';
  try { url = r.domElement.toDataURL('image/webp', 0.9); if (url.indexOf('data:image/webp') !== 0) url = r.domElement.toDataURL('image/png'); } catch (e) { url = ''; }
  // where the registration goes: the rear fuselage on the left side, ahead of the fin
  const rx = Math.max(s.win.to - 1.0, s.fin.x - 0.6), rz = s.ground + s.win.z * s.h + (s.L > 20 ? -0.05 : 0.0);
  const rp = _av(rx, -fusSection(s, rx).hw, rz).project(cam);
  const out = { url, w: wPx, h: hPx, reg: [(rp.x + 1) / 2 * wPx, (1 - rp.y) / 2 * hPx], s: ppm };
  AcPic.scene.remove(model);
  model.traverse((o: any) => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.map) o.material.map.dispose(); });
  if (AcPic.cache.size > 60) AcPic.cache.delete(AcPic.cache.keys().next().value);
  AcPic.cache.set(key, out);
  return out;
}

/** The airline's livery (its own design when one is saved, else made from its colours). */
function liveryFor(color?: string, color2?: string, companyId?: string): Livery {
  const c = (State.companies || []).filter((x: any) => x.id === (companyId || State.companyId))[0] as any;
  const base = defaultLivery(color || (c && c.color), color2 || (c && c.color2), c ? c.name : '');
  const saved = c && c.livery;
  if (saved && (!color || color === c.color)) return Object.assign(base, saved, { c1: saved.c1 || base.c1 });
  // a division's aircraft: the airline's design, in the division's colour
  if (saved) return Object.assign(base, saved, { c1: color, belly: saved.belly === saved.c1 ? color : saved.belly });
  return base;
}

/** The aircraft picture used everywhere in the app: the 3D-rendered model in the airline's livery, with the
 *  registration on its side; the drawn side view where 3D isn't available. */
function aircraftArt(typeId: string, o?: { color?: string; color2?: string; reg?: string; w?: number; ground?: boolean; livery?: Livery }): string {
  const t = acType(typeId); if (!t) return '';
  o = o || {};
  if (!acPicSupported()) return aircraftArtSvg(typeId, o);
  let pic: { url: string; w: number; h: number; reg: number[]; s: number };
  const lv = o.livery || liveryFor(o.color, o.color2);
  try { pic = acPicture(typeId, lv, o.ground !== false); } catch (e) { AcPic.failed = true; return aircraftArtSvg(typeId, o); }
  if (!pic.url) return aircraftArtSvg(typeId, o);
  const W = 420, VH = 150, groundY = 140;
  const x = (W - pic.w) / 2, y = groundY - pic.h;
  const P = (n: number) => n.toFixed(1);
  const s = shapeOf(typeId), fs = Math.max(5.5, clamp(s.h * 0.12, 0.22, 0.6) * pic.s);
  const parts = [] as string[];
  if (o.ground !== false) parts.push(`<defs><radialGradient id="acsh" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#000" stop-opacity=".42"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs><ellipse cx="${P(W / 2)}" cy="${P(groundY - 1)}" rx="${P(pic.w * 0.46)}" ry="5" fill="url(#acsh)"/>`);
  parts.push(`<image href="${pic.url}" x="${P(x)}" y="${P(y)}" width="${P(pic.w)}" height="${P(pic.h)}"/>`);
  if (o.reg) parts.push(`<text x="${P(x + pic.reg[0])}" y="${P(y + pic.reg[1] + fs * 0.35)}" text-anchor="end" font-size="${P(fs)}" font-family="Inter, sans-serif" font-weight="600" fill="#3E4A58" letter-spacing=".3">${esc(o.reg)}</text>`);
  return `<svg class="ac-art ac-3d" viewBox="0 0 ${W} ${VH}" preserveAspectRatio="xMidYMax meet" role="img" aria-label="${esc(t.maker + ' ' + t.model)}">${parts.join('')}</svg>`;
}
