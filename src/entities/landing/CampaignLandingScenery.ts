import Phaser from "phaser";
import { CAMPAIGN_PORTRAIT_FRAME, CAMPAIGN_WINDSOCK_FRAME } from "../../data/assetManifest";
import type { CampaignThemeDefinition } from "../../data/campaign/themes";
import { campaignLandingCopy } from "../../data/landingCopy";
import { campaignLandingDecor, campaignLandingScenery, LANDING_ART_SCALE, type CampaignLandingDecor } from "../../data/landingScenery";
import { colorNumber, colors, depth, typeScale } from "../../game/designTokens";
import { monoStyle } from "../../ui";
import {
  landingWindPeak,
  sampleLandingWind,
  windsockFrameFor,
  type LandingWindSample,
} from "../../systems/LandingEnvironmentSystem";
import { sampleMotionPath } from "../../systems/MotionPathSystem";
import type { LandingDefinition } from "../../types/campaign";
import { drawSpans, filledEllipseSpans, snapToGrid } from "./pixelShapes";
import { isReducedMotion } from "../../fx/feedback";
import { createCampaignPorchDecor } from "./CampaignPorchDecor";
import { flourPosition, gustWarningAlpha } from "./campaignPresentation";

const CELL = LANDING_ART_SCALE;
const VIEW_WIDTH = 1280;
const VIEW_HEIGHT = 720;

export type CampaignSceneryOptions = {
  readonly definition: LandingDefinition;
  readonly theme: CampaignThemeDefinition;
  readonly touchLayout: boolean;
  /** Raised intro view: the sky covers this much extra height above the play view. */
  readonly riseAbovePx: number;
};

type Windsock = { readonly sprite: Phaser.GameObjects.Sprite; readonly altitude: number; frame: number };
type Speck = { readonly shape: Phaser.GameObjects.Graphics; readonly x: number; readonly phase: number; readonly speed: number };

/** Mixes two `#RRGGBB` colours (t 0 → a, 1 → b) into a Phaser colour number. */
export function mixHex(a: string, b: string, t: number): number {
  const ca = colorNumber(a);
  const cb = colorNumber(b);
  const channel = (shift: number): number => Math.round(((ca >> shift) & 255) * (1 - t) + ((cb >> shift) & 255) * t);
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

/** Recipient by the pad: idle / welcome frames, a little hop when startled. */
export interface LandingGreeter {
  idle(): void;
  wave(): void;
  startle(): void;
}

/**
 * Themed landing backdrop for campaign destinations (theme.legacy === false): stepped sky gradient, a far
 * silhouette, the destination art as a landmark, the ground band, plus every telegraph the landing needs —
 * the moving pad's rail, windsocks that read the same wind sample as the physics, the porch shelter, the
 * home canopy, and floating flour for light gravity. Static shapes are drawn once; only sprites move.
 */
export class CampaignLandingScenery implements LandingGreeter {
  private readonly scene: Phaser.Scene;
  private readonly definition: LandingDefinition;
  private readonly theme: CampaignThemeDefinition;
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private readonly windsocks: Windsock[] = [];
  private readonly specks: Speck[] = [];
  private readonly windPeak: number;
  private readonly greeter: Phaser.GameObjects.Sprite | undefined;
  private readonly greeterBaseY: number;
  private waveTimer: Phaser.Time.TimerEvent | undefined;

  constructor(scene: Phaser.Scene, options: CampaignSceneryOptions) {
    this.scene = scene;
    this.definition = options.definition;
    this.theme = options.theme;
    this.windPeak = landingWindPeak(options.definition.wind);
    const config = campaignLandingScenery;
    const decor = this.theme.id === "teaMoon" ? undefined : campaignLandingDecor[this.theme.id];

    this.createSky(options.riseAbovePx);
    this.createLandmark();
    if (decor) {
      this.createSilhouette(decor.silhouette, decor.ridgeShape);
      this.createNearHills(decor.nearHills);
    }
    this.createGround();
    const recipientX = options.touchLayout ? config.recipient.touchX : config.recipient.x;
    if (decor) this.track(createCampaignPorchDecor(scene, this.theme, decor, recipientX));
    if (decor?.canopy) this.createCanopy(decor.canopy);
    if (options.definition.padMotion.kind === "path") this.createRail();
    if (decor?.shelter && options.definition.wind.kind === "gust") this.createShelter(decor.shelter);
    if (options.definition.wind.kind !== "none" && decor) {
      for (const sock of decor.windsocks) this.createWindsock(sock.x, sock.altitude);
    }
    if (decor?.flour) this.createFlour();

    const recipient = config.recipient;
    const x = options.touchLayout ? recipient.touchX : recipient.x;
    this.greeterBaseY = config.groundTopY + CELL * 2;
    if (this.theme.portraitTexture !== null) {
      this.greeter = scene.add
        .sprite(x, this.greeterBaseY, this.theme.portraitTexture, CAMPAIGN_PORTRAIT_FRAME.idle)
        .setOrigin(0.5, 1)
        .setScale(CELL)
        .setFlipX(x > options.definition.pad.centerX)
        .setDepth(depth.world + 3);
      this.objects.push(this.greeter);
    } else {
      this.createHomeBanner(x);
    }
  }

  /** Per-frame: windsocks follow the wind at their own altitude (same sampling as the physics), flour drifts. */
  update(timeMs: number, clockMs: number, wind: LandingWindSample): void {
    for (const sock of this.windsocks) {
      const sample = this.definition.wind.kind === "gust" ? sampleLandingWind(this.definition.wind, sock.altitude, clockMs) : wind;
      const frame = CAMPAIGN_WINDSOCK_FRAME[windsockFrameFor(sample, this.windPeak)];
      if (frame !== sock.frame) {
        sock.frame = frame;
        sock.sprite.setFrame(frame);
      }
      const warning = sample.phase === "warning" && sample.exposure > 0;
      sock.sprite.setAlpha(warning ? gustWarningAlpha(clockMs, isReducedMotion()) : 1);
      sock.sprite.setTint(colorNumber(warning ? this.theme.palette.light : "#FFFFFF"));
    }
    if (this.specks.length > 0) this.updateFlour(timeMs);
  }

  idle(): void {
    this.waveTimer?.remove();
    this.waveTimer = undefined;
    if (!this.greeter) return;
    this.scene.tweens.killTweensOf(this.greeter);
    this.greeter.setFrame(CAMPAIGN_PORTRAIT_FRAME.idle).setY(this.greeterBaseY);
  }

  wave(): void {
    const greeter = this.greeter;
    if (!greeter) return;
    const recipient = campaignLandingScenery.recipient;
    this.waveTimer?.remove();
    let swaps = 0;
    greeter.setFrame(CAMPAIGN_PORTRAIT_FRAME.welcome);
    this.waveTimer = this.scene.time.addEvent({
      delay: recipient.waveStepMs,
      repeat: recipient.waveSwaps * 2 - 1,
      callback: () => {
        swaps += 1;
        greeter.setFrame(swaps % 2 === 0 ? CAMPAIGN_PORTRAIT_FRAME.welcome : CAMPAIGN_PORTRAIT_FRAME.idle);
      },
    });
  }

  startle(): void {
    const greeter = this.greeter;
    if (!greeter) return;
    this.scene.tweens.killTweensOf(greeter);
    greeter.setY(this.greeterBaseY);
    this.scene.tweens.add({ targets: greeter, y: this.greeterBaseY - CELL * 6, duration: 140, yoyo: true, ease: "Quad.easeOut" });
  }

  destroy(): void {
    this.waveTimer?.remove();
    for (const object of this.objects) object.destroy();
  }

  private track<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.objects.push(object);
    return object;
  }

  private createSky(riseAbovePx: number): void {
    const { palette } = this.theme;
    const bands = campaignLandingScenery.skyBands;
    const g = this.track(this.scene.add.graphics().setDepth(depth.backdrop).setScrollFactor(0));
    g.fillStyle(colorNumber(palette.skyTop), 1);
    g.fillRect(0, -riseAbovePx, VIEW_WIDTH, riseAbovePx);
    const bandHeight = Math.ceil(VIEW_HEIGHT / bands / CELL) * CELL;
    for (let i = 0; i < bands; i += 1) {
      g.fillStyle(mixHex(palette.skyTop, palette.skyBottom, i / (bands - 1)), 1);
      g.fillRect(0, i * bandHeight, VIEW_WIDTH, bandHeight + CELL);
    }
    // Stars: fixed pseudo-random pattern (deterministic so captures stay stable).
    const stars = this.track(this.scene.add.graphics().setDepth(depth.backdrop + 1).setScrollFactor(0.15));
    let seed = 7;
    const next = (): number => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (let i = 0; i < campaignLandingScenery.starCount; i += 1) {
      const x = snapToGrid(next() * VIEW_WIDTH, CELL);
      const y = snapToGrid(next() * (VIEW_HEIGHT * 0.55) - riseAbovePx * 0.15, CELL);
      const big = next() > 0.8;
      stars.fillStyle(colorNumber(palette.light), big ? 0.85 : 0.45);
      stars.fillRect(x, y, big ? CELL * 2 : CELL, big ? CELL * 2 : CELL);
    }
  }

  private createLandmark(): void {
    const landmark = campaignLandingScenery.landmark;
    if (!this.scene.textures.exists(this.theme.destinationTexture)) return;
    this.track(
      this.scene.add
        .image(landmark.x, landmark.y, this.theme.destinationTexture)
        .setScale(CELL)
        .setScrollFactor(landmark.scrollFactor)
        .setDepth(depth.parallax),
    );
  }

  private createSilhouette(heights: readonly number[], shape: CampaignLandingDecor["ridgeShape"]): void {
    const config = campaignLandingScenery.silhouette;
    const base = campaignLandingScenery.groundTopY + config.baseOffsetPx;
    const g = this.track(this.scene.add.graphics().setDepth(depth.parallax + 1).setScrollFactor(config.scrollFactor));
    const humpWidth = VIEW_WIDTH / heights.length;
    for (let i = 0; i < heights.length + 1; i += 1) {
      const height = heights[i % heights.length] ?? 40;
      const cx = i * humpWidth;
      // Stepped rounded hump: rows narrow towards the top in whole art px.
      for (let y = 0; y < height; y += config.stepPx) {
        const t = y / height;
        const profile = shape === "crag" ? 1 - t * 0.85 : shape === "terraced" ? 1 - Math.floor(t * 4) / 5 : Math.sqrt(1 - t * t);
        const half = snapToGrid(humpWidth * 0.62 * profile, CELL);
        g.fillStyle(mixHex(this.theme.palette.skyBottom, this.theme.palette.ground, 0.45), 1);
        g.fillRect(snapToGrid(cx - half, CELL), base - y - config.stepPx, half * 2, config.stepPx);
        // Narrow dusk-lit contour, with sparse mineral seams down the near-facing slope.
        g.fillStyle(mixHex(this.theme.palette.ground, this.theme.palette.light, 0.2), 0.8);
        g.fillRect(snapToGrid(cx - half, CELL), base - y - config.stepPx, CELL * 2, config.stepPx);
        if (y % 32 === 0) {
          g.fillStyle(colorNumber(this.theme.palette.accent), 0.12);
          g.fillRect(snapToGrid(cx - half / 2, CELL), base - y, snapToGrid(half * 0.6, CELL), CELL * 2);
        }
      }
    }
  }

  private createGround(): void {
    const top = campaignLandingScenery.groundTopY;
    const { palette } = this.theme;
    const g = this.track(this.scene.add.graphics().setDepth(depth.world - 2));
    g.fillStyle(colorNumber(palette.ground), 1);
    g.fillRect(0, top, VIEW_WIDTH, VIEW_HEIGHT - top + CELL * 8);
    g.fillStyle(mixHex(palette.ground, palette.light, 0.25), 1);
    g.fillRect(0, top, VIEW_WIDTH, CELL * 2);
    g.fillStyle(mixHex(palette.ground, colors.ink, 0.35), 1);
    for (let x = 0; x < VIEW_WIDTH; x += CELL * 22) {
      g.fillRect(x + ((x / (CELL * 22)) % 2) * CELL * 8, top + CELL * 8, CELL * 6, CELL);
      g.fillRect(x + CELL * 12, top + CELL * 18, CELL * 4, CELL);
    }
  }

  /** A nearer, rim-lit ridge behind the pad gives the inhabited apron depth. Drawn once. */
  private createNearHills(heights: readonly number[]): void {
    const base = campaignLandingScenery.groundTopY + 16;
    const g = this.track(this.scene.add.graphics().setDepth(depth.parallax + 2));
    const width = VIEW_WIDTH / heights.length;
    for (let i = 0; i <= heights.length; i += 1) {
      const height = heights[i % heights.length] ?? 60;
      const cx = snapToGrid(i * width + width / 2, CELL);
      for (let y = 0; y < height; y += 4) {
        const half = snapToGrid(width * 0.7 * Math.sqrt(1 - (y / height) ** 2), CELL);
        g.fillStyle(mixHex(this.theme.palette.ground, this.theme.palette.light, 0.24), 1);
        g.fillRect(cx - half, base - y - 4, half * 2, 4);
        g.fillStyle(mixHex(this.theme.palette.ground, this.theme.palette.skyBottom, 0.12), 1);
        g.fillRect(cx - half + 4, base - y, Math.max(0, half * 2 - 8), 4);
      }
    }
  }

  /** Moving pad: the rail it slides on, spanning its full travel, with a bulb at each end. */
  private createRail(): void {
    const motion = this.definition.padMotion;
    if (motion.kind !== "path") return;
    const rail = campaignLandingScenery.rail;
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    const steps = 48;
    for (let i = 0; i <= steps; i += 1) {
      const x = sampleMotionPath(motion.path, (motion.path.periodMs * i) / steps).position.x;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
    }
    const half = this.definition.pad.width / 2;
    const berth = campaignLandingScenery.berth;
    const y = snapToGrid(this.definition.pad.surfaceY + (berth.tileArtHeight - berth.surfaceRowArtPx) * CELL, CELL);
    const left = snapToGrid(minX - half - rail.overhangPx, CELL);
    const right = snapToGrid(maxX + half + rail.overhangPx, CELL);
    const g = this.track(this.scene.add.graphics().setDepth(depth.world - 1));
    g.fillStyle(colorNumber(colors.ink), 1);
    g.fillRect(left, y - CELL, right - left, rail.heightPx + CELL * 2);
    g.fillStyle(colorNumber(this.theme.palette.accent), 1);
    g.fillRect(left, y, right - left, CELL);
    g.fillStyle(mixHex(this.theme.palette.accent, colors.ink, 0.45), 1);
    g.fillRect(left, y + CELL, right - left, rail.heightPx - CELL);
    for (let x = left + CELL * 2; x < right; x += rail.tieSpacingPx) g.fillRect(x, y + rail.heightPx, CELL * 2, CELL * 2);
    for (const bx of [left, right]) {
      const r = rail.bulbRadiusPx;
      g.fillStyle(colorNumber(colors.ink), 1);
      g.fillRect(bx - r - CELL, y - r - CELL * 2, r * 2 + CELL * 2, r * 2 + CELL * 2);
      g.fillStyle(colorNumber(this.theme.palette.light), 1);
      g.fillRect(bx - r, y - r - CELL, r * 2, r * 2);
      g.fillStyle(colorNumber(colors.plaster), 1);
      g.fillRect(bx - r + CELL, y - r, CELL, CELL);
    }
  }

  private createWindsock(x: number, altitude: number): void {
    const config = campaignLandingScenery.windsock;
    const ground = campaignLandingScenery.groundTopY;
    const topY = snapToGrid(this.definition.pad.surfaceY - altitude, CELL);
    const pole = this.track(this.scene.add.graphics().setDepth(depth.world + 1));
    pole.fillStyle(colorNumber(colors.ink), 1);
    pole.fillRect(x - config.poleWidthPx / 2 - CELL, topY - CELL * 2, config.poleWidthPx + CELL * 2, ground - topY + CELL * 2);
    pole.fillStyle(colorNumber(colors.plaster), 1);
    pole.fillRect(x - config.poleWidthPx / 2, topY - CELL, config.poleWidthPx, ground - topY);
    const wind = this.definition.wind;
    const direction = wind.kind === "steady" ? wind.acceleration.x : wind.kind === "gust" ? wind.peakAcceleration.x : 1;
    // Art points right (blowing towards +x) from the pole top; mirror for wind towards -x.
    const sprite = this.track(
      this.scene.add
        .sprite(x, topY, config.key, CAMPAIGN_WINDSOCK_FRAME.calm)
        .setOrigin(0, 0.15)
        .setScale(CELL)
        .setFlipX(direction < 0)
        .setDepth(depth.world + 4),
    );
    if (direction < 0) sprite.setOrigin(1, 0.15);
    this.windsocks.push({ sprite, altitude, frame: CAMPAIGN_WINDSOCK_FRAME.calm });
  }

  /** Porch awning at the shelter height plus windbreak posts on the windward side: explains the calm. */
  private createShelter(shelter: { readonly windbreakX: number; readonly windbreakWidth: number }): void {
    const wind = this.definition.wind;
    if (wind.kind !== "gust" || wind.shelter === null) return;
    const config = campaignLandingScenery.awning;
    const pad = this.definition.pad;
    const ground = campaignLandingScenery.groundTopY;
    const eaveY = snapToGrid(pad.surfaceY - wind.shelter.calmBelowAltitude, CELL);
    const left = snapToGrid(shelter.windbreakX, CELL);
    const right = snapToGrid(pad.centerX - pad.width / 2 + config.overhangPastPadPx, CELL);
    const { palette } = this.theme;
    const g = this.track(this.scene.add.graphics().setDepth(depth.world + 1));
    // Windbreak: slatted posts from the ground up to the eave.
    for (let x = left; x <= left + shelter.windbreakWidth; x += config.postSpacingPx) {
      g.fillStyle(colorNumber(colors.ink), 1);
      g.fillRect(x - CELL, eaveY, CELL * 5, ground - eaveY);
      g.fillStyle(mixHex(palette.ground, palette.light, 0.35), 1);
      g.fillRect(x, eaveY + CELL, CELL * 3, ground - eaveY - CELL);
    }
    g.fillStyle(mixHex(palette.ground, palette.light, 0.2), 1);
    for (let y = eaveY + CELL * 10; y < ground - CELL * 4; y += CELL * 12) g.fillRect(left, y, shelter.windbreakWidth + CELL * 4, CELL * 3);
    // Striped awning eave at exactly the calm altitude.
    g.fillStyle(colorNumber(colors.ink), 1);
    g.fillRect(left - CELL * 2, eaveY - config.depthPx - CELL, right - left + CELL * 4, config.depthPx + CELL * 3);
    for (let x = left - CELL; x < right + CELL; x += config.stripePx) {
      const even = Math.round((x - left) / config.stripePx) % 2 === 0;
      g.fillStyle(colorNumber(even ? palette.light : palette.accent), 1);
      g.fillRect(x, eaveY - config.depthPx, Math.min(config.stripePx, right + CELL - x), config.depthPx);
    }
    g.fillStyle(colorNumber(palette.light), 0.9);
    for (let x = left; x < right; x += config.stripePx) g.fillRect(x, eaveY, config.stripePx / 2, CELL * 2);
    // The physical wind reaches zero at this line, across the entire berth approach.
    const padLeft = snapToGrid(pad.centerX - pad.width / 2, CELL);
    g.fillStyle(colorNumber(palette.accent), 0.09);
    g.fillRect(padLeft, eaveY + CELL, pad.width, pad.surfaceY - eaveY);
    g.fillStyle(colorNumber(palette.light), 0.45);
    for (let x = padLeft; x < padLeft + pad.width; x += 20) g.fillRect(x, eaveY, 10, CELL);
  }

  private createCanopy(canopy: { readonly x0: number; readonly x1: number; readonly y: number }): void {
    const { palette } = this.theme;
    const ground = campaignLandingScenery.groundTopY;
    const stripe = campaignLandingScenery.awning.stripePx;
    const g = this.track(this.scene.add.graphics().setDepth(depth.world - 1));
    const x0 = snapToGrid(canopy.x0, CELL);
    const x1 = snapToGrid(canopy.x1, CELL);
    const y = snapToGrid(canopy.y, CELL);
    for (const px of [x0 + CELL * 6, x1 - CELL * 9]) {
      g.fillStyle(colorNumber(colors.ink), 1);
      g.fillRect(px - CELL, y, CELL * 5, ground - y);
      g.fillStyle(mixHex(palette.ground, palette.light, 0.3), 1);
      g.fillRect(px, y, CELL * 3, ground - y);
    }
    g.fillStyle(colorNumber(colors.ink), 1);
    g.fillRect(x0 - CELL, y - CELL * 11, x1 - x0 + CELL * 2, CELL * 13);
    for (let x = x0; x < x1; x += stripe) {
      const even = Math.round((x - x0) / stripe) % 2 === 0;
      g.fillStyle(colorNumber(even ? palette.accent : palette.light), 1);
      g.fillRect(x, y - CELL * 10, Math.min(stripe, x1 - x), CELL * 10);
    }
    g.fillStyle(colorNumber(palette.light), 1);
    for (let x = x0; x < x1; x += stripe) g.fillRect(x + CELL * 2, y, stripe / 2, CELL * 2);
  }

  private createHomeBanner(x: number): void {
    const banner = campaignLandingScenery.homeBanner;
    const ground = campaignLandingScenery.groundTopY;
    const top = snapToGrid(ground - banner.postHeight - banner.height, CELL);
    const left = snapToGrid(x - banner.width / 2, CELL);
    const g = this.track(this.scene.add.graphics().setDepth(depth.world + 3));
    g.fillStyle(colorNumber(colors.ink), 1);
    for (const px of [left + CELL * 4, left + banner.width - CELL * 7]) g.fillRect(px, top, CELL * 3, ground - top);
    g.fillRect(left - CELL, top - CELL, banner.width + CELL * 2, banner.height + CELL * 2);
    g.fillStyle(colorNumber(colors.parchment), 1);
    g.fillRect(left, top, banner.width, banner.height);
    g.fillStyle(colorNumber(this.theme.palette.accent), 1);
    g.fillRect(left, top + banner.height - CELL * 2, banner.width, CELL * 2);
    this.track(
      this.scene.add
        .text(x, top + banner.height / 2 - CELL, campaignLandingCopy.homeBanner, monoStyle({ size: typeScale.sm, color: colors.ink, bold: true }))
        .setOrigin(0.5, 0.5)
        .setDepth(depth.world + 4),
    );
  }

  private createFlour(): void {
    const config = campaignLandingScenery.flour;
    let seed = 11;
    const next = (): number => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (let i = 0; i < config.count; i += 1) {
      const shape = this.track(this.scene.add.graphics().setDepth(depth.worldFx));
      const size = config.sizePx + (i % 3) * CELL;
      shape.fillStyle(colorNumber(this.theme.palette.light), config.alpha * (0.6 + next() * 0.4));
      drawSpans(shape, 0, 0, filledEllipseSpans(size / 2, 4, CELL), CELL);
      drawSpans(shape, -4, -2, filledEllipseSpans(4, 4, CELL), CELL);
      drawSpans(shape, 4, -4, filledEllipseSpans(4, 4, CELL), CELL);
      shape.fillStyle(colorNumber(colors.parchment), 0.35);
      shape.fillRect(-CELL * 2, -CELL * 2, CELL * 3, CELL);
      this.specks.push({ shape, x: 80 + next() * 1120, phase: next() ** 2, speed: 0.6 + next() * 0.8 });
    }
    this.updateFlour(0);
  }

  /** Flour rises slowly and sways: in light gravity it never quite falls. */
  private updateFlour(timeMs: number): void {
    for (const speck of this.specks) {
      const { x, y } = flourPosition(speck.x, speck.phase, speck.speed, timeMs);
      speck.shape.setPosition(snapToGrid(x, CELL), snapToGrid(y, CELL));
    }
  }
}
