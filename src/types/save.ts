export type InputScheme = "keyboard" | "gamepad";

export type SaveDataV1 = {
  version: 1;
  createdAt: string;
  updatedAt: string;
  completedMissions: string[];
  unlockedMissions: string[];
  collectedMemories: string[];
  unlockedCosmetics: string[];
  equippedCosmetics: string[];
  settings: {
    cozyMode: boolean;
    reducedMotion: boolean;
    musicVolume: number;
    sfxVolume: number;
    inputScheme: InputScheme;
  };
  stats: {
    totalDeliveries: number;
    totalCrashes: number;
    totalSoupAdjacentEvents: number;
    bestMissionResults: Record<string, MissionResultSummary>;
  };
  endingSeen: boolean;
};

export type MissionResultSummary = {
  completedAt: string;
  conditionLabel: string;
  crashes: number;
  durationMs: number;
};
