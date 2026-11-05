// How your AI staff feel about working for you, a little like the Sims: everyone has a mood made of
// how satisfied they are in a few areas (pay, hours and rest, their base and roster, the aircraft and
// equipment, training and promotion, working conditions, and being appreciated), plus the things you do
// for them or to them lately. Now and then someone tells you what bothers them most. You choose to
// improve it (at a cost) or not. A happy person works well; an unhappy one lands worse, gets into
// trouble more often, is slower on the turnaround, and in the end may quit. AI staff only; real co-op
// pilots aren't affected, and in co-op the same AI people and moods are shared.

type MoodArea = 'pay' | 'hours' | 'roster' | 'aircraft' | 'training' | 'conditions' | 'recognition';
const MOOD_AREAS: [MoodArea, string][] = [['pay', 'Pay'], ['hours', 'Hours and rest'], ['roster', 'Base and roster'], ['aircraft', 'Aircraft and equipment'], ['training', 'Training and promotion'], ['conditions', 'Working conditions'], ['recognition', 'Being appreciated']];

// what they say when an area bothers them, and what you can do about it: [label, cost (weeks of their pay, or a fixed sum), boost]
const MOOD_ASK: { [a in MoodArea]: { say: (p: any) => string; fix: string; cost: (p: any) => number; boost: number; tradeoff?: string } } = {
  pay: { say: p => `I've been here a while now and my pay hasn't moved. Others in my job earn more elsewhere. Could we talk about a raise?`, fix: 'Give a 10% raise', cost: p => 0, boost: 35, tradeoff: 'Their weekly pay goes up by 10%.' },
  hours: { say: p => `The rosters have been brutal lately. Early starts after late finishes, and hardly any rest between. I'm worn out.`, fix: 'Ease their roster for a month', cost: p => Math.round((p.salary || 1000) * 0.5), boost: 30, tradeoff: 'Fewer duties for a month (cover costs half a week of pay).' },
  roster: { say: p => `I'd really like to be based closer to home. My family barely sees me with the commute to ${p.base}.`, fix: 'Offer a base swap or a fixed roster', cost: p => 1200, boost: 28, tradeoff: 'Relocation help and a fixed roster.' },
  aircraft: { say: p => p.role === 'mech' || p.role === 'ground' ? `Our tools and vehicles are getting old. Half the time something's broken and we're working around it.` : `Some of the cabins are tired: broken seats, galley equipment that doesn't work. It's hard to do a good job like that.`, fix: 'Buy new equipment', cost: p => p.role === 'ground' ? 9000 : 6000, boost: 25, tradeoff: 'New equipment at their base (everyone there feels it a little).' },
  training: { say: p => `I want to grow here. Is there any chance of a course, or a path to the next step up?`, fix: 'Pay for a training course', cost: p => p.role === 'fa' || p.role === 'ground' ? 1800 : 4500, boost: 32, tradeoff: 'A course: a few days away, and they gain experience.' },
  conditions: { say: p => `The crew room at ${p.base} is a disgrace, and we never get a proper break or a hot meal on long days.`, fix: 'Improve the crew room and meals', cost: p => 3500, boost: 26, tradeoff: 'Better crew room and meals at their base.' },
  recognition: { say: p => `I work hard and nobody ever says a word. It would be nice to hear that it's noticed.`, fix: 'Thank them in person', cost: p => 0, boost: 30, tradeoff: 'Free, and it means a lot.' },
};

function moodState(p: any): { [a: string]: number } {
  if (!p.sat) {
    // a starting point from who they are: most are fairly content, some less so
    const r = seeded((p.id || p.name) + '|mood');
    p.sat = {}; for (const [a] of MOOD_AREAS) p.sat[a] = Math.round(48 + r() * 40);
  }
  return p.sat;
}
/** Fair pay for their job and level, to compare their salary with. */
function marketPay(p: any): number {
  return goingRate(p);
}
/** Overall mood 0-100: the areas (pay counts double), plus recent things you did, fading over a few weeks. */
function staffMood(p: any): number {
  const s = moodState(p);
  // pay follows the salary against fair pay for their job and level
  s.pay = clamp(Math.round(55 + ((p.salary || 1) / marketPay(p) - 1) * 160 + (s.payExtra || 0)), 0, 100);
  let sum = 0, w = 0; for (const [a] of MOOD_AREAS) { const k = a === 'pay' ? 2 : 1; sum += (s[a] || 50) * k; w += k; }
  const days = (Date.now() - (p.moodAt || Date.now())) / 864e5, adj = (p.moodAdj || 0) * Math.exp(-days / 21);
  return clamp(Math.round(sum / w + adj), 0, 100);
}
function staffMoodAdd(p: any, delta: number, why?: string) {
  const days = (Date.now() - (p.moodAt || Date.now())) / 864e5;
  p.moodAdj = (p.moodAdj || 0) * Math.exp(-days / 21) + delta; p.moodAt = Date.now();
  if (why) p.moodLog = (p.moodLog || []).concat([{ date: dateStr(new Date()).slice(0, 10), why, d: Math.round(delta) }]).slice(-12);
}
function moodWord(m: number): string { return m >= 80 ? 'Very happy' : m >= 62 ? 'Happy' : m >= 45 ? 'Content' : m >= 30 ? 'Unhappy' : 'Very unhappy'; }
/** How well they work: their rating, less when unhappy (down to a star and a half). */
function workRating(p: any): number {
  const m = staffMood(p);
  const pr = (p.salary || 1) / Math.max(1, goingRate(p));
  const pay = pr < 0.95 ? -(0.95 - pr) * 2.5 : pr > 1.05 ? Math.min(0.3, (pr - 1.05) * 1.5) : 0;
  return clamp((p.rating || 4) - (m < 45 ? (45 - m) / 45 * 1.5 : 0) + (m > 80 ? 0.15 : 0) + pay, 1, 5);
}

/** Once a day or so: areas drift, the most unhappy speak up, and the very unhappy may quit. */
function moraleAdvance() {
  const S: any = State, now = Date.now();
  if (!S.moraleNext) S.moraleNext = now + 6 * 3600e3;
  let rounds = 0;
  while (S.moraleNext <= now && rounds < 14) {
    rounds++; S.moraleNext += 24 * 3600e3;
    try { unionAdvance(); } catch (e) { /* ignore */ }
    const people = ((S.staff || []) as any[]).concat((State.pilots as any[]).filter(x => x.id !== 'you' && !x.you)).filter(x => x.companyId || (typeof pilotCompany === 'function' && pilotCompany(x)));
    for (const p of people) {
      try { sicknessDaily(p); } catch (e) { /* ignore */ }
      if (p.onStrike) continue;
      const s = moodState(p);
      // small drifts: rosters, weather, life
      for (const [a] of MOOD_AREAS) if (a !== 'pay') s[a] = clamp(Math.round((s[a] || 50) + (Math.random() - 0.52) * 3), 5, 98);
      // long duty days wear pilots down
      if ((p.dutyMin || 0) > 9 * 60) s.hours = clamp((s.hours || 50) - 2, 5, 98);
      const m = staffMood(p);
      // speaking up: the lowest area, when it's low, about once in two to three weeks for each unhappy person
      const low = MOOD_AREAS.map(x => x[0]).sort((a, b) => (s[a] || 50) - (s[b] || 50))[0];
      if ((s[low] || 50) < 45 && !p.askOpen && Math.random() < 0.05) moraleAsk(p, low);
      // quitting: very unhappy for a while
      if (m < 20 && !p.quitting && Math.random() < 0.04) {
        p.quitting = now + 14 * 864e5;
        State.notices.unshift({ id: uid(), kind: 'staff' as any, title: `${p.name} handed in their notice`, body: `${p.name} is very unhappy (${moodWord(m).toLowerCase()}) and will leave in two weeks unless things get better. Their wish: ${MOOD_AREAS.filter(x => x[0] === low)[0][1].toLowerCase()}.`, time: 'Now', read: false, ref: 'fb-' + p.id } as any);
        p.askOpen = low;
      }
      if (p.quitting && now > p.quitting) {
        if (staffMood(p) >= 30) { p.quitting = 0; }
        else { p.status = 'off'; p.left = true; S.staff = (S.staff || []).filter((x: any) => x !== p); State.pilots = State.pilots.filter((x: any) => x !== p);
          State.notices.unshift({ id: uid(), kind: 'staff' as any, title: `${p.name} has left the company`, body: `Unhappy for too long. Hire someone new under Crew.`, time: 'Now', read: false } as any); }
      }
    }
  }
}

function moraleAsk(p: any, area: MoodArea) {
  p.askOpen = area;
  const line = MOOD_ASK[area].say(p);
  try { Voice.prepare(line, personWho(personRole(p) === 'captain' || personRole(p) === 'fo' ? 'pilot' : 'ops', p)); } catch (e) { /* not ready */ }
  State.notices.unshift({ id: uid(), kind: 'staff' as any, title: `${p.name} would like a word`, body: `${MOOD_AREAS.filter(x => x[0] === area)[0][1]}: ${line}`, time: 'Now', read: false, ref: 'fb-' + p.id } as any);
  try { renderTopbar(); } catch (e) { /* not ready */ }
}

/** The conversation: what bothers them, and your answer. */
function moralePopup(id: string) {
  const p: any = staffById(id); if (!p) return;
  const area: MoodArea = p.askOpen || MOOD_AREAS.map(x => x[0]).sort((a, b) => (moodState(p)[a] || 50) - (moodState(p)[b] || 50))[0];
  const A = MOOD_ASK[area], cost = area === 'pay' ? Math.round((p.salary || 1000) * 0.1) : A.cost(p), m = staffMood(p);
  const who = personWho(personRole(p) === 'captain' || personRole(p) === 'fo' ? 'pilot' : personRole(p) === 'fa' ? 'gate' : 'mechanic', p);
  const wrap = openLayer('modal', `<div class="modal-head"><div><h2>${esc(p.name)}</h2><small>${esc(MOOD_AREAS.filter(x => x[0] === area)[0][1])} · ${esc(moodWord(m))} (${m}%)${p.quitting ? ' · has handed in their notice' : ''}</small></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
    <div class="modal-body">
      <div class="mood-face">${avatarSvg(p.look, personRole(p), { view: 'bust', accent: company().color })}<p class="speech">${esc(A.say(p))}</p></div>
      <div class="say-row">${voiceButton(A.say(p), who, 'Play')}${voiceNoteEl()}</div>
      ${moodBarsHtml(p)}
      <div class="modal-actions">
        <button class="btn ghost" data-act="mood-no" data-id="${esc(p.id)}">Not now</button>
        <button class="btn primary" data-act="mood-yes" data-id="${esc(p.id)}" data-a="${area}">${esc(A.fix)}${area === 'pay' ? ` (+${money(cost)}/wk)` : cost ? ` (${money(cost)})` : ''}</button>
      </div>
      <p class="fine-print">${icon('info')}${esc(A.tradeoff || '')}</p>
    </div>`, { cls: 'narrow', onClose: () => Voice.stop() });
  autoSpeak(wrap);
}
function moodBarsHtml(p: any): string {
  const s = moodState(p); staffMood(p);
  return `<div class="mood-bars">${MOOD_AREAS.map(([a, l]) => `<div><small>${esc(l)}</small><span class="mb"><i style="width:${s[a] || 50}%" class="${(s[a] || 50) < 40 ? 'low' : (s[a] || 50) > 70 ? 'high' : ''}"></i></span></div>`).join('')}</div>`;
}
ACTIONS['mood-open'] = el => moralePopup(el.getAttribute('data-id'));
ACTIONS['mood-yes'] = el => {
  const p: any = staffById(el.getAttribute('data-id')), a = el.getAttribute('data-a') as MoodArea; if (!p || !MOOD_ASK[a]) return;
  const A = MOOD_ASK[a], s = moodState(p), cid = p.companyId || State.companyId;
  if (a === 'pay') { p.salary = Math.round(p.salary * 1.1 / 10) * 10; s.payExtra = (s.payExtra || 0) + 8; }
  else { const c = A.cost(p); if (c) payTxn(cid, `${A.fix}: ${p.name}`, -c, 'salary', [[A.fix, -c]]); s[a] = clamp((s[a] || 50) + A.boost, 0, 100); }
  if (a === 'training') gainXp(p, Math.max(800, xpForLevel(levelOf(p.xp).level + 3) - (p.xp || 0)), true);
  if (a === 'aircraft' || a === 'conditions') for (const q of ((State as any).staff || []).concat(State.pilots) as any[]) if (q !== p && q.base === p.base && q.companyId === cid) { const qs = moodState(q); qs[a] = clamp((qs[a] || 50) + A.boost / 3, 0, 100); }
  staffMoodAdd(p, 8, 'You listened');
  p.askOpen = ''; if (p.quitting && staffMood(p) >= 30) { p.quitting = 0; toast(`${p.name} is staying`, 'ok'); }
  State.notices = State.notices.filter(n => n.ref !== 'fb-' + p.id);
  closeAll(); Store.save(); refresh(); toast(`${p.name}: ${A.fix.toLowerCase()}. Mood up.`, 'ok');
};
ACTIONS['mood-no'] = el => {
  const p: any = staffById(el.getAttribute('data-id')); if (!p) return;
  staffMoodAdd(p, -10, 'You turned their wish down');
  p.askOpen = ''; State.notices = State.notices.filter(n => n.ref !== 'fb-' + p.id);
  closeAll(); Store.save(); refresh(); toast(`${p.name} is disappointed`, 'warn');
};
