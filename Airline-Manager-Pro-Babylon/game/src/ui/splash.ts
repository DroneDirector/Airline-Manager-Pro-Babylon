// Start-up screen: the app's compass-star mark in detail, the name and version, what is being loaded,
// and a progress bar drawn as a route line with a glowing tip, sparks and an aircraft that takes off
// at 100%. Five seconds from start to the Overview.

const SPLASH_MS = 5000;

function splashLogo(): string {
  // a bezel with 72 marks (longer every 30°, cardinal letters), two rings and a four-point compass star
  // with lit and shaded faces, over a fainter diagonal star
  const ticks: string[] = [];
  for (let i = 0; i < 72; i++) {
    const a = i * 5, long = i % 6 === 0, r1 = long ? 86 : 89, r2 = 94;
    const s = Math.sin(a * Math.PI / 180), c = -Math.cos(a * Math.PI / 180);
    ticks.push(`<line x1="${(100 + s * r1).toFixed(2)}" y1="${(100 + c * r1).toFixed(2)}" x2="${(100 + s * r2).toFixed(2)}" y2="${(100 + c * r2).toFixed(2)}" class="${long ? 'tk-l' : 'tk'}"/>`);
  }
  const card = [['N', 0], ['E', 90], ['S', 180], ['W', 270]].map(([t, a]: any) => {
    const s = Math.sin(a * Math.PI / 180), c = -Math.cos(a * Math.PI / 180);
    return `<text x="${(100 + s * 78).toFixed(1)}" y="${(100 + c * 78 + 3.4).toFixed(1)}" class="${t === 'N' ? 'cd cd-n' : 'cd'}">${t}</text>`;
  }).join('');
  // one point of the star: lit half and shaded half
  const point = (rot: number, len: number, w: number, lit: string, dark: string) =>
    `<g transform="rotate(${rot} 100 100)"><path d="M100 ${100 - len} L${100 + w} 100 L100 100Z" fill="url(#${lit})"/><path d="M100 ${100 - len} L${100 - w} 100 L100 100Z" fill="url(#${dark})"/></g>`;
  return `<svg class="spl-logo" viewBox="0 0 200 200" aria-hidden="true">
    <defs>
      <linearGradient id="splLit" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E9FCFF"/><stop offset=".55" stop-color="#7FE6F5"/><stop offset="1" stop-color="#3FD0E8"/></linearGradient>
      <linearGradient id="splDark" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5AD9EC"/><stop offset="1" stop-color="#1F8FB0"/></linearGradient>
      <linearGradient id="splLit2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#B7F2FB" stop-opacity=".75"/><stop offset="1" stop-color="#3FD0E8" stop-opacity=".35"/></linearGradient>
      <linearGradient id="splDark2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3FD0E8" stop-opacity=".45"/><stop offset="1" stop-color="#145C7A" stop-opacity=".3"/></linearGradient>
      <linearGradient id="splRing" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3FD0E8"/><stop offset=".6" stop-color="#7FA8F5"/><stop offset="1" stop-color="#E04BD6"/></linearGradient>
      <radialGradient id="splCore" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".5" stop-color="#C8F6FF"/><stop offset="1" stop-color="#3FD0E8"/></radialGradient>
      <radialGradient id="splFace" cx=".5" cy=".45" r=".55"><stop offset="0" stop-color="#123457"/><stop offset=".75" stop-color="#0A1D35"/><stop offset="1" stop-color="#071426"/></radialGradient>
    </defs>
    <circle cx="100" cy="100" r="97" class="spl-face" fill="url(#splFace)"/>
    <g class="spl-bezel">${ticks.join('')}${card}</g>
    <circle cx="100" cy="100" r="70" class="spl-ring" stroke="url(#splRing)"/>
    <circle cx="100" cy="100" r="64" class="spl-ring2"/>
    <g class="spl-orbit"><path d="M100 30 A70 70 0 0 1 149.5 50.5" class="spl-trail"/>
      <path class="spl-jet" transform="translate(149.5 50.5) rotate(135) scale(.42) translate(-12 -12)" d="M21 15.5v-1.8l-8-5V3.6a1.5 1.5 0 0 0-3 0v5.1l-8 5v1.8l8-2.5v5l-2 1.5V21l3.5-1 3.5 1v-1.5L13 18v-5z"/></g>
    <g class="spl-star">
      <g class="spl-star2">${[45, 135, 225, 315].map(r => point(r, 40, 7, 'splLit2', 'splDark2')).join('')}</g>
      ${[0, 90, 180, 270].map(r => point(r, 58, 11, 'splLit', 'splDark')).join('')}
      <circle cx="100" cy="100" r="5.2" fill="url(#splCore)"/>
    </g>
  </svg>`;
}

const SPLASH_STEPS: [number, string][] = [
  [0, 'Opening your airline'],
  [0.16, 'Loading the fleet and its condition'],
  [0.34, 'Briefing pilots and cabin crew'],
  [0.5, 'Catching up on flights while you were away'],
  [0.66, 'Drawing the world map'],
  [0.8, 'Balancing the books'],
  [0.92, 'Looking for your PC and the simulator'],
  [1, 'Ready for departure'],
];

function showSplash(done: () => void) {
  const calm = State.settings.reduceMotion;
  const sp = document.createElement('div');
  sp.className = 'splash' + (calm ? ' calm-splash' : '');
  sp.setAttribute('role', 'status');
  sp.innerHTML = `
    <div class="spl-glow"></div>
    <div class="spl-mark">${splashLogo()}</div>
    <div class="spl-name"><b>${esc(APP.name.replace(/\s+Pro$/, ''))}</b>${/\sPro$/.test(APP.name) ? '<em>Pro</em>' : ''}</div>
    <small class="spl-ver">Version ${esc(APP.version)}</small>
    <div class="spl-load">
      <div class="spl-info"><span class="spl-step">${esc(SPLASH_STEPS[0][1])}</span><b class="spl-pct">0%</b></div>
      <div class="spl-bar"><i class="spl-fill"><span class="spl-sheen"></span></i><span class="spl-tip"><svg viewBox="0 0 24 24"><path d="M21 15.5v-1.8l-8-5V3.6a1.5 1.5 0 0 0-3 0v5.1l-8 5v1.8l8-2.5v5l-2 1.5V21l3.5-1 3.5 1v-1.5L13 18v-5z"/></svg></span></div>
    </div>`;
  document.body.appendChild(sp);
  const fill = sp.querySelector('.spl-fill') as HTMLElement, tip = sp.querySelector('.spl-tip') as HTMLElement;
  const step = sp.querySelector('.spl-step') as HTMLElement, pct = sp.querySelector('.spl-pct') as HTMLElement, bar = sp.querySelector('.spl-bar') as HTMLElement;
  const t0 = performance.now(), FILL = SPLASH_MS - 350;
  // uneven progress, like real loading: quick, a pause, quick again
  const curve = (k: number) => { const e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; return Math.min(1, e + Math.sin(k * Math.PI * 3) * .035 * (1 - k)); };
  let last = -1, shownStep = 0, lastSpark = 0, finished = false;
  const spark = (x: number) => {
    const s = document.createElement('i'); s.className = 'spl-spark';
    s.style.left = x + 'px'; s.style.setProperty('--dx', ((Math.random() - .7) * 40).toFixed(1) + 'px'); s.style.setProperty('--dy', ((Math.random() - .5) * 26).toFixed(1) + 'px');
    s.style.setProperty('--h', Math.random() < .5 ? '#3FD0E8' : '#E04BD6');
    bar.appendChild(s); setTimeout(() => s.remove(), 700);
  };
  let tv = 0, voiceMode = false, voiceEnd = 0, closing = false;
  // a new message fades in; the same message with new numbers just updates
  let stepKey = '';
  const setStep = (t: string, key?: string) => {
    if (step.textContent === t) return;
    const k = key || t;
    if (k === stepKey) { step.textContent = t; return; }
    stepKey = k; step.classList.remove('in'); void step.offsetWidth; step.textContent = t; step.classList.add('in');
  };
  const close = () => {
    if (closing) return; closing = true;
    done();
    sp.classList.add('out');
    setTimeout(() => sp.remove(), 700);
  };
  const frame = (now: number) => {
    // the voices download (the first time): the same bar, the same aircraft, showing the download
    if (splashWaitsForVoices() || (voiceMode && (!voiceEnd || now - voiceEnd < (VoicePack.state === 'error' ? 3000 : 900)))) {
      if (!voiceMode) { voiceMode = true; tv = now; last = 0; sp.classList.remove('ready'); }
      const v = VoicePack, dl = v.state === 'downloading' && v.total ? v.done / v.total : v.state === 'ready' ? 1 : 0;
      const p = Math.max(last, Math.min(1, dl)); last = p;
      if (v.state !== 'downloading' && v.state !== 'unknown' && !voiceEnd) voiceEnd = now;
      fill.style.width = (p * 100).toFixed(2) + '%';
      tip.style.left = (p * 100).toFixed(2) + '%';
      pct.textContent = Math.floor(p * 100) + '%';
      setStep(v.state === 'ready' ? 'The voices are ready'
        : v.state === 'error' ? 'The voices couldn\'t be downloaded. The app tries again next time.'
        : v.state === 'unknown' || !v.total ? 'Getting the voices ready'
        : `Downloading the voices, ${Math.round(v.done / 1e6)} of ${Math.round(v.total / 1e6)} MB (only this once)`, 'dl-' + v.state + (v.total ? '1' : '0'));
      if (!calm && now - lastSpark > 55 && p > 0.01 && p < 1) { lastSpark = now; spark(bar.clientWidth * p); }
      requestAnimationFrame(frame); return;
    }
    if (voiceMode && !finished) { finished = true; sp.classList.add('ready'); setTimeout(close, Math.max(700, SPLASH_MS - (now - t0))); return; }
    const k = Math.max(0, Math.min(1, (now - t0) / FILL)), p = Math.max(last, curve(k));
    last = p;
    fill.style.width = (p * 100).toFixed(2) + '%';
    tip.style.left = (p * 100).toFixed(2) + '%';
    pct.textContent = Math.round(p * 100) + '%';
    let si = 0; for (let i = 0; i < SPLASH_STEPS.length; i++) if (p >= SPLASH_STEPS[i][0]) si = i;
    if (si !== shownStep) { shownStep = si; setStep(SPLASH_STEPS[si][1]); }
    if (!calm && now - lastSpark > 55 && p > 0.01 && p < 1) { lastSpark = now; spark(bar.clientWidth * p); }
    if (k < 1) { requestAnimationFrame(frame); return; }
    // loaded: the voices may still be downloading, then the bar shows that
    if (splashWaitsForVoices()) { requestAnimationFrame(frame); return; }
    if (finished) return; finished = true;
    sp.classList.add('ready');
    setTimeout(close, Math.max(0, SPLASH_MS - (now - t0)));
  };
  requestAnimationFrame(frame);
}

function splashShowing(): boolean { return !!document.querySelector('.splash:not(.out)'); }

/** Redrawn by the voice download (the start-up screen reads the progress itself on every frame). */
function splashVoice() { /* nothing extra to draw */ }

/** The voices still have to be downloaded: the start-up screen stays until they are all in. */
function splashWaitsForVoices(): boolean {
  const v = VoicePack;
  return v.state === 'downloading' || (v.state === 'unknown' && voicesWanted());
}
