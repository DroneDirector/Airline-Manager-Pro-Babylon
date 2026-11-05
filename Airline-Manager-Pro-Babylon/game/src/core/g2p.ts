// Text to phonemes for the neural voices: turns what a person says into the sounds the voice model
// speaks. English words come from a pronunciation dictionary (misaki's British and American lexicons,
// Apache License 2.0, in the voice pack); numbers, money, registrations, airport codes and units are
// written out first; names and other unknown words are sounded out by spelling rules, with hand-made
// spellings for the names the app uses.

type Accent = 'a' | 'b';   // American, British

const G2P = {
  lex: { a: null as any, b: null as any },

  /* ---------- numbers ---------- */
  ONES: ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'],
  TENS: ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'],
  num(n: number, uk: boolean): string {
    n = Math.floor(Math.abs(n));
    if (n < 20) return this.ONES[n];
    if (n < 100) return this.TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + this.ONES[n % 10] : '');
    if (n < 1000) return this.ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 ? (uk ? ' and ' : ' ') + this.num(n % 100, uk) : '');
    for (const [v, w] of [[1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']] as [number, string][]) {
      if (n >= v) { const r = n % v; return this.num(Math.floor(n / v), uk) + ' ' + w + (r ? (r < 100 && uk ? ' and ' : ' ') + this.num(r, uk) : ''); }
    }
    return String(n);
  },
  digits(s: string): string { return s.split('').map(d => this.ONES[+d]).join(' '); },
  /** Aircraft model numbers the way pilots say them: seven three seven, triple seven, three twenty. */
  model(s: string): string {
    if (/^7(\d)7$/.test(s)) return s === '777' ? 'triple seven' : this.digits(s);
    if (/^\d00$/.test(s)) return this.ONES[+s[0]] + ' hundred';
    if (/^\d\d\d$/.test(s)) return this.ONES[+s[0]] + ' ' + (s[1] === '0' ? 'oh ' + this.ONES[+s[2]] : this.num(+s.slice(1), false));
    return this.digits(s);
  },

  /* ---------- words before pronouncing ---------- */
  UNITS: { fpm: 'feet per minute', kt: 'knots', kts: 'knots', nm: 'nautical miles', kg: 'kilograms', km: 'kilometres', ft: 'feet', h: 'hours', min: 'minutes', '%': 'percent', g: 'g' } as { [k: string]: string },
  /** Writes out what the dictionary can't read: money, numbers, codes, units. */
  normalise(text: string, uk: boolean): string {
    let t = ' ' + text.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ') + ' ';
    // money: $410,000 / $1.2M / $35k
    t = t.replace(/([-+−]?)\$\s?(\d[\d,]*)(?:\.(\d+))?\s?([kKMB])?\b/g, (_m, sign, a, dec, mult) => {
      const n = parseInt(a.replace(/,/g, ''), 10);
      const head = sign === '-' || sign === '−' ? 'minus ' : '';
      if (mult) { const w = mult.toLowerCase() === 'k' ? 'thousand' : mult === 'M' ? 'million' : 'billion'; return ` ${head}${this.num(n, uk)}${dec ? ' point ' + this.digits(dec) : ''} ${w} dollars `; }
      return ` ${head}${this.num(n, uk)} dollar${n === 1 ? '' : 's'}${dec && +dec ? ' and ' + this.num(+dec.slice(0, 2).padEnd(2, '0'), uk) + ' cents' : ''} `;
    });
    // aircraft models: A320, A350-900, 737-800, CRJ900, 777-300ER, 208B
    t = t.replace(/\b([A-Z]{1,3})-?(\d{2,3})(?:-(\d{1,3}))?([A-Z]{1,2})?\b/g, (_m, l, a, b, s) => ` ${l.split('').join(' ')} ${this.model(a)}${b ? ' ' + this.model(b) : ''}${s ? ' ' + s.split('').join(' ') : ''} `);
    t = t.replace(/\b(\d{3})-(\d{3})([A-Z]{1,2})?\b/g, (_m, a, b, s) => ` ${this.model(a)} ${this.model(b)}${s ? ' ' + s.split('').join(' ') : ''} `);
    // times 08:50
    t = t.replace(/\b(\d{1,2}):(\d{2})\b/g, (_m, h, m) => ` ${this.num(+h, uk)} ${+m === 0 ? 'hundred' : +m < 10 ? 'oh ' + this.ONES[+m] : this.num(+m, uk)} `);
    // percentages, units after numbers
    t = t.replace(/(\d)\s?%/g, '$1 percent');
    t = t.replace(/(\d[\d,.]*)\s?(fpm|kts|kt|nm|kg|km|ft)\b/g, (_m, n, u) => `${n} ${this.UNITS[u]}`);
    // decimals and plain numbers
    t = t.replace(/\b(\d+)\.(\d+)\b/g, (_m, a, b) => ` ${this.num(+a, uk)} point ${this.digits(b)} `);
    t = t.replace(/\b\d{1,3}(?:,\d{3})+\b|\b\d+\b/g, m => ` ${this.num(+m.replace(/,/g, ''), uk)} `);
    // registrations and codes in capitals (OY-ANA, EKVG, ATR, PMDG): letter by letter
    t = t.replace(/\b([A-Z]{1,2})-([A-Z0-9]{2,4})\b/g, (_m, a, b) => ` ${(a + b).split('').join(' ')} `);
    t = t.replace(/\b[A-Z]{2,5}\b/g, m => this.knownCaps(m) ? m : ' ' + m.split('').join(' ') + ' ');
    t = t.replace(/\s+-\s+|\s+—\s+|—/g, ', ').replace(/&/g, ' and ').replace(/\//g, ' or ');
    return t.replace(/\s+([,.;:!?])/g, '$1').replace(/\s+/g, ' ').trim();
  },
  /** Capital words read as words, not letters. */
  knownCaps(w: string): boolean { return /^(I|OK|NATO|ATIS|GPS|UTC)$/.test(w) ? w !== 'GPS' && w !== 'UTC' : false; },

  /* ---------- dictionary ---------- */
  look(w: string, ac: Accent): string {
    const L = this.lex[ac]; if (!L) return null;
    let v = L[w]; if (v == null && w !== w.toLowerCase()) v = L[w.toLowerCase()];
    if (v == null && w.length > 1 && w === w.toLowerCase()) v = L[w[0].toUpperCase() + w.slice(1)];
    if (v && typeof v === 'object') v = v.DEFAULT;
    return typeof v === 'string' ? v : null;
  },
  /** Plurals, past tenses and -ing forms of known words. */
  stems(w: string, ac: Accent): string {
    const lw = w.toLowerCase(), uk = ac === 'b';
    const s = (st: string) => !st ? null : /[ptkfθ]$/.test(st) ? st + 's' : /[szʃʒʧʤ]$/.test(st) ? st + (uk ? 'ɪz' : 'ᵻz') : st + 'z';
    if (lw.endsWith("'s")) { const p = this.look(lw.slice(0, -2), ac); if (p) return s(p); }
    if (lw.endsWith('s') && !lw.endsWith('ss')) {
      let p = this.look(lw.slice(0, -1), ac); if (p) return s(p);
      if (lw.endsWith('ies')) { p = this.look(lw.slice(0, -3) + 'y', ac); if (p) return s(p); }
      if (lw.endsWith('es')) { p = this.look(lw.slice(0, -2), ac); if (p) return s(p); }
    }
    if (lw.endsWith('ed')) {
      const p = this.look(lw.slice(0, -2), ac) || this.look(lw.slice(0, -1), ac);
      if (p) return /[pkfθʃsʧ]$/.test(p) ? p + 't' : /[td]$/.test(p) ? p + (uk ? 'ɪd' : 'ᵻd') : p + 'd';
    }
    if (lw.endsWith('ing') && lw.length > 5) {
      const p = this.look(lw.slice(0, -3), ac) || this.look(lw.slice(0, -3) + 'e', ac) || (/(.)\1ing$/.test(lw) ? this.look(lw.slice(0, -4), ac) : null);
      if (p) return p + 'ɪŋ';
    }
    if (lw.endsWith('ly')) { const p = this.look(lw.slice(0, -2), ac); if (p) return p + 'li'; }
    return null;
  },

  /* ---------- sounding out unknown words (names) ---------- */
  // how a name is said, written in plain English spelling for the rules below
  NAMES: {
    'jóannes': 'yo-annes', 'rógvi': 'rog-vee', 'bárður': 'bor-wur', 'heðin': 'hay-in', 'sámal': 'sow-mal', 'óli': 'oh-lee', 'rakul': 'rah-kool', 'guðrun': 'goo-droon', 'sólja': 'sol-ya',
    'marjun': 'mar-yoon', 'turið': 'too-ree', 'joensen': 'yo-en-sen', 'hansen': 'han-sen', 'jacobsen': 'yah-cob-sen', 'poulsen': 'pole-sen', 'olsen': 'ol-sen', 'petersen': 'pay-ter-sen',
    'jónas': 'yo-nas', 'mads': 'mads', 'søren': 'sur-en', 'freja': 'fry-ah', 'mette': 'met-teh', 'signe': 'see-neh', 'nielsen': 'neel-sen', 'jensen': 'yen-sen', 'larsen': 'lar-sen', 'kristensen': 'kris-ten-sen',
    'eirik': 'ay-rick', 'ingrid': 'ing-rid', 'sigrid': 'sig-rid', 'kari': 'kah-ree', 'haugen': 'how-gen', 'solberg': 'sole-berg', 'dahl': 'dahl', 'johan': 'yo-han', 'oskar': 'os-kar', 'elsa': 'el-sah',
    'maja': 'my-ah', 'lindqvist': 'lind-kvist', 'nyström': 'nee-strum', 'gunnar': 'goon-nar', 'einar': 'ay-nar', 'bjarki': 'byar-kee', 'katla': 'kaht-lah', 'sóley': 'so-lay', 'hildur': 'hil-dur',
    'jónsson': 'yone-son', 'gunnarsdóttir': 'goon-nars-doh-teer', 'sigurðsson': 'sig-ur-son', 'einarsdóttir': 'ay-nars-doh-teer', 'rhys': 'reese', 'aoife': 'ee-fa', 'niamh': 'neev', 'seán': 'shawn',
    'lukas': 'loo-kas', 'jonas': 'yo-nas', 'müller': 'mew-ler', 'daan': 'dahn', 'sem': 'sem', 'fleur': 'flur', 'sanne': 'sah-neh', 'vries': 'vrees', 'visser': 'vis-ser', 'théo': 'tay-oh',
    'léa': 'lay-ah', 'chloé': 'klo-ay', 'dubois': 'doo-bwah', 'moreau': 'mo-roh', 'pablo': 'pah-blo', 'javier': 'hah-vee-air', 'lucía': 'loo-see-ah', 'garcía': 'gar-see-ah', 'fernández': 'fer-nan-dez',
    'lópez': 'lo-pez', 'rinaldi': 'ree-nal-dee', 'matteo': 'mat-tay-oh', 'giulia': 'jool-ya', 'chiara': 'kee-ah-rah', 'bianchi': 'bee-an-kee', 'esposito': 'es-po-zee-to', 'piotr': 'pyotr', 'kacper': 'kats-per',
    'zofia': 'zof-ya', 'kowalczyk': 'ko-val-chick', 'nowak': 'no-vak', 'wiśniewska': 'vish-nyev-skah', 'tiago': 'tee-ah-go', 'rui': 'roo-ee', 'inês': 'ee-nesh', 'ferreira': 'fer-ray-rah',
    'tremblay': 'trom-blay', 'chinedu': 'chee-nay-doo', 'tunde': 'toon-day', 'emeka': 'eh-may-kah', 'adaeze': 'ah-dah-eh-zeh', 'ngozi': 'n-go-zee', 'funmi': 'foon-mee', 'okafor': 'oh-kah-for',
    'adeyemi': 'ah-day-yeh-mee', 'eze': 'eh-zeh', 'kwame': 'kwah-meh', 'kofi': 'ko-fee', 'akosua': 'ah-ko-soo-ah', 'mensah': 'men-sah', 'owusu': 'oh-woo-soo', 'boateng': 'bwah-teng',
    'wanjiru': 'wan-jee-roo', 'akinyi': 'ah-kin-yee', 'otieno': 'oh-tee-eh-no', 'kamau': 'kah-mow', 'mwangi': 'mwahn-gee', 'sipho': 'see-po', 'thabo': 'tah-bo', 'lerato': 'leh-rah-to',
    'zanele': 'zah-neh-leh', 'dlamini': 'dlah-mee-nee', 'nkosi': 'n-ko-see', 'merwe': 'mair-veh', 'arjun': 'ar-joon', 'vikram': 'vik-ram', 'priya': 'pree-yah', 'ananya': 'ah-nun-yah', 'kavya': 'kahv-yah',
    'menon': 'may-non', 'iyer': 'eye-yer', 'qureshi': 'koo-ray-shee', 'ayesha': 'eye-ay-shah', 'haruto': 'hah-roo-to', 'kenji': 'ken-jee', 'yui': 'yoo-ee', 'aoi': 'ah-oh-ee', 'sato': 'sah-to',
    'minjun': 'min-joon', 'jiho': 'jee-ho', 'seoyeon': 'so-yun', 'jiwoo': 'jee-woo', 'wei': 'way', 'hao': 'how', 'minh': 'min', 'duc': 'dook', 'nguyen': 'win', 'pham': 'fam', 'souza': 'so-zah',
    'larissa': 'lah-ris-sah', 'sofía': 'so-fee-ah', 'hernández': 'er-nan-dez', 'ramírez': 'rah-mee-rez', 'yılmaz': 'yil-maz', 'zeynep': 'zay-nep', 'elif': 'eh-leef', 'emre': 'em-reh',
    'youssef': 'yoo-sef', 'nour': 'noor', 'mariam': 'mar-yam', 'yassine': 'yah-seen', 'imane': 'ee-mahn', 'amrani': 'am-rah-nee', 'benali': 'ben-ah-lee', 'lachlan': 'lock-lan', 'nikau': 'nee-kow',
    'aroha': 'ah-ro-hah', 'ngata': 'nah-tah', 'jónas hansen': 'yo-nas han-sen', 'vágar': 'vow-ar', 'fenix': 'fee-nix', 'inibuilds': 'inny-builds', 'daher': 'dah-air', 'cessna': 'sess-nah',
    'havilland': 'havi-land', 'faroe': 'fair-oh', 'keflavík': 'kef-la-vik', 'kastrup': 'kas-troop', 'gardermoen': 'gar-der-mo-en', 'flesland': 'fles-land',
  } as { [k: string]: string },
  // each piece of spelling and its sound, longest first; [American, British]
  RULES: [
    ['tion', 'ʃən', 'ʃən'], ['sion', 'ʒən', 'ʒən'], ['ough', 'O', 'Q'], ['augh', 'ɔ', 'ɔː'], ['eigh', 'A', 'A'], ['igh', 'I', 'I'],
    ['sch', 'ʃ', 'ʃ'], ['tch', 'ʧ', 'ʧ'], ['dg', 'ʤ', 'ʤ'], ['sh', 'ʃ', 'ʃ'], ['ch', 'ʧ', 'ʧ'], ['th', 'θ', 'θ'], ['ph', 'f', 'f'], ['ck', 'k', 'k'], ['ng', 'ŋ', 'ŋ'], ['qu', 'kw', 'kw'], ['wh', 'w', 'w'], ['kn', 'n', 'n'], ['gh', 'ɡ', 'ɡ'],
    ['ee', 'i', 'iː'], ['ea', 'i', 'iː'], ['oo', 'u', 'uː'], ['ou', 'W', 'W'], ['ow', 'W', 'W'], ['ai', 'A', 'A'], ['ay', 'A', 'A'], ['ei', 'A', 'A'], ['ey', 'A', 'A'], ['oa', 'O', 'Q'], ['oe', 'O', 'Q'],
    ['ie', 'i', 'iː'], ['au', 'ɔ', 'ɔː'], ['aw', 'ɔ', 'ɔː'], ['oi', 'Y', 'Y'], ['oy', 'Y', 'Y'], ['ew', 'ju', 'juː'], ['ue', 'u', 'uː'], ['ah', 'ɑ', 'ɑː'], ['oh', 'O', 'Q'], ['ur', 'ɜɹ', 'ɜː'], ['er', 'əɹ', 'ə'], ['ir', 'ɪɹ', 'ɪə'], ['ar', 'ɑɹ', 'ɑː'], ['or', 'ɔɹ', 'ɔː'], ['air', 'ɛɹ', 'ɛː'],
    ['a', 'æ', 'a'], ['e', 'ɛ', 'ɛ'], ['i', 'ɪ', 'ɪ'], ['o', 'ɑ', 'ɒ'], ['u', 'ʌ', 'ʊ'], ['y', 'ɪ', 'ɪ'],
    ['b', 'b', 'b'], ['c', 'k', 'k'], ['d', 'd', 'd'], ['f', 'f', 'f'], ['g', 'ɡ', 'ɡ'], ['h', 'h', 'h'], ['j', 'ʤ', 'ʤ'], ['k', 'k', 'k'], ['l', 'l', 'l'], ['m', 'm', 'm'], ['n', 'n', 'n'], ['p', 'p', 'p'],
    ['r', 'ɹ', 'ɹ'], ['s', 's', 's'], ['t', 't', 't'], ['v', 'v', 'v'], ['w', 'w', 'w'], ['x', 'ks', 'ks'], ['z', 'z', 'z'],
  ] as string[][],
  VOWEL_SOUNDS: /^(æ|a|ɛ|ɪ|ɑ|ɒ|ʌ|ʊ|i|u|A|I|O|Q|W|Y|ɔ|ɜ|ə|ɛ|j?u)/,
  /** Sound out a word by its spelling: a short syllable or a plain spelling-to-sound pass, stress on the first. */
  sound(word: string, ac: Accent): string {
    const uk = ac === 'b';
    let w = word.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ð/g, 'd').replace(/ø/g, 'u').replace(/æ/g, 'a').replace(/å/g, 'o').replace(/ı/g, 'i').replace(/ł/g, 'w').replace(/[^a-z-]/g, '');
    const parts = w.split('-').filter(Boolean);
    return parts.map((p, pi) => {
      // a known word as a syllable ("han", "sen", "ten") keeps its dictionary sound
      const k = p.length > 2 ? this.look(p, ac) : null;
      if (k && pi > 0) return k.replace(/[ˈˌ]/g, '');
      if (k) return k.replace(/ˌ/g, 'ˈ');
      let out = '', i = 0;
      while (i < p.length) {
        // magic e: a-consonant-e at the end of the syllable gives the long vowel
        const me = /^([aeiou])([bcdfgklmnprstvz])e$/.exec(p.slice(i));
        if (me) { const L: any = { a: 'A', e: uk ? 'iː' : 'i', i: 'I', o: uk ? 'Q' : 'O', u: uk ? 'uː' : 'u' }; out += L[me[1]] + this.sound1(me[2], p[i + 3], ac); i += 3; continue; }
        // a vowel at the end of a syllable is long (ko-fee, yo-nas)
        if (/[aeiou]/.test(p[i]) && i === p.length - 1 && p.length > 1) { const L: any = { a: uk ? 'ɑː' : 'ɑ', e: 'A', i: uk ? 'iː' : 'i', o: uk ? 'Q' : 'O', u: uk ? 'uː' : 'u' }; out += L[p[i]]; i++; continue; }
        if (p[i] === 'y' && i === p.length - 1 && i > 0) { out += uk ? 'i' : 'i'; i++; continue; }
        if (p[i] === 'y' && i === 0) { out += 'j'; i++; continue; }
        if (p[i] === 'c' && /[eiy]/.test(p[i + 1] || '')) { out += 's'; i++; continue; }
        let hit = false;
        for (const r of this.RULES) if (p.startsWith(r[0], i)) { out += uk ? r[2] : r[1]; i += r[0].length; hit = true; break; }
        if (!hit) i++;
      }
      // stress on the first vowel of the first part
      const m = this.VOWEL_SOUNDS.exec(out.replace(/^[^æaɛɪɑɒʌʊiuAIOQWYɔɜə]*/, ''));
      const lead = out.match(/^[^æaɛɪɑɒʌʊiuAIOQWYɔɜə]*/)[0];
      return pi === 0 && m ? lead + 'ˈ' + out.slice(lead.length) : out;
    }).join('');
  },
  sound1(c: string, next: string, ac: Accent): string { const r = this.RULES.filter(x => x[0] === c)[0]; return r ? (ac === 'b' ? r[2] : r[1]) : ''; },

  /* ---------- a whole text ---------- */
  /** The phonemes for a text, as the voice model reads them, split into sentences. */
  phonemize(text: string, ac: Accent): string[] {
    const uk = ac === 'b', t = this.normalise(text, uk);
    const sentences = t.match(/[^.!?]+[.!?]*/g) || [t];
    const out: string[] = [];
    for (const s0 of sentences) {
      const s = s0.trim(); if (!s) continue;
      const toks = s.match(/[A-Za-zÀ-ÿĀ-žḀ-ỿðÐøØæÆıłŁ'’]+(?:-[A-Za-zÀ-ÿĀ-žðøæ]+)*|[,.;:!?]/g) || [];
      const ps: string[] = [];
      for (let i = 0; i < toks.length; i++) {
        const w = toks[i];
        if (/^[,.;:!?]$/.test(w)) { if (ps.length) ps[ps.length - 1] += w === ';' || w === ':' ? ',' : w; continue; }
        const next = toks[i + 1] || '';
        ps.push(this.word(w, next, ac));
      }
      const line = ps.join(' ').replace(/\s+/g, ' ').trim();
      if (line) out.push(line);
    }
    return out;
  },
  word(w: string, next: string, ac: Accent): string {
    const lw = w.toLowerCase(), nv = /^[aeiouAEIOU]/.test(next);
    if (lw === 'the') return nv ? 'ði' : 'ðə';
    if (lw === 'a' && w === 'a') return 'ɐ';
    if (lw === 'an') return 'ɐn';
    if (lw === 'to') return nv ? 'tʊ' : 'tə';
    if (lw === 'of') return 'əv';
    if (lw === 'and') return ac === 'b' ? 'ənd' : 'ænd';
    if (/^[A-Z]$/.test(w)) return this.look(w, ac) || this.sound(w, ac);
    const named = this.NAMES[lw];
    if (named && !this.look(w, ac)) return this.sound(named, ac);
    const p = this.look(w, ac) || this.stems(w, ac);
    if (p) return p;
    if (w.indexOf('-') > 0) return w.split('-').map(x => this.word(x, '', ac)).join(' ');
    return this.sound(w, ac);
  },
};
