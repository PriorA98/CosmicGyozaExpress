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
import { windDirectionSign } from "./LandingWindIndicator";
import { ambientMotePosition, campaignSkyBandColors, flourPosition, gustWarningAlpha, windsockPlacement, type AmbientMote } from "./campaignPresentation";
import { mixHex } from "./colorMix";

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

type Windsock = { readonly sprite: Phaser.GameObjects.Sprite; readonly altitude: number; readonly mount: "mast" | "ridge"; readonly topY: number; direction: number; frame: number };
type Speck = { readonly shape: Phaser.GameObjects.Graphics; readonly x: number; readonly phase: number; readonly speed: number };
type Mote = AmbientMote & { readonly shape: Phaser.GameObjects.Graphics };

export { mixHex } from "./colorMix";

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
  private readonly motes: Mote[] = [];
  private readonly ambientKind: "drift" | "firefly" | "rain" | undefined;
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

    this.ambientKind = decor?.ambient?.kind;
    this.createSky(options.riseAbovePx, decor);
    this.createLandmark(decor);
    if (decor) {
      this.createSilhouette(decor);
      this.createNearHills(decor);
    }
    this.createGround(decor);
    const recipientX = options.touchLayout ? config.recipient.touchX : config.recipient.x;
    const porch = decor ? createCampaignPorchDecor(scene, this.theme, decor, recipientX, options.touchLayout) : undefined;
    if (porch) for (const object of porch.objects) this.track(object);
    if (decor?.canopy) this.createCanopy(decor.canopy);
    if (options.definition.padMotion.kind === "path") this.createRail();
    if (decor?.shelter && options.definition.wind.kind === "gust") this.createShelter(decor.shelter);
    if (options.definition.wind.kind !== "none" && decor) {
      for (const sock of decor.windsocks) {
        if (sock.mount === "ridge" && porch?.ridge) this.createWindsock(porch.ridge.x, sock.altitude, "ridge");
        else if (sock.mount === "mast") this.createWindsock(sock.x, sock.altitude, "mast");
      }
    }
    if (decor?.flour) this.createFlour();
    if (decor?.ambient) this.createAmbient(decor.ambient);

    const recipient = config.recipient;
    const x = options.touchLayout ? recipient.touchX : recipient.x;
    this.greeterBaseY = config.groundTopY - config.recipientWindow.bottomAboveGround;
    if (this.theme.portraitTexture !== null) {
      this.createRecipientWindow(x);
      this.greeter = scene.add
        .sprite(x, this.greeterBaseY, this.theme.portraitTexture, CAMPAIGN_PORTRAIT_FRAME.idle)
        .setOrigin(0.5, 1)
        .setScale(CELL)
        .setFlipX(x > options.definition.pad.centerX)
        .setCrop(0, 0, 48, config.recipientWindow.cropRows)
        .setDepth(depth.world + 3);
      this.objects.push(this.greeter);
    } else {
      this.createHomeBanner(x);
    }
  }

  /** Per-frame: windsocks follow the wind at their own altitude (same sampling as the physics), flour drifts. */
  update(timeMs: number, clockMs: number, wind: LandingWindSample): void {
    for (const sock of this.windsocks) {
      const kind = this.definition.wind.kind;
      const sample = kind === "gust" || kind === "bands" ? sampleLandingWind(this.definition.wind, sock.altitude, clockMs) : wind;
      const frame = CAMPAIGN_WINDSOCK_FRAME[windsockFrameFor(sample, this.windPeak)];
      // Alternating squalls and layered mist: the sock points where the wind at its own height pushes.
      const direction = windDirectionSign(this.definition.wind, sample);
      if (direction !== Math.sign(sock.direction)) {
        sock.direction = direction;
        sock.sprite.setFlipX(direction < 0);
        sock.frame = -1;
      }
      if (frame !== sock.frame) {
        sock.frame = frame;
        sock.sprite.setFrame(frame);
        this.alignWindsock(sock);
      }
      const warning = sample.phase === "warning" && sample.exposure > 0;
      sock.sprite.setAlpha(warning ? gustWarningAlpha(clockMs, isReducedMotion()) : 1);
      sock.sprite.setTint(colorNumber(warning ? this.theme.palette.light : "#FFFFFF"));
    }
    if (this.specks.length > 0) this.updateFlour(timeMs);
    if (this.motes.length > 0) this.updateAmbient(isReducedMotion() ? 0 : timeMs, wind.acceleration.x);
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

  private createSky(riseAbovePx: number, decor: CampaignLandingDecor | undefined): void {
    const { palette } = this.theme;
    const skyKey = decor?.backdrop.skyTexture;
    if (skyKey && this.scene.textures.exists(skyKey)) {
      this.track(this.scene.add.image(0, -riseAbovePx, skyKey).setOrigin(0, 0).setDisplaySize(VIEW_WIDTH, VIEW_HEIGHT + riseAbovePx)
        .setDepth(depth.backdrop).setScrollFactor(0));
    } else {
      // Vertical gradient (sky top, sky bottom, then the horizon glow) in pixel bands; every seam is dithered
      // with interleaved rows. Drawn once.
      const g = this.track(this.scene.add.graphics().setDepth(depth.backdrop).setScrollFactor(0));
      g.fillStyle(colorNumber(palette.skyTop), 1);
      g.fillRect(0, -riseAbovePx, VIEW_WIDTH, riseAbovePx);
      const bands = campaignSkyBandColors(palette.skyTop, palette.skyBottom, decor?.tones.horizon ?? palette.skyBottom, campaignLandingScenery.skyBands);
      const bandHeight = Math.ceil(campaignLandingScenery.groundTopY / bands.length / CELL) * CELL;
      bands.forEach((color, i) => {
        g.fillStyle(color, 1);
        g.fillRect(0, i * bandHeight, VIEW_WIDTH, i === bands.length - 1 ? VIEW_HEIGHT : bandHeight + CELL);
      });
      for (let i = 1; i < bands.length; i += 1) {
        const seam = i * bandHeight;
        g.fillStyle(bands[i - 1] ?? 0, 1);
        g.fillRect(0, seam + CELL, VIEW_WIDTH, CELL);
        g.fillStyle(bands[i] ?? 0, 1);
        g.fillRect(0, seam - CELL * 2, VIEW_WIDTH, CELL);
      }
    }
    if (decor?.warmHorizon) {
      const glow = this.track(this.scene.add.graphics().setDepth(depth.backdrop + 0.5).setScrollFactor(0));
      for (let y = 360; y < campaignLandingScenery.groundTopY; y += 8) {
        glow.fillStyle(colorNumber(decor.tones.horizon), 0.04 + (y - 360) / 288 * 0.18);
        glow.fillRect(0, y, VIEW_WIDTH, 8);
      }
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

  private createLandmark(decor: CampaignLandingDecor | undefined): void {
    const landmark = campaignLandingScenery.landmark;
    if (!this.scene.textures.exists(this.theme.destinationTexture)) return;
    this.track(
      this.scene.add
        .image(decor?.landmark.x ?? landmark.x, decor?.landmark.y ?? landmark.y, this.theme.destinationTexture)
        .setScale(CELL)
        .setScrollFactor(landmark.scrollFactor)
        .setDepth(depth.parallax),
    );
  }

  private createSilhouette(decor: CampaignLandingDecor): void {
    const config = campaignLandingScenery.silhouette;
    const base = campaignLandingScenery.groundTopY + config.baseOffsetPx;
    const farKey = decor.backdrop.farHillsTexture;
    if (farKey && this.scene.textures.exists(farKey)) {
      this.track(this.scene.add.image(0, base, farKey).setOrigin(0, 1).setScale(CELL).setScrollFactor(config.scrollFactor).setDepth(depth.parallax + 1));
      return;
    }
    const heights = decor.silhouette;
    const shape = decor.ridgeShape;
    const { tones } = decor;
    const g = this.track(this.scene.add.graphics().setDepth(depth.parallax + 1).setScrollFactor(config.scrollFactor));
    const humpWidth = VIEW_WIDTH / heights.length;
    for (let i = 0; i < heights.length + 1; i += 1) {
      const height = heights[i % heights.length] ?? 40;
      const cx = i * humpWidth;
      // Stepped hump: rows narrow towards the top in whole art px; a thin horizon-lit contour on the left.
      for (let y = 0; y < height; y += config.stepPx) {
        const t = y / height;
        const profile = shape === "crag" ? 1 - t * 0.85 : shape === "terraced" ? 1 - Math.floor(t * 4) / 5 : Math.sqrt(1 - t * t);
        const half = snapToGrid(humpWidth * 0.62 * profile, CELL);
        g.fillStyle(colorNumber(tones.farHill), 1);
        g.fillRect(snapToGrid(cx - half, CELL), base - y - config.stepPx, half * 2, config.stepPx);
        g.fillStyle(mixHex(tones.farHill, tones.horizon, 0.45), 1);
        g.fillRect(snapToGrid(cx - half, CELL), base - y - config.stepPx, CELL * 2, config.stepPx);
      }
    }
    // Atmospheric haze between the far ridge and the near hills.
    g.fillStyle(colorNumber(tones.horizon), 0.16);
    g.fillRect(0, base - 96, VIEW_WIDTH, 96);
    g.fillStyle(colorNumber(tones.horizon), 0.12);
    g.fillRect(0, base - 48, VIEW_WIDTH, 48);
  }

  private createGround(decor: CampaignLandingDecor | undefined): void {
    const top = campaignLandingScenery.groundTopY;
    const { palette } = this.theme;
    const groundKey = decor?.backdrop.groundTexture;
    if (groundKey && this.scene.textures.exists(groundKey)) {
      this.track(this.scene.add.image(0, top, groundKey).setOrigin(0, 0).setScale(CELL).setDepth(depth.world - 2));
      return;
    }
    const g = this.track(this.scene.add.graphics().setDepth(depth.world - 2));
    const rim = decor?.tones.rim ?? palette.light;
    const dark = mixHex(palette.ground, colors.ink, 0.4);
    g.fillStyle(colorNumber(palette.ground), 1);
    g.fillRect(0, top, VIEW_WIDTH, VIEW_HEIGHT - top + CELL * 8);
    g.fillStyle(mixHex(palette.ground, rim, 0.3), 1);
    g.fillRect(0, top, VIEW_WIDTH, CELL * 2);
    g.fillStyle(dark, 1);
    g.fillRect(0, top + CELL * 2, VIEW_WIDTH, CELL);
    const rect = (x: number, y: number, w: number, h: number, color: number, alpha: number): void => {
      g.fillStyle(color, alpha);
      g.fillRect(snapToGrid(x, CELL), snapToGrid(y, CELL), snapToGrid(w, CELL), snapToGrid(h, CELL));
    };
    const rimColor = colorNumber(rim);
    const accent = colorNumber(palette.accent);
    switch (decor?.ground ?? "plates") {
      case "plates":
        for (let x = 40; x < VIEW_WIDTH; x += 96) {
          rect(x, top + 6, 2, 66, dark, 0.8);
          for (const ry of [12, 34, 58]) rect(x + 6, top + ry, 2, 2, rimColor, 0.45);
        }
        rect(0, top + 38, VIEW_WIDTH, 2, dark, 0.6);
        break;
      case "moss":
        for (let x = 0; x < VIEW_WIDTH; x += 14) {
          const k = (x / 14) % 3;
          rect(x, top - 2 - k * 2, 4, 2 + k * 2, accent, 0.85);
          if (k === 1) rect(x + 4, top + 16 + ((x / 14) % 5) * 8, 8, 2, accent, 0.3);
        }
        break;
      case "tiles":
        for (let row = 0; row < 3; row += 1) {
          for (let x = (row % 2) * 20; x < VIEW_WIDTH; x += 40) {
            rect(x, top + 6 + row * 22, 38, 20, rimColor, Math.floor(x / 40 + row) % 2 === 0 ? 0.06 : 0.02);
            rect(x, top + 6 + row * 22, 2, 20, dark, 0.6);
          }
          rect(0, top + 4 + row * 22, VIEW_WIDTH, 2, dark, 0.6);
        }
        break;
      case "wet":
        for (let i = 0; i < 26; i += 1) rect((i * 151) % VIEW_WIDTH, top + 10 + ((i * 13) % 56), 24 + ((i * 17) % 40), 2, rimColor, 0.22);
        break;
      case "deck":
        for (let y = top + 12, row = 0; y < VIEW_HEIGHT; y += 14, row += 1) {
          rect(0, y, VIEW_WIDTH, 2, dark, 0.55);
          for (let x = (row % 2) * 40; x < VIEW_WIDTH; x += 80) rect(x, y + 2, 2, 12, dark, 0.45);
        }
        break;
    }
    for (let i = 0; i < 40; i += 1) rect((i * 178 + 26) % VIEW_WIDTH, top + 22 + ((i * 14) % 44), i % 3 === 0 ? 8 : 4, 2, i % 4 === 0 ? rimColor : colorNumber(colors.ink), 0.22);
  }

  /** A nearer ridge behind the pad, rim-lit on its porch-facing (right) flank and crest. Drawn once. */
  private createNearHills(decor: CampaignLandingDecor): void {
    const heights = decor.nearHills;
    const { tones } = decor;
    const base = campaignLandingScenery.groundTopY + 16;
    const g = this.track(this.scene.add.graphics().setDepth(depth.parallax + 2));
    const width = VIEW_WIDTH / heights.length;
    const body = colorNumber(tones.nearHill);
    const shade = mixHex(tones.nearHill, colors.ink, 0.3);
    const rim = colorNumber(tones.rim);
    for (let i = 0; i <= heights.length; i += 1) {
      const height = heights[i % heights.length] ?? 60;
      const cx = snapToGrid(i * width + width / 2, CELL);
      for (let y = 0; y < height; y += 4) {
        const half = snapToGrid(width * 0.7 * Math.sqrt(1 - (y / height) ** 2), CELL);
        g.fillStyle(body, 1);
        g.fillRect(cx - half, base - y - 4, half * 2, 4);
        g.fillStyle(shade, 1);
        g.fillRect(cx - half, base - y - 4, CELL * 3, 4);
        g.fillStyle(rim, 0.55);
        g.fillRect(cx + half - CELL * 2, base - y - 4, CELL * 2, 4);
      }
      g.fillStyle(rim, 0.8);
      g.fillRect(cx - snapToGrid(width * 0.12, CELL), base - height - 4, snapToGrid(width * 0.24, CELL), CELL);
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

  /**
   * Windsock at its sampling altitude. The sock art carries its own pole; a ground mast extends it down to the
   * ground in the same dark warm wood, while a ridge sock stands behind the roof so its pole rises from the ridge.
   */
  private createWindsock(x: number, altitude: number, mount: "mast" | "ridge"): void {
    const config = campaignLandingScenery.windsock;
    const scale = config.sockScale;
    const topY = snapToGrid(this.definition.pad.surfaceY - altitude, CELL);
    const artBottom = topY + (config.frameArtHeight - Math.max(...config.poleTopArtY)) * scale;
    if (mount === "mast" && artBottom < campaignLandingScenery.groundTopY) {
      const ground = campaignLandingScenery.groundTopY;
      const half = scale;
      const pole = this.track(this.scene.add.graphics().setDepth(depth.world + 1));
      pole.fillStyle(colorNumber(config.poleColor), 1);
      pole.fillRect(x - half, artBottom - scale * 2, half * 2, ground - artBottom + scale * 2);
      pole.fillStyle(colorNumber(config.poleShadow), 1);
      pole.fillRect(x, artBottom - scale * 2, half, ground - artBottom + scale * 2);
      pole.fillStyle(colorNumber(colors.ink), 1);
      pole.fillRect(x - half * 2, ground - CELL * 3, half * 4, CELL * 3);
    }
    const wind = this.definition.wind;
    const direction = wind.kind === "steady" ? wind.acceleration.x : wind.kind === "gust" ? wind.peakAcceleration.x : wind.kind === "bands" ? (altitude >= wind.splitAltitude ? wind.upper.x : wind.lower.x) : 1;
    // Art points right (blowing towards +x); mirrored for wind towards -x, keeping the pole on the same column.
    const sprite = this.track(
      this.scene.add
        .sprite(x, topY, config.key, CAMPAIGN_WINDSOCK_FRAME.calm)
        .setScale(scale)
        .setFlipX(direction < 0)
        .setDepth(mount === "ridge" ? depth.world - 0.5 : depth.world + 4),
    );
    const sock: Windsock = { sprite, altitude, mount, topY, direction, frame: CAMPAIGN_WINDSOCK_FRAME.calm };
    this.alignWindsock(sock);
    this.windsocks.push(sock);
  }

  private alignWindsock(sock: Windsock): void {
    const config = campaignLandingScenery.windsock;
    const anchor = windsockPlacement(sock.frame, sock.direction, sock.topY, campaignLandingScenery.groundTopY);
    sock.sprite.setOrigin(anchor.originX, anchor.originY);
    if (sock.mount === "mast") sock.sprite.setCrop(0, 0, config.frameArtWidth, anchor.cropRows);
  }

  /** A service window motivates the bust art: warm recess behind it, a solid frame and counter in front. */
  private createRecipientWindow(x: number): void {
    const config = campaignLandingScenery.recipientWindow;
    const left = x - config.width / 2;
    const bottom = this.greeterBaseY;
    const top = bottom - config.height;
    const back = this.track(this.scene.add.graphics().setDepth(depth.world + 2.75));
    back.fillStyle(colorNumber(this.theme.palette.light), 1);
    back.fillRect(left, top, config.width, config.height);
    back.fillStyle(mixHex(this.theme.palette.ground, colors.ink, 0.5), 1);
    back.fillRect(left + config.framePx, top + config.framePx, config.width - config.framePx * 2, config.height - config.framePx * 2);
    const frame = this.track(this.scene.add.graphics().setDepth(depth.world + 4));
    frame.fillStyle(colorNumber(colors.ink), 1);
    for (const px of [left, left + config.width - config.framePx]) frame.fillRect(px, top, config.framePx, config.height);
    frame.fillRect(left - CELL, top - CELL, config.width + CELL * 2, config.framePx);
    frame.fillRect(left - CELL * 2, bottom - CELL * 4, config.width + CELL * 4, config.railPx);
    frame.fillStyle(colorNumber(this.theme.palette.light), 1);
    frame.fillRect(left + CELL, top, config.width - CELL * 2, CELL);
    frame.fillRect(left - CELL, bottom - CELL * 4, config.width + CELL * 2, CELL * 2);
    frame.fillStyle(colorNumber(this.theme.palette.accent), 1);
    frame.fillRect(left, bottom - CELL * 2, config.width, config.railPx - CELL * 4);
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
    // The canopy shelters a parcel table, giving its tall posts a homecoming purpose.
    const table = campaignLandingScenery.welcomeTable;
    const tx = snapToGrid((x0 + x1 - table.width) / 2, CELL);
    const ty = ground - table.height;
    g.fillStyle(colorNumber(colors.ink), 1);
    g.fillRect(tx - CELL, ty - CELL, table.width + CELL * 2, CELL * 5);
    for (const px of [tx + CELL * 3, tx + table.width - CELL * 7]) g.fillRect(px, ty, CELL * 4, table.height);
    g.fillStyle(colorNumber(palette.light), 1);
    g.fillRect(tx, ty, table.width, CELL * 2);
    g.fillStyle(colorNumber(palette.accent), 1);
    g.fillRect(tx + CELL * 2, ty + CELL * 2, table.width - CELL * 4, CELL * 3);
    for (const [dx, w, h] of [[22, 38, 32], [76, 34, 24]] as const) {
      g.fillStyle(colorNumber(colors.ink), 1);
      g.fillRect(tx + dx - CELL, ty - h - CELL, w + CELL * 2, h + CELL);
      g.fillStyle(colorNumber(colors.parchment), 1);
      g.fillRect(tx + dx, ty - h, w, h);
      g.fillStyle(colorNumber(palette.accent), 1);
      g.fillRect(tx + dx + w / 2 - CELL, ty - h, CELL * 2, h);
      g.fillRect(tx + dx, ty - h + CELL * 4, w, CELL * 2);
    }
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
      // Behind the porch and berth (world, world + 2): flour drifts in the apron air, never over the building.
      const shape = this.track(this.scene.add.graphics().setDepth(depth.world - 1));
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

  /** Theme ambience (dust / fireflies / rain): one tiny Graphics per mote, moved per frame, never redrawn. */
  private createAmbient(ambient: NonNullable<CampaignLandingDecor["ambient"]>): void {
    let seed = 23;
    const next = (): number => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    const tint = ambient.color === "plaster" ? colorNumber(colors.parchment) : colorNumber(this.theme.palette[ambient.color]);
    for (let i = 0; i < ambient.count; i += 1) {
      const band = ambient.kind === "rain" ? depth.parallax + 3 : depth.world - 1;
      const shape = this.track(this.scene.add.graphics().setDepth(band));
      if (ambient.kind === "rain") {
        shape.fillStyle(tint, 1);
        shape.fillRect(0, 0, CELL, CELL * 6);
      } else if (ambient.kind === "firefly") {
        shape.fillStyle(tint, 0.35);
        shape.fillRect(-CELL, -CELL, CELL * 3, CELL * 3);
        shape.fillStyle(colorNumber(colors.parchment), 1);
        shape.fillRect(0, 0, CELL, CELL);
      } else {
        shape.fillStyle(tint, 1);
        shape.fillRect(0, 0, i % 3 === 0 ? CELL * 2 : CELL, CELL);
      }
      const x = ambient.kind === "firefly" ? 60 + next() * 1160 : next() * VIEW_WIDTH;
      this.motes.push({ shape, x, phase: next(), speed: 0.6 + next() * 0.8 });
    }
    this.updateAmbient(0, 0);
  }

  private updateAmbient(timeMs: number, windX: number): void {
    const kind = this.ambientKind;
    if (!kind) return;
    for (const mote of this.motes) {
      const at = ambientMotePosition(kind, mote, timeMs, windX);
      mote.shape.setPosition(snapToGrid(at.x, CELL), snapToGrid(at.y, CELL)).setAlpha(at.alpha);
    }
  }
}
