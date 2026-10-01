import type Phaser from "phaser";
import type { CollisionSeverity } from "../types/flight";
import type { LandingIncidentKind, LandingResultKind } from "../types/landing";

export type FlightHudState = {
  speed: number;
  headingDegrees: number;
  velocityX: number;
  velocityY: number;
};

export type SceneKey =
  | "BootScene"
  | "PreloadScene"
  | "TitleScene"
  | "FlightScene"
  | "LandingScene"
  | "DeliveryResultScene"
  | "UiKitScene"
  | "FxGalleryScene";

/**
 * Cross-module game events. Scenes emit; audio, fx, and dev tooling listen.
 * Emitters never depend on listeners existing, so every event is fire-and-forget.
 * Coordinates are world pixels (+Y down). Times are milliseconds.
 */
export type GameEvent =
  | { readonly type: "scene:enter"; readonly scene: SceneKey }
  | { readonly type: "ui:confirm" }
  | { readonly type: "ui:hover" }
  | { readonly type: "ui:back" }
  | { readonly type: "flight:thrust"; readonly active: boolean }
  | { readonly type: "flight:brake"; readonly active: boolean }
  | { readonly type: "flight:bump"; readonly severity: Exclude<CollisionSeverity, "none">; readonly x: number; readonly y: number }
  | { readonly type: "flight:respawn" }
  | { readonly type: "flight:arrival-progress"; readonly progress: number }
  | { readonly type: "flight:arrival-complete" }
  | { readonly type: "landing:thrust"; readonly active: boolean }
  | { readonly type: "landing:stabilizer"; readonly active: boolean }
  | { readonly type: "landing:touchdown"; readonly result: LandingResultKind; readonly x: number; readonly y: number }
  | { readonly type: "landing:incident"; readonly incident: LandingIncidentKind; readonly x: number; readonly y: number }
  | { readonly type: "landing:retry" }
  | { readonly type: "result:shown"; readonly landingResult: LandingResultKind }
  | { readonly type: "settings:changed" }
  | { readonly type: "mission:start"; readonly missionId: string }
  | { readonly type: "mission:completed"; readonly missionId: string };

export type GameEventType = GameEvent["type"];
export type GameEventOf<T extends GameEventType> = Extract<GameEvent, { type: T }>;

/** Single Phaser event name used on `game.events` for every GameEvent. */
export const GAME_EVENT = "cge:event";

export function emitGameEvent(scene: Phaser.Scene, event: GameEvent): void {
  scene.game.events.emit(GAME_EVENT, event);
}

export function onGameEvent(game: Phaser.Game, listener: (event: GameEvent) => void): () => void {
  game.events.on(GAME_EVENT, listener);
  return () => {
    game.events.off(GAME_EVENT, listener);
  };
}
