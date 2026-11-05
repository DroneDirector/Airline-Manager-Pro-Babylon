// What passengers live through on a hired pilot's flight, and what they think of it afterwards.
//  - Pets: dogs and cats travel with their owners when your pet policy allows it (Settings → Passenger
//    services): small ones in the cabin under the seat in front, bigger ones in the heated hold where the
//    aircraft has one. The captain decides per flight: no pets in the hold when it is very hot or very cold
//    at the destination (the animal waits on the ground). Owners love flying with their pet beside them.
//  - Reviews: every passenger gives the flight 1 to 5 stars from what really happened: the landing, the
//    delay, the service and crew, turbulence and holding (some hate it, most don't care, a few love it),
//    their pet, a celebrity on board, a diversion.
//  - Medical emergencies: rarely, a passenger needs a doctor in flight. The crew divert to the nearest
//    suitable airport, the passenger is taken to hospital, and the flight carries on to where it was going.

interface PaxPet { kind: 'dog' | 'cat'; name: string; where: 'cabin' | 'hold'; left?: string; color: string }
const PET_NAMES = ['Bella', 'Max', 'Luna', 'Charlie', 'Milo', 'Daisy', 'Oscar', 'Molly', 'Simba', 'Rocky', 'Nala', 'Teddy', 'Loki', 'Coco', 'Felix', 'Rosie', 'Bamse', 'Kisa', 'Fía', 'Tóki'];
const PET_COLORS = ['#3A2A1E', '#8B5A2B', '#D9B98A', '#F2EEE6', '#6E6E6E', '#C27A3A', '#1E1E1E'];

/** A passenger's pet, if they bring one and your policy allows it (about one passenger in 300). */
function paxPet(key: string, f: LiveFlight): PaxPet {
  const pol = servicesOf((plane(f.reg) || {} as any).companyId || State.companyId).pets;
  if (pol === 'no') return null;
  const r = seeded(key + 'pet'); if (r() >= 1 / 300) return null;
  const t = acType(flightTypeId(f)), small = !t || t.cls === 'ga' || t.cls === 'bush';
  const kind: 'dog' | 'cat' = r() < 0.62 ? 'dog' : 'cat';
  const big = kind === 'dog' && r() < 0.45;
  if (big && (pol !== 'hold' || small)) return null;      // too big for the cabin, and no hold for pets
  const pet: PaxPet = { kind, name: PET_NAMES[Math.floor(r() * PET_NAMES.length)], where: big ? 'hold' : 'cabin', color: PET_COLORS[Math.floor(r() * PET_COLORS.length)] };
  // the captain's call: the hold is no place for an animal on a very hot or very cold day at the destination
  if (pet.where === 'hold') {
    try { const m: any = typeof LiveWx !== 'undefined' ? LiveWx.get(f.to) : null; if (m && (m.temp > 29 || m.temp < -15)) pet.left = `${m.temp > 29 ? 'Too hot' : 'Too cold'} at ${f.to} (${Math.round(m.temp)} °C) for the hold: the captain said no, and ${pet.name} flies another day`; } catch (e) { /* no weather */ }
  }
  return pet;
}
/** A small drawn dog or cat. */
function petSvg(p: PaxPet): string {
  const c = p.color, d = c === '#F2EEE6' || c === '#D9B98A' ? '#3A2A1E' : '#F2EEE6';
  return p.kind === 'cat'
    ? `<svg viewBox="0 0 32 32" class="pet-svg"><path d="M8 26c0-7 3-12 8-12s8 5 8 12z" fill="${c}"/><circle cx="16" cy="12" r="7" fill="${c}"/><path d="M10 9l1-7 5 5zM22 9l-1-7-5 5z" fill="${c}"/><circle cx="13.5" cy="12" r="1.2" fill="${d}"/><circle cx="18.5" cy="12" r="1.2" fill="${d}"/><path d="M15 15h2l-1 1z" fill="${d}"/><path d="M24 24c4 0 5-4 3-6" stroke="${c}" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`
    : `<svg viewBox="0 0 32 32" class="pet-svg"><path d="M8 27c0-7 3-11 8-11s8 4 8 11z" fill="${c}"/><ellipse cx="16" cy="12" rx="7" ry="7.5" fill="${c}"/><ellipse cx="8.5" cy="12" rx="2.6" ry="5" fill="${c}" opacity=".8"/><ellipse cx="23.5" cy="12" rx="2.6" ry="5" fill="${c}" opacity=".8"/><ellipse cx="16" cy="16" rx="3.6" ry="2.6" fill="${d}" opacity=".35"/><circle cx="13.3" cy="11" r="1.2" fill="${d}"/><circle cx="18.7" cy="11" r="1.2" fill="${d}"/><ellipse cx="16" cy="14.6" rx="1.5" ry="1.1" fill="${d}"/></svg>`;
}

/** Pets on board: a note now and then (always when one had to stay behind). */
function petsOnBoard(f: LiveFlight) {
  const F: any = f; if (F.petNoted) return; F.petNoted = true;
  const pets = manifestOf(f).filter(p => p.pet);
  if (!pets.length) return;
  const left = pets.filter(p => p.pet.left)[0];
  if (!left && seeded(f.id + 'petnote')() > 0.3) return;
  const p = left || pets[0], pt = p.pet;
  const where = pt.where === 'cabin' ? `in the cabin with ${p.name.split(' ')[0]}, seat ${p.seat}` : `in the heated hold`;
  State.notices.unshift({ id: uid(), kind: 'pilot', title: left ? `${pt.name} the ${pt.kind} stays behind at ${f.from}` : `${pt.name} the ${pt.kind} is flying on ${f.callsign}`,
    body: left ? `${pt.left}. ${p.name} is not pleased.` : `${pt.name} travels ${where}${pets.length > 1 ? `, with ${pets.length - 1} more ${pets.length === 2 ? 'pet' : 'pets'} on board` : ''}. ${f.from} to ${f.to}.`, time: 'Now', read: false, ref: f.id } as any);
}
/** Pet tickets: what pets pay per flight, on average per passenger (cabin about $90, hold about $180). */
function petFeePerPax(pol: string): number { return pol === 'no' ? 0 : pol === 'cabin' ? 90 / 300 * 0.55 : (90 * 0.55 + 180 * 0.45) / 300; }

/* ---------- reviews ---------- */
interface PaxReview { at: number; callsign: string; reg: string; from: string; to: string; avg: number; n: number; dist: number[]; good: string[]; bad: string[]; quotes: string[] }
function paxReviews(): PaxReview[] { const S: any = State; return S.paxReviews || (S.paxReviews = []); }

/** After a hired pilot's landing: every passenger rates the flight. */
function rateAiFlight(f: LiveFlight, at: number) {
  const F: any = f; if (f.from === f.to || F.ferry || F.job || !f.pax) return;
  const list = manifestOf(f); if (!list.length) return;
  const cid = (plane(f.reg) || {} as any).companyId || State.companyId;
  const A = apt(f.from), B = apt(f.to), nm = A && B ? gcDistanceNm(A.pos, B.pos) : 500, t = acType(flightTypeId(f));
  const svc = serviceEffects(cid, t ? t.cls : 'airliner', nm, !isDomestic(f.from, f.to), f.pax, 0);
  const fpm = F.landFpm || 180, delay = F.schedEnd ? Math.max(0, (at - F.schedEnd) / 60000) : 0;
  const holds: Hold[] = F.holds || [], bumpy = !!F.bumpy || holds.some(h => h.kind === 'air' && /weather/i.test(h.why)) || (B ? airportWind(f.to, B.pos).kt >= 25 : false);
  const goAround = holds.some(h => h.kind === 'goaround'), star = list.some(p => p.famous), med = F.medical;
  const good: { [k: string]: number } = {}, bad: { [k: string]: number } = {}, dist = [0, 0, 0, 0, 0], quotes: string[] = [];
  let sum = 0;
  list.forEach((p, i) => {
    const r = seeded(f.id + ':rate:' + i), mood = r(), temper = mood < 0.28 ? 'nervous' : mood < 0.82 ? 'calm' : 'thrill';
    let s = 3.9 + (r() - 0.5) * 0.9, why: [string, number][] = [];
    const add = (k: string, v: number) => { s += v; why.push([k, v]); };
    add(fpm < 120 ? 'A butter landing' : fpm < 250 ? 'A good landing' : fpm < 400 ? 'A firm landing' : 'A hard landing', fpm < 120 ? 0.35 : fpm < 250 ? 0.1 : fpm < 400 ? -0.4 : -1.1);
    if (delay > 15) add(delay > 180 ? 'A very long delay' : delay > 60 ? 'Over an hour late' : 'A delay', delay > 180 ? -1.4 : delay > 60 ? -0.8 : -0.3);
    add(svc.score >= 65 ? 'Great service on board' : svc.score >= 45 ? 'Decent service' : 'Poor service', (svc.score - 50) / 50 * 0.7);
    if (bumpy) add(temper === 'nervous' ? 'Frightening turbulence' : temper === 'thrill' ? 'Fun turbulence' : 'Some turbulence', temper === 'nervous' ? -0.7 : temper === 'thrill' ? 0.3 : -0.05);
    if (goAround) add(temper === 'nervous' ? 'A scary go-around' : 'A go-around, handled well', temper === 'nervous' ? -0.5 : 0.05);
    if (p.pet) add(p.pet.left ? 'My pet was left behind' : p.pet.where === 'cabin' ? 'My pet flew beside me' : 'My pet was looked after', p.pet.left ? -1.6 : p.pet.where === 'cabin' ? 0.7 : 0.25);
    if (star && !p.famous) add('A celebrity on board', 0.12);
    if (med) add(med.key === p.key ? 'The crew saved my day' : 'A diversion for a sick passenger', med.key === p.key ? 0.8 : -0.25);
    if (F.wxDivert) add(temper === 'calm' ? 'A safe diversion for weather' : 'Diverted because of the weather', temper === 'calm' ? -0.2 : -0.6);
    if (p.famous) add('Treated discreetly', 0.2);
    const dr = conductDrama(cid); if (dr && r() < 0.35 + 0.1 * dr) add('Heard about trouble with the airline\'s staff', -0.12 * dr);
    const stars = clamp(Math.round(s), 1, 5); dist[stars - 1]++; sum += stars;
    why.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    const top = why[0]; if (top) { if (top[1] >= 0.1) good[top[0]] = (good[top[0]] || 0) + 1; else if (top[1] <= -0.1) bad[top[0]] = (bad[top[0]] || 0) + 1; }
    if (quotes.length < 3 && top && Math.abs(top[1]) >= 0.3 && (top[1] > 0 ? stars >= 4 : stars <= 3) && r() < 0.3) quotes.push(`${'★'.repeat(stars)} ${top[0]}. ${p.name.split(' ')[0]}, ${natLabel(p.nat)}`);
  });
  const rank = (o: any) => Object.keys(o).sort((a, b) => o[b] - o[a]).slice(0, 3);
  const rv: PaxReview = { at, callsign: f.callsign, reg: f.reg, from: f.from, to: f.to, avg: Math.round(sum / list.length * 10) / 10, n: list.length, dist, good: rank(good), bad: rank(bad), quotes };
  const l = paxReviews(); l.unshift(rv); if (l.length > 400) l.length = 400;
  // very good and very bad flights get talked about
  try { if (rv.avg >= 4.6) Progress.popularity(1, 'Passengers loved a flight'); else if (rv.avg <= 2.2) Progress.popularity(-1, 'Passengers hated a flight'); } catch (e) { /* ignore */ }
}

/** Ranking → Passengers. */
function reviewsHtml(): string {
  const since = Date.now() - 30 * 864e5, cid = State.companyId;
  const regs = fleetOf(cid).map(a => a.reg), l = paxReviews().filter(r => r.at >= since && regs.indexOf(r.reg) >= 0);
  if (!l.length) return `<div class="card"><p class="fine-print">${icon('info')}No passenger reviews in the last 30 days yet. After each of your hired pilots' flights every passenger gives it 1 to 5 stars.</p></div>`;
  const n = l.reduce((s, r) => s + r.n, 0), avg = l.reduce((s, r) => s + r.avg * r.n, 0) / n, dist = [0, 1, 2, 3, 4].map(i => l.reduce((s, r) => s + r.dist[i], 0));
  const cnt = (k: 'good' | 'bad') => { const o: any = {}; l.forEach(r => r[k].forEach(x => o[x] = (o[x] || 0) + 1)); return Object.keys(o).sort((a, b) => o[b] - o[a]).slice(0, 5); };
  const st = (v: number) => `<span class="rk-stars">${[1, 2, 3, 4, 5].map(i => `<i class="${v >= i - 0.25 ? 'on' : v >= i - 0.75 ? 'half' : ''}">${icon('star')}</i>`).join('')}<b>${v.toFixed(1)}</b></span>`;
  return `<div class="rk-top"><div class="card rv-sum"><div class="card-h"><b>Passengers' rating, last 30 days</b></div>${st(avg)}<small>${num(n)} passengers on ${num(l.length)} flights</small>
      <div class="rv-dist">${[4, 3, 2, 1, 0].map(i => `<span><small>${i + 1}★</small><i><em style="width:${(dist[i] / Math.max(1, n) * 100).toFixed(1)}%"></em></i><small>${Math.round(dist[i] / Math.max(1, n) * 100)}%</small></span>`).join('')}</div></div>
    <div class="card rv-why"><div class="card-h"><b>What they talk about</b></div><div class="rv-cols"><div><small class="green">Liked</small>${cnt('good').map(x => `<p>${esc(x)}</p>`).join('') || '<p class="muted">–</p>'}</div><div><small class="amber">Disliked</small>${cnt('bad').map(x => `<p>${esc(x)}</p>`).join('') || '<p class="muted">–</p>'}</div></div></div></div>
    <div class="card lb"><div class="card-h"><b>Recent flights</b></div><div class="lb-list">${l.slice(0, 40).map(r => `<div class="lb-row rv-row"><span class="lb-who"><b>${esc(r.callsign)} · ${esc(r.from)} → ${esc(r.to)}</b><small>${esc(r.reg)} · ${esc(dateStr(new Date(r.at)).slice(0, 16).replace('T', ' '))} · ${r.n} passengers</small>${r.quotes.map(q => `<small class="rv-q">“${esc(q)}”</small>`).join('')}</span><span class="lb-v">${st(r.avg)}</span></div>`).join('')}</div></div>`;
}

/* ---------- medical emergencies ---------- */
/** Rarely (about one flight in 250 with passengers, over 250 nm): a passenger needs a doctor in flight.
 *  The flight goes to the nearest suitable airport about halfway, and carries on afterwards. */
function maybeMedical(f: any, a: any): boolean {
  if (f.test || f.ferry || f.job || !f.pax || f.medical || f.medicalDone) return false;
  const A = apt(f.from), B = apt(f.to); if (!A || !B) return false;
  const nm = gcDistanceNm(A.pos, B.pos); if (nm < 250) return false;
  if (Math.random() >= 0.004) return false;
  let alt = '';
  for (const fr of [0.5, 0.4, 0.6, 0.3, 0.7]) {
    const pt = gcInterpolate(A.pos, B.pos, fr), k = World.nearest(pt[0], pt[1], 250);
    if (k && k !== f.from && k !== f.to && apt(k) && legRunwayCheck(a.typeId, f.from, k, f.pax).ok) { alt = k; break; }
  }
  if (!alt) return false;
  const list = manifestOf(f), who = list[Math.floor(Math.random() * list.length)];
  const why = ['a suspected heart attack', 'a stroke', 'a severe allergic reaction', 'breathing difficulties', 'a diabetic emergency', 'a seizure', 'severe abdominal pain'][Math.floor(Math.random() * 7)];
  f.medical = { key: who ? who.key : '', name: who ? who.name : 'A passenger', seat: who ? who.seat : '', why, orig: f.to };
  f.to = alt;
  return true;
}
/** The moment the crew decide to divert (shown once the flight is well on its way). */
function medicalNote(f: any) {
  const m = f.medical; if (!m || m.noted) return; m.noted = true;
  try { newsMedical(f); } catch (e) { /* ignore */ }
  State.notices.unshift({ id: uid(), kind: 'pilot', title: `${f.callsign}: medical emergency, diverting to ${f.to}`, body: `${m.name} (seat ${m.seat}) has ${m.why}. A doctor on board is helping and the crew declared an emergency. ${f.callsign} diverts to ${f.to}; after the stop it carries on to ${m.orig}.`, time: 'Now', read: false, ref: f.id } as any);
  try { renderTopbar(); Sound.chime(); } catch (e) { /* not ready */ }
}

/* ---------- landing heavy after a diversion ---------- */
// Aircraft that can dump fuel in flight (a fuel jettison system); the rest burn it off in a hold.
const FUEL_DUMP: { [typeId: string]: number } = { 'b77w-pmdg': 2400, 'b748': 2400, 'a350-ini': 2000, 'b78x': 1800, 'a310-ini': 1300 };   // kg a minute
/** A diversion soon after take-off can mean landing far over the maximum landing weight: the crew hold
 *  first, dumping fuel where the aircraft can, otherwise burning it off, until it is at the limit. */
function heavyLandingHold(f: any, a: any, prof: FlightProfile, origTo: string) {
  const t = acType(a.typeId), S = speedSpec(t.id), A = apt(f.from), O = apt(origTo), N = apt(f.to); if (!t || !A || !O || !N) return;
  const cargoT = (f.cargoKg || 0) / 1000;
  const Wo = flightWeights(t.id, f.pax || 0, gcDistanceNm(A.pos, O.pos), cargoT), Wn = flightWeights(t.id, f.pax || 0, gcDistanceNm(A.pos, N.pos), cargoT);
  const lw = (Wo.tow - (Wn.tow - Wn.lw)) * 1000, mlw = S.mlw * 1000, excess = Math.round(lw - mlw);
  if (excess < Math.max(300, mlw * 0.005)) return;   // at or about the limit: lands normally
  const dump = FUEL_DUMP[t.id], rate = dump || (BURN_KG_H[t.cls] || 2500) / 60 * 1.1;
  let min = excess / rate + (dump ? 4 : 0), why = dump ? `Dumping ${num(Math.round(excess / 100) * 100)} kg of fuel to get down to the landing weight` : `Holding to burn off ${num(Math.round(excess / 100) * 100)} kg of fuel before landing`;
  try { newsFuelDump(f, t.id, excess, !!dump); } catch (e) { /* ignore */ }
  if (min > 75) { min = 75; why += ' (then an overweight landing, with an inspection after)'; f.overweight = true; }
  const desc = prof.pts.filter((p: any) => p.ph === 'Descent')[0], at = desc ? desc.s : prof.totalS * 0.8;
  (f.holds = f.holds || []).push({ at, s: Math.round(min * 60), kind: 'air', why });
  f.holds.sort((x: Hold, y: Hold) => x.at - y.at);
}

/* ---------- the people walking to and from the aircraft ---------- */
const _walkers = new Map<string, { cloth: string; skin: string; pet: string }[]>();
/** The passengers of the flight that is boarding (the next one) or deboarding (the one that just landed),
 *  with the colours of their clothes and skin from their passenger card, and their dog or cat. */
function walkersFor(a: any, stage: string): { cloth: string; skin: string; pet: string }[] {
  const S: any = State, next = (S.aiNext || []).filter((n: any) => n.reg === a.reg)[0];
  const f: any = stage === 'Boarding' && next ? { id: `${a.reg}-${next.depAt}`, reg: a.reg, from: next.from, to: next.to, pax: aiPlannedLoad(next).pax, paxJ: 0, paxF: 0 }
    : a.lastFlightId ? { id: a.lastFlightId, reg: a.reg, from: a.lastFrom || a.location, to: a.location, pax: a.lastPax || 0, paxJ: a.lastPaxJ || 0, paxF: a.lastPaxF || 0 } : null;
  if (!f || !f.pax) return [];
  const key = f.id + '|' + f.pax, hit = _walkers.get(key); if (hit) return hit;
  const list = manifestOf(f).map(p => ({ cloth: UNIFORM_COLORS[(p.look && p.look.uniform) || 0] || '#2F5D8C', skin: SKIN_TONES[(p.look && p.look.skin) || 2] || '#D9A07A', pet: p.pet && !p.pet.left && p.pet.where === 'cabin' ? p.pet.color : '' }));   // pets for the hold go with the bags
  _walkers.set(key, list); if (_walkers.size > 30) _walkers.delete(_walkers.keys().next().value);
  return list;
}

/* ---------- visiting a pet on board ---------- */
// The pet's own portrait, kind words to choose from, and its answer: a few sweet barks or a purr (made by
// the app itself, no recordings), with the reaction in words.
const PET_WORDS: { [k: string]: string[] } = {
  dog: ['Who\'s a good dog?', 'You\'re so brave flying today!', 'Such soft ears!', 'Almost there, sweetheart.', 'Would you like a treat?', 'Hello, gorgeous!'],
  cat: ['Hello, little one.', 'You\'re so brave flying today!', 'What lovely whiskers!', 'Almost there, sweetheart.', 'Would you like a treat?', 'Aren\'t you beautiful?'],
};
const PET_REPLIES: { [k: string]: string[] } = {
  dog: ['{n} wags so hard the whole carrier wiggles, and gives two happy little barks.', '{n} presses a wet nose against your hand and yips softly.', '{n} rolls over for a belly rub and gives a sweet, sleepy bark.', '{n} licks your fingers and barks once, very politely.'],
  cat: ['{n} closes both eyes slowly and starts to purr.', '{n} pushes a soft cheek against your fingers, purring like a little engine.', '{n} kneads the blanket and purrs, very pleased with the flight.', '{n} stretches, yawns and settles into a deep purr.'],
};
let _petAudio: AudioContext = null;
function petSound(kind: 'dog' | 'cat') {
  try {
    if (State.settings.muteAll) return;
    const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext; if (!AC) return;
    const ctx = _petAudio = _petAudio || new AC(); if (ctx.state !== 'running') ctx.resume();
    const t0 = ctx.currentTime + 0.05, out = ctx.createGain(); out.gain.value = 0.9; out.connect(ctx.destination);
    if (kind === 'dog') {
      // two or three short, high, happy yips: a falling voice through a nasal filter
      const n = 2 + (Math.random() < 0.4 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const t = t0 + i * 0.26 + Math.random() * 0.05, f0 = 950 + Math.random() * 200;
        const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), bp = ctx.createBiquadFilter();
        o.type = 'sawtooth'; o2.type = 'square'; o.frequency.setValueAtTime(f0 * 0.7, t); o.frequency.exponentialRampToValueAtTime(f0, t + 0.03); o.frequency.exponentialRampToValueAtTime(f0 * 0.55, t + 0.14);
        o2.frequency.setValueAtTime(f0 * 0.35, t); o2.frequency.exponentialRampToValueAtTime(f0 * 0.28, t + 0.14);
        bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 1.4;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);
        o.connect(bp); o2.connect(bp); bp.connect(g); g.connect(out); o.start(t); o2.start(t); o.stop(t + 0.2); o2.stop(t + 0.2);
      }
    } else {
      // a purr: a low rumble pulsing about 25 times a second, breathing in and out
      const dur = 4.2, len = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / ctx.sampleRate, breath = t % 1.4 < 0.75 ? 1 : 0.65, pulse = Math.pow(Math.max(0, Math.sin(t * Math.PI * 2 * (t % 1.4 < 0.75 ? 26 : 23))), 3);
        lp += ((Math.random() * 2 - 1) - lp) * 0.08;
        d[i] = lp * pulse * breath * Math.min(1, t * 3, (dur - t) * 3) * 2.6;
      }
      const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(); src.buffer = buf; f.type = 'lowpass'; f.frequency.value = 380;
      src.connect(f); f.connect(out); src.start(t0);
    }
  } catch (e) { /* no sound on this device */ }
}
/** A bigger portrait of the pet, with blinking eyes and a tail that moves. */
function petPortrait(p: PaxPet): string {
  const c = p.color, light = c === '#F2EEE6' || c === '#D9B98A', d = light ? '#3A2A1E' : '#F2EEE6', nose = '#2A1C14';
  return p.kind === 'cat'
    ? `<svg viewBox="0 0 160 140" class="pet-portrait cat"><ellipse cx="80" cy="128" rx="52" ry="8" fill="rgba(0,0,0,.25)"/>
      <path class="pp-tail" d="M118 112c22-4 30-22 22-36" stroke="${c}" stroke-width="11" fill="none" stroke-linecap="round"/>
      <path d="M40 126c0-34 16-54 40-54s40 20 40 54z" fill="${c}"/><circle cx="80" cy="58" r="32" fill="${c}"/>
      <path d="M52 40l4-30 22 20zM108 40l-4-30-22 20z" fill="${c}"/><path d="M57 34l3-16 12 11zM103 34l-3-16-12 11z" fill="#E8A0A8" opacity=".7"/>
      <g class="pp-eyes"><ellipse cx="68" cy="56" rx="6" ry="7" fill="#9BD15A"/><ellipse cx="92" cy="56" rx="6" ry="7" fill="#9BD15A"/><ellipse cx="68" cy="56" rx="2" ry="6" fill="#111"/><ellipse cx="92" cy="56" rx="2" ry="6" fill="#111"/></g>
      <path d="M76 68h8l-4 5z" fill="#E8A0A8"/><path d="M80 73c-2 5-8 6-10 3M80 73c2 5 8 6 10 3" stroke="${d}" stroke-width="1.6" fill="none"/>
      <path d="M58 70l-22-4M58 74l-22 2M102 70l22-4M102 74l22 2" stroke="${d}" stroke-width="1.2" opacity=".7"/></svg>`
    : `<svg viewBox="0 0 160 140" class="pet-portrait dog"><ellipse cx="80" cy="128" rx="52" ry="8" fill="rgba(0,0,0,.25)"/>
      <path class="pp-tail" d="M116 104c18-8 24-24 18-36" stroke="${c}" stroke-width="10" fill="none" stroke-linecap="round"/>
      <path d="M40 126c0-34 16-52 40-52s40 18 40 52z" fill="${c}"/><ellipse cx="80" cy="58" rx="32" ry="34" fill="${c}"/>
      <ellipse cx="48" cy="58" rx="12" ry="26" fill="${c}" class="pp-ear" transform="rotate(14 48 40)" style="filter:brightness(.82)"/><ellipse cx="112" cy="58" rx="12" ry="26" fill="${c}" class="pp-ear r" transform="rotate(-14 112 40)" style="filter:brightness(.82)"/>
      <ellipse cx="80" cy="74" rx="17" ry="13" fill="${d}" opacity=".3"/>
      <g class="pp-eyes"><circle cx="68" cy="54" r="5.5" fill="#1A120C"/><circle cx="92" cy="54" r="5.5" fill="#1A120C"/><circle cx="69.5" cy="52.5" r="1.6" fill="#fff"/><circle cx="93.5" cy="52.5" r="1.6" fill="#fff"/></g>
      <ellipse cx="80" cy="68" rx="7" ry="5" fill="${nose}"/><path d="M80 73v5M80 78c-3 4-9 4-11 1M80 78c3 4 9 4 11 1" stroke="${nose}" stroke-width="1.8" fill="none"/>
      <path class="pp-tongue" d="M75 82c0 8 10 8 10 0z" fill="#E86A7A"/></svg>`;
}
ACTIONS['pet-visit'] = el => {
  const f = State.live.filter(x => x.id === el.getAttribute('data-f'))[0]; if (!f) return;
  const p = manifestOf(f).filter(x => x.key === el.getAttribute('data-key'))[0]; if (!p || !p.pet) return;
  const pt = p.pet, he = seeded(p.key + 'petsex')() < 0.5;
  try { newsPet(f, pt.name || 'A pet', pt.kind || 'dog'); } catch (e) { /* ignore */ }
  Sound.tick();
  openLayer('modal', `<div class="modal-head"><div><h2>${esc(pt.name)}</h2><small>${esc(p.name)}'s ${pt.kind}, ${pt.left ? 'left behind at ' + esc(f.from) : pt.where === 'cabin' ? 'under seat ' + esc(p.seat) : 'in the heated hold'}</small></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
    <div class="modal-body pet-visit"><div class="pv-fig">${petPortrait(pt)}</div>
      <div class="pv-side"><p class="pv-say" aria-live="polite">${pt.left ? `${esc(pt.name)} stayed behind at ${esc(f.from)}, so you can't visit ${he ? 'him' : 'her'} on this flight.` : pt.where === 'cabin' ? `Say something nice to ${esc(pt.name)}:` : `You check on ${esc(pt.name)} in the warm, quiet hold. Say something nice:`}</p>
      ${pt.left ? '' : `<div class="pv-words">${PET_WORDS[pt.kind].map(w => `<button class="btn ghost sm" data-act="pet-say" data-f="${esc(f.id)}" data-key="${esc(p.key)}" data-w="${esc(w.replace('good dog', he ? 'good boy' : 'good girl'))}">${esc(w.replace('good dog', he ? 'good boy' : 'good girl'))}</button>`).join('')}</div>
      <button class="btn primary" data-act="pet-say" data-f="${esc(f.id)}" data-key="${esc(p.key)}" data-w="">${icon('user')}Give ${he ? 'him' : 'her'} a gentle pat</button>`}</div></div>`, { cls: 'wide pet-pop' });
};
ACTIONS['pet-say'] = el => {
  const f = State.live.filter(x => x.id === el.getAttribute('data-f'))[0]; if (!f) return;
  const p = manifestOf(f).filter(x => x.key === el.getAttribute('data-key'))[0]; if (!p || !p.pet) return;
  const pt = p.pet, w = el.getAttribute('data-w') || '', r = PET_REPLIES[pt.kind][Math.floor(Math.random() * PET_REPLIES[pt.kind].length)].replace('{n}', pt.name);
  const say = $('.pet-pop .pv-say'); if (say) { say.innerHTML = `${w ? `<b>You:</b> “${esc(w)}”<br>` : '<b>You give a gentle pat.</b><br>'}${esc(r)}`; say.classList.remove('pop'); void (say as HTMLElement).offsetWidth; say.classList.add('pop'); }
  const fig = $('.pet-pop .pet-portrait'); if (fig) { fig.classList.remove('happy'); void (fig as any).getBoundingClientRect(); fig.classList.add('happy'); }
  petSound(pt.kind);
};
