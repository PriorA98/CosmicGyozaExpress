import type Phaser from "phaser";
import { UI_ICON_FRAME, type UiIconName } from "../data/assetManifest";
import { ICON_FRAME_SIZE, iconTextureKey } from "./uiTextures";

/** Display scale for ui icons (16 art px -> 32 screen px). */
export const ICON_SCALE = 2;
export const ICON_DISPLAY_SIZE = ICON_FRAME_SIZE * ICON_SCALE;

export type UiIconOptions = {
  /** Integer multiple of the art scale (default 2). */
  readonly scale?: number;
  readonly originX?: number;
  readonly originY?: number;
};

/** Adds a pixel icon from the `ui-icons` strip (or its drawn stand-in) at an integer scale. */
export function addUiIcon(scene: Phaser.Scene, x: number, y: number, name: UiIconName, options: UiIconOptions = {}): Phaser.GameObjects.Image {
  const scale = Math.max(1, Math.round(options.scale ?? ICON_SCALE));
  return scene.add
    .image(x, y, iconTextureKey(scene), UI_ICON_FRAME[name])
    .setScale(scale)
    .setOrigin(options.originX ?? 0.5, options.originY ?? 0.5);
}

/** Swaps an existing icon image to another frame. */
export function setUiIcon(image: Phaser.GameObjects.Image, name: UiIconName): void {
  image.setTexture(iconTextureKey(image.scene), UI_ICON_FRAME[name]);
}
