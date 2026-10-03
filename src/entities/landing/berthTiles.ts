import { CAMPAIGN_BERTH_FRAME } from "../../data/assetManifest";

/** Tile column of a berth: which strip frame, and how many art px of it are shown (the last centre tile crops). */
export type BerthTile = { readonly frame: number; readonly x: number; readonly artWidth: number };

/**
 * Lays berth tiles across exactly `width` screen px: left cap, repeated centre tiles (the last one cropped),
 * right cap. Pure, so the "never stretched, exact collision width" rule is unit-tested.
 */
export function layoutBerthTiles(width: number, tileArtWidth: number, artScale: number): readonly BerthTile[] {
  const tilePx = tileArtWidth * artScale;
  const tiles: BerthTile[] = [];
  if (width <= 0) return tiles;
  if (width <= tilePx * 2) {
    const half = Math.floor(width / 2 / artScale);
    tiles.push({ frame: CAMPAIGN_BERTH_FRAME.leftCap, x: 0, artWidth: half });
    const right = Math.round(width / artScale) - half;
    tiles.push({ frame: CAMPAIGN_BERTH_FRAME.rightCap, x: half * artScale, artWidth: right });
    return tiles;
  }
  tiles.push({ frame: CAMPAIGN_BERTH_FRAME.leftCap, x: 0, artWidth: tileArtWidth });
  let x = tilePx;
  const centerEnd = width - tilePx;
  while (x < centerEnd) {
    const artWidth = Math.min(tileArtWidth, Math.round((centerEnd - x) / artScale));
    if (artWidth <= 0) break;
    tiles.push({ frame: CAMPAIGN_BERTH_FRAME.center, x, artWidth });
    x += artWidth * artScale;
  }
  tiles.push({ frame: CAMPAIGN_BERTH_FRAME.rightCap, x: centerEnd, artWidth: tileArtWidth });
  return tiles;
}

