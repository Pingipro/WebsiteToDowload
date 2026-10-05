import * as THREE from 'three';
import type { PatternPiece, Vec2 } from '../types';
import { bounds, flattenOutline } from './outline';

const DEG = Math.PI / 180;

/**
 * Erzeugt eine Abbildung von 2D-Teilkoordinaten (cm) auf 3D-Weltkoordinaten (m),
 * indem das Teil um einen (geneigten) Zylinder gewickelt wird.
 */
export function createPlacementMapper(piece: PatternPiece) {
  const b = bounds(flattenOutline(piece.points, 8));
  const { origin, radius, angle, tilt } = piece.placement;
  const rot = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(tilt[0] * DEG, tilt[1] * DEG, tilt[2] * DEG, 'XYZ'));
  const o = new THREE.Vector3(...origin);
  const theta0 = angle * DEG;
  const v = new THREE.Vector3();

  return (p: Vec2, out: THREE.Vector3 = new THREE.Vector3()): THREE.Vector3 => {
    const lx = (p.x - b.cx) / 100;
    const ly = -(p.y - b.cy) / 100; // 2D y nach unten → 3D nach oben
    if (radius > 1e-4) {
      const th = theta0 + lx / radius;
      v.set(radius * Math.sin(th), ly, radius * Math.cos(th));
    } else {
      // planar: Ebene senkrecht zur Blickrichtung theta0
      v.set(lx * Math.cos(theta0), ly, -lx * Math.sin(theta0));
    }
    v.applyMatrix4(rot);
    return out.copy(v).add(o);
  };
}
