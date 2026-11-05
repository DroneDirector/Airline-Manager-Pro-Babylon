// The start screen: after the start-up screen, a film plays to the soundtrack (the stand with its ground power,
// the pushback, the flight deck being pushed back, the aircraft above the clouds at sunset and the operations desk),
// cut to the beat, with close-up reveals of the aircraft between the wide shots. The film runs as long as the
// music and starts again with it. On the left: Continue, New game, Save game, Load game, Options and Quit.
// The pictures are graded once (assets/title, made by tools/title) and moved, lit and layered here, frame by frame.

const TS_BPM = 101.63, TS_OFF = 0.322, TS_BEAT = 60 / TS_BPM, TS_DUR = 257.16;
type TsView = [number, number, number];   // centre x, centre y, visible width (in the picture's pixels)
interface TsShot { img: string; kind: 'd' | 'w' | 'c' | 'f'; beats: number; a: TsView; b: TsView; cap?: [string, string]; lights?: string }
// one round of the film, in beats, opening above the clouds; it repeats (mirrored every other round) until the music ends
const TS_SHOTS: TsShot[] = [
  { img: 'fly', kind: 'f', beats: 16, a: [700, 384, 1408], b: [720, 380, 1220], cap: ['Above the clouds', 'Sunset at flight level 370'], lights: 'fly' },   // it opens above the clouds at sunset
  { img: 'fly', kind: 'd', beats: 8, a: [1128, 262, 360], b: [1100, 252, 300] },                 // the tail and its S, lit up
  { img: 't1', kind: 'd', beats: 8, a: [660, 488, 420], b: [722, 492, 340] },                     // the engine
  { img: 't1', kind: 'd', beats: 8, a: [1040, 528, 300], b: [1028, 510, 250] },                   // the nose gear
  { img: 't1', kind: 'w', beats: 16, a: [704, 384, 1300], b: [905, 520, 880], cap: ['Stand 214', 'Ground power connected'] },
  { img: 't2', kind: 'd', beats: 8, a: [600, 530, 340], b: [548, 518, 280] },                     // the nose gear and the tow bar
  { img: 't2', kind: 'd', beats: 8, a: [900, 470, 330], b: [860, 462, 270] },                     // the engine
  { img: 't2', kind: 'w', beats: 16, a: [800, 404, 1340], b: [620, 450, 1000], cap: ['Pushback', 'Cleared, facing west'], lights: 'push' },
  { img: 't3', kind: 'c', beats: 16, a: [792, 336, 1584], b: [792, 322, 1420], cap: ['Flight deck', 'Brakes released'] },
  { img: 'fly', kind: 'd', beats: 8, a: [690, 492, 340], b: [740, 488, 290] },                    // the engine in flight
  { img: 'fly', kind: 'd', beats: 8, a: [300, 372, 420], b: [350, 366, 360] },                    // the nose and the flight deck windows
  { img: 'fly', kind: 'd', beats: 8, a: [1215, 425, 320], b: [1245, 418, 260] },                  // the wing tip
  { img: 'fly', kind: 'f', beats: 16, a: [740, 384, 1340], b: [690, 380, 1150], cap: ['Cruise', 'Flight level 370'], lights: 'fly' },
  { img: 't5', kind: 'w', beats: 16, a: [688, 384, 1300], b: [722, 330, 760], cap: ['Operations control', 'Every flight, on one screen'] },
];
const TS_ROUND = TS_SHOTS.reduce((s, x) => s + x.beats, 0);

const TitleScreen: any = {
  on: false, root: null as HTMLElement, cv: null as HTMLCanvasElement, cx: null as CanvasRenderingContext2D, raf: 0,
  img: {} as { [k: string]: any }, blur: {} as { [k: string]: HTMLCanvasElement }, ready: false,
  audio: null as HTMLAudioElement, env: null as Uint8Array, kick: null as Uint8Array, clock0: 0, lastShot: -1, flash: 0, glitch: 0, after: [] as (() => void)[],
  grain: null as HTMLCanvasElement, tmp: null as HTMLCanvasElement, focus: 0, panel: '', capKey: '',
};

/** Shown after the start-up screen when it's switched on. */
function titleShowing(): boolean { return !!TitleScreen.on; }
/** Run something once the start screen is gone (straight away when it isn't there). */
function titleDefer(f: () => void) { if (TitleScreen.on) TitleScreen.after.push(f); else f(); }
function titleMusicOn(): boolean { const S: any = State.settings; return S.titleMusic !== false && !S.muteAll; }

/** After the start-up screen: straight into the game after a new game or a loaded save, otherwise the start screen. */
function titleAfterSplash() {
  let next = ''; try { next = sessionStorage.getItem('amp-title-next') || ''; sessionStorage.removeItem('amp-title-next'); } catch (e) { /* none */ }
  if (next === 'office') { setTimeout(() => { try { OfficeRoom.open(); } catch (e) { /* the overview stays */ } }, 200); return; }
  if (next === 'game') return;
  titleOpen();
}

function titleOpen() {
  const T = TitleScreen; if (T.on) return;
  T.on = true; document.body.classList.add('ts-on');
  try { Voice.stop(); } catch (e) { /* none */ }
  const S: any = State.settings; if (S.titleMusic === undefined) S.titleMusic = true;
  const r = document.createElement('div'); r.className = 'ts'; r.setAttribute('role', 'dialog'); r.setAttribute('aria-label', 'Start screen');
  r.innerHTML = titleHtml(); document.body.appendChild(r); T.root = r;
  T.cv = r.querySelector('.ts-cv'); T.cx = T.cv.getContext('2d');
  T.fit = () => { const w = r.clientWidth, h = r.clientHeight, k = Math.min(1.5, window.devicePixelRatio || 1, 2200 / Math.max(1, w)); T.cv.width = Math.round(w * k); T.cv.height = Math.round(h * k); };
  T.fit(); window.addEventListener('resize', T.fit);
  titleLoad();
  titleMusic();
  T.key = (e: KeyboardEvent) => titleKey(e); document.addEventListener('keydown', T.key, true);
  requestAnimationFrame(() => r.classList.add('in'));
  T.clock0 = performance.now(); T.lastShot = -1;
  const loop = () => { if (!T.on) return; T.raf = requestAnimationFrame(loop); if (!document.hidden) titleFrame(); };
  T.raf = requestAnimationFrame(loop);
  setTimeout(() => { const b = r.querySelector('.ts-nav button') as HTMLElement; if (b && !('ontouchstart' in window)) b.focus({ preventScroll: true } as any); }, 900);
}

/** Leave the start screen: the music fades, the picture goes dark, then whatever comes next. */
function titleClose(then?: () => void) {
  const T = TitleScreen; if (!T.on || T.closing) return; T.closing = true;
  const r = T.root, a = T.audio; r.classList.add('out');
  if (a) { const v0 = a.volume, t0 = performance.now(); const fade = () => { const k = Math.min(1, (performance.now() - t0) / 1100); a.volume = v0 * (1 - k); if (k < 1) requestAnimationFrame(fade); else { a.pause(); a.src = ''; } }; fade(); }
  setTimeout(() => {
    T.on = false; T.closing = false; cancelAnimationFrame(T.raf); window.removeEventListener('resize', T.fit); document.removeEventListener('keydown', T.key, true);
    r.remove(); document.body.classList.remove('ts-on'); T.audio = null; T.img = {}; T.blur = {}; T.ready = false;
    try { if (then) then(); } catch (e) { /* ignore */ }
    const q = T.after.splice(0); q.forEach((f: any) => { try { f(); } catch (e) { /* ignore */ } });
  }, 850);
}

function titleHtml(): string {
  const item = (act: string, ic: string, label: string, sub: string) => `<button class="ts-btn" data-act="${act}" style="--i:${_tsI++}"><span class="ts-bi">${icon(ic)}</span><span class="ts-bt"><b>${label}</b><small>${sub}</small></span><i class="ts-sheen"></i></button>`;
  let _tsI = 0;
  const co = company();
  return `<canvas class="ts-cv" aria-hidden="true"></canvas>
    <div class="ts-fx" aria-hidden="true"></div>
    <div class="ts-left">
      <div class="ts-logo" aria-label="${esc(APP.name)}"><span class="ts-l1">Airline</span><span class="ts-l2">Manager</span><span class="ts-l3">Pro</span></div>
      <nav class="ts-nav">
        ${Store.nogame() ? '' : item('ts-continue', 'play', 'Continue', co ? esc(co.name) : 'Back into the game')}
        ${item('ts-new', 'plus', 'New game', 'Create your pilot and airline')}
        ${Store.nogame() ? '' : item('ts-save', 'check', 'Save game', 'Up to 20 saves')}
        ${item('ts-load', 'download', 'Load game', 'Pick up any save')}
        ${item('ts-mods', 'layers', 'Mods', 'Replace models, pictures and sounds')}
        ${item('ts-options', 'gear', 'Options', 'Every setting')}
        ${item('ts-quit', 'power', 'Quit', 'Asks first, offers to save')}
      </nav>
    </div>
    <div class="ts-panel" hidden></div>
    <div class="ts-cap" aria-hidden="true"><small></small><b></b></div>
    <small class="ts-ver">v${esc(APP.version)}</small>
    <button class="ts-mute ${titleMusicOn() ? '' : 'off'}" data-act="ts-mute" aria-label="Music on or off"><span class="ts-eq"><i></i><i></i><i></i><i></i></span><span class="ts-ml">${titleMusicOn() ? 'Music on' : 'Music off'}</span></button>
    <div class="ts-tap" hidden>Tap anywhere for sound</div>`;
}

/* ---------- the pictures ---------- */
function titleLoad() {
  const T = TitleScreen, base = 'assets/title/', list: [string, string][] = [['t1', 't1.webp'], ['t2', 't2.webp'], ['t3o', 't3o.webp'], ['t3i', 't3i.webp'], ['t4b', 't4b.webp'], ['t4a', 't4a.webp'], ['t5', 't5.webp']];
  let left = list.length;
  for (const [k, f] of list) {
    const im = new Image(); im.decoding = 'async';
    im.onload = () => { T.img[k] = im; T.blur[k] = titleBlurOf(im); if (--left === 0) T.ready = true; };
    im.onerror = () => { if (--left === 0) T.ready = true; };
    im.src = base + f;
  }
  // the music's loudness, 25 times a second (all of it, and the kick drum), to light the film in time with it
  fetch(base + 'env.json').then(r => r.json()).then(j => { const d = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0)); T.env = d(j.e); T.kick = d(j.k); }).catch(() => { /* lit evenly */ });
  // film grain
  const g = document.createElement('canvas'); g.width = g.height = 256; const x = g.getContext('2d') as CanvasRenderingContext2D, d = x.createImageData(256, 256);
  for (let i = 0; i < d.data.length; i += 4) { const v = 128 + (Math.random() - 0.5) * 120; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  x.putImageData(d, 0, 0); T.grain = g; T.tmp = document.createElement('canvas');
}
/** A soft copy of a picture, for what is out of focus. */
function titleBlurOf(im: HTMLImageElement): HTMLCanvasElement {
  const c = document.createElement('canvas'), w = Math.max(8, Math.round(im.width / 10)), h = Math.max(8, Math.round(im.height / 10)); c.width = w; c.height = h;
  const x = c.getContext('2d') as CanvasRenderingContext2D; x.imageSmoothingQuality = 'high'; x.drawImage(im, 0, 0, w, h);
  const c2 = document.createElement('canvas'); c2.width = Math.round(im.width / 2); c2.height = Math.round(im.height / 2);
  const x2 = c2.getContext('2d') as CanvasRenderingContext2D; x2.imageSmoothingQuality = 'high'; x2.drawImage(c, 0, 0, c2.width, c2.height); return c2;
}

/* ---------- the music ---------- */
function titleMusic() {
  const T = TitleScreen, a = new Audio('assets/title/title.mp3'); a.preload = 'auto'; a.volume = 0.85; T.audio = a;
  a.muted = !titleMusicOn();
  a.addEventListener('ended', () => { if (!T.on) return; T.flash = 1; a.currentTime = 0; a.play().catch(() => { /* waits for a tap */ }); });
  const tryPlay = () => a.play().catch(() => {
    // the device wants a tap before sound: the film runs on silently, and the first tap brings the music in
    a.muted = true; a.play().catch(() => { /* the film keeps its own clock */ });
    if (titleMusicOn()) { const tap = T.root && T.root.querySelector('.ts-tap'); if (tap) tap.hidden = false; }
    const un = () => { document.removeEventListener('pointerdown', un, true); document.removeEventListener('keydown', un, true); const tp = T.root && T.root.querySelector('.ts-tap'); if (tp) tp.hidden = true; if (T.audio === a) { a.muted = !titleMusicOn(); a.play().catch(() => { /* still not */ }); } };
    document.addEventListener('pointerdown', un, true); document.addEventListener('keydown', un, true);
  });
  tryPlay();
}
ACTIONS['ts-mute'] = () => {
  const S: any = State.settings; S.titleMusic = !titleMusicOn(); if (S.titleMusic && S.muteAll) S.muteAll = false;
  Store.save(); Sound.tick(); const T = TitleScreen, on = titleMusicOn();
  if (T.audio) { T.audio.muted = !on; if (on) T.audio.play().catch(() => { /* later */ }); }
  const b = T.root && T.root.querySelector('.ts-mute'); if (b) { b.classList.toggle('off', !on); const l = b.querySelector('.ts-ml'); if (l) l.textContent = on ? 'Music on' : 'Music off'; }
};
/** The setting changed somewhere else (Options → Sound): the start screen follows. */
function titleMusicSync() { const T = TitleScreen; if (!T.on) return; const on = titleMusicOn(); if (T.audio) { T.audio.muted = !on; if (on) T.audio.play().catch(() => { /* later */ }); } const b = T.root.querySelector('.ts-mute'); if (b) { b.classList.toggle('off', !on); const l = b.querySelector('.ts-ml'); if (l) l.textContent = on ? 'Music on' : 'Music off'; } }

/** Where the film is: the music's own time while it plays, otherwise a clock that runs at the same pace. */
function titleTime(): number {
  const T = TitleScreen, a = T.audio;
  if (a && !a.paused && a.currentTime > 0) return a.currentTime;
  return ((performance.now() - T.clock0) / 1000) % TS_DUR;
}
function titleLevel(arr: Uint8Array, t: number): number { if (!arr || !arr.length) return 0.5; const i = Math.min(arr.length - 1, Math.max(0, Math.floor(t * 25))); return arr[i] / 255; }

/* ---------- every frame ---------- */
const _tsE = (k: number) => k < 0 ? 0 : k > 1 ? 1 : k * k * (3 - 2 * k);
function titleFrame() {
  const T = TitleScreen, c = T.cv, x = T.cx, W = c.width, H = c.height; if (!W || !H) return;
  const t = titleTime(), beat = (t - TS_OFF) / TS_BEAT, kick = titleLevel(T.kick, t), lvl = titleLevel(T.env, t);
  T.root.style.setProperty('--kick', kick.toFixed(3)); T.root.style.setProperty('--lvl', lvl.toFixed(3));
  x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1; x.fillStyle = '#05030c'; x.fillRect(0, 0, W, H);
  if (!T.ready || beat < 0) { titleOverlays(x, W, H, t, kick, lvl, null, 0); return; }
  // which shot, and how far into it
  const round = Math.floor(beat / TS_ROUND); let b = beat - round * TS_ROUND, i = 0;
  while (i < TS_SHOTS.length - 1 && b >= TS_SHOTS[i].beats) { b -= TS_SHOTS[i].beats; i++; }
  const sh = TS_SHOTS[i], k = Math.min(1, b / sh.beats), id = round * 100 + i, flip = round % 2 === 1;
  if (id !== T.lastShot) { T.lastShot = id; if (sh.kind !== 'd') T.flash = Math.max(T.flash, 0.55 + kick * 0.4); T.glitch = 1; titleCaption(sh); }
  // the camera: from a to b (b to a every other round), eased
  const e = flip ? 1 - _tsE(k) : _tsE(k), v: TsView = [sh.a[0] + (sh.b[0] - sh.a[0]) * e, sh.a[1] + (sh.b[1] - sh.a[1]) * e, sh.a[2] + (sh.b[2] - sh.a[2]) * e];
  const im = sh.img === 'fly' ? T.img.t4b : sh.img === 't3' ? T.img.t3i : T.img[sh.img];
  if (!im) { titleOverlays(x, W, H, t, kick, lvl, sh, k); return; }
  const iw = im.width, ih = im.height;
  let vw = Math.min(v[2], iw, ih * W / H); const vh = vw * H / W;
  // the menu is on the left, so the subject of a shot sits right of the middle
  const side = sh.kind === 'd' ? 0.14 : sh.kind === 'c' ? 0 : 0.06;
  const cx = Math.max(vw / 2, Math.min(iw - vw / 2, v[0] - vw * side)), cy = Math.max(vh / 2, Math.min(ih - vh / 2, v[1]));
  const s = W / vw, ox = W / 2 - cx * s, oy = H / 2 - cy * s;   // picture → screen
  const put = (src: any) => { x.save(); x.setTransform(s, 0, 0, s, ox, oy); x.drawImage(src, 0, 0, iw, ih); x.restore(); };
  if (sh.img === 't3') {
    // the flight deck: the world outside slides away and turns as the aircraft is pushed back
    const o = T.img.t3o, pk = k, sc = 1.24 - 0.24 * _tsE(pk), px = 70 - 110 * _tsE(pk), vx = 800, vy = 250, bump = Math.sin(t * 9) * 0.6 * (1 - pk);
    if (o) { x.save(); x.setTransform(s, 0, 0, s, ox, oy); x.translate(vx + px, vy + bump); x.rotate(-0.012 * _tsE(pk)); x.scale(sc, sc); x.translate(-vx, -vy); x.drawImage(o, 0, 0, iw, ih); x.restore(); }
    put(im);
  } else if (sh.img === 'fly') {
    // above the clouds: the clouds stream past beneath the aircraft, which rides gently on the air
    titleFly(x, T.img.t4b, T.img.t4a, s, ox, oy, iw, ih, t, k);
    titleWisps(x, W, H, t);
  } else put(im);
  // close-ups: a light sweeps across and reveals the shape out of the dark, the background out of focus
  if (sh.kind === 'd') titleReveal(x, W, H, k, sh, T.blur[sh.img === 'fly' ? 't4b' : sh.img], s, ox, oy, iw, ih, flip);
  titleLights(x, s, ox, oy, sh, t, kick);
  titleOverlays(x, W, H, t, kick, lvl, sh, k);
}

/** In flight: the clouds slide by beneath the aircraft (which flies to the left), and it rides gently on the air. */
function titleFly(x: CanvasRenderingContext2D, bg: any, ac: any, s: number, ox: number, oy: number, iw: number, ih: number, t: number, k: number) {
  const ps = 1.2, shift = -120 + 240 * k;
  if (bg) { x.save(); x.setTransform(s, 0, 0, s, ox, oy); x.translate(iw / 2 + shift, ih / 2); x.scale(ps, ps); x.translate(-iw / 2, -ih / 2); x.drawImage(bg, 0, 0, iw, ih); x.restore(); }
  if (ac) { x.save(); x.setTransform(s, 0, 0, s, ox, oy); const by = Math.sin(t * 0.8) * 4 + Math.sin(t * 2.1) * 1.2, rr = Math.sin(t * 0.55) * 0.006; x.translate(700, 380 + by); x.rotate(rr); x.translate(-700, -380); x.drawImage(ac, 0, 0, iw, ih); x.restore(); }
}

/** The light sweep of a close-up: dark at first, a bright edge travelling across, then a sheen gliding over. */
function titleReveal(x: CanvasRenderingContext2D, W: number, H: number, k: number, sh: TsShot, blur: HTMLCanvasElement, s: number, ox: number, oy: number, iw: number, ih: number, flip: boolean) {
  // out of focus round the edges
  if (blur) {
    const T = TitleScreen, tc = T.tmp; if (tc.width !== W || tc.height !== H) { tc.width = W; tc.height = H; }
    const tx = tc.getContext('2d') as CanvasRenderingContext2D; tx.globalCompositeOperation = 'source-over'; tx.clearRect(0, 0, W, H);
    if (sh.img === 'fly') titleFly(tx, blur, T.blur.t4a, s, ox, oy, iw, ih, titleTime(), k);
    else { tx.setTransform(s, 0, 0, s, ox, oy); tx.drawImage(blur, 0, 0, iw, ih); tx.setTransform(1, 0, 0, 1, 0, 0); }
    tx.globalCompositeOperation = 'destination-out';
    const g = tx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.18, W / 2, H / 2, Math.max(W, H) * 0.62);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)'); tx.fillStyle = g; tx.fillRect(0, 0, W, H);
    tx.globalCompositeOperation = 'source-over'; x.drawImage(tc, 0, 0);
  }
  const dir = flip ? -1 : 1, edge = -0.35 + 1.8 * _tsE(Math.min(1, k / 0.55)), soft = 0.32;
  // the dark ahead of the light
  const gx0 = dir > 0 ? 0 : W, gx1 = dir > 0 ? W : 0;
  const g = x.createLinearGradient(gx0, H * 0.15, gx1, H * 0.85), at = (p: number) => Math.max(0, Math.min(1, p));
  g.addColorStop(0, 'rgba(4,2,10,0)'); g.addColorStop(at(edge - soft), 'rgba(4,2,10,0)'); g.addColorStop(at(edge), 'rgba(4,2,10,0.55)'); g.addColorStop(at(edge + 0.18), 'rgba(4,2,10,0.96)'); g.addColorStop(1, 'rgba(4,2,10,0.96)');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  // the bright edge of the light, and later a slow sheen
  const band = (pos: number, width: number, a: number, col: string) => {
    if (pos < -0.3 || pos > 1.3 || a <= 0) return;
    const l = x.createLinearGradient(gx0, H * 0.1, gx1, H * 0.9);
    l.addColorStop(0, 'rgba(0,0,0,0)'); l.addColorStop(at(pos - width), 'rgba(0,0,0,0)'); l.addColorStop(at(pos), col.replace('A', String(a))); l.addColorStop(at(pos + width * 0.6), 'rgba(0,0,0,0)'); l.addColorStop(1, 'rgba(0,0,0,0)');
    x.globalCompositeOperation = 'screen'; x.fillStyle = l; x.fillRect(0, 0, W, H); x.globalCompositeOperation = 'source-over';
  };
  band(edge - 0.02, 0.1, 0.55 * (1 - _tsE((k - 0.45) / 0.15)), 'rgba(255,214,236,A)');
  band(-0.3 + 1.7 * _tsE((k - 0.55) / 0.42), 0.14, 0.32, 'rgba(150,240,255,A)');
}

/** Lights that flash: the beacon and the tug's amber light at the pushback, the beacon and strobes in flight, the sun. */
function titleLights(x: CanvasRenderingContext2D, s: number, ox: number, oy: number, sh: TsShot, t: number, kick: number) {
  const L: [number, number, string, number][] = [];   // picture x, y, colour, strength
  if (sh.img === 't2') {
    const bc = (t % 1.1) < 0.12 ? 1 : 0; if (bc) L.push([748, 299, '255,40,40', 1]);
    L.push([228, 571, '255,170,40', 0.55 + 0.45 * Math.max(0, Math.sin(t * 7))]);
  }
  if (sh.img === 'fly') {
    const ph = t % 1.25; if (ph < 0.06 || (ph > 0.14 && ph < 0.2)) L.push([1206, 456, '255,255,255', 1.2]);
    if ((t % 1.05) < 0.12) L.push([690, 312, '255,50,50', 0.9]);
    L.push([-40, 120, '255,190,120', 0.6 + kick * 0.5]);
  }
  for (const [px, py, col, a] of L) {
    const X = ox + px * s, Y = oy + py * s, r = 26 * s * (0.6 + a * 0.6);
    x.globalCompositeOperation = 'lighter';
    let g = x.createRadialGradient(X, Y, 0, X, Y, r); g.addColorStop(0, `rgba(${col},${0.95 * Math.min(1, a)})`); g.addColorStop(0.25, `rgba(${col},${0.35 * a})`); g.addColorStop(1, `rgba(${col},0)`);
    x.fillStyle = g; x.fillRect(X - r, Y - r, r * 2, r * 2);
    // the anamorphic streak
    x.save(); x.translate(X, Y); x.scale(9, 0.32); g = x.createRadialGradient(0, 0, 0, 0, 0, r); g.addColorStop(0, `rgba(140,200,255,${0.4 * a})`); g.addColorStop(1, 'rgba(140,200,255,0)'); x.fillStyle = g; x.fillRect(-r, -r, r * 2, r * 2); x.restore();
    x.globalCompositeOperation = 'source-over';
  }
}

/** Wisps of cloud rushing past in front, in flight. */
function titleWisps(x: CanvasRenderingContext2D, W: number, H: number, t: number) {
  x.globalCompositeOperation = 'screen';
  for (let i = 0; i < 5; i++) {
    const sp = 0.18 + i * 0.05, px = ((t * sp + i * 0.37) % 1.6 - 0.3) * W, py = H * (0.72 + 0.06 * Math.sin(i * 7.3) + 0.04 * i), r = H * (0.22 + 0.05 * (i % 3));
    const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, 'rgba(255,190,200,0.10)'); g.addColorStop(1, 'rgba(255,190,200,0)');
    x.save(); x.translate(px, py); x.scale(2.6, 0.5); x.translate(-px, -py); x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2); x.restore();
  }
  x.globalCompositeOperation = 'source-over';
}

/** Over every frame: coloured light leaks pulsing with the music, a flash at a cut, a glitch, letterbox, grain. */
function titleOverlays(x: CanvasRenderingContext2D, W: number, H: number, t: number, kick: number, lvl: number, sh: TsShot, k: number) {
  const T = TitleScreen;
  // light leaks: magenta from one side, cyan from the other, drifting
  x.globalCompositeOperation = 'screen';
  const leak = (cx: number, cy: number, r: number, col: string, a: number) => { const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`); x.fillStyle = g; x.fillRect(0, 0, W, H); };
  leak(W * (0.08 + 0.06 * Math.sin(t * 0.21)), H * (0.2 + 0.1 * Math.sin(t * 0.17)), W * 0.55, '255,40,170', 0.13 + 0.12 * kick);
  leak(W * (0.95 - 0.05 * Math.sin(t * 0.19)), H * (0.85 + 0.08 * Math.cos(t * 0.23)), W * 0.5, '40,220,255', 0.10 + 0.08 * lvl);
  leak(W * 0.6, -H * 0.1, W * 0.45, '255,150,60', 0.06 + 0.06 * kick);
  x.globalCompositeOperation = 'source-over';
  // a flash of light at a cut
  if (T.flash > 0.01) { x.fillStyle = `rgba(255,236,250,${T.flash * 0.75})`; x.fillRect(0, 0, W, H); T.flash *= 0.84; }
  // a short tape glitch at a cut: slices of the picture slip sideways, with a cyan and magenta fringe
  if (T.glitch > 0.02) {
    const tc = T.tmp; if (tc.width !== W || tc.height !== H) { tc.width = W; tc.height = H; }
    const tx = tc.getContext('2d') as CanvasRenderingContext2D; tx.globalCompositeOperation = 'source-over'; tx.clearRect(0, 0, W, H); tx.drawImage(x.canvas, 0, 0);
    const n = 6; for (let i = 0; i < n; i++) { const y = Math.random() * H, h = H * (0.01 + Math.random() * 0.05), d = (Math.random() - 0.5) * W * 0.06 * T.glitch; x.drawImage(tc, 0, y, W, h, d, y, W, h); }
    x.globalCompositeOperation = 'screen'; x.globalAlpha = 0.35 * T.glitch; x.drawImage(tc, 6 * T.glitch, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
    T.glitch *= 0.7;
  }
  // grain
  if (T.grain) { x.globalCompositeOperation = 'overlay'; x.globalAlpha = 0.09; const p = x.createPattern(T.grain, 'repeat'); if (p) { x.save(); x.translate(Math.random() * 256, Math.random() * 256); x.fillStyle = p; x.fillRect(-256, -256, W + 512, H + 512); x.restore(); } x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; }
  // letterbox, for the wide screen of a film
  const bar = Math.max(0, Math.min(H * 0.075, (H - W / 2.39) / 2));
  if (bar > 1) { x.fillStyle = '#000'; x.fillRect(0, 0, W, bar); x.fillRect(0, H - bar, W, bar); }
}

/** The caption at the bottom right for a wide shot: a small line, then the big one, typed in. */
function titleCaption(sh: TsShot) {
  const T = TitleScreen, el = T.root && T.root.querySelector('.ts-cap') as HTMLElement; if (!el) return;
  if (!sh.cap) { el.classList.remove('on'); return; }
  el.classList.remove('on'); void el.offsetWidth;
  (el.querySelector('small') as HTMLElement).textContent = sh.cap[0]; (el.querySelector('b') as HTMLElement).textContent = sh.cap[1];
  el.classList.add('on');
}

/* ---------- the menu ---------- */
function titleKey(e: KeyboardEvent) {
  const T = TitleScreen; if (!T.on || _layers.length) return;
  if (typeof MM !== 'undefined' && MM.on) { if (e.key === 'Escape') { e.preventDefault(); if (MM.prev) ACTIONS['mm-preview-close'](null as any, null as any); else if (MM.sel) { MM.sel = ''; mmRender(); } else ACTIONS['mm-close'](null as any, null as any); } return; }
  const btns = Array.from(T.root.querySelectorAll('.ts-nav .ts-btn')) as HTMLElement[]; if (!btns.length) return;
  const cur = btns.indexOf(document.activeElement as HTMLElement);
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const n = cur < 0 ? 0 : (cur + (e.key === 'ArrowDown' ? 1 : btns.length - 1)) % btns.length; btns[n].focus(); Sound.tick(); }
  else if (e.key === 'Escape' && T.panel) { e.preventDefault(); titlePanel(''); }
}
function titleGo(then: () => void) { Sound.tick(); titleClose(then); }
ACTIONS['ts-test'] = () => { Sound.tick(); titleClose(() => { try { TestRooms.open(); } catch (e) { toast('The test rooms could not open', 'info'); } }); };
ACTIONS['ts-continue'] = () => { Sound.tick(); enterSplash(); titleClose(() => { /* back into the game, where you were */ }); };
/** Continue: a loading screen (at least 5 seconds) while the game opens behind it, saying what is loading; when the
 *  loading takes longer, the bar follows it and the screen stays until everything is ready. */
function enterSplash() {
  const c: any = company(), W: any = World;
  exitSplash('enter', c ? `Opening ${c.name}` : 'Opening your airline', [
    { pct: 18, step: 'Loading your airline…', run: () => { /* already in memory */ } },
    { pct: 36, step: 'Loading the world\'s airports…', run: () => { try { W.load(); } catch (e) { /* loading */ } }, wait: () => !!W.ready },
    { pct: 50, step: 'Loading the runways…', run: () => { try { W.loadRunways(); } catch (e) { /* later */ } }, wait: () => !!W.runways },
    { pct: 62, step: 'Loading the aircraft and models…', run: () => { try { Models.init(); } catch (e) { /* none */ } }, wait: () => !!Models.list },
    { pct: 74, step: 'Loading the people…', run: () => { try { Human.load(); } catch (e) { /* later */ } }, wait: () => Human.ready },
    { pct: 88, step: 'Catching up on everything that happened while you were away…', run: () => { try { refresh(); } catch (e) { /* drawn next */ } } },
    { pct: 100, step: 'Opening the Overview…', run: () => { /* the screen behind is ready */ } },
  ], undefined, 5000);
}
ACTIONS['ts-demo'] = () => titleGo(() => { try { const S: any = State; S.settings.tourDone = S.settings.tourDone || false; ACTIONS['fs-demo'](null as any, null as any); } catch (e) { /* ignore */ } });
ACTIONS['ts-options'] = () => { titlePanel(''); ACTIONS.settings(null as any, null as any); };
ACTIONS['ts-quit'] = () => { titlePanel(''); ACTIONS.exit(null as any, null as any); };
ACTIONS['ts-new'] = () => {
  Sound.tick();
  titlePanel('new', `<div class="ts-ph"><h2>Start a new game?</h2><button class="ts-x" data-act="ts-panel-close" aria-label="Close">${icon('close')}</button></div>
    <p class="ts-p">${Store.wasEmpty ? 'The demo airlines are removed and everything starts from nothing' : 'Everything is erased and starts from nothing'}: your pilot, companies, aircraft, staff, routes, flights, money, loans, logbook, news, markets and history. Only your settings are kept. ${Store.wasEmpty ? '' : 'Save the game in a slot first if you want to come back to it.'}</p>
    <p class="ts-p">Next: create your pilot and choose the difficulty, then found your airline.</p>
    <div class="ts-row"><button class="ts-pb hot" data-act="ts-new-go">${icon('plus')}Yes, start a new game</button><button class="ts-pb" data-act="ts-save">${icon('check')}Save first</button><button class="ts-pb" data-act="ts-panel-close">No</button></div>`);
};
ACTIONS['ts-new-go'] = () => { Sound.tick(); titleNewGame(); };
ACTIONS['ts-panel-close'] = () => { Sound.tick(); titlePanel(''); };
/** A new game: create your pilot (and choose the difficulty), then found your airline; only then is everything
 *  erased and the game starts again from nothing. Cancel on the way and you are back on the start screen as before. */
function titleNewGame() {
  titlePanel('');
  const me: any = myPilot(), look = defaultLook((me && me.sex) || 'm', 'captain');
  (window as any).__ngPilot = null;
  openLookEditor({ title: 'Create your pilot', role: 'captain', look, identity: { name: 'Capt. New Pilot', dob: '1990-06-15', nat: (me && me.nat) || 'FO' }, difficulty: true,
    onAccept: (lk, idt) => {
      (window as any).__ngPilot = { look: lk, sex: lk.sex, name: (idt && idt.name) || 'Capt. New Pilot', dob: idt && idt.dob, nat: idt && idt.nat };
      setTimeout(() => {
        _tsInput = performance.now();   // the next step of what you are doing, not a message from the game
        ACTIONS['fs-scratch'](null as any, null as any);
        const n = $('.fs-pilot') as HTMLInputElement; if (n) { n.value = (window as any).__ngPilot.name; const f = n.closest('.field') as HTMLElement; if (f) f.style.display = 'none'; }
        const d = $('.fs-modal .fs-diff') as HTMLElement; if (d) d.remove();   // chosen with the pilot
        const h = $('.fs-modal h2'), w = $('.fs-modal .fine-print'), b = $('.fs-modal [data-act=fs-wipe]');
        if (h) h.textContent = 'Found your airline';
        if (w) w.innerHTML = `${icon('alert')}Starting erases everything that is there now and begins from nothing, at ${esc(DIFFICULTY[_fsDiff].name)} difficulty. Your settings are kept.`;
        if (b) b.innerHTML = `${icon('play')}Start the new game`;
      }, 350);
    } });
}

/** The panel on the right: saving, loading, or a question. */
function titlePanel(kind: string, html?: string) {
  const T = TitleScreen, p = T.root && T.root.querySelector('.ts-panel') as HTMLElement; if (!p) return;
  T.panel = kind;
  T.root.querySelectorAll('.ts-btn').forEach((b: any) => b.classList.toggle('on', (kind === 'save' && b.getAttribute('data-act') === 'ts-save') || (kind === 'load' && b.getAttribute('data-act') === 'ts-load') || (kind === 'new' && b.getAttribute('data-act') === 'ts-new')));
  if (!kind) { p.classList.remove('in'); setTimeout(() => { if (!T.panel) p.hidden = true; }, 300); return; }
  p.innerHTML = html || ''; p.hidden = false; void p.offsetWidth; p.classList.add('in');
}
ACTIONS['ts-save'] = () => { Sound.tick(); try { saveNow(true); } catch (e) { /* ignore */ } titleSlots('save'); };
ACTIONS['ts-load'] = () => { Sound.tick(); titleSlots('load'); };
function titleSlots(mode: 'save' | 'load') {
  const M = GameSaves.meta();
  const row = (i: number) => {
    const m = M[i - 1];
    if (!m) return `<button class="ts-slot vacant" data-act="${mode === 'save' ? 'ts-slot-save' : 'ts-none'}" data-i="${i}" ${mode === 'load' ? 'disabled' : ''}><span class="ts-sn">${String(i).padStart(2, '0')}</span><span class="ts-si"><b>Empty slot</b><small>${mode === 'save' ? 'Save here' : 'Nothing saved yet'}</small></span></button>`;
    const d = new Date(m.at);
    return `<div class="ts-slot" data-i="${i}"><button class="ts-sb" data-act="${mode === 'save' ? 'ts-slot-save' : 'ts-slot-load'}" data-i="${i}"><span class="ts-sn">${String(i).padStart(2, '0')}</span><span class="ts-si"><b>${esc(m.airline || 'Airline')}</b><small>${esc(m.pilot || '')}${m.pilot ? ' · ' : ''}${esc(dateStr(d).slice(0, 10))} ${esc(d.toTimeString().slice(0, 5))}</small><small>${esc(money(m.balance || 0, { compact: true }))} · ${m.fleet || 0} aircraft${m.flying ? ` · ${m.flying} flying` : ''}</small></span></button><button class="ts-del" data-act="ts-slot-del" data-i="${i}" aria-label="Delete save ${i}">${icon('trash')}</button></div>`;
  };
  const auto = mode === 'load' ? SaveSlots.meta().at.map((at: number, i: number) => ({ at, i: i + 1 })).filter((r: any) => r.at).sort((a: any, b: any) => b.at - a.at) : [];
  titlePanel(mode, `<div class="ts-ph"><h2>${mode === 'save' ? 'Save game' : 'Load game'}</h2><button class="ts-x" data-act="ts-panel-close" aria-label="Close">${icon('close')}</button></div>
    <p class="ts-p">${mode === 'save' ? 'Pick a slot. The whole airline is saved: money, staff, every aircraft, where each one is in the air or on the ground, the markets and the other airlines.' : 'Pick a save. Everything goes back to that moment: money, staff, the aircraft (in the air where they were), the markets and the other airlines.'}</p>
    ${mode === 'load' && typeof autosaveMeta === 'function' && autosaveMeta() ? (() => { const a = autosaveMeta(), d = new Date(a.at); return `<div class="ts-slots"><div class="ts-slot"><button class="ts-sb" data-act="ts-auto-game"><span class="ts-sn">${icon('clock')}</span><span class="ts-si"><b>Autosave · ${esc(a.airline || 'Airline')}</b><small>${esc(a.pilot || '')}${a.pilot ? ' · ' : ''}${esc(dateStr(d).slice(0, 10))} ${esc(d.toTimeString().slice(0, 5))}</small></span></button></div></div>`; })() : ''}
    <div class="ts-slots">${Array.from({ length: GameSaves.N }, (_, i) => row(i + 1)).join('')}</div>
    ${mode === 'save' ? `<div class="ts-danger"><label class="ts-tick"><input type="checkbox" data-ts-delbk><span></span>Also delete the automatic backups</label><button class="ts-pb danger" data-act="ts-delall">${icon('trash')}Delete all saves</button></div>` : ''}
    ${mode === 'load' ? `<h3 class="ts-h3">Automatic backups</h3><div class="ts-slots auto">${auto.length ? auto.map((r: any) => `<button class="ts-slot" data-act="ts-auto-load" data-i="${r.i}"><span class="ts-sn">A${r.i}</span><span class="ts-si"><b>Backup ${r.i}</b><small>${esc(dateStr(new Date(r.at)).slice(0, 10))} ${esc(new Date(r.at).toTimeString().slice(0, 5))}</small></span></button>`).join('') : '<small class="ts-p">None yet.</small>'}</div>
      <div class="ts-row"><button class="ts-pb" data-act="backup-import">${icon('download')}Open a backup file</button></div>` : ''}`);
}
ACTIONS['ts-none'] = () => { /* empty */ };
ACTIONS['ts-slot-save'] = el => {
  const i = +(el.getAttribute('data-i') || 0); if (!i) return;
  const has = GameSaves.meta()[i - 1];
  const go = () => { GameSaves.save(i).then(() => { try { setLastSlot(i); } catch (e) { /* ignore */ } Haptics.success(); Sound.chime(); toast(`Saved in slot ${i}`, 'ok'); titleSlots('save'); }).catch(() => toast('The save couldn\'t be written', 'warn')); };
  if (!has) { go(); return; }
  titleAsk(el, `Overwrite slot ${i}?`, 'Overwrite', go);
};
ACTIONS['ts-slot-load'] = el => {
  const i = +(el.getAttribute('data-i') || 0); if (!i) return;
  const m = GameSaves.meta()[i - 1]; if (!m) return; Sound.tick();
  const d = new Date(m.at);
  titlePanel('load', `<div class="ts-ph"><h2>Load this save?</h2><button class="ts-x" data-act="ts-load" aria-label="Back">${icon('close')}</button></div>
    <div class="ts-slot ts-sel"><span class="ts-sb"><span class="ts-sn">${String(i).padStart(2, '0')}</span><span class="ts-si"><b>${esc(m.airline || 'Airline')}</b><small>${esc(m.pilot || '')}${m.pilot ? ' · ' : ''}${esc(dateStr(d).slice(0, 10))} ${esc(d.toTimeString().slice(0, 5))}</small><small>${esc(money(m.balance || 0, { compact: true }))} · ${m.fleet || 0} aircraft${m.flying ? ` · ${m.flying} flying` : ''}</small></span></span></div>
    <p class="ts-p">Are you sure you want to load this save game? The game goes back to that moment, and everything since then that isn't saved in a slot is replaced.</p>
    <div class="ts-row"><button class="ts-pb hot" data-act="ts-load-go" data-i="${i}">${icon('download')}Yes, load it</button><button class="ts-pb" data-act="ts-load">No</button></div>`);
};
ACTIONS['ts-load-go'] = el => { const i = +(el.getAttribute('data-i') || 0); if (i) { Sound.tick(); try { setLastSlot(i); } catch (e) { /* ignore */ } GameSaves.load(i); } };
ACTIONS['ts-auto-load'] = el => {
  const i = +(el.getAttribute('data-i') || 0); if (!i) return;
  titleAsk(el, 'Are you sure you want to load this backup?', 'Load', () => { SaveSlots.read(i).then((t: string) => { if (!t) { toast('That backup save could not be read', 'warn'); return; } GameSaves.restoreText(t); }).catch(() => toast('That backup save could not be read', 'warn')); });
};
ACTIONS['ts-slot-del'] = el => {
  const i = +(el.getAttribute('data-i') || 0); if (!i) return;
  titleAsk(el, `Delete save ${i}?`, 'Delete', () => { GameSaves.remove(i).then(() => { toast(`Save ${i} deleted`, 'info'); titleSlots(TitleScreen.panel === 'load' ? 'load' : 'save'); }); });
};
/** A small yes/no right on the slot. */
function titleAsk(el: HTMLElement, q: string, yes: string, ok: () => void) {
  const slot = (el.closest('.ts-slot') || el) as HTMLElement; const old = slot.querySelector('.ts-ask'); if (old) { old.remove(); return; }
  const a = document.createElement('div'); a.className = 'ts-ask'; a.innerHTML = `<span>${esc(q)}</span><button class="ts-pb hot">${esc(yes)}</button><button class="ts-pb">No</button>`;
  const [y, n] = Array.from(a.querySelectorAll('button')) as HTMLElement[];
  y.addEventListener('click', e => { e.stopPropagation(); a.remove(); ok(); }); n.addEventListener('click', e => { e.stopPropagation(); a.remove(); });
  slot.appendChild(a); Sound.tick();
}

// Back to the start screen from the game: ACTIONS['title-open'] in quit-save.ts (asks first, then offers to save)

/* ---------- deleting every save ---------- */
ACTIONS['ts-delall'] = () => {
  const bk = !!(document.querySelector('[data-ts-delbk]') as HTMLInputElement || {} as any).checked; Sound.tick();
  if (bk) {
    titlePanel('save', `<div class="ts-ph"><h2>Delete the backups too?</h2><button class="ts-x" data-act="ts-save" aria-label="Back">${icon('close')}</button></div>
      <p class="ts-p">Are you sure you want to delete the automatic backups as well? Your game and all your saves are deleted too, and nothing is left to go back to.</p>
      <div class="ts-row"><button class="ts-pb danger" data-act="ts-delhold" data-bk="1">${icon('trash')}Yes, delete everything</button><button class="ts-pb" data-act="ts-save">No</button></div>`);
    return;
  }
  ACTIONS['ts-delhold'](document.createElement('b'), null as any);
};
/** The hold-to-delete button: hold it for ten seconds (let go and nothing happens), so it never happens by mistake. */
ACTIONS['ts-delhold'] = el => {
  const bk = el && el.getAttribute && el.getAttribute('data-bk') === '1', r = 56, c = (2 * Math.PI * r).toFixed(1);
  titlePanel('save', `<div class="ts-ph"><h2>Delete ${bk ? 'everything' : 'all saves'}</h2><button class="ts-x" data-act="ts-save" aria-label="Back">${icon('close')}</button></div>
    <p class="ts-p">${bk ? 'Your game, all 20 saves and the automatic backups are deleted.' : 'Your game and all 20 saves are deleted. The automatic backups are kept: you can load one of them, or start a new game.'} Hold the button for ten seconds: let go and nothing is deleted.</p>
    <div class="ts-holdw"><button class="ts-hold" data-ts-hold aria-label="Hold to delete"><svg viewBox="0 0 124 124" aria-hidden="true"><circle cx="62" cy="62" r="${r}" class="th-track"/><circle cx="62" cy="62" r="${r}" class="th-fill" stroke-dasharray="${c}" stroke-dashoffset="${c}" data-c="${c}"/></svg><span class="th-core">${icon('trash')}</span></button><small data-ts-hint>Press and hold</small></div>
    <div class="ts-row"><button class="ts-pb" data-act="ts-save">Cancel</button></div>`);
  const btn = TitleScreen.root.querySelector('[data-ts-hold]') as HTMLElement, fill = btn.querySelector('.th-fill') as SVGElement, hint = TitleScreen.root.querySelector('[data-ts-hint]') as HTMLElement, C = parseFloat(fill.getAttribute('data-c'));
  let raf = 0, t0 = 0, last = 0;
  const stop = () => { if (!raf) return; cancelAnimationFrame(raf); raf = 0; btn.classList.remove('holding'); btn.style.setProperty('--k', '0'); fill.setAttribute('stroke-dashoffset', String(C)); hint.textContent = 'Press and hold'; };
  const step = (now: number) => {
    const k = Math.min(1, (now - t0) / 10000); fill.setAttribute('stroke-dashoffset', (C * (1 - k)).toFixed(1)); btn.style.setProperty('--k', k.toFixed(3));
    const s = Math.ceil(10 - k * 10); hint.textContent = k < 1 ? `Keep holding… ${s}` : 'Deleting…';
    if (Math.floor(k * 10) > last) { last = Math.floor(k * 10); Haptics.pulse(8 + last * 2); }
    if (k >= 1) { raf = 0; btn.classList.add('done'); Haptics.success(); setTimeout(() => titleDeleteAll(bk), 500); return; }
    raf = requestAnimationFrame(step);
  };
  btn.addEventListener('pointerdown', e => { e.preventDefault(); stop(); t0 = performance.now(); last = 0; btn.classList.add('holding'); raf = requestAnimationFrame(step); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(k => btn.addEventListener(k, stop));
  btn.addEventListener('keydown', (e: KeyboardEvent) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat && !raf) { e.preventDefault(); t0 = performance.now(); last = 0; btn.classList.add('holding'); raf = requestAnimationFrame(step); } });
  btn.addEventListener('keyup', stop); btn.addEventListener('contextmenu', e => e.preventDefault());
};
/** Delete the game and every save (and the automatic backups too, when asked); then the start screen again, with only
 *  New game and Load game. Nothing is saved until one of them is used. */
function titleDeleteAll(withBackups: boolean) {
  try { localStorage.setItem('amp-nogame', '1'); } catch (e) { /* ignore */ }
  try { (Mode as any).switching = true; clearTimeout((Store as any)._nativeTimer); (Store as any)._native = ''; } catch (e) { /* ignore */ }
  const jobs: Promise<any>[] = [];
  try { localStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ }
  const T = Store.native();
  if (T && T.backupWrite) jobs.push(T.backupWrite({ data: '' }).catch(() => { /* gone */ }));   // the phone's own copy of the game
  for (let i = 1; i <= GameSaves.N; i++) jobs.push(GameSaves.write(i, '').catch(() => { /* gone */ }));
  try { localStorage.removeItem('amp.gameSaves'); } catch (e) { /* ignore */ }
  if (withBackups) {
    for (let i = 1; i <= 5; i++) {
      if (T && T.backupWrite) jobs.push(T.backupWrite({ data: '', name: `save-${i}.json` }).catch(() => { /* gone */ }));
      else if (DESKTOP) jobs.push(fetch('/api/saves?slot=' + i, { method: 'DELETE' }).catch(() => { /* gone */ }));
      else { try { localStorage.removeItem('amp.save.' + i); } catch (e) { /* ignore */ } }
    }
    try { localStorage.removeItem('amp.saveSlots'); } catch (e) { /* ignore */ }
  }
  try { localStorage.removeItem('amp-resume'); localStorage.removeItem('amp-ui'); } catch (e) { /* ignore */ }
  Promise.all(jobs).then(() => {
    toast(withBackups ? 'Everything is deleted' : 'All saves are deleted. The backups are kept.', 'info');
    setTimeout(() => location.reload(), 900);
  });
}

/* ---------- twenty saves ---------- */
// Each save is the whole airline as it was at that moment. On the phone, files in the app's own storage; on the PC,
// Documents\Airline Manager Pro\saves\game-1 … game-20.json; in a browser, its own database. A list of what is in
// each slot is kept besides, so the menu shows them at once.
const GameSaves = {
  N: 20,
  meta(): any[] { try { const m = JSON.parse(localStorage.getItem('amp.gameSaves') || 'null'); if (Array.isArray(m)) { while (m.length < this.N) m.push(null); return m; } } catch (e) { /* none */ } return Array(this.N).fill(null); },
  setMeta(i: number, m: any) { const all = this.meta(); all[i - 1] = m; try { localStorage.setItem('amp.gameSaves', JSON.stringify(all)); } catch (e) { /* ignore */ } },
  db(): Promise<IDBDatabase> { return new Promise((ok, no) => { const r = indexedDB.open('amp-saves', 1); r.onupgradeneeded = () => r.result.createObjectStore('s'); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); }); },
  write(i: number, data: string): Promise<void> {
    const T = Store.native(), name = `game-${i}.json`;
    if (T && T.backupWrite) return T.backupWrite({ data, name });
    if (DESKTOP) return fetch('/api/saves?slot=g' + i, { method: data ? 'PUT' : 'DELETE', body: data || undefined }).then(r => { if (!r.ok) throw new Error('save'); });
    return this.db().then(db => new Promise<void>((ok, no) => { const tx = db.transaction('s', 'readwrite'); if (data) tx.objectStore('s').put(data, name); else tx.objectStore('s').delete(name); tx.oncomplete = () => ok(); tx.onerror = () => no(tx.error); }));
  },
  read(i: number): Promise<string> {
    const T = Store.native(), name = `game-${i}.json`;
    if (T && T.backupRead) return T.backupRead({ name }).then((r: any) => (r && r.data) || '');
    if (DESKTOP) return fetch('/api/saves?slot=g' + i).then(r => r.json()).then((j: any) => j.data || '');
    return this.db().then(db => new Promise<string>((ok, no) => { const q = db.transaction('s').objectStore('s').get(name); q.onsuccess = () => ok(q.result || ''); q.onerror = () => no(q.error); }));
  },
  /** Save the airline as it is now into a slot. */
  save(i: number): Promise<void> {
    try { Store.save(); } catch (e) { /* storage */ }
    const json = Backup.snapshot(); if (!json) return Promise.reject(new Error('nothing'));
    const co: any = company(), me: any = myPilot();
    return this.write(i, json).then(() => this.setMeta(i, { at: Date.now(), airline: co && co.name, icao: co && co.icao, balance: co && co.balance, pilot: me && me.name,
      fleet: State.fleet.filter((a: any) => !co || a.companyId === co.id).length, flying: State.live.filter((f: any) => !f.ai).length, ver: APP.version }));
  },
  remove(i: number): Promise<void> { return this.write(i, '').catch(() => { /* gone anyway */ }).then(() => this.setMeta(i, null)); },
  load(i: number) { this.read(i).then(t => { if (!t) { toast('That save could not be read', 'warn'); return; } this.restoreText(t); }).catch(() => toast('That save could not be read', 'warn')); },
  /** Back to the moment of a save: every clock in it moves on to now, so aircraft are where they were, mid-flight
   *  or on the ground, and nothing has happened while the save sat in its slot. Then into the office. */
  restoreText(text: string) {
    let d: any = null; try { d = JSON.parse(text); } catch (e) { /* not a save */ }
    if (!d || !d.state) { toast('That isn\'t an Airline Manager Pro save', 'warn'); return; }
    const at = +d.savedAt || 0, now = Date.now(), dt = at ? now - at : 0;
    if (dt > 0) {
      const lo = at - 20 * 365 * 864e5, hi = at + 3 * 365 * 864e5;
      const walk = (o: any) => { if (!o || typeof o !== 'object') return; for (const k in o) { const v = o[k]; if (typeof v === 'number') { if (v > 1e12 && v > lo && v < hi) o[k] = v + dt; } else if (v && typeof v === 'object') walk(v); } };
      walk(d.state); d.savedAt = now;
    }
    try { sessionStorage.setItem('amp-title-next', 'game'); } catch (e) { /* ignore */ }
    Backup.restore(JSON.stringify(d));
  },
};

/* ---------- quiet on the start screen ---------- */
// While the start screen is up, the game keeps running underneath, but nothing of it shows or sounds: no messages,
// no pop-ups, no badges, no voices and no sounds; only the soundtrack and the film (the phone's own notifications
// still arrive in its notification shade). What you open yourself (Options, Quit, a new game) still works, with its
// clicks; pop-ups the game wanted to show wait until you leave the start screen.
let _tsInput = 0;
document.addEventListener('pointerdown', () => { _tsInput = performance.now(); }, true);
document.addEventListener('keydown', () => { _tsInput = performance.now(); }, true);
/** True while the start screen is up and you haven't just done something yourself. */
function titleQuiet(): boolean { return !!TitleScreen.on && performance.now() - _tsInput > 1500; }
(function titleHush() {
  const W: any = window;
  const t0 = W.toast; if (typeof t0 === 'function') W.toast = function (...a: any[]) { if (titleQuiet()) return; return t0.apply(this, a); };
  const o0 = W.openLayer;
  if (typeof o0 === 'function') W.openLayer = function (kind: any, html: any, opts?: any) {
    if (!titleQuiet()) return o0.call(this, kind, html, opts);
    titleDefer(() => o0.call(this, kind, html, opts));
    const d = document.createElement('div'); d.innerHTML = `<div class="panel">${html}</div>`; return d;   // not shown now
  };
  const b0 = W.badgeReveal; if (typeof b0 === 'function') W.badgeReveal = function (list: any) { if (titleQuiet()) { titleDefer(() => b0(list)); return; } return b0(list); };
  const S: any = Sound; for (const k of Object.keys(S)) { const f = S[k]; if (typeof f === 'function') S[k] = function (...a: any[]) { if (titleQuiet()) return; return f.apply(S, a); }; }
  const V: any = Voice, sp = V.speak; if (typeof sp === 'function') V.speak = function (text: string, onEnd?: () => void, who?: string) { if (titleQuiet()) { if (onEnd) onEnd(); return false; } return sp.call(V, text, onEnd, who); };
})();
