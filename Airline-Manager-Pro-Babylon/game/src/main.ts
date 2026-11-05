// Start-up: theme, landscape lock, shell and a short arrival message from the mechanic.
(function boot() {
  document.title = APP.name;
  ErrorLog.init();
  try { FlightTrace.init(); } catch (e) { /* the trace is optional */ }
  Store.load();
  Store.restoreIfEmpty();
  if (DESKTOP) { Desk.init(); SETTINGS.unshift({ id: 'display', title: 'Display', icon: 'pc', items: [{ type: 'html', html: desktopSettingsHtml }] } as any); }
  setTimeout(() => { try { boosterSync(); } catch (e) { /* the device keeps its own settings */ } }, 1500);
  setTimeout(() => { try { padStart(); } catch (e) { /* no controllers here */ } }, 600);   // game controllers (ui/gamepad.ts)   // the device's own full screen and boost settings, as chosen here
  loadKnownAirports();
  World.load();
  World.loadRunways();   // runways in use, for departures and approaches
  ensurePeople();
  ensurePayroll();
  try { payRebase(); } catch (e) { /* ignore */ }
  try { groundMigrate(); } catch (e) { /* ignore */ }
  try { InstalledAircraft.restore(); Ratings.grandfather(); } catch (e) { /* ignore */ }
  Store.bind();
  if (reducedMotion()) State.settings.reduceMotion = true;
  document.documentElement.classList.toggle('calm', State.settings.reduceMotion);
  applyCompanyTheme(false);
  try {
    const so = (window as any).Capacitor && (window as any).Capacitor.Plugins && (window as any).Capacitor.Plugins.ScreenOrientation;
    if (so) so.lock({ orientation: 'landscape' });
  } catch (e) { /* not available in a browser */ }
  // split screen or a pop-up window: the app shares the screen, so any shape is fine (the landscape
  // lock and the "turn sideways" hint only apply when it has the whole screen)
  const splitCheck = () => { const sw = screen.width || innerWidth, sh = screen.height || innerHeight; document.documentElement.classList.toggle('split', innerWidth * innerHeight < sw * sh * 0.8); };
  splitCheck(); window.addEventListener('resize', splitCheck);
  bindActions();
  bindBack();
  // Used in the last 12 hours (minimised, swiped away, exited, or closed by Android to free memory):
  // after the start-up screen, back right where it was. After a longer break: the Overview.
  let resume: any = null;
  try { resume = JSON.parse(localStorage.getItem('amp-resume') || 'null'); localStorage.removeItem('amp-resume'); } catch (e) { /* none */ }
  // quit last time (Quit, not just put away): start afresh at the Overview, after the start screen
  let quitLast = false; try { quitLast = !!localStorage.getItem('amp-quit'); localStorage.removeItem('amp-quit'); } catch (e) { /* none */ }
  if (quitLast) resume = null;
  if (resume && Date.now() - resume.at > 12 * 3600e3 && (State.settings as any).rememberUi === false) resume = null;
  let _ui: any = null; try { _ui = quitLast ? null : uiMemRestore(); } catch (e) { /* ignore */ }
  if (!resume && _ui && SCREENS[_ui.screen]) resume = { screen: _ui.screen };
  const back = resume && SCREENS[resume.screen] ? resume.screen : null;
  State.screen = back || 'ops';
  renderShell();
  try { if (_ui && _ui.scroll && _ui.screen === State.screen) setTimeout(() => { const v = $('#view'); if (v) v.scrollTop = _ui.scroll; }, 60); } catch (e) { /* ignore */ }
  if (!Store.wasEmpty) setTimeout(() => titleDefer(checkBirthday), SPLASH_MS + 400);   // after the start-up screen (not over the first-start choice)
  scheduleBirthdayNotification();
  // the airline's clocks: paused while another of your devices runs the airline (Settings → Sync)
  syncGated(() => {
  startConductClock();
  startCourtClock();
  startStaffing();
  try { startThanks(); } catch (e) { /* ignore */ }
  startProgress();
  startConditionClock();
  startAiClock();
  try { modeStart(); } catch (e) { /* ignore */ }
  try { startNewsWatch(); startWarnClock(); } catch (e) { /* ignore */ }
  try { applyDifficultyPrices(); startMarkets(); } catch (e) { /* ignore */ }
  try { startVa(); } catch (e) { /* ignore */ }
  try { startBiz(); } catch (e) { /* ignore */ }
  });
  Link.init();
  setTimeout(() => { try { alertsStart(); } catch (e) { /* no alerts */ } }, 2500);
  try { procPrefetchStart(); } catch (e) { /* procedures are fetched as needed */ }
  Updater.init();
  Backup.init();
  Licence.init().then(() => { try { CloudSync.init(); } catch (e) { /* sync stays off */ } });
  try { startQol(); } catch (e) { /* ignore */ }
  try { v3dCrashCheck(); } catch (e) { /* ignore */ }
  startCoopClock();
  startBases();
  Battery.init();
  try { startVoices(); } catch (e) { /* ignore */ }
  try { Jobs.advance(true); Ratings.advance(); Network.start(); Acars.start(); } catch (e) { /* ignore */ }
  Backup.offerRestoreOnFirstStart();
  whatsNewOnStart();
  if ((State as any).linkedOnce) State.live = State.live.filter(f => !(f.you && !f.real));
  // Start-up screen for five seconds, then the Overview
  // the voices download on the start-up screen the first time, also when the app reopens where it was
  // the start-up screen on every start: at least five seconds, longer while files download; afterwards the
  // Overview, or (opened again within 12 hours) right where it was
  // then the start screen (unless a new game or a loaded save is on its way in)
  if (!back) showSplash(() => { if (State.screen !== 'ops' && !_layers.length) go('ops', true); titleAfterSplash(); });
  else showSplash(() => { titleAfterSplash(); });
})();
