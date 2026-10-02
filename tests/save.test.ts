import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CORRUPT_BACKUP_KEY,
  CORRUPT_BACKUP_LATEST_KEY,
  createDefaultSave,
  sanitizeSave,
  SaveSystem,
  SAVE_KEY,
} from "../src/systems/SaveSystem";
import type { MissionResultSummary, SaveDataV1 } from "../src/types/save";

type FakeStorageOptions = {
  readonly throwOnGet?: boolean;
  readonly throwOnSet?: boolean;
};

type FakeStorage = Storage & {
  readonly values: Map<string, string>;
  setCalls: number;
  throwOnSet: boolean;
  throwOnGet: boolean;
};

function createFakeStorage(options: FakeStorageOptions = {}): FakeStorage {
  const values = new Map<string, string>();
  const storage: FakeStorage = {
    values,
    setCalls: 0,
    throwOnSet: options.throwOnSet ?? false,
    throwOnGet: options.throwOnGet ?? false,
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => {
      if (storage.throwOnGet) throw new Error("SecurityError: storage disabled");
      return values.get(key) ?? null;
    },
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

const perfectResult: MissionResultSummary = {
  completedAt: "2026-05-30T00:00:00.000Z",
  conditionLabel: "Perfect",
  crashes: 0,
  durationMs: 10_000,
};

const shakenResult: MissionResultSummary = {
  completedAt: "2026-06-01T00:00:00.000Z",
  conditionLabel: "Dramatically rearranged",
  crashes: 3,
  durationMs: 140_000,
};

let storage: FakeStorage;

function stored(): SaveDataV1 {
  return JSON.parse(storage.values.get(SAVE_KEY) ?? "null") as SaveDataV1;
}

beforeEach(() => {
  storage = createFakeStorage();
  vi.stubGlobal("localStorage", storage);
  SaveSystem.clearSessionCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
  SaveSystem.clearSessionCache();
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

describe("SaveSystem.load", () => {
  it("creates and persists a default save when storage is empty", () => {
    const save = SaveSystem.load();

    expect(save.version).toBe(1);
    expect(SaveSystem.lastLoadOutcome().kind).toBe("fresh");
    expect(stored().unlockedMissions).toEqual(["tea-moon"]);
  });

  it("returns a valid stored save unchanged and does not rewrite it", () => {
    const original = { ...createDefaultSave(new Date("2026-05-29T00:00:00.000Z")), completedMissions: ["tea-moon"] };
    storage.values.set(SAVE_KEY, JSON.stringify(original));

    const save = SaveSystem.load();

    expect(save).toEqual(original);
    expect(SaveSystem.lastLoadOutcome().kind).toBe("loaded");
    expect(storage.setCalls).toBe(0);
  });

  it("recovers from corrupt JSON, keeps a backup, and writes a fresh save", () => {
    const corrupt = '{"version":1,"completedMissions":"oops"';
    storage.values.set(SAVE_KEY, corrupt);

    const save = SaveSystem.load();

    expect(save.completedMissions).toEqual([]);
    expect(SaveSystem.lastLoadOutcome().kind).toBe("corrupt");
    expect(storage.values.get(CORRUPT_BACKUP_KEY)).toBe(corrupt);
    expect(stored().version).toBe(1);
  });

  it.each(["null", "42", '"hello"', "[1,2,3]", "true"])("recovers from non-object JSON %s", (raw) => {
    storage.values.set(SAVE_KEY, raw);

    const save = SaveSystem.load();

    expect(save.version).toBe(1);
    expect(save.unlockedMissions).toEqual(["tea-moon"]);
  });

  it("fills missing fields from defaults while keeping valid progress", () => {
    storage.values.set(SAVE_KEY, JSON.stringify({ version: 1, completedMissions: ["tea-moon"] }));

    const save = SaveSystem.load();

    expect(save.completedMissions).toEqual(["tea-moon"]);
    expect(save.unlockedMissions).toEqual(["tea-moon"]);
    expect(save.settings).toEqual(createDefaultSave().settings);
    expect(save.stats.totalDeliveries).toBe(0);
    expect(SaveSystem.lastLoadOutcome().kind).toBe("repaired");
    expect(stored().settings.sfxVolume).toBe(0.8);
  });

  it("sanitizes every field of a hostile save", () => {
    storage.values.set(
      SAVE_KEY,
      JSON.stringify({
        version: 1,
        createdAt: "not a date",
        updatedAt: 12,
        completedMissions: "oops",
        unlockedMissions: [7, null, "tea-moon", "tea-moon", "", "x".repeat(500), "bento-belt"],
        collectedMemories: [{ id: "a" }, "memory-tea-moon-postcard"],
        unlockedCosmetics: null,
        equippedCosmetics: ["__proto__", "scarf"],
        settings: { cozyMode: "yes", reducedMotion: true, musicVolume: 7, sfxVolume: -3, inputScheme: "telepathy" },
        stats: {
          totalDeliveries: -4,
          totalCrashes: Number.MAX_VALUE,
          totalSoupAdjacentEvents: "many",
          bestMissionResults: {
            "tea-moon": { completedAt: "2026-05-30T00:00:00.000Z", conditionLabel: "Perfect", crashes: -2, durationMs: 1.5e12 },
            broken: { completedAt: "nope", conditionLabel: "Perfect", crashes: 0, durationMs: 1 },
            alsoBroken: "string",
          },
        },
        endingSeen: "maybe",
      }),
    );

    const save = SaveSystem.load();

    expect(save.completedMissions).toEqual([]);
    expect(save.unlockedMissions).toEqual(["tea-moon", "bento-belt"]);
    expect(save.collectedMemories).toEqual(["memory-tea-moon-postcard"]);
    expect(save.unlockedCosmetics).toEqual([]);
    expect(save.equippedCosmetics).toEqual(["scarf"]);
    expect(save.settings).toEqual({
      cozyMode: true,
      reducedMotion: true,
      musicVolume: 1,
      sfxVolume: 0,
      inputScheme: "keyboard",
    });
    expect(save.stats.totalDeliveries).toBe(0);
    expect(save.stats.totalCrashes).toBeLessThanOrEqual(1_000_000_000);
    expect(save.stats.totalSoupAdjacentEvents).toBe(0);
    expect(Object.keys(save.stats.bestMissionResults)).toEqual(["tea-moon"]);
    expect(save.stats.bestMissionResults["tea-moon"]?.crashes).toBe(0);
    expect(save.stats.bestMissionResults["tea-moon"]?.durationMs).toBe(24 * 60 * 60 * 1000);
    expect(save.endingSeen).toBe(false);
    expect(Date.parse(save.createdAt)).not.toBeNaN();
  });

  it("ignores prototype-polluting keys in best results", () => {
    storage.values.set(
      SAVE_KEY,
      '{"version":1,"stats":{"bestMissionResults":{"__proto__":{"completedAt":"2026-05-30T00:00:00.000Z","conditionLabel":"Perfect","crashes":0,"durationMs":1}}}}',
    );

    const save = SaveSystem.load();

    expect(Object.keys(save.stats.bestMissionResults)).toEqual([]);
    expect(Object.getPrototypeOf(save.stats.bestMissionResults)).toBe(Object.prototype);
  });

  it("never clobbers a save from a future version and runs on in-memory defaults", () => {
    const future = JSON.stringify({ version: 2, shinyNewField: true, completedMissions: ["galaxy-finale"] });
    storage.values.set(SAVE_KEY, future);

    const save = SaveSystem.load();
    expect(save.version).toBe(1);
    expect(save.completedMissions).toEqual([]);
    expect(SaveSystem.lastLoadOutcome()).toEqual({ kind: "future-version", version: 2 });
    expect(SaveSystem.isStorageLocked()).toBe(true);

    const completed = SaveSystem.completeMission("tea-moon", perfectResult, "memory-tea-moon-postcard");
    SaveSystem.updateSettings({ musicVolume: 0.2 });

    expect(completed.completedMissions).toEqual(["tea-moon"]);
    expect(SaveSystem.isMissionCompleted("tea-moon")).toBe(true);
    expect(SaveSystem.load().settings.musicVolume).toBe(0.2);
    expect(storage.values.get(SAVE_KEY)).toBe(future);
    expect(storage.setCalls).toBe(0);
  });

  it("treats a string future version as future too", () => {
    const future = JSON.stringify({ version: "3" });
    storage.values.set(SAVE_KEY, future);

    SaveSystem.reset();

    expect(storage.values.get(SAVE_KEY)).toBe(future);
  });

  it("salvages a save with a missing or older version as v1", () => {
    storage.values.set(SAVE_KEY, JSON.stringify({ completedMissions: ["tea-moon"] }));

    const save = SaveSystem.load();

    expect(save.version).toBe(1);
    expect(save.completedMissions).toEqual(["tea-moon"]);
    expect(stored().version).toBe(1);
  });
});

describe("SaveSystem with unavailable storage", () => {
  it("runs entirely in memory when localStorage is missing", () => {
    vi.stubGlobal("localStorage", undefined);

    expect(() => SaveSystem.load()).not.toThrow();
    SaveSystem.completeMission("tea-moon", perfectResult, "memory-tea-moon-postcard");

    expect(SaveSystem.isMissionCompleted("tea-moon")).toBe(true);
    expect(SaveSystem.lastLoadOutcome().kind).toBe("memory");
  });

  it("runs in memory when getItem throws", () => {
    storage.throwOnGet = true;

    const save = SaveSystem.load();
    SaveSystem.updateSettings({ reducedMotion: true });

    expect(save.version).toBe(1);
    expect(SaveSystem.load().settings.reducedMotion).toBe(true);
  });

  it("keeps progress in memory when setItem throws and flushes it once storage recovers", () => {
    storage.throwOnSet = true;

    const save = SaveSystem.completeMission("tea-moon", perfectResult, "memory-tea-moon-postcard");
    expect(save.completedMissions).toEqual(["tea-moon"]);
    expect(storage.values.has(SAVE_KEY)).toBe(false);
    expect(SaveSystem.isMissionCompleted("tea-moon")).toBe(true);

    storage.throwOnSet = false;
    SaveSystem.load();

    expect(stored().completedMissions).toEqual(["tea-moon"]);
  });

  it("survives a localStorage getter that throws", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new Error("SecurityError");
      },
    });

    try {
      expect(() => SaveSystem.completeMission("tea-moon", perfectResult, "memory-tea-moon-postcard")).not.toThrow();
      expect(SaveSystem.isMissionCompleted("tea-moon")).toBe(true);
    } finally {
      Object.defineProperty(globalThis, "localStorage", { configurable: true, writable: true, value: storage });
    }
  });
});

describe("SaveSystem.completeMission", () => {
  it("persists mission completion, memory reward, and result summary", () => {
    const save = SaveSystem.completeMission("tea-moon", perfectResult, "memory-tea-moon-postcard");

    expect(save.completedMissions).toEqual(["tea-moon"]);
    expect(save.collectedMemories).toEqual(["memory-tea-moon-postcard"]);
    expect(save.stats.totalDeliveries).toBe(1);
    expect(save.stats.bestMissionResults["tea-moon"]).toEqual(perfectResult);
    expect(stored().completedMissions).toEqual(["tea-moon"]);
  });

  it("keeps the warmer result and never duplicates completion or memories", () => {
    SaveSystem.completeMission("tea-moon", perfectResult, "memory-tea-moon-postcard");
    const save = SaveSystem.completeMission("tea-moon", shakenResult, "memory-tea-moon-postcard");

    expect(save.completedMissions).toEqual(["tea-moon"]);
    expect(save.collectedMemories).toEqual(["memory-tea-moon-postcard"]);
    expect(save.stats.totalDeliveries).toBe(2);
    expect(save.stats.totalCrashes).toBe(3);
    expect(save.stats.bestMissionResults["tea-moon"]).toEqual(perfectResult);
  });

  it("upgrades the remembered result when the new delivery is warmer", () => {
    SaveSystem.completeMission("tea-moon", shakenResult, "memory-tea-moon-postcard");
    const save = SaveSystem.completeMission("tea-moon", perfectResult, "memory-tea-moon-postcard");

    expect(save.stats.bestMissionResults["tea-moon"]).toEqual(perfectResult);
    expect(SaveSystem.getBestResult("tea-moon")).toEqual(perfectResult);
  });

  it("still records completion when the stored best result is garbage", () => {
    storage.values.set(
      SAVE_KEY,
      JSON.stringify({ ...createDefaultSave(), stats: { bestMissionResults: { "tea-moon": { conditionLabel: 5 } } } }),
    );

    const save = SaveSystem.completeMission("tea-moon", shakenResult, "memory-tea-moon-postcard");

    expect(save.completedMissions).toEqual(["tea-moon"]);
    expect(save.stats.bestMissionResults["tea-moon"]).toEqual(shakenResult);
  });
});

describe("SaveSystem.updateSettings", () => {
  it("merges partial settings and clamps out-of-range values", () => {
    const save = SaveSystem.updateSettings({ musicVolume: 3, cozyMode: false });

    expect(save.settings.musicVolume).toBe(1);
    expect(save.settings.cozyMode).toBe(false);
    expect(save.settings.sfxVolume).toBe(0.8);
    expect(stored().settings.cozyMode).toBe(false);
  });

  it("ignores invalid values from untyped callers", () => {
    const hostile = JSON.parse('{"sfxVolume":"loud","inputScheme":"mind"}') as Partial<SaveDataV1["settings"]>;

    const save = SaveSystem.updateSettings(hostile);

    expect(save.settings.sfxVolume).toBe(0.8);
    expect(save.settings.inputScheme).toBe("keyboard");
  });
});

describe("SaveSystem.isMissionCompleted", () => {
  it("reports completion only for completed missions", () => {
    expect(SaveSystem.isMissionCompleted("tea-moon")).toBe(false);
    SaveSystem.completeMission("tea-moon", perfectResult, "memory-tea-moon-postcard");
    expect(SaveSystem.isMissionCompleted("tea-moon")).toBe(true);
    expect(SaveSystem.isMissionCompleted("bento-belt")).toBe(false);
  });
});

describe("sanitizeSave", () => {
  it("is idempotent on a valid save", () => {
    const fixed = new Date("2026-05-29T00:00:00.000Z");
    const valid = createDefaultSave(fixed);
    expect(sanitizeSave(valid)).toEqual(valid);
    const repaired = sanitizeSave({ junk: true, completedMissions: ["tea-moon", 3] }, fixed);
    expect(sanitizeSave(repaired, fixed)).toEqual(repaired);
  });
});

describe("corrupt save backups", () => {
  it("never overwrites the first backup and keeps the newest later one", () => {
    for (const raw of ["{first", "{second", "{third"]) {
      SaveSystem.clearSessionCache();
      storage.values.set(SAVE_KEY, raw);
      SaveSystem.load();
    }

    expect(storage.values.get(CORRUPT_BACKUP_KEY)).toBe("{first");
    expect(storage.values.get(CORRUPT_BACKUP_LATEST_KEY)).toBe("{third");
  });

  it("does not duplicate a backup of the same text", () => {
    for (const raw of ["{same", "{same"]) {
      SaveSystem.clearSessionCache();
      storage.values.set(SAVE_KEY, raw);
      SaveSystem.load();
    }

    expect(storage.values.get(CORRUPT_BACKUP_KEY)).toBe("{same");
    expect(storage.values.has(CORRUPT_BACKUP_LATEST_KEY)).toBe(false);
  });
});

describe("SaveSystem.persistenceStatus", () => {
  it("is persistent with working storage, including after a quiet corrupt recovery", () => {
    expect(SaveSystem.persistenceStatus()).toEqual({ kind: "persistent" });
    SaveSystem.clearSessionCache();
    storage.values.set(SAVE_KEY, "{oops");
    expect(SaveSystem.persistenceStatus()).toEqual({ kind: "persistent" });
  });

  it("reports a newer save so this visit stays in memory", () => {
    storage.values.set(SAVE_KEY, JSON.stringify({ version: 9 }));
    SaveSystem.completeMission("tea-moon", perfectResult, "memory-tea-moon-postcard");

    expect(SaveSystem.persistenceStatus()).toEqual({ kind: "session-only", reason: "newer-save" });
  });

  it("reports unavailable storage when localStorage is missing or unreadable", () => {
    vi.stubGlobal("localStorage", undefined);
    SaveSystem.completeMission("tea-moon", perfectResult, "memory-tea-moon-postcard");
    expect(SaveSystem.persistenceStatus()).toEqual({ kind: "session-only", reason: "storage-unavailable" });

    vi.stubGlobal("localStorage", storage);
    SaveSystem.clearSessionCache();
    storage.throwOnGet = true;
    expect(SaveSystem.persistenceStatus()).toEqual({ kind: "session-only", reason: "storage-unavailable" });
  });

  it("reports failed writes and recovers once storage accepts the save", () => {
    storage.throwOnSet = true;
    SaveSystem.completeMission("tea-moon", perfectResult, "memory-tea-moon-postcard");
    expect(SaveSystem.persistenceStatus()).toEqual({ kind: "session-only", reason: "write-failed" });

    storage.throwOnSet = false;
    SaveSystem.load();
    expect(SaveSystem.persistenceStatus()).toEqual({ kind: "persistent" });
    expect(stored().completedMissions).toEqual(["tea-moon"]);
  });

  it("flushes progress earned while storage was unreadable instead of replacing it", () => {
    storage.throwOnGet = true;
    SaveSystem.completeMission("tea-moon", perfectResult, "memory-tea-moon-postcard");

    storage.throwOnGet = false;
    const save = SaveSystem.load();

    expect(save.completedMissions).toEqual(["tea-moon"]);
    expect(stored().completedMissions).toEqual(["tea-moon"]);
    expect(SaveSystem.persistenceStatus()).toEqual({ kind: "persistent" });
  });
});

describe("SaveSystem.diagnostics", () => {
  it("exposes the first load outcome, lock state, and backup presence for dev probes", () => {
    storage.values.set(SAVE_KEY, "{broken");
    SaveSystem.load();
    SaveSystem.load();

    const diagnostics = SaveSystem.diagnostics();
    expect(diagnostics.firstLoadOutcome.kind).toBe("corrupt");
    expect(diagnostics.storageLocked).toBe(false);
    expect(diagnostics.hasCorruptBackup).toBe(true);
    expect(diagnostics.hasLatestCorruptBackup).toBe(false);
    expect(diagnostics.persistence).toEqual({ kind: "persistent" });
  });
});
