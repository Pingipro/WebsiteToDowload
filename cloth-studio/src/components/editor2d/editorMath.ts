import { closestTOnCubic, closestTOnLine } from '../../geometry/bezier';
import { getSegments, segmentLength, segmentPoint } from '../../geometry/outline';
import type { PatternPiece, Vec2 } from '../../types';

export interface View {
  x: number;
  y: number;
  /** Pixel pro Zentimeter. */
  k: number;
}

export function screenToWorld(view: View, sx: number, sy: number): Vec2 {
  return { x: (sx - view.x) / view.k, y: (sy - view.y) / view.k };
}

/** Weltkoordinate (cm) → lokale Teilkoordinate. */
export function worldToPiece(piece: PatternPiece, w: Vec2): Vec2 {
  return { x: w.x - piece.offset.x, y: w.y - piece.offset.y };
}

export function snap(v: number, step = 0.1): number {
  return Math.round(v / step) * step;
}

/** Nächster Punkt auf einem Segment (für Punkt einfügen). */
export function closestOnSegment(piece: PatternPiece, segIndex: number, local: Vec2): { t: number; point: Vec2 } {
  const seg = getSegments(piece.points)[segIndex];
  const { t } = seg.curve ? closestTOnCubic(seg.from, seg.curve.c1, seg.curve.c2, seg.to, local) : closestTOnLine(seg.from, seg.to, local);
  return { t, point: segmentPoint(seg, t) };
}

export function segmentInfo(piece: PatternPiece, segIndex: number) {
  const seg = getSegments(piece.points)[segIndex];
  return { length: segmentLength(seg), mid: segmentPoint(seg, 0.5) };
}

export function segmentPath(piece: PatternPiece, segIndex: number): string {
  const seg = getSegments(piece.points)[segIndex];
  const c = seg.curve;
  return c
    ? `M ${seg.from.x} ${seg.from.y} C ${c.c1.x} ${c.c1.y} ${c.c2.x} ${c.c2.y} ${seg.to.x} ${seg.to.y}`
    : `M ${seg.from.x} ${seg.from.y} L ${seg.to.x} ${seg.to.y}`;
}
