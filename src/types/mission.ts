import type { PackageConditionLabel } from "./flight";
import type { LandingResultKind } from "./landing";

export type MissionDefinition = {
  readonly id: string;
  readonly title: string;
  readonly routeId: string;
  readonly recipientName: string;
  readonly deliveryItemName: string;
  readonly requestText: string;
  readonly memoryRewardId: string;
  readonly resultLines: Record<PackageConditionLabel, string>;
  readonly landingLines: Record<LandingResultKind, string>;
};
