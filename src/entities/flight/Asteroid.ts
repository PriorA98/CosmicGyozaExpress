import Phaser from "phaser";
import { FLIGHT_ART_SCALE, asteroidArt, type AsteroidVisualDefinition } from "../../data/flightScenery";
import { colorNumber, depth } from "../../game/designTokens";
import type { CollisionSeverity, StaticObstacleDefinition } from "../../types/flight";
import { contractScale } from "./pixelArt";

type BumpSeverity = Exclude<CollisionSeverity, "none">;

const TAU = Math.PI * 2;

/**
 * A soft route asteroid. Collision stays in CollisionSystem (circle at the obstacle centre with
 * the obstacle radius); this entity only draws the rock so its visible body matches that circle,
 * gives it a sleepy whole-art-pixel bob, and reacts with a squash + flash when bumped.
 *
 * Contract art is authored per rock (body diameter in art px == obstacle radius) and shown at
 * exactly 2x with no rotation, so every rock shares the scene's pixel density.
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
  private flashSettleAtMs = 0;
  private reactionTween: Phaser.Tweens.Tween | undefined;
  private baseX: number;
  private baseY: number;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly obstacle: StaticObstacleDefinition,
    private readonly visual: AsteroidVisualDefinition | undefined,
    index: number,
  ) {
    this.id = obstacle.id;
    this.baseX = obstacle.x;
    this.baseY = obstacle.y;
    const textureKey = visual?.textureKey ?? asteroidArt.fallbackTextureKey;
    const legacyScale = (obstacle.radius * 2) / (asteroidArt.legacyCanvasPx * asteroidArt.legacyBodyFillRatio);
    this.baseScale = contractScale(scene, textureKey, legacyScale);
    this.phase = (index * 0.37) % 1;

    this.image = scene.add
      .image(obstacle.x, obstacle.y, textureKey)
      .setScale(this.baseScale)
      .setFlipX(visual?.flipX ?? false)
      .setDepth(depth.world + index * 0.01);
  }

  /** Visual-only idle motion and reaction easing. Never moves the collision circle. */
  update(timeMs: number): void {
    const bobArtPx = this.visual?.bobArtPx ?? 0;
    const bobPeriod = this.visual?.bobPeriodMs ?? 1;
    const bob = Math.round(Math.sin((timeMs / bobPeriod + this.phase) * TAU) * bobArtPx) * FLIGHT_ART_SCALE;

    this.image.setPosition(this.baseX + Math.round(this.nudgeX), this.baseY + bob + Math.round(this.nudgeY));
    if (this.squash !== 0) {
      this.image.setScale(this.baseScale * (1 + this.squash), this.baseScale * (1 - this.squash));
    } else if (this.image.scaleX !== this.baseScale || this.image.scaleY !== this.baseScale) {
      this.image.setScale(this.baseScale);
    }

    if (this.flashSettleAtMs > 0 && timeMs >= this.flashSettleAtMs) {
      this.flashSettleAtMs = 0;
      this.image.setTint(colorNumber(asteroidArt.flashSettleColor));
    }
    if (this.flashUntilMs > 0 && timeMs >= this.flashUntilMs) {
      this.flashUntilMs = 0;
      this.flashSettleAtMs = 0;
      this.image.clearTint();
      this.image.setTintMode(Phaser.TintModes.MULTIPLY);
    }
  }

  /**
   * Moving rocks: the scene places the body at the sampled path position each frame (whole screen
   * pixels), so the drawn rock always sits on its collision circle. Static rocks never call this.
   */
  moveTo(x: number, y: number): void {
    this.baseX = Math.round(x);
    this.baseY = Math.round(y);
  }

  /** Squash away from the hit, brief two-step warm flash, tiny nudge along the contact normal. */
  react(severity: BumpSeverity, normalX: number, normalY: number, timeMs: number): void {
    const nudge = asteroidArt.nudgePx[severity];
    const squashAmount = asteroidArt.squashScale * (severity === "soft-bump" ? 0.7 : 1);

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
      onComplete: () => {
        this.squash = 0;
      },
    });

    this.image.setTint(colorNumber(asteroidArt.flashColor)).setTintMode(Phaser.TintModes.SCREEN);
    this.flashSettleAtMs = timeMs + asteroidArt.flashPeakMs;
    this.flashUntilMs = timeMs + asteroidArt.flashMs;
  }

  destroy(): void {
    this.reactionTween?.stop();
    this.image.destroy();
  }
}
