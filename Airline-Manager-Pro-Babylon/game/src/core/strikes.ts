// Pay and strikes.
// The going rate for each job follows real pay: by job, by experience (level), by region and by kind of
// airline (docs/reference/staff-salaries.txt). Each airline sets a pay scale per group, as a share of the
// going rate. Paying well brings better, calmer crew; paying badly saves money but wears people down.
// A strike is rare and only over something major: a whole group badly underpaid, or deeply unhappy for
// weeks. The union always warns first (twice) before it strikes. On strike: meet their demands, offer
// a compromise, wait, or dismiss them and hire cheaper replacements (who are weaker and slip more often).

type PayGroup = 'pilots' | 'fa' | 'mech' | 'ground';
const PAY_GROUPS: [PayGroup, string, string][] = [['pilots', 'Pilots', 'pilots'], ['fa', 'Cabin crew', 'cabin crew'], ['mech', 'Mechanics', 'mechanics'], ['ground', 'Ground crew', 'ground crew']];
const PAY_SCALES = [0.8, 0.9, 1, 1.1, 1.25];

/** Weekly going rate at level 1 (Europe, a full-service airline), USD. */
const PAY_BASE: { [r: string]: number } = { captain: 2900, fo: 1500, fa: 620, mech: 1100, ground: 560 };
/** Region by the first letter of the base airport's ICAO code, and what each job earns there against Europe. */
function payRegion(icao: string): string {
  const k = (icao || 'E')[0];
  return 'KPC'.indexOf(k) >= 0 ? 'NA' : k === 'O' ? 'ME' : 'RVWZ'.indexOf(k) >= 0 ? 'AS' : k === 'S' || k === 'M' || k === 'T' ? 'LA' : 'FDGH'.indexOf(k) >= 0 ? 'AF' : 'YN'.indexOf(k) >= 0 ? 'OC' : k === 'U' ? 'RU' : 'EU';
}
//                          captain  fo    fa    mech  ground
const PAY_REGION: { [r: string]: number[] } = {
  EU: [1, 1, 1, 1, 1], NA: [1.55, 1.45, 2.4, 1.35, 1.45], ME: [1.15, 1.15, 1.35, 0.9, 0.6], AS: [1.05, 0.95, 0.8, 0.7, 0.5],
  OC: [1.15, 1.1, 1.5, 1.15, 1.25], LA: [0.6, 0.55, 0.5, 0.5, 0.4], AF: [0.65, 0.6, 0.5, 0.5, 0.35], RU: [0.7, 0.65, 0.5, 0.55, 0.45],
};
const PAY_ROLE_I: { [r: string]: number } = { captain: 0, fo: 1, fa: 2, mech: 3, ground: 4 };
function payGroupOf(p: any): PayGroup { const r = personRole(p); return r === 'captain' || r === 'fo' ? 'pilots' : r as PayGroup; }
function staffCompany(p: any): string { return p.companyId || (typeof pilotCompany === 'function' ? pilotCompany(p) : State.companyId); }

/** The going rate for this person: job, level, region of their base and the kind of airline. */
function goingRate(p: any, role?: string, base?: string, cid?: string): number {
  role = role || personRole(p); base = base || p.base; cid = cid || staffCompany(p);
  const lv = clamp(levelOf(p.xp || 0).level, 0, 500);
  const reg = PAY_REGION[payRegion(base)] || PAY_REGION.EU, i = PAY_ROLE_I[role] != null ? PAY_ROLE_I[role] : 2;
  const c: any = cid ? company(cid) : null, kind = c ? c.kind : 'major';
  const kindF = kind === 'bush' ? (i <= 1 ? 0.5 : 0.8) : kind === 'regional' ? (i <= 1 ? 0.75 : 0.9) : 1;
  // experience: about 1.9 times the starting pay at the top (seniority scales)
  return (PAY_BASE[role] || 800) * reg[i] * kindF * (1 + lv / 500 * 0.9 + Math.min(lv, 100) / 100 * 0.25);
}
function payScale(cid: string, g: PayGroup): number { const c: any = company(cid); return (c.payScale && c.payScale[g]) || 1; }
/** Pay against the going rate for a group (1 = fair). */
function groupPayRatio(cid: string, g: PayGroup): { ratio: number; n: number; people: any[] } {
  const people = strikeGroupPeople(cid, g);
  if (!people.length) return { ratio: 1, n: 0, people };
  const r = people.reduce((s, p) => s + (p.salary || 1) / goingRate(p), 0) / people.length;
  return { ratio: r, n: people.length, people };
}
function strikeGroupPeople(cid: string, g: PayGroup): any[] {
  const S: any = State;
  if (g === 'pilots') return (State.pilots as any[]).filter(p => !p.you && p.id !== 'you' && !p.left && staffCompany(p) === cid);
  return ((S.staff || []) as any[]).filter(p => p.companyId === cid && p.role === g && !p.left);
}

/** Settings → Staff: the pay scale per group. Changing it sets everyone in the group to that share of their going rate. */
function payScaleHtml(): string {
  const c = company();
  return `<p class="fine-print">${icon('info')}Pay for ${esc(c.name)}, as a share of the going rate for each job, level and region. Well-paid crew are better, calmer and stay; underpaid crew slip more often, and a badly underpaid group may strike.</p>`
    + PAY_GROUPS.map(([g, name]) => {
      const gr = groupPayRatio(c.id, g), cur = payScale(c.id, g);
      const ex = g === 'pilots' ? goingRate({ xp: 0 }, 'captain', c.hub, c.id) : goingRate({ xp: 0 }, g, c.hub, c.id);
      return `<div class="ch-row"><span><b>${name}</b><small>Going rate at ${esc(c.hub)}${g === 'pilots' ? ' for a new captain' : ' to start'}: ${money(Math.round(ex))}/wk${gr.n ? ` · now paying ${Math.round(gr.ratio * 100)}% on average` : ''}</small></span>
        <div class="seg">${PAY_SCALES.map(v => `<button class="${Math.abs(cur - v) < 0.001 ? 'on' : ''}" data-act="pay-scale" data-g="${g}" data-v="${v}">${Math.round(v * 100)}%</button>`).join('')}</div></div>`;
    }).join('');
}
ACTIONS['pay-scale'] = el => {
  if (typeof coopOn === 'function' && coopOn() && !coopCanBuy()) { toast('In this co-op only the owner sets pay', 'warn'); return; }
  const c: any = company(), g = el.getAttribute('data-g') as PayGroup, v = +el.getAttribute('data-v') || 1;
  const before = payScale(c.id, g);
  c.payScale = c.payScale || {}; c.payScale[g] = v;
  const people = strikeGroupPeople(c.id, g);
  people.forEach(p => { p.salary = Math.round(goingRate(p) * v / 10) * 10; const s = moodState(p); if (v > before) staffMoodAdd(p, Math.round((v - before) * 40)); else if (v < before) staffMoodAdd(p, -Math.round((before - v) * 60)); s.payExtra = 0; });
  Store.save(); Sound.tick(); rerenderSettingsBody();
  toast(`${PAY_GROUPS.filter(x => x[0] === g)[0][1]}: ${Math.round(v * 100)}% of the going rate${people.length ? `, ${people.length} ${people.length === 1 ? 'person' : 'people'} updated` : ''}`, 'ok');
};

/** Once, when pay moved to real-world going rates: everyone already employed is put on a fair salary
 *  (between 98% and 112% of their going rate, keeping their place in that range), so no one is suddenly underpaid. */
function payRebase() {
  const S: any = State; if (S.payV3) return; S.payV3 = true;
  for (const c of State.companies) for (const [g] of PAY_GROUPS) strikeGroupPeople(c.id, g).forEach(p => {
    const gr = goingRate(p), r = clamp((p.salary || gr) / gr, 0.98, 1.12);
    p.salary = Math.round(gr * r / 10) * 10;
  });
}

/* ---------- the union ---------- */
interface UnionState { stage: number; since: number; at: number; demand: number; why: string; strikeAt?: number; cool?: number; offered?: boolean }
function unionOf(cid: string, g: PayGroup): UnionState {
  const S: any = State; S.unions = S.unions || {}; const k = cid + ':' + g;
  return S.unions[k] || (S.unions[k] = { stage: 0, since: 0, at: 0, demand: 1, why: '' });
}
function onStrike(cid: string, g: PayGroup): boolean { const S: any = State; const u = S.unions && S.unions[cid + ':' + g]; return !!(u && u.stage === 3); }

/** The grievance of a group, if it is major enough to matter: badly underpaid, or deeply unhappy. */
function grievance(cid: string, g: PayGroup): { why: string; demand: number } | null {
  const gr = groupPayRatio(cid, g); if (gr.n < 3) return null;
  if (gr.ratio < 0.86) return { why: `pay ${Math.round((1 - gr.ratio) * 100)}% below the going rate`, demand: 1 };
  const mood = gr.people.reduce((s, p) => s + staffMood(p), 0) / gr.n;
  if (mood < 28) return { why: 'conditions: rosters, rest and how they are treated', demand: Math.max(gr.ratio, 1.05) };
  return null;
}

/** Once a day: unions watch for a major grievance, warn twice, and only then strike. */
function unionAdvance() {
  const now = Date.now();
  for (const c of State.companies) for (const [g, name, low] of PAY_GROUPS) {
    const u = unionOf(c.id, g), gv = grievance(c.id, g);
    if (u.cool && now < u.cool) continue;
    if (u.stage === 3) {
      // a strike that is ignored ends on its own after about a week; the anger stays
      if (gv && now - (u.strikeAt || now) < 7 * 864e5) continue;
      strikeEnd(c.id, g, gv ? 'They went back to work after a week without pay. Nothing is settled.' : 'The reason for the strike is gone; they are back at work.');
      if (gv) strikeGroupPeople(c.id, g).forEach(p => staffMoodAdd(p, -10));
      continue;
    }
    if (!gv) { if (u.stage) { u.stage = 0; u.since = 0; note(c.id, `${name}: the union is satisfied`, `The ${low}'s union withdrew its warning. Thank you for listening.`); } else u.since = 0; continue; }
    if (!u.since) { u.since = now; continue; }
    const days = (now - (u.stage ? u.at : u.since)) / 864e5;
    if (u.stage === 0 && days >= 3 && Math.random() < 0.3) {
      Object.assign(u, { stage: 1, at: now, demand: gv.demand, why: gv.why });
      note(c.id, `${name}: a warning from the union`, `The ${low}'s union is unhappy about ${gv.why}. They want pay back at the going rate for their jobs and levels. If nothing changes, a second warning follows, and then a strike.`, c.id + ':' + g);
    } else if (u.stage === 1 && days >= 5) {
      Object.assign(u, { stage: 2, at: now, why: gv.why });
      note(c.id, `${name}: final warning before a strike`, `The ${low} voted for a strike over ${gv.why}. It starts in three days unless their demands are met.`, c.id + ':' + g);
    } else if (u.stage === 2 && days >= 3) {
      if (Math.random() < 0.7) strikeStart(c.id, g, gv.why);
      else { u.at = now; note(c.id, `${name}: the strike is postponed`, `The union gave you one more week to meet their demands over ${gv.why}.`, c.id + ':' + g); }
    }
  }
}
function note(cid: string, title: string, body: string, ref?: string) {
  State.notices.unshift({ id: uid(), kind: 'staff' as any, title, body, time: 'Now', at: Date.now(), read: false, ref: ref ? 'sk-' + ref : undefined } as any);
  try { renderTopbar(); } catch (e) { /* not ready */ }
}
function strikeStart(cid: string, g: PayGroup, why: string) {
  const u = unionOf(cid, g), name = PAY_GROUPS.filter(x => x[0] === g)[0][1];
  Object.assign(u, { stage: 3, at: Date.now(), strikeAt: Date.now(), why, offered: false });
  strikeGroupPeople(cid, g).forEach(p => { p.strikeWas = p.status; p.status = 'off'; p.onStrike = true; });
  const effect = g === 'pilots' ? 'Hired pilots\' flights stay on the ground.' : g === 'fa' ? 'Aircraft with 20 seats or more can\'t fly without cabin crew.' : g === 'mech' ? 'No aircraft is released to service without a mechanic.' : 'Departures from airports where your own ground crew work are stopped.';
  try { newsStrike(cid, g, why, 'start'); } catch (e) { /* ignore */ }
  note(cid, `${name} of ${company(cid).name} are on strike`, `Over ${why}. ${effect} Meet their demands, offer a compromise, wait, or dismiss them and hire cheaper replacements.`, cid + ':' + g);
  try { Progress.popularity(-2, `${name} on strike`); Sound.chime(); toast(`${name} are on strike`, 'warn', { label: 'Decide', act: 'strike-open', data: cid + ':' + g }); } catch (e) { /* ignore */ }
}
function strikeEnd(cid: string, g: PayGroup, text: string) {
  try { newsStrike(cid, g, '', 'end', text); } catch (e) { /* ignore */ }
  const u = unionOf(cid, g), name = PAY_GROUPS.filter(x => x[0] === g)[0][1];
  strikeGroupPeople(cid, g).forEach(p => { if (p.onStrike) { p.status = p.strikeWas && p.strikeWas !== 'off' ? p.strikeWas : 'on duty'; p.onStrike = false; } });
  Object.assign(u, { stage: 0, since: 0, at: Date.now(), cool: Date.now() + 21 * 864e5 });
  note(cid, `${name}: the strike is over`, text);
}

/** What a strike stops: the reason a hired pilot's leg can't leave, or ''. */
function strikeBlock(cid: string, typeId: string, from: string): string {
  const S: any = State; if (!S.unions) return '';
  if (onStrike(cid, 'pilots')) return 'Pilots on strike';
  const t = acType(typeId);
  if (onStrike(cid, 'fa') && t && t.seats >= 20) return 'Cabin crew on strike';
  if (onStrike(cid, 'mech')) return 'Mechanics on strike: no release to service';
  return '';   // ground crew on strike: see groundBlock (their bases have no one to turn aircraft round)
}

/* ---------- your answer ---------- */
ACTIONS['strike-open'] = el => strikePopup(el.getAttribute('data-id') || el.getAttribute('data-data') || '');
function strikePopup(key: string) {
  const [cid, g] = key.split(':') as [string, PayGroup]; if (!cid || !g) return;
  const u = unionOf(cid, g), name = PAY_GROUPS.filter(x => x[0] === g)[0][1], gr = groupPayRatio(cid, g);
  const raise = gr.people.reduce((s, p) => s + Math.max(0, goingRate(p) * u.demand - (p.salary || 0)), 0);
  const half = gr.people.reduce((s, p) => s + Math.max(0, goingRate(p) * (u.demand + gr.ratio) / 2 - (p.salary || 0)), 0);
  const sever = gr.people.reduce((s, p) => s + (p.salary || 0) * 2, 0);
  const stage = u.stage === 3 ? 'On strike' : u.stage === 2 ? 'Final warning: strike in a few days' : u.stage === 1 ? 'First warning' : 'No dispute';
  closeAll();
  openLayer('modal', `<div class="modal-head"><div><h2>${name}: ${stage.toLowerCase()}</h2><small>${esc(company(cid).name)} · ${gr.n} people · paid ${Math.round(gr.ratio * 100)}% of the going rate</small></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
    <div class="modal-body">
      <p class="lede">${u.stage ? `The union's complaint: ${esc(u.why || 'pay and conditions')}. They want pay at ${Math.round(u.demand * 100)}% of the going rate.` : 'There is no dispute with this group right now.'}</p>
      ${u.stage ? `<div class="btn-col strike-opts">
        <button class="btn primary" data-act="strike-meet" data-k="${esc(key)}">${icon('check')}Meet their demands<small>+${money(Math.round(raise))}/wk on the payroll${u.stage === 3 ? '; back at work today' : ''}</small></button>
        ${u.offered ? '' : `<button class="btn ghost" data-act="strike-half" data-k="${esc(key)}">${icon('swap')}Offer half way<small>+${money(Math.round(half))}/wk; they may say no</small></button>`}
        <button class="btn ghost" data-act="close-layer">${icon('clock')}Wait<small>${u.stage === 3 ? 'Flights stay on the ground; a strike ends on its own after about a week, with nothing settled' : 'Nothing changes for now'}</small></button>
        <button class="btn danger" data-act="strike-fire" data-k="${esc(key)}">${icon('trash')}Dismiss them and hire cheaper ${PAY_GROUPS.filter(x => x[0] === g)[0][2]}<small>Severance ${money(Math.round(sever))}. Replacements at 80% of the going rate: less experienced, weaker service, more conduct problems</small></button>
      </div>` : ''}
    </div>`, { cls: 'strike-modal' });
}
function strikeRaise(key: string, to: number) {
  const [cid, g] = key.split(':') as [string, PayGroup];
  strikeGroupPeople(cid, g).forEach(p => { const want = Math.round(goingRate(p) * to / 10) * 10; if ((p.salary || 0) < want) p.salary = want; staffMoodAdd(p, 12); });
  const c: any = company(cid); c.payScale = c.payScale || {}; c.payScale[g] = PAY_SCALES.reduce((a, b) => Math.abs(b - to) < Math.abs(a - to) ? b : a, 1);
}
ACTIONS['strike-meet'] = el => {
  const key = el.getAttribute('data-k'), [cid, g] = key.split(':') as [string, PayGroup], u = unionOf(cid, g);
  strikeRaise(key, u.demand);
  if (u.stage === 3) strikeEnd(cid, g, 'You met their demands. Everyone is back at work.');
  else Object.assign(u, { stage: 0, since: 0, cool: Date.now() + 30 * 864e5 });
  try { Progress.popularity(1, 'Settled with the union'); } catch (e) { /* ignore */ }
  Store.save(); closeAll(); refresh(); toast('Agreed with the union', 'ok');
};
ACTIONS['strike-half'] = el => {
  const key = el.getAttribute('data-k'), [cid, g] = key.split(':') as [string, PayGroup], u = unionOf(cid, g), gr = groupPayRatio(cid, g);
  u.offered = true;
  const to = (u.demand + gr.ratio) / 2;
  if (Math.random() < 0.55) {
    strikeRaise(key, to);
    if (u.stage === 3) strikeEnd(cid, g, 'They accepted your offer half way. Everyone is back at work.');
    else Object.assign(u, { stage: 0, since: 0, cool: Date.now() + 21 * 864e5 });
    Store.save(); closeAll(); refresh(); toast('The union accepted your offer', 'ok');
  } else { Store.save(); toast('The union turned your offer down', 'warn'); strikePopup(key); }
};
ACTIONS['strike-fire'] = el => {
  const key = el.getAttribute('data-k'), [cid, g] = key.split(':') as [string, PayGroup], S: any = State;
  const people = strikeGroupPeople(cid, g), sever = people.reduce((s, p) => s + (p.salary || 0) * 2, 0);
  if (sever) payTxn(cid, `Severance: ${people.length} ${PAY_GROUPS.filter(x => x[0] === g)[0][2]}`, -sever, 'salary', [['Two weeks\' pay each', -sever]]);
  people.forEach(p => { p.left = true; p.onStrike = false; });
  try { newsStrike(cid, g, '', 'fired', '', people.length); } catch (e) { /* ignore */ }
  S.staff = (S.staff || []).filter((p: any) => people.indexOf(p) < 0);
  State.pilots = State.pilots.filter((p: any) => people.indexOf(p) < 0);
  // replacements: as many as before, cheaper and weaker
  people.forEach((old, i) => {
    const role = personRole(old) as CrewRole, n: any = makePerson('repl-' + uid() + i, role === 'captain' ? 'captain' : role, cid, old.base);
    n.xp = Math.round(xpForLevel(1 + Math.floor(Math.random() * 12))); n.rating = 2.6 + Math.random() * 0.8; n.budget = true;
    n.salary = Math.round(goingRate(n) * 0.8 / 10) * 10; moodState(n).payExtra = 25;   // they took the job on these terms
    if (role === 'captain' || role === 'fo') {
      State.pilots.push({ id: n.id, name: n.name, rank: role === 'fo' ? 'First officer' : 'Captain', hoursMin: 1200 * 60 + Math.round(Math.random() * 2000) * 60, landings: 600, base: old.base, salary: n.salary, rating: n.rating, status: 'standby',
        types: (old.types || []).slice(), rules: old.rules, companyId: cid, look: n.look, sex: n.sex, dob: n.dob, nat: n.nat, xp: n.xp, budget: true, coPilotFor: old.coPilotFor } as any);
      // routes the old pilot flew go to the replacement
      State.routes.forEach(r => { if (r.pilotId === old.id) r.pilotId = n.id; });
    } else S.staff.push(n);
  });
  const c: any = company(cid); c.payScale = c.payScale || {}; c.payScale[g] = 0.8;
  const u = unionOf(cid, g); Object.assign(u, { stage: 0, since: 0, at: Date.now(), cool: Date.now() + 45 * 864e5 });
  note(cid, `${PAY_GROUPS.filter(x => x[0] === g)[0][1]} replaced`, `${people.length} dismissed with two weeks' pay, and the same number hired at 80% of the going rate. Expect weaker service and more conduct problems for a while.`);
  try { Progress.popularity(-3, 'Striking staff dismissed'); } catch (e) { /* ignore */ }
  Store.save(); closeAll(); refresh();
};
