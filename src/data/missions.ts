import type { MissionDefinition } from "../types/mission";
import { campaignMissions } from "./campaign";

export { TEA_MOON_MISSION_ID, teaMoonMission } from "./campaign/teaMoon";

/** Every campaign mission (board order). Authored in src/data/campaign/. */
export const missions: readonly MissionDefinition[] = campaignMissions;

export function getMissionById(missionId: string): MissionDefinition {
  const mission = missions.find((candidate) => candidate.id === missionId);
  if (!mission) {
    throw new Error(`Unknown mission id: ${missionId}`);
  }

  return mission;
}
