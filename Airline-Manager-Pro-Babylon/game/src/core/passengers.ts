// Disruptive passengers. On your own flights a gate agent may call about a severely drunk passenger:
// deny boarding (a short delay, nothing else), or let them on. Letting them on spoils the atmosphere in
// the cabin and costs the airline popularity and you rating, and often ends with an unruly passenger in
// flight, the police meeting the aircraft and a court case. Hired pilots' flights very rarely carry an
// unruly passenger too; their crew deals with it.

const PAX_FIRST = ['Mark', 'Lisa', 'Jonas', 'Emma', 'Ryan', 'Sara', 'Tom', 'Nina', 'Kevin', 'Julia', 'Lars', 'Anna', 'Paul', 'Maria', 'Dean', 'Heidi'];
const PAX_LAST = ['Walker', 'Jensen', 'Becker', 'Moreau', 'Novak', 'Hansen', 'Collins', 'Berg', 'Fischer', 'Ricci', 'Kowalski', 'Larsen', 'Murphy', 'Svensson'];
const PAX_WOMEN = ['Lisa', 'Emma', 'Sara', 'Nina', 'Julia', 'Anna', 'Maria', 'Heidi'];
function paxSex(name: string): 'm' | 'f' { return PAX_WOMEN.indexOf(String(name).split(' ')[0]) >= 0 ? 'f' : 'm'; }
function paxName(): string { return PAX_FIRST[Math.floor(Math.random() * PAX_FIRST.length)] + ' ' + PAX_LAST[Math.floor(Math.random() * PAX_LAST.length)]; }

const PaxLeg = { parkedSince: 0, asked: false, allowed: false, name: '', incident: false, cruiseSeen: false };

/** Called with every reading from the sim. */
function paxOnState(s: any) {
  if (!s || !s.inFlight) return;
  if (s.phase === 'parked') {
    if (!PaxLeg.parkedSince) PaxLeg.parkedSince = Date.now();
    // about one leg in 25, a minute or so into boarding
    if (!PaxLeg.asked && Date.now() - PaxLeg.parkedSince > 60000) {
      PaxLeg.asked = true;
      if (Math.random() < 0.04) paxDrunkAtGate();
    }
  }
  if (s.phase === 'cruise' && !PaxLeg.cruiseSeen) {
    PaxLeg.cruiseSeen = true;
    if (PaxLeg.allowed && Math.random() < 0.65) {
      PaxLeg.incident = true;
      State.notices.unshift({ id: uid(), kind: 'flight', title: 'Unruly passenger in the cabin', body: `${PaxLeg.name}, the drunk passenger you let on, is shouting at the crew and refusing to sit down. The cabin crew have restrained them. Police will meet the aircraft.`, time: 'Now', read: false } as any);
      try { renderTopbar(); Sound.chime(); toast('Unruly passenger: the crew have restrained them', 'warn'); } catch (e) { /* not ready */ }
    }
  }
}

function paxDrunkAtGate() {
  PaxLeg.name = paxName();
  try { Sound.chime(); } catch (e) { /* muted */ }
  const line = `Captain, a passenger for your flight, ${PaxLeg.name}, is severely drunk. They can hardly stand and are getting loud with the staff. Do you want them on board?`;
  const pax = `I'm fine. I'm totally fine! Just let me on the plane, I paid for my ticket!`;
  const paxWho = `pax|${paxSex(PaxLeg.name)}|drunk|${PaxLeg.name}`;
  Voice.prepare(line, 'gate'); Voice.prepare(pax, paxWho);
  const wrap = openLayer('modal', `<div class="modal-head"><div><small>Gate agent</small><h2>Drunk passenger at the gate</h2></div></div>
    <div class="say-row">${voiceButton(line, 'gate', "Play the gate agent's message")}${voiceNoteEl()}</div>
    <p class="speech">${esc(line)}</p>
    <div class="say-row pax-say">${voiceButton(pax, paxWho, 'Play what the passenger says')}<small class="voice-note">${esc(PaxLeg.name)}, at the desk</small></div>
    <p class="speech pax-speech">“${esc(pax)}”</p>
    <div class="decide">
      <button class="decide-card" data-act="pax-deny"><b>Deny boarding</b><small>Their bags are taken off. About ten minutes' delay, and a calm cabin.</small></button>
      <button class="decide-card bad" data-act="pax-allow"><b>Let them board</b><small>A bad atmosphere in the cabin, and it may get much worse in flight.</small></button>
    </div>`, { cls: 'narrow' });
  autoSpeak(wrap);
}
ACTIONS['pax-deny'] = () => {
  closeAll(); PaxLeg.allowed = false; Sound.tick();
  State.notices.unshift({ id: uid(), kind: 'flight', title: 'Passenger denied boarding', body: `${PaxLeg.name} was refused boarding for being drunk. Their bags were offloaded.`, time: 'Now', read: false } as any);
  renderTopbar(); toast('Passenger denied boarding', 'ok');
};
ACTIONS['pax-allow'] = () => {
  closeAll(); PaxLeg.allowed = true; Sound.tick();
  toast('The passenger is boarding. The crew are not happy.', 'warn');
};

/** At the gate: settle the consequences for the leg, then start fresh for the next one. */
function paxOnBlocksOn(to: string) {
  const c = company(), me: any = myPilot();
  if (PaxLeg.allowed) {
    const hit = PaxLeg.incident ? 6 : 2;
    c.reputation = Math.max(0, (c.reputation || 50) - hit);
    if (me) me.rating = Math.max(1, Math.round(((me.rating || 4) - (PaxLeg.incident ? 0.2 : 0.05)) * 100) / 100);
    if (typeof Progress !== 'undefined') Progress.popularity(-hit, PaxLeg.incident ? 'An unruly passenger you let board' : 'A drunk passenger spoiled the cabin');
    if (PaxLeg.incident) {
      const ap = apt(to);
      openCourtCase({ id: 'pax-' + uid(), name: PaxLeg.name, look: null, base: to, companyId: c.id }, 'pax', 0);
      State.notices.unshift({ id: uid(), kind: 'flight', title: `Police met the aircraft at ${to}`, body: `${PaxLeg.name} was arrested at ${ap ? ap.city : to}. Letting a severely drunk passenger board cost ${c.name} popularity and lowered your pilot rating.`, time: 'Now', read: false } as any);
    } else {
      State.notices.unshift({ id: uid(), kind: 'flight', title: 'Unhappy cabin', body: `The drunk passenger you let on spoiled the flight for everyone. Passengers complained, and your pilot rating dropped.`, time: 'Now', read: false } as any);
    }
  }
  Object.assign(PaxLeg, { parkedSince: 0, asked: false, allowed: false, name: '', incident: false, cruiseSeen: false });
}

/** Hired pilots' flights: very rarely an unruly passenger the crew has to deal with. */
function paxOnAiLanding(f: any) {
  if (Math.random() >= 0.004) return;
  const ap = apt(f.to), name = paxName(), p = pilot(f.pilotId);
  if (Math.random() < 0.3) openCourtCase({ id: 'pax-' + uid(), name, look: null, base: f.to, companyId: (plane(f.reg) || {} as any).companyId }, 'pax');
  else State.notices.unshift({ id: uid(), kind: 'pilot', title: `Unruly passenger on ${f.callsign}`, body: `${p ? p.name + '\'s' : 'The'} cabin crew restrained a drunk passenger on the way to ${ap ? ap.city : f.to}. Police met the aircraft and took them away.`, time: 'Now', read: false } as any);
}
