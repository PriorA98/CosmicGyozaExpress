import { packageConditionTuning, type PackageConditionTuning } from "../data/packageConditionTuning";
import type { PackageConditionEvent, PackageConditionLabel } from "../types/flight";
import { clamp } from "../utils/math";

/** Clamps any number (including NaN/Infinity from bad data) into the valid condition range. */
export function normalizePackageCondition(condition: number, tuning: PackageConditionTuning = packageConditionTuning): number {
  if (!Number.isFinite(condition)) {
    return condition === Number.NEGATIVE_INFINITY ? tuning.minCondition : tuning.maxCondition;
  }
  return clamp(condition, tuning.minCondition, tuning.maxCondition);
}

export function applyPackageConditionEvent(
  condition: number,
  event: PackageConditionEvent,
  tuning: PackageConditionTuning = packageConditionTuning,
): number {
  return normalizePackageCondition(normalizePackageCondition(condition, tuning) - conditionLoss(event, tuning), tuning);
}

export function packageConditionLabel(
  condition: number,
  tuning: PackageConditionTuning = packageConditionTuning,
): PackageConditionLabel {
  const value = normalizePackageCondition(condition, tuning);
  for (const threshold of tuning.labelThresholds) {
    if (value >= threshold.min) return threshold.label;
  }
  return lastLabel(tuning);
}

/** All labels, warmest first. */
export function packageConditionLabels(tuning: PackageConditionTuning = packageConditionTuning): PackageConditionLabel[] {
  return tuning.labelThresholds.map((threshold) => threshold.label);
}

export function isPackageConditionLabel(
  value: unknown,
  tuning: PackageConditionTuning = packageConditionTuning,
): value is PackageConditionLabel {
  return typeof value === "string" && tuning.labelThresholds.some((threshold) => threshold.label === value);
}

/**
 * Warmth rank of a label: 0 is the warmest ("Perfect"). Unknown strings (old or hand-edited saves)
 * rank after every known label so they never displace a real result.
 */
export function packageConditionWarmth(label: string, tuning: PackageConditionTuning = packageConditionTuning): number {
  const index = tuning.labelThresholds.findIndex((threshold) => threshold.label === label);
  return index === -1 ? tuning.labelThresholds.length : index;
}

function lastLabel(tuning: PackageConditionTuning): PackageConditionLabel {
  const last = tuning.labelThresholds[tuning.labelThresholds.length - 1];
  return last ? last.label : "Basically fine";
}

function conditionLoss(event: PackageConditionEvent, tuning: PackageConditionTuning): number {
  switch (event) {
    case "soft-bump":
      return tuning.softBumpLoss;
    case "dramatic-bump":
      return tuning.dramaticBumpLoss;
    case "gyoza-incident":
      return tuning.incidentLoss;
    case "bumpy-landing":
      return tuning.bumpyLandingLoss;
    case "landing-incident":
      return tuning.landingIncidentLoss;
  }
}
