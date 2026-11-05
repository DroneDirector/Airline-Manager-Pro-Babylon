// A new career starts with its money on hold: after you create your pilot (and your family and pet) and found your
// airline, nothing is booked until you press "Finances are on hold" at the top. Then the books open: the company is
// registered (its first cost, once a year from then on), and every purchase, salary and fee counts from that moment.
// Until then buying, leasing and hiring wait for it.

function finOnHold(): boolean { return !!(State as any).finHold; }
const FIN_REG_FEE = 2500, FIN_YEAR = 365 * 864e5;

/** The button at the top while the money is on hold. */
function finHoldHtml(): string {
  if (!finOnHold()) return '';
  return `<button class="fin-hold" data-act="fin-start" aria-label="Finances are on hold. Click to start your career"><span class="fh-ic">${icon('play')}</span><span class="fh-t"><b>Finances are on hold</b><small>Click to start your career</small></span></button>`;
}
ACTIONS['fin-start'] = el => {
  if (!finOnHold()) return;
  const b = (el && el.closest('.fin-hold')) as HTMLElement || $('.fin-hold');
  Haptics.success(); try { Sound.chime(); } catch (e) { /* no sound */ }
  if (b) b.classList.add('go');
  setTimeout(() => {
    const S: any = State; S.finHold = false;
    // the books open: the company's registration is the first cost, and comes round once a year
    const c: any = company(), now = Date.now();
    if (c) { const before = c.balance; c.balance -= FIN_REG_FEE; State.txns.unshift({ id: uid(), companyId: c.id, date: dateStr(new Date()).slice(0, 10), time: dateStr(new Date()).slice(11), kind: 'fees', label: 'Company registration (yearly)', amount: -FIN_REG_FEE, lines: [['Registration of ' + c.name, -FIN_REG_FEE]] } as any); try { animateBalance(before, c.balance); } catch (e) { /* ui */ } }
    S.regNext = now + FIN_YEAR; S.payNext = now + 7 * 864e5;
    try { if (S.bank) S.bank.rentNext = {}; } catch (e) { /* none */ }
    Store.save(); renderTopbar(); refresh();
    toast('Your career has started. Every purchase is in the books from now on.', 'ok');
  }, 750);
};
/** While on hold: buying, leasing and hiring wait until you start your career. */
function finHoldBlocked(): boolean {
  if (!finOnHold()) return false;
  toast('Start your career first: tap "Finances are on hold" at the top', 'warn');
  const b = $('.fin-hold') as HTMLElement; if (b) { b.classList.remove('nudge'); void b.offsetWidth; b.classList.add('nudge'); }
  return true;
}
(function finHoldGate() {
  for (const k of ['buy-confirm', 'buy-used-go', 'lease-confirm', 'hire', 'hire-do', 'cab-save', 'buyback', 'lease-buyout', 'fix-now']) {
    const f = ACTIONS[k]; if (typeof f !== 'function') continue;
    ACTIONS[k] = function (this: any, el: HTMLElement, ev: Event) { if (finHoldBlocked()) return; return f.call(this, el, ev); };
  }
  // the yearly registration of the company
  setInterval(() => {
    const S: any = State; if (finOnHold() || !S.regNext || Date.now() < S.regNext) return;
    const c: any = company(); if (!c) return;
    c.balance -= FIN_REG_FEE; State.txns.unshift({ id: uid(), companyId: c.id, date: dateStr(new Date()).slice(0, 10), time: dateStr(new Date()).slice(11), kind: 'fees', label: 'Company registration (yearly)', amount: -FIN_REG_FEE, lines: [['Registration of ' + c.name, -FIN_REG_FEE]] } as any);
    S.regNext += FIN_YEAR; Store.soon();
  }, 60000);
})();

/* ---------- the button's look: the glowing scroll-wheel effect ---------- */
// A turning gradient rim runs round its edges, "upscale" pixels flicker from coarse to fine under the text, sparkles
// twinkle, a scan of light sweeps across, and a soft glow breathes around it. Drawn on a canvas inside the button
// while it is on the screen (still, with reduced motion).
const FH_A = [255, 178, 61], FH_B = [255, 106, 61], FH_TIP = [255, 233, 168];
function _fhHash(i: number, j: number, k: number): number { let h = (i * 374761393 + j * 668265263 + k * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function finHoldFx() {
  const b = document.querySelector('.fin-hold') as HTMLElement; if (!b || b.querySelector('.fh-fx')) return;
  const cv = document.createElement('canvas'); cv.className = 'fh-fx'; cv.setAttribute('aria-hidden', 'true'); b.insertBefore(cv, b.firstChild);
  const x = cv.getContext('2d') as CanvasRenderingContext2D, t0 = performance.now(), calm = !!State.settings.reduceMotion;
  const rgba = (c: number[], a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const frame = (now: number) => {
    if (!cv.isConnected) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, W, H);
    const t = calm ? 0.3 : (now - t0) / 1000, phase = (t / 2.4) % 1, pad = 3, w = W - pad * 2, h = H - pad * 2, r = Math.min(12, h / 2);
    const rr = (inset: number) => { const X = pad + inset, Y = pad + inset, ww = w - inset * 2, hh = h - inset * 2, R = Math.max(1, r - inset); x.beginPath(); x.moveTo(X + R, Y); x.arcTo(X + ww, Y, X + ww, Y + hh, R); x.arcTo(X + ww, Y + hh, X, Y + hh, R); x.arcTo(X, Y + hh, X, Y, R); x.arcTo(X, Y, X + ww, Y, R); x.closePath(); };
    // "upscale" pixels: blocks flickering from coarse to fine, inside the button
    x.save(); rr(1.5); x.clip();
    const cell = 4 + 3 * (0.5 + 0.5 * Math.sin(t * 1.3)), step = Math.floor(phase * 12);
    for (let j = 0, cy = pad; cy < pad + h; cy += cell, j++) for (let i = 0, cx = pad; cx < pad + w; cx += cell, i++) {
      const v = _fhHash(i, j, step), a = 0.03 + 0.12 * v; if (a < 0.06) continue;
      x.fillStyle = rgba(v > 0.5 ? FH_TIP : FH_B, a); x.fillRect(cx, cy, cell - 1, cell - 1);
    }
    // a scan of light sweeping across
    const sx = pad - 40 + ((t * 0.55) % 1) * (w + 80), sg = x.createLinearGradient(sx - 30, 0, sx + 30, 0);
    sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,250,230,.42)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = sg; x.fillRect(pad, pad, w, h);
    x.restore();
    // the turning gradient rim round its edges
    const cx = W / 2, cy = H / 2, ang = phase * Math.PI * 2;
    let rim: any;
    if ((x as any).createConicGradient) { rim = (x as any).createConicGradient(ang, cx, cy); rim.addColorStop(0, rgba(FH_A, 1)); rim.addColorStop(0.33, rgba(FH_B, 1)); rim.addColorStop(0.55, rgba(FH_TIP, 1)); rim.addColorStop(0.7, 'rgba(255,255,255,.95)'); rim.addColorStop(1, rgba(FH_A, 1)); }
    else { rim = x.createLinearGradient(cx + Math.cos(ang) * W, cy + Math.sin(ang) * H, cx - Math.cos(ang) * W, cy - Math.sin(ang) * H); rim.addColorStop(0, rgba(FH_TIP, 1)); rim.addColorStop(1, rgba(FH_B, 1)); }
    x.lineWidth = 2.4; x.strokeStyle = rim; x.shadowColor = rgba(FH_A, 0.9); x.shadowBlur = 10; rr(0); x.stroke(); x.shadowBlur = 0;
    // a bright head running round the rim, with a short tail
    const per = 2 * (w + h), run = (phase * per);
    const at = (d: number) => { d = ((d % per) + per) % per; if (d < w) return [pad + d, pad]; d -= w; if (d < h) return [pad + w, pad + d]; d -= h; if (d < w) return [pad + w - d, pad + h]; d -= w; return [pad, pad + h - d]; };
    for (let k = 0; k < 10; k++) { const p = at(run - k * 4), a = (1 - k / 10) * 0.9; x.fillStyle = `rgba(255,255,240,${a})`; x.beginPath(); x.arc(p[0], p[1], 2.4 - k * 0.18, 0, Math.PI * 2); x.fill(); }
    // sparkles twinkling round the edge
    for (let k = 0; k < 6; k++) {
      const s = Math.floor(t * 3 + k * 0.37), p = at(_fhHash(k, 3, s) * per), tw = Math.max(0, Math.sin((t * 3 + k * 0.37) % 1 * Math.PI));
      x.fillStyle = `rgba(255,255,255,${0.85 * tw})`; x.beginPath(); x.arc(p[0], p[1], 0.8 + 1.4 * tw, 0, Math.PI * 2); x.fill();
      x.strokeStyle = `rgba(255,240,200,${0.6 * tw})`; x.lineWidth = 1; x.beginPath(); x.moveTo(p[0] - 4 * tw, p[1]); x.lineTo(p[0] + 4 * tw, p[1]); x.moveTo(p[0], p[1] - 4 * tw); x.lineTo(p[0], p[1] + 4 * tw); x.stroke();
    }
    if (!calm) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
setInterval(() => { try { if (finOnHold()) finHoldFx(); } catch (e) { /* not ready */ } }, 800);
