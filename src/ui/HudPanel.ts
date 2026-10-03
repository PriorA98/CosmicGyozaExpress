import Phaser from "phaser";
import { ASSET, NINE_SLICE, type UiIconName } from "../data/assetManifest";
import { colorNumber, colors, typeScale } from "../game/designTokens";
import { addUiIcon } from "./icons";
import { stackOffsets, uiIconScale, uiPixelLabelSize, uiScaled, uiTextSize } from "./layout";
import { Meter } from "./Meter";
import type { MeterAccent } from "./statePalette";
import { addNineSlicePanel, drawDarkHudSurface } from "./surfaces";
import { monoStyle, pixelLabelStyle } from "./textStyles";
import { fittedPixelTextSize } from "./textFit";

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
  /** Fit the heading inside the panel on pixel-font grid steps. Default preserves desktop typography. */
  readonly fitTitle?: boolean;
  readonly icon?: UiIconName;
  readonly rows: readonly HudRow[];
  readonly fixed?: boolean;
  /** Compact-display multiplier (see `compactUiScale`): scales text, rows and padding. Default 1. */
  readonly uiScale?: number;
  /**
   * 1 (default): one label/value row per line. 2: rows fill a two-column grid left-to-right
   * (speed | moon / bottom | package), halving the panel height so phone HUDs keep every row.
   */
  readonly columns?: HudColumns;
};

export type HudColumns = 1 | 2;

/**
 * Instrument panels are fully opaque: scenery sparkles behind a translucent panel read as stray
 * glyphs inside the readout table.
 */
const HUD_ART_ALPHA = 1;

export const HUD_LAYOUT = {
  padding: 14,
  headerHeight: 40,
  rowHeight: 26,
  meterHeight: 12,
  meterWidthRatio: 0.52,
  /** Two-column grids: gap between the columns, with a faint 2px divider centred in it. */
  columnGap: 20,
  /** Two-column grids give meters a little more of their half cell (labels there are short). */
  columnMeterWidthRatio: 0.56,
} as const;

/** Lines a row count occupies in a grid of `columns` columns. */
export function hudLineCount(rowCount: number, columns: HudColumns = 1): number {
  const rows = Math.max(0, Math.floor(rowCount));
  return Math.ceil(rows / columns);
}

/** Total panel height for a given row count (pure, used by callers to lay out HUD stacks). */
export function hudPanelHeight(rowCount: number, uiScale = 1, columns: HudColumns = 1): number {
  return (
    uiScaled(HUD_LAYOUT.headerHeight, uiScale) +
    hudLineCount(rowCount, columns) * uiScaled(HUD_LAYOUT.rowHeight, uiScale) +
    uiScaled(HUD_LAYOUT.padding, uiScale)
  );
}

/** Left x and width of each grid cell inside a panel (pure; padding/gap already scaled). */
export function hudCellFrames(panelWidth: number, padding: number, columns: HudColumns, columnGap: number): { readonly x: number; readonly width: number }[] {
  const inner = Math.max(0, panelWidth - padding * 2);
  if (columns === 1) return [{ x: padding, width: inner }];
  const width = Math.floor((inner - columnGap) / 2);
  return [
    { x: padding, width },
    { x: padding + inner - width, width },
  ];
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
  private readonly columns: HudColumns;

  constructor(scene: Phaser.Scene, options: HudPanelOptions) {
    super(scene, options.x, options.y);
    this.uiScale = options.uiScale ?? 1;
    this.columns = options.columns ?? 1;
    const padding = uiScaled(HUD_LAYOUT.padding, this.uiScale);
    const headerHeight = uiScaled(HUD_LAYOUT.headerHeight, this.uiScale);
    const rowHeight = uiScaled(HUD_LAYOUT.rowHeight, this.uiScale);
    this.panelWidth = options.width;
    this.panelHeight = hudPanelHeight(options.rows.length, this.uiScale, this.columns);

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
    if (options.fitTitle) {
      const size = fittedPixelTextSize(uiPixelLabelSize(this.uiScale), 16, 8, this.panelWidth - padding - titleX, (fontSize) => {
        this.titleText.setFontSize(fontSize);
        return this.titleText.width;
      });
      this.titleText.setFontSize(size);
    }
    this.add(this.titleText);

    const divider = scene.add.graphics();
    divider.fillStyle(colorNumber(colors.plaster), 0.12);
    divider.fillRect(padding, headerHeight - 2, this.panelWidth - padding * 2, 2);
    this.add(divider);

    const lineTops = stackOffsets(hudLineCount(options.rows.length, this.columns), headerHeight + 4, rowHeight);
    const columnGap = uiScaled(HUD_LAYOUT.columnGap, this.uiScale);
    const cells = hudCellFrames(this.panelWidth, padding, this.columns, columnGap);
    options.rows.forEach((row, index) => {
      const cell = cells[index % this.columns] ?? cells[0];
      if (cell) this.addRow(row, lineTops[Math.floor(index / this.columns)] ?? 0, cell.x, cell.width);
    });
    if (this.columns === 2 && lineTops.length > 0) {
      // Faint column divider between the two cells, in whole 2px steps.
      const first = lineTops[0] ?? 0;
      const lineX = Math.round((padding + (cells[0]?.width ?? 0) + (cells[1]?.x ?? 0)) / 2) - 1;
      divider.fillStyle(colorNumber(colors.plaster), 0.08);
      divider.fillRect(lineX, first + 4, 2, lineTops.length * rowHeight - 8);
    }

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

  private addRow(row: HudRow, top: number, cellX: number, cellWidth: number): void {
    const rowHeight = uiScaled(HUD_LAYOUT.rowHeight, this.uiScale);
    const meterHeight = Math.round(uiScaled(HUD_LAYOUT.meterHeight, this.uiScale) / 2) * 2;
    const meterWidthRatio = this.columns === 2 ? HUD_LAYOUT.columnMeterWidthRatio : HUD_LAYOUT.meterWidthRatio;
    const cellRight = cellX + cellWidth;
    const midY = top + rowHeight / 2;
    const label = this.scene.add
      .text(cellX, midY, row.label, monoStyle({ size: uiTextSize(typeScale.sm, this.uiScale), color: colors.plaster }))
      .setOrigin(0, 0.5)
      .setAlpha(0.66);
    this.add(label);

    if (row.kind === "meter") {
      const width = Math.round(cellWidth * meterWidthRatio);
      const meter = new Meter(this.scene, {
        x: cellRight - width,
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
      .text(cellRight, midY, row.value ?? "", monoStyle({ size: uiTextSize(HUD_VALUE_SIZE, this.uiScale), bold: true, color: row.valueColor ?? colors.plaster }))
      .setOrigin(1, 0.5);
    this.values.set(row.id, value);
    this.add(value);
  }
}
