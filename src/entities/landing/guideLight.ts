/** Pure guide-light helpers (no Phaser imports, unit-tested). */
/**
 * Row strength (0..1) of the guide light at height share `k` (0 = pad, 1 = top): full up to `fadeStart`,
 * then down to 0 at the top in `fadeSteps` hard steps (a stepped pixel ramp, never a smooth gradient).
 */
export function guideLightRowStrength(k: number, fadeStart: number, fadeSteps: number): number {
  if (!(k < 1)) return 0;
  if (k <= fadeStart) return 1;
  const steps = Math.max(1, Math.round(fadeSteps));
  const share = (k - fadeStart) / Math.max(1e-6, 1 - fadeStart);
  return 1 - (Math.floor(share * steps) + 1) / (steps + 1);
}
