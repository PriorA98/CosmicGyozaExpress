import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultSave, SaveSystem, SAVE_KEY } from "../src/systems/SaveSystem";

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", createMemoryStorage());
});

describe("createDefaultSave", () => {
  it("creates a versioned save with Tea Moon unlocked", () => {
    const save = createDefaultSave(new Date("2026-05-29T00:00:00.000Z"));

    expect(save.version).toBe(1);
    expect(save.unlockedMissions).toEqual(["tea-moon"]);
    expect(save.settings.cozyMode).toBe(true);
    expect(save.completedMissions).toEqual([]);
  });
});

describe("SaveSystem.completeMission", () => {
  it("persists mission completion, memory reward, and result summary", () => {
    localStorage.clear();

    const result = {
      completedAt: "2026-05-30T00:00:00.000Z",
      conditionLabel: "Perfect",
      crashes: 0,
      durationMs: 10_000,
    };

    const save = SaveSystem.completeMission("tea-moon", result, "memory-tea-moon-postcard");
    const stored = JSON.parse(localStorage.getItem(SAVE_KEY) ?? "{}") as typeof save;

    expect(save.completedMissions).toEqual(["tea-moon"]);
    expect(save.collectedMemories).toEqual(["memory-tea-moon-postcard"]);
    expect(save.stats.totalDeliveries).toBe(1);
    expect(save.stats.bestMissionResults["tea-moon"]).toEqual(result);
    expect(stored.completedMissions).toEqual(["tea-moon"]);
  });
});
