import { getMissionById } from "../data/missions";
import type { MissionResultSummary } from "../types/save";
import type { DeliveryResultContent, DeliveryResultSceneData } from "../types/landing";
import { packageConditionLabel } from "./PackageConditionSystem";

export function createDeliveryResultContent(data: DeliveryResultSceneData): DeliveryResultContent {
  const mission = getMissionById(data.missionId);
  const conditionLabel = packageConditionLabel(data.packageCondition);
  const totalCrashes = data.routeCrashes + data.landingIncidents;

  return {
    missionId: mission.id,
    headline: "delivery accepted",
    deliveryItemName: mission.deliveryItemName,
    recipientName: mission.recipientName,
    conditionLabel,
    landingLabel: mission.landingLines[data.landingResult],
    reportLine: mission.resultLines[conditionLabel],
    reactionLine: reactionLineFor(data.landingResult),
    memoryRewardId: mission.memoryRewardId,
    totalCrashes,
    durationMs: data.routeDurationMs,
  };
}

export function createMissionResultSummary(content: DeliveryResultContent): MissionResultSummary {
  return {
    completedAt: new Date().toISOString(),
    conditionLabel: content.conditionLabel,
    crashes: content.totalCrashes,
    durationMs: content.durationMs,
  };
}

function reactionLineFor(landingResult: DeliveryResultSceneData["landingResult"]): string {
  switch (landingResult) {
    case "soft":
      return "Sleepy Moon Rabbit blinks slowly and says the tea arrived like a tiny sunrise.";
    case "bumpy":
      return "Sleepy Moon Rabbit says the landing sounded like a cupboard, which is apparently comforting.";
    case "incident":
      return "Sleepy Moon Rabbit accepts the reassembled snack with ceremonial patience.";
  }
}
