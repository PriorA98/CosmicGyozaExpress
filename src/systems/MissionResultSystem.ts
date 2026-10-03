import type { UiIconName } from "../data/assetManifest";
import { campaignMissions, resolveMission } from "../data/campaign";
import { themeFor } from "../data/campaign/themes";
import {
  RESULT_TINY_DISPLAY_SCALE,
  campaignResultCopy,
  missionResultCopy,
  resultCopy,
  type CountPhrase,
  type ResultLayoutTier,
  type ResultStampTone,
} from "../data/resultCopy";
import type { PackageConditionLabel } from "../types/flight";
import type { DeliveryResultContent, DeliveryResultSceneData, LandingResultKind } from "../types/landing";
import type { MissionDefinitionV2, MissionId, ThemeId } from "../types/campaign";
import type { MissionResultSummary } from "../types/save";
import type { SavePersistenceStatus } from "./SaveSystem";
import { nextMissionAfter, normalizeCampaignProgress, type CampaignProgress } from "./CampaignSystem";
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
  /** Campaign progress before this delivery (drives actions and the final thank-you notes). Defaults to a fresh save. */
  readonly progress?: CampaignProgress;
};

export type ResultActionKind = "next-delivery" | "delivery-board" | "fly-again" | "read-notes" | "back-to-title";

/** One footer action, in left-to-right order. `codes` are KeyboardEvent.code values that trigger it. */
export type ResultAction = {
  readonly kind: ResultActionKind;
  readonly label: string;
  readonly key: string;
  readonly codes: readonly string[];
  readonly variant: "primary" | "secondary";
  /** Mission to launch (next delivery / fly again) or to focus on the delivery board. */
  readonly missionId: MissionId;
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
  readonly missionId: MissionId;
  readonly themeId: ThemeId;
  /** Tea Moon keeps the slice card art (rabbit, tea + mochi tray, moon backdrop). */
  readonly legacy: boolean;
  readonly kickerPlace: string;
  readonly recipientCaption: string;
  /** Authored closing line (I'm Fine, Home); shown in place of the condition report line. */
  readonly closingLine: string | null;
  /** The final delivery: thank-you notes replace the stamps and stats. */
  readonly isEnding: boolean;
  /** One line per completed earlier delivery (completed missions only). */
  readonly thankYouNotes: readonly string[];
  readonly actions: readonly ResultAction[];
};

/**
 * Normalizes untrusted/partial scene data: unknown missions fall back to Tea Moon, counts become
 * non-negative integers, condition is clamped, and an unknown landing result reads as soft.
 */
export function normalizeDeliveryResultData(data: Partial<DeliveryResultSceneData> | undefined): DeliveryResultSceneData {
  const source = data ?? {};
  const mission = resolveMission(source.missionId);
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
  const mission = resolveMission(safe.missionId);
  const conditionLabel = packageConditionLabel(safe.packageCondition);

  return {
    missionId: mission.id,
    headline: isEndingMission(mission) ? campaignResultCopy.endingHeadline : resultCopy.headlines[safe.landingResult],
    deliveryItemName: mission.deliveryItemName,
    recipientName: mission.recipientName,
    conditionLabel,
    landingLabel: mission.landingLines[safe.landingResult],
    reportLine: mission.resultLines[conditionLabel],
    reactionLine: reactionLineFor(mission.id, safe.landingResult, conditionLabel, safe.routeCrashes + safe.landingIncidents),
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
  const mission = resolveMission(safe.missionId);
  const copy = missionResultCopy[mission.id];
  const theme = themeFor(mission.themeId);
  const before = history.progress ?? normalizeCampaignProgress([], []);
  const after = normalizeCampaignProgress([...before.completedMissions, mission.id], before.unlockedMissions);
  const isEnding = isEndingMission(mission);

  return {
    content,
    landingResult: safe.landingResult,
    kicker: isEnding ? campaignResultCopy.endingKicker : resultCopy.kicker,
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
        text: phraseCount(copy.landingTries, safe.landingIncidents, safe.landingIncidents + 1),
      },
    ],
    postcardLabel: history.memoryAlreadyCollected ? resultCopy.postcard.repeatLabel : resultCopy.postcard.firstLabel,
    postcardTitle: copy.postcardTitle,
    postcardCaption: resultCopy.postcard.caption,
    deliveryNote: isNewWarmest
      ? resultCopy.deliveryNote.warmestPage
      : deliveryNumber <= 1
        ? deliveryNoteFor(mission, 1)
        : deliveryNoteFor(mission, deliveryNumber),
    isNewWarmest,
    missionId: mission.id,
    themeId: mission.themeId,
    legacy: theme.legacy,
    kickerPlace: isEnding ? campaignResultCopy.endingPlace : copy.place,
    recipientCaption: copy.recipientCaption,
    closingLine: mission.closingLine,
    isEnding,
    thankYouNotes: isEnding ? thankYouNotes(before) : [],
    actions: resultActionsFor(mission.id, after),
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

/** The final delivery: a mission that unlocks nothing further. */
export function isEndingMission(mission: MissionDefinitionV2): boolean {
  return mission.unlocksMissionIds.length === 0;
}

/** Thank-you notes for every completed delivery before the ending, in board order. Never counts collectibles. */
export function thankYouNotes(progress: CampaignProgress): readonly string[] {
  return campaignMissions
    .filter((mission) => !isEndingMission(mission) && progress.completedMissions.includes(mission.id))
    .map((mission) => missionResultCopy[mission.id].thankYouNote);
}

const ENTER_CODES = ["Enter", "NumpadEnter"] as const;

/**
 * Footer actions for a finished delivery, left to right. `progress` is the campaign state after this
 * delivery. All cards offer a replay, the board and the next unlocked delivery;
 * the final card offers the notes, the board and the flight home.
 */
export function resultActionsFor(missionId: MissionId, progress: CampaignProgress): readonly ResultAction[] {
  const mission = resolveMission(missionId);
  const buttons = campaignResultCopy.buttons;
  const id = mission.id;
  const boardAsPrimary: ResultAction = {
    kind: "delivery-board",
    label: buttons.deliveryBoard.label,
    key: buttons.nextDelivery.key,
    codes: [...ENTER_CODES, "Escape"],
    variant: "primary",
    missionId: id,
  };
  if (isEndingMission(mission)) {
    return [
      { kind: "read-notes", ...buttons.readNotes, codes: ["KeyN"], variant: "secondary", missionId: id },
      { kind: "fly-again", ...buttons.flyHome, codes: ["KeyR"], variant: "secondary", missionId: id },
      boardAsPrimary,
    ];
  }
  const flyAgain: ResultAction = { kind: "fly-again", ...buttons.flyAgain, codes: ["KeyR"], variant: "secondary", missionId: id };
  const next = nextMissionAfter(id, progress);
  if (!next) return [flyAgain, boardAsPrimary];
  return [
    flyAgain,
    { kind: "delivery-board", ...buttons.deliveryBoard, codes: ["Escape"], variant: "secondary", missionId: next.id },
    { kind: "next-delivery", ...buttons.nextDelivery, codes: ENTER_CODES, variant: "primary", missionId: next.id },
  ];
}

/** Preserve the slice's authored footer; campaign destinations use their natural display names. */
function deliveryNoteFor(mission: MissionDefinitionV2, deliveryNumber: number): string {
  const copy = missionResultCopy[mission.id].deliveryNote;
  if (themeFor(mission.themeId).legacy) {
    return deliveryNumber === 1 ? copy.first : copy.repeat.replace("{n}", String(deliveryNumber));
  }
  const destination = isEndingMission(mission) ? "home" : `to ${mission.shortTitle}`;
  return deliveryNumber === 1 ? `first delivery ${destination}` : `delivery no. ${deliveryNumber} ${destination}`;
}

function reactionLineFor(
  missionId: MissionId,
  landingResult: LandingResultKind,
  conditionLabel: PackageConditionLabel,
  bumps: number,
): string {
  const lines = missionResultCopy[missionId].reactionLines[landingResult];
  const index = (packageConditionWarmth(conditionLabel) + bumps) % lines.length;
  return lines[index] ?? lines[0] ?? "";
}

function isLandingResult(value: unknown): value is LandingResultKind {
  return typeof value === "string" && LANDING_RESULTS.some((kind) => kind === value);
}

function countOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}
