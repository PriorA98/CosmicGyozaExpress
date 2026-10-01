import type Phaser from "phaser";
import { FLIGHT_ART_SCALE, teaMoonScenery } from "../../data/flightScenery";
import { depth, motion } from "../../game/designTokens";
import { ensurePixelHalo } from "./pixelArt";
import { planetTextureOrStandIn } from "./textureFallbacks";

const HALO_TEXTURE_KEY = "flight-tea-moon-halo";

/**
 * The Tea Moon destination body: pixel-art moon at 2x with a stepped pixel halo that breathes.
 * Sits in the world band just behind the delivery ring so the ring hugs its left limb.
 */
export class TeaMoon {
  private readonly halo: Phaser.GameObjects.Image;
  private readonly moon: Phaser.GameObjects.Image;
  private readonly bodyX: number;
  private readonly bodyY: number;

  constructor(scene: Phaser.Scene) {
    const { x, y, haloSteps, haloAlpha, haloColor } = teaMoonScenery;
    const textureKey = planetTextureOrStandIn(scene, teaMoonScenery.textureKey, teaMoonScenery.standIn);
    const body = textureKey === teaMoonScenery.textureKey ? teaMoonScenery.artBody : teaMoonScenery.standInBody;
    this.bodyX = x + body.offsetX;
    this.bodyY = y + body.offsetY;

    const haloKey = ensurePixelHalo(scene, {
      key: `${HALO_TEXTURE_KEY}-${body.radius}`,
      radius: body.radius / FLIGHT_ART_SCALE,
      steps: haloSteps,
      color: haloColor,
      alphaPerStep: haloAlpha,
    });
    this.halo = scene.add
      // Snapped to the moon's art grid so halo steps line up with the moon's pixels.
      .image(snapEven(this.bodyX), snapEven(this.bodyY), haloKey)
      .setScale(FLIGHT_ART_SCALE)
      .setDepth(depth.world - 0.6);

    this.moon = scene.add
      .image(x, y, textureKey)
      .setScale(teaMoonScenery.scale)
      .setDepth(depth.world - 0.5);

    scene.tweens.add({
      targets: this.halo,
      alpha: 1 - teaMoonScenery.breathAlpha,
      duration: motion.breath,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });
  }

  get image(): Phaser.GameObjects.Image {
    return this.moon;
  }

  /** World-space centre of the visible moon body (the halo centre). */
  get bodyCenter(): { readonly x: number; readonly y: number } {
    return { x: this.bodyX, y: this.bodyY };
  }
}

function snapEven(value: number): number {
  return Math.round(value / FLIGHT_ART_SCALE) * FLIGHT_ART_SCALE;
}
