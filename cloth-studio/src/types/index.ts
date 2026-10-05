/**
 * Zentrale Domänentypen für Schnittmuster, Nähte, Stoffe und Simulation.
 *
 * Einheiten:
 *  - 2D-Schnittmuster: Zentimeter, y-Achse zeigt nach unten (Bildschirmkoordinaten).
 *  - 3D-Welt: Meter, y-Achse zeigt nach oben, Avatar blickt in +z.
 */

export interface Vec2 {
  x: number;
  y: number;
}

export type Vec3 = [number, number, number];

/** Kubische Bezier-Kontrollpunkte für das Segment von einem Punkt zum nächsten. */
export interface SegmentCurve {
  c1: Vec2;
  c2: Vec2;
}

/**
 * Ein Eckpunkt des Schnittteil-Umrisses. Das ausgehende Segment führt zum nächsten
 * Punkt in der (geschlossenen) Liste; ist `curve` gesetzt, ist es eine Bezierkurve.
 */
export interface PatternPoint {
  id: string;
  x: number;
  y: number;
  curve?: SegmentCurve | null;
}

/**
 * Anordnung eines Schnittteils im 3D-Raum (vergleichbar mit CLO "Arrangement Points").
 * Das Teil wird um eine Zylinderachse gewickelt; radius <= 0 bedeutet flach.
 */
export interface Placement {
  /** Punkt auf der Zylinderachse, an dem die Mitte des Teils liegt (m). */
  origin: Vec3;
  /** Zylinderradius in m (0 = planar). */
  radius: number;
  /** Winkel der Teilmitte um die Achse, in Grad (0 = Blick nach +z). */
  angle: number;
  /** Neigung der Zylinderachse (Euler XYZ in Grad, Standardachse = +y). */
  tilt: Vec3;
}

export interface PatternPiece {
  id: string;
  name: string;
  points: PatternPoint[];
  /** Position des Teils auf der 2D-Arbeitsfläche (cm). */
  offset: Vec2;
  fabricId: string;
  placement: Placement;
  visible: boolean;
}

/** Eine Nahtseite: zusammenhängender Kantenzug eines Teils (from → to in Umlaufrichtung). */
export interface SeamSide {
  pieceId: string;
  fromPointId: string;
  toPointId: string;
}

export interface Seam {
  id: string;
  a: SeamSide;
  b: SeamSide;
  /** Seite b wird in umgekehrter Richtung zugeordnet. */
  reversed: boolean;
  color: string;
}

export type TexturePattern = 'none' | 'stripes' | 'checks' | 'denim' | 'dots' | 'knit';

export interface Fabric {
  id: string;
  name: string;
  /** Flächengewicht in g/m². */
  density: number;
  /** Dehnsteifigkeit 0..1 (1 = undehnbar). */
  stretchStiffness: number;
  /** Biegesteifigkeit 0..1 (1 = steif). */
  bendStiffness: number;
  /** Geschwindigkeitsdämpfung 1/s. */
  damping: number;
  /** Reibungskoeffizient Stoff–Avatar 0..1. */
  friction: number;
  /** Kollisionsdicke in mm. */
  thickness: number;
  color: string;
  texture: TexturePattern;
  /** Texturgröße in cm pro Wiederholung. */
  textureScale: number;
  roughness: number;
  /** Samtiger Glanz (Sheen) 0..1. */
  sheen: number;
}

export type ColliderBackendKind = 'sdf' | 'rapier';

export interface SimSettings {
  running: boolean;
  gravity: number;
  substeps: number;
  /** Zielgeschwindigkeit, mit der Nähte zusammengezogen werden (m/s). */
  seamSpeed: number;
  seamStiffness: number;
  selfCollision: boolean;
  colliderBackend: ColliderBackendKind;
  windEnabled: boolean;
  windStrength: number;
  /** Windrichtung als Winkel in Grad um die y-Achse. */
  windDirection: number;
  windTurbulence: number;
  /** Triangulierungsauflösung in cm (Kantenlänge). */
  resolution: number;
  triangulation: 'delaunay' | 'earcut';
}

export interface ViewSettings {
  showSeams3D: boolean;
  showWireframe: boolean;
  showMesh2D: boolean;
  showColliders: boolean;
  showAvatar: boolean;
}

export interface AvatarSettings {
  height: number;
  girth: number;
  skinColor: string;
}

export type EditorTool = 'select' | 'addPoint' | 'curve' | 'seam' | 'draw' | 'pan';
