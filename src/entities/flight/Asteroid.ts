import Phaser from "phaser";
import { asteroidArt, type AsteroidVisualDefinition } from "../../data/flightScenery";
import { colorNumber, depth } from "../../game/designTokens";
import type { CollisionSeverity, StaticObstacleDefinition } from "../../types/flight";

type BumpSeverity = Exclude<CollisionSeverity, "none">;

const TAU = Math.PI * 2;

/**
 * A soft route asteroid. Collision stays in CollisionSystem (circle at the obstacle centre with
 * the obstacle radius); this entity only draws the rock so its visible body matches that circle,
 * gives it a sleepy bob/wobble, and reacts with a squash + flash when bumped.
 */
export class Asteroid {
  readonly id: string;
  private readonly image: Phaser.GameObjects.Image;
  private readonly baseScale: number;
  private readonly phase: number;
  private squash = 0;
  private nudgeX = 0;
  private nudgeY = 0;
  private flashUntilMs = 0;
  private reactionTween: Phaser.Tweens.Tween | undefined;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly obstacle: StaticObstacleDefinition,
    private readonly visual: AsteroidVisualDefinition | undefined,
    index: number,
  ) {
    this.id = obstacle.id;
    const bodyArtPx = asteroidArt.canvasPx * asteroidArt.bodyFillRatio;
    this.baseScale = (obstacle.radius * 2) / bodyArtPx;
    this.phase = (index * 0.37) % 1;

    this.image = scene.add
      .image(obstacle.x, obstacle.y, visual?.textureKey ?? asteroidArt.fallbackTextureKey)
      .setScale(this.baseScale)
      .setFlipX(visual?.flipX ?? false)
      .setDepth(depth.world + index * 0.01);
  }

  /** Visual-only idle motion and reaction easing. Never moves the collision circle. */
  update(timeMs: number): void {
    const bobPx = this.visual?.bobPx ?? 0;
    const bobPeriod = this.visual?.bobPeriodMs ?? 1;
    const wobbleDegrees = this.visual?.wobbleDegrees ?? 0;
    const wobblePeriod = this.visual?.wobblePeriodMs ?? 1;

    const bob = Math.sin((timeMs / bobPeriod + this.phase) * TAU) * bobPx;
    const wobble = Math.sin((timeMs / wobblePeriod + this.phase * 2) * TAU) * wobbleDegrees;

    this.image.setPosition(this.obstacle.x + this.nudgeX, this.obstacle.y + bob + this.nudgeY);
    this.image.setAngle(wobble);
    this.image.setScale(this.baseScale * (1 + this.squash), this.baseScale * (1 - this.squash));

    if (this.flashUntilMs > 0 && timeMs >= this.flashUntilMs) {
      this.flashUntilMs = 0;
      this.image.clearTint();
      this.image.setTintMode(Phaser.TintModes.MULTIPLY);
    }
  }

  /** Squash away from the hit, brief warm flash, tiny nudge along the contact normal. */
  react(severity: BumpSeverity, normalX: number, normalY: number, timeMs: number): void {
    const nudge = asteroidArt.nudgePx[severity];
    const squashAmount = asteroidArt.squashScale * (severity === "soft-bump" ? 0.6 : 1);

    this.reactionTween?.stop();
    this.squash = squashAmount;
    this.nudgeX = -normalX * nudge;
    this.nudgeY = -normalY * nudge;
    this.reactionTween = this.scene.tweens.add({
      targets: this,
      squash: 0,
      nudgeX: 0,
      nudgeY: 0,
      duration: asteroidArt.squashMs * 3,
      ease: "Back.easeOut",
    });

    this.image.setTint(colorNumber(asteroidArt.flashColor)).setTintMode(Phaser.TintModes.FILL);
    this.flashUntilMs = timeMs + asteroidArt.flashMs;
  }

  destroy(): void {
    this.reactionTween?.stop();
    this.image.destroy();
  }
}
