/* Sound in the 3D view, made in code (no recordings): the engines of the aircraft near the camera (jets:
 * a roar and a turbine whine; propellers: the beat of the blades), louder with power and nearer, and
 * thunder after lightning. Sound takes about 3 seconds a kilometre (5 seconds a mile) to arrive, and thunder
 * is heard out to about 16 km (10 miles); far away it is a low rumble, close by a sharp crack first.
 * Settings → Sound and feel: each can be switched off, and the volume set. */

const V3dSound: any = {
  ctx: null as AudioContext, master: null as GainNode, jet: null as any, prop: null as any, cab: null as any, at: 0,
  /** The cabin sound's own level (Settings → Sound and feel → 3D view); 0 mutes it. */
  cabVol(): number { const v = (State.settings as any).v3dCabinVol; return clamp(v == null ? 0.7 : +v, 0, 1); },

  vol(): number { const v = (State.settings as any).v3dVol; return clamp(v == null ? 0.7 : +v, 0, 1); },
  on(k: string): boolean { return (State.settings as any)[k] !== false; },

  /** The output for the 3D view's sounds (null when sound is off). */
  out(): GainNode {
    const ctx = audio(); if (!ctx) return null;
    if (this.ctx !== ctx || !this.master) { this.ctx = ctx; this.master = ctx.createGain(); this.master.connect(ctx.destination); this.jet = this.prop = this.cab = this.fol = null; }
    this.master.gain.setTargetAtTime(this.vol(), ctx.currentTime, 0.1);
    return this.master;
  },

  noise(ctx: AudioContext, secs: number, brown: boolean): AudioBuffer {
    const n = Math.floor(ctx.sampleRate * secs), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w; }
    return buf;
  },

  /** Thunder for a flash `d` metres away (a bolt to the ground is louder and sharper). */
  thunder(d: number, cg: boolean) {
    if (!this.on('v3dThunder') || d > 16000 || document.hidden) return;
    const out = this.out(); if (!out) return;
    const ctx = this.ctx, delay = d / 343, k = Math.pow(1 - d / 16000, 1.6) * (cg ? 1 : 0.6), t0 = ctx.currentTime + delay;
    const dur = 4 + d / 2500 + Math.random() * 3;
    const src = ctx.createBufferSource(); src.buffer = this.noise(ctx, dur, true);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 120 + 1600 * Math.pow(1 - d / 16000, 2.5);   // the air takes the high notes away with distance
    const g = ctx.createGain(), pan = (ctx as any).createStereoPanner ? (ctx as any).createStereoPanner() : null;
    g.gain.setValueAtTime(0.0001, t0);
    if (d < 3000 && cg) { g.gain.exponentialRampToValueAtTime(1.6 * k, t0 + 0.03); g.gain.exponentialRampToValueAtTime(0.5 * k, t0 + 0.6); }   // the crack
    else g.gain.exponentialRampToValueAtTime(0.9 * k + 0.0002, t0 + 0.5 + d / 8000);   // a rolling rumble
    // rolls on, rising and falling, then dies away
    for (let t = 1; t < dur - 1; t += 0.6 + Math.random()) g.gain.linearRampToValueAtTime((0.3 + Math.random() * 0.6) * k + 0.0002, t0 + t);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(lp); lp.connect(g);
    if (pan) { pan.pan.value = (Math.random() - 0.5) * 1.2; g.connect(pan); pan.connect(out); } else g.connect(out);
    src.start(t0); src.stop(t0 + dur + 0.1);
  },

  /** The outside sound's own level (Settings → Sound and feel: Outside noise). */
  outVol(): number { const v = (State.settings as any).v3dOutVol; return clamp(v == null ? 1 : +v, 0, 1.5); },
  /** The aircraft you follow, heard round it: an exhaust roar, the fan's whine, the intake's hiss and a propeller's
   *  beat, mixed by where the camera is, panned to its side. */
  followVoice(): any {
    const ctx = this.ctx, out = this.master, bus = ctx.createGain(); bus.gain.value = 0;
    const pan: any = (ctx as any).createStereoPanner ? (ctx as any).createStereoPanner() : { pan: ctx.createGain().gain, connect: (x: any) => bus.connect(x) };
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6000;
    bus.connect(lp); if ((ctx as any).createStereoPanner) { lp.connect(pan); pan.connect(out); } else lp.connect(out);
    const n = ctx.createBufferSource(); n.buffer = this.noise(ctx, 3, true); n.loop = true; n.start();
    const rlp = ctx.createBiquadFilter(); rlp.type = 'lowpass'; rlp.frequency.value = 500; const rg = ctx.createGain(); rg.gain.value = 0; n.connect(rlp); rlp.connect(rg); rg.connect(bus);
    const w = ctx.createBufferSource(); w.buffer = this.noise(ctx, 2, false); w.loop = true; w.start();
    const hbp = ctx.createBiquadFilter(); hbp.type = 'bandpass'; hbp.frequency.value = 2400; (hbp as any).Q.value = 0.8; const hg = ctx.createGain(); hg.gain.value = 0; w.connect(hbp); hbp.connect(hg); hg.connect(bus);
    const wo = ctx.createOscillator(); wo.type = 'sine'; wo.frequency.value = 3200; const wf = ctx.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 3200; (wf as any).Q.value = 5; const wg = ctx.createGain(); wg.gain.value = 0; wo.connect(wf); wf.connect(wg); wg.connect(bus); wo.start();
    const po = ctx.createOscillator(); po.type = 'sawtooth'; po.frequency.value = 90; const plp = ctx.createBiquadFilter(); plp.type = 'lowpass'; plp.frequency.value = 420; const pg = ctx.createGain(); pg.gain.value = 0; po.connect(plp); plp.connect(pg); pg.connect(bus); po.start();
    return { bus, pan, lp, rg, rlp, hg, hbp, wo, wf, wg, po, pg };
  },
  /** A running engine voice: its noise and tone sources, with gains and filters set every frame. */
  voice(prop: boolean): any {
    const ctx = this.ctx, out = this.master;
    const n = ctx.createBufferSource(); n.buffer = this.noise(ctx, 3, false); n.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    const ng = ctx.createGain(); ng.gain.value = 0;
    n.connect(lp); lp.connect(ng); ng.connect(out); n.start();
    const o = ctx.createOscillator(); o.type = prop ? 'sawtooth' : 'sine'; o.frequency.value = prop ? 90 : 3200;
    const of = ctx.createBiquadFilter(); of.type = prop ? 'lowpass' : 'bandpass'; of.frequency.value = prop ? 420 : 3200; (of as any).Q.value = prop ? 0.7 : 6;
    const og = ctx.createGain(); og.gain.value = 0;
    o.connect(of); of.connect(og); og.connect(out); o.start();
    let lfo: OscillatorNode = null;
    if (prop) { lfo = ctx.createOscillator(); lfo.frequency.value = 18; const lg = ctx.createGain(); lg.gain.value = 0.25; lfo.connect(lg); lg.connect(og.gain); lfo.start(); }
    return { n, lp, ng, o, of, og, lfo };
  },

  /** Inside the cabin: what passengers hear. The skin takes the high notes away, so the engines are a deep
   *  rumble and a steady drone (two engines a touch out of tune beat slowly against each other), the air
   *  rushing past the hull is a soft hiss that grows with speed, and at a window seat the engine on that side
   *  is nearer and louder. Propellers throb through the cabin. */
  cabinVoice(): any {
    const ctx = this.ctx, out = this.master;
    const bus = ctx.createGain(); bus.gain.value = 0;
    const pan = (ctx as any).createStereoPanner ? (ctx as any).createStereoPanner() : null;
    if (pan) { bus.connect(pan); pan.connect(out); } else bus.connect(out);
    const rn = ctx.createBufferSource(); rn.buffer = this.noise(ctx, 4, true); rn.loop = true;
    const rlp = ctx.createBiquadFilter(); rlp.type = 'lowpass'; rlp.frequency.value = 220; const rg = ctx.createGain(); rg.gain.value = 0;
    rn.connect(rlp); rlp.connect(rg); rg.connect(bus); rn.start();
    const an = ctx.createBufferSource(); an.buffer = this.noise(ctx, 3, false); an.loop = true;
    const abp = ctx.createBiquadFilter(); abp.type = 'bandpass'; abp.frequency.value = 900; (abp as any).Q.value = 0.5; const ag = ctx.createGain(); ag.gain.value = 0;
    an.connect(abp); abp.connect(ag); ag.connect(bus); an.start();
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(); o1.type = o2.type = 'triangle'; o1.frequency.value = 110; o2.frequency.value = 111.3;
    const olp = ctx.createBiquadFilter(); olp.type = 'lowpass'; olp.frequency.value = 320; const og = ctx.createGain(); og.gain.value = 0;
    o1.connect(olp); o2.connect(olp); olp.connect(og); og.connect(bus); o1.start(); o2.start();
    const lfo = ctx.createOscillator(); lfo.frequency.value = 16; const lg = ctx.createGain(); lg.gain.value = 0; lfo.connect(lg); lg.connect(og.gain); lfo.start();
    return { bus, pan, rn, rlp, rg, an, abp, ag, o1, o2, olp, og, lfo, lg };
  },

  /** Each frame in the 3D view: the engines near the camera. */
  step(now: number) {
    if (!V3d.open || !V3d.cam || document.hidden || !this.on('v3dEngines')) { this.quiet(); return; }
    if (now - this.at < 100) return; this.at = now;
    const out = this.out(); if (!out) return;
    const ctx = this.ctx, cam = V3d.cam.position, cabin = /^(cabin|walk|winL|winR)$/.test(V3d.mode), inside = cabin || V3d.mode === 'fwd';
    const own = cabin ? ((V3d as any).cabinFwdFor || (V3d as any).cabinFor) : null;
    let jetL = 0, propL = 0, jetN = 0, propN = 0, cabP = -1, cabProp = false, cabKt = 0, follow: any = null;
    for (const id in V3d.planes || {}) {
      const P: any = (V3d.planes as any)[id]; if (!P || !P.pos || P.model && !P.model.visible && id !== own) continue;
      const d = P.pos.distanceTo(cam); if (d > 4000) continue;
      const ph = String(P.ph || ''), kt = P.kt || 0;
      // power: full for take-off, then climb, cruise, approach, taxi; idle at the stand
      const pw = /take-?off|lift-?off/.test(ph) ? 1 : /climb|initial|departure/.test(ph) ? 0.8 : /cruise/.test(ph) ? 0.55 : /descent|approach|final/.test(ph) ? 0.4
        : /landing|roll|touchdown/.test(ph) ? (kt > 60 ? 0.75 : 0.3) : /taxi|push/.test(ph) ? 0.22 : /board|gate|park|turn/.test(ph) ? 0.06 : kt > 30 ? 0.35 : 0.08;
      const loud = pw / (1 + Math.pow(d / 120, 2));   // falls off with distance (about the inverse square past the first hundred metres)
      let prop = false; try { const t: any = acType(P.type); prop = !!t && /bush|turboprop|ga/.test(t.cls); } catch (e) { /* jet */ }
      if (id === own) { cabP = pw; cabProp = prop; cabKt = kt; continue; }   // the aircraft you sit in: heard from inside (below)
      if (id === V3d.target && /^(chase|side)$/.test(V3d.mode) && P.model) { follow = { P, d, pw, prop }; continue; }   // the one you follow: heard round it (below)
      if (prop) { propL += loud; propN = Math.max(propN, pw); } else { jetL += loud; jetN = Math.max(jetN, pw); }
    }
    const T = ctx.currentTime, set = (p: AudioParam, v: number) => p.setTargetAtTime(v, T, 0.25);
    if (jetL > 0.0005 && !this.jet) this.jet = this.voice(false);
    if (propL > 0.0005 && !this.prop) this.prop = this.voice(true);
    const muffle = cabin ? 0.18 : inside ? 0.45 : 1;   // others' engines, heard through the hull
    if (this.jet) {
      const J = this.jet, l = Math.min(1, jetL) * muffle * this.outVol();
      set(J.ng.gain, l * 0.55); set(J.lp.frequency, cabin ? 350 : (inside ? 500 : 700) + 1600 * jetN);
      set(J.og.gain, l * 0.05 * (0.4 + jetN)); set(J.o.frequency, 2400 + 1800 * jetN); set(J.of.frequency, 2400 + 1800 * jetN);
    }
    // the aircraft you follow (Behind, Around): what you hear depends on where you are round it. In front, the
    // fan's whine and the intake's hiss; behind, the deep roar of the exhaust; to one side it comes from that side;
    // further away it is quieter and duller.
    if (follow) {
      const T3 = THREE, F = follow, q = F.P.model.getWorldQuaternion(new T3.Quaternion()), fwd = new T3.Vector3(-1, 0, 0).applyQuaternion(q).normalize();
      const toCam = cam.clone().sub(F.P.pos).normalize(), front = fwd.dot(toCam);   // 1 straight ahead of the nose, −1 right behind the tail
      const camR = new T3.Vector3(1, 0, 0).applyQuaternion(V3d.cam.quaternion), toPl = F.P.pos.clone().sub(cam).normalize(), pan = clamp(camR.dot(toPl), -1, 1);
      const near = F.pw / (1 + Math.pow(F.d / 90, 2)), behind = clamp((-front + 0.2) / 1.2, 0, 1), ahead = clamp((front + 0.1) / 1.1, 0, 1), side = 1 - Math.abs(front);
      if (!this.fol) this.fol = this.followVoice();
      const V = this.fol, ex = this.outVol();
      set(V.bus.gain, Math.min(1.2, near) * ex);
      set(V.pan.pan, pan * 0.85);
      // the roar: loudest behind, still there to the side, little of it in front
      set(V.rg.gain, (F.prop ? 0.35 : 0.85) * (0.18 + 0.82 * behind) * (0.5 + F.pw)); set(V.rlp.frequency, 260 + 900 * behind * (0.4 + F.pw) + 400 * side);
      // the whine and the fan: strongest in front, some to the side
      const whine = F.prop ? 0 : (0.1 + 0.9 * ahead + 0.3 * side) * (0.35 + F.pw);
      set(V.wg.gain, 0.06 * whine); set(V.wo.frequency, 2600 + 2200 * F.pw); set(V.wf.frequency, 2600 + 2200 * F.pw);
      set(V.hg.gain, (F.prop ? 0.05 : 0.22) * (0.2 + 0.8 * ahead) * (0.3 + F.pw)); set(V.hbp.frequency, 1800 + 1400 * ahead);
      // a propeller's beat, from any side
      set(V.pg.gain, F.prop ? 0.25 * (0.4 + F.pw) : 0); set(V.po.frequency, 60 + 55 * F.pw);
      // far away the high notes go first
      set(V.lp.frequency, 900 + 9000 / (1 + F.d / 120));
    } else if (this.fol) { this.fol.bus.gain.setTargetAtTime(0, T, 0.25); }
    // inside your own aircraft
    const cv = this.cabVol();
    if (cabP >= 0 && cv > 0 && !this.cab) this.cab = this.cabinVoice();
    if (this.cab) {
      const C = this.cab, on = cabP >= 0 && cv > 0 ? 1 : 0, p = Math.max(0, cabP), air = clamp(cabKt / 300, 0, 1);
      const win = V3d.mode === 'winL' ? -1 : V3d.mode === 'winR' ? 1 : 0, near = win ? 1.25 : 1;
      set(C.bus.gain, on * cv * near);
      if (C.pan) set(C.pan.pan, win * 0.35);
      set(C.rg.gain, (0.12 + 0.75 * p) * (cabProp ? 0.8 : 1)); set(C.rlp.frequency, 140 + 220 * p);
      set(C.ag.gain, 0.04 + 0.32 * air); set(C.abp.frequency, 600 + 900 * air);
      const f0 = cabProp ? 55 + 45 * p : 70 + 90 * p;
      set(C.o1.frequency, f0); set(C.o2.frequency, f0 * 1.012); set(C.og.gain, (cabProp ? 0.16 : 0.07) * (0.25 + p)); set(C.olp.frequency, cabProp ? 260 : 360);
      set(C.lg.gain, cabProp ? 0.09 * (0.3 + p) : 0); set(C.lfo.frequency, 10 + 14 * p);
    }
    if (this.prop) {
      const Pv = this.prop, l = Math.min(1, propL) * muffle;
      set(Pv.ng.gain, l * 0.25 * this.outVol()); set(Pv.lp.frequency, 500 + 900 * propN);
      set(Pv.og.gain, l * 0.22 * this.outVol()); set(Pv.o.frequency, 60 + 55 * propN); if (Pv.lfo) set(Pv.lfo.frequency, 12 + 14 * propN);
    }
  },

  /** Engines silent (the view closed, hidden, or switched off). */
  quiet() {
    if (!this.ctx) return;
    const T = this.ctx.currentTime;
    for (const v of [this.jet, this.prop]) if (v) { v.ng.gain.setTargetAtTime(0, T, 0.2); v.og.gain.setTargetAtTime(0, T, 0.2); }
    if (this.cab) this.cab.bus.gain.setTargetAtTime(0, T, 0.2);
    if (this.fol) this.fol.bus.gain.setTargetAtTime(0, T, 0.2);
  },
  stop() {
    this.quiet();
    const ctx = this.ctx; if (!ctx) return;
    setTimeout(() => { for (const k of ['jet', 'prop']) { const v = (this as any)[k]; if (!v) continue; try { v.n.stop(); v.o.stop(); if (v.lfo) v.lfo.stop(); } catch (e) { /* stopped */ } (this as any)[k] = null; }
      const c = this.cab; if (c) { try { c.rn.stop(); c.an.stop(); c.o1.stop(); c.o2.stop(); c.lfo.stop(); } catch (e) { /* stopped */ } this.cab = null; } }, 800);
  },
};
