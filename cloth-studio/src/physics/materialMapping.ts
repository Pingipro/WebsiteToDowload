import type { Fabric } from '../types';

/**
 * Abbildung der normierten UI-Stoffparameter auf physikalische XPBD-Größen.
 * Logarithmische Skalen, damit die Regler im gesamten Bereich spürbar wirken.
 */
export function stretchCompliance(f: Fabric): number {
  return Math.pow(10, -7.5 + (1 - f.stretchStiffness) * 5.5);
}

export function bendCompliance(f: Fabric): number {
  return Math.pow(10, -4.5 + (1 - f.bendStiffness) * 5.5);
}

/** g/m² → kg/m² */
export function arealDensity(f: Fabric): number {
  return Math.max(10, f.density) / 1000;
}

/** mm → m, plus Sicherheitsabstand gegen Durchdringen. */
export function collisionThickness(f: Fabric): number {
  return Math.max(0.5, f.thickness) / 1000 + 0.004;
}

export function seamCompliance(stiffness: number): number {
  return Math.pow(10, -8 + (1 - stiffness) * 5);
}
