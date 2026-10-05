import type { ParticleState } from '../ParticleState';
import type { SolverConstraint } from './SolverConstraint';

/**
 * Partikelbasierte Selbstkollision mit dichtem Spatial Hash
 * (nach M. Müller, "Ten Minute Physics"). Die Nachbarsuche läuft einmal pro Frame,
 * das Auseinanderdrücken in jedem Substep.
 */
export class SelfCollision implements SolverConstraint {
  readonly name = 'self-collision';
  enabled = true;
  /** Mindestabstand zweier Stofflagen (m). */
  distance: number;

  private tableSize: number;
  private cellStart: Int32Array;
  private cellEntries: Int32Array;
  private pairs = new Int32Array(1024);
  private pairCount = 0;

  constructor(count: number, distance: number) {
    this.distance = distance;
    this.tableSize = Math.max(64, count * 2);
    this.cellStart = new Int32Array(this.tableSize + 1);
    this.cellEntries = new Int32Array(Math.max(1, count));
  }

  private hash(xi: number, yi: number, zi: number): number {
    const h = (Math.imul(xi, 92837111) ^ Math.imul(yi, 689287499) ^ Math.imul(zi, 283923481)) >>> 0;
    return h % this.tableSize;
  }

  prepare(s: ParticleState): void {
    if (!this.enabled) return;
    const n = s.count;
    const spacing = this.distance;
    const p = s.pos;
    const start = this.cellStart;
    start.fill(0);
    for (let i = 0; i < n; i++) {
      const h = this.hash(Math.floor(p[3 * i] / spacing), Math.floor(p[3 * i + 1] / spacing), Math.floor(p[3 * i + 2] / spacing));
      start[h]++;
    }
    let acc = 0;
    for (let i = 0; i < this.tableSize; i++) {
      acc += start[i];
      start[i] = acc;
    }
    start[this.tableSize] = acc;
    for (let i = 0; i < n; i++) {
      const h = this.hash(Math.floor(p[3 * i] / spacing), Math.floor(p[3 * i + 1] / spacing), Math.floor(p[3 * i + 2] / spacing));
      start[h]--;
      this.cellEntries[start[h]] = i;
    }

    // Paare innerhalb von 1.5 · distance sammeln
    this.pairCount = 0;
    const maxD = spacing * 1.5;
    const maxD2 = maxD * maxD;
    const exclude2 = (spacing * 2.2) ** 2;
    for (let i = 0; i < n; i++) {
      if (s.invMass[i] === 0) continue;
      const x = p[3 * i], y = p[3 * i + 1], z = p[3 * i + 2];
      const x0 = Math.floor((x - maxD) / spacing), x1 = Math.floor((x + maxD) / spacing);
      const y0 = Math.floor((y - maxD) / spacing), y1 = Math.floor((y + maxD) / spacing);
      const z0 = Math.floor((z - maxD) / spacing), z1 = Math.floor((z + maxD) / spacing);
      for (let xi = x0; xi <= x1; xi++)
        for (let yi = y0; yi <= y1; yi++)
          for (let zi = z0; zi <= z1; zi++) {
            const h = this.hash(xi, yi, zi);
            for (let e = start[h]; e < start[h + 1]; e++) {
              const j = this.cellEntries[e];
              if (j <= i) continue;
              const dx = p[3 * j] - x, dy = p[3 * j + 1] - y, dz = p[3 * j + 2] - z;
              if (dx * dx + dy * dy + dz * dz > maxD2) continue;
              // Nachbarn im selben Teil (Ruheabstand klein) ausschließen
              if (s.piece[i] === s.piece[j]) {
                const rx = s.rest2D[2 * i] - s.rest2D[2 * j];
                const ry = s.rest2D[2 * i + 1] - s.rest2D[2 * j + 1];
                if (rx * rx + ry * ry < exclude2) continue;
              }
              if (s.onSeam[i] && s.onSeam[j]) continue;
              this.pushPair(i, j);
            }
          }
    }
  }

  private pushPair(i: number, j: number) {
    if (this.pairCount * 2 + 2 > this.pairs.length) {
      const next = new Int32Array(this.pairs.length * 2);
      next.set(this.pairs);
      this.pairs = next;
    }
    this.pairs[this.pairCount * 2] = i;
    this.pairs[this.pairCount * 2 + 1] = j;
    this.pairCount++;
  }

  get activePairs(): number {
    return this.pairCount;
  }

  solve(s: ParticleState): void {
    if (!this.enabled) return;
    const p = s.pos;
    const w = s.invMass;
    const d = this.distance;
    for (let k = 0; k < this.pairCount; k++) {
      const i = this.pairs[2 * k];
      const j = this.pairs[2 * k + 1];
      const wsum = w[i] + w[j];
      if (wsum === 0) continue;
      const i3 = i * 3, j3 = j * 3;
      let dx = p[j3] - p[i3], dy = p[j3 + 1] - p[i3 + 1], dz = p[j3 + 2] - p[i3 + 2];
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (len >= d || len < 1e-9) continue;
      const corr = (d - len) / len / wsum;
      dx *= corr;
      dy *= corr;
      dz *= corr;
      p[i3] -= dx * w[i];
      p[i3 + 1] -= dy * w[i];
      p[i3 + 2] -= dz * w[i];
      p[j3] += dx * w[j];
      p[j3 + 1] += dy * w[j];
      p[j3 + 2] += dz * w[j];
    }
  }
}
