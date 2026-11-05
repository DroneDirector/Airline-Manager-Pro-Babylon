// Borrowed crew: when there aren't enough people to hire, other airlines lend you some of theirs (flight attendants,
// mechanics, ramp teams, security officers) on a 30-day contract. They work like your own people but cost far more: 2.5 to 5 times the
// normal pay, paid each week with the salaries. A few days before a contract ends you are told; renew it for another
// 30 days or send them back. If nothing is done, they go back to their airline the day it ends.

const LEASE_DAYS = 30, LEASE_ROLES: CrewRole[] = ['fa', 'mech', 'ground'];
const LEASE_FALLBACK = ['Nordwind Regional', 'Atlantic Link', 'Skyways Connect', 'Polar Air', 'Baltic Express'];

function leaseAirlines(): string[] {
  let names: string[] = [];
  try { names = Traffic.airlines().filter((a: any) => !a.heli).map((a: any) => a.name).filter((n: string) => n && n !== company().name); } catch (e) { names = []; }
  if (names.length < 3) names = names.concat(LEASE_FALLBACK);
  return names.filter((n, i, l) => l.indexOf(n) === i);
}
/** Today's offers for one kind of crew: three airlines, each with its own price (2.5–5 × normal pay). */
function leaseOffers(role: CrewRole): { from: string; mult: number }[] {
  const names = leaseAirlines(), day = Math.floor(Date.now() / 864e5), out: { from: string; mult: number }[] = [];
  for (let k = 0; k < 3 && k < names.length; k++) {
    const h = _hashStr(role + day + k);
    const band = [2.5, 3.3, 4.2][k], j = ((h >>> 5) % 9) / 10;   // a cheaper, a middle and a dear offer
    out.push({ from: names[(h >>> 2) % names.length], mult: Math.min(5, Math.round((band + j) * 10) / 10) });
  }
  // three different airlines
  const seen: any = {}; for (const o of out) { let i = names.indexOf(o.from); while (seen[o.from] && i >= 0) { i = (i + 1) % names.length; o.from = names[i]; } seen[o.from] = 1; }
  return out.sort((a, b) => a.mult - b.mult);
}
function leasedOf(cid?: string): any[] { const id = cid || State.companyId; return ((State as any).staff || []).filter((p: any) => p.companyId === id && p.lease && !p.left); }
const LEASE_LABEL: { [r: string]: [string, string] } = { fa: ['flight attendant', 'flight attendants'], mech: ['mechanic', 'mechanics'], ground: ['ramp agent', 'ramp team'], security: ['security officer', 'security officers'] };

ACTIONS['crew-lease'] = el => {
  const role = el.getAttribute('data-id') as CrewRole, base = el.getAttribute('data-base') || company().hub, n = Math.max(1, +(el.getAttribute('data-n') || 1));
  const sec = (role as string) === 'security'; if (LEASE_ROLES.indexOf(role) < 0 && !sec) return;
  const sample = sec ? makeSecurity('lease-sample', base, '') : makePerson('lease-sample', role, '', base), normal = sample.salary || 1000, L = LEASE_LABEL[role];
  Sound.tick();
  openLayer('modal', `<div class="modal-head"><h2>Borrow ${n} ${n === 1 ? L[0] : L[1]}${role === 'ground' || sec ? ` at ${esc(base)}` : ''}</h2><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
    <div class="modal-body"><p class="lede">${icon('info')}${sec ? 'Short of security officers? ' : 'Not enough people are looking for work. '} Other airlines can lend you some of theirs for ${LEASE_DAYS} days. They cost far more than your own crew (your own: about ${money(normal)} a week each). You'll be asked to renew or send them back each month.</p>
    <div class="lease-offers">${leaseOffers(role).map(o => { const each = Math.round(normal * o.mult / 10) * 10;
      return `<div class="lease-offer"><span><b>${esc(o.from)}</b><small>${money(each)} a week each · ${o.mult}× normal pay · ${money(each * n)} a week for all ${n}</small></span>
        <button class="btn primary sm" data-act="crew-lease-take" data-id="${role}" data-base="${esc(base)}" data-n="${n}" data-from="${esc(o.from)}" data-mult="${o.mult}">Borrow for ${LEASE_DAYS} days</button></div>`; }).join('')}</div></div>`, { cls: 'narrow' });
};
ACTIONS['crew-lease-take'] = el => {
  const S: any = State, c: any = company(), role = el.getAttribute('data-id') as CrewRole, base = el.getAttribute('data-base') || c.hub, n = Math.max(1, +(el.getAttribute('data-n') || 1));
  const from = el.getAttribute('data-from') || 'another airline', mult = +(el.getAttribute('data-mult') || 3), day = dateStr(new Date()).slice(0, 10), until = Date.now() + LEASE_DAYS * 864e5;
  const jobs = ['ramp', 'baggage', 'pushback', 'baggage', 'stairs', 'baggage', 'ramp', 'fuel', 'catering'];
  const names: string[] = [];
  for (let i = 0; i < n; i++) {
    const sec = (role as string) === 'security', p: any = sec ? makeSecurity('lease-sec' + uid(), base, c.id) : makePerson('lease-' + role + uid(), role, c.id, base);
    if (sec) p.companyId = c.id;
    p.salary = Math.round((p.salary || 1000) * mult / 10) * 10; p.hired = day; p.status = 'on duty';
    p.lease = { from, mult, until, warned: false };
    if (role === 'ground') p.job = jobs[i % jobs.length];
    if (sec) p.id = 'sec-' + p.id.replace(/^sec-/, '');
    S.staff.push(p); names.push(p.name);
  }
  closeAll(); Store.save();
  State.notices.unshift({ id: uid(), kind: 'staff' as any, title: `${n} borrowed from ${from}`, body: `${names.slice(0, 5).join(', ')}${n > 5 ? ' and others' : ''} work for you for ${LEASE_DAYS} days, at ${mult}× normal pay. Renew or send them back under Crew.`, time: 'Now', at: Date.now(), read: false } as any);
  toast(`${n} ${n === 1 ? LEASE_LABEL[role][0] : LEASE_LABEL[role][1]} borrowed from ${from} for ${LEASE_DAYS} days`, 'ok'); refresh();
};
ACTIONS['lease-renew'] = el => {
  const from = el.getAttribute('data-from'), id = el.getAttribute('data-id');
  const list = leasedOf().filter((p: any) => id ? p.id === id : p.lease.from === from);
  for (const p of list) { p.lease.until = Math.max(p.lease.until, Date.now()) + LEASE_DAYS * 864e5; p.lease.warned = false; }
  Sound.tick(); Store.save(); toast(`${list.length} renewed for another ${LEASE_DAYS} days`, 'ok'); refresh();
};
ACTIONS['lease-end'] = el => {
  const from = el.getAttribute('data-from'), id = el.getAttribute('data-id'), S: any = State;
  const list = leasedOf().filter((p: any) => id ? p.id === id : p.lease.from === from);
  S.staff = S.staff.filter((p: any) => list.indexOf(p) < 0);
  Sound.tick(); Store.save(); toast(`${list.length} sent back to ${list[0] ? list[0].lease.from : 'their airline'}`, 'info'); refresh();
};
/** Each day: contracts about to end are flagged; ended ones go back to their airline. */
function leaseDaily() {
  const S: any = State, now = Date.now(); if (!S.staff) return;
  let ch = false; const back: any = {}, soon: any = {};
  for (const p of S.staff as any[]) {
    if (!p.lease) continue;
    if (now >= p.lease.until) { back[p.lease.from] = (back[p.lease.from] || 0) + 1; p.left = true; ch = true; }
    else if (p.lease.until - now < 3 * 864e5 && !p.lease.warned) { p.lease.warned = true; soon[p.lease.from] = (soon[p.lease.from] || 0) + 1; ch = true; }
  }
  if (!ch) return;
  S.staff = S.staff.filter((p: any) => !(p.lease && p.left));
  for (const f of Object.keys(soon)) State.notices.unshift({ id: uid(), kind: 'staff' as any, title: `Borrowed crew: contract ends soon`, body: `${soon[f]} from ${f} go back in under 3 days. Renew or send them back under Crew.`, time: 'Now', at: Date.now(), read: false } as any);
  for (const f of Object.keys(back)) State.notices.unshift({ id: uid(), kind: 'staff' as any, title: `${back[f]} went back to ${f}`, body: 'Their contract ended without being renewed.', time: 'Now', at: Date.now(), read: false } as any);
  Store.soon();
}
setInterval(() => { try { leaseDaily(); } catch (e) { /* next time */ } }, 60000);
setTimeout(() => { try { leaseDaily(); } catch (e) { /* later */ } }, 16000);

/** The card in Crew: who you have borrowed, from whom, what they cost and how long is left. */
function leasedCardHtml(): string {
  const L = leasedOf(); if (!L.length) return '';
  const from = L.map((p: any) => p.lease.from).filter((f: string, i: number, l: string[]) => l.indexOf(f) === i);
  return `<div class="card lease-card"><div class="cn-h"><span><b>${icon('swap')}Borrowed crew</b><small>${L.length} from other airlines · ${money(L.reduce((s: number, p: any) => s + (p.salary || 0), 0))} a week</small></span></div>
    ${from.map((f: string) => { const ps = L.filter((p: any) => p.lease.from === f), days = Math.max(0, Math.ceil((Math.min(...ps.map((p: any) => p.lease.until)) - Date.now()) / 864e5));
      return `<div class="lease-row ${days <= 3 ? 'soon' : ''}"><span><b>${esc(f)}</b><small>${ps.length} · ${esc(ps.map((p: any) => `${p.name} (${p.job === 'security' ? 'Security' : ROLE_NAMES[p.role] || p.role}${p.role === 'ground' ? ', ' + p.base : ''})`).slice(0, 4).join(', '))}${ps.length > 4 ? '…' : ''}</small><em>${days ? `Contract ends in ${days} ${days === 1 ? 'day' : 'days'}` : 'Contract ends today'} · ${ps[0].lease.mult}× normal pay</em></span>
        <button class="btn sm primary" data-act="lease-renew" data-from="${esc(f)}">Renew ${LEASE_DAYS} days</button><button class="btn sm ghost" data-act="lease-end" data-from="${esc(f)}">Send back</button></div>`; }).join('')}</div>`;
}
