import Delaunator from 'delaunator';
import earcut from 'earcut';
import type { PatternPiece } from '../types';
import { distanceToPolyline, flattenOutline, getSegments, pointInPolygon, resampleSegment } from './outline';

/**
 * Trianguliertes Schnittteil. Die ersten `boundaryCount` Vertices liegen in
 * Umlaufreihenfolge auf dem Umriss – das ermöglicht die Zuordnung von Nähten.
 */
export interface PieceMesh {
  pieceId: string;
  /** x,y in cm (Teilkoordinaten). */
  positions2D: Float32Array;
  indices: Uint32Array;
  vertexCount: number;
  boundaryCount: number;
  /** Boundary-Index des ersten Vertex jedes Segments (Länge = Punktanzahl). */
  segmentStart: Int32Array;
}

export type TriangulationMode = 'delaunay' | 'earcut';

/**
 * Wandelt den Vektor-Umriss in ein gleichmäßiges Dreiecksnetz um.
 *
 * - `delaunay`: Rand nach Bogenlänge abgetastet + versetztes Innengitter, per
 *   Delaunator trianguliert; Dreiecke außerhalb des (ggf. konkaven) Umrisses werden
 *   verworfen. Liefert nahezu gleichseitige Dreiecke – ideal für Stoffsimulation.
 * - `earcut`: Ohrenschneide-Verfahren nur auf dem Rand (schnelle, grobe Vorschau).
 */
export function triangulatePiece(piece: PatternPiece, resolution: number, mode: TriangulationMode = 'delaunay'): PieceMesh {
  const segs = getSegments(piece.points);
  const boundary: number[] = [];
  const segmentStart = new Int32Array(segs.length);
  for (const seg of segs) {
    segmentStart[seg.index] = boundary.length / 2;
    for (const p of resampleSegment(seg, resolution)) boundary.push(p.x, p.y);
  }
  const boundaryCount = boundary.length / 2;

  if (mode === 'earcut' || boundaryCount < 3) {
    const tris = earcut(boundary);
    return {
      pieceId: piece.id,
      positions2D: new Float32Array(boundary),
      indices: new Uint32Array(tris),
      vertexCount: boundaryCount,
      boundaryCount,
      segmentStart,
    };
  }

  const outline = flattenOutline(piece.points, 32);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of outline) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }

  // Versetztes (hexagonales) Gitter für gleichseitige Dreiecke
  const coords = boundary.slice();
  const dy = resolution * Math.sqrt(3) / 2;
  let row = 0;
  for (let y = minY + dy * 0.5; y < maxY; y += dy, row++) {
    const shift = row % 2 ? resolution / 2 : 0;
    for (let x = minX + shift; x < maxX; x += resolution) {
      const p = { x, y };
      if (!pointInPolygon(p, outline)) continue;
      if (distanceToPolyline(p, outline) < resolution * 0.55) continue;
      coords.push(x, y);
    }
  }

  const del = new Delaunator(Float64Array.from(coords));
  const tri = del.triangles;
  const keep: number[] = [];
  for (let t = 0; t < tri.length; t += 3) {
    const a = tri[t];
    const b = tri[t + 1];
    const c = tri[t + 2];
    const ax = coords[2 * a], ay = coords[2 * a + 1];
    const bx = coords[2 * b], by = coords[2 * b + 1];
    const cx = coords[2 * c], cy = coords[2 * c + 1];
    const centroid = { x: (ax + bx + cx) / 3, y: (ay + by + cy) / 3 };
    if (!pointInPolygon(centroid, outline)) continue;
    // Kanten-Mittelpunkte prüfen (konkave Bereiche wie Schritt- oder Armlochkurven)
    const mids = [
      { x: (ax + bx) / 2, y: (ay + by) / 2 },
      { x: (bx + cx) / 2, y: (by + cy) / 2 },
      { x: (cx + ax) / 2, y: (cy + ay) / 2 },
    ];
    if (mids.some((m) => !pointInPolygon(m, outline) && distanceToPolyline(m, outline) > resolution * 0.05)) continue;
    const area = Math.abs((bx - ax) * (cy - ay) - (cx - ax) * (by - ay)) / 2;
    if (area < resolution * resolution * 1e-3) continue;
    keep.push(a, b, c);
  }

  if (keep.length === 0) {
    const tris = earcut(boundary);
    return {
      pieceId: piece.id,
      positions2D: new Float32Array(boundary),
      indices: new Uint32Array(tris),
      vertexCount: boundaryCount,
      boundaryCount,
      segmentStart,
    };
  }

  return {
    pieceId: piece.id,
    positions2D: new Float32Array(coords),
    indices: new Uint32Array(keep),
    vertexCount: coords.length / 2,
    boundaryCount,
    segmentStart,
  };
}
