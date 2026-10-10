/**
 * Tea Moon landing rules and feel. Units: px, px/s, px/s², rad/s, degrees for angle thresholds, ms for durations.
 * The e2e pilot (e2e/playtest.mjs) assumes `shipRadius` 52 and a soft target near 38 px/s, so keep the
 * classification thresholds generous and the radius stable when tuning feel.
 */
export const landingTuning = {
  maxDeltaSeconds: 1 / 30,
  gravityAcceleration: 138,
  thrusterAcceleration: 270,
  /** World-space side puffers, independent of the bottom thruster. */
  lateralAcceleration: 230,
  maxLeanRadians: 0.28,
  leanRate: 4,
  /** S removes pad-relative drift, capped so strong wind still needs side puffers. */
  steadyAcceleration: 55,
  lateralDrag: 0.6,
  linearDamping: 0.018,
  /** Shared dev pilot's PD gains, tolerances and descent targets. */
  pilotPositionGain: 1.8,
  pilotVelocityGain: 3,
  pilotAccelerationDeadband: 10,
  pilotSteadyPositionTolerance: 12,
  pilotSteadyVelocityTolerance: 8,
  pilotCorrectionAltitude: 220,
  pilotCorrectionPadShare: 0.22,
  pilotCorrectionDescent: 18,
  pilotBumpyDescent: 110,
  pilotSoftCruiseDescent: 130,
  pilotBumpyCruiseDescent: 155,
  pilotDescentAltitudeGain: 0.16,
  /** Small side exhaust uses the shared trail helper. */
  sidePuffOffset: 42,
  sidePuffIntensity: 0.22,
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
  /** Incident shape: a rough touchdown counts as a skid when sideways speed is at least this share of the drop speed. */
  skidHorizontalToVerticalRatio: 0.58,
  /** Top of the descent gauge (px/s); faster descents pin the needle at the bottom of the brick band. */
  descentGaugeMaxSpeed: 200,
  /** Time on the pad before the result card: long enough for the lanterns and the rabbit's wave to read. */
  settleDurationMs: 1650,
  /** Comedic incident beat before the landing-only retry begins (R / the touch chip retries at once). */
  incidentRestartMs: 1100,
} as const;

export type LandingTuning = { readonly [K in keyof typeof landingTuning]: number };
