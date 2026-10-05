import type { AvatarSettings, Vec3 } from '../types';

/**
 * Parametrischer Mannequin-Avatar aus "Round Cones" (Kapseln mit zwei Radien).
 * Dieselben Primitive dienen
 *  - als glatte SDF-Vereinigung für Darstellung und SDF-Kollision,
 *  - als konvexe Rapier-Kollider (Rigid Body Colliders).
 */
export interface AvatarPrimitive {
  name: string;
  a: Vec3;
  b: Vec3;
  ra: number;
  rb: number;
}

export interface AvatarModel {
  primitives: AvatarPrimitive[];
  /** Glättungsradius der SDF-Vereinigung (m). */
  blend: number;
  bboxMin: Vec3;
  bboxMax: Vec3;
}

export const DEFAULT_AVATAR: AvatarSettings = { height: 1.75, girth: 1, skinColor: '#d9d4cc' };

export function buildAvatar(settings: AvatarSettings): AvatarModel {
  const hs = settings.height / 1.75;
  const g = settings.girth;
  const P = (name: string, a: Vec3, b: Vec3, ra: number, rb = ra, girthScaled = true): AvatarPrimitive => {
    const gx = girthScaled ? g : 1;
    return {
      name,
      a: [a[0] * gx, a[1] * hs, a[2] * gx],
      b: [b[0] * gx, b[1] * hs, b[2] * gx],
      ra: ra * (girthScaled ? g : 1),
      rb: rb * (girthScaled ? g : 1),
    };
  };

  const prims: AvatarPrimitive[] = [];
  // Kopf & Hals
  prims.push(P('Kopf', [0, 1.635, 0.0], [0, 1.66, 0.0], 0.092, 0.092, false));
  prims.push(P('Kiefer', [0, 1.6, 0.01], [0, 1.56, 0.03], 0.075, 0.06, false));
  prims.push(P('Hals', [0, 1.43, -0.005], [0, 1.54, 0.0], 0.058, 0.05));
  // Rumpf
  prims.push(P('Schultern', [-0.155, 1.405, -0.01], [0.155, 1.405, -0.01], 0.06));
  prims.push(P('Brustkorb', [-0.085, 1.3, 0.0], [0.085, 1.3, 0.0], 0.125, 0.125));
  prims.push(P('Brust L', [0.085, 1.28, 0.045], [0.085, 1.25, 0.06], 0.075, 0.07));
  prims.push(P('Brust R', [-0.085, 1.28, 0.045], [-0.085, 1.25, 0.06], 0.075, 0.07));
  prims.push(P('Oberbauch', [-0.07, 1.17, 0.0], [0.07, 1.17, 0.0], 0.12));
  prims.push(P('Taille', [-0.06, 1.05, 0.0], [0.06, 1.05, 0.0], 0.112));
  prims.push(P('Wirbelsäule', [0, 0.98, -0.01], [0, 1.36, -0.01], 0.1, 0.11));
  prims.push(P('Hüfte', [-0.085, 0.93, -0.005], [0.085, 0.93, -0.005], 0.13));
  prims.push(P('Gesäß L', [0.07, 0.89, -0.04], [0.07, 0.85, -0.05], 0.1, 0.085));
  prims.push(P('Gesäß R', [-0.07, 0.89, -0.04], [-0.07, 0.85, -0.05], 0.1, 0.085));
  // Beine
  for (const s of [1, -1] as const) {
    const side = s > 0 ? 'L' : 'R';
    prims.push(P(`Oberschenkel ${side}`, [0.095 * s, 0.86, 0.0], [0.125 * s, 0.5, 0.005], 0.082, 0.055));
    prims.push(P(`Knie ${side}`, [0.125 * s, 0.5, 0.005], [0.13 * s, 0.44, 0.0], 0.055, 0.051));
    prims.push(P(`Wade ${side}`, [0.13 * s, 0.44, -0.005], [0.14 * s, 0.09, -0.01], 0.053, 0.034));
    prims.push(P(`Fuß ${side}`, [0.145 * s, 0.055, -0.035], [0.16 * s, 0.035, 0.13], 0.04, 0.03));
    // Arme (A-Pose, ca. 45° abgespreizt)
    prims.push(P(`Schulterkugel ${side}`, [0.17 * s, 1.39, -0.01], [0.19 * s, 1.37, -0.01], 0.058, 0.055));
    prims.push(P(`Oberarm ${side}`, [0.19 * s, 1.37, -0.01], [0.385 * s, 1.165, -0.01], 0.05, 0.039));
    prims.push(P(`Unterarm ${side}`, [0.385 * s, 1.165, -0.01], [0.565 * s, 0.975, 0.0], 0.037, 0.028));
    prims.push(P(`Hand ${side}`, [0.57 * s, 0.965, 0.0], [0.63 * s, 0.9, 0.012], 0.03, 0.024));
  }

  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of prims) {
    for (const [c, r] of [[p.a, p.ra], [p.b, p.rb]] as const) {
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k], c[k] - r);
        max[k] = Math.max(max[k], c[k] + r);
      }
    }
  }
  return { primitives: prims, blend: 0.035, bboxMin: min, bboxMax: max };
}
