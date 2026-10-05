import type RAPIER_NS from '@dimforge/rapier3d-compat';
import type { AvatarModel, AvatarPrimitive } from '../../avatar/avatarModel';
import type { ParticleState } from '../ParticleState';
import { resolveContact, type ColliderBackend } from './ColliderBackend';

type Rapier = typeof RAPIER_NS;

let rapierPromise: Promise<Rapier> | null = null;

/** Lädt und initialisiert das Rapier-WASM-Modul einmalig (Code-Splitting via dynamic import). */
export function loadRapier(): Promise<Rapier> {
  if (!rapierPromise) {
    rapierPromise = import('@dimforge/rapier3d-compat').then(async (mod) => {
      const R = (mod as unknown as { default?: Rapier }).default ?? (mod as unknown as Rapier);
      await R.init();
      return R;
    });
  }
  return rapierPromise;
}

interface Entry {
  collider: RAPIER_NS.Collider;
  /** Achsensegment und maximaler Radius für die analytische Vorprüfung. */
  ax: number;
  ay: number;
  az: number;
  dx: number;
  dy: number;
  dz: number;
  invLen2: number;
  rMax: number;
  /** Hüllkugel zur Vorfilterung der Abfragen. */
  cx: number;
  cy: number;
  cz: number;
  r: number;
}

/**
 * Avatar als statischer Rapier-Rigid-Body mit konvexen Kollidern
 * (Kugel / Kapsel / konvexe Hülle eines Round Cones).
 * Stoffpartikel werden per `Collider.projectPoint` gegen die Körper aufgelöst.
 */
export class RapierColliderBackend implements ColliderBackend {
  readonly kind = 'rapier' as const;
  private readonly world: RAPIER_NS.World;
  private readonly entries: Entry[] = [];
  private readonly proj: RAPIER_NS.PointProjection;
  private readonly q = { x: 0, y: 0, z: 0 };
  private static readonly MAX_CANDIDATES = 10;
  private candidates = new Int16Array(0);
  private candidateCount = new Uint8Array(0);

  constructor(R: Rapier, model: AvatarModel) {
    this.world = new R.World({ x: 0, y: -9.81, z: 0 });
    const body = this.world.createRigidBody(R.RigidBodyDesc.fixed());
    for (const prim of model.primitives) {
      const desc = this.colliderDesc(R, prim);
      if (!desc) continue;
      const collider = this.world.createCollider(desc, body);
      const half = Math.hypot(prim.b[0] - prim.a[0], prim.b[1] - prim.a[1], prim.b[2] - prim.a[2]) / 2;
      const dx = prim.b[0] - prim.a[0];
      const dy = prim.b[1] - prim.a[1];
      const dz = prim.b[2] - prim.a[2];
      const l2 = dx * dx + dy * dy + dz * dz;
      this.entries.push({
        collider,
        ax: prim.a[0],
        ay: prim.a[1],
        az: prim.a[2],
        dx,
        dy,
        dz,
        invLen2: l2 > 1e-12 ? 1 / l2 : 0,
        rMax: Math.max(prim.ra, prim.rb),
        cx: (prim.a[0] + prim.b[0]) / 2,
        cy: (prim.a[1] + prim.b[1]) / 2,
        cz: (prim.a[2] + prim.b[2]) / 2,
        r: half + Math.max(prim.ra, prim.rb),
      });
    }
    this.proj = new R.PointProjection({ x: 0, y: 0, z: 0 }, false);
  }

  private colliderDesc(R: Rapier, p: AvatarPrimitive): RAPIER_NS.ColliderDesc | null {
    const dx = p.b[0] - p.a[0];
    const dy = p.b[1] - p.a[1];
    const dz = p.b[2] - p.a[2];
    const len = Math.hypot(dx, dy, dz);
    const mid = { x: (p.a[0] + p.b[0]) / 2, y: (p.a[1] + p.b[1]) / 2, z: (p.a[2] + p.b[2]) / 2 };
    if (len < 1e-6) return R.ColliderDesc.ball(Math.max(p.ra, p.rb)).setTranslation(mid.x, mid.y, mid.z);
    if (Math.abs(p.ra - p.rb) < 1e-4) {
      // Kapsel entlang lokaler y-Achse → auf Segmentrichtung drehen
      const ux = dx / len, uy = dy / len, uz = dz / len;
      // Quaternion von (0,1,0) nach u
      let qx = uz, qy = 0, qz = -ux, qw = 1 + uy;
      const ql = Math.hypot(qx, qy, qz, qw);
      if (ql < 1e-6) {
        qx = 1; qy = 0; qz = 0; qw = 0;
      } else {
        qx /= ql; qy /= ql; qz /= ql; qw /= ql;
      }
      return R.ColliderDesc.capsule(len / 2, p.ra).setTranslation(mid.x, mid.y, mid.z).setRotation({ x: qx, y: qy, z: qz, w: qw });
    }
    // Round Cone → konvexe Hülle zweier Kugeln
    const pts: number[] = [];
    const N = 10;
    for (const [c, r] of [[p.a, p.ra], [p.b, p.rb]] as const) {
      for (let i = 0; i <= N; i++) {
        const th = (i / N) * Math.PI;
        for (let j = 0; j < 2 * N; j++) {
          const ph = (j / (2 * N)) * Math.PI * 2;
          pts.push(c[0] + r * Math.sin(th) * Math.cos(ph), c[1] + r * Math.cos(th), c[2] + r * Math.sin(th) * Math.sin(ph));
        }
      }
    }
    return R.ColliderDesc.convexHull(new Float32Array(pts));
  }

  /** Breitphase: Kollider-Kandidaten je Partikel einmal pro Frame bestimmen. */
  prepare(s: ParticleState): void {
    const M = RapierColliderBackend.MAX_CANDIDATES;
    if (this.candidateCount.length !== s.count) {
      this.candidates = new Int16Array(s.count * M);
      this.candidateCount = new Uint8Array(s.count);
    }
    const p = s.pos;
    for (let i = 0; i < s.count; i++) {
      const x = p[3 * i], y = p[3 * i + 1], z = p[3 * i + 2];
      let c = 0;
      for (let k = 0; k < this.entries.length && c < M; k++) {
        const e = this.entries[k];
        const dx = x - e.cx, dy = y - e.cy, dz = z - e.cz;
        if (Math.sqrt(dx * dx + dy * dy + dz * dz) - e.r > 0.1) continue;
        this.candidates[i * M + c++] = k;
      }
      this.candidateCount[i] = c;
    }
  }

  collide(s: ParticleState): void {
    const M = RapierColliderBackend.MAX_CANDIDATES;
    if (this.candidateCount.length !== s.count) return;
    const p = s.pos;
    const q = this.q;
    const proj = this.proj;
    for (let i = 0; i < s.count; i++) {
      const cnt = this.candidateCount[i];
      if (cnt === 0 || s.invMass[i] === 0) continue;
      const i3 = i * 3;
      const x = p[i3], y = p[i3 + 1], z = p[i3 + 2];
      const th = s.thickness[i];
      let best = Infinity;
      let bnx = 0, bny = 1, bnz = 0;
      for (let c = 0; c < cnt; c++) {
        const e = this.entries[this.candidates[i * M + c]];
        // Analytische Vorprüfung: Abstand zur Achse minus Maximalradius
        const px = x - e.ax, py = y - e.ay, pz = z - e.az;
        const t = Math.max(0, Math.min(1, (px * e.dx + py * e.dy + pz * e.dz) * e.invLen2));
        const qx = px - e.dx * t, qy = py - e.dy * t, qz = pz - e.dz * t;
        if (Math.sqrt(qx * qx + qy * qy + qz * qz) - e.rMax > th) continue;
        q.x = x; q.y = y; q.z = z;
        const r = e.collider.projectPoint(q, false, proj);
        if (!r) continue;
        let nx = x - r.point.x, ny = y - r.point.y, nz = z - r.point.z;
        let d = Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (d < 1e-9) continue;
        nx /= d; ny /= d; nz /= d;
        if (r.isInside) {
          d = -d;
          nx = -nx; ny = -ny; nz = -nz;
        }
        if (d < best) {
          best = d;
          bnx = nx; bny = ny; bnz = nz;
        }
      }
      if (best < th) resolveContact(s, i, best, bnx, bny, bnz);
    }
  }

  dispose(): void {
    this.world.free();
  }
}
