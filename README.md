# Airline Manager Pro – Babylon.js edition

A separate edition of Airline Manager Pro on the Babylon.js engine, for Android and the PC. It installs beside the
main game and doesn't touch it.

Today it has two places, as demonstrations: the start screen (the same film and music as the main game), then the
3D viewer (an airliner at flight level 300 above volumetric clouds, with the sun, moon and real stars) or the
Business lounge. The gear in the corner is always there, with the graphics and controls settings. Walk with the
touchscreen, the keyboard and mouse, or a PlayStation controller (or any game controller).

- `Airline-Manager-Pro-Babylon/` – the app: `src/` (TypeScript), `www/` (the page, styles, pictures, music),
  `scripts/` (the build and the Android project), `pc/` (the Windows app), `release-notes/`.
- Every push to `main` builds the Android APK and the PC app and publishes them as a pre-release.

Babylon.js is under the Apache License 2.0, Electron under the MIT License, Capacitor under the MIT License.
