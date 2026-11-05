// Ranking: your own record as a pilot: your rank and rating, your flying record and your badges, shown
// as you earn them (badges not yet earned stay hidden). Badges are yours only; hired pilots and crew level up without badges.

let _rkGroup = 'all', _rkShowAll = false, _rkWho = 'you', _rkJob = 'all', _rkAllCos = false;
const RK_TABS: [string, string][] = [['you', 'You'], ['airlines', 'Airline league'], ['pilots', 'Pilots'], ['fa', 'Cabin crew'], ['mech', 'Mechanics'], ['ground', 'Ground crew'], ['pax', 'Passengers'], ['gifts', 'Gifts'], ['achv', 'Achievements']];

SCREENS.ranking = {
  title: 'Ranking', icon: 'trophy',
  render() {
    if (_rkWho === 'scen' && !soloMode()) _rkWho = 'you';
    const tabs = `<div class="filter-row rk-who">${RK_TABS.concat(soloMode() ? [['scen', 'Scenarios'] as [string, string]] : []).map(t => `<button class="fchip ${_rkWho === t[0] ? 'on' : ''}" data-act="rk-who" data-w="${t[0]}">${t[1]}</button>`).join('')}</div>`;
    if (_rkWho === 'scen') return `<div class="screen-head"><div><h1>Ranking</h1><p class="sub">Challenges with goals and medals</p></div></div>${tabs}${scenariosHtml()}`;
    if (_rkWho === 'airlines') return `<div class="screen-head"><div><h1>Ranking</h1><p class="sub">Your airline against the others</p></div></div>${tabs}${leagueHtml()}`;
    if (_rkWho === 'achv') return `<div class="screen-head"><div><h1>Ranking</h1><p class="sub">Achievements: what you have done, and how far you are with the rest</p></div></div>${tabs}${achievementsHtml()}`;
    if (_rkWho === 'gifts') return `<div class="screen-head"><div><h1>Ranking</h1><p class="sub">Gifts and commemorative plaques: tap one to turn it round in 3D</p></div></div>${tabs}${giftsHtml()}`;
    if (_rkWho === 'pax') return `<div class="screen-head"><div><h1>Ranking</h1><p class="sub">What your passengers think</p></div></div>${tabs}${reviewsHtml()}`;
    if (_rkWho !== 'you') return `<div class="screen-head"><div><h1>Ranking</h1><p class="sub">Your staff by level and experience</p></div></div>${tabs}${staffRankHtml()}`;
    return this.renderYou(tabs);
  },
  renderYou(tabs: string) {
    const S: any = State, c = company(), me: any = myPilot();
    const st = Progress.compute();
    const pxp = Progress.pilotXp(st), pr = Progress.rankOf(pxp, PILOT_RANKS);
    const defs = badgeDefs().filter(b => b.group === 'pilot'), earned = S.badges || {};
    const got = defs.filter(b => earned[b.id]), nEarned = got.length;
    const bar = (xp: number, r: any) => { const p = r.to > r.from ? clamp((xp - r.from) / (r.to - r.from), 0, 1) : 1; return `<span class="rk-bar"><i style="width:${(p * 100).toFixed(1)}%"></i></span><small>${num(xp)} XP${r.to > r.from ? ` · ${num(r.to - xp)} to the next rank` : ' · highest rank'}</small>`; };
    const stars = (v: number) => `<span class="rk-stars" aria-label="Rating ${v.toFixed(1)} of 5">${[1, 2, 3, 4, 5].map(i => `<i class="${v >= i - 0.25 ? 'on' : v >= i - 0.75 ? 'half' : ''}">${icon('star')}</i>`).join('')}<b>${v.toFixed(1)}</b></span>`;
    // only badges you have earned are shown, newest first; the rest stay a surprise
    const cats = ['all'].concat(Array.from(new Set(got.map(b => b.cat))));
    if (cats.indexOf(_rkGroup) < 0) _rkGroup = 'all';
    const list = got.filter(b => _rkGroup === 'all' || b.cat === _rkGroup).sort((a, b) => (earned[b.id] || 0) - (earned[a.id] || 0) || b.tier - a.tier);
    const shown = list.slice(0, _rkShowAll ? 5000 : 120);
    const rec = [['Flights', num(st['p.flights'] || 0)], ['Block hours', num(st['p.hours'] || 0)], ['Smooth landings', num(st['p.smooth'] || 0)], ['Butter landings', num(st['p.butter'] || 0)],
      ['Best streak', num(st['p.streak'] || 0)], ['Airports', num(st['p.airports'] || 0)], ['Countries', num(st['p.countries'] || 0)], ['Aircraft types', num(st['p.types'] || 0)],
      ['Distance', num(Math.round(st['p.nm'] || 0)) + ' nm'], ['Passengers', num(st['p.pax'] || 0)]];
    return `
    <div class="screen-head"><div><h1>Ranking</h1><p class="sub">Your record, the landing leaderboard · ${num(nEarned)} ${nEarned === 1 ? 'badge' : 'badges'} earned</p></div></div>
    ${tabs}
    <div class="rk-top">
      <div class="card rk-card">
        <span class="rk-av">${avatarSvg(me.look, 'captain', { view: 'bust', accent: c.color, still: true })}</span>
        <span class="rk-txt"><small>${esc(me.name)}, rank ${pr.level} of ${PILOT_RANKS.length}</small><b>${esc(pr.name)}</b>${bar(pxp, pr)}
          ${stars(me.rating || 4)}<small>Only flights you fly yourself count. Hired pilots and crew level up on their own, without badges.</small></span>
      </div>
      <div class="card rk-rec"><div class="card-h"><b>Your record</b></div>
        <div class="rk-rec-grid">${rec.map(r => `<span><b>${esc(r[1])}</b><small>${esc(r[0])}</small></span>`).join('')}</div></div>
    </div>
    ${leaderboardHtml()}
    <div class="card rk-badges">
      <div class="card-h"><b>Your badges</b><span class="seg rk-cats">${cats.map(g => `<button class="${_rkGroup === g ? 'on' : ''}" data-act="rk-group" data-g="${esc(g)}">${g === 'all' ? 'All' : esc(g)}</button>`).join('')}</span>
        ${list.length > 120 ? `<button class="text-btn" data-act="rk-all">${_rkShowAll ? 'Show the newest' : 'Show all ' + num(list.length)}</button>` : ''}</div>
      <div class="bdg-grid">${shown.map((b, i) => {
        const have = earned[b.id];
        return `<div class="bdg t${b.tier} have" style="--i:${Math.min(i, 30)}" title="${esc(b.desc)}" data-act="badge-3d" data-id="${esc(b.id)}" role="button" tabindex="0" aria-label="${esc(b.title)}: open in 3D">
          <span class="bdg-ic">${icon(b.icon)}</span><span class="bdg-t"><b>${esc(b.title)}</b><small>${esc(b.desc)}</small>
          <em>${TIER_NAMES[b.tier]} · earned ${esc(dateStr(new Date(have)).slice(0, 10))}</em></span></div>`;
      }).join('') || `<p class="fine-print rk-empty">${icon('trophy')}No badges yet. They appear here as you earn them by flying yourself.</p>`}</div>

    </div>`;
  },
} as any;
/** Staff rankings: each group in its own list, highest level first. */
function staffRankHtml(): string {
  const S: any = State, cid = State.companyId;
  let list: any[];
  // real players are in the ranking only in co-op mode
  if (_rkWho === 'pilots') list = State.pilots.filter((p: any) => !p.you && (coopOn() || !/^coop:/.test(p.companyId || ''))).concat((S.staff || []).filter((p: any) => p.role === 'fo'));
  else list = (S.staff || []).filter((p: any) => p.role === _rkWho && (_rkWho !== 'ground' || _rkJob === 'all' || p.job === _rkJob));
  if (!_rkAllCos && State.companies.length > 1) list = list.filter((p: any) => (p.companyId || cid) === cid || p.companyId === 'coop:' + cid);
  list = list.slice().sort((a, b) => (b.xp || 0) - (a.xp || 0) || (b.rating || 0) - (a.rating || 0));
  const jobs = _rkWho === 'ground' ? `<div class="filter-row sub">${[['all', 'All jobs']].concat(GROUND_JOBS as any).map((r: any) => `<button class="fchip ${_rkJob === r[0] ? 'on' : ''}" data-act="rk-job" data-j="${r[0]}">${esc(r[1])}</button>`).join('')}</div>` : '';
  const cos = State.companies.length > 1 ? `<span class="seg"><button class="${!_rkAllCos ? 'on' : ''}" data-act="rk-cos" data-v="0">${esc(company().name)}</button><button class="${_rkAllCos ? 'on' : ''}" data-act="rk-cos" data-v="1">All your airlines</button></span>` : '';
  const role = _rkWho === 'pilots' ? 'captain' : _rkWho;
  const rows = list.slice(0, 200).map((p: any, i: number) => {
    const l = levelOf(p.xp || 0);
    return `<button class="lb-row rk-staff" data-act="staff-detail" data-id="${esc(p.id)}"><b class="lb-n">${i + 1}</b>
      <span class="rk-sav">${p.look ? avatarSvg(p.look, (personRole(p) || role) as any, { view: 'bust', accent: company(p.companyId || cid).color, still: true }) : ''}</span>
      <span class="lb-who"><b>${esc(p.name)}</b>${/^coop:/.test(p.companyId || '') ? '<span class="chip coop">Real player</span>' : levelChip(p)}<small>${esc(levelTitle(p))} · ${esc(p.base || '')}${_rkAllCos ? ' · ' + esc(company(p.companyId || cid).name) : ''}${p.job && typeof groundJobName === 'function' ? ' · ' + esc(groundJobName(p)) : ''}</small>
        <span class="lvl-bar"><i style="width:${(l.p * 100).toFixed(0)}%"></i></span></span>
      <span class="lb-v"><b>Level ${l.level}</b><small>${num(p.xp || 0)} XP · ${(p.rating || 4).toFixed(1)} ★</small></span></button>`;
  }).join('');
  const name = RK_TABS.filter(t => t[0] === _rkWho)[0][1].toLowerCase();
  return `<div class="card lb"><div class="card-h"><b>${RK_TABS.filter(t => t[0] === _rkWho)[0][1]}</b>${cos}</div>${jobs}
    <div class="lb-list">${rows || `<p class="fine-print">${icon('info')}No ${name} yet. Hire them under Crew.</p>`}</div>
    <p class="fine-print">${icon('info')}Everyone levels up from 1 to ${LEVEL_MAX} with their work: flights for pilots and cabin crew, turnaround checks and repairs for mechanics, turnarounds for ground crew. Higher levels mean better ratings and fewer mistakes.</p></div>`;
}
ACTIONS['rk-who'] = el => { _rkWho = el.getAttribute('data-w'); _rkJob = 'all'; Sound.tick(); refresh(); };
ACTIONS['rk-job'] = el => { _rkJob = el.getAttribute('data-j'); Sound.tick(); refresh(); };
ACTIONS['rk-cos'] = el => { _rkAllCos = el.getAttribute('data-v') === '1'; Sound.tick(); refresh(); };
ACTIONS['rk-group'] = el => { _rkGroup = el.getAttribute('data-g'); Sound.tick(); refresh(); };
ACTIONS['rk-all'] = () => { _rkShowAll = !_rkShowAll; Sound.tick(); refresh(); };

/* ---------- Landing leaderboard ---------- */
let _lbWhen: 'week' | 'month' | 'all' = 'week', _lbView: 'best' | 'avg' = 'best';
function allLandings(): LandRec[] {
  const me: any = myPilot();
  const mine: LandRec[] = State.logbook.filter((l: any) => !l.coopBy && l.atc !== 'Co-op' && l.result !== 'crash' && l.decision !== 'disregarded' && l.landingFpm)
    .map((l: any) => ({ who: me.id, name: me.name, fpm: Math.abs(l.landingFpm), g: l.g || 1, at: Date.parse(String(l.date).replace(' ', 'T')) || 0, from: l.from, to: l.to, typeId: l.typeId || (plane(l.reg) ? plane(l.reg).typeId : ''), kind: 'you' as 'you' }));
  return mine.concat(Ratings.list());
}
function leaderboardHtml(): string {
  const since = _lbWhen === 'week' ? Date.now() - 7 * 864e5 : _lbWhen === 'month' ? Date.now() - 30 * 864e5 : 0;
  const all = allLandings().filter(r => r.at >= since && r.fpm > 0);
  const kindChip = (k: string) => `<span class="chip lb-${k}">${k === 'you' ? 'You' : k === 'coop' ? 'Co-op' : 'Hired'}</span>`;
  let body = '';
  if (_lbView === 'best') {
    const top = all.slice().sort((a, b) => a.fpm - b.fpm || a.g - b.g).slice(0, 15);
    body = top.map((r, i) => `<div class="lb-row ${r.kind === 'you' ? 'me' : ''}"><b class="lb-n">${i + 1}</b><span class="lb-who"><b>${esc(r.name)}</b>${kindChip(r.kind)}<small>${esc(r.from)} → ${esc(r.to)}${acType(r.typeId) ? ' · ' + esc(acType(r.typeId).model) : ''} · ${esc(dateStr(new Date(r.at)).slice(0, 10))}</small></span><span class="lb-v"><b class="${r.fpm < 100 ? 'green' : ''}">${r.fpm} fpm</b><small>${r.g.toFixed(2)} g</small></span></div>`).join('');
  } else {
    const by: { [k: string]: { name: string; kind: string; n: number; sum: number; best: number } } = {};
    all.forEach(r => { const x = by[r.who] = by[r.who] || { name: r.name, kind: r.kind, n: 0, sum: 0, best: 9999 }; x.n++; x.sum += r.fpm; x.best = Math.min(x.best, r.fpm); });
    const rows = Object.keys(by).map(k => by[k]).filter(x => x.n >= 2).sort((a, b) => a.sum / a.n - b.sum / b.n).slice(0, 15);
    body = rows.map((x, i) => `<div class="lb-row ${x.kind === 'you' ? 'me' : ''}"><b class="lb-n">${i + 1}</b><span class="lb-who"><b>${esc(x.name)}</b>${kindChip(x.kind)}<small>${x.n} landings · best ${x.best} fpm</small></span><span class="lb-v"><b>${Math.round(x.sum / x.n)} fpm</b><small>average</small></span></div>`).join('');
  }
  return `<div class="card lb">
    <div class="card-h"><b>Landing leaderboard</b>
      <span class="seg"><button class="${_lbView === 'best' ? 'on' : ''}" data-act="lb-view" data-v="best">Softest</button><button class="${_lbView === 'avg' ? 'on' : ''}" data-act="lb-view" data-v="avg">Best average</button></span>
      <span class="seg"><button class="${_lbWhen === 'week' ? 'on' : ''}" data-act="lb-when" data-v="week">7 days</button><button class="${_lbWhen === 'month' ? 'on' : ''}" data-act="lb-when" data-v="month">30 days</button><button class="${_lbWhen === 'all' ? 'on' : ''}" data-act="lb-when" data-v="all">All time</button></span></div>
    <div class="lb-list">${body || `<p class="fine-print">${icon('info')}No landings in this period yet. Yours, your hired pilots' and your co-op pilots' landings all count.</p>`}</div>
  </div>`;
}
ACTIONS['lb-view'] = el => { _lbView = el.getAttribute('data-v') as any; Sound.tick(); refresh(); };
ACTIONS['lb-when'] = el => { _lbWhen = el.getAttribute('data-v') as any; Sound.tick(); refresh(); };
