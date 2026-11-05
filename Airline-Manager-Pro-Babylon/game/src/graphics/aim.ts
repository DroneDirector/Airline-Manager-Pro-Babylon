// Free mode (walking about your office, the courtroom, the cabin): on the PC the mouse pointer is taken by the
// view, as in games, so it isn't shown and you can turn round and round as far as you like (a click in the view
// takes it; Esc gives it back, without leaving). What you can use and are looking at, at the dot in the middle,
// glows softly: a halo round it, brightest at its edges, breathing gently.

const AimLock: any = { unlockedAt: 0, el: null };
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement) AimLock.unlockedAt = performance.now();
  document.body.classList.toggle('aim-locked', !!document.pointerLockElement);
});
/** Take the pointer for this view (PC only; needs a click, so call it from one). */
function aimLock(el: HTMLElement) {
  if (!DESKTOP || !el || document.pointerLockElement === el) return;
  AimLock.el = el;
  try { const r: any = (el as any).requestPointerLock(); if (r && r.catch) r.catch(() => { /* refused: drag to look instead */ }); } catch (e) { /* not allowed here */ }
}
function aimUnlock() { try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* not locked */ } }
function aimLocked(el?: HTMLElement): boolean { return !!document.pointerLockElement && (!el || document.pointerLockElement === el); }
/** The Esc that gave the pointer back: it shouldn't also leave the room. */
function aimEscUsed(): boolean { return performance.now() - AimLock.unlockedAt < 450; }
/** Turning with the captured mouse: as far as you like, round and round (only looking up and down stops). */
function aimTurn(look: { yaw: number; pitch: number }, e: MouseEvent, pitchMin = -1.3, pitchMax = 1.2, sens = 0.0024) {
  const S: any = (typeof State !== 'undefined' && State.settings) || {}, k = sens * (+S.mouseLook || 1), iy = S.mouseInvertY ? -1 : 1;   // Settings → Devices: speed and invert
  look.yaw -= e.movementX * k; look.pitch = Math.max(pitchMin, Math.min(pitchMax, look.pitch - e.movementY * k * iy));
  if (look.yaw > Math.PI * 64 || look.yaw < -Math.PI * 64) look.yaw = Math.atan2(Math.sin(look.yaw), Math.cos(look.yaw));   // kept small, the same direction
}

/** The soft glow round what you can use. One per scene; show() each frame while you look at something. */
class AimGlow {
  mesh: any; k = 0; want = 0; c: any; r: any;
  constructor(scene: any, color = 0x6FE3F5) {
    const T = THREE;
    const mat = new T.ShaderMaterial({
      uniforms: { uCol: { value: new T.Color(color) }, uK: { value: 0 }, uT: { value: 0 } },
      vertexShader: 'varying vec3 vN; varying vec3 vV; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 uCol; uniform float uK; uniform float uT; varying vec3 vN; varying vec3 vV; void main() { float f = 1.0 - abs(dot(normalize(vN), normalize(vV))); float rim = pow(f, 2.4) * 0.9 + pow(f, 7.0) * 0.8; float a = rim * uK * (0.75 + 0.25 * sin(uT * 3.2)); gl_FragColor = vec4(uCol * a, a); }',
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.FrontSide,
    });
    this.mesh = new T.Mesh(new T.SphereGeometry(1, 40, 24), mat); this.mesh.visible = false; this.mesh.renderOrder = 60; this.mesh.frustumCulled = false;
    this.c = new T.Vector3(); this.r = new T.Vector3(1, 1, 1);
    scene.add(this.mesh);
  }
  /** Glow round a box (centre and half sizes, in the scene's own measures). */
  show(centre: any, half: any) { this.want = 1; this.c.copy(centre); this.r.copy(half).multiplyScalar(1.18).max(new THREE.Vector3(0.08, 0.08, 0.08)); }
  /** Glow round an object (its bounding box, invisible hit boxes included). */
  showObj(o: any) {
    const T = THREE, b = new T.Box3();
    o.updateMatrixWorld(true);
    o.traverse((x: any) => { if (x.geometry) { if (!x.geometry.boundingBox) x.geometry.computeBoundingBox(); const bb = x.geometry.boundingBox.clone().applyMatrix4(x.matrixWorld); b.union(bb); } });
    if (b.isEmpty()) return this.hide();
    const parentInv = this.mesh.parent ? new T.Matrix4().copy(this.mesh.parent.matrixWorld).invert() : null;
    const c = b.getCenter(new T.Vector3()), h = b.getSize(new T.Vector3()).multiplyScalar(0.5);
    if (parentInv) c.applyMatrix4(parentInv);
    this.show(c, h);
  }
  hide() { this.want = 0; }
  /** Each frame: fade in or out (a quarter of a second), breathe. */
  step(dt: number) {
    this.k += Math.sign(this.want - this.k) * Math.min(Math.abs(this.want - this.k), dt * 4);
    const m = this.mesh; m.visible = this.k > 0.01;
    if (!m.visible) return;
    m.position.copy(this.c); m.scale.copy(this.r);
    m.material.uniforms.uK.value = this.k * this.k * (3 - 2 * this.k); m.material.uniforms.uT.value = performance.now() / 1000;
  }
  dispose() { try { this.mesh.parent && this.mesh.parent.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); } catch (e) { /* gone */ } }
}
