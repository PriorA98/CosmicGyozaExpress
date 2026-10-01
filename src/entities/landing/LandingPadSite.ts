import Phaser from "phaser";
import { LANDING_ART_SCALE, landingScenery } from "../../data/landingScenery";
import { colorNumber, colors, depth, motion } from "../../game/designTokens";
import type { LandingPadDefinition } from "../../types/landing";
import { createSoftGlow } from "./softGlow";

type Lantern = {
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly glow: Phaser.GameObjects.Graphics;
};

/**
 * The Tea Moon landing blanket: pad art, a lantern at each end, a soft guide light over the pad,
 * and corner brackets that turn sage when the ship is lined up over the pad.
 */
export class LandingPadSite {
  private readonly scene: Phaser.Scene;
  private readonly pad: LandingPadDefinition;
  private readonly lanterns: Lantern[] = [];
  private readonly beam: Phaser.GameObjects.Graphics;
  private readonly brackets: Phaser.GameObjects.Graphics;
  private beamAlphaTween: Phaser.Tweens.Tween | undefined;
  private aligned: boolean | undefined;
  private lit = false;

  constructor(scene: Phaser.Scene, pad: LandingPadDefinition) {
    this.scene = scene;
    this.pad = pad;
    const art = LANDING_ART_SCALE;

    this.beam = this.createGuideLight();

    const padConfig = landingScenery.pad;
    const padImage = scene.add
      .image(pad.centerX, pad.surfaceY - padConfig.surfaceRowArtPx * art, padConfig.key)
      .setOrigin(0.5, 0)
      .setScale(art)
      .setDepth(depth.world + 2);

    const lanternConfig = landingScenery.lanterns;
    const halfPadArt = padImage.displayWidth / 2;
    for (const side of [-1, 1] as const) {
      const x = pad.centerX + side * (halfPadArt + lanternConfig.outsetFromPadEnd);
      const baseY = pad.surfaceY + lanternConfig.baseSinkPx;
      const glow = createSoftGlow(scene, lanternConfig.glowRadius, colors.ember, lanternConfig.glowRings)
        .setPosition(x, baseY - lanternConfig.lampHeightPx)
        .setAlpha(lanternConfig.glowDimAlpha)
        .setDepth(depth.world + 3);
      const sprite = scene.add
        .sprite(x, baseY, lanternConfig.key, lanternConfig.dimFrame)
        .setOrigin(0.5, 1)
        .setScale(art)
        .setDepth(depth.world + 3);
      this.lanterns.push({ sprite, glow });
    }

    this.brackets = scene.add.graphics().setDepth(depth.world + 4);
    this.setAligned(false);
  }

  /** Brightens the guide light and turns the pad brackets sage while the ship is over the pad. */
  setAligned(aligned: boolean): void {
    if (this.aligned === aligned) return;
    this.aligned = aligned;
    this.drawBrackets(aligned);

    const guide = landingScenery.guideLight;
    this.tweenBeamAlpha(aligned ? guide.alignedIntensity : guide.idleIntensity, motion.slow);
  }

  /** Lights both lanterns one after the other with a small warm pop. */
  lightLanterns(): void {
    if (this.lit) return;
    this.lit = true;
    const config = landingScenery.lanterns;

    this.lanterns.forEach((lantern, index) => {
      this.scene.time.delayedCall(index * config.lightStaggerMs, () => {
        lantern.sprite.setFrame(config.litFrame);
        this.scene.tweens.killTweensOf(lantern.glow);
        lantern.glow.setScale(0.4).setAlpha(config.glowLitAlpha * 1.6);
        this.scene.tweens.add({
          targets: lantern.glow,
          scale: 1,
          alpha: config.glowLitAlpha,
          duration: motion.slow,
          ease: "Back.easeOut",
        });
        this.scene.tweens.add({
          targets: lantern.sprite,
          scaleY: LANDING_ART_SCALE * 1.12,
          duration: motion.fast,
          yoyo: true,
          ease: "Quad.easeOut",
        });
      });
    });

    this.fadeGuideLight();
  }

  /** Back to the waiting state for a landing retry. */
  reset(): void {
    this.lit = false;
    const config = landingScenery.lanterns;
    for (const lantern of this.lanterns) {
      this.scene.tweens.killTweensOf(lantern.glow);
      this.scene.tweens.killTweensOf(lantern.sprite);
      lantern.sprite.setFrame(config.dimFrame).setScale(LANDING_ART_SCALE);
      lantern.glow.setScale(1).setAlpha(config.glowDimAlpha);
    }
    this.brackets.setVisible(true);
    this.aligned = undefined;
    this.setAligned(false);
  }

  private fadeGuideLight(): void {
    this.tweenBeamAlpha(landingScenery.guideLight.landedIntensity, motion.slow * 2);
    this.brackets.setVisible(false);
  }

  private tweenBeamAlpha(alpha: number, duration: number): void {
    this.beamAlphaTween?.stop();
    this.beamAlphaTween = this.scene.tweens.add({ targets: this.beam, alpha, duration, ease: "Sine.easeOut" });
  }

  private createGuideLight(): Phaser.GameObjects.Graphics {
    const guide = landingScenery.guideLight;
    const beam = this.scene.add.graphics().setDepth(depth.parallax + 1).setBlendMode(Phaser.BlendModes.ADD);
    const color = colorNumber(guide.color);
    const baseHalf = (this.pad.width * guide.baseWidthRatio) / 2;
    const topHalf = (this.pad.width * guide.topWidthRatio) / 2;

    // Drawn in pad-local space (origin on the pad surface centre) so the breathing scale grows upward.
    // Stacked translucent wedges, each narrower and shorter: a soft-edged beam with no texture.
    for (let band = 0; band < guide.bands; band += 1) {
      const t = band / guide.bands;
      const top = -guide.height * (1 - t * 0.55);
      const bottomHalf = baseHalf * (1 - t * 0.6);
      const upperHalf = topHalf * (1 - t * 0.7);
      beam.fillStyle(color, guide.bandAlpha);
      beam.fillPoints(
        [
          new Phaser.Math.Vector2(-bottomHalf, 0),
          new Phaser.Math.Vector2(bottomHalf, 0),
          new Phaser.Math.Vector2(upperHalf, top),
          new Phaser.Math.Vector2(-upperHalf, top),
        ],
        true,
      );
    }

    beam.setPosition(this.pad.centerX, this.pad.surfaceY).setAlpha(guide.idleIntensity);
    this.scene.tweens.add({
      targets: beam,
      scaleY: 1.03,
      duration: guide.breathMs / 2,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    return beam;
  }

  private drawBrackets(aligned: boolean): void {
    const config = landingScenery.padBrackets;
    const color = colorNumber(aligned ? colors.sage : colors.ember);
    const alpha = aligned ? config.alignedAlpha : config.unalignedAlpha;
    const left = this.pad.centerX - this.pad.width / 2 + config.insetPx;
    const right = this.pad.centerX + this.pad.width / 2 - config.insetPx;
    const y = this.pad.surfaceY - config.liftPx;
    const arm = config.armPx;

    this.brackets.clear();
    this.brackets.lineStyle(config.lineWidth, color, alpha);
    this.brackets.beginPath();
    this.brackets.moveTo(left + arm, y);
    this.brackets.lineTo(left, y);
    this.brackets.lineTo(left, y - arm);
    this.brackets.moveTo(right - arm, y);
    this.brackets.lineTo(right, y);
    this.brackets.lineTo(right, y - arm);
    this.brackets.strokePath();
  }
}

