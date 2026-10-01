import type { UiIconName } from "../data/assetManifest";
import { missions, teaMoonMission } from "../data/missions";
import {
  RESULT_TINY_DISPLAY_SCALE,
  resultCopy,
  type CountPhrase,
  type ResultLayoutTier,
  type ResultStampTone,
} from "../data/resultCopy";
import type { PackageConditionLabel } from "../types/flight";
import type { DeliveryResultContent, DeliveryResultSceneData, LandingResultKind } from "../types/landing";
import type { MissionDefinition } from "../types/mission";
import type { MissionResultSummary } from "../types/save";
import type { SavePersistenceStatus } from "./SaveSystem";
import { normalizePackageCondition, packageConditionLabel, packageConditionWarmth } from "./PackageConditionSystem";

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const LANDING_RESULTS: readonly LandingResultKind[] = ["soft", "bumpy", "incident"];

export type ResultStamp = {
  readonly label: string;
  readonly tone: ResultStampTone;
};

export type ResultStatLine = {
  readonly icon: UiIconName;
  readonly text: string;
};

/** What the save looked like before this delivery was recorded (drives "first delivery" style notes). */
export type DeliveryHistory = {
  readonly previousDeliveries: number;
  readonly previousBest?: MissionResultSummary;
  readonly memoryAlreadyCollected: boolean;
};

export type DeliveryResultPresentation = {
  readonly content: DeliveryResultContent;
  readonly landingResult: LandingResultKind;
  readonly kicker: string;
  readonly landingStamp: ResultStamp;
  readonly conditionStamp: ResultStamp;
  readonly stats: readonly ResultStatLine[];
  readonly postcardLabel: string;
  readonly postcardTitle: string;
  readonly postcardCaption: string;
  readonly deliveryNote: string;
  readonly isNewWarmest: boolean;
};

/**
 * Normalizes untrusted/partial scene data: unknown missions fall back to Tea Moon, counts become
 * non-negative integers, condition is clamped, and an unknown landing result reads as soft.
 */
export function normalizeDeliveryResultData(data: Partial<DeliveryResultSceneData> | undefined): DeliveryResultSceneData {
  const source = data ?? {};
  const mission = findMission(source.missionId);
  return {
    missionId: mission.id,
    packageCondition: normalizePackageCondition(typeof source.packageCondition === "number" ? source.packageCondition : Number.NaN),
    routeCrashes: countOrZero(source.routeCrashes),
    routeDurationMs: countOrZero(source.routeDurationMs),
    landingResult: isLandingResult(source.landingResult) ? source.landingResult : "soft",
    landingIncidents: countOrZero(source.landingIncidents),
  };
}

export function createDeliveryResultContent(data: DeliveryResultSceneData): DeliveryResultContent {
  const safe = normalizeDeliveryResultData(data);
  const mission = findMission(safe.missionId);
  const conditionLabel = packageConditionLabel(safe.packageCondition);

  return {
    missionId: mission.id,
    headline: resultCopy.headlines[safe.landingResult],
    deliveryItemName: mission.deliveryItemName,
    recipientName: mission.recipientName,
    conditionLabel,
    landingLabel: mission.landingLines[safe.landingResult],
    reportLine: mission.resultLines[conditionLabel],
    reactionLine: reactionLineFor(safe.landingResult, conditionLabel, safe.routeCrashes + safe.landingIncidents),
    memoryRewardId: mission.memoryRewardId,
    totalCrashes: safe.routeCrashes + safe.landingIncidents,
    durationMs: safe.routeDurationMs,
  };
}

export function createMissionResultSummary(content: DeliveryResultContent, now: Date = new Date()): MissionResultSummary {
  return {
    completedAt: now.toISOString(),
    conditionLabel: content.conditionLabel,
    crashes: content.totalCrashes,
    durationMs: content.durationMs,
  };
}

/** Everything the result card shows, already phrased. Pure: no save access. */
export function createDeliveryResultPresentation(
  data: DeliveryResultSceneData,
  history: DeliveryHistory,
): DeliveryResultPresentation {
  const safe = normalizeDeliveryResultData(data);
  const content = createDeliveryResultContent(safe);
  const summary = createMissionResultSummary(content);
  const previousDeliveries = countOrZero(history.previousDeliveries);
  const isNewWarmest = history.previousBest !== undefined && isWarmerResult(summary, history.previousBest);
  const deliveryNumber = previousDeliveries + 1;

  return {
    content,
    landingResult: safe.landingResult,
    kicker: resultCopy.kicker,
    landingStamp: resultCopy.landingStamps[safe.landingResult],
    conditionStamp: {
      label: content.conditionLabel.toLowerCase(),
      tone: resultCopy.conditionTones[content.conditionLabel],
    },
    stats: [
      { icon: resultCopy.stats.routeTime.icon, text: describeRouteTime(safe.routeDurationMs) },
      { icon: resultCopy.stats.bumps.icon, text: phraseCount(resultCopy.stats.bumps.phrase, safe.routeCrashes) },
      {
        icon: resultCopy.stats.landingTries.icon,
        text: phraseCount(resultCopy.stats.landingTries.phrase, safe.landingIncidents, safe.landingIncidents + 1),
      },
    ],
    postcardLabel: history.memoryAlreadyCollected ? resultCopy.postcard.repeatLabel : resultCopy.postcard.firstLabel,
    postcardTitle: resultCopy.postcard.title,
    postcardCaption: resultCopy.postcard.caption,
    deliveryNote: isNewWarmest
      ? resultCopy.deliveryNote.warmestPage
      : deliveryNumber <= 1
        ? resultCopy.deliveryNote.first
        : resultCopy.deliveryNote.repeat.replace("{n}", String(deliveryNumber)),
    isNewWarmest,
  };
}

/**
 * True when `candidate` should replace `current` as the remembered best: a warmer package label wins,
 * then fewer bumps, then a quicker (non-zero) route. Ties keep the existing record.
 */
export function isWarmerResult(candidate: MissionResultSummary, current: MissionResultSummary): boolean {
  const warmthDelta = packageConditionWarmth(candidate.conditionLabel) - packageConditionWarmth(current.conditionLabel);
  if (warmthDelta !== 0) return warmthDelta < 0;
  if (candidate.crashes !== current.crashes) return candidate.crashes < current.crashes;
  if (candidate.durationMs > 0 && current.durationMs > 0 && candidate.durationMs !== current.durationMs) {
    return candidate.durationMs < current.durationMs;
  }
  if (current.durationMs <= 0 && candidate.durationMs > 0) return true;
  return false;
}

/** Never punishes: the remembered result only ever gets warmer. */
export function pickWarmerResult(
  previous: MissionResultSummary | undefined,
  next: MissionResultSummary,
): MissionResultSummary {
  if (!previous) return next;
  return isWarmerResult(next, previous) ? next : previous;
}

export function formatRouteTime(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.round(countOrZero(durationMs) / MS_PER_SECOND));
  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  return minutes > 0 ? `${minutes}m ${String(seconds).padStart(2, "0")}s` : `${seconds}s`;
}

export function describeRouteTime(durationMs: number): string {
  const safe = countOrZero(durationMs);
  if (safe < MS_PER_SECOND) return resultCopy.stats.routeTime.unhurried;
  return resultCopy.stats.routeTime.template.replace("{time}", formatRouteTime(safe));
}

/**
 * A kind footnote for the result card when this visit's progress cannot be kept; undefined when
 * the save is reaching storage normally (or a corrupt save was quietly recovered).
 */
export function persistenceNotice(status: SavePersistenceStatus): string | undefined {
  return status.kind === "session-only" ? resultCopy.persistenceNotice[status.reason] : undefined;
}

/**
 * Picks the result card layout for the size the canvas is shown at. `compact` comes from the
 * shared display helper (phone-class display); `displayScale` is shown px per logical px.
 */
export function pickResultLayoutTier(compact: boolean, displayScale: number): ResultLayoutTier {
  if (!compact) return "full";
  return Number.isFinite(displayScale) && displayScale > 0 && displayScale < RESULT_TINY_DISPLAY_SCALE ? "tiny" : "compact";
}

/** `count` picks the zero/one/many form; `shown` is the number substituted (defaults to `count`). */
export function phraseCount(phrase: CountPhrase, count: number, shown: number = count): string {
  const safe = countOrZero(count);
  if (safe === 0) return phrase.zero;
  if (safe === 1) return phrase.one;
  return phrase.many.replace("{n}", String(countOrZero(shown)));
}

function reactionLineFor(landingResult: LandingResultKind, conditionLabel: PackageConditionLabel, bumps: number): string {
  const lines = resultCopy.reactionLines[landingResult];
  const index = (packageConditionWarmth(conditionLabel) + bumps) % lines.length;
  return lines[index] ?? lines[0];
}

function findMission(missionId: unknown): MissionDefinition {
  return missions.find((candidate) => candidate.id === missionId) ?? teaMoonMission;
}

function isLandingResult(value: unknown): value is LandingResultKind {
  return typeof value === "string" && LANDING_RESULTS.some((kind) => kind === value);
}

function countOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}
