import Phaser from "phaser";
import { stateLabels } from "../data/uiCopy";
import { colorNumber, typeScale } from "../game/designTokens";
import { uiScaled, uiTextSize } from "./layout";
import { fillSteppedRect, STEPPED_CORNER } from "./surfaces";
import { monoStyle } from "./textStyles";
import { stateSwatch, type UiState } from "./statePalette";

export type StatePillOptions = {
  readonly x: number;
  readonly y: number;
  readonly state: UiState;
  /** Overrides the default gentle label for the state. */
  readonly label?: string;
  readonly fixed?: boolean;
  /** Compact-display multiplier (see `compactUiScale`). Default 1. */
  readonly uiScale?: number;
};

/** Pill height at uiScale 1 (use `pillHeight` for the scaled value). */
export const STATE_PILL_HEIGHT = 26;
const DOT_SIZE = 8;
const PADDING_X = 12;
const DOT_GAP = 8;
const OUTLINE = 2;

/** Compact mono pill with a pixel dot, built from stepped rects. Origin: top-left. */
export class StatePill extends Phaser.GameObjects.Container {
  readonly pillHeight: number;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly labelText: Phaser.GameObjects.Text;
  private readonly paddingX: number;
  private readonly dotSize: number;
  private readonly dotGap: number;
  private current: UiState;
  private customLabel: string | undefined;

  constructor(scene: Phaser.Scene, options: StatePillOptions) {
    super(scene, options.x, options.y);
    const uiScale = options.uiScale ?? 1;
    this.pillHeight = uiScaled(STATE_PILL_HEIGHT, uiScale);
    this.paddingX = uiScaled(PADDING_X, uiScale);
    this.dotSize = Math.round(uiScaled(DOT_SIZE, uiScale) / 2) * 2;
    this.dotGap = uiScaled(DOT_GAP, uiScale);
    this.current = options.state;
    this.customLabel = options.label;
    this.graphics = scene.add.graphics();
    this.labelText = scene.add.text(0, 0, "", monoStyle({ size: uiTextSize(typeScale.sm, uiScale), bold: true })).setOrigin(0, 0.5);
    this.add([this.graphics, this.labelText]);
    if (options.fixed) this.setScrollFactor(0, 0, true);
    this.redraw();
    scene.add.existing(this);
  }

  get pillWidth(): number {
    return Math.ceil(this.paddingX * 2 + this.dotSize + this.dotGap + this.labelText.width);
  }

  setPillState(state: UiState, label?: string): this {
    if (state === this.current && label === this.customLabel) return this;
    this.current = state;
    this.customLabel = label;
    this.redraw();
    return this;
  }

  private redraw(): void {
    const swatch = stateSwatch(this.current);
    this.labelText.setText(this.customLabel ?? stateLabels[this.current]).setColor(swatch.foreground);
    const width = this.pillWidth;
    const height = this.pillHeight;
    const mid = Math.round(height / 2);
    const g = this.graphics;
    g.clear();
    // Soft outline in the label colour, then the pill fill, both with stepped round ends.
    g.fillStyle(colorNumber(swatch.foreground), 0.3);
    fillSteppedRect(g, 0, 0, width, height, STEPPED_CORNER.round);
    g.fillStyle(colorNumber(swatch.background), 1);
    fillSteppedRect(g, OUTLINE, OUTLINE, width - OUTLINE * 2, height - OUTLINE * 2, STEPPED_CORNER.soft);
    // Pixel dot (a notched square reads round at this size).
    const dotX = this.paddingX;
    const dotY = mid - this.dotSize / 2;
    g.fillStyle(colorNumber(swatch.dot), 1);
    fillSteppedRect(g, dotX, dotY, this.dotSize, this.dotSize, STEPPED_CORNER.notch);
    this.labelText.setPosition(this.paddingX + this.dotSize + this.dotGap, mid);
    this.setSize(width, height);
  }
}
