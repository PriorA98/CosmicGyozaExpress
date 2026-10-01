import Phaser from "phaser";
import { ASSET, UI_ICON_FRAME, type UiIconName } from "../data/assetManifest";
import { ICON_GLYPHS, ICON_GLYPH_PALETTE, ICON_GLYPH_SIZE, ICON_OVERRIDES, ICON_OVERRIDE_PALETTE, ICON_OVERRIDE_SIZE } from "./iconBitmaps";

/** Art pixels per icon frame edge in the `ui-icons` strip. */
export const ICON_FRAME_SIZE = 16;
/** Runtime-generated stand-in strip used while `ui-icons` is a flat preload fallback. */
export const DRAWN_ICON_TEXTURE = "ui-icons-drawn";
/** Authored strip with the `ICON_OVERRIDES` frames redrawn on top. */
export const PATCHED_ICON_TEXTURE = "ui-icons-patched";

/**
 * True when `key` holds authored art. PreloadScene replaces missing files with generated
 * CanvasTextures, so a canvas-backed texture means "fallback in use": UI then draws its own
 * vector stand-in instead of stretching a flat colour block.
 */
export function hasAuthoredTexture(scene: Phaser.Scene, key: string): boolean {
  if (!scene.textures.exists(key)) return false;
  return !(scene.textures.get(key) instanceof Phaser.Textures.CanvasTexture);
}

/** Generates (once per game) the drawn icon strip with the same frame order as `ui-icons`. */
export function ensureDrawnIconTexture(scene: Phaser.Scene): string {
  if (scene.textures.exists(DRAWN_ICON_TEXTURE)) return DRAWN_ICON_TEXTURE;

  const names = Object.keys(UI_ICON_FRAME) as UiIconName[];
  const texture = scene.textures.createCanvas(DRAWN_ICON_TEXTURE, ICON_FRAME_SIZE * names.length, ICON_FRAME_SIZE);
  if (!texture) return DRAWN_ICON_TEXTURE;

  const context = texture.getContext();
  const cell = ICON_FRAME_SIZE / ICON_GLYPH_SIZE;
  context.clearRect(0, 0, texture.width, texture.height);

  for (const name of names) {
    const frame = UI_ICON_FRAME[name];
    const originX = frame * ICON_FRAME_SIZE;
    ICON_GLYPHS[name].forEach((row, y) => {
      for (let x = 0; x < row.length; x += 1) {
        const color = ICON_GLYPH_PALETTE[row.charAt(x)];
        if (!color) continue;
        context.fillStyle = color;
        context.fillRect(originX + x * cell, y * cell, cell, cell);
      }
    });
    texture.add(frame, 0, originX, 0, ICON_FRAME_SIZE, ICON_FRAME_SIZE);
  }

  texture.refresh();
  return DRAWN_ICON_TEXTURE;
}

function paintOverride(context: CanvasRenderingContext2D, originX: number, rows: readonly string[]): void {
  context.clearRect(originX, 0, ICON_FRAME_SIZE, ICON_FRAME_SIZE);
  const cell = ICON_FRAME_SIZE / ICON_OVERRIDE_SIZE;
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x += 1) {
      const color = ICON_OVERRIDE_PALETTE[row.charAt(x)];
      if (!color) continue;
      context.fillStyle = color;
      context.fillRect(originX + x * cell, y * cell, cell, cell);
    }
  });
}

/**
 * Copies the authored strip into a canvas texture once per game and redraws the frames listed
 * in `ICON_OVERRIDES`. Falls back to the authored key if the copy cannot be made.
 */
export function ensurePatchedIconTexture(scene: Phaser.Scene): string {
  if (scene.textures.exists(PATCHED_ICON_TEXTURE)) return PATCHED_ICON_TEXTURE;
  try {
    const source = scene.textures.get(ASSET.uiIcons).getSourceImage();
    if (!(source instanceof HTMLImageElement) && !(source instanceof HTMLCanvasElement)) return ASSET.uiIcons;
    const texture = scene.textures.createCanvas(PATCHED_ICON_TEXTURE, source.width, source.height);
    if (!texture) return ASSET.uiIcons;
    const context = texture.getContext();
    context.imageSmoothingEnabled = false;
    context.drawImage(source, 0, 0);
    const names = Object.keys(UI_ICON_FRAME) as UiIconName[];
    for (const name of names) {
      const frame = UI_ICON_FRAME[name];
      const rows = ICON_OVERRIDES[name];
      if (rows) paintOverride(context, frame * ICON_FRAME_SIZE, rows);
      texture.add(frame, 0, frame * ICON_FRAME_SIZE, 0, ICON_FRAME_SIZE, ICON_FRAME_SIZE);
    }
    texture.refresh();
    return PATCHED_ICON_TEXTURE;
  } catch {
    return ASSET.uiIcons;
  }
}

/** Texture key to use for ui icons: (patched) authored strip when present, drawn stand-in otherwise. */
export function iconTextureKey(scene: Phaser.Scene): string {
  return hasAuthoredTexture(scene, ASSET.uiIcons) ? ensurePatchedIconTexture(scene) : ensureDrawnIconTexture(scene);
}
