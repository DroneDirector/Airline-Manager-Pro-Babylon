// Look editor: create or change a crew member's appearance, identity and clothing.
// Clothing options only swap complete garments, so an avatar is always fully dressed.

interface LookEditOpts {
  title: string; role: CrewRole; look: Look; identity?: { name: string; dob: string; nat: string };
  sexOnly?: boolean; confirmName?: string; difficulty?: boolean; onAccept: (look: Look, identity?: { name: string; dob: string; nat: string }) => void;
}

let _le: { o: LookEditOpts; look: Look; id: { name: string; dob: string; nat: string }; tab: string; cam: string; pet?: Pet; who?: 'me' | 'partner'; me?: Look; partner?: any; fam?: { married: boolean; name: string; kids: number } } = null;

/* ---------- your family: your partner (your wife, or your husband if you are a woman), on the photo in your office ---------- */
const FAM_H: { [s: string]: number } = { m: 178, f: 166 };
/** Your partner's look: the one you chose, or one made up for you; always the other sex to yours, in their own clothes. */
function familyPartner(mySex: string, base?: string): any {
  const S: any = State, want = mySex === 'f' ? 'm' : 'f';
  let L: any = S.family && S.family.partner;
  if (!L || L.sex !== want) {
    const old = L; L = Object.assign(ctLook('partner-' + (base || 'me') + want, want as any, 'public'), { top: want === 'f' ? 'blouse' : 'shirt' });
    if (old) { L.skin = old.skin; L.height = FAM_H[want] + ((old.height || FAM_H[old.sex]) - FAM_H[old.sex]); }   // keep the skin and how tall they are for one of their sex
  }
  L = Object.assign({}, L, { civil: true, hat: 'none', neck: 'open', bottom: 'trousers' });
  if (!L.height) L.height = FAM_H[want];
  return L;
}
/** Your family as you chose it: married or not (married unless you said otherwise), your partner's name, children. */
function familyInfo(): { married: boolean; name: string; kids: number } {
  const F: any = (State as any).family || {};
  return { married: F.married !== false, name: String(F.partnerName || ''), kids: F.kids == null ? 2 : clamp(Math.round(+F.kids), 0, 3) };
}
function famHeightHtml(L: any): string {
  const h = Math.round(L.height || FAM_H[L.sex === 'f' ? 'f' : 'm']), ft = h / 30.48, fi = Math.floor(ft), inch = Math.round((ft - fi) * 12);
  return `<div class="le-group"><b>Height</b><div class="le-height"><input type="range" min="145" max="205" step="1" value="${h}" data-le-height aria-label="Height in centimetres"><span data-le-hv>${h} cm · ${fi}′${inch}″</span></div></div>`;
}

const LE_TABS = [['person', 'Person'], ['face', 'Face'], ['hair', 'Hair'], ['outfit', 'Outfit']];

function openLookEditor(o: LookEditOpts) {
  _le = { o, look: JSON.parse(JSON.stringify(dressed(o.look, o.role))), id: o.identity ? Object.assign({}, o.identity) : null, tab: o.identity ? 'person' : 'face', cam: 'full' };
  if (o.identity) { _le.fam = familyInfo(); _le.pet = JSON.parse(JSON.stringify(petData())); _le.who = 'me'; _le.partner = familyPartner(_le.look.sex, (myPilot() || {} as any).id); if (!(_le.look as any).height) (_le.look as any).height = FAM_H[_le.look.sex === 'f' ? 'f' : 'm']; }   // your own pilot: your partner and your pet too
  if (o.sexOnly) _le.tab = 'person';
  _le.cam = leCamForTab(_le.tab);
  openLayer('modal', lookEditorHtml(), { cls: 'full look-pop' });
}

/** Where the editor's camera looks: the face for the face and hair, the whole person for the outfit,
 *  and while changing one thing, at that thing (hats and glasses: the face; shoes: the feet; neckwear: head and shoulders). */
function leCamForTab(t: string): string { return t === 'face' || t === 'hair' ? 'face' : 'full'; }
function leCamForKey(k: string): string {
  if (/^(face|eyes|nose|lips|facial|glasses|hat|hair|hairColor)$/.test(k)) return 'face';
  if (k === 'shoes') return 'feet';
  if (k === 'neck') return 'bust';
  return 'full';
}
/** Married or not, and children: what the photo on your office desk shows follows it. */
function leFamilyHtml(): string {
  const F = _le.fam, w = lePartnerWord(), pet = _le.pet && _le.pet.kind !== 'none';
  const shows = F.married ? `You, your ${w}${F.kids ? ' and your ' + (F.kids === 1 ? 'child' : F.kids === 2 ? 'two children' : 'three children') : ''}` : pet ? `Your ${_le.pet.kind === 'cat' ? 'cat' : 'dog'}${_le.pet.name ? ', ' + _le.pet.name : ''}` : 'You, on your first day in the job';
  return `<div class="le-group"><b>Family</b>${leChoiceAct('le-fam', 'married', [['yes', 'Married'], ['no', 'Not married']], F.married ? 'yes' : 'no')}</div>
    ${F.married ? `<div class="le-group"><b>Children</b>${leChoiceAct('le-fam', 'kids', [['0', 'None'], ['1', 'One'], ['2', 'Two'], ['3', 'Three']], String(F.kids))}</div>` : ''}
    <p class="muted le-fam-note">The photo on your office desk: ${esc(shows)}. Edit your ${w} with the switch at the top.</p>`;
}
function leChoiceAct(act: string, k: string, opts: string[][], cur: string): string { return `<div class="le-opts">${opts.map(o => `<button class="le-opt ${o[0] === cur ? 'on' : ''}" data-act="${act}" data-k="${k}" data-v="${o[0]}">${o[1]}</button>`).join('')}</div>`; }
function leFigHtml(): string { return avatarSvg(_le.look, _le.who === 'partner' ? 'fa' : _le.o.role, { accent: company().color, cls: 'hero' }).replace('<canvas ', `<canvas data-cam="${_le.cam}" `); }
function lePartnerWord(): string { return _le.partner && _le.partner.sex === 'm' ? 'husband' : 'wife'; }

function leChoice(key: string, opts: string[][], cur: any): string {
  return `<div class="le-opts">${opts.map(op => `<button class="le-opt ${String(cur) === op[0] ? 'on' : ''}" data-act="le-set" data-k="${key}" data-v="${op[0]}">${op[1]}</button>`).join('')}</div>`;
}
function leSwatches(key: string, colors: string[], cur: number): string {
  return `<div class="le-sw">${colors.map((c, i) => `<button class="sw ${cur === i ? 'on' : ''}" style="--c:${c}" data-act="le-set" data-k="${key}" data-v="${i}" aria-label="Colour ${i + 1}"></button>`).join('')}</div>`;
}

function lookEditorBody(): string {
  const L = _le.look, role = _le.o.role, id = _le.id, t = _le.tab;
  if (_le.o.sexOnly) {
    return `<div class="le-group"><b>Male or female</b><p class="muted">The rest of the look and the uniform are chosen automatically.</p>${leChoice('sex', [['m', 'Male'], ['f', 'Female']], L.sex)}</div>
      ${role === 'captain' || role === 'fo' ? `<div class="le-group"><b>Pilot's cap</b>${leChoice('hat', [['none', 'No cap'], ['cap', 'Wear the cap']], L.hat)}</div>` : ''}
      <div class="le-group"><button class="btn ghost" data-act="le-shuffle">${icon('sync')}Another person</button></div>`;
  }
  if (_le.who === 'partner') {
    if (t === 'face' || t === 'hair') { /* the same as yours, below */ }
    else return `<div class="le-group"><b>Your ${lePartnerWord()}</b><p class="muted">With you${_le.fam && _le.fam.kids ? ` and your ${_le.fam.kids === 1 ? 'child' : _le.fam.kids === 2 ? 'two children' : 'three children'}` : ''} on the family photo on your desk. ${_le.partner.sex === 'm' ? 'He' : 'She'} is always the other sex to you: change yours and your ${lePartnerWord()} changes with it.</p></div>
      <div class="le-group"><b>${_le.partner.sex === 'm' ? 'His' : 'Her'} name</b><input class="le-in" data-le-pname value="${esc(_le.fam ? _le.fam.name : '')}" maxlength="40" autocomplete="off" placeholder="${_le.partner.sex === 'm' ? 'Daniel' : 'Anna'}"></div>
      <div class="le-group"><b>Skin tone</b>${leSwatches('skin', SKIN_TONES, L.skin)}</div>
      ${famHeightHtml(L)}
      <div class="le-group"><button class="btn ghost" data-act="le-shuffle">${icon('sync')}Another look</button></div>`;
  }
  if (t === 'person') return `
    ${_le.o.difficulty ? `<div class="le-group"><b>Difficulty</b><p class="muted">How hard the game is: prices, earnings, costs and loans. You can change it later in Settings.</p>${difficultyPickHtml(_fsDiff, 'ng-diff')}</div>` : ''}
    ${id ? `<div class="le-group"><b>Name</b><input class="le-in" data-le-name value="${esc(id.name)}" maxlength="40" autocomplete="off"></div>
    <div class="le-row2">
      <div class="le-group"><b>Date of birth</b><input class="le-in" type="date" data-le-dob value="${esc(id.dob)}" min="1940-01-01" max="2008-12-31"></div>
      <div class="le-group"><b>Nationality</b><select class="le-in" data-le-nat>${countriesSorted().map(c => `<option value="${c[0]}" ${c[0] === id.nat ? 'selected' : ''}>${flag(c[0])} ${esc(c[1])}</option>`).join('')}</select></div>
    </div>` : ''}
    <div class="le-group"><b>Male or female</b>${leChoice('sex', [['m', 'Male'], ['f', 'Female']], L.sex)}</div>
    <div class="le-group"><b>Skin tone</b>${leSwatches('skin', SKIN_TONES, L.skin)}</div>
    ${id ? famHeightHtml(L) : ''}
    ${id ? leVoiceHtml(L) : ''}
    ${id && _le.fam ? leFamilyHtml() : ''}`;
  if (t === 'pet' && _le.pet) return petEditorHtml(_le.pet);
  if (t === 'face') return `
    <div class="le-group"><b>Face shape</b>${leChoice('face', [['oval', 'Oval'], ['round', 'Round'], ['square', 'Square'], ['long', 'Long']], L.face)}</div>
    <div class="le-group"><b>Eyes</b>${leChoice('eyes', [['almond', 'Almond'], ['round', 'Round'], ['mono', 'Monolid']], L.eyes)}</div>
    <div class="le-group"><b>Nose</b>${leChoice('nose', [['narrow', 'Narrow'], ['medium', 'Medium'], ['wide', 'Wide']], L.nose)}</div>
    <div class="le-group"><b>Lips</b>${leChoice('lips', [['thin', 'Thin'], ['medium', 'Medium'], ['full', 'Full']], L.lips)}</div>
    ${L.sex === 'm' ? `<div class="le-group"><b>Beard</b>${leChoice('facial', [['none', 'None'], ['stubble', 'Stubble'], ['short', 'Short beard'], ['full', 'Full beard'], ['goatee', 'Goatee'], ['vandyke', 'Van Dyke']], L.facial === 'beard' ? 'short' : L.facial)}</div>
    <div class="le-group"><b>Moustache</b>${leChoice('facial', [['pencil', 'Pencil'], ['chevron', 'Chevron'], ['walrus', 'Walrus'], ['handlebar', 'Handlebar'], ['horseshoe', 'Horseshoe']], L.facial === 'moustache' ? 'chevron' : L.facial)}</div>` : ''}
    <div class="le-group"><b>Glasses</b>${leChoice('glasses', [['none', 'No glasses'], ['rect', 'Rectangular'], ['round', 'Round'], ['aviator', 'Aviator'], ['sunglasses', 'Pilot sunglasses']], L.glasses)}</div>`;
  if (t === 'hair') return `
    <div class="le-group"><b>Hairstyle</b>${leChoice('hair', Object.keys(HAIR_STYLES).map(k => [k, HAIR_STYLES[k]]), L.hair)}</div>
    <div class="le-group"><b>Hair colour</b>${leSwatches('hairColor', HAIR_COLORS, L.hairColor)}</div>`;
  const sec = !!(L as any).sec, mech = (role === 'mech' || role === 'ground') && !sec, G = garmentOptions(L.sex, role, sec);
  return `
    ${mech ? `<p class="fine-print">${icon('info')}Mechanics always wear overalls with a high-visibility vest.</p>` : `
    <div class="le-group"><b>Top</b>${leChoice('top', G.top, L.top)}</div>
    <div class="le-group"><b>Bottom</b>${leChoice('bottom', G.bottom, L.bottom)}</div>
    <div class="le-group"><b>Neckwear</b>${leChoice('neck', G.neck, L.neck)}</div>`}
    <div class="le-group"><b>Shoes</b>${leChoice('shoes', G.shoes, L.shoes)}</div>
    <div class="le-group"><b>Hat</b>${leChoice('hat', G.hat, L.hat)}</div>
    <div class="le-group"><b>Uniform colour</b>${leSwatches('uniform', UNIFORM_COLORS, L.uniform)}</div>`;
}

function lookEditorHtml(): string {
  const c = company();
  return `
  <div class="le">
    <div class="le-stage">
      <div class="le-spot"></div>
      <div class="le-fig" data-le-fig>${leFigHtml()}</div>
      <button class="btn ghost sm le-rand" data-act="le-shuffle">${icon('sync')}Surprise me</button>
    </div>
    <div class="le-side">
      <div class="modal-head"><div><h2>${esc(_le.o.title)}</h2><small>${_le.o.sexOnly ? '' : 'Everyone is always in uniform: you can swap any garment, never remove it.'}</small></div>
        <button class="icon-btn" data-act="close-layer" aria-label="Close without saving">${icon('close')}</button></div>
      ${_le.partner && (!_le.fam || _le.fam.married) ? `<div class="seg le-who" role="tablist"><button class="${_le.who !== 'partner' ? 'on' : ''}" data-act="le-who" data-w="me">${icon('user')}You</button><button class="${_le.who === 'partner' ? 'on' : ''}" data-act="le-who" data-w="partner">${icon('user')}Your <span data-le-pw>${lePartnerWord()}</span></button></div>` : ''}
      ${_le.o.sexOnly ? '' : `<div class="tabs">${LE_TABS.filter(x => _le.who !== 'partner' || x[0] !== 'outfit').concat(_le.pet && _le.who !== 'partner' ? [['pet', 'Pet']] : []).map(x => `<button class="tab ${_le.tab === x[0] ? 'on' : ''}" data-act="le-tab" data-t="${x[0]}">${x[1]}</button>`).join('')}</div>`}
      <div class="le-body" data-le-body>${lookEditorBody()}</div>
      <div class="modal-actions"><button class="btn ghost" data-act="close-layer">Cancel</button><button class="btn primary" data-act="le-accept">${icon('check')}Accept</button></div>
    </div>
  </div>`;
}

function leRefresh(body?: boolean) {
  const fig = $('[data-le-fig]');
  if (fig) {
    const cv = fig.querySelector('canvas.hero') as HTMLCanvasElement, html = leFigHtml();
    // keep the same canvas, so the figure, its motion and the camera carry on smoothly
    const m = /data-k="([^"]*)"/.exec(html);
    if (cv && m) { heroSetKey(cv, m[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')); heroSetMode(_le.cam as any); }
    else fig.innerHTML = html;
  }
  if (body) { const b = $('[data-le-body]'); if (b) b.innerHTML = lookEditorBody(); }
  if (_le && _le.tab === 'pet' && _le.pet) { const P = _le.pet; setTimeout(() => petPreviewDraw(P), 30); }
}
function leReadIdentity() {
  if (_le && _le.pet) { const pn = $('[data-pet-name]') as HTMLInputElement; if (pn) _le.pet.name = pn.value.trim().slice(0, 24); }
  if (_le && _le.fam) { const pn2 = $('[data-le-pname]') as HTMLInputElement; if (pn2) _le.fam.name = pn2.value.trim().slice(0, 40); }
  if (!_le.id) return;
  const n = $('[data-le-name]') as HTMLInputElement, d = $('[data-le-dob]') as HTMLInputElement, nt = $('[data-le-nat]') as HTMLSelectElement;
  if (n) _le.id.name = n.value.trim() || _le.id.name;
  if (d && d.value) _le.id.dob = d.value;
  if (nt) _le.id.nat = nt.value;
}

/** Your own voice (your pilot only): what you say in conversations is spoken with it. */
function leVoiceHtml(L: any): string {
  const sex = L.sex === 'f' ? 'f' : 'm', list = MY_VOICES[sex], cur = L.voice && list.some(x => x[0] === L.voice) ? L.voice : MY_DEFAULT[sex];
  const ready = VoicePack.state === 'ready', missing = ready ? list.filter(x => !voiceInstalled(x[0])).length : 0;
  return `<div class="le-group"><b>Your voice</b><p class="muted">What you say to your crew, in your office and in court is spoken with it. Tap one to hear it.</p>
    <div class="le-voices">${list.map(x => `<button class="le-voice ${x[0] === cur ? 'on' : ''}" data-act="le-voice" data-v="${x[0]}"><span class="lv-ic">${icon('volume')}</span><span><b>${esc(x[1])}</b><small>${esc(x[2])}</small></span></button>`).join('')}</div>
    ${!ready ? `<p class="fine-print">${icon('info')}The natural voices come with the voice pack (Settings → Voices). Until then this device's own voice speaks for you.</p>`
      : missing ? `<div class="btn-row"><button class="btn ghost sm" data-act="le-voice-dl">${icon('download')}Get the other ${missing} voices (about ${Math.max(1, Math.round(missing * 0.52))} MB)</button></div>` : ''}</div>`;
}
ACTIONS['le-voice'] = el => {
  leReadIdentity();
  const v = el.getAttribute('data-v'); (_le.look as any).voice = v;
  $all('.look-pop .le-voice').forEach(b => b.classList.toggle('on', b === el));
  try { Voice.stop(); Voice.speak('Tell me in your own words what happened.', undefined, `me|${_le.look.sex === 'f' ? 'f' : 'm'}|neutral|${v}`); } catch (e) { /* no voice */ }
};
ACTIONS['le-voice-dl'] = () => { leReadIdentity(); VoicePack.manifest = null; VoicePack.download().then(() => leRefresh(true)); toast('Getting the other voices…', 'info'); };

/** Switch between editing yourself and your partner (the same tabs, the figure changes to them). */
ACTIONS['le-who'] = el => {
  leReadIdentity(); const w = el.getAttribute('data-w') as 'me' | 'partner'; if (!_le.partner || w === _le.who) return;
  if (w === 'partner') { _le.me = _le.look; _le.partner = familyPartnerFor(_le.me.sex, _le.partner); _le.look = _le.partner; if (_le.tab === 'outfit' || _le.tab === 'pet') _le.tab = 'person'; }
  else { _le.partner = _le.look; _le.look = _le.me; }
  _le.who = w; _le.cam = leCamForTab(_le.tab); Sound.tick();
  const side = $('.look-pop .le-side'); if (side) { const tmp = document.createElement('div'); tmp.innerHTML = lookEditorHtml(); const ns = tmp.querySelector('.le-side'); if (ns) side.innerHTML = ns.innerHTML; }
  leRefresh(true);
};
/** Your partner stays the other sex to you (a new one is made if you changed yours). */
function familyPartnerFor(mySex: string, cur: any): any { const want = mySex === 'f' ? 'm' : 'f'; if (cur && cur.sex === want) return cur; const S: any = State, keep = S.family; S.family = { partner: cur }; try { return familyPartner(mySex, (myPilot() || {} as any).id); } finally { S.family = keep; } }
document.addEventListener('input', e => { const el = e.target as HTMLInputElement; if (!el || !el.hasAttribute || !el.hasAttribute('data-le-height') || !_le) return; const h = +el.value; (_le.look as any).height = h; const v = $('[data-le-hv]'); if (v) { const ft = h / 30.48, fi = Math.floor(ft); v.textContent = `${h} cm · ${fi}′${Math.round((ft - fi) * 12)}″`; } });
ACTIONS['le-tab'] = el => {
  leReadIdentity(); _le.tab = el.getAttribute('data-t'); _le.cam = leCamForTab(_le.tab); Sound.tick();
  $all('.look-pop .tab').forEach(t => t.classList.toggle('on', t.getAttribute('data-t') === _le.tab));
  leRefresh(true);
};
ACTIONS['le-set'] = el => {
  leReadIdentity();
  const k = el.getAttribute('data-k'), v = el.getAttribute('data-v');
  (_le.look as any)[k] = /^(skin|hairColor|uniform)$/.test(k) ? +v : v;
  if (k === 'sex' && _le.o.sexOnly) { const hat = _le.look.hat; _le.look = randomLook('cp' + Math.random(), v as any, _le.o.role); _le.look.hat = hat; }
  if (k === 'top' && v === 'overalls') _le.look.bottom = 'trousers';
  _le.look = _le.who === 'partner' ? Object.assign(dressed(_le.look, 'fa'), { civil: true, hat: 'none' }) : dressed(_le.look, _le.o.role);
  if (_le.who === 'partner') _le.partner = _le.look;
  _le.cam = _le.tab === 'outfit' || _le.tab === 'person' ? leCamForKey(k) : leCamForTab(_le.tab);
  if (k === 'glasses' || k === 'hat') _le.cam = 'face';
  Sound.tick(); leRefresh(true);
};
ACTIONS['le-shuffle'] = () => {
  leReadIdentity();
  const keep = _le.look.sex, hat = _le.look.hat, hgt = (_le.look as any).height;
  if (_le.who === 'partner') { _le.look = Object.assign(ctLook('shuffle' + Math.random(), keep as any, 'public'), { top: keep === 'f' ? 'blouse' : 'shirt', civil: true, hat: 'none', neck: 'open', bottom: 'trousers', height: hgt }); _le.partner = _le.look; Sound.tick(); leRefresh(true); return; }
  _le.look = randomLook('shuffle' + Math.random(), keep, _le.o.role); (_le.look as any).height = hgt;
  if (_le.o.sexOnly) _le.look.hat = hat;
  if (!_le.o.sexOnly) _le.look.top = dressed(_le.look, _le.o.role).top;
  Sound.tick(); leRefresh(true);
};
ACTIONS['le-accept'] = () => {
  leReadIdentity();
  if (_le.who === 'partner') { _le.partner = _le.look; _le.look = _le.me; _le.who = 'me'; }
  const o = _le.o, look = dressed(_le.look, o.role), id = _le.id;
  const partner = _le.partner ? familyPartnerFor(look.sex, _le.partner) : null;
  const before = JSON.stringify(dressed(o.look, o.role)), changed = JSON.stringify(look) !== before || (o.identity && JSON.stringify(id) !== JSON.stringify(o.identity));
  const apply = () => { Haptics.success(); if (_le.pet) { (State as any).pet = _le.pet; Store.soon(); } if (partner || _le.fam) { const fam = _le.fam || familyInfo(); (State as any).family = Object.assign({}, (State as any).family, partner ? { partner } : {}, { married: fam.married, partnerName: fam.name, kids: fam.kids }); Store.soon(); } o.onAccept(look, id); };
  // someone who already exists: ask first; "No" keeps the look they have now
  if (o.confirmName && changed) {
    confirmChange(`Change ${o.confirmName}'s appearance?`, 'The new look is used everywhere in the app from now on.', 'Yes, change it', 'No, keep the current look',
      () => { closeAll(); apply(); }, () => { closeAll(); toast('Nothing changed', 'info'); });
    return;
  }
  closeTop();
  apply();
};

/** "Are you sure?" before a change is applied. Yes applies it; No leaves everything as it was. */
function confirmChange(title: string, body: string, yes: string, no: string, onYes: () => void, onNo: () => void) {
  (window as any).__confirmYes = onYes; (window as any).__confirmNo = onNo;
  openLayer('modal', `<div class="modal-head"><div><h2>${esc(title)}</h2><small>${esc(body)}</small></div></div>
    <div class="modal-actions"><button class="btn ghost" data-act="confirm-no">${esc(no)}</button><button class="btn primary" data-act="confirm-yes">${icon('check')}${esc(yes)}</button></div>`, { cls: 'narrow', onClose: () => { (window as any).__confirmYes = null; } });
}
ACTIONS['confirm-yes'] = () => { const f = (window as any).__confirmYes; (window as any).__confirmYes = (window as any).__confirmNo = null; if (f) f(); };
ACTIONS['confirm-no'] = () => { const f = (window as any).__confirmNo; (window as any).__confirmYes = (window as any).__confirmNo = null; if (f) f(); else closeTop(); };

// your own colour for the coat or the markings: the swatch follows as you pick, the pet is redrawn when you let go
document.addEventListener('input', e => { const el = e.target as HTMLInputElement; if (!el || !el.classList || !el.classList.contains('pet-color') || !_le || !_le.pet) return; (_le.pet as any)[el.getAttribute('data-k')] = el.value; const lb = el.parentElement as HTMLElement; if (lb) { lb.style.background = el.value; lb.classList.add('on'); } });
// the name on the food bowl follows as you type it
document.addEventListener('input', e => { const el = e.target as HTMLInputElement; if (!el || !el.hasAttribute || !el.hasAttribute('data-pet-name') || !_le || !_le.pet) return; _le.pet.name = el.value.trim().slice(0, 24); clearTimeout((window as any).__petNameT); const P = _le.pet; (window as any).__petNameT = setTimeout(() => petPreviewDraw(P), 400); });
document.addEventListener('change', e => { const el = e.target as HTMLInputElement; if (!el || !el.classList || !el.classList.contains('pet-color') || !_le || !_le.pet) return; leReadIdentity(); (_le.pet as any)[el.getAttribute('data-k')] = el.value; leRefresh(true); });
ACTIONS['ng-diff'] = el => { _fsDiff = el.getAttribute('data-d') as Difficulty; document.querySelectorAll('.look-pop .diff-opt').forEach(b => b.classList.toggle('on', b === el)); Sound.tick(); };
ACTIONS['pet-set'] = el => {
  if (!_le || !_le.pet) return; leReadIdentity();
  const P: any = _le.pet, k = el.getAttribute('data-k') || '', v = el.getAttribute('data-v') || '';
  if (k === 'coat' || k === 'bed') { P[k] = +v; if (k === 'coat') delete P.coatHex; } else if (k === 'white') P.white = v === '1'; else if (k === 'lightHex') P.lightHex = v;
  else { P[k] = v; if (k === 'kind' && v !== 'none' && (!P.name || P.name === 'Buddy' || P.name === 'Mittens')) P.name = v === 'cat' ? 'Mittens' : 'Buddy'; if (k === 'kind' && v === 'cat') P.coat = Math.min(P.coat, PET_COATS.cat.length - 1); }
  Sound.tick(); leRefresh(true);
};

ACTIONS['le-fam'] = el => {
  if (!_le || !_le.fam) return; leReadIdentity(); const k = el.getAttribute('data-k'), v = el.getAttribute('data-v');
  if (k === 'married') { _le.fam.married = v === 'yes'; if (!_le.fam.married && _le.who === 'partner') { _le.partner = _le.look; _le.look = _le.me; _le.who = 'me'; } }
  else if (k === 'kids') _le.fam.kids = clamp(+v || 0, 0, 3);
  Sound.tick(); _le.cam = leCamForTab(_le.tab);
  const side = $('.look-pop .le-side'); if (side) { const tmp = document.createElement('div'); tmp.innerHTML = lookEditorHtml(); const ns = tmp.querySelector('.le-side'); if (ns) side.innerHTML = ns.innerHTML; }
  leRefresh(true);
};
