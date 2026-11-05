// The phone's own apps, in the dock at the bottom of its home screen: Messages, Phone and the Store.
// Messages: write to your family and your staff; they answer after a little while (with a notification).
// Phone: favourites, recent calls, contacts and a keypad. Calls themselves come later: a call rings, then says so.
// Store: the phone's apps, to open, and the ones that are coming.

const PH_APPS: [string, string, string, string][] = [
  ['msgs', 'Messages', 'chat', '#34C759'], ['call', 'Phone', 'phone', '#30B158'], ['store', 'Store', 'store', '#2F7BF6'],
];
const PhA: any = { tab: 'recents', thread: '', dial: '', calling: null as any, callT: 0 };

type PhContact = { id: string; name: string; sub: string; fam: boolean; c: string; sex?: 'm' | 'f' };
type PhMsg = { me: boolean; t: string; at: number; read?: boolean };

function phS(): any { const S: any = State; S.phoneMsgs = S.phoneMsgs || {}; S.phoneCalls = S.phoneCalls || []; S.phoneFav = S.phoneFav || null; return S; }

/** Everyone in the phone: your family, then your airline's people. */
function phContacts(): PhContact[] {
  const out: PhContact[] = [];
  try {
    const F: any = lapFamilyNames();
    for (const k of ['partner', 'kid1', 'kid2', 'mum', 'dad']) if (F[k]) out.push({ id: 'fam-' + k, name: F[k].name, sub: F[k].rel.replace(/^your /, '').replace(/^./, (c: string) => c.toUpperCase()), fam: true, c: '#F06A9A', sex: /wife|daughter|mother/.test(F[k].rel) ? 'f' : 'm' });
  } catch (e) { /* no family yet */ }
  try {
    const co: any = company(), RN: any = typeof ROLE_NAMES !== 'undefined' ? ROLE_NAMES : {};
    const st = staffOf(co.id).slice().sort((a: any, b: any) => String(a.name).localeCompare(String(b.name))).slice(0, 80);
    for (const s of st as any[]) out.push({ id: s.id, name: s.name, sub: RN[s.role] || s.role, fam: false, c: '#3FA2F0', sex: s.sex === 'f' ? 'f' : 'm' });
  } catch (e) { /* no staff */ }
  return out;
}
function phContact(id: string): PhContact | undefined { return phContacts().filter(c => c.id === id)[0]; }
function phInitials(n: string): string { return String(n).replace(/^(Capt\.|Captain|F\/O)\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w.charAt(0).toUpperCase()).join(''); }
function phAvatar(c: PhContact, big?: boolean): string { return `<span class="pa-av ${big ? 'big' : ''}" style="--c:${c.c}">${esc(phInitials(c.name))}</span>`; }
function phMsgsUnread(): number { const M = phS().phoneMsgs; let n = 0; for (const k in M) for (const m of M[k] as PhMsg[]) if (!m.me && !m.read) n++; return n; }
function phTime(at: number): string {
  const d = new Date(at), now = new Date();
  return d.toDateString() === now.toDateString() ? d.toTimeString().slice(0, 5) : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/* ---------- the dock ---------- */
function phDockHtml(): string {
  const un = phMsgsUnread();
  return `<div class="ph-dock-in">${PH_APPS.map(a => `<button class="ld-ic pd-ic" data-act="lap-app" data-k="${a[0]}" aria-label="${esc(a[1])}"><span style="--c:${a[3]}">${icon(a[2])}${a[0] === 'msgs' && un ? `<i class="lb-badge">${un}</i>` : ''}</span></button>`).join('')}</div>`;
}

function phAppHtml(k: string): string {
  if (k === 'msgs') return phMsgsHtml();
  if (k === 'call') return phCallHtml();
  if (k === 'store') return phStoreHtml();
  return '';
}

/* ---------- Messages ---------- */
function phMsgsHtml(): string {
  const S = phS(), M = S.phoneMsgs, C = phContacts();
  if (PhA.thread) {
    const c = phContact(PhA.thread) || { id: PhA.thread, name: 'Unknown', sub: '', fam: false, c: '#888' };
    const L: PhMsg[] = M[c.id] || [];
    for (const m of L) if (!m.me) m.read = true;
    const rows = L.map((m, i) => { const prev = L[i - 1]; const gap = !prev || m.at - prev.at > 30 * 60e3; return `${gap ? `<small class="pm-day">${esc(phTime(m.at))}</small>` : ''}<div class="pm-b ${m.me ? 'me' : ''}">${esc(m.t)}</div>`; }).join('');
    const typing = PhA.typing === c.id ? '<div class="pm-b pm-typing"><i></i><i></i><i></i></div>' : '';
    return `<div class="pm-thread"><div class="pm-th"><button class="lm-back" data-act="ph-msg-back">${icon('back')}</button>${phAvatar(c)}<span><b>${esc(c.name)}</b><small>${esc(c.sub)} · ${esc(phRelWord(phRelOf(c.id)))}</small></span><button class="pm-call" data-act="ph-call" data-id="${esc(c.id)}" aria-label="Call ${esc(c.name)}">${icon('phone')}</button></div>
      <div class="pm-list">${rows || `<p class="muted pm-empty">Write to ${esc(c.name.split(' ')[0])}.</p>`}${typing}</div>
      <form class="pm-send ${phKbOn() ? 'kb' : ''}" data-id="${esc(c.id)}">${phKbToggle()}<input class="pm-in" type="text" maxlength="300" placeholder="Message" autocomplete="off" enterkeyhint="send" value="${esc(PhA.draft || '')}" ${phKbOn() ? 'inputmode="none"' : ''}><button type="submit" class="pm-go" aria-label="Send">${icon('chevron')}</button></form>${phKbOn() ? phKbHtml() : ''}</div>`;
  }
  if (PhA.newMsg) {
    return `<div class="pm-new"><div class="pm-th"><button class="lm-back" data-act="ph-msg-back">${icon('back')}</button><span><b>New message</b><small>Choose who to write to</small></span></div>
      <div class="pc-list">${C.map(c => `<button class="pc-row" data-act="ph-msg-open" data-id="${esc(c.id)}">${phAvatar(c)}<span><b>${esc(c.name)}</b><small>${esc(c.sub)}</small></span></button>`).join('')}</div></div>`;
  }
  const ids = Object.keys(M).filter(k => (M[k] || []).length).sort((a, b) => M[b][M[b].length - 1].at - M[a][M[a].length - 1].at);
  const list = ids.map(id => { const c = phContact(id); if (!c) return ''; const L: PhMsg[] = M[id], last = L[L.length - 1], un = L.filter(m => !m.me && !m.read).length;
    return `<button class="pc-row pm-row ${un ? 'new' : ''}" data-act="ph-msg-open" data-id="${esc(id)}">${phAvatar(c)}<span><b>${esc(c.name)}</b><small>${last.me ? 'You: ' : ''}${esc(last.t)}</small></span><em>${esc(phTime(last.at))}${un ? `<i>${un}</i>` : ''}</em></button>`; }).join('');
  return `<div class="pm-home"><div class="pa-h"><b>Messages</b><button class="pa-new" data-act="ph-msg-new" aria-label="New message">${icon('plus')}</button></div>
    ${list || '<p class="muted pa-empty">No messages yet. Tap + to write to your family or your crew.</p>'}</div>`;
}

const PH_REPLY_FAM = ['Love you! Fly safe ❤️', 'Okay, see you tonight!', 'Haha, thanks 😊', 'Miss you. Call when you land?', 'Sounds good!', 'Yes! Can\'t wait.', 'Okay 👍', 'Thanks, I needed that today.'];
const PH_REPLY_STAFF = ['Understood, thanks.', 'Will do.', 'Got it, I\'ll take care of it.', 'Thanks for letting me know.', 'Okay, see you at the briefing.', 'Noted. I\'ll report back.', 'Thank you, appreciated!', 'On it.'];

function phSend(id: string, text: string) {
  text = text.trim(); if (!text) return;
  const S = phS(), L: PhMsg[] = S.phoneMsgs[id] = S.phoneMsgs[id] || [];
  L.push({ me: true, t: text, at: Date.now() }); if (L.length > 200) L.splice(0, L.length - 200);
  Store.soon(); Sound.tick();
  // they read it, start typing and answer what you wrote (one message or a few); sometimes they call you
  const c = phContact(id); if (!c) return;
  const A = phAnswer(c, text);
  let at = 1200 + Math.random() * 2200;
  A.lines.forEach((line, i) => {
    setTimeout(() => { PhA.typing = id; phRefresh(); }, at);
    at += 1400 + Math.min(5000, line.length * 55) + Math.random() * 1200;
    setTimeout(() => { if (PhA.typing === id && i === A.lines.length - 1) PhA.typing = ''; phTextFrom(c, line); }, at);
    at += 400;
  });
  if (A.callBack) phCallBackLater(c, A.mood === 'angry' ? 'I got your message. Can we talk about it?' : phRead(text).it.callme ? 'You asked me to call?' : 'Hi, I just wanted to talk about your message.');
}
function phRefresh() { if (!Lap.root || !Lap.root.isConnected || !Lap.phone) return; lapRender(true); phScrollEnd(); }
function phScrollEnd() { requestAnimationFrame(() => { const l = Lap.root && Lap.root.querySelector('.pm-list') as HTMLElement; if (l) l.scrollTop = l.scrollHeight; }); }

ACTIONS['ph-msg-open'] = el => { PhA.thread = el.getAttribute('data-id') || ''; PhA.newMsg = false; Sound.tick(); lapRender(true); phScrollEnd(); setTimeout(() => { const i = Lap.root && Lap.root.querySelector('.pm-in') as HTMLInputElement; if (i && DESKTOP) i.focus(); }, 60); };
ACTIONS['ph-msg-back'] = () => { PhA.thread = ''; PhA.newMsg = false; Sound.tick(); lapRender(true); };
ACTIONS['ph-msg-new'] = () => { PhA.newMsg = true; Sound.tick(); lapRender(true); };
document.addEventListener('submit', e => {
  const f = e.target as HTMLElement; if (!f || !f.classList || !f.classList.contains('pm-send') || f.classList.contains('pcall-own')) return;
  e.preventDefault(); const i = f.querySelector('.pm-in') as HTMLInputElement; const v = i.value; i.value = ''; PhA.draft = '';
  phSend(f.getAttribute('data-id') || '', v); phRefresh();
  setTimeout(() => { const j = Lap.root && Lap.root.querySelector('.pm-in') as HTMLInputElement; if (j && (!phKbOn() || DESKTOP)) j.focus(); }, 30);
});
// typing a message never walks you around the room
document.addEventListener('keydown', e => { const t = e.target as HTMLElement; if (t && t.classList && t.classList.contains('pm-in')) e.stopPropagation(); }, true);

/* ---------- Phone ---------- */
function phCallHtml(): string {
  const S = phS(), C = phContacts();
  if (PhCall.c) return phCallScreenHtml();
  if (PhA.calling) {
    const c = PhA.calling as PhContact, st = PhA.callState || 'calling';
    return `<div class="pcall"><div class="pcall-who">${phAvatar(c, true)}<b>${esc(c.name)}</b><small>${st === 'calling' ? 'Calling…' : st === 'ended' ? 'Call ended' : 'Calls aren\'t available yet. They come in a later update.'}</small></div>
      <div class="pcall-keys">${[['mute', 'Mute', 'mute'], ['keypad', 'Keypad', 'sliders'], ['speaker', 'Speaker', 'volume'], ['add', 'Add call', 'plus'], ['video', 'Video', 'camera'], ['contacts', 'Contacts', 'user']].map(b => `<button class="pk-b" disabled><span>${icon(b[2])}</span><small>${b[1]}</small></button>`).join('')}</div>
      <button class="pcall-end" data-act="ph-call-end" aria-label="End call">${icon('phone')}</button></div>`;
  }
  const tabs = [['fav', 'Favourites', 'star'], ['recents', 'Recents', 'clock'], ['contacts', 'Contacts', 'user'], ['keypad', 'Keypad', 'sliders']];
  let body = '';
  if (PhA.tab === 'fav') {
    const fav = (S.phoneFav || C.filter(c => c.fam).map(c => c.id)) as string[], L = fav.map(id => phContact(id)).filter(Boolean) as PhContact[];
    body = `<div class="pa-h"><b>Favourites</b></div>${L.map(c => `<button class="pc-row" data-act="ph-call" data-id="${esc(c.id)}">${phAvatar(c)}<span><b>${esc(c.name)}</b><small>${esc(c.sub)}</small></span><em class="pc-ph">${icon('phone')}</em></button>`).join('') || '<p class="muted pa-empty">No favourites yet.</p>'}`;
  } else if (PhA.tab === 'recents') {
    const R = (S.phoneCalls as any[]).slice(0, 60);
    body = `<div class="pa-h"><b>Recents</b></div>${R.map(r => { const c = phContact(r.id); const nm = c ? c.name : r.num || 'Unknown'; return `<button class="pc-row" data-act="ph-call" data-id="${esc(r.id || '')}" data-num="${esc(r.num || '')}">${c ? phAvatar(c) : `<span class="pa-av" style="--c:#8A94A6">#</span>`}<span><b>${esc(nm)}</b><small>${r.dir === 'in' ? (r.ok ? 'Incoming' : 'Missed') : 'Outgoing'}${r.ok ? (r.dur ? ' · ' + Math.floor(r.dur / 60) + ':' + String(r.dur % 60).padStart(2, '0') : '') : r.dir === 'in' ? '' : ' · not answered'}</small></span><em>${esc(phTime(r.at))}</em></button>`; }).join('') || '<p class="muted pa-empty">No calls yet.</p>'}`;
  } else if (PhA.tab === 'contacts') {
    let letter = '';
    body = `<div class="pa-h"><b>Contacts</b></div>${C.map(c => { const l = c.fam ? 'Family' : c.name.replace(/^(Capt\.|Captain|F\/O)\s+/i, '').charAt(0).toUpperCase(); const h = l !== letter ? `<small class="pc-l">${esc(l)}</small>` : ''; letter = l;
      return `${h}<div class="pc-row pc-c">${phAvatar(c)}<span><b>${esc(c.name)}</b><small>${esc(c.sub)}</small></span><button class="pc-mini" data-act="ph-msg-to" data-id="${esc(c.id)}" aria-label="Message ${esc(c.name)}">${icon('chat')}</button><button class="pc-mini" data-act="ph-call" data-id="${esc(c.id)}" aria-label="Call ${esc(c.name)}">${icon('phone')}</button></div>`; }).join('')}`;
  } else {
    const keys = [['1', ''], ['2', 'ABC'], ['3', 'DEF'], ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'], ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'], ['*', ''], ['0', '+'], ['#', '']];
    body = `<div class="pkp"><div class="pkp-num">${esc(PhA.dial) || '<span class="muted">Enter a number</span>'}</div>
      <div class="pkp-grid">${keys.map(k => `<button class="pkp-k" data-act="ph-dial" data-k="${k[0]}"><b>${k[0]}</b><small>${k[1]}</small></button>`).join('')}</div>
      <div class="pkp-row"><span></span><button class="pkp-call" data-act="ph-call" data-num="${esc(PhA.dial)}" aria-label="Call">${icon('phone')}</button>${PhA.dial ? `<button class="pkp-del" data-act="ph-dial" data-k="del" aria-label="Delete">${icon('back')}</button>` : '<span></span>'}</div></div>`;
  }
  return `<div class="pph"><div class="pph-b">${body}</div><nav class="pph-tabs">${tabs.map(t => `<button class="${PhA.tab === t[0] ? 'on' : ''}" data-act="ph-tab" data-k="${t[0]}">${icon(t[2])}<small>${t[1]}</small></button>`).join('')}</nav></div>`;
}
ACTIONS['ph-tab'] = el => { PhA.tab = el.getAttribute('data-k') || 'recents'; Sound.tick(); lapRender(true); };
ACTIONS['ph-dial'] = el => { const k = el.getAttribute('data-k') || ''; PhA.dial = k === 'del' ? PhA.dial.slice(0, -1) : (PhA.dial + k).slice(0, 18); Sound.tick(); lapRender(true); };
ACTIONS['ph-msg-to'] = el => { if (Lap.app === 'browser') lapBrowserHide(); Lap.app = 'msgs'; PhA.thread = el.getAttribute('data-id') || ''; PhA.newMsg = false; Sound.tick(); lapRender(); phScrollEnd(); };
ACTIONS['ph-call'] = el => {
  const id = el.getAttribute('data-id') || '', num = el.getAttribute('data-num') || '';
  const c = (id && phContact(id)) || (num ? { id: 'num-' + num, name: num, sub: 'Number', fam: false, c: '#8A94A6' } as PhContact : null); if (!c) return;
  if (PhCall.c) return;
  Sound.tick();
  if (!id) {   // a number nobody in your phone has: it rings, and nobody answers
    phCallStart(c, false); clearTimeout(PhCall.ringT);
    PhCall.ringT = setTimeout(() => { if (PhCall.c === c && PhCall.st === 'calling') { PhCall.st = 'noanswer'; phCallRedraw(); setTimeout(() => { if (PhCall.c === c) phCallEnd(); }, 1600); } }, 5000);
    return;
  }
  phCallStart(c, false);
};
ACTIONS['ph-call-end'] = () => { Sound.tick(); if (PhCall.st === 'incoming') { const c = PhCall.c; phCallEnd(); if (c && Math.random() < 0.6) setTimeout(() => phTextFrom(c, phRelOf(c.id).hurt > 1 ? 'Fine, ignore me.' : 'Call me when you\'re free.'), 3000); return; } phCallEnd(); };

/* ---------- Store ---------- */
const PH_STORE_SOON: [string, string, string, string][] = [
  ['Flight tracker', 'Follow your aircraft on a map, live.', 'map', '#4C8DF6'], ['Weather', 'Forecasts and METARs for your airports.', 'wind', '#5BC0EB'], ['Crew chat', 'Group chats with your crews.', 'chat', '#34C759'],
];
function phStoreHtml(): string {
  const mine = LAP_APPS.concat(PH_APPS.filter(a => a[0] !== 'store'));
  const row = (a: [string, string, string, string], sub: string, btn: string) => `<div class="ps-row"><span class="ld-ic"><span style="--c:${a[3]}">${icon(a[2])}</span></span><span class="ps-t"><b>${esc(a[1])}</b><small>${esc(sub)}</small></span>${btn}</div>`;
  return `<div class="pstore"><div class="pa-h"><b>Store</b></div>
    <div class="ps-hero"><small>New</small><b>Messages and Phone</b><span>Write to and call your family and your crew. They answer what you say, and remember how you treat them.</span><button class="btn sm" data-act="lap-app" data-k="msgs">Open</button></div>
    <h4>Coming soon</h4>${PH_STORE_SOON.map(a => row(['', a[0], a[2], a[3]], a[1], '<button class="ps-get" disabled>Soon</button>')).join('')}
    <h4>On your phone</h4>${mine.map(a => row(a, 'Installed', `<button class="ps-get" data-act="lap-app" data-k="${a[0]}">Open</button>`)).join('')}</div>`;
}

/* ---------- the phone's own keyboard: tap the letters on the screen ---------- */
// Letters (with shift and caps lock: tap shift once for one capital, twice to keep capitals on), numbers and
// symbols, space, delete and send. A new sentence starts with a capital. The keyboard button beside the message
// box turns it off and back on (kept); on a PC you can type on your own keyboard as well.
const PH_KB_L = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const PH_KB_N = ['1234567890', '-/:;()€&@"', '.,?!\'#%+='];
function phKbOn(): boolean { return (State.settings as any).phoneKb !== false; }
function phKbToggle(): string { return `<button type="button" class="pm-kbt ${phKbOn() ? 'on' : ''}" data-act="ph-kb-toggle" aria-label="${phKbOn() ? 'Hide' : 'Show'} the phone's keyboard" title="The phone's keyboard"><svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10"/></svg></button>`; }
function phKbHtml(): string {
  const K = PhA.kb || (PhA.kb = { shift: 1, caps: false, num: false }), up = K.caps || K.shift;
  const rows = K.num ? PH_KB_N : PH_KB_L;
  const key = (ch: string) => `<button type="button" class="pk-k" data-k="${esc(ch)}">${esc(K.num ? ch : up ? ch.toUpperCase() : ch)}</button>`;
  return `<div class="ph-kb ${K.num ? 'num' : ''}" role="group" aria-label="Keyboard">
    <div class="pk-r">${rows[0].split('').map(key).join('')}</div>
    <div class="pk-r r2">${rows[1].split('').map(key).join('')}</div>
    <div class="pk-r">${K.num ? '' : `<button type="button" class="pk-k pk-w pk-sh ${K.caps ? 'lock' : K.shift ? 'on' : ''}" data-k="shift" aria-label="Shift"><svg viewBox="0 0 24 24"><path d="M12 4l7 8h-4v7H9v-7H5z"/></svg></button>`}${rows[2].split('').map(key).join('')}<button type="button" class="pk-k pk-w" data-k="del" aria-label="Delete"><svg viewBox="0 0 24 24"><path d="M9 6h11v12H9l-6-6z"/><path d="M12 10l4 4M16 10l-4 4"/></svg></button></div>
    <div class="pk-r"><button type="button" class="pk-k pk-w2" data-k="mode">${K.num ? 'ABC' : '123'}</button><button type="button" class="pk-k" data-k="😊">😊</button><button type="button" class="pk-k pk-sp" data-k=" ">space</button><button type="button" class="pk-k pk-go" data-k="send">send</button></div></div>`;
}
/** A key tapped: into the message (or what you say on a call). */
function phKbPress(k: string, kbEl: HTMLElement) {
  const form = kbEl.previousElementSibling as HTMLFormElement, inp = form && form.querySelector('.pm-in') as HTMLInputElement; if (!inp || inp.disabled) return;
  const K = PhA.kb || (PhA.kb = { shift: 1, caps: false, num: false }), call = form.classList.contains('pcall-own');
  let v = inp.value;
  if (k === 'shift') { const now = Date.now(); if (K.shift && now - (K.shT || 0) < 350) { K.caps = true; K.shift = 0; } else if (K.caps) { K.caps = false; K.shift = 0; } else K.shift = K.shift ? 0 : 1; K.shT = now; }
  else if (k === 'mode') K.num = !K.num;
  else if (k === 'del') v = Array.from(v).slice(0, -1).join('');
  else if (k === 'send') { form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })); K.shift = 1; phKbRedraw(kbEl); return; }
  else {
    v += (!K.num && (K.caps || K.shift)) ? k.toUpperCase() : k;
    if (K.shift) K.shift = 0;
    if (!K.num && k === ' ' && /[.!?]\s$/.test(v)) K.shift = 1;   // a new sentence: a capital
    if (K.num && k === ' ') K.num = false;
  }
  if (!v) K.shift = 1;
  inp.value = v; if (call) PhA.callDraft = v; else PhA.draft = v;
  try { Sound.tick(); } catch (e) { /* no sound */ }
  phKbRedraw(kbEl);
}
function phKbRedraw(kbEl: HTMLElement) { if (!kbEl.isConnected) return; const t = document.createElement('div'); t.innerHTML = phKbHtml(); kbEl.replaceWith(t.firstElementChild as HTMLElement); }
// taps (pointerdown, so the message box keeps its place and nothing scrolls)
document.addEventListener('pointerdown', e => {
  const b = (e.target as HTMLElement).closest && (e.target as HTMLElement).closest('.ph-kb .pk-k') as HTMLElement; if (!b) return;
  e.preventDefault(); e.stopPropagation(); b.classList.add('down'); setTimeout(() => b.classList.remove('down'), 120);
  phKbPress(b.getAttribute('data-k') || '', b.closest('.ph-kb') as HTMLElement);
}, true);
document.addEventListener('input', e => { const t = e.target as HTMLInputElement; if (!t || !t.classList || !t.classList.contains('pm-in')) return; if (t.classList.contains('pcall-in')) PhA.callDraft = t.value; else PhA.draft = t.value; });
ACTIONS['ph-kb-toggle'] = () => { (State.settings as any).phoneKb = !phKbOn(); Store.soon(); Sound.tick(); lapRender(true); };
