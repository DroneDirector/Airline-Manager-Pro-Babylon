// What exactly happened in a conduct report: what was said (word for word, as reported) or what was done,
// who reported it and who saw it, and what the employee says about it. Picked once per report (from its id),
// so it never changes, and older reports get theirs too. It helps you decide: discipline or dismiss.

interface ConductDetail { said?: string; did?: string; by: string; seen?: string; side: string }

// [title]: variants; {n} the employee's name, {b} the base, {f} their first name
const CONDUCT_DETAILS: { [title: string]: ConductDetail[] } = {
  'Rude to a passenger': [
    { said: '“If you wanted a choice, you should have flown business.”', did: 'Said to an elderly passenger who asked whether there was a vegetarian meal left, then walked on without waiting for an answer.', by: 'The passenger, by email after landing', seen: 'Two passengers in the same row confirmed it.', side: '{f} says the trolley had run out of vegetarian meals and the passenger had already asked three times. {f} admits the remark was "out of line".' },
    { said: '“Can you not see I\'m busy? Press the button again and I\'ll ignore it.”', did: 'Said to a passenger who pressed the call button twice during the service.', by: 'The passenger, through customer services', seen: 'The purser heard the remark from the galley.', side: '{f} says the cabin was a crew member short and the passenger pressed the button while the trolley was blocking the aisle. {f} apologises.' },
    { did: 'Rolled their eyes, sighed loudly and dropped a meal tray onto the table of a passenger who asked for the chicken instead of the pasta, then refused to swap it.', by: 'The passenger\'s daughter, on social media, with a short video', seen: 'The video shows the tray being dropped; there is no sound.', side: '{f} says the chicken had run out and the tray slipped. {f} denies refusing to help.' },
  ],
  'Late for duty': [
    { did: 'Arrived 22 minutes after the start of the briefing, without calling ahead. The purser briefed the rest of the crew without {f}.', by: 'The purser', side: '{f} says the staff bus from the hotel was late. The hotel says the bus left on time.' },
    { did: 'Arrived 18 minutes late for the briefing, still in their own clothes, and changed into uniform in the crew room while boarding was held.', by: 'The duty manager at {b}', side: '{f} says their alarm did not go off and apologises. It is the first time.' },
  ],
  'Skipped a safety check': [
    { did: 'Signed the cabin safety check as complete four minutes after the crew boarded. Two fire extinguishers at the back had not been checked; one was found with its seal broken on the next flight.', by: 'The next crew\'s purser', side: '{f} says the check was rushed because of a tight turnaround and the captain wanted to board early.' },
    { did: 'Ticked off the emergency equipment checklist without opening the overhead lockers with the life vests and oxygen. A seal was missing on one locker.', by: 'A cabin safety audit at {b}', side: '{f} says they "had checked it on the previous flight" and did not think it was needed again.' },
  ],
  'Argument with a colleague': [
    { said: '“Don\'t you ever tell me how to do my job again, I was flying when you were still at school!”', did: 'Shouted at a junior colleague in the rear galley, loud enough to be heard in the last six rows.', by: 'The purser', seen: 'Several passengers turned round; one asked a crew member if everything was all right.', side: '{f} says the colleague had criticised them in front of passengers first.' },
    { did: 'Slammed a trolley door and argued with a colleague over who should do the duty-free round, in the forward galley with the curtain open.', by: 'A passenger in row 2', side: '{f} says it was a disagreement that got heated, and they have since apologised to the colleague.' },
  ],
  'Late for the turnaround': [
    { did: 'Arrived at the stand 17 minutes after the aircraft came on blocks. The other loaders started without the belt loader {f} was meant to bring.', by: 'The ramp supervisor at {b}', side: '{f} says the vehicle would not start and they had to fetch another. The workshop has no record of a fault.' },
    { did: 'Was on a break in the canteen when the aircraft arrived and did not answer the radio for 12 minutes.', by: 'The ramp agent', side: '{f} says the radio battery was flat. They admit they should have checked it.' },
  ],
  'Drove too fast on the apron': [
    { did: 'Drove a baggage tug at about 40 km/h (the limit is 15) past two parked aircraft and through a marked walkway while passengers were walking to an aircraft.', by: 'The airport\'s apron control, from a camera', side: '{f} says they were late for the next flight and "didn\'t think it was that fast".' },
    { did: 'Overtook a fuel truck on the service road at speed and cut in front of an aircraft being pushed back.', by: 'The push-back driver', seen: 'The airport\'s apron safety officer saw it.', side: '{f} says the push-back had not started yet.' },
  ],
  'Hit an aircraft with a vehicle': [
    { did: 'Reversed a catering truck into the rear left door. The door frame was dented and the aircraft was grounded for an inspection.', by: 'The cabin crew, who felt the bump', side: '{f} says the guide person gave the signal to keep reversing. The guide says {f} was not watching.' },
    { did: 'Clipped the cargo door with the belt loader while positioning, then did not report it. The next shift found the damage.', by: 'The mechanic on the next shift', side: '{f} says they did not notice the contact.' },
  ],
  'Threw passengers\' bags': [
    { did: 'Threw suitcases about two metres from the trolley onto the belt loader; one bag split open on the apron.', by: 'A passenger, who filmed it from the window; the video was posted online', side: '{f} says the bags were heavy and the loading was running late.' },
    { said: '“Who packs bricks in a suitcase?”', did: 'Kicked a heavy suitcase off the trolley and threw two smaller ones into the hold.', by: 'A passenger watching from the gate window', side: '{f} says they were joking with a colleague and denies kicking the bag.' },
  ],
  'Left a vehicle unattended': [
    { did: 'Left a tug running with the handbrake off next to the nose gear of an aircraft for about five minutes while fetching a coffee.', by: 'The ramp supervisor', side: '{f} says they were gone "for a minute" and thought the brake was on.' },
  ],
  'Missed a deadline': [
    { did: 'Started a scheduled daily inspection 50 minutes before departure instead of three hours before, as planned. The aircraft left 40 minutes late.', by: 'Maintenance control', side: '{f} says the job was handed over late by the night shift and there was no one to help.' },
    { did: 'Did not finish a wheel change before the planned departure; the work had been planned for the evening before and was not started.', by: 'The duty manager at {b}', side: '{f} says the spare wheel arrived late from stores.' },
  ],
  'Tools left on the apron': [
    { did: 'Left an open toolbox with a torque wrench next to the main gear after a brake check. A ramp agent found it just before push-back.', by: 'A ramp agent at {b}', seen: 'Tool control showed the box had not been signed back in.', side: '{f} says they were called away to another aircraft and meant to come back for it.' },
    { did: 'Left a screwdriver in the engine cowling area after an oil top-up. The next mechanic found it during the walk-round.', by: 'The mechanic on the next shift', side: '{f} accepts it was their screwdriver.' },
  ],
  'Paperwork not signed': [
    { did: 'Released the aircraft to service after replacing a cabin pressure sensor but did not sign the work card or the certificate of release.', by: 'A records audit', side: '{f} says the work was done properly and they "forgot the paperwork at the end of a long shift".' },
    { did: 'Signed for a brake inspection on the wrong aircraft\'s papers; the inspection on the right aircraft had no record at all.', by: 'Quality control', side: '{f} says it was a mix-up between two aircraft on the same stand.' },
  ],
  'Late for shift': [
    { did: 'Arrived 70 minutes late for the night shift, without calling in. One mechanic covered two aircraft alone.', by: 'The shift leader', side: '{f} says they fell asleep after a double shift the day before.' },
    { did: 'Came in an hour late and left 30 minutes early on the same shift.', by: 'The shift leader', side: '{f} says there was a family emergency and they told a colleague, who did not pass it on.' },
  ],
  'Late for the flight': [
    { did: 'Reported for duty 25 minutes late. The captain did the walk-round and the flight plan alone; the departure was 15 minutes late.', by: 'The captain', side: '{f} says the crew car was stuck in traffic.' },
    { did: 'Arrived at the aircraft after boarding had started, still drinking a coffee, without having read the weather or the notices.', by: 'The captain', side: '{f} says they read the briefing on the phone in the car.' },
  ],
  'Checklist shortcuts': [
    { did: 'Read the before-take-off checklist from memory and skipped the flight controls check. The flight data shows no full control movement before take-off.', by: 'The airline\'s flight data monitoring', side: '{f} says they checked the controls during taxi and did not call it out.' },
    { said: '“Checklist complete.”', did: 'Called the before-take-off checklist complete after reading only half of it while the aircraft was lining up.', by: 'The captain, in the voluntary report', side: '{f} says the tower was pushing for a quick departure.' },
  ],
  'Unprofessional radio calls': [
    { said: '“Yeah, we heard you the first time, tower.”', did: 'Answered a repeated clearance in a sarcastic tone.', by: 'Air traffic control, in a written complaint', side: '{f} says the frequency was busy and the controller had cut them off twice.' },
    { said: '“Morning, mate, any chance of a shortcut today?”', did: 'Used slang on the frequency, read back a heading wrongly and did not correct it.', by: 'Air traffic control', side: '{f} says it was a quiet frequency and they meant to sound friendly.' },
  ],
};

/** The detail of a report (picked once from its id; older reports get one too). */
function conductDetail(inc: any, p: any): ConductDetail | null {
  const list = CONDUCT_DETAILS[inc.title]; if (!list || !list.length) return null;
  let h = 0; for (const ch of String(inc.id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const d = list[h % list.length], first = String((p && p.name) || '').replace(/^Capt\.\s*/, '').split(/\s+/)[0] || 'They';
  const f = (s?: string) => s ? s.replace(/\{n\}/g, (p && p.name) || '').replace(/\{f\}/g, first).replace(/\{b\}/g, (p && p.base) || '') : s;
  return { said: f(d.said), did: f(d.did), by: f(d.by) as string, seen: f(d.seen), side: f(d.side) as string };
}
function conductDetailHtml(inc: any, p: any): string {
  const d = conductDetail(inc, p); if (!d) return '';
  const row = (k: string, v?: string, cls?: string) => v ? `<div class="cd-row ${cls || ''}"><small>${esc(k)}</small><span>${esc(v)}</span></div>` : '';
  return `<div class="cd-box">${row('What was said', d.said, 'quote')}${row(d.said ? 'What happened' : 'What was done', d.did)}${row('Reported by', d.by)}${row('Witnesses', d.seen)}${row(`${(p && p.name ? p.name.replace(/^Capt\.\s*/, '').split(/\s+/)[0] : 'Their')}'s side`, d.side)}</div>`;
}
function conductDetailSpeech(inc: any, p: any): string {
  const d = conductDetail(inc, p); if (!d) return '';
  return ` ${d.said ? `What was said: ${d.said.replace(/[“”]/g, '')} ` : ''}${d.did} Reported by: ${d.by}.${d.seen ? ' ' + d.seen : ''} Their side: ${d.side}`;
}
