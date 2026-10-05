import { buildAvatar, type AvatarModel } from '../avatar/avatarModel';
import { triangulatePiece, type PieceMesh } from '../geometry/triangulate';
import type { StudioState } from '../store/useStudioStore';
import type { AvatarSettings, ColliderBackendKind } from '../types';
import { buildClothTopology } from './buildCloth';
import { ClothSolver } from './ClothSolver';
import type { ColliderBackend } from './colliders/ColliderBackend';
import { loadRapier, RapierColliderBackend } from './colliders/RapierColliderBackend';
import { SdfColliderBackend } from './colliders/SdfColliderBackend';

type Listener = () => void;

/**
 * Brücke zwischen Zustand (Zustand-Store) und Physik: trianguliert Schnittteile,
 * baut den Solver auf, hält das Kollisions-Backend und informiert die 3D-Ansicht
 * über Neuaufbauten. Bewusst außerhalb von React, damit die Simulation nicht an
 * Render-Zyklen gekoppelt ist.
 */
export class SimulationController {
  solver: ClothSolver | null = null;
  avatar: AvatarModel;
  /** Inkrementiert bei jedem Neuaufbau (für useSyncExternalStore). */
  version = 0;
  backendStatus: { kind: ColliderBackendKind; state: 'ready' | 'loading' | 'error'; message?: string } = { kind: 'sdf', state: 'ready' };

  private listeners = new Set<Listener>();
  private meshCache = new Map<string, { key: string; mesh: PieceMesh }>();
  private avatarKey = '';
  private backendRequest = 0;

  constructor() {
    this.avatar = buildAvatar({ height: 1.75, girth: 1, skinColor: '#fff' });
  }

  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  getVersion = () => this.version;

  private emit() {
    this.version++;
    this.listeners.forEach((l) => l());
  }

  /** Trianguliert (mit Cache) und baut den Stoffsolver komplett neu auf. */
  rebuild(s: StudioState): void {
    const meshes = new Map<string, PieceMesh>();
    for (const piece of s.pieces) {
      const key = JSON.stringify([piece.points, s.sim.resolution, s.sim.triangulation]);
      const cached = this.meshCache.get(piece.id);
      if (cached && cached.key === key) {
        meshes.set(piece.id, cached.mesh);
      } else {
        const mesh = triangulatePiece(piece, s.sim.resolution, s.sim.triangulation);
        this.meshCache.set(piece.id, { key, mesh });
        meshes.set(piece.id, mesh);
      }
    }
    const fabrics = new Map(s.fabrics.map((f) => [f.id, f]));
    const topo = buildClothTopology(s.pieces, meshes, fabrics, s.seams);
    const solver = new ClothSolver(topo, s.sim);
    solver.pieces.forEach((r) => {
      const piece = s.pieces.find((p) => p.id === r.pieceId)!;
      const fabric = fabrics.get(piece.fabricId) ?? s.fabrics[0];
      solver.setPieceFabric(r.index, fabric);
    });
    const oldCollider = this.solver?.collider ?? null;
    if (this.solver) this.solver.collider = null; // Backend wird übernommen
    solver.collider = oldCollider;
    this.solver = solver;
    if (!oldCollider) void this.setBackend(s.sim.colliderBackend, s.avatar);
    this.emit();
  }

  getMesh(pieceId: string): PieceMesh | undefined {
    return this.meshCache.get(pieceId)?.mesh;
  }

  applyFabrics(s: StudioState): void {
    const solver = this.solver;
    if (!solver) return;
    const fabrics = new Map(s.fabrics.map((f) => [f.id, f]));
    for (const r of solver.pieces) {
      const piece = s.pieces.find((p) => p.id === r.pieceId);
      const f = piece && fabrics.get(piece.fabricId);
      if (f) solver.setPieceFabric(r.index, f);
    }
  }

  /** Aktualisiert Avatar-Geometrie und Kollider; liefert true, wenn sich etwas geändert hat. */
  updateAvatar(settings: AvatarSettings, backend: ColliderBackendKind): boolean {
    const key = `${settings.height}|${settings.girth}`;
    if (key === this.avatarKey) return false;
    this.avatarKey = key;
    this.avatar = buildAvatar(settings);
    void this.setBackend(backend, settings, true);
    this.emit();
    return true;
  }

  async setBackend(kind: ColliderBackendKind, _settings: AvatarSettings, force = false): Promise<void> {
    if (!force && this.solver?.collider?.kind === kind) return;
    const req = ++this.backendRequest;
    let backend: ColliderBackend;
    if (kind === 'rapier') {
      this.backendStatus = { kind, state: 'loading' };
      this.emit();
      try {
        const R = await loadRapier();
        if (req !== this.backendRequest) return;
        backend = new RapierColliderBackend(R, this.avatar);
        this.backendStatus = { kind, state: 'ready' };
      } catch (err) {
        console.error(err);
        this.backendStatus = { kind: 'sdf', state: 'error', message: 'Rapier konnte nicht geladen werden – SDF-Fallback aktiv.' };
        backend = new SdfColliderBackend(this.avatar);
      }
    } else {
      backend = new SdfColliderBackend(this.avatar);
      this.backendStatus = { kind, state: 'ready' };
    }
    if (req !== this.backendRequest) {
      backend.dispose();
      return;
    }
    if (this.solver) this.solver.setCollider(backend);
    else backend.dispose();
    this.emit();
  }

  step(dt: number): void {
    this.solver?.step(dt);
  }
}

export const simulation = new SimulationController();
