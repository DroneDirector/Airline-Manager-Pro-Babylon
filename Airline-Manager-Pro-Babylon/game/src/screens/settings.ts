// Settings. Sections are plain data, so new options are added by appending an entry here.

type SetItem =
  | { type: 'toggle'; key: string; label: string; hint?: string; when?: () => boolean }
  | { type: 'choice'; key: string; label: string; hint?: string; options: string[][]; when?: () => boolean }
  | { type: 'html'; html: () => string }
  | { type: 'group'; title: string };   // starts a part of a section; with two or more, a switch shows one at a time

interface SetSection { id: string; title: string; icon: string; items: SetItem[] }

const SETTINGS: SetSection[] = [
  { id: 'general', title: 'General', icon: 'sliders', items: [
    { type: 'html', html: () => soloMode() ? `<div class="set-card"><span><b>Your first week</b><small>The guided checklist for a new airline in the Overview: aircraft, crew, the first route and flight, a job and a frequent-flyer programme.</small></span><button class="btn ghost sm" data-act="fw-show">Show it</button></div>` : '' },
    { type: 'toggle', key: 'morningBrief', label: 'Morning briefing', hint: 'Once a day in the Overview: yesterday\'s result, today\'s flights, weather, crew and aircraft, and the special days coming up on your routes. Also opens from the Overview any time.' },
    { type: 'html', html: () => `<div class="set-card"><span class="brand-lg">${brandMark()}</span><span><b>${esc(APP.name)}</b><small>Version ${esc(APP.version)}</small></span><button class="btn ghost sm" data-act="whats-new">${icon('star')}What's new</button></div>` },
    { type: 'choice', key: 'units', label: 'Units', options: [['imperial', 'Feet, knots, nm'], ['metric', 'Metres, km/h, km']] },
    { type: 'toggle', key: 'clock24', label: '24-hour clock' },
    { type: 'html', html: () => typeof DESKTOP !== 'undefined' && DESKTOP ? '' : `<label class="tg-row"><span><b>Full screen</b><small>The phone's status bar and navigation buttons stay hidden. A swipe from the edge shows them for a moment and they hide again by themselves (to stop the notification panel too, use Lock to the game). Remembered by the phone.</small></span><button class="tg ${fullScreenOn() ? 'on' : ''}" role="switch" aria-checked="${fullScreenOn()}" data-act="fullscreen-toggle"><i></i></button></label>` },
    { type: 'html', html: () => { if (typeof DESKTOP !== 'undefined' && DESKTOP) return ''; const on = (State.settings as any).gameLock === true; return `<label class="tg-row"><span><b>Lock to the game</b><small>Stops the notification panel and the system buttons from opening by accident while you play: swipes from the edges do nothing (Android's app pinning). Android asks once to confirm. To leave the app while it is on, hold Back and Recents together, or with gesture navigation swipe up and hold; switching this off lets go at once.</small></span><button class="tg ${on ? 'on' : ''}" role="switch" aria-checked="${on}" data-act="gamelock-toggle"><i></i></button></label>`; } },
    { type: 'choice', key: 'crewStyle', label: 'Crew figures', hint: 'How your pilots, cabin crew and mechanics are drawn. Natural has real human proportions; stylised has a slightly larger head and eyes, like an animated film.', options: [['natural', 'Natural'], ['balanced', 'In-between'], ['stylised', 'Stylised']] },
  ] },
  { id: 'devices', title: 'Devices', icon: 'play', items: [{ type: 'html', html: () => devicesHtml() }] },
  { id: 'booster', title: 'Game Booster', icon: 'power', items: [
    { type: 'html', html: () => { setTimeout(() => { try { boostAnim(); boostDraw(); boostSample(); } catch (e) { /* no animation */ } }, 0); return boosterHtml(); } },
  ] },
  { id: 'licence', title: 'Registration', icon: 'key', items: [
    { type: 'html', html: () => licenceHtml() },
  ] },
  { id: 'ai', title: 'Virtual pilots', icon: 'fleet', items: [
    { type: 'html', html: () => `<p class="fine-print">${icon('info')}Your hired pilots fly their routes even while the app is closed. Each flight takes as long as it would in real life, worked out from the distance along airways, the aircraft's climb, cruise and descent speeds at each altitude, taxi times and the jet stream.</p>` },
    { type: 'choice', key: 'aiSpeed', label: 'Virtual pilot speed', hint: 'Real time is how long the flight takes in the real world. Faster speeds also shorten turnarounds and rest. Only your hired pilots are affected, never your own flights.', options: [['1', 'Real time'], ['2', '2×'], ['4', '4×'], ['10', '10×'], ['30', '30×']] },
    { type: 'toggle', key: 'aiNotify', label: 'Notify me when my pilots land', hint: 'A phone notification when a hired pilot reaches the gate, even when the app is closed.' },
  ] },
  { id: 'view3d', title: 'Graphics', icon: 'map', items: [
    { type: 'group', title: 'Recommended' }, { type: 'html', html: () => gfxAdviceHtml() },
    { type: 'html', html: () => { const on = (State.settings as any).joinedRooms !== false; return `<label class="tg-row set-card"><span><b>Walk between your rooms</b><small>Your office, the Operations office and your hub's lounge in one building: a staff corridor and the concourse join them, and you walk from one to the other through their doors. The Office, Operations and Lounge buttons still take you straight to your chair. Off: each room on its own, with a loading screen in between.</small></span><button class="tg ${on ? 'on' : ''}" role="switch" aria-checked="${on}" data-act="joined-rooms"></button></label>`; } },
    ...(DESKTOP ? [{ type: 'group', title: 'PC graphics' } as SetItem, { type: 'html', html: () => gfxSettingsHtml() } as SetItem] : []),
    { type: 'group', title: 'Distance and clouds' },
    { type: 'html', html: () => {
      const km = v3dKm();
      const note = km >= 400 ? `<p class="v3d-note warn">${icon('alert')}Very high settings might affect performance: more ground to load and draw, a warmer device and more battery use.</p>`
        : km <= 60 ? `<p class="v3d-note ok">${icon('info')}Low settings might improve performance on slower phones and PCs.</p>` : '';
      return `<div class="set-card col"><div class="sc-h">${icon('map')}<span><b>View distance: ${km} km</b><small>How far you see in the 3D view. Further shows more mountains, coastlines and sea towards the horizon.</small></span></div>
        <input type="range" class="v3d-range" min="20" max="800" step="10" value="${km}" aria-label="View distance in kilometres">
        <div class="v3d-scale"><span>20 km</span><span>150</span><span>400</span><span>800 km</span></div>${note}</div>`;
    } },
    { type: 'html', html: () => {
      const q = v3dTerrainQ(), top = DESKTOP ? 4 : 3, G = Math.round(220 * TERRAIN_DENSITY[q]);
      const note = q >= 3 ? `<p class="v3d-note warn">${icon('alert')}Very high settings might affect performance: ${q >= 4 ? 'a finer ring of heights around you and three times the points everywhere' : 'twice the points in the ground'}, more memory and a warmer ${DESKTOP ? 'graphics card' : 'device'}.</p>`
        : q === 0 ? `<p class="v3d-note ok">${icon('info')}Low settings might improve performance on slower ${DESKTOP ? 'PCs' : 'phones'}.</p>` : '';
      const S: any = State.settings, sm = v3dTerrainSmooth();
      return `<div class="set-card col"><div class="sc-h">${icon('map')}<span><b class="tq-h">Terrain detail: ${TERRAIN_Q_NAMES[q]}</b><small>How finely mountains, valleys and coastlines are shaped in the 3D view, near you and towards the horizon (now ${G} × ${G} points around you${q >= 4 ? ', and heights about 19 m apart nearest you' : ''}). Higher gives sharper ridges and smoother slopes; lower is quicker.${DESKTOP ? ' Ultra is for the PC.' : ''} Applies the next time the 3D view opens.</small></span></div>
        <input type="range" class="v3d-tq" min="0" max="${top}" step="1" value="${q}" aria-label="Terrain detail">
        <div class="v3d-scale">${TERRAIN_Q_NAMES.slice(0, top + 1).map(n => `<span>${n}</span>`).join('')}</div>${note}
        <label class="tg-row"><span><b>Smooth mountain ridges</b><small>Averages the heights between the ground's points, so ridges, peaks and coastlines don't break into spikes and saw teeth. Off: every point takes the exact height found there.</small></span><button class="tg ${sm ? 'on' : ''}" role="switch" aria-checked="${sm}" data-act="v3d-opt" data-key="v3dTerrainSmooth"><i></i></button></label></div>`;
    } },
    { type: 'html', html: () => {
      const km = cloudKm(), d = cloudDetail();
      const note = (km >= 200 || d >= 4) ? `<p class="v3d-note warn">${icon('alert')}Very high settings might affect performance: more clouds to draw, a warmer device and more battery use.</p>`
        : (km && km <= 40) || d === 1 ? `<p class="v3d-note ok">${icon('info')}Low settings might improve performance on slower phones and PCs.</p>` : '';
      const flat = cloudFlat();
      const mode = `<div class="sc-h">${icon('cloud')}<span><b>Clouds: ${flat ? '2D' : '3D'}</b><small>3D: clouds built in three dimensions, heaps and towering storms you fly round and through. 2D: flat cloud layers, lighter to draw on slower phones and PCs.</small></span></div>
        <div class="seg cl-mode" role="group" aria-label="3D or 2D clouds"><button class="${flat ? '' : 'on'}" data-act="cl-mode" data-v="3d">3D clouds</button><button class="${flat ? 'on' : ''}" data-act="cl-mode" data-v="2d">2D clouds</button></div>
        <p class="v3d-note">${icon('reload')}Switching between 3D and 2D clouds reloads the 3D view (with its loading screen) when you leave the settings.</p>
        ${flat ? `<p class="v3d-note">${icon('info')}2D clouds might not show the real-world weather as closely as 3D clouds. They come from the same reports, so the cover, the height of each layer, rain, snow and storms are there, but heaps and towering storm clouds are drawn as flat layers.</p>` : ''}`;
      return `<div class="set-card col">${mode}<div class="sc-h" style="margin-top:12px">${icon('wind')}<span><b class="cl-km-h">Cloud distance: ${km ? km + ' km' : 'Off'}</b><small>How far you see clouds in the 3D view. They follow the real-world weather reports around you.</small></span></div>
        <input type="range" class="cl-km" min="0" max="300" step="10" value="${km}" aria-label="Cloud distance in kilometres">
        <div class="v3d-scale"><span>Off</span><span>100</span><span>200</span><span>300 km</span></div>
        <div class="sc-h" style="margin-top:12px">${icon('layers')}<span><b class="cl-d-h">Cloud detail: ${CLOUD_DETAIL_NAMES[d - 1]}</b><small>How many puffs each cloud is made of. Higher looks fuller and softer.</small></span></div>
        <input type="range" class="cl-d" min="1" max="4" step="1" value="${d}" aria-label="Cloud detail">
        <div class="v3d-scale"><span>Light</span><span>Normal</span><span>Detailed</span><span>Very detailed</span></div>${note}</div>`;
    } },
    { type: 'group', title: 'Cabin' },
    { type: 'html', html: () => {
      const q = cabinQ();
      const note = q === 3 ? `<p class="v3d-note warn">${icon('alert')}Ultra might affect performance: the cabin is drawn at up to three times your screen's sharpness with the finest curves and seats, a warmer device and more battery use.</p>`
        : q === 0 ? `<p class="v3d-note ok">${icon('info')}Low settings might improve performance on slower phones and PCs.</p>` : '';
      return `<div class="set-card col"><div class="sc-h">${icon('layers')}<span><b class="cq-h">Cabin quality: ${CABIN_Q_NAMES[q]}</b><small>How finely the cabin views are made: the seats (padding, seams and stitching, armrests), the curves of the overhead bins and walls, and the passengers. Very high is the standard: detailed seats and smooth edges. Ultra is the very best: the finest seats and curves, the sharpest textures and the cabin drawn at up to three times your screen's sharpness.</small></span></div>
        <input type="range" class="v3d-cabq" min="0" max="3" step="1" value="${q}" aria-label="Cabin quality">
        <div class="v3d-scale"><span>Low</span><span>Medium</span><span>Very high</span><span>Ultra</span></div>${note}</div>`;
    } },
    { type: 'html', html: () => cabinSettingsHtml() },
    { type: 'html', html: () => animSettingsHtml() },
    { type: 'group', title: 'Lounges' },
    { type: 'html', html: () => placeSettingsHtml('lounge') },
    { type: 'group', title: 'Hangars' },
    { type: 'html', html: () => placeSettingsHtml('hangar') },
    { type: 'group', title: 'Offices and rooms' },
    { type: 'html', html: () => placeSettingsHtml('room') },
    { type: 'html', html: () => perfSettingsHtml() },
    ...(DESKTOP ? [] : [{ type: 'group', title: 'Light and shadow' } as SetItem, { type: 'html', html: () => gfxPhoneHtml() } as SetItem]),
    { type: 'group', title: 'Sky and water' },
    { type: 'html', html: () => {
      const S: any = State.settings, wm = v3dWaterMode();
      const row = (k: string, label: string, hint: string) => `<label class="tg-row"><span><b>${label}</b><small>${hint}</small></span><button class="tg ${S[k] !== false ? 'on' : ''}" role="switch" aria-checked="${S[k] !== false}" data-act="v3d-opt" data-key="${k}"><i></i></button></label>`;
      return `<div class="ch-row"><span><b>Water</b><small>Living water moves with the wind from the weather reports and reflects the sky, the sun and the moon. With mirror reflections it also reflects the land, aircraft and clouds: the view is drawn twice, so it is for fast PCs.</small></span><div class="seg">${[['simple', 'Simple'], ['living', 'Living'], ['mirror', 'Mirror reflections']].map(o => `<button class="${wm === o[0] ? 'on' : ''}" data-act="set-choice" data-key="v3dWater" data-v="${o[0]}">${o[1]}</button>`).join('')}</div></div>`
        + (wm === 'mirror' ? `<p class="v3d-note warn">${icon('alert')}Very high settings might affect performance: the 3D view is drawn twice for every picture.</p>` : '')
        + row('v3dDayNight', 'Day and night', 'The real sun for the place and time you look at: sunrise, sunset, twilight and night as they are there. Off: always daylight.')
        + row('v3dSky', 'Sun, moon and stars', 'The sun and the moon at their true size and place, the moon in its phase, and the real stars at night.')
        + row('v3dFlare', 'Lens flare', 'Looking towards the sun, its light catches in the camera lens: a glare and a row of soft rings and spots across the picture.')
        + row('v3dPrecip', 'Rain and snow', 'From the real-world weather reports (or Flight Simulator\'s weather when linked): falling around you under a raining cloud, and in grey curtains below the clouds in the distance.')
        + `<label class="tg-row"><span><b>Glow around lights</b><small>At night and in poor light every runway, taxiway, airport and aircraft light gets a soft halo, as it does in damp air and through a camera. On by default on the PC; heavier on phones and tablets.</small></span><button class="tg ${v3dHalo() ? 'on' : ''}" role="switch" aria-checked="${!!v3dHalo()}" data-act="v3d-glow"><i></i></button></label>`
        + row('v3dWet', 'Wet runways', 'After rain or snow the runways turn darker and glossy, and at night their lights shine back from the wet surface. They dry out over about half an hour.')
        + (DESKTOP ? row('v3dHaze', 'Heat haze behind the engines', 'While the engines run on the ground, what is behind them shimmers in the hot exhaust. The PC only: it needs an extra drawing pass.') : '')
        + row('v3dGroundVeh', 'Ground vehicles and jet bridges', 'At the gate: a jet bridge (or stairs), the fuel truck, the catering truck, belt loader, baggage tractor and carts, ground power, de-icing in the cold, and the tug at push-back. Each drives in and out.')
        + row('v3dContrails', 'Contrails', 'Aircraft cruising where the air is colder than about −40 °C leave white trails from their engines: gone in seconds in dry air, lingering and spreading in damp air. Longer and finer on the PC.')
        + row('v3dLightning', 'Lightning', 'Storm clouds flash from inside, with bolts to the ground now and then; at night the whole area lights up for an instant.')
        + row('v3dRainbow', 'Rainbows', 'Where it rains with the sun low behind you, a rainbow: a full arc or part of one, sometimes with a fainter second bow outside it.')
        + row('v3dAurora', 'Northern and southern lights', 'The aurora from the real space-weather forecast (NOAA), where and as strong as it is forecast, on dark nights.')
        + row('v3dCity', 'Town lights at night', 'The lights of towns and roads from NASA\'s night pictures of the Earth.')
        + row('v3dAptLights', 'Airport lights', 'Runway, approach and taxiway lights, and floodlit aprons, at night and in poor light.')
        + row('v3dAcLights', 'Aircraft lights', 'Navigation lights, strobes, beacons and landing lights, as each flight would have them on.')
        + row('v3dSimTime', 'The simulator\'s time', 'When linked, the sky shows the time in the simulator (so it matches your flight). Off: always the real time.')
        + row('mapNight', 'Day and night on the map', 'The night side of the Earth shaded on the map, moving with the sun.');
    } },
    { type: 'group', title: 'Satellite' },
    { type: 'html', html: () => premiumSatHtml() },
    { type: 'toggle', key: 'v3dSat', label: 'Satellite imagery', hint: 'Shows the real ground from space (Sentinel-2 cloudless by EOX) instead of the map look. Can also be switched in the 3D view.' },
    { type: 'html', html: () => {
      if (!(State.settings as any).v3dSat) return '';
      const q = v3dSatQ(), names = ['Standard', 'Sharp', 'Very sharp', 'Highest'], mb = [2, 8, 30, 45][q];
      const note = q >= 2 ? `<p class="v3d-note warn">${icon('alert')}Very high settings might affect performance: about ${mb} MB of imagery each time the 3D view opens, more memory and more battery use.</p>`
        : q === 0 ? `<p class="v3d-note ok">${icon('info')}Low settings might improve performance on slower phones and PCs and use less data.</p>` : '';
      return `<div class="set-card col"><div class="sc-h">${icon('layers')}<span><b>Satellite detail: ${names[q]}</b><small>How sharp the satellite ground is. Higher shows fields, roads, villages and coastlines in more detail, near you and from high up. The imagery itself is about 10 m per pixel, so the very closest view stays a little soft.</small></span></div>
        <input type="range" class="v3d-satq" min="0" max="3" step="1" value="${q}" aria-label="Satellite detail">
        <div class="v3d-scale"><span>Standard</span><span>Sharp</span><span>Very sharp</span><span>Highest</span></div>${note}</div>
        <div class="set-card col"><div class="sc-h">${icon('map')}<span><b>Sharper imagery at airports: your own imagery service</b><small>The built-in imagery (Sentinel-2) is about 10 m a pixel, so details on the ground are hard to make out. With an imagery service of your own (for example MapTiler Satellite with your own key), the 5 km around the airport show in up to about 1 m a pixel. Paste its tile address with {z}, {x} and {y}. You are responsible for following that service's terms.</small></span></div>
        <input class="le-in v3d-saturl" placeholder="https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=YOUR_KEY" value="${esc((State.settings as any).v3dSatUrl || '')}" spellcheck="false" autocapitalize="off">
        <small class="muted">${satCustom() ? 'In use at airports, up to zoom ' + satCustom().max + '.' : 'Empty: the built-in imagery is used everywhere.'}</small></div>`;
    } },
  ] },
  { id: 'time', title: 'Time and years', icon: 'clock', items: [
    { type: 'choice', key: 'timeMode', label: 'Company calendar', hint: 'Real-world years follow today’s date. Simulated years run faster, so your airline can build up several years of history.', options: [['real', 'Real-world years'], ['sim', 'Simulated years']] },
    { type: 'choice', key: 'simRate', label: 'Simulation speed', hint: 'How much company time passes for each real day.', options: [['week', '1 day = 1 week'], ['month', '1 day = 1 month'], ['quarter', '1 day = 3 months']], when: () => State.settings.timeMode === 'sim' },
  ] },
  { id: 'sync', title: 'Simulator link', icon: 'sync', items: [
    { type: 'html', html: () => { const on = (State.settings as any).realAirways !== false; return `<label class="tg-row"><span><b>Real airways from Flight Simulator</b><small>While linked: airliners and cargo jets fly the high airways and turboprops and light aircraft the low ones, between where their departures end and their arrivals begin, from the simulator's own navigation data. Each route is worked out once and kept on this device.</small></span><button class="tg ${on ? 'on' : ''}" role="switch" aria-checked="${on}" data-act="v3d-opt" data-key="realAirways"><i></i></button></label>`; } },
    { type: 'html', html: () => {
      const on = Link.status === 'connected', pc = Link.pc;
      const sub = on ? `${Link.sim && Link.sim.connected ? esc(Link.sim.sim) : 'Flight Simulator not running'} on ${esc(pc.name)}, ${esc(pc.ip)}${Link.via !== 'wifi' ? ', through your phone\'s ' + (Link.via === 'usb' ? 'USB tethering' : 'hotspot') : ''}${Link.latency ? ', ' + Link.latency + ' ms' : ''}`
        : pc ? `Paired with ${esc(pc.name)}. Looking for it on this network…` : 'Not paired yet. The screens show demo data until you link your PC.';
      return `<div class="set-card link ${on ? 'ok' : ''}"><span class="pc-ic">${icon('pc')}</span><span><b>${on ? 'Connected to your PC' : pc ? 'Not connected' : 'No PC linked'}</b><small>${sub}</small></span><button class="btn ${pc ? 'ghost' : 'primary'} sm" data-act="link-panel">${pc ? 'Details' : 'Link a PC'}</button></div>`
        + (pc ? `<div class="btn-row"><button class="btn ghost sm" data-act="link-forget">${icon('close')}Unpair ${esc(pc.name)}</button></div>` : '');
    } },
    { type: 'html', html: () => DESKTOP ? pcPhoneLinkHtml() : '' },
    { type: 'html', html: () => DESKTOP ? '' : `<p class="fine-print">${icon('info')}The app links to the ${esc(APP.shortName)} PC app over your local network: put the phone and the PC with Flight Simulator on the same Wi-Fi, or connect the PC to your phone's hotspot to use mobile data.</p>` },
    { type: 'toggle', key: 'gsx', label: 'I use GSX Pro', hint: 'Boarded passengers and the ground services you actually use in GSX (boarding, deboarding, catering, fuelling, pushback, de-icing) are taken from GSX and charged at real-world ground handling rates in Finance. Off, or without GSX: the app’s own passenger numbers and a standard handling and catering charge per flight.' },
  ] },
  { id: 'cloud', title: 'Sync', icon: 'share', items: [{ type: 'html', html: () => syncSettingsHtml() }] },
  { id: 'online', title: 'Online services', icon: 'wifi', items: [
    { type: 'html', html: () => `<p class="fine-print">${icon('info')}All optional. Your names, codes and the Discord address stay on this device and are only sent to the service they belong to.</p>` },
    { type: 'html', html: () => setText('faaId', 'FAA NOTAM API: client ID', 'Your own free key from the FAA\'s API portal (api.faa.gov), for real-world NOTAMs in the Flight planner. Kept on this device only.', 'client_id') + setText('faaSecret', 'FAA NOTAM API: client secret', 'The secret that comes with the client ID.', 'client_secret') },
    { type: 'html', html: () => svcOk('simbriefApi') ? setText('sbUser', 'SimBrief username or pilot ID', 'Your latest SimBrief flight plan in Dispatch: route, fuel, weights, and a flight plan for the simulator.', 'username or 123456') : '' },
    { type: 'html', html: () => `<p class="fine-print">${icon('info')}Real-world weather (METAR, TAF and SIGMETs from the Aviation Weather Center) is always used: the real wind picks the runway in use, and your hired pilots delay, hold, divert or cancel when the weather is beyond their aircraft's limits. Show it on the map with the weather button.</p>` },
    { type: 'html', html: () => netChoices().length > 1 ? `<div class="ch-row"><span><b>Online networks</b><small>Controllers online at your airports, your airline's flights online, and their traffic on the map. Updated every minute.</small></span><div class="seg">${netChoices().map(o => `<button class="${Network.which() === o[0] ? 'on' : ''}" data-act="set-choice" data-key="network" data-v="${o[0]}">${esc(o[1])}</button>`).join('')}</div></div>` : '' },
    { type: 'toggle', key: 'netOnMap', label: 'Network traffic on the map', when: () => Network.which() !== 'off' },
    { type: 'html', html: () => Network.which() !== 'off' ? (svcOk('vatsim') ? setText('vatsimId', 'Your VATSIM member ID', 'Shows when you are online yourself.', 'CID', true) : '') + (svcOk('ivao') ? setText('ivaoId', 'Your IVAO VID', '', 'VID', true) : '') : '' },
    { type: 'html', html: () => svcOk('hoppie') ? setText('hoppieCode', 'Hoppie ACARS logon code', 'Free from hoppie.nl. Your load sheet and arrival information go to your aircraft\'s ACARS, and your messages from the aircraft show up in the app.', 'logon code') : '' },
    { type: 'toggle', key: 'hoppieAuto', label: 'Send the load sheet and arrival information automatically', when: () => !!Acars.code() },
    { type: 'html', html: () => setText('discordUrl', 'Discord webhook', 'In your Discord server: Server settings → Integrations → Webhooks → New webhook → Copy webhook URL.', 'https://discord.com/api/webhooks/…') + ((State.settings as any).discordUrl ? `<div class="btn-row"><button class="btn ghost sm" data-act="discord-test">Send a test message</button></div>` : '') },
    { type: 'toggle', key: 'discordMine', label: 'Post my flights', when: () => !!(State.settings as any).discordUrl },
    { type: 'toggle', key: 'discordAi', label: 'Post my hired pilots\' landings', hint: 'At most one post a minute.', when: () => !!(State.settings as any).discordUrl },
    { type: 'toggle', key: 'discordFleet', label: 'Post new and sold aircraft, and loans', when: () => !!(State.settings as any).discordUrl },
    { type: 'toggle', key: 'discordJobs', label: 'Post finished jobs and tours', when: () => !!(State.settings as any).discordUrl },
  ] },
  { id: 'atc', title: 'ATC', icon: 'radio', items: [
    { type: 'choice', key: 'atcSource', label: 'ATC source', options: [['builtin', 'Built-in ATC'], ['beyondatc', 'BeyondATC']] },
    { type: 'toggle', key: 'atcListen', label: 'Listen to BeyondATC audio', hint: 'The PC bridge transcribes BeyondATC offline to detect your clearances.', when: () => State.settings.atcSource === 'beyondatc' },
    { type: 'toggle', key: 'atcFines', label: 'Clearance violations and fines', hint: 'Taking off, landing or taxiing without clearance earns a fine you can contest.' },
    { type: 'toggle', key: 'atcTranscripts', label: 'Save ATC transcripts to the logbook' },
    { type: 'choice', key: 'sttQuality', label: 'Speech recognition quality', hint: 'Higher quality uses more of your PC while you fly.', options: [['light', 'Light'], ['balanced', 'Balanced'], ['accurate', 'Accurate']], when: () => State.settings.atcSource === 'beyondatc' && State.settings.atcListen },
  ] },
  { id: 'services', title: 'Passenger services', icon: 'pax', items: [
    { type: 'html', html: () => { const S: any = State.settings, on = S.cateringStore !== false; return `<label class="tg-row"><span><b>Catering storage</b><small>Buy hot meals, food, snacks, drinks and alcohol into your own storage (Finance → Storage) at the day's prices; the ground crew load each flight from it. You can load a flight yourself while it boards (tap it on the map → Catering); otherwise they do it, very rarely coming up short. Off: each flight buys its catering at the airport.${Mode.coop() ? ' In a co-op the storage is the co-op airline\'s; only the owner buys stock, and everyone\'s flights are loaded from it.' : ''}</small></span><button class="tg ${on ? 'on' : ''}" role="switch" aria-checked="${on}" data-act="v3d-opt" data-key="cateringStore"><i></i></button></label>`; } },
    { type: 'html', html: () => servicesHtml() },
  ] },
  { id: 'staff', title: 'Staff', icon: 'pilots', items: [
    { type: 'group', title: 'Pay' },
    { type: 'html', html: () => payScaleHtml() },
    { type: 'group', title: 'Apron crew' },
    { type: 'choice', key: 'groundHandling', label: 'Apron crew: mechanics, drivers and baggage handlers', hint: 'Your hub and every other base always need your own apron crew: without ground crew there, no aircraft can be unloaded, loaded, fuelled or pushed back, so none can leave. Bases only: everywhere else the local handling company turns your aircraft round for a fee. Every airport: you can also keep your own apron crew at any airport you fly to. Co-pilots and cabin crew are always your own.', options: [['base', 'Bases only'], ['everywhere', 'Every airport']] },
    { type: 'group', title: 'Court' },
    { type: 'toggle', key: 'courtOn', label: 'Court hearings', hint: 'When an accident with deaths is blamed on how the airline is run (aircraft not serviced, mechanics underpaid, tired or not qualified), the airline goes to court and you answer the judge\'s questions in the courtroom, over a couple of days. Your answers affect your company rating. Off: the airline is never taken to court, and open hearings finish on their own.' },
    { type: 'choice', key: 'invTiming', label: 'Accident reports arrive', hint: 'After a crash of one of your aircraft, the accident investigation board\'s preliminary report arrives after this long (or within minutes). You are reminded of it until you open it; the court then waits for you, and you are reminded until you go.', options: [['min', 'Within minutes'], ['1', 'After 1 day'], ['2', 'After 2 days'], ['3', 'After 3 days']] },
    { type: 'html', html: () => { const v = courtTruthLevel(); return `<div class="set-card col"><div class="sc-h">${icon('alert')}<span><b class="tr-h">Lies in court come out: ${COURT_TRUTH_NAMES[v]}</b><small>How likely it is that something untrue you say in court is found out: by the judge there and then, or later, when it leaks to the papers and you are charged with perjury.</small></span></div>
      <input type="range" class="court-truth" min="0" max="3" step="1" value="${v}" aria-label="How likely lies in court come out"><div class="v3d-scale"><span>Never</span><span>Rarely</span><span>Sometimes</span><span>Often</span></div></div>`; } },
    { type: 'html', html: () => `<div class="set-card">${icon('shield')}<span><b>The courtroom</b><small>Walk into the courtroom any time. With no hearing on it is empty; during a hearing everyone is there.</small></span><button class="btn ghost sm" data-act="court-enter">Enter the courtroom</button></div>` },
    { type: 'group', title: 'Conduct' },
    { type: 'toggle', key: 'officeAutoVoice', label: 'Play answers aloud in the office', hint: 'When you call someone into your office over a conduct report, their answers play by themselves. Off: tap the play button to hear them.' },
    { type: 'toggle', key: 'security', label: 'Security officers', hint: 'Your own security staff: hiring, gate checks, guarding aircraft overnight, collecting drunk passengers and their reports. Switching off pauses all of it; no one hired and nothing recorded is lost.' },
    { type: 'toggle', key: 'conduct', label: 'Conduct reports and behaviour', hint: 'Misconduct, warnings and court cases for your AI crew. Switching off never removes what already happened; court cases pause and carry on when you switch back on.' },
    { type: 'html', html: () => {
      const v = conductLevel(), names = ['Never', 'Rarely', 'Less often', 'Normal', 'Often'];
      return `<div class="set-card col"><div class="sc-h">${icon('pilots')}<span><b class="cr-h">Conduct reports: ${names[v]}</b><small>How often your staff get into trouble at all. All the way down: never.</small></span></div>
        <input type="range" class="cr-range" min="0" max="4" step="1" value="${v}" aria-label="How often conduct reports happen">
        <div class="v3d-scale"><span>Never</span><span>Rarely</span><span>Less often</span><span>Normal</span><span>Often</span></div></div>`;
    } },
    { type: 'html', html: () => `<p class="fine-print">${icon('info')}Most of the time your staff behave well. Choose how often someone steps out of line. You'll be asked to discipline or dismiss them when it happens.</p>` },
    { type: 'html', html: () => [['fa', 'Flight attendants'], ['mech', 'Mechanics'], ['ground', 'Ground staff'], ['fo', 'Co-pilots']].map(r => `<div class="ch-row"><span><b>${r[1]}</b><small>How often they misbehave</small></span><div class="seg">${[['never', 'Never'], ['rare', 'Rarely'], ['normal', 'Sometimes'], ['often', 'Often']].map(o => `<button class="${(State.settings as any).misconduct[r[0]] === o[0] ? 'on' : ''}" data-act="set-misconduct" data-r="${r[0]}" data-v="${o[0]}">${o[1]}</button>`).join('')}</div></div>`).join('') },
    { type: 'html', html: () => `<p class="fine-print">${icon('info')}Rarely is about 2% of the time, sometimes about 5–10%, often about 20%.</p>` },
  ] },
  { id: 'realism', title: 'Realism', icon: 'shield', items: [
    { type: 'group', title: 'Damage' },
    { type: 'toggle', key: 'damage', label: 'Damage detection', hint: 'Tail strikes, hard landings, overspeed, engine failures and overstress the simulator can detect.' },
    { type: 'toggle', key: 'turbulence', label: 'Severe turbulence damage', hint: 'Only extreme turbulence counts, with realistic results: inspections, overstress, cabin damage.' },
    { type: 'toggle', key: 'crashPrompt', label: 'Ask me before registering a crash', hint: 'Choose to register or disregard each crash.' },
    { type: 'choice', key: 'repairTime', label: 'Repair time', hint: 'Instant: the aircraft is ready to fly as soon as you pay. Decided by the app: it stays in the hangar for 5, 10, 15, 20, 25, 30, 40, 50, 60 or 90 minutes, depending on the job and how good your mechanics are.', options: [['instant', 'Instant'], ['auto', 'Decided by the app']] },
    { type: 'group', title: 'Economy' },
    { type: 'html', html: () => difficultySettingsHtml() } as any,
    { type: 'toggle', key: 'realMarkets', label: 'Real-world fuel and parts prices', hint: 'Jet fuel follows the real US Gulf Coast jet fuel price (U.S. Energy Information Administration) and spare parts the real US producer price index for aircraft parts (U.S. Bureau of Labor Statistics), updated daily. Off, or offline: a simulated market with its own news.' } as any,
    { type: 'toggle', key: 'pilotLocation', label: 'Pilot location and jumpseat', hint: 'Your next flight starts where you last landed. Flying from somewhere else means a jumpseat ride first, paid from your wallet. Always on in co-op.' } as any,
    { type: 'group', title: 'Other airlines' },
    { type: 'toggle', key: 'tfcRealNames', label: 'Real airline names on other aircraft', hint: 'Other airlines\' aircraft on the map and in the 3D view fly as real airlines (British Airways, Lufthansa, Emirates…) from their real home airports, with their flight codes and registrations. Off: made-up airlines. The league, takeovers and the newspaper always use made-up airlines.' },
  ] },
  { id: 'flightpops', title: 'Flight pop-ups', icon: 'bell', items: [{ type: 'html', html: () => fpSettingsHtml() }] },
  { id: 'news', title: 'News', icon: 'news', items: [
    { type: 'choice', key: 'newsMode', label: 'Newspaper articles', hint: 'When your airline makes the papers. Every article is also in the inbox and under Newspaper in the menu.', options: [['popup', 'Open by themselves, animated'], ['notify', 'Only in the inbox, animated when opened'], ['plain', 'Only in the inbox, without animation']] },
  ] },
  { id: 'voice', title: 'Voices', icon: 'volume', items: [
    { type: 'toggle', key: 'mechanicVoice', label: 'People speak their messages', hint: 'The mechanic, the gate agent, passengers and the head of operations read their messages aloud, word for word, with a play button to hear them again: women with women\'s voices, men with men\'s, angry people sound angry, apologies sound sorry. Everything runs on this device.' },
    { type: 'choice', key: 'voiceEngine', label: 'Voice', hint: 'Natural voices sound like real people. Until they are downloaded, the device\'s own voice reads the messages.', options: [['neural', 'Natural voices'], ['device', 'Device voice']], when: () => State.settings.mechanicVoice },
    { type: 'html', html: () => State.settings.mechanicVoice && (State.settings as any).voiceEngine !== 'device' ? voicePackCard() : '' },
    { type: 'html', html: () => State.settings.mechanicVoice && (State.settings as any).voiceEngine === 'device' ? deviceVoicesCard() : '' },
    { type: 'toggle', key: 'autoVoice', label: 'Read messages aloud automatically', hint: 'Off: messages from your staff and from ATC stay quiet until you press their play button. On: they start speaking as soon as they open.', when: () => State.settings.mechanicVoice },
    { type: 'html', html: () => State.settings.mechanicVoice ? `<div class="btn-row">${VOICE_TESTS.map(t => `<button class="btn ghost sm" data-act="voice-test" data-k="${t[0]}">${icon('play')}${esc(t[1])}</button>`).join('')}</div>` : '' },
  ] },
  { id: 'sound', title: 'Sound and feel', icon: 'volume', items: [
    { type: 'group', title: 'App' },
    { type: 'toggle', key: 'muteAll', label: 'Mute all sounds', hint: 'Silences every sound in the app, voices too.' },
    { type: 'toggle', key: 'titleMusic', label: 'Start screen music', hint: 'The soundtrack of the start screen, when the app opens. Off: the film plays without sound.' },
    { type: 'toggle', key: 'mechanicVoice', label: 'Voices in dialogues', hint: 'The mechanic, the gate agent, passengers and the head of operations speak their messages. Off: no voices and no play buttons, the messages are only written.', when: () => !State.settings.muteAll },
    { type: 'toggle', key: 'onlyVoices', label: 'Only the voices', hint: 'Every other sound is off (purchases, payments, taps, chimes), but the people in the dialogues still speak. Switch off to have all sounds again.', when: () => !State.settings.muteAll },
    { type: 'toggle', key: 'purchaseSound', label: 'Purchase sound', hint: 'Plays when you buy an aircraft.', when: () => !State.settings.muteAll && !(State.settings as any).onlyVoices },
    { type: 'html', html: () => State.settings.muteAll || (State.settings as any).onlyVoices ? '' : `<button class="btn ghost" data-act="sound-test">${icon('play')}Play purchase sound</button>` },
    { type: 'toggle', key: 'paySound', label: 'Payment sound', hint: 'Plays when you pay a bill, repair or fine.', when: () => !State.settings.muteAll && !(State.settings as any).onlyVoices },
    { type: 'html', html: () => State.settings.muteAll || (State.settings as any).onlyVoices ? '' : `<button class="btn ghost" data-act="pay-test">${icon('play')}Play payment sound</button>` },
    { type: 'toggle', key: 'uiSounds', label: 'Interface sounds', when: () => !State.settings.muteAll && !(State.settings as any).onlyVoices },
    { type: 'toggle', key: 'haptics', label: 'Vibration feedback' },
    { type: 'toggle', key: 'reduceMotion', label: 'Reduce motion', hint: 'Shorter animations and a still map.' },
    { type: 'group', title: '3D view' },
    { type: 'html', html: () => {
      const S: any = State.settings, v = Math.round((S.v3dVol == null ? 0.7 : +S.v3dVol) * 100), cv = Math.round((S.v3dCabinVol == null ? 0.7 : +S.v3dCabinVol) * 100);
      const row = (k: string, label: string, hint: string) => `<label class="tg-row"><span><b>${label}</b><small>${hint}</small></span><button class="tg ${S[k] !== false ? 'on' : ''}" role="switch" aria-checked="${S[k] !== false}" data-act="v3d-opt" data-key="${k}"><i></i></button></label>`;
      if (State.settings.muteAll || S.onlyVoices) return `<p class="v3d-note">${icon('info')}Sounds are off (Mute all sounds, or Only the voices, above).</p>`;
      return row('v3dEngines', 'Engine sounds', 'The aircraft near the camera: the roar and whine of jets, the beat of propellers, louder with power and the nearer they are. Quieter from the forward view, and muffled from inside the cabin.')
        + row('v3dThunder', 'Thunder', 'After each flash of lightning, arriving as late as real thunder does (about 3 seconds a kilometre), heard out to about 16 km: a sharp crack close by, a low rumble far away.')
        + `<div class="set-card col"><div class="sc-h">${icon('volume')}<span><b class="v3v-h">3D view volume: ${v}%</b><small>Engines and thunder together. The app's other sounds keep their own level.</small></span></div>
        <input type="range" class="v3d-vol" min="0" max="100" step="5" value="${v}" aria-label="3D view volume"></div>`
        + `<div class="set-card col"><div class="sc-h">${icon('volume')}<span><b class="v3c-h">Cabin sound: ${cv ? cv + '%' : 'Muted'}</b><small>Inside the cabin and at the window seats: the deep rumble and drone of your own engines through the hull, the air rushing past, louder on the engine's side at a window. All the way down mutes it.</small></span></div>
        <input type="range" class="v3d-cvol" min="0" max="100" step="5" value="${cv}" aria-label="Cabin sound volume"></div>`
        + (() => { const ov = Math.round((S.v3dOutVol == null ? 1 : +S.v3dOutVol) * 100); return `<div class="set-card col"><div class="sc-h">${icon('volume')}<span><b class="v3o-h">Outside noise: ${ov ? ov + '%' : 'Muted'}</b><small>Outside the aircraft: the engines as you circle one (Behind and Around), the roar behind it, the whine in front, and the aircraft around you.</small></span></div>
        <input type="range" class="v3d-ovol" min="0" max="150" step="5" value="${ov}" aria-label="Outside noise volume"></div>`; })();
    } },
  ] },
  { id: 'profiles', title: 'Profiles and companies', icon: 'pilots', items: [
    { type: 'choice', key: 'appMode', label: 'How pilots and companies relate', options: [['shared', 'One pilot, several companies'], ['separate', 'A pilot per company']] },
    { type: 'html', html: () => State.profiles.map(pr => {
      const pl = pilot(pr.pilotId);
      return `<div class="set-card col"><div class="sc-h">${icon('user')}<span><b>${esc(pl.name)}</b><small>${esc(pr.label)}</small></span></div>
        ${State.companies.filter(c => c.profileId === pr.id).map(c => `<div class="sc-co"><span class="co-badge sm" style="--co:${c.color};--co2:${c.color2}">${esc(c.icao)}</span><b>${esc(c.name)}</b>
          <small>${c.divisions.length ? c.divisions.map(d => esc(d.name)).join(' and ') + ' divisions, shared money and reputation' : 'Separate company'}, ${State.fleet.filter(a => a.companyId === c.id).length} aircraft, ${money(c.balance, { compact: true })}</small>
          <button class="del-btn edit" data-act="edit-company" data-co="${c.id}" aria-label="Edit ${esc(c.name)}">${icon('sliders')}</button>
          <button class="del-btn" data-act="delete-company" data-co="${c.id}" aria-label="Delete ${esc(c.name)}">${icon('trash')}</button></div>`).join('')}</div>`;
    }).join('') + `<div class="btn-row"><button class="btn ghost" data-act="new-company">${icon('plus')}New company</button><button class="btn ghost" data-act="new-division">${icon('plus')}New division</button></div>
      <div class="danger-zone"><span><b>Saved on this device</b><small>Your companies are saved automatically and kept when the app updates.</small></span><button class="btn ghost sm danger-txt" data-act="reset-ask">${icon('trash')}Delete everything</button></div>` },
  ] },
  { id: 'backup', title: 'Backup and restore', icon: 'shield', items: [
    { type: 'choice', key: 'autosaveMin', label: 'Autosave', hint: 'Saves your game by itself in its own Autosave slot, which you can load from the start screen like any other save. This is a real saved game, on top of the automatic backups.', options: [['0', 'Off'], ['5', '5 min'], ['10', '10 min'], ['15', '15 min'], ['25', '25 min'], ['30', '30 min']] },
    { type: 'html', html: () => `<p class="fine-print">${icon('info')}Everything is saved on this phone the moment it changes: settings, looks, staff, fleet, money, flight logs and the link to your PC. When you open the app again it is exactly as you left it, also after updates.</p>` },
    { type: 'html', html: () => {
      const f = Backup.folder, native = !!Backup.tools() || DESKTOP;
      if (!native) return `<div class="set-card"><span class="pc-ic">${icon('shield')}</span><span><b>Backups</b><small>Save a backup file and open it again on any device.</small></span></div>`;
      const last = f && f.lastWrite ? 'last saved ' + dateStr(new Date(f.lastWrite)) : 'no backup written yet';
      return `<div class="set-card ${f && f.set ? 'ok' : ''}"><span class="pc-ic">${icon('shield')}</span><span><b>${f && f.set ? 'Automatic backups are on' : 'Choose a backup folder'}</b>
        <small>${f && f.set ? `To ${esc(f.name || 'your folder')}, ${esc(last)}. Clearing the app's data or reinstalling doesn't touch it.` : 'Pick a folder outside the app (Documents, an SD card or a Google Drive folder). The airline is copied there automatically, and after a reinstall or on a new phone you pick it again to get everything back.'}</small></span>
        ${DESKTOP ? '' : `<button class="btn ${f && f.set ? 'ghost' : 'primary'} sm" data-act="backup-folder">${f && f.set ? 'Change' : 'Choose folder'}</button>`}</div>`
        + (f && f.set ? `<div class="btn-row"><button class="btn ghost sm" data-act="backup-now">${icon('check')}Back up now</button></div>` : '');
    } },
    { type: 'html', html: () => SaveSlots.html() },
    { type: 'html', html: () => `<div class="btn-row"><button class="btn ghost sm" data-act="backup-export">${icon('download')}Save a backup file</button><button class="btn ghost sm" data-act="backup-import">${icon('sync')}Restore from a backup</button></div>` },
    { type: 'html', html: () => `<p class="fine-print">${icon('info')}Android's own backup (Settings → Google → Backup on the phone) also carries the app's data to a new phone.</p>` },
    { type: 'html', html: () => `<div class="ch-row"><span><b>Start from scratch</b><small>Wipe every airline, aircraft, staff member, route, flight and log, and found a new airline. Settings are kept. Make a backup first if you may want it back.</small></span><button class="btn danger sm" data-act="fs-scratch">${icon('trash')}Start over</button></div>` },
  ] },
  { id: 'support', title: 'Updates and errors', icon: 'download', items: [
    { type: 'html', html: () => {
      const u = Updater, busy = u.state === 'checking' || u.state === 'downloading' || u.state === 'installing';
      return `<div class="set-card"><span class="pc-ic">${icon('download')}</span><span><b>Version ${esc(APP.version)}</b><small>${esc(updateStatusText())}</small></span>
        ${u.state === 'available' ? `<button class="btn primary sm" data-act="update-open">Install ${esc(u.info.version)}</button>` : `<button class="btn ghost sm" data-act="update-check" ${busy ? 'disabled' : ''}>Check for updates</button>`}</div>`;
    } },
    { type: 'html', html: () => {
      const n = ErrorLog.list.length;
      return `<div class="set-card col"><div class="sc-h">${icon('alert')}<span><b>Error log</b><small>${n ? n + ' saved, newest first. Tap one to see the details.' : 'No errors so far. If something goes wrong, the details show up here.'}</small></span></div>
        ${ErrorLog.list.slice(0, 12).map(e => `<button class="err-row" data-act="err-open" data-id="${e.id}"><b>${esc(e.title)}</b><span>${esc(e.message)}</span><small>${esc(e.time)}</small></button>`).join('')}
        ${n ? `<div class="btn-row"><button class="btn ghost sm" data-act="err-show-all">Show all</button><button class="btn ghost sm" data-act="err-copy">${icon('copy')}Copy</button><button class="btn ghost sm" data-act="err-share">${icon('share')}Share</button><button class="btn ghost sm danger-txt" data-act="err-clear">${icon('trash')}Clear</button></div>` : ''}</div>`;
    } },
    { type: 'html', html: () => `<div class="set-card col"><div class="sc-h">${icon('route')}<span><b>Flight trace</b><small>How every aircraft flies: phase, altitude, speed, heading, position and runway, every 30 seconds while the app is open. ${FlightTrace.problems ? FlightTrace.problems + ' problem' + (FlightTrace.problems === 1 ? '' : 's') + ' marked (jumps, too fast, off the runway, no touchdown).' : 'No problems marked.'} ${num(FlightTrace.lines.length)} lines.</small></span></div>
        <div class="btn-row"><button class="btn ghost sm" data-act="trace-save">${icon('download')}Save the log file</button><button class="btn ghost sm danger-txt" data-act="trace-clear">${icon('trash')}Clear</button></div></div>` },
    { type: 'html', html: () => `<p class="fine-print">${icon('info')}The error log stays on this device. Nothing is sent anywhere unless you copy or share it yourself.</p>` },
  ] },
  { id: 'about', title: 'About', icon: 'info', items: [
    { type: 'html', html: () => `<div class="about"><p><b>${esc(APP.name)}</b> ${esc(APP.version)}, early preview. Screens show demo data until your simulator is linked.</p>
      <p>Aircraft and company names are used only to identify the products installed in your simulator. Aircraft illustrations are original artwork.</p>
      <h4>Credits</h4><p>Inter typeface by The Inter Project Authors, SIL Open Font License 1.1.</p><p>Real-world market prices: jet fuel from the U.S. Energy Information Administration, aircraft parts from the U.S. Bureau of Labor Statistics (both public domain, via FRED, Federal Reserve Bank of St. Louis); jet fuel outlook from the EIA Short-Term Energy Outlook (public domain).</p><p>3D view water outlines: © OpenStreetMap contributors (OpenMapTiles, OpenFreeMap). Satellite imagery: Sentinel-2 cloudless 2016 by EOX IT Services GmbH (contains modified Copernicus Sentinel data 2016), CC BY 4.0.</p><p>3D terrain heights: Terrain Tiles on AWS (Mapzen / Tilezen). ArcticDEM terrain data DEM(s) were created from DigitalGlobe, Inc., imagery and funded under National Science Foundation awards 1043681, 1559691, and 1542736; Australia terrain data © Commonwealth of Australia (Geoscience Australia) 2017; Austria terrain data © offene Daten Österreichs – Digitales Geländemodell (DGM) Österreich; Canada terrain data contains information licensed under the Open Government Licence – Canada; Europe terrain data produced using Copernicus data and information funded by the European Union - EU-DEM layers; Global ETOPO1 terrain data U.S. National Oceanic and Atmospheric Administration; Mexico terrain data source: INEGI, Continental relief, 2016; New Zealand terrain data Copyright 2011 Crown copyright (c) Land Information New Zealand and the New Zealand Government (All rights reserved); Norway terrain data © Kartverket; United Kingdom terrain data © Environment Agency copyright and/or database right 2015. All rights reserved; United States 3DEP (formerly NED) and global GMTED2010 and SRTM terrain data courtesy of the U.S. Geological Survey.</p><p>Voices: Kokoro-82M by hexgrad, Apache License 2.0; pronunciation dictionaries from misaki by hexgrad, Apache License 2.0; ONNX Runtime by Microsoft, MIT License.</p><p>three.js by the three.js authors, MIT License.</p><p>Star positions from the Hipparcos catalogue (ESA), as prepared in d3-celestial by Olaf Frohn, BSD 3-Clause License. Town lights at night: NASA Black Marble, from NASA's Global Imagery Browse Services (GIBS), public domain.</p><p>Human body model and shape targets from MakeHuman, CC0 1.0 (public domain).</p><p>MapLibre GL JS, BSD 3-Clause License. Street map © OpenStreetMap contributors, OpenMapTiles, OpenFreeMap. Satellite map: Sentinel-2 cloudless 2016 by EOX IT Services GmbH (contains modified Copernicus Sentinel data 2016), CC BY 4.0.</p><p>Airport layouts © OpenStreetMap contributors, available under the Open Database License (ODbL). Airport and runway list from OurAirports (public domain).</p><p>Weather reports from aviationweather.gov, the US National Weather Service's Aviation Weather Center (public domain). SimBrief is a service of Navigraph; Discord is a trademark of Discord Inc. Names are used only to identify the services.</p></div>` },
  ] },
];

let _setSection = 'general';

/* ---------- Registration ---------- */
let _lic: { form: '' | 'key' | 'react'; key: string; msg: string; bad: boolean; busy: boolean } = { form: '', key: '', msg: '', bad: false, busy: false };

function licenceHtml(): string {
  const st = Licence.status(), r = Licence.rec();
  const msg = _lic.msg ? `<p class="lic-msg ${_lic.bad ? 'bad' : 'ok'}">${icon(_lic.bad ? 'alert' : 'check')}${esc(_lic.msg)}</p>` : '';
  const keyIn = (v: string) => `<input class="le-in lic-in" id="lic-key" value="${esc(v)}" placeholder="XXXXX-XXXXX-XXXXX" maxlength="23" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Registration key">`;
  const card = st === 'ok'
    ? `<div class="set-card ok lic-card"><span class="pc-ic">${icon('key')}</span><span><b>Registered</b><small>Key ${esc(r.masked)} on ${esc(r.deviceName)}, since ${esc(dateStr(new Date(r.at)))}</small></span></div>`
    : st === 'moved'
    ? `<div class="set-card warn lic-card"><span class="pc-ic">${icon('alert')}</span><span><b>Registered on another device</b><small>Key ${esc(r.masked)} was registered on ${esc(r.deviceName)}. Enter it here with a reactivation code to move it to this device.</small></span></div>`
    : st === 'checking'
    ? `<div class="set-card lic-card"><span class="pc-ic">${icon('key')}</span><span><b>Checking the registration…</b></span></div>`
    : `<div class="set-card lic-card"><span class="pc-ic">${icon('key')}</span><span><b>Not registered</b><small>Enter the registration key you received with your purchase.</small></span></div>`;
  const form = st === 'moved' || _lic.form === 'react'
    ? `<div class="lic-form"><div class="le-group"><b>Registration key</b>${keyIn(_lic.key)}</div>
        <div class="le-group"><b>Reactivation code</b><input class="le-in lic-in" id="lic-code" placeholder="XXXXX-XXXXX-XXXXX" maxlength="23" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Reactivation code"></div>
        ${msg}<div class="btn-row"><button class="btn primary sm" data-act="lic-react" ${_lic.busy ? 'disabled' : ''}>${icon('key')}Reactivate on this device</button>${st !== 'moved' ? `<button class="btn ghost sm" data-act="lic-cancel">Cancel</button>` : ''}</div></div>`
    : st === 'none' || _lic.form === 'key'
    ? `<div class="lic-form"><div class="le-group"><b>Registration key</b>${keyIn(_lic.key)}</div>${msg}
        <div class="btn-row"><button class="btn primary sm" data-act="lic-register" ${_lic.busy ? 'disabled' : ''}>${icon('check')}Register</button>${st === 'ok' ? `<button class="btn ghost sm" data-act="lic-cancel">Cancel</button>` : ''}</div></div>`
    : `${msg}<div class="btn-row"><button class="btn ghost sm" data-act="lic-form" data-f="key">${icon('key')}Enter a key again</button><button class="btn ghost sm" data-act="lic-form" data-f="react">${icon('sync')}Use a reactivation code</button></div>`;
  return card + form
    + `<p class="fine-print">${icon('info')}A registration key belongs to the first device it is registered on. That device can register it again as often as needed, also after reinstalling the app. On a new phone or PC, or after Windows or the phone has been set up from scratch, the key needs a reactivation code. Each reactivation code works once.</p>`;
}
// keys are typed in capitals, in groups of five
document.addEventListener('input', e => {
  const el = e.target as HTMLInputElement; if (!el || !el.classList || !el.classList.contains('lic-in')) return;
  const raw = Licence.normalise(el.value).slice(0, 15), v = Licence.show(raw);
  if (v !== el.value) { el.value = v; try { el.setSelectionRange(v.length, v.length); } catch (er) { /* not focused */ } }
});
function licRerender() { if (_setSection === 'licence') rerenderSettingsBody(); }
function licVal(id: string): string { const el = $('#' + id) as HTMLInputElement; return el ? el.value : ''; }
ACTIONS['lic-form'] = el => { _lic = { form: el.getAttribute('data-f') as any, key: '', msg: '', bad: false, busy: false }; Sound.tick(); licRerender(); const k = $('#lic-key') as HTMLInputElement; if (k) k.focus(); };
ACTIONS['lic-cancel'] = () => { _lic = { form: '', key: '', msg: '', bad: false, busy: false }; Sound.tick(); licRerender(); };
ACTIONS['lic-register'] = () => {
  const key = licVal('lic-key'); if (!key.trim()) { _lic.msg = 'Enter your registration key first.'; _lic.bad = true; licRerender(); return; }
  _lic.key = key; _lic.busy = true; _lic.msg = ''; licRerender();
  Licence.register(key).then(res => {
    _lic.busy = false;
    if (res === 'ok') { _lic = { form: '', key: '', msg: 'Thank you! The app is registered on this device.', bad: false, busy: false }; Haptics.success(); Sound.purchase(); }
    else if (res === 'other-device') { _lic.form = 'react'; _lic.msg = 'This key is registered on another device. Enter a reactivation code to move it here.'; _lic.bad = true; }
    else { _lic.msg = 'That isn’t a valid registration key. Check it against the one you received with your purchase.'; _lic.bad = true; Haptics.pulse(30); }
    licRerender();
  });
};
ACTIONS['lic-react'] = () => {
  const key = licVal('lic-key'), code = licVal('lic-code');
  if (!key.trim() || !code.trim()) { _lic.key = key; _lic.msg = 'Enter both your registration key and the reactivation code.'; _lic.bad = true; licRerender(); return; }
  _lic.key = key; _lic.busy = true; _lic.msg = ''; licRerender();
  Licence.reactivate(key, code).then(res => {
    _lic.busy = false;
    const m: { [k: string]: string } = { 'invalid-key': 'That isn’t a valid registration key.', 'invalid-code': 'That isn’t a valid reactivation code.', 'used-code': 'That reactivation code has already been used. Each code works once.' };
    if (res === 'ok') { _lic = { form: '', key: '', msg: 'Reactivated. The key now belongs to this device.', bad: false, busy: false }; Haptics.success(); Sound.purchase(); }
    else { _lic.msg = m[res]; _lic.bad = true; Haptics.pulse(30); }
    licRerender();
  });
};

/** The parts of a section (the items after each 'group' marker); one part when it has none. */
function setGroups(sec: SetSection): { title: string; items: SetItem[] }[] {
  const out: { title: string; items: SetItem[] }[] = [];
  for (const it of sec.items) { if (it.type === 'group') out.push({ title: it.title, items: [] }); else { if (!out.length) out.push({ title: '', items: [] }); out[out.length - 1].items.push(it); } }
  return out;
}
function setSubOf(id: string, n: number): number { const S: any = State.settings, v = (S.setSub || {})[id] || 0; return clamp(v, 0, n - 1); }
ACTIONS['set-sub'] = el => { const S: any = State.settings; S.setSub = S.setSub || {}; S.setSub[_setSection] = +el.getAttribute('data-g'); Store.soon(); Sound.tick(); rerenderSettingsBody(true); };
function settingsBody(): string {
  const sec = SETTINGS.filter(s => s.id === _setSection)[0];
  const S: any = State.settings, groups = setGroups(sec), gi = setSubOf(sec.id, groups.length);
  // two or more parts: a switch at the top, one part shown at a time
  const sw = groups.length > 1 ? `<div class="seg set-sub" role="tablist">${groups.map((g, i) => `<button class="${i === gi ? 'on' : ''}" role="tab" aria-selected="${i === gi}" data-act="set-sub" data-g="${i}">${esc(g.title)}</button>`).join('')}</div>` : '';
  const saveCard = sec.id === 'view3d' ? setSaveCardHtml('gfx') : sec.id === 'general' && gi === 0 ? setSaveCardHtml('other') : '';
  return `<h2>${esc(sec.title)}</h2>` + sw + saveCard + groups[gi].items.map(it => {
    if ((it as any).when && !(it as any).when()) return '';
    if (it.type === 'toggle') return `<label class="tg-row"><span><b>${esc(it.label)}</b>${it.hint ? `<small>${esc(it.hint)}</small>` : ''}</span>${toggle(it.key, !!S[it.key])}</label>`;
    if (it.type === 'choice') return `<div class="ch-row"><span><b>${esc(it.label)}</b>${it.hint ? `<small>${esc(it.hint)}</small>` : ''}</span><div class="seg">${it.options.map(o => `<button class="${S[it.key] === o[0] ? 'on' : ''}" data-act="set-choice" data-key="${it.key}" data-v="${o[0]}">${esc(o[1])}</button>`).join('')}</div></div>`;
    return it.type === 'html' ? it.html() : '';
  }).join('');
}

function settingsHtml(): string {
  return `
  <div class="settings">
    <nav class="set-nav">
      <div class="set-title"><b>Settings</b></div>
      ${SETTINGS.map(s => `<button class="set-tab ${_setSection === s.id ? 'on' : ''}" data-act="set-section" data-s="${s.id}">${icon(s.icon)}<span>${esc(s.title)}</span></button>`).join('')}
    </nav>
    <div class="set-body" id="set-body">${settingsBody()}</div>
    <button class="icon-btn set-close" data-act="close-layer" aria-label="Close settings">${icon('close')}</button>
  </div>`;
}

ACTIONS.settings = el => {
  const sec = el && el.getAttribute('data-section');
  if (sec) _setSection = sec;
  closeAll(); Sound.tick();
  openLayer('modal', settingsHtml(), { cls: 'full settings-pop' });
};
/** On the PC: the code and address your phone links with (the PC app's own window shows them here). */
let _pcLink: { code?: string; name?: string; addresses?: string[]; phones?: number; at: number } = { at: 0 };
function pcPhoneLinkHtml(): string {
  if (Date.now() - _pcLink.at > 4000) {
    _pcLink.at = Date.now();
    fetch('/api/link-info').then(r => r.json()).then(j => { const was = JSON.stringify([_pcLink.code, _pcLink.phones, _pcLink.addresses]); Object.assign(_pcLink, j, { at: Date.now() }); if (was !== JSON.stringify([j.code, j.phones, j.addresses]) && $('#set-body')) rerenderSettingsBody(); }).catch(() => { /* older PC app */ });
  }
  const c = String(_pcLink.code || ''), ips = (_pcLink.addresses || []).join(', '), n = _pcLink.phones || 0;
  if (!c) return '';
  return `<div class="set-card link ${n ? 'ok' : ''}"><span class="pc-ic">${icon('wifi')}</span><span><b>${n ? `${n} phone${n > 1 ? 's' : ''} linked` : 'Link your phone too'}</b><small>In the app on your phone: the link button at the top, pick ${esc(_pcLink.name || 'this PC')}${ips ? ` (${esc(ips)})` : ''} and enter this code. Phone and PC on the same Wi-Fi, or this PC on your phone's hotspot.</small></span><b class="pc-code">${esc(c.slice(0, 3))} ${esc(c.slice(3))}</b></div>`;
}

function rerenderSettingsBody(anim?: boolean) {
  const b = $('#set-body'); if (!b) return;
  if (anim) b.innerHTML = settingsBody(); else patchHtml(b, settingsBody());   // updates in place don't flash
  if (anim) { b.classList.remove('swap'); void b.offsetWidth; b.classList.add('swap'); }
}
ACTIONS['set-section'] = el => {
  _setSection = el.getAttribute('data-s'); Sound.tick();
  $all('.set-tab').forEach(t => t.classList.toggle('on', t.getAttribute('data-s') === _setSection));
  rerenderSettingsBody(true);
};
ACTIONS['v3d-glow'] = () => { const S: any = State.settings; S.v3dGlow = !v3dHalo(); Store.save(); Sound.tick(); rerenderSettingsBody(); toast('Glow around lights: from the next time the 3D view opens', 'info'); };
ACTIONS['v3d-opt'] = el => { const S: any = State.settings, k = el.getAttribute('data-key'); S[k] = S[k] === false; Store.save(); Sound.tick(); rerenderSettingsBody(); };
ACTIONS['set-choice'] = el => {
  if (el.getAttribute('data-key') === 'aiSpeed') aiSetSpeed(+el.getAttribute('data-v') || 1);
  (State.settings as any)[el.getAttribute('data-key')] = el.getAttribute('data-v');
  if (el.getAttribute('data-key') === 'network') { Network.pilots = []; Network.atc = []; Network.at = 0; Network.start(); }
  Store.save();
  Sound.tick(); rerenderSettingsBody();
  refresh();
  // apron crew back to the home base only: you decide what happens to the people at other airports
  if (el.getAttribute('data-key') === 'groundHandling') apronCrewChanged();
};

ACTIONS.toggle = el => {
  const key = el.getAttribute('data-key');
  const on = !el.classList.contains('on');
  el.classList.toggle('on', on); el.setAttribute('aria-checked', String(on));
  if (key in State.settings) (State.settings as any)[key] = on;
  Sound.tick(); Haptics.pulse(8);
  if (key === 'mk-installed') { _mkInstalled = on; refresh(); return; }
  if (key === 'reduceMotion') document.documentElement.classList.toggle('calm', on);
  if (key === 'muteAll') { if (on) Voice.stop(); renderTopbar(); }
  if (key === 'muteAll' || key === 'titleMusic') { (State.settings as any)[key] = on; Store.save(); try { titleMusicSync(); } catch (e) { /* no start screen */ } }
  if (key === 'mechanicVoice' && !on) Voice.stop();
  if (key === 'conduct') setConduct(on);
  if (key in State.settings) { Store.save(); setTimeout(() => rerenderSettingsBody(), 180); }
};

ACTIONS['sound-test'] = () => { const was = State.settings.purchaseSound; State.settings.purchaseSound = true; Sound.purchase(); Haptics.success(); State.settings.purchaseSound = was; };
ACTIONS['pay-test'] = () => { const was = State.settings.paySound; State.settings.paySound = true; Sound.payOut(); Haptics.pulse(30); State.settings.paySound = was; };
// [key, button, who, line]
const VOICE_TESTS: string[][] = [
  ['mechanic', 'Mechanic', 'mechanic', 'Morning, captain. I had a look at OY-ANA after that last flight. Everything is in good shape, and she is ready to go.'],
  ['gate', 'Gate agent', 'gate', 'Captain, boarding is complete. One hundred and sixty-eight passengers on board, and the doors are closing.'],
  ['ops', 'Head of operations', 'ops', 'Good afternoon. A short report from operations: all flights left on time today. Well done, everyone.'],
  ['angry', 'Angry passenger', 'pax|m|angry|Paul Collins', 'This is unacceptable! I have been waiting for three hours, and nobody tells us anything!'],
  ['sorry', 'Apology', 'gate|f|sorry', 'I am so sorry, captain. The fuel truck was late, and that is our fault. It will not happen again.'],
  ['drunk', 'Drunk passenger', 'pax|f|drunk|Heidi Larsen', 'I\'m fine. I\'m totally fine! Just let me on the plane, I paid for my ticket!'],
];
ACTIONS['voice-test'] = el => { const t = VOICE_TESTS.filter(x => x[0] === ((el && el.getAttribute('data-k')) || 'mechanic'))[0] || VOICE_TESTS[0]; Voice.speak(t[3], undefined, t[2]); };
function voicePackCard(): string {
  const v = VoicePack, pct = v.total ? Math.round(v.done / v.total * 100) : 0;
  if (v.state === 'ready') return `<div class="set-card ok"><span class="pc-ic">${icon('volume')}</span><span><b>Natural voices are installed</b><small>On this ${DESKTOP ? 'PC' : 'device'}. They work without the internet.</small></span><button class="btn ghost sm" data-act="voicepack-remove">Remove</button></div>`;
  if (v.state === 'downloading') return `<div class="set-card"><span class="pc-ic">${icon('download')}</span><span><b>Downloading the voices… ${pct}%</b><small>${Math.round(v.done / 1e6)} of ${Math.round((v.total || 1) / 1e6)} MB. You can keep using the app.</small><span class="cab-bar"><i style="width:${pct}%"></i></span></span></div>`;
  return `<div class="set-card"><span class="pc-ic">${icon('volume')}</span><span><b>Natural voices</b><small>${v.state === 'error' ? 'The download stopped: ' + esc(v.error) + '. ' : ''}About ${v.sizeText()}, downloaded once over Wi-Fi or mobile data${v.state === 'partial' ? ' (part of it is already here)' : ''}. Kokoro voices, Apache License 2.0.</small></span><button class="btn primary sm" data-act="voicepack-get">${v.state === 'error' || v.state === 'partial' ? 'Continue' : 'Download'}</button></div>`;
}
ACTIONS['voicepack-get'] = () => { VoicePack.download(); rerenderSettingsBody(); };
ACTIONS['voicepack-remove'] = () => { confirmChange('Remove the natural voices?', 'They can be downloaded again at any time. Until then the device\'s own voice reads the messages.', 'Remove', 'Keep', () => { closeTop(); VoicePack.remove(); }, () => closeTop()); };
ACTIONS['link-forget'] = () => { Link.forget(); rerenderSettingsBody(); toast('PC unpaired', 'info'); };
ACTIONS['new-division'] = () => {
  const c = company();
  c.divisions.push({ id: uid(), name: 'Division ' + (c.divisions.length + 1), color: '#5FD4A0' });
  rerenderSettingsBody(); renderTopbar(); toast(`New division added to ${c.name}`, 'ok');
  try { newsDivision(c, c.divisions[c.divisions.length - 1].name); } catch (e) { /* ignore */ }
};

ACTIONS['reset-ask'] = () => {
  Sound.tick();
  openLayer('modal', `<div class="modal-head del-head"><span class="del-ic">${icon('trash')}</span><div><h2>Delete everything?</h2><small>All companies, pilot profiles, aircraft, routes, flight logs, finances and settings on this device</small></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
    <div class="modal-body"><p class="lede warn">${icon('alert')}This can't be undone. The app starts again from the beginning.</p>
    <div class="modal-actions"><button class="btn ghost" data-act="close-layer">Cancel</button><button class="btn danger" data-act="reset-do">Yes, delete everything</button></div></div>`, { cls: 'narrow' });
};

ACTIONS['delete-company'] = el => {
  const c = company(el.getAttribute('data-co')); if (!c) return;
  Sound.tick();
  if (State.companies.length === 1) {
    openLayer('modal', `<div class="modal-head"><h2>${esc(c.name)} is your only company</h2><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
      <div class="modal-body"><p class="lede">${icon('info')}Create another company first, or delete everything to start from the beginning.</p>
      <div class="modal-actions"><button class="btn ghost" data-act="close-layer">Cancel</button><button class="btn" data-act="new-company">${icon('plus')}New company</button></div></div>`, { cls: 'narrow' });
    return;
  }
  const regs = State.fleet.filter(a => a.companyId === c.id).map(a => a.reg);
  const routes = State.routes.filter(r => r.companyId === c.id).length;
  const logs = State.logbook.filter(l => regs.indexOf(l.reg) >= 0).length;
  openLayer('modal', `<div class="modal-head del-head"><span class="co-badge" style="--co:${c.color};--co2:${c.color2}">${esc(c.icao)}</span><div><h2>Delete ${esc(c.name)}?</h2><small>Are you sure? This can't be undone.</small></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
    <div class="modal-body">
      <div class="kv-row">
        <div><small>Aircraft</small><b>${regs.length}</b></div>
        <div><small>Routes</small><b>${routes}</b></div>
        <div><small>Flight log entries</small><b>${logs}</b></div>
        <div><small>Balance</small><b>${money(c.balance, { compact: true })}</b></div>
      </div>
      <p class="lede warn">${icon('alert')}All of this is deleted with the company. Your pilot profile and other companies stay as they are.</p>
      <div class="modal-actions"><button class="btn ghost" data-act="close-layer">Keep ${esc(c.name)}</button><button class="btn danger" data-act="delete-company-do" data-co="${c.id}">${icon('trash')}Yes, delete ${esc(c.name)}</button></div>
    </div>`, { cls: 'narrow' });
};
ACTIONS['delete-company-do'] = el => {
  const id = el.getAttribute('data-co'), c = company(id);
  const regs = State.fleet.filter(a => a.companyId === id).map(a => a.reg);
  State.companies = State.companies.filter(x => x.id !== id);
  State.fleet = State.fleet.filter(a => a.companyId !== id);
  State.live = State.live.filter(f => regs.indexOf(f.reg) < 0);
  State.routes = State.routes.filter(r => r.companyId !== id);
  State.issues = State.issues.filter(i => regs.indexOf(i.reg) < 0);
  State.logbook = State.logbook.filter(l => regs.indexOf(l.reg) < 0);
  delete State.myReg[id];
  if (State.companyId === id) { State.companyId = State.companies[0].id; State.divisionId = 'all'; applyCompanyTheme(true); }
  closeTop();
  Haptics.pulse(30); Store.save();
  rerenderSettingsBody(); renderTopbar(); refresh();
  toast(`${c.name} deleted`, 'warn');
};
ACTIONS['reset-do'] = () => Store.reset();

ACTIONS['set-misconduct'] = el => { (State.settings as any).misconduct[el.getAttribute('data-r')] = el.getAttribute('data-v'); Sound.tick(); rerenderSettingsBody(); };

/* ---------- Edit an airline: name, codes, home base, colours (asks before applying) ---------- */
const CO_COLORS = ['#2C8CFF', '#3FB6A8', '#E2A23B', '#D2553A', '#9C7CFF', '#E04BD6', '#1F4E9C', '#D81939', '#2D8C3C', '#F2C14E', '#0B1560', '#7FC4FF'];
let _coEdit: any = null;
ACTIONS['edit-company'] = el => {
  const c = company(el.getAttribute('data-co')); if (!c) return;
  _coEdit = { id: c.id, color: c.color };
  openLayer('modal', `<div class="modal-head"><div><h2>Edit ${esc(c.name)}</h2><small>Name, codes, home base and colours</small></div><button class="icon-btn" data-act="close-layer" aria-label="Close">${icon('close')}</button></div>
    <div class="modal-body">
      <div class="le-group"><b>Name</b><input class="le-in" data-co-name value="${esc(c.name)}" maxlength="40" autocomplete="off"></div>
      <div class="le-row2"><div class="le-group"><b>ICAO code</b><input class="le-in" data-co-icao value="${esc(c.icao)}" maxlength="3" autocomplete="off"></div>
        <div class="le-group"><b>Callsign</b><input class="le-in" data-co-cs value="${esc(c.callsign)}" maxlength="16" autocomplete="off"></div></div>
      <div class="le-group"><b>Home base</b><select class="le-in" data-co-hub>${Object.keys(AIRPORTS).filter(k => k !== 'DEP').sort().map(k => `<option value="${k}" ${k === c.hub ? 'selected' : ''}>${k}, ${esc(AIRPORTS[k].name)}</option>`).join('')}</select></div>
      <div class="le-group"><b>Colour</b><div class="le-sw">${CO_COLORS.map(col => `<button class="sw ${col === c.color ? 'on' : ''}" style="--c:${col}" data-act="co-color" data-c="${col}" aria-label="Colour ${col}"></button>`).join('')}</div></div>
      <div class="le-group"><b>Livery</b><button class="btn ghost" data-act="livery-open" data-co="${c.id}">${icon('fleet')}Design the livery</button></div>
      <div class="modal-actions"><button class="btn ghost" data-act="close-layer">Cancel</button><button class="btn primary" data-act="co-save">${icon('check')}Save</button></div>
    </div>`, { cls: 'narrow' });
};
ACTIONS['co-color'] = el => { if (!_coEdit) return; _coEdit.color = el.getAttribute('data-c'); $all('[data-act=co-color]').forEach(b => b.classList.toggle('on', b.getAttribute('data-c') === _coEdit.color)); Sound.tick(); };
ACTIONS['co-save'] = () => {
  if (!_coEdit) return;
  const c = company(_coEdit.id), v = (sel: string) => (($(sel) as HTMLInputElement) || {} as any).value;
  const next = { name: (v('[data-co-name]') || c.name).trim() || c.name, icao: (v('[data-co-icao]') || c.icao).trim().toUpperCase().slice(0, 3) || c.icao, callsign: (v('[data-co-cs]') || c.callsign).trim().toUpperCase() || c.callsign, hub: v('[data-co-hub]') || c.hub, color: _coEdit.color };
  const changed = (Object.keys(next) as (keyof typeof next)[]).some(k => (c as any)[k] !== next[k]);
  if (!changed) { closeAll(); return; }
  confirmChange(`Change ${c.name}?`, `${next.name !== c.name ? 'New name ' + next.name + '. ' : ''}${next.hub !== c.hub ? 'Home base moves to ' + next.hub + '. ' : ''}The change applies everywhere in the app.`, 'Yes, change it', 'No, keep it as it is',
    () => { Object.assign(c, next); closeAll(); applyCompanyTheme(true); Store.save(); renderTopbar(); refresh(); toast(`${c.name} updated`, 'ok'); },
    () => { closeAll(); toast('Nothing changed', 'info'); });
};

/* ---------- Text settings (online services) ---------- */
function setText(key: string, label: string, hint: string, ph: string, short?: boolean): string {
  const v = String((State.settings as any)[key] || ''), secret = key === 'hoppieCode' || key === 'discordUrl';
  return `<div class="ch-row txt"><span><b>${esc(label)}</b>${hint ? `<small>${esc(hint)}</small>` : ''}</span><input class="inp set-text ${short ? 'short' : ''}" data-key="${key}" ${secret ? 'type="password"' : ''} value="${esc(v)}" placeholder="${esc(ph)}" autocomplete="off" spellcheck="false"></div>`;
}
document.addEventListener('change', e => {
  const el = e.target as HTMLInputElement; if (!el || !el.classList || !el.classList.contains('set-text')) return;
  const key = el.getAttribute('data-key'), v = el.value.trim();
  if (key === 'discordUrl' && v && !/^https:\/\/(discord|discordapp)\.com\/api\/webhooks\//.test(v)) { toast('That isn\'t a Discord webhook address', 'warn'); return; }
  (State.settings as any)[key] = v; Store.save();
  if (key === 'hoppieCode') Acars.start();
  if (key === 'sbUser') SimBrief.error = '';
  toast('Saved', 'ok'); rerenderSettingsBody();
});
ACTIONS['discord-test'] = () => { Online.test().then(() => toast('Test message sent to Discord', 'ok'), (e: any) => toast((e && e.message) || 'Not sent', 'warn')); };

// the cabin quality slider: kept when let go (the cabin is made again the next time you look at it)
document.addEventListener('input', e => {
  const el = e.target as HTMLInputElement; if (!el || !el.classList || !el.classList.contains('v3d-cabq')) return;
  const h = el.closest('.set-card') && el.closest('.set-card').querySelector('.cq-h'); if (h) h.textContent = 'Cabin quality: ' + CABIN_Q_NAMES[+el.value];
});
document.addEventListener('change', e => {
  const el = e.target as HTMLInputElement; if (!el || !el.classList || !el.classList.contains('v3d-cabq')) return;
  (State.settings as any).v3dCabinQ = +el.value; Store.save(); rerenderSettingsBody();
});
// the satellite detail slider: kept when let go
document.addEventListener('input', e => {
  const el = e.target as HTMLInputElement; if (!el || !el.classList || !el.classList.contains('v3d-satq')) return;
  const h = el.parentElement && el.parentElement.querySelector('.sc-h b'); if (h) h.textContent = `Satellite detail: ${['Standard', 'Sharp', 'Very sharp', 'Highest'][+el.value]}`;
});
document.addEventListener('change', e => {
  const el = e.target as HTMLInputElement; if (!el || !el.classList || !el.classList.contains('v3d-satq')) return;
  (State.settings as any).v3dSatQ = +el.value; Store.save(); rerenderSettingsBody();
});
// the cloud sliders: the value shows while dragging, it's kept when let go
document.addEventListener('input', e => {
  const el = e.target as HTMLInputElement; if (!el || !el.classList) return;
  const card = el.closest('.set-card');
  if (el.classList.contains('cl-km')) { const h = card && card.querySelector('.cl-km-h'); if (h) h.textContent = `Cloud distance: ${+el.value ? el.value + ' km' : 'Off'}`; }
  if (el.classList.contains('cl-d')) { const h = card && card.querySelector('.cl-d-h'); if (h) h.textContent = `Cloud detail: ${CLOUD_DETAIL_NAMES[+el.value - 1]}`; }
});
ACTIONS['joined-rooms'] = () => { const S: any = State.settings; S.joinedRooms = S.joinedRooms === false; Store.save(); Sound.tick(); rerenderSettingsBody(); };
ACTIONS['cl-mode'] = (b: HTMLElement) => { const v = b && b.getAttribute('data-v') === '2d'; if (cloudFlat() === v) return; Sound.tick(); (State.settings as any).cloud2d = v; if (V3d.open) (V3d as any).cloudReload = !(V3d as any).cloudReload; Store.save(); rerenderSettingsBody(); };
document.addEventListener('change', e => {
  const el = e.target as HTMLInputElement; if (!el || !el.classList) return;
  if (el.classList.contains('cl-km')) (State.settings as any).cloudKm = +el.value;
  else if (el.classList.contains('cl-d')) (State.settings as any).cloudDetail = +el.value;
  else return;
  Store.save(); rerenderSettingsBody();
});
// how often conduct reports happen
document.addEventListener('input', e => { const el = e.target as HTMLInputElement; if (!el || !el.classList || !el.classList.contains('v3d-vol')) return; (State.settings as any).v3dVol = +el.value / 100; const h = el.closest('.set-card') && el.closest('.set-card').querySelector('.v3v-h'); if (h) h.textContent = '3D view volume: ' + el.value + '%'; });
document.addEventListener('change', e => { const el = e.target as HTMLInputElement; if (el && el.classList && (el.classList.contains('v3d-vol') || el.classList.contains('v3d-cvol'))) Store.save(); });
document.addEventListener('input', e => { const el = e.target as HTMLInputElement; if (!el || !el.classList || !el.classList.contains('v3d-ovol')) return; (State.settings as any).v3dOutVol = +el.value / 100; const h = el.closest('.set-card') && el.closest('.set-card').querySelector('.v3o-h'); if (h) h.textContent = 'Outside noise: ' + (+el.value ? el.value + '%' : 'Muted'); });
document.addEventListener('change', e => { const el = e.target as HTMLInputElement; if (el && el.classList && el.classList.contains('v3d-ovol')) Store.save(); });
document.addEventListener('input', e => { const el = e.target as HTMLInputElement; if (!el || !el.classList || !el.classList.contains('v3d-cvol')) return; (State.settings as any).v3dCabinVol = +el.value / 100; const h = el.closest('.set-card') && el.closest('.set-card').querySelector('.v3c-h'); if (h) h.textContent = 'Cabin sound: ' + (+el.value ? el.value + '%' : 'Muted'); });
document.addEventListener('input', e => { const el = e.target as HTMLInputElement; if (!el || !el.classList || !el.classList.contains('cr-range')) return; const h = el.closest('.set-card') && el.closest('.set-card').querySelector('.cr-h'); if (h) h.textContent = 'Conduct reports: ' + ['Never', 'Rarely', 'Less often', 'Normal', 'Often'][+el.value]; });
document.addEventListener('change', e => { const el = e.target as HTMLInputElement; if (!el || !el.classList || !el.classList.contains('cr-range')) return; (State.settings as any).conductLevel = +el.value; Store.save(); rerenderSettingsBody(); });
// the 3D view distance slider: the value shows while dragging, it's kept when let go
document.addEventListener('input', e => {
  const el = e.target as HTMLInputElement; if (!el || !el.classList || !el.classList.contains('v3d-range')) return;
  (State.settings as any).v3dKm = +el.value;
  const h = el.parentElement && el.parentElement.querySelector('.sc-h b'); if (h) h.textContent = `View distance: ${el.value} km`;
});
document.addEventListener('change', e => {
  const el = e.target as HTMLInputElement; if (!el || !el.classList || !el.classList.contains('v3d-range')) return;
  (State.settings as any).v3dKm = +el.value; Store.save(); rerenderSettingsBody();
});

document.addEventListener('change', e => {
  const el = e.target as HTMLInputElement; if (!el || !el.classList || !el.classList.contains('v3d-saturl')) return;
  const v = el.value.trim(); (State.settings as any).v3dSatUrl = v; Store.save();
  toast(!v ? 'Built-in imagery everywhere' : satCustom() ? 'Your imagery service is used at airports' : 'That address needs https:// and {z}, {x} and {y}', v && !satCustom() ? 'warn' : 'ok');
  try { rerenderSettingsBody(); } catch (x) { /* ignore */ }
});


/** Graphics → Cabin: each part of the cabin on its own. "Automatic" follows the cabin quality (and says what that is now). */
function cabinSettingsHtml(): string {
  const S: any = State.settings, q = cabinQ();
  const seg = (key: string, label: string, hint: string, opts: [string, string][], auto: string) => {
    const cur = cabinOpt(key);
    return `<div class="ch-row"><span><b>${label}</b><small>${hint}</small></span><div class="seg">${[['auto', `Automatic (${auto})`] as [string, string]].concat(opts).map(o => `<button class="${cur === o[0] ? 'on' : ''}" data-act="cab-opt" data-key="${key}" data-v="${o[0]}">${esc(o[1])}</button>`).join('')}</div></div>`;
  };
  const tg = (k: string, label: string, hint: string) => `<label class="tg-row"><span><b>${label}</b><small>${hint}</small></span><button class="tg ${S[k] !== false ? 'on' : ''}" role="switch" aria-checked="${S[k] !== false}" data-act="v3d-opt" data-key="${k}"><i></i></button></label>`;
  const seatAuto = CABIN_SEAT_NEAR[cabinSeatAuto()], hdAuto = String(cabinHdAuto()), hdqAuto = q === 3 ? 'Highest' : DESKTOP ? ['Normal', 'High', 'High'][q] : 'Light';
  const scAuto = q === 3 ? 'up to 300%' : q === 2 && DESKTOP ? 'up to 200%' : '100%';
  return `<div class="set-card col cab-opts">
    <div class="sc-h">${icon('sliders')}<span><b>The cabin, part by part</b><small>Each starts on Automatic, which follows the cabin quality above. Choose your own to make one part finer or lighter.${cabinLowMem() ? ' This device has 4 GB of memory or less, so Automatic keeps the cabin light.' : !DESKTOP ? ' On phones and tablets Automatic keeps fewer detailed passengers and the screen\'s own sharpness, as their graphics memory is small.' : ' On the PC Automatic uses the high settings; every choice up to the highest is open.'}</small></span></div>
    <div class="cab-h">Seats and drawing</div>
    ${seg('cabSeatNear', 'Detailed seats', 'How far around you the seats are drawn with their padding, seams and stitching. Further away a lighter seat that looks the same from a distance; seats fade from one to the other as you move.', CABIN_SEAT_NEAR.map((n, i) => [String(i), n] as [string, string]), seatAuto)}
    ${seg('cabScale', 'Sharpness', 'How finely the cabin is drawn against your screen. Above 100% edges are smoother, at the cost of speed.', [['0', '75%'], ['1', '100%'], ['2', '150%'], ['3', '200%'], ['4', '300%']], scAuto)}
    ${seg('cabGuard', 'Keep the frame rate smooth', 'While the frame rate is low, the cabin is drawn a little less sharply until it is smooth again.', [['on', 'On'], ['off', 'Off']], q < 3 ? 'On' : 'Off')}
    ${tg('cabMood', 'Mood lighting', 'The blue lights that light the side walls, the ceiling and the bins (softer by day, fuller at night). Off: quicker on slower devices.')}
    <div class="cab-h">Passengers</div>
    ${tg('v3dCabinPax', 'Passengers in the cabin', 'The passengers in their own seats from the passenger list, each looking as they do there, with pets on their owners\' laps. Off: empty seats (quicker on slower devices).')}
    ${seg('cabHd', 'Detailed passengers', 'How many of the passengers nearest to you are drawn as detailed figures, with the faces from the passenger list. The others are simpler figures; they fade from one to the other as you move.', CABIN_HD_N.map((n, i) => [String(i), n ? String(n) : 'Off'] as [string, string]), hdAuto)}
    ${seg('cabHdQ', 'Detail of each passenger', 'How finely each detailed passenger is made: faces, hair and clothes.', CABIN_HD_Q.map((n, i) => [String(i), n] as [string, string]), hdqAuto)}
  </div>`;
}
/** Graphics → Lounges, Hangars, Offices and rooms: each place's own quality and its parts, as for the cabin. Automatic
 *  follows the Rooms setting (and says what that is now). Changes apply the next time you go in. */
function placeSettingsHtml(pl: 'lounge' | 'hangar' | 'room'): string {
  const S: any = State.settings, rq = Gfx.roomQ(), q = Gfx.placeQ(pl), QN = ['Low', 'Medium', 'Very high', 'Ultra'];
  const cur = (k: string) => S[k] == null ? 'auto' : String(S[k]);
  const seg = (key: string, label: string, hint: string, opts: [string, string][], auto: string) => `<div class="ch-row"><span><b>${label}</b><small>${hint}</small></span><div class="seg">${([['auto', `Automatic (${auto})`]] as [string, string][]).concat(opts).map(o => `<button class="${cur(key) === o[0] ? 'on' : ''}" data-act="place-opt" data-key="${key}" data-v="${o[0]}">${esc(o[1])}</button>`).join('')}</div></div>`;
  const tg = (k: string, label: string, hint: string) => `<label class="tg-row"><span><b>${label}</b><small>${hint}</small></span><button class="tg ${S[k] !== false ? 'on' : ''}" role="switch" aria-checked="${S[k] !== false}" data-act="v3d-opt" data-key="${k}"><i></i></button></label>`;
  const what = pl === 'lounge' ? 'your lounges' : pl === 'hangar' ? 'the hangars' : 'your office, the operations room and the courtroom';
  const shAuto = (pl === 'room' ? q >= 1 : q >= 2) ? 'On' : 'Off', scAuto = q >= 3 ? 'up to 200%' : q >= 2 ? 'up to 150%' : '100%';
  return `<div class="set-card col cab-opts">
    <div class="sc-h">${icon('sliders')}<span><b>${pl === 'lounge' ? 'Lounges' : pl === 'hangar' ? 'Hangars' : 'Offices and rooms'}, part by part</b><small>How finely ${what} are made and drawn. Each starts on Automatic, which follows Rooms (now ${QN[rq]}). Changes apply the next time you go in.</small></span></div>
    ${pl === 'room' ? seg('gfxRoomQ', 'Quality', 'Furniture, curves, light and textures in your office, the operations room and the courtroom.', QN.map((n, i) => [String(i), n] as [string, string]), QN[typeof cabinQ === 'function' ? cabinQ() : 2])
      : seg(pl + 'Q', 'Quality', pl === 'lounge' ? 'Furniture, carpets, curves, light and the view from the windows.' : 'The building, the aircraft inside, the equipment and the light.', QN.map((n, i) => [String(i), n] as [string, string]), QN[rq])}
    ${seg(pl + 'Sharp', 'Sharpness', 'How finely it is drawn against your screen. Above 100% edges are smoother, at the cost of speed.', [['0', '75%'], ['1', '100%'], ['2', '150%'], ['3', '200%'], ['4', '300%']], scAuto)}
    ${seg(pl + 'Shadow', 'Shadows', 'Real shadows from the lights. Off: quicker on slower devices.', [['on', 'On'], ['off', 'Off']], shAuto)}
    ${pl === 'lounge' ? tg('loungeHeat', 'Heat above hot drinks', 'A small shimmer of heat rising from a fresh coffee or tea, like the heat behind the engines; it fades as the drink cools. Off: no shimmer.') : ''}
    ${pl === 'room' ? '' : `${tg(pl + 'People', pl === 'lounge' ? 'Guests' : 'Mechanics', pl === 'lounge' ? 'Your waiting business and first class passengers, sitting, walking about and helping themselves. Off: an empty lounge (quicker on slower devices).' : 'The mechanics working on the aircraft. Off: an empty hangar floor (quicker on slower devices).')}
    ${seg(pl + 'PplQ', pl === 'lounge' ? 'Detail of each guest' : 'Detail of each mechanic', 'How finely each person is made: faces, hair and clothes.', [['0', 'Light'], ['1', 'Normal'], ['2', 'High'], ['3', 'Highest']], q >= 2 ? 'High' : 'Light')}`}
  </div>`;
}
ACTIONS['place-opt'] = el => { const S: any = State.settings, k = el.getAttribute('data-key'), v = el.getAttribute('data-v'); if (v === 'auto') delete S[k]; else S[k] = /^\d$/.test(v) ? +v : v; Sound.tick(); Store.save(); rerenderSettingsBody(); };
/** How finely people move, everywhere they appear: walking, speaking and body language. */
function animSettingsHtml(): string {
  const S: any = State.settings, auto = ANIM_NAMES[animAuto()];
  const seg = (key: string, label: string, hint: string) => { const cur = S[key] == null ? 'auto' : String(S[key]);
    return `<div class="ch-row"><span><b>${label}</b><small>${hint}</small></span><div class="seg">${[['auto', `Automatic (${auto})`] as [string, string]].concat(ANIM_NAMES.map((n, i) => [String(i), n] as [string, string])).map(o => `<button class="${cur === o[0] ? 'on' : ''}" data-act="cab-opt" data-key="${key}" data-v="${o[0]}">${o[1]}</button>`).join('')}</div></div>`; };
  return `<div class="set-card col cab-opts">
    <div class="sc-h">${icon('sliders')}<span><b>Animation</b><small>How finely people move in the cabin, your offices and the courtroom. Automatic follows the cabin quality. Lower is quicker on slower devices.</small></span></div>
    ${seg('animWalk', 'Walking', 'Steps, arm swing and the bob of each stride. Ultra: the head moves with every step too.')}
    ${seg('animSpeak', 'Speaking', 'Mouths while someone talks in a conversation. Low: still. Medium: the jaw. High: the jaw and the lips. Ultra: also the teeth and the tongue.')}
    ${seg('animBody', 'Body language', 'The small movements at rest: breathing, swaying, the head looking about. Low: still.')}
  </div>`;
}
/** HD satellite imagery as a Premium subscription (a demo for now: nothing is sold and no payment is taken). */
function premiumSatHtml(): string {
  const on = !!(State.settings as any).hdSatDemo;
  return `<div class="set-card col prem-sat ${on ? 'on' : ''}">
    <div class="sc-h">${icon('star')}<span><b>HD satellite imagery · Premium</b><small>Sharp satellite imagery of the whole world in the 3D view, streamed as you fly: runways, taxiways, terminals, roads and towns in detail, from high up and on final. No account and no key of your own: switch it on and fly.</small></span></div>
    <div class="prem-row"><span class="prem-price"><b>Subscription</b><small>Monthly · price to be announced</small></span>
      <button class="btn ${on ? 'ghost' : 'primary'} sm" data-act="hdsat-demo">${on ? 'End the demo' : 'Try the demo'}</button></div>
    ${on ? `<p class="v3d-note ok">${icon('check')}Demo on: this is how Premium will look in Settings once it can be bought.</p>` : ''}
    <p class="prem-demo">${icon('info')}<span><b>Demo mode.</b> Premium can't be bought yet: no payment is taken, and the imagery stays the standard Sentinel-2 imagery. The HD imagery is planned to come from Mapbox Satellite, paid per tile shown from the subscription.</span></p>
  </div>`;
}
ACTIONS['hdsat-demo'] = () => { const S: any = State.settings; S.hdSatDemo = !S.hdSatDemo; Store.save(); Sound.tick(); try { rerenderSettingsBody(); } catch (e) { /* closed */ } };
ACTIONS['cab-opt'] = el => {
  const S: any = State.settings, k = el.getAttribute('data-key'), v = el.getAttribute('data-v');
  if (v === 'auto') delete S[k]; else S[k] = v;
  Store.save(); Sound.tick(); rerenderSettingsBody();
};

// how likely lies in court come out: kept when let go
document.addEventListener('input', e => { const el = e.target as HTMLInputElement; if (!el || !el.classList || !el.classList.contains('court-truth')) return; const h = el.closest('.set-card') && el.closest('.set-card').querySelector('.tr-h'); if (h) h.textContent = 'Lies in court come out: ' + COURT_TRUTH_NAMES[+el.value]; });
document.addEventListener('change', e => { const el = e.target as HTMLInputElement; if (!el || !el.classList || !el.classList.contains('court-truth')) return; (State.settings as any).courtTruth = +el.value; Store.save(); });

/** Settings → Voices with the device's own voice: its male and female voices, each in variations, to listen to.
 *  Everyone you meet keeps one of them (the same each time); yours follows the voice you chose for your pilot. */
function deviceVoicesCard(): string {
  if (!DeviceVoices.loaded) { DeviceVoices.load().then(() => { try { refresh(); } catch (e) { /* later */ } }); return `<div class="card dev-voices"><p class="muted">Looking for this device's voices…</p></div>`; }
  const row = (sx: 'm' | 'f') => { const V = DeviceVoices.variants(sx); return `<div class="le-group"><b>${sx === 'm' ? 'Male' : 'Female'} voices (${V.length})</b><div class="le-voices">${V.map((v, i) => `<button class="le-voice" data-act="dev-voice-try" data-s="${sx}" data-i="${i}"><span class="lv-ic">${icon('volume')}</span><span><b>${sx === 'm' ? 'Male' : 'Female'} ${i + 1}</b><small>${esc((v.name || 'Device voice').replace(/^Microsoft /, '').replace(/ - English.*$/, '').slice(0, 28))}${v.pitch < 0.97 ? ', deeper' : v.pitch > 1.03 ? ', higher' : ''}</small></span></button>`).join('')}</div></div>`; };
  const n = DeviceVoices.list.length, nm = DeviceVoices.list.filter(x => x.sex === 'm').length, nf = DeviceVoices.list.filter(x => x.sex === 'f').length;
  return `<div class="card dev-voices"><p class="muted">${n ? `This device has ${n} English voice${n === 1 ? '' : 's'} (${nm} male, ${nf} female${n - nm - nf ? `, ${n - nm - nf} other` : ''}). Each is used in several pitches and paces, so the people you meet sound different, and each keeps the same voice every time.` : 'This device lists no voices of its own, so its default voice is made deeper or higher for each person.'} More voices can be added in the device's own speech settings.</p>${row('m')}${row('f')}</div>`;
}
ACTIONS['dev-voice-try'] = el => {
  const sx = el.getAttribute('data-s') === 'f' ? 'f' : 'm', i = +(el.getAttribute('data-i') || 0);
  $all('.dev-voices .le-voice').forEach(b => b.classList.toggle('on', b === el));
  try { Voice.stop(); Voice.speak(`Hello. This is ${sx === 'm' ? 'male' : 'female'} voice ${i + 1}. Shall we get the aircraft ready?`, undefined, `me|${sx}|neutral|__dev${i}`); } catch (e) { /* no voice */ }
};

/** Automatic performance: fewer frames and a little less sharpness while the device is warm or slow. */
function perfSettingsHtml(): string {
  const S: any = State.settings, cur = S.perfAuto == null ? 'auto' : S.perfAuto === false || S.perfAuto === 'off' ? 'off' : 'on';
  const opts: [string, string][] = [['auto', 'Automatic (off: frame generation keeps it smooth)'], ['on', 'On'], ['off', 'Off']];
  return `<div class="set-card col cab-opts">
    <div class="sc-h">${icon('sliders')}<span><b>Smooth on this device</b><small>The 3D view, your offices and the courtroom keep their frame rate up: while it drops, they are drawn a little less sharply, and sharp again when there is room. When the ${DESKTOP ? 'computer' : 'phone or tablet'} gets warm or battery saver is on, they draw up to 30 frames a second, which also keeps it cooler and saves battery.</small></span></div>
    <div class="ch-row"><span><b>Automatic performance</b><small>${esc(Perf.label())}</small></span><div class="seg">${opts.map(o => `<button class="${cur === o[0] ? 'on' : ''}" data-act="perf-set" data-v="${o[0]}">${o[1]}</button>`).join('')}</div></div>
    <div class="ch-row"><span><b>Frame generation</b><small>Extra frames made between the ones the device draws, from the last one and how far it lies (its depth), shifted to where you are looking now: the 3D view, the cabin, the rooms and the hangars become smoother, often nearly twice the frames a second on slower phones and tablets. Always on: as many frames in between as help, none when the device keeps up by itself. With automatic performance: only while the frame rate is held at 30. Things that move by themselves (other aircraft, people) still move at the real frame rate, and the very edges can look a little smeared while you turn quickly.</small></span><div class="seg">${([['off', 'Off'], ['auto', 'With automatic performance'], ['on', 'Always on']] as [string, string][]).map(o => `<button class="${FrameGen.mode() === o[0] ? 'on' : ''}" data-act="framegen-set" data-v="${o[0]}">${o[1]}</button>`).join('')}</div></div>
    <label class="tg-row"><span><b>Performance monitor</b><small>A small panel of text in the 3D places: frames a second (real and made), the processor's and the graphics chip's time per frame, the processor's cores, and a quick switch for frame generation. Drag it anywhere.</small></span><button class="tg ${(S as any).fgMon !== false ? 'on' : ''}" role="switch" aria-checked="${(S as any).fgMon !== false}" data-act="fgmon-toggle"><i></i></button></label>
    <div class="ch-row"><span><b>Hair</b><small>How people's hair is drawn. Strands: one by one, the finest (for strong PCs). Hair cards: fewer, wider locks of hair, nearly as good and far lighter (phones and tablets). Flat: painted on the head only, the lightest. Automatic: strands on the PC, hair cards on phones and tablets. Shows on the people you see next.</small></span><div class="seg">${([['auto', 'Automatic'], ['strands', 'Strands'], ['cards', 'Hair cards'], ['flat', 'Flat']] as [string, string][]).map(o => `<button class="${((S as any).hairMode || 'auto') === o[0] ? 'on' : ''}" data-act="hair-set" data-v="${o[0]}">${o[1]}</button>`).join('')}</div></div>
  </div>`;
}
ACTIONS['perf-set'] = el => {
  const S: any = State.settings, v = el.getAttribute('data-v');
  if (v === 'auto') delete S.perfAuto; else S.perfAuto = v === 'on';
  Store.save(); Sound.tick(); rerenderSettingsBody();
};
ACTIONS['framegen-set'] = el => { const S: any = State.settings; S.frameGen = el.getAttribute('data-v'); Store.save(); Sound.tick(); rerenderSettingsBody(); try { fgMonSync(true); } catch (e) { /* not open */ } };
ACTIONS['hair-set'] = el => { const S: any = State.settings, v = el.getAttribute('data-v'); if (v === 'auto') delete S.hairMode; else S.hairMode = v; Store.save(); Sound.tick(); rerenderSettingsBody(); try { if (typeof Human !== 'undefined' && (Human as any).clearCache) (Human as any).clearCache(); } catch (e) { /* the next ones */ } };
ACTIONS['fgmon-toggle'] = () => { const S: any = State.settings; S.fgMon = S.fgMon === false; Store.save(); Sound.tick(); rerenderSettingsBody(); try { fgMonSync(true); } catch (e) { /* none */ } };

// the terrain detail slider: the name shows while dragging, it's kept when let go
document.addEventListener('input', e => { const el = e.target as HTMLInputElement; if (!el || !el.classList || !el.classList.contains('v3d-tq')) return; const h = el.closest('.set-card') && el.closest('.set-card').querySelector('.tq-h'); if (h) h.textContent = 'Terrain detail: ' + TERRAIN_Q_NAMES[+el.value]; });
document.addEventListener('change', e => { const el = e.target as HTMLInputElement; if (!el || !el.classList || !el.classList.contains('v3d-tq')) return; (State.settings as any).v3dTerrainQ = +el.value; Store.save(); rerenderSettingsBody(); });


/* ---------- saving settings yourself: the graphics settings, and the others, each on their own ---------- */
// The game keeps every change by itself; these keep a copy you made on purpose, to go back to after trying things,
// and can be saved to a file and loaded again (another device, a new install). Nothing private goes into the file.
const SET_PRIVATE = /licen|regkey|token|secret|password|supabase|anon|serial|reactiv/i;
function setIsGfx(k: string): boolean { return /^(v3d|cab|gfx|frameGen|hairMode|perfAuto|fgMon|room|place|anim|cloud|cl[A-Z]|terrain|water|sat|shadow|fps|stress|joinedRooms|sceneGear|recShow)/.test(k); }
function setPick(kind: 'gfx' | 'other'): { [k: string]: any } {
  const S: any = State.settings, out: any = {};
  for (const k of Object.keys(S)) { if (SET_PRIVATE.test(k) || k === 'setSaved') continue; if (setIsGfx(k) === (kind === 'gfx')) out[k] = JSON.parse(JSON.stringify(S[k])); }
  return out;
}
function setSaved(): any { const S: any = State; S.setSaved = S.setSaved || {}; return S.setSaved; }
function setSaveCardHtml(kind: 'gfx' | 'other'): string {
  const sv = setSaved()[kind], name = kind === 'gfx' ? 'graphics settings' : 'other settings (everything but graphics)';
  return `<div class="set-card col"><div class="sc-h">${icon('download')}<span><b>Save your ${kind === 'gfx' ? 'graphics settings' : 'other settings'}</b><small>The game keeps every change by itself. Save your ${esc(name)} yourself too, to go back to them after trying something, or to a file for another device. ${sv ? `Last saved ${esc(dateStr(new Date(sv.at)))}.` : 'Not saved yet.'}</small></span></div>
    <div class="btn-row"><button class="btn primary sm" data-act="set-save" data-k="${kind}">${icon('check')}Save now</button>${sv ? `<button class="btn ghost sm" data-act="set-restore" data-k="${kind}">${icon('reload')}Go back to the saved ones</button>` : ''}<button class="btn ghost sm" data-act="set-file" data-k="${kind}">${icon('download')}Save to a file</button><label class="btn ghost sm">${icon('copy')}Load from a file<input type="file" accept=".json,application/json" class="set-load" data-k="${kind}" hidden></label></div></div>`;
}
ACTIONS['set-save'] = el => { const k = el.getAttribute('data-k') as 'gfx' | 'other'; setSaved()[k] = { at: Date.now(), vals: setPick(k) }; Store.save(); Sound.purchase(); toast(k === 'gfx' ? 'Graphics settings saved' : 'Settings saved', 'ok'); rerenderSettingsBody(); };
function setApply(k: 'gfx' | 'other', vals: any) {
  const S: any = State.settings; for (const key of Object.keys(setPick(k))) if (!(key in vals)) delete S[key];
  for (const key of Object.keys(vals)) if (!SET_PRIVATE.test(key) && setIsGfx(key) === (k === 'gfx')) S[key] = vals[key];
  Store.save(); try { applyCompanyTheme(); } catch (e) { /* none */ } try { boosterSync(); } catch (e) { /* none */ }
  if (k === 'gfx') { try { if (typeof V3d !== 'undefined' && V3d.open) v3dReloadAll(); } catch (e) { /* next time */ } }
}
ACTIONS['set-restore'] = el => { const k = el.getAttribute('data-k') as 'gfx' | 'other', sv = setSaved()[k]; if (!sv) return; setApply(k, sv.vals); Sound.tick(); toast(k === 'gfx' ? 'Back to your saved graphics settings' : 'Back to your saved settings', 'ok'); rerenderSettingsBody(); };
ACTIONS['set-file'] = el => {
  const k = el.getAttribute('data-k') as 'gfx' | 'other', data = JSON.stringify({ app: APP.name, version: APP.version, kind: k, at: new Date().toISOString(), settings: setPick(k) }, null, 1);
  const a = document.createElement('a'); a.download = `${k === 'gfx' ? 'graphics-settings' : 'settings'}-${new Date().toISOString().slice(0, 10)}.json`; a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' })); document.body.appendChild(a); a.click(); a.remove();
  toast('Saved to a file on your device', 'ok');
};
document.addEventListener('change', e => {
  const el = e.target as HTMLInputElement; if (!el || !el.classList || !el.classList.contains('set-load') || !el.files || !el.files[0]) return;
  const k = el.getAttribute('data-k') as 'gfx' | 'other';
  el.files[0].text().then(t => { const j = JSON.parse(t); if (!j || !j.settings) throw new Error('not a settings file'); if (j.kind && j.kind !== k) { toast(j.kind === 'gfx' ? 'That file has graphics settings: load it under Graphics' : 'That file has the other settings: load it under General', 'warn'); return; } setApply(k, j.settings); toast('Settings loaded from the file', 'ok'); rerenderSettingsBody(); })
    .catch(() => toast('That file is not a settings file from the game', 'warn'));
});
