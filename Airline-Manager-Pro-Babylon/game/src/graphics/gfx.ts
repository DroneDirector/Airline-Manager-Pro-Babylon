// Graphics on the PC, category by category. Each category starts on Automatic (what the PC app draws by itself)
// and can be set on its own; a preset sets them all at once. Phones and tablets get shadows, lighting and rooms
// (shadows up to High, real lights without shadows); everything else keeps their own automatic choices.
//  - Render scale: how many pixels every 3D view and room is drawn with.
//  - Shadows: off, or their sharpness (the size of every shadow map), soft at Medium and above.
//  - Lighting: drawn light (beams and pools), real lights, or real lights that cast shadows.
//  - Texture filtering: how sharp surfaces stay at a slant and in the distance.
//  - Rooms: the detail of your offices, the operations room and the courtroom.
//  - Pictures: the size of award pictures, gift and career thumbnails, and photo-mode photos.
//  - Metal shine, and a frame rate limit.

const GFX_SCALES = [0.5, 0.75, 1, 1.25, 1.5, 2];
const GFX_SHADOW_NAMES = ['Off', 'Low', 'Medium', 'High', 'Ultra'];
const GFX_LIGHT_NAMES = ['Drawn', 'Real lights', 'Real lights with shadows'];
const GFX_ANISO = [1, 4, 8, 16];
const GFX_ROOM_NAMES = ['Low', 'Medium', 'High', 'Ultra'];
const GFX_PIC_NAMES = ['Standard', 'High', 'Highest'];
const GFX_FPS = [30, 60, 90, 120, 144, 165, 240];

const Gfx = {
  ver: 1,
  S(): any { return State.settings as any; },
  pc(): boolean { return typeof DESKTOP !== 'undefined' && DESKTOP; },
  /** Render scale (1 = the screen's own sharpness). */
  scale(): number { const v = this.S().gfxScale; return this.pc() && v != null ? clamp(+v, 0.5, 2) : 1; },
  /** A renderer's pixel ratio with the render scale applied (the PC only). */
  pr(v: number): number { this.install(); return this.pc() ? Math.max(0.35, v * this.scale()) : v; },
  /** Shadows: -1 Automatic, 0 off … 4 ultra. */
  shadow(): number { const v = this.S().gfxShadow; return v != null ? clamp(Math.round(+v), 0, this.pc() ? 4 : 3) : -1; },
  /** Lighting: 0 drawn, 1 real lights, 2 real lights with shadows. Automatic: the PC 2, phones 0. */
  lights(): number { const v = this.S().gfxLights; return v != null ? clamp(Math.round(+v), 0, this.pc() ? 2 : 1) : this.pc() ? 2 : 0; },
  /** How many pieces in the museum get a real light (phones: the first eight, the rest keep a drawn pool). */
  museumLights(): number { return this.lights() >= 1 ? (this.pc() ? 99 : 8) : 0; },
  /** Texture filtering: 0 Automatic (as each surface was made), otherwise 1, 4, 8 or 16 samples. */
  aniso(): number { const v = this.S().gfxAniso; return this.pc() && v != null ? +v : 0; },
  /** The detail of the rooms (offices, operations room, courtroom): Automatic follows the cabin quality. */
  roomQ(): number { const v = this.S().gfxRoomQ; const auto = typeof cabinQ === 'function' ? cabinQ() : 2; return v != null ? clamp(Math.round(+v), 0, 3) : auto; },
  /** Each 3D place's own settings (Settings → Graphics → Lounges, Hangars, Offices and rooms); Automatic follows Rooms. */
  placeQ(pl: 'lounge' | 'hangar' | 'room'): number { const v = pl === 'room' ? null : this.S()[pl + 'Q']; return v != null && v !== 'auto' ? clamp(Math.round(+v), 0, 3) : this.roomQ(); },
  /** The pixel ratio a place is drawn at: Automatic by its quality, or a chosen sharpness (75% to 300% of the screen's). */
  placeSharp(pl: string, q: number): number { const v = this.S()[pl + 'Sharp'], dpr = window.devicePixelRatio || 1;
    return v != null && v !== 'auto' ? Math.min(4, dpr * [0.75, 1, 1.5, 2, 3][clamp(+v, 0, 4)]) : Math.min(dpr, q >= 3 ? 2 : q >= 2 ? 1.5 : 1); },
  placeShadow(pl: string, auto: boolean): boolean { const v = this.S()[pl + 'Shadow']; return v === 'on' ? true : v === 'off' ? false : auto; },
  placePeople(pl: string): boolean { return this.S()[pl + 'People'] !== false; },
  /** How finely each person in a place is made (0.4 light, 0.6 normal, 0.85 high, 1 highest), or its automatic. */
  placePeopleQ(pl: string, auto: number): number { const v = this.S()[pl + 'PplQ']; return v != null && v !== 'auto' ? [0.4, 0.6, 0.85, 1][clamp(+v, 0, 3)] : auto; },
  /** Pictures: 0 standard (phones), 1 high (the PC's automatic), 2 highest. */
  pics(): number { const v = this.S().gfxPics; return !this.pc() ? 0 : v != null ? clamp(Math.round(+v), 0, 2) : 1; },
  /** A picture size by quality: [standard, high, highest]. */
  pic(sizes: number[]): number { return sizes[this.pics()]; },
  /** Metal shine on gifts, plaques and medals. */
  shine(): boolean { return this.S().gfxShine !== false; },
  /** The highest frame rate the 3D views draw (0 = as fast as the screen). */
  fps(): number { const v = this.S().gfxFps; return this.pc() && v ? +v : 0; },

  /** Settings changed: every open 3D view takes them on its next frame. */
  bump() { this.ver++; },

  installed: false,
  /** Every 3D scene drawn on the PC gets the chosen shadows and texture filtering (looked over every few seconds,
   *  so things added later get them too). */
  install() {
    if (this.installed || typeof THREE === 'undefined' || !THREE.WebGLRenderer) return;
    this.installed = true;
    // every renderer made from now on looks over its scenes (three.js puts render() on each renderer itself)
    const Orig = THREE.WebGLRenderer;
    const Made: any = function (this: any, p?: any) { const r = new Orig(p); Gfx.hook(r); return r; };
    Made.prototype = Orig.prototype;
    try { (THREE as any).WebGLRenderer = Made; } catch (e) { /* hooked one by one through pr() */ }
  },
  /** One renderer: before drawing a scene, the chosen shadows and texture filtering (again every few seconds). */
  hook(r: any) {
    if (!r || r.__gfx) return; r.__gfx = true;
    const orig = r.render;
    r.render = function (scene: any, cam: any) {
      try { if (scene && scene.isScene && (Gfx.pc() || Gfx.shadow() >= 0)) { const u = scene.userData, now = performance.now(); if (u.__gfx !== Gfx.ver || now - (u.__gfxAt || 0) > 3000) { u.__gfx = Gfx.ver; u.__gfxAt = now; Gfx.apply(r, scene); } } } catch (e) { /* drawn as made */ }
      return orig.call(this, scene, cam);
    };
  },
  apply(ren: any, scene: any) {
    const sh = this.shadow(), an = this.aniso(), T = THREE;
    const maxTex = (ren.capabilities && ren.capabilities.maxTextureSize) || 4096, maxAn = (ren.capabilities && ren.capabilities.getMaxAnisotropy && ren.capabilities.getMaxAnisotropy()) || 1;
    if (sh >= 0 && ren.shadowMap) { const t = sh >= 2 ? T.PCFSoftShadowMap : T.PCFShadowMap; if (ren.shadowMap.type !== t) ren.shadowMap.type = t; }
    const seen = new Set();
    scene.traverse((o: any) => {
      if (o.isLight && o.shadow) {
        const u = o.userData;
        if (u.gfxCast == null) { u.gfxCast = !!o.castShadow; u.gfxBase = o.shadow.mapSize.x || 512; }
        if (!u.gfxCast) return;
        const on = sh !== 0, size = sh < 0 ? u.gfxBase : Math.min(maxTex, 8192, Math.max(256, Math.round(u.gfxBase * [0, 0.5, 1, 2, 4][sh])));
        o.castShadow = on;
        if (on && o.shadow.mapSize.x !== size) { o.shadow.mapSize.set(size, size); if (o.shadow.map) { o.shadow.map.dispose(); o.shadow.map = null; } }
        return;
      }
      if (!an || !o.material) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (!m || seen.has(m)) continue; seen.add(m);
        for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'bumpMap', 'aoMap', 'alphaMap']) {
          const tx = m[k]; if (!tx || !tx.isTexture || tx.isRenderTargetTexture || !tx.image) continue;
          const want = Math.min(an, maxAn); if (tx.anisotropy !== want) { tx.anisotropy = want; tx.needsUpdate = true; }
        }
      }
    });
  },

  /** The preset that matches every category now ('' = custom). */
  preset(): string {
    const S = this.S();
    for (const p of Object.keys(GFX_PRESETS)) { const v = GFX_PRESETS[p]; if (Object.keys(v).every(k => String(S[k]) === String(v[k]))) return p; }
    return S.gfxScale == null && S.gfxShadow == null && S.gfxLights == null && S.gfxAniso == null && S.gfxRoomQ == null && S.gfxPics == null ? 'auto' : '';
  },
};

/** The presets: every graphics category at once. */
const GFX_PRESETS: { [k: string]: any } = {
  low: { v3dTerrainQ: 0, gfxScale: 0.75, gfxShadow: 0, gfxLights: 0, gfxAniso: 1, gfxRoomQ: 0, gfxPics: 0, gfxShine: false, deskAA: 0, v3dCabinQ: 0, cloudDetail: 1, v3dWater: 'simple', v3dKm: 60, v3dSatQ: 0 },
  medium: { v3dTerrainQ: 1, gfxScale: 1, gfxShadow: 1, gfxLights: 1, gfxAniso: 4, gfxRoomQ: 1, gfxPics: 1, gfxShine: true, deskAA: 1, v3dCabinQ: 1, cloudDetail: 2, v3dWater: 'living', v3dKm: 150, v3dSatQ: 1 },
  high: { v3dTerrainQ: 2, gfxScale: 1, gfxShadow: 3, gfxLights: 2, gfxAniso: 8, gfxRoomQ: 2, gfxPics: 1, gfxShine: true, deskAA: 2, v3dCabinQ: 2, cloudDetail: 3, v3dWater: 'living', v3dKm: 300, v3dSatQ: 2 },
  ultra: { v3dTerrainQ: 4, gfxScale: 1.25, gfxShadow: 4, gfxLights: 2, gfxAniso: 16, gfxRoomQ: 3, gfxPics: 2, gfxShine: true, deskAA: 3, v3dCabinQ: 3, cloudDetail: 4, v3dWater: 'mirror', v3dKm: 500, v3dSatQ: 3 },
};
const GFX_PRESET_NAMES: [string, string][] = [['auto', 'Automatic'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['ultra', 'Ultra']];

/** Settings → Graphics → PC graphics. */
function gfxSettingsHtml(): string {
  const S: any = State.settings, pr = Gfx.preset();
  const seg = (key: string, label: string, hint: string, opts: [string, string][], auto?: string) => {
    const cur = S[key] == null ? 'auto' : String(S[key]);
    const all = (auto ? [['auto', `Automatic (${auto})`] as [string, string]] : []).concat(opts);
    return `<div class="ch-row"><span><b>${label}</b><small>${hint}</small></span><div class="seg">${all.map(o => `<button class="${cur === o[0] ? 'on' : ''}" data-act="gfx-set" data-key="${key}" data-v="${o[0]}">${esc(o[1])}</button>`).join('')}</div></div>`;
  };
  const heavy = (S.gfxScale >= 1.5) || S.gfxShadow === 4 || pr === 'ultra';
  return `<div class="set-card col cab-opts gfx-card">
    <div class="sc-h">${icon('pc')}<span><b>Graphics preset: ${pr === '' ? 'Custom' : GFX_PRESET_NAMES.filter(p => p[0] === pr)[0][1]}</b><small>Sets every graphics category below at once, and the view distance, terrain detail, clouds, cabin, water, satellite detail and anti-aliasing too. Change any one afterwards and the preset shows as Custom.</small></span></div>
    <div class="seg gfx-presets">${GFX_PRESET_NAMES.map(o => `<button class="${pr === o[0] ? 'on' : ''}" data-act="gfx-preset" data-v="${o[0]}">${o[1]}</button>`).join('')}</div>
    ${heavy ? `<p class="v3d-note warn">${icon('alert')}Very high settings might affect performance: they need a strong graphics card.</p>` : pr === 'low' ? `<p class="v3d-note ok">${icon('info')}Low settings might improve performance on slower PCs.</p>` : ''}
    <div class="cab-h">Picture</div>
    <div class="ch-row col"><span><b class="gfx-sc-h">Render scale: ${Math.round(Gfx.scale() * 100)}%</b><small>How many pixels every 3D view, room, the museum and the 3D viewer are drawn with, compared with your screen. Above 100% is sharper and smoother; below is quicker. On top of the resolution and anti-aliasing. Applies the next time a view opens.</small></span>
      <input type="range" class="gfx-scale" min="50" max="200" step="5" value="${Math.round(Gfx.scale() * 100)}" aria-label="Render scale">
      <div class="v3d-scale"><span>50%</span><span>100%</span><span>150%</span><span>200%</span></div></div>
    ${seg('deskAA', 'Anti-aliasing', 'Smooths jagged edges in the 3D view. High and above also draw the picture larger and scale it down.', DESK_AA_NAMES.map((n, i) => [String(i), n] as [string, string]))}
    ${seg('gfxAniso', 'Texture filtering', 'How sharp the ground, runways, walls and floors stay at a slant and in the distance.', GFX_ANISO.map(v => [String(v), v === 1 ? 'Off' : v + '×'] as [string, string]), 'as made')}
    ${seg('gfxFps', 'Frame rate limit', 'The most frames a second the 3D views and rooms draw. Lower keeps the PC cooler and quieter.', GFX_FPS.map(v => [String(v), String(v)] as [string, string]), 'as fast as the screen')}
    <div class="cab-h">Light and shadow</div>
    ${seg('gfxShadow', 'Shadows', 'How sharp shadows are in the rooms, the museum, the 3D viewer, the water salute and the 3D view. Medium and above are soft-edged. Ultra uses shadow maps up to 8192 pixels.', GFX_SHADOW_NAMES.map((n, i) => [String(i), n] as [string, string]), 'as made')}
    ${seg('gfxLights', 'Lighting', 'Drawn: light beams and pools painted in, as on phones. Real lights: every spotlight truly lights the room. With shadows: they also cast shadows.', GFX_LIGHT_NAMES.map((n, i) => [String(i), n] as [string, string]), 'with shadows')}
    ${seg('gfxShine', 'Metal shine', 'The moving shine on the metal of gifts, plaques and medals as you turn them.', [['true', 'On'], ['false', 'Off']])}
    <div class="cab-h">Detail</div>
    ${seg('gfxRoomQ', 'Rooms', 'How finely your offices, the operations room and the courtroom are made: furniture, curves, light and the sharpness they are drawn at. Applies the next time you enter.', GFX_ROOM_NAMES.map((n, i) => [String(i), n] as [string, string]), 'follows the cabin')}
    ${seg('gfxPics', 'Pictures', 'The size of award and milestone pictures, gift and career thumbnails, and the photos you take in photo mode (up to 2560, 3840 or 7680 pixels wide).', GFX_PIC_NAMES.map((n, i) => [String(i), n] as [string, string]), 'High')}
    <p class="fine-print">${icon('info')}View distance, clouds, the cabin, water, sky and satellite detail are in the other parts of Graphics; resolution and display mode are in Display.</p>
  </div>`;
}
ACTIONS['gfx-set'] = el => {
  const S: any = State.settings, k = el.getAttribute('data-key'), v = el.getAttribute('data-v');
  if (v === 'auto') delete S[k]; else S[k] = v === 'true' ? true : v === 'false' ? false : isNaN(+v) ? v : +v;
  Gfx.bump(); Store.save(); Sound.tick(); rerenderSettingsBody();
};
ACTIONS['gfx-preset'] = el => {
  const S: any = State.settings, p = el.getAttribute('data-v');
  if (p === 'auto') { for (const k of ['gfxScale', 'gfxShadow', 'gfxLights', 'gfxAniso', 'gfxRoomQ', 'gfxPics', 'gfxShine', 'gfxFps', 'deskAA', 'v3dCabinQ', 'cloudDetail', 'v3dWater', 'v3dKm', 'v3dSatQ', 'v3dTerrainQ']) delete S[k]; }
  else Object.assign(S, GFX_PRESETS[p] || {});
  Gfx.bump(); Store.save(); Sound.tick(); rerenderSettingsBody();
  toast('Graphics: ' + GFX_PRESET_NAMES.filter(x => x[0] === p)[0][1] + '. Views open now change the next time you open them.', 'ok');
};

/** Settings → Graphics → Light and shadow, on phones and tablets: shadows, lighting and the rooms. Each starts
 *  where the phone draws them today, so nothing changes until one is chosen. */
function gfxPhoneHtml(): string {
  const S: any = State.settings;
  const seg = (key: string, label: string, hint: string, opts: [string, string][], auto: string) => {
    const cur = S[key] == null ? 'auto' : String(S[key]);
    return `<div class="ch-row"><span><b>${label}</b><small>${hint}</small></span><div class="seg">${([['auto', `Automatic (${auto})`]] as [string, string][]).concat(opts).map(o => `<button class="${cur === o[0] ? 'on' : ''}" data-act="gfx-set" data-key="${key}" data-v="${o[0]}">${esc(o[1])}</button>`).join('')}</div></div>`;
  };
  const sh = Gfx.shadow(), li = Gfx.lights();
  return `<div class="set-card col cab-opts gfx-card">
    <div class="sc-h">${icon('layers')}<span><b>Light and shadow</b><small>Each shadow means the room is drawn once more from the light, every frame: on a phone about a fifth to two fifths more work. Strong phones handle it well; on older ones it makes the phone warm and less smooth. Automatic keeps what this ${cabinLowMem() ? 'device' : 'phone or tablet'} draws today.</small></span></div>
    ${seg('gfxShadow', 'Shadows', 'The sunlight through the windows in your offices and the courtroom, the ceiling light in the operations room and the main light in the museum. Off is the quickest.', GFX_SHADOW_NAMES.slice(0, 4).map((n, i) => [String(i), n] as [string, string]), 'as the room quality sets')}
    ${sh === 3 ? `<p class="v3d-note warn">${icon('alert')}High shadows might affect performance: sharper shadows need more graphics memory and work.</p>` : sh === 0 ? `<p class="v3d-note ok">${icon('info')}Shadows off might improve performance on slower phones.</p>` : ''}
    ${seg('gfxLights', 'Lighting', 'Drawn: the light beams and pools in the museum are painted in (quick). Real lights: the eight nearest pieces get a real spotlight that truly lights them and the floor; the rest stay drawn.', GFX_LIGHT_NAMES.slice(0, 2).map((n, i) => [String(i), n] as [string, string]), 'Drawn')}
    ${li >= 1 ? `<p class="v3d-note warn">${icon('alert')}Real lights might affect performance: every surface near them takes longer to draw.</p>` : ''}
    ${seg('gfxRoomQ', 'Rooms', 'How finely your offices, the operations room and the courtroom are made, and how sharply they are drawn. Applies the next time you enter.', GFX_ROOM_NAMES.map((n, i) => [String(i), n] as [string, string]), 'follows the cabin')}
  </div>`;
}

Gfx.install();

// the render scale slider: the value shows while dragging, it's kept when let go
document.addEventListener('input', e => { const el = e.target as HTMLInputElement; if (!el || !el.classList || !el.classList.contains('gfx-scale')) return; const h = el.closest('.ch-row') && el.closest('.ch-row').querySelector('.gfx-sc-h'); if (h) h.textContent = 'Render scale: ' + el.value + '%'; });
document.addEventListener('change', e => { const el = e.target as HTMLInputElement; if (!el || !el.classList || !el.classList.contains('gfx-scale')) return; const v = +el.value / 100; if (v === 1) delete (State.settings as any).gfxScale; else (State.settings as any).gfxScale = v; Gfx.bump(); Store.save(); rerenderSettingsBody(); });
