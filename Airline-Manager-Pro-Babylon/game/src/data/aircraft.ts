// Aircraft types the airline can buy. rangeNm is the manufacturer's published range (nautical miles). In the finished app this list is filtered to what the
// simulator reports as installed (default aircraft plus add-ons in the Community folder).
// Manufacturer and developer names are used only to identify products; no logos or product art are used.

interface ArtSpec {
  len: number;          // relative length 0.45 … 1
  h: number;            // fuselage height (px at full scale)
  nose: 'airbus' | 'boeing' | 'regional' | 'turboprop' | 'ga';
  eng: 'wing2' | 'wing4' | 'rear2' | 'prop2' | 'prop1';
  wing: 'low' | 'high';
  tail: 'conv' | 'T';
  win: number;          // passenger window count
  floats?: boolean;
  hump?: boolean;       // upper deck
  fixedGear?: boolean;
  strut?: boolean;
}

interface AircraftType {
  id: string; maker: string; model: string; variant: string;
  dev: string; devKind: 'default' | 'add-on';
  seats: number; rangeNm: number; cruiseKt: number; price: number; costPerHr: number;
  cls: 'airliner' | 'widebody' | 'regional' | 'turboprop' | 'bush' | 'ga' | 'helicopter';
  roles?: string[];      // helicopters: passenger, vip, sightseeing, hems, sar, offshore, cargo
  installed: boolean;    // demo: detected in the user's sim
  art: ArtSpec;
}

const AIRCRAFT: AircraftType[] = [
  { id: 'a320-fenix', maker: 'Airbus', model: 'A320', variant: 'A320-214', dev: 'Fenix Simulations', devKind: 'add-on', seats: 180, rangeNm: 3300, cruiseKt: 450, price: 46200000, costPerHr: 6100, cls: 'airliner', installed: true,
    art: { len: 0.72, h: 22, nose: 'airbus', eng: 'wing2', wing: 'low', tail: 'conv', win: 26 } },
  { id: 'a320neo', maker: 'Airbus', model: 'A320neo', variant: 'A320-251N', dev: 'Microsoft / Asobo', devKind: 'default', seats: 186, rangeNm: 3400, cruiseKt: 450, price: 110600000, costPerHr: 5400, cls: 'airliner', installed: true,
    art: { len: 0.72, h: 22, nose: 'airbus', eng: 'wing2', wing: 'low', tail: 'conv', win: 26 } },
  { id: 'a319neo', maker: 'Airbus', model: 'A319neo', variant: 'A319-171N', dev: 'No simulator model yet', devKind: 'add-on', seats: 156, rangeNm: 3750, cruiseKt: 447, price: 112000000, costPerHr: 5000, cls: 'airliner', installed: false,
    art: { len: 0.68, h: 22, nose: 'airbus', eng: 'wing2', wing: 'low', tail: 'conv', win: 24 } },
  { id: 'a321ceo', maker: 'Airbus', model: 'A321', variant: 'A321-211 (CFM56-5B3) / A321-231 (IAE V2533-A5)', dev: 'No simulator model yet', devKind: 'add-on', seats: 220, rangeNm: 3200, cruiseKt: 447, price: 125000000, costPerHr: 7000, cls: 'airliner', installed: false,
    art: { len: 0.79, h: 22, nose: 'airbus', eng: 'wing2', wing: 'low', tail: 'conv', win: 31 } },
  { id: 'a321neo', maker: 'Airbus', model: 'A321neo', variant: 'A321-251N', dev: 'No simulator model yet', devKind: 'add-on', seats: 220, rangeNm: 3500, cruiseKt: 447, price: 140000000, costPerHr: 6200, cls: 'airliner', installed: false,
    art: { len: 0.79, h: 22, nose: 'airbus', eng: 'wing2', wing: 'low', tail: 'conv', win: 31 } },
  { id: 'a321lr', maker: 'Airbus', model: 'A321LR neo', variant: 'A321-251NX', dev: 'iniBuilds', devKind: 'add-on', seats: 220, rangeNm: 4000, cruiseKt: 447, price: 146000000, costPerHr: 6300, cls: 'airliner', installed: false,
    art: { len: 0.79, h: 22, nose: 'airbus', eng: 'wing2', wing: 'low', tail: 'conv', win: 31 } },
  { id: 'a321xlr', maker: 'Airbus', model: 'A321XLR neo', variant: 'A321-253NY', dev: 'No simulator model yet', devKind: 'add-on', seats: 220, rangeNm: 4700, cruiseKt: 447, price: 155000000, costPerHr: 6400, cls: 'airliner', installed: false,
    art: { len: 0.79, h: 22, nose: 'airbus', eng: 'wing2', wing: 'low', tail: 'conv', win: 31 } },
  { id: 'a330-800neo', maker: 'Airbus', model: 'A330-800neo', variant: 'A330-841', dev: 'No simulator model yet', devKind: 'add-on', seats: 257, rangeNm: 8150, cruiseKt: 470, price: 275000000, costPerHr: 10500, cls: 'widebody', installed: false,
    art: { len: 0.92, h: 30, nose: 'airbus', eng: 'wing2', wing: 'low', tail: 'conv', win: 39 } },
  { id: 'a330-900neo', maker: 'Airbus', model: 'A330-900neo', variant: 'A330-941', dev: 'No simulator model yet', devKind: 'add-on', seats: 287, rangeNm: 7200, cruiseKt: 470, price: 315000000, costPerHr: 11200, cls: 'widebody', installed: false,
    art: { len: 0.97, h: 30, nose: 'airbus', eng: 'wing2', wing: 'low', tail: 'conv', win: 42 } },
  { id: 'a350-ini', maker: 'Airbus', model: 'A350-900', variant: 'A350-941', dev: 'iniBuilds', devKind: 'add-on', seats: 315, rangeNm: 8100, cruiseKt: 488, price: 317400000, costPerHr: 11800, cls: 'widebody', installed: true,
    art: { len: 1, h: 30, nose: 'airbus', eng: 'wing2', wing: 'low', tail: 'conv', win: 44 } },
  { id: 'a310-ini', maker: 'Airbus', model: 'A310-300', variant: 'A310-304', dev: 'iniBuilds', devKind: 'add-on', seats: 220, rangeNm: 5150, cruiseKt: 460, price: 18500000, costPerHr: 9100, cls: 'widebody', installed: false,
    art: { len: 0.78, h: 28, nose: 'airbus', eng: 'wing2', wing: 'low', tail: 'conv', win: 32 } },
  { id: 'b738-pmdg', maker: 'Boeing', model: '737-800', variant: '737-8AS', dev: 'PMDG', devKind: 'add-on', seats: 189, rangeNm: 2935, cruiseKt: 453, price: 48000000, costPerHr: 6300, cls: 'airliner', installed: true,
    art: { len: 0.75, h: 21, nose: 'boeing', eng: 'wing2', wing: 'low', tail: 'conv', win: 27 } },
  { id: 'b736-pmdg', maker: 'Boeing', model: '737-600', variant: '737-683', dev: 'PMDG', devKind: 'add-on', seats: 123, rangeNm: 3235, cruiseKt: 450, price: 24000000, costPerHr: 5600, cls: 'airliner', installed: true,
    art: { len: 0.6, h: 21, nose: 'boeing', eng: 'wing2', wing: 'low', tail: 'conv', win: 20 } },
  { id: 'b77w-pmdg', maker: 'Boeing', model: '777-300ER', variant: '777-36N(ER)', dev: 'PMDG', devKind: 'add-on', seats: 396, rangeNm: 7370, cruiseKt: 490, price: 375500000, costPerHr: 14900, cls: 'widebody', installed: true,
    art: { len: 1, h: 31, nose: 'boeing', eng: 'wing2', wing: 'low', tail: 'conv', win: 48 } },
  { id: 'b78x', maker: 'Boeing', model: '787-10', variant: '787-10 Dreamliner', dev: 'Microsoft / Asobo', devKind: 'default', seats: 330, rangeNm: 6430, cruiseKt: 488, price: 338400000, costPerHr: 11200, cls: 'widebody', installed: true,
    art: { len: 0.97, h: 29, nose: 'boeing', eng: 'wing2', wing: 'low', tail: 'conv', win: 44 } },
  { id: 'b748', maker: 'Boeing', model: '747-8', variant: '747-8 Intercontinental', dev: 'Microsoft / Asobo', devKind: 'default', seats: 410, rangeNm: 7730, cruiseKt: 495, price: 418400000, costPerHr: 19800, cls: 'widebody', installed: true,
    art: { len: 1, h: 32, nose: 'boeing', eng: 'wing4', wing: 'low', tail: 'conv', win: 48, hump: true } },
  { id: 'b737-max7', maker: 'Boeing', model: '737 MAX 7', variant: '737-7', dev: 'No simulator model yet', devKind: 'add-on', seats: 172, rangeNm: 3800, cruiseKt: 453, price: 99700000, costPerHr: 5200, cls: 'airliner', installed: false,
    art: { len: 0.70, h: 22, nose: 'boeing', eng: 'wing2', wing: 'low', tail: 'conv', win: 25 } },
  { id: 'b737-max8', maker: 'Boeing', model: '737 MAX 8', variant: '737-8', dev: 'iFly', devKind: 'add-on', seats: 189, rangeNm: 3500, cruiseKt: 453, price: 121600000, costPerHr: 5600, cls: 'airliner', installed: false,
    art: { len: 0.74, h: 22, nose: 'boeing', eng: 'wing2', wing: 'low', tail: 'conv', win: 28 } },
  { id: 'b737-max9', maker: 'Boeing', model: '737 MAX 9', variant: '737-9', dev: 'No simulator model yet', devKind: 'add-on', seats: 220, rangeNm: 3300, cruiseKt: 453, price: 128900000, costPerHr: 6000, cls: 'airliner', installed: false,
    art: { len: 0.76, h: 22, nose: 'boeing', eng: 'wing2', wing: 'low', tail: 'conv', win: 29 } },
  { id: 'b737-max10', maker: 'Boeing', model: '737 MAX 10', variant: '737-10', dev: 'No simulator model yet', devKind: 'add-on', seats: 230, rangeNm: 3100, cruiseKt: 453, price: 134900000, costPerHr: 6300, cls: 'airliner', installed: false,
    art: { len: 0.78, h: 22, nose: 'boeing', eng: 'wing2', wing: 'low', tail: 'conv', win: 31 } },
  { id: 'b787-8', maker: 'Boeing', model: '787-8', variant: '787-8', dev: 'No simulator model yet', devKind: 'add-on', seats: 242, rangeNm: 7305, cruiseKt: 488, price: 248300000, costPerHr: 9800, cls: 'widebody', installed: false,
    art: { len: 0.90, h: 30, nose: 'boeing', eng: 'wing2', wing: 'low', tail: 'conv', win: 37 } },
  { id: 'b787-9', maker: 'Boeing', model: '787-9', variant: '787-9', dev: 'No simulator model yet', devKind: 'add-on', seats: 290, rangeNm: 7565, cruiseKt: 488, price: 292500000, costPerHr: 10600, cls: 'widebody', installed: false,
    art: { len: 0.96, h: 30, nose: 'boeing', eng: 'wing2', wing: 'low', tail: 'conv', win: 41 } },
  { id: 'b777-9', maker: 'Boeing', model: '777-9', variant: '777-9 (777X)', dev: 'No simulator model yet', devKind: 'add-on', seats: 426, rangeNm: 7285, cruiseKt: 482, price: 442200000, costPerHr: 15200, cls: 'widebody', installed: false,
    art: { len: 1.00, h: 30, nose: 'boeing', eng: 'wing2', wing: 'low', tail: 'conv', win: 51 } },
  { id: 'crj9-aero', maker: 'Bombardier', model: 'CRJ900', variant: 'CRJ900LR', dev: 'Aerosoft', devKind: 'add-on', seats: 90, rangeNm: 1550, cruiseKt: 447, price: 46000000, costPerHr: 4300, cls: 'regional', installed: true,
    art: { len: 0.66, h: 17, nose: 'regional', eng: 'rear2', wing: 'low', tail: 'T', win: 24 } },
  { id: 'crj7-aero', maker: 'Bombardier', model: 'CRJ700', variant: 'CRJ700ER', dev: 'Aerosoft', devKind: 'add-on', seats: 70, rangeNm: 1400, cruiseKt: 447, price: 41000000, costPerHr: 4000, cls: 'regional', installed: true,
    art: { len: 0.58, h: 17, nose: 'regional', eng: 'rear2', wing: 'low', tail: 'T', win: 20 } },
  { id: 'atr72', maker: 'ATR', model: 'ATR 72-600', variant: 'ATR 72-600', dev: 'Microsoft / Asobo', devKind: 'default', seats: 72, rangeNm: 825, cruiseKt: 275, price: 26500000, costPerHr: 2300, cls: 'turboprop', installed: true,
    art: { len: 0.58, h: 19, nose: 'turboprop', eng: 'prop2', wing: 'high', tail: 'T', win: 19 } },
  { id: 'dhc6-aero', maker: 'de Havilland Canada', model: 'DHC-6 Twin Otter', variant: 'DHC-6-300', dev: 'Aerosoft', devKind: 'add-on', seats: 19, rangeNm: 770, cruiseKt: 150, price: 7200000, costPerHr: 1100, cls: 'bush', installed: true,
    art: { len: 0.48, h: 16, nose: 'turboprop', eng: 'prop2', wing: 'high', tail: 'conv', win: 8, fixedGear: true, strut: true } },
  { id: 'dhc2', maker: 'de Havilland Canada', model: 'DHC-2 Beaver', variant: 'DHC-2 on floats', dev: 'Microsoft / Asobo', devKind: 'default', seats: 6, rangeNm: 395, cruiseKt: 125, price: 750000, costPerHr: 420, cls: 'bush', installed: true,
    art: { len: 0.42, h: 15, nose: 'ga', eng: 'prop1', wing: 'high', tail: 'conv', win: 3, floats: true, strut: true } },
  { id: 'c208', maker: 'Cessna', model: '208B Grand Caravan', variant: '208B Grand Caravan EX', dev: 'Microsoft / Asobo', devKind: 'default', seats: 12, rangeNm: 960, cruiseKt: 185, price: 2600000, costPerHr: 640, cls: 'bush', installed: true,
    art: { len: 0.46, h: 15, nose: 'ga', eng: 'prop1', wing: 'high', tail: 'conv', win: 6, fixedGear: true, strut: true } },
  { id: 'kodiak', maker: 'Daher', model: 'Kodiak 100', variant: 'Kodiak 100 Series III', dev: 'SimWorks Studios', devKind: 'add-on', seats: 9, rangeNm: 1000, cruiseKt: 174, price: 3200000, costPerHr: 590, cls: 'bush', installed: true,
    art: { len: 0.44, h: 15, nose: 'ga', eng: 'prop1', wing: 'high', tail: 'conv', win: 4, fixedGear: true, strut: true } },
  { id: 'pc12', maker: 'Pilatus', model: 'PC-12', variant: 'PC-12 NGX', dev: 'Microsoft / Asobo', devKind: 'default', seats: 9, rangeNm: 1800, cruiseKt: 285, price: 5500000, costPerHr: 780, cls: 'ga', installed: true,
    art: { len: 0.45, h: 15, nose: 'ga', eng: 'prop1', wing: 'low', tail: 'T', win: 5 } },
  { id: 'c172', maker: 'Cessna', model: '172 Skyhawk', variant: '172S Skyhawk', dev: 'Microsoft / Asobo', devKind: 'default', seats: 3, rangeNm: 640, cruiseKt: 124, price: 430000, costPerHr: 160, cls: 'ga', installed: true,
    art: { len: 0.36, h: 12, nose: 'ga', eng: 'prop1', wing: 'high', tail: 'conv', win: 2, fixedGear: true, strut: true } },
  // helicopters (docs/reference/helicopters.txt)
  { id: 'h125', maker: 'Airbus Helicopters', model: 'H125', variant: 'H125 (AS350 B3e)', dev: 'Microsoft / Asobo', devKind: 'default', seats: 6, rangeNm: 340, cruiseKt: 125, price: 3500000, costPerHr: 1240, cls: 'helicopter', installed: true, roles: ["passenger", "sightseeing", "cargo", "vip", "hems"],
    art: { len: 0.45, h: 18, nose: 'ga', eng: 'prop1', wing: 'high', tail: 'conv', win: 4 } },
  { id: 'h130', maker: 'Airbus Helicopters', model: 'H130', variant: 'H130 (EC130 T2)', dev: 'No simulator model yet', devKind: 'add-on', seats: 7, rangeNm: 332, cruiseKt: 120, price: 3900000, costPerHr: 1380, cls: 'helicopter', installed: false, roles: ["sightseeing", "passenger", "vip", "hems"],
    art: { len: 0.45, h: 18, nose: 'ga', eng: 'prop1', wing: 'high', tail: 'conv', win: 4 } },
  { id: 'h135', maker: 'Airbus Helicopters', model: 'H135', variant: 'H135 Helionix (T3H/P3H)', dev: 'No simulator model yet', devKind: 'add-on', seats: 7, rangeNm: 342, cruiseKt: 125, price: 6000000, costPerHr: 1640, cls: 'helicopter', installed: false, roles: ["hems", "passenger", "vip", "sar", "cargo"],
    art: { len: 0.45, h: 18, nose: 'ga', eng: 'prop1', wing: 'high', tail: 'conv', win: 4 } },
  { id: 'h145', maker: 'Airbus Helicopters', model: 'H145', variant: 'H145 D3 (BK117 D-3), five-blade', dev: 'Microsoft / Asobo', devKind: 'default', seats: 10, rangeNm: 351, cruiseKt: 130, price: 10500000, costPerHr: 2090, cls: 'helicopter', installed: true, roles: ["hems", "sar", "passenger", "vip", "offshore", "cargo"],
    art: { len: 0.45, h: 18, nose: 'ga', eng: 'prop1', wing: 'high', tail: 'conv', win: 4 } },
  { id: 'h160', maker: 'Airbus Helicopters', model: 'H160', variant: 'H160', dev: 'No simulator model yet', devKind: 'add-on', seats: 12, rangeNm: 467, cruiseKt: 145, price: 18000000, costPerHr: 3330, cls: 'helicopter', installed: false, roles: ["passenger", "vip", "offshore", "hems", "sar"],
    art: { len: 0.45, h: 18, nose: 'ga', eng: 'prop1', wing: 'high', tail: 'conv', win: 4 } },
  { id: 'h175', maker: 'Airbus Helicopters', model: 'H175', variant: 'H175 (7.8 t)', dev: 'No simulator model yet', devKind: 'add-on', seats: 18, rangeNm: 626, cruiseKt: 144, price: 18000000, costPerHr: 4290, cls: 'helicopter', installed: false, roles: ["offshore", "sar", "vip", "passenger"],
    art: { len: 0.45, h: 18, nose: 'ga', eng: 'prop1', wing: 'high', tail: 'conv', win: 4 } },
  { id: 'bell407', maker: 'Bell', model: '407GXi', variant: '407GXi', dev: 'No simulator model yet', devKind: 'add-on', seats: 6, rangeNm: 350, cruiseKt: 120, price: 3300000, costPerHr: 1250, cls: 'helicopter', installed: false, roles: ["passenger", "sightseeing", "vip", "hems", "cargo"],
    art: { len: 0.45, h: 18, nose: 'ga', eng: 'prop1', wing: 'high', tail: 'conv', win: 4 } },
  { id: 'bell429', maker: 'Bell', model: '429', variant: '429 GlobalRanger', dev: 'No simulator model yet', devKind: 'add-on', seats: 7, rangeNm: 411, cruiseKt: 140, price: 7500000, costPerHr: 1750, cls: 'helicopter', installed: false, roles: ["hems", "vip", "passenger", "cargo"],
    art: { len: 0.45, h: 18, nose: 'ga', eng: 'prop1', wing: 'high', tail: 'conv', win: 4 } },
  { id: 'bell505', maker: 'Bell', model: '505', variant: '505 Jet Ranger X', dev: 'No simulator model yet', devKind: 'add-on', seats: 4, rangeNm: 306, cruiseKt: 115, price: 1400000, costPerHr: 920, cls: 'helicopter', installed: false, roles: ["passenger", "sightseeing", "vip"],
    art: { len: 0.45, h: 18, nose: 'ga', eng: 'prop1', wing: 'high', tail: 'conv', win: 4 } },
  { id: 'bell525', maker: 'Bell', model: '525 Relentless', variant: '525 Relentless (fly-by-wire; FAA certification pending as of', dev: 'No simulator model yet', devKind: 'add-on', seats: 20, rangeNm: 560, cruiseKt: 155, price: 15000000, costPerHr: 5120, cls: 'helicopter', installed: false, roles: ["offshore", "vip", "sar", "passenger", "hems"],
    art: { len: 0.45, h: 18, nose: 'ga', eng: 'prop1', wing: 'high', tail: 'conv', win: 4 } },
  { id: 'aw109', maker: 'Leonardo', model: 'AW109 Trekker', variant: 'AW109 Trekker (skid)', dev: 'No simulator model yet', devKind: 'add-on', seats: 7, rangeNm: 366, cruiseKt: 140, price: 6500000, costPerHr: 1750, cls: 'helicopter', installed: false, roles: ["hems", "passenger", "vip", "cargo", "sar"],
    art: { len: 0.45, h: 18, nose: 'ga', eng: 'prop1', wing: 'high', tail: 'conv', win: 4 } },
  { id: 'aw139', maker: 'Leonardo', model: 'AW139', variant: 'AW139 (6,400 kg; 6,800/7,000 kg kits)', dev: 'No simulator model yet', devKind: 'add-on', seats: 15, rangeNm: 570, cruiseKt: 150, price: 14000000, costPerHr: 3520, cls: 'helicopter', installed: false, roles: ["offshore", "sar", "hems", "vip", "passenger", "cargo"],
    art: { len: 0.45, h: 18, nose: 'ga', eng: 'prop1', wing: 'high', tail: 'conv', win: 4 } },
  { id: 'aw169', maker: 'Leonardo', model: 'AW169', variant: 'AW169 (wheeled)', dev: 'No simulator model yet', devKind: 'add-on', seats: 10, rangeNm: 424, cruiseKt: 135, price: 10000000, costPerHr: 2640, cls: 'helicopter', installed: false, roles: ["hems", "vip", "passenger", "offshore", "sar"],
    art: { len: 0.45, h: 18, nose: 'ga', eng: 'prop1', wing: 'high', tail: 'conv', win: 4 } },
  { id: 'aw189', maker: 'Leonardo', model: 'AW189', variant: 'AW189 (8.3 t)', dev: 'No simulator model yet', devKind: 'add-on', seats: 19, rangeNm: 600, cruiseKt: 145, price: 17000000, costPerHr: 4560, cls: 'helicopter', installed: false, roles: ["offshore", "sar", "vip", "passenger"],
    art: { len: 0.45, h: 18, nose: 'ga', eng: 'prop1', wing: 'high', tail: 'conv', win: 4 } },
  { id: 's76d', maker: 'Sikorsky', model: 'S-76D', variant: 'S-76D', dev: 'No simulator model yet', devKind: 'add-on', seats: 12, rangeNm: 400, cruiseKt: 145, price: 13000000, costPerHr: 2960, cls: 'helicopter', installed: false, roles: ["offshore", "vip", "sar", "hems", "passenger"],
    art: { len: 0.45, h: 18, nose: 'ga', eng: 'prop1', wing: 'high', tail: 'conv', win: 4 } },
  { id: 's92', maker: 'Sikorsky', model: 'S-92A', variant: 'S-92A (S-92A+ upgrades available)', dev: 'No simulator model yet', devKind: 'add-on', seats: 19, rangeNm: 547, cruiseKt: 136, price: 30000000, costPerHr: 6910, cls: 'helicopter', installed: false, roles: ["offshore", "sar", "vip", "passenger", "cargo"],
    art: { len: 0.45, h: 18, nose: 'ga', eng: 'prop1', wing: 'high', tail: 'conv', win: 4 } },
];

function acType(id: string): AircraftType { for (const a of AIRCRAFT) if (a.id === id) return a; return null; }
