# Third-party parts and their licences

Rule: everything in the game must allow a commercial, paid game. At most, a licence may ask for credit (and for its licence text to be shipped). Anything that needs more than that (non-commercial only, share-alike on the game, paid use, permission) is marked below and must be fixed or cleared before 1.0.

## Code shipped in the game
| Part | Licence | Commercial | What it asks |
|---|---|---|---|
| Babylon.js core and loaders 9.30.0 (3D engine, including every graphics feature: sky shadows, clustered lights, light rays, reflections, TAA, motion blur, depth of field, lens flares) | Apache-2.0 | Yes | Credit; ship the licence text |
| Capacitor 7 (Android shell) | MIT | Yes | Credit; ship the licence text |
| MapLibre GL JS 5 (world map) | BSD-3-Clause | Yes | Credit; ship the licence text |
| ONNX Runtime Web 1.20.1 (voices) | MIT | Yes | Credit; ship the licence text |
| glslang (Khronos; WebGPU shader translation, PC only) | BSD-3-Clause / Apache-2.0 (Khronos glslang licence) | Yes | Credit; ship the licence text |
| Tint, as twgsl (Google / Babylon.js; WebGPU shader translation, PC only) | Apache-2.0 | Yes | Credit; ship the licence text |
| Basis Universal transcoders (Binomial; KTX2 compressed textures, through the Babylon.js KTX2 decoder) | Apache-2.0 | Yes | Credit; ship the licence text |
| Zstandard decoder (Meta; unpacks the compressed textures) | BSD-3-Clause | Yes | Credit; keep the copyright notice |
| Basis Universal encoder (Binomial; used once to make the .ktx2 copies of our own textures, not shipped) | Apache-2.0 | Yes | None for its output |
| Kokoro v1.0 voice model, kokoro-onnx, misaki (character voices) | Apache-2.0 / MIT | Yes | Credit; licence texts are already in the voice pack |

## Fonts
| Font | Licence | Commercial |
|---|---|---|
| Inter, Inter Display | SIL OFL 1.1 | Yes (credit and licence text) |
| Audiowide | SIL OFL 1.1 | Yes (credit and licence text) |
| Yellowtail | Apache-2.0 | Yes (credit and licence text) |

## Our own (no third-party licence)
- Every model, procedural texture and shader in the game (jetways, terminal, airfield, puddles, wet ground, skid marks).
- The runway skid-mark picture (www/assets/textures/runway-skid.webp, made by our own script).
- The pictures and music supplied by the owner: start screen, jetway bellows rubber, tread, rotunda cladding.

## Online data the game loads
| Source | Licence / terms | Commercial | What it asks |
|---|---|---|---|
| Sentinel-2 cloudless 2016 by EOX (satellite imagery; layer s2cloudless_3857 only) | CC BY 4.0 | Yes | Credit: "Sentinel-2 cloudless by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2016)". Do NOT switch to the 2018 to 2025 layers: they are non-commercial (CC BY-NC-SA). |
| Terrain Tiles on AWS (Mapzen/Tilezen; elevation) | Open data, attribution required | Yes | Credit per tilezen/joerd docs/attribution.md (3DEP/USGS, SRTM, GMTED, ETOPO1, and others) |
| OpenFreeMap vector tiles (world map) | Free incl. commercial; OSM data ODbL | Yes | Credit: OpenFreeMap, OpenMapTiles, OpenStreetMap contributors |
| NASA GIBS (cloud imagery) | No restrictions | Yes | Credit to NASA EOSDIS GIBS (requested) |
| aviationweather.gov, FAA, NOAA SWPC | US government public domain | Yes | None (credit is courteous) |
| **Overpass API public servers (airport layouts from OpenStreetMap)** | OSM data ODbL; the public servers' usage policy says commercial use should use self-hosted or paid servers | **Not cleared** | **Fix before 1.0:** ship the layouts pre-built in the game, or use a paid or self-hosted Overpass server. OSM credit is always needed. |
| **VATSIM, IVAO, SimBrief, Hoppie** | Their own terms | **Needs permission** | Ask each one before 1.0 |
| MapTiler (only if the player enters their own key) | The player's own MapTiler plan | The player's responsibility | None for us |

## Still to do
- An in-game Credits screen listing everything above, with the licence texts shipped beside the game.
