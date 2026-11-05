# Airline Manager Pro – Babylon.js edition: project rules

- A separate edition of the game on Babylon.js, in its own repository. It never changes the main game
  (DroneDirector/Microsoft-Flight-Simulator-Projects).
- Sign every commit as `DroneDirector <simon@dronedirector.fo>`, with no co-author or session lines.
- Never mention in code, comments, text or commits that anything is made with AI.
- Licences of anything used must allow commercial sale. Our own models, pictures and sounds only.
- Always build and release the Android app and the PC app together; `versionCode` in `app.config.json` goes up with
  every release, and updates install over the old version (the fixed test key in `signing/`).
- Merging to `main` releases (the workflow builds both and publishes a pre-release with `release-notes/<version>.md`).
- Show progress as percentages (building and publishing), about every 10%.
- Don't run tests or check that things work unless the owner asks: build what is needed and release.
- Don't make or share screenshots unless asked.
- The game is added part by part as sections (`src/core/sections.ts`): each place registers itself (id, title, open,
  close, onSettings) and is opened from `src/main.ts`. Today: the lounge only (its doors stay shut).
- The gear is always on screen; its settings are graphics and controls only, until more is brought over.
- Controls from day one: touchscreen (stick and look), keyboard and mouse, PlayStation (and other) controllers, with
  their settings under Controls.
- Exit (beside the gear) shuts the game down completely and gives back all its memory (the scene and engine released,
  then the process ends on Android and the program quits on the PC).
- When the airline itself is brought over (your crew, the aircraft, the other airlines and everything the game tracks),
  that tracking keeps going while the game is closed: what happened while it was shut is worked out (and on Android
  kept up in the background), as in the main game. The 3D places themselves never run while closed.
