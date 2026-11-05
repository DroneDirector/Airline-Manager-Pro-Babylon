# Replaceable models

Put a `.glb` file (glTF binary) with one of these names in this folder, in the sub-folder shown, and build the app.
The app then uses it instead of its own model everywhere that model appears: the 3D view, the pictures, the
water salute, the museum. Remove the file and the app's own model comes back. This list is written by the build.

**How the files should be made**

- glTF 2.0 binary (`.glb`), textures inside the file. Metres. **+Y up, the front (the nose) towards +Z** (glTF's own convention).
- The app fits each model to the real size of the thing it replaces (length), sets it on the ground and centres it across, so small differences in scale or origin do not matter.
- Aircraft: the app's own model still moves its gear, flaps and lights; a file's model is shown as it is (its own paint).
- Licences of bought models must allow commercial sale (see CLAUDE.md).

## Aircraft (`aircraft/`)

| File | Aircraft |
|---|---|
| `aircraft/airbus-a320.glb` | Airbus A320 |
| `aircraft/airbus-a320neo.glb` | Airbus A320neo |
| `aircraft/airbus-a319neo.glb` | Airbus A319neo |
| `aircraft/airbus-a321.glb` | Airbus A321 |
| `aircraft/airbus-a321neo.glb` | Airbus A321neo |
| `aircraft/airbus-a321lr-neo.glb` | Airbus A321LR neo |
| `aircraft/airbus-a321xlr-neo.glb` | Airbus A321XLR neo |
| `aircraft/airbus-a330-800neo.glb` | Airbus A330-800neo |
| `aircraft/airbus-a330-900neo.glb` | Airbus A330-900neo |
| `aircraft/airbus-a350-900.glb` | Airbus A350-900 |
| `aircraft/airbus-a310-300.glb` | Airbus A310-300 |
| `aircraft/boeing-737-800.glb` | Boeing 737-800 |
| `aircraft/boeing-737-600.glb` | Boeing 737-600 |
| `aircraft/boeing-777-300er.glb` | Boeing 777-300ER |
| `aircraft/boeing-787-10.glb` | Boeing 787-10 |
| `aircraft/boeing-747-8.glb` | Boeing 747-8 |
| `aircraft/boeing-737-max-7.glb` | Boeing 737 MAX 7 |
| `aircraft/boeing-737-max-8.glb` | Boeing 737 MAX 8 |
| `aircraft/boeing-737-max-9.glb` | Boeing 737 MAX 9 |
| `aircraft/boeing-737-max-10.glb` | Boeing 737 MAX 10 |
| `aircraft/boeing-787-8.glb` | Boeing 787-8 |
| `aircraft/boeing-787-9.glb` | Boeing 787-9 |
| `aircraft/boeing-777-9.glb` | Boeing 777-9 |
| `aircraft/bombardier-crj900.glb` | Bombardier CRJ900 |
| `aircraft/bombardier-crj700.glb` | Bombardier CRJ700 |
| `aircraft/atr-72-600.glb` | ATR ATR 72-600 |
| `aircraft/de-havilland-canada-dhc-6-twin-otter.glb` | de Havilland Canada DHC-6 Twin Otter |
| `aircraft/de-havilland-canada-dhc-2-beaver.glb` | de Havilland Canada DHC-2 Beaver |
| `aircraft/cessna-208b-grand-caravan.glb` | Cessna 208B Grand Caravan |
| `aircraft/daher-kodiak-100.glb` | Daher Kodiak 100 |
| `aircraft/pilatus-pc-12.glb` | Pilatus PC-12 |
| `aircraft/cessna-172-skyhawk.glb` | Cessna 172 Skyhawk |

## Helicopters (`helicopters/`)

Each helicopter type, named so it is clear it is a helicopter and which one. Metres, +Y up, the nose towards +Z; the
rotor is shown as it is in the file (the app's own model turns its rotors).

| File | Helicopter |
|---|---|
| `helicopters/helicopter-airbus-h125.glb` | Airbus Helicopters H125 |
| `helicopters/helicopter-airbus-h130.glb` | Airbus Helicopters H130 |
| `helicopters/helicopter-airbus-h135.glb` | Airbus Helicopters H135 |
| `helicopters/helicopter-airbus-h145.glb` | Airbus Helicopters H145 |
| `helicopters/helicopter-airbus-h160.glb` | Airbus Helicopters H160 |
| `helicopters/helicopter-airbus-h175.glb` | Airbus Helicopters H175 |
| `helicopters/helicopter-bell-407gxi.glb` | Bell 407GXi |
| `helicopters/helicopter-bell-429.glb` | Bell 429 |
| `helicopters/helicopter-bell-505.glb` | Bell 505 |
| `helicopters/helicopter-bell-525-relentless.glb` | Bell 525 Relentless |
| `helicopters/helicopter-leonardo-aw109-trekker.glb` | Leonardo AW109 Trekker |
| `helicopters/helicopter-leonardo-aw139.glb` | Leonardo AW139 |
| `helicopters/helicopter-leonardo-aw169.glb` | Leonardo AW169 |
| `helicopters/helicopter-leonardo-aw189.glb` | Leonardo AW189 |
| `helicopters/helicopter-sikorsky-s-76d.glb` | Sikorsky S-76D |
| `helicopters/helicopter-sikorsky-s-92a.glb` | Sikorsky S-92A |

## Ground vehicles (`vehicles/`)

| File | Vehicle |
|---|---|
| `vehicles/fire-truck.glb` | Airport fire truck (the water salute) |
| `vehicles/fuel-truck.glb` | Fuel truck |
| `vehicles/catering-truck.glb` | Catering truck (scissor lift) |
| `vehicles/belt-loader.glb` | Baggage belt loader |
| `vehicles/baggage-tractor.glb` | Baggage tractor |
| `vehicles/baggage-cart.glb` | Baggage cart |
| `vehicles/pushback-tug.glb` | Push-back tug |
| `vehicles/passenger-stairs.glb` | Passenger stairs truck |
| `vehicles/passenger-bus.glb` | Apron passenger bus |
| `vehicles/de-icing-truck.glb` | De-icing truck |
| `vehicles/ground-power-unit.glb` | Ground power unit |
| `vehicles/lavatory-truck.glb` | Lavatory service truck |
| `vehicles/water-truck.glb` | Potable water truck |

## Jet bridges (`jetways/`)

| File | What |
|---|---|
| `jetways/jet-bridge.glb` | Jet bridge (passenger boarding bridge) |

## Hangars (`hangars/`)

The hangar building for each size: walls, roof, columns, windows and the doors (the floor, the rooms along the back wall,
the aircraft, the people and the equipment stay the app's own). Metres, the doors towards +Z, the floor at 0, centred.
It is fitted to the size shown. Meshes named `window`, `glass` or `skylight` show the sky at the base (day, sunrise,
sunset, night). For the PC only, a file with `-pc` at the end (e.g. `hangars/hangar-large-pc.glb`) is used first, so
a heavier, higher-quality building can go to the PC while phones keep the lighter one.

| File | Size |
|---|---|
| `hangars/hangar-small.glb` | Small hangar: 36 × 42 m, 13 m high, doors 10.5 m (turboprops, business and small jets) |
| `hangars/hangar-small-pc.glb` | The same, PC only |
| `hangars/hangar-medium.glb` | Medium hangar: 52 × 66 m, 18 m high, doors 15 m (A320, 737, regional jets) |
| `hangars/hangar-medium-pc.glb` | The same, PC only |
| `hangars/hangar-large.glb` | Large hangar: 82 × 94 m, 25 m high, doors 21.5 m (767, 787, A330, A350, 777) |
| `hangars/hangar-large-pc.glb` | The same, PC only |
| `hangars/hangar-very-large.glb` | Very large hangar: 96 × 100 m, 30 m high, doors 26.5 m (747, 777-9, A380) |
| `hangars/hangar-very-large-pc.glb` | The same, PC only |

## Furniture and fittings used in several rooms (`props/`)

Plants, sofas, armchairs, the coffee machine, the doors and the room signs, in the lounges, your office, the Operations
office and the hangars. Where there are several kinds they are numbered (`plant-1`, `plant-2`…); one file stands for
every one of that kind. Metres, front towards +Z (where you sit or the side you face it from), standing on the floor,
centred; fitted to the size of the app's own. Doors: `door-1` is one leaf with its hinge on the left edge; `door-2` one
sliding glass leaf (two are used). The room sign's name and pictogram stay the app's own, drawn in front of the file's frame.

| File | What |
|---|---|
| `props/plant-1.glb` | Potted plant 1: fiddle-leaf fig in a glazed ceramic pot (about 1.6 m) |
| `props/plant-2.glb` | Potted plant 2: kentia palm in a tall square planter (about 1.9 m) |
| `props/plant-3.glb` | Potted plant 3: snake plant in a low concrete bowl (about 0.9 m) |
| `props/sofa-1.glb` | Sofa 1: fabric, soft rounded cushions, tapered oak legs (Lounge) |
| `props/sofa-2.glb` | Sofa 2: leather, buttoned back, chrome sled legs (Business lounge, your office) |
| `props/sofa-3.glb` | Sofa 3: velvet Chesterfield, rolled arms, gold legs (Flagship lounge) |
| `props/armchair-1.glb` | Armchair 1: fabric, to match sofa 1 |
| `props/armchair-2.glb` | Armchair 2: leather, to match sofa 2 |
| `props/armchair-3.glb` | Armchair 3: velvet, to match sofa 3 |
| `props/coffee-machine-1.glb` | Coffee machine 1: bean-to-cup with a touchscreen, two bean hoppers, a drip tray (lounges, the hangar break room) |
| `props/door-1.glb` | Door 1: painted steel door leaf with a narrow glass panel, lever handles and kick plates (hangar rooms). Hinge on its left edge (x = 0), the leaf along +X; it turns about the hinge |
| `props/door-2.glb` | Door 2: one leaf of the automatic sliding glass doors (lounge entrance); two are used, one sliding each way |
| `props/room-sign.glb` | Room sign by a door: the frame only (the name, number and pictogram are drawn by the app on a panel in front) |

## Hangar equipment and furniture (`hangar-props/`)

One file for each kind: every one of that kind in the hangars uses it. Metres, front towards +Z (the side you face it
from: a chair's front is where you sit, a desk's where you work), standing on the floor. It is fitted to the size of the
app's own. Tables, counters and trolleys keep working as places to put things down. The tug by the doors is the apron's
own (`vehicles/pushback-tug.glb`).

| File | What |
|---|---|
| `hangar-props/tool-trolley.glb` | Red rolling tool chest (tools on top) |
| `hangar-props/work-stand.glb` | Yellow work platform with steps (at the engine) |
| `hangar-props/traffic-cone.glb` | Traffic cone on its base |
| `hangar-props/workbench.glb` | Workbench with pegboard and vice (along the back wall) |
| `hangar-props/fire-extinguisher.glb` | Fire extinguisher on its stand |
| `hangar-props/waste-bin.glb` | Waste bin (hangar, office, break room) |
| `hangar-props/office-desk.glb` | Work table in the maintenance office (the monitor, keyboard and mouse stand on it) |
| `hangar-props/office-chair.glb` | Office chair |
| `hangar-props/keyboard.glb` | Computer keyboard |
| `hangar-props/computer-mouse.glb` | Computer mouse |
| `hangar-props/bookshelf.glb` | Shelf of manuals |
| `hangar-props/kitchen-counter.glb` | Break room counter with cupboards |
| `hangar-props/sink.glb` | Sink and tap |
| `hangar-props/coffee-mug.glb` | Coffee mug |
| `hangar-props/drinking-glass.glb` | Drinking glass |
| `hangar-props/break-room-table.glb` | Break room table |
| `hangar-props/break-room-chair.glb` | Break room chair |

## Lounge furniture and equipment (`lounge-props/`)

One file for each kind, used for every one of that kind in your lounges. Where the levels differ (Lounge, Business
lounge, Flagship lounge) each level has its own file: the carpets, armchairs, sofas and coffee tables. Metres, front
towards +Z (where you sit or stand to use it), standing on the floor; fitted to the size of the app's own.

| File | What |
|---|---|
| `lounge-props/carpet-lounge.glb` | Carpet, Lounge |
| `lounge-props/carpet-business.glb` | Carpet, Business lounge |
| `lounge-props/carpet-flagship.glb` | Carpet, Flagship lounge (the finest) |
| `lounge-props/coffee-table-oak.glb` | Coffee table, oak |
| `lounge-props/coffee-table-walnut.glb` | Coffee table, walnut |
| `lounge-props/coffee-table-marble.glb` | Coffee table, marble and gold |
| `lounge-props/floor-lamp.glb` | Floor lamp |
| `lounge-props/magazine-rack.glb` | Magazine rack |
| `lounge-props/reception-desk.glb` | Reception desk |
| `lounge-props/buffet-counter.glb` | Refreshment counter |
| `lounge-props/tea-urn.glb` | Tea urn (samovar) |
| `lounge-props/teapot.glb` | Teapot |
| `lounge-props/coffee-cup-and-saucer.glb` | Coffee cup and saucer |
| `lounge-props/teacup-and-saucer.glb` | Teacup and saucer |
| `lounge-props/napkin-stack.glb` | Napkins |
| `lounge-props/fruit-bowl.glb` | Fruit bowl |
| `lounge-props/drinks-fridge.glb` | Glass-fronted fridge (the drinks and snacks in it are the items/ files) |
| `lounge-props/bar-counter.glb` | Bar counter, L-shaped, black lacquer and brass (Business and Flagship) |
| `lounge-props/bar-stool.glb` | Bar stool (brass legs, black seat) |
| `lounge-props/bottle-shelf.glb` | Glass shelves of bottles behind the bar |
| `lounge-props/bar-mirror.glb` | Mirrored back wall behind the bar, in a brass frame |
| `lounge-props/bar-pendant-globe.glb` | Globe pendant light over the bar |
| `lounge-props/ceiling-copper-waves.glb` | Lounge ceiling: copper waves with warm hidden light (every level) |
| `lounge-props/welcome-mat.glb` | Welcome mat inside the lounge doors (where you arrive) |
| `lounge-props/painting-aurora.glb` | Painting: northern lights over the hills (west wall) |
| `lounge-props/painting-dusk.glb` | Painting: an aircraft climbing into the dusk (east wall) |
| `lounge-props/painting-gold.glb` | Painting: arcs of gold (beside the bar) |
| `lounge-props/painting-storm.glb` | Painting: a storm over the sea, a lit harbour (over the refreshment corner) |
| `lounge-props/mixing-station.glb` | Mixing station on the bar: shaker, jigger, bar spoon, strainer, muddler, garnish tray |
| `lounge-props/pendant-light.glb` | Pendant light (Business) |
| `lounge-props/chandelier.glb` | Chandelier (Flagship) |
| `lounge-props/fireplace.glb` | Fireplace, art deco brass on black lacquer (Business and Flagship; the fire is drawn by the app) |
| `lounge-props/grand-piano.glb` | Grand piano (Flagship) |
| `lounge-props/wall-art.glb` | Framed art: a model of your own here hangs on both side walls instead of the two paintings there |
| `lounge-props/champagne-bucket.glb` | Champagne bucket (Flagship) |
| `lounge-props/departures-screen.glb` | Departures screen frame (the list is drawn by the app; also hanging in the concourse) |
| `lounge-props/arrivals-screen.glb` | Arrivals screen frame (beside the departures screen) |
| `lounge-props/glass-rack.glb` | Glass rack hanging from the ceiling over the bar (the glasses are their own files) |
| `lounge-props/bottle-red.glb` | Bottle of red wine (the bartender takes it from the shelf and pours) |
| `lounge-props/bottle-white.glb` | Bottle of white wine |
| `lounge-props/bottle-champagne.glb` | Bottle of champagne |
| `lounge-props/bottle-whisky.glb` | Bottle of single malt whisky |
| `lounge-props/bottle-gin.glb` | Bottle of gin |
| `lounge-props/bottle-vodka.glb` | Bottle of vodka |
| `lounge-props/bottle-aquavit.glb` | Bottle of aquavit |
| `lounge-props/bottle-rum.glb` | Bottle of dark rum |
| `lounge-props/bottle-cognac.glb` | Bottle of cognac |
| `lounge-props/bottle-port.glb` | Bottle of port |
| `lounge-props/bottle-amaretto.glb` | Bottle of amaretto |
| `lounge-props/glass-wine.glb` | Wine glass (hung upside down on the rack; the app pours the drink in it) |
| `lounge-props/glass-flute.glb` | Champagne flute |
| `lounge-props/glass-tumbler.glb` | Tumbler (whisky, gin, rum, amaretto) |
| `lounge-props/glass-snifter.glb` | Brandy snifter (cognac) |
| `lounge-props/glass-shot.glb` | Shot glass (vodka, aquavit) |
| `lounge-props/glass-small.glb` | Small wine glass (port) |

## Training room (`training-props/`)

One file for each kind of thing in the Training room (the Academy), used for every one of that kind. Metres, front
towards +Z (the side you sit at or look at), standing on the floor (or the desk); fitted to the size of the app's own.
The plants are the shared ones (`props/plant-3.glb`). The people are the people files.

| File | What |
|---|---|
| `training-props/student-desk.glb` | Student desk (12 in the room; the front is where the student sits) |
| `training-props/student-chair.glb` | Student chair |
| `training-props/teacher-desk.glb` | Teacher desk (the front is the side the teacher sits at) |
| `training-props/teacher-chair.glb` | Teacher chair |
| `training-props/whiteboard.glb` | Whiteboard with its pen tray (a material named board shows the lesson the app draws) |
| `training-props/academy-notebook.glb` | The airline Academy notebook on every desk (a material named cover shows the airline cover: its mark, its name, Academy) |
| `training-props/pen.glb` | Pen (the app gives each one its colour) |
| `training-props/pencil.glb` | Pencil |
| `training-props/calculator.glb` | Calculator |
| `training-props/paper-sheet.glb` | Sheet of paper |
| `training-props/bookshelf.glb` | Bookshelf, 2.7 m wide, five shelves |
| `training-props/book.glb` | Book on the shelf, spine out (the app gives each one its size and colour) |
| `training-props/book-cover.glb` | Book with its cover showing (a material named cover shows the cover and title the app draws) |
| `training-props/poster.glb` | Academy poster in its frame |
| `training-props/wall-clock.glb` | Wall clock (the app draws its hands, which keep the time) |
| `training-props/double-door-leaf.glb` | One leaf of the double doors (opens inwards; the app turns it) |

## Your private suite (`suite-props/`)

The hall, bathroom, bedroom and dressing alcove behind your office. Metres, front towards +Z, standing on the floor;
fitted to the size of the app's own. The water, the lights, the mirror's reflection and the clock's time are the app's own.

| File | What |
|---|---|
| `suite-props/suite-door.glb` | Door in the suite (office to hall, the bathroom, the bedroom), hinged at its left edge |
| `suite-props/toilet.glb` | Wall-hung toilet with its flush plate (the seat lid lifts: a part named lid is turned) |
| `suite-props/vanity.glb` | Bathroom vanity unit with its stone top |
| `suite-props/basin.glb` | Basin and its tap (the water runs from the app) |
| `suite-props/bath-mirror.glb` | Frame of the bathroom mirror (the reflection is drawn by the app) |
| `suite-props/shower.glb` | Shower: the glass panel, the rain head and the tray (the water falls from the app) |
| `suite-props/bathtub.glb` | Freestanding bath with its filler |
| `suite-props/towel-rail.glb` | Heated towel rail with a towel |
| `suite-props/bath-plant.glb` | Plant in the bathroom |
| `suite-props/bed.glb` | Double bed with its channelled headboard, bedding and pillows |
| `suite-props/nightstand.glb` | Nightstand with a drawer (one each side of the bed) |
| `suite-props/bed-lamp.glb` | Bedside lamp (its light is drawn by the app, on and off) |
| `suite-props/bedside-clock.glb` | Digital clock case (the time on it is drawn by the app) |
| `suite-props/bedroom-art.glb` | Painting over the bed |
| `suite-props/bedroom-armchair.glb` | Armchair by the window |
| `suite-props/bedroom-rug.glb` | Rug under the bed |
| `suite-props/wardrobe.glb` | Wardrobe in the dressing alcove (opening it opens your look) |

## Security (`security-props/`)

What the security officers and the police carry. Metres, the front towards +Z. The officers and the police themselves are
the people files; the officers' print (the airline name and SECURITY GUARD) is drawn by the app on their jacket or shirt.

| File | What |
|---|---|
| `security-props/taser.glb` | Taser held by an officer (the grip at the origin, the muzzle towards +Z, about 16 cm long) |
| `security-props/handcuffs.glb` | Handcuffs on the wrists behind the back (the two cuffs side by side along X, about 15 cm across) |

## Crash scene (`crash/`)

What is at a crash site besides the aircraft itself (the wreck is the aircraft's own model, broken and scorched).
Models: metres, +Y up, the front towards +Z, standing on the ground; each is fitted to the size of the app's own.
The vehicles keep the app's flashing lights. Effects: square PNG pictures with transparency, used instead of the
app's own drawing (the app still moves, fades and tints them).

| File | What |
|---|---|
| `crash/crash-fire-engine.glb` | Fire engine at a crash site (vehicles/fire-truck.glb is used when this file is missing) |
| `crash/crash-ambulance.glb` | Ambulance |
| `crash/crash-rescue-boat.glb` | Rescue boat (a crash in the sea) |
| `crash/crash-debris.glb` | One piece of wreckage: copied, turned and scaled for all the debris strewn along the path |
| `crash/crash-engine.glb` | An engine that broke off |
| `crash/crash-wing-piece.glb` | A piece of wing that broke off |
| `crash/crash-wheel.glb` | A wheel from the landing gear |
| `crash/crash-rotor-blade.glb` | A broken helicopter rotor blade |
| `crash/crash-fire.png` | Flames: one flame on a transparent background, used for every flame particle (it is tinted as it burns down) |
| `crash/crash-smoke.png` | Smoke: one puff of smoke on a transparent background (grey, lit by the app) |
| `crash/crash-soot.png` | Scorched ground under the wreck and along its path (dark, ragged edges fading to transparent) |
| `crash/crash-oil.png` | Burning-fuel and oil slick on the water (a crash in the sea) |

## The vending machine's parts (`items/vending-machine.glb`)

Name these parts (nodes or meshes) in your file and the machine works with them; any part left out stays the app's own.
Rows are A (top), B, C; columns 1 (left), 2, 3: nine products, as in the app.

| Name | What it is | How the app uses it |
|---|---|---|
| `slot-A1` … `slot-C3` | An empty node where each product stands, at the front of its shelf | The products (the app's, or their own files below) are set there, more of the same behind it |
| `coil-A1` … `coil-C3` | The spiral behind each product | Turns once round its own Z axis when that product is chosen |
| `flap` | The tray's flap, its origin on the hinge (top edge) | Swings in round its X axis when you take the product |
| `tray` | An empty node on the floor of the tray | Where the chosen product drops to |
| `display` | A flat mesh facing the front | The machine's messages are drawn on it (Make a choice, Take your item …) |
| anything else | The cabinet, glass, keypad, lights, name | Shown as it is |

Put each `slot-` node on the shelf, under the middle of the front product; the others stand behind it, 14 cm apart.
Which product is in which slot: A1 cola, A2 lemon soda, A3 orange soda, B1 chocolate bar, B2 peanut bar, B3 sparkling water,
C1 oat bar, C2 iced tea, C3 caramel bar. Names may also use capitals or an underscore (`Slot_A1`).

## Hangar items (`items/`)

The break room's vending machine and what it sells. Fitted to the size of the app's own model; cans and bars stand
upright (top towards +Y), the machine's front towards +Z.

| File | What |
|---|---|
| `items/vending-machine.glb` | Vending machine (the hangar break room) |
| `items/can-cola.glb` | Can of cola |
| `items/can-lemon.glb` | Can of lemon soda |
| `items/can-orange.glb` | Can of orange soda |
| `items/can-water.glb` | Can of sparkling water |
| `items/can-icedtea.glb` | Can of iced tea |
| `items/bar-chocolate.glb` | Chocolate bar |
| `items/bar-peanut.glb` | Peanut bar |
| `items/bar-oat.glb` | Oat bar |
| `items/bar-caramel.glb` | Caramel bar |

## People (`people/`)

A base model for each gender and group of looks. The app picks the group from each person's look (skin tone and eyes);
when that file is missing it uses `person-male.glb` or `person-female.glb`, and when that is missing too its own figure.
Rig them with a skeleton; a bone named `Jaw` (or containing "jaw") opens the mouth while the person talks, and
animations named `Idle` and `Walk` are played when they stand and walk. Height is fitted to the person's own.

| File | People |
|---|---|
| `people/person-male-european.glb` | Men: European |
| `people/person-male-african.glb` | Men: African |
| `people/person-male-east-asian.glb` | Men: East Asian |
| `people/person-male-south-asian.glb` | Men: South Asian |
| `people/person-male-middle-eastern.glb` | Men: Middle Eastern and North African |
| `people/person-male-latin-american.glb` | Men: Latin American |
| `people/person-female-european.glb` | Women: European |
| `people/person-female-african.glb` | Women: African |
| `people/person-female-east-asian.glb` | Women: East Asian |
| `people/person-female-south-asian.glb` | Women: South Asian |
| `people/person-female-middle-eastern.glb` | Women: Middle Eastern and North African |
| `people/person-female-latin-american.glb` | Women: Latin American |
| `people/person-male.glb` | Men (any group without its own file) |
| `people/person-female.glb` | Women (any group without its own file) |
