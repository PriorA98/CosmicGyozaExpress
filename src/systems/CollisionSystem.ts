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
    const nudgeSpeed = severity === "soft-bump" ? 24 : 54;
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
