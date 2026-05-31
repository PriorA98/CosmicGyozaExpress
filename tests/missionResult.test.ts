import { describe, expect, it } from "vitest";
import { TEA_MOON_MISSION_ID } from "../src/data/missions";
import { createDeliveryResultContent, createMissionResultSummary } from "../src/systems/MissionResultSystem";

describe("mission result", () => {
  it("creates warm Tea Moon result content from delivery data", () => {
    const result = createDeliveryResultContent({
      missionId: TEA_MOON_MISSION_ID,
      packageCondition: 88,
      routeCrashes: 1,
      routeDurationMs: 12_000,
      landingResult: "bumpy",
      landingIncidents: 1,
    });

    expect(result.headline).toBe("delivery accepted");
    expect(result.conditionLabel).toBe("Slightly shaken");
    expect(result.landingLabel).toContain("spirited");
    expect(result.totalCrashes).toBe(2);
  });

  it("creates a save summary from result content", () => {
    const content = createDeliveryResultContent({
      missionId: TEA_MOON_MISSION_ID,
      packageCondition: 100,
      routeCrashes: 0,
      routeDurationMs: 10_000,
      landingResult: "soft",
      landingIncidents: 0,
    });

    const summary = createMissionResultSummary(content);

    expect(summary.conditionLabel).toBe("Perfect");
    expect(summary.crashes).toBe(0);
    expect(summary.durationMs).toBe(10_000);
    expect(Date.parse(summary.completedAt)).not.toBeNaN();
  });
});
