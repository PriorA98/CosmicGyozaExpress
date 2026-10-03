import Phaser from "phaser";
import {
  FLIGHT_ART_SCALE,
  debrisStyle,
  debrisTextureKey,
  fallbackStarfield,
  flightCelestialBodies,
  flightDebris,
  flightParallaxLayers,
  campaignBackdropProps,
  type ParallaxLayerDefinition,
} from "../../data/flightScenery";
import { colorNumber, colors, depth } from "../../game/designTokens";
import type { CampaignThemeDefinition } from "../../data/campaign/themes";
import type { Point } from "../../types/flight";
import { isReducedMotion } from "../../fx/feedback";
import { ensureVerticalMirrorTile } from "./pixelArt";
import { ensureStandInStarTile, isFallbackTexture, planetTextureOrStandIn } from "./textureFallbacks";

type ParallaxLayer = {
  readonly definition: ParallaxLayerDefinition;
  readonly sprite: Phaser.GameObjects.TileSprite;
};

const QUARTER_TURN_DEGREES = 90;

/**
 * Layered, calm space backdrop for route flight: tiling star/nebula layers that follow the
 * camera at fractional speeds, distant celestial bodies, and slow non-colliding debris.
 * Everything here is visual only and sits below the world depth band.
 *
 * Every layer is a viewport-sized TileSprite that repeats in both axes (the nebula via a
 * vertically mirrored copy), so no camera position can expose an uncovered strip.
 */
export class SpaceBackdrop {
  private readonly layers: ParallaxLayer[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly worldHeight: number,
    private readonly theme?: CampaignThemeDefinition,
    start?: Point,
  ) {
    scene.cameras.main.setBackgroundColor(colors.cosmos);
    flightParallaxLayers.forEach((definition, index) => this.createLayer(definition, index));
    if (!theme) { this.createCelestialBodies(); this.createDebris(); }
    else this.createCampaignProps(start ?? { x: 320, y: worldHeight / 2 });
  }

  /** Call every frame after the camera has moved. */
  update(timeMs: number): void {
    const camera = this.scene.cameras.main;
    const centredScrollY = (this.worldHeight - this.scene.scale.height) / 2;

    for (const { definition, sprite } of this.layers) {
      const driftX = (definition.driftX * timeMs) / 1000;
      sprite.tilePositionX = snapToScreenPixel((camera.scrollX * definition.scrollFactorX) / FLIGHT_ART_SCALE + driftX);
      // Mirror layers are anchored so the authored (unflipped) half is framed at the centred scroll.
      const scrollY = definition.mode === "mirror" ? camera.scrollY - centredScrollY : camera.scrollY;
      sprite.tilePositionY = snapToScreenPixel((scrollY * definition.scrollFactorY) / FLIGHT_ART_SCALE);
    }
  }

  private createLayer(definition: ParallaxLayerDefinition, index: number): void {
    const { width, height } = this.scene.scale;
    let textureKey: string = definition.textureKey;

    if (isFallbackTexture(this.scene, definition.textureKey)) {
      if (definition.fallbackStars <= 0) return;
      const source = this.scene.textures.get(definition.textureKey).getSourceImage();
      textureKey = ensureStandInStarTile(this.scene, {
        key: `${definition.textureKey}--stand-in`,
        width: source.width,
        height: source.height,
        count: definition.fallbackStars,
        seed: fallbackStarfield.seed + index,
        palette: fallbackStarfield.colors,
        alphaMin: fallbackStarfield.alphaMin,
        alphaMax: fallbackStarfield.alphaMax,
      });
    } else if (definition.mode === "mirror") {
      textureKey = ensureVerticalMirrorTile(this.scene, definition.textureKey, `${definition.textureKey}--mirror`);
    }

    const sprite = this.scene.add
      .tileSprite(0, 0, Math.ceil(width / FLIGHT_ART_SCALE) + 2, Math.ceil(height / FLIGHT_ART_SCALE) + 2, textureKey)
      .setOrigin(0, 0)
      .setScale(FLIGHT_ART_SCALE)
      .setScrollFactor(0)
      .setAlpha(definition.alpha)
      .setDepth(depth.backdrop + index * 0.1);
    if (this.theme) sprite.setTint(colorNumber(this.theme.palette.skyBottom));

    this.layers.push({ definition, sprite });
  }

  private createCampaignProps(start: Point): void {
    const theme = this.theme;
    if (!theme) return;
    const prop = campaignBackdropProps[theme.id];
    for (let i = 0; i < 2; i += 1) {
      const x = 580 + i * 440;
      const y = Math.round((start.y - this.scene.scale.height / 2) * 0.4 + 220 + i * 170);
      const g = this.scene.add.graphics().setPosition(x, y).setScrollFactor(0.4).setDepth(depth.parallax).setAlpha(0.72);
      g.fillStyle(colorNumber(theme.palette.accent), 1);
      if (prop === "lunch-crate") {
        g.fillRect(-28, -18, 56, 36); g.fillStyle(colorNumber(theme.palette.light), 1).fillRect(-30, -20, 60, 4).fillRect(-4, -18, 8, 36);
        g.fillStyle(colorNumber(theme.palette.skyTop), 1).fillRect(-22, -10, 16, 12).fillRect(8, -10, 14, 12);
      } else if (prop === "tea-leaf") {
        for (let row = -14; row <= 14; row += 2) { const half = 26 - Math.abs(row); g.fillRect(-half, row, half * 2, 2); }
        g.fillStyle(colorNumber(theme.palette.light), 0.8).fillRect(-22, 0, 44, 2);
      } else if (prop === "flour-comet") {
        g.fillStyle(colorNumber(theme.palette.light), 0.5);
        for (let t = 0; t < 7; t += 1) g.fillRect(-t * 12, t * 2, 10 - t, 4);
        g.fillStyle(colorNumber(theme.palette.light), 1).fillRect(-4, -6, 16, 12).fillRect(0, -10, 8, 20);
      } else if (prop === "rain") {
        for (let t = 0; t < 9; t += 1) { const rx = (t % 3) * 32; const ry = Math.floor(t / 3) * 28; g.fillRect(rx, ry, 2, 14); g.fillRect(rx - 2, ry + 14, 2, 6); }
      } else if (prop === "ribbon-lantern") {
        g.fillRect(-16, -20, 32, 36); g.fillStyle(colorNumber(theme.palette.light), 1).fillRect(-10, -14, 20, 24);
        g.fillStyle(colorNumber(theme.palette.accent), 1).fillRect(-6, 16, 4, 36).fillRect(4, 16, 4, 26);
      }
      if (!isReducedMotion()) {
        const drift = { offset: 0 };
        this.scene.tweens.add({ targets: drift, offset: 12, duration: 4500 + i * 1100, ease: "Sine.easeInOut", yoyo: true, repeat: -1, onUpdate: () => g.setY(y + snapToArtStep(drift.offset)) });
      }
    }
  }

  private createCelestialBodies(): void {
    flightCelestialBodies.forEach((body, index) => {
      // Opaque, tinted toward the sky for depth; they sit above every star layer.
      const image = this.scene.add
        .image(body.x, body.y, planetTextureOrStandIn(this.scene, body.textureKey, body.standIn))
        .setScale(body.scale)
        .setScrollFactor(body.scrollFactor)
        .setTint(colorNumber(body.tint))
        .setDepth(depth.parallax + index * 0.1);

      // Drift in whole art pixels so the planet never sits between grid steps.
      const drift = { t: 0 };
      this.scene.tweens.add({
        targets: drift,
        t: 1,
        duration: body.driftPeriodMs / 2,
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1,
        onUpdate: () => image.setY(body.y + snapToArtStep(drift.t * body.driftPx)),
      });
    });
  }

  private createDebris(): void {
    for (const bit of flightDebris) {
      const image = this.scene.add
        .image(bit.x, bit.y, debrisTextureKey, bit.frame)
        .setScale(FLIGHT_ART_SCALE)
        .setScrollFactor(bit.scrollFactor)
        .setTint(colorNumber(debrisStyle.tints[bit.tint % debrisStyle.tints.length] ?? colors.plum))
        .setDepth(depth.parallax + 1);

      const drift = { t: 0 };
      this.scene.tweens.add({
        targets: drift,
        t: 1,
        duration: bit.driftPeriodMs / 2,
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1,
        onUpdate: () => image.setPosition(bit.x + snapToArtStep(drift.t * bit.driftX), bit.y + snapToArtStep(drift.t * bit.driftY)),
      });

      if (bit.tumbleMs > 0) {
        this.scene.time.addEvent({
          delay: bit.tumbleMs,
          loop: true,
          callback: () => image.setAngle((image.angle + QUARTER_TURN_DEGREES) % 360),
        });
      }
    }
  }
}

/** Tile offsets are in art pixels; snap to half an art pixel (= one screen pixel at 2x). */
function snapToScreenPixel(artPx: number): number {
  return Math.round(artPx * FLIGHT_ART_SCALE) / FLIGHT_ART_SCALE;
}

/** Snaps a screen-px offset to whole art pixels (multiples of the art scale). */
function snapToArtStep(screenPx: number): number {
  return Math.round(screenPx / FLIGHT_ART_SCALE) * FLIGHT_ART_SCALE;
}
