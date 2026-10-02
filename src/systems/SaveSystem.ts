import type { InputScheme, MissionResultSummary, SaveDataV1 } from "../types/save";
import { pickWarmerResult } from "./MissionResultSystem";

export const SAVE_KEY = "cosmic-gyoza-express.save.v1";
/**
 * Best-effort copy of unreadable save text, kept so a corrupt save is never silently destroyed.
 * The first backup is never overwritten (it usually holds the player's real progress); later
 * corruptions go to the "latest" slot, so at most two backups exist.
 */
export const CORRUPT_BACKUP_KEY = `${SAVE_KEY}.corrupt-backup`;
export const CORRUPT_BACKUP_LATEST_KEY = `${SAVE_KEY}.corrupt-backup-latest`;

export const CURRENT_SAVE_VERSION = 1;

/** Bounds applied when sanitizing untrusted save data. */
export const SAVE_LIMITS = {
  maxIdLength: 64,
  maxListLength: 256,
  maxBestResults: 64,
  maxCount: 1_000_000_000,
  maxDurationMs: 24 * 60 * 60 * 1000,
  maxBackupLength: 64 * 1024,
  minVolume: 0,
  maxVolume: 1,
} as const;

const INPUT_SCHEMES: readonly InputScheme[] = ["keyboard", "gamepad"];
const FORBIDDEN_KEYS: ReadonlySet<string> = new Set(["__proto__", "constructor", "prototype"]);

export type SaveSettings = SaveDataV1["settings"];

/** How the last `load()` resolved. Exposed for tests and dev tooling. */
export type SaveLoadOutcome =
  | { readonly kind: "fresh" }
  | { readonly kind: "loaded" }
  | { readonly kind: "repaired" }
  | { readonly kind: "corrupt" }
  | { readonly kind: "future-version"; readonly version: number }
  | { readonly kind: "storage-unavailable" }
  | { readonly kind: "memory" };

/** Why this session's progress cannot reach storage. */
export type SessionOnlyReason = "storage-unavailable" | "newer-save" | "write-failed";

/** Whether progress written now will survive a reload. */
export type SavePersistenceStatus =
  | { readonly kind: "persistent" }
  | { readonly kind: "session-only"; readonly reason: SessionOnlyReason };

/** Snapshot for dev tooling and capture probes. */
export type SaveDiagnostics = {
  /** Outcome of the first storage read this session (later reads usually report `loaded`/`memory`). */
  readonly firstLoadOutcome: SaveLoadOutcome;
  readonly lastLoadOutcome: SaveLoadOutcome;
  readonly storageLocked: boolean;
  readonly persistence: SavePersistenceStatus;
  readonly hasCorruptBackup: boolean;
  readonly hasLatestCorruptBackup: boolean;
};

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

/**
 * Turns any value into a valid SaveDataV1. Every field is validated individually; anything
 * missing or malformed is filled from defaults so one bad field never discards the rest.
 */
export function sanitizeSave(value: unknown, now = new Date()): SaveDataV1 {
  const defaults = createDefaultSave(now);
  const source = isRecord(value) ? value : {};
  const stats = isRecord(source.stats) ? source.stats : {};
  const createdAt = sanitizeTimestamp(source.createdAt, defaults.createdAt);

  return {
    version: 1,
    createdAt,
    updatedAt: sanitizeTimestamp(source.updatedAt, createdAt),
    completedMissions: sanitizeIdList(source.completedMissions),
    unlockedMissions: mergeUnique(defaults.unlockedMissions, sanitizeIdList(source.unlockedMissions)),
    collectedMemories: sanitizeIdList(source.collectedMemories),
    unlockedCosmetics: sanitizeIdList(source.unlockedCosmetics),
    equippedCosmetics: sanitizeIdList(source.equippedCosmetics),
    settings: sanitizeSettings(source.settings, defaults.settings),
    stats: {
      totalDeliveries: sanitizeCount(stats.totalDeliveries),
      totalCrashes: sanitizeCount(stats.totalCrashes),
      totalSoupAdjacentEvents: sanitizeCount(stats.totalSoupAdjacentEvents),
      bestMissionResults: sanitizeBestResults(stats.bestMissionResults),
    },
    endingSeen: typeof source.endingSeen === "boolean" ? source.endingSeen : defaults.endingSeen,
  };
}

export function sanitizeSettings(value: unknown, fallback: SaveSettings = createDefaultSave().settings): SaveSettings {
  const source = isRecord(value) ? value : {};
  return {
    cozyMode: typeof source.cozyMode === "boolean" ? source.cozyMode : fallback.cozyMode,
    reducedMotion: typeof source.reducedMotion === "boolean" ? source.reducedMotion : fallback.reducedMotion,
    musicVolume: sanitizeVolume(source.musicVolume, fallback.musicVolume),
    sfxVolume: sanitizeVolume(source.sfxVolume, fallback.sfxVolume),
    inputScheme: isInputScheme(source.inputScheme) ? source.inputScheme : fallback.inputScheme,
  };
}

/**
 * Session cache. `memory` always holds the most recent save the game has seen or written, so
 * the game keeps working (for the whole session) when storage throws, is full, or is locked
 * by a save from a newer game version.
 */
let memory: SaveDataV1 | null = null;
/** Memory holds changes that storage does not (a write failed). */
let memoryAhead = false;
/** Storage holds a newer save version: never write to it this session. */
let storageLocked = false;
let lastOutcome: SaveLoadOutcome = { kind: "memory" };
let firstOutcome: SaveLoadOutcome | null = null;
/** Last storage access problem seen this session; cleared by a successful write. */
let storageProblem: "unavailable" | "write-failed" | null = null;

export class SaveSystem {
  static load(): SaveDataV1 {
    const data = this.loadOnce();
    firstOutcome = firstOutcome ?? lastOutcome;
    return data;
  }

  private static loadOnce(): SaveDataV1 {
    if (memory && storageLocked) {
      lastOutcome = { kind: "memory" };
      return cloneSave(memory);
    }

    if (memory && memoryAhead) {
      // Storage missed a write earlier; retry quietly and keep trusting memory.
      memoryAhead = !writeToStorage(memory);
      lastOutcome = { kind: "memory" };
      return cloneSave(memory);
    }

    const read = readFromStorage();
    if (read.kind === "unavailable") {
      memory = memory ?? createDefaultSave();
      // Whatever this session earns lives in memory until storage answers again; then it is flushed.
      memoryAhead = true;
      lastOutcome = { kind: "storage-unavailable" };
      return cloneSave(memory);
    }

    if (read.raw === null) {
      lastOutcome = { kind: "fresh" };
      return this.commit(createDefaultSave(), false);
    }

    const parsed = parseJson(read.raw);
    if (!parsed.ok) {
      backupCorrupt(read.raw);
      lastOutcome = { kind: "corrupt" };
      return this.commit(createDefaultSave(), false);
    }

    const version = readVersion(parsed.value);
    if (version !== undefined && version > CURRENT_SAVE_VERSION) {
      storageLocked = true;
      memory = createDefaultSave();
      lastOutcome = { kind: "future-version", version };
      return cloneSave(memory);
    }

    if (!isRecord(parsed.value)) {
      backupCorrupt(read.raw);
      lastOutcome = { kind: "corrupt" };
      return this.commit(createDefaultSave(), false);
    }

    const sanitized = sanitizeSave(parsed.value);
    const repaired = JSON.stringify(sanitized) !== JSON.stringify(parsed.value);
    lastOutcome = { kind: repaired ? "repaired" : "loaded" };
    if (repaired) return this.commit(sanitized, false);

    memory = sanitized;
    return cloneSave(sanitized);
  }

  /** Validates, stamps `updatedAt`, caches, and persists (best effort). Never throws. */
  static save(data: SaveDataV1): SaveDataV1 {
    this.ensureLoaded();
    return this.commit(data, true);
  }

  /** Restores defaults. A newer-version save in storage is still left untouched. */
  static reset(): SaveDataV1 {
    this.ensureLoaded();
    return this.commit(createDefaultSave(), true);
  }

  static completeMission(missionId: string, result: MissionResultSummary, memoryRewardId: string): SaveDataV1 {
    const current = this.load();
    const previousBest = ownValue(current.stats.bestMissionResults, missionId);
    const bestMissionResults: Record<string, MissionResultSummary> = { ...current.stats.bestMissionResults };
    if (isSafeId(missionId)) bestMissionResults[missionId] = pickWarmerResult(previousBest, result);

    return this.save({
      ...current,
      completedMissions: addUnique(current.completedMissions, missionId),
      collectedMemories: addUnique(current.collectedMemories, memoryRewardId),
      stats: {
        ...current.stats,
        totalDeliveries: current.stats.totalDeliveries + 1,
        totalCrashes: current.stats.totalCrashes + sanitizeCount(result.crashes),
        bestMissionResults,
      },
    });
  }

  static updateSettings(partial: Partial<SaveSettings>): SaveDataV1 {
    const current = this.load();
    const merged = sanitizeSettings({ ...current.settings, ...partial }, current.settings);
    return this.save({ ...current, settings: merged });
  }

  static isMissionCompleted(missionId: string): boolean {
    return this.load().completedMissions.includes(missionId);
  }

  static getBestResult(missionId: string): MissionResultSummary | undefined {
    return ownValue(this.load().stats.bestMissionResults, missionId);
  }

  static lastLoadOutcome(): SaveLoadOutcome {
    return lastOutcome;
  }

  /** Whether storage holds a save from a newer game version (the session runs in memory only). */
  static isStorageLocked(): boolean {
    return storageLocked;
  }

  /**
   * Whether progress is reaching storage. `session-only` means the game keeps everything in
   * memory for this visit (storage blocked, full, or holding a newer game's save).
   */
  static persistenceStatus(): SavePersistenceStatus {
    this.ensureLoaded();
    if (storageLocked) return { kind: "session-only", reason: "newer-save" };
    if (storageProblem === "unavailable") return { kind: "session-only", reason: "storage-unavailable" };
    if (memoryAhead) return { kind: "session-only", reason: "write-failed" };
    return { kind: "persistent" };
  }

  static diagnostics(): SaveDiagnostics {
    const persistence = this.persistenceStatus();
    return {
      firstLoadOutcome: firstOutcome ?? lastOutcome,
      lastLoadOutcome: lastOutcome,
      storageLocked,
      persistence,
      hasCorruptBackup: hasStoredKey(CORRUPT_BACKUP_KEY),
      hasLatestCorruptBackup: hasStoredKey(CORRUPT_BACKUP_LATEST_KEY),
    };
  }

  /** Forgets the session cache. For tests and dev tooling; the next `load()` re-reads storage. */
  static clearSessionCache(): void {
    memory = null;
    memoryAhead = false;
    storageLocked = false;
    lastOutcome = { kind: "memory" };
    firstOutcome = null;
    storageProblem = null;
  }

  /** Makes sure storage was inspected (and a future-version lock detected) before any write. */
  private static ensureLoaded(): void {
    if (memory === null) this.load();
  }

  private static commit(data: SaveDataV1, stamp: boolean): SaveDataV1 {
    const sanitized = sanitizeSave(data);
    const next: SaveDataV1 = stamp ? { ...sanitized, updatedAt: new Date().toISOString() } : sanitized;
    memory = next;
    memoryAhead = storageLocked ? true : !writeToStorage(next);
    return cloneSave(next);
  }
}

type StorageRead = { readonly kind: "unavailable" } | { readonly kind: "ok"; readonly raw: string | null };

function getStorage(): Storage | undefined {
  try {
    const storage: unknown = globalThis.localStorage;
    if (
      isRecord(storage) &&
      typeof storage.getItem === "function" &&
      typeof storage.setItem === "function"
    ) {
      return globalThis.localStorage;
    }
  } catch {
    // Accessing localStorage itself can throw (sandboxed iframes, blocked cookies).
  }
  return undefined;
}

function readFromStorage(): StorageRead {
  const storage = getStorage();
  if (!storage) {
    storageProblem = "unavailable";
    return { kind: "unavailable" };
  }
  try {
    const raw: unknown = storage.getItem(SAVE_KEY);
    return { kind: "ok", raw: typeof raw === "string" ? raw : null };
  } catch {
    storageProblem = "unavailable";
    return { kind: "unavailable" };
  }
}

function writeToStorage(data: SaveDataV1): boolean {
  if (storageLocked) return false;
  const storage = getStorage();
  if (!storage) {
    storageProblem = "unavailable";
    return false;
  }
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(data));
    storageProblem = null;
    return true;
  } catch {
    if (storageProblem !== "unavailable") storageProblem = "write-failed";
    return false;
  }
}

function readStoredKey(key: string): string | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const value: unknown = storage.getItem(key);
    return typeof value === "string" ? value : null;
  } catch {
    return null;
  }
}

function hasStoredKey(key: string): boolean {
  return readStoredKey(key) !== null;
}

/** Keeps the first corrupt save forever and the most recent later one; never throws. */
function backupCorrupt(raw: string): void {
  const storage = getStorage();
  if (!storage) return;
  const copy = raw.slice(0, SAVE_LIMITS.maxBackupLength);
  const first = readStoredKey(CORRUPT_BACKUP_KEY);
  if (first === copy) return;
  try {
    storage.setItem(first === null ? CORRUPT_BACKUP_KEY : CORRUPT_BACKUP_LATEST_KEY, copy);
  } catch {
    // Backups are a courtesy; ignore quota and privacy errors.
  }
}

function parseJson(raw: string): { readonly ok: true; readonly value: unknown } | { readonly ok: false } {
  try {
    const value: unknown = JSON.parse(raw);
    return { ok: true, value };
  } catch {
    return { ok: false };
  }
}

function readVersion(value: unknown): number | undefined {
  if (!isRecord(value)) return undefined;
  const version = value.version;
  if (typeof version === "number" && Number.isFinite(version)) return version;
  if (typeof version === "string" && version.trim() !== "") {
    const numeric = Number(version);
    return Number.isFinite(numeric) ? numeric : undefined;
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSafeId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= SAVE_LIMITS.maxIdLength &&
    !FORBIDDEN_KEYS.has(value)
  );
}

function sanitizeIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (out.length >= SAVE_LIMITS.maxListLength) break;
    if (isSafeId(item) && !out.includes(item)) out.push(item);
  }
  return out;
}

function mergeUnique(first: readonly string[], second: readonly string[]): string[] {
  const out = [...first];
  for (const item of second) {
    if (!out.includes(item)) out.push(item);
  }
  return out;
}

function addUnique(values: readonly string[], value: string): string[] {
  if (!isSafeId(value) || values.includes(value)) return [...values];
  return [...values, value];
}

function sanitizeCount(value: unknown, max: number = SAVE_LIMITS.maxCount): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return 0;
  return Math.min(Math.floor(value), max);
}

function sanitizeVolume(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(SAVE_LIMITS.maxVolume, Math.max(SAVE_LIMITS.minVolume, value));
}

function sanitizeTimestamp(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? fallback : new Date(parsed).toISOString();
}

function isInputScheme(value: unknown): value is InputScheme {
  return typeof value === "string" && INPUT_SCHEMES.some((scheme) => scheme === value);
}

function sanitizeBestResults(value: unknown): Record<string, MissionResultSummary> {
  const out: Record<string, MissionResultSummary> = {};
  if (!isRecord(value)) return out;
  let count = 0;
  for (const [missionId, entry] of Object.entries(value)) {
    if (count >= SAVE_LIMITS.maxBestResults) break;
    if (!isSafeId(missionId)) continue;
    const summary = sanitizeResultSummary(entry);
    if (!summary) continue;
    out[missionId] = summary;
    count += 1;
  }
  return out;
}

function sanitizeResultSummary(value: unknown): MissionResultSummary | undefined {
  if (!isRecord(value)) return undefined;
  const label = value.conditionLabel;
  if (typeof label !== "string" || label.length === 0 || label.length > SAVE_LIMITS.maxIdLength) return undefined;
  const completedAt = sanitizeTimestamp(value.completedAt, "");
  if (completedAt === "") return undefined;
  return {
    completedAt,
    conditionLabel: label,
    crashes: sanitizeCount(value.crashes),
    durationMs: sanitizeCount(value.durationMs, SAVE_LIMITS.maxDurationMs),
  };
}

function ownValue<T>(record: Readonly<Record<string, T>>, key: string): T | undefined {
  return Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined;
}

function cloneSave(data: SaveDataV1): SaveDataV1 {
  return {
    ...data,
    completedMissions: [...data.completedMissions],
    unlockedMissions: [...data.unlockedMissions],
    collectedMemories: [...data.collectedMemories],
    unlockedCosmetics: [...data.unlockedCosmetics],
    equippedCosmetics: [...data.equippedCosmetics],
    settings: { ...data.settings },
    stats: {
      ...data.stats,
      bestMissionResults: Object.fromEntries(
        Object.entries(data.stats.bestMissionResults).map(([key, summary]) => [key, { ...summary }]),
      ),
    },
  };
}
