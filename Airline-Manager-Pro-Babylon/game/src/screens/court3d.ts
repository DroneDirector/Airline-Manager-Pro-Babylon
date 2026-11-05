/* The courtroom, in 3D: a panelled hall with tall windows, a coffered ceiling and brass chandeliers; the
 * judges' bench on its dais under the emblem of justice, the clerk's desk, the witness box, the tables of the
 * prosecution and the defence (where you sit, with your lawyer), the families' counsel, the bar and the public
 * benches with the relatives in the front row and the press at the back, police officers at the doors and the
 * bench. Everyone is alive: they breathe and sway gently in their seats or where they stand, and look at
 * whoever is speaking. Seats, tables and benches are built around the seated figures, with room for knees and
 * hands, so no one ever goes through the furniture.
 * The hearing runs line by line (court-hearing.ts): each line can be played aloud and read; questions put to
 * you are answered with the buttons, your lawyer suggests an answer and may object. Exhibits appear on the
 * court's screens. Esc (or Leave court) before the court rises asks for a board member to stand in for you.
 * Every texture is drawn here: wood grain, parquet, marble, carpet, leather, plaster. */

const CourtRoom: any = { on: false };

/* ---------- textures, drawn ---------- */
function ctCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d') as CanvasRenderingContext2D]; }
function ctRng(seed: number) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; }
function ctTex(c: HTMLCanvasElement, rx?: number, ry?: number, srgb?: boolean): any {
  const T = THREE, t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rx || 1, ry || 1); t.anisotropy = 8;
  if (srgb !== false) t.colorSpace = T.SRGBColorSpace; return t;
}
/** Wood: long grain lines with figure, pores and a little colour change from board to board. */
function ctWood(base: string, dark: string, seed: number, w = 512, h = 512, figure = 1): HTMLCanvasElement {
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
function ctParquet(): HTMLCanvasElement {
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
function ctMarble(base: number[], vein: number[], seed: number, n = 256): HTMLCanvasElement {
  const [c, x] = ctCanvas(n, n), d = x.createImageData(n, n), r = ctRng(seed), P: number[] = []; for (let i = 0; i < 12; i++) P.push(r() * 6.3);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const u = i / n * 6.283, v = j / n * 6.283;
    const turb = Math.sin(u * 2 + P[0]) * 0.6 + Math.sin(v * 3 + P[1]) * 0.5 + Math.sin((u + v) * 5 + P[2]) * 0.25 + Math.sin((u * 3 - v * 2) * 2 + P[3]) * 0.2 + Math.sin(u * 11 + v * 7 + P[4]) * 0.08;
    const k = Math.pow(1 - Math.abs(Math.sin((u + v * 0.6) * 2 + turb * 2.2)), 9) * 0.85 + (Math.sin(u * 23 + v * 19 + P[5]) * 0.03);
    const o = (j * n + i) * 4; for (let ch = 0; ch < 3; ch++) d.data[o + ch] = base[ch] + (vein[ch] - base[ch]) * Math.max(0, Math.min(1, k)); d.data[o + 3] = 255;
  }
  x.putImageData(d, 0, 0); return c;
}
function ctNoise(base: string, amt: number, seed: number, n = 256, dots = 6000): HTMLCanvasElement {
  const [c, x] = ctCanvas(n, n), r = ctRng(seed); x.fillStyle = base; x.fillRect(0, 0, n, n);
  for (let i = 0; i < dots; i++) { x.fillStyle = r() < 0.5 ? `rgba(0,0,0,${amt * r()})` : `rgba(255,255,255,${amt * r() * 0.6})`; x.fillRect(r() * n, r() * n, 1 + r() * 2, 1 + r() * 2); }
  return c;
}
function ctCarpet(): HTMLCanvasElement {
  const [c, x] = ctCanvas(256, 256); x.fillStyle = '#5C1A22'; x.fillRect(0, 0, 256, 256);
  x.strokeStyle = 'rgba(214,168,92,.35)'; x.lineWidth = 2; for (let i = -1; i < 3; i++) for (let j = -1; j < 3; j++) { x.beginPath(); x.moveTo(i * 128 + 64, j * 128); x.lineTo(i * 128 + 128, j * 128 + 64); x.lineTo(i * 128 + 64, j * 128 + 128); x.lineTo(i * 128, j * 128 + 64); x.closePath(); x.stroke(); }
  x.fillStyle = 'rgba(214,168,92,.45)'; for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { x.beginPath(); x.arc(i * 128 + 64, j * 128 + 64, 6, 0, 6.3); x.fill(); }
  const r = ctRng(3); for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(0,0,0,${0.12 * r()})`; x.fillRect(r() * 256, r() * 256, 1, 1); }
  return c;
}
function ctLeather(col: string): HTMLCanvasElement {
  const c = ctNoise(col, 0.18, 21, 256, 9000), x = c.getContext('2d') as CanvasRenderingContext2D;
  // buttoned (tufted) diamonds
  x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 1.5;
  for (let i = -1; i < 5; i++) for (let j = -1; j < 5; j++) { x.beginPath(); x.moveTo(i * 64 + 32, j * 64); x.lineTo(i * 64 + 64, j * 64 + 32); x.lineTo(i * 64 + 32, j * 64 + 64); x.lineTo(i * 64, j * 64 + 32); x.closePath(); x.stroke(); x.fillStyle = 'rgba(0,0,0,.5)'; x.beginPath(); x.arc(i * 64 + 32, j * 64 + 32, 3, 0, 6.3); x.fill(); }
  return c;
}
/** The emblem above the bench: the scales of justice in a laurel wreath, gilt on deep blue. */
function ctEmblem(): HTMLCanvasElement {
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
function ctExit(): HTMLCanvasElement {
  const [c, x] = ctCanvas(256, 96); x.fillStyle = '#0E8A3E'; x.fillRect(0, 0, 256, 96); x.fillStyle = '#EFFFF3';
  x.font = 'bold 54px Inter, Arial, sans-serif'; x.textBaseline = 'middle'; x.fillText('EXIT', 102, 50);
  // a running figure and an arrow
  x.beginPath(); x.arc(46, 22, 8, 0, 6.3); x.fill(); x.lineWidth = 8; x.lineCap = 'round'; x.strokeStyle = '#EFFFF3';
  x.beginPath(); x.moveTo(42, 34); x.lineTo(36, 58); x.lineTo(52, 74); x.moveTo(36, 58); x.lineTo(20, 78); x.moveTo(40, 40); x.lineTo(58, 48); x.moveTo(40, 40); x.lineTo(24, 46); x.stroke();
  x.beginPath(); x.moveTo(70, 48); x.lineTo(90, 48); x.moveTo(82, 40); x.lineTo(90, 48); x.lineTo(82, 56); x.lineWidth = 6; x.stroke();
  return c;
}
/** A painting in a gilt frame: a calm landscape (sky, sea, hills), different each time. */
function ctPainting(seed: number): HTMLCanvasElement {
  const [c, x] = ctCanvas(384, 256), r = ctRng(seed), sky = x.createLinearGradient(0, 0, 0, 170);
  sky.addColorStop(0, ['#6F8FB0', '#B48A62', '#7E9AA8'][seed % 3]); sky.addColorStop(1, '#E8D9B8'); x.fillStyle = sky; x.fillRect(0, 0, 384, 256);
  for (let k = 0; k < 3; k++) { x.fillStyle = ['#56604A', '#46503C', '#343C2C'][k]; x.beginPath(); x.moveTo(0, 256); let y = 120 + k * 35 + r() * 20; x.lineTo(0, y); for (let X = 0; X <= 384; X += 24) { y += (r() - 0.5) * 26; x.lineTo(X, Math.min(240, Math.max(90 + k * 30, y))); } x.lineTo(384, 256); x.fill(); }
  x.fillStyle = 'rgba(70,95,110,.85)'; x.fillRect(0, 205, 384, 51);
  for (let i = 0; i < 2500; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,240,210'},${0.05 * r()})`; x.fillRect(r() * 384, r() * 256, 2, 2); }   // brush texture and old varnish
  x.fillStyle = 'rgba(120,80,20,.12)'; x.fillRect(0, 0, 384, 256);
  return c;
}
function ctWindow(): HTMLCanvasElement {
  const [c, x] = ctCanvas(128, 256), g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#DDEBFA'); g.addColorStop(0.6, '#F7F2E6'); g.addColorStop(1, '#FFF6DE'); x.fillStyle = g; x.fillRect(0, 0, 128, 256);
  x.strokeStyle = '#2B2117'; x.lineWidth = 5; for (let i = 1; i < 3; i++) { x.beginPath(); x.moveTo(i * 128 / 3, 0); x.lineTo(i * 128 / 3, 256); x.stroke(); }
  for (let j = 1; j < 6; j++) { x.beginPath(); x.moveTo(0, j * 256 / 6); x.lineTo(128, j * 256 / 6); x.stroke(); }
  return c;
}
function ctShaft(): HTMLCanvasElement {
  const [c, x] = ctCanvas(64, 256), g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, 'rgba(255,236,200,.9)'); g.addColorStop(1, 'rgba(255,236,200,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 256); const s = x.createLinearGradient(0, 0, 64, 0); s.addColorStop(0, 'rgba(0,0,0,1)'); s.addColorStop(0.2, 'rgba(0,0,0,0)'); s.addColorStop(0.8, 'rgba(0,0,0,0)'); s.addColorStop(1, 'rgba(0,0,0,1)');
  x.globalCompositeOperation = 'destination-out'; x.fillStyle = s; x.fillRect(0, 0, 64, 256); return c;
}
function ctClock(): HTMLCanvasElement {
  const [c, x] = ctCanvas(256, 256); x.fillStyle = '#F4EEDF'; x.beginPath(); x.arc(128, 128, 124, 0, 6.3); x.fill();
  x.strokeStyle = '#2A2016'; x.lineWidth = 6; x.stroke(); x.fillStyle = '#2A2016'; x.font = '600 26px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'].forEach((n, i) => { const a = i / 12 * 6.283 - Math.PI / 2; x.fillText(n, 128 + Math.cos(a) * 96, 128 + Math.sin(a) * 96); });
  return c;
}
/** An exhibit on the court's screens. */
function ctExhibitDraw(cv: HTMLCanvasElement, ex: any) {
  const x = cv.getContext('2d') as CanvasRenderingContext2D, W = cv.width, H = cv.height;
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0E1E33'); g.addColorStop(1, '#08121F'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  if (!ex) { x.fillStyle = '#C8963E'; x.font = '600 44px Georgia, serif'; x.textAlign = 'center'; x.fillText('Court in session', W / 2, H / 2); x.textAlign = 'left'; return; }
  x.fillStyle = '#F2D18A'; x.font = '700 40px Inter, Arial, sans-serif'; x.fillText(ex.title, 48, 76);
  x.fillStyle = 'rgba(242,209,138,.5)'; x.fillRect(48, 96, W - 96, 3);
  x.font = '30px Inter, Arial, sans-serif';
  (ex.rows || []).slice(0, 6).forEach((r: string[], i: number) => { x.fillStyle = '#8FA6BD'; x.fillText(r[0], 48, 156 + i * 62); x.fillStyle = '#EAF2FA'; const v = String(r[1]); x.fillText(v.length > 44 ? v.slice(0, 43) + '…' : v, 420, 156 + i * 62); });
}

/* ---------- building the room ---------- */
function ctBuild(scene: any, judges: number, q: number) {
  const T = THREE, A: any = { seats: {} };
  const tex = {
    walnut: ctTex(ctWood('#5A3519', '#2A160A', 3), 1, 1), oak: ctTex(ctWood('#8E6238', '#4A2E16', 5), 1, 1),
    parquet: ctTex(ctParquet(), 6, 6), marble: ctTex(ctMarble([232, 228, 220], [120, 116, 110], 9), 2, 2), marbleDark: ctTex(ctMarble([46, 44, 42], [150, 140, 128], 4), 2, 2),
    plaster: ctTex(ctNoise('#E7DCC6', 0.08, 5), 6, 4), carpet: ctTex(ctCarpet(), 8, 8), leatherG: ctTex(ctLeather('#23402F')), leatherR: ctTex(ctLeather('#5A1F22')),
    emblem: ctTex(ctEmblem()), exit: ctTex(ctExit()), window: ctTex(ctWindow()), shaft: ctTex(ctShaft()), clock: ctTex(ctClock()),
  };
  tex.parquet.repeat.set(5, 4);
  const M = (o: any) => { const m = new T.MeshPhysicalMaterial(Object.assign({ roughness: 0.6, metalness: 0, envMapIntensity: 0.7 }, o)); return m; };
  const mat = {
    walnut: M({ map: tex.walnut, roughness: 0.32, clearcoat: 0.55, clearcoatRoughness: 0.25 }), walnutM: M({ map: tex.walnut, roughness: 0.5 }),
    oak: M({ map: tex.oak, roughness: 0.4, clearcoat: 0.35, clearcoatRoughness: 0.3 }),
    parquet: M({ map: tex.parquet, roughness: 0.28, clearcoat: 0.7, clearcoatRoughness: 0.18 }),
    marble: M({ map: tex.marble, roughness: 0.18, clearcoat: 0.6 }), marbleDark: M({ map: tex.marbleDark, roughness: 0.2, clearcoat: 0.6 }),
    plaster: M({ map: tex.plaster, roughness: 0.92 }), ceiling: M({ color: 0xEFE6D2, roughness: 0.9 }),
    carpet: M({ map: tex.carpet, roughness: 1 }), leatherG: M({ map: tex.leatherG, roughness: 0.45, sheen: 0.4, sheenColor: new T.Color(0x3C6B50) }), leatherR: M({ map: tex.leatherR, roughness: 0.45 }),
    brass: M({ color: 0xC9A04E, metalness: 1, roughness: 0.28 }), gilt: M({ color: 0xD7AE5C, metalness: 1, roughness: 0.35 }), black: M({ color: 0x15171B, roughness: 0.5 }),
    paper: M({ color: 0xF4F1E8, roughness: 0.9 }), glass: M({ color: 0xDDEEFF, roughness: 0.05, transparent: true, opacity: 0.22, metalness: 0, clearcoat: 1 }),
    velvet: M({ color: 0x5E1621, roughness: 0.85, sheen: 1, sheenColor: new T.Color(0xB04050) }),
    emblem: M({ map: tex.emblem, roughness: 0.35, metalness: 0.4 }), screen: null as any,
  };
  const root = new T.Group(); scene.add(root);
  const add = (g: any, m: any, x: number, y: number, z: number, ry?: number, par?: any) => { const o = new T.Mesh(g, m); o.position.set(x, y, z); if (ry) o.rotation.y = ry; o.castShadow = true; o.receiveShadow = true; (par || root).add(o); return o; };
  /** A box by its centre. */
  const bx = (w: number, h: number, d: number, m: any, x: number, y: number, z: number, ry?: number, par?: any) => add(new T.BoxGeometry(w, h, d), m, x, y, z, ry, par);
  /** A slab with rounded corners and softened edges (table tops, ledges): w along x, d along z, h thick, top at y. */
  const slab = (w: number, d: number, h: number, r: number, m: any, x: number, yTop: number, z: number, ry?: number, par?: any) => {
    const s = new T.Shape(), hw = w / 2 - r, hd = d / 2 - r;
    s.moveTo(-hw, -d / 2); s.lineTo(hw, -d / 2); s.quadraticCurveTo(w / 2, -d / 2, w / 2, -hd); s.lineTo(w / 2, hd); s.quadraticCurveTo(w / 2, d / 2, hw, d / 2); s.lineTo(-hw, d / 2); s.quadraticCurveTo(-w / 2, d / 2, -w / 2, hd); s.lineTo(-w / 2, -hd); s.quadraticCurveTo(-w / 2, -d / 2, -hw, -d / 2);
    const bv = Math.min(0.012, h * 0.3), g = new T.ExtrudeGeometry(s, { depth: h - bv * 2, bevelEnabled: true, bevelThickness: bv, bevelSize: bv, bevelSegments: 3, curveSegments: 6 });
    g.rotateX(Math.PI / 2); g.translate(0, -bv, 0);   // top at 0, going down
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.6, uv.getY(i) * 0.6);
    return add(g, m, x, yTop, z, ry, par);
  };
  /** A moulding: a profile (out from the wall, up) run along a length. */
  const mould = (prof: number[][], len: number, m: any, x: number, y: number, z: number, ry: number) => {
    const s = new T.Shape(); s.moveTo(0, prof[0][1]); prof.forEach(p => s.lineTo(p[0], p[1])); s.lineTo(0, prof[prof.length - 1][1]); s.closePath();
    const g = new T.ExtrudeGeometry(s, { depth: len, bevelEnabled: false, curveSegments: 4 }); g.translate(0, 0, -len / 2);
    const o = add(g, m, x, y, z); o.rotation.y = ry; o.castShadow = false; return o;
  };
  const ogee: number[][] = []; for (let i = 0; i <= 10; i++) { const t = i / 10; ogee.push([0.02 + 0.16 * t + Math.sin(t * Math.PI * 2) * 0.02, t * 0.32]); }
  const rail: number[][] = [[0, 0], [0.035, 0], [0.05, 0.02], [0.05, 0.05], [0.03, 0.07], [0, 0.07]];
  const base: number[][] = [[0, 0], [0.04, 0], [0.04, 0.18], [0.025, 0.2], [0.02, 0.24], [0, 0.24]];
  /** An instanced set of boxes (panels, beams, balusters' kin): one draw for many. */
  const inst = (g: any, m: any, list: number[][], shadow = true) => {
    const im = new T.InstancedMesh(g, m, list.length), o = new T.Object3D();
    list.forEach((p, i) => { o.position.set(p[0], p[1], p[2]); o.rotation.set(0, p[6] || 0, 0); o.scale.set(p[3] || 1, p[4] || 1, p[5] || 1); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
    im.castShadow = shadow; im.receiveShadow = true; root.add(im); return im;
  };

  // the hall: 16 m wide (x −8 … 8), from the bench wall (z −9) to the doors (z 10.5), 7.4 m high
  const X0 = -8, X1 = 8, Z0 = -9, Z1 = 10.5, HH = 7.4, BAR = 1.6;
  const floorW = new T.Mesh(new T.PlaneGeometry(X1 - X0 - 1.2, BAR - Z0 - 0.6), mat.parquet); floorW.rotation.x = -Math.PI / 2; floorW.position.set(0, 0.002, (Z0 + 0.6 + BAR) / 2 - 0.3 + 0.3); floorW.receiveShadow = true; root.add(floorW);
  const border = new T.Mesh(new T.PlaneGeometry(X1 - X0, BAR - Z0), mat.marbleDark); border.rotation.x = -Math.PI / 2; border.position.set(0, 0.0005, (Z0 + BAR) / 2); border.receiveShadow = true; root.add(border);
  const carpet = new T.Mesh(new T.PlaneGeometry(X1 - X0, Z1 - BAR), mat.carpet); carpet.rotation.x = -Math.PI / 2; carpet.position.set(0, 0.002, (BAR + Z1) / 2); carpet.receiveShadow = true; root.add(carpet);
  const runner = new T.Mesh(new T.PlaneGeometry(1.6, Z1 - BAR), M({ map: (() => { const t = ctTex(ctNoise('#3E1016', 0.25, 13), 1, 8); return t; })(), roughness: 1 })); runner.rotation.x = -Math.PI / 2; runner.position.set(0, 0.004, (BAR + Z1) / 2); runner.receiveShadow = true; root.add(runner);
  // walls: plaster above, walnut panelling below (raised panels, chair rail, skirting)
  const walls: [number, number, number, number, number][] = [[0, HH / 2, Z0, X1 - X0, 0], [0, HH / 2, Z1, X1 - X0, Math.PI], [X0, HH / 2, (Z0 + Z1) / 2, Z1 - Z0, Math.PI / 2], [X1, HH / 2, (Z0 + Z1) / 2, Z1 - Z0, -Math.PI / 2]];
  for (const w of walls) { const p = new T.Mesh(new T.PlaneGeometry(w[3], HH), mat.plaster); p.position.set(w[0], w[1], w[2]); p.rotation.y = w[4]; p.receiveShadow = true; root.add(p); }
  const ceil = new T.Mesh(new T.PlaneGeometry(X1 - X0, Z1 - Z0), mat.ceiling); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, HH, (Z0 + Z1) / 2); root.add(ceil);
  const WAIN = 2.4, panels: number[][] = [], frames: number[][] = [];
  const along = (ax: number, az: number, bx2: number, bz: number, inward: number[], skip?: (t: number) => boolean) => {
    const len = Math.hypot(bx2 - ax, bz - az), n = Math.max(1, Math.round(len / 1.25)), ry = Math.atan2(bx2 - ax, bz - az) - Math.PI / 2;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, x = ax + (bx2 - ax) * t, z = az + (bz - az) * t; if (skip && skip(t * len)) continue;
      panels.push([x + inward[0] * 0.05, 1.25, z + inward[1] * 0.05, len / n - 0.24, 1.55, 0.03, ry]);
      panels.push([x + inward[0] * 0.05, 0.36, z + inward[1] * 0.05, len / n - 0.24, 0.32, 0.03, ry]);
    }
    frames.push([(ax + bx2) / 2 + inward[0] * 0.02, WAIN / 2, (az + bz) / 2 + inward[1] * 0.02, len, WAIN, 0.04, ry]);
    mould(rail, len, mat.walnut, (ax + bx2) / 2 + inward[0] * 0.04, WAIN - 0.03, (az + bz) / 2 + inward[1] * 0.04, ry + Math.PI / 2);
    mould(base, len, mat.walnut, (ax + bx2) / 2 + inward[0] * 0.04, 0, (az + bz) / 2 + inward[1] * 0.04, ry + Math.PI / 2);
    mould(ogee, len, mat.ceiling, (ax + bx2) / 2, HH - 0.32, (az + bz) / 2, ry + Math.PI / 2);
  };
  along(X0, Z0, X0, Z1, [1, 0]); along(X1, Z1, X1, Z0, [-1, 0]); along(X0, Z0, X1, Z0, [0, 1]);
  along(X1, Z1, X0, Z1, [0, -1], d => Math.abs(d - 8) < 1.6);   // leave the doors
  const ub = new T.BoxGeometry(1, 1, 1);
  inst(ub, mat.walnutM, frames, false); inst(ub, mat.walnut, panels, false);
  // tall windows on the left with deep reveals and red velvet curtains; light falls through them
  const winZ = [-6.4, -2.6, 1.2, 5.0, 8.6], shafts: any[] = [];
  const winMat = new T.MeshBasicMaterial({ map: tex.window, color: 0xFFFFFF, toneMapped: false });
  for (const z of winZ) {
    const wg = new T.Mesh(new T.PlaneGeometry(1.6, 3.7), winMat); wg.position.set(X0 + 0.01, 4.35, z); wg.rotation.y = Math.PI / 2; root.add(wg);
    const arch = new T.Mesh(new T.CircleGeometry(0.8, 24, 0, Math.PI), winMat); arch.position.set(X0 + 0.01, 6.2, z); arch.rotation.y = Math.PI / 2; root.add(arch);
    bx(0.16, 0.1, 1.9, mat.walnut, X0 + 0.08, 2.48, z);   // sill
    for (const s of [-1, 1]) {
      bx(0.12, 4.6, 0.14, mat.oak, X0 + 0.06, 4.3, z + s * 0.87);   // jambs
      // velvet curtains: folds from a rippled plane
      const cg = new T.PlaneGeometry(0.62, 5.0, 24, 1), P = cg.attributes.position; for (let i = 0; i < P.count; i++) P.setZ(i, Math.sin(P.getX(i) * 31) * 0.045 + Math.sin(P.getX(i) * 13) * 0.02); cg.computeVertexNormals();
      const cu = new T.Mesh(cg, mat.velvet); cu.position.set(X0 + 0.22, 4.4, z + s * 1.18); cu.rotation.y = Math.PI / 2; cu.castShadow = true; root.add(cu);
      bx(0.06, 0.3, 0.08, mat.gilt, X0 + 0.25, 3.0, z + s * 1.15);   // tie-backs
    }
    bx(0.08, 0.08, 3.2, mat.brass, X0 + 0.28, 6.95, z);   // curtain pole
    // light shaft and its dust
    const sa = new T.Vector3(X0 + 0.1, 4.4, z), sb = new T.Vector3(X0 + 5.6, 0.02, z + 0.9), sd = sa.clone().sub(sb), sl = sd.length(); sd.normalize();
    const shm = new T.MeshBasicMaterial({ map: tex.shaft, transparent: true, opacity: q >= 2 ? 0.1 : 0.07, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, toneMapped: false });
    const sh = new T.Group(); sh.position.copy(sa.clone().add(sb).multiplyScalar(0.5)); sh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), sd);
    for (const ry of [0, Math.PI / 2]) { const pl = new T.Mesh(new T.PlaneGeometry(1.5, sl), shm); pl.rotation.y = ry; sh.add(pl); }
    root.add(sh); shafts.push(sh);
  }
  // pilasters between the windows, with capitals
  for (let i = 0; i <= winZ.length; i++) { const z = i === 0 ? Z0 + 0.6 : i === winZ.length ? Z1 - 0.6 : (winZ[i - 1] + winZ[i]) / 2; bx(0.14, HH - WAIN - 0.45, 0.42, mat.plaster, X0 + 0.07, (HH - 0.33 + WAIN) / 2, z); bx(0.22, 0.2, 0.52, mat.gilt, X0 + 0.11, HH - 0.48, z); }
  // paintings and the court's screens on the right wall
  [-5.4, 3.0, 7.2].forEach((z, i) => {
    const pm = M({ map: ctTex(ctPainting(i + 2)), roughness: 0.6 });
    const p = new T.Mesh(new T.PlaneGeometry(1.8, 1.2), pm); p.position.set(X1 - 0.05, 4.2, z); p.rotation.y = -Math.PI / 2; root.add(p);
    for (const [w, h, x, y] of [[2.0, 0.1, 0, 0.65], [2.0, 0.1, 0, -0.65], [0.1, 1.4, 0.95, 0], [0.1, 1.4, -0.95, 0]]) bx(0.07, h, w, mat.gilt, X1 - 0.06, 4.2 + y, z + x);
    bx(0.03, 0.04, 0.4, mat.brass, X1 - 0.09, 5.0, z);
  });
  const scrCv: HTMLCanvasElement[] = [], scrTex: any[] = [];
  for (const [x, z, ry] of [[X1 - 0.12, -1.2, -Math.PI / 2], [X0 + 0.12, -4.4, Math.PI / 2]] as number[][]) {
    const [cv] = ctCanvas(1024, 576); ctExhibitDraw(cv, null); const t = ctTex(cv); scrCv.push(cv); scrTex.push(t);
    const s = new T.Mesh(new T.PlaneGeometry(2.1, 1.18), new T.MeshBasicMaterial({ map: t, toneMapped: false })); s.position.set(x + (ry < 0 ? -0.04 : 0.04), 3.3, z); s.rotation.y = ry; root.add(s);
    bx(0.06, 1.28, 2.2, mat.black, x, 3.3, z);
  }
  A.screens = { cv: scrCv, tex: scrTex };
  // coffered ceiling with rosettes, and brass chandeliers
  const beams: number[][] = []; for (let x = X0 + 2; x < X1; x += 2) beams.push([x, HH - 0.12, (Z0 + Z1) / 2, 0.22, 0.24, Z1 - Z0]); for (let z = Z0 + 2.2; z < Z1; z += 2.2) beams.push([0, HH - 0.12, z, X1 - X0, 0.24, 0.22]);
  inst(ub, mat.ceiling, beams, false);
  const ros: number[][] = []; for (let x = X0 + 2; x < X1; x += 2) for (let z = Z0 + 2.2; z < Z1; z += 2.2) ros.push([x, HH - 0.25, z]);
  inst(new T.CylinderGeometry(0.16, 0.2, 0.06, 16), mat.gilt, ros, false);
  const bulbMat = new T.MeshStandardMaterial({ color: 0xFFE2B0, emissive: 0xFFC77A, emissiveIntensity: 3.5 }), lights: any[] = [];
  for (const [x, z] of [[-3, -4.5], [3, -4.5], [-3, 4.2], [3, 4.2]]) {
    const g = new T.Group(); g.position.set(x, 0, z); root.add(g);
    add(new T.CylinderGeometry(0.015, 0.015, 1.9, 6), mat.brass, 0, HH - 0.95, 0, 0, g);
    add(new T.TorusGeometry(0.62, 0.028, 8, 48), mat.brass, 0, 5.35, 0, 0, g).rotation.x = Math.PI / 2;
    add(new T.TorusGeometry(0.34, 0.02, 8, 32), mat.brass, 0, 5.75, 0, 0, g).rotation.x = Math.PI / 2;
    add(new T.SphereGeometry(0.11, 16, 12), mat.brass, 0, 5.4, 0, 0, g);
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, cx = Math.cos(a) * 0.62, cz = Math.sin(a) * 0.62;
      add(new T.CylinderGeometry(0.035, 0.03, 0.04, 10), mat.brass, cx, 5.39, cz, 0, g);
      add(new T.CylinderGeometry(0.018, 0.018, 0.14, 8), mat.paper, cx, 5.48, cz, 0, g);
      const b = new T.Mesh(new T.SphereGeometry(0.03, 10, 8), bulbMat); b.scale.y = 1.6; b.position.set(cx, 5.58, cz); g.add(b); }
    const L = new T.PointLight(0xFFCF96, q >= 2 ? 26 : 20, 16, 1.6); L.position.set(x, 5.2, z); if (DESKTOP && Gfx.lights() >= 2 && Gfx.shadow() !== 0 && q >= 2 && lights.length < 2) { L.castShadow = true; L.shadow.mapSize.set(1024, 1024); L.shadow.bias = -0.002; L.shadow.radius = 3; } root.add(L); lights.push(L);   // on the PC the chandeliers cast shadows too
  }
  // the bench: a dais with a panelled front, the emblem above, the judges' high-backed chairs
  const dais = 0.75, bw = judges > 3 ? 9.8 : 7.4, bz = -6.6;
  A.dais = dais;
  slab(bw + 1.2, 2.9, dais, 0.04, mat.walnutM, 0, dais, bz - 0.35);
  for (let i = 1; i <= 2; i++) slab(1.4, 0.32, dais * i / 3, 0.02, mat.walnutM, bw / 2 + 0.25, dais * i / 3, bz + 1.1 + (3 - i) * 0.3 - 0.15);   // steps up
  mould(base, bw + 1.2, mat.walnut, 0, 0, bz + 1.1, Math.PI / 2 + Math.PI);
  bx(bw + 1.0, 4.6, 0.12, mat.walnutM, 0, 2.3 + dais, Z0 + 0.08);   // panelled back wall
  for (let i = 0; i < 7; i++) bx(0.16, 4.2, 0.05, mat.walnut, (i - 3) * (bw + 0.6) / 6, 2.4 + dais, Z0 + 0.16);   // fluted pilasters
  const pedi = new T.Shape(); pedi.moveTo(-bw / 2 - 0.6, 0); pedi.lineTo(bw / 2 + 0.6, 0); pedi.lineTo(0, 0.9); pedi.closePath();
  const pg = new T.ExtrudeGeometry(pedi, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 }); add(pg, mat.walnut, 0, 4.62 + dais, Z0 + 0.05);
  const em = new T.Mesh(new T.CircleGeometry(0.85, 48), mat.emblem); em.position.set(0, 3.55 + dais, Z0 + 0.2); root.add(em);
  add(new T.TorusGeometry(0.87, 0.05, 10, 64), mat.gilt, 0, 3.55 + dais, Z0 + 0.2);
  // the bench front: raised panels, a ledge, then the desk behind
  const fz = bz + 0.85;
  bx(bw, 0.92, 0.1, mat.walnutM, 0, dais + 0.46, fz);
  for (let i = 0; i < Math.round(bw / 1.1); i++) { const n = Math.round(bw / 1.1), w = bw / n; bx(w - 0.2, 0.6, 0.03, mat.walnut, -bw / 2 + w * (i + 0.5), dais + 0.45, fz + 0.06); }
  slab(bw + 0.2, 0.42, 0.06, 0.03, mat.walnut, 0, dais + 0.98, fz - 0.05);
  slab(bw, 0.75, 0.05, 0.02, mat.walnut, 0, dais + 0.76, fz - 0.45);   // desk top (knees fit under)
  for (const s of [-1, 1]) bx(0.1, 0.98, 1.1, mat.walnutM, s * (bw / 2 + 0.05), dais + 0.49, fz - 0.4);
  A.seats.judge = [];
  for (let i = 0; i < judges; i++) {
    const x = (i - (judges - 1) / 2) * (bw / judges) * 0.95, hz = fz - 0.95;   // the hip, 0.95 m behind the bench front
    ctChair(root, add, bx, slab, mat, x, dais, hz, 0, true);
    A.seats.judge.push({ x, y: dais, z: hz, yaw: 0, sit: 1 });
    // papers, a closed folder and a nameplate in front of each judge
    bx(0.3, 0.012, 0.22, mat.paper, x - 0.15, dais + 0.79, fz - 0.4, 0.15); bx(0.33, 0.02, 0.25, mat.leatherR, x + 0.25, dais + 0.79, fz - 0.42, -0.1);
  }
  add(new T.CylinderGeometry(0.06, 0.07, 0.02, 20), mat.walnut, 0.45, dais + 0.795, fz - 0.25);   // the gavel's block
  const gav = add(new T.CylinderGeometry(0.03, 0.03, 0.13, 12), mat.walnut, 0.43, dais + 0.83, fz - 0.27); gav.rotation.z = Math.PI / 2;
  add(new T.CylinderGeometry(0.009, 0.009, 0.2, 8), mat.walnut, 0.48, dais + 0.83, fz - 0.17).rotation.x = Math.PI / 2;
  // the clerk's desk in front of the bench, facing the court
  const cz = fz + 1.25;
  slab(2.2, 0.8, 0.05, 0.02, mat.walnut, 0, 0.76, cz + 0.2); bx(2.2, 0.72, 0.06, mat.walnutM, 0, 0.36, cz + 0.6);
  for (const s of [-1, 1]) bx(0.06, 0.72, 0.8, mat.walnutM, s * 1.07, 0.36, cz + 0.2);
  ctChair(root, add, bx, slab, mat, 0, 0, cz - 0.55, 0, false); A.seats.clerk = { x: 0, y: 0, z: cz - 0.55, yaw: 0, sit: 1 };
  ctMic(add, mat, 0.3, 0.78, cz + 0.05, 0); bx(0.34, 0.24, 0.02, mat.black, -0.45, 0.88, cz + 0.05, 0.25);
  // the witness box (right), raised, panelled on three sides, with a seat and a microphone
  const wx = 5.0, wz = -4.8, wr = -0.55;
  const wb = new T.Group(); wb.position.set(wx, 0, wz); wb.rotation.y = wr; root.add(wb);
  slab(1.5, 1.5, 0.3, 0.03, mat.walnutM, 0, 0.3, 0, 0, wb);
  bx(1.5, 1.05, 0.06, mat.walnutM, 0, 0.3 + 0.525, 0.72, 0, wb); bx(0.06, 1.05, 1.5, mat.walnutM, -0.72, 0.825, 0, 0, wb); bx(0.06, 1.05, 1.5, mat.walnutM, 0.72, 0.825, 0, 0, wb);
  slab(1.62, 0.16, 0.05, 0.02, mat.walnut, 0, 1.4, 0.72, 0, wb); slab(0.16, 1.62, 0.05, 0.02, mat.walnut, -0.72, 1.4, 0, 0, wb); slab(0.16, 1.62, 0.05, 0.02, mat.walnut, 0.72, 1.4, 0, 0, wb);
  for (let i = 0; i < 3; i++) bx(0.38, 0.7, 0.02, mat.walnut, (i - 1) * 0.46, 0.8, 0.76, 0, wb);
  ctChair(wb, add, bx, slab, mat, 0, 0.3, -0.22, 0, false);
  ctMic(add, mat, 0.25, 1.43, 0.66, 0, wb);
  { const p = new T.Vector3(0, 0, -0.22).applyAxisAngle(new T.Vector3(0, 1, 0), wr).add(new T.Vector3(wx, 0, wz)); A.seats.witness = { x: p.x, y: 0.3, z: p.z, yaw: wr, sit: 1 }; }
  // the counsel tables: prosecution (left), defence (right); the families' counsel at the side
  const tz = -1.15, tables: [number, string, number][] = [[-3.5, 'pros', 3.2], [3.5, 'def', 3.2]];
  for (const [x, k, w] of tables) {
    slab(w, 0.95, 0.05, 0.03, mat.walnut, x, 0.76, tz); bx(w - 0.1, 0.1, 0.85, mat.walnutM, x, 0.68, tz);   // top and apron (bottom at 0.63: thighs pass under)
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(new T.CylinderGeometry(0.035, 0.028, 0.63, 10), mat.walnutM, x + sx * (w / 2 - 0.12), 0.315, tz + sz * 0.38);
    bx(w - 0.3, 0.42, 0.03, mat.walnutM, x, 0.42, tz - 0.4);   // modesty panel at the far side
    const hz = tz + 0.98;   // the hips: the table's near edge is 0.5 m ahead of them
    const seats = [x - 0.7, x + 0.7];
    for (const sx of seats) { ctChair(root, add, bx, slab, mat, sx, 0, hz, Math.PI, false); ctMic(add, mat, sx, 0.78, tz - 0.15, Math.PI); }
    // papers, binders, a laptop, water
    bx(0.3, 0.03, 0.22, mat.paper, x - 0.75, 0.795, tz + 0.05, 0.1); bx(0.32, 0.07, 0.25, M({ color: k === 'pros' ? 0x24406A : 0x6A2430, roughness: 0.6 }), x + 1.2, 0.815, tz - 0.1, -0.2);
    const lt = new T.Group(); lt.position.set(x + 0.55, 0.785, tz); lt.rotation.y = Math.PI + 0.2; root.add(lt);
    bx(0.34, 0.015, 0.24, mat.black, 0, 0.008, 0, 0, lt); const scr = bx(0.34, 0.22, 0.01, mat.black, 0, 0.12, -0.12, 0, lt); scr.rotation.x = -0.25;
    const sm = new T.Mesh(new T.PlaneGeometry(0.31, 0.19), new T.MeshBasicMaterial({ color: 0x9EC3E8, toneMapped: true })); sm.position.set(0, 0.12, -0.113); sm.rotation.x = -0.25; lt.add(sm);
    add(new T.CylinderGeometry(0.05, 0.06, 0.24, 20), mat.glass, x - 0.1, 0.9, tz - 0.25);
    for (const gx of [-0.25, 0.05]) add(new T.CylinderGeometry(0.035, 0.03, 0.1, 16), mat.glass, x + gx, 0.83, tz - 0.05);
    A.seats[k] = seats.map(sx => ({ x: sx, y: 0, z: hz, yaw: Math.PI, sit: 1 }));
  }
  slab(1.6, 0.8, 0.05, 0.02, mat.walnut, -6.3, 0.76, 0.0); bx(1.5, 0.1, 0.7, mat.walnutM, -6.3, 0.68, 0.0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(new T.CylinderGeometry(0.03, 0.025, 0.63, 10), mat.walnutM, -6.3 + sx * 0.68, 0.315, sz * 0.3);
  ctChair(root, add, bx, slab, mat, -6.3, 0, 0.9, Math.PI, false); A.seats.fam = { x: -6.3, y: 0, z: 0.9, yaw: Math.PI, sit: 1 };
  bx(0.3, 0.03, 0.22, mat.paper, -6.4, 0.795, -0.05, 0.2);
  // the bar: a balustrade with turned balusters and a gate in the middle
  const bal = new T.LatheGeometry([[0.03, 0], [0.045, 0.04], [0.03, 0.1], [0.025, 0.2], [0.05, 0.38], [0.025, 0.56], [0.03, 0.66], [0.045, 0.72], [0.03, 0.76]].map(p => new T.Vector2(p[0], p[1])), 12);
  const bl: number[][] = []; for (let x = X0 + 0.4; x < X1 - 0.3; x += 0.2) if (Math.abs(x) > 0.85) bl.push([x, 0.05, BAR]);
  inst(bal, mat.walnut, bl);
  for (const s of [-1, 1]) { slab(X1 - 0.85 - 0.2, 0.14, 0.07, 0.03, mat.walnut, s * (0.85 + (X1 - 0.85 - 0.2) / 2), 0.88, BAR); bx(X1 - 1.05, 0.05, 0.12, mat.walnut, s * (0.85 + (X1 - 1.05) / 2), 0.025, BAR); bx(0.12, 0.95, 0.12, mat.walnut, s * 0.85, 0.475, BAR); add(new T.SphereGeometry(0.07, 16, 12), mat.walnut, s * 0.85, 0.99, BAR); }
  // the gate's two leaves, on hinges at the posts: click them to swing them open (and shut)
  A.gate = []; A.hits = A.hits || [];
  { const hit = new T.Mesh(new T.BoxGeometry(1.6, 0.95, 0.3), new T.MeshBasicMaterial({ visible: false })); hit.position.set(0, 0.48, BAR); hit.userData.act = 'gate'; root.add(hit); A.hits.push(hit); }
  for (const s of [-1, 1]) { const g = new T.Group(); g.position.set(s * 0.79, 0, BAR); g.rotation.y = s * 0.0; root.add(g); A.gate.push(g); g.userData.s = s; bx(0.74, 0.06, 0.05, mat.walnut, -s * 0.37, 0.82, 0, 0, g); bx(0.74, 0.06, 0.05, mat.walnut, -s * 0.37, 0.12, 0, 0, g); for (let i = 1; i < 6; i++) bx(0.03, 0.7, 0.03, mat.walnut, -s * i * 0.12, 0.47, 0, 0, g); }
  // the public benches: two blocks of pews behind the bar, the aisle in the middle
  A.seats.pub = [];
  for (let r = 0; r < 7; r++) {
    const hz = BAR + 1.2 + r * 1.02;
    for (const s of [-1, 1]) {
      const xa = s * 1.0, xb = s * 7.3, cx = (xa + xb) / 2, len = Math.abs(xb - xa);
      ctPew(root, add, bx, slab, mat, cx, hz, len);
      const n = Math.floor(len / 0.62);
      for (let i = 0; i < n; i++) A.seats.pub.push({ x: xa + s * (0.42 + i * (len - 0.6) / (n - 1)), y: 0, z: hz, yaw: Math.PI, sit: 1, row: r, side: s, i });
    }
  }
  // the doors at the back, with the exit sign over them; a side door for the judges
  const dz = Z1 - 0.06;
  bx(3.4, 3.3, 0.12, mat.walnut, 0, 1.65, Z1 - 0.02);
  for (const s of [-1, 1]) {
    const d = bx(1.45, 2.95, 0.08, mat.walnutM, s * 0.74, 1.5, dz - 0.04);
    for (const [y, h] of [[2.3, 0.9], [0.95, 1.3]]) bx(1.1, h, 0.03, mat.walnut, s * 0.74, y, dz - 0.09);
    add(new T.CylinderGeometry(0.018, 0.018, 0.5, 10), mat.brass, s * 0.12, 1.15, dz - 0.14);
    void d;
  }
  const ex = new T.Mesh(new T.PlaneGeometry(0.75, 0.28), new T.MeshBasicMaterial({ map: tex.exit, toneMapped: false })); ex.position.set(0, 3.55, Z1 - 0.1); ex.rotation.y = Math.PI; root.add(ex);
  bx(0.8, 0.32, 0.06, mat.black, 0, 3.55, Z1 - 0.05);
  const ck = new T.Mesh(new T.CircleGeometry(0.42, 40), M({ map: tex.clock, roughness: 0.4 })); ck.position.set(0, 5.3, Z1 - 0.06); ck.rotation.y = Math.PI; root.add(ck);
  add(new T.TorusGeometry(0.44, 0.04, 10, 48), mat.gilt, 0, 5.3, Z1 - 0.07);
  const hands: any[] = []; for (const [l, w] of [[0.24, 0.025], [0.34, 0.016]]) { const hg = new T.Group(); hg.position.set(0, 5.3, Z1 - 0.1); root.add(hg); const h = bx(w, l, 0.01, mat.black, 0, l / 2 - 0.04, 0, 0, hg); void h; hands.push(hg); }
  A.clockHands = hands;
  bx(1.2, 2.5, 0.08, mat.walnutM, X1 - 1.5, 1.25 + dais, Z0 + 0.12);   // the judges' door
  bx(0.9, 1.0, 0.03, mat.walnut, X1 - 1.5, 1.8 + dais, Z0 + 0.17);
  add(new T.CylinderGeometry(0.018, 0.018, 0.4, 10), mat.brass, X1 - 1.9, 1.3 + dais, Z0 + 0.2);
  // where the police stand: by the doors and at the side of the bench
  A.police = [{ x: -2.1, y: 0, z: Z1 - 0.7, yaw: Math.PI, sit: 0 }, { x: 2.1, y: 0, z: Z1 - 0.7, yaw: Math.PI, sit: 0 }, { x: 6.9, y: 0, z: -2.4, yaw: -Math.PI / 2 - 0.25, sit: 0 }];
  A.lights = lights; A.shafts = shafts; A.mat = mat; A.root = root;
  return A;
}
/** A chair (or a judge's high-backed one) for a person whose hip is at (x, z), facing yaw. The seat's top is
 *  at 0.49 above its floor, the back 0.2 behind the hip, arms clear of the elbows. */
function ctChair(par: any, add: any, bx: any, slab: any, mat: any, x: number, y: number, z: number, yaw: number, high: boolean) {
  const T = THREE, g = new T.Group(); g.position.set(x, y, z); g.rotation.y = yaw; par.add(g);
  const lm = high ? mat.leatherR : mat.leatherG;
  slab(0.56, 0.52, 0.09, 0.05, lm, 0, 0.49, 0.05, 0, g);   // seat: from 0.2 behind the hip to 0.31 ahead of it
  bx(0.5, 0.06, 0.46, mat.walnutM, 0, 0.38, 0.05, 0, g);
  const bh = high ? 1.15 : 0.55, back = bx(0.56, bh, 0.09, lm, 0, 0.52 + bh / 2, -0.27, 0, g); back.rotation.x = -0.06;
  if (high) { slab(0.62, 0.12, 0.05, 0.03, mat.walnut, 0, 0.55 + bh + 0.05, -0.29, 0, g); }
  for (const s of [-1, 1]) {
    for (const zz of [-0.17, 0.27]) add(new T.CylinderGeometry(0.022, 0.018, 0.36, 8), mat.walnutM, s * 0.23, 0.18, zz, 0, g);
    bx(0.05, 0.05, 0.42, mat.walnut, s * 0.31, 0.74, 0.0, 0, g); bx(0.04, 0.24, 0.04, mat.walnut, s * 0.31, 0.6, 0.16, 0, g);   // arm rests, wide of the hips
  }
  return g;
}
/** A pew: hip line at z (people face −z), seat top 0.49, back 0.2 behind the hips, a book shelf on its back. */
function ctPew(par: any, add: any, bx: any, slab: any, mat: any, x: number, z: number, len: number) {
  const T = THREE;
  slab(len, 0.46, 0.06, 0.03, mat.oak, x, 0.49, z + 0.03);
  bx(len - 0.04, 0.52, 0.05, mat.oak, x, 0.84, z + 0.27); bx(len - 0.04, 0.04, 0.08, mat.oak, x, 1.1, z + 0.27);
  bx(len - 0.1, 0.1, 0.15, mat.oak, x, 0.76, z + 0.36);   // the shelf behind (knees of the row behind stay clear)
  bx(len - 0.1, 0.08, 0.36, mat.oak, x, 0.2, z + 0.03);
  for (const s of [-1, 1]) {
    const sh = new T.Shape(); sh.moveTo(-0.27, 0); sh.lineTo(0.42, 0); sh.lineTo(0.42, 1.02); sh.quadraticCurveTo(0.42, 1.18, 0.26, 1.18); sh.lineTo(0.1, 1.1); sh.quadraticCurveTo(-0.05, 0.62, -0.27, 0.56); sh.closePath();
    const g = new T.ExtrudeGeometry(sh, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2 }); g.translate(0, 0, -0.03); g.rotateY(Math.PI / 2);
    add(g, mat.oak, x + s * (len / 2 + 0.01), 0, z, Math.PI);
  }
}
function ctMic(add: any, mat: any, x: number, y: number, z: number, yaw: number, par?: any) {
  const T = THREE; add(new T.CylinderGeometry(0.04, 0.045, 0.015, 16), mat.black, x, y + 0.008, z, 0, par);
  const neck = add(new T.CylinderGeometry(0.006, 0.006, 0.32, 6), mat.black, x, y + 0.16, z, 0, par); neck.rotation.x = (yaw === 0 ? 1 : -1) * 0.35;
  add(new T.SphereGeometry(0.018, 10, 8), mat.black, x, y + 0.32, z + (yaw === 0 ? 0.11 : -0.11), 0, par);
}

/* ---------- people ---------- */
function ctLook(seed: string, sex: 'm' | 'f', kind: string): any {
  const L: any = randomLook(seed, sex, 'fa' as any), r = ctRng(seedOf(seed));
  L.civil = true; L.hat = 'none'; L.bottom = 'trousers'; L.shoes = sex === 'f' ? 'pumps' : 'oxford';
  if (kind === 'judge') { L.top = 'jacket'; L.uniform = 1; L.neck = 'tie'; L.glasses = r() < 0.4 ? 'rect' : L.glasses; if (L.hairColor < 8 && r() < 0.6) L.hairColor = 8; }
  else if (kind === 'lay') { L.top = sex === 'f' ? 'blouse' : 'jacket'; L.uniform = [2, 0, 5][Math.floor(r() * 3)]; L.neck = sex === 'f' ? 'open' : 'tie'; }
  else if (kind === 'police') { L.top = 'jacket'; L.uniform = 0; L.neck = 'tie'; L.hat = 'cap'; L.shoes = 'boots'; L.glasses = 'none'; L.facial = sex === 'm' && r() < 0.5 ? 'stubble' : 'none'; }
  else if (kind === 'counsel') { L.top = 'jacket'; L.uniform = [1, 2, 0][Math.floor(r() * 3)]; L.neck = sex === 'f' ? 'open' : 'tie'; }
  else if (kind === 'mourn') { L.top = sex === 'f' ? 'blouse' : 'jacket'; L.uniform = 1; L.neck = 'open'; }
  else { L.top = sex === 'f' ? ['blouse', 'pullover', 'jacket'][Math.floor(r() * 3)] : ['jacket', 'pullover', 'shirt', 'pullover'][Math.floor(r() * 4)]; L.uniform = Math.floor(r() * 6); L.neck = L.top === 'jacket' && r() < 0.5 ? 'tie' : 'open'; }
  return L;
}
function seedOf(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

/** The talking gesture (standing): a hand that explains, a nod now and then. */
function ctTalkG(t: number): any {
  const g = humanGesture(null, t), S = Math.sin;
  g.R = [0.42 + 0.18 * S(t * 1.9), 0.16, 0.35, 1.05 + 0.3 * S(t * 2.7 + 1)]; g.L = [0.18 + 0.06 * S(t * 1.3), 0.12, 0.25, 0.75 + 0.15 * S(t * 1.7)];
  g.nod = 0.05 * S(t * 3.1); g.shake = 0.06 * S(t * 0.9); g.calm = 0.6; return g;
}

/* ---------- opening the courtroom ---------- */
/** The heavy part of opening: renderer, room, people (behind the loading screen). */
function ctOpen2(c: any, st: any, root: HTMLElement, q: number, appeal: boolean, judges: number, empty: boolean) {
  const R = CourtRoom, T = THREE;
  const cv = root.querySelector('canvas') as HTMLCanvasElement;
  const ren = new T.WebGLRenderer({ canvas: cv, antialias: q >= 1, powerPreference: 'high-performance' });
  ren.setPixelRatio(Gfx.pr(Gfx.placeSharp('room', q)));
  ren.outputColorSpace = T.SRGBColorSpace; ren.toneMapping = T.ACESFilmicToneMapping; ren.toneMappingExposure = 1.05;
  ren.shadowMap.enabled = Gfx.placeShadow('room', q >= 1); ren.shadowMap.type = T.PCFSoftShadowMap;
  R.ren = ren;
  const scene = new T.Scene(); R.scene = scene; scene.background = new T.Color(0x1A120C); scene.fog = new T.Fog(0x2A2018, 22, 40);
  const cam = new T.PerspectiveCamera(46, 1, 0.05, 80); R.cam = cam;
  // light: daylight through the windows, warm chandeliers, and soft bounce from everywhere
  const hemi = new T.HemisphereLight(0xFFF1DC, 0x3A2616, 0.75); scene.add(hemi);
  const sun = new T.DirectionalLight(0xFFE6C0, 2.6); sun.position.set(-18, 13, 2); sun.target.position.set(0, 0, 0); scene.add(sun); scene.add(sun.target);
  sun.castShadow = q >= 1; sun.shadow.mapSize.set(q >= 2 ? 2048 : 1024, q >= 2 ? 2048 : 1024); const sc = sun.shadow.camera; sc.left = -14; sc.right = 14; sc.top = 14; sc.bottom = -14; sc.near = 1; sc.far = 50; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  const fill = new T.SpotLight(0xFFE2B8, 30, 20, 0.5, 0.6, 1.5); fill.position.set(0, 6.5, 1); fill.target.position.set(0, 1, -6.6); scene.add(fill); scene.add(fill.target);
  // reflections: a soft room of warm walls and bright windows
  try {
    const pm = new T.PMREMGenerator(ren), env = new T.Scene(), box = new T.Mesh(new T.BoxGeometry(16, 7, 20), new T.MeshBasicMaterial({ color: 0x6B4A30, side: T.BackSide })); env.add(box);
    for (const z of [-6, -2, 2, 6]) { const w = new T.Mesh(new T.PlaneGeometry(1.6, 3.6), new T.MeshBasicMaterial({ color: 0xFFF4DD })); w.position.set(-7.9, 1, z); w.rotation.y = Math.PI / 2; env.add(w); }
    const top = new T.Mesh(new T.PlaneGeometry(14, 18), new T.MeshBasicMaterial({ color: 0xE8D8BE })); top.position.y = 3.4; top.rotation.x = Math.PI / 2; env.add(top);
    scene.environment = pm.fromScene(env, 0.04).texture; pm.dispose();
  } catch (e) { /* no reflections */ }
  ctProgress(8, 'Building the hall…');
  const A = ctBuild(scene, judges, q); R.A = A; if (R.empty) { try { R.glow = new AimGlow(scene); } catch (e) { R.glow = null; } } ctProgress(empty ? 55 : 22, empty ? 'Lighting the hall…' : 'The court is coming in…');
  // dust in the light
  { const n = q >= 2 ? 500 : 200, g = new T.BufferGeometry(), p = new Float32Array(n * 3), r = ctRng(9);
    for (let i = 0; i < n; i++) { p[i * 3] = -7 + r() * 6; p[i * 3 + 1] = 0.5 + r() * 5.5; p[i * 3 + 2] = -8 + r() * 17; }
    g.setAttribute('position', new T.BufferAttribute(p, 3));
    const dm = new T.PointsMaterial({ color: 0xFFE8C0, size: 0.018, transparent: true, opacity: 0.55, depthWrite: false, blending: T.AdditiveBlending }); R.dust = new T.Points(g, dm); scene.add(R.dust); }
  R.people = {}; R.crowd = []; R.t0 = performance.now();
  R.shot = { pos: new T.Vector3(6.5, 3.4, 9.5), at: new T.Vector3(0, 1.4, -5) }; cam.position.copy(R.shot.pos); R.camAt = R.shot.at.clone(); R.look = { yaw: 0, pitch: 0 };
  const fit = () => { const w = root.clientWidth, h = root.clientHeight; ren.setSize(w, h, false); cam.aspect = w / Math.max(1, h); cam.updateProjectionMatrix(); };
  fit(); R.fit = fit; window.addEventListener('resize', fit);
  // looking around: drag
  let drag: any = null;
  cv.addEventListener('pointerdown', e => {
    // walking about the empty courtroom on the PC: the view takes the mouse (no pointer, turn as far as you like)
    if (R.empty && DESKTOP && e.pointerType === 'mouse') { drag = null; aimLock(cv); return; }
    drag = { x: e.clientX, y: e.clientY, yaw: R.look.yaw, pitch: R.look.pitch }; cv.setPointerCapture(e.pointerId); });
  R.mm$ = (e: MouseEvent) => { if (R.on && R.empty && aimLocked(cv)) aimTurn(R.look, e, -1.1, 1.1); };
  document.addEventListener('mousemove', R.mm$);
  cv.addEventListener('pointermove', e => { if (!drag) return; R.look.yaw = R.empty ? drag.yaw - (e.clientX - drag.x) * 0.004 : clamp(drag.yaw - (e.clientX - drag.x) * 0.004, -1.2, 1.2); R.look.pitch = clamp(drag.pitch - (e.clientY - drag.y) * 0.003, R.empty ? -1.1 : -0.5, R.empty ? 1.1 : 0.5); });
  cv.addEventListener('pointerup', e => {
    // walking about: a click (the dot in the middle with the mouse taken, or a tap) uses what glows, such as the gate
    if (R.empty) { if (aimLocked(cv)) { if (R.lockedOnce) ctUse(); R.lockedOnce = true; } else if (drag && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) ctUse(e); }
    drag = null; });
  root.addEventListener('click', ev => { const b = (ev.target as HTMLElement).closest('[data-ct]') as HTMLElement; if (b) ctClick(b); });
  roomBoxDrag(root, 'court');
  R.ku$ = (e: KeyboardEvent) => { if (R.on) R.keys[e.key.toLowerCase()] = false; }; window.addEventListener('keyup', R.ku$, true);
  R.key$ = (e: KeyboardEvent) => { if (!R.on) return; if (R.empty && e.key.toLowerCase() === 'h') { e.preventDefault(); R.root.classList.toggle('ui-off'); return; } if (R.empty && /^(w|a|s|d|arrow\w+|shift)$/.test(e.key.toLowerCase())) { R.keys[e.key.toLowerCase()] = true; e.preventDefault(); return; } if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); if (aimLocked()) { aimUnlock(); return; } if (aimEscUsed()) return; ctLeaveAsk(); } else if ((e.key === 'Enter' || e.key === ' ') && !root.querySelector('.ct-modal:not([hidden])')) { const n = root.querySelector('[data-ct="next"]') as HTMLElement; if (n) { e.preventDefault(); ctClick(n); } } };
  window.addEventListener('keydown', R.key$, true);
  // the people come in one by one while the room shows (an empty courtroom has no one in it)
  if (empty) { R.loading = true; ctEmptyStart(); setTimeout(() => ctLoaded(), 60); } else { ctCast(c, st, judges, q); R.loading = true; }
  R.fc = 0;
  R.perf = Perf.state();
  const loop = () => { if (!R.on) return; R.raf = requestAnimationFrame(loop); if (R.loading || Perf.skip(R.perf)) return; ctFrame(); };   // nothing is drawn behind the loading screen, so everything comes in quickly
  R.raf = requestAnimationFrame(loop);
}

CourtRoom.open = function (c: any, st: any) {
  const R = CourtRoom; if (R.on) R.close(true);
  const T = THREE; if (!T) { toast('3D is not available on this device', 'warn'); return; }
  const empty = !c; R.empty = empty; R.keys = {}; R.stick = [0, 0]; R.gateT = 0; R.gateK = 0; R.gateV = 0; R.pushK = 0; R.lockedOnce = false; R.glow = null;
  R.on = true; R.c = c; R.st = st; R.key = st.key; R.lines = empty ? [] : hearingScript(c, st.key); R.i = -1; R.answered = []; R.finished = st.key === 'verdict' ? false : false; R.objected = false;
  const q = Gfx.roomQ();
  const appeal = st.key === 'hearA', judges = appeal ? 5 : 3;
  const root = document.createElement('div'); root.className = 'court3d'; R.root = root;
  const co = company(c ? c.companyId : State.companyId), hub = apt(co.hub), courtName = c ? (appeal ? c.court.replace(/District Court|Crown Court/, 'Court of Appeal') : c.court) : `The District Court in ${hub ? hub.city : 'town'}`;
  root.innerHTML = `<canvas></canvas>
    <div class="ct-top"><div><small>${esc(courtName)}</small><b>${esc(c ? co.name + ': ' + st.title : 'The courtroom, empty: no hearing today')}</b></div></div>
    <button class="ct-leave" data-ct="leave">${icon('close')}<span>Leave court</span><kbd>Esc</kbd></button>
    <div class="ct-ex" hidden></div>${empty ? '<div class="of-aim" hidden>·</div>' : ''}
    <div class="ct-rate" hidden></div>
    <div class="ct-box" hidden><div class="box-grip" title="Drag to move the window (double-click to put it back)"><i></i></div><div class="ct-who"><b></b><small></small></div><p class="ct-text"></p><div class="ct-say"></div><div class="ct-opts"></div><div class="ct-ctl"></div></div>
    ${empty ? `<div class="ct-spots">${[['bench', 'The bench'], ['witness', 'Witness box'], ['def', 'Defence table'], ['pub', 'Public benches'], ['door', 'The doors']].map(x => `<button data-ct="spot" data-k="${x[0]}">${x[1]}</button>`).join('')}</div><div class="ct-hint">${DESKTOP ? 'W A S D to walk · click the view and the mouse looks all the way round · H hides the controls · Esc gives the mouse back, Esc again leaves' : 'Stick to walk · drag to look around'}</div><div class="walk-pad ct-pad"><i></i></div>` : ''}
    ${ctLoaderHtml(empty ? 'The courtroom' : st.key === 'verdict' ? 'The verdict' : 'Court is in session', empty ? 'Opening the doors…' : 'The court is preparing…')}
    <div class="ct-modal" hidden></div>`;
  document.body.appendChild(root);
  R.loadT0 = performance.now();
  setTimeout(() => { if (R.on && R.root === root) ctOpen2(c, st, root, q, appeal, judges, empty); }, 80);
  try { Sound.tick(); } catch (e) { /* silent */ }
};
CourtRoom.close = function (quiet?: boolean) {
  const R = CourtRoom; if (!R.on) return; R.on = false;
  cancelAnimationFrame(R.raf); window.removeEventListener('keydown', R.key$, true); window.removeEventListener('keyup', R.ku$, true); window.removeEventListener('resize', R.fit);
  document.removeEventListener('mousemove', R.mm$); aimUnlock();
  try { Voice.stop(); } catch (e) { /* ignore */ }
  FrameGen.dispose(R.perf); exitFreeRenderer(R.ren, R.scene); R.ren = null; R.scene = null;
  R.root.remove(); R.people = {}; R.crowd = [];
  if (!quiet) { try { refresh(); if (R.c) courtPopup(R.c.id); } catch (e) { /* ignore */ } }
};

/** Who is in court, built a few at a time (the figures are detailed); with a percentage while they arrive. */
function ctCast(c: any, st: any, judges: number, q: number) {
  const R = CourtRoom, A = R.A, co = company(c.companyId), me: any = myPilot(), sys = c.sys || 'judges', lay = sys === 'lay';
  const list: any[] = [];
  const P = (key: string, seat: any, look: any, role: string, name: string, title: string, sex: string, opt?: any) => list.push(Object.assign({ key, seat, look, role, name, title, sex }, opt || {}));
  const mk = (seed: string, sexP?: number) => { const sex: 'm' | 'f' = ctRng(seedOf(seed))() < (sexP == null ? 0.5 : sexP) ? 'f' : 'm'; return { sex, name: makePerson(seed, 'fo' as any, '', co.hub, sex).name }; };
  for (let i = 0; i < judges; i++) {
    const pres = i === (judges - 1) / 2, j = mk('judge-' + c.id + '-' + i);
    P(pres ? 'judge' : 'judge' + i, A.seats.judge[i], ctLook('judge-' + c.id + i, j.sex as any, pres || !lay ? 'judge' : 'lay'), 'exec', (pres ? 'Judge ' : lay ? '' : 'Judge ') + j.name, pres ? 'Presiding judge' : lay ? 'Lay judge' : 'Judge', j.sex);
  }
  const cl = mk('clerk-' + c.id, 0.6); P('clerk', A.seats.clerk, ctLook('clerk-' + c.id, cl.sex as any, 'counsel'), 'exec', cl.name, 'Clerk of the court', cl.sex);
  const pr = mk('pros-' + c.id); P('prosecutor', A.seats.pros[0], ctLook('pros-' + c.id, pr.sex as any, 'counsel'), 'exec', pr.name, 'Prosecutor', pr.sex);
  const staffCase = c.hear && c.hear.kind === 'staff';
  if (staffCase) {
    // a case you brought: you sit with the prosecution (and give evidence from the witness box on day one); the
    // defendant, your employee, sits with their own counsel and takes the stand on day two
    const yl = me && me.look ? Object.assign({}, me.look, { civil: true, top: 'jacket', uniform: 2, hat: 'none', neck: me.look.sex === 'f' ? 'open' : 'tie', bottom: 'trousers' }) : ctLook('you', 'm', 'counsel');
    P('you', st.key === 'hear1' ? A.seats.witness : A.seats.pros[1], yl, 'exec', me ? me.name : 'You', `${co.name}, the injured party${st.key === 'hear1' ? ', witness' : ''}`, yl.sex || 'm');
    const dp: any = staffById(c.staffId), dl = dp && dp.look ? Object.assign({}, dp.look, { civil: true, top: 'jacket', uniform: 0, hat: 'none', neck: 'open', bottom: 'trousers', shoes: 'oxford' }) : ctLook('def-' + c.id, 'm', 'public');
    P('defendant', A.seats.def[1], dl, 'exec', c.name, 'The defendant', (dp && dp.sex) || dl.sex || 'm');
    if (st.key === 'hear2') P('defendantW', A.seats.witness, dl, 'exec', c.name, 'The defendant, on the stand', (dp && dp.sex) || dl.sex || 'm', { hidden: true, pair: 'defendant' });
    const lw = mk('dlaw-' + c.id); P('lawyer', A.seats.def[0], ctLook('dlaw-' + c.id, lw.sex as any, 'counsel'), 'exec', lw.name, 'Counsel for the defence', lw.sex);
    if (st.key === 'hear2') {
      const mate: any = dp ? staffOf(c.companyId, personRole(dp) as any).filter((x: any) => x.id !== dp.id)[0] : null;
      if (mate) { const ml = mate.look ? Object.assign({}, mate.look, { civil: true, top: 'jacket', uniform: 0, neck: 'open', hat: 'none', bottom: 'trousers', shoes: 'oxford' }) : ctLook('mate-' + c.id, 'm', 'public'); P('witness', A.seats.witness, ml, 'exec', mate.name, `${ROLE_NAMES[personRole(mate)]}, a colleague, witness`, mate.sex || 'm', { hidden: true }); }
    }
  } else {
  const pa = mk('pros2-' + c.id); P('prosecutor2', A.seats.pros[1], ctLook('pros2-' + c.id, pa.sex as any, 'counsel'), 'exec', pa.name, 'Assistant prosecutor', pa.sex);
    const yl = me && me.look ? Object.assign({}, me.look, { civil: true, top: 'jacket', uniform: 2, hat: 'none', neck: me.look.sex === 'f' ? 'open' : 'tie', bottom: 'trousers' }) : ctLook('you', 'm', 'counsel');
    P('you', A.seats.def[1], yl, 'exec', me ? me.name : 'You', `Accountable manager, ${co.name}`, yl.sex || 'm');
    const lw = mk('law-' + c.id); P('lawyer', A.seats.def[0], ctLook('law-' + c.id, lw.sex as any, 'counsel'), 'exec', lw.name, 'Your lawyer', lw.sex);
    const fl = mk('fam-' + c.id); P('famlawyer', A.seats.fam, ctLook('fam-' + c.id, fl.sex as any, 'counsel'), 'exec', fl.name, c.hear && c.hear.kind === 'perjury' ? 'Counsel for the wronged employee' : 'Counsel for the families', fl.sex);
    // after an accident investigation: the investigator, the eyewitnesses and a survivor on day one, the person at
    // fault on the stand at the trial (investigation.ts); each takes the witness box in turn
    const inv: any = c.hear && c.hear.kind === 'accident' ? invById(c.hear.inv) : null;
    if (inv) {
      const civ = (l: any) => Object.assign({}, l, { civil: true, top: 'jacket', uniform: 0, neck: 'open', hat: 'none', bottom: 'trousers', shoes: 'oxford' });
      if (st.key === 'hear1') {
        const iv = mk('inv-' + c.id); P('investigator', A.seats.witness, ctLook('inv-' + c.id, iv.sex as any, 'counsel'), 'exec', iv.name, `Investigator, ${inv.authority.replace(/^the /, '')}`, iv.sex);
        for (const w of inv.witnesses) P(w.key, A.seats.witness, ctLook(inv.id + w.key, w.sex, 'public'), 'exec', w.name, w.title, w.sex, { hidden: true });
      }
      if (st.key === 'hear2') {
        const p: any = inv.cause === 'aircraft' && inv.mechId ? staffById(inv.mechId) : inv.cause === 'pilot' && !inv.you && !inv.pilotDied && inv.pilotId ? staffById(inv.pilotId) : null;
        if (p) P('accused', A.seats.witness, p.look ? civ(p.look) : ctLook('acc-' + c.id, p.sex || 'm', 'public'), 'exec', p.name, `${ROLE_NAMES[personRole(p)] || 'Staff'}, at fault according to the investigation`, (p.look && p.look.sex) || p.sex || 'm');
      }
    }
    // the witnesses take the stand one at a time
    else if (st.key === 'hear2') {
      const mechs: any[] = staffOf(c.companyId, 'mech'), chief: any = mechs.slice().sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0))[0];
      const wl = chief && chief.look ? Object.assign({}, chief.look, { civil: true, top: 'jacket', uniform: 0, neck: 'open', hat: 'none', bottom: 'trousers', shoes: 'oxford' }) : ctLook('chief-' + c.id, 'm', 'counsel');
      P('witness', A.seats.witness, wl, 'exec', chief ? chief.name : makePerson('chief-' + c.id, 'mech', c.companyId, co.hub).name, 'Chief mechanic, witness', (chief && chief.sex) || 'm');
      const sv = mk('surv-' + c.id); P('survivor', A.seats.witness, ctLook('surv-' + c.id, sv.sex as any, 'public'), 'exec', sv.name, 'Surviving passenger, witness', sv.sex, { hidden: true });
    }
  }
  // police
  A.police.forEach((s: any, i: number) => { const p = mk('pol-' + c.id + i, 0.3); P('police' + i, s, ctLook('pol-' + c.id + i, p.sex as any, 'police'), 'police', p.name, 'Police', p.sex); });
  // the relatives in the front row, the press at the back, the public between
  const pub = A.seats.pub as any[], nPub = [8, 11, 15, 20][q] || 11;
  const front = pub.filter(s => s.row === 0 && s.side < 0).slice(1, 5), press = pub.filter(s => s.row === 6 && s.side > 0).slice(0, 2);
  const rel = mk('rel-' + c.id + 0, 0.55); if ((!staffCase || c.fatal) && !(c.hear && c.hear.kind === 'perjury')) front.forEach((s, i) => { const r2 = i ? mk('rel-' + c.id + i, 0.55) : rel; P(i ? 'relative' + i : 'relative', s, ctLook('rel-' + c.id + i, r2.sex as any, 'mourn'), 'exec', r2.name, 'Relative of a victim', r2.sex); });
  press.forEach((s, i) => { const p = mk('press-' + c.id + i); P('press' + i, s, ctLook('press-' + c.id + i, p.sex as any, 'public'), 'exec', p.name, 'Press', p.sex); });
  const r = ctRng(seedOf(c.id + st.key)), free = pub.filter(s => front.indexOf(s) < 0 && press.indexOf(s) < 0 && !(s.row === 0 && s.side < 0)), used: any = {};
  for (let i = 0; i < nPub && free.length; i++) { let k = Math.floor(r() * free.length); let tries = 0; while ((used[k] || used[k - 1] || used[k + 1]) && tries++ < 20) k = Math.floor(r() * free.length); used[k] = 1; const p = mk('pub-' + c.id + st.key + i); P('pub' + i, free[k], ctLook('pub-' + c.id + st.key + i, p.sex as any, 'public'), 'exec', p.name, 'Public', p.sex, { crowd: true }); }
  R.cast = list; R.castN = list.length;
  const go = () => {
    if (!R.on) return;
    const t0 = performance.now();
    while (list.length && performance.now() - t0 < 60) {
      const it = list.shift(), main = !it.crowd && !/^police|^press/.test(it.key);
      try { ctPlace(it, Human.build(it.look, it.role, it.role === 'police' ? '#C9A227' : co.color || '#2C8CFF', av3Style(), main ? (q >= 2 ? 0.8 : 0.5) : q >= 2 ? 0.45 : 0.3)); } catch (e) { /* skip this one */ }
    }
    const k = 1 - list.length / R.castN, who = list[0];
    ctProgress(22 + k * 68, !list.length ? 'Taking their seats…' : who && /^judge/.test(who.key) ? 'The judges take the bench…' : who && /^police/.test(who.key) ? 'The police take their places…' : who && (who.crowd || /^relative|^press/.test(who.key)) ? 'The public comes in…' : 'Counsel take their seats…');
    if (list.length) setTimeout(go, 16); else ctLoaded(() => ctNext());
  };
  if (Human.ready) setTimeout(go, 60); else Human.load().then(() => setTimeout(go, 60), () => { toast('The people could not be loaded', 'warn'); ctLoaded(() => ctNext()); });
}
/** Put a person in their seat (or on their spot), facing the right way, on a pivot at the hips so they sway from there. */
function ctPlace(it: any, m: any) {
  const T = THREE, R = CourtRoom, pivot = new T.Group(), holder = new T.Group(); pivot.rotation.order = 'YXZ';
  holder.add(m.root); pivot.add(holder); R.A.root.add(pivot);
  m.root.traverse((o: any) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const p = Object.assign(it, { m, pivot, holder, sitK: it.seat.sit, wantSit: it.seat.sit, ph: Math.random() * 10, g: null, gazeYaw: 0 });
  if (it.hidden) pivot.visible = false;
  R.people[it.key] = p; if (it.crowd || /^relative|^press/.test(it.key)) R.crowd.push(p);
}

/* ---------- every frame ---------- */
function ctFrame() {
  const R = CourtRoom, T = THREE, now = (performance.now() - R.t0) / 1000, dt = Math.min(0.05, now - (R.last || now)); R.last = now;
  const spk = R.speaker ? R.people[R.speaker] : null, spkHead = spk ? ctHead(spk) : null;
  for (const k in R.people) {
    const p = R.people[k]; if (!p.pivot.visible) continue;
    const s = p.seat, top = p.m.top || 1.7, t = now + p.ph;
    p.sitK += Math.sign(p.wantSit - p.sitK) * Math.min(Math.abs(p.wantSit - p.sitK), dt * 1.2);
    const sk = p.sitK * p.sitK * (3 - 2 * p.sitK);
    p.pivot.position.set(s.x, s.y + sk * 0.49, s.z); p.holder.position.y = -sk * top * 0.52; p.pivot.rotation.y = s.yaw;
    // the gentle sway: from the hips when seated, from the ankles when standing; small enough to stay clear of the furniture
    const seated = sk > 0.5, amp = seated ? 1 : 1.3;
    p.pivot.rotation.x = amp * (0.012 * Math.sin(t * 0.37) + 0.006 * Math.sin(t * 0.91 + 1));
    p.pivot.rotation.z = amp * (0.014 * Math.sin(t * 0.29 + 2) + 0.005 * Math.sin(t * 0.77));
    // body language: seated, standing, speaking
    // their voice heard: the mouth follows it (from the start each time Play is pressed), not the reading time
    const vn = k === 'you' ? 'me' : p.name, heard = humanVoiceOn(vn);
    if (R.speaker === k && humanVoiceBusy(vn)) { R.talkUntil = 0; R.sayText = ''; }   // the voice leads: still until it is heard, then with it
    const talking = heard || (R.speaker === k && R.talkUntil > now);
    let gT = humanGesture(null, t);
    if (talking && sk < 0.5) gT = ctTalkG(t);
    const sit = humanGesture({ kind: 'sit', v: 0 }, t);
    gT = cabinLerpG(gT, sit, sk);
    if (talking && sk >= 0.5) { gT.nod += 0.05 * Math.sin(t * 3.3); gT.shake += 0.04 * Math.sin(t * 1.1); }
    // look at whoever is speaking
    let want = 0;
    if (spkHead && R.speaker !== k) { const dx = spkHead.x - s.x, dz = spkHead.z - s.z, a = Math.atan2(dx, dz) - s.yaw; want = clamp(Math.atan2(Math.sin(a), Math.cos(a)), -1.1, 1.1); }
    p.gazeYaw += (want - p.gazeYaw) * Math.min(1, dt * 2.2);
    gT.shake += p.gazeYaw * 0.75;
    if (/^relative/.test(k) && R.mourn) { gT.nod += 0.25; }
    p.g = p.g ? cabinLerpG(p.g, gT, Math.min(1, dt * 6)) : gT;
    p.m.pose({ t, yaw: 0, gaze: [p.gazeYaw * 0.4, 0], blink: (t % 4.3) < 0.12 ? 1 : 0, g: p.g, talk: humanTalk(vn, R.speaker === k ? R.sayText : '', R.sayAt) });
  }
  if (R.empty) { ctWalk(dt); ctGateStep(dt); FrameGen.draw(R.perf, R.ren, R.scene, R.cam); Perf.frame(R.perf, R.ren); return; }
  // the camera eases to the shot, and you can look around it
  const sh = R.shot, ease = Math.min(1, dt * 1.6);
  R.cam.position.lerp(sh.pos, ease); R.camAt.lerp(sh.at, ease);
  const dir = R.camAt.clone().sub(R.cam.position), yaw = R.look.yaw, pitch = R.look.pitch;
  dir.applyAxisAngle(new T.Vector3(0, 1, 0), yaw); const side = new T.Vector3().crossVectors(dir, new T.Vector3(0, 1, 0)).normalize(); dir.applyAxisAngle(side, pitch);
  R.cam.lookAt(R.cam.position.clone().add(dir));
  if (!R.dragging) { R.look.yaw *= 1 - dt * 0.15; R.look.pitch *= 1 - dt * 0.15; }
  // dust drifting in the sunlight, the clock
  if (R.dust) { const a = R.dust.geometry.attributes.position; for (let i = 0; i < a.count; i++) { let y = a.getY(i) + dt * 0.02 * Math.sin(i + now * 0.3); if (y > 6) y = 0.5; a.setY(i, y); a.setX(i, a.getX(i) + dt * 0.01 * Math.cos(i * 1.7 + now * 0.2)); } a.needsUpdate = true; }
  if (R.A.clockHands) { const d = new Date(), hrs = (d.getHours() % 12 + d.getMinutes() / 60) / 12, mn = d.getMinutes() / 60; R.A.clockHands[0].rotation.z = hrs * Math.PI * 2; R.A.clockHands[1].rotation.z = mn * Math.PI * 2; }
  FrameGen.draw(R.perf, R.ren, R.scene, R.cam); Perf.frame(R.perf, R.ren);
}
function ctHead(p: any): any { const s = p.seat, sk = p.sitK; return new THREE.Vector3(s.x, s.y + (sk > 0.5 ? 1.28 : (p.m.top || 1.7) - 0.12), s.z); }
/** A camera shot of someone speaking: from in front of them, a little to one side, at about eye level. */
function ctShotOf(key: string) {
  const R = CourtRoom, T = THREE, p = R.people[key];
  if (!p) { R.shot = { pos: new T.Vector3(6.5, 3.4, 9.5), at: new T.Vector3(0, 1.4, -5) }; return; }
  const h = ctHead(p), f = new T.Vector3(Math.sin(p.seat.yaw), 0, Math.cos(p.seat.yaw)), sd = new T.Vector3(f.z, 0, -f.x);
  const far = /^judge/.test(key) ? 5.2 : key === 'witness' || key === 'survivor' || p.seat === R.A.seats.witness ? 3.6 : /^relative/.test(key) ? 3.0 : 3.2, off = key === 'you' ? -1.1 : 0.9;
  const pos = h.clone().add(f.multiplyScalar(far)).add(sd.multiplyScalar(off)); pos.y = h.y + (/^judge/.test(key) ? -0.25 : 0.15);
  pos.x = clamp(pos.x, -7.4, 7.4); pos.z = clamp(pos.z, -8.4, 10);
  R.shot = { pos, at: h.clone().add(new T.Vector3(0, /^judge/.test(key) ? -0.75 : -0.55, 0)) };   // the speaker sits above the dialogue box
}

/* ---------- the hearing, line by line ---------- */
function ctBox(): any { const b = CourtRoom.root.querySelector('.ct-box') as HTMLElement; b.hidden = false; return b; }
function ctSay(key: string, text: string, mood?: string) {
  const R = CourtRoom, p = R.people[key] || R.people[key === 'relative' ? 'relative' : key];
  R.speaker = key; R.talkUntil = (performance.now() - R.t0) / 1000 + Math.max(2.5, text.split(/\s+/).length * 0.36); R.sayText = text; R.sayAt = Date.now();
  if (p && p.seat && key !== 'judge' && !/^judge|clerk|witness|survivor|defendantW/.test(key) && p.seat !== R.A.seats.witness) p.wantSit = 0;   // counsel, you and relatives stand to speak (the witness box sits)
  // whoever speaks from the witness box is the one in it; the defendant leaves their table for it
  if (p && p.seat === R.A.seats.witness && p.pivot) { for (const k in R.people) { const o = R.people[k]; if (o !== p && o.seat === R.A.seats.witness && o.pivot && k !== 'you') { o.pivot.visible = false; if (o.pair && R.people[o.pair]) R.people[o.pair].pivot.visible = true; } } p.pivot.visible = true; if (p.pair && R.people[p.pair]) R.people[p.pair].pivot.visible = false; }
  if (key === 'survivor' && R.people.survivor) { R.people.survivor.pivot.visible = true; if (R.people.witness) R.people.witness.pivot.visible = false; }
  ctShotOf(key);
  const b = ctBox(), name = p ? p.name : key, title = p ? p.title : '';
  (b.querySelector('.ct-who b') as HTMLElement).textContent = name; (b.querySelector('.ct-who small') as HTMLElement).textContent = title;
  (b.querySelector('.ct-text') as HTMLElement).textContent = text;
  const voiceWho = key === 'you' ? myWho(mood || '') : `pax|${p && p.sex === 'f' ? 'f' : 'm'}|${mood || (/sorry|apolog/i.test(text) ? 'sorry' : 'neutral')}|${name}`;   // you speak with your own voice
  (b.querySelector('.ct-say') as HTMLElement).innerHTML = voiceButton(text, voiceWho, 'Play');
  (b.querySelector('.ct-opts') as HTMLElement).innerHTML = '';
  if (/^All rise/.test(text) || /adjourned\.?$/.test(text)) ctGavel();
  if (/^All rise/.test(text)) { for (const k in R.people) if (!/^police/.test(k)) { const q = R.people[k]; q.rise = true; q.wantSit = 0; } setTimeout(() => { for (const k in R.people) { const q = R.people[k]; if (q.rise) { q.rise = false; q.wantSit = q.seat.sit; } } }, 4200); }
}
function ctSitDown(except?: string) { const R = CourtRoom; for (const k in R.people) { const p = R.people[k]; if (k !== except && !p.rise) p.wantSit = p.seat.sit; } }
function ctCtl(html: string) { (ctBox().querySelector('.ct-ctl') as HTMLElement).innerHTML = html; }

function ctNext() {
  const R = CourtRoom; if (!R.on) return;
  ctSitDown();
  R.i++; R.objected = false; R.exNow = null;
  const ln: HearLine = R.lines[R.i];
  if (!ln) { ctEnd(); return; }
  if (ln.ex) ctExhibit(ln.ex);
  if (ln.who === 'relative' || ln.who === 'survivor') R.mourn = true;
  if (ln.who === 'clerk' || /adjourned\.?$/.test(ln.text)) (R.root.querySelector('.ct-ex') as HTMLElement).hidden = true;
  if (ln.q) { ctAsk(ln); return; }
  if (ln.ask) { ctAskOwn(ln); return; }
  ctSay(ln.who === 'judge' ? 'judge' : ln.who, ln.text, ln.mood);
  ctCtl(`<button class="btn primary" data-ct="next">Continue</button>`);
}
function ctExhibit(ex: any) {
  const R = CourtRoom, A = R.A; A.screens.cv.forEach((cv: HTMLCanvasElement, i: number) => { ctExhibitDraw(cv, ex); A.screens.tex[i].needsUpdate = true; });
  const e = R.root.querySelector('.ct-ex') as HTMLElement; e.hidden = false;
  e.innerHTML = `<b>${esc(ex.title)}</b>${ex.rows.map((r: string[]) => `<div><small>${esc(r[0])}</small><span>${esc(r[1])}</span></div>`).join('')}${ex.note ? `<p>${esc(ex.note)}</p>` : ''}`;
}
/** Your turn to question the defendant: three ways to ask. */
function ctAskOwn(ln: HearLine) {
  const R = CourtRoom, b = ctBox(), me: any = myPilot();
  ctShotOf(R.people.defendantW ? 'defendantW' : 'defendant');
  (b.querySelector('.ct-who b') as HTMLElement).textContent = me ? me.name : 'You'; (b.querySelector('.ct-who small') as HTMLElement).textContent = 'Your question to the defendant';
  (b.querySelector('.ct-text') as HTMLElement).textContent = 'Choose how to put it: an open question, the evidence, or pressing hard (the court may not allow it).';
  (b.querySelector('.ct-say') as HTMLElement).innerHTML = '';
  (b.querySelector('.ct-opts') as HTMLElement).innerHTML = ln.ask.opts.map((o, i) => `<button class="ct-opt" data-ct="own" data-i="${i}">${esc(o.t)}<small>${o.kind === 'facts' ? 'Open question' : o.kind === 'evidence' ? 'With the evidence' : 'Pressing hard'}</small></button>`).join('');
  ctCtl('');
}
/** A question to you: the options, your lawyer's suggestion, an objection where your lawyer can make one. */
function ctAsk(ln: HearLine) {
  const R = CourtRoom, c = R.c, q = ln.q as HearQ;
  const staffCase = c.hear && c.hear.kind === 'staff', who = staffCase && R.people[ln.who] ? ln.who : ln.who === 'famlawyer' ? 'famlawyer' : ln.who === 'lawyer' ? 'judge' : q.asker === 'judge' ? 'judge' : 'prosecutor';
  ctSay(who, q.text);
  const sug = hearingSuggest(c, q);
  const b = ctBox();
  (b.querySelector('.ct-opts') as HTMLElement).innerHTML = q.opts.map((o, i) => `<button class="ct-opt ${i === sug ? 'sug' : ''}" data-ct="ans" data-i="${i}">${esc(o.t)}${i === sug ? `<small>${staffCase ? 'The prosecutor suggests this' : 'Your lawyer suggests this'}</small>` : ''}</button>`).join('');
  ctCtl(!R.objected && hearingCanObject(c, q) ? `<button class="btn ghost" data-ct="object">Your lawyer objects</button>` : '');
}
function ctClick(b: HTMLElement) {
  const R = CourtRoom, k = b.getAttribute('data-ct'), c = R.c;
  if (k === 'next') { Voice.stop(); ctNext(); }
  else if (k === 'leave') ctLeaveAsk();
  else if (k === 'stay') (R.root.querySelector('.ct-modal') as HTMLElement).hidden = true;
  else if (k === 'pay') { (R.root.querySelector('.ct-modal') as HTMLElement).hidden = true; ctPayLeave(); }
  else if (k === 'exit') ctExitToMain();
  else if (k === 'spot') ctSpot(b.getAttribute('data-k'));
  else if (k === 'own') {
    // your question to the defendant: you ask (standing at your table), they answer from the stand, the judge may comment
    const ln = R.lines[R.i], o = ln.ask.opts[+(b.getAttribute('data-i') as string)]; Voice.stop();
    const res = courtStaffAsk(c, o.kind); Store.save();
    ctSay('you', o.t); ctRateChip(res.d);
    R.react = { who: R.people.defendantW ? 'defendantW' : 'defendant', text: res.answer, then: res.note ? { who: 'judge', text: res.note } : null };
    ctCtl(`<button class="btn primary" data-ct="react">Continue</button>`);
  }
  else if (k === 'object') {
    const ln = R.lines[R.i]; R.objected = true; Voice.stop();
    ctSay('lawyer', 'Objection, your honour. The question is leading, and goes beyond what this witness can fairly be asked.');
    (ctBox().querySelector('.ct-opts') as HTMLElement).innerHTML = '';
    const ok = hearingObject(c);
    ctCtl(`<button class="btn primary" data-ct="ruling" data-ok="${ok ? 1 : 0}">Continue</button>`); void ln;
  } else if (k === 'ruling') {
    const ok = b.getAttribute('data-ok') === '1', ln = R.lines[R.i];
    Voice.stop(); ctSitDown();
    if (ok) { ctSay('judge', 'Sustained. The prosecution will move on.'); R.answered.push(ln.q.id); ctCtl(`<button class="btn primary" data-ct="next">Continue</button>`); }
    else { ctSay('judge', 'Overruled. Please answer the question.'); hearRate(c, -0.2, 'An objection overruled'); ctRateChip(-0.2); ctCtl(`<button class="btn primary" data-ct="reask">Continue</button>`); }
  } else if (k === 'reask') { ctAsk(R.lines[R.i]); }
  else if (k === 'ans') {
    const ln = R.lines[R.i], q = ln.q as HearQ, o = q.opts[+(b.getAttribute('data-i') as string)]; Voice.stop();
    if (o.kind === 'settle' || o.kind === 'nosettle') hearDecide(c, 'settle', o.kind === 'settle');
    if (o.kind === 'plea' || o.kind === 'noplea') hearDecide(c, 'plea', o.kind === 'plea');
    if (o.kind === 'act') hearDecide(c, 'act', true);
    const res = hearingScore(c, q, o.kind); R.answered.push(q.id); Store.save();
    // you stand and answer; then the reaction
    ctSay('you', o.t.replace(/\s*\([^)]*\)$/, '')); ctRateChip(res.d);
    R.react = { who: c.hear && c.hear.kind === 'staff' && R.people[ln.who] ? ln.who : ln.who === 'famlawyer' ? 'famlawyer' : q.asker === 'judge' || ln.who === 'lawyer' ? 'judge' : 'prosecutor', text: res.say };
    ctCtl(`<button class="btn primary" data-ct="react">Continue</button>`);
  } else if (k === 'react') {
    Voice.stop(); ctSitDown(); const r = R.react; R.react = null;
    if (r && r.text) { ctSay(r.who, r.text); if (r.then) { R.react = r.then; ctCtl(`<button class="btn primary" data-ct="react">Continue</button>`); } else ctCtl(`<button class="btn primary" data-ct="next">Continue</button>`); } else ctNext();
  }
}
function ctRateChip(d: number) {
  if (!d) return; const e = CourtRoom.root.querySelector('.ct-rate') as HTMLElement; e.hidden = false;
  e.className = 'ct-rate ' + (d > 0 ? 'up' : 'down'); e.textContent = `${d > 0 ? '+' : ''}${d} company rating`;
  clearTimeout(CourtRoom.rateT); CourtRoom.rateT = setTimeout(() => { e.hidden = true; }, 3200);
}
/** The court rises: the day is done, you may leave. */
function ctEnd() {
  const R = CourtRoom; if (R.finished) return; R.finished = true;
  hearingFinish(R.c, R.st);
  ctShotOf(''); R.speaker = null;
  const b = ctBox(); (b.querySelector('.ct-who b') as HTMLElement).textContent = R.key === 'verdict' ? 'The case is closed' : 'The court has risen';
  (b.querySelector('.ct-who small') as HTMLElement).textContent = ''; (b.querySelector('.ct-say') as HTMLElement).innerHTML = ''; (b.querySelector('.ct-opts') as HTMLElement).innerHTML = '';
  const h = R.c.hear; (b.querySelector('.ct-text') as HTMLElement).textContent = R.key === 'verdict' ? (R.c.sentence ? `Sentence: ${R.c.sentence}.` : 'Not guilty.') : `Your company rating in court so far: ${h.rating > 0 ? '+' : ''}${h.rating}. ${h.honest} honest ${h.honest === 1 ? 'answer' : 'answers'}${h.lies ? `, ${h.lies} contradicted by the records` : ''}.`;
  ctCtl(`<button class="btn primary" data-ct="exit">Leave the courtroom</button>`);
  (R.root.querySelector('.ct-leave span') as HTMLElement).textContent = 'Leave';
}
/** Leaving before the court rises: only with a board member standing in, for a large sum. */
function ctLeaveAsk() {
  const R = CourtRoom; if (R.empty || R.finished || R.key === 'verdict' || (R.c && R.c.hear && R.c.hear.standIn)) { ctExitToMain(); return; }
  const m = R.root.querySelector('.ct-modal') as HTMLElement, cost = standInCost(R.c), co = company(R.c.companyId);
  m.hidden = false;
  m.innerHTML = `<div class="ct-mbox"><h3>The hearing is not over</h3><p>If you leave the courtroom now, a member of ${esc(co.name)}'s board must take your place for the rest of the case. That costs <b>${money(cost)}</b>. From then on the hearings go ahead without you, but the big decisions (a settlement, a plea, an appeal) still come to you.</p>
    <div class="btn-row"><button class="btn ghost" data-ct="stay">Stay in court</button><button class="btn primary" data-ct="pay">Pay ${money(cost)} and leave</button></div></div>`;
}
function ctPayLeave() {
  const R = CourtRoom, c = R.c;
  standInHire(c);
  const real = c.stages.filter((s: any) => s.key === R.key)[0];
  if (real && !real.done) hearingAuto(c, real, 'standin', R.answered);
  ctExitToMain();
}
/** Out of the courtroom: the court's loading screen while the room is cleared from memory and the app comes back. */
function ctExitToMain() {
  const R = CourtRoom; if (!R.on) return; const c = R.c;
  exitSplash('court', 'Leaving the courtroom', [
    { pct: 30, step: 'The court rises…', run: () => CourtRoom.close(true) },
    { pct: 55, step: 'Clearing the courtroom from memory…', run: exitFreeMemory },
    { pct: 85, step: 'Loading your airline…', run: () => refresh() },
  ], () => { if (c) { try { courtPopup(c.id); } catch (e) { /* none */ } } });
}
/** The judge's gavel: two knocks on wood. */
function ctGavel() {
  try {
    if (State.settings.muteAll) return;
    const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext, ac = CourtRoom.ac || (CourtRoom.ac = new AC());
    [0, 0.32].forEach(dl => {
      const t = ac.currentTime + 0.05 + dl, o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
      o.type = 'triangle'; o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(90, t + 0.12);
      f.type = 'lowpass'; f.frequency.value = 900; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.6, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.connect(f); f.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + 0.2);
      const n = ac.createBuffer(1, 2205, 44100), d = n.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / 240);
      const s = ac.createBufferSource(), sg = ac.createGain(); s.buffer = n; sg.gain.value = 0.35; s.connect(sg); sg.connect(ac.destination); s.start(t);
    });
  } catch (e) { /* no sound */ }
}

/* ---------- the empty courtroom: walk about ---------- */
// Where you can't walk: the bench and its dais, the clerk's desk, the witness box, the tables, the bar (but its
// gate), the pews and the walls. Rectangles [x0, z0, x1, z1].
function ctBlocked(x: number, z: number): boolean {
  if (x < -7.6 || x > 7.6 || z < -8.6 || z > 10.1) return true;
  const B: number[][] = [[-4.6, -9, 4.6, -5.2], [-1.25, -5.0, 1.25, -3.6], [4.1, -5.8, 5.9, -3.8], [-5.2, -1.75, -1.8, -0.0], [1.8, -1.75, 5.2, -0.0], [-7.2, -0.5, -5.4, 1.2], [-8, 1.45, -0.85, 1.75], [0.85, 1.45, 8, 1.75]];
  for (const r of B) if (x > r[0] && x < r[2] && z > r[1] && z < r[3]) return true;
  if (Math.abs(x) < 0.85 && Math.abs(z - 1.6) < 0.14 && (CourtRoom.gateK || 0) < 0.8) return true;   // the gate, unless it is open
  if (z > 2.55 && z < 2.55 + 7 * 1.02 && Math.abs(x) > 0.85 && Math.abs(x) < 7.45) {   // the pews (seat front to shelf); you can walk the rows between them
    const rz = (z - 2.55) / 1.02 - Math.floor((z - 2.55) / 1.02); if (rz < 0.7) return true;
  }
  return false;
}
function ctEmptyStart() {
  const R = CourtRoom, T = THREE;
  R.free = { x: 0, z: 9.2, yaw: 0, bob: 0, v: 0 }; R.look = { yaw: 0, pitch: -0.04 };
  const pad = R.root.querySelector('.ct-pad') as HTMLElement;
  if (pad) {
    const knob = pad.firstElementChild as HTMLElement; let id = -1;
    const move = (e: PointerEvent) => { const r = pad.getBoundingClientRect(), Rr = r.width / 2; let dx = (e.clientX - r.left - Rr) / Rr, dy = (e.clientY - r.top - Rr) / Rr; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } R.stick = [dx, -dy]; knob.style.transform = `translate(${dx * Rr * 0.6}px, ${dy * Rr * 0.6}px)`; };
    pad.addEventListener('pointerdown', e => { e.stopPropagation(); id = e.pointerId; pad.setPointerCapture(id); move(e); });
    pad.addEventListener('pointermove', e => { if (e.pointerId === id) move(e); });
    const up = (e: PointerEvent) => { if (e.pointerId !== id) return; id = -1; R.stick = [0, 0]; knob.style.transform = ''; };
    pad.addEventListener('pointerup', up); pad.addEventListener('pointercancel', up);
  }
  setTimeout(() => { const h = R.root && R.root.querySelector('.ct-hint'); if (h) h.classList.add('fade'); }, 7000);
  void T;
}
/* ---------- the gate in the bar: push it open, walk through, push it shut ---------- */
function ctAimedObj(e?: PointerEvent): any {
  const R = CourtRoom, T = THREE; if (!R.A || !R.A.hits) return null;
  const rc = new T.Raycaster();
  if (e && !aimLocked()) { const r = (R.root.querySelector('canvas') as HTMLElement).getBoundingClientRect(); rc.setFromCamera(new T.Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), R.cam); }
  else rc.setFromCamera(new T.Vector2(0, 0), R.cam);
  const h = rc.intersectObjects(R.A.hits, false)[0];
  return h && h.distance < 2.4 ? h.object : null;
}
function ctUse(e?: PointerEvent) { const o = ctAimedObj(e); if (o && o.userData.act === 'gate') ctGateToggle(); }
function ctGateToggle() {
  const R = CourtRoom, F = R.free; if (!F) return;
  const open = !R.gateT;
  if (!open && Math.abs(F.x) < 0.95 && Math.abs(F.z - 1.6) < 0.55) { toast('Step out of the gateway first', 'info'); return; }
  // it swings away from you as you push it: into the well from the public side, out towards the benches from inside
  if (open) R.gateDir = F.z > 1.6 ? 1 : -1;
  R.gateT = open ? 1 : 0; R.gateV = R.gateV || 0;
  R.pushK = 1;   // a small lean forward as you push
  try { Sound.gate(open); } catch (x) { /* quiet */ }
}
/** The leaves swing on a spring with a little bounce at the end; the view nudges with your push. */
function ctGateStep(dt: number) {
  const R = CourtRoom, A = R.A; if (!A || !A.gate) return;
  const want = R.gateT || 0; let k = R.gateK || 0, v = R.gateV || 0;
  v += ((want - k) * 38 - v * 7.5) * dt; k += v * dt; k = clamp(k, -0.06, 1.06);
  R.gateK = k; R.gateV = v;
  const ang = 1.5 * k * (R.gateDir || 1);
  for (const g of A.gate) g.rotation.y = -g.userData.s * ang;
  if (R.pushK > 0) { R.pushK = Math.max(0, R.pushK - dt * 2.2); const p = Math.sin(Math.PI * (1 - R.pushK)) * 0.06, yaw = R.look.yaw; R.cam.position.x += -Math.sin(yaw) * p; R.cam.position.z += -Math.cos(yaw) * p; R.cam.position.y -= p * 0.4; }
  // what you can use glows, with a word at the dot
  const o = ctAimedObj(), aim = R.root.querySelector('.of-aim') as HTMLElement;
  if (R.glow) { if (o) R.glow.showObj(o); else R.glow.hide(); R.glow.step(dt); }
  if (aim) { aim.hidden = false; aim.textContent = o ? (R.gateT ? 'Click to close the gate' : 'Click to open the gate') : '·'; aim.classList.toggle('on', !!o); }
}

/** Jump to a spot in the courtroom, looking the natural way from there. */
function ctSpot(k: string) {
  const R = CourtRoom, F = R.free; if (!F) return;
  const S: any = { bench: [0, -6.9, Math.PI, 0.75], witness: [5.0, -4.85, Math.PI - 0.55, 0.3], def: [3.5, -0.2, 0, 0], pub: [-3.0, 5.0, 0, 0], door: [0, 9.2, 0, 0] }[k];
  if (!S) return; F.x = S[0]; F.z = S[1]; F.floor = S[3]; R.look.yaw = S[2]; R.look.pitch = -0.05; Sound.tick();
}
function ctWalk(dt: number) {
  const R = CourtRoom, F = R.free, K = R.keys || {}, T = THREE;
  const f = (K.w || K.arrowup ? 1 : 0) - (K.s || K.arrowdown ? 1 : 0) + R.stick[1], r = (K.d || K.arrowright ? 1 : 0) - (K.a || K.arrowleft ? 1 : 0) + R.stick[0];
  const mag = Math.min(1, Math.hypot(f, r)), vmax = K.shift ? 2.4 : 1.4;
  F.v += ((mag > 0.05 ? vmax * mag : 0) - F.v) * Math.min(1, dt * 6);
  const yaw = R.look.yaw, fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  let mx = fx * f + rx * r, mz = fz * f + rz * r; const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml;
  const step = F.v * dt;
  if (step > 0) {
    if (F.floor && (F.z > -5.2 || Math.abs(F.x) > 4.6)) F.floor = 0;   // stepped down off the dais or out of the box
    const can = (x: number, z: number) => F.floor ? true : !ctBlocked(x, z);
    const nx = F.x + mx * step, nz = F.z + mz * step;
    if (can(nx, nz)) { F.x = nx; F.z = nz; } else if (can(nx, F.z)) F.x = nx; else if (can(F.x, nz)) F.z = nz;
    F.bob += step;
  }
  // underfoot: the boards of the dais and the boxes, parquet before the bar with a marble border, carpet behind it
  Sound.steps(F, F.bob, F.floor ? 'wood' : F.z > 1.6 ? 'carpet' : (Math.abs(F.x) > 7.4 || F.z < -8.4) ? 'tile' : 'wood', F.v);
  const eye = 1.64 + (F.floor || 0) + Math.sin(F.bob / 0.65 * Math.PI) * 0.018 * Math.min(1, F.v / 1.2);
  R.cam.position.set(F.x, eye, F.z);
  const p = R.look.pitch, dir = new T.Vector3(fx * Math.cos(p), Math.sin(p), fz * Math.cos(p));
  R.cam.lookAt(R.cam.position.clone().add(dir));
  if (R.dust) { const a = R.dust.geometry.attributes.position, now = performance.now() / 1000; for (let i = 0; i < a.count; i++) { let y = a.getY(i) + dt * 0.02 * Math.sin(i + now * 0.3); if (y > 6) y = 0.5; a.setY(i, y); } a.needsUpdate = true; }
}

/* ---------- entering the courtroom from the app ---------- */
/** Into the courtroom: to the hearing if one is on (or a verdict to hear), otherwise the empty room. */
function courtEnter() {
  const cases: any[] = ((State as any).cases || []).filter((c: any) => c.hear && c.companyId === State.companyId);
  for (const c of cases) { const w = hearingWaiting(c); if (w && !c.hear.standIn) { closeAll(); CourtRoom.open(c, w); return; } }
  for (const c of cases) if (c.hear.verdictReady && !c.hear.verdictSeen) { closeAll(); CourtRoom.open(c, { key: 'verdict', title: 'The verdict' }); return; }
  closeAll(); CourtRoom.open(null, { key: 'empty', title: 'The courtroom' });
}
ACTIONS['court-enter'] = () => courtEnter();

/* ---------- the loading screen ---------- */
/** The courtroom's loading screen: the scales of justice weighing, in walnut, gold and deep blue, with a
 *  courthouse front and a progress bar that runs until the room, the people and the light are ready. */
function ctLoaderHtml(title: string, step: string, emblem?: string, scene?: string): string {
  const cols = Array.from({ length: 8 }, (_, i) => `<rect x="${118 + i * 40}" y="120" width="16" height="118" rx="3"/>`).join('');
  return `<div class="ct-loader">
    <div class="ctl-glow"></div>
    ${scene || `<svg class="ctl-house" viewBox="0 0 560 260" aria-hidden="true"><path d="M90 116 L280 34 L470 116 Z"/><rect x="96" y="112" width="368" height="10"/>${cols}<rect x="88" y="238" width="384" height="10"/><rect x="72" y="248" width="416" height="12"/></svg>`}
    <div class="ctl-rings"><i></i><i></i></div>
    ${emblem || `<svg class="ctl-scales" viewBox="0 0 200 200" aria-hidden="true">
      <defs><linearGradient id="ctlG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F6DB8E"/><stop offset=".55" stop-color="#C8963E"/><stop offset="1" stop-color="#8A5E22"/></linearGradient></defs>
      <circle cx="100" cy="100" r="94" fill="#13213A" stroke="url(#ctlG)" stroke-width="4"/><circle cx="100" cy="100" r="86" fill="none" stroke="url(#ctlG)" stroke-width="1.2" opacity=".7"/>
      ${Array.from({ length: 22 }, (_, i) => { const sd = i < 11 ? -1 : 1, k = i % 11, a = Math.PI / 2 + sd * (0.45 + k * 0.2), x = 100 + Math.cos(a) * 74, y = 100 + Math.sin(a) * 74; return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="7" ry="2.8" fill="url(#ctlG)" transform="rotate(${(a * 180 / Math.PI + sd * 50).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`; }).join('')}
      <g fill="url(#ctlG)" stroke="url(#ctlG)">
        <rect x="97" y="52" width="6" height="96" rx="2"/><circle cx="100" cy="48" r="6"/><rect x="80" y="146" width="40" height="6" rx="2"/><rect x="72" y="152" width="56" height="6" rx="2"/>
        <g class="ctl-beam"><path d="M48 66 Q100 58 152 66" fill="none" stroke-width="4" stroke-linecap="round"/>
          <g class="ctl-pan l"><path d="M48 66 L32 104 M48 66 L64 104" fill="none" stroke-width="1.5"/><path d="M26 104 Q48 120 70 104 Z"/></g>
          <g class="ctl-pan r"><path d="M152 66 L136 104 M152 66 L168 104" fill="none" stroke-width="1.5"/><path d="M130 104 Q152 120 174 104 Z"/></g></g>
      </g></svg>`}
    <div class="ctl-name"><b>${esc(title)}</b></div>
    <div class="ctl-load"><div class="ctl-info"><span class="ctl-step">${esc(step)}</span><b class="ctl-pct">0%</b></div>
      <div class="ctl-bar"><i class="ctl-fill"><span></span></i><span class="ctl-tip"><svg viewBox="0 0 24 24"><path d="M3 19.5 13.5 9l1.6 1.6L4.6 21.1zM12.2 4.6l4-4 7.2 7.2-4 4z" fill="currentColor"/><rect x="11" y="5" width="9" height="5" rx="1" transform="rotate(45 15.5 7.5)" fill="currentColor"/></svg></span></div></div>
  </div>`;
}
function ctProgress(pct: number, step?: string, RR?: any) {
  const R = RR || CourtRoom, L = R.root && R.root.querySelector('.ct-loader') as HTMLElement; if (!L) return;
  pct = Math.max(R.pct || 0, Math.min(100, pct)); R.pct = pct;
  (L.querySelector('.ctl-pct') as HTMLElement).textContent = Math.round(pct) + '%';
  (L.querySelector('.ctl-fill') as HTMLElement).style.width = pct + '%'; (L.querySelector('.ctl-tip') as HTMLElement).style.left = pct + '%';
  if (step) (L.querySelector('.ctl-step') as HTMLElement).textContent = step;
}
/** Everything is built: prepare the light and the materials on the graphics card, draw the first picture, then
 *  open the doors (the screen stays at least a couple of seconds, as the 3D map's does). */
function ctLoaded(then?: () => void) {
  const R = CourtRoom; if (!R.on) return;
  ctProgress(92, 'Lighting the hall…');
  setTimeout(() => {
    if (!R.on) return;
    try { R.ren.compile(R.scene, R.cam); } catch (e) { /* compiled on the first frame */ }
    R.loading = false; try { ctFrame(); } catch (e) { /* next frame */ }
    ctProgress(100, 'Ready');
    const wait = Math.max(300, 2600 - (performance.now() - R.loadT0));
    setTimeout(() => { const L = R.root && R.root.querySelector('.ct-loader') as HTMLElement; if (L) { L.classList.add('out'); setTimeout(() => L.remove(), 800); } if (then) setTimeout(then, 500); }, wait);
  }, 40);
}
