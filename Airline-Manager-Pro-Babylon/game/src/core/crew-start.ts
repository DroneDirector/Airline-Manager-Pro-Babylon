// Crew to fly: what the airline needs, category by category, to operate every aircraft, where it is short and by
// how many; and, on a new career, the first crew for free.
//  - Pilots: one for every aircraft you don't fly yourself (your own co-pilot comes with your aircraft).
//  - Cabin crew: one flight attendant for every 50 seats on aircraft with 20 seats or more.
//  - Mechanics: one at every base at least, plus line-maintenance staff for the fleet's size and type.
//  - Ground crew: a ramp team at every base, as large as the biggest aircraft based there needs.
//  - The first crew (a new career, once): exactly what the first aircraft needs to be allowed to fly (cabin crew,
//    mechanics and a ramp team at the home base), hired without the recruitment and training fees; their salaries
//    are paid as everyone's are. After that, hiring costs as usual.

interface CrewNeedRow { key: string; role: string; label: string; need: number; have: number; note: string; act?: string }

function crewNeeds(cid?: string): CrewNeedRow[] {
  const c: any = company(cid), id = c.id;
  try { ensureCoPilot(id); } catch (e) { /* none */ }   // your co-pilot always comes with a two-pilot aircraft
  const fl = fleetOf(id), cc = crewCheck(id), myReg = (State as any).myReg[id];
  const rows: CrewNeedRow[] = [];
  const others = fl.filter(a => a.reg !== myReg && a.status !== 'grounded');
  const pilots = id === State.companyId ? crewOf() : State.pilots.filter((p: any) => !p.you && !p.coPilotFor && p.companyId === id && !p.left);
  rows.push({ key: 'pilots', role: 'fo', label: 'Pilots', need: others.length, have: pilots.length, note: others.length ? `One for each aircraft you don't fly yourself (${others.length})` : 'You fly your own aircraft', act: 'captain' });
  const myA = plane(myReg);
  if (myA && multiCrew(acType(myA.typeId))) { const co = State.pilots.some((p: any) => p.coPilotFor === id); rows.push({ key: 'copilot', role: 'fo', label: 'Your co-pilot', need: 1, have: co ? 1 : 0, note: `In your ${acType(myA.typeId).model}: always provided with it` }); }
  rows.push({ key: 'fa', role: 'fa', label: 'Cabin crew', need: cc.faNeed, have: cc.faHave, note: 'One flight attendant for every 50 seats (aircraft with 20 seats or more)', act: 'fa' });
  if (cc.winchNeed) rows.push({ key: 'winch', role: 'fa', label: 'Winch operators', need: cc.winchNeed, have: cc.winchHave || 0, note: 'The third crew member on rescue and air-ambulance helicopters with a hoist', act: 'fa' });
  rows.push({ key: 'mech', role: 'mech', label: 'Mechanics', need: cc.mechNeed, have: cc.mechHave, note: 'One at every base, plus line maintenance for the fleet', act: 'mech' });
  // ground crew, base by base
  for (const b of companyBases(id)) {
    const based = fl.filter(a => (a.base || c.hub) === b), need = based.reduce((m, a) => Math.max(m, GROUND_NEED[acType(a.typeId).cls] || 0), 0);
    if (!need) continue;
    const have = ((State as any).staff || []).filter((p: any) => p.companyId === id && p.role === 'ground' && p.base === b && !p.left).length;
    rows.push({ key: 'ground-' + b, role: 'ground', label: `Ground crew at ${b}`, need, have, note: groundGraceOn(id) ? 'The local handling company stands in for now' : 'A ramp team for the biggest aircraft based there', act: 'ground' });
  }
  return rows;
}
/** The card at the top of Crew: everything needed to fly, and where you are short. */
function crewNeedsHtml(): string {
  const rows = crewNeeds(), cc = crewCheck(), short = rows.filter(r => r.have < r.need), total = rows.reduce((s, r) => s + r.need, 0), have = rows.reduce((s, r) => s + Math.min(r.have, r.need), 0);
  const blocked = Object.keys(cc.blocked);
  return `<div class="card cn"><div class="cn-h"><span><b>${icon(short.length ? 'alert' : 'check')}Crew to fly every aircraft</b><small>${short.length ? `${total - have} short of the ${total} people your fleet needs` : `All ${total} people your fleet needs are there`}</small></span><span class="achv-bar"><i style="width:${total ? (have / total * 100).toFixed(1) : 100}%"></i></span></div>
    <div class="cn-rows">${rows.map(r => { const s = r.need - r.have; return `<div class="cn-row ${s > 0 ? 'short' : 'ok'}"><span class="cn-ic">${icon(s > 0 ? 'alert' : 'check')}</span><span><b>${esc(r.label)}</b><small>${esc(r.note)}</small></span><span class="cn-n"><b>${r.have} of ${r.need}</b><small>${s > 0 ? `${s} more needed` : r.have > r.need ? `${r.have - r.need} spare` : 'enough'}</small></span>${s > 0 && r.act ? `<span class="cn-btns"><button class="btn sm primary" data-act="go-hire" data-id="${r.act}">Hire ${s}</button>${LEASE_ROLES.indexOf(r.role as CrewRole) >= 0 ? `<button class="btn sm ghost" data-act="crew-lease" data-id="${r.role}" data-base="${esc(r.key.indexOf('ground-') === 0 ? r.key.slice(7) : company().hub)}" data-n="${s}" title="Borrow from another airline: up to 5 times the pay">Borrow</button>` : ''}</span>` : ''}</div>`; }).join('')}</div>
    ${blocked.length ? `<div class="cn-blocked"><b>${icon('fleet')}Can't fly now for want of people</b>${blocked.map(reg => `<span><em>${esc(reg)}</em> ${esc(cc.blocked[reg].join(', '))}</span>`).join('')}</div>` : ''}
  </div>`;
}

/* ---------- the first crew, free ---------- */
function freeCrewState(): string { const S: any = State; return (S.freeCrew || {})[State.companyId] || ''; }
/** What the first aircraft needs to be allowed to fly: [role, count, job?]. */
function freeCrewPlan(): { role: CrewRole; n: number; label: string }[] {
  const c: any = company(), fl = fleetOf(c.id); if (!fl.length) return [];
  const a = fl[0], t = acType(a.typeId), base = a.base || c.hub, out: { role: CrewRole; n: number; label: string }[] = [];
  const fa = faNeeded(t) - staffOf(c.id, 'fa').length; if (fa > 0) out.push({ role: 'fa', n: fa, label: fa === 1 ? 'flight attendant' : 'flight attendants' });
  const mech = Math.max(1, Math.ceil(MECH_RATIO[t.cls] || 1)) - staffOf(c.id, 'mech').length; if (mech > 0) out.push({ role: 'mech', n: mech, label: mech === 1 ? 'mechanic' : 'mechanics' });
  const gr = (GROUND_NEED[t.cls] || 0) - ((State as any).staff || []).filter((p: any) => p.companyId === c.id && p.role === 'ground' && p.base === base && !p.left).length;
  if (gr > 0) out.push({ role: 'ground', n: gr, label: `ground crew at ${base}` });
  return out;
}
function freeCrewHtml(): string {
  if (freeCrewState() !== 'offered' || !soloMode()) return '';
  const c = company(), fl = fleetOf(c.id), plan = freeCrewPlan(), n = plan.reduce((s, p) => s + p.n, 0);
  if (!fl.length) return `<div class="card fc"><span class="fc-ic">${icon('pilots')}</span><span><b>Your first crew is on us</b><small>As soon as you have your first aircraft, the crew it needs to fly is yours without any hiring fees. You only pay their salaries.</small></span></div>`;
  if (!n) return '';
  const t = acType(fl[0].typeId);
  return `<div class="card fc"><span class="fc-ic">${icon('pilots')}</span><span><b>Your first crew is on us: ${n} ${n === 1 ? 'person' : 'people'}</b><small>The crew your ${esc(t.model)} needs to be allowed to fly: ${plan.map(p => `${p.n} ${p.label}`).join(', ')}${multiCrew(t) ? ', and your co-pilot, who comes with it' : ''}. No recruitment or training fees; you only pay their salaries when payday comes. A one-time welcome for a new airline: after this, hiring costs as usual.</small></span>
    <button class="btn primary" data-act="free-crew">${icon('check')}Get my first crew, free</button></div>`;
}
ACTIONS['free-crew'] = () => {
  if (freeCrewState() !== 'offered') return;
  const S: any = State, c: any = company(), fl = fleetOf(c.id), plan = freeCrewPlan(); if (!fl.length || !plan.length) return;
  const base = fl[0].base || c.hub, jobs = ['ramp', 'baggage', 'pushback', 'baggage', 'stairs', 'baggage', 'baggage', 'ramp', 'fuel', 'catering'];
  const day = dateStr(new Date()).slice(0, 10), hired: string[] = [];
  let gi = 0;
  for (const p of plan) for (let i = 0; i < p.n; i++) {
    // the best-rated candidate of that kind on the list, or a new one
    const list = (S.staffCandidates || []).filter((x: any) => x.role === p.role).sort((x: any, y: any) => (y.rating || 0) - (x.rating || 0));
    let st: any = list[0];
    if (st) S.staffCandidates = S.staffCandidates.filter((x: any) => x !== st);
    else st = makePerson('free-' + p.role + uid(), p.role, c.id, base);
    st.companyId = c.id; st.base = base; st.hired = day; st.status = 'on duty';
    if (p.role === 'ground') st.job = jobs[gi++ % jobs.length];
    S.staff.push(st); hired.push(st.name);
  }
  S.freeCrew = S.freeCrew || {}; S.freeCrew[c.id] = 'used';
  State.notices.unshift({ id: uid(), kind: 'staff' as any, title: `Your first crew has joined ${c.name}`, body: `${hired.length} people, without hiring fees: ${hired.slice(0, 6).join(', ')}${hired.length > 6 ? ' and others' : ''}. Their salaries are paid each week as everyone's are.`, time: 'Now', at: Date.now(), read: false } as any);
  try { Haptics.success(); Sound.chime(); } catch (e) { /* quiet */ }
  Store.soon(); toast(`${hired.length} crew joined ${c.name}, free of hiring fees`, 'ok'); refresh();
};
