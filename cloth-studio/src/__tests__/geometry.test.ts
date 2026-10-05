import { describe, expect, it } from 'vitest';
import { cubicPoint, splitCubic } from '../geometry/bezier';
import { flattenOutline, normalizeSide, seamSegmentIndices, signedArea } from '../geometry/outline';
import { triangulatePiece } from '../geometry/triangulate';
import { pairSeamVertices, sideBoundaryVertices } from '../physics/buildCloth';
import { mirrorPoints, T_SHIRT } from '../patterns/presets';
import type { PatternPiece } from '../types';

const square = (size = 40): PatternPiece => ({
  id: 'sq',
  name: 'Quadrat',
  points: [
    { id: 'a', x: 0, y: 0 },
    { id: 'b', x: size, y: 0 },
    { id: 'c', x: size, y: size },
    { id: 'd', x: 0, y: size },
  ],
  offset: { x: 0, y: 0 },
  fabricId: 'f',
  placement: { origin: [0, 1, 0.3], radius: 0, angle: 0, tilt: [0, 0, 0] },
  visible: true,
});

describe('Bezier', () => {
  it('teilt eine Kurve exakt am Parameter t', () => {
    const p0 = { x: 0, y: 0 }, c1 = { x: 10, y: 20 }, c2 = { x: 30, y: 20 }, p3 = { x: 40, y: 0 };
    const { left, right } = splitCubic(p0, c1, c2, p3, 0.3);
    const m = cubicPoint(p0, c1, c2, p3, 0.3);
    expect(left.p3.x).toBeCloseTo(m.x);
    expect(right.p0.y).toBeCloseTo(m.y);
    const q = cubicPoint(right.p0, right.c1, right.c2, right.p3, 0.5);
    const r = cubicPoint(p0, c1, c2, p3, 0.65);
    expect(q.x).toBeCloseTo(r.x, 5);
    expect(q.y).toBeCloseTo(r.y, 5);
  });
});

describe('Triangulierung', () => {
  it('erzeugt ein flächentreues Netz mit Randvertices in Umlaufrichtung', () => {
    const mesh = triangulatePiece(square(), 2.5);
    let area = 0;
    const P = mesh.positions2D;
    for (let t = 0; t < mesh.indices.length; t += 3) {
      const [a, b, c] = [mesh.indices[t], mesh.indices[t + 1], mesh.indices[t + 2]];
      area += Math.abs((P[2 * b] - P[2 * a]) * (P[2 * c + 1] - P[2 * a + 1]) - (P[2 * c] - P[2 * a]) * (P[2 * b + 1] - P[2 * a + 1])) / 2;
    }
    expect(area).toBeCloseTo(1600, 0);
    expect(mesh.boundaryCount).toBe(64);
    expect(Array.from(mesh.segmentStart)).toEqual([0, 16, 32, 48]);
    expect(mesh.vertexCount).toBeGreaterThan(mesh.boundaryCount);
  });

  it('trianguliert konkave Teile ohne Dreiecke außerhalb', () => {
    const front = T_SHIRT.build('f').pieces[0];
    const mesh = triangulatePiece(front, 2.5);
    const outline = flattenOutline(front.points, 32);
    const outlineArea = Math.abs(signedArea(outline));
    let area = 0;
    const P = mesh.positions2D;
    for (let t = 0; t < mesh.indices.length; t += 3) {
      const [a, b, c] = [mesh.indices[t], mesh.indices[t + 1], mesh.indices[t + 2]];
      area += Math.abs((P[2 * b] - P[2 * a]) * (P[2 * c + 1] - P[2 * a + 1]) - (P[2 * c] - P[2 * a]) * (P[2 * b + 1] - P[2 * a + 1])) / 2;
    }
    expect(Math.abs(area - outlineArea) / outlineArea).toBeLessThan(0.02);
  });

  it('Earcut-Modus liefert ein gültiges Randnetz', () => {
    const mesh = triangulatePiece(square(), 5, 'earcut');
    expect(mesh.vertexCount).toBe(mesh.boundaryCount);
    expect(mesh.indices.length / 3).toBe(mesh.boundaryCount - 2);
  });
});

describe('Nähte', () => {
  it('normalisiert Kantenzüge auf den kürzeren Umlaufweg', () => {
    const sq = square();
    const side = normalizeSide(sq, 'c', 'b');
    expect(side).toEqual({ pieceId: 'sq', fromPointId: 'b', toPointId: 'c' });
    expect(seamSegmentIndices(sq, side)).toEqual([1]);
  });

  it('ordnet Nahtvertices über die Bogenlänge zu (inkl. Umkehrung)', () => {
    const params = [0, 0.25, 0.5, 0.75, 1];
    expect(pairSeamVertices(params, params, false)).toEqual(expect.arrayContaining([[0, 0], [4, 4], [2, 2]]));
    const rev = pairSeamVertices(params, params, true);
    expect(rev).toEqual(expect.arrayContaining([[0, 4], [4, 0]]));
  });

  it('liefert Randvertices einer Seite inklusive Endpunkt', () => {
    const sq = square();
    const mesh = triangulatePiece(sq, 2.5);
    const v = sideBoundaryVertices(sq, mesh, { pieceId: 'sq', fromPointId: 'd', toPointId: 'a' });
    expect(v[0]).toBe(48);
    expect(v[v.length - 1]).toBe(0);
    expect(v.length).toBe(17);
  });
});

describe('Spiegeln', () => {
  it('spiegelt Teile inkl. Bezierkurven und erhält die Fläche', () => {
    const front = T_SHIRT.build('f').pieces[0];
    const mirrored = mirrorPoints(front.points);
    const a1 = Math.abs(signedArea(flattenOutline(front.points, 32)));
    const a2 = Math.abs(signedArea(flattenOutline(mirrored, 32)));
    expect(a2).toBeCloseTo(a1, 1);
    expect(mirrored.map((p) => p.id).sort()).toEqual(front.points.map((p) => p.id).sort());
  });
});
