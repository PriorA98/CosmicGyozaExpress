import { describe, expect, it } from "vitest";
import { applyDamping, clamp, radiansToCompassDegrees } from "../src/utils/math";

describe("math helpers", () => {
  it("clamps values", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-2, 0, 10)).toBe(0);
    expect(clamp(12, 0, 10)).toBe(10);
  });

  it("converts radians into compass-style degrees", () => {
    expect(radiansToCompassDegrees(0)).toBe(0);
    expect(radiansToCompassDegrees(Math.PI / 2)).toBe(90);
    expect(radiansToCompassDegrees(Math.PI)).toBe(180);
  });

  it("applies frame-rate-aware damping", () => {
    expect(applyDamping(100, 0.1, 1)).toBe(90);
  });
});
