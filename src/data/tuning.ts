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
  bumpyLandingLoss: 6,
  landingIncidentLoss: 16,
} as const;

export const respawnTuning = {
  incidentFrameMs: 120,
  respawnDelayMs: 1180,
  invulnerableMs: 760,
} as const;

export const arrivalGateTuning = {
  stableReadyMs: 520,
} as const;

export const landingTuning = {
  maxDeltaSeconds: 1 / 30,
  gravityAcceleration: 138,
  thrusterAcceleration: 270,
  rotationAcceleration: 5.2,
  angularDamping: 1.45,
  linearDamping: 0.018,
  stabilizerAngularDamping: 5.8,
  stabilizerUprightStrength: 3.2,
  shipRadius: 52,
  padWidth: 320,
  surfaceY: 612,
  startX: 640,
  startY: 150,
  startVelocityY: 22,
  safeVerticalSpeed: 84,
  safeHorizontalSpeed: 68,
  safeAngleDegrees: 22,
  bumpyVerticalSpeed: 145,
  bumpyHorizontalSpeed: 122,
  bumpyAngleDegrees: 36,
  settleDurationMs: 880,
  incidentRestartMs: 1220,
} as const;
