# Next steps (on hold)

- Never add far-object impostors (stand-in pictures for far objects): the owner does not want them.

- Airport layouts: the scheduled check of the layout build is paused. When the build has answered (nearly) every airport, cherry-pick the `layouts-wip` branch (the game reading the built-in layouts, the build step) onto main, keeping the WebGPU and KTX2 steps in `build.yml`.
- Draw calls per pass (main view, shadows, glow): measure, to see where the rest of the draw calls go.
- Thin instances: if draw calls matter more than processor time on a device, try larger areas than 150 m.
- Before 1.0: remove the "Animate jetways (test)" button; permissions from VATSIM, IVAO, SimBrief and Hoppie.
