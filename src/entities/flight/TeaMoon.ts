import type Phaser from "phaser";
import { teaMoonScenery } from "../../data/flightScenery";
import { colorNumber, depth, motion } from "../../game/designTokens";

/**
 * The Tea Moon destination body: pixel-art moon at 2x with a soft stepped halo that breathes.
 * Sits in the world band just behind the delivery ring so the ring hugs its left limb.
 */
export class TeaMoon {
  private readonly halo: Phaser.GameObjects.Graphics;
  private readonly moon: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene) {
    const { x, y, bodyRadius, haloSteps, haloAlpha, haloColor } = teaMoonScenery;

    this.halo = scene.add.graphics().setDepth(depth.world - 0.6);
    const color = colorNumber(haloColor);
    for (const step of haloSteps) {
      this.halo.fillStyle(color, haloAlpha);
      this.halo.fillCircle(x, y, bodyRadius + step);
    }

    this.moon = scene.add
      .image(x, y, teaMoonScenery.textureKey)
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
}
