import Phaser from "phaser";
import {
  FLIGHT_ART_SCALE,
  debrisTextureKey,
  fallbackStarfield,
  flightCelestialBodies,
  flightDebris,
  flightParallaxLayers,
  type ParallaxLayerDefinition,
} from "../../data/flightScenery";
import { colorNumber, colors, depth } from "../../game/designTokens";
import { ensureStandInStarTile, isFallbackTexture } from "./textureFallbacks";

type ParallaxLayer = {
  readonly definition: ParallaxLayerDefinition;
  readonly sprite: Phaser.GameObjects.TileSprite;
  readonly textureHeight: number;
};

const MS_PER_MINUTE = 60_000;
const FULL_TURN_DEGREES = 360;

/**
 * Layered, calm space backdrop for route flight: tiling star/nebula layers that follow the
 * camera at fractional speeds, distant celestial bodies, and slow non-colliding debris.
 * Everything here is visual only and sits below the world depth band.
 */
export class SpaceBackdrop {
  private readonly layers: ParallaxLayer[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly worldHeight: number,
  ) {
    scene.cameras.main.setBackgroundColor(colors.cosmos);
    flightParallaxLayers.forEach((definition, index) => this.createLayer(definition, index));
    this.createCelestialBodies();
    this.createDebris();
  }

  /** Call every frame after the camera has moved. */
  update(timeMs: number): void {
    const camera = this.scene.cameras.main;
    const viewHeight = this.scene.scale.height;
    const centredScrollY = (this.worldHeight - viewHeight) / 2;

    for (const layer of this.layers) {
      const { definition, sprite } = layer;
      const driftX = (definition.driftX * timeMs) / 1000;
      const tileX = (camera.scrollX * definition.scrollFactorX) / FLIGHT_ART_SCALE + driftX;
      sprite.tilePositionX = snapToScreenPixel(tileX);

      if (definition.mode === "tile") {
        sprite.tilePositionY = snapToScreenPixel((camera.scrollY * definition.scrollFactorY) / FLIGHT_ART_SCALE);
      } else {
        const bandHeight = layer.textureHeight * FLIGHT_ART_SCALE;
        const offset = (camera.scrollY - centredScrollY) * definition.scrollFactorY;
        sprite.y = Math.round((viewHeight - bandHeight) / 2 - offset);
      }
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
    }

    const textureHeight = this.scene.textures.get(textureKey).getSourceImage().height;
    const tileWidth = Math.ceil(width / FLIGHT_ART_SCALE) + 2;
    const tileHeight = definition.mode === "tile" ? Math.ceil(height / FLIGHT_ART_SCALE) + 2 : textureHeight;

    const sprite = this.scene.add
      .tileSprite(0, 0, tileWidth, tileHeight, textureKey)
      .setOrigin(0, 0)
      .setScale(FLIGHT_ART_SCALE)
      .setScrollFactor(0)
      .setAlpha(definition.alpha)
      .setDepth(depth.backdrop + index * 0.1);

    this.layers.push({ definition, sprite, textureHeight });
  }

  private createCelestialBodies(): void {
    flightCelestialBodies.forEach((body, index) => {
      const image = this.scene.add
        .image(body.x, body.y, body.textureKey)
        .setScale(body.scale)
        .setScrollFactor(body.scrollFactor)
        .setAlpha(body.alpha)
        .setTint(colorNumber(body.tint))
        .setDepth(depth.parallax + index * 0.1);

      this.scene.tweens.add({
        targets: image,
        y: body.y + body.driftPx,
        duration: body.driftPeriodMs / 2,
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1,
      });
    });
  }

  private createDebris(): void {
    for (const bit of flightDebris) {
      const image = this.scene.add
        .image(bit.x, bit.y, debrisTextureKey, bit.frame)
        .setScale(bit.scale)
        .setScrollFactor(bit.scrollFactor)
        .setAlpha(bit.alpha)
        .setTint(colorNumber(colors.duskBlue))
        .setDepth(depth.parallax + 1);

      this.scene.tweens.add({
        targets: image,
        x: bit.x + bit.driftX,
        y: bit.y + bit.driftY,
        duration: bit.driftPeriodMs / 2,
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1,
      });

      if (bit.spinRpm !== 0) {
        this.scene.tweens.add({
          targets: image,
          angle: Math.sign(bit.spinRpm) * FULL_TURN_DEGREES,
          duration: MS_PER_MINUTE / Math.abs(bit.spinRpm),
          repeat: -1,
        });
      }
    }
  }
}

/** Tile offsets are in art pixels; snap to half an art pixel (= one screen pixel at 2x). */
function snapToScreenPixel(artPx: number): number {
  return Math.round(artPx * FLIGHT_ART_SCALE) / FLIGHT_ART_SCALE;
}
