// Layered windows: pop-ups, the notification drawer, the company switcher and toasts.

const _layers: HTMLElement[] = [];

function openLayer(kind: 'modal' | 'drawer' | 'pop', html: string, opts?: { cls?: string; onClose?: () => void; anchor?: HTMLElement }): HTMLElement {
  const root = $('#overlay-root');
  (window as any).__layerAt = performance.now();   // a window is sliding in: heavy drawing waits until it is in view
  const wrap = document.createElement('div');
  wrap.className = `layer layer-${kind} ${opts && opts.cls ? opts.cls : ''}`;
  wrap.innerHTML = `<div class="scrim" data-act="close-layer"></div><div class="panel" role="dialog" aria-modal="true">${html}</div>`;
  (wrap as any)._onClose = opts && opts.onClose;
  if (opts && opts.anchor && kind === 'pop') {
    const z = (window as any).__uiZoom || 1, r = opts.anchor.getBoundingClientRect();   // rects are in screen pixels, styles in page pixels
    const p = wrap.querySelector('.panel') as HTMLElement;
    p.style.left = Math.max(8, r.left / z) + 'px'; p.style.top = (r.bottom / z + 6) + 'px';
  }
  root.appendChild(wrap);
  // a menu by a button never runs off the screen: keep it inside the window, above the button if there's no room below
  if (opts && opts.anchor && kind === 'pop') {
    const p = wrap.querySelector('.panel') as HTMLElement, z = (window as any).__uiZoom || 1, W = innerWidth / z, H = innerHeight / z;
    const w = p.offsetWidth, h = p.offsetHeight, ar = opts.anchor.getBoundingClientRect();
    let l = parseFloat(p.style.left), t = parseFloat(p.style.top);
    if (l + w > W - 8) l = Math.max(8, W - 8 - w);
    if (t + h > H - 8) { const above = ar.top / z - 6 - h; t = above >= 8 ? above : Math.max(8, H - 8 - h); }
    p.style.left = l + 'px'; p.style.top = t + 'px';
  }
  _layers.push(wrap);
  requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('open')));
  return wrap;
}

function closeTop() {
  const w = _layers.pop(); if (!w) return;
  w.classList.remove('open'); w.classList.add('closing');
  if ((w as any)._onClose) (w as any)._onClose();
  setTimeout(() => w.remove(), reducedMotion() ? 0 : 260);
}
function closeAll() { while (_layers.length) closeTop(); }

ACTIONS['close-layer'] = () => { Sound.tick(); closeTop(); };

function toast(msg: string, kind?: 'ok' | 'warn' | 'info', action?: { label: string; act: string; data?: string }) {
  // one toast at a time: a new one replaces any still showing (they share the same spot)
  document.querySelectorAll('.toast').forEach(o => { o.classList.remove('show'); setTimeout(() => o.remove(), 300); });
  const t = document.createElement('div');
  t.className = 'toast toast-' + (kind || 'info') + (action ? ' has-act' : '');
  t.innerHTML = `${icon(kind === 'warn' ? 'alert' : kind === 'info' && action ? 'fleet' : 'check')}<span>${esc(msg)}</span>${action
    ? `<button class="toast-act" data-act="${action.act}" data-id="${esc(action.data || '')}">${esc(action.label)}${icon('chevron')}</button>` : ''}`;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, action ? 6000 : 2600);
}

/* ---------- Company switcher ---------- */
ACTIONS.switcher = el => {
  Sound.tick();
  const shared = State.settings.appMode === 'shared';
  const rows = State.profiles.map(pr => {
    const pl = pilot(pr.pilotId);
    const cos = State.companies.filter(c => c.profileId === pr.id);
    return `<div class="sw-group">
      <div class="sw-pilot">${icon('user')}<span><b>${esc(pl.name)}</b><small>${esc(pr.label)}, ${hours(pl.hoursMin)} h</small></span></div>
      ${cos.map(c => `
        <button class="sw-co ${c.id === State.companyId ? 'on' : ''}" data-act="pick-company" data-co="${c.id}">
          <span class="co-badge" style="--co:${c.color};--co2:${c.color2}">${esc(c.icao)}</span>
          <span class="sw-co-t"><b>${esc(c.name)}</b><small>${c.kind === 'bush' ? 'Bush operation' : c.kind === 'regional' ? 'Regional and cargo' : 'Airline'}, hub ${esc(c.hub)}, ${State.fleet.filter(a => a.companyId === c.id).length} aircraft</small></span>
          <span class="sw-bal">${money(c.balance, { compact: true })}</span>
        </button>
        ${c.id === State.companyId && c.divisions.length ? `<div class="sw-divs">
          <button class="div-chip ${State.divisionId === 'all' ? 'on' : ''}" data-act="pick-division" data-div="all">All divisions</button>
          ${c.divisions.map(d => `<button class="div-chip ${State.divisionId === d.id ? 'on' : ''}" data-act="pick-division" data-div="${d.id}" style="--dc:${d.color}">${esc(d.name)}</button>`).join('')}
        </div>` : ''}`).join('')}
    </div>`;
  }).join('');
  openLayer('pop', `
    <div class="sw-head"><b>Companies</b><small>${shared ? 'Profiles can run several companies side by side' : 'Each company has its own pilot profile'}</small></div>
    <div class="sw-list">${rows}</div>
    <div class="sw-foot">
      <button class="btn ghost" data-act="new-company">${icon('plus')}New company</button>
      <button class="btn ghost" data-act="settings" data-section="profiles">${icon('sliders')}Profiles and divisions</button>
      <button class="btn ghost" data-act="title-open">${icon('back')}Back to the title screen</button>
    </div>`, { cls: 'switcher', anchor: el });
};

ACTIONS['pick-company'] = el => {
  const id = el.getAttribute('data-co');
  closeAll();
  if (id === State.companyId) return;
  Sound.tick(); Haptics.pulse();
  State.companyId = id; State.divisionId = 'all';
  applyCompanyTheme(true);
  go(State.screen);
  renderTopbar();
  toast(`Switched to ${company().name}`, 'ok');
};
ACTIONS['pick-division'] = el => {
  State.divisionId = el.getAttribute('data-div');
  Sound.tick(); closeAll(); refresh();
};
ACTIONS['new-company'] = () => {
  closeAll();
  openLayer('modal', `
    <div class="modal-head"><h2>Start a new company</h2><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
    <div class="modal-body new-co">
      <p class="lede">Pick what kind of operation you want to run. You can mix aircraft sizes later, or keep them in separate companies.</p>
      <div class="choice-grid">
        ${[['major', 'Airline', 'Jets and turboprops on scheduled routes, IFR.', 'a320neo'],
           ['regional', 'Regional and cargo', 'Smaller jets and turboprops, short hops.', 'crj7-aero'],
           ['bush', 'Bush outfit', 'Floatplanes and STOL aircraft, VFR and IFR.', 'dhc2']].map(k => `
          <button class="choice" data-act="create-company" data-kind="${k[0]}">
            <div class="choice-art">${aircraftArt(k[3], { color: '#3FD0E8', color2: '#0D3A4A', ground: false })}</div>
            <b>${k[1]}</b><small>${k[2]}</small></button>`).join('')}
        <button class="choice" data-act="real-airline">
          <div class="choice-art">${aircraftArt('b738-pmdg', { color: '#F2C14E', color2: '#3A2A0A', ground: false })}</div>
          <b>Fly for a real airline</b><small>Join Atlantic Airways, SAS, British Airways, Emirates and many more.</small></button>
      </div>
      <div class="field-row">
        <label class="tg-row"><span><b>Use my main pilot</b><small>Turn off to create a separate pilot profile for this company</small></span>${toggle('nc-pilot', true)}</label>
        <label class="tg-row"><span><b>Add as a division</b><small>Shares money and reputation with ${esc(company().name)}</small></span>${toggle('nc-div', false)}</label>
      </div>
    </div>`, { cls: 'wide' });
};

function applyCompanyTheme(animate?: boolean) {
  const c = company();
  const r = document.documentElement;
  if (animate && !reducedMotion()) { r.classList.add('co-swap'); setTimeout(() => r.classList.remove('co-swap'), 700); }
  r.style.setProperty('--co', c.color);
  r.style.setProperty('--co2', c.color2);
}

/* ---------- Notification inbox ---------- */
const NOTICE_META: { [k: string]: { label: string; icon: string } } = {
  mechanic: { label: 'Mechanic', icon: 'wrench' }, authority: { label: 'Aviation authority', icon: 'shield' },
  flight: { label: 'Flights', icon: 'land' }, finance: { label: 'Finance', icon: 'finance' },
  pilot: { label: 'Pilots', icon: 'pilots' }, company: { label: 'Company', icon: 'info' },
  staff: { label: 'Staff', icon: 'user' }, birthday: { label: 'Birthday', icon: 'info' },
};
let _inboxTab = 'all';

function inboxHtml(): string {
  pruneNotices(); stampNotices(); try { ntApply(); } catch (e) { /* ignore */ }
  const tabs = ['all', 'mechanic', 'staff', 'authority', 'flight', 'pilot', 'finance'];
  // newest first, by when each one really happened
  const list = State.notices.filter(n => _inboxTab === 'all' || n.kind === _inboxTab).slice().sort((a: any, b: any) => (b.at || 0) - (a.at || 0));
  return `
    <div class="drawer-head"><h2>Notifications</h2>
      <button class="text-btn" data-act="mark-read">Mark all read</button>
      <button class="text-btn" data-act="nt-clear">Clear read</button>
      <button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
    <div class="tabs" role="tablist">${tabs.map(t => {
      const n = State.notices.filter(x => !x.read && (t === 'all' || x.kind === t)).length;
      return `<button class="tab ${_inboxTab === t ? 'on' : ''}" data-act="inbox-tab" data-tab="${t}">${t === 'all' ? 'All' : NOTICE_META[t].label}${n ? `<i>${n}</i>` : ''}</button>`;
    }).join('')}</div>
    <div class="notice-list">${list.length ? noticeListHtml(list, (n: any) => `
      <button class="notice ${n.read ? '' : 'unread'} k-${n.kind}" data-act="open-notice" data-id="${n.id}">
        <span class="n-ic">${icon(NOTICE_META[n.kind].icon)}</span>
        <span class="n-t"><b>${esc(n.title)}</b><small>${esc(n.body)}</small></span>
        <span class="n-time" data-at="${(n as any).at || ''}" title="${(n as any).at ? esc(atText((n as any).at)) : ''}">${esc((n as any).at ? receivedText((n as any).at) + ' · ' + agoText((n as any).at) : n.time)}${n.kind === 'pilot' && n.ref && State.live.some(f => f.id === n.ref) ? `<i class="n-map">${icon('pin')}Map</i>` : ''}</span>
      </button>`) : emptyState('Nothing here', 'New messages from your mechanic, pilots and the authorities show up here.')}</div>`;
}

ACTIONS.inbox = () => { Sound.tick(); openLayer('drawer', inboxHtml(), { cls: 'inbox' }); };
// the times keep up while you look ("Now" becomes "1 min ago")
setInterval(() => {
  for (const el of Array.from(document.querySelectorAll('.n-time[data-at], .n-received[data-at]')) as HTMLElement[]) {
    const at = +el.getAttribute('data-at'); if (!at) continue;
    const t = el.classList.contains('n-received') ? `Received ${receivedText(at)} · ${agoText(at)}` : `${receivedText(at)} · ${agoText(at)}`;
    const first = el.firstChild; if (first && first.nodeType === 3 && first.nodeValue !== t) first.nodeValue = t;
  }
}, 20000);
ACTIONS['inbox-tab'] = el => { _inboxTab = el.getAttribute('data-tab'); Sound.tick(); rerenderInbox(); };
ACTIONS['mark-read'] = () => { State.notices.forEach(n => n.read = true); rerenderInbox(); renderTopbar(); };
function rerenderInbox() { const p = $('.layer-drawer.inbox .panel'); if (p) patchHtml(p, inboxHtml()); }

ACTIONS['open-notice'] = el => {
  const n = State.notices.filter(x => x.id === el.getAttribute('data-id'))[0]; if (!n) return;
  n.read = true; rerenderInbox(); renderTopbar(); Sound.tick();
  if ((n as any).tx) ACTIONS['tx-detail']({ getAttribute: () => (n as any).tx } as any, null);
  else if ((n as any).txs) flightsMoneyPopup((n as any).txs);
  else if (n.ref && /^va-/.test(String(n.ref))) vaNoticeOpen(String(n.ref));
  else if (n.ref && /^case-/.test(String(n.ref))) courtPopup(String(n.ref));
  else if (n.ref && /^gift-/.test(String(n.ref))) giftOpenRef(String(n.ref));
  else if (n.ref && /^life-/.test(String(n.ref))) lifeOpen(String(n.ref));
  else if (n.ref && /^inv-/.test(String(n.ref))) invPopup(String(n.ref));
  else if (n.kind === 'mechanic' && n.ref) mechanicPopup(n.ref);
  else if (n.kind === 'authority' && n.ref) finePopup(n.ref);
  else if (n.kind === 'flight' && n.ref && /^scan-/.test(n.ref)) scanPopup(n.ref.slice(5));
  else if (n.kind === 'flight' && n.ref) crashPopup(n.ref);
  else if (n.kind === 'pilot' && n.ref && /^crash3d-/.test(n.ref)) { const e = document.createElement('b'); e.setAttribute('data-apt', n.ref.slice(8)); ACTIONS['crash-3d'](e, null); }
  else if (n.kind === 'pilot' && n.ref && /^cjo-/.test(n.ref)) coopOfferPopup(n.ref);
  else if (n.kind === 'pilot' && n.ref && State.live.some(f => f.id === n.ref)) showFlightOnMap(n.ref);
  else if (n.kind === 'staff' && n.ref === 'badges') { closeAll(); go('ranking'); }
  else if (n.kind === 'staff' && n.ref && /^case-/.test(n.ref)) courtPopup(n.ref);
  else if (n.kind === 'staff' && n.ref && /^fb-/.test(n.ref)) moralePopup(n.ref.slice(3));
  else if (n.kind === 'staff' && n.ref && /^sk-/.test(n.ref)) strikePopup(n.ref.slice(3));
  else if (n.kind === 'staff' && n.ref && /^si-/.test(n.ref)) sickPopup(n.ref.slice(3));
  else if (n.kind === 'staff' && n.ref && /^wb-/.test(n.ref)) whistlePopup();
  else if (n.kind === 'staff' && n.ref && /^ty-/.test(n.ref)) thanksPopup(n.ref);
  else if (n.ref && /^news-/.test(n.ref)) newsOpen(n.ref);
  else if (n.kind === 'staff' && n.ref && /^wo-/.test(n.ref)) warnOutcomePopup(n.id);
  else if (n.kind === 'staff' && n.ref) incidentPopup(n.ref);
  else if (n.kind === 'birthday') ACTIONS['bday-preview'](null, null);
  else {
    // the message, read out by whoever sent it
    const who = noticeSpeaker(n);
    const at = (n as any).at;
    const wrap = openLayer('modal', `<div class="modal-head"><div><h2>${esc(n.title)}</h2>${at ? `<small class="n-received" data-at="${at}">Received ${esc(receivedText(at))} · ${esc(agoText(at))}</small>` : ''}</div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div><div class="modal-body"><p class="lede">${esc(n.body)}</p>
      ${who ? `<div class="say-row">${voiceButton(n.body, who[0], 'Play the message')}${voiceNoteEl(who[1])}</div>` : ''}</div>`, { cls: 'narrow', onClose: () => Voice.stop() });
    if (who) autoSpeak(wrap);
  }
};

/** Who reads a message out: [speaker, their title], or null for messages nobody says (system notes). */
function noticeSpeaker(n: Notice): [string, string] {
  if (n.kind === 'pilot') {
    const f = State.live.filter(x => x.id === n.ref)[0], p: any = f ? pilot(f.pilotId) : (State.pilots as any[]).filter(x => n.body.indexOf(x.name) >= 0 || n.title.indexOf(x.name) >= 0)[0];
    return [personWho('pilot', p), p ? p.name : 'Pilot'];
  }
  if (n.kind === 'mechanic') return ['mechanic', 'Mechanic'];
  if (n.kind === 'authority') return ['authority', 'Aviation authority'];
  if (n.kind === 'finance') return ['finance', 'Finance'];
  if (n.kind === 'staff' || n.kind === 'company' || n.kind === 'flight') return ['ops', 'Head of operations'];
  return null;
}

/* ---------- Mechanic pop-up ---------- */
function mechanicLines(issue: Issue): string {
  const a = plane(issue.reg), t = acType(a.typeId);
  const start = issue.severity === 'grounding'
    ? `I've had a proper look at ${spellReg(issue.reg)}, your ${t.maker} ${t.model}. I'm afraid she's not going anywhere for now.`
    : `Quick word about ${spellReg(issue.reg)}, the ${t.model}.`;
  const mid = `${issue.title}. ${issue.detail}`;
  // the time quoted is the time the hangar really takes (all open reports on the aircraft together)
  const min = issue.status === 'open' ? repairPlanMin(issue.reg) : (issue as any).durMin || 0, n = repairTotal(issue.reg).n;
  const time = min ? `about ${repairTimeText(min)} in the hangar` : 'a quick job, she\'s ready straight after';
  const end = issue.severity === 'grounding'
    ? `It's ${time}${n > 1 ? ' for everything on her' : ''}, and roughly ${money(issue.cost)}. Your call, but she stays grounded until it's done.`
    : `It's ${time}${n > 1 ? ' for everything on her' : ''}, about ${money(issue.cost)}. Fix it now or leave it for later, up to you.`;
  return start + ' ' + mid + ' ' + end;
}
function spellReg(reg: string): string { return reg.replace('-', ' '); }

function mechanicPopup(issueId: string) {
  const issue = State.issues.filter(i => i.id === issueId)[0]; if (!issue) return;
  const a = plane(issue.reg), t = acType(a.typeId), c = company(a.companyId);
  const related = State.issues.filter(i => i.reg === issue.reg && i.status !== 'fixed');
  const speech = mechanicLines(issue);
  const wrap = openLayer('modal', `
    <div class="mech">
      <div class="mech-side">
        <div class="mech-avatar"><span>JH</span><i class="mech-ring"></i></div>
        <b>Jónas Hansen</b><small>Line maintenance, ${esc(a.base)}</small>
        ${voiceButton(speech, 'mechanic', "Play the mechanic's message")}
        ${voiceNoteEl()}
      </div>
      <div class="mech-main">
        <div class="modal-head"><h2>${esc(issue.reg)}: ${esc(issue.title)}</h2><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
        <div class="mech-plane">${aircraftArt(a.typeId, { color: c.color, color2: c.color2, reg: a.reg })}${issue.severity === 'grounding' ? '<span class="ground-stamp">Grounded</span>' : ''}</div>
        <p class="speech">${esc(speech)}</p>
        <div class="issue-list">${related.map(i => `
          <div class="issue-row ${i.id === issue.id ? 'cur' : ''}">
            ${statusChip(i.severity)}<b>${esc(i.title)}</b><small>${esc(i.source)}</small>
            <span class="ir-cost">${money(i.cost)}</span><span class="ir-days">${i.status === 'open' ? (repairPlanMin(i.reg, [i]) ? repairTimeText(repairPlanMin(i.reg, [i])) : 'At once') : 'Paid'}</span>
          </div>`).join('')}</div>
        ${issue.status === 'open' ? `<div class="modal-actions">
          <button class="btn ghost" data-act="fix-later" data-id="${issue.id}">Fix later</button>
          <button class="btn danger" data-act="fix-now" data-id="${issue.id}">${icon('wrench')}${repairTotal(issue.reg).n > 1 ? `Pay ${money(repairTotal(issue.reg).cost)} and fix all ${repairTotal(issue.reg).n}` : `Pay ${money(repairTotal(issue.reg).cost)} and fix now`}</button>
        </div>${repairPartsNote(issue.reg)}` : `<div class="paid-note">${icon('check')}<span><b>Paid${(issue as any).paidAt ? ' ' + esc(dateStr(new Date((issue as any).paidAt))) : ''}</b><small>${issue.status === 'fixed' ? 'Repaired' : a.status === 'flying' ? 'The repair starts when it lands' : 'Being repaired: ' + Math.max(1, Math.ceil(((issue as any).startedAt + (issue as any).durMin * 60000 - Date.now()) / 60000)) + ' min left'}</small></span>
          <button class="btn ghost" data-act="close-layer">Close</button></div>`}
        ${issue.severity === 'grounding' ? `<p class="fine-print">${icon('alert')}Grounding damage: ${esc(issue.reg)} can't be flown until this is repaired.</p>` : ''}
      </div>
    </div>`, { cls: 'wide mech-pop', onClose: () => Voice.stop() });
  autoSpeak(wrap);
}

/** In a dialogue that just opened, the person starts talking (when voices are on). */
function autoSpeak(wrap: HTMLElement) {
  if (!State.settings.mechanicVoice || State.settings.muteAll || (State.settings as any).autoVoice !== true) return;
  // everyone in the dialogue speaks in turn, like a conversation
  const turn = (i: number) => {
    if (!wrap || !wrap.isConnected) return;
    const bs = Array.from(wrap.querySelectorAll('.voice-btn')) as HTMLElement[], b = bs[i]; if (!b) return;
    Voice.stop(); b.setAttribute('data-playing', '1');
    Voice.speak(b.getAttribute('data-say') || '', () => { b.setAttribute('data-playing', '0'); voiceUiChanged(); setTimeout(() => turn(i + 1), 350); }, b.getAttribute('data-who') || 'mechanic');
    voiceUiChanged();
  };
  setTimeout(() => { if (!Voice.speaking) turn(0); }, 650);
}

ACTIONS['fix-now'] = el => {
  const i = State.issues.filter(x => x.id === el.getAttribute('data-id'))[0]; if (!i) return;
  const a = plane(i.reg), c = company(a.companyId);
  // one payment repairs everything reported on this aircraft, and it is ready to fly straight away
  const open = State.issues.filter(x => x.reg === i.reg && x.status === 'open');
  // a report is paid once: after that the repair carries on and there is nothing more to pay
  if (!open.length) { closeAll(); toast('Already paid. The mechanic is on it.', 'info'); return; }
  // spare parts: from your stores first (already paid for); what's missing is ordered at the day's price, with a
  // rush charge, and the aircraft waits for it
  const P = repairParts(i.reg, open), taken = partsFromStock(a.companyId, P.need), missing = P.need - taken;
  open.forEach(x => { (x as any).partsMiss = P.miss; });
  const cost = Math.max(0, open.reduce((t, x) => t + x.cost, 0) - P.need + Math.round(missing * marketIdx('parts') * 1.15));
  const from = c.balance; c.balance -= cost;
  const ids: { [k: string]: boolean } = {}; open.forEach(x => { ids[x.id] = true; (x as any).paidAt = Date.now(); });
  State.notices = State.notices.filter(n => !(n.kind === 'mechanic' && ids[n.ref]));
  repairAll(i.reg);
  if (cost) State.txns.unshift({ id: uid(), companyId: a.companyId, date: dateStr(new Date()).slice(0, 10), time: new Date().toTimeString().slice(0, 5), label: `Repair: ${open.map(x => x.title).join(', ')} (${i.reg})`, amount: -cost, kind: 'maint', reg: i.reg,
    lines: [['Labour', -Math.round(open.reduce((t, x) => t + x.cost, 0) * 0.45)], taken ? [`Parts from your stores (${money(taken, { compact: true })}, already paid)`, 0] : null, missing ? ['Parts ordered, with a rush charge', -Math.round(missing * marketIdx('parts') * 1.15)] : null].filter(Boolean) as any, note: open.map(x => x.detail).join(' '), link: { kind: 'aircraft', id: i.reg } } as any);
  try { Bank.claim(i.reg, open); } catch (e) { /* ignore */ }
  Voice.stop(); closeAll(); Sound.payOut(); Haptics.pulse(30); Store.save(); refresh(); animateBalance(from, c.balance);
  toast(a.status === 'flying' ? `${i.reg} goes into the hangar when it lands` : a.status !== 'maintenance' ? `${i.reg} is repaired and ready for its next flight` : `${i.reg} is in the hangar: ${(i as any).durMin} minutes of work${open.length > 1 ? ' on ' + open.length + ' reports' : ''}`, 'ok');
};
/** What fixing an aircraft costs: all its open reports together. */
/** What fixing everything open on an aircraft costs now: labour, plus the parts not in your stores (ordered with a rush charge). */
function repairTotal(reg: string): { n: number; cost: number; parts: { need: number; have: number; miss: number } } {
  const open = State.issues.filter(x => x.reg === reg && x.status === 'open'), P = repairParts(reg, open);
  const missing = P.need - P.have;
  return { n: open.length, cost: Math.max(0, open.reduce((t, x) => t + x.cost, 0) - P.need + Math.round(missing * marketIdx('parts') * 1.15)), parts: P };
}
/** The mechanic's word on parts: in stock, or to be ordered (and the wait). */
function repairPartsNote(reg: string): string {
  const R = repairTotal(reg), P = R.parts; if (!P.need) return '';
  return P.miss < 0.01 ? `<p class="fine-print">${icon('check')}The parts are in your stores (${money(P.need, { compact: true })}, already paid for): you pay for the work only.</p>`
    : `<p class="fine-print">${icon('alert')}${P.have ? `Only ${money(P.have, { compact: true })} of the ${money(P.need, { compact: true })} in parts is in your stores` : 'The parts aren\'t in your stores'}: the rest is ordered at today's price with a rush charge, and the aircraft waits for it (the repair takes about ${Math.round(P.miss * 80)}% longer). Stock up on spare parts in Finance → Markets.</p>`;
}
ACTIONS['fix-later'] = el => {
  const i = State.issues.filter(x => x.id === el.getAttribute('data-id'))[0];
  Voice.stop(); closeAll(); refresh();
  toast(i && i.severity === 'grounding' ? `${i.reg} stays grounded until it's repaired` : 'Saved to maintenance for later', i && i.severity === 'grounding' ? 'warn' : 'info');
};

/* ---------- Aviation authority fine ---------- */
function finePopup(ref: string) {
  const f = State.fines[ref]; if (!f) return;
  openLayer('modal', `
    <div class="modal-head authority"><span class="auth-seal">${icon('shield')}</span><div><h2>${esc(f.title)}</h2><small>${esc(f.authority)}, flight ${esc(f.flight)} (${esc(f.reg)}), ${esc(f.airport)} runway ${esc(f.runway)}</small></div>
      <button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
    <div class="modal-body fine">
      <div class="fine-amt"><small>Fine</small><b>${money(f.amount)}</b></div>
      <div class="transcript"><small class="tr-h">ATC transcript (${State.settings.atcSource === 'beyondatc' ? 'BeyondATC audio' : 'built-in ATC'})</small>
        ${f.transcript.map((l: any) => `<div class="tr-line w-${l.who.toLowerCase()}"><time>${esc(l.t)}</time><b>${esc(l.who === 'SYS' ? 'Detected' : l.who)}</b><span>${esc(l.text)}</span></div>`).join('')}
      </div>
      <div class="say-row">${voiceButton(`This is ${f.authority}. ${f.title}, flight ${f.flight}, ${f.reg}, at ${f.airport}, runway ${f.runway}. The fine is ${money(f.amount)}. If you believe the transcript is wrong, you may contest it.`, 'authority', 'Play the authority\'s message')}${voiceNoteEl(f.authority)}</div>
      <p class="fine-print">${icon('info')}If the transcript is wrong, contest the fine and it's removed from your record.</p>
      <div class="modal-actions">
        <button class="btn ghost" data-act="fine-contest" data-ref="${ref}">Contest</button>
        <button class="btn danger" data-act="fine-pay" data-ref="${ref}">Accept and pay ${money(f.amount)}</button>
      </div>
    </div>`, { cls: 'narrow', onClose: () => Voice.stop() });
}
ACTIONS['fine-pay'] = el => {
  const ref = el.getAttribute('data-ref'); const f = State.fines[ref]; if (!f) return;
  const c = company(), from = c.balance;
  c.balance -= f.amount;
  State.txns.unshift({ id: uid(), companyId: c.id, date: dateStr(new Date()).slice(0, 10), time: new Date().toTimeString().slice(0, 5), label: `Fine: ${f.title.toLowerCase()} (${f.flight})`, amount: -f.amount, kind: 'fine', reg: f.reg, flight: f.flight,
    route: f.airport + ' runway ' + f.runway, lines: [[f.authority, -f.amount]] });
  delete State.fines[ref];
  State.notices = State.notices.filter(n => n.ref !== ref);
  closeAll(); Sound.payOut(); Haptics.pulse(40); refresh(); animateBalance(from, c.balance);
  toast(`Fine paid: ${money(f.amount)}`, 'warn');
};
ACTIONS['fine-contest'] = el => {
  const ref = el.getAttribute('data-ref');
  delete State.fines[ref];
  State.notices = State.notices.filter(n => n.ref !== ref);
  closeAll(); Sound.tick(); refresh();
  toast('Fine contested and removed from your record', 'ok');
};

/* ---------- Crash: register or disregard ---------- */
/** How bad it was, worked out from the impact: the damage, the parts hit, the injured and the dead, and what it costs.
 *  The same flight always gives the same answer (it is seeded from the flight). */
function crashAssess(l: any): { level: 'minor' | 'substantial' | 'destroyed'; label: string; salvage: boolean; parts: string[]; injured: number; dead: number; cost: number; days: number; value: number } {
  if (l.crash) return l.crash;
  const a = plane(l.reg), t = a ? acType(a.typeId) : null, fpm = Math.abs(l.landingFpm || 0), g = l.g || 0, pax = l.pax || 0;
  let seed = 0; for (const ch of String(l.id)) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const cause = String(l.notes || '').toLowerCase();
  const sev = Math.max((fpm - 600) / 1400, (g - 2) / 3, /terrain|stall|spin|water|cfit|fire/.test(cause) ? 1.1 : 0);
  const level = sev >= 1 ? 'destroyed' : sev >= 0.45 ? 'substantial' : 'minor';
  const parts: string[] = [];
  if (level === 'minor') { parts.push(rnd() < 0.6 ? 'Nose gear' : 'Main gear'); if (rnd() < 0.5) parts.push('Wing tip'); if (rnd() < 0.4) parts.push('Flaps'); }
  else if (level === 'substantial') { parts.push('Main gear'); if (rnd() < 0.7) parts.push('Nose gear'); parts.push(rnd() < 0.5 ? 'Engine' : 'Engine mounts'); if (rnd() < 0.6) parts.push('Wing'); parts.push('Lower fuselage'); if (rnd() < 0.3) parts.push('Fire'); }
  else { parts.push('Fuselage broken', 'Wings', 'Engines', 'Landing gear', 'Tail'); if (rnd() < 0.7) parts.push('Fire'); }
  const dead = level === 'destroyed' ? Math.round(pax * (0.15 + 0.7 * Math.min(1, sev - 1 + rnd() * 0.6))) : level === 'substantial' && rnd() < 0.15 ? 1 + Math.floor(rnd() * 3) : 0;
  const injured = Math.min(pax - dead, Math.round(pax * (level === 'minor' ? rnd() * 0.08 : level === 'substantial' ? 0.15 + rnd() * 0.3 : 0.5 + rnd() * 0.4)));
  const value = Math.round(((t && (t as any).price) || 4e7) * 0.6);
  const salvage = level !== 'destroyed';
  const cost = salvage ? Math.round(value * (level === 'minor' ? 0.02 + rnd() * 0.03 : 0.12 + rnd() * 0.18) / 1000) * 1000 : 0;
  const days = level === 'minor' ? 3 + Math.floor(rnd() * 5) : level === 'substantial' ? 20 + Math.floor(rnd() * 40) : 0;
  const label = level === 'minor' ? 'Minor damage, repairable' : level === 'substantial' ? 'Substantial structural damage, repairable at a cost' : 'Destroyed: a total loss (written off)';
  l.crash = { level, label, salvage, parts, injured, dead, cost, days, value };
  return l.crash;
}
function crashPopup(logId: string) {
  const l = State.logbook.filter(x => x.id === logId)[0]; if (!l) return;
  const a = plane(l.reg), c = company(a.companyId), d = crashAssess(l);
  const ppl = d.dead ? `${d.dead} ${d.dead === 1 ? 'person' : 'people'} died, ${d.injured} injured` : d.injured ? `No one died, ${d.injured} injured` : 'No one died or was hurt';
  const say = `${l.reg} has crashed on the flight from ${l.from} to ${l.to}, at ${num(Math.abs(l.landingFpm))} feet per minute and ${l.g.toFixed(1)} g, with ${l.pax} passengers on board. ${d.label}. Damaged: ${d.parts.join(', ')}. ${ppl}. ${d.salvage ? `The repair is estimated at ${money(d.cost)} and ${d.days} days.` : 'The aircraft cannot be repaired.'} You need to decide whether to register the crash or disregard it.`;
  openLayer('modal', `
    <div class="modal-head crash"><span class="crash-ic">${icon('alert')}</span><div><h2>Crash detected</h2><small>${esc(l.from)} to ${esc(l.to)}, ${esc(l.reg)}, ${esc(l.date)}</small></div>
      <button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
    <div class="modal-body">
      <div class="crash-art">${aircraftArt(a.typeId, { color: c.color, color2: c.color2, reg: a.reg })}</div>
      <div class="kv-row">
        <div><small>Vertical speed</small><b class="red">${num(l.landingFpm)} fpm</b></div>
        <div><small>Impact load</small><b class="red">${l.g.toFixed(1)} g</b></div>
        <div><small>Passengers</small><b>${l.pax}</b></div>
        <div><small>Cause</small><b>${esc(l.notes || 'Impact')}</b></div>
      </div>
      <div class="crash-dmg">
        <div><small>Damage</small><b class="${d.level === 'minor' ? '' : 'red'}">${esc(d.label)}</b></div>
        <div><small>People</small><b class="${d.dead ? 'red' : ''}">${esc(ppl)}</b></div>
        <div><small>${d.salvage ? 'Repair' : 'Loss'}</small><b>${d.salvage ? `${money(d.cost)}, ${d.days} days` : `${money(d.value)} aircraft lost`}</b></div>
      </div>
      <small>Damaged parts</small><div class="crash-parts">${d.parts.map(x => `<span>${esc(x)}</span>`).join('')}</div>
      <div class="say-row">${voiceButton(say, 'ops', 'Play the report')}${voiceNoteEl('Head of operations')}
        <button class="btn ghost sm" data-act="crash-see" data-id="${l.id}">${icon('focus')} See the damage</button></div>
      <div class="decide">
        <button class="decide-card bad" data-act="crash-decide" data-id="${l.id}" data-d="registered">
          <b>Register crash</b><small>Goes on your record. ${d.salvage ? `Insurance covers part of the repair, reputation drops and ${esc(l.reg)} is out of service.` : `${esc(l.reg)} is written off; insurance pays part of its value.`}${d.dead || d.level === 'destroyed' ? ' It will be in the news.' : ''}</small></button>
        <button class="decide-card" data-act="crash-decide" data-id="${l.id}" data-d="disregarded">
          <b>Disregard</b><small>As if it never happened. The flight is voided, so it earns no hours or pay.</small></button>
      </div>
    </div>`, { cls: 'wide', onClose: () => Voice.stop() });
}
/** The crash site in 3D: the aircraft where it came to rest, with the parts that broke. */
function crashSiteFor(l: any) {
  const a = plane(l.reg), d = crashAssess(l);
  try { crashSiteAdd({ key: l.id, c: company(a.companyId), typeId: a.typeId, reg: a.reg, to: l.to, dead: d.dead > 0, level: d.level === 'destroyed' ? 'destroyed' : 'damaged', parts: d.parts.map(p => p.toLowerCase()) }); } catch (e) { /* no 3D */ }
}
ACTIONS['crash-see'] = el => {
  const l: any = State.logbook.filter(x => x.id === el.getAttribute('data-id'))[0]; if (!l) return;
  crashSiteFor(l); const e = document.createElement('b'); e.setAttribute('data-apt', l.to); ACTIONS['crash-3d'](e, null);
};
ACTIONS['crash-decide'] = el => {
  const l: any = State.logbook.filter(x => x.id === el.getAttribute('data-id'))[0]; if (!l) return;
  l.decision = el.getAttribute('data-d') as any;
  const a = plane(l.reg), d = crashAssess(l);
  if (l.condBefore == null) l.condBefore = a.condition;
  if (l.decision === 'registered') {
    a.status = 'grounded'; a.condition = d.level === 'minor' ? 45 : 12;
    const co = company(a.companyId);
    if (d.salvage) {
      State.issues.unshift({ id: uid(), reg: a.reg, title: d.level === 'minor' ? 'Crash damage' : 'Structural crash damage', detail: `Damaged in the crash: ${d.parts.join(', ')}. ${d.level === 'minor' ? 'Repair before the next flight.' : 'Major structural repair needed before the next flight.'}`, source: 'Crash registered by you', severity: 'grounding', cost: d.cost, days: d.days, status: 'open', date: dateStr(new Date()).slice(0, 10) });
    } else {
      try { courtWriteOff(a, { reg: a.reg } as any); } catch (e) { a.status = 'grounded'; }
    }
    co.reputation -= d.level === 'minor' ? 3 : d.level === 'substantial' ? 6 : 12 + Math.min(20, d.dead);
    crashSiteFor(l);
    if (d.dead || d.level === 'destroyed') {
      try { setTimeout(() => newsCrash({ key: l.id, c: co, typeId: a.typeId, reg: a.reg, callsign: l.callsign, from: l.from, to: l.to, pax: l.pax, dead: d.dead > 0, cause: d.dead ? `${d.dead} ${d.dead === 1 ? 'person' : 'people'} died and ${d.injured} were injured. ${d.salvage ? 'The aircraft was badly damaged.' : 'The aircraft was destroyed.'}` : undefined }), 4000); } catch (e) { /* ignore */ }
    }
    // the accident investigation board looks into every registered crash (investigation.ts)
    try { investigationOpen({ key: l.id, cid: co.id, reg: a.reg, typeId: a.typeId, from: l.from, to: l.to, pax: l.pax || 0, dead: d.dead, injured: d.injured, level: d.level, parts: d.parts, you: true, notes: l.notes, fpm: l.landingFpm, g: l.g, cond: l.condBefore != null ? l.condBefore : a.condition, issues: (State.issues as any[]).filter(i => i.reg === a.reg && i.status === 'open' && i.title.indexOf('rash') < 0).map(i => i.title) }); } catch (e) { /* no investigation */ }
  } else {
    try { const list = crashSites(); const i = list.findIndex(c => c.id === l.id); if (i >= 0) { list.splice(i, 1); Store.save(); } } catch (e) { /* none */ }
  }
  State.notices = State.notices.filter(n => n.ref !== l.id);
  closeAll(); Haptics.pulse(30); refresh();
  toast(l.decision === 'registered' ? (d.salvage ? 'Crash registered. The mechanic has opened a repair job.' : `Crash registered. ${l.reg} is written off.`) : 'Crash disregarded. Flight voided.', l.decision === 'registered' ? 'warn' : 'ok');
};

/* ---------- Toggle markup (shared with Settings) ---------- */
function toggle(key: string, on: boolean): string {
  return `<button class="tg ${on ? 'on' : ''}" role="switch" aria-checked="${on}" data-act="toggle" data-key="${key}"><i></i></button>`;
}

ACTIONS['create-company'] = el => {
  const kind = el.getAttribute('data-kind') as any;
  const ownPilot = !($('.tg[data-key=nc-pilot]') && !$('.tg[data-key=nc-pilot]').classList.contains('on'));
  const asDivision = !!($('.tg[data-key=nc-div]') && $('.tg[data-key=nc-div]').classList.contains('on'));
  const cur = company();
  closeAll();
  if (asDivision) {
    cur.divisions.push({ id: uid(), name: kind === 'bush' ? 'Bush' : kind === 'regional' ? 'Regional' : 'Division ' + (cur.divisions.length + 1), color: '#5FD4A0' });
    Store.save(); renderTopbar(); toast(`New division added to ${cur.name}`, 'ok'); try { newsDivision(cur, cur.divisions[cur.divisions.length - 1].name); } catch (e) { /* ignore */ } return;
  }
  const make = (profileId: string, hub?: string) => {
    if (!hub) { openBasePicker('Home base for the new company', 'Required: where the company is based, its aircraft delivered and its hub crew work.', icao => make(profileId, icao)); return; }
    State.pilots.filter((x: any) => x.profileId === profileId && x.you && !x.landings).forEach((x: any) => x.base = hub);   // a new pilot starts at the new home base
    const names: any = { major: ['Northern Lights Air', 'NLA', '#3FB6A8'], regional: ['Fjord Regional', 'FJR', '#E2A23B'], bush: ['Tundra Wings', 'TWG', '#D2553A'] };
    const n = names[kind] || names.major;
    const id = uid();
    State.companies.push({ id, profileId, name: n[0], icao: n[1], callsign: n[0].split(' ')[0].toUpperCase(), hub, color: n[2], color2: '#1A2433',
      balance: kind === 'bush' ? 1500000 : 25000000, reputation: 50, founded: dateStr(new Date()).slice(0, 10), kind, divisions: [] } as any);
    (State as any).coPilot[id] = { sex: 'f', id: '' };
    State.companyId = id; State.divisionId = 'all';
    applyCompanyTheme(true); Store.save(); go('ops'); renderTopbar();
    try { newsFounded(id, 'new'); } catch (e) { /* ignore */ }
    toast(`${n[0]} founded. Buy your first aircraft and hire a mechanic to start flying.`, 'ok');
  };
  if (ownPilot) { make(profileOfCompany(cur.id).id); return; }
  // a separate pilot profile: create the pilot first
  const look = defaultLook('m', 'captain');
  openLookEditor({ title: 'Create your pilot', role: 'captain', look, identity: { name: 'Capt. New Pilot', dob: '1990-06-15', nat: 'FO' },
    onAccept: (lk, idt) => {
      const pid = 'you-' + uid(), prid = 'p-' + uid();
      State.pilots.push({ id: pid, name: idt.name, rank: 'Captain', hoursMin: 0, landings: 0, base: kind === 'bush' ? 'PALH' : 'EKVG', you: true, profileId: prid, status: 'standby', types: [], rating: 4,
        sex: lk.sex, look: lk, dob: idt.dob, nat: idt.nat, lookAccepted: true } as any);
      State.profiles.push({ id: prid, pilotId: pid, label: 'Profile ' + (State.profiles.length + 1) });
      make(prid);
    } });
};

ACTIONS['real-airline'] = () => realAirlinePicker();
