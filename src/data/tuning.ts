export const shipTuning = {
  thrustAcceleration: 420,
  brakeAcceleration: 520,
  rotationSpeed: 3.7,
  linearDamping: 0.04,
  maxSoftSpeed: 340,
  overspeedDrag: 0.9,
  cozyAssistStrength: 0.18,
  maxDeltaSeconds: 1 / 20,
  collisionRadius: 42,
  collisionDangerSpeed: 190,
  dockingMaxSpeed: 70,
  dockingMaxAngleDegrees: 45,
} as const;

export const cameraTuning = {
  followLerpX: 0.08,
  followLerpY: 0.08,
  /** Gentle look-ahead: the camera leads the ship by velocity * seconds, clamped per axis. */
  lookAheadSeconds: 0.55,
  maxLookAheadX: 170,
  maxLookAheadY: 96,
  /** How quickly the look-ahead offset eases toward its target (fraction per second). */
  lookAheadEasePerSecond: 2.4,
} as const;

export const dockingTuning = {
  maxSpeed: shipTuning.dockingMaxSpeed,
  maxAngleDegrees: shipTuning.dockingMaxAngleDegrees,
  badDockBounceSpeed: 170,
  badDockPushPx: 10,
  badDockCooldownMs: 850,
} as const;

export const collisionTuning = {
  softBumpMaxSpeed: 95,
  dramaticBumpMaxSpeed: 245,
  softBumpBounce: 0.38,
  dramaticBumpBounce: 0.62,
  incidentBounce: 0.24,
  boundaryBounce: 0.42,
  separationPadding: 1.5,
  /** Outward nudge when the ship is already moving away from the rock it overlaps (px/s). */
  softNudgeSpeed: 24,
  dramaticNudgeSpeed: 54,
  collisionCooldownMs: 280,
} as const;

export const respawnTuning = {
  incidentFrameMs: 120,
  incidentFrameCount: 5,
  respawnDelayMs: 1180,
  /** Extra beat after respawn before controls return. */
  resumeDelayMs: 240,
  invulnerableMs: 760,
  /** Brief grace after (re)starting the route. */
  restartGraceMs: 320,
} as const;

export const arrivalGateTuning = {
  stableReadyMs: 520,
  /** `flight:arrival-progress` is throttled to at most one event per this many ms (<= 10 Hz). */
  progressEventIntervalMs: 100,
  /** Fade to the landing scene once the window completes. */
  handoffFadeMs: 320,
} as const;

/** How long dashboard notes stay before the live docking hint returns (ms). */
export const flightNoteTuning = {
  defaultMs: 1800,
  startMs: 2200,
  incidentExtraMs: 1200,
} as const;
