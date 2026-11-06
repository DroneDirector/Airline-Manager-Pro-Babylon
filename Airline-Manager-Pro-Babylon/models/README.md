# Replaceable parts

Any part listed here can be swapped for your own model or picture. Put the file in this folder, named after the
slot (for example `jetway.wheel.glb`), and build. On every start the game loads it onto every part of that slot,
checks it, and writes what it did to **Settings → Updates and errors**. It also tells you on screen. Problems
(wrong size, origin in the wrong place, sliding the wrong way, a file that won't load) appear there each time, with
what the slot expects.

The animation is never in the model. The game moves the slot's node (the wheels turn and steer, the lift columns
slide, the canopy folds), so a new model moves exactly like the one it replaces, as long as it follows the rules
below.

## Models (`.glb`, glTF 2.0 binary)

- Units: metres. Up: +Y. Forward: +Z (Blender's glTF export does this for you with "+Y up").
- Origin: as the slot says. **base** means the middle of the model's underside. **centre** means its middle.
- Size: within half to double the slot's size (width × height × depth), or it is reported.
- One model can hold several meshes and materials. Textures inside the `.glb` are used as they are.
- Only use models you made yourself or have a licence for that allows commercial sale.

| Slot (file name)                  | Part                              | Size w × h × d (m)  | Origin | Moves                      |
|-----------------------------------|-----------------------------------|---------------------|--------|----------------------------|
| `jetway.wheel.glb`                | one drive wheel (tyre and hub)    | 0.45 × 1.1 × 1.1    | centre | rolls about X; steers      |
| `jetway.bogie.glb`                | the bogie frame between the wheels| 2.6 × 0.9 × 1.3     | base   | steers about Y             |
| `jetway.lift-column-outer.glb`    | one outer lift column             | 0.34 × 2.2 × 0.34   | base   | fixed on the drive unit    |
| `jetway.lift-column-inner.glb`    | one inner lift column             | 0.24 × (fits) × 0.24| base   | slides up and down in Y    |
| `jetway.cab-front.glb`            | the cab's front (floor, roof, sides, windows) | 1.7 × 2.8 × 3.7 | base | turns with the cab |
| `jetway.cab-console.glb`          | the operator's console            | 0.8 × 1.1 × 0.6     | base   | turns with the cab         |
| `jetway.canopy.glb`               | the canopy (folding hood, bumper) | 0.6 × 2.9 × 3.8     | base   | pushes out along −X        |
| `jetway.rotunda-drum.glb`         | the rotunda's fixed round wall    | 3.7 × 2.7 × 3.7     | base   | never                      |
| `jetway.rotunda-machinery.glb`    | the machinery on the rotunda roof | 1.6 × 0.8 × 1.2     | base   | never                      |
| `jetway.service-stair.glb`        | the service stair                 | 1.2 × 1.2 × 7.2     | top end| tilts with the jetway's height |
| `jetway.beacon.glb`               | the amber beacon on the cab roof  | 0.2 × 0.25 × 0.2    | base   | flashes (the game's light) |
| `jetway.fire-extinguisher.glb`    | the fire extinguisher in its cabinet | 0.2 × 0.6 × 0.2  | base   | never; the wall is behind it (−Z) |

## Pictures (`.png` or `.jpg`)

One picture covers one metre square of the part and repeats. Make it seamless, so the edges join. 1024 × 1024 is
plenty. Your own photo works well, for example a real jetway floor shot straight down in flat light.

| Slot (file name)          | What it covers                                   |
|---------------------------|--------------------------------------------------|
| `jetway.floor.png`        | the studded rubber floor in corridor, rotunda, tunnel and cab |
| `jetway.bellows.png`      | the bellows (one picture per fold, along and round) |
| `jetway.cladding.png`     | the aluminium cladding outside (two metres per picture) |
| `jetway.ceiling.png`      | the white ceiling panels                         |

## Pictures or videos for the advertising panels (`.png`, `.jpg`, `.mp4` or `.webm`)

The backlit advertising panels inside the jetways show your own picture or video. The panel is 0.8 × 1.6 m, portrait,
**1 : 2** (for example 1080 × 2160 pixels). Other shapes fill the panel too: they're cropped to fit, never stretched.
A video plays muted and loops. The panels keep their soft glow.

| Slot (file name)          | Where                                                    |
|---------------------------|----------------------------------------------------------|
| `jetway.ad-1.*`           | the panel in each fixed corridor, by the gate            |
| `jetway.ad-2.*`           | the panel in each jetway's tunnel                        |
| `jetway.ad.*`             | both panels, when there's no file for one of them above  |
