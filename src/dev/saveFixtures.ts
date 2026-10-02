import { TEA_MOON_MISSION_ID, teaMoonMission } from "../data/missions";
import { SAVE_KEY, createDefaultSave } from "../systems/SaveSystem";
import type { SaveDataV1 } from "../types/save";
import type { ShowcaseSaveFixture } from "./showcaseStates";

/** Dev-only: seeds localStorage for a showcase before BootScene reads the save. */
export function applyShowcaseSaveFixture(fixture: ShowcaseSaveFixture): void {
  if (!import.meta.env.DEV) return;

  try {
    switch (fixture) {
      case "keep":
        return;
      case "fresh":
        globalThis.localStorage?.removeItem(SAVE_KEY);
        return;
      case "corrupt":
        globalThis.localStorage?.setItem(SAVE_KEY, '{"version":1,"completedMissions":"oops"');
        return;
      case "completed":
        globalThis.localStorage?.setItem(SAVE_KEY, JSON.stringify(createCompletedSave()));
        return;
      case "future":
        // A save from a newer game version: SaveSystem must never overwrite it (session-only mode).
        globalThis.localStorage?.setItem(SAVE_KEY, JSON.stringify({ version: 9 }));
        return;
    }
  } catch {
    // Storage can be unavailable (privacy mode); the game must still boot.
  }
}

export function createCompletedSave(now = new Date("2026-10-01T12:00:00.000Z")): SaveDataV1 {
  const base = createDefaultSave(now);
  return {
    ...base,
    completedMissions: [TEA_MOON_MISSION_ID],
    collectedMemories: [teaMoonMission.memoryRewardId],
    stats: {
      ...base.stats,
      totalDeliveries: 1,
      totalCrashes: 1,
      bestMissionResults: {
        [TEA_MOON_MISSION_ID]: {
          completedAt: now.toISOString(),
          conditionLabel: "Slightly shaken",
          crashes: 1,
          durationMs: 92000,
        },
      },
    },
  };
}
