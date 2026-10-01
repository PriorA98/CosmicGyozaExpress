import type Phaser from "phaser";
import { onGameEvent } from "../game/events";
import { SaveSystem } from "../systems/SaveSystem";
import { setReducedMotion } from "./feedback";

/**
 * Keeps `src/fx` reduced motion in sync with `save.settings.reducedMotion` (owner: audio-fx).
 *
 * A saved `true` always reduces motion. A saved `false` is the default for every new save, so it
 * defers to the OS `prefers-reduced-motion` preference (`null`) instead of overriding it.
 */
export function reducedMotionOverride(saved: unknown): boolean | null {
  return saved === true ? true : null;
}

function syncFromSave(): void {
  try {
    const saved: unknown = SaveSystem.load().settings?.reducedMotion;
    setReducedMotion(reducedMotionOverride(saved));
  } catch {
    setReducedMotion(null);
  }
}

/** Call once from main.ts after the game is created. Returns an unsubscribe function. */
export function installFxSettings(game: Phaser.Game): () => void {
  syncFromSave();
  return onGameEvent(game, (event) => {
    if (event.type === "settings:changed") syncFromSave();
  });
}
