// How each passenger feels during the flight. Everyone starts with a mood of their own; then the flight
// happens to them: a late departure, turbulence, the meal service (good or slow), a smooth or firm landing,
// a pet visit. Very rarely a flight attendant shouts at a passenger for no reason: that passenger is upset,
// the people sitting around them notice, and the rest of the cabin a little. Worked out from the flight
// itself (the same every time you look), shown in the passenger list and on each passenger's card.

interface MoodEv { t: number; text: string; d: number; who?: string; near?: string[] }
const _moodEvs = new Map<string, MoodEv[]>();
function moodEvents(f: any, list: PaxSeat[]): MoodEv[] {
  const key = f.id + '|' + list.length; const hit = _moodEvs.get(key); if (hit) return hit;
  const r = seeded('mood:' + f.id), out: MoodEv[] = [];
  const late = f.sched && f.depAt ? Math.round((f.depAt - f.sched) / 60000) : 0;
  if (late > 20) out.push({ t: 0.02, text: `Left ${late} minutes late`, d: late > 60 ? -14 : -6 });
  if (r() < 0.35) { const sev = r() < 0.15; out.push({ t: 0.18 + r() * 0.5, text: sev ? 'Severe turbulence: drinks spilled, seat belts on' : 'Bumpy ride for a while', d: sev ? -16 : -5 }); }
  // the service: something ran out only when the loading really came up short (Catering and storage)
  const svc = r();
  if (f.catShort && typeof CAT_SHORT_TEXT !== 'undefined') out.push({ t: 0.32, text: CAT_SHORT_TEXT[f.catShort as CatItem], d: f.catShort === 'hot' ? -8 : -5 });
  else out.push({ t: 0.3, text: svc < 0.12 ? 'Slow meal service: some had to wait a long time' : 'Friendly service and a good meal', d: svc < 0.12 ? -9 : 5 });
  if (f.pax && list.some(p => p.pet && p.pet.where === 'cabin')) out.push({ t: 0.45, text: 'A pet on board cheered people up', d: 2 });
  // very rarely: a flight attendant shouts at a passenger for no reason
  if (r() < 0.012 && list.length > 4) {
    const v = list[Math.floor(r() * list.length)], row = parseInt(v.seat, 10);
    const near = list.filter(p => p !== v && Math.abs(parseInt(p.seat, 10) - row) <= 1).map(p => p.key);
    out.push({ t: 0.35 + r() * 0.4, text: 'A flight attendant shouted at a passenger for no reason', d: -3, who: v.key, near });
  }
  if (f.landFpm) out.push({ t: 0.97, text: f.landFpm < 150 ? 'A smooth landing: applause' : f.landFpm > 400 ? 'A hard landing' : 'A normal landing', d: f.landFpm < 150 ? 4 : f.landFpm > 400 ? -8 : 0 });
  out.sort((a, b) => a.t - b.t); _moodEvs.set(key, out); if (_moodEvs.size > 60) _moodEvs.delete(_moodEvs.keys().next().value);
  return out;
}
/** A passenger's mood (0 to 100) now, and what changed it. */
function paxMood(f: any, p: PaxSeat, list: PaxSeat[]): { mood: number; log: { t: number; text: string; d: number }[] } {
  const r = seeded('moodp:' + f.id + p.key), base = (p.cls === 'F' ? 78 : p.cls === 'J' ? 74 : 68) + Math.round((r() - 0.5) * 20), sens = 0.6 + r() * 0.9;
  const now = clamp(f.t || 0, 0, 1), log: { t: number; text: string; d: number }[] = [];
  let mood = base;
  for (const e of moodEvents(f, list)) {
    if (e.t > now) break;
    let d = e.d * sens;
    if (e.who) { if (e.who === p.key) { d = -40; log.push({ t: e.t, text: 'A flight attendant shouted at them for no reason', d }); mood += d; continue; } if ((e.near || []).indexOf(p.key) >= 0) { d = -15; log.push({ t: e.t, text: 'Saw a flight attendant shout at the passenger next to them', d }); mood += d; continue; } }
    if (Math.abs(d) >= 1) { log.push({ t: e.t, text: e.text, d: Math.round(d) }); mood += d; }
  }
  return { mood: Math.round(clamp(mood, 0, 100)), log };
}
function moodFace(m: number): string { return m >= 80 ? '😄' : m >= 65 ? '🙂' : m >= 45 ? '😐' : m >= 25 ? '🙁' : '😠'; }
function moodChip(f: any, p: PaxSeat, list: PaxSeat[]): string { if (!f) return ''; const m = paxMood(f, p, list).mood; return `<span class="pax-mood ${m >= 65 ? 'good' : m >= 45 ? 'ok' : 'bad'}" title="Mood ${m}/100">${moodFace(m)}<small>${m}</small></span>`; }
function moodCardHtml(f: any, p: PaxSeat): string {
  if (!f) return ''; const list = manifestOf(f), pm = paxMood(f, p, list), dur = f.durMs ? f.durMs / (f.spd || 1) : 0;
  const when = (t: number) => f.depAt && dur ? new Date(f.depAt + t * dur).toTimeString().slice(0, 5) : Math.round(t * 100) + '%';
  return `<div class="mood-box"><div class="mood-h"><span class="mood-face">${moodFace(pm.mood)}</span><span><b>Mood on this flight: ${pm.mood}/100</b><small>Changes with what happens on board</small></span><span class="mkt-bar"><i style="width:${pm.mood}%"></i></span></div>
    ${pm.log.length ? pm.log.map(l => `<div class="fs-pen"><span>${esc(when(l.t))} · ${esc(l.text)}</span><em class="${l.d > 0 ? 'green' : ''}">${l.d > 0 ? '+' : ''}${l.d}</em></div>`).join('') : '<small class="muted">Nothing has happened yet on this flight.</small>'}</div>`;
}
/** Once on each flight: the crew misconduct goes to you as a complaint. */
const _moodTold: { [id: string]: 1 } = {};
function moodWatch() {
  for (const f of State.live as any[]) {
    if (f.you || f.tfc || _moodTold[f.id] || !f.pax) continue;
    const list = manifestOf(f), e = moodEvents(f, list).filter(x => x.who)[0]; if (!e || (f.t || 0) < e.t) continue;
    _moodTold[f.id] = 1; const v = list.filter(p => p.key === e.who)[0];
    State.notices.unshift({ id: uid(), kind: 'staff', title: `Complaint on ${f.callsign}`, body: `A flight attendant shouted at ${v ? v.name : 'a passenger'} (seat ${v ? v.seat : '?'}) for no reason. Passengers around them were upset too.`, time: 'Now', at: Date.now(), read: false } as any);
    try { Progress.popularity(-0.4, 'Crew shouted at a passenger'); } catch (er) { /* ignore */ }
  }
}
setInterval(() => { try { if (!document.hidden) moodWatch(); } catch (e) { /* ignore */ } }, 30000);
