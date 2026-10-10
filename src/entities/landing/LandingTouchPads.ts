import type Phaser from "phaser";
import { landingCopy } from "../../data/landingCopy";
import { TouchControls, type TouchZoneDefinition } from "../../ui";
import type { LandingControls } from "../../types/landing";
import { landingTouchTiles } from "./landingTouchLayout";

export { landingTouchTiles, type LandingTouchLayout, type LandingTouchTile } from "./landingTouchLayout";

type ControlKey = keyof LandingControls;

const EMPTY_CONTROLS: LandingControls = { thrust: false, left: false, right: false, stabilizer: false };
const CONTROL_KEYS: readonly ControlKey[] = ["left", "right", "stabilizer", "thrust"];

/**
 * Landing controls on the shared UI kit's TouchControls: cream keycap tiles (the bright-scene tone) with
 * kit pixel glyphs for slide and steady and the kit thrust icon, each with a lowercase label inside the tile.
 * Zone ids are the LandingControls keys. The scene keeps this on the screen-fixed layer.
 */
export class LandingTouchPads {
  readonly root: TouchControls;

  constructor(scene: Phaser.Scene, uiScale: number) {
    const tiles = landingTouchTiles(scene.scale.width, scene.scale.height);
    const labels = landingCopy.touchLabels;
    const zones: TouchZoneDefinition[] = [
      { id: "left", shape: { kind: "rect", ...tiles.left }, glyph: "left", label: labels.left },
      { id: "right", shape: { kind: "rect", ...tiles.right }, glyph: "right", label: labels.right },
      { id: "stabilizer", shape: { kind: "rect", ...tiles.stabilizer }, glyph: "steady", label: labels.stabilizer },
      { id: "thrust", shape: { kind: "rect", ...tiles.thrust }, icon: "thrust", label: labels.thrust },
    ];
    this.root = new TouchControls(scene, { zones, tone: "cream", visibility: "always", uiScale });
  }

  /** Reads the held zones as landing controls. */
  read(): LandingControls {
    if (!this.root.visible) return EMPTY_CONTROLS;
    const next: LandingControls = { ...EMPTY_CONTROLS };
    for (const key of CONTROL_KEYS) next[key] = this.root.isDown(key);
    return next;
  }

  setAlpha(alpha: number): void {
    this.root.setAlpha(alpha);
  }

  destroy(): void {
    this.root.destroy();
  }
}
