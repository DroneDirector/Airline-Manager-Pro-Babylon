// The livery designer: how your airline paints its aircraft. The design is kept with the airline and
// shows on every aircraft picture in the app (fleet, hangar, market, sales) and on the models in the 3D view.

let _lvEdit: { co: string; lv: Livery; type: string } = null;

const LV_STYLES: [Livery['style'], string, string][] = [
  ['swoosh', 'Swoosh', 'Cheatline that sweeps up into the tail'],
  ['stripe', 'Stripes', 'Two straight lines along the windows'],
  ['tail', 'Tail sweep', 'Clean white body, colour only towards the tail'],
  ['belly', 'Belly', 'Coloured underside and a thin line'],
  ['full', 'Full colour', 'The lower body in your colour'],
  ['nose', 'Nose', 'Coloured nose and a line along the body'],
];
const LV_TAILS: [Livery['tail'], string][] = [['gradient', 'Gradient'], ['solid', 'Solid'], ['split', 'Split'], ['white', 'White']];
const LV_ENGINES: [Livery['engines'], string][] = [['c1', 'Main colour'], ['c2', 'Second colour'], ['body', 'Body colour'], ['metal', 'Bare metal']];
const LV_BODY = ['#F4F6F8', '#E6E9ED', '#C9CED6', '#1B2A4A', '#0B1560', '#2A2F36'];
const LV_PALETTE = ['#D81939', '#C8102E', '#E2A23B', '#F2C14E', '#2D8C3C', '#3FB6A8', '#2C8CFF', '#1F4E9C', '#0B1560', '#1B2A4A', '#9C7CFF', '#E04BD6', '#D2553A', '#7FC4FF', '#2A2F36', '#F4F6F8'];

ACTIONS['livery-open'] = el => {
  const c = company((el && el.getAttribute('data-co')) || State.companyId); if (!c) return;
  const mine = fleetOf(c.id)[0];
  _lvEdit = { co: c.id, lv: Object.assign(defaultLivery(c.color, c.color2, c.name), c.livery || {}), type: mine ? mine.typeId : 'a320neo' };
  closeAll();
  openLayer('modal', `<div class="modal-head"><div><h2>Livery</h2><small>${esc(c.name)}: how your aircraft are painted</small></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
    <div class="modal-body lv-body">${liveryEditorHtml()}</div>`, { cls: 'wide livery-pop' });
};

function liveryEditorHtml(): string {
  const e = _lvEdit, lv = e.lv, types = Array.from(new Set(fleetOf(e.co).map(a => a.typeId).concat(['a320neo', 'b738-pmdg', 'b78x', 'atr72', 'c208'])));
  const sw = (key: string, list: string[], cur: string) => `<div class="le-sw">${list.map(col => `<button class="sw ${col.toLowerCase() === String(cur).toLowerCase() ? 'on' : ''}" style="--c:${col}" data-act="lv-set" data-k="${key}" data-v="${col}" aria-label="${col}"></button>`).join('')}<label class="sw custom" style="--c:${esc(cur)}" aria-label="Your own colour"><input type="color" class="lv-color" data-k="${key}" value="${esc(cur)}"></label></div>`;
  const chips = (key: string, list: [string, string][], cur: string) => `<div class="lv-chips">${list.map(([v, l]) => `<button class="chip ${v === cur ? 'on' : ''}" data-act="lv-set" data-k="${key}" data-v="${v}">${esc(l)}</button>`).join('')}</div>`;
  return `
    <div class="lv-preview">
      <div class="lv-stage">${aircraftArt(e.type, { livery: lv, reg: (fleetOf(e.co).filter(a => a.typeId === e.type)[0] || {} as any).reg || 'OY-NEW' })}</div>
      <div class="lv-types">${types.map(t => `<button class="chip ${t === e.type ? 'on' : ''}" data-act="lv-type" data-t="${t}">${esc(acType(t).model)}</button>`).join('')}</div>
    </div>
    <div class="lv-controls">
      <div class="le-group"><b>Design</b><div class="lv-styles">${LV_STYLES.map(([v, l, h]) => `<button class="lv-style ${v === lv.style ? 'on' : ''}" data-act="lv-set" data-k="style" data-v="${v}"><b>${esc(l)}</b><small>${esc(h)}</small></button>`).join('')}</div></div>
      <div class="le-group"><b>Main colour</b>${sw('c1', LV_PALETTE, lv.c1)}</div>
      <div class="le-group"><b>Second colour</b>${sw('c2', LV_PALETTE, lv.c2)}</div>
      <div class="le-group"><b>Body</b>${sw('body', LV_BODY, lv.body)}</div>
      <div class="le-group"><b>Underside</b>${sw('belly', ['#C9D0D8', '#E6E9ED', '#8E99A6', lv.c1, lv.c2], lv.belly)}</div>
      <div class="le-group"><b>Tail</b>${chips('tail', LV_TAILS, lv.tail)}</div>
      <div class="le-group"><b>Engines</b>${chips('engines', LV_ENGINES, lv.engines)}</div>
      <div class="le-row2">
        <div class="le-group"><b>Name on the aircraft</b><input class="le-in lv-titles" value="${esc(lv.titles)}" maxlength="28" placeholder="No name" autocomplete="off"></div>
        <div class="le-group"><b>Star on the tail</b>${chips('emblem', [['1', 'Show'], ['0', 'Hide']], lv.emblem ? '1' : '0')}</div>
      </div>
      <div class="modal-actions">
        <button class="btn ghost" data-act="lv-reset">From the airline colours</button>
        <button class="btn primary" data-act="lv-save">${icon('check')}Save livery</button>
      </div>
    </div>`;
}
function rerenderLivery() {
  const b = $('.livery-pop .lv-body'); if (!b || !_lvEdit) return;
  const y = (b.parentElement as HTMLElement).scrollTop;
  b.innerHTML = liveryEditorHtml(); (b.parentElement as HTMLElement).scrollTop = y;
}
ACTIONS['lv-set'] = el => {
  if (!_lvEdit) return;
  const k = el.getAttribute('data-k'), v = el.getAttribute('data-v');
  (_lvEdit.lv as any)[k] = k === 'emblem' ? v === '1' : v;
  Sound.tick(); rerenderLivery();
};
ACTIONS['lv-type'] = el => { if (!_lvEdit) return; _lvEdit.type = el.getAttribute('data-t'); Sound.tick(); rerenderLivery(); };
ACTIONS['lv-reset'] = () => { if (!_lvEdit) return; const c = company(_lvEdit.co); _lvEdit.lv = defaultLivery(c.color, c.color2, c.name); Sound.tick(); rerenderLivery(); };
ACTIONS['lv-save'] = () => {
  if (!_lvEdit) return;
  const c = company(_lvEdit.co), t = $('.lv-titles') as HTMLInputElement;
  if (t) _lvEdit.lv.titles = t.value.trim();
  c.livery = Object.assign({}, _lvEdit.lv);
  AcPic.cache.clear();
  closeAll(); Store.save(); Haptics.pulse(20); refresh();
  toast('Livery saved: every aircraft now wears it', 'ok');
};
document.addEventListener('input', e => {
  const el = e.target as HTMLInputElement;
  if (!el || !el.classList) return;
  if (el.classList.contains('lv-color') && _lvEdit) { (_lvEdit.lv as any)[el.getAttribute('data-k')] = el.value; clearTimeout((window as any).__lvT); (window as any).__lvT = setTimeout(rerenderLivery, 120); }
  else if (el.classList.contains('lv-titles') && _lvEdit) { _lvEdit.lv.titles = el.value; clearTimeout((window as any).__lvT2); (window as any).__lvT2 = setTimeout(() => { const st = $('.livery-pop .lv-stage'); if (st) st.innerHTML = aircraftArt(_lvEdit.type, { livery: _lvEdit.lv, reg: 'OY-NEW' }); }, 350); }
});
