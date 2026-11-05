// Goals: achievements with progress bars (Ranking → Achievements), and a guided first week for a new airline
// (a checklist in the Overview that ticks itself as you go).

interface Achv { id: string; group: string; title: string; desc: string; target: number; value: () => number; icon: string }

const CONTINENT_OF: { [k: string]: string } = { K: 'NA', C: 'NA', P: 'OC', M: 'NA', T: 'NA', S: 'SA', E: 'EU', L: 'EU', B: 'EU', U: 'AS', R: 'AS', Z: 'AS', V: 'AS', W: 'AS', O: 'AS', Y: 'OC', N: 'OC', A: 'OC', F: 'AF', G: 'AF', D: 'AF', H: 'AF' };
function goalsVisited(): string[] { try { visitSeed(State.companyId); return Object.keys(visitedOf(State.companyId)).filter(k => k.indexOf('__') !== 0); } catch (e) { return []; } }
function goalsMine(): LogEntry[] { return State.logbook.filter(l => { const a = plane(l.reg); return !a || a.companyId === State.companyId; }); }
function goalsJobsDone(special?: boolean): number { try { return (jobsState().list as any[]).filter(j => j.companyId === State.companyId && j.status === 'done' && (!special || j.special)).length; } catch (e) { return 0; } }

const ACHIEVEMENTS: Achv[] = [
  { id: 'fl10', group: 'Flying', title: 'Ten flights', desc: 'Fly ten flights yourself.', target: 10, icon: 'land', value: () => goalsMine().length },
  { id: 'fl100', group: 'Flying', title: 'A hundred flights', desc: 'Fly a hundred flights yourself.', target: 100, icon: 'land', value: () => goalsMine().length },
  { id: 'fl1000', group: 'Flying', title: 'A thousand flights', desc: 'Fly a thousand flights yourself.', target: 1000, icon: 'land', value: () => goalsMine().length },
  { id: 'butter', group: 'Flying', title: 'Butter', desc: 'Land softer than 100 feet a minute 25 times.', target: 25, icon: 'star', value: () => goalsMine().filter(l => l.result === 'ok' && Math.abs(l.landingFpm) < 100).length },
  { id: 'hrs100', group: 'Flying', title: '100 hours', desc: 'Fly a hundred hours yourself.', target: 100, icon: 'clock', value: () => Math.floor(goalsMine().reduce((t, l) => t + (l.blockMin || 0), 0) / 60) },
  { id: 'hrs1000', group: 'Flying', title: '1,000 hours', desc: 'Fly a thousand hours yourself.', target: 1000, icon: 'clock', value: () => Math.floor(goalsMine().reduce((t, l) => t + (l.blockMin || 0), 0) / 60) },
  { id: 'apt25', group: 'The world', title: 'Getting around', desc: 'Your airline lands at 25 airports.', target: 25, icon: 'pin', value: () => goalsVisited().length },
  { id: 'apt100', group: 'The world', title: 'A hundred airports', desc: 'Your airline lands at 100 airports.', target: 100, icon: 'pin', value: () => goalsVisited().length },
  { id: 'cont', group: 'The world', title: 'Every continent', desc: 'Your airline lands on all six inhabited continents.', target: 6, icon: 'globe', value: () => goalsVisited().map(k => CONTINENT_OF[k[0]]).filter((x, i, a) => x && a.indexOf(x) === i).length },
  { id: 'ctry20', group: 'The world', title: 'Twenty countries', desc: 'Your routes reach 20 countries.', target: 20, icon: 'globe', value: () => { const s: { [k: string]: 1 } = {}; State.routes.filter(r => r.companyId === State.companyId).forEach(r => r.legs.forEach(l => { const a = apt(l); if (a) s[a.country] = 1; })); return Object.keys(s).length; } },
  { id: 'fleet10', group: 'The airline', title: 'Ten aircraft', desc: 'Grow your fleet to ten aircraft.', target: 10, icon: 'fleet', value: () => fleetOf().length },
  { id: 'fleet50', group: 'The airline', title: 'Fifty aircraft', desc: 'Grow your fleet to fifty aircraft.', target: 50, icon: 'fleet', value: () => fleetOf().length },
  { id: 'rt10', group: 'The airline', title: 'Ten routes', desc: 'Fly ten scheduled routes.', target: 10, icon: 'routes', value: () => State.routes.filter(r => r.companyId === State.companyId && !r.test).length },
  { id: 'rt50', group: 'The airline', title: 'Fifty routes', desc: 'Fly fifty scheduled routes.', target: 50, icon: 'routes', value: () => State.routes.filter(r => r.companyId === State.companyId && !r.test).length },
  { id: 'rep90', group: 'The airline', title: 'Loved', desc: 'Reach a reputation of 90.', target: 90, icon: 'star', value: () => Math.round(company().reputation || 0) },
  { id: 'bank100', group: 'The airline', title: 'A hundred million', desc: 'Have 100 million in the bank.', target: 100, icon: 'finance', value: () => Math.floor(company().balance / 1e6) },
  { id: 'ff100k', group: 'Passengers', title: 'A loyal following', desc: '100,000 members in your frequent-flyer programme.', target: 100, icon: 'pax', value: () => { const L = loyaltyOf(State.companyId); return L && L.ff.on ? Math.floor(L.ff.members / 1000) : 0; } },
  { id: 'lounge3', group: 'Passengers', title: 'Lounges', desc: 'Open lounges at three airports.', target: 3, icon: 'star', value: () => { const L = loyaltyOf(State.companyId); return L ? Object.keys(L.lounges).length : 0; } },
  { id: 'flag', group: 'Passengers', title: 'Flagship', desc: 'Open a flagship lounge.', target: 1, icon: 'star', value: () => { const L = loyaltyOf(State.companyId); return L && Object.keys(L.lounges).some(k => L.lounges[k].lvl >= 2) ? 1 : 0; } },
  { id: 'jobs25', group: 'Jobs', title: 'For hire', desc: 'Finish 25 charter and cargo jobs.', target: 25, icon: 'jobs', value: () => goalsJobsDone() },
  { id: 'special10', group: 'Jobs', title: 'Special delivery', desc: 'Deliver ten special loads: live animals, cold cargo, oversized freight or urgent parts.', target: 10, icon: 'jobs', value: () => goalsJobsDone(true) },
];

function achvState(): { [id: string]: number } { const S: any = State; S.achv = S.achv || {}; return S.achv[State.companyId] || (S.achv[State.companyId] = {}); }
function achvValue(a: Achv): number { try { return Math.max(0, a.value() || 0); } catch (e) { return 0; } }
function achvCheck() {
  if (Store.nogame() || !soloMode() || (typeof TitleScreen !== 'undefined' && TitleScreen.on)) return;
  const A = achvState(); let any = false;
  for (const a of ACHIEVEMENTS) {
    if (A[a.id]) continue;
    if (achvValue(a) >= a.target) {
      A[a.id] = Date.now(); any = true;
      if (!A.__seeded) continue;   // the first look: what is already done is marked quietly
      State.notices.unshift({ id: uid(), kind: 'company', title: `Achievement: ${a.title}`, body: a.desc, time: 'Now', at: Date.now(), read: false, ref: 'achv' } as any);
      toast(`${icon('trophy')}Achievement: ${a.title}`, 'ok');
    }
  }
  if (!A.__seeded) { A.__seeded = 1; any = true; }
  if (any) Store.soon();
}
setInterval(() => { try { achvCheck(); } catch (e) { /* next time */ } }, 30000);

function achievementsHtml(): string {
  const A = achvState(), groups: { [g: string]: Achv[] } = {};
  ACHIEVEMENTS.forEach(a => (groups[a.group] = groups[a.group] || []).push(a));
  const done = ACHIEVEMENTS.filter(a => A[a.id]).length;
  return `<div class="card achv-sum"><b>${done} of ${ACHIEVEMENTS.length}</b><small>achievements</small><span class="achv-bar"><i style="width:${(done / ACHIEVEMENTS.length * 100).toFixed(1)}%"></i></span></div>
    ${Object.keys(groups).map(g => `<h3 class="achv-g">${esc(g)}</h3><div class="achv-grid">${groups[g].map(a => {
      const v = Math.min(a.target, achvValue(a)), got = !!A[a.id], k = got ? 1 : v / a.target;
      return `<div class="achv ${got ? 'got' : ''}"><span class="achv-ic">${icon(got ? 'check' : a.icon)}</span><span class="achv-t"><b>${esc(a.title)}</b><small>${esc(a.desc)}</small>
        <span class="achv-bar"><i style="width:${(k * 100).toFixed(1)}%"></i></span><em>${got ? `Done ${esc(dateStr(new Date(A[a.id])).slice(0, 10))}` : `${num(v)} of ${num(a.target)}`}</em></span></div>`;
    }).join('')}</div>`).join('')}`;
}

/* ---------- the guided first week ---------- */
interface FirstStep { id: string; title: string; how: string; done: () => boolean; act?: string; actLabel?: string }
const FIRST_WEEK: FirstStep[] = [
  { id: 'fleet', title: 'Get your first aircraft', how: 'Buy or lease one in Market. A small jet or a turboprop is a good start.', done: () => fleetOf().length > 0, act: 'go-market', actLabel: 'Market' },
  { id: 'crew', title: 'Hire a crew', how: 'Pilots and cabin crew in Crew. Each aircraft needs enough of both to fly.', done: () => crewOf().filter((p: any) => !p.you).length > 0, act: 'go-pilots', actLabel: 'Crew' },
  { id: 'route', title: 'Open your first route', how: 'From your home base to a busy city nearby, in Routes. Watch the demand and the rivals.', done: () => State.routes.some(r => r.companyId === State.companyId && !r.test), act: 'go-routes', actLabel: 'Routes' },
  { id: 'fares', title: 'Set your fares', how: 'Open the route and try flexible fares, or set them yourself against your rivals.', done: () => State.routes.some((r: any) => r.companyId === State.companyId && (r.flex || r.fares)), act: 'go-routes', actLabel: 'Routes' },
  { id: 'fly', title: 'Fly your first flight', how: 'Load your aircraft in Flight Simulator, plan it in the Flight planner and fly it. Or let a hired pilot fly it.', done: () => goalsMine().length > 0 || (((State as any).aiNext as any[]) || []).some((n: any) => { const a = plane(n.reg); return a && a.companyId === State.companyId; }), act: 'go-planner', actLabel: 'Flight planner' },
  { id: 'job', title: 'Take on a job', how: 'Charter and cargo jobs pay well on top of your routes. Jobs shows what fits your fleet.', done: () => (jobsState().list as any[]).some(j => j.companyId === State.companyId && j.status !== 'open'), act: 'go-jobs', actLabel: 'Jobs' },
  { id: 'ff', title: 'Launch a frequent-flyer programme', how: 'In Finance: members come back to you and pay through the co-branded card.', done: () => { const L = loyaltyOf(State.companyId); return !!(L && L.ff.on); }, act: 'go-finance', actLabel: 'Finance' },
];
function firstWeekOn(): boolean {
  if (!soloMode()) return false;
  const S: any = State, c: any = company(), F = (S.firstWeek = S.firstWeek || {})[c.id];
  if (F && (F.hidden || F.done)) return false;
  const founded = Date.parse(c.founded || '') || 0;
  return !!(S.fresh || (founded && Date.now() - founded < 8 * 864e5) || (F && F.on));
}
function firstWeekHtml(): string {
  if (!firstWeekOn()) return '';
  const S: any = State, c = company(), F = S.firstWeek[c.id] || (S.firstWeek[c.id] = { on: true });
  const st = FIRST_WEEK.map(s => { let d = false; try { d = s.done(); } catch (e) { d = false; } return { s, d }; }), n = st.filter(x => x.d).length;
  if (n === FIRST_WEEK.length && !F.done) { F.done = Date.now(); Store.soon(); setTimeout(() => toast(`${icon('trophy')}Your first week is done: ${esc(c.name)} is up and flying`, 'ok'), 300); }
  const next = st.filter(x => !x.d)[0];
  return `<div class="card fw"><div class="fw-h"><span><b>${icon('star')}Your first week</b><small>${n} of ${FIRST_WEEK.length} done${next ? ` · next: ${esc(next.s.title.toLowerCase())}` : ''}</small></span><span class="achv-bar"><i style="width:${(n / FIRST_WEEK.length * 100).toFixed(1)}%"></i></span><button class="icon-btn" data-act="fw-hide" aria-label="Hide">${icon('close')}</button></div>
    <div class="fw-list">${st.map(({ s, d }) => `<div class="fw-step ${d ? 'done' : next && next.s === s ? 'next' : ''}"><span class="fw-tick">${d ? icon('check') : ''}</span><span><b>${esc(s.title)}</b><small>${esc(s.how)}</small></span>${!d && s.act ? `<button class="btn sm ${next && next.s === s ? 'primary' : 'ghost'}" data-act="${s.act}">${esc(s.actLabel)}</button>` : ''}</div>`).join('')}</div></div>`;
}
ACTIONS['fw-hide'] = () => { const S: any = State, c = company(); (S.firstWeek = S.firstWeek || {})[c.id] = Object.assign(S.firstWeek[c.id] || {}, { hidden: true }); Store.soon(); Sound.tick(); toast('Your first week is hidden. Settings → General brings it back.', 'info'); refresh(); };
ACTIONS['fw-show'] = () => { const S: any = State, c = company(); (S.firstWeek = S.firstWeek || {})[c.id] = { on: true }; Store.soon(); Sound.tick(); toast('Your first week is in the Overview', 'ok'); };
for (const k of ['market', 'pilots', 'routes', 'planner', 'jobs', 'finance']) if (!ACTIONS['go-' + k]) ACTIONS['go-' + k] = () => go(k);
