// A water salute: the first time one of your airline's aircraft lands at an airport it has never been to, the
// airport's fire service welcomes it the way airports welcome a new airline. Two fire trucks stand on either side
// of the taxiway and spray water from their roof cannons; the jets cross high above, in an arch like a rainbow, and
// the aircraft taxis underneath. The papers write about it (news.ts), with a picture, and the article has a
// button to watch it in 3D.
//  - firstVisitCheck(): called on every landing (yours and your pilots'), keeps the airports each airline has
//    been to (State.visited) and starts the salute the first time.
//  - saluteOpen(): the 3D scene. The aircraft is the airline's own model in its livery; the trucks, the taxiway
//    and the airport around it are made here. The water is drawn as droplets thrown from each cannon and falling
//    on their real arcs (worked out on the graphics card), with spray and mist around them.

function visitedOf(cid: string): { [icao: string]: number } { const S: any = State; S.visited = S.visited || {}; return S.visited[cid] || (S.visited[cid] = {}); }

/** The airports an airline had already been to before it started counting: its hub, where its aircraft are and
 *  every leg in the log book (the landing being checked left out). */
function visitSeed(cid: string, skipReg?: string, skipTo?: string) {
  const v = visitedOf(cid), c: any = company(cid); if (v.__seeded) return; v.__seeded = 1;
  const add = (k: string) => { if (k && /^[A-Z0-9]{3,4}$/.test(k)) v[k] = v[k] || 1; };
  if (c) add(c.hub);
  try { for (const a of fleetOf(cid) as any[]) if (!(a.reg === skipReg && a.location === skipTo)) add(a.location); } catch (e) { /* none */ }
  try { (State.logbook || []).forEach((l: any, i: number) => { const a = plane(l.reg); if (a && a.companyId !== cid) return; add(l.from); if (!(i === 0 && l.reg === skipReg && l.to === skipTo)) add(l.to); }); } catch (e) { /* none */ }
  try { for (const f of State.live || []) { const a = plane(f.reg); if (a && a.companyId === cid) add(f.from); } } catch (e) { /* none */ }
}

/** On every landing of an airline's aircraft: the first time at an airport, a water salute and the news. */
function firstVisitCheck(cid: string, to: string, reg: string, at?: number) {
  if (!cid || !to || !apt(to)) return;
  const v = visitedOf(cid);
  if (!v.__seeded) visitSeed(cid, reg, to);
  if (v[to]) return;
  v[to] = at || Date.now(); Store.soon();
  // landings worked out while the app was closed are old news: only today's get the salute and the paper
  if ((at || Date.now()) < Date.now() - 12 * 3600e3) return;
  const a: any = plane(reg), c: any = company(cid), A: any = apt(to); if (!a || !c) return;
  const t = acType(a.typeId), city = A.city || A.name, mine = cid === State.companyId;
  let gx: GiftEx = null; try { gx = giftsExchange(cid, to, reg, at || Date.now()); } catch (e) { gx = null; }
  try {
    const paper = newsPaper(A.country || ''), boss = (() => { try { return makePerson('dir-' + to, 'fa', '', to).name; } catch (e) { return 'The airport director'; } })();
    newsPublish({
      paper, section: 'Aviation', place: city,
      headline: `${c.name} arrives in ${city}: a water salute for its first flight`,
      standfirst: `${c.name}'s ${t ? t.model : 'aircraft'} ${a.reg} landed at ${A.name} for the first time and taxied in under an arch of water from the airport's fire trucks.`,
      body: [
        `${A.name} (${to}) welcomed a new airline today. When ${a.reg} turned off the runway, two of the airport's fire trucks were waiting on either side of the taxiway. Their roof cannons sent up two jets of water that met high above the taxiway, and the aircraft taxied through the arch to its stand.`,
        `The water salute is an aviation tradition for a first flight, a new route or a new aircraft. It is ${c.name}'s first visit to ${city}.`,
        `Passengers watched from the windows as the water ran down the cabin windows. Staff from the airport and the ground handling company lined the apron to greet the crew.`,
      ].concat(gx ? [`At the stand, ${c.name} presented the airport with ${gx.given.map(g => g.name.charAt(0).toLowerCase() + g.name.slice(1)).join(' and ')}. In return, the airport gave the airline ${gx.received[0].name.charAt(0).toLowerCase() + gx.received[0].name.slice(1)} and a commemorative plaque.`] : []),
      quote: [`We're delighted to welcome ${c.name} to ${city}. We hope this is the first of many flights.`, `${boss}, ${A.name}`],
      art: { kind: 'salute', typeId: a.typeId, color: c.color, color2: c.color2, reg: a.reg, icao: to, cid } as any,
      companyId: cid,
    } as any, mine);
  } catch (e) { /* no paper today */ }
}

/** The newspaper's picture: the aircraft between the two fire trucks, under the arch of water. */
function saluteArt(typeId: string, o: { color: string; color2: string; reg: string }): string {
  const ac = aircraftArt(typeId, o) || '';
  const inner = ac ? ac.slice(ac.indexOf('>') + 1, ac.lastIndexOf('</svg>')) : '';
  const id = 'sw' + Math.floor(Math.random() * 1e6);
  const truck = (x: number, flip: boolean) => `<g transform="translate(${x} 0) scale(${flip ? -1 : 1} 1)">
      <rect x="-26" y="122" width="52" height="13" rx="2" fill="#B81E26"/><path d="M-26 122v-6h16l6 6z" fill="#B81E26"/><path d="M-24 117h12l4 4h-16z" fill="#2A3A4A"/>
      <rect x="-4" y="118" width="26" height="4" fill="#B81E26"/><rect x="-26" y="128" width="52" height="2" fill="#F4F4F4"/>
      <circle cx="-17" cy="137" r="4" fill="#1E1E22"/><circle cx="6" cy="137" r="4" fill="#1E1E22"/><circle cx="17" cy="137" r="4" fill="#1E1E22"/>
      <rect x="-20" y="114" width="8" height="2" fill="#2F7BFF"/><path d="M-12 116l7-4 2 2-7 4z" fill="#5A5F66"/></g>`;
  // each jet: from its cannon up over the aircraft and down on the far side (the two cross at the top)
  const jet = (x0: number, x1: number) => `M${x0} 112 Q210 -78 ${x1} 150`;
  const water = (d: string) => `<path d="${d}" stroke="url(#${id}m)" stroke-width="16" fill="none" opacity=".35" filter="url(#${id}b)"/>
      <path d="${d}" stroke="url(#${id}g)" stroke-width="5" fill="none" opacity=".75"/>
      <path d="${d}" stroke="#FFFFFF" stroke-width="1.6" fill="none" opacity=".85" stroke-dasharray="1 5 3 7 2 4"/>
      <path d="${d}" stroke="#D8F0FF" stroke-width="3.5" fill="none" opacity=".55" stroke-dasharray="0.5 9 1 13" stroke-linecap="round" transform="translate(2 3)"/>`;
  return `<svg class="ac-art np-salute" viewBox="0 0 420 150" preserveAspectRatio="xMidYMax meet" role="img" aria-label="The aircraft taxiing under the water salute">
    <defs><linearGradient id="${id}g" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#8CCBFF"/><stop offset=".6" stop-color="#E4F5FF"/><stop offset="1" stop-color="#FFFFFF"/></linearGradient>
      <linearGradient id="${id}m" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#BFE3FF"/><stop offset="1" stop-color="#FFFFFF"/></linearGradient>
      <filter id="${id}b" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3.5"/></filter></defs>
    <rect x="0" y="139" width="420" height="11" fill="#9AA0A6" opacity=".35"/>
    <g transform="translate(84 52) scale(.6)">${inner}</g>
    ${truck(36, false)}${truck(384, true)}
    ${water(jet(46, 404))}${water(jet(374, 16))}
  </svg>`;
}

/** The newspaper's photo, taken in the 3D scene: low on the taxiway ahead, the aircraft right under the arch with
 *  a truck spraying on either side. Kept for the session per article; null where 3D can't be drawn. */
const _salPhotos: { [k: string]: string } = {};
function salutePhoto(key: string, o: { typeId: string; cid?: string; icao?: string; at?: number }): string {
  if (_salPhotos[key] !== undefined) return _salPhotos[key];
  const T = typeof THREE !== 'undefined' ? THREE : null; if (!T) return (_salPhotos[key] = '');
  let url = '';
  try {
    const W = 1120, H = 520, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const R = new T.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: true });
    R.setPixelRatio(1); R.setSize(W, H, false); R.outputColorSpace = T.SRGBColorSpace; R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = 1.05;
    R.shadowMap.enabled = true; R.shadowMap.type = T.PCFSoftShadowMap;
    const c: any = company(o.cid || State.companyId) || company(), SC = saluteScene(T, o, c), cam = new T.PerspectiveCamera(34, W / H, 0.5, 4000);
    // a different photo for each article: where the photographer stood, how far through the arch the aircraft is
    const rnd = salRnd(key), S = SC.s, hf = SC.half, ap = Math.max(24, S.H + 13);
    const shots: [number[], number[], number, number][] = [
      [[-Math.max(70, hf * 2.5), 3.4, -hf * 0.35], [0, Math.max(9, S.H * 0.9), 0], 34, S.L * (rnd() - 0.5) * 0.24],                       // low on the taxiway ahead
      [[-hf * 3.4, 5, hf * 1.3], [0, ap * 0.45, 0], 34, S.L * (rnd() - 0.5) * 0.24],                                     // from the grass, ahead and to the side
      [[-95, 38, -75], [0, ap * 0.3, 0], 32, S.L * (rnd() - 0.5) * 0.24],                                                       // from the tower, high above the apron
      [[hf * 2.4, 5, -hf * 1.1], [0, ap * 0.42, 0], 36, S.L * (rnd() - 0.5) * 0.24],                                    // behind, as it comes out
      [[-hf * 3.6, 9, -hf * 1.6], [0, ap * 0.4, 0], 26, S.L * (rnd() - 0.5) * 0.24],                                           // long lens from far ahead
    ];
    rnd(); rnd(); const sh = shots[Math.floor(rnd() * shots.length)];
    cam.fov = sh[2]; cam.updateProjectionMatrix();
    SC.ac.position.set(sh[3], 0, 0);
    for (const j of SC.jets) { j.material.uniforms.uTime.value = 30 + rnd() * 20; j.material.uniforms.uOn.value = 1; j.material.uniforms.uScale.value = H / (2 * Math.tan(sh[2] / 2 * D2R)); }
    for (const tk of SC.trucks) tk.userData.flash && tk.userData.flash(rnd());
    cam.position.set(sh[0][0], sh[0][1], sh[0][2]); cam.lookAt(sh[1][0], sh[1][1], sh[1][2]);
    R.render(SC.sc, cam);
    url = cv.toDataURL('image/jpeg', 0.86);
    SC.sc.traverse((m: any) => { if (m.geometry) m.geometry.dispose(); if (m.material) { const ms = Array.isArray(m.material) ? m.material : [m.material]; ms.forEach((x: any) => { if (x.map) x.map.dispose(); x.dispose(); }); } });
    R.dispose(); try { R.forceContextLoss(); } catch (e) { /* gone */ }
  } catch (e) { url = ''; }
  return (_salPhotos[key] = url);
}

/* ---------- the 3D salute ---------- */

const Salute: any = { on: false };

/** A repeatable random series (the same article always gets the same photo, each article its own). */
function salRnd(seed: string): () => number { let h = (_hashStr(seed || 'x') ^ Math.imul(_hashStr((seed || 'x') + '#'), 0x9E3779B1)) >>> 0; return () => { h = (h + 0x6D2B79F5) >>> 0; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** The two-letter country code of an airport (the airport list keeps the country's name). */
function salCc(A: any): string {
  const n = String((A && A.country) || ''); if (/^[A-Z]{2}$/.test(n)) return n;
  try { const C: any = (World as any).countries || {}; for (const k in C) if (C[k] === n) return k; } catch (e) { /* not loaded */ }
  return '';
}
/** What the land around an airport looks like: grass, tundra, sand, tropical green or snow, and how hilly. */
function salLand(A: any, at: number): { grass: string; snow: boolean; hills: number; rock: string } {
  const lat = A && A.pos ? A.pos[1] : 50, cc = salCc(A), mo = new Date(at).getUTCMonth(), winter = lat >= 0 ? (mo >= 10 || mo <= 2) : (mo >= 5 && mo <= 7);
  const elev = (A && A.elev) || 0, al = Math.abs(lat);
  const MOUNT = /^(FO|NO|IS|GL|CH|AT|NP|BT|PE|BO|NZ|CL|AD|LI|KG|TJ|GE|AM|SJ|CA|LS)$/, DESERT = /^(SA|AE|QA|KW|BH|OM|EG|LY|DZ|JO|IQ|NE|ML|TD|SD|MR|EH|YE|NA|BW)$/;
  const snow = cc === 'GL' || cc === 'SJ' || cc === 'AQ' || (winter && (al > 63 || elev > 5000 || (al > 55 && /^(FI|SE|NO|RU|CA|IS)$/.test(cc))));
  const hills = MOUNT.test(cc) ? 1 : elev > 3000 ? 0.8 : 0.3;
  const grass = snow ? '#E6EBEF' : DESERT.test(cc) ? '#C8B184' : al > 62 ? '#7C7F5C' : al < 23 ? '#4E7A38' : cc === 'FO' || cc === 'IE' ? '#5E8248' : '#6A7F4E';
  return { grass, snow, hills, rock: snow ? '#D9DEE3' : cc === 'FO' || cc === 'IS' ? '#4C5640' : DESERT.test(cc) ? '#B39A70' : '#6D7462' };
}

/** A runway as a texture: asphalt, the dashed centre line, the threshold bars and the numbers at each end. */
function salRunwayTex(T: any, id1: string, id2: string, lenM: number): any {
  const W = 128, H = 2048, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
  g.fillStyle = '#3E4146'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 4000; i++) { const k = 50 + Math.random() * 40; g.fillStyle = `rgba(${k},${k},${k},.35)`; g.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5); }
  g.fillStyle = '#F4F4F2'; g.fillRect(3, 0, 2, H); g.fillRect(W - 5, 0, 2, H);
  const px = H / Math.max(600, lenM);   // pixels per metre along the runway
  for (let y = 60 * px + 90; y < H - 60 * px - 90; y += 60 * px) g.fillRect(W / 2 - 1.5, y, 3, 30 * px);
  const ends = [[id1, 0, 1], [id2, H, -1]] as [string, number, number][];
  for (const [id, y0, d] of ends) {
    for (let k = 0; k < 8; k++) g.fillRect(10 + k * 14.5 - (k >= 4 ? -6 : 0), y0 + d * 8 - (d < 0 ? 40 : 0), 7, 40);
    g.save(); g.translate(W / 2, y0 + d * 78); if (d < 0) g.rotate(Math.PI); g.font = '700 34px Inter, sans-serif'; g.textAlign = 'center'; g.fillText(String(id || ''), 0, 0); g.restore();
  }
  const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t;
}

/** The scene at the real airport: its runways where they are (the taxiway the salute is on runs beside the runway
 *  in use), its name on the terminal, the land around it, and the sun and the sky as they are there at that time.
 *  The aircraft's middle is at x = 0, the taxiway along x, the trucks either side on z. */
function saluteScene(T: any, o: { typeId: string; icao?: string; at?: number }, c: any) {
  const sc = new T.Scene(), A: any = apt(o.icao || '') || null, at = o.at || Date.now();
  const lat0 = A ? A.pos[1] : 50, lon0 = A ? A.pos[0] : 0;
  // the runway in use, and the taxiway beside it (180 m to its right)
  let re: RunwayEnd = null; try { re = A ? activeRunway(o.icao) : null; } catch (e) { re = null; }
  const h = re ? re.hdg : 90, hs = Math.sin(h * D2R), hc = Math.cos(h * D2R), kx = Math.cos(lat0 * D2R) * 111320, ky = 110540;
  let oE = 0, oN = 0;
  if (re) { const mE = ((re.thr[0] + re.end[0]) / 2 - lon0) * kx, mN = ((re.thr[1] + re.end[1]) / 2 - lat0) * ky; oE = mE + hc * 180; oN = mN - hs * 180; }
  const toScene = (lon: number, lat: number) => { const E = (lon - lon0) * kx - oE, N = (lat - lat0) * ky - oN; return [-(E * hs + N * hc), -(E * hc - N * hs)]; };
  const dirScene = (E: number, N: number) => [-(E * hs + N * hc), -(E * hc - N * hs)];
  // the sun where and when it is (never quite below the horizon in the picture: dusk at the darkest)
  let sAlt = 35, sAz = 200;
  try { const d = astroD(at), su = astroSun(d), p = astroAltAz(su.ra, su.dec, lat0, astroLst(d, lon0)); sAlt = p.alt; sAz = p.az; } catch (e) { /* daytime */ }
  let wx: any = null; try { wx = LiveWx.get(o.icao || ''); } catch (e) { wx = null; }
  const ovc = wx && /IFR|LIFR/.test(wx.cat || '') ? 1 : wx && wx.ceil != null && wx.ceil < 5000 ? 0.6 : 0;
  const day = clamp((sAlt + 4) / 16, 0, 1), dusk = clamp(1 - Math.abs(sAlt - 2) / 10, 0, 1) * (1 - ovc * 0.7);
  const L = salLand(A, at);
  const mix = (a: string, b: string, k: number) => { const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16); const ch = (s: number) => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k); return '#' + ((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0'); };
  const top = mix(mix('#0E1A33', '#3F7FC4', day), '#7D8894', ovc * 0.8), hor = mix(mix(mix('#24324A', '#D7E4EF', day), '#E9A066', dusk * 0.8), '#B9C1C8', ovc * 0.8);
  sc.fog = new T.Fog(new T.Color(hor).getHex(), 260 - ovc * 120, 1700 - ovc * 700);
  const skyC = document.createElement('canvas'); skyC.width = 4; skyC.height = 256; const sg = skyC.getContext('2d'), gr = sg.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, top); gr.addColorStop(0.42, mix(top, hor, 0.55)); gr.addColorStop(0.5, hor); gr.addColorStop(1, mix(hor, '#8A8F94', 0.4)); sg.fillStyle = gr; sg.fillRect(0, 0, 4, 256);
  const skyT = new T.CanvasTexture(skyC); skyT.colorSpace = T.SRGBColorSpace;
  sc.add(new T.Mesh(new T.SphereGeometry(1900, 32, 16), new T.MeshBasicMaterial({ map: skyT, side: T.BackSide, fog: false })));
  sc.add(new T.HemisphereLight(new T.Color(mix('#55688A', '#DDEBFF', day)).getHex(), new T.Color(L.snow ? '#9AA4AE' : '#5B6B4A').getHex(), Math.max(1.0, 0.55 + day * 0.7)));
  const sunCol = mix(mix('#FF9A55', '#FFF2DC', clamp((sAlt - 2) / 18, 0, 1)), '#DDE3EA', ovc);
  const sun = new T.DirectionalLight(new T.Color(sunCol).getHex(), (0.5 + day * 2.1) * (1 - ovc * 0.6));
  const el = Math.max(sAlt, 6) * D2R, sv = dirScene(Math.cos(el) * Math.sin(sAz * D2R), Math.cos(el) * Math.cos(sAz * D2R));
  sun.position.set(sv[0] * 120, Math.sin(el) * 120, sv[1] * 120); sun.castShadow = ovc < 0.9;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -90, right: 90, top: 90, bottom: -90, near: 1, far: 400 }); sun.shadow.bias = -0.0004;
  sc.add(sun); sc.add(sun.target);
  if (day < 0.5) { const fl = new T.DirectionalLight(0xFFD7A8, 1.6 * (1 - day * 2)); fl.position.set(-40, 60, -160); sc.add(fl); sc.add(fl.target); }   // the apron floodlights at night
  // the land
  const grassC = document.createElement('canvas'); grassC.width = grassC.height = 256; const gg = grassC.getContext('2d');
  gg.fillStyle = L.grass; gg.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) { const v = (Math.random() - 0.5) * 50; gg.fillStyle = `rgba(${128 + v},${128 + v},${128 + v},.12)`; gg.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
  const grassT = new T.CanvasTexture(grassC); grassT.wrapS = grassT.wrapT = T.RepeatWrapping; grassT.repeat.set(160, 160); grassT.colorSpace = T.SRGBColorSpace;
  const ground = new T.Mesh(new T.PlaneGeometry(4000, 4000), new T.MeshStandardMaterial({ map: grassT, roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; sc.add(ground);
  // hills or mountains around (steeper where the country is mountainous), in their place for the airport
  const rr = salRnd('hills' + (o.icao || '')), rockM = new T.MeshStandardMaterial({ color: new T.Color(L.rock).getHex(), roughness: 1, flatShading: true });
  for (let i = 0; i < 26; i++) {
    const ang = rr() * Math.PI * 2, dist = 900 + rr() * 900, hh = (30 + rr() * 260) * L.hills, rad = hh * (1.6 + rr() * 1.6) + 120;
    const hill = new T.Mesh(new T.ConeGeometry(rad, hh, 7 + Math.floor(rr() * 4), 1), rockM); hill.position.set(Math.cos(ang) * dist, hh / 2 - 2, Math.sin(ang) * dist); hill.rotation.y = rr() * 3; sc.add(hill);
  }
  const asC = document.createElement('canvas'); asC.width = asC.height = 256; const ag = asC.getContext('2d');
  ag.fillStyle = '#4A4D52'; ag.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5000; i++) { const k = 60 + Math.random() * 40; ag.fillStyle = `rgba(${k},${k},${k + 4},.4)`; ag.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 1.5); }
  const asT = new T.CanvasTexture(asC); asT.wrapS = asT.wrapT = T.RepeatWrapping; asT.repeat.set(40, 2); asT.colorSpace = T.SRGBColorSpace;
  const twy = new T.Mesh(new T.PlaneGeometry(900, 26), new T.MeshStandardMaterial({ map: asT, roughness: 0.92 })); twy.rotation.x = -Math.PI / 2; twy.position.y = 0.12; twy.receiveShadow = true; sc.add(twy);
  const apron = new T.Mesh(new T.PlaneGeometry(900, 160), new T.MeshStandardMaterial({ map: asT, roughness: 0.92, color: 0xC8C8C8 })); apron.rotation.x = -Math.PI / 2; apron.position.set(0, 0.08, -150); apron.receiveShadow = true; sc.add(apron);
  const cl = new T.Mesh(new T.PlaneGeometry(900, 0.3), new T.MeshBasicMaterial({ color: 0xE8B623 })); cl.rotation.x = -Math.PI / 2; cl.position.y = 0.17; sc.add(cl);
  for (const z of [-11.5, 11.5]) { const e = new T.Mesh(new T.PlaneGeometry(900, 0.18), new T.MeshBasicMaterial({ color: 0xE8B623 })); e.rotation.x = -Math.PI / 2; e.position.set(0, 0.17, z); sc.add(e); }
  const lampG = new T.CylinderGeometry(0.12, 0.12, 0.4, 8), lampM = new T.MeshBasicMaterial({ color: 0x3A6BFF });
  for (let x = -440; x <= 440; x += 30) for (const z of [-13.5, 13.5]) { const l = new T.Mesh(lampG, lampM); l.position.set(x, 0.2, z); sc.add(l); }
  // the airport's own runways, where they are
  const rows: any[] = A ? (((World.runways || {}) as any)[o.icao] || []) : [];
  for (const r of rows) {
    const [id1, id2, lenFt, widFt, , la1, lo1, la2, lo2] = r; if (la1 == null || la2 == null) continue;
    const p1 = toScene(lo1, la1), p2 = toScene(lo2, la2), len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]); if (len < 200) continue;
    const wid = Math.max(18, (widFt || 148) * 0.3048), m = new T.Mesh(new T.PlaneGeometry(wid, len), new T.MeshStandardMaterial({ map: salRunwayTex(T, id1, id2, (lenFt || 6000) * 0.3048), roughness: 0.9 }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = Math.atan2(p2[0] - p1[0], p2[1] - p1[1]) + Math.PI; m.position.set((p1[0] + p2[0]) / 2, 0.1, (p1[1] + p2[1]) / 2); m.receiveShadow = true; sc.add(m);
  }
  if (!rows.length) { const m = new T.Mesh(new T.PlaneGeometry(2400, 45), new T.MeshStandardMaterial({ color: 0x3E4146, roughness: 0.9 })); m.rotation.x = -Math.PI / 2; m.position.set(0, 0.03, 180); sc.add(m); }
  // the terminal with the airport's name on it, and the tower
  const bM = new T.MeshStandardMaterial({ color: 0xD9DDE2, roughness: 0.7 }), gM = new T.MeshStandardMaterial({ color: 0x3C5A78, roughness: 0.15, metalness: 0.5, emissive: day < 0.4 ? 0xFFD9A0 : 0x000000, emissiveIntensity: day < 0.4 ? 0.5 : 0 });
  const big = A && A.size === 2, rb = salRnd('term' + (o.icao || ''));
  const blocks = big ? [[-140, 220, 46, 20], [100, 170, 40, 16], [290, 110, 34, 12]] : [[-60 + rb() * 40, 110, 30, 10], [80 + rb() * 40, 60, 24, 8]];
  for (const [x, w, d, hh] of blocks) {
    const b = new T.Mesh(new T.BoxGeometry(w, hh, d), bM); b.position.set(x, hh / 2, -260); b.castShadow = true; sc.add(b);
    const g = new T.Mesh(new T.BoxGeometry(w + 0.2, hh * 0.45, d + 0.2), gM); g.position.set(x, hh * 0.55, -260); sc.add(g);
  }
  if (A) {
    const nc = document.createElement('canvas'); nc.width = 1024; nc.height = 128; const ng = nc.getContext('2d');
    ng.fillStyle = '#1C2B3E'; ng.fillRect(0, 0, 1024, 128); ng.fillStyle = '#FFFFFF'; ng.font = '700 58px Inter, sans-serif'; ng.textAlign = 'center'; ng.textBaseline = 'middle';
    let nm = String(A.name || o.icao); while (ng.measureText(nm).width > 980 && nm.length > 8) nm = nm.slice(0, -2); ng.fillText(nm, 512, 66);
    const nt = new T.CanvasTexture(nc); nt.colorSpace = T.SRGBColorSpace;
    const [x, w, d, hh] = blocks[0], sign = new T.Mesh(new T.PlaneGeometry(Math.min(w * 0.8, 90), Math.min(w * 0.8, 90) / 8), new T.MeshBasicMaterial({ map: nt, fog: true }));
    sign.position.set(x, hh + 4, -260 + d / 2 + 0.5); sc.add(sign);
    const post = new T.Mesh(new T.BoxGeometry(Math.min(w * 0.8, 90), 0.6, 0.6), bM); post.position.set(x, hh + 0.3, -260 + d / 2); sc.add(post);
  }
  const tx = 150 + rb() * 120, tw = new T.Mesh(new T.CylinderGeometry(3, 4, big ? 60 : 30, 16), bM); tw.position.set(tx, big ? 30 : 15, -330); sc.add(tw);
  const twc = new T.Mesh(new T.CylinderGeometry(8, 6, 7, 12), gM); twc.position.set(tx, big ? 63 : 33, -330); sc.add(twc);
  // the aircraft, in the airline's livery
  const typeId = o.typeId || 'a320neo', s: any = shapeOf(typeId);
  let model: any = null;
  try { model = buildAircraftModel(typeId, liveryFor(c && c.color, c && c.color2, c && c.id)); model.userData.set && model.userData.set({ flaps: 0, gear: 1 }); } catch (e) { model = new T.Group(); }
  model.traverse((m: any) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  const ac = new T.Group(); model.position.x = -s.L / 2; ac.add(model); sc.add(ac);
  const prop = !!(acType(typeId) && !(perfFor(acType(typeId)) as any).jet);
  // the trucks: one on each side, facing along the taxiway, their cannons aimed over the middle
  const half = Math.max(30, s.span / 2 + 14), apex = Math.max(24, s.H + 13), G = 9.81;
  const trucks: any[] = [], jets: any[] = [];
  for (const side of [1, -1]) {
    const tk = saluteTruck(T); tk.position.set(0, 0, side * half); tk.rotation.y = side > 0 ? 0 : Math.PI; sc.add(tk); trucks.push(tk);
    const nz = new T.Vector3(side > 0 ? -2.6 : 2.6, 5.0, side * (half - 0.9));   // the tip of the cannon on the cab roof
    // a jet that rises to the apex above the middle of the taxiway and comes down on the far side
    const vy = Math.sqrt(2 * G * (apex - nz.y)), ta = vy / G, vz = -side * (half - 0.9) / ta;
    const life = (vy + Math.sqrt(vy * vy + 2 * G * nz.y)) / G;
    const pitch = Math.atan2(vy, Math.abs(vz)), mon = tk.userData.monitor; if (mon) mon.userData.aim(pitch);
    for (const [n, size, spread, alpha, col] of [[9000, 0.28, 0.9, 0.85, 0xF2FAFF], [2600, 1.1, 2.2, 0.32, 0xDDEFFF], [900, 4.5, 4.0, 0.075, 0xFFFFFF]] as number[][]) {
      const pts = saluteJet(T, n, { origin: nz, vel: new T.Vector3(0, vy, vz), life, size, spread, alpha, color: col });
      sc.add(pts); jets.push(pts);
    }
  }
  return { sc, ac, model, jets, trucks, half, s, prop };
}

/** The salute in 3D: about 40 seconds, from the trucks starting to spray to the aircraft taxiing away. */
function saluteOpen(o: { typeId: string; reg: string; icao: string; cid?: string; at?: number }) {
  const T = THREE; if (!T) { toast('3D is not available on this device', 'warn'); return; }
  saluteClose();
  const c: any = company(o.cid || State.companyId) || company(), A: any = apt(o.icao) || { name: o.icao, city: '' };
  const host = document.createElement('div'); host.className = 'sal3d';
  host.innerHTML = `<canvas></canvas><div class="sal-cap"><b>Water salute · ${esc(A.name)}</b><small>${esc(c ? c.name : '')} · ${esc(o.reg)} · first visit to ${esc(A.city || o.icao)}</small></div>
    <div class="sal-btns"><button class="btn sm ghost" data-act="sal-replay">${icon('reload')}Watch again</button><button class="btn sm" data-act="sal-close">${icon('close')}Close</button></div>`;
  document.body.appendChild(host);
  const cv = host.querySelector('canvas') as HTMLCanvasElement;
  let R: any;
  try { R = new T.WebGLRenderer({ canvas: cv, antialias: true }); } catch (e) { host.remove(); toast('3D is not available on this device', 'warn'); return; }
  R.setPixelRatio(Gfx.pr(Math.min(2, window.devicePixelRatio || 1))); R.outputColorSpace = T.SRGBColorSpace;
  R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = 1.05; R.shadowMap.enabled = true; R.shadowMap.type = T.PCFSoftShadowMap;
  const cam = new T.PerspectiveCamera(40, 1, 1, 4000);
  const SC = saluteScene(T, o, c), sc = SC.sc, ac = SC.ac, model = SC.model, jets = SC.jets, trucks = SC.trucks, half = SC.half, s = SC.s, prop = SC.prop;
  // a little sound: the rush of the water
  let snd: any = null;
  try {
    const ctx = audio(); if (ctx && (State.settings as any).sounds !== false) {
      const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1200; bp.Q.value = 0.6;
      const g = ctx.createGain(); g.gain.value = 0; src.connect(bp); bp.connect(g); g.connect(ctx.destination); src.start();
      snd = { ctx, src, g };
    }
  } catch (e) { snd = null; }
  // the film: shots that follow the aircraft through the arch
  const SPD = 6.2, X0 = 150, DUR = 40;
  const shots: { t: number; cam: (t: number, x: number) => number[][] }[] = [
    { t: 0, cam: (t) => [[-120 + t * 3, 16 - t * 0.4, 88 - t * 1.2], [10, 14, 0]] },
    { t: 8, cam: (t, x) => [[-70, 2.4, 9], [x, 4 + s.H * 0.25, 0]] },
    { t: 17, cam: (t, x) => [[x + 10 - (t - 17) * 1.2, 8 + (t - 17) * 0.3, half + 72], [x - 4, 12, 0]] },
    { t: 27, cam: (t, x) => [[-95 + (t - 27) * 1.5, 3.2, -16], [x + 6, 7 + s.H * 0.2, 0]] },
    { t: 34, cam: (t, x) => [[-30 - (t - 34) * 3, 42, 95], [x * 0.6, 10, 0]] },
  ];
  const t0 = performance.now();
  Salute.on = true; Salute.start = t0; Salute.host = host; Salute.R = R; Salute.snd = snd;
  const resize = () => { const w = host.clientWidth, h = host.clientHeight; R.setSize(w, h, false); cam.aspect = w / Math.max(1, h); cam.updateProjectionMatrix(); for (const j of jets) j.material.uniforms.uScale.value = h * R.getPixelRatio() / (2 * Math.tan(cam.fov * D2R / 2)); };
  resize(); window.addEventListener('resize', resize); Salute.resize = resize;
  const frame = () => {
    if (!Salute.on || Salute.host !== host) return;
    const t = Salute.fix != null ? Salute.fix : (performance.now() - Salute.start) / 1000, tt = t % (DUR + 2);
    const x = X0 - SPD * Math.max(0, tt - 1.5);
    ac.position.set(x, 0, 0);
    if (prop && model.userData.set) try { model.userData.set({ prop: tt * 40 }); } catch (e) { /* static */ }
    // the water starts in the first seconds and keeps going until the aircraft is well through
    const on = clamp(tt / 2.5, 0, 1) * (1 - clamp((tt - (DUR - 3)) / 3, 0, 1));
    for (const j of jets) { j.material.uniforms.uTime.value = t; j.material.uniforms.uOn.value = on; }
    for (const tk of trucks) tk.userData.flash && tk.userData.flash(t);
    if (snd) try { snd.g.gain.setTargetAtTime(0.11 * on, snd.ctx.currentTime, 0.3); } catch (e) { /* closed */ }
    let sh = shots[0]; for (const q of shots) if (tt >= q.t) sh = q;
    const [p, at] = sh.cam(tt, x); cam.position.set(p[0], p[1], p[2]); cam.lookAt(at[0], at[1], at[2]);
    R.render(sc, cam);
    Salute.raf = requestAnimationFrame(frame);
  };
  frame();
  Sound.tick();
}

/** An airport fire truck (a six-wheeled crash tender): red with a white band, a big windscreen, light bars and
 *  a water cannon on the cab roof. Faces along -x; 11 m long. */
function saluteTruck(T: any): any {
  const g = new T.Group();
  const red = new T.MeshStandardMaterial({ color: 0xC21D26, roughness: 0.35, metalness: 0.2 });
  const dark = new T.MeshStandardMaterial({ color: 0x24272C, roughness: 0.8 });
  const white = new T.MeshStandardMaterial({ color: 0xF2F2F2, roughness: 0.4 });
  const glass = new T.MeshStandardMaterial({ color: 0x1D2C3C, roughness: 0.08, metalness: 0.6 });
  const steel = new T.MeshStandardMaterial({ color: 0xB9BEC4, roughness: 0.3, metalness: 0.8 });
  const box = (w: number, h: number, d: number, m: any, x: number, y: number, z: number) => { const b = new T.Mesh(new T.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; b.receiveShadow = true; g.add(b); return b; };
  box(11, 0.7, 2.6, dark, 0.2, 1.05, 0);                 // chassis
  box(7.6, 2.6, 3.0, red, 1.9, 2.55, 0);                 // body with the tank
  box(3.4, 2.5, 3.0, red, -3.6, 2.45, 0);                // cab
  const ws = box(0.12, 1.5, 2.8, glass, -5.36, 2.95, 0); ws.rotation.z = -0.32;   // windscreen
  for (const z of [-1.51, 1.51]) { box(1.6, 1.0, 0.04, glass, -3.9, 3.0, z); box(10.8, 0.28, 0.04, white, 0.3, 2.0, z); box(7.4, 0.12, 0.04, steel, 1.9, 1.5, z); }
  box(0.1, 0.5, 2.6, steel, -5.45, 1.3, 0);              // bumper
  for (const [x, z] of [[-3.8, 1], [-3.8, -1], [2.2, 1], [2.2, -1], [4.1, 1], [4.1, -1]]) {
    const w = new T.Mesh(new T.CylinderGeometry(0.72, 0.72, 0.55, 20), dark); w.rotation.x = Math.PI / 2; w.position.set(x, 0.72, z * 1.33); w.castShadow = true; g.add(w);
    const hub = new T.Mesh(new T.CylinderGeometry(0.32, 0.32, 0.57, 12), steel); hub.rotation.x = Math.PI / 2; hub.position.copy(w.position); g.add(hub);
  }
  // light bars: blue, flashing
  const blueA = new T.MeshStandardMaterial({ color: 0x1030A0, emissive: 0x2050FF, emissiveIntensity: 0 }), blueB = blueA.clone();
  box(0.35, 0.18, 1.2, blueA, -4.6, 3.8, 0.7); box(0.35, 0.18, 1.2, blueB, -4.6, 3.8, -0.7);
  box(0.3, 0.16, 0.8, blueB, 5.6, 3.95, 0.9); box(0.3, 0.16, 0.8, blueA, 5.6, 3.95, -0.9);
  g.userData.flash = (t: number) => { const k = Math.floor(t * 6) % 2; blueA.emissiveIntensity = k ? 3 : 0.1; blueB.emissiveIntensity = k ? 0.1 : 3; };
  // the roof cannon: it turns towards the taxiway (+z of the truck) and points up
  const mon = new T.Group(); mon.position.set(-2.6, 3.8, 0.0);
  const base = new T.Mesh(new T.CylinderGeometry(0.28, 0.34, 0.4, 14), steel); base.position.y = 0.2; mon.add(base);
  const barrel = new T.Group(); barrel.position.y = 0.42; mon.add(barrel);
  const tube = new T.Mesh(new T.CylinderGeometry(0.1, 0.14, 1.3, 12), steel); tube.position.y = 0.65; barrel.add(tube);
  const tip = new T.Mesh(new T.CylinderGeometry(0.16, 0.1, 0.25, 12), red); tip.position.y = 1.35; barrel.add(tip);
  g.add(mon);
  g.userData.monitor = mon;
  // the taxiway is on the truck's left (its local -z): the cannon leans that way, raised to the given angle
  mon.userData.aim = (pitch: number) => { barrel.rotation.x = -(Math.PI / 2 - pitch); };
  try { Models.swap(g, "vehicles/fire-truck.glb"); } catch (e) { /* the app's own truck */ }
  return g;
}

/** One jet of water as droplets: each is thrown from the cannon at its own moment with a little scatter and
 *  falls on its arc (worked out on the graphics card); later in its flight it breaks into larger, fainter spray. */
function saluteJet(T: any, n: number, o: { origin: any; vel: any; life: number; size: number; spread: number; alpha: number; color: number }): any {
  const geo = new T.BufferGeometry(), pos = new Float32Array(n * 3), seed = new Float32Array(n * 4);
  const rn = () => { let u = 0; for (let k = 0; k < 3; k++) u += Math.random(); return (u - 1.5) / 1.5; };   // about normal
  for (let i = 0; i < n; i++) { seed[i * 4] = Math.random(); seed[i * 4 + 1] = rn(); seed[i * 4 + 2] = rn(); seed[i * 4 + 3] = rn(); }
  geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('aSeed', new T.BufferAttribute(seed, 4));
  geo.boundingSphere = new T.Sphere(new T.Vector3(0, 20, 0), 200);
  const mat = new T.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true,
    uniforms: Object.assign(T.UniformsUtils.clone(T.UniformsLib.fog), {
      uTime: { value: 0 }, uOn: { value: 0 }, uOrigin: { value: o.origin }, uVel: { value: o.vel }, uLife: { value: o.life },
      uSize: { value: o.size }, uSpread: { value: o.spread }, uAlpha: { value: o.alpha }, uColor: { value: new T.Color(o.color) }, uScale: { value: 600 },
    }),
    vertexShader: `
      attribute vec4 aSeed; uniform float uTime, uLife, uSize, uSpread, uScale, uOn; uniform vec3 uOrigin, uVel;
      varying float vA; varying float vAge;
      #include <fog_pars_vertex>
      void main() {
        float life = uLife * (1.0 + aSeed.y * 0.05);
        float t = fract(uTime / life + aSeed.x) * life, age = t / life;
        vec3 v = uVel * (1.0 + aSeed.y * 0.025) + vec3(aSeed.z, aSeed.w * 0.6, aSeed.z * 0.4 - aSeed.w * 0.3) * uSpread * (0.12 + age * 1.3);
        vec3 p = uOrigin + v * t + vec3(0.0, -4.905 * t * t, 0.0);
        // falling spray slows in the air: a little drift with the breeze
        p.x += age * age * 6.0;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float sz = uSize * (0.6 + age * 1.8) * (0.7 + abs(aSeed.w) * 0.6);
        gl_PointSize = max(1.0, sz * uScale / -mv.z);
        vA = smoothstep(0.0, 0.04, age) * (1.0 - smoothstep(0.7, 1.0, age)) * step(0.0, p.y) * uOn;
        vAge = age;
        vec4 mvPosition = mv;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uAlpha; varying float vA; varying float vAge;
      #include <fog_pars_fragment>
      void main() {
        vec2 q = gl_PointCoord - 0.5; float r = dot(q, q) * 4.0; if (r > 1.0) discard;
        float a = (1.0 - r) * vA * uAlpha;
        vec3 c = mix(uColor, vec3(0.80, 0.90, 1.0), vAge * 0.6) + (1.0 - r) * 0.15;
        gl_FragColor = vec4(c, a);
        #include <fog_fragment>
      }`,
  });
  const p = new T.Points(geo, mat); p.frustumCulled = false; return p;
}

function saluteClose() {
  if (!Salute.on && !Salute.host) return;
  Salute.on = false; cancelAnimationFrame(Salute.raf);
  try { if (Salute.snd) { Salute.snd.g.gain.setTargetAtTime(0, Salute.snd.ctx.currentTime, 0.1); const s = Salute.snd.src; setTimeout(() => { try { s.stop(); } catch (e) { /* stopped */ } }, 400); } } catch (e) { /* none */ }
  try { window.removeEventListener('resize', Salute.resize); } catch (e) { /* none */ }
  try { Salute.R && Salute.R.dispose(); Salute.R && Salute.R.forceContextLoss && Salute.R.forceContextLoss(); } catch (e) { /* gone */ }
  if (Salute.host) Salute.host.remove();
  Salute.host = null; Salute.R = null; Salute.snd = null;
}
ACTIONS['sal-close'] = () => saluteClose();
ACTIONS['sal-replay'] = () => { Salute.start = performance.now(); };
ACTIONS['sal-watch'] = el => {
  const a: any = newsList().filter(x => x.id === el.getAttribute('data-id'))[0]; if (!a) return;
  try { ACTIONS['close-layer'](el, null); } catch (e) { /* none open */ }
  saluteOpen({ typeId: a.art.typeId, reg: a.art.reg, icao: a.art.icao, cid: a.art.cid, at: a.at });
};
