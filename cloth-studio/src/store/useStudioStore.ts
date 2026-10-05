import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { DEFAULT_AVATAR } from '../avatar/avatarModel';
import { splitCubic } from '../geometry/bezier';
import { normalizeSide } from '../geometry/outline';
import { autoReversed, seamTouchesPoint } from '../geometry/seamUtils';
import { DEFAULT_FABRICS } from '../materials/fabricPresets';
import { GARMENT_PRESETS, T_SHIRT } from '../patterns/presets';
import type {
  AvatarSettings,
  EditorTool,
  Fabric,
  PatternPiece,
  Placement,
  Seam,
  SeamSide,
  SimSettings,
  Vec2,
  ViewSettings,
} from '../types';
import { SEAM_COLORS, uid } from '../utils/id';

export interface Selection {
  pieceId: string | null;
  pointId: string | null;
  seamId: string | null;
}

/** Erste Kante, die im Nähwerkzeug gewählt wurde (wartet auf Gegenstück). */
export interface PendingSeam {
  side: SeamSide;
}

export interface StudioState {
  pieces: PatternPiece[];
  seams: Seam[];
  fabrics: Fabric[];
  selection: Selection;
  hoverPieceId: string | null;
  tool: EditorTool;
  pendingSeam: PendingSeam | null;
  sim: SimSettings;
  view: ViewSettings;
  avatar: AvatarSettings;
  /** Erhöht sich bei jeder Änderung, die einen Neuaufbau der Simulation erfordert. */
  geometryVersion: number;
  /** Erhöht sich, wenn die Simulation auf die Ausgangslage zurückgesetzt werden soll. */
  resetToken: number;

  // --- Auswahl & Werkzeuge
  setTool: (tool: EditorTool) => void;
  select: (sel: Partial<Selection>) => void;
  setHoverPiece: (id: string | null) => void;

  // --- Geometrie
  movePiece: (pieceId: string, offset: Vec2) => void;
  movePoint: (pieceId: string, pointId: string, pos: Vec2) => void;
  moveControl: (pieceId: string, pointId: string, which: 'c1' | 'c2', pos: Vec2) => void;
  insertPoint: (pieceId: string, segmentIndex: number, t: number, pos: Vec2) => void;
  toggleCurve: (pieceId: string, segmentIndex: number) => void;
  deletePoint: (pieceId: string, pointId: string) => void;
  addPiece: (name: string, points: Vec2[], offset: Vec2) => void;
  deletePiece: (pieceId: string) => void;
  duplicatePiece: (pieceId: string) => void;
  renamePiece: (pieceId: string, name: string) => void;
  setPiecePlacement: (pieceId: string, placement: Partial<Placement>) => void;
  setPieceFabric: (pieceId: string, fabricId: string) => void;
  togglePieceVisible: (pieceId: string) => void;

  // --- Nähte
  pickSeamEdge: (pieceId: string, segmentIndex: number, extend: boolean) => void;
  cancelSeam: () => void;
  deleteSeam: (seamId: string) => void;
  flipSeam: (seamId: string) => void;

  // --- Stoffe
  updateFabric: (fabricId: string, patch: Partial<Fabric>) => void;
  addFabric: (base?: Fabric) => void;

  // --- Simulation & Ansicht
  setSim: (patch: Partial<SimSettings>) => void;
  setView: (patch: Partial<ViewSettings>) => void;
  setAvatar: (patch: Partial<AvatarSettings>) => void;
  resetSimulation: () => void;
  loadPreset: (presetId: string) => void;
  importProject: (data: ProjectFile) => void;
}

export interface ProjectFile {
  version: 1;
  pieces: PatternPiece[];
  seams: Seam[];
  fabrics: Fabric[];
  avatar?: AvatarSettings;
}

const initial = T_SHIRT.build(DEFAULT_FABRICS[0].id);

const DEFAULT_SIM: SimSettings = {
  running: true,
  gravity: 9.81,
  substeps: 12,
  seamSpeed: 0.35,
  seamStiffness: 0.9,
  selfCollision: true,
  colliderBackend: 'sdf',
  windEnabled: false,
  windStrength: 4,
  windDirection: 200,
  windTurbulence: 0.5,
  resolution: 2.5,
  triangulation: 'delaunay',
};

export const useStudioStore = create<StudioState>()(
  immer((set, get) => {
    const bump = (s: StudioState) => {
      s.geometryVersion++;
    };
    const findPiece = (s: StudioState, id: string) => s.pieces.find((p) => p.id === id);

    return {
      pieces: initial.pieces,
      seams: initial.seams,
      fabrics: DEFAULT_FABRICS,
      selection: { pieceId: initial.pieces[0]?.id ?? null, pointId: null, seamId: null },
      hoverPieceId: null,
      tool: 'select',
      pendingSeam: null,
      sim: DEFAULT_SIM,
      view: { showSeams3D: true, showWireframe: false, showMesh2D: false, showColliders: false, showAvatar: true },
      avatar: DEFAULT_AVATAR,
      geometryVersion: 0,
      resetToken: 0,

      setTool: (tool) =>
        set((s) => {
          s.tool = tool;
          if (tool !== 'seam') s.pendingSeam = null;
        }),
      select: (sel) =>
        set((s) => {
          s.selection = { ...s.selection, ...sel };
        }),
      setHoverPiece: (id) =>
        set((s) => {
          s.hoverPieceId = id;
        }),

      movePiece: (pieceId, offset) =>
        set((s) => {
          const p = findPiece(s, pieceId);
          if (p) p.offset = offset;
        }),
      movePoint: (pieceId, pointId, pos) =>
        set((s) => {
          const p = findPiece(s, pieceId);
          const n = p?.points.length ?? 0;
          const i = p?.points.findIndex((q) => q.id === pointId) ?? -1;
          if (!p || i < 0) return;
          const pt = p.points[i];
          const dx = pos.x - pt.x;
          const dy = pos.y - pt.y;
          pt.x = pos.x;
          pt.y = pos.y;
          // Angrenzende Kontrollpunkte mitführen
          if (pt.curve) {
            pt.curve.c1.x += dx;
            pt.curve.c1.y += dy;
          }
          const prev = p.points[(i - 1 + n) % n];
          if (prev.curve) {
            prev.curve.c2.x += dx;
            prev.curve.c2.y += dy;
          }
          bump(s);
        }),
      moveControl: (pieceId, pointId, which, pos) =>
        set((s) => {
          const pt = findPiece(s, pieceId)?.points.find((q) => q.id === pointId);
          if (!pt?.curve) return;
          pt.curve[which] = pos;
          bump(s);
        }),
      insertPoint: (pieceId, segmentIndex, t, pos) =>
        set((s) => {
          const p = findPiece(s, pieceId);
          if (!p) return;
          const a = p.points[segmentIndex];
          const b = p.points[(segmentIndex + 1) % p.points.length];
          const id = uid('pt');
          if (a.curve) {
            const { left, right } = splitCubic(a, a.curve.c1, a.curve.c2, b, t);
            a.curve = { c1: left.c1, c2: left.c2 };
            p.points.splice(segmentIndex + 1, 0, { id, x: right.p0.x, y: right.p0.y, curve: { c1: right.c1, c2: right.c2 } });
          } else {
            p.points.splice(segmentIndex + 1, 0, { id, x: pos.x, y: pos.y, curve: null });
          }
          s.selection.pointId = id;
          bump(s);
        }),
      toggleCurve: (pieceId, segmentIndex) =>
        set((s) => {
          const p = findPiece(s, pieceId);
          if (!p) return;
          const a = p.points[segmentIndex];
          const b = p.points[(segmentIndex + 1) % p.points.length];
          if (a.curve) {
            a.curve = null;
          } else {
            // Kontrollpunkte senkrecht zur Kante versetzen, damit die Kurve sichtbar wird
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const len = Math.hypot(dx, dy) || 1;
            const nx = -dy / len;
            const ny = dx / len;
            const off = len * 0.2;
            a.curve = {
              c1: { x: a.x + dx / 3 + nx * off, y: a.y + dy / 3 + ny * off },
              c2: { x: a.x + (2 * dx) / 3 + nx * off, y: a.y + (2 * dy) / 3 + ny * off },
            };
          }
          bump(s);
        }),
      deletePoint: (pieceId, pointId) =>
        set((s) => {
          const p = findPiece(s, pieceId);
          if (!p || p.points.length <= 3) return;
          p.points = p.points.filter((q) => q.id !== pointId);
          s.seams = s.seams.filter((sm) => !seamTouchesPoint(sm, pieceId, pointId));
          if (s.selection.pointId === pointId) s.selection.pointId = null;
          bump(s);
        }),
      addPiece: (name, points, offset) =>
        set((s) => {
          const id = uid('piece');
          const cx = points.reduce((a, p) => a + p.x, 0) / points.length;
          const cy = points.reduce((a, p) => a + p.y, 0) / points.length;
          s.pieces.push({
            id,
            name,
            points: points.map((p) => ({ id: uid('pt'), x: p.x - cx, y: p.y - cy, curve: null })),
            offset: { x: offset.x + cx, y: offset.y + cy },
            fabricId: s.fabrics[0].id,
            placement: { origin: [0, 1.1, 0.35], radius: 0, angle: 0, tilt: [0, 0, 0] },
            visible: true,
          });
          s.selection = { pieceId: id, pointId: null, seamId: null };
          bump(s);
        }),
      deletePiece: (pieceId) =>
        set((s) => {
          s.pieces = s.pieces.filter((p) => p.id !== pieceId);
          s.seams = s.seams.filter((sm) => sm.a.pieceId !== pieceId && sm.b.pieceId !== pieceId);
          if (s.selection.pieceId === pieceId) s.selection = { pieceId: null, pointId: null, seamId: null };
          bump(s);
        }),
      duplicatePiece: (pieceId) =>
        set((s) => {
          const p = findPiece(s, pieceId);
          if (!p) return;
          const id = uid('piece');
          const copy: PatternPiece = JSON.parse(JSON.stringify(p));
          copy.id = id;
          copy.name = `${p.name} (Kopie)`;
          copy.points = copy.points.map((q) => ({ ...q, id: uid('pt') }));
          copy.offset = { x: p.offset.x + 15, y: p.offset.y + 15 };
          copy.placement = { ...copy.placement, origin: [copy.placement.origin[0], copy.placement.origin[1], copy.placement.origin[2] + 0.1] };
          s.pieces.push(copy);
          s.selection = { pieceId: id, pointId: null, seamId: null };
          bump(s);
        }),
      renamePiece: (pieceId, name) =>
        set((s) => {
          const p = findPiece(s, pieceId);
          if (p) p.name = name;
        }),
      setPiecePlacement: (pieceId, placement) =>
        set((s) => {
          const p = findPiece(s, pieceId);
          if (!p) return;
          p.placement = { ...p.placement, ...placement };
          bump(s);
        }),
      setPieceFabric: (pieceId, fabricId) =>
        set((s) => {
          const p = findPiece(s, pieceId);
          if (p) p.fabricId = fabricId;
        }),
      togglePieceVisible: (pieceId) =>
        set((s) => {
          const p = findPiece(s, pieceId);
          if (!p) return;
          p.visible = !p.visible;
          bump(s);
        }),

      pickSeamEdge: (pieceId, segmentIndex, extend) =>
        set((s) => {
          const p = findPiece(s, pieceId);
          if (!p) return;
          const from = p.points[segmentIndex].id;
          const to = p.points[(segmentIndex + 1) % p.points.length].id;
          const side: SeamSide = { pieceId, fromPointId: from, toPointId: to };
          const pending = s.pendingSeam;
          if (pending && extend && pending.side.pieceId === pieceId) {
            // Kantenzug erweitern: vom Anfang der ersten bis zum Ende der neuen Kante
            const a = p.points.findIndex((q) => q.id === pending.side.fromPointId);
            const b = p.points.findIndex((q) => q.id === pending.side.toPointId);
            const n = p.points.length;
            const startsAfter = (segmentIndex - b + n) % n <= (a - segmentIndex - 1 + n) % n;
            pending.side = startsAfter
              ? { pieceId, fromPointId: pending.side.fromPointId, toPointId: to }
              : { pieceId, fromPointId: from, toPointId: pending.side.toPointId };
            return;
          }
          if (!pending) {
            s.pendingSeam = { side };
            return;
          }
          if (pending.side.pieceId === pieceId && pending.side.fromPointId === from && pending.side.toPointId === to) return;
          const a = pending.side;
          const pa = findPiece(s, a.pieceId);
          if (!pa) return;
          const na = normalizeSide(pa, a.fromPointId, a.toPointId);
          const pieces = s.pieces as PatternPiece[];
          const seam: Seam = {
            id: uid('seam'),
            a: na,
            b: side,
            reversed: autoReversed(pieces, na, side),
            color: SEAM_COLORS[s.seams.length % SEAM_COLORS.length],
          };
          s.seams.push(seam);
          s.pendingSeam = null;
          s.selection.seamId = seam.id;
          bump(s);
        }),
      cancelSeam: () =>
        set((s) => {
          s.pendingSeam = null;
        }),
      deleteSeam: (seamId) =>
        set((s) => {
          s.seams = s.seams.filter((sm) => sm.id !== seamId);
          if (s.selection.seamId === seamId) s.selection.seamId = null;
          bump(s);
        }),
      flipSeam: (seamId) =>
        set((s) => {
          const sm = s.seams.find((x) => x.id === seamId);
          if (sm) sm.reversed = !sm.reversed;
          bump(s);
        }),

      updateFabric: (fabricId, patch) =>
        set((s) => {
          const f = s.fabrics.find((x) => x.id === fabricId);
          if (f) Object.assign(f, patch);
        }),
      addFabric: (base) =>
        set((s) => {
          const src = base ?? s.fabrics[0];
          s.fabrics.push({ ...src, id: uid('fabric'), name: `${src.name} 2` });
        }),

      setSim: (patch) =>
        set((s) => {
          const needsRebuild = patch.resolution !== undefined || patch.triangulation !== undefined;
          s.sim = { ...s.sim, ...patch };
          if (needsRebuild) bump(s);
        }),
      setView: (patch) =>
        set((s) => {
          s.view = { ...s.view, ...patch };
        }),
      setAvatar: (patch) =>
        set((s) => {
          s.avatar = { ...s.avatar, ...patch };
        }),
      resetSimulation: () =>
        set((s) => {
          s.resetToken++;
        }),
      loadPreset: (presetId) => {
        const preset = GARMENT_PRESETS.find((p) => p.id === presetId);
        if (!preset) return;
        const fabricId = presetId === 'trousers' ? get().fabrics[1].id : presetId === 'skirt' ? get().fabrics[2].id : get().fabrics[0].id;
        const { pieces, seams } = preset.build(fabricId);
        set((s) => {
          s.pieces = pieces;
          s.seams = seams;
          s.selection = { pieceId: pieces[0]?.id ?? null, pointId: null, seamId: null };
          s.pendingSeam = null;
          bump(s);
        });
      },
      importProject: (data) =>
        set((s) => {
          s.pieces = data.pieces;
          s.seams = data.seams;
          s.fabrics = data.fabrics.length ? data.fabrics : DEFAULT_FABRICS;
          if (data.avatar) s.avatar = data.avatar;
          s.selection = { pieceId: null, pointId: null, seamId: null };
          bump(s);
        }),
    };
  }),
);

export function exportProject(): ProjectFile {
  const { pieces, seams, fabrics, avatar } = useStudioStore.getState();
  return { version: 1, pieces, seams, fabrics, avatar };
}
