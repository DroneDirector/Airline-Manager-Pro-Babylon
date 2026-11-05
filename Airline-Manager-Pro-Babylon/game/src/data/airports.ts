// The main airports, with hand-checked names. Every other airport in the world comes from World
// (world-airports.ts), and the simulator's own airports are added when the app is linked.
interface Airport { icao: string; name: string; city: string; country: string; pos: number[] }

const AIRPORTS: { [icao: string]: Airport } = {};
([
  ['EKVG', 'Vágar', 'Vágar', 'Faroe Islands', -7.2772, 62.0636],
  ['BIKF', 'Keflavík', 'Reykjavík', 'Iceland', -22.6056, 63.985],
  ['BIRK', 'Reykjavík City', 'Reykjavík', 'Iceland', -21.9406, 64.13],
  ['BGBW', 'Narsarsuaq', 'Narsarsuaq', 'Greenland', -45.4258, 61.1605],
  ['BGSF', 'Kangerlussuaq', 'Kangerlussuaq', 'Greenland', -50.7116, 67.0122],
  ['EKCH', 'Copenhagen Kastrup', 'Copenhagen', 'Denmark', 12.6561, 55.6181],
  ['EKBI', 'Billund', 'Billund', 'Denmark', 9.1518, 55.7403],
  ['ENGM', 'Oslo Gardermoen', 'Oslo', 'Norway', 11.1004, 60.1939],
  ['ENBR', 'Bergen Flesland', 'Bergen', 'Norway', 5.218, 60.2934],
  ['ESSA', 'Stockholm Arlanda', 'Stockholm', 'Sweden', 17.9186, 59.6519],
  ['EFHK', 'Helsinki Vantaa', 'Helsinki', 'Finland', 24.9633, 60.3172],
  ['EGPH', 'Edinburgh', 'Edinburgh', 'United Kingdom', -3.3725, 55.95],
  ['EGLL', 'London Heathrow', 'London', 'United Kingdom', -0.4614, 51.4775],
  ['EHAM', 'Amsterdam Schiphol', 'Amsterdam', 'Netherlands', 4.7639, 52.3086],
  ['EDDF', 'Frankfurt', 'Frankfurt', 'Germany', 8.5706, 50.0333],
  ['LFPG', 'Paris Charles de Gaulle', 'Paris', 'France', 2.55, 49.0097],
  ['LEMD', 'Madrid Barajas', 'Madrid', 'Spain', -3.5676, 40.4719],
  ['LPPT', 'Lisbon', 'Lisbon', 'Portugal', -9.1342, 38.7742],
  ['LIRF', 'Rome Fiumicino', 'Rome', 'Italy', 12.2389, 41.8003],
  ['LGAV', 'Athens', 'Athens', 'Greece', 23.9445, 37.9364],
  ['OMDB', 'Dubai', 'Dubai', 'United Arab Emirates', 55.3644, 25.2528],
  ['KJFK', 'John F. Kennedy', 'New York', 'United States', -73.7789, 40.6398],
  ['KBOS', 'Boston Logan', 'Boston', 'United States', -71.0052, 42.3643],
  ['KSEA', 'Seattle–Tacoma', 'Seattle', 'United States', -122.3088, 47.449],
  ['CYYZ', 'Toronto Pearson', 'Toronto', 'Canada', -79.6306, 43.6772],
  ['PANC', 'Ted Stevens Anchorage', 'Anchorage', 'United States', -149.9964, 61.1744],
  ['PALH', 'Lake Hood Seaplane Base', 'Anchorage', 'United States', -149.9618, 61.1866],
  ['PATK', 'Talkeetna', 'Talkeetna', 'United States', -150.0937, 62.3205],
  ['PAKN', 'King Salmon', 'King Salmon', 'United States', -156.6492, 58.6768],
  ['PAEN', 'Kenai', 'Kenai', 'United States', -151.2453, 60.5731],
  ['PAHO', 'Homer', 'Homer', 'United States', -151.4766, 59.6456],
  ['PAJN', 'Juneau', 'Juneau', 'United States', -134.5763, 58.3549],
  ['PAFA', 'Fairbanks', 'Fairbanks', 'United States', -147.8561, 64.8151],
  ['PAOM', 'Nome', 'Nome', 'United States', -165.4453, 64.5122],
  // hubs of real-world airlines you can fly for
  ['PANC', 'Ted Stevens Anchorage', 'Anchorage', 'United States', -149.9964, 61.1743],
  ['ENBO', 'Bodø', 'Bodø', 'Norway', 14.3653, 67.2692],
  ['EGPF', 'Glasgow', 'Glasgow', 'United Kingdom', -4.4331, 55.8719],
  ['EGKK', 'London Gatwick', 'London', 'United Kingdom', -0.1821, 51.1537],
  ['EIDW', 'Dublin', 'Dublin', 'Ireland', -6.2701, 53.4213],
  ['LHBP', 'Budapest Ferenc Liszt', 'Budapest', 'Hungary', 19.2556, 47.4369],
  ['LTFM', 'Istanbul', 'Istanbul', 'Turkey', 28.7519, 41.2753],
  ['LSZH', 'Zurich', 'Zurich', 'Switzerland', 8.5492, 47.4647],
  ['LOWW', 'Vienna', 'Vienna', 'Austria', 16.5697, 48.1103],
  ['EBBR', 'Brussels', 'Brussels', 'Belgium', 4.4844, 50.901],
  ['OTHH', 'Hamad International', 'Doha', 'Qatar', 51.6081, 25.2731],
  ['OMAA', 'Abu Dhabi', 'Abu Dhabi', 'United Arab Emirates', 54.6511, 24.433],
  ['WSSS', 'Singapore Changi', 'Singapore', 'Singapore', 103.9915, 1.3644],
  ['VHHH', 'Hong Kong', 'Hong Kong', 'Hong Kong', 113.9185, 22.308],
  ['RJTT', 'Tokyo Haneda', 'Tokyo', 'Japan', 139.7798, 35.5494],
  ['RKSI', 'Seoul Incheon', 'Seoul', 'South Korea', 126.4407, 37.4602],
  ['VIDP', 'Delhi Indira Gandhi', 'Delhi', 'India', 77.1, 28.5562],
  ['YSSY', 'Sydney', 'Sydney', 'Australia', 151.1753, -33.9399],
  ['NZAA', 'Auckland', 'Auckland', 'New Zealand', 174.785, -37.0082],
  ['KATL', 'Atlanta Hartsfield-Jackson', 'Atlanta', 'United States', -84.4277, 33.6407],
  ['KORD', 'Chicago O\'Hare', 'Chicago', 'United States', -87.9073, 41.9742],
  ['KDFW', 'Dallas/Fort Worth', 'Dallas', 'United States', -97.0403, 32.8998],
  ['KDAL', 'Dallas Love Field', 'Dallas', 'United States', -96.8518, 32.8471],
  ['KLAX', 'Los Angeles', 'Los Angeles', 'United States', -118.4085, 33.9416],
  ['CYYC', 'Calgary', 'Calgary', 'Canada', -114.0076, 51.1215],
  ['CYHC', 'Vancouver Harbour', 'Vancouver', 'Canada', -123.1172, 49.2894],
  ['SCEL', 'Santiago', 'Santiago', 'Chile', -70.7858, -33.393],
  ['SKBO', 'Bogotá El Dorado', 'Bogotá', 'Colombia', -74.1469, 4.7016],
  ['MPTO', 'Panama Tocumen', 'Panama City', 'Panama', -79.3835, 9.0714],
] as any[]).forEach(r => { AIRPORTS[r[0]] = { icao: r[0], name: r[1], city: r[2], country: r[3], pos: [r[4], r[5]] }; });

// the bush airports in Alaska (bush companies fly between these; airlines only to the bigger ones)
const BUSH_APTS = ['PANC', 'PALH', 'PATK', 'PAKN', 'PAEN', 'PAHO', 'PAJN', 'PAFA', 'PAOM'];
function bushApt(k: string): boolean { return BUSH_APTS.indexOf(k) >= 0; }
function airlineApt(k: string): boolean { return !bushApt(k) || k === 'PANC' || k === 'PAJN' || k === 'PAFA'; }

function apt(icao: string): Airport { return AIRPORTS[icao] || (typeof World !== 'undefined' ? World.get(icao) : null); }
