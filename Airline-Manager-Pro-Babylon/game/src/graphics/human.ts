// @ts-nocheck
// Realistic crew figures. Six posed base bodies (assets/humans.bin, made from the CC0 MakeHuman
// model) are blended per person, then dressed: skin, uniform fabrics, strand hair, layered beards,
// moustaches, glasses, caps and shoes all come from the person's look. The figure's proportions
// (natural, in-between or stylised) follow Settings → Crew figures.

/** Body language for a figure: each arm [forward raise, sideways raise, inwards turn, elbow bend] (radians),
 *  the body's lean and bob, the head's nod, shake and tilt, and a flush of the face. mood: begging (5 ways)
 *  or angry (10 ways); otherwise standing at ease with a little natural movement. */
/** How finely people move (Settings → Graphics → Animation): 0 Low, 1 Medium, 2 High, 3 Ultra, for walking,
 *  speaking (mouths) and body language. Automatic follows the cabin quality: Medium on Low, Ultra on Ultra. */
const ANIM_NAMES = ['Low', 'Medium', 'High', 'Ultra'];
function animLevel(k: 'animWalk' | 'animSpeak' | 'animBody'): number {
  let v: any = null; try { v = (State.settings as any)[k]; } catch (e) { /* not yet */ }
  if (v != null && v !== 'auto' && !isNaN(+v)) return Math.max(0, Math.min(3, +v));
  return animAuto();
}
/** How people's hair is drawn (Settings → Graphics → Hair): strands, one by one (the finest, for PCs); hair cards,
 *  fewer and wider locks of hair (nearly as good, far lighter: phones and tablets); or flat, painted on the head
 *  only (the lightest). Automatic: strands on the PC, hair cards on phones and tablets. */
function hairMode(): 'strands' | 'cards' | 'flat' { const v = (State.settings as any).hairMode; return v === 'strands' || v === 'cards' || v === 'flat' ? v : (typeof DESKTOP !== 'undefined' && DESKTOP ? 'strands' : 'cards'); }
function animAuto(): number { let q = 2; try { q = typeof cabinQ === 'function' ? cabinQ() : 2; } catch (e) { /* default */ } return q >= 3 ? 3 : q === 0 ? 1 : 2; }
/** The mouth while someone says a line in a conversation, from the words themselves (about 13 letters a second):
 *  open — wide on a, e and o, less on i and u, closed on m, b and p, closing between words and at the ends of
 *  sentences; round — the lips pushed forward and narrowed on o, u and w, spread on e and i. Shut (0) before and
 *  after the line, so mouths only move in dialogue. */
function humanSpeech(text: string, startMs: number, nowMs?: number): { open: number; round: number; press?: number; low?: number; up?: number } {
  const shut = { open: 0, round: 0 }; if (!text) return shut;
  const ph = humanSounds(text), t = ((nowMs == null ? Date.now() : nowMs) - startMs) / 1000, pos = t * 13 * ph.length / Math.max(1, text.length);
  if (pos < 0 || pos >= ph.length + 1) return shut;
  const v = humanViseme(ph, pos); v.open *= 0.88 + 0.12 * Math.sin(t * 19); return v;
}
// The mouth shape for each sound: [open, round (+) or spread (-), lips pressed, lower lip tucked, upper lip lifted].
// Sounds are the voice's own (IPA, with the voice model's single letters for the long vowels) or made from the letters.
const HUMAN_VIS: { [c: string]: number[] } = {};
(function () {
  const set = (cs: string, v: number[]) => { for (const c of cs) HUMAN_VIS[c] = v; };
  set(' ', [0.04, 0, 0, 0, 0]); set(',.!?;:…—', [0, 0, 0.35, 0, 0]);
  set('pbm', [0, 0, 1, 0, 0]); set('fv', [0.12, 0, 0, 1, 0]); set('θð', [0.28, -0.2, 0, 0, 0]);
  set('sz', [0.12, -0.45, 0, 0, 0]); set('tdnlɾ', [0.22, -0.2, 0, 0, 0]); set('ʃʒʧʤ', [0.22, 0.55, 0, 0, 0.8]);
  set('kgŋhx', [0.35, 0, 0, 0, 0]); set('ɹr', [0.25, 0.45, 0, 0, 0.2]); set('w', [0.1, 1, 0, 0, 0]); set('j', [0.3, -0.6, 0, 0, 0]);
  set('i', [0.3, -0.75, 0, 0, 0]); set('ɪe', [0.38, -0.55, 0, 0, 0]); set('A', [0.5, -0.5, 0, 0, 0]); set('ɛ', [0.55, -0.4, 0, 0, 0]);
  set('æ', [0.75, -0.35, 0, 0, 0]); set('aɑɐI', [0.9, 0, 0, 0, 0]); set('ʌ', [0.7, 0, 0, 0, 0]); set('ɒɔ', [0.75, 0.5, 0, 0, 0]);
  set('əɜɚᵊ', [0.4, 0, 0, 0, 0]); set('oOQ', [0.55, 0.8, 0, 0, 0]); set('uʊ', [0.3, 0.95, 0, 0, 0]); set('W', [0.8, 0.45, 0, 0, 0]); set('Y', [0.65, 0.5, 0, 0, 0]);
})();
/** The sounds of a line made from its letters (when the voice's own sounds aren't there): th, sh, ch, ee, oo… */
function humanSounds(text: string): string {
  let t = String(text || '').toLowerCase().replace(/\byou\b/g, 'yoo').replace(/\b(the)\b/g, 'θə').replace(/\b([bhmw]|sh)e\b/g, '$1ee');   // short words that read differently
  const pairs: [RegExp, string][] = [[/tch|ch/g, 'ʧ'], [/sh|ti(?=on)/g, 'ʃ'], [/th/g, 'θ'], [/ph/g, 'f'], [/wh/g, 'w'], [/ck|q/g, 'k'], [/ng\b/g, 'ŋ'], [/ee|ea|ie/g, 'E'], [/oo/g, 'U'], [/ou|ow/g, 'W'], [/ai|ay|a(?=[^aeiou\s]e\b)/g, 'A'], [/oi|oy/g, 'Y'], [/igh|i(?=[^aeiou\s]e\b)/g, 'I'], [/o(?=[^aeiou\s]e\b)|oa/g, 'O'], [/x/g, 'ks'], [/j/g, 'ʤ'], [/([bcdfgklmnprstvz])\1/g, '$1'], [/e\b(?=\s|$)/g, '']];
  for (const [re, r] of pairs) t = t.replace(re, r);
  return t.replace(/a/g, 'æ').replace(/e/g, 'ɛ').replace(/i/g, 'ɪ').replace(/o/g, 'ɒ').replace(/u/g, 'ʌ').replace(/y(?=\s|$|[.,!?])/g, 'i').replace(/y/g, 'j').replace(/c/g, 'k').replace(/r/g, 'ɹ').replace(/E/g, 'i').replace(/U/g, 'u').replace(/[^a-zæɛɪɒʌʧʃθŋiuWAYIOʤɹ ,.!?;:]/g, '');   // long ee and oo kept apart from the short vowels until here
}
/** The mouth at a point in a string of sounds, each sound blending into its neighbours as real mouths do. */
function humanViseme(ph: string, pos: number): { open: number; round: number; press: number; low: number; up: number } {
  const s = ph.replace(/[ˈˌːˑ]/g, ''), o = [0, 0, 0, 0, 0]; let wt = 0;
  for (let k = Math.floor(pos) - 1; k <= Math.floor(pos) + 2; k++) {
    const w = Math.max(0, 1 - Math.abs(pos - (k + 0.5)) / 1.15); if (!w) continue;
    const v = HUMAN_VIS[s[k] || ' '] || [0.3, 0, 0, 0, 0], ww = w * w * (3 - 2 * w);
    for (let n = 0; n < 5; n++) o[n] += v[n] * ww; wt += ww;
  }
  const d = wt || 1;
  // pressed lips win over an open neighbour (the mouth really closes for m, b, p)
  const press = o[2] / d, open = (o[0] / d) * (1 - 0.8 * press);
  return { open, round: o[1] / d, press, low: o[3] / d, up: o[4] / d };
}
/** The mouth of a person who talks, everywhere people talk (office, court, cabin, and any new place): while their
 *  line is heard as a voice, the mouth follows the voice from the moment it is heard to its end, again from the
 *  start each time Play is pressed; with no voice, it follows the words being read (text, from atMs).
 *  name: the person's name as it ends the voice's "role|sex|mood|name", or that whole voice; 'me' for your own voice. */
function humanTalk(name: string, text?: string, atMs?: number): { open: number; round: number } | 0 {
  const V: any = typeof Voice !== 'undefined' ? Voice : null;
  // their line is being got ready to play: the mouth stays still until the voice is heard
  if (V && V.speaking && name && humanVoiceIs(V.who, name) && (!V.audibleAt || Date.now() < V.audibleAt)) return 0;
  if (V && V.speaking && V.audibleAt && name && humanVoiceIs(V.who, name)) {
    const now = Date.now();
    // the natural voice: its own sounds, timed to each sentence as it is heard, opening wider when it is louder
    const seg = (V.track || []).filter((x: any) => now >= x.t0 && now < x.t0 + x.dur)[0];
    if (seg) { const v = humanViseme(seg.ph, (now - seg.t0) / seg.dur * seg.ph.replace(/[ˈˌːˑ]/g, '').length), lv = typeof V.level === 'function' ? V.level() : -1; if (lv >= 0) v.open *= 0.55 + Math.min(0.9, lv * 2.2); return v; }
    if (V.track && V.track.length) return { open: 0, round: 0 };   // a pause between sentences
    const t = V.text || '', cycle = (t.length + 1.5) / 13 * 1000;
    return humanSpeech(t, V.audibleAt, V.audibleAt + ((now - V.audibleAt) % Math.max(400, cycle)));
  }
  return text ? humanSpeech(text, atMs || 0) : 0;
}
/** Is this voice ("role|sex|mood|name", or "me|…") this person's? */
function humanVoiceIs(who: string, name: string): boolean {
  const w = String(who || ''); if (!w) return false;
  if (name.indexOf('|') >= 0) return w === name;   // a whole voice ("role|sex|mood|name")
  if (name === 'me') return /^me(\||$)/.test(w);
  return w.split('|')[3] === name;
}
/** Is this person's voice playing or about to play (being got ready)? Their mouth then follows only the voice. */
function humanVoiceBusy(name: string): boolean { const V: any = typeof Voice !== 'undefined' ? Voice : null; return !!(V && V.speaking && name && humanVoiceIs(V.who, name)); }
/** Is this person's voice being heard now (their mouth then follows it, not the text)? */
function humanVoiceOn(name: string): boolean { const V: any = typeof Voice !== 'undefined' ? Voice : null; return !!(V && V.speaking && V.audibleAt && Date.now() >= V.audibleAt && humanVoiceIs(V.who, name)); }
function humanGesture(mood: any, t: number): any {
  const S = Math.sin, base = (L: number[], R: number[]) => ({ L, R, lean: 0, bob: 0, roll: 0, nod: 0, shake: 0, tilt: 0, flush: 0, calm: 1 });
  const ease = 0.06 + 0.02 * S(t * 0.7);   // at rest: arms hanging, the slightest swing
  // a bow, as on a stage at the end of a show (a thank-you): standing at ease first, then a slow bow from the
  // waist with a hand to the stomach and the other behind the back, held a moment, and back up; once.
  // mood.v is the moment it began (seconds since 1970), so it plays once wherever the figure is drawn
  if (mood && mood.kind === 'bow') {
    const s0 = Date.now() / 1000 - (mood.v || 0), rest = base([0.04 + 0.02 * S(t * 0.6), 0.08, 0, 0.12 + ease], [0.04 + 0.02 * S(t * 0.6 + 1), 0.08, 0, 0.12 + ease]);
    const e = (x: number) => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
    const k = s0 < 2.5 ? 0 : s0 < 3.5 ? e((s0 - 2.5) / 1.0) : s0 < 4.6 ? 1 : s0 < 5.8 ? 1 - e((s0 - 4.6) / 1.2) : 0;
    if (k <= 0) return rest;
    const bowL = [-0.35, 0.12, -0.25, 1.3], bowR = [0.4, 0.05, 0.95, 1.95], mix = (a: number[], b: number[]) => a.map((v, i) => v + (b[i] - v) * k);
    const g = base(mix(rest.L, bowL), mix(rest.R, bowR)); g.lean = 0.62 * k; g.nod = 0.35 * k; g.calm = 1 - 0.8 * k; g.bob = -0.01 * k;
    return g;
  }
  // cabin crew at work: walking (legs and arms swinging), pushing the trolley, handing something to a seat
  // (v: −1 left, 1 right), and sitting on a jump seat
  if (mood && mood.kind === 'walk') return humanWalk(t, mood);
  if (mood && mood.kind === 'push') { const w = S(t * 2 * Math.PI * 0.7), g = base([0.95, 0.12, 0.15, 0.9], [0.95, 0.12, 0.15, 0.9]);
    g.legs = mood.v ? [-0.22 * w, 0.35 * Math.max(0, w), 0.22 * w, 0.35 * Math.max(0, -w)] : [0, 0, 0, 0]; g.lean = 0.08; g.bob = mood.v ? 0.008 * Math.abs(w) : 0; return g; }
  if (mood && mood.kind === 'serve') { const sd = mood.v || 1, k = 0.5 + 0.5 * S(t * 1.3), reach = [1.15 + 0.15 * k, 0.55, -0.1, 0.35], rest = [0.55, 0.1, 0.4, 1.3];
    const g = base(sd > 0 ? rest : reach, sd > 0 ? reach : rest); g.legs = [0, 0, 0, 0]; g.lean = 0.12; g.tilt = 0.12 * sd; g.shake = 0.35 * sd; return g; }
  if (mood && mood.kind === 'sit') { const g = base([0.32, 0.14, 0.12, 0.8], [0.32, 0.14, 0.12, 0.8]); g.legs = [-1.5, 1.5, -1.5, 1.5]; g.calm = 0.5; return g; }
  if (!mood || !mood.kind) return base([0.04 + 0.02 * S(t * 0.6), 0.08, 0, 0.12 + ease], [0.04 + 0.02 * S(t * 0.6 + 1), 0.08, 0, 0.12 + ease]);
  const v = mood.v || 0, f = (hz: number, ph?: number) => S(t * hz * Math.PI * 2 + (ph || 0));
  if (mood.kind === 'beg') {
    const g = base([0, 0, 0, 0], [0, 0, 0, 0]); g.calm = 0.3;
    switch (v % 5) {
      case 0: { const k = 0.05 * f(0.6); g.L = [0.62 + k, 0.1, 0.7, 2.15]; g.R = [0.62 + k, 0.1, 0.7, 2.15]; g.lean = 0.12; g.nod = 0.28; g.bob = -0.01 + 0.006 * f(0.6); break; }   // hands pressed together at the chest
      case 1: { g.L = [1.25, 0.04, 0.38, 0.55]; g.R = [1.25, 0.04, 0.38, 0.55]; g.lean = 0.2; g.tilt = 0.18; g.shake = 0.05 * f(0.9); g.nod = 0.1; break; }   // clasped hands held out towards you
      case 2: { g.L = [0.78, 0.38, -0.12, 1.2]; g.R = [0.78, 0.38, -0.12, 1.2]; g.lean = 0.08; g.shake = 0.22 * f(0.55); g.nod = 0.12; break; }   // open palms, shaking the head: "please, no"
      case 3: { g.R = [0.42, 0.05, 1.0, 2.25]; g.L = [1.1, 0.28, 0.1, 0.3 + 0.1 * f(0.5)]; g.tilt = -0.2; g.lean = 0.1; g.nod = 0.15; break; }   // a hand on the heart, the other reaching out
      default: { const k = 0.18 * f(1.2), e = 0.2 * f(1.2); g.L = [0.62 + k, 0.1, 0.7, 2.1 + e]; g.R = [0.62 + k, 0.1, 0.7, 2.1 + e]; g.nod = 0.2 + 0.1 * f(1.2); g.lean = 0.15; break; }   // "please, please": hands together, pumping
    }
    return g;
  }
  // angry
  const g = base([0, 0, 0, 0], [0, 0, 0, 0]); g.calm = 0.4; g.flush = 0.45 + 0.15 * f(0.4);
  const tr = 0.03 * S(t * 23) + 0.02 * S(t * 31);   // trembling with rage
  switch (v % 10) {
    case 0: g.L = [0.0, 0.5, 1.3, 1.55]; g.R = [0.0, 0.5, 1.3, 1.55]; g.lean = -0.05; g.nod = -0.08; break;   // fists on the hips, chest out
    case 1: g.L = [0.62, 0.1, 0.95, 2.1]; g.R = [0.55, 0.12, 0.9, 2.05]; g.shake = 0.08 * f(1.1); g.nod = -0.05; break;   // arms crossed tight
    case 2: g.L = [0.05 + tr, 0.13, 0, 0.55]; g.R = [0.05 - tr, 0.13, 0, 0.55]; g.lean = 0.07; g.nod = 0.08; g.bob = 0.003 * S(t * 20); break;   // fists clenched at the sides, shaking
    case 3: { const jab = Math.max(0, f(1.4)) * 0.18; g.R = [1.4 + jab, 0.05, -0.15, 0.1]; g.L = [0.05, 0.12, 0, 0.6]; g.lean = 0.12 + jab * 0.2; g.nod = 0.05; break; }   // jabbing a finger
    case 4: g.L = [1.15, 1.0, 0, 0.4]; g.R = [1.15, 1.0, 0, 0.4]; g.nod = -0.18; g.bob = 0.008 * Math.abs(f(1.6)); break;   // arms flung wide, shouting
    case 5: { const k = 0.25 * f(3); g.R = [2.25 + k, 0.3, 0.1, 1.2]; g.L = [0.0, 0.5, 1.3, 1.55]; g.nod = -0.05; break; }   // shaking a fist
    case 6: g.L = [2.55, 0.6, 0.4, 2.35]; g.R = [2.55, 0.6, 0.4, 2.35]; g.shake = 0.15 * f(0.9); g.nod = 0.12; break;   // hands on the head
    case 7: { const st = Math.pow(Math.max(0, f(1.5)), 4); g.L = [0.2, 0.15, 0, 0.9]; g.R = [0.2, 0.15, 0, 0.9]; g.lean = 0.1; g.bob = -0.02 * st; break; }   // stamping, fists down
    case 8: g.L = [-0.35, 0.2, 0, 0.6]; g.R = [-0.35, 0.2, 0, 0.6]; g.lean = 0.22; g.nod = 0.1; break;   // leaning in, arms back, squaring up
    default: { const up = Math.max(0, f(0.7)); g.L = [0.9 + 0.5 * up, 0.55, 0, 0.9]; g.R = [0.9 + 0.5 * up, 0.55, 0, 0.9]; g.tilt = 0.12 * f(0.7); break; }   // throwing the hands up
  }
  return g;
}

const Human = (function () {
  /* ================= data ================= */
  let DATA = null, loading = null, NBS = null;

  function load() {
    if (DATA) return Promise.resolve(DATA);
    if (loading) return loading;
    const b64 = (window as any).__HUMANS_B64;
    const p = b64 ? Promise.resolve(Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer)
      : fetch('humans.bin').then(r => { if (!r.ok) throw new Error('humans.bin: HTTP ' + r.status); return r.arrayBuffer(); });
    loading = p.then(buf => (DATA = decode(buf))).then(d => Promise.race([loadFaces(), new Promise(ok => setTimeout(ok, 5000))]).then(() => d, () => d));
    return loading;
  }
  /* ---------- the face textures (photographic skin, mapped on with the eyes, nose, mouth and ears in place) ---------- */
  // face-a: the lighter skin, face-b: the darker; each is tinted to the person's own skin colour. Their landmarks in
  // the picture (as fractions of its width and height): the centre line, the eyes, the ears, and rows for the top of
  // the face, the eyes, the tip of the nose, the line between the lips and the chin.
  const FACE_SET = [
    { file: 'assets/faces/face-a.jpg', avg: [0.4544, 0.161, 0.0831], c: 0.4990, eye: 0.0852, ear: 0.3512, top: 0.205, eyeV: 0.4205, nose: 0.586, mouth: 0.708, chin: 0.873, earBox: [0.112, 0.19, 0.36, 0.578], noseW: 0.56, mouthW: 0.77 },
    { file: 'assets/faces/face-b.jpg', avg: [0.1105, 0.0354, 0.0191], c: 0.4990, eye: 0.0852, ear: 0.3483, top: 0.24, eyeV: 0.4316, nose: 0.586, mouth: 0.698, chin: 0.862, earBox: [0.114, 0.192, 0.38, 0.586], noseW: 0.64, mouthW: 0.8 },
  ];
  let FACES: any[] = null, DETAIL = null;
  function loadFaces() {
    if (FACES) return Promise.resolve(FACES);
    const tex = (url, srgb) => fetch(url).then(r => { if (!r.ok) throw new Error(url); return r.blob(); }).then(b => createImageBitmap(b)).then(bm => {
      const t = new THREE.Texture(bm); t.flipY = false; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
      t.anisotropy = 16; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.needsUpdate = true; return t; });
    return Promise.all(FACE_SET.map(f => tex(f.file, true)).concat([tex('assets/faces/skin-detail.png', false)])).then(ts => {
      ts[ts.length - 1].wrapT = THREE.RepeatWrapping; DETAIL = ts.pop(); FACES = ts; return FACES;
    }).catch(() => { FACES = []; return FACES; });   // without them: the drawn skin as before
  }

  function decode(buf) {
    const dv = new DataView(buf);
    if (String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3)) !== 'AMPH') throw new Error('humans.bin is damaged');
    const hl = dv.getUint32(4, true);
    const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, hl)));
    let off = 8 + hl; off += (4 - (hl % 4)) % 4;
    const n = header.n, idx = new Uint16Array(buf, off, header.tris * 3); off += header.tris * 6;
    const shared = new Uint8Array(buf, off, n * 3); off += n * 3; off += (4 - ((n * 3) % 4)) % 4;
    const bodies = {};
    for (const b of header.bodies) {
      const ch = [];
      for (let k = 0; k < b.ranges.length; k++) { ch.push(new Uint16Array(buf, off, n)); off += n * 2; }
      bodies[b.key] = { ranges: b.ranges, ch, info: b.info };
    }
    return { n, idx: Array.from(idx), shared, bodies };
  }

  /** Neighbour lists of the body mesh (same for everyone), for cloth smoothing. */
  function neighbours() {
    if (NBS) return NBS;
    const n = DATA.n, idx = DATA.idx, sets = Array.from({ length: n }, () => new Set());
    for (let t = 0; t < idx.length; t += 3) { const a = idx[t], b = idx[t + 1], c = idx[t + 2]; sets[a].add(b); sets[a].add(c); sets[b].add(a); sets[b].add(c); sets[c].add(a); sets[c].add(b); }
    return (NBS = sets.map(s => Uint16Array.from(s)));
  }

  function blendInfo(list) {
    const mix = (vals, ws) => {
      const v0 = vals[0];
      if (typeof v0 === 'number') return vals.reduce((s, v, i) => s + v * ws[i], 0);
      if (Array.isArray(v0)) return v0.map((_, k) => mix(vals.map(v => v[k]), ws));
      if (v0 && typeof v0 === 'object') { const o = {}; for (const k in v0) o[k] = mix(vals.map(v => v[k]), ws); return o; }
      return v0;
    };
    return mix(list.map(x => x.info), list.map(x => x.w));
  }

  /** A body for this person: blended from the base bodies, then given the chosen proportions. */
  function makeBody(L, style) {
    const sex = L.sex === 'f' ? 'f' : 'm';
    let asian = L.eyes === 'mono' ? 0.75 : L.eyes === 'almond' ? 0.2 : 0;
    let african = (L.nose === 'wide' ? 0.45 : L.nose === 'medium' ? 0.1 : 0) + (L.lips === 'full' ? 0.45 : L.lips === 'medium' ? 0.08 : 0);
    asian = Math.min(asian, 1); african = Math.min(african, 1 - asian);
    const list = [['caucasian', Math.max(0, 1 - asian - african)], ['african', african], ['asian', asian]].filter(x => x[1] > 0.001)
      .map(([e, w]) => ({ b: DATA.bodies[sex + '-' + e], w, info: DATA.bodies[sex + '-' + e].info }));
    const tw = list.reduce((s, x) => s + x.w, 0); list.forEach(x => x.w /= tw);
    const n = DATA.n, pos = new Float32Array(n * 3), rest = new Float32Array(n * 3), A = new Float32Array(n * 4), B = new Float32Array(n * 4);
    for (const { b, w } of list) {
      const deq = k => { const [lo, hi] = b.ranges[k], s = (hi - lo) / 65535, c = b.ch[k]; return i => lo + c[i] * s; };
      const f = Array.from({ length: 10 }, (_, k) => deq(k));
      for (let i = 0; i < n; i++) {
        pos[i * 3] += w * f[0](i); pos[i * 3 + 1] += w * f[1](i); pos[i * 3 + 2] += w * f[2](i);
        rest[i * 3] += w * f[3](i); rest[i * 3 + 1] += w * f[4](i); rest[i * 3 + 2] += w * f[5](i);
        A[i * 4] += w * f[6](i); B[i * 4] += w * f[7](i); B[i * 4 + 1] += w * f[8](i); B[i * 4 + 2] += w * f[9](i);
      }
    }
    for (let i = 0; i < n; i++) { A[i * 4 + 1] = DATA.shared[i * 3] / 255; A[i * 4 + 2] = DATA.shared[i * 3 + 1] / 255; A[i * 4 + 3] = DATA.shared[i * 3 + 2] / 255; }
    const I = blendInfo(list);
    // proportions: a slightly larger head and eyes for the stylised look; the face shape stretches the head a little
    const st = style === 'stylised' ? 1 : style === 'natural' ? 0 : 0.5;
    const k = 1 + 0.13 * st, fs = { oval: [1, 1], round: [1.04, 0.98], square: [1.03, 1], long: [0.97, 1.05] }[L.face] || [1, 1];
    const ks = [k * fs[0], k * fs[1], k], np = I.neckPivot;
    const scaleAbout = (arr, i) => { const w = Math.min(1, A[i * 4 + 3]); for (let a = 0; a < 3; a++) arr[i * 3 + a] = np[a] + (arr[i * 3 + a] - np[a]) * (1 + (ks[a] - 1) * w); };
    for (let i = 0; i < n; i++) if (A[i * 4 + 3] > 0) { scaleAbout(pos, i); scaleAbout(rest, i); }
    const sp = v => v.map((x, a) => np[a] + (x - np[a]) * ks[a]);
    I.eyeL = sp(I.eyeL); I.eyeR = sp(I.eyeR); I.headC = sp(I.headC); I.headS = I.headS.map((x, a) => x * ks[a]);
    I.mouthJ = I.mouthJ.map(m => [m[0], sp(m[1]), sp(m[2])]); I.headTop = np[1] + (I.headTop - np[1]) * ks[1];
    const ek = 1 + 0.3 * st;
    if (ek > 1) for (const c of [I.eyeL, I.eyeR]) for (const arr of [pos, rest]) for (let i = 0; i < n; i++) {
      const dx = arr[i * 3] - c[0], dy = arr[i * 3 + 1] - c[1], dz = arr[i * 3 + 2] - c[2], d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const f = Math.max(0, 1 - d / 0.04); if (!f) continue; const s = 1 + (ek - 1) * f * f;
      arr[i * 3] = c[0] + dx * s; arr[i * 3 + 1] = c[1] + dy * s; arr[i * 3 + 2] = c[2] + dz * s;
    }
    I.st = st; I.eyeScale = k * ek;
    return { pos, rest, A, B, idx: DATA.idx, info: I };
  }

  /* ================= shared shader code ================= */
  const GLSL_NOISE = `
float h31(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
float vnoise(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(h31(i), h31(i+vec3(1,0,0)), f.x), mix(h31(i+vec3(0,1,0)), h31(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(h31(i+vec3(0,0,1)), h31(i+vec3(1,0,1)), f.x), mix(h31(i+vec3(0,1,1)), h31(i+vec3(1,1,1)), f.x), f.y), f.z); }
float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; } return s; }
float twill(vec2 uv){ vec2 g = uv * 1150.0; float d = fract((g.x + g.y) * 0.5); return 0.7 * (0.5 + 0.5 * sin(d * 6.2832)) + 0.3 * vnoise(vec3(g * vec2(0.3, 3.0), 1.0)); }
float plainw(vec2 uv, float f){ vec2 g = uv * f; vec2 c = floor(g); vec2 fr = fract(g) - 0.5; float alt = mod(c.x + c.y, 2.0); return 0.5 + 0.5 * (alt > 0.5 ? cos(fr.x * 3.1416) : cos(fr.y * 3.1416)); }
float canvasw(vec2 uv){ return 0.75 * plainw(uv, 520.0) + 0.25 * vnoise(vec3(uv * 900.0, 2.0)); }
float meshw(vec2 uv){ vec2 g = uv * 480.0; vec2 f = fract(vec2(g.x + 0.5 * floor(g.y), g.y)) - 0.5; return smoothstep(0.34, 0.24, length(f)); }
float knit(vec2 uv){ vec2 g = uv * vec2(420.0, 650.0); float c = abs(fract(g.x) - 0.5) * 2.0; float v = abs(fract(g.y + (fract(g.x) < 0.5 ? 0.0 : 0.5)) - 0.5); return (1.0 - c * c) * (0.6 + 0.4 * v); }
#define TRI(F, p, n) ((pow(abs(n.x),4.0) * F(p.zy) + pow(abs(n.y),4.0) * F(p.xz) + pow(abs(n.z),4.0) * F(p.xy)) / (pow(abs(n.x),4.0) + pow(abs(n.y),4.0) + pow(abs(n.z),4.0) + 1e-5))
float poplin(vec2 uv){ return plainw(uv, 1500.0); }
float silk(vec2 uv){ return 0.5 + 0.5 * sin((uv.x + uv.y) * 2600.0); }
float pores(vec3 p){ vec3 i = floor(p), f = fract(p); float d = 1.0;
  for (int x=-1;x<=1;x++) for (int y=-1;y<=1;y++) for (int z=-1;z<=1;z++){ vec3 g = vec3(x,y,z); vec3 o = vec3(h31(i+g), h31(i+g+7.1), h31(i+g+13.7)); d = min(d, length(g+o-f)); }
  return d; }
`;
  const LIGHTS = { key: [-1.6, 3.2, 3.2], fill: [2.2, 1.8, 2.6], rim: [1.4, 2.6, -2.8] };
  const v3 = a => new THREE.Vector3(a[0], a[1], a[2]);

  /* ================= body material: skin, hair line, every garment ================= */
  function bodyMaterial(c, I) {
    const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.55, sheen: 0.35, sheenRoughness: 0.5, sheenColor: new THREE.Color(c.sheen || '#ff9f86'), envMapIntensity: 0.55 });
    const col = h => new THREE.Color(h);
    const U = {
      uSkin: { value: col(c.skin) }, uHair: { value: col(c.hairPaint) }, uTop: { value: col(c.top) }, uSleeve: { value: col(c.sleeve) },
      uBot: { value: col(c.bottom) }, uShoe: { value: col(c.shoe) }, uShirt: { value: col(c.shirt) }, uTie: { value: col(c.tie) },
      uLip: { value: col(c.lip) }, uVest: { value: col('#e9c02a') }, uAccent: { value: col(c.accent) }, uBrow: { value: col(c.brow) },
      uHemY: { value: c.hemY }, uWaistY: { value: c.waistY }, uCuffS: { value: c.cuffS }, uShoeY: { value: c.shoeY }, uBotLow: { value: c.botLow }, uNeckY: { value: I.neckY },
      uVBot: { value: c.vBot }, uVW: { value: c.vW }, uTieBot: { value: c.tieBot }, uStripes: { value: c.stripes }, uLapels: { value: c.lapels ? 1 : 0 },
      uTopFab: { value: c.topFab }, uSleeveFab: { value: c.sleeveFab }, uHairT: { value: c.hairT }, uHairline: { value: c.hairline },
      uEyeL: { value: v3(I.eyeL) }, uEyeRp: { value: v3(I.eyeR) }, uMouth: { value: v3(c.mouth) }, uEyeR0: { value: c.eyeR },
      uHiVis: { value: c.hivis ? 1 : 0 }, uSkirt: { value: c.skirt ? 1 : 0 }, uFem: { value: c.female ? 1 : 0 }, uBald: { value: c.bald ? 1 : 0 },
      uBrowT: { value: c.female ? 0.0028 : 0.0038 }, uElbowS: { value: I.armLen * 0.56 }, uKneeY: { value: I.kneeY }, uCrotchY: { value: I.crotchY },
      uLegX: { value: c.legX }, uSideZ: { value: 0 }, uMech: { value: c.mech ? 1 : 0 }, uPockets: { value: c.pockets ? 1 : 0 },
      uHeadRot: { value: new THREE.Matrix3() }, uNeckP: { value: v3(I.neckPivot) }, uBlink: { value: 0 }, uJaw: { value: 0 }, uLipR: { value: 0 }, uMouthIn: { value: 2 }, uPress: { value: 0 }, uLipLow: { value: 0 }, uLipUp: { value: 0 },
      // arms: shoulder and elbow turns (left arm at +x), for gestures and body language
      uShL: { value: v3(I.J['upperarm01.L']) }, uShR: { value: v3(I.J['upperarm01.R']) },
      uElL: { value: v3(I.J['upperarm01.L']).lerp(v3(I.J['wrist.L']), 0.56 / 0.97) }, uElR: { value: v3(I.J['upperarm01.R']).lerp(v3(I.J['wrist.R']), 0.56 / 0.97) },
      uArmL: { value: new THREE.Matrix3() }, uArmR: { value: new THREE.Matrix3() }, uElbL: { value: new THREE.Matrix3() }, uElbR: { value: new THREE.Matrix3() }, uFlush: { value: 0 },
      // the hands: a turn at the wrist, and the fingers closing at the knuckles and the middle joints (thumb apart)
      uWrL: { value: new THREE.Matrix3() }, uWrR: { value: new THREE.Matrix3() }, uWrPL: { value: v3(I.J['wrist.L']) }, uWrPR: { value: v3(I.J['wrist.R']) },
      uC1L: { value: new THREE.Matrix3() }, uC1R: { value: new THREE.Matrix3() }, uC2L: { value: new THREE.Matrix3() }, uC2R: { value: new THREE.Matrix3() },
      uFgL: { value: new THREE.Vector3(0, -1, 0) }, uFgR: { value: new THREE.Vector3(0, -1, 0) }, uPnL: { value: new THREE.Vector3(-1, 0, 0) }, uPnR: { value: new THREE.Vector3(1, 0, 0) }, uThL: { value: new THREE.Matrix3() }, uThR: { value: new THREE.Matrix3() }, uCurlL: { value: 0 }, uCurlR: { value: 0 }, uHandK: { value: new THREE.Vector3(I.armLen, I.armLen + 0.1, I.armLen + 0.14) },
      // legs: hip and knee turns (walking, sitting)
      uHipL: { value: v3(I.J['upperleg01.L']) }, uHipR: { value: v3(I.J['upperleg01.L']).multiply(new THREE.Vector3(-1, 1, 1)) },
      uLegL: { value: new THREE.Matrix3() }, uLegR: { value: new THREE.Matrix3() }, uKneeL: { value: new THREE.Matrix3() }, uKneeR: { value: new THREE.Matrix3() },
      // the ankles (the foot turns at the ankle) and the spine (the upper body bends, twists and leans from the waist)
      uAnkL: { value: new THREE.Matrix3() }, uAnkR: { value: new THREE.Matrix3() }, uAnkPL: { value: v3(I.J['foot.L']) }, uAnkPR: { value: v3(I.J['foot.R'] || I.J['foot.L']).multiply(I.J['foot.R'] ? new THREE.Vector3(1, 1, 1) : new THREE.Vector3(-1, 1, 1)) },
      uSpine: { value: new THREE.Matrix3() }, uSpineP: { value: new THREE.Vector3(0, c.waistY, -0.02) },
      // the face texture: on or off, its picture and average colour, and how it lines up with this head
      uFaceOn: { value: 0 }, tFace: { value: null }, tDetail: { value: null }, uFaceAvg: { value: new THREE.Vector3(0.45, 0.16, 0.08) },
      uFaceU: { value: new THREE.Vector4(0.42, 1.71, 0.085, 0.351) }, uFaceC: { value: 0.499 },
      uFaceY: { value: new THREE.Vector4(-0.57, -1.15, -1.52, -2.17) }, uEarZY: { value: new THREE.Vector4(0, 0.1, 1.4, 1.6) }, uEarTex: { value: new THREE.Vector4(0.112, 0.19, 0.36, 0.578) }, uFaceV: { value: new THREE.Vector4(0.42, 0.586, 0.708, 0.873) }, uFaceTop: { value: new THREE.Vector2(0.22, 0.205) },
    };
    m.userData.U = U;
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, U);
      const decl = `uniform vec3 uSkin,uHair,uTop,uSleeve,uBot,uShoe,uShirt,uTie,uLip,uVest,uAccent,uBrow,uEyeL,uEyeRp,uMouth,uNeckP,uShL,uShR,uElL,uElR,uHipL,uHipR; uniform mat3 uWrL,uWrR,uC1L,uC1R,uC2L,uC2R; uniform vec3 uWrPL,uWrPR,uFgL,uFgR,uHandK,uPnL,uPnR; uniform mat3 uThL,uThR; uniform float uCurlL,uCurlR;
        uniform mat3 uHeadRot,uArmL,uArmR,uElbL,uElbR,uLegL,uLegR,uKneeL,uKneeR; uniform float uFlush;
        uniform vec3 uAnkPL,uAnkPR,uSpineP,uFaceAvg; uniform sampler2D tFace,tDetail; uniform vec4 uFaceU,uFaceY,uFaceV,uEarZY,uEarTex; uniform vec2 uFaceTop; uniform float uFaceOn,uFaceC; uniform mat3 uAnkL,uAnkR,uSpine; uniform float uPress,uLipLow,uLipUp,uHemY,uWaistY,uCuffS,uShoeY,uBotLow,uNeckY,uVBot,uVW,uTieBot,uStripes,uLapels,uTopFab,uSleeveFab,uHairT,uHairline,uEyeR0,uHiVis,uSkirt,uFem,uBald,uBrowT,uElbowS,uKneeY,uCrotchY,uLegX,uSideZ,uMech,uPockets,uBlink,uJaw,uLipR,uMouthIn;
        varying vec3 vRest; varying vec3 vF; varying vec3 vON; varying vec4 vA; varying vec4 vB; varying float vBeard;
        float hairlineAt(float az){ float a = abs(az);
          float h = mix(uHairline, uHairline - 0.12, smoothstep(0.35, 0.9, a));
          h = mix(h, 0.0, smoothstep(0.9, 1.5, a)); h = mix(h, -0.55, smoothstep(1.6, 2.6, a)); return h; }
        float hairMask(vec4 B, float headW){ if (uBald > 0.5 || headW < 0.5) return -1.0; float az = atan(B.x, B.z);
          float ear = (abs(B.x) > 0.8 && B.y < 0.25 && B.y > -0.9) ? 1.0 : 0.0;
          return (B.y - hairlineAt(az)) - ear * 2.0; }
      `;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 rest; attribute vec3 fpos; attribute vec4 fa; attribute vec4 fb; attribute float beardW;\n' + decl)
        .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
          objectNormal = normalize(mix(objectNormal, uHeadRot * objectNormal, smoothstep(0.15, 0.85, fa.w)));
          if (fa.y > 0.5) { bool lf = rest.x > 0.0; float ke = smoothstep(uElbowS - 0.03, uElbowS + 0.03, fa.x), ks = smoothstep(0.0, 0.06, fa.x);
            if ((lf ? uCurlL : uCurlR) > 0.0) { vec3 dv = position - (lf ? uWrPL : uWrPR); float df = dot(dv, lf ? uFgL : uFgR), kl = (uHandK.y - uHandK.x); float tw = smoothstep(0.012, 0.03, dot(dv, lf ? uPnL : uPnR)) * smoothstep(kl + 0.022, kl + 0.006, df) * smoothstep(0.004, 0.02, df) * step(uHandK.x - 0.01, fa.x);
              objectNormal = normalize(mix(objectNormal, (lf ? uThL : uThR) * objectNormal, tw));
              objectNormal = normalize(mix(objectNormal, (lf ? uC2L : uC2R) * objectNormal, smoothstep(uHandK.z - 0.012, uHandK.z + 0.012, fa.x) * (1.0 - tw)));
              objectNormal = normalize(mix(objectNormal, (lf ? uC1L : uC1R) * objectNormal, smoothstep(uHandK.y - 0.012, uHandK.y + 0.012, fa.x) * (1.0 - tw))); }
            objectNormal = normalize(mix(objectNormal, (lf ? uWrL : uWrR) * objectNormal, smoothstep(uHandK.x - 0.012, uHandK.x + 0.008, fa.x)));
            objectNormal = normalize(mix(objectNormal, (lf ? uElbL : uElbR) * objectNormal, ke)); objectNormal = normalize(mix(objectNormal, (lf ? uArmL : uArmR) * objectNormal, ks)); }
          if (fa.z > 0.02 && fa.y < 0.5) { bool ll = rest.x > 0.0; float kw = smoothstep(uKneeY + 0.03, uKneeY - 0.03, rest.y);
            float aw = smoothstep((ll ? uAnkPL.y : uAnkPR.y) + 0.025, (ll ? uAnkPL.y : uAnkPR.y) - 0.015, rest.y);
            objectNormal = normalize(mix(objectNormal, (ll ? uAnkL : uAnkR) * objectNormal, aw));
            objectNormal = normalize(mix(objectNormal, (ll ? uKneeL : uKneeR) * objectNormal, kw)); objectNormal = normalize(mix(objectNormal, (ll ? uLegL : uLegR) * objectNormal, fa.z)); }
          { float sw = smoothstep(uSpineP.y - 0.08, uSpineP.y + 0.22, rest.y) * ((fa.z > 0.02 && fa.y < 0.5) ? 0.0 : 1.0); objectNormal = normalize(mix(objectNormal, uSpine * objectNormal, sw)); }`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vRest = rest; vF = fpos; vA = fa; vB = fb; vON = objectNormal; vBeard = beardW;
          float hm = hairMask(fb, fa.w);
          transformed += objectNormal * smoothstep(-0.03, 0.12, hm) * uHairT;
          // blink: the upper lid turns down over the eye
          if (fa.w > 0.3 && uBlink > 0.0) {
            vec3 c = transformed.x > 0.0 ? uEyeL : uEyeRp; vec3 d = transformed - c; float r = length(d);
            float wr = smoothstep(uEyeR0 * 2.3, uEyeR0 * 1.45, r);
            if (wr > 0.0 && d.z > 0.0) { float hz = length(d.xz); float el = atan(d.y, hz);
              if (el > -0.15) { float k = smoothstep(-0.15, 0.08, el); float ne = mix(el, -0.1, uBlink * wr * k);
                vec3 hd = normalize(vec3(d.x, 0.0, d.z)); transformed = c + hd * cos(ne) * r + vec3(0.0, sin(ne) * r, 0.0); } } }
          // talking: the jaw turns on its hinge in front of the ears, carrying the chin, the lower lip and the lower
          // cheeks; the upper lip lifts a little; the lips round (pushed forward, narrower) or spread (wider, flatter)
          // the lips at rest, for the mouth shapes below: the upper and the lower lip, at the front of the mouth
          vec3 dm0 = transformed - uMouth; float lipF = exp(-pow(dm0.x / 0.032, 2.0)) * smoothstep(-0.03, -0.008, dm0.z) * step(0.3, fa.w);
          float upL = smoothstep(-0.002, 0.004, dm0.y) * smoothstep(0.022, 0.006, dm0.y) * lipF, loL = smoothstep(0.002, -0.004, dm0.y) * smoothstep(-0.026, -0.006, dm0.y) * lipF;
          if (fa.w > 0.3 && (uJaw > 0.0 || uLipR != 0.0)) {
            vec3 dm = transformed - uMouth; float ax = abs(dm.x);
            float face = smoothstep(-0.095, -0.045, dm.z) * smoothstep(0.075, 0.04, ax);
            float lowF = smoothstep(0.0015, -0.005, dm.y) * smoothstep(-0.105, -0.07, dm.y);
            vec3 hp = vec3(0.0, uMouth.y + 0.032, uMouth.z - 0.088); float ang = uJaw * 0.17 * face * lowF;
            vec3 dj = transformed - hp; float ca = cos(ang), sa = sin(ang);
            transformed.y = hp.y + dj.y * ca - dj.z * sa; transformed.z = hp.z + dj.y * sa + dj.z * ca;
            float upF = smoothstep(-0.0015, 0.004, dm.y) * smoothstep(0.022, 0.006, dm.y) * exp(-pow(dm.x / 0.03, 2.0)) * smoothstep(-0.03, -0.01, dm.z);
            transformed.y += uJaw * 0.0016 * upF;
            float lipA = exp(-pow(dm.x / 0.034, 2.0) - pow(dm.y / 0.016, 2.0)) * smoothstep(-0.04, -0.012, dm.z);
            transformed.x *= 1.0 - 0.16 * max(0.0, uLipR) * lipA + 0.07 * max(0.0, -uLipR) * lipA;
            transformed.z += (0.0035 * max(0.0, uLipR) - 0.0012 * max(0.0, -uLipR)) * lipA; }
          // mouth shapes: m, b, p press the lips together; f, v tuck the lower lip under the top teeth; sh, ch push
          // the lips forward and lift the upper one
          if (uPress > 0.0 || uLipLow > 0.0 || uLipUp > 0.0) {
            transformed.y += (-0.0036 * uPress + 0.003 * uLipUp) * upL + (0.0036 * uPress + 0.005 * uLipLow) * loL;
            transformed.z += (0.0018 * uPress + 0.0026 * uLipUp) * (upL + loL) - 0.004 * uLipLow * loL; }
          // head turn
          transformed = mix(transformed, uNeckP + uHeadRot * (transformed - uNeckP), smoothstep(0.15, 0.85, fa.w));
          // arms: the forearm turns at the elbow, then the whole arm at the shoulder
          if (fa.y > 0.5) { bool lf = rest.x > 0.0; vec3 sp = lf ? uShL : uShR, ep = lf ? uElL : uElR;
            float ke = smoothstep(uElbowS - 0.03, uElbowS + 0.03, fa.x), ks = smoothstep(0.0, 0.06, fa.x);
            // the hand: the fingers close (the middle joints, then the knuckles), then the hand turns at the wrist
            vec3 wp = lf ? uWrPL : uWrPR, fg = lf ? uFgL : uFgR;
            if ((lf ? uCurlL : uCurlR) > 0.0) { vec3 p2 = wp + fg * (uHandK.z - uHandK.x), p1 = wp + fg * (uHandK.y - uHandK.x), pn = lf ? uPnL : uPnR;
              // the thumb (standing out to the palm side, below the knuckles) turns at its root, the fingers close
              vec3 dv = transformed - wp; float df = dot(dv, fg), kl = uHandK.y - uHandK.x; float tw = smoothstep(0.012, 0.03, dot(dv, pn)) * smoothstep(kl + 0.022, kl + 0.006, df) * smoothstep(0.004, 0.02, df) * step(uHandK.x - 0.01, fa.x);
              vec3 pt = wp + fg * 0.025 + pn * 0.018;
              transformed = mix(transformed, pt + (lf ? uThL : uThR) * (transformed - pt), tw);
              transformed = mix(transformed, p2 + (lf ? uC2L : uC2R) * (transformed - p2), smoothstep(uHandK.z - 0.012, uHandK.z + 0.012, fa.x) * (1.0 - tw));
              transformed = mix(transformed, p1 + (lf ? uC1L : uC1R) * (transformed - p1), smoothstep(uHandK.y - 0.012, uHandK.y + 0.012, fa.x) * (1.0 - tw)); }
            transformed = mix(transformed, wp + (lf ? uWrL : uWrR) * (transformed - wp), smoothstep(uHandK.x - 0.012, uHandK.x + 0.008, fa.x));
            transformed = mix(transformed, ep + (lf ? uElbL : uElbR) * (transformed - ep), ke);
            transformed = mix(transformed, sp + (lf ? uArmL : uArmR) * (transformed - sp), ks); }
          // legs: the lower leg turns at the knee, then the whole leg at the hip
          if (fa.z > 0.02 && fa.y < 0.5) { bool ll = rest.x > 0.0; vec3 hp = ll ? uHipL : uHipR, kp = vec3(hp.x, uKneeY, hp.z), ap = ll ? uAnkPL : uAnkPR;
            float kw = smoothstep(uKneeY + 0.03, uKneeY - 0.03, rest.y), aw = smoothstep(ap.y + 0.025, ap.y - 0.015, rest.y);
            transformed = mix(transformed, ap + (ll ? uAnkL : uAnkR) * (transformed - ap), aw);   // the foot at the ankle
            transformed = mix(transformed, kp + (ll ? uKneeL : uKneeR) * (transformed - kp), kw);
            transformed = mix(transformed, hp + (ll ? uLegL : uLegR) * (transformed - hp), fa.z); }
          // the spine: everything above the waist (arms and head too) bends, twists and leans with it
          { float sw = smoothstep(uSpineP.y - 0.08, uSpineP.y + 0.22, rest.y) * ((fa.z > 0.02 && fa.y < 0.5) ? 0.0 : 1.0);
            transformed = mix(transformed, uSpineP + uSpine * (transformed - uSpineP), sw); }`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + decl + GLSL_NOISE)
        .replace('#include <color_fragment>', `#include <color_fragment>
          vec3 R = vRest; float onArm = step(0.5, vA.y), headW = vA.w;
          // under a skirt the hips and thighs are hidden, so they can never show through it
          if (uSkirt > 0.5 && onArm < 0.5 && headW < 0.5 && R.y < uHemY && R.y > uKneeY + 0.06) discard;
          vec3 col = mix(uSkin, uSkin * vec3(1.12, 0.78, 0.74), uFlush); float rough = 0.55, metal = 0.0, isSkin = 1.0;
          float low = fbm(R * 22.0), mid = fbm(R * 90.0);
          col *= 0.95 + 0.1 * low;
          col = mix(col, col * vec3(1.06, 0.93, 0.9), 0.35 * mid);
          // the face: the photographic skin, lined up by the eyes, nose, mouth, chin and ears, tinted to this person's skin
          float tx = 0.0, fH = 0.0, earW = 0.0;
          if (uFaceOn > 0.5 && headW > 0.3) {
            float az = atan(vB.x, vB.z), aa = abs(az);
            float uo = aa < uFaceU.x ? aa / uFaceU.x * uFaceU.z : aa < uFaceU.y ? mix(uFaceU.z, uFaceU.w, (aa - uFaceU.x) / (uFaceU.y - uFaceU.x)) : mix(uFaceU.w, 0.5, (aa - uFaceU.y) / (3.14159 - uFaceU.y));
            float y = vB.y, fv;
            if (y > uFaceTop.x) fv = mix(uFaceTop.y, 0.02, clamp((y - uFaceTop.x) / 0.7, 0.0, 1.0));
            else if (y > uFaceY.x) fv = mix(uFaceTop.y, uFaceV.x, (uFaceTop.x - y) / (uFaceTop.x - uFaceY.x));
            else if (y > uFaceY.y) fv = mix(uFaceV.x, uFaceV.y, (uFaceY.x - y) / (uFaceY.x - uFaceY.y));
            else if (y > uFaceY.z) fv = mix(uFaceV.y, uFaceV.z, (uFaceY.y - y) / (uFaceY.y - uFaceY.z));
            else if (y > uFaceY.w) fv = mix(uFaceV.z, uFaceV.w, (uFaceY.z - y) / (uFaceY.z - uFaceY.w));
            else fv = mix(uFaceV.w, 0.985, clamp((uFaceY.w - y) / 0.35, 0.0, 1.0));
            vec2 fuv = vec2(uFaceC + sign(az) * uo, fv);
            // the ears: the ear in the photograph laid onto the ear itself, from its front edge to its back and top to bottom
            earW = smoothstep(0.8, 0.9, abs(vB.x)) * smoothstep(-1.0, -0.85, vB.y) * smoothstep(0.35, 0.2, vB.y);
            if (earW > 0.0) {
              float ez = clamp((R.z - uEarZY.x) / max(0.001, uEarZY.y - uEarZY.x), 0.0, 1.0), ey = clamp((uEarZY.w - R.y) / max(0.001, uEarZY.w - uEarZY.z), 0.0, 1.0);
              vec2 euv = R.x < 0.0 ? vec2(mix(uEarTex.x, uEarTex.y, ez), mix(uEarTex.z, uEarTex.w, ey)) : vec2(mix(1.0 - uEarTex.x, 1.0 - uEarTex.y, ez), mix(uEarTex.z, uEarTex.w, ey));
              fuv = mix(fuv, euv, earW);
            }
            vec3 ft = texture2D(tFace, fuv).rgb;
            // the photograph's own relief: brighter than its surroundings is raised, darker is a crease or a pore
            float lumN = dot(ft, vec3(0.3, 0.59, 0.11)), lumB = dot(texture2D(tFace, fuv, 3.5).rgb, vec3(0.3, 0.59, 0.11));
            fH = (lumN - lumB) / max(0.004, lumB);
            // the dark of the eye openings in the picture is never shown: the eyes themselves are there
            float rel = dot(ft, vec3(0.3, 0.59, 0.11)) / max(0.001, dot(uFaceAvg, vec3(0.3, 0.59, 0.11)));
            vec3 ec0 = vec3(sign(R.x) * uEyeL.x, uEyeL.y, uEyeL.z);
            float hole = smoothstep(0.32, 0.16, rel) * step(length(R - ec0), uEyeR0 * 2.2);
            vec3 fc = ft / max(uFaceAvg, vec3(0.002)) * mix(uSkin, uSkin * vec3(1.12, 0.78, 0.74), uFlush);
            tx = smoothstep(0.3, 0.75, headW) * (1.0 - hole);
            // finer than the photograph can hold: its own pores again, much smaller, for sharpness close up
            vec3 an0 = abs(normalize(vON)); an0 /= (an0.x + an0.y + an0.z);
            float dz = texture2D(tDetail, R.yz * 34.0).r * an0.x + texture2D(tDetail, R.xz * 34.0).r * an0.y + texture2D(tDetail, R.xy * 34.0).r * an0.z;
            fc *= mix(1.0, dz * 2.0, 0.22);
            fc *= 1.0 - clamp(-fH * 0.6, 0.0, 0.22);   // the creases and the deepest pores a touch darker (cavities)
            col = mix(col, fc, tx);
          } else if (uFaceOn > 0.5) {
            // hands, arms, the neck: the same skin detail (pores and fine texture) from the photograph
            vec3 an = abs(normalize(vON)); an /= (an.x + an.y + an.z);
            float dd = texture2D(tDetail, R.yz * 14.0).r * an.x + texture2D(tDetail, R.xz * 14.0).r * an.y + texture2D(tDetail, R.xy * 14.0).r * an.z;
            col *= mix(1.0, dd * 2.0, 0.55);
          }
          vec3 E = uEyeL; vec3 Rx = vec3(abs(R.x), R.y, R.z);
          float cheek = exp(-pow(length(Rx.xy - vec2(E.x + 0.012, E.y - 0.035)) / 0.022, 2.0)) * step(E.z - 0.03, R.z);
          float nose = exp(-pow(length(R.xy - vec2(0.0, E.y - 0.035)) / 0.014, 2.0)) * step(E.z - 0.01, R.z);
          float ear = headW > 0.5 && abs(vB.x) > 0.85 ? 1.0 : 0.0;
          col = mix(col, col * vec3(1.08, 0.86, 0.84), clamp(0.55 * cheek + 0.4 * nose + 0.3 * ear, 0.0, 1.0) * (1.0 - tx));
          float tz = headW > 0.5 ? exp(-pow(abs(R.x) / 0.03, 2.0)) * smoothstep(E.y - 0.06, E.y - 0.03, R.y) * step(E.z - 0.02, R.z) : 0.0;
          rough = 0.56 - 0.14 * tz;
          rough = mix(rough, clamp(rough - fH * 0.3, 0.36, 0.7), tx);   // the photograph's highlights: oilier where it shines
          vec2 ml = (R.xy - uMouth.xy) / vec2(0.024, 0.0105);
          float lip = (headW > 0.5 && R.z > uMouth.z - 0.03) ? smoothstep(1.05, 0.8, length(ml)) : 0.0;
          col = mix(col, uLip, lip * (1.0 - 0.7 * tx)); rough = mix(rough, 0.38, lip);
          // the inside of the mouth as it opens: the upper teeth, the dark of the mouth, the tongue below
          if (headW > 0.5 && uJaw > 0.02 && uMouthIn > 0.5 && R.z > uMouth.z - 0.03) {
            vec2 mq = (R.xy - uMouth.xy) / vec2(0.018 * (1.0 - 0.25 * max(0.0, uLipR)), 0.0028);
            float mo = smoothstep(1.0, 0.6, length(mq)) * min(1.0, uJaw * 1.8), v = mq.y;
            vec3 inner = mix(vec3(0.07, 0.02, 0.02), vec3(0.42, 0.13, 0.13), smoothstep(-0.2, -0.75, v) * step(1.5, uMouthIn));   // tongue below (Ultra)
            inner = mix(inner, vec3(0.86, 0.83, 0.76), smoothstep(0.2, 0.5, v) * smoothstep(0.25, 0.5, uJaw) * smoothstep(0.55, 0.15, abs(mq.x)) * step(1.5, uMouthIn));   // upper teeth (Ultra)
            col = mix(col, inner, mo); rough = mix(rough, 0.25, mo); isSkin = mix(isSkin, 0.0, mo); }
          float u = (abs(R.x) - (E.x - 0.017)) / 0.04;
          float by = E.y + 0.021 + 0.006 * sin(3.14159 * clamp(u, 0.0, 1.0)) - 0.004 * u;
          float bw = uBrowT * (1.0 - 0.6 * u) * smoothstep(-0.05, 0.15, u);
          float brow = (headW > 0.5 && u > -0.05 && u < 1.0 && R.z > E.z - 0.012) ? smoothstep(bw + 0.0007, bw - 0.0005, abs(R.y - by)) : 0.0;
          brow *= 0.7 + 0.3 * mix(0.5, vnoise(R * vec3(2400.0, 600.0, 600.0)), 1.0 - smoothstep(0.3, 0.8, length(fwidth(R * 2400.0))));
          col = mix(col, uBrow, brow * 0.8 * (1.0 - 0.45 * tx));
          vec3 ec = vec3(sign(R.x) * E.x, E.y, E.z);
          float de = length(R - ec);
          float lash = (headW > 0.5 && R.y > ec.y - 0.002 && R.z > ec.z && de < uEyeR0 * (uFem > 0.5 ? 1.32 : 1.24)) ? 1.0 : 0.0;
          col = mix(col, vec3(0.05, 0.035, 0.03), lash * 0.9);
          float hmk = hairMask(vB, headW);
          if (hmk > 0.0) { isSkin = 0.0; float strand = vnoise(vec3(atan(vB.x, vB.z) * 220.0, R.y * 40.0, 0.0));
            col = uHair * (0.85 + 0.25 * mix(0.5, strand, 1.0 - smoothstep(0.3, 0.8, fwidth(R.y * 40.0) + fwidth(atan(vB.x, vB.z) * 220.0)))); rough = 0.62; }
          else if (hmk > -0.04 && headW > 0.5) { col = mix(col, uHair * 0.9, 0.35 * smoothstep(-0.04, 0.0, hmk)); }
          // ---------- clothes ----------
          // fabK: 0 skin, 1 wool twill, 2 cotton poplin, 3 silk, 4 canvas, 5 hi-vis mesh, 6 reflective tape, 7 metal, 8 knit
          float fabK = 0.0, clothH = 0.0, seam = 0.0;
          vec3 Fp = vF;
          bool topIn = onArm > 0.5 ? (vA.x < uCuffS) : (R.y > uHemY && R.y < uNeckY + 0.02 && headW < 0.5);
          bool botIn = uSkirt < 0.5 && onArm < 0.5 && R.y < uWaistY && R.y > uBotLow;
          float nz1 = vnoise(Fp * 38.0), nz2 = vnoise(Fp * 90.0);
          if (botIn && !topIn) {
            col = uBot; rough = 0.8; isSkin = 0.0; fabK = uMech > 0.5 ? 4.0 : 1.0;
            float lx = abs(Fp.x);
            clothH += sin(Fp.y * 170.0 + nz1 * 5.0) * exp(-pow((Fp.y - uKneeY) / 0.06, 2.0)) * 0.0011;
            clothH += sin(Fp.y * 240.0 + nz2 * 4.0 + lx * 30.0) * smoothstep(uShoeY + 0.14, uShoeY + 0.03, Fp.y) * 0.0010;
            clothH += sin((lx * 1.4 + Fp.y) * 165.0) * exp(-pow((Fp.y - uCrotchY - 0.03) / 0.05, 2.0)) * exp(-pow((lx - 0.045) / 0.04, 2.0)) * 0.0011;
            clothH += (nz1 - 0.5) * 0.0012;
            if (uMech < 0.5) clothH += exp(-pow((lx - uLegX) / 0.0035, 2.0)) * step(0.0, Fp.z - 0.02) * 0.0005 * smoothstep(uWaistY - 0.05, uWaistY - 0.15, Fp.y);
            float sd = abs(Fp.z - (uSideZ + 0.01)); if (lx > uLegX + 0.03 && sd < 0.0011) { seam = 1.0 - sd / 0.0011; }
            if (abs(Fp.y - (uBotLow + 0.012)) < 0.0006 && fract((Fp.x + Fp.z) * 330.0) > 0.45) seam = 0.5;
            if (uMech > 0.5) {
              vec2 kp = vec2(lx - uLegX, Fp.y - uKneeY);
              if (Fp.z > 0.03 && abs(kp.x) < 0.055 && abs(kp.y) < 0.06) { col *= 0.82; clothH += 0.0007; if (abs(abs(kp.x) - 0.05) < 0.0007 || abs(abs(kp.y) - 0.055) < 0.0007) seam = 0.6; }
              vec2 cp = vec2(lx - (uLegX + 0.045), Fp.y - (uKneeY + 0.17));
              if (abs(cp.x) < 0.04 && abs(cp.y) < 0.06) { clothH += 0.0009; if (abs(cp.y - 0.04) < 0.0035) { col *= 0.9; } if (abs(abs(cp.x) - 0.036) < 0.0007 || abs(cp.y + 0.056) < 0.0007 || abs(cp.y - 0.037) < 0.0007) seam = 0.6; }
            }
          }
          if (topIn) {
            col = onArm > 0.5 ? uSleeve : uTop; rough = 0.82; isSkin = 0.0; fabK = uMech > 0.5 ? 4.0 : (onArm > 0.5 ? uSleeveFab : uTopFab);
            if (onArm > 0.5) {
              clothH += sin(vA.x * 210.0 + nz1 * 4.0) * exp(-pow((vA.x - uElbowS) / 0.05, 2.0)) * 0.0013;
              clothH += sin(vA.x * 300.0 + nz2 * 3.0) * smoothstep(uCuffS - 0.09, uCuffS - 0.02, vA.x) * 0.0007;
              clothH += (nz1 - 0.5) * 0.0012;
              if (abs(vA.x - 0.025) < 0.0012) seam = 1.0 - abs(vA.x - 0.025) / 0.0012;
              if (abs(vA.x - (uCuffS - 0.008)) < 0.0005 && fract(Fp.y * 300.0 + Fp.x * 300.0) > 0.45) seam = 0.5;
            } else {
              clothH += sin(Fp.y * 120.0 + abs(Fp.x) * 70.0) * exp(-pow((Fp.y - (uVBot - 0.07)) / 0.06, 2.0)) * smoothstep(0.02, 0.08, abs(Fp.x)) * 0.0006;
              clothH += (nz1 - 0.5) * 0.0009;
              float sz = abs(Fp.z - uSideZ); if (sz < 0.0011 && abs(Fp.x) > 0.05) seam = 1.0 - sz / 0.0011;
              if (abs(Fp.x) < 0.001 && Fp.z < uSideZ) seam = 1.0;
              if (abs(Fp.y - (uHemY + 0.012)) < 0.00055 && fract((Fp.x + Fp.z) * 330.0) > 0.45) seam = 0.5;
            }
            float halfW = uVW * clamp((Fp.y - uVBot) / (uNeckY - uVBot), 0.0, 1.0);
            bool front = Fp.z > 0.0 && onArm < 0.5;
            if (uVW > 0.0 && front && Fp.y > uVBot && abs(Fp.x) < halfW) { col = uShirt; rough = 0.75; fabK = 2.0; clothH = -0.0006 + (nz2 - 0.5) * 0.0004;
              if (uTieBot > 0.0 && Fp.y > uTieBot) { float tw = mix(0.024, 0.011, clamp((Fp.y - uTieBot) / (uNeckY - uTieBot - 0.02), 0.0, 1.0)); if (Fp.y > uNeckY - 0.03) tw = 0.014;
                float tipK = clamp((Fp.y - uTieBot) / 0.025, 0.0, 1.0);
                if (abs(Fp.x) < tw * tipK) { col = uTie; rough = 0.42; fabK = 3.0; clothH = 0.0004 * (1.0 - abs(Fp.x) / max(tw * tipK, 0.001));
                  if (fract((Fp.x + Fp.y) * 55.0) > 0.92) col = mix(uTie, uAccent * 0.5, 0.35);
                  if (Fp.y > uNeckY - 0.03) clothH += 0.0012 * (1.0 - abs(Fp.x) / 0.014); } } }
            if (uLapels > 0.5 && uVW > 0.0 && front && Fp.y > uVBot) { float e = abs(Fp.x) - halfW;
              if (abs(e) < 0.0022) { col = uTop * 0.5; clothH -= 0.0006; }
              if (e > 0.0 && e < 0.045 && Fp.y > uVBot + 0.01) clothH += 0.0007 * smoothstep(0.045, 0.03, e);
              if (abs(e - 0.006) < 0.0005 && fract(Fp.y * 320.0) > 0.5) seam = 0.45; }
            if (vF.y > uNeckY - 0.005 && onArm < 0.5 && uMech < 0.5) { col = uShirt; rough = 0.75; fabK = 2.0; }
            if (uPockets > 0.5 && front) { float lx = abs(Fp.x);
              vec2 pk = vec2(lx - 0.09, Fp.y - (uHemY + 0.115));
              if (abs(pk.x) < 0.048 && abs(pk.y) < 0.022) { clothH += 0.0009 * smoothstep(0.022, 0.016, abs(pk.y)) * smoothstep(0.048, 0.042, abs(pk.x));
                if (abs(abs(pk.x) - 0.044) < 0.0006 || abs(pk.y + 0.018) < 0.0006) { if (fract((Fp.x + Fp.y) * 330.0) > 0.45) seam = 0.5; } }
              if (abs(pk.x) < 0.048 && pk.y < -0.022 && pk.y > -0.027) col *= 0.62;
              vec2 wp = vec2(Fp.x - 0.085, Fp.y - (uNeckY - 0.205));
              if (abs(wp.x) < 0.03 && abs(wp.y) < 0.006) { clothH += 0.0006; if (abs(wp.y + 0.006) < 0.0008) col *= 0.7; } }
            if (onArm > 0.5 && uStripes > 0.0) { float d = uCuffS - vA.x;
              for (int i = 0; i < 4; i++) { if (float(i) >= uStripes) break; float cc = 0.03 + float(i) * 0.011; if (abs(d - cc) < 0.0028) { col = vec3(0.89, 0.71, 0.34) * (0.85 + 0.3 * plainw(vec2(Fp.y + Fp.x, d), 2200.0)); metal = 1.0; rough = 0.32; fabK = 7.0; clothH = 0.0004; } } }
            if (uMech > 0.5 && front && abs(Fp.x) < 0.0045 && Fp.y > uCrotchY + 0.05) { col = vec3(0.62, 0.64, 0.66) * (0.7 + 0.3 * step(0.0, sin(Fp.y * 1500.0))); metal = 1.0; rough = 0.35; fabK = 7.0; clothH = 0.0005; }
            if (uHiVis > 0.5 && onArm < 0.5 && vF.y > uWaistY - 0.04 && vF.y < uNeckY - 0.03 && abs(vF.x) < 0.15) {
              col = uVest; rough = 0.7; fabK = 5.0; clothH = 0.0012;
              float edge = min(min(abs(abs(vF.x) - 0.15), abs(vF.y - (uWaistY - 0.04))), abs(vF.y - (uNeckY - 0.03)));
              if (edge < 0.007) { col = vec3(0.32, 0.33, 0.35); fabK = 4.0; }
              float b1 = abs(vF.y - (uWaistY + 0.06)), b2 = abs(vF.y - (uWaistY + 0.14));
              if (min(b1, b2) < 0.016) { float spark = step(0.93, h31(floor(vF * 4000.0))); col = mix(vec3(0.72, 0.74, 0.72), vec3(1.25), spark); metal = 0.55; rough = 0.25; fabK = 6.0; clothH = 0.0015;
                if (abs(min(b1, b2) - 0.0155) < 0.0006) seam = 0.5; } }
          }
          if (R.y < uShoeY) { col = uShoe; rough = 0.35; isSkin = 0.0; fabK = 0.0; }
          if (isSkin < 0.5 && fabK > 0.5 && fabK < 6.5 || fabK > 7.5) {
            float lodC = 1.0 - smoothstep(0.3, 0.8, length(fwidth(Fp * 420.0)));
            col *= 0.95 + 0.1 * mix(0.5, fbm(Fp * 420.0), lodC);
            if (fabK > 4.5 && fabK < 5.5) col *= 1.0 - 0.35 * TRI(meshw, Fp, normalize(vON)) * (1.0 - smoothstep(0.3, 0.8, length(fwidth(Fp * 480.0))));
            if (fabK > 7.5) col *= 0.88 + 0.2 * TRI(knit, Fp, normalize(vON)) * (1.0 - smoothstep(0.3, 0.8, length(fwidth(Fp * 650.0))));
            col *= mix(1.0, 0.78, smoothstep(0.0, -0.0015, clothH));
            col *= mix(1.0, 1.06, smoothstep(0.0, 0.0012, clothH));
            if (seam > 0.0 && (fabK < 4.5 || fabK > 6.5)) { col *= mix(1.0, 0.62, seam); clothH -= 0.0005 * seam; }
          }
          if (vBeard > 0.0) col = mix(col, uHair * 0.3, clamp(vBeard, 0.0, 1.0) * 0.9);
          diffuseColor.rgb = col;
          `)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          roughnessFactor = rough;`)
        .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
          metalnessFactor = metal;`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          {
            float fq = isSkin > 0.5 ? 1100.0 : 1150.0;
            float fade = 1.0 - smoothstep(0.35, 0.9, length(fwidth(vRest * fq)));
            float hgt;
            if (isSkin > 0.5) {
              float pd = pores(vRest * 1100.0);
              hgt = (smoothstep(0.05, 0.45, pd) * 0.00006 + (fbm(vRest * 160.0) - 0.5) * 0.00012) * fade * (1.0 - 0.6 * tx);
              hgt += fH * 0.00018 * tx;   // the face's own relief, from the photograph: pores, lines, the folds of the ears
            } else {
              vec3 n0 = normalize(vON);
              float w = 0.0;
              if (fabK < 1.5) w = TRI(twill, vF, n0) * 0.00005;
              else if (fabK < 2.5) w = TRI(poplin, vF, n0) * 0.00003;
              else if (fabK < 3.5) w = TRI(silk, vF, n0) * 0.00002;
              else if (fabK < 4.5) w = TRI(canvasw, vF, n0) * 0.00007;
              else if (fabK < 5.5) w = -TRI(meshw, vF, n0) * 0.00012;
              else if (fabK > 7.5) w = TRI(knit, vF, n0) * 0.00012;
              hgt = clothH + w * fade;
            }
            vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition);
            vec2 dh = vec2(dFdx(hgt), dFdy(hgt));
            vec3 r1 = cross(sy, normal), r2 = cross(normal, sx); float det = dot(sx, r1) * faceDirection;
            normal = normalize(abs(det) * normal - sign(det) * (dh.x * r1 + dh.y * r2));
            if (isSkin > 0.5) roughnessFactor = mix(roughnessFactor + 0.06, roughnessFactor, smoothstep(0.05, 0.4, pores(vRest * 1100.0)) * fade + (1.0 - fade));
          }`)
        .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
          if (isSkin < 0.5) material.sheenColor = diffuseColor.rgb * 0.7;`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          if (isSkin > 0.5) { float rimL = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 2.0); totalEmissiveRadiance += uSkin * vec3(0.5, 0.14, 0.08) * (0.06 + 0.2 * rimL);
            // light under the skin: a warm glow where the light falls away (past the shadow line), and through thin
            // parts (the ears, the edge of the nose) when the light is behind them
            #if NUM_DIR_LIGHTS > 0
              vec3 Ld = directionalLights[0].direction, Lc = directionalLights[0].color;
              float ndl = dot(normal, Ld), wrap = max(0.0, (ndl + 0.45) / 1.45) - max(0.0, ndl);
              totalEmissiveRadiance += diffuseColor.rgb * Lc * vec3(0.6, 0.2, 0.12) * wrap * 0.28;
              float thin = clamp(earW + 0.35 * exp(-pow(length(vRest.xy - vec2(0.0, uEyeL.y - 0.035)) / 0.012, 2.0)), 0.0, 1.0);
              float through = pow(max(0.0, dot(normalize(-vViewPosition), Ld)), 4.0);   // the light behind it, shining towards you
              totalEmissiveRadiance += Lc * vec3(0.9, 0.22, 0.1) * uSkin * thin * through * 0.7;
            #endif
          }`);
    };
    m.customProgramCacheKey = () => 'crew-body';
    return m;
  }

  /* ================= cloth fitting ================= */
  const sst = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  /** Clothes hide anatomy: covered areas are pushed out to simple cloth shapes, smoothed and given thickness. */
  function clothe(geo, b, c, I) {
    const P = geo.attributes.position, n = P.count, A = b.A, R = b.rest;
    const w = new Float32Array(n), th = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const s = A[i * 4], arm = A[i * 4 + 1] > 0.5, headW = A[i * 4 + 3], y = R[i * 3 + 1];
      const top = arm ? sst(0.004, -0.01, s - c.cuffS) : sst(c.hemY - 0.01, c.hemY + 0.01, y) * sst(I.neckY + 0.03, I.neckY + 0.0, y) * (headW < 0.5 ? 1 : 0);
      const bot = (!arm && !c.skirt) ? sst(c.waistY + 0.01, c.waistY - 0.01, y) * sst(c.botLow - 0.005, c.botLow + 0.01, y) : 0;
      const shoe = sst(c.shoeY + 0.01, c.shoeY - 0.005, y);
      w[i] = Math.max(top, bot, shoe * 0.6);
      th[i] = Math.max(top * c.topT, bot * c.botT);
    }
    const nbs = neighbours();
    const p = Float32Array.from(P.array), q = new Float32Array(p.length);
    for (const sd of [1, -1]) {
      let cx = 0, cz = 0, cn = 0; const ids = [];
      for (let i = 0; i < n; i++) if (R[i * 3 + 1] < I.ankleY + 0.03 && Math.sign(p[i * 3]) === sd) { ids.push(i); cx += p[i * 3]; cz += p[i * 3 + 2]; cn++; }
      cx /= cn || 1; cz /= cn || 1;
      for (const i of ids) { const k = 0.82 + 0.18 * sst(I.ankleY - 0.01, I.ankleY + 0.03, R[i * 3 + 1]); p[i * 3] = cx + (p[i * 3] - cx) * k; p[i * 3 + 2] = cz + (p[i * 3 + 2] - cz) * k; p[i * 3 + 1] = Math.max(0.006, p[i * 3 + 1]); }
    }
    const V3 = i => new THREE.Vector3(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
    const setV = (i, v) => { p[i * 3] = v.x; p[i * 3 + 1] = v.y; p[i * 3 + 2] = v.z; };
    const tube = (from, to, members, k, rMul, minR) => {
      if (!members.length) return;
      const a = v3(from), ax = v3(to).sub(a), len = ax.length(); ax.normalize();
      const bins = 24, rsum = new Float32Array(bins), rcnt = new Float32Array(bins);
      const inf = members.map(i => { const d = V3(i).sub(a), t = d.dot(ax); const rv = d.clone().addScaledVector(ax, -t); const bi = Math.max(0, Math.min(bins - 1, Math.floor(t / len * bins))); rsum[bi] += rv.length(); rcnt[bi]++; return { i, t, rv, bi }; });
      const rmax = Float32Array.from(rsum, (x, j) => rcnt[j] ? x / rcnt[j] : 0);
      for (let j = 1; j < bins; j++) if (!rmax[j]) rmax[j] = rmax[j - 1];
      rmax[0] = Math.min(rmax[0], rmax[2] * 1.05); rmax[1] = Math.min(rmax[1], rmax[2] * 1.05);
      for (let j = bins - 2; j >= 0; j--) rmax[j] = Math.max(rmax[j], rmax[j + 1]);
      const sm = Array.from(rmax, (x, j) => { let s = 0, cn = 0; for (let o = -2; o <= 2; o++) { const jj = j + o; if (jj >= 0 && jj < bins) { s += rmax[jj]; cn++; } } return s / cn; });
      for (const m of inf) { const r = m.rv.length(); if (!r) continue; const target = Math.max(minR, sm[m.bi] * rMul); const nr = r + Math.max(0, target - r) * k * w[m.i];
        setV(m.i, a.clone().addScaledVector(ax, m.t).addScaledVector(m.rv, nr / r)); }
    };
    const J = I.J, arms = { L: [], R: [] }, legs = { L: [], R: [] }, torso = [];
    for (let i = 0; i < n; i++) {
      const arm = A[i * 4 + 1] > 0.5, leg = A[i * 4 + 2] > 0.5, x = R[i * 3];
      if (arm) arms[x > 0 ? 'L' : 'R'].push(i); else if (leg && R[i * 3 + 1] > c.botLow + 0.02) legs[x > 0 ? 'L' : 'R'].push(i); else if (A[i * 4 + 3] < 0.5) torso.push(i);
    }
    for (const sd of ['L', 'R']) {
      tube(J['upperarm01.' + sd], J['wrist.' + sd], arms[sd].filter(i => A[i * 4] < c.cuffS + 0.01), 0.65, 1.0, 0.036);
      if (!c.skirt) tube(J['upperleg01.' + sd], J['foot.' + sd], legs[sd], 0.8, 1.12, 0.058);
    }
    { const bins = 60, y0 = I.hipY - 0.15, y1 = I.neckY, ax = new Float32Array(bins), z0 = new Float32Array(bins).fill(9), z1 = new Float32Array(bins).fill(-9);
      const bi = y => Math.max(0, Math.min(bins - 1, Math.floor((y - y0) / (y1 - y0) * bins)));
      for (const i of torso) { const v = V3(i), j = bi(v.y); ax[j] = Math.max(ax[j], Math.abs(v.x)); z0[j] = Math.min(z0[j], v.z); z1[j] = Math.max(z1[j], v.z); }
      const smooth = arr => Array.from(arr, (x, j) => { let s = 0, cn = 0; for (let o = -4; o <= 4; o++) { const jj = j + o; if (jj >= 0 && jj < bins && arr[jj] > -8 && arr[jj] < 8) { s += arr[jj]; cn++; } } return cn ? s / cn : x; });
      const AX = smooth(ax), Z0 = smooth(z0), Z1 = smooth(z1);
      const shY = J['upperarm01.L'][1] - 0.07;
      for (const i of torso) { const v = V3(i); if (v.y < y0 || v.y > shY) continue; const j = bi(v.y), zc = (Z0[j] + Z1[j]) / 2, rx = AX[j] + 0.004, rz = (Z1[j] - Z0[j]) / 2 + 0.004;
        const e = Math.sqrt((v.x / rx) ** 2 + ((v.z - zc) / rz) ** 2); if (e >= 1 || e < 0.05) continue; const f = (1 / e - 1) * c.fit * w[i] * Math.min(1, (shY - v.y) / 0.08);
        v.x += v.x * f; v.z += (v.z - zc) * f; setV(i, v); }
    }
    const pass = lam => { for (let i = 0; i < n; i++) { const L = nbs[i]; if (!w[i] || !L.length) { q[i * 3] = p[i * 3]; q[i * 3 + 1] = p[i * 3 + 1]; q[i * 3 + 2] = p[i * 3 + 2]; continue; }
        let x = 0, y = 0, z = 0; for (let k = 0; k < L.length; k++) { const j = L[k]; x += p[j * 3]; y += p[j * 3 + 1]; z += p[j * 3 + 2]; } x /= L.length; y /= L.length; z /= L.length;
        const kk = lam * w[i]; q[i * 3] = p[i * 3] + kk * (x - p[i * 3]); q[i * 3 + 1] = p[i * 3 + 1] + kk * (y - p[i * 3 + 1]); q[i * 3 + 2] = p[i * 3 + 2] + kk * (z - p[i * 3 + 2]); }
      p.set(q); };
    for (let it = 0; it < 10; it++) { pass(0.5); pass(-0.53); }
    P.array.set(p); geo.computeVertexNormals();
    geo.setAttribute('fpos', new THREE.Float32BufferAttribute(Float32Array.from(p), 3));
    const N = geo.attributes.normal;
    for (let i = 0; i < n; i++) { P.array[i * 3] += N.getX(i) * th[i]; P.array[i * 3 + 1] += N.getY(i) * th[i]; P.array[i * 3 + 2] += N.getZ(i) * th[i]; }
    P.needsUpdate = true; geo.computeVertexNormals();
  }

  // Skin colours for the lit 3D figures, one for each tone in the look editor. Real skin reflects far less
  // light than its swatch suggests, and even the fairest skin keeps a warm pink-beige colour, so these sit
  // below the swatches and carry more warmth; under the studio lights they read as the swatch, not as white.
  const SKIN_3D = ['#E2B192', '#D9A281', '#CD926E', '#BE7F5A', '#AA6D4B', '#91593B', '#7A4A30', '#623A25', '#4B2C1C', '#352015'];

  /* ================= strands (hair, moustaches) ================= */
  function rng(seed) { let h = seed >>> 0 || 1; return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return (h >>> 0) / 4294967296; }; }
  function seedOf(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  const tangentTo = (v, nn) => v.clone().addScaledVector(nn, -v.dot(nn)).normalize();

  function surfaceIndex(geo, filter) {
    const PA = geo.attributes.position.array, NA = geo.attributes.normal.array, n = geo.attributes.position.count, cell = 0.02, map = new Map();
    const key = (x, y, z) => ((x + 512) * 1048576 + (y + 512) * 1024 + (z + 512));
    for (let i = 0; i < n; i++) { if (!filter(i)) continue; const k = key(Math.floor(PA[i * 3] / cell), Math.floor(PA[i * 3 + 1] / cell), Math.floor(PA[i * 3 + 2] / cell)); const L = map.get(k); if (L) L.push(i); else map.set(k, [i]); }
    const cells = new Map(); map.forEach((v, k) => cells.set(k, Int32Array.from(v)));
    const nn = new THREE.Vector3();
    return {
      /** push p out so it is at least `off` above the surface; returns the surface normal used (or null) */
      push(p, off) {
        let best = -1, bd = 1e9;
        const cx = Math.floor(p.x / cell), cy = Math.floor(p.y / cell), cz = Math.floor(p.z / cell);
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
          const L = cells.get(key(cx + dx, cy + dy, cz + dz)); if (!L) continue;
          for (let k = 0; k < L.length; k++) { const i = L[k] * 3, ax = PA[i] - p.x, ay = PA[i + 1] - p.y, az = PA[i + 2] - p.z, d = ax * ax + ay * ay + az * az; if (d < bd) { bd = d; best = L[k]; } }
        }
        if (best < 0) return null;
        const j = best * 3; nn.set(NA[j], NA[j + 1], NA[j + 2]);
        const h = (p.x - PA[j]) * nn.x + (p.y - PA[j + 1]) * nn.y + (p.z - PA[j + 2]) * nn.z;
        if (h < off) { p.addScaledVector(nn, off - h); return nn.clone(); }
        return null;
      },
    };
  }
  function hairlineAtJS(az, line) { const a = Math.abs(az); let h = line + (-0.12) * sst(0.35, 0.9, a); h = h + (0 - h) * sst(0.9, 1.5, a); h = h + (-0.55 - h) * sst(1.6, 2.6, a); return h; }

  function sampleRoots(geo, idx, weight, n, rnd) {
    const P = geo.attributes.position, N = geo.attributes.normal, tris = [], cum = []; let tot = 0;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let t = 0; t < idx.length; t += 3) {
      const i = idx[t], j = idx[t + 1], k = idx[t + 2];
      const w = Math.min(weight(i), weight(j), weight(k)); if (w <= 0) continue;
      a.fromBufferAttribute(P, i); b.fromBufferAttribute(P, j); c.fromBufferAttribute(P, k);
      tot += b.clone().sub(a).cross(c.clone().sub(a)).length() / 2 * w; tris.push(i, j, k); cum.push(tot);
    }
    const out = [];
    if (!cum.length) return out;
    for (let s = 0; s < n; s++) {
      const r = rnd() * tot; let lo = 0, hi = cum.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < r) lo = m + 1; else hi = m; }
      const i = tris[lo * 3], j = tris[lo * 3 + 1], k = tris[lo * 3 + 2]; let u = rnd(), v = rnd(); if (u + v > 1) { u = 1 - u; v = 1 - v; } const w = 1 - u - v;
      const p = new THREE.Vector3().fromBufferAttribute(P, i).multiplyScalar(w).add(new THREE.Vector3().fromBufferAttribute(P, j).multiplyScalar(u)).add(new THREE.Vector3().fromBufferAttribute(P, k).multiplyScalar(v));
      const nr = new THREE.Vector3().fromBufferAttribute(N, i).multiplyScalar(w).add(new THREE.Vector3().fromBufferAttribute(N, j).multiplyScalar(u)).add(new THREE.Vector3().fromBufferAttribute(N, k).multiplyScalar(v)).normalize();
      out.push({ p, n: nr, tri: i });
    }
    return out;
  }

  function growStrands(spec, rnd) {
    const G = [];
    for (const R of spec.guides) {
      const L = spec.len(R), segs = spec.segs, seg = L / segs;
      const pts = [R.p.clone().addScaledVector(R.n, 0.0005)];
      let d = R.n.clone().multiplyScalar(spec.lift).add(spec.comb(R.p, R).multiplyScalar(1 - spec.lift)).normalize();
      let p = pts[0].clone();
      for (let k = 1; k <= segs; k++) {
        const t = k / segs, cv = spec.comb(p, R), g = spec.gravity ? spec.gravity(t) : 0;
        d = d.multiplyScalar(1 - spec.bend).add(cv.multiplyScalar(spec.bend)); d.y -= g; d.normalize();
        p = p.clone().addScaledVector(d, seg);
        if (spec.shell) spec.shell(p);
        if (spec.collide) { const nrm = spec.collide.push(p, spec.offset + spec.volume * t * (R.edge == null ? 1 : R.edge)); if (nrm) { const dn = d.dot(nrm); if (dn < 0) d.addScaledVector(nrm, -dn).normalize(); } }
        pts.push(p);
      }
      G.push({ R, pts });
    }
    const strands = [];
    if (!G.length) return strands;
    // nearest guide for each root: guides sorted into a small 3D grid (no allocation per lookup)
    const cell = 0.03, nG = G.length, gx = new Float32Array(nG * 3);
    let mnx = 1e9, mny = 1e9, mnz = 1e9, mxx = -1e9, mxy = -1e9, mxz = -1e9;
    for (let i = 0; i < nG; i++) { const p = G[i].R.p; gx[i * 3] = p.x; gx[i * 3 + 1] = p.y; gx[i * 3 + 2] = p.z;
      if (p.x < mnx) mnx = p.x; if (p.y < mny) mny = p.y; if (p.z < mnz) mnz = p.z; if (p.x > mxx) mxx = p.x; if (p.y > mxy) mxy = p.y; if (p.z > mxz) mxz = p.z; }
    const NX = Math.floor((mxx - mnx) / cell) + 1, NY = Math.floor((mxy - mny) / cell) + 1, NZ = Math.floor((mxz - mnz) / cell) + 1;
    const head = new Int32Array(NX * NY * NZ).fill(-1), next = new Int32Array(nG);
    const cellOf = (x, y, z) => { const cx = Math.min(NX - 1, Math.max(0, Math.floor((x - mnx) / cell))), cy = Math.min(NY - 1, Math.max(0, Math.floor((y - mny) / cell))), cz = Math.min(NZ - 1, Math.max(0, Math.floor((z - mnz) / cell))); return [cx, cy, cz]; };
    for (let i = 0; i < nG; i++) { const c = cellOf(gx[i * 3], gx[i * 3 + 1], gx[i * 3 + 2]), k = (c[0] * NY + c[1]) * NZ + c[2]; next[i] = head[k]; head[k] = i; }
    const near = R => {
      const x = R.p.x, y = R.p.y, z = R.p.z, c = cellOf(x, y, z); let best = -1, bd = 1e9;
      for (let r = 1; best < 0 && r < 64; r++) {
        for (let ix = Math.max(0, c[0] - r); ix <= Math.min(NX - 1, c[0] + r); ix++) for (let iy = Math.max(0, c[1] - r); iy <= Math.min(NY - 1, c[1] + r); iy++) for (let iz = Math.max(0, c[2] - r); iz <= Math.min(NZ - 1, c[2] + r); iz++) {
          for (let i = head[(ix * NY + iy) * NZ + iz]; i >= 0; i = next[i]) { const dx = gx[i * 3] - x, dy = gx[i * 3 + 1] - y, dz = gx[i * 3 + 2] - z, d = dx * dx + dy * dy + dz * dz; if (d < bd) { bd = d; best = i; } }
        }
      }
      return G[best < 0 ? 0 : best];
    };
    const up = new THREE.Vector3(0, 1, 0), a1 = new THREE.Vector3(), a2 = new THREE.Vector3(), dir = new THREE.Vector3();
    // guide points as flat arrays, plus (for curls) a frame around each point and the length along the guide, shared by all its children
    for (const g of G) {
      const n = g.pts.length, f = new Float32Array(n * 3); g.pts.forEach((v, k) => { f[k * 3] = v.x; f[k * 3 + 1] = v.y; f[k * 3 + 2] = v.z; }); g.f = f;
      if (spec.curl) {
        const fr = new Float32Array(n * 6), al = new Float32Array(n); let along = 0;
        for (let k = 0; k < n; k++) {
          const k1 = Math.min(n - 1, k + 1) * 3, k0 = Math.max(0, k - 1) * 3;
          dir.set(f[k1] - f[k0], f[k1 + 1] - f[k0 + 1], f[k1 + 2] - f[k0 + 2]).normalize();
          a1.crossVectors(up, dir); if (a1.lengthSq() < 1e-6) a1.set(1, 0, 0); a1.normalize(); a2.crossVectors(dir, a1);
          fr[k * 6] = a1.x; fr[k * 6 + 1] = a1.y; fr[k * 6 + 2] = a1.z; fr[k * 6 + 3] = a2.x; fr[k * 6 + 4] = a2.y; fr[k * 6 + 5] = a2.z;
          if (k) { const dx = f[k * 3] - f[k * 3 - 3], dy = f[k * 3 + 1] - f[k * 3 - 2], dz = f[k * 3 + 2] - f[k * 3 - 1]; along += Math.sqrt(dx * dx + dy * dy + dz * dz); }
          al[k] = along;
        }
        g.fr = fr; g.al = al;
      }
    }
    for (const R of spec.roots) {
      const g = near(R), gf = g.f, K = g.pts.length - 1;
      const ox = R.p.x - g.R.p.x, oy = R.p.y - g.R.p.y, oz = R.p.z - g.R.p.z;
      const phase = rnd() * Math.PI * 2, cr = spec.curl ? spec.curl.r * (0.7 + 0.6 * rnd()) : 0, cf = spec.curl ? spec.curl.f * (0.85 + 0.3 * rnd()) : 0;
      const fx = (rnd() - 0.5) * spec.fuzz, fy = (rnd() - 0.5) * spec.fuzz, fzz = (rnd() - 0.5) * spec.fuzz;
      const lenK = Math.max(2, Math.round(K * (0.75 + 0.25 * rnd())));
      const pts = new Float32Array((lenK + 1) * 3);
      for (let k = 0; k <= lenK; k++) {
        const t = k / K, keep = 1 - spec.clump * Math.min(1, t * 1.6);
        let x = gf[k * 3] + ox * keep + fx * t, y = gf[k * 3 + 1] + oy * keep + fy * t, z = gf[k * 3 + 2] + oz * keep + fzz * t;
        if (cr) {
          const fr = g.fr, ang = phase + g.al[k] * cf * Math.PI * 2, rr = cr * Math.min(1, t * 4), ca = Math.cos(ang) * rr, sa = Math.sin(ang) * rr;
          x += fr[k * 6] * ca + fr[k * 6 + 3] * sa; y += fr[k * 6 + 1] * ca + fr[k * 6 + 4] * sa; z += fr[k * 6 + 2] * ca + fr[k * 6 + 5] * sa;
        }
        pts[k * 3] = x; pts[k * 3 + 1] = y; pts[k * 3 + 2] = z;
      }
      strands.push({ pts, shade: 0.82 + 0.3 * rnd(), w: spec.width * (0.8 + 0.4 * rnd()) });
    }
    return strands;
  }

  function strandMesh(strands, color, opts) {
    opts = opts || {};
    const toFlat = P => { if (P instanceof Float32Array) return P; const f = new Float32Array(P.length * 3); P.forEach((v, k) => { f[k * 3] = v.x; f[k * 3 + 1] = v.y; f[k * 3 + 2] = v.z; }); return f; };
    const per = opts.per > 1 ? opts.per : 1;
    // smooth with a Catmull-Rom spline through the points, `per` samples per segment
    const smooth = f => {
      const n = f.length / 3; if (per === 1 || n < 3) return f;
      const out = new Float32Array(((n - 1) * per + 1) * 3); let o = 0;
      for (let i = 0; i < n - 1; i++) {
        const i0 = Math.max(0, i - 1) * 3, i1 = i * 3, i2 = (i + 1) * 3, i3 = Math.min(n - 1, i + 2) * 3;
        for (let s = 0; s < per; s++) {
          const t = s / per, t2 = t * t, t3 = t2 * t;
          const w0 = -0.5 * t3 + t2 - 0.5 * t, w1 = 1.5 * t3 - 2.5 * t2 + 1, w2 = -1.5 * t3 + 2 * t2 + 0.5 * t, w3 = 0.5 * t3 - 0.5 * t2;
          out[o++] = f[i0] * w0 + f[i1] * w1 + f[i2] * w2 + f[i3] * w3;
          out[o++] = f[i0 + 1] * w0 + f[i1 + 1] * w1 + f[i2 + 1] * w2 + f[i3 + 1] * w3;
          out[o++] = f[i0 + 2] * w0 + f[i1 + 2] * w1 + f[i2 + 2] * w2 + f[i3 + 2] * w3;
        }
      }
      out[o++] = f[(n - 1) * 3]; out[o++] = f[(n - 1) * 3 + 1]; out[o++] = f[(n - 1) * 3 + 2];
      return out;
    };
    let nPts = 0, nSeg = 0; const lists = strands.map(s => { const P = smooth(toFlat(s.pts)); nPts += P.length / 3; nSeg += P.length / 3 - 1; return P; });
    const nV = nPts * 2, pos = new Float32Array(nV * 3), tan = new Float32Array(nV * 3), side = new Float32Array(nV), tt = new Float32Array(nV), shd = new Float32Array(nV), wid = new Float32Array(nV);
    const idx = nV > 65535 ? new Uint32Array(nSeg * 6) : new Uint16Array(nSeg * 6); let v = 0, ii = 0;
    for (let si = 0; si < strands.length; si++) {
      const s = strands[si], P = lists[si], K = P.length / 3 - 1, base = v, sh = s.shade, w = s.w;
      for (let k = 0; k <= K; k++) {
        const a = (k > 0 ? k - 1 : 0) * 3, b = (k < K ? k + 1 : K) * 3;
        let tx = P[b] - P[a], ty = P[b + 1] - P[a + 1], tz = P[b + 2] - P[a + 2]; const tl = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1; tx /= tl; ty /= tl; tz /= tl;
        const px = P[k * 3], py = P[k * 3 + 1], pz = P[k * 3 + 2], tk = k / K;
        for (let sd = -1; sd <= 1; sd += 2) { const o = v * 3; pos[o] = px; pos[o + 1] = py; pos[o + 2] = pz; tan[o] = tx; tan[o + 1] = ty; tan[o + 2] = tz; side[v] = sd; tt[v] = tk; shd[v] = sh; wid[v] = w; v++; }
        if (k < K) { const i = base + k * 2; idx[ii++] = i; idx[ii++] = i + 1; idx[ii++] = i + 2; idx[ii++] = i + 1; idx[ii++] = i + 3; idx[ii++] = i + 2; }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('tangent3', new THREE.BufferAttribute(tan, 3));
    g.setAttribute('side', new THREE.BufferAttribute(side, 1)); g.setAttribute('tt', new THREE.BufferAttribute(tt, 1));
    g.setAttribute('shd', new THREE.BufferAttribute(shd, 1)); g.setAttribute('wid', new THREE.BufferAttribute(wid, 1));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    const c = new THREE.Color(color);
    const m = new THREE.ShaderMaterial({
      uniforms: {
        uCol: { value: new THREE.Vector3(c.r, c.g, c.b) }, uKey: { value: v3(LIGHTS.key).normalize() }, uRim: { value: v3(LIGHTS.rim).normalize() }, uFill: { value: v3(LIGHTS.fill).normalize() },
        uRootDark: { value: opts.rootDark == null ? 0.45 : opts.rootDark }, uSpec: { value: opts.spec == null ? 1 : opts.spec }, uWidthK: { value: 1 },
      },
      vertexShader: `
        attribute vec3 tangent3; attribute float side, tt, shd, wid; uniform float uWidthK;
        varying vec3 vT; varying vec3 vW; varying float vt, vs;
        void main(){
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vec3 T = normalize(mat3(modelMatrix) * tangent3);
          vec3 V = normalize(cameraPosition - wp.xyz);
          vec3 S = normalize(cross(T, V));
          wp.xyz += S * side * wid * uWidthK * (1.0 - 0.75 * tt) * 0.5;
          vT = T; vW = wp.xyz; vt = tt; vs = shd;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: `
        uniform vec3 uCol, uKey, uRim, uFill; uniform float uRootDark, uSpec;
        varying vec3 vT; varying vec3 vW; varying float vt, vs;
        float kk(vec3 T, vec3 L, vec3 V, float shift, float p){ vec3 H = normalize(L + V); float th = dot(T, H) + shift; return pow(max(0.0, sqrt(max(0.0, 1.0 - th * th))), p); }
        void main(){
          vec3 T = normalize(vT), V = normalize(cameraPosition - vW);
          vec3 base = uCol * vs * mix(uRootDark, 1.0, smoothstep(0.0, 0.35, vt)) * (1.0 + 0.12 * vt);
          float dk = sqrt(max(0.0, 1.0 - pow(dot(T, uKey), 2.0)));
          vec3 col = base * (0.28 + 0.68 * dk);
          col += base * 0.25 * sqrt(max(0.0, 1.0 - pow(dot(T, uFill), 2.0)));
          col += vec3(1.0, 0.97, 0.92) * 0.16 * uSpec * kk(T, uKey, V, 0.12, 110.0);
          col += base * 1.4 * uSpec * kk(T, uKey, V, -0.15, 22.0);
          col += mix(base, vec3(0.6, 0.85, 1.0), 0.35) * 0.25 * uSpec * kk(T, uRim, V, 0.0, 30.0);
          gl_FragColor = vec4(col, 1.0 - smoothstep(0.85, 1.0, vt));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      side: THREE.DoubleSide, alphaToCoverage: true,
    });
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.castShadow = false;
    return mesh;
  }

  function buildHair(style, geo, b, I, c, q, hatY, cards) {
    const rnd = rng(c.seed), A = b.A, B = b.B, C = v3(I.headC), S = v3(I.headS);
    const headCol = surfaceIndex(geo, i => A[i * 4 + 3] > 0.5 || (A[i * 4 + 1] < 0.5 && geo.attributes.position.getY(i) > I.neckY - 0.35));
    const line = c.hairline;
    const scalpW = i => { if (A[i * 4 + 3] < 0.5) return 0; const nx = B[i * 4], ny = B[i * 4 + 1], nz = B[i * 4 + 2];
      if (Math.abs(nx) > 0.8 && ny < 0.25 && ny > -0.9) return 0; if (hatY && geo.attributes.position.getY(i) > hatY) return 0;
      return ny - hairlineAtJS(Math.atan2(nx, nz), line) > 0.015 ? 1 : 0; };
    const roots = n => sampleRoots(geo, b.idx, scalpW, n, rnd);
    const down = new THREE.Vector3(0, -1, 0), back = new THREE.Vector3(0, -0.25, -1).normalize();
    const nAt = p => new THREE.Vector3((p.x - C.x) / (S.x * S.x), (p.y - C.y) / (S.y * S.y), (p.z - C.z) / (S.z * S.z)).normalize();
    const D = o => Object.assign({ offset: 0.0022, volume: 0.003, bend: 0.6, lift: 0.2, clump: 0.55, fuzz: 0.002, width: 0.0007, collide: headCol, segs: 8 }, o);
    let spec;
    switch (style) {
      case 'crop': spec = D({ len: () => 0.032 + 0.012 * rnd(), comb: p => tangentTo(back.clone().add(new THREE.Vector3(Math.sign(p.x - C.x) * 0.3, -0.2, 0)), nAt(p)), segs: 7, width: 0.0006, clump: 0.5 }); break;
      case 'side': spec = D({ len: R => 0.05 + 0.025 * rnd() * (R.p.y > C.y ? 1 : 0.5), comb: (p, R) => tangentTo(new THREE.Vector3(R.p.x > C.x + 0.025 ? 1 : -1, -0.5, -0.45), nAt(p)), lift: 0.25, volume: 0.006, segs: 10, width: 0.00065 }); break;
      case 'curly': spec = D({ len: () => 0.045 + 0.015 * rnd(), comb: p => tangentTo(back, nAt(p)), lift: 0.4, volume: 0.012, clump: 0.7, curl: { r: 0.0035, f: 180 }, segs: 10, width: 0.0006 }); break;
      case 'afro': spec = D({ len: () => 0.042 + 0.008 * rnd(), comb: p => nAt(p), lift: 0.9, bend: 0.2, volume: 0.03, clump: 0.75, curl: { r: 0.0032, f: 260 }, segs: 14, width: 0.00055, fuzz: 0.002 }); break;
      case 'long': case 'wavy': spec = D({ len: () => 0.26 + 0.05 * rnd(), comb: (p, R) => p.y > C.y - 0.04 ? tangentTo(new THREE.Vector3(Math.sign(R.p.x - C.x) * 0.6, -1, -0.15), nAt(p)) : down.clone().add(new THREE.Vector3((Math.sign(R.p.x - C.x) || 1) * 0.05, 0, 0)).normalize(),
        gravity: t => 0.35 * t, lift: 0.3, bend: 0.4, volume: 0.008, segs: 22, width: 0.0007, clump: 0.65, curl: style === 'wavy' ? { r: 0.006, f: 18 } : null }); break;
      case 'bob': spec = D({ len: R => (R.p.z < C.z - 0.05 ? 0.16 : 0.13) + 0.02 * rnd(), comb: (p, R) => p.y > C.y - 0.02 ? tangentTo(new THREE.Vector3(Math.sign(R.p.x - C.x) * 0.7, -1, -0.1), nAt(p)) : down.clone(),
        gravity: t => 0.3 * t, lift: 0.3, volume: 0.009, segs: 16, width: 0.0007, clump: 0.6 }); break;
      case 'bun': case 'ponytail': case 'braids': {
        const tie = C.clone().add(new THREE.Vector3(0, style === 'bun' ? S.y * 0.15 : S.y * 0.05, -S.z * 0.5));
        spec = D({ len: R => Math.max(0.02, R.p.distanceTo(tie) * 0.98), comb: p => tangentTo(tie.clone().sub(p), nAt(p)), lift: 0.02, bend: 0.85, volume: 0.0015, offset: 0.0018, segs: 14, width: 0.0006, clump: 0.3, fuzz: 0.0008 });
        spec.tie = tie; break; }
      default: spec = D({ len: () => 0.035, comb: p => tangentTo(back, nAt(p)), segs: 6 });
    }
    // lighter figures (the people further away, small devices) get fewer and shorter-jointed strands
    const lite = q < 0.6 ? q / 0.6 : 1;
    let nG = Math.round((style === 'afro' ? 3000 : 1600) * Math.max(0.35, q)), nC = Math.round((style === 'afro' ? 40000 : (style === 'long' || style === 'wavy') ? 22000 : 18000) * q * lite);
    if (lite < 1 && spec.segs) spec.segs = Math.max(4, Math.round(spec.segs * (0.5 + 0.5 * lite)));
    // hair cards: about a twelfth as many locks, each several times as wide, with fewer joints (the painted hair under them fills the gaps)
    if (cards) { nC = Math.max(300, Math.round(nC / 12)); nG = Math.max(200, Math.round(nG / 3)); spec.width *= 6.5; if (spec.segs) spec.segs = Math.max(4, Math.round(spec.segs * 0.6)); }
    spec.shell = p => { const d = p.clone().sub(C), e = Math.sqrt((d.x / (S.x / 2)) ** 2 + (d.y / (S.y / 2)) ** 2 + (d.z / (S.z / 2)) ** 2); if (p.y > C.y - S.y * 0.35 && e < 0.86 && e > 0.01) p.copy(C).addScaledVector(d, 0.86 / e); };
    spec.guides = roots(nG); spec.roots = roots(nC);
    const edgeOf = R => { const i = R.tri; return Math.min(1, Math.max(0, (B[i * 4 + 1] - hairlineAtJS(Math.atan2(B[i * 4], B[i * 4 + 2]), line)) / 0.25)); };
    for (const R of spec.guides.concat(spec.roots)) R.edge = 0.25 + 0.75 * edgeOf(R);
    const len0 = spec.len; spec.len = R => len0(R) * (0.6 + 0.4 * (R.edge || 1));
    const g = new THREE.Group();
    g.add(strandMesh(growStrands(spec, rnd), c.hair, { per: spec.curl && q > 0.5 ? 3 : spec.curl && q >= 0.45 ? 2 : 1 }));
    const wK = 1 / Math.sqrt(Math.max(0.25, q));
    if (style === 'bun') g.add(strandMesh(coil(spec.tie, 0.04, rnd, Math.round(9000 * q)), c.hair, { rootDark: 0.7 }));
    if (style === 'ponytail') g.add(strandMesh(tail(spec.tie, rnd, Math.round(8000 * q), headCol, 0.012, 0.26), c.hair, { rootDark: 0.7 }));
    if (style === 'braids') for (const sx of [-1, 1]) g.add(strandMesh(tail(spec.tie.clone().add(new THREE.Vector3(sx * S.x * 0.32, -S.y * 0.25, S.z * 0.08)), rnd, Math.round(4000 * q), headCol, 0.008, 0.3, true), c.hair, { rootDark: 0.6 }));
    g.traverse(o => { if (o.material && o.material.uniforms && o.material.uniforms.uWidthK) o.material.uniforms.uWidthK.value = wK; });
    return g;
  }
  function coil(cc, r, rnd, n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const ax = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(), u = new THREE.Vector3(0, 1, 0).cross(ax).normalize(), v = ax.clone().cross(u);
      const a0 = rnd() * Math.PI * 2, span = 1.2 + rnd() * 1.6, rr = r * (0.82 + 0.2 * rnd()), pts = [];
      for (let k = 0; k <= 16; k++) { const a = a0 + span * k / 16; pts.push(cc.clone().add(new THREE.Vector3(0, 0, -r * 0.6)).addScaledVector(u, Math.cos(a) * rr).addScaledVector(v, Math.sin(a) * rr).addScaledVector(ax, (rnd() - 0.5) * 0.002)); }
      out.push({ pts, shade: 0.8 + 0.3 * rnd(), w: 0.0007 });
    }
    return out;
  }
  function tail(cc, rnd, n, col, r, len, braid) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, r0 = r * Math.sqrt(rnd()), pts = [];
      let p = cc.clone().add(new THREE.Vector3(Math.cos(a) * r0, Math.sin(a) * r0, -0.01)), d = new THREE.Vector3(0, braid ? -1 : -0.3, braid ? -0.2 : -1).normalize();
      const L = len * (0.9 + 0.2 * rnd()), K = 18, strandGroup = Math.floor(rnd() * 3);
      for (let k = 0; k <= K; k++) {
        const t = k / K; const q = p.clone();
        if (braid) { const ph = t * 22 + strandGroup * 2.094; q.x += Math.sin(ph) * r * 0.55; q.z += Math.cos(ph) * r * 0.35; }
        pts.push(q); d.y -= braid ? 0.05 : 0.18; d.normalize(); p = p.clone().addScaledVector(d, L / K); p.x += Math.cos(a) * r0 * 0.12 * t; col.push(p, 0.004);
      }
      out.push({ pts, shade: 0.8 + 0.3 * rnd(), w: 0.0007 });
    }
    return out;
  }

  /* ---------- moustaches ---------- */
  function buildMoustache(style, geo, b, I, c, mouth, q) {
    const rnd = rng(c.seed + 5), A = b.A, P = geo.attributes.position;
    const headCol = surfaceIndex(geo, i => A[i * 4 + 3] > 0.5);
    const my = mouth[1], mz = mouth[2];
    const front = i => A[i * 4 + 3] > 0.5 && P.getZ(i) > mz - 0.05;
    const upper = (w, h0, h1) => i => front(i) && Math.abs(P.getX(i)) < w && P.getY(i) > my + h0 && P.getY(i) < my + h1 ? 1 : 0;
    const D = o => Object.assign({ offset: 0.0012, volume: 0.002, bend: 0.4, lift: 0.25, clump: 0.5, fuzz: 0.0008, width: 0.00045, collide: headCol, segs: 6 }, o);
    const outDown = (p, R) => tangentTo(new THREE.Vector3(Math.sign(p.x) * 0.9, -1, 0.15), R.n);
    const sets = [];
    const add = (weight, n, spec) => { n = Math.round(n * q); spec.guides = sampleRoots(geo, b.idx, weight, Math.max(60, n / 12), rnd); spec.roots = sampleRoots(geo, b.idx, weight, n, rnd); sets.push(growStrands(spec, rnd)); };
    switch (style) {
      case 'pencil': add(upper(0.024, 0.0045, 0.009), 2500, D({ len: () => 0.004, comb: outDown, segs: 3, width: 0.0004 })); break;
      case 'chevron': add(upper(0.028, 0.004, 0.019), 11000, D({ len: () => 0.011 + 0.002 * rnd(), comb: outDown, volume: 0.003, clump: 0.7, fuzz: 0.0004 })); break;
      case 'walrus': add(upper(0.033, 0.003, 0.021), 13000, D({ len: () => 0.02 + 0.004 * rnd(), comb: (p, R) => tangentTo(new THREE.Vector3(Math.sign(p.x) * 0.4, -1, 0.35), R.n), gravity: t => 0.2 * t, volume: 0.004, segs: 8 })); break;
      case 'handlebar': add(upper(0.03, 0.005, 0.016), 11000, D({ len: R => 0.014 + 0.03 * Math.pow(Math.abs(R.p.x) / 0.03, 1.5), comb: p => { const ax = Math.abs(p.x), k = -0.45 + 2.4 * Math.min(1, Math.max(0, (ax - 0.028) / 0.022)); return new THREE.Vector3(Math.sign(p.x), k, 0.25 - 0.6 * Math.min(1, Math.max(0, (ax - 0.03) / 0.02))).normalize(); }, bend: 0.55, lift: 0.1, segs: 16, volume: 0.003, clump: 0.85, fuzz: 0.0003, width: 0.0005 })); break;
      case 'horseshoe': add(upper(0.03, 0.004, 0.017), 5500, D({ len: () => 0.012, comb: outDown }));
        add(i => front(i) && Math.abs(P.getX(i)) > 0.024 && Math.abs(P.getX(i)) < 0.034 && P.getY(i) < my + 0.008 && P.getY(i) > my - 0.05 ? 1 : 0, 5000, D({ len: () => 0.012, comb: (p, R) => tangentTo(new THREE.Vector3(0, -1, 0.2), R.n) })); break;
    }
    const g = new THREE.Group(), wK = 1 / Math.sqrt(Math.max(0.25, q));
    for (const s of sets) { for (const st of s) st.shade = 0.72 + 0.28 * rnd(); const m = strandMesh(s, c.hair, { per: q > 0.5 ? 2 : 1, rootDark: 0.7, spec: 0.45 }); m.material.uniforms.uWidthK.value = wK; g.add(m); }
    return g;
  }

  /* ---------- beards: growth map from facial landmarks + layered shells ---------- */
  function faceMarks(geo, b, I, mouth) {
    const P = geo.attributes.position, A = b.A, hc = I.headC, eyeY = I.eyeL[1];
    let earX = 0, chinY = 9, noseTip = null;
    for (let i = 0; i < P.count; i++) {
      if (A[i * 4 + 1] > 0.5) continue;
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
      if (Math.abs(y - (eyeY - 0.02)) < 0.012 && A[i * 4 + 3] > 0.5 && Math.abs(x - hc[0]) > earX) earX = Math.abs(x - hc[0]);
      if (Math.abs(x) < 0.012 && z > mouth[2] - 0.035 && y < mouth[1] - 0.01 && y > I.neckY - 0.04) chinY = Math.min(chinY, y);
      if (Math.abs(x) < 0.006 && y < eyeY - 0.01 && y > mouth[1] + 0.01 && (!noseTip || z > noseTip.z)) noseTip = { y, z };
    }
    let tragus = 1.5;
    for (let i = 0; i < P.count; i++) {
      const x = Math.abs(P.getX(i) - hc[0]), y = P.getY(i), z = P.getZ(i);
      if (Math.abs(y - (eyeY - 0.02)) < 0.014 && x > earX - 0.012) tragus = Math.min(tragus, Math.atan2(x, z - hc[2]));
    }
    return { hc, eyeY, mouth, chinY, earTh: tragus, noseBaseY: noseTip ? Math.min(noseTip.y - 0.012, mouth[1] + 0.024) : mouth[1] + 0.022, neckY: I.neckY };
  }
  function beardField(style, M) {
    const my = M.mouth[1], hc = M.hc, thSB = M.earTh - 0.1, lerpN = (a, b2, t) => a + (b2 - a) * t;
    return (x0, y, z) => {
      const x = Math.abs(x0 - hc[0]), th = Math.atan2(x, z - hc[2]);
      if (z < hc[2] - 0.06) return { d: 0, L: 0, th };
      let top;
      if (th < 0.3) top = M.noseBaseY;
      else if (th < 0.55) top = lerpN(M.noseBaseY, my + 0.042, sst(0.3, 0.55, th));
      else top = lerpN(my + 0.045, M.eyeY - 0.004, sst(0.95, thSB, th));
      const bot = lerpN(M.chinY - 0.032, M.eyeY - 0.07, sst(0.15, thSB, th));
      let d = sst(top + 0.003, top - 0.008, y) * sst(bot - 0.004, bot + 0.01, y) * sst(thSB + 0.02, thSB - 0.06, th);
      if (y < M.chinY + 0.01 && x < 0.07 && z > hc[2] - 0.005) d = Math.max(d, sst(bot - 0.004, bot + 0.01, y) * sst(0.075, 0.05, x));
      d *= sst(0.98, 1.22, Math.hypot(x / 0.028, (y - my) / 0.0118));
      if (style === 'goatee' || style === 'vandyke') d *= sst(0.4, 0.3, th) * sst(M.noseBaseY + 0.002, M.noseBaseY - 0.004, y) * (y < my - 0.004 ? sst(0.034, 0.024, x) : (style === 'vandyke' ? 0 : 1));
      const base = { stubble: 0.0016, short: 0.006, full: 0.018, goatee: 0.012, vandyke: 0.012 }[style] || 0.01;
      const chin = Math.exp(-((x / 0.035) ** 2)) * sst(my - 0.01, my - 0.045, y);
      let L = base * (0.55 + 0.45 * sst(my + 0.035, my, y)) * (1 + (style === 'full' ? 0.6 : 0.25) * chin) * (0.5 + 0.5 * d);
      if (th < 0.33 && y > my) L = Math.min(L, style === 'full' ? 0.012 : base);
      return { d: Math.max(0, Math.min(1, d)), L, th };
    };
  }
  function buildBeard(style, geo, b, I, c, mouth, q) {
    const M = faceMarks(geo, b, I, mouth), F = beardField(style, M);
    const P = geo.attributes.position, N = geo.attributes.normal, idx = b.idx, A = b.A, n = P.count;
    const Dn = new Float32Array(n), L = new Float32Array(n), dir = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      if (P.getY(i) < I.neckY - 0.05 || A[i * 4 + 1] > 0.5) continue;
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i), f = F(x, y, z); Dn[i] = f.d; L[i] = f.L;
      if (!f.d) continue;
      const nr = new THREE.Vector3(N.getX(i), N.getY(i), N.getZ(i)), sx = Math.sign(x - M.hc[0]) || 1;
      const chin = Math.exp(-((x / 0.035) ** 2)) * sst(mouth[1] - 0.01, mouth[1] - 0.045, y);
      const cmb = new THREE.Vector3(sx * 0.2, -1, 0.25 + 0.6 * chin);
      if (f.th < 0.35 && y > mouth[1]) cmb.set(sx * 0.9, -1, 0.25);
      cmb.addScaledVector(nr, -cmb.dot(nr)).normalize();
      dir[i * 3] = cmb.x; dir[i * 3 + 1] = cmb.y; dir[i * 3 + 2] = cmb.z;
    }
    geo.setAttribute('beardW', new THREE.Float32BufferAttribute(Array.from(Dn, d => Math.min(1, d * (style === 'stubble' ? 0.8 : 1.2))), 1));
    const tris = [];
    for (let t = 0; t < idx.length; t += 3) if (Dn[idx[t]] + Dn[idx[t + 1]] + Dn[idx[t + 2]] > 0.02) tris.push(idx[t], idx[t + 1], idx[t + 2]);
    const used = new Map(), verts = [];
    for (const i of tris) if (!used.has(i)) { used.set(i, verts.length); verts.push(i); }
    const K = Math.max(4, Math.round((style === 'stubble' ? 6 : style === 'short' ? 18 : 34) * (q < 0.5 ? 0.6 : 1)));
    const nv = verts.length * K, pos = new Float32Array(nv * 3), base = new Float32Array(nv * 3), hh = new Float32Array(nv), dd = new Float32Array(nv), td = new Float32Array(nv * 3), ix = [];
    let o = 0;
    for (let k = 1; k <= K; k++) {
      const h = k / K, off = verts.length * (k - 1);
      for (const i of verts) {
        const nx = N.getX(i), ny = N.getY(i), nz = N.getZ(i), l = L[i];
        const out = h * l * (style === 'full' ? 0.42 : 0.55), bend = Math.pow(h, 1.5) * l * (style === 'stubble' ? 0.3 : 0.85);
        pos[o * 3] = P.getX(i) + nx * out + dir[i * 3] * bend; pos[o * 3 + 1] = P.getY(i) + ny * out + dir[i * 3 + 1] * bend; pos[o * 3 + 2] = P.getZ(i) + nz * out + dir[i * 3 + 2] * bend;
        base[o * 3] = P.getX(i); base[o * 3 + 1] = P.getY(i); base[o * 3 + 2] = P.getZ(i); hh[o] = h; dd[o] = Dn[i];
        let tx = nx * 0.55 + dir[i * 3] * 1.3 * h, ty = ny * 0.55 + dir[i * 3 + 1] * 1.3 * h, tz = nz * 0.55 + dir[i * 3 + 2] * 1.3 * h; const tl = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1;
        td[o * 3] = tx / tl; td[o * 3 + 1] = ty / tl; td[o * 3 + 2] = tz / tl; o++;
      }
      for (const i of tris) ix.push(used.get(i) + off);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('base', new THREE.BufferAttribute(base, 3));
    g.setAttribute('hh', new THREE.BufferAttribute(hh, 1)); g.setAttribute('dens', new THREE.BufferAttribute(dd, 1)); g.setAttribute('tdir', new THREE.BufferAttribute(td, 3));
    g.setIndex(nv > 65535 ? new THREE.Uint32BufferAttribute(ix, 1) : new THREE.Uint16BufferAttribute(ix, 1));
    const col = new THREE.Color(c.hair);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uCol: { value: new THREE.Vector3(col.r, col.g, col.b) }, uCell: { value: style === 'stubble' ? 0.00032 : 0.0005 },
        uKey: { value: v3(LIGHTS.key).normalize() }, uFill: { value: v3(LIGHTS.fill).normalize() }, uRim: { value: v3(LIGHTS.rim).normalize() },
        uFillRate: { value: style === 'stubble' ? 0.85 : 1.0 }, uThick: { value: style === 'stubble' ? 0.6 : 1.12 }, uGrey: { value: c.grey },
      },
      vertexShader: `
        attribute vec3 base, tdir; attribute float hh, dens;
        varying vec3 vBase, vT, vW; varying float vH, vD;
        void main(){ vBase = base; vH = hh; vD = dens; vT = normalize(mat3(modelMatrix) * tdir);
          vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: `
        uniform vec3 uCol, uKey, uFill, uRim; uniform float uCell, uFillRate, uThick, uGrey;
        varying vec3 vBase, vT, vW; varying float vH, vD;
        float h31(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
        float kk(vec3 T, vec3 L, vec3 V, float sh, float pw){ vec3 H = normalize(L + V); float t = dot(T, H) + sh; return pow(max(0.0, sqrt(max(0.0, 1.0 - t * t))), pw); }
        void main(){
          // hairs never get thinner than about a pixel: smaller on screen means fewer, slightly thicker hairs
          float cell = max(uCell, length(fwidth(vBase)) * 0.9);
          vec3 p = vBase / cell, ip = floor(p), fp = fract(p);
          float best = 9.0; vec3 bid = vec3(0.0);
          for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
            vec3 g = vec3(float(x), float(y), float(z)), id = ip + g;
            vec3 o = vec3(h31(id), h31(id + 17.3), h31(id + 41.9));
            o += 0.18 * vec3(sin(vH * 5.0 + o.x * 6.3), sin(vH * 4.0 + o.y * 6.3), 0.0);
            float dd = length(g + o - fp); if (dd < best) { best = dd; bid = id; } }
          float r1 = h31(bid + 3.1), r2 = h31(bid + 7.7), r3 = h31(bid + 11.3);
          if (r1 > vD * uFillRate) discard;
          float hmax = 0.45 + 0.55 * r2; if (vH > hmax) discard;
          float rad = 0.46 * uThick * (1.0 - pow(vH / hmax, 1.6)) + 0.06;
          float a = smoothstep(rad, rad * 0.4, best); if (a < 0.02) discard;
          vec3 V = normalize(cameraPosition - vW), T = normalize(vT);
          float ao = mix(0.12, 1.0, pow(vH, 0.9));
          vec3 base = uCol * (0.82 + 0.26 * r3) * ao;
          if (r3 > 1.0 - uGrey) base = vec3(0.62, 0.6, 0.57) * ao;
          float dk = sqrt(max(0.0, 1.0 - pow(dot(T, uKey), 2.0)));
          vec3 col = base * (0.32 + 0.75 * dk) + base * 0.25 * sqrt(max(0.0, 1.0 - pow(dot(T, uFill), 2.0)));
          col += vec3(1.0, 0.96, 0.9) * 0.04 * kk(T, uKey, V, 0.1, 80.0) * ao;
          col += base * 0.3 * kk(T, uKey, V, -0.12, 18.0);
          col += base * 0.25 * kk(T, uRim, V, 0.0, 24.0);
          if (uThick < 0.7) { col = mix(col, uCol * 0.35, 0.45); a *= 0.8; }
          gl_FragColor = vec4(col, a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      side: THREE.DoubleSide, alphaToCoverage: true,
    });
    const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false;
    const grp = new THREE.Group(); grp.add(mesh);
    if ((style === 'full' || style === 'short') && q > 0.5) {
      const rnd = rng(c.seed + 21), weight = i => Dn[i];
      const spec = { len: R => F(R.p.x, R.p.y, R.p.z).L * 1.05, comb: (p, R) => tangentTo(new THREE.Vector3((Math.sign(p.x) || 1) * 0.25, -1, 0.35), R.n), segs: 6, lift: 0.4, bend: 0.5,
        offset: 0.0008, volume: style === 'full' ? 0.009 : 0.003, clump: 0.2, fuzz: 0.0012, width: 0.00022, collide: surfaceIndex(geo, i => P.getY(i) > I.neckY - 0.06 && A[i * 4 + 1] < 0.5), curl: { r: 0.0012, f: 120 } };
      spec.guides = sampleRoots(geo, idx, weight, 400, rnd); spec.roots = sampleRoots(geo, idx, weight, style === 'full' ? 3500 : 1500, rnd);
      const st = growStrands(spec, rnd); for (const s of st) s.shade = 0.55 + 0.25 * rnd();
      grp.add(strandMesh(st, c.hair, { per: 2, rootDark: 0.6, spec: 0.35 }));
    }
    return grp;
  }

  /* ================= props: eyes, glasses, caps, shoes, badges ================= */
  const _tex = {};
  function irisTexture(color) {
    if (_tex[color]) return _tex[color];
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64; const g = cv.getContext('2d'), col = new THREE.Color(color);
    const d = g.createImageData(128, 64), rnd = rng(seedOf(color));
    for (let y = 0; y < 64; y++) for (let x = 0; x < 128; x++) {
      const r = y / 63; let R, G, B;
      if (r < 0.32) R = G = B = 8;
      else if (r < 0.88) { const k = (r - 0.3) / 0.58, s = 0.8 + 0.5 * rnd() * (0.5 + 0.5 * Math.sin(x * 0.9)); const l = (0.8 + 0.7 * Math.sin(k * Math.PI)) * s; R = col.r * 255 * l; G = col.g * 255 * l; B = col.b * 255 * l; }
      else { R = col.r * 60; G = col.g * 60; B = col.b * 60; }
      const i = (y * 128 + x) * 4; d.data[i] = R; d.data[i + 1] = G; d.data[i + 2] = B; d.data[i + 3] = 255;
    }
    g.putImageData(d, 0, 0); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.userData.shared = true; return (_tex[color] = t);
  }
  function eye(center, r, irisCol) {
    const g = new THREE.Group(); g.position.set(center[0], center[1], center[2]);
    g.add(new THREE.Mesh(new THREE.SphereGeometry(r, 32, 24), new THREE.MeshPhysicalMaterial({ color: '#efe9e2', roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.03 })));
    const iris = new THREE.Mesh(new THREE.SphereGeometry(r * 1.004, 32, 12, 0, Math.PI * 2, 0, 0.5), new THREE.MeshPhysicalMaterial({ map: irisTexture(irisCol), roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.02 }));
    iris.rotation.x = Math.PI / 2; g.add(iris);
    const cornea = new THREE.Mesh(new THREE.SphereGeometry(r * 0.55, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.12, roughness: 0.0, clearcoat: 1, depthWrite: false }));
    cornea.rotation.x = Math.PI / 2; cornea.position.z = r * 0.86; g.add(cornea);
    return g;
  }
  function wingsShape() {
    const s = new THREE.Shape();
    s.moveTo(0, -0.004); s.lineTo(0.006, -0.002); s.bezierCurveTo(0.014, 0.0, 0.024, 0.004, 0.034, 0.007);
    s.lineTo(0.03, 0.002); s.lineTo(0.033, 0.0015); s.lineTo(0.026, -0.002); s.lineTo(0.028, -0.003); s.lineTo(0.016, -0.005); s.lineTo(0.007, -0.0065); s.lineTo(0, -0.0085);
    s.lineTo(-0.007, -0.0065); s.lineTo(-0.016, -0.005); s.lineTo(-0.028, -0.003); s.lineTo(-0.026, -0.002); s.lineTo(-0.033, 0.0015); s.lineTo(-0.03, 0.002);
    s.lineTo(-0.034, 0.007); s.bezierCurveTo(-0.024, 0.004, -0.014, 0.0, -0.006, -0.002); s.lineTo(0, -0.004);
    return s;
  }
  const gold = () => new THREE.MeshStandardMaterial({ color: '#E2B657', roughness: 0.28, metalness: 1 });
  function badge(accent, scale) {
    const g = new THREE.Group(), gm = gold();
    g.add(new THREE.Mesh(new THREE.ExtrudeGeometry(wingsShape(), { depth: 0.0015, bevelEnabled: true, bevelThickness: 0.0006, bevelSize: 0.0005, bevelSegments: 2 }), gm));
    const cc = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.003, 20), new THREE.MeshStandardMaterial({ color: accent, roughness: 0.35, metalness: 0.2 }));
    cc.rotation.x = Math.PI / 2; cc.position.set(0, -0.003, 0.0022); g.add(cc);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0058, 0.0009, 6, 20), gm); ring.position.copy(cc.position); ring.position.z += 0.001; g.add(ring);
    g.scale.setScalar(scale);
    return g;
  }

  /** Glasses: pilot aviators (gold frame, green-grey lenses), clear aviators, round or rectangular frames. */
  function glasses(kind, I, eyeR) {
    const g = new THREE.Group(), sun = kind === 'sunglasses';
    const metal = new THREE.MeshStandardMaterial({ color: kind === 'aviator' || sun ? '#C9A45C' : '#23262C', roughness: 0.22, metalness: kind === 'aviator' || sun ? 1 : 0.4, envMapIntensity: 1.3 });
    const lensMat = sun ? new THREE.MeshPhysicalMaterial({ color: '#27352d', roughness: 0.04, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.02, transparent: true, opacity: 0.86, envMapIntensity: 1.8, side: THREE.DoubleSide, depthWrite: false })
      : new THREE.MeshPhysicalMaterial({ color: '#dfeeff', roughness: 0.02, transparent: true, opacity: 0.14, clearcoat: 1, envMapIntensity: 1.6, side: THREE.DoubleSide, depthWrite: false });
    const S = new THREE.Shape();
    let cx, cy;
    if (kind === 'round') { S.absarc(24, 0, 23, 0, Math.PI * 2, false); cx = 24; cy = 0; }
    else if (kind === 'rect') { const w = 50, h = 34, r = 7; S.moveTo(r, h / 2); S.lineTo(w - r, h / 2); S.quadraticCurveTo(w, h / 2, w, h / 2 - r); S.lineTo(w, -h / 2 + r); S.quadraticCurveTo(w, -h / 2, w - r, -h / 2); S.lineTo(r, -h / 2); S.quadraticCurveTo(0, -h / 2, 0, -h / 2 + r); S.lineTo(0, h / 2 - r); S.quadraticCurveTo(0, h / 2, r, h / 2); cx = 25; cy = 0; }
    else { S.moveTo(0, 17); S.bezierCurveTo(16, 19, 38, 21, 52, 19); S.bezierCurveTo(60, 16, 60, 2, 56, -8); S.bezierCurveTo(50, -26, 30, -33, 17, -29); S.bezierCurveTo(5, -25, -1, -12, -1, 0); S.bezierCurveTo(-1, 8, -1, 13, 0, 17); cx = 27; cy = -4; }
    const outline = S.getSpacedPoints(80), mm = 0.001 * 0.95 * (I.eyeScale || 1), Rc = 0.085;
    const eL = v3(I.eyeL), eR = v3(I.eyeR), mid = eL.clone().add(eR).multiplyScalar(0.5);
    const half = Math.max(0.033, Math.abs(eL.x - eR.x) / 2 + 0.002), z = Math.max(eL.z, eR.z) + eyeR + 0.016;
    const parts = [];
    for (const sd of [1, -1]) {
      const lens = new THREE.Group(), geo = new THREE.ShapeGeometry(S, 32), P = geo.attributes.position;
      for (let i = 0; i < P.count; i++) { const x = (P.getX(i) - cx) * mm, y = (P.getY(i) - cy) * mm; P.setXYZ(i, x * sd, y, -(x * x + y * y) / (2 * Rc)); }
      geo.computeVertexNormals(); lens.add(new THREE.Mesh(geo, lensMat));
      const rim = outline.map(p => { const x = (p.x - cx) * mm, y = (p.y - cy) * mm; return new THREE.Vector3(x * sd, y, -(x * x + y * y) / (2 * Rc) + 0.0004); });
      lens.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rim, true), 160, kind === 'round' || kind === 'rect' ? 0.0013 : 0.00085, 8, true), metal));
      lens.position.set(mid.x + sd * half, eL.y - 0.004, z); lens.rotation.y = sd * 0.1;
      g.add(lens); parts.push({ sd, lens });
    }
    g.updateMatrixWorld(true);
    const at = (sd, xmm, ymm) => new THREE.Vector3((xmm - cx) * mm * sd, (ymm - cy) * mm, 0).applyMatrix4(parts.find(q => q.sd === sd).lens.matrixWorld);
    const tube = (pts, r) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, r, 8, false), metal);
    const aL = at(1, kind === 'round' ? 1 : 0, kind === 'round' ? 6 : 17), aR = at(-1, kind === 'round' ? 1 : 0, kind === 'round' ? 6 : 17);
    g.add(tube([aR, aR.clone().lerp(aL, 0.5).add(new THREE.Vector3(0, 0.0015, 0.001)), aL], 0.0009));
    if (kind === 'aviator' || sun) { const bL = at(1, -1, 5), bR = at(-1, -1, 5); g.add(tube([bR, bR.clone().lerp(bL, 0.5).add(new THREE.Vector3(0, 0.006, 0.002)), bL], 0.0009)); }
    for (const sd of [1, -1]) { const pad = new THREE.Mesh(new THREE.SphereGeometry(0.0042, 12, 8), new THREE.MeshPhysicalMaterial({ color: '#e8eef2', roughness: 0.1, transparent: true, opacity: 0.55 })); pad.scale.set(0.45, 1, 0.8); pad.position.copy(at(sd, 2, -6)).add(new THREE.Vector3(-sd * 0.004, -0.002, -0.006)); g.add(pad); }
    const hc = v3(I.headC), hs = v3(I.headS);
    for (const sd of [1, -1]) {
      const s0 = at(sd, kind === 'round' ? 47 : kind === 'rect' ? 50 : 54, kind === 'round' ? 4 : 15), ear = new THREE.Vector3(hc.x + sd * (hs.x / 2 + 0.004), eL.y - 0.002, hc.z - 0.015);
      g.add(tube([s0, s0.clone().add(new THREE.Vector3(sd * 0.006, 0, -0.02)), ear.clone().add(new THREE.Vector3(0, 0.002, 0.03)), ear, ear.clone().add(new THREE.Vector3(-sd * 0.006, -0.03, -0.02))], 0.0011));
    }
    return g;
  }

  /** Peaked cap (gold braid for captains), a flight attendant's cap, a pillbox, or a mechanic's cap. */
  function hat(kind, I, uni, accent) {
    const g = new THREE.Group(), hc = I.headC, hs = I.headS;
    const navy = new THREE.MeshPhysicalMaterial({ color: uni, roughness: 0.8, sheen: 0.4, sheenColor: new THREE.Color(uni).offsetHSL(0, 0, 0.25) }), gm = gold();
    if (kind === 'beret') {   // a soft beret, pulled down to one side
      const rx = hs[0] / 2 * 1.12, rz = hs[2] / 2 * 1.1, baseY = hc[1] + hs[1] * 0.18;
      const b = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 16), navy); b.scale.set(rx, hs[1] * 0.16, rz); b.position.set(hc[0] - 0.012, baseY, hc[2] - 0.008); b.rotation.z = 0.18; g.add(b);
      const band = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 8, 40), navy); band.scale.set(rx * 0.92, rz * 0.92, 0.12); band.rotation.x = Math.PI / 2; band.position.set(hc[0], baseY - 0.012, hc[2] - 0.004); g.add(band);
      const badgeM = new THREE.Mesh(new THREE.CircleGeometry(0.012, 16), gm); badgeM.position.set(hc[0] + 0.03, baseY - 0.004, hc[2] + rz * 0.9); g.add(badgeM);
      return g;
    }
    if (kind === 'mech') {
      const rx = hs[0] / 2 * 1.08, rz = hs[2] / 2 * 1.02, baseY = hc[1] - 0.018;
      const crown = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), navy); crown.scale.set(rx * 0.98, hs[1] * 0.62, rz); crown.position.set(hc[0], baseY + 0.006, hc[2] - 0.004);
      const btn = new THREE.Mesh(new THREE.SphereGeometry(0.007, 12, 8), navy); btn.position.set(hc[0], baseY + 0.006 + hs[1] * 0.62, hc[2] - 0.004);
      const bill = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.006, 40, 1, false, -Math.PI / 2.3, Math.PI / 1.15), navy); bill.scale.set(rx * 0.9, 1, rz * 0.85); bill.position.set(hc[0], baseY + 0.004, hc[2] + rz * 0.62); bill.rotation.x = 0.08;
      const logo = new THREE.Mesh(new THREE.CircleGeometry(0.012, 24), new THREE.MeshStandardMaterial({ color: accent, roughness: 0.5 })); logo.position.set(hc[0], baseY + 0.045, hc[2] + rz * 0.93); logo.rotation.x = -0.45;
      g.add(crown, btn, bill, logo); return g;
    }
    if (kind === 'pillbox') {
      const pb = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.062, 0.05, 40), navy); pb.position.set(hc[0] - 0.025, hc[1] + hs[1] * 0.42, hc[2] + 0.01); pb.rotation.set(0.12, 0, 0.22);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.0625, 0.0625, 0.012, 40, 1, true), new THREE.MeshStandardMaterial({ color: accent, roughness: 0.6, side: THREE.DoubleSide })); band.position.copy(pb.position); band.rotation.copy(pb.rotation); band.position.y -= 0.012;
      const b = badge(accent, 0.6); b.position.set(hc[0] - 0.02, hc[1] + hs[1] * 0.4, hc[2] + 0.07); b.rotation.z = 0.22;
      g.add(pb, band, b); return g;
    }
    const rx = hs[0] / 2 * 0.98, rz = hs[2] / 2 * 0.95, baseY = hc[1] - 0.012, bandH = 0.038;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, bandH, 64, 1, true), new THREE.MeshPhysicalMaterial({ color: '#141519', roughness: 0.5, side: THREE.DoubleSide })); band.scale.set(rx, 1, rz); band.position.set(hc[0], baseY + bandH / 2, hc[2]);
    const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector2(1 + 0.17 * Math.sin(t * Math.PI / 2), t * 0.052)); }
    const crown = new THREE.Mesh(new THREE.LatheGeometry(pts, 64), navy); crown.scale.set(rx, 1, rz * 1.04); crown.position.set(hc[0], baseY + bandH - 0.002, hc[2] + 0.012);
    const top = new THREE.Mesh(new THREE.CircleGeometry(1, 64), navy); top.rotation.x = -Math.PI / 2; top.scale.set(rx * 1.17, rz * 1.21, 1); top.position.set(hc[0], baseY + bandH + 0.05, hc[2] + 0.012);
    const vp = [], vi = [];
    for (let i = 0; i <= 40; i++) { const a = -Math.PI * 0.42 + i / 40 * Math.PI * 0.84; for (let j = 0; j <= 6; j++) { const r = 1 + j / 6 * 0.5; vp.push(Math.sin(a) * rx * (1 - 0.06 * j / 6), baseY + 0.002 - 0.03 * Math.pow(j / 6, 2), Math.cos(a) * rz * r); } }
    for (let i = 0; i < 40; i++) for (let j = 0; j < 6; j++) { const a = i * 7 + j, b = a + 7; vi.push(a, b, a + 1, a + 1, b, b + 1); }
    const vg = new THREE.BufferGeometry(); vg.setAttribute('position', new THREE.Float32BufferAttribute(vp, 3)); vg.setIndex(vi); vg.computeVertexNormals();
    const visor = new THREE.Mesh(vg, new THREE.MeshPhysicalMaterial({ color: '#0d0e11', roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05, side: THREE.DoubleSide })); visor.position.set(hc[0], 0, hc[2]);
    const cord = new THREE.Mesh(new THREE.TorusGeometry(1, 0.0028, 8, 64, Math.PI * 0.75), gm); cord.rotation.set(Math.PI / 2, 0, Math.PI * 0.125); cord.scale.set(rx * 1.01, rz * 1.01, 1); cord.position.set(hc[0], baseY + 0.014, hc[2]);
    g.add(band, crown, top, visor, cord);
    if (kind === 'captain') for (let i = -6; i <= 6; i++) { const a = i / 6 * Math.PI * 0.32, leaf = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), gm); leaf.scale.set(0.009, 0.0018, 0.0035); leaf.position.set(hc[0] + Math.sin(a) * rx, baseY - 0.012 + 0.006 * Math.abs(i / 6), hc[2] + Math.cos(a) * rz * 1.38); leaf.rotation.y = a + (i % 2 ? 0.5 : -0.5); g.add(leaf); }
    const b = badge(accent, kind === 'fa' ? 0.75 : 0.95); b.position.set(hc[0], baseY + bandH + 0.014, hc[2] + rz * 1.14 + 0.006); b.rotation.x = -0.22; g.add(b);
    const piv = new THREE.Group(); piv.position.set(hc[0], hc[1], hc[2]); g.position.set(-hc[0], -hc[1], -hc[2]); piv.add(g); piv.rotation.x = -0.05;
    return piv;
  }

  /** Shoes shaped on a last: heel, vamp and toe from cross-sections along the foot, with a separate sole. */
  function shoes(b, I, color, kind, accent) {
    const g = new THREE.Group(), P = b.pos, top = I.ankleY + 0.02;
    const leather = new THREE.MeshPhysicalMaterial({ color, roughness: kind === 'boots' ? 0.62 : 0.36, clearcoat: kind === 'boots' ? 0.15 : 0.55, clearcoatRoughness: 0.28, envMapIntensity: 0.6 });
    const upperMat = kind === 'sneakers' ? new THREE.MeshPhysicalMaterial({ color: '#F2F4F7', roughness: 0.7, sheen: 0.3 }) : leather;
    const soleMat = new THREE.MeshStandardMaterial({ color: kind === 'sneakers' ? '#E6E8EC' : kind === 'boots' ? '#2a211b' : '#16171a', roughness: 0.85 });
    const sm = (a, b2, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b2 - a))); return t * t * (3 - 2 * t); };
    const widthAt = t => kind === 'pumps' ? 0.7 + 0.25 * sm(0, 0.6, t) - 0.75 * sm(0.75, 1, t) : 0.72 + 0.28 * sm(0, 0.68, t) - 0.62 * sm(0.8, 1, t);
    const heightAt = (t, H) => kind === 'boots' ? H * (1 - 0.35 * sm(0.3, 0.55, t) - 0.38 * sm(0.55, 1, t)) : kind === 'pumps' ? H * (0.9 - 0.55 * sm(0.2, 1, t)) : H * (1 - 0.5 * sm(0.25, 0.85, t) - 0.25 * sm(0.85, 1, t));
    const outer = g; outer.userData.sides = {};
    for (const sd of [1, -1]) {
      // each shoe goes with its leg (pose() moves it with the hip and the knee)
      const g = new THREE.Group(); g.matrixAutoUpdate = false; outer.add(g); outer.userData.sides[sd] = g;
      const bb = new THREE.Box3();
      for (let i = 0; i < P.length / 3; i++) { const x = P[i * 3], y = P[i * 3 + 1]; if (y < top && Math.sign(x) === sd) bb.expandByPoint(new THREE.Vector3(x, y, P[i * 3 + 2])); }
      const c = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3());
      const Lz = sz.z + 0.034, W = sz.x + 0.016, z0 = c.z - Lz / 2 + 0.002, soleH = kind === 'sneakers' ? 0.022 : kind === 'boots' ? 0.018 : 0.012;
      const H = kind === 'boots' ? 0.17 : kind === 'pumps' ? 0.05 : 0.085, heelLift = kind === 'pumps' ? 0.035 : 0;
      const rings = 26, seg = 28, pos = [], idx = [];
      for (let r = 0; r <= rings; r++) {
        const t = r / rings, cap = Math.sin(Math.min(1, t / 0.08) * Math.PI / 2) * Math.sqrt(Math.max(0, Math.sin(Math.min(1, (1 - t) / 0.12) * Math.PI / 2)));
        const hw = W / 2 * widthAt(t) * cap, z = z0 + t * Lz, lift = heelLift * (1 - sm(0.45, 0.8, t)), y0 = soleH + lift, ht = heightAt(t, H) * (0.3 + 0.7 * cap);
        for (let k = 0; k <= seg; k++) {
          const a = k / seg * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
          const y = ca > 0 ? y0 + (ht - soleH) * Math.pow(ca, 0.75) : y0 + ca * 0.004;
          pos.push(c.x + hw * sa, y, z);
        }
      }
      for (let r = 0; r < rings; r++) for (let k = 0; k < seg; k++) { const a = r * (seg + 1) + k, b2 = a + seg + 1; idx.push(a, b2, a + 1, a + 1, b2, b2 + 1); }
      const ug = new THREE.BufferGeometry(); ug.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); ug.setIndex(idx); ug.computeVertexNormals();
      g.add(new THREE.Mesh(ug, upperMat));
      // sole: the footprint, extruded
      const fp = new THREE.Shape(), N = 40, pts = [];
      for (let k = 0; k <= N; k++) { const t = k / N; pts.push([W / 2 * widthAt(t) * Math.max(0.35, Math.sin(Math.min(1, t / 0.08) * Math.PI / 2)) + 0.002, z0 + t * Lz]); }
      fp.moveTo(-pts[0][0], pts[0][1]); for (const [x, z] of pts) fp.lineTo(x, z); for (let k = pts.length - 1; k >= 0; k--) fp.lineTo(-pts[k][0], pts[k][1]);
      const sg = new THREE.ExtrudeGeometry(fp, { depth: soleH, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.0015, bevelSegments: 2, steps: 1 });
      sg.rotateX(Math.PI / 2); sg.translate(c.x, soleH, 0);
      if (kind === 'pumps') { const sp = sg.attributes.position; for (let i = 0; i < sp.count; i++) { const z = sp.getZ(i), t = (z - z0) / Lz; sp.setY(i, sp.getY(i) + heelLift * (1 - sm(0.45, 0.8, t))); } sg.computeVertexNormals(); }
      g.add(new THREE.Mesh(sg, soleMat));
      if (kind === 'pumps') { const hl = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.006, heelLift + soleH, 14), soleMat); hl.position.set(c.x, (heelLift + soleH) / 2, z0 + Lz * 0.08); g.add(hl); }
      if (kind === 'oxford') for (let i = 0; i < 4; i++) {
        const t = 0.42 + i * 0.07, y = heightAt(t, H) + 0.001, lace = new THREE.Mesh(new THREE.BoxGeometry(W * 0.32, 0.0018, 0.0025), new THREE.MeshStandardMaterial({ color: '#0c0c0e', roughness: 0.6 }));
        lace.position.set(c.x, y, z0 + t * Lz); lace.rotation.x = -0.35; g.add(lace);
      }
      if (kind === 'sneakers') { const st = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.005, 6, 24, Math.PI * 0.8), new THREE.MeshStandardMaterial({ color: accent, roughness: 0.5 })); st.position.set(c.x + sd * (W / 2 + 0.001), 0.04, c.z); st.rotation.set(0, sd * Math.PI / 2, Math.PI * 1.1); st.scale.set(1.6, 0.7, 1); g.add(st); }
    }
    return g;
  }

  function cloth(color) {
    const m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.82, sheen: 0.4, sheenRoughness: 0.6, sheenColor: new THREE.Color(color).offsetHSL(0, 0, 0.25) });
    m.onBeforeCompile = sh => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vON2;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(position, 1.0)).xyz; vON2 = objectNormal;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vON2;\n' + GLSL_NOISE)
        .replace('#include <color_fragment>', `#include <color_fragment>
          float lodC = 1.0 - smoothstep(0.3, 0.8, length(fwidth(vWP * 420.0)));
          diffuseColor.rgb *= 0.95 + 0.1 * mix(0.5, fbm(vWP * 420.0), lodC);`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          { float fade = 1.0 - smoothstep(0.35, 0.9, length(fwidth(vWP * 1150.0)));
            float hgt = TRI(twill, vWP, normalize(vON2)) * 0.00005 * fade + (vnoise(vWP * 30.0) - 0.5) * 0.0012;
            vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition); vec2 dh = vec2(dFdx(hgt), dFdy(hgt));
            vec3 r1 = cross(sy, normal), r2 = cross(normal, sx); float det = dot(sx, r1) * faceDirection;
            normal = normalize(abs(det) * normal - sign(det) * (dh.x * r1 + dh.y * r2)); }`);
    };
    m.customProgramCacheKey = () => 'crew-cloth';
    return m;
  }

  function surfaceZ(mesh, x, y) { const rc = new THREE.Raycaster(new THREE.Vector3(x, y, 2), new THREE.Vector3(0, 0, -1)); const h = rc.intersectObject(mesh)[0]; return h ? h.point.z : 0; }

  /* ================= look → outfit ================= */
  function outfit(L, role, accent, I) {
    const f = L.sex === 'f', pilot = role === 'captain' || role === 'fo', mech = ((role === 'mech' || role === 'ground') && !(L as any).sec) || L.top === 'overalls';   // security officers wear their own uniform
    const skin = SKIN_3D[L.skin] || SKIN_3D[2], hair = HAIR_COLORS[L.hairColor] || HAIR_COLORS[1], uni = UNIFORM_COLORS[L.uniform] || UNIFORM_COLORS[0];
    const dark = L.skin > 5;
    const lip = '#' + new THREE.Color(shade(skin, dark ? -0.34 : -0.14)).lerp(new THREE.Color(dark ? '#4a2220' : '#c4645c'), dark ? 0.35 : 0.55).getHexString();
    const iris = L.skin >= 5 ? '#6b4428' : ['#6a4a2c', '#5d86a8', '#5f7a48', '#7a5634', '#4f6f8f'][(L.skin + (L.hairColor || 0)) % 5];
    const mouth = [0, (I.mouthJ[0][2][1] + I.mouthJ[2][2][1]) / 2, Math.max(I.mouthJ[0][2][2], I.mouthJ[2][2][2])];
    const white = '#F2F4F7', blouseCol = shade(accent, 0.62);
    const c: any = {
      seed: seedOf(JSON.stringify(L) + role), female: f, mech, accent, skin, hair, lip, iris, mouth, brow: shade(hair, -0.15), grey: L.hairColor >= 8 ? 0.35 : 0,
      eyeR: 0.0118 * I.eyeScale, hairline: f ? 0.22 : 0.26, sheen: dark ? '#c27a5e' : '#ff9f86',
      top: uni, sleeve: uni, bottom: shade(uni, -0.22), shirt: white, tie: '#121318', shoe: L.shoes === 'boots' ? '#4a3324' : '#14161a',
      hemY: I.crotchY + 0.015, waistY: I.hipY + 0.1, cuffS: I.armLen - 0.012, shoeY: I.ankleY + 0.035, botLow: I.ankleY + 0.035,
      vBot: I.neckY - 0.25, vW: 0.06, tieBot: I.neckY - 0.23, stripes: 0, lapels: true, pockets: false, topFab: 1, sleeveFab: 1,
      topT: 0.006, botT: 0.005, fit: f ? 0.55 : 0.6, legX: Math.abs(I.J['upperleg01.L'][0]) + 0.005, hivis: false, skirt: false,
      wings: (L as any).civil ? 0 : pilot ? 1 : role === 'fa' ? 0.7 : 0,   // passengers wear no crew wings buttons: false, epaulettes: false, scarf: false, bald: L.hair === 'bald',
    };
    if (L.shoes === 'boots') c.shoeY = c.botLow = I.ankleY + 0.06;
    if (L.shoes === 'pumps') c.shoeY = c.botLow = I.ankleY + 0.02;
    if (mech) {
      Object.assign(c, { top: '#55657A', sleeve: '#55657A', bottom: '#55657A', hemY: I.crotchY - 0.05, vW: 0, tieBot: 0, lapels: false, topT: 0.007, botT: 0.007, hivis: true, wings: 0 });
    } else {
      switch (L.top) {
        case 'jacket': Object.assign(c, { pockets: !f || L.bottom !== 'skirt', buttons: true, stripes: role === 'captain' ? 4 : role === 'fo' ? 3 : 0 }); if (f) { c.vBot = I.neckY - 0.2; c.vW = 0.05; } break;
        case 'shirt': Object.assign(c, { top: white, sleeve: white, shirt: white, cuffS: I.armLen * 0.36, lapels: false, topFab: 2, sleeveFab: 2, vBot: I.hipY, vW: 0.03, tie: uni, epaulettes: pilot, hemY: I.hipY + 0.005, topT: 0.004 }); break;
        case 'pullover': Object.assign(c, { topFab: 8, sleeveFab: 8, lapels: false, vBot: I.neckY - 0.17, vW: 0.05, tieBot: I.neckY - 0.16, epaulettes: pilot, hemY: I.crotchY + 0.03, topT: 0.008 }); break;
        case 'vest': Object.assign(c, { sleeve: white, sleeveFab: 2, lapels: false, vBot: I.neckY - 0.2, vW: 0.05, buttons: true, hemY: I.crotchY + 0.04 }); break;
        case 'blouse': Object.assign(c, { top: blouseCol, sleeve: blouseCol, shirt: blouseCol, topFab: 2, sleeveFab: 2, lapels: false, vBot: I.neckY - 0.12, vW: 0.035, hemY: I.hipY + 0.005, topT: 0.004 }); break;
      }
      if (f && L.top === 'jacket' && L.bottom === 'skirt') c.hemY = I.hipY;
      if (L.neck !== 'tie') c.tieBot = 0;
      if (L.neck === 'scarf') c.scarf = true;
      if (L.bottom === 'skirt') { c.skirt = true; c.skirtCol = uni; }
      if (L.bottom === 'shorts') { c.botLow = I.kneeY + 0.07; c.bottom = shade(uni, -0.22); }
    }
    if (L.hair === 'buzz') { c.hairT = 0.0018; c.hairPaint = hair; c.hairline = f ? 0.24 : 0.28; }
    else if (L.hair === 'bald') { c.hairT = 0; c.hairPaint = hair; }
    else { c.hairT = 0.0005; c.hairPaint = shade(hair, -0.4); }
    return c;
  }

  /* ================= the figure ================= */
  const BEARDS = { stubble: 1, short: 1, full: 1, goatee: 1, vandyke: 1, beard: 1 };
  const MOUSTACHES = { pencil: 1, chevron: 1, walrus: 1, handlebar: 1, horseshoe: 1, moustache: 1 };

  /** Build a figure. q: detail (1 = full, about 0.3 for small pictures). */
  const T = {};
  const tick = (k, t0) => { T[k] = (T[k] || 0) + performance.now() - t0; return performance.now(); };
  function build(look, role, accent, style, q) {
    let t0 = performance.now();
    const L = dressed(look, role), b = makeBody(L, style), I = b.info, c = outfit(L, role, accent, I);
    t0 = tick('body', t0);
    const root = new THREE.Group();
    try { faceSculpt(b, I, outfitSkin(L, c)); } catch (e) { /* the face as it was */ }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
    geo.setAttribute('rest', new THREE.Float32BufferAttribute(b.rest, 3));
    geo.setAttribute('fa', new THREE.Float32BufferAttribute(b.A, 4));
    geo.setAttribute('fb', new THREE.Float32BufferAttribute(b.B, 4));
    geo.setIndex(b.idx); geo.computeVertexNormals();
    clothe(geo, b, c, I);
    t0 = tick('clothe', t0);
    geo.setAttribute('beardW', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count), 1));
    const mat = bodyMaterial(c, I);
    { let zs = 0, zn = 0; const P = geo.attributes.position; for (let i = 0; i < P.count; i++) if (Math.abs(P.getY(i) - (I.neckY - 0.2)) < 0.01 && b.A[i * 4 + 1] < 0.5) { zs += P.getZ(i); zn++; } mat.userData.U.uSideZ.value = zn ? zs / zn : 0; }
    const body = new THREE.Mesh(geo, mat); body.castShadow = body.receiveShadow = true; root.add(body);
    try { faceFit(mat.userData.U, b, I, c); } catch (e) { /* the drawn face */ }
    // everything on the head turns with it
    const np = I.neckPivot, headPivot = new THREE.Group(), head = new THREE.Group();
    headPivot.position.set(np[0], np[1], np[2]); head.position.set(-np[0], -np[1], -np[2]); headPivot.add(head); root.add(headPivot);
    const eyes = [eye(I.eyeL, c.eyeR, c.iris), eye(I.eyeR, c.eyeR, c.iris)]; eyes.forEach(e => head.add(e));
    const sec = !!(L as any).sec;   // a security officer: their own hats, epaulettes on the uniform shirt, and the print
    if (sec && L.top === 'shirt') c.epaulettes = true;
    const hatKind = L.hat === 'none' ? null : sec ? (L.hat === 'ball' ? 'mech' : L.hat === 'beret' ? 'beret' : 'fo') : (role === 'mech' || role === 'ground') ? 'mech' : L.hat === 'pillbox' ? 'pillbox' : role === 'captain' ? 'captain' : role === 'fa' ? 'fa' : 'fo';
    const strandHair = ['bald', 'buzz'].indexOf(L.hair) < 0;
    t0 = tick('material', t0);
    const hm = hairMode(); if (strandHair && hm !== 'flat') head.add(buildHair(L.hair, geo, b, I, c, q, hatKind && hatKind !== 'pillbox' ? I.headC[1] - 0.006 : 0, hm === 'cards'));
    t0 = tick('hair', t0);
    const facial = L.facial === 'beard' ? 'short' : L.facial === 'moustache' ? 'chevron' : L.facial;
    if (BEARDS[facial]) head.add(buildBeard(facial, geo, b, I, c, c.mouth, q));
    if (MOUSTACHES[facial]) head.add(buildMoustache(facial, geo, b, I, c, c.mouth, q));
    if (facial === 'vandyke') head.add(buildMoustache('chevron', geo, b, I, c, c.mouth, q));
    t0 = tick('facial', t0);
    if (L.glasses && L.glasses !== 'none') head.add(glasses(L.glasses, I, c.eyeR));
    if (hatKind) head.add(hat(hatKind, I, c.mech ? '#3d4a5c' : (UNIFORM_COLORS[L.uniform] || UNIFORM_COLORS[0]), accent));
    const shoeG = shoes(b, I, c.shoe, L.shoes, accent); root.add(shoeG);
    const chestG = new THREE.Group(); chestG.matrixAutoUpdate = false; root.add(chestG);   // badges, buttons, epaulettes, the scarf: they go with the chest
    const gm = gold();
    if (sec) {   // the airline's name with SECURITY GUARD under it: small on the chest, large across the back
      try { const pol = !!(L as any).police, nm = pol ? 'POLICE' : (typeof company === 'function' && company() && company().name) || 'Airline';
        const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256; const k = cv.getContext('2d') as CanvasRenderingContext2D;
        k.fillStyle = '#ECEFF3'; k.textAlign = 'center'; let fs = 64; k.font = `700 ${fs}px Inter, Arial, sans-serif`; while (k.measureText(nm).width > 480 && fs > 26) { fs -= 4; k.font = `700 ${fs}px Inter, Arial, sans-serif`; }
        if (pol) { k.fillStyle = '#F4F6F8'; k.font = '900 120px Inter, Arial, sans-serif'; k.fillText('POLICE', 256, 170); } else { k.fillText(nm, 256, 96); k.fillStyle = '#F2C230'; k.font = '800 58px Inter, Arial, sans-serif'; k.fillText('SECURITY GUARD', 256, 190); }
        const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; const mt = new THREE.MeshBasicMaterial({ map: tx, transparent: true, depthWrite: false });
        const yf = I.neckY - 0.17, zf = surfaceZ(body, -0.085, yf); const front = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.06), mt); front.position.set(-0.085, yf, zf + 0.004); front.rotation.y = -0.25; chestG.add(front);
        const yb = I.neckY - 0.22, rc = new THREE.Raycaster(new THREE.Vector3(0, yb, -2), new THREE.Vector3(0, 0, 1)), hb = rc.intersectObject(body)[0], zb = hb ? hb.point.z : -0.12;
        const back = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.15), mt); back.position.set(0, yb, zb - 0.005); back.rotation.y = Math.PI; chestG.add(back);
      } catch (e) { /* no print */ } }
    if (c.wings) { const y = I.neckY - 0.16, z = surfaceZ(body, 0.085, y); const w = badge(accent, c.wings); w.position.set(0.085, y, z + 0.004); w.rotation.y = 0.3; chestG.add(w); }
    if (c.buttons) for (const y of [c.vBot - 0.03, c.vBot - 0.13]) { const z = surfaceZ(body, 0.012, y); const bt = new THREE.Mesh(new THREE.CylinderGeometry(0.0065, 0.0065, 0.004, 20), gm); bt.rotation.x = Math.PI / 2; bt.position.set(0.012, y, z + 0.002); chestG.add(bt); }
    if (c.epaulettes) {
      const n = role === 'captain' ? 4 : role === 'fo' ? 3 : 1;
      for (const sd of [1, -1]) {
        const jx = I.J['upperarm01.L'][0] * sd, x = jx * 0.72; let topY = 0, zc = 0;
        const P = geo.attributes.position; for (let i = 0; i < P.count; i++) { if (b.A[i * 4 + 1] > 0.5 || b.A[i * 4 + 3] > 0.3) continue; if (Math.abs(P.getX(i) - x) < 0.012 && Math.abs(P.getZ(i)) < 0.06 && P.getY(i) > topY) { topY = P.getY(i); zc = P.getZ(i); } }
        const ep = new THREE.Group();
        ep.add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.006, 0.046), new THREE.MeshStandardMaterial({ color: shade(UNIFORM_COLORS[L.uniform] || UNIFORM_COLORS[0], -0.3), roughness: 0.8 })));
        for (let i = 0; i < n; i++) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.0045, 0.0075, 0.047), gm); st.position.x = sd * (0.03 - i * 0.0095); ep.add(st); }
        const btn = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 10, 8), gm); btn.position.set(-sd * 0.032, 0.004, 0); ep.add(btn);
        ep.position.set(x, topY + 0.004, zc); ep.rotation.z = -sd * 0.28; chestG.add(ep);
      }
    }
    if (c.scarf) {
      const m = cloth(accent);
      const sc = new THREE.Mesh(new THREE.TorusGeometry(0.064, 0.009, 12, 48), m); sc.rotation.x = Math.PI / 2 - 0.35; sc.scale.set(1, 0.95, 1); sc.position.set(0, I.neckY + 0.008, 0.018); chestG.add(sc);
      const kz = surfaceZ(body, 0.028, I.neckY - 0.012) + 0.012;
      const k = new THREE.Mesh(new THREE.SphereGeometry(0.011, 16, 12), m); k.scale.set(1.1, 0.9, 0.7); k.position.set(0.028, I.neckY - 0.008, kz); chestG.add(k);
      for (const [dx, ang, len] of [[0.042, -0.6, 0.06], [0.03, -0.2, 0.05]]) { const t = new THREE.Mesh(new THREE.ConeGeometry(0.016, len, 3, 1), m); t.scale.z = 0.25; t.position.set(dx, I.neckY - 0.012 - len / 2, kz - 0.002); t.rotation.set(0, 0, Math.PI + ang); chestG.add(t); }
    }
    if (c.skirt) {
      // sized from the dressed body (not the bare one), with room to spare, so nothing pokes through
      const P = geo.attributes.position.array, A = b.A, top = c.hemY + 0.012, bot = I.kneeY + 0.04, rings = []; let prevX = 0, prevZ = 0;
      for (let k = 0; k <= 14; k++) {
        const y = top - (top - bot) * k / 14; let mx = 0, z0 = 9, z1 = -9;
        for (let i = 0; i < P.length / 3; i++) { if (A[i * 4 + 1] > 0.3) continue; if (Math.abs(P[i * 3 + 1] - y) > 0.012) continue; mx = Math.max(mx, Math.abs(P[i * 3])); z0 = Math.min(z0, P[i * 3 + 2]); z1 = Math.max(z1, P[i * 3 + 2]); }
        const rx = Math.max(prevX, mx + 0.012 + 0.024 * k / 14), rz = Math.max(prevZ, (z1 - z0) / 2 + 0.012 + 0.018 * k / 14); prevX = rx; prevZ = rz;
        rings.push([y, rx, rz, (z0 + z1) / 2]);
      }
      const pos = [], idx = [], S = 64;
      rings.forEach(([y, rx, rz, cz], k) => { const fold = 0.035 * (k / 14); for (let j = 0; j <= S; j++) { const a = j / S * Math.PI * 2, ff = 1 + fold * Math.sin(a * 10) * (0.6 + 0.4 * Math.sin(a * 3 + 1)); pos.push(Math.sin(a) * rx * ff, y, cz + Math.cos(a) * rz * ff); } });
      for (let r = 0; r < rings.length - 1; r++) for (let j = 0; j < S; j++) { const a = r * (S + 1) + j, cc = a + S + 1; idx.push(a, a + 1, cc, a + 1, cc + 1, cc); }
      const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); sg.setIndex(idx); sg.computeVertexNormals();
      const sk = new THREE.Mesh(sg, cloth(c.skirtCol)); sk.material.side = THREE.DoubleSide; sk.material.shadowSide = THREE.BackSide; root.add(sk);
    }
    root.traverse(o => { if (o.isMesh && !(o.material && o.material.isShaderMaterial)) { o.castShadow = true; o.receiveShadow = true; } });
    tick('props', t0);
    const box = new THREE.Box3().setFromObject(root);
    const U = mat.userData.U, rot = new THREE.Quaternion(), eul = new THREE.Euler(), m4 = new THREE.Matrix4();
    // the arms' joints at rest (for reaching: humanReach)
    const jv = (k) => new THREE.Vector3(I.J[k][0], I.J[k][1], I.J[k][2]);
    const joints: any = {};
    for (const sd of ['L', 'R']) { const sh = jv('upperarm01.' + sd), wr = jv('wrist.' + sd), el = sh.clone().lerp(wr, 0.56 / 0.97); joints[sd] = { s: sh, e: el, w: wr, palm: wr.clone().add(wr.clone().sub(el).normalize().multiplyScalar(0.075)) }; }
    // the hands at rest: which way the fingers point (F), the palm faces (N, towards the body) and the thumb (T);
    // the knuckles and the middle joints, as distances along the arm (the same measure the shader bends by)
    {
      const PA = geo.attributes.position.array, FA = b.A, n = PA.length / 3; let top = 0;
      for (let i = 0; i < n; i++) if (FA[i * 4 + 1] > 0.5) top = Math.max(top, FA[i * 4]);
      const hl = Math.max(0.12, top - I.armLen); U.uHandK.value.set(I.armLen, I.armLen + 0.53 * hl, I.armLen + 0.76 * hl);
      for (const sd of ['L', 'R']) {
        const J = joints[sd], c = new THREE.Vector3(); let k = 0;
        for (let i = 0; i < n; i++) if (FA[i * 4 + 1] > 0.5 && FA[i * 4] > top - 0.1 * hl && (PA[i * 3] > 0) === (sd === 'L')) { c.x += PA[i * 3]; c.y += PA[i * 3 + 1]; c.z += PA[i * 3 + 2]; k++; }
        const F = k ? c.multiplyScalar(1 / k).sub(J.w).normalize() : new THREE.Vector3(0, -1, 0);
        const Tt = new THREE.Vector3(0, 0, 1); Tt.sub(F.clone().multiplyScalar(Tt.dot(F))).normalize();
        const N = sd === 'R' ? Tt.clone().cross(F) : F.clone().cross(Tt);
        J.F = F; J.N = N.normalize(); J.T = Tt; J.ax = F.clone().cross(J.N).normalize(); J.hl = hl;
        U['uFg' + sd].value.copy(F); U['uPn' + sd].value.copy(J.N);
      }
    }
    return {
      root, joints, headPivot, body, U, top: box.max.y, width: Math.max(box.max.x - box.min.x, 0.5), bustBottom: I.neckY - 0.3, headY: I.headC[1],
      /** Breathing, a gentle sway, head and eye movement, blinking. */
      pose(p) {
        const t = p.t;
        // body language at rest (sway, breathing, the head's small movements): none on Low, half on Medium
        const BL = animLevel('animBody'), bk = [0, 0.5, 1, 1.15][BL];
        root.rotation.y = p.yaw; root.rotation.z = Math.sin(t * 2 * Math.PI / 6.2) * 0.008 * bk; root.rotation.x = 0; root.position.y = 0;
        root.scale.y = 1 + Math.sin(t * 2 * Math.PI / 4.2) * 0.0015 * bk;
        // body language: the arms (a little life even at rest), the lean, the head
        const g = p.g || humanGesture(p.mood, t);   // a gesture worked out by the caller (blended between moves), or from the mood
        const arm = (a, sd) => { const m = new THREE.Matrix4().makeRotationY(sd * -a[2]).multiply(new THREE.Matrix4().makeRotationZ(sd * a[1])).multiply(new THREE.Matrix4().makeRotationX(-a[0])); return new THREE.Matrix3().setFromMatrix4(m); };
        const elb = (b) => new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationX(-b));
        U.uArmL.value.copy(arm(g.L, 1)); U.uArmR.value.copy(arm(g.R, -1)); U.uElbL.value.copy(elb(g.L[3])); U.uElbR.value.copy(elb(g.R[3])); U.uFlush.value = g.flush;
        // the hands: g.hand = { L/R: { W: the wrist's turn (Matrix3, at rest), curl: 0 open … 1 closed round something } }
        for (const sd of ['L', 'R']) {
          const h = g.hand && g.hand[sd], cu = h ? Math.max(0, Math.min(1.2, h.curl || 0)) : 0;
          if (h && h.W) U['uWr' + sd].value.copy(h.W); else U['uWr' + sd].value.identity();
          U['uCurl' + sd].value = cu;
          if (cu > 0) { const ax = joints[sd].ax; U['uC1' + sd].value.setFromMatrix4(m4.makeRotationAxis(ax, cu * (h.k1 || 1.15))); U['uC2' + sd].value.setFromMatrix4(m4.makeRotationAxis(ax, cu * (h.k2 || 1.25)));
            U['uTh' + sd].value.setFromMatrix4(m4.makeRotationAxis(joints[sd].T, (sd === 'R' ? 1 : -1) * (h.th || 0))); }
        }
        const lg = g.legs || [0, 0, 0, 0], rx = (a) => new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationX(a));
        U.uLegL.value.copy(rx(lg[0])); U.uKneeL.value.copy(rx(lg[1])); U.uLegR.value.copy(rx(lg[2])); U.uKneeR.value.copy(rx(lg[3]));
        const an = g.ank || [0, 0]; U.uAnkL.value.copy(rx(an[0])); U.uAnkR.value.copy(rx(an[1]));
        // the shoes with the feet: turned at the ankle, then the knee, then the hip, as the legs are
        for (const sd of [1, -1]) {
          const sg = shoeG.userData.sides && shoeG.userData.sides[sd]; if (!sg) continue;
          const hp = (sd > 0 ? U.uHipL : U.uHipR).value, kp = new THREE.Vector3(hp.x, U.uKneeY.value, hp.z), ap = (sd > 0 ? U.uAnkPL : U.uAnkPR).value, a = sd > 0 ? lg[0] : lg[2], k = sd > 0 ? lg[1] : lg[3], f = sd > 0 ? an[0] : an[1];
          sg.matrix.makeTranslation(hp.x, hp.y, hp.z).multiply(m4.makeRotationX(a)).multiply(new THREE.Matrix4().makeTranslation(kp.x - hp.x, kp.y - hp.y, kp.z - hp.z))
            .multiply(new THREE.Matrix4().makeRotationX(k)).multiply(new THREE.Matrix4().makeTranslation(ap.x - kp.x, ap.y - kp.y, ap.z - kp.z))
            .multiply(new THREE.Matrix4().makeRotationX(f)).multiply(new THREE.Matrix4().makeTranslation(-ap.x, -ap.y, -ap.z));
          sg.matrixWorldNeedsUpdate = true;
        }
        // the spine: bend forward, twist, lean to the side, from the waist
        const spn = g.spine || [0, 0, 0], sq = new THREE.Quaternion().setFromEuler(new THREE.Euler(spn[0], spn[1], spn[2], 'YXZ')), sp0 = U.uSpineP.value;
        U.uSpine.value.setFromMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(sq));
        chestG.matrix.makeTranslation(sp0.x, sp0.y, sp0.z).multiply(new THREE.Matrix4().makeRotationFromQuaternion(sq)).multiply(new THREE.Matrix4().makeTranslation(-sp0.x, -sp0.y, -sp0.z)); chestG.matrixWorldNeedsUpdate = true;
        root.rotation.x = g.lean; root.position.y = g.bob; root.rotation.z += g.roll; root.rotation.y += g.pelvis || 0;
        eul.set(Math.sin(t * 0.31 + 1) * 0.035 * bk - 0.01 + g.nod, (Math.sin(t * 0.43) * 0.13 * g.calm + Math.sin(t * 0.17) * 0.06 * g.calm) * bk + p.gaze[0] * 0.25 + g.shake, Math.sin(t * 0.23 + 2) * 0.02 * bk + g.tilt);
        headPivot.quaternion.setFromEuler(eul); rot.copy(headPivot.quaternion);
        U.uHeadRot.value.setFromMatrix4(m4.makeRotationFromQuaternion(rot));
        // the head (eyes, hair, glasses, cap) rides on the spine too
        { const np0 = new THREE.Vector3(I.neckPivot[0], I.neckPivot[1], I.neckPivot[2]); headPivot.position.copy(np0.sub(sp0).applyQuaternion(sq).add(sp0)); headPivot.quaternion.premultiply(sq); }
        // seen from your own eyes: the head (and all on it) folds away into the neck, so the view isn't inside it
        if (p.noHead) { U.uHeadRot.value.multiplyScalar(0.001); headPivot.scale.setScalar(0.001); } else headPivot.scale.setScalar(1);
        U.uBlink.value = p.blink;
        // speaking: Low still, Medium the jaw, High the jaw and the lips with the dark of the mouth, Ultra also the teeth and the tongue
        const sp = p.talk, SL = animLevel('animSpeak'), op0 = typeof sp === 'number' ? sp : sp ? sp.open : 0, op = isFinite(op0) ? op0 : 0;   // never a broken number into the face
        U.uJaw.value = SL ? op * (SL === 1 ? 0.8 : 1) : 0; U.uLipR.value = SL >= 2 && sp && typeof sp === 'object' && isFinite(sp.round) ? sp.round : 0;
        const shp = (k: string) => SL >= 2 && sp && typeof sp === 'object' && isFinite(sp[k]) ? sp[k] : 0; U.uPress.value = shp('press'); U.uLipLow.value = shp('low'); U.uLipUp.value = shp('up'); U.uMouthIn.value = SL >= 3 ? 2 : SL === 2 ? 1 : 0;
        for (const e of eyes) e.rotation.set(-p.gaze[1] * 0.25, p.gaze[0] * 0.3, 0);
      },
    };
  }

  function outfitSkin(L, c) { return c; }
  /** The face shaped to the photograph it wears: the nose and the mouth as wide as in the photograph (against the
   *  eyes), so its nostrils and lips sit on the nose and lips; the head space moves with them, so the picture stays
   *  where the photograph has it. */
  function faceSculpt(b, I, c) {
    if (!FACES || !FACES.length || (window as any).__noFaceTex) return;
    const sk = new THREE.Color(c.skin), lum = 0.3 * sk.r + 0.59 * sk.g + 0.11 * sk.b, F = FACE_SET[lum < 0.12 && FACES[1] ? 1 : 0];
    const P = b.pos, R = b.rest, A = b.A, B = b.B, n = R.length / 3, E = I.eyeL, M = c.mouth; if (!M) return;
    // this nose: its tip, and how wide its wings are at the nostrils
    let tip = -1, tz = -1e9;
    for (let i = 0; i < n; i++) { if (A[i * 4 + 3] < 0.5) continue; const x = R[i * 3], y = R[i * 3 + 1], z = R[i * 3 + 2]; if (Math.abs(x) < 0.004 && y < E[1] - 0.01 && y > M[1] + 0.008 && z > tz) { tz = z; tip = i; } }
    if (tip < 0) return;
    const ny = R[tip * 3 + 1] - 0.006; let nw = 0;
    for (let i = 0; i < n; i++) { if (A[i * 4 + 3] < 0.5) continue; const x = R[i * 3], y = R[i * 3 + 1], z = R[i * 3 + 2]; if (Math.abs(y - ny) < 0.006 && z > tz - 0.03 && Math.abs(x) < 0.03) nw = Math.max(nw, Math.abs(x)); }
    const eh = Math.abs(E[0]); if (!nw || !eh) return;
    const fn = clamp(F.noseW * eh / nw, 0.85, 1.55), fm = clamp(F.mouthW * eh / 0.024, 0.85, 1.4);
    for (let i = 0; i < n; i++) {
      if (A[i * 4 + 3] < 0.3) continue;
      const x = R[i * 3], y = R[i * 3 + 1], z = R[i * 3 + 2];
      const wn = Math.exp(-Math.pow((y - ny) / 0.018, 2)) * Math.exp(-Math.pow(x / (nw * 1.9), 2)) * clamp((z - (tz - 0.05)) / 0.025, 0, 1);
      const wm = Math.exp(-Math.pow((y - M[1]) / 0.014, 2)) * Math.exp(-Math.pow(x / 0.045, 2)) * clamp((z - (M[2] - 0.035)) / 0.02, 0, 1);
      const k = (1 + (fn - 1) * wn) * (1 + (fm - 1) * wm); if (Math.abs(k - 1) < 1e-4) continue;
      R[i * 3] = x * k; P[i * 3] = P[i * 3] * k; B[i * 4] = B[i * 4] * k;
    }
    c.mouthK = fm;
  }
  /** Line the face texture up with this head: where its eyes, nose, mouth, chin and ears are, in its own head space. */
  function faceFit(U, b, I, c) {
    if (!FACES || !FACES.length) return;
    const R = b.rest, A = b.A, B = b.B, n = R.length / 3, E = I.eyeL, M = c.mouth || I.mouth;
    let eI = -1, eD = 1e9, nI = -1, nZ = -1e9, cI = -1, cY = 1e9, mI = -1, mD = 1e9, earA = 0, earN = 0, ez0 = 1e9, ez1 = -1e9, ey0 = 1e9, ey1 = -1e9;
    for (let i = 0; i < n; i++) {
      if (A[i * 4 + 3] < 0.5) continue; const x = R[i * 3], y = R[i * 3 + 1], z = R[i * 3 + 2];
      const de = Math.hypot(x - E[0], y - E[1], z - (E[2] + 0.012)); if (de < eD) { eD = de; eI = i; }
      if (M) { const dm = Math.hypot(x - M[0], y - M[1], z - M[2]); if (dm < mD) { mD = dm; mI = i; } }
      if (Math.abs(x) < 0.004 && y < E[1] && (!M || y > M[1]) && z > nZ) { nZ = z; nI = i; }
      if (Math.abs(x) < 0.006 && (!M || z > M[2] - 0.03) && y < cY) { cY = y; cI = i; }
      if (B[i * 4] > 0.85 && B[i * 4 + 1] < 0.25 && B[i * 4 + 1] > -0.9) { earA += Math.atan2(B[i * 4], B[i * 4 + 2]); earN++; ez0 = Math.min(ez0, z); ez1 = Math.max(ez1, z); ey0 = Math.min(ey0, y); ey1 = Math.max(ey1, y); }
    }
    if (eI < 0 || nI < 0 || cI < 0 || mI < 0) return;
    const by = (i) => B[i * 4 + 1], eyeAz = Math.abs(Math.atan2(B[eI * 4], B[eI * 4 + 2])), earAz = earN ? earA / earN : 1.71;
    // the darker skin uses the darker photograph, the lighter the lighter one (each tinted to the exact skin)
    const sk = new THREE.Color(c.skin), lum = 0.3 * sk.r + 0.59 * sk.g + 0.11 * sk.b, F = FACE_SET[lum < 0.12 && FACES[1] ? 1 : 0], tex = FACES[lum < 0.12 && FACES[1] ? 1 : 0];
    U.tFace.value = tex; U.tDetail.value = DETAIL; U.uFaceAvg.value.set(F.avg[0], F.avg[1], F.avg[2]); U.uFaceC.value = F.c;
    U.uFaceU.value.set(Math.max(0.2, eyeAz), Math.max(eyeAz + 0.3, earAz), F.eye, F.ear);
    if (earN) U.uEarZY.value.set(ez0, ez1, ey0, ey1); U.uEarTex.value.set(F.earBox[0], F.earBox[1], F.earBox[2], F.earBox[3]);
    U.uFaceY.value.set(by(eI), by(nI), by(mI), by(cI)); U.uFaceV.value.set(F.eyeV, F.nose, F.mouth, F.chin); U.uFaceTop.value.set(0.22, F.top);
    U.uFaceOn.value = (window as any).__noFaceTex ? 0 : 1;
  }
  return { load, build, get ready() { return !!DATA; }, timings: T };
})();
// a base model from a file (www/models/people/, see models.ts) stands in for the app's own figure where there is one
{ const H: any = Human, own = H.build; H.build = function (look: any, ...rest: any[]) { const m = own.call(this, look, ...rest); try { modelsPeople(m, look); } catch (e) { /* the app's own figure */ } return m; }; }

/** Where the hand (the palm) is, in the figure's own space, for an arm pose [forward, out, turn, elbow]. */
function humanHandAt(m: any, sd: 'L' | 'R', a: number[], out?: any, pt?: any): any {
  const T = THREE, J = m.joints[sd], k = sd === 'L' ? 1 : -1;
  const M = new T.Matrix4().makeRotationY(k * -a[2]).multiply(new T.Matrix4().makeRotationZ(k * a[1])).multiply(new T.Matrix4().makeRotationX(-a[0]));
  const v = (pt || J.palm).clone().sub(J.e).applyMatrix4(new T.Matrix4().makeRotationX(-a[3])).add(J.e).sub(J.s).applyMatrix4(M).add(J.s);
  return out ? out.copy(v) : v;
}
/** The arm pose that puts the hand at a point (in the figure's own space): the elbow bends to the distance and
 *  points down and out (as a real elbow does), then the arm turns there, starting from the last pose so it moves
 *  smoothly. Out of reach, the arm stretches towards it. */
function humanReach(m: any, sd: 'L' | 'R', target: any, prev?: number[], pt?: any): number[] {
  const J = m.joints[sd], T = THREE, k = sd === 'L' ? 1 : -1, H = pt || J.palm;
  const l1 = J.e.distanceTo(J.s), l2 = H.distanceTo(J.e), full = H.distanceTo(J.s);
  const to = target.clone().sub(J.s), d = Math.max(0.05, Math.min(to.length(), full * 0.998)), u = to.clone().normalize();
  // the elbow: from the distance shoulder to hand
  const reachAt = (b: number) => H.clone().sub(J.e).applyMatrix4(new T.Matrix4().makeRotationX(-b)).add(J.e).distanceTo(J.s);
  let lo = 0, hi = 2.6; for (let i = 0; i < 22; i++) { const mid = (lo + hi) / 2; if (reachAt(mid) > d) lo = mid; else hi = mid; }
  const b = (lo + hi) / 2;
  // where the elbow goes: down and a little out from the line shoulder → hand
  const pole = new T.Vector3(k * 0.55, -1, -0.15), pp = pole.sub(u.clone().multiplyScalar(u.dot(pole))).normalize();
  const ca = Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))), al = Math.acos(ca);
  const elbow = J.s.clone().add(u.clone().multiplyScalar(l1 * Math.cos(al))).add(pp.multiplyScalar(l1 * Math.sin(al)));
  const handT = J.s.clone().add(u.clone().multiplyScalar(d));
  const elbowAt = (q: number[]) => { const M = new T.Matrix4().makeRotationY(k * -q[2]).multiply(new T.Matrix4().makeRotationZ(k * q[1])).multiply(new T.Matrix4().makeRotationX(-q[0])); return J.e.clone().sub(J.s).applyMatrix4(M).add(J.s); };
  const a = prev ? prev.slice() : [0.6, 0.15, 0.1, b]; a[3] = b;
  const cost = (q: number[]) => humanHandAt(m, sd, q, undefined, H).distanceToSquared(handT) + 0.5 * elbowAt(q).distanceToSquared(elbow);
  let c = cost(a), st = 0.3;
  for (let it = 0; it < 90 && st > 0.0006; it++) {
    let better = false;
    for (const i of [0, 1, 2]) for (const s of [st, -st]) { const q = a.slice(); q[i] += s; const cq = cost(q); if (cq < c) { a[i] = q[i]; c = cq; better = true; } }
    if (!better) st *= 0.5;
  }
  return a;
}

/** Where a hand's skin is (points in the figure's own space, a few hundred of them) for the arm pose a and the hand
 *  h ({ W, curl, th, k1, k2 }): the same bending the figure's shader does, so a held thing can be checked against
 *  it (nothing goes through the fingers). */
function humanHandPts(m: any, sd: 'L' | 'R', a: number[], h: any): any[] {
  const T = THREE, U = m.U, J = m.joints[sd], b = m.body; if (!U || !b) return [];
  const G = b.geometry, PA = G.attributes.position.array, FA = G.attributes.fa.array, RA = G.attributes.rest.array, lf = sd === 'L';
  if (!J.idx) { const L: number[] = [], n = PA.length / 3; for (let i = 0; i < n; i++) if (FA[i * 4 + 1] > 0.5 && (RA[i * 3] > 0) === lf && FA[i * 4] > U.uHandK.value.x - 0.03) L.push(i); const st = Math.max(1, Math.floor(L.length / 1600)); J.idx = L.filter((_, i) => i % st === 0); }
  const k = lf ? 1 : -1, M4 = (m4: any) => new T.Matrix3().setFromMatrix4(m4);
  const Arm = M4(new T.Matrix4().makeRotationY(k * -a[2]).multiply(new T.Matrix4().makeRotationZ(k * a[1])).multiply(new T.Matrix4().makeRotationX(-a[0]))), Elb = M4(new T.Matrix4().makeRotationX(-a[3]));
  const cu = h && h.curl || 0, W = h && h.W ? h.W : new T.Matrix3(), C1 = M4(new T.Matrix4().makeRotationAxis(J.ax, cu * (h && h.k1 || 1.15))), C2 = M4(new T.Matrix4().makeRotationAxis(J.ax, cu * (h && h.k2 || 1.25))), Th = M4(new T.Matrix4().makeRotationAxis(J.T, -k * (h && h.th || 0)));
  const K = U.uHandK.value, wp = J.w, fg = J.F, pn = J.N, sp = lf ? U.uShL.value : U.uShR.value, ep = lf ? U.uElL.value : U.uElR.value, eS = U.uElbowS.value, spP = U.uSpineP.value, Sp = U.uSpine.value;
  const ss = (e0: number, e1: number, x: number) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
  const mixRot = (p: any, c: any, R: any, w: number) => { if (w <= 0) return; const q = p.clone().sub(c).applyMatrix3(R).add(c); p.lerp(q, w); };
  const kl = K.y - K.x, pt = wp.clone().add(fg.clone().multiplyScalar(0.025)).add(pn.clone().multiplyScalar(0.018)), p1 = wp.clone().add(fg.clone().multiplyScalar(K.y - K.x)), p2 = wp.clone().add(fg.clone().multiplyScalar(K.z - K.x));
  const out: any[] = [];
  for (const i of J.idx) {
    const p = new T.Vector3(PA[i * 3], PA[i * 3 + 1], PA[i * 3 + 2]), f = FA[i * 4];
    if (cu > 0) {
      const dv = p.clone().sub(wp), df = dv.dot(fg), tw = ss(0.012, 0.03, dv.dot(pn)) * ss(kl + 0.022, kl + 0.006, df) * ss(0.004, 0.02, df) * (f >= K.x - 0.01 ? 1 : 0);
      mixRot(p, pt, Th, tw); mixRot(p, p2, C2, ss(K.z - 0.012, K.z + 0.012, f) * (1 - tw)); mixRot(p, p1, C1, ss(K.y - 0.012, K.y + 0.012, f) * (1 - tw));
    }
    mixRot(p, wp, W, ss(K.x - 0.012, K.x + 0.008, f));
    mixRot(p, ep, Elb, ss(eS - 0.03, eS + 0.03, f));
    mixRot(p, sp, Arm, ss(0, 0.06, f));
    mixRot(p, spP, Sp, ss(spP.y - 0.08, spP.y + 0.22, RA[i * 3 + 1]));
    out.push(p);
  }
  return out;
}

/** The wrist's turn that points a hand's fingers along Fd with its palm facing Nd (both in the figure's own
 *  space), for the arm pose a (from humanReach): for g.hand[sd].W. */
function humanHandAim(m: any, sd: 'L' | 'R', a: number[], Fd: any, Nd: any): any {
  const T = THREE, J = m.joints[sd], k = sd === 'L' ? 1 : -1;
  const M = new T.Matrix4().makeRotationY(k * -a[2]).multiply(new T.Matrix4().makeRotationZ(k * a[1])).multiply(new T.Matrix4().makeRotationX(-a[0])).multiply(new T.Matrix4().makeRotationX(-a[3]));
  const f = Fd.clone().normalize(), nn = Nd.clone().sub(f.clone().multiplyScalar(Nd.dot(f))).normalize();
  const sg = J.T.dot(J.F.clone().cross(J.N)) >= 0 ? 1 : -1, td = f.clone().cross(nn).multiplyScalar(sg);
  const B = new T.Matrix4().makeBasis(J.F, J.N, J.T), Bd = new T.Matrix4().makeBasis(f, nn, td);
  const Q = Bd.multiply(B.clone().transpose());
  const W = M.transpose().multiply(Q);
  return new T.Matrix3().setFromMatrix4(W);
}

/* ---------- you, seen from your own eyes ---------- */
// Your own figure (the same one the app's pictures use), with its head folded away: looking down you see your body,
// legs and feet, walking you see your feet step and your arms swing, and your arms reach for what you pick up.
// It hangs from the hips: hips → turn (yaw) → lean forward → the figure, so you lean and turn in the chair.
function selfBody(scene: any, look: any, accent: string): any {
  if (!Human.ready || !look) return null;
  const T = THREE, m = Human.build(look, 'exec', accent || '#2C8CFF', av3Style(), 0.85);
  m.root.traverse((o: any) => { o.frustumCulled = false; });
  const g = new T.Group(), yawG = new T.Group(), leanG = new T.Group(), off = new T.Group();
  const hipY = (m.top || 1.75) * 0.53;
  off.position.y = -hipY; off.add(m.root); leanG.add(off); yawG.add(leanG); g.add(yawG); scene.add(g);
  return { m, g, yawG, leanG, hipY, hh: m.headY - hipY, ef: 0.13, G: null, arms: null };
}
/** Where your eyes are, from the hips, turned and leant. */
function selfEyeOff(S: any, yaw: number, lean: number): any {
  return new THREE.Vector3(0, S.hh, S.ef).applyAxisAngle(new THREE.Vector3(1, 0, 0), lean).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
}
/** Place and pose yourself for this frame: the hips (in the room), facing (yaw: 0 faces +z), leaning forward,
 *  sitting (0…1), walking speed and distance; arms(m) may give the arm poses (reaching, holding). Returns the eyes. */
function selfPose(S: any, hip: any, yaw: number, lean: number, sit: number, v: number, dist: number, t: number, dt: number, arms?: (m: any) => { L?: number[]; R?: number[]; legs?: number[] } | null): any {
  const m = S.m;
  S.g.position.copy(hip); S.yawG.rotation.y = yaw; S.leanG.rotation.x = lean;
  let gT = cabinLerpG(humanGesture(null, t), humanGesture({ kind: 'walk', v: Math.max(0.6, v), seed: 'me' }, dist / 1.25), Math.min(1, v / 0.6));
  if (sit > 0) gT = cabinLerpG(gT, humanGesture({ kind: 'sit', v: 0 }, t), sit);
  S.G = S.G ? cabinLerpG(S.G, gT, Math.min(1, dt * 8)) : gT;
  const g = Object.assign({}, S.G); g.lean = 0; g.nod = 0; g.shake = 0; g.tilt = 0;
  // sitting and leaning in: the legs stay where they were
  if (g.legs && sit > 0) g.legs = [g.legs[0] + lean * sit, g.legs[1], g.legs[2] + lean * sit, g.legs[3]];
  if (arms) { m.root.rotation.set(0, 0, 0); m.root.position.set(0, 0, 0); S.g.updateMatrixWorld(true); const a: any = arms(m); if (a) { if (a.L) g.L = a.L; if (a.R) g.R = a.R; if (a.hand) g.hand = a.hand; if (a.legs) g.legs = a.legs; } }
  m.pose({ t, yaw: 0, gaze: [0, 0], blink: 0, g, noHead: true });
  // the head bows to look down (S.pitch, the view's): the eyes go forward and down a little, so you see your feet
  const eye = hip.clone().add(selfEyeOff(S, yaw, lean)), dn = Math.max(0, -(S.pitch || 0));
  if (dn > 0) eye.add(new THREE.Vector3(Math.sin(yaw) * 0.16 * Math.sin(dn), -0.07 * (1 - Math.cos(dn)), Math.cos(yaw) * 0.16 * Math.sin(dn)));
  return eye;
}

/** A walking step, as people really walk (t: distance walked / 1.25, so the feet stay planted as the body moves).
 *  Each leg: heel strike, the knee giving a little as the weight comes on, the push-off from the toes, the knee
 *  bending well up as the leg swings through, the toes lifting clear. The hips turn and tilt with each step and the
 *  weight shifts from side to side; the shoulders turn against the hips; the arms swing opposite the legs with the
 *  elbow bending more on the forward swing; the head stays steady. mood.seed gives each person their own walk
 *  (stride, arm swing, posture); mood.v their speed (1 normal). Low to Ultra (Animation > Walking) scales it. */
function humanWalk(t: number, mood: any): any {
  const L = animLevel('animWalk'), wk = [0.35, 0.75, 1, 1.08][L], sp = clamp(mood.v == null ? 1 : mood.v, 0.4, 1.6);
  let r1 = 0.5, r2 = 0.5, r3 = 0.5; if (mood.seed) { let h = 7; for (const ch of String(mood.seed)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; r1 = (h % 997) / 997; r2 = ((h >> 10) % 991) / 991; r3 = ((h >> 20) % 983) / 983; }
  const stride = (0.88 + 0.24 * r1) * (0.85 + 0.15 * sp) * wk, swing = (0.75 + 0.5 * r2) * wk, posture = (r3 - 0.5) * 0.06;
  const ph = t * 0.9, bump = (x: number, c: number, w: number) => { let d = x - c; d -= Math.round(d); return Math.exp(-(d * d) / (w * w)); };
  const leg = (f: number) => {   // f: 0 heel strike … 1 the next heel strike
    const hip = 0.3 * Math.cos(f * 2 * Math.PI) + 0.06;   // thigh forward (+) and back
    const knee = 0.2 * bump(f, 0.12, 0.08) + 1.0 * bump(f, 0.72, 0.13) + 0.04;
    const ank = 0.32 * bump(f, 0.56, 0.06) - 0.18 * bump(f, 0.82, 0.1) - 0.1 * bump(f, 0.0, 0.05);   // push off (toes down), toes up through the swing, the heel first
    return [-hip * stride, knee * Math.min(1.15, stride * 1.05), ank * wk];
  };
  const fl = ((ph % 1) + 1) % 1, fr = (fl + 0.5) % 1, A = leg(fl), B = leg(fr), c = Math.cos(fl * 2 * Math.PI);
  const g: any = { L: [0.03 - 0.3 * c * swing, 0.07, 0, 0.22 + 0.22 * Math.max(0, -c) * swing], R: [0.03 + 0.3 * c * swing, 0.07, 0, 0.22 + 0.22 * Math.max(0, c) * swing],
    lean: 0, bob: 0, roll: 0, nod: 0, shake: 0, tilt: 0, flush: 0, calm: 0.4 };
  g.legs = [A[0], A[1], B[0], B[1]]; g.ank = [A[2], B[2]];
  if (L) {
    const two = Math.cos(fl * 4 * Math.PI);
    g.bob = 0.011 * (1 - two) / 2 * stride - 0.006 * stride;   // highest over the standing leg, lowest as the feet pass
    g.roll = 0.022 * Math.sin(fl * 2 * Math.PI) * wk;          // the weight from side to side
    g.pelvis = 0.07 * c * stride;                              // the hips turn with the forward leg
    g.spine = [0.04 + posture + 0.01 * sp, -0.11 * c * stride, -0.018 * Math.sin(fl * 2 * Math.PI) * wk];   // shoulders against the hips
    g.shake = -0.5 * g.pelvis - 0.5 * g.spine[1];              // the head keeps looking ahead
    g.nod = -g.bob * 2.5 - g.spine[0] * 0.6;
    if (L >= 3) g.nod += 0.012 * two;                         // Ultra: a touch of the step in the head
  }
  return g;
}
/** Sitting down or standing up (k: 0 standing … 1 seated): leaning forward on the way, as people do. */
function humanSitMove(g: any, k: number): any {
  const s = Math.sin(Math.PI * clamp(k, 0, 1)); if (s < 0.01) return g;
  const sp = (g.spine || [0, 0, 0]).slice(); sp[0] += 0.42 * s; g.spine = sp; g.nod = (g.nod || 0) - 0.25 * s;
  // the hands go to the thighs (or the armrests) to take the weight
  g.L = [g.L[0] + 0.25 * s, g.L[1] + 0.06 * s, g.L[2], g.L[3] + 0.35 * s]; g.R = [g.R[0] + 0.25 * s, g.R[1] + 0.06 * s, g.R[2], g.R[3] + 0.35 * s];
  return g;
}
