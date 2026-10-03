import { collisionTuning } from "../data/tuning";
import type {
  CollisionCircle,
  CollisionContact,
  CollisionSeverity,
  ShipKinematicState,
  StaticObstacleDefinition,
} from "../types/flight";
import { vectorLength } from "../utils/math";
import { shipSpeed } from "./ShipMovementSystem";

export function detectCircleCollision(
  ship: CollisionCircle,
  obstacle: StaticObstacleDefinition,
): CollisionContact | undefined {
  const dx = ship.x - obstacle.x;
  const dy = ship.y - obstacle.y;
  const distance = vectorLength(dx, dy);
  const overlap = ship.radius + obstacle.radius - distance;

  if (overlap <= 0) return undefined;

  if (distance <= 0.001) {
    return {
      obstacleId: obstacle.id,
      normalX: 1,
      normalY: 0,
      overlap,
      distance,
    };
  }

  return {
    obstacleId: obstacle.id,
    normalX: dx / distance,
    normalY: dy / distance,
    overlap,
    distance,
  };
}

export function findFirstCollision(
  ship: CollisionCircle,
  obstacles: readonly StaticObstacleDefinition[],
): CollisionContact | undefined {
  for (const obstacle of obstacles) {
    const contact = detectCircleCollision(ship, obstacle);
    if (contact) return contact;
  }

  return undefined;
}

export function classifyCollision(speed: number, tuning = collisionTuning): CollisionSeverity {
  if (speed <= 0.001) return "none";
  if (speed < tuning.softBumpMaxSpeed) return "soft-bump";
  if (speed < tuning.dramaticBumpMaxSpeed) return "dramatic-bump";
  return "gyoza-incident";
}

export function resolveCircleCollision(
  state: ShipKinematicState,
  contact: CollisionContact,
  severity: CollisionSeverity,
  tuning = collisionTuning,
): ShipKinematicState {
  if (severity === "none") return state;

  const restitution = collisionRestitution(severity, tuning);
  const dot = state.velocityX * contact.normalX + state.velocityY * contact.normalY;
  let velocityX = state.velocityX;
  let velocityY = state.velocityY;

  if (dot < 0) {
    velocityX = state.velocityX - (1 + restitution) * dot * contact.normalX;
    velocityY = state.velocityY - (1 + restitution) * dot * contact.normalY;
  } else {
    const nudgeSpeed = severity === "soft-bump" ? tuning.softNudgeSpeed : tuning.dramaticNudgeSpeed;
    velocityX += contact.normalX * nudgeSpeed;
    velocityY += contact.normalY * nudgeSpeed;
  }

  return {
    ...state,
    x: state.x + contact.normalX * (contact.overlap + tuning.separationPadding),
    y: state.y + contact.normalY * (contact.overlap + tuning.separationPadding),
    velocityX,
    velocityY,
  };
}

export function limitCollisionSpeed(state: ShipKinematicState, maxSpeed: number): ShipKinematicState {
  const speed = shipSpeed(state);
  if (speed <= maxSpeed || speed <= 0.001) return state;

  const scale = maxSpeed / speed;
  return {
    ...state,
    velocityX: state.velocityX * scale,
    velocityY: state.velocityY * scale,
  };
}

function collisionRestitution(
  severity: CollisionSeverity,
  tuning: typeof collisionTuning,
): number {
  switch (severity) {
    case "none":
      return 0;
    case "soft-bump":
      return tuning.softBumpBounce;
    case "dramatic-bump":
      return tuning.dramaticBumpBounce;
    case "gyoza-incident":
      return tuning.incidentBounce;
  }
}

export type MovingCollisionResolution = {
  readonly state: ShipKinematicState;
  /** Classified from the ship's speed relative to the rock (a rock drifting into a parked ship is a soft bump). */
  readonly severity: CollisionSeverity;
  readonly relativeSpeed: number;
};

/**
 * Contact with a moving rock: severity and bounce use the ship velocity RELATIVE to the rock, then the
 * rock's velocity is added back so the ship leaves with it. The ship is always separated, even when the
 * relative speed is ~0 (resting against a rock that carries it).
 */
export function resolveMovingCollision(
  state: ShipKinematicState,
  contact: CollisionContact,
  obstacleVelocity: { readonly x: number; readonly y: number },
  tuning = collisionTuning,
): MovingCollisionResolution {
  const relativeX = state.velocityX - obstacleVelocity.x;
  const relativeY = state.velocityY - obstacleVelocity.y;
  const relativeSpeed = vectorLength(relativeX, relativeY);
  const severity = classifyCollision(relativeSpeed, tuning);
  const relativeState = { ...state, velocityX: relativeX, velocityY: relativeY };
  const relative = severity === "none" ? {
    ...relativeState,
    x: state.x + contact.normalX * (contact.overlap + tuning.separationPadding),
    y: state.y + contact.normalY * (contact.overlap + tuning.separationPadding),
  } : resolveCircleCollision(
    relativeState,
    contact,
    severity,
    tuning,
  );
  return {
    state: { ...relative, velocityX: relative.velocityX + obstacleVelocity.x, velocityY: relative.velocityY + obstacleVelocity.y },
    severity,
    relativeSpeed,
  };
}

/** Sweeps the relative ship/rock segment; a crossing contact separates back to its entry side. */
export function sweptMovingContact(
  previousShip: { readonly x: number; readonly y: number },
  currentShip: { readonly x: number; readonly y: number },
  shipRadius: number,
  previousObstacle: { readonly x: number; readonly y: number },
  obstacle: StaticObstacleDefinition,
): CollisionContact | undefined {
  const overlap = detectCircleCollision({ ...currentShip, radius: shipRadius }, obstacle);
  if (overlap) return overlap;
  const sx = previousShip.x - previousObstacle.x;
  const sy = previousShip.y - previousObstacle.y;
  const ex = currentShip.x - obstacle.x;
  const ey = currentShip.y - obstacle.y;
  const dx = ex - sx;
  const dy = ey - sy;
  const radius = shipRadius + obstacle.radius;
  const a = dx * dx + dy * dy;
  const c = sx * sx + sy * sy - radius * radius;
  // Already inside and leaving is separation, not a new impact.
  if (a <= 1e-9 || c < 0) return undefined;
  const b = 2 * (sx * dx + sy * dy);
  const discriminant = b * b - 4 * a * c;
  if (discriminant <= 0) return undefined;
  const t = (-b - Math.sqrt(discriminant)) / (2 * a);
  if (t < 0 || t > 1) return undefined;
  const nx = (sx + dx * t) / radius;
  const ny = (sy + dy * t) / radius;
  return { obstacleId: obstacle.id, normalX: nx, normalY: ny, overlap: Math.max(0, radius - ex * nx - ey * ny), distance: radius };
}
