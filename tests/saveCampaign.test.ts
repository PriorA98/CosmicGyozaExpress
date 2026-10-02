import { EventEmitter } from "node:events";
import type Phaser from "phaser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COLLECTIBLE_MEMORY_IDS, MISSION_IDS, resolveMission } from "../src/data/campaign";
import { GAME_EVENT, type GameEvent } from "../src/game/events";
import { isCampaignComplete } from "../src/systems/CampaignSystem";
import { SAVE_KEY, SaveSystem, createDefaultSave, installCampaignSaveListeners, sanitizeSave } from "../src/systems/SaveSystem";
import type { MissionResultSummary, SaveDataV1 } from "../src/types/save";

const result: MissionResultSummary = {
  completedAt: "2026-10-01T12:00:00.000Z",
  conditionLabel: "Slightly shaken",
  crashes: 1,
  durationMs: 90_000,
};

type MemoryStorage = Storage & { readonly values: Map<string, string>; throwOnSet: boolean; setCalls: number };

function createStorage(): MemoryStorage {
  const values = new Map<string, string>();
  const storage: MemoryStorage = {
    values,
    throwOnSet: false,
    setCalls: 0,
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => {
      values.delete(key);
    },
    setItem: (key: string, value: string) => {
      storage.setCalls += 1;
      if (storage.throwOnSet) throw new Error("QuotaExceededError");
      values.set(key, value);
    },
  };
  return storage;
}

let storage: MemoryStorage;

function stored(): SaveDataV1 {
  return JSON.parse(storage.values.get(SAVE_KEY) ?? "null") as SaveDataV1;
}

function memoryFor(missionId: string): string {
  return resolveMission(missionId).memoryRewardId;
}

beforeEach(() => {
  storage = createStorage();
  vi.stubGlobal("localStorage", storage);
  SaveSystem.clearSessionCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
  SaveSystem.clearSessionCache();
});

describe("campaign save normalization", () => {
  it("loads an existing Tea Moon save with Bento Belt unlocked, without fabricating results", () => {
    const tea = { ...createDefaultSave(new Date("2026-05-29T00:00:00.000Z")), completedMissions: ["tea-moon"] };
    tea.stats.totalDeliveries = 3;
    storage.values.set(SAVE_KEY, JSON.stringify(tea));

    const save = SaveSystem.load();

    expect(save.completedMissions).toEqual(["tea-moon"]);
    expect(save.unlockedMissions).toEqual(["tea-moon", "bento-belt"]);
    expect(save.stats.totalDeliveries).toBe(3);
    expect(save.stats.bestMissionResults).toEqual({});
    expect(SaveSystem.lastLoadOutcome().kind).toBe("repaired");
    expect(stored().unlockedMissions).toEqual(["tea-moon", "bento-belt"]);
  });

  it("allowlists, dedupes and orders mission ids; Tea Moon is always unlocked", () => {
    const save = sanitizeSave({
      completedMissions: ["galaxy-finale", "matcha-nebula", "matcha-nebula", 7],
      unlockedMissions: ["im-fine", "nope", "im-fine"],
    });
    expect(save.completedMissions).toEqual(["matcha-nebula"]);
    expect(save.unlockedMissions).toEqual(["tea-moon", "matcha-nebula", "black-hole-bakery", "im-fine"]);
  });

  it("never infers completion of skipped missions", () => {
    const save = sanitizeSave({ completedMissions: ["black-hole-bakery"], unlockedMissions: [] });
    expect(save.completedMissions).toEqual(["black-hole-bakery"]);
    expect(save.unlockedMissions).toEqual(["tea-moon", "black-hole-bakery", "im-fine"]);
  });

  it("preserves explicit unlocks without completions", () => {
    const save = sanitizeSave({ completedMissions: [], unlockedMissions: [...MISSION_IDS] });
    expect(save.unlockedMissions).toEqual([...MISSION_IDS]);
    expect(save.completedMissions).toEqual([]);
  });

  it("filters memories against delivery memories and authored postcards", () => {
    const postcard = COLLECTIBLE_MEMORY_IDS[0];
    expect(postcard).toBeDefined();
    const save = sanitizeSave({
      collectedMemories: [memoryFor("bento-belt"), postcard, "memory-made-up", "collectible-fake", memoryFor("bento-belt")],
    });
    expect(save.collectedMemories).toEqual([memoryFor("bento-belt"), postcard]);
  });

  it("keeps only valid result entries for known missions", () => {
    const valid = { completedAt: "2026-05-30T00:00:00.000Z", conditionLabel: "Perfect", crashes: 0, durationMs: 1000 };
    const save = sanitizeSave({
      stats: {
        bestMissionResults: {
          "bento-belt": valid,
          "galaxy-finale": valid,
          "matcha-nebula": { ...valid, conditionLabel: "Pretty good" },
          "im-fine": { ...valid, completedAt: "nope" },
          "black-hole-bakery": { ...valid, crashes: Number.NaN, durationMs: -4 },
        },
      },
    });
    expect(Object.keys(save.stats.bestMissionResults)).toEqual(["bento-belt", "black-hole-bakery"]);
    expect(save.stats.bestMissionResults["black-hole-bakery"]).toMatchObject({ crashes: 0, durationMs: 0 });
  });

  it("is stable: normalizing twice changes nothing", () => {
    const once = sanitizeSave({ completedMissions: ["tea-moon", "bento-belt"], collectedMemories: [memoryFor("tea-moon")] });
    expect(sanitizeSave(once)).toEqual(once);
  });
});

describe("SaveSystem.completeMission (campaign)", () => {
  it("unlocks the next mission", () => {
    const save = SaveSystem.completeMission("tea-moon", result, memoryFor("tea-moon"));
    expect(save.unlockedMissions).toEqual(["tea-moon", "bento-belt"]);
    expect(SaveSystem.campaignProgress().unlockedMissions).toContain("bento-belt");
  });

  it("walks the whole unlock chain to the ending", () => {
    for (const id of MISSION_IDS) {
      expect(SaveSystem.campaignProgress().unlockedMissions).toContain(id);
      SaveSystem.completeMission(id, result, memoryFor(id));
    }
    const progress = SaveSystem.campaignProgress();
    expect(progress.completedMissions).toEqual([...MISSION_IDS]);
    expect(isCampaignComplete(progress)).toBe(true);
    expect(SaveSystem.load().stats.totalDeliveries).toBe(MISSION_IDS.length);
  });

  it("commits once per attempt even if the result scene is recreated or tapped twice", () => {
    const attempt = {};
    SaveSystem.completeMission("bento-belt", result, memoryFor("bento-belt"), attempt);
    const again = SaveSystem.completeMission("bento-belt", result, memoryFor("bento-belt"), attempt);
    expect(again.stats.totalDeliveries).toBe(1);
    expect(again.stats.totalCrashes).toBe(1);

    // A real replay (new attempt) counts once more; unlocks and memories stay idempotent.
    const replay = SaveSystem.completeMission("bento-belt", result, memoryFor("bento-belt"), {});
    expect(replay.stats.totalDeliveries).toBe(2);
    expect(replay.completedMissions).toEqual(["bento-belt"]);
    expect(replay.collectedMemories).toEqual([memoryFor("bento-belt")]);
    expect(replay.unlockedMissions).toEqual(["tea-moon", "bento-belt", "matcha-nebula"]);
  });
});

describe("SaveSystem.collectMemory", () => {
  const postcard = COLLECTIBLE_MEMORY_IDS[0] ?? "";

  it("keeps an authored postcard once and persists it", () => {
    SaveSystem.collectMemory(postcard);
    const save = SaveSystem.collectMemory(postcard);
    expect(save.collectedMemories).toEqual([postcard]);
    expect(stored().collectedMemories).toEqual([postcard]);
  });

  it("ignores unknown memory ids without writing", () => {
    SaveSystem.load();
    const writes = storage.setCalls;
    expect(SaveSystem.collectMemory("collectible-made-up").collectedMemories).toEqual([]);
    expect(storage.setCalls).toBe(writes);
  });

  it("keeps the pickup in the session when storage refuses writes", () => {
    storage.throwOnSet = true;
    expect(() => SaveSystem.collectMemory(postcard)).not.toThrow();
    expect(SaveSystem.load().collectedMemories).toEqual([postcard]);
    expect(SaveSystem.persistenceStatus()).toEqual({ kind: "session-only", reason: "write-failed" });
  });

  it("never overwrites a newer-version save", () => {
    const future = JSON.stringify({ version: 2, completedMissions: ["tea-moon"] });
    storage.values.set(SAVE_KEY, future);
    SaveSystem.collectMemory(postcard);
    expect(storage.values.get(SAVE_KEY)).toBe(future);
    expect(SaveSystem.load().collectedMemories).toEqual([postcard]);
  });

  it("is wired to flight:collectible by installCampaignSaveListeners", () => {
    const events = new EventEmitter();
    const game = { events } as unknown as Phaser.Game;
    const uninstall = installCampaignSaveListeners(game);
    const pickup: GameEvent = { type: "flight:collectible", collectibleId: "c", memoryId: postcard, x: 0, y: 0 };
    events.emit(GAME_EVENT, pickup);
    expect(SaveSystem.load().collectedMemories).toEqual([postcard]);

    uninstall();
    expect(events.listenerCount(GAME_EVENT)).toBe(0);
  });
});

describe("SaveSystem.markEndingSeen", () => {
  it("sets the flag once", () => {
    expect(SaveSystem.load().endingSeen).toBe(false);
    expect(SaveSystem.markEndingSeen().endingSeen).toBe(true);
    const writes = storage.setCalls;
    SaveSystem.markEndingSeen();
    expect(storage.setCalls).toBe(writes);
    expect(stored().endingSeen).toBe(true);
  });
});
