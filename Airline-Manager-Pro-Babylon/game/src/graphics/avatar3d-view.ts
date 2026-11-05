// Shows the crew figures (see human.ts) in the interface. One shared WebGL renderer draws every
// avatar into the corner of its canvas, then copies it into the avatar's own canvas:
// small ones become cached pictures (built with less hair detail), the few largest on screen are
// animated live (breathing, a gentle sway, blinking, looking around) and can be turned with a finger.
// Without WebGL, the 3D library or the body data, the drawn 2D avatars are used instead.

declare const THREE: any;

interface AvReq { look: Look; role: CrewRole; accent: string; view: 'full' | 'bust'; still: boolean }

const Av3 = {
  ok: null as boolean,
  renderer: null as any,
  scene: null as any,
  camera: null as any,
  stage: null as any,
  reqs: {} as { [key: string]: AvReq },
  models: new Map<string, any>(),
  pics: new Map<string, HTMLCanvasElement>(),
  queue: [] as HTMLCanvasElement[],
  live: [] as { el: HTMLCanvasElement; model: any; t0: number; yaw: number; drag: any; blinkAt: number; blinkT: number; gaze: number[]; gazeAt: number; lastTouch: number; drawn: number }[],
  failed: false,
  raf: 0,
  sizes: null as any,
};

function av3Supported(): boolean {
  if (Av3.failed) return false;
  if (Av3.ok !== null) return Av3.ok;
  try {
    const T = (window as any).THREE;
    const c = document.createElement('canvas');
    Av3.ok = !!T && !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch (e) { Av3.ok = false; }
  return Av3.ok;
}

/** The studio every figure stands in: sky and floor bounce, a warm key light with soft shadows, a fill,
 *  two rims, reflections for gold, visors and eyes, and a soft contact shadow. One per renderer. */
function av3Studio(r: any): { scene: any; stage: any } {
  const scene = new THREE.Scene();
  // studio light: sky and floor bounce, a warm key light with soft shadows, a soft fill and two rims
  scene.add(new THREE.HemisphereLight(0xdfeaff, 0x3a3128, 1.3));
  const key = new THREE.DirectionalLight(0xfff0e2, 2.8);
  key.position.set(-1.6, 3.2, 3.2); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0003; key.shadow.normalBias = 0.01; key.shadow.radius = 5;
  const sc = key.shadow.camera; sc.left = -0.7; sc.right = 0.7; sc.top = 2.1; sc.bottom = -0.1; sc.near = 0.5; sc.far = 8;
  key.target.position.set(0, 0.9, 0); scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(0xdbe6ff, 1.2); fill.position.set(2.2, 1.8, 2.6); scene.add(fill);
  const rim = new THREE.DirectionalLight(0x8fe4ff, 2.2); rim.position.set(1.4, 2.6, -2.8); scene.add(rim);
  const rim2 = new THREE.DirectionalLight(0xffd9b0, 1.2); rim2.position.set(-1.8, 1.8, -2.2); scene.add(rim2);
  // environment for reflections on gold, visors and eyes
  const pm = new THREE.PMREMGenerator(r);
  const env = new THREE.Scene();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true }));
  const pos = sky.geometry.attributes.position, cols: number[] = [];
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i) / 10; const c = new THREE.Color().setRGB(0.12, 0.16, 0.22).lerp(new THREE.Color(0.9, 0.93, 1.0), Math.max(0, y)); cols.push(c.r, c.g, c.b); }
  sky.geometry.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  env.add(sky);
  for (const [x, y, z, w] of [[-4, 5, 5, 4], [5, 3, 3, 2], [0, 4, -6, 3]]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, w), new THREE.MeshBasicMaterial({ color: 0xffffff })); p.position.set(x, y, z); p.lookAt(0, 1, 0); env.add(p); }
  scene.environment = pm.fromScene(env, 0.02).texture;
  // contact shadow under the feet
  const sh = document.createElement('canvas'); sh.width = sh.height = 128;
  { const g = sh.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.42), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sh), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.002; shadow.renderOrder = -1;
  scene.add(shadow);
  const stage = new THREE.Group(); scene.add(stage);
  return { scene, stage };
}

/** The figures' renderer. Android may take its graphics surface away (the 3D view needs the memory):
 *  then nothing is drawn or kept until it comes back, or a new one is made, and every figure is drawn again. */
let _av3LostAt = 0;
function av3Lost(): boolean {
  const lost = !Av3.renderer || (Av3.renderer.getContext && Av3.renderer.getContext().isContextLost && Av3.renderer.getContext().isContextLost());
  if (!lost) { _av3LostAt = 0; return false; }
  if (!_av3LostAt) _av3LostAt = Date.now();
  // still gone after a while (and the 3D view closed): start a new renderer
  if (Date.now() - _av3LostAt > 8000 && !(typeof V3d !== 'undefined' && V3d.open)) { try { Av3.renderer.dispose(); } catch (e) { /* gone */ } Av3.renderer = null; _av3LostAt = 0; av3MakeRenderer(); av3Redraw(); }
  setTimeout(av3Loop, 1500);
  return true;
}
/** Draw every figure on screen again (after the renderer came back). */
function av3Redraw() { document.querySelectorAll('canvas.av3').forEach(c => { if (Av3.queue.indexOf(c as HTMLCanvasElement) < 0) Av3.queue.push(c as HTMLCanvasElement); }); av3Loop(); }
/** A picture with nothing on it (drawn while the renderer was gone): never kept. */
function av3Blank(c: HTMLCanvasElement): boolean {
  try { const t = document.createElement('canvas'); t.width = t.height = 12; const g = t.getContext('2d'); g.drawImage(c, 0, 0, 12, 12); const d = g.getImageData(0, 0, 12, 12).data; for (let i = 3; i < d.length; i += 4) if (d[i] > 8) return false; return true; } catch (e) { return false; }
}
function av3Init() {
  if (Av3.renderer) return;
  av3MakeRenderer();
  av3Watch();
}
function av3MakeRenderer() {
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false, powerPreference: 'low-power' });
  r.setPixelRatio(1);
  r.setClearColor(0x000000, 0);
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.12;
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  r.domElement.addEventListener('webglcontextlost', (e: Event) => { e.preventDefault(); });
  r.domElement.addEventListener('webglcontextrestored', () => { _av3LostAt = 0; av3Redraw(); });
  Av3.renderer = r;
  const st = av3Studio(r); const scene = st.scene;
  Av3.stage = st.stage;
  Av3.scene = scene;
  Av3.camera = new THREE.PerspectiveCamera(20, 1, 0.1, 30);
}
function av3Watch() {
  // find avatars as they appear in the page, and keep sizes in step
  new MutationObserver(muts => {
    let found = false;
    for (const m of muts) for (const n of Array.prototype.slice.call(m.addedNodes)) {
      if (n.nodeType !== 1) continue;
      const el = n as Element;
      if (el.matches && el.matches('canvas.av3')) { av3Attach(el as HTMLCanvasElement); found = true; }
      if (el.querySelectorAll) el.querySelectorAll('canvas.av3').forEach(c => { av3Attach(c as HTMLCanvasElement); found = true; });
    }
    if (found) av3Pump();
  }).observe(document.body, { childList: true, subtree: true });
  // repaint when an avatar's box changes size (layout changes, pop-ups opening, rotation)
  Av3.sizes = new ResizeObserver(entries => { for (const e of entries) av3Attach(e.target as HTMLCanvasElement, true); av3Pump(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) av3Loop(); });
  // look now and then for figures that should be animated (pop-ups opening, screens changing)
  setInterval(() => { if (!Av3.raf && !document.hidden && document.querySelector('canvas.av3:not(.still)')) av3Loop(); }, 1000);
  // the body data loads once; until then avatars wait
  Human.load().then(() => av3Refresh()).catch((e: any) => {
    Av3.failed = true;
    ErrorLog.add('avatars', 'Crew figures couldn\'t load', (e && e.message) || String(e), 'The drawn avatars are shown instead.', false);
    refresh();
  });
}

/** Proportions chosen in Settings → Crew figures. */
function av3Style(): string { return (State && State.settings && (State.settings as any).crewStyle) || 'balanced'; }

function av3Key(look: Look, role: CrewRole, accent: string): string {
  const L = dressed(look, role);
  return av3Style() + '|' + role + '|' + accent + '|' + ['sex', 'skin', 'face', 'eyes', 'nose', 'lips', 'hair', 'hairColor', 'facial', 'glasses', 'top', 'bottom', 'shoes', 'neck', 'hat', 'uniform', 'civil'].map(k => (L as any)[k]).join(',');
}

/** The avatar markup: a canvas the renderer paints into (see avatarSvg). */
function avatar3dHtml(look: Look, role: CrewRole, o: { view?: 'full' | 'bust'; accent?: string; still?: boolean; cls?: string; mood?: { kind: string; v: number } }): string {
  const accent = o.accent || '#2C8CFF', view = o.view === 'bust' ? 'bust' : 'full';
  const key = av3Key(look, role, accent);
  Av3.reqs[key] = { look: dressed(look, role), role, accent, view, still: !!o.still };
  const mood = o.mood ? ` data-mood="${esc(o.mood.kind)}:${o.mood.v}"` : '';
  return `<canvas class="av av3 ${view === 'bust' ? 'bust' : ''} ${o.still && !o.mood ? 'still' : ''} ${o.mood ? 'mood' : ''} ${o.cls || ''}" data-k="${esc(key)}" data-view="${view}"${mood} role="img" aria-label="Crew avatar"></canvas>`;
}

/** A built figure for a request; q is the detail (1 for large or animated figures, less for small pictures). */
function av3Model(key: string, q?: number): any {
  q = q || 1;
  const mk = key + '|' + q;
  let m = Av3.models.get(mk);
  if (m) { Av3.models.delete(mk); Av3.models.set(mk, m); return m; }
  const rq = Av3.reqs[key]; if (!rq || !Human.ready) return null;
  try { m = Human.build(rq.look, rq.role, rq.accent, key.split('|')[0], q); }
  catch (e) { ErrorLog.add('avatars', 'A crew figure couldn\'t be drawn', (e && e.message) || String(e), e && e.stack, false); return null; }
  Av3.models.set(mk, m);
  // keep a few built figures; free the rest
  while (Av3.models.size > 6) {
    const k0 = Av3.models.keys().next().value, old = Av3.models.get(k0);
    if (Av3.live.some(l => l.model === old) || (typeof Hero !== 'undefined' && Hero.model === old)) break;
    Av3.models.delete(k0); av3Dispose(old.root);
  }
  return m;
}
function av3Dispose(o: any) {
  o.traverse((m: any) => {
    if (m.geometry) m.geometry.dispose();
    if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x: any) => { if (x.map && !(x.map.userData && x.map.userData.shared)) x.map.dispose(); x.dispose(); });
  });
}

/** Camera framing: full figure standing on the bottom edge, or head and shoulders. */
function av3Frame(model: any, view: string, w: number, h: number) {
  const cam = Av3.camera, aspect = w / h;
  cam.aspect = aspect;
  const half = Math.tan(cam.fov * Math.PI / 360);
  let y0: number, y1: number, width: number;
  if (view === 'bust') { y0 = model.bustBottom; y1 = model.top + 0.02; width = 0.5; }
  else { y0 = -0.01; y1 = model.top + 0.03; width = model.width + 0.06; }
  const hgt = y1 - y0;
  const dist = Math.max(hgt / 2 / half, width / 2 / (half * aspect));
  const viewH = dist * half * 2;
  // stand on the bottom edge (like the drawings did) when there's spare height
  const cy = view === 'bust' ? y1 - viewH / 2 + Math.min(0.02, (viewH - hgt) * 0.25) : y0 + viewH / 2;
  cam.position.set(0, cy + (view === 'bust' ? 0.04 : 0.1), dist);
  cam.lookAt(0, cy, 0);
  cam.updateProjectionMatrix();
}

function av3Size(el: HTMLCanvasElement): number[] {
  const dpr = Math.min((window.devicePixelRatio || 1) * uiScale(), 3);
  return [Math.round(el.clientWidth * dpr), Math.round(el.clientHeight * dpr)];
}

/** Draw a model posed at time t (seconds) into the shared renderer at w × h pixels. */
function av3Draw(model: any, view: string, w: number, h: number, pose?: { t: number; yaw: number; blink: number; gaze: number[] }) {
  const r = Av3.renderer;
  if (w > r.domElement.width || h > r.domElement.height) r.setSize(Math.max(w, r.domElement.width), Math.max(h, r.domElement.height), false);
  const H = r.domElement.height;
  r.setViewport(0, H - h, w, h); r.setScissor(0, H - h, w, h); r.setScissorTest(true);
  Av3.stage.add(model.root);
  model.pose(pose || { t: 0, yaw: 0, blink: 0, gaze: [0, 0] });
  av3Frame(model, view, w, h);
  r.clear();
  r.render(Av3.scene, Av3.camera);
  Av3.stage.remove(model.root);
}

/* ---------- saved pictures ----------
   Finished small pictures are kept on the device (IndexedDB), so a figure seen before appears
   at once next time instead of being built again. A new app version starts a fresh set. */
const AvDisk = {
  db: null as IDBDatabase,
  opening: null as Promise<IDBDatabase>,
  missed: new Set<string>(),
  waiting: new Map<string, HTMLCanvasElement[]>(),
  key(pk: string) { return APP.version + '|' + pk; },
  open(): Promise<IDBDatabase> {
    if (this.db) return Promise.resolve(this.db);
    if (this.opening) return this.opening;
    this.opening = new Promise((res, rej) => {
      try {
        const rq = indexedDB.open('amp-crew-pictures', 1);
        rq.onupgradeneeded = () => { const os = rq.result.createObjectStore('pics'); os.createIndex('t', 't'); };
        rq.onsuccess = () => { this.db = rq.result; res(rq.result); this.tidy(); };
        rq.onerror = () => rej(rq.error);
      } catch (e) { rej(e); }
    });
    return this.opening;
  },
  get(pk: string): Promise<Blob> {
    return this.open().then(db => new Promise<Blob>(res => {
      const rq = db.transaction('pics').objectStore('pics').get(this.key(pk));
      rq.onsuccess = () => res(rq.result ? rq.result.b : null); rq.onerror = () => res(null);
    })).catch(() => null);
  },
  put(pk: string, pic: HTMLCanvasElement) {
    if (!pic.toBlob) return;
    pic.toBlob(b => { if (!b) return; this.open().then(db => { try { db.transaction('pics', 'readwrite').objectStore('pics').put({ b, t: Date.now() }, this.key(pk)); } catch (e) { /* storage full */ } }).catch(() => { /* no storage */ }); }, 'image/png');
  },
  /** Keep the newest 400 pictures, and drop pictures from older app versions. */
  tidy() {
    try {
      const os = this.db.transaction('pics', 'readwrite').objectStore('pics');
      const keep = 400; let n = 0;
      os.index('t').openCursor(null, 'prev').onsuccess = (e: any) => {
        const c = e.target.result; if (!c) return;
        n++; if (n > keep || String(c.primaryKey).indexOf(APP.version + '|') !== 0) c.delete();
        c.continue();
      };
    } catch (e) { /* ignore */ }
  },
};

/** Look for a saved picture before building one. */
function av3FromDisk(el: HTMLCanvasElement, pk: string) {
  const W = AvDisk.waiting.get(pk);
  if (W) { if (W.indexOf(el) < 0) W.push(el); return; }
  AvDisk.waiting.set(pk, [el]);
  AvDisk.get(pk).then(blob => {
    if (!blob || !(window as any).createImageBitmap) return null;
    return createImageBitmap(blob).catch(() => null);
  }).then((bmp: ImageBitmap) => {
    const els = AvDisk.waiting.get(pk) || []; AvDisk.waiting.delete(pk);
    if (bmp) {
      const pic = document.createElement('canvas'); pic.width = bmp.width; pic.height = bmp.height;
      pic.getContext('2d').drawImage(bmp, 0, 0); if (bmp.close) bmp.close();
      if (av3Blank(pic)) AvDisk.missed.add(pk); else Av3.pics.set(pk, pic);
    } else AvDisk.missed.add(pk);
    for (const e of els) if (e.isConnected) av3Attach(e);
    av3Pump();
  });
}

/* ---------- attaching canvases ---------- */
function av3Attach(el: HTMLCanvasElement, resized?: boolean) {
  const key = el.getAttribute('data-k'); if (!key) return;
  if (el.classList.contains('hero')) { heroAttach(el); return; }
  if (!(el as any)._bound) {
    (el as any)._bound = true;
    if (Av3.sizes) Av3.sizes.observe(el);
    el.addEventListener('pointerdown', ev => av3Grab(el, ev));
  }
  const [w, h] = av3Size(el);
  if (!w || !h) return;
  if (el.width !== w || el.height !== h) { el.width = w; el.height = h; }
  const pk = key + '|' + el.getAttribute('data-view') + '|' + w + 'x' + h;
  const pic = Av3.pics.get(pk);
  // already painted before (a card redrawn, a list refreshed): shown at once, no fade, so it never flickers
  if (pic) { const g = el.getContext('2d'); g.clearRect(0, 0, w, h); g.drawImage(pic, 0, 0); el.classList.add('nofade', 'in'); }
  else if (!AvDisk.missed.has(pk) && el.clientHeight < 230 && window.indexedDB) av3FromDisk(el, pk);
  else if (Av3.queue.indexOf(el) < 0) Av3.queue.push(el);
  void resized;
}

/** Work through avatars that still need a picture, a few per frame. */
function av3Pump() {
  if (Av3.raf) return;
  av3Loop();
}
function av3Loop() {
  cancelAnimationFrame(Av3.raf);
  Av3.raf = requestAnimationFrame(av3Tick);
}
function av3Tick(now: number) {
  Av3.raf = 0;
  if (av3Lost()) return;
  const t0 = performance.now();
  // pending pictures
  while (Human.ready && Av3.queue.length && performance.now() - t0 < 24) {
    const el = Av3.queue.shift();
    if (!el.isConnected) continue;
    const key = el.getAttribute('data-k'), view = el.getAttribute('data-view');
    const [w, h] = av3Size(el); if (!w || !h) continue;
    const pk = key + '|' + view + '|' + w + 'x' + h;
    let pic = Av3.pics.get(pk);
    // a window that has just opened slides into view first; its figure is built right after (never in the way of it)
    if (!pic && performance.now() - ((window as any).__layerAt || 0) < 380) { Av3.queue.unshift(el); setTimeout(av3Loop, 400); return; }
    if (!pic) {
      // small pictures are built with less hair, which looks the same at that size and is much quicker
      const model = av3Model(key, el.clientHeight < 230 ? 0.3 : 1); if (!model) continue;
      av3Draw(model, view, w, h);
      pic = document.createElement('canvas'); pic.width = w; pic.height = h;
      pic.getContext('2d').drawImage(Av3.renderer.domElement, 0, 0, w, h, 0, 0, w, h);
      if (av3Lost() || av3Blank(pic)) { Av3.queue.push(el); break; }
      Av3.pics.set(pk, pic);
      if (el.clientHeight < 230) AvDisk.put(pk, pic);
      if (Av3.pics.size > 160) Av3.pics.delete(Av3.pics.keys().next().value);
    }
    if (el.width !== w || el.height !== h) { el.width = w; el.height = h; }
    const g = el.getContext('2d'); g.clearRect(0, 0, w, h); g.drawImage(pic, 0, 0);
    el.classList.add('in');
  }
  av3PickLive();
  // live figures
  const sec = now / 1000;
  for (const L of Av3.live) {
    const el = L.el, [w, h] = av3Size(el);
    if (!w || !h) continue;
    if (el.width !== w || el.height !== h) { el.width = w; el.height = h; }
    if (sec > L.blinkAt) { L.blinkT = sec; L.blinkAt = sec + 2.4 + Math.random() * 3.6; }
    const bt = (sec - L.blinkT) / 0.16, blink = bt >= 0 && bt <= 1 ? Math.sin(bt * Math.PI) : 0;
    if (sec > L.gazeAt) { L.gaze = [(Math.random() - 0.5) * 0.35, (Math.random() - 0.5) * 0.15]; L.gazeAt = sec + 1.2 + Math.random() * 2.5; }
    // a figure stays the way you turned it; a double tap turns it back to face you
    if ((L as any).back) { L.yaw *= 0.86; if (Math.abs(L.yaw) < 0.005) { L.yaw = 0; (L as any).back = false; } }
    _av3Yaw[el.getAttribute('data-k') || ''] = L.yaw;
    if (sec - L.drawn < 1 / 30) continue;   // 30 frames a second is plenty for idle motion
    L.drawn = sec;
    const md = el.getAttribute('data-mood'), mood = md ? { kind: md.split(':')[0], v: +md.split(':')[1] || 0 } : null;
    av3Draw(L.model, el.getAttribute('data-view'), w, h, { t: sec - L.t0, yaw: L.yaw, blink, gaze: L.gaze, mood } as any);
    const g = el.getContext('2d');
    g.clearRect(0, 0, w, h); g.drawImage(Av3.renderer.domElement, 0, 0, w, h, 0, 0, w, h);
    el.classList.add('in');
  }
  if ((Av3.queue.length || Av3.live.length) && !document.hidden) Av3.raf = requestAnimationFrame(av3Tick);
}

let _av3PickAt = 0;
/** Animate the (up to six) largest visible figures that aren't marked still; anyone showing a mood first. */
function av3PickLive() {
  const now = performance.now();
  if (now - _av3PickAt < 500 && Av3.live.every(l => l.el.isConnected)) return;
  _av3PickAt = now;
  if (!Human.ready || (State && State.settings && State.settings.reduceMotion)) { Av3.live = []; return; }
  const cands: { el: HTMLCanvasElement; area: number }[] = [];
  document.querySelectorAll('canvas.av3:not(.still):not(.hero)').forEach(c => {
    const el = c as HTMLCanvasElement, r = el.getBoundingClientRect();
    if (!r.width || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return;
    const hasMood = el.hasAttribute('data-mood');
    if (r.width * r.height < (hasMood ? 1500 : 4000)) return;
    // skip figures behind an open pop-up
    const top = document.elementFromPoint(Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2)), Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2)));
    if (top && top !== el && !el.contains(top) && !(top as Element).contains(el) && !(el.parentElement && el.parentElement.contains(top))) return;
    cands.push({ el, area: r.width * r.height * (hasMood ? 100 : 1) });
  });
  cands.sort((a, b) => b.area - a.area);
  const pick = cands.slice(0, 6).map(c => c.el);   // up to six people move at once (staff in lists too)
  Av3.live.forEach(l => { if (pick.indexOf(l.el) < 0) l.el.classList.remove('live'); });
  Av3.live = Av3.live.filter(l => pick.indexOf(l.el) >= 0);
  pick.forEach(el => el.classList.add('live'));
  for (const el of pick) {
    if (Av3.live.some(l => l.el === el)) continue;
    const model = av3Model(el.getAttribute('data-k')); if (!model) continue;
    const sec = performance.now() / 1000;
    Av3.live.push({ el, model, t0: sec - Math.random() * 6, yaw: _av3Yaw[el.getAttribute('data-k') || ''] || 0, drag: null, blinkAt: sec + 1 + Math.random() * 2, blinkT: -9, gaze: [0, 0], gazeAt: sec + 1, lastTouch: 0, drawn: 0 });
  }
}

/** How far each person has been turned (kept while the app runs, so they stay as you left them). */
const _av3Yaw: { [key: string]: number } = {};

/** Turn a live figure with a finger. */
function av3Grab(el: HTMLCanvasElement, ev: PointerEvent) {
  const L = Av3.live.filter(l => l.el === el)[0]; if (!L) return;
  ev.stopPropagation();
  const x0 = ev.clientX, yaw0 = L.yaw, now = performance.now() / 1000;
  if (now - L.lastTouch < 0.32 && !L.drag) { (L as any).back = true; L.lastTouch = 0; av3Loop(); return; }   // double tap
  (L as any).back = false;
  L.drag = true; L.lastTouch = now;
  try { el.setPointerCapture(ev.pointerId); } catch (e) { /* older WebView */ }
  const move = (e: PointerEvent) => { L.yaw = yaw0 + (e.clientX - x0) / 90; L.lastTouch = performance.now() / 1000; };
  const up = () => { L.drag = null; L.lastTouch = performance.now() / 1000; el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); };
  el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  av3Loop();
}

/** Repaint avatars that were waiting for a size (e.g. inside a pop-up that just opened). */
function av3Refresh() {
  if (!Av3.renderer) return;
  document.querySelectorAll('canvas.av3').forEach(c => av3Attach(c as HTMLCanvasElement));
  av3Pump();
}


/* ---------- the hero figure ----------
   The large figure in the look editor gets a renderer of its own that draws straight into its canvas
   at the screen's full frame rate (no copying), so it moves completely smoothly. Its camera glides
   to what you are editing: the whole figure, head and shoulders, a close-up of the face, or the shoes. */
type HeroCam = 'full' | 'bust' | 'face' | 'feet';
const Hero = {
  el: null as HTMLCanvasElement, r: null as any, scene: null as any, stage: null as any, cam: null as any,
  key: '', model: null as any, mode: 'full' as HeroCam, cur: null as number[], raf: 0, last: 0,
  t0: 0, yaw: 0, drag: false, lastTouch: 0, blinkAt: 0, blinkT: -9, gaze: [0, 0], gazeAt: 0, fade: 1,
};

function heroAttach(el: HTMLCanvasElement) {
  if (Hero.el !== el) {
    heroRelease();
    Hero.el = el;
    try {
      const r = new THREE.WebGLRenderer({ canvas: el, antialias: true, alpha: true, powerPreference: 'high-performance' });
      r.setClearColor(0x000000, 0); r.outputColorSpace = THREE.SRGBColorSpace;
      r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.12;
      r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
      el.addEventListener('webglcontextlost', (e: Event) => { e.preventDefault(); });
      const st = av3Studio(r);
      Hero.r = r; Hero.scene = st.scene; Hero.stage = st.stage; Hero.cam = new THREE.PerspectiveCamera(20, 1, 0.05, 30);
    } catch (e) { el.classList.remove('hero'); Hero.el = null; av3Attach(el); return; }
    el.addEventListener('pointerdown', ev => heroGrab(ev));
    const sec = performance.now() / 1000;
    Object.assign(Hero, { key: '', model: null, cur: null, t0: sec - Math.random() * 6, yaw: 0, drag: false, lastTouch: 0, blinkAt: sec + 1.2, blinkT: -9, gaze: [0, 0], gazeAt: sec + 1 });
  }
  heroSetMode((el.getAttribute('data-cam') as HeroCam) || Hero.mode);
  if (!Hero.raf) Hero.raf = requestAnimationFrame(heroTick);
}

function heroRelease() {
  if (Hero.raf) cancelAnimationFrame(Hero.raf); Hero.raf = 0;
  if (Hero.model && Hero.stage) Hero.stage.remove(Hero.model.root);
  if (Hero.r) { try { Hero.r.dispose(); Hero.r.forceContextLoss(); } catch (e) { /* already gone */ } }
  Object.assign(Hero, { el: null, r: null, scene: null, stage: null, cam: null, model: null, key: '' });
}

/** Change what the camera looks at; it glides there. */
function heroSetMode(m: HeroCam) { Hero.mode = m; if (Hero.el) Hero.el.setAttribute('data-cam', m); }

/** Switch the hero canvas to another look without replacing it (the camera and motion carry on). */
function heroSetKey(el: HTMLCanvasElement, key: string) { el.setAttribute('data-k', key); if (Hero.el === el) Hero.key = ''; }

/** Camera target [height looked at, distance] for a framing. */
function heroTarget(model: any, mode: HeroCam, aspect: number): number[] {
  const half = Math.tan(20 * Math.PI / 360);
  let y0: number, y1: number, width: number;
  if (mode === 'face') { y0 = model.headY - 0.16; y1 = Math.min(model.top + 0.015, model.headY + 0.17); width = 0.34; }
  else if (mode === 'bust') { y0 = model.bustBottom; y1 = model.top + 0.02; width = 0.56; }
  else if (mode === 'feet') { y0 = -0.03; y1 = 0.4; width = 0.5; }
  else { y0 = -0.01; y1 = model.top + 0.03; width = model.width + 0.06; }
  const dist = Math.max((y1 - y0) / 2 / half, width / 2 / (half * aspect));
  const viewH = dist * half * 2, cy = mode === 'full' ? y0 + viewH / 2 : (y0 + y1) / 2;
  return [cy, dist];
}

function heroTick(now: number) {
  Hero.raf = 0;
  const el = Hero.el;
  if (!el || !el.isConnected || !Hero.r) { heroRelease(); return; }
  Hero.raf = requestAnimationFrame(heroTick);
  if (document.hidden || !Human.ready) return;
  const sec = now / 1000, dt = Math.min(0.1, Hero.last ? sec - Hero.last : 0.016); Hero.last = sec;
  // the look changed: build the new figure (the old one stays on screen until it's ready)
  const key = el.getAttribute('data-k');
  if (key !== Hero.key) {
    const m = av3Model(key, 1);
    if (m) { if (Hero.model) Hero.stage.remove(Hero.model.root); Hero.model = m; Hero.key = key; Hero.yaw = _av3Yaw['hero:' + key] || 0; Hero.stage.add(m.root); el.classList.add('in'); }
  }
  const model = Hero.model; if (!model) return;
  const dpr = Math.min((window.devicePixelRatio || 1) * uiScale(), 3), w = Math.round(el.clientWidth * dpr), h = Math.round(el.clientHeight * dpr);
  if (!w || !h) return;
  if (el.width !== w || el.height !== h) Hero.r.setSize(w, h, false);
  // idle motion
  if (sec > Hero.blinkAt) { Hero.blinkT = sec; Hero.blinkAt = sec + 2.4 + Math.random() * 3.6; }
  const bt = (sec - Hero.blinkT) / 0.16, blink = bt >= 0 && bt <= 1 ? Math.sin(bt * Math.PI) : 0;
  if (sec > Hero.gazeAt) { Hero.gaze = [(Math.random() - 0.5) * 0.35, (Math.random() - 0.5) * 0.15]; Hero.gazeAt = sec + 1.2 + Math.random() * 2.5; }
  if ((Hero as any).back) { Hero.yaw *= Math.exp(-dt * 7); if (Math.abs(Hero.yaw) < 0.005) { Hero.yaw = 0; (Hero as any).back = false; } }
  _av3Yaw['hero:' + Hero.key] = Hero.yaw;
  const calm = State && State.settings && State.settings.reduceMotion;
  model.pose({ t: calm ? 0 : sec - Hero.t0, yaw: Hero.yaw, blink: calm ? 0 : blink, gaze: calm ? [0, 0] : Hero.gaze });
  // camera glides to its framing (critically damped, frame-rate independent)
  const tgt = heroTarget(model, Hero.mode, w / h);
  if (!Hero.cur) Hero.cur = tgt.slice();
  const k = 1 - Math.exp(-dt * 5.5);
  Hero.cur[0] += (tgt[0] - Hero.cur[0]) * k; Hero.cur[1] += (tgt[1] - Hero.cur[1]) * k;
  const cam = Hero.cam, close = Hero.cur[1] < 2.2;
  cam.aspect = w / h; cam.position.set(0, Hero.cur[0] + (close ? 0.01 : 0.1), Hero.cur[1]); cam.lookAt(0, Hero.cur[0], 0); cam.updateProjectionMatrix();
  Hero.r.render(Hero.scene, cam);
}

function heroGrab(ev: PointerEvent) {
  const el = Hero.el; if (!el) return;
  ev.stopPropagation();
  const x0 = ev.clientX, yaw0 = Hero.yaw, now = performance.now() / 1000;
  if (now - Hero.lastTouch < 0.32 && !Hero.drag) { (Hero as any).back = true; Hero.lastTouch = 0; return; }   // double tap
  (Hero as any).back = false;
  Hero.drag = true; Hero.lastTouch = now;
  try { el.setPointerCapture(ev.pointerId); } catch (e) { /* older WebView */ }
  const move = (e: PointerEvent) => { Hero.yaw = yaw0 + (e.clientX - x0) / 90; Hero.lastTouch = performance.now() / 1000; };
  const up = () => { Hero.drag = false; Hero.lastTouch = performance.now() / 1000; el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); };
  el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
}
