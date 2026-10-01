/**
 * Pure helpers behind `src/fx/` effects (no Phaser imports; unit tested in tests/fxMath.test.ts).
 * Rotation follows the ship convention: radians, 0 = nose up, clockwise positive.
 */

export type MutablePoint = { x: number; y: number };

/** Writes the exhaust nozzle position (bottom of the ship at `offset` px) into `out`. */
export function nozzlePoint(x: number, y: number, rotation: number, offset: number, out: MutablePoint): MutablePoint {
  out.x = x - Math.sin(rotation) * offset;
  out.y = y + Math.cos(rotation) * offset;
  return out;
}

/** Phaser particle angle (degrees, 0 = +X, clockwise) of the exhaust leaving the ship bottom. */
export function exhaustAngleDegrees(rotation: number): number {
  return (Math.atan2(Math.cos(rotation), -Math.sin(rotation)) * 180) / Math.PI;
}

export type EmissionStep = { count: number; carry: number };

/**
 * Converts a continuous rate into whole particles for this frame, carrying the remainder so
 * emission is smooth at any frame rate. Negative or non-finite input emits nothing.
 */
export function emissionStep(carry: number, deltaMs: number, ratePerSecond: number, out: EmissionStep): EmissionStep {
  const safeDelta = Number.isFinite(deltaMs) && deltaMs > 0 ? Math.min(deltaMs, 100) : 0;
  const safeRate = Number.isFinite(ratePerSecond) && ratePerSecond > 0 ? ratePerSecond : 0;
  const total = (Number.isFinite(carry) ? carry : 0) + (safeDelta / 1000) * safeRate;
  out.count = Math.floor(total);
  out.carry = total - out.count;
  return out;
}

/** Thrust emission rate for an intensity in 0..1 (clamped). */
export function thrustRate(intensity: number, ratePerSecond: number, minRateFactor: number): number {
  const clamped = Number.isFinite(intensity) ? Math.min(1, Math.max(0, intensity)) : 0;
  return ratePerSecond * (minRateFactor + (1 - minRateFactor) * clamped);
}

/**
 * How many particles a burst may spawn without exceeding the per-scene live budget.
 * Reduced motion thins bursts but always keeps at least one particle when budget allows.
 */
export function allowedBurstCount(requested: number, alive: number, budget: number, maxPerBurst: number, reducedFactor: number | null): number {
  if (!Number.isFinite(requested) || requested <= 0) return 0;
  let count = Math.min(Math.floor(requested), maxPerBurst);
  if (reducedFactor !== null) count = Math.max(1, Math.floor(count * reducedFactor));
  const room = Math.max(0, budget - Math.max(0, alive));
  return Math.min(count, room);
}

/** Linear interpolation inside a {min,max} range for a 0..1 roll. */
export function inRange(range: { readonly min: number; readonly max: number }, roll: number): number {
  return range.min + (range.max - range.min) * Math.min(1, Math.max(0, roll));
}

/** Smooth ease used by transitions (cubic in-out). */
export function easeInOutCubic(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c < 0.5 ? 4 * c * c * c : 1 - (-2 * c + 2) ** 3 / 2;
}

/** Radius that fully covers a `width`x`height` viewport from (cx, cy). */
export function coverRadius(cx: number, cy: number, width: number, height: number): number {
  const dx = Math.max(cx, width - cx);
  const dy = Math.max(cy, height - cy);
  return Math.ceil(Math.hypot(dx, dy)) + 2;
}
