// Who is on board: the passenger list of every flight, with names, nationality, seat, class and faces,
// the loadsheet (what everything weighs against the limits), and the boarding scan at the gate, where
// passports and boarding passes are checked and anyone on a no-fly list is flagged for you to decide.
// Passengers are made up for each flight from its booked load (the same people every time you look);
// most come from the departure country, some from the destination, some from anywhere. A few have a
// conduct record: warnings from earlier flights, or a ban. Your own flight is never given passengers:
// the list only puts names to the number the simulator (or GSX) reports.

interface PaxRecord { key: string; name: string; nat: string; sex: 'm' | 'f'; notes: { date: string; title: string; text: string; sev: 'warning' | 'ban' }[]; banned?: boolean; bannedBy?: string; authUntil?: number | null }
interface PaxSeat { key: string; name: string; nat: string; sex: 'm' | 'f'; age: number; seat: string; cls: 'F' | 'J' | 'Y'; look: any; record: PaxRecord; famous?: string; pet?: PaxPet }

// now and then (about one flight in 20) someone well known is on board; all made-up people
const CELEB_JOBS = ['Film actor', 'Pop singer', 'Football star', 'Racing driver', 'TV chef', 'Best-selling author', 'Tennis champion', 'Stand-up comedian', 'News presenter', 'Olympic swimmer', 'Rock guitarist', 'Fashion designer', 'Film director', 'Opera singer', 'Video creator'];

// some passengers come with a record from before (other airlines, the authorities)
const PAX_PAST: [string, string, 'warning' | 'ban'][] = [
  ['Disruptive behaviour', 'Shouted at cabin crew and refused to follow instructions on an earlier flight.', 'warning'],
  ['Smoking in the lavatory', 'Set off the smoke detector in the lavatory on an earlier flight.', 'warning'],
  ['Intoxicated at the gate', 'Was refused boarding on an earlier flight for being heavily drunk.', 'warning'],
  ['Assault on crew', 'Struck a flight attendant on an earlier flight. Banned from flying by the airline concerned and listed by the authorities.', 'ban'],
  ['Threats on board', 'Made threats against other passengers on an earlier flight; the aircraft diverted. On a no-fly list.', 'ban'],
];

function paxStore(): { [key: string]: PaxRecord } { const S: any = State; return S.paxRecords || (S.paxRecords = {}); }
function noFly(): { [key: string]: any } { const S: any = State; return S.noFly || (S.noFly = {}); }
/** Your airline's ban on a passenger: when it ends (null: for life), or undefined when there is none or it has run out. */
function ownBanUntil(k: string): number | null | undefined {
  const v = noFly()[k]; if (!v) return undefined;
  if (typeof v === 'string') return null;   // bans from before ban lengths: for life
  return v.until == null || v.until > Date.now() ? v.until : undefined;
}
/** Is this passenger banned right now, by you or by the authorities, and until when? */
function paxBan(rec: PaxRecord): { by: string; until: number | null } | null {
  if (!rec) return null;
  const own = ownBanUntil(rec.key);
  if (own !== undefined) return { by: 'your airline', until: own };
  if (rec.notes.some(n => n.sev === 'ban' && !/your airline/.test(n.title)) && (rec.authUntil == null || rec.authUntil > Date.now())) return { by: 'the authorities', until: rec.authUntil == null ? null : rec.authUntil };
  return null;
}
function banText(b: { by: string; until: number | null }): string { return b.until == null ? `banned for life by ${b.by}` : `banned by ${b.by} until ${dateStr(new Date(b.until)).slice(0, 10)}`; }
const BAN_LENGTHS: [string, number][] = [['3 months', 91], ['6 months', 182], ['1 year', 365], ['2 years', 730], ['5 years', 1826], ['For life', 0]];

/** The passengers of a flight (cached per flight). */
const _manifests = new Map<string, PaxSeat[]>();
function manifestOf(f: LiveFlight): PaxSeat[] {
  const F: any = f, n = Math.max(0, f.pax || 0), key = f.id + '|' + n;
  const hit = _manifests.get(key); if (hit) return hit;
  const t = acType(flightTypeId(f)) || AIRCRAFT[0];
  // who they are comes from the flight, or from the seed it was given before it left (the people already waiting in
  // your lounge for it are the same people on board)
  const sid = F.paxSeed || f.id;
  const nF = Math.min(n, F.paxF || 0), nJ = Math.min(n - nF, F.paxJ || 0);
  const abreast = t.seats > 250 ? 9 : t.seats > 100 ? 6 : t.seats > 40 ? 4 : t.seats > 12 ? 3 : 2;
  const letters = 'ABCDEFGHJK'.slice(0, abreast).split('');
  const natFrom = (NAT_FOR_HUB as any)[f.from], natTo = (NAT_FOR_HUB as any)[f.to];
  const out: PaxSeat[] = [];
  let row = 1, col = 0, lastCls = '', ySlots: string[] = null, yi = 0;
  for (let i = 0; i < n; i++) {
    const cls: 'F' | 'J' | 'Y' = i < nF ? 'F' : i < nF + nJ ? 'J' : 'Y';
    if (cls !== lastCls && lastCls) { row += (col ? 1 : 0) + (cls === 'Y' ? 2 : 1); col = 0; }
    lastCls = cls;
    // premium rows have fewer, wider seats: no middle seats (A C D F on a six-abreast aircraft), as in the cabin
    const rowLetters = cls === 'Y' ? letters : abreast === 6 ? ['A', 'C', 'D', 'F'] : abreast >= 9 ? letters.filter((l, i) => i !== 1 && i !== abreast - 2) : letters.slice(0, Math.max(2, abreast - 2));
    const per = rowLetters.length;
    let seat = row + rowLetters[Math.min(col, rowLetters.length - 1)];
    if (cls === 'Y') {
      // economy passengers spread over the whole economy cabin as booked (window seats first, middle seats
      // last), not packed into the front rows
      if (!ySlots) {
        const nY = n - nF - nJ, capY = Math.max(nY, (t.seats || nY) - nF - nJ), rowsY = Math.ceil(capY / abreast), rnd = seeded(sid + '|seats');
        const middles = abreast === 6 ? [1, 4] : abreast >= 9 ? [1, 4, 7] : [];
        const all: { r: number; c: number; w: number }[] = [];
        for (let rr = 0; rr < rowsY; rr++) for (let c = 0; c < abreast; c++) all.push({ r: row + rr, c, w: (c === 0 || c === abreast - 1 ? 0 : middles.indexOf(c) >= 0 ? 0.6 : 0.25) + rnd() * 0.8 });
        ySlots = all.sort((a, b) => a.w - b.w).slice(0, nY).sort((a, b) => a.r - b.r || a.c - b.c).map(x => x.r + letters[x.c]);
      }
      seat = ySlots[yi++] || seat;
    }
    col++; if (col >= per) { col = 0; row++; }
    const seed = sid + ':' + i, r = seeded(seed + 'n'), roll = r();
    const nat = roll < 0.6 && natFrom ? natFrom[Math.floor(r() * natFrom.length)] : roll < 0.85 && natTo ? natTo[Math.floor(r() * natTo.length)] : undefined;
    const p: any = makePerson(seed, 'fa', '', f.from, r() < 0.5 ? 'f' : 'm', nat);
    p.look.uniform = Math.floor(r() * 6);
    // their own clothes, not a uniform: a pullover, a jacket or a shirt, open collar, no tie or crew wings
    p.look.civil = true; p.look.top = ['pullover', 'pullover', 'jacket', 'shirt'][Math.floor(r() * 4)]; p.look.neck = 'open'; p.look.hat = 'none';
    p.look.shoes = p.sex === 'f' ? ['sneakers', 'boots', 'pumps'][Math.floor(r() * 3)] : ['sneakers', 'boots', 'oxford'][Math.floor(r() * 3)];
    const age = 2026 - parseInt(p.dob, 10) + Math.floor(r() * 25) - 8;
    const pkey = (p.name + '|' + p.nat + '|' + age).toLowerCase();
    // a past record for about one passenger in 60, a ban for about one in 1,500
    let rec = paxStore()[pkey] || null;
    if (!rec) {
      const rr = seeded(pkey + 'rec')();
      if (rr < 1 / 60) {
        const past = PAX_PAST[rr < 1 / 1500 ? 3 + Math.floor(seeded(pkey)() * 2) : Math.floor(seeded(pkey)() * 3)];
        const d = new Date(Date.now() - (30 + Math.floor(seeded(pkey + 'd')() * 700)) * 864e5);
        rec = { key: pkey, name: p.name, nat: p.nat, sex: p.sex, notes: [{ date: dateStr(d).slice(0, 10), title: past[0], text: past[1], sev: past[2] }], banned: past[2] === 'ban', bannedBy: past[2] === 'ban' ? 'the authorities' : '' };
        // an authorities' ban: for life (about half), or two to five years from the incident
        if (past[2] === 'ban') { const rb = seeded(pkey + 'ban')(); rec.authUntil = rb < 0.5 ? null : d.getTime() + Math.round((2 + rb * 6) / 1) * 182 * 864e5; rec.notes[0].text += rec.authUntil == null ? ' Banned from flying for life.' : ` Banned from flying until ${dateStr(new Date(rec.authUntil)).slice(0, 10)}.`; }
        paxStore()[pkey] = rec;
      }
    }
    if (rec) { const b = paxBan(rec); rec.banned = !!b; rec.bannedBy = b ? b.by : ''; }   // bans run out
    out.push({ key: pkey, name: p.name, nat: p.nat, sex: p.sex, age: clamp(age, 2, 92), seat, cls, look: p.look, record: rec, pet: age >= 18 ? paxPet(pkey, f) : null });
  }
  // a celebrity on about one flight in 20: in first or business if there is one, otherwise up front in economy
  if (out.length >= 2 && seeded(sid + 'celeb')() < 0.05) {
    const r = seeded(sid + 'celeb2'), prem = out.filter(p => p.cls !== 'Y'), pool = prem.length ? prem : out.slice(0, Math.min(12, out.length));
    const who = pool[Math.floor(r() * pool.length)];
    who.famous = CELEB_JOBS[Math.floor(r() * CELEB_JOBS.length)]; who.age = clamp(who.age, 22, 78); who.record = null;
  }
  // passengers who drank too much in your lounge: refused ones aren't on board; those you let on are marked
  try { for (const d of drunkList()) { if (d.callsign !== f.callsign || Math.abs(d.dep - ((F.depAt || 0) as number)) > 6 * 3600e3) continue;
    const i = out.findIndex(p => p.name === d.name); if (d.decided === 'deny') { if (i >= 0) out.splice(i, 1); } else if (d.decided === 'allow') { const p: any = i >= 0 ? out[i] : out.filter(x => x.cls !== 'Y')[0]; if (p) { if (i < 0) p.name = d.name; p.drunk = d.bac; } } } } catch (e) { /* none */ }
  _manifests.set(key, out);
  if (_manifests.size > 40) _manifests.delete(_manifests.keys().next().value);
  return out;
}

/* ---------- the passenger list ---------- */
ACTIONS['pax-list'] = el => {
  const f = State.live.filter(x => x.id === el.getAttribute('data-id'))[0]; if (!f) return;
  Sound.tick(); _paxJump = {};
  const list = manifestOf(f), flagged = list.filter(p => p.record).length, star = list.filter(p => p.famous)[0];
  const clsName: { [k: string]: string } = { F: 'First', J: 'Business', Y: 'Economy' };
  const groups = (['F', 'J', 'Y'] as const).map(c => [c, list.filter(p => p.cls === c)] as [string, PaxSeat[]]).filter(g => g[1].length);
  openLayer('modal', `<div class="modal-head"><div><h2>Passengers: ${esc(f.callsign)}</h2><small>${esc(f.from)} → ${esc(f.noDest ? '…' : f.to)} · ${list.length} on board${f.you ? ' · numbers from the simulator' : ''}</small>
      <div class="pax-chips">${(() => {
        // tap a chip to jump to them in the list (again for the next one)
        const pets = list.filter(p => p.pet), dogs = pets.filter(p => p.pet.kind === 'dog' && !p.pet.left).length, cats = pets.filter(p => p.pet.kind === 'cat' && !p.pet.left).length, left = pets.filter(p => p.pet.left).length;
        const chip = (k: string, cls: string, ic: string, txt: string) => `<button class="pax-chip ${cls}" data-act="pax-jump" data-k="${k}">${ic}${esc(txt)}</button>`;
        return [flagged ? chip('rec', 'rec', icon('alert'), `${flagged} with a conduct record`) : '',
          dogs || cats ? chip('pet', 'pet', '', [dogs ? `${dogs} ${dogs === 1 ? 'dog' : 'dogs'}` : '', cats ? `${cats} ${cats === 1 ? 'cat' : 'cats'}` : ''].filter(Boolean).join(', ') + ' on board') : '',
          left ? chip('petleft', 'pet left', '', `${left} ${left === 1 ? 'pet' : 'pets'} left behind`) : '',
          star ? chip('star', 'star', icon('star'), star.famous) : ''].join('');
      })()}</div></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
    ${paxSortHtml(f.id)}
    <div class="modal-body pax-list">${paxBodyHtml(f, list)}</div>`, { cls: 'wide pax-pop' });
  void groups; void clsName;
  paxFacesLazy();
};
/* sorting the passenger list: by seat (in cabin classes), name, nationality, age, gender, mood, conduct or pets */
const PAX_SORTS: [string, string][] = [['seat', 'Seat'], ['name', 'Name'], ['nat', 'Nationality'], ['age', 'Age'], ['sex', 'Gender'], ['mood', 'Mood'], ['conduct', 'Conduct'], ['pet', 'Pets']];
let _paxQ = '';
function paxSortPref(): { by: string; dir: number } { const S: any = State.settings; return S.paxSort || { by: 'seat', dir: 1 }; }
function paxSortHtml(fid: string): string {
  const p = paxSortPref();
  return `<div class="sort-bar pax-sort"><span class="lst-q-w">${icon('search')}<input class="le-in pax-q" data-f="${esc(fid)}" placeholder="Name or nationality" value="${esc(_paxQ)}" spellcheck="false"></span><span class="sort-l">Sort</span>${PAX_SORTS.map(o => `<button class="fchip sm ${p.by === o[0] ? 'on' : ''}" data-act="pax-sort" data-f="${esc(fid)}" data-b="${o[0]}">${esc(o[1])}${p.by === o[0] ? (p.dir > 0 ? ' ↓' : ' ↑') : ''}</button>`).join('')}</div>`;
}
function paxBodyHtml(f: LiveFlight, list: PaxSeat[]): string {
  const p = paxSortPref(), q = _paxQ.toLowerCase().trim();
  let rows = q ? list.filter(x => (x.name + ' ' + natLabel(x.nat) + ' ' + x.nat).toLowerCase().indexOf(q) >= 0) : list.slice();
  if (!rows.length) return emptyState(q ? 'Nobody matches that' : 'Nobody on board', q ? 'Try another name or nationality.' : 'The passengers show here once they have boarded.');
  const clsName: { [k: string]: string } = { F: 'First', J: 'Business', Y: 'Economy' };
  if (p.by === 'seat') {
    const groups = (['F', 'J', 'Y'] as const).map(c => [c, rows.filter(x => x.cls === c)] as [string, PaxSeat[]]).filter(g => g[1].length);
    if (p.dir < 0) groups.reverse().forEach(g => g[1].reverse());
    return groups.map(([c, ps]) => `<h4>${clsName[c]} · ${ps.length}</h4>${ps.map((x, i) => paxRowHtml(f.id, x, i)).join('')}`).join('');
  }
  const mood: { [k: string]: number } = {};
  if (p.by === 'mood') for (const x of rows) { try { mood[x.key] = paxMood(f, x, list).mood; } catch (e) { mood[x.key] = 50; } }
  const conduct = (x: PaxSeat) => x.record ? (x.record.banned ? 2 : 1) * 100 + x.record.notes.length : 0;
  const cmp: { [k: string]: (a: PaxSeat, b: PaxSeat) => number } = {
    name: (a, b) => a.name.localeCompare(b.name), nat: (a, b) => natLabel(a.nat).localeCompare(natLabel(b.nat)) || a.name.localeCompare(b.name),
    age: (a, b) => a.age - b.age, sex: (a, b) => (a.sex === b.sex ? 0 : a.sex === 'f' ? -1 : 1) || a.name.localeCompare(b.name),
    mood: (a, b) => mood[b.key] - mood[a.key],                                        // happiest first
    conduct: (a, b) => conduct(b) - conduct(a) || a.name.localeCompare(b.name),       // worst record first
    pet: (a, b) => (b.pet ? 1 : 0) - (a.pet ? 1 : 0) || a.name.localeCompare(b.name), // with a pet first
  };
  rows.sort((a, b) => (cmp[p.by] || cmp.name)(a, b) * p.dir);
  const label = PAX_SORTS.filter(o => o[0] === p.by)[0];
  return `<h4>All passengers by ${esc((label ? label[1] : 'name').toLowerCase())} · ${rows.length}</h4>${rows.map((x, i) => paxRowHtml(f.id, x, i)).join('')}`;
}
function paxRerender(fid: string) {
  const f = State.live.filter(x => x.id === fid)[0]; if (!f) return;
  const body = document.querySelector('.pax-pop .pax-list') as HTMLElement, bar = document.querySelector('.pax-pop .pax-sort') as HTMLElement;
  if (body) { body.innerHTML = paxBodyHtml(f, manifestOf(f)); body.scrollTop = 0; }
  if (bar) { const t = document.createElement('div'); t.innerHTML = paxSortHtml(fid); const nb = t.firstElementChild as HTMLElement; const qv = (bar.querySelector('.pax-q') as HTMLInputElement); const focused = document.activeElement === qv; bar.replaceWith(nb); if (focused) { const ni = nb.querySelector('.pax-q') as HTMLInputElement; ni.focus(); ni.setSelectionRange(ni.value.length, ni.value.length); } }
  paxFacesLazy();
}
ACTIONS['pax-sort'] = el => {
  const b = el.getAttribute('data-b'), cur = paxSortPref(), S: any = State.settings;
  S.paxSort = { by: b, dir: cur.by === b ? -cur.dir : 1 }; Store.soon(); Sound.tick();
  paxRerender(el.getAttribute('data-f'));
};
let _paxQT: any = null;
document.addEventListener('input', e => {
  const el = e.target as HTMLInputElement; if (!el || !el.classList || !el.classList.contains('pax-q')) return;
  _paxQ = el.value; clearTimeout(_paxQT); _paxQT = setTimeout(() => paxRerender(el.getAttribute('data-f')), 200);
});
let _paxJump: { [k: string]: number } = {};
ACTIONS['pax-jump'] = el => {
  const k = el.getAttribute('data-k'), rows = Array.from(document.querySelectorAll(`.pax-pop .pax-row.has-${k}`)) as HTMLElement[]; if (!rows.length) return;
  const i = (_paxJump[k] = ((_paxJump[k] == null ? -1 : _paxJump[k]) + 1) % rows.length), row = rows[i];
  row.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' });
  rows.forEach(r => r.classList.remove('flash')); void row.offsetWidth; row.classList.add('flash');
  Sound.tick();
};
function paxRowHtml(fid: string, p: PaxSeat, i: number): string {
  const rec = p.record, banned = rec && rec.banned;
  return `<div role="button" tabindex="0" data-act="pax-card" data-f="${esc(fid)}" data-key="${esc(p.key)}" class="pax-row ${banned ? 'banned' : rec ? 'warned' : ''} ${p.famous ? 'famous' : ''} ${p.pet ? (p.pet.left ? 'has-petleft' : 'has-pet') : ''} ${rec ? 'has-rec' : ''} ${p.famous ? 'has-star' : ''}">
    <span class="pax-face" data-face="${esc(fid)}|${esc(p.key)}" data-i="${i}"></span>
    <span class="pax-who"><b>${esc(p.name)}${typeof ffTierChip === 'function' ? ffTierChip(p.name) : ''}${p.famous ? ` <i class="pax-star">${icon('star')}</i>` : ''}</b><small>${p.famous ? esc(p.famous) + ' · ' : ''}${natLabel(p.nat)} · ${p.age}</small>${p.pet ? `<span class="pax-pet ${p.pet.left ? 'left' : ''}" role="button" data-act="pet-visit" data-f="${esc(fid)}" data-key="${esc(p.key)}" title="${esc(p.pet.left || 'Visit ' + p.pet.name)}">${petSvg(p.pet)}<small>${esc(p.pet.name)}, ${p.pet.kind}, ${p.pet.left ? 'stayed behind' : p.pet.where === 'cabin' ? 'under the seat' : 'in the hold'}</small></span>` : ''}</span>
    <span class="pax-seat">${esc(p.seat)}</span>${(p as any).drunk ? `<span class="pax-drunk" title="Boarded drunk: about ${(p as any).drunk.toFixed(1)} per mille">Drunk</span>` : ''}
    ${(() => { try { const f: any = State.live.filter(x => x.id === fid)[0]; return f ? moodChip(f, p, manifestOf(f)) : ''; } catch (e) { return ''; } })()}
    ${rec ? `<button class="pax-rec ${banned ? 'ban' : ''}" data-act="pax-record" data-key="${esc(p.key)}">${icon('alert')}${banned ? 'Banned' : rec.notes.length + ' warning' + (rec.notes.length > 1 ? 's' : '')}</button>` : '<span class="pax-clean">Clean</span>'}
  </div>`;
}
/** Faces are drawn as the rows come into view, so a full widebody list opens at once. */
function paxFacesLazy() {
  const box = $('.pax-pop .pax-list'); if (!box) return;
  const draw = () => {
    const top = box.getBoundingClientRect().top, bottom = top + box.clientHeight + 200;
    for (const el of Array.from(box.querySelectorAll('.pax-face:not(.done)')) as HTMLElement[]) {
      const r = el.getBoundingClientRect(); if (r.bottom < top - 100 || r.top > bottom) continue;
      const df = el.getAttribute('data-face') || '', cut = df.indexOf('|'), fid = df.slice(0, cut), key = df.slice(cut + 1);
      const f = State.live.filter(x => x.id === fid)[0]; if (!f) continue;
      const p = manifestOf(f).filter(x => x.key === key)[0]; if (!p) continue;
      el.innerHTML = avatarSvg(p.look, 'fa', { view: 'bust', still: true });   // the same figure as in the cabin and on the card el.classList.add('done');
    }
  };
  draw(); [120, 400, 800].forEach(ms => setTimeout(draw, ms));   // again once the window has opened
  box.addEventListener('scroll', () => requestAnimationFrame(draw), { passive: true });
}
ACTIONS['pax-record'] = el => {
  const rec = paxStore()[el.getAttribute('data-key')]; if (!rec) return;
  Sound.tick();
  const mine = ownBanUntil(rec.key) !== undefined;
  openLayer('modal', `<div class="modal-head"><div><h2>${esc(rec.name)}</h2><small>${natLabel(rec.nat)}${rec.banned && paxBan(rec) ? ` · ${esc(banText(paxBan(rec)))}` : ''}</small></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
    <div class="modal-body warn-list">${rec.notes.map(n => `<div class="warn-item sev-${n.sev === 'ban' ? 'severe' : 'moderate'}"><div class="wi-h"><span class="wi-sev">${n.sev === 'ban' ? 'Ban' : 'Warning'}</span><b>${esc(n.title)}</b><time>${esc(n.date)}</time></div><p>${esc(n.text)}</p></div>`).join('')}
      <div class="modal-actions">${mine ? `<button class="btn ghost" data-act="pax-unban" data-key="${esc(rec.key)}">Lift your airline's ban</button>` : `<button class="btn danger" data-act="pax-ban" data-key="${esc(rec.key)}">${icon('shield')}Ban from your airline</button>`}</div></div>`, { cls: 'narrow' });
};
/** A passenger's card: who they are, their seat, why they travel, their pet, and any record. Opens on top of
 *  the list, so closing it goes back to the list. */
ACTIONS['pax-card'] = el => {
  const fid = el.getAttribute('data-f'), key = el.getAttribute('data-key');
  const f = State.live.filter(x => x.id === fid)[0]; if (!f) return;
  const p = manifestOf(f).filter(x => x.key === key)[0]; if (!p) return;
  Sound.tick();
  const r = seeded(p.key + 'card'), cls = ({ F: 'First', J: 'Business', Y: 'Economy' } as any)[p.cls];
  const why = p.famous ? 'Work: ' + p.famous.toLowerCase() : ['Holiday', 'Visiting family', 'Business', 'Business', 'A wedding', 'Studies', 'Going home', 'A conference', 'Weekend away'][Math.floor(r() * 9)];
  const tier = ['None', 'None', 'None', 'Blue', 'Blue', 'Silver', 'Gold'][Math.floor(r() * 7)], bags = p.cls === 'Y' ? Math.floor(r() * 2.4) : 1 + Math.floor(r() * 2);
  const svc = servicesOf((plane(f.reg) || {} as any).companyId || State.companyId);
  const meal = svc.specialMeals === 'yes' && r() < 0.12 ? ['Vegetarian', 'Vegan', 'Halal', 'Kosher', 'Gluten-free', 'Child\'s meal'][Math.floor(r() * 6)] : 'Standard';
  const flights = 1 + Math.floor(r() * (tier === 'Gold' ? 90 : tier === 'Silver' ? 40 : tier === 'Blue' ? 15 : 4));
  const rec = p.record, banned = rec && rec.banned;
  const kv = (k: string, v: string) => `<div><small>${esc(k)}</small><b>${v}</b></div>`;
  openLayer('modal', `<div class="modal-head"><div><h2>${esc(p.name)}${p.famous ? ` <i class="pax-star">${icon('star')}</i>` : ''}</h2><small>${p.famous ? esc(p.famous) + ' · ' : ''}${natLabel(p.nat)} · ${p.age}</small></div><button class="icon-btn" data-act="close-layer" aria-label="Back to the list">${icon('close')}</button></div>
    <div class="modal-body pax-card"><div class="pc-fig">${avatarSvg(p.look, 'fa', { view: 'bust', still: true })}</div>
      <div class="pc-info"><div class="kv-row">
        ${kv('Flight', `${esc(f.callsign)}, ${esc(f.from)} → ${esc(f.noDest ? '…' : f.to)}`)}${kv('Seat', `${esc(p.seat)}, ${cls}`)}${kv('Travelling for', esc(why))}
        ${kv('Checked bags', String(bags))}${kv('Meal', esc(meal))}${kv('Frequent flyer', tier === 'None' ? 'Not a member' : `${tier}, ${flights} flights with you`)}
        ${p.pet ? kv('Pet', `${petSvg(p.pet)} ${esc(p.pet.name)}, ${p.pet.kind}${p.pet.left ? ', left behind' : p.pet.where === 'cabin' ? ', under the seat' : ', in the hold'}`) : ''}
        ${kv('Conduct', rec ? `<span class="${banned ? 'red' : 'amber'}">${banned ? (paxBan(rec) ? esc(banText(paxBan(rec)).replace(/^b/, 'B')) : 'Banned') : rec.notes.length + ' warning' + (rec.notes.length > 1 ? 's' : '')}</span>` : '<span class="green">Clean record</span>')}
      </div>
      ${(() => { try { return moodCardHtml(f, p); } catch (e) { return ''; } })()}
      <div class="modal-actions">${rec ? `<button class="btn ghost" data-act="pax-record" data-key="${esc(p.key)}">${icon('alert')}Conduct record</button>` : ''}
        ${p.pet ? `<button class="btn ghost" data-act="pet-visit" data-f="${esc(fid)}" data-key="${esc(p.key)}">${petSvg(p.pet)}Visit ${esc(p.pet.name)}</button>` : ''}
        ${ownBanUntil(p.key) !== undefined ? '' : `<button class="btn danger" data-act="pax-ban" data-key="${esc(p.key)}" data-f="${esc(fid)}">${icon('shield')}Ban from your airline</button>`}</div></div></div>`, { cls: 'wide pax-card-pop' });
};
ACTIONS['pax-ban'] = el => {
  const k = el.getAttribute('data-key'); let rec = paxStore()[k];
  // a passenger with a clean record can be banned too: a record is started for them
  if (!rec) { const f = State.live.filter(x => x.id === el.getAttribute('data-f'))[0], p = f ? manifestOf(f).filter(x => x.key === k)[0] : null; if (!p) return;
    rec = paxStore()[k] = { key: k, name: p.name, nat: p.nat, sex: p.sex, notes: [] }; p.record = rec; }
  const days = el.getAttribute('data-days');
  if (days == null) {
    // first choose how long
    openLayer('modal', `<div class="modal-head"><div><h2>Ban ${esc(rec.name)}</h2><small>From flying with ${esc(company().name)}. How long?</small></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
      <div class="modal-body"><div class="ban-len">${BAN_LENGTHS.map(([t, d]) => `<button class="btn ${d ? 'ghost' : 'danger'}" data-act="pax-ban" data-key="${esc(k)}" data-f="${esc(el.getAttribute('data-f') || '')}" data-days="${d}">${esc(t)}</button>`).join('')}</div>
      <p class="fine-print">${icon('info')}A time ban lifts on its own when it runs out. You can lift any ban early from their record.</p></div>`, { cls: 'narrow' });
    return;
  }
  const d = +days, until = d ? Date.now() + d * 864e5 : null;
  noFly()[k] = { since: Date.now(), until }; rec.banned = true; rec.bannedBy = 'your airline';
  try { newsBan(rec, until); } catch (e) { /* ignore */ }
  rec.notes.push({ date: dateStr(new Date()).slice(0, 10), title: 'Banned by your airline', text: `${rec.name} may not fly with ${company().name} ${until ? 'until ' + dateStr(new Date(until)).slice(0, 10) : 'ever again (a lifetime ban)'}.`, sev: 'ban' });
  Store.save(); closeAll(); toast(`${rec.name} is ${until ? 'banned until ' + dateStr(new Date(until)).slice(0, 10) : 'banned for life'}`, 'ok');
};
ACTIONS['pax-unban'] = el => { const k = el.getAttribute('data-key'), rec = paxStore()[k]; delete noFly()[k]; if (rec) { const b = paxBan(rec); rec.banned = !!b; rec.bannedBy = b ? b.by : ''; } Store.save(); closeAll(); toast('Ban lifted', 'ok'); };

/* ---------- boarding: passports and boarding passes scanned at the gate ---------- */
const _scanned: { [flightId: string]: boolean } = {};
/** During boarding: anyone with a ban is flagged by the scan, and the gate asks you (it refuses them by
 *  itself if you don't answer within ten minutes). */
/** A well-known passenger boarding: a note for you, and a little good publicity once they land happy. */
function celebOnBoard(f: LiveFlight) {
  const F: any = f; if (F.celebNoted) return;
  const star = manifestOf(f).filter(p => p.famous)[0]; if (!star) return;
  F.celebNoted = true;
  try { newsCeleb(f, star); } catch (e) { /* ignore */ }
  State.notices.unshift({ id: uid(), kind: 'pilot', title: `${star.famous} on board ${f.callsign}`, body: `${star.name}, ${star.famous.toLowerCase()} from ${natLabel(star.nat)}, boarded at ${f.from} for ${f.to}, seat ${star.seat}. The crew are taking good care of them; photos with your aircraft are already online.`, time: 'Now', read: false, ref: f.id } as any);
  try { Progress.popularity(1, `${star.famous} flew with you`); } catch (e) { /* ignore */ }
}
function boardingScan(f: LiveFlight) {
  try { celebOnBoard(f); } catch (e) { /* ignore */ }
  try { petsOnBoard(f); } catch (e) { /* ignore */ }
  if (_scanned[f.id] || f.you) return;
  _scanned[f.id] = true;
  const banned = manifestOf(f).filter(p => p.record && p.record.banned)[0]; if (!banned) return;
  const F: any = f, id = 'scan-' + f.id;
  State.notices.unshift({ id, kind: 'flight', title: `Boarding scan: ${banned.name} is on a no-fly list`, body: `Flight ${f.callsign} to ${f.to}, seat ${banned.seat}. Passport and boarding pass match a passenger banned by ${banned.record.bannedBy || 'an airline'}. Deny boarding?`, time: 'Now', read: false, ref: id } as any);
  F.scanFlag = { key: banned.key, name: banned.name, seat: banned.seat, at: Date.now() };
  try { renderTopbar(); Sound.chime(); toast(`Boarding scan: ${banned.name} is on a no-fly list`, 'warn', { label: 'Decide', act: 'scan-open', data: f.id }); } catch (e) { /* not ready */ }
  setTimeout(() => { if (F.scanFlag && !F.scanFlag.done) scanDecide(f.id, true, true); }, 10 * 60000);
}
ACTIONS['scan-open'] = el => { const t = el.closest && el.closest('.toast'); if (t) t.remove(); scanPopup(el.getAttribute('data-id')); };
/** The boarding scan decision (from the toast or the notice); says so when it has already been settled. */
function scanPopup(id: string) {
  const f: any = State.live.filter(x => x.id === id)[0];
  if (!f || !f.scanFlag || f.scanFlag.done) {
    State.notices = State.notices.filter(n => n.ref !== 'scan-' + id); try { renderTopbar(); } catch (e) { /* ignore */ }
    const why = !f ? 'That flight has already left the gate, so the passenger flew as booked.' : f.scanFlag && f.scanFlag.done ? `This was already decided: ${esc(f.scanFlag.name)} was ${f.scanFlag.denied ? 'denied boarding' : 'let on board'}.` : 'There is nothing left to decide for this flight.';
    openLayer('modal', `<div class="modal-head"><div><h2>Boarding scan</h2>${f ? `<small>${esc(f.callsign)} · ${esc(f.from)} → ${esc(f.to)}</small>` : ''}</div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
      <div class="modal-body"><p class="lede">${why}</p><div class="modal-actions"><button class="btn" data-act="close-layer">OK</button></div></div>`, { cls: 'narrow' });
    return;
  }
  const p = manifestOf(f).filter(x => x.key === f.scanFlag.key)[0], rec = paxStore()[f.scanFlag.key];
  const line = `${f.callsign}, the gate here. The scan flagged ${f.scanFlag.name}, seat ${f.scanFlag.seat}. Passport and boarding pass match a passenger banned by ${rec ? rec.bannedBy || 'an airline' : 'an airline'}. Do you want them denied?`;
  openLayer('modal', `<div class="modal-head"><div><h2>Boarding scan</h2><small>${esc(f.callsign)} · ${esc(f.from)} → ${esc(f.to)}</small></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
    <div class="modal-body"><div class="scan-card"><span class="pax-face big">${p ? avatarSvg2d(p.look, 'fa', { view: 'bust', still: true }) : ''}</span>
      <span><b>${esc(f.scanFlag.name)}</b><small>${p ? natLabel(p.nat) + ' · ' + p.age : ''} · seat ${esc(f.scanFlag.seat)}</small><span class="scan-hit">${icon('alert')}No-fly list match</span></span></div>
      ${rec ? rec.notes.map(n => `<p class="lede">${esc(n.title)} (${esc(n.date)}): ${esc(n.text)}</p>`).join('') : ''}
      <div class="say-row">${voiceButton(line, 'gate', 'Play the gate agent')}${voiceNoteEl()}</div>
      <div class="modal-actions"><button class="btn ghost" data-act="scan-let" data-id="${esc(id)}">Let them on</button><button class="btn danger" data-act="scan-deny" data-id="${esc(id)}">${icon('shield')}Deny boarding</button></div></div>`, { cls: 'narrow', onClose: () => Voice.stop() });
}
ACTIONS['scan-deny'] = el => scanDecide(el.getAttribute('data-id'), true);
ACTIONS['scan-let'] = el => scanDecide(el.getAttribute('data-id'), false);
function scanDecide(id: string, deny: boolean, auto?: boolean) {
  const f: any = State.live.filter(x => x.id === id)[0]; if (!f || !f.scanFlag || f.scanFlag.done) return;
  f.scanFlag.done = true; f.scanFlag.denied = deny;
  State.notices = State.notices.filter(n => n.ref !== 'scan-' + id);
  if (deny) { f.pax = Math.max(0, (f.pax || 1) - 1); _manifests.forEach((v, k) => { if (k.indexOf(id + '|') === 0) _manifests.delete(k); }); }
  else { try { Progress.popularity(-1, 'A banned passenger was let on board'); } catch (e) { /* ignore */ } }
  closeAll(); Store.save(); try { refresh(); } catch (e) { /* not ready */ }
  toast(deny ? `${f.scanFlag.name} was denied boarding${auto ? ' (the gate decided)' : ''}` : `${f.scanFlag.name} boarded ${f.callsign}`, deny ? 'ok' : 'warn');
}

/* ---------- the loadsheet ---------- */
/** What a flight weighs: passengers at 84 kg and 13 kg of bags each (standard weights), cargo, catering and
 *  fuel, against the aircraft's limits and the runways' limit. */
function loadsheetOf(f: LiveFlight): { rows: [string, number][]; zfw: number; tow: number; lw: number; mtow: number; mlw: number; rwyMax: number; ok: boolean; note: string; now: number; nowPh: string; burnt: number } {
  const F: any = f, t = acType(flightTypeId(f)) || AIRCRAFT[0], S = speedSpec(t.id);
  const A = apt(f.from), B = apt(f.noDest ? f.from : f.to), dist = A && B ? gcDistanceNm(A.pos, B.pos) : 300;
  const crewN = t.seats > 100 ? 2 + Math.ceil(t.seats / 50) : t.seats > 20 ? 3 : 1;
  const catering = Math.round(t.seats >= 20 ? t.seats * (dist > 1500 ? 9 : 4) : 0);
  const MT = S.mtow * 1000, ML = S.mlw * 1000;
  const sum = (pax: number, cargo: number) => {
    const W = flightWeights(t.id, pax, dist, cargo / 1000);
    const fuelTo = Math.max(0, Math.round((W.tow - W.zfw) * 1000)), burn = clamp(Math.round((W.tow - W.lw) * 1000), 0, Math.max(0, Math.round((W.tow - W.zfw) * 1000)));
    const zfw = Math.round(S.oew * 1000) + crewN * 85 + pax * 97 + cargo + catering;
    return { fuelTo, burn, zfw, tow: zfw + fuelTo, lw: zfw + fuelTo - burn };
  };
  // the loaders keep the aircraft within its limits: cargo off first, then passengers with their bags,
  // until the take-off and landing weights are just under the maximum (decided once for the flight)
  if (!F.lsTrimmed && !f.you && !f.real) {
    F.lsTrimmed = true;
    let pax = f.pax || 0, cargo = F.cargoKg || 0, x = sum(pax, cargo), offK = 0, offP = 0;
    const over = () => Math.max(x.tow - (MT - 60), x.lw - (ML - 60));
    if (over() > 0) {
      // all the cargo can go before any passenger is left behind
      while (over() > 0 && cargo > 0) { const cut = Math.min(cargo, Math.max(50, Math.ceil(over() / 50) * 50)); cargo -= cut; offK += cut; x = sum(pax, cargo); }
      while (over() > 0 && pax > 0) { pax--; offP++; x = sum(pax, cargo); }
      F.cargoKg = cargo; f.pax = pax;
      F.offloadKg = (F.offloadKg || 0) + offK; F.offloadPax = (F.offloadPax || 0) + offP; F.lsWeight = true;
    }
  }
  const pax = f.pax || 0, cargo = F.cargoKg || 0, x = sum(pax, cargo);
  const rows: [string, number][] = [['Empty aircraft', Math.round(S.oew * 1000)], [`Crew (${crewN})`, crewN * 85], [`Passengers (${pax} × 84 kg)`, pax * 84], [`Bags (${pax} × 13 kg)`, pax * 13], ['Cargo', cargo], ['Catering', catering], ['Take-off fuel', x.fuelTo]];
  const rc = f.noDest ? null : legRunwayCheck(t.id, f.from, f.to, pax, cargo);
  const ok = x.tow <= MT + 1 && x.lw <= ML + 1 && (!rc || rc.maxPax >= pax);
  const note = (F.offloadPax ? `${F.offloadPax} passengers offloaded to keep within the limits. ` : '') + (F.offloadKg ? `${num(F.offloadKg)} kg of cargo offloaded to keep within the limits. ` : '') + (rc && !rc.full ? rc.why : '');
  // the weight right now: full at the gate, a little less after taxiing, then falling with the fuel burnt until landing
  let burnt = 0, nowPh = String(f.phase || 'At the gate');
  try {
    if (F.depAt) {
      const prof = aiProfile(F), el = flightEl(F, Date.now()).el;
      const tk = prof.pts.filter((p: any) => p.ph === 'Takeoff')[0], td = prof.pts.filter((p: any) => p.ph === 'Landing')[0];
      const taxi = Math.round(x.fuelTo * 0.012);
      if (tk && td) {
        if (el <= tk.s) burnt = Math.round(taxi * clamp(el / Math.max(1, tk.s), 0, 1));
        else if (el < td.s) { const k = clamp((el - tk.s) / (td.s - tk.s), 0, 1); burnt = taxi + Math.round((x.burn - taxi) * Math.pow(k, 0.92)); }   // a little faster in the climb
        else burnt = x.burn;
      }
    }
  } catch (e) { /* not started */ }
  burnt = clamp(burnt, 0, Math.max(0, x.tow - x.lw));
  return { rows, zfw: x.zfw, tow: x.tow, lw: x.lw, mtow: MT, mlw: ML, rwyMax: rc ? rc.maxPax : pax, ok, note, now: x.tow - burnt, nowPh, burnt };
}
ACTIONS['loadsheet'] = el => {
  const f = State.live.filter(x => x.id === el.getAttribute('data-id'))[0]; if (!f) return;
  Sound.tick();
  const L = loadsheetOf(f), kg = (x: number) => num(Math.round(x)) + ' kg';
  openLayer('modal', `<div class="modal-head"><div><h2>Loadsheet: ${esc(f.callsign)}</h2><small>${esc(f.from)} → ${esc(f.noDest ? '…' : f.to)} · loaded by the ground staff within the limits</small></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
    <div class="modal-body loadsheet"><table>${L.rows.map(r => `<tr><td>${esc(r[0])}</td><td>${kg(r[1])}</td></tr>`).join('')}
      <tr class="tot"><td>Zero-fuel weight</td><td>${kg(L.zfw)}</td></tr>
      <tr class="tot ${L.tow > L.mtow ? 'bad' : 'good'}"><td>Take-off weight <small>max ${kg(L.mtow)}</small></td><td>${kg(L.tow)}</td></tr>
      <tr class="tot ${L.lw > L.mlw ? 'bad' : 'good'}"><td>Landing weight <small>max ${kg(L.mlw)}</small></td><td>${kg(L.lw)}</td></tr>
      <tr class="now"><td>Weight now <small class="ls-ph">${esc(L.nowPh)} · ${kg(L.burnt)} of fuel burnt</small></td><td class="ls-now">${kg(L.now)}</td></tr></table>
      <p class="ls-check ${L.ok ? 'ok' : 'bad'}">${icon(L.ok ? 'check' : 'alert')}${L.ok ? 'Within the aircraft\'s limits and the runways\' limit.' : 'Over a limit.'}</p>
      ${L.note ? `<p class="fine-print">${icon('info')}${esc(L.note)}</p>` : ''}</div>`, { cls: 'narrow ls-pop' });
  // the weight now keeps up while the sheet is open
  const iv = setInterval(() => {
    const box = document.querySelector('.ls-pop'); if (!box || !document.body.contains(box)) { clearInterval(iv); return; }
    const g = State.live.filter(x => x.id === f.id)[0]; if (!g) return;
    const M2 = loadsheetOf(g), n = box.querySelector('.ls-now'), ph = box.querySelector('.ls-ph');
    if (n) n.textContent = kg(M2.now); if (ph) ph.textContent = `${M2.nowPh} · ${kg(M2.burnt)} of fuel burnt`;
  }, 1000);
};
