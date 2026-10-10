/**
 * Headless campaign route simulation (dev / tests only). Mirrors FlightScene's campaign step with the same pure
 * systems: force field, moving rocks, tea-koi, oven warp, collisions, checkpoints and the arrival gate.
 * Used to tune routes numerically and to prove each signature mechanic matters (phase-4 rule R7).
 */
import { collisionTuning, respawnTuning, shipTuning } from "../data/tuning";
import { createArrivalGateState, updateArrivalGate } from "../systems/ArrivalGateSystem";
import { classifyCollision, findFirstCollision, resolveCircleCollision, resolveMovingCollision, sweptMovingContact } from "../systems/CollisionSystem";
import { checkpointAt } from "../systems/CollectibleSystem";
import { evaluateDocking } from "../systems/DockingSystem";
import { sampleForceField, warpAt } from "../systems/ForceFieldSystem";
import { sampleMovingObstacles } from "../systems/MotionPathSystem";
import { createSeekerStates, seekerContact, seekerNoiseShare, stepSeekers } from "../systems/SeekerSystem";
import { integrateShipMovement } from "../systems/ShipMovementSystem";
import type { CheckpointDefinition, FlightRouteDefinition } from "../types/campaign";
import type { CollisionSeverity, ShipControls, ShipKinematicState } from "../types/flight";
import type { PilotControls, PilotFlightInput } from "./routePilot";

export type RouteSimEvent = { readonly kind: "incident" | "bump" | "warp" | "nibble" | "checkpoint"; readonly atMs: number; readonly x: number; readonly y: number; readonly detail: string };

export type RouteSimResult = {
  readonly arrived: boolean;
  readonly simMs: number;
  readonly incidents: number;
  readonly bumps: number;
  readonly warps: number;
  readonly nibbles: number;
  readonly events: readonly RouteSimEvent[];
  readonly final: ShipKinematicState;
  /** Highest environmental push the ship felt (px/s²). */
  readonly peakEnvironment: number;
  /** Highest koi noise share (1 = a koi woke). */
  readonly peakKoiNoise: number;
  /** Total ms of thrust. */
  readonly thrustMs: number;
};

export type RoutePilotFn = (input: PilotFlightInput) => PilotControls;

const SUBSTEP_MS = 1000 / 120;
/** The real pilot decides about every 35 ms (keyboard polling); decide every 4 substeps. */
const DECIDE_EVERY = 4;

export function simulateRoute(route: FlightRouteDefinition, pilot: RoutePilotFn, options: { readonly maxSimMs?: number; readonly start?: ShipKinematicState } = {}): RouteSimResult {
  const maxSimMs = options.maxSimMs ?? 240000;
  let ship: ShipKinematicState = options.start ?? route.start;
  let t = 0;
  let checkpoint: CheckpointDefinition | null = null;
  let seekers = createSeekerStates(route.seekers);
  let gate = createArrivalGateState();
  let movingNow = sampleMovingObstacles(route.movingObstacles, 0);
  let controls: ShipControls = { thrust: false, brake: false, rotateLeft: false, rotateRight: false };
  let frozenUntil = 0;
  let cooldownUntil = 0;
  let step = 0;
  let peakEnvironment = 0;
  let peakKoiNoise = 0;
  let thrustMs = 0;
  const contacts = new Set<string>();
  const events: RouteSimEvent[] = [];
  const counts = { incidents: 0, bumps: 0, warps: 0, nibbles: 0 };
  const log = (kind: RouteSimEvent["kind"], detail: string): void => {
    events.push({ kind, atMs: Math.round(t), x: Math.round(ship.x), y: Math.round(ship.y), detail });
  };
  const respawn = (): void => {
    ship = checkpoint?.respawn ?? route.start;
    seekers = createSeekerStates(route.seekers);
    frozenUntil = t + respawnTuning.respawnDelayMs + respawnTuning.resumeDelayMs;
    cooldownUntil = frozenUntil + respawnTuning.invulnerableMs;
    contacts.clear();
  };
  const incident = (detail: string): void => {
    counts.incidents += 1;
    log("incident", detail);
    respawn();
  };

  while (t < maxSimMs) {
    t += SUBSTEP_MS;
    const previousMoving = movingNow;
    movingNow = sampleMovingObstacles(route.movingObstacles, t);
    const env = sampleForceField(route.forceZones, ship, t, route.maxEnvironmentAcceleration, ship);
    peakEnvironment = Math.max(peakEnvironment, env.magnitude);
    if (t < frozenUntil) continue;

    if (step % DECIDE_EVERY === 0) {
      const decision = pilot({
        ship,
        simTimeMs: t,
        environment: { ax: env.acceleration.x, ay: env.acceleration.y },
        movingObstacles: movingNow.map((o) => ({ id: o.id, x: o.position.x, y: o.position.y, vx: o.velocity.x, vy: o.velocity.y, radius: o.radius })),
        seekers: seekers.map((koi, index) => ({ id: koi.id, x: koi.position.x, y: koi.position.y, vx: koi.velocity.x, vy: koi.velocity.y, radius: route.seekers[index]?.radius ?? 0, mode: koi.mode })),
        destination: route.destination,
      });
      controls = { thrust: decision.thrust, brake: decision.brake, rotateLeft: decision.left, rotateRight: decision.right };
    }
    step += 1;

    const previous = ship;
    ship = integrateShipMovement(ship, controls, SUBSTEP_MS / 1000, shipTuning, env.acceleration);

    // World bounds (same bounce + severity as FlightScene.resolveWorldBounds).
    const r = shipTuning.collisionRadius;
    let boundsSeverity: CollisionSeverity = "none";
    if ((ship.x < r && ship.velocityX < 0) || (ship.x > route.world.width - r && ship.velocityX > 0)) {
      boundsSeverity = classifyCollision(Math.abs(ship.velocityX));
      ship = { ...ship, x: Math.min(Math.max(ship.x, r), route.world.width - r), velocityX: -ship.velocityX * collisionTuning.boundaryBounce };
    }
    if ((ship.y < r && ship.velocityY < 0) || (ship.y > route.world.height - r && ship.velocityY > 0)) {
      boundsSeverity = classifyCollision(Math.abs(ship.velocityY));
      ship = { ...ship, y: Math.min(Math.max(ship.y, r), route.world.height - r), velocityY: -ship.velocityY * collisionTuning.boundaryBounce };
    }
    if (boundsSeverity === "gyoza-incident") { incident("bounds"); continue; }

    const vulnerable = t >= cooldownUntil;
    // Moving rocks.
    let hitMoving = false;
    for (const obstacle of movingNow) {
      const radius = r + obstacle.radius;
      if (Math.hypot(ship.x - obstacle.position.x, ship.y - obstacle.position.y) > radius + 10) contacts.delete(obstacle.id);
      const prior = previousMoving.find((o) => o.id === obstacle.id) ?? obstacle;
      const contact = sweptMovingContact(previous, ship, r, prior.position, { ...obstacle.position, id: obstacle.id, label: obstacle.label, radius: obstacle.radius });
      if (!contact) continue;
      const resolved = resolveMovingCollision(ship, contact, obstacle.velocity);
      ship = resolved.state;
      hitMoving = true;
      const fresh = !contacts.has(obstacle.id);
      contacts.add(obstacle.id);
      if (fresh && vulnerable && resolved.severity === "gyoza-incident") { incident(obstacle.id); break; }
      if (fresh && vulnerable && resolved.severity === "dramatic-bump") { counts.bumps += 1; log("bump", obstacle.id); cooldownUntil = t + collisionTuning.collisionCooldownMs; }
      break;
    }
    if (t < frozenUntil) continue;
    if (!hitMoving) {
      const contact = findFirstCollision({ x: ship.x, y: ship.y, radius: r }, route.obstacles);
      if (contact) {
        const severity = classifyCollision(Math.hypot(ship.velocityX, ship.velocityY));
        ship = resolveCircleCollision(ship, contact, severity);
        if (vulnerable && severity === "gyoza-incident") { incident(contact.obstacleId); continue; }
        if (vulnerable && severity === "dramatic-bump") { counts.bumps += 1; log("bump", contact.obstacleId); cooldownUntil = t + collisionTuning.collisionCooldownMs; }
      }
    }

    // Oven warp (white-hole toaster).
    const warp = warpAt(route.forceZones, ship);
    if (warp) {
      counts.warps += 1;
      log("warp", warp.zoneId);
      ship = warp.warp.exit;
      frozenUntil = t + respawnTuning.respawnDelayMs;
      continue;
    }

    // Tea-koi.
    seekers = stepSeekers(route.seekers, seekers, { ship, thrusting: controls.thrust, dtMs: SUBSTEP_MS });
    if (controls.thrust) thrustMs += SUBSTEP_MS;
    seekers.forEach((koi, index) => {
      const definition = route.seekers[index];
      if (definition) peakKoiNoise = Math.max(peakKoiNoise, seekerNoiseShare(definition, koi));
    });
    if (vulnerable && seekerContact(route.seekers, seekers, ship, r)) {
      counts.nibbles += 1;
      counts.incidents += 1;
      log("nibble", "koi");
      respawn();
      continue;
    }

    const reached = checkpointAt(route.checkpoints, ship);
    if (reached && reached.id !== checkpoint?.id && !events.some((e) => e.kind === "checkpoint" && e.detail === reached.id)) {
      checkpoint = reached;
      log("checkpoint", reached.id);
    }

    const result = updateArrivalGate(gate, evaluateDocking(ship, route.destination), t);
    gate = result.state;
    if (result.complete) return { arrived: true, simMs: Math.round(t), ...counts, events, final: ship, peakEnvironment, peakKoiNoise, thrustMs: Math.round(thrustMs) };
  }
  return { arrived: false, simMs: Math.round(t), ...counts, events, final: ship, peakEnvironment, peakKoiNoise, thrustMs: Math.round(thrustMs) };
}
