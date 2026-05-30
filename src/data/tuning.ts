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
} as const;

export const dockingTuning = {
  maxSpeed: shipTuning.dockingMaxSpeed,
  maxAngleDegrees: shipTuning.dockingMaxAngleDegrees,
  badDockBounceSpeed: 170,
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
  collisionCooldownMs: 280,
} as const;

export const packageConditionTuning = {
  softBumpLoss: 4,
  dramaticBumpLoss: 13,
  incidentLoss: 24,
} as const;

export const respawnTuning = {
  incidentFrameMs: 120,
  respawnDelayMs: 1180,
  invulnerableMs: 760,
} as const;
