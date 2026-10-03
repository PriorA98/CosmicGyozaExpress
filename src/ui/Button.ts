import Phaser from "phaser";
import type { UiIconName } from "../data/assetManifest";
import { colorNumber, colors, motion } from "../game/designTokens";
import { emitGameEvent } from "../game/events";
import { isReducedMotion } from "../fx/feedback";
import { addUiIcon } from "./icons";
import { uiIconScale, uiPixelLabelSize, uiScaled } from "./layout";
import { fillSteppedRect, STEPPED_CORNER } from "./surfaces";
import { pixelLabelStyle } from "./textStyles";
import { ButtonPress } from "./buttonPress";

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
  /**
   * Compact-display multiplier (see `compactUiScale`). Snaps the label to the next whole
   * Silkscreen grid size, the icon to an integer scale, and scales the default height. Default 1.
   */
  readonly uiScale?: number;
  readonly onActivate?: () => void;
};

type VariantPalette = {
  readonly fill: string;
  readonly hoverFill: string;
  readonly pressedFill: string;
  readonly label: string;
  readonly labelShadow: string;
  readonly highlightAlpha: number;
  readonly bevel: string;
  /** Bevel while pressed (dark variants darken it so only the pressed face reads sunken). */
  readonly pressedBevel: string;
  /** Outer keyline and the hard lip under the face. */
  readonly outline: string;
};

const VARIANTS: Readonly<Record<ButtonVariant, VariantPalette>> = {
  primary: {
    fill: colors.terracotta,
    hoverFill: "#D58A68",
    pressedFill: colors.terracottaDeep,
    label: colors.plaster,
    labelShadow: colors.terracottaDeep,
    highlightAlpha: 0.32,
    bevel: colors.terracottaDeep,
    pressedBevel: colors.terracottaDeep,
    outline: colors.ink,
  },
  secondary: {
    fill: colors.parchmentWarm,
    hoverFill: colors.plaster,
    pressedFill: colors.parchmentDeep,
    label: colors.ink,
    labelShadow: colors.border,
    highlightAlpha: 1,
    bevel: colors.border,
    pressedBevel: colors.border,
    outline: colors.ink,
  },
  // Dark secondary: a raised slate face with a lit top edge and a mid-tone bevel at rest; only the
  // pressed state drops to the near-black ink face and bevel.
  ink: {
    fill: colors.inkSoft,
    hoverFill: colors.slate700,
    pressedFill: colors.ink,
    label: colors.plaster,
    labelShadow: colors.cosmosDeep,
    highlightAlpha: 0.2,
    bevel: colors.ink,
    pressedBevel: colors.cosmosDeep,
    outline: colors.cosmosDeep,
  },
};

/**
 * Pixel-button geometry (design-system.md "Pixel buttons": 2px ink border, hard 3px shadow).
 * The shadow is a solid ink lip directly under the face (no gap); pressing sinks the face onto it.
 */
const BORDER = 2;
const SHADOW = 3;
const BEVEL = 4;
const FOCUS_GAP = 4;
const FOCUS_WIDTH = 2;
const ICON_GAP = 10;
const ICON_ART_PX = 16;
const LABEL_PADDING_X = 24;
const MIN_LABEL_PADDING_X = 12;
const DEFAULT_HEIGHT = 56;
const FOCUS_PULSE_ALPHA = 0.55;

/**
 * Primary/secondary/ink pixel button. Pointer: press on down, activate on release over the button.
 * Keyboard: bound keys show the pressed state briefly, then activate. Emits `ui:hover` and
 * `ui:confirm`. Origin is the top-left of the face (the 3px lip sits below the box).
 */
export class Button extends Phaser.GameObjects.Container {
  readonly buttonWidth: number;
  readonly buttonHeight: number;

  private readonly variant: ButtonVariant;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly focusRing: Phaser.GameObjects.Graphics;
  private readonly face: Phaser.GameObjects.Container;
  private readonly labelText: Phaser.GameObjects.Text;
  private readonly iconImage: Phaser.GameObjects.Image | undefined;
  private readonly iconWidth: number;
  private readonly hitZone: Phaser.GameObjects.Zone;
  private readonly onActivate: (() => void) | undefined;
  private readonly keyCleanups: (() => void)[] = [];
  private visualState: ButtonVisualState = "idle";
  private hovered = false;
  private readonly pointerPress = new ButtonPress();
  private focused = false;
  private enabled = true;
  private focusTween: Phaser.Tweens.Tween | undefined;

  constructor(scene: Phaser.Scene, options: ButtonOptions) {
    super(scene, options.x, options.y);
    this.variant = options.variant ?? "primary";
    this.onActivate = options.onActivate;
    const uiScale = options.uiScale ?? 1;
    const palette = VARIANTS[this.variant];

    const label = scene.add.text(0, 0, options.label, pixelLabelStyle({ size: uiPixelLabelSize(uiScale), color: palette.label }));
    const iconScale = uiIconScale(uiScale);
    this.iconWidth = options.icon ? ICON_ART_PX * iconScale + uiScaled(ICON_GAP, uiScale) : 0;
    // Auto-sized buttons get comfortable padding; a requested width only grows when even the
    // minimum padding cannot fit the label, so fixed-width grids stay aligned.
    const padding = uiScaled(options.width === undefined ? LABEL_PADDING_X : MIN_LABEL_PADDING_X, uiScale);
    this.buttonWidth = Math.max(options.width ?? 0, Math.ceil(label.width + this.iconWidth + padding * 2));
    this.buttonHeight = options.height ?? uiScaled(DEFAULT_HEIGHT, uiScale);

    this.focusRing = scene.add.graphics();
    this.graphics = scene.add.graphics();
    this.face = scene.add.container(0, 0);

    if (options.icon) {
      this.iconImage = addUiIcon(scene, 0, 0, options.icon, { scale: iconScale, originX: 0 });
      this.face.add(this.iconImage);
    }
    label.setOrigin(0, 0.5);
    label.setShadow(0, 2, palette.labelShadow, 0, false, true);
    this.labelText = label;
    this.face.add(label);
    this.layoutContent();

    this.hitZone = scene.add
      .zone(0, 0, this.buttonWidth, this.buttonHeight + SHADOW)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });

    this.add([this.focusRing, this.graphics, this.face, this.hitZone]);
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

  get isEnabled(): boolean {
    return this.enabled;
  }

  setLabel(text: string): this {
    this.labelText.setText(text);
    this.layoutContent();
    return this;
  }

  setEnabled(enabled: boolean): this {
    this.enabled = enabled;
    if (enabled) this.hitZone.setInteractive({ useHandCursor: true });
    else this.hitZone.disableInteractive();
    this.pointerPress.reset();
    this.applyState(enabled ? (this.hovered ? "hover" : "idle") : "disabled");
    return this;
  }

  /** Shows the warm focus outline. Callers should show it only for keyboard navigation. */
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

  private layoutContent(): void {
    const contentWidth = this.labelText.width + this.iconWidth;
    const startX = Math.round((this.buttonWidth - contentWidth) / 2);
    // Optical centre sits a little above the bottom bevel.
    const centerY = Math.round((this.buttonHeight - BEVEL / 2) / 2);
    this.iconImage?.setPosition(startX, centerY);
    this.labelText.setPosition(startX + this.iconWidth, centerY);
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
      if (!this.pointerPress.isPressed) this.applyState("hover");
      emitGameEvent(this.scene, { type: "ui:hover" });
    });
    this.hitZone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, (pointer: Phaser.Input.Pointer) => {
      this.hovered = false;
      this.pointerPress.out(pointer);
      if (this.enabled) this.applyState("idle");
    });
    this.hitZone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      if (!this.enabled) return;
      this.pointerPress.down(pointer);
      this.applyState("pressed");
    });
    this.hitZone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, (pointer: Phaser.Input.Pointer) => {
      if (!this.enabled || !this.pointerPress.up(pointer) || pointer.event.type === "touchcancel") return;
      // Touch has no hover: return to idle after a tap.
      this.hovered = this.hovered && !pointer.wasTouch;
      this.applyState(this.hovered ? "hover" : "idle");
      this.confirm();
    });
    const release = (pointer: Phaser.Input.Pointer): void => {
      this.pointerPress.reset(pointer);
    };
    const input = this.scene.input;
    input.on(Phaser.Input.Events.POINTER_UP, release);
    input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, release);
    this.keyCleanups.push(() => {
      input.off(Phaser.Input.Events.POINTER_UP, release);
      input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, release);
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
    // Face offset from its resting place: hover lifts 1px, pressed sinks onto the lip.
    const offset = pressed ? SHADOW - 1 : state === "hover" ? -1 : 0;
    const fill = state === "hover" ? palette.hoverFill : pressed ? palette.pressedFill : palette.fill;
    const width = this.buttonWidth;
    const height = this.buttonHeight;

    this.face.setPosition(0, offset);
    this.setAlpha(state === "disabled" ? 0.5 : 1);

    const g = this.graphics;
    g.clear();
    // Solid ink lip spanning the face's resting box shifted down by SHADOW: no gap is possible.
    g.fillStyle(colorNumber(palette.outline), 1);
    fillSteppedRect(g, 0, SHADOW, width, height, STEPPED_CORNER.notch);
    // Face: 2px ink border, fill, top/left highlight, bottom bevel.
    fillSteppedRect(g, 0, offset, width, height, STEPPED_CORNER.notch);
    g.fillStyle(colorNumber(fill), 1);
    g.fillRect(BORDER, offset + BORDER, width - BORDER * 2, height - BORDER * 2);
    if (!pressed) {
      g.fillStyle(colorNumber(colors.plaster), palette.highlightAlpha);
      g.fillRect(BORDER, offset + BORDER, width - BORDER * 2, 2);
      g.fillRect(BORDER, offset + BORDER, 2, height - BORDER * 2 - BEVEL);
    }
    const bevel = pressed ? BEVEL / 2 : BEVEL;
    g.fillStyle(colorNumber(pressed ? palette.pressedBevel : palette.bevel), 1);
    g.fillRect(BORDER, offset + height - BORDER - bevel, width - BORDER * 2, bevel);
    this.drawFocusRing();
  }

  private drawFocusRing(): void {
    const g = this.focusRing;
    g.clear();
    this.focusTween?.remove();
    this.focusTween = undefined;
    if (!this.focused || this.visualState === "disabled") return;

    // Soft solid 2px amber outline hugging the face and its lip, with stepped corners.
    const reach = FOCUS_GAP + FOCUS_WIDTH;
    const x = -reach;
    const y = -reach;
    const width = this.buttonWidth + reach * 2;
    const height = this.buttonHeight + SHADOW + reach * 2;
    const corner = 4;
    g.fillStyle(colorNumber(colors.amber), 1);
    g.fillRect(x + corner, y, width - corner * 2, FOCUS_WIDTH);
    g.fillRect(x + corner, y + height - FOCUS_WIDTH, width - corner * 2, FOCUS_WIDTH);
    g.fillRect(x, y + corner, FOCUS_WIDTH, height - corner * 2);
    g.fillRect(x + width - FOCUS_WIDTH, y + corner, FOCUS_WIDTH, height - corner * 2);
    g.fillRect(x + 2, y + 2, 2, 2);
    g.fillRect(x + width - 4, y + 2, 2, 2);
    g.fillRect(x + 2, y + height - 4, 2, 2);
    g.fillRect(x + width - 4, y + height - 4, 2, 2);
    g.setAlpha(1);
    if (!isReducedMotion()) {
      this.focusTween = this.scene.tweens.add({
        targets: g,
        alpha: { from: 1, to: FOCUS_PULSE_ALPHA },
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
