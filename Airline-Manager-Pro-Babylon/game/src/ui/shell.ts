// App shell: navigation rail, top bar, screen router and the shared action dispatcher.

interface AppScreen { title: string; icon: string; render: () => string; mount?: (root: HTMLElement) => void; nav?: boolean }
const SCREENS: { [k: string]: AppScreen } = {};
const ACTIONS: { [k: string]: (el: HTMLElement, ev: Event) => void } = new Proxy({} as any, {
  // every action (a click, a key, the controller, a step in a conversation) is saved straight after it runs
  get(t: any, k: any) { const f = t[k]; if (typeof f !== 'function') return f; return function (this: any, ...a: any[]) { try { return f.apply(this, a); } finally { try { Store.soon(); } catch (e) { /* not ready */ } } }; },
});

const NAV_ORDER = ['ops', 'fleet', 'routes', 'jobs', 'schedule', 'dispatch', 'planner', 'maint', 'finance', 'logbook', 'pilots', 'ranking', 'career', 'news', 'coop'];
// Pages opened from inside other pages, shown under their parent in the rail
const SUB_PAGES: { [k: string]: string } = { map: 'ops', market: 'fleet' };

function renderShell() {
  const app = $('#app');
  app.innerHTML = `
    <nav class="rail" aria-label="Main">
      <button class="rail-brand" data-act="title-open" title="Back to the title screen" aria-label="Back to the title screen">${brandMark()}</button>
      <button class="rail-more up" data-act="rail-scroll" data-d="-1" aria-label="Scroll the menu up">${icon('down')}</button>
      <div class="rail-items">${NAV_ORDER.map(k => `
        <button class="rail-btn" data-act="go" data-screen="${k}" aria-label="${esc(SCREENS[k].title)}">
          ${icon(SCREENS[k].icon)}<span>${esc(SCREENS[k].title)}</span>${k === 'maint' ? `<i class="rail-dot" data-maint-dot></i>` : ''}
        </button>`).join('')}
        <button class="rail-btn" data-act="office-open" aria-label="My office">${icon('jobs')}<span>Office</span></button>
        <button class="rail-btn" data-act="ops-room" aria-label="The Operations office">${icon('clock')}<span>Operations</span></button>
        <button class="rail-btn" data-act="go" data-screen="hangars" aria-label="Hangars">${icon('wrench')}<span>Hangars</span></button>
        <button class="rail-btn" data-act="go" data-screen="lounges" aria-label="Lounges">${icon('star')}<span>Lounges</span></button>
        <button class="rail-btn" data-act="court-enter" aria-label="The courtroom">${icon('shield')}<span>Court</span><i class="rail-dot" data-court-dot hidden></i></button>
      </div>
      <button class="rail-more down" data-act="rail-scroll" data-d="1" aria-label="More in the menu below">${icon('down')}</button>
      <button class="rail-btn rail-set" data-act="settings" aria-label="Settings">${icon('gear')}<span>Settings</span></button>
      <div class="rail-ver" title="${esc(APP.name)} version ${esc(APP.version)}">v${esc(APP.version)}</div>
    </nav>
    <header class="topbar"></header>
    <main class="view" id="view"></main>`;
  setTimeout(railScrollBind, 0);
  renderTopbar();
  go(State.screen, true);
}

function brandMark(): string {
  return `<svg viewBox="0 0 32 32" class="brand-svg" aria-hidden="true"><circle cx="16" cy="16" r="14.5" fill="none" stroke="currentColor" stroke-width="1.4" opacity=".5"/>
    <path d="M16 4.5 18 14 27.5 16 18 18 16 27.5 14 18 4.5 16 14 14Z" fill="currentColor"/></svg>`;
}

function renderTopbar() {
  const c = company();
  const div = c.divisions.filter(d => d.id === State.divisionId)[0];
  const b = State.bridge;
  const st = Link.status;
  const linkTxt = st === 'connected' ? (Link.sim && !Link.sim.connected ? 'Linked, sim not running' : DESKTOP ? 'Linked on this PC' : Link.via === 'wifi' ? 'Linked over Wi-Fi' : Link.via === 'usb' ? 'Linked over USB' : 'Linked via hotspot')
    : st === 'unpaired' ? ((State as any).linkedOnce ? 'Link your PC' : 'Demo, link your PC') : 'Looking for your PC';
  const n = unreadCount();
  patchHtml($('.topbar'), `
    <button class="co-switch" data-act="switcher" aria-label="Switch company">
      <span class="co-badge" style="--co:${c.color};--co2:${c.color2}">${esc(c.icao)}</span>
      <span class="co-text"><b>${esc(c.name)}</b><small>${div ? esc(div.name) + ' division' : (c.divisions.length ? 'All divisions' : esc(myPilot().name))}</small></span>
      ${icon('down', 'co-chev')}
    </button>
    ${finHoldHtml()}
    ${Mode.coop() ? `<button class="mode-chip" data-act="go" data-screen="coop" aria-label="Co-op mode. Open Co-op">${icon('coop')}<span>Co-op</span><em>${coopState() ? coopState().members.filter((m: any) => m.online || m.you).length : 1}</em></button>` : ''}
    <button class="link-pill ${b.pc === 'connected' ? 'ok' : 'warn'}" data-act="link-panel" aria-label="${linkTxt}. Open connection details">
      <i class="link-led"></i>${icon(st === 'connected' && Link.via !== 'wifi' ? 'cell' : 'wifi')}<span>${linkTxt}</span><em>${b.pc === 'connected' && Link.latency ? Link.latency + ' ms' : ''}</em>
    </button>
    <button class="sync-chip" data-act="settings" data-section="cloud" style="display:none" aria-label="Sync"></button>
    <span class="batt-slot">${typeof Battery !== 'undefined' ? Battery.html() : ''}</span>
    ${dclockHtml()}
    <div class="top-spacer"></div>
    <button class="balance" data-balance data-act="go" data-screen="finance" aria-label="Balance ${money(c.balance)}. Open Finance"><small>Balance</small><b data-balance-val>${money(c.balance, { compact: true })}</b></button>
    <button class="icon-btn sound-btn ${State.settings.muteAll ? 'muted-btn' : ''}" data-act="sound-toggle" aria-label="${State.settings.muteAll ? 'Sounds are muted. Tap to turn sounds on' : 'Sounds are on. Tap to mute all sounds'}">${icon(State.settings.muteAll ? 'mute' : 'volume')}</button>
    <button class="icon-btn search-btn" data-act="search-open" aria-label="Search everything" title="Search (Ctrl+K)">${icon('search')}</button>
    <button class="icon-btn bell ${n ? 'has' : ''}" data-act="inbox" aria-label="Notifications, ${n} unread">${icon('bell')}${n ? `<span class="badge">${n}</span>` : ''}</button>
    <button class="icon-btn" data-act="settings" aria-label="Settings">${icon('gear')}</button>
    <button class="icon-btn power-btn" data-act="exit" aria-label="Exit ${esc(APP.name)}">${icon('power')}</button>`);
  try { renderSyncChip(); } catch (e) { /* sync not loaded */ }
  const dot = $('[data-maint-dot]');
  if (dot) dot.style.display = State.issues.some(i => i.status === 'open' && plane(i.reg) && plane(i.reg).companyId === State.companyId) ? '' : 'none';
}

/* ---------- the digital clock by the battery: your device's time, and the game's date ---------- */
function dclockHtml(): string { const d = dclockParts(); return `<span class="dclock" data-dclock role="timer" aria-label="Time ${d.t}, ${d.d}"><b><i data-dc-h>${d.h}</i><em>:</em><i data-dc-m>${d.m}</i></b><span data-dc-d>${d.d}</span></span>`; }
function dclockParts(): { h: string; m: string; s: string; t: string; d: string } {
  const now = new Date(), p = (n: number) => String(n).padStart(2, '0');
  let g = now; try { g = companyDate(); } catch (e) { /* the device's date */ }
  const h24 = State.settings.clock24 !== false, hh = h24 ? now.getHours() : (now.getHours() % 12 || 12);
  return { h: p(hh), m: p(now.getMinutes()), s: p(now.getSeconds()) + (h24 ? '' : now.getHours() < 12 ? ' am' : ' pm'), t: p(hh) + ':' + p(now.getMinutes()), d: g.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) };
}
setInterval(() => {
  const el = document.querySelector('[data-dclock]') as HTMLElement; if (!el) return;
  const d = dclockParts(), set = (sel: string, v: string) => { const e = el.querySelector(sel) as HTMLElement; if (e && e.textContent !== v) e.textContent = v; };
  set('[data-dc-h]', d.h); set('[data-dc-m]', d.m); set('[data-dc-s]', d.s); set('[data-dc-d]', d.d);
}, 1000);

let _navSeq = 0;
function go(screen: string, instant?: boolean) {
  if (!SCREENS[screen]) screen = 'ops';
  // at a monitor or the laptop in your offices: the screen opens there, where you are working
  try { if (typeof roomGo === 'function' && roomGo(screen)) return; } catch (e) { /* the app's own view */ }
  const prev = State.screen;
  State.screen = screen;
  const navKey = SUB_PAGES[screen] || screen;
  $all('.rail-btn').forEach(b => b.classList.toggle('on', b.getAttribute('data-screen') === navKey));
  const view = $('#view');
  const seq = ++_navSeq;
  const idx = (k: string) => NAV_ORDER.indexOf(SUB_PAGES[k] || k) + (SUB_PAGES[k] ? 0.5 : 0);
  const dir = idx(screen) >= idx(prev) ? 1 : -1;
  const paint = () => {
    if (seq !== _navSeq) return;
    view.innerHTML = `<section class="screen screen-${screen}" style="--dir:${dir}">${SCREENS[screen].render()}</section>`;
    const root = view.firstElementChild as HTMLElement;
    if (SCREENS[screen].mount) SCREENS[screen].mount(root);
    view.scrollTop = 0;
    if (!instant) { root.classList.add('enter'); requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('enter'))); }
  };
  const cur = view.firstElementChild as HTMLElement;
  if (cur && !instant && !reducedMotion()) { cur.classList.add('leave'); setTimeout(paint, 140); }
  else paint();
}

/** Re-render the current screen in place (after data changes). */
/** The menu scrolls when it is taller than the screen: arrows and a fade show there is more above or below. */
function railScrollState() {
  const r = $('.rail-items'), nav = $('.rail'); if (!r || !nav) return;
  const more = r.scrollHeight - r.clientHeight > 4;
  nav.classList.toggle('can-up', more && r.scrollTop > 4);
  nav.classList.toggle('can-down', more && r.scrollTop + r.clientHeight < r.scrollHeight - 4);
}
function railScrollBind() {
  const r = $('.rail-items'); if (!r) return;
  r.addEventListener('scroll', railScrollState, { passive: true }); window.addEventListener('resize', railScrollState);
  setTimeout(railScrollState, 50); setTimeout(railScrollState, 800);
  // a gentle nudge the first time, so it is clear the menu moves
  setTimeout(() => { if (r.scrollHeight - r.clientHeight > 4 && !State.settings.reduceMotion) { r.scrollTo({ top: 28, behavior: 'smooth' }); setTimeout(() => r.scrollTo({ top: 0, behavior: 'smooth' }), 650); } }, 6500);
}
ACTIONS['rail-scroll'] = el => { const r = $('.rail-items'); if (r) r.scrollBy({ top: +el.getAttribute('data-d') * r.clientHeight * 0.6, behavior: 'smooth' }); };
function refresh() {
  renderTopbar();
  try { if (typeof ofScreenRefresh === 'function') ofScreenRefresh(); } catch (e) { /* the office shows it next time */ }
  try { if (typeof opsRefresh === 'function') opsRefresh(); } catch (e) { /* Operations shows it next time */ }
  try { if (typeof hgRefresh === 'function') hgRefresh(); } catch (e) { /* the hangar shows it next time */ }
  try { if (typeof lapRefresh === 'function') lapRefresh(); } catch (e) { /* the laptop shows it next time */ }
  // in one of your offices the app's own view is hidden behind the room: it is drawn again when you leave
  // (two live maps of the same screen would otherwise take turns, and the one you look at flickers)
  try { if ((typeof OpsRoom !== 'undefined' && OpsRoom.on) || (typeof OfficeRoom !== 'undefined' && OfficeRoom.on)) return; } catch (e) { /* draw it */ }
  const view = $('#view');
  const st = view.scrollTop, cur = view.firstElementChild as HTMLElement, html = `<section class="screen screen-${State.screen}">${SCREENS[State.screen].render()}</section>`;
  // the same screen again: change only what changed (text, numbers, a new row), so nothing flashes or
  // animates in again. Screens with live maps or drawings are built afresh, without the entrance animations.
  if (cur && cur.classList.contains('screen-' + State.screen) && !SCREENS[State.screen].mount) { patchHtml(view, html); view.scrollTop = st; return; }
  const again = !!(cur && cur.classList.contains('screen-' + State.screen));
  view.innerHTML = html;
  const root = view.firstElementChild as HTMLElement;
  if (SCREENS[State.screen].mount) SCREENS[State.screen].mount(root);
  if (again) settleAnimations(root);
  view.scrollTop = st;
}

/** Put new HTML into an element by changing only the parts that differ: unchanged elements stay as they
 *  are (no flash, no animation starting over, pictures not drawn again). */
function patchHtml(el: Element, html: string) {
  const t = document.createElement(el.tagName === 'TBODY' ? 'tbody' : 'div'); t.innerHTML = html;
  patchChildren(el, t);
}
function patchChildren(from: Node, to: Node) {
  const a = Array.from(from.childNodes), b = Array.from(to.childNodes);
  for (let i = 0; i < b.length; i++) {
    const n = b[i], o = a[i];
    if (!o) { from.appendChild(n); continue; }
    // text that flipped last time (wrapped for the animation) compared as the text it shows
    if (n.nodeType === 3 && (o as Element).classList && (o as Element).classList.contains('flap-w')) {
      const t = document.createTextNode(o.textContent); from.replaceChild(t, o); if (t.nodeValue !== n.nodeValue) flapText(t, n.nodeValue); continue;
    }
    if (o.nodeType !== n.nodeType || o.nodeName !== n.nodeName) { from.replaceChild(n, o); continue; }
    if (o.nodeType === 3) { if (o.nodeValue !== n.nodeValue) flapText(o as Text, n.nodeValue); continue; }
    if (o.nodeType === 8) { if (o.nodeValue !== n.nodeValue) o.nodeValue = n.nodeValue; continue; }
    patchNode(o as Element, n as Element);
  }
  for (let i = b.length; i < a.length; i++) if (a[i].parentNode === from) from.removeChild(a[i]);
}
const PATCH_KEEP = ['spot', 'tick-fade', 'shake'];
function patchNode(o: Element, n: Element) {
  // a live part drawn by code into an empty place in the page (a map, a chart): kept as it is, only its own
  // attributes follow, so an update never wipes it (wiping and drawing it again makes it flicker)
  if (o.id && !n.childNodes.length && o.querySelector && o.querySelector('canvas')) { for (let i = 0; i < n.attributes.length; i++) if (n.attributes[i].name !== 'class' && o.getAttribute(n.attributes[i].name) !== n.attributes[i].value) o.setAttribute(n.attributes[i].name, n.attributes[i].value); return; }
  // a different item in this place (another id): swap it rather than reshape it
  const ko = o.getAttribute('data-id'), kn = n.getAttribute('data-id');
  if (ko !== kn && ko && kn) { o.parentNode.replaceChild(n, o); return; }
  // a picture drawn by code (crew figures, charts): left as it is while it shows the same thing; a new one
  // replaces it (and is drawn by its own code), so updates never wipe a drawing
  if (o.tagName === 'CANVAS') { if (o.getAttribute('data-k') !== n.getAttribute('data-k') || o.className.replace(/\s*\b(in|nofade|still)\b/g, '') !== n.className.replace(/\s*\b(in|nofade|still)\b/g, '')) o.parentNode.replaceChild(n, o); return; }
  const na = n.attributes, oa = o.attributes;
  for (let i = oa.length - 1; i >= 0; i--) if (!n.hasAttribute(oa[i].name)) o.removeAttribute(oa[i].name);
  for (let i = 0; i < na.length; i++) {
    let v = na[i].value;
    // short effects on the page (a card flashing, text fading in) carry on through an update
    if (na[i].name === 'class') PATCH_KEEP.forEach(k => { if (o.classList.contains(k) && !n.classList.contains(k)) v += ' ' + k; });
    if (o.getAttribute(na[i].name) !== v) o.setAttribute(na[i].name, v);
  }
  if (o.tagName === 'INPUT' || o.tagName === 'TEXTAREA' || o.tagName === 'SELECT') { if (document.activeElement !== o && 'value' in n) (o as any).value = (n as any).value; return; }
  if (o.tagName === 'CANVAS') return;   // drawn by code
  if (o.innerHTML !== n.innerHTML) patchChildren(o, n);
}
const FLAP_WHERE = '.sel-pop, .screen-ops, .screen-ranking, .v3d, .apv';
/** Changed text turns over like a split-flap departure board: only the characters that changed flip, one
 *  after the other. Long text fades across instead; with reduced motion it simply changes. */
function flapText(o: Text, txt: string) {
  const par = o.parentElement, old = o.nodeValue || '';
  if (!par || State.settings.reduceMotion || par.closest('svg, option, select, textarea, title') || !txt.trim()) { o.nodeValue = txt; return; }
  // the flip only where it belongs: the opened flight card, Overview, Ranking, and the 3D and 2D views; elsewhere text simply changes
  if (!par.closest(FLAP_WHERE)) { o.nodeValue = txt; return; }
  if (txt.length > 32) { o.nodeValue = txt; par.classList.remove('tick-fade'); void par.offsetWidth; par.classList.add('tick-fade'); return; }
  const w = document.createElement('span'); w.className = 'flap-w';
  // characters are lined up from the right for numbers (so 9→10 flips the right digits), from the left otherwise
  const num = /^[\s\d.,:%+\-−€$£kKmMh]+$/.test(txt) && /\d/.test(txt), off = num ? old.length - txt.length : 0;
  let k = 0;
  for (let i = 0; i < txt.length; i++) {
    const ch = txt[i], was = old[i + off];
    if (ch === was || ch === ' ') { w.appendChild(document.createTextNode(ch)); continue; }
    const s = document.createElement('span'); s.className = 'fl'; s.textContent = ch; s.style.setProperty('--d', (k++ * 28) + 'ms'); w.appendChild(s);
  }
  par.replaceChild(w, o);
}
/** Entrance animations of a rebuilt screen jump to their end; animations that loop keep going. */
function settleAnimations(root: HTMLElement) {
  try { (root as any).getAnimations({ subtree: true }).forEach((a: any) => { const t = a.effect && a.effect.getTiming(); if (t && t.iterations !== Infinity) a.finish(); }); } catch (e) { /* older browser */ }
}

function bindActions() {
  document.addEventListener('click', ev => {
    const el = (ev.target as HTMLElement).closest('[data-act]') as HTMLElement;
    if (!el) return;
    const a = ACTIONS[el.getAttribute('data-act')];
    if (a) { ev.preventDefault(); a(el, ev); }
  });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape') closeTop(); });
  // Unlock audio on the first touch, so the first sound (a payment, a purchase) is never swallowed.
  const unlock = () => { audio(); document.removeEventListener('pointerdown', unlock, true); };
  document.addEventListener('pointerdown', unlock, true);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && _ctx && _ctx.state !== 'running') _ctx.resume(); });
}

ACTIONS.go = el => { Sound.tick(); go(el.getAttribute('data-screen')); };

// Animated balance change in the top bar
function animateBalance(from: number, to: number) {
  const el = $('[data-balance-val]'); if (!el) return;
  const box = $('[data-balance]'); box.classList.remove('flash', 'flash-down'); void box.offsetWidth; box.classList.add(to < from ? 'flash-down' : 'flash');
  const t0 = performance.now(), dur = reducedMotion() ? 1 : 900;
  const step = (now: number) => {
    const k = clamp((now - t0) / dur, 0, 1), e = 1 - Math.pow(1 - k, 3);
    el.textContent = money(from + (to - from) * e, { compact: true });
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// Shared bits of markup used by several screens
/** The status of an aircraft that is flying, with its real phase (in the air, or taxiing, boarding…);
 *  tap it to see the aircraft on the map. Not flying: the plain status chip. */
function liveChip(reg: string, status?: string): string {
  const f: any = State.live.filter(x => x.reg === reg)[0];
  if (!f) return statusChip(status || 'parked');
  const air = typeof flightInAir === 'function' ? flightInAir(f) : (f.alt || 0) > 50;
  const ph = String(f.phase || '').replace(/^Delayed: .*/, 'Delayed at the gate').replace(/^Holding short.*/, 'Holding short').replace(/^Lining up.*/, 'Lining up');
  const label = air ? (/climb/i.test(ph) ? 'Climbing' : /descent|approach|final/i.test(ph) ? 'Descending' : /hold/i.test(ph) ? 'Holding' : 'In flight') : (ph || 'On the ground');
  const dv = flightDiverted(f);
  return `<span class="chip chip-${air ? 'flight' : 'amber'} chip-link" role="button" tabindex="0" data-act="show-flight" data-id="${esc(f.id)}" title="Show on the map">${esc(label)}${icon('map')}</span>${dv ? `<span class="chip chip-divert chip-link" role="button" tabindex="0" data-act="show-flight" data-id="${esc(f.id)}" title="${esc(dv.why)}">${icon('alert')}Diverted to ${esc(dv.to)}</span>` : ''}`;
}
/** A flight that diverted (medical or weather): where it went instead, from where, and why. */
function flightDiverted(f: any): { to: string; orig: string; why: string } | null {
  const d = f.medical || f.wxDivert; if (!d) return null;
  return { to: f.to, orig: d.orig || '', why: f.medical ? `Medical emergency: diverted to ${f.to} instead of ${d.orig || 'its destination'}` : `Weather at ${d.orig || 'its destination'}${d.why ? ' (' + d.why + ')' : ''}: diverted to ${f.to}` };
}
ACTIONS['show-flight'] = el => showFlightOnMap(el.getAttribute('data-id'));
function statusChip(s: string): string {
  const map: { [k: string]: string[] } = {
    flying: ['In flight', 'flight'], parked: ['Available', 'avail'], leased: ['Leased out', 'dim'], grounded: ['Maintenance', 'maint'], maintenance: ['Maintenance', 'maint'],
    resting: ['Resting', 'dim'], standby: ['Standby', 'cyan'], off: ['Available', 'green'], training: ['On a course', 'amber'],
    ok: ['Normal', 'green'], hard: ['Hard landing', 'amber'], crash: ['Crash', 'red'], incident: ['Incident', 'amber'],
    open: ['Open', 'amber'], scheduled: ['Scheduled', 'cyan'], fixed: ['Fixed', 'green'],
    minor: ['Minor', 'dim'], major: ['Major', 'amber'], grounding: ['Grounding', 'red'], voided: ['Disregarded', 'dim'],
    guilty: ['Guilty', 'red'], acquitted: ['Not guilty', 'green'],
  };
  const m = map[s] || [s, 'dim'];
  return `<span class="chip chip-${m[1]}">${esc(m[0])}</span>`;
}

function conditionBar(v: number): string {
  // one line: green good, yellow some wear, orange needs attention, red severe problems
  const b = condBand(v);
  return `<span class="cond cond-${b[1]}" title="${b[2]}"><i style="width:${Math.round(v)}%"></i></span>`;
}

function emptyState(title: string, body: string, actionLabel?: string, act?: string): string {
  return `<div class="empty"><b>${esc(title)}</b><p>${esc(body)}</p>${actionLabel ? `<button class="btn" data-act="${act}">${esc(actionLabel)}</button>` : ''}</div>`;
}

/** Header for pages opened from another page, with a way back. */
function subHead(parent: string, title: string, sub: string, right?: string): string {
  return `<div class="screen-head"><div class="sh-left"><button class="back-btn" data-act="go" data-screen="${parent}" aria-label="Back to ${esc(SCREENS[parent].title)}">${icon('chevron', 'flip')}<span>${esc(SCREENS[parent].title)}</span></button>
    <h1>${esc(title)}</h1><p class="sub">${esc(sub)}</p></div>${right || ''}</div>`;
}

ACTIONS.unmute = () => { State.settings.muteAll = false; renderTopbar(); Sound.tick(); voiceUiChanged(); toast('Sounds on', 'ok'); };
ACTIONS['sound-toggle'] = () => {
  const mute = !State.settings.muteAll;
  if (mute) { Voice.stop(); State.settings.muteAll = true; } else { State.settings.muteAll = false; Sound.tick(); }
  renderTopbar(); Haptics.pulse(8);
  try { if ($('#set-body')) rerenderSettingsBody(); } catch (e) { /* settings closed */ }
  toast(mute ? 'All sounds muted' : 'Sounds on', 'ok');
};
