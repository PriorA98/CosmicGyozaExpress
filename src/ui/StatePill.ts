import Phaser from "phaser";
import { stateLabels } from "../data/uiCopy";
import { colorNumber, typeScale } from "../game/designTokens";
import { monoStyle } from "./textStyles";
import { stateSwatch, type UiState } from "./statePalette";

export type StatePillOptions = {
  readonly x: number;
  readonly y: number;
  readonly state: UiState;
  /** Overrides the default gentle label for the state. */
  readonly label?: string;
  readonly fixed?: boolean;
};

export const STATE_PILL_HEIGHT = 26;
const DOT_RADIUS = 4;
const PADDING_X = 12;
const DOT_GAP = 8;

/** Compact mono pill with a coloured dot. Origin: top-left. */
export class StatePill extends Phaser.GameObjects.Container {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly labelText: Phaser.GameObjects.Text;
  private current: UiState;
  private customLabel: string | undefined;

  constructor(scene: Phaser.Scene, options: StatePillOptions) {
    super(scene, options.x, options.y);
    this.current = options.state;
    this.customLabel = options.label;
    this.graphics = scene.add.graphics();
    this.labelText = scene.add.text(0, 0, "", monoStyle({ size: typeScale.sm, bold: true })).setOrigin(0, 0.5);
    this.add([this.graphics, this.labelText]);
    if (options.fixed) this.setScrollFactor(0, 0, true);
    this.redraw();
    scene.add.existing(this);
  }

  get pillWidth(): number {
    return Math.ceil(PADDING_X * 2 + DOT_RADIUS * 2 + DOT_GAP + this.labelText.width);
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
    const mid = STATE_PILL_HEIGHT / 2;
    const g = this.graphics;
    g.clear();
    g.fillStyle(colorNumber(swatch.background), 1);
    g.fillRoundedRect(0, 0, width, STATE_PILL_HEIGHT, mid);
    g.lineStyle(2, colorNumber(swatch.foreground), 0.25);
    g.strokeRoundedRect(1, 1, width - 2, STATE_PILL_HEIGHT - 2, mid - 1);
    g.fillStyle(colorNumber(swatch.dot), 1);
    g.fillCircle(PADDING_X + DOT_RADIUS, mid, DOT_RADIUS);
    this.labelText.setPosition(PADDING_X + DOT_RADIUS * 2 + DOT_GAP, mid);
    this.setSize(width, STATE_PILL_HEIGHT);
  }
}
