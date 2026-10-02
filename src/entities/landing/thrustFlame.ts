/**
 * Pure thrust-flame logic for the landing ship (no Phaser imports, unit-tested). The flame itself is
 * baked into the ship art (ship-fly-1..3); this only decides how lit it is and which frame shows.
 */
export type ThrustFlameTuning = {
  /** Power gained per second while thrust is held (0..1). */
  readonly ignitePerSecond: number;
  /** Power lost per second after release. */
  readonly fadePerSecond: number;
  /** Power at or above which ship-fly-2 / ship-fly-3 show. */
  readonly fly2Power: number;
  readonly fly3Power: number;
  /** Below this power the flame is out (idle frame). */
  readonly litPower: number;
  /** Full-power flicker: frame (1..3) shown in each `flickerStepMs` slot. */
  readonly flickerFrames: readonly number[];
  readonly flickerStepMs: number;
};

/** 0 = flame out (idle art), 1..3 = ship-fly-1..3. */
export type ThrustFlameFrame = 0 | 1 | 2 | 3;

/** Moves thrust power toward 1 while held and toward 0 after release, clamped to 0..1. */
export function stepThrustPower(power: number, held: boolean, deltaSeconds: number, tuning: ThrustFlameTuning): number {
  const dt = Number.isFinite(deltaSeconds) ? Math.max(0, deltaSeconds) : 0;
  const current = Number.isFinite(power) ? Math.min(1, Math.max(0, power)) : 0;
  const next = held ? current + tuning.ignitePerSecond * dt : current - tuning.fadePerSecond * dt;
  return Math.min(1, Math.max(0, next));
}

function asFrame(value: number | undefined): ThrustFlameFrame {
  if (value === 1 || value === 2 || value === 3) return value;
  return 3;
}

/** Which baked flame frame to show for a thrust power; at full power it flickers between big frames. */
export function thrustFlameFrame(power: number, timeMs: number, tuning: ThrustFlameTuning): ThrustFlameFrame {
  if (!(power >= tuning.litPower)) return 0;
  if (power < tuning.fly2Power) return 1;
  if (power < tuning.fly3Power) return 2;
  const frames = tuning.flickerFrames;
  if (frames.length === 0 || tuning.flickerStepMs <= 0) return 3;
  const slot = Math.floor(Math.max(0, timeMs) / tuning.flickerStepMs) % frames.length;
  return asFrame(frames[slot]);
}
