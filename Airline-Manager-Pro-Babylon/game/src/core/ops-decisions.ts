// At the gate, and the weather before departure.
//  - The turnaround, live: for an aircraft on the ground between two legs, a timeline of what is being done
//    (passengers off, cleaning, catering, fuel, bags out and in, boarding, push-back, and de-icing when it is cold
//    and wet), with where it stands now. When the next leg is late you can buy time back: an extra cleaning
//    team, a second fuel truck, priority catering, more gate agents. Each saves a few minutes, once.
//  - Weather decisions before departure (your airline's legs leaving in the next hour): with snow, sleet or
//    freezing weather at the airport, priority de-icing or a wait in the queue; with thunderstorms at the
//    destination, wait for them to pass, carry extra fuel, or go as planned and accept the risk of a diversion.

interface TaStep { id: string; name: string; a: number; b: number; ic: string }

function taLeg(reg: string): any {
  const a: any = plane(reg); if (!a) return null;
  return (((State as any).aiNext || []) as any[]).filter(n => n.reg === reg && n.from === (a.location || n.from) && n.depAt > Date.now() - 60e3).sort((x, y) => x.depAt - y.depAt)[0] || null;
}
/** Cold and wet at an airport: de-icing needed. */
function taIcing(icao: string): boolean {
  try { const m: any = LiveWx.get(icao); return !!(m && m.temp != null && m.temp <= 3 && /SN|SG|PL|FZ|RA|DZ|BR/.test(String(m.wx || m.raw || ''))); } catch (e) { return false; }
}
function taSteps(icing: boolean): TaStep[] {
  const L: TaStep[] = [
    { id: 'off', name: 'Passengers off', a: 0, b: 0.15, ic: 'pax' }, { id: 'unload', name: 'Bags and cargo out', a: 0.04, b: 0.3, ic: 'routes' },
    { id: 'clean', name: 'Cleaning', a: 0.15, b: 0.38, ic: 'check' }, { id: 'cater', name: 'Catering', a: 0.16, b: 0.45, ic: 'star' },
    { id: 'fuel', name: 'Fuel', a: 0.2, b: 0.55, ic: 'finance' }, { id: 'load', name: 'Bags and cargo in', a: 0.48, b: 0.86, ic: 'routes' },
    { id: 'board', name: 'Boarding', a: 0.55, b: 0.9, ic: 'pax' }, { id: 'push', name: 'Doors closed, push-back', a: 0.93, b: 1, ic: 'fleet' },
  ];
  if (icing) { L.forEach(s => { if (s.id === 'push') { s.a = 0.8; s.b = 0.84; } }); L.push({ id: 'deice', name: 'De-icing', a: 0.85, b: 1, ic: 'cloud' }); }
  return L;
}
const TA_BUY: { id: string; name: string; cost: number; min: number }[] = [
  { id: 'clean', name: 'An extra cleaning team', cost: 900, min: 6 }, { id: 'fuel', name: 'A second fuel truck', cost: 1200, min: 5 },
  { id: 'cater', name: 'Priority catering', cost: 700, min: 4 }, { id: 'board', name: 'More gate agents for boarding', cost: 600, min: 5 },
];
/** The turnaround of an aircraft at the gate, for the Schedule: its timeline and the ways to buy time back. */
function turnaroundHtml(reg: string): string {
  const a: any = plane(reg), n = taLeg(reg); if (!a || !n || a.status === 'flying' || State.live.some((f: any) => f.reg === reg)) return '';
  const g0 = a.lastGateAt || (n.depAt - 45 * 60e3), d = n.depAt, T = Math.max(10 * 60e3, d - g0), now = Date.now(), k = clamp((now - g0) / T, 0, 1);
  if (k >= 1 || now < g0) return '';
  const icing = taIcing(n.from), steps = taSteps(icing), late = Math.round((d - (n.sched || d)) / 60000), bought: string[] = n.taBuy || [];
  const hm = (t: number) => { const x = new Date(t); return String(x.getHours()).padStart(2, '0') + ':' + String(x.getMinutes()).padStart(2, '0'); };
  return `<div class="ta"><div class="ta-h"><b>${icon('clock')}Turnaround at ${esc(n.from)}</b><small>At the gate ${hm(g0)} · doors close ${hm(d - T * 0.07)} · off blocks ${hm(d)}${late > 0 ? ` · <em>${late} min late</em>` : ''}</small></div>
    <div class="ta-tl">${steps.map(s => { const st = k >= s.b ? 'done' : k >= s.a ? 'now' : ''; const p = clamp((k - s.a) / (s.b - s.a), 0, 1);
      return `<div class="ta-s ${st}"><span>${icon(s.ic)}${esc(s.name)}</span><i class="ta-trk"><u style="left:${(s.a * 100).toFixed(1)}%;width:${((s.b - s.a) * 100).toFixed(1)}%"><em style="width:${(p * 100).toFixed(0)}%"></em></u><b class="ta-now" style="left:${(k * 100).toFixed(1)}%"></b></i></div>`; }).join('')}</div>
    ${late > 0 ? `<div class="ta-buy"><small>Buy time back on the late departure:</small>${TA_BUY.map(x => `<button class="btn sm ${bought.indexOf(x.id) >= 0 ? 'ghost' : ''}" data-act="ta-buy" data-reg="${esc(reg)}" data-k="${x.id}" ${bought.indexOf(x.id) >= 0 ? 'disabled' : ''}>${esc(x.name)}<small>${bought.indexOf(x.id) >= 0 ? 'Done' : `${money(x.cost)} · −${x.min} min`}</small></button>`).join('')}</div>` : ''}
    ${icing && !(n.taBuy || []).includes('deice') ? `<div class="ta-buy"><small>${icon('cloud')}Cold and wet at ${esc(n.from)}: de-icing before departure.</small><button class="btn sm" data-act="ta-buy" data-reg="${esc(reg)}" data-k="deice">Priority de-icing<small>${money(2800)} · no wait in the queue</small></button></div>` : ''}
  </div>`;
}
ACTIONS['ta-buy'] = el => {
  const reg = el.getAttribute('data-reg'), k = el.getAttribute('data-k'), n = taLeg(reg), a: any = plane(reg); if (!n || !a) return;
  n.taBuy = n.taBuy || []; if (n.taBuy.indexOf(k) >= 0) return;
  const x = TA_BUY.filter(q => q.id === k)[0] || (k === 'deice' ? { id: 'deice', name: 'Priority de-icing', cost: 2800, min: 20 } : null); if (!x) return;
  const floor = Math.max(Date.now() + 3 * 60e3, n.sched || 0);   // never before the timetable, nor in the next few minutes
  n.depAt = Math.max(floor, n.depAt - x.min * 60e3); n.taBuy.push(k);
  payTxn(a.companyId, `${x.name} at ${n.from} for ${reg}`, -x.cost, 'fees', [[x.name, -x.cost]]);
  Store.soon(); Sound.tick(); toast(`${x.name}: ${reg} leaves earlier`, 'ok'); try { schedRefreshAll(); } catch (e) { refresh(); }
};

/* ---------- weather decisions before departure ---------- */
function wxDecideWatch() {
  if (!soloMode() || Store.nogame() || (typeof TitleScreen !== 'undefined' && TitleScreen.on)) return;
  const S: any = State, c: any = company(), cid = c.id, now = Date.now();
  S.wxAsk = S.wxAsk || { day: '', n: 0, seen: {} }; const W = S.wxAsk, day = new Date().toDateString();
  if (W.day !== day) { W.day = day; W.n = 0; W.seen = {}; }
  if (W.n >= 4) return;
  for (const n of (S.aiNext || []) as any[]) {
    const a: any = plane(n.reg); if (!a || a.companyId !== cid || n.from === n.to || n.depAt < now + 10 * 60e3 || n.depAt > now + 60 * 60e3) continue;
    const key = n.reg + '|' + n.from + '|' + n.sched; if (W.seen[key]) continue;
    let mTo: any = null; try { mTo = LiveWx.get(n.to); } catch (e) { mTo = null; }
    const storm = !!(mTo && /TS/.test(String(mTo.wx || mTo.raw || '')));
    const icing = taIcing(n.from) && !(n.taBuy || []).includes('deice');
    if (!storm && !icing) continue;
    W.seen[key] = now; W.n++;
    const nm = `${n.callsign || n.reg} ${n.from} → ${n.to}`;
    if (icing) lifeAdd({ id: 'life-' + uid(), kind: 'wx-ice', at: now, title: `De-icing for ${nm}`, text: `It is cold and wet at ${n.from}: ${n.reg} must be de-iced before it leaves. The queue at the de-icing pad is long this morning.`,
      data: { reg: n.reg, from: n.from, sched: n.sched }, opts: [{ id: 'prio', label: 'Book priority de-icing', sub: `${money(2800)}; no wait` }, { id: 'queue', label: 'Wait in the queue', sub: 'About 35 minutes later' }] });
    else lifeAdd({ id: 'life-' + uid(), kind: 'wx-ts', at: now, title: `Thunderstorms at ${n.to}`, text: `Thunderstorms are reported at ${n.to} (${esc(String(mTo.raw || '').slice(0, 60))}). ${nm} is due to leave within the hour.`,
      data: { reg: n.reg, from: n.from, to: n.to, sched: n.sched }, opts: [
        { id: 'wait', label: 'Wait for them to pass', sub: 'Leave 45 minutes later' },
        { id: 'fuel', label: 'Carry 30 minutes of extra fuel and go', sub: `About ${money(1800)} more fuel; can hold until it clears` },
        { id: 'go', label: 'Go as planned', sub: 'No cost now; a chance of a diversion to the alternate' }] });
  }
}
setInterval(() => { try { wxDecideWatch(); } catch (e) { /* next time */ } }, 60000);

/** The weather decisions' effects (called from lifeDecide). */
function wxDecide(e: LifeEv, opt: string): string {
  const d = e.data, n = (((State as any).aiNext || []) as any[]).filter(x => x.reg === d.reg && x.from === d.from && x.sched === d.sched)[0], a: any = plane(d.reg);
  if (!n || !a) return 'That flight has already left.';
  if (e.kind === 'wx-ice') {
    if (opt === 'prio') { payTxn(a.companyId, `Priority de-icing at ${d.from} for ${d.reg}`, -2800, 'fees', [['Priority de-icing', -2800]]); n.taBuy = (n.taBuy || []).concat('deice'); return `${d.reg} goes straight to the de-icing pad.`; }
    n.depAt += 35 * 60e3; n.why = 'Waiting in the de-icing queue'; n.taBuy = (n.taBuy || []).concat('deice'); return `${d.reg} leaves about 35 minutes later.`;
  }
  if (opt === 'wait') { n.depAt += 45 * 60e3; n.why = `Waiting for thunderstorms at ${d.to} to pass`; return `${d.reg} leaves 45 minutes later.`; }
  if (opt === 'fuel') { payTxn(a.companyId, `Extra fuel for ${d.reg} (thunderstorms at ${d.to})`, -1800, 'fuel', [['30 minutes of extra fuel', -1800]]); return `${d.reg} carries extra fuel and can hold.`; }
  if (Math.random() < 0.3) {
    const cost = 14000 + Math.round(Math.random() * 12000);
    setTimeout(() => { try { payTxn(a.companyId, `Diversion of ${d.reg}: thunderstorms at ${d.to}`, -cost, 'fees', [['Fuel, landing fees, buses and hotels', -cost]]); Progress.popularity(-0.6, 'A diversion'); State.notices.unshift({ id: uid(), kind: 'flight', title: `${d.reg} diverted`, body: `The storms at ${d.to} didn't clear in time: ${d.reg} went to its alternate. ${money(cost)} in costs.`, time: 'Now', at: Date.now(), read: false } as any); } catch (er) { /* none */ } }, 3 * 3600e3 / 60);
    return `${d.reg} goes as planned.`;
  }
  return `${d.reg} goes as planned.`;
}
