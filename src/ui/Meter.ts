import Phaser from "phaser";
import { colorNumber, colors } from "../game/designTokens";
import { clamp01, segmentFills, segmentWidth } from "./layout";
import { meterAccentColor, type MeterAccent } from "./statePalette";

export type MeterOptions = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height?: number;
  readonly segments?: number;
  readonly accent?: MeterAccent;
  /** 0..1 */
  readonly value?: number;
  readonly fixed?: boolean;
};

const GAP = 2;
const INSET = 2;
/** Values are quantised to 1/STEPS so tiny float changes never trigger a redraw. */
const STEPS = 200;

/** Segmented bar meter on a recessed dark track. Origin: top-left. */
export class Meter extends Phaser.GameObjects.Container {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly meterWidth: number;
  private readonly meterHeight: number;
  private readonly segments: number;
  private accent: MeterAccent;
  private value = -1;

  constructor(scene: Phaser.Scene, options: MeterOptions) {
    super(scene, options.x, options.y);
    this.meterWidth = options.width;
    this.meterHeight = options.height ?? 12;
    this.segments = options.segments ?? 10;
    this.accent = options.accent ?? "ember";
    this.graphics = scene.add.graphics();
    this.add(this.graphics);
    this.setSize(this.meterWidth, this.meterHeight);
    if (options.fixed) this.setScrollFactor(0, 0, true);
    this.setValue(options.value ?? 0);
    scene.add.existing(this);
  }

  get currentValue(): number {
    return this.value;
  }

  setAccent(accent: MeterAccent): this {
    if (accent === this.accent) return this;
    this.accent = accent;
    this.redraw();
    return this;
  }

  setValue(value: number): this {
    // Divide an integer step count (0.7 -> 140 / 200 = 0.7 exactly, never 0.7000000000000001).
    const next = Math.round(clamp01(value) * STEPS) / STEPS;
    if (next === this.value) return this;
    this.value = next;
    this.redraw();
    return this;
  }

  private redraw(): void {
    const g = this.graphics;
    const width = this.meterWidth;
    const height = this.meterHeight;
    const accent = colorNumber(meterAccentColor(this.accent));
    g.clear();
    g.fillStyle(colorNumber(colors.cosmosDeep), 0.9);
    g.fillRect(0, 0, width, height);
    g.lineStyle(2, colorNumber(colors.plaster), 0.14);
    g.strokeRect(1, 1, width - 2, height - 2);

    const innerWidth = width - INSET * 2;
    const innerHeight = height - INSET * 2;
    const each = segmentWidth(innerWidth, this.segments, GAP);
    segmentFills(this.value, this.segments).forEach((fill, index) => {
      const x = INSET + index * (each + GAP);
      g.fillStyle(colorNumber(colors.plaster), 0.06);
      g.fillRect(x, INSET, each, innerHeight);
      if (fill <= 0) return;
      g.fillStyle(accent, fill >= 1 ? 1 : 0.35 + fill * 0.5);
      g.fillRect(x, INSET, each, innerHeight);
      // Light top edge so filled segments read as lit cells.
      g.fillStyle(colorNumber(colors.plaster), 0.28);
      g.fillRect(x, INSET, each, 2);
    });
  }
}
