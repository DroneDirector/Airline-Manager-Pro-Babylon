// Photo mode in the 3D view: the controls go away, and a strip at the bottom offers a look (natural, warm,
// cinematic, black and white, vivid, vintage), black bars for a wide-screen frame and a caption. Move the
// camera as usual (the free camera goes anywhere), then take the picture: it is kept with your screenshots (on
// your laptop and in the flight log), and you can send it to the papers as the photo of the day.

const PHOTO_LOOKS: [string, string, string][] = [
  ['none', 'Natural', ''], ['warm', 'Warm', 'sepia(.22) saturate(1.15) brightness(1.04)'], ['cine', 'Cinematic', 'contrast(1.18) saturate(.82) brightness(.96) hue-rotate(-6deg)'],
  ['bw', 'Black and white', 'grayscale(1) contrast(1.22)'], ['vivid', 'Vivid', 'saturate(1.45) contrast(1.08)'], ['vintage', 'Vintage', 'sepia(.55) contrast(.9) brightness(1.06) saturate(.8)'],
];
const Photo: any = { on: false, look: 'none', bars: false, cap: '', dof: 0 };
const PHOTO_DOF = ['Depth of field: off', 'Depth of field: soft', 'Depth of field: strong'];
function photoFilter(): string { return (PHOTO_LOOKS.filter(l => l[0] === Photo.look)[0] || PHOTO_LOOKS[0])[2]; }
function photoBarHtml(): string {
  return `<div class="ph-bar">${PHOTO_LOOKS.map(l => `<button class="ph-look ${Photo.look === l[0] ? 'on' : ''}" data-act="photo-look" data-l="${l[0]}">${esc(l[1])}</button>`).join('')}
    <button class="ph-look ${Photo.bars ? 'on' : ''}" data-act="photo-bars">${icon('sliders')}Wide frame</button>
    <button class="ph-look ${Photo.dof ? 'on' : ''}" data-act="photo-dof" title="The aircraft (or the middle of the picture) stays sharp; what is nearer or further away blurs by its distance">${icon('focus')}${PHOTO_DOF[Photo.dof]}</button>
    <input class="ph-cap" placeholder="Caption (optional)" value="${esc(Photo.cap)}" maxlength="80" aria-label="Caption">
    <button class="ph-shoot" data-act="photo-shoot" aria-label="Take the picture">${icon('camera')}</button>
    <button class="ph-exit" data-act="photo-mode" aria-label="Leave photo mode">${icon('close')}</button></div>`;
}
function photoApply() {
  if (!V3d.root) return;
  V3d.root.classList.toggle('photo-on', Photo.on); V3d.root.classList.toggle('photo-bars', Photo.on && Photo.bars);
  if (V3d.cv) V3d.cv.style.filter = Photo.on ? photoFilter() : '';
  let bar = V3d.root.querySelector('.ph-wrap') as HTMLElement;
  if (!Photo.on) { if (bar) bar.remove(); return; }
  if (!bar) { bar = document.createElement('div'); bar.className = 'ph-wrap'; V3d.root.appendChild(bar); }
  bar.innerHTML = photoBarHtml();
  const inp = bar.querySelector('.ph-cap') as HTMLInputElement; if (inp) inp.addEventListener('input', () => { Photo.cap = inp.value; });
}
ACTIONS['photo-mode'] = () => { if (!V3d.open) return; Photo.on = !Photo.on; Sound.tick(); photoApply(); };
ACTIONS['photo-look'] = el => { Photo.look = el.getAttribute('data-l'); photoApply(); };
ACTIONS['photo-bars'] = () => { Photo.bars = !Photo.bars; photoApply(); };
ACTIONS['photo-dof'] = () => { Photo.dof = (Photo.dof + 1) % 3; photoApply(); };
ACTIONS['photo-shoot'] = () => {
  if (!V3d.open || !V3d.r || !V3d.cv) return;
  try {
    V3d.r.render(V3d.scene, V3d.cam);
    if (Photo.dof) { try { photoDof(Photo.dof); } catch (e) { V3d.r.render(V3d.scene, V3d.cam); } }
    const src = V3d.cv, k = Math.min(1, Gfx.pic([2560, 3840, 7680]) / Math.max(src.width, src.height)), W = Math.round(src.width * k), H0 = Math.round(src.height * k);
    const bars = Photo.bars ? Math.round(Math.max(0, H0 - W / 2.39) / 2) : 0, H = H0 - bars * 2;
    const big = document.createElement('canvas'); big.width = W; big.height = H; const g = big.getContext('2d') as CanvasRenderingContext2D;
    g.filter = photoFilter() || 'none'; g.drawImage(src, 0, bars / k, src.width, src.height - bars * 2 / k, 0, 0, W, H); g.filter = 'none';
    if (Photo.look === 'vintage' || Photo.look === 'cine') { const gr = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.7); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.45)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
    if (Photo.cap) { const fs = Math.round(H / 26); g.font = `600 ${fs}px Inter, sans-serif`; g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, H - fs * 2.2, W, fs * 2.2); g.fillStyle = '#fff'; g.fillText(Photo.cap, fs, H - fs * 0.8); }
    const th = document.createElement('canvas'), t = 320 / Math.max(W, H); th.width = Math.round(W * t); th.height = Math.round(H * t); (th.getContext('2d') as CanvasRenderingContext2D).drawImage(big, 0, 0, th.width, th.height);
    const f: any = State.live.filter(x => x.id === V3d.target)[0], cap = Photo.cap || `3D view${f ? ` · ${f.reg}, ${f.from} to ${f.to}` : V3d.icao ? ` · ${V3d.icao}` : ''}`;
    const flash = document.createElement('div'); flash.className = 'v3d-flash'; V3d.root.appendChild(flash); setTimeout(() => flash.remove(), 600);
    try { Sound.tick(); } catch (e) { /* quiet */ }
    const small = document.createElement('canvas'), s2 = Gfx.pic([960, 1400, 2000]) / Math.max(W, H); small.width = Math.round(W * s2); small.height = Math.round(H * s2); (small.getContext('2d') as CanvasRenderingContext2D).drawImage(big, 0, 0, small.width, small.height);
    Photo.last = { data: small.toDataURL('image/jpeg', 0.8), cap, reg: f ? f.reg : '', from: f ? f.from : '', to: f ? f.to : '' };
    const full = big.toDataURL('image/jpeg', Gfx.pics() >= 1 ? 0.96 : 0.92);
    Promise.all([PhotoDb.put({ id: uid(), log: '3d', at: Date.now(), data: full, thumb: th.toDataURL('image/jpeg', 0.75), w: W, h: H, cap, mode: Mode.coop() ? 'coop' : 'solo' }).then(() => true, () => false), photoToDevice(full, cap)])
      .then(([inGame, where]) => { if (!inGame && !where) { toast('The photo could not be saved', 'warn'); return; } toast(`Photo saved ${inGame ? 'with your screenshots' : ''}${inGame && where ? ' and ' : ''}${where}`, 'ok', { label: 'To the papers', act: 'photo-news' }); });
  } catch (e) { toast('The photo could not be taken', 'warn'); }
};
/** A photo also onto the device: the phone's gallery (Pictures/Airline Manager Pro, where the Photos app shows it)
 *  or, on the PC, the Pictures folder (Pictures\\Airline Manager Pro). Says where it went. */
function photoToDevice(data: string, cap: string) {
  const d = new Date(), stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}.${String(d.getSeconds()).padStart(2, '0')}`;
  const name = `Airline Manager Pro ${stamp}`;
  const c: any = (window as any).Capacitor, T = c && c.isNativePlatform && c.isNativePlatform() && c.Plugins && c.Plugins.AppTools;
  if (T && T.savePhoto) return T.savePhoto({ data, name: name + '.jpg' }).then(() => 'in your phone\'s gallery (Pictures, Airline Manager Pro)', () => '');
  if (DESKTOP) return fetch('/api/photo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data, name, cap }) }).then(r => r.json()).then(r => r && r.ok ? 'in your Pictures folder (Airline Manager Pro)' : '', () => '');
  return Promise.resolve('');   // in a browser: kept in the game only
}
/** The last photo as the papers' photo of the day (one a day). */
ACTIONS['photo-news'] = () => {
  const L = Photo.last, S: any = State; if (!L) return;
  const day = new Date().toDateString(); if (S.photoNewsDay === day) { toast('The papers have already printed one of your photos today', 'info'); return; }
  S.photoNewsDay = day; const c: any = company();
  try { newsPublish({ paper: newsPaper((apt(c.hub) as any || {}).country || ''), section: 'Photo of the day', place: (apt(c.hub) as any || {}).city || '', headline: L.cap || `${c.name} in pictures`, standfirst: `A reader's photograph${L.reg ? ` of ${L.reg}` : ''}${L.from ? `, ${L.from} to ${L.to}` : ''}.`, body: ['Sent in by ' + ((myPilot() as any).name || 'a reader') + '.'], art: { kind: 'photo', data: L.data } as any, companyId: c.id } as any); } catch (e) { /* no paper */ }
};
document.addEventListener('keydown', (e: KeyboardEvent) => { if (V3d && V3d.open && (e.key === 'h' || e.key === 'H') && !(e.target as HTMLElement).closest('input, textarea')) ACTIONS['photo-mode'](null as any, null as any); });

/** Depth of field for the photo: the scene drawn once more with its depth; what is in focus (the aircraft you
 *  follow, or what is in the middle of the picture) stays sharp, and everything nearer or further blurs by how far
 *  it is from that distance, like a camera's lens. Drawn straight onto the 3D view's canvas for the picture. */
let _dof: any = null;
function photoDof(level: number) {
  const T = THREE, R = V3d.r, cam = V3d.cam, sz = R.getDrawingBufferSize(new T.Vector2());
  if (!_dof) {
    const rt = new T.WebGLRenderTarget(4, 4, { type: T.HalfFloatType }); rt.depthTexture = new T.DepthTexture(4, 4); rt.depthTexture.type = T.UnsignedIntType;
    const mat = new T.ShaderMaterial({
      uniforms: { tCol: { value: rt.texture }, tDep: { value: rt.depthTexture }, uFar: { value: 1 }, uLog: { value: 0 }, uP22: { value: -1 }, uP32: { value: -0.2 }, uNear: { value: 0.1 }, uFocus: { value: 100 }, uAmt: { value: 1 }, uPx: { value: new T.Vector2() } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `uniform sampler2D tCol; uniform sampler2D tDep; uniform float uFar, uLog, uP22, uP32, uNear, uFocus, uAmt; uniform vec2 uPx; varying vec2 vUv;
        float dist(vec2 uv) { float d = texture2D(tDep, uv).x; if (d >= 0.999999) return 1e7;
          if (uLog > 0.5) return exp2(d * log2(uFar + 1.0)) - 1.0;
          float z = d * 2.0 - 1.0; return uP32 / (z + uP22); }
        float coc(float z) { return clamp((abs(z - uFocus) / max(1.0, z) - 0.12) * uAmt, 0.0, 1.0) * 12.0; }
        void main() {
          float c0 = coc(dist(vUv)); vec4 sum = texture2D(tCol, vUv); float n = 1.0;
          for (int i = 0; i < 32; i++) {
            float a = float(i) * 2.39996, r = sqrt(float(i) + 0.5) / sqrt(32.0);
            vec2 o = vec2(cos(a), sin(a)) * r * c0 * uPx;
            vec2 uv = vUv + o; float cs = coc(dist(uv));
            float w = smoothstep(0.0, 1.0, cs / max(0.5, c0 * r));   // sharp things in front never smear over the blur behind
            sum += texture2D(tCol, uv) * w; n += w;
          }
          gl_FragColor = sum / n;   // the finished picture, blurred: no second tone mapping
        }`,
      depthTest: false, depthWrite: false,
    });
    const scene = new T.Scene(), oc = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1), q = new T.Mesh(new T.PlaneGeometry(2, 2), mat); q.frustumCulled = false; scene.add(q);
    _dof = { rt, mat, scene, oc };
  }
  const D = _dof, U = D.mat.uniforms;
  // the picture as it is on the screen now (the blur works on it, so its colours stay exactly as they are)
  const snap = document.createElement('canvas'); snap.width = sz.x; snap.height = sz.y; (snap.getContext('2d') as CanvasRenderingContext2D).drawImage(R.domElement, 0, 0);
  const tex = new T.CanvasTexture(snap); tex.flipY = true; U.tCol.value = tex;
  if (D.rt.width !== sz.x || D.rt.height !== sz.y) D.rt.setSize(sz.x, sz.y);
  // what is in focus: the aircraft you follow, otherwise about 300 m ahead
  let focus = 300; const P = V3d.planes && V3d.planes[V3d.target]; if (P && P.model) focus = Math.max(5, cam.position.distanceTo(P.model.position));
  cam.updateMatrixWorld();
  R.setRenderTarget(D.rt); R.render(V3d.scene, cam); R.setRenderTarget(null);
  U.uFar.value = cam.far; U.uNear.value = cam.near; U.uLog.value = R.capabilities && R.capabilities.logarithmicDepthBuffer ? 1 : 0;
  U.uP22.value = cam.projectionMatrix.elements[10]; U.uP32.value = cam.projectionMatrix.elements[14];
  U.uFocus.value = focus; U.uAmt.value = level === 2 ? 2.4 : 1.1; U.uPx.value.set(1 / sz.x * (sz.y / 900), 1 / sz.y * (sz.y / 900));
  R.render(D.scene, D.oc); tex.dispose();
}
