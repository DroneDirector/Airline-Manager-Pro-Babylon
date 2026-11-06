// The picture of your pet in the game's pet editor (Your pilot → Pet): drawn here, in its own little scene, as it is
// now (asleep in its bed with its bowls), and sent back to the editor whenever you change something.
import { Engine, Scene, Vector3, Color3, Color4, UniversalCamera, HemisphericLight, DirectionalLight, MeshBuilder, PBRMaterial } from '@babylonjs/core';
import { onGamePetPreview, gameSend } from '../../ui/game-frame';
import { placePet } from './pet';

let eng: Engine | null = null, cv: HTMLCanvasElement | null = null, busy = false, want: any = null;
function draw(d: any) {
  if (busy) { want = d; return; } busy = true;
  try {
    const W = Math.max(200, Math.min(1200, d.w || 560)), H = Math.max(120, Math.min(800, d.h || 340));
    if (!cv) { cv = document.createElement('canvas'); }
    cv.width = W; cv.height = H;
    if (!eng) eng = new Engine(cv, true, { preserveDrawingBuffer: true, stencil: false, antialias: true }); else eng.resize();
    const sc = new Scene(eng); sc.clearColor = new Color4(0, 0, 0, 0);
    const h = new HemisphericLight('h', new Vector3(0, 1, 0), sc); h.diffuse = Color3.FromHexString('#FFF3E2'); h.groundColor = Color3.FromHexString('#3A2A1A'); h.intensity = 1.1;
    const s = new DirectionalLight('s', new Vector3(-0.4, -1, -0.6).normalize(), sc); s.intensity = 1.6; s.diffuse = Color3.FromHexString('#FFF0DC');
    const fl = MeshBuilder.CreateDisc('fl', { radius: 1.2, tessellation: 48 }, sc); fl.rotation.x = Math.PI / 2; const fm = new PBRMaterial('fm', sc); fm.albedoColor = Color3.FromHexString('#5A3B26'); fm.roughness = 0.8; fm.metallic = 0; fl.material = fm;
    const pet = placePet(sc, null, d.pet, [0, 0], 0, { door: [0.9, 0], box: [-1, -1, 1, 1], fine: true });
    if (pet) pet.step(0.01, 0.016);
    const cam = new UniversalCamera('c', new Vector3(0.55, 0.62, -1.05), sc); cam.fov = 32 * Math.PI / 180; cam.minZ = 0.01; cam.setTarget(new Vector3(0.2, 0.05, -0.02)); sc.activeCamera = cam;
    sc.executeWhenReady(() => {
      try { sc.render(); const url = cv!.toDataURL('image/png'); gameSend({ ampb: 'petprev', url, id: d.id }); } catch (e) { /* no picture */ }
      sc.dispose(); busy = false; if (want) { const n = want; want = null; draw(n); }
    });
  } catch (e) { busy = false; }
}
onGamePetPreview(draw);
export {};
