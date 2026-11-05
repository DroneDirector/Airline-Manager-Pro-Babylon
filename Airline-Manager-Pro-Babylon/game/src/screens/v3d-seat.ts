// The cabin seats in detail: upholstered cushions with real depth (padded panels, side bolsters, seams pressed
// into the padding with double stitching beside them), a two-tone headrest with wings, a grab handle on top and
// moulded armrests that curve down to the seat front, as on a modern slimline economy seat. How finely they are
// made follows the cabin quality (Settings → Graphics → Cabin). The seats near you are drawn in full detail and
// the ones further away in a lighter version with the same look, each fading over to the other as you move, so
// nothing pops. Every part is one shared shape drawn for all the seats at once.

const SeatParts: any = { key: '' };

/** Sample positions 0…1: evenly spread, with extra ones close to the edges (the rounded border) and either
 *  side of each seam (the groove). */
function seatSamples(n: number, seams: number[], edge: number, fine: number): number[] {
  const s: number[] = [], ne = [0, 2, 3, 6][fine];
  for (let i = 0; i <= n; i++) s.push(i / n);
  for (let i = 1; i <= ne; i++) { const e = edge * Math.pow(i / ne, 1.6); s.push(e, 1 - e); }
  const offs = [[], [-0.008, 0, 0.008], [-0.016, -0.006, 0, 0.006, 0.016], [-0.03, -0.016, -0.008, -0.003, 0, 0.003, 0.008, 0.016, 0.03]][fine];
  for (const m of seams) for (const o of offs) s.push(m + o);
  return s.filter(x => x >= 0 && x <= 1).sort((a, b) => a - b).filter((x, i, a) => i === 0 || x - a[i - 1] > 1e-4);
}

/** A padded cushion: a rounded, puffed surface w × h (metres), d deep at its fullest, with grooves along the
 *  seams (fractions of the width and height), raised bolsters at the sides, and (two-sided) a padded back too.
 *  Built flat (x across, y up, z out) with u,v from 0 to 1 over the face; the back face uses the lower half of
 *  the texture, the front the upper half. */
function seatPillow(w: number, h: number, d: number, o: { n: number; m: number; fine?: number; seamU?: number[]; seamV?: number[]; seamD?: number; bol?: number; bolW?: number; r?: number; two?: number; wing?: number }): any {
  const T = THREE, su = o.seamU || [], sv = o.seamV || [], r = o.r || 0.12, sd = o.seamD == null ? 0.006 : o.seamD;
  const fine = o.fine == null ? 3 : o.fine, U = seatSamples(o.n, su, r, fine), Vv = seatSamples(o.m, sv, r, fine);
  const round = (t: number) => { const e = Math.min(t, 1 - t) / r; return e >= 1 ? 1 : Math.sqrt(Math.max(0, 1 - (1 - e) * (1 - e))); };
  const groove = (t: number, s: number[], len: number) => { let g = 0; for (const m of s) { const x = (t - m) * len / 0.0055; g = Math.max(g, Math.exp(-x * x)); } return g; };
  const height = (u: number, v: number, back: boolean) => {
    const edge = round(u) * round(v), crown = 0.82 + 0.18 * Math.sin(Math.PI * u) * Math.sin(Math.PI * v);
    let z = d * edge * crown;
    if (!back) {
      const bu = Math.abs(2 * u - 1), bw = o.bolW || 0.16;
      if (o.bol) z += o.bol * edge * Math.pow(Math.max(0, Math.min(1, (bu - (1 - 2 * bw)) / (2 * bw * 0.6))), 1.4) * (1 - 0.6 * Math.pow(Math.max(0, bu - 0.92) / 0.08, 2));
      if (o.wing) z += o.wing * edge * Math.pow(bu, 4);
      z -= sd * edge * Math.max(groove(u, su, w), groove(v, sv, h));
    }
    return Math.max(0, z);
  };
  const faces = o.two ? 2 : 1, nu = U.length, nv = Vv.length;
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let f = 0; f < faces; f++) {
    const back = f === 1, base = pos.length / 3;
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const u = U[i], v = Vv[j], z = height(u, v, back) * (back ? (o.two || 1) : 1);
      pos.push((u - 0.5) * w * (back ? -1 : 1), v * h, back ? -z : z);
      uv.push(back ? 1 - u : u, faces === 2 ? (back ? v * 0.5 : 0.5 + v * 0.5) : v);
    }
    for (let j = 0; j < nv - 1; j++) for (let i = 0; i < nu - 1; i++) {
      const a = base + j * nu + i, b = a + 1, c = a + nu, e = c + 1;
      idx.push(a, b, e, a, e, c);
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Turn a flat-built part into place: its u axis across the seat, v up its face, its face looking along n. */
function seatPlace(g: any, at: number[], vDir: number[], nDir: number[]): any {
  const T = THREE, v = new T.Vector3(vDir[0], vDir[1], vDir[2]).normalize(), n = new T.Vector3(nDir[0], nDir[1], nDir[2]).normalize();
  const u = new T.Vector3().crossVectors(v, n).normalize();
  g.applyMatrix4(new T.Matrix4().makeBasis(u, v, n).setPosition(at[0], at[1], at[2]));
  return g;
}

/** Upholstery: fine pebbled leather, the seams as dark creases with a row of stitches either side, and a
 *  little shadow where the padding is pressed in. Returns the colour texture and a matching normal map.
 *  paint(u,v) may colour areas (the headrest's light centre panel); otherwise white, tinted by the seat colour. */
function seatUpholstery(key: string, W: number, H: number, seamU: number[], seamV: number[], wM: number, hM: number, paint?: (u: number, v: number) => number[], half?: 'top' | 'bottom', back?: any): { map: any; nrm: any } {
  if (SeatParts['tex' + key]) return SeatParts['tex' + key];
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'), img = g.createImageData(W, H), d = img.data, ht = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    let v = 1 - y / (H - 1), u = x / (W - 1), onBack = false;
    if (half) { if (v < 0.5) { onBack = true; v = v * 2; } else v = (v - 0.5) * 2; }
    const grain = cabinNoise(x / 2.6, y / 2.6, Math.round(W / 2.6), 9), grain2 = cabinNoise(x / 11, y / 11, Math.round(W / 11), 10);
    let hgt = 0.35 * grain + 0.15 * grain2, k = 0.9 + 0.08 * grain + 0.05 * grain2, col = [1, 1, 1];
    if (onBack && back) { const c = back(u, v); col = c; hgt = 0.2 * grain; }
    else {
      if (paint) col = paint(u, v);
      // seams: distance to the nearest seam in metres; a crease, stitches 4 mm either side
      let dm = 1e9, along = 0;
      for (const m of seamU) { const dd = Math.abs(u - m) * wM; if (dd < dm) { dm = dd; along = v * hM; } }
      for (const m of seamV) { const dd = Math.abs(v - m) * hM; if (dd < dm) { dm = dd; along = u * wM; } }
      if (dm < 0.012) {
        const crease = Math.exp(-Math.pow(dm / 0.0011, 2)), shade = Math.exp(-Math.pow(dm / 0.006, 2));
        const st = Math.abs(dm - 0.0042) < 0.00075 && (along % 0.0055) < 0.0034 ? 1 : 0;   // stitch, 5.5 mm apart
        k *= 1 - 0.45 * crease - 0.16 * shade; k *= st ? 0.78 : 1;
        hgt -= 1.6 * crease + 0.5 * shade - (st ? 0.35 : 0);
      }
      // the padding is a little darker towards its edges
      const e = Math.min(u, 1 - u, v, 1 - v); k *= 0.88 + 0.12 * Math.min(1, e / 0.08);
    }
    ht[i] = hgt;
    const o = i * 4; d[o] = Math.min(255, 255 * col[0] * k); d[o + 1] = Math.min(255, 255 * col[1] * k); d[o + 2] = Math.min(255, 255 * col[2] * k); d[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // normal map from the heights
  const nc = document.createElement('canvas'); nc.width = W; nc.height = H;
  const ng = nc.getContext('2d'), ni = ng.createImageData(W, H), nd = ni.data, s = 2.2;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const l = ht[y * W + Math.max(0, x - 1)], r = ht[y * W + Math.min(W - 1, x + 1)], t = ht[Math.max(0, y - 1) * W + x], b = ht[Math.min(H - 1, y + 1) * W + x];
    let nx = (l - r) * s, ny = (b - t) * s, nz = 1; const L = Math.hypot(nx, ny, nz); nx /= L; ny /= L; nz /= L;
    const o = (y * W + x) * 4; nd[o] = 128 + 127 * nx; nd[o + 1] = 128 + 127 * ny; nd[o + 2] = 128 + 127 * nz; nd[o + 3] = 255;
  }
  ng.putImageData(ni, 0, 0);
  const mk = (c: HTMLCanvasElement, srgb: boolean) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; return t; };
  return (SeatParts['tex' + key] = { map: mk(cv, true), nrm: mk(nc, false) });
}

/** All the seat's parts for seats Wg metres wide, made as finely as the cabin quality asks. */
function cabinSeatParts(Wg: number, st: CabinStyle): any {
  const T = THREE, q = cabinQ(), key = Wg.toFixed(3) + '|' + q + '|' + st.seat + '|' + st.head + '|' + (company().color || '');
  if (SeatParts.key === key) return SeatParts.parts;
  if (SeatParts.parts) for (const k in SeatParts.parts) { const p = SeatParts.parts[k]; if (p && p.dispose) p.dispose(); }
  const Q = (a: number[]) => a[q];
  // the seat's measures (the textures and the shapes share them)
  const bW = Wg * 0.86, bH = 0.42, bSU = [0.16, 0.84], bSV = [0.36, 0.7], sW = Wg * 0.9, sH = 0.37, sSU = [0.15, 0.85], sSV = [0.3], hW = Wg * 0.9, hH = 0.25;
  /** The upholstered parts and the handle, made as finely as quality level qq asks (fine: the extra points at the seams). */
  const geoSet = (qq: number, fine: number) => {
    const G = (a: number[]) => a[qq];
    // the back cushion: three padded panels between two side bolsters, on the seat back's sloping face
    const back = seatPlace(seatPillow(bW, bH, 0.04, { n: G([6, 14, 26, 44]), m: G([8, 18, 32, 56]), fine, seamU: bSU, seamV: bSV, bol: 0.03, bolW: 0.16, r: 0.1, seamD: 0.007 }),
      [0.158, 0.585, 0], [0.07, 0.42, 0], [-0.42, 0.07, 0]);
    // the seat cushion: the front roll and the seat, with bolsters at the sides
    const seat = seatPlace(seatPillow(sW, sH, 0.05, { n: G([6, 14, 24, 40]), m: G([5, 12, 20, 34]), fine, seamU: sSU, seamV: sSV, bol: 0.018, bolW: 0.15, r: 0.14, seamD: 0.008 }),
      [-0.245, 0.535, 0], [1, 0, 0], [0, 1, 0]);
    // the headrest: padded both sides, wings at the sides of its front, on top of the back
    const head = seatPlace(seatPillow(hW, hH, 0.055, { n: G([6, 12, 22, 36]), m: G([4, 8, 14, 24]), fine, seamU: [0.24, 0.76], seamV: [], two: 1, wing: 0.03, r: 0.2, seamD: 0.005 }),
      [0.228, 1.02, 0], [0.06, 1, 0], [-1, 0.06, 0]);
    // the grab handle along the top of the back
    const hc = new T.CatmullRomCurve3([new T.Vector3(0.3, 1.2, -Wg * 0.3), new T.Vector3(0.315, 1.29, -Wg * 0.24), new T.Vector3(0.318, 1.305, 0), new T.Vector3(0.315, 1.29, Wg * 0.24), new T.Vector3(0.3, 1.2, Wg * 0.3)]);
    const handle = new T.TubeGeometry(hc, G([6, 16, 28, 44]), 0.011, G([4, 8, 10, 14]), false);
    for (const g of [back, seat, head, handle]) g.computeBoundingSphere();
    return { back, seat, head, handle };
  };
  const hi = geoSet(q, q), lo = q === 0 ? hi : geoSet(0, 0);
  // the armrest: a moulded arm running back from a rounded nose, curving down to the seat front, with a padded top
  const as = new T.Shape();
  as.moveTo(0.19, 0.745); as.lineTo(-0.18, 0.745); as.quadraticCurveTo(-0.265, 0.745, -0.268, 0.69);
  as.bezierCurveTo(-0.27, 0.6, -0.235, 0.47, -0.17, 0.4); as.lineTo(-0.125, 0.405); as.bezierCurveTo(-0.175, 0.47, -0.205, 0.58, -0.2, 0.655);
  as.quadraticCurveTo(-0.198, 0.672, -0.17, 0.675); as.lineTo(0.19, 0.69); as.quadraticCurveTo(0.21, 0.715, 0.19, 0.745);
  const arm = new T.ExtrudeGeometry(as, { depth: 0.042, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.007, bevelSegments: Q([1, 2, 2, 5]), curveSegments: Q([4, 8, 12, 28]) });
  arm.translate(0, 0, -0.021); arm.computeVertexNormals();
  const pad = seatPlace(seatPillow(0.05, 0.34, 0.016, { n: Q([3, 6, 8, 12]), m: Q([6, 10, 14, 32]), fine: q, r: 0.3 }), [-0.17, 0.744, 0], [1, 0, 0], [0, 1, 0]);
  // textures: the upholstery (white, tinted by each seat's colour) and the headrest, two-tone in front (the light
  // centre panel) with the airline's own cloth on the back
  const seatC = new T.Color(st.seat), headC = new T.Color(st.head);
  const up = seatUpholstery('back' + q, Q([256, 512, 512, 1024]), Q([256, 512, 512, 1024]), bSU, bSV, bW, bH);
  const sp = seatUpholstery('seat' + q, Q([256, 512, 512, 1024]), Q([256, 512, 512, 1024]), sSU, sSV, sW, sH);
  const cover = cabinCoverTex(company().color || '#C8102E'), cimg = cover && cover.image;
  let cdat: Uint8ClampedArray = null, cw = 0, ch = 0;
  try { if (cimg) { cw = cimg.width; ch = cimg.height; const c2 = document.createElement('canvas'); c2.width = cw; c2.height = ch; const x2 = c2.getContext('2d'); x2.drawImage(cimg, 0, 0); cdat = x2.getImageData(0, 0, cw, ch).data; } } catch (e) { cdat = null; }
  const lin = (c: any) => [Math.pow(c.r, 1 / 2.2), Math.pow(c.g, 1 / 2.2), Math.pow(c.b, 1 / 2.2)];
  const SC = lin(seatC), HC = lin(headC);   // the seat's colours as the texture stores them
  const hd = seatUpholstery('head' + q + st.seat + st.head + (company().color || ''), Q([256, 512, 512, 1024]), Q([256, 512, 512, 1024]), [0.24, 0.76], [], hW, hH,
    (u) => (u > 0.24 && u < 0.76 ? HC : SC), 'top',
    (u, v) => { if (!cdat) return SC; const px = Math.floor(u * (cw - 1)), py = Math.floor((1 - v) * (ch - 1)), o = (py * cw + px) * 4; return [cdat[o] / 255, cdat[o + 1] / 255, cdat[o + 2] / 255]; });
  const ns = Q([0.6, 0.8, 1, 1.1]);
  const mk = (t: any, side?: number) => seatFadeMat(cabinMat(0xFFFFFF, { map: t.map, normalMap: t.nrm, normalScale: new T.Vector2(ns, ns), side: side == null ? T.FrontSide : side }));
  const plastic = cabinMat(0xFFFFFF, { map: cabinSatinTex() });
  const parts = {
    hi, lo, arm, pad,
    backM: mk(up, T.DoubleSide), seatM: mk(sp, T.DoubleSide), headM: mk(hd, T.DoubleSide), armM: plastic,
    padM: cabinMat(0x2A2D33, { map: cabinLeatherTex() }), handleM: seatFadeMat(cabinMat(0x24272C, { map: cabinSatinTex() })),
    dispose() { /* shapes are shared and kept until the quality changes */ },
  };
  SeatParts.key = key; SeatParts.parts = parts;
  return parts;
}

/** A seat material that can fade each seat in and out (dithered, so it needs no sorting): reads the seat's own
 *  fade from the aFade attribute of the shape it draws. */
function seatFadeMat(m: any): any {
  m.alphaHash = true;
  const ob = m.onBeforeCompile; m.onBeforeCompile = (sh: any, r: any) => { ob(sh, r);
    sh.vertexShader = 'attribute float aFade;\nvarying float vFade;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vFade = aFade;');
    sh.fragmentShader = 'varying float vFade;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.a *= vFade;'); };
  m.customProgramCacheKey = () => 'cabin-seat';
  return m;
}
/** Seats of one detail drawn n at a time: the shape shared, each seat with its own place, colour and fade. */
function seatMesh(geo: any, mat: any, n: number): any {
  const T = THREE, g = new T.BufferGeometry();
  for (const k in geo.attributes) g.setAttribute(k, geo.attributes[k]);
  g.setIndex(geo.index); g.boundingSphere = geo.boundingSphere;
  const fa = new T.InstancedBufferAttribute(new Float32Array(Math.max(1, n)).fill(1), 1); fa.setUsage(T.DynamicDrawUsage); g.setAttribute('aFade', fa);
  const m = new T.InstancedMesh(g, mat, Math.max(1, n)); m.count = 0; return m;
}
