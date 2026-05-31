import type { PackageConditionLabel } from "./flight";

export type LandingControls = {
  thrust: boolean;
  rotateLeft: boolean;
  rotateRight: boolean;
  stabilizer: boolean;
};

export type LandingKinematicState = {
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
  readonly velocityX: number;
  readonly velocityY: number;
  readonly angularVelocity: number;
};

export type LandingPadDefinition = {
  readonly centerX: number;
  readonly surfaceY: number;
  readonly width: number;
};

export type LandingResultKind = "soft" | "bumpy" | "incident";
export type LandingIncidentKind = "hard-drop" | "skid" | "tilt-tip" | "off-pad";

export type LandingTouchdownMetrics = {
  readonly onPad: boolean;
  readonly verticalSpeed: number;
  readonly horizontalSpeed: number;
  readonly angleDegrees: number;
};

export type LandingIncidentTouchdownResult = LandingTouchdownMetrics & {
  readonly kind: "incident";
};

export type LandingTouchdownResult =
  | { readonly kind: "none" }
  | (LandingTouchdownMetrics & { readonly kind: Exclude<LandingResultKind, "incident"> })
  | LandingIncidentTouchdownResult;

export type LandingPhase =
  | { readonly kind: "intro" }
  | { readonly kind: "descending" }
  | { readonly kind: "settling"; readonly startedAtMs: number; readonly result: LandingResultKind }
  | { readonly kind: "delivered"; readonly result: LandingResultKind }
  | { readonly kind: "incident"; readonly startedAtMs: number; readonly incidentKind: LandingIncidentKind };

export type LandingSceneData = {
  readonly missionId: string;
  readonly packageCondition: number;
  readonly routeCrashes: number;
  readonly routeDurationMs: number;
};

export type DeliveryResultSceneData = LandingSceneData & {
  readonly landingResult: LandingResultKind;
  readonly landingIncidents: number;
};

export type DeliveryResultContent = {
  readonly missionId: string;
  readonly headline: string;
  readonly deliveryItemName: string;
  readonly recipientName: string;
  readonly conditionLabel: PackageConditionLabel;
  readonly landingLabel: string;
  readonly reportLine: string;
  readonly reactionLine: string;
  readonly memoryRewardId: string;
  readonly totalCrashes: number;
  readonly durationMs: number;
};
