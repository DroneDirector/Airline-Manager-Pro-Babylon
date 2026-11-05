/* Replaceable sounds. Every sound the game makes has a name below. Put a sound file with that name in
 * www/sounds/ (.ogg, .mp3, .wav or .m4a) and build: the game plays the file instead of making the sound itself.
 * Without a file, the game's own sound plays. The build writes www/sounds/README.md with every name, and
 * www/sounds/index.json with the files that are there. Ready for mods: a mod only has to bring the files. */

/** [file name without the ending, what it is] */
const SFX_NAMES: [string, string][] = [
  ['footsteps-carpet', 'A footstep on carpet (offices, the lounge, the cabin aisle)'],
  ['footsteps-wood', 'A footstep on a wooden floor (your office)'],
  ['footsteps-tile', 'A footstep on tiles or stone (the concourse, the galleys)'],
  ['footsteps-concrete', 'A footstep on concrete (the hangars, the apron)'],
  ['footsteps-metal', 'A footstep on metal (steps, gratings)'],
  ['door-wood-open', 'A wooden door opening (your office, Operations)'],
  ['door-wood-close', 'A wooden door shutting'],
  ['door-metal-open', 'A metal door opening (the hangars\' rooms, the staff door)'],
  ['door-metal-close', 'A metal door shutting'],
  ['door-glass-open', 'A glass door opening'],
  ['door-glass-close', 'A glass door shutting'],
  ['door-sliding-open', 'Sliding doors opening (the lounge, the concourse)'],
  ['door-sliding-close', 'Sliding doors shutting'],
  ['door-knock', 'A knock at your office door'],
  ['vending-button', 'The vending machine\'s keypad beep'],
  ['vending-coil', 'The vending machine\'s motor turning a coil'],
  ['vending-drop', 'An item dropping into the vending machine\'s tray'],
  ['vending-flap', 'The vending machine\'s flap'],
  ['can-open', 'Opening a can'],
  ['snack-bite', 'A bite of a snack bar'],
  ['drink-sip', 'A sip from a can or a cup'],
  ['put-down', 'Putting something down on a table'],
  ['coffee-touch', 'A tap on the coffee machine\'s touchscreen'],
  ['coffee-grind', 'The coffee machine grinding beans'],
  ['coffee-pour', 'Coffee running into the cup'],
  ['coffee-milk', 'The coffee machine frothing milk'],
  ['coffee-water', 'Hot water running (tea, americano)'],
  ['cup-down', 'A cup set down on its saucer'],
];
const Sfx: any = {
  files: null as { [name: string]: string }, buf: {} as { [name: string]: AudioBuffer }, wait: {} as { [name: string]: boolean },
  /** The files that are there (www/sounds/index.json, written by the build). */
  load() {
    if (this.files) return; this.files = {};
    try { fetch('sounds/index.json').then(r => r.ok ? r.json() : null).then((j: any) => { for (const f of (j && j.files) || []) { const n = String(f).replace(/\.[a-z0-9]+$/i, ''); this.files[n] = 'sounds/' + f; } }).catch(() => { /* none */ }); } catch (e) { /* none */ }
  },
  has(name: string): boolean { this.load(); return !!this.files[name]; },
  /** Play the file for this sound if there is one (true), or let the game make its own (false: call yours). */
  play(name: string, vol?: number): boolean {
    this.load(); const url = this.files[name]; if (!url) return false;
    if ((State.settings as any).muteAll) return true;
    const ctx = audio(); if (!ctx) return true;
    const go = (b: AudioBuffer) => { const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = b; g.gain.value = vol == null ? 1 : vol; s.connect(g); g.connect(ctx.destination); s.start(); };
    if (this.buf[name]) { go(this.buf[name]); return true; }
    if (!this.wait[name]) { this.wait[name] = true; fetch(url).then(r => r.arrayBuffer()).then(a => ctx.decodeAudioData(a)).then(b => { this.buf[name] = b; go(b); }).catch(() => { delete this.files[name]; }); }
    return true;
  },
};
/** A door's sound by what it is made of. */
function sfxDoor(kind: 'wood' | 'metal' | 'glass' | 'sliding', open: boolean, fallback?: () => void) {
  if (Sfx.play(`door-${kind}-${open ? 'open' : 'close'}`)) return;
  if (fallback) { fallback(); return; }
  try { Sound.door(kind, open); } catch (e) { /* quiet */ }
}
