// Simpler models in the distance: an aircraft far from the camera is drawn as a light version of itself (the
// fuselage, wings, tail and engines in its colours, a dozen parts instead of hundreds), and as the full model when
// it comes closer. Phones and tablets switch nearer than the PC; Settings → Graphics → Terrain detail moves it.

function v3dLodDist(): number { const q = typeof v3dTerrainQ === 'function' ? v3dTerrainQ() : 1; return (DESKTOP ? 3500 : 1600) * [0.6, 1, 1.3, 1.6, 2.2][q]; }
function v3dLodBuild(typeId: string, color: string): any {
  const T = THREE, s = shapeOf(typeId), g = new T.Group();
  const body = new T.MeshStandardMaterial({ color: 0xF2F4F6, roughness: 0.4, metalness: 0.1 }), wingM = new T.MeshStandardMaterial({ color: 0xB4BCC6, roughness: 0.5 }), tailM = new T.MeshStandardMaterial({ color: new T.Color(color || '#2C8CFF'), roughness: 0.4 });
  // the fuselage along x from the nose (0) to the tail (L), like the full model
  const fus = new T.Mesh(new T.CylinderGeometry(s.w / 2, s.w / 2.6, s.L, 10, 1), body); fus.rotation.z = Math.PI / 2; fus.position.set(s.L / 2, s.ground + s.h / 2, 0); g.add(fus);
  // swept, tapered wings and tail as flat shapes
  const flat = (x0: number, root: number, tip: number, semi: number, sweep: number, y: number, m: any) => {
    const off = semi * Math.tan(sweep * D2R), sh = new T.Shape();
    sh.moveTo(x0 + off, -semi); sh.lineTo(x0 + off + tip, -semi); sh.lineTo(x0 + root, 0); sh.lineTo(x0 + off + tip, semi); sh.lineTo(x0 + off, semi); sh.lineTo(x0, 0); sh.lineTo(x0 + off, -semi);
    const mesh = new T.Mesh(new T.ShapeGeometry(sh), m); mesh.rotation.x = Math.PI / 2; mesh.position.y = y; m.side = T.DoubleSide; g.add(mesh); return mesh;
  };
  flat(s.wing.x, s.wing.root, s.wing.tip, s.span / 2, s.wing.sweep, s.ground + s.h * (s.wing.z > 0.5 ? 0.95 : 0.2), wingM);
  const fin = new T.Mesh(new T.BoxGeometry(s.fin.root * 0.8, s.H - s.ground - s.h, 0.3), tailM); fin.position.set(s.fin.x + s.fin.root * 0.6, s.ground + s.h + (s.H - s.ground - s.h) / 2, 0); g.add(fin);
  flat(s.stab.x, s.stab.root, s.stab.tip, s.stab.span / 2, s.stab.sweep, s.stab.T ? s.H - 0.4 : s.ground + s.h * 0.6, wingM);
  for (const E of s.eng) for (const side of E.y ? [1, -1] : [1]) { const e = new T.Mesh(new T.CylinderGeometry(E.d / 2, E.d / 2, E.l, 8), wingM); e.rotation.z = Math.PI / 2; e.position.set(E.x + E.l / 2, E.z, -side * E.y); g.add(e); }
  g.userData.lod = true;
  return g;
}
/** Each frame for an aircraft: the full model near the camera, the light one far away. */
function v3dLodStep(P: any) {
  const body = P.model.userData.body; if (!body || !V3d.cam) return;
  const far = V3d.cam.position.distanceTo(P.model.position) > v3dLodDist() && V3d.target !== P.id;
  if (far && !P.lod) { P.lod = v3dLodBuild(P.type, (company((plane(P.reg) || {} as any).companyId) || {} as any).color); P.lod.position.copy(body.position); P.model.add(P.lod); }
  if (P.lod) P.lod.visible = far;
  body.visible = !far;
}
