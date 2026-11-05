// Talking to people on your phone: what they write back, and calls (you calling them, and them calling you).
// What you write is read for its tone (kind, neutral or mean) and what it is about (a greeting, a question, thanks,
// an apology, praise, an insult, a threat to fire them, work, pay, time off, home, love, a joke, goodbye), and the
// answer follows from that, from who they are (family or your staff, and their role) and from how things stand
// between you: being kind warms them up, being mean cools them down, hurts, and they remember it. Sometimes they
// call you back. On a call they say their lines out loud in their own voice, and you answer, from suggestions or in
// your own words.

type PhRel = { rel: number; hurt: number; n: number; last: number };
type PhRead = { tone: number; it: { [k: string]: boolean }; q: boolean; words: string[] };

function phRelOf(id: string): PhRel { const S: any = phS(); S.phoneRel = S.phoneRel || {}; return S.phoneRel[id] = S.phoneRel[id] || { rel: id.indexOf('fam-') === 0 ? 2 : 0, hurt: 0, n: 0, last: 0 }; }
function phRelWord(r: PhRel): string { return r.hurt >= 3 ? 'Upset with you' : r.rel >= 4 ? 'Very close' : r.rel >= 2 ? 'Warm' : r.rel >= 0 ? 'Fine' : r.rel >= -2 ? 'Cool' : 'Cold'; }

const PH_KIND = /\b(thanks?|thank you|thx|appreciate|great|amazing|awesome|brilliant|excellent|well done|good job|proud|love|lovely|wonderful|kind|please|sweet|fantastic|nice work|good work|perfect|best|glad|happy|cheers|miss you|hugs?|xx+)\b|❤|😊|🙂|😘|👍/i;
const PH_MEAN = /\b(stupid|idiot|dumb|moron|useless|lazy|incompetent|pathetic|worthless|hate|shut up|loser|disgrace|disgusting|terrible|awful|worst|fool|clown|joke of a|garbage|trash|rubbish|crap|damn|hell|bloody|piss|screw you|get lost|go away|leave me alone|annoying|disappointing|ashamed|f+u+c+k\w*|sh[i1]t\w*|bitch\w*|bastard|ass(hole)?|wtf|stfu)\b|😡|🤬|🖕/i;

/** What a message says: its tone (−3 mean … +3 kind) and what it is about. */
function phRead(text: string): PhRead {
  const t = ' ' + text.toLowerCase() + ' ', it: { [k: string]: boolean } = {};
  const has = (re: RegExp) => re.test(t);
  let tone = 0;
  const kind = t.match(new RegExp(PH_KIND.source, 'gi')), mean = t.match(new RegExp(PH_MEAN.source, 'gi'));
  tone += Math.min(3, (kind || []).length) - Math.min(3, (mean || []).length) * 1.5;
  if (/[A-Z]{5,}/.test(text) && !kind) tone -= 0.5;   // shouting
  if ((text.match(/!/g) || []).length >= 3 && tone <= 0) tone -= 0.5;
  it.greet = has(/\b(hi|hey|hello|hiya|morning|good morning|good evening|good afternoon|yo|howdy)\b/);
  it.how = has(/how are you|how('?s| is) (it going|your day|everything|things|work)|how have you been|you ok|you okay|are you ok|what'?s up|how do you feel/);
  it.thanks = has(/\b(thanks?|thank you|thx|appreciate|cheers)\b/);
  it.sorry = has(/\b(sorry|apologi[sz]e|apologies|forgive me|my fault|my bad|i was wrong|didn'?t mean)\b/);
  it.praise = has(/\b(well done|good job|great job|great work|good work|nice work|proud of you|excellent|brilliant|amazing work|you'?re the best|keep it up|impressive)\b/);
  it.fire = has(/\b(you'?re fired|fire you|sack you|you'?re sacked|terminate|let you go|lose your job|last warning|final warning)\b/);
  it.insult = !!mean && has(/\b(you|you'?re|your|ur)\b/);
  it.work = has(/\b(flight|flights|roster|shift|duty|schedule|trip|rotation|briefing|aircraft|plane|crew|passengers?|delay|delayed|on time|late|check-?in|gate|turnaround|layover|standby|overtime|extra flight|cover)\b/);
  it.pay = has(/\b(pay|paid|salary|raise|rise|bonus|money|wage|wages|pay rise|payslip)\b/);
  it.off = has(/\b(day off|days off|time off|holiday|vacation|leave|rest|weekend off|break)\b/);
  it.sick = has(/\b(sick|ill|unwell|fever|doctor|hospital|hurt|injured|cold|flu)\b/);
  it.home = has(/\b(home|dinner|lunch|tonight|tomorrow|weekend|later|come back|be back|pick up|shopping|milk|groceries|kids|school|homework|bed|sleep)\b/);
  it.love = has(/\b(love you|love u|miss you|miss u|xoxo|kisses|hugs?|darling|sweetheart|honey|babe)\b/) || /❤|😘/.test(text);
  it.joke = has(/\b(haha+|hehe+|lol|lmao|joke|funny|kidding)\b/) || /😂|🤣/.test(text);
  it.bye = has(/\b(bye|goodbye|good night|goodnight|see you|see ya|talk later|ttyl|gotta go|got to go|later then)\b/);
  it.callme = has(/\b(call me|ring me|give me a call|phone me|can you call|call when)\b/);
  it.yes = has(/^\s*(yes|yeah|yep|sure|ok|okay|fine|alright|deal|of course)\b/);
  it.no = has(/^\s*(no|nope|nah|never|not now|not today)\b/);
  it.landed = has(/\b(landed|arrived|safe|back on the ground|on my way)\b/);
  it.meet = has(/\b(meet|come to my office|my office|see me|talk in person|have a word|need to talk|we need to talk)\b/);
  const q = /\?\s*$/.test(text.trim()) || has(/^\s*(can|could|would|will|do|did|are|is|have|has|when|where|what|why|how|who)\b/);
  return { tone, it, q, words: t.trim().split(/\s+/) };
}

/** Pick one, a different one each time where possible. */
function phPick(id: string, list: string[], tag: string): string {
  const r: any = phRelOf(id); r.used = r.used || {}; const used: string[] = r.used[tag] = r.used[tag] || [];
  const left = list.filter(x => used.indexOf(x) < 0), x = (left.length ? left : list)[Math.floor(Math.random() * (left.length || list.length))];
  used.push(x); if (used.length > Math.max(1, list.length - 1)) used.shift(); return x;
}

/** Their answer to what you wrote (or said on a call): one or more lines, how they feel, and whether they call. */
function phAnswer(c: PhContact, text: string, onCall?: boolean): { lines: string[]; mood: string; callBack: boolean; end?: boolean } {
  const R = phRead(text), it = R.it, r = phRelOf(c.id), fam = c.fam, me: any = (() => { try { return myPilot(); } catch (e) { return null; } })();
  const first = c.name.split(' ')[0], myFirst = me ? String(me.name).replace(/^(Capt\.|Captain|F\/O)\s+/i, '').split(' ')[0] : '';
  const boss = fam ? myFirst : (me && /^Capt/.test(me.name) ? 'Captain' : 'boss');
  const co: any = (() => { try { return company(); } catch (e) { return {}; } })(), air = co.name || 'the airline';
  const kid = /daughter|son/i.test(c.sub), parent = /mother|father/i.test(c.sub);
  const P = (tag: string, list: string[]) => phPick(c.id, list, tag);
  const out: string[] = []; let mood = 'neutral', callBack = false, end = false;
  // how it changes things between you
  let d = R.tone > 0 ? Math.min(1.5, R.tone * 0.5) : R.tone < 0 ? Math.max(-3, R.tone) : 0;
  if (it.fire) d -= 2; if (it.sorry) d += r.hurt > 0 ? 1 : 0.3; if (it.praise) d += 0.8;
  r.rel = Math.max(-6, Math.min(6, r.rel + d)); if (d < -0.9) r.hurt = Math.min(6, r.hurt + 1); r.n++; r.last = Date.now();
  const cold = r.rel <= -2, warm = r.rel >= 2, hurtNow = d <= -1;

  if (it.fire && !fam) {
    mood = 'sorry'; out.push(P('fire', [`Wait, what? ${boss}, please, I need this job. What did I do?`, `Fired? Can we at least talk about it face to face?`, `I don't understand. If I did something wrong, tell me and I'll fix it.`, `Are you serious? After everything I've done for ${air}?`]));
    if (r.hurt >= 2) out.push(P('fire2', ['Is this about the messages earlier?', 'I can come to your office right now.']));
    callBack = Math.random() < 0.5;
  } else if (it.insult || R.tone <= -1.5) {
    if (fam) {
      mood = r.hurt >= 2 ? 'angry' : 'sorry';
      out.push(kid ? P('fammeank', ['Why are you being so mean? 😢', 'That really hurt, Dad.', 'I didn\'t do anything!', 'Fine. I\'ll just go to my room.']).replace('Dad', me && me.look && me.look.sex === 'f' ? 'Mum' : 'Dad')
        : P('fammean', ['Wow. Where is this coming from?', 'Don\'t talk to me like that.', 'I don\'t deserve that, and you know it.', 'Is something going on at work? Because that\'s not like you.', 'We\'ll talk when you\'ve calmed down.']));
      if (r.hurt >= 3) out.push(P('fammean2', ['I\'m not answering any more messages tonight.', 'Call me when you\'re ready to apologise.']));
    } else {
      mood = r.hurt >= 2 || Math.random() < 0.45 ? 'angry' : 'sorry';
      out.push(mood === 'angry' ? P('staffmeanA', ['With respect, there\'s no need to talk to me like that.', 'I work hard for this airline. I don\'t appreciate that.', 'If you have a problem with my work, put it in writing.', 'That\'s out of line.', 'I\'ll pretend I didn\'t read that.'])
        : P('staffmeanS', ['I\'m sorry you feel that way. I\'ll try to do better.', 'Understood. I\'ll work on it.', 'Sorry, I didn\'t realise I\'d let you down.', 'OK… noted.']));
      if (r.hurt >= 3) out.push(P('staffmean2', ['Maybe I should talk to the union about this.', 'I\'ll be speaking to HR.', 'Honestly, I\'m starting to look at other airlines.']));
    }
    if (r.hurt >= 2 && Math.random() < 0.35) callBack = true;
  } else if (it.sorry) {
    if (r.hurt > 0) {
      const ok = r.rel > -3 || Math.random() < 0.5; r.hurt = Math.max(0, r.hurt - (ok ? 2 : 1));
      mood = ok ? 'neutral' : 'sorry';
      out.push(ok ? P('forgive', fam ? ['Thank you for saying that. I forgive you ❤️', 'OK. Apology accepted. Let\'s not do that again.', 'I know you\'ve got a lot on. It\'s OK.'] : ['Thanks for the apology. Let\'s move on.', 'Appreciated. No hard feelings.', 'Thank you. It\'s forgotten.'])
        : P('notyet', fam ? ['I need a bit of time.', 'Words are easy. Show me.'] : ['Noted. It\'ll take a while for me to forget it, though.', 'OK. Let\'s keep it professional from now on.']));
    } else out.push(P('sorrynone', fam ? ['Sorry for what? 😄 You\'re fine.', 'Don\'t worry about it!'] : ['No need to apologise, all good.', 'No problem at all.']));
  } else if (it.praise || (it.thanks && R.tone > 0)) {
    mood = 'neutral';
    out.push(fam ? P('fampraise', ['Aww, thank you! ❤️', 'You\'re sweet. Thank you!', 'That made my day 😊']) : P('praise', [`Thank you, ${boss}! That means a lot.`, 'Thanks! The whole team pulled together.', `Really appreciate that. Proud to work for ${air}.`, 'Thank you! I\'ll pass it on to the crew.']));
    if (!fam && warm && Math.random() < 0.3) out.push(P('praise2', ['By the way, if there\'s ever a chance at the captain\'s seat… just saying 😄', 'Drinks after the next rotation? My treat.']));
  } else if (it.love && fam) {
    out.push(kid ? P('kidlove', ['Love you too!! ❤️', 'Love you! When are you home?', 'Love you more 😘']) : parent ? P('parlove', ['We love you too, dear. Look after yourself.', 'Love you. Call your mother more often 😉'].map(x => /mother/i.test(c.sub) ? x : x.replace('Call your mother more often 😉', 'Proud of you.'))) : P('love', ['Love you too ❤️', 'Miss you too. Come home safe.', 'Love you. Counting the hours.', '😘 Can\'t wait to see you.']));
  } else if (it.how) {
    const st: any = !fam ? (() => { try { return staffById(c.id); } catch (e) { return null; } })() : null;
    out.push(cold ? P('howcold', fam ? ['I\'ve been better.', 'Fine.'] : ['Fine.', 'Busy.', 'Getting on with it.'])
      : fam ? P('howfam', kid ? ['Good! School was boring but we had pizza 🍕', 'Good! I got a gold star today!', 'Tired. Lots of homework.'] : ['Good, just a long day. You?', 'All good here, the house is quiet without you.', 'Busy but fine. How was the flight?'])
      : P('howstaff', st && st.status === 'resting' ? ['Resting before my next duty. All good.', 'Off for a bit, recharging. You?'] : st && st.status === 'on duty' ? ['On duty, all running smoothly.', 'Busy day, but on schedule.', 'Good! Just finished the briefing.'] : ['Doing well, thanks for asking.', 'Not bad at all. Enjoying the time off.', 'All good, ready for the next one.']));
    if (warm && Math.random() < 0.5) out.push(fam ? 'How are you holding up?' : 'And you? How\'s the airline treating you?');
  } else if (it.fire) {
    out.push(P('firefam', ['Fired?? What are you talking about? 😂', 'Very funny.']));
  } else if (it.pay && !fam) {
    out.push(cold ? P('paycold', ['Hard to talk money when I\'m being treated like this.', 'Let\'s talk about pay when things are better between us.']) : P('pay', ['A raise would be very welcome! I\'ve been carrying extra shifts.', 'If there\'s a bonus coming, the crew will be thrilled.', 'Is this about my salary review? I\'d love to discuss it.', 'Thanks for thinking of it. Happy to talk about it in your office.']));
  } else if (it.off) {
    out.push(fam ? P('offfam', ['Yes!! A holiday together? Where are we going? 😍', 'Finally! The kids will be so happy.', 'Can we go somewhere warm?']) : cold ? P('offcold', ['I\'ll put in a request through the proper channels.']) : P('off', ['That would be great, I\'m running on fumes.', 'Really? Thank you! Could I take next weekend?', 'I\'d appreciate that. My family will be happy.']));
  } else if (it.sick) {
    mood = 'sorry'; out.push(fam ? P('sickfam', ['Oh no, are you OK? Do you need anything?', 'Rest up. I\'ll make soup when you\'re home.']) : P('sick', ['Sorry to hear that. Get well soon!', 'Take care of yourself. We\'ll cover.', 'If you mean me: I\'m fit to fly, no worries.']));
  } else if (it.work && !fam) {
    out.push(R.q ? P('workq', ['On it. I\'ll check the roster and get back to you.', 'Yes, I can do that.', 'Should be fine. I\'ll confirm with operations.', 'I\'m legal for duty, so yes.']) : P('work', ['Understood, I\'ll sort it.', 'Got it. Leave it with me.', 'Will do. I\'ll update operations.', 'Noted, thanks for the heads-up.']));
    if (cold) out.push('As usual.');
  } else if (it.landed) {
    out.push(fam ? P('landfam', ['Phew! Glad you\'re safe ❤️', 'Yay! See you soon!', 'Thank goodness. Text me when you\'re on your way.']) : P('landstaff', ['Great, glad it went smoothly.', 'Nice one. Welcome back.']));
  } else if (it.home && fam) {
    out.push(R.q ? P('homeq', ['Yes, of course!', 'Sure, what time?', 'I think so, I\'ll check.', 'Can you get bread on the way?']) : P('home', ['OK! See you then.', 'Sounds good. I\'ll keep dinner warm.', 'OK 👍', 'Perfect.']));
  } else if (it.meet) {
    out.push(fam ? P('meetfam', ['Uh oh. That sounds serious. Is everything OK?']) : P('meet', ['Of course. When suits you?', 'Am I in trouble? 😅 I\'ll be there.', 'Sure, I\'m free after my duty.']));
    if (!fam) mood = 'sorry';
  } else if (it.joke) {
    out.push(P('joke', fam ? ['😂😂', 'Haha you\'re so silly', 'LOL'] : ['😄', 'Haha, good one.', 'You should do stand-up.']));
  } else if (it.thanks) {
    out.push(P('thanks', fam ? ['Anytime ❤️', 'Of course!'] : ['No problem!', 'Anytime.', 'Happy to help.']));
  } else if (it.bye) {
    out.push(P('bye', fam ? ['Bye! Love you ❤️', 'Night night 😴', 'See you!'] : ['Bye!', 'Speak soon.', 'Have a good one.'])); end = true;
  } else if (it.greet) {
    out.push(cold ? P('greetcold', ['Yes?', 'What do you need?']) : P('greet', fam ? ['Hey you! ❤️', 'Hiii!', 'Hey! What\'s up?'] : [`Hi ${boss}! What can I do for you?`, 'Hello! All good?', 'Hey! What\'s up?']));
  } else if (it.callme) {
    out.push(P('callme', ['Calling you now.', 'Sure, give me a minute.', 'OK, ringing you in a sec.'])); callBack = true;
  } else if (it.yes) {
    out.push(P('yes', ['Great!', 'Perfect, thanks.', '👍']));
  } else if (it.no) {
    out.push(P('no', fam ? ['Oh. OK then.', 'Why not? 🙁'] : ['Understood.', 'OK, no problem.']));
  } else if (R.q) {
    out.push(cold ? P('qcold', ['I\'ll get back to you.', 'Not sure.']) : P('q', fam ? ['Hmm, I\'m not sure. What do you think?', 'Good question! Let\'s talk tonight.', 'Yes, I think so!'] : ['Good question. Let me find out and come back to you.', 'I believe so, but I\'ll double-check.', 'Not sure, I\'ll ask operations.']));
  } else {
    // anything else: they answer the way things are between you
    out.push(R.tone > 0 ? P('kind', fam ? ['❤️', 'You\'re the best.', 'Aww 😊'] : ['Thank you, that\'s kind.', 'Appreciate it!']) : cold ? P('cold', ['OK.', 'Right.', 'If you say so.']) : P('neutral', fam ? ['OK! 😊', 'Sounds good.', 'Haha OK', 'Mm-hm, tell me more?'] : ['OK, noted.', 'Got it.', 'Understood, thanks.', 'Right, will keep that in mind.']));
  }
  // now and then, after a nice exchange, they add something of their own
  if (!hurtNow && warm && Math.random() < 0.18 && out.length < 2) out.push(fam ? P('extraf', ['Oh, and don\'t forget to eat something proper.', 'The neighbour asked about you, by the way.', 'Send me a photo from the cockpit! 📸']) : P('extras', ['By the way, the new catering is much better.', 'FYI the coffee machine in crew room is broken again ☕', 'Passengers loved the last flight, two compliments in the log.']));
  if (onCall) out.forEach((x, i) => { out[i] = x.replace(/[\u{1F300}-\u{1FAFF}❤️☀-➿]/gu, '').replace(/\s+/g, ' ').trim() || 'Mm.'; });
  if (hurtNow && !fam && r.hurt >= 4 && !onCall) callBack = true;
  return { lines: out, mood, callBack, end };
}

/* ---------- calls ---------- */
const PhCall: any = { c: null, st: '', log: [] as { me: boolean; t: string }[], t0: 0, ringT: 0, incoming: false, opts: [] as string[] };

/** Their voice on a call: their own (the same voice every time), in the mood of what they say. */
function phWho(c: PhContact, mood: string): string { return `${c.fam ? 'pax' : 'pilot'}|${c.sex || 'm'}|${mood || 'neutral'}|${c.name}`; }
function phMeWho(): string { let sx = 'm'; try { const me: any = myPilot(); sx = me && me.look && me.look.sex === 'f' ? 'f' : 'm'; } catch (e) { /* default */ } return `me|${sx}|neutral|`; }
function phSay(text: string, who: string, then?: () => void) {
  // with the voices off the line still takes the time it would take to say
  let sync = true, quick = false; const cb = () => { if (sync) { quick = true; return; } if (then) then(); };
  let ok = false; try { ok = Voice.speak(text, cb, who); } catch (e) { ok = false; }
  sync = false; if (!ok || quick) { if (then) setTimeout(then, 600 + text.length * 35); }
}

/** What you could say now (you can also say anything in your own words). */
function phCallOpts(c: PhContact): string[] {
  const r = phRelOf(c.id), hurt = r.hurt > 0;
  const base = c.fam
    ? ['How was your day?', 'I miss you. I\'ll be home soon.', 'I love you.', hurt ? 'I\'m sorry about earlier.' : 'Let\'s go somewhere this weekend.', 'Stop bothering me, I\'m busy.', 'Bye, talk later.']
    : ['How are you doing?', 'Great work lately. Thank you.', 'Can you cover an extra flight tomorrow?', hurt ? 'I\'m sorry about earlier.' : 'Come and see me in my office.', 'Your work has been terrible lately.', 'Bye.'];
  return base;
}
function phCallStart(c: PhContact, incoming: boolean) {
  clearTimeout(PhCall.ringT); try { Voice.stop(); } catch (e) { /* quiet */ }
  PhCall.c = c; PhCall.incoming = incoming; PhCall.log = []; PhCall.t0 = 0; PhCall.st = incoming ? 'incoming' : 'calling';
  const S = phS(); S.phoneCalls.unshift({ id: c.id, num: '', at: Date.now(), dir: incoming ? 'in' : 'out', ok: false }); S.phoneCalls = S.phoneCalls.slice(0, 100); Store.soon();
  if (Lap.app === 'browser') lapBrowserHide(); Lap.app = 'call'; PhA.calling = null; lapRender();
  if (incoming) { phRing(); return; }
  // ringing, then they answer (or don't, when it's very bad between you)
  const r = phRelOf(c.id), answers = r.rel > -4 || Math.random() < 0.3;
  PhCall.ringT = setTimeout(() => { if (PhCall.c !== c || PhCall.st !== 'calling') return; if (answers) phCallAnswered(); else { PhCall.st = 'noanswer'; phCallRedraw(); setTimeout(() => { if (PhCall.c === c && PhCall.st === 'noanswer') phCallEnd(); }, 1800); } }, 2200 + Math.random() * 2200);
}
function phRing() {
  const k = () => { if (PhCall.st !== 'incoming') return; try { Sound.chime(); } catch (e) { /* no sound */ } PhCall.ringT = setTimeout(k, 1600); };
  k();
  setTimeout(() => { if (PhCall.st === 'incoming') { PhCall.st = 'missed'; const c = PhCall.c; phCallEnd(); if (c) phTextFrom(c, 'Tried to call you. Call me back when you can.'); } }, 20000);
}
function phCallAnswered() {
  const c = PhCall.c as PhContact; if (!c) return;
  const S = phS(); if (S.phoneCalls[0] && S.phoneCalls[0].id === c.id) S.phoneCalls[0].ok = true;
  PhCall.st = 'on'; PhCall.t0 = Date.now(); clearTimeout(PhCall.ringT);
  const r = phRelOf(c.id), first = c.name.split(' ')[0];
  const hello = PhCall.incoming ? (PhCall.why || (r.hurt >= 2 ? 'We need to talk about your messages.' : c.fam ? 'Hey! Just wanted to hear your voice.' : 'Hi, it\'s ' + first + '. Have you got a minute?'))
    : r.rel <= -2 ? 'Yes?' : c.fam ? phPick(c.id, ['Hey you!', 'Hi! What\'s up?', 'Hello, love!'], 'callhi') : phPick(c.id, ['Hello, ' + first + ' speaking.', 'Hi! What can I do for you?', 'Hello?'], 'callhi');
  PhCall.why = '';
  PhCall.log.push({ me: false, t: hello }); phCallRedraw();
  phSay(hello, phWho(c, r.hurt >= 2 ? 'angry' : 'neutral'));
}
/** You say something on the call: your own voice, then their answer in theirs. */
function phCallSay(text: string) {
  text = (text || '').trim(); const c = PhCall.c as PhContact; if (!c || PhCall.st !== 'on' || !text || PhCall.busy) return;
  PhCall.busy = true; PhCall.log.push({ me: true, t: text }); phCallRedraw();
  phSay(text, phMeWho(), () => {
    if (PhCall.c !== c || PhCall.st !== 'on') { PhCall.busy = false; return; }
    const a = phAnswer(c, text, true), line = a.lines.join(' ');
    setTimeout(() => {
      if (PhCall.c !== c || PhCall.st !== 'on') { PhCall.busy = false; return; }
      PhCall.log.push({ me: false, t: line }); phCallRedraw();
      phSay(line, phWho(c, a.mood), () => { PhCall.busy = false; phCallRedraw(); if (a.end || phRead(text).it.bye) setTimeout(() => { if (PhCall.c === c) phCallEnd(); }, 400); });
    }, 350 + Math.random() * 500);
  });
}
function phCallEnd() {
  clearTimeout(PhCall.ringT); try { Voice.stop(); } catch (e) { /* quiet */ }
  const c = PhCall.c; PhCall.st = 'ended'; PhCall.busy = false;
  const S = phS(); if (c && S.phoneCalls[0] && S.phoneCalls[0].id === c.id) { S.phoneCalls[0].dur = PhCall.t0 ? Math.round((Date.now() - PhCall.t0) / 1000) : 0; Store.soon(); }
  phCallRedraw(); setTimeout(() => { if (PhCall.st === 'ended') { PhCall.c = null; PhCall.st = ''; phCallRedraw(); } }, 900);
}
function phCallRedraw() { if (Lap.root && Lap.root.isConnected && Lap.phone && Lap.app === 'call') { lapRender(true); const l = Lap.root.querySelector('.pcall-log') as HTMLElement; if (l) l.scrollTop = l.scrollHeight; } }
function phCallDur(): string { const s = PhCall.t0 ? Math.floor((Date.now() - PhCall.t0) / 1000) : 0; return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

/** The call screen (shown in the Phone app while a call is on). */
function phCallScreenHtml(): string {
  const c = PhCall.c as PhContact, st = PhCall.st;
  const label = st === 'calling' ? 'Calling…' : st === 'incoming' ? 'Incoming call' : st === 'noanswer' ? 'No answer' : st === 'missed' ? 'Missed call' : st === 'ended' ? 'Call ended' : phCallDur();
  if (st === 'incoming') return `<div class="pcall in"><div class="pcall-who">${phAvatar(c, true)}<b>${esc(c.name)}</b><small>${esc(c.sub)} · ${label}</small></div><span></span>
    <div class="pcall-ans"><button class="pcall-end" data-act="ph-call-end" aria-label="Decline">${icon('phone')}</button><button class="pkp-call pc-ring" data-act="ph-call-ans" aria-label="Answer">${icon('phone')}</button></div></div>`;
  const on = st === 'on';
  return `<div class="pcall ${on ? 'on' : ''}"><div class="pcall-who ${on ? 'sm' : ''}">${phAvatar(c, !on)}<b>${esc(c.name)}</b><small class="pcall-t">${label}</small></div>
    ${on ? `<div class="pcall-log">${PhCall.log.map((l: any) => `<div class="pm-b ${l.me ? 'me' : ''}">${esc(l.t)}</div>`).join('')}${PhCall.busy ? '<div class="pm-b pm-typing"><i></i><i></i><i></i></div>' : ''}</div>
      <div class="pcall-say">${phCallOpts(c).map(o => `<button class="pcs-o" data-act="ph-call-say" data-t="${esc(o)}" ${PhCall.busy ? 'disabled' : ''}>${esc(o)}</button>`).join('')}</div>
      <form class="pm-send pcall-own ${phKbOn() ? 'kb' : ''}">${phKbToggle()}<input class="pm-in pcall-in" type="text" maxlength="200" placeholder="Say something…" autocomplete="off" enterkeyhint="send" value="${esc(PhA.callDraft || '')}" ${phKbOn() ? 'inputmode="none"' : ''} ${PhCall.busy ? 'disabled' : ''}><button type="submit" class="pm-go" aria-label="Say it">${icon('chevron')}</button></form>${phKbOn() ? phKbHtml() : ''}`
    : `<div class="pcall-keys">${[['Mute', 'mute'], ['Keypad', 'sliders'], ['Speaker', 'volume'], ['Add call', 'plus'], ['Video', 'camera'], ['Contacts', 'user']].map(b => `<button class="pk-b" disabled><span>${icon(b[1])}</span><small>${b[0]}</small></button>`).join('')}</div>`}
    <button class="pcall-end" data-act="ph-call-end" aria-label="End call">${icon('phone')}</button></div>`;
}

/** They write to you (and the phone tells you, wherever you are on it). */
function phTextFrom(c: PhContact, text: string) {
  const S = phS(), L: PhMsg[] = S.phoneMsgs[c.id] = S.phoneMsgs[c.id] || [];
  const open = Lap.phone && Lap.app === 'msgs' && PhA.thread === c.id && Lap.root && Lap.root.isConnected;
  L.push({ me: false, t: text, at: Date.now(), read: !!open }); Store.soon();
  if (open) { Sound.tick(); phRefresh(); } else { phRefresh(); phoneNote({ title: c.name, body: text, ic: 'chat', c: '#34C759', app: 'msgs', thread: c.id }); }
}
/** They call you back (a little later). With the phone in use it rings; otherwise you find a missed call and a message. */
function phCallBackLater(c: PhContact, why: string) {
  setTimeout(() => {
    if (PhCall.c) return;
    if (Lap.phone && Lap.root && Lap.root.isConnected) { PhCall.why = why; phCallStart(c, true); phoneNote({ title: c.name, body: 'Incoming call', ic: 'phone', c: '#34C759', app: 'call' }); }
    else { const S = phS(); S.phoneCalls.unshift({ id: c.id, num: '', at: Date.now(), dir: 'in', ok: false }); Store.soon(); phTextFrom(c, 'Tried to call you. Call me back when you can.'); }
  }, 9000 + Math.random() * 12000);
}

ACTIONS['ph-call-ans'] = () => { if (PhCall.st === 'incoming') { Sound.tick(); phCallAnswered(); } };
ACTIONS['ph-call-say'] = el => { Sound.tick(); phCallSay(el.getAttribute('data-t') || ''); };
document.addEventListener('submit', e => {
  const f = e.target as HTMLElement; if (!f || !f.classList || !f.classList.contains('pcall-own')) return;
  e.preventDefault(); const i = f.querySelector('.pcall-in') as HTMLInputElement; const v = i.value; i.value = ''; PhA.callDraft = ''; phCallSay(v);
});
document.addEventListener('keydown', e => { const t = e.target as HTMLElement; if (t && t.classList && t.classList.contains('pcall-in')) e.stopPropagation(); }, true);
