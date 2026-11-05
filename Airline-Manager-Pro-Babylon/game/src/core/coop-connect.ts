// Co-op connections: real players joining the airline and connecting to it. Each one shows as
// "connecting", then "connected" or "failed to connect" (with the reason), in the Co-op screen and as a
// notification. A failure caused by the app itself (an old version, a broken message, the online service
// refusing the app) is also written to the app's error log, so it can be sent in like any other problem.

interface CoopConn { id: string; at: number; by: string; name: string; nat: string; state: 'joined' | 'connecting' | 'connected' | 'failed' | 'left'; why?: string; app?: boolean }
function coopConns(): CoopConn[] { const c: any = coopState(); if (!c) return []; return c.conns || (c.conns = []); }
// player-side reasons (their internet, their device) and app reasons (logged)
const COOP_FAIL_NET = ['Their internet connection dropped', 'The connection timed out', 'Their phone went to sleep while connecting', 'They cancelled'];
const COOP_FAIL_APP = ['Their app is an older version than the airline needs', 'The airline data could not be read', 'The online service refused the app\'s sign-in'];

/** A player's connection changed. The online service calls this; the demo does too. */
function coopConn(mid: string, state: CoopConn['state'], why?: string, app?: boolean) {
  const c = coopState(), m = coopMember(mid); if (!c || !m) return;
  const e: CoopConn = { id: uid(), at: Date.now(), by: mid, name: m.name, nat: m.nat || '', state, why, app };
  const l = coopConns(); l.unshift(e); if (l.length > 120) l.length = 120;
  (m as any).online = state === 'connected'; (m as any).connecting = state === 'connecting';
  if (state === 'connected' || state === 'joined') m.lastSeen = e.at;
  const from = m.nat ? ` from ${countryName(m.nat)}` : '';
  const msg = state === 'joined' ? `${m.name}${from} joined the airline` : state === 'connecting' ? `${m.name} is connecting…` : state === 'connected' ? `${m.name} is connected`
    : state === 'failed' ? `${m.name} failed to connect: ${why || 'unknown reason'}` : `${m.name} disconnected`;
  try { if (State.screen === 'coop' || state !== 'connecting') toast(msg, state === 'failed' ? 'warn' : state === 'connected' || state === 'joined' ? 'ok' : 'info'); } catch (e2) { /* not ready */ }
  if (state === 'joined') { try { newsCoopJoin(m); } catch (e) { /* ignore */ } }
  if (state === 'joined' || state === 'failed')
    State.notices.unshift({ id: uid(), kind: 'pilot', title: msg, body: state === 'joined' ? `${m.name}${from} now flies for ${company().name}.` : `${why || 'The reason is unknown'}.${app ? ' This was a problem in the app; the details are in Settings → Error reports.' : ' It was on their side; they can try again.'}`, time: 'Now', at: e.at, read: false } as any);
  if (state === 'failed' && app) { try { ErrorLog.add('co-op', 'A co-op player could not connect', `${m.name}: ${why}`, `member ${m.id}, airline ${c.companyId}, backend ${c.backend}, app ${APP.version}`); } catch (e3) { /* ignore */ } }
  if (state === 'joined' || state === 'connected' || state === 'left') coopRecord({ id: e.id, at: e.at, by: mid, type: state === 'left' ? 'leave' : 'join', text: msg });
  try { renderTopbar(); if (State.screen === 'coop') refresh(); } catch (e4) { /* ignore */ }
}

/** The demo co-op: its players log on and off, now and then one fails to connect, and new players join. */
function coopConnTick(now: number) {
  const c: any = coopState(); if (!c || c.backend !== 'demo') return;
  c.connNext = c.connNext || {};
  for (const m of c.members) {
    if (m.you) continue;
    const pend = c.connPend && c.connPend[m.id];
    if (pend) { if (now >= pend.at) { delete c.connPend[m.id]; coopConn(m.id, pend.ok ? 'connected' : 'failed', pend.why, pend.app); } continue; }
    if (!c.connNext[m.id]) c.connNext[m.id] = now + (5 + Math.random() * 40) * 1000;
    if (now < c.connNext[m.id]) continue;
    const flying = State.live.some((f: any) => f.coop && f.pilotId === m.id);
    if (!m.online) {
      // connecting: a few seconds, then in, or (one in ten) not
      coopConn(m.id, 'connecting');
      const ok = Math.random() > 0.1, app = !ok && Math.random() < 0.4;
      c.connPend = c.connPend || {}; c.connPend[m.id] = { at: now + (3 + Math.random() * 6) * 1000, ok, app, why: ok ? '' : app ? COOP_FAIL_APP[Math.floor(Math.random() * COOP_FAIL_APP.length)] : COOP_FAIL_NET[Math.floor(Math.random() * COOP_FAIL_NET.length)] };
      c.connNext[m.id] = now + (ok ? 25 + Math.random() * 90 : 1 + Math.random() * 3) * 60e3;
    } else if (!flying) { coopConn(m.id, 'left'); c.connNext[m.id] = now + (10 + Math.random() * 60) * 60e3; }
    else c.connNext[m.id] = now + 10 * 60e3;   // online while flying
  }
  // a new player joins now and then (up to eight)
  if (c.members.length < 8 && now > (c.joinNext || 0)) {
    if (c.joinNext) {
      const co = company(), hubs = ['EGLL', 'KJFK', 'EDDF', 'LFPG', 'ESSA', 'ENGM', 'BIKF', 'CYYZ', 'YSSY', 'RJTT'], h = hubs[Math.floor(Math.random() * hubs.length)];
      const p = makePerson('coopj-' + uid(), 'captain', '', h);
      const m: any = { id: 'coop-' + uid(), name: p.name, role: 'pilot', sex: p.sex, nat: p.nat, base: co.hub, flights: 0, hoursMin: 0, revenue: 0, rating: Math.round((3.6 + Math.random() * 1.3) * 10) / 10, joined: now, lastSeen: now, look: randomLook('coop' + p.name, p.sex, 'captain') };
      if (activityRules().approve) { coopApps().push({ id: uid(), m, at: now, note: `From ${m.nat ? countryName(m.nat) : 'abroad'}, ${Math.round(50 + Math.random() * 3000)} hours in the sim. "${['I love regional flying.', 'Looking for a friendly crew.', 'Flying every evening.', 'Ex-airline sim pilot, keen to join.'][Math.floor(Math.random() * 4)]}"` });
        State.notices.unshift({ id: uid(), kind: 'pilot', title: `${m.name} applied to join`, body: 'Accept or decline under Co-op → Staff and members.', time: 'Now', at: now, read: false } as any); c.joinNext = now + (2 + Math.random() * 6) * 3600e3; return; }
      c.members.push(m); coopEnsurePilot(m); coopConn(m.id, 'joined');
      c.next[m.id] = now + (30 + Math.random() * 90) * 60e3; c.connNext[m.id] = now + 4000;
    }
    c.joinNext = now + (2 + Math.random() * 6) * 3600e3;
  }
}

/** The Co-op screen's list of who joined, connected, failed or left. */
function coopConnHtml(): string {
  const l = coopConns().slice(0, 30), ago = (t: number) => { const s = Math.round((Date.now() - t) / 1000); return s < 60 ? 'just now' : s < 3600 ? `${Math.round(s / 60)} min ago` : s < 86400 ? `${Math.round(s / 3600)} h ago` : `${Math.round(s / 86400)} d ago`; };
  const ic: any = { joined: 'plus', connecting: 'wifi', connected: 'check', failed: 'alert', left: 'close' };
  const word: any = { joined: 'Joined', connecting: 'Connecting…', connected: 'Connected', failed: 'Failed to connect', left: 'Disconnected' };
  return `<div class="card coop-conn"><div class="card-h"><b>Players connecting</b><small>${coopState().members.filter((m: any) => m.online || m.you).length} online</small></div>
    <div class="coop-ev">${l.map(e => `<div class="coop-e cn-${e.state}"><span class="coop-ei">${icon(ic[e.state])}</span>
      <span><b>${esc(e.name)} ${e.nat ? flag(e.nat) : ''}<em class="cn-st">${word[e.state]}</em></b><small>${e.nat ? esc(countryName(e.nat)) + ' · ' : ''}${ago(e.at)}${e.why ? ' · ' + esc(e.why) : ''}${e.app ? ' · logged as an app problem' : ''}</small></span></div>`).join('') || '<p class="fine-print">Nobody has connected yet.</p>'}</div></div>`;
}

/* ---------- in co-op mode the screens show whose flight, money or log it is ---------- */
let _coopWho = 'me';   // 'me', 'all' or a member id
/** Is this logbook entry or transaction for the player (or everyone) chosen? Your own in solo mode. */
function coopMineFilter(x: any): boolean {
  if (!coopOn()) return true;
  const by = x.coopBy || 'coop-you';
  return _coopWho === 'all' || (_coopWho === 'me' ? by === 'coop-you' : by === _coopWho);
}
function coopWhoChips(withAll: boolean): string {
  if (!coopOn()) return '';
  const c = coopState(), opts: [string, string][] = [['me', 'My flights']].concat(withAll ? [['all', 'Everyone']] : []).concat(c.members.filter(m => !m.you).map(m => [m.id, m.name] as [string, string])) as any;
  return `<div class="filter-row coop-who">${opts.map(o => `<button class="fchip ${_coopWho === o[0] ? 'on' : ''}" data-act="coop-who" data-w="${esc(o[0])}">${esc(o[1])}</button>`).join('')}</div>`;
}
ACTIONS['coop-who'] = el => { _coopWho = el.getAttribute('data-w'); Sound.tick(); refresh(); };

/** Crew → Pilots in co-op: the real players flying for the airline. */
function coopPlayersCrewHtml(): string {
  const c = coopState(), co = company();
  return `<h4 class="grp-h">Co-op players · ${c.members.length}</h4><div class="crew-list">${c.members.map((m: any, i) => {
    const f: any = State.live.filter((x: any) => x.pilotId === m.id && x.coop)[0], p: any = m.you ? myPilot() : pilot(m.id);
    return `<div class="crew-row" style="--i:${i}"><span class="avatar">${p && p.look ? avatarSvg(p.look, 'captain', { view: 'bust', accent: co.color, still: true }) : icon('user')}</span>
      <span class="cr-name"><b>${esc(m.name)} ${m.nat ? flag(m.nat) : ''}${m.you ? ' <em>you</em>' : ''}</b><small>${m.role === 'owner' ? 'Owner' : 'Pilot'} · ${num(m.flights)} flights · ${hours(m.hoursMin)} · based at ${esc(m.base || co.hub)}</small></span>
      <span class="cr-now">${f ? `${liveChip(f.reg, 'flying')}<small>${esc(f.from)} to ${esc(f.to)}</small>` : `<small>${m.you || m.online ? 'Online' : m.connecting ? 'Connecting…' : 'Offline'}</small>`}</span>
      <span class="cr-btns">${f ? `<button class="btn ghost sm" data-act="watch-pilot" data-id="${f.id}">${icon('map')}Watch</button>` : ''}</span></div>`;
  }).join('')}</div>`;
}
