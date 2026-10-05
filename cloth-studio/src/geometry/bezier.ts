import type { Vec2 } from '../types';

export function cubicPoint(p0: Vec2, c1: Vec2, c2: Vec2, p3: Vec2, t: number): Vec2 {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const d = t * t * t;
  return {
    x: a * p0.x + b * c1.x + c * c2.x + d * p3.x,
    y: a * p0.y + b * c1.y + c * c2.y + d * p3.y,
  };
}

const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/** De-Casteljau-Teilung einer kubischen Kurve bei t. */
export function splitCubic(p0: Vec2, c1: Vec2, c2: Vec2, p3: Vec2, t: number) {
  const a = lerp(p0, c1, t);
  const b = lerp(c1, c2, t);
  const c = lerp(c2, p3, t);
  const d = lerp(a, b, t);
  const e = lerp(b, c, t);
  const m = lerp(d, e, t);
  return {
    left: { p0, c1: a, c2: d, p3: m },
    right: { p0: m, c1: e, c2: c, p3 },
  };
}

/** Nächster Kurvenparameter zu einem Punkt (grobe Abtastung + Verfeinerung). */
export function closestTOnCubic(p0: Vec2, c1: Vec2, c2: Vec2, p3: Vec2, q: Vec2): { t: number; dist: number } {
  let bestT = 0;
  let best = Infinity;
  const N = 48;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const p = cubicPoint(p0, c1, c2, p3, t);
    const d = (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
    if (d < best) {
      best = d;
      bestT = t;
    }
  }
  let step = 1 / N;
  for (let k = 0; k < 12; k++) {
    step *= 0.5;
    for (const t of [bestT - step, bestT + step]) {
      if (t < 0 || t > 1) continue;
      const p = cubicPoint(p0, c1, c2, p3, t);
      const d = (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
      if (d < best) {
        best = d;
        bestT = t;
      }
    }
  }
  return { t: bestT, dist: Math.sqrt(best) };
}

export function closestTOnLine(a: Vec2, b: Vec2, q: Vec2): { t: number; dist: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy || 1e-12;
  const t = Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / len2));
  const px = a.x + dx * t - q.x;
  const py = a.y + dy * t - q.y;
  return { t, dist: Math.hypot(px, py) };
}
