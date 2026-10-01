import { describe, expect, it } from "vitest";
import { packageConditionTuning } from "../src/data/packageConditionTuning";
import {
  applyPackageConditionEvent,
  isPackageConditionLabel,
  normalizePackageCondition,
  packageConditionLabel,
  packageConditionLabels,
  packageConditionWarmth,
} from "../src/systems/PackageConditionSystem";

describe("package condition", () => {
  it("reduces condition for soft bumps and stays bounded", () => {
    expect(applyPackageConditionEvent(100, "soft-bump")).toBeLessThan(100);
    expect(applyPackageConditionEvent(2, "gyoza-incident")).toBe(0);
  });

  it("handles landing-specific condition events", () => {
    expect(applyPackageConditionEvent(100, "bumpy-landing")).toBeLessThan(100);
    expect(applyPackageConditionEvent(100, "landing-incident")).toBeLessThan(
      applyPackageConditionEvent(100, "bumpy-landing"),
    );
  });

  it("recovers from non-finite or out-of-range condition values", () => {
    expect(normalizePackageCondition(Number.NaN)).toBe(100);
    expect(normalizePackageCondition(Number.POSITIVE_INFINITY)).toBe(100);
    expect(normalizePackageCondition(Number.NEGATIVE_INFINITY)).toBe(0);
    expect(normalizePackageCondition(140)).toBe(100);
    expect(applyPackageConditionEvent(Number.NaN, "soft-bump")).toBe(100 - packageConditionTuning.softBumpLoss);
    expect(packageConditionLabel(-20)).toBe("Basically fine");
    expect(packageConditionLabel(Number.NaN)).toBe("Perfect");
  });

  it("uses warm labels instead of harsh grades", () => {
    expect(packageConditionLabel(100)).toBe("Perfect");
    expect(packageConditionLabel(85)).toBe("Slightly shaken");
    expect(packageConditionLabel(70)).toBe("Emotionally rotated");
    expect(packageConditionLabel(55)).toBe("Warm but confused");
    expect(packageConditionLabel(42)).toBe("Still delicious");
    expect(packageConditionLabel(25)).toBe("Dramatically rearranged");
    expect(packageConditionLabel(5)).toBe("Basically fine");
  });

  it("uses inclusive thresholds", () => {
    for (const threshold of packageConditionTuning.labelThresholds) {
      expect(packageConditionLabel(threshold.min)).toBe(threshold.label);
    }
  });

  it("orders thresholds warmest first and covers the full range", () => {
    const mins = packageConditionTuning.labelThresholds.map((threshold) => threshold.min);
    expect([...mins].sort((a, b) => b - a)).toEqual(mins);
    expect(mins[mins.length - 1]).toBe(packageConditionTuning.minCondition);
  });

  it("ranks warmth for best-result comparisons", () => {
    const labels = packageConditionLabels();
    expect(labels[0]).toBe("Perfect");
    expect(packageConditionWarmth("Perfect")).toBeLessThan(packageConditionWarmth("Basically fine"));
    expect(packageConditionWarmth("something new")).toBe(labels.length);
    expect(isPackageConditionLabel("Still delicious")).toBe(true);
    expect(isPackageConditionLabel("Ruined")).toBe(false);
    expect(isPackageConditionLabel(7)).toBe(false);
  });
});
