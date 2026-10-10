import { landingScenery } from "../../data/landingScenery";
import type { LandingControls } from "../../types/landing";

/** Pure touch-tile layout for the landing controls (no Phaser imports, unit-tested). */
type ControlKey = keyof LandingControls;

export type LandingTouchTile = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };

/** Layout tuning for the touch tiles (screen px of the logical canvas). */
export type LandingTouchLayout = {
  readonly tileWidth: number;
  readonly tileHeight: number;
  readonly marginX: number;
  readonly marginBottom: number;
  readonly gap: number;
};

/**
 * Tile rectangles for each landing control: the slide pair bottom-left, steady stacked over thrust at the
 * right edge (so the right cluster never reaches the rabbit or the tea house). Pure, so layouts are testable.
 */
export function landingTouchTiles(
  canvasWidth: number,
  canvasHeight: number,
  layout: LandingTouchLayout = landingScenery.touch,
): Record<ControlKey, LandingTouchTile> {
  const bottom = canvasHeight - layout.marginBottom - layout.tileHeight;
  const right = canvasWidth - layout.marginX - layout.tileWidth;
  return {
    left: { x: layout.marginX, y: bottom, width: layout.tileWidth, height: layout.tileHeight },
    right: { x: layout.marginX + layout.tileWidth + layout.gap, y: bottom, width: layout.tileWidth, height: layout.tileHeight },
    thrust: { x: right, y: bottom, width: layout.tileWidth, height: layout.tileHeight },
    stabilizer: { x: right, y: bottom - layout.gap - layout.tileHeight, width: layout.tileWidth, height: layout.tileHeight },
  };
}
