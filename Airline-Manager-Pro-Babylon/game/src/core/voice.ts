// Voices for the people who talk to you in the app: the mechanic, the gate agent, the head of operations.
// Natural neural voices (Kokoro-82M, Apache License 2.0), run on this device: on the phone natively on its
// processor cores, on the PC in the app window. The voice pack (about 100 MB) is downloaded once from
// Settings → Voices. Until then, the phone's or PC's own voice reads the lines.
// Each line is spoken exactly as it is written on screen. Lines are prepared in the background as soon as
// they are known, sentence by sentence, so the first words play quickly and later ones follow on.

interface Speaker { voice: string; accent: 'a' | 'b'; speed: number; pitch: number; title: string; mood?: string; cents?: number; wobble?: number; gain?: number; slur?: boolean; exclaim?: boolean; sex?: 'm' | 'f'; key?: string; devIdx?: number }
const SPEAKERS: { [k: string]: Speaker } = {
  mechanic: { voice: 'bm_george', accent: 'b', speed: 1.0, pitch: 0.92, title: 'Mechanic' },
  gate: { voice: 'bf_emma', accent: 'b', speed: 1.02, pitch: 1.05, title: 'Gate agent' },
  ops: { voice: 'af_heart', accent: 'a', speed: 1.0, pitch: 1.0, title: 'Head of operations' },
  pilot: { voice: 'bm_lewis', accent: 'b', speed: 1.0, pitch: 0.97, title: 'Pilot' },
  authority: { voice: 'bm_daniel', accent: 'b', speed: 0.97, pitch: 0.95, title: 'Aviation authority' },
  legal: { voice: 'bf_isabella', accent: 'b', speed: 0.98, pitch: 1.0, title: 'Company lawyer' },
  finance: { voice: 'af_bella', accent: 'a', speed: 1.0, pitch: 1.02, title: 'Finance' },
};
// people who only speak now and then (passengers): their voice follows who they are
const OTHER_SPEAKERS: { [k: string]: Speaker } = { pax: { voice: 'bm_lewis', accent: 'b', speed: 1.0, pitch: 1.0, title: 'Passenger' } };
// voices of each sex, for people with a name and a sex of their own (British first, then American)
const VOICE_POOL: { [sex: string]: string[] } = { m: ['bm_george', 'bm_lewis', 'bm_daniel', 'am_michael', 'am_fenrir', 'am_puck'], f: ['bf_emma', 'bf_isabella', 'af_heart', 'af_bella'] };
// Your own voice (you, the airline manager and pilot): 20 male and 20 female, chosen when you create or edit your
// pilot. Kokoro's English voices, and some made by mixing two of them (voice pack 2). [id, name, what it sounds like]
const MY_VOICES: { [sex: string]: [string, string, string][] } = {
  m: [['am_michael', 'Michael', 'American, calm'], ['am_fenrir', 'Fenrir', 'American, deep'], ['am_puck', 'Puck', 'American, lively'], ['am_echo', 'Echo', 'American, soft'],
    ['am_eric', 'Eric', 'American, crisp'], ['am_liam', 'Liam', 'American, young'], ['am_onyx', 'Onyx', 'American, low'], ['am_adam', 'Adam', 'American, plain'],
    ['bm_george', 'George', 'British, mature'], ['bm_fable', 'Fable', 'British, storyteller'], ['bm_lewis', 'Lewis', 'British, warm'], ['bm_daniel', 'Daniel', 'British, formal'],
    ['mx_m1', 'Atlantic', 'George and Michael mixed'], ['mx_m2', 'Northwind', 'Lewis and Fenrir mixed'], ['mx_m3', 'Basalt', 'Daniel and Onyx mixed'], ['mx_m4', 'Harbour', 'Fable and Puck mixed'],
    ['mx_m5', 'Meridian', 'Eric and George mixed'], ['mx_m6', 'Skerry', 'Liam and Lewis mixed'], ['mx_m7', 'Fjord', 'Echo and Daniel mixed'], ['mx_m8', 'Tailwind', 'Adam and Michael mixed']],
  f: [['af_heart', 'Heart', 'American, warm'], ['af_bella', 'Bella', 'American, bright'], ['af_nicole', 'Nicole', 'American, soft'], ['af_aoede', 'Aoede', 'American, clear'],
    ['af_kore', 'Kore', 'American, steady'], ['af_sarah', 'Sarah', 'American, friendly'], ['af_nova', 'Nova', 'American, light'], ['af_sky', 'Sky', 'American, airy'],
    ['af_alloy', 'Alloy', 'American, even'], ['af_jessica', 'Jessica', 'American, quick'], ['af_river', 'River', 'American, relaxed'], ['bf_emma', 'Emma', 'British, poised'],
    ['bf_isabella', 'Isabella', 'British, firm'], ['bf_alice', 'Alice', 'British, gentle'], ['bf_lily', 'Lily', 'British, young'],
    ['mx_f1', 'Aurora', 'Emma and Heart mixed'], ['mx_f2', 'Cirrus', 'Bella and Nicole mixed'], ['mx_f3', 'Tern', 'Isabella and Sarah mixed'], ['mx_f4', 'Lumen', 'Kore and Lily mixed'], ['mx_f5', 'Solstice', 'Aoede and Alice mixed']],
};
// mixed voices: the accent of their first voice
const MY_MIX_ACCENT: { [id: string]: 'a' | 'b' } = { mx_m1: 'b', mx_m2: 'b', mx_m3: 'b', mx_m4: 'b', mx_m5: 'a', mx_m6: 'a', mx_m7: 'a', mx_m8: 'a', mx_f1: 'b', mx_f2: 'a', mx_f3: 'b', mx_f4: 'a', mx_f5: 'a' };
const MY_DEFAULT: { [sex: string]: string } = { m: 'am_michael', f: 'af_heart' };
/** Your pilot's sex and chosen voice. */
function myVoiceChoice(): { sex: 'm' | 'f'; voice: string } {
  let look: any = null; try { look = myPilot().look; } catch (e) { /* no pilot yet */ }
  const sex: 'm' | 'f' = look && look.sex === 'f' ? 'f' : 'm', v = look && look.voice;
  return { sex, voice: v && MY_VOICES[sex].some(x => x[0] === v) ? v : MY_DEFAULT[sex] };
}
/** Is this voice in the pack on this device? (The voices added in pack 2 need its small download.) */
function voiceInstalled(v: string): boolean { return !VoicePack.files || !Object.keys(VoicePack.files).length ? false : VoicePack.files['voice-' + v + '.bin'] > 0; }
/** What you say, in your own voice: "me" (your pilot), or "me|sex|mood|voice" to hear a voice before choosing it. */
function myWho(mood?: string): string { const c = myVoiceChoice(); return `me|${c.sex}|${mood || ''}`; }
// how a mood sounds: pace, pitch (cents), a wobble in the pitch, loudness, slurred words, exclamations
const MOODS: { [m: string]: { speed: number; cents: number; wobble: number; gain: number; slur?: boolean; exclaim?: boolean } } = {
  neutral: { speed: 1, cents: 0, wobble: 0, gain: 1 },
  angry: { speed: 1.1, cents: 90, wobble: 0, gain: 1.3, exclaim: true },
  sorry: { speed: 0.9, cents: -70, wobble: 0, gain: 0.85 },
  drunk: { speed: 0.8, cents: -60, wobble: 70, gain: 1.15, slur: true, exclaim: true },
};
/** How a line sounds when it isn't said: an apology is apologetic, shouting is angry. */
function detectMood(text: string): string {
  if (/\b(sorry|apologi[sz]e|apologies|forgive me|my fault|regret)\b/i.test(text)) return 'sorry';
  if (/!.*!|\b(unacceptable|ridiculous|outrageous|furious|how dare|disgrace|get your hands off|shut up)\b/i.test(text)) return 'angry';
  return 'neutral';
}
/** The speaker for a line: "role", or "role|sex|mood|name" for a person with their own voice and mood. */
function resolveSpeaker(who: string, text: string): Speaker {
  const [role, sex, mood0, name] = String(who || 'mechanic').split('|');
  let base = SPEAKERS[role] || OTHER_SPEAKERS[role] || SPEAKERS.mechanic, sp: Speaker = Object.assign({}, base);
  if (role === 'me') {
    // you: your own voice (or the one being tried), the pack's same-sex voice while a new one isn't downloaded yet
    const c = myVoiceChoice(), sx: 'm' | 'f' = sex === 'f' || sex === 'm' ? sex : c.sex;
    let v = name && MY_VOICES[sx].some(x => x[0] === name) ? name : sx === c.sex ? c.voice : MY_DEFAULT[sx];
    if (VoicePack.state === 'ready' && !voiceInstalled(v)) v = sx === 'f' ? 'af_heart' : 'am_michael';
    base = { voice: v, accent: MY_MIX_ACCENT[v] || (v[0] === 'b' ? 'b' : 'a'), speed: 1, pitch: sx === 'f' ? 1.05 : 0.95, title: 'You' };
    sp = Object.assign({}, base);
  }
  else if ((sex === 'm' || sex === 'f') && sp.voice[1] !== sex) {
    const pool = VOICE_POOL[sex];
    sp.voice = pool[_hashStr(name || role) % pool.length];
    sp.accent = sp.voice[0] === 'b' ? 'b' : 'a';
    sp.pitch = sex === 'f' ? 1.05 : 0.95;
  }
  const mood = mood0 || detectMood(text), m = MOODS[mood] || MOODS.neutral;
  // who it is, for the device's own voices: each person keeps one of them (yours follows your choice)
  sp.sex = sex === 'm' || sex === 'f' ? sex : devSexOf(sp.voice); sp.key = role === 'me' ? 'me' : (name || role);
  if (role === 'me') { const i = MY_VOICES[sp.sex].findIndex(x => x[0] === sp.voice); sp.devIdx = name && name.indexOf('__dev') === 0 ? +name.slice(5) : Math.max(0, i); }   // __devN: trying one in Settings
  sp.mood = mood; sp.cents = m.cents; sp.wobble = m.wobble; sp.gain = m.gain; sp.slur = m.slur; sp.exclaim = m.exclaim;
  // the pitch change also speeds playback up or down, so the model speaks at the pace that comes out right
  sp.speed = Math.round(base.speed * m.speed / Math.pow(2, m.cents / 1200) * 100) / 100;
  return sp;
}
/** A natural voice's sex from its name (af_… / bm_… / mx_f1). */
function devSexOf(v: string): 'm' | 'f' { const c = String(v || '').indexOf('mx_') === 0 ? v[3] : v[1]; return c === 'f' ? 'f' : 'm'; }

/* ---------- the device's own voices: male and female, each in several variations ---------- */
// The phone's or PC's voices rarely say whether they are male or female, so they are told apart by their names
// (Windows, Apple and Samsung voices are named after people; Google's are coded).
const DEV_MALE = /\b(david|mark|george|james|richard|ryan|guy|christopher|eric|roger|steffan|thomas|brian|daniel|alex|fred|arthur|oliver|aaron|gordon|lee|rishi|ravi|prabhat|william|liam|connor|andrew|davis|tony|jason|ralph|albert|bruce|junior|reed|rocko|grandpa|evan|nathan|tom|paul|sean|michael|male|man)\b|smtm\d|-x-(iol|iom|tpd|gbb|gbd|rjs|aub|aud|end|ene)-/i;
const DEV_FEMALE = /\b(zira|hazel|susan|linda|heera|catherine|jenny|aria|libby|sonia|natasha|clara|emma|samantha|karen|moira|tessa|fiona|victoria|allison|ava|serena|kate|martha|nicky|zoe|veena|isha|neerja|emily|sara|sarah|amy|joanna|kimberly|ivy|salli|olivia|kathy|shelley|sandy|flo|grandma|female|woman)\b|smtf\d|-x-(iob|iog|sfg|tpc|tpf|gba|gbc|gbg|aua|auc|ena|enc)-/i;
// each voice in a few variations: [pitch, pace] against its own
const DEV_VARS: [number, number][] = [[1, 1], [0.9, 0.96], [1.09, 1.04], [0.83, 0.93], [1.15, 1.06], [0.95, 1.08], [1.04, 0.92], [0.88, 1.03]];
const DeviceVoices = {
  list: [] as { name: string; lang: string; sex: 'm' | 'f' | '' }[], loaded: false, loading: null as Promise<void> | null,
  load(): Promise<void> {
    if (this.loaded) return Promise.resolve(); if (this.loading) return this.loading;
    const sexOf = (n: string): 'm' | 'f' | '' => DEV_FEMALE.test(n) ? 'f' : DEV_MALE.test(n) ? 'm' : '';
    const N: any = VoicePack.native();
    this.loading = (async () => {
      let raw: { name: string; lang: string }[] = [];
      try {
        if (N && N.deviceVoices) raw = ((await N.deviceVoices()) || {}).voices || [];
        else {
          const S = (window as any).speechSynthesis; if (S) {
            let v = S.getVoices(); if (!v.length) v = await new Promise<any[]>(res => { const t = setTimeout(() => res(S.getVoices()), 1500); S.addEventListener('voiceschanged', () => { clearTimeout(t); res(S.getVoices()); }, { once: true }); });
            raw = v.map((x: SpeechSynthesisVoice) => ({ name: x.name, lang: x.lang }));
          }
        }
      } catch (e) { /* none listed */ }
      this.list = raw.filter(x => /^en/i.test(String(x.lang).replace('_', '-'))).map(x => ({ name: x.name, lang: String(x.lang).replace('_', '-'), sex: sexOf(x.name) }));
      this.loaded = true; this.loading = null;
    })();
    return this.loading;
  },
  /** The variations for one sex: the device's voices of that sex, each in a few pitches and paces (up to 20). */
  variants(sex: 'm' | 'f'): { name: string; lang: string; pitch: number; rate: number }[] {
    let pool = this.list.filter(x => x.sex === sex), base = 1;
    if (!pool.length) { pool = this.list.filter(x => !x.sex); if (!pool.length) pool = this.list.slice(0, 1); base = sex === 'f' ? 1.22 : 0.78; }   // no voice of that sex: made deeper or higher
    if (!pool.length) pool = [{ name: '', lang: '', sex: '' }];
    const n = Math.min(20, Math.max(DEV_VARS.length, pool.length * 3)), out = [];
    for (let i = 0; i < n; i++) { const v = pool[i % pool.length], d = DEV_VARS[Math.floor(i / pool.length) % DEV_VARS.length]; out.push({ name: v.name, lang: v.lang, pitch: base * d[0], rate: d[1] }); }
    return out;
  },
  /** The variation a speaker has: theirs by name (the same each time you meet them), yours by your choice. */
  pick(sp: Speaker) { const V = this.variants(sp.sex || 'm'); return V[(sp.devIdx !== undefined ? sp.devIdx : _hashStr(sp.key || '') ) % V.length]; },
};

/** The words in a mood: slurred and with pauses when drunk, exclamations when angry. */
function moodPhonemes(ps: string, sp: Speaker): string {
  let out = ps;
  if (sp.exclaim) out = out.replace(/\.$/, '!');
  if (sp.slur) {
    let n = 0;
    out = out.replace(/s(?=[ˈˌ]?[aeiouæɑɒɔəɛɜɪʊʌAIOQWY ])/g, () => (n++ % 2 === 0 ? 'ʃ' : 's')).replace(/z\b/g, 'ʒ').replace(/t(?=[aeiouæɑɒɔəɛɜɪʊʌ])/g, 'ɾ');
    let w = 0;
    out = out.replace(/ /g, () => (++w % 4 === 0 ? '… ' : ' '));
  }
  return out;
}

/** The voice pack's files and sizes (its pack.json), for when the list can't be fetched. */
const VOICE_PACK_LIST = { version: 2, files: { 'LICENSE-Kokoro-Apache-2.0.txt': 11357, 'LICENSE-kokoro-onnx-MIT.txt': 1080, 'LICENSE-misaki-Apache-2.0.txt': 11357, 'NOTICE.txt': 676, 'kokoro-v1.0-q8.onnx': 92361271, 'lexicon-gb.json.gz': 2893766, 'lexicon-us.json.gz': 2705901, 'voice-af_alloy.bin': 522240, 'voice-af_aoede.bin': 522240, 'voice-af_bella.bin': 522240, 'voice-af_heart.bin': 522240, 'voice-af_jessica.bin': 522240, 'voice-af_kore.bin': 522240, 'voice-af_nicole.bin': 522240, 'voice-af_nova.bin': 522240, 'voice-af_river.bin': 522240, 'voice-af_sarah.bin': 522240, 'voice-af_sky.bin': 522240, 'voice-am_adam.bin': 522240, 'voice-am_echo.bin': 522240, 'voice-am_eric.bin': 522240, 'voice-am_fenrir.bin': 522240, 'voice-am_liam.bin': 522240, 'voice-am_michael.bin': 522240, 'voice-am_onyx.bin': 522240, 'voice-am_puck.bin': 522240, 'voice-bf_alice.bin': 522240, 'voice-bf_emma.bin': 522240, 'voice-bf_isabella.bin': 522240, 'voice-bf_lily.bin': 522240, 'voice-bm_daniel.bin': 522240, 'voice-bm_fable.bin': 522240, 'voice-bm_george.bin': 522240, 'voice-bm_lewis.bin': 522240, 'voice-mx_f1.bin': 522240, 'voice-mx_f2.bin': 522240, 'voice-mx_f3.bin': 522240, 'voice-mx_f4.bin': 522240, 'voice-mx_f5.bin': 522240, 'voice-mx_m1.bin': 522240, 'voice-mx_m2.bin': 522240, 'voice-mx_m3.bin': 522240, 'voice-mx_m4.bin': 522240, 'voice-mx_m5.bin': 522240, 'voice-mx_m6.bin': 522240, 'voice-mx_m7.bin': 522240, 'voice-mx_m8.bin': 522240 },
  voices: ['bm_george', 'bm_lewis', 'bm_daniel', 'bf_emma', 'bf_isabella', 'af_heart', 'af_bella', 'am_michael', 'am_fenrir', 'am_puck', 'am_echo', 'am_eric', 'am_liam', 'am_onyx', 'am_adam', 'bm_fable', 'af_nicole', 'af_aoede', 'af_kore', 'af_sarah', 'af_nova', 'af_sky', 'af_alloy', 'af_jessica', 'af_river', 'bf_alice', 'bf_lily', 'mx_m1', 'mx_m2', 'mx_m3', 'mx_m4', 'mx_m5', 'mx_m6', 'mx_m7', 'mx_m8', 'mx_f1', 'mx_f2', 'mx_f3', 'mx_f4', 'mx_f5'] };
const VOICE_PACK_BASE = 'https://github.com/DroneDirector/Microsoft-Flight-Simulator-Projects/releases/download/amp-voice-pack-2/';
const VOICE_MODEL = 'kokoro-v1.0-q8.onnx';
// the model's sound numbers (its vocabulary), from the model's config
const KOKORO_IDS: { [c: string]: number } = {";":1,":":2,",":3,".":4,"!":5,"?":6,"—":9,"…":10,"\"":11,"(":12,")":13,"“":14,"”":15," ":16,"̃":17,"ʣ":18,"ʥ":19,"ʦ":20,"ʨ":21,"ᵝ":22,"ꭧ":23,"A":24,"I":25,"O":31,"Q":33,"S":35,"T":36,"W":39,"Y":41,"ᵊ":42,"a":43,"b":44,"c":45,"d":46,"e":47,"f":48,"h":50,"i":51,"j":52,"k":53,"l":54,"m":55,"n":56,"o":57,"p":58,"q":59,"r":60,"s":61,"t":62,"u":63,"v":64,"w":65,"x":66,"y":67,"z":68,"ɑ":69,"ɐ":70,"ɒ":71,"æ":72,"β":75,"ɔ":76,"ɕ":77,"ç":78,"ɖ":80,"ð":81,"ʤ":82,"ə":83,"ɚ":85,"ɛ":86,"ɜ":87,"ɟ":90,"ɡ":92,"ɥ":99,"ɨ":101,"ɪ":102,"ʝ":103,"ɯ":110,"ɰ":111,"ŋ":112,"ɳ":113,"ɲ":114,"ɴ":115,"ø":116,"ɸ":118,"θ":119,"œ":120,"ɹ":123,"ɾ":125,"ɻ":126,"ʁ":128,"ɽ":129,"ʂ":130,"ʃ":131,"ʈ":132,"ʧ":133,"ʊ":135,"ʋ":136,"ʌ":138,"ɣ":139,"ɤ":140,"χ":142,"ʎ":143,"ʒ":147,"ʔ":148,"ˈ":156,"ˌ":157,"ː":158,"ʰ":162,"ʲ":164,"↓":169,"→":171,"↗":172,"↘":173,"ᵻ":177};

/* ---------- the voice pack: where it is, downloading it ---------- */
const VoicePack = {
  state: 'unknown' as 'unknown' | 'none' | 'partial' | 'downloading' | 'ready' | 'error',
  done: 0, total: 0, error: '', dir: '', manifest: null as any, files: {} as { [k: string]: number },
  native(): any { const cap = (window as any).Capacitor; return cap && cap.isNativePlatform && cap.isNativePlatform() && cap.Plugins && cap.Plugins.Voice; },
  /** Where a file of the pack is read from by the app. */
  url(name: string): string {
    if (this.native()) { const cap = (window as any).Capacitor; return cap.convertFileSrc('file://' + this.dir + '/' + name); }
    if (DESKTOP) return '/voicepack/' + name;
    return ((window as any).__VOICE_BASE || 'voicepack/') + name;
  },
  async check(): Promise<string> {
    try {
      if (this.native()) { const r = await this.native().status(); this.dir = r.dir; this.files = r.files || {}; }
      else if (DESKTOP) { const r = await (await fetch('/api/voicepack')).json(); this.files = r.files || {}; if (r.busy) { this.state = 'downloading'; this.done = r.done; this.total = r.total; this.poll(); return this.state; } if (r.error) this.error = r.error; }
      else { this.files = (window as any).__VOICE_FILES || {}; }
    } catch (e) { this.files = {}; }
    const need = [VOICE_MODEL, 'lexicon-gb.json.gz', 'lexicon-us.json.gz'].concat(Object.keys(SPEAKERS).map(k => 'voice-' + SPEAKERS[k].voice + '.bin'));
    const have = need.filter(f => this.files[f] > 0).length;
    this.state = have === need.length ? 'ready' : have ? 'partial' : 'none';
    try { if (this.state === 'ready') localStorage.setItem('amp-voices-ready', '1'); else localStorage.removeItem('amp-voices-ready'); } catch (e) { /* no storage */ }
    return this.state;
  },
  /** Download the pack (or the rest of it). */
  async download(auto?: boolean): Promise<void> {
    if (this.state === 'downloading') return;
    if (!this.native() && !DESKTOP) return;   // a plain browser has nowhere to keep it
    this.state = 'downloading'; this.error = ''; this.done = 0; this.total = 0; voiceUiChanged();
    try {
      // the list of files and their sizes
      let man: any = null;
      if (this.native()) {
        if (!this.dir) await this.check();
        await this.native().download({ base: VOICE_PACK_BASE, files: [['pack.json', -1]] }).catch(() => null);
      }
      man = await this.manifestFetch();
      const list = Object.keys(man.files).map(k => [k, man.files[k]]);
      this.total = list.reduce((t, x) => t + (x[1] as number), 0);
      if (this.native()) {
        const h = await this.native().addListener('progress', (p: any) => { this.done = p.done; this.total = p.total; voiceUiChanged(); });
        try { await this.native().download({ base: VOICE_PACK_BASE, files: list }); } finally { try { h.remove(); } catch (e) { /* gone */ } }
      } else if (DESKTOP) {
        await fetch('/api/voicepack', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ base: VOICE_PACK_BASE, files: list }) });
        await new Promise<void>((ok, bad) => { const t = setInterval(async () => {
          try { const r = await (await fetch('/api/voicepack')).json(); this.done = r.done; this.total = r.total || this.total; voiceUiChanged();
            if (!r.busy) { clearInterval(t); r.error ? bad(new Error(r.error)) : ok(); } } catch (e) { /* try again */ } }, 700); });
      }
      await this.check();
      if (this.state !== 'ready') throw new Error('Some files are missing. Try again.');
      try { Sound.chime(); toast('The voices are ready', 'ok'); } catch (e) { /* ignore */ }
    } catch (e: any) {
      this.state = 'error'; this.error = (e && e.message) || String(e);
      // tried again at the next start; only noted (no pop-up) when it started by itself
      try { ErrorLog.add('voice', 'The voices couldn\'t be downloaded', this.error, '', !auto); } catch (er) { /* ignore */ }
    }
    voiceUiChanged();
  },
  /** pack.json: the files in the pack and their sizes (from the download, or the phone's copy). */
  async manifestFetch(): Promise<any> {
    if (this.manifest) return this.manifest;
    let txt = '';
    if (this.native()) txt = await (await fetch(this.url('pack.json'))).text();
    else if (DESKTOP) {
      // the PC app fetches the list itself (newer PC apps); otherwise the list this version was made with
      try { const r = await fetch('/api/voicepack?manifest=1&base=' + encodeURIComponent(VOICE_PACK_BASE)); const j = r.ok ? await r.json() : null; txt = j && j.text ? j.text : ''; } catch (e) { txt = ''; }
      if (!txt) txt = JSON.stringify(VOICE_PACK_LIST);
    }
    else txt = await (await fetch(this.url('pack.json'))).text();
    this.manifest = JSON.parse(txt);
    return this.manifest;
  },
  poll() { const t = setInterval(async () => { try { const r = await (await fetch('/api/voicepack')).json(); this.done = r.done; this.total = r.total; if (!r.busy) { clearInterval(t); await this.check(); } voiceUiChanged(); } catch (e) { clearInterval(t); } }, 900); },
  async remove() {
    Voice.stop(); VoiceEngine.reset();
    try { if (this.native()) await this.native().remove(); else if (DESKTOP) await fetch('/api/voicepack', { method: 'DELETE' }); } catch (e) { /* ignore */ }
    await this.check(); voiceUiChanged();
  },
  sizeText(): string { const m = this.manifest; const t = m ? Object.keys(m.files).reduce((s, k) => s + m.files[k], 0) : 101e6; return Math.round(t / 1e6) + ' MB'; },
};

/* ---------- running the voice model ---------- */
const VoiceEngine = {
  loading: null as Promise<void>, worker: null as Worker, kind: '' as '' | 'native' | 'worker',
  voicesLoaded: {} as { [v: string]: Promise<any> }, seq: 0, waits: {} as { [id: number]: (a: any) => void },
  reset() { if (this.worker) this.worker.terminate(); this.worker = null; this.loading = null; this.kind = ''; this.voicesLoaded = {}; },
  async ready(): Promise<void> {
    if (!this.loading) this.loading = (async () => {
      await Promise.all(['a', 'b'].map(async (ac: 'a' | 'b') => {
        if (G2P.lex[ac]) return;
        const r = await fetch(VoicePack.url(`lexicon-${ac === 'b' ? 'gb' : 'us'}.json.gz`));
        const ds = new (window as any).DecompressionStream('gzip');
        G2P.lex[ac] = await new Response(r.body.pipeThrough(ds)).json();
      }));
      const N = VoicePack.native();
      if (N) { await N.load({ model: VOICE_MODEL }); this.kind = 'native'; return; }
      const base = location.href.replace(/[^/]*$/, '');
      this.worker = new Worker('tts-worker.js');
      this.worker.onmessage = e => { const m = e.data; const w = this.waits[m.id]; if (w) { delete this.waits[m.id]; w(m); } };
      await this.call({ type: 'init', base, model: new URL(VoicePack.url(VOICE_MODEL), location.href).toString() }, ++this.seq);
      this.kind = 'worker';
    })().catch(e => { this.loading = null; throw e; });
    return this.loading;
  },
  call(m: any, id: number): Promise<any> {
    return new Promise((ok, bad) => { this.waits[id] = (r: any) => r.type === 'error' ? bad(new Error(r.error)) : ok(r); this.worker.postMessage(Object.assign({ id }, m)); });
  },
  voice(name: string): Promise<any> {
    if (this.kind === 'native') return Promise.resolve();
    if (!this.voicesLoaded[name]) {
      this.voicesLoaded[name] = this.call({ type: 'voice', name, url: new URL(VoicePack.url('voice-' + name + '.bin'), location.href).toString() }, ++this.seq);
      this.voicesLoaded[name].catch(() => { delete this.voicesLoaded[name]; });
    }
    return this.voicesLoaded[name];
  },
  /** One sentence of phonemes to audio (24 kHz). */
  async synth(ps: string, sp: Speaker): Promise<Float32Array> {
    await this.ready();
    const ids: number[] = []; for (const ch of ps) { const i = KOKORO_IDS[ch]; if (i != null) ids.push(i); }
    if (!ids.length) return new Float32Array(0);
    if (this.kind === 'native') {
      const r = await VoicePack.native().synth({ ids, voice: sp.voice, speed: sp.speed });
      const bin = atob(r.pcm), n = bin.length >> 1, out = new Float32Array(n);
      for (let i = 0; i < n; i++) { let v = bin.charCodeAt(i * 2) | (bin.charCodeAt(i * 2 + 1) << 8); if (v > 32767) v -= 65536; out[i] = v / 32767; }
      return out;
    }
    await this.voice(sp.voice);
    const id = ++this.seq, r = await this.call({ type: 'synth', ids, voice: sp.voice, speed: sp.speed }, id);
    return r.audio;
  },
};

/* ---------- speaking ---------- */
// sentences already spoken or prepared, kept for a while (the same line again plays straight away)
const _voiceCache = new Map<string, Promise<Float32Array>>();

// Lines are spoken from a queue: a line you tap goes first, lines being got ready in the background wait.
// Everything spoken is also kept on the device (the newest 300 sentences), so a line plays at once the
// next time, also after the app was closed.
const VoiceQ = { busy: false, hi: [] as any[], lo: [] as any[] };
function voicePump() {
  if (VoiceQ.busy) return;
  const job = VoiceQ.hi.shift() || VoiceQ.lo.shift(); if (!job) return;
  VoiceQ.busy = true;
  VoiceEngine.synth(job.ps, job.sp).then(a => { job.ok(a); VoiceStore.put(job.k, a); }, e => job.bad(e))
    .then(() => { VoiceQ.busy = false; voicePump(); });
}
function voiceSentence(ps: string, sp: Speaker, urgent?: boolean): Promise<Float32Array> {
  const k = sp.voice + '|' + sp.speed + '|' + ps;
  let p = _voiceCache.get(k);
  if (p) {
    // waiting in the background queue: move it to the front
    if (urgent) { const i = VoiceQ.lo.findIndex(j => j.k === k); if (i >= 0) VoiceQ.hi.push(VoiceQ.lo.splice(i, 1)[0]); }
    return p;
  }
  p = new Promise<Float32Array>((ok, bad) => {
    VoiceStore.get(k).then(hit => {
      if (hit) { ok(hit); return; }
      (urgent ? VoiceQ.hi : VoiceQ.lo).push({ k, ps, sp, ok, bad }); voicePump();
    });
  });
  _voiceCache.set(k, p);
  p.catch(() => _voiceCache.delete(k));
  if (_voiceCache.size > 240) _voiceCache.delete(_voiceCache.keys().next().value);
  return p;
}

/** Spoken sentences kept on the device (IndexedDB), as 16-bit sound. */
const VoiceStore = {
  db: null as Promise<IDBDatabase>, n: 0,
  open(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    this.db = new Promise((ok, bad) => {
      try {
        const r = indexedDB.open('amp-voice-lines', 1);
        r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains('l')) d.createObjectStore('l'); };
        r.onsuccess = () => ok(r.result); r.onerror = () => bad(r.error);
      } catch (e) { bad(e); }
    });
    this.db.catch(() => { /* no storage: lines are made each time */ });
    return this.db;
  },
  get(k: string): Promise<Float32Array> {
    return this.open().then(d => new Promise<Float32Array>(ok => {
      try {
        const q = d.transaction('l', 'readonly').objectStore('l').get(k);
        q.onsuccess = () => { const v = q.result; if (!v || !v.pcm) { ok(null); return; } const i16 = new Int16Array(v.pcm), f = new Float32Array(i16.length); for (let i = 0; i < i16.length; i++) f[i] = i16[i] / 32767; ok(f); };
        q.onerror = () => ok(null);
      } catch (e) { ok(null); }
    })).catch(() => null);
  },
  put(k: string, a: Float32Array) {
    if (!a || !a.length) return;
    const i16 = new Int16Array(a.length); for (let i = 0; i < a.length; i++) i16[i] = Math.max(-32767, Math.min(32767, Math.round(a[i] * 32767)));
    this.open().then(d => {
      try {
        const st = d.transaction('l', 'readwrite').objectStore('l');
        st.put({ pcm: i16.buffer, t: Date.now() }, k);
        // keep the newest 300 sentences
        if (++this.n % 25 === 0) { const c = st.count(); c.onsuccess = () => { if (c.result > 300) { let left = c.result - 300; const cur = st.openCursor(); cur.onsuccess = () => { const x = cur.result; if (x && left-- > 0) { x.delete(); x.continue(); } }; } }; }
      } catch (e) { /* full: skip */ }
    }).catch(() => { /* no storage */ });
  },
};

/** The messages waiting for you (unread notices, the mechanic's open reports), got ready in the background. */
function voicePrepareWaiting() {
  try {
    let n = 0;
    for (const i of State.issues) if (i.status === 'open' && n++ < 8) Voice.prepare(mechanicLines(i), 'mechanic');
    for (const m of State.notices) { if (m.read || n++ > 16) continue; const w = noticeSpeaker(m); if (w) Voice.prepare(m.body, w[0]); }
  } catch (e) { /* nothing waiting */ }
}
/** Get every voice line now on screen ready in the background, so pressing play starts at once. */
let _voicePrepT: any = 0;
function voicePrepareVisible() {
  clearTimeout(_voicePrepT);
  _voicePrepT = setTimeout(() => {
    for (const b of Array.from(document.querySelectorAll('.voice-btn[data-say]')) as HTMLElement[]) Voice.prepare(b.getAttribute('data-say') || '', b.getAttribute('data-who') || 'mechanic');
  }, 120);
}
try { new MutationObserver(() => { if (document.querySelector('.voice-btn[data-say]')) voicePrepareVisible(); }).observe(document.documentElement, { childList: true, subtree: true }); } catch (e) { /* older browser */ }
// the sound output is woken on the first touch, so the first line doesn't wait for it
['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, () => { try { const c = audio(true); if (c && c.state !== 'running') c.resume(); } catch (e) { /* muted */ } }, { capture: true, passive: true } as any));

const Voice = {
  speaking: false, preparing: false, token: 0, sources: [] as AudioBufferSourceNode[], onEnd: null as () => void,
  /** Who is speaking now ("role|sex|mood|name"), what, and from when it is heard (0 while it is being prepared):
   *  the faces in the 3D rooms move their mouths to it (humanTalk). Pressing Play again starts it all again. */
  who: '', text: '', audibleAt: 0, track: [] as { t0: number; dur: number; ph: string }[], an: null as AnalyserNode, lvBuf: null as Float32Array,
  natural(): boolean { return (State.settings as any).voiceEngine !== 'device' && VoicePack.state === 'ready'; },
  /** The text as pieces to speak: sentences, with long ones cut at their commas and a short first piece,
   *  so the voice starts as soon as the first few words are ready. */
  sentences(text: string, sp: Speaker): string[] {
    const out: string[] = [];
    G2P.phonemize(text, sp.accent).forEach((p, i) => {
      const cut = i === 0 ? 40 : 150;
      if (p.length <= cut) { out.push(p); return; }
      const parts = p.split(/(?<=,) /); let cur = '';
      for (const x of parts) { if (cur && (cur.length + x.length > (out.length ? 150 : cut))) { out.push(cur); cur = x; } else cur = cur ? cur + ' ' + x : x; }
      if (cur) out.push(cur);
    });
    return out.map(p => moodPhonemes(p, sp));
  },
  /** Get a line ready in the background, so it plays at once when it's needed. */
  prepare(text: string, who?: string) {
    if (!this.natural() || !text || !State.settings.mechanicVoice) return;
    const sp = resolveSpeaker(who, text);
    VoiceEngine.ready().then(() => { for (const s of this.sentences(text, sp)) voiceSentence(s, sp).catch(() => { /* tried again when played */ }); }).catch(() => { /* not ready */ });
  },
  /** Speak a line. Returns false when nothing can be played (muted). */
  speak(text: string, onEnd?: () => void, who?: string): boolean {
    this.stop();
    if (State.settings.muteAll || !State.settings.mechanicVoice || !text) { if (onEnd) onEnd(); return false; }
    const sp = resolveSpeaker(who, text), tok = ++this.token;
    this.onEnd = onEnd || null; this.speaking = true; this.who = String(who || ''); this.text = text; this.audibleAt = 0; this.track = [];
    if (!this.natural()) { this.device(text, sp, tok); return true; }
    this.preparing = true; voiceUiChanged();
    let started = false;
    (async () => {
      let ctx: AudioContext;
      try {
        // the voice model loads once (a few seconds); if it doesn't answer, the device's own voice speaks
        await Promise.race([VoiceEngine.ready(), new Promise((ok, bad) => setTimeout(() => bad(new Error('the voice model took too long to load')), 25000))]);
        ctx = audio(true); if (!ctx) { this.finish(); return; } if (ctx.state !== 'running') await ctx.resume();
        // each sentence is made after the one before, so each gets its own time: 30 s for the first, then 25 s more per sentence
        const sents = this.sentences(text, sp);
        // a meter on the voice, for the mouths (how loud it is right now)
        if (!this.an || (this.an as any).context !== ctx) { try { this.an = ctx.createAnalyser(); this.an.fftSize = 512; this.an.connect(ctx.destination); } catch (e) { this.an = null; } }
        const parts = sents.map((s, i) => {
          const p = Promise.race([voiceSentence(s, sp, true), new Promise<Float32Array>((ok, bad) => setTimeout(() => bad(new Error('the voice took too long')), 30000 + i * 25000))]);
          p.catch(() => { /* handled where it is played; never an unhandled error */ });
          return p;
        });
        let at = 0, last: AudioBufferSourceNode = null;
        for (let i = 0; i < parts.length; i++) {
          const pcm = await parts[i];
          if (tok !== this.token) return;
          if (i === 0) { this.preparing = false; voiceUiChanged(); }
          if (!pcm.length) continue;
          const buf = ctx.createBuffer(1, pcm.length, 24000); buf.copyToChannel(pcm as any, 0);
          const src = ctx.createBufferSource(); src.buffer = buf;
          const g = ctx.createGain(); g.gain.value = 1.15 * (sp.gain || 1); src.connect(g); g.connect(this.an || ctx.destination);
          at = Math.max(at, ctx.currentTime + 0.02);
          const rate = Math.pow(2, (sp.cents || 0) / 1200), dur = buf.duration / rate;
          if (sp.wobble) {
            // drunk: the pitch drifts up and down
            const curve = new Float32Array(64);
            for (let j = 0; j < 64; j++) curve[j] = (sp.cents || 0) + Math.sin(j / 63 * Math.PI * 2 * Math.max(1, dur / 1.6) + i) * sp.wobble;
            src.detune.setValueCurveAtTime(curve, at, Math.max(0.05, dur));
          } else src.detune.value = sp.cents || 0;
          if (!this.audibleAt) this.audibleAt = Date.now() + Math.max(0, at - ctx.currentTime) * 1000;
          this.track.push({ t0: Date.now() + Math.max(0, at - ctx.currentTime) * 1000, dur: dur * 1000, ph: sents[i] || '' });   // when each sentence is heard, with its sounds
          src.start(at); at += dur + (sp.mood === 'sorry' ? 0.3 : sp.mood === 'angry' ? 0.08 : 0.18);
          this.sources.push(src); started = true; last = src;
        }
        // done talking: the button stops when the last sound ends (and in any case shortly after)
        if (!last) { this.finish(); return; }
        last.onended = () => { if (tok === this.token) this.finish(); };
        const left = Math.max(0, at - ctx.currentTime) * 1000 + 400;
        setTimeout(() => { if (tok === this.token && this.speaking) this.finish(); }, left);
      } catch (e: any) {
        if (tok !== this.token) return;
        // a slow sentence after the voice had started is not worth a report: it simply stops there
        if (!started) { try { ErrorLog.add('voice', 'The voice couldn\'t speak', (e && e.message) || String(e)); } catch (er) { /* ignore */ } }
        // one voice for the whole message: once the natural voice has started, it is never swapped for another
        if (started) { this.finish(); return; }
        this.device(text, sp, tok);   // nothing played yet: the device's own voice says it all
      }
    })();
    return true;
  },
  /** The phone's or PC's own voice. */
  device(text: string, sp: Speaker, tok: number) {
    this.preparing = false; this.audibleAt = Date.now() + 250; voiceUiChanged();
    if (!DeviceVoices.loaded) { DeviceVoices.load().then(() => { if (tok === this.token) this.device(text, sp, tok); }); return; }
    const dv = DeviceVoices.pick(sp), k0 = Math.pow(2, (sp.cents || 0) / 1200);
    const N = VoicePack.native();
    if (N && N.speakDevice) {
      const h = N.addListener('deviceDone', () => { Promise.resolve(h).then((x: any) => x && x.remove()); if (tok === this.token) this.finish(); });
      N.speakDevice({ text, pitch: dv.pitch * k0, rate: dv.rate * sp.speed * k0, lang: dv.lang || (sp.accent === 'b' ? 'en-GB' : 'en-US'), voice: dv.name }).catch(() => { if (tok === this.token) this.finish(); });
      return;
    }
    const s = (window as any).speechSynthesis;
    if (!s) { this.finish(); return; }
    s.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const k = Math.pow(2, (sp.cents || 0) / 1200);
    u.rate = dv.rate * sp.speed * k; u.pitch = Math.max(0.1, Math.min(2, dv.pitch * k)); u.lang = dv.lang || (sp.accent === 'b' ? 'en-GB' : 'en-US');
    const all = s.getVoices(), v = all.find((x: SpeechSynthesisVoice) => x.name === dv.name) || all.find((x: SpeechSynthesisVoice) => x.lang.replace('_', '-').indexOf(u.lang) === 0);
    if (v) u.voice = v;
    u.onend = () => { if (tok === this.token) this.finish(); };
    s.speak(u);
  },
  /** How loud the voice is right now (0 silent … about 0.5 loud), or -1 with no meter. */
  level(): number {
    const a = this.an; if (!a) return -1;
    const d = this.lvBuf && this.lvBuf.length === a.fftSize ? this.lvBuf : (this.lvBuf = new Float32Array(a.fftSize));
    a.getFloatTimeDomainData(d); let s = 0; for (let i = 0; i < d.length; i++) s += d[i] * d[i];
    return Math.sqrt(s / d.length);
  },
  finish() { this.speaking = false; this.preparing = false; this.audibleAt = 0; this.sources = []; const f = this.onEnd; this.onEnd = null; voiceUiChanged(); if (f) f(); },
  stop() {
    this.token++;
    for (const s of this.sources) try { s.onended = null; s.stop(); } catch (e) { /* not started */ }
    this.sources = [];
    try { const s = (window as any).speechSynthesis; if (s) s.cancel(); } catch (e) { /* none */ }
    try { const N = VoicePack.native(); if (N && N.stopDevice) N.stopDevice(); } catch (e) { /* none */ }
    const was = this.speaking; this.speaking = false; this.preparing = false; this.onEnd = null; this.audibleAt = 0;
    if (was) voiceUiChanged();
  },
};

/** Keep every play button and the settings in step with the voice. */
function voiceUiChanged() {
  for (const b of Array.from(document.querySelectorAll('.voice-btn')) as HTMLElement[]) {
    const mine = b.getAttribute('data-playing') === '1';
    const on = mine && Voice.speaking;
    b.classList.toggle('on', on); b.classList.toggle('prep', on && Voice.preparing);
    const ic = b.querySelector('.vb-ic'); if (ic) ic.innerHTML = icon(on ? 'stop' : 'play');
    if (!on) b.setAttribute('data-playing', '0');
  }
  for (const n of Array.from(document.querySelectorAll('.voice-note[data-vn]')) as HTMLElement[]) { const h = voiceNoteInner(n.getAttribute('data-vn')); if (n.innerHTML !== h) n.innerHTML = h; }
  try { if (typeof _setSection !== 'undefined' && _setSection === 'voice' && document.querySelector('.settings')) rerenderSettingsBody(); } catch (e) { /* not open */ }
  try { splashVoice(); } catch (e) { /* no start-up screen */ }
}

/** A play button for someone's words; data-say holds the line, data-who the speaker. */
/** Who is speaking, for a person of the airline: "role|sex|mood|name". */
function personWho(role: string, p: any, mood?: string): string {
  return role + '|' + ((p && (p.sex || (p.look && p.look.sex))) || '') + '|' + (mood || '') + '|' + ((p && p.name) || role);
}
function voiceButton(text: string, who: string, label: string): string {
  if (!State.settings.mechanicVoice) return '';
  return `<button class="voice-btn" data-act="say" data-who="${esc(who)}" data-say="${esc(text)}" aria-label="${esc(label)}">
    <span class="vb-ic">${icon('play')}</span><span class="wave">${'<i></i>'.repeat(14)}</span></button>`;
}
function voiceNote(): string {
  if (State.settings.muteAll) return 'All sounds are muted';
  if (!State.settings.mechanicVoice) return '';
  if ((State.settings as any).voiceEngine === 'device') return 'Voice: this device\'s own voice';
  if (VoicePack.state === 'ready') return 'Natural voice';
  if (VoicePack.state === 'downloading') return `Downloading the voices… ${VoicePack.total ? Math.round(VoicePack.done / VoicePack.total * 100) : 0}%`;
  return 'Device voice. Natural voices: Settings → Voices';
}
/** The line under a play button: how the voice will sound, kept up to date, with a way to turn sounds on. */
function voiceNoteEl(extra?: string): string {
  return `<small class="voice-note" data-vn="${esc(extra || '')}">${voiceNoteInner(extra)}</small>`;
}
function voiceNoteInner(extra?: string): string {
  if (State.settings.muteAll) return `All sounds are muted <button class="link-btn" data-act="unmute">Turn sounds on</button>`;
  const t = voiceNote();
  return esc(t + (t && extra ? ' · ' : '') + (extra || ''));
}
ACTIONS.say = el => {
  if (Voice.speaking && el.getAttribute('data-playing') === '1') { Voice.stop(); return; }
  if (State.settings.muteAll) { toast('All sounds are muted', 'warn', { label: 'Turn on', act: 'unmute' }); voiceUiChanged(); return; }
  Voice.stop();
  el.setAttribute('data-playing', '1');
  Voice.speak(el.getAttribute('data-say') || '', () => { el.setAttribute('data-playing', '0'); voiceUiChanged(); }, el.getAttribute('data-who') || 'mechanic');
  voiceUiChanged();
};

/** Natural voices are switched on but not downloaded here yet (known before the pack is checked). */
function voicesWanted(): boolean {
  const S: any = State.settings;
  if (!S.mechanicVoice || S.voiceEngine === 'device' || (!VoicePack.native() && !DESKTOP)) return false;
  try { return localStorage.getItem('amp-voices-ready') !== '1'; } catch (e) { return true; }
}

function startVoices() {
  // older saves: "recorded lines" and "neural voice pack" both mean the natural voices now
  const S: any = State.settings;
  if (S.voiceEngine !== 'device') S.voiceEngine = 'neural';
  VoicePack.check().then(st => {
    voiceUiChanged();
    // load the voice model straight away and speak one short line silently, so the first real line is quick
    if (st === 'ready') setTimeout(() => VoiceEngine.ready().then(() => { const sp = resolveSpeaker('mechanic', 'Ready.'); return voiceSentence(Voice.sentences('Ready.', sp)[0], sp); }).then(() => { voicePrepareVisible(); voicePrepareWaiting(); }).catch(() => { /* loads on first use */ }), 300);
    // not downloaded yet: it starts right away, on the start-up screen, and carries on in the background
    else if (S.mechanicVoice && S.voiceEngine !== 'device' && st !== 'downloading') VoicePack.download(true);
  });
}
