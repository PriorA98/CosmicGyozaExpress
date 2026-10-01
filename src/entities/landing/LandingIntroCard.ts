import Phaser from "phaser";
import { landingCopy } from "../../data/landingCopy";
import { LANDING_ART_SCALE, landingScenery } from "../../data/landingScenery";
import { colors, depth, fontStacks, typeScale } from "../../game/designTokens";
import { ParchmentCard, monoStyle } from "../../ui";
import { ensureLandingRabbitAnimations } from "./MoonRabbit";

/**
 * Arrival title card: a small parchment card with the tea-house rabbit waving and "tea moon · landing".
 * Pops in, holds, and floats away; the scene owns the timing and puts it on the UI camera.
 */
export class LandingIntroCard {
  readonly root: Phaser.GameObjects.Container;
  private readonly scene: Phaser.Scene;
  private readonly scale: number;

  constructor(scene: Phaser.Scene, scale: number) {
    this.scene = scene;
    this.scale = scale;
    const intro = landingScenery.intro;
    const art = LANDING_ART_SCALE;
    const width = intro.cardWidth;
    const height = intro.cardHeight;
    const left = -width / 2;
    const top = -height / 2;
    const pad = 18;

    ensureLandingRabbitAnimations(scene);
    const card = new ParchmentCard(scene, { x: left, y: top, width, height, padding: pad });
    const rabbit = scene.add
      .sprite(left + pad + 24, top + height - 14, landingScenery.rabbit.key, landingScenery.rabbit.waveFrames[0])
      .setOrigin(0.5, 1)
      .setScale(art);
    rabbit.play(landingScenery.rabbit.waveAnimKey);

    const textLeft = left + pad + 48 + 16;
    const title = scene.add
      .text(textLeft, top + 22, landingCopy.intro.title, {
        color: colors.ink,
        fontFamily: fontStacks.display,
        fontSize: `${typeScale.xl}px`,
        fontStyle: "700",
      })
      .setOrigin(0, 0);
    const subtitle = scene.add
      .text(textLeft, title.y + title.height + 4, landingCopy.intro.subtitle, monoStyle({ size: typeScale.sm, color: colors.terracottaDeep, bold: true }))
      .setOrigin(0, 0);

    this.root = scene.add
      .container(Math.round(scene.scale.width / 2), intro.cardY, [card, rabbit, title, subtitle])
      .setDepth(depth.hudFx)
      .setScale(scale * 0.7)
      .setAlpha(0);
  }

  playIn(): void {
    this.scene.tweens.add({ targets: this.root, scale: this.scale, alpha: 1, duration: landingScenery.caption.popMs, ease: "Back.easeOut" });
  }

  /** Floats up and fades; destroys itself when done. */
  playOut(): void {
    const intro = landingScenery.intro;
    this.scene.tweens.killTweensOf(this.root);
    this.scene.tweens.add({
      targets: this.root,
      alpha: 0,
      y: this.root.y - LANDING_ART_SCALE * 6,
      duration: intro.cardOutMs,
      ease: "Sine.easeIn",
      onComplete: () => this.root.destroy(),
    });
  }

  destroy(): void {
    this.scene.tweens.killTweensOf(this.root);
    this.root.destroy();
  }
}
