// Gifts: what your airline gives and receives. The first time one of your aircraft lands at an airport, the
// airline and the airport exchange gifts and commemorative plaques, as airlines and airports do on an inaugural
// flight: the airline gives a model of the aircraft and an engraved plaque, the airport gives something made
// where it is and its own plaque. They are kept in Ranking → Gifts → Aviation Gifts, each one a 3D model you can
// open and turn round (ui/viewer3d.ts).

interface GiftItem { kind: string; name: string; desc: string; lines?: string[]; color?: string }
interface GiftEx { id: string; at: number; cat: 'aviation' | 'career'; icao: string; cid: string; reg: string; typeId: string; given: GiftItem[]; received: GiftItem[] }

function giftsAll(): GiftEx[] { const S: any = State; return S.gifts || (S.gifts = []); }

/** What an airport gives, by country: something made there. */
function giftLocal(A: any): GiftItem {
  const cc = salCc(A), city = A.city || A.name, r = salRnd('gift' + A.icao)();
  const L: { [k: string]: GiftItem[] } = {
    FO: [{ kind: 'jumper', name: 'Hand-knitted Faroese jumper', desc: `Knitted from Faroese wool in the islands' old star pattern.`, color: '#2C3A52' }],
    IS: [{ kind: 'carving', name: 'Lava stone carving', desc: 'Carved from Icelandic lava stone.', color: '#2E2B2A' }],
    GL: [{ kind: 'carving', name: 'Carved figure of reindeer antler', desc: 'A small figure carved by a Greenlandic craftsman.', color: '#E7DCC8' }],
    NO: [{ kind: 'carving', name: 'Carved wooden figure', desc: 'Carved from Norwegian birch.', color: '#B9874E' }],
    DK: [{ kind: 'dish', name: 'Hand-painted porcelain dish', desc: 'Blue-painted porcelain from a Danish workshop.', color: '#2D4F9E' }],
    SE: [{ kind: 'vase', name: 'Hand-blown glass vase', desc: 'Blown at a glassworks in the Swedish forests.', color: '#6FB3D9' }],
    FI: [{ kind: 'vase', name: 'Glass bird vase', desc: 'Finnish hand-blown glass.', color: '#8FD0C4' }],
    IE: [{ kind: 'vase', name: 'Cut crystal vase', desc: 'Hand-cut Irish crystal.', color: '#E8F2F8' }],
    GB: [{ kind: 'tin', name: 'A tin of local tea', desc: `A blend made for ${city} airport.`, color: '#1F4D3A' }],
    NL: [{ kind: 'dish', name: 'Blue-painted tile plate', desc: 'Hand-painted in the Dutch blue style.', color: '#2D4F9E' }],
    PT: [{ kind: 'dish', name: 'Painted ceramic plate', desc: 'Portuguese hand-painted ceramics.', color: '#2D6FB0' }],
    ES: [{ kind: 'dish', name: 'Painted ceramic plate', desc: 'Hand-painted Spanish ceramics.', color: '#C9802E' }],
    IT: [{ kind: 'vase', name: 'Murano-style glass vase', desc: 'Hand-blown Italian glass.', color: '#C94F6D' }],
    JP: [{ kind: 'dish', name: 'Lacquered dish', desc: 'Japanese lacquerware.', color: '#8E1B1B' }],
    CH: [{ kind: 'tin', name: 'A tin of local chocolates', desc: 'Made in a chocolatier near the airport.', color: '#7A1F2B' }],
    BE: [{ kind: 'tin', name: 'A tin of local chocolates', desc: 'Belgian chocolates.', color: '#5A3420' }],
  };
  const pick = (L[cc] || [])[0];
  if (pick) return pick;
  return r < 0.5 ? { kind: 'frame', name: `Framed aerial photograph of ${A.name}`, desc: 'The airport from above, signed by the airport director.' }
    : { kind: 'book', name: `${city}: a history of flight`, desc: `A book about flying in and out of ${city}, signed by the airport director.`, color: '#24324A' };
}

/** The airline and the airport exchange gifts and plaques on the first landing. */
function giftsExchange(cid: string, icao: string, reg: string, at: number): GiftEx {
  const A: any = apt(icao), c: any = company(cid), a: any = plane(reg); if (!A || !c || !a) return null;
  const t = acType(a.typeId), date = dateStr(new Date(at)).slice(0, 10);
  const ex: GiftEx = {
    id: 'gift-' + uid(), at, cat: 'aviation', icao, cid, reg, typeId: a.typeId,
    given: [
      { kind: 'model', name: `Model of ${reg}`, desc: `A 1:200 model of the ${t ? t.model : 'aircraft'} that flew in, in ${c.name}'s colours, on a stand with a brass name plate.` },
      { kind: 'plaque', name: `${c.name} plaque`, desc: `Presented by ${c.name} to ${A.name}.`, lines: ['PRESENTED TO', A.name.toUpperCase(), 'ON THE INAUGURAL FLIGHT OF', c.name.toUpperCase(), `${reg} · ${date}`] },
    ],
    received: [
      giftLocal(A),
      { kind: 'plaque', name: `${A.name} plaque`, desc: `Presented by ${A.name} to ${c.name}.`, lines: ['IN COMMEMORATION OF', 'THE FIRST FLIGHT OF', c.name.toUpperCase(), `TO ${A.name.toUpperCase()} (${icao})`, date] },
    ],
  };
  giftsAll().unshift(ex); Store.soon();
  if (cid === State.companyId) {
    State.notices.unshift({ id: uid(), kind: 'company' as any, title: `Gifts from ${A.name}`, body: `${ex.received.map(g => g.name).join(' and ')}, for your first flight to ${A.city || A.name}. Tap to see them.`, time: 'Now', at, read: false, ref: ex.id } as any);
    try { renderTopbar(); } catch (e) { /* not ready */ }
    if (at > Date.now() - 12 * 3600e3) setTimeout(() => giftReveal(ex, false), 4000);   // after the newspaper has had its moment
  }
  return ex;
}

/** The gifts revealed like a badge (the card, the beams, the confetti): each kind of gift only the first time
 *  you receive it, unless you open it again from its notification. */
function giftReveal(ex: GiftEx, again: boolean) {
  const S: any = State, seen = S.giftSeen || (S.giftSeen = {}), A: any = apt(ex.icao) || { name: ex.icao };
  const list: any[] = [];
  ex.received.forEach((it, i) => {
    const key = it.kind + '|' + it.name; if (seen[key] && !again) return; seen[key] = ex.at;
    list.push({ id: ex.id + '-' + i, group: 'airline', cat: 'Gifts', title: it.name, desc: it.desc, tier: it.kind === 'plaque' ? 3 : 2, metric: '', need: 0, icon: 'star',
      img: viewerThumb(ex.id + 'received' + i + 'bare', T => giftBuild(T, it, ex), 420, true), gift: true, rankText: it.kind === 'plaque' ? 'Commemorative plaque' : 'Aviation gift', dateText: `From ${A.name} · ${dateStr(new Date(ex.at)).slice(0, 10)}` });
  });
  Store.soon();
  if (list.length) badgeReveal(list as any);
}
/** From the notification: to Ranking → Gifts, and the gifts shown again. */
function giftOpenRef(id: string) {
  const ex = giftsAll().filter(g => g.id === id)[0]; if (!ex) return;
  try { closeAll(); } catch (e) { /* none */ }
  _rkWho = 'gifts'; _giftCat = ex.cat; go('ranking');
  setTimeout(() => giftReveal(ex, true), 350);
}

/* ---------- the 3D models ---------- */

/** Wood: a grain drawn on a canvas. */
function giftWood(T: any, base: string): any {
  const [c, g] = v3vCanvas(512, 512); g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 140; i++) { const y = Math.random() * 512, a = 0.05 + Math.random() * 0.12; g.strokeStyle = `rgba(30,14,4,${a})`; g.lineWidth = 1 + Math.random() * 3; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= 512; x += 32) g.lineTo(x, y + Math.sin(x / 70 + i) * 6); g.stroke(); }
  return new T.MeshStandardMaterial({ map: v3vTex(T, c), roughness: 0.55, metalness: 0.02 });
}
/** A plaque: a walnut board with a bevelled edge and an engraved brass plate with an aircraft and the words. */
function giftPlaque(T: any, lines: string[], title?: string): any {
  const g = new T.Group();
  const sh = new T.Shape(), w = 1.6, h = 2, r = 0.12;
  sh.moveTo(-w / 2 + r, -h / 2); sh.lineTo(w / 2 - r, -h / 2); sh.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r); sh.lineTo(w / 2, h / 2 - r); sh.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  sh.lineTo(-w / 2 + r, h / 2); sh.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); sh.lineTo(-w / 2, -h / 2 + r); sh.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const board = new T.Mesh(new T.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.04, bevelSegments: 4 }), giftWood(T, '#5A3420'));
  g.add(board);
  // the brass plate: engraved (dark lettering, cut into the bump map)
  const [c, x] = v3vCanvas(640, 800), [bc, bx] = v3vCanvas(640, 800);
  const gr = x.createLinearGradient(0, 0, 640, 800); gr.addColorStop(0, '#E9C873'); gr.addColorStop(0.5, '#C9A24A'); gr.addColorStop(1, '#E6C26A'); x.fillStyle = gr; x.fillRect(0, 0, 640, 800);
  bx.fillStyle = '#FFF'; bx.fillRect(0, 0, 640, 800);
  for (const [ctx, ink] of [[x, '#3A2A10'], [bx, '#000']] as [CanvasRenderingContext2D, string][]) {
    ctx.strokeStyle = ink; ctx.fillStyle = ink; ctx.lineWidth = 5; ctx.strokeRect(24, 24, 592, 752); ctx.lineWidth = 2; ctx.strokeRect(38, 38, 564, 724);
    v3vDrawIcon(ctx, 'fleet', 320, 150, 150, 1.6);
    ctx.textAlign = 'center';
    lines.forEach((l, i) => { const big = i === 1 || (i === 3 && lines.length > 4 && l.indexOf('·') < 0); ctx.font = `${big ? 700 : 600} ${big ? 40 : 28}px Georgia, serif`; let s = l; while (ctx.measureText(s).width > 540 && s.length > 6) s = s.slice(0, -2); ctx.fillText(s, 320, 300 + i * 82); });
  }
  const plate = new T.Mesh(new T.BoxGeometry(1.25, 1.56, 0.02), [null, null, null, null, new T.MeshStandardMaterial({ map: v3vTex(T, c), bumpMap: v3vTex(T, bc, false), bumpScale: 0.02, metalness: 1, roughness: 0.3 }), null].map((m: any) => m || new T.MeshStandardMaterial({ color: 0xC9A24A, metalness: 1, roughness: 0.3 })));
  plate.position.z = 0.145; g.add(plate);
  for (const [px, py] of [[-0.56, 0.72], [0.56, 0.72], [-0.56, -0.72], [0.56, -0.72]]) { const s = new T.Mesh(new T.SphereGeometry(0.03, 12, 8), new T.MeshStandardMaterial({ color: 0xB8902F, metalness: 1, roughness: 0.25 })); s.position.set(px, py, 0.16); g.add(s); }
  // a small easel behind, so it stands
  const leg = new T.Mesh(new T.BoxGeometry(0.08, 1.6, 0.06), giftWood(T, '#3E2414')); leg.position.set(0, -0.25, -0.45); leg.rotation.x = 0.36; g.add(leg);
  g.rotation.x = -0.18; g.position.y = 1.05;
  const out = new T.Group(); out.add(g); void title; return out;
}
/** The model aircraft on a chrome stand with a black base and a brass name plate. */
function giftModel(T: any, typeId: string, cid: string, reg: string): any {
  const g = new T.Group(), c: any = company(cid) || company();
  let m: any; try { m = buildAircraftModel(typeId, liveryFor(c && c.color, c && c.color2, c && c.id)); m.userData.set && m.userData.set({ flaps: 0, gear: 0 }); } catch (e) { m = new T.Group(); }
  const s: any = shapeOf(typeId), k = 2.4 / Math.max(s.L, s.span);
  const ac = new T.Group(); m.position.x = -s.L / 2; ac.add(m); ac.scale.setScalar(k); ac.position.y = 1.05; ac.rotation.z = 0.08; g.add(ac);
  const chrome = new T.MeshStandardMaterial({ color: 0xE8ECF0, metalness: 1, roughness: 0.12 });
  const rod = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 0.85, 16), chrome); rod.position.y = 0.55; rod.rotation.z = 0.12; g.add(rod);
  const base = new T.Mesh(new T.CylinderGeometry(0.55, 0.62, 0.12, 48), new T.MeshStandardMaterial({ color: 0x0E0F12, roughness: 0.25, metalness: 0.4 })); base.position.y = 0.06; g.add(base);
  const [pc, px] = v3vCanvas(512, 96); px.fillStyle = '#C9A24A'; px.fillRect(0, 0, 512, 96); px.fillStyle = '#2B1E08'; px.font = '700 44px Georgia, serif'; px.textAlign = 'center'; px.fillText(reg + ' · ' + ((acType(typeId) || {} as any).model || ''), 256, 64);
  const plate = new T.Mesh(new T.PlaneGeometry(0.5, 0.094), new T.MeshStandardMaterial({ map: v3vTex(T, pc), metalness: 1, roughness: 0.3 })); plate.position.set(0, 0.07, 0.6); plate.rotation.x = -0.35; g.add(plate);
  return g;
}
/** A folded knitted jumper with its star pattern. */
function giftJumper(T: any, col: string): any {
  const [c, x] = v3vCanvas(512, 512); x.fillStyle = col; x.fillRect(0, 0, 512, 512);
  x.fillStyle = '#EDE6D6';
  for (let yy = 0; yy < 512; yy += 64) for (let xx = (yy / 64) % 2 ? 32 : 0; xx < 512; xx += 64) { const cx = xx + 16, cy = yy + 32; x.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? 7 : 16; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.closePath(); x.fill(); }
  for (let yy = 0; yy < 512; yy += 4) { x.fillStyle = `rgba(0,0,0,${yy % 8 ? 0.06 : 0.12})`; x.fillRect(0, yy, 512, 2); }   // the rows of stitches
  const tex = v3vTex(T, c); tex.wrapS = tex.wrapT = T.RepeatWrapping;
  const mat = new T.MeshStandardMaterial({ map: tex, roughness: 0.95, bumpMap: tex, bumpScale: 0.01 });
  const g = new T.Group();
  const body = new T.Mesh(new T.BoxGeometry(2, 0.34, 1.5, 8, 2, 8), mat); body.position.y = 0.17; g.add(body);
  const fold = new T.Mesh(new T.BoxGeometry(2, 0.16, 0.7), mat); fold.position.set(0, 0.42, 0.38); g.add(fold);
  const collar = new T.Mesh(new T.TorusGeometry(0.28, 0.07, 12, 32, Math.PI), mat); collar.rotation.x = -Math.PI / 2; collar.position.set(0, 0.36, -0.55); g.add(collar);
  for (const s of [-1, 1]) { const sl = new T.Mesh(new T.CylinderGeometry(0.16, 0.18, 1.3, 16), mat); sl.rotation.z = Math.PI / 2; sl.position.set(s * 0.25, 0.55, 0.1 + s * 0.12); sl.rotation.y = s * 0.15; g.add(sl); }
  return g;
}
/** A turned shape (a vase, a dish, a tin, a figure) from its outline. */
function giftLathe(T: any, pts: number[][], mat: any, seg = 64): any { return new T.Mesh(new T.LatheGeometry(pts.map(p => new T.Vector2(p[0], p[1])), seg), mat); }
function giftVase(T: any, col: string): any {
  const mat = new T.MeshPhysicalMaterial({ color: new T.Color(col), metalness: 0, roughness: 0.05, transmission: 0.85, thickness: 0.4, ior: 1.5, transparent: true, opacity: 0.92, side: T.DoubleSide });
  return giftLathe(T, [[0, 0], [0.42, 0], [0.5, 0.06], [0.62, 0.5], [0.66, 0.9], [0.5, 1.4], [0.28, 1.75], [0.25, 1.95], [0.34, 2.05], [0.3, 2.08]], mat);
}
function giftDish(T: any, col: string): any {
  const [c, x] = v3vCanvas(512, 512); x.fillStyle = '#F7F6F2'; x.fillRect(0, 0, 512, 512); x.strokeStyle = col; x.fillStyle = col;
  x.lineWidth = 10; x.beginPath(); x.arc(256, 256, 236, 0, 7); x.stroke(); x.lineWidth = 4; x.beginPath(); x.arc(256, 256, 160, 0, 7); x.stroke();
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; x.save(); x.translate(256 + Math.cos(a) * 200, 256 + Math.sin(a) * 200); x.rotate(a); x.beginPath(); x.ellipse(0, 0, 22, 9, 0, 0, 7); x.fill(); x.restore(); }
  v3vDrawIcon(x, 'fleet', 256, 256, 160, 1.8);
  const top = new T.MeshStandardMaterial({ map: v3vTex(T, c), roughness: 0.18, metalness: 0 });
  const g = new T.Group();
  const plate = new T.Mesh(new T.CylinderGeometry(1.2, 0.8, 0.12, 96), [new T.MeshStandardMaterial({ color: 0xF2F1EC, roughness: 0.2 }), top, new T.MeshStandardMaterial({ color: 0xF2F1EC, roughness: 0.2 })]);
  plate.position.y = 0.95; plate.rotation.x = 1.15; g.add(plate);
  const stand = new T.Mesh(new T.BoxGeometry(0.9, 0.06, 0.5), giftWood(T, '#3E2414')); stand.position.set(0, 0.03, 0.2); g.add(stand);
  return g;
}
function giftTin(T: any, col: string, label: string): any {
  const [c, x] = v3vCanvas(1024, 256); x.fillStyle = col; x.fillRect(0, 0, 1024, 256); x.fillStyle = '#D9B45A'; x.fillRect(0, 22, 1024, 8); x.fillRect(0, 226, 1024, 8);
  x.font = '700 54px Georgia, serif'; x.textAlign = 'center'; x.fillText(label, 512, 145); x.font = '500 28px Georgia, serif'; x.fillText('AIRPORT EDITION', 512, 195);
  const side = new T.MeshStandardMaterial({ map: v3vTex(T, c), metalness: 0.6, roughness: 0.35 }), lid = new T.MeshStandardMaterial({ color: 0xD9B45A, metalness: 1, roughness: 0.3 });
  const g = new T.Group(); const body = new T.Mesh(new T.CylinderGeometry(0.6, 0.6, 1.5, 64), [side, lid, lid]); body.position.y = 0.75; g.add(body);
  const cap = new T.Mesh(new T.CylinderGeometry(0.63, 0.63, 0.22, 64), lid); cap.position.y = 1.55; g.add(cap); return g;
}
function giftCarving(T: any, col: string): any {
  const mat = new T.MeshStandardMaterial({ color: new T.Color(col), roughness: 0.85, metalness: 0, flatShading: true });
  const g = new T.Group();
  g.add(giftLathe(T, [[0, 0], [0.5, 0], [0.55, 0.15], [0.42, 0.35], [0.5, 0.7], [0.36, 1.05], [0.42, 1.25], [0.3, 1.55], [0.34, 1.7], [0.18, 1.95], [0, 2.02]], mat, 9));
  const head = new T.Mesh(new T.IcosahedronGeometry(0.32, 1), mat); head.position.y = 2.15; g.add(head);
  for (const s of [-1, 1]) { const arm = new T.Mesh(new T.CylinderGeometry(0.08, 0.1, 0.7, 7), mat); arm.position.set(s * 0.45, 1.25, 0.08); arm.rotation.z = s * 0.35; g.add(arm); }
  return g;
}
function giftFrame(T: any, icao: string): any {
  // the airport from above: its runways, drawn where they are
  const [c, x] = v3vCanvas(768, 576); x.fillStyle = '#6E7F55'; x.fillRect(0, 0, 768, 576);
  for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(${60 + Math.random() * 60},${80 + Math.random() * 50},${40 + Math.random() * 30},.5)`; x.fillRect(Math.random() * 768, Math.random() * 576, 40 + Math.random() * 120, 30 + Math.random() * 90); }
  const A: any = apt(icao), rows: any[] = ((World.runways || {}) as any)[icao] || [];
  if (A && rows.length) {
    let mx = 0; const kx = Math.cos(A.pos[1] * D2R) * 111320, P = (lo: number, la: number) => [(lo - A.pos[0]) * kx, -(la - A.pos[1]) * 110540];
    const segs = rows.filter(r => r[5] != null && r[7] != null).map(r => [P(r[6], r[5]), P(r[8], r[7]), Math.max(30, (r[3] || 150) * 0.3048)]);
    for (const s of segs) mx = Math.max(mx, Math.abs(s[0][0]), Math.abs(s[0][1]), Math.abs(s[1][0]), Math.abs(s[1][1]));
    const k = 250 / Math.max(500, mx);
    x.lineCap = 'butt';
    for (const [a, b, wd] of segs as any) { x.strokeStyle = '#3A3D42'; x.lineWidth = Math.max(8, wd * k * 2.5); x.beginPath(); x.moveTo(384 + a[0] * k, 288 + a[1] * k); x.lineTo(384 + b[0] * k, 288 + b[1] * k); x.stroke(); x.strokeStyle = '#EEE'; x.lineWidth = 1.5; x.setLineDash([10, 8]); x.stroke(); x.setLineDash([]); }
    x.fillStyle = '#C9CDD2'; x.fillRect(300, 420, 200, 50); x.fillStyle = '#9AA2AB'; x.fillRect(320, 400, 160, 20);
  }
  x.fillStyle = 'rgba(255,255,255,.85)'; x.font = '600 26px Georgia, serif'; x.fillText(A ? A.name : icao, 24, 548);
  const g = new T.Group();
  const frame = new T.Mesh(new T.BoxGeometry(2.3, 1.8, 0.1), giftWood(T, '#2A1A10')); frame.position.y = 1.0; g.add(frame);
  const pic = new T.Mesh(new T.PlaneGeometry(2.0, 1.5), new T.MeshStandardMaterial({ map: v3vTex(T, c), roughness: 0.4 })); pic.position.set(0, 1.0, 0.052); g.add(pic);
  const glass = new T.Mesh(new T.PlaneGeometry(2.0, 1.5), new T.MeshPhysicalMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.08, roughness: 0, metalness: 0 })); glass.position.set(0, 1.0, 0.06); g.add(glass);
  const leg = new T.Mesh(new T.BoxGeometry(0.1, 1.5, 0.06), giftWood(T, '#2A1A10')); leg.position.set(0, 0.62, -0.4); leg.rotation.x = 0.35; g.add(leg);
  g.rotation.x = -0.12; return g;
}
function giftBook(T: any, col: string, title: string): any {
  const [c, x] = v3vCanvas(512, 700); x.fillStyle = col; x.fillRect(0, 0, 512, 700); x.strokeStyle = '#D9B45A'; x.lineWidth = 6; x.strokeRect(30, 30, 452, 640);
  x.fillStyle = '#D9B45A'; x.textAlign = 'center'; x.font = '700 46px Georgia, serif';
  const words = title.split(' '); let ln = '', y = 200; for (const w of words) { if (x.measureText(ln + ' ' + w).width > 400 && ln) { x.fillText(ln, 256, y); y += 56; ln = w; } else ln = ln ? ln + ' ' + w : w; } x.fillText(ln, 256, y);
  v3vDrawIcon(x, 'fleet', 256, 500, 120, 1.6);
  const cover = new T.MeshStandardMaterial({ map: v3vTex(T, c), roughness: 0.6 }), plain = new T.MeshStandardMaterial({ color: new T.Color(col), roughness: 0.6 }), pages = new T.MeshStandardMaterial({ color: 0xF1EBDD, roughness: 0.9 });
  const b = new T.Mesh(new T.BoxGeometry(1.5, 2.05, 0.32), [pages, plain, pages, pages, cover, plain]); b.position.y = 1.02; b.rotation.x = -0.2;
  const g = new T.Group(); g.add(b); const leg = new T.Mesh(new T.BoxGeometry(0.1, 1.6, 0.06), giftWood(T, '#3E2414')); leg.position.set(0, 0.7, -0.45); leg.rotation.x = 0.35; g.add(leg); return g;
}
/** The 3D model of a gift. */
function giftBuild(T: any, it: GiftItem, ex: GiftEx): any {
  switch (it.kind) {
    case 'plaque': return giftPlaque(T, it.lines || [it.name]);
    case 'model': return giftModel(T, ex.typeId, ex.cid, ex.reg);
    case 'jumper': return giftJumper(T, it.color || '#2C3A52');
    case 'vase': return giftVase(T, it.color || '#6FB3D9');
    case 'dish': return giftDish(T, it.color || '#2D4F9E');
    case 'tin': return giftTin(T, it.color || '#1F4D3A', (apt(ex.icao) || { city: ex.icao } as any).city.toUpperCase());
    case 'carving': return giftCarving(T, it.color || '#B9874E');
    case 'book': return giftBook(T, it.color || '#24324A', it.name);
    case 'cert': return giftCert(T, it.lines || [it.name], it.color);
    case 'medal': return giftMedal(T, it);
    default: return giftFrame(T, ex.icao);
  }
}

/** A framed certificate (a type rating, a milestone), with its words in an engraved style. */
function giftCert(T: any, lines: string[], col?: string): any {
  const [c, x] = v3vCanvas(768, 560); x.fillStyle = '#F6F1E4'; x.fillRect(0, 0, 768, 560);
  x.strokeStyle = col || '#8A6A2A'; x.lineWidth = 10; x.strokeRect(22, 22, 724, 516); x.lineWidth = 2; x.strokeRect(40, 40, 688, 480);
  x.fillStyle = '#2A2014'; x.textAlign = 'center';
  lines.forEach((l, i) => { x.font = `${i === 0 ? 700 : i === 1 ? 700 : 500} ${i === 0 ? 24 : i === 1 ? 44 : 26}px Georgia, serif`; if (i === 0) x.fillStyle = col || '#8A6A2A'; else x.fillStyle = '#2A2014'; let s2 = l; while (x.measureText(s2).width > 640 && s2.length > 6) s2 = s2.slice(0, -2); x.fillText(s2, 384, 120 + (i === 0 ? 0 : i === 1 ? 70 : 70 + (i - 1) * 52)); });
  x.fillStyle = col || '#B8902F'; x.beginPath(); x.arc(640, 450, 42, 0, 7); x.fill(); x.fillStyle = '#F6F1E4'; v3vDrawIcon(x, 'star', 640, 450, 46, 2.2);
  const g = new T.Group();
  const frame = new T.Mesh(new T.BoxGeometry(2.3, 1.75, 0.1), giftWood(T, '#2A1A10')); frame.position.y = 1.0; g.add(frame);
  const pic = new T.Mesh(new T.PlaneGeometry(2.05, 1.5), new T.MeshStandardMaterial({ map: v3vTex(T, c), roughness: 0.7 })); pic.position.set(0, 1.0, 0.052); g.add(pic);
  const leg = new T.Mesh(new T.BoxGeometry(0.1, 1.5, 0.06), giftWood(T, '#2A1A10')); leg.position.set(0, 0.62, -0.4); leg.rotation.x = 0.35; g.add(leg);
  g.rotation.x = -0.12; return g;
}
/** A milestone medal: the badge medal, in gold, with the milestone's words. */
function giftMedal(T: any, it: GiftItem): any { return badgeMedal(T, { id: 'm', group: 'pilot', cat: 'Milestone', title: it.name, desc: it.desc, tier: 2, metric: '', need: 0, icon: it.color || 'star' } as any, (it as any).at || Date.now()); }

/* ---------- Ranking → Gifts ---------- */
let _giftCat = 'aviation';
function giftsHtml(): string {
  const all = giftsAll().filter(g => g.cat === _giftCat && (!g.cid || g.cid === State.companyId || (company(g.cid) as any)));
  const cats = `<div class="gift-top"><div class="seg gift-cats"><button class="${_giftCat === 'aviation' ? 'on' : ''}" data-act="gift-cat" data-c="aviation">Aviation Gifts</button><button class="${_giftCat === 'career' ? 'on' : ''}" data-act="gift-cat" data-c="career">Career Milestones</button></div><button class="btn sm primary" data-act="mus-open">${icon('star')}Walk through your museum</button></div>`;
  if (_giftCat === 'career') {
    if (!all.length) return `${cats}<div class="card gift-empty">${icon('star')}<span><b>No milestones yet</b><small>Your type ratings and career milestones (hours, landings, your first widebody, promotions) are awarded here: a certificate, a plaque or a medal, each one in 3D.</small></span></div>`;
    return `${cats}<div class="card"><div class="gift-row career">${all.map(ex => { const it = ex.received[0], th = viewerThumb(ex.id + 'received0', T => giftBuild(T, it, ex), Gfx.pic([280, 480, 720]));
      return `<button class="gift-it" data-act="gift-3d" data-id="${esc(ex.id)}" data-side="received" data-i="0" aria-label="Open ${esc(it.name)} in 3D"><span class="gift-th">${th ? `<img src="${th}" alt="">` : icon('star')}</span><b>${esc(it.name)}</b><small>${esc(dateStr(new Date(ex.at)).slice(0, 10))} · ${esc(it.desc)}</small></button>`; }).join('')}</div></div>`;
  }
  if (!all.length) return `${cats}<div class="card gift-empty">${icon('star')}<span><b>No aviation gifts yet</b><small>The first time one of your aircraft lands at an airport your airline has never been to, the airport welcomes it with a water salute, and the airline and the airport exchange gifts and commemorative plaques. They are kept here.</small></span></div>`;
  const card = (ex: GiftEx, side: 'received' | 'given', i: number) => {
    const it = ex[side][i], th = viewerThumb(ex.id + side + i, T => giftBuild(T, it, ex), 280);
    return `<button class="gift-it" data-act="gift-3d" data-id="${esc(ex.id)}" data-side="${side}" data-i="${i}" aria-label="Open ${esc(it.name)} in 3D">
      <span class="gift-th">${th ? `<img src="${th}" alt="">` : icon('star')}</span><b>${esc(it.name)}</b><small>${esc(it.desc)}</small></button>`;
  };
  return `${cats}<div class="gift-list">${all.map(ex => {
    const A: any = apt(ex.icao) || { name: ex.icao, city: '' }, c: any = company(ex.cid);
    return `<div class="card gift-ex"><div class="card-h"><b>${esc(A.name)} <small>${esc(ex.icao)}</small></b><span class="muted">First flight ${esc(dateStr(new Date(ex.at)).slice(0, 10))} · ${esc(ex.reg)}${c ? ' · ' + esc(c.name) : ''}</span></div>
      <div class="gift-sides"><div><h4>Received from ${esc(A.name)}</h4><div class="gift-row">${ex.received.map((_, i) => card(ex, 'received', i)).join('')}</div></div>
        <div><h4>Given by ${esc(c ? c.name : 'your airline')}</h4><div class="gift-row">${ex.given.map((_, i) => card(ex, 'given', i)).join('')}</div></div></div></div>`;
  }).join('')}</div>`;
}
ACTIONS['gift-cat'] = el => { _giftCat = el.getAttribute('data-c'); Sound.tick(); refresh(); };
ACTIONS['gift-3d'] = el => {
  const ex = giftsAll().filter(g => g.id === el.getAttribute('data-id'))[0]; if (!ex) return;
  const side = el.getAttribute('data-side') as 'received' | 'given', it = ex[side][+el.getAttribute('data-i')]; if (!it) return;
  const A: any = apt(ex.icao) || { name: ex.icao };
  viewer3dOpen({ title: it.name, sub: `${ex.cat === 'career' ? 'Awarded' : side === 'received' ? 'From ' + A.name : 'Given to ' + A.name} · ${dateStr(new Date(ex.at)).slice(0, 10)}`, info: `<p>${esc(it.desc)}</p>${it.lines ? `<p class="v3v-eng">${it.lines.map(esc).join('<br>')}</p>` : ''}`, build: T => giftBuild(T, it, ex) });
};
