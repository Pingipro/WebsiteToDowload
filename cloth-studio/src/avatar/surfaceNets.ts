import * as THREE from 'three';
import type { AvatarSdf } from './avatarSdf';

/**
 * Polygonisiert das Avatar-SDF mit "Naive Surface Nets" zu einem glatten,
 * geschlossenen Mesh (ein Vertex pro Zelle mit Vorzeichenwechsel).
 */
export function meshSdf(sdf: AvatarSdf, cell = 0.012): THREE.BufferGeometry {
  const pad = 0.05;
  const ox = sdf.min[0] - pad;
  const oy = Math.max(-0.01, sdf.min[1] - pad);
  const oz = sdf.min[2] - pad;
  const nx = Math.ceil((sdf.max[0] + pad - ox) / cell) + 1;
  const ny = Math.ceil((sdf.max[1] + pad - oy) / cell) + 1;
  const nz = Math.ceil((sdf.max[2] + pad - oz) / cell) + 1;

  const field = new Float32Array(nx * ny * nz);
  const idx = (i: number, j: number, k: number) => i + nx * (j + ny * k);
  for (let k = 0; k < nz; k++)
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) field[idx(i, j, k)] = sdf.eval(ox + i * cell, oy + j * cell, oz + k * cell);

  const cellVertex = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const cidx = (i: number, j: number, k: number) => i + (nx - 1) * (j + (ny - 1) * k);
  const positions: number[] = [];
  const normals: number[] = [];

  const corners = [
    [0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0],
    [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1],
  ];
  const edges = [
    [0, 1], [2, 3], [4, 5], [6, 7],
    [0, 2], [1, 3], [4, 6], [5, 7],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  const vals = new Float32Array(8);

  for (let k = 0; k < nz - 1; k++)
    for (let j = 0; j < ny - 1; j++)
      for (let i = 0; i < nx - 1; i++) {
        let mask = 0;
        for (let c = 0; c < 8; c++) {
          const [di, dj, dk] = corners[c];
          vals[c] = field[idx(i + di, j + dj, k + dk)];
          if (vals[c] < 0) mask |= 1 << c;
        }
        if (mask === 0 || mask === 255) continue;
        let sx = 0, sy = 0, sz = 0, cnt = 0;
        for (const [e0, e1] of edges) {
          const v0 = vals[e0];
          const v1 = vals[e1];
          if (v0 < 0 === v1 < 0) continue;
          const t = v0 / (v0 - v1);
          const c0 = corners[e0];
          const c1 = corners[e1];
          sx += c0[0] + (c1[0] - c0[0]) * t;
          sy += c0[1] + (c1[1] - c0[1]) * t;
          sz += c0[2] + (c1[2] - c0[2]) * t;
          cnt++;
        }
        const px = ox + (i + sx / cnt) * cell;
        const py = oy + (j + sy / cnt) * cell;
        const pz = oz + (k + sz / cnt) * cell;
        // Vertex auf die exakte Oberfläche projizieren
        const d = sdf.eval(px, py, pz);
        const fx = px - sdf.nx * d;
        const fy = py - sdf.ny * d;
        const fz = pz - sdf.nz * d;
        sdf.eval(fx, fy, fz);
        cellVertex[cidx(i, j, k)] = positions.length / 3;
        positions.push(fx, fy, fz);
        normals.push(sdf.nx, sdf.ny, sdf.nz);
      }

  const indices: number[] = [];
  const quad = (a: number, b: number, c: number, d: number, flip: boolean) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) indices.push(a, c, b, a, d, c);
    else indices.push(a, b, c, a, c, d);
  };
  for (let k = 1; k < nz - 1; k++)
    for (let j = 1; j < ny - 1; j++)
      for (let i = 1; i < nx - 1; i++) {
        const v0 = field[idx(i, j, k)];
        // x-Kante
        const vx = field[idx(i + 1, j, k)];
        if (v0 < 0 !== vx < 0)
          quad(cellVertex[cidx(i, j - 1, k - 1)], cellVertex[cidx(i, j, k - 1)], cellVertex[cidx(i, j, k)], cellVertex[cidx(i, j - 1, k)], v0 < 0);
        const vy = field[idx(i, j + 1, k)];
        if (v0 < 0 !== vy < 0)
          quad(cellVertex[cidx(i - 1, j, k - 1)], cellVertex[cidx(i - 1, j, k)], cellVertex[cidx(i, j, k)], cellVertex[cidx(i, j, k - 1)], v0 < 0);
        const vz = field[idx(i, j, k + 1)];
        if (v0 < 0 !== vz < 0)
          quad(cellVertex[cidx(i - 1, j - 1, k)], cellVertex[cidx(i, j - 1, k)], cellVertex[cidx(i, j, k)], cellVertex[cidx(i - 1, j, k)], v0 < 0);
      }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setIndex(indices);
  return geo;
}
