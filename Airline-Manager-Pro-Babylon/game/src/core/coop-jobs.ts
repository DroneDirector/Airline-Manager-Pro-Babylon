// Jobs in co-op: "Give to a pilot" offers the leg to a real player of your co-op instead of an AI pilot.
// They get a request on their side and accept or decline it; a decline comes back to you with their
// reason. Out of co-op, jobs go to your hired AI pilots as before. With the demo co-op (until the online
// service is set up), the sample pilots answer like real players would, and now and then offer you a leg.

interface CoopOffer { id: string; jobId: string; from: string; to: string; reg: string; at: number; status: 'pending' | 'accepted' | 'declined'; why?: string }
function coopOffers(): CoopOffer[] { const c: any = coopState(); if (!c) return []; return c.offers || (c.offers = []); }
const COOP_DECLINE = ['I\'m not rated on that type yet', 'I\'m about to log off for tonight', 'I\'m in the middle of another flight', 'That\'s too long a flight for me today', 'My sim is updating right now', 'I\'d rather fly from my own base'];

/** The co-op pilots to choose from in the job dialog (not you). */
function coopJobPilotsHtml(j: any, reg: string): string {
  const c = coopState(); if (!c) return '';
  const now = Date.now(), others = c.members.filter(m => !m.you);
  const pending = (mid: string) => coopOffers().some(o => o.to === mid && o.jobId === j.id && o.status === 'pending');
  return `<h3>Co-op pilot</h3><p class="fine-print">${icon('info')}In co-op the leg goes to a real player. They get a request and can accept or decline it.</p>
    <div class="route-pick">${others.map(m => {
      const online = now - (m.lastSeen || 0) < 30 * 60e3, flying = State.live.some((f: any) => f.coop && f.pilotId === m.id);
      return `<button class="rp ${pending(m.id) ? 'off' : ''}" data-act="cj-offer" data-m="${esc(m.id)}" data-j="${esc(j.id)}" data-reg="${esc(reg)}" ${pending(m.id) ? 'disabled' : ''}>
        <span class="chain"><b>${esc(m.name)}</b><em class="${online ? 'green' : ''}">${pending(m.id) ? 'Request sent' : flying ? 'Flying now' : online ? 'Online' : 'Offline'}</em></span>
        <small>${m.role === 'owner' ? 'Owner' : 'Pilot'} · based at ${esc(m.base || '—')} · ${m.flights} flights</small></button>`;
    }).join('') || `<p class="fine-print">${icon('info')}Nobody else has joined your co-op yet.</p>`}</div>`;
}
ACTIONS['cj-offer'] = el => {
  const c = coopState(), me = coopMe(), j = jobById(el.getAttribute('data-j')), m = coopMember(el.getAttribute('data-m')), reg = el.getAttribute('data-reg');
  if (!c || !me || !j || !m) return;
  if (j.status !== 'open') { toast('The job is no longer open', 'warn'); return; }
  const o: CoopOffer = { id: 'cjo-' + uid(), jobId: j.id, from: me.id, to: m.id, reg, at: Date.now(), status: 'pending' };
  coopOffers().push(o); (j as any).offeredTo = m.id;
  const ev: any = { id: o.id, at: o.at, by: me.id, type: 'offer', text: `${me.name} asked ${m.name} to fly ${j.from} to ${j.to} (${j.title})`, offer: o };
  coopRecord(ev); try { coopBackend().publish(ev); } catch (e) { /* the demo has nothing to send */ }
  Store.save(); closeAll(); Sound.tick(); refresh();
  toast(`Request sent to ${m.name}: ${j.from} to ${j.to}`, 'ok');
};

/** A reply to one of your requests: accepted (they fly it) or declined (you are told why). */
function coopOfferReply(o: CoopOffer, accept: boolean, why?: string) {
  const j = jobById(o.jobId), m = coopMember(o.to); if (!j) return;
  o.status = accept ? 'accepted' : 'declined'; o.why = why; delete (j as any).offeredTo;
  if (accept && j.status === 'open') {
    j.status = 'accepted'; j.by = o.to; j.reg = o.reg;
    const inAir = State.live.some((f: any) => f.coop && f.pilotId === o.to);
    State.notices.unshift({ id: uid(), kind: 'pilot', title: `${m ? m.name : 'A co-op pilot'} accepted your leg`, body: `${m ? m.name : 'They'} will fly ${j.title}: ${j.from} to ${j.to}${o.reg ? ' in ' + o.reg : ''}${inAir ? ', once they have landed from their current flight' : ''}.`, time: 'Now', at: Date.now(), read: false } as any);
    if (coopState().backend === 'demo' && m) coopFlyJob(m, j, o.reg);
  } else if (!accept) {
    State.notices.unshift({ id: uid(), kind: 'pilot', title: `${m ? m.name : 'A co-op pilot'} declined your leg`, body: `${j.title}: ${j.from} to ${j.to}. “${why || 'Not this time'}.” The job is back on the board; give it to someone else or fly it yourself.`, time: 'Now', at: Date.now(), read: false } as any);
  }
  coopRecord({ id: o.id + '-r', at: Date.now(), by: o.to, type: 'offer-reply' as any, text: `${m ? m.name : 'A pilot'} ${accept ? 'accepted' : 'declined'} ${j.from} to ${j.to}` });
  try { renderTopbar(); Sound.chime(); } catch (e) { /* not ready */ }
  Store.save();
}
/** A demo co-op pilot flies the job leg (from the job's airport, in the aircraft you chose). */
function coopFlyJob(m: CoopMember, j: any, reg: string) {
  const cur: any = State.live.filter((f: any) => f.coop && f.pilotId === m.id)[0], afterCur = cur ? cur.depAt + cur.durMs + 60 * 60e3 : 0;
  const co = company(), a = plane(reg), typeId = a ? a.typeId : 'a320-fenix', at = Math.max(Date.now() + 20 * 60e3, afterCur), prof = flightProfile(typeId, j.from, j.to, at);
  const f: any = { id: 'coop-' + uid(), reg: a ? reg : '', pilotId: m.id, from: j.from, to: j.to, t: 0, rate: 0, callsign: (co.icao || 'CO') + (8000 + (_hashStr(j.id) % 1000)),
    pax: j.pax || 0, cargoKg: j.kg || 0, paxMax: a ? cabinSeats(acType(typeId), a) : 180, alt: 0, phase: 'Taxi out', real: true, coop: true, typeId, depAt: at, durMs: prof.totalS * 1000, job: j.id };
  if (a) a.status = 'flying'; State.live.push(f); j.status = 'flying';
}
/** Someone in your co-op asks you to fly a leg. */
function coopOfferToMe(o: CoopOffer) {
  const j = jobById(o.jobId), from = coopMember(o.from); if (!j) return;
  coopOffers().push(o);
  State.notices.unshift({ id: uid(), kind: 'pilot', title: `${from ? from.name : 'Your co-op'} wants you to fly a leg`, body: `${j.title}: ${j.from} to ${j.to}, ${j.kind === 'cargo' ? num(j.kg) + ' kg' : j.pax + ' passengers'}${o.reg ? ', in ' + o.reg : ''}. Deliver by ${dateStr(new Date(j.due)).slice(5, 16)}. Tap to accept or decline.`, time: 'Now', at: Date.now(), read: false, ref: o.id } as any);
  try { renderTopbar(); Sound.chime(); toast(`${from ? from.name : 'Your co-op'} wants you to fly ${j.from} to ${j.to}`, 'info', { label: 'Answer', act: 'cj-open', data: o.id }); } catch (e) { /* not ready */ }
}
function coopOfferPopup(id: string) {
  const o = coopOffers().filter(x => x.id === id)[0]; if (!o) return;
  const j = jobById(o.jobId), from = coopMember(o.from); if (!j) return;
  closeAll();
  openLayer('modal', `<div class="modal-head"><div><h2>${esc(from ? from.name : 'Your co-op')} asks you to fly this leg</h2><small>${esc(j.title)} · ${esc(j.client || '')}</small></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
    <div class="modal-body"><div class="kv-row"><div><small>Route</small><b>${esc(j.from)} → ${esc(j.to)}</b></div><div><small>Load</small><b>${j.kind === 'cargo' ? num(j.kg) + ' kg' : j.pax + ' passengers'}</b></div><div><small>Aircraft</small><b>${esc(o.reg || 'Your choice')}</b></div><div><small>Deliver by</small><b>${esc(dateStr(new Date(j.due)).slice(5, 16))}</b></div><div><small>Pays</small><b>${money(j.pay)}</b></div></div>
    ${o.status !== 'pending' ? `<p class="fine-print">${icon('info')}You ${o.status} this leg.</p>` : `<label class="field"><span>If you decline, tell them why</span><select class="le-in cj-why">${COOP_DECLINE.map(w => `<option>${esc(w)}</option>`).join('')}</select></label>
    <div class="modal-actions"><button class="btn ghost" data-act="cj-answer" data-id="${esc(o.id)}" data-v="0">Decline</button><button class="btn primary" data-act="cj-answer" data-id="${esc(o.id)}" data-v="1">${icon('check')}Accept and fly it</button></div>`}</div>`, { cls: 'narrow' });
}
ACTIONS['cj-open'] = el => { const t = el.closest('.toast'); if (t) t.remove(); coopOfferPopup(el.getAttribute('data-id')); };
ACTIONS['cj-answer'] = el => {
  const o = coopOffers().filter(x => x.id === el.getAttribute('data-id'))[0]; if (!o || o.status !== 'pending') return;
  const j = jobById(o.jobId), acc = el.getAttribute('data-v') === '1', why = ($('.cj-why') as HTMLSelectElement || { value: '' } as any).value;
  o.status = acc ? 'accepted' : 'declined'; o.why = why;
  if (acc && j && j.status === 'open') { j.status = 'accepted'; j.by = 'you'; j.reg = o.reg || (State as any).myReg[j.companyId]; toast(`Yours: fly ${j.from} to ${j.to}`, 'ok'); }
  else if (!acc) toast('Declined. They have been told why.', 'info');
  const ev: any = { id: o.id + '-r', at: Date.now(), by: (coopMe() || {} as any).id, type: 'offer-reply', text: `${(coopMe() || {} as any).name} ${acc ? 'accepted' : 'declined'} a leg`, offer: o };
  coopRecord(ev); try { coopBackend().publish(ev); } catch (e) { /* demo */ }
  Store.save(); closeAll(); refresh();
};

/** The demo co-op: its pilots answer your requests after a minute or two, and now and then ask you to fly a leg. */
function coopJobsTick(now: number) {
  const c = coopState(); if (!c || c.backend !== 'demo') return;
  for (const o of coopOffers()) {
    if (o.status !== 'pending' || o.to === (coopMe() || {} as any).id) continue;
    const wait = 40e3 + (_hashStr(o.id) % 80) * 1000; if (now - o.at < wait) continue;
    const yes = (_hashStr(o.id + 'y') % 100) < 72;
    coopOfferReply(o, yes, yes ? '' : COOP_DECLINE.filter(w => !/another flight/.test(w))[_hashStr(o.id + 'w') % (COOP_DECLINE.length - 1)]);
  }
  // now and then the owner or a pilot asks you to fly an open job
  const me = coopMe(); if (!me) return;
  const lastAsk = (c as any).lastAskMe || 0;
  if (now - lastAsk > 3 * 3600e3 && Math.random() < 0.004 && !coopOffers().some(o => o.to === me.id && o.status === 'pending')) {
    const j = jobsState().list.filter(x => x.status === 'open' && x.companyId === c.companyId)[0], asker = c.members.filter(m => !m.you)[0];
    if (j && asker) { (c as any).lastAskMe = now; coopOfferToMe({ id: 'cjo-' + uid(), jobId: j.id, from: asker.id, to: me.id, reg: (State as any).myReg[j.companyId] || '', at: now, status: 'pending' }); }
  }
}
