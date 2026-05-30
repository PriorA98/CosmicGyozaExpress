import { describe, expect, it } from "vitest";
import { applyPackageConditionEvent, packageConditionLabel } from "../src/systems/PackageConditionSystem";

describe("package condition", () => {
  it("reduces condition for soft bumps and stays bounded", () => {
    expect(applyPackageConditionEvent(100, "soft-bump")).toBeLessThan(100);
    expect(applyPackageConditionEvent(2, "gyoza-incident")).toBe(0);
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
});
