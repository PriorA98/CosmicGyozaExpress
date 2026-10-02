/**
 * Deterministic motion paths for moving rocks and pads. Position and velocity are pure functions of time,
 * so the same elapsed time always gives the same sample regardless of frame history.
 */
import type { MotionPathDefinition, MovingObstacleDefinition, Vector2 } from "../types/campaign";
import type { Point } from "../types/flight";

export type MotionSample = {
  readonly position: Point;
  /** px/s, analytical derivative of the path. */
  readonly velocity: Vector2;
};

export type MovingObstacleState = MotionSample & {
  readonly id: string;
  readonly label: string;
  readonly radius: number;
  readonly textureKey: string;
};

const TAU = Math.PI * 2;

export function sampleMotionPath(path: MotionPathDefinition, timeMs: number): MotionSample {
  if (!(path.periodMs > 0)) {
    return path.kind === "ping-pong"
      ? { position: path.from, velocity: { x: 0, y: 0 } }
      : { position: { x: path.center.x + path.radiusX, y: path.center.y }, velocity: { x: 0, y: 0 } };
  }
  const periodSeconds = path.periodMs / 1000;
  if (path.kind === "ping-pong") {
    const phase = (timeMs + path.phaseOffsetMs) / path.periodMs;
    const u = 0.5 - 0.5 * Math.cos(TAU * phase);
    const du = 0.5 * Math.sin(TAU * phase) * (TAU / periodSeconds);
    const dx = path.to.x - path.from.x;
    const dy = path.to.y - path.from.y;
    return {
      position: { x: path.from.x + dx * u, y: path.from.y + dy * u },
      velocity: { x: dx * du, y: dy * du },
    };
  }
  const direction = path.clockwise ? 1 : -1;
  const omega = (TAU / periodSeconds) * direction;
  const angle = path.phaseRadians + omega * (timeMs / 1000);
  return {
    position: { x: path.center.x + Math.cos(angle) * path.radiusX, y: path.center.y + Math.sin(angle) * path.radiusY },
    velocity: { x: -Math.sin(angle) * path.radiusX * omega, y: Math.cos(angle) * path.radiusY * omega },
  };
}

export function sampleMovingObstacles(
  definitions: readonly MovingObstacleDefinition[],
  timeMs: number,
): readonly MovingObstacleState[] {
  return definitions.map((definition) => ({
    id: definition.id,
    label: definition.label,
    radius: definition.radius,
    textureKey: definition.textureKey,
    ...sampleMotionPath(definition.path, timeMs),
  }));
}

/** Points along one full period, for drawing dashed tracks. */
export function motionPathTrack(path: MotionPathDefinition, segments = 48): readonly Point[] {
  if (path.kind === "ping-pong") return [path.from, path.to];
  const points: Point[] = [];
  for (let i = 0; i <= segments; i += 1) {
    const angle = (i / segments) * TAU;
    points.push({ x: path.center.x + Math.cos(angle) * path.radiusX, y: path.center.y + Math.sin(angle) * path.radiusY });
  }
  return points;
}

/** Peak speed along the path (px/s), for validation and tuning tables. */
export function motionPathPeakSpeed(path: MotionPathDefinition): number {
  if (!(path.periodMs > 0)) return 0;
  const periodSeconds = path.periodMs / 1000;
  if (path.kind === "ping-pong") {
    return 0.5 * Math.hypot(path.to.x - path.from.x, path.to.y - path.from.y) * (TAU / periodSeconds);
  }
  return Math.max(path.radiusX, path.radiusY) * (TAU / periodSeconds);
}
