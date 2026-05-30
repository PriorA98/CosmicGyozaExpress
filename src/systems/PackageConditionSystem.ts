import { packageConditionTuning } from "../data/tuning";
import type { PackageConditionEvent, PackageConditionLabel } from "../types/flight";
import { clamp } from "../utils/math";

export function applyPackageConditionEvent(
  condition: number,
  event: PackageConditionEvent,
  tuning = packageConditionTuning,
): number {
  return clamp(condition - conditionLoss(event, tuning), 0, 100);
}

export function packageConditionLabel(condition: number): PackageConditionLabel {
  if (condition >= 95) return "Perfect";
  if (condition >= 82) return "Slightly shaken";
  if (condition >= 68) return "Emotionally rotated";
  if (condition >= 54) return "Warm but confused";
  if (condition >= 40) return "Still delicious";
  if (condition >= 22) return "Dramatically rearranged";
  return "Basically fine";
}

function conditionLoss(
  event: PackageConditionEvent,
  tuning: typeof packageConditionTuning,
): number {
  switch (event) {
    case "soft-bump":
      return tuning.softBumpLoss;
    case "dramatic-bump":
      return tuning.dramaticBumpLoss;
    case "gyoza-incident":
      return tuning.incidentLoss;
  }
}
