import Phaser from "phaser";
import { landingCopy } from "../../data/landingCopy";
import { LANDING_ART_SCALE, landingScenery } from "../../data/landingScenery";
import { colors, depth, fontStacks, typeScale } from "../../game/designTokens";
import { ParchmentCard, monoStyle } from "../../ui";
import { ensureLandingRabbitAnimations } from "./MoonRabbit";

/**
 * Arrival title card: a small parchment card with the tea-house rabbit waving and "tea moon · landing".
 * Pops in, holds, and floats away; the scene owns the timing. Screen-fixed, so the arrival pan never moves it.
 */
/** Card text + optional portrait (campaign landings); omitted = the Tea Moon card with the waving rabbit. */
export type LandingIntroCardContent = {
  readonly title: string;
  readonly subtitle: string;
  /** Recipient portrait strip frame shown at 1x beside the text; null = text only (home). */
  readonly portrait: { readonly key: string; readonly frame: number } | null;
};

export class LandingIntroCard {
  readonly root: Phaser.GameObjects.Container;
  private readonly scene: Phaser.Scene;
  private readonly scale: number;

  constructor(scene: Phaser.Scene, scale: number, content?: LandingIntroCardContent) {
    this.scene = scene;
    this.scale = scale;
    const intro = landingScenery.intro;
    const art = LANDING_ART_SCALE;
    const width = intro.cardWidth;
    const height = intro.cardHeight;
    const left = -width / 2;
    const top = -height / 2;
    const pad = 18;

    const card = new ParchmentCard(scene, { x: left, y: top, width, height, padding: pad });
    let figure: Phaser.GameObjects.Sprite | undefined;
    if (content === undefined) {
      ensureLandingRabbitAnimations(scene);
      figure = scene.add
        .sprite(left + pad + 24, top + height - 14, landingScenery.rabbit.key, landingScenery.rabbit.waveFrames[0])
        .setOrigin(0.5, 1)
        .setScale(art);
      figure.play(landingScenery.rabbit.waveAnimKey);
    } else if (content.portrait !== null) {
      figure = scene.add
        .sprite(left + pad + 24, top + height - 14, content.portrait.key, content.portrait.frame)
        .setOrigin(0.5, 1)
        .setScale(1);
    }

    const textLeft = figure === undefined ? left + pad + 8 : left + pad + 48 + 16;
    const title = scene.add
      .text(textLeft, top + 22, content?.title ?? landingCopy.intro.title, {
        color: colors.ink,
        fontFamily: fontStacks.display,
        fontSize: `${typeScale.xl}px`,
        fontStyle: "700",
      })
      .setOrigin(0, 0);
    const subtitle = scene.add
      .text(textLeft, title.y + title.height + 4, content?.subtitle ?? landingCopy.intro.subtitle, monoStyle({ size: typeScale.sm, color: colors.terracottaDeep, bold: true }))
      .setOrigin(0, 0);

    this.root = scene.add
      .container(Math.round(scene.scale.width / 2), Math.round(intro.cardTopPx + (height * scale) / 2), figure === undefined ? [card, title, subtitle] : [card, figure, title, subtitle])
      .setDepth(depth.hudFx)
      .setScrollFactor(0, 0, true)
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
