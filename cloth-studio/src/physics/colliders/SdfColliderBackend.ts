import { AvatarSdf } from '../../avatar/avatarSdf';
import type { AvatarModel } from '../../avatar/avatarModel';
import type { ParticleState } from '../ParticleState';
import { resolveContact, type ColliderBackend } from './ColliderBackend';

/** Maximale Anzahl Kandidaten-Primitive je Partikel (Breitphase). */
const MAX_CANDIDATES = 8;
/** Suchradius der Breitphase: maximale Bewegung pro Frame + Glättung + Dicke. */
const BROAD_MARGIN = 0.12;
/** Schrittweite für den numerischen SDF-Gradienten (m). */
const GRAD_EPS = 0.002;

/**
 * Kollision gegen die glatte SDF-Vereinigung des Avatars (identisch zur Darstellung).
 * Breitphase einmal pro Frame (Kandidatenlisten je Partikel), Engphase je Substep.
 */
export class SdfColliderBackend implements ColliderBackend {
  readonly kind = 'sdf' as const;
  private readonly sdf: AvatarSdf;
  private candidates = new Int16Array(0);
  private candidateCount = new Uint8Array(0);
  private readonly lb = new Float64Array(64);

  constructor(model: AvatarModel) {
    this.sdf = new AvatarSdf(model);
  }

  prepare(s: ParticleState): void {
    if (this.candidateCount.length !== s.count) {
      this.candidates = new Int16Array(s.count * MAX_CANDIDATES);
      this.candidateCount = new Uint8Array(s.count);
    }
    const sdf = this.sdf;
    const n = sdf.primitiveCount;
    const p = s.pos;
    for (let i = 0; i < s.count; i++) {
      const x = p[3 * i], y = p[3 * i + 1], z = p[3 * i + 2];
      let c = 0;
      if (!sdf.outsideBounds(x, y, z, BROAD_MARGIN)) {
        const base = i * MAX_CANDIDATES;
        for (let k = 0; k < n; k++) {
          const lb = sdf.lowerBound(k, x, y, z);
          if (lb > BROAD_MARGIN) continue;
          if (c < MAX_CANDIDATES) {
            this.candidates[base + c] = k;
            this.lb[c] = lb;
            c++;
          } else {
            // schlechtesten Kandidaten ersetzen
            let worst = 0;
            for (let m = 1; m < c; m++) if (this.lb[m] > this.lb[worst]) worst = m;
            if (lb < this.lb[worst]) {
              this.candidates[base + worst] = k;
              this.lb[worst] = lb;
            }
          }
        }
      }
      this.candidateCount[i] = c;
    }
  }

  collide(s: ParticleState): void {
    const p = s.pos;
    const sdf = this.sdf;
    const cand = this.candidates;
    const cnt = this.candidateCount;
    if (cnt.length !== s.count) return;
    for (let i = 0; i < s.count; i++) {
      const c = cnt[i];
      if (c === 0 || s.invMass[i] === 0) continue;
      const i3 = i * 3;
      const x = p[i3], y = p[i3 + 1], z = p[i3 + 2];
      const off = i * MAX_CANDIDATES;
      const d = sdf.evalSubset(x, y, z, cand, off, c);
      if (d >= s.thickness[i]) continue;
      // Exakte Normale per Tetraeder-Gradient (robust in Sattel-/Übergangsbereichen
      // der Smooth-Union, z. B. im Schritt oder in der Achsel)
      const e = GRAD_EPS;
      const k0 = sdf.evalSubset(x + e, y - e, z - e, cand, off, c);
      const k1 = sdf.evalSubset(x - e, y - e, z + e, cand, off, c);
      const k2 = sdf.evalSubset(x - e, y + e, z - e, cand, off, c);
      const k3 = sdf.evalSubset(x + e, y + e, z + e, cand, off, c);
      let nx = k0 - k1 - k2 + k3;
      let ny = -k0 - k1 + k2 + k3;
      let nz = -k0 + k1 - k2 + k3;
      const nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (nl < 1e-12) continue;
      nx /= nl;
      ny /= nl;
      nz /= nl;
      resolveContact(s, i, d, nx, ny, nz);
    }
  }

  dispose(): void {}
}
