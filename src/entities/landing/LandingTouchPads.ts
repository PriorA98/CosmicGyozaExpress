import Phaser from "phaser";
import { landingCopy } from "../../data/landingCopy";
import { LANDING_ART_SCALE, landingScenery } from "../../data/landingScenery";
import { colorNumber, colors, depth, typeScale } from "../../game/designTokens";
import { TouchControls, monoStyle, type TouchZoneDefinition } from "../../ui";
import type { LandingControls } from "../../types/landing";
import { bitmapSize, drawBitmap, snapToGrid } from "./pixelShapes";

type ControlKey = keyof LandingControls;

const EMPTY_CONTROLS: LandingControls = { thrust: false, rotateLeft: false, rotateRight: false, stabilizer: false };
const CONTROL_KEYS: readonly ControlKey[] = ["rotateLeft", "rotateRight", "stabilizer", "thrust"];

/** Tile rectangles (screen px of the logical canvas) for each landing control. Pure, so layouts can be tested. */
export function landingTouchTiles(canvasWidth: number, canvasHeight: number): Record<ControlKey, { x: number; y: number; width: number; height: number }> {
  const t = landingScenery.touch;
  const bottom = canvasHeight - t.marginBottom - t.tileHeight;
  const right = canvasWidth - t.marginX - t.tileWidth;
  return {
    rotateLeft: { x: t.marginX, y: bottom, width: t.tileWidth, height: t.tileHeight },
    rotateRight: { x: t.marginX + t.tileWidth + t.gap, y: bottom, width: t.tileWidth, height: t.tileHeight },
    thrust: { x: right, y: bottom, width: t.tileWidth, height: t.tileHeight },
    stabilizer: { x: right, y: bottom - t.gap - t.tileHeight, width: t.tileWidth, height: t.tileHeight },
  };
}

/**
 * Landing controls on the shared UI kit's TouchControls: a tilt pair bottom-left (pixel chevrons) and
 * steady stacked over thrust on the right edge (kit icons), clear of the HUD, the pad, the rabbit, and the
 * tea house (which moves inward on touch layouts). Zone ids are the LandingControls keys.
 */
export class LandingTouchPads {
  readonly root: TouchControls;
  private readonly decorations: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene) {
    const tiles = landingTouchTiles(scene.scale.width, scene.scale.height);
    const labels = landingCopy.touchLabels;
    const zones: TouchZoneDefinition[] = [
      { id: "rotateLeft", shape: { kind: "rect", ...tiles.rotateLeft } },
      { id: "rotateRight", shape: { kind: "rect", ...tiles.rotateRight } },
      { id: "stabilizer", shape: { kind: "rect", ...tiles.stabilizer }, icon: "radar", label: labels.stabilizer },
      { id: "thrust", shape: { kind: "rect", ...tiles.thrust }, icon: "thrust", label: labels.thrust },
    ];
    this.root = new TouchControls(scene, { zones });

    // The kit has no arrow icon yet: pixel chevrons + labels for the tilt pair, on the same layer.
    this.decorations = scene.add.container(0, 0).setDepth(depth.touch + 1);
    this.addTiltDecoration(scene, tiles.rotateLeft, true, labels.rotateLeft);
    this.addTiltDecoration(scene, tiles.rotateRight, false, labels.rotateRight);
    this.decorations.setVisible(this.root.visible);
  }

  /** Every object that belongs on the UI camera. */
  get objects(): readonly Phaser.GameObjects.GameObject[] {
    return [this.root, this.decorations];
  }

  /** Reads the held zones as landing controls. */
  read(): LandingControls {
    // The kit reveals itself on the first touch; keep the chevrons in step.
    if (this.decorations.visible !== this.root.visible) this.decorations.setVisible(this.root.visible);
    if (!this.root.visible) return EMPTY_CONTROLS;
    const next: LandingControls = { ...EMPTY_CONTROLS };
    for (const key of CONTROL_KEYS) next[key] = this.root.isDown(key);
    return next;
  }

  setAlpha(alpha: number): void {
    this.root.setAlpha(alpha);
    this.decorations.setAlpha(alpha);
  }

  destroy(): void {
    this.root.destroy();
    this.decorations.destroy();
  }

  private addTiltDecoration(
    scene: Phaser.Scene,
    tile: { x: number; y: number; width: number; height: number },
    pointsLeft: boolean,
    label: string,
  ): void {
    const t = landingScenery.touch;
    const cell = LANDING_ART_SCALE;
    const size = bitmapSize(t.chevron, cell);
    const cx = tile.x + tile.width / 2;
    const cy = tile.y + tile.height / 2;
    const chevron = scene.add.graphics();
    const left = snapToGrid(cx - size.width / 2, cell);
    const top = snapToGrid(cy + t.chevronOffsetY - size.height / 2, cell);
    chevron.fillStyle(colorNumber(colors.cosmosDeep), 0.6);
    drawBitmap(chevron, left + cell, top + cell, t.chevron, cell, pointsLeft);
    chevron.fillStyle(colorNumber(colors.parchmentWarm), 1);
    drawBitmap(chevron, left, top, t.chevron, cell, pointsLeft);
    const text = scene.add
      .text(cx, cy + t.labelOffsetY, label, monoStyle({ size: typeScale.sm, bold: true, color: colors.plaster }))
      .setOrigin(0.5, 0.5)
      .setAlpha(0.85);
    this.decorations.add([chevron, text]);
  }
}
