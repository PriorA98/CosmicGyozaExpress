export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function radiansToCompassDegrees(radians: number): number {
  return Math.round(((radians * 180) / Math.PI + 360) % 360);
}

export function applyDamping(value: number, dampingPerSecond: number, dt: number): number {
  return value * Math.max(0, 1 - dampingPerSecond * dt);
}
