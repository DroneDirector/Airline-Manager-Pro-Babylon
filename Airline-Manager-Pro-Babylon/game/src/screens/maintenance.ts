// Maintenance: aircraft condition and every open damage report from the mechanic.

/** The hangar: a drawn building with each aircraft that's in for work standing inside, or empty. */
function hangarSvg(): string {
  return `<svg class="hg-bg" viewBox="0 0 420 170" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
    <defs>
      <linearGradient id="hgIn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0E2036"/><stop offset="1" stop-color="#162C46"/></linearGradient>
      <linearGradient id="hgFloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1B3150"/><stop offset="1" stop-color="#0C1A2C"/></linearGradient>
      <radialGradient id="hgLamp" cx="0.5" cy="0" r="1"><stop offset="0" stop-color="#FFF4D6" stop-opacity=".5"/><stop offset="1" stop-color="#FFF4D6" stop-opacity="0"/></radialGradient>
    </defs>
    <path d="M14 162 V58 Q210 -6 406 58 V162 Z" fill="#0A1626" stroke="#2A4466" stroke-width="2"/>
    <path d="M40 162 V66 Q210 14 380 66 V162 Z" fill="url(#hgIn)"/>
    ${[90, 150, 210, 270, 330].map(x => `<path d="M${x} ${x === 210 ? 30 : x === 150 || x === 270 ? 36 : 50} v10" stroke="#3A5878" stroke-width="2"/><ellipse cx="${x}" cy="${x === 210 ? 42 : x === 150 || x === 270 ? 48 : 62}" rx="9" ry="2.6" fill="#FFF1C9"/><path d="M${x - 9} ${x === 210 ? 43 : x === 150 || x === 270 ? 49 : 63} L${x - 46} 162 H${x + 46} L${x + 9} ${x === 210 ? 43 : x === 150 || x === 270 ? 49 : 63} Z" fill="url(#hgLamp)" opacity=".55"/>`).join('')}
    ${[0, 1, 2, 3, 4, 5].map(k => `<path d="M${52 + k * 56} 66 L${210 + (k - 2.5) * 30} 22" stroke="#22405F" stroke-width="1.2" opacity=".7"/>`).join('')}
    <path d="M40 140 H380 V162 H40 Z" fill="url(#hgFloor)"/>
    <path d="M110 152 H310" stroke="#F2C14E" stroke-width="2" stroke-dasharray="10 8" opacity=".7"/>
    <rect x="14" y="66" width="26" height="96" fill="#132741" stroke="#2A4466"/><rect x="380" y="66" width="26" height="96" fill="#132741" stroke="#2A4466"/>
    ${[0, 1, 2, 3].map(k => `<path d="M14 ${80 + k * 22} H40 M380 ${80 + k * 22} H406" stroke="#22405F"/>`).join('')}
    <path d="M6 162 H414" stroke="#2A4466" stroke-width="3"/>
  </svg>`;
}
function hangarHtml(jobs: Issue[]): string {
  if (!jobs.length) return `<div class="hangar empty">${hangarSvg()}<span class="hg-msg">${icon('check')}The hangar is empty. Repairs you pay for show up here.</span></div>`;
  return jobs.map(i => {
    const a = plane(i.reg), c = company(a.companyId);
    return `<button class="hangar" data-act="ac-detail" data-reg="${esc(i.reg)}">${hangarSvg()}
      <span class="hg-plane">${aircraftArt(a.typeId, { color: c.color, color2: c.color2, reg: a.reg, ground: true })}</span>
      <span class="hg-tag">${statusChip('scheduled')}<b>${esc(i.reg)}</b><span>${esc(State.issues.filter(x => x.reg === i.reg && x.status === 'scheduled').map(x => x.title).join(', '))}</span><small>${plane(i.reg).status === 'flying' ? 'Starts when it lands' : Math.max(1, Math.ceil(((i as any).startedAt + (i as any).durMin * 60000 - Date.now()) / 60000)) + ' min left'}</small></span>
    </button>`;
  }).join('');
}
SCREENS.maint = {
  title: 'Maintenance', icon: 'wrench',
  render() {
    const fl = fleetOf();
    const regs = fl.map(a => a.reg);
    const issues = State.issues.filter(i => regs.indexOf(i.reg) >= 0);
    const open = issues.filter(i => i.status === 'open'), sched = issues.filter(i => i.status === 'scheduled').filter((i, k, l) => l.findIndex(x => x.reg === i.reg) === k);
    const sorted = fl.slice().sort((a, b) => a.condition - b.condition);
    return `
    <div class="screen-head">
      <div><h1>Maintenance</h1><p class="sub">${open.length} open report${open.length === 1 ? '' : 's'}, ${fl.filter(a => a.status === 'grounded').length} grounded</p></div>
    </div>
    <div class="maint">
      <div class="maint-issues">
        ${open.length ? `<h3>Open reports</h3>` : ''}
        ${open.map((i, k) => {
          const a = plane(i.reg), t = acType(a.typeId);
          return `<div class="issue-card sev-${i.severity}" style="--i:${k}">
            <div class="ic-top">${statusChip(i.severity)}<b>${esc(i.reg)}</b><small>${esc(t.model)}, ${esc(i.date)}</small></div>
            <h4>${esc(i.title)}</h4><p>${esc(i.detail)}</p>
            <small class="src">${icon('sliders')}${esc(i.source)}</small>
            <div class="ic-foot"><span><b>${money(i.cost)}</b><small>${repairTotal(i.reg).n > 1 ? `${repairTotal(i.reg).n} reports on ${esc(i.reg)}, ${money(repairTotal(i.reg).cost)} for all` : ((State.settings as any).repairTime === 'instant' ? 'Ready to fly once paid' : `${repairTimeText(repairPlanMin(i.reg))} in the hangar`)}</small></span>
              <button class="btn ghost sm" data-act="open-issue" data-id="${i.id}">${icon('volume')}Mechanic</button>
              <button class="btn ghost sm" data-act="fix-later" data-id="${i.id}">Later</button>
              <button class="btn primary sm" data-act="fix-now" data-id="${i.id}">${repairTotal(i.reg).n > 1 ? 'Pay and fix all' : 'Pay and fix now'}</button></div>
          </div>`;
        }).join('') || emptyState('No open reports', 'Damage the simulator detects after a flight shows up here.')}
        <h3>In the hangar</h3>
        ${hangarHtml(sched)}
        <button class="btn ghost hg-go" data-act="go" data-screen="hangars">${icon('wrench')}Your hangars: walk in</button>
      </div>
      <div class="maint-cond card">
        <div class="card-h"><b>Fleet condition</b></div>
        ${sorted.map(a => `<button class="cond-row" data-act="ac-detail" data-reg="${a.reg}"><b>${esc(a.reg)}</b><small>${esc(acType(a.typeId).model)}</small>${conditionBar(a.condition)}<span>${Math.round(a.condition)}%</span>${a.status === 'grounded' ? '<i class="gr">Grounded</i>' : ''}</button>`).join('')}
        <p class="fine-print">${icon('info')}Damage is only reported when the simulator can detect it: tail strikes, hard landings, overspeed, engine failures, overstress and severe turbulence.</p>
      </div>
    </div>`;
  },
};
