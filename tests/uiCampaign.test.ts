import { describe, expect, it } from "vitest";
import { ASSET, CAMPAIGN_POSTCARD_FRAME } from "../src/data/assetManifest";
import { MISSION_IDS } from "../src/data/campaign";
import { routeLogCopy, titleCopy } from "../src/data/uiCopy";
import { normalizeCampaignProgress } from "../src/systems/CampaignSystem";
import { campaignRouteLog, titleDeliveryAction, titleMissionPresentation } from "../src/ui/campaignMenu";

describe("campaign title actions", () => {
  it("keeps the original Tea Moon launch on a fresh save, including an unlocked-only save", () => {
    for (const unlocked of [[], MISSION_IDS]) {
      expect(titleDeliveryAction(normalizeCampaignProgress([], unlocked))).toEqual({
        kind: "launch-tea", missionId: "tea-moon", label: titleCopy.startButton,
      });
    }
  });

  it("opens the board on the next available stop after each delivery", () => {
    for (let completedCount = 1; completedCount < MISSION_IDS.length; completedCount += 1) {
      const action = titleDeliveryAction(normalizeCampaignProgress(MISSION_IDS.slice(0, completedCount), []));
      expect(action.kind).toBe("board");
      if (action.kind === "board") expect(action.focusMissionId).toBe(MISSION_IDS[completedCount]);
    }
  });

  it("opens the stamped board focused on home after all six deliveries", () => {
    expect(titleDeliveryAction(normalizeCampaignProgress(MISSION_IDS, []))).toEqual({
      kind: "board", focusMissionId: "home-delivery", label: titleCopy.boardPrimaryButton,
    });
  });

  it("handles nonsequential completions without treating Tea Moon as delivered", () => {
    expect(titleDeliveryAction(normalizeCampaignProgress(["im-fine"], []))).toMatchObject({
      kind: "board", focusMissionId: "tea-moon",
    });
  });
});

describe("campaign route log", () => {
  it("keeps the legacy Tea Moon postcard, caption and single-entry presentation", () => {
    const log = campaignRouteLog(normalizeCampaignProgress(["tea-moon"], []));
    expect(log.postcardKey).toBe(ASSET.memoryPostcard);
    expect(log.postcardFrame).toBeUndefined();
    expect(log.copy.entryTitle).toBe(routeLogCopy.entryTitle);
    expect(log.copy.postcardCaption).toBe(routeLogCopy.postcardCaption);
    expect(log.history).toBeUndefined();
  });

  it("uses the campaign postcard frame and ordered mission titles after multiple deliveries", () => {
    const log = campaignRouteLog(normalizeCampaignProgress(["bento-belt", "tea-moon", "matcha-nebula"], []));
    expect(log.missionId).toBe("matcha-nebula");
    expect(log.postcardKey).toBe(ASSET.campaignPostcards);
    expect(log.postcardFrame).toBe(CAMPAIGN_POSTCARD_FRAME.matcha);
    expect(log.history?.entries.map((entry) => entry.title)).toEqual(["Tea Moon", "Bento Belt", "Matcha Nebula"]);
    expect(log.history?.entries[1]?.detail).toBe("Mallow");
  });

  it("includes all six delivered stops without adding locked stops or inferring completion", () => {
    expect(campaignRouteLog(normalizeCampaignProgress(MISSION_IDS, [])).history?.entries).toHaveLength(6);
    const log = campaignRouteLog(normalizeCampaignProgress(["im-fine"], []));
    expect(log.missionId).toBe("im-fine");
    expect(log.history).toBeUndefined();
  });
});

describe("suggested title delivery card", () => {
  it("keeps the fresh Tea portrait and awaiting copy", () => {
    const card = titleMissionPresentation(normalizeCampaignProgress([], []));
    expect(card.mission.id).toBe("tea-moon");
    expect(card.theme.portraitTexture).toBe(ASSET.rabbitPortrait);
    expect(card.pillLabel).toBe(titleCopy.awaitingPill);
    expect(card.delivered).toBe(false);
  });

  it("matches the CTA at every stage instead of repeating the Tea recipient", () => {
    for (let count = 1; count < MISSION_IDS.length; count += 1) {
      const progress = normalizeCampaignProgress(MISSION_IDS.slice(0, count), []);
      const card = titleMissionPresentation(progress);
      const action = titleDeliveryAction(progress);
      expect(card.mission.id).toBe(MISSION_IDS[count]);
      if (action.kind === "board") expect(card.mission.id).toBe(action.focusMissionId);
      expect(card.theme.legacy).toBe(false);
      expect(card.theme.cargoFrame).not.toBeNull();
      expect(card.delivered).toBe(false);
    }
    const complete = titleMissionPresentation(normalizeCampaignProgress(MISSION_IDS, []));
    expect(complete.mission.recipientName).toBe("You");
    expect(complete.delivered).toBe(true);
  });
});
