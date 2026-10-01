import Phaser from "phaser";
import { landingScenery } from "../../data/landingScenery";
import { colorNumber, colors, depth, fontStacks, motion, typeScale } from "../../game/designTokens";
import { landingHudScale } from "./LandingDashboard";

export type LandingCaptionOptions = {
  readonly x: number;
  readonly y: number;
  readonly title: string;
  readonly subtitle?: string;
  /** State colour of the leading dot (sage soft, amber bumpy, brick incident). */
  readonly accent: string;
  /** When set, a thin bar fills over this many ms (the quick retry countdown). */
  readonly progressMs?: number;
};

/**
 * Warm parchment pill that pops above the pad for touchdowns and incidents.
 * Returns the container so the scene can destroy it on retry.
 */
export function showLandingCaption(scene: Phaser.Scene, options: LandingCaptionOptions): Phaser.GameObjects.Container {
  const config = landingScenery.caption;
  const dotRadius = 6;
  const dotGap = 10;
  const title = scene.add
    .text(0, 0, options.title, {
      color: colors.ink,
      fontFamily: fontStacks.display,
      fontSize: `${typeScale.lg}px`,
      fontStyle: "bold",
    })
    .setOrigin(0, 0);
  const subtitle = options.subtitle
    ? scene.add
        .text(0, 0, options.subtitle, {
          color: colors.terracottaDeep,
          fontFamily: fontStacks.mono,
          fontSize: `${typeScale.sm}px`,
        })
        .setOrigin(0, 0)
    : undefined;

  const textWidth = Math.max(title.width, subtitle?.width ?? 0);
  const contentWidth = dotRadius * 2 + dotGap + textWidth;
  const textHeight = title.height + (subtitle ? subtitle.height + 2 : 0);
  const barSpace = options.progressMs ? config.retryBarHeight + 8 : 0;
  const width = contentWidth + config.padX * 2;
  const height = textHeight + config.padY * 2 + barSpace;
  const left = -width / 2;
  const top = -height / 2;

  const panel = scene.add.graphics();
  panel.fillStyle(colorNumber(colors.ink), 0.35);
  panel.fillRoundedRect(left + 2, top + 4, width, height, 10);
  panel.fillStyle(colorNumber(colors.parchmentWarm), 1);
  panel.fillRoundedRect(left, top, width, height, 10);
  panel.lineStyle(2, colorNumber(colors.border), 1);
  panel.strokeRoundedRect(left, top, width, height, 10);

  const textLeft = left + config.padX + dotRadius * 2 + dotGap;
  const dot = scene.add.circle(left + config.padX + dotRadius, top + config.padY + title.height / 2, dotRadius, colorNumber(options.accent));
  title.setPosition(textLeft, top + config.padY);
  subtitle?.setPosition(textLeft, top + config.padY + title.height + 2);

  const children: Phaser.GameObjects.GameObject[] = [panel, dot, title];
  if (subtitle) children.push(subtitle);

  const container = scene.add.container(Math.round(options.x), Math.round(options.y), children).setDepth(depth.hudFx);

  if (options.progressMs) {
    const barWidth = width - config.padX * 2;
    const barY = top + height - config.padY - config.retryBarHeight + 2;
    const track = scene.add
      .rectangle(left + config.padX, barY, barWidth, config.retryBarHeight, colorNumber(colors.parchmentDeep))
      .setOrigin(0, 0);
    const fill = scene.add
      .rectangle(left + config.padX, barY, barWidth, config.retryBarHeight, colorNumber(options.accent))
      .setOrigin(0, 0)
      .setScale(0, 1);
    container.add([track, fill]);
    scene.tweens.add({ targets: fill, scaleX: 1, duration: options.progressMs, ease: "Linear" });
  }

  const hudScale = landingHudScale(scene);
  // Keep the (possibly enlarged) card inside the canvas.
  const halfVisible = (width * hudScale) / 2 + config.padX;
  container.setX(Math.round(Phaser.Math.Clamp(options.x, halfVisible, scene.scale.width - halfVisible)));
  container.setScale(0.6 * hudScale).setAlpha(0);
  scene.tweens.add({ targets: container, scale: hudScale, alpha: 1, duration: config.popMs, ease: "Back.easeOut" });
  scene.tweens.add({
    targets: container,
    y: container.y - 6,
    duration: motion.breath / 2,
    delay: config.popMs,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut",
  });
  return container;
}
