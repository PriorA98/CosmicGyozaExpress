import { describe, expect, it } from "vitest";
import { TEA_MOON_MISSION_ID, teaMoonMission } from "../src/data/missions";
import { resultCopy, resultCopyBannedWords } from "../src/data/resultCopy";
import {
  createDeliveryResultContent,
  createDeliveryResultPresentation,
  createMissionResultSummary,
  describeRouteTime,
  formatRouteTime,
  isWarmerResult,
  normalizeDeliveryResultData,
  pickWarmerResult,
} from "../src/systems/MissionResultSystem";
import type { DeliveryResultSceneData } from "../src/types/landing";
import type { MissionResultSummary } from "../src/types/save";

const softDelivery: DeliveryResultSceneData = {
  missionId: TEA_MOON_MISSION_ID,
  packageCondition: 100,
  routeCrashes: 0,
  routeDurationMs: 74_000,
  landingResult: "soft",
  landingIncidents: 0,
};

const bumpyDelivery: DeliveryResultSceneData = {
  missionId: TEA_MOON_MISSION_ID,
  packageCondition: 58,
  routeCrashes: 2,
  routeDurationMs: 131_000,
  landingResult: "bumpy",
  landingIncidents: 1,
};

const firstVisit = { previousDeliveries: 0, memoryAlreadyCollected: false } as const;

function summary(overrides: Partial<MissionResultSummary>): MissionResultSummary {
  return { completedAt: "2026-06-01T00:00:00.000Z", conditionLabel: "Perfect", crashes: 0, durationMs: 60_000, ...overrides };
}

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const item of value) collectStrings(item, out);
  else if (typeof value === "object" && value !== null) for (const item of Object.values(value)) collectStrings(item, out);
  return out;
}

describe("createDeliveryResultContent", () => {
  it("creates warm Tea Moon result content from delivery data", () => {
    const result = createDeliveryResultContent({ ...bumpyDelivery, packageCondition: 88 });

    expect(result.headline).toBe(resultCopy.headlines.bumpy);
    expect(result.conditionLabel).toBe("Slightly shaken");
    expect(result.landingLabel).toContain("spirited");
    expect(result.totalCrashes).toBe(3);
    expect(result.reportLine).toBe(teaMoonMission.resultLines["Slightly shaken"]);
    expect(resultCopy.reactionLines.bumpy).toContain(result.reactionLine);
  });

  it("picks reaction lines deterministically", () => {
    expect(createDeliveryResultContent(softDelivery).reactionLine).toBe(
      createDeliveryResultContent(softDelivery).reactionLine,
    );
  });

  it("falls back to Tea Moon for unknown missions instead of throwing", () => {
    const result = createDeliveryResultContent({ ...softDelivery, missionId: "mystery-planet" });

    expect(result.missionId).toBe(TEA_MOON_MISSION_ID);
  });
});

describe("normalizeDeliveryResultData", () => {
  it("repairs partial and hostile scene data", () => {
    const hostile = JSON.parse(
      '{"packageCondition":"lots","routeCrashes":-3,"routeDurationMs":null,"landingResult":"sideways","landingIncidents":2.7}',
    ) as Partial<DeliveryResultSceneData>;

    expect(normalizeDeliveryResultData(hostile)).toEqual({
      missionId: TEA_MOON_MISSION_ID,
      packageCondition: 100,
      routeCrashes: 0,
      routeDurationMs: 0,
      landingResult: "soft",
      landingIncidents: 2,
    });
    expect(normalizeDeliveryResultData(undefined).landingResult).toBe("soft");
  });
});

describe("createMissionResultSummary", () => {
  it("creates a save summary from result content", () => {
    const content = createDeliveryResultContent({ ...softDelivery, routeDurationMs: 10_000 });

    const result = createMissionResultSummary(content);

    expect(result.conditionLabel).toBe("Perfect");
    expect(result.crashes).toBe(0);
    expect(result.durationMs).toBe(10_000);
    expect(Date.parse(result.completedAt)).not.toBeNaN();
  });
});

describe("best result", () => {
  it("prefers a warmer package label", () => {
    expect(isWarmerResult(summary({ conditionLabel: "Perfect" }), summary({ conditionLabel: "Still delicious" }))).toBe(true);
    expect(isWarmerResult(summary({ conditionLabel: "Still delicious" }), summary({ conditionLabel: "Perfect" }))).toBe(false);
  });

  it("breaks ties with fewer bumps, then a quicker route", () => {
    expect(isWarmerResult(summary({ crashes: 0 }), summary({ crashes: 2 }))).toBe(true);
    expect(isWarmerResult(summary({ durationMs: 50_000 }), summary({ durationMs: 60_000 }))).toBe(true);
    expect(isWarmerResult(summary({ durationMs: 60_000 }), summary({ durationMs: 60_000 }))).toBe(false);
  });

  it("never replaces a known result with an unknown label", () => {
    expect(isWarmerResult(summary({ conditionLabel: "???" }), summary({ conditionLabel: "Basically fine" }))).toBe(false);
  });

  it("keeps the warmer of previous and new", () => {
    const warm = summary({ conditionLabel: "Perfect" });
    const cool = summary({ conditionLabel: "Dramatically rearranged", crashes: 4 });

    expect(pickWarmerResult(warm, cool)).toBe(warm);
    expect(pickWarmerResult(cool, warm)).toBe(warm);
    expect(pickWarmerResult(undefined, cool)).toBe(cool);
  });
});

describe("createDeliveryResultPresentation", () => {
  it("phrases a clean first delivery kindly", () => {
    const view = createDeliveryResultPresentation(softDelivery, firstVisit);

    expect(view.landingStamp).toEqual(resultCopy.landingStamps.soft);
    expect(view.conditionStamp).toEqual({ label: "perfect", tone: "sage" });
    expect(view.stats.map((stat) => stat.text)).toEqual([
      "1m 14s of scenic flying",
      "not a single bump",
      "landed on the first try",
    ]);
    expect(view.deliveryNote).toBe(resultCopy.deliveryNote.first);
    expect(view.postcardLabel).toBe(resultCopy.postcard.firstLabel);
    expect(view.isNewWarmest).toBe(false);
  });

  it("phrases a bumpy repeat delivery without judgement", () => {
    const view = createDeliveryResultPresentation(bumpyDelivery, {
      previousDeliveries: 2,
      previousBest: summary({ conditionLabel: "Perfect" }),
      memoryAlreadyCollected: true,
    });

    expect(view.stats.map((stat) => stat.text)).toEqual([
      "2m 11s of scenic flying",
      "2 friendly bumps along the way",
      "landed on try 2 · the moon waited",
    ]);
    expect(view.deliveryNote).toBe("delivery no. 3 to the tea moon");
    expect(view.postcardLabel).toBe(resultCopy.postcard.repeatLabel);
  });

  it("celebrates a new warmest result", () => {
    const view = createDeliveryResultPresentation(softDelivery, {
      previousDeliveries: 1,
      previousBest: summary({ conditionLabel: "Still delicious", crashes: 3 }),
      memoryAlreadyCollected: true,
    });

    expect(view.isNewWarmest).toBe(true);
    expect(view.deliveryNote).toBe(resultCopy.deliveryNote.warmestPage);
  });

  it("handles many landing tries and zero route time", () => {
    const view = createDeliveryResultPresentation(
      { ...softDelivery, landingIncidents: 3, routeDurationMs: 0 },
      firstVisit,
    );

    expect(view.stats[0]?.text).toBe(resultCopy.stats.routeTime.unhurried);
    expect(view.stats[2]?.text).toBe("landed on try 4 · the moon waited");
  });
});

describe("route time", () => {
  it("formats durations compactly", () => {
    expect(formatRouteTime(74_000)).toBe("1m 14s");
    expect(formatRouteTime(9_400)).toBe("9s");
    expect(formatRouteTime(Number.NaN)).toBe("0s");
    expect(describeRouteTime(-5)).toBe(resultCopy.stats.routeTime.unhurried);
  });
});

describe("result copy tone", () => {
  it("never uses diet, moral, or shame language", () => {
    const strings = [...collectStrings(resultCopy), ...collectStrings(teaMoonMission)];
    expect(strings.length).toBeGreaterThan(20);

    for (const text of strings) {
      for (const word of resultCopyBannedWords) {
        expect(text.toLowerCase(), `"${text}" contains "${word}"`).not.toMatch(new RegExp(`\\b${word}`));
      }
    }
  });

  it("has a reaction line for every landing result", () => {
    for (const lines of Object.values(resultCopy.reactionLines)) {
      expect(lines.length).toBeGreaterThan(0);
    }
  });
});
