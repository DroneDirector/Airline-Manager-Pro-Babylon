// Training for everyone you hire, not only the pilots' type ratings: courses for pilots, cabin crew, mechanics and
// ground staff, each kind in its own section, at prices taken from real training centres (see
// docs/reference/crew-training-prices.txt). A course runs on the real clock (faster with a faster virtual pilot speed);
// meanwhile the person doesn't work and sits in the Training room (the Academy) in the staff corridor. A finished
// course is on the person's record and lifts their rating a little.

interface CrewCourse { id: string; who: 'pilot' | 'fa' | 'mech' | 'ground' | 'security'; name: string; price: number; days: number; what: string; rating: number }
const CREW_COURSES: CrewCourse[] = [
  // pilots (the type ratings are in each pilot's own details)
  { id: 'crm', who: 'pilot', name: 'Crew resource management (recurrent)', price: 600, days: 1, rating: 0.1, what: 'Working as a crew: communication, workload, decisions, threat and error management.' },
  { id: 'uprt', who: 'pilot', name: 'Upset prevention and recovery (UPRT)', price: 2400, days: 2, rating: 0.2, what: 'Ground school and flying in an aerobatic aircraft: recognising and recovering from upsets.' },
  { id: 'dg-fc', who: 'pilot', name: 'Dangerous goods for flight crew', price: 200, days: 1, rating: 0.05, what: 'What may be carried, the NOTOC, and what to do with dangerous goods in an emergency.' },
  { id: 'opc', who: 'pilot', name: 'Recurrent simulator check (OPC/LPC)', price: 8000, days: 2, rating: 0.15, what: 'Two simulator sessions: engine failures, rejected take-offs, go-arounds, the licence check.' },
  { id: 'command', who: 'pilot', name: 'Command upgrade course', price: 12000, days: 5, rating: 0.3, what: 'From first officer to captain: leadership, decision making, line training from the left seat.' },
  // cabin crew
  { id: 'cc-initial', who: 'fa', name: 'Cabin crew attestation (initial)', price: 1000, days: 3, rating: 0.2, what: 'The licence course: safety and emergency procedures, first aid, fire, survival, security.' },
  { id: 'sep', who: 'fa', name: 'Safety and emergency procedures (recurrent)', price: 450, days: 1, rating: 0.1, what: 'Evacuation drills, slides, doors, ditching and the emergency equipment, once a year.' },
  { id: 'cc-fire', who: 'fa', name: 'Fire fighting for cabin crew', price: 150, days: 1, rating: 0.05, what: 'Real fires in a training rig: extinguishers, smoke hoods, fires in ovens, toilets and lockers.' },
  { id: 'cc-aid', who: 'fa', name: 'First aid and aviation medicine', price: 150, days: 1, rating: 0.05, what: 'Cardiac arrest and the defibrillator, choking, fainting and the medical kit on board.' },
  { id: 'dg-cc', who: 'fa', name: 'Dangerous goods awareness (category 10)', price: 170, days: 1, rating: 0.05, what: 'Batteries, aerosols and other dangerous goods in passengers\' bags, and what to do with them.' },
  { id: 'purser', who: 'fa', name: 'Senior cabin crew (purser) course', price: 1500, days: 2, rating: 0.25, what: 'Leading the cabin: briefings, the flight deck, difficult passengers, reports.' },
  // mechanics
  { id: 'type-b1', who: 'mech', name: 'Aircraft type course (B1, theory and practical)', price: 18000, days: 5, rating: 0.3, what: 'An aircraft type on the engineer\'s licence: its systems, engines and maintenance, and practical tasks.' },
  { id: 'hf', who: 'mech', name: 'Human factors in maintenance', price: 150, days: 1, rating: 0.05, what: 'Fatigue, pressure, distraction and the dirty dozen: why mistakes happen and how to stop them.' },
  { id: 'ewis', who: 'mech', name: 'Electrical wiring (EWIS)', price: 500, days: 1, rating: 0.1, what: 'Wiring inspections, chafing, repairs and keeping wires apart.' },
  { id: 'runup', who: 'mech', name: 'Engine run-up', price: 2500, days: 1, rating: 0.15, what: 'Running the engines on the ground after maintenance: procedures, limits and emergencies.' },
  { id: 'borescope', who: 'mech', name: 'Borescope inspection', price: 2200, days: 2, rating: 0.15, what: 'Looking inside a running engine\'s core with a camera: what damage looks like and the limits.' },
  { id: 'hot-work', who: 'mech', name: 'Hot work and fire watch', price: 150, days: 1, rating: 0.05, what: 'Welding, grinding and heat in the hangar: permits, fire watch and extinguishers.' },
  // ground staff
  { id: 'adp', who: 'ground', name: 'Airside driving permit', price: 250, days: 1, rating: 0.1, what: 'Driving on the apron: markings, right of way, aircraft movements, speed limits and the test.' },
  { id: 'pushback', who: 'ground', name: 'Pushback and towing', price: 1200, days: 2, rating: 0.2, what: 'The tug and the towbar: connecting, the bypass pin, pushing back, towing and the headset with the flight deck.' },
  { id: 'deice', who: 'ground', name: 'De-icing and anti-icing (level 1)', price: 600, days: 1, rating: 0.1, what: 'Fluids, hold-over times, the de-icing truck and the critical surfaces.' },
  { id: 'dg-gnd', who: 'ground', name: 'Dangerous goods for ground staff', price: 200, days: 1, rating: 0.05, what: 'Labels, the loading rules and what to do with a damaged package.' },
  { id: 'load', who: 'ground', name: 'Load control and loadsheets', price: 1800, days: 3, rating: 0.25, what: 'Mass and balance, the load plan and the loadsheet: trim, limits and last-minute changes.' },
  // security officers
  { id: 'sec-initial', who: 'security', name: 'Aviation security officer (initial)', price: 1200, days: 3, rating: 0.25, what: 'Screening passengers and bags, prohibited items, the rules and the law, searching people respectfully.' },
  { id: 'sec-xray', who: 'security', name: 'X-ray image interpretation', price: 450, days: 1, rating: 0.15, what: 'Reading the x-ray: weapons, explosives and what hides them in a bag.' },
  { id: 'sec-conflict', who: 'security', name: 'Conflict management and restraint', price: 350, days: 1, rating: 0.15, what: 'Calming a drunk or angry passenger, and safe, lawful restraint when there is no other way.' },
  { id: 'sec-aware', who: 'security', name: 'Security awareness (recurrent)', price: 170, days: 1, rating: 0.05, what: 'The year\'s threats and rule changes, insider risks and reporting.' },
  { id: 'gnd-fire', who: 'ground', name: 'Elementary fire fighting', price: 150, days: 1, rating: 0.05, what: 'Fires on the ramp: extinguishers, fuel spills and calling the fire service.' },
];
const CREW_COURSE_GROUPS: [string, string][] = [['pilot', 'Pilots'], ['fa', 'Cabin crew'], ['mech', 'Mechanics'], ['ground', 'Ground staff'], ['security', 'Security']];

/** Which section a person belongs to. */
function courseGroupOf(p: any): string { return p && p.job === 'security' ? 'security' : p && (p.role === 'fa' || p.role === 'mech' || p.role === 'ground') ? p.role : 'pilot'; }
/** The people of a section in your airline. */
function courseCandidates(who: string): any[] {
  const c = company(); if (!c) return [];
  if (who === 'pilot') return (State.pilots as any[]).filter((p: any) => !p.you && pilotCompany(p) === c.id);
  if (who === 'security') return staffOf(c.id, 'ground').filter((p: any) => p.job === 'security');
  return staffOf(c.id, who as any).filter((p: any) => who !== 'ground' || p.job !== 'security');
}
/** Is the person on a course now (any course, or a type rating)? */
function onCourse(p: any): boolean { return !!p && p.status === 'training'; }
/** Everyone on a course now in your airline (the Training room's class), the longest there first. */
function inTrainingNow(): any[] {
  const c = company(); if (!c) return [];
  const all = (State.pilots as any[]).filter((p: any) => !p.you && pilotCompany(p) === c.id).concat(staffOf(c.id) as any[]);
  return all.filter(onCourse).sort((a: any, b: any) => (a.trainingFrom || 0) - (b.trainingFrom || 0));
}
const CrewTraining = {
  course(id: string): CrewCourse { return CREW_COURSES.filter(x => x.id === id)[0]; },
  done(p: any, id: string): boolean { return !!(p && p.courses && p.courses.indexOf(id) >= 0); },
  /** Send someone on a course: paid now, away from work until it ends. */
  start(p: any, id: string): boolean {
    const C = this.course(id), c = company(); if (!p || !C || !c || p.you || onCourse(p)) return false;
    const before = c.balance;
    payTxn(c.id, `${C.name}: ${p.name}`, -C.price, 'training', [['Course fee', -C.price]]);
    const dur = C.days * 864e5 / Math.max(1, Math.min(10, aiSpeed()));
    p.prevStatus = p.status === 'flying' ? 'standby' : p.status; p.status = 'training';
    p.course = { id, until: Date.now() + dur }; p.trainingFrom = Date.now(); p.trainingUntil = Date.now() + dur;
    try { animateBalance(before, c.balance); } catch (e) { /* ignore */ }
    Store.save(); return true;
  },
  /** Courses that have ended: back to work, the course on their record, a little better at the job. */
  advance() {
    const now = Date.now(); let changed = false;
    const people = (State.pilots as any[]).concat((State as any).staff || []);
    for (const p of people) {
      if (p.status !== 'training' || !p.course || p.course.until > now) continue;
      const C = this.course(p.course.id);
      p.status = p.prevStatus && p.prevStatus !== 'training' ? p.prevStatus : p.role ? 'on duty' : 'standby';
      (p.courses = p.courses || []).push(p.course.id);
      if (C) p.rating = Math.min(5, Math.round(((p.rating || 3.5) + C.rating) * 100) / 100);
      delete p.course; delete p.trainingUntil; delete p.trainingFrom; changed = true;
      if (C && p.companyId === State.companyId) State.notices.unshift({ id: uid(), kind: 'pilot', title: `${p.name} finished a course`, body: `${C.name}: done. It's on ${p.name.split(' ')[0]}'s record.`, time: 'Now', read: false } as any);
    }
    if (changed) { Store.save(); try { renderTopbar(); if (State.screen === 'pilots') refresh(); } catch (e) { /* ignore */ } }
  },
};
setInterval(() => { try { CrewTraining.advance(); } catch (e) { /* next time */ } }, 30000);
