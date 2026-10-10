/**
 * Tea-koi (cozy anglerfish, plan phase-4 §3 Matcha). Pure: no Phaser, no clocks; the scene steps it with the
 * same sim substeps as the force field, so the koi, the HUD noise cue and the autopilot all read one state.
 *
 * Noise is a leaky meter per koi: while the ship thrusts inside `hearingRadius` it fills 1 ms per ms; otherwise
 * it drains at `wakeThrustMs / listenWindowMs` per ms. Short taps (about a third of the time or less) never wake
 * a koi; a sustained burn of `wakeThrustMs` always does.
 */
import type { SeekerDefinition, Vector2 } from "../types/campaign";
import type { Point } from "../types/flight";
import { clamp, vectorLength } from "../utils/math";

export type SeekerMode = "sleeping" | "alert" | "chasing" | "returning";

export type SeekerState = {
  readonly id: string;
  readonly position: Point;
  readonly velocity: Vector2;
  readonly mode: SeekerMode;
  /** ms spent in the current mode. */
  readonly modeMs: number;
  /** Leaky noise meter (ms of heard thrust), 0..wakeThrustMs. */
  readonly noiseMs: number;
  /** Chasing only: ms since the ship last thrust. */
  readonly quietMs: number;
};

export type SeekerStepInput = {
  readonly ship: Point;
  readonly thrusting: boolean;
  readonly dtMs: number;
};

/** Distance (px) at which a returning koi counts as home again. */
const HOME_SNAP_PX = 8;

export function createSeekerStates(definitions: readonly SeekerDefinition[]): SeekerState[] {
  return definitions.map((definition) => ({
    id: definition.id,
    position: definition.home,
    velocity: { x: 0, y: 0 },
    mode: "sleeping",
    modeMs: 0,
    noiseMs: 0,
    quietMs: 0,
  }));
}

/** 0..1 share of the wake threshold (drives the lure glow and the HUD noise cue). */
export function seekerNoiseShare(definition: SeekerDefinition, state: SeekerState): number {
  if (state.mode !== "sleeping") return 1;
  return definition.wakeThrustMs > 0 ? clamp(state.noiseMs / definition.wakeThrustMs, 0, 1) : 0;
}

function moveToward(position: Point, velocity: Vector2, target: Point, speed: number, acceleration: number, dt: number): { position: Point; velocity: Vector2 } {
  const dx = target.x - position.x;
  const dy = target.y - position.y;
  const distance = vectorLength(dx, dy);
  const desired = distance > 1e-6 ? { x: (dx / distance) * speed, y: (dy / distance) * speed } : { x: 0, y: 0 };
  const ex = desired.x - velocity.x;
  const ey = desired.y - velocity.y;
  const error = vectorLength(ex, ey);
  const step = Math.min(error, acceleration * dt);
  const vx = velocity.x + (error > 1e-6 ? (ex / error) * step : 0);
  const vy = velocity.y + (error > 1e-6 ? (ey / error) * step : 0);
  return { position: { x: position.x + vx * dt, y: position.y + vy * dt }, velocity: { x: vx, y: vy } };
}

function withMode(state: SeekerState, mode: SeekerMode): SeekerState {
  return mode === state.mode ? state : { ...state, mode, modeMs: 0 };
}

export function stepSeeker(definition: SeekerDefinition, state: SeekerState, input: SeekerStepInput): SeekerState {
  const dtMs = Math.max(0, input.dtMs);
  const dt = dtMs / 1000;
  const distanceToShip = vectorLength(input.ship.x - state.position.x, input.ship.y - state.position.y);
  const hears = input.thrusting && distanceToShip <= definition.hearingRadius;
  const drain = definition.listenWindowMs > 0 ? definition.wakeThrustMs / definition.listenWindowMs : 1;
  const aged = { ...state, modeMs: state.modeMs + dtMs };

  switch (state.mode) {
    case "sleeping": {
      const noiseMs = clamp(state.noiseMs + (hears ? dtMs : -dtMs * drain), 0, definition.wakeThrustMs);
      const next = { ...aged, noiseMs };
      return noiseMs >= definition.wakeThrustMs ? withMode(next, "alert") : next;
    }
    case "alert":
      return aged.modeMs >= definition.alertMs ? { ...withMode(aged, "chasing"), quietMs: 0 } : aged;
    case "chasing": {
      const quietMs = input.thrusting ? 0 : state.quietMs + dtMs;
      const moved = moveToward(state.position, state.velocity, input.ship, definition.chaseSpeed, definition.chaseAcceleration, dt);
      // Leash: never farther than `leashRadius` from home, so every pool has an outside.
      const hx = moved.position.x - definition.home.x;
      const hy = moved.position.y - definition.home.y;
      const fromHome = vectorLength(hx, hy);
      const leashed = fromHome > definition.leashRadius;
      const position = leashed
        ? { x: definition.home.x + (hx / fromHome) * definition.leashRadius, y: definition.home.y + (hy / fromHome) * definition.leashRadius }
        : moved.position;
      const next = { ...aged, position, velocity: moved.velocity, quietMs };
      return quietMs >= definition.giveUpMs || (leashed && distanceToShip > definition.leashRadius) ? withMode(next, "returning") : next;
    }
    case "returning": {
      const moved = moveToward(state.position, state.velocity, definition.home, definition.returnSpeed, definition.chaseAcceleration, dt);
      const remaining = vectorLength(definition.home.x - moved.position.x, definition.home.y - moved.position.y);
      if (remaining <= HOME_SNAP_PX) return { ...withMode(aged, "sleeping"), position: definition.home, velocity: { x: 0, y: 0 }, noiseMs: 0, quietMs: 0 };
      return { ...aged, position: moved.position, velocity: moved.velocity };
    }
  }
}

export function stepSeekers(definitions: readonly SeekerDefinition[], states: readonly SeekerState[], input: SeekerStepInput): SeekerState[] {
  const fresh = createSeekerStates(definitions);
  return definitions.map((definition, index) => stepSeeker(definition, states[index] ?? fresh[index]!, input));
}

/** The first koi the ship is touching (any mode but `returning`), or null. */
export function seekerContact(definitions: readonly SeekerDefinition[], states: readonly SeekerState[], ship: Point, shipRadius: number): SeekerDefinition | null {
  for (let index = 0; index < definitions.length; index += 1) {
    const definition = definitions[index];
    const state = states[index];
    if (!definition || !state || state.mode === "returning") continue;
    if (vectorLength(ship.x - state.position.x, ship.y - state.position.y) < definition.radius + shipRadius) return definition;
  }
  return null;
}
