import Phaser from "phaser";
import { ASSET, UI_ICON_FRAME, type UiIconName } from "../data/assetManifest";
import { sampleTickerLines, stateLabels, uiKitCopy } from "../data/uiCopy";
import { colorNumber, colors, depth, typeScale } from "../game/designTokens";
import { emitGameEvent } from "../game/events";
import { Button, type ButtonOptions, type ButtonVisualState } from "../ui/Button";
import { DashboardTicker } from "../ui/DashboardTicker";
import { HudPanel } from "../ui/HudPanel";
import { addUiIcon, ICON_DISPLAY_SIZE } from "../ui/icons";
import { Keycap, KEYCAP_HEIGHT } from "../ui/Keycap";
import { formatReadout } from "../ui/layout";
import { Meter } from "../ui/Meter";
import { ParchmentCard } from "../ui/ParchmentCard";
import { StatePill, STATE_PILL_HEIGHT } from "../ui/StatePill";
import { UI_STATES, type MeterAccent } from "../ui/statePalette";
import { UI_ART_SCALE } from "../ui/surfaces";
import { bodyStyle, displayTitleStyle, headingStyle, monoStyle, pixelLabelStyle } from "../ui/textStyles";
import { TouchControls } from "../ui/TouchControls";

/** Gallery grid on the 1280x720 logical canvas (screen px). */
const GRID = {
  margin: 32,
  columns: [32, 452, 872] as const,
  columnWidth: 376,
  sectionGap: 18,
  labelHeight: 26,
} as const;

type GalleryButton = {
  readonly label: string;
  readonly variant: NonNullable<ButtonOptions["variant"]>;
  readonly state: ButtonVisualState;
  readonly focused?: boolean;
  readonly icon?: UiIconName;
};

const GALLERY_BUTTONS: readonly GalleryButton[] = [
  { label: uiKitCopy.buttonLabels.idle, variant: "primary", state: "idle", icon: "tea" },
  { label: uiKitCopy.buttonLabels.hover, variant: "primary", state: "hover" },
  { label: uiKitCopy.buttonLabels.pressed, variant: "primary", state: "pressed" },
  { label: uiKitCopy.buttonLabels.focused, variant: "primary", state: "idle", focused: true },
  { label: uiKitCopy.buttonLabels.secondary, variant: "secondary", state: "idle", icon: "memory" },
  { label: uiKitCopy.buttonLabels.ink, variant: "ink", state: "idle", icon: "settings" },
];

const GALLERY_METERS: readonly { readonly accent: MeterAccent; readonly value: number }[] = [
  { accent: "ember", value: 0.72 },
  { accent: "sage", value: 0.45 },
  { accent: "dusk", value: 0.9 },
  { accent: "amber", value: 0.18 },
];

const GALLERY_KEYS: readonly string[] = ["W", "A", "D", "S", "space", "enter", "M", "esc"];
const GALLERY_HELD_KEY = "W";

/**
 * Dev-only gallery of the src/ui component kit (owner: ui package). Opened with
 * `?showcase=ui-kit`. Never registered in production builds. Shows every component and state
 * statically so screenshots can review them side by side.
 */
export class UiKitScene extends Phaser.Scene {
  constructor() {
    super("UiKitScene");
  }

  create(): void {
    this.drawBackdrop();
    this.buildColumnA();
    this.buildColumnB();
    this.buildColumnC();
    emitGameEvent(this, { type: "scene:enter", scene: "UiKitScene" });
  }

  private drawBackdrop(): void {
    const { width, height } = this.scale;
    this.add.rectangle(0, 0, width, height, colorNumber(colors.cosmos)).setOrigin(0, 0).setDepth(depth.backdrop);
    if (this.textures.exists(ASSET.spaceStarsFar)) {
      this.add.tileSprite(0, 0, width, height, ASSET.spaceStarsFar).setOrigin(0, 0).setTileScale(UI_ART_SCALE).setAlpha(0.45).setDepth(depth.backdrop);
    }
    // Column wells so each group reads as its own tray.
    const g = this.add.graphics().setDepth(depth.parallax);
    for (const x of GRID.columns) {
      g.fillStyle(colorNumber(colors.cosmosDeep), 0.45);
      g.fillRoundedRect(x - 12, 16, GRID.columnWidth + 24, height - 32, 10);
    }
  }

  /** Section header: pixel label plus a thin rule. Returns the y where content starts. */
  private section(x: number, y: number, label: string): number {
    this.add.text(x, y, label.toUpperCase(), pixelLabelStyle({ color: colors.amber })).setDepth(depth.hud);
    const rule = this.add.graphics().setDepth(depth.hud);
    rule.fillStyle(colorNumber(colors.plaster), 0.12);
    rule.fillRect(x, y + GRID.labelHeight - 6, GRID.columnWidth, 2);
    return y + GRID.labelHeight + 4;
  }

  private buildColumnA(): void {
    const x = GRID.columns[0];
    let y = 26;
    this.add.text(x, y, uiKitCopy.title, displayTitleStyle({ size: 44, color: colors.plaster })).setShadow(3, 3, colors.terracottaDeep, 0, false, true).setDepth(depth.hud);
    y += 52;
    this.add.text(x, y, uiKitCopy.subtitle, monoStyle({ size: typeScale.sm, color: colors.parchmentDeep })).setAlpha(0.75).setDepth(depth.hud);
    y += 30;

    y = this.section(x, y, uiKitCopy.sections.type);
    const specimens: readonly Phaser.GameObjects.Text[] = [
      this.add.text(x, y, "Bricolage 800 display", displayTitleStyle({ size: 26, color: colors.ember })),
      this.add.text(x, y + 34, "Heading · Bricolage 600", headingStyle({ size: typeScale.lg, color: colors.plaster })),
      this.add.text(x, y + 62, uiKitCopy.sampleBody, bodyStyle({ size: typeScale.md, color: colors.parchmentDeep })),
      this.add.text(x, y + 88, `speed ${formatReadout(42.5, { decimals: 1, width: 6, unit: "px/s" })}`, monoStyle({ size: 15, bold: true, color: colors.plaster })),
      this.add.text(x, y + 112, "pixel label · silkscreen", pixelLabelStyle({ color: colors.amber })),
    ];
    for (const text of specimens) text.setDepth(depth.hud);
    y += 146 + GRID.sectionGap;

    y = this.section(x, y, uiKitCopy.sections.buttons);
    const buttonWidth = 176;
    const buttonHeight = 48;
    GALLERY_BUTTONS.forEach((spec, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const button = new Button(this, {
        x: x + 6 + column * (buttonWidth + 18),
        y: y + 6 + row * (buttonHeight + 22),
        label: spec.label,
        width: buttonWidth,
        height: buttonHeight,
        variant: spec.variant,
        ...(spec.icon ? { icon: spec.icon } : {}),
      });
      button.setDepth(depth.hud).showState(spec.state);
      if (spec.focused) button.setFocused(true);
    });
    y += 3 * (buttonHeight + 22) + 4;
    const disabled = new Button(this, { x: x + 6, y, label: uiKitCopy.buttonLabels.disabled, width: buttonWidth, height: buttonHeight, variant: "primary" });
    disabled.setDepth(depth.hud).setEnabled(false);
  }

  private buildColumnB(): void {
    const x = GRID.columns[1];
    let y = 26;

    y = this.section(x, y, uiKitCopy.sections.keycaps);
    let cursor = x;
    let rowY = y + 4;
    for (const key of GALLERY_KEYS) {
      const keycap = new Keycap(this, { x: cursor, y: rowY, label: key }).setDepth(depth.hud);
      // Show the held frame on one key so both keycap states are reviewable.
      if (key === GALLERY_HELD_KEY) keycap.setPressed(true);
      cursor += keycap.keyWidth + 10;
      if (cursor > x + GRID.columnWidth - 48) {
        cursor = x;
        rowY += KEYCAP_HEIGHT + 10;
      }
    }
    y = rowY + KEYCAP_HEIGHT + 8 + GRID.sectionGap;

    y = this.section(x, y, uiKitCopy.sections.pills);
    UI_STATES.forEach((state, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      new StatePill(this, { x: x + column * 190, y: y + 4 + row * (STATE_PILL_HEIGHT + 10), state, label: stateLabels[state] }).setDepth(depth.hud);
    });
    y += 4 + 3 * (STATE_PILL_HEIGHT + 10) + GRID.sectionGap;

    y = this.section(x, y, uiKitCopy.sections.hud);
    const panel = new HudPanel(this, {
      x,
      y: y + 4,
      width: GRID.columnWidth,
      title: uiKitCopy.hudTitle,
      icon: "radar",
      rows: [
        { id: "speed", label: uiKitCopy.hudRows.speed, value: formatReadout(128.4, { decimals: 1, width: 6, unit: "px/s" }) },
        { id: "heading", label: uiKitCopy.hudRows.heading, value: formatReadout(-12, { width: 4, unit: "deg", signed: true }) },
        { id: "drift", label: uiKitCopy.hudRows.drift, kind: "meter", value: 0.35, accent: "sage" },
        { id: "package", label: uiKitCopy.hudRows.package, kind: "meter", value: 0.82, accent: "ember" },
      ],
    });
    panel.setDepth(depth.hud);
    y += 4 + panel.panelHeight + GRID.sectionGap;

    y = this.section(x, y, uiKitCopy.sections.ticker);
    const ticker = new DashboardTicker(this, { x, y: y + 4, width: GRID.columnWidth, lines: sampleTickerLines });
    ticker.setDepth(depth.hud).finishReveal();
  }

  private buildColumnC(): void {
    const x = GRID.columns[2];
    let y = 26;

    y = this.section(x, y, uiKitCopy.sections.meters);
    GALLERY_METERS.forEach((spec, index) => {
      const rowY = y + 6 + index * 26;
      this.add.text(x, rowY + 6, spec.accent, monoStyle({ size: typeScale.sm, color: colors.plaster })).setOrigin(0, 0.5).setAlpha(0.7).setDepth(depth.hud);
      new Meter(this, { x: x + 72, y: rowY, width: 236, height: 12, accent: spec.accent, value: spec.value }).setDepth(depth.hud);
      this.add
        .text(x + GRID.columnWidth, rowY + 6, formatReadout(spec.value * 100, { width: 3, unit: "%" }), monoStyle({ size: typeScale.sm, bold: true, color: colors.plaster }))
        .setOrigin(1, 0.5)
        .setDepth(depth.hud);
    });
    y += 6 + GALLERY_METERS.length * 26 + GRID.sectionGap - 4;

    y = this.section(x, y, uiKitCopy.sections.card);
    const cardHeight = 150;
    const card = new ParchmentCard(this, { x, y: y + 4, width: GRID.columnWidth, height: cardHeight, title: uiKitCopy.sampleCardTitle });
    card.setDepth(depth.hud);
    card.addContent(
      addUiIcon(this, card.padding + ICON_DISPLAY_SIZE / 2, card.contentTop + ICON_DISPLAY_SIZE / 2, "moon"),
      this.add.text(card.padding + ICON_DISPLAY_SIZE + 12, card.contentTop - 2, uiKitCopy.sampleCardBody, bodyStyle({ size: 15, color: colors.inkSoft, wrapWidth: GRID.columnWidth - card.padding * 2 - ICON_DISPLAY_SIZE - 12 })),
      new StatePill(this, { x: card.padding, y: cardHeight - card.padding - STATE_PILL_HEIGHT, state: "delivering" }),
    );
    y += 4 + cardHeight + GRID.sectionGap;

    y = this.section(x, y, uiKitCopy.sections.icons);
    const names = Object.keys(UI_ICON_FRAME) as UiIconName[];
    const perRow = 8;
    const step = ICON_DISPLAY_SIZE + 14;
    names.forEach((name, index) => {
      const cx = x + ICON_DISPLAY_SIZE / 2 + 4 + (index % perRow) * step;
      const cy = y + ICON_DISPLAY_SIZE / 2 + 4 + Math.floor(index / perRow) * step;
      addUiIcon(this, cx, cy, name).setDepth(depth.hud);
    });
    y += Math.ceil(names.length / perRow) * step + GRID.sectionGap - 6;

    y = this.section(x, y, uiKitCopy.sections.touch);
    const zoneTop = y + 6;
    const radius = 38;
    const touch = new TouchControls(this, {
      visibility: "always",
      zones: [
        { id: "left", shape: { kind: "circle", x: x + radius + 4, y: zoneTop + radius, radius }, label: uiKitCopy.touchLabels.left },
        { id: "right", shape: { kind: "circle", x: x + radius * 3 + 20, y: zoneTop + radius, radius }, label: uiKitCopy.touchLabels.right },
        { id: "thrust", shape: { kind: "rect", x: x + GRID.columnWidth - 150, y: zoneTop, width: 150, height: radius * 2 }, label: uiKitCopy.touchLabels.thrust, icon: "thrust" },
      ],
    });
    touch.previewDown("thrust", true);
  }
}
