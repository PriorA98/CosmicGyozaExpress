import type { PackageConditionLabel } from "../types/flight";

export type PackageConditionThreshold = {
  /** Inclusive lower bound of the condition score for this label. */
  readonly min: number;
  readonly label: PackageConditionLabel;
};

/**
 * Package condition tuning. Condition is a 0-100 score that only ever produces warm labels:
 * the lowest label ("Basically fine") is still a successful delivery.
 */
export const packageConditionTuning = {
  maxCondition: 100,
  minCondition: 0,
  softBumpLoss: 4,
  dramaticBumpLoss: 13,
  incidentLoss: 24,
  bumpyLandingLoss: 6,
  landingIncidentLoss: 16,
  /** Ordered warmest first. The last entry must have `min` equal to `minCondition`. */
  labelThresholds: [
    { min: 95, label: "Perfect" },
    { min: 82, label: "Slightly shaken" },
    { min: 68, label: "Emotionally rotated" },
    { min: 54, label: "Warm but confused" },
    { min: 40, label: "Still delicious" },
    { min: 22, label: "Dramatically rearranged" },
    { min: 0, label: "Basically fine" },
  ] satisfies readonly PackageConditionThreshold[],
} as const;

export type PackageConditionTuning = typeof packageConditionTuning;
