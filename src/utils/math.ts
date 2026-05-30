export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function radiansToDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

export function radiansToCompassDegrees(radians: number): number {
  return Math.round((radiansToDegrees(radians) + 360) % 360);
}

export function applyDamping(value: number, dampingPerSecond: number, dt: number): number {
  return value * Math.max(0, 1 - dampingPerSecond * dt);
}

export function distanceBetween(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function vectorLength(x: number, y: number): number {
  return Math.hypot(x, y);
}

export function shortestAngleDifferenceRadians(a: number, b: number): number {
  const turn = Math.PI * 2;
  return ((((a - b + Math.PI) % turn) + turn) % turn) - Math.PI;
}

export function absoluteAngleDifferenceRadians(a: number, b: number): number {
  return Math.abs(shortestAngleDifferenceRadians(a, b));
}
