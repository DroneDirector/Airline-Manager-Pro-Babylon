// What's new: the three newest versions' release notes (built into the game), in Settings → What's new at any time,
// and as a pop-up once after the game has been updated. The newest is open (it can be folded away, remembered until
// the next update, when the newest opens again); the two before it stay folded until tapped.
import { APP } from '../core/app';
import { icon, esc } from './icons';

declare const __WHATS_NEW__: { v: string; md: string }[];
export const WHATS_NEW = __WHATS_NEW__;
const SEEN = 'ampb-seen-version', FOLD = 'ampb-wn-folded';

/** Release notes (Markdown: headings, bold lines, points and sub-points) as HTML. */
export function mdHtml(md: string): string {
  const inl = (s: string) => esc(s).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');
  const out: string[] = []; let depth = 0; const close = (to: number) => { while (depth > to) { out.push('</ul>'); depth--; } };
  for (const raw of md.split(/\r?\n/)) {
    const l = raw.replace(/\s+$/, ''); if (!l.trim()) continue;
    if (/^#\s/.test(l)) continue;                                           // the version's own heading
    const m = /^(\s*)[-*]\s+(.*)$/.exec(l);
    if (m) { const d = Math.floor(m[1].length / 2) + 1; while (depth < d) { out.push('<ul>'); depth++; } close(d); out.push(`<li>${inl(m[2])}</li>`); continue; }
    close(0);
    const h = /^#{2,4}\s+(.*)$/.exec(l) || /^\*\*([^*]+)\*\*$/.exec(l.trim());
    if (h) out.push(`<h4>${inl(h[1])}</h4>`); else out.push(`<p>${inl(l.trim())}</p>`);
  }
  close(0); return out.join('');
}
function titleOf(md: string, v: string): string { const m = /^#\s+(.*)$/m.exec(md); return m ? m[1].replace(/^.*?\d+\.\d+\.\d+\s*[:–-]?\s*/, '') || `Version ${v}` : `Version ${v}`; }
export function whatsNewHtml(): string {
  let folded = ''; try { folded = localStorage.getItem(FOLD) || ''; } catch (e) { /* none */ }
  return WHATS_NEW.map((r, i) => `<details class="wn-rel ${i === 0 ? 'wn-latest' : ''}" data-v="${esc(r.v)}" ${i === 0 && folded !== r.v ? 'open' : ''}>
    <summary><span class="wn-ver">${esc(r.v)}</span><span class="wn-t"><b>${esc(titleOf(r.md, r.v))}</b><small>${i === 0 ? (r.v === APP.version ? 'Installed now' : 'Newest') : 'Earlier update'}</small></span>${i === 0 ? '<em class="wn-new">New</em>' : ''}<span class="wn-chev">${icon('back')}</span></summary>
    <div class="wn-body">${mdHtml(r.md)}</div></details>`).join('') || '<p class="wn-none">No release notes yet.</p>';
}
/** Remember the newest being folded away (or opened again), until the next update. */
export function whatsNewBind(root: HTMLElement) {
  const latest = root.querySelector('.wn-latest') as HTMLDetailsElement; if (!latest) return;
  latest.addEventListener('toggle', () => { try { if (latest.open) { if (localStorage.getItem(FOLD) === latest.dataset.v) localStorage.removeItem(FOLD); } else localStorage.setItem(FOLD, latest.dataset.v || ''); } catch (e) { /* not kept */ } });
}
/** The pop-up. */
export function whatsNewOpen() {
  if (!WHATS_NEW.length || document.querySelector('.wn-pop')) return;
  const ui = document.getElementById('ui') as HTMLElement, el = document.createElement('div'); el.className = 'wn-pop';
  el.innerHTML = `<div class="wn-box" role="dialog" aria-label="What's new"><div class="wn-head"><div><b>What's new</b><small>${esc(APP.name)} ${esc(APP.version)}</small></div><button class="sp-x" data-a="x" aria-label="Close">${icon('close')}</button></div>
    <div class="wn-list">${whatsNewHtml()}</div><div class="wn-foot"><button class="sp-btn" data-a="x">Got it</button></div></div>`;
  ui.appendChild(el); whatsNewBind(el); requestAnimationFrame(() => el.classList.add('in'));
  el.addEventListener('click', (e: Event) => { const t = e.target as HTMLElement; if (t === el || t.closest('[data-a="x"]')) whatsNewClose(); });
}
export function whatsNewClose(): boolean { const el = document.querySelector('.wn-pop') as HTMLElement; if (!el) return false; el.classList.remove('in'); setTimeout(() => el.remove(), 300); return true; }
export function whatsNewIsOpen(): boolean { return !!document.querySelector('.wn-pop'); }
/** At start-up: once after an update (not on a brand-new install). */
export function whatsNewOnStart() {
  let seen = ''; try { seen = localStorage.getItem(SEEN) || ''; } catch (e) { return; }
  try { localStorage.setItem(SEEN, APP.version); } catch (e) { /* not kept */ }
  let used = false; try { used = !!localStorage.getItem('ampb-settings'); } catch (e) { /* new */ }
  if (seen === APP.version || (!seen && !used)) return;
  setTimeout(whatsNewOpen, 2200);
}
