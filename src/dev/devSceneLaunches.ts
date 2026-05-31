import { TEA_MOON_MISSION_ID } from "../data/missions";
import type { LandingSceneData } from "../types/landing";

export type DevSceneLaunchId = "flight" | "landing";

export type DevSceneLaunchKeyEvent = Pick<KeyboardEvent, "altKey" | "code" | "ctrlKey" | "metaKey" | "shiftKey">;

export type DevSceneLaunchDefinition = {
  readonly id: DevSceneLaunchId;
  readonly label: string;
  readonly sceneKey: string;
  readonly shortcutLabel: string;
  readonly keyCode: string;
  readonly description: string;
  readonly data?: () => object;
};

export function isDevToolsEnabled(): boolean {
  return import.meta.env.DEV;
}

export function createDevLandingSceneData(): LandingSceneData {
  return {
    missionId: TEA_MOON_MISSION_ID,
    packageCondition: 100,
    routeCrashes: 0,
    routeDurationMs: 0,
  };
}

export const DEV_SCENE_LAUNCHES: readonly DevSceneLaunchDefinition[] = [
  {
    id: "flight",
    label: "FlightScene",
    sceneKey: "FlightScene",
    shortcutLabel: "Shift+F",
    keyCode: "KeyF",
    description: "Tea Moon route start",
  },
  {
    id: "landing",
    label: "LandingScene",
    sceneKey: "LandingScene",
    shortcutLabel: "Shift+L",
    keyCode: "KeyL",
    description: "Tea Moon landing start",
    data: createDevLandingSceneData,
  },
] as const;

export function getDevSceneLaunch(id: DevSceneLaunchId): DevSceneLaunchDefinition | undefined {
  return DEV_SCENE_LAUNCHES.find((launch) => launch.id === id);
}

export function findDevSceneLaunchForKeyEvent(
  event: DevSceneLaunchKeyEvent,
  launches: readonly DevSceneLaunchDefinition[] = DEV_SCENE_LAUNCHES,
): DevSceneLaunchDefinition | undefined {
  if (!event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return undefined;

  return launches.find((launch) => launch.keyCode === event.code);
}
