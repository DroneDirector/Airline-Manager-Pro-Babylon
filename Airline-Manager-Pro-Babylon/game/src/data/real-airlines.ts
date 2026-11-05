// Registrations for other airlines' aircraft when they are shown with real airline names (the airlines
// themselves are REAL_AIRLINES in airlines.ts).

/** Aircraft registration prefixes, by the first letters of the base's ICAO code (the country). */
const REG_PREFIX: { [k: string]: string } = {
  EG: 'G-', EI: 'EI-', ED: 'D-', LF: 'F-', EH: 'PH-', EB: 'OO-', LS: 'HB-', LO: 'OE-', EK: 'OY-', EN: 'LN-', ES: 'SE-', EF: 'OH-', BI: 'TF-',
  LE: 'EC-', LP: 'CS-', LI: 'I-', LG: 'SX-', LT: 'TC-', EP: 'SP-', LH: 'HA-', OM: 'A6-', OT: 'A7-', OE: 'HZ-', LL: '4X-', HA: 'ET-', HE: 'SU-',
  GM: 'CN-', FA: 'ZS-', K: 'N', C: 'C-', MM: 'XA-', MP: 'HP-', SK: 'HK-', SC: 'CC-', WS: '9V-', VH: 'B-', RJ: 'JA', RK: 'HL', ZB: 'B-', ZS: 'B-',
  ZG: 'B-', VI: 'VT-', VA: 'VT-', YS: 'VH-', NZ: 'ZK-', WM: '9M-', VT: 'HS-', RP: 'RP-', WI: 'PK-',
};
/** A registration in the style of the country an airline is based in. */
function realReg(hub: string, r: () => number): string {
  const L = () => String.fromCharCode(65 + Math.floor(r() * 26)), D = () => String(Math.floor(r() * 10));
  const p = REG_PREFIX[hub.slice(0, 2)] || REG_PREFIX[hub[0]] || hub.slice(0, 2) + '-';
  if (p === 'N') return 'N' + (1 + Math.floor(r() * 9)) + D() + D() + L() + L();
  if (p === 'JA') return 'JA' + D() + D() + D() + L();
  if (p === 'HL') return 'HL' + D() + D() + D() + D();
  if (p === 'B-' || p === '4X-') return p + D() + D() + D() + D();
  return p + (p.length >= 3 ? L() + L() + L() : L() + L() + L() + L()).slice(0, p.length >= 3 ? 3 : 4);
}

/** The real airlines' colour schemes, in broad strokes: the colours and where they go (fuselage, belly,
 * tail, engines). No names, logos or emblems are painted on, so the aircraft are recognisable by their
 * colours only. [style, fuselage, main colour, second colour, belly, tail, engines]. */
const REAL_SCHEMES: { [icao: string]: [Livery['style'], string, string, string, string, Livery['tail'], Livery['engines']] } = {
  FLI: ['stripe', '#F4F6F8', '#1F4E9C', '#D52B1E', '#F4F6F8', 'solid', 'c1'],
  ICE: ['belly', '#F4F6F8', '#1B3B6F', '#F3C300', '#1B3B6F', 'solid', 'c1'],
  FPY: ['full', '#E3002B', '#E3002B', '#F4F6F8', '#E3002B', 'solid', 'body'],
  GRL: ['full', '#C8102E', '#C8102E', '#F4F6F8', '#C8102E', 'solid', 'body'],
  SAS: ['tail', '#F4F6F8', '#00205B', '#BBBDC0', '#F4F6F8', 'solid', 'c1'],
  NOZ: ['nose', '#F4F6F8', '#D81939', '#D81939', '#F4F6F8', 'solid', 'body'],
  WIF: ['stripe', '#F4F6F8', '#1D6E3F', '#55B848', '#F4F6F8', 'solid', 'body'],
  FIN: ['stripe', '#F4F6F8', '#0B1560', '#0B1560', '#F4F6F8', 'white', 'body'],
  LOG: ['stripe', '#F4F6F8', '#1E3264', '#D52B1E', '#F4F6F8', 'solid', 'c1'],
  BAW: ['belly', '#F4F6F8', '#1C2C5B', '#D52B1E', '#1C2C5B', 'split', 'c1'],
  DLH: ['tail', '#F4F6F8', '#05164D', '#F9B000', '#F4F6F8', 'solid', 'c1'],
  AFR: ['tail', '#F4F6F8', '#002157', '#E1001A', '#F4F6F8', 'white', 'body'],
  KLM: ['belly', '#00A1DE', '#00A1DE', '#003082', '#F4F6F8', 'solid', 'c1'],
  IBE: ['tail', '#F4F6F8', '#D7192D', '#FFCC00', '#F4F6F8', 'split', 'body'],
  TAP: ['tail', '#F4F6F8', '#00A651', '#E30613', '#F4F6F8', 'split', 'body'],
  ITY: ['tail', '#F4F6F8', '#1E3E9B', '#00A3E0', '#F4F6F8', 'gradient', 'body'],
  AEE: ['tail', '#F4F6F8', '#0A1F6B', '#1E73BE', '#F4F6F8', 'solid', 'body'],
  THY: ['tail', '#F4F6F8', '#C70A0C', '#C70A0C', '#F4F6F8', 'solid', 'body'],
  SWR: ['tail', '#F4F6F8', '#E2001A', '#F4F6F8', '#F4F6F8', 'solid', 'body'],
  AUA: ['tail', '#F4F6F8', '#E2001A', '#F4F6F8', '#E2001A', 'split', 'body'],
  BEL: ['tail', '#F4F6F8', '#00235F', '#E1001A', '#F4F6F8', 'solid', 'body'],
  EIN: ['stripe', '#F4F6F8', '#006272', '#7AB800', '#F4F6F8', 'solid', 'c1'],
  RYR: ['belly', '#F4F6F8', '#073590', '#F1C933', '#073590', 'solid', 'body'],
  EZY: ['nose', '#F4F6F8', '#FF6600', '#FF6600', '#F4F6F8', 'solid', 'c1'],
  WZZ: ['swoosh', '#F4F6F8', '#C6007E', '#2E2A6E', '#F4F6F8', 'solid', 'c2'],
  DAL: ['belly', '#F4F6F8', '#003A70', '#C8102E', '#003A70', 'split', 'body'],
  UAL: ['belly', '#F4F6F8', '#002244', '#0F57A3', '#0F57A3', 'solid', 'c2'],
  AAL: ['stripe', '#C8CED6', '#0078D2', '#C30019', '#C8CED6', 'split', 'body'],
  SWA: ['belly', '#304CB2', '#304CB2', '#FFBF27', '#E51D23', 'solid', 'body'],
  ASA: ['tail', '#F4F6F8', '#01426A', '#48A9C5', '#F4F6F8', 'solid', 'body'],
  JBU: ['tail', '#F4F6F8', '#003876', '#0033A0', '#003876', 'solid', 'c1'],
  ACA: ['belly', '#F4F6F8', '#1A1A1A', '#D22630', '#1A1A1A', 'solid', 'c1'],
  WJA: ['tail', '#F4F6F8', '#00A99D', '#003C71', '#F4F6F8', 'gradient', 'body'],
  UAE: ['tail', '#F4F6F8', '#D71921', '#2F8F3F', '#F4F6F8', 'split', 'body'],
  QTR: ['tail', '#F4F6F8', '#5C0632', '#5C0632', '#F4F6F8', 'solid', 'c1'],
  ETD: ['tail', '#E8DCC6', '#B7965A', '#4A4A49', '#E8DCC6', 'gradient', 'body'],
  SIA: ['tail', '#F4F6F8', '#1D2C5B', '#F9A51A', '#F4F6F8', 'solid', 'c1'],
  CPA: ['stripe', '#F4F6F8', '#006564', '#9EA2A2', '#F4F6F8', 'solid', 'body'],
  JAL: ['tail', '#F4F6F8', '#F4F6F8', '#CC0000', '#F4F6F8', 'white', 'body'],
  ANA: ['belly', '#F4F6F8', '#13448F', '#00A0E9', '#13448F', 'solid', 'body'],
  KAL: ['full', '#A2CCEB', '#A2CCEB', '#00256C', '#C9D0D8', 'solid', 'body'],
  AIC: ['tail', '#F4F6F8', '#DA0E29', '#5D2E8C', '#F4F6F8', 'gradient', 'body'],
  IGO: ['tail', '#F4F6F8', '#001B94', '#001B94', '#F4F6F8', 'solid', 'c1'],
  QFA: ['belly', '#F4F6F8', '#E40000', '#F4F6F8', '#E40000', 'solid', 'body'],
  ANZ: ['tail', '#F4F6F8', '#111111', '#F4F6F8', '#F4F6F8', 'solid', 'c1'],
  LAN: ['belly', '#F4F6F8', '#1B0088', '#E8114B', '#1B0088', 'split', 'body'],
  AVA: ['full', '#DA291C', '#DA291C', '#F4F6F8', '#DA291C', 'solid', 'body'],
  CMP: ['tail', '#F4F6F8', '#0032A0', '#C5A253', '#F4F6F8', 'solid', 'c1'],
};
/** A real airline's colours on an aircraft: its scheme when known, otherwise its main colour on the tail. */
function realLivery(icao: string, color: string): Livery {
  const s = REAL_SCHEMES[icao];
  if (!s) return { style: 'tail', body: '#F4F6F8', c1: color, c2: color, belly: '#F4F6F8', tail: 'solid', engines: 'body', titles: '', emblem: false };
  return { style: s[0], body: s[1], c1: s[2], c2: s[3], belly: s[4], tail: s[5], engines: s[6], titles: '', emblem: false };
}
