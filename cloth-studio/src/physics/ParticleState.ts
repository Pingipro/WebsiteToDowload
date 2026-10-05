/**
 * Struktur-of-Arrays-Speicher für alle Stoffpartikel (alle Schnittteile gemeinsam).
 * Positionen werden von den Three.js-Geometrien direkt (per subarray) gelesen.
 */
export class ParticleState {
  readonly count: number;
  readonly pos: Float32Array;
  readonly prev: Float32Array;
  readonly vel: Float32Array;
  /** Externe Beschleunigung (z. B. Wind) je Partikel, pro Frame berechnet. */
  readonly accel: Float32Array;
  readonly mass: Float32Array;
  readonly invMass: Float32Array;
  readonly thickness: Float32Array;
  readonly friction: Float32Array;
  readonly damping: Float32Array;
  /** Index des Schnittteils, zu dem das Partikel gehört. */
  readonly piece: Int32Array;
  /** 2D-Ruheposition (m) innerhalb des Teils – für Selbstkollisions-Ausschlüsse. */
  readonly rest2D: Float32Array;
  /** Partikel liegt auf einer Naht. */
  readonly onSeam: Uint8Array;
  /** Globaler Reibungsfaktor (z. B. 0 während der Nähphase, damit Teile um den Körper gleiten). */
  frictionScale = 1;

  constructor(count: number) {
    this.count = count;
    this.pos = new Float32Array(count * 3);
    this.prev = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    this.accel = new Float32Array(count * 3);
    this.mass = new Float32Array(count);
    this.invMass = new Float32Array(count);
    this.thickness = new Float32Array(count);
    this.friction = new Float32Array(count);
    this.damping = new Float32Array(count);
    this.piece = new Int32Array(count);
    this.rest2D = new Float32Array(count * 2);
    this.onSeam = new Uint8Array(count);
  }
}
