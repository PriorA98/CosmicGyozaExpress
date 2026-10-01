import Phaser from "phaser";
import { colorNumber, colors, typeScale } from "../game/designTokens";
import { uiScaled, uiTextSize } from "./layout";
import { fillSteppedRect, STEPPED_CORNER } from "./surfaces";
import { monoStyle } from "./textStyles";

export type KeycapOptions = {
  readonly x: number;
  readonly y: number;
  readonly label: string;
  readonly minWidth?: number;
  readonly fixed?: boolean;
  /** Compact-display multiplier (see `compactUiScale`). Default 1. */
  readonly uiScale?: number;
};

/** Keycap height in screen px at uiScale 1 (use `keyHeight` for the scaled value). */
export const KEYCAP_HEIGHT = 32;
const KEYCAP_PADDING_X = 10;
/** Ink outline: 2px sides/top, a heavier 4px bottom edge (design-system.md "Keycaps"). */
const BORDER = 2;
const BOTTOM_EDGE = 4;
/** Visible key skirt between the face and the bottom edge; pressing sinks the face onto it. */
const SKIRT = 3;
const PRESS_SINK = 2;

/** Light mono keycap: plaster face, warm skirt, ink outline with a heavier bottom. Origin: top-left. */
export class Keycap extends Phaser.GameObjects.Container {
  readonly keyWidth: number;
  readonly keyHeight: number;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly labelText: Phaser.GameObjects.Text;
  private pressed = false;

  constructor(scene: Phaser.Scene, options: KeycapOptions) {
    super(scene, options.x, options.y);
    const uiScale = options.uiScale ?? 1;
    this.keyHeight = uiScaled(KEYCAP_HEIGHT, uiScale);
    this.labelText = scene.add
      .text(0, 0, options.label, monoStyle({ size: uiTextSize(typeScale.sm, uiScale), bold: true, color: colors.ink }))
      .setOrigin(0.5, 0.5);
    this.keyWidth = Math.max(
      options.minWidth ?? this.keyHeight,
      Math.ceil(this.labelText.width + uiScaled(KEYCAP_PADDING_X, uiScale) * 2),
    );
    this.graphics = scene.add.graphics();
    this.add([this.graphics, this.labelText]);
    this.setSize(this.keyWidth, this.keyHeight);
    if (options.fixed) this.setScrollFactor(0, 0, true);
    this.redraw();
    scene.add.existing(this);
  }

  get isPressed(): boolean {
    return this.pressed;
  }

  setPressed(pressed: boolean): this {
    if (this.pressed === pressed) return this;
    this.pressed = pressed;
    this.redraw();
    return this;
  }

  private redraw(): void {
    const g = this.graphics;
    const width = this.keyWidth;
    const height = this.keyHeight;
    const sink = this.pressed ? PRESS_SINK : 0;
    const faceTop = BORDER + sink;
    const faceHeight = height - BORDER - BOTTOM_EDGE - SKIRT;

    g.clear();
    g.fillStyle(colorNumber(colors.ink), 1);
    fillSteppedRect(g, 0, 0, width, height, STEPPED_CORNER.notch);
    // Skirt (the key's side), visible below the face.
    g.fillStyle(colorNumber(colors.borderStrong), 1);
    g.fillRect(BORDER, BORDER, width - BORDER * 2, height - BORDER - BOTTOM_EDGE);
    // Face with a light top highlight (dropped while held).
    g.fillStyle(colorNumber(this.pressed ? colors.parchmentDeep : colors.plaster), 1);
    g.fillRect(BORDER, faceTop, width - BORDER * 2, faceHeight);
    if (!this.pressed) {
      g.fillStyle(colorNumber(colors.parchmentDeep), 1);
      g.fillRect(BORDER, faceTop + faceHeight - 2, width - BORDER * 2, 2);
    }
    this.labelText.setPosition(Math.round(width / 2), Math.round(faceTop + faceHeight / 2));
  }
}
