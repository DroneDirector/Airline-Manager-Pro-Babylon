// More for co-op airlines: ranks that unlock bigger aircraft, automatic flight report checks, staff roles,
// applications and activity rules, chat and announcements (with an optional Discord post), and codeshares
// with other co-op airlines.

/* ---------- ranks ---------- */
const COOP_RANKS: { name: string; hrs: number; cls: string[] }[] = [
  { name: 'Cadet', hrs: 0, cls: ['ga', 'bush', 'turboprop'] },
  { name: 'First officer', hrs: 10, cls: ['ga', 'bush', 'turboprop', 'regional'] },
  { name: 'Senior first officer', hrs: 40, cls: ['ga', 'bush', 'turboprop', 'regional', 'airliner'] },
  { name: 'Captain', hrs: 100, cls: ['ga', 'bush', 'turboprop', 'regional', 'airliner', 'widebody'] },
  { name: 'Senior captain', hrs: 250, cls: ['ga', 'bush', 'turboprop', 'regional', 'airliner', 'widebody'] },
  { name: 'Commander', hrs: 500, cls: ['ga', 'bush', 'turboprop', 'regional', 'airliner', 'widebody'] },
];
function coopRankOf(m: any): { name: string; hrs: number; cls: string[] } {
  if (m && m.role === 'owner') return COOP_RANKS[COOP_RANKS.length - 1];
  const h = (m ? m.hoursMin || 0 : 0) / 60; let r = COOP_RANKS[0]; for (const x of COOP_RANKS) if (h >= x.hrs) r = x; return r;
}
function myRankName(): string { return coopRankOf(coopMe()).name; }
function coopRankAllows(rank: string, typeId: string): boolean {
  const c = coopState(), t = acType(typeId); if (!c || !t || (c.rules as any).rankGate === false) return true;
  const r = COOP_RANKS.filter(x => x.name === rank)[0] || COOP_RANKS[0]; return r.cls.indexOf(t.cls) >= 0;
}

/* ---------- staff roles ---------- */
const COOP_ROLES: [string, string, string][] = [['chief', 'Chief pilot', 'Writes briefings, sets ranks and rules'], ['reviewer', 'Report reviewer', 'Accepts or rejects flight reports'], ['trainer', 'Trainer', 'Instructor: signs off check rides with comments'], ['events', 'Events manager', 'Plans group flights and events']];
/** Can you do this in the co-op? The owner can do everything. */
function coopCan(role: string): boolean { const me: any = coopMe(); return !coopOn() || !!(me && (me.role === 'owner' || (me.staff || []).indexOf(role) >= 0)); }
ACTIONS['coop-staff'] = el => {
  if (!coopCan('owner') && (coopMe() as any).role !== 'owner') { toast('Only the owner hands out staff roles', 'warn'); return; }
  const m: any = coopMember(el.getAttribute('data-id')), r = el.getAttribute('data-r'); if (!m) return;
  m.staff = m.staff || []; const i = m.staff.indexOf(r); if (i >= 0) m.staff.splice(i, 1); else m.staff.push(r);
  coopPost('staff', `${m.name} ${i >= 0 ? 'is no longer' : 'is now'} ${COOP_ROLES.filter(x => x[0] === r)[0][1].toLowerCase()}`);
  Store.save(); Sound.tick(); refresh();
};

/* ---------- chat and announcements ---------- */
interface CoopMsg { id: string; at: number; by: string; name: string; text: string; kind: string; pinned?: boolean }
function coopChat(): CoopMsg[] { const c: any = coopState(); if (!c) return []; return c.chat || (c.chat = []); }
/** A line in the co-op's chat from the app (bookings, events, staff changes), also sent to Discord when set up. */
function coopPost(kind: string, text: string, by?: any) {
  if (!coopOn()) return; const m: any = by || { id: 'system', name: 'Co-op' };
  const l = coopChat(); l.push({ id: uid(), at: Date.now(), by: m.id, name: m.name, text, kind }); if (l.length > 300) l.splice(0, l.length - 300);
  const c: any = coopState(); if (c.discordCoop) { try { Online.discord('any', `${company().name} co-op`, text); } catch (e) { /* not set up */ } }
}
let _chatDraft = '';
function coopChatHtml(): string {
  const l = coopChat(), pin = l.filter(x => x.pinned).slice(-3), me: any = coopMe(), c: any = coopState();
  const ago = (t: number) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'now' : m < 60 ? m + ' min' : m < 1440 ? Math.round(m / 60) + ' h' : Math.round(m / 1440) + ' d'; };
  return `<div class="card coop-chat"><div class="card-h"><b>Chat</b><small>${c.discordCoop ? 'Also posted to Discord' : ''}</small></div>
    ${pin.map(p => `<div class="chat-pin">${icon('alert')}<span><b>Announcement · ${esc(p.name)}</b>${esc(p.text)}</span></div>`).join('')}
    <div class="chat-list">${l.slice(-40).map(x => `<div class="chat-m ${x.by === (me || {}).id ? 'me' : x.by === 'system' ? 'sys' : ''}"><small>${esc(x.name)} · ${ago(x.at)}</small><span>${esc(x.text)}</span></div>`).join('') || '<p class="muted pad">Say hello to your co-op.</p>'}</div>
    <div class="chat-in"><input class="le-in chat-t" maxlength="300" placeholder="Message the co-op" value="${esc(_chatDraft)}"><button class="btn primary sm" data-act="chat-send">${icon('check')}Send</button>${coopCan('chief') ? `<button class="btn ghost sm" data-act="chat-send" data-pin="1">Announce</button>` : ''}</div>
    <label class="tg-row"><span><b>Post to Discord</b><small>Landings, bookings, events and announcements go to your Discord channel (Settings → Online services).</small></span><button class="tg ${c.discordCoop ? 'on' : ''}" data-act="coop-discord" role="switch" aria-checked="${!!c.discordCoop}"><i></i></button></label></div>`;
}
ACTIONS['chat-send'] = el => {
  const i = $('.chat-t') as HTMLInputElement, t = (i && i.value || '').trim(); if (!t) return; const me: any = coopMe();
  const l = coopChat(); l.push({ id: uid(), at: Date.now(), by: me.id, name: me.name, text: t, kind: 'chat', pinned: el.getAttribute('data-pin') === '1' });
  const c: any = coopState(); if (c.discordCoop) { try { Online.discord('any', `${me.name} (${company().name})`, t); } catch (e) { /* ignore */ } }
  _chatDraft = ''; i.value = ''; Store.save(); refresh();
  // someone in the demo co-op answers now and then
  if (coopState().backend === 'demo' && Math.random() < 0.6) setTimeout(() => { const o: any = coopState().members.filter((m: any) => !m.you && m.online)[0] || coopState().members.filter((m: any) => !m.you)[0]; if (!o) return; const r = ['Sounds good!', 'Roger that 👍', 'On it.', 'See you in the air.', 'Nice one.', 'Copy, thanks!']; coopChat().push({ id: uid(), at: Date.now(), by: o.id, name: o.name, text: r[Math.floor(Math.random() * r.length)], kind: 'chat' }); if (State.screen === 'coop') refresh(); }, 4000 + Math.random() * 8000);
};
ACTIONS['coop-discord'] = () => { const c: any = coopState(); c.discordCoop = !c.discordCoop; Store.save(); Sound.tick(); refresh(); };
/** The demo co-op's pilots talk about their flights. */
function coopChatOnLanding(m: any, from: string, to: string, fpm: number) {
  if (!m || Math.random() > 0.5) return;
  const lines = [`Landed at ${to}, ${Math.abs(fpm)} fpm. ${Math.abs(fpm) < 150 ? 'Butter!' : Math.abs(fpm) > 400 ? 'Bit firm, sorry folks.' : 'Nice and smooth.'}`, `${from} → ${to} done. Anyone heading back?`, `Just in at ${to}. Weather was ${Math.random() < 0.5 ? 'lovely' : 'bumpy'} on the way.`];
  coopChat().push({ id: uid(), at: Date.now(), by: m.id, name: m.name, text: lines[Math.floor(Math.random() * lines.length)], kind: 'chat' });
  const c: any = coopState(); if (c.discordCoop) { try { Online.discord('any', `${m.name} landed at ${to}`, `${from} → ${to}, ${Math.abs(fpm)} fpm`); } catch (e) { /* ignore */ } }
}

/* ---------- automatic flight report checks ---------- */
interface AutoRules { on: boolean; maxFpm: number; maxG: number; rankGate: boolean }
function autoRules(): AutoRules { const c: any = coopState(); c.rules.auto = c.rules.auto || { on: true, maxFpm: 600, maxG: 1.8, rankGate: true }; return c.rules.auto; }
/** '' when a report passes every rule; otherwise why it needs a person to look at it. */
function pirepCheck(pr: CoopPirep): string {
  const r = autoRules(), m: any = coopMember(pr.by), why: string[] = [];
  if (Math.abs(pr.fpm) > r.maxFpm) why.push(`landing ${Math.abs(pr.fpm)} fpm (limit ${r.maxFpm})`);
  if (pr.g > r.maxG) why.push(`${pr.g.toFixed(2)} g (limit ${r.maxG})`);
  const sc = (pr as any).score; if (sc != null && sc < ((r as any).minScore || 60)) why.push(`flight score ${sc} (limit ${(r as any).minScore || 60})`);
  const A = apt(pr.from), B = apt(pr.to), t = acType(pr.typeId);
  if (A && B && t) { const exp = gcDistanceNm(A.pos, B.pos) / t.cruiseKt * 60 + 20; if (pr.blockMin < exp * 0.6) why.push(`block time ${pr.blockMin} min is too short for the distance (sim rate?)`); }
  if (r.rankGate && m && !coopRankAllows(coopRankOf(m).name, pr.typeId)) why.push(`${coopRankOf(m).name} isn't cleared for the ${t ? t.model : pr.typeId}`);
  return why.join('; ');
}
function autoRulesHtml(): string {
  const r = autoRules(), can = coopCan('chief');
  const step = (k: string, v: number, d: number, label: string) => `<div class="fare-row"><span><b>${label}</b></span><div class="stepper"><button class="icon-btn" data-act="ar-step" data-k="${k}" data-d="${-d}" ${can ? '' : 'disabled'}>−</button><b>${v}</b><button class="icon-btn" data-act="ar-step" data-k="${k}" data-d="${d}" ${can ? '' : 'disabled'}>+</button></div></div>`;
  return `<div class="ch-row"><span><b>Check flight reports automatically</b><small>Reports within the limits are accepted at once; the rest wait for a reviewer, with the reason.</small></span><button class="tg ${r.on ? 'on' : ''}" data-act="ar-toggle" data-k="on" ${can ? '' : 'disabled'}><i></i></button></div>
    ${r.on ? step('maxFpm', r.maxFpm, 50, 'Hardest landing (fpm)') + step('maxG', r.maxG, 0.1, 'Highest g-force') + step('minScore', (r as any).minScore || 60, 5, 'Lowest flight score') : ''}
    <div class="ch-row"><span><b>Ranks unlock aircraft</b><small>${COOP_RANKS.map(x => `${x.name} (${x.hrs} h)`).join(' → ')}. Cadets fly turboprops; airliners from senior first officer; widebodies from captain.</small></span><button class="tg ${r.rankGate ? 'on' : ''}" data-act="ar-toggle" data-k="rankGate" ${can ? '' : 'disabled'}><i></i></button></div>`;
}
ACTIONS['ar-toggle'] = el => { const r: any = autoRules(), k = el.getAttribute('data-k'); r[k] = !r[k]; (coopState().rules as any).rankGate = r.rankGate; Store.save(); Sound.tick(); refresh(); };
ACTIONS['ar-step'] = el => { const r: any = autoRules(), k = el.getAttribute('data-k'); r[k] = r[k] == null && k === 'minScore' ? 60 : r[k]; r[k] = k === 'minScore' ? clamp(r[k] + +el.getAttribute('data-d'), 30, 100) : Math.max(k === 'maxG' ? 1.2 : 200, Math.round((r[k] + +el.getAttribute('data-d')) * 10) / 10); Store.save(); Sound.tick(); refresh(); };

/* ---------- applications and activity ---------- */
function coopApps(): any[] { const c: any = coopState(); if (!c) return []; return c.apps || (c.apps = []); }
function activityRules(): { approve: boolean; inactiveDays: number } { const c: any = coopState(); c.rules.act = c.rules.act || { approve: true, inactiveDays: 30 }; return c.rules.act; }
ACTIONS['app-do'] = el => {
  const a = coopApps().filter(x => x.id === el.getAttribute('data-id'))[0]; if (!a) return; const ok = el.getAttribute('data-v') === '1'; const c: any = coopState();
  c.apps = coopApps().filter(x => x !== a);
  if (ok) { c.members.push(a.m); coopEnsurePilot(a.m); coopConn(a.m.id, 'joined'); c.next[a.m.id] = Date.now() + (30 + Math.random() * 60) * 60e3; coopPost('join', `Welcome ${a.m.name}!`); }
  else coopPost('join', `${a.m.name}'s application was turned down`);
  Store.save(); Sound.tick(); refresh();
};
ACTIONS['loa-toggle'] = el => { const m: any = coopMember(el.getAttribute('data-id')); if (!m) return; m.loa = !m.loa; coopPost('staff', `${m.name} is ${m.loa ? 'on leave' : 'back from leave'}`); Store.save(); refresh(); };
ACTIONS['act-step'] = el => { const r = activityRules(); r.inactiveDays = clamp(r.inactiveDays + +el.getAttribute('data-d'), 7, 180); Store.save(); refresh(); };
ACTIONS['act-approve'] = () => { const r = activityRules(); r.approve = !r.approve; Store.save(); Sound.tick(); refresh(); };
/** Inactive members (not on leave) get a warning, then are removed. */
function coopActivityCheck() {
  const c: any = coopState(); if (!c || !c.on) return; const r = activityRules(), now = Date.now();
  for (const m of c.members.slice()) {
    if (m.you || m.role === 'owner' || m.loa) continue;
    const idle = (now - (m.lastSeen || now)) / 864e5;
    if (idle > r.inactiveDays && !m.idleWarned) { m.idleWarned = now; coopPost('staff', `${m.name} hasn't flown for ${Math.round(idle)} days. They are removed in a week unless they fly or go on leave.`); }
    if (m.idleWarned && idle > r.inactiveDays + 7) { c.members = c.members.filter((x: any) => x !== m); coopConn(m.id, 'left'); coopPost('staff', `${m.name} was removed for inactivity`); }
    if (m.idleWarned && idle < r.inactiveDays) delete m.idleWarned;
  }
}

/* ---------- codeshares ---------- */
function codeshares(): { name: string; since: number }[] { const c: any = coopState(); if (!c) return []; return c.codeshares || (c.codeshares = []); }
/** Codeshare partners sell seats on your flights: a little more on every co-op flight (up to three partners). */
function codeshareBoost(): number { return coopOn() ? Math.min(3, codeshares().length) * 0.03 : 0; }
ACTIONS['cs-propose'] = () => {
  if (!coopCan('owner') && (coopMe() as any).role !== 'owner') { toast('Only the owner signs codeshares', 'warn'); return; }
  const have = codeshares().map(x => x.name), cand = COMPETITOR_NAMES.filter(n => have.indexOf(n) < 0), name = cand[Math.floor(Math.random() * cand.length)] + ' Co-op';
  confirmChange(`Propose a codeshare to ${name}?`, 'They sell seats on your flights and you on theirs: about 3% more passengers on every co-op flight per partner (up to three).', 'Propose', 'Not now', () => {
    closeTop(); toast(`Proposal sent to ${name}`, 'info');
    setTimeout(() => { if (Math.random() < 0.7) { codeshares().push({ name, since: Date.now() }); coopPost('codeshare', `Codeshare signed with ${name}!`); toast(`${name} accepted the codeshare`, 'ok'); } else { coopPost('codeshare', `${name} turned the codeshare down for now`); toast(`${name} said no for now`, 'warn'); } Store.save(); if (State.screen === 'coop') refresh(); }, 6000 + Math.random() * 8000);
  }, () => closeTop());
};
ACTIONS['cs-end'] = el => { const c: any = coopState(); c.codeshares = codeshares().filter(x => x.name !== el.getAttribute('data-n')); coopPost('codeshare', `Codeshare with ${el.getAttribute('data-n')} ended`); Store.save(); refresh(); };

/* ---------- the extra Co-op tabs ---------- */
let _coopTab = 'home';
function coopTabsHtml(): string {
  const tabs: [string, string][] = [['home', 'Overview'], ['board', 'Flight board'], ['chat', 'Chat'], ['events', 'Events'], ['crew', 'Crew room'], ['staff', 'Staff and members'], ['rules', 'Rules and codeshares']];
  return `<div class="filter-row coop-tabs">${tabs.map(t => `<button class="fchip ${_coopTab === t[0] ? 'on' : ''}" data-act="coop-tab" data-t="${t[0]}">${t[1]}${t[0] === 'chat' && coopChat().length ? ` <em>${coopChat().length}</em>` : t[0] === 'staff' && coopApps().length ? ` <em class="amber">${coopApps().length}</em>` : ''}</button>`).join('')}</div>`;
}
ACTIONS['coop-tab'] = el => { _coopTab = el.getAttribute('data-t'); Sound.tick(); refresh(); };
function coopStaffHtml(): string {
  const c: any = coopState(), owner = (coopMe() as any || {}).role === 'owner', r = activityRules();
  return `${coopApps().length ? `<div class="card"><div class="card-h"><b>Applications</b><small>${r.approve ? 'New pilots wait for your approval' : ''}</small></div>${coopApps().map(a => `<div class="ev-row"><span><b>${esc(a.m.name)} ${a.m.nat ? flag(a.m.nat) : ''}</b><small>${esc(a.note)}</small></span><span class="btn-row"><button class="btn ghost sm" data-act="app-do" data-id="${esc(a.id)}" data-v="0">Decline</button><button class="btn primary sm" data-act="app-do" data-id="${esc(a.id)}" data-v="1">Accept</button></span></div>`).join('')}</div>` : ''}
    <div class="card"><div class="card-h"><b>Members</b><small>Rank by hours; staff roles from the owner</small></div>
    ${c.members.map((m: any) => `<div class="ev-row"><span><b>${esc(m.name)} ${m.nat ? flag(m.nat) : ''}${m.you ? ' <em>you</em>' : ''}</b><small>${m.role === 'owner' ? 'Owner' : esc(coopRankOf(m).name)} · ${hours(m.hoursMin)} · ${m.loa ? 'on leave' : m.idleWarned ? 'inactive' : 'active'}</small>
      <span class="role-chips">${COOP_ROLES.map(([k, n]) => m.role === 'owner' ? '' : `<button class="fchip sm ${(m.staff || []).indexOf(k) >= 0 ? 'on' : ''}" data-act="coop-staff" data-id="${esc(m.id)}" data-r="${k}" ${owner ? '' : 'disabled'} title="${esc(COOP_ROLES.filter(x => x[0] === k)[0][2])}">${n}</button>`).join('')}</span></span>
      ${m.role !== 'owner' && (owner || m.you) ? `<button class="text-btn" data-act="loa-toggle" data-id="${esc(m.id)}">${m.loa ? 'Back from leave' : 'Leave of absence'}</button>` : ''}</div>`).join('')}</div>
    <div class="card"><div class="card-h"><b>Joining and activity</b></div>
      <div class="ch-row"><span><b>Approve new pilots</b><small>Applications wait for the owner instead of joining straight away.</small></span><button class="tg ${r.approve ? 'on' : ''}" data-act="act-approve" ${owner ? '' : 'disabled'}><i></i></button></div>
      <div class="fare-row"><span><b>Inactive after</b><small>Then a warning, and removal a week later. Leave of absence stops the clock.</small></span><div class="stepper"><button class="icon-btn" data-act="act-step" data-d="-7" ${owner ? '' : 'disabled'}>−</button><b>${r.inactiveDays} days</b><button class="icon-btn" data-act="act-step" data-d="7" ${owner ? '' : 'disabled'}>+</button></div></div></div>`;
}
function coopRulesHtml(): string {
  const cs = codeshares();
  return `<div class="card"><div class="card-h"><b>Flight report rules</b><small>Set by the owner or chief pilot</small></div>${autoRulesHtml()}</div>
    <div class="card"><div class="card-h"><b>Codeshares</b><small>Partner co-op airlines selling seats on your flights</small></div>
      ${cs.map(x => `<div class="ev-row"><span><b>${esc(x.name)}</b><small>Since ${esc(dateStr(new Date(x.since)).slice(0, 10))} · +3% passengers</small></span><button class="text-btn" data-act="cs-end" data-n="${esc(x.name)}">End</button></div>`).join('') || '<p class="muted pad">No codeshares yet.</p>'}
      <div class="modal-actions"><button class="btn primary" data-act="cs-propose" ${cs.length >= 3 ? 'disabled' : ''}>${icon('plus')}Propose a codeshare</button></div></div>`;
}
/** The demo co-op: new pilots apply instead of joining straight away when approval is on; activity is checked. */
function coopPlusTick() { try { coopActivityCheck(); coopBoardSync(); coopEventsSync(); } catch (e) { /* ignore */ } }
