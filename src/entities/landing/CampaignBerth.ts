import Phaser from "phaser";
import { layoutBerthTiles } from "./berthTiles";
import { campaignLandingDecor, campaignLandingScenery, LANDING_ART_SCALE, type CampaignBerthFinish } from "../../data/landingScenery";
import type { CampaignThemeDefinition } from "../../data/campaign/themes";
import { colorNumber, colors, depth } from "../../game/designTokens";
import type { LandingPadDefinition } from "../../types/landing";
import { snapToGrid } from "./pixelShapes";
import { mixHex } from "./colorMix";

export { layoutBerthTiles, type BerthTile } from "./berthTiles";

const CELL = LANDING_ART_SCALE;

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

    const finish = theme.id === "teaMoon" ? undefined : campaignLandingDecor[theme.id].berth;
    for (const tile of layoutBerthTiles(pad.width, config.tileArtWidth, CELL)) {
      const image = scene.add.image(left + tile.x, top, config.key, tile.frame).setOrigin(0, 0).setScale(CELL)
        .setTint(colorNumber(finish?.tint ?? theme.palette.light));
      if (tile.artWidth < config.tileArtWidth) image.setCrop(0, 0, tile.artWidth, config.tileArtHeight);
      children.push(image);
    }
    if (finish && finish.trim !== "none") children.push(this.createTrim(finish, left, top, tileHeightPx));

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

  /**
   * Per-theme finish painted over the tiles once: lit rim on the walkable top, a trim band that names the place
   * (hazard chevrons, bamboo slats, icing scallops, rivetted planks, station stripes) and a darker skirt.
   */
  private createTrim(finish: CampaignBerthFinish, left: number, top: number, tileHeightPx: number): Phaser.GameObjects.Graphics {
    const g = this.scene.add.graphics();
    const w = this.width;
    const rect = (x: number, y: number, rw: number, rh: number, color: number, alpha = 1): void => {
      g.fillStyle(color, alpha);
      g.fillRect(snapToGrid(x, CELL), snapToGrid(y, CELL), snapToGrid(rw, CELL), snapToGrid(rh, CELL));
    };
    const ink = colorNumber(colors.ink);
    const trim = colorNumber(finish.trimColor);
    const alt = colorNumber(finish.trimAlt);
    const bandTop = top + CELL * 6;
    const bandH = CELL * 8;
    const skirtTop = top + tileHeightPx - CELL * 10;
    rect(left, skirtTop, w, CELL * 6, colorNumber(finish.skirt), 0.88);
    rect(left, skirtTop, w, CELL, mixHex(finish.skirt, finish.rim, 0.3));
    rect(left, bandTop - CELL, w, bandH + CELL * 2, ink);
    switch (finish.trim) {
      case "chevrons":
        rect(left, bandTop, w, bandH, alt);
        for (let x = left; x < left + w - CELL * 4; x += CELL * 8) {
          for (let k = 0; k < 4; k += 1) rect(x + k * CELL, bandTop + bandH - (k + 1) * CELL * 2, CELL * 4, CELL * 2, trim);
        }
        break;
      case "slats":
        rect(left, bandTop, w, bandH, trim);
        for (let x = left + CELL * 3; x < left + w; x += CELL * 6) rect(x, bandTop, CELL, bandH, alt, 0.85);
        for (let x = left + CELL * 6; x < left + w; x += CELL * 12) rect(x - CELL, bandTop + CELL * 3, CELL * 2, CELL, alt);
        break;
      case "scallops":
        rect(left, bandTop, w, bandH, alt);
        for (let x = left; x < left + w - CELL * 4; x += CELL * 8) {
          rect(x + CELL, bandTop, CELL * 6, CELL * 2, trim);
          rect(x + CELL * 2, bandTop + CELL * 2, CELL * 4, CELL * 2, trim);
          rect(x + CELL * 3, bandTop + CELL * 4, CELL * 2, CELL * 2, trim);
        }
        rect(left, bandTop, w, CELL, trim);
        break;
      case "planks":
        rect(left, bandTop, w, bandH, trim);
        for (let x = left + CELL * 14; x < left + w; x += CELL * 14) {
          rect(x, bandTop, CELL, bandH, alt);
          rect(x - CELL * 3, bandTop + CELL, CELL, CELL, colorNumber(finish.rim), 0.8);
          rect(x - CELL * 3, bandTop + bandH - CELL * 2, CELL, CELL, colorNumber(finish.rim), 0.8);
        }
        rect(left, bandTop + CELL * 4, w, CELL, alt, 0.5);
        break;
      case "stripes":
        rect(left, bandTop, w, CELL * 3, trim);
        rect(left, bandTop + CELL * 3, w, CELL * 2, ink, 0.6);
        rect(left, bandTop + CELL * 5, w, CELL * 3, alt);
        break;
    }
    rect(left, top, w, CELL * 2, colorNumber(finish.rim));
    rect(left, top + CELL * 2, w, CELL, ink, 0.55);
    return g;
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
