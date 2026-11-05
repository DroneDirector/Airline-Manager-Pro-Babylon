// Your own check rides and career milestones.
//  - Check rides: book one for a type (Crew → your licence). The next flight you fly in Flight Simulator in that
//    type is the test, graded from the simulator's data as it flies: a stable approach from 1,000 ft above the
//    runway (descending under 1,000 ft a minute, gear down, flaps out, speed within 15 kt of the type's approach
//    speed), no more than 250 kt below 10,000 ft, the landing (under 400 ft a minute and 1.6 g), and, if you fail
//    an engine in the simulator, keeping it flying (no stall warning speeds, a sensible pitch). Pass, and the type
//    is on your licence with a certificate; fail, and you can book it again.
//  - Milestones: your hours (100, 500, 1,000, 2,500, 5,000, 10,000), landings (500, 1,000, 2,500), your first
//    widebody flight and each promotion are celebrated: the reveal, the papers, and a certificate, plaque or
//    medal in Ranking → Gifts → Career Milestones.

interface RideTask { id: string; name: string; ok: boolean | null; note: string }
interface RideBook { typeId: string; at: number; fee: number; s?: any }

function rideState(): { book: RideBook; done: any[]; mile: any } { const S: any = State; return S.rides || (S.rides = { book: null, done: [], mile: {} }); }

function rideBookHtml(): string {
  const R = rideState(), me: any = myPilot(), have = (me.types || []) as string[];
  if (R.book) { const t = acType(R.book.typeId); return `<div class="ride-box"><b>${icon('clock')}Check ride booked: ${esc(t ? t.maker + ' ' + t.model : R.book.typeId)}</b><small>Fly a leg in this type in Flight Simulator: the examiner grades the approach, the speeds below 10,000 ft, the landing and, if you fail an engine, how you handle it.</small><button class="btn sm ghost" data-act="ride-cancel">Cancel</button></div>`; }
  const types = (AIRCRAFT as any[]).filter(t => have.indexOf(t.id) < 0).slice(0, 80);
  return `<div class="ride-box"><b>${icon('star')}Check ride for a new type</b><small>An examiner flies with you on your next flight in the type; pass and it goes on your licence. ${money(3500)} each attempt.</small>
    <span class="ride-row"><select class="le-in ride-type" aria-label="Type">${types.map(t => `<option value="${esc(t.id)}">${esc(t.maker + ' ' + t.model)}</option>`).join('')}</select><button class="btn sm primary" data-act="ride-book">${icon('check')}Book</button></span></div>`;
}
ACTIONS['ride-book'] = () => {
  const sel = document.querySelector('.ride-type') as HTMLSelectElement, typeId = sel && sel.value; if (!typeId) return;
  const c: any = company(); payTxn(c.id, `Check ride booked: ${(acType(typeId) || {} as any).model || typeId}`, -3500, 'training', [['Examiner\'s fee', -3500]]);
  rideState().book = { typeId, at: Date.now(), fee: 3500, s: null }; Store.soon(); Sound.tick(); toast('Check ride booked: fly it in the simulator', 'ok'); refresh();
};
ACTIONS['ride-cancel'] = () => { rideState().book = null; Store.soon(); refresh(); };

/** While you fly the booked type: what the examiner sees, every second. */
setInterval(() => {
  const R = rideState(), b = R.book; if (!b) return;
  const s: any = Link.sim; if (!s || !s.inFlight || Link.status !== 'connected') return;
  const myA: any = plane((State as any).myReg[State.companyId]); if (!myA || myA.typeId !== b.typeId) return;
  const st = b.s || (b.s = { maxVs1000: 0, gearOk: true, flapsOk: true, spdDev: 0, n1000: 0, over250: 0, engOut: false, engSlow: 0, engPitch: 0 });
  let vapp = 140; try { vapp = flightSpeeds(b.typeId, 100, 300).vapp; } catch (e) { /* default */ }
  if (!s.onGround && s.aglFt < 1000 && s.vsFpm < 0) {
    st.n1000++; st.maxVs1000 = Math.max(st.maxVs1000, -s.vsFpm);
    if (!s.gearDown) st.gearOk = false; if (!s.flapsIndex) st.flapsOk = false;
    st.spdDev = Math.max(st.spdDev, Math.abs(s.ias - vapp));
  }
  if (!s.onGround && s.altFt < 9800 && s.ias > 262) st.over250++;
  const failed = (s.engFailed || []).some((x: boolean) => x);
  if (failed && !s.onGround) { st.engOut = true; if (s.ias < vapp - 15) st.engSlow++; if (Math.abs(s.pitch) > 20) st.engPitch++; }
}, 1000);

/** After your leg: the result of a booked check ride. True when it was one (so the plain check ride is skipped). */
function rideAfterLeg(typeId: string, fpm: number, g: number, damaged: boolean): boolean {
  const R = rideState(), b = R.book; if (!b || b.typeId !== typeId) return false;
  const s = b.s || {}, t = acType(typeId), me: any = myPilot();
  const tasks: RideTask[] = [
    { id: 'stab', name: 'Stable approach from 1,000 ft', ok: s.n1000 ? s.maxVs1000 < 1000 && s.gearOk && s.flapsOk && s.spdDev <= 15 : null,
      note: s.n1000 ? `${Math.round(s.maxVs1000)} ft/min at most · gear ${s.gearOk ? 'down' : 'up!'} · flaps ${s.flapsOk ? 'out' : 'up!'} · speed within ${Math.round(s.spdDev)} kt` : 'Not seen (the app wasn\'t linked on the approach)' },
    { id: 'spd', name: 'No faster than 250 kt below 10,000 ft', ok: (s.over250 || 0) < 10, note: (s.over250 || 0) < 10 ? 'Kept to it' : `${s.over250} seconds over 250 kt` },
    { id: 'land', name: 'The landing', ok: Math.abs(fpm) < 400 && g < 1.6 && !damaged, note: `${Math.abs(fpm)} ft/min, ${g.toFixed(2)} g${damaged ? ', with damage' : ''}` },
    { id: 'eng', name: 'Engine failure', ok: s.engOut ? (s.engSlow || 0) < 5 && (s.engPitch || 0) < 5 : null, note: s.engOut ? ((s.engSlow || 0) < 5 && (s.engPitch || 0) < 5 ? 'Kept it flying' : 'Too slow or too steep with an engine out') : 'Not tested (fail an engine in the simulator to be tested)' },
  ];
  const pass = tasks.every(x => x.ok !== false);
  R.book = null; R.done.unshift({ typeId, at: Date.now(), pass, tasks }); if (R.done.length > 40) R.done.length = 40;
  if (pass) { me.types = me.types || []; if (me.types.indexOf(typeId) < 0) me.types.push(typeId); }
  Store.soon(); try { refresh(); } catch (e) { /* not ready */ }
  setTimeout(() => {
    try { closeAll(); } catch (e) { /* none */ }
    openLayer('modal', `<div class="ride-res"><h2>${pass ? icon('check') : icon('alert')}Check ride ${pass ? 'passed' : 'not passed'}: ${esc(t ? t.maker + ' ' + t.model : typeId)}</h2>
      <div class="ride-tasks">${tasks.map(x => `<div class="ride-task ${x.ok === null ? 'na' : x.ok ? 'ok' : 'bad'}">${icon(x.ok === null ? 'info' : x.ok ? 'check' : 'close')}<span><b>${esc(x.name)}</b><small>${esc(x.note)}</small></span></div>`).join('')}</div>
      <p class="muted">${pass ? `The ${esc(t ? t.model : typeId)} is on your licence.` : 'Book it again from Crew when you are ready.'}</p>
      <div class="modal-actions"><button class="btn primary" data-act="close-layer">OK</button></div></div>`, { cls: 'ride-pop' });
    if (pass) careerAward('cert', `Type rating: ${t ? t.model : typeId}`, `Check ride passed on the ${t ? t.maker + ' ' + t.model : typeId}.`, ['CERTIFICATE OF TYPE RATING', (me.name || '').toUpperCase(), `${t ? t.maker + ' ' + t.model : typeId}`, dateStr(new Date()).slice(0, 10)], '#2C5FA8');
  }, 1500);
  return true;
}

/** An award in Career Milestones, with the reveal and a newspaper story. */
function careerAward(kind: string, name: string, desc: string, lines: string[], color?: string, news?: { headline: string; standfirst: string; body: string[] }) {
  const c: any = company(), at = Date.now();
  const ex: any = { id: 'gift-' + uid(), at, cat: 'career', icao: c.hub, cid: c.id, reg: (State as any).myReg[c.id] || '', typeId: (plane((State as any).myReg[c.id]) as any || {}).typeId || 'a320neo', given: [], received: [{ kind, name, desc, lines, color, at }] };
  giftsAll().unshift(ex); Store.soon();
  State.notices.unshift({ id: uid(), kind: 'company' as any, title: name, body: desc + ' Tap to see it.', time: 'Now', at, read: false, ref: ex.id } as any);
  try { renderTopbar(); } catch (e) { /* not ready */ }
  try { badgeReveal([{ id: ex.id, group: 'pilot', cat: 'Milestone', title: name, desc, tier: 3, metric: '', need: 0, icon: 'star', img: viewerThumb(ex.id + 'bare', T => giftBuild(T, ex.received[0], ex), Gfx.pic([420, 720, 1080]), true), gift: true, rankText: kind === 'cert' ? 'Type rating' : 'Career milestone', dateText: dateStr(new Date(at)).slice(0, 10) } as any]); } catch (e) { /* later */ }
  if (news) try { newsPublish({ paper: newsPaper((apt(c.hub) as any || {}).country || ''), section: 'Aviation', place: (apt(c.hub) as any || {}).city || '', headline: news.headline, standfirst: news.standfirst, body: news.body, art: { kind: 'person', look: (myPilot() as any).look, role: 'captain', color: c.color }, companyId: c.id } as any, false); } catch (e) { /* no paper */ }
}

/** Milestones, checked now and then. */
setInterval(() => {
  try {
    if (Store.nogame() || (typeof TitleScreen !== 'undefined' && TitleScreen.on)) return;
    const R = rideState(), M = R.mile, me: any = myPilot(); if (!me) return;
    const st: any = Progress.compute(), hours = Math.floor(st['p.hours'] || 0), lands = Math.floor(st['p.flights'] || 0);
    if (M.init == null) { M.init = 1; M.hours = hours; M.lands = lands; M.rank = Progress.rankOf(Progress.pilotXp(st), PILOT_RANKS).level; M.wide = (State.logbook as any[]).some(l => { const a: any = plane(l.reg); return a && (acType(a.typeId) || {} as any).cls === 'widebody'; }); Store.soon(); return; }
    const name = me.name || 'Captain';
    for (const h of [100, 500, 1000, 2500, 5000, 10000]) if (M.hours < h && hours >= h) careerAward('plaque', `${num(h)} hours`, `${num(h)} hours in your log book.`, ['IN RECOGNITION OF', `${num(h)} FLIGHT HOURS`, name.toUpperCase(), (company() as any).name.toUpperCase(), dateStr(new Date()).slice(0, 10)], undefined,
      { headline: `${name} reaches ${num(h)} flight hours`, standfirst: `A milestone for ${(company() as any).name}'s pilot.`, body: [`${name} logged the ${num(h)}th hour this week.`] });
    for (const n of [500, 1000, 2500]) if (M.lands < n && lands >= n) careerAward('medal', `${num(n)} landings`, `${num(n)} landings flown yourself.`, [], 'fleet');
    const rank = Progress.rankOf(Progress.pilotXp(st), PILOT_RANKS);
    if (rank.level > M.rank) careerAward('cert', `Promoted: ${rank.name}`, `Promoted to ${rank.name}.`, ['CERTIFICATE OF PROMOTION', name.toUpperCase(), rank.name.toUpperCase(), dateStr(new Date()).slice(0, 10)], '#8A6A2A',
      { headline: `${name} promoted to ${rank.name}`, standfirst: `${(company() as any).name} congratulates its pilot.`, body: [`The promotion follows ${num(hours)} hours on the line.`] });
    const wide = (State.logbook as any[]).some(l => { const a: any = plane(l.reg); return a && (acType(a.typeId) || {} as any).cls === 'widebody'; });
    if (wide && !M.wide) careerAward('cert', 'Your first widebody flight', 'Your first flight in command of a widebody.', ['FIRST WIDEBODY COMMAND', name.toUpperCase(), dateStr(new Date()).slice(0, 10)], '#2C5FA8');
    M.hours = Math.max(M.hours, hours); M.lands = Math.max(M.lands, lands); M.rank = Math.max(M.rank, rank.level); M.wide = M.wide || wide; Store.soon();
  } catch (e) { /* next time */ }
}, 30000);
