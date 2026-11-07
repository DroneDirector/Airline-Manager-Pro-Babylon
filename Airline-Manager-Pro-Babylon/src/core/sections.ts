import { optimizePlace, setCombiners } from './batch';
import { shareMaterials } from './texarray';
import { thinStatic } from './thin';
import { logIssue } from './errlog';
setCombiners(shareMaterials, thinStatic);
// The parts of the game, each opened on its own in the 3D engine. Today only the lounge; more are added by
// registering them here (an id, a title, open and close), with nothing else to change.
import type { Engine } from '@babylonjs/core';

export interface SectionCtx { engine: Engine; canvas: HTMLCanvasElement; ui: HTMLElement; progress: (pct: number, step: string) => void; back?: () => void; opts?: any; toGame?: (screen?: string) => void; goTo?: (id: string, opts?: any) => void }
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
  // the places without the airport's kit: their fixed objects combined once they have settled (the airport does its own)
  if (/^(lounge|office|ops|hangar|court|building|terminal)$/.test(id)) { const sc = ctx.engine.scenes[ctx.engine.scenes.length - 1];
    if (sc) optimizePlace(sc, (s as any).title || id, (what, why) => logIssue((s as any).title || id, what, why)); }
}
