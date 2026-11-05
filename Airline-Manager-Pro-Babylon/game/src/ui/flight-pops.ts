// Flight pop-ups: a small card for each step of your airline's flights as it happens (yours and your pilots'):
// a delay, taxiing out, take-off, the departure, the approach, the landing, taxiing in and arriving at the gate.
// Tap one to follow that flight on the map. Settings → Flight pop-ups turns them all off, or each
// step on its own. A flight already under way when you open the app isn't announced again: only what happens next.

const FP_STEPS: { key: string; set: string; nset: string; label: string; icon: string }[] = [
  { key: 'delay', set: 'fpDelay', nset: 'fnDelay', label: 'Delays', icon: 'clock' },
  { key: 'taxiOut', set: 'fpTaxiOut', nset: 'fnTaxiOut', label: 'Taxiing out', icon: 'routes' },
  { key: 'takeoff', set: 'fpTakeoff', nset: 'fnTakeoff', label: 'Take-off', icon: 'fleet' },
  { key: 'departure', set: 'fpDeparture', nset: 'fnDeparture', label: 'Departure', icon: 'fleet' },
  { key: 'approach', set: 'fpApproach', nset: 'fnApproach', label: 'Approach', icon: 'fleet' },
  { key: 'landing', set: 'fpLanding', nset: 'fnLanding', label: 'Landing', icon: 'fleet' },
  { key: 'taxiIn', set: 'fpTaxiIn', nset: 'fnTaxiIn', label: 'Taxiing in', icon: 'routes' },
  { key: 'gate', set: 'fpGate', nset: 'fnGate', label: 'At the gate', icon: 'check' },
];
/** Phone notifications (Android): the same steps in the phone's notification shade, also with the app closed. */
function fnOn(step: string): boolean {
  const S: any = State.settings; if (S.fnOn === false) return false;
  const st = FP_STEPS.filter(x => x.key === step)[0]; return !st || S[st.nset] !== false;
}
function fpNative(): any { const cap = (window as any).Capacitor; return cap && cap.Plugins && cap.Plugins.LocalNotifications; }
const FP_ORDER = ['taxiOut', 'takeoff', 'departure', 'approach', 'landing', 'taxiIn', 'gate'];
function fpOn(step: string): boolean {
  const S: any = State.settings; if (S.fpOn === false) return false;
  const st = FP_STEPS.filter(x => x.key === step)[0]; return !st || S[st.set] !== false;
}
/** A profile phase as a step. */
function fpStep(phase: string): string {
  const p = String(phase || '');
  if (/^Taxi out/.test(p)) return 'taxiOut';
  if (/^Takeoff/.test(p)) return 'takeoff';
  if (/^Climb/.test(p)) return 'departure';
  if (/^(Approach|Final)/.test(p)) return 'approach';
  if (/^Landing/.test(p)) return 'landing';
  if (/^Taxi in/.test(p)) return 'taxiIn';
  if (/^Arrived/.test(p)) return 'gate';
  return '';
}

const FP: any = { seen: {}, gone: {}, delays: {}, started: false, shown: [] as HTMLElement[] };
/** Show a pop-up (several stack; the oldest go first). */
function fpShow(step: string, title: string, text: string, flightId: string) {
  if (document.hidden) { if (step === 'delay') fnNow(step, title, text); return; }
  if (!fpOn(step)) return;
  if (typeof TitleScreen !== 'undefined' && TitleScreen.on) return;
  if (document.querySelector('.v3v, .sal3d, .bdr')) return;   // not over a 3D view or a badge being shown
  let host = document.querySelector('.fp-stack') as HTMLElement;
  if (!host) { host = document.createElement('div'); host.className = 'fp-stack'; document.body.appendChild(host); }
  const st = FP_STEPS.filter(x => x.key === step)[0];
  const el = document.createElement('button'); el.className = `fp fp-${step}`;
  el.innerHTML = `<span class="fp-ic">${icon(st ? st.icon : 'fleet')}</span><span class="fp-t"><b>${esc(title)}</b><small>${esc(text)}</small></span><i class="fp-x" aria-label="Dismiss">${icon('close')}</i>`;
  el.addEventListener('click', (e: Event) => {
    const x = (e.target as HTMLElement).closest('.fp-x'); fpDrop(el);
    if (x) return;
    try { if (State.live.some(f => f.id === flightId)) showFlightOnMap(flightId); else go('schedule'); } catch (er) { /* gone */ }
  });
  host.appendChild(el); FP.shown.push(el);
  while (FP.shown.length > 4) fpDrop(FP.shown[0]);
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => fpDrop(el), 7000);
}
function fpDrop(el: HTMLElement) {
  FP.shown = FP.shown.filter((x: HTMLElement) => x !== el);
  if (!el.isConnected || el.classList.contains('out')) return;
  el.classList.add('out'); setTimeout(() => el.remove(), 300);
}

/** The name the flight goes by, and where it is going. */
function fpName(f: any): string { return `${f.callsign || f.reg} ${f.from} → ${f.to}`; }
function fpWatch() {
  const S: any = State, cid = State.companyId, mine = (reg: string) => { const a: any = plane(reg); return a && a.companyId === cid; };
  const first = !FP.started; FP.started = true;
  const now = Date.now(), live = (State.live || []).filter((f: any) => f.from !== f.to && (f.you || f.id === 'me' || mine(f.reg)));
  const ids: any = {};
  for (const f of live as any[]) {
    ids[f.id] = 1;
    // held at the gate or short of the runway: a delay
    const ph = String(f.phase || '');
    if (/^Delayed: /.test(ph)) { const k = f.id + '|' + ph; if (!FP.delays[k]) { FP.delays[k] = now; if (!first) fpShow('delay', `${fpName(f)} delayed`, ph.replace(/^Delayed: /, ''), f.id); } continue; }
    const step = fpStep(ph); if (!step) continue;
    const prev = FP.seen[f.id], i = FP_ORDER.indexOf(step);
    if (prev == null) { FP.seen[f.id] = { i, f }; if (first) continue; }
    else if (i <= prev.i) { prev.f = f; continue; }
    FP.seen[f.id] = { i, f };
    if (first) continue;
    let fp: any = null; try { fp = flightPathFor(f.from, f.to); } catch (e) { fp = null; }
    const part = (k: string) => fp && fp.parts ? (fp.parts.filter((x: any) => x.kind === k)[0] || {}).name || '' : '';
    const rwyD = fp && fp.dep ? 'runway ' + fp.dep.name : 'the runway', rwyA = fp && fp.arr ? 'runway ' + fp.arr.name : 'the runway';
    const txt: any = {
      taxiOut: `Pushed back, taxiing to ${rwyD} at ${f.from}`,
      takeoff: `Taking off from ${rwyD} at ${f.from}`,
      departure: `Climbing out${part('sid') ? ' on the ' + part('sid') : ''}`,
      approach: `On approach to ${f.to}${part('app') ? ': ' + part('app') : ' ' + rwyA}`,
      landing: `Landing on ${rwyA} at ${f.to}`,
      taxiIn: `Landed, taxiing to the gate at ${f.to}`,
      gate: `At the gate at ${f.to}`,
    };
    const head: any = { taxiOut: 'taxiing out', takeoff: 'taking off', departure: 'departing', approach: 'on approach', landing: 'landing', taxiIn: 'taxiing in', gate: 'at the gate' };
    fpShow(step, `${fpName(f)} ${head[step]}`, txt[step], f.id);
  }
  // flights that have left the list: they reached the gate
  for (const id of Object.keys(FP.seen)) {
    if (ids[id]) continue;
    const s = FP.seen[id]; delete FP.seen[id];
    if (!first && s.i >= FP_ORDER.indexOf('landing')) fpShow('gate', `${fpName(s.f)} at the gate`, `Arrived at ${s.f.to}${s.f.pax ? ', ' + s.f.pax + ' passengers' : ''}`, id);
  }
  // departures held up before they left: the waiting legs
  for (const n of (S.aiNext || []) as any[]) {
    if (!n.why || !mine(n.reg)) continue;
    const k = n.reg + '|' + n.from + '|' + n.to + '|' + n.sched + '|' + n.why;
    if (FP.delays[k]) continue; FP.delays[k] = now;
    const late = Math.round((n.depAt - n.sched) / 60000);
    if (!first && late >= 5) fpShow('delay', `${fpName(n)} delayed ${late} min`, n.why, '');
  }
  // forget old delays
  for (const k of Object.keys(FP.delays)) if (now - FP.delays[k] > 12 * 3600e3) delete FP.delays[k];
}
setInterval(() => { try { fpWatch(); } catch (e) { /* next time */ } }, 3000);

/** Settings → Flight pop-ups: the switches, for the pop-ups in the app and (on a phone or tablet) the phone's
 *  notifications: all of them at once, or each step on its own. */
function fpSettingsHtml(): string {
  const S: any = State.settings, all = S.fpOn !== false, nall = S.fnOn !== false, phone = !!fpNative();
  const tg = (key: string, on: boolean, dis: boolean, lab: string) => `<button class="tg ${on ? 'on' : ''}" role="switch" aria-checked="${on}" aria-label="${esc(lab)}" data-act="fp-toggle" data-k="${key}" ${dis ? 'disabled' : ''}><i></i></button>`;
  return `<div class="fp-set">
    <div class="fp-grid ${phone ? 'two' : ''}">
      <span></span><small class="fp-col">In the app</small>${phone ? '<small class="fp-col">Phone notifications</small>' : ''}
      <span class="fp-lab"><b>All flight pop-ups</b><small>A small card for each step of your airline's flights as it happens. Tap one to follow the flight on the map.${phone ? ' Phone notifications also arrive with the app closed.' : ''}</small></span>
      ${tg('fpOn', all, false, 'All flight pop-ups in the app')}${phone ? tg('fnOn', nall, false, 'All phone notifications') : ''}
      ${FP_STEPS.map(st => `<span class="fp-lab sub ${!all && (!phone || !nall) ? 'dim' : ''}"><b>${st.label}</b></span>${tg(st.set, all && S[st.set] !== false, !all, st.label + ' in the app')}${phone ? tg(st.nset, nall && S[st.nset] !== false, !nall, st.label + ' as phone notifications') : ''}`).join('')}
    </div></div>`;
}
ACTIONS['fp-toggle'] = el => {
  const k = el.getAttribute('data-k'), S: any = State.settings; S[k] = S[k] === false; Sound.tick(); Store.soon();
  const box = el.closest('.fp-set') as HTMLElement; if (box) box.outerHTML = fpSettingsHtml();
  fnSchedule();
};

/* ---------- phone notifications: scheduled ahead for every step of the flights in the air, so they arrive with
 * the app closed; while the app is open the cards in the app are shown instead ---------- */
const FN_BASE = 52000, FN_MAX = 120;
function fnCancel(): Promise<any> { const LN = fpNative(); if (!LN) return Promise.resolve(); return Promise.resolve(LN.cancel({ notifications: Array.from({ length: FN_MAX }, (_, i) => ({ id: FN_BASE + i })) })).catch(() => { /* none */ }); }
function fnSchedule() {
  const LN = fpNative(); if (!LN) return;
  fnCancel().then(() => {
    if (!document.hidden || (State.settings as any).fnOn === false) return;   // the app is open: its own cards
    const now = Date.now(), cid = State.companyId, out: any[] = [];
    const head: any = { taxiOut: 'taxiing out', takeoff: 'taking off', departure: 'departing', approach: 'on approach', landing: 'landing', taxiIn: 'taxiing in', gate: 'at the gate' };
    const add = (at: number, step: string, title: string, body: string) => { if (out.length >= FN_MAX || at <= now + 30e3 || at > now + 24 * 3600e3 || !fnOn(step)) return; try { if (quietAt(at)) return; } catch (e) { /* none */ }
      out.push({ id: FN_BASE + out.length, title, body, schedule: { at: new Date(at), allowWhileIdle: true }, extra: { kind: 'flight', step } }); };
    for (const f of State.live as any[]) {
      if (!f.depAt || f.from === f.to) continue; const a: any = plane(f.reg); if (!a || a.companyId !== cid || f.you) continue;
      let prof: any = null; try { prof = aiProfile(f); } catch (e) { continue; }
      const spd = f.spd || 1, t = (sec: number) => f.depAt + sec * 1000 / spd, first = (re: RegExp) => (prof.pts.filter((q: any) => re.test(q.ph))[0] || null);
      let fp: any = null; try { fp = flightPathFor(f.from, f.to); } catch (e) { fp = null; }
      const rD = fp && fp.dep ? ' on runway ' + fp.dep.name : '', rA = fp && fp.arr ? ' on runway ' + fp.arr.name : '', nm = `${f.callsign || f.reg} ${f.from} → ${f.to}`;
      const tk = first(/^Takeoff/), cl = first(/^Climb/), ap = first(/^(Approach|Final)/), ld = first(/^Landing/), ti = first(/^Taxi in/);
      if (tk) add(t(tk.s), 'takeoff', `${nm} ${head.takeoff}`, `Taking off${rD} at ${f.from}`);
      if (cl) add(t(cl.s), 'departure', `${nm} ${head.departure}`, 'Climbing out');
      if (ap) add(t(ap.s), 'approach', `${nm} ${head.approach}`, `On approach to ${f.to}`);
      if (ld) add(t(ld.s), 'landing', `${nm} ${head.landing}`, `Landing${rA} at ${f.to}`);
      if (ti) add(t(ti.s), 'taxiIn', `${nm} ${head.taxiIn}`, `Landed, taxiing to the gate at ${f.to}`);
      try { add(aiEndAt(f), 'gate', `${nm} ${head.gate}`, `At the gate at ${f.to}${f.pax ? ', ' + f.pax + ' passengers' : ''}`); } catch (e) { /* none */ }
    }
    for (const n of ((State as any).aiNext || []) as any[]) {
      const a: any = plane(n.reg); if (!a || a.companyId !== cid || n.from === n.to) continue;
      add(n.depAt, 'taxiOut', `${n.callsign || n.reg} ${n.from} → ${n.to} taxiing out`, `Pushed back at ${n.from}`);
    }
    out.sort((x, y) => x.schedule.at - y.schedule.at); out.forEach((x, i) => x.id = FN_BASE + i);
    if (out.length) return LN.schedule({ notifications: out });
  }).catch(() => { /* notifications not allowed */ });
}
// when the app goes to the background they are scheduled; back in the app, the cards take over
document.addEventListener('visibilitychange', () => { try { fnSchedule(); } catch (e) { /* none */ } });
setInterval(() => { if (document.hidden) try { fnSchedule(); } catch (e) { /* none */ } }, 10 * 60e3);
/** A delay noticed while the app is in the background: straight to the phone. */
function fnNow(step: string, title: string, body: string) {
  const LN = fpNative(); if (!LN || !fnOn(step)) return;
  try { LN.schedule({ notifications: [{ id: FN_BASE + FN_MAX + Math.floor(Math.random() * 500), title, body, schedule: { at: new Date(Date.now() + 1500) } }] }); } catch (e) { /* not allowed */ }
}
