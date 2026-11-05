// Replaceable models. Every aircraft type, ground vehicle, the jet bridge and the people have a file name in
// www/models/ (see www/models/README.md). When a .glb file with that name is there, the app uses it instead of
// its own built model, everywhere that model appears; when it isn't, the app's own model is used as before.
//  - The build lists the files that are there (www/models/index.json), so nothing is looked for that is missing.
//  - Files are loaded once and kept; each use gets its own copy.
//  - A model is fitted to the app's own one: turned so its nose (or front) points the right way, scaled to the
//    real length, and set on the ground. glTF's own axes: +Y up, the front towards +Z, metres.

const MODEL_DIR = 'models/';
/** People: the base model for a gender and a group of looks (from the skin tone and the eyes). */
const PEOPLE_GROUPS: [string, string][] = [
  ['european', 'European'], ['african', 'African'], ['east-asian', 'East Asian'], ['south-asian', 'South Asian'],
  ['middle-eastern', 'Middle Eastern and North African'], ['latin-american', 'Latin American'],
];
/** Ground vehicles and airport equipment, by kind. */
const VEHICLE_FILES: [string, string][] = [
  ['fire-truck', 'Airport fire truck (the water salute)'], ['fuel-truck', 'Fuel truck'], ['catering-truck', 'Catering truck (scissor lift)'],
  ['belt-loader', 'Baggage belt loader'], ['baggage-tractor', 'Baggage tractor'], ['baggage-cart', 'Baggage cart'],
  ['pushback-tug', 'Push-back tug'], ['passenger-stairs', 'Passenger stairs truck'], ['passenger-bus', 'Apron passenger bus'],
  ['de-icing-truck', 'De-icing truck'], ['ground-power-unit', 'Ground power unit'], ['lavatory-truck', 'Lavatory service truck'], ['water-truck', 'Potable water truck'],
];
const JETWAY_FILES: [string, string][] = [['jet-bridge', 'Jet bridge (passenger boarding bridge)']];
/** The hangar buildings, by size (the shell: walls, roof, windows, doors; the floor, the rooms and what is in them stay
 *  the app's own). Front (the doors) towards +Z. On the PC a file with "-pc" at the end is used first, if it is there. */
const HANGAR_FILES: [string, string][] = [
  ['hangar-small', 'Small hangar: 36 × 42 m, 13 m high, doors 10.5 m (turboprops, business and small jets)'],
  ['hangar-medium', 'Medium hangar: 52 × 66 m, 18 m high, doors 15 m (A320, 737, regional jets)'],
  ['hangar-large', 'Large hangar: 82 × 94 m, 25 m high, doors 21.5 m (767, 787, A330, A350, 777)'],
  ['hangar-very-large', 'Very large hangar: 96 × 100 m, 30 m high, doors 26.5 m (747, 777-9, A380)'],
];
/** Equipment and furniture in the hangar and its rooms, one file each (used for every one of that kind). Front towards +Z. */
const HANGAR_PROP_FILES: [string, string][] = [
  ['tool-trolley', 'Red rolling tool chest (tools on top)'], ['work-stand', 'Yellow work platform with steps (at the engine)'], ['traffic-cone', 'Traffic cone on its base'],
  ['workbench', 'Workbench with pegboard and vice (along the back wall)'], ['fire-extinguisher', 'Fire extinguisher on its stand'], ['waste-bin', 'Waste bin (hangar, office, break room)'],
  ['office-desk', 'Work table in the maintenance office (the monitor, keyboard and mouse stand on it)'], ['office-chair', 'Office chair'], ['keyboard', 'Computer keyboard'], ['computer-mouse', 'Computer mouse'], ['bookshelf', 'Shelf of manuals'],
  ['kitchen-counter', 'Break room counter with cupboards'], ['sink', 'Sink and tap'], ['coffee-mug', 'Coffee mug'], ['drinking-glass', 'Drinking glass'],
  ['break-room-table', 'Break room table'], ['break-room-chair', 'Break room chair'],
];
/** Equipment and furniture in the lounges, one file each (front towards +Z, standing on the floor). */
const LOUNGE_PROP_FILES: [string, string][] = [
  ['carpet-lounge', 'Carpet, Lounge'], ['carpet-business', 'Carpet, Business lounge'], ['carpet-flagship', 'Carpet, Flagship lounge (the finest)'],
  ['coffee-table-oak', 'Coffee table, oak'], ['coffee-table-walnut', 'Coffee table, walnut'], ['coffee-table-marble', 'Coffee table, marble and gold'],
  ['floor-lamp', 'Floor lamp'], ['magazine-rack', 'Magazine rack'], ['reception-desk', 'Reception desk'],
  ['buffet-counter', 'Refreshment counter'], ['tea-urn', 'Tea urn (samovar)'], ['teapot', 'Teapot'],
  ['coffee-cup-and-saucer', 'Coffee cup and saucer'], ['teacup-and-saucer', 'Teacup and saucer'], ['napkin-stack', 'Napkins'], ['fruit-bowl', 'Fruit bowl'],
  ['drinks-fridge', 'Glass-fronted fridge (the drinks and snacks in it are the items/ files)'],
  ['bar-counter', 'Bar counter, L-shaped, black lacquer and brass (Business and Flagship)'], ['bar-stool', 'Bar stool (brass legs, black seat)'], ['bottle-shelf', 'Glass shelves of bottles behind the bar'],
  ['bar-mirror', 'Mirrored back wall behind the bar, in a brass frame'], ['bar-pendant-globe', 'Globe pendant light over the bar'], ['ceiling-copper-waves', 'Lounge ceiling: copper waves with warm hidden light (every level)'], ['welcome-mat', 'Welcome mat inside the lounge doors (where you arrive)'],
  ['painting-aurora', 'Painting: northern lights over the hills (west wall)'], ['painting-dusk', 'Painting: an aircraft climbing into the dusk (east wall)'], ['painting-gold', 'Painting: arcs of gold (beside the bar)'], ['painting-storm', 'Painting: a storm over the sea, a lit harbour (over the refreshment corner)'],
  ['mixing-station', 'Mixing station on the bar: shaker, jigger, bar spoon, strainer, muddler, garnish tray'],
  ['pendant-light', 'Pendant light (Business)'], ['chandelier', 'Chandelier (Flagship)'], ['fireplace', 'Fireplace, art deco brass on black lacquer (Business and Flagship; the fire is drawn by the app)'], ['grand-piano', 'Grand piano (Flagship)'],
  ['wall-art', 'Framed art: a model of your own here hangs on both side walls instead of the two paintings there'], ['champagne-bucket', 'Champagne bucket (Flagship)'], ['departures-screen', 'Departures screen frame (the list is drawn by the app; also hanging in the concourse)'], ['arrivals-screen', 'Arrivals screen frame (beside the departures screen)'],
  ['glass-rack', 'Glass rack hanging from the ceiling over the bar (the glasses are their own files)'],
  ['bottle-red', 'Bottle of red wine (the bartender takes it from the shelf and pours)'], ['bottle-white', 'Bottle of white wine'], ['bottle-champagne', 'Bottle of champagne'],
  ['bottle-whisky', 'Bottle of single malt whisky'], ['bottle-gin', 'Bottle of gin'], ['bottle-vodka', 'Bottle of vodka'], ['bottle-aquavit', 'Bottle of aquavit'],
  ['bottle-rum', 'Bottle of dark rum'], ['bottle-cognac', 'Bottle of cognac'], ['bottle-port', 'Bottle of port'], ['bottle-amaretto', 'Bottle of amaretto'],
  ['glass-wine', 'Wine glass (hung upside down on the rack; the app pours the drink in it)'], ['glass-flute', 'Champagne flute'], ['glass-tumbler', 'Tumbler (whisky, gin, rum, amaretto)'],
  ['glass-snifter', 'Brandy snifter (cognac)'], ['glass-shot', 'Shot glass (vodka, aquavit)'], ['glass-small', 'Small wine glass (port)'],
];
/** The Training room (the Academy), one file each (training-props/<name>.glb): front towards +Z (the side you sit at or
 *  look at), standing on the floor (or the desk); fitted to the size of the app's own. */
const TRAINING_PROP_FILES: [string, string][] = [
  ['student-desk', 'Student desk (12 in the room; the front is where the student sits)'], ['student-chair', 'Student chair'],
  ['teacher-desk', 'Teacher desk (the front is the side the teacher sits at)'], ['teacher-chair', 'Teacher chair'],
  ['whiteboard', 'Whiteboard with its pen tray (a material named board shows the lesson the app draws)'],
  ['academy-notebook', 'The airline Academy notebook on every desk (a material named cover shows the airline cover: its mark, its name, Academy)'],
  ['pen', 'Pen (the app gives each one its colour)'], ['pencil', 'Pencil'], ['calculator', 'Calculator'], ['paper-sheet', 'Sheet of paper'],
  ['bookshelf', 'Bookshelf, 2.7 m wide, five shelves'], ['book', 'Book on the shelf, spine out (the app gives each one its size and colour)'],
  ['book-cover', 'Book with its cover showing (a material named cover shows the cover and title the app draws)'],
  ['poster', 'Academy poster in its frame'], ['wall-clock', 'Wall clock (the app draws its hands, which keep the time)'],
  ['double-door-leaf', 'One leaf of the double doors (opens inwards; the app turns it)'],
];
/** Security's things (security-props/<name>.glb). */
const SECURITY_PROP_FILES: [string, string][] = [
  ['taser', 'Taser held by an officer (the grip at the origin, the muzzle towards +Z, about 16 cm long)'],
  ['handcuffs', 'Handcuffs on the wrists behind the back (the two cuffs side by side along X, about 15 cm across)'],
];
/** Your office's private suite: the hall, the bathroom, the bedroom and the dressing alcove (suite-props/<name>.glb). */
const SUITE_PROP_FILES: [string, string][] = [
  ['suite-door', 'Door in the suite (office to hall, the bathroom, the bedroom), hinged at its left edge'],
  ['toilet', 'Wall-hung toilet with its flush plate (the seat lid lifts: a part named lid is turned)'], ['vanity', 'Bathroom vanity unit with its stone top'],
  ['basin', 'Basin and its tap (the water runs from the app)'], ['bath-mirror', 'Frame of the bathroom mirror (the reflection is drawn by the app)'],
  ['shower', 'Shower: the glass panel, the rain head and the tray (the water falls from the app)'], ['bathtub', 'Freestanding bath with its filler'],
  ['towel-rail', 'Heated towel rail with a towel'], ['bath-plant', 'Plant in the bathroom'],
  ['bed', 'Double bed with its channelled headboard, bedding and pillows'], ['nightstand', 'Nightstand with a drawer (one each side of the bed)'],
  ['bed-lamp', 'Bedside lamp (its light is drawn by the app, on and off)'], ['bedside-clock', 'Digital clock case (the time on it is drawn by the app)'],
  ['bedroom-art', 'Painting over the bed'], ['bedroom-armchair', 'Armchair by the window'], ['bedroom-rug', 'Rug under the bed'],
  ['wardrobe', 'Wardrobe in the dressing alcove (opening it opens your look)'],
];
/** The shared props, one file each (props/<name>.glb). */
const PROP_FILES: [string, string][] = [
  ['plant-1', 'Potted plant 1: fiddle-leaf fig in a glazed ceramic pot (about 1.6 m)'],
  ['plant-2', 'Potted plant 2: kentia palm in a tall square planter (about 1.9 m)'],
  ['plant-3', 'Potted plant 3: snake plant in a low concrete bowl (about 0.9 m)'],
  ['sofa-1', 'Sofa 1: fabric, soft rounded cushions, tapered oak legs (Lounge)'],
  ['sofa-2', 'Sofa 2: leather, buttoned back, chrome sled legs (Business lounge, your office)'],
  ['sofa-3', 'Sofa 3: velvet Chesterfield, rolled arms, gold legs (Flagship lounge)'],
  ['armchair-1', 'Armchair 1: fabric, to match sofa 1'], ['armchair-2', 'Armchair 2: leather, to match sofa 2'], ['armchair-3', 'Armchair 3: velvet, to match sofa 3'],
  ['coffee-machine-1', 'Coffee machine 1: bean-to-cup with a touchscreen, two bean hoppers, a drip tray (lounges, the hangar break room)'],
  ['door-1', 'Door 1: painted steel door leaf with a narrow glass panel, lever handles and kick plates (hangar rooms). Hinge on its left edge (x = 0), the leaf along +X; it turns about the hinge'],
  ['door-2', 'Door 2: one leaf of the automatic sliding glass doors (lounge entrance); two are used, one sliding each way'],
  ['room-sign', 'Room sign by a door: the frame only (the name, number and pictogram are drawn by the app on a panel in front)'],
];

/** The hangar's vending machine and what it sells (no real brands). Cans and bars stand upright: the top towards +Y. */
const ITEM_FILES: [string, string][] = [
  ['vending-machine', 'Vending machine (the hangar break room)'],
  ['can-cola', 'Can of cola'], ['can-lemon', 'Can of lemon soda'], ['can-orange', 'Can of orange soda'], ['can-water', 'Can of sparkling water'], ['can-icedtea', 'Can of iced tea'],
  ['bar-chocolate', 'Chocolate bar'], ['bar-peanut', 'Peanut bar'], ['bar-oat', 'Oat bar'], ['bar-caramel', 'Caramel bar'],
];

/** The crash scene: its vehicles and wreckage (models in crash/), each used for every one of its kind at a crash site. */
const CRASH_FILES: [string, string][] = [
  ['crash-fire-engine', 'Fire engine at a crash site (vehicles/fire-truck.glb is used when this file is missing)'], ['crash-command-vehicle', 'Fire chief\'s command vehicle (the yellow one)'],
  ['crash-ambulance', 'Ambulance'], ['crash-rescue-boat', 'Rescue boat (a crash in the sea)'],
  ['crash-debris', 'One piece of wreckage: copied, turned and scaled for all the debris strewn along the path'],
  ['crash-engine', 'An engine that broke off'], ['crash-wing-piece', 'A piece of wing that broke off'],
  ['crash-wheel', 'A wheel from the landing gear'], ['crash-rotor-blade', 'A broken helicopter rotor blade'],
];
/** The crash scene's effects: pictures (PNG with transparency, square) used instead of the app's own. */
const CRASH_FX_FILES: [string, string][] = [
  ['crash-fire', 'Flames: one flame on a transparent background, used for every flame particle (it is tinted as it burns down)'],
  ['crash-smoke', 'Smoke: one puff of smoke on a transparent background (grey, lit by the app)'],
  ['crash-soot', 'Scorched ground under the wreck and along its path (dark, ragged edges fading to transparent)'],
  ['crash-oil', 'Burning-fuel and oil slick on the water (a crash in the sea)'],
  ['crash-glow', 'The fire\'s glow on the ground at night (bright in the middle, fading out)'],
];

/** The file name for an aircraft type: maker and model, e.g. airbus-a320neo.glb, boeing-737-800.glb. */
function modelSlug(s: string): string { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
function aircraftModelFile(typeId: string): string {
  const t = acType(typeId); if (!t) return '';
  const mk = modelSlug(t.maker), md = modelSlug(t.model);
  return 'aircraft/' + (md.indexOf(mk + '-') === 0 ? md : mk + '-' + md) + '.glb';
}
/** The group a look belongs to, for the people's base models (an approximation from the skin tone and the eyes). */
function peopleGroup(L: any): string {
  const s = +(L && L.skin) || 0, e = L && L.eyes;
  if (e === 'mono' && s <= 5) return 'east-asian';
  if (s >= 7) return 'african';
  if (s <= 2) return 'european';
  if (s === 3) return e === 'almond' ? 'middle-eastern' : 'latin-american';
  if (s <= 4) return 'latin-american';
  return e === 'almond' ? 'middle-eastern' : 'south-asian';
}
function peopleFile(L: any): string[] { const sx = L && L.sex === 'f' ? 'female' : 'male'; return [`people/person-${sx}-${peopleGroup(L)}.glb`, `people/person-${sx}.glb`]; }

const Models = {
  list: null as { [path: string]: number } | null,
  cache: {} as { [path: string]: Promise<any> },
  ready: {} as { [path: string]: any },
  /** Which files are there (from the build's list). */
  init(): Promise<void> {
    if (this.list) return Promise.resolve();
    return fetch(MODEL_DIR + 'index.json').then(r => r.ok ? r.json() : { files: [] }).catch(() => ({ files: [] })).then((j: any) => {
      this.list = {}; for (const f of (j && j.files) || []) this.list[f] = 1;
      // every file is loaded now, so the pictures of the fleet and the first people use them straight away
      for (const f of Object.keys(this.list)) if (/\.glb$/i.test(f)) this.load(f);
    });
  },
  /** Files from switched-on mods, used in place of the folder's (src/core/mods.ts). */
  over: {} as { [path: string]: string },
  has(path: string): boolean { return !!(this.over[path] || (this.list && this.list[path])); },
  url(path: string): string { return this.over[path] || MODEL_DIR + path; },
  _tex: {} as { [path: string]: any },
  /** A picture from the folder (crash effects): a texture that fills in when it has loaded, or null without the file. */
  tex(path: string): any {
    if (!this.has(path)) return null;
    if (this._tex[path]) return this._tex[path];
    const T = THREE, t = new T.TextureLoader().load(this.url(path)); t.colorSpace = T.SRGBColorSpace;
    return (this._tex[path] = t);
  },
  first(paths: string[]): string { for (const p of paths) if (this.has(p)) return p; return ''; },
  load(path: string): Promise<any> {
    if (this.cache[path]) return this.cache[path];
    const W: any = window;
    if (!W.GLTFLoader || !this.has(path)) return (this.cache[path] = Promise.resolve(null));
    this.cache[path] = new Promise(res => {
      try { new W.GLTFLoader().load(this.url(path), (g: any) => { this.ready[path] = g; res(g); }, undefined, () => res(null)); } catch (e) { res(null); }
    });
    return this.cache[path];
  },
  /** A copy of a loaded model (bones and all), or null while it is still loading or isn't there. */
  copy(path: string): any {
    const g = this.ready[path]; if (!g) return null;
    const W: any = window, o = W.SkeletonUtils ? W.SkeletonUtils.clone(g.scene) : g.scene.clone(true);
    o.traverse((m: any) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    o.userData.clips = g.animations || [];
    return o;
  },
  /** Fit a model to the box of the app's own one: front to −X (the app's aircraft point their nose along −X from
   *  x = 0), scaled to the same length, standing on the same floor, centred across. */
  fit(o: any, box: any, frontToMinusX = true): any {
    const T = THREE, holder = new T.Group();
    if (frontToMinusX) o.rotation.y = -Math.PI / 2;   // glTF front (+Z) to −X
    holder.add(o); holder.updateMatrixWorld(true);
    const b = new T.Box3().setFromObject(o), sz = b.getSize(new T.Vector3()), want = box.getSize(new T.Vector3());
    const k = want.x / Math.max(0.001, sz.x);
    o.scale.multiplyScalar(k); holder.updateMatrixWorld(true);
    const b2 = new T.Box3().setFromObject(o);
    o.position.x += box.min.x - b2.min.x; o.position.y += box.min.y - b2.min.y; o.position.z += (box.min.z + box.max.z) / 2 - (b2.min.z + b2.max.z) / 2;
    return holder;
  },
  /** Put a file's model in place of the app's own one inside `root` (its meshes hidden, everything else kept: lights,
   *  pivots and the parts the app moves). Now if it is loaded, otherwise as soon as it is. */
  swap(root: any, path: string, frontToMinusX = true) {
    if (!root || !path || !this.has(path)) return;
    const go = () => {
      if (root.userData.__swapped === path) return;
      const o = this.copy(path); if (!o) return;
      const T = THREE, own: any[] = []; root.traverse((m: any) => { if (m.isMesh && !m.userData.keep) own.push(m); });
      root.updateMatrixWorld(true);
      const box = new T.Box3(); for (const m of own) box.expandByObject(m);
      const inv = new T.Matrix4().copy(root.matrixWorld).invert(); box.applyMatrix4(inv);
      if (box.isEmpty()) return;
      const fitted = this.fit(o, box, frontToMinusX); fitted.userData.fromFile = path;
      for (const m of own) m.layers.set(31);   // never drawn (even when the app shows or hides its parts)
      root.add(fitted); root.userData.__swapped = path;
    };
    if (this.ready[path]) go(); else this.load(path).then(g => { if (g) go(); });
  },
};
try { Models.init(); } catch (e) { /* none */ }

/** People: the base model from a file in place of the app's own figure. It is fitted to the figure's height and set
 *  on the same floor; its own Idle and Walk animations play, and a jaw bone follows the voice. The figure's own
 *  meshes stay (hidden), so everything that places, turns and poses it keeps working. */
function modelsPeople(m: any, look: any) {
  if (!m || !m.root) return;
  const path = Models.first(peopleFile(look)); if (!path) return;
  const go = () => {
    if (m.root.userData.__swapped) return;
    const o = Models.copy(path); if (!o) return;
    const T = THREE, own: any[] = []; m.root.traverse((x: any) => { if (x.isMesh || x.isPoints) own.push(x); });
    const holder = new T.Group(); holder.add(o); holder.updateMatrixWorld(true);
    const b = new T.Box3().setFromObject(o), h = Math.max(0.1, b.max.y - b.min.y), k = (m.top || 1.75) / h;
    o.scale.multiplyScalar(k); holder.updateMatrixWorld(true);
    const b2 = new T.Box3().setFromObject(o), c = b2.getCenter(new T.Vector3());
    o.position.x -= c.x; o.position.z -= c.z; o.position.y -= b2.min.y;
    for (const x of own) x.layers.set(31);
    m.root.add(holder); m.root.userData.__swapped = path;
    // animations and the jaw
    const mix = new T.AnimationMixer(o), clips: any[] = o.userData.clips || [];
    const clip = (re: RegExp) => clips.filter((c2: any) => re.test(c2.name))[0];
    const idle = clip(/idle|stand/i), walk = clip(/walk/i);
    const aI = idle ? mix.clipAction(idle) : null, aW = walk ? mix.clipAction(walk) : null;
    if (aI) aI.play(); if (aW) { aW.play(); aW.setEffectiveWeight(0); }
    let jaw: any = null; o.traverse((x: any) => { if (!jaw && x.isBone && /jaw/i.test(x.name)) jaw = x; });
    const jaw0 = jaw ? jaw.rotation.x : 0;
    let last = 0; const pose0 = m.pose;
    m.pose = function (p: any) {
      const r = pose0.call(this, p);
      try {
        const t = p && isFinite(p.t) ? p.t : performance.now() / 1000, dt = last ? Math.min(0.2, Math.max(0, t - last)) : 0; last = t;
        const walking = !!(p && p.g && (p.g.kind === 'walk' || p.g.walk));
        if (aW && aI) { aW.setEffectiveWeight(walking ? 1 : 0); aI.setEffectiveWeight(walking ? 0 : 1); }
        mix.update(dt);
        if (jaw) { const sp = p && p.talk, op = typeof sp === 'number' ? sp : sp ? sp.open : 0; jaw.rotation.x = jaw0 + (isFinite(op) ? op : 0) * 0.35; }
      } catch (e) { /* still */ }
      return r;
    };
  };
  if (Models.ready[path]) go(); else Models.load(path).then(g => { if (g) go(); });
}
