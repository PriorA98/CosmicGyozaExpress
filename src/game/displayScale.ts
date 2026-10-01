import Phaser from "phaser";

/**
 * Display-scale helpers (integrator-owned contract).
 *
 * The game renders a fixed 1280x720 logical canvas that Scale.FIT shrinks on small screens
 * (~0.54x on an 844x390 phone). Nearest-neighbour *downscaling* drops whole pixel columns,
 * which shreds text strokes, so while the canvas is shown smaller than native we let the
 * browser smooth the downscale; at native size or larger we keep crisp pixel scaling.
 *
 * HUDs call `compactUiScale(scene)` and multiply their size by it so essential text stays
 * readable on phones (>= ~11 physical px). Listen to `game.scale` RESIZE to re-layout.
 */
const LOGICAL_WIDTH = 1280;
const CRISP_THRESHOLD = 0.98;
const COMFORT_DISPLAY_SCALE = 0.8;
const MAX_COMPACT_UI_SCALE = 1.6;

export function displayScale(game: Phaser.Game): number {
  const shown = game.scale.displaySize.width;
  return shown > 0 ? shown / LOGICAL_WIDTH : 1;
}

/** 1 on desktop-sized displays; up to 1.6 when the canvas is shown small (phones). */
export function compactUiScale(scene: Phaser.Scene): number {
  const scale = displayScale(scene.game);
  if (scale >= COMFORT_DISPLAY_SCALE) return 1;
  return Math.min(MAX_COMPACT_UI_SCALE, COMFORT_DISPLAY_SCALE / scale);
}

/** True when the canvas is shown at phone-class size (layouts may drop non-essential rows). */
export function isCompactDisplay(scene: Phaser.Scene): boolean {
  return displayScale(scene.game) < COMFORT_DISPLAY_SCALE;
}

export function installAdaptiveCanvasInterpolation(game: Phaser.Game): void {
  const apply = (): void => {
    const canvas = game.canvas;
    if (!canvas) return;
    canvas.style.imageRendering = displayScale(game) < CRISP_THRESHOLD ? "auto" : "pixelated";
  };

  game.events.once(Phaser.Core.Events.READY, apply);
  game.scale.on(Phaser.Scale.Events.RESIZE, apply);
}
