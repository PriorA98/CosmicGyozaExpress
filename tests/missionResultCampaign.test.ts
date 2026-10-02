import { describe, expect, it } from "vitest";
import { MISSION_IDS, campaignMissions, resolveMission } from "../src/data/campaign";
import { missionResultCopy, resultCopy, resultCopyBannedWords } from "../src/data/resultCopy";
import { normalizeCampaignProgress } from "../src/systems/CampaignSystem";
import {
  createDeliveryResultContent,
  createDeliveryResultPresentation,
  resultActionsFor,
  thankYouNotes,
} from "../src/systems/MissionResultSystem";
import type { MissionId } from "../src/types/campaign";
import type { DeliveryResultSceneData } from "../src/types/landing";

function data(missionId: MissionId, overrides: Partial<DeliveryResultSceneData> = {}): DeliveryResultSceneData {
  return {
    missionId,
    packageCondition: 96,
    routeCrashes: 0,
    routeDurationMs: 60_000,
    landingResult: "soft",
    landingIncidents: 0,
    ...overrides,
  };
}

const fresh = { previousDeliveries: 0, memoryAlreadyCollected: false } as const;

function progressBefore(missionId: MissionId) {
  const index = MISSION_IDS.indexOf(missionId);
  const done = MISSION_IDS.slice(0, index);
  return normalizeCampaignProgress(done, [missionId]);
}

describe("mission-aware result presentation", () => {
  it.each(MISSION_IDS.map((id) => [id]))("%s uses its own recipient, item, lines and postcard", (id) => {
    const mission = resolveMission(id);
    const view = createDeliveryResultPresentation(data(id), { ...fresh, progress: progressBefore(id) });
    expect(view.missionId).toBe(id);
    expect(view.content.recipientName).toBe(mission.recipientName);
    expect(view.content.deliveryItemName).toBe(mission.deliveryItemName);
    expect(view.content.landingLabel).toBe(mission.landingLines.soft);
    expect(view.content.reportLine).toBe(mission.resultLines[view.content.conditionLabel]);
    expect(view.content.memoryRewardId).toBe(mission.memoryRewardId);
    expect(missionResultCopy[id].reactionLines.soft).toContain(view.content.reactionLine);
    expect(view.postcardTitle).toBe(missionResultCopy[id].postcardTitle);
    expect(view.recipientCaption).toBe(missionResultCopy[id].recipientCaption);
    expect(view.closingLine).toBe(mission.closingLine);
    expect(view.deliveryNote).toBe(missionResultCopy[id].deliveryNote.first);
  });

  it("keeps Tea Moon on the slice copy and actions", () => {
    const view = createDeliveryResultPresentation(data("tea-moon"), fresh);
    expect(view.legacy).toBe(true);
    expect(view.postcardTitle).toBe(resultCopy.postcard.title);
    expect(view.recipientCaption).toBe(resultCopy.recipientCaption);
    expect(view.kickerPlace).toBe("tea moon");
    expect(view.actions.map((action) => action.kind)).toEqual(["back-to-title", "fly-again"]);
  });

  it("falls back to Tea Moon for unknown missions", () => {
    expect(createDeliveryResultContent({ ...data("tea-moon"), missionId: "galaxy-finale" }).missionId).toBe("tea-moon");
  });

  it("shows the I'm Fine closing line", () => {
    const view = createDeliveryResultPresentation(data("im-fine"), { ...fresh, progress: progressBefore("im-fine") });
    expect(view.closingLine).toBe(resolveMission("im-fine").closingLine);
    expect(view.isEnding).toBe(false);
  });

  it("offers next delivery, board and replay on campaign cards", () => {
    const view = createDeliveryResultPresentation(data("bento-belt"), { ...fresh, progress: progressBefore("bento-belt") });
    expect(view.actions.map((action) => [action.kind, action.missionId])).toEqual([
      ["fly-again", "bento-belt"],
      ["delivery-board", "matcha-nebula"],
      ["next-delivery", "matcha-nebula"],
    ]);
    expect(view.actions.filter((action) => action.variant === "primary")).toHaveLength(1);
  });

  it("falls back to the board when the next mission is not unlocked", () => {
    const actions = resultActionsFor("matcha-nebula", normalizeCampaignProgress([], ["matcha-nebula"]));
    expect(actions.map((action) => action.kind)).toEqual(["fly-again", "delivery-board"]);
  });

  it("assigns each keyboard code to at most one action", () => {
    for (const id of MISSION_IDS) {
      const codes = resultActionsFor(id, progressBefore(id)).flatMap((action) => action.codes);
      expect(new Set(codes).size).toBe(codes.length);
    }
  });
});

describe("final delivery card", () => {
  it("thanks only completed deliveries, in board order", () => {
    const progress = normalizeCampaignProgress(["tea-moon", "matcha-nebula"], [...MISSION_IDS]);
    expect(thankYouNotes(progress)).toEqual([missionResultCopy["tea-moon"].thankYouNote, missionResultCopy["matcha-nebula"].thankYouNote]);
  });

  it("is the ending with notes, board and fly home actions", () => {
    const progress = normalizeCampaignProgress(MISSION_IDS.slice(0, 5), [...MISSION_IDS]);
    const view = createDeliveryResultPresentation(data("home-delivery"), { ...fresh, progress });
    expect(view.isEnding).toBe(true);
    expect(view.thankYouNotes).toHaveLength(5);
    expect(view.closingLine).toBe(resolveMission("home-delivery").closingLine);
    expect(view.actions.map((action) => action.kind)).toEqual(["read-notes", "delivery-board", "fly-again"]);
  });

  it("has no notes when nothing else was completed", () => {
    const view = createDeliveryResultPresentation(data("home-delivery"), fresh);
    expect(view.thankYouNotes).toEqual([]);
  });
});

describe("campaign result copy tone", () => {
  it("never uses banned words", () => {
    const strings: string[] = [];
    const walk = (value: unknown): void => {
      if (typeof value === "string") strings.push(value);
      else if (value && typeof value === "object") Object.values(value).forEach(walk);
    };
    walk(missionResultCopy);
    walk(campaignMissions.map((mission) => [mission.resultLines, mission.landingLines, mission.closingLine]));
    for (const text of strings) {
      for (const word of resultCopyBannedWords) {
        expect(text.toLowerCase(), `"${text}" contains "${word}"`).not.toMatch(new RegExp(`\\b${word}`));
      }
    }
  });

  it("has reaction lines for every mission and landing result", () => {
    for (const id of MISSION_IDS) {
      for (const lines of Object.values(missionResultCopy[id].reactionLines)) expect(lines.length).toBeGreaterThan(0);
    }
  });
});
