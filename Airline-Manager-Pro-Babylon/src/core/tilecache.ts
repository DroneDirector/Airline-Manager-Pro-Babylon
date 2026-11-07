// The map tiles the 3D places download (the ground's heights and the satellite pictures), kept on the device
// (IndexedDB), so the second time a place opens it comes up faster and works without a connection. Up to about 3,000
// tiles (a few hundred MB at most); the oldest go first. Phone and PC alike. If anything fails, the tile is simply
// downloaded as before.
const DB = 'ampb-tiles', ST = 'tiles', MAX = 3000;
let dbP: Promise<IDBDatabase | null> | null = null;
function db(): Promise<IDBDatabase | null> {
  if (!dbP) dbP = new Promise(ok => { try { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => { const s = r.result.createObjectStore(ST, { keyPath: 'url' }); s.createIndex('t', 't'); };
    r.onsuccess = () => ok(r.result); r.onerror = () => ok(null); } catch (e) { ok(null); } });
  return dbP;
}
const get = (d: IDBDatabase, url: string) => new Promise<Blob | null>(ok => { try { const q = d.transaction(ST, 'readonly').objectStore(ST).get(url); q.onsuccess = () => ok(q.result ? q.result.blob : null); q.onerror = () => ok(null); } catch (e) { ok(null); } });
let puts = 0;
function put(d: IDBDatabase, url: string, blob: Blob) {
  try { const tx = d.transaction(ST, 'readwrite'), s = tx.objectStore(ST); s.put({ url, blob, t: Date.now() });
    // every 100 new tiles, the oldest beyond the limit go
    if (++puts % 100 === 0) { const c = s.count(); c.onsuccess = () => { let extra = c.result - MAX; if (extra <= 0) return; const cur = s.index('t').openCursor(); cur.onsuccess = () => { const k = cur.result; if (k && extra-- > 0) { k.delete(); k.continue(); } }; }; }
  } catch (e) { /* not kept */ }
}
/** A local address for the tile: from the device if kept, else downloaded once and kept. Revoke it when loaded. */
export async function cachedUrl(url: string): Promise<string> {
  try {
    const d = await db(); if (!d) return url;
    const hit = await get(d, url); if (hit) return URL.createObjectURL(hit);
    const r = await fetch(url, { mode: 'cors' }); if (!r.ok) return url;
    const blob = await r.blob(); put(d, url, blob); return URL.createObjectURL(blob);
  } catch (e) { return url; }
}
export const releaseUrl = (u: string) => { if (u.startsWith('blob:')) try { URL.revokeObjectURL(u); } catch (e) { /* gone */ } };
