/* The cabin crew in the Cabin view: three of your airline's own flight attendants and the flight's captain,
 * as the same detailed figures as the crew pictures in the app.
 *
 *  - Seats: two jump seats at the front galley and two at the back. For every take-off, landing and spell
 *    of severe turbulence the attendants take a seat, chosen afresh each time; they walk there and sit down.
 *  - Boarding: the attendants welcome the passengers and help along the aisle; the captain greets them at
 *    the front galley.
 *  - Cruise only: a while after reaching the cruising level two attendants bring the trolley down the aisle,
 *    stopping at each row with passengers. They look at the people there and talk with them; the passengers
 *    answer, in their own mood (Passenger list), and what the flight brought (a catering shortfall, a rude
 *    or shouting attendant from the conduct reports, a drunk passenger you let on) shows in what is said and
 *    how. Then the trolley goes back to the galley. The third attendant walks the cabin now and then, and the
 *    captain sometimes comes out to the galley for a moment.
 *  - From the start of the descent the service stops, the trolley goes back, and the crew sit down well
 *    before landing.
 *  - Tap anyone talking (a speech mark shows above them), any crew member, or a passenger: what they said is
 *    shown, with a play button to hear it.
 * Walking is smooth: the steps follow the distance walked (no sliding), people speed up and slow down, turn
 * gradually, and sit down and stand up in one easy movement. */

interface CrewMember {
  m: any; holder: any; role: 'fa' | 'captain'; person: any;
  x: number; side: number; v: number; dist: number; yaw: number; yawT: number; sitK: number; g: any;
  want: { x: number; side: number; face: number; sit: number[] | null; mood: any }; hidden: boolean; t0: number; talkTo?: any;
}
interface TalkLine { who: string; name: string; role: 'fa' | 'pax' | 'captain'; text: string; mood: string; voice: string; at: number }

const CabinCrew: any = {
  key: '', members: [] as CrewMember[], trolley: null as any, light: null as any, grp: null as any, loading: false, last: 0, seats: [] as number[][],
  svc: {} as { [flight: string]: any },
  talk: { log: {} as { [person: string]: TalkLine[] }, live: [] as { key: string; until: number; pos: () => any }[] },
};

/* ---------- the crew, their seats and the trolley ---------- */
function cabinCrewEnsure(P: any, G: any): boolean {
  const C = CabinCrew, at = G.userData.crewAt; if (!at) return false;
  const f = State.live.filter(x => x.id === P.id)[0] || null, key = P.id + '|' + (f ? f.pilotId : '') + '|' + cabinQ();
  if (C.key === key && C.grp && C.grp.parent === G) return true;
  if (C.loading) return false;
  if (!Human.ready) { C.loading = true; Human.load().then(() => { C.loading = false; }, () => { C.loading = false; }); return false; }
  cabinCrewFree();
  const T = THREE, g = new T.Group(); C.grp = g; C.key = key; G.add(g);
  const co = company(), accent = co.color || '#2C8CFF', style = av3Style(), q = cabinQ() === 3 ? 1 : cabinIsPc() ? [0.45, 0.6, 0.8][cabinQ()] : [0.35, 0.4, 0.5][cabinQ()];   // Ultra: the full figures
  C.light = new T.HemisphereLight(0xFFFFFF, 0x6E747C, 1.0); g.add(C.light);
  // the seats: front left and right (facing the cabin), back left and right (facing forward)
  const fx = at.x0 + 0.45, bx = at.x1 - 0.4;   // the back seats' backrests stay inside the rear wall
  C.seats = [[fx, -0.34, 1], [fx, 0.34, 1], [bx, -0.34, -1], [bx, 0.34, -1]];
  const seatMat = cabinMat(0x3A3E46, { map: cabinLeatherTex() });
  for (const s of C.seats) {
    const d = s[2]; const c = new T.Mesh(new T.BoxGeometry(0.4, 0.08, 0.42), seatMat); c.position.copy(_av(s[0] - d * 0.02, s[1], at.zf + 0.45)); g.add(c);
    const b = new T.Mesh(new T.BoxGeometry(0.06, 0.6, 0.42), seatMat); b.position.copy(_av(s[0] - d * 0.24, s[1], at.zf + 0.76)); g.add(b);
  }
  // your own flight attendants (picked for this flight), the flight's own captain
  // the cabin crew of this aircraft: your own hired flight attendants, looking as they do in Crew (up to three
  // shown); the captain is the flight's own pilot
  const chosen: any[] = (f ? planeCabinCrew(f.reg) : []).slice(0, 3);
  const pl = f ? pilot(f.pilotId) : null, cap = pl && pl.look ? pl : makePerson(P.id + ':capt', 'captain', co.id, '', 'm');
  const mk = (person: any, role: 'fa' | 'captain'): CrewMember => {
    const L = Object.assign({}, person.look); if (role === 'fa') L.bottom = 'trousers';   // trousers: the legs move freely
    const m = Human.build(L, role, accent, style, q), holder = new T.Group(); holder.add(m.root); g.add(holder);
    m.root.traverse((o: any) => { o.frustumCulled = false; o.renderOrder = 41; });
    return { m, holder, role, person, x: fx, side: 0, v: 0, dist: 0, yaw: Math.PI / 2, yawT: Math.PI / 2, sitK: 0, g: null, want: { x: fx, side: 0, face: 1, sit: null, mood: null }, hidden: false, t0: Math.random() * 10 };
  };
  for (const p of chosen) C.members.push(mk(p, 'fa'));
  C.nFa = chosen.length;
  const c = mk(cap, 'captain'); c.hidden = true; c.x = at.x0 - 0.2; C.members.push(c);
  // they start in their seats
  const seats0 = cabinSeatPlan(P.id, 0);
  C.members.slice(0, 3).forEach((m: CrewMember, i: number) => { const s = C.seats[seats0[i]]; m.x = s[0]; m.side = s[1]; m.sitK = 1; m.yaw = m.yawT = s[2] > 0 ? Math.PI / 2 : -Math.PI / 2; m.want = { x: s[0], side: s[1], face: s[2], sit: s, mood: null }; });
  C.trolley = cabinTrolley(); C.trolley.visible = false; g.add(C.trolley);
  return true;
}
/** Which jump seat each attendant takes this time (a new draw for each take-off, landing or turbulence). */
function cabinSeatPlan(id: string, n: number): number[] {
  const r = seeded('seats:' + id + ':' + n), s = [0, 1, 2, 3];
  for (let i = 3; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = s[i]; s[i] = s[j]; s[j] = t; }
  return s.slice(0, 3);
}

/** The trolley: a metal cart with doors at both ends, drinks and snacks on top. */
function cabinTrolley(): any {
  const T = THREE, g = new T.Group();
  const metal = cabinMat(0xB8BEC6, { map: cabinSatinTex() }), dark = cabinMat(0x4A4F57), red = cabinMat(0xC23B3B);
  const body = new T.Mesh(new T.BoxGeometry(0.84, 0.98, 0.3), metal); body.position.y = 0.52; g.add(body);
  for (const e of [-1, 1]) {
    const door = new T.Mesh(new T.BoxGeometry(0.012, 0.9, 0.27), cabinMat(0xA9AFB7, { map: cabinSatinTex() })); door.position.set(e * 0.426, 0.52, 0); g.add(door);
    const handle = new T.Mesh(new T.BoxGeometry(0.03, 0.03, 0.26), dark); handle.position.set(e * 0.44, 0.96, 0); g.add(handle);
    const brake = new T.Mesh(new T.BoxGeometry(0.05, 0.02, 0.08), e < 0 ? red : cabinMat(0x2E8B57)); brake.position.set(e * 0.39, 0.035, 0); g.add(brake);
  }
  for (const [x, z] of [[-0.36, -0.11], [-0.36, 0.11], [0.36, -0.11], [0.36, 0.11]]) { const w = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 0.025, 12), dark); w.rotation.x = Math.PI / 2; w.position.set(x, 0.03, z); g.add(w); }
  const tray = new T.Mesh(new T.BoxGeometry(0.7, 0.015, 0.26), dark); tray.position.y = 1.02; g.add(tray);
  const cols = [0x2F7D32, 0xD9D3C5, 0xB22222, 0x1F4E8C, 0xE8A317, 0xF4F4F4];
  for (let i = 0; i < 9; i++) {
    const tall = i % 3 === 0, c = new T.Mesh(new T.CylinderGeometry(tall ? 0.03 : 0.028, tall ? 0.034 : 0.028, tall ? 0.24 : 0.12, 12), cabinMat(cols[i % cols.length]));
    c.position.set(-0.28 + (i % 5) * 0.12, 1.03 + (tall ? 0.12 : 0.06), i < 5 ? -0.06 : 0.07); g.add(c);
  }
  const cups = new T.Mesh(new T.CylinderGeometry(0.036, 0.03, 0.22, 14), cabinMat(0xF6F6F2)); cups.position.set(0.3, 1.14, 0.06); g.add(cups);
  g.traverse((o: any) => { o.renderOrder = 41; });
  return g;
}

/* ---------- what is said ---------- */
/** How far someone's mouth is open now, from the last thing they said (the cabin's talk log). */
function cabinTalkJaw(key: string): any {
  const L = CabinCrew.talk.log[key]; if (!L || !L.length) return 0;
  const ln = L[L.length - 1];
  // their line played as a voice (Hear): the mouth follows it, again each time it is played
  for (let i = L.length - 1; i >= 0; i--) if (humanVoiceBusy(L[i].voice)) return humanTalk(L[i].voice);   // still until the voice is heard, then with it
  return Date.now() - ln.at < 20000 ? humanSpeech(ln.text, ln.at) : 0;
}
function cabinSay(key: string, line: TalkLine, pos: () => any) {
  const T = CabinCrew.talk, L = T.log[key] = T.log[key] || [];
  L.push(line); if (L.length > 6) L.shift();
  T.live = T.live.filter((x: any) => x.key !== key); T.live.push({ key, until: Date.now() + 5500, pos });
  try { Voice.prepare(line.text, line.voice); } catch (e) { /* voices not ready */ }
}
/** A short exchange at a row: the attendant offers, a passenger answers (in their mood and the flight's story). */
function cabinExchange(P: any, m: CrewMember, row: number, sideSign: number, rude: boolean): any {
  const G = V3dCabinF.grp, pg = G && G.userData.people, f: any = State.live.filter(x => x.id === P.id)[0] || null;
  if (!pg || !f || !m || !m.holder) return;
  const list = (pg.userData.who as any[]).filter(w => parseInt(w.p.seat, 10) === row && Math.sign(w.seatY - G.userData.crewAt.aisleY) === sideSign);
  if (!list.length) return;
  const r = seeded(P.id + ':' + row + ':' + sideSign), w = list[Math.floor(r() * list.length)], p = w.p;
  const all = pg.userData.who.map((x: any) => x.p);
  let mood = 60; try { mood = paxMood(f, p, all).mood; } catch (e) { /* default */ }
  const evs: any[] = (() => { try { return moodEvents(f, all); } catch (e) { return []; } })();
  const shouted = evs.some((e: any) => e.who === p.key), drunk = f.you && PaxLeg.incident && cabinDrunkKey(all) === p.key;
  const night = (V3dSky as any).U ? (V3dSky as any).U.uNight.value > 0.5 : false, kid = p.age < 12, longHaul = (acType(flightTypeId(f)) || { seats: 150 }).seats > 250;
  const short = f.catShort;
  let offer: string, reply: string, faMood = 'neutral', pMood = mood >= 40 ? 'neutral' : 'angry';
  if (drunk) { offer = 'I\'m sorry, I can\'t serve you any more alcohol. Please stay in your seat with your seat belt on.'; reply = 'Oh come on, just one more glass of wine! I\'m on holiday!'; pMood = 'drunk'; }
  else if (shouted || rude) { offer = shouted ? 'Sit back and wait your turn! I\'ll get to you when I get to you.' : 'Drinks. What do you want?'; reply = shouted ? 'Excuse me? There\'s no need to talk to me like that.' : 'Wow. Some water, I suppose.'; faMood = shouted ? 'angry' : 'neutral'; pMood = shouted ? 'angry' : 'neutral'; }
  else if (short === 'hot' && longHaul) { offer = 'I\'m so sorry, we\'ve run out of hot meals on this flight. Can I offer you a sandwich instead?'; reply = mood >= 50 ? 'Oh, that\'s a shame. A sandwich is fine, thank you.' : 'You\'re joking. I paid for a meal.'; }
  else if (short) { offer = 'I\'m afraid we\'re short on a few things today. Can I get you a coffee, tea or some water?'; reply = mood >= 50 ? 'Water is fine, thanks.' : 'Seriously? Fine. Water.'; }
  else {
    const offers = night ? ['Would you like some water, or a blanket for the night?', 'Something to drink before you rest? We have water, juice and tea.']
      : longHaul ? ['Good afternoon! For dinner we have chicken with rice or pasta with tomato sauce. What would you like?', 'Can I offer you something to drink with your meal? We have wine, beer, juices and soft drinks.']
      : ['Hello! Can I offer you something to drink? We have coffee, tea, juices and soft drinks.', 'Would you like a snack? We have sandwiches, crisps and biscuits.', 'Something to drink for you? Coffee, tea, water or a soft drink?'];
    offer = offers[Math.floor(r() * offers.length)];
    const happy = ['A coffee, please. Black. Thank you!', 'Orange juice, please. Thanks so much!', 'The chicken, please. That sounds lovely.', 'Tea with milk, please. Thank you!'];
    const neutral = ['Just water, thanks.', 'A cola, please.', 'The pasta, please.', 'Nothing for me, thanks.'];
    const upset = ['Finally. We\'ve been waiting ages back here.', 'Is that all there is? Water, then.', 'No. And could someone turn the air down? It\'s freezing.'];
    reply = kid ? 'Apple juice, please!' : p.pet && p.pet.where === 'cabin' ? `Just water, please, and could ${p.pet.name || 'my pet'} have a little too?` : mood >= 65 ? happy[Math.floor(r() * happy.length)] : mood >= 40 ? neutral[Math.floor(r() * neutral.length)] : upset[Math.floor(r() * upset.length)];
  }
  const faKey = 'crew:' + m.person.name, paxKey = 'pax:' + p.key;
  const headPos = () => m.holder.localToWorld(new THREE.Vector3(0, (m.m.top || 1.7) + 0.12, 0));
  const paxPos = () => G.localToWorld(w.head.clone().add(new THREE.Vector3(0, 0.25, 0)));
  cabinSay(faKey, { who: faKey, name: m.person.name, role: 'fa', text: offer, mood: faMood, voice: personWho('gate', m.person, faMood), at: Date.now() }, headPos);
  setTimeout(() => {
    if (!V3dCabinF.grp) return;
    cabinSay(paxKey, { who: paxKey, name: p.name || 'Passenger', role: 'pax', text: reply, mood: pMood, voice: personWho('pax', p, pMood), at: Date.now() }, paxPos);
    CabinCrew.talkHead = { w, until: Date.now() + 4000, sign: -sideSign };
  }, 2200);
  m.talkTo = { sign: sideSign, until: Date.now() + 4200, faMood };
  // what they are handed: nothing if they said no (or were refused), a meal tray for food, a cup for a drink
  const kind = drunk || /nothing for me|^no\b/i.test(reply) ? 'none' : /meal|chicken|pasta|sandwich|snack|crisps|biscuit|dinner/i.test(reply + ' ' + (/sandwich|snack/i.test(offer) && !/water|coffee|tea|juice|cola/i.test(reply) ? offer : '')) ? 'tray' : 'cup';
  return { kind, w, sign: sideSign };
}
/** What is handed over: a cup (with coffee, tea, juice, water or cola, as asked) or a meal tray. */
function cabinItem(kind: string, reply: string): any {
  const T = THREE, g = new T.Group();
  if (kind === 'tray') {
    const tray = new T.Mesh(new T.BoxGeometry(0.3, 0.012, 0.22), cabinMat(0x3C4048)); g.add(tray);
    const dish = new T.Mesh(new T.BoxGeometry(0.15, 0.035, 0.11), cabinMat(0xEDEBE6)); dish.position.set(-0.05, 0.024, 0); g.add(dish);
    const foil = new T.Mesh(new T.BoxGeometry(0.14, 0.004, 0.1), cabinMat(0xC8CCD2, { map: cabinSatinTex() })); foil.position.set(-0.05, 0.043, 0); g.add(foil);
    const bread = new T.Mesh(new T.SphereGeometry(0.025, 10, 8), cabinMat(0xC98E4A)); bread.scale.y = 0.7; bread.position.set(0.09, 0.022, -0.05); g.add(bread);
    const cup = new T.Mesh(new T.CylinderGeometry(0.022, 0.018, 0.06, 12), cabinMat(0xF6F6F2)); cup.position.set(0.09, 0.036, 0.05); g.add(cup);
    const nap = new T.Mesh(new T.BoxGeometry(0.05, 0.004, 0.12), cabinMat(0xF2EFE8)); nap.position.set(0.04, 0.009, 0); g.add(nap);
  } else {
    const col = /coffee/i.test(reply) ? 0x3B2414 : /tea/i.test(reply) ? 0x8A5A2B : /orange|apple|juice/i.test(reply) ? 0xF0A020 : /cola/i.test(reply) ? 0x2A140C : /wine/i.test(reply) ? 0x7A1020 : 0xCFE3F0;
    const cup = new T.Mesh(new T.CylinderGeometry(0.03, 0.023, 0.09, 14, 1, true), cabinMat(0xF8F8F5, { side: T.DoubleSide })); cup.position.y = 0.045; g.add(cup);
    const drink = new T.Mesh(new T.CircleGeometry(0.028, 14), cabinMat(col)); drink.rotation.x = -Math.PI / 2; drink.position.y = 0.075; g.add(drink);
    const nap = new T.Mesh(new T.BoxGeometry(0.09, 0.003, 0.09), cabinMat(0xF2EFE8)); g.add(nap);
  }
  g.traverse((o: any) => { o.renderOrder = 41; o.castShadow = false; });
  return g;
}
/** The drunk passenger you let on (your own flight): someone in the back half of the cabin. */
function cabinDrunkKey(all: any[]): string { const back = all.filter((p: any) => parseInt(p.seat, 10) > 8), L = back.length ? back : all; const x = L[Math.floor(L.length * 0.37)]; return x ? x.key : ''; }

/* ---------- each frame ---------- */
function cabinCrewStep(P: any, G: any, night: number) {
  if (!cabinCrewEnsure(P, G)) return;
  const C = CabinCrew, at = G.userData.crewAt, now = performance.now() / 1000, dt = Math.min(0.1, Math.max(0, now - (C.last || now))); C.last = now;
  const ph = String(P.ph || ''), turb = (P._tk || 0) > 0.55;
  const stage = /board|gate|park/.test(ph) ? 'board' : /cruise/.test(ph) ? 'cruise' : /descent|approach|final|landing|roll|touchdown|arriv/.test(ph) ? 'down' : 'seated';
  const seatedNow = stage === 'seated' || stage === 'down' || turb;
  const S = C.svc[P.id] = C.svc[P.id] || { cruiseAt: 0, round: 0, state: 'idle', x: at.x0 + 1.45, row: 0, stopUntil: 0, nextWalk: now + 25, nextCapt: now + 60, captUntil: 0, episode: 0, wasSeated: true, calmAt: 0, walk: null, talkedRow: false };
  if (seatedNow && !S.wasSeated) S.episode++;   // a new take-off, landing or turbulence: seats drawn afresh
  S.wasSeated = seatedNow;
  if (stage === 'cruise' && !S.cruiseAt) S.cruiseAt = now;
  if (stage !== 'cruise') S.cruiseAt = 0;
  if (turb) S.calmAt = now;
  const fas = (C.members as CrewMember[]).filter(m => m.role === 'fa'), cap = (C.members as CrewMember[]).filter(m => m.role === 'captain')[0];
  const none: any = { want: {}, x: 0, v: 0, sitK: 0, person: {} }, fa1 = fas[0] || none, fa2 = fas[1] || none, fa3 = fas[2] || none;
  const aisle = at.aisleY, front = at.x0 + 0.45;
  const rows: number[] = at.paxRows.filter((r: number) => at.rowX[r] != null && at.rowX[r] < at.x1 - 1.4);
  const lastX = rows.length ? at.rowX[rows[rows.length - 1]] + 0.3 : at.x0 + 3;
  const plan = cabinSeatPlan(P.id, S.episode);
  const goSit = (m: CrewMember, i: number) => { const s = C.seats[plan[i]]; m.want = { x: s[0], side: s[1], face: s[2], sit: s, mood: null }; };
  const goStand = (m: CrewMember, x: number, side: number, face: number, mood?: any) => { m.want = { x, side, face, sit: null, mood: mood || null }; };

  // the trolley service: cruise only, calm air only; it stops at the start of the descent
  const calm = !turb && now - (S.calmAt || 0) > 15;
  if (stage === 'cruise' && calm) {
    if (S.state === 'idle' && fas.length && now - S.cruiseAt > 20 && S.round < 2 && (S.round === 0 || now - S.cruiseAt > 1500)) { S.state = 'out'; S.x = front + 1.0; S.row = 0; S.round++; }
    if (S.state === 'held') S.state = 'out';
  } else if (stage === 'cruise' && turb && (S.state === 'out' || S.state === 'stop')) S.state = 'held';   // brakes on, everyone sits
  else if (stage !== 'cruise' && S.state !== 'idle') S.state = 'back';
  if (S.state === 'out' || S.state === 'stop') {
    const r = rows[S.row];
    if (r == null) S.state = 'back';
    else {
      const rx = at.rowX[r] + 0.1;
      if (S.state === 'out') { const d = rx - S.x; S.x += Math.min(d, dt * Math.min(0.42, 0.25 + d)); if (rx - S.x < 0.01) { S.state = 'stop'; S.stopUntil = S.stopBase = now + 6.5; S.talkedRow = false; S.hands = []; } }
      else {
        if (!S.talkedRow) {
          S.talkedRow = true;
          const inc: any[] = (State as any).incidents || [], rudeOf = (m: CrewMember) => inc.some((i: any) => i.status === 'open' && /Rude to a passenger/.test(i.title) && i.staffId === (m.person && m.person.id));
          // each attendant asks their side; the answer comes, then what was asked for is handed over
          const ask = (m: CrewMember, sign: number, delay: number) => {
            const go = () => { if (!V3dCabinF.grp || S.state !== 'stop') return; const h = cabinExchange(P, m, r, sign, rudeOf(m)); if (h && h.kind !== 'none') S.hands.push({ m, h, at: performance.now() / 1000 + 3.0, t: -1 }); };
            if (delay) { S.hands.push({ wait: true, at: now + delay / 1000 + 0.5 }); setTimeout(go, delay); } else go();
          };
          if (fas[0]) ask(fa1, (S.row % 2) ? 1 : -1, 0);
          if (fas[1]) ask(fa2, (S.row % 2) ? -1 : 1, 3200);
        }
        // the hand-over: from the attendant's hands to the passenger's tray table, in a second and a half
        let busyTill = 0;
        for (const H of S.hands || []) {
          if (H.wait) { if (now < H.at) busyTill = Math.max(busyTill, now + 1); continue; }   // the second attendant is still to ask
          if (now < H.at) { busyTill = Math.max(busyTill, H.at + 10.5); continue; }   // handed over soon, then 9 s
          const m: CrewMember = H.m, w = H.h.w;
          if (H.t < 0) {
            H.t = 0; const line = ((CabinCrew.talk.log['pax:' + w.p.key] || []).slice(-1)[0] || { text: '' }).text;
            H.item = cabinItem(H.h.kind, line); C.grp.add(H.item); (C.items = C.items || []).push(H.item); if (C.items.length > 60) { const o = C.items.shift(); if (o.parent) o.parent.remove(o); }
            m.talkTo = { sign: H.h.sign, until: Date.now() + 1800, faMood: 'neutral' };
          }
          H.t = Math.min(1, H.t + dt / 1.5);
          const from = m.holder.position.clone().add(new THREE.Vector3(-0.05, 1.02, -H.h.sign * 0.3));
          const to = w.head.clone().add(new THREE.Vector3(-0.32, -0.45, 0));
          const k = H.t * H.t * (3 - 2 * H.t), lift = Math.sin(Math.PI * k) * 0.08;
          H.item.position.copy(from.lerp(to, k)).add(new THREE.Vector3(0, lift, 0));
          busyTill = Math.max(busyTill, H.at + 1.5 + 9);   // then 9 seconds before the next row
        }
        S.stopUntil = Math.max(S.stopBase || 0, busyTill);
        if (now > S.stopUntil) { S.row++; S.state = 'out'; }
      }
    }
  } else if (S.state === 'back') { const d = S.x - (front + 1.0); S.x -= Math.min(d, dt * Math.min(0.6, 0.25 + d)); if (d < 0.01) S.state = 'idle'; }
  const serving = S.state === 'out' || S.state === 'stop' || S.state === 'back', moving = S.state === 'out' || S.state === 'back';
  if (C.trolley) { C.trolley.visible = S.state !== 'idle'; C.trolley.position.copy(_av(S.x, aisle, at.zf)); }

  // where each attendant wants to be
  const talking = (m: CrewMember) => m.talkTo && Date.now() < m.talkTo.until;
  if (seatedNow) { goSit(fa1, 0); goSit(fa2, 1); goSit(fa3, 2); }
  else if (serving) {
    const m1 = S.state === 'stop' ? (talking(fa1) && fa1.talkTo.faMood === 'angry' ? { kind: 'angry', v: 3 } : { kind: 'serve', v: talking(fa1) ? fa1.talkTo.sign : 1 }) : { kind: 'push', v: moving ? 1 : 0 };
    const m2 = S.state === 'stop' ? { kind: 'serve', v: talking(fa2) ? fa2.talkTo.sign : -1 } : { kind: 'push', v: moving ? 1 : 0 };
    goStand(fa1, S.x - 0.72, 0, 1, m1); goStand(fa2, S.x + 0.72, 0, -1, m2);
    if (fa1.sitK < 0.05) fa1.x = fa1.want.x; if (fa2.sitK < 0.05) fa2.x = fa2.want.x;   // they move with the trolley
  } else if (stage === 'board') { goStand(fa1, front + 0.55, -0.15, 1); goStand(fa2, at.x0 + 3 + 2.5 * (0.5 + 0.5 * Math.sin(now * 0.07)), 0, Math.cos(now * 0.07) > 0 ? 1 : -1); }
  else { goStand(fa1, front + 0.5, -0.18, 1); goStand(fa2, front + 0.95, 0.18, -1); }
  // the third attendant: the back while boarding; in the cruise a walk through the cabin now and then
  if (seatedNow) { /* seated above */ }
  else if (stage === 'board') goStand(fa3, at.x1 - 1.1, 0, -1);
  else if (stage === 'cruise' && !serving) {
    if (!S.walk && now > S.nextWalk) S.walk = { to: lastX, back: false };
    if (S.walk) { goStand(fa3, S.walk.back ? front + 1.3 : S.walk.to, 0, S.walk.back ? -1 : 1); if (Math.abs(fa3.x - fa3.want.x) < 0.05 && fa3.v < 0.05) { if (!S.walk.back) S.walk.back = true; else { S.walk = null; S.nextWalk = now + 100 + Math.random() * 140; } } }
    else goStand(fa3, front + 1.3, 0.15, 1);
  } else goStand(fa3, front + 1.3, 0.15, 1);
  // the captain
  if (stage === 'board') { cap.hidden = false; goStand(cap, front + 0.3, 0.22, 1); }
  else if (stage === 'cruise' && calm && !serving && now > S.nextCapt && !S.captUntil) { S.captUntil = now + 45; cap.hidden = false; cap.x = at.x0 - 0.1; goStand(cap, front + 0.35, 0.22, 1); }
  else if (S.captUntil && (now > S.captUntil || stage !== 'cruise' || turb)) { goStand(cap, at.x0 - 0.2, 0.22, -1); if (cap.x <= at.x0 - 0.15) { cap.hidden = true; S.captUntil = 0; S.nextCapt = now + 600 + Math.random() * 600; } }
  else if (!S.captUntil) { cap.hidden = true; cap.x = at.x0 - 0.2; }

  // move, turn, sit and pose everyone, smoothly
  if (C.light) C.light.intensity = 0.3 + 0.8 * (1 - night * 0.8);
  for (const m of C.members as CrewMember[]) {
    m.holder.visible = !m.hidden; if (m.hidden) continue;
    const w = m.want, atSeat = !!w.sit && Math.abs(m.x - w.x) < 0.05;
    // stand up before walking off; sit down once there
    let target = w.x;
    if (m.sitK > 0.02 && !atSeat) { m.sitK = Math.max(0, m.sitK - dt * 1.1); target = m.x; }
    const d = target - m.x, dist = Math.abs(d);
    const vmax = 0.95, a = 1.4, vWant = dist < 0.01 ? 0 : Math.min(vmax, Math.sqrt(2 * a * dist));
    m.v += Math.max(-a * dt, Math.min(a * dt, vWant - m.v));
    const stepX = Math.sign(d) * Math.min(dist, m.v * dt); m.x += stepX; m.dist += Math.abs(stepX);
    // in the aisle while walking; to the side when standing (making room) or into the seat
    const sideT = m.v > 0.2 ? 0 : w.side; m.side += (sideT - m.side) * Math.min(1, dt * 2.5);
    if (atSeat && Math.abs(m.side - w.side) < 0.06) m.sitK = Math.min(1, m.sitK + dt * 0.9);
    // turn towards where they walk, or the way they want to face
    m.yawT = m.v > 0.12 ? (d < 0 ? -Math.PI / 2 : Math.PI / 2) : (w.face > 0 ? Math.PI / 2 : -Math.PI / 2);
    let dy = m.yawT - m.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI; m.yaw += dy * Math.min(1, dt * 4.5);
    // the gesture: steps follow the distance walked (they never slide); otherwise what they are doing; blended
    const tt = now + m.t0, walkK = Math.min(1, m.v / 0.6);
    const base = w.mood ? humanGesture(w.mood, w.mood.kind === 'push' ? m.dist / 0.85 : tt) : humanGesture(null, tt);
    const walk = humanGesture({ kind: 'walk', v: 1, seed: (m as any).voice || (m as any).id }, m.dist / 1.25);
    const sit = humanGesture({ kind: 'sit', v: 0 }, tt);
    let gT = cabinLerpG(base, walk, w.mood && w.mood.kind === 'push' ? 0 : walkK);
    gT = cabinLerpG(gT, sit, m.sitK);
    // looking at the passenger they talk to
    if (talking(m)) { gT.shake += 0.55 * m.talkTo.sign * (m.yaw > 0 ? 1 : -1); gT.nod += 0.1; }
    m.g = m.g ? cabinLerpG(m.g, gT, Math.min(1, dt * 7)) : gT;
    const top = m.m.top || 1.7, drop = Math.max(0, top * 0.52 - 0.49) * m.sitK;
    m.holder.position.copy(_av(m.x, w.sit ? (aisle + m.side) * (1 - m.sitK) + w.side * m.sitK : aisle + m.side, at.zf - drop));
    m.holder.rotation.y = m.yaw;
    m.m.pose({ t: tt, yaw: 0, gaze: [Math.sin(tt * 0.3) * 0.35, 0], blink: (tt % 4.1) < 0.12 ? 1 : 0, g: m.g, talk: cabinTalkJaw('crew:' + (m.person && m.person.name)) });
  }
  cabinTalkMarks();
  cabinTurnHead();
}
/** Blend two gestures (k = 0 … 1). */
function cabinLerpG(a: any, b: any, k: number): any {
  const l = (x: number, y: number) => (x || 0) + ((y || 0) - (x || 0)) * k, la = (x: number[], y: number[]) => x.map((v, i) => l(v, y[i]));
  return { L: la(a.L, b.L), R: la(a.R, b.R), legs: la(a.legs || [0, 0, 0, 0], b.legs || [0, 0, 0, 0]), ank: la(a.ank || [0, 0], b.ank || [0, 0]), spine: la(a.spine || [0, 0, 0], b.spine || [0, 0, 0]), pelvis: l(a.pelvis, b.pelvis), lean: l(a.lean, b.lean), bob: l(a.bob, b.bob), roll: l(a.roll, b.roll), nod: l(a.nod, b.nod), shake: l(a.shake, b.shake), tilt: l(a.tilt, b.tilt), flush: l(a.flush, b.flush), calm: l(a.calm, b.calm) };
}
/** The passenger being talked to turns their head towards the aisle, and back. */
function cabinTurnHead() {
  const C = CabinCrew, th = C.talkHead, G = V3dCabinF.grp; if (!th || !G || !G.userData.people) return;
  const ms = G.userData.people.userData.meshes, w = th.w, on = Date.now() < th.until, T = THREE;
  if (CabinPax.list) { const e = CabinPax.list.filter((x: any) => x.f.hi === w.hi)[0]; if (e && e.st !== 'seat') { C.talkHead = null; return; } }   // not while they're up
  const yaw = on ? th.sign * 0.55 : 0, M = new T.Matrix4(), Q = new T.Quaternion().setFromEuler(new T.Euler(0, yaw, w.lean * 0.5));
  M.compose(w.head, Q, new T.Vector3(w.sc, w.sc, w.sc)); ms.head.setMatrixAt(w.hi, M); ms.head.instanceMatrix.needsUpdate = true;
  if (w.ri >= 0) { const hm = new T.Matrix4(), p = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3(); ms.hair.getMatrixAt(w.ri, hm); hm.decompose(p, q, s); q.setFromEuler(new T.Euler(0, yaw, w.lean * 0.5 - 0.25)); hm.compose(p, q, s); ms.hair.setMatrixAt(w.ri, hm); ms.hair.instanceMatrix.needsUpdate = true; }
  if (!on) C.talkHead = null;
}

/* ---------- speech marks and tapping ---------- */
function cabinTalkMarks() {
  const T = CabinCrew.talk, root = V3d.root; if (!root) return;
  let box = root.querySelector('.cab-marks') as HTMLElement;
  if (!box) { box = document.createElement('div'); box.className = 'cab-marks'; root.appendChild(box); }
  T.live = T.live.filter((x: any) => x.until > Date.now());
  const html: string[] = [];
  for (const x of T.live) {
    const p = x.pos(); if (!p) continue; const v = p.clone().project(V3d.cam); if (v.z > 1) continue;
    const sx = (v.x * 0.5 + 0.5) * innerWidth, sy = (-v.y * 0.5 + 0.5) * innerHeight;
    html.push(`<button class="cab-mark" data-act="cab-talk" data-k="${esc(x.key)}" style="left:${sx.toFixed(0)}px;top:${sy.toFixed(0)}px" aria-label="What they said"><i></i><i></i><i></i></button>`);
  }
  const s = html.join(''); if ((box as any)._s !== s) { (box as any)._s = s; box.innerHTML = s; }
}
/** Tap in the Cabin view: a crew member or a passenger shows what they said. */
function cabinTap(x: number, y: number): boolean {
  const C = CabinCrew, G = V3dCabinF.grp; if (!G) return false;
  const T = THREE, ray = new T.Raycaster(), v = new T.Vector2(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(v, V3d.cam);
  let best: any = null, bd = 0.45;
  for (const m of C.members as CrewMember[]) { if (m.hidden) continue; const c = m.holder.localToWorld(new T.Vector3(0, (m.m.top || 1.7) * (m.sitK > 0.5 ? 0.45 : 0.6), 0)); const d = ray.ray.distanceToPoint(c); if (d < bd) { bd = d; best = m; } }
  if (best) { cabinTalkOpen('crew:' + best.person.name, best); return true; }
  const pg = G.userData.people;
  if (pg) { const ms = pg.userData.meshes, hit = ray.intersectObjects([ms.head, ms.torso].filter(Boolean), false)[0];
    if (hit && hit.instanceId != null) { const w = pg.userData.who[hit.instanceId]; if (w) { cabinTalkOpen('pax:' + w.p.key, null, w.p); return true; } } }
  return cabShadeTap(ray, G);   // a window: its shade up or down
}
ACTIONS['cab-talk'] = el => { const k = el.getAttribute('data-k'); const m = (CabinCrew.members as CrewMember[]).filter(x => 'crew:' + x.person.name === k)[0]; cabinTalkOpen(k, m || null, null); };
/** The card: who it is and what they said, each line with a play button. */
function cabinTalkOpen(key: string, m: CrewMember, pax?: any) {
  const lines: TalkLine[] = (CabinCrew.talk.log[key] || []).slice(-4);
  const root = V3d.root; if (!root) return;
  let card = root.querySelector('.cab-talk') as HTMLElement; if (!card) { card = document.createElement('div'); card.className = 'cab-talk'; root.appendChild(card); }
  let name = '', role = '', intro = '', p = pax;
  if (m) { name = m.person.name; role = m.role === 'captain' ? 'Captain' : 'Flight attendant'; if (!lines.length) intro = m.role === 'captain' ? `Good day, I'm ${name.split(' ')[0]}, your captain today. Sit back and enjoy the flight.` : `Hello, I'm ${name.split(' ')[0]}. Just press the call button if you need anything.`; }
  else { if (!p) { const k = key.slice(4), w = (V3dCabinF.grp.userData.people.userData.who as any[]).filter(x => x.p.key === k)[0]; p = w && w.p; } name = p ? p.name : 'Passenger'; role = p ? 'Seat ' + p.seat : ''; }
  const voice = m ? personWho(m.role === 'captain' ? 'pilot' : 'gate', m.person, 'neutral') : personWho('pax', p || {}, 'neutral');
  const rows = lines.map(l => `<div class="ct-line ${esc(l.mood)}"><p>${esc(l.text)}</p>${voiceButton(l.text, l.voice, 'Hear ' + l.name)}</div>`).join('')
    || (intro ? `<div class="ct-line"><p>${esc(intro)}</p>${voiceButton(intro, voice, 'Hear ' + name)}</div>` : `<p class="muted">Nothing said yet. When they talk, a speech mark shows above them.</p>`);
  card.innerHTML = `<div class="ct-h"><span><b>${esc(name)}</b><small>${esc(role)}</small></span><button class="icon-btn" data-act="cab-talk-close" aria-label="Close">${icon('close')}</button></div>${rows}`;
  card.classList.add('on');
}
ACTIONS['cab-talk-close'] = () => { const c = V3d.root && V3d.root.querySelector('.cab-talk'); if (c) c.classList.remove('on'); };

function cabinCrewFree() {
  CabinCrew.items = [];
  const C = CabinCrew;
  if (C.grp) { if (C.grp.parent) C.grp.parent.remove(C.grp); for (const m of C.members) try { av3Dispose(m.m.root); } catch (e) { /* gone */ } try { C.grp.traverse((o: any) => { if (o.geometry) o.geometry.dispose(); }); } catch (e) { /* gone */ } }
  C.grp = null; C.members = []; C.trolley = null; C.light = null; C.key = ''; C.talkHead = null; C.talk.live = [];
  try { const r = V3d.root; if (r) { const a = r.querySelector('.cab-marks'), b = r.querySelector('.cab-talk'); if (a) a.remove(); if (b) b.remove(); } } catch (e) { /* gone */ }
}
