import type { Fabric, SimSettings } from '../types';
import type { ClothTopology, PieceRange } from './buildCloth';
import type { ColliderBackend } from './colliders/ColliderBackend';
import { DistanceConstraints } from './constraints/DistanceConstraints';
import { SelfCollision } from './constraints/SelfCollision';
import type { SolverConstraint } from './constraints/SolverConstraint';
import { arealDensity, bendCompliance, collisionThickness, seamCompliance, stretchCompliance } from './materialMapping';
import type { ParticleState } from './ParticleState';

const AIR_DENSITY = 1.2;
const MAX_SPEED = 8;
const SEWING_GRAVITY = 0;
const SEWING_MAX_TIME = 3;
const SEAM_CLOSED_DIST = 0.015;

export interface SolverStats {
  particles: number;
  triangles: number;
  stretch: number;
  bend: number;
  seams: number;
  selfPairs: number;
  stepMs: number;
  simTime: number;
  seamProgress: number;
}

/**
 * XPBD-Stoffsolver ("Small Steps"): pro Frame N Substeps mit je einer
 * Gauss-Seidel-Iteration über alle Bedingungen.
 *
 * Reihenfolge je Substep:
 *   Integration (Schwerkraft + Wind) → Dehnung → Biegung → Nähte →
 *   Selbstkollision → Avatar-Kollision (+Reibung) → Boden → Geschwindigkeitsupdate
 */
export class ClothSolver {
  readonly state: ParticleState;
  readonly pieces: PieceRange[];
  readonly triangles: Uint32Array;
  readonly stretch: DistanceConstraints;
  readonly bend: DistanceConstraints;
  readonly seams: DistanceConstraints;
  readonly selfCollision: SelfCollision;
  readonly seamInitial: Float32Array;
  readonly seamIndex: Int32Array;
  /** Zusätzliche, erweiterbare Bedingungen (laufen nach den Nähten). */
  readonly extraConstraints: SolverConstraint[] = [];

  collider: ColliderBackend | null = null;
  settings: SimSettings;
  simTime = 0;
  stats: SolverStats;

  private grabIndex = -1;
  private grabInvMass = 0;
  private grabTarget = [0, 0, 0];
  private readonly initialPos: Float32Array;

  constructor(topo: ClothTopology, settings: SimSettings) {
    this.state = topo.state;
    this.pieces = topo.pieces;
    this.triangles = topo.triangles;
    this.settings = settings;
    this.stretch = new DistanceConstraints('stretch', topo.stretch.pairs, topo.stretch.rest, topo.stretch.piece);
    this.bend = new DistanceConstraints('bend', topo.bend.pairs, topo.bend.rest, topo.bend.piece);
    this.seams = new DistanceConstraints('seams', topo.seams.pairs, topo.seams.initial, topo.seams.seamIndex);
    this.seams.maxCorrection = 0.004;
    this.seamInitial = Float32Array.from(topo.seams.initial);
    this.seamIndex = Int32Array.from(topo.seams.seamIndex);
    this.selfCollision = new SelfCollision(this.state.count, Math.max(0.007, topo.avgSpacing * 0.4));
    this.initialPos = Float32Array.from(this.state.pos);
    this.stats = {
      particles: this.state.count,
      triangles: this.triangles.length / 3,
      stretch: this.stretch.count,
      bend: this.bend.count,
      seams: this.seams.count,
      selfPairs: 0,
      stepMs: 0,
      simTime: 0,
      seamProgress: 0,
    };
    this.applySettings(settings);
  }

  /** Überträgt die Stoffparameter eines Teils live auf Partikel und Bedingungen. */
  setPieceFabric(pieceIndex: number, f: Fabric): void {
    const r = this.pieces[pieceIndex];
    if (!r) return;
    const s = this.state;
    const th = collisionThickness(f);
    const ratio = arealDensity(f);
    for (let i = r.start; i < r.start + r.count; i++) {
      s.thickness[i] = th;
      s.friction[i] = f.friction;
      s.damping[i] = f.damping;
    }
    // Masse proportional zur Dichte neu skalieren (Fläche bleibt gleich)
    this.rescaleMass(r, ratio);
    const sc = stretchCompliance(f);
    const bc = bendCompliance(f);
    for (let c = 0; c < this.stretch.count; c++) if (this.stretch.piece[c] === pieceIndex) this.stretch.compliance[c] = sc;
    for (let c = 0; c < this.bend.count; c++) if (this.bend.piece[c] === pieceIndex) this.bend.compliance[c] = bc;
  }

  private massDensity = new Map<number, number>();
  private rescaleMass(r: PieceRange, density: number) {
    const prevDensity = this.massDensity.get(r.index);
    const s = this.state;
    if (prevDensity !== undefined && prevDensity !== density) {
      const k = density / prevDensity;
      for (let i = r.start; i < r.start + r.count; i++) {
        s.mass[i] *= k;
        if (i !== this.grabIndex) s.invMass[i] = s.mass[i] > 0 ? 1 / s.mass[i] : 0;
      }
    }
    this.massDensity.set(r.index, density);
  }

  applySettings(settings: SimSettings): void {
    this.settings = settings;
    this.selfCollision.enabled = settings.selfCollision;
    const sc = seamCompliance(settings.seamStiffness);
    this.seams.compliance.fill(sc);
  }

  setCollider(backend: ColliderBackend | null): void {
    this.collider?.dispose();
    this.collider = backend;
  }

  reset(): void {
    this.state.pos.set(this.initialPos);
    this.state.prev.set(this.initialPos);
    this.state.vel.fill(0);
    this.simTime = 0;
  }

  // --- Interaktives Ziehen am Stoff ------------------------------------------------
  grab(index: number, x: number, y: number, z: number): void {
    this.release();
    this.grabIndex = index;
    this.grabInvMass = this.state.invMass[index];
    this.state.invMass[index] = 0;
    this.moveGrab(x, y, z);
  }

  moveGrab(x: number, y: number, z: number): void {
    this.grabTarget[0] = x;
    this.grabTarget[1] = y;
    this.grabTarget[2] = z;
  }

  release(): void {
    if (this.grabIndex >= 0) {
      this.state.invMass[this.grabIndex] = this.grabInvMass;
      this.state.vel.fill(0, this.grabIndex * 3, this.grabIndex * 3 + 3);
    }
    this.grabIndex = -1;
  }

  nearestParticle(x: number, y: number, z: number, pieceIndex?: number): number {
    const p = this.state.pos;
    let best = -1;
    let bd = Infinity;
    const from = pieceIndex !== undefined ? this.pieces[pieceIndex].start : 0;
    const to = pieceIndex !== undefined ? from + this.pieces[pieceIndex].count : this.state.count;
    for (let i = from; i < to; i++) {
      const d = (p[3 * i] - x) ** 2 + (p[3 * i + 1] - y) ** 2 + (p[3 * i + 2] - z) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  }

  // --- Simulation -------------------------------------------------------------------
  step(frameDt: number): void {
    const t0 = performance.now();
    const st = this.settings;
    const s = this.state;
    const n = s.count;
    const substeps = Math.max(1, Math.round(st.substeps));
    const dt = frameDt / substeps;

    // Nähte: Ruhelänge schrittweise auf 0 ziehen (vermeidet Explosionen beim Vernähen)
    const shrink = st.seamSpeed * this.simTime;
    let closed = 0;
    const P = s.pos;
    const ids = this.seams.ids;
    for (let c = 0; c < this.seams.count; c++) {
      this.seams.rest[c] = Math.max(0, this.seamInitial[c] - shrink);
      const a = ids[2 * c] * 3;
      const b = ids[2 * c + 1] * 3;
      const dx = P[a] - P[b], dy = P[a + 1] - P[b + 1], dz = P[a + 2] - P[b + 2];
      if (dx * dx + dy * dy + dz * dz < SEAM_CLOSED_DIST * SEAM_CLOSED_DIST) closed++;
    }
    this.stats.seamProgress = this.seams.count ? closed / this.seams.count : 1;

    this.computeAerodynamics();
    this.selfCollision.prepare(s);
    this.collider?.prepare?.(s);
    for (const c of this.extraConstraints) c.prepare?.(s, frameDt);

    // Nähphase: solange Nähte noch offen sind, wirkt nur reduzierte Schwerkraft
    // (vgl. CLO: Teile werden zuerst vernäht, dann drapiert).
    const sewing = this.stats.seamProgress < 0.97 && this.simTime < SEWING_MAX_TIME;
    const g = -st.gravity * (sewing ? SEWING_GRAVITY : 1);
    s.frictionScale = sewing ? 0 : 1;
    const pos = s.pos;
    const prev = s.prev;
    const vel = s.vel;
    const acc = s.accel;
    for (let sub = 0; sub < substeps; sub++) {
      for (let i = 0; i < n; i++) {
        const i3 = i * 3;
        prev[i3] = pos[i3];
        prev[i3 + 1] = pos[i3 + 1];
        prev[i3 + 2] = pos[i3 + 2];
        if (s.invMass[i] === 0) continue;
        vel[i3] += acc[i3] * dt;
        vel[i3 + 1] += (g + acc[i3 + 1]) * dt;
        vel[i3 + 2] += acc[i3 + 2] * dt;
        pos[i3] += vel[i3] * dt;
        pos[i3 + 1] += vel[i3 + 1] * dt;
        pos[i3 + 2] += vel[i3 + 2] * dt;
      }
      if (this.grabIndex >= 0) {
        const k = this.grabIndex * 3;
        pos[k] = this.grabTarget[0];
        pos[k + 1] = this.grabTarget[1];
        pos[k + 2] = this.grabTarget[2];
      }

      this.stretch.solve(s, dt);
      this.bend.solve(s, dt);
      this.seams.solve(s, dt);
      for (const c of this.extraConstraints) c.solve(s, dt);
      this.selfCollision.solve(s);
      this.collider?.collide(s);
      this.collideGround();

      const idt = 1 / dt;
      for (let i = 0; i < n; i++) {
        const i3 = i * 3;
        if (s.invMass[i] === 0) {
          vel[i3] = vel[i3 + 1] = vel[i3 + 2] = 0;
          continue;
        }
        const damp = Math.exp(-s.damping[i] * dt);
        let vx = (pos[i3] - prev[i3]) * idt * damp;
        let vy = (pos[i3 + 1] - prev[i3 + 1]) * idt * damp;
        let vz = (pos[i3 + 2] - prev[i3 + 2]) * idt * damp;
        const sp = Math.sqrt(vx * vx + vy * vy + vz * vz);
        if (sp > MAX_SPEED) {
          const k = MAX_SPEED / sp;
          vx *= k;
          vy *= k;
          vz *= k;
        }
        vel[i3] = vx;
        vel[i3 + 1] = vy;
        vel[i3 + 2] = vz;
      }
    }

    this.simTime += frameDt;
    this.stats.selfPairs = this.selfCollision.activePairs;
    this.stats.simTime = this.simTime;
    this.stats.stepMs = this.stats.stepMs * 0.9 + (performance.now() - t0) * 0.1;
  }

  private collideGround(): void {
    const s = this.state;
    const p = s.pos;
    for (let i = 0; i < s.count; i++) {
      const y = p[3 * i + 1];
      const th = s.thickness[i];
      if (y < th) {
        p[3 * i + 1] = th;
        // Bodenreibung
        p[3 * i] -= (p[3 * i] - s.prev[3 * i]) * 0.8;
        p[3 * i + 2] -= (p[3 * i + 2] - s.prev[3 * i + 2]) * 0.8;
      }
    }
  }

  /**
   * Aerodynamik je Dreieck: Kraft ∝ Fläche · (v_rel · n) · n, verteilt auf die Ecken.
   * Erzeugt Luftwiderstand und – bei aktivem Wind – flatternde Bewegungen.
   */
  private computeAerodynamics(): void {
    const s = this.state;
    const st = this.settings;
    const acc = s.accel;
    acc.fill(0);
    const p = s.pos;
    const v = s.vel;
    const T = this.triangles;
    let wx = 0, wz = 0;
    if (st.windEnabled) {
      const a = (st.windDirection * Math.PI) / 180;
      wx = Math.sin(a) * st.windStrength;
      wz = Math.cos(a) * st.windStrength;
    }
    const time = this.simTime;
    const turb = st.windEnabled ? st.windTurbulence : 0;
    const drag = 0.5 * AIR_DENSITY * 0.6;
    for (let t = 0; t < T.length; t += 3) {
      const a = T[t], b = T[t + 1], c = T[t + 2];
      const a3 = a * 3, b3 = b * 3, c3 = c * 3;
      const e1x = p[b3] - p[a3], e1y = p[b3 + 1] - p[a3 + 1], e1z = p[b3 + 2] - p[a3 + 2];
      const e2x = p[c3] - p[a3], e2y = p[c3 + 1] - p[a3 + 1], e2z = p[c3 + 2] - p[a3 + 2];
      // Kreuzprodukt = 2·Fläche·n
      let nx = e1y * e2z - e1z * e2y;
      let ny = e1z * e2x - e1x * e2z;
      let nz = e1x * e2y - e1y * e2x;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (len < 1e-12) continue;
      const area = len / 2;
      nx /= len;
      ny /= len;
      nz /= len;
      const cx = (p[a3] + p[b3] + p[c3]) / 3;
      const cy = (p[a3 + 1] + p[b3 + 1] + p[c3 + 1]) / 3;
      const gust = turb > 0 ? 1 + turb * (Math.sin(time * 2.3 + cx * 3.1 + cy * 2.2) * 0.6 + Math.sin(time * 5.7 - cy * 4.3) * 0.4) : 1;
      const rvx = wx * gust - (v[a3] + v[b3] + v[c3]) / 3;
      const rvy = turb * Math.sin(time * 3.1 + cx * 5) * 0.3 * st.windStrength - (v[a3 + 1] + v[b3 + 1] + v[c3 + 1]) / 3;
      const rvz = wz * gust - (v[a3 + 2] + v[b3 + 2] + v[c3 + 2]) / 3;
      const vn = rvx * nx + rvy * ny + rvz * nz;
      const f = (drag * area * vn * Math.abs(vn)) / 3;
      const fx = f * nx, fy = f * ny, fz = f * nz;
      for (const i of [a, b, c]) {
        const w = s.invMass[i];
        acc[3 * i] += fx * w;
        acc[3 * i + 1] += fy * w;
        acc[3 * i + 2] += fz * w;
      }
    }
  }
}
