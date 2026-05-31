import { describe, expect, it } from "vitest";
import {
  createDevLandingSceneData,
  findDevSceneLaunchForKeyEvent,
  getDevSceneLaunch,
} from "../src/dev/devSceneLaunches";
import { TEA_MOON_MISSION_ID } from "../src/data/missions";

describe("dev scene launches", () => {
  it("defines a reusable landing launch target", () => {
    const launch = getDevSceneLaunch("landing");

    expect(launch?.sceneKey).toBe("LandingScene");
    expect(launch?.shortcutLabel).toBe("Shift+L");
  });

  it("creates valid landing scene data for direct launch", () => {
    expect(createDevLandingSceneData()).toEqual({
      missionId: TEA_MOON_MISSION_ID,
      packageCondition: 100,
      routeCrashes: 0,
      routeDurationMs: 0,
    });
  });

  it("matches only shift scene-launch shortcuts", () => {
    expect(
      findDevSceneLaunchForKeyEvent({
        code: "KeyL",
        shiftKey: true,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
      })?.id,
    ).toBe("landing");
    expect(
      findDevSceneLaunchForKeyEvent({
        code: "KeyL",
        shiftKey: false,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
      }),
    ).toBeUndefined();
  });
});
