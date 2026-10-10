/**
 * Environmental forces (currents, gusts, bounded radial gravity). Pure: no Phaser, no clocks.
 * One sample drives both physics and the on-screen cue, so a cue never disagrees with the push.
 */
import type { ForceZoneDefinition, GravityWarpDefinition, GustCycle, GustPhase, Vector2, ZoneShape } from "../types/campaign";
import type { Point } from "../types/flight";
import { clamp, vectorLength } from "../utils/math";

export type ForceSample = {
  readonly zoneId: string;
  readonly acceleration: Vector2;
  /** 0 outside the zone … 1 deep inside (edge blend applied). */
  readonly influence: number;
  /** Gust zones report their phase; steady zones report `sustain` while inside, `calm` outside. */
  readonly phase: GustPhase;
  /** Gust envelope 0..1 (1 for steady zones while inside). */
  readonly envelope: number;
  /** Gusts: sign of the current (or, in calm, the coming) push. 1 for every other zone. */
  readonly direction: 1 | -1;
};

export type ForceFieldSample = {
  readonly acceleration: Vector2;
  readonly magnitude: number;
  readonly zones: readonly ForceSample[];
  /** Strongest-influence zone the ship is inside, or null. */
  readonly dominant: ForceSample | null;
};

const ZERO: Vector2 = { x: 0, y: 0 };

export function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge1 <= edge0) return value >= edge1 ? 1 : 0;
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Distance from `position` to the nearest edge of `shape`, positive inside, negative outside. */
export function insideDistance(shape: ZoneShape, position: Point): number {
  if (shape.kind === "circle") {
    return shape.radius - vectorLength(position.x - shape.center.x, position.y - shape.center.y);
  }
  const dx = Math.min(position.x - shape.x, shape.x + shape.width - position.x);
  const dy = Math.min(position.y - shape.y, shape.y + shape.height - position.y);
  return Math.min(dx, dy);
}

export function gustCycleLength(cycle: GustCycle): number {
  return cycle.warningMs + cycle.attackMs + cycle.sustainMs + cycle.releaseMs + cycle.calmMs;
}

export type GustState = {
  readonly phase: GustPhase;
  readonly envelope: number;
  /** ms until the next attack begins (0 while attack/sustain/release). */
  readonly msUntilGust: number;
  /** 0..1 progress within the current phase. */
  readonly phaseProgress: number;
  /**
   * Sign of the push this phase belongs to: the current gust during warning/attack/sustain/release, the
   * NEXT gust during calm. Always 1 unless the cycle alternates.
   */
  readonly direction: 1 | -1;
};

function cycleDirection(cycle: GustCycle, index: number): 1 | -1 {
  return cycle.alternate && ((index % 2) + 2) % 2 === 1 ? -1 : 1;
}

/** Gust envelope at `timeMs`: zero in warning/calm, smoothstep up in attack, 1 in sustain, smoothstep down in release. */
export function sampleGustCycle(cycle: GustCycle, timeMs: number): GustState {
  const length = gustCycleLength(cycle);
  if (!(length > 0)) return { phase: "calm", envelope: 0, msUntilGust: 0, phaseProgress: 0, direction: 1 };
  const shifted = timeMs + cycle.phaseOffsetMs;
  const index = Math.floor(shifted / length);
  const t = ((shifted % length) + length) % length;
  const direction = cycleDirection(cycle, index);
  const warningEnd = cycle.warningMs;
  const attackEnd = warningEnd + cycle.attackMs;
  const sustainEnd = attackEnd + cycle.sustainMs;
  const releaseEnd = sustainEnd + cycle.releaseMs;
  const progress = (start: number, duration: number): number => (duration > 0 ? clamp((t - start) / duration, 0, 1) : 1);
  if (t < warningEnd) return { phase: "warning", envelope: 0, msUntilGust: warningEnd - t, phaseProgress: progress(0, cycle.warningMs), direction };
  if (t < attackEnd) {
    const p = progress(warningEnd, cycle.attackMs);
    return { phase: "attack", envelope: smoothstep(0, 1, p), msUntilGust: 0, phaseProgress: p, direction };
  }
  if (t < sustainEnd) return { phase: "sustain", envelope: 1, msUntilGust: 0, phaseProgress: progress(attackEnd, cycle.sustainMs), direction };
  if (t < releaseEnd) {
    const p = progress(sustainEnd, cycle.releaseMs);
    return { phase: "release", envelope: 1 - smoothstep(0, 1, p), msUntilGust: 0, phaseProgress: p, direction };
  }
  return { phase: "calm", envelope: 0, msUntilGust: length - t + cycle.warningMs, phaseProgress: progress(releaseEnd, cycle.calmMs), direction: cycleDirection(cycle, index + 1) };
}

/** Ship velocity, read only by river currents (`flowSpeed`). */
export type ForceVelocity = { readonly velocityX: number; readonly velocityY: number };

/** River share: 1 at rest along the flow, 0 at `flowSpeed`, down to -1 when moving twice as fast. */
export function riverShare(acceleration: Vector2, flowSpeed: number | null, velocity: ForceVelocity | undefined): number {
  if (flowSpeed === null || velocity === undefined || !(flowSpeed > 0)) return 1;
  const length = vectorLength(acceleration.x, acceleration.y);
  if (length <= 1e-9) return 1;
  const along = (velocity.velocityX * acceleration.x + velocity.velocityY * acceleration.y) / length;
  return clamp(1 - along / flowSpeed, -1, 1);
}

export function sampleForceZone(zone: ForceZoneDefinition, position: Point, timeMs: number, velocity?: ForceVelocity): ForceSample {
  if (zone.kind === "radial-gravity") {
    const dx = zone.center.x - position.x;
    const dy = zone.center.y - position.y;
    const distance = vectorLength(dx, dy);
    if (distance >= zone.radius || distance < 1e-6) {
      return { zoneId: zone.id, acceleration: ZERO, influence: distance < 1e-6 ? 1 : 0, phase: distance < 1e-6 ? "sustain" : "calm", envelope: distance < 1e-6 ? 1 : 0, direction: 1 };
    }
    const edge = smoothstep(0, zone.edgeBlendPx, zone.radius - distance);
    const magnitude = gravityProfile(zone.peakAcceleration, zone.coreRadius, zone.falloff, distance) * edge;
    return {
      zoneId: zone.id,
      acceleration: { x: (dx / distance) * magnitude, y: (dy / distance) * magnitude },
      influence: edge,
      phase: "sustain",
      envelope: 1,
      direction: 1,
    };
  }

  const depth = insideDistance(zone.area, position);
  const influence = depth <= 0 ? 0 : smoothstep(0, zone.edgeBlendPx, depth);
  if (zone.kind === "directional-current") {
    const share = influence * riverShare(zone.acceleration, zone.flowSpeed, velocity);
    return {
      zoneId: zone.id,
      acceleration: { x: zone.acceleration.x * share, y: zone.acceleration.y * share },
      influence,
      phase: influence > 0 ? "sustain" : "calm",
      envelope: influence > 0 ? 1 : 0,
      direction: 1,
    };
  }

  const gust = sampleGustCycle(zone.cycle, timeMs);
  const scale = influence * gust.envelope * gust.direction;
  return {
    zoneId: zone.id,
    acceleration: { x: zone.peakAcceleration.x * scale, y: zone.peakAcceleration.y * scale },
    influence,
    phase: gust.phase,
    envelope: gust.envelope,
    direction: gust.direction,
  };
}

/**
 * Radial pull magnitude before the outer edge blend. Inside the core the pull fades linearly to zero at the
 * centre (no singularity); outside it is flat (`flat`) or falls off as coreRadius / distance (`inverse`).
 * Both are continuous at the core edge, where they equal `peak`.
 */
export function gravityProfile(peak: number, coreRadius: number, falloff: "flat" | "inverse", distance: number): number {
  if (coreRadius <= 0) return falloff === "inverse" ? 0 : peak;
  if (distance <= coreRadius) return peak * clamp(distance / coreRadius, 0, 1);
  return falloff === "inverse" ? peak * (coreRadius / distance) : peak;
}

export type WarpHit = { readonly zoneId: string; readonly warp: GravityWarpDefinition };

/** The first gravity well whose oven mouth contains `position`, or null. */
export function warpAt(zones: readonly ForceZoneDefinition[], position: Point): WarpHit | null {
  for (const zone of zones) {
    if (zone.kind !== "radial-gravity" || zone.warp === null) continue;
    if (vectorLength(position.x - zone.center.x, position.y - zone.center.y) < zone.warp.radius) return { zoneId: zone.id, warp: zone.warp };
  }
  return null;
}

/** Sum of all zones at `position`, capped to `maxAcceleration` (direction preserved). */
export function sampleForceField(
  zones: readonly ForceZoneDefinition[],
  position: Point,
  timeMs: number,
  maxAcceleration: number,
  velocity?: ForceVelocity,
): ForceFieldSample {
  if (zones.length === 0) return { acceleration: ZERO, magnitude: 0, zones: [], dominant: null };
  const samples = zones.map((zone) => sampleForceZone(zone, position, timeMs, velocity));
  let ax = 0;
  let ay = 0;
  let dominant: ForceSample | null = null;
  for (const sample of samples) {
    ax += sample.acceleration.x;
    ay += sample.acceleration.y;
    if (sample.influence > 0 && (dominant === null || sample.influence > dominant.influence)) dominant = sample;
  }
  let magnitude = vectorLength(ax, ay);
  if (magnitude > maxAcceleration && magnitude > 0) {
    const scale = maxAcceleration / magnitude;
    ax *= scale;
    ay *= scale;
    magnitude = maxAcceleration;
  }
  return { acceleration: { x: ax, y: ay }, magnitude, zones: samples, dominant };
}
