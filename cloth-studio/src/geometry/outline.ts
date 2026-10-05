import type { PatternPiece, PatternPoint, SeamSide, Vec2 } from '../types';
import { cubicPoint } from './bezier';

/** Ein Segment des geschlossenen Umrisses (von Punkt i zu Punkt i+1). */
export interface Segment {
  index: number;
  from: PatternPoint;
  to: PatternPoint;
  curve: PatternPoint['curve'];
}

export function getSegments(points: PatternPoint[]): Segment[] {
  return points.map((p, i) => ({ index: i, from: p, to: points[(i + 1) % points.length], curve: p.curve }));
}

export function segmentPoint(seg: Segment, t: number): Vec2 {
  if (seg.curve) return cubicPoint(seg.from, seg.curve.c1, seg.curve.c2, seg.to, t);
  return { x: seg.from.x + (seg.to.x - seg.from.x) * t, y: seg.from.y + (seg.to.y - seg.from.y) * t };
}

/** Polylinien-Approximation eines Segments (inkl. Start, exkl. Ende). */
export function flattenSegment(seg: Segment, steps = 24): Vec2[] {
  if (!seg.curve) return [{ x: seg.from.x, y: seg.from.y }];
  const out: Vec2[] = [];
  for (let i = 0; i < steps; i++) out.push(segmentPoint(seg, i / steps));
  return out;
}

export function segmentLength(seg: Segment): number {
  if (!seg.curve) return Math.hypot(seg.to.x - seg.from.x, seg.to.y - seg.from.y);
  let len = 0;
  let prev = segmentPoint(seg, 0);
  const N = 32;
  for (let i = 1; i <= N; i++) {
    const p = segmentPoint(seg, i / N);
    len += Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = p;
  }
  return len;
}

/** Gleichmäßige Abtastung eines Segments nach Bogenlänge (inkl. Start, exkl. Ende). */
export function resampleSegment(seg: Segment, spacing: number): Vec2[] {
  const len = segmentLength(seg);
  const n = Math.max(1, Math.round(len / spacing));
  if (!seg.curve) {
    const out: Vec2[] = [];
    for (let i = 0; i < n; i++) out.push(segmentPoint(seg, i / n));
    return out;
  }
  // Kumulative Längentabelle für Bogenlängen-Parametrisierung
  const N = 64;
  const table: { t: number; s: number }[] = [{ t: 0, s: 0 }];
  let prev = segmentPoint(seg, 0);
  let acc = 0;
  for (let i = 1; i <= N; i++) {
    const t = i / N;
    const p = segmentPoint(seg, t);
    acc += Math.hypot(p.x - prev.x, p.y - prev.y);
    table.push({ t, s: acc });
    prev = p;
  }
  const out: Vec2[] = [];
  let j = 0;
  for (let i = 0; i < n; i++) {
    const target = (i / n) * acc;
    while (j < N && table[j + 1].s < target) j++;
    const a = table[j];
    const b = table[Math.min(j + 1, N)];
    const f = b.s > a.s ? (target - a.s) / (b.s - a.s) : 0;
    out.push(segmentPoint(seg, a.t + (b.t - a.t) * f));
  }
  return out;
}

export function flattenOutline(points: PatternPoint[], steps = 24): Vec2[] {
  return getSegments(points).flatMap((s) => flattenSegment(s, steps));
}

/** Vorzeichenbehaftete Fläche (positiv = im Uhrzeigersinn bei y nach unten). */
export function signedArea(poly: Vec2[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

export function pointInPolygon(p: Vec2, poly: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function distanceToPolyline(p: Vec2, poly: Vec2[]): number {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l2 = dx * dx + dy * dy || 1e-12;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
    const d = Math.hypot(a.x + dx * t - p.x, a.y + dy * t - p.y);
    if (d < best) best = d;
  }
  return best;
}

export function bounds(poly: Vec2[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of poly) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, w: maxX - minX, h: maxY - minY };
}

/** SVG-Pfad eines Schnittteils (Teilkoordinaten). */
export function outlineToSvgPath(points: PatternPoint[]): string {
  if (points.length === 0) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (const seg of getSegments(points)) {
    if (seg.curve) d += ` C ${seg.curve.c1.x} ${seg.curve.c1.y} ${seg.curve.c2.x} ${seg.curve.c2.y} ${seg.to.x} ${seg.to.y}`;
    else d += ` L ${seg.to.x} ${seg.to.y}`;
  }
  return d + ' Z';
}

/** Segment-Indizes einer Nahtseite in Umlaufrichtung (from … to). */
export function seamSegmentIndices(piece: PatternPiece, side: SeamSide): number[] | null {
  const n = piece.points.length;
  const a = piece.points.findIndex((p) => p.id === side.fromPointId);
  const b = piece.points.findIndex((p) => p.id === side.toPointId);
  if (a < 0 || b < 0 || a === b) return null;
  const out: number[] = [];
  for (let i = a; i !== b; i = (i + 1) % n) out.push(i);
  return out;
}

/**
 * Normalisiert eine Kantenauswahl zwischen zwei Punkt-IDs auf den kürzeren
 * Umlaufweg, so dass from → to in Umlaufrichtung liegt.
 */
export function normalizeSide(piece: PatternPiece, p1: string, p2: string): SeamSide {
  const n = piece.points.length;
  const a = piece.points.findIndex((p) => p.id === p1);
  const b = piece.points.findIndex((p) => p.id === p2);
  const forward = (b - a + n) % n;
  const backward = (a - b + n) % n;
  return forward <= backward
    ? { pieceId: piece.id, fromPointId: p1, toPointId: p2 }
    : { pieceId: piece.id, fromPointId: p2, toPointId: p1 };
}

export function seamSidePolyline(piece: PatternPiece, side: SeamSide): Vec2[] {
  const idx = seamSegmentIndices(piece, side);
  if (!idx) return [];
  const segs = getSegments(piece.points);
  const out: Vec2[] = [];
  for (const i of idx) out.push(...flattenSegment(segs[i], 24));
  const last = segs[idx[idx.length - 1]].to;
  out.push({ x: last.x, y: last.y });
  return out;
}

export function seamSideLength(piece: PatternPiece, side: SeamSide): number {
  const idx = seamSegmentIndices(piece, side);
  if (!idx) return 0;
  const segs = getSegments(piece.points);
  return idx.reduce((s, i) => s + segmentLength(segs[i]), 0);
}
