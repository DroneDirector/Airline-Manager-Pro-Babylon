# Next steps (on hold)

- Never add far-object impostors (stand-in pictures for far objects): the owner does not want them.

- Airport layouts: the scheduled check of the layout build is paused. When the build has answered (nearly) every airport, cherry-pick the `layouts-wip` branch (the game reading the built-in layouts, the build step) onto main, keeping the WebGPU and KTX2 steps in `build.yml`.
- Draw calls per pass (main view, shadows, glow): measure, to see where the rest of the draw calls go.
- Thin instances: if draw calls matter more than processor time on a device, try larger areas than 150 m.
- Before 1.0: remove the "Animate jetways (test)" button; permissions from VATSIM, IVAO, SimBrief and Hoppie.

- Airport layouts (OpenStreetMap): build them with instancing from the start (runway and taxiway lights, stand markings, signs and repeated buildings as thin instances).
- Animated people and animals in groups: baked-animation instancing (each walks its own path); one taken out of the group for a special moment (a chase, an arrest, a bird strike).

## At alpha
- Set DEMO_DATA to false in src/sections/terminal/fids.ts: no dummy or demo data anywhere from alpha on.
