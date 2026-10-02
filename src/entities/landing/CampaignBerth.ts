import Phaser from "phaser";
import { CAMPAIGN_BERTH_FRAME } from "../../data/assetManifest";
import { campaignLandingScenery, LANDING_ART_SCALE } from "../../data/landingScenery";
import type { CampaignThemeDefinition } from "../../data/campaign/themes";
import { colorNumber, colors, depth } from "../../game/designTokens";
import type { LandingPadDefinition } from "../../types/landing";
import { snapToGrid } from "./pixelShapes";

const CELL = LANDING_ART_SCALE;

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

/**
 * Campaign landing berth: tiles at the exact collision width, two edge lamps that brighten while the ship
 * is lined up (and glow warm after touchdown), plus legs and an underside beam when the berth is raised
 * above the ground band. A moving berth is one container whose x follows the sampled pad.
 */
export class CampaignBerth {
  private readonly scene: Phaser.Scene;
  private readonly root: Phaser.GameObjects.Container;
  private readonly lamps: Phaser.GameObjects.Graphics;
  private readonly width: number;
  private readonly theme: CampaignThemeDefinition;
  private aligned: boolean | undefined;
  private lit = false;

  constructor(scene: Phaser.Scene, pad: LandingPadDefinition, theme: CampaignThemeDefinition) {
    this.scene = scene;
    this.theme = theme;
    this.width = pad.width;
    const config = campaignLandingScenery.berth;
    const top = -config.surfaceRowArtPx * CELL;
    const tileHeightPx = config.tileArtHeight * CELL;
    const left = -pad.width / 2;

    const children: Phaser.GameObjects.GameObject[] = [];
    const bottom = top + tileHeightPx;
    const groundGap = campaignLandingScenery.groundTopY - (pad.surfaceY + bottom);
    if (groundGap > CELL * 4) children.push(this.createUnderside(left, bottom, groundGap));

    for (const tile of layoutBerthTiles(pad.width, config.tileArtWidth, CELL)) {
      const image = scene.add.image(left + tile.x, top, config.key, tile.frame).setOrigin(0, 0).setScale(CELL);
      if (tile.artWidth < config.tileArtWidth) image.setCrop(0, 0, tile.artWidth, config.tileArtHeight);
      children.push(image);
    }

    this.lamps = scene.add.graphics();
    children.push(this.lamps);
    this.root = scene.add.container(snapToGrid(pad.centerX, CELL), pad.surfaceY, children).setDepth(depth.world + 2);
    this.setAligned(false);
  }

  /** Moving pads: follow the sampled centre (whole art px so the tiles never shimmer). */
  setCenterX(centerX: number): void {
    this.root.setX(snapToGrid(centerX, CELL));
  }

  setAligned(aligned: boolean): void {
    if (aligned === this.aligned) return;
    this.aligned = aligned;
    this.drawLamps();
  }

  lightLanterns(): void {
    this.lit = true;
    this.drawLamps();
    this.scene.tweens.add({ targets: this.lamps, alpha: { from: 0.4, to: 1 }, duration: 260, ease: "Sine.easeOut" });
  }

  reset(): void {
    this.lit = false;
    this.aligned = undefined;
    this.lamps.setAlpha(1);
    this.setAligned(false);
  }

  private drawLamps(): void {
    const config = campaignLandingScenery.berth;
    const color = this.lit ? this.theme.palette.light : this.aligned ? colors.sage : colors.cosmosDeep;
    const size = config.lampSizePx;
    const y = -config.surfaceRowArtPx * CELL - size;
    this.lamps.clear();
    for (const side of [-1, 1] as const) {
      const x = snapToGrid(side * (this.width / 2 - config.lampInsetPx) - size / 2, CELL);
      this.lamps.fillStyle(colorNumber(colors.ink), 1);
      this.lamps.fillRect(x - CELL, y - CELL, size + CELL * 2, size + CELL);
      this.lamps.fillStyle(colorNumber(color), 1);
      this.lamps.fillRect(x, y, size, size);
    }
  }

  /** Raised berth: underside beam, legs down to the ground band and a ground shadow, so the drop reads. */
  private createUnderside(left: number, bottom: number, gap: number): Phaser.GameObjects.Graphics {
    const config = campaignLandingScenery.berth;
    const g = this.scene.add.graphics();
    const ink = colorNumber(colors.ink);
    const ground = colorNumber(this.theme.palette.ground);
    g.fillStyle(ink, 0.35);
    g.fillRect(left + CELL * 4, bottom + gap - CELL, this.width - CELL * 8, CELL * 3);
    const legCount = Math.max(2, Math.round(this.width / config.legSpacingPx));
    for (let i = 0; i < legCount; i += 1) {
      const x = snapToGrid(left + config.lampInsetPx + ((this.width - config.lampInsetPx * 2 - config.legWidthPx) * i) / (legCount - 1), CELL);
      g.fillStyle(ink, 1);
      g.fillRect(x - CELL, bottom, config.legWidthPx + CELL * 2, gap + CELL);
      g.fillStyle(ground, 1);
      g.fillRect(x, bottom, config.legWidthPx, gap);
      if (i < legCount - 1) {
        // Cross brace to the next leg: a stepped diagonal in whole art px.
        const nextX = snapToGrid(left + config.lampInsetPx + ((this.width - config.lampInsetPx * 2 - config.legWidthPx) * (i + 1)) / (legCount - 1), CELL);
        const steps = Math.max(1, Math.floor(gap / (CELL * 2)) - 1);
        g.fillStyle(colorNumber(this.theme.palette.accent), 0.7);
        for (let s = 0; s < steps; s += 1) {
          const t = s / steps;
          g.fillRect(snapToGrid(x + config.legWidthPx + (nextX - x - config.legWidthPx) * t, CELL), bottom + CELL * 2 + s * CELL * 2, CELL * 2, CELL);
        }
      }
    }
    g.fillStyle(ink, 1);
    g.fillRect(left, bottom, this.width, config.beamPx);
    g.fillStyle(colorNumber(this.theme.palette.accent), 1);
    g.fillRect(left + CELL, bottom, this.width - CELL * 2, CELL);
    return g;
  }
}
