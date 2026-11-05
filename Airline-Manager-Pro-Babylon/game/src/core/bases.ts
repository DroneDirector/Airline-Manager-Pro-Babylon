// Bases and stands. Every aircraft has a base airport, and an airport only has so many stands (from its
// real layout: the simulator's, or OpenStreetMap's). When more aircraft are based at an airport than it
// has stands, the ones added last have no stand: you're told, you can move them to another base, and
// until then they are refused take-off and can't board passengers.
// An airport whose number of stands isn't known yet (no layout downloaded) doesn't limit anything.

const Bases = {
  tried: {} as { [icao: string]: boolean },

  /** Stands at an airport, or null when not known. */
  capacity(icao: string): number {
    const l = AirportLayouts.cache[icao] || AirportLayouts.kept(icao);
    return l && l.source !== 'runways' && l.parks.length ? l.parks.length : null;
  },
  basedAt(icao: string, cid?: string): Aircraft[] { return State.fleet.filter(a => a.base === icao && (!cid || a.companyId === cid)); },
  /** Free stands at an airport for your airline (null when not known). */
  free(icao: string): number { const cap = this.capacity(icao); return cap == null ? null : cap - this.basedAt(icao).filter(a => !(a as any).noBase).length; },
  standLabel(icao: string): string {
    const cap = this.capacity(icao); if (cap == null) return 'stands not known yet';
    const used = this.basedAt(icao).filter(a => !(a as any).noBase).length;
    return `${cap} stand${cap === 1 ? '' : 's'}, ${Math.max(0, cap - used)} free`;
  },

  /** Work out which aircraft have a stand; tell about the ones that just lost theirs. */
  check(quiet?: boolean) {
    const byBase: { [icao: string]: Aircraft[] } = {};
    for (const a of State.fleet) (byBase[a.base] = byBase[a.base] || []).push(a);
    let changed = false;
    for (const icao of Object.keys(byBase)) {
      const cap = this.capacity(icao), list = byBase[icao];
      // the aircraft you fly comes first, then the ones that have been there longest
      const order = list.slice().sort((x, y) => (State.myReg[y.companyId] === y.reg ? 1 : 0) - (State.myReg[x.companyId] === x.reg ? 1 : 0) || String(x.delivered || '').localeCompare(String(y.delivered || '')) || x.reg.localeCompare(y.reg));
      order.forEach((a: any, i) => {
        const none = cap != null && i >= cap;
        if (none && !a.noBase) {
          a.noBase = true; changed = true;
          State.notices.unshift({ id: uid(), kind: 'mechanic', title: `${a.reg} has no stand at ${icao}`, body: `${apt(icao) ? apt(icao).name : icao} has ${cap} stand${cap === 1 ? '' : 's'} and they are all taken by your aircraft. Choose another base for ${a.reg}. Until then it is refused take-off and can't board passengers.`, time: 'Now', read: false, reg: a.reg } as any);
          if (!quiet) toast(`${a.reg} has no stand at ${icao}: choose another base`, 'warn');
        } else if (!none && a.noBase) { a.noBase = false; changed = true; }
      });
    }
    if (changed) { Store.save(); try { refresh(); } catch (e) { /* not ready */ } }
  },

  /** Look up the stands of every base in use (downloads each airport's layout once). */
  ensure() {
    const bases = State.fleet.map(a => a.base).filter((b, i, l) => b && l.indexOf(b) === i);
    for (const icao of bases) {
      if (this.capacity(icao) != null || this.tried[icao]) continue;
      this.tried[icao] = true;
      AirportLayouts.fromOsm(icao).then(l => { if (l) this.check(); }).catch(() => { /* stays unknown */ });
    }
    this.check(true);
  },
};

/** True when an airport hasn't got enough free stands for this many more aircraft (unknown stands: no limit). */
function noStandsFor(icao: string, n: number): boolean { const f = Bases.free(icao); return f != null && f < n; }

/** Fleet: the aircraft that have no stand, each with a button to choose another base. */
function noStandBannerHtml(): string {
  const list = State.fleet.filter(a => a.companyId === State.companyId && (a as any).noBase);
  if (!list.length) return '';
  return `<div class="nostand-banner">${icon('alert')}<div><b>${list.length} aircraft ${list.length === 1 ? 'has' : 'have'} no stand at ${list.length === 1 ? 'its base' : 'their bases'}</b>
    <small>More aircraft are based there than the airport has stands. Choose another base for each; until then they are refused take-off and can't board passengers.</small>
    <div class="nsb-list">${list.map(a => `<span class="nsb-row"><b>${esc(a.reg)}</b><small>${esc(acType(a.typeId).model)} at ${esc(a.base)}</small><button class="btn primary sm" data-act="ac-rebase" data-reg="${esc(a.reg)}">${icon('pin')}Choose base</button></span>`).join('')}</div></div></div>`;
}

function startBases() {
  setTimeout(() => Bases.ensure(), 4000);
  setInterval(() => Bases.ensure(), 5 * 60000);
}

/* ---------- Choosing a base ---------- */
let _basePick: { onPick: (icao: string) => void; skip?: string } = null;

function basePickerRows(q: string): string {
  const list = World.search(q, 12);
  return list.map(a => {
    const f = Bases.free(a.icao), full = f != null && f <= 0;
    return `<button class="bp-row ${full ? 'full' : ''}" data-act="base-pick" data-icao="${esc(a.icao)}" ${a.icao === (_basePick && _basePick.skip) ? 'disabled' : ''}><b>${esc(a.icao)}</b><span><span>${esc(a.name)}</span><small>${esc([a.city !== a.name ? a.city : '', a.country].filter(Boolean).join(', '))}</small></span><em class="${full ? 'red' : f != null ? 'green' : ''}">${esc(Bases.standLabel(a.icao))}</em></button>`;
  }).join('') || `<p class="fine-print">${q.trim() ? 'No airport matches that.' : 'Type an airport name, city or code.'}</p>`;
}

function openBasePicker(title: string, sub: string, onPick: (icao: string) => void, skip?: string) {
  _basePick = { onPick, skip };
  // your own bases first
  const mine = State.fleet.filter(a => a.companyId === State.companyId).map(a => a.base).concat([company().hub]).filter((b, i, l) => b && l.indexOf(b) === i);
  openLayer('modal', `<div class="modal-head"><div><h2>${esc(title)}</h2><small>${esc(sub)}</small></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
    <div class="modal-body bp">
      <div class="bp-mine">${mine.map(b => `<button class="fchip" data-act="base-pick" data-icao="${esc(b)}" ${b === skip ? 'disabled' : ''}>${esc(b)} <small>${esc(Bases.standLabel(b))}</small></button>`).join('')}</div>
      <label class="apt-search">${icon('search')}<input id="bp-q" type="search" placeholder="Any airport: name, city, ICAO or IATA" autocomplete="off"></label>
      <div class="bp-list" id="bp-list">${basePickerRows('')}</div>
      <p class="fine-print">${icon('info')}Stands are counted from the airport's real layout. Airports not looked up yet show their stands once chosen.</p>
    </div>`, { cls: 'narrow' });
  // stands for your bases may still be on their way
  Bases.ensure();
}
document.addEventListener('input', e => {
  const el = e.target as HTMLInputElement;
  if (el && el.id === 'bp-q') { const l = $('#bp-list'); if (l) l.innerHTML = basePickerRows(el.value); }
});
ACTIONS['base-pick'] = el => {
  const icao = el.getAttribute('data-icao'), p = _basePick; if (!p) return;
  closeTop(); Sound.tick();
  p.onPick(icao);
  // look up the stands there if not known yet, then check again
  if (Bases.capacity(icao) == null && !Bases.tried[icao]) { Bases.tried[icao] = true; AirportLayouts.fromOsm(icao).then(l => { if (l) Bases.check(); }).catch(() => { /* unknown */ }); }
};

/** Move an aircraft to another base; on the ground it is repositioned there. */
ACTIONS['ac-rebase'] = el => {
  const a: any = plane(el.getAttribute('data-reg')); if (!a) return;
  openBasePicker(`New base for ${a.reg}`, `Now based at ${a.base}${a.noBase ? ', with no stand' : ''}`, icao => {
    const f = Bases.free(icao);
    if (f != null && f <= 0) { toast(`${icao} has no free stand`, 'warn'); return; }
    a.base = icao;
    const flying = a.status === 'flying' || State.live.some(x => x.reg === a.reg);
    if (!flying) a.location = icao;
    Bases.check(true); Store.save(); closeAll(); refresh();
    toast(`${a.reg} is now based at ${icao}${flying ? ' and goes there after this flight' : ''}`, 'ok');
  }, a.base);
};
