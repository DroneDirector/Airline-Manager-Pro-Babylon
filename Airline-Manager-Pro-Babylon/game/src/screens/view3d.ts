// The 3D view: the aircraft you follow, seen in 3D over the ground it flies over, with the airport it is
// leaving or approaching. Opened with the 3D button among the map controls. Kept light: the ground is one
// mesh painted like the world map (dark land, cyan coastlines) with the real heights of the terrain, the
// airport is a handful of flat shapes, and it draws at most 30 times a second, only while open.
// The camera always follows the aircraft; drag to look around it, pinch or scroll to zoom.
//
// Terrain heights: Terrain Tiles on AWS (Mapzen/Tilezen "terrarium"), from SRTM, GMTED2010, ETOPO1, 3DEP,
// EU-DEM and national elevation models; their sources are credited in Settings → About.

const TERRAIN_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/';
const V3D_FPS = 30;

interface V3dPlane { id: string; model: any; type: string; pos: any; tgt: any; hdg: number; tgtHdg: number; bank: number; pitch: number; flaps: number; gear: number; label: HTMLElement; seen: number }

const V3d: any = {
  open: false, root: null as HTMLElement, cv: null as HTMLCanvasElement, r: null as any, scene: null as any, cam: null as any,
  origin: null as number[], elev: 0, icao: '', target: '', planes: {} as { [id: string]: V3dPlane },
  terrain: null as any, airport: null as any, aptScene: null as any, raf: 0, last: 0, mode: 'chase' as 'chase' | 'tower' | 'side' | 'fwd' | 'winL' | 'winR' | 'free' | string,
  yaw: 0, pitch: 0.28, dist: 0, drag: null as any, ptrs: {} as any, pinch0: 0, dist0: 0, loading: 0, heights: null as any, map: null as WorldMap,
};

function v3dSupported(): boolean {
  try { const c = document.createElement('canvas'); return !!(window as any).THREE && !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
}
function view3dBtn(): string {
  return `<button class="icon-btn v3d-btn" data-act="v3d-open" aria-label="3D view"><b>3D</b></button>`;
}

ACTIONS['v3d-open'] = () => {
  if (!v3dSupported()) { toast('3D isn\'t available on this device', 'warn'); return; }
  const m = _curMap();
  const id = (m && (m.following || m.selected)) || (liveOf().filter(f => f.you)[0] || liveOf()[0] || {} as any).id;
  if (!id) { toast('No aircraft in the air to show in 3D', 'info'); return; }
  v3dOpen(id, m, m ? m.el : null);
};

/** Open the 3D view at an airport (from its card on the map), with the free camera, aircraft or not. */
function v3dOpenAirport(icao: string) {
  if (!v3dSupported()) { toast('3D isn\'t available on this device', 'warn'); return; }
  const m = _curMap(); v3dOpen('apt:' + icao, m, m ? m.el : null);
}
ACTIONS['apt-3d'] = el => v3dOpenAirport(el.getAttribute('data-icao'));
/** At an airport without following an aircraft: a stand-in "flight" parked at the airport. */
/** The flight the view follows: yours or your airline's, or another airline's aircraft opened from the map. */
function v3dTargetFlight(): any {
  const id = V3d.target, f = State.live.filter(x => x.id === id)[0]; if (f) return f;
  if (/^tfc-/.test(String(id || '')) && typeof Traffic !== 'undefined' && Traffic.on()) return Traffic.live().filter((x: any) => x.id === id)[0] || null;
  return null;
}
function v3dAptOnly(): any { const k = String(V3d.target || ''); if (k.indexOf('apt:') !== 0) return null; const icao = k.slice(4), A = apt(icao); return A ? { id: k, from: icao, to: icao, real: true, pos: A.pos, alt: 0, hdg: 0, phase: 'Parked', callsign: icao } : null; }
/** Opened from a screen in one of your offices (the Operations monitor, your laptop): the room is put away first, so
 *  the graphics card has only the 3D view to draw (two 3D scenes at once can make it give up: "WebGL context lost"),
 *  and you are back in the room, at the same screen, when you close the 3D view. */
function v3dRoomSuspend() {
  const O: any = typeof OpsRoom !== 'undefined' ? OpsRoom : null, F: any = typeof OfficeRoom !== 'undefined' ? OfficeRoom : null;
  if (O && O.on) { (V3d as any).backTo = { room: 'ops', tab: O.overlay ? (O.overlay.getAttribute('data-screen') || O.tab) : '' }; O.close(true); return; }
  if (F && F.on && !F.inc) { const lap = F.overlay && F.overlay.classList.contains('lap-screen'); (V3d as any).backTo = { room: 'office', lap, app: lap ? Lap.app : '', screen: !lap && F.overlay ? F.overlay.getAttribute('data-screen') : '' }; F.close(true); return; }
  (V3d as any).backTo = null;
}
/** Back into the room the 3D view was opened from, at the same screen. */
function v3dRoomResume(): boolean {
  const B = (V3d as any).backTo; (V3d as any).backTo = null; if (!B) return false;
  const ready = (R: any, then: () => void) => { const t0 = Date.now(), iv = setInterval(() => { if (!R.on) { clearInterval(iv); return; } if (!R.loading && R.A && Date.now() - t0 > 2600) { clearInterval(iv); try { then(); } catch (e) { /* stays in the room */ } } else if (Date.now() - t0 > 40000) clearInterval(iv); }, 250); };
  try {
    if (B.room === 'ops') { OpsRoom.open(); if (B.tab) ready(OpsRoom, () => opsScreenOpen(B.tab)); return true; }
    if (B.room === 'office') { OfficeRoom.open(); if (B.lap) ready(OfficeRoom, () => { ofLaptopOpen(); if (B.app) setTimeout(() => { Lap.app = B.app; lapRender(); }, 60); }); else if (B.screen) ready(OfficeRoom, () => ofScreenOpen(B.screen)); return true; }
  } catch (e) { /* back to the app */ }
  return false;
}
function v3dOpen(id: string, map: WorldMap, from?: HTMLElement) {
  const T = THREE;
  v3dClose();
  try { v3dRoomSuspend(); } catch (e) { /* no room */ }
  V3d.aptReady = false; V3d.loadT0 = performance.now(); V3d.loaded = false; (V3d as any).pre = null; V3d.shown = 0;   // the loading bar starts from nothing every time
  v3dCrashGuard(true);
  document.body.classList.add('v3d-on');   // pop-ups and messages show above the 3D view
  V3d.open = true; V3d.target = id; (V3d as any).camBase = null; (V3d as any).lastF = null; (V3d as any).lastW = null; (V3d as any).parkedAt = 0; V3d.map = map; V3d.planes = {}; V3d.origin = null; V3d.icao = '';
  V3d.mode = id.indexOf('apt:') === 0 ? 'free' : 'chase'; V3d.yaw = 0; V3d.pitch = 0.22; V3d.dist = 0; (V3d as any).fc = null; (V3d as any).fcStart = id.indexOf('apt:') === 0;
  const root = document.createElement('div'); root.className = 'v3d' + (id.indexOf('apt:') === 0 ? ' v3d-free v3d-aptonly' : '') + (DESKTOP ? ' v3d-pc' : '') + ((State.settings as any).fcMini ? ' v3d-mini' : '');
  root.innerHTML = `<canvas class="v3d-cv"></canvas><div class="v3d-labels"></div>
    <div class="v3d-top"><button class="icon-btn" data-act="v3d-close" aria-label="Close the 3D view">${icon('close')}</button>
      <div class="v3d-modes"><button class="v3d-m v3d-gear" data-act="scene-settings" aria-label="Settings" title="Settings">${icon('gear')}</button>${[['chase', 'Behind'], ['side', 'Around'], ['tower', 'Tower'], ['fwd', 'Forward'], ['cabin', 'Cabin'], ['winL', 'Window L'], ['winR', 'Window R'], ['free', 'Free camera'], ['walk', 'Walk']].map(([k, l]) => `<button class="v3d-m ${k === 'chase' ? 'on' : ''}" data-act="v3d-mode" data-m="${k}">${l}</button>`).join('')}</div>
      <span class="v3d-batt">${typeof Battery !== 'undefined' ? Battery.html() : ''}</span>
      <span class="v3d-clock" title=""></span>
      <div class="v3d-pick"><button class="icon-btn" data-act="v3d-next" data-d="-1" aria-label="Previous aircraft">${icon('chevron', 'flip')}</button><span class="v3d-name"></span><button class="icon-btn" data-act="v3d-next" data-d="1" aria-label="Next aircraft">${icon('chevron')}</button></div></div>
    <div class="v3d-info"></div>
    <div class="v3d-line"></div>
    <div class="v3d-status"></div>
    <button class="v3d-shot" data-act="v3d-shot" aria-label="Take a screenshot" title="Take a screenshot (P)">${icon('camera')}</button><button class="v3d-cine" data-act="photo-mode" aria-label="Cinema" title="Cinema: frame your shot, hide everything else (H)">${icon('cinema')}<span>Cinema</span></button>
    <button class="v3d-uitog" data-act="v3d-ui" aria-label="Hide or show the controls" title="Hide or show the controls (H)">${icon('focus')}<span>Hide controls</span></button>
    <button class="v3d-sat ${(State.settings as any).v3dSat ? 'on' : ''}" data-act="v3d-sat">${icon('map')}Satellite</button>
    <div class="v3d-free-ui">
      <div class="fc-stick" data-fc="stick"><i></i><small>Move</small></div>
      <div class="fc-ud"><button class="fc-btn" data-fc="up" aria-label="Climb">${icon('down', 'flip-v')}</button><small>Height</small><button class="fc-btn" data-fc="down" aria-label="Sink">${icon('down')}</button></div>
      <div class="fc-speed"><small>Speed</small><input type="range" class="fc-spd" min="0" max="100" value="${Math.round((Math.log((State.settings as any).v3dFreeSpeed || 1) / Math.log(8) + 1) * 50)}"><b class="fc-spd-v">${((State.settings as any).v3dFreeSpeed || 1).toFixed(1)}×</b></div>
      <button class="fc-help-btn" data-act="fc-help" aria-label="Controls">?</button>
      <div class="fc-help"><b>Free camera</b>
        ${DESKTOP ? `<span><i>Click</i>Capture the mouse</span><span><i>Esc</i>Exit the free camera, back to the map</span><span><i>Mouse</i>Look around</span><span><i>W A S D</i>Forward, back and sideways</span><span><i>Space / C</i>Climb and sink (also E and Q)</span><span><i>Shift</i>Faster while held</span><span><i>Wheel</i>Movement speed</span><span><i>Arrows</i>Look around without the mouse</span>`
          : `<span><i>One finger</i>Look around</span><span><i>Left stick</i>Move forward, back and sideways</span><span><i>Height buttons</i>Climb and sink</span><span><i>Two fingers</i>Slide, or pinch to fly forward and back</span><span><i>Speed</i>How fast you move (faster the higher you fly)</span>`}
        <span><i>Close</i>Back to the Overview</span></div>
      ${DESKTOP ? '<div class="fc-pc-hint">Click to look around with the mouse · W A S D to move</div><div class="fc-esc"><kbd>Esc</kbd><span>Exit the free camera</span></div>' : ''}
    </div>
    <label class="v3d-wzoom" aria-label="Closer to the window">${icon('search')}<input type="range" class="v3d-wz" min="0" max="100" step="1" value="${Math.round(cabinWinZoom() * 100)}" aria-label="Closer to the window"><small>Zoom</small></label>
    ${Mode.coop() ? '' : `<button class="v3d-sat v3d-tfc tfc-btn ${Traffic.on() ? 'on' : ''}" data-act="tfc-toggle">${icon('fleet')}Other airlines</button>`}
    <small class="v3d-credit">Terrain: Terrain Tiles on AWS · water: © OpenStreetMap contributors · imagery: Sentinel-2 cloudless 2016 by EOX (see Settings → About)</small>
    ${v3dLoaderHtml()}`;
  // opened from the small map on the overview: it grows from that window to the whole screen
  const rc = from && from.getBoundingClientRect();
  if (rc && rc.width && (rc.width < innerWidth - 40 || rc.height < innerHeight - 40) && !State.settings.reduceMotion) {
    root.classList.add('v3d-from');
    root.style.cssText = `left:${rc.left}px;top:${rc.top}px;width:${rc.width}px;height:${rc.height}px;border-radius:14px`;
    requestAnimationFrame(() => requestAnimationFrame(() => { root.classList.add('v3d-grow'); root.style.cssText = ''; }));
    setTimeout(() => root.classList.remove('v3d-from', 'v3d-grow'), 900);
  }
  document.body.appendChild(root);
  V3d.root = root; V3d.cv = root.querySelector('.v3d-cv');
  const phone = Math.min(innerWidth, innerHeight) < 600;
  const rg = v3dRange(map && (map as any).cy != null ? undefined : undefined);
  // edge smoothing: on the PC it is chosen in Settings → Display (off, multisampling, or multisampling with the
  // picture drawn larger and scaled down for the smoothest edges); on phones and tablets the app decides
  const aa = DESKTOP ? deskAA() : phone ? 0 : 1, dpr = (window.devicePixelRatio || 1) * deskRenderScale();   // the PC's chosen resolution
  const r = new T.WebGLRenderer({ canvas: V3d.cv, antialias: aa > 0, powerPreference: v3dKm() > 300 || gameBoost() || aa >= 3 ? 'high-performance' : 'low-power', logarithmicDepthBuffer: v3dKm() > 60 });
  r.setPixelRatio(Gfx.pr(aa >= 2 ? Math.min(Math.max(dpr, 0.35) * (aa === 4 ? 2 : aa === 3 ? 1.5 : 1.25), 4) : DESKTOP && deskRes()[0] ? clamp(dpr, 0.35, 3) : Math.min(dpr, phone ? 1 : 1.5)));
  r.outputColorSpace = T.SRGBColorSpace;
  V3d.r = r;
  const sc = new T.Scene(); V3d.scene = sc;
  sc.background = new T.Color(0x0A1A2E);
  sc.fog = new T.Fog(0x0A1A2E, rg.fog[0], rg.fog[1]);
  const hemi = new T.HemisphereLight(0xDDE8FF, 0x223348, 1.6); sc.add(hemi); (V3d as any).hemi = hemi;
  const sun = new T.DirectionalLight(0xFFFFFF, 1.9); sun.position.set(-4000, 9000, 3000); sc.add(sun); (V3d as any).sunL = sun;
  V3d.cam = new T.PerspectiveCamera(50, 1, 2, rg.far);
  try { v3dSkyInit(); } catch (e) { /* the old plain sky */ }
  v3dSize();
  v3dBind();
  v3dShowInfo();
  V3d.last = 0; (V3d as any).perf = Perf.state(); V3d.raf = requestAnimationFrame(v3dLoop);
  addEventListener('resize', v3dSize);
}

function v3dClose() {
  try { if (typeof Photo !== 'undefined') { Photo.on = false; if (V3d.cv) V3d.cv.style.filter = ''; } } catch (e) { /* none */ }
  if (!V3d.open) return;
  V3d.open = false; cancelAnimationFrame(V3d.raf); document.body.classList.remove('v3d-on');
  try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* ignore */ }
  v3dCrashGuard(false);
  try { V3dCabin.grp = V3dCabinF.grp = null; V3dCabin.key = V3dCabinF.key = ''; (V3d as any).cabinFor = (V3d as any).cabinFwdFor = null; } catch (e) { /* none */ }
  removeEventListener('resize', v3dSize);
  try {
    V3d.scene.traverse((o: any) => { if (o.geometry) o.geometry.dispose(); if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m: any) => { if (m.map) m.map.dispose(); m.dispose(); }); } });
    FrameGen.dispose((V3d as any).perf); V3d.r.dispose(); V3d.r.forceContextLoss && V3d.r.forceContextLoss();
  } catch (e) { /* gone */ }
  if (V3d.root) V3d.root.remove();
  try { V3dTerrain.clear(); V3dTerrain.gen++; } catch (e) { /* none */ }
  v3dCloudsClear(); v3dSkyClear(); v3dWeatherClear(); v3dCrashClear();
  V3d.root = null; V3d.terrain = null; V3d.airport = null; V3d.aptScene = null; V3d.planes = {};
}
// closing from the free camera: back to the normal Overview
/** The X (and Esc, the back button, the controller): asks first; Yes leaves with the loading screen. */
ACTIONS['v3d-close'] = () => {
  if (!V3d.open || ExitSplash.on || document.querySelector('.v3d-ask')) return;
  try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* not locked */ }
  Sound.tick();
  const wrap = openLayer('modal', `<div class="modal-head"><div><h2>Leave the 3D viewer?</h2><small>Are you sure you want to exit the 3D viewer?</small></div></div>
    <div class="modal-actions center"><button class="btn ghost" data-act="close-layer">No, stay</button><button class="btn primary" data-v3d-yes>${icon('close')}Yes, leave</button></div>`, { cls: 'narrow v3d-ask' });
  const yes = wrap && wrap.querySelector('[data-v3d-yes]') as HTMLElement;
  if (yes) { yes.addEventListener('click', () => { closeTop(); ACTIONS['v3d-close-go'](null as any, null as any); }); setTimeout(() => yes.focus(), 50); }
};
ACTIONS['v3d-close-go'] = () => {
  if (!V3d.open || ExitSplash.on) return;
  const free = V3d.mode === 'free';
  exitSplash('v3d', 'Leaving the 3D viewer', [
    { pct: 30, step: 'Landing the camera…', run: () => { (V3d as any).fcLeaving = true; v3dClose(); (V3d as any).fcLeaving = false; } },
    { pct: 55, step: 'Clearing the 3D world from memory…', run: () => { try { if (CabinOut.rt) CabinOut.rt.dispose(); CabinOut.rt = null; } catch (e) { /* none */ } exitFreeMemory(); } },
    { pct: 85, step: (V3d as any).backTo ? 'Back to your office…' : free ? 'Loading the Overview…' : 'Loading the map…', run: () => { if (v3dRoomResume()) return; if (free) { try { closeAll(); go('ops'); } catch (e) { /* ignore */ } } else { try { refresh(); } catch (e) { /* ignore */ } } } },
  ]);
};
/** Walking and the free camera: the controls can be hidden for a clean view (the button, H, or R3 on a controller). */
function v3dUi(show?: boolean) {
  const r = V3d.root; if (!r) return;
  const on = show == null ? r.classList.contains('ui-off') : show;
  r.classList.toggle('ui-off', !on);
  const b = r.querySelector('.v3d-uitog span'); if (b) b.textContent = on ? 'Hide controls' : 'Show controls';
}
ACTIONS['v3d-ui'] = () => { Sound.tick(); v3dUi(); };
document.addEventListener('keydown', (e: KeyboardEvent) => {
  if (!V3d.open || !/^(walk|free)$/.test(V3d.mode) || e.key.toLowerCase() !== 'h' || e.ctrlKey || e.metaKey || e.altKey) return;
  const t = e.target as HTMLElement; if (t && t.closest && t.closest('input, textarea, [contenteditable]')) return;
  e.preventDefault(); v3dUi();
});
// P takes a screenshot (any camera)
document.addEventListener('keydown', (e: KeyboardEvent) => {
  if (!V3d.open || e.key.toLowerCase() !== 'p' || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
  const t = e.target as HTMLElement; if (t && t.closest && t.closest('input, textarea, [contenteditable]')) return;
  e.preventDefault(); ACTIONS['v3d-shot'](null, null);
});
ACTIONS['v3d-mode'] = el => {
  const m = el.getAttribute('data-m') || 'chase', inside = (k: string) => /^(cabin|walk|winL|winR)$/.test(k);
  // going into the cabin: its loading screen first, then the cabin is built behind it
  if (inside(m) && !inside(V3d.mode) && V3d.loaded && V3d.root) { cabinLoadShow(() => v3dModeSet(m)); Sound.tick(); return; }
  v3dModeSet(m); Sound.tick();
};
function v3dModeSet(m: string) {
  V3d.mode = m;
  if (V3d.root) { V3d.root.setAttribute('data-m', V3d.mode); if (!/^(walk|free)$/.test(V3d.mode)) v3dUi(true); }
  if (/^(tower|fwd|cabin|winL|winR)$/.test(V3d.mode)) { V3d.yaw = 0; V3d.pitch = 0; }   // these start looking the natural way
  if (V3d.mode === 'free') { v3dFreeStart(); v3dFreeUiBind(); }
  else { (V3d as any).fcLeaving = true; try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* ignore */ } setTimeout(() => { (V3d as any).fcLeaving = false; }, 300); }
  V3d.root.classList.toggle('v3d-free', V3d.mode === 'free'); V3d.root.classList.toggle('v3d-win', /^win/.test(V3d.mode)); V3d.root.classList.toggle('v3d-walk', V3d.mode === 'walk'); V3d.root.classList.toggle('v3d-inside', V3d.mode === 'cabin' || V3d.mode === 'walk' || /^win/.test(V3d.mode)); if (V3d.mode === 'walk') cabinWalkStart(); else cabinWalkStop();
  V3d.yaw = V3d.mode === 'side' ? 1.2 : 0; V3d.pitch = V3d.mode === 'side' ? 0.15 : V3d.mode === 'fwd' || V3d.mode === 'cabin' || V3d.mode === 'walk' || /^win/.test(V3d.mode) ? 0 : 0.22; V3d.dist = 0; (V3d as any).panX = 0; (V3d as any).panY = 0;
  V3d.root.querySelectorAll('[data-act=v3d-mode]').forEach((b: Element) => b.classList.toggle('on', b.getAttribute('data-m') === V3d.mode));
  cabinTouchPad();
}
ACTIONS['v3d-next'] = el => {
  const list = liveOf(), i = list.findIndex(f => f.id === V3d.target), d = +el.getAttribute('data-d');
  if (!list.length) return;
  if (V3d.root) V3d.root.classList.remove('v3d-aptonly');   // from an airport on to an aircraft: the usual view
  v3dSelect(list[(i + d + list.length) % list.length].id);
};
function v3dSelect(id: string) {
  if (id === V3d.target) return;
  V3d.target = id; V3d.dist = 0; Sound.tick();
  if (V3d.map) { V3d.map.mark = null; V3d.map.follow(id); }
  v3dShowInfo();
}

function v3dSize() {
  if (!V3d.open) return;
  const w = innerWidth, h = innerHeight;
  V3d.r.setSize(w, h, false); V3d.cv.style.width = w + 'px'; V3d.cv.style.height = h + 'px';
  V3d.cam.aspect = w / h; V3d.cam.updateProjectionMatrix();
}

/** Floatplanes with wheels in their floats (amphibians): 1 = wheels down, landing on or rolling along a runway at a land
 *  airport; 0 = wheels up, for water (a seaplane base, a water runway, or no runway near) and in cruise. */
function v3dAmphibWheels(g: any, w: any, ph: string): number {
  const near = /final|landing|touchdown|flare|approach|roll|taxi|take-?off|lift-?off|gate|parked|boarding|pushback/.test(ph) || w.onGround;
  if (!near) return 0;
  const A = apt(g.from), B = g.to && !g.noDest ? apt(g.to) : null;
  const dA = A ? gcDistanceNm([w.lon, w.lat], A.pos) : 1e9, dB = B ? gcDistanceNm([w.lon, w.lat], B.pos) : 1e9;
  const icao = /final|landing|touchdown|flare|approach/.test(ph) ? (B ? g.to : g.from) : dA <= dB ? g.from : g.to;
  return v3dWaterAt(icao, w.lat, w.lon) ? 0 : 1;
}
/** Is the place this aircraft lands on (or stands on) water? The nearest runway of the airport's layout decides (a
 *  water runway, or none within 3 km); without a layout, a seaplane base is water. */
function v3dWaterAt(icao: string, lat: number, lon: number): boolean {
  const L: any = (typeof AirportLayouts !== 'undefined' && AirportLayouts.cache[String(icao || '').toUpperCase()]) || null;
  if (L && L.runways && L.runways.length) {
    let best: any = null, bd = 1e9;
    for (const r of L.runways) { const d = gcDistanceNm([lon, lat], [r.lon, r.lat]) * 1852; if (d < bd) { bd = d; best = r; } }
    if (best && bd < 3000) return best.surf === 9;
  }
  const W: any = typeof World !== 'undefined' ? World.get(icao) : null;
  return !!(W && W.size === 3);
}

/** Drag to look around, pinch or scroll to zoom, tap an aircraft for its flight. */
function v3dBind() {
  const cv = V3d.cv; cv.style.touchAction = 'none';
  cv.addEventListener('webglcontextlost', (e: Event) => { e.preventDefault(); if (!V3d.open || e.target !== V3d.cv) return;   // closing the view lets go of the graphics on purpose (also an old view's, arriving after a reload)
    try { ErrorLog.add('3d', 'The 3D view lost its graphics', `Satellite detail ${v3dSatQ()}`, 'WebGL context lost'); } catch (x) { /* ignore */ } const S: any = State.settings; if ((S.v3dSatQ || 0) > 0) { S.v3dSatQ--; Store.soon(); } v3dClose(); toast('The 3D view ran out of graphics memory and closed. Satellite detail was lowered one step.', 'warn'); });
  cv.addEventListener('pointerdown', (e: PointerEvent) => {
    cv.setPointerCapture(e.pointerId); V3d.ptrs[e.pointerId] = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY };
    const ids = Object.keys(V3d.ptrs);
    if (ids.length === 2) { const a = V3d.ptrs[ids[0]], b = V3d.ptrs[ids[1]]; V3d.pinch0 = Math.hypot(a.x - b.x, a.y - b.y); V3d.dist0 = v3dDist(); (V3d as any).wz0 = cabinWinZoom(); }
  });
  cv.addEventListener('pointermove', (e: PointerEvent) => {
    const p = V3d.ptrs[e.pointerId]; if (!p) return;
    const ids = Object.keys(V3d.ptrs);
    if (V3d.mode === 'free') { v3dFreeGesture(e, p, ids); p.x = e.clientX; p.y = e.clientY; return; }
    if (ids.length === 1) { const fp = V3d.mode === 'cabin';   // in the cabin seat the view follows the finger or mouse, as in a game
      V3d.yaw += (e.clientX - p.x) * 0.007 * (fp ? 1 : -1); V3d.pitch = clamp(V3d.pitch + (e.clientY - p.y) * 0.005 * (V3d.mode === 'walk' || fp ? -1 : 1), V3d.mode === 'walk' ? -1.2 : -0.6, V3d.mode === 'walk' ? 1.2 : 1.5); }
    if (ids.length === 2) { const VA: any = V3d; VA.panX = (VA.panX || 0) - (e.clientX - p.x) * 0.5 / 2; VA.panY = (VA.panY || 0) + (e.clientY - p.y) * 0.5 / 2; }
    p.x = e.clientX; p.y = e.clientY;
    if (ids.length === 2) { const a = V3d.ptrs[ids[0]], b = V3d.ptrs[ids[1]]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (V3d.pinch0) { if (/^win/.test(V3d.mode)) cabinWinZoomSet((V3d as any).wz0 + (d - V3d.pinch0) / 300); else V3d.dist = clamp(V3d.dist0 * V3d.pinch0 / d, 8, 30000); } }
  });
  const up = (e: PointerEvent) => {
    const p = V3d.ptrs[e.pointerId];
    if (p && V3d.mode !== 'free' && Object.keys(V3d.ptrs).length === 1 && Math.hypot(e.clientX - p.x0, e.clientY - p.y0) < 6) v3dTap(e.clientX, e.clientY);
    if (V3d.mode === 'free') (V3d as any).fcPinch = 0;
    delete V3d.ptrs[e.pointerId];
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', (e: PointerEvent) => { delete V3d.ptrs[e.pointerId]; });
  if (DESKTOP) {
    cv.addEventListener('click', () => { if (V3d.mode === 'free' && document.pointerLockElement !== cv) { try { (cv as any).requestPointerLock(); } catch (e) { /* not allowed */ } } });
    document.addEventListener('mousemove', (e: MouseEvent) => { const F = fc(); if (!F || V3d.mode !== 'free' || document.pointerLockElement !== cv) return; F.yaw += e.movementX * 0.0025; F.pitch = clamp(F.pitch - e.movementY * 0.0025, -1.5, 1.4); });
    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === cv; if (V3d.root) V3d.root.classList.toggle('fc-locked', locked);
      if (!locked && V3d.open && V3d.mode === 'free' && !(V3d as any).fcLeaving) setTimeout(() => { if (V3d.open && V3d.mode === 'free' && document.hasFocus() && !document.hidden) ACTIONS['v3d-close'](null as any, null as any); }, 120);
    });
    document.addEventListener('keydown', (e: KeyboardEvent) => { if (e.key === 'Escape' && V3d.open && V3d.mode === 'free') { e.preventDefault(); ACTIONS['v3d-close'](null as any, null as any); } });
  }
  cv.addEventListener('wheel', (e: WheelEvent) => { e.preventDefault(); if (V3d.mode === 'free') {
    if (DESKTOP) { const S: any = State.settings, m = clamp((S.v3dFreeSpeed || 1) * (e.deltaY > 0 ? 1 / 1.25 : 1.25), 0.125, 8); S.v3dFreeSpeed = Math.round(m * 100) / 100; const o = V3d.root.querySelector('.fc-spd-v'), sp = V3d.root.querySelector('.fc-spd') as HTMLInputElement; if (o) o.textContent = m.toFixed(1) + '×'; if (sp) sp.value = String(Math.round((Math.log(m) / Math.log(8) + 1) * 50)); Store.soon(); return; }
    v3dFreePush(0, 0, (e.deltaY > 0 ? -1 : 1) * 2.2); return; } if (/^win/.test(V3d.mode)) { cabinWinZoomSet(cabinWinZoom() + (e.deltaY > 0 ? -0.08 : 0.08)); return; } V3d.dist = clamp(v3dDist() * (e.deltaY > 0 ? 1.15 : 1 / 1.15), 8, 30000); }, { passive: false } as any);
}
function v3dDist(): number { const p = V3d.planes[V3d.target]; const span = p ? shapeOf(p.type).span : 35; return V3d.dist || (V3d.mode === 'tower' ? 0 : span * 1.9 + 25); }

function v3dTap(x: number, y: number) {
  if (aimLocked(V3d.cv)) { x = innerWidth / 2; y = innerHeight / 2; }   // walking with the mouse taken: what is at the dot in the middle
  if (V3d.mode === 'cabin' || V3d.mode === 'walk') { try { if (cabinTap(x, y)) return; } catch (e) { /* the aircraft below */ } }
  if (/^win/.test(V3d.mode)) { try { const Gw = V3dCabin.grp, SW = Gw && Gw.userData.shade; if (SW) { const r0 = new THREE.Raycaster(); r0.setFromCamera(new THREE.Vector2(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1), V3d.cam); if (r0.intersectObjects(SW.hit, false).length && cabShadeToggle(SW, 0)) return; } } catch (e) { /* the aircraft below */ } }   // your window's shade
  const T = THREE, ray = new T.Raycaster(), v = new T.Vector2(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1);
  ray.setFromCamera(v, V3d.cam);
  const objs: any[] = []; for (const id in V3d.planes) objs.push(V3d.planes[id].model);
  const hit = ray.intersectObjects(objs, true)[0];
  if (hit) { let o = hit.object; while (o && !o.userData.flightId) o = o.parent; if (o) { v3dSelect(o.userData.flightId); return; } }
  // labels: the nearest one on screen
  let best = '', bd = 40;
  for (const id in V3d.planes) { const L = V3d.planes[id].label; if (!L || L.style.display === 'none') continue; const r = L.getBoundingClientRect(), d = Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y); if (d < bd) { bd = d; best = id; } }
  if (best) v3dSelect(best);
}

/** The flight's details, in a panel you can drag anywhere. */
function v3dShowInfo() {
  if (!V3d.root) return;
  if (v3dAptOnly()) { const nm = V3d.root.querySelector('.v3d-name') as HTMLElement; if (nm) nm.textContent = String(V3d.target).slice(4); return; }
  const f: any = v3dTargetFlight();
  const box = V3d.root.querySelector('.v3d-info') as HTMLElement, name = V3d.root.querySelector('.v3d-name') as HTMLElement;
  if (name) name.textContent = f ? f.callsign : '';
  if (box) box.innerHTML = f ? `<div class="sel-pop">${f.tfc ? trafficCardHtml(f, true) : flightCard(f)}</div>` : '';
  const ln = V3d.root.querySelector('.v3d-line') as HTMLElement; if (ln) ln.innerHTML = f ? v3dLineHtml(f) : '';
}
/** Inside the aircraft (cabin, walking, window seats): the flight in one line along the bottom instead of the
 *  card, like the seat-back screen's flight bar: route with progress, phase, altitude, speed, distance, time left. */
function v3dLineHtml(f: LiveFlight): string {
  const F: any = f, A = apt(f.from), B = apt(f.to), ai = !f.real && F.depAt;
  const left = ai ? F.leftNm : f.real ? (f.noDest ? 0 : F.leftNm != null && !f.pos ? F.leftNm : gcDistanceNm(f.pos, B ? B.pos : null)) : (A && B ? gcDistanceNm(A.pos, B.pos) : 0) * (1 - f.t);
  const altTxt = f.alt < 50 ? 'Ground' : f.alt < 18000 ? num(Math.round(f.alt / 100) * 100) + ' ft' : 'FL' + Math.round(f.alt / 100);
  const it = (lab: string, v: string, cls?: string) => `<span class="vl-i ${cls || ''}"><small>${lab}</small><b>${v}</b></span>`;
  return `<span class="vl-cs">${esc(f.callsign)}</span>
    <span class="vl-route"><b>${esc(f.from)}</b><i class="vl-track"><i class="vl-fill" style="width:${(f.t * 100).toFixed(1)}%"></i><i class="vl-plane" style="left:${(f.t * 100).toFixed(1)}%">${icon('fleet')}</i></i><b>${f.noDest ? '—' : esc(f.to)}</b></span>
    ${it('Phase', esc(f.phase), 'vl-ph')}${it('Altitude', altTxt)}${it('Speed', f.gs ? num(f.gs) + ' kt' : '—', 'vl-opt')}${it('Remaining', f.noDest ? '—' : num(left) + ' nm', 'vl-opt')}${it('Arrives in', arrivesIn(f))}
    <span class="vl-btns"><button class="icon-btn vl-full" data-act="fc-min" aria-label="Show all the details" title="Show all the details">${icon('down', 'flip-v')}</button><button class="icon-btn" data-act="pax-list" data-id="${esc(f.id)}" aria-label="Passenger list" title="Passenger list">${icon('pax')}</button><button class="icon-btn" data-act="loadsheet" data-id="${esc(f.id)}" aria-label="Loadsheet" title="Loadsheet">${icon('fuel')}</button></span>`;
}

/* ---------- positions ---------- */

/** Local metres (x east, z south, y up) around the view's origin. */
function v3dXY(lon: number, lat: number): number[] {
  const o = V3d.origin; return [(lon - o[0]) * 111320 * Math.cos(o[1] * D2R), -(lat - o[1]) * 110540];
}

/** Where the view is centred: the airport the aircraft is near (within 60 nm), else the aircraft itself. */
function v3dCentre(f: LiveFlight, pos: number[]): { pos: number[]; icao: string } {
  const A = apt(f.from), B = f.noDest ? null : apt(f.to);
  const dA = A ? gcDistanceNm(pos, A.pos) : 1e9, dB = B ? gcDistanceNm(pos, B.pos) : 1e9;
  if (Math.min(dA, dB) < 60) { const k = dB <= dA ? f.to : f.from; return { pos: apt(k).pos, icao: k }; }
  // close to another airport (a diversion, a missed approach elsewhere, taxiing at a field not in the plan): drawn too
  const near = v3dAirportNear(pos, 3); if (near) return { pos: apt(near).pos, icao: near };
  return { pos, icao: '' };
}

/** Where a flight is, in lon/lat with heading and altitude above the sea (m), from the airport scene when close. */
function v3dWhere(f: LiveFlight, nowIn?: number): { lon: number; lat: number; hdg: number; altM: number; onGround: boolean; phase: string; vs?: number; turn?: number; smooth?: boolean } {
  const sc = V3d.aptScene;
  if (sc && sc.L && sc.planes) {
    const p: ApvPlane = sc.planes.filter((x: ApvPlane) => x.id === f.id)[0];
    if (p) { const ll = sc.lonLat(p.x, p.y); return { lon: ll[0], lat: ll[1], hdg: p.hdg, altM: (sc.L.alt || 0) + (p.alt || 0) * 0.3048, onGround: (p.alt || 0) < 3, phase: p.phase, smooth: true }; }
  }
  const F: any = f;
  let pos: number[], hdg = f.hdg || 0, altFt = f.alt || 0, vs: number = F.vs || 0, turn = 0, smooth = false;
  if (f.real && f.pos) pos = f.pos;
  else {
    const now = Date.now(), pp = F.depAt ? flightPathPos(f, now) : null;
    if (pp) {
      pos = pp.pos; hdg = pp.hdg; smooth = true;
      // every frame from the flight's own profile: the height (not the once-a-second value), the climb or
      // descent, and a heading and turn rate taken over a few seconds so corners in the route are flown smoothly
      try {
        const prof = F.coop ? flightProfile(F.typeId, f.from, f.to, F.depAt) : aiProfile(F);
        const at = (ms: number) => profileAt(prof, flightEl(F, ms).el);
        const q0 = at(now - 2000), q1 = at(now), q2 = at(now + 2000);
        altFt = q1.alt; vs = (q2.alt - q0.alt) / 4 * 60;
        const a = flightPathPos(f, now - 4000), b = flightPathPos(f, now + 4000);
        if (a && b && gcDistanceNm(a.pos, b.pos) > 0.01) {
          hdg = geoBrg(a.pos, b.pos);
          const a2 = flightPathPos(f, now - 8000), b2 = flightPathPos(f, now + 8000);
          if (a2 && b2) { const h1 = geoBrg(a2.pos, pos), h2 = geoBrg(pos, b2.pos); turn = (((h2 - h1) + 540) % 360 - 180) / 8; }   // degrees a second
        }
      } catch (e) { /* the once-a-second values */ }
    } else {
      const A = apt(f.from), B = apt(f.noDest ? f.from : f.to);
      // no drawn path: along the great circle, still worked out every frame from the flight's profile
      let fr = f.t;
      if (F.depAt && !f.noDest) { try { const prof = aiProfile(F), q = profileAt(prof, flightEl(F, now).el); fr = prof.routeNm > 0 ? clamp(q.d / prof.routeNm, 0, 1) : f.t; altFt = q.alt; smooth = true; } catch (e) { /* the once-a-second values */ } }
      pos = gcInterpolate(A.pos, B.pos, fr); hdg = geoBrg(gcInterpolate(A.pos, B.pos, Math.max(0, fr - 0.002)), gcInterpolate(A.pos, B.pos, Math.min(1, fr + 0.002)));
    }
  }
  return { lon: pos[0], lat: pos[1], hdg, altM: altFt * 0.3048, onGround: altFt < 50, phase: String(f.phase || ''), vs, turn, smooth };
}

/* ---------- the ground: see v3d-terrain.ts ---------- */
function v3dGround(lon: number, lat: number): number { return V3dTerrain.ground(lon, lat); }

/* ---------- the airport ---------- */

/** Facades and roofs for the airport buildings, drawn by the app (generic, no real building's design). The wall
 *  pictures are 24 m wide and one building tall; at night the windows glow. */
function v3dBuildingTextures(): any {
  const VA: any = V3d; if (VA.bTex) return VA.bTex;
  const T = THREE, U = v3dSkyUniforms();
  const mk = (w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d')); const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = V3d.r ? V3d.r.capabilities.getMaxAnisotropy() : 4; return t; };
  const noise = (g: CanvasRenderingContext2D, w: number, h: number, a: number) => { for (let i = 0; i < w * h / 6; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * a})`; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1); } };
  // a terminal: a tall glass curtain wall in panels between steel mullions, a solid band at the top, glazed
  // doors at the ground
  const term = (night: boolean) => mk(512, 256, g => {
    g.fillStyle = night ? '#05080C' : '#C9CED4'; g.fillRect(0, 0, 512, 256);
    for (let x = 0; x < 512; x += 32) for (let y = 34; y < 222; y += 47) {
      if (night) { const lit = Math.random() < 0.93; g.fillStyle = lit ? `rgba(255,226,170,${0.62 + Math.random() * 0.12})` : '#06090D'; g.fillRect(x + 2, y + 2, 28, 43); continue; }
      const gr = g.createLinearGradient(x, y, x + 32, y + 47); gr.addColorStop(0, '#5C7891'); gr.addColorStop(0.55, '#7F9CB6'); gr.addColorStop(1, '#4A6278');
      g.fillStyle = gr; g.fillRect(x + 2, y + 2, 28, 43); g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(x + 4, y + 4, 8, 39);
    }
    if (!night) { g.fillStyle = '#AEB5BD'; g.fillRect(0, 0, 512, 32); g.fillStyle = '#8E969F'; g.fillRect(0, 28, 512, 4); g.fillStyle = '#7D858E'; g.fillRect(0, 222, 512, 34); for (let x = 40; x < 512; x += 128) { g.fillStyle = '#3E5468'; g.fillRect(x, 226, 46, 30); } noise(g, 512, 256, 0.05); }
  });
  // smaller buildings: rows of windows in a light rendered wall
  const office = (night: boolean) => mk(512, 256, g => {
    g.fillStyle = night ? '#000000' : '#D8D6D0'; g.fillRect(0, 0, 512, 256);
    if (!night) noise(g, 512, 256, 0.06);
    for (let row = 0; row < 3; row++) for (let x = 12; x < 512; x += 42) {
      const y = 30 + row * 74;
      if (night) { if (Math.random() < 0.55) { g.fillStyle = `rgba(255,${206 + Math.random() * 40},${140 + Math.random() * 70},0.9)`; g.fillRect(x, y, 28, 40); } continue; }
      g.fillStyle = '#4C6176'; g.fillRect(x, y, 28, 40); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x + 2, y + 2, 6, 36); g.fillStyle = '#9C9A94'; g.fillRect(x - 2, y + 40, 32, 3);
    }
  });
  const roofTex = mk(256, 256, g => {
    g.fillStyle = '#9EA2A6'; g.fillRect(0, 0, 256, 256); noise(g, 256, 256, 0.12);
    for (let i = 0; i < 6; i++) { const x = Math.random() * 220, y = Math.random() * 220; g.fillStyle = '#7C8187'; g.fillRect(x, y, 24 + Math.random() * 20, 16 + Math.random() * 14); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x + 3, y + 16, 24, 4); }
  });
  const wallMat = (day: any, night: any, emis: number) => {
    const m = new T.MeshLambertMaterial({ map: day, emissive: new T.Color(0xFFFFFF), emissiveMap: night, emissiveIntensity: emis });
    m.onBeforeCompile = (sh: any) => { sh.uniforms.uLightsOn = U.uLightsOn; sh.fragmentShader = 'uniform float uLightsOn;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance *= uLightsOn;'); };
    return m;
  };
  // the wall pictures repeat every 24 m along a wall and once over its height; the roof every 40 m
  const t1 = term(false), t1n = term(true), o1 = office(false), o1n = office(true);
  // (the walls' heights run from 0 at the ground upwards: the picture the right way up, its bottom at the ground)
  for (const t of [t1, t1n]) { t.repeat.set(1 / 24, -1 / 16); t.offset.set(0, 1 / 16); }
  for (const t of [o1, o1n]) { t.repeat.set(1 / 24, -1 / 12); t.offset.set(0, 1 / 12); }
  roofTex.repeat.set(1 / 40, 1 / 40);
  VA.bTex = { terminal: wallMat(t1, t1n, 1.0), office: wallMat(o1, o1n, 0.9), roof: new T.MeshLambertMaterial({ map: roofTex }) };
  return VA.bTex;
}

function v3dBuildAirport(L: AirportLayout) {
  const T = THREE, g = new T.Group(), e = L.alt || 0;
  v3dNoteSwitch(L);
  (V3d as any).lastL = L; (V3d as any).lastLAt = Date.now();
  const loc = (x: number, y: number) => { const ll = [L.lon + x / (111320 * Math.cos(L.lat * D2R)), L.lat + y / 110540]; return v3dXY(ll[0], ll[1]); };
  // the ground's height where it is known (the terrain may still be loading: then the airport's elevation)
  const gy = (x: number, z: number) => { if (!V3dTerrain.rings.length) return e; const ll = v3dLonLat(x, z); return V3dTerrain.ground(ll[0], ll[1]) - v3dCurve(x, z); };
  // terminals and other buildings
  // generic airport buildings: glass and steel terminal fronts (large buildings) or office windows (smaller
  // ones), a light roof with plant on it; the windows lit at night
  let bTex: any = null; try { bTex = v3dBuildingTextures(); } catch (e) { /* plain buildings */ }
  // all the buildings are joined into three pieces (roofs, terminal fronts, office walls), so the phone handles three
  // things to draw instead of two for every building (BufferGeometryUtils; each building on its own if that fails)
  const joinB: { roof: any[]; terminal: any[]; office: any[] } = { roof: [], terminal: [], office: [] }, BGU: any = (window as any).BufferGeometryUtils;
  const part = (geo: any, gr: any) => { const o = new T.BufferGeometry(); for (const k of ['position', 'normal', 'uv']) { const at = geo.attributes[k]; if (!at) continue; o.setAttribute(k, new T.BufferAttribute(at.array.slice(gr.start * at.itemSize, (gr.start + gr.count) * at.itemSize), at.itemSize)); } return o; };
  for (const a of L.areas || []) {
    if (a.k === 'apron' || a.pts.length < 3) continue;
    try {   // one odd building outline never stops the rest of the airport
    const sh = new T.Shape(a.pts.map(p => { const q = loc(p[0], p[1]); return new T.Vector2(q[0], -q[1]); }));
    const c = loc(a.pts[0][0], a.pts[0][1]);
    let area = 0; for (let i = 0, n = a.pts.length; i < n; i++) { const p = a.pts[i], q = a.pts[(i + 1) % n]; area += p[0] * q[1] - q[0] * p[1]; } area = Math.abs(area) / 2;
    const big = area > 6000, hgt = big ? 16 : area > 1500 ? 12 : 9;
    const geo = new T.ExtrudeGeometry(sh, { depth: hgt, bevelEnabled: false }); geo.rotateX(-Math.PI / 2); geo.translate(0, gy(c[0], c[1]) - 0.5, 0);
    if (bTex && BGU && BGU.mergeGeometries && !geo.index && geo.groups.length >= 2) {
      for (const gr of geo.groups) (gr.materialIndex === 0 ? joinB.roof : big ? joinB.terminal : joinB.office).push(part(geo, gr));
      geo.dispose();
    } else { const bm = new T.Mesh(geo, bTex ? [bTex.roof, big ? bTex.terminal : bTex.office] : new T.MeshLambertMaterial({ color: 0xC9CDD2 })); bm.renderOrder = 9; g.add(bm); }
    } catch (e) { /* skip this building */ }
  }
  for (const k of ['roof', 'terminal', 'office'] as ('roof' | 'terminal' | 'office')[]) {
    const list = joinB[k]; if (!list.length) continue;
    try { const m = new T.Mesh(BGU.mergeGeometries(list, false), bTex[k]); m.renderOrder = 9; g.add(m); for (const geo of list) geo.dispose(); }
    catch (e) { for (const geo of list) { const m = new T.Mesh(geo, bTex[k]); m.renderOrder = 9; g.add(m); } }
  }
  // the airport's ground paint, drawn from its own layout into one picture and laid over the terrain like a sheet
  try { const lt = v3dAirportLights(L, loc, gy); if (lt) g.add(lt); } catch (e) { /* no lights */ }
  try { v3dCrashBuild(L, loc, gy, g); } catch (e) { /* no crash site */ }
  try { g.add(v3dGroundPaint(L, loc, gy)); } catch (x) { try { const sheet = airportSheet(L, loc, gy); if (sheet) g.add(sheet); } catch (y) { /* never stop the view */ } }
  // runways: strips that follow the ground, painted with the markings their size calls for, numbers always
  for (const r of L.runways) {
    if (r.surf === 9) continue;   // water runways have no paint
    const tex = new T.CanvasTexture(runwayMarkingsCanvas(r)); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = V3d.r ? V3d.r.capabilities.getMaxAnisotropy() : 4;
    const segs = Math.max(2, Math.ceil(r.len / 40)), geo = new T.PlaneGeometry(r.wid || 45, r.len, 2, segs); geo.rotateX(-Math.PI / 2);
    const q = v3dXY(r.lon, r.lat), a = -r.hdg * D2R, cs = Math.cos(a), sn = Math.sin(a), pos = geo.attributes.position;
    for (let k = 0; k < pos.count; k++) { const x = pos.getX(k), z = pos.getZ(k), wx = q[0] + x * cs + z * sn, wz = q[1] - x * sn + z * cs; pos.setXYZ(k, wx, gy(wx, wz) + 0.5, wz); }
    pos.needsUpdate = true; geo.computeBoundingSphere();
    const m = new T.Mesh(geo, new T.MeshBasicMaterial({ map: tex, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 })); m.renderOrder = 4;
    g.add(m); (g.userData.rwyMats = g.userData.rwyMats || []).push(m.material);   // darker when wet (v3d-wet.ts)
  }
  // the airport built before goes (its geometry and its own pictures; the buildings' shared facade materials stay)
  if (V3d.airport) { V3d.scene.remove(V3d.airport); V3d.airport.traverse((o: any) => { try { if (o.geometry) o.geometry.dispose(); if (o.material && !Array.isArray(o.material) && o.material.map && o.material.map.dispose) o.material.map.dispose(); } catch (e) { /* gone already */ } }); }
  try { g.traverse((o: any) => { if (o.isMesh && o.material && o.material.isMeshBasicMaterial) v3dSpotHook(o.material); }); } catch (e) { /* plain */ }
  V3d.airport = g; V3d.scene.add(g);
  try { v3dAirportPatch(); } catch (x) { /* never stop the view */ }
}

/** The airport's ground as one picture: aprons (concrete), taxiways (asphalt with shoulders, joined with
 *  round corners), yellow taxiway centre lines, stand lead-in lines and numbers, and runway holding
 *  positions. Laid on a grid that follows the terrain, so nothing sinks into it or floats above it. */
function airportSheet(L: AirportLayout, loc: (x: number, y: number) => number[], gy: (x: number, z: number) => number): any {
  const T = THREE;
  // the airport's extent (metres east/north of its reference point), with a margin
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  const add = (x: number, y: number) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); };
  (L.points || []).forEach(p => add(p[0], p[1])); (L.areas || []).forEach(a => a.pts.forEach(p => add(p[0], p[1]))); (L.parks || []).forEach(p => add(p[0], p[1]));
  if (x1 < x0) return null;
  x0 -= 80; y0 -= 80; x1 += 80; y1 += 80;
  const W = x1 - x0, H = y1 - y0, cap = v3dTexCap(), k = Math.min(cap / W, cap / H, 4);   // pixels a metre (at most 4)
  const cv = document.createElement('canvas'); cv.width = Math.ceil(W * k); cv.height = Math.ceil(H * k);
  const c = cv.getContext('2d'), X = (x: number) => (x - x0) * k, Y = (y: number) => (y1 - y) * k;
  c.lineCap = 'round'; c.lineJoin = 'round';
  // aprons: light concrete with a faint slab pattern
  for (const a of L.areas || []) {
    if (a.k !== 'apron' || a.pts.length < 3) continue;
    c.beginPath(); a.pts.forEach((p, i) => i ? c.lineTo(X(p[0]), Y(p[1])) : c.moveTo(X(p[0]), Y(p[1]))); c.closePath();
    c.fillStyle = '#8E9399'; c.fill();
    c.save(); c.clip(); c.strokeStyle = 'rgba(60,64,70,.18)'; c.lineWidth = Math.max(1, k * 0.15);
    for (let x = Math.floor(x0 / 7.5) * 7.5; x < x1; x += 7.5) { c.beginPath(); c.moveTo(X(x), 0); c.lineTo(X(x), cv.height); c.stroke(); }
    for (let y = Math.floor(y0 / 7.5) * 7.5; y < y1; y += 7.5) { c.beginPath(); c.moveTo(0, Y(y)); c.lineTo(cv.width, Y(y)); c.stroke(); }
    c.restore();
  }
  // the same lines as the 2D map: taxiways (types 1 and 4, between two taxi points), stand connectors
  // (type 3, from a taxi point to a STAND: its end is a stand number, not a point) and the painted
  // lead-in lines to the stands (type 9, thin yellow lines on the apron, no pavement of their own)
  const osm = L.source === 'osm';
  const taxi = (L.paths || []).filter(p => (p[0] === 1 || p[0] === 4) && L.points[p[2]] && L.points[p[3]]);
  const conn = osm ? [] : (L.paths || []).filter(p => p[0] === 3 && L.points[p[2]] && L.parks && L.parks[p[3]]);
  const leads = (L.paths || []).filter(p => p[0] === 9 && L.points[p[2]] && L.points[p[3]]);
  const seg = (p: number[]) => { const A = L.points[p[2]], B = L.points[p[3]]; c.beginPath(); c.moveTo(X(A[0]), Y(A[1])); c.lineTo(X(B[0]), Y(B[1])); };
  const segC = (p: number[]) => { const A = L.points[p[2]], B = L.parks[p[3]]; c.beginPath(); c.moveTo(X(A[0]), Y(A[1])); c.lineTo(X(B[0]), Y(B[1])); };
  const tw = (p: number[]) => Math.min(40, Math.max(10, p[1] || 18));
  // taxiway pavement: a slightly lighter shoulder, then the asphalt (round joins: no gaps, no overlaps)
  for (const p of taxi) { seg(p); c.strokeStyle = '#5E636A'; c.lineWidth = (tw(p) + 6) * k; c.stroke(); }
  for (const p of conn) { segC(p); c.strokeStyle = '#4A4F56'; c.lineWidth = Math.max(10, p[1] || 12) * k; c.stroke(); }
  for (const p of taxi) { seg(p); c.strokeStyle = '#3B4047'; c.lineWidth = tw(p) * k; c.stroke(); }
  // the yellow lines: taxiway centre lines, connectors and lead-in lines, all thin, as painted
  const lw = Math.max(1.2, 0.3 * k);
  c.strokeStyle = '#E8B730'; c.lineWidth = lw;
  for (const p of taxi) { seg(p); c.stroke(); }
  for (const p of conn) { segC(p); c.stroke(); }
  for (const p of leads) { seg(p); c.stroke(); }
  // stands: a stop bar, the stand number, and (where the map has no lead-in lines) a short lead-in
  c.font = `700 ${Math.max(8, 3 * k)}px Arial, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  (L.parks || []).forEach(pk => {
    const h = (pk[2] || 0) * D2R, ux = Math.sin(h), uy = Math.cos(h), r = pk[3] || 15;
    c.strokeStyle = '#E8B730';
    if (!osm) { c.lineWidth = lw; c.beginPath(); c.moveTo(X(pk[0] - ux * r * 2.2), Y(pk[1] - uy * r * 2.2)); c.lineTo(X(pk[0]), Y(pk[1])); c.stroke(); }
    c.lineWidth = Math.max(2, 0.5 * k); c.beginPath(); c.moveTo(X(pk[0] - uy * r * 0.35), Y(pk[1] + ux * r * 0.35)); c.lineTo(X(pk[0] + uy * r * 0.35), Y(pk[1] - ux * r * 0.35)); c.stroke();
    const name = L.parkNames && pk[6] != null ? L.parkNames[pk[6]] : pk[6] != null ? String(pk[6]) : '';
    if (name && k >= 1.5) { c.fillStyle = '#F4D35E'; c.save(); c.translate(X(pk[0] - ux * r * 1.4), Y(pk[1] - uy * r * 1.4)); c.rotate(h); c.fillText(name, 0, 0); c.restore(); }
  });
  // runway holding positions: two solid and two dashed yellow lines across the taxiway
  for (const r of L.runways) {
    if (r.surf === 9 || r.surf === 1) continue;
    const cx = (r.lon - L.lon) * 111320 * Math.cos(L.lat * D2R), cy = (r.lat - L.lat) * 110540, ux = Math.sin(r.hdg * D2R), uy = Math.cos(r.hdg * D2R), half = r.len / 2, hw = (r.wid || 45) / 2;
    const hold = hw + ((r.wid || 45) >= 40 ? 65 : (r.wid || 45) >= 25 ? 45 : 30);
    const side = (x: number, y: number) => ({ along: (x - cx) * ux + (y - cy) * uy, across: -(x - cx) * uy + (y - cy) * ux });
    for (const p of taxi) {
      const A = L.points[p[2]], B = L.points[p[3]], a = side(A[0], A[1]), b = side(B[0], B[1]);
      const onA = Math.abs(a.across) < hw + 8 && Math.abs(a.along) < half, onB = Math.abs(b.across) < hw + 8 && Math.abs(b.along) < half;
      if (onA === onB) continue;
      const on = onA ? a : b, off = onA ? b : a, P0 = onA ? A : B, P1 = onA ? B : A;
      if (Math.abs(off.across) < hold) continue;
      const t = (hold - Math.abs(on.across)) / (Math.abs(off.across) - Math.abs(on.across)), hx = P0[0] + (P1[0] - P0[0]) * t, hy = P0[1] + (P1[1] - P0[1]) * t;
      const dx = P1[0] - P0[0], dy = P1[1] - P0[1], dl = Math.hypot(dx, dy) || 1, tx = dx / dl, ty = dy / dl, nx = -ty, ny = tx, w = tw(p) / 2 + 3;
      c.strokeStyle = '#E8B730'; c.lineWidth = Math.max(1.2, 0.3 * k); c.lineCap = 'butt';
      // (t points away from the runway) dashed pair nearer the runway, solid pair on the taxiway side
      [[0.0, true], [0.6, true], [1.3, false], [1.9, false]].forEach(([o, dash]) => {
        const ox = hx + tx * (o as number), oy = hy + ty * (o as number);
        c.setLineDash(dash ? [Math.max(2, 0.9 * k), Math.max(2, 0.9 * k)] : []);
        c.beginPath(); c.moveTo(X(ox - nx * w), Y(oy - ny * w)); c.lineTo(X(ox + nx * w), Y(oy + ny * w)); c.stroke();
      });
      c.setLineDash([]); c.lineCap = 'round';
    }
  }
  // the sheet: a grid over the airport that follows the terrain
  const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = V3d.r ? V3d.r.capabilities.getMaxAnisotropy() : 4;
  tex.onUpdate = () => { tex.onUpdate = null; setTimeout(() => { try { cv.width = 1; cv.height = 1; } catch (e) { /* ignore */ } }, 0); };
  const nx = Math.min(120, Math.ceil(W / 40)), ny = Math.min(120, Math.ceil(H / 40)), pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    const mx = x0 + W * i / nx, my = y0 + H * j / ny, q = loc(mx, my);
    pos.push(q[0], gy(q[0], q[1]) + 0.35, q[1]); uv.push(i / nx, j / ny);
  }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + 1, d = a + nx + 1, e2 = d + 1; idx.push(a, d, b, b, d, e2); }
  const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeBoundingSphere();
  const m = new T.Mesh(geo, new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, side: T.DoubleSide }));
  m.renderOrder = 3;
  return m;
}

/** The airport you are looking at was drawn again from a different layout (a better one arrived, or it was
 *  wrong): APT-02 in Settings > Updates and errors, with what was shown before and after, ready to copy. */
function v3dNoteSwitch(L: AirportLayout) {
  const VP: any = V3d, P: AirportLayout = VP.lastL;
  if (!P || !L || P === L || String(P.icao) !== String(L.icao) || !V3d.airport) return;
  const shownS = (Date.now() - (VP.lastLAt || Date.now())) / 1000;
  if (shownS < 2) return;   // replaced before it was really seen
  const sig = (x: AirportLayout) => `${x.source}${x.gen ? ' (taxiways laid out from the runways)' : ''}, "${x.name || ''}", ${(x.runways || []).length} runways (${(x.runways || []).map(r => `${r.a}/${r.b}`).join(', ')}), ${(x.parks || []).length} stands, ${(x.areas || []).filter(a => a.k === 'terminal').length} terminal buildings`;
  const a: any = apt(L.icao), f: any = (() => { try { return v3dAptOnly() || v3dTargetFlight(); } catch (e) { return null; } })();
  let where = ''; try { const w = f ? v3dWhere(f) : null; if (w && a) where = `${(gcDistanceNm([w.lon, w.lat], a.pos)).toFixed(1)} nm from the airport, ${Math.round(w.altM * 3.281)} ft, ${w.onGround ? 'on the ground' : 'flying'} (${w.phase || ''})`; } catch (e) { /* unknown */ }
  try {
    ErrorLog.add('3d', `APT-02 · ${a ? a.name : L.icao}: the airport changed while in view`,
      `${L.icao} was shown for ${Math.round(shownS)} s with ${P.source === 'runways' ? 'a layout made from its runways only' : P.source === 'osm' ? 'the OpenStreetMap layout' : 'Flight Simulator\'s layout'}, then drawn again with ${L.source === 'sim' ? 'Flight Simulator\'s layout' : L.source === 'osm' ? 'the OpenStreetMap layout' : 'its runways only'}.`,
      [`Code: APT-02 (airport layout replaced while shown)`, `Airport: ${L.icao}`, `Before: ${sig(P)}`, `After: ${sig(L)}`, `Shown for: ${shownS.toFixed(1)} s`, f ? `Flight: ${f.code || f.id} ${f.from}-${f.to}, ${where}` : '', `View: ${V3d.mode}`, `App ${APP.version}, linked: ${Link.status}`].filter(Boolean).join('\n'));
  } catch (e) { /* no log */ }
}

/** Time to move the view's centre: well before the finest ground (about 25 km across) runs out under you, so the
 *  detail round you never changes; the swap then only moves the far edges of the rings, out in the haze. While the
 *  last move is still loading, the next waits (unless you are close to the edge of the fine ground). */
function v3dNeedRecentre(w: { lon: number; lat: number }): boolean {
  const d = gcDistanceNm(V3d.origin, [w.lon, w.lat]) * 1.852, half = 2.5 * 40075 / 4096 * Math.cos(w.lat * D2R);   // km
  const busy = !V3dTerrain.done || !!(V3dTerrain as any).old;
  return busy ? d > half * 0.75 : d > half * 0.35;
}
/** Centre the view on an airport (its layout, its aircraft on the ground) or on open country. */
function v3dRecentre(f: LiveFlight, w: { lon: number; lat: number }) {
  const ctr = v3dCentre(f, [w.lon, w.lat]);
  V3d.origin = ctr.pos.slice(); V3d.icao = ctr.icao; V3d.elev = 0;
  if (V3d.airport) { V3d.scene.remove(V3d.airport); V3d.airport = null; }
  const VP: any = V3d; if (VP.patch) { V3d.scene.remove(VP.patch); try { VP.patch.geometry.dispose(); VP.patch.material.map.dispose(); } catch (e) { /* ignore */ } VP.patch = null; } _patch.at = null; _patch.busy = false;
  V3d.aptScene = null;
  if (ctr.icao) {
    const m = V3d.map || _curMap();
    try { V3d.aptScene = m ? (m.scenes[ctr.icao] || (m.scenes[ctr.icao] = makeAirportScene(ctr.icao, m))) : null; } catch (e) { V3d.aptScene = null; }
    AirportLayouts.get(ctr.icao, (better: AirportLayout) => { if (better && V3d.open && V3d.icao === ctr.icao) { V3d.elev = better.alt || 0; v3dBuildAirport(better); } })
      .then((L: AirportLayout) => { if (!V3d.open || V3d.icao !== ctr.icao) return; if (L) { V3d.elev = L.alt || 0; v3dBuildAirport(L); } V3d.aptReady = true; V3dTerrain.prog.got++; V3dTerrain.load(V3d.origin); })
      .catch(() => { if (V3d.open && V3d.icao === ctr.icao) { V3d.aptReady = true; V3dTerrain.load(V3d.origin); } });
  } else V3dTerrain.load(V3d.origin);
  // every aircraft moves to the new centre
  for (const id in V3d.planes) V3d.planes[id].pos = null;
}

/* ---------- each frame ---------- */

/** Build the whole 3D view again (with its loading screen), where you were: the same aircraft or place, the same
 *  camera. Used when a setting that the scene is built with has changed (3D or 2D clouds). */
function v3dReloadAll() {
  const VV: any = V3d; VV.cloudReload = false; if (!V3d.open || !V3d.target) return;
  const id = V3d.target, map = V3d.map, mode = V3d.mode, yaw = V3d.yaw, pitch = V3d.pitch, dist = V3d.dist;
  try { v3dOpen(id, map); } catch (e) { return; }
  const t0 = performance.now(), back = () => {
    if (!V3d.open || V3d.target !== id) return;
    if (!V3d.loaded) { if (performance.now() - t0 < 120000) setTimeout(back, 300); return; }
    try { if (mode && mode !== V3d.mode) { const b = document.createElement('b'); b.setAttribute('data-m', mode); ACTIONS['v3d-mode'](b, null as any); } } catch (e) { /* the default view */ }
    V3d.yaw = yaw; V3d.pitch = pitch; if (dist) V3d.dist = dist;
  };
  setTimeout(back, 300);
}
function v3dLoop(now: number) {
  if (!V3d.open) return;
  V3d.raf = requestAnimationFrame(v3dLoop);
  if ((V3d as any).cloudReload && !document.querySelector('#set-body')) { v3dReloadAll(); return; }   // the clouds changed between 3D and 2D: once out of the settings, everything again
  const VP: any = (V3d as any).perf, gen = FrameGen.on() && (!(V3d as any).dprWas || FrameGen.mode() === 'on'); if (VP) VP.genCap = gameBoost() ? 0 : V3D_FPS;   // frame generation fills the screen's other frames (not in the cabin)
  if (document.hidden || now - V3d.last < 1000 / (gameBoost() || gen ? 60 : V3D_FPS) - 2) return;
  if (Perf.skip((V3d as any).perf, now)) return;   // warm, or saving battery: fewer frames
  const dt = V3d.last ? Math.min(0.2, (now - V3d.last) / 1000) : 0; V3d.last = now;
  // frame generation: a made frame only moves the camera (from your input); the aircraft, the sky, the weather and
  // the rest are worked out on the real frames, so made frames cost next to nothing
  let made = V3d.loaded && FrameGen.plan(VP, now) === 'made';
  V3d.frames = (V3d.frames || 0) + 1;   // counted for the Game Booster's frame-rate chart
  if (V3d.root && V3d.root.getAttribute('data-m') !== V3d.mode) { V3d.root.setAttribute('data-m', V3d.mode); if (!/^(walk|free)$/.test(V3d.mode)) v3dUi(true); }
  const T = THREE, VK: any = V3d;
  let f: any = v3dAptOnly() || v3dTargetFlight();
  // the flight has ended: the aircraft stays where it parked and every camera, drag and the controller still work
  if (f) { VK.lastF = f; VK.parkedAt = 0; }
  else if (VK.lastF && VK.lastF.id === V3d.target && VK.lastW) { f = VK.lastF; if (!VK.parkedAt) { VK.parkedAt = now; const st = V3d.root.querySelector('.v3d-status'); if (st) st.textContent = 'Parked: this flight has ended'; } }
  if (!f) { const st = V3d.root.querySelector('.v3d-status'); if (st) st.textContent = 'This flight has ended'; V3d.r.render(V3d.scene, V3d.cam); return; }
  const parked = !!VK.parkedAt;
  const w0 = parked ? Object.assign({}, VK.lastW, { onGround: true, phase: 'parked', vs: 0, turn: 0 }) : v3dWhere(f);
  if (!parked) VK.lastW = w0;
  // the centre: follow the aircraft to the next airport, or move with it over open country
  const ctr = v3dCentre(f, [w0.lon, w0.lat]);
  if (V3d.mode === 'free' && V3d.origin) v3dFreeRecentre();
  else if (!V3d.origin || ctr.icao !== V3d.icao || (!ctr.icao && v3dNeedRecentre(w0))) { v3dRecentre(f, w0); if (made) { made = false; VP.plan = 'real'; } }   // a new centre: every aircraft moves to it, so a real frame
  if (!made) v3dPrefetch(f, w0);
  if (!made && V3d.aptScene && V3d.aptScene.L) { try { V3d.aptScene.computePlanes(Date.now()); } catch (e) { /* not ready */ } }
  v3dLoaderTick(now);
  try { v3dWetTick(now); } catch (e) { /* dry */ }

  // aircraft within about 40 km
  const seen: { [id: string]: boolean } = {};
  // other airlines' aircraft: only those near enough and in front of the camera are drawn (on a made frame only the
  // one you follow moves on, so the picture can carry it along smoothly; the rest wait for the next real frame)
  const tfc = made ? [] : Traffic.live(), fr = new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(V3d.cam.projectionMatrix, V3d.cam.matrixWorldInverse));
  const tfcNear = tfc.filter((g: any) => { const a = apt(g.from), b = apt(g.to); if (!a || !b || !V3d.origin) return false; const pp = flightPathPos(g); if (!pp) return false; g._ll = pp.pos; return gcDistanceNm(V3d.origin, pp.pos) < 24; });
  for (const g of made ? [f] : (State.live as any[]).concat(tfcNear, parked ? [f] : [])) {
    const w = g.id === f.id ? w0 : v3dWhere(g);
    const q = v3dXY(w.lon, w.lat); if (Math.hypot(q[0], q[1]) > 40000 && g.id !== f.id) continue;
    if ((g as any).tfc && g.id !== f.id) {   // the one you follow is always drawn (the camera is placed from it)
      const inView = fr.containsPoint(new T.Vector3(q[0], w.altM, q[1])) || fr.intersectsSphere(new T.Sphere(new T.Vector3(q[0], w.altM, q[1]), 80));
      if (!inView) { const P0 = V3d.planes[g.id]; if (P0) { seen[g.id] = true; P0.model.visible = false; P0.label.style.display = 'none'; } continue; }
    }
    seen[g.id] = true;
    let P = V3d.planes[g.id];
    if (P && (g as any).tfc && !P.model.visible) { P.model.visible = true; P.label.style.display = ''; }
    const typeId = flightTypeId(g);
    if (!P) {
      const a = plane(g.reg), c: any = a ? company(a.companyId) : (g as any).tfc ? { color: (g as any).tfc.color, color2: (g as any).tfc.color2, id: (g as any).tfc.airline } : company();
      // the model is built from its nose; a pivot in its middle places and turns it
      const tc: any = (g as any).tfc, body = buildAircraftModel(typeId, tc && tc.dcode ? realLivery(tc.dcode, tc.color) : liveryFor(c.color, c.color2, c.id)), model = new T.Group();
      body.position.x = -shapeOf(typeId).L / 2; model.add(body); model.userData.body = body;
      body.traverse((o: any) => { o.renderOrder = 10; });   // after the airport's ground paint
      try { v3dPlaneLightsAdd(body, typeId); } catch (e) { /* no lights */ }
      model.userData.flightId = g.id; model.userData.set = body.userData.set;
      V3d.scene.add(model);
      const lab = document.createElement('span'); lab.className = 'v3d-lab' + ((g as any).tfc ? ' tfc' : ''); lab.textContent = (g as any).tfc ? `${tfcLabel((g as any).tfc)} ${g.callsign}` : g.callsign; V3d.root.querySelector('.v3d-labels').appendChild(lab);
      P = V3d.planes[g.id] = { id: g.id, model, type: typeId, pos: null, tgt: new T.Vector3(), hdg: w.hdg, tgtHdg: w.hdg, bank: 0, pitch: 0, flaps: 0, gear: 1, label: lab, seen: now };
    }
    const s = shapeOf(P.type);
    // never below the ground (or the runway), wheels on it when rolling
    // the drawn surface (the runway and taxiways sit half a metre above it), so wheels are on what you see
    const ground = V3dTerrain.rings.length ? v3dGround(w.lon, w.lat) + 0.5 : (V3d.icao ? V3d.elev : 0);
    let y = w.onGround ? ground : Math.max(ground + 2, w.altM);
    // flights the app flies itself keep clear of high ground: never lower than about 1,000 ft over the terrain
    // under them and just ahead, except close to the airports, where they are on the runway's own path
    // (your flight in the simulator is shown exactly where the simulator has it)
    if (!(g as any).real && V3dTerrain.rings.length) {
      const PT: any = P; let lift = 0;
      if (!w.onGround) try {
        const h = w.hdg, here = [w.lon, w.lat];
        const ap = [g.from, g.to].map(k => { const a = apt(k); return a && a.pos ? gcDistanceNm(here, a.pos) : 99; }), dA = Math.min(ap[0], ap[1]);
        // away from the airports: the ground under them and up to 2.4 nm ahead; within 6 nm of an airport only the
        // ground right under them (the hills beside and beyond the runway must not hold an aircraft up on final),
        // and the margin fades away to nothing on final so it follows the runway's own approach path down
        const ahead = dA < 6 ? [] : [0.8, 1.6, 2.4];
        const T0 = Math.max(v3dGround(w.lon, w.lat), ...ahead.map(nm => { const a = geoDest(here, h, nm); return v3dGround(a[0], a[1]); }));
        const clear = dA < 6 ? 60 * clamp((dA - 2) / 4, 0, 1) : 300 * clamp((dA - 1.5) / 4, 0, 1) + 60;
        lift = clear > 0 ? Math.max(0, T0 + clear - y) : 0;
      } catch (e) { /* no terrain here */ }
      // eased both ways: what is left at touchdown goes in a second or two, never in one step
      PT.lift = (PT.lift || 0) + (lift - (PT.lift || 0)) * Math.min(1, (typeof dt === 'number' ? dt : 0.05) * (lift > (PT.lift || 0) ? 1.2 : 1.6));
      if (PT.lift < 0.05) PT.lift = 0;
      y += PT.lift;
    }
    P.tgt.set(q[0], y - v3dCurve(q[0], q[1]), q[1]);
    if (!P.pos) P.pos = P.tgt.clone();
    // a hired pilot's flight is worked out every frame, so it is placed exactly; your own flight's position
    // comes from the simulator a few times a second, so it glides to each new one
    if (w.smooth || P.pos.distanceTo(P.tgt) > 3000) P.pos.copy(P.tgt);
    else {
      // a new position arrives about once a second: work out the speed between updates and carry the
      // aircraft on at that speed, so it glides evenly instead of jumping to each update
      const PP: any = P, tnow = now / 1000;
      if (!PP.lastTgt || PP.lastTgt.distanceTo(P.tgt) > 0.3) {
        if (PP.lastTgt && PP.lastT && tnow - PP.lastT > 0.05 && tnow - PP.lastT < 5) {
          const v = P.tgt.clone().sub(PP.lastTgt).divideScalar(tnow - PP.lastT);
          PP.vel = PP.vel ? PP.vel.lerp(v, 0.5) : v;
        }
        PP.lastTgt = P.tgt.clone(); PP.lastT = tnow;
      }
      const ahead = PP.vel && PP.lastT ? Math.min(2, tnow - PP.lastT) : 0;
      const want = PP.vel ? P.tgt.clone().add(PP.vel.clone().multiplyScalar(ahead)) : P.tgt;
      P.pos.lerp(want, Math.min(1, dt * 6));
    }
    let dh = ((w.hdg - P.hdg + 540) % 360) - 180;
    P.hdg = w.smooth ? (P.hdg + dh * Math.min(1, dt * 6) + 360) % 360 : (P.hdg + dh * Math.min(1, dt * 2.5) + 360) % 360;
    // bank from the rate of turn (a standard-rate turn, 3° a second, is about 25° of bank in an airliner)
    const wantBank = w.smooth && w.turn != null ? clamp(w.turn * 8, -25, 25) : clamp(dh * 1.6, -25, 25);
    P.bank += (wantBank * (w.onGround ? 0 : 1) - P.bank) * Math.min(1, dt * 1.2);
    const vs = w.vs != null ? w.vs : (g as any).vs || 0, gs = Math.max(60, g.gs || 140);
    const ph = w.phase.toLowerCase();
    (P as any).ph = ph; (P as any).kt = g.gs || 0;
    // touchdown: the flare raises the nose over the last few metres, the main wheels touch first, the nose
    // stays up for a moment and is then lowered onto the runway
    const PS: any = P, agl = w.altM - ground;
    if (!w.onGround && agl > 3) PS.air = true;
    let touched = false;
    if (w.onGround && PS.air && (g.gs || 140) > 50 && s.gear && !s.gear.fixed) { PS.air = false; PS.tdAt = now; touched = true; }
    const landing = /final|landing|touchdown|flare/.test(ph) && !/take-?off|lift-?off|climb/.test(ph);
    // in the air: the flight path plus the wing's angle of attack (about 5° slow with flaps out, 2.5° at cruise),
    // so an airliner on a 3° approach flies about 2° nose up, as real ones do
    const slow = landing || /approach|take-?off|lift-?off|initial/.test(ph) || gs < 190;
    let pitchT = clamp(Math.atan2(vs / 196.85, gs * 0.5144) / D2R + (w.onGround ? 0 : slow ? 5 : 2.5), -6, 15);
    const flareDeg = s.gear && s.gear.fixed ? 4 : 5.5;
    if (!w.onGround && landing && agl < 25) pitchT = Math.max(pitchT, 2.5 + (flareDeg - 2.5) * clamp((25 - agl) / 20, 0, 1));
    if (w.onGround && PS.tdAt && now - PS.tdAt < 6000) pitchT = Math.max(pitchT, flareDeg * clamp(1 - (now - PS.tdAt - 1200) / 3500, 0, 1));
    P.pitch += (pitchT - P.pitch) * Math.min(1, dt * (w.onGround && PS.tdAt && now - PS.tdAt < 6000 ? 2.5 : 1.5));
    // flaps and gear by phase (the type's own speeds in flight-configs when available)
    try { v3dPlaneLightsSet(P.model, ph, (w.altM - ground) / 0.3048, w.onGround, w.altM / 0.3048, g.gs); } catch (e) { /* no lights */ }
    const cfg = flightConfig(P.type, ph, (g as any).ias || g.gs || 0, (w.altM - ground) / 0.3048, w.onGround);
    // your own flight: the flaps and gear as they are in the simulator
    const simCfg = g.you && g.real && Link.sim && Link.sim.lat ? { f: clamp((Link.sim.flapsIndex || 0) / Math.max(1, (configSpec(P.type) || { flaps: [1, 2, 3, 4] } as any).flaps.length), 0, 1), g: Link.sim.gearDown ? 1 : 0 } : null;
    const wantF = simCfg ? simCfg.f : cfg ? cfg.flaps : /final|landing|touchdown|roll/.test(ph) ? 1 : /approach|take-?off|lift-?off/.test(ph) ? 0.4 : /taxi|pushback|gate|boarding/.test(ph) ? (/out/.test(ph) ? 0.3 : 0) : 0;
    const wantG = simCfg ? simCfg.g : cfg ? cfg.gear : w.onGround || /final|landing|touchdown|lift-?off|take-?off/.test(ph) || (w.altM - ground < 600 && !/cruise|climb/.test(ph)) ? 1 : 0;
    P.flaps += (wantF - P.flaps) * Math.min(1, dt * 0.35); P.gear += (wantG - P.gear) * Math.min(1, dt * 0.25);
    (P.model.userData as any).gearNow = P.gear;
    // spoilers: only up on the runway after touchdown, down again as the aircraft slows to taxi speed
    const PSp: any = P, wantSp = w.onGround && /touchdown|landing|roll/.test(ph) && !/take-?off/.test(ph) && (g.gs || 0) > 35 ? 1 : 0;
    PSp.spoil = (PSp.spoil || 0) + (wantSp - (PSp.spoil || 0)) * Math.min(1, dt * (wantSp ? 6 : 1.5));
    // reverse thrust: jet airliners open their reversers two seconds after touchdown and close them again
    // as the aircraft slows to about 70 kt (types without reversers have none to open)
    const PR: any = P, revPts = P.model.userData.body && P.model.userData.body.userData.revPts;
    const wantRev = revPts && revPts.length && w.onGround && PR.tdAt && now - PR.tdAt > 2000 && /touchdown|landing|roll/.test(ph) && (g.gs || 0) > 70 ? 1 : 0;
    PR.rev = (PR.rev || 0) + (wantRev - (PR.rev || 0)) * Math.min(1, dt * (wantRev ? 2.2 : 1.1));
    // failures and emergencies: an engine on fire, a stopped engine, fire crews on the runway, the tow in
    let fireI = -1, outI = -1, feI: any = null;
    try { const FF: any = g; feI = FF.depAt && !FF.real && !FF.you ? flightEl(FF, Date.now()) : null; fireI = engineFire(FF, feI ? feI.el : undefined); outI = engineOut(FF, feI ? feI.el : undefined); } catch (e) { /* none */ }
    // floatplanes with wheels in their floats: wheels down to land on a runway (and on it), up for water
    const PA: any = P; if (s.gear && s.gear.floats) { const wantA = v3dAmphibWheels(g, w, ph); PA.amph = PA.amph == null ? wantA : PA.amph + (wantA - PA.amph) * Math.min(1, dt * 0.6); }
    if (P.model.userData.set) P.model.userData.set({ flaps: P.flaps, gear: P.gear, spin: now / 18, spoilers: PSp.spoil, reverse: PR.rev, stopped: outI, amphib: PA.amph } as any);
    try { v3dEmergencyStep(P, g, fireI, feI, now, ground, w); } catch (e) { /* no effects */ }
    try { v3dContrailStep(P, g, w, now); } catch (e) { /* no trail */ }
    try { v3dHazeStep(P, w, now); } catch (e) { /* no haze */ }
    try { v3dGroundStep(P, g, w, now); } catch (e) { /* no vehicles */ }
    try { (P as any).reg = g.reg; v3dLodStep(P); } catch (e) { /* full model */ }
    // the air blown forward out of the open reversers kicks up spray and dust from the runway
    if (PR.rev > 0.6 && now - (PR.revAt || 0) > 90) {
      PR.revAt = now; const body = P.model.userData.body; body.updateMatrixWorld();
      const h = P.hdg * D2R, fx = Math.sin(h), fz = -Math.cos(h);
      for (const lp of revPts) { const wp = body.localToWorld(lp.clone()); v3dSmokePuff(wp.x + fx * 4, ground + 0.8, wp.z + fz * 4, 0.55 * PR.rev); }
    }
    // on the ground the aircraft is placed by its nose wheel (on the line, on the stand's stop mark), in the
    // air by the middle of the fuselage; between the two it blends over the last 30 m, so nothing jumps
    const PG: any = P, gwT = w.onGround ? 1 : clamp(1 - (w.altM - ground) / 30, 0, 1);
    PG.gw = PG.gw == null ? gwT : PG.gw + (gwT - PG.gw) * Math.min(1, dt * 3);
    const bodyO = P.model.userData.body; if (bodyO) bodyO.position.x = -s.L / 2 + noseWheelAhead(P.type) * PG.gw;
    // place it: nose (−x of the model) along the heading, at the right height
    P.model.position.copy(P.pos);
    // nose up near the ground: the model turns about its nose wheel, so lift it until the main wheels are on the surface
    { const xm = (bodyO ? bodyO.position.x : -s.L / 2) + (s.gear ? s.gear.main : s.L * 0.55);
      if (P.pitch > 0 && xm > 0) P.model.position.y += PG.gw * xm * Math.sin(P.pitch * D2R); }
    P.model.rotation.set(0, 0, 0);
    P.model.rotateY(-(P.hdg + 90) * D2R);
    // turbulence: the aircraft bumps, rolls a little and its wings flex (only what you see; the flight itself is unchanged)
    let tm = [0, 0, 0, 0];
    if (!w.onGround) { try { tm = v3dTurbMotion(P, v3dTurbAt(P, w.lon, w.lat, w.altM / 0.3048, (w.altM - ground) / 0.3048, !!g.you), now / 1000); } catch (e) { /* calm */ } }
    P.model.position.y += tm[0];
    if (PA.amph && P.model.userData.body && P.model.userData.body.userData.ampLift) P.model.position.y += P.model.userData.body.userData.ampLift * PG.gw;   // standing on the wheels below the floats
    P.model.rotateZ(-(P.pitch + tm[2]) * D2R);   // nose up
    P.model.rotateX(-(P.bank + tm[1]) * D2R);   // a turn to the right lowers the right wing
    // the wings carry the aircraft: on the ground they droop a little under their own weight and the fuel, in the air
    // they bend up with the lift (more in a turn and as the nose comes up at rotation), and turbulence flexes them
    { const PW: any = P, g1 = w.onGround ? (PS.tdAt && now - PS.tdAt < 1500 ? -0.25 : -0.12) : 0.55 / Math.max(0.6, Math.cos(P.bank * D2R)) + (w.altM - ground < 60 && P.pitch > 4 ? 0.15 : 0);
      PW.flexBase = PW.flexBase == null ? g1 : PW.flexBase + (g1 - PW.flexBase) * Math.min(1, dt * (w.onGround ? 3 : 1.2));
      (P.model.userData as any).flex = (PW.flexBase + tm[3]) * Math.max(0.5, shapeOf(P.type).span / 30); }
    // touchdown: tyre smoke from the main wheels (left behind on the runway as the aircraft rolls on)
    if (touched) { PS.smokeUntil = now + 900; PS.smokeAt = 0; PS.smokeK = g.you && (State as any).lastTouchdown ? clamp(Math.abs((State as any).lastTouchdown.fpm || 150) / 200, 0.7, 2) : 1; }
    if (PS.smokeUntil > now && now - (PS.smokeAt || 0) > 40) {
      // the same amount of smoke however fast the screen is drawn: a puff for every 40 ms that has passed
      const nP = PS.smokeAt ? Math.min(6, Math.floor((now - PS.smokeAt) / 40)) : 3;
      PS.smokeAt = now;
      const h = P.hdg * D2R, fx = Math.sin(h), fz = -Math.cos(h), rx = Math.cos(h), rz = Math.sin(h), bx = bodyO ? bodyO.position.x : -s.L / 2, back = bx + s.gear.main;
      const fresh = 1 - (PS.smokeUntil - now) / 900;   // thickest at the moment of touchdown
      for (let n = 0; n < nP; n++) for (const side of [-1, 1]) v3dSmokePuff(P.pos.x - fx * (back + n * 2) + rx * side * s.gear.track / 2, P.pos.y + 0.6, P.pos.z - fz * (back + n * 2) + rz * side * s.gear.track / 2, (PS.smokeK || 1) * (1.15 - fresh * 0.5));
    }
    void s;
  }
  if (!made) v3dSmokeStep(dt);
  if (!made) for (const id in V3d.planes) if (!seen[id]) { const P = V3d.planes[id]; V3d.scene.remove(P.model); P.label.remove(); const PC: any = P; if (PC.ct) for (const r of PC.ct.rb) { V3d.scene.remove(r.mesh); r.mesh.geometry.dispose(); } delete V3d.planes[id]; }

  // the camera follows the aircraft (or flies freely)
  const P = V3d.planes[f.id];
  if ((V3d as any).fcStart && V3d.origin && V3dTerrain.rings.length) {
    (V3d as any).fcStart = false;
    V3d.cam.position.set(-700, (V3d.elev || 0) + 220, 700); V3d.cam.lookAt(0, V3d.elev || 0, 0); V3d.cam.updateMatrixWorld();
    v3dFreeStart(); v3dFreeUiBind();
  }
  if (P && V3d.mode !== 'fwd' && !P.model.visible) P.model.visible = true;
  if (V3d.mode === 'free') { if (fc()) v3dFreeStep(dt); }
  else if (P && P.pos) {
    const s = shapeOf(P.type), centre = P.pos.clone().add(new T.Vector3(0, s.ground + s.h / 2, 0));
    const fwd = new T.Vector3(Math.sin(P.hdg * D2R), 0, -Math.cos(P.hdg * D2R));
    const VW: any = V3d;
    if (VW.cabinFor && (VW.cabinFor !== P.id || !/^win/.test(V3d.mode))) { v3dCabinLeave(V3d.planes[VW.cabinFor]); VW.cabinFor = null; }
    if (VW.cabinFwdFor && (VW.cabinFwdFor !== P.id || !/^(cabin|walk)$/.test(V3d.mode))) { v3dCabinFwdLeave(V3d.planes[VW.cabinFwdFor]); VW.cabinFwdFor = null; }
    if (V3d.mode === 'winL' || V3d.mode === 'winR') {
      // a window seat over the wing: fixed, looking out at the wing tip (see v3d-cabin.ts)
      VW.cabinFor = P.id; v3dCabinCam(P, V3d.mode);
    } else if (V3d.mode === 'cabin' || V3d.mode === 'walk') {
      // inside the cabin, from the back of the aisle, looking forward over the seats and passengers
      VW.cabinFwdFor = P.id; v3dCabinFwdCam(P);
    } else if (V3d.mode === 'fwd') {
      // forward: out of the front of the aircraft, from the cockpit, turning, climbing and banking with it;
      // a drag looks around a little. The aircraft itself is not drawn (you sit in it).
      const body = P.model.userData.body, eye = new T.Vector3(-0.6, s.ground + s.h * 0.78, 0);   // just ahead of the windscreen
      P.model.updateMatrixWorld(); body.updateMatrixWorld();
      const at = body.localToWorld(eye.clone()), q = P.model.getWorldQuaternion(new T.Quaternion());
      const yaw = V3d.yaw, pit = clamp(V3d.pitch, -1.2, 1.0);   // all the way round
      const dir = new T.Vector3(-Math.cos(pit) * Math.cos(yaw), Math.sin(pit), Math.cos(pit) * Math.sin(yaw)).applyQuaternion(q);
      const up = new T.Vector3(0, 1, 0).applyQuaternion(q);
      V3d.cam.position.copy(at); V3d.cam.up.copy(up); V3d.cam.lookAt(at.clone().add(dir)); V3d.cam.up.set(0, 1, 0);
      if (V3d.cam.fov !== 60) { V3d.cam.fov = 60; V3d.cam.updateProjectionMatrix(); }
      P.model.visible = false;
    } else if (V3d.mode === 'tower' && V3d.icao) {
      const tw = new T.Vector3(380, V3d.elev + 45, -260);
      const want = V3d.dist ? centre.clone().add(tw.clone().sub(centre).normalize().multiplyScalar(V3d.dist)) : tw;
      V3d.cam.position.lerp(want, Math.min(1, dt * 3));
      V3d.cam.lookAt(centre);
      if (V3d.yaw || V3d.pitch) {   // looking about from the tower: all the way round, up and down
        const dirT = centre.clone().sub(V3d.cam.position).normalize().applyAxisAngle(new T.Vector3(0, 1, 0), -V3d.yaw);
        const sideT = new T.Vector3().crossVectors(dirT, new T.Vector3(0, 1, 0)).normalize(); dirT.applyAxisAngle(sideT, clamp(V3d.pitch, -1.2, 1.2));
        V3d.cam.lookAt(V3d.cam.position.clone().add(dirT));
      }
      const d = V3d.cam.position.distanceTo(centre);
      V3d.cam.fov = clamp(2 * Math.atan(s.span * 2.2 / d) / D2R, 3, 55); V3d.cam.updateProjectionMatrix();
    } else {
      const d = v3dDist(), base = V3d.mode === 'chase' ? Math.atan2(fwd.x, fwd.z) + Math.PI : Math.atan2(fwd.x, fwd.z) + Math.PI / 2;
      // the camera is fixed to the aircraft; only its angle around it follows the heading, gently
      const VA: any = V3d; if (VA.camBase == null) VA.camBase = base;
      VA.camBase += ((((base - VA.camBase) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI) * Math.min(1, dt * 2.5);
      const a = VA.camBase + V3d.yaw, el = V3d.pitch;
      // two-finger slide: the view's centre moves sideways and up or down (within reach of the aircraft)
      const span = s.span || 35, px = clamp(VA.panX || 0, -span * 4, span * 4), py = clamp(VA.panY || 0, -span, span * 3); VA.panX = px; VA.panY = py;
      centre.add(new T.Vector3(Math.cos(a), 0, -Math.sin(a)).multiplyScalar(px)).add(new T.Vector3(0, py, 0));
      const want = centre.clone().add(new T.Vector3(Math.sin(a) * Math.cos(el) * d, Math.sin(el) * d, Math.cos(a) * Math.cos(el) * d));
      // tilted all the way down the camera sits just above the ground, looking along it
      const ll = v3dLonLat(want.x, want.z), gr = v3dGround(ll[0], ll[1]) + 1.6 - v3dCurve(want.x, want.z);
      if (want.y < gr) want.y = gr;
      V3d.cam.position.copy(want);
      V3d.cam.lookAt(centre);
      if (V3d.cam.fov !== 50) { V3d.cam.fov = 50; V3d.cam.updateProjectionMatrix(); }
    }
  }
  if (!made) try { v3dCloudsStep(now); } catch (e) { /* no clouds this frame */ }
  if (!made) try { v3dWeatherStep(now); } catch (e) { /* no weather this frame */ }
  try { V3dSound.step(now); } catch (e) { /* no sound this frame */ }
  if (!made) try { v3dCrashStep(now); v3dCrashFocusStep(); } catch (e) { /* the crash site as it was */ }
  if (!made) try { v3dSkyStep(now); } catch (e) { /* the sky as it was */ }
  if (!made) try { v3dEnvStep(now); } catch (e) { /* the reflections as they were */ }
  if (!made) try { v3dRainbowStep(); } catch (e) { /* no rainbow */ }
  if (!made) try { v3dAuroraStep(now); } catch (e) { /* no aurora */ }
  // while the loading screen covers the view, the scene is drawn only a few times a second: the loading
  // screen stays smooth and the device's time goes to loading instead
  const VL: any = V3d;
  if (V3d.loaded || !VL.drawnAt || now - VL.drawnAt > 450) {
    VL.drawnAt = now;
    // frame generation: the aircraft you follow moves on between real frames, so the picture carries it (and, from inside,
    // everything you see) along with it; the clouds keep their own distance
    if (VP) { const PF = V3d.planes[f.id]; VP.anchor = PF ? PF.model : null; VP.anchorAll = V3d.mode === 'cabin' || V3d.mode === 'walk'; VP.depthOnly = typeof V3dClouds !== 'undefined' && V3dClouds.mesh ? [V3dClouds.mesh] : []; }
    if (VL.cabinFwdFor && !made) { try { cabinOutsidePass(V3d.planes[VL.cabinFwdFor]); } catch (e) { /* the windows keep the last view */ } }
    if (V3d.loaded && (!(V3d as any).dprWas || FrameGen.mode() === 'on')) FrameGen.draw((V3d as any).perf, V3d.r, V3d.scene, V3d.cam, now); else V3d.r.render(V3d.scene, V3d.cam);
    if (V3d.loaded && !(V3d as any).dprWas) Perf.frame((V3d as any).perf, V3d.r, gameBoost() ? 60 : V3D_FPS);   // the cabin keeps its own sharpness
  }

  v3dClockStep(now);
  // callsigns over the aircraft
  const v = new T.Vector3();
  for (const id in V3d.planes) {
    const Q = V3d.planes[id], s = shapeOf(Q.type);
    v.copy(Q.pos); v.y += s.H + 4; v.project(V3d.cam);
    const on = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1 && !((V3d.mode === 'fwd' || V3d.mode === 'cabin' || /^win/.test(V3d.mode)) && id === V3d.target);
    Q.label.style.display = on ? '' : 'none';
    if (on) { Q.label.style.transform = `translate(${((v.x + 1) / 2 * innerWidth).toFixed(0)}px, ${((1 - v.y) / 2 * innerHeight).toFixed(0)}px) translate(-50%, -100%)`; Q.label.classList.toggle('on', id === V3d.target); }
  }
  // the details card keeps up with the flight once a second
  if (Math.floor(now / 500) !== (V3d as any).patchT) { (V3d as any).patchT = Math.floor(now / 500); try { v3dPatchFollow(); } catch (e) { /* ignore */ } }
  if (Math.floor(now / 1000) !== V3d.infoT && !v3dAptOnly()) { V3d.infoT = Math.floor(now / 1000); v3dRefreshInfo(f); }
}

function v3dLonLat(x: number, z: number): number[] { const o = V3d.origin; return [o[0] + x / (111320 * Math.cos(o[1] * D2R)), o[1] - z / 110540]; }

function v3dRefreshInfo(f: LiveFlight) {
  const ln = V3d.root && V3d.root.querySelector('.v3d-line') as HTMLElement; if (ln && (V3d.root.classList.contains('v3d-inside') || V3d.root.classList.contains('v3d-mini'))) ln.innerHTML = v3dLineHtml(f);
  const box = V3d.root && V3d.root.querySelector('.v3d-info .sel-pop') as HTMLElement; if (!box) return;
  const card = box.querySelector('.flight-card'); if (!card) return;
  const tmp = document.createElement('div'); tmp.innerHTML = flightCard(f);
  const fresh = tmp.querySelector('.flight-card');
  const g0 = card.querySelector('.fc-grid'), g1 = fresh && fresh.querySelector('.fc-grid');
  if (g0 && g1) g0.innerHTML = g1.innerHTML;
  const st = V3d.root.querySelector('.v3d-status'); if (st) st.textContent = V3d.icao ? `${V3d.icao} · ${apt(V3d.icao).name}` : `${f.from} → ${f.noDest ? '…' : f.to}`;
}

/* ---------- the details window can be dragged anywhere ---------- */
// Grab a flight's details card by its top line and move it; it stays where you put it.
(function dragDetails() {
  let drag: { box: HTMLElement; x: number; y: number; ox: number; oy: number; id: number } = null;
  const off = (box: HTMLElement) => { const m = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(box.style.transform || ''); return m ? [+m[1], +m[2]] : [0, 0]; };
  document.addEventListener('pointerdown', e => {
    const t = e.target as HTMLElement;
    const head = t && t.closest && t.closest('.sel-pop .fc-top, .sel-pop .fc-route, .sel-pop .fc-mini') as HTMLElement;
    if (!head || (t.closest('button') && !t.closest('.fc-top'))) return;
    const box = head.closest('.sel-pop').parentElement as HTMLElement; if (!box) return;
    const o = off(box);
    drag = { box, x: e.clientX, y: e.clientY, ox: o[0], oy: o[1], id: e.pointerId };
    box.classList.add('dragging');
    e.preventDefault();
  }, true);
  document.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const r = drag.box.getBoundingClientRect(), o = off(drag.box);
    let x = drag.ox + e.clientX - drag.x, y = drag.oy + e.clientY - drag.y;
    // keep it on the screen
    const left = r.left - o[0], top = r.top - o[1];
    x = clamp(x, -left + 4, innerWidth - left - r.width - 4); y = clamp(y, -top + 4, innerHeight - top - 60);
    drag.box.style.transform = `translate(${x}px, ${y}px)`;
  });
  const end = () => { if (drag) { drag.box.classList.remove('dragging'); drag = null; } };
  document.addEventListener('pointerup', end); document.addEventListener('pointercancel', end);
})();

/* ---------- loading: the start-up screen, livelier, until the ground and the airport are there ---------- */
function v3dLoaderHtml(): string {
  return `<div class="v3d-load splash">
    <div class="spl-glow"></div>
    <svg class="v3l-hills" viewBox="0 0 1200 220" preserveAspectRatio="none" aria-hidden="true"><path d="M0 220 L0 150 L90 95 L160 130 L260 40 L340 110 L420 70 L520 140 L610 60 L700 120 L790 30 L880 115 L960 80 L1060 140 L1140 90 L1200 120 L1200 220 Z"/><path class="far" d="M0 220 L0 170 L120 120 L230 160 L330 100 L470 165 L560 115 L680 170 L800 105 L930 160 L1050 110 L1200 150 L1200 220 Z"/></svg>
    <div class="v3l-orbit"><i></i><i></i><i></i></div>
    <div class="spl-mark">${splashLogo()}</div>
    <div class="spl-name"><b>3D view</b></div>
    <div class="spl-load">
      <div class="spl-info"><span class="spl-step">Loading the mountains and the sea…</span><b class="spl-pct">0%</b></div>
      <div class="spl-bar"><i class="spl-fill"><span class="spl-sheen"></span></i><span class="spl-tip"><svg viewBox="0 0 24 24"><path d="M21 15.5v-1.8l-8-5V3.6a1.5 1.5 0 0 0-3 0v5.1l-8 5v1.8l8-2.5v5l-2 1.5V21l3.5-1 3.5 1v-1.5L13 18v-5z"/></svg></span></div>
    </div></div>`;
}
const V3D_SPLASH_MS = 5000;   // the 3D loading screen shows at least this long
function v3dLoaderTick(now: number) {
  const L = V3d.root && V3d.root.querySelector('.v3d-load') as HTMLElement; if (!L || V3d.loaded) return;
  const VL: any = V3d, pr = V3dTerrain.prog, t = now - V3d.loadT0;
  // the airports of the flight within the view distance: their layouts are loaded before the view opens
  if (!VL.pre && V3d.origin) {
    VL.pre = { want: 0, got: 0 };
    const f: any = v3dAptOnly() || v3dTargetFlight(), km = v3dKm();
    const ids = f ? [f.from, f.noDest ? '' : f.to].filter((k: string, i: number, a: string[]) => k && a.indexOf(k) === i && k !== V3d.icao) : [];
    for (const k of ids) {
      const A = apt(k); if (!A || gcDistanceNm(V3d.origin, A.pos) * 1.852 > km) continue;
      VL.pre.want++;
      const done = () => { VL.pre.got++; };
      try { AirportLayouts.get(k, () => { /* kept for later */ }).then(done, done); } catch (e) { done(); }
    }
  }
  const satOn = !!(State.settings as any).v3dSat, q = satOn ? v3dSatQ() : 0;
  // everything within range: every ring of ground, its satellite pictures, the airport, the flight's other
  // airports nearby, and the clouds from the weather reports (a part that fails counts as done)
  const terrainOk = V3dTerrain.done, nRings = V3dTerrain.rings.length;
  const satOk = !satOn || (terrainOk && (pr.sat || 0) >= nRings);
  const cityOk = !skyOpt('v3dCity') || (terrainOk && V3dTerrain.rings.every((r: any) => r.cityDone));
  const aptOk = !V3d.icao || V3d.aptReady;
  const preOk = !!VL.pre && VL.pre.got >= VL.pre.want;
  const C: any = V3dClouds, cloudOk = !cloudKm() || (!!C.fetchAt && !C.pending && !!C.key && !!C.mesh);
  const parts: [number, number][] = [   // [share of the bar, done (0–1)]
    [satOn ? 0.45 : 0.62, terrainOk ? 1 : clamp(pr.got / Math.max(1, pr.want), 0, 0.97)],
    [satOn ? 0.25 : 0, satOk ? 1 : clamp((pr.sat || 0) / Math.max(1, nRings || 6), 0, 0.97)],
    [0.13, aptOk ? 1 : 0], [0.1, preOk ? 1 : VL.pre ? VL.pre.got / Math.max(1, VL.pre.want) : 0], [0.12, cloudOk ? 1 : C.pending ? 0.5 : 0],
    [0.06, cityOk ? 1 : V3dTerrain.rings.filter((r: any) => r.cityDone).length / Math.max(1, nRings)],
  ];
  const tot = parts.reduce((s, p) => s + p[0], 0), k = parts.reduce((s, p) => s + p[0] * p[1], 0) / tot;
  const all = terrainOk && satOk && aptOk && preOk && cloudOk && cityOk;
  const minMs = V3D_SPLASH_MS + q * 1500, maxMs = 60000 + q * 20000;   // never stuck: after a minute it opens anyway
  // the bar never runs ahead of the minimum time, so it fills smoothly, and stays short of 100% until everything is in
  const shown = Math.min(all ? 1 : Math.min(0.98, k), t / minMs);
  V3d.shown = Math.max(V3d.shown || 0, shown);
  const fill = L.querySelector('.spl-fill') as HTMLElement, tip = L.querySelector('.spl-tip') as HTMLElement, pct = L.querySelector('.spl-pct') as HTMLElement, step = L.querySelector('.spl-step') as HTMLElement;
  if (fill) fill.style.width = (V3d.shown * 100).toFixed(1) + '%';
  if (tip) tip.style.left = (V3d.shown * 100).toFixed(1) + '%';
  if (pct) pct.textContent = Math.round(V3d.shown * 100) + '%';
  if (step) step.textContent = !terrainOk ? 'Loading the mountains and the sea…' : !satOk ? `Loading satellite imagery${q >= 3 ? ' (highest detail)' : q >= 2 ? ' (very sharp)' : ''}…`
    : !aptOk ? `Building ${V3d.icao}…` : !preOk ? 'Loading the airports nearby…' : !cloudOk ? 'Loading the clouds from the weather reports…' : !cityOk ? 'Loading the lights of the towns…' : 'Ready';
  if ((all && t >= minMs) || t > maxMs) {
    // everything goes onto the graphics card before the view shows, so the first moments don't stutter
    try { V3d.r.compile(V3d.scene, V3d.cam); } catch (e) { /* ignore */ }
    V3d.loaded = true; L.classList.add('out'); setTimeout(() => L.remove(), 800);
  }
}

/** Other airlines switched off: their aircraft leave the 3D scene at once. */
function v3dTrafficSync() {
  if (Traffic.on() || !V3d.planes) return;
  for (const id of Object.keys(V3d.planes)) if (/^tfc-/.test(id)) { const P = V3d.planes[id]; try { V3d.scene.remove(P.model); P.label.remove(); } catch (e) { /* ignore */ } delete V3d.planes[id]; }
}

/* ---------- free camera: fly around like a drone ---------- */
// One finger looks around, two fingers move (drag to slide, pinch to fly forward or back), the mouse wheel
// flies forward and back; on a PC also W A S D to move, Q and E (or R and F) to climb and sink, arrows to look.
// It moves with a little inertia and goes faster the higher it flies. The scene follows wherever it goes.
interface FreeCam { pos: any; yaw: number; pitch: number; vel: any; keys: { [k: string]: boolean } }
function fc(): FreeCam { return (V3d as any).fc; }
function v3dFreeStart() {
  const T = THREE, c = V3d.cam, dir = new T.Vector3(); c.getWorldDirection(dir);
  (V3d as any).fc = { pos: c.position.clone(), yaw: Math.atan2(dir.x, -dir.z), pitch: Math.asin(clamp(dir.y, -1, 1)), vel: new T.Vector3(), keys: {} } as FreeCam;
  if (V3d.cam.fov !== 60) { V3d.cam.fov = 60; V3d.cam.updateProjectionMatrix(); }
  if (!(V3d as any).fcKeys) {
    (V3d as any).fcKeys = true;
    const set = (e: KeyboardEvent, on: boolean) => { if (!V3d.open || V3d.mode !== 'free' || (e.target as HTMLElement).closest('input, textarea')) return; const k = e.key.toLowerCase(); if ('wasdqerfc'.indexOf(k) >= 0 || /^arrow/.test(k) || k === 'shift' || k === ' ') { fc().keys[k] = on; e.preventDefault(); } };
    document.addEventListener('keydown', e => set(e, true)); document.addEventListener('keyup', e => set(e, false));
  }
}
/** Height above the ground: the higher up, the faster it moves. */
function v3dFreeSpeed(): number { const F = fc(); if (!F) return 20; const ll = v3dLonLat(F.pos.x, F.pos.z), g = v3dGround(ll[0], ll[1]) - v3dCurve(F.pos.x, F.pos.z); return clamp((F.pos.y - g) * 0.9, 12, 2500); }
/** A push in the camera's own directions: right, up, forward (units of a second at the current speed). */
function v3dFreePush(right: number, up: number, fwd: number) {
  const F = fc(); if (!F) return; const T = THREE, s = v3dFreeSpeed();
  const f = new T.Vector3(Math.sin(F.yaw) * Math.cos(F.pitch), Math.sin(F.pitch), -Math.cos(F.yaw) * Math.cos(F.pitch)), r = new T.Vector3(Math.cos(F.yaw), 0, Math.sin(F.yaw));
  const m = (State.settings as any).v3dFreeSpeed || 1;
  F.vel.addScaledVector(f, fwd * s * m).addScaledVector(r, right * s * m).add(new T.Vector3(0, up * s * m, 0));
}
function v3dFreeGesture(e: PointerEvent, p: any, ids: string[]) {
  const F = fc(); if (!F) return; const dx = e.clientX - p.x, dy = e.clientY - p.y;
  if (ids.length === 1) { F.yaw += dx * 0.0075; F.pitch = clamp(F.pitch - dy * 0.0065, -1.5, 1.4); return; }
  if (ids.length >= 2) {
    const a = V3d.ptrs[ids[0]], b = V3d.ptrs[ids[1]], d = Math.hypot(a.x - b.x, a.y - b.y), VA: any = V3d;
    if (VA.fcPinch) v3dFreePush(0, 0, (d - VA.fcPinch) * 0.02);
    VA.fcPinch = d;
    // both fingers sliding together: move sideways and up or down
    v3dFreePush(-dx * 0.006, dy * 0.006, 0);
  }
}
function v3dFreeStep(dt: number) {
  const F = fc(); if (!F || !dt) return; const T = THREE, k = F.keys;
  // keys: steady thrust while held
  const kx = (k.d ? 1 : 0) - (k.a ? 1 : 0), ky = ((k.e || k.r || k[' ']) ? 1 : 0) - ((k.q || k.f || k.c) ? 1 : 0), kz = (k.w ? 1 : 0) - (k.s ? 1 : 0);
  const st: any = (V3d as any).fcStick || { x: 0, y: 0 }, hb = (V3d as any).fcHeight || 0;
  if (st.x || st.y || hb) v3dFreePush(st.x * dt * 3, hb * dt * 2.5, -st.y * dt * 3);
  if (kx || ky || kz) v3dFreePush(kx * dt * 3 * (k.shift ? 3 : 1), ky * dt * 3, kz * dt * 3 * (k.shift ? 3 : 1));
  if (k.arrowleft) F.yaw -= dt * 1.2; if (k.arrowright) F.yaw += dt * 1.2; if (k.arrowup) F.pitch = clamp(F.pitch + dt, -1.45, 1.2); if (k.arrowdown) F.pitch = clamp(F.pitch - dt, -1.45, 1.2);
  // drift, then ease to a stop like a drone in the air
  F.pos.addScaledVector(F.vel, dt); F.vel.multiplyScalar(Math.exp(-dt * 2.6));
  const ll = v3dLonLat(F.pos.x, F.pos.z), gr = v3dGround(ll[0], ll[1]) + 2 - v3dCurve(F.pos.x, F.pos.z);
  if (F.pos.y < gr) { F.pos.y = gr; if (F.vel.y < 0) F.vel.y = 0; }
  F.pos.y = Math.min(F.pos.y, 12000);
  V3d.cam.position.copy(F.pos);
  V3d.cam.lookAt(F.pos.clone().add(new T.Vector3(Math.sin(F.yaw) * Math.cos(F.pitch), Math.sin(F.pitch), -Math.cos(F.yaw) * Math.cos(F.pitch))));
}
/** Flown far from the centre: the scene (terrain, airport, aircraft) moves to where the camera is. */
function v3dFreeRecentre() {
  const F = fc(); if (!F) return;
  const ll = v3dLonLat(F.pos.x, F.pos.z);
  // an airport within a few miles is always the centre, so its layout is drawn (also when you come back to it
  // after flying the camera away: before, the view only moved again after another 10 miles, and the airport
  // stayed away); every airport in the world, not only the main ones
  const icao = v3dAirportNear(ll, 4);
  if (icao && icao === V3d.icao) return;
  if (!icao && gcDistanceNm(V3d.origin, ll) < 10) return;
  const centre = icao ? apt(icao).pos : ll, oldY = F.pos.y;
  v3dRecentre({ from: icao || '', to: icao || '', noDest: !icao } as any, { lon: centre[0], lat: centre[1] });
  if (!icao) { V3d.icao = ''; }
  const q = v3dXY(ll[0], ll[1]); F.pos.set(q[0], oldY, q[1]);
}
/** The nearest airport within `nm`, from the main ones and the world list (with runways, not seaplane bases), or ''. */
function v3dAirportNear(ll: number[], nm: number): string {
  let icao = '', best = nm;
  const check = (k: string, pos: number[]) => { if (!pos) return; const d = gcDistanceNm(ll, pos); if (d < best) { best = d; icao = k; } };
  for (const k of Object.keys(AIRPORTS)) { const A = AIRPORTS[k]; if (A && A.pos && !isHelipad(k)) check(k, A.pos); }
  try { const W: any = World; if (W.ready) { const dLat = nm / 60; for (const a of W.list) if (a.size != null && a.size <= 2 && Math.abs(a.pos[1] - ll[1]) < dLat) check(a.icao, a.pos); } } catch (e) { /* the main ones */ }
  if (icao) registerWorldAirport(icao);
  return icao;
}

ACTIONS['fc-help'] = () => { const h = V3d.root && V3d.root.querySelector('.fc-help'); if (h) h.classList.toggle('on'); Sound.tick(); };
/** The on-screen stick, height buttons and speed slider of the free camera. */
function v3dFreeUiBind() {
  const root = V3d.root; if (!root || (root as any).fcBound) return; (root as any).fcBound = true;
  const stick = root.querySelector('.fc-stick') as HTMLElement, knob = stick && stick.querySelector('i') as HTMLElement;
  if (stick) {
    stick.style.touchAction = 'none';
    const mv = (e: PointerEvent) => { const r = stick.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = r.width / 2;
      let x = (e.clientX - cx) / R, y = (e.clientY - cy) / R; const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
      (V3d as any).fcStick = { x, y }; if (knob) knob.style.transform = `translate(${x * R * 0.6}px, ${y * R * 0.6}px)`; };
    stick.addEventListener('pointerdown', e => { stick.setPointerCapture(e.pointerId); mv(e); e.stopPropagation(); });
    stick.addEventListener('pointermove', e => { if (stick.hasPointerCapture(e.pointerId)) mv(e); });
    const end = () => { (V3d as any).fcStick = { x: 0, y: 0 }; if (knob) knob.style.transform = ''; };
    stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
  }
  root.querySelectorAll('.fc-btn').forEach((b: Element) => {
    const v = b.getAttribute('data-fc') === 'up' ? 1 : -1, B = b as HTMLElement; B.style.touchAction = 'none';
    B.addEventListener('pointerdown', e => { B.setPointerCapture(e.pointerId); (V3d as any).fcHeight = v; });
    const end = () => { (V3d as any).fcHeight = 0; }; B.addEventListener('pointerup', end); B.addEventListener('pointercancel', end);
  });
  const sp = root.querySelector('.fc-spd') as HTMLInputElement;
  if (sp) sp.addEventListener('input', () => { const m = Math.pow(8, +sp.value / 50 - 1); (State.settings as any).v3dFreeSpeed = Math.round(m * 10) / 10; const o = root.querySelector('.fc-spd-v'); if (o) o.textContent = m.toFixed(1) + '×'; Store.soon(); });
}

/** A runway's paint, drawn to scale: numbers (and L, C, R) at both ends, threshold stripes by width,
 *  centre line, and on longer runways the aiming point, touchdown zone and side stripes. Grass runways get
 *  only their numbers and white end markers. */
function runwayMarkingsCanvas(r: { len: number; wid: number; surf: number; a: string; b: string }): HTMLCanvasElement {
  const len = r.len || 2000, wid = r.wid || 45, grass = r.surf === 1;
  const k = Math.min(256 / wid, 8192 / len), W = Math.max(32, Math.round(wid * k)), H = Math.round(len * k);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
  const M = (m: number) => m * k;   // metres to pixels
  c.fillStyle = grass ? '#3D5A2E' : '#2B323B'; c.fillRect(0, 0, W, H);
  if (!grass) { for (let i = 0; i < 400; i++) { c.fillStyle = `rgba(${Math.random() < .5 ? '0,0,0' : '255,255,255'},${Math.random() * .05})`; c.fillRect(Math.random() * W, Math.random() * H, M(2 + Math.random() * 6), M(10 + Math.random() * 60)); } }   // wear and patches
  c.fillStyle = '#E8ECF0';
  // both ends: the 'a' end at the bottom (landing towards the top), the 'b' end at the top, turned round
  const end = (designator: string, top: boolean) => {
    c.save(); if (top) { c.translate(W, H); c.rotate(Math.PI); }
    let y = H - M(6);   // from the threshold inwards (upwards)
    if (grass) { c.fillRect(M(2), y - M(3), W - M(4), M(3)); y -= M(10); }
    else {
      // threshold stripes: their number follows the runway width
      const n = wid >= 60 ? 16 : wid >= 45 ? 12 : wid >= 30 ? 8 : wid >= 23 ? 6 : 4, sw = M(1.8), gap = (W - M(6) - n * sw) / (n + 1);
      for (let i = 0; i < n; i++) { const x = M(3) + gap * (i + 1) + sw * i + (i >= n / 2 ? gap * 0.6 : -gap * 0.3); c.fillRect(x, y - M(30), sw, M(30)); }
      y -= M(42);
    }
    // the runway number (and its letter): about 9 m tall, read when lined up for landing
    const m = /^(\d{1,2})([LCR]?)$/i.exec(String(designator || '').trim()), num = m ? m[1].padStart(2, '0') : String(designator || '').slice(0, 3), letter = m ? m[2].toUpperCase() : '';
    // ICAO: about 9 m tall and 3 m wide a character (smaller on narrow runways)
    const th = M(wid >= 30 ? 9 : wid >= 23 ? 7.5 : 6), cw = Math.min(M(wid >= 30 ? 3 : 2.4), W * 0.38 / 2);
    c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.font = `700 100px Arial, Helvetica, sans-serif`;
    const draw = (t: string, yy: number) => {
      const mt = c.measureText(t), gh = (mt.actualBoundingBoxAscent || 72), gw = Math.max(1, mt.width);
      c.save(); c.translate(W / 2, yy); c.scale(cw * t.length * 1.25 / gw, th / gh); c.fillText(t, 0, 0); c.restore();
    };
    if (letter) { draw(letter, y); y -= th + M(3); }
    draw(num, y); y -= th + M(12);
    if (!grass && len >= 1200) {
      // aiming point: two broad bars about 400 m in (300 m on shorter runways)
      const ap = len >= 2400 ? 400 : 300, abW = M(wid >= 45 ? 10 : 6), abL = M(len >= 2400 ? 60 : 45), off = M(Math.min(wid * 0.18, 9));
      c.fillRect(W / 2 - off - abW, H - M(6) - M(ap) - abL, abW, abL); c.fillRect(W / 2 + off, H - M(6) - M(ap) - abL, abW, abL);
      // touchdown zone: pairs of bars every 150 m up to 900 m (shorter runways: fewer)
      if (len >= 1500 && wid >= 30) for (const d of [150, 450, 600, 750, 900]) {
        if (d > len / 2 - 100 || d === 300 || d === 400) continue;
        const bars = d <= 150 ? 3 : d <= 450 ? 2 : 1, bw = M(1.8), bl = M(22), o2 = M(Math.min(wid * 0.18, 9));
        for (let i = 0; i < bars; i++) { c.fillRect(W / 2 - o2 - bw * (i + 1) - M(1.5) * i, H - M(6) - M(d) - bl, bw, bl); c.fillRect(W / 2 + o2 + bw * i + M(1.5) * i, H - M(6) - M(d) - bl, bw, bl); }
      }
    }
    c.restore();
  };
  end(r.a, false); end(r.b, true);
  if (!grass) {
    // centre line: 30 m stripes with 20 m gaps between the numbers
    const cw = Math.max(1, M(wid >= 45 ? 0.9 : 0.45)), from = M(90), to = H - M(90);
    for (let y = from; y < to - M(30); y += M(50)) c.fillRect(W / 2 - cw / 2, y, cw, M(30));
    // side stripes on wider runways
    if (wid >= 30) { c.fillRect(M(1), 0, M(0.9), H); c.fillRect(W - M(1.9), 0, M(0.9), H); }
  } else {
    // grass: white edge markers along the sides
    for (let y = M(30); y < H; y += M(90)) { c.fillRect(0, y, M(3), M(1)); c.fillRect(W - M(3), y, M(3), M(1)); }
  }
  return cv;
}


/* ---------- when the device runs out of graphics memory ---------- */
// Android closes the app without an error when the graphics take too much memory. A mark is kept while
// the 3D view is open (and visible); if the app starts again with the mark still there, it was closed in
// the middle of the 3D view: that goes into the error log, and the satellite detail steps down one level.
function v3dCrashGuard(open: boolean) {
  try {
    if (open) localStorage.setItem('amp-v3d-open', JSON.stringify({ at: Date.now(), q: v3dSatQ(), sat: !!(State.settings as any).v3dSat, cap: v3dTexCap(), mem: (navigator as any).deviceMemory || 0, ver: APP.version }));
    else localStorage.removeItem('amp-v3d-open');
  } catch (e) { /* storage full */ }
}
document.addEventListener('visibilitychange', () => { if (!V3d.open) return; if (document.hidden) v3dCrashGuard(false); else v3dCrashGuard(true); });
function v3dCrashCheck() {
  let m: any = null; try { m = JSON.parse(localStorage.getItem('amp-v3d-open') || 'null'); localStorage.removeItem('amp-v3d-open'); } catch (e) { return; }
  if (!m || Date.now() - m.at > 7 * 864e5) return;
  const names = ['Standard', 'Sharp', 'Very sharp', 'Highest'], S: any = State.settings;
  try { ErrorLog.add('3d', 'The app was closed by the system during the 3D view', `Satellite ${m.sat ? 'on, detail ' + names[m.q] : 'off'}; graphics limit ${m.cap}px; device memory ${m.mem || '?'} GB`, `The 3D view was open (version ${m.ver}) when Android closed the app, most likely because the graphics ran out of memory.`); } catch (e) { /* ignore */ }
  let lowered = '';
  if (m.sat && (S.v3dSatQ == null ? 1 : S.v3dSatQ) > 0) { S.v3dSatQ = Math.max(0, (S.v3dSatQ == null ? 1 : S.v3dSatQ) - 1); lowered = names[S.v3dSatQ]; Store.soon(); }
  State.notices.unshift({ id: uid(), kind: 'mechanic' as any, title: 'The 3D view closed the app', body: `Your device ran out of graphics memory in the 3D view.${lowered ? ` Satellite detail is now ${lowered}; you can raise it again in Settings → Graphics.` : ''} The details are in Settings → Updates and errors.`, time: 'Now', at: Date.now(), read: false } as any);
}

/* ---------- tyre smoke at touchdown ---------- */
let _smokeTex: any = null;
const _smoke: { sp: any; age: number; life: number; k: number; vx: number; vz: number }[] = [];
function v3dSmokePuff(x: number, y: number, z: number, k: number, col?: number) {
  const T = THREE;
  if (!_smokeTex) {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
    gr.addColorStop(0, 'rgba(235,235,235,1)'); gr.addColorStop(0.45, 'rgba(220,220,220,.55)'); gr.addColorStop(1, 'rgba(210,210,210,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    _smokeTex = new T.CanvasTexture(c);
  }
  if (_smoke.length > 220) return;
  const sp = new T.Sprite(new T.SpriteMaterial({ map: _smokeTex, transparent: true, depthWrite: false, opacity: 0.8 }));
  sp.material.userData.noDim = true;   // lit by hand in v3dSmokeStep
  if (col != null) sp.userData.col = new T.Color(col);
  sp.position.set(x + (Math.random() - 0.5) * 0.8, y, z + (Math.random() - 0.5) * 0.8); sp.scale.set(1.5, 1.5, 1.5); sp.renderOrder = 12;
  V3d.scene.add(sp);
  _smoke.push({ sp, age: 0, life: 3 + Math.random() * 2.5, k, vx: (Math.random() - 0.5) * 2, vz: (Math.random() - 0.5) * 2 });
}
function v3dSmokeStep(dt: number) {
  for (let i = _smoke.length - 1; i >= 0; i--) {
    const p = _smoke[i]; p.age += dt; const t = p.age / p.life;
    if (t >= 1 || !V3d.scene) { if (V3d.scene) V3d.scene.remove(p.sp); p.sp.material.dispose(); _smoke.splice(i, 1); continue; }
    const sz = (2 + Math.sqrt(t) * 13) * p.k; p.sp.scale.set(sz, sz * 0.8, sz);
    p.sp.position.x += p.vx * dt; p.sp.position.z += p.vz * dt; p.sp.position.y += (0.8 + t * 1.2) * dt;
    p.sp.material.opacity = 0.8 * Math.min(1, 0.65 + p.k * 0.3) * (1 - t) * (1 - t * 0.6);
    // the light of the moment: grey-white by day, dim at night (lit a little by the landing lights)
    const tint = (V3dSky as any).tint || [1, 1, 1], amb = Math.max(0.18, (V3dSky as any).amb || 1);
    const cc = p.sp.userData.col; p.sp.material.color.setRGB((cc ? cc.r * 3 : 1) * tint[0] * amb, (cc ? cc.g * 3 : 1) * tint[1] * amb, (cc ? cc.b * 3 : 1) * tint[2] * amb);
  }
}

/* ---------- the airport ahead: its layout fetched early ---------- */
// The destination's layout (the simulator's or OpenStreetMap's) is fetched about 150 nm out, so by the time
// the view moves to the airport (60 nm) everything is there and only has to be built.
const _v3dPre: { [icao: string]: number } = {};
function v3dPrefetch(f: LiveFlight, w: { lon: number; lat: number }) {
  if (!f || f.noDest || !f.to) return;
  const B = apt(f.to); if (!B || _v3dPre[f.to] && Date.now() - _v3dPre[f.to] < 600e3) return;
  if (gcDistanceNm([w.lon, w.lat], B.pos) > 150) return;
  _v3dPre[f.to] = Date.now();
  try { AirportLayouts.get(f.to, () => { /* kept for when the view gets there */ }); } catch (e) { /* ignore */ }
}

/* ---------- the airport's ground paint, as shapes ---------- */
// Taxiways, their centre lines, the lead-in lines to the stands, stop bars, holding positions and aprons, built
// as flat shapes that follow the ground (not one big picture): quick to build and sharp from any distance.
function v3dGroundPaint(L: AirportLayout, loc: (x: number, y: number) => number[], gy: (x: number, z: number) => number): any {
  const T = THREE, g = new T.Group(), osm = L.source === 'osm';
  const batches: { [k: string]: number[] } = {};
  const tri = (key: string, a: number[], b: number[], c: number[]) => { const B = batches[key] || (batches[key] = []); B.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]); };
  const v = (x: number, y: number, lift: number) => { const q = loc(x, y); return [q[0], gy(q[0], q[1]) + lift, q[1]]; };
  // a strip along a line (split every 25 m so it follows the ground)
  const strip = (key: string, A: number[], B: number[], w: number, lift: number) => {
    const dx = B[0] - A[0], dy = B[1] - A[1], len = Math.hypot(dx, dy); if (len < 0.05) return;
    const nx = -dy / len * w / 2, ny = dx / len * w / 2, n = Math.max(1, Math.ceil(len / 25));
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n, x0 = A[0] + dx * t0, y0 = A[1] + dy * t0, x1 = A[0] + dx * t1, y1 = A[1] + dy * t1;
      const a = v(x0 + nx, y0 + ny, lift), b = v(x0 - nx, y0 - ny, lift), c = v(x1 - nx, y1 - ny, lift), d = v(x1 + nx, y1 + ny, lift);
      tri(key, a, b, c); tri(key, a, c, d);
    }
  };
  // a round end (so joints have no gaps or notches)
  const disc = (key: string, P: number[], r: number, lift: number) => { const c = v(P[0], P[1], lift), seg = r > 8 ? 16 : 10; for (let i = 0; i < seg; i++) { const a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2; tri(key, c, v(P[0] + Math.cos(a1) * r, P[1] + Math.sin(a1) * r, lift), v(P[0] + Math.cos(a0) * r, P[1] + Math.sin(a0) * r, lift)); } };
  const taxi = (L.paths || []).filter(p => (p[0] === 1 || p[0] === 4) && L.points[p[2]] && L.points[p[3]]);
  const conn = osm ? [] : (L.paths || []).filter(p => p[0] === 3 && L.points[p[2]] && L.parks && L.parks[p[3]]);
  const leads = (L.paths || []).filter(p => p[0] === 9 && L.points[p[2]] && L.points[p[3]]);
  const tw = (p: number[]) => Math.min(40, Math.max(10, p[1] || 18));
  // aprons: concrete
  for (const ar of L.areas || []) {
    if (ar.k !== 'apron' || ar.pts.length < 3) continue;
    try {
      const contour = ar.pts.map(p => new T.Vector2(p[0], p[1])), faces = T.ShapeUtils.triangulateShape(contour, []);
      for (const f of faces) { const [a, b, c] = f.map((i: number) => v(ar.pts[i][0], ar.pts[i][1], 0.15)); tri('apron', a, c, b); }
    } catch (e) { /* an odd outline: left out */ }
  }
  // the parking areas: paved all over (stands, lead-ins, taxilanes), also where the map has no apron outline
  for (const poly of layoutParkingFill(L)) {
    try {
      const faces = T.ShapeUtils.triangulateShape(poly.map(p => new T.Vector2(p[0], p[1])), []);
      for (const f of faces) { const [a, b, c] = f.map((i: number) => v(poly[i][0], poly[i][1], 0.15)); tri('apron', a, c, b); }
    } catch (e) { /* skip */ }
  }
  // taxiways: shoulder, then asphalt (with round joints)
  const joints: { [i: number]: number } = {};
  for (const p of taxi) { strip('shoulder', L.points[p[2]], L.points[p[3]], tw(p) + 6, 0.22); [p[2], p[3]].forEach(i => joints[i] = Math.max(joints[i] || 0, tw(p))); }
  for (const i in joints) disc('shoulder', L.points[+i], joints[i] / 2 + 3, 0.22);
  for (const p of conn) strip('shoulder', L.points[p[2]], L.parks[p[3]], Math.max(10, p[1] || 12), 0.24);
  for (const p of taxi) strip('asphalt', L.points[p[2]], L.points[p[3]], tw(p), 0.28);
  for (const i in joints) disc('asphalt', L.points[+i], joints[i] / 2, 0.28);
  // the yellow lines: centre lines, connectors, lead-ins
  const LW = 0.6;
  for (const p of taxi) strip('line', L.points[p[2]], L.points[p[3]], LW, 0.36);
  for (const p of conn) strip('line', L.points[p[2]], L.parks[p[3]], LW, 0.36);
  for (const p of leads) { strip('line', L.points[p[2]], L.points[p[3]], LW, 0.36); disc('line', L.points[p[3]], LW / 2, 0.36); }
  for (const i in joints) disc('line', L.points[+i], LW / 2, 0.36);
  // stands: the stop bar (and a short lead-in where the map has none of its own)
  for (const pk of L.parks || []) {
    const h = (pk[2] || 0) * D2R, ux = Math.sin(h), uy = Math.cos(h), r = pk[3] || 15;
    if (!osm) strip('line', [pk[0] - ux * r * 2.2, pk[1] - uy * r * 2.2], [pk[0], pk[1]], LW, 0.36);
    strip('line', [pk[0] - uy * r * 0.35, pk[1] + ux * r * 0.35], [pk[0] + uy * r * 0.35, pk[1] - ux * r * 0.35], 0.9, 0.37);
  }
  // runway holding positions: two solid and two dashed lines across the taxiway
  for (const r of L.runways) {
    if (r.surf === 9 || r.surf === 1) continue;
    const cx = (r.lon - L.lon) * 111320 * Math.cos(L.lat * D2R), cy = (r.lat - L.lat) * 110540, ux = Math.sin(r.hdg * D2R), uy = Math.cos(r.hdg * D2R), half = r.len / 2, hw = (r.wid || 45) / 2;
    const hold = hw + ((r.wid || 45) >= 40 ? 65 : (r.wid || 45) >= 25 ? 45 : 30);
    const side = (x: number, y: number) => ({ along: (x - cx) * ux + (y - cy) * uy, across: -(x - cx) * uy + (y - cy) * ux });
    for (const p of taxi) {
      const A = L.points[p[2]], B = L.points[p[3]], a = side(A[0], A[1]), b = side(B[0], B[1]);
      const onA = Math.abs(a.across) < hw + 8 && Math.abs(a.along) < half, onB = Math.abs(b.across) < hw + 8 && Math.abs(b.along) < half;
      if (onA === onB) continue;
      const on = onA ? a : b, off = onA ? b : a, P0 = onA ? A : B, P1 = onA ? B : A;
      if (Math.abs(off.across) < hold) continue;
      const t = (hold - Math.abs(on.across)) / (Math.abs(off.across) - Math.abs(on.across)), hx = P0[0] + (P1[0] - P0[0]) * t, hy = P0[1] + (P1[1] - P0[1]) * t;
      const dx = P1[0] - P0[0], dy = P1[1] - P0[1], dl = Math.hypot(dx, dy) || 1, tx = dx / dl, ty = dy / dl, nx = -ty, ny = tx, w = tw(p) / 2 + 3;
      [[0, true], [0.6, true], [1.3, false], [1.9, false]].forEach(([o, dash]) => {
        const ox = hx + tx * (o as number), oy = hy + ty * (o as number);
        if (!dash) { strip('line', [ox - nx * w, oy - ny * w], [ox + nx * w, oy + ny * w], 0.3, 0.38); return; }
        for (let d = -w; d < w; d += 2) strip('line', [ox + nx * d, oy + ny * d], [ox + nx * Math.min(w, d + 1), oy + ny * Math.min(w, d + 1)], 0.3, 0.38);
      });
    }
  }
  const look: { [k: string]: [number, number] } = { apron: [0x8E9399, 1], shoulder: [0x5E636A, 2], asphalt: [0x3B4047, 3], line: [0xE8B730, 5] };
  for (const k in batches) {
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(batches[k], 3)); geo.computeBoundingSphere();
    const m = new T.Mesh(geo, new T.MeshBasicMaterial({ color: look[k][0], side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 - look[k][1], polygonOffsetUnits: -2 - look[k][1] * 2 }));
    m.renderOrder = look[k][1]; g.add(m);
  }
  // stand numbers, flat on the apron in front of each stop bar
  if (L.parkNames && (L.parks || []).length <= 400) {
    const mat: { [n: string]: any } = {};
    for (const pk of L.parks) {
      const name = pk[6] != null ? L.parkNames[pk[6]] : ''; if (!name) continue;
      if (!mat[name]) { const c = document.createElement('canvas'); c.width = 128; c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#F4D35E'; x.font = '700 44px Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(name, 64, 34); const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace; mat[name] = new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -16 }); }
      const h = (pk[2] || 0) * D2R, r = pk[3] || 15, x0 = pk[0] - Math.sin(h) * r * 1.4, y0 = pk[1] - Math.cos(h) * r * 1.4, q = loc(x0, y0);
      const lab = new T.Mesh(new T.PlaneGeometry(Math.max(4, r * 0.5), Math.max(2, r * 0.25)), mat[name]);
      lab.rotation.x = -Math.PI / 2; lab.rotation.z = -h; lab.position.set(q[0], gy(q[0], q[1]) + 0.4, q[1]); lab.renderOrder = 6; g.add(lab);
    }
  }
  return g;
}

/** The clock beside the battery: Flight Simulator's local time where your aircraft is, when it is running and
 *  linked; otherwise this device's own time, as everywhere else in the app. */
function v3dClockStep(now: number) {
  const VC: any = V3d; if (VC.clockAt && now - VC.clockAt < 1000) return; VC.clockAt = now;
  const el = V3d.root && V3d.root.querySelector('.v3d-clock') as HTMLElement; if (!el) return;
  const L: any = typeof Link !== 'undefined' ? (Link as any).sim : null, t = Date.now();
  const sim = !!(L && L.simTime && L.t && t - L.t < 60000 && Link.status === 'connected');
  let txt: string;
  if (sim) {
    const ms = L.simTime + (t - L.t) + (L.simTz != null ? L.simTz * 60000 : -new Date().getTimezoneOffset() * 60000), d = new Date(ms);
    txt = String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0');
  } else { const d = new Date(t); txt = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  const title = sim ? 'Flight Simulator time' + (L.simTz != null ? '' : ' (in this device\'s time zone)') : 'This device\'s time';
  if (el.textContent !== txt) el.innerHTML = `${icon('clock')}<b>${txt}</b>`;
  if (el.title !== title) { el.title = title; el.classList.toggle('sim', sim); }
}

/** A screenshot of the 3D view, kept with your screenshots (on your laptop and in your flight log). */
ACTIONS['v3d-shot'] = () => {
  if (!V3d.open || !V3d.r || !V3d.cv) return;
  try {
    V3d.r.render(V3d.scene, V3d.cam);   // drawn just now, so the picture is there to copy
    const src = V3d.cv, W = src.width, H = src.height, big = document.createElement('canvas'), k = Math.min(1, 1920 / Math.max(W, H));
    big.width = Math.round(W * k); big.height = Math.round(H * k); (big.getContext('2d') as CanvasRenderingContext2D).drawImage(src, 0, 0, big.width, big.height);
    const th = document.createElement('canvas'), t = 320 / Math.max(big.width, big.height); th.width = Math.round(big.width * t); th.height = Math.round(big.height * t); (th.getContext('2d') as CanvasRenderingContext2D).drawImage(big, 0, 0, th.width, th.height);
    const f: any = State.live.filter(x => x.id === V3d.target)[0], cap = `3D view${f ? ` · ${f.reg}, ${f.from} to ${f.to}` : V3d.icao ? ` · ${V3d.icao}` : ''}`;
    const flash = document.createElement('div'); flash.className = 'v3d-flash'; V3d.root.appendChild(flash); setTimeout(() => flash.remove(), 600);
    try { Sound.tick(); } catch (e) { /* quiet */ }
    const full = big.toDataURL('image/jpeg', 0.9);
    Promise.all([PhotoDb.put({ id: uid(), log: '3d', at: Date.now(), data: full, thumb: th.toDataURL('image/jpeg', 0.75), w: big.width, h: big.height, cap, mode: Mode.coop() ? 'coop' : 'solo' }).then(() => true, () => false), photoToDevice(full, cap)])
      .then(([inGame, where]) => { if (!inGame && !where) { toast('The screenshot could not be saved', 'warn'); return; } toast(`Screenshot saved${inGame ? ' on your laptop, in the office' : ''}${inGame && where ? ', and ' : ' '}${where}`, 'ok'); });
  } catch (e) { toast('The screenshot could not be taken', 'warn'); }
};
