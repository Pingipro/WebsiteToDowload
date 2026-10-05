import { normalizeSide } from '../geometry/outline';
import { autoReversed } from '../geometry/seamUtils';
import type { PatternPiece, PatternPoint, Placement, Seam } from '../types';
import { SEAM_COLORS, uid } from '../utils/id';

/** [Name, x, y, optionale Bezier-Kontrollpunkte c1x, c1y, c2x, c2y für das ausgehende Segment] */
type PointDef = [string, number, number, ...number[]];

interface PieceDef {
  key: string;
  name: string;
  points: PointDef[];
  offset: [number, number];
  placement: Placement;
  fabricId: string;
  mirror?: boolean;
}

function buildPoints(pieceId: string, defs: PointDef[]): PatternPoint[] {
  return defs.map(([name, x, y, ...c]) => ({
    id: `${pieceId}.${name}`,
    x,
    y,
    curve: c.length === 4 ? { c1: { x: c[0], y: c[1] }, c2: { x: c[2], y: c[3] } } : null,
  }));
}

/** Spiegelt ein Teil an der y-Achse und kehrt die Umlaufrichtung um (Kurven inklusive). */
export function mirrorPoints(points: PatternPoint[]): PatternPoint[] {
  const n = points.length;
  const out: PatternPoint[] = [];
  for (let k = 0; k < n; k++) {
    const p = points[(n - 1 - k + n) % n];
    const j = (n - 2 - k + 2 * n) % n; // Segment, das umgekehrt wird
    const seg = points[j].curve;
    out.push({
      id: p.id,
      x: -p.x,
      y: p.y,
      curve: seg ? { c1: { x: -seg.c2.x, y: seg.c2.y }, c2: { x: -seg.c1.x, y: seg.c1.y } } : null,
    });
  }
  return out;
}

export interface GarmentPreset {
  id: string;
  name: string;
  build: (fabricId: string) => { pieces: PatternPiece[]; seams: Seam[] };
}

function assemble(defs: PieceDef[], seamDefs: [string, string, string, string, string, string][]) {
  const pieces: PatternPiece[] = defs.map((d) => {
    const id = uid(d.key);
    let pts = buildPoints(id, d.points);
    if (d.mirror) pts = mirrorPoints(pts);
    return { id, name: d.name, points: pts, offset: { x: d.offset[0], y: d.offset[1] }, fabricId: d.fabricId, placement: d.placement, visible: true };
  });
  const byKey = new Map(defs.map((d, i) => [d.key, pieces[i]]));
  const seams: Seam[] = seamDefs.map(([ka, fa, ta, kb, fb, tb], i) => {
    const pa = byKey.get(ka)!;
    const pb = byKey.get(kb)!;
    const a = normalizeSide(pa, `${pa.id}.${fa}`, `${pa.id}.${ta}`);
    const b = normalizeSide(pb, `${pb.id}.${fb}`, `${pb.id}.${tb}`);
    return { id: uid('seam'), a, b, reversed: autoReversed(pieces, a, b), color: SEAM_COLORS[i % SEAM_COLORS.length] };
  });
  return { pieces, seams };
}

// ---------------------------------------------------------------------------------
// T-Shirt
// ---------------------------------------------------------------------------------
const shirtFront: PointDef[] = [
  ['neckL', -8, 0, -6, 10, 6, 10],
  ['neckR', 8, 0],
  ['shoulderR', 21, 4, 20, 13, 22, 24],
  ['underarmR', 28, 25],
  ['hemR', 28, 68],
  ['hemL', -28, 68],
  ['underarmL', -28, 25, -22, 24, -20, 13],
  ['shoulderL', -21, 4],
];
const shirtBack: PointDef[] = [
  ['neckL', -8, 0, -6, 2.5, 6, 2.5],
  ['neckR', 8, 0],
  ['shoulderR', 21, 4, 20, 13, 22, 24],
  ['underarmR', 28, 25],
  ['hemR', 28, 68],
  ['hemL', -28, 68],
  ['underarmL', -28, 25, -22, 24, -20, 13],
  ['shoulderL', -21, 4],
];
const sleeve: PointDef[] = [
  ['capTop', 0, 0, 8, 0, 14, 8],
  ['capR', 20, 14],
  ['hemR', 17, 26],
  ['hemL', -17, 26],
  ['capL', -20, 14, -14, 8, -8, 0],
];

export const T_SHIRT: GarmentPreset = {
  id: 'tshirt',
  name: 'T-Shirt',
  build: (fabricId) =>
    assemble(
      [
        { key: 'front', name: 'Vorderteil', points: shirtFront, offset: [0, 0], fabricId, placement: { origin: [0, 1.19, 0], radius: 0.28, angle: 0, tilt: [0, 0, 0] } },
        { key: 'back', name: 'Rückenteil', points: shirtBack, offset: [64, 0], fabricId, placement: { origin: [0, 1.19, 0], radius: 0.28, angle: 180, tilt: [0, 0, 0] } },
        { key: 'sleeveL', name: 'Ärmel links', points: sleeve, offset: [124, 0], fabricId, placement: { origin: [0.32, 1.27, -0.01], radius: 0.075, angle: 90, tilt: [0, 0, 45] } },
        { key: 'sleeveR', name: 'Ärmel rechts', points: sleeve, offset: [124, 36], fabricId, placement: { origin: [-0.32, 1.27, -0.01], radius: 0.075, angle: -90, tilt: [0, 0, -45] } },
      ],
      [
        // Seitennähte
        ['front', 'underarmR', 'hemR', 'back', 'hemL', 'underarmL'],
        ['front', 'hemL', 'underarmL', 'back', 'underarmR', 'hemR'],
        // Schulternähte
        ['front', 'neckR', 'shoulderR', 'back', 'shoulderL', 'neckL'],
        ['front', 'shoulderL', 'neckL', 'back', 'neckR', 'shoulderR'],
        // Ärmel links (+x): 2D-rechte Kugelhälfte → Rücken, linke → Vorderteil
        ['sleeveL', 'capTop', 'capR', 'back', 'underarmL', 'shoulderL'],
        ['sleeveL', 'capL', 'capTop', 'front', 'shoulderR', 'underarmR'],
        ['sleeveL', 'capR', 'hemR', 'sleeveL', 'hemL', 'capL'],
        // Ärmel rechts (−x)
        ['sleeveR', 'capTop', 'capR', 'front', 'underarmL', 'shoulderL'],
        ['sleeveR', 'capL', 'capTop', 'back', 'shoulderR', 'underarmR'],
        ['sleeveR', 'capR', 'hemR', 'sleeveR', 'hemL', 'capL'],
      ],
    ),
};

// ---------------------------------------------------------------------------------
// Rock (A-Linie)
// ---------------------------------------------------------------------------------
const skirtPanel = (dip: number): PointDef[] => [
  ['waistL', -24, 0, -8, dip, 8, dip],
  ['waistR', 24, 0, 28, 8, 31, 18],
  ['hemR', 40, 58, 14, 61, -14, 61],
  ['hemL', -40, 58, -31, 18, -28, 8],
];

export const SKIRT: GarmentPreset = {
  id: 'skirt',
  name: 'Rock (A-Linie)',
  build: (fabricId) =>
    assemble(
      [
        { key: 'front', name: 'Rock vorne', points: skirtPanel(1.2), offset: [0, 0], fabricId, placement: { origin: [0, 0.78, 0], radius: 0.3, angle: 0, tilt: [0, 0, 0] } },
        { key: 'back', name: 'Rock hinten', points: skirtPanel(-0.5), offset: [90, 0], fabricId, placement: { origin: [0, 0.78, 0], radius: 0.3, angle: 180, tilt: [0, 0, 0] } },
      ],
      [
        ['front', 'waistR', 'hemR', 'back', 'hemL', 'waistL'],
        ['front', 'hemL', 'waistL', 'back', 'waistR', 'hemR'],
      ],
    ),
};

// ---------------------------------------------------------------------------------
// Hose (4 Teile)
// ---------------------------------------------------------------------------------
const trouserFront: PointDef[] = [
  ['cf', -10, 0],
  ['ws', 14, 0, 16.5, 4, 17.5, 9],
  ['hip', 17.5, 16],
  ['ho', 11.5, 102],
  ['hi', -8.5, 102],
  ['cr', -16, 27, -11, 26, -10, 20],
];
const trouserBack: PointDef[] = [
  ['cb', -11, -2],
  ['ws', 15, 0, 18, 4, 19.5, 9],
  ['hip', 19.5, 16],
  ['ho', 12, 102],
  ['hi', -10, 102],
  ['cr', -21, 28, -14, 27, -12, 18],
];

export const TROUSERS: GarmentPreset = {
  id: 'trousers',
  name: 'Hose',
  build: (fabricId) =>
    assemble(
      [
        { key: 'fl', name: 'Vorderhose links', points: trouserFront, offset: [0, 0], fabricId, placement: { origin: [0.13, 0.53, 0], radius: 0.2, angle: 15, tilt: [0, 0, 0] } },
        { key: 'fr', name: 'Vorderhose rechts', points: trouserFront, mirror: true, offset: [-40, 0], fabricId, placement: { origin: [-0.13, 0.53, 0], radius: 0.2, angle: -15, tilt: [0, 0, 0] } },
        { key: 'bl', name: 'Hinterhose links', points: trouserBack, mirror: true, offset: [45, 0], fabricId, placement: { origin: [0.13, 0.53, 0], radius: 0.2, angle: 165, tilt: [0, 0, 0] } },
        { key: 'br', name: 'Hinterhose rechts', points: trouserBack, offset: [90, 0], fabricId, placement: { origin: [-0.13, 0.53, 0], radius: 0.2, angle: 195, tilt: [0, 0, 0] } },
      ],
      [
        ['fl', 'ws', 'ho', 'bl', 'ws', 'ho'],
        ['fl', 'hi', 'cr', 'bl', 'hi', 'cr'],
        ['fr', 'ws', 'ho', 'br', 'ws', 'ho'],
        ['fr', 'hi', 'cr', 'br', 'hi', 'cr'],
        ['fl', 'cr', 'cf', 'fr', 'cr', 'cf'],
        ['bl', 'cr', 'cb', 'br', 'cr', 'cb'],
      ],
    ),
};

export const GARMENT_PRESETS: GarmentPreset[] = [T_SHIRT, SKIRT, TROUSERS];
