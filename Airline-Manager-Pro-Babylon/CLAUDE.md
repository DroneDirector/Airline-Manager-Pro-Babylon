# Airport Dynasty Pro – Babylon.js edition: project rules

- A separate edition of the game on Babylon.js, in its own repository. It never changes the main game
  (DroneDirector/Microsoft-Flight-Simulator-Projects).
- Sign every commit as `DroneDirector <simon@dronedirector.fo>`, with no co-author or session lines.
- Never mention in code, comments, text or commits that anything is made with AI.
- Licences of anything used must allow commercial sale in a paid game, asking at most for credit (and the licence text). Never non-commercial, share-alike on the game, or paid-only terms. Our own models, pictures and sounds only. List every third-party part in THIRD-PARTY-NOTICES.md and keep it up to date.
- Always build and release the Android app and the PC app together; `versionCode` in `app.config.json` goes up with
  every release, and updates install over the old version (the fixed test key in `signing/`).
- Merging to `main` releases (the workflow builds both and publishes a pre-release with `release-notes/<version>.md`).
- Show progress as percentages (building and publishing), about every 10%.
- Don't run tests or check that things work unless the owner asks: build what is needed and release.
- Don't make or share screenshots unless asked.
- The game is added part by part as sections (`src/core/sections.ts`): each place registers itself (id, title, open,
  close, onSettings) and is opened from `src/main.ts`. Today: the 3D viewer (a demo flight above the clouds) and the lounge (its doors stay shut),
  each with its own button on the start screen.
- In every place: the gear, Exit and Title screen (back to the start screen) are always on screen.
- The title screen: Continue game, New game, Load game, Save game and UI open the game's interface; the demos (3D
  viewer, Lounge) below them. UI stays as the shortcut into the interface while it fills with functions.
- `game/` is the airline game's whole interface (brought over from the main game: the Overview, crew, fleet and every
  menu and screen, with all their functions), built by `npm run build` into `www/game` and opened over the screen
  (`src/ui/game-frame.ts`). `game/src/ui/embed.ts` connects it: no title of its own, Back to the title screen and Quit
  come to the edition, its 3D places say they are coming to the Babylon.js edition until each is rebuilt here as a
  section (then its entry in `embed.ts` opens the section instead), and the 3D view of a flight opens the 3D viewer.
  There is no other 3D library in it. Whenever a part is built here, update the interface so it opens it.
- The joined building (`src/sections/building`): your office and the Operations office off the staff corridor, the
  concourse and the Business lounge, each room by its own builder. My office, Operations, Lounges and Airport (in the
  game's menu) open it where they say; arriving is always onto open floor (freeNear).
- The gear is always on screen; its settings: Graphics, Controls, Updates (check, see what the new version holds,
  install it from inside the game on Android and the PC) and What's new (the three newest release notes, built in from
  `release-notes/`; also shown once as a pop-up after an update).
- Controls from day one: touchscreen (stick and look), keyboard and mouse, PlayStation (and other) controllers, with
  their settings under Controls.
- Exit (beside the gear) shuts the game down completely and gives back all its memory (the scene and engine released,
  then the process ends on Android and the program quits on the PC).
- When the airline itself is brought over (your crew, the aircraft, the other airlines and everything the game tracks),
  that tracking keeps going while the game is closed: what happened while it was shut is worked out (and on Android
  kept up in the background), as in the main game. The 3D places themselves never run while closed.
