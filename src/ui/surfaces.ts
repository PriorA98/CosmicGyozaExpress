import type Phaser from "phaser";
import { NINE_SLICE } from "../data/assetManifest";
import { colorNumber, colors } from "../game/designTokens";
import { toArtPixels } from "./layout";
import { hasAuthoredTexture } from "./uiTextures";

/** Integer display scale for UI nine-slice art (1 art px = 2 screen px). */
export const UI_ART_SCALE = 2;

/** Design-system surface specs (design-system.md section 5, "Panel styles"). */
export const SURFACE = {
  darkHud: { fill: colors.cosmosPanel, fillAlpha: 0.82, border: colors.plaster, borderAlpha: 0.18, radius: 8, borderWidth: 2 },
  parchment: { fill: colors.parchmentWarm, border: colors.border, radius: 8, borderWidth: 2, shadow: colors.ink, shadowAlpha: 0.32, shadowOffset: 4 },
  recessed: { fill: colors.parchmentDeep, border: colors.border, radius: 5, borderWidth: 2 },
} as const;

/** Adds a nine-slice of authored UI art scaled to `artScale`, or returns undefined if the art is missing. */
export function addNineSlicePanel(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  inset: number = NINE_SLICE.panel,
  frame?: number,
): Phaser.GameObjects.NineSlice | undefined {
  if (!hasAuthoredTexture(scene, key)) return undefined;
  return scene.add
    .nineslice(0, 0, key, frame, toArtPixels(width, UI_ART_SCALE), toArtPixels(height, UI_ART_SCALE), inset, inset, inset, inset)
    .setOrigin(0, 0)
    .setScale(UI_ART_SCALE);
}

export function drawDarkHudSurface(graphics: Phaser.GameObjects.Graphics, width: number, height: number): void {
  const spec = SURFACE.darkHud;
  graphics.clear();
  graphics.fillStyle(colorNumber(spec.fill), spec.fillAlpha);
  graphics.fillRoundedRect(0, 0, width, height, spec.radius);
  graphics.lineStyle(spec.borderWidth, colorNumber(spec.border), spec.borderAlpha);
  graphics.strokeRoundedRect(1, 1, width - 2, height - 2, spec.radius - 1);
}

export function drawParchmentSurface(graphics: Phaser.GameObjects.Graphics, width: number, height: number): void {
  const spec = SURFACE.parchment;
  graphics.clear();
  graphics.fillStyle(colorNumber(spec.shadow), spec.shadowAlpha);
  graphics.fillRoundedRect(0, spec.shadowOffset, width, height, spec.radius);
  graphics.fillStyle(colorNumber(spec.fill), 1);
  graphics.fillRoundedRect(0, 0, width, height, spec.radius);
  graphics.lineStyle(spec.borderWidth, colorNumber(spec.border), 1);
  graphics.strokeRoundedRect(1, 1, width - 2, height - 2, spec.radius - 1);
}

export function drawRecessedSurface(graphics: Phaser.GameObjects.Graphics, x: number, y: number, width: number, height: number): void {
  const spec = SURFACE.recessed;
  graphics.fillStyle(colorNumber(spec.fill), 1);
  graphics.fillRoundedRect(x, y, width, height, spec.radius);
  graphics.lineStyle(spec.borderWidth, colorNumber(spec.border), 1);
  graphics.strokeRoundedRect(x + 1, y + 1, width - 2, height - 2, spec.radius - 1);
}
