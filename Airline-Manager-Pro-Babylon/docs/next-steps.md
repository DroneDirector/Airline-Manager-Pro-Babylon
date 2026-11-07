# Next steps (on hold)

- Far-object impostors (`src/core/impostor.ts`): built, not switched on. Check on screen that the stand-ins face the right way, then call it from the airport (after the octree) with the setting `gfx.impostors`, and add its settings row.
- Airport layouts: the scheduled check of the layout build is paused. When the build has answered (nearly) every airport, cherry-pick the `layouts-wip` branch (the game reading the built-in layouts, the build step) onto main, keeping the WebGPU and KTX2 steps in `build.yml`.
- Draw calls per pass (main view, shadows, glow): measure, to see where the rest of the draw calls go.
- Thin instances: if draw calls matter more than processor time on a device, try larger areas than 150 m.
- Before 1.0: remove the "Animate jetways (test)" button; permissions from VATSIM, IVAO, SimBrief and Hoppie.
