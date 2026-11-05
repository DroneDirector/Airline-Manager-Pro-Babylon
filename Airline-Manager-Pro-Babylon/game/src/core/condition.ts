// Aircraft condition. Every aircraft wears with flying hours, take-offs and landings and with age; your
// mechanics keep it up. How well they do depends on how many you have for the fleet and how good they are
// (their rating falls when they are late, skip work or are disciplined). Repairs take real time, from
// 5 minutes for a small job to 2 hours for a big one, and the condition rises while the work goes on.
// It all runs on the real clock, so it carries on while the app is closed.
//
//   green  75-100   good
//   yellow 55-75    some wear, keep an eye on it
//   orange 35-55    needs attention: emergency landings become more likely
//   red    under 35 severe problems: emergencies are likely, and a serious accident becomes possible
//
// A serious accident is investigated. If poor maintenance caused it (too few or poor mechanics, repairs
// left undone, a worn-out aircraft kept flying) the airline is prosecuted and the court decides the
// punishment; when it wasn't the airline's fault, there is no case against you.

const COND_BANDS = [[75, 'good', 'Good'], [55, 'fair', 'Some wear'], [35, 'attn', 'Needs attention'], [0, 'poor', 'Severe problems']] as [number, string, string][];
function condBand(v: number) { for (const b of COND_BANDS) if (v >= b[0]) return b; return COND_BANDS[3]; }

/** Age in years (from the build year, set once per aircraft from its hours if not known). */
function acAge(a: any): number {
  if (!a.built) a.built = new Date().getFullYear() - Math.min(30, Math.round(a.hoursMin / 60 / 2800));
  return Math.max(0, new Date().getFullYear() - a.built);
}

/** How well a base is maintained: share of the mechanics needed (0-1) times their average skill (0-1). */
function maintQuality(cid: string): { coverage: number; skill: number; q: number } {
  const mechs = staffOf(cid, 'mech');
  const fl = State.fleet.filter(a => a.companyId === cid);
  let need = 0; fl.forEach(a => need += MECH_RATIO[acType(a.typeId).cls] || 1);
  need = Math.max(1, Math.ceil(need));
  const coverage = clamp(mechs.length / need, 0, 1);
  const skill = mechs.length ? clamp(mechs.reduce((s, m) => s + (m.rating || 3), 0) / mechs.length / 5, 0.2, 1) : 0;
  return { coverage, skill, q: coverage * (0.4 + 0.6 * skill) };
}

/** The repair times the app chooses from (real minutes). */
const REPAIR_STEPS = [5, 10, 15, 20, 25, 30, 40, 50, 60, 90];
function repairStep(m: number): number { return REPAIR_STEPS.reduce((best, s) => Math.abs(s - m) < Math.abs(best - m) ? s : best, REPAIR_STEPS[0]); }

/** Repair time in real minutes, from the job and the mechanics doing it (better mechanics are quicker). */
function repairMinutes(i: Issue, skill: number): number {
  const base = i.severity === 'grounding' ? 65 : i.severity === 'major' ? 32 : 10;
  return repairStep(base * (1.35 - 0.6 * skill) * (0.85 + 0.3 * Math.random()));
}

/** Repair everything reported on an aircraft in one go: it goes into the hangar for the real repair
 *  time (the longest job, plus a little for each extra one) and the condition climbs while the work goes on. */
/** The repair time of one report (real minutes), worked out once and kept, so the time the mechanic
 *  quotes is the time the repair really takes. */
function issueMinutes(i: Issue): number {
  const I: any = i;
  if (!I.estMin) { const a: any = plane(i.reg); I.estMin = repairMinutes(i, (a && maintQuality(a.companyId).skill) || 0.3); }
  return I.estMin;
}
/** Spare parts for a repair: what the jobs need (about 55% of their cost) and how much of it isn't in your stores.
 *  Parts in stock are taken from there; missing parts are ordered at the day's price with a rush charge, and the
 *  aircraft waits for them in the hangar. */
function repairParts(reg: string, jobs: Issue[]): { need: number; have: number; miss: number } {
  const a: any = plane(reg), need = Math.round(jobs.reduce((t, i: any) => t + (i.cost || 0), 0) * 0.55);
  if (!a || !need) return { need: 0, have: 0, miss: 0 };
  const stock = stockOf(a.companyId).parts || 0, have = Math.min(stock, need);
  return { need, have, miss: need ? (need - have) / need : 0 };
}
/** How long the hangar needs for all of an aircraft's open reports together (real minutes; 0 when repairs are instant).
 *  Waiting for parts that aren't in stock adds up to 80% more. */
function repairPlanMin(reg: string, issues?: Issue[]): number {
  if ((State.settings as any).repairTime === 'instant') return 0;
  const jobs = issues || State.issues.filter(i => i.reg === reg && i.status === 'open');
  if (!jobs.length) return 0;
  const mins = jobs.map(issueMinutes).sort((x, y) => y - x);
  const kept = (jobs[0] as any).partsMiss, miss = kept != null ? kept : repairParts(reg, jobs).miss;
  return repairStep(Math.min(120, (mins[0] + mins.slice(1).reduce((t, m) => t + Math.round(m * 0.3), 0)) * (1 + 0.8 * miss)));
}
/** "about 45 minutes", "1 h 20 min", or "ready at once". */
function repairTimeText(min: number): string {
  if (!min) return 'ready straight away';
  return min < 60 ? `${min} minutes` : `${Math.floor(min / 60)} h${min % 60 ? ' ' + (min % 60) + ' min' : ''}`;
}

function repairAll(reg: string): Issue[] {
  const a: any = plane(reg); if (!a) return [];
  const jobs = State.issues.filter(i => i.reg === reg && i.status !== 'fixed') as any[];
  if (!jobs.length) return [];
  const skill = maintQuality(a.companyId).skill || 0.3;
  const dur = repairPlanMin(reg, jobs) || repairStep(Math.min(90, Math.max.apply(null, jobs.map(issueMinutes))));
  const gain = jobs.reduce((t, i) => t + (i.severity === 'grounding' ? 40 : i.severity === 'major' ? 22 : 8), 0) * (0.6 + 0.4 * skill);
  const now = Date.now(), from = a.condition, to = Math.min(condCap(a), a.condition + gain);
  const instant = (State.settings as any).repairTime === 'instant';
  for (const i of jobs) { i.startedAt = instant ? now - dur * 60000 : now; i.durMin = dur; i.fromCond = from; i.toCond = to; i.status = 'scheduled'; i.instant = instant; }
  if (a.status !== 'flying') a.status = 'maintenance';
  if (instant && a.status !== 'flying') conditionAdvance();
  return jobs;
}
function startRepair(i: Issue) { repairAll(i.reg); }

/** The best an aircraft can be at its age: a 25-year-old airframe never looks new again. */
function condCap(a: any): number { return Math.max(60, 100 - acAge(a) * 1.2); }

let _condLast = 0;
/** Move wear and repairs on to now (also after the app was closed). */
function conditionAdvance() {
  const S: any = State, now = Date.now();
  const last = S.condTick || now; S.condTick = now;
  const hrs = Math.min(24 * 14, (now - last) / 3600e3);
  // repairs in progress (all jobs on one aircraft share the same start and length)
  const done: { [reg: string]: any[] } = {};
  for (const i of State.issues as any[]) {
    if (i.status !== 'scheduled') continue;
    const a: any = plane(i.reg); if (!a) continue;
    if (!i.startedAt) { repairAll(i.reg); continue; }          // paid for but never started (older versions)
    if (a.status === 'flying') { i.startedAt = now; continue; }   // starts when the aircraft is back on the ground
    if (a.status !== 'maintenance') a.status = 'maintenance';
    const k = clamp((now - i.startedAt) / (i.durMin * 60000), 0, 1);
    a.condition = Math.round(i.fromCond + (i.toCond - i.fromCond) * k);
    if (k >= 1) { i.status = 'fixed'; (done[i.reg] = done[i.reg] || []).push(i); }
  }
  for (const reg of Object.keys(done)) {
    const a: any = plane(reg), jobs = done[reg];
    if (State.issues.some((x: any) => x.reg === reg && x.status === 'scheduled')) continue;
    a.status = State.issues.some((x: any) => x.reg === reg && x.status === 'open' && x.severity === 'grounding') ? 'grounded' : 'parked';
    try { crewAfterRepair(a.companyId, a.location || a.base, jobs[0].durMin); } catch (e) { /* ignore */ }
    noticesAt(Date.now());
    State.notices.unshift({ id: uid(), kind: 'mechanic', title: `${reg} is ${jobs[0].instant ? 'repaired' : 'out of the hangar'}`, body: `${jobs.map(j => j.title).join(', ')} done${jobs[0].instant ? '' : ' in ' + jobs[0].durMin + ' minutes'}. Condition ${Math.round(a.condition)}%. Ready for its next flight.`, time: 'Now', read: false } as any);
    noticesAt((jobs[0].startedAt || Date.now()) + (jobs[0].durMin || 0) * 60000);
  }
  if (hrs <= 0) return;
  // daily care: aircraft on the ground at their base slowly recover, more with good mechanics;
  // everything ages a little; poorly kept aircraft lose condition even standing still
  const qBy: { [cid: string]: any } = {};
  for (const a of State.fleet as any[]) {
    if (a.status === 'maintenance') continue;
    const mq = qBy[a.companyId] || (qBy[a.companyId] = maintQuality(a.companyId));
    const age = acAge(a), cap = condCap(a);
    const care = (mq.q - 0.55) * 0.35 * hrs;              // good maintenance gains, poor maintenance loses
    const ageing = (0.004 + age * 0.0006) * hrs;
    a.condition = clamp(Math.round((a.condition + care - ageing) * 10) / 10, 1, cap);
    if (a.condition > cap) a.condition = cap;
  }
}

/** Wear from one flight: hours, a take-off and a landing; worse for old aircraft and poor upkeep. */
function conditionAfterFlight(a: any, blockMin: number) {
  const mq = maintQuality(a.companyId), age = acAge(a);
  const wear = (blockMin / 60 * 0.12 + 0.35) * (1 + age / 25) * (1.6 - mq.q);
  a.condition = clamp(Math.round((a.condition - wear) * 10) / 10, 1, 100);
}

/** After a hired pilot's landing: worn aircraft may divert with a problem, and in the worst state crash. */
function conditionRisk(a: any, f: any): boolean {
  try { if (mechErrorRisk(a, f)) return true; } catch (e) { /* ignore */ }
  const c = a.condition, mk = typeof mechRiskFactor === 'function' ? mechRiskFactor(a.companyId, a.base) : 1;
  const engRel = typeof engineOf === 'function' && engineOf(a) ? engineOf(a).rel : 1;   // some engines need more inspections
  if (c < 55 && Math.random() < Math.pow((55 - c) / 55, 2) * 0.08 * engRel * mk) {
    const sev = c < 35 ? 'grounding' : 'major';
    const what = ['an engine running rough', 'a hydraulic leak', 'smoke from an electrical fault', 'a pressurisation fault', 'a landing gear that wouldn\'t lock down'][Math.floor(Math.random() * 5)];
    State.issues.unshift({ id: uid(), reg: a.reg, title: 'Emergency landing', detail: `${f.callsign} declared an emergency with ${what} and landed safely at ${f.to}. Inspection and repair needed.`, source: `Condition ${Math.round(c)}% at the time`, severity: sev as any, cost: Math.round(acType(a.typeId).price * (sev === 'grounding' ? 0.004 : 0.0015) / 100) * 100, days: 0, status: 'open', date: dateStr(new Date()).slice(0, 10) } as any);
    a.status = sev === 'grounding' ? 'grounded' : a.status;
    State.notices.unshift({ id: uid(), kind: 'pilot', title: `Emergency landing: ${f.callsign}`, body: `${f.callsign} (${a.reg}) declared an emergency with ${what} and landed safely at ${f.to}. ${a.reg} needs repair.`, time: 'Now', read: false } as any);
    try { Progress.popularity(-2, 'An emergency landing'); } catch (e) { /* ignore */ }
    return false;
  }
  if (c < 35 && Math.random() < Math.pow((35 - c) / 35, 2) * 0.006 * mk) { conditionAccident(a, f); return true; }
  return false;
}

/** A serious accident of an aircraft flown by your crew. The accident investigation board looks into it
 *  (investigation.ts): the cause, and whether anyone goes to court, follow from the airline's real state. */
function conditionAccident(a: any, f: any) {
  const co = company(a.companyId), typeId = a.typeId, pax = f.pax || 0;
  // how bad: the worse the aircraft's state, the worse the accident
  const sev = clamp((40 - (a.condition || 40)) / 40 + State.issues.filter((i: any) => i.reg === a.reg && i.status === 'open').length * 0.12, 0, 1);
  const dead = sev > 0.45 ? Math.max(1, Math.round(pax * (0.15 + 0.6 * sev))) : 0, injured = Math.min(pax - dead, Math.round(pax * (0.2 + 0.5 * sev)));
  const issues = (State.issues as any[]).filter(i => i.reg === a.reg && i.status === 'open').map(i => i.title);
  try { investigationOpen({ key: f.id || uid(), cid: co.id, reg: a.reg, typeId, from: f.from, to: f.to, pax, dead, injured, level: 'destroyed', parts: ['Fuselage broken', 'Wings', 'Engines'], you: false, pilotId: f.pilotId, notes: '', cond: a.condition, issues }); } catch (e) { /* no investigation */ }
  courtWriteOff(a, { reg: a.reg } as any);
  try { setTimeout(() => newsCrash({ key: f.id || uid(), c: co, typeId, reg: a.reg, callsign: f.callsign, from: f.from, to: f.to, pax, dead: dead > 0 }), 5000); } catch (e) { /* ignore */ }
  State.notices.unshift({ id: uid(), kind: 'pilot', ref: 'crash3d-' + f.to, title: `Serious accident: ${f.callsign}`, body: `${a.reg} crashed on arrival at ${f.to}. ${dead ? `${dead} ${dead === 1 ? 'person' : 'people'} died.` : 'Everyone on board survived, some with injuries.'} The accident investigation board has opened an investigation.`, time: 'Now', read: false } as any);
  try { Progress.popularity(dead ? -30 : -15, 'A serious accident'); } catch (e) { /* ignore */ }
}

function startConditionClock() {
  conditionAdvance();
  setInterval(() => { conditionAdvance(); }, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { conditionAdvance(); try { refresh(); } catch (e) { /* ignore */ } } });
}
