// Flaps and landing gear through a flight, per aircraft type: the flap settings with their limit speeds,
// the gear limits and when crews select each step, from docs/reference/flap-gear-and-phase-speeds.txt.
// Every aircraft type added to the app gets an entry here (see CLAUDE.md).
//
//   flaps   the flap lever settings in order, with the highest speed each may be used at (VFE, knots)
//   to      take-off setting(s); land: landing setting(s)
//   gear    'fixed', or the speeds the gear may be lowered (vloExt), raised (vloRet) and flown down (vle)
//   steps   on the approach: the speed at which each setting is normally selected
//   clean   the clean manoeuvring speed

interface FlapStep { n: string; vfe: number }
interface ConfigSpec {
  flaps: FlapStep[]; to: string[]; land: string[];
  gear: 'fixed' | { vloExt: number; vloRet: number; vle: number };
  steps: { n: string; at: number }[]; clean: number;
  gearDown?: string; vmo?: number; mmo?: number; vne?: number; vno?: number;
  climbIas?: number; climbMach?: number; descIas?: number; descMach?: number; cruiseIas?: number;
}

const FLIGHT_CONFIGS: { [typeId: string]: ConfigSpec } = {
  // Airbus A320 family: CONF 1 / 1+F 230/215, 2 200, 3 185, FULL 177; gear 250 down, 220 up, 280 extended
  'a320-fenix': { flaps: [{ n: '1', vfe: 230 }, { n: '2', vfe: 200 }, { n: '3', vfe: 185 }, { n: 'FULL', vfe: 177 }], to: ['1'], land: ['FULL'],
    gear: { vloExt: 250, vloRet: 220, vle: 280 }, steps: [{ n: '1', at: 210 }, { n: '2', at: 190 }, { n: '3', at: 175 }, { n: 'FULL', at: 160 }], clean: 210, vmo: 350, mmo: 0.82, climbIas: 300, climbMach: 0.78, descIas: 300, descMach: 0.78 },
  'a320neo': { flaps: [{ n: '1', vfe: 230 }, { n: '2', vfe: 200 }, { n: '3', vfe: 185 }, { n: 'FULL', vfe: 177 }], to: ['1'], land: ['FULL'],
    gear: { vloExt: 250, vloRet: 220, vle: 280 }, steps: [{ n: '1', at: 210 }, { n: '2', at: 190 }, { n: '3', at: 175 }, { n: 'FULL', at: 158 }], clean: 210, vmo: 350, mmo: 0.82, climbIas: 300, climbMach: 0.78, descIas: 300, descMach: 0.78 },
  // Airbus A350-900: CONF 1 255, 1+F 220, 2 212, 3 195, FULL 186
  'a350-ini': { flaps: [{ n: '1', vfe: 255 }, { n: '2', vfe: 212 }, { n: '3', vfe: 195 }, { n: 'FULL', vfe: 186 }], to: ['1'], land: ['FULL'],
    gear: { vloExt: 250, vloRet: 250, vle: 250 }, steps: [{ n: '1', at: 225 }, { n: '2', at: 200 }, { n: '3', at: 185 }, { n: 'FULL', at: 168 }], clean: 225, vmo: 340, mmo: 0.89, climbIas: 310, climbMach: 0.85, descIas: 300, descMach: 0.85 },
  // Airbus A310-300: slats/flaps 15/0, 15/15, 15/20, 30/40
  'a310-ini': { flaps: [{ n: '15/0', vfe: 240 }, { n: '15/15', vfe: 215 }, { n: '15/20', vfe: 205 }, { n: '30/40', vfe: 168 }], to: ['15/15'], land: ['30/40'],
    gear: { vloExt: 270, vloRet: 240, vle: 270 }, steps: [{ n: '15/0', at: 215 }, { n: '15/15', at: 195 }, { n: '15/20', at: 180 }, { n: '30/40', at: 160 }], clean: 215, vmo: 360, mmo: 0.84, climbIas: 300, climbMach: 0.79, descIas: 290, descMach: 0.79 },
  // Boeing 737NG: flaps 1/2/5 250, 10 210, 15 200, 25 190, 30 175, 40 162; gear 270 down, 235 up, 320 extended;
  // flap manoeuvring speeds UP Vref40+70, 1 +50, 5 +30, 15 +20
  'b738-pmdg': { flaps: [{ n: '1', vfe: 250 }, { n: '2', vfe: 250 }, { n: '5', vfe: 250 }, { n: '10', vfe: 210 }, { n: '15', vfe: 200 }, { n: '25', vfe: 190 }, { n: '30', vfe: 175 }, { n: '40', vfe: 162 }], to: ['5'], land: ['30'],
    gear: { vloExt: 270, vloRet: 235, vle: 320 }, steps: [{ n: '1', at: 200 }, { n: '5', at: 180 }, { n: '15', at: 165 }, { n: '25', at: 155 }, { n: '30', at: 148 }], clean: 215, vmo: 340, mmo: 0.82, climbIas: 280, climbMach: 0.78, descIas: 280, descMach: 0.78 },
  'b736-pmdg': { flaps: [{ n: '1', vfe: 250 }, { n: '2', vfe: 250 }, { n: '5', vfe: 250 }, { n: '10', vfe: 210 }, { n: '15', vfe: 200 }, { n: '25', vfe: 190 }, { n: '30', vfe: 175 }, { n: '40', vfe: 162 }], to: ['5'], land: ['30'],
    gear: { vloExt: 270, vloRet: 235, vle: 320 }, steps: [{ n: '1', at: 185 }, { n: '5', at: 165 }, { n: '15', at: 152 }, { n: '25', at: 142 }, { n: '30', at: 136 }], clean: 200, vmo: 340, mmo: 0.82, climbIas: 280, climbMach: 0.78, descIas: 280, descMach: 0.78 },
  // Boeing 777-300ER: flaps 1 255, 5 235, 15 215, 20 195, 25 185, 30 170; gear 270, 320 extended
  'b77w-pmdg': { flaps: [{ n: '1', vfe: 255 }, { n: '5', vfe: 235 }, { n: '15', vfe: 215 }, { n: '20', vfe: 195 }, { n: '25', vfe: 185 }, { n: '30', vfe: 170 }], to: ['15'], land: ['30'],
    gear: { vloExt: 270, vloRet: 270, vle: 320 }, steps: [{ n: '1', at: 225 }, { n: '5', at: 205 }, { n: '15', at: 185 }, { n: '20', at: 175 }, { n: '30', at: 158 }], clean: 235, vmo: 330, mmo: 0.87, climbIas: 310, climbMach: 0.84, descIas: 310, descMach: 0.84 },
  // Boeing 787-10: flaps 1, 5, 15, 20, 25, 30
  'b78x': { flaps: [{ n: '1', vfe: 250 }, { n: '5', vfe: 230 }, { n: '15', vfe: 200 }, { n: '20', vfe: 190 }, { n: '25', vfe: 180 }, { n: '30', vfe: 175 }], to: ['15'], land: ['30'],
    gear: { vloExt: 270, vloRet: 270, vle: 270 }, steps: [{ n: '1', at: 220 }, { n: '5', at: 200 }, { n: '15', at: 182 }, { n: '20', at: 172 }, { n: '30', at: 155 }], clean: 230, vmo: 350, mmo: 0.9, climbIas: 310, climbMach: 0.85, descIas: 300, descMach: 0.85 },
  // Boeing 747-8: flaps 1 280, 5 260, 10 240, 20 230, 25 205, 30 180
  'b748': { flaps: [{ n: '1', vfe: 280 }, { n: '5', vfe: 260 }, { n: '10', vfe: 240 }, { n: '20', vfe: 230 }, { n: '25', vfe: 205 }, { n: '30', vfe: 180 }], to: ['20'], land: ['30'],
    gear: { vloExt: 270, vloRet: 270, vle: 320 }, steps: [{ n: '1', at: 240 }, { n: '5', at: 220 }, { n: '10', at: 200 }, { n: '20', at: 185 }, { n: '25', at: 172 }, { n: '30', at: 162 }], clean: 255, vmo: 365, mmo: 0.9, climbIas: 320, climbMach: 0.85, descIas: 310, descMach: 0.85 },
  // Bombardier CRJ700/900: slats/flaps 1, 8, 20, 30, 45
  'crj9-aero': { flaps: [{ n: '1', vfe: 230 }, { n: '8', vfe: 230 }, { n: '20', vfe: 220 }, { n: '30', vfe: 185 }, { n: '45', vfe: 170 }], to: ['8'], land: ['45'],
    gear: { vloExt: 220, vloRet: 200, vle: 220 }, steps: [{ n: '1', at: 210 }, { n: '8', at: 200 }, { n: '20', at: 185 }, { n: '30', at: 170 }, { n: '45', at: 150 }], clean: 210, vmo: 335, mmo: 0.85, climbIas: 290, climbMach: 0.77, descIas: 290, descMach: 0.77 },
  'crj7-aero': { flaps: [{ n: '1', vfe: 230 }, { n: '8', vfe: 230 }, { n: '20', vfe: 220 }, { n: '30', vfe: 185 }, { n: '45', vfe: 170 }], to: ['8'], land: ['45'],
    gear: { vloExt: 220, vloRet: 200, vle: 220 }, steps: [{ n: '1', at: 205 }, { n: '8', at: 195 }, { n: '20', at: 180 }, { n: '30', at: 165 }, { n: '45', at: 145 }], clean: 205, vmo: 335, mmo: 0.85, climbIas: 290, climbMach: 0.77, descIas: 290, descMach: 0.77 },
  // ATR 72-600: flaps 15 185, 30 150; gear 170 down, 160 up, 185 extended
  'atr72': { flaps: [{ n: '15', vfe: 185 }, { n: '30', vfe: 150 }], to: ['15'], land: ['30'],
    gear: { vloExt: 170, vloRet: 160, vle: 185 }, steps: [{ n: '15', at: 165 }, { n: '30', at: 140 }], clean: 180, vmo: 250, climbIas: 170, cruiseIas: 200, descIas: 240 },
  // DHC-6 Twin Otter: flaps 10, 20, 37 (full)
  'dhc6-aero': { flaps: [{ n: '10', vfe: 140 }, { n: '20', vfe: 120 }, { n: 'FULL', vfe: 103 }], to: ['10'], land: ['FULL'],
    gear: 'fixed', steps: [{ n: '10', at: 125 }, { n: '20', at: 110 }, { n: 'FULL', at: 95 }], clean: 120, vmo: 170, climbIas: 100, cruiseIas: 140, descIas: 140 },
  // DHC-2 Beaver: flaps take-off and landing
  'dhc2': { flaps: [{ n: 'T/O', vfe: 90 }, { n: 'LDG', vfe: 80 }], to: ['T/O'], land: ['LDG'],
    gear: 'fixed', steps: [{ n: 'T/O', at: 85 }, { n: 'LDG', at: 75 }], clean: 95, vne: 157, climbIas: 80, cruiseIas: 110, descIas: 110 },
  // Cessna 208B: flaps 10 175, 20 150, 30 125
  'c208': { flaps: [{ n: '10', vfe: 175 }, { n: '20', vfe: 150 }, { n: '30', vfe: 125 }], to: ['20'], land: ['30'],
    gear: 'fixed', steps: [{ n: '10', at: 140 }, { n: '20', at: 120 }, { n: '30', at: 95 }], clean: 140, vmo: 175, climbIas: 110, cruiseIas: 150, descIas: 165 },
  // Daher Kodiak 100: flaps 10, 20, 35
  'kodiak': { flaps: [{ n: '10', vfe: 140 }, { n: '20', vfe: 120 }, { n: '35', vfe: 100 }], to: ['20'], land: ['35'],
    gear: 'fixed', steps: [{ n: '10', at: 125 }, { n: '20', at: 110 }, { n: '35', at: 90 }], clean: 130, vmo: 182, climbIas: 105, cruiseIas: 150, descIas: 160 },
  // Pilatus PC-12: flaps 15 163, 30 130, 40 117; gear 180
  'pc12': { flaps: [{ n: '15', vfe: 163 }, { n: '30', vfe: 130 }, { n: '40', vfe: 117 }], to: ['15'], land: ['40'],
    gear: { vloExt: 180, vloRet: 180, vle: 236 }, steps: [{ n: '15', at: 140 }, { n: '30', at: 115 }, { n: '40', at: 100 }], clean: 140, vmo: 240, climbIas: 125, cruiseIas: 190, descIas: 220 },
  // Cessna 172S: flaps 10 110, 20 and 30 85
  'c172': { flaps: [{ n: '10', vfe: 110 }, { n: '20', vfe: 85 }, { n: '30', vfe: 85 }], to: ['10'], land: ['30'],
    gear: 'fixed', steps: [{ n: '10', at: 85 }, { n: '20', at: 75 }, { n: '30', at: 68 }], clean: 90, vne: 163, vno: 129, climbIas: 75, cruiseIas: 120, descIas: 120 },
  // added 3 November 2026 (docs/reference/flap-gear-and-phase-speeds.txt, part 2)
  'a319neo': { flaps: [{ n: '1', vfe: 230 }, { n: '2', vfe: 200 }, { n: '3', vfe: 185 }, { n: 'FULL', vfe: 177 }], to: ['1', '2', '3'], land: ['3', 'FULL'],
    gear: { vloExt: 250, vloRet: 220, vle: 280 }, steps: [{ n: '1', at: 205 }, { n: '2', at: 180 }, { n: '3', at: 160 }, { n: 'FULL', at: 145 }], clean: 220, vmo: 350, mmo: 0.82, climbIas: 300, climbMach: 0.78, descIas: 300, descMach: 0.78 },
  'a321ceo': { flaps: [{ n: '1', vfe: 235 }, { n: '2', vfe: 215 }, { n: '3', vfe: 195 }, { n: 'FULL', vfe: 190 }], to: ['1', '2', '3'], land: ['3', 'FULL'],
    gear: { vloExt: 250, vloRet: 220, vle: 280 }, steps: [{ n: '1', at: 215 }, { n: '2', at: 190 }, { n: '3', at: 170 }, { n: 'FULL', at: 150 }], clean: 230, vmo: 350, mmo: 0.82, climbIas: 300, climbMach: 0.78, descIas: 300, descMach: 0.78 },
  'a321neo': { flaps: [{ n: '1', vfe: 235 }, { n: '2', vfe: 215 }, { n: '3', vfe: 195 }, { n: 'FULL', vfe: 190 }], to: ['1', '2', '3'], land: ['3', 'FULL'],
    gear: { vloExt: 250, vloRet: 220, vle: 280 }, steps: [{ n: '1', at: 215 }, { n: '2', at: 190 }, { n: '3', at: 170 }, { n: 'FULL', at: 150 }], clean: 230, vmo: 350, mmo: 0.82, climbIas: 300, climbMach: 0.78, descIas: 300, descMach: 0.78 },
  'a321lr': { flaps: [{ n: '1', vfe: 235 }, { n: '2', vfe: 215 }, { n: '3', vfe: 195 }, { n: 'FULL', vfe: 190 }], to: ['1', '2', '3'], land: ['3', 'FULL'],
    gear: { vloExt: 250, vloRet: 220, vle: 280 }, steps: [{ n: '1', at: 215 }, { n: '2', at: 190 }, { n: '3', at: 170 }, { n: 'FULL', at: 150 }], clean: 230, vmo: 350, mmo: 0.82, climbIas: 300, climbMach: 0.78, descIas: 300, descMach: 0.78 },
  'a321xlr': { flaps: [{ n: '1', vfe: 235 }, { n: '2', vfe: 215 }, { n: '3', vfe: 195 }, { n: 'FULL', vfe: 190 }], to: ['1', '2', '3'], land: ['3', 'FULL'],
    gear: { vloExt: 250, vloRet: 220, vle: 280 }, steps: [{ n: '1', at: 215 }, { n: '2', at: 190 }, { n: '3', at: 170 }, { n: 'FULL', at: 150 }], clean: 230, vmo: 350, mmo: 0.82, climbIas: 300, climbMach: 0.78, descIas: 300, descMach: 0.78 },
  'a330-800neo': { flaps: [{ n: '1', vfe: 240 }, { n: '2', vfe: 196 }, { n: '3', vfe: 186 }, { n: 'FULL', vfe: 180 }], to: ['1', '2', '3'], land: ['3', 'FULL'],
    gear: { vloExt: 250, vloRet: 250, vle: 250 }, steps: [{ n: '1', at: 225 }, { n: '2', at: 185 }, { n: '3', at: 170 }, { n: 'FULL', at: 155 }], clean: 240, vmo: 330, mmo: 0.86, climbIas: 300, climbMach: 0.8, descIas: 300, descMach: 0.82 },
  'a330-900neo': { flaps: [{ n: '1', vfe: 240 }, { n: '2', vfe: 196 }, { n: '3', vfe: 186 }, { n: 'FULL', vfe: 180 }], to: ['1', '2', '3'], land: ['3', 'FULL'],
    gear: { vloExt: 250, vloRet: 250, vle: 250 }, steps: [{ n: '1', at: 225 }, { n: '2', at: 185 }, { n: '3', at: 170 }, { n: 'FULL', at: 155 }], clean: 240, vmo: 330, mmo: 0.86, climbIas: 300, climbMach: 0.8, descIas: 300, descMach: 0.82 },
  'b737-max7': { flaps: [{ n: '1', vfe: 250 }, { n: '2', vfe: 250 }, { n: '5', vfe: 250 }, { n: '10', vfe: 210 }, { n: '15', vfe: 200 }, { n: '25', vfe: 190 }, { n: '30', vfe: 175 }, { n: '40', vfe: 162 }], to: ['1', '5', '10', '15', '25'], land: ['15', '30', '40'],
    gear: { vloExt: 270, vloRet: 235, vle: 320 }, steps: [{ n: '1', at: 210 }, { n: '2', at: 200 }, { n: '5', at: 190 }, { n: '10', at: 180 }, { n: '15', at: 170 }, { n: '25', at: 160 }, { n: '30', at: 150 }, { n: '40', at: 145 }], clean: 220, vmo: 340, mmo: 0.82, climbIas: 280, climbMach: 0.78, descIas: 280, descMach: 0.78 },
  'b737-max8': { flaps: [{ n: '1', vfe: 250 }, { n: '2', vfe: 250 }, { n: '5', vfe: 250 }, { n: '10', vfe: 210 }, { n: '15', vfe: 200 }, { n: '25', vfe: 190 }, { n: '30', vfe: 175 }, { n: '40', vfe: 162 }], to: ['1', '5', '10', '15', '25'], land: ['15', '30', '40'],
    gear: { vloExt: 270, vloRet: 235, vle: 320 }, steps: [{ n: '1', at: 210 }, { n: '2', at: 200 }, { n: '5', at: 190 }, { n: '10', at: 180 }, { n: '15', at: 170 }, { n: '25', at: 160 }, { n: '30', at: 150 }, { n: '40', at: 145 }], clean: 220, vmo: 340, mmo: 0.82, climbIas: 280, climbMach: 0.78, descIas: 280, descMach: 0.78 },
  'b737-max9': { flaps: [{ n: '1', vfe: 250 }, { n: '2', vfe: 250 }, { n: '5', vfe: 250 }, { n: '10', vfe: 210 }, { n: '15', vfe: 200 }, { n: '25', vfe: 190 }, { n: '30', vfe: 175 }, { n: '40', vfe: 162 }], to: ['1', '5', '10', '15', '25'], land: ['15', '30', '40'],
    gear: { vloExt: 270, vloRet: 235, vle: 320 }, steps: [{ n: '1', at: 210 }, { n: '2', at: 200 }, { n: '5', at: 190 }, { n: '10', at: 180 }, { n: '15', at: 170 }, { n: '25', at: 160 }, { n: '30', at: 150 }, { n: '40', at: 145 }], clean: 220, vmo: 340, mmo: 0.82, climbIas: 280, climbMach: 0.78, descIas: 280, descMach: 0.78 },
  'b737-max10': { flaps: [{ n: '1', vfe: 250 }, { n: '2', vfe: 250 }, { n: '5', vfe: 250 }, { n: '10', vfe: 210 }, { n: '15', vfe: 200 }, { n: '25', vfe: 190 }, { n: '30', vfe: 175 }, { n: '40', vfe: 162 }], to: ['1', '5', '10', '15', '25'], land: ['15', '30', '40'],
    gear: { vloExt: 270, vloRet: 235, vle: 320 }, steps: [{ n: '1', at: 210 }, { n: '2', at: 200 }, { n: '5', at: 190 }, { n: '10', at: 180 }, { n: '15', at: 170 }, { n: '25', at: 160 }, { n: '30', at: 150 }, { n: '40', at: 145 }], clean: 220, vmo: 340, mmo: 0.82, climbIas: 280, climbMach: 0.78, descIas: 280, descMach: 0.78 },
  'b787-8': { flaps: [{ n: '1', vfe: 250 }, { n: '5', vfe: 230 }, { n: '15', vfe: 200 }, { n: '20', vfe: 190 }, { n: '25', vfe: 180 }, { n: '30', vfe: 175 }], to: ['5', '15', '20'], land: ['25', '30'],
    gear: { vloExt: 270, vloRet: 270, vle: 270 }, steps: [{ n: '1', at: 220 }, { n: '5', at: 200 }, { n: '15', at: 180 }, { n: '20', at: 170 }, { n: '25', at: 160 }, { n: '30', at: 150 }], clean: 230, vmo: 350, mmo: 0.9, climbIas: 310, climbMach: 0.85, descIas: 290, descMach: 0.85 },
  'b787-9': { flaps: [{ n: '1', vfe: 250 }, { n: '5', vfe: 230 }, { n: '15', vfe: 200 }, { n: '20', vfe: 190 }, { n: '25', vfe: 180 }, { n: '30', vfe: 175 }], to: ['5', '15', '20'], land: ['25', '30'],
    gear: { vloExt: 270, vloRet: 270, vle: 270 }, steps: [{ n: '1', at: 220 }, { n: '5', at: 200 }, { n: '15', at: 180 }, { n: '20', at: 170 }, { n: '25', at: 160 }, { n: '30', at: 150 }], clean: 230, vmo: 350, mmo: 0.9, climbIas: 310, climbMach: 0.85, descIas: 290, descMach: 0.85 },
  'b777-9': { flaps: [{ n: '1', vfe: 255 }, { n: '5', vfe: 235 }, { n: '15', vfe: 215 }, { n: '20', vfe: 195 }, { n: '25', vfe: 185 }, { n: '30', vfe: 170 }], to: ['5', '15', '20'], land: ['25', '30'],
    gear: { vloExt: 270, vloRet: 270, vle: 270 }, steps: [{ n: '1', at: 230 }, { n: '5', at: 210 }, { n: '15', at: 190 }, { n: '20', at: 180 }, { n: '25', at: 170 }, { n: '30', at: 155 }], clean: 240, vmo: 330, mmo: 0.89, climbIas: 310, climbMach: 0.84, descIas: 290, descMach: 0.84 },
  // helicopters: no flaps; VNE, approach and cruise speeds (docs/reference/helicopters.txt)
  'h125': { flaps: [{ n: '0', vfe: 155 }], to: ['0'], land: ['0'], gear: 'fixed', steps: [], clean: 60, vne: 155, climbIas: 110, descIas: 120, cruiseIas: 125 },
  'h130': { flaps: [{ n: '0', vfe: 155 }], to: ['0'], land: ['0'], gear: 'fixed', steps: [], clean: 60, vne: 155, climbIas: 110, descIas: 120, cruiseIas: 120 },
  'h135': { flaps: [{ n: '0', vfe: 155 }], to: ['0'], land: ['0'], gear: 'fixed', steps: [], clean: 65, vne: 155, climbIas: 110, descIas: 120, cruiseIas: 125 },
  'h145': { flaps: [{ n: '0', vfe: 150 }], to: ['0'], land: ['0'], gear: 'fixed', steps: [], clean: 70, vne: 150, climbIas: 110, descIas: 120, cruiseIas: 130 },
  'h160': { flaps: [{ n: '0', vfe: 175 }], to: ['0'], land: ['0'], gear: { vloExt: 140, vloRet: 140, vle: 150 }, steps: [], clean: 70, vne: 175, climbIas: 110, descIas: 120, cruiseIas: 145 },
  'h175': { flaps: [{ n: '0', vfe: 175 }], to: ['0'], land: ['0'], gear: { vloExt: 140, vloRet: 140, vle: 150 }, steps: [], clean: 75, vne: 175, climbIas: 110, descIas: 120, cruiseIas: 144 },
  'bell407': { flaps: [{ n: '0', vfe: 140 }], to: ['0'], land: ['0'], gear: 'fixed', steps: [], clean: 60, vne: 140, climbIas: 110, descIas: 115, cruiseIas: 120 },
  'bell429': { flaps: [{ n: '0', vfe: 155 }], to: ['0'], land: ['0'], gear: 'fixed', steps: [], clean: 65, vne: 155, climbIas: 110, descIas: 120, cruiseIas: 140 },
  'bell505': { flaps: [{ n: '0', vfe: 125 }], to: ['0'], land: ['0'], gear: 'fixed', steps: [], clean: 60, vne: 125, climbIas: 95, descIas: 100, cruiseIas: 115 },
  'bell525': { flaps: [{ n: '0', vfe: 170 }], to: ['0'], land: ['0'], gear: { vloExt: 140, vloRet: 140, vle: 150 }, steps: [], clean: 75, vne: 170, climbIas: 110, descIas: 120, cruiseIas: 155 },
  'aw109': { flaps: [{ n: '0', vfe: 168 }], to: ['0'], land: ['0'], gear: 'fixed', steps: [], clean: 65, vne: 168, climbIas: 110, descIas: 120, cruiseIas: 140 },
  'aw139': { flaps: [{ n: '0', vfe: 167 }], to: ['0'], land: ['0'], gear: { vloExt: 140, vloRet: 140, vle: 150 }, steps: [], clean: 70, vne: 167, climbIas: 110, descIas: 120, cruiseIas: 150 },
  'aw169': { flaps: [{ n: '0', vfe: 165 }], to: ['0'], land: ['0'], gear: { vloExt: 140, vloRet: 140, vle: 150 }, steps: [], clean: 70, vne: 165, climbIas: 110, descIas: 120, cruiseIas: 135 },
  'aw189': { flaps: [{ n: '0', vfe: 169 }], to: ['0'], land: ['0'], gear: { vloExt: 140, vloRet: 140, vle: 150 }, steps: [], clean: 75, vne: 169, climbIas: 110, descIas: 120, cruiseIas: 145 },
  's76d': { flaps: [{ n: '0', vfe: 155 }], to: ['0'], land: ['0'], gear: { vloExt: 140, vloRet: 140, vle: 150 }, steps: [], clean: 70, vne: 155, climbIas: 110, descIas: 120, cruiseIas: 145 },
  's92': { flaps: [{ n: '0', vfe: 165 }], to: ['0'], land: ['0'], gear: { vloExt: 140, vloRet: 140, vle: 150 }, steps: [], clean: 75, vne: 165, climbIas: 110, descIas: 120, cruiseIas: 136 },
};

/** The config data for a type: its own, or the nearest type of its class. */
function configSpec(typeId: string): ConfigSpec {
  if (FLIGHT_CONFIGS[typeId]) return FLIGHT_CONFIGS[typeId];
  const t = acType(typeId) || AIRCRAFT[0];
  const by: { [c: string]: string } = { widebody: 'b78x', airliner: 'a320neo', regional: 'crj9-aero', turboprop: 'atr72', bush: 'c208', ga: 'c172' };
  return FLIGHT_CONFIGS[by[t.cls]] || null;
}

/** Flaps (0 up … 1 full) and gear (0 up, 1 down) for a type in a phase of flight at a speed and height
 *  above the ground: the way crews configure the aircraft on the real speed schedule. */
function flightConfig(typeId: string, phase: string, ias: number, aglFt: number, onGround: boolean): { flaps: number; gear: number; flapName: string } {
  const C = configSpec(typeId), ph = (phase || '').toLowerCase();
  const sg = shapeOf(typeId).gear, fixed = !!sg.fixed || !!sg.floats || (!!C && C.gear === 'fixed');
  const n = C ? C.flaps.length : 3, idxOf = (name: string) => C ? Math.max(0, C.flaps.findIndex(f => f.n === name)) + 1 : 1;
  const frac = (i: number) => i / Math.max(1, n);
  const toIdx = C && C.to.length ? idxOf(C.to[0]) : 1, landIdx = C && C.land.length ? idxOf(C.land[0]) : n;
  let fi = 0, gear = fixed ? 1 : 0;
  if (onGround) {
    gear = 1;
    fi = /taxi out|pushback|holding|take-?off roll|line up/.test(ph) ? toIdx : /landing roll|touchdown/.test(ph) ? landIdx : 0;
  } else if (/take-?off|lift-?off|climb|departure|sid/.test(ph) && aglFt < 4000) {
    // after take-off: gear up with a positive climb, flaps up step by step as the speed builds
    gear = fixed ? 1 : aglFt < 50 ? 1 : 0;
    fi = toIdx;
    if (C) for (let i = toIdx; i >= 1; i--) { const st = C.steps.filter(s => s.n === C.flaps[i - 1].n)[0]; if (st && ias > st.at + 10) fi = i - 1; }
    else fi = aglFt > 1500 ? 0 : toIdx;
    // light aircraft bring the take-off flaps in once clear of obstacles; everyone is clean by 3,000 ft
    if (fixed && aglFt > 400) fi = 0;
    if (aglFt > 3000) fi = 0;
  } else if (/approach|final|landing|star|arrival|descent|touchdown/.test(ph)) {
    // on the approach: each step at its speed, the gear at about 2,000 ft or the final fix
    fi = 0;
    if (C) for (let i = 1; i <= landIdx; i++) { const st = C.steps.filter(s => s.n === C.flaps[i - 1].n)[0]; if (st && ias <= st.at + 2) fi = i; }
    else fi = /final/.test(ph) ? n : /approach/.test(ph) ? 1 : 0;
    if (/final/.test(ph) && aglFt < 1000) fi = landIdx;
    if (!fixed) gear = aglFt < 2200 && /approach|final|landing|touchdown/.test(ph) ? 1 : 0;
  }
  return { flaps: frac(fi), gear, flapName: fi && C ? C.flaps[fi - 1].n : 'UP' };
}
