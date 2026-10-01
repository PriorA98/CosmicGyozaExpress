import Phaser from "phaser";
import { ASSET, NINE_SLICE, type UiIconName } from "../data/assetManifest";
import { colorNumber, colors, motion } from "../game/designTokens";
import { emitGameEvent } from "../game/events";
import { isReducedMotion } from "../fx/feedback";
import { addUiIcon } from "./icons";
import { addNineSlicePanel } from "./surfaces";
import { pixelLabelStyle } from "./textStyles";

export type ButtonVariant = "primary" | "secondary" | "ink";
export type ButtonVisualState = "idle" | "hover" | "pressed" | "disabled";

export type ButtonOptions = {
  readonly x: number;
  readonly y: number;
  readonly label: string;
  readonly width?: number;
  readonly height?: number;
  readonly variant?: ButtonVariant;
  readonly icon?: UiIconName;
  /** Keyboard keys (Phaser key names, e.g. "ENTER", "SPACE") that activate the button while it is enabled. */
  readonly keys?: readonly string[];
  /** Pin to the camera (HUD use). */
  readonly fixed?: boolean;
  readonly onActivate?: () => void;
};

type VariantPalette = {
  readonly fill: string;
  readonly hoverFill: string;
  readonly pressedFill: string;
  readonly border: string;
  readonly label: string;
  readonly highlightAlpha: number;
  readonly bevel: string;
  readonly bevelAlpha: number;
};

const VARIANTS: Readonly<Record<ButtonVariant, VariantPalette>> = {
  primary: {
    fill: colors.terracotta,
    hoverFill: "#D58A68",
    pressedFill: colors.terracottaDeep,
    border: colors.ink,
    label: colors.plaster,
    highlightAlpha: 0.32,
    bevel: colors.terracottaDeep,
    bevelAlpha: 1,
  },
  secondary: {
    fill: colors.parchmentWarm,
    hoverFill: colors.plaster,
    pressedFill: colors.parchmentDeep,
    border: colors.ink,
    label: colors.ink,
    highlightAlpha: 0.6,
    bevel: colors.border,
    bevelAlpha: 1,
  },
  ink: {
    fill: colors.ink,
    hoverFill: colors.inkSoft,
    pressedFill: colors.cosmosDeep,
    border: colors.ink,
    label: colors.plaster,
    highlightAlpha: 0.12,
    bevel: colors.cosmosDeep,
    bevelAlpha: 1,
  },
};

/** Pixel-button geometry (design-system.md "Pixel buttons": 2px ink border, hard 3px shadow). */
const BORDER = 2;
const SHADOW = 3;
const FOCUS_GAP = 5;
const ICON_GAP = 10;
const BUTTON_FRAME = { idle: 0, hover: 1, pressed: 2 } as const;
/** Label offsets for the authored button art (its bottom 4 art px are the baked shadow). */
const ART_IDLE_LABEL_Y = -4;
const ART_PRESSED_LABEL_Y = 0;

/**
 * Primary/secondary/ink pixel button. Pointer: press on down, activate on release over the button.
 * Keyboard: bound keys show the pressed state briefly, then activate. Emits `ui:hover` and
 * `ui:confirm`. Origin is the top-left of the face (the shadow sits outside the box).
 */
export class Button extends Phaser.GameObjects.Container {
  readonly buttonWidth: number;
  readonly buttonHeight: number;

  private readonly variant: ButtonVariant;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly focusRing: Phaser.GameObjects.Graphics;
  private readonly face: Phaser.GameObjects.Container;
  private readonly art: Phaser.GameObjects.NineSlice | undefined;
  private readonly labelText: Phaser.GameObjects.Text;
  private readonly hitZone: Phaser.GameObjects.Zone;
  private readonly onActivate: (() => void) | undefined;
  private readonly keyCleanups: (() => void)[] = [];
  private visualState: ButtonVisualState = "idle";
  private hovered = false;
  private pointerPressed = false;
  private focused = false;
  private enabled = true;
  private focusTween: Phaser.Tweens.Tween | undefined;

  constructor(scene: Phaser.Scene, options: ButtonOptions) {
    super(scene, options.x, options.y);
    this.variant = options.variant ?? "primary";
    this.onActivate = options.onActivate;

    const label = scene.add.text(0, 0, options.label, pixelLabelStyle({ color: VARIANTS[this.variant].label }));
    const iconWidth = options.icon ? 32 + ICON_GAP : 0;
    this.buttonWidth = Math.max(options.width ?? 0, Math.ceil(label.width + iconWidth + 48));
    this.buttonHeight = options.height ?? 56;

    this.focusRing = scene.add.graphics();
    this.graphics = scene.add.graphics();
    this.face = scene.add.container(0, 0);
    this.art = addNineSlicePanel(scene, ASSET.uiButton, this.buttonWidth, this.buttonHeight, NINE_SLICE.button, BUTTON_FRAME.idle);

    const contentWidth = label.width + iconWidth;
    const startX = Math.round((this.buttonWidth - contentWidth) / 2);
    const centerY = Math.round(this.buttonHeight / 2);
    if (options.icon) this.face.add(addUiIcon(scene, startX + 16, centerY, options.icon));
    label.setOrigin(0, 0.5).setPosition(startX + iconWidth, centerY);
    label.setShadow(0, 2, this.variant === "secondary" ? colors.border : colors.ink, 0, false, true);
    this.labelText = label;
    this.face.add(label);

    this.hitZone = scene.add
      .zone(0, 0, this.buttonWidth + SHADOW, this.buttonHeight + SHADOW)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });

    this.add([this.focusRing, ...(this.art ? [this.art] : [this.graphics]), this.face, this.hitZone]);
    this.setSize(this.buttonWidth, this.buttonHeight);
    this.wirePointer();
    this.wireKeys(options.keys ?? []);
    if (options.fixed) this.setScrollFactor(0, 0, true);
    this.redraw();

    scene.add.existing(this);
    this.once(Phaser.GameObjects.Events.DESTROY, () => this.cleanup());
  }

  get isFocused(): boolean {
    return this.focused;
  }

  get visual(): ButtonVisualState {
    return this.visualState;
  }

  setLabel(text: string): this {
    this.labelText.setText(text);
    return this;
  }

  setEnabled(enabled: boolean): this {
    this.enabled = enabled;
    if (enabled) this.hitZone.setInteractive({ useHandCursor: true });
    else this.hitZone.disableInteractive();
    this.pointerPressed = false;
    this.applyState(enabled ? (this.hovered ? "hover" : "idle") : "disabled");
    return this;
  }

  setFocused(focused: boolean): this {
    if (this.focused === focused) return this;
    this.focused = focused;
    this.drawFocusRing();
    return this;
  }

  /** Forces a visual state (for galleries/showcases). Interaction resumes normally afterwards. */
  showState(state: ButtonVisualState): this {
    this.applyState(state);
    return this;
  }

  /** Activates as if pressed via keyboard: brief pressed frame, then confirm. */
  activate(): void {
    if (!this.enabled) return;
    this.applyState("pressed");
    this.scene.time.delayedCall(motion.fast, () => {
      if (!this.active) return;
      this.applyState(this.hovered ? "hover" : "idle");
      this.confirm();
    });
  }

  private confirm(): void {
    if (!this.enabled) return;
    emitGameEvent(this.scene, { type: "ui:confirm" });
    this.onActivate?.();
  }

  private wirePointer(): void {
    this.hitZone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => {
      if (!this.enabled) return;
      this.hovered = true;
      if (!this.pointerPressed) this.applyState("hover");
      emitGameEvent(this.scene, { type: "ui:hover" });
    });
    this.hitZone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => {
      this.hovered = false;
      this.pointerPressed = false;
      if (this.enabled) this.applyState("idle");
    });
    this.hitZone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      if (!this.enabled) return;
      this.pointerPressed = true;
      this.applyState("pressed");
    });
    this.hitZone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, (pointer: Phaser.Input.Pointer) => {
      if (!this.enabled || !this.pointerPressed) return;
      this.pointerPressed = false;
      // Touch has no hover: return to idle after a tap.
      this.hovered = this.hovered && !pointer.wasTouch;
      this.applyState(this.hovered ? "hover" : "idle");
      this.confirm();
    });
  }

  private wireKeys(keys: readonly string[]): void {
    const keyboard = this.scene.input.keyboard;
    if (!keyboard) return;
    for (const key of keys) {
      const eventName = `keydown-${key}`;
      const handler = (event: KeyboardEvent): void => {
        if (!this.enabled || !this.visible || event.repeat) return;
        event.preventDefault();
        this.setFocused(true);
        this.activate();
      };
      keyboard.on(eventName, handler);
      this.keyCleanups.push(() => keyboard.off(eventName, handler));
    }
  }

  private applyState(state: ButtonVisualState): void {
    if (this.visualState === state) return;
    this.visualState = state;
    this.redraw();
  }

  private redraw(): void {
    const palette = VARIANTS[this.variant];
    const state = this.visualState;
    const pressed = state === "pressed";
    const lift = state === "hover" ? -1 : 0;
    const offset = pressed ? SHADOW - 1 : lift;
    const fill = state === "hover" ? palette.hoverFill : pressed ? palette.pressedFill : palette.fill;
    const width = this.buttonWidth;
    const height = this.buttonHeight;

    this.face.setPosition(offset, offset);
    this.setAlpha(state === "disabled" ? 0.5 : 1);

    if (this.art) {
      // Authored frames bake the hard shadow into the bottom rows; the face sinks onto it when pressed.
      this.art.setFrame(pressed ? BUTTON_FRAME.pressed : state === "hover" ? BUTTON_FRAME.hover : BUTTON_FRAME.idle);
      this.face.setPosition(0, pressed ? ART_PRESSED_LABEL_Y : ART_IDLE_LABEL_Y);
      this.drawFocusRing();
      return;
    }

    const g = this.graphics;
    g.clear();
    // Hard ink shadow (collapses when pressed), then the face with a 2px ink border.
    // Both shapes drop their outer corner pixel for a stamped, pixel-notched silhouette.
    const shadow = pressed ? 1 : SHADOW - lift;
    g.fillStyle(colorNumber(colors.ink), 1);
    fillNotchedRect(g, shadow, shadow, width, height);
    fillNotchedRect(g, offset, offset, width, height);
    g.fillStyle(colorNumber(fill), 1);
    g.fillRect(offset + BORDER, offset + BORDER, width - BORDER * 2, height - BORDER * 2);
    // Top/left highlight and bottom bevel give the face a tactile, stamped look.
    g.fillStyle(colorNumber(colors.plaster), pressed ? 0 : palette.highlightAlpha);
    g.fillRect(offset + BORDER, offset + BORDER, width - BORDER * 2, 2);
    g.fillRect(offset + BORDER, offset + BORDER, 2, height - BORDER * 2 - 4);
    g.fillStyle(colorNumber(palette.bevel), palette.bevelAlpha);
    g.fillRect(offset + BORDER, offset + height - BORDER - 4, width - BORDER * 2, 4);
    this.drawFocusRing();
  }

  private drawFocusRing(): void {
    const g = this.focusRing;
    g.clear();
    this.focusTween?.remove();
    this.focusTween = undefined;
    if (!this.focused || this.visualState === "disabled") return;

    const x = -FOCUS_GAP;
    const y = -FOCUS_GAP;
    const width = this.buttonWidth + SHADOW + FOCUS_GAP * 2;
    const height = this.buttonHeight + SHADOW + FOCUS_GAP * 2;
    const dash = 8;
    g.fillStyle(colorNumber(colors.amber), 1);
    // Dashed 2px pixel outline.
    for (let px = x; px < x + width; px += dash * 2) {
      const len = Math.min(dash, x + width - px);
      g.fillRect(px, y, len, 2);
      g.fillRect(px, y + height - 2, len, 2);
    }
    for (let py = y; py < y + height; py += dash * 2) {
      const len = Math.min(dash, y + height - py);
      g.fillRect(x, py, 2, len);
      g.fillRect(x + width - 2, py, 2, len);
    }
    g.setAlpha(1);
    if (!isReducedMotion()) {
      this.focusTween = this.scene.tweens.add({
        targets: g,
        alpha: { from: 1, to: 0.45 },
        duration: motion.breath / 2,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }
  }

  private cleanup(): void {
    for (const cleanup of this.keyCleanups) cleanup();
    this.keyCleanups.length = 0;
    this.focusTween?.remove();
  }
}

function fillNotchedRect(graphics: Phaser.GameObjects.Graphics, x: number, y: number, width: number, height: number): void {
  graphics.fillRect(x + BORDER, y, width - BORDER * 2, height);
  graphics.fillRect(x, y + BORDER, width, height - BORDER * 2);
}
