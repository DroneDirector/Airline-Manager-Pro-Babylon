// Sick days. Now and then a hired pilot, co-pilot, flight attendant, mechanic or ground worker calls in
// sick, for a few days (most) up to two weeks (a few). About 7% of staff a month, close to real airline
// sickness rates. An aircraft can't fly without the crew it needs: a hired pilot's flights wait until you
// find cover (another of your pilots rated on the type, or an expensive contract pilot from an agency),
// and are cancelled after five hours and tried again the next day. Cabin crew and mechanics are covered
// from the rest of the team when there are enough of them; when there aren't, an agency can fill in.

const SICK_DAY_P = 0.0024;                 // per person per day: about 7% a month
const SICK_REASONS = ['Flu', 'A bad cold', 'Stomach bug', 'Back pain', 'Migraine', 'A sprained ankle', 'Ear infection (no flying with blocked ears)', 'Fever', 'Food poisoning', 'A sick child at home'];
const SICK_DAYS = [1, 1, 2, 2, 2, 3, 3, 4, 5, 7, 10, 14];

function isSick(p: any): boolean { return !!(p && p.sickUntil && p.sickUntil > Date.now()); }

/** Once a day for each person (from the morale round). */
function sicknessDaily(p: any) {
  const now = Date.now();
  if (p.sickUntil && p.sickUntil <= now) sickWell(p);
  if (p.sickUntil || p.onStrike || p.left || p.status === 'training') return;
  if (Math.random() >= SICK_DAY_P * (staffMood(p) < 35 ? 1.6 : 1)) return;   // unhappy people are off more often
  const days = SICK_DAYS[Math.floor(Math.random() * SICK_DAYS.length)], why = SICK_REASONS[Math.floor(Math.random() * SICK_REASONS.length)];
  p.sickUntil = now + days * 864e5; p.sickWhy = why; p.sickWas = p.status; p.status = 'off';
  const role = personRole(p), cid = staffCompany(p), pilotRole = role === 'captain' || role === 'fo';
  const what = pilotRole ? (p.coPilotFor ? 'Your co-pilot is off. Two-pilot aircraft you fly need a stand-in or a contract first officer.' : 'Their flights stay on the ground until you find cover.')
    : sickCoverNeed(cid, role as CrewRole) > 0 ? `The rest of the ${role === 'fa' ? 'cabin crew' : role === 'mech' ? 'mechanics' : 'ground crew'} can't cover every flight: an agency can fill in.` : 'The rest of the team covers for them.';
  State.notices.unshift({ id: uid(), kind: 'staff' as any, title: `${p.name} called in sick`, body: `${why}, off for ${days} ${days === 1 ? 'day' : 'days'}. ${what}`, time: 'Now', at: now, read: false, ref: 'si-' + p.id } as any);
  try { renderTopbar(); } catch (e) { /* not ready */ }
}
function sickWell(p: any) {
  p.sickUntil = 0; if (p.status === 'off' && !p.onStrike) p.status = p.sickWas && p.sickWas !== 'off' ? p.sickWas : 'on duty';
  // a stand-in hands the routes back
  State.routes.forEach((r: any) => { if (r.sickOf === p.id) { r.pilotId = p.id; r.sickOf = ''; } });
  const S: any = State; (S.aiNext || []).forEach((n: any) => { if (n.sickOf === p.id) { n.pilotId = p.id; n.sickOf = ''; } });
  p.coverAgency = 0;
}

/** How many more of a role the airline needs than it has fit and at work (cabin crew and mechanics). */
function sickCoverNeed(cid: string, role: CrewRole): number {
  const all = staffOf(cid, role), fit = all.filter((p: any) => !isSick(p) && !p.onStrike && p.status !== 'off');
  const fleet = fleetOf(cid);
  const need = role === 'fa' ? fleet.reduce((s, a) => s + faNeeded(acType(a.typeId)), 0) * 0.6   // not every aircraft is in the air at once
    : role === 'mech' ? Math.max(1, Math.ceil(fleet.length * 0.5)) : 0;
  return Math.max(0, Math.ceil(need) - fit.length);
}
function agencyOn(cid: string, role: string): boolean { const c: any = company(cid); return !!(c.agency && c.agency[role] && c.agency[role] > Date.now()); }

/** What sickness stops: the reason a hired pilot's leg can't leave, or ''. */
function sickBlock(n: any, a: any): string {
  const p: any = pilot(n.pilotId);
  if (p && isSick(p) && !(p.coverAgency && p.coverAgency > Date.now())) return `${p.name} off sick: no cover`;
  const t = acType(a.typeId), cid = a.companyId;
  if (t && faNeeded(t) && sickCoverNeed(cid, 'fa') > 0 && !agencyOn(cid, 'fa') && staffOf(cid, 'fa').filter((x: any) => !isSick(x) && !x.onStrike).length < faNeeded(t)) return 'Not enough cabin crew: sickness';
  if (staffOf(cid, 'mech').length && !staffOf(cid, 'mech').some((x: any) => !isSick(x) && !x.onStrike) && !agencyOn(cid, 'mech')) return 'No mechanic to release the aircraft: sickness';
  return '';
}

/* ---------- your answer ---------- */
function sickPopup(id: string) {
  const p: any = staffById(id); if (!p) return;
  const role = personRole(p), cid = staffCompany(p), pilotRole = role === 'captain' || role === 'fo';
  const left = Math.max(1, Math.ceil(((p.sickUntil || Date.now()) - Date.now()) / 864e5));
  const day = Math.round(goingRate(p) * 2.2 / 7 / 10) * 10;
  const types: string[] = p.types || [];
  const stand = pilotRole && !p.coPilotFor ? State.pilots.filter((x: any) => !x.you && x.id !== p.id && staffCompany(x) === cid && !isSick(x) && !x.onStrike && x.status !== 'off'
    && !State.routes.some(r => r.pilotId === x.id) && (x.types || []).some((tt: string) => types.indexOf(tt) >= 0)) : [];
  const short = pilotRole ? 0 : sickCoverNeed(cid, role as CrewRole);
  closeAll();
  openLayer('modal', `<div class="modal-head"><div><h2>${esc(p.name)} is off sick</h2><small>${ROLE_NAMES[role]} · ${esc(p.sickWhy || 'Ill')} · ${isSick(p) ? `back in about ${left} ${left === 1 ? 'day' : 'days'}` : 'back at work'}</small></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
    <div class="modal-body">
      ${!isSick(p) ? `<p class="lede">${esc(p.name)} is well again and back at work.</p>` : pilotRole ? `<p class="lede">${p.coPilotFor ? 'Two-pilot aircraft you fly need a first officer.' : 'Their flights can\'t leave without a pilot. Waiting flights are cancelled after five hours and flown the next day.'}</p>
      <div class="btn-col strike-opts">
        ${stand.length ? `<label class="field"><span>Stand-in from your own pilots (rated on the type, not on a route)</span><select class="le-in sick-stand">${stand.map((x: any) => `<option value="${esc(x.id)}">${esc(x.name)} · ${esc(x.base)}</option>`).join('')}</select></label>
          <button class="btn primary" data-act="sick-stand" data-id="${esc(p.id)}">${icon('user')}Use the stand-in<small>No extra cost; they fly ${esc(p.name.split(' ')[0])}'s routes until ${esc(p.name.split(' ')[0])} is back</small></button>` : `<p class="fine-print">${icon('info')}None of your other pilots is free and rated on the same type.</p>`}
        ${p.coverAgency && p.coverAgency > Date.now() ? `<p class="fine-print">${icon('check')}A contract pilot is already covering.</p>` : `<button class="btn ${stand.length ? 'ghost' : 'primary'}" data-act="sick-agency" data-id="${esc(p.id)}">${icon('pilots')}Contract pilot from an agency<small>${money(day)} a day, ${money(day * left)} for ${left} ${left === 1 ? 'day' : 'days'}</small></button>`}
        <button class="btn ghost" data-act="close-layer">${icon('clock')}Wait<small>The flights stay on the ground until ${esc(p.name.split(' ')[0])} is back</small></button>
      </div>` : short > 0 ? `<p class="lede">Without ${esc(p.name.split(' ')[0])}, ${esc(company(cid).name)} is ${short} ${role === 'fa' ? 'flight attendant' : role === 'mech' ? 'mechanic' : 'ground worker'}${short > 1 ? 's' : ''} short. Some flights may have to wait.</p>
      <div class="btn-col strike-opts">
        ${agencyOn(cid, role) ? `<p class="fine-print">${icon('check')}Agency staff are already covering.</p>` : `<button class="btn primary" data-act="sick-agency" data-id="${esc(p.id)}">${icon('pilots')}Agency cover<small>${money(day * short)} a day, ${money(day * short * left)} until ${esc(p.name.split(' ')[0])} is back</small></button>`}
        <button class="btn ghost" data-act="close-layer">${icon('clock')}Manage without<small>Flights wait when there aren't enough people</small></button>
      </div>` : `<p class="lede">The rest of the team covers for ${esc(p.name.split(' ')[0])}. Nothing needs doing; get well soon.</p>`}
    </div>`, { cls: 'strike-modal' });
}
ACTIONS['sick-open'] = el => sickPopup(el.getAttribute('data-id'));
ACTIONS['sick-stand'] = el => {
  const p: any = staffById(el.getAttribute('data-id')), sel = $('.sick-stand') as HTMLSelectElement; if (!p || !sel) return;
  const s: any = staffById(sel.value); if (!s) return;
  State.routes.forEach((r: any) => { if (r.pilotId === p.id) { r.pilotId = s.id; r.sickOf = p.id; } });
  const S: any = State; (S.aiNext || []).forEach((n: any) => { if (n.pilotId === p.id) { n.pilotId = s.id; n.sickOf = p.id; } });
  s.status = 'flying'; staffMoodAdd(s, 2);
  Store.save(); closeAll(); refresh(); toast(`${s.name} covers for ${p.name}`, 'ok');
};
ACTIONS['sick-agency'] = el => {
  const p: any = staffById(el.getAttribute('data-id')); if (!p) return;
  const role = personRole(p), cid = staffCompany(p), pilotRole = role === 'captain' || role === 'fo';
  const left = Math.max(1, Math.ceil((p.sickUntil - Date.now()) / 864e5)), day = Math.round(goingRate(p) * 2.2 / 7 / 10) * 10;
  const n = pilotRole ? 1 : Math.max(1, sickCoverNeed(cid, role as CrewRole)), cost = day * n * left;
  payTxn(cid, `Agency ${pilotRole ? 'contract pilot' : ROLE_NAMES[role].toLowerCase()} for ${p.name}`, -cost, 'salary', [[`${n} × ${left} ${left === 1 ? 'day' : 'days'} × ${money(day)}`, -cost]]);
  if (pilotRole) p.coverAgency = p.sickUntil;
  else { const c: any = company(cid); c.agency = c.agency || {}; c.agency[role] = p.sickUntil; }
  Store.save(); closeAll(); refresh(); toast(pilotRole ? 'A contract pilot flies until they are back' : 'Agency staff fill in', 'ok');
};
