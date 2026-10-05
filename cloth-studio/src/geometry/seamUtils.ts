import * as THREE from 'three';
import type { PatternPiece, Seam, SeamSide } from '../types';
import { createPlacementMapper } from './placement';

function endpoint3D(piece: PatternPiece, pointId: string): THREE.Vector3 | null {
  const p = piece.points.find((q) => q.id === pointId);
  if (!p) return null;
  return createPlacementMapper(piece)(p);
}

/**
 * Bestimmt die Nahtrichtung automatisch: Seite b wird so zugeordnet, dass die
 * Endpunkte im 3D-Arrangement möglichst nahe beieinander liegen (keine verdrehten Nähte).
 */
export function autoReversed(pieces: PatternPiece[], a: SeamSide, b: SeamSide): boolean {
  const pa = pieces.find((p) => p.id === a.pieceId);
  const pb = pieces.find((p) => p.id === b.pieceId);
  if (!pa || !pb) return false;
  const a0 = endpoint3D(pa, a.fromPointId);
  const a1 = endpoint3D(pa, a.toPointId);
  const b0 = endpoint3D(pb, b.fromPointId);
  const b1 = endpoint3D(pb, b.toPointId);
  if (!a0 || !a1 || !b0 || !b1) return false;
  const straight = a0.distanceTo(b0) + a1.distanceTo(b1);
  const crossed = a0.distanceTo(b1) + a1.distanceTo(b0);
  return crossed < straight;
}

export function seamTouchesPoint(seam: Seam, pieceId: string, pointId: string): boolean {
  const t = (s: SeamSide) => s.pieceId === pieceId && (s.fromPointId === pointId || s.toPointId === pointId);
  return t(seam.a) || t(seam.b);
}
