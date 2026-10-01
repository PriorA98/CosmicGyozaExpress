import Phaser from "phaser";
import { colorNumber, colors, depth, motion } from "../game/designTokens";
import { emitGameEvent } from "../game/events";
import { isReducedMotion } from "../fx/feedback";
import { ParchmentCard } from "./ParchmentCard";

export type ModalOptions = {
  readonly width: number;
  readonly height: number;
  readonly title?: string;
  /** Compact-display multiplier (see `compactUiScale`). Default 1. */
  readonly uiScale?: number;
  /** Escape and backdrop clicks close the modal (default true). */
  readonly dismissible?: boolean;
  readonly onClose?: () => void;
};

const BACKDROP_ALPHA = 0.66;
/** Card rises this far into place when opening. */
const RISE_PX = 12;

/**
 * Dimmed backdrop + centred parchment card, pinned to the camera above the HUD. Content goes in
 * `card` (card-local coordinates). Emits `ui:back` when closed; `onClose` runs after it is gone.
 */
export class Modal extends Phaser.GameObjects.Container {
  readonly card: ParchmentCard;
  private readonly onClose: (() => void) | undefined;
  private readonly keyCleanup: (() => void) | undefined;
  private closing = false;

  constructor(scene: Phaser.Scene, options: ModalOptions) {
    super(scene, 0, 0);
    this.onClose = options.onClose;
    const dismissible = options.dismissible ?? true;
    const { width, height } = scene.scale;

    const backdrop = scene.add.rectangle(0, 0, width, height, colorNumber(colors.cosmosDeep), BACKDROP_ALPHA).setOrigin(0, 0);
    backdrop.setInteractive();
    if (dismissible) backdrop.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.close());

    const cardX = Math.round((width - options.width) / 2);
    const cardY = Math.round((height - options.height) / 2);
    this.card = new ParchmentCard(scene, {
      x: cardX,
      y: cardY,
      width: options.width,
      height: options.height,
      ...(options.title ? { title: options.title } : {}),
      ...(options.uiScale ? { uiScale: options.uiScale } : {}),
    });
    // Swallow clicks on the card so they never reach the backdrop.
    const blocker = scene.add.zone(0, 0, options.width, options.height).setOrigin(0, 0).setInteractive();
    this.card.addAt(blocker, 0);

    this.add([backdrop, this.card]);
    this.setDepth(depth.overlay - 2).setScrollFactor(0, 0, true);
    scene.add.existing(this);

    const keyboard = scene.input.keyboard;
    if (keyboard && dismissible) {
      const onEscape = (): void => this.close();
      keyboard.on("keydown-ESC", onEscape);
      this.keyCleanup = () => keyboard.off("keydown-ESC", onEscape);
    }
    this.once(Phaser.GameObjects.Events.DESTROY, () => this.keyCleanup?.());

    if (!isReducedMotion()) {
      this.setAlpha(0);
      this.card.y = cardY + RISE_PX;
      scene.tweens.add({ targets: this, alpha: 1, duration: motion.base, ease: "Sine.easeOut" });
      scene.tweens.add({ targets: this.card, y: cardY, duration: motion.slow, ease: "Back.easeOut" });
    }
  }

  get isClosing(): boolean {
    return this.closing;
  }

  close(): void {
    if (this.closing || !this.active) return;
    this.closing = true;
    this.keyCleanup?.();
    emitGameEvent(this.scene, { type: "ui:back" });
    const finish = (): void => {
      this.destroy();
      this.onClose?.();
    };
    if (isReducedMotion()) {
      finish();
      return;
    }
    this.scene.tweens.add({ targets: this, alpha: 0, duration: motion.fast, ease: "Sine.easeIn", onComplete: finish });
  }
}
