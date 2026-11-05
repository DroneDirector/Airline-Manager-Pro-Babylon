// Your laptop, on the desk in your office (office3d.ts). Click it and it opens the way the Operations monitor does:
// you lean in and the screen grows out of the laptop; close it and it goes back. On it, a small desktop of its own
// with a bar along the bottom (the game's time and date, unread mail, today's notes) and these apps:
//  - Mail: the court (summons, hearings, verdicts), the accident investigators' preliminary reports (can be switched
//    off), airlines asking to lease one of your aircraft (accept and the rent comes in every month), and now and then
//    a message from your family, with a choice of what to answer.
//  - Calendar: notes on the days you need to remember; on the day, you are reminded in the game.
//  - Bank: your company's account, everything in and out, your loans, and accounts of your own (savings, a reserve
//    for maintenance…) to put money aside in. Money in them isn't spent by the airline.
//  - Screenshots: the pictures you took in the 3D view (the camera button there) and added to your flights.
//  - Ranking, My career, Markets (jet fuel, spare parts, food and drink) and the Aircraft market, as in the app.
//  - Web browser: real web pages, YouTube included, with your own sign-in. On the PC inside the app's own browser
//    engine; on the phone in a browser view laid over the laptop's screen. Videos go full screen and come back.
// Everything works on the phone and on the PC.

interface LapMail { id: string; at: number; from: string; addr: string; subject: string; body: string; kind: 'court' | 'report' | 'lease' | 'family' | 'bank' | 'note' | 'spam'; box?: string; star?: boolean; ref?: string; read?: boolean; acts?: { label: string; act: string; data?: string; kind?: string }[]; done?: string; offer?: any; fam?: any }
interface CalNote { id: string; date: string; text: string; told?: boolean }
interface SubAcct { id: string; name: string; kind: string; balance: number; opened: number; tx?: { at: number; label: string; amount: number }[] }
/** A line in an account of your own's history (newest first, the last 300 kept). */
function lapSubTx(a: SubAcct, label: string, amount: number) { a.tx = a.tx || []; a.tx.unshift({ at: Date.now(), label, amount }); if (a.tx.length > 300) a.tx.length = 300; }

const LAP_APPS: [string, string, string, string][] = [
  ['mail', 'Mail', 'mail', '#3FA2F0'], ['calendar', 'Calendar', 'calendar', '#F06A6A'], ['bank', 'Bank', 'bank', '#2FBF8F'], ['docs', 'My Documents', 'news', '#4F8CF6'], ['photos', 'Photos', 'camera', '#B07CF0'], ['videos', 'Videos', 'cinema', '#E2557A'], ['recorder', 'Recorder', 'cinema', '#F0546E'],
  ['ranking', 'Ranking', 'trophy', '#F5B544'], ['career', 'My career', 'user', '#3FD0E8'], ['markets', 'Markets', 'fuel', '#E98B3A'], ['acmarket', 'Aircraft market', 'market', '#7C8CF0'], ['browser', 'Web browser', 'globe', '#5BC0EB'], ['settings', 'Settings', 'gear', '#8A97A8'],
];
const Lap: any = { app: '', root: null as HTMLElement, clock: 0, mailId: '', calMonth: '', photo: '', bankTab: 'main', web: null as any, webUrl: 'https://www.youtube.com', native: null as any };

function lapS(): any { const S: any = State; S.mail = S.mail || []; S.calendar = S.calendar || []; S.bankSubs = S.bankSubs || {}; S.mailSeen = S.mailSeen || {}; return S; }
function lapMail(): LapMail[] { return lapS().mail; }
function lapUnread(): number { return lapMail().filter(m => !m.read && !m.box).length; }   // the inbox's (not Spam, Deleted or your folders)
function lapGameNow(): Date { try { return companyDate(); } catch (e) { return new Date(); } }
function lapYmd(d: Date): string { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

/* ---------- mail ---------- */
function mailAdd(m: Partial<LapMail> & { from: string; subject: string; body: string; kind: LapMail['kind'] }) {
  const S = lapS(); const full: LapMail = Object.assign({ id: 'm-' + uid(), at: Date.now(), addr: '', read: false }, m) as LapMail;
  if (full.kind === 'spam') full.box = 'spam';
  S.mail.unshift(full); S.mail = S.mail.slice(0, 300);
  try { renderTopbar(); } catch (e) { /* not ready */ }
  lapRefresh();
  if (full.kind !== 'spam') phoneNote({ title: full.from, body: full.subject, ic: 'mail', c: '#2C8CFF', app: 'mail', id: full.id });
  return full;
}
/** A notification sliding down from the top of the phone while you are using it (new mail, messages from the
 *  bell). Tap it to open what it is about; it goes up again after a few seconds, or swipe it up. */
function phoneNote(n: { title: string; body?: string; ic?: string; c?: string; app?: string; id?: string; notice?: string; thread?: string }) {
  // on the phone in your hand, the laptop, or a monitor zoomed in, in a room (roomZoomEl)
  const R = Lap.root as HTMLElement; let os: HTMLElement = null;
  if (R && R.isConnected) os = R.querySelector(Lap.phone ? '.ph-os' : '.lap-os') as HTMLElement;
  else { try { os = roomZoomEl(); } catch (e) { os = null; } }
  if (!os) return;
  if (!(R && R.isConnected && Lap.phone)) n = Object.assign({}, n, { app: '' });   // a computer screen: messages only
  os.querySelectorAll('.ph-note').forEach(o => o.remove());
  const d = lapGameNow(), el = document.createElement('button');
  el.className = 'ph-note' + (R && R.isConnected && Lap.phone ? '' : ' desk-note'); el.type = 'button';
  el.innerHTML = `<span class="pn-ic" style="--c:${n.c || '#3FD0E8'}">${icon(n.ic || 'bell')}</span><span class="pn-t"><span class="pn-h"><b>${esc(n.title)}</b><small>${d.toTimeString().slice(0, 5)}</small></span>${n.body ? `<span class="pn-b">${esc(n.body)}</span>` : ''}</span>`;
  const gone = () => { el.classList.remove('show'); setTimeout(() => el.remove(), 350); };
  el.addEventListener('click', e => {
    e.stopPropagation(); gone();
    // a message about a flight, in a room: asked first, then out of the room and into the 3D view
    if (n.notice) { try { const N: any = (State.notices as any[]).filter(x => x.id === n.notice)[0], f = N && N.ref && State.live.filter(x => x.id === N.ref)[0]; if (f && roomNow() && roomNow() !== 'court') { roomAskFlight(f); return; } } catch (er) { /* the message */ } }
    if (n.notice) { const b = document.createElement('b'); b.setAttribute('data-id', n.notice); try { ACTIONS['open-notice'](b, null); } catch (er) { /* gone */ } return; }
    if (n.app) { if (Lap.app === 'browser') lapBrowserHide(); Lap.app = n.app; if (n.thread) { PhA.thread = n.thread; PhA.newMsg = false; } if (n.app === 'mail' && n.id) { Lap.mailId = n.id; const m = lapMail().filter(x => x.id === n.id)[0]; if (m && !m.read) { m.read = true; Store.soon(); } } Sound.tick(); lapRender(); }
  });
  let y0 = 0; el.addEventListener('pointerdown', e => { y0 = e.clientY; });
  el.addEventListener('pointermove', e => { if (y0 && y0 - e.clientY > 24) { y0 = 0; gone(); } });
  os.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
  try { if (!quietAt(Date.now())) Sound.chime(); } catch (e) { /* no sound */ }
  setTimeout(() => { if (el.isConnected) gone(); }, 5500);
}
/** Every minute (with the court's clock): new mail from the court and the investigators, lease requests, the family,
 *  and the calendar's reminders. */
const MAIL_SPAM: [string, string, string][] = [
  ['Prize Department', 'You have won a free A380!!', 'Congratulations! Your airline was chosen to receive a brand new A380 at no cost. Just send the delivery fee to claim it today.'],
  ['Cheap Fuel Direct', 'Jet fuel at half price, today only', 'Unbeatable deal: jet fuel at 50% off, cash only, no questions. Reply now.'],
  ['Pilot Lottery', 'Your licence number won the lottery', 'Your pilot licence number was drawn. Confirm your bank details to receive the winnings.'],
  ['Mr. Crown Prince', 'A business proposal of great importance', 'I wish to move 40 aircraft through your airline and share the profit. Kindly send your password.'],
];
function mailTick() {
  const S = lapS(), now = Date.now(), co: any = company(); if (!co) return;
  if (Math.random() < 0.004 && now - (S.spamAt || 0) > 6 * 3600e3) { S.spamAt = now; const x = MAIL_SPAM[Math.floor(Math.random() * MAIL_SPAM.length)]; mailAdd({ from: x[0], addr: x[0].toLowerCase().replace(/[^a-z]+/g, '') + '@offers.example', subject: x[1], body: x[2], kind: 'spam' }); }
  // the court and the investigators write to you too (the bell keeps its own copy)
  for (const n of (State.notices as any[]).slice(0, 40)) {
    if (S.mailSeen[n.id]) continue;
    const ref = String(n.ref || '');
    if (/^inv-/.test(ref)) {
      S.mailSeen[n.id] = 1;
      if ((State.settings as any).mailReports === false) continue;
      const inv = invById(ref); if (!inv) continue;
      mailAdd({ from: inv.authority.charAt(0).toUpperCase() + inv.authority.slice(1), addr: 'investigations@' + lapDomain(inv.authority), subject: n.title, body: n.body, kind: 'report', ref, acts: inv.ready ? [{ label: 'Read the report', act: 'inv-open', data: ref }] : [] });
    } else if (/^case-/.test(ref)) {
      S.mailSeen[n.id] = 1;
      const c: any = ((State as any).cases || []).filter((x: any) => x.id === ref)[0]; if (!c) continue;
      const called = /court is (in session|waiting)|summoned/i.test(n.title + ' ' + n.body);
      mailAdd({ from: c.court.charAt(0).toUpperCase() + c.court.slice(1), addr: 'clerk@' + lapDomain(c.court), subject: n.title, body: n.body, kind: 'court', ref, acts: [{ label: 'Open the case', act: 'court-open', data: ref }].concat(called ? [{ label: 'Go to court', act: 'court-attend', data: ref }] : []) });
    }
  }
  // airlines asking to lease one of your aircraft (now and then, for one standing idle)
  if (!S.leaseReqNext) S.leaseReqNext = now + 3 * 3600e3;
  if (now >= S.leaseReqNext) {
    S.leaseReqNext = now + (8 + Math.random() * 16) * 3600e3;
    const open = lapMail().filter(m => m.kind === 'lease' && !m.done).map(m => m.offer && m.offer.reg);
    const idle = fleetOf(co.id).filter((a: any) => !a.lease && !a.leasedOut && a.status === 'parked' && open.indexOf(a.reg) < 0 && !State.live.some(f => f.reg === a.reg) && !((S.aiNext || []) as any[]).some(n => n.reg === a.reg) && S.myReg[co.id] !== a.reg);
    if (idle.length && Math.random() < 0.55) lapLeaseRequest(idle[Math.floor(Math.random() * idle.length)]);
  }
  // offers that weren't answered expire
  for (const m of lapMail()) if (m.kind === 'lease' && !m.done && m.offer && now > m.offer.until) { m.done = 'expired'; }
  // the family: now and then, not often
  if (!S.famNext) S.famNext = now + (10 + Math.random() * 14) * 3600e3;
  if (now >= S.famNext) { S.famNext = now + (36 + Math.random() * 60) * 3600e3; lapFamilyMail(); }
  for (const m of lapMail()) if (m.kind === 'family' && m.fam && m.fam.replyAt && now >= m.fam.replyAt && !m.fam.answered) { m.fam.answered = true; mailAdd({ from: m.from, addr: m.addr, subject: 'Re: ' + m.subject, body: m.fam.answer, kind: 'family' }); }
  // the calendar: on the day, a reminder in the game
  const today = lapYmd(lapGameNow());
  for (const c of S.calendar as CalNote[]) {
    if (c.told || c.date > today) continue;
    c.told = true;
    State.notices.unshift({ id: uid(), kind: 'company' as any, title: `Reminder: ${c.text}`, body: `From your calendar, for ${c.date}.`, time: 'Now', at: now, read: false } as any);
    try { toast(`Reminder: ${c.text}`, 'info'); } catch (e) { /* not ready */ }
  }
}
function lapDomain(s: string): string { return String(s).toLowerCase().replace(/^the /, '').replace(/\(.*?\)/g, '').replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '').split('-').slice(0, 3).join('') + '.example'; }

/** An airline asks to lease one of your aircraft: the same terms as leasing it out from your fleet. */
function lapLeaseRequest(a: any) {
  const offers = leaseOutOffers(a), o = offers[Math.floor(Math.random() * offers.length)], years = [1, 2, 2, 3][Math.floor(Math.random() * 4)];
  const monthly = leaseOutMonthly(a, o.rate, years), t = acType(a.typeId);
  mailAdd({ from: `${o.to} · Fleet planning`, addr: 'fleet@' + lapDomain(o.to), subject: `Lease request: your ${t.model}, ${a.reg}`, kind: 'lease',
    body: `Dear ${esc(company().name)},\n\nWe would like to lease ${a.reg}, the ${t.maker} ${t.model} we have seen standing at ${a.base}, for ${years} year${years > 1 ? 's' : ''}. ${o.note}.\n\nWe offer ${money(monthly)} a month, the first month paid on signing. The aircraft comes back to ${a.base} at the end of the term.\n\nThis offer is open for three days.\n\nKind regards,\n${o.to}`,
    offer: { reg: a.reg, to: o.to, monthly, years, until: Date.now() + 3 * 864e5 }, acts: [{ label: `Accept: ${money(monthly, { compact: true })} a month`, act: 'lap-lease', data: 'yes', kind: 'primary' }, { label: 'Decline', act: 'lap-lease', data: 'no' }] });
}
function lapLeaseAnswer(m: LapMail, yes: boolean) {
  const O = m.offer, a: any = O ? plane(O.reg) : null;
  if (!O || m.done) return;
  if (!yes) { m.done = 'declined'; Store.save(); lapRender(); return; }
  if (!a || a.leasedOut || a.lease || a.status !== 'parked' || State.live.some(f => f.reg === a.reg)) { toast(`${O.reg} isn't free to lease now`, 'warn'); return; }
  const now = Date.now(), c = company(a.companyId), from = c.balance;
  a.leasedOut = { to: O.to, monthly: O.monthly, since: now, endAt: now + O.years * 12 * LEASE_MONTH, nextAt: now + LEASE_MONTH, years: O.years };
  a.status = 'leased';
  payTxn(c.id, `Lease income: ${a.reg} to ${O.to}`, O.monthly, 'lease' as any, [[`First month's rent from ${O.to}`, O.monthly]]);
  m.done = 'accepted'; Store.save(); Sound.purchase(); try { animateBalance(from, c.balance); } catch (e) { /* ignore */ } refresh();
  toast(`${a.reg} is leased to ${O.to}`, 'ok');
}
/** Open lease requests (for the Fleet screen too). */
function lapLeaseOpen(): LapMail[] { return lapMail().filter(m => m.kind === 'lease' && !m.done && m.offer && Date.now() < m.offer.until); }
function lapLeaseCardHtml(): string {
  const L = lapLeaseOpen(); if (!L.length) return '';
  return `<div class="card lap-lease-card"><div class="card-h"><b>${icon('mail')}Lease requests</b><small>Airlines asking to lease your aircraft</small></div>${L.map(m => `<div class="ll-row"><span><b>${esc(m.offer.reg)} to ${esc(m.offer.to)}</b><small>${money(m.offer.monthly)} a month for ${m.offer.years} year${m.offer.years > 1 ? 's' : ''} · open until ${esc(dateStr(new Date(m.offer.until)).slice(0, 10))}</small></span><button class="btn primary sm" data-act="lap-lease-id" data-id="${m.id}" data-v="yes">Accept</button><button class="btn ghost sm" data-act="lap-lease-id" data-id="${m.id}" data-v="no">Decline</button></div>`).join('')}</div>`;
}
ACTIONS['lap-lease-id'] = el => { const m = lapMail().filter(x => x.id === el.getAttribute('data-id'))[0]; if (m) { lapLeaseAnswer(m, el.getAttribute('data-v') === 'yes'); refresh(); } };

/** A message from your family, with answers to choose from. */
const LAP_FAMILY: { who: 'partner' | 'kid1' | 'kid2' | 'mum' | 'dad'; subject: string; body: string; replies: [string, string][] }[] = [
  { who: 'partner', subject: 'Dinner on Friday?', body: 'Hi love, are you home for dinner on Friday? I thought we could try the new place by the harbour. Let me know! x', replies: [['I\'d love that. I\'ll be home by seven.', 'Perfect, I\'ve booked a table for seven. Can\'t wait! x'], ['Work is crazy this week. Can we do Sunday instead?', 'Sunday it is then. Don\'t work too hard. x']] },
  { who: 'kid1', subject: 'School project!!', body: 'Hi! For my school project I have to interview someone with a cool job. Can I interview you about the airline? It\'s due next week.', replies: [['Of course! Let\'s do it this weekend.', 'YES! Thank you!! I\'ll write my questions tonight.'], ['I\'ll try, but I\'m very busy this week.', 'Ok... maybe I\'ll ask grandma then.']] },
  { who: 'kid2', subject: 'can we get a dog', body: 'can we pleeeease get a dog. i will walk it every day i promise. look at this one, his name is Biscuit', replies: [['Let\'s talk about it at the weekend.', 'YAY that means yes right'], ['Not right now, sweetheart.', 'ok but i am not giving up']] },
  { who: 'mum', subject: 'Saw your airline in the paper', body: 'Hello dear, your father showed me the article about your airline. We are so proud of you. When are you coming to visit? It has been too long.', replies: [['Thank you, Mum. I\'ll come next weekend.', 'Wonderful! I\'ll make your favourite. See you then.'], ['Soon, I promise. Things are hectic.', 'I understand. Look after yourself, and don\'t forget to eat properly.']] },
  { who: 'dad', subject: 'A question about planes', body: 'Quick one: my friend says a turboprop is less safe than a jet. I told him he\'s wrong. Settle it for us?', replies: [['You\'re right, Dad. Both are very safe.', 'Ha! Told him. He owes me a coffee.'], ['It depends on the airline, really.', 'Diplomatic as always. I\'ll tell him it\'s a draw.']] },
  { who: 'partner', subject: 'The car', body: 'The car made that noise again this morning. Can you book it in at the garage, or shall I?', replies: [['I\'ll book it today.', 'Thank you! You\'re a star.'], ['Could you do it? I\'m swamped.', 'Fine, I\'ll do it. You owe me one!']] },
];
function lapFamilyNames(): { [k: string]: { name: string; addr: string; rel: string } } {
  const me: any = myPilot(), base = (me && me.id) || 'me', psex: 'm' | 'f' = me && me.look && me.look.sex === 'f' ? 'm' : 'f', co: any = company();
  const n = (seed: string, sex: 'm' | 'f') => makePerson(seed, 'fo' as any, '', co.hub, sex).name.split(' ')[0];
  const last = me ? String(me.name).replace(/^(Capt\.|Captain|F\/O)\s+/i, '').split(' ').slice(-1)[0] : '';
  return { partner: { name: n('partner-' + base, psex), addr: 'home', rel: psex === 'f' ? 'your wife' : 'your husband' }, kid1: { name: n('kid1-' + base, 'f'), addr: 'kid1', rel: 'your daughter' }, kid2: { name: n('kid2-' + base, 'm'), addr: 'kid2', rel: 'your son' },
    mum: { name: 'Mum', addr: 'mum', rel: 'your mother' }, dad: { name: 'Dad', addr: 'dad', rel: 'your father' }, _last: { name: last, addr: '', rel: '' } };
}
function lapFamilyMail() {
  const S = lapS(), used: string[] = S.famUsed = S.famUsed || [];
  const left = LAP_FAMILY.filter(f => used.indexOf(f.subject) < 0), pick = (left.length ? left : LAP_FAMILY)[Math.floor(Math.random() * (left.length || LAP_FAMILY.length))];
  if (!left.length) S.famUsed = []; S.famUsed.push(pick.subject);
  const F = lapFamilyNames(), who = F[pick.who], last = (F._last.name || 'family').toLowerCase().replace(/[^a-z]/g, '');
  mailAdd({ from: `${who.name} (${who.rel})`, addr: `${who.addr}.${last}@mail.example`, subject: pick.subject, body: pick.body, kind: 'family', fam: { replies: pick.replies },
    acts: pick.replies.map((r, i) => ({ label: r[0], act: 'lap-fam', data: String(i) })) });
}

/* ---------- opening and closing (the office does the zoom) ---------- */
function lapOsHtml(): string {
  // the phone: the same apps, in a tall screen with a status bar on top and the home bar below
  if (Lap.phone) return `<div class="lap-os ph-os">
    <div class="lap-bar ph-status"></div>
    <div class="lap-area"><div class="lap-desk"></div><div class="ph-dock"></div><div class="lap-win" hidden></div></div>
    <button class="ph-home" data-act="lap-app" data-k="" aria-label="Home"><i></i></button>
  </div>`;
  return `<div class="lap-os">
    <div class="lap-area"><div class="lap-desk"></div><div class="lap-win" hidden></div></div>
    <div class="lap-bar"></div>
  </div>`;
}
/** The laptop on a small screen (a phone in landscape): laid out as on a laptop at least 1000 by 640, and shrunk as a
 *  whole to fit, so nothing in it is too big or cut off; on tablets and PCs it simply fills the screen. */
function lapFit() {
  const R = Lap.root as HTMLElement, os = R && R.querySelector('.lap-os') as HTMLElement; if (!os || Lap.phone) return;
  const W = R.clientWidth, H = R.clientHeight, k = Math.min(1, H / 640, W / 1000);
  if (k >= 0.999 || !W || !H) { os.style.zoom = ''; os.style.width = ''; os.style.height = ''; os.style.right = ''; os.style.bottom = ''; return; }
  (os.style as any).zoom = String(k); os.style.right = 'auto'; os.style.bottom = 'auto'; os.style.width = (W / k) + 'px'; os.style.height = (H / k) + 'px';
}
/** Draw the laptop into its overlay (the office calls this when it opens). */
function lapMount(root: HTMLElement, phone?: boolean) {
  Lap.root = root; Lap.app = ''; Lap.phone = !!phone; try { mailTick(); } catch (e) { /* later */ }
  root.innerHTML = lapOsHtml();
  lapRender();
  if (!Lap.phone) { lapFit(); Lap.fit$ = () => lapFit(); window.addEventListener('resize', Lap.fit$); }
  clearInterval(Lap.clock); Lap.clock = setInterval(() => { if (!Lap.root || !Lap.root.isConnected) { clearInterval(Lap.clock); return; } lapBar(); }, 10000);
}
function lapUnmount() { (Lap as any).ops = false; if (Lap.fit$) { window.removeEventListener('resize', Lap.fit$); Lap.fit$ = null; } lapBrowserClose(); clearInterval(Lap.clock); Lap.root = null; Lap.app = ''; Lap.phone = false; Lap.bankIn = false; Lap.bankBusy = false; try { clearTimeout(PhA.callT); PhA.calling = null; PhA.callState = ''; PhA.typing = ''; if (PhCall.c) phCallEnd(); } catch (e) { /* none */ } }   // closing the laptop logs you out of the bank
function lapRefresh() { if (Lap.root && Lap.root.isConnected) lapRender(true); }

function lapRender(soft?: boolean) {
  const R = Lap.root as HTMLElement; if (!R) return;
  lapBar();
  const desk = R.querySelector('.lap-desk') as HTMLElement, win = R.querySelector('.lap-win') as HTMLElement;
  desk.innerHTML = lapDeskHtml();
  const dock = R.querySelector('.ph-dock') as HTMLElement; if (dock) dock.innerHTML = phDockHtml();
  try { lapDevApply(); lapPopups(); } catch (e) { /* as it was */ }
  if (!Lap.app) { win.hidden = true; win.innerHTML = ''; return; }
  const sk = /^scr:/.test(Lap.app) ? Lap.app.slice(4) : '', A = sk ? [Lap.app, SCREENS[sk] ? SCREENS[sk].title : sk, (SCREENS[sk] && SCREENS[sk].icon) || 'ops', '#3FD0E8'] : LAP_APPS.concat(PH_APPS).filter(x => x[0] === Lap.app)[0]; if (!A) return;
  if (Lap.app === 'browser' && soft && win.querySelector('.lap-br')) { lapBrowserChrome(); return; }   // the page itself is never drawn again
  win.hidden = false;
  const body = lapAppHtml(Lap.app);
  const html = `<div class="lap-win-h"><span class="lw-ic" style="--c:${A[3]}">${icon(A[2])}</span><b>${esc(A[1])}</b><span class="lw-sp"></span><button class="lw-x" data-act="lap-app" data-k="" aria-label="Close ${esc(A[1])}">${icon('close')}</button></div><div class="lap-win-b lap-app-${Lap.app.replace(':', '-')}">${body}</div>`;
  if (soft && win.firstElementChild) patchHtml(win, html); else win.innerHTML = html;
  const sec = win.querySelector('.lap-win-b > section.screen') as HTMLElement, key = sec && sec.getAttribute('data-k');
  if (sec && key && SCREENS[key] && SCREENS[key].mount && !soft) { try { SCREENS[key].mount(sec); } catch (e) { /* shows what it can */ } }
  if (Lap.app === 'browser') lapBrowserStart();
}
function lapBar() {
  const R = Lap.root as HTMLElement; if (!R) return; const bar = R.querySelector('.lap-bar') as HTMLElement; if (!bar) return;
  const d = lapGameNow(), today = lapYmd(d), notes = (lapS().calendar as CalNote[]).filter(c => c.date === today).length, un = lapUnread();
  const D0 = lapDev(), time = D0.clock24 === false ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : d.toTimeString().slice(0, 5), date = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  if (Lap.phone) {   // the phone's status bar: the time, mail waiting, signal and battery
    patchHtml(bar, `<b class="ph-time">${time}</b><span class="ph-notch"></span><span class="ph-ind">${un ? `<i class="ph-dot" title="${un} unread">${icon('mail')}</i>` : ''}<svg viewBox="0 0 18 12" aria-hidden="true"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5" width="3" height="7" rx="1"/><rect x="10" y="2.5" width="3" height="9.5" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg><span class="ph-bat"><i style="width:${78}%"></i></span></span>`);
    return;
  }
  patchHtml(bar, `<button class="lb-home ${Lap.startOn ? 'on' : ''}" data-act="lap-start" aria-label="Start">${icon('star')}</button>
    <input class="lb-search" placeholder="Search" aria-label="Search apps, folders and files" value="${esc(Lap.searchQ || '')}" autocomplete="off">
    <div class="lb-apps">${lapDeskApps().map(a => `<button class="lb-app ${Lap.app === a[0] ? 'on' : ''}" data-act="lap-app" data-k="${a[0]}" title="${esc(a[1])}" style="--c:${a[3]}">${icon(a[2])}${a[0] === 'mail' && un ? `<i class="lb-badge">${un}</i>` : ''}</button>`).join('')}</div>
    <span class="lb-sp"></span>
    ${notes ? `<button class="lb-note" data-act="lap-app" data-k="calendar">${icon('calendar')}${notes} today</button>` : ''}
    <button class="lb-clock" data-act="lap-app" data-k="calendar"><b>${time}</b><small>${esc(date)}</small></button>
    <button class="lb-off" data-act="lap-close" aria-label="${Lap.ops ? 'Switch off the screen' : 'Close the laptop'}" title="${Lap.ops ? 'Back to your desk' : 'Close the laptop'} (Esc)">${icon('power')}</button>`);
}
/** The apps on this computer's desktop: the laptop's own, every app on your phone (what you install on one is on
 *  both), and on the Operations computer the operations screens. */
function lapDeskApps(): [string, string, string, string][] {
  const ops: [string, string, string, string][] = Lap.ops ? OPS_TABS.filter(t => SCREENS[t[0]]).map(t => ['scr:' + t[0], t[1], t[2], '#2FB4E8'] as [string, string, string, string]) : [];
  return ops.concat(LAP_APPS, PH_APPS.filter(a => !LAP_APPS.some(b => b[0] === a[0])));
}
function lapDeskHtml(): string {
  const co: any = company(), d = lapGameNow(), today = lapYmd(d), notes = (lapS().calendar as CalNote[]).filter(c => c.date >= today).sort((a, b) => a.date < b.date ? -1 : 1).slice(0, 3), un = lapUnread();
  return `${Lap.phone ? `<input class="lb-search ph-search" placeholder="Search" aria-label="Search apps and files" value="${esc(Lap.searchQ || '')}" autocomplete="off">` : ''}<div class="ld-wall" style="--c1:${co.color};--c2:${co.color2 || '#0B2A55'}"><span class="ld-brand">${esc(co.name)}</span></div>
    <div class="ld-icons">${lapDeskApps().map(a => `<button class="ld-ic" data-act="lap-app" data-k="${a[0]}"><span style="--c:${a[3]}">${icon(a[2])}${a[0] === 'mail' && un ? `<i class="lb-badge">${un}</i>` : ''}</span><b>${esc(a[1])}</b></button>`).join('')}</div>
    <div class="ld-widget"><b class="ld-time">${d.toTimeString().slice(0, 5)}</b><small>${esc(d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</small>
      <div class="ld-notes">${notes.length ? notes.map(n => `<span><i>${esc(n.date.slice(5).split('-').reverse().join('/'))}</i>${esc(n.text)}</span>`).join('') : '<span class="muted">Nothing in your calendar</span>'}</div>
      <small>${un ? `${un} unread ${un === 1 ? 'message' : 'messages'}` : 'No new mail'}</small></div>`;
}

function lapAppHtml(k: string): string {
  if (k === 'msgs' || k === 'call' || k === 'store') return phAppHtml(k);
  if (k === 'mail') return lapMailHtml();
  if (k === 'calendar') return lapCalHtml();
  if (k === 'bank') return lapBankHtml();
  if (k === 'photos' || k === 'videos' || k === 'docs') return lapExpHtml(k);
  if (k === 'recorder') return lapRecorderHtml();
  if (k === 'settings') return lapSettingsHtml();
  if (k === 'markets') return `<div class="lap-mkts">${marketsCardHtml()}</div>`;
  if (k === 'browser') return lapBrowserHtml();
  const key = /^scr:/.test(k) ? k.slice(4) : k === 'acmarket' ? 'market' : k;
  if (!SCREENS[key]) return '<p class="muted">Not available.</p>';
  return `<section class="screen screen-${key}" data-k="${key}">${SCREENS[key].render()}</section>`;
}

/* ---------- Mail ---------- */
/** Mail's folders: Inbox, Starred, Spam, Deleted, and your own. */
function mailBoxes(): { id: string; name: string; ic: string }[] {
  const S = lapS(); S.mailBoxes = S.mailBoxes || [];
  return [{ id: '', name: 'Inbox', ic: 'mail' }, { id: 'star', name: 'Starred', ic: 'star' }, { id: 'spam', name: 'Spam', ic: 'alert' }, { id: 'deleted', name: 'Deleted', ic: 'trash' }].concat((S.mailBoxes as any[]).map(b => ({ id: b.id, name: b.name, ic: 'layers' })));
}
function mailIn(box: string): LapMail[] { const L = lapMail(); return box === 'star' ? L.filter(m => m.star && m.box !== 'deleted') : L.filter(m => (m.box || '') === box); }
function lapMailHtml(): string {
  const box = Lap.mailBox || '', L = mailIn(box), cur = L.filter(m => m.id === Lap.mailId)[0];
  const kindIc: any = { court: 'shield', report: 'alert', lease: 'fleet', family: 'user', bank: 'bank', note: 'calendar', spam: 'alert' };
  const boxes = mailBoxes(), bname = (boxes.filter(b => b.id === box)[0] || boxes[0]).name;
  const S: any = State.settings, guide = !S.mailGuideSeen ? `<div class="lm-guide">${icon('info')}<span><b>New in Mail</b>${DESKTOP ? 'Drag a message onto a folder to move it. Right-click a message for Move to, Delete, Star and more.' : 'Press, then drag a message onto a folder to move it. Press and hold a message for Move to, Delete, Star and more.'} Make your own folders with New folder; Spam and Deleted keep what you put away.</span><button class="btn ghost sm" data-act="mail-guide-ok">Got it</button></div>` : '';
  const folders = `<div class="lm-boxes">${boxes.map(b => { const n = mailIn(b.id).filter(m => !m.read).length; return `<button class="lm-box ${b.id === box ? 'on' : ''}" data-act="mail-box" data-b="${b.id}" data-mail-box="${b.id}">${icon(b.ic)}<span>${esc(b.name)}</span>${n ? `<em>${n}</em>` : ''}</button>`; }).join('')}
    <button class="lm-box add" data-act="mail-newbox">${icon('plus')}<span>New folder</span></button></div>`;
  const list = L.slice(0, 150).map(m => `<button class="lm-row ${m.read ? '' : 'new'} ${cur === m ? 'on' : ''}" data-act="lap-mail" data-id="${m.id}" data-mail-it="${m.id}"><span class="lm-ic k-${m.kind}">${icon(kindIc[m.kind] || 'mail')}</span><span class="lm-t"><b>${m.star ? '★ ' : ''}${esc(m.from)}</b><span>${esc(m.subject)}</span><small>${esc(atText(m.at))}${m.done ? ' · ' + esc(m.done) : ''}</small></span></button>`).join('') || `<p class="muted lm-empty">Nothing in ${esc(bname)}.</p>`;
  const view = cur ? `<div class="lm-view"><div class="lm-vh">${Lap.phone ? `<button class="lm-back" data-act="lap-mail-back">${icon('back')}${esc(bname)}</button>` : ''}<h3>${esc(cur.subject)}</h3><small><b>${esc(cur.from)}</b>${cur.addr ? ` &lt;${esc(cur.addr)}&gt;` : ''} · ${esc(dateStr(new Date(cur.at)))}</small></div>
      <div class="lm-body">${esc(cur.body).replace(/\n/g, '<br>')}</div>
      ${cur.kind === 'family' && cur.fam && cur.fam.chosen != null ? `<div class="lm-sent"><small>You replied</small><p>${esc(cur.fam.replies[cur.fam.chosen][0])}</p></div>` : ''}
      ${cur.acts && cur.acts.length && !(cur.kind === 'lease' && cur.done) && !(cur.kind === 'family' && cur.fam && cur.fam.chosen != null) ? `<div class="lm-acts">${cur.kind === 'family' ? '<small>Reply</small>' : ''}${cur.acts.map(a => `<button class="btn ${a.kind === 'primary' ? 'primary' : 'ghost'} sm" data-act="${a.act}" data-id="${esc(a.act === 'lap-lease' || a.act === 'lap-fam' ? cur.id : (a.data || ''))}" data-v="${esc(a.data || '')}">${esc(a.label)}</button>`).join('')}</div>` : ''}
      ${cur.kind === 'lease' && cur.done ? `<p class="fine-print">${icon(cur.done === 'accepted' ? 'check' : 'info')}${cur.done === 'accepted' ? 'Accepted: the aircraft is leased out and the rent comes in every month.' : cur.done === 'declined' ? 'You declined.' : 'This offer has expired.'}</p>` : ''}
      <div class="lm-foot"><button class="btn ghost sm" data-act="mail-star" data-id="${cur.id}">${icon('star')}${cur.star ? 'Unstar' : 'Star'}</button><button class="btn ghost sm" data-act="mail-menu-btn" data-id="${cur.id}">${icon('layers')}Move to…</button><button class="btn ghost sm" data-act="lap-mail-del" data-id="${cur.id}">${icon('trash')}${box === 'deleted' ? 'Delete for good' : 'Delete'}</button></div></div>`
    : `<div class="lm-view lm-none"><span>${icon('mail')}</span><p>Choose a message.</p></div>`;
  const on = (State.settings as any).mailReports !== false;
  return `${guide}<div class="lm lm3 ${cur ? 'lm-open' : ''}">${folders}<div class="lm-list"><div class="lm-lh"><b>${esc(bname)}</b><small>${L.filter(m => !m.read).length} unread</small></div>${list}
    ${box === '' ? `<label class="lm-set"><input type="checkbox" data-act="lap-mail-reports" ${on ? 'checked' : ''}> Receive the accident investigators' preliminary reports</label>` : ''}</div>${view}</div>`;
}
ACTIONS['mail-guide-ok'] = () => { (State.settings as any).mailGuideSeen = true; Store.soon(); Sound.tick(); lapRender(true); };
ACTIONS['mail-box'] = el => { if (Lap.mailDragged) { Lap.mailDragged = false; return; } Lap.mailBox = el.getAttribute('data-b') || ''; Lap.mailId = ''; Sound.tick(); lapRender(true); };
ACTIONS['mail-newbox'] = () => { const S = lapS(), n = (window.prompt('Name of the new folder', 'Folder ' + ((S.mailBoxes || []).length + 1)) || '').trim().slice(0, 30); if (!n) return; S.mailBoxes = S.mailBoxes || []; S.mailBoxes.push({ id: 'b-' + uid(), name: n }); Store.soon(); Sound.tick(); lapRender(true); };
ACTIONS['mail-star'] = el => { const m = lapMail().filter(x => x.id === el.getAttribute('data-id'))[0]; if (!m) return; m.star = !m.star; Store.soon(); Sound.tick(); mailMenuClose(); lapRender(true); };
function mailMove(id: string, box: string) {
  const m = lapMail().filter(x => x.id === id)[0]; if (!m) return;
  if (box === 'star') { m.star = true; } else m.box = box || undefined;
  if (Lap.mailId === id && box !== (Lap.mailBox || '') && box !== 'star') Lap.mailId = '';
  Store.soon(); Sound.tick(); const b = mailBoxes().filter(x => x.id === box)[0]; toast(box === 'star' ? 'Starred' : `Moved to ${b ? b.name : 'Inbox'}`, 'ok'); lapRender(true);
}
/** The message menu: right-click, press and hold, or Move to… */
function mailMenuOpen(id: string, x: number, y: number) {
  mailMenuClose(); const m = lapMail().filter(z => z.id === id)[0]; if (!m) return;
  const el = document.createElement('div'); el.className = 'fx-menu'; el.style.left = Math.min(x, innerWidth - 220) + 'px'; el.style.top = Math.min(y, innerHeight - 300) + 'px';
  el.innerHTML = `<button data-act="mail-m-open" data-id="${id}">Open</button><button data-act="mail-star" data-id="${id}">${m.star ? 'Unstar' : 'Star'}</button><button data-act="mail-m-unread" data-id="${id}">${m.read ? 'Mark as unread' : 'Mark as read'}</button>`
    + `<button data-act="mail-m-to" data-id="${id}" data-b="${m.box === 'spam' ? '' : 'spam'}">${m.box === 'spam' ? 'Not spam' : 'Spam'}</button><button data-act="lap-mail-del" data-id="${id}">${m.box === 'deleted' ? 'Delete for good' : 'Delete'}</button>`
    + `<div class="fx-move">${mailBoxes().filter(b => b.id !== 'star' && b.id !== (m.box || '')).map(b => `<button data-act="mail-m-to" data-id="${id}" data-b="${b.id}">${icon(b.ic)}Move to ${esc(b.name)}</button>`).join('')}</div>`;
  document.body.appendChild(el); Lap.mailMenu = el; setTimeout(() => document.addEventListener('pointerdown', mailMenuAway, true), 0);
}
function mailMenuAway(e: Event) { if (Lap.mailMenu && !Lap.mailMenu.contains(e.target as Node)) mailMenuClose(); }
function mailMenuClose() { if (Lap.mailMenu) { Lap.mailMenu.remove(); Lap.mailMenu = null; } document.removeEventListener('pointerdown', mailMenuAway, true); }
ACTIONS['mail-menu-btn'] = el => { const r = el.getBoundingClientRect(); mailMenuOpen(el.getAttribute('data-id'), r.left, r.top - 260); };
ACTIONS['mail-m-open'] = el => { mailMenuClose(); const m = lapMail().filter(x => x.id === el.getAttribute('data-id'))[0]; if (!m) return; Lap.mailId = m.id; m.read = true; Store.soon(); lapRender(true); };
ACTIONS['mail-m-unread'] = el => { mailMenuClose(); const m = lapMail().filter(x => x.id === el.getAttribute('data-id'))[0]; if (!m) return; m.read = !m.read; if (!m.read && Lap.mailId === m.id) Lap.mailId = ''; Store.soon(); Sound.tick(); lapRender(true); try { renderTopbar(); } catch (e) { /* ignore */ } };
ACTIONS['mail-m-to'] = el => { mailMenuClose(); mailMove(el.getAttribute('data-id'), el.getAttribute('data-b') || ''); };
document.addEventListener('contextmenu', e => { const it = (e.target as HTMLElement).closest && (e.target as HTMLElement).closest('[data-mail-it]') as HTMLElement; if (!it) return; e.preventDefault(); mailMenuOpen(it.getAttribute('data-mail-it'), e.clientX, e.clientY); });
document.addEventListener('pointerdown', e => {
  const it = (e.target as HTMLElement).closest && (e.target as HTMLElement).closest('[data-mail-it]') as HTMLElement; if (!it || e.button > 0) return;
  const D: any = { id: it.getAttribute('data-mail-it'), it, x0: e.clientX, y0: e.clientY, touch: e.pointerType !== 'mouse', armed: e.pointerType === 'mouse', held: false, ghost: null };
  if (D.touch) D.timer = setTimeout(() => { D.armed = true; D.held = true; try { navigator.vibrate && navigator.vibrate(15); } catch (x) { /* none */ } it.classList.add('fx-lift'); }, 380);
  Lap.mailDrag = D;
});
document.addEventListener('pointermove', e => {
  const D = Lap.mailDrag; if (!D) return; const far = Math.hypot(e.clientX - D.x0, e.clientY - D.y0) > 8;
  if (!D.armed) { if (far) { clearTimeout(D.timer); Lap.mailDrag = null; } return; }
  if (!far && !D.ghost) return;
  if (!D.ghost) { D.ghost = document.createElement('div'); D.ghost.className = 'lm-ghost'; D.ghost.innerHTML = D.it.querySelector('.lm-t').innerHTML; document.body.appendChild(D.ghost); }
  D.ghost.style.left = e.clientX + 8 + 'px'; D.ghost.style.top = e.clientY + 8 + 'px'; e.preventDefault();
  document.querySelectorAll('.lm-box.over').forEach(x => x.classList.remove('over'));
  const u = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement, b = u && u.closest && u.closest('[data-mail-box]'); if (b) b.classList.add('over');
}, { passive: false });
document.addEventListener('pointerup', e => {
  const D = Lap.mailDrag; if (!D) return; Lap.mailDrag = null; clearTimeout(D.timer); D.it.classList.remove('fx-lift');
  document.querySelectorAll('.lm-box.over').forEach(x => x.classList.remove('over'));
  if (D.ghost) { D.ghost.remove(); Lap.mailDragged = true; setTimeout(() => { Lap.mailDragged = false; }, 300); const u = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement, b = u && u.closest && u.closest('[data-mail-box]') as HTMLElement; if (b) mailMove(D.id, b.getAttribute('data-mail-box') || ''); return; }
  if (D.held && D.touch) { Lap.mailDragged = true; setTimeout(() => { Lap.mailDragged = false; }, 300); mailMenuOpen(D.id, e.clientX, e.clientY); }
});
ACTIONS['lap-mail'] = el => { if (Lap.mailDragged) { Lap.mailDragged = false; return; } const m = lapMail().filter(x => x.id === el.getAttribute('data-id'))[0]; if (!m) return; Lap.mailId = m.id; if (!m.read) { m.read = true; Store.soon(); } Sound.tick(); lapRender(true); try { renderTopbar(); } catch (e) { /* ignore */ } };
ACTIONS['lap-mail-back'] = () => { Lap.mailId = ''; Sound.tick(); lapRender(true); };
ACTIONS['lap-mail-del'] = el => { mailMenuClose(); const S = lapS(), id = el.getAttribute('data-id'), m = lapMail().filter(x => x.id === id)[0]; if (!m) return; if (m.box === 'deleted') S.mail = S.mail.filter((x: LapMail) => x.id !== id); else m.box = 'deleted'; if (Lap.mailId === id) Lap.mailId = ''; Store.soon(); Sound.tick(); toast(m.box === 'deleted' && S.mail.indexOf(m) >= 0 ? 'Moved to Deleted' : 'Deleted for good', 'ok'); lapRender(true); };
ACTIONS['lap-mail-reports'] = el => { (State.settings as any).mailReports = (el as HTMLInputElement).checked; Store.soon(); };
ACTIONS['lap-lease'] = el => { const m = lapMail().filter(x => x.id === el.getAttribute('data-id'))[0]; if (m) lapLeaseAnswer(m, el.getAttribute('data-v') === 'yes'); };
ACTIONS['lap-fam'] = el => {
  const m = lapMail().filter(x => x.id === el.getAttribute('data-id'))[0]; if (!m || !m.fam || m.fam.chosen != null) return;
  const i = +el.getAttribute('data-v'); m.fam.chosen = i; m.fam.answer = m.fam.replies[i][1]; m.fam.replyAt = Date.now() + (20 + Math.random() * 100) * 60e3;
  Store.soon(); Sound.tick(); toast('Reply sent', 'ok'); lapRender(true);
};

/* ---------- Calendar ---------- */
function lapCalHtml(): string {
  const now = lapGameNow(), today = lapYmd(now), ym = Lap.calMonth || today.slice(0, 7), [y, mo] = ym.split('-').map(Number);
  const first = new Date(y, mo - 1, 1), days = new Date(y, mo, 0).getDate(), lead = (first.getDay() + 6) % 7, notes = lapS().calendar as CalNote[];
  const sel = Lap.calDay || today, cells: string[] = [];
  for (let i = 0; i < lead; i++) cells.push('<span class="lc-d off"></span>');
  for (let d = 1; d <= days; d++) {
    const k = `${ym}-${String(d).padStart(2, '0')}`, n = notes.filter(x => x.date === k);
    cells.push(`<button class="lc-d ${k === today ? 'today' : ''} ${k === sel ? 'on' : ''}" data-act="lap-cal-day" data-d="${k}"><b>${d}</b>${n.slice(0, 2).map(x => `<i>${esc(x.text)}</i>`).join('')}${n.length > 2 ? `<i>+${n.length - 2}</i>` : ''}</button>`);
  }
  const mName = first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }), dayNotes = notes.filter(x => x.date === sel);
  return `<div class="lc"><div class="lc-main"><div class="lc-h"><button class="icon-btn" data-act="lap-cal-m" data-d="-1" aria-label="Previous month">${icon('back')}</button><b>${esc(mName)}</b><button class="icon-btn" data-act="lap-cal-m" data-d="1" aria-label="Next month">${icon('chevron')}</button><button class="btn ghost sm" data-act="lap-cal-m" data-d="0">Today</button></div>
    <div class="lc-wd">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(x => `<span>${x}</span>`).join('')}</div><div class="lc-grid">${cells.join('')}</div></div>
    <div class="lc-side"><b>${esc(new Date(sel + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }))}</b>
      ${dayNotes.map(n => `<div class="lc-n"><span>${esc(n.text)}</span><button class="icon-btn" data-act="lap-cal-del" data-id="${n.id}" aria-label="Remove">${icon('trash')}</button></div>`).join('') || '<p class="muted">Nothing noted.</p>'}
      <div class="lc-add"><input class="le-in lc-in" maxlength="80" placeholder="Something to remember on this day"><button class="btn primary sm" data-act="lap-cal-add">${icon('plus')}Add</button></div>
      <p class="fine-print">${icon('info')}Days follow the game's own calendar. On the day, you are reminded in the game.</p></div></div>`;
}
ACTIONS['lap-cal-day'] = el => { Lap.calDay = el.getAttribute('data-d'); Sound.tick(); lapRender(true); };
ACTIONS['lap-cal-m'] = el => {
  const d = +el.getAttribute('data-d'); if (!d) { Lap.calMonth = ''; Lap.calDay = ''; } else { const [y, m] = (Lap.calMonth || lapYmd(lapGameNow()).slice(0, 7)).split('-').map(Number), nd = new Date(y, m - 1 + d, 1); Lap.calMonth = nd.getFullYear() + '-' + String(nd.getMonth() + 1).padStart(2, '0'); }
  Sound.tick(); lapRender(true);
};
ACTIONS['lap-cal-add'] = () => {
  const inp = Lap.root && Lap.root.querySelector('.lc-in') as HTMLInputElement, t = inp ? inp.value.trim() : ''; if (!t) return;
  const date = Lap.calDay || lapYmd(lapGameNow());
  (lapS().calendar as CalNote[]).push({ id: uid(), date, text: t, told: date < lapYmd(lapGameNow()) });
  Store.soon(); Sound.tick(); lapRender(true); toast('Noted in your calendar', 'ok');
};
ACTIONS['lap-cal-del'] = el => { const S = lapS(); S.calendar = S.calendar.filter((x: CalNote) => x.id !== el.getAttribute('data-id')); Store.soon(); Sound.tick(); lapRender(true); };

/* ---------- Bank ---------- */
function lapSubs(cid: string): SubAcct[] { const S = lapS(); return S.bankSubs[cid] = S.bankSubs[cid] || []; }
/** The bank's own sign-in page first: its name, your company as the customer, the password typed in as dots
 *  (it's the game's bank: no real password is asked for or kept), and Log in. */
const LAP_BANK = 'Nordlys Bank';
function lapBankLoginHtml(): string {
  const co: any = company();
  return `<div class="lk-login ${Lap.bankBusy ? 'busy' : ''}"><div class="lk-lbg"></div>
    <div class="lk-lcard"><div class="lk-logo"><span>${icon('bank')}</span><b>${LAP_BANK}</b><small>Internet bank for business</small></div>
      <label class="lk-f"><small>Customer</small><span>${esc(co.name)}</span></label>
      <label class="lk-f"><small>Password</small><span class="lk-dots">${'<i></i>'.repeat(9)}</span></label>
      <button class="lk-go" data-act="lap-bank-login">${Lap.bankBusy ? '<i class="lk-spin"></i>Logging in…' : 'Log in'}</button>
      <p>${icon('shield')}Secure connection · ${LAP_BANK}</p></div></div>`;
}
ACTIONS['lap-bank-login'] = () => {
  if (Lap.bankBusy || Lap.bankIn) return; Lap.bankBusy = true; Sound.tick(); lapRender(true);
  setTimeout(() => { Lap.bankBusy = false; Lap.bankIn = true; try { Sound.chime(); } catch (e) { /* quiet */ } if (Lap.app === 'bank') lapRender(); }, 1400);
};
function lapBankHtml(): string {
  if (!Lap.bankIn) return lapBankLoginHtml();
  const co: any = company(), subs = lapSubs(co.id), tab = Lap.bankTab || 'main';
  const tx = (State.txns as any[]).filter(t => t.companyId === co.id), fil = Lap.bankFilter || 'all', list = tx.filter(t => fil === 'all' || (fil === 'in' ? t.amount > 0 : t.amount < 0)).slice(0, 150);
  const inM = tx.filter(t => t.amount > 0 && Date.now() - Date.parse(t.date) < 30 * 864e5).reduce((s, t) => s + t.amount, 0), outM = tx.filter(t => t.amount < 0 && Date.now() - Date.parse(t.date) < 30 * 864e5).reduce((s, t) => s + t.amount, 0);
  const loans = (bankState().loans || []).filter(l => l.companyId === co.id), total = co.balance + subs.reduce((s, a) => s + a.balance, 0);
  const accts = `<div class="lk-accts"><button class="lk-acct ${tab === 'main' ? 'on' : ''}" data-act="lap-bank-tab" data-k="main"><small>Company account</small><b class="${co.balance < 0 ? 'red' : ''}">${money(co.balance)}</b><i>Day-to-day: the airline pays and is paid here</i></button>
    ${subs.map(a => `<button class="lk-acct ${tab === a.id ? 'on' : ''}" data-act="lap-bank-tab" data-k="${a.id}"><small>${esc(a.kind)}</small><b>${money(a.balance)}</b><i>${esc(a.name)}</i></button>`).join('')}
    <button class="lk-acct lk-new" data-act="lap-bank-tab" data-k="new">${icon('plus')}<b>New account</b><i>Savings, a reserve…</i></button></div>`;
  const opts = [['main', 'Company account']].concat(subs.map(a => [a.id, a.name])).map(o => `<option value="${o[0]}">${esc(o[1])}</option>`).join('');
  const move = `<div class="lk-move"><b>Move money</b><div class="lk-mr"><select class="le-in lk-from">${opts}</select><span>${icon('chevron')}</span><select class="le-in lk-to">${opts.replace(/value="main">/, 'value="main">').replace(/<option value="([^"]+)"/g, (s, v) => v === (tab !== 'main' && tab !== 'new' ? tab : subs[0] && subs[0].id) ? `<option selected value="${v}"` : s)}</select><input class="le-in lk-amt" type="number" min="0" step="1000" placeholder="Amount"><button class="btn primary sm" data-act="lap-bank-move">Move</button></div></div>`;
  let main = '';
  if (tab === 'new') main = `<div class="lk-newf"><b>Open an account</b><input class="le-in lk-nm" maxlength="30" placeholder="Name, for example Rainy day fund"><div class="seg lk-kind">${['Savings', 'Maintenance reserve', 'Fuel fund', 'Expansion', 'Other'].map((k, i) => `<button class="${i === 0 ? 'on' : ''}" data-act="lap-bank-kind" data-k="${k}">${k}</button>`).join('')}</div><button class="btn primary" data-act="lap-bank-open">${icon('plus')}Open the account</button><p class="fine-print">${icon('info')}Money in your own accounts is kept aside: the airline doesn't spend it until you move it back.</p></div>`;
  else if (tab !== 'main') {
    const a = subs.filter(x => x.id === tab)[0];
    if (a) {
      // its own money in and out: what was moved in, what was taken out
      const atx = (a.tx || []).slice(), known = atx.reduce((s2, t) => s2 + t.amount, 0);
      if (Math.abs(a.balance - known) > 0.5) atx.push({ at: a.opened, label: 'Balance brought forward', amount: a.balance - known });   // accounts opened before the history was kept
      const recent = (t: { at: number }) => Date.now() - t.at < 30 * 864e5;
      const aIn = atx.filter(t => t.amount > 0 && recent(t)).reduce((s2, t) => s2 + t.amount, 0), aOut = atx.filter(t => t.amount < 0 && recent(t)).reduce((s2, t) => s2 + t.amount, 0);
      const aList = atx.filter(t => fil === 'all' || (fil === 'in' ? t.amount > 0 : t.amount < 0));
      main = `<div class="lk-sub"><small>${esc(a.kind)} · opened ${esc(dateStr(new Date(a.opened)).slice(0, 10))}</small><h3>${esc(a.name)}</h3><b class="lk-big">${money(a.balance)}</b>
        <div class="lk-sum"><div><small>In, last 30 days</small><b class="green">${money(aIn)}</b></div><div><small>Out, last 30 days</small><b class="red">${money(aOut)}</b></div><div><small>In since it was opened</small><b>${money(atx.filter(t => t.amount > 0).reduce((s2, t) => s2 + t.amount, 0))}</b></div></div>
        ${move}
        <div class="lk-txh"><b>Transactions</b><span class="seg">${[['all', 'All'], ['in', 'In'], ['out', 'Out']].map(f => `<button class="${fil === f[0] ? 'on' : ''}" data-act="lap-bank-fil" data-k="${f[0]}">${f[1]}</button>`).join('')}</span></div>
        <div class="lk-tx">${aList.map(t => { const d = dateStr(new Date(t.at)); return `<div class="lk-t"><span><b>${esc(t.label)}</b><small>${esc(d.slice(0, 10))} ${esc(d.slice(11))}</small></span><b class="${t.amount < 0 ? 'red' : 'green'}">${t.amount > 0 ? '+' : ''}${money(t.amount)}</b></div>`; }).join('') || `<p class="muted">${fil === 'all' ? 'No money has come in or gone out yet. Move some in above.' : fil === 'in' ? 'Nothing has come in yet.' : 'Nothing has gone out yet.'}</p>`}</div>
        <button class="btn ghost sm" data-act="lap-bank-close" data-id="${a.id}" ${a.balance ? 'disabled title="Move the money out first"' : ''}>${icon('trash')}Close this account</button></div>`;
    }
  }
  else main = `<div class="lk-sum"><div><small>In, last 30 days</small><b class="green">${money(inM)}</b></div><div><small>Out, last 30 days</small><b class="red">${money(outM)}</b></div><div><small>All your accounts</small><b>${money(total)}</b></div>${loans.length ? `<div><small>Loans left to pay</small><b>${money(loans.reduce((s, l) => s + l.left, 0))}</b></div>` : ''}</div>
      ${move}
      <div class="lk-txh"><b>Transactions</b><span class="seg">${[['all', 'All'], ['in', 'In'], ['out', 'Out']].map(f => `<button class="${fil === f[0] ? 'on' : ''}" data-act="lap-bank-fil" data-k="${f[0]}">${f[1]}</button>`).join('')}</span></div>
      <div class="lk-tx">${list.map(t => `<div class="lk-t"><span><b>${esc(t.label)}</b><small>${esc(t.date)} ${esc(t.time || '')}</small></span><b class="${t.amount < 0 ? 'red' : 'green'}">${t.amount > 0 ? '+' : ''}${money(t.amount)}</b></div>`).join('') || '<p class="muted">No transactions yet.</p>'}</div>`;
  return `<div class="lk lk-in"><div class="lk-h"><b>${icon('bank')}${LAP_BANK}</b><small>${esc(co.name)} · ${esc(dateStr(new Date()))}</small><span class="lw-sp"></span><button class="btn ghost sm" data-act="lap-bank-out">Log out</button></div>${accts}<div class="lk-main">${main}</div></div>`;
}
ACTIONS['lap-bank-out'] = () => { Lap.bankIn = false; Sound.tick(); lapRender(); };
ACTIONS['lap-bank-tab'] = el => { Lap.bankTab = el.getAttribute('data-k'); Lap.bankKind = 'Savings'; Sound.tick(); lapRender(true); };
ACTIONS['lap-bank-fil'] = el => { Lap.bankFilter = el.getAttribute('data-k'); Sound.tick(); lapRender(true); };
ACTIONS['lap-bank-kind'] = el => { Lap.bankKind = el.getAttribute('data-k'); (el.parentElement as HTMLElement).querySelectorAll('button').forEach(b => b.classList.toggle('on', b === el)); Sound.tick(); };
ACTIONS['lap-bank-open'] = () => {
  const co: any = company(), nm = ((Lap.root && Lap.root.querySelector('.lk-nm') as HTMLInputElement) || { value: '' }).value.trim() || (Lap.bankKind || 'Savings');
  const a: SubAcct = { id: 'sa-' + uid(), name: nm, kind: Lap.bankKind || 'Savings', balance: 0, opened: Date.now() };
  lapSubs(co.id).push(a); Lap.bankTab = a.id; Store.soon(); Sound.purchase(); lapRender(true); toast(`${nm} opened`, 'ok');
};
ACTIONS['lap-bank-close'] = el => { const co: any = company(), S = lapS(); S.bankSubs[co.id] = lapSubs(co.id).filter((a: SubAcct) => a.id !== el.getAttribute('data-id') || a.balance); Lap.bankTab = 'main'; Store.soon(); lapRender(true); };
ACTIONS['lap-bank-move'] = () => {
  const R = Lap.root as HTMLElement, co: any = company(), from = (R.querySelector('.lk-from') as HTMLSelectElement).value, to = (R.querySelector('.lk-to') as HTMLSelectElement).value;
  const amt = Math.round(+(R.querySelector('.lk-amt') as HTMLInputElement).value || 0);
  if (!amt || amt < 0) { toast('Enter an amount', 'warn'); return; }
  if (from === to) { toast('Choose two different accounts', 'warn'); return; }
  const subs = lapSubs(co.id), A = subs.filter(a => a.id === from)[0], B = subs.filter(a => a.id === to)[0];
  const have = from === 'main' ? co.balance : A ? A.balance : 0;
  if (amt > have) { toast('There isn\'t that much in the account', 'warn'); return; }
  const b0 = co.balance;
  if (from === 'main') co.balance -= amt; else A.balance -= amt;
  if (to === 'main') co.balance += amt; else B.balance += amt;
  const nm = (k: string) => k === 'main' ? 'Company account' : (subs.filter(a => a.id === k)[0] || { name: '' }).name;
  // each account of your own keeps its own history of money in and out
  if (A) lapSubTx(A, to === 'main' ? 'To the company account' : `To your account: ${nm(to)}`, -amt);
  if (B) lapSubTx(B, from === 'main' ? 'From the company account' : `From your account: ${nm(from)}`, amt);
  if (from === 'main' || to === 'main') State.txns.unshift({ id: uid(), companyId: co.id, date: dateStr(new Date()).slice(0, 10), time: dateStr(new Date()).slice(11), label: from === 'main' ? `To your account: ${nm(to)}` : `From your account: ${nm(from)}`, amount: from === 'main' ? -amt : amt, kind: 'transfer' as any, lines: [] } as any);
  Store.save(); Sound.purchase(); try { animateBalance(b0, co.balance); renderTopbar(); } catch (e) { /* ignore */ } lapRender(true); toast(`${money(amt)} moved to ${nm(to)}`, 'ok');
};

/* ---------- Screenshots ---------- */
function lapPhotosFill() {
  const el = Lap.root && Lap.root.querySelector('.lap-photos') as HTMLElement; if (!el) return;
  PhotoDb.all().then(all => {
    if (!Lap.root || Lap.app !== 'photos') return;
    const cur = all.filter(p => p.id === Lap.photo)[0];
    el.innerHTML = cur ? `<div class="lp-view"><img src="${cur.data}" alt="${esc(cur.cap || 'Screenshot')}"><div class="lp-vb"><button class="btn ghost sm" data-act="lap-photo" data-id="">${icon('back')}All screenshots</button><small>${esc(cur.cap || '')} · ${esc(dateStr(new Date(cur.at)))}</small><a class="btn ghost sm" href="${cur.data}" download="screenshot-${cur.id}.jpg">${icon('download')}Save</a><button class="btn ghost sm" data-act="lap-photo-del" data-id="${cur.id}">${icon('trash')}Delete</button></div></div>`
      : all.length ? `<div class="lp-grid">${all.map(p => `<button class="lp-th" data-act="lap-photo" data-id="${p.id}"><img src="${p.thumb}" alt=""><small>${esc(dateStr(new Date(p.at)).slice(0, 16))}</small></button>`).join('')}</div>`
      : `<div class="lp-none">${icon('camera')}<p>No screenshots yet. Take one with the camera button in the 3D view, or add them to a flight in your flight log.</p></div>`;
  }).catch(() => { el.innerHTML = '<p class="muted">Screenshots can\'t be stored on this device.</p>'; });
}
ACTIONS['lap-photo'] = el => { Lap.photo = el.getAttribute('data-id') || ''; Sound.tick(); lapPhotosFill(); };
ACTIONS['lap-photo-del'] = el => { PhotoDb.del(el.getAttribute('data-id')).then(() => { Lap.photo = ''; lapPhotosFill(); toast('Screenshot deleted', 'ok'); }); };

/* ---------- the web browser ---------- */
function lapIsElectron(): boolean { return /Electron\//.test(navigator.userAgent); }
function lapNativeBrowser(): any { const cap = (window as any).Capacitor; return cap && cap.isNativePlatform && cap.isNativePlatform() && cap.Plugins && cap.Plugins.LapBrowser; }
function lapBrowserHtml(): string {
  const can = lapIsElectron() || !!lapNativeBrowser();
  return `<div class="lap-br"><div class="lap-br-bar"><button class="icon-btn" data-act="lap-web" data-k="back" aria-label="Back">${icon('back')}</button><button class="icon-btn" data-act="lap-web" data-k="fwd" aria-label="Forward">${icon('chevron')}</button><button class="icon-btn" data-act="lap-web" data-k="reload" aria-label="Reload">${icon('reload')}</button>
    <form class="lap-br-url" data-lap-url><span>${icon('globe')}</span><input class="lap-url" value="${esc(Lap.webUrl)}" spellcheck="false" autocomplete="off" aria-label="Address"></form>
    <button class="btn ghost sm" data-act="lap-web" data-k="yt">YouTube</button><i class="lap-br-load"></i></div>
    ${can ? (lapIsElectron() ? `<webview class="lap-web" src="${esc(Lap.webUrl)}" partition="persist:laptop" allowpopups></webview>` : `<div class="lap-web lap-web-native"></div>`)
      : `<div class="lap-web lap-web-off"><span>${icon('globe')}</span><p>The laptop's browser needs the latest PC app (with its own browser engine) or the phone app.</p><button class="btn primary sm" data-act="lap-web" data-k="ext">Open ${esc(Lap.webUrl.replace(/^https?:\/\//, ''))} in your browser</button></div>`}</div>`;
}
function lapBrowserStart() {
  const R = Lap.root as HTMLElement; if (!R) return;
  const w = R.querySelector('webview.lap-web') as any;
  if (w && !w._wired) {
    w._wired = true; Lap.web = w;
    const sync = () => { try { Lap.webUrl = w.getURL(); lapBrowserChrome(); } catch (e) { /* not ready */ } };
    w.addEventListener('did-navigate', sync); w.addEventListener('did-navigate-in-page', sync);
    w.addEventListener('did-start-loading', () => R.classList.add('lap-loading')); w.addEventListener('did-stop-loading', () => { R.classList.remove('lap-loading'); sync(); });
  }
  const N = lapNativeBrowser(), box = R.querySelector('.lap-web-native') as HTMLElement;
  if (N && box) {
    const rect = () => { const r = box.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, dpr: window.devicePixelRatio || 1 }; };
    if (!Lap.native) {
      Lap.native = { h: N.addListener('state', (s: any) => { Lap.webUrl = s.url || Lap.webUrl; Lap.webState = s; lapBrowserChrome(); }) };
      setTimeout(() => N.open(Object.assign({ url: Lap.webUrl }, rect())).catch(() => toast('The browser could not open', 'warn')), 60);
    } else setTimeout(() => N.show(rect()).catch(() => { /* gone */ }), 60);
    Lap.nativeFit = () => { if (Lap.app === 'browser' && Lap.root) N.setRect(rect()).catch(() => { /* gone */ }); };
    window.addEventListener('resize', Lap.nativeFit);
  }
}
function lapBrowserChrome() {
  const R = Lap.root as HTMLElement; if (!R) return; const u = R.querySelector('.lap-url') as HTMLInputElement;
  if (u && document.activeElement !== u) u.value = Lap.webUrl;
  if (Lap.webState) R.classList.toggle('lap-loading', !!Lap.webState.loading);
}
/** Away from the browser (another app, or the laptop closed): the phone's browser view hides or closes. */
function lapBrowserHide() { const N = lapNativeBrowser(); if (N && Lap.native) N.hide().catch(() => { /* gone */ }); if (Lap.nativeFit) window.removeEventListener('resize', Lap.nativeFit); }
function lapBrowserClose() {
  const N = lapNativeBrowser(); if (N && Lap.native) { N.close().catch(() => { /* gone */ }); try { Lap.native.h.then ? Lap.native.h.then((x: any) => x.remove()) : Lap.native.h.remove(); } catch (e) { /* gone */ } Lap.native = null; }
  if (Lap.nativeFit) window.removeEventListener('resize', Lap.nativeFit);
  Lap.web = null;
}
function lapGo(raw: string) {
  let u = String(raw || '').trim(); if (!u) return;
  if (!/^https?:\/\//i.test(u)) u = /^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(u) ? 'https://' + u : 'https://www.google.com/search?q=' + encodeURIComponent(u);
  Lap.webUrl = u;
  const N = lapNativeBrowser();
  if (Lap.web) { try { Lap.web.loadURL(u); } catch (e) { /* not ready */ } } else if (N && Lap.native) N.go({ url: u }).catch(() => { /* gone */ });
  else lapRender(true);
  lapBrowserChrome();
}
document.addEventListener('submit', e => { const f = e.target as HTMLElement; if (f && f.hasAttribute && f.hasAttribute('data-lap-url')) { e.preventDefault(); const i = f.querySelector('input') as HTMLInputElement; if (i) { lapGo(i.value); i.blur(); } } });
ACTIONS['lap-web'] = el => {
  const k = el.getAttribute('data-k'), N = lapNativeBrowser(), w = Lap.web; Sound.tick();
  if (k === 'yt') { lapGo('https://www.youtube.com'); return; }
  if (k === 'ext') { try { window.open(Lap.webUrl, '_blank'); } catch (e) { /* blocked */ } return; }
  if (w) { try { if (k === 'back' && w.canGoBack()) w.goBack(); if (k === 'fwd' && w.canGoForward()) w.goForward(); if (k === 'reload') w.reload(); } catch (e) { /* not ready */ } return; }
  if (N && Lap.native) (k === 'back' ? N.back() : k === 'fwd' ? N.forward() : N.reload()).catch(() => { /* gone */ });
};

/* ---------- going to a screen from where you are working ---------- */
/** A link to another screen (Needs you → hire crew, and so on) while you work at the Operations monitor, a screen in
 *  your office or your laptop: it opens right there. Returns true when it did. */
function roomGo(screen: string): boolean {
  const O: any = typeof OpsRoom !== 'undefined' ? OpsRoom : null, F: any = typeof OfficeRoom !== 'undefined' ? OfficeRoom : null;
  if (O && O.on && O.overlay && !O.zoomAnim) { opsScreenFill(screen); return true; }
  const H: any = typeof HangarRoom !== 'undefined' ? HangarRoom : null;
  if (H && H.on && H.overlay && Lap.root === H.overlay) { if (Lap.app === 'browser') lapBrowserHide(); Lap.app = 'scr:' + screen; lapRender(); return true; }
  if (F && F.on && F.overlay) {
    if (F.overlay.classList.contains('lap-screen')) { if (Lap.app === 'browser') lapBrowserHide(); Lap.app = 'scr:' + screen; lapRender(); return true; }
    const body = F.overlay.querySelector('.of-pl-body') as HTMLElement; if (!body || !SCREENS[screen]) return false;
    F.overlay.setAttribute('data-screen', screen);
    const h = F.overlay.querySelector('.of-pl-head b') as HTMLElement; if (h) h.innerHTML = `${icon(SCREENS[screen].icon || 'ops')}${esc(SCREENS[screen].title || '')}`;
    body.innerHTML = `<section class="screen screen-${screen}">${SCREENS[screen].render()}</section>`;
    try { if (SCREENS[screen].mount) SCREENS[screen].mount(body.querySelector('.screen') as HTMLElement); } catch (e) { /* shows what it can */ }
    return true;
  }
  return false;
}

/* ---------- switching apps, closing ---------- */
ACTIONS['lap-app'] = el => {
  const k = el.getAttribute('data-k') || '';
  if (k === Lap.app) return;
  if (Lap.app === 'browser') lapBrowserHide();
  Lap.app = k; Lap.photo = ''; Lap.startOn = false; Lap.searchOn = false; Lap.startFolder = ''; LapFs.open = ''; LapFs.newDoc = false; LapFs.q = ''; Sound.tick();
  lapRender();
};
ACTIONS['lap-close'] = () => { if (typeof HangarRoom !== 'undefined' && HangarRoom.on && HangarRoom.overlay) { hgScreenClose(); return; } if (typeof OpsRoom !== 'undefined' && OpsRoom.on && OpsRoom.overlay) { opsScreenClose(); return; } if (typeof ofLaptopClose === 'function') ofLaptopClose(); };
