// "What's new": shown once after the app has been updated, and from Settings → General at any time.
// The three newest versions (from the release notes, built into the app). The newest one is open; it can
// be folded away, and that is remembered only until the next update, when the newest one opens again.
// The two before it are always folded until tapped.

function whatsNewHtml(): string {
  const S: any = State;
  const cap = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  return WHATS_NEW.map((r, i) => {
    const open = i === 0 && S.wnClosed !== r.v;
    return `<details class="wn-rel ${i === 0 ? 'wn-latest' : ''}" data-v="${esc(r.v)}" ${open ? 'open' : ''}>
      <summary><span class="wn-ver">${esc(r.v)}</span><span class="wn-t"><b>${esc(cap(r.title) || 'Version ' + r.v)}</b>${i === 0 ? `<small>${r.v === APP.version ? 'Installed now' : 'Newest'}</small>` : `<small>Earlier update</small>`}</span>
        ${i === 0 ? '<em class="wn-new">New</em>' : ''}<span class="wn-chev">${icon('chevron')}</span></summary>
      <div class="wn-body">${r.groups.map(g => `${g.h ? `<h4>${esc(g.h)}</h4>` : ''}<ul>${g.items.map(t => `<li>${t}</li>`).join('')}</ul>`).join('')}</div>
    </details>`;
  }).join('');
}

function openWhatsNew() {
  if (!WHATS_NEW.length) return;
  openLayer('modal', `<div class="modal-head"><div><h2>What's new</h2><small>${esc(APP.name)} ${esc(APP.version)}</small></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
    <div class="modal-body wn-list">${whatsNewHtml()}</div>
    <div class="modal-actions"><button class="btn primary" data-act="close-layer">${icon('check')}Got it</button></div>`, { cls: 'wn' });
  // remember when the newest one is folded away (or opened again), until the next update
  const latest = document.querySelector('.wn-latest') as HTMLDetailsElement;
  if (latest) latest.addEventListener('toggle', () => {
    const S: any = State;
    if (latest.open) { if (S.wnClosed === latest.dataset.v) S.wnClosed = ''; } else S.wnClosed = latest.dataset.v;
    Store.soon();
  });
  document.querySelectorAll('.wn-rel').forEach(d => d.addEventListener('toggle', () => { try { Sound.tick(); } catch (e) { /* muted */ } }));
}

/** At start-up: after an update, show what's new once (not on a brand-new airline). */
function whatsNewOnStart() {
  const S: any = State;
  if (!WHATS_NEW.length || S.seenVersion === APP.version) return;
  const fresh = Store.wasEmpty && !S.seenVersion;
  S.seenVersion = APP.version; Store.save();
  if (fresh) return;
  // wait until the start-up is done and no other pop-up (birthday, restore…) is open
  let tries = 0;
  const show = () => {
    if ((_layers.length || splashShowing() || titleShowing()) && tries++ < 400) { setTimeout(show, 1500); return; }
    openWhatsNew();
  };
  setTimeout(show, SPLASH_MS + 900);
}

ACTIONS['whats-new'] = () => { Sound.tick(); openWhatsNew(); };
