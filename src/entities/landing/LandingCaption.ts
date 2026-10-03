import Phaser from "phaser";
import { LANDING_ART_SCALE, landingScenery } from "../../data/landingScenery";
import { colorNumber, colors, depth, fontStacks, motion, typeScale } from "../../game/designTokens";
import { ParchmentCard } from "../../ui";
import { fillNotchedRect, snapToGrid } from "./pixelShapes";

export type LandingCaptionOptions = {
  readonly x: number;
  readonly y: number;
  readonly title: string;
  readonly subtitle?: string;
  /** State colour of the leading dot (sage soft, amber bumpy, brick incident). */
  readonly accent: string;
  /** When set, a thin bar fills over this many ms (the quick retry countdown). */
  readonly progressMs?: number;
  /** HUD scale (compactUiScale) so the card stays legible on phones. */
  readonly scale: number;
  /** Campaign captions become opaque before the scale pop completes; legacy keeps its original tween. */
  readonly opacityMs?: number;
};

const DOT_PX = 10;
const DOT_GAP = 10;

/**
 * Warm parchment card (UI-kit nine-slice art) that pops above the pad for touchdowns and incidents.
 * Returns the container so the scene can destroy it on retry.
 */
export function showLandingCaption(scene: Phaser.Scene, options: LandingCaptionOptions): Phaser.GameObjects.Container {
  const config = landingScenery.caption;
  const cell = LANDING_ART_SCALE;
  const title = scene.add
    .text(0, 0, options.title, {
      color: colors.ink,
      fontFamily: fontStacks.display,
      fontSize: `${typeScale.lg}px`,
      fontStyle: "700",
    })
    .setOrigin(0, 0);
  const subtitle = options.subtitle
    ? scene.add
        .text(0, 0, options.subtitle, {
          color: colors.terracottaDeep,
          fontFamily: fontStacks.mono,
          fontSize: `${typeScale.base}px`,
          fontStyle: "700",
        })
        .setOrigin(0, 0)
    : undefined;

  const textWidth = Math.max(title.width, subtitle?.width ?? 0);
  const textHeight = title.height + (subtitle ? subtitle.height + 2 : 0);
  const barSpace = options.progressMs ? config.retryBarHeight + 8 : 0;
  const width = snapToGrid(DOT_PX + DOT_GAP + textWidth + config.padX * 2, cell * 2);
  const height = snapToGrid(textHeight + config.padY * 2 + barSpace, cell * 2);
  const left = -width / 2;
  const top = -height / 2;

  const card = new ParchmentCard(scene, { x: left, y: top, width, height, padding: config.padX });
  const dot = scene.add.graphics();
  dot.fillStyle(colorNumber(options.accent), 1);
  fillNotchedRect(dot, left + config.padX, snapToGrid(top + config.padY + title.height / 2 - DOT_PX / 2, cell), DOT_PX, DOT_PX, cell);
  const textLeft = left + config.padX + DOT_PX + DOT_GAP;
  title.setPosition(textLeft, top + config.padY);
  subtitle?.setPosition(textLeft, top + config.padY + title.height + 2);

  const children: Phaser.GameObjects.GameObject[] = [card, dot, title];
  if (subtitle) children.push(subtitle);
  const container = scene.add.container(0, Math.round(options.y), children).setDepth(depth.hudFx);

  if (options.progressMs) {
    const barWidth = width - config.padX * 2;
    const barY = snapToGrid(top + height - config.padY - config.retryBarHeight, cell);
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

  // Screen-fixed (camera shake and the arrival pan never move it); kept inside the canvas.
  container.setScrollFactor(0, 0, true);
  const halfVisible = (width * options.scale) / 2 + config.edgeMarginPx;
  container.setX(Math.round(Phaser.Math.Clamp(options.x, halfVisible, scene.scale.width - halfVisible)));
  container.setScale(options.scale * 0.6).setAlpha(options.opacityMs === undefined ? 0 : 0.85);
  if (options.opacityMs === undefined) {
    scene.tweens.add({ targets: container, scale: options.scale, alpha: 1, duration: config.popMs, ease: "Back.easeOut" });
  } else {
    scene.tweens.add({ targets: container, scale: options.scale, duration: config.popMs, ease: "Back.easeOut" });
    scene.tweens.add({ targets: container, alpha: 1, duration: options.opacityMs, ease: "Linear" });
  }
  scene.tweens.add({
    targets: container,
    y: container.y - cell * 3,
    duration: motion.breath / 2,
    delay: config.popMs,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut",
  });
  return container;
}
