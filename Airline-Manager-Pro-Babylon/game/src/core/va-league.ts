// The airline league, Airline of the Month and of the Year, and the monthly report.
//
// Every month your airline is measured against the other (made-up) airlines flying their own schedules:
// on-time departures, flight scores, landings, popularity and how much flying was done. The best airline
// of the month (at least 15 flights) is Airline of the Month, with the reasons, a badge and a newspaper
// story; the best over the year is Airline of the Year. At the start of each month a report shows how the
// last month went against the month before.

interface VaStats { legs: number; onTime: number; pax: number; net: number; fpmSum: number; fpmN: number; scoreSum: number; scoreN: number; pop?: number }
interface LeagueRow { name: string; you: boolean; legs: number; onTime: number; score: number; fpm: number; pop: number; pax: number; index: number; ok: boolean }
const LEAGUE_MIN_LEGS = 15;

function vaStats(month?: string): VaStats {
  const S: any = State, m = month || _monthKey(); S.vaStats = S.vaStats || {};
  return S.vaStats[m] || (S.vaStats[m] = { legs: 0, onTime: 0, pax: 0, net: 0, fpmSum: 0, fpmN: 0, scoreSum: 0, scoreN: 0 });
}
/** A leg of your airline (yours, a hired pilot's or a co-op pilot's) for the league. */
function vaStatLeg(o: { onTime: boolean; pax: number; net: number; fpm?: number; score?: number }) {
  const s = vaStats(); s.legs++; if (o.onTime) s.onTime++; s.pax += o.pax || 0; s.net += o.net || 0;
  if (o.fpm) { s.fpmSum += Math.abs(o.fpm); s.fpmN++; } if (o.score != null) { s.scoreSum += o.score; s.scoreN++; }
}
function _landQ(fpm: number): number { return clamp(100 - (fpm - 60) / 3, 0, 100); }
function _idx(r: { onTime: number; score: number; fpm: number; pop: number; legs: number }): number {
  return Math.round((r.onTime * 0.3 + r.score * 0.25 + _landQ(r.fpm) * 0.15 + r.pop * 0.15 + Math.min(100, r.legs / 60 * 100) * 0.15) * 10) / 10;
}
/** An airline's month so far (or the whole month once it's over). */
function aiAirlineMonth(A: TrafficAirline, month: string, upto: number): LeagueRow {
  const d0 = Date.parse(month + '-01T00:00:00Z'), D0 = Math.floor(d0 / 864e5), end = Math.min(upto, Date.parse(_nextMonth(month) + '-01T00:00:00Z'));
  let legs = 0, on = 0, pax = 0;
  for (let D = D0; D * 864e5 < end; D++) for (const c of A.fleet) for (const l of Traffic.day(c, D, A.quality)) {
    if (l.arr > end) continue; legs++; if (l.delayMin <= 15) on++; pax += Math.round(c.seats * (0.68 + (hashMix(c.id + D + l.num) % 25) / 100));
  }
  const r = seeded('lg:' + A.name + month), q = A.quality;
  const row: any = { name: A.name, you: false, legs, onTime: legs ? Math.round(on / legs * 1000) / 10 : 0, score: Math.round(68 + q * 26 + (r() - 0.5) * 6), fpm: Math.round(250 - q * 140 + (r() - 0.5) * 40), pop: Math.round(40 + q * 48 + (r() - 0.5) * 8), pax };
  row.index = _idx(row); row.ok = legs >= LEAGUE_MIN_LEGS; return row;
}
function _nextMonth(m: string): string { const [y, mo] = m.split('-').map(Number); return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`; }
function _prevMonth(m: string): string { const [y, mo] = m.split('-').map(Number); return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, '0')}`; }
function myLeagueRow(month: string): LeagueRow {
  const s = vaStats(month), c = company();
  const row: any = { name: c.name, you: true, legs: s.legs, onTime: s.legs ? Math.round(s.onTime / s.legs * 1000) / 10 : 0, score: s.scoreN ? Math.round(s.scoreSum / s.scoreN) : 85, fpm: s.fpmN ? Math.round(s.fpmSum / s.fpmN) : 200, pop: Math.round(s.pop != null ? s.pop : (c.reputation || 50)), pax: s.pax };
  row.index = _idx(row); row.ok = s.legs >= LEAGUE_MIN_LEGS; return row;
}
let _lgCache: { k: string; at: number; rows: LeagueRow[] } = null;
function league(month?: string, upto?: number): LeagueRow[] {
  const m = month || _monthKey(), u = upto || Date.now(), k = m + ':' + company().id + ':' + (upto ? 'end' : '');
  if (!upto && _lgCache && _lgCache.k === k && Date.now() - _lgCache.at < 600e3) { const rows = _lgCache.rows.filter(r => !r.you).concat([myLeagueRow(m)]); return rows.sort((a, b) => (+b.ok - +a.ok) || b.index - a.index); }
  // co-op: against other co-op airlines; single player: against the computer-run airlines
  const ai = Mode.coop() ? coopRivalRows(m, u) : Traffic.airlines().filter(A => !(A as any).heli).map(A => aiAirlineMonth(A, m, u));
  if (!upto) _lgCache = { k, at: Date.now(), rows: ai };
  return ai.concat([myLeagueRow(m)]).sort((a, b) => (+b.ok - +a.ok) || b.index - a.index);
}
/** Why the winner won: the categories where it led. */
function leagueWhy(rows: LeagueRow[], w: LeagueRow): string {
  const ok = rows.filter(r => r.ok), cats: [string, (r: LeagueRow) => number, (r: LeagueRow) => string][] = [
    ['the best on-time record', r => r.onTime, r => r.onTime + '% on time'], ['the highest flight scores', r => r.score, r => r.score + '/100 on average'],
    ['the smoothest landings', r => -r.fpm, r => r.fpm + ' fpm on average'], ['the happiest passengers', r => r.pop, r => 'popularity ' + r.pop]];
  const led = cats.map(([n, f, t]) => ({ n, t: t(w), rank: ok.filter(r => f(r) > f(w)).length })).sort((a, b) => a.rank - b.rank).slice(0, 2);
  return led.map(x => `${x.rank === 0 ? x.n : 'among the best for ' + x.n.replace(/^the (best|highest|smoothest|happiest) /, '')} (${x.t})`).join(' and ') + ` across ${num(w.legs)} flights, ahead of ${ok.length - 1} other airline${ok.length === 2 ? '' : 's'}`;
}
function vaAwards(): any[] { const S: any = State; return S.airlineAwards || (S.airlineAwards = []); }

/* ---------- the end of a month ---------- */
function vaMonthEnd(month: string) {
  const c = company(), s = vaStats(month); s.pop = Math.round(c.reputation || 0);
  const endAt = Date.parse(_nextMonth(month) + '-01T00:00:00Z'), rows = league(month, endAt), w = rows[0], me = rows.filter(r => r.you)[0], rank = rows.indexOf(me) + 1;
  let potm: any = null; try { potm = potmMonthEnd(month); } catch (e) { /* ignore */ }
  try { if (coopOn()) photoContestMonthEnd(month); } catch (e) { /* ignore */ }
  let award: any = null;
  if (w && w.ok) {
    const why = leagueWhy(rows, w);
    if (w.you) {
      award = { id: uid(), kind: 'month', period: month, title: `Airline of the Month: ${_monthName(month)}`, why: `${c.name} had ${why}.`, at: Date.now() };
      vaAwards().push(award);
      State.notices.unshift({ id: uid(), kind: 'staff', title: `Airline of the Month: ${_monthName(month)}!`, body: award.why, time: 'Now', at: Date.now(), read: false, ref: 'va-award-' + award.id } as any);
      try { Progress.popularity(2, 'Airline of the Month'); } catch (e) { /* ignore */ }
      try { newsPost(c, c.hub, { section: 'Business', headline: `${c.name} named Airline of the Month`, standfirst: `The airline beat ${rows.filter(r => r.ok).length - 1} rivals in ${_monthName(month)}.`, body: [`${c.name} had ${why}.`, `Passengers noticed: "${['They were on time, every time.', 'The smoothest landing I\'ve had in years.', 'Friendly crew, and we left on the minute.'][Math.floor(Math.random() * 3)]}"`], quote: ['We are proud of every pilot, mechanic and member of the cabin crew.', `${c.name} management`] }); } catch (e) { /* ignore */ }
      if (coopOn()) coopPost('crew', `${c.name} is Airline of the Month for ${_monthName(month)}!`);
    } else {
      try { newsPost(c, c.hub, { section: 'Business', headline: `${w.name} is Airline of the Month`, standfirst: `${_monthName(month)}: ${w.name} came out on top. ${c.name} finished ${rank > 0 ? '#' + rank : 'outside the ranking'}.`, body: [`${w.name} had ${why}.`, me.ok ? `${c.name} flew ${num(me.legs)} flights with ${me.onTime}% on time.` : `${c.name} flew too few flights to be ranked (at least ${LEAGUE_MIN_LEGS}).`] }); } catch (e) { /* ignore */ }
    }
  }
  // the report
  const S: any = State; S.vaReports = S.vaReports || [];
  const rep = { month, at: Date.now(), me, prev: myLeagueRow(_prevMonth(month)), rank, of: rows.filter(r => r.ok).length, winner: w ? w.name : '', potm, award: award ? award.id : '', net: s.net };
  S.vaReports.unshift(rep); S.vaReports = S.vaReports.slice(0, 24);
  State.notices.unshift({ id: uid(), kind: 'staff', title: `Monthly report: ${_monthName(month)}`, body: `${num(me.legs)} flights, ${me.onTime}% on time, ${money(s.net, { sign: true, compact: true })}.${me.ok ? ` League: #${rank} of ${rep.of}.` : ''} Tap for the full report.`, time: 'Now', at: Date.now(), read: false, ref: 'va-report-' + month } as any);
  if (coopOn()) coopPost('crew', `Monthly report for ${_monthName(month)}: ${num(me.legs)} flights, ${me.onTime}% on time${potm ? `, Pilot of the Month ${potm.name}` : ''}.`);
  // the end of the year
  if (month.slice(5) === '12') vaYearEnd(month.slice(0, 4));
}
function vaYearEnd(year: string) {
  const c = company(), months: string[] = []; for (let i = 1; i <= 12; i++) months.push(`${year}-${String(i).padStart(2, '0')}`);
  const tot: { [n: string]: { sum: number; n: number; you: boolean } } = {};
  months.forEach(m => { const end = Date.parse(_nextMonth(m) + '-01T00:00:00Z'); if (end > Date.now() + 864e5) return; league(m, end).forEach(r => { if (!r.ok) return; const t = tot[r.name] || (tot[r.name] = { sum: 0, n: 0, you: r.you }); t.sum += r.index; t.n++; }); });
  const ranked = Object.keys(tot).filter(k => tot[k].n >= 3).sort((a, b) => tot[b].sum / tot[b].n - tot[a].sum / tot[a].n); if (!ranked.length) return;
  const w = ranked[0], wins = vaAwards().filter(a => a.kind === 'month' && a.period.indexOf(year) === 0).length;
  if (tot[w].you) {
    const why = `${c.name} had the best results over ${tot[w].n} months of ${year}${wins ? `, with ${wins} Airline of the Month award${wins > 1 ? 's' : ''}` : ''}, ahead of ${ranked.length - 1} other airlines.`;
    const a = { id: uid(), kind: 'year', period: year, title: `Airline of the Year ${year}`, why, at: Date.now() }; vaAwards().push(a);
    State.notices.unshift({ id: uid(), kind: 'staff', title: `Airline of the Year ${year}!`, body: why, time: 'Now', at: Date.now(), read: false, ref: 'va-award-' + a.id } as any);
    try { Progress.popularity(5, 'Airline of the Year'); } catch (e) { /* ignore */ }
    try { newsPost(c, c.hub, { section: 'Front page', headline: `${c.name} is Airline of the Year`, standfirst: `The year's top honour goes to ${c.name}.`, body: [why, 'The award recognises punctuality, safe and smooth flying and passenger satisfaction over the whole year.'], quote: ['This belongs to everyone who works here.', `${c.name} management`] }); } catch (e) { /* ignore */ }
  } else { try { newsPost(c, c.hub, { section: 'Business', headline: `${w} is Airline of the Year ${year}`, standfirst: `${c.name} finished #${ranked.indexOf(c.name) + 1 || '–'} for the year.`, body: [`${w} had the best results across ${tot[w].n} months.`] }); } catch (e) { /* ignore */ } }
}

/* ---------- every minute ---------- */
function vaTick() {
  try { recencyTick(); } catch (e) { /* ignore */ }
  try { transfersDemoTick(); } catch (e) { /* ignore */ }
  const S: any = State, m = _monthKey();
  if (!S.vaMonth) { S.vaMonth = m; return; }
  if (S.vaMonth !== m) { const was = S.vaMonth; S.vaMonth = m; try { vaMonthEnd(was); } catch (e) { try { ErrorLog.add('app', 'Month end failed', String(e && (e as any).message || e)); } catch (x) { /* ignore */ } } Store.save(); try { renderTopbar(); } catch (e) { /* ignore */ } }
}
function startVa() { setTimeout(vaTick, 8000); setInterval(() => { if (!document.hidden) vaTick(); }, 60000); }

/* ---------- notices ---------- */
function vaNoticeOpen(ref: string) {
  if (/^va-potm-/.test(ref)) potmBonusPopup(ref.slice(8));
  else if (/^va-report-/.test(ref)) reportPopup(ref.slice(10));
  else if (/^va-award-/.test(ref)) awardPopup(ref.slice(9));
  else if (ref === 'va-tour') ACTIONS['tour-start'](null, null);
  else if (/^va-invest-/.test(ref)) investOffer(ref);
}
function awardPopup(id: string) {
  const a = vaAwards().filter(x => x.id === id)[0]; if (!a) return;
  openLayer('modal', `<div class="modal-head"><div><h2>${esc(a.title)}</h2><small>${esc(company().name)}</small></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
    <div class="modal-body"><div class="aw-card ${a.kind}">${icon('trophy')}<b>${a.kind === 'year' ? 'Airline of the Year' : 'Airline of the Month'}</b><small>${esc(a.kind === 'year' ? a.period : _monthName(a.period))}</small></div><p class="lede">${esc(a.why)}</p></div>`, { cls: 'narrow' });
}
function reportPopup(month: string) {
  const S: any = State, r = (S.vaReports || []).filter((x: any) => x.month === month)[0]; if (!r) return;
  const me = r.me, pv0 = r.prev, pv: any = pv0 && pv0.legs ? pv0 : { legs: 0, onTime: 0, pax: 0, score: 0, fpm: 0, pop: 0 }, row = (n: string, a: number, b: number, fmt: (v: number) => string, better: number) => { const d = a - b, good = d * better > 0; return `<div class="rep-row"><span>${n}</span><b>${fmt(a)}</b><em class="${!b || !d ? '' : good ? 'green' : 'red'}">${b ? (d > 0 ? '▲ ' : d < 0 ? '▼ ' : '') + fmt(Math.abs(d)) : ''}</em></div>`; };
  openLayer('modal', `<div class="modal-head"><div><h2>Monthly report: ${esc(_monthName(month))}</h2><small>${esc(company().name)} · against ${esc(_monthName(_prevMonth(month)))}</small></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
    <div class="modal-body"><div class="rep">
      ${row('Flights', me.legs, pv.legs, v => num(v), 1)}${row('On time', me.onTime, pv.onTime, v => v + '%', 1)}${row('Passengers', me.pax, pv.pax, v => num(v), 1)}
      ${row('Profit from flying', r.net, pv.legs ? vaStats(_prevMonth(month)).net : 0, v => money(v, { compact: true }), 1)}${row('Average flight score', me.score, pv.score, v => String(v), 1)}${row('Average landing', me.fpm, pv.fpm, v => v + ' fpm', -1)}${row('Popularity', me.pop, pv.pop, v => String(v), 1)}</div>
      <p class="lede">${me.ok ? `League: #${r.rank} of ${r.of} airlines.` : `Too few flights to be ranked in the league (at least ${LEAGUE_MIN_LEGS}).`} ${r.winner ? `Airline of the Month: ${esc(r.winner)}.` : ''}${r.potm ? ` Pilot of the Month: ${esc(r.potm.name)} (${esc(r.potm.why)}).` : ''}</p>
      ${r.award ? `<div class="modal-actions"><button class="btn primary" data-act="va-award" data-id="${esc(r.award)}">${icon('trophy')}Your award</button></div>` : ''}</div>`, { cls: 'narrow' });
}
ACTIONS['va-award'] = el => awardPopup(el.getAttribute('data-id'));
ACTIONS['va-report'] = el => reportPopup(el.getAttribute('data-m'));

/* ---------- the Airlines tab in Ranking ---------- */
function leagueHtml(): string {
  const rows = league(), m = _monthKey(), S: any = State;
  return `<div class="card"><div class="card-h"><b>Airline league: ${esc(_monthName(m))}</b><small>So far this month. Airline of the Month is decided on the 1st; at least ${LEAGUE_MIN_LEGS} flights to be ranked.</small></div>
    <div class="lg-table"><div class="lg-h"><span>#</span><span>Airline</span><span>Flights</span><span>On time</span><span>Score</span><span>Landing</span><span>Popularity</span><span>Points</span></div>
    ${rows.map((r, i) => `<div class="lg-r ${r.you ? 'you' : ''} ${r.ok ? '' : 'dim'}" ${r.you ? '' : `data-act="lg-board" data-n="${esc(r.name)}" role="button" tabindex="0"`}><span>${r.ok ? i + 1 : '–'}</span><span><b>${esc(r.name)}</b>${r.you ? ' <em>you</em>' : ''}</span><span>${num(r.legs)}</span><span>${r.onTime}%</span><span>${r.score}</span><span>${r.fpm} fpm</span><span>${r.pop}</span><span><b>${r.index}</b></span></div>`).join('')}</div>
    <small class="muted">Points: on time 30%, flight score 25%, landings 15%, popularity 15%, amount of flying 15%. Tap another airline to see its schedule for today.</small></div>
    <div class="card"><div class="card-h"><b>Awards</b></div>${vaAwards().slice().reverse().map(a => `<button class="mini-row" data-act="va-award" data-id="${esc(a.id)}">${icon('trophy')}<span><b>${esc(a.title)}</b><small>${esc(a.why)}</small></span></button>`).join('') || '<p class="muted pad">No awards yet. Be the best airline of a month to win Airline of the Month.</p>'}</div>
    <div class="card"><div class="card-h"><b>Monthly reports</b></div>${(S.vaReports || []).map((r: any) => `<button class="mini-row" data-act="va-report" data-m="${esc(r.month)}">${icon('news')}<span><b>${esc(_monthName(r.month))}</b><small>${num(r.me.legs)} flights · ${r.me.onTime}% on time${r.me.ok ? ' · #' + r.rank + ' of ' + r.of : ''}</small></span></button>`).join('') || '<p class="muted pad">The first report comes at the start of next month.</p>'}</div>`;
}
ACTIONS['lg-board'] = el => {
  const n = el.getAttribute('data-n'), A = Traffic.airlines().filter(x => x.name === n)[0]; if (!A) return;
  const now = Date.now(), legs = Traffic.board(n, now).slice(0, 80), hm = (t: number) => new Date(t).toISOString().slice(11, 16);
  const st = (l: TrafficLeg) => now >= l.arr ? 'Landed' : now >= l.dep ? 'In the air' : l.delayMin > 15 ? `Delayed ${l.delayMin} min` : now > l.sched - 40 * 60e3 ? 'Boarding' : 'Scheduled';
  openLayer('modal', `<div class="modal-head"><div><h2>${esc(n)}</h2><small>Based at ${esc(A.hub)}${apt(A.hub) ? ', ' + esc(apt(A.hub).city) : ''} · ${A.fleet.length} aircraft · today's schedule (UTC)</small></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
    <div class="modal-body">${takeoverBtnHtml(A)}<div class="lg-board">${legs.map(l => `<div class="lgb-r"><span>${hm(l.sched)}</span><b>${esc(l.craft.code + l.num)}</b><span>${esc(l.from)} → ${esc(l.to)}</span><small>${esc((acType(l.craft.typeId) || {} as any).model || '')}</small><em class="${/Delayed/.test(st(l)) ? 'amber' : /air/.test(st(l)) ? 'green' : ''}">${esc(st(l))}</em></div>`).join('') || '<p class="muted pad">No flights today.</p>'}</div></div>`, { cls: 'wide' });
};
