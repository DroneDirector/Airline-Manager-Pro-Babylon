// The parts of the game, each opened on its own in the 3D engine. Today only the lounge; more are added by
// registering them here (an id, a title, open and close), with nothing else to change.
import type { Engine } from '@babylonjs/core';

export interface SectionCtx { engine: Engine; canvas: HTMLCanvasElement; ui: HTMLElement; progress: (pct: number, step: string) => void; back?: () => void }
export interface Section { id: string; title: string; open(ctx: SectionCtx): Promise<void>; close(): void; onSettings?(what: string): void }
const list: { [id: string]: Section } = {};
let current: Section | null = null;
export function registerSection(s: Section) { list[s.id] = s; }
export function sections(): Section[] { return Object.keys(list).map(k => list[k]); }
export function currentSection(): Section | null { return current; }
/** Close the place you are in (back to the start screen). */
export function closeSection() { if (current) { try { current.close(); } catch (e) { console.error(e); } current = null; } }
export async function openSection(id: string, ctx: SectionCtx) {
  if (current) { try { current.close(); } catch (e) { console.error(e); } current = null; }
  const s = list[id]; if (!s) throw new Error('No section ' + id);
  current = s; await s.open(ctx);
}
