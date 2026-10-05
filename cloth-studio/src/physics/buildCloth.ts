import * as THREE from 'three';
import { createPlacementMapper } from '../geometry/placement';
import { seamSegmentIndices } from '../geometry/outline';
import type { PieceMesh } from '../geometry/triangulate';
import type { Fabric, PatternPiece, Seam, SeamSide } from '../types';
import { ParticleState } from './ParticleState';
import { arealDensity } from './materialMapping';

/** Partikelbereich eines Schnittteils innerhalb des globalen Partikelarrays. */
export interface PieceRange {
  pieceId: string;
  index: number;
  start: number;
  count: number;
  mesh: PieceMesh;
  /** Lokale Dreiecksindizes (0..count-1) für die Three.js-Geometrie. */
  localIndices: Uint32Array;
}

export interface ClothTopology {
  state: ParticleState;
  pieces: PieceRange[];
  /** Globale Dreiecksindizes aller Teile. */
  triangles: Uint32Array;
  stretch: { pairs: number[]; rest: number[]; piece: number[] };
  bend: { pairs: number[]; rest: number[]; piece: number[] };
  seams: { pairs: number[]; initial: number[]; seamIndex: number[] };
  avgSpacing: number;
}

/** Boundary-Vertices einer Nahtseite in Umlaufrichtung inkl. Endpunkt. */
export function sideBoundaryVertices(piece: PatternPiece, mesh: PieceMesh, side: SeamSide): number[] {
  const segs = seamSegmentIndices(piece, side);
  if (!segs) return [];
  const out: number[] = [];
  for (const s of segs) {
    const from = mesh.segmentStart[s];
    const to = s + 1 < mesh.segmentStart.length ? mesh.segmentStart[s + 1] : mesh.boundaryCount;
    for (let v = from; v < to; v++) out.push(v);
  }
  const last = segs[segs.length - 1];
  out.push(last + 1 < mesh.segmentStart.length ? mesh.segmentStart[last + 1] : 0);
  return out;
}

function arcParams(mesh: PieceMesh, verts: number[]): number[] {
  const P = mesh.positions2D;
  const acc = [0];
  for (let i = 1; i < verts.length; i++) {
    const a = verts[i - 1];
    const b = verts[i];
    acc.push(acc[i - 1] + Math.hypot(P[2 * b] - P[2 * a], P[2 * b + 1] - P[2 * a + 1]));
  }
  const total = acc[acc.length - 1] || 1;
  return acc.map((s) => s / total);
}

/**
 * Ordnet die Partikel zweier Nahtseiten über ihren normierten Bogenlängenparameter
 * einander zu (beidseitig, damit auch ungleich lange Kanten vollständig vernäht werden).
 */
export function pairSeamVertices(paramsA: number[], paramsB: number[], reversed: boolean): [number, number][] {
  const pb = reversed ? paramsB.map((t) => 1 - t) : paramsB;
  const nearest = (t: number, arr: number[]) => {
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < arr.length; i++) {
      const d = Math.abs(arr[i] - t);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  };
  const set = new Map<string, [number, number]>();
  paramsA.forEach((t, i) => {
    const j = nearest(t, pb);
    set.set(`${i}:${j}`, [i, j]);
  });
  pb.forEach((t, j) => {
    const i = nearest(t, paramsA);
    set.set(`${i}:${j}`, [i, j]);
  });
  return [...set.values()];
}

export function buildClothTopology(
  pieces: PatternPiece[],
  meshes: Map<string, PieceMesh>,
  fabrics: Map<string, Fabric>,
  seams: Seam[],
): ClothTopology {
  const active = pieces.filter((p) => p.visible && meshes.has(p.id));
  const total = active.reduce((s, p) => s + meshes.get(p.id)!.vertexCount, 0);
  const state = new ParticleState(total);
  const ranges: PieceRange[] = [];
  const triangles: number[] = [];
  const stretch = { pairs: [] as number[], rest: [] as number[], piece: [] as number[] };
  const bend = { pairs: [] as number[], rest: [] as number[], piece: [] as number[] };
  let spacingSum = 0;
  let spacingCount = 0;

  const tmp = new THREE.Vector3();
  let start = 0;
  active.forEach((piece, pi) => {
    const mesh = meshes.get(piece.id)!;
    const fabric = fabrics.get(piece.fabricId);
    const map = createPlacementMapper(piece);
    const P = mesh.positions2D;
    for (let v = 0; v < mesh.vertexCount; v++) {
      const g = start + v;
      map({ x: P[2 * v], y: P[2 * v + 1] }, tmp);
      state.pos[3 * g] = tmp.x;
      state.pos[3 * g + 1] = tmp.y;
      state.pos[3 * g + 2] = tmp.z;
      state.piece[g] = pi;
      state.rest2D[2 * g] = P[2 * v] / 100;
      state.rest2D[2 * g + 1] = P[2 * v + 1] / 100;
    }
    state.prev.set(state.pos.subarray(start * 3, (start + mesh.vertexCount) * 3), start * 3);

    // Masse aus Dreiecksflächen; Kanten → Dehnung; gemeinsame Kanten → Biegung
    const rho = fabric ? arealDensity(fabric) : 0.15;
    const edgeMap = new Map<number, number>(); // key → gegenüberliegender Vertex
    const I = mesh.indices;
    const n = mesh.vertexCount;
    const dist2D = (a: number, b: number) => Math.hypot(P[2 * a] - P[2 * b], P[2 * a + 1] - P[2 * b + 1]) / 100;
    for (let t = 0; t < I.length; t += 3) {
      const tri = [I[t], I[t + 1], I[t + 2]];
      const [a, b, c] = tri;
      const area = Math.abs((P[2 * b] - P[2 * a]) * (P[2 * c + 1] - P[2 * a + 1]) - (P[2 * c] - P[2 * a]) * (P[2 * b + 1] - P[2 * a + 1])) / 2 / 1e4;
      for (const v of tri) state.mass[start + v] += (area * rho) / 3;
      triangles.push(start + a, start + b, start + c);
      for (let e = 0; e < 3; e++) {
        const i0 = tri[e];
        const i1 = tri[(e + 1) % 3];
        const opp = tri[(e + 2) % 3];
        const key = Math.min(i0, i1) * n + Math.max(i0, i1);
        const other = edgeMap.get(key);
        if (other === undefined) {
          edgeMap.set(key, opp);
          stretch.pairs.push(start + i0, start + i1);
          const r = dist2D(i0, i1);
          stretch.rest.push(r);
          stretch.piece.push(pi);
          spacingSum += r;
          spacingCount++;
        } else if (other >= 0) {
          bend.pairs.push(start + opp, start + other);
          bend.rest.push(dist2D(opp, other));
          bend.piece.push(pi);
          edgeMap.set(key, -1);
        }
      }
    }
    ranges.push({ pieceId: piece.id, index: pi, start, count: mesh.vertexCount, mesh, localIndices: mesh.indices });
    start += mesh.vertexCount;
  });

  // Vertices ohne Dreieck (z. B. sehr spitze Ecken, die beim Triangulieren entfallen)
  // erhalten die Durchschnittsmasse – sonst würden sie wie fixierte Pins wirken.
  let massSum = 0;
  let massCount = 0;
  for (let i = 0; i < total; i++)
    if (state.mass[i] > 0) {
      massSum += state.mass[i];
      massCount++;
    }
  const avgMass = massCount ? massSum / massCount : 1e-4;
  for (let i = 0; i < total; i++) {
    if (state.mass[i] <= 0) state.mass[i] = avgMass;
    state.invMass[i] = 1 / state.mass[i];
  }

  // Nähte
  const seamOut = { pairs: [] as number[], initial: [] as number[], seamIndex: [] as number[] };
  const rangeById = new Map(ranges.map((r) => [r.pieceId, r]));
  const pieceById = new Map(active.map((p) => [p.id, p]));
  seams.forEach((seam, si) => {
    const ra = rangeById.get(seam.a.pieceId);
    const rb = rangeById.get(seam.b.pieceId);
    const pa = pieceById.get(seam.a.pieceId);
    const pb = pieceById.get(seam.b.pieceId);
    if (!ra || !rb || !pa || !pb) return;
    const va = sideBoundaryVertices(pa, ra.mesh, seam.a);
    const vb = sideBoundaryVertices(pb, rb.mesh, seam.b);
    if (va.length < 2 || vb.length < 2) return;
    const pairs = pairSeamVertices(arcParams(ra.mesh, va), arcParams(rb.mesh, vb), seam.reversed);
    for (const [i, j] of pairs) {
      const ga = ra.start + va[i];
      const gb = rb.start + vb[j];
      if (ga === gb) continue;
      state.onSeam[ga] = 1;
      state.onSeam[gb] = 1;
      seamOut.pairs.push(ga, gb);
      seamOut.initial.push(
        Math.hypot(state.pos[3 * ga] - state.pos[3 * gb], state.pos[3 * ga + 1] - state.pos[3 * gb + 1], state.pos[3 * ga + 2] - state.pos[3 * gb + 2]),
      );
      seamOut.seamIndex.push(si);
    }
  });

  return {
    state,
    pieces: ranges,
    triangles: Uint32Array.from(triangles),
    stretch,
    bend,
    seams: seamOut,
    avgSpacing: spacingCount ? spacingSum / spacingCount : 0.025,
  };
}
