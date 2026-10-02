/**
 * Campaign registry (integrator-owned). Missions in board order; routes and landings resolved by typed id.
 * Scenes resolve a mission once at init and read everything else from these definitions.
 */
import type {
  FlightRouteDefinition,
  LandingDefinition,
  LandingId,
  MissionDefinitionV2,
  MissionId,
  RouteId,
} from "../../types/campaign";
import { bentoBeltLanding, bentoBeltMission, bentoBeltRoute } from "./bentoBelt";
import { blackHoleBakeryLanding, blackHoleBakeryMission, blackHoleBakeryRoute } from "./blackHoleBakery";
import { homeDeliveryLanding, homeDeliveryMission, homeDeliveryRoute } from "./homeDelivery";
import { imFineLanding, imFineMission, imFineRoute } from "./imFine";
import { matchaNebulaLanding, matchaNebulaMission, matchaNebulaRoute } from "./matchaNebula";
import { teaMoonLanding, teaMoonMission, teaMoonRoute } from "./teaMoon";

export const campaignMissions: readonly MissionDefinitionV2[] = [
  teaMoonMission,
  bentoBeltMission,
  matchaNebulaMission,
  blackHoleBakeryMission,
  imFineMission,
  homeDeliveryMission,
];

export const MISSION_IDS: readonly MissionId[] = campaignMissions.map((mission) => mission.id);

const routes: Readonly<Record<RouteId, FlightRouteDefinition>> = {
  "phase-1-tea-moon-test-route": teaMoonRoute,
  "bento-belt-route": bentoBeltRoute,
  "matcha-nebula-route": matchaNebulaRoute,
  "black-hole-bakery-route": blackHoleBakeryRoute,
  "im-fine-route": imFineRoute,
  "home-delivery-route": homeDeliveryRoute,
};

const landings: Readonly<Record<LandingId, LandingDefinition>> = {
  "tea-moon-landing": teaMoonLanding,
  "bento-belt-landing": bentoBeltLanding,
  "matcha-nebula-landing": matchaNebulaLanding,
  "black-hole-bakery-landing": blackHoleBakeryLanding,
  "im-fine-landing": imFineLanding,
  "home-delivery-landing": homeDeliveryLanding,
};

export function isMissionId(value: unknown): value is MissionId {
  return typeof value === "string" && (MISSION_IDS as readonly string[]).includes(value);
}

/** Resolves a mission; unknown ids fall back to Tea Moon (scene init data is untrusted). */
export function resolveMission(missionId: unknown): MissionDefinitionV2 {
  return campaignMissions.find((mission) => mission.id === missionId) ?? teaMoonMission;
}

export function getRoute(routeId: RouteId): FlightRouteDefinition {
  return routes[routeId];
}

export function getLanding(landingId: LandingId): LandingDefinition {
  return landings[landingId];
}

export function routeForMission(missionId: unknown): FlightRouteDefinition {
  return getRoute(resolveMission(missionId).routeId);
}

export function landingForMission(missionId: unknown): LandingDefinition {
  return getLanding(resolveMission(missionId).landingId);
}

/** Postcard memory ids that exist anywhere in the campaign (save allowlist). */
export const COLLECTIBLE_MEMORY_IDS: readonly string[] = Object.values(routes).flatMap((route) =>
  route.collectibles.map((collectible) => collectible.memoryId),
);

export const MISSION_MEMORY_IDS: readonly string[] = campaignMissions.map((mission) => mission.memoryRewardId);
