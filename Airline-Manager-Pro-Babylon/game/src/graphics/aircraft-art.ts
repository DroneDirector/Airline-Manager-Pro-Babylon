// Parametric side-view aircraft illustrations. Every aircraft type is drawn from its ArtSpec,
// so each make and model gets its own silhouette, engine layout and livery in company colours.

let _artSeq = 0;

/** The drawn side view, used where 3D drawing isn't available. */
function aircraftArtSvg(typeId: string, o?: { color?: string; color2?: string; reg?: string; w?: number; ground?: boolean }): string {
  const t = acType(typeId); if (!t) return '';
  const s = t.art; o = o || {};
  const color = o.color || '#2C8CFF', color2 = o.color2 || '#0B2A55';
  const id = 'ac' + (++_artSeq);
  const W = 420, VH = 150;
  const L = 200 + 190 * s.len;
  const H = s.h * 1.3;
  const x0 = (W - L) / 2 + (s.eng === 'prop1' ? 8 : 0), x1 = x0 + L;
  const groundY = 136;
  const gearH = s.floats ? H * 1.25 : (s.fixedGear ? H * 0.95 : H * 0.85);
  const cy = groundY - gearH - H / 2;
  const top = cy - H / 2, bot = cy + H / 2;
  const nl = { airbus: 1.35, boeing: 1.65, regional: 1.8, turboprop: 1.5, ga: 0.95 }[s.nose] * H;
  const tipY = { airbus: cy + H * 0.12, boeing: cy + H * 0.2, regional: cy + H * 0.22, turboprop: cy + H * 0.12, ga: cy + H * 0.02 }[s.nose];
  const xt = x1 - H * (s.eng === 'prop1' ? 2.2 : 2.7);
  const tailBotY = top + H * (s.eng === 'prop1' ? 0.42 : 0.36);
  const P = (n: number) => n.toFixed(1);
  const parts: string[] = [];

  const fus = `M${P(x0 + nl)},${P(top)} L${P(x1 - H * 0.3)},${P(top)} Q${P(x1)},${P(top)} ${P(x1)},${P(top + H * 0.2)} L${P(x1)},${P(tailBotY)} L${P(xt)},${P(bot)} L${P(x0 + nl * 0.85)},${P(bot)} C${P(x0 + nl * 0.25)},${P(bot)} ${P(x0)},${P(tipY + H * 0.22)} ${P(x0)},${P(tipY)} C${P(x0)},${P(top + H * 0.18)} ${P(x0 + nl * 0.4)},${P(top)} ${P(x0 + nl)},${P(top)} Z`;

  parts.push(`<defs>
    <linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".55" stop-color="#E4EAF1"/><stop offset="1" stop-color="#B9C4D1"/></linearGradient>
    <linearGradient id="${id}t" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="${color2}"/></linearGradient>
    <linearGradient id="${id}n" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#DCE3EB"/><stop offset="1" stop-color="#8E9BAA"/></linearGradient>
    <radialGradient id="${id}s" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#000" stop-opacity=".45"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
    <clipPath id="${id}c"><path d="${fus}"/></clipPath>
  </defs>`);

  // ground shadow
  if (o.ground !== false) parts.push(`<ellipse cx="${P(x0 + L * 0.5)}" cy="${P(groundY + 3)}" rx="${P(L * 0.46)}" ry="5" fill="url(#${id}s)"/>`);

  // far-side wing and engines sit behind the fuselage
  const wingX = x0 + L * (s.eng === 'prop1' ? 0.34 : 0.38);
  const wingSpan = L * (s.eng === 'prop1' || s.eng === 'prop2' ? 0.16 : 0.22);
  if (s.eng === 'wing4') parts.push(nacelle(wingX - H * 0.1, bot - H * 0.1, H * (t.cls === 'widebody' ? 1.35 : 1.1), H * 0.48, `url(#${id}n)`, 0.7));

  // horizontal stabiliser (conventional tail)
  if (s.tail === 'conv') parts.push(`<path d="M${P(x1 - H * 1.9)},${P(tailBotY - H * 0.02)} L${P(x1 - H * 0.6)},${P(tailBotY - H * 0.14)} L${P(x1 + H * 0.15)},${P(tailBotY - H * 0.12)} L${P(x1 - H * 0.25)},${P(tailBotY + H * 0.06)} Z" fill="#AEB9C6"/>`);

  // landing gear (drawn before fuselage so the body overlaps the legs)
  if (!s.floats) {
    const mainX = x0 + L * (s.eng === 'prop1' ? 0.4 : 0.5);
    const noseX = x0 + nl * (s.eng === 'prop1' ? 0.55 : 0.75);
    const wr = s.fixedGear ? H * 0.32 : H * 0.28;
    parts.push(`<g stroke="#5D6B7B" stroke-width="${P(H * 0.09)}" stroke-linecap="round">
      <line x1="${P(mainX)}" y1="${P(bot - 2)}" x2="${P(mainX + (s.fixedGear ? H * 0.35 : 0))}" y2="${P(groundY - wr)}"/>
      <line x1="${P(noseX)}" y1="${P(bot - 2)}" x2="${P(noseX)}" y2="${P(groundY - wr)}"/></g>
      <circle cx="${P(mainX + (s.fixedGear ? H * 0.35 : 0))}" cy="${P(groundY - wr)}" r="${P(wr)}" fill="#1D242D" stroke="#3B4552" stroke-width="1.2"/>
      ${t.cls === 'widebody' ? `<circle cx="${P(mainX - wr * 2.2)}" cy="${P(groundY - wr)}" r="${P(wr)}" fill="#1D242D" stroke="#3B4552" stroke-width="1.2"/>` : ''}
      <circle cx="${P(noseX)}" cy="${P(groundY - wr * 0.8)}" r="${P(wr * 0.8)}" fill="#1D242D" stroke="#3B4552" stroke-width="1.2"/>`);
  } else {
    // floats with struts
    const fx0 = x0 + nl * 0.1, fx1 = x0 + L * 0.74, fy = groundY - H * 0.42;
    parts.push(`<g stroke="#4F5B69" stroke-width="${P(H * 0.08)}" stroke-linecap="round">
      <line x1="${P(x0 + L * 0.22)}" y1="${P(bot)}" x2="${P(x0 + L * 0.2)}" y2="${P(fy)}"/>
      <line x1="${P(x0 + L * 0.45)}" y1="${P(bot)}" x2="${P(x0 + L * 0.47)}" y2="${P(fy)}"/>
      <line x1="${P(x0 + L * 0.22)}" y1="${P(bot)}" x2="${P(x0 + L * 0.47)}" y2="${P(fy)}"/></g>
      <path d="M${P(fx0)},${P(fy - H * 0.05)} Q${P(fx0 - H * 0.6)},${P(fy + H * 0.1)} ${P(fx0 + H * 0.2)},${P(fy + H * 0.38)} L${P(fx1 - H * 0.8)},${P(fy + H * 0.42)} L${P(fx1)},${P(fy + H * 0.12)} L${P(fx1)},${P(fy - H * 0.05)} Z" fill="url(#${id}n)" stroke="#6B7787" stroke-width=".8"/>
      <path d="M${P(fx0 + H * 0.2)},${P(fy + H * 0.2)} L${P(fx1 - H * 0.6)},${P(fy + H * 0.24)}" stroke="${color}" stroke-width="${P(H * 0.1)}"/>`);
  }

  // fuselage + livery (clipped to the fuselage)
  parts.push(`<path d="${fus}" fill="url(#${id}g)" stroke="#7D8A99" stroke-width=".8"/>`);
  parts.push(`<g clip-path="url(#${id}c)">
    <rect x="${P(x0 - 5)}" y="${P(cy + H * 0.16)}" width="${P(L + 10)}" height="${P(H * 0.11)}" fill="${color}"/>
    <rect x="${P(x0 - 5)}" y="${P(cy + H * 0.3)}" width="${P(L + 10)}" height="${P(H * 0.05)}" fill="${color2}" opacity=".8"/>
    <path d="M${P(xt - H * 1.2)},${P(bot + 2)} L${P(x1 + 5)},${P(top - 5)} L${P(x1 + 5)},${P(bot + 5)} Z" fill="${color2}" opacity=".9"/>
  </g>`);

  // upper deck hump
  if (s.hump) {
    const hx0 = x0 + nl * 0.55, hx1 = x0 + L * 0.38;
    parts.push(`<path d="M${P(hx0)},${P(top + H * 0.08)} C${P(hx0 + H * 0.5)},${P(top - H * 0.42)} ${P(hx0 + H * 1.3)},${P(top - H * 0.42)} ${P(hx0 + H * 2.2)},${P(top - H * 0.42)} L${P(hx1 - H * 1.4)},${P(top - H * 0.42)} C${P(hx1 - H * 0.6)},${P(top - H * 0.42)} ${P(hx1)},${P(top - H * 0.1)} ${P(hx1)},${P(top + 1)} Z" fill="url(#${id}g)" stroke="#7D8A99" stroke-width=".8"/>`);
    for (let i = 0; i < 8; i++) parts.push(`<rect x="${P(hx0 + H * 1.5 + i * H * 0.42)}" y="${P(top - H * 0.24)}" width="${P(H * 0.13)}" height="${P(H * 0.17)}" rx="${P(H * 0.05)}" fill="#24303E"/>`);
  }

  // cockpit windscreen
  const cwx = x0 + nl * (s.nose === 'ga' ? 0.75 : 0.5);
  parts.push(`<path d="M${P(cwx)},${P(top + H * 0.36)} L${P(cwx + nl * 0.18)},${P(top + H * 0.14)} L${P(cwx + nl * 0.52)},${P(top + H * 0.12)} L${P(cwx + nl * 0.5)},${P(top + H * 0.34)} Z" fill="#1A2533"/>`);

  // passenger windows and doors
  const wy = top + H * 0.3, wx0 = x0 + nl * (s.nose === 'ga' ? 1.55 : 1.45), wx1 = xt - H * 0.25;
  const ww = Math.min(H * 0.16, 4.6), wh = H * (s.nose === 'ga' ? 0.26 : 0.2);
  if (s.win > 0) {
    const step = (wx1 - wx0) / Math.max(s.win, 1);
    for (let i = 0; i < s.win; i++) {
      const wx = wx0 + i * step + step * 0.3;
      parts.push(`<rect x="${P(wx)}" y="${P(wy)}" width="${P(s.nose === 'ga' ? step * 0.65 : ww)}" height="${P(wh)}" rx="${P(Math.min(ww, wh) * 0.45)}" fill="#253242"/>`);
    }
    if (s.nose !== 'ga') {
      parts.push(`<rect x="${P(wx0 - H * 0.42)}" y="${P(top + H * 0.2)}" width="${P(H * 0.28)}" height="${P(H * 0.55)}" rx="${P(H * 0.06)}" fill="none" stroke="#8C99A8" stroke-width=".9"/>`);
      parts.push(`<rect x="${P(wx1 + H * 0.05)}" y="${P(top + H * 0.2)}" width="${P(H * 0.26)}" height="${P(H * 0.5)}" rx="${P(H * 0.06)}" fill="none" stroke="#8C99A8" stroke-width=".9"/>`);
    }
  }

  // near-side wing
  if (s.wing === 'low') {
    parts.push(`<path d="M${P(wingX - wingSpan * 0.15)},${P(bot - H * 0.18)} L${P(wingX + wingSpan)},${P(bot - H * 0.12)} L${P(wingX + wingSpan * 1.12)},${P(bot + H * 0.02)} L${P(wingX - wingSpan * 0.3)},${P(bot + H * 0.08)} Z" fill="#9EABBA" stroke="#7D8A99" stroke-width=".6"/>`);
  } else {
    const wy0 = top - H * 0.14;
    parts.push(`<path d="M${P(wingX - wingSpan * 0.55)},${P(wy0)} L${P(wingX + wingSpan * 0.85)},${P(wy0)} Q${P(wingX + wingSpan)},${P(wy0 + H * 0.16)} ${P(wingX + wingSpan * 0.85)},${P(wy0 + H * 0.24)} L${P(wingX - wingSpan * 0.55)},${P(wy0 + H * 0.24)} Q${P(wingX - wingSpan * 0.7)},${P(wy0 + H * 0.12)} ${P(wingX - wingSpan * 0.55)},${P(wy0)} Z" fill="#C3CDD8" stroke="#7D8A99" stroke-width=".6"/>`);
    if (s.strut) parts.push(`<line x1="${P(wingX + wingSpan * 0.2)}" y1="${P(wy0 + H * 0.22)}" x2="${P(wingX - wingSpan * 0.25)}" y2="${P(bot - H * 0.08)}" stroke="#7D8A99" stroke-width="${P(H * 0.08)}"/>`);
  }

  // engines
  if (s.eng === 'wing2' || s.eng === 'wing4') {
    const big = t.cls === 'widebody';
    parts.push(nacelle(wingX - H * (s.eng === 'wing4' ? 0.9 : 0.55), bot + H * 0.05, H * (big ? 1.55 : 1.3), H * (big ? 0.68 : 0.58), `url(#${id}n)`, 1));
  } else if (s.eng === 'rear2') {
    const nx = xt - H * 1.15, ny = top + H * 0.02;
    parts.push(`<path d="M${P(nx + H * 0.6)},${P(ny + H * 0.3)} L${P(nx + H * 0.9)},${P(top + H * 0.42)}" stroke="#7D8A99" stroke-width="${P(H * 0.18)}"/>`);
    parts.push(nacelle(nx, ny, H * 1.45, H * 0.52, `url(#${id}n)`, 1));
  } else if (s.eng === 'prop2') {
    const nx = wingX - wingSpan * 0.35, ny = top + H * 0.05;
    parts.push(`<path d="M${P(nx)},${P(ny)} Q${P(nx - H * 0.1)},${P(ny + H * 0.2)} ${P(nx + H * 0.15)},${P(ny + H * 0.42)} L${P(nx + H * 1.6)},${P(ny + H * 0.36)} L${P(nx + H * 1.7)},${P(top - H * 0.12)} L${P(nx + H * 0.1)},${P(top - H * 0.12)} Z" fill="url(#${id}n)" stroke="#6B7787" stroke-width=".7"/>`);
    parts.push(propDisc(nx - H * 0.12, ny + H * 0.12, H * 1.35, color));
  } else if (s.eng === 'prop1') {
    parts.push(`<path d="M${P(x0 - H * 0.28)},${P(tipY - H * 0.04)} q${P(-H * 0.18)},${P(H * 0.05)} 0,${P(H * 0.12)} l${P(H * 0.3)},0 z" fill="${color}"/>`);
    parts.push(propDisc(x0 - H * 0.2, tipY + 2, H * 1.25, color));
  }

  // fin with an original star emblem
  const finH = H * (s.tail === 'T' ? 2.0 : (s.eng === 'prop1' ? 1.6 : 2.1));
  const fxL = xt + H * 0.15, fxT = x1 - H * 0.05;
  const fin = `M${P(fxL)},${P(top + 1)} L${P(fxT - H * 1.05)},${P(top - finH)} L${P(fxT - H * 0.25)},${P(top - finH)} L${P(fxT)},${P(top + H * 0.15)} Z`;
  parts.push(`<path d="${fin}" fill="url(#${id}t)" stroke="${color2}" stroke-width=".6"/>`);
  const ex = fxT - H * 0.75, ey = top - finH * 0.52, er = H * 0.42;
  parts.push(`<path d="M${P(ex)},${P(ey - er)} L${P(ex + er * 0.22)},${P(ey - er * 0.22)} L${P(ex + er)},${P(ey)} L${P(ex + er * 0.22)},${P(ey + er * 0.22)} L${P(ex)},${P(ey + er)} L${P(ex - er * 0.22)},${P(ey + er * 0.22)} L${P(ex - er)},${P(ey)} L${P(ex - er * 0.22)},${P(ey - er * 0.22)} Z" fill="#FFFFFF" opacity=".92"/>`);
  if (s.tail === 'T') {
    parts.push(`<path d="M${P(fxT - H * 1.65)},${P(top - finH + H * 0.04)} L${P(fxT + H * 0.35)},${P(top - finH - H * 0.06)} L${P(fxT + H * 0.2)},${P(top - finH + H * 0.16)} L${P(fxT - H * 1.5)},${P(top - finH + H * 0.2)} Z" fill="#AEB9C6" stroke="#7D8A99" stroke-width=".6"/>`);
  }

  if (o.reg) parts.push(`<text x="${P(xt - H * 0.35)}" y="${P(cy + H * 0.05)}" text-anchor="end" font-size="${P(Math.max(H * 0.24, 5.5))}" font-family="Inter, sans-serif" font-weight="600" fill="#4A5868" letter-spacing=".3">${esc(o.reg)}</text>`);

  return `<svg class="ac-art" viewBox="0 0 ${W} ${VH}" preserveAspectRatio="xMidYMax meet" role="img" aria-label="${esc(t.maker + ' ' + t.model)}">${parts.join('')}</svg>`;
}

function nacelle(x: number, y: number, w: number, h: number, fill: string, op: number): string {
  const P = (n: number) => n.toFixed(1);
  return `<g opacity="${op}"><path d="M${P(x)},${P(y)} L${P(x + w * 0.82)},${P(y + h * 0.08)} Q${P(x + w)},${P(y + h * 0.5)} ${P(x + w * 0.82)},${P(y + h * 0.92)} L${P(x)},${P(y + h)} Q${P(x - h * 0.12)},${P(y + h * 0.5)} ${P(x)},${P(y)} Z" fill="${fill}" stroke="#6B7787" stroke-width=".7"/>
    <ellipse cx="${P(x + h * 0.04)}" cy="${P(y + h * 0.5)}" rx="${P(h * 0.13)}" ry="${P(h * 0.42)}" fill="#1B2430"/></g>`;
}

function propDisc(x: number, y: number, h: number, color: string): string {
  const P = (n: number) => n.toFixed(1);
  return `<g class="prop"><ellipse cx="${P(x)}" cy="${P(y)}" rx="${P(h * 0.07)}" ry="${P(h * 0.5)}" fill="#C9D3DE" opacity=".22"/>
    <line x1="${P(x)}" y1="${P(y - h * 0.48)}" x2="${P(x)}" y2="${P(y + h * 0.48)}" stroke="#2A3542" stroke-width="1.4" opacity=".55"/>
    <ellipse cx="${P(x - 1)}" cy="${P(y)}" rx="${P(h * 0.09)}" ry="${P(h * 0.1)}" fill="${color}"/></g>`;
}

// Top-down aircraft symbol for the live map (canvas).
function drawPlaneGlyph(ctx: CanvasRenderingContext2D, x: number, y: number, hdgDeg: number, size: number, prop: boolean, fill: string, stroke: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(hdgDeg * D2R);
  ctx.scale(size / 24, size / 24);
  ctx.beginPath();
  if (!prop) {
    ctx.moveTo(0, -12); ctx.bezierCurveTo(1.4, -11, 1.6, -8, 1.6, -5);
    ctx.lineTo(11.5, 1.5); ctx.lineTo(11.5, 3.5); ctx.lineTo(1.6, 1); ctx.lineTo(1.3, 7.5);
    ctx.lineTo(4.6, 10); ctx.lineTo(4.6, 11.5); ctx.lineTo(0, 10.4);
    ctx.lineTo(-4.6, 11.5); ctx.lineTo(-4.6, 10); ctx.lineTo(-1.3, 7.5); ctx.lineTo(-1.6, 1);
    ctx.lineTo(-11.5, 3.5); ctx.lineTo(-11.5, 1.5); ctx.lineTo(-1.6, -5); ctx.bezierCurveTo(-1.6, -8, -1.4, -11, 0, -12);
  } else {
    ctx.moveTo(0, -10); ctx.lineTo(1.4, -7); ctx.lineTo(1.4, -4.5); ctx.lineTo(12, -4.5); ctx.lineTo(12, -1.8); ctx.lineTo(1.3, -1.8);
    ctx.lineTo(1, 7.5); ctx.lineTo(4.4, 8.4); ctx.lineTo(4.4, 10.2); ctx.lineTo(0, 9.6); ctx.lineTo(-4.4, 10.2); ctx.lineTo(-4.4, 8.4);
    ctx.lineTo(-1, 7.5); ctx.lineTo(-1.3, -1.8); ctx.lineTo(-12, -1.8); ctx.lineTo(-12, -4.5); ctx.lineTo(-1.4, -4.5); ctx.lineTo(-1.4, -7);
  }
  ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = 1.6; ctx.strokeStyle = stroke; ctx.stroke();
  ctx.restore();
}
