// Full-body crew avatars: look options, and the drawn front view used where 3D isn't available.
// Every avatar is always fully dressed: each clothing slot always holds a garment,
// and options only swap one complete garment for another.

interface Look {
  sex: 'm' | 'f';
  skin: number;            // index into SKIN_TONES
  face: 'oval' | 'round' | 'square' | 'long';
  eyes: 'almond' | 'round' | 'mono';
  nose: 'narrow' | 'medium' | 'wide';
  lips: 'thin' | 'medium' | 'full';
  hair: string;            // key of HAIR_STYLES
  hairColor: number;       // index into HAIR_COLORS
  facial: string;          // none, stubble, short, full, goatee, vandyke, or a moustache: pencil, chevron, walrus, handlebar, horseshoe
  glasses: 'none' | 'aviator' | 'sunglasses' | 'round' | 'rect';
  top: 'jacket' | 'shirt' | 'pullover' | 'vest' | 'blouse' | 'overalls';
  bottom: 'trousers' | 'skirt' | 'shorts';
  shoes: 'oxford' | 'boots' | 'pumps' | 'sneakers';
  neck: 'tie' | 'scarf' | 'open';
  hat: 'none' | 'cap' | 'pillbox' | 'ball' | 'beret';
  uniform: number;         // index into UNIFORM_COLORS
  voice?: string;          // your own pilot only: the voice you speak with (MY_VOICES in src/core/voice.ts)
}

type CrewRole = 'captain' | 'fo' | 'fa' | 'mech' | 'ground';

const SKIN_TONES = ['#FBE3D0', '#F3CFB3', '#E8B894', '#D9A07A', '#C68A62', '#A86F4C', '#8D5A3B', '#71452D', '#583421', '#3F2618'];
const HAIR_COLORS = ['#1C1714', '#3B2A20', '#5E4330', '#8A6446', '#C9A36A', '#E3D2AE', '#8C3F22', '#B5502A', '#8E9196', '#DCDCDC'];
const UNIFORM_COLORS = ['#1D2D4F', '#1C1F26', '#3A4049', '#5A1F2E', '#2F5D8C', '#1F4A44', '#D9A514', '#D9661F'];   // the last two: hi-vis for ground staff
const UNIFORM_NAMES = ['Navy', 'Black', 'Charcoal', 'Burgundy', 'Sky blue', 'Forest'];
const HAIR_STYLES: { [k: string]: string } = {
  bald: 'Bald', buzz: 'Buzz cut', crop: 'Short crop', side: 'Side part', curly: 'Short curls', afro: 'Afro',
  wavy: 'Wavy', bob: 'Bob', long: 'Long', bun: 'Bun', ponytail: 'Ponytail', braids: 'Braids',
};

function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (f < 0) { r = Math.round(r * (1 + f)); g = Math.round(g * (1 + f)); b = Math.round(b * (1 + f)); }
  else { r = Math.round(r + (255 - r) * f); g = Math.round(g + (255 - g) * f); b = Math.round(b + (255 - b) * f); }
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

/** Make sure a look is complete and dressed, whatever was stored. */
function dressed(l: Look, role: CrewRole): Look {
  const d: Look = Object.assign(defaultLook(l && l.sex || 'm', role), l || {});
  if ((d as any).sec && role === 'ground') { if (d.top === 'overalls' || d.top === 'blouse' || !d.top) d.top = 'jacket'; if (d.bottom === 'shorts') d.bottom = 'trousers'; if (d.hat === 'pillbox') d.hat = 'none'; }   // security officers: their own uniform, not overalls
  else if ((role === 'mech' || role === 'ground')) { d.top = 'overalls'; d.bottom = 'trousers'; if (d.hat === 'pillbox') d.hat = 'none'; }
  if ((role === 'captain' || role === 'fo') && d.hat === 'pillbox') d.hat = 'cap';
  if (d.top === 'overalls') d.bottom = 'trousers';
  if (!d.top) d.top = 'jacket';
  if (!d.bottom) d.bottom = 'trousers';
  if (!d.shoes) d.shoes = 'oxford';
  if (!d.neck) d.neck = 'open';
  // garments follow the person: no skirts, blouses, low heels, scarves or pillbox hats for men,
  // and no men's Oxford shoes for women (they get low heels)
  if (d.sex === 'm') {
    if (d.top === 'blouse') d.top = role === 'fa' ? 'vest' : 'shirt';
    if (d.bottom === 'skirt') d.bottom = 'trousers';
    if (d.shoes === 'pumps') d.shoes = 'oxford';
    if (d.neck === 'scarf') d.neck = 'tie';
    if (d.hat === 'pillbox') d.hat = 'cap';
  } else { if (d.shoes === 'oxford') d.shoes = 'pumps'; d.facial = 'none'; }
  return d;
}

/** Garment choices that suit a man or a woman in a given role (used by the look editor). */
function garmentOptions(sex: 'm' | 'f', role: CrewRole, sec?: boolean) {
  const f = sex === 'f', fa = role === 'fa', mech = (role === 'mech' || role === 'ground');
  // security officers: clothing that shows what they are (the airline's name and SECURITY GUARD printed on it)
  if (sec) return {
    top: [['jacket', 'Smart jacket'], ['shirt', 'Uniform shirt with epaulettes'], ['vest', 'Tactical vest'], ['pullover', 'Jumper']],
    bottom: f ? [['trousers', 'Trousers'], ['skirt', 'Skirt']] : [['trousers', 'Trousers']],
    neck: f ? [['tie', 'Tie'], ['scarf', 'Scarf'], ['open', 'Open collar']] : [['tie', 'Tie'], ['open', 'Open collar']],
    shoes: [['boots', 'Boots'], ['oxford', 'Oxfords'], ['sneakers', 'Sneakers']],
    hat: [['none', 'No hat'], ['cap', 'Peaked security cap'], ['ball', 'Baseball cap'], ['beret', 'Beret']],
  };
  return {
    top: fa ? (f ? [['blouse', 'Blouse'], ['vest', 'Waistcoat'], ['jacket', 'Jacket'], ['pullover', 'Pullover']] : [['vest', 'Waistcoat'], ['jacket', 'Jacket'], ['pullover', 'Pullover']])
      : [['jacket', 'Jacket'], ['shirt', 'Short-sleeve shirt'], ['pullover', 'Pullover']],
    bottom: f ? [['trousers', 'Trousers'], ['skirt', 'Skirt'], ['shorts', 'Shorts']] : [['trousers', 'Trousers'], ['shorts', 'Shorts']],
    neck: f ? [['tie', 'Tie'], ['scarf', 'Scarf'], ['open', 'Open collar']] : [['tie', 'Tie'], ['open', 'Open collar']],
    shoes: f ? [['pumps', 'Low heels'], ['boots', 'Boots'], ['sneakers', 'Sneakers']] : [['oxford', 'Oxfords'], ['boots', 'Boots'], ['sneakers', 'Sneakers']],
    hat: mech ? [['none', 'No hat'], ['cap', 'Cap']] : fa ? (f ? [['none', 'No hat'], ['cap', 'Uniform cap'], ['pillbox', 'Pillbox hat']] : [['none', 'No hat'], ['cap', 'Uniform cap']]) : [['none', 'No hat'], ['cap', 'Pilot\'s cap']],
  };
}

function defaultLook(sex: 'm' | 'f', role: CrewRole): Look {
  const fa = role === 'fa';
  return {
    sex, skin: 2, face: 'oval', eyes: 'almond', nose: 'medium', lips: 'medium',
    hair: sex === 'f' ? (fa ? 'bun' : 'bob') : 'crop', hairColor: 1, facial: 'none', glasses: 'none',
    top: (role === 'mech' || role === 'ground') ? 'overalls' : fa ? (sex === 'f' ? 'blouse' : 'vest') : 'jacket',
    bottom: fa && sex === 'f' ? 'skirt' : 'trousers', shoes: fa && sex === 'f' ? 'pumps' : (role === 'mech' || role === 'ground') ? 'boots' : 'oxford',
    neck: fa ? (sex === 'f' ? 'scarf' : 'tie') : (role === 'mech' || role === 'ground') ? 'open' : 'tie', hat: 'none', uniform: 0,
  };
}

/** Seeded random look, so hired staff always look the same. */
function randomLook(seed: string, sex: 'm' | 'f', role: CrewRole): Look {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  const rnd = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10000) / 10000; };
  const pick = <T>(a: T[]): T => a[Math.floor(rnd() * a.length)];
  const l = defaultLook(sex, role);
  l.skin = Math.floor(rnd() * SKIN_TONES.length);
  l.face = pick(['oval', 'round', 'square', 'long'] as any);
  l.eyes = pick(['almond', 'round', 'mono'] as any);
  l.nose = pick(['narrow', 'medium', 'wide'] as any);
  l.lips = pick(['thin', 'medium', 'full'] as any);
  l.hair = sex === 'f' ? pick(['bob', 'long', 'bun', 'ponytail', 'braids', 'wavy', 'curly', 'afro']) : pick(['crop', 'side', 'buzz', 'curly', 'afro', 'bald', 'wavy', 'crop']);
  l.hairColor = l.skin > 5 ? pick([0, 0, 1, 8]) : pick([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  l.facial = sex === 'm' ? pick(['none', 'none', 'none', 'stubble', 'stubble', 'short', 'full', 'goatee', 'vandyke', 'chevron', 'pencil', 'walrus', 'horseshoe']) : 'none';
  l.glasses = pick(['none', 'none', 'none', 'none', 'aviator', 'round', 'rect', (role === 'captain' || role === 'fo') ? 'sunglasses' : 'none'] as any);
  if (role === 'captain' || role === 'fo') l.top = pick(['jacket', 'jacket', 'shirt', 'pullover'] as any);
  return l;
}

let _avSeq = 0;
/**
 * Render an avatar. view 'full' = head to toe, 'bust' = head and shoulders.
 * company colour is used for the hat badge and scarf/tie accents.
 * Uses the 3D figures where the device can show them (see avatar3d-view.ts), the drawing otherwise.
 */
function avatarSvg(look: Look, role: CrewRole, o?: { view?: 'full' | 'bust'; accent?: string; still?: boolean; cls?: string; mood?: { kind: string; v: number } }): string {
  o = o || {};
  if (av3Supported()) { av3Init(); return avatar3dHtml(look, role, o); }
  return avatarSvg2d(look, role, o);
}

/** The drawn (2D) avatar, used where 3D isn't available. */
function avatarSvg2d(look: Look, role: CrewRole, o?: { view?: 'full' | 'bust'; accent?: string; still?: boolean; cls?: string }): string {
  o = o || {};
  const L = dressed(look, role);
  const facialPick = L.facial;
  L.facial = ['short', 'full', 'goatee', 'vandyke'].indexOf(facialPick) >= 0 ? 'beard' : ['pencil', 'chevron', 'walrus', 'handlebar', 'horseshoe'].indexOf(facialPick) >= 0 ? 'moustache' : facialPick;
  const sun = L.glasses === 'sunglasses'; if (sun) L.glasses = 'aviator';
  const id = 'av' + (++_avSeq);
  const cx = 100;
  const skin = SKIN_TONES[L.skin] || SKIN_TONES[2], skinD = shade(skin, -0.16), skinL = shade(skin, 0.12);
  const hairC = HAIR_COLORS[L.hairColor] || HAIR_COLORS[1], hairD = shade(hairC, -0.25);
  const uni = UNIFORM_COLORS[L.uniform] || UNIFORM_COLORS[0], uniD = shade(uni, -0.3), uniL = shade(uni, 0.12);
  const accent = o.accent || '#2C8CFF';
  const gold = '#E2B657';
  const f = L.sex === 'f';
  const sh = f ? 36 : 43, wh = f ? 24 : 30, hh = f ? 31 : 30, nw = f ? 7 : 9, aw = f ? 12 : 14;
  const fw = { oval: 26, round: 28, square: 27, long: 24 }[L.face] - (f ? 1 : 0);
  const fh = { oval: 32, round: 30, square: 31, long: 35 }[L.face];
  const hy = 64, chin = hy + fh;
  const P = (n: number) => n.toFixed(1);
  const out: string[] = [];
  const stripes = role === 'captain' ? 4 : role === 'fo' ? 3 : 0;

  // ---------- hair behind the head ----------
  const back: { [k: string]: string } = {
    afro: `<ellipse cx="${cx}" cy="${hy - 6}" rx="${fw + 17}" ry="${fh + 12}" fill="${hairC}"/>`,
    long: `<path d="M${cx - fw - 6},${hy - 6} Q${cx - fw - 12},${hy + 60} ${cx - fw - 4},${hy + 92} L${cx + fw + 4},${hy + 92} Q${cx + fw + 12},${hy + 60} ${cx + fw + 6},${hy - 6} Z" fill="${hairD}"/>`,
    wavy: `<path d="M${cx - fw - 6},${hy - 6} Q${cx - fw - 14},${hy + 30} ${cx - fw - 6},${hy + 52} q4,6 0,10 L${cx + fw + 6},${hy + 62} q-4,-4 0,-10 Q${cx + fw + 14},${hy + 30} ${cx + fw + 6},${hy - 6} Z" fill="${hairD}"/>`,
    bob: `<path d="M${cx - fw - 5},${hy - 8} Q${cx - fw - 9},${hy + 20} ${cx - fw - 4},${chin - 2} L${cx + fw + 4},${chin - 2} Q${cx + fw + 9},${hy + 20} ${cx + fw + 5},${hy - 8} Z" fill="${hairD}"/>`,
    bun: `<circle cx="${cx}" cy="${hy - fh - 6}" r="12" fill="${hairC}"/>`,
    ponytail: `<path d="M${cx + fw - 2},${hy - 14} Q${cx + fw + 22},${hy + 4} ${cx + fw + 12},${hy + 60} Q${cx + fw + 6},${hy + 30} ${cx + fw - 6},${hy - 2} Z" fill="${hairD}"/>`,
    braids: [-1, 1].map(s => `<path d="M${cx + s * (fw + 1)},${hy} Q${cx + s * (fw + 6)},${hy + 50} ${cx + s * (fw - 2)},${hy + 98}" stroke="${hairD}" stroke-width="7" fill="none" stroke-linecap="round" stroke-dasharray="7 2"/>`).join(''),
  };

  // ---------- legs and lower garment ----------
  const legY0 = 258, ankle = 396;
  const legL = `M${cx - hh},${legY0} L${cx - 3},${legY0} L${cx - 5},${ankle} L${cx - hh + 9},${ankle} Z`;
  const legR = `M${cx + 3},${legY0} L${cx + hh},${legY0} L${cx + hh - 9},${ankle} L${cx + 5},${ankle} Z`;
  const lower: string[] = [];
  if (L.bottom === 'trousers') {
    const tc = L.top === 'overalls' ? '#55657A' : uniD;
    lower.push(`<path d="${legL}" fill="${tc}"/><path d="${legR}" fill="${tc}"/>`);
    lower.push(`<path d="M${cx - 4},${legY0 + 6} L${cx - 5},${ankle}" stroke="${shade(tc, -0.25)}" stroke-width="1"/>`);
  } else {
    // skin legs, then the garment
    lower.push(`<path d="${legL}" fill="${skinD}"/><path d="${legR}" fill="${skinD}"/>`);
    if (L.bottom === 'shorts') lower.push(`<path d="M${cx - hh - 1},${legY0 - 4} L${cx + hh + 1},${legY0 - 4} L${cx + hh + 1},${legY0 + 46} L${cx + 4},${legY0 + 46} L${cx},${legY0 + 12} L${cx - 4},${legY0 + 46} L${cx - hh - 1},${legY0 + 46} Z" fill="${uniD}"/>`);
    else lower.push(`<path d="M${cx - hh},${legY0 - 8} L${cx + hh},${legY0 - 8} L${cx + hh + 7},${legY0 + 62} L${cx - hh - 7},${legY0 + 62} Z" fill="${uniD}"/><path d="M${cx},${legY0 + 20} L${cx},${legY0 + 62}" stroke="${shade(uniD, -0.3)}" stroke-width="1"/>`);
  }
  // shoes
  const shoe = (s: number) => {
    const x = cx + s * (hh / 2 + 1);
    if (L.shoes === 'boots') return `<path d="M${x - 9},${ankle - 22} L${x + 8},${ankle - 22} L${x + 9},${ankle + 10} Q${x + s * 14},${ankle + 11} ${x + s * 14},${ankle + 18} L${x - 10},${ankle + 18} Z" fill="#3B2B22"/>`;
    if (L.shoes === 'pumps') return `<path d="M${x - 7},${ankle + 2} Q${x},${ankle - 2} ${x + 7},${ankle + 2} Q${x + s * 12},${ankle + 10} ${x + s * 11},${ankle + 15} L${x - s * 9},${ankle + 15} L${x - s * 9},${ankle + 8} Z" fill="#14161B"/>`;
    if (L.shoes === 'sneakers') return `<path d="M${x - 10},${ankle - 2} L${x + 9},${ankle - 2} Q${x + s * 16},${ankle + 6} ${x + s * 15},${ankle + 15} L${x - s * 11},${ankle + 15} Z" fill="#F2F4F7"/><path d="M${x - 9},${ankle + 11} L${x + s * 14},${ankle + 11}" stroke="${accent}" stroke-width="2"/>`;
    return `<path d="M${x - 9},${ankle - 1} L${x + 8},${ankle - 1} Q${x + s * 15},${ankle + 5} ${x + s * 14},${ankle + 15} L${x - s * 10},${ankle + 15} Z" fill="#111317"/><path d="M${x - 6},${ankle + 3} q6,-3 12,0" stroke="#3A3F48" stroke-width="1" fill="none"/>`;
  };
  lower.push(shoe(-1), shoe(1));

  // ---------- torso garment ----------
  const torso = `M${cx - nw - 5},106 L${cx - sh + 7},110 Q${cx - sh},112 ${cx - sh},124 L${cx - wh},236 L${cx - hh - 1},264 L${cx + hh + 1},264 L${cx + wh},236 L${cx + sh},124 Q${cx + sh},112 ${cx + sh - 7},110 L${cx + nw + 5},106 Z`;
  const top: string[] = [];
  const long = L.top !== 'shirt';
  const sleeveColor = { jacket: uni, shirt: '#F4F6F9', pullover: uni, vest: '#F4F6F9', blouse: f ? shade(accent, 0.55) : '#F4F6F9', overalls: '#55657A' }[L.top];
  const bodyColor = { jacket: uni, shirt: '#F4F6F9', pullover: uni, vest: uni, blouse: sleeveColor, overalls: '#55657A' }[L.top];
  // arms: sleeve then hands
  const arm = (s: number) => {
    const x0 = cx + s * sh, x1 = cx + s * (sh + 5), xi0 = cx + s * (sh - aw), xi1 = cx + s * (sh + 5 - aw);
    const sleeveEnd = long ? 250 : 160;
    const kx = (y: number, a: number, b: number) => a + (b - a) * (y - 120) / 130;
    const sleeve = `M${x0},118 L${kx(sleeveEnd, x0, x1)},${sleeveEnd} L${kx(sleeveEnd, xi0, xi1)},${sleeveEnd} L${xi0},132 Z`;
    let s1 = `<path d="${sleeve}" fill="${sleeveColor}" stroke="${shade(sleeveColor, -0.22)}" stroke-width=".8"/>`;
    if (!long) s1 = `<path d="M${kx(156, x0, x1)},156 L${x1},252 L${xi1},252 L${kx(156, xi0, xi1)},156 Z" fill="${skin}"/>` + s1;
    if (L.top === 'jacket' && stripes) for (let i = 0; i < stripes; i++) s1 += `<path d="M${kx(238 - i * 4, x0, x1)},${238 - i * 4} L${kx(238 - i * 4, xi0, xi1)},${238 - i * 4}" stroke="${gold}" stroke-width="1.8"/>`;
    if (L.top === 'overalls') s1 += `<path d="M${kx(200, x0, x1)},200 L${kx(200, xi0, xi1)},200" stroke="#E8EAE0" stroke-width="3"/>`;
    const hx = cx + s * (sh + 5 - aw / 2);
    return s1 + `<ellipse cx="${hx}" cy="259" rx="${aw / 2 + 1.5}" ry="9.5" fill="${skin}"/><path d="M${hx - s * 3},252 l${s * 1},12" stroke="${skinD}" stroke-width=".8"/>`;
  };
  top.push(arm(-1), arm(1));
  top.push(`<path d="${torso}" fill="${bodyColor}" stroke="${shade(bodyColor, -0.25)}" stroke-width=".8"/>`);
  // collar area and neckwear
  const vY = L.top === 'jacket' ? 168 : L.top === 'pullover' ? 150 : 132;
  if (L.top !== 'overalls') {
    top.push(`<path d="M${cx - nw - 5},106 L${cx},${vY} L${cx + nw + 5},106 Z" fill="#F4F6F9"/>`);
  } else {
    top.push(`<path d="M${cx - nw - 4},106 L${cx},128 L${cx + nw + 4},106 Z" fill="${shade('#55657A', -0.2)}"/>`);
  }
  if (L.neck === 'tie' && L.top !== 'overalls') top.push(`<path d="M${cx - 4},112 L${cx + 4},112 L${cx + 3},116 L${cx + 6},${vY - 4} L${cx},${vY + 2} L${cx - 6},${vY - 4} L${cx - 3},116 Z" fill="${L.top === 'shirt' ? uni : '#14161B'}"/>`);
  if (L.neck === 'scarf' && L.top !== 'overalls') top.push(`<path d="M${cx - nw - 4},106 Q${cx},118 ${cx + nw + 4},106 L${cx + nw + 2},114 Q${cx},126 ${cx - nw - 2},114 Z" fill="${accent}"/><path d="M${cx + 4},118 L${cx + 14},138 L${cx + 6},140 Z" fill="${shade(accent, -0.15)}"/>`);
  // garment details
  if (L.top === 'jacket') {
    top.push(`<path d="M${cx - nw - 5},106 L${cx - 14},164 L${cx},${vY + 2} M${cx + nw + 5},106 L${cx + 14},164 L${cx},${vY + 2}" stroke="${uniD}" stroke-width="1.6" fill="none"/>`);
    top.push(`<path d="M${cx},${vY} L${cx},262" stroke="${uniD}" stroke-width="1"/>`);
    for (const y of [190, 214, 238]) top.push(`<circle cx="${cx + 5}" cy="${y}" r="2" fill="${gold}"/>`);
    top.push(`<path d="M${cx - wh - 2},226 L${cx - 8},226" stroke="${uniD}" stroke-width="1"/>`);
  }
  if (L.top === 'shirt') {
    top.push(`<path d="M${cx},116 L${cx},262" stroke="#D5DAE1" stroke-width="1"/><path d="M${cx - wh + 2},240 L${cx + wh - 2},240" stroke="#12141A" stroke-width="5"/>`);
    top.push(`<rect x="${cx - 20}" y="140" width="13" height="15" rx="2" fill="none" stroke="#D5DAE1"/>`);
  }
  if (L.top === 'pullover') top.push(`<path d="M${cx - wh},236 L${cx + wh},236" stroke="${uniD}" stroke-width="5"/><path d="M${cx - nw - 5},106 L${cx},${vY} L${cx + nw + 5},106" stroke="${uniD}" stroke-width="3" fill="none"/>`);
  if (L.top === 'vest') top.push(`<path d="M${cx - sh + 10},114 L${cx - wh + 2},236 L${cx + wh - 2},236 L${cx + sh - 10},114 L${cx + 8},116 L${cx},150 L${cx - 8},116 Z" fill="${uni}"/>` + [170, 196, 222].map(y => `<circle cx="${cx}" cy="${y}" r="1.8" fill="${gold}"/>`).join(''));
  if (L.top === 'blouse') top.push(`<path d="M${cx - wh},234 L${cx + wh},234" stroke="${uniD}" stroke-width="5"/>`);
  if (L.top === 'overalls') {
    top.push(`<path d="M${cx - sh + 6},116 L${cx - wh + 2},230 L${cx + wh - 2},230 L${cx + sh - 6},116 L${cx + 12},112 L${cx},140 L${cx - 12},112 Z" fill="#E9C02A"/>`);
    top.push(`<path d="M${cx - wh + 1},178 L${cx + wh - 1},178 M${cx - wh},196 L${cx + wh},196" stroke="#E8EAE0" stroke-width="4"/>`);
    top.push(`<rect x="${cx - 16}" y="150" width="14" height="10" rx="2" fill="#F4F6F9"/><path d="M${cx},140 L${cx},262" stroke="#47566A" stroke-width="1.2"/>`);
  }
  // epaulettes and wings for pilots
  if ((L.top === 'shirt' || L.top === 'pullover') && stripes) for (const s of [-1, 1]) {
    top.push(`<rect x="${cx + s * (sh - 12) - 7}" y="108" width="14" height="9" rx="2" fill="${uniD}"/>`);
    for (let i = 0; i < stripes; i++) top.push(`<path d="M${cx + s * (sh - 12) - 6},${109.5 + i * 2.1} l12,0" stroke="${gold}" stroke-width="1.1"/>`);
  }
  if (role === 'captain' || role === 'fo') top.push(`<path d="M${cx + 10},148 l16,0 m-8,-3 l0,6" stroke="${gold}" stroke-width="2.2" stroke-linecap="round"/>`);
  if (role === 'fa') top.push(`<path d="M${cx + 12},148 l10,0" stroke="${gold}" stroke-width="2" stroke-linecap="round"/>`);

  // ---------- neck, head, face ----------
  const head: string[] = [];
  head.push(`<path d="M${cx - nw},${chin - 10} L${cx - nw},110 Q${cx},116 ${cx + nw},110 L${cx + nw},${chin - 10} Z" fill="${skinD}"/>`);
  head.push(`<ellipse cx="${cx - fw}" cy="${hy + 2}" rx="4.5" ry="7" fill="${skinD}"/><ellipse cx="${cx + fw}" cy="${hy + 2}" rx="4.5" ry="7" fill="${skinD}"/>`);
  const faceP = L.face === 'square'
    ? `M${cx - fw},${hy - fh + 10} Q${cx - fw},${hy - fh} ${cx},${hy - fh} Q${cx + fw},${hy - fh} ${cx + fw},${hy - fh + 10} L${cx + fw},${hy + 12} Q${cx + fw - 2},${chin - 2} ${cx},${chin} Q${cx - fw + 2},${chin - 2} ${cx - fw},${hy + 12} Z`
    : `M${cx},${hy - fh} C${cx + fw * 1.33},${hy - fh} ${cx + fw * 1.1},${hy + fh * (L.face === 'round' ? 0.95 : 0.7)} ${cx},${chin} C${cx - fw * 1.1},${hy + fh * (L.face === 'round' ? 0.95 : 0.7)} ${cx - fw * 1.33},${hy - fh} ${cx},${hy - fh} Z`;
  head.push(`<path d="${faceP}" fill="${skin}"/>`);
  head.push(`<path d="${faceP}" fill="url(#${id}fs)"/>`);
  // eyes
  const ey = hy - 1, ex = 10.5;
  for (const s of [-1, 1]) {
    const x = cx + s * ex;
    if (L.eyes === 'round') head.push(`<ellipse cx="${x}" cy="${ey}" rx="4" ry="3.6" fill="#FFFFFF"/><circle cx="${x}" cy="${ey + .3}" r="2.3" fill="#2A1E18"/>`);
    else if (L.eyes === 'mono') head.push(`<path d="M${x - 4.5},${ey} Q${x},${ey - 3} ${x + 4.5},${ey} Q${x},${ey + 2.2} ${x - 4.5},${ey} Z" fill="#FFFFFF"/><circle cx="${x}" cy="${ey}" r="1.9" fill="#2A1E18"/><path d="M${x - 4.8},${ey - .4} Q${x},${ey - 3.2} ${x + 4.8},${ey - .4}" stroke="${skinD}" stroke-width="1.4" fill="none"/>`);
    else head.push(`<path d="M${x - 4.8},${ey} Q${x},${ey - 4.2} ${x + 4.8},${ey} Q${x},${ey + 3} ${x - 4.8},${ey} Z" fill="#FFFFFF"/><circle cx="${x}" cy="${ey}" r="2.2" fill="#2A1E18"/>`);
    head.push(`<circle cx="${x + .8}" cy="${ey - .8}" r=".7" fill="#FFFFFF"/>`);
    // eyelids for blinking
    head.push(`<rect class="lid" x="${x - 5.5}" y="${ey - 4.5}" width="11" height="9" fill="${skin}"/>`);
    head.push(`<path d="M${x - 5},${ey - 7.5} Q${x},${ey - 10.5} ${x + 5},${ey - 7.5}" stroke="${hairD}" stroke-width="${f ? 1.5 : 2.2}" fill="none" stroke-linecap="round"/>`);
  }
  // nose
  const nb = { narrow: 3, medium: 4.5, wide: 6.5 }[L.nose];
  head.push(`<path d="M${cx - 1},${hy + 1} Q${cx - 2},${hy + 9} ${cx - nb},${hy + 11} Q${cx},${hy + 13.5} ${cx + nb},${hy + 11}" stroke="${skinD}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`);
  // mouth
  const lw = { thin: 6, medium: 7, full: 7.5 }[L.lips], lh = { thin: 1.6, medium: 2.6, full: 3.6 }[L.lips];
  const lipC = shade(skin, L.skin > 5 ? -0.28 : -0.2);
  head.push(`<path d="M${cx - lw},${hy + 18} Q${cx},${hy + 18 - lh} ${cx + lw},${hy + 18} Q${cx},${hy + 18 + lh * 1.3} ${cx - lw},${hy + 18} Z" fill="${lipC}"/><path d="M${cx - lw},${hy + 18} Q${cx},${hy + 19.8} ${cx + lw},${hy + 18}" stroke="${shade(lipC, -0.35)}" stroke-width=".9" fill="none"/>`);
  // facial hair
  if (L.facial === 'stubble') head.push(`<path d="M${cx - fw + 2},${hy + 6} Q${cx - fw + 4},${chin - 4} ${cx},${chin} Q${cx + fw - 4},${chin - 4} ${cx + fw - 2},${hy + 6} Q${cx},${hy + 26} ${cx - fw + 2},${hy + 6} Z" fill="${hairC}" opacity=".22"/>`);
  if (L.facial === 'beard') head.push(`<path d="M${cx - fw},${hy + 2} Q${cx - fw + 1},${chin + 4} ${cx},${chin + 7} Q${cx + fw - 1},${chin + 4} ${cx + fw},${hy + 2} L${cx + fw - 4},${hy + 8} Q${cx + 8},${hy + 15} ${cx},${hy + 15} Q${cx - 8},${hy + 15} ${cx - fw + 4},${hy + 8} Z" fill="${hairC}"/><path d="M${cx - 6},${hy + 21} Q${cx},${hy + 23} ${cx + 6},${hy + 21}" stroke="${lipC}" stroke-width="2" fill="none"/>`);
  if (L.facial === 'moustache') head.push(`<path d="M${cx - 8},${hy + 16} Q${cx - 4},${hy + 12} ${cx},${hy + 14} Q${cx + 4},${hy + 12} ${cx + 8},${hy + 16} Q${cx},${hy + 16.5} ${cx - 8},${hy + 16} Z" fill="${hairC}"/>`);

  // front hair
  const front: string[] = [];
  const capPath = (topY: number, line: number, side: number, wide: number) =>
    `M${cx - fw - wide},${hy + side} C${cx - fw - wide - 2},${topY + 10} ${cx - 14},${topY} ${cx},${topY} C${cx + 14},${topY} ${cx + fw + wide + 2},${topY + 10} ${cx + fw + wide},${hy + side} L${cx + fw - 1},${hy - 8} Q${cx + 6},${line - 2} ${cx},${line} Q${cx - 10},${line - 2} ${cx - fw + 1},${hy - 8} Z`;
  const tY = hy - fh - 3;
  switch (L.hair) {
    case 'buzz': front.push(`<path d="${capPath(tY + 2, hy - fh + 9, -10, 0)}" fill="${hairC}" opacity=".55"/>`); break;
    case 'crop': front.push(`<path d="${capPath(tY, hy - fh + 10, -6, 1)}" fill="${hairC}"/>`); break;
    case 'side': front.push(`<path d="${capPath(tY - 3, hy - fh + 11, -4, 2)}" fill="${hairC}"/><path d="M${cx - 8},${tY} Q${cx + 6},${tY + 6} ${cx + fw},${hy - 12}" stroke="${hairD}" stroke-width="1.5" fill="none"/>`); break;
    case 'curly': front.push(`<path d="${capPath(tY, hy - fh + 10, -6, 2)}" fill="${hairC}"/>` + Array.from({ length: 9 }, (_, i) => `<circle cx="${cx - fw + i * fw / 4}" cy="${tY + 4 + Math.abs(4 - i) * 1.6}" r="6" fill="${hairC}"/>`).join('')); break;
    case 'afro': front.push(`<path d="${capPath(tY - 8, hy - fh + 10, -4, 6)}" fill="${hairC}"/>`); break;
    case 'wavy': front.push(`<path d="${capPath(tY - 2, hy - fh + 12, 4, 4)}" fill="${hairC}"/><path d="M${cx - fw - 4},${hy - 4} q4,10 0,20 M${cx + fw + 4},${hy - 4} q-4,10 0,20" stroke="${hairC}" stroke-width="5" fill="none"/>`); break;
    case 'bob': front.push(`<path d="${capPath(tY - 2, hy - fh + 13, 8, 5)}" fill="${hairC}"/><path d="M${cx - fw - 5},${hy + 4} L${cx - fw - 3},${chin - 4} M${cx + fw + 5},${hy + 4} L${cx + fw + 3},${chin - 4}" stroke="${hairC}" stroke-width="6" stroke-linecap="round"/>`); break;
    case 'long': front.push(`<path d="${capPath(tY - 2, hy - fh + 12, 10, 5)}" fill="${hairC}"/><path d="M${cx - fw - 5},${hy} Q${cx - fw - 7},${hy + 40} ${cx - fw - 2},${hy + 80} M${cx + fw + 5},${hy} Q${cx + fw + 7},${hy + 40} ${cx + fw + 2},${hy + 80}" stroke="${hairC}" stroke-width="7" fill="none" stroke-linecap="round"/>`); break;
    case 'bun': case 'ponytail': case 'braids': front.push(`<path d="${capPath(tY, hy - fh + 10, -2, 1)}" fill="${hairC}"/><path d="M${cx},${tY + 1} Q${cx + 3},${tY + 8} ${cx + 1},${hy - fh + 10}" stroke="${hairD}" stroke-width="1" fill="none"/>`); break;
    default: break; // bald
  }
  // glasses
  if (L.glasses !== 'none') {
    const gs = L.glasses === 'aviator'
      ? [-1, 1].map(s => `<path d="M${cx + s * 3},${ey - 4} L${cx + s * 15},${ey - 4} Q${cx + s * 16},${ey + 6} ${cx + s * 10},${ey + 7} Q${cx + s * 3},${ey + 6} ${cx + s * 3},${ey - 4} Z" fill="${sun ? '#22302a' : '#3B4656'}" fill-opacity="${sun ? '.88' : '.35'}" stroke="#B8A06A" stroke-width="1.2"/>`).join('')
      : L.glasses === 'round' ? [-1, 1].map(s => `<circle cx="${cx + s * ex}" cy="${ey}" r="6" fill="none" stroke="#2A2D33" stroke-width="1.5"/>`).join('')
        : [-1, 1].map(s => `<rect x="${cx + s * ex - 6.5}" y="${ey - 4.5}" width="13" height="9" rx="2" fill="none" stroke="#2A2D33" stroke-width="1.6"/>`).join('');
    front.push(gs + `<path d="M${cx - 3.5},${ey - 1} Q${cx},${ey - 3} ${cx + 3.5},${ey - 1}" stroke="#2A2D33" stroke-width="1.2" fill="none"/>`);
  }
  // hats
  if (L.hat === 'cap') front.push(`<path d="M${cx - fw - 5},${hy - fh + 6} Q${cx - fw - 8},${tY - 18} ${cx},${tY - 20} Q${cx + fw + 8},${tY - 18} ${cx + fw + 5},${hy - fh + 6} Z" fill="${uni}"/><path d="M${cx - fw - 5},${hy - fh + 2} L${cx + fw + 5},${hy - fh + 2} L${cx + fw + 4},${hy - fh + 8} L${cx - fw - 4},${hy - fh + 8} Z" fill="${role === 'captain' ? gold : uniD}"/><path d="M${cx - fw - 3},${hy - fh + 8} Q${cx},${hy - fh + 16} ${cx + fw + 3},${hy - fh + 8} Z" fill="#101216"/>${starBadge(cx, tY - 6, 5, accent)}`);
  if (L.hat === 'pillbox') front.push(`<path d="M${cx - 14},${tY + 2} L${cx - 13},${tY - 12} Q${cx},${tY - 16} ${cx + 13},${tY - 12} L${cx + 14},${tY + 2} Q${cx},${tY + 5} ${cx - 14},${tY + 2} Z" fill="${uni}" transform="rotate(-8 ${cx} ${tY})"/>${starBadge(cx - 2, tY - 5, 3.5, accent)}`);

  const anim = o.still ? '' : `style="animation-delay:${(-Math.random() * 5).toFixed(2)}s"`;
  const vb = o.view === 'bust' ? `${cx - 50} 2 100 120` : '0 0 200 424';
  return `<svg class="av ${o.view === 'bust' ? 'bust' : ''} ${o.still ? 'still' : ''} ${o.cls || ''}" viewBox="${vb}" role="img" aria-label="Crew avatar" preserveAspectRatio="xMidYMax meet">
    <defs><radialGradient id="${id}fs" cx=".42" cy=".38" r=".75"><stop offset="0" stop-color="${skinL}" stop-opacity=".55"/><stop offset=".7" stop-color="${skin}" stop-opacity="0"/><stop offset="1" stop-color="${skinD}" stop-opacity=".45"/></radialGradient></defs>
    ${o.view === 'bust' ? '' : `<ellipse cx="${cx}" cy="414" rx="42" ry="6" fill="#000" opacity=".28"/>`}
    <g class="sway" ${anim}>
      ${back[L.hair] || ''}
      <g class="breath" ${anim}>${lower.join('')}${top.join('')}</g>
      <g class="headg" ${anim}>${head.join('')}${front.join('')}</g>
    </g></svg>`;
}

function starBadge(x: number, y: number, r: number, c: string): string {
  return `<path d="M${x},${y - r} L${x + r * .25},${y - r * .25} L${x + r},${y} L${x + r * .25},${y + r * .25} L${x},${y + r} L${x - r * .25},${y + r * .25} L${x - r},${y} L${x - r * .25},${y - r * .25} Z" fill="#E2B657"/><circle cx="${x}" cy="${y}" r="${r * .22}" fill="${c}"/>`;
}
