// Small shared helpers. Plain functions only, so the output runs in older web engines too.

function esc(s: any): string {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function money(n: number, opts?: { sign?: boolean; compact?: boolean }): string {
  const neg = n < 0;
  const a = Math.abs(n);
  let s: string;
  if (opts && opts.compact && a >= 1e6) s = (a / 1e6).toFixed(a >= 1e7 ? 1 : 2).replace(/\.0+$/, '') + 'M';
  else if (opts && opts.compact && a >= 1e4) s = Math.round(a / 1e3) + 'k';
  else s = Math.round(a).toLocaleString('en-US');
  const pre = neg ? '−' : (opts && opts.sign ? '+' : '');
  return pre + '$' + s;
}

function hours(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return h + ':' + (m < 10 ? '0' : '') + m;
}

/** Time left as h:mm:ss (or m:ss under an hour), for countdowns. */
function countdown(sec: number): string {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60, p = (n: number) => (n < 10 ? '0' : '') + n;
  return h ? h + ':' + p(m) + ':' + p(s) : m + ':' + p(s);
}

function num(n: number): string { return Math.round(n).toLocaleString('en-US'); }

function clamp(v: number, a: number, b: number): number { return v < a ? a : v > b ? b : v; }

function $(sel: string, root?: ParentNode): HTMLElement { return (root || document).querySelector(sel) as HTMLElement; }
function $all(sel: string, root?: ParentNode): HTMLElement[] {
  return Array.prototype.slice.call((root || document).querySelectorAll(sel));
}

/** Running as the Windows app (served by the PC app on this PC) rather than on the phone. */
const DESKTOP = /^https?:$/.test(location.protocol) && /^(127\.0\.0\.1|localhost)$/.test(location.hostname) && location.port === '47610';
/** Extra quality on the PC (real lights and shadows, sharper pictures, finer detail); phones and tablets keep the lighter versions. */
function hiQ(): boolean { return DESKTOP; }
/** How much the interface is scaled up on big screens (1 on the phone). */
function uiScale(): number { return (window as any).__uiZoom || 1; }

function reducedMotion(): boolean {
  try { const S: any = State.settings; if (S && (S.motion === 'reduce' || (typeof saverOn === 'function' && saverOn()))) return true; } catch (e) { /* not ready */ }
  return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

function uid(): string { return Math.random().toString(36).slice(2, 9); }

// Great-circle helpers (degrees in, degrees out)
const D2R = Math.PI / 180;
function gcDistanceNm(a: number[], b: number[]): number {
  if (!a || !b || a.length < 2 || b.length < 2) return 0;   // a position not known yet
  const [lon1, lat1] = a, [lon2, lat2] = b;
  const p1 = lat1 * D2R, p2 = lat2 * D2R, dl = (lon2 - lon1) * D2R;
  const d = Math.acos(clamp(Math.sin(p1) * Math.sin(p2) + Math.cos(p1) * Math.cos(p2) * Math.cos(dl), -1, 1));
  return d * 3440.065;
}
function gcInterpolate(a: number[], b: number[], t: number): number[] {
  const p1 = a[1] * D2R, l1 = a[0] * D2R, p2 = b[1] * D2R, l2 = b[0] * D2R;
  const d = Math.acos(clamp(Math.sin(p1) * Math.sin(p2) + Math.cos(p1) * Math.cos(p2) * Math.cos(l2 - l1), -1, 1));
  if (d < 1e-9) return [a[0], a[1]];
  const A = Math.sin((1 - t) * d) / Math.sin(d), B = Math.sin(t * d) / Math.sin(d);
  const x = A * Math.cos(p1) * Math.cos(l1) + B * Math.cos(p2) * Math.cos(l2);
  const y = A * Math.cos(p1) * Math.sin(l1) + B * Math.cos(p2) * Math.sin(l2);
  const z = A * Math.sin(p1) + B * Math.sin(p2);
  return [Math.atan2(y, x) / D2R, Math.atan2(z, Math.sqrt(x * x + y * y)) / D2R];
}

/** "a" or "an" before a word or model name, by how it is said: an A320, an ATR, an 8-seater, a 737. */
function aAn(w: string): string { return /^([AEIOFHLMNRSX]\d|[AEIOU]|8|11|18)/i.test(String(w || '').trim()) && !/^(U[nst]|Eu|One)/i.test(String(w || '')) ? 'an' : 'a'; }
