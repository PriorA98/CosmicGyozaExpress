import type { MissionResultSummary, SaveDataV1 } from "../types/save";

export const SAVE_KEY = "cosmic-gyoza-express.save.v1";

export function createDefaultSave(now = new Date()): SaveDataV1 {
  const timestamp = now.toISOString();

  return {
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    completedMissions: [],
    unlockedMissions: ["tea-moon"],
    collectedMemories: [],
    unlockedCosmetics: [],
    equippedCosmetics: [],
    settings: {
      cozyMode: true,
      reducedMotion: false,
      musicVolume: 0.7,
      sfxVolume: 0.8,
      inputScheme: "keyboard",
    },
    stats: {
      totalDeliveries: 0,
      totalCrashes: 0,
      totalSoupAdjacentEvents: 0,
      bestMissionResults: {},
    },
    endingSeen: false,
  };
}

export class SaveSystem {
  static load(): SaveDataV1 {
    const raw = globalThis.localStorage?.getItem(SAVE_KEY);
    if (!raw) {
      return this.save(createDefaultSave());
    }

    try {
      const parsed = JSON.parse(raw) as Partial<SaveDataV1>;
      if (parsed.version !== 1) {
        return this.save(createDefaultSave());
      }

      return parsed as SaveDataV1;
    } catch {
      return this.save(createDefaultSave());
    }
  }

  static save(data: SaveDataV1): SaveDataV1 {
    const next: SaveDataV1 = {
      ...data,
      updatedAt: new Date().toISOString(),
    };
    globalThis.localStorage?.setItem(SAVE_KEY, JSON.stringify(next));
    return next;
  }

  static reset(): SaveDataV1 {
    const next = createDefaultSave();
    globalThis.localStorage?.setItem(SAVE_KEY, JSON.stringify(next));
    return next;
  }

  static completeMission(
    missionId: string,
    result: MissionResultSummary,
    memoryRewardId: string,
  ): SaveDataV1 {
    const current = this.load();
    const completedMissions = addUnique(current.completedMissions, missionId);
    const collectedMemories = addUnique(current.collectedMemories, memoryRewardId);

    return this.save({
      ...current,
      completedMissions,
      collectedMemories,
      stats: {
        ...current.stats,
        totalDeliveries: current.stats.totalDeliveries + 1,
        bestMissionResults: {
          ...current.stats.bestMissionResults,
          [missionId]: result,
        },
      },
    });
  }
}

function addUnique(values: readonly string[], value: string): string[] {
  return values.includes(value) ? [...values] : [...values, value];
}
