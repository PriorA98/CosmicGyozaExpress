import type Phaser from "phaser";
import { ASSET, SHIP_ART } from "../../data/assetManifest";

const cache = new Map<string, number>();
const OPAQUE_ALPHA = 24;

/** Where the landing ship sits relative to its sprite origin, all in screen px at the chosen integer scale. */
export type ShipDisplayLayout = {
  /** Integer display scale (SHIP_ART.artScale when the art matches the contract). */
  readonly scale: number;
  readonly originX: number;
  readonly originY: number;
  /** Origin to the lowest opaque row of the idle frame (the feet), along the ship's down axis. */
  readonly footPx: number;
  /** Origin to the tip of the biggest baked flame (ship-fly-3). */
  readonly flameTipPx: number;
};

/**
 * Integer display scale for ship art of `textureWidth` art px: the contract scale when the art matches
 * SHIP_ART, otherwise the nearest integer that keeps it close to the contract's on-screen size (never < 1).
 */
export function shipDisplayScale(textureWidth: number, textureHeight: number): number {
  if (textureWidth === SHIP_ART.width && textureHeight === SHIP_ART.height) return SHIP_ART.artScale;
  if (textureWidth <= 0) return SHIP_ART.artScale;
  return Math.max(1, Math.round((SHIP_ART.width * SHIP_ART.artScale) / textureWidth));
}

/**
 * Reads the ship textures once and works out scale, pivot, feet line, and flame tip, so the landing
 * contact line and the thrust puffs follow the real art whatever canvas it ships with.
 * `fallbackFootRatio` (fraction of texture height below the origin) is used if pixels are unreadable.
 */
export function resolveShipLayout(scene: Phaser.Scene, fallbackFootRatio: number): ShipDisplayLayout {
  const frame = scene.textures.getFrame(ASSET.shipIdle);
  const width = frame?.width ?? SHIP_ART.width;
  const height = frame?.height ?? SHIP_ART.height;
  const matchesContract = width === SHIP_ART.width && height === SHIP_ART.height;
  const scale = shipDisplayScale(width, height);
  const originX = matchesContract ? SHIP_ART.saucerCenterX / SHIP_ART.width : 0.5;
  const originY = matchesContract ? SHIP_ART.saucerCenterY / SHIP_ART.height : 0.5;
  const originRow = originY * height;

  const feetRow = lowestOpaqueRowOf(scene, ASSET.shipIdle);
  const flameRow = lowestOpaqueRowOf(scene, ASSET.shipFly3);
  const footArt = feetRow >= 0 ? feetRow + 1 - originRow : height * fallbackFootRatio;
  const flameArt = flameRow >= 0 ? flameRow + 1 - originRow : footArt;

  return {
    scale,
    originX,
    originY,
    footPx: footArt * scale,
    flameTipPx: Math.max(footArt, flameArt) * scale,
  };
}

/** Lowest row (texture px) with an opaque pixel, or -1 when unreadable/empty. Cached per texture key. */
export function lowestOpaqueRowOf(scene: Phaser.Scene, textureKey: string): number {
  const cached = cache.get(textureKey);
  if (cached !== undefined) return cached;

  let result = -1;
  try {
    const frame = scene.textures.getFrame(textureKey);
    const source = scene.textures.get(textureKey).getSourceImage();
    if (frame && typeof document !== "undefined" && "width" in source && source.width > 0) {
      const canvas = document.createElement("canvas");
      canvas.width = frame.width;
      canvas.height = frame.height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (context) {
        context.drawImage(source as CanvasImageSource, frame.cutX, frame.cutY, frame.width, frame.height, 0, 0, frame.width, frame.height);
        result = lowestOpaqueRow(context.getImageData(0, 0, frame.width, frame.height).data, frame.width, frame.height);
      }
    }
  } catch {
    result = -1;
  }

  cache.set(textureKey, result);
  return result;
}

/** Lowest row index whose alpha passes the opacity threshold, or -1. Pure. */
export function lowestOpaqueRow(pixels: Uint8ClampedArray, width: number, height: number): number {
  for (let y = height - 1; y >= 0; y -= 1) {
    const rowStart = y * width * 4;
    for (let x = 0; x < width; x += 1) {
      if ((pixels[rowStart + x * 4 + 3] ?? 0) > OPAQUE_ALPHA) return y;
    }
  }
  return -1;
}
