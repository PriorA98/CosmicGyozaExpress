import Phaser from "phaser";
import { ASSET, NINE_SLICE, type UiIconName } from "../data/assetManifest";
import { colorNumber, colors, typeScale } from "../game/designTokens";
import { addUiIcon } from "./icons";
import { stackOffsets, uiIconScale, uiPixelLabelSize, uiScaled, uiTextSize } from "./layout";
import { Meter } from "./Meter";
import type { MeterAccent } from "./statePalette";
import { addNineSlicePanel, drawDarkHudSurface } from "./surfaces";
import { monoStyle, pixelLabelStyle } from "./textStyles";

export type HudTextRow = {
  readonly kind?: "text";
  readonly id: string;
  readonly label: string;
  readonly value?: string;
  readonly valueColor?: string;
};

export type HudMeterRow = {
  readonly kind: "meter";
  readonly id: string;
  readonly label: string;
  readonly value?: number;
  readonly accent?: MeterAccent;
  readonly segments?: number;
};

export type HudRow = HudTextRow | HudMeterRow;

export type HudPanelOptions = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly title: string;
  readonly icon?: UiIconName;
  readonly rows: readonly HudRow[];
  readonly fixed?: boolean;
  /** Compact-display multiplier (see `compactUiScale`): scales text, rows and padding. Default 1. */
  readonly uiScale?: number;
};

/** Authored dark panel art is opaque; a touch of translucency keeps gameplay visible beneath. */
const HUD_ART_ALPHA = 0.9;

export const HUD_LAYOUT = {
  padding: 14,
  headerHeight: 40,
  rowHeight: 26,
  meterHeight: 12,
  meterWidthRatio: 0.52,
} as const;

/** Total panel height for a given row count (pure, used by callers to lay out HUD stacks). */
export function hudPanelHeight(rowCount: number, uiScale = 1): number {
  return uiScaled(HUD_LAYOUT.headerHeight, uiScale) + rowCount * uiScaled(HUD_LAYOUT.rowHeight, uiScale) + uiScaled(HUD_LAYOUT.padding, uiScale);
}

/** Value text size in a HUD row (instrument readouts are slightly larger than labels). */
const HUD_VALUE_SIZE = 15;

/**
 * Dark translucent HUD panel: pixel header (optional icon) + aligned label/value rows.
 * Values are right-aligned in a monospaced font so changing digits never shift the layout.
 * Origin: top-left.
 */
export class HudPanel extends Phaser.GameObjects.Container {
  readonly panelWidth: number;
  readonly panelHeight: number;
  private readonly values = new Map<string, Phaser.GameObjects.Text>();
  private readonly meters = new Map<string, Meter>();
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly uiScale: number;

  constructor(scene: Phaser.Scene, options: HudPanelOptions) {
    super(scene, options.x, options.y);
    this.uiScale = options.uiScale ?? 1;
    const padding = uiScaled(HUD_LAYOUT.padding, this.uiScale);
    const headerHeight = uiScaled(HUD_LAYOUT.headerHeight, this.uiScale);
    const rowHeight = uiScaled(HUD_LAYOUT.rowHeight, this.uiScale);
    this.panelWidth = options.width;
    this.panelHeight = hudPanelHeight(options.rows.length, this.uiScale);

    const art = addNineSlicePanel(scene, ASSET.uiPanelDark, this.panelWidth, this.panelHeight, NINE_SLICE.panel);
    if (art) this.add(art.setAlpha(HUD_ART_ALPHA));
    else {
      const g = scene.add.graphics();
      drawDarkHudSurface(g, this.panelWidth, this.panelHeight);
      this.add(g);
    }

    let titleX = padding;
    if (options.icon) {
      const iconScale = uiIconScale(this.uiScale);
      this.add(addUiIcon(scene, padding, headerHeight / 2, options.icon, { originX: 0, scale: iconScale }));
      titleX += 16 * iconScale + uiScaled(8, this.uiScale);
    }
    this.titleText = scene.add
      .text(titleX, headerHeight / 2 + 1, options.title.toUpperCase(), pixelLabelStyle({ size: uiPixelLabelSize(this.uiScale), color: colors.amber }))
      .setOrigin(0, 0.5);
    this.add(this.titleText);

    const divider = scene.add.graphics();
    divider.fillStyle(colorNumber(colors.plaster), 0.12);
    divider.fillRect(padding, headerHeight - 2, this.panelWidth - padding * 2, 2);
    this.add(divider);

    const rowTops = stackOffsets(options.rows.length, headerHeight + 4, rowHeight);
    options.rows.forEach((row, index) => this.addRow(row, rowTops[index] ?? 0));

    this.setSize(this.panelWidth, this.panelHeight);
    if (options.fixed) this.setScrollFactor(0, 0, true);
    scene.add.existing(this);
  }

  setTitle(title: string): this {
    this.titleText.setText(title.toUpperCase());
    return this;
  }

  /** Updates a text row. No-op when unchanged so per-frame calls stay cheap. */
  setValue(id: string, value: string, color?: string): this {
    const text = this.values.get(id);
    if (!text) return this;
    if (text.text !== value) text.setText(value);
    if (color && text.style.color !== color) text.setColor(color);
    return this;
  }

  setMeter(id: string, value: number, accent?: MeterAccent): this {
    const meter = this.meters.get(id);
    if (!meter) return this;
    meter.setValue(value);
    if (accent) meter.setAccent(accent);
    return this;
  }

  private addRow(row: HudRow, top: number): void {
    const padding = uiScaled(HUD_LAYOUT.padding, this.uiScale);
    const rowHeight = uiScaled(HUD_LAYOUT.rowHeight, this.uiScale);
    const meterHeight = Math.round(uiScaled(HUD_LAYOUT.meterHeight, this.uiScale) / 2) * 2;
    const { meterWidthRatio } = HUD_LAYOUT;
    const midY = top + rowHeight / 2;
    const label = this.scene.add
      .text(padding, midY, row.label, monoStyle({ size: uiTextSize(typeScale.sm, this.uiScale), color: colors.plaster }))
      .setOrigin(0, 0.5)
      .setAlpha(0.66);
    this.add(label);

    if (row.kind === "meter") {
      const width = Math.round((this.panelWidth - padding * 2) * meterWidthRatio);
      const meter = new Meter(this.scene, {
        x: this.panelWidth - padding - width,
        y: Math.round(midY - meterHeight / 2),
        width,
        height: meterHeight,
        accent: row.accent ?? "ember",
        segments: row.segments ?? 10,
        value: row.value ?? 0,
      });
      this.meters.set(row.id, meter);
      this.add(meter);
      return;
    }

    const value = this.scene.add
      .text(this.panelWidth - padding, midY, row.value ?? "", monoStyle({ size: uiTextSize(HUD_VALUE_SIZE, this.uiScale), bold: true, color: row.valueColor ?? colors.plaster }))
      .setOrigin(1, 0.5);
    this.values.set(row.id, value);
    this.add(value);
  }
}
