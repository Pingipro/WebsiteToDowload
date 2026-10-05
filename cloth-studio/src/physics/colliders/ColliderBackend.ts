import type { ColliderBackendKind } from '../../types';
import type { ParticleState } from '../ParticleState';

/**
 * Austauschbares Kollisions-Backend für Stoff ↔ Avatar.
 * Implementierungen: analytisches SDF (schnell, glatt) oder Rapier (WASM-Rigid-Bodies).
 */
export interface ColliderBackend {
  readonly kind: ColliderBackendKind;
  /** Breitphase, einmal pro Frame vor den Substeps. */
  prepare?(state: ParticleState): void;
  /** Projiziert eindringende Partikel auf die Oberfläche und wendet Reibung an. */
  collide(state: ParticleState): void;
  dispose(): void;
}

/**
 * Gemeinsame Kontaktauflösung: schiebt Partikel i entlang n auf Abstand `thickness`
 * und dämpft die tangentiale Bewegung seit dem letzten Substep (Coulomb-artig).
 */
export function resolveContact(s: ParticleState, i: number, dist: number, nx: number, ny: number, nz: number): void {
  const th = s.thickness[i];
  if (dist >= th) return;
  const i3 = i * 3;
  const pen = th - dist;
  const p = s.pos;
  p[i3] += nx * pen;
  p[i3 + 1] += ny * pen;
  p[i3 + 2] += nz * pen;
  // Reibung: tangentiale Verschiebung relativ zur letzten Position reduzieren
  const dx = p[i3] - s.prev[i3];
  const dy = p[i3 + 1] - s.prev[i3 + 1];
  const dz = p[i3 + 2] - s.prev[i3 + 2];
  const dn = dx * nx + dy * ny + dz * nz;
  const tx = dx - dn * nx;
  const ty = dy - dn * ny;
  const tz = dz - dn * nz;
  const tl = Math.sqrt(tx * tx + ty * ty + tz * tz);
  if (tl < 1e-12) return;
  const mu = s.friction[i] * s.frictionScale;
  if (mu <= 0) return;
  // statische Reibung, wenn tangentiale Bewegung klein gegenüber der Eindringtiefe
  const f = tl < mu * pen * 4 ? 1 : Math.min(1, (mu * pen * 4) / tl + mu * 0.5);
  p[i3] -= tx * f;
  p[i3 + 1] -= ty * f;
  p[i3 + 2] -= tz * f;
}
