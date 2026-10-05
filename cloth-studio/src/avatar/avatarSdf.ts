import type { AvatarModel } from './avatarModel';

/**
 * Signed Distance Field des Avatars: glatte Vereinigung (polynomiales smooth-min)
 * aller Round-Cone-Primitive. Liefert Abstand und (angenäherte) Normale.
 * Bewusst allokationsfrei, da es pro Partikel und Substep aufgerufen wird.
 */
export class AvatarSdf {
  private readonly n: number;
  private readonly data: Float64Array; // ax ay az bx by bz ra rb  (8 je Primitiv)
  private readonly bs: Float64Array; // Hüllkugel: cx cy cz R
  readonly blend: number;
  readonly min: [number, number, number];
  readonly max: [number, number, number];
  /** Ergebnis der letzten Abfrage. */
  nx = 0;
  ny = 1;
  nz = 0;

  constructor(model: AvatarModel) {
    const prims = model.primitives;
    this.n = prims.length;
    this.data = new Float64Array(this.n * 8);
    this.bs = new Float64Array(this.n * 4);
    prims.forEach((p, i) => {
      this.data.set([...p.a, ...p.b, p.ra, p.rb], i * 8);
      const cx = (p.a[0] + p.b[0]) / 2;
      const cy = (p.a[1] + p.b[1]) / 2;
      const cz = (p.a[2] + p.b[2]) / 2;
      const half = Math.hypot(p.b[0] - p.a[0], p.b[1] - p.a[1], p.b[2] - p.a[2]) / 2;
      this.bs.set([cx, cy, cz, half + Math.max(p.ra, p.rb)], i * 4);
    });
    this.blend = model.blend;
    this.min = [...model.bboxMin];
    this.max = [...model.bboxMax];
  }

  get primitiveCount(): number {
    return this.n;
  }

  /** Abstand zum Avatar; setzt nx/ny/nz auf die Oberflächennormale. */
  eval(px: number, py: number, pz: number): number {
    return this.evalSubset(px, py, pz, null, 0, this.n);
  }

  /**
   * Untere Schranke des Abstands zu Primitiv i (über dessen Hüllkugel).
   * Dient der Breitphase im Kollisions-Backend.
   */
  lowerBound(i: number, px: number, py: number, pz: number): number {
    const B = this.bs;
    const bi = i * 4;
    const dx = px - B[bi], dy = py - B[bi + 1], dz = pz - B[bi + 2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz) - B[bi + 3];
  }

  /**
   * Wertet nur eine Teilmenge der Primitive aus (Kandidatenliste aus der Breitphase).
   * `list = null` bedeutet alle Primitive.
   */
  evalSubset(px: number, py: number, pz: number, list: Int16Array | null, offset: number, count: number): number {
    const k = this.blend;
    let d = 1e9;
    let gx = 0;
    let gy = 1;
    let gz = 0;
    const D = this.data;
    const B = this.bs;
    for (let li = 0; li < count; li++) {
      const i = list ? list[offset + li] : li;
      const bi = i * 4;
      const bx = px - B[bi], by = py - B[bi + 1], bz = pz - B[bi + 2];
      const lower = Math.sqrt(bx * bx + by * by + bz * bz) - B[bi + 3];
      if (lower > d + k) continue;

      const o = i * 8;
      const ax = D[o], ay = D[o + 1], az = D[o + 2];
      const bax = D[o + 3] - ax, bay = D[o + 4] - ay, baz = D[o + 5] - az;
      const r1 = D[o + 6], r2 = D[o + 7];
      const pax = px - ax, pay = py - ay, paz = pz - az;
      const l2 = bax * bax + bay * bay + baz * baz;

      // --- Distanz zum Round Cone (nach I. Quilez) ---
      const rr = r1 - r2;
      const a2 = l2 - rr * rr;
      const il2 = 1 / l2;
      const y = pax * bax + pay * bay + paz * baz;
      const z = y - l2;
      const qx = pax * l2 - bax * y, qy = pay * l2 - bay * y, qz = paz * l2 - baz * y;
      const x2 = qx * qx + qy * qy + qz * qz;
      const y2 = y * y * l2;
      const z2 = z * z * l2;
      const kk = Math.sign(rr) * rr * rr * x2;
      let di: number;
      if (Math.sign(z) * a2 * z2 > kk) di = Math.sqrt(x2 + z2) * il2 - r2;
      else if (Math.sign(y) * a2 * y2 < kk) di = Math.sqrt(x2 + y2) * il2 - r1;
      else di = (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;

      // --- Normale: Richtung vom nächsten Achsenpunkt ---
      const t = Math.max(0, Math.min(1, y * il2));
      let nx = pax - bax * t, ny = pay - bay * t, nz = paz - baz * t;
      const nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (nl > 1e-9) {
        nx /= nl;
        ny /= nl;
        nz /= nl;
      } else {
        nx = 0;
        ny = 1;
        nz = 0;
      }

      // --- polynomiales smooth-min ---
      if (d >= 1e8) {
        d = di;
        gx = nx;
        gy = ny;
        gz = nz;
        continue;
      }
      const h = Math.max(0, Math.min(1, 0.5 + (0.5 * (d - di)) / k));
      d = d * (1 - h) + di * h - k * h * (1 - h);
      gx = gx * (1 - h) + nx * h;
      gy = gy * (1 - h) + ny * h;
      gz = gz * (1 - h) + nz * h;
    }
    const gl = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1;
    this.nx = gx / gl;
    this.ny = gy / gl;
    this.nz = gz / gl;
    return d;
  }

  /** Schneller Ausschluss über die Bounding Box. */
  outsideBounds(px: number, py: number, pz: number, margin: number): boolean {
    return (
      px < this.min[0] - margin || px > this.max[0] + margin ||
      py < this.min[1] - margin || py > this.max[1] + margin ||
      pz < this.min[2] - margin || pz > this.max[2] + margin
    );
  }
}
