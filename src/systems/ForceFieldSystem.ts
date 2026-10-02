/**
 * Environmental forces (currents, gusts, bounded radial gravity). Pure: no Phaser, no clocks.
 * One sample drives both physics and the on-screen cue, so a cue never disagrees with the push.
 */
import type { ForceZoneDefinition, GustCycle, GustPhase, Vector2, ZoneShape } from "../types/campaign";
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
};

/** Gust envelope at `timeMs`: zero in warning/calm, smoothstep up in attack, 1 in sustain, smoothstep down in release. */
export function sampleGustCycle(cycle: GustCycle, timeMs: number): GustState {
  const length = gustCycleLength(cycle);
  if (!(length > 0)) return { phase: "calm", envelope: 0, msUntilGust: 0, phaseProgress: 0 };
  const t = (((timeMs + cycle.phaseOffsetMs) % length) + length) % length;
  const warningEnd = cycle.warningMs;
  const attackEnd = warningEnd + cycle.attackMs;
  const sustainEnd = attackEnd + cycle.sustainMs;
  const releaseEnd = sustainEnd + cycle.releaseMs;
  const progress = (start: number, duration: number): number => (duration > 0 ? clamp((t - start) / duration, 0, 1) : 1);
  if (t < warningEnd) return { phase: "warning", envelope: 0, msUntilGust: warningEnd - t, phaseProgress: progress(0, cycle.warningMs) };
  if (t < attackEnd) {
    const p = progress(warningEnd, cycle.attackMs);
    return { phase: "attack", envelope: smoothstep(0, 1, p), msUntilGust: 0, phaseProgress: p };
  }
  if (t < sustainEnd) return { phase: "sustain", envelope: 1, msUntilGust: 0, phaseProgress: progress(attackEnd, cycle.sustainMs) };
  if (t < releaseEnd) {
    const p = progress(sustainEnd, cycle.releaseMs);
    return { phase: "release", envelope: 1 - smoothstep(0, 1, p), msUntilGust: 0, phaseProgress: p };
  }
  return { phase: "calm", envelope: 0, msUntilGust: length - t + cycle.warningMs, phaseProgress: progress(releaseEnd, cycle.calmMs) };
}

export function sampleForceZone(zone: ForceZoneDefinition, position: Point, timeMs: number): ForceSample {
  if (zone.kind === "radial-gravity") {
    const dx = zone.center.x - position.x;
    const dy = zone.center.y - position.y;
    const distance = vectorLength(dx, dy);
    if (distance >= zone.radius || distance < 1e-6) {
      return { zoneId: zone.id, acceleration: ZERO, influence: distance < 1e-6 ? 1 : 0, phase: distance < 1e-6 ? "sustain" : "calm", envelope: distance < 1e-6 ? 1 : 0 };
    }
    const core = zone.coreRadius > 0 ? clamp(distance / zone.coreRadius, 0, 1) : 1;
    const edge = smoothstep(0, zone.edgeBlendPx, zone.radius - distance);
    const magnitude = zone.peakAcceleration * core * edge;
    return {
      zoneId: zone.id,
      acceleration: { x: (dx / distance) * magnitude, y: (dy / distance) * magnitude },
      influence: edge,
      phase: "sustain",
      envelope: 1,
    };
  }

  const depth = insideDistance(zone.area, position);
  const influence = depth <= 0 ? 0 : smoothstep(0, zone.edgeBlendPx, depth);
  if (zone.kind === "directional-current") {
    return {
      zoneId: zone.id,
      acceleration: { x: zone.acceleration.x * influence, y: zone.acceleration.y * influence },
      influence,
      phase: influence > 0 ? "sustain" : "calm",
      envelope: influence > 0 ? 1 : 0,
    };
  }

  const gust = sampleGustCycle(zone.cycle, timeMs);
  const scale = influence * gust.envelope;
  return {
    zoneId: zone.id,
    acceleration: { x: zone.peakAcceleration.x * scale, y: zone.peakAcceleration.y * scale },
    influence,
    phase: gust.phase,
    envelope: gust.envelope,
  };
}

/** Sum of all zones at `position`, capped to `maxAcceleration` (direction preserved). */
export function sampleForceField(
  zones: readonly ForceZoneDefinition[],
  position: Point,
  timeMs: number,
  maxAcceleration: number,
): ForceFieldSample {
  if (zones.length === 0) return { acceleration: ZERO, magnitude: 0, zones: [], dominant: null };
  const samples = zones.map((zone) => sampleForceZone(zone, position, timeMs));
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
