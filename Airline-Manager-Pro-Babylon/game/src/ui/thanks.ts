// Thank-yous. A little while after you commend someone, they come back to you with their own thanks, in
// words and in their own voice, about what you gave them.

const THANKS: { [id: string]: ((p: any, x: any) => string)[] } = {
  thanks: [
    (p, x) => `I just heard your letter read out at the briefing. Honestly, I didn't expect that. Thank you, it means a lot to know it's noticed.`,
    (p, x) => `Thank you for the kind words this morning. The whole crew room heard it, and I had to hide a smile. I won't forget it.`,
  ],
  award: [
    (p, x) => `Thank you for the award. It's going on the wall at home, right where everyone can see it. ${x.years} years, and this is the first time anyone said it out loud.`,
    (p, x) => `I'm still holding the pin. Thank you. ${x.years} years with this company, and today it felt like every one of them counted.`,
  ],
  medal: [
    (p, x) => `A medal! I don't know what to say. Thank you, truly. And the dinner for the crew room was the best night we've had in ages.`,
    (p, x) => `My family can't stop looking at it. Thank you for the medal, and for including the whole team. They deserve it as much as I do.`,
  ],
  bonus: [
    (p, x) => `I just saw the bonus. Thank you so much, it comes at exactly the right time for us. I'll keep giving you my very best.`,
    (p, x) => `Thank you for the bonus. That's going straight towards something we've been saving for. You've made our month.`,
  ],
  days: [
    (p, x) => `Thank you for the days off. I'm going to sleep in, see my family properly, and come back with a fresh head. That's a promise.`,
    (p, x) => `Three whole days. I can't remember the last time. Thank you, I really needed this.`,
  ],
  trip: [
    (p, x) => `We're back from ${x.where}, and I have to say a huge thank you from all ${x.family} of us. The kids still talk about the flight. It was the holiday of our lives.`,
    (p, x) => `Thank you for ${x.where}. My family will remember it forever, and the crew on board treated us like royalty. I'm so proud to work here.`,
  ],
};
function thanksRole(p: any): string { const r = personRole(p); return r === 'captain' || r === 'fo' ? 'pilot' : 'ops'; }
/** Queue a thank-you after a commendation: in 20 to 60 seconds, or on the trip's return. */
function thanksQueue(p: any, cid: string, title: string, where: string) {
  const S: any = State; S.thanksDue = S.thanksDue || [];
  try { newsKind(p, cid, ''); } catch (e) { /* ignore */ }
  const delay = cid === 'trip' ? 90e3 : (20 + Math.random() * 40) * 1000;
  S.thanksDue.push({ at: Date.now() + delay, staffId: p.id, c: cid, title, where });
  setTimeout(thanksAdvance, delay + 200);
}
function thanksAdvance() {
  const S: any = State; if (!S.thanksDue || !S.thanksDue.length) return;
  const now = Date.now(), due = S.thanksDue.filter((x: any) => x.at <= now); if (!due.length) return;
  S.thanksDue = S.thanksDue.filter((x: any) => x.at > now);
  for (const d of due) {
    const p: any = staffById(d.staffId); if (!p) continue;
    const list = THANKS[d.c] || THANKS.thanks, x = { years: Math.max(1, Math.floor(serviceYears(p))), where: d.where || 'the holiday', family: familySize(p) };
    const text = list[_hashStr(p.id + d.c + (p.commends || []).length) % list.length](p, x);
    const id = 'ty-' + uid(); S.thanks = S.thanks || {}; S.thanks[id] = { staffId: p.id, text, title: d.title, at: d.at };
    try { Voice.prepare(text, personWho(thanksRole(p), p, 'happy')); } catch (e) { /* ready when played */ }
    State.notices.unshift({ id: uid(), kind: 'staff' as any, title: `${p.name} says thank you`, body: text, time: 'Now', at: d.at, read: false, ref: id } as any);
    try { toast(`${p.name} says thank you`, 'ok', { label: 'Open', act: 'thanks-open', data: id }); } catch (e) { /* not ready */ }
  }
  Store.save(); try { renderTopbar(); } catch (e) { /* not ready */ }
}
function thanksPopup(id: string) {
  const t = ((State as any).thanks || {})[id]; if (!t) return;
  const p: any = staffById(t.staffId);
  closeAll();
  openLayer('modal', `<div class="modal-head"><div><h2>${esc(p ? p.name : 'Thank you')}</h2><small>${p ? ROLE_NAMES[personRole(p)] + ', ' + esc(p.base) : ''} · after: ${esc(t.title.toLowerCase())}</small></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
    <div class="modal-body"><div class="mood-face">${p && p.look ? avatarSvg(p.look, personRole(p), { view: 'bust', accent: company(p.companyId || State.companyId).color, still: true }) : ''}
      <div><p class="lede">“${esc(t.text)}”</p><div class="say-row">${voiceButton(t.text, personWho(p ? thanksRole(p) : 'ops', p, 'happy'), 'Play their thank-you')}${voiceNoteEl(p ? p.name : '')}</div></div></div></div>`, { cls: 'narrow', onClose: () => Voice.stop() });
}
ACTIONS['thanks-open'] = el => { const t = el.closest('.toast'); if (t) t.remove(); thanksPopup(el.getAttribute('data-id') || el.getAttribute('data-data') || ''); };
function startThanks() { thanksAdvance(); setInterval(thanksAdvance, 15000); }
