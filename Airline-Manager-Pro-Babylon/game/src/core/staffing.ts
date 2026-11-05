// People and pay over time, on the real clock (it catches up when the app has been closed):
//  - Weekly payroll: every hired pilot, co-pilot, flight attendant and mechanic is paid each week,
//    taken from the balance and listed in Finance.
//  - The hiring list changes: every few hours some candidates find other jobs and new ones come
//    looking, for co-pilots, flight attendants, mechanics and captains; some days there are more.
//  - Hiring costs a recruitment and training fee (about one week's salary).
//  - Conduct reports can be switched off in Settings → Staff. Nothing that already happened is
//    removed, and court cases pause; switched back on, everything carries on where it stopped.

const POOL_ROLES: CrewRole[] = ['fo', 'fa', 'mech', 'ground'];
/** A new career opens with at least this many of every kind on the hiring list (captains, first officers, cabin
 *  crew, mechanics, ground crew). After that the list moves as usual: hired people are gone, and new ones come
 *  looking over time. */
const POOL_MIN = 20;
/** Fill the hiring list to POOL_MIN of every kind (once, as a new career opens). */
function poolTopUp(): number {
  const S: any = State; let n = 0; S.staffCandidates = S.staffCandidates || [];
  for (const role of POOL_ROLES) {
    let have = S.staffCandidates.filter((x: Staff) => x.role === role && (x as any).job !== 'security').length;
    while (have < POOL_MIN) { S.staffCandidates.push(makePerson('cand-' + role + uid(), role, '', POOL_BASES[Math.floor(Math.random() * POOL_BASES.length)])); have++; n++; }
  }
  while (State.candidates.length < POOL_MIN) { State.candidates.push(makePilotCandidate('cap' + uid())); n++; }
  n += secPoolTop(SEC_POOL_START);
  return n;
}
const POOL_BASES = ['EKVG', 'EKCH', 'ENGM', 'BIKF', 'EGLL', 'EDDF', 'PALH', 'EKBI', 'KJFK', 'CYYZ'];

/** Pay everyone for every week that has passed. */
function payrollAdvance(quiet?: boolean) {
  const S: any = State, now = Date.now(), WEEK = 7 * 864e5;
  if (!S.payNext) { S.payNext = now + WEEK; return; }
  let weeks = 0;
  if (S.finHold) return;   // a new career: no salaries until it starts
  while (S.payNext <= now && weeks < 8) {
    const d = new Date(S.payNext), day = dateStr(d).slice(0, 10);
    for (const c of State.companies) {
      const people: any[] = (State.pilots.filter((p: any) => !p.you && pilotCompany(p) === c.id) as any[]).concat(staffOf(c.id));
      let total = 0;
      for (const p of people) {
        if (!p.salary) continue;
        if ((p as any).suspended && (p as any).suspendPay === 0) continue;   // suspended without pay
        const pay = (p as any).apronLeave && (p as any).leavePay ? Math.round(p.salary * 0.6) : p.salary;   // on leave: 60% while they wait
        total += pay;
        S.txns.unshift({ id: uid(), companyId: c.id, date: day, time: '06:00', kind: 'salary', label: `Salary: ${p.name}${pay < p.salary ? ' (on leave, 60%)' : ''}`, amount: -pay, personId: p.id,
          lines: [['Weekly salary', -Math.round(pay * 0.86)], ['Pension and insurance', -Math.round(pay * 0.14)]], link: { kind: 'staff', id: p.id } });
      }
      if (!total) continue;
      const before = c.balance; c.balance -= total;
      if (!quiet && c.id === State.companyId) { try { animateBalance(before, c.balance); } catch (e) { /* not ready */ } }
      State.notices.unshift({ id: uid(), kind: 'staff' as any, title: `Payroll paid: ${money(total)}`, body: `Weekly salaries for ${people.length} people at ${c.name}.`, time: weeks ? day : 'Now', read: false } as any);
    }
    S.payNext += WEEK; weeks++;
  }
  if (S.payNext <= now) S.payNext = now + WEEK;   // away for months: catch up eight weeks at most
  if (weeks) { Store.save(); try { renderTopbar(); } catch (e) { /* ignore */ } }
}

function makePilotCandidate(seed: string): any {
  const st = makePerson(seed, 'captain', '', POOL_BASES[_hash(seed) % POOL_BASES.length]);
  const r = seeded(seed + 'x');
  const types = AIRCRAFT.filter(t => t.cls !== 'ga').map(t => t.id);
  const t1 = types[Math.floor(r() * types.length)], t2 = types[Math.floor(r() * types.length)];
  const hrs = Math.round(3000 + r() * 14000);
  return { id: 'c-' + uid(), name: st.name, rank: 'Captain', hoursMin: hrs * 60, landings: Math.round(hrs * (0.4 + r() * 0.5)), base: st.base, salary: Math.round(3600 + r() * 1600), rating: Math.round((3.6 + r() * 1.4) * 10) / 10,
    status: 'standby', types: t1 === t2 ? [t1] : [t1, t2], sex: st.sex, nat: st.nat, dob: st.dob, look: randomLook('pilot-' + st.id, st.sex, 'captain'),
    xp: startingXp(seed, 'captain', 2026 - parseInt(st.dob, 10), hrs * 60) };
}

/** The job market moves: candidates leave, new ones arrive (some days more, some days fewer). */
/** Security officers on the hiring list (at least `min`, a few new ones now and then). */
/** Security officers on the hiring list: at least 12 from the start; after that a few new ones every 2 to 4 real
 *  days (some find other jobs meanwhile). Few of them looking means they ask for more pay (up to a quarter more). */
const SEC_POOL_START = 12;
function secCands(): any[] { const S: any = State; return (S.staffCandidates || []).filter((x: any) => x.job === 'security'); }
function secMakeCand(): any {
  const p = makeSecurity('cand-sec' + uid(), POOL_BASES[Math.floor(Math.random() * POOL_BASES.length)], ''), n = secCands().length;
  const scarce = n < 4 ? 1.15 + Math.random() * 0.1 : n < 8 ? 1.05 + Math.random() * 0.05 : 1;   // scarce: dearer
  p.salary = Math.round(p.salary * scarce / 10) * 10; return p;
}
function secPoolTop(min: number): number {
  if (typeof secOn !== 'function' || !secOn()) return 0;
  const S: any = State; S.staffCandidates = S.staffCandidates || []; let n = 0;
  while (secCands().length < min) { S.staffCandidates.push(secMakeCand()); n++; }
  return n;
}
/** Every few real days: some officers on the list take other jobs, and new ones come looking. */
function secPoolAdvance() {
  if (typeof secOn !== 'function' || !secOn()) return;
  const S: any = State, now = Date.now();
  if (!S.secPool12) { S.secPool12 = 1; secPoolTop(SEC_POOL_START); }   // an older save: the list fills once
  if (!S.secPoolNext) { S.secPoolNext = now + (2 + Math.random() * 2) * 864e5; return; }
  let k = 0;
  while (S.secPoolNext <= now && k++ < 10) {
    const L = secCands(), leave = Math.floor(Math.random() * Math.min(3, Math.max(0, L.length - 6)));
    for (let i = 0; i < leave; i++) { const g = L.splice(Math.floor(Math.random() * L.length), 1)[0]; S.staffCandidates = S.staffCandidates.filter((x: any) => x !== g); }
    const come = Math.min(3 + Math.floor(Math.random() * 4), Math.max(0, 18 - secCands().length));
    for (let i = 0; i < come; i++) S.staffCandidates.push(secMakeCand());
    S.secPoolNext += (2 + Math.random() * 2) * 864e5;
  }
}
function poolAdvance() {
  const S: any = State, now = Date.now();
  if (S.poolFill) { S.poolFill = false; if (poolTopUp()) Store.soon(); }   // a new career: the list starts full
  try { secPoolAdvance(); } catch (e) { /* later */ }
  if (!S.poolNext) { S.poolNext = now + (2 + Math.random() * 4) * 3600e3; return; }
  let rounds = 0, arrived = 0;
  while (S.poolNext <= now && rounds < 20) {
    rounds++;
    const busy = Math.random();   // a busy day brings more people, a quiet one fewer
    for (const role of POOL_ROLES) {
      const list = S.staffCandidates.filter((x: Staff) => x.role === role && (x as any).job !== 'security');
      // some find other jobs
      const leave = Math.floor(Math.random() * (list.length > 6 ? 3 : 2));
      for (let i = 0; i < leave && list.length > 1; i++) { const gone = list.splice(Math.floor(Math.random() * list.length), 1)[0]; S.staffCandidates = S.staffCandidates.filter((x: Staff) => x !== gone); }
      // new ones come looking
      // a fuller list than before: ramp teams and cabin crews are needed in numbers
      const target = role === 'fa' ? 12 : role === 'ground' ? 12 : 8, room = Math.max(0, target + 4 - list.length);
      const come = Math.min(room, Math.floor(busy * (role === 'fa' || role === 'ground' ? 6 : 4) + Math.random() * 2));
      for (let i = 0; i < come; i++) { S.staffCandidates.push(makePerson('cand-' + role + uid(), role, '', POOL_BASES[Math.floor(Math.random() * POOL_BASES.length)])); arrived++; }
    }
    // rescue winch operators come looking when an airline has hoist helicopters
    if (State.fleet.some(a => hoistHeli(acType(a.typeId))) && S.staffCandidates.filter((x: any) => x.role === 'fa' && isWinchOp(x)).length < 3) {
      for (let i = 0; i < 2; i++) { const w: any = makePerson('cand-fa' + uid(), 'fa', '', POOL_BASES[Math.floor(Math.random() * POOL_BASES.length)]); w.winch = true; S.staffCandidates.push(w); arrived++; }
    }
    // captains
    if (State.candidates.length > 1 && Math.random() < 0.35) State.candidates.splice(Math.floor(Math.random() * State.candidates.length), 1);
    if (State.candidates.length < 7 && Math.random() < 0.3 + busy * 0.4) { State.candidates.push(makePilotCandidate('cap' + uid())); arrived++; }
    S.poolNext += (2 + Math.random() * 6) * 3600e3;
  }
  if (S.poolNext <= now) S.poolNext = now + 3 * 3600e3;
  if (arrived) {
    if (arrived >= 3) State.notices.unshift({ id: uid(), kind: 'staff' as any, title: `${arrived} new people are looking for work`, body: 'New co-pilots, flight attendants, mechanics or captains are on the hiring list under Pilots → Hire staff.', time: 'Now', read: false } as any);
    Store.soon(); try { renderTopbar(); if (State.screen === 'pilots') refresh(); } catch (e) { /* ignore */ }
  }
}

/** Recruitment and training: about a week's salary, paid when someone is hired. */
function chargeHiring(p: any) {
  const c = company(), fee = Math.round((p.salary || 1000) * (p.rank === 'Captain' ? 1.5 : 1) / 10) * 10, before = c.balance;
  c.balance -= fee;
  State.txns.unshift({ id: uid(), companyId: c.id, date: dateStr(new Date()).slice(0, 10), time: dateStr(new Date()).slice(11), kind: 'salary', label: `Hiring: ${p.name}`, amount: -fee, personId: p.id,
    lines: [['Recruitment', -Math.round(fee * 0.35)], ['Training and uniform', -Math.round(fee * 0.65)]], link: { kind: 'staff', id: p.id } } as any);
  try { animateBalance(before, c.balance); Sound.payOut(); } catch (e) { /* ignore */ }
}

/** Conduct reports on or off. Off pauses running court cases; on shifts their dates by the pause. */
function conductOn(): boolean { return (State.settings as any).conduct !== false; }
function setConduct(on: boolean) {
  const S: any = State;
  if (!on) { S.conductPausedAt = Date.now(); return; }
  const paused = S.conductPausedAt ? Date.now() - S.conductPausedAt : 0; S.conductPausedAt = 0;
  if (paused > 0) for (const c of (S.cases || [])) if (c.status === 'open') for (const st of c.stages) if (!st.done) st.at += paused;
}

function startStaffing() {
  payrollAdvance(true); poolAdvance(); leaseAdvance(true); try { Bank.advance(true); Jobs.advance(true); } catch (e) { /* ignore */ }
  try { moraleAdvance(); } catch (e) { /* ignore */ }
  setInterval(() => { payrollAdvance(); poolAdvance(); leaseAdvance(); try { Bank.advance(); Jobs.advance(); Ratings.advance(); moraleAdvance(); } catch (e) { /* ignore */ } }, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { payrollAdvance(); poolAdvance(); leaseAdvance(); try { Bank.advance(); Jobs.advance(); Ratings.advance(); } catch (e) { /* ignore */ } } });
}
