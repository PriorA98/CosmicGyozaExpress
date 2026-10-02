import { TEA_MOON_MISSION_ID } from "../data/missions";
import { landingForMission } from "../data/campaign";
import type { SceneKey } from "../game/events";
import type { MissionId } from "../types/campaign";
import type { TitleSceneData } from "../scenes/TitleScene";
import type { FlightSceneData } from "../types/flight";
import type { DeliveryResultSceneData, LandingSceneInit } from "../types/landing";

/**
 * Reproducible dev-only scene states for screenshots, critics, and playtests.
 * Open with `?showcase=<id>` while running `npm run dev`. The e2e harness reads this list
 * through `window.__CGE__.showcases`, so this file is the single source of truth.
 *
 * `hold` lists keyboard keys (Playwright key names) the harness holds during `settleMs`.
 * `save` selects the localStorage fixture applied before the game boots.
 * `freezeDuringPerf` keeps the captured frame paused while the harness samples frame times, for
 * states whose post-screenshot motion would leave the scene (e.g. the landing window completing).
 */
export type ShowcaseSaveFixture =
  | "fresh"
  | "completed"
  | "corrupt"
  | "future"
  | "keep"
  | "campaign-after-tea"
  | "campaign-midway"
  | "campaign-all-unlocked"
  | "campaign-all-complete";

export type ShowcaseStateDefinition = {
  readonly id: string;
  readonly sceneKey: SceneKey;
  readonly description: string;
  readonly settleMs: number;
  readonly save: ShowcaseSaveFixture;
  readonly hold?: readonly string[];
  readonly freezeDuringPerf?: boolean;
  readonly data?: () => object;
};

const title = (data: TitleSceneData): (() => TitleSceneData) => () => data;
const flight = (data: FlightSceneData): (() => FlightSceneData) => () => data;
const landing = (data: Omit<LandingSceneInit, "missionId" | "routeCrashes" | "routeDurationMs">): (() => LandingSceneInit) => () => ({
  missionId: TEA_MOON_MISSION_ID,
  routeCrashes: 0,
  routeDurationMs: 0,
  ...data,
});
const missionLanding =
  (missionId: MissionId, data: Omit<LandingSceneInit, "missionId" | "routeCrashes" | "routeDurationMs">): (() => LandingSceneInit) =>
  () => ({ missionId, routeCrashes: 0, routeDurationMs: 0, ...data });
const missionResult =
  (missionId: MissionId, data: Omit<DeliveryResultSceneData, "missionId">): (() => DeliveryResultSceneData) =>
  () => ({ missionId, ...data });
const rest = (x: number, y: number, rotation = Math.PI / 2) => ({ x, y, rotation, velocityX: 0, velocityY: 0 });
const descent = (missionId: MissionId) => {
  const tuning = landingForMission(missionId).tuning;
  return { x: tuning.startX, y: tuning.startY, rotation: 0, velocityX: 0, velocityY: tuning.startVelocityY, angularVelocity: 0 };
};
const softResult = { packageCondition: 100, routeCrashes: 0, routeDurationMs: 140000, landingResult: "soft", landingIncidents: 0 } as const;
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
    id: "title-settings",
    sceneKey: "TitleScene",
    description: "Title with the settings panel open",
    settleMs: 1800,
    save: "fresh",
    data: title({ openPanel: "settings" }),
  },
  {
    id: "title-route-log",
    sceneKey: "TitleScene",
    description: "Title (delivered) with the route log / postcard open",
    settleMs: 1800,
    save: "completed",
    data: title({ openPanel: "route-log" }),
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
      // A slight upward heading keeps the held thrust clear of the mochi rock (2090,1030) and the
      // tea stone (1640,720), so the probe does not end in a gyoza incident after the screenshot.
      start: { x: 1300, y: 900, rotation: Math.PI / 2 - 0.02, velocityX: 180, velocityY: 0 },
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
    // Released keys let the window complete inside the perf window and the probe ended in
    // LandingScene; freeze the captured frame instead (flight perf is covered by other states).
    freezeDuringPerf: true,
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
    id: "flight-bump",
    sceneKey: "FlightScene",
    description: "Dramatic bump against the sleepy rock: amber hull flash, squash and dust",
    // Contact lands ~930 ms after the scene is ready (measured); 1000 ms catches the flash + squash.
    settleMs: 1000,
    save: "fresh",
    data: flight({
      missionId: TEA_MOON_MISSION_ID,
      start: { x: 470, y: 760, rotation: Math.PI / 2, velocityX: 200, velocityY: 0 },
    }),
  },
  {
    id: "landing-descent",
    sceneKey: "LandingScene",
    description: "Landing start, high above the pad (descent HUD; the arrival intro is skipped)",
    settleMs: 900,
    save: "fresh",
    // A `start` override skips the arrival intro; this equals the default hand-off kinematics.
    data: landing({
      packageCondition: 100,
      start: { x: 640, y: 150, rotation: 0, velocityX: 0, velocityY: 22, angularVelocity: 0 },
    }),
  },
  {
    id: "landing-intro",
    sceneKey: "LandingScene",
    description: "Arrival cinematic mid-pan: camera easing down, ship gliding in, title card with the waving rabbit",
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
  {
    id: "result-session-only",
    sceneKey: "DeliveryResultScene",
    description: "Result card when a newer save locks storage (kind persistence footnote)",
    settleMs: 1600,
    save: "future",
    data: result({
      packageCondition: 58,
      routeCrashes: 2,
      routeDurationMs: 131000,
      landingResult: "bumpy",
      landingIncidents: 1,
    }),
  },

  // ---- Phase 3 campaign (docs/implementation/phase-3-campaign-plan.md §2) -------------------------
  { id: "board-fresh", sceneKey: "MissionSelectScene", description: "Delivery board, fresh save (only Tea Moon open)", settleMs: 1200, save: "fresh" },
  {
    id: "board-progress",
    sceneKey: "MissionSelectScene",
    description: "Delivery board midway (3 delivered, Bakery next)",
    settleMs: 1200,
    save: "campaign-midway",
  },
  {
    id: "board-complete",
    sceneKey: "MissionSelectScene",
    description: "Delivery board with every delivery stamped",
    settleMs: 1200,
    save: "campaign-all-complete",
  },
  { id: "title-campaign", sceneKey: "TitleScene", description: "Title midway through the campaign", settleMs: 1400, save: "campaign-midway" },

  {
    id: "bento-flight-start",
    sceneKey: "FlightScene",
    description: "Bento Belt start: moving rocks with tracks ahead",
    settleMs: 1500,
    save: "campaign-all-unlocked",
    data: flight({ missionId: "bento-belt" }),
  },
  {
    id: "bento-moving",
    sceneKey: "FlightScene",
    description: "Bento Belt: approaching the first moving crossing, its track visible",
    settleMs: 1200,
    save: "campaign-all-unlocked",
    data: flight({ missionId: "bento-belt", start: rest(1040, 1250) }),
  },
  {
    id: "bento-postcard",
    sceneKey: "FlightScene",
    description: "Bento Belt: optional postcard floating above the rest pocket",
    settleMs: 1000,
    save: "campaign-all-unlocked",
    data: flight({ missionId: "bento-belt", start: rest(1600, 560) }),
  },
  {
    id: "bento-landing",
    sceneKey: "LandingScene",
    description: "Bento landing: the lunch pad sliding on its rail",
    settleMs: 1800,
    save: "campaign-all-unlocked",
    data: missionLanding("bento-belt", { packageCondition: 92, start: descent("bento-belt") }),
  },
  {
    id: "bento-landing-intro",
    sceneKey: "LandingScene",
    description: "Bento landing arrival intro",
    settleMs: 900,
    save: "campaign-all-unlocked",
    data: missionLanding("bento-belt", { packageCondition: 92 }),
  },
  {
    id: "bento-result",
    sceneKey: "DeliveryResultScene",
    description: "Bento result card",
    settleMs: 1600,
    save: "campaign-all-unlocked",
    data: missionResult("bento-belt", softResult),
  },

  {
    id: "matcha-flight-start",
    sceneKey: "FlightScene",
    description: "Matcha Nebula start: fog bank ahead",
    settleMs: 1500,
    save: "campaign-all-unlocked",
    data: flight({ missionId: "matcha-nebula" }),
  },
  {
    id: "matcha-current",
    sceneKey: "FlightScene",
    description: "Matcha Nebula: inside the fog with the downward current and its wisps",
    settleMs: 1200,
    save: "campaign-all-unlocked",
    data: flight({ missionId: "matcha-nebula", start: rest(1350, 900) }),
  },
  {
    id: "matcha-landing",
    sceneKey: "LandingScene",
    description: "Matcha landing: crosswind and windsock",
    settleMs: 1500,
    save: "campaign-all-unlocked",
    data: missionLanding("matcha-nebula", { packageCondition: 90, start: descent("matcha-nebula") }),
  },
  {
    id: "matcha-result",
    sceneKey: "DeliveryResultScene",
    description: "Matcha result card",
    settleMs: 1600,
    save: "campaign-all-unlocked",
    data: missionResult("matcha-nebula", softResult),
  },

  {
    id: "bakery-gravity",
    sceneKey: "FlightScene",
    description: "Black Hole Bakery: skirting the gravity well, rings visible",
    settleMs: 1200,
    save: "campaign-all-unlocked",
    data: flight({ missionId: "black-hole-bakery", start: rest(1350, 700) }),
  },
  {
    id: "bakery-center-safe",
    sceneKey: "FlightScene",
    description: "Black Hole Bakery: near the well centre (finite pull, no capture)",
    settleMs: 1000,
    save: "campaign-all-unlocked",
    data: flight({ missionId: "black-hole-bakery", start: rest(2100, 900) }),
  },
  {
    id: "bakery-landing",
    sceneKey: "LandingScene",
    description: "Bakery landing: light gravity, floating flour",
    settleMs: 1500,
    save: "campaign-all-unlocked",
    data: missionLanding("black-hole-bakery", { packageCondition: 90, start: descent("black-hole-bakery") }),
  },
  {
    id: "bakery-result",
    sceneKey: "DeliveryResultScene",
    description: "Bakery result card",
    settleMs: 1600,
    save: "campaign-all-unlocked",
    data: missionResult("black-hole-bakery", softResult),
  },

  {
    id: "im-fine-warning",
    sceneKey: "FlightScene",
    description: "Planet I'm Fine: gust warning telegraph (windsock lifting)",
    settleMs: 900,
    save: "campaign-all-unlocked",
    data: flight({ missionId: "im-fine", start: rest(1300, 1100) }),
  },
  {
    id: "im-fine-gust",
    sceneKey: "FlightScene",
    description: "Planet I'm Fine: gust active inside the storm band",
    settleMs: 3600,
    save: "campaign-all-unlocked",
    data: flight({ missionId: "im-fine", start: rest(1300, 1100) }),
  },
  {
    id: "im-fine-landing",
    sceneKey: "LandingScene",
    description: "I'm Fine landing: gusts up high, porch shelter below",
    settleMs: 3400,
    save: "campaign-all-unlocked",
    data: missionLanding("im-fine", { packageCondition: 90, start: descent("im-fine") }),
  },
  {
    id: "im-fine-result",
    sceneKey: "DeliveryResultScene",
    description: "I'm Fine result card with closing line",
    settleMs: 1600,
    save: "campaign-all-unlocked",
    data: missionResult("im-fine", softResult),
  },

  {
    id: "bakery-flight-start",
    sceneKey: "FlightScene",
    description: "Black Hole Bakery start: the well ahead",
    settleMs: 1500,
    save: "campaign-all-unlocked",
    data: flight({ missionId: "black-hole-bakery" }),
  },
  {
    id: "im-fine-flight-start",
    sceneKey: "FlightScene",
    description: "Planet I'm Fine start: storm band ahead",
    settleMs: 1500,
    save: "campaign-all-unlocked",
    data: flight({ missionId: "im-fine" }),
  },
  {
    id: "home-flight-start",
    sceneKey: "FlightScene",
    description: "Home route start",
    settleMs: 1500,
    save: "campaign-all-unlocked",
    data: flight({ missionId: "home-delivery" }),
  },
  {
    id: "home-notes",
    sceneKey: "FlightScene",
    description: "Home route: first thank-you beacon note",
    settleMs: 1400,
    save: "campaign-all-unlocked",
    data: flight({ missionId: "home-delivery", start: { x: 600, y: 900, rotation: Math.PI / 2, velocityX: 90, velocityY: 0 } }),
  },
  {
    id: "home-landing",
    sceneKey: "LandingScene",
    description: "Home landing: raised wide berth",
    settleMs: 1500,
    save: "campaign-all-unlocked",
    data: missionLanding("home-delivery", { packageCondition: 100, start: descent("home-delivery") }),
  },
  {
    id: "home-ending",
    sceneKey: "DeliveryResultScene",
    description: "Final delivery result / ending card",
    settleMs: 1800,
    save: "campaign-all-unlocked",
    data: missionResult("home-delivery", softResult),
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
