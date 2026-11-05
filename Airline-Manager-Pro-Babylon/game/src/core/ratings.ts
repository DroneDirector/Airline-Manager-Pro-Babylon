// Type ratings and the landing leaderboard.
//
// Type ratings, as in real airline flying: a pilot may only fly the aircraft types on their licence.
//  - A hired pilot can only be put on a route flown with a type they are rated on.
//  - To add a type, you send them on a type rating course: a few days of ground school and simulator
//    training (longer for bigger aircraft, paid by the airline), ending with a check ride. Most pass;
//    a pilot who fails can take the check ride again for a third of the price.
//  - Your own pilot: the first flight you fly yourself on a new type is your check ride. Land it well
//    (under 400 fpm and 1.6 g, without damage) and the type goes on your licence; otherwise try again.
// The landing leaderboard keeps every landing: yours, your hired pilots' and your co-op pilots'.

interface LandRec { who: string; name: string; fpm: number; g: number; at: number; from: string; to: string; typeId: string; kind: 'you' | 'ai' | 'coop' }

const TRAINING_COST: { [cls: string]: number } = { widebody: 38000, airliner: 26000, regional: 19000, turboprop: 13000, bush: 5500, ga: 2500, helicopter: 22000 };
const TRAINING_DAYS: { [cls: string]: number } = { widebody: 4, airliner: 3, regional: 3, turboprop: 2, bush: 1, ga: 1, helicopter: 3 };
/** Helicopters and aeroplanes are separate licences: a pilot with only one kind needs a full conversion (a commercial
 *  licence for the other kind: far longer and dearer than a type course) before their first type of the other kind. */
function ratingConversion(p: any, typeId: string): boolean {
  const t = acType(typeId); if (!t || !p || p.you) return false; const heli = t.cls === 'helicopter', have = (p.types || []).map((k: string) => acType(k)).filter(Boolean);
  return have.length > 0 && !have.some((x: any) => (x.cls === 'helicopter') === heli);
}

const Ratings = {
  rated(p: any, typeId: string): boolean {
    if (!p) return false;
    if (p.you || String(p.id).indexOf('coop') === 0 || (p.companyId && String(p.companyId).indexOf('coop:') === 0)) return true;
    return (p.types || []).indexOf(typeId) >= 0;
  },
  cost(typeId: string, p?: any): number { const t = acType(typeId); return (TRAINING_COST[t ? t.cls : 'airliner'] || 20000) * (ratingConversion(p, typeId) ? 4 : 1); },
  days(typeId: string, p?: any): number { const t = acType(typeId); return (TRAINING_DAYS[t ? t.cls : 'airliner'] || 3) * (ratingConversion(p, typeId) ? 5 : 1); },

  /** Send a hired pilot on a type rating course. The course runs on the real clock (faster with a faster
   *  virtual pilot speed), and the pilot doesn't fly meanwhile. */
  train(p: any, typeId: string, retake?: boolean): boolean {
    if (!p || p.you || p.status === 'training' || this.rated(p, typeId)) return false;
    const t = acType(typeId), cost = Math.round(this.cost(typeId, p) * (retake ? 0.34 : 1)), conv = ratingConversion(p, typeId);
    const c = company(p.companyId && State.companies.some(x => x.id === p.companyId) ? p.companyId : State.companyId);
    const before = c.balance;
    payTxn(c.id, `${retake ? 'Check ride again' : conv ? (t.cls === 'helicopter' ? 'Helicopter licence conversion' : 'Aeroplane licence conversion') : 'Type rating course'}: ${p.name}, ${t.maker} ${t.model}`, -cost, 'training',
      retake ? [['Simulator session and examiner', -cost]] : [['Ground school', -Math.round(cost * 0.3)], ['Full flight simulator', -Math.round(cost * 0.55)], ['Check ride with an examiner', -(cost - Math.round(cost * 0.3) - Math.round(cost * 0.55))]]);
    const dur = (retake ? 0.5 : this.days(typeId, p)) * 864e5 / Math.max(1, Math.min(10, aiSpeed()));
    p.prevStatus = p.status === 'flying' ? 'standby' : p.status; p.status = 'training'; p.training = { typeId, until: Date.now() + dur, retake: !!retake }; p.trainingUntil = Date.now() + dur;
    try { animateBalance(before, c.balance); } catch (e) { /* ignore */ }
    return true;
  },

  /** Courses that have ended: the check ride, pass or fail. */
  advance() {
    const now = Date.now(); let changed = false;
    for (const p of State.pilots as any[]) {
      if (p.status !== 'training' || !p.training || p.training.until > now) continue;
      const tr = p.training, t = acType(tr.typeId), endAt = tr.until || now;
      noticesAt(now);
      // the better the pilot, the likelier the pass: 80% to 97%
      const pass = Math.random() < clamp(0.62 + (p.rating || 4) * 0.075, 0.8, 0.97) + (tr.retake ? 0.05 : 0);
      p.status = p.prevStatus && p.prevStatus !== 'training' ? p.prevStatus : 'standby'; delete p.training; delete p.trainingUntil; changed = true;
      if (pass) {
        (p.types = p.types || []).push(tr.typeId);
        State.notices.unshift({ id: uid(), kind: 'pilot', title: `${p.name} passed the check ride`, body: `Now rated on the ${t.maker} ${t.model}. You can put ${p.name.split(' ')[0]} on its routes.`, time: 'Now', read: false } as any);
        // a pilot already put on a route for this type starts flying it
        const r = State.routes.filter(x => x.pilotId === p.id && x.typeId === tr.typeId && !x.flownAt)[0];
        if (r) try { aiStartRoute(p.id, r); } catch (e) { /* ignore */ }
      } else {
        p.failedType = tr.typeId;
        State.notices.unshift({ id: uid(), kind: 'pilot', title: `${p.name} didn't pass the check ride`, body: `${t.maker} ${t.model}: the examiner wants to see it again. Book the check ride again under Pilots for ${money(Math.round(this.cost(tr.typeId) * 0.34))}.`, time: 'Now', read: false } as any);
      }
      noticesAt(endAt);
    }
    if (changed) { Store.save(); try { renderTopbar(); if (State.screen === 'pilots') refresh(); } catch (e) { /* ignore */ } }
  },

  /** After your own flight: on a type you aren't rated on yet, this was your check ride. */
  myCheckRide(typeId: string, fpm: number, g: number, damaged: boolean) {
    const me: any = myPilot(); if (!me || !typeId) return;
    me.types = me.types || [];
    if (me.types.indexOf(typeId) >= 0) return;
    const t = acType(typeId); if (!t) return;
    try { if (coopMyCheckRide(typeId, fpm, g, damaged)) return; } catch (e) { /* ignore */ }
    if (Math.abs(fpm) < 400 && g < 1.6 && !damaged) {
      me.types.push(typeId);
      State.notices.unshift({ id: uid(), kind: 'pilot', title: `Check ride passed: ${t.maker} ${t.model}`, body: `Landed at ${Math.abs(fpm)} fpm and ${g.toFixed(2)} g. The ${t.model} is on your licence now.`, time: 'Now', read: false } as any);
      try { toast(`Type rating: ${t.model} added to your licence`, 'ok'); } catch (e) { /* ignore */ }
    } else {
      State.notices.unshift({ id: uid(), kind: 'pilot', title: `Check ride not passed: ${t.maker} ${t.model}`, body: `${Math.abs(fpm)} fpm, ${g.toFixed(2)} g${damaged ? ', with damage' : ''}. A check ride needs a landing under 400 fpm and 1.6 g without damage. Your next flight in the ${t.model} is another try.`, time: 'Now', read: false } as any);
    }
  },

  /** Saves from before type ratings: pilots keep the types of the routes they were already flying. */
  grandfather() {
    for (const p of State.pilots as any[]) {
      if (p.you || String(p.id).indexOf('coop') === 0) continue;
      p.types = p.types || [];
      State.routes.filter(r => r.pilotId === p.id).forEach(r => { if (p.types.indexOf(r.typeId) < 0) p.types.push(r.typeId); });
      const f = State.live.filter(x => x.pilotId === p.id)[0], a = f ? plane(f.reg) : null;
      if (a && p.types.indexOf(a.typeId) < 0) p.types.push(a.typeId);
    }
  },

  /* ---------- Landings ---------- */
  list(): LandRec[] { const S: any = State; return S.landRecs = S.landRecs || []; },
  record(r: LandRec) { const l = this.list(); l.unshift(r); if (l.length > 1500) l.length = 1500; },
  /** A hired pilot's landing: how firm depends on the pilot, the aircraft and the wind. */
  aiLanding(f: LiveFlight, at: number) {
    if (f.from === f.to) return;
    const p: any = pilot(f.pilotId); if (!p) return;
    const a = plane(f.reg), t = a ? acType(a.typeId) : null, B: any = apt(f.to);
    const w = B ? airportWind(f.to, B.pos) : { kt: 8 };
    const skill = clamp(5 - workRating(p), 0, 2.6);   // an unhappy pilot flies worse
    const r = (k: string) => (hashMix(f.id + k) % 1000) / 1000;
    const fpm = Math.round(70 + skill * 110 + r('a') * 170 + Math.max(0, w.kt - 12) * 6 + (t && (t.cls === 'bush' || t.cls === 'ga') ? 30 : 0) + (r('b') < 0.03 ? 220 : 0));
    const g = Math.round((1.05 + fpm / 1600 + r('g') * 0.08) * 100) / 100;
    this.record({ who: p.id, name: p.name, fpm, g, at, from: f.from, to: f.to, typeId: t ? t.id : '', kind: 'ai' });
    (f as any).landFpm = fpm;
  },
};
