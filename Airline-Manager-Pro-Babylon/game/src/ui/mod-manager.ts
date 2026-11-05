/* The Mod Manager: opened from the start screen only. The start screen's film keeps playing behind it (darkened and
 * blurred; dimmed further while a 3D preview is open), with the logo top left. Tabs: Installed, Browse, Slots, Co-op.
 * The rules and the files are in src/core/mods.ts. */

const MM: any = { on: false, tab: 'installed', q: '', sort: 'order', cat: 'all', flt: {} as { [k: string]: boolean }, sel: '', prev: null as any, health: null as any, store: null as any, scan: null as any };
const MM_SORTS: [string, string][] = [['order', 'Load order'], ['newest', 'Newest'], ['updated', 'Recently updated'], ['name', 'Name'], ['author', 'Author'], ['size', 'Size'], ['category', 'Category'], ['downloads', 'Most downloaded'], ['rating', 'Rating']];
const MM_FILTERS: [string, string][] = [['on', 'On'], ['off', 'Off'], ['conflicts', 'Conflicts'], ['updates', 'Updates'], ['compatible', 'This version'], ['official', 'Official'], ['community', 'Community'], ['favs', 'Favourites']];

/** Open: the splash ("Loading Mod Manager") while the list, the Mods folder and the check are got ready. */
ACTIONS['ts-mods'] = () => {
  const T = TitleScreen; if (!T.on || MM.on) return; Sound.tick(); titlePanel('');
  MM.on = true; T.root.classList.add('mm-on'); mmPhoneMark();
  const sp = document.createElement('div'); sp.className = 'mm-splash'; sp.innerHTML = `<div class="mm-sp-in"><div class="mm-sp-ring"><i></i><i></i><i></i></div><h2>Loading Mod Manager</h2><div class="mm-sp-bar"><i style="width:0%"></i></div><small>Reading your mods…</small><b class="mm-sp-pct">0%</b></div>`;
  T.root.appendChild(sp); requestAnimationFrame(() => sp.classList.add('in'));
  const step = (k: number, what: string) => { const b = sp.querySelector('.mm-sp-bar i') as HTMLElement; if (b) b.style.width = k + '%'; const s = sp.querySelector('small'); if (s) s.textContent = what; const p = sp.querySelector('.mm-sp-pct'); if (p) p.textContent = Math.round(k) + '%'; };
  const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
  (async () => {
    try { modsSeed(); } catch (e) { /* none */ } step(20, 'Reading your mods…'); await wait(260);
    step(40, DESKTOP ? 'Looking in your Mods folder…' : 'Checking the slots…'); try { MM.scan = await modsFolderScan(); } catch (e) { MM.scan = null; } await wait(220);
    step(65, 'Checking every mod…'); try { MM.health = await modHealth(); } catch (e) { MM.health = null; } await wait(220);
    step(85, 'Measuring storage…'); try { MM.store = await modStorage(); } catch (e) { MM.store = null; } await wait(200);
    step(100, 'Ready'); await wait(320);
    const r = document.createElement('div'); r.className = 'mm'; T.root.appendChild(r); MM.root = r; mmRender();
    requestAnimationFrame(() => { r.classList.add('in'); sp.classList.add('out'); setTimeout(() => sp.remove(), 500); });
    if (MM.scan && MM.scan.added.length) toast(`From your Mods folder: ${MM.scan.added.join(', ')}`, 'ok');
    if (MM.scan && MM.scan.failed.length) toast(`${MM.scan.failed.length} package${MM.scan.failed.length === 1 ? '' : 's'} in your Mods folder couldn't be installed`, 'info');
  })();
};
ACTIONS['mm-close'] = () => { Sound.tick(); mmPreviewClose(); const T = TitleScreen; if (MM.root) { MM.root.classList.remove('in'); const r = MM.root; setTimeout(() => r.remove(), 350); } MM.root = null; MM.on = false; MM.sel = ''; if (T.root) T.root.classList.remove('mm-on', 'mm-dim', 'mm-phone'); };

/** Phones get their own layout (the whole page scrolls, smaller header and tools, details over the list). Decided
 *  by the device's screen, not the window: tablets (the iPad mini and up) and the PC keep the full layout. */
function mmPhone(): boolean { if (DESKTOP) return false; const w = screen.width || innerWidth, h = screen.height || innerHeight; return Math.min(w, h) < 600; }
function mmPhoneMark() { const on = mmPhone(); if (MM.root) { MM.root.classList.toggle('phone', on); if (on && !MM.root._sc) { MM.root._sc = 1; MM.root.addEventListener('scroll', () => MM.root && MM.root.classList.toggle('scrolled', MM.root.scrollTop > 60), { passive: true }); } } if (TitleScreen.root) TitleScreen.root.classList.toggle('mm-phone', on && MM.on); }

/* ---------- the list ---------- */
interface MmRow { id: string; name: string; author: string; version: string; game: string; cat: string; desc: string; size: number; date: number; downloads: number; rating: number; official: boolean; demo: boolean; installed: ModRec | null; slots: string[]; tint: string }
function mmRows(): MmRow[] {
  const S = modsState(), dem: any = {}; for (const d of MOD_DEMO) dem[d.id] = d;
  if (MM.tab === 'installed') return S.order.map(id => modById(id)).filter(Boolean).map((m: any) => { const d = dem[m.id] || {}; return { id: m.id, name: m.name, author: m.author, version: m.version, game: m.game, cat: m.cat, desc: m.desc, size: m.size, date: m.updated || m.installed, downloads: d.downloads || 0, rating: S.ratings[m.id] || d.rating || 0, official: !!m.official, demo: !!m.demo, installed: m, slots: Object.keys(m.files), tint: d.tint || mmTint(m.id) }; });
  return MOD_DEMO.map(d => ({ id: d.id, name: d.name, author: d.author, version: d.version, game: d.game, cat: d.cat, desc: d.desc, size: d.size, date: Date.parse(d.date), downloads: d.downloads, rating: S.ratings[d.id] || d.rating, official: d.official, demo: true, installed: modById(d.id), slots: d.slots.filter(s => !!modSlot(s)), tint: d.tint }));
}
function mmTint(id: string): string { const h = _hashStr(id) % 360; return `hsl(${h} 60% 52%)`; }
function mmFiltered(): MmRow[] {
  const S = modsState(), q = MM.q.trim().toLowerCase(), F = MM.flt, conf = modConflicts();
  let L = mmRows().filter(r => (MM.cat === 'all' || r.cat === MM.cat) && (!q || (r.name + ' ' + r.author + ' ' + r.slots.join(' ') + ' ' + r.id).toLowerCase().indexOf(q) >= 0));
  if (F.on) L = L.filter(r => r.installed && r.installed.on); if (F.off) L = L.filter(r => !r.installed || !r.installed.on);
  if (F.conflicts) L = L.filter(r => conf.some(c => c.mods.indexOf(r.id) >= 0)); if (F.updates) L = L.filter(r => r.installed && modUpdate(r.installed));
  if (F.compatible) L = L.filter(r => modCompatible(r)); if (F.official) L = L.filter(r => r.official); if (F.community) L = L.filter(r => !r.official);
  if (F.favs) L = L.filter(r => S.favs.indexOf(r.id) >= 0);
  const by: any = { newest: (a: MmRow, b: MmRow) => (b.installed ? b.installed.installed : b.date) - (a.installed ? a.installed.installed : a.date), updated: (a: MmRow, b: MmRow) => b.date - a.date, name: (a: MmRow, b: MmRow) => a.name.localeCompare(b.name), author: (a: MmRow, b: MmRow) => a.author.localeCompare(b.author) || a.name.localeCompare(b.name), size: (a: MmRow, b: MmRow) => b.size - a.size, category: (a: MmRow, b: MmRow) => a.cat.localeCompare(b.cat) || a.name.localeCompare(b.name), downloads: (a: MmRow, b: MmRow) => b.downloads - a.downloads, rating: (a: MmRow, b: MmRow) => b.rating - a.rating };
  const sort = MM.sort === 'order' && MM.tab !== 'installed' ? 'downloads' : MM.sort;
  if (by[sort]) L = L.slice().sort(by[sort]);
  return L;
}
function mmSize(b: number): string { return b >= 1e9 ? (b / 1e9).toFixed(1) + ' GB' : b >= 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1e3)) + ' KB'; }
function mmStars(r: number, id?: string): string { let s = ''; for (let i = 1; i <= 5; i++) s += id ? `<button class="mm-star ${r >= i - 0.25 ? 'on' : ''}" data-act="mm-rate" data-id="${esc(id)}" data-n="${i}" aria-label="${i} stars">★</button>` : `<i class="${r >= i - 0.25 ? 'on' : ''}">★</i>`; return `<span class="mm-stars">${s}</span>`; }
function mmCatName(c: string): string { return (MOD_CATS.filter(x => x[0] === c)[0] || [c, c])[1]; }
/** A picture for a mod without screenshots: its colour and kind, drawn (demo). */
function mmShot(r: { id: string; cat: string; tint: string; name: string }, k: number, w = 320, h = 180): string {
  const key = r.id + k + w; MM.shots = MM.shots || {}; if (MM.shots[key]) return MM.shots[key];
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d') as CanvasRenderingContext2D, rnd = (() => { let s = _hashStr(r.id + k); return () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296); })();
  const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, k % 2 ? '#1B1446' : '#0E2A4A'); sky.addColorStop(0.62, k % 2 ? '#FF6FB4' : '#F5A66B'); sky.addColorStop(0.63, '#141020'); sky.addColorStop(1, '#2A2238'); g.fillStyle = sky; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(53,240,255,.35)'; g.lineWidth = 1; for (let i = -10; i <= 10; i++) { g.beginPath(); g.moveTo(w / 2, h * 0.63); g.lineTo(w / 2 + i * w * 0.12, h); g.stroke(); }
  for (let i = 0; i < 4; i++) { const y = h * 0.63 + (h * 0.37) * Math.pow(i / 4 + 0.15, 1.6); g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  g.fillStyle = r.tint; g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 2; const cx = w * (0.4 + rnd() * 0.2), cy = h * 0.6, s = h * 0.32;
  g.beginPath();
  if (r.cat === 'aircraft' || r.cat === 'helicopters') { g.ellipse(cx, cy - s * 0.3, s * 1.5, s * 0.22, -0.05, 0, Math.PI * 2); g.fill(); g.stroke(); g.beginPath(); g.moveTo(cx - s * 0.2, cy - s * 0.3); g.lineTo(cx + s * 0.5, cy + s * 0.25); g.lineTo(cx + s * 0.75, cy + s * 0.2); g.lineTo(cx + s * 0.35, cy - s * 0.3); g.closePath(); g.fill(); g.stroke(); g.beginPath(); g.moveTo(cx - s * 1.3, cy - s * 0.4); g.lineTo(cx - s * 1.55, cy - s * 0.95); g.lineTo(cx - s * 1.3, cy - s * 0.95); g.lineTo(cx - s * 1.05, cy - s * 0.4); g.closePath(); }
  else if (r.cat === 'vehicles') { g.roundRect(cx - s * 1.1, cy - s * 0.7, s * 1.5, s * 0.75, 6); g.roundRect(cx + s * 0.45, cy - s * 0.95, s * 0.65, s, 6); g.fill(); g.stroke(); g.beginPath(); g.fillStyle = '#111'; for (const x of [-0.7, 0.1, 0.75]) { g.moveTo(cx + s * x + s * 0.2, cy + s * 0.08); g.arc(cx + s * x, cy + s * 0.08, s * 0.2, 0, Math.PI * 2); } }
  else if (r.cat === 'people') { g.arc(cx, cy - s * 1.05, s * 0.28, 0, Math.PI * 2); g.fill(); g.stroke(); g.beginPath(); g.roundRect(cx - s * 0.42, cy - s * 0.72, s * 0.84, s * 0.95, 14); }
  else if (r.cat === 'buildings') { g.moveTo(cx - s * 1.5, cy + s * 0.1); g.lineTo(cx - s * 1.5, cy - s * 0.6); g.quadraticCurveTo(cx, cy - s * 1.5, cx + s * 1.5, cy - s * 0.6); g.lineTo(cx + s * 1.5, cy + s * 0.1); g.closePath(); }
  else if (r.cat === 'effects') { for (let i = 0; i < 7; i++) { g.moveTo(cx + (rnd() - 0.5) * s * 2 + s * 0.4, cy - rnd() * s); g.arc(cx + (rnd() - 0.5) * s * 2, cy - rnd() * s, s * (0.25 + rnd() * 0.35), 0, Math.PI * 2); } }
  else { g.roundRect(cx - s * 0.35, cy - s * 1.1, s * 0.7, s * 1.2, 10); g.roundRect(cx + s * 0.55, cy - s * 0.75, s * 0.45, s * 0.85, 8); g.roundRect(cx - s * 1.0, cy - s * 0.55, s * 0.45, s * 0.65, 8); }
  g.fill(); g.stroke();
  g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, h - 22, w, 22); g.fillStyle = '#fff'; g.font = '600 12px Inter, Arial, sans-serif'; g.fillText(r.name, 8, h - 7);
  return (MM.shots[key] = cv.toDataURL('image/jpeg', 0.85));
}

/* ---------- drawing the page ---------- */
function mmRender() {
  const r = MM.root; if (!r) return; mmPhoneMark(); const S = modsState(), conf = modConflicts(), ups = S.mods.filter(m => modUpdate(m)).length, coop = (() => { try { return coopOn(); } catch (e) { return false; } })();
  const tabs: [string, string, number | string][] = [['installed', 'Installed', S.mods.length], ['browse', 'Browse', MOD_DEMO.length], ['slots', 'Slots', modSlots().length]];
  if (coop) tabs.push(['coop', 'Co-op', '']);
  const st = MM.store, quota = st && st.quota ? st.quota : 0;
  r.innerHTML = `<div class="mm-top">
      <div class="mm-title"><h1>Mod Manager</h1><small>Replace models, pictures and sounds. Your game's own files are never changed.</small></div>
      <div class="mm-tools">
        <label class="mm-prof">${icon('layers')}<select data-mm="profile" aria-label="Profile">${Object.keys(S.profiles).concat(Object.keys(S.profiles).indexOf(S.profile) < 0 ? [S.profile] : []).map(n => `<option ${n === S.profile ? 'selected' : ''}>${esc(n)}</option>`).join('')}<option value="__new">New profile…</option></select></label>
        <button class="mm-tb" data-act="mm-profile-save" title="Save which mods are on, and their order, as this profile">${icon('check')}Save profile</button>
        <button class="mm-tb" data-act="mm-health">${icon('shield')}Health check</button>
        <button class="mm-tb" data-act="mm-undo" ${S.undo.length ? '' : 'disabled'}>${icon('back')}Undo</button>
        <label class="mm-alloff"><span>All mods off</span><button class="tg ${S.allOff ? 'on' : ''}" role="switch" aria-checked="${S.allOff}" data-act="mm-alloff"><i></i></button></label>
        <button class="mm-tb hot" data-act="mm-import">${icon('download')}${DESKTOP ? 'Install a .zip' : 'Open a .zip'}</button>
        ${DESKTOP ? `<button class="mm-tb" data-act="mm-folder" title="Documents\\Airline Manager Pro\\Mods">${icon('store')}Mods folder</button>` : ''}
        <button class="ts-x" data-act="mm-close" aria-label="Close">${icon('close')}</button>
      </div></div>
    <div class="mm-tabs">${tabs.map(t => `<button class="mm-tab ${MM.tab === t[0] ? 'on' : ''}" data-act="mm-tab" data-t="${t[0]}">${t[1]}${t[2] !== '' ? `<em>${t[2]}</em>` : ''}${t[0] === 'installed' && ups ? `<span class="mm-badge">${ups} update${ups === 1 ? '' : 's'}</span>` : ''}${t[0] === 'installed' && conf.length ? `<span class="mm-badge warn">${conf.length} conflict${conf.length === 1 ? '' : 's'}</span>` : ''}</button>`).join('')}</div>
    ${S.allOff ? `<div class="mm-note">${icon('info')}All mods are off: the game uses its own models. Your mods and their order are kept.</div>` : ''}
    ${MM.health ? `<div class="mm-health ${MM.health.ok ? 'ok' : 'bad'}">${MM.health.lines.slice(0, 4).map((l: [string, string]) => `<span class="${l[0]}">${icon(l[0] === 'ok' ? 'check' : 'alert')}${esc(l[1])}</span>`).join('')}${MM.health.lines.length > 4 ? `<small>and ${MM.health.lines.length - 4} more</small>` : ''}<button class="ts-x" data-act="mm-health-close" aria-label="Close">${icon('close')}</button></div>` : ''}
    <div class="mm-body ${MM.sel ? 'has-det' : ''}">
      <div class="mm-main">${MM.tab === 'slots' ? mmSlotsHtml() : MM.tab === 'coop' ? mmCoopHtml() : mmListHtml()}</div>
      ${MM.sel ? `<aside class="mm-det">${mmDetailHtml(MM.sel)}</aside>` : ''}
    </div>
    <div class="mm-foot"><span>${icon('layers')}Mods: <b>${mmSize(st ? st.mods : 0)}</b></span>${quota ? `<span class="mm-quota"><i style="width:${Math.min(100, 100 * st.used / quota).toFixed(1)}%"></i></span><span>${mmSize(st.used)} of ${mmSize(quota)} on this device</span>` : ''}<span class="mm-foot-r">Mods are checked on install: models, pictures and sounds only, no code.</span></div>`;
  const inp = r.querySelector('[data-mm="q"]') as HTMLInputElement; if (inp && MM.focusQ) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); MM.focusQ = false; }
}
function mmListHtml(): string {
  const L = mmFiltered(), S = modsState(), conf = modConflicts(), drag = MM.tab === 'installed' && MM.sort === 'order' && !MM.q && MM.cat === 'all' && !Object.keys(MM.flt).some(k => MM.flt[k]);
  return `<div class="mm-bar">
      <label class="mm-search">${icon('search')}<input data-mm="q" placeholder="Search by name, author or slot ID" value="${esc(MM.q)}"></label>
      <label class="mm-sel"><span>Sort</span><select data-mm="sort">${MM_SORTS.filter(s => MM.tab === 'installed' || s[0] !== 'order').map(s => `<option value="${s[0]}" ${MM.sort === s[0] ? 'selected' : ''}>${s[1]}</option>`).join('')}</select></label>
      <label class="mm-sel"><span>Category</span><select data-mm="cat"><option value="all">All</option>${MOD_CATS.map(c => `<option value="${c[0]}" ${MM.cat === c[0] ? 'selected' : ''}>${c[1]}</option>`).join('')}</select></label>
    </div>
    <div class="mm-chips">${MM_FILTERS.map(f => `<button class="mm-chip ${MM.flt[f[0]] ? 'on' : ''}" data-act="mm-flt" data-f="${f[0]}">${f[1]}</button>`).join('')}</div>
    ${drag ? `<p class="mm-hint">${icon('sliders')}Drag to change the load order: when two mods replace the same thing, the lower one wins (unless you choose a winner in its details).</p>` : ''}
    <div class="mm-list" ${drag ? 'data-drag="1"' : ''}>${L.map((r, i) => { const m = r.installed, up = m ? modUpdate(m) : '', cf = conf.filter(c => c.mods.indexOf(r.id) >= 0), cm = modCoopMark(r.id), fav = S.favs.indexOf(r.id) >= 0;
      return `<div class="mm-card ${MM.sel === r.id ? 'sel' : ''} ${m && !m.on ? 'off' : ''}" data-id="${esc(r.id)}" style="--i:${i}">
        ${drag ? `<span class="mm-grip" data-grip="${esc(r.id)}" aria-label="Drag to reorder">⋮⋮</span><span class="mm-n">${i + 1}</span>` : ''}
        <button class="mm-thumb" data-act="mm-open" data-id="${esc(r.id)}"><img src="${m && m.shots[0] ? m.shots[0] : mmShot(r, 0, 160, 90)}" alt=""></button>
        <button class="mm-txt" data-act="mm-open" data-id="${esc(r.id)}"><b>${esc(r.name)}</b><small>${esc(r.author)} · v${esc(r.version)} · ${esc(mmCatName(r.cat))} · ${mmSize(r.size)}</small>
          <span class="mm-tags">${r.demo ? '<i class="t-demo">Demo</i>' : ''}${r.official ? '<i class="t-off">Official</i>' : '<i class="t-com">Community</i>'}${up ? `<i class="t-up">Update ${esc(up)}</i>` : ''}${cf.length ? `<i class="t-cf">Conflict</i>` : ''}${!modCompatible(r) ? '<i class="t-old">Older game version</i>' : ''}${cm === 'both' ? '<i class="t-co">Co-op: you both have it</i>' : cm === 'theirs' ? '<i class="t-cw">Co-op: your partner has it</i>' : cm === 'mine' ? '<i class="t-cw">Co-op: only you</i>' : ''}</span></button>
        <span class="mm-meta">${mmStars(r.rating)}<small>${r.downloads ? r.downloads.toLocaleString() + ' downloads' : ''}</small></span>
        <button class="mm-fav ${fav ? 'on' : ''}" data-act="mm-fav" data-id="${esc(r.id)}" aria-label="Favourite">${fav ? '♥' : '♡'}</button>
        ${MM.tab === 'installed' && m ? `<button class="tg ${m.on ? 'on' : ''}" role="switch" aria-checked="${m.on}" data-act="mm-toggle" data-id="${esc(r.id)}"><i></i></button>` : m ? `<span class="mm-have">${icon('check')}Installed</span>` : `<button class="mm-tb hot sm" data-act="mm-get" data-id="${esc(r.id)}">${icon('download')}Install</button>`}
      </div>`; }).join('') || `<div class="mm-empty">${MM.tab === 'installed' ? 'No mods match. Browse for some, or open a .zip.' : 'Nothing matches.'}</div>`}</div>`;
}
function mmDetailHtml(id: string): string {
  const r = mmRows().concat(MM.tab === 'installed' ? [] : []).filter(x => x.id === id)[0] || (() => { const save = MM.tab; MM.tab = 'browse'; const x = mmRows().filter(y => y.id === id)[0]; MM.tab = save; return x; })(); if (!r) return '';
  const m = r.installed, up = m ? modUpdate(m) : '', conf = modConflicts().filter(c => c.mods.indexOf(id) >= 0), S = modsState(), d = MOD_DEMO.filter(x => x.id === id)[0];
  const log = m ? m.changelog : d ? d.changelog : [], deps = m ? m.depends : [];
  const shots = m && m.shots.length ? m.shots : [0, 1, 2].map(k => mmShot(r, k));
  return `<div class="mm-dh"><h2>${esc(r.name)}</h2><button class="ts-x" data-act="mm-open" data-id="" aria-label="Close">${icon('close')}</button></div>
    <div class="mm-shots">${shots.map((s: string) => `<img src="${s}" alt="">`).join('')}</div>
    <p class="mm-desc">${esc(r.desc)}</p>
    ${r.demo ? `<p class="mm-demo">${icon('info')}Demo content: it shows how mods work. It has no files, so the game's own models stay.</p>` : ''}
    <dl class="mm-dl"><dt>Author</dt><dd>${esc(r.author)}${r.official ? ' <i class="t-off">Official</i>' : ''}</dd><dt>Version</dt><dd>${esc(r.version)}${up ? ` <i class="t-up">${esc(up)} available</i>` : ''}</dd>
      <dt>Made for</dt><dd>Game ${esc(r.game || '?')}${modCompatible(r) ? '' : ` <i class="t-old">you have ${esc(APP.version)}</i>`}</dd><dt>Size</dt><dd>${mmSize(r.size)}</dd>
      <dt>${m ? 'Installed' : 'Released'}</dt><dd>${esc(dateStr(new Date(m ? m.installed : r.date)).slice(0, 10))}</dd><dt>Downloads</dt><dd>${r.downloads ? r.downloads.toLocaleString() : '-'}</dd>
      <dt>Your rating</dt><dd>${mmStars(S.ratings[id] || 0, id)}</dd><dt>Needs</dt><dd>${deps.length ? deps.map(x => { const y = modById(x); return `<i class="${y && y.on ? 't-off' : 't-cf'}">${esc(y ? y.name : x)}${y ? (y.on ? '' : ' (off)') : ' (missing)'}</i>`; }).join(' ') : 'Nothing else'}</dd></dl>
    <h3>Replaces (slot IDs)</h3>
    <div class="mm-slots">${r.slots.map(s => { const sl = modSlot(s), c = conf.filter(x => x.slot === s)[0];
      return `<div class="mm-slot"><span><code>${esc(s)}</code><small>${sl ? esc(sl.name) : 'not in this game'}</small>${c ? `<small class="cf">${icon('alert')}Also replaced by ${c.mods.filter(x => x !== id).map(x => esc((modById(x) || { name: x }).name)).join(', ')} · ${c.winner === id ? '<b>this one is used</b>' : `<button class="mm-link" data-act="mm-win" data-slot="${esc(s)}" data-id="${esc(id)}">Use this one</button>`}</small>` : ''}</span>
        ${sl ? `<button class="mm-tb sm" data-act="mm-preview" data-slot="${esc(s)}" data-id="${esc(id)}">${icon('focus')}Preview</button>` : ''}</div>`; }).join('')}</div>
    <h3>Changes</h3><ul class="mm-log">${log.map(l => `<li>${esc(l)}</li>`).join('') || '<li>None listed.</li>'}</ul>
    <div class="mm-dact">${m ? `${up ? `<button class="mm-tb hot" data-act="mm-update" data-id="${esc(id)}">${icon('download')}Update to ${esc(up)}</button>` : ''}<button class="mm-tb" data-act="mm-toggle" data-id="${esc(id)}">${m.on ? 'Switch off' : 'Switch on'}</button><button class="mm-tb danger" data-act="mm-remove" data-id="${esc(id)}">${icon('trash')}Remove</button>` : `<button class="mm-tb hot" data-act="mm-get" data-id="${esc(id)}">${icon('download')}Install</button>`}</div>`;
}
function mmSlotsHtml(): string {
  const q = MM.q.trim().toLowerCase(), W = modWinnerMap();
  const L = modSlots().filter(s => (MM.cat === 'all' || s.cat === MM.cat) && (!q || (s.id + ' ' + s.name).toLowerCase().indexOf(q) >= 0));
  return `<div class="mm-bar"><label class="mm-search">${icon('search')}<input data-mm="q" placeholder="Search slot IDs" value="${esc(MM.q)}"></label>
      <label class="mm-sel"><span>Category</span><select data-mm="cat"><option value="all">All</option>${MOD_CATS.map(c => `<option value="${c[0]}" ${MM.cat === c[0] ? 'selected' : ''}>${c[1]}</option>`).join('')}</select></label></div>
    <p class="mm-hint">${icon('info')}Every replaceable thing has a slot ID that never changes. A mod's mod.json lists the slot IDs it replaces, with its file for each. ${L.length} of ${modSlots().length} slots shown.</p>
    <div class="mm-tbl"><div class="mm-tr mm-th"><span>Slot ID</span><span>What</span><span>File</span><span>Limits</span><span>Scale and front</span><span>Now</span></div>
    ${L.slice(0, 400).map(s => { const w = W[s.id]; return `<div class="mm-tr"><span><code>${esc(s.id)}</code></span><span>${esc(s.name)}</span><span>.${s.type}</span><span>${s.maxMb} MB${s.maxTris ? `, ${(s.maxTris / 1000).toLocaleString()}k triangles` : ''}</span><span>${esc(s.scale)}${s.front !== '-' ? '; ' + esc(s.front) : ''}</span><span>${w ? `<i class="t-up">${esc(w.name)}</i>` : '<small>Game\'s own</small>'}</span></div>`; }).join('')}</div>`;
}
function mmCoopHtml(): string {
  const C = modCoopCompare(); const li = (a: any[], f: (x: any) => string) => a.length ? `<ul>${a.map(x => `<li>${f(x)}</li>`).join('')}</ul>` : '<p class="mm-hint">None.</p>';
  const same = !C.mineOnly.length && !C.theirsOnly.length;
  return `<div class="mm-coop"><p class="mm-note ${same ? 'ok' : ''}">${icon(same ? 'check' : 'info')}${same ? 'You and your co-op partners have the same mods: everyone sees the same thing.' : 'Your mods and your partners\' differ. Mods only change how things look on each device, so you can still fly together; to see the same thing, install the same mods.'}</p>
    <h3>You both have</h3>${li(C.both, x => `${esc(x.name)} <small>v${esc(x.version)}</small>`)}
    <h3>Your partner has a mod you don't</h3>${li(C.theirsOnly, x => `${esc(x.mod.name)} <small>${esc(x.who)}</small> ${MOD_DEMO.some(d => d.id === x.mod.id) && !modById(x.mod.id) ? `<button class="mm-link" data-act="mm-get" data-id="${esc(x.mod.id)}">Install it</button>` : ''}`)}
    <h3>Only you have</h3>${li(C.mineOnly, x => `${esc(x.name)} <small>v${esc(x.version)}</small>`)}</div>`;
}

/* ---------- what you do ---------- */
ACTIONS['mm-tab'] = el => { MM.tab = el.getAttribute('data-t') || 'installed'; if (MM.tab !== 'installed' && MM.sort === 'order') MM.sort = 'downloads'; if (MM.tab === 'installed') MM.sort = 'order'; MM.sel = ''; Sound.tick(); mmRender(); };
ACTIONS['mm-open'] = el => { MM.sel = el.getAttribute('data-id') || ''; Sound.tick(); mmRender(); };
ACTIONS['mm-flt'] = el => { const f = el.getAttribute('data-f') || ''; MM.flt[f] = !MM.flt[f]; if (f === 'on' && MM.flt.on) MM.flt.off = false; if (f === 'off' && MM.flt.off) MM.flt.on = false; if (f === 'official' && MM.flt.official) MM.flt.community = false; if (f === 'community' && MM.flt.community) MM.flt.official = false; Sound.tick(); mmRender(); };
ACTIONS['mm-toggle'] = el => { modToggle(el.getAttribute('data-id') || ''); Sound.tick(); mmRender(); };
ACTIONS['mm-alloff'] = () => { modsAllOff(!modsState().allOff); Sound.tick(); mmRender(); };
ACTIONS['mm-fav'] = el => { const S = modsState(), id = el.getAttribute('data-id') || '', i = S.favs.indexOf(id); if (i >= 0) S.favs.splice(i, 1); else S.favs.push(id); modsSave(); Sound.tick(); mmRender(); };
ACTIONS['mm-rate'] = el => { const S = modsState(); S.ratings[el.getAttribute('data-id') || ''] = +(el.getAttribute('data-n') || 0); modsSave(); Sound.tick(); mmRender(); };
ACTIONS['mm-win'] = el => { modWin(el.getAttribute('data-slot') || '', el.getAttribute('data-id') || ''); Sound.tick(); toast('Chosen: that mod is used for this slot', 'ok'); mmRender(); };
ACTIONS['mm-get'] = el => { const id = el.getAttribute('data-id') || '', m = modDemoInstall(id); if (m) { Sound.tick(); toast(`${m.name} installed (demo)`, 'ok'); modStorage().then(s => { MM.store = s; mmRender(); }); } mmRender(); };
ACTIONS['mm-update'] = el => { const m = modById(el.getAttribute('data-id') || ''); if (!m) return; const v = modUpdate(m); if (!v) return; modDemoInstall(m.id, v); Sound.tick(); toast(`${m.name} updated to ${v}`, 'ok'); mmRender(); };
ACTIONS['mm-remove'] = el => { const m = modById(el.getAttribute('data-id') || ''); if (!m) return; modRemove(m.id); Sound.tick(); toast(`${m.name} removed. Undo brings it back.`, 'info'); modStorage().then(s => { MM.store = s; mmRender(); }); mmRender(); };
ACTIONS['mm-undo'] = () => { if (modsUndo()) { Sound.tick(); toast('Undone', 'info'); } mmRender(); };
ACTIONS['mm-health'] = () => { Sound.tick(); modHealth().then(h => { MM.health = h; mmRender(); }); };
ACTIONS['mm-health-close'] = () => { MM.health = null; mmRender(); };
ACTIONS['mm-profile-save'] = () => { const S = modsState(); modProfileSave(S.profile || 'Default'); Sound.tick(); toast(`Profile "${S.profile}" saved`, 'ok'); mmRender(); };
ACTIONS['mm-folder'] = () => { Sound.tick(); fetch('/api/mods/open', { method: 'POST' }).catch(() => { /* none */ }); toast('Put mod .zip files in Documents\\Airline Manager Pro\\Mods; they are installed when the Mod Manager opens', 'info'); };
ACTIONS['mm-import'] = () => {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.zip,application/zip'; inp.multiple = true;
  inp.onchange = async () => {
    for (const f of Array.from(inp.files || [])) {
      try { const C = modCheck(await modUnzip(await f.arrayBuffer()));
        if (!C.ok) { mmReport(f.name, C); continue; }
        const m = await modInstall(C, 'zip'); toast(`${m.name} ${m.version} installed${C.warnings.length ? ' (with notes)' : ''}`, 'ok'); if (C.warnings.length) mmReport(f.name, C);
      } catch (e: any) { toast(`${f.name}: ${e && e.message || e}`, 'info'); }
    }
    MM.store = await modStorage(); MM.tab = 'installed'; mmRender();
  };
  inp.click();
};
/** What the check found in a package. */
function mmReport(name: string, C: ModCheck) {
  const r = MM.root; if (!r) return; const d = document.createElement('div'); d.className = 'mm-report';
  d.innerHTML = `<div class="mm-rep-in"><div class="mm-dh"><h2>${C.ok ? 'Installed with notes' : 'Not installed'}</h2><button class="ts-x" aria-label="Close">${icon('close')}</button></div><p><b>${esc(name)}</b></p>${C.errors.map(e => `<p class="bad">${icon('alert')}${esc(e)}</p>`).join('')}${C.warnings.map(e => `<p class="warn">${icon('info')}${esc(e)}</p>`).join('')}<p class="mm-hint">The modding guide explains the package and every slot.</p></div>`;
  d.querySelector('.ts-x')!.addEventListener('click', () => d.remove()); r.appendChild(d);
}
// search, sort, category, profile
document.addEventListener('input', e => { const t = e.target as HTMLInputElement; if (!MM.on || !t || t.getAttribute('data-mm') !== 'q') return; MM.q = t.value; MM.focusQ = true; clearTimeout(MM.qt); MM.qt = setTimeout(mmRender, 120); });
document.addEventListener('change', e => {
  const t = e.target as HTMLSelectElement; if (!MM.on || !t) return; const k = t.getAttribute('data-mm');
  if (k === 'sort') { MM.sort = t.value; mmRender(); } else if (k === 'cat') { MM.cat = t.value; mmRender(); }
  else if (k === 'profile') { if (t.value === '__new') { const n = (prompt('Name of the new profile') || '').trim(); if (n) { modProfileSave(n); toast(`Profile "${n}" made from the mods on now`, 'ok'); } } else modProfileLoad(t.value); mmRender(); }
});
// dragging the load order
document.addEventListener('pointerdown', e => {
  const g = (e.target as HTMLElement).closest && (e.target as HTMLElement).closest('[data-grip]') as HTMLElement; if (!MM.on || !g) return;
  e.preventDefault(); const list = g.closest('.mm-list') as HTMLElement, card = g.closest('.mm-card') as HTMLElement, id = g.getAttribute('data-grip') || '';
  const cards = Array.from(list.querySelectorAll('.mm-card')) as HTMLElement[], y0 = e.clientY; card.classList.add('drag'); let to = cards.indexOf(card);
  const mv = (ev: PointerEvent) => { card.style.transform = `translateY(${ev.clientY - y0}px)`; const mids = cards.map(c => { const b = c.getBoundingClientRect(); return b.top + b.height / 2; }); to = 0; for (let i = 0; i < mids.length; i++) if (cards[i] !== card && ev.clientY > mids[i]) to++; cards.forEach((c, i) => c.classList.toggle('gap', c !== card && i === (to >= cards.indexOf(card) ? to : to))); };
  const up = () => { document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); card.classList.remove('drag'); card.style.transform = ''; const S = modsState(), from = S.order.indexOf(id);
    if (to !== from) { modMove(id, to); Sound.tick(); } mmRender(); };
  document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up);
});

/* ---------- preview: the game's own beside the replacement ---------- */
ACTIONS['mm-preview'] = el => { mmPreview(el.getAttribute('data-slot') || '', el.getAttribute('data-id') || ''); };
function mmPreviewClose() { const P = MM.prev; if (!P) return; P.stop = true; try { P.ren.dispose(); } catch (e) { /* gone */ } P.el.remove(); MM.prev = null; if (TitleScreen.root) TitleScreen.root.classList.remove('mm-dim'); }
ACTIONS['mm-preview-close'] = () => { Sound.tick(); mmPreviewClose(); };
/** The game's own model for a slot (built the way the game builds it), or a stand-in for the kinds it draws elsewhere. */
function mmOwnModel(slot: ModSlot): any {
  const T = THREE;
  try {
    if (slot.cat === 'aircraft') { const a = AIRCRAFT.filter(x => aircraftModelFile(x.id) === slot.id + '.glb')[0]; if (a) { const c = company(); return buildAircraftModel(a.id, liveryFor(c ? c.color : '#2E6BD8', c ? (c as any).color2 : '#ffffff', c ? c.id : undefined)); } }
    if (slot.cat === 'helicopters') { const id = Object.keys(HELI_SPECS).filter(x => helicopterModelFile(x) === slot.id + '.glb')[0]; if (id) return buildHelicopterModel(id, liveryFor('#C2364A', '#ffffff')); }
    if (slot.cat === 'people') { const f = /female/.test(slot.id), g = slot.id.split('-').slice(2).join('-'), L: any = randomLook('mm-' + slot.id, f ? 'f' : 'm', 'fa' as any);
      if (g === 'african') L.skin = 8; else if (g === 'east-asian') { L.skin = 2; L.eyes = 'mono'; } else if (g === 'south-asian') L.skin = 6; else if (g === 'middle-eastern') { L.skin = 3; L.eyes = 'almond'; } else if (g === 'latin-american') L.skin = 4; else L.skin = 1;
      const m = Human.build(dressed(L, 'fa' as any), 'fa' as any, '#2E6BD8', av3Style(), 0.6); m.pose({ t: 0, yaw: 0, gaze: [0, 0], blink: 0, g: humanGesture(null, 0), talk: 0 }); return m.root; }
  } catch (e) { /* the stand-in */ }
  const g = new T.Group(), mat = new T.MeshStandardMaterial({ color: 0xB9C2D0, roughness: 0.55, metalness: 0.1 });
  const size = slot.cat === 'vehicles' ? [2.4, 2.2, 6] : slot.cat === 'buildings' ? [40, 14, 36] : slot.cat === 'items' ? [0.07, 0.12, 0.07] : slot.cat === 'security' ? [0.04, 0.12, 0.16] : [0.8, 0.9, 0.8];
  const b = new T.Mesh(new T.BoxGeometry(size[0], size[1], size[2]), mat); b.position.y = size[1] / 2; g.add(b);
  const e = new T.LineSegments(new T.EdgesGeometry(b.geometry), new T.LineBasicMaterial({ color: 0x35F0FF })); e.position.copy(b.position); g.add(e);
  // the game's own file if there is one in the folder
  if (Models.list && (Models.list as any)[modSlotPath(slot)]) Models.swap(g, modSlotPath(slot), false);
  return g;
}
async function mmPreview(slotId: string, modId: string) {
  const slot = modSlot(slotId), m = modById(modId) || null, d = MOD_DEMO.filter(x => x.id === modId)[0]; if (!slot) return;
  mmPreviewClose(); Sound.tick();
  const T = THREE, el = document.createElement('div'); el.className = 'mm-prev';
  el.innerHTML = `<div class="mm-pv-h"><span><b>${esc(slot.name)}</b><code>${esc(slot.id)}</code></span><button class="ts-x" data-act="mm-preview-close" aria-label="Close">${icon('close')}</button></div>
    <div class="mm-pv-c"><canvas></canvas><span class="mm-pv-l">The game's own</span><span class="mm-pv-r">${esc((m || d || { name: 'Replacement' }).name)}${(m ? m.demo : true) ? ' <i class="t-demo">Demo</i>' : ''}</span></div>
    <div class="mm-pv-spec"><span>.${slot.type}, up to ${slot.maxMb} MB${slot.maxTris ? `, ${slot.maxTris.toLocaleString()} triangles` : ''}</span><span>${esc(slot.scale)}</span><span>${esc(slot.front)}</span><small>Drag to turn</small></div>`;
  MM.root.appendChild(el); TitleScreen.root.classList.add('mm-dim');
  const cv = el.querySelector('canvas') as HTMLCanvasElement, ren = new T.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: true }); ren.setPixelRatio(Math.min(2, devicePixelRatio || 1)); ren.outputColorSpace = T.SRGBColorSpace;
  const P: any = { el, ren, yaw: 0.6, stop: false }; MM.prev = P;
  const sceneOf = () => { const s = new T.Scene(); s.add(new T.HemisphereLight(0xdde6ff, 0x30283a, 1.6)); const dl = new T.DirectionalLight(0xffffff, 2.2); dl.position.set(3, 5, 4); s.add(dl); const fl = new T.Mesh(new T.CircleGeometry(1, 64), new T.MeshStandardMaterial({ color: 0x1C1630, roughness: 0.9 })); fl.rotation.x = -Math.PI / 2; s.add(fl); s.userData.floor = fl; return s; };
  const A = sceneOf(), B = sceneOf(), own = mmOwnModel(slot); A.add(own);
  let rep: any = null;
  if (m && !m.demo) { const b = await modFileGet(m.id + '/' + m.files[slotId]); if (b && (window as any).GLTFLoader) { const u = URL.createObjectURL(b); rep = await new Promise(res => new (window as any).GLTFLoader().load(u, (g: any) => res(g.scene), undefined, () => res(null))); URL.revokeObjectURL(u); } }
  if (!rep) { rep = mmOwnModel(slot); const tint = new T.Color((d && d.tint) || mmTint(modId)); rep.traverse((o: any) => { if (o.isMesh && o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; o.material = ms.map((x: any) => { const c = x.clone(); if (c.color) c.color.lerp(tint, 0.55); return c; }); if (o.material.length === 1) o.material = o.material[0]; } }); }
  B.add(rep);
  const fit = (s: any, o: any) => { const bx = new T.Box3().setFromObject(o), sz = bx.getSize(new T.Vector3()), c = bx.getCenter(new T.Vector3()); const r = Math.max(sz.x, sz.y, sz.z) || 1; s.userData.floor.scale.setScalar(r * 0.9); s.userData.floor.position.set(c.x, bx.min.y - 0.001, c.z); return { c, r }; };
  const fa = fit(A, own), fb = fit(B, rep), cam = new T.PerspectiveCamera(35, 1, 0.01, 2000);
  let drag: any = null; cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: P.yaw }; }); window.addEventListener('pointerup', () => { drag = null; }); cv.addEventListener('pointermove', e => { if (drag) P.yaw = drag.y + (e.clientX - drag.x) * 0.01; });
  const frame = () => {
    if (P.stop) return; requestAnimationFrame(frame); if (!drag) P.yaw += 0.004;
    const w = cv.clientWidth, h = cv.clientHeight; if (cv.width !== Math.round(w * ren.getPixelRatio())) ren.setSize(w, h, false);
    ren.setScissorTest(true); ren.setClearColor(0x0B0818, 1);
    for (const [s, f, x] of [[A, fa, 0], [B, fb, w / 2]] as any[]) {
      cam.aspect = (w / 2) / h; cam.updateProjectionMatrix(); const dist = f.r * 1.9;
      cam.position.set(f.c.x + Math.sin(P.yaw) * dist, f.c.y + f.r * 0.35, f.c.z + Math.cos(P.yaw) * dist); cam.lookAt(f.c);
      ren.setViewport(x, 0, w / 2, h); ren.setScissor(x, 0, w / 2, h); ren.render(s, cam);
    }
  };
  frame();
}
