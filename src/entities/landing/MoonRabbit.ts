import Phaser from "phaser";
import { LANDING_ART_SCALE, landingScenery } from "../../data/landingScenery";
import { depth, motion } from "../../game/designTokens";

/** The tea house rabbit: breathes while waiting, waves at good landings, hops in surprise at incidents. */
export class MoonRabbit {
  private readonly scene: Phaser.Scene;
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly baseY: number;

  constructor(scene: Phaser.Scene, surfaceY: number) {
    this.scene = scene;
    const config = landingScenery.rabbit;
    this.baseY = surfaceY + config.baseSinkPx;
    ensureAnimations(scene);

    this.sprite = scene.add
      .sprite(config.x, this.baseY, config.key, config.idleFrames[0])
      .setOrigin(0.5, 1)
      .setScale(LANDING_ART_SCALE)
      .setFlipX(config.flipX)
      .setDepth(depth.world + 3);
    this.idle();
  }

  idle(): void {
    this.scene.tweens.killTweensOf(this.sprite);
    this.sprite.setY(this.baseY);
    this.sprite.play(landingScenery.rabbit.idleAnimKey, true);
  }

  /** Waves after a short beat so the touchdown dust reads first. */
  wave(): void {
    const config = landingScenery.rabbit;
    this.scene.time.delayedCall(config.waveDelayMs, () => {
      this.sprite.play(config.waveAnimKey, true);
      this.scene.tweens.add({
        targets: this.sprite,
        y: this.baseY - config.hopHeightPx / 2,
        duration: motion.base,
        yoyo: true,
        ease: "Quad.easeOut",
      });
    });
  }

  /** Comedic little startle jump at an incident. */
  startle(): void {
    const config = landingScenery.rabbit;
    this.scene.tweens.killTweensOf(this.sprite);
    this.sprite.setY(this.baseY);
    this.scene.tweens.add({
      targets: this.sprite,
      y: this.baseY - config.hopHeightPx,
      duration: motion.fast,
      yoyo: true,
      repeat: 1,
      ease: "Quad.easeOut",
    });
  }
}

function ensureAnimations(scene: Phaser.Scene): void {
  const config = landingScenery.rabbit;
  if (!scene.anims.exists(config.idleAnimKey)) {
    scene.anims.create({
      key: config.idleAnimKey,
      frames: scene.anims.generateFrameNumbers(config.key, { frames: [...config.idleFrames] }),
      frameRate: config.idleFrameRate,
      repeat: -1,
    });
  }
  if (!scene.anims.exists(config.waveAnimKey)) {
    scene.anims.create({
      key: config.waveAnimKey,
      frames: scene.anims.generateFrameNumbers(config.key, { frames: [...config.waveFrames] }),
      frameRate: config.waveFrameRate,
      repeat: -1,
    });
  }
}
