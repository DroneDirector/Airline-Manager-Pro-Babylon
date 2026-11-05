// The morning briefing: once a day, a few seconds after you reach the Overview (after any badges or gifts), one
// page with what happened yesterday, what today holds (flights, weather, crew, aircraft), what needs a decision,
// and the special days coming up on your routes. It can be opened again any time from the Overview, and switched
// off in Settings → General.

function briefDayKey(): string { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }

function morningHtml(): string {
  const S: any = State, c: any = company(), cid = c.id;
  const y = new Date(Date.now() - 864e5), ys = dateStr(y).slice(0, 10);
  // yesterday's money, from the books
  const tx = (State.txns as any[]).filter(t => (!t.companyId || t.companyId === cid) && String(t.date || '').slice(0, 10) === ys);
  const rev = tx.filter(t => t.amount > 0).reduce((s2, t) => s2 + t.amount, 0), cost = tx.filter(t => t.amount < 0).reduce((s2, t) => s2 + t.amount, 0);
  const legs = (State.logbook as any[]).filter(l => String(l.date || '').slice(0, 10) === ys && (!plane(l.reg) || plane(l.reg).companyId === cid));
  const pax = legs.reduce((s2, l) => s2 + (l.pax || 0), 0);
  const aiDone = ((S.aiDay || []) as any[]).filter(b => !b.cancelled && b.end < Date.now() && b.end > Date.now() - 2 * 864e5 && plane(b.reg) && plane(b.reg).companyId === cid);
  const late = aiDone.filter(b => (b.start - (b.sched || b.start)) > 15 * 60e3).length;
  const ot = aiDone.length ? Math.round((1 - late / aiDone.length) * 100) : null;
  // today: flights, weather at your airports, crew, aircraft
  const now = Date.now(), dayEnd = new Date(); dayEnd.setHours(23, 59, 59, 999);
  const todayLegs = ((S.aiNext || []) as any[]).filter(n => plane(n.reg) && plane(n.reg).companyId === cid && n.depAt < dayEnd.getTime()).length + (State.live as any[]).filter(f => plane(f.reg) && plane(f.reg).companyId === cid).length;
  const airports: string[] = []; for (const r of (State.routes as any[]).filter(x => x.companyId === cid)) for (const l of r.legs || []) if (airports.indexOf(l) < 0) airports.push(l);
  const wx = airports.map(k => { let m: any = null; try { m = LiveWx.get(k); } catch (e) { m = null; } return m && /IFR|LIFR/.test(m.cat || '') || (m && m.wx && /TS|FZ|SN|\+/.test(m.wx)) ? [k, m] : null; }).filter(Boolean) as [string, any][];
  const staff = ((S.staff || []) as any[]).filter(p => p.companyId === cid && !p.left), sick = staff.filter(p => { try { return isSick(p); } catch (e) { return false; } }).length + (State.pilots as any[]).filter(p => staffCompany(p) === cid && (() => { try { return isSick(p); } catch (e) { return false; } })()).length;
  const strike = staff.filter(p => p.onStrike).length;
  const issues = (State.issues as any[]).filter(i => i.status === 'open' && plane(i.reg) && plane(i.reg).companyId === cid), grounding = issues.filter(i => i.severity === 'grounding');
  const lowCond = fleetOf(cid).filter((a: any) => (a.condition != null ? a.condition : 100) < 60);
  const decisions = (State.notices as any[]).filter(n => !n.read && /authority|mechanic|staff|company/.test(n.kind)).length;
  const coming = specialUpcoming(cid, 21);
  const row = (ic: string, t: string, sub: string, cls?: string) => `<div class="bf-row ${cls || ''}">${icon(ic)}<span><b>${t}</b>${sub ? `<small>${sub}</small>` : ''}</span></div>`;
  const d = new Date();
  return `<div class="bf">
    <div class="bf-head"><small>${esc(d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }))}</small><h2>Good morning, ${esc((myPilot() as any).name || 'captain')}</h2><p class="muted">${esc(c.name)}: your briefing for today</p></div>
    <div class="bf-grid">
      <section><h4>Yesterday</h4>
        ${row('finance', `${money(rev + cost, { sign: true })} result`, `${money(rev)} in, ${money(-cost)} out`, rev + cost >= 0 ? 'ok' : 'bad')}
        ${row('fleet', `${num(legs.length + aiDone.length)} flights`, `${num(pax)} passengers on your own flights${ot != null ? ` · ${ot}% of your pilots' on time` : ''}`)}
      </section>
      <section><h4>Today</h4>
        ${row('clock', `${num(todayLegs)} flights planned or in the air`, 'Your pilots\' legs still to fly today')}
        ${wx.length ? row('cloud', `Weather at ${wx.length} of your airports`, wx.slice(0, 4).map(([k, m]) => `${k} ${m.cat || ''}${m.wx ? ' ' + m.wx : ''}`).join(' · '), 'warn') : row('cloud', 'No bad weather at your airports', 'Live reports')}
        ${sick || strike ? row('pilots', `${sick ? sick + ' off sick' : ''}${sick && strike ? ', ' : ''}${strike ? strike + ' on strike' : ''}`, 'Flights may wait for crew', 'warn') : row('pilots', 'Everyone is at work', '')}
        ${grounding.length || lowCond.length ? row('wrench', `${grounding.length ? grounding.length + ' aircraft grounded' : ''}${grounding.length && lowCond.length ? ', ' : ''}${lowCond.length ? lowCond.length + ' in poor condition' : ''}`, issues.length + ' open issues in Maintenance', 'warn') : row('wrench', 'The fleet is serviceable', issues.length ? issues.length + ' small issues open' : '')}
        ${decisions ? row('bell', `${decisions} messages need you`, 'In your notifications', 'warn') : ''}
      </section>
      <section class="bf-wide"><h4>Coming up on your routes</h4>
        ${coming.length ? coming.slice(0, 5).map(x => row('star', `${esc(x.ev.name)} ${x.startsIn ? `in ${x.startsIn} day${x.startsIn > 1 ? 's' : ''}` : 'now'}`, `${esc(x.ev.why)} · ${x.airports.slice(0, 5).join(', ')} · about ${Math.round((x.ev.factor - 1) * 100)}% more passengers: consider higher fares or more flights`, 'hi')).join('') : row('star', 'No special days in the next three weeks', 'Seasons still change demand: see Routes')}
      </section>
    </div>
    <div class="modal-actions"><button class="btn ghost" data-act="go" data-screen="schedule">${icon('clock')}Schedule</button><button class="btn ghost" data-act="go" data-screen="routes">${icon('routes')}Routes</button><button class="btn primary" data-act="close-layer">${icon('check')}Got it</button></div>
  </div>`;
}
function briefingOpen() { try { closeAll(); } catch (e) { /* none */ } openLayer('modal', morningHtml(), { cls: 'bf-pop' }); Sound.tick(); }
ACTIONS['briefing'] = () => briefingOpen();

/** Once a day, in the Overview, when nothing else is being shown. */
let _bfAt = 0;
setInterval(() => {
  const S: any = State; if (!S.settings || S.settings.morningBrief === false || Store.nogame()) return;
  if (S.briefDay === briefDayKey()) return;
  if ((typeof TitleScreen !== 'undefined' && TitleScreen.on) || State.screen !== 'ops' || document.hidden) { _bfAt = 0; return; }
  if (document.querySelector('.layer.open, .bdr, .v3v, .sal3d') || (typeof _revealQ !== 'undefined' && (_revealQ.length || _revealing))) { _bfAt = 0; return; }
  if (!_bfAt) { _bfAt = Date.now(); return; }
  if (Date.now() - _bfAt < 4000) return;
  S.briefDay = briefDayKey(); Store.soon(); briefingOpen();
}, 1000);
