// Airline alliances: three groups of airlines (all made up) that you can join when your airline is big and liked
// enough. Members connect their passengers onto your flights at their hubs, their lounges count for your premium
// travellers, and your frequent flyers earn and spend with all of them. A yearly fee, paid monthly. Fall too far
// below the alliance's standard and you get a warning; stay there and you are asked to leave.

interface Alliance { id: string; name: string; color: string; rep: number; fleet: number; fee: number; members: [string, string][] }
const ALLIANCES: Alliance[] = [
  { id: 'aurora', name: 'Aurora Alliance', color: '#3FD0E8', rep: 55, fleet: 5, fee: 900000, members: [['Nordwind Air', 'ENGM'], ['Baltica', 'EFHK'], ['Celtic Blue', 'EIDW'], ['Maple Air', 'CYYZ']] },
  { id: 'meridian', name: 'Meridian Group', color: '#F2B544', rep: 65, fleet: 12, fee: 2400000, members: [['Iberia Sol', 'LEMD'], ['Alpine Air', 'LSZH'], ['Bosphorus Airways', 'LTFM'], ['Atlantic Crown', 'KBOS'], ['Danube Wings', 'LOWW']] },
  { id: 'polaris', name: 'Polaris', color: '#B48CFF', rep: 75, fleet: 25, fee: 5500000, members: [['Imperial Air', 'EGLL'], ['Rhein Airlines', 'EDDF'], ['Gulf Star', 'OMDB'], ['Liberty Air', 'KJFK'], ['Hollandia', 'EHAM'], ['Lumière', 'LFPG']] },
];
function allianceOf(cid: string): Alliance | null { const L = loyaltyOf(cid), a = L && (L as any).alliance; return a ? ALLIANCES.filter(x => x.id === a.id)[0] || null : null; }
/** The member hubs (with a lounge your travellers may use) of your alliance. */
function allianceHubs(cid: string): string[] { const A = allianceOf(cid); return A ? A.members.map(m => m[1]) : []; }
/** How much more your frequent flyers count inside an alliance (1 = alone). */
function allianceFf(cid: string): number { return allianceOf(cid) ? 1.25 : 1; }

function allianceDaily() {
  if (Store.nogame() || !soloMode()) return;
  const L: any = loyalty(), A = allianceOf(State.companyId); if (!A) return;
  const c = company(), cid = c.id, now = new Date(), day = now.toDateString(), month = now.toISOString().slice(0, 7), M = L.alliance;
  if (M.day !== day) {
    M.day = day;
    // the members' passengers connecting onto your flights at their hubs
    let pax = 0;
    for (const rt of State.routes.filter(x => x.companyId === cid && !x.test)) for (let i = 1; i < rt.legs.length; i++) {
      const a = rt.legs[i - 1], b = rt.legs[i]; if (A.members.some(m => m[1] === a || m[1] === b)) { try { pax += Math.round(marketPax(a, b) * 0.1); } catch (e) { /* none */ } }
    }
    if (pax) { const rev = pax * 82; payTxn(cid, `${A.name}: connecting passengers`, rev, 'revenue', [[`${pax} passengers from member airlines`, rev]]); }
  }
  if (M.month !== month) {
    M.month = month; const fee = Math.round(A.fee / 12);
    payTxn(cid, `${A.name}: membership`, -fee, 'fees', [['A twelfth of the yearly fee', -fee]]);
    // the standard: reputation and fleet
    const low = (c.reputation || 0) < A.rep - 8 || fleetOf(cid).length < Math.ceil(A.fleet * 0.7);
    if (low && M.warned) {
      L.alliance = null;
      State.notices.unshift({ id: uid(), kind: 'company', title: `${A.name} has asked you to leave`, body: `After a warning last month your airline is still below the alliance's standard (reputation ${A.rep} and ${A.fleet} aircraft). The connections and shared lounges end today.`, time: 'Now', at: Date.now(), read: false } as any);
      try { Progress.popularity(-1, `Left ${A.name}`); } catch (e) { /* none */ }
    } else if (low) {
      M.warned = Date.now();
      State.notices.unshift({ id: uid(), kind: 'company', title: `A warning from ${A.name}`, body: `Your airline is below the alliance's standard: reputation ${A.rep} (you: ${Math.round(c.reputation || 0)}) and ${A.fleet} aircraft (you: ${fleetOf(cid).length}). If it still is next month, you will be asked to leave.`, time: 'Now', at: Date.now(), read: false } as any);
    } else M.warned = 0;
  }
  Store.soon();
}
setInterval(() => { try { allianceDaily(); } catch (e) { /* next time */ } }, 60000);

function alliancesHtml(): string {
  const c = company(), mine = allianceOf(c.id), L: any = loyalty(), fl = fleetOf(c.id).length, rep = Math.round(c.reputation || 0);
  const card = (A: Alliance) => {
    const me = mine && mine.id === A.id, ok = rep >= A.rep && fl >= A.fleet;
    return `<div class="al-card ${me ? 'mine' : ''}" style="--al:${A.color}"><div class="al-h"><span class="al-logo">${esc(A.name[0])}</span><span><b>${esc(A.name)}</b><small>${A.members.length} airlines · ${money(A.fee)} a year</small></span>
      ${me ? `<button class="btn sm ghost" data-act="al-leave">Leave</button>` : mine ? '' : `<button class="btn sm ${ok ? 'primary' : 'ghost'}" data-act="al-join" data-id="${A.id}" ${ok ? '' : 'disabled'}>${ok ? 'Join' : 'Not yet'}</button>`}</div>
      <div class="al-m">${A.members.map(m => `<span>${esc(m[0])}<small>${esc(m[1])}</small></span>`).join('')}</div>
      <small class="al-req ${ok || me ? 'ok' : ''}">Needs a reputation of ${A.rep} (you: ${rep}) and ${A.fleet} aircraft (you: ${fl})${me && L.alliance.warned ? ' · <em>warned: below the standard</em>' : ''}</small></div>`;
  };
  return `<div class="card loy"><div class="card-h"><b>${icon('globe')}Alliances</b><small>Member airlines connect their passengers onto your flights at their hubs, their lounges count for your premium travellers, and your frequent flyers earn with all of them. One alliance at a time.</small></div>
    <div class="al-grid">${ALLIANCES.map(card).join('')}</div></div>`;
}
ACTIONS['al-join'] = el => {
  const A = ALLIANCES.filter(x => x.id === el.getAttribute('data-id'))[0], c = company(), L: any = loyalty(); if (!A || allianceOf(c.id)) return;
  if ((c.reputation || 0) < A.rep || fleetOf(c.id).length < A.fleet) { toast('Your airline doesn\'t meet the standard yet', 'warn'); return; }
  L.alliance = { id: A.id, since: Date.now(), month: '', day: '', warned: 0 };
  try { Progress.popularity(1, `Joined ${A.name}`); } catch (e) { /* none */ }
  try { newsPost(c, c.hub, { section: 'Business', headline: `${c.name} joins ${A.name}`, standfirst: `${c.name} is the newest member of ${A.name}, alongside ${A.members.slice(0, 3).map(m => m[0]).join(', ')} and others.`, body: [`Passengers can now connect between ${c.name} and the other members on one ticket, use their lounges and collect points with all of them.`] }); } catch (e) { /* no news */ }
  allianceDaily(); Store.soon(); Sound.tick(); toast(`Welcome to ${A.name}`, 'ok'); refresh();
};
ACTIONS['al-leave'] = () => { const L: any = loyalty(), A = allianceOf(State.companyId); if (!A) return; L.alliance = null; Store.soon(); Sound.tick(); toast(`You have left ${A.name}`, 'info'); refresh(); };
