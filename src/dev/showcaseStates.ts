import { TEA_MOON_MISSION_ID } from "../data/missions";
import type { SceneKey } from "../game/events";
import type { FlightSceneData } from "../types/flight";
import type { DeliveryResultSceneData, LandingSceneInit } from "../types/landing";

/**
 * Reproducible dev-only scene states for screenshots, critics, and playtests.
 * Open with `?showcase=<id>` while running `npm run dev`. The e2e harness reads this list
 * through `window.__CGE__.showcases`, so this file is the single source of truth.
 *
 * `hold` lists keyboard keys (Playwright key names) the harness holds during `settleMs`.
 * `save` selects the localStorage fixture applied before the game boots.
 */
export type ShowcaseSaveFixture = "fresh" | "completed" | "corrupt" | "keep";

export type ShowcaseStateDefinition = {
  readonly id: string;
  readonly sceneKey: SceneKey;
  readonly description: string;
  readonly settleMs: number;
  readonly save: ShowcaseSaveFixture;
  readonly hold?: readonly string[];
  readonly data?: () => object;
};

const flight = (data: FlightSceneData): (() => FlightSceneData) => () => data;
const landing = (data: Omit<LandingSceneInit, "missionId" | "routeCrashes" | "routeDurationMs">): (() => LandingSceneInit) => () => ({
  missionId: TEA_MOON_MISSION_ID,
  routeCrashes: 0,
  routeDurationMs: 0,
  ...data,
});
const result = (data: Omit<DeliveryResultSceneData, "missionId">): (() => DeliveryResultSceneData) => () => ({
  missionId: TEA_MOON_MISSION_ID,
  ...data,
});

export const SHOWCASE_STATES: readonly ShowcaseStateDefinition[] = [
  { id: "fx-gallery", sceneKey: "FxGalleryScene", description: "Dev gallery of src/fx effects", settleMs: 1200, save: "fresh" },
  { id: "ui-kit", sceneKey: "UiKitScene", description: "Dev gallery of src/ui components", settleMs: 900, save: "fresh" },
  { id: "title", sceneKey: "TitleScene", description: "Title, fresh save", settleMs: 1400, save: "fresh" },
  {
    id: "title-completed",
    sceneKey: "TitleScene",
    description: "Title after Tea Moon delivered (saved completion)",
    settleMs: 1400,
    save: "completed",
  },
  {
    id: "title-corrupt-save",
    sceneKey: "TitleScene",
    description: "Title with a corrupted save (must recover silently)",
    settleMs: 1200,
    save: "corrupt",
  },
  {
    id: "flight-start",
    sceneKey: "FlightScene",
    description: "Route start, ship idle at launch",
    settleMs: 1500,
    save: "fresh",
    data: flight({ missionId: TEA_MOON_MISSION_ID }),
  },
  {
    id: "flight-cruise",
    sceneKey: "FlightScene",
    description: "Mid-route cruising between asteroids with thrust held",
    settleMs: 900,
    save: "fresh",
    hold: ["KeyW"],
    data: flight({
      missionId: TEA_MOON_MISSION_ID,
      start: { x: 1300, y: 900, rotation: Math.PI / 2 + 0.04, velocityX: 180, velocityY: 0 },
    }),
  },
  {
    id: "flight-approach",
    sceneKey: "FlightScene",
    description: "Tea Moon dock in view, slowing for arrival",
    settleMs: 1300,
    save: "fresh",
    hold: ["KeyS"],
    data: flight({
      missionId: TEA_MOON_MISSION_ID,
      start: { x: 2470, y: 870, rotation: -Math.PI / 2 + 0.3, velocityX: 110, velocityY: -6 },
    }),
  },
  {
    id: "flight-arrival-ready",
    sceneKey: "FlightScene",
    description: "Inside delivery ring, bottom aligned, landing window holding",
    // Starts just above dockingMaxSpeed (70) drifting toward the dock, so the window cannot open
    // until the harness holds the brake (S); it then opens ~50 ms later and the capture lands
    // mid-progress (~0.5) instead of on the fade-out to LandingScene. Load latency only adds drift
    // (<= ~100 px), which stays inside the 132 px delivery ring.
    settleMs: 320,
    save: "fresh",
    hold: ["KeyS"],
    data: flight({
      missionId: TEA_MOON_MISSION_ID,
      start: { x: 2735, y: 850, rotation: -Math.PI / 2, velocityX: 95, velocityY: 0 },
    }),
  },
  {
    id: "flight-incident",
    sceneKey: "FlightScene",
    description: "Fast asteroid hit, gyoza incident animation",
    settleMs: 420,
    save: "fresh",
    data: flight({
      missionId: TEA_MOON_MISSION_ID,
      start: { x: 1440, y: 735, rotation: Math.PI / 2, velocityX: 320, velocityY: 0 },
    }),
  },
  {
    id: "landing-descent",
    sceneKey: "LandingScene",
    description: "Landing start, high above the pad",
    settleMs: 900,
    save: "fresh",
    data: landing({ packageCondition: 100 }),
  },
  {
    id: "landing-thrust",
    sceneKey: "LandingScene",
    description: "Low over the pad, bottom thruster firing, slight tilt",
    settleMs: 700,
    save: "fresh",
    hold: ["KeyW"],
    data: landing({
      packageCondition: 88,
      start: { x: 600, y: 430, rotation: 0.14, velocityX: 10, velocityY: 60, angularVelocity: 0 },
    }),
  },
  {
    id: "landing-stabilizer",
    sceneKey: "LandingScene",
    description: "Tilted mid-descent with the stabilizer (S) held: gyro ring and level line",
    settleMs: 400,
    save: "fresh",
    hold: ["KeyS"],
    data: landing({
      packageCondition: 100,
      start: { x: 640, y: 300, rotation: 0.45, velocityX: 0, velocityY: 60, angularVelocity: 0 },
    }),
  },
  {
    id: "landing-settle-soft",
    sceneKey: "LandingScene",
    description: "Soft touchdown on the pad, settling",
    settleMs: 650,
    save: "fresh",
    data: landing({
      packageCondition: 100,
      start: { x: 640, y: 540, rotation: 0, velocityX: 0, velocityY: 34, angularVelocity: 0 },
    }),
  },
  {
    id: "landing-incident",
    sceneKey: "LandingScene",
    description: "Hard drop incident animation",
    settleMs: 420,
    save: "fresh",
    data: landing({
      packageCondition: 90,
      start: { x: 660, y: 470, rotation: 0.1, velocityX: 20, velocityY: 300, angularVelocity: 0 },
    }),
  },
  {
    id: "landing-offpad",
    sceneKey: "LandingScene",
    description: "Off-pad incident animation",
    settleMs: 520,
    save: "fresh",
    data: landing({
      packageCondition: 90,
      start: { x: 190, y: 500, rotation: -0.2, velocityX: -40, velocityY: 110, angularVelocity: 0 },
    }),
  },
  {
    id: "result-soft",
    sceneKey: "DeliveryResultScene",
    description: "Result card after a soft, clean delivery",
    settleMs: 1600,
    save: "fresh",
    data: result({
      packageCondition: 100,
      routeCrashes: 0,
      routeDurationMs: 74000,
      landingResult: "soft",
      landingIncidents: 0,
    }),
  },
  {
    id: "result-bumpy",
    sceneKey: "DeliveryResultScene",
    description: "Result card after a bumpy landing with a rough route",
    settleMs: 1600,
    save: "fresh",
    data: result({
      packageCondition: 58,
      routeCrashes: 2,
      routeDurationMs: 131000,
      landingResult: "bumpy",
      landingIncidents: 1,
    }),
  },
  {
    id: "result-incident",
    sceneKey: "DeliveryResultScene",
    description: "Result card after a landing incident; long stamps exercise the wrap layout",
    settleMs: 1600,
    save: "fresh",
    data: result({
      packageCondition: 20,
      routeCrashes: 4,
      routeDurationMs: 168000,
      landingResult: "incident",
      landingIncidents: 3,
    }),
  },
];

export function findShowcaseState(id: string | null): ShowcaseStateDefinition | undefined {
  if (!id) return undefined;
  return SHOWCASE_STATES.find((state) => state.id === id);
}

/** Reads `?showcase=` from the page URL. Dev only; returns undefined in production. */
export function readRequestedShowcase(): ShowcaseStateDefinition | undefined {
  if (!import.meta.env.DEV || typeof window === "undefined") return undefined;
  return findShowcaseState(new URLSearchParams(window.location.search).get("showcase"));
}
