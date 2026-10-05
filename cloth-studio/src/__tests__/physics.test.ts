import { describe, expect, it } from 'vitest';
import { buildAvatar, DEFAULT_AVATAR } from '../avatar/avatarModel';
import { AvatarSdf } from '../avatar/avatarSdf';
import { triangulatePiece } from '../geometry/triangulate';
import { DEFAULT_FABRICS } from '../materials/fabricPresets';
import { buildClothTopology } from '../physics/buildCloth';
import { ClothSolver } from '../physics/ClothSolver';
import { SdfColliderBackend } from '../physics/colliders/SdfColliderBackend';
import { GARMENT_PRESETS } from '../patterns/presets';
import type { SimSettings } from '../types';

const SIM: SimSettings = {
  running: true, gravity: 9.81, substeps: 12, seamSpeed: 0.35, seamStiffness: 0.9, selfCollision: true,
  colliderBackend: 'sdf', windEnabled: false, windStrength: 4, windDirection: 200, windTurbulence: 0.5,
  resolution: 2.5, triangulation: 'delaunay',
};

for (const preset of GARMENT_PRESETS) {
  describe(`Simulation: ${preset.name}`, () => {
    it('vernäht und drapiert stabil am Avatar', () => {
      const fabric = DEFAULT_FABRICS[preset.id === 'trousers' ? 1 : 0];
      const { pieces, seams } = preset.build(fabric.id);
      const meshes = new Map(pieces.map((p) => [p.id, triangulatePiece(p, SIM.resolution)]));
      const topo = buildClothTopology(pieces, meshes, new Map([[fabric.id, fabric]]), seams);
      const solver = new ClothSolver(topo, SIM);
      solver.pieces.forEach((r) => solver.setPieceFabric(r.index, fabric));
      const avatar = buildAvatar(DEFAULT_AVATAR);
      solver.setCollider(new SdfColliderBackend(avatar));
      const t0 = performance.now();
      const frames = 420;
      for (let f = 0; f < frames; f++) solver.step(1 / 60);
      const ms = (performance.now() - t0) / frames;
      expect(ms).toBeLessThan(200);

      const sdf = new AvatarSdf(avatar);
      const s = solver.state;
      let inside = 0;
      let minY = Infinity;
      for (let i = 0; i < s.count; i++) {
        expect(Number.isFinite(s.pos[3 * i])).toBe(true);
        if (sdf.eval(s.pos[3 * i], s.pos[3 * i + 1], s.pos[3 * i + 2]) < -0.005) inside++;
        minY = Math.min(minY, s.pos[3 * i + 1]);
      }
      // maximaler verbleibender Nahtabstand
      let seamMax = 0;
      const sp = solver.seams;
      for (let c = 0; c < sp.count; c++) {
        const a = sp.ids[2 * c], b = sp.ids[2 * c + 1];
        seamMax = Math.max(seamMax, Math.hypot(s.pos[3*a]-s.pos[3*b], s.pos[3*a+1]-s.pos[3*b+1], s.pos[3*a+2]-s.pos[3*b+2]));
      }
      expect(inside / s.count).toBeLessThan(0.02);
      expect(seamMax).toBeLessThan(0.06);
      expect(solver.stats.seamProgress).toBeGreaterThan(0.85);
    }, 60_000);
  });
}
