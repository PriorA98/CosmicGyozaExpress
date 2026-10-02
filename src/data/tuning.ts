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
  /**
   * Near the Tea Moon the camera target blends toward this framing point so the ship, the ring
   * and the whole moon (teahouse included) stay in frame. Blend is 0 at `moonFramingRadius` from
   * the dock and reaches its per-axis maximum once the ship is inside the approach radius.
   */
  moonFramingPoint: { x: 2640, y: 850 },
  moonFramingRadius: 1000,
  moonFramingMaxBlendX: 0.85,
  moonFramingMaxBlendY: 0.6,
  /** The framed target never pushes the ship closer than this to the view edge (screen px). */
  framingSafeMarginPx: 150,
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
} as const;

/**
 * Warm hand-off from flight to landing once the landing window completes (total <= 1.2 s):
 * input locks, the camera eases onto the Tea Moon while the ship glides toward it, then an iris
 * closes on the moon and LandingScene starts.
 */
export const arrivalHandoffTuning = {
  /** Camera pan onto the moon centre. */
  panMs: 720,
  /** The iris starts this long after the window completes and runs for `irisMs`. */
  irisDelayMs: 420,
  irisMs: 640,
  /** Gentle glide toward the moon during the hand-off (px/s). */
  glideSpeed: 70,
  /** Arrival note stays this long (covers the whole hand-off). */
  noteMs: 2400,
} as const;

/** How long dashboard notes stay before the live docking hint returns (ms). */
export const flightNoteTuning = {
  defaultMs: 1800,
  startMs: 2200,
  incidentExtraMs: 1200,
} as const;
