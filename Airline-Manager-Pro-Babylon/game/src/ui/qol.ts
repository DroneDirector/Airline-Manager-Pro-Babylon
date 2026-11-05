// Comfort: search everything, "while you were away", remembering where you were, sorting and filtering
// lists, undo, notification settings and quiet hours, swipe gestures, battery saver, keyboard shortcuts,
// text size and reduced motion, the first-run tour and screen tips, and exporting logs and finances.

function qs(): any { return State.settings as any; }

/* ---------- search everything ---------- */
interface SrchHit { kind: string; title: string; sub: string; go: () => void }
let _srch: SrchHit[] = [], _srchSel = 0;
const SCREEN_WORDS: { [k: string]: string } = { ops: 'overview home', fleet: 'aircraft planes', routes: 'network', jobs: 'charters tours', schedule: 'timetable', dispatch: 'weather simbrief plan', maint: 'maintenance repairs mechanic', finance: 'money bank loans markets fuel', logbook: 'flight logs history', pilots: 'crew staff hire', ranking: 'badges league awards', career: 'profile licence', news: 'newspaper', coop: 'multiplayer co-op', map: 'world map', market: 'buy aircraft' };
function searchAll(q: string): SrchHit[] {
  const toks = q.toLowerCase().split(/\s+/).filter(Boolean); if (!toks.length) return [];
  const hit = (s: string) => { const l = s.toLowerCase(); return toks.every(t => l.indexOf(t) >= 0); };
  const out: SrchHit[] = [], c = company(), add = (h: SrchHit, text: string) => { if (hit(text)) out.push(h); };
  Object.keys(SCREENS).forEach(k => SCREENS[k].title && add({ kind: 'Screen', title: SCREENS[k].title, sub: 'Open', go: () => go(k) }, SCREENS[k].title + ' ' + (SCREEN_WORDS[k] || '')));
  SETTINGS.forEach(s => add({ kind: 'Settings', title: s.title, sub: 'Settings', go: () => ACTIONS.settings({ getAttribute: () => s.id } as any, null) }, 'settings ' + s.title + ' ' + s.items.map((i: any) => (i.label || '') + ' ' + (i.hint || '')).join(' ')));
  State.fleet.filter(a => a.companyId === c.id).forEach(a => { const t = acType(a.typeId); add({ kind: 'Aircraft', title: a.reg, sub: `${t.maker} ${t.model} · ${a.status} · ${a.location}`, go: () => { go('fleet'); ACTIONS['ac-detail']({ getAttribute: () => a.reg } as any, null); } }, `${a.reg} ${t.maker} ${t.model} ${a.location}`); });
  (State.pilots as any[]).filter(p => !p.you && (p.companyId === c.id || String(p.companyId || '').indexOf('coop:') === 0)).forEach(p => add({ kind: 'Pilot', title: p.name, sub: `${p.rank || 'Pilot'} · ${p.base || ''}`, go: () => ACTIONS['staff-detail']({ getAttribute: () => p.id } as any, null) }, p.name + ' pilot ' + (p.base || '')));
  try { staffOf(c.id).forEach((p: any) => add({ kind: p.role === 'fa' ? 'Cabin crew' : p.role === 'mech' ? 'Mechanic' : 'Ground staff', title: p.name, sub: p.base || '', go: () => ACTIONS['staff-detail']({ getAttribute: () => p.id } as any, null) }, p.name + ' ' + (p.role === 'fa' ? 'cabin crew flight attendant' : p.role === 'mech' ? 'mechanic' : 'ground'))); } catch (e) { /* ignore */ }
  State.routes.filter(r => r.companyId === c.id).forEach(r => add({ kind: 'Route', title: r.code, sub: r.legs.join(' → '), go: () => { go('routes'); setTimeout(() => ACTIONS['route-detail']({ getAttribute: () => r.id } as any, null), 200); } }, r.code + ' ' + r.legs.join(' ') + ' route'));
  State.live.forEach((f: any) => { if (f.tfc) return; add({ kind: 'Flight', title: f.callsign || f.reg, sub: `${f.from} → ${f.to} · ${f.phase || 'in the air'}`, go: () => showFlightOnMap(f.id) }, `${f.callsign} ${f.reg} ${f.from} ${f.to} flight`); });
  State.logbook.slice(0, 300).forEach(l => add({ kind: 'Flight log', title: `${l.from} → ${l.to}`, sub: `${String(l.date).slice(0, 16)} · ${l.reg}`, go: () => { go('logbook'); ACTIONS['log-open']({ getAttribute: () => l.id } as any, null); } }, `${l.from} ${l.to} ${l.reg} ${l.date} log`));
  try { newsList().slice(0, 200).forEach((n: any) => add({ kind: 'News', title: n.headline, sub: String(n.place || ''), go: () => newsOpen(n.id) }, n.headline + ' ' + (n.standfirst || '') + ' news')); } catch (e) { /* ignore */ }
  // airports: ICAO, name or city
  const seen: { [k: string]: 1 } = {};
  const apts = (Object.keys(AIRPORTS).map(k => AIRPORTS[k]) as any[]).concat(World.ready && q.length >= 3 ? (World.list as any[]) : []);
  for (const A of apts) { if (!A || !A.icao || seen[A.icao]) continue; if (hit(`${A.icao} ${A.name || ''} ${A.city || ''}`)) { seen[A.icao] = 1; out.push({ kind: 'Airport', title: A.icao, sub: `${A.name || ''}${A.city ? ', ' + A.city : ''}`, go: () => { try { registerWorldAirport(A.icao); } catch (e) { /* ignore */ } openAirportView(A.icao); } }); if (Object.keys(seen).length >= 12) break; } }
  const rank: { [k: string]: number } = { Screen: 0, Aircraft: 1, Pilot: 2, Flight: 3, Route: 4, Airport: 5, 'Cabin crew': 6, Mechanic: 6, 'Ground staff': 6, 'Flight log': 7, News: 8, Settings: 9 };
  return out.sort((a, b) => (rank[a.kind] || 5) - (rank[b.kind] || 5)).slice(0, 40);
}
ACTIONS['search-open'] = () => {
  _srch = []; _srchSel = 0;
  openLayer('modal', `<div class="srch-box">${icon('search')}<input class="srch-in" placeholder="Search aircraft, pilots, airports, routes, flights, news, settings" autocomplete="off" spellcheck="false"><kbd>Esc</kbd></div><div class="srch-res"><p class="muted pad">Type to search everything in the app.</p></div>`, { cls: 'search-pop' });
  const i = $('.srch-in') as HTMLInputElement; if (!i) return;
  setTimeout(() => i.focus(), 30);
  i.addEventListener('input', () => { _srch = searchAll(i.value); _srchSel = 0; srchRender(); });
  i.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { _srchSel = Math.min(_srch.length - 1, _srchSel + 1); srchRender(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { _srchSel = Math.max(0, _srchSel - 1); srchRender(); e.preventDefault(); }
    else if (e.key === 'Enter' && _srch[_srchSel]) { const h = _srch[_srchSel]; closeAll(); h.go(); }
  });
};
function srchRender() {
  const box = $('.srch-res'); if (!box) return;
  box.innerHTML = _srch.length ? _srch.map((h, i) => `<button class="srch-r ${i === _srchSel ? 'on' : ''}" data-act="srch-go" data-i="${i}"><em>${esc(h.kind)}</em><b>${esc(h.title)}</b><small>${esc(h.sub)}</small></button>`).join('') : '<p class="muted pad">Nothing found.</p>';
  const on = box.querySelector('.srch-r.on') as HTMLElement; if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest' });
}
ACTIONS['srch-go'] = el => { const h = _srch[+el.getAttribute('data-i')]; if (!h) return; closeAll(); Sound.tick(); h.go(); };

/* ---------- while you were away ---------- */
const AWAY_KEY = 'amp-away';
function awayMark() { try { localStorage.setItem(AWAY_KEY, JSON.stringify({ at: Date.now(), bal: company().balance, cid: State.companyId, coop: Mode.coop() })); } catch (e) { /* ignore */ } }
function awayCheck() {
  let a: any = null; try { a = JSON.parse(localStorage.getItem(AWAY_KEY) || 'null'); } catch (e) { /* none */ }
  awayMark();
  if (!a || a.cid !== State.companyId || a.coop !== Mode.coop() || Date.now() - a.at < 3 * 3600e3 || qs().awayCard === false) return;
  const since = a.at, c = company(), mine = (cid: string) => cid === c.id;
  const landed = Ratings.list().filter((r: any) => r.at > since).length + State.logbook.filter((l: any) => _logTime(l) > since && l.coopBy).length;
  const money0 = c.balance - (a.bal || c.balance);
  const notes = State.notices.filter((n: any) => (n.at || 0) > since);
  const problems = notes.filter((n: any) => n.kind === 'mechanic' || n.kind === 'authority' || /grounded|strike|court|missed an important|crash|denied|warning/i.test(n.title));
  const awards = notes.filter((n: any) => /Airline of the|Pilot of the Month|Badge|award/i.test(n.title));
  const open = State.issues.filter(i => i.status === 'open' && plane(i.reg) && mine(plane(i.reg).companyId)).length;
  const hrs = Math.round((Date.now() - since) / 3600e3);
  if (!landed && !notes.length && !money0) return;
  const row = (ic: string, b: string, s: string, act?: string, data?: string) => `<div class="away-row" ${act ? `data-act="${act}" ${data ? `data-screen="${data}"` : ''} role="button" tabindex="0"` : ''}>${icon(ic)}<span><b>${b}</b><small>${s}</small></span></div>`;
  openLayer('modal', `<div class="modal-head"><div><h2>While you were away</h2><small>${hrs >= 48 ? Math.round(hrs / 24) + ' days' : hrs + ' hours'} · ${esc(c.name)}</small></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
    <div class="modal-body"><div class="away">
      ${row('land', `${num(landed)} flight${landed === 1 ? '' : 's'} landed`, 'Flown by your pilots while the app was closed.', 'away-go', 'logbook')}
      ${row('finance', `${money(money0, { sign: true, compact: true })}`, money0 >= 0 ? 'More in the bank than when you left.' : 'Less in the bank than when you left: see Finance.', 'away-go', 'finance')}
      ${problems.length || open ? row('alert', `${problems.length} thing${problems.length === 1 ? '' : 's'} that need${problems.length === 1 ? 's' : ''} you`, `${problems.slice(0, 3).map((n: any) => esc(n.title)).join(' · ')}${open ? `${problems.length ? ' · ' : ''}${open} open repair${open === 1 ? '' : 's'}` : ''}`, 'away-inbox') : ''}
      ${awards.length ? row('trophy', `${awards.length} award${awards.length === 1 ? '' : 's'}`, awards.slice(0, 3).map((n: any) => esc(n.title)).join(' · '), 'away-inbox') : ''}
      ${row('bell', `${notes.length} new message${notes.length === 1 ? '' : 's'}`, 'In your notifications.', 'away-inbox')}
    </div><div class="modal-actions"><button class="btn primary" data-act="close-layer">Carry on</button></div></div>`, { cls: 'narrow away-pop' });
}
ACTIONS['away-go'] = el => { closeAll(); go(el.getAttribute('data-screen')); };
ACTIONS['away-inbox'] = () => { closeAll(); ACTIONS.inbox(null, null); };

/* ---------- remembering where you were ---------- */
const UI_KEY = 'amp-ui';
function uiMemSave() {
  const v: any = $('#view');
  const m = { screen: State.screen, scroll: v ? v.scrollTop : 0, tabs: { _inboxTab, _mktTab, _coopWho, _carTab, _npSec, _coopTab, _fleetFilter, _txFilter, _pilotTab, _hireJob, _mkMode, _jobsTab, _rkGroup, _rkWho, _rkJob }, coop: Mode.coop() };
  try { localStorage.setItem(UI_KEY, JSON.stringify(m)); } catch (e) { /* ignore */ }
}
function uiMemRestore() {
  let m: any = null; try { m = JSON.parse(localStorage.getItem(UI_KEY) || 'null'); } catch (e) { /* none */ }
  if (!m || !m.tabs || m.coop !== Mode.coop() || qs().rememberUi === false) return null;
  const t = m.tabs, s = (v: any, d: any) => v == null ? d : v;
  _inboxTab = s(t._inboxTab, _inboxTab); _mktTab = s(t._mktTab, _mktTab); _coopWho = s(t._coopWho, _coopWho); _carTab = s(t._carTab, _carTab); _npSec = s(t._npSec, _npSec);
  _coopTab = s(t._coopTab, _coopTab); _fleetFilter = s(t._fleetFilter, _fleetFilter); _txFilter = s(t._txFilter, _txFilter); _pilotTab = s(t._pilotTab, _pilotTab); _hireJob = s(t._hireJob, _hireJob);
  _mkMode = s(t._mkMode, _mkMode); _jobsTab = s(t._jobsTab, _jobsTab); _rkGroup = s(t._rkGroup, _rkGroup); _rkWho = s(t._rkWho, _rkWho); _rkJob = s(t._rkJob, _rkJob);
  return m;
}

/* ---------- sorting and filtering lists ---------- */
type SortOpt<T> = [string, string, (a: T, b: T) => number];
const _listQ: { [k: string]: string } = {};
function sortPref(key: string, def: string): { by: string; dir: number } { const S = qs(); S.sorts = S.sorts || {}; return S.sorts[key] || { by: def, dir: 1 }; }
function sortList<T>(key: string, list: T[], opts: SortOpt<T>[], text?: (x: T) => string): T[] {
  const p = sortPref(key, opts[0][0]), o = opts.filter(x => x[0] === p.by)[0] || opts[0], q = (_listQ[key] || '').toLowerCase().trim();
  let out = list.slice();
  if (q && text) { const toks = q.split(/\s+/); out = out.filter(x => { const t = text(x).toLowerCase(); return toks.every(k => t.indexOf(k) >= 0); }); }
  return out.sort((a, b) => o[2](a, b) * p.dir);
}
function sortBar<T>(key: string, opts: SortOpt<T>[], ph?: string): string {
  const p = sortPref(key, opts[0][0]);
  return `<div class="sort-bar">${ph ? `<span class="lst-q-w">${icon('search')}<input class="le-in lst-q" data-k="${key}" placeholder="${esc(ph)}" value="${esc(_listQ[key] || '')}" spellcheck="false"></span>` : ''}<span class="sort-l">Sort</span>${opts.map(o => `<button class="fchip sm ${p.by === o[0] ? 'on' : ''}" data-act="sort-by" data-k="${key}" data-b="${o[0]}">${esc(o[1])}${p.by === o[0] ? (p.dir > 0 ? ' ↓' : ' ↑') : ''}</button>`).join('')}</div>`;
}
ACTIONS['sort-by'] = el => {
  const k = el.getAttribute('data-k'), b = el.getAttribute('data-b'), S = qs(); S.sorts = S.sorts || {};
  const cur = S.sorts[k]; S.sorts[k] = { by: b, dir: cur && cur.by === b ? -cur.dir : 1 }; Store.soon(); Sound.tick(); refresh();
};
let _lstT: any = null;
document.addEventListener('input', e => {
  const el = e.target as HTMLInputElement; if (!el || !el.classList || !el.classList.contains('lst-q')) return;
  _listQ[el.getAttribute('data-k')] = el.value; clearTimeout(_lstT); _lstT = setTimeout(() => { refresh(); const n = document.querySelector(`.lst-q[data-k="${el.getAttribute('data-k')}"]`) as HTMLInputElement; if (n && document.activeElement !== n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 220);
});
const _cmp = (a: any, b: any) => a < b ? -1 : a > b ? 1 : 0;
const FLEET_SORTS: SortOpt<Aircraft>[] = [['reg', 'Registration', (a, b) => _cmp(a.reg, b.reg)], ['type', 'Type', (a, b) => _cmp(acType(a.typeId).model, acType(b.typeId).model) || _cmp(a.reg, b.reg)], ['cond', 'Condition', (a: any, b: any) => (a.condition || 0) - (b.condition || 0)], ['hours', 'Hours', (a, b) => b.hoursMin - a.hoursMin], ['status', 'Status', (a, b) => _cmp(a.status, b.status)], ['where', 'Location', (a, b) => _cmp(a.location, b.location)]];
const PILOT_SORTS: SortOpt<any>[] = [['name', 'Name', (a, b) => _cmp(a.name, b.name)], ['hours', 'Hours', (a, b) => b.hoursMin - a.hoursMin], ['level', 'Level', (a, b) => (b.xp || 0) - (a.xp || 0)], ['base', 'Base', (a, b) => _cmp(a.base, b.base)], ['status', 'Status', (a, b) => _cmp(a.status, b.status)], ['score', 'Flight score', (a, b) => pilotAvgScore(b) - pilotAvgScore(a)]];
const STAFF_SORTS: SortOpt<any>[] = [['name', 'Name', (a, b) => _cmp(a.name, b.name)], ['rating', 'Rating', (a, b) => (b.rating || 0) - (a.rating || 0)], ['level', 'Level', (a, b) => (b.xp || 0) - (a.xp || 0)], ['base', 'Base', (a, b) => _cmp(a.base, b.base)]];
const LOG_SORTS: SortOpt<any>[] = [['date', 'Date', (a, b) => _logTime(b) - _logTime(a)], ['landing', 'Landing', (a, b) => Math.abs(a.landingFpm) - Math.abs(b.landingFpm)], ['score', 'Score', (a, b) => (b.score == null ? -1 : b.score) - (a.score == null ? -1 : a.score)], ['block', 'Block time', (a, b) => b.blockMin - a.blockMin], ['route', 'Route', (a, b) => _cmp(a.from + a.to, b.from + b.to)]];
const ROUTE_SORTS: SortOpt<any>[] = [['code', 'Code', (a, b) => _cmp(a.code, b.code)], ['load', 'Load', (a, b) => routeDemandPct(b) - routeDemandPct(a)], ['dist', 'Distance', (a, b) => routeDistance(b.legs) - routeDistance(a.legs)], ['type', 'Aircraft', (a, b) => _cmp(acType(a.typeId).model, acType(b.typeId).model)]];
function pilotAvgScore(p: any): number { const l = Ratings.list().filter((r: any) => r.who === p.id && r.score != null).slice(0, 30); return l.length ? l.reduce((s: number, r: any) => s + r.score, 0) / l.length : 0; }

/* ---------- undo ---------- */
const _undos: { [id: string]: () => void } = {};
function undoToast(msg: string, undo: () => void, kind?: 'ok' | 'warn' | 'info') {
  const id = uid(); _undos[id] = undo; setTimeout(() => { delete _undos[id]; }, 6500);
  toast(msg, kind || 'info', { label: 'Undo', act: 'undo-do', data: id });
}
ACTIONS['undo-do'] = el => { const id = el.getAttribute('data-id'), f = _undos[id]; const t = el.closest('.toast'); if (t) t.remove(); if (!f) { toast('Too late to undo', 'warn'); return; } delete _undos[id]; try { f(); } catch (e) { /* ignore */ } Store.save(); try { refresh(); renderTopbar(); } catch (e) { /* ignore */ } toast('Undone', 'ok'); };

/* ---------- notification settings ---------- */
const NT_KINDS: [string, string][] = [['flight', 'Flights'], ['pilot', 'Pilots'], ['staff', 'Staff and awards'], ['mechanic', 'Mechanic'], ['authority', 'Aviation authority'], ['finance', 'Finance and markets'], ['company', 'Company']];
function ntRule(kind: string): string { return ((qs().nt || {})[kind]) || 'show'; }
/** In quiet hours: no sounds and no phone notifications. */
function quietAt(t: number): boolean {
  const S = qs(); if (!S.quietOn) return false;
  const h = new Date(t).getHours() + new Date(t).getMinutes() / 60, a = +(S.quietFrom != null ? S.quietFrom : 23), b = +(S.quietTo != null ? S.quietTo : 7);
  return a > b ? h >= a || h < b : h >= a && h < b;
}
/** New notices follow the rules: "inbox only" ones arrive already read (no badge), "off" ones are dropped. */
function ntApply() {
  const S = qs(); if (!S.nt) return;
  let drop = false;
  for (const n of State.notices as any[]) { if (n._nt) continue; n._nt = 1; const r = ntRule(n.kind); if (r === 'quiet') n.read = true; else if (r === 'off') drop = true; }
  if (drop) State.notices = State.notices.filter((n: any) => ntRule(n.kind) !== 'off');
}
const NT_GROUPS: [RegExp, string][] = [[/ landed at /, 'flights landed'], [/ departed /, 'flights departed'], [/^Flight report to review/, 'flight reports to review'], [/prices? /i, 'market updates'], [/^Landed at /, 'of your landings'], [/is at the gate/, 'arrivals']];
function ntGroupKey(n: any): string { if (qs().ntGroup === false) return ''; for (const [re, k] of NT_GROUPS) if (re.test(n.title)) return n.kind + ':' + k; return ''; }
let _ntOpen: { [k: string]: boolean } = {};
/** The inbox list with repeats grouped ("6 flights landed"), opened with a tap. */
function noticeListHtml(list: any[], one: (n: any) => string): string {
  const out: string[] = []; let i = 0;
  while (i < list.length) {
    const k = ntGroupKey(list[i]); let j = i + 1;
    if (k) while (j < list.length && ntGroupKey(list[j]) === k && (list[i].at || 0) - (list[j].at || 0) < 6 * 3600e3) j++;
    if (j - i >= 3) {
      const g = list.slice(i, j), gk = k + ':' + (list[i].at || i), un = g.filter(n => !n.read).length;
      out.push(`<button class="notice grp ${un ? 'unread' : ''} k-${list[i].kind}" data-act="nt-grp" data-k="${esc(gk)}"><span class="n-ic">${icon(NOTICE_META[list[i].kind] ? NOTICE_META[list[i].kind].icon : 'bell')}</span><span class="n-t"><b>${g.length} ${esc(k.split(':')[1])}</b><small>${g.slice(0, 3).map(n => esc(n.title)).join(' · ')}${g.length > 3 ? ' …' : ''}</small></span><span class="n-time">${_ntOpen[gk] ? 'Hide' : 'Show all'}</span></button>`);
      if (_ntOpen[gk]) g.forEach(n => out.push(one(n)));
      i = j;
    } else { out.push(one(list[i])); i++; }
  }
  return out.join('');
}
ACTIONS['nt-grp'] = el => { const k = el.getAttribute('data-k'); _ntOpen[k] = !_ntOpen[k]; Sound.tick(); rerenderInbox(); };
ACTIONS['nt-clear'] = () => {
  const gone = State.notices.filter(n => n.read); if (!gone.length) { toast('No read messages to clear', 'info'); return; }
  State.notices = State.notices.filter(n => !n.read); rerenderInbox(); Store.soon();
  undoToast(`${gone.length} read message${gone.length === 1 ? '' : 's'} cleared`, () => { State.notices = State.notices.concat(gone); try { rerenderInbox(); } catch (e) { /* closed */ } });
};
function ntSettingsHtml(): string {
  const S = qs(), hrs = Array.from({ length: 24 }, (_, h) => h);
  return `<div class="set-card col"><div class="sc-h">${icon('bell')}<span><b>Notifications by type</b><small>Show: in the inbox with a badge and a chime. Inbox only: kept quietly, already marked read. Off: not kept.</small></span></div>
    ${NT_KINDS.map(([k, n]) => `<div class="fare-row"><span><b>${n}</b></span><span class="seg">${[['show', 'Show'], ['quiet', 'Inbox only'], ['off', 'Off']].map(([v, l]) => `<button class="${ntRule(k) === v ? 'on' : ''}" data-act="nt-set" data-k="${k}" data-v="${v}">${l}</button>`).join('')}</span></div>`).join('')}
    <div class="ch-row"><span><b>Group repeats</b><small>Several of the same kind close together show as one line ("6 flights landed"); tap to open.</small></span><button class="tg ${S.ntGroup === false ? '' : 'on'}" data-act="nt-toggle" data-k="ntGroup" data-def="1"><i></i></button></div>
    <div class="ch-row"><span><b>Quiet hours</b><small>No sounds and no phone notifications between these hours.</small></span><button class="tg ${S.quietOn ? 'on' : ''}" data-act="nt-toggle" data-k="quietOn"><i></i></button></div>
    ${S.quietOn ? `<div class="fs-fields"><label class="field"><span>From</span><select class="le-in nt-q" data-k="quietFrom">${hrs.map(h => `<option value="${h}" ${+(S.quietFrom != null ? S.quietFrom : 23) === h ? 'selected' : ''}>${String(h).padStart(2, '0')}:00</option>`).join('')}</select></label><label class="field"><span>To</span><select class="le-in nt-q" data-k="quietTo">${hrs.map(h => `<option value="${h}" ${+(S.quietTo != null ? S.quietTo : 7) === h ? 'selected' : ''}>${String(h).padStart(2, '0')}:00</option>`).join('')}</select></label></div>` : ''}</div>`;
}
ACTIONS['nt-set'] = el => { const S = qs(); S.nt = S.nt || {}; S.nt[el.getAttribute('data-k')] = el.getAttribute('data-v'); Store.save(); Sound.tick(); rerenderSettingsBody(); };
ACTIONS['nt-toggle'] = el => { const S = qs(), k = el.getAttribute('data-k'), def = el.getAttribute('data-def') === '1'; S[k] = S[k] == null ? !def : !S[k]; Store.save(); Sound.tick(); rerenderSettingsBody(); };
document.addEventListener('change', e => { const el = e.target as HTMLSelectElement; if (!el || !el.classList || !el.classList.contains('nt-q')) return; qs()[el.getAttribute('data-k')] = +el.value; Store.save(); });

/* ---------- swipe gestures (phone) ---------- */
function bindSwipes() {
  let sx = 0, sy = 0, kind = '', el: HTMLElement = null, st = 0;
  const pull = () => { let p = $('.pull-ind') as HTMLElement; if (!p) { p = document.createElement('div'); p.className = 'pull-ind'; p.innerHTML = icon('sync'); document.body.appendChild(p); } return p; };
  document.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) { kind = ''; return; }
    const t = e.touches[0], tg = e.target as HTMLElement; sx = t.clientX; sy = t.clientY; st = Date.now(); el = null; kind = '';
    if (tg.closest('canvas, .maplibregl-map, .v3d, input, textarea, select, .rp-slider, [data-noswipe]')) return;
    const n = tg.closest('.notice:not(.grp)') as HTMLElement;
    if (n) { kind = 'notice'; el = n; return; }
    if (sx < 24 && !_layers.length) { kind = 'back'; return; }
    const v = $('#view') as HTMLElement; if (v && v.contains(tg) && v.scrollTop <= 0 && !_layers.length) kind = 'pull';
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (!kind) return; const t = e.touches[0], dx = t.clientX - sx, dy = t.clientY - sy;
    if (kind === 'notice' && el) { if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) { el.style.transform = ''; kind = ''; return; } if (dx < 0) { el.style.transform = `translateX(${dx}px)`; el.style.opacity = String(Math.max(0.3, 1 + dx / 300)); } }
    else if (kind === 'pull') { if (dy < 0 || Math.abs(dx) > dy) { kind = ''; const p = $('.pull-ind') as HTMLElement; if (p) p.classList.remove('show'); return; } const p = pull(); p.classList.add('show'); p.style.transform = `translate(-50%, ${Math.min(90, dy * 0.6)}px) rotate(${dy * 2}deg)`; p.classList.toggle('ready', dy > 90); }
  }, { passive: true });
  document.addEventListener('touchend', e => {
    if (!kind) return; const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy, k = kind; kind = '';
    if (k === 'notice' && el) {
      if (dx < -90) { const id = el.getAttribute('data-id'), n = State.notices.filter(x => x.id === id)[0]; el.style.transform = 'translateX(-110%)'; el.style.opacity = '0';
        setTimeout(() => { if (!n) return; State.notices = State.notices.filter(x => x !== n); rerenderInbox(); renderTopbar(); Store.soon(); undoToast('Message removed', () => { State.notices.push(n); try { rerenderInbox(); } catch (er) { /* closed */ } }); }, 180); }
      else { el.style.transform = ''; el.style.opacity = ''; }
    } else if (k === 'back') { if (dx > 70 && Math.abs(dy) < 60 && Date.now() - st < 800) { Sound.tick(); handleBack(); } }
    else if (k === 'pull') {
      const p = $('.pull-ind') as HTMLElement;
      if (dy > 90) { if (p) p.classList.add('spin'); qolRefresh(); setTimeout(() => { if (p) p.classList.remove('show', 'spin', 'ready'); }, 700); }
      else if (p) p.classList.remove('show', 'ready');
    }
  }, { passive: true });
}
/** Pull to refresh: catch up the airline, the markets and the weather, then draw again. */
function qolRefresh() {
  try { aiAdvance(Date.now()); } catch (e) { /* ignore */ }
  try { marketsAdvance(); fetchRealMarkets(); } catch (e) { /* ignore */ }
  try { Traffic._cache = null; } catch (e) { /* ignore */ }
  Store.soon(); refresh(); renderTopbar(); Haptics.pulse(15); toast('Up to date', 'ok');
}

/* ---------- battery saver, text size, reduced motion ---------- */
function saverOn(): boolean {
  try { const m = qs().saver || 'auto'; if (m === 'on') return true; if (m === 'off') return false; const b = typeof Battery !== 'undefined' ? Battery.info : null; return !!(b && !b.charging && b.level <= 20); } catch (e) { return false; }
}
function comfortApply() {
  const r = document.documentElement, S = qs();
  r.classList.toggle('saver', saverOn());
  r.classList.toggle('reduce-motion', S.motion === 'reduce' || saverOn());
  if (!DESKTOP) { const k = +S.textSize || 1; (r.style as any).zoom = k === 1 ? '' : String(k); (window as any).__uiZoom = k; }
  else { const f = (window as any).__deskFit; if (f) f(); }
}
let _saverWas = false;
function saverTick() { const s = saverOn(); if (s !== _saverWas) { _saverWas = s; comfortApply(); if (s && (qs().saver || 'auto') === 'auto') toast('Battery low: battery saver is on (fewer animations, a calmer map)', 'info'); } }
function comfortHtml(): string {
  const S = qs(), seg = (act: string, key: string, def: string, opts: string[][]) => `<span class="seg">${opts.map(([v, l]) => `<button class="${String(S[key] || def) === v ? 'on' : ''}" data-act="${act}" data-k="${key}" data-v="${v}">${l}</button>`).join('')}</span>`;
  return `<div class="set-card col"><div class="sc-h">${icon('sliders')}<span><b>Comfort</b><small>Text size, motion and battery.</small></span></div>
    <div class="fare-row"><span><b>Text size</b><small>${DESKTOP ? 'On top of the size of everything (Simulator link → PC app).' : 'Everything in the app grows with it.'}</small></span>${seg('cf-set', 'textSize', '1', [['0.9', 'Small'], ['1', 'Normal'], ['1.1', 'Large'], ['1.25', 'Larger']])}</div>
    <div class="fare-row"><span><b>Motion</b><small>Reduced: no sliding, flipping or flashing.</small></span>${seg('cf-set', 'motion', 'system', [['system', 'Like the device'], ['reduce', 'Reduced']])}</div>
    <div class="fare-row"><span><b>Battery saver</b><small>Fewer animations and a calmer map. Automatic: below 20% when not charging.</small></span>${seg('cf-set', 'saver', 'auto', [['auto', 'Automatic'], ['on', 'On'], ['off', 'Off']])}</div>
    <div class="ch-row"><span><b>Reopen where I was</b><small>The same screen, tabs and filters when the app opens again, also after an update.</small></span><button class="tg ${S.rememberUi === false ? '' : 'on'}" data-act="nt-toggle" data-k="rememberUi" data-def="1"><i></i></button></div>
    <div class="ch-row"><span><b>"While you were away"</b><small>A summary when you open the app after 3 hours or more.</small></span><button class="tg ${S.awayCard === false ? '' : 'on'}" data-act="nt-toggle" data-k="awayCard" data-def="1"><i></i></button></div>
    <div class="ch-row"><span><b>Screen tips</b><small>A short tip the first time each screen opens.</small></span><button class="tg ${S.tips === false ? '' : 'on'}" data-act="nt-toggle" data-k="tips" data-def="1"><i></i></button></div>
    <div class="btn-row"><button class="btn ghost sm" data-act="tour-start">${icon('play')}Take the tour</button><button class="btn ghost sm" data-act="tips-reset">Show all tips again</button><button class="btn ghost sm" data-act="keys-help">${icon('info')}Keyboard shortcuts</button></div></div>`;
}
ACTIONS['cf-set'] = el => { qs()[el.getAttribute('data-k')] = el.getAttribute('data-v'); Store.save(); Sound.tick(); comfortApply(); rerenderSettingsBody(); };
ACTIONS['tips-reset'] = () => { qs().hintsSeen = {}; Store.save(); toast('Tips will show again on each screen', 'ok'); };

/* ---------- keyboard shortcuts ---------- */
const KEYS: [string, string, () => void][] = [
  ['Ctrl+K or /', 'Search everything', () => ACTIONS['search-open'](null, null)],
  ['1 … 0', 'Overview, Fleet, Routes, Jobs, Schedule, Dispatch, Maintenance, Finance, Flight logs, Crew', () => { /* listed only */ }],
  ['M', 'World map', () => go('map')], ['R', 'Ranking', () => go('ranking')], ['P', 'My career', () => go('career')], ['W', 'Newspaper', () => go('news')], ['O', 'Co-op', () => go('coop')],
  ['N', 'Notifications', () => ACTIONS.inbox(null, null)], [',', 'Settings', () => ACTIONS.settings(null, null)], ['?', 'This list', () => ACTIONS['keys-help'](null, null)], ['Esc', 'Close the window on top', () => { /* built in */ }],
];
function bindKeys() {
  document.addEventListener('keydown', e => {
    const tg = e.target as HTMLElement, typing = tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.tagName === 'SELECT' || tg.isContentEditable);
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); if (!$('.search-pop')) { closeAll(); ACTIONS['search-open'](null, null); } return; }
    if (typing || e.ctrlKey || e.metaKey || e.altKey || (typeof V3d !== 'undefined' && V3d.open)) return;
    const k = e.key;
    if (k === '/') { e.preventDefault(); closeAll(); ACTIONS['search-open'](null, null); return; }
    if (_layers.length && k !== '?') return;
    if (/^[0-9]$/.test(k)) { const i = k === '0' ? 9 : +k - 1, s = NAV_ORDER.filter(x => SCREENS[x])[i]; if (s) { Sound.tick(); go(s); } return; }
    const m: { [k: string]: string } = { m: 'M', r: 'R', p: 'P', w: 'W', o: 'O', n: 'N', ',': ',', '?': '?' }, key = m[k.toLowerCase()] || (k === '?' ? '?' : '');
    const x = KEYS.filter(y => y[0] === key)[0]; if (x) { e.preventDefault(); Sound.tick(); x[2](); }
  });
}
ACTIONS['keys-help'] = () => openLayer('modal', `<div class="modal-head"><div><h2>Keyboard shortcuts</h2><small>On the PC, and on a phone or tablet with a keyboard</small></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
  <div class="modal-body"><div class="keys">${KEYS.map(k => `<div class="key-r"><kbd>${esc(k[0])}</kbd><span>${esc(k[1])}</span></div>`).join('')}</div></div>`, { cls: 'narrow' });

/* ---------- the first-run tour and screen tips ---------- */
const TOUR: { sel: string; title: string; text: string; screen?: string }[] = [
  { sel: '.fin-hold', title: 'Start your career', text: 'Your money is on hold until you press this. Then your company is registered and every purchase, salary and fee is booked. Press it when you are ready to buy your first aircraft and hire your staff.' },
  { sel: '.rail-btn[data-screen="ops"]', title: 'Overview', text: 'Your airline at a glance: aircraft in the air, money, alerts and the world map.', screen: 'ops' },
  { sel: '.rail-btn[data-screen="fleet"]', title: 'Fleet', text: 'Buy, lease and look after your aircraft. Tap one for its details, its log and its condition.' },
  { sel: '.rail-btn[data-screen="routes"]', title: 'Routes', text: 'Plan routes and put a hired pilot on each; they fly them by themselves, even while the app is closed.' },
  { sel: '.rail-btn[data-screen="dispatch"]', title: 'Dispatch', text: 'Your next flight: fuel plan, briefings and NOTAMs, weather and the flight plan for the simulator.' },
  { sel: '.rail-btn[data-screen="logbook"]', title: 'Flight logs', text: 'Every flight with its landing, flight score and replay. Add your screenshots there too.' },
  { sel: '.rail-btn[data-screen="ranking"]', title: 'Ranking', text: 'Your badges, your crew, and the airline league: be the best airline of the month.' },
  { sel: '.link-pill', title: 'Link your PC', text: 'Connect the PC app next to Flight Simulator: your own flights are then logged and scored automatically.' },
  { sel: '[data-act="search-open"]', title: 'Search', text: 'Find any aircraft, pilot, airport, route, flight or setting.' },
  { sel: '.bell', title: 'Notifications', text: 'Messages from your pilots, mechanics, the authorities and the markets. Choose what you get in Settings → Comfort and notifications.' },
];
let _tour = -1;
ACTIONS['tour-start'] = () => { closeAll(); _tour = 0; go('ops'); setTimeout(tourShow, 400); };
function tourShow() {
  let o = $('.tour') as HTMLElement; if (_tour < 0 || _tour >= TOUR.length) { if (o) o.remove(); _tour = -1; qs().tourDone = true; Store.soon(); return; }
  const s = TOUR[_tour], tg = $(s.sel) as HTMLElement;
  if (!tg) { _tour++; tourShow(); return; }
  if (tg.scrollIntoView) tg.scrollIntoView({ block: 'nearest' });
  const r = tg.getBoundingClientRect(), z = uiScale() || 1;
  if (!o) { o = document.createElement('div'); o.className = 'tour'; document.body.appendChild(o); }
  const x = r.left / (DESKTOP ? z : 1), y = r.top / (DESKTOP ? z : 1), w = r.width / (DESKTOP ? z : 1), h = r.height / (DESKTOP ? z : 1);
  const right = x < innerWidth / 2, below = y < innerHeight / 2;
  o.innerHTML = `<div class="tour-hole" style="left:${x - 6}px;top:${y - 6}px;width:${w + 12}px;height:${h + 12}px"></div>
    <div class="tour-card" style="${right ? `left:${Math.min(innerWidth - 300, x + w + 18)}px` : `right:${Math.max(12, innerWidth - x + 18)}px`};${below ? `top:${Math.max(12, y)}px` : `bottom:${Math.max(12, innerHeight - y - h)}px`}">
      <small>${_tour + 1} of ${TOUR.length}</small><b>${esc(s.title)}</b><p>${esc(s.text)}</p>
      <div class="btn-row"><button class="text-btn" data-act="tour-end">Skip the tour</button>${_tour ? '<button class="btn ghost sm" data-act="tour-step" data-d="-1">Back</button>' : ''}<button class="btn primary sm" data-act="tour-step" data-d="1">${_tour === TOUR.length - 1 ? 'Done' : 'Next'}</button></div></div>`;
}
ACTIONS['tour-step'] = el => { _tour += +el.getAttribute('data-d'); Sound.tick(); tourShow(); };
ACTIONS['tour-end'] = () => { _tour = -1; tourShow(); };
window.addEventListener('resize', () => { if (_tour >= 0) tourShow(); });
const HINTS: { [k: string]: string } = {
  ops: 'This is your airline right now. Tap an aircraft on the map to follow it; the cards show what needs you.',
  fleet: 'Tap an aircraft for its details. Sort and search the list with the bar above it.',
  routes: 'A route is flown back and forth by the pilot you put on it. Closing one can be undone for a few seconds.',
  jobs: 'Charters and tours pay extra. Give one to a pilot or fly it yourself.',
  schedule: 'Who flies what today and tomorrow, with delays and their reasons.',
  dispatch: 'Before you fly: fuel plan, briefings, NOTAMs and the weather at both ends.',
  maint: 'Open repairs and checks. Grounded aircraft earn nothing, so fix them first.',
  finance: 'Money in and out. The markets card shows fuel and parts prices and what is expected.',
  logbook: 'Open a flight for its score, replay and screenshots. Export the log from the buttons above.',
  pilots: 'Your crew. Tap a person for their details; sort the lists by hours, level or score.',
  ranking: 'Badges, your staff, and the airline league against the other airlines.',
  career: 'You as a pilot: profile, licence, flight board, events and briefings.',
  news: 'The papers write about your airline, good news and bad.',
  coop: 'Fly one airline with real people. The Crew room has shared cockpit flights, check rides and awards.',
  map: 'Pinch or scroll to zoom. Other airlines\' aircraft can be shown or hidden with the button.',
  market: 'New, leased and used aircraft. Everything asks before money changes hands.',
};
function hintHtml(screen: string): string {
  const S = qs(), seen = S.hintsSeen || {}; if (S.tips === false || seen[screen] || !HINTS[screen] || _tour >= 0) return '';
  return `<div class="hint-card">${icon('info')}<span>${esc(HINTS[screen])}</span><button class="text-btn" data-act="hint-ok" data-s="${screen}">Got it</button></div>`;
}
ACTIONS['hint-ok'] = el => { const S = qs(); S.hintsSeen = S.hintsSeen || {}; S.hintsSeen[el.getAttribute('data-s')] = 1; Store.soon(); Sound.tick(); refresh(); };

/* ---------- export ---------- */
function _csv(rows: (string | number)[][]): string { return rows.map(r => r.map(v => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\r\n'); }
function _logRows(): any[] { const c = company(); return State.logbook.filter(l => (plane(l.reg) && plane(l.reg).companyId === c.id) || (l as any).coopBy || (l as any).atc === 'Co-op'); }
function logExportRows(): (string | number)[][] {
  return [['Date', 'From', 'To', 'Registration', 'Aircraft', 'Block (min)', 'Landing (fpm)', 'G', 'Passengers', 'Flight score', 'Result', 'ATC', 'Notes']].concat(_logRows().map((l: any) => { const t = acType(l.typeId || (plane(l.reg) || {} as any).typeId); return [l.date, l.from, l.to, l.reg, t ? t.maker + ' ' + t.model : '', l.blockMin, l.landingFpm, l.g, l.pax, l.score == null ? '' : l.score, l.decision === 'disregarded' ? 'voided' : l.result, l.atc, l.notes || '']; }));
}
function txExportRows(): (string | number)[][] {
  const c = company();
  return [['Date', 'Time', 'What', 'Amount (USD)', 'Kind', 'Route', 'Aircraft']].concat(State.txns.filter(t => t.companyId === c.id).map((t: any) => [t.date, t.time || '', t.label, Math.round(t.amount), t.kind, t.route || '', t.reg || '']));
}
function _fileName(what: string, ext: string): string { return `${company().name.replace(/[^A-Za-z0-9]+/g, '-')}-${what}-${new Date().toISOString().slice(0, 10)}.${ext}`.toLowerCase(); }
ACTIONS['exp-csv'] = el => {
  const w = el.getAttribute('data-w'), rows = w === 'tx' ? txExportRows() : logExportRows();
  saveTextFile(_fileName(w === 'tx' ? 'finances' : 'flight-log', 'csv'), 'text/csv', '﻿' + _csv(rows)).then(ok => toast(ok ? 'Saved as a spreadsheet file (CSV)' : 'Not saved', ok ? 'ok' : 'warn')).catch(() => toast('The file couldn\'t be saved', 'warn'));
};
ACTIONS['exp-pdf'] = el => {
  const w = el.getAttribute('data-w'), rows = w === 'tx' ? txExportRows() : logExportRows(), c = company();
  const cols = w === 'tx' ? [11, 6, 52, 14, 9, 16] : [17, 5, 5, 8, 18, 6, 8, 5, 5, 6, 10];
  const fmt = (r: (string | number)[]) => cols.map((n, i) => { const s = String(r[i] == null ? '' : r[i]); return (s.length > n - 1 ? s.slice(0, n - 2) + '~' : s).padEnd(n); }).join('');
  const lines = [`${c.name} - ${w === 'tx' ? 'finances' : 'flight log'} - ${new Date().toISOString().slice(0, 10)}`, '', fmt(rows[0]), '-'.repeat(cols.reduce((s, n) => s + n, 0))].concat(rows.slice(1).map(fmt));
  saveTextFile(_fileName(w === 'tx' ? 'finances' : 'flight-log', 'pdf'), 'application/pdf', textPdf(lines)).then(ok => toast(ok ? 'Saved as a PDF' : 'Not saved', ok ? 'ok' : 'warn')).catch(() => toast('The file couldn\'t be saved', 'warn'));
};
function expButtons(w: 'log' | 'tx'): string { return `<span class="btn-row nowrap"><button class="btn ghost sm" data-act="exp-csv" data-w="${w}">${icon('download')}CSV</button><button class="btn ghost sm" data-act="exp-pdf" data-w="${w}">${icon('download')}PDF</button></span>`; }
/** A plain PDF of text lines (landscape A4, Courier), pages as needed. Only plain characters are kept. */
function textPdf(lines: string[]): string {
  const clean = (s: string) => s.replace(/→/g, '->').replace(/[^\x20-\x7E]/g, '?').replace(/([\\()])/g, '\\$1');
  const per = 44, pages: string[][] = []; for (let i = 0; i < lines.length; i += per) pages.push(lines.slice(i, i + per));
  if (!pages.length) pages.push(['(empty)']);
  const objs: string[] = [], nP = pages.length;
  objs.push('<< /Type /Catalog /Pages 2 0 R >>');
  objs.push(`<< /Type /Pages /Kids [${pages.map((_, i) => `${4 + i * 2} 0 R`).join(' ')}] /Count ${nP} >>`);
  objs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>');
  pages.forEach((pg, i) => {
    const body = `BT /F1 8 Tf 10 TL 30 560 Td ${pg.map(l => `(${clean(l)}) '`).join(' ')} ET BT /F1 7 Tf 760 20 Td (Page ${i + 1} of ${nP}) Tj ET`;
    objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`);
    objs.push(`<< /Length ${body.length} >>\nstream\n${body}\nendstream`);
  });
  let out = '%PDF-1.4\n'; const offs: number[] = [];
  objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const x = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF\n`;
  return out;
}

/* ---------- the Android home screen widget ---------- */
let _wgLast = '', _wgAt = 0;
function widgetTick() {
  const cap = (window as any).Capacitor, T = cap && cap.Plugins && cap.Plugins.AppTools; if (!T || !T.widget) return;
  const c = company(); let next = '';
  try { const l = nextLeg(); next = l.from && l.to ? `${l.from} → ${l.to}` : 'No flight planned'; } catch (e) { /* ignore */ }
  const flying = State.live.filter((f: any) => !f.tfc && (f.you || (plane(f.reg) && plane(f.reg).companyId === c.id) || f.coop)).length;
  // more for the bigger widgets: today's profit and its chart, jet fuel and its chart, the fleet, what needs you, the 3D frame rate
  let profit = '', hProfit = '', hFuel = '', fuel = '', fleet = '', alerts = '', fps = '';
  try { const ser: any[] = profitSeries('day') || [], last = ser[ser.length - 1]; if (last) { const v = last.rev - last.cost; profit = (v >= 0 ? '+' : '-') + money(Math.abs(v), { compact: true }) + ' today'; } hProfit = ser.slice(-30).map(x => Math.round(x.rev - x.cost)).join(','); } catch (e) { /* none */ }
  try { const m: any = (State as any).mkt && (State as any).mkt.fuel; if (m && m.hist) { hFuel = m.hist.slice(-40).map((x: any) => x.v).join(','); const h = m.hist, ch = h.length > 1 ? h[h.length - 1].v - h[h.length - 2].v : 0; fuel = `Jet fuel $${fuelPrice(c.hub).toFixed(2)}/kg ${ch > 0.001 ? '▲' : ch < -0.001 ? '▼' : ''}`.trim(); } } catch (e) { /* none */ }
  try { const fl = fleetOf(c.id); const st = (k: string) => fl.filter((a: any) => fleetState(a) === k).length; fleet = `${st('flight')} flying · ${st('avail')} ready · ${st('maint')} maint.`; } catch (e) { /* none */ }
  try { const n = (State as any).incidents.filter((x: any) => x.status === 'open').length + State.notices.filter((x: any) => !x.read).length; alerts = n ? `${n} need${n === 1 ? 's' : ''} you` : ''; } catch (e) { /* none */ }
  try { fps = (typeof Perf !== 'undefined' && Perf.lastFps) ? String(Perf.lastFps) : ''; } catch (e) { /* none */ }
  let hFlying = ''; try { const H: number[] = JSON.parse(localStorage.getItem('amp.wgFlying') || '[]'); H.push(flying); while (H.length > 40) H.shift(); localStorage.setItem('amp.wgFlying', JSON.stringify(H)); hFlying = H.join(','); } catch (e) { /* none */ }
  const d = { title: c.name, balance: money(c.balance, { compact: true }), next, flying: `${flying} in the air`, profit, fleet, alerts, fuel, fps, hProfit, hFuel, hFlying };
  const k = JSON.stringify(Object.assign({}, d, { hFlying: '' })); if (k === _wgLast && Date.now() - _wgAt < 5 * 60000) return; _wgLast = k; _wgAt = Date.now();
  Promise.resolve(T.widget(d)).catch(() => { /* older app */ });
}

/* ---------- start ---------- */
function startQol() {
  SETTINGS.splice(1, 0, { id: 'comfort', title: 'Comfort and notifications', icon: 'bell', items: [{ type: 'html', html: () => comfortHtml() }, { type: 'html', html: () => ntSettingsHtml() }] });
  // tips on top of every screen the first time it opens
  Object.keys(SCREENS).forEach(k => { const s: any = SCREENS[k], r = s.render; s.render = function () { return hintHtml(k) + r.apply(this, arguments); }; });
  comfortApply(); bindKeys(); bindSwipes();
  setInterval(() => { if (document.hidden) return; uiMemSave(); awayMark(); saverTick(); widgetTick(); ntApply(); }, 30000);
  setInterval(() => { try { ntApply(); } catch (e) { /* ignore */ } }, 3000);
  const leave = () => { uiMemSave(); awayMark(); };
  window.addEventListener('pagehide', leave); document.addEventListener('visibilitychange', () => { if (document.hidden) leave(); else { setTimeout(awayCheck, 1500); saverTick(); } });
  setTimeout(() => { try { awayCheck(); } catch (e) { /* ignore */ } }, (typeof SPLASH_MS !== 'undefined' ? SPLASH_MS : 2500) + 3500);
  setTimeout(widgetTick, 5000);
  // the tour: for new players after the first start; everyone else is told about it once
  let flag = ''; try { flag = localStorage.getItem('amp-tour') || ''; localStorage.removeItem('amp-tour'); } catch (e) { /* ignore */ }
  if (flag && !qs().tourDone) setTimeout(() => ACTIONS['tour-start'](null, null), (typeof SPLASH_MS !== 'undefined' ? SPLASH_MS : 2500) + 1500);
  else if (!qs().tourOffered && !Store.wasEmpty) { qs().tourOffered = true; State.notices.unshift({ id: uid(), kind: 'company', title: 'New: a short tour and screen tips', body: 'Tap to take a one-minute tour of the app. Tips and notification choices are in Settings → Comfort and notifications.', time: 'Now', at: Date.now(), read: false, ref: 'va-tour' } as any); }
  const fd = ACTIONS['fs-demo']; if (fd) ACTIONS['fs-demo'] = (el, ev) => { fd(el, ev); if (!qs().tourDone) setTimeout(() => ACTIONS['tour-start'](null, null), 2500); };
}
