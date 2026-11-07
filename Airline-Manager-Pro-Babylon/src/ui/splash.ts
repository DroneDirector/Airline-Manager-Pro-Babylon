// The start screen of the Babylon.js edition: the same film as the main game's (the stand, the pushback, the flight
// deck, above the clouds at sunset and the operations desk), cut to the music, the same logo and look; no menus yet,
// only the way into the lounge. The film is drawn on its own canvas over the 3D view.
import { pendingIssues, issuesText } from '../core/errlog';
import { S, saveSettings } from '../core/settings';
import { APP, IS_PC } from '../core/app';
import { icon, esc } from './icons';

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
  on: false, root: null as any, cv: null as any, cx: null as any, raf: 0, img: {} as any, blur: {} as any, ready: false,
  audio: null as any, env: null as any, kick: null as any, clock0: 0, lastShot: -1, flash: 0, glitch: 0, grain: null as any, tmp: null as any,
};
let _enter: ((id: string) => void) | null = null, _pick = 'game:continue';
/** Open the start screen; enter(id) runs when you choose a place: the 3D viewer (a flight above the clouds) or the lounge. */
export function splashOpen(enter: (id: string) => void) {
  const T = TitleScreen; if (T.on) return; T.on = true; _enter = enter; _pick = 'game:continue';
  const r = document.createElement('div'); r.className = 'ts'; r.setAttribute('aria-label', 'Start screen');
  r.innerHTML = `<canvas class="ts-cv" aria-hidden="true"></canvas><div class="ts-fx" aria-hidden="true"></div>
    <div class="ts-left">
      <div class="ts-logo" aria-label="${esc(APP.name)}"><span class="ts-l1">Airport</span><span class="ts-l2">Dynasty</span><span class="ts-l3">Pro</span></div>
      <div class="ts-engine">Babylon.js edition · a first look</div>
      <nav class="ts-nav">${[
        ['game:continue', 'play', 'Continue game', 'Back to your airline, at the Overview'],
        ['game:new', 'plus', 'New game', 'Create your pilot and found your airline'],
        ['game:load', 'folder', 'Load game', 'Pick a saved game or a backup'],
        ['game:save', 'save', 'Save game', 'Save your airline in a slot'],
        ['game:ui', 'grid', 'UI', 'Straight into the game\'s menus and screens'],
      ].map(([id, ic, t, s], i) => `<button class="ts-btn ${i === 0 ? 'on' : ''}" data-a="enter" data-id="${id}"><span class="ts-bi">${icon(ic)}</span><span class="ts-bt"><b>${t}</b><small>${s}</small></span><i class="ts-sheen"></i></button>`).join('')}
        <div class="ts-demos"><small>Demos</small>${[['viewer3d', 'plane', '3D viewer'], ['lounge', 'star', 'Lounge'], ...(IS_PC ? [['terminal', 'terminal', 'Terminal'], ['site', 'mountain', 'Airport site']] : [])].map(([id, ic, t]) => `<button class="ts-btn ts-demo" data-a="enter" data-id="${id}"><span class="ts-bi">${icon(ic)}</span><span class="ts-bt"><b>${t}</b></span><i class="ts-sheen"></i></button>`).join('')}</div></nav>
    </div>
    <div class="ts-cap" aria-hidden="true"><small></small><b></b></div>
    <small class="ts-ver">v${esc(APP.version)} · Babylon.js ${esc(APP.babylon)}</small>
    <button class="ts-mute ${S.music ? '' : 'off'}" data-a="mute" aria-label="Music on or off"><span class="ts-eq"><i></i><i></i><i></i><i></i></span><span class="ts-ml">${S.music ? 'Music on' : 'Music off'}</span></button>
    <div class="ts-tap" hidden>Tap anywhere for sound</div>`;
  (document.getElementById('ui') as HTMLElement).appendChild(r); T.root = r;
  r.addEventListener('click', (e: Event) => { const b = (e.target as HTMLElement).closest('[data-a]') as HTMLElement; if (!b) return; const a = b.getAttribute('data-a'); if (a === 'enter') { _pick = b.getAttribute('data-id') || 'game:continue'; splashEnter(); } else if (a === 'mute') splashMute(); });
  T.cv = r.querySelector('.ts-cv'); T.cx = T.cv.getContext('2d');
  T.fit = () => { const w = r.clientWidth, h = r.clientHeight, k = Math.min(1.5, window.devicePixelRatio || 1, 2200 / Math.max(1, w)); T.cv.width = Math.round(w * k); T.cv.height = Math.round(h * k); };
  T.fit(); window.addEventListener('resize', T.fit);
  load(); music();
  requestAnimationFrame(() => r.classList.add('in'));
  T.clock0 = performance.now(); T.lastShot = -1;
  const loop = () => { if (!T.on) return; T.raf = requestAnimationFrame(loop); if (!document.hidden) titleFrame(); };
  T.raf = requestAnimationFrame(loop);
  setTimeout(issueReport, 900);   // problems since last time, like a crash screen
}
export function splashIsOpen(): boolean { return !!TitleScreen.on; }
/** Up and down (keys, D-pad) move between the start screen's choices. */
export function splashNav(dir: number) {
  const T = TitleScreen; if (!T.on || !T.root) return; const bs = Array.from(T.root.querySelectorAll('.ts-btn')) as HTMLElement[]; if (!bs.length) return;
  let i = bs.findIndex(b => b.classList.contains('on')); i = (i + dir + bs.length) % bs.length;
  bs.forEach((b, k) => b.classList.toggle('on', k === i)); _pick = bs[i].getAttribute('data-id') || 'game:continue';
}
/** Into the lounge: the music fades, the picture goes dark. */
export function splashEnter() {
  const T = TitleScreen; if (!T.on || T.closing) return; T.closing = true;
  const r = T.root, a = T.audio; r.classList.add('out');
  if (a) { const v0 = a.volume, t0 = performance.now(); const fade = () => { const k = Math.min(1, (performance.now() - t0) / 1100); a.volume = v0 * (1 - k); if (k < 1) requestAnimationFrame(fade); else { a.pause(); a.src = ''; } }; fade(); }
  setTimeout(() => { T.on = false; T.closing = false; cancelAnimationFrame(T.raf); window.removeEventListener('resize', T.fit); r.remove(); T.audio = null; T.img = {}; T.blur = {}; T.ready = false; const f = _enter; _enter = null; if (f) f(_pick); }, 850);
}
function splashMute() {
  const T = TitleScreen; S.music = !S.music; saveSettings('music');
  if (T.audio) { T.audio.muted = !S.music; if (S.music) T.audio.play().catch(() => { /* later */ }); }
  const b = T.root && T.root.querySelector('.ts-mute'); if (b) { b.classList.toggle('off', !S.music); const l = b.querySelector('.ts-ml'); if (l) l.textContent = S.music ? 'Music on' : 'Music off'; }
}
function load() {
  const T = TitleScreen, base = 'assets/title/', list: [string, string][] = [['t1', 't1.webp'], ['t2', 't2.webp'], ['t3o', 't3o.webp'], ['t3i', 't3i.webp'], ['t4b', 't4b.webp'], ['t4a', 't4a.webp'], ['t5', 't5.webp']];
  let left = list.length;
  for (const [k, f] of list) { const im = new Image(); im.decoding = 'async'; im.onload = () => { T.img[k] = im; T.blur[k] = titleBlurOf(im); if (--left === 0) T.ready = true; }; im.onerror = () => { if (--left === 0) T.ready = true; }; im.src = base + f; }
  fetch(base + 'env.json').then(r => r.json()).then(j => { const d = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0)); T.env = d(j.e); T.kick = d(j.k); }).catch(() => { /* lit evenly */ });
  const g = document.createElement('canvas'); g.width = g.height = 256; const x = g.getContext('2d') as CanvasRenderingContext2D, d = x.createImageData(256, 256);
  for (let i = 0; i < d.data.length; i += 4) { const v = 128 + (Math.random() - 0.5) * 120; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  x.putImageData(d, 0, 0); T.grain = g; T.tmp = document.createElement('canvas');
}
function music() {
  const T = TitleScreen, a = new Audio('assets/title/title.mp3'); a.preload = 'auto'; a.volume = 0.85; T.audio = a; a.muted = !S.music;
  a.addEventListener('ended', () => { if (!T.on) return; T.flash = 1; a.currentTime = 0; a.play().catch(() => { /* waits for a tap */ }); });
  a.play().catch(() => {
    a.muted = true; a.play().catch(() => { /* the film keeps its own clock */ });
    if (S.music) { const tap = T.root && T.root.querySelector('.ts-tap'); if (tap) tap.hidden = false; }
    const un = () => { document.removeEventListener('pointerdown', un, true); document.removeEventListener('keydown', un, true); const tp = T.root && T.root.querySelector('.ts-tap'); if (tp) tp.hidden = true; if (T.audio === a) { a.muted = !S.music; a.play().catch(() => { /* still not */ }); } };
    document.addEventListener('pointerdown', un, true); document.addEventListener('keydown', un, true);
  });
}

/** A soft copy of a picture, for what is out of focus. */
function titleBlurOf(im: HTMLImageElement): HTMLCanvasElement {
  const c = document.createElement('canvas'), w = Math.max(8, Math.round(im.width / 10)), h = Math.max(8, Math.round(im.height / 10)); c.width = w; c.height = h;
  const x = c.getContext('2d') as CanvasRenderingContext2D; x.imageSmoothingQuality = 'high'; x.drawImage(im, 0, 0, w, h);
  const c2 = document.createElement('canvas'); c2.width = Math.round(im.width / 2); c2.height = Math.round(im.height / 2);
  const x2 = c2.getContext('2d') as CanvasRenderingContext2D; x2.imageSmoothingQuality = 'high'; x2.drawImage(c, 0, 0, c2.width, c2.height); return c2;
}

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

/** The report of what could not be combined (instancing, texture arrays) since last time: Copy, Share, OK. */
function issueReport() {
  const list = pendingIssues(); if (!list.length || document.querySelector('.ir-wrap')) return;
  const w = document.createElement('div'); w.className = 'ds-wrap ir-wrap';
  w.innerHTML = `<div class="ds-card" role="dialog" aria-label="Problem report"><div class="ds-head"><b>Something was not right last time</b><span class="ds-q low">${list.length}</span></div>
    <div class="ds-body"><p class="ir-note">These parts were drawn the usual way instead (nothing is missing). Copy or share the report to send it.</p>
    <div class="ir-list">${list.slice(-30).reverse().map(i => `<div><small>${esc(new Date(i.at).toLocaleString())} · ${esc(i.place)}</small><b>${esc(i.what)}</b><span>${esc(i.why)}</span></div>`).join('')}</div></div>
    <div class="ds-foot"><button class="ds-no" data-ir="copy">Copy</button><button class="ds-no" data-ir="share">Share</button><button class="ds-yes" data-ir="ok">OK</button></div></div>`;
  document.body.appendChild(w); requestAnimationFrame(() => w.classList.add('in'));
  const text = 'Airport Dynasty Pro ' + APP.version + ' · problem report\n\n' + issuesText(list);
  w.addEventListener('click', async e => { const b = (e.target as HTMLElement).closest('[data-ir]') as HTMLElement; if (!b) return; const a = b.getAttribute('data-ir');
    if (a === 'copy') { try { await navigator.clipboard.writeText(text); b.textContent = 'Copied'; } catch (er) { b.textContent = 'Could not copy'; } return; }
    if (a === 'share') { try { if ((navigator as any).share) await (navigator as any).share({ title: 'Problem report', text }); else { await navigator.clipboard.writeText(text); b.textContent = 'Copied'; } } catch (er) { /* closed */ } return; }
    pendingIssues(true); w.classList.remove('in'); setTimeout(() => w.remove(), 200); });
}
