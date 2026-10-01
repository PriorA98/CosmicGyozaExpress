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
  // Pixel-stepped tray: border colour first, fill inset by the border width.
  graphics.fillStyle(colorNumber(spec.border), 1);
  fillSteppedRect(graphics, x, y, width, height, STEPPED_CORNER.soft);
  graphics.fillStyle(colorNumber(spec.fill), 1);
  fillSteppedRect(graphics, x + spec.borderWidth, y + spec.borderWidth, width - spec.borderWidth * 2, height - spec.borderWidth * 2, STEPPED_CORNER.notch);
  // Inner top shade so the tray reads as recessed.
  graphics.fillStyle(colorNumber(colors.borderStrong), 0.35);
  graphics.fillRect(x + spec.borderWidth + 2, y + spec.borderWidth, width - spec.borderWidth * 2 - 4, 2);
}

/** Corner profiles for `fillSteppedRect` (insets of successive 2px bands). */
export const STEPPED_CORNER = {
  notch: [2],
  soft: [4, 2],
  round: [6, 4, 2],
  pill: [8, 4, 2, 2],
} as const;

/**
 * Pixel-stepped rounded rectangle built only from axis-aligned rects (no anti-aliased curves).
 * `steps[i]` is the horizontal inset of the i-th `band`-px row band from the top (mirrored at
 * the bottom): [2] is a single notch, [4, 2] a two-step corner.
 */
export function fillSteppedRect(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  steps: readonly number[] = STEPPED_CORNER.notch,
  band = 2,
): void {
  if (width <= 0 || height <= 0) return;
  const bands = Math.min(steps.length, Math.floor(height / (band * 2)));
  for (let index = 0; index < bands; index += 1) {
    const inset = Math.min(steps[index] ?? 0, Math.floor(width / 2));
    graphics.fillRect(x + inset, y + index * band, width - inset * 2, band);
    graphics.fillRect(x + inset, y + height - (index + 1) * band, width - inset * 2, band);
  }
  graphics.fillRect(x, y + bands * band, width, height - bands * band * 2);
}
