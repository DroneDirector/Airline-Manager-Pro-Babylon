// The real ground under the flight in the 3D viewer: the terrain's heights (Terrain Tiles on AWS, Mapzen/Tilezen
// terrarium, from SRTM, GMTED2010, ETOPO1, 3DEP and EU-DEM) covered with Sentinel-2 cloudless 2016 imagery by EOX
// (CC BY 4.0), so the sea, the coast, the fjords, the mountains and the towns are where they really are. A square of
// 5 × 5 tiles round the aircraft (about 45 km across at 60° north), on the curve of the Earth, laid out again when
// the aircraft has flown on. Loaded over the internet as needed; without it the plain land and sea stay.
import { cachedUrl, releaseUrl } from '../../core/tilecache';
import { Scene, Mesh, MeshBuilder, TransformNode, PBRMaterial, Texture, VertexBuffer, Color3 } from '@babylonjs/core';
import { IS_PC } from '../../core/app';
import { flatHeight } from '../../core/flatten';

const HEIGHT_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/';
const SAT_URL = 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/';
const Z = 11, N = 5, R = 6371000, D2R = Math.PI / 180;
const tx = (lon: number) => (lon + 180) / 360 * 2 ** Z;
const ty = (lat: number) => (1 - Math.log(Math.tan(lat * D2R) + 1 / Math.cos(lat * D2R)) / Math.PI) / 2 * 2 ** Z;
const lonOf = (x: number) => x / 2 ** Z * 360 - 180;
const latOf = (y: number) => { const n = Math.PI - 2 * Math.PI * y / 2 ** Z; return Math.atan(Math.sinh(n)) / D2R; };

export interface Terrain { root: TransformNode; lat: number; lon: number; cx: number; cy: number; tiles: Mesh[]; mats: PBRMaterial[]; ready: number; heightAt(lat: number, lon: number): number | null; dispose(): void }
const heights: { [k: string]: Float32Array | null } = {};

function loadImage(url: string): Promise<HTMLImageElement> {
  return cachedUrl(url).then(u => new Promise((ok, no) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => { releaseUrl(u); ok(im); }; im.onerror = () => { releaseUrl(u); no(new Error('no tile')); }; im.src = u; }));
}
/** A tile's heights in metres (256 × 256), from its colours: (red × 256 + green + blue / 256) − 32768. */
async function tileHeights(x: number, y: number): Promise<Float32Array | null> {
  const k = `${x}/${y}`; if (k in heights) return heights[k];
  try {
    const im = await loadImage(`${HEIGHT_URL}${Z}/${x}/${y}.png`), c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D; g.drawImage(im, 0, 0); const d = g.getImageData(0, 0, 256, 256).data, H = new Float32Array(256 * 256);
    for (let i = 0; i < H.length; i++) H[i] = d[i * 4] * 256 + d[i * 4 + 1] + d[i * 4 + 2] / 256 - 32768;
    heights[k] = H; return H;
  } catch (e) { heights[k] = null; return null; }
}

/** The ground round (lat, lon). */
export function buildTerrain(sc: Scene, lat: number, lon: number, onReady?: () => void): Terrain {
  const root = new TransformNode('terrain', sc), cx = Math.floor(tx(lon)), cy = Math.floor(ty(lat)), tiles: Mesh[] = [], mats: PBRMaterial[] = [];
  const seg = IS_PC ? 96 : 56, kx = 111320 * Math.cos(lat * D2R), kz = 110540;
  const T: Terrain = { root, lat, lon, cx, cy, tiles, mats, ready: 0,
    heightAt(la: number, lo: number) { const X = tx(lo), Y = ty(la), H = heights[`${Math.floor(X)}/${Math.floor(Y)}`]; if (!H) return null; const px = Math.min(255, Math.floor((X % 1) * 256)), py = Math.min(255, Math.floor((Y % 1) * 256)); return Math.max(0, H[py * 256 + px]); },
    dispose() { for (const m of mats) { try { if (m.albedoTexture) m.albedoTexture.dispose(); m.dispose(); } catch (e) { /* gone */ } } root.dispose(); } };
  const half = (N - 1) / 2;
  for (let j = -half; j <= half; j++) for (let i = -half; i <= half; i++) {
    const x = cx + i, y = cy + j, lo0 = lonOf(x), lo1 = lonOf(x + 1), la0 = latOf(y), la1 = latOf(y + 1);
    const m = MeshBuilder.CreateGround('tile', { width: 1, height: 1, subdivisions: seg, updatable: true }, sc); m.parent = root; m.isPickable = false; m.renderingGroupId = 1; m.receiveShadows = true;
    const mat = new PBRMaterial('tileM', sc); mat.metallic = 0; mat.roughness = 0.95; mat.albedoColor = Color3.FromHexString('#4E5E3A'); mat.environmentIntensity = 0.3; mat.zOffset = 2; m.material = mat; mats.push(mat);
    tiles.push(m); m.setEnabled(false);
    tileHeights(x, y).then(H => {
      if (m.isDisposed()) return;
      // the tile's points: east and north from the middle, its height, and the Earth's curve
      const p = m.getVerticesData(VertexBuffer.PositionKind) as Float32Array, uv = m.getVerticesData(VertexBuffer.UVKind) as Float32Array;
      for (let v = 0; v < p.length / 3; v++) {
        const u = uv[v * 2], w = uv[v * 2 + 1], lo = lo0 + (lo1 - lo0) * u, la = la0 + (la1 - la0) * w;
        const e = (lo - lon) * kx, n = (la - lat) * kz;
        let h = 0; if (H) { const px = Math.min(255, Math.floor(u * 255.999)), py = Math.min(255, Math.floor(w * 255.999)); h = Math.max(-2, H[py * 256 + px]); }
        // levelled under anything placed in the world (core/flatten)
        const fz = flatHeight(la, lo, h); h = fz.h;
        p[v * 3] = e; p[v * 3 + 1] = h - (e * e + n * n) / (2 * R) * (1 - fz.k) - 1.2 * (1 - fz.k); p[v * 3 + 2] = n;
      }
      m.updateVerticesData(VertexBuffer.PositionKind, p); m.refreshBoundingInfo(); m.createNormals(true); m.setEnabled(true);
      // the picture from the satellites (EOX's tiles count rows from the top, as the heights do)
      cachedUrl(`${SAT_URL}${Z}/${y}/${x}.jpg`).then(u => { if (sc.isDisposed) { releaseUrl(u); return; }
        const t = new Texture(u, sc, false, false, Texture.TRILINEAR_SAMPLINGMODE, () => { releaseUrl(u); mat.albedoColor = Color3.White(); }, () => { releaseUrl(u); /* the plain colour stays */ }, null, false, undefined, undefined, undefined, undefined, '.jpg');
        t.wrapU = t.wrapV = Texture.CLAMP_ADDRESSMODE; t.anisotropicFilteringLevel = 8; mat.albedoTexture = t; });
      T.ready++; if (T.ready === N * N && onReady) onReady();
    });
  }
  return T;
}
/** The ground stays still; the aircraft moves over it. */
export function placeTerrain(T: Terrain, lat: number, lon: number, alt: number) {
  T.root.position.set((T.lon - lon) * 111320 * Math.cos(lat * D2R), -alt, (T.lat - lat) * 110540);
}
/** Has the aircraft flown far enough that the ground should be laid out again round it (about 9 km)? */
export function terrainStale(T: Terrain, lat: number, lon: number): boolean { return Math.floor(tx(lon)) !== T.cx || Math.floor(ty(lat)) !== T.cy; }
