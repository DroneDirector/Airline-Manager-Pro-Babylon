// The loading screen between the start screen and a 3D place: what is loading, with its percentage.
import { esc } from './icons';
let el: HTMLElement | null = null;
export function loadingShow(title: string) {
  loadingHide(true); const ui = document.getElementById('ui') as HTMLElement;
  el = document.createElement('div'); el.className = 'ld';
  el.innerHTML = `<div class="ld-box"><b>${esc(title)}</b><div class="ld-bar"><i></i></div><small class="ld-step">Starting the engine…</small><em class="ld-pct">0%</em></div>`;
  ui.appendChild(el); requestAnimationFrame(() => el && el.classList.add('in'));
}
export function loadingProgress(pct: number, step: string) {
  if (!el) return; const p = Math.max(0, Math.min(100, Math.round(pct)));
  (el.querySelector('.ld-bar i') as HTMLElement).style.width = p + '%'; (el.querySelector('.ld-step') as HTMLElement).textContent = step; (el.querySelector('.ld-pct') as HTMLElement).textContent = p + '%';
}
export function loadingHide(now?: boolean) { const e = el; el = null; if (!e) return; if (now) { e.remove(); return; } e.classList.remove('in'); setTimeout(() => e.remove(), 600); }
