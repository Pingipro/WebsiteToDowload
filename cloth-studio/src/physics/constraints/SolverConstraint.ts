import type { ParticleState } from '../ParticleState';

/**
 * Schnittstelle für alle Bedingungen im XPBD-Substep-Loop.
 * Neue Physikkomponenten (z. B. Anisotropie, Pins, Knöpfe) implementieren dieses
 * Interface und werden im `ClothSolver` registriert.
 */
export interface SolverConstraint {
  readonly name: string;
  enabled: boolean;
  /** Wird einmal pro Frame vor den Substeps aufgerufen (z. B. Nachbarsuche). */
  prepare?(s: ParticleState, frameDt: number): void;
  solve(s: ParticleState, dt: number): void;
}
