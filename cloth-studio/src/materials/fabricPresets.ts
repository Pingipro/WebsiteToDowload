import type { Fabric } from '../types';

/** Stoffbibliothek mit typischen Kennwerten (vereinfachte, normierte Parameter). */
export const FABRIC_PRESETS: Omit<Fabric, 'id'>[] = [
  { name: 'Baumwoll-Jersey', density: 160, stretchStiffness: 0.82, bendStiffness: 0.25, damping: 0.6, friction: 0.45, thickness: 1.2, color: '#e9edf2', texture: 'knit', textureScale: 2, roughness: 0.9, sheen: 0.5 },
  { name: 'Denim', density: 380, stretchStiffness: 0.95, bendStiffness: 0.7, damping: 0.9, friction: 0.55, thickness: 2.0, color: '#3a5a8c', texture: 'denim', textureScale: 3, roughness: 0.95, sheen: 0.2 },
  { name: 'Seide', density: 70, stretchStiffness: 0.9, bendStiffness: 0.05, damping: 0.25, friction: 0.2, thickness: 0.6, color: '#b8323f', texture: 'none', textureScale: 5, roughness: 0.35, sheen: 1 },
  { name: 'Leinen', density: 200, stretchStiffness: 0.93, bendStiffness: 0.45, damping: 0.7, friction: 0.5, thickness: 1.3, color: '#d8c9a8', texture: 'stripes', textureScale: 4, roughness: 0.95, sheen: 0.3 },
  { name: 'Wolle (Karo)', density: 300, stretchStiffness: 0.88, bendStiffness: 0.55, damping: 0.8, friction: 0.6, thickness: 2.5, color: '#7a2f2f', texture: 'checks', textureScale: 8, roughness: 1, sheen: 0.6 },
  { name: 'Elasthan', density: 180, stretchStiffness: 0.55, bendStiffness: 0.2, damping: 0.5, friction: 0.4, thickness: 1.0, color: '#1f2937', texture: 'dots', textureScale: 2.5, roughness: 0.6, sheen: 0.4 },
];

export const DEFAULT_FABRICS: Fabric[] = FABRIC_PRESETS.map((f, i) => ({ ...f, id: `fabric_${i}` }));
