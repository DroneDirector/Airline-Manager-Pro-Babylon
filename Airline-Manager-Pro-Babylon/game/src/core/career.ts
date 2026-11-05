// Your career as a pilot, in your own airline and in co-op: where you are (and the jumpseat to get
// elsewhere), your pay and wallet, a flight board to book your next flights, weekly challenges and group
// events, your profile with a map of everything you flew, your licence, and airport briefings.

function meCareer(): any { const me: any = myPilot(); if (!me) return {}; me.career = me.career || { wallet: 0, loc: '', earned: 0 }; return me.career; }
function locRealism(): boolean { return Mode.coop() || !!(State.settings as any).pilotLocation; }
/** Where you are now: where you last landed, or your aircraft's airport. */
function myLoc(): string { const k = meCareer(); if (k.loc) return k.loc; const a = plane((State as any).myReg[State.companyId]); return a ? a.location : company().hub; }

/* ---------- pay ---------- */
/** Pay per block hour by your level: a first officer's rate early on, a senior captain's later. */
function myPayRate(): number { const me: any = myPilot(), l = levelOf(me && me.xp || 0).level; return Math.round((90 + l * 4) * (typeof diff === 'function' ? diff().income : 1)); }
function jumpseatCost(from: string, to: string): number { const A = apt(from), B = apt(to); if (!A || !B) return 150; return Math.round(60 + gcDistanceNm(A.pos, B.pos) * 0.18); }

/** After each of your flights: pay, location, the flight board, challenges, events. */
function careerAfterMyLeg(from: string, to: string, blockMin: number, fpm: number, typeId: string) {
  const k = meCareer(), c = company();
  // flown from somewhere else than where you were: you rode the jumpseat there first
  if (locRealism() && k.loc && k.loc !== from) {
    const cost = jumpseatCost(k.loc, from);
    k.wallet -= cost;
    State.notices.unshift({ id: uid(), kind: 'pilot', title: `Jumpseat ${k.loc} → ${from}`, body: `You were at ${k.loc}, so you rode along to ${from} first: ${money(cost)} from your wallet.`, time: 'Now', at: Date.now(), read: false } as any);
  }
  k.loc = to;
  const pay = Math.round(blockMin / 60 * myPayRate());
  if (pay > 0) { k.wallet += pay; k.earned += pay; payTxn(c.id, `Flight pay: ${myPilot().name}`, -pay, 'salary', [[`${hours(blockMin)} × ${money(myPayRate())} an hour`, -pay]]); }
  // the flight board: a booking for this leg is flown
  const b = bookings().filter(x => x.by === 'you' && x.from === from && x.to === to && !x.flown)[0]; if (b) b.flown = Date.now();
  try { challengesAfterLeg(from, to, blockMin, fpm, typeId); } catch (e) { /* ignore */ }
  try { eventsAfterLeg('you', from, to); } catch (e) { /* ignore */ }
}

/* ---------- the flight board ---------- */
interface Booking { id: string; by: string; name: string; reg: string; from: string; to: string; dep: number; flown?: number }
function bookings(): Booking[] { const S: any = State; return S.bookings || (S.bookings = []); }
function bookingsAhead(): Booking[] { const now = Date.now(); return bookings().filter(b => !b.flown && b.dep > now - 6 * 3600e3).sort((a, b) => a.dep - b.dep); }
let _bk = { leg: 0, when: 2 };
function legOptions(): [string, string][] {
  const c = company(), out: [string, string][] = [];
  State.routes.filter(r => r.companyId === c.id && !r.test).forEach(r => r.legs.forEach((k, i) => { const n = r.legs[i + 1]; if (n && !out.some(o => o[0] === k && o[1] === n)) out.push([k, n]); }));
  if (!out.length) out.push([c.hub, c.hub === 'EKCH' ? 'ENGM' : 'EKCH']);
  return out;
}
function flightBoardHtml(): string {
  const legs = legOptions(), a = plane((State as any).myReg[State.companyId]), L = legs[Math.min(_bk.leg, legs.length - 1)];
  const list = bookingsAhead(), fmt = (t: number) => dateStr(new Date(t)).slice(5, 16);
  const blocked = (rank: string) => coopOn() && !coopRankAllows(myRankName(), a ? a.typeId : '');
  return `<div class="card"><div class="card-h"><b>Flight board</b><small>${coopOn() ? 'Who flies what next in the co-op' : 'Your next flights'}</small></div>
    <div class="fb-list">${list.map(b => `<div class="fb-row ${b.by === 'you' ? 'mine' : ''}"><b>${esc(fmt(b.dep))}</b><span>${esc(b.from)} → ${esc(b.to)}</span><span>${esc(b.reg)}</span><span>${esc(b.name)}</span>${b.by === 'you' ? `<button class="text-btn" data-act="bk-cancel" data-id="${esc(b.id)}">Cancel</button>` : '<span></span>'}</div>`).join('') || '<p class="muted pad">Nothing booked yet.</p>'}</div>
    <h3>Book a flight</h3>
    <div class="route-pick">${legs.slice(0, 12).map((l, i) => `<button class="rp ${i === _bk.leg ? 'on' : ''}" data-act="bk-leg" data-i="${i}"><span class="chain"><b>${esc(l[0])} → ${esc(l[1])}</b></span></button>`).join('')}</div>
    <div class="seg">${[[1, 'In an hour'], [2, 'In 2 hours'], [6, 'This evening'], [24, 'Tomorrow']].map(([h, t]) => `<button class="${_bk.when === h ? 'on' : ''}" data-act="bk-when" data-h="${h}">${t}</button>`).join('')}</div>
    <div class="modal-actions"><button class="btn primary" data-act="bk-go" ${!a || blocked('') ? 'disabled' : ''}>${icon('check')}Book ${esc(L[0])} → ${esc(L[1])}${a ? ' in ' + esc(a.reg) : ''}</button></div>
    ${blocked('') ? `<p class="fine-print">${icon('alert')}Your co-op rank (${esc(myRankName())}) doesn't allow the ${esc(acType(a.typeId).model)} yet.</p>` : ''}</div>`;
}
ACTIONS['bk-leg'] = el => { _bk.leg = +el.getAttribute('data-i'); Sound.tick(); refresh(); };
ACTIONS['bk-when'] = el => { _bk.when = +el.getAttribute('data-h'); Sound.tick(); refresh(); };
ACTIONS['bk-go'] = () => {
  const L = legOptions()[_bk.leg], a = plane((State as any).myReg[State.companyId]); if (!L || !a) return;
  const dep = Date.now() + _bk.when * 3600e3;
  // an aircraft can't be booked twice at the same time
  if (bookingsAhead().some(b => b.reg === a.reg && Math.abs(b.dep - dep) < 3 * 3600e3)) { toast(`${a.reg} is already booked around then`, 'warn'); return; }
  bookings().push({ id: uid(), by: 'you', name: myPilot().name, reg: a.reg, from: L[0], to: L[1], dep });
  try { coopPost('board', `${myPilot().name} booked ${L[0]} → ${L[1]} in ${a.reg}`); } catch (e) { /* ignore */ }
  Store.save(); Sound.tick(); refresh(); toast(`Booked: ${L[0]} → ${L[1]}, ${dateStr(new Date(dep)).slice(5, 16)}`, 'ok');
};
ACTIONS['bk-cancel'] = el => { const S: any = State; S.bookings = bookings().filter(b => b.id !== el.getAttribute('data-id')); Store.save(); refresh(); };
/** The demo co-op's pilots book their next departures on the board too. */
function coopBoardSync() {
  const c = coopState(); if (!c || !c.on) return;
  for (const m of c.members) {
    if (m.you || !c.next[m.id] || bookings().some(b => b.by === m.id && !b.flown && b.dep > Date.now() - 3600e3)) continue;
    const r = State.routes.filter(x => x.companyId === c.companyId)[0], from = m.base || company().hub, to = r ? (r.legs[r.legs.indexOf(from) + 1] || r.legs[0]) : company().hub;
    if (from !== to && c.next[m.id] > Date.now()) bookings().push({ id: uid(), by: m.id, name: m.name, reg: '', from, to, dep: c.next[m.id] });
  }
}

/* ---------- weekly challenges ---------- */
interface PilotChallenge { id: string; title: string; need: number; kind: string; arg?: number; reward: number }
const PILOT_CHALLENGES: PilotChallenge[] = [
  { id: 'butter', title: 'Land three times under 150 fpm', need: 3, kind: 'fpm', arg: 150, reward: 1500 },
  { id: 'legs', title: 'Fly five legs', need: 5, kind: 'legs', reward: 1200 },
  { id: 'long', title: 'Fly a leg longer than 1,500 nm', need: 1, kind: 'nm', arg: 1500, reward: 2000 },
  { id: 'apts', title: 'Land at four different airports', need: 4, kind: 'apts', reward: 1600 },
  { id: 'hours', title: 'Fly ten hours', need: 600, kind: 'min', reward: 2500 },
  { id: 'night', title: 'Land twice after dark (local time)', need: 2, kind: 'night', reward: 1400 },
  { id: 'short', title: 'Fly three legs under 200 nm', need: 3, kind: 'short', arg: 200, reward: 1000 },
];
function pcWeekKey(): string { const d = new Date(), j = new Date(d.getFullYear(), 0, 1); return d.getFullYear() + '-' + Math.ceil(((+d - +j) / 864e5 + j.getDay() + 1) / 7); }
function challengesNow(): PilotChallenge[] { const w = pcWeekKey(), h = _hashStr(w); const l = PILOT_CHALLENGES.slice().sort((a, b) => _hashStr(a.id + w) - _hashStr(b.id + w)); void h; return l.slice(0, 3); }
function chState(): any { const S: any = State; S.challenges = S.challenges || {}; const w = pcWeekKey(); if (!S.challenges[w]) S.challenges[w] = { prog: {}, done: {}, apts: [] }; return S.challenges[w]; }
function challengesAfterLeg(from: string, to: string, blockMin: number, fpm: number, typeId: string) {
  const st = chState(), A = apt(from), B = apt(to), nm = A && B ? gcDistanceNm(A.pos, B.pos) : 0;
  const hr = B ? (new Date().getUTCHours() + Math.round(B.pos[0] / 15) + 24) % 24 : 12;
  if (st.apts.indexOf(to) < 0) st.apts.push(to);
  for (const ch of challengesNow()) {
    if (st.done[ch.id]) continue;
    const add = ch.kind === 'fpm' ? (Math.abs(fpm) < (ch.arg || 150) ? 1 : 0) : ch.kind === 'legs' ? 1 : ch.kind === 'nm' ? (nm > (ch.arg || 0) ? 1 : 0) : ch.kind === 'min' ? blockMin
      : ch.kind === 'night' ? (hr >= 19 || hr < 6 ? 1 : 0) : ch.kind === 'short' ? (nm && nm < (ch.arg || 200) ? 1 : 0) : 0;
    st.prog[ch.id] = ch.kind === 'apts' ? st.apts.length : (st.prog[ch.id] || 0) + add;
    if (st.prog[ch.id] >= ch.need) {
      st.done[ch.id] = Date.now(); const k = meCareer(); k.wallet += ch.reward;
      const me: any = myPilot(); me.xp = (me.xp || 0) + 400;
      State.notices.unshift({ id: uid(), kind: 'pilot', title: `Challenge done: ${ch.title}`, body: `${money(ch.reward)} into your wallet and 400 experience.`, time: 'Now', at: Date.now(), read: false } as any);
      try { toast(`Challenge done: ${ch.title}`, 'ok'); Sound.chime(); } catch (e) { /* ignore */ }
    }
  }
}

/* ---------- group events (co-op) and solo events ---------- */
interface GEvent { id: string; title: string; from: string; to: string; at: number; until: number; by: string; going: string[]; done: string[]; bonus: number }
function gEvents(): GEvent[] { const S: any = State; return S.gevents || (S.gevents = []); }
let _ev = { leg: 0, when: 48 };
function eventsHtml(): string {
  const now = Date.now(), list = gEvents().filter(e => e.until > now - 864e5).sort((a, b) => a.at - b.at), me = coopOn() ? (coopMe() || {} as any).id : 'you';
  const can = !coopOn() || coopCan('events'), legs = legOptions();
  const cd = (t: number) => { const m = Math.round((t - now) / 60000); return m <= 0 ? 'on now' : m < 60 ? `in ${m} min` : m < 1440 ? `in ${Math.round(m / 60)} h` : `in ${Math.round(m / 1440)} days`; };
  const st = chState();
  return `<div class="card"><div class="card-h"><b>This week's pilot challenges</b><small>Paid into your wallet. The airline's challenges are under Jobs.</small></div>
    ${challengesNow().map(ch => { const p = Math.min(ch.need, st.prog[ch.id] || 0); return `<div class="ch-item ${st.done[ch.id] ? 'done' : ''}"><span>${icon(st.done[ch.id] ? 'check' : 'trophy')}<b>${esc(ch.title)}</b><small>${money(ch.reward)} and 400 experience</small></span><span class="mkt-bar"><i style="width:${(p / ch.need * 100).toFixed(0)}%"></i></span><small>${ch.kind === 'min' ? hours(p) + ' of ' + hours(ch.need) : p + ' of ' + ch.need}</small></div>`; }).join('')}</div>
    <div class="card"><div class="card-h"><b>${coopOn() ? 'Group flights and events' : 'Events'}</b><small>${coopOn() ? 'Everyone flies the same leg at the same time' : 'Fly the leg in the window for a bonus'}</small></div>
    ${list.map(e => `<div class="ev-row"><span><b>${esc(e.title)}</b><small>${esc(e.from)} → ${esc(e.to)} · ${esc(dateStr(new Date(e.at)).slice(5, 16))} (${cd(e.at)}) · ${money(e.bonus)} bonus${coopOn() ? ` · ${e.going.length} going` : ''}</small></span>
      ${e.done.indexOf(me) >= 0 ? `<span class="chip chip-green">Flown</span>` : e.going.indexOf(me) >= 0 ? `<button class="btn ghost sm" data-act="ev-rsvp" data-id="${esc(e.id)}">Can't make it</button>` : `<button class="btn primary sm" data-act="ev-rsvp" data-id="${esc(e.id)}">I'm going</button>`}</div>`).join('') || '<p class="muted pad">No events planned.</p>'}
    ${can ? `<h3>Plan an event</h3><div class="route-pick">${legs.slice(0, 8).map((l, i) => `<button class="rp ${i === _ev.leg ? 'on' : ''}" data-act="ev-leg" data-i="${i}"><span class="chain"><b>${esc(l[0])} → ${esc(l[1])}</b></span></button>`).join('')}</div>
      <div class="seg">${[[24, 'Tomorrow'], [48, 'In 2 days'], [168, 'Next week']].map(([h, t]) => `<button class="${_ev.when === h ? 'on' : ''}" data-act="ev-when" data-h="${h}">${t}</button>`).join('')}</div>
      <div class="modal-actions"><button class="btn primary" data-act="ev-new">${icon('plus')}Plan it</button></div>` : `<p class="fine-print">${icon('info')}Only the owner and the events manager plan events.</p>`}</div>`;
}
ACTIONS['ev-leg'] = el => { _ev.leg = +el.getAttribute('data-i'); Sound.tick(); refresh(); };
ACTIONS['ev-when'] = el => { _ev.when = +el.getAttribute('data-h'); Sound.tick(); refresh(); };
ACTIONS['ev-new'] = () => {
  const L = legOptions()[_ev.leg]; if (!L) return; const at = new Date(Date.now() + _ev.when * 3600e3); at.setUTCMinutes(0, 0, 0); at.setUTCHours(19);
  const A = apt(L[0]), B = apt(L[1]), names = ['Fly-in', 'Evening rush', 'Weekend shuttle', 'Group flight', 'Charter day'];
  const e: GEvent = { id: uid(), title: `${names[_hashStr(L.join()) % names.length]}: ${A ? A.city : L[0]} to ${B ? B.city : L[1]}`, from: L[0], to: L[1], at: +at, until: +at + 6 * 3600e3, by: coopOn() ? (coopMe() || {} as any).id : 'you', going: [coopOn() ? (coopMe() || {} as any).id : 'you'], done: [], bonus: 2500 };
  gEvents().push(e);
  try { coopPost('event', `New event: ${e.title}, ${dateStr(at).slice(5, 16)}`); } catch (x) { /* ignore */ }
  Store.save(); Sound.tick(); refresh(); toast('Event planned', 'ok');
};
ACTIONS['ev-rsvp'] = el => {
  const e = gEvents().filter(x => x.id === el.getAttribute('data-id'))[0]; if (!e) return; const me = coopOn() ? (coopMe() || {} as any).id : 'you';
  const i = e.going.indexOf(me); if (i >= 0) e.going.splice(i, 1); else e.going.push(me); Store.save(); Sound.tick(); refresh();
};
function eventsAfterLeg(who: string, from: string, to: string) {
  const now = Date.now(), id = who === 'you' && coopOn() ? (coopMe() || {} as any).id : who;
  for (const e of gEvents()) if (e.from === from && e.to === to && now >= e.at - 3600e3 && now <= e.until + 3 * 3600e3 && e.done.indexOf(id) < 0) {
    e.done.push(id);
    if (who === 'you') { meCareer().wallet += e.bonus; toast(`Event flown: ${e.title}. ${money(e.bonus)} bonus`, 'ok'); }
  }
}
/** The demo co-op's pilots sign up for events and fly them. */
function coopEventsSync() {
  const c = coopState(); if (!c || !c.on) return;
  for (const e of gEvents()) for (const m of c.members) {
    if (m.you || e.going.indexOf(m.id) >= 0 || _hashStr(e.id + m.id) % 3 === 0) continue;
    if (Date.now() > e.at - 24 * 3600e3) e.going.push(m.id);
    if (Date.now() > e.at + 1800e3 && Date.now() < e.until && e.done.indexOf(m.id) < 0 && _hashStr(m.id + e.id) % 5 !== 0) e.done.push(m.id);
  }
}

/* ---------- airport briefings ---------- */
const BRIEFING_SEED: { [k: string]: string } = {
  EKVG: 'Terrain on all sides and strong, gusty winds funnelling through the valley. Runway 12 has an RNP approach; expect turbulence below 2,000 ft. Go around early if not stable by 500 ft.',
  LPMA: 'Strong crosswinds from the mountains; wind limits are strictly enforced. The runway extension stands on pillars over the sea. Visual turn onto final for 05.',
  LOWI: 'Valley approach between high mountains. Use the published procedure only; no circling at night. Departure turns are critical with one engine out.',
  LXGY: 'Short runway, steep approach over the bay. Check the landing distance for your weight; wet runway is unforgiving.',
  TNCM: 'Very low approach over the beach to runway 10. Expect jet blast warnings on departure. Short runway: plan maximum braking.',
  ENSB: 'Arctic weather changes fast; snow and ice on the runway are common in winter. Check braking action before descent.',
};
function briefings(): { [icao: string]: { text: string; by: string; at: number } } { const S: any = State; if (!S.briefings) { S.briefings = {}; Object.keys(BRIEFING_SEED).forEach(k => S.briefings[k] = { text: BRIEFING_SEED[k], by: 'Chief pilot', at: Date.now() }); } return S.briefings; }
function briefingHtml(icaos: string[]): string {
  const b = briefings(), list = icaos.filter((k, i) => k && icaos.indexOf(k) === i && b[k]);
  return list.map(k => `<div class="card brief">${icon('alert')}<span><b>Briefing for ${esc(k)}${apt(k) ? ', ' + esc(apt(k).name) : ''}</b><small>${esc(b[k].text)}</small><em>${esc(b[k].by)}</em></span></div>`).join('') + notamHtml(icaos);
}
let _brf = '';
function briefingsEditHtml(): string {
  const b = briefings(), can = !coopOn() || coopCan('chief');
  return `<div class="card"><div class="card-h"><b>Airport briefings</b><small>Shown at dispatch for the airports of your next flight</small></div>
    ${Object.keys(b).sort().map(k => `<div class="ev-row"><span><b>${esc(k)}${apt(k) ? ' · ' + esc(apt(k).name) : ''}</b><small>${esc(b[k].text)}</small></span>${can ? `<button class="text-btn" data-act="brf-del" data-k="${esc(k)}">Remove</button>` : ''}</div>`).join('')}
    ${can ? `<h3>Write a briefing</h3><div class="fs-fields"><label class="field"><span>Airport (ICAO)</span><input class="le-in brf-k" maxlength="4" value="${esc(_brf)}" placeholder="EKVG"></label><label class="field"><span>Notes</span><textarea class="le-in brf-t" rows="3" placeholder="What pilots should know"></textarea></label></div><div class="modal-actions"><button class="btn primary" data-act="brf-save">${icon('check')}Save briefing</button></div>` : `<p class="fine-print">${icon('info')}In co-op the owner and the chief pilot write briefings.</p>`}</div>`;
}
ACTIONS['brf-save'] = () => {
  const k = (($('.brf-k') as HTMLInputElement).value || '').trim().toUpperCase(), t = (($('.brf-t') as HTMLTextAreaElement).value || '').trim();
  if (!/^[A-Z0-9]{3,4}$/.test(k) || !t) { toast('Enter an airport code and the notes', 'warn'); return; }
  briefings()[k] = { text: t, by: myPilot().name, at: Date.now() }; Store.save(); refresh(); toast(`Briefing saved for ${k}`, 'ok');
};
ACTIONS['brf-del'] = el => { delete briefings()[el.getAttribute('data-k')]; Store.save(); refresh(); };

/* ---------- profile ---------- */
/** The world, with every route you flew and every airport you've been to. */
let _pfZoom = false;
function worldFlightsSvg(log: any[]): string {
  const W = 1000, H = 470, top = 84, bot = -58;   // latitudes shown
  const P = (q: number[]) => [(q[0] + 180) / 360 * W, (top - q[1]) / (top - bot) * H];
  const land = LAND.map(poly => 'M' + poly.map(q => P(q).map(v => v.toFixed(1)).join(' ')).join('L') + 'Z').join('');
  const seen: { [k: string]: number } = {}, apts: { [k: string]: number } = {};
  log.forEach((l: any) => { if (!apt(l.from) || !apt(l.to) || l.from === l.to) return; const k = [l.from, l.to].sort().join('|'); seen[k] = (seen[k] || 0) + 1; apts[l.from] = (apts[l.from] || 0) + 1; apts[l.to] = (apts[l.to] || 0) + 1; });
  const arcs = Object.keys(seen).map(k => {
    const [a, b] = k.split('|'), A = apt(a).pos, B = apt(b).pos, pts: number[][] = [];
    for (let i = 0; i <= 32; i++) pts.push(P(gcInterpolate(A, B, i / 32)));
    // a route across the date line is cut where it wraps
    let d = 'M' + pts[0].map(v => v.toFixed(1)).join(' ');
    for (let i = 1; i < pts.length; i++) d += (Math.abs(pts[i][0] - pts[i - 1][0]) > W / 2 ? 'M' : 'L') + pts[i].map(v => v.toFixed(1)).join(' ');
    return `<path d="${d}" stroke="var(--cyan)" stroke-opacity="${Math.min(0.95, 0.35 + seen[k] * 0.12)}" stroke-width="${Math.min(3.5, 1.2 + seen[k] * 0.25)}" fill="none" stroke-linecap="round"/>`;
  }).join('');
  const dots = Object.keys(apts).map(k => { const p = P(apt(k).pos), r = Math.min(6, 2.6 + Math.sqrt(apts[k]) * 0.6); return `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${r.toFixed(1)}" fill="#fff" stroke="var(--cyan)" stroke-width="1.2"><title>${esc(k)}${apt(k) ? ' · ' + esc(apt(k).name) : ''}: ${apts[k]} visit${apts[k] > 1 ? 's' : ''}</title></circle>`; }).join('');
  const labels = Object.keys(apts).sort((a, b) => apts[b] - apts[a]).slice(0, 12).map(k => { const p = P(apt(k).pos); return `<text x="${(p[0] + 6).toFixed(1)}" y="${(p[1] - 6).toFixed(1)}" font-size="11" fill="var(--ink-2)">${esc(k)}</text>`; }).join('');
  const grat = [-30, 0, 30, 60].map(la => { const y = P([0, la])[1]; return `<line x1="0" x2="${W}" y1="${y}" y2="${y}" stroke="rgba(255,255,255,.05)"/>`; }).join('') + [-120, -60, 0, 60, 120].map(lo => { const x = P([lo, 0])[0]; return `<line y1="0" y2="${H}" x1="${x}" x2="${x}" stroke="rgba(255,255,255,.05)"/>`; }).join('');
  return `<svg class="pf-map pf-world" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${grat}<path d="${land}" fill="rgba(120,160,200,.16)" stroke="rgba(150,190,230,.28)" stroke-width=".6"/>${arcs}${dots}${labels}</svg>`;
}
ACTIONS['pf-zoom'] = () => { _pfZoom = !_pfZoom; Sound.tick(); refresh(); };
function flightsMapSvg(log: any[]): string {
  const pts: number[][][] = []; log.slice(0, 300).forEach(l => { const A = apt(l.from), B = apt(l.to); if (A && B && l.from !== l.to) pts.push([A.pos, B.pos]); });
  if (!pts.length) return '<p class="muted pad">Your flights show up here as a map.</p>';
  let x0 = 180, x1 = -180, y0 = 90, y1 = -90; pts.forEach(p => p.forEach(q => { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }));
  const pad = 2, W = 600, H = 300, sx = W / Math.max(4, x1 - x0 + 2 * pad), sy = H / Math.max(3, y1 - y0 + 2 * pad), s = Math.min(sx, sy * 1.4);
  const P = (q: number[]) => [(q[0] - x0 + pad) * s, H - (q[1] - y0 + pad) * s / 1.4];
  const count: { [k: string]: number } = {}; pts.forEach(p => { const k = p.map(q => q.join()).sort().join('|'); count[k] = (count[k] || 0) + 1; });
  const apts: { [k: string]: number[] } = {}; log.forEach(l => [l.from, l.to].forEach((k: string) => { const A = apt(k); if (A) apts[k] = A.pos; }));
  return `<svg class="pf-map" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${Object.keys(count).map(k => { const [a, b] = k.split('|').map(x => x.split(',').map(Number)); const pa = P(a), pb = P(b), mx = (pa[0] + pb[0]) / 2, my = (pa[1] + pb[1]) / 2 - Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) * 0.12;
    return `<path d="M${pa[0].toFixed(1)} ${pa[1].toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${pb[0].toFixed(1)} ${pb[1].toFixed(1)}" stroke="var(--cyan)" stroke-opacity="${Math.min(0.9, 0.25 + count[k] * 0.12)}" stroke-width="${Math.min(4, 1 + count[k] * 0.3)}" fill="none"/>`; }).join('')}
    ${Object.keys(apts).map(k => { const p = P(apts[k]); return `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3" fill="#fff"/><text x="${(p[0] + 5).toFixed(1)}" y="${(p[1] - 5).toFixed(1)}" font-size="10" fill="var(--ink-2)">${esc(k)}</text>`; }).join('')}</svg>`;
}
function profileHtml(): string {
  const me: any = myPilot(), k = meCareer(), c = company(), log = State.logbook.filter((l: any) => !l.coopBy && l.atc !== 'Co-op' && (!plane(l.reg) || plane(l.reg).companyId === c.id));
  const land = log.filter(l => l.landingFpm), avg = land.length ? Math.round(land.reduce((s, l) => s + Math.abs(l.landingFpm), 0) / land.length) : 0;
  const fav: { [t: string]: number } = {}; log.forEach((l: any) => { const ty = l.typeId || (plane(l.reg) || {} as any).typeId; if (ty) fav[ty] = (fav[ty] || 0) + 1; }); const favT = Object.keys(fav).sort((a, b) => fav[b] - fav[a])[0];
  const lic = (me.types || []) as string[];
  return `<div class="card pf"><div class="pf-head"><span class="pf-av">${avatarSvg(me.look, 'captain', { view: 'bust', accent: c.color, still: true })}</span>
      <span><h2>${esc(me.name)}</h2><small>${esc(levelTitle(me))}${coopOn() ? ' · co-op rank: ' + esc(myRankName()) : ''} · ${natLabel(me.nat)}</small></span></div>
    <div class="kv-row"><div><small>Flights</small><b>${num(log.length)}</b></div><div><small>Hours</small><b>${hours(me.hoursMin || 0)}</b></div><div><small>Average landing</small><b>${avg} fpm</b></div><div><small>Favourite aircraft</small><b>${favT ? esc(acType(favT).model) : '—'}</b></div><div><small>Wallet</small><b class="${k.wallet >= 0 ? 'green' : 'red'}">${money(k.wallet)}</b></div><div><small>Pay</small><b>${money(myPayRate())}/h</b></div></div>
    <div class="pf-map-h"><b>Where you've flown</b><small>${Object.keys(log.reduce((m: any, l: any) => { m[l.from] = 1; m[l.to] = 1; return m; }, {})).length} airports, ${new Set(log.map((l: any) => apt(l.to) ? apt(l.to).country : '')).size} countries</small><span class="seg"><button class="${_pfZoom ? '' : 'on'}" data-act="pf-zoom">World</button><button class="${_pfZoom ? 'on' : ''}" data-act="pf-zoom">My area</button></span></div>
    ${_pfZoom ? flightsMapSvg(log) : worldFlightsSvg(log)}
    <h3>Licence</h3><div class="lic">${lic.map(t => acType(t) ? `<span class="chip chip-green">${icon('check')}${esc(acType(t).model)}</span>` : '').join('') || '<small class="muted">No type ratings yet. Your first flight on a type is your check ride: land under 400 fpm and 1.6 g without damage.</small>'}</div>
    <h3>Where you are</h3><div class="ev-row"><span><b>${esc(myLoc())}${apt(myLoc()) ? ' · ' + esc(apt(myLoc()).name) : ''}</b><small>${locRealism() ? 'Your next flight starts here; flying from elsewhere means a jumpseat ride first, paid from your wallet.' : 'Pilot location is off (Settings → Economy): you can start anywhere.'}</small></span>
      ${locRealism() ? `<button class="btn ghost sm" data-act="js-open">${icon('swap')}Jumpseat</button>` : ''}</div>
    ${(() => { const id = coopOn() ? (coopMe() as any).id : me.id, aw = awardsOf(id); return aw.length ? `<h3>Awards</h3>${aw.slice().reverse().map(a => `<div class="ev-row"><span><b>${icon('trophy')} ${esc(a.title)}</b><small>${esc(a.why)} · ${esc(a.by)}</small></span></div>`).join('')}` : ''; })()}
    <h3>Screenshots</h3>${photoStrip('*')}
  </div>`;
}
ACTIONS['js-open'] = () => {
  const c = company(), here = myLoc(), opts = companyBases(c.id).concat(legOptions().map(l => l[1])).filter((k, i, l) => k !== here && l.indexOf(k) === i).slice(0, 10);
  openLayer('modal', `<div class="modal-head"><div><h2>Jumpseat from ${esc(here)}</h2><small>Ride along on a flight to another airport. Paid from your wallet.</small></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
    <div class="modal-body"><div class="route-pick">${opts.map(k => `<button class="rp" data-act="js-go" data-k="${esc(k)}"><span class="chain"><b>${esc(k)}${apt(k) ? ' · ' + esc(apt(k).city) : ''}</b><em>${money(jumpseatCost(here, k))}</em></span></button>`).join('')}</div></div>`, { cls: 'narrow' });
};
ACTIONS['js-go'] = el => { const k = el.getAttribute('data-k'), w = meCareer(), cost = jumpseatCost(myLoc(), k); w.wallet -= cost; w.loc = k; Store.save(); closeAll(); refresh(); toast(`You're at ${k} now (${money(cost)} from your wallet)`, 'ok'); };

/* ---------- the My career screen ---------- */
let _carTab = 'profile';
SCREENS.career = {
  title: 'My career', icon: 'user',
  render() {
    const tabs: [string, string][] = [['profile', 'Profile'], ['board', 'Flight board'], ['events', 'Events and challenges'], ['brief', 'Airport briefings']];
    return `<div class="screen-head"><div><h1>My career</h1><p class="sub">${esc(myPilot().name)}${coopOn() ? ' · co-op' : ''}</p></div></div>
      ${typeof placesCardHtml === 'function' ? placesCardHtml() : ''}
      <div class="filter-row">${tabs.map(t => `<button class="fchip ${_carTab === t[0] ? 'on' : ''}" data-act="car-tab" data-t="${t[0]}">${t[1]}</button>`).join('')}</div>
      ${_carTab === 'board' ? flightBoardHtml() : _carTab === 'events' ? eventsHtml() : _carTab === 'brief' ? briefingsEditHtml() : profileHtml()}`;
  },
};
ACTIONS['car-tab'] = el => { _carTab = el.getAttribute('data-t'); Sound.tick(); refresh(); };
