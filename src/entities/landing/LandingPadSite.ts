import Phaser from "phaser";
import { LANDING_ART_SCALE, landingScenery } from "../../data/landingScenery";
import { colorNumber, colors, depth, motion } from "../../game/designTokens";
import type { LandingPadDefinition } from "../../types/landing";
import { drawSteppedGlow, snapToGrid } from "./pixelShapes";

type Lantern = {
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly glow: Phaser.GameObjects.Graphics;
};

/**
 * The Tea Moon landing blanket: pad art, a lantern at each end with a hard-edged pixel glow, a stepped
 * guide light over the pad, and corner brackets that turn sage when the ship is lined up over the pad.
 * Everything is drawn on the art-pixel grid so it sits with the pixel scenery.
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
      const x = snapToGrid(pad.centerX + side * (halfPadArt + lanternConfig.outsetFromPadEnd), art);
      const baseY = pad.surfaceY + lanternConfig.baseSinkPx;
      const glow = scene.add
        .graphics()
        .setBlendMode(Phaser.BlendModes.ADD)
        .setPosition(x, snapToGrid(baseY - lanternConfig.lampHeightPx, art))
        .setAlpha(lanternConfig.glowDimAlpha)
        .setDepth(depth.world + 3);
      drawSteppedGlow(
        glow,
        lanternConfig.glowRadiusX,
        lanternConfig.glowRadiusY,
        lanternConfig.glowRings,
        colorNumber(colors.ember),
        lanternConfig.glowRingAlpha,
        art,
      );
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

  /** Lights both lanterns one after the other with a small warm pop (alpha only: the glow stays on the grid). */
  lightLanterns(): void {
    if (this.lit) return;
    this.lit = true;
    const config = landingScenery.lanterns;

    this.lanterns.forEach((lantern, index) => {
      this.scene.time.delayedCall(index * config.lightStaggerMs, () => {
        lantern.sprite.setFrame(config.litFrame);
        this.scene.tweens.killTweensOf(lantern.glow);
        lantern.glow.setAlpha(config.glowLitAlpha);
        this.scene.tweens.add({
          targets: lantern.glow,
          alpha: { from: config.glowLitAlpha, to: config.glowLitAlpha * 0.8 },
          duration: motion.slow,
          yoyo: true,
          ease: "Sine.easeInOut",
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
      lantern.sprite.setFrame(config.dimFrame);
      lantern.glow.setAlpha(config.glowDimAlpha);
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

  /**
   * Nested stepped wedges, each narrower and shorter, drawn in pad-local space (origin on the pad surface
   * centre). Edges step in whole rows so the light reads as a pixel-art beam, not a smooth gradient.
   */
  private createGuideLight(): Phaser.GameObjects.Graphics {
    const guide = landingScenery.guideLight;
    const art = LANDING_ART_SCALE;
    const beam = this.scene.add.graphics().setDepth(depth.parallax + 1).setBlendMode(Phaser.BlendModes.ADD);
    const color = colorNumber(guide.color);
    const baseHalf = (this.pad.width * guide.baseWidthRatio) / 2;
    const topHalf = (this.pad.width * guide.topWidthRatio) / 2;

    for (let band = 0; band < guide.bands; band += 1) {
      const t = band / guide.bands;
      const height = guide.height * (1 - t * 0.55);
      const bottomHalf = baseHalf * (1 - t * 0.6);
      const upperHalf = topHalf * (1 - t * 0.7);
      beam.fillStyle(color, guide.bandAlpha);
      for (let y = 0; y < height; y += guide.stepPx) {
        const k = y / height;
        const half = snapToGrid(Phaser.Math.Linear(bottomHalf, upperHalf, k), art);
        const rowHeight = Math.min(guide.stepPx, height - y);
        beam.fillRect(-half, -y - rowHeight, half * 2, rowHeight);
      }
    }

    beam.setPosition(snapToGrid(this.pad.centerX, art), this.pad.surfaceY).setAlpha(guide.idleIntensity);
    return beam;
  }

  private drawBrackets(aligned: boolean): void {
    const config = landingScenery.padBrackets;
    const color = colorNumber(aligned ? colors.sage : colors.ember);
    const alpha = aligned ? config.alignedAlpha : config.unalignedAlpha;
    const t = config.thicknessPx;
    const arm = config.armPx;
    const left = snapToGrid(this.pad.centerX - this.pad.width / 2 + config.insetPx, LANDING_ART_SCALE);
    const right = snapToGrid(this.pad.centerX + this.pad.width / 2 - config.insetPx, LANDING_ART_SCALE);
    const y = this.pad.surfaceY - config.liftPx;

    this.brackets.clear();
    this.brackets.fillStyle(color, alpha);
    // Left: horizontal arm then upright; right mirrors it. Plain rects on the art grid.
    this.brackets.fillRect(left, y, arm, t);
    this.brackets.fillRect(left, y - arm + t, t, arm - t);
    this.brackets.fillRect(right - arm, y, arm, t);
    this.brackets.fillRect(right - t, y - arm + t, t, arm - t);
  }
}
