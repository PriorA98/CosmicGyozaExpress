import Phaser from "phaser";
import { ASSET, NINE_SLICE, type UiIconName } from "../data/assetManifest";
import { colorNumber, colors, typeScale } from "../game/designTokens";
import { addUiIcon } from "./icons";
import { stackOffsets } from "./layout";
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
export function hudPanelHeight(rowCount: number): number {
  return HUD_LAYOUT.headerHeight + rowCount * HUD_LAYOUT.rowHeight + HUD_LAYOUT.padding;
}

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

  constructor(scene: Phaser.Scene, options: HudPanelOptions) {
    super(scene, options.x, options.y);
    const { padding, headerHeight, rowHeight } = HUD_LAYOUT;
    this.panelWidth = options.width;
    this.panelHeight = hudPanelHeight(options.rows.length);

    const art = addNineSlicePanel(scene, ASSET.uiPanelDark, this.panelWidth, this.panelHeight, NINE_SLICE.panel);
    if (art) this.add(art.setAlpha(HUD_ART_ALPHA));
    else {
      const g = scene.add.graphics();
      drawDarkHudSurface(g, this.panelWidth, this.panelHeight);
      this.add(g);
    }

    let titleX = padding;
    if (options.icon) {
      this.add(addUiIcon(scene, padding, headerHeight / 2, options.icon, { originX: 0 }));
      titleX += 32 + 8;
    }
    this.titleText = scene.add
      .text(titleX, headerHeight / 2 + 1, options.title.toUpperCase(), pixelLabelStyle({ color: colors.amber }))
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
    const { padding, rowHeight, meterHeight, meterWidthRatio } = HUD_LAYOUT;
    const midY = top + rowHeight / 2;
    const label = this.scene.add
      .text(padding, midY, row.label, monoStyle({ size: typeScale.sm, color: colors.plaster }))
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
      .text(this.panelWidth - padding, midY, row.value ?? "", monoStyle({ size: 15, bold: true, color: row.valueColor ?? colors.plaster }))
      .setOrigin(1, 0.5);
    this.values.set(row.id, value);
    this.add(value);
  }
}
