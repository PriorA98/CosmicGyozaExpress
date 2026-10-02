/**
 * Campaign progression rules (pure). Linear handcrafted unlocks: completing a delivery unlocks the next one
 * regardless of package condition or landing outcome. Never infers completion of skipped missions.
 */
import { MISSION_IDS, campaignMissions, isMissionId, resolveMission } from "../data/campaign";
import type { MissionDefinitionV2, MissionId } from "../types/campaign";

export type MissionBoardState = "locked" | "available" | "completed";

export type MissionBoardNode = {
  readonly mission: MissionDefinitionV2;
  readonly state: MissionBoardState;
  /** For locked nodes: the mission that unlocks this one (for "After …" copy). */
  readonly unlockedBy: MissionDefinitionV2 | null;
};

export type CampaignProgress = {
  readonly completedMissions: readonly MissionId[];
  readonly unlockedMissions: readonly MissionId[];
};

function uniqueKnown(ids: readonly unknown[]): MissionId[] {
  const out: MissionId[] = [];
  for (const id of ids) if (isMissionId(id) && !out.includes(id)) out.push(id);
  return out;
}

/**
 * Normalizes untrusted progress: allowlists known ids, dedupes, always unlocks Tea Moon, unlocks every
 * completed mission and its declared next missions. Order follows the campaign board.
 */
export function normalizeCampaignProgress(completed: readonly unknown[], unlocked: readonly unknown[]): CampaignProgress {
  const completedIds = uniqueKnown(completed);
  const unlockedSet = new Set<MissionId>(["tea-moon", ...uniqueKnown(unlocked), ...completedIds]);
  for (const id of completedIds) for (const next of resolveMission(id).unlocksMissionIds) unlockedSet.add(next);
  const byOrder = (ids: Iterable<MissionId>): MissionId[] => MISSION_IDS.filter((id) => [...ids].includes(id));
  return { completedMissions: byOrder(completedIds), unlockedMissions: byOrder(unlockedSet) };
}

/** Missions newly unlocked by completing `missionId` (for result-card "next delivery" copy). */
export function unlocksAfterCompleting(missionId: MissionId, progress: CampaignProgress): readonly MissionId[] {
  return resolveMission(missionId).unlocksMissionIds.filter((id) => !progress.unlockedMissions.includes(id));
}

export function missionBoard(progress: CampaignProgress): readonly MissionBoardNode[] {
  return campaignMissions.map((mission) => {
    const state: MissionBoardState = progress.completedMissions.includes(mission.id)
      ? "completed"
      : progress.unlockedMissions.includes(mission.id)
        ? "available"
        : "locked";
    const unlockedBy = campaignMissions.find((candidate) => candidate.unlocksMissionIds.includes(mission.id)) ?? null;
    return { mission, state, unlockedBy };
  });
}

/** The mission the title's primary action should suggest: first available-but-incomplete, else the last unlocked. */
export function nextSuggestedMission(progress: CampaignProgress): MissionDefinitionV2 {
  const open = campaignMissions.find(
    (mission) => progress.unlockedMissions.includes(mission.id) && !progress.completedMissions.includes(mission.id),
  );
  if (open) return open;
  const unlocked = campaignMissions.filter((mission) => progress.unlockedMissions.includes(mission.id));
  return unlocked[unlocked.length - 1] ?? resolveMission("tea-moon");
}

/** The mission after `missionId` in board order, if it is unlocked. */
export function nextMissionAfter(missionId: MissionId, progress: CampaignProgress): MissionDefinitionV2 | null {
  const next = resolveMission(missionId).unlocksMissionIds[0];
  if (next === undefined || !progress.unlockedMissions.includes(next)) return null;
  return resolveMission(next);
}

export function isCampaignComplete(progress: CampaignProgress): boolean {
  return MISSION_IDS.every((id) => progress.completedMissions.includes(id));
}
