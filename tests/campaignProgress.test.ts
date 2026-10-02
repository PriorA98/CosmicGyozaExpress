import { describe, expect, it } from "vitest";
import { MISSION_IDS } from "../src/data/campaign";
import {
  isCampaignComplete,
  missionBoard,
  nextMissionAfter,
  nextSuggestedMission,
  normalizeCampaignProgress,
  unlocksAfterCompleting,
} from "../src/systems/CampaignSystem";

describe("normalizeCampaignProgress", () => {
  it("starts with only Tea Moon unlocked", () => {
    expect(normalizeCampaignProgress([], [])).toEqual({ completedMissions: [], unlockedMissions: ["tea-moon"] });
  });

  it("unlocks each completed mission and its declared next mission", () => {
    const progress = normalizeCampaignProgress(["tea-moon"], []);
    expect(progress.unlockedMissions).toEqual(["tea-moon", "bento-belt"]);
  });

  it("ignores unknown and duplicate ids, including non-strings", () => {
    const progress = normalizeCampaignProgress(["tea-moon", "tea-moon", 3, null, "x"], ["???", {}]);
    expect(progress).toEqual({ completedMissions: ["tea-moon"], unlockedMissions: ["tea-moon", "bento-belt"] });
  });
});

describe("campaign flow", () => {
  it("follows the linear board order", () => {
    let progress = normalizeCampaignProgress([], []);
    for (const [index, id] of MISSION_IDS.entries()) {
      expect(nextSuggestedMission(progress).id).toBe(id);
      const newly = unlocksAfterCompleting(id, progress);
      progress = normalizeCampaignProgress([...progress.completedMissions, id], progress.unlockedMissions);
      const next = MISSION_IDS[index + 1];
      expect(newly).toEqual(next ? [next] : []);
      expect(nextMissionAfter(id, progress)?.id ?? null).toBe(next ?? null);
    }
    expect(isCampaignComplete(progress)).toBe(true);
  });

  it("labels board nodes", () => {
    const board = missionBoard(normalizeCampaignProgress(["tea-moon"], []));
    expect(board.map((node) => node.state)).toEqual(["completed", "available", "locked", "locked", "locked", "locked"]);
    expect(board[2]?.unlockedBy?.id).toBe("bento-belt");
  });
});
