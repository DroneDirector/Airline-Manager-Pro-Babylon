// How many passengers each type carries, from the manufacturers' published figures: a typical layout
// in two or three classes, all-economy, and the most the emergency exits allow (the certified maximum).
// Freighters show cargo instead. Every aircraft type added to the app gets an entry here (see CLAUDE.md).
//   typ    typical seats in the usual airline layout (classes noted)
//   one    all-economy (high density) layout
//   max    the certified maximum (exit limit)

interface Capacity { typ: number; cls: string; one: number; max: number }

const CAPACITY: { [typeId: string]: Capacity } = {
  'a320-fenix': { typ: 150, cls: '2 classes', one: 180, max: 186 },
  'a320neo': { typ: 165, cls: '2 classes', one: 186, max: 194 },
  'a350-ini': { typ: 315, cls: '3 classes', one: 440, max: 440 },
  'a310-ini': { typ: 220, cls: '2 classes', one: 265, max: 280 },
  'b738-pmdg': { typ: 162, cls: '2 classes', one: 189, max: 189 },
  'b736-pmdg': { typ: 110, cls: '2 classes', one: 130, max: 130 },
  'b77w-pmdg': { typ: 365, cls: '3 classes', one: 550, max: 550 },
  'b78x': { typ: 330, cls: '2 classes', one: 440, max: 440 },
  'b748': { typ: 410, cls: '3 classes', one: 605, max: 605 },
  'crj9-aero': { typ: 76, cls: '2 classes', one: 90, max: 90 },
  'crj7-aero': { typ: 66, cls: '2 classes', one: 78, max: 78 },
  'atr72': { typ: 70, cls: '1 class', one: 72, max: 78 },
  'dhc6-aero': { typ: 19, cls: '1 class', one: 19, max: 20 },
  'dhc2': { typ: 6, cls: '1 class', one: 7, max: 7 },
  'c208': { typ: 9, cls: 'commuter', one: 13, max: 13 },
  'kodiak': { typ: 8, cls: 'utility', one: 9, max: 9 },
  'pc12': { typ: 6, cls: 'executive', one: 9, max: 9 },
  'c172': { typ: 3, cls: 'with the pilot', one: 3, max: 3 },
  'a319neo': { typ: 140, cls: '2 classes', one: 156, max: 160 },
  'a321ceo': { typ: 185, cls: '2 classes', one: 220, max: 220 },
  'a321neo': { typ: 196, cls: '2 classes', one: 220, max: 244 },
  'a321lr': { typ: 206, cls: '2 classes', one: 220, max: 244 },
  'a321xlr': { typ: 200, cls: '2 classes', one: 220, max: 244 },
  'a330-800neo': { typ: 257, cls: '2 classes', one: 300, max: 406 },
  'a330-900neo': { typ: 287, cls: '2 classes', one: 330, max: 460 },
  'b737-max7': { typ: 153, cls: '2 classes', one: 172, max: 172 },
  'b737-max8': { typ: 178, cls: '2 classes', one: 189, max: 210 },
  'b737-max9': { typ: 193, cls: '2 classes', one: 220, max: 220 },
  'b737-max10': { typ: 204, cls: '2 classes', one: 230, max: 230 },
  'b787-8': { typ: 242, cls: '2 classes', one: 359, max: 381 },
  'b787-9': { typ: 290, cls: '2 classes', one: 406, max: 420 },
  'b777-9': { typ: 426, cls: '2 classes', one: 450, max: 460 },
  'h125': { typ: 5, cls: '1 class', one: 6, max: 6 },
  'h130': { typ: 6, cls: '1 class', one: 7, max: 7 },
  'h135': { typ: 6, cls: '1 class', one: 7, max: 7 },
  'h145': { typ: 8, cls: '1 class', one: 10, max: 10 },
  'h160': { typ: 12, cls: '1 class', one: 12, max: 12 },
  'h175': { typ: 16, cls: '1 class', one: 18, max: 18 },
  'bell407': { typ: 5, cls: '1 class', one: 6, max: 6 },
  'bell429': { typ: 6, cls: '1 class', one: 7, max: 7 },
  'bell505': { typ: 4, cls: '1 class', one: 4, max: 4 },
  'bell525': { typ: 16, cls: '1 class', one: 20, max: 20 },
  'aw109': { typ: 6, cls: '1 class', one: 7, max: 7 },
  'aw139': { typ: 12, cls: '1 class', one: 15, max: 15 },
  'aw169': { typ: 8, cls: '1 class', one: 10, max: 10 },
  'aw189': { typ: 16, cls: '1 class', one: 19, max: 19 },
  's76d': { typ: 12, cls: '1 class', one: 12, max: 12 },
  's92': { typ: 16, cls: '1 class', one: 19, max: 19 },
};

/** The capacity of a type (types without an entry: their seats as the typical figure). */
function capacityOf(typeId: string): Capacity {
  const c = CAPACITY[typeId]; if (c) return c;
  const t = acType(typeId) || AIRCRAFT[0];
  return { typ: t.seats, cls: '', one: t.seats, max: t.seats };
}

/** "150 in 2 classes · 180 all economy · up to 186" for cards and details. */
function capacityText(typeId: string): string {
  const c = capacityOf(typeId);
  const parts = [`${c.typ}${c.cls ? ' ' + (/class/.test(c.cls) ? 'in ' : '') + c.cls : ''}`];
  if (c.one > c.typ) parts.push(`${c.one} all economy`);
  if (c.max > c.one) parts.push(`up to ${c.max}`);
  return parts.join(' · ');
}
