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

/** Snaps `value` to the nearest multiple of `grid` (grid <= 0 rounds to whole pixels). */
export function snapToGrid(value: number, grid: number): number {
  if (!Number.isFinite(value)) return 0;
  const step = Number.isFinite(grid) && grid > 0 ? grid : 1;
  return Math.round(value / step) * step;
}

/**
 * Stepped fade: holds `start` until `holdUntil` of the life (0..1), then drops in `steps`
 * equal hard steps, reaching 0 exactly at t = 1.
 */
export function steppedFadeAlpha(t: number, fade: { readonly start: number; readonly holdUntil: number; readonly steps: number }): number {
  const clamped = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 1;
  if (clamped >= 1) return 0;
  const hold = Math.min(0.99, Math.max(0, fade.holdUntil));
  if (clamped <= hold) return fade.start;
  const steps = Math.max(1, Math.floor(fade.steps));
  const progress = (clamped - hold) / (1 - hold);
  const step = Math.min(steps, Math.floor(progress * steps) + 1);
  return fade.start * (1 - step / (steps + 1));
}

/**
 * Whole-pixel shake offset for one axis. Amplitude decays linearly over `durationMs`;
 * `roll` (0..1) picks the direction and size. Returns 0 once the shake has ended.
 */
export function shakeOffset(elapsedMs: number, durationMs: number, amplitudePx: number, gridPx: number, roll: number): number {
  if (!Number.isFinite(elapsedMs) || !Number.isFinite(durationMs) || durationMs <= 0 || elapsedMs >= durationMs || elapsedMs < 0) return 0;
  const decay = 1 - elapsedMs / durationMs;
  const safeRoll = Number.isFinite(roll) ? Math.min(1, Math.max(0, roll)) : 0.5;
  const raw = (safeRoll * 2 - 1) * amplitudePx * decay;
  const snapped = snapToGrid(raw, gridPx);
  const limit = Math.max(0, amplitudePx);
  return Math.max(-limit, Math.min(limit, snapped));
}

/**
 * Half-width (px) of a circle of `radius` at vertical distance `dy` from its centre,
 * quantised down to `blockPx` so the iris edge is a hard pixel staircase. Rows outside the
 * circle return -1.
 */
export function irisHalfWidth(dy: number, radius: number, blockPx: number): number {
  if (!Number.isFinite(dy) || !Number.isFinite(radius) || radius <= 0) return -1;
  const ady = Math.abs(dy);
  if (ady >= radius) return -1;
  const block = blockPx > 0 ? blockPx : 1;
  return Math.floor(Math.sqrt(radius * radius - ady * ady) / block) * block;
}

/** Flash opacity: full `peakAlpha` on the first step, then `steps` equal hard drops to 0. */
export function flashAlphaAt(t: number, peakAlpha: number, steps: number): number {
  const clamped = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 1;
  if (clamped >= 1) return 0;
  const count = Math.max(1, Math.floor(steps));
  const index = Math.min(count - 1, Math.floor(clamped * count));
  return peakAlpha * (1 - index / count);
}

export type WarmRampStop = { readonly at: number; readonly rgb: readonly [number, number, number] };

/**
 * Recolours a neutral-grey pixel onto a warm ramp (cozy flour / steam instead of soot).
 * Returns null for saturated pixels, which keep their authored colour.
 */
export function warmRecolor(
  r: number,
  g: number,
  b: number,
  neutralSpread: number,
  lift: { readonly min: number; readonly max: number },
  ramp: readonly WarmRampStop[],
): readonly [number, number, number] | null {
  if (Math.max(r, g, b) - Math.min(r, g, b) > neutralSpread) return null;
  const first = ramp[0];
  if (!first) return null;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const lifted = lift.min + (lift.max - lift.min) * Math.min(1, Math.max(0, luminance));
  let lower = first;
  let upper = first;
  for (const stop of ramp) {
    if (stop.at <= lifted) lower = stop;
    if (stop.at >= lifted) {
      upper = stop;
      break;
    }
    upper = stop;
  }
  const span = upper.at - lower.at;
  const k = span > 0 ? (lifted - lower.at) / span : 0;
  const mix = (a: number, c: number): number => Math.round(a + (c - a) * k);
  return [mix(lower.rgb[0], upper.rgb[0]), mix(lower.rgb[1], upper.rgb[1]), mix(lower.rgb[2], upper.rgb[2])];
}

/** True for cool blue-grey shading (blue exceeds red by more than `bias`), which reads cold on navy. */
export function isCoolShade(r: number, _g: number, b: number, bias: number): boolean {
  return b - r > bias;
}

/** Hard pixel alpha: opaque at or above `threshold` (0..255), transparent below. */
export function quantizeAlpha(alpha: number, threshold: number): number {
  if (!Number.isFinite(alpha) || alpha <= 0) return 0;
  return alpha >= threshold ? 255 : 0;
}
