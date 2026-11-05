// Your museum: a hall where everything your airline and you have been given or earned stands on display, each on
// its own plinth under a spotlight with a brass name plate: the gifts and plaques from the airports, your career
// awards (certificates, plaques, medals) and your best badges as medals. Walk round it (W A S D or the arrows,
// drag to look, the on-screen pad on a phone or tablet, the left stick and the right stick on a controller), and
// tap an object, or press Enter or Cross in front of one, to take it in your hands and turn it round.

const Museum: any = { on: false };

/** What goes on display: [title, sub, builder, opener]. */
function museumItems(): { title: string; sub: string; build: (T: any) => any; open: () => void }[] {
  const out: any[] = [];
  for (const ex of giftsAll().slice(0, 40)) {
    const A: any = apt(ex.icao) || { name: ex.icao };
    ex.received.forEach((it, i) => out.push({ title: it.name, sub: ex.cat === 'career' ? 'Awarded ' + dateStr(new Date(ex.at)).slice(0, 10) : 'From ' + A.name, build: (T: any) => giftBuild(T, it, ex),
      open: () => { const b = document.createElement('b'); b.setAttribute('data-id', ex.id); b.setAttribute('data-side', 'received'); b.setAttribute('data-i', String(i)); ACTIONS['gift-3d'](b, null); } }));
  }
  const earned = ((State as any).badges || {}) as any;
  const best = badgeDefs().filter(b => earned[b.id]).sort((a, b) => b.tier - a.tier || earned[b.id] - earned[a.id]).slice(0, 12);
  for (const b of best) out.push({ title: b.title, sub: TIER_NAMES[b.tier] + ' badge', build: (T: any) => badgeMedal(T, b, earned[b.id]), open: () => { const e = document.createElement('b'); e.setAttribute('data-id', b.id); ACTIONS['badge-3d'](e, null); } });
  return out.slice(0, 36);
}

function museumOpen() {
  const T = typeof THREE !== 'undefined' ? THREE : null; if (!T) { toast('3D is not available on this device', 'warn'); return; }
  museumClose();
  const items = museumItems();
  const host = document.createElement('div'); host.className = 'mus';
  host.innerHTML = `<canvas></canvas><div class="mus-head"><b>${esc((company() as any).name)} museum</b><small>${items.length ? `${items.length} pieces on display · tap one to hold it` : 'Nothing on display yet: gifts, awards and badges appear here'}</small></div>
    <button class="v3v-x" data-act="mus-close" aria-label="Leave the museum (Esc)">${icon('close')}<small>Esc</small></button>
    <div class="mus-pad"><button data-mv="f">▲</button><button data-mv="l">◀</button><button data-mv="b">▼</button><button data-mv="r">▶</button></div>
    <div class="mus-hint">W A S D or the arrows to walk · drag to look · Enter or tap to hold a piece · Esc to leave</div>`;
  document.body.appendChild(host);
  const cv = host.querySelector('canvas') as HTMLCanvasElement;
  let R: any; try { R = new T.WebGLRenderer({ canvas: cv, antialias: true }); } catch (e) { host.remove(); toast('3D is not available on this device', 'warn'); return; }
  R.setPixelRatio(Gfx.pr(Math.min(hiQ() ? 2 : 1.6, window.devicePixelRatio || 1))); if (hiQ()) R.shadowMap.type = T.PCFSoftShadowMap; R.outputColorSpace = T.SRGBColorSpace; R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = 1.05; R.shadowMap.enabled = true;
  const sc = new T.Scene(); sc.background = new T.Color(0x0C0F14); sc.fog = new T.Fog(0x0C0F14, 18, 60);
  v3vStudio(T, R, sc, true);
  // the hall: a polished dark floor, walls in a soft grey, a ceiling with light strips
  const cols = Math.max(3, Math.min(6, Math.ceil(Math.sqrt(items.length || 1)))), rows = Math.max(1, Math.ceil((items.length || 1) / cols)), gapX = 4.2, gapZ = 4.6;
  const W = cols * gapX + 6, D = rows * gapZ + 8;
  const floor = new T.Mesh(new T.PlaneGeometry(W, D), new T.MeshStandardMaterial({ color: 0x0E1014, roughness: 0.3, metalness: 0.2, envMapIntensity: 0.4 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; sc.add(floor);
  const wallM = new T.MeshStandardMaterial({ color: 0x1E232A, roughness: 0.95, envMapIntensity: 0.3 });
  for (const [x, z, w, r] of [[0, -D / 2, W, 0], [0, D / 2, W, Math.PI], [-W / 2, 0, D, Math.PI / 2], [W / 2, 0, D, -Math.PI / 2]] as number[][]) { const m = new T.Mesh(new T.PlaneGeometry(w, 7), wallM); m.position.set(x, 3.5, z); m.rotation.y = r; sc.add(m); }
  const ceil = new T.Mesh(new T.PlaneGeometry(W, D), new T.MeshStandardMaterial({ color: 0x15181C })); ceil.rotation.x = Math.PI / 2; ceil.position.y = 7; sc.add(ceil);
  // the airline's name on the far wall
  const [nc, nx] = v3vCanvas(1024, 160); nx.fillStyle = '#E9C873'; nx.font = '700 72px Georgia, serif'; nx.textAlign = 'center'; nx.fillText(String((company() as any).name).toUpperCase(), 512, 105);
  const nm = new T.Mesh(new T.PlaneGeometry(9, 1.4), new T.MeshBasicMaterial({ map: v3vTex(T, nc), transparent: true })); nm.position.set(0, 5.2, -D / 2 + 0.05); sc.add(nm);
  sc.add(new T.AmbientLight(0xFFFFFF, 0.25));
  // each piece on its plinth, lit from above, with its name plate
  const beamM = new T.MeshBasicMaterial({ color: 0xFFE9C4, transparent: true, opacity: 0.022, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending });
  const [gc, gx] = v3vCanvas(128, 128); const grd = gx.createRadialGradient(64, 64, 4, 64, 64, 64); grd.addColorStop(0, 'rgba(255,236,200,.55)'); grd.addColorStop(1, 'rgba(255,236,200,0)'); gx.fillStyle = grd; gx.fillRect(0, 0, 128, 128);
  const poolM = new T.MeshBasicMaterial({ map: v3vTex(T, gc), transparent: true, depthWrite: false, blending: T.AdditiveBlending });
  // the light in the hall: soft all round, and two lamps that cast the shadows
  const k1 = new T.DirectionalLight(0xFFF1DA, 1.6); k1.position.set(4, 12, 6); k1.castShadow = true; k1.shadow.mapSize.set(hiQ() ? 4096 : 1024, hiQ() ? 4096 : 1024); Object.assign(k1.shadow.camera, { left: -W / 2, right: W / 2, top: D / 2, bottom: -D / 2, near: 1, far: 40 }); sc.add(k1);
  const k2 = new T.DirectionalLight(0xCFE0FF, 0.6); k2.position.set(-6, 8, -4); sc.add(k2);
  const pick: any[] = [], plinthM = new T.MeshStandardMaterial({ color: 0xE8E4DC, roughness: 0.5 }), capM = new T.MeshStandardMaterial({ color: 0x14171B, roughness: 0.3, metalness: 0.4 });
  items.forEach((it, i) => {
    const cx = (i % cols - (cols - 1) / 2) * gapX, cz = (Math.floor(i / cols) - (rows - 1) / 2) * gapZ;
    const pl = new T.Mesh(new T.BoxGeometry(1.5, 1.0, 1.5), plinthM); pl.position.set(cx, 0.5, cz); pl.castShadow = true; pl.receiveShadow = true; sc.add(pl);
    const cap = new T.Mesh(new T.BoxGeometry(1.56, 0.05, 1.56), capM); cap.position.set(cx, 1.02, cz); sc.add(cap);
    let obj: any = null; try { obj = it.build(T); } catch (e) { obj = null; }
    if (obj) {
      const box = new T.Box3().setFromObject(obj), size = box.getSize(new T.Vector3()), k = 1.25 / Math.max(size.x, size.y, size.z, 0.01);
      obj.scale.multiplyScalar(k); obj.updateMatrixWorld(true); const b2 = new T.Box3().setFromObject(obj), c2 = b2.getCenter(new T.Vector3());
      obj.position.set(cx - c2.x, 1.045 - b2.min.y, cz - c2.z); obj.traverse((m: any) => { if (m.isMesh) { m.castShadow = true; m.userData.mus = i; } }); sc.add(obj);
    }
    pl.userData.mus = i;
    const [pc, px] = v3vCanvas(512, 128); px.fillStyle = '#C9A24A'; px.fillRect(0, 0, 512, 128); px.fillStyle = '#2B1E08'; px.textAlign = 'center';
    px.font = '700 40px Georgia, serif'; let t = it.title; while (px.measureText(t).width > 480 && t.length > 6) t = t.slice(0, -2); px.fillText(t, 256, 56); px.font = '500 28px Georgia, serif'; px.fillText(it.sub.slice(0, 34), 256, 100);
    const plate = new T.Mesh(new T.PlaneGeometry(1.1, 0.27), new T.MeshStandardMaterial({ map: v3vTex(T, pc), metalness: 1, roughness: 0.3 })); plate.position.set(cx, 0.75, cz + 0.76); sc.add(plate);
    // a beam of light from the ceiling (drawn, not a real light: cheap on a phone), and its pool on the floor
    const beam = new T.Mesh(new T.ConeGeometry(1.3, 5.6, hiQ() ? 64 : 24, 1, true), beamM); beam.position.set(cx, 4.1, cz); sc.add(beam);
    if (i < Gfx.museumLights()) {
      // on the PC: a real spotlight for every piece (the first eight with their own soft shadows), as in a gallery
      const sp = new T.SpotLight(0xFFF1DA, 160, 12, 0.42, 0.5, 1.2); sp.position.set(cx, 6.6, cz + 0.9); sp.target.position.set(cx, 1.3, cz);
      if (i < 8 && Gfx.lights() >= 2 && Gfx.shadow() !== 0) { sp.castShadow = true; sp.shadow.mapSize.set(1024, 1024); sp.shadow.bias = -0.0005; sp.shadow.radius = 4; }
      sc.add(sp); sc.add(sp.target);
    } else {
      const pool = new T.Mesh(new T.CircleGeometry(1.6, 32), poolM); pool.rotation.x = -Math.PI / 2; pool.position.set(cx, 0.012, cz); sc.add(pool);
    }
    pick.push(pl);
  });
  const cam = new T.PerspectiveCamera(58, 1, 0.1, 120);
  const me = { x: 0, z: D / 2 - 2.5, yaw: 0, pitch: -0.08 };
  const resize = () => { const w = host.clientWidth, h = host.clientHeight; R.setSize(w, h, false); cam.aspect = w / Math.max(1, h); cam.updateProjectionMatrix(); };
  resize(); window.addEventListener('resize', resize);
  const held: any = {}, mv: any = {};
  const ray = new T.Raycaster();
  const front = (): number => {   // the piece straight ahead, within reach
    ray.setFromCamera(new T.Vector2(0, -0.1), cam); const h = ray.intersectObjects(sc.children, true).filter((x: any) => x.object.userData.mus != null && x.distance < 6)[0];
    return h ? h.object.userData.mus : -1;
  };
  const openAt = (i: number) => { if (i >= 0 && items[i]) { Sound.tick(); items[i].open(); } };
  let drag: any = null, moved = false;
  cv.addEventListener('pointerdown', (e: PointerEvent) => { drag = [e.clientX, e.clientY]; moved = false; });
  cv.addEventListener('pointermove', (e: PointerEvent) => { if (!drag) return; const dx = e.clientX - drag[0], dy = e.clientY - drag[1]; if (Math.abs(dx) + Math.abs(dy) > 4) moved = true; drag = [e.clientX, e.clientY]; me.yaw -= dx * 0.004; me.pitch = clamp(me.pitch - dy * 0.003, -0.8, 0.6); });
  cv.addEventListener('pointerup', (e: PointerEvent) => {
    drag = null; if (moved) return;
    const r = cv.getBoundingClientRect(); ray.setFromCamera(new T.Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height * 2 - 1)), cam);
    const h = ray.intersectObjects(sc.children, true).filter((x: any) => x.object.userData.mus != null)[0]; if (h) openAt(h.object.userData.mus);
  });
  host.querySelectorAll('[data-mv]').forEach((b: any) => { const k = b.getAttribute('data-mv'); b.addEventListener('pointerdown', (e: Event) => { e.preventDefault(); mv[k] = 1; }); ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => b.addEventListener(t, () => { mv[k] = 0; })); });
  const kd = (e: KeyboardEvent) => { if (typeof V3V !== 'undefined' && V3V.on) return; const k = e.key.toLowerCase(); if (k === 'escape') { museumClose(); return; } if (k === 'enter' || k === ' ') { e.preventDefault(); openAt(front()); return; } held[k] = 1; };
  const ku = (e: KeyboardEvent) => { delete held[e.key.toLowerCase()]; };
  window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
  Museum.on = true; Museum.host = host; Museum.R = R; Museum.sc = sc; Museum.me = me; Museum.open = () => openAt(front());
  Museum.off = () => { window.removeEventListener('resize', resize); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  let t0 = performance.now();
  const frame = (now: number) => {
    if (!Museum.on || Museum.host !== host) return;
    const dt = Math.min(0.05, (now - t0) / 1000); t0 = now;
    if (!(typeof V3V !== 'undefined' && V3V.on)) {
      const f = (held['w'] || held['arrowup'] || mv.f ? 1 : 0) - (held['s'] || held['arrowdown'] || mv.b ? 1 : 0) + (Museum.padF || 0);
      const s = (held['d'] || mv.r ? 1 : 0) - (held['a'] || mv.l ? 1 : 0) + (Museum.padS || 0);
      if (held['arrowleft']) me.yaw += 1.8 * dt; if (held['arrowright']) me.yaw -= 1.8 * dt;
      const sp = 3.2 * dt; me.x += (-Math.sin(me.yaw) * f + Math.cos(me.yaw) * s) * sp; me.z += (-Math.cos(me.yaw) * f - Math.sin(me.yaw) * s) * sp;
      me.x = clamp(me.x, -W / 2 + 0.8, W / 2 - 0.8); me.z = clamp(me.z, -D / 2 + 0.8, D / 2 - 0.8);
      // never through a plinth
      items.forEach((_, i) => { const cx = (i % cols - (cols - 1) / 2) * gapX, cz = (Math.floor(i / cols) - (rows - 1) / 2) * gapZ, dx = me.x - cx, dz = me.z - cz, d = Math.hypot(dx, dz); if (d < 1.4) { me.x = cx + dx / (d || 1) * 1.4; me.z = cz + dz / (d || 1) * 1.4; } });
      cam.position.set(me.x, 1.7, me.z); cam.rotation.order = 'YXZ'; cam.rotation.set(me.pitch, me.yaw, 0);
      R.render(sc, cam);
    }
    Museum.raf = requestAnimationFrame(frame);
  };
  Museum.raf = requestAnimationFrame(frame);
  Sound.tick();
}
/** The controller in the museum: left stick walks, right stick looks, Cross holds the piece in front, Circle leaves. */
function museumPad(lx: number, ly: number, rx: number, ry: number, l2: number, r2: number, B: boolean[], hit: (i: number) => boolean, dt: number) {
  if (typeof V3V !== 'undefined' && V3V.on) return;
  Museum.padF = -ly; Museum.padS = lx;
  if (Museum.me) { Museum.me.yaw -= rx * dt * 2.2; Museum.me.pitch = clamp(Museum.me.pitch - ry * dt * 1.6, -0.8, 0.6); }
  if (hit(0)) Museum.open && Museum.open();
  if (hit(1)) museumClose();
}
function museumClose() {
  if (!Museum.host) return;
  Museum.on = false; cancelAnimationFrame(Museum.raf); try { Museum.off && Museum.off(); } catch (e) { /* none */ }
  try { Museum.sc.traverse((m: any) => { if (m.geometry) m.geometry.dispose(); const ms = m.material ? (Array.isArray(m.material) ? m.material : [m.material]) : []; ms.forEach((x: any) => { if (x.map) x.map.dispose(); x.dispose(); }); }); } catch (e) { /* gone */ }
  try { Museum.R.dispose(); Museum.R.forceContextLoss && Museum.R.forceContextLoss(); } catch (e) { /* gone */ }
  Museum.host.remove(); Museum.host = null; Museum.R = null; Museum.sc = null; Museum.padF = Museum.padS = 0;
}
ACTIONS['mus-open'] = () => museumOpen();
ACTIONS['mus-close'] = () => museumClose();
