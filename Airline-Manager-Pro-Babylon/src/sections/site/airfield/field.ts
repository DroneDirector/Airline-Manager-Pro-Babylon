// @ts-nocheck
// The airfield drawn from its plan (the architect sheets' own drawing): the pavement (for the ground's mask) and every
// painted marking (recorded as geometry for the markings mesh), at their true places.
import { AIRFIELD, TERMINAL } from './plan';
const AF = AIRFIELD, TL = TERMINAL, C = AF.CODE, Y = AF.ys, R = AF.runway;
  const ink = '#F2F7FF', dim = '#CFE0F2', cy = '#8FDcFF', gold = '#FFD34D', red = '#FF4A3D', grassC = '#1E2D22', paveC = '#3A3F46', shC = '#4E545C', concC = '#6B6F73';
  let W = 0, H = 0;
  const label = (x, t, px, py, col, fs, align) => { x.fillStyle = col || ink; x.font = `800 ${fs || 48}px Inter, Arial`; x.textAlign = align || 'center'; x.fillText(t, px, py); x.textAlign = 'left'; };
  // aircraft seen from above, nose at (0,0) pointing along +v; u across the span (-0.5..0.5), v along the length (0..1)
  const SHAPE = [[0, 0], [.03, .03], [.045, .1], [.05, .36], [.5, .56], [.5, .6], [.05, .52], [.045, .82], [.2, .93], [.2, .97], [.02, .96], [0, 1]];
  const plane = (x, P, cx, nose, dir, span, len, fill, stroke, lw) => { x.beginPath(); const pts = SHAPE.concat(SHAPE.slice().reverse().map(([u, v]) => [-u, v]));
    pts.forEach(([u, v], i) => { const q = P(cx + u * span, nose - dir * v * len); i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1]); }); x.closePath(); x.fillStyle = fill; x.fill(); x.strokeStyle = stroke; x.lineWidth = lw || 2; x.stroke(); };

  // ---- the whole airfield in plan ----
  const RT = (x, ...a) => x.__rec ? x.fillText(...a) : CanvasRenderingContext2D.prototype.fillText.call(x, ...a);
export const field = (x, P, s, o) => {
    const line = (pts, col, wpx, dash) => { x.strokeStyle = col; x.lineWidth = wpx; x.setLineDash(dash || []); x.beginPath(); pts.forEach((p, i) => { const q = P(p[0], p[1]); i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1]); }); x.stroke(); x.setLineDash([]); };
    const rect = (x0, y0, x1, y1, col) => { const a = P(x0, y1), b = P(x1, y0); x.fillStyle = col; x.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]); };
    const arc = (cx, cyy, r, a0, a1) => { const pts = []; for (let i = 0; i <= 16; i++) { const a = a0 + (a1 - a0) * i / 16; pts.push([cx + Math.cos(a) * r, cyy + Math.sin(a) * r]); } return pts; };
    x.lineCap = 'butt'; x.lineJoin = 'round'; const K = (c) => o.pal ? (o.pal[c] || '#000000') : c === 'RWY' || c === 'TAP' ? paveC : c === 'STOP' ? '#4A4F55' : c, PV = !o.marks;
    // aprons (concrete)
    // the terminal apron is asphalt (as the taxiways), the cargo apron concrete
    if (PV) { rect(-150, TL.PN, 382, Y.TY + 28, K('TAP')); rect(252, 54, 352, TL.PN + 1, K('TAP')); rect(176, Y.KY - 26, 644, AF.cargoBuilding.y0, K(concC)); }
    // junctions: every link's two ends, with the half-widths of the pavement it meets
    const RE = R.w / 2 + R.sh, RF = 28;
    const JN = []; for (const t of AF.taxiways.filter(q => q.kind === 'link')) { const [a, b] = t.pts; for (const [e, o] of [[a, b], [b, a]]) { if (t.corner && e === a) continue; const onR = e[1] === R.y, onLane = e[1] === Y.TY || e[1] === Y.KY;
      JN.push({ t, rt: t.rt || 45, x: e[0], y: e[1], oy: Math.sign(o[1] - e[1]), hm: onR ? R.w / 2 : C.twyWidth / 2, sm: onR ? RE : onLane ? C.twyWidth / 2 : C.twyWidth / 2 + C.twyShoulder, onR, onLane }); } }
    const goesOn = (j, sx) => { const ext = j.onR ? [R.x0, R.x1] : (() => { const m = AF.taxiways.find(q => q.kind !== 'link' && q.pts[0][1] === j.y); return m ? [m.pts[0][0], m.pts[1][0]] : [-1e9, 1e9]; })(); return sx < 0 ? j.x - ext[0] > 30 : ext[1] - j.x > 30; };
    // a fillet: the inside of the turn, between the link's edge (he from its centre line), the main pavement's edge (hm)
    // and the arc round the centre line curve's own centre (radius rt) at rt - he: tangent to both edges
    const fillet = (j, he, hm) => { const pts = []; for (const sx of [-1, 1]) { if (!goesOn(j, sx)) continue; const cx = j.x + sx * j.rt, cyy = j.y + j.oy * j.rt, r = j.rt - he;
      const a0 = Math.atan2(0, -sx); let a1 = Math.atan2(-j.oy, 0); if (a1 - a0 > Math.PI) a1 -= 2 * Math.PI; if (a1 - a0 < -Math.PI) a1 += 2 * Math.PI;
      const arcP = []; for (let i = 0; i <= 48; i++) { const a = a0 + (a1 - a0) * i / 48; arcP.push([cx + Math.cos(a) * r, cyy + Math.sin(a) * r]); }
      const poly = [[j.x + sx * he, j.y + j.oy * hm]]; for (let i = 0; i < arcP.length; i++) { const p = arcP[i], d = j.oy * (p[1] - j.y); if (d >= hm) poly.push(p); else { const q = arcP[i - 1]; if (q) { const dq = j.oy * (q[1] - j.y), f = (dq - hm) / (dq - d); poly.push([q[0] + (p[0] - q[0]) * f, j.y + j.oy * hm]); } break; } }
      pts.push(poly); } return pts; };
    const fillPoly = (poly, col) => { x.beginPath(); poly.forEach((p, i) => { const q = P(p[0], p[1]); i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1]); }); x.closePath(); x.fillStyle = col; x.fill(); };
    // the curved corners: a ring sector round the curve's centre, from the end of A/B to the start of the link
    const cornerArc = (k, r) => { const cx = k.x + k.sx * k.r, cyy = k.y + k.oy * k.r, a1 = Math.atan2(-k.oy, 0); let a2 = Math.atan2(0, -k.sx); if (a2 - a1 > Math.PI) a2 -= 2 * Math.PI; if (a2 - a1 < -Math.PI) a2 += 2 * Math.PI; const pts = []; for (let i = 0; i <= 40; i++) { const a = a1 + (a2 - a1) * i / 40; pts.push([cx + Math.cos(a) * r, cyy + Math.sin(a) * r]); } return pts; };
    const ring = (k, r0, r1, col) => fillPoly(cornerArc(k, r1).concat(cornerArc(k, r0).reverse()), col);
    const linkPts = (t) => t.pts.map(p => p[1] === R.y ? [p[0], R.y + Math.sign(t.pts[0][1] - R.y || t.pts[1][1] - R.y) * R.w / 2 * 0 + (p === t.pts[0] ? 0 : 0) + 0] : p);
    // shoulders (taxiways, their fillets), the runway's shoulders and stopways
    const apronCut = (t) => t.id[0] === 'P' ? [[t.pts[0][0], Y.TY + 28], t.pts[1]] : t.id[0] === 'Q' ? [[t.pts[0][0], Y.KY - 26], t.pts[1]] : t.pts;
    if (PV) { x.lineCap = 'butt'; for (const t of AF.taxiways) if (t.sh) line(apronCut(t), K(shC), (t.w + 2 * t.sh) * s); x.lineCap = 'butt';
    for (const j of JN) if (!j.onLane) for (const poly of fillet(j, C.twyWidth / 2 + C.twyShoulder, j.sm)) fillPoly(poly, K(shC));
    for (const k of AF.corners || []) ring(k, k.r - k.w / 2 - k.sh, k.r + k.w / 2 + k.sh, K(shC));
    rect(R.x0, R.y - RE, R.x1, R.y + RE, K(shC)); rect(R.x0 - R.stopway, R.y - R.w / 2, R.x0, R.y + R.w / 2, K('STOP')); rect(R.x1, R.y - R.w / 2, R.x1 + R.stopway, R.y + R.w / 2, K('STOP'));
    // pavement, fillets, then the runway's pavement over the links
    x.lineCap = 'butt'; for (const t of AF.taxiways) if (t.kind !== 'taxilane') line(apronCut(t), K(paveC), t.w * s); x.lineCap = 'butt';
    for (const j of JN) if (!j.onLane) for (const poly of fillet(j, C.twyWidth / 2, j.hm)) fillPoly(poly, K(paveC));
    for (const k of AF.corners || []) ring(k, k.r - k.w / 2, k.r + k.w / 2, K(paveC));
    rect(R.x0, R.y - R.w / 2, R.x1, R.y + R.w / 2, K('RWY')); }
    if (o.maskOnly) return;
    // runway markings
    { const hw = R.w / 2;   // at every scale, in their true places
      const W8 = '#F4F4F2', tri = (pts) => { x.beginPath(); pts.forEach((p, k) => { const q = P(p[0], p[1]); k ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1]); }); x.closePath(); x.fillStyle = W8; x.fill(); };
      for (const e of R.ends) { const d = e.dir, dp = e.disp || 0, xt = e.x + d * dp, x0 = xt + d * 6;
        // the displaced part: arrows along the centre line pointing to the landing threshold, arrowheads across the
        // runway in front of it, and the white transverse bar across the threshold itself
        if (dp) { for (let xa = e.x + d * 25; d * (xt - d * 60 - xa) >= 0; xa += d * 50) { rect(Math.min(xa, xa + d * 24), R.y - 0.45, Math.max(xa, xa + d * 24), R.y + 0.45, W8); tri([[xa + d * 24, R.y - 1.8], [xa + d * 32, R.y], [xa + d * 24, R.y + 1.8]]); }
          for (const yo of [-22.5, -7.5, 7.5, 22.5]) { const xa = xt - d * 18; tri([[xa, R.y + yo - 2.25], [xa + d * 8, R.y + yo], [xa, R.y + yo + 2.25]]); rect(Math.min(xa - d * 6, xa), R.y + yo - 0.45, Math.max(xa - d * 6, xa), R.y + yo + 0.45, W8); }
          rect(Math.min(xt - d * 1.8, xt), R.y - hw + 0.9, Math.max(xt - d * 1.8, xt), R.y + hw - 0.9, W8); }
        for (let i = 0; i < 8; i++) for (const sg of [-1, 1]) { const yy = R.y + sg * (1.5 + 1.8 / 2 + i * 3.6); rect(Math.min(x0, x0 + d * 30), yy - 0.9, Math.max(x0, x0 + d * 30), yy + 0.9, W8); }
        // designator: big numbers, read from the approach
        x.save(); const q = P(xt + d * 52, R.y); x.translate(q[0], q[1]); x.rotate(d > 0 ? Math.PI / 2 : -Math.PI / 2); x.fillStyle = W8; x.font = `900 ${Math.round(9 * s * 1.25)}px Inter, Arial`; x.textAlign = 'center'; RT(x, e.id, 0, 4.5 * s); x.restore();
        // aiming point (400 m) and touchdown zone (150-1,050 m), from the landing threshold
        for (const sg of [-1, 1]) { const yy = R.y + sg * (11.25 + 5); rect(Math.min(xt + d * 400, xt + d * 460), yy - 5, Math.max(xt + d * 400, xt + d * 460), yy + 5, W8); }
        for (const [dist, n] of [[150, 3], [300, 3], [600, 2], [750, 2], [900, 1], [1050, 1]]) for (const sg of [-1, 1]) for (let k = 0; k < n; k++) { const yy = R.y + sg * (11.25 + 0.9 + k * 3.3); rect(Math.min(xt + d * dist, xt + d * (dist + 22.5)), yy - 0.9, Math.max(xt + d * dist, xt + d * (dist + 22.5)), yy + 0.9, W8); }
        // stopway chevrons (yellow) before the runway's physical end
        for (let k = 0; k < 3; k++) { const xa = e.x - d * (12 + k * 18); line([[xa - d * 15, R.y - hw + 2], [xa, R.y], [xa - d * 15, R.y + hw - 2]], gold, 0.9 * s); } }
      const c0 = R.x0 + (R.ends[0].disp || 0) + 70, c1 = R.x1 - (R.ends[1].disp || 0) - 70; for (let xx = c0; xx < c1 - 30; xx += 50) rect(xx, R.y - 0.45, xx + 30, R.y + 0.45, W8);
      for (const sg of [-1, 1]) rect(R.x0, R.y + sg * (hw - 0.9) - 0.45, R.x1, R.y + sg * (hw - 0.9) + 0.45, W8);
    }
    // taxiway edge marking (double yellow) and centre lines with the turn curves
    const cw = Math.max(2.5, 0.3 * s), yl = gold;
    if (s >= 3) { const ew = Math.max(1.2, 0.15 * s);
      for (const t of AF.taxiways.filter(q => q.kind !== 'taxilane')) { const [a, b] = t.pts, hz = a[1] === b[1];
        for (const sg of [-1, 1]) for (const k of [0, 0.3]) { const off = sg * (t.w / 2 - 0.15 - k);
          if (hz) { // a parallel taxiway: broken where a link joins on this side
            const gaps = JN.filter(j => j.y === a[1] && j.oy === sg).map(j => [j.x - j.rt, j.x + j.rt]).sort((p, q) => p[0] - q[0]); let x0 = a[0];
            for (const g of gaps.concat([[b[0], b[0]]])) { if (g[0] > x0) line([[x0, a[1] + off], [Math.min(g[0], b[0]), a[1] + off]], gold, ew); x0 = Math.max(x0, g[1]); } }
          else { const ends = JN.filter(j => j.t === t), e0 = t.corner ? null : ends[0], e1 = ends[ends.length - 1], dy = Math.sign(b[1] - a[1]);
            const y0 = t.corner ? a[1] : a[1] + dy * (goesOn(e0, sg) ? e0.rt : e0.hm), y1 = b[1] - dy * (goesOn(e1, sg) ? e1.rt : e1.onR ? RE : e1.hm); line([[a[0] + off, y0], [a[0] + off, y1]], gold, ew); } } }
      for (const k of AF.corners || []) for (const sg of [-1, 1]) for (const d of [0.15, 0.45]) line(cornerArc(k, k.r + sg * (k.w / 2 - d)), gold, ew);
      for (const j of JN) if (!j.onR && !j.onLane) for (const k of [0.15, 0.45]) for (const poly of fillet(j, C.twyWidth / 2 - k, j.hm - k)) line(poly.slice(1), gold, ew); }
    for (const t of AF.taxiways) line(t.pts, yl, cw); for (const k of AF.corners || []) line(cornerArc(k, k.r), yl, cw);
    for (const t of AF.taxiways.filter(q => q.kind === 'link')) { const RT = t.rt || 45; const [a, b] = t.pts; for (const [jx, jy, oy] of (t.corner ? [] : [[a[0], a[1], Math.sign(b[1] - a[1])]]).concat([[b[0], b[1], Math.sign(a[1] - b[1])]])) for (const sx of [-1, 1]) { const jj = JN.find(q => q.t === t && q.x === jx && q.y === jy); if (jj && !goesOn(jj, sx)) continue; const a0 = Math.atan2(0, -sx); let a1 = Math.atan2(-oy, 0); if (a1 - a0 > Math.PI) a1 -= 2 * Math.PI; if (a1 - a0 < -Math.PI) a1 += 2 * Math.PI; line(arc(jx + sx * RT, jy + oy * RT, RT, a0, a1), yl, cw); } }
    // holding positions: pattern A (two solid lines on the taxiway side, two dashed on the runway side)
    for (const h of AF.holds) { const hw = C.twyWidth / 2 + 1; [0.075, 0.375, 0.675, 0.975].forEach((o2, k) => { const yy = h.y - h.side * o2; line([[h.x - hw, yy], [h.x + hw, yy]], yl, Math.max(s >= 3 ? 0.15 * s : 6, 2), k < 2 ? [] : [0.9 * s, 0.9 * s]); });
      if (s < 3) { const p = P(h.x, h.y); x.fillStyle = red; x.fillRect(p[0] - C.twyWidth * s, p[1] - 6, 2 * C.twyWidth * s, 12); } }
    // the jetway's ground markings (as at real apron-drive bridges): the red operating area the drive wheels move in
    // (an annular sector round the rotunda towards the aircraft's front door, hatched), the rotunda's keep-clear circle,
    // the wheels' parking box (PBB) where the bridge rests retracted; then the bridge itself in outline
    const pbb = (j, st) => { const [rx, ry] = j.rotunda, door = [st.x + 2.4, st.nose + 5.5], th = Math.atan2(door[1] - ry, door[0] - rx), reach = Math.hypot(door[0] - rx, door[1] - ry);
      const r0 = 2.6, r1 = 0.62 * reach + 1.8, a0 = th - 0.75, a1 = th + 0.75, sec = []; for (let i = 0; i <= 24; i++) { const a = a0 + (a1 - a0) * i / 24; sec.push([rx + Math.cos(a) * r1, ry + Math.sin(a) * r1]); } for (let i = 24; i >= 0; i--) { const a = a0 + (a1 - a0) * i / 24; sec.push([rx + Math.cos(a) * r0, ry + Math.sin(a) * r0]); }
      x.save(); x.beginPath(); sec.forEach((p, i) => { const q = P(p[0], p[1]); i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1]); }); x.closePath(); x.fillStyle = 'rgba(255,74,61,.18)'; x.fill(); x.clip();
      x.strokeStyle = 'rgba(255,74,61,.85)'; x.lineWidth = Math.max(1, 0.15 * s); for (let k = -30; k <= 30; k += 1.5) { const p = P(rx + k, ry - 20), q = P(rx + k + 20, ry + 20); x.beginPath(); x.moveTo(p[0], p[1]); x.lineTo(q[0], q[1]); x.stroke(); } x.restore();
      line(sec.concat([sec[0]]), red, Math.max(2, 0.2 * s));
      { const p = P(rx, ry); x.beginPath(); x.arc(p[0], p[1], 2.2 * s, 0, 7); x.strokeStyle = red; x.lineWidth = Math.max(2, 0.2 * s); x.stroke(); x.fillStyle = 'rgba(255,255,255,.25)'; x.fill(); }
      { const bx = rx + Math.cos(th) * reach * 0.62, by = ry + Math.sin(th) * reach * 0.62; x.save(); const p = P(bx, by); x.translate(p[0], p[1]); x.rotate(-th); x.strokeStyle = gold; x.lineWidth = Math.max(2, 0.18 * s); x.strokeRect(-1.4 * s, -0.9 * s, 2.8 * s, 1.8 * s); if (s >= 6) { x.fillStyle = gold; x.font = `800 ${Math.round(0.9 * s)}px Inter, Arial`; x.textAlign = 'center'; RT(x, 'PBB', 0, 0.32 * s); x.textAlign = 'left'; } x.restore(); }
      if (o.marks) return;
      // the bridge seen from above: fixed tunnel, rotunda, moving tunnel to the door, its cab
      const fx = [[j.x - 1.3, j.y], [j.x + 1.3, j.y], [j.x + 1.3, ry], [j.x - 1.3, ry]]; x.fillStyle = 'rgba(210,216,224,.55)'; x.strokeStyle = '#E6ECF2'; x.lineWidth = Math.max(1.5, 0.1 * s);
      x.beginPath(); fx.forEach((p, i) => { const q = P(p[0], p[1]); i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1]); }); x.closePath(); x.fill(); x.stroke();
      const t0 = [rx, ry + 1.4], ux = (door[0] - t0[0]), uy = (door[1] - t0[1]), L = Math.hypot(ux, uy), nx = -uy / L * 1.2, ny = ux / L * 1.2;
      x.beginPath(); [[t0[0] + nx, t0[1] + ny], [door[0] + nx, door[1] + ny], [door[0] - nx, door[1] - ny], [t0[0] - nx, t0[1] - ny]].forEach((p, i) => { const q = P(p[0], p[1]); i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1]); }); x.closePath(); x.fill(); x.stroke();
      { const p = P(rx, ry); x.beginPath(); x.arc(p[0], p[1], 1.8 * s, 0, 7); x.fill(); x.stroke(); } };
    // a walk-out stand: the painted passenger walkway (white zebra) from the gate's east door to the aircraft's front door
    const walkway = (st) => { const g = TL.doors.find(q => q.id === 'D-F1-GATE-' + st.id.replace('STAND-', '') + '-2'); if (!g) return; const door = [st.x + 2.4, st.nose + 5.5], wy = door[1];
      const zebra = (x0, y0, x1, y1) => { const hz = Math.abs(y1 - y0) < 0.01, len = hz ? Math.abs(x1 - x0) : Math.abs(y1 - y0); for (let k = 0.3; k < len - 0.3; k += 1.0) { if (hz) { const xa = Math.min(x0, x1) + k; rect(xa, y0 - 1.5, xa + 0.5, y0 + 1.5, '#F4F4F4'); } else { const ya = Math.min(y0, y1) + k; rect(x0 - 1.5, ya, x0 + 1.5, ya + 0.5, '#F4F4F4'); } } line([[x0 + (hz ? 0 : -1.6), y0 + (hz ? -1.6 : 0)], [x1 + (hz ? 0 : -1.6), y1 + (hz ? -1.6 : 0)]], '#F4F4F4', Math.max(1, 0.1 * s)); line([[x0 + (hz ? 0 : 1.6), y0 + (hz ? 1.6 : 0)], [x1 + (hz ? 0 : 1.6), y1 + (hz ? 1.6 : 0)]], '#F4F4F4', Math.max(1, 0.1 * s)); };
      zebra(g.x, TL.PN + 0.3, g.x, wy - 1.6); zebra(g.x + 1.6, wy, door[0] + 0.6, wy); };
    // aircraft stands: lead-in lines, stop bars, safety lines, numbers, aircraft, jetways
    for (const st of AF.stands) { const d = st.dir, tailY = st.nose - d * st.len, ty = st.cargo ? Y.KY : Y.TY, rr = st.code === 'F' ? 50 : 35;
      // lead-in: from the taxilane, a curve round into the stand's centre line, straight to the stop bar
            line(arc(st.x - rr, ty + (st.cargo ? rr : -rr), rr, st.cargo ? -Math.PI / 2 : Math.PI / 2, 0).concat([[st.x, st.nose - d * 4]]), yl, Math.max(2.5, 0.2 * s));
      const stopY = st.nose - d * 5; line([[st.x - 2, stopY], [st.x + 2, stopY]], yl, Math.max(3, 0.6 * s));
      // red stand safety line: the envelope of the largest aircraft plus half the wingtip clearance
      const half = st.span / 2 + C.wingtip[st.code] / 2; x.strokeStyle = red; x.lineWidth = Math.max(2, 0.2 * s); x.setLineDash([]); const yN = st.cargo ? st.nose : TL.PN + 0.6; const a = P(st.x - half, Math.max(yN, tailY - d * 3)), b = P(st.x + half, Math.min(yN, tailY - d * 3)); x.strokeRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
      if (o.planes) plane(x, P, st.x, st.nose, d, st.code === 'F' ? 79.8 : 35.8, st.code === 'F' ? (st.cargo ? 76.3 : 72.7) : 44.5, 'rgba(225,235,250,.42)', '#EAF2FF', Math.max(1.5, 0.12 * s));
      // the stand number painted beside the lead-in line (not on it)
      if (s >= 3) { const q = P(st.x - (st.code === 'F' ? 10 : 7), st.cargo ? Y.KY + 30 : 180); const num = st.id.replace('STAND-', ''); x.save(); x.translate(q[0], q[1]); x.fillStyle = '#0D0D0D'; const bw = (num.length > 1 ? 6.4 : 4) * s, bh = 5 * s; x.fillRect(-bw / 2, -bh / 2, bw, bh); x.fillStyle = gold; x.font = `900 ${Math.round(4 * s)}px Inter, Arial`; x.textAlign = 'center'; RT(x, num, 0, 1.45 * s); x.restore(); x.textAlign = 'left'; }
      if (st.jetway) { const j = TL.jetways.find(q => q.id === st.jetway); if (j) pbb(j, st); }
      if (!st.cargo && !st.jetway && st.code === 'C') walkway(st);
      if (o.standLabels) label(x, st.id.replace('STAND-', 'S') , P(st.x, tailY + d * -8)[0], P(st.x, tailY - d * 12)[1], ink, o.standLabels); }
    // apron service road (white) behind the stands' tails, through to the cargo side nothing
    if (s >= 3) { for (const yy of [160, 168]) line([[-148, yy], [380, yy]], '#F4F4F4', Math.max(1.5, 0.15 * s)); line([[-148, 164], [380, 164]], '#F4F4F4', Math.max(1.2, 0.12 * s), [3 * s, 3 * s]); }
    if (o.marks) return;
    // the terminal (from TERMINAL): blocks, pier, museum, roof
    const blk = (x0, y0, x1, y1) => { const a = P(x0, y1), b = P(x1, y0); x.fillStyle = '#25384F'; x.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]); x.strokeStyle = '#9FD8FF'; x.lineWidth = Math.max(2, 0.25 * s); x.strokeRect(a[0], a[1], b[0] - a[0], b[1] - a[1]); };
    for (const b of [[0, 0, 36, 52], [36, 30, 156, 52], [114, 0, 156, 30], [36, 0, 114, 30], [TL.pier[0], 52, TL.pier[1], TL.PN]]) blk(...b);
    { const rc = TL.rental; for (const b of [rc.hall, rc.garage, rc.walk]) blk(...b); }
    { const r = TL.roof; x.beginPath(); for (let i = 0; i <= 50; i++) { const xx = r.x0 + (r.x1 - r.x0) * i / 50, q = P(xx, r.y0(xx)); i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1]); } const q1 = P(r.x1, r.y1), q2 = P(r.x0, r.y1); x.lineTo(q1[0], q1[1]); x.lineTo(q2[0], q2[1]); x.closePath(); x.fillStyle = 'rgba(232,199,122,.55)'; x.fill(); x.strokeStyle = gold; x.lineWidth = Math.max(2, 0.3 * s); x.stroke(); }
    { const m = P(18, 15); x.beginPath(); x.ellipse(m[0], m[1], 16.5 * s, 13 * s, 0, 0, 7); x.fillStyle = '#7B6AA8'; x.fill(); x.strokeStyle = '#CDBEFF'; x.stroke(); }
    { const cb = AF.cargoBuilding; blk(cb.x0, cb.y0, cb.x1, cb.y1); }
    // runway guard lights and signs
    for (const h of AF.holds) for (const [gx, gy] of h.guard) { const p = P(gx, gy); x.fillStyle = '#FFC400'; x.beginPath(); x.arc(p[0], p[1], Math.max(5, 0.8 * s), 0, 7); x.fill(); }
    for (const g of AF.signs) { const p = P(g.x, g.y); const wpx = Math.max(10, (g.kind === 'mandatory' ? 4.5 : 4) * s), hpx = Math.max(8, 1.6 * s); x.fillStyle = g.kind === 'mandatory' ? red : gold; x.fillRect(p[0] - wpx / 2, p[1] - hpx / 2, wpx, hpx); x.strokeStyle = '#000'; x.lineWidth = 1.5; x.strokeRect(p[0] - wpx / 2, p[1] - hpx / 2, wpx, hpx); }
  };
