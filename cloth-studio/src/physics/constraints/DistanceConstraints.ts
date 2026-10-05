import type { ParticleState } from '../ParticleState';
import type { SolverConstraint } from './SolverConstraint';

/**
 * XPBD-Abstandsbedingungen (Gauss-Seidel). Wird für Dehnung (Mesh-Kanten),
 * Biegung (gegenüberliegende Vertices benachbarter Dreiecke) und Nähte verwendet.
 *
 *   Δλ = −(C + α̃·λ) / (w₁ + w₂ + α̃),   α̃ = compliance / Δt²
 * (λ wird je Substep zurückgesetzt – "Small Steps"-Variante, daher entfällt der λ-Term.)
 */
export class DistanceConstraints implements SolverConstraint {
  readonly name: string;
  readonly ids: Uint32Array;
  readonly rest: Float32Array;
  readonly compliance: Float32Array;
  /** Teil-Index je Bedingung (für Live-Updates der Materialparameter). */
  readonly piece: Int32Array;
  /** Maximale Korrektur je Substep (m); 0 = unbegrenzt. */
  maxCorrection = 0;
  enabled = true;

  constructor(name: string, pairs: number[], rest: number[], piece: number[]) {
    this.name = name;
    this.ids = Uint32Array.from(pairs);
    this.rest = Float32Array.from(rest);
    this.compliance = new Float32Array(rest.length);
    this.piece = Int32Array.from(piece);
  }

  get count(): number {
    return this.rest.length;
  }

  solve(s: ParticleState, dt: number): void {
    if (!this.enabled) return;
    const p = s.pos;
    const w = s.invMass;
    const ids = this.ids;
    const rest = this.rest;
    const comp = this.compliance;
    const maxC = this.maxCorrection;
    const idt2 = 1 / (dt * dt);
    for (let c = 0; c < rest.length; c++) {
      const a = ids[2 * c];
      const b = ids[2 * c + 1];
      const wa = w[a];
      const wb = w[b];
      const wsum = wa + wb;
      if (wsum === 0) continue;
      const a3 = a * 3;
      const b3 = b * 3;
      let dx = p[a3] - p[b3];
      let dy = p[a3 + 1] - p[b3 + 1];
      let dz = p[a3 + 2] - p[b3 + 2];
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (len < 1e-9) continue;
      dx /= len;
      dy /= len;
      dz /= len;
      const C = len - rest[c];
      let lambda = -C / (wsum + comp[c] * idt2);
      if (maxC > 0) {
        const corr = Math.abs(lambda) * wsum;
        if (corr > maxC) lambda *= maxC / corr;
      }
      p[a3] += dx * lambda * wa;
      p[a3 + 1] += dy * lambda * wa;
      p[a3 + 2] += dz * lambda * wa;
      p[b3] -= dx * lambda * wb;
      p[b3 + 1] -= dy * lambda * wb;
      p[b3 + 2] -= dz * lambda * wb;
    }
  }
}
