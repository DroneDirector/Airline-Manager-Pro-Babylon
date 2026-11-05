/* A Security incident in the lounge: two of your officers come for a drunk or unruly guest.
 * Built as a list of steps (SEC_STEPS) run one after another, with the lines as data (SEC_LINES), so a new step or new
 * lines can be added without touching the rest. See docs/security-feature.md.
 *  - The lead officer always speaks first; then they take turns, one voice at a time (the game's own voices). Now and
 *    then (more often with a very bad person, and mostly during a long instruction) the guest cuts in.
 *  - Warnings one to three get firmer; on the fourth refusal the taser comes out with a warning; five and six are
 *    firmer with the taser out; the seventh is shouted. Then the taser: the guest drops, shaking on the floor, the
 *    officers run over, cuff the hands behind the back, lift them up and walk them out (one holding them from behind,
 *    the other alongside) to the way out (secExit).
 *  - Tasers forbidden (your rules): after the third refusal the second officer radios the police; two city police
 *    officers walk in and take over (their own warnings, their taser if need be, the cuffs and the escort).
 *  - Most guests give in early; only the truly defiant go all the way. */

interface SecPlan { temper: 'sorry' | 'confused' | 'angry'; refusals: number; bad: boolean; taser: boolean; police: boolean; early: boolean; rogue: boolean }
/** How it will go, worked out once (the notice and the scene agree): who the guest is, and how far they push it. */
function secPlan(bac: number, heavy: boolean, rng: () => number, leadRating: number): SecPlan {
  const bad = bac >= 1.6 || heavy && rng() < 0.5;
  const temper: SecPlan['temper'] = bad ? (rng() < 0.8 ? 'angry' : 'confused') : rng() < 0.55 ? 'sorry' : rng() < 0.7 ? 'confused' : 'angry';
  const refusals = temper === 'sorry' ? Math.floor(rng() * 2) : temper === 'confused' ? 1 + Math.floor(rng() * 3) : bad ? 3 + Math.floor(rng() * 6) : 2 + Math.floor(rng() * 3);
  const taser = secRule('taser'), weak = leadRating < 3.0;
  const rogue = !taser && refusals > 3 && weak && rng() < 0.1;   // a weak officer using the taser against your rules
  const police = !taser && refusals > 3 && !rogue;
  const early = taser && refusals >= 5 && weak && rng() < 0.25;  // a weak officer firing too early
  return { temper, refusals, bad, taser, police, early, rogue };
}
/** Your rules for the officers (Crew → Security). */
function secRule(k: string): boolean { const S: any = State, R = S.secRules || (S.secRules = {}); return k === 'taser' ? R.taser !== false : !!R[k]; }

/* ---------- the lines, built from pieces ---------- */
const SEC_LINES: any = {
  open: ['Excuse me, {sir}.', 'Hello there, {sir}.', '{Sir}, a moment please.', 'Good evening, {sir}.'],
  reason: ['The bar staff are worried about you.', 'We think you\'ve had a bit too much to drink.', 'We\'ve had a report from the bar.', 'You\'re not in a state to fly today.'],
  ask: ['Could you come with us, please?', 'Let\'s step outside and get you some water.', 'Would you walk with us to the door?', 'Come with us, and we\'ll sort this out calmly.'],
  firm: ['I need you to come with us now.', 'I\'m asking you one more time to come with us.', 'This isn\'t optional. Walk with us to the door.', 'Stand up and come with us, please. Now.'],
  firmTail: ['We don\'t want any trouble.', 'Let\'s do this the easy way.', 'You won\'t be flying today, {sir}.', 'Nobody needs to get hurt here.'],
  taser: ['Do as you\'re told right now, or you will be tased.', 'Stop. Hands where I can see them, or I will use the taser.', 'Last chance. Comply now, or you\'ll be tased.', 'I am drawing my taser. Do as I say, now.'],
  order: ['Walk slowly towards me, and don\'t try anything.', 'Get down on your knees.', 'Put your hands on your head.', 'Turn around and put your hands behind your back.', 'Get down on the floor.'],
  shout: ['Get on your knees now, or I will tase you!', 'Get on the floor now!', 'Walk towards me slowly, now!', 'Hands behind your back, now, or I tase you!'],
  radio: ['Control, security in the lounge. We need police, a passenger refusing to leave.', 'Control, this is lounge security. Requesting police, one guest, not cooperating.'],
  police: ['Police! Stay where you are.', 'Police. Listen to me carefully.', 'Police officers. You need to do what I say now.'],
  cuff: ['Hands behind your back.', 'Stay down. Hands behind your back.', 'Don\'t move. You\'re being restrained.'],
  cuffed: { guard: ['You\'re detained until the police get here.', 'Up you get. We\'re walking out now.'], police: ['You\'re under arrest.', 'You\'re coming with us to the station.'] },
  comply: { sorry: ['I\'m sorry, I\'m sorry. I\'ll come.', 'Okay, okay. I won\'t do it again.', 'Fine. I\'m sorry for the trouble.'], confused: ['Alright, alright. Which way is the door?', 'Okay. Where are we going?'], angry: ['Fine! Fine! I\'m going!', 'Alright! Don\'t touch me, I\'m coming!'] },
  refuse: { sorry: ['Please, just one more minute.', 'I\'m fine, really, I\'m fine.'], confused: ['What? Where are we going?', 'My flight, I have a flight to catch.', 'Who are you? I\'m just sitting here.'],
    angry: ['I\'m not going anywhere!', 'Get your hands off me!', 'I paid for this lounge!', 'You\'re a terrible security guard!', 'I hate you people!', 'Leave me alone!'] },
  cutIn: ['I have my rights!', 'Don\'t you touch me!', 'I know my rights!', 'You can\'t do this to me!', 'Shut up! Just shut up!'],
  tased: ['Aaagh!', 'Argh!'],
  after: { sorry: ['I\'m sorry. I\'m so sorry.'], confused: ['What happened?'], angry: ['This is ridiculous!', 'You\'ll hear from my lawyer!'] },
};
function secLine(a: string[], sex: 'm' | 'f'): string { const s = a[Math.floor(Math.random() * a.length)]; return s.replace('{sir}', sex === 'f' ? 'madam' : 'sir').replace('{Sir}', sex === 'f' ? 'Madam' : 'Sir'); }
/** The lead officer's words for a warning (1 to 7): gentle, firmer, the taser, shouted. */
function secWarning(n: number, sex: 'm' | 'f', police: boolean): { text: string; mood: string; long: boolean } {
  const L = SEC_LINES, p = (a: string[]) => secLine(a, sex);
  let t = '', mood = 'neutral';
  if (n === 1) t = p(L.open) + ' ' + p(L.reason) + ' ' + p(L.ask);
  else if (n <= 3) t = p(L.firm) + ' ' + p(L.firmTail);
  else if (n === 4) t = (police ? p(L.police) + ' ' : '') + p(L.taser) + ' ' + p(L.order);
  else if (n <= 6) t = p(L.order) + ' ' + p(L.taser);
  else { t = p(L.shout); mood = 'angry'; }
  return { text: t, mood, long: t.split(' ').length > 9 };
}

/* ---------- the people ---------- */
function secActor(R: any, look: any, name: string, role: string, x: number, z: number): any {
  const T = THREE; let m: any = null;
  try { m = Human.build(dressed(look, role as any), role as any, '#1C1F26', av3Style(), R.q >= 2 ? 0.7 : 0.5); try { modelsPeople(m, look); } catch (e) { /* the app's own */ } } catch (e) { m = null; }
  if (!m) return null;
  const pivot = new T.Group(), holder = new T.Group(); holder.add(m.root); pivot.add(holder); pivot.rotation.order = 'YXZ'; R.A.root.add(pivot);
  return { m, pivot, holder, x, z, yaw: 0, dist: 0, v: 0, name, look, sex: look.sex === 'f' ? 'f' : 'm', armR: null, armL: null };
}
/** Two city police officers: their uniform is always the same; who they are, a hat or not and their shoes vary. */
function secPoliceLooks(): any[] {
  const r = Math.random(), sexes: ('m' | 'f')[] = r < 0.4 ? ['m', 'm'] : r < 0.7 ? ['m', 'f'] : r < 0.85 ? ['f', 'm'] : ['f', 'f'];
  return sexes.map((sx, i) => { const L: any = ctLook('police-' + uid() + i, sx, 'police'); L.sec = true; L.police = true; L.top = 'jacket'; L.uniform = 0; L.neck = 'tie'; L.hat = Math.random() < 0.55 ? 'cap' : 'none'; L.shoes = sx === 'f' ? ['boots', 'pumps', 'sneakers'][Math.floor(Math.random() * 3)] : ['boots', 'oxford', 'sneakers'][Math.floor(Math.random() * 3)]; L.glasses = 'none'; return L; });
}

/* ---------- the incident ---------- */
/** Start it: the guest (a lounge guest), the plan, and your two officers coming in through the doors. */
function secIncident(G: any, plan: SecPlan, lead: any, second: any) {
  const R = LoungeRoom, A = R.A; if (!A || R.inc) return false;
  const door = A.door || { x: 0, z: 0 };
  const L1 = Object.assign({}, lead.look, { sec: true }), L2 = Object.assign({}, second.look, { sec: true });
  const g1 = secActor(R, L1, lead.name, 'ground', door.x - 0.3, door.z), g2 = secActor(R, L2, second.name, 'ground', door.x + 0.3, door.z);
  if (!g1 || !g2) return false;
  // the guest stops what they are doing
  if (G.seat) { const sd = lgSeatSide(G.seat); lgFreeSeat(G); G.x = sd.x; G.z = sd.z; }
  G.st = 'led'; G.v = 0; G.sitK = 0; G.holder.position.y = 0; if (G.drink && G.drink.g) { G.drink.g.visible = false; }
  const I: any = { G, plan, g1, g2, cops: null, lead: g1, side: g2, step: 0, t: 0, warn: 0, refused: 0, say: null, queue: [], exit: secExit('lounge'), sex: G.P && G.P.look && G.P.look.sex === 'f' ? 'f' : 'm', fall: null, cuffs: null, taser: null };
  R.inc = I; secVoiceNotice();
  return true;
}
/** The steps, in order. Each returns true when it is done; a step may jump (I.step = index of another). */
const SEC_STEPS: { id: string; run: (I: any, dt: number, now: number) => boolean }[] = [
  { id: 'arrive', run: (I, dt) => { const G = I.G, gx = G.x + 1.4 * Math.sin(G.yaw), gz = G.z + 1.4 * Math.cos(G.yaw);
      const a = secWalk(I.lead, gx, gz, 1.2, dt), b = secWalk(I.side, gx + 0.9 * Math.cos(G.yaw), gz - 0.9 * Math.sin(G.yaw), 1.2, dt);
      secFace(I.G, I.lead.x, I.lead.z, dt); return a && b; } },
  { id: 'talk', run: (I, dt) => {
      secFace(I.lead, I.G.x, I.G.z, dt); secFace(I.side, I.G.x, I.G.z, dt); secFace(I.G, I.lead.x, I.lead.z, dt);
      if (I.say) return false;   // someone is speaking
      if (I.queue.length) { secSay(I, I.queue.shift()); return false; }
      if (I.gaveIn) return true;
      // tasers forbidden: after the third refusal, the police (unless a weak officer breaks the rule)
      if (I.plan.police && !I.cops && I.refused >= 3) { I.step = SEC_STEPS.findIndex(s => s.id === 'radio'); return false; }
      if (I.warn >= 7 && I.refused >= 7) { I.step = SEC_STEPS.findIndex(s => s.id === 'tase'); return false; }
      if (I.plan.early && I.warn >= 5 && I.refused >= 5) { I.step = SEC_STEPS.findIndex(s => s.id === 'tase'); return false; }
      I.warn++;
      const w = secWarning(I.warn, I.sex, !!I.cops && I.warn === 4);
      if (I.warn >= 4) I.taserOut = true;
      const gives = I.refused >= I.plan.refusals;
      // a cut-in: rare, likelier with a very bad person and a long instruction
      const cut = !gives && I.plan.temper === 'angry' && w.long && Math.random() < (I.plan.bad ? 0.35 : 0.08);
      I.queue.push({ who: 'lead', text: w.text, mood: w.mood, cut });
      if (cut) I.queue.push({ who: 'guest', text: secLine(SEC_LINES.cutIn, I.sex), mood: 'angry', shout: true });
      if (gives) { I.queue.push({ who: 'guest', text: secLine(SEC_LINES.comply[I.plan.temper], I.sex), mood: I.plan.temper === 'sorry' ? 'sorry' : I.plan.temper === 'angry' ? 'angry' : 'neutral' }); I.gaveIn = true; }
      else { I.refused++; if (!cut) I.queue.push({ who: 'guest', text: secLine(SEC_LINES.refuse[I.plan.temper].filter((x: string) => !I.cops || x.indexOf('security') < 0), I.sex), mood: I.plan.temper === 'angry' ? 'angry' : I.plan.temper === 'sorry' ? 'sorry' : 'neutral' }); }
      return false; } },
  // gave in: led out (in cuffs if they made it hard)
  { id: 'gaveIn', run: (I) => { I.step = SEC_STEPS.findIndex(s => s.id === (I.refused >= 3 ? 'cuffStanding' : 'escort')); return false; } },
  { id: 'radio', run: (I, dt) => {
      if (!I.radioed) { I.radioed = true; I.queue.push({ who: 'side', text: secLine(SEC_LINES.radio, I.sex), mood: 'neutral' }); }
      if (I.say) return false; if (I.queue.length) { secSay(I, I.queue.shift()); return false; }
      // the police arrive: two officers from the city, fast through the doors
      if (!I.cops) { const door = LoungeRoom.A.door || { x: 0, z: 0 }, looks = secPoliceLooks(), R = LoungeRoom;
        const c1 = secActor(R, looks[0], 'Police officer', 'ground', door.x - 0.3, door.z), c2 = secActor(R, looks[1], 'Police officer', 'ground', door.x + 0.3, door.z);
        if (!c1 || !c2) { I.step = SEC_STEPS.findIndex(s => s.id === 'escort'); return false; }
        I.cops = [c1, c2]; I.copT = 0; }
      I.copT += dt; const G = I.G, gx = G.x + 1.5 * Math.sin(G.yaw), gz = G.z + 1.5 * Math.cos(G.yaw);
      // your officers step back; the police take the lead
      secWalk(I.g1, G.x + 2.6 * Math.sin(G.yaw) - 0.8, G.z + 2.6 * Math.cos(G.yaw), 0.8, dt); secWalk(I.g2, G.x + 2.6 * Math.sin(G.yaw) + 0.8, G.z + 2.6 * Math.cos(G.yaw), 0.8, dt);
      const a = secWalk(I.cops[0], gx, gz, 1.6, dt), b = secWalk(I.cops[1], gx + 0.9 * Math.cos(G.yaw), gz - 0.9 * Math.sin(G.yaw), 1.6, dt);
      if (a && b) { I.lead = I.cops[0]; I.side = I.cops[1]; I.warn = 3; I.refused = Math.min(I.refused, 3); I.plan.taser = true; I.step = SEC_STEPS.findIndex(s => s.id === 'talk'); }
      return false; } },
  { id: 'tase', run: (I, dt, now) => {
      if (!I.fired) { I.fired = true; I.t = 0; secZap(); I.queue = []; secSayNow(I, { who: 'guest', text: secLine(SEC_LINES.tased, I.sex), mood: 'angry', shout: true }); I.fall = { t: 0, dir: Math.random() < 0.5 ? 1 : -1, side: Math.random() < 0.5 ? 1 : -1 }; }
      I.t += dt; secWires(I, I.t < 0.6);
      return I.t > 0.7; } },
  { id: 'run', run: (I, dt) => { const G = I.G, gx = G.x + 0.7 * Math.sin(G.yaw + 1.2), gz = G.z + 0.7 * Math.cos(G.yaw + 1.2);
      const a = secWalk(I.lead, gx, gz, 3.4, dt), b = secWalk(I.side, G.x + 0.8 * Math.sin(G.yaw - 1.4), G.z + 0.8 * Math.cos(G.yaw - 1.4), 3.0, dt);
      return a && b; } },
  { id: 'cuff', run: (I, dt) => {
      if (!I.cuffT) { I.cuffT = 0.001; I.queue.push({ who: 'lead', text: secLine(SEC_LINES.cuff, I.sex), mood: 'neutral' }); }
      if (I.say) return false; if (I.queue.length) { secSay(I, I.queue.shift()); return false; }
      I.cuffT += dt; I.kneel = Math.min(1, I.cuffT * 2); if (I.cuffT > 0.8) secCuffs(I, true);
      return I.cuffT > 2.2; } },
  { id: 'lift', run: (I, dt) => { I.liftT = (I.liftT || 0) + dt; I.kneel = Math.max(0, 1 - I.liftT * 1.5);
      if (I.liftT > 1.4) { const pol = !!I.cops; I.queue.push({ who: 'lead', text: secLine(pol ? SEC_LINES.cuffed.police : SEC_LINES.cuffed.guard, I.sex), mood: 'neutral' }, { who: 'guest', text: secLine(SEC_LINES.after[I.plan.temper], I.sex), mood: I.plan.temper === 'sorry' ? 'sorry' : 'angry' }); I.step = SEC_STEPS.findIndex(s => s.id === 'escort'); }
      return false; } },
  { id: 'cuffStanding', run: (I, dt) => {
      if (!I.cuffT) { I.cuffT = 0.001; I.queue.push({ who: 'lead', text: 'Turn around. Hands behind your back.', mood: 'neutral' }); }
      if (I.say) return false; if (I.queue.length) { secSay(I, I.queue.shift()); return false; }
      I.cuffT += dt; secWalk(I.lead, I.G.x - 0.45 * Math.sin(I.G.yaw), I.G.z - 0.45 * Math.cos(I.G.yaw), 1.0, dt); if (I.cuffT > 1.0) secCuffs(I, true);
      return I.cuffT > 2.0; } },
  { id: 'escort', run: (I, dt) => {
      if (I.say) { /* talking as they walk */ } else if (I.queue.length) secSay(I, I.queue.shift());
      const R = LoungeRoom, door = R.A.door || { x: 0, z: 0 }, G = I.G;
      const done = secWalk(G, door.x, door.z, 0.75, dt);   // the guest walks (led), one officer behind holding them, the other alongside
      const bx = G.x - 0.5 * Math.sin(G.yaw), bz = G.z - 0.5 * Math.cos(G.yaw);
      secWalk(I.lead, bx, bz, 0.95, dt); secWalk(I.side, G.x + 0.65 * Math.cos(G.yaw), G.z - 0.65 * Math.sin(G.yaw), 0.95, dt);
      for (const o of [I.g1, I.g2]) if (I.cops && o !== I.lead && o !== I.side) secWalk(o, door.x, door.z, 0.9, dt);
      return done && !I.say && !I.queue.length; } },
  { id: 'gone', run: (I) => { secEnd(I); return true; } },
];
/** Each frame while it lasts. */
function secIncStep(dt: number, now: number) {
  const R = LoungeRoom, I = R.inc; if (!I) return;
  if (!secOn()) { secEnd(I); return; }   // paused: the scene ends, nothing is lost
  const S = SEC_STEPS[I.step]; if (!S) { secEnd(I); return; }
  if (S.id === 'talk' && I.gaveIn && !I.say && !I.queue.length) { I.step = SEC_STEPS.findIndex(s => s.id === 'gaveIn'); }
  else if (S.run(I, dt, now)) { if (S.id === 'tase') I.step = SEC_STEPS.findIndex(s => s.id === 'run'); else if (S.id === 'run') I.step = SEC_STEPS.findIndex(s => s.id === 'cuff'); else if (S.id === 'cuff') I.step = SEC_STEPS.findIndex(s => s.id === 'lift'); else if (S.id === 'cuffStanding' || S.id === 'gaveIn') I.step = SEC_STEPS.findIndex(s => s.id === 'escort'); else I.step++; }
  if (!R.inc) return;
  secSayStep(I, now);
  secPoseAll(I, dt, now);
}
function secWalk(o: any, x: number, z: number, v: number, dt: number): boolean {
  const dx = x - o.x, dz = z - o.z, d = Math.hypot(dx, dz); if (d < 0.08) { o.v = Math.max(0, (o.v || 0) - dt * 4); return true; }
  const h = Math.atan2(dx, dz), s = Math.min(d, v * dt); o.x += Math.sin(h) * s; o.z += Math.cos(h) * s; o.yaw += angDiffRad(o.yaw, h) * Math.min(1, dt * 7); o.v = v; o.dist = (o.dist || 0) + s; return false;
}
function secFace(o: any, x: number, z: number, dt: number) { o.yaw += angDiffRad(o.yaw, Math.atan2(x - o.x, z - o.z)) * Math.min(1, dt * 5); }

/* ---------- speaking: one at a time, the game's own voices ---------- */
function secWho(I: any, who: string): any { return who === 'guest' ? { name: I.G.P.name, sex: I.sex, a: I.G } : who === 'side' ? I.side : I.lead; }
function secVoice(I: any, line: any): string { const p = secWho(I, line.who); return `pax|${p.sex || (p.look && p.look.sex) || 'm'}|${line.mood || 'neutral'}|${p.name}`; }
function secSay(I: any, line: any) {
  const who = secVoice(I, line); I.say = { line, who, at: Date.now(), until: performance.now() + Math.max(1600, line.text.length * 62) };
  secCaption(secWho(I, line.who).name, line.text, line.who);
  const on = (State.settings as any).mechanicVoice !== false;
  if (on) { try { Voice.stop(); Voice.speak(line.text, () => { if (I.say && I.say.who === who) I.say.until = performance.now() + 250; }, who); I.say.until = performance.now() + 20000; } catch (e) { /* text only */ } }
  // a cut-in: the guest shouts over the officer part-way through
  if (line.cut) I.say.cutAt = performance.now() + Math.max(900, line.text.length * 62 * 0.45);
}
function secSayNow(I: any, line: any) { try { Voice.stop(); } catch (e) { /* quiet */ } I.say = null; secSay(I, line); }
function secSayStep(I: any, now: number) {
  const s = I.say; if (!s) return; const t = performance.now();
  if (s.cutAt && t >= s.cutAt) { s.cutAt = 0; const nx = I.queue.shift(); if (nx) { secSayNow(I, nx); return; } }
  if (t >= s.until) { I.say = null; secCaption('', '', ''); }
}
/** The words on screen too (and only there when voices are off): small, at the bottom. */
function secCaption(who: string, text: string, kind: string) {
  const R = LoungeRoom; if (!R.root) return; let el = R.root.querySelector('.sec-say') as HTMLElement;
  if (!text) { if (el) el.hidden = true; return; }
  if (!el) { el = document.createElement('div'); el.className = 'sec-say'; R.root.appendChild(el); }
  el.hidden = false; el.className = 'sec-say ' + (kind === 'guest' ? 'guest' : 'officer'); el.innerHTML = `<b>${esc(who)}</b><span>${esc(text)}</span>`;
}
/** If the voice pack isn't ready, the device's own voice speaks; a small note says why (once). */
function secVoiceNotice() {
  const S: any = secVoiceNotice; if (S.done) return;
  try { if (!Voice.natural() && (State.settings as any).mechanicVoice !== false) { S.done = true; const st = (VoicePack as any).state; toast(st === 'loading' || st === 'downloading' ? 'Voices are still downloading: the device\'s own voice speaks for now' : 'The voices couldn\'t be downloaded: the device\'s own voice speaks', 'info'); } } catch (e) { /* quiet */ }
}

/* ---------- the taser, the fall, the cuffs ---------- */
function secZap() {
  try { const a: any = (Sound as any).ctx ? (Sound as any).ctx() : new ((window as any).AudioContext || (window as any).webkitAudioContext)(); const n = a.createBufferSource(), b = a.createBuffer(1, a.sampleRate * 0.9, a.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (0.35 + 0.65 * (Math.sin(i / a.sampleRate * 2 * Math.PI * 22) > 0 ? 1 : 0.2)) * Math.max(0, 1 - i / d.length);
    n.buffer = b; const g = a.createGain(); g.gain.value = 0.25; n.connect(g); g.connect(a.destination); n.start(); } catch (e) { /* quiet */ }
}
function secTaserMesh(): any {
  const T = THREE, g = new T.Group(); g.name = 'taser';
  const body = new T.Mesh(new T.BoxGeometry(0.035, 0.05, 0.16), new T.MeshStandardMaterial({ color: 0xF2C230, roughness: 0.5 })); body.position.z = 0.04; g.add(body);
  const grip = new T.Mesh(new T.BoxGeometry(0.03, 0.09, 0.04), new T.MeshStandardMaterial({ color: 0x1A1A1C, roughness: 0.6 })); grip.position.set(0, -0.05, -0.02); grip.rotation.x = 0.25; g.add(grip);
  try { Models.swap(g, 'security-props/taser.glb', false); } catch (e) { /* the app's own */ }
  return g;
}
function secWires(I: any, on: boolean) {
  const T = THREE, R = LoungeRoom;
  if (!on) { if (I.wires) { R.A.root.remove(I.wires); I.wires = null; } return; }
  if (!I.taser) return;
  const a = R.A.root.worldToLocal(I.taser.getWorldPosition(new T.Vector3())), b = new T.Vector3(I.G.x, 1.1 - (I.fall ? Math.min(1, I.fall.t * 2) * 0.8 : 0), I.G.z);
  if (!I.wires) { I.wires = new T.Group(); for (const dy of [-0.06, 0.06]) { const geo = new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3()]); const l = new T.Line(geo, new T.LineBasicMaterial({ color: 0xDDE4EA })); l.userData.dy = dy; I.wires.add(l); } R.A.root.add(I.wires); }
  for (const l of I.wires.children) { const P = l.geometry.attributes.position; P.setXYZ(0, a.x, a.y, a.z); P.setXYZ(1, b.x, b.y + l.userData.dy, b.z); P.needsUpdate = true; }
}
function secCuffs(I: any, on: boolean) {
  const T = THREE, R = LoungeRoom;
  if (on && !I.cuffs) { const g = new T.Group(); g.name = 'handcuffs'; const m = new T.MeshStandardMaterial({ color: 0xC7CCD2, metalness: 0.9, roughness: 0.25 });
    for (const s of [-1, 1]) { const r = new T.Mesh(new T.TorusGeometry(0.03, 0.006, 8, 18), m); r.position.x = s * 0.045; g.add(r); }
    const ch = new T.Mesh(new T.CylinderGeometry(0.004, 0.004, 0.06, 6), m); ch.rotation.z = Math.PI / 2; g.add(ch);
    try { Models.swap(g, 'security-props/handcuffs.glb', false); } catch (e) { /* the app's own */ }
    R.A.root.add(g); I.cuffs = g; try { hgSnd('put'); } catch (e) { /* quiet */ } }
}
/** Pose everyone: walking, talking, the taser aimed, the guest falling and shaking, hands cuffed behind the back. */
function secPoseAll(I: any, dt: number, now: number) {
  const T = THREE, R = LoungeRoom, G = I.G, top = (m: any) => m.top || 1.75;
  const talkOf = (o: any, key: string) => { const s = I.say; return s && s.line && secWho(I, s.line.who) === o ? humanTalk(s.who, s.line.text, s.at) : 0; };
  for (const o of [I.g1, I.g2].concat(I.cops || [])) {
    if (!o) continue; o.pivot.position.set(o.x, 0, o.z); o.pivot.rotation.y = o.yaw;
    let g = humanGesture(null, now + (o === I.g2 ? 2 : 0));
    if (o.v > 0.1) { g = cabinLerpG(g, humanWalk(o.dist / 1.25, { v: Math.min(1.6, o.v), seed: o.name }), Math.min(1, o.v / 0.6)); }
    const isLead = o === I.lead, cuffing = isLead && (I.kneel || 0) > 0;
    if (isLead && I.taserOut && !I.cuffs) {   // the taser in the right hand, aimed at the guest
      o.m.root.updateMatrixWorld(true); const J = o.m.joints.R;
      const tgt = R.A.root.localToWorld(new T.Vector3(G.x, (I.fall ? 0.4 : 1.1), G.z)), loc = o.m.root.worldToLocal(tgt), sh = J.s.clone(), dir = loc.sub(sh).normalize().multiplyScalar(0.62).add(sh);
      o.armR = humanReach(o.m, 'R', dir, o.armR || [0.6, 0.1, 0, 0.3]); g.R = o.armR;
      if (!I.taser) { I.taser = secTaserMesh(); R.A.root.add(I.taser); }
    }
    if (cuffing) { g.lean = (g.lean || 0) + 0.55 * I.kneel; g.legs = g.legs ? g.legs.map((v: number, i: number) => v + [-0.9, 1.6, -0.3, 0.6][i] * I.kneel) : g.legs; g.L = [1.1 * I.kneel, 0.1, 0, 0.6]; g.R = [1.1 * I.kneel, 0.1, 0, 0.6]; }
    if (I.cuffs && (o === I.lead) && !cuffing && I.step >= SEC_STEPS.findIndex(s => s.id === 'escort')) { g.L = [0.8, 0.05, 0.05, 0.9]; g.R = [0.8, 0.05, 0.05, 0.9]; }   // holding them from behind
    if (o === I.side && I.radioed && !I.cops) { g.L = [0.9, 0.2, 0.1, 2.0]; }   // the radio to the mouth
    try { o.m.pose({ t: now, yaw: 0, gaze: [0, 0], blink: (now % 3.7) < 0.12 ? 1 : 0, g, talk: talkOf(o, '') }); } catch (e) { /* still */ }
    if (isLead && I.taser && o.armR) { o.m.root.updateMatrixWorld(true); const h = R.A.root.worldToLocal(o.m.root.localToWorld(humanHandAt(o.m, 'R', o.armR, undefined, o.m.joints.R.palm))); I.taser.position.copy(h); I.taser.rotation.set(0, o.yaw, 0); I.taser.visible = !I.cuffs; }
  }
  // the guest: standing, falling, on the floor shaking, lifted, led out with the hands behind the back
  const F = I.fall;
  if (F) {
    F.t += dt; const lifting = I.liftT ? Math.min(1, I.liftT / 1.2) : 0, k0 = Math.min(1, F.t / 0.55), k = (k0 * k0) * (1 - lifting);   // falling like a person: quick, gathering speed
    const shake = !I.cuffs || (I.cuffT || 0) < 0.9 ? (F.t > 0.55 ? 0.04 : 0) * Math.sin(now * 41) * Math.max(0, 1 - (F.t - 0.55) / 6) : 0;
    G.pivot.rotation.order = 'YXZ'; G.pivot.rotation.x = F.dir * 1.45 * k + shake; G.pivot.rotation.z = F.side * 0.55 * k + shake * 0.6;
    if (lifting >= 1) { I.fall = null; G.pivot.rotation.x = 0; G.pivot.rotation.z = 0; }
  }
  G.pivot.position.set(G.x, 0, G.z); G.pivot.rotation.y = G.yaw;
  let gg = humanGesture(null, now + 3); if ((G.v || 0) > 0.1) gg = cabinLerpG(gg, humanWalk((G.dist || 0) / 1.25, { v: 0.7, seed: G.P.name }), 0.9);
  if (I.plan.temper === 'angry' && !I.fall && !I.cuffs && I.say && I.say.line.who === 'guest') { gg.R = [0.9, 0.3, 0.2, 0.6 + 0.4 * Math.sin(now * 6)]; gg.shake = (gg.shake || 0) + 0.15 * Math.sin(now * 4); }   // shouting, a hand in the air
  if (I.cuffs) { const m = G.m; m.root.updateMatrixWorld(true); const J = m.joints, t = top(m);
    G.armL = humanReach(m, 'L', new T.Vector3(J.L.s.x * 0.15, t * 0.5, -0.16), G.armL || [-0.4, 0.1, 0, 0.6]); G.armR = humanReach(m, 'R', new T.Vector3(J.R.s.x * 0.15, t * 0.5, -0.16), G.armR || [-0.4, 0.1, 0, 0.6]); gg.L = G.armL; gg.R = G.armR; }
  if (F && F.t > 0.55 && !I.cuffs) { gg.L = [0.4 + 0.2 * Math.sin(now * 37), 0.4, 0.1, 0.8]; gg.R = [0.4 + 0.2 * Math.sin(now * 31), 0.4, 0.1, 0.8]; }   // stiff and twitching
  try { G.m.pose({ t: now, yaw: 0, gaze: [0, 0], blink: 0, g: gg, talk: talkOf(G, 'guest') }); } catch (e) { /* still */ }
  if (I.cuffs) { const m = G.m; m.root.updateMatrixWorld(true); const hl = humanHandAt(m, 'L', G.armL, undefined, m.joints.L.palm), hr = humanHandAt(m, 'R', G.armR, undefined, m.joints.R.palm), mid = hl.clone().add(hr).multiplyScalar(0.5);
    I.cuffs.position.copy(R.A.root.worldToLocal(m.root.localToWorld(mid))); I.cuffs.rotation.set(0, G.yaw, 0); }
}
/** The end: everyone gone out of the doors; the officers' records. */
function secEnd(I: any) {
  const R = LoungeRoom; try { Voice.stop(); } catch (e) { /* quiet */ }
  for (const o of [I.g1, I.g2].concat(I.cops || [])) if (o) try { R.A.root.remove(o.pivot); } catch (e) { /* gone */ }
  for (const x of [I.taser, I.cuffs, I.wires]) if (x) try { R.A.root.remove(x); } catch (e) { /* gone */ }
  try { R.A.root.remove(I.G.pivot); } catch (e) { /* gone */ } I.G.gone = true;
  secCaption('', '', ''); R.inc = null;
}

ACTIONS['sec-rule'] = el => { const k = el.getAttribute('data-k') || '', S: any = State, R = S.secRules || (S.secRules = {}); if (k === 'taser') R.taser = !secRule('taser'); Store.save(); Sound.tick(); refresh(); };
