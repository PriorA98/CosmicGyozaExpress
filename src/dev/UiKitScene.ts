import Phaser from "phaser";
import { ASSET, UI_ICON_FRAME, type UiIconName } from "../data/assetManifest";
import { sampleTickerLines, soundToastCopy, stateLabels, uiKitCopy } from "../data/uiCopy";
import { colorNumber, colors, depth, typeScale } from "../game/designTokens";
import { emitGameEvent } from "../game/events";
import { Button, type ButtonOptions, type ButtonVisualState } from "../ui/Button";
import { DashboardTicker } from "../ui/DashboardTicker";
import { HudPanel } from "../ui/HudPanel";
import { addUiIcon, ICON_DISPLAY_SIZE } from "../ui/icons";
import { Keycap } from "../ui/Keycap";
import { formatReadout } from "../ui/layout";
import { Meter } from "../ui/Meter";
import { ParchmentCard } from "../ui/ParchmentCard";
import { installSoundToast } from "../ui/SoundToast";
import { StatePill, STATE_PILL_HEIGHT } from "../ui/StatePill";
import { UI_STATES, type MeterAccent } from "../ui/statePalette";
import { fillSteppedRect, STEPPED_CORNER, UI_ART_SCALE } from "../ui/surfaces";
import { bodyStyle, displayTitleStyle, headingStyle, monoStyle, pixelLabelStyle } from "../ui/textStyles";
import { TouchControls, type TouchTone, type TouchZoneDefinition } from "../ui/TouchControls";

/** Gallery grid on the 1280x720 logical canvas (screen px). Three equal trays. */
const GRID = {
  top: 26,
  columns: [40, 452, 864] as const,
  columnWidth: 376,
  wellPad: 14,
  sectionGap: 16,
  labelHeight: 26,
  buttonGap: 16,
  buttonHeight: 46,
  buttonRowGap: 16,
} as const;

type GalleryButton = {
  readonly label: string;
  readonly variant: NonNullable<ButtonOptions["variant"]>;
  readonly state: ButtonVisualState;
  readonly focused?: boolean;
  readonly icon?: UiIconName;
};

/** Two-column button grid, read left to right: every cell has the same width and height. */
const GALLERY_BUTTONS: readonly GalleryButton[] = [
  { label: uiKitCopy.buttonLabels.idle, variant: "primary", state: "idle", icon: "tea" },
  { label: uiKitCopy.buttonLabels.hover, variant: "primary", state: "hover", icon: "tea" },
  { label: uiKitCopy.buttonLabels.pressed, variant: "primary", state: "pressed", icon: "tea" },
  { label: uiKitCopy.buttonLabels.focused, variant: "primary", state: "idle", focused: true, icon: "tea" },
  { label: uiKitCopy.buttonLabels.secondary, variant: "secondary", state: "idle", icon: "memory" },
  { label: uiKitCopy.buttonLabels.ink, variant: "ink", state: "idle", icon: "settings" },
  { label: uiKitCopy.buttonLabels.disabled, variant: "primary", state: "disabled", icon: "tea" },
  { label: uiKitCopy.buttonLabels.pressed, variant: "ink", state: "pressed", icon: "settings" },
];

const GALLERY_METERS: readonly { readonly accent: MeterAccent; readonly value: number }[] = [
  { accent: "ember", value: 0.72 },
  { accent: "sage", value: 0.45 },
  { accent: "dusk", value: 0.9 },
  { accent: "amber", value: 0.18 },
];

const GALLERY_KEYS: readonly string[] = ["W", "A", "S", "D", "space", "enter", "M", "esc"];
const GALLERY_HELD_KEY = "W";

/** Touch tile size in the gallery (square tiles + one wide thrust tile). */
const TILE = { size: 84, wide: 168, gap: 12 } as const;

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
    installSoundToast(this.game);
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
    // Column wells so each group reads as its own tray (stepped corners, no smooth curves).
    const g = this.add.graphics().setDepth(depth.parallax);
    for (const x of GRID.columns) {
      g.fillStyle(colorNumber(colors.cosmosDeep), 0.5);
      fillSteppedRect(g, x - GRID.wellPad, 14, GRID.columnWidth + GRID.wellPad * 2, height - 28, STEPPED_CORNER.round);
    }
  }

  /** Section header: pixel label plus a thin rule. Returns the y where content starts. */
  private section(x: number, y: number, label: string): number {
    this.add.text(x, y, label.toUpperCase(), pixelLabelStyle({ color: colors.amber })).setDepth(depth.hud);
    const rule = this.add.graphics().setDepth(depth.hud);
    rule.fillStyle(colorNumber(colors.plaster), 0.12);
    rule.fillRect(x, y + GRID.labelHeight - 6, GRID.columnWidth, 2);
    return y + GRID.labelHeight + 6;
  }

  private note(x: number, y: number, text: string, originX = 0): Phaser.GameObjects.Text {
    return this.add.text(x, y, text, monoStyle({ size: typeScale.sm, color: colors.parchmentDeep })).setOrigin(originX, 0).setAlpha(0.7).setDepth(depth.hud);
  }

  private buildColumnA(): void {
    const x = GRID.columns[0];
    let y: number = GRID.top - 6;
    this.add.text(x, y, uiKitCopy.title, displayTitleStyle({ size: 44, color: colors.plaster })).setShadow(3, 3, colors.terracottaDeep, 0, false, true).setDepth(depth.hud);
    y += 54;
    this.note(x, y, uiKitCopy.subtitle);
    y += 30;

    y = this.section(x, y, uiKitCopy.sections.type);
    const specimens: readonly Phaser.GameObjects.Text[] = [
      this.add.text(x, y, "Bricolage 800 display", displayTitleStyle({ size: typeScale.xl, color: colors.ember })),
      this.add.text(x, y + 34, "Heading · Bricolage 600", headingStyle({ size: typeScale.lg, color: colors.plaster })),
      this.add.text(x, y + 62, uiKitCopy.sampleBody, bodyStyle({ size: typeScale.md, color: colors.parchmentDeep })),
      this.add.text(x, y + 88, `speed ${formatReadout(42.5, { decimals: 1, width: 6, unit: "px/s" })}`, monoStyle({ size: 15, bold: true, color: colors.plaster })),
      this.add.text(x, y + 112, "pixel label · silkscreen", pixelLabelStyle({ color: colors.amber })),
    ];
    for (const text of specimens) text.setDepth(depth.hud);
    y += 136 + GRID.sectionGap;

    y = this.section(x, y, uiKitCopy.sections.buttons);
    const rowStep = GRID.buttonHeight + GRID.buttonRowGap;
    // Focus rings reach 6px outside the face, so the grid starts inset by that much.
    const gridX = x + 6;
    const gridY = y + 8;
    const cellWidth = Math.floor((GRID.columnWidth - 12 - GRID.buttonGap) / 2);
    GALLERY_BUTTONS.forEach((spec, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const button = new Button(this, {
        x: gridX + column * (cellWidth + GRID.buttonGap),
        y: gridY + row * rowStep,
        label: spec.label,
        width: cellWidth,
        height: GRID.buttonHeight,
        variant: spec.variant,
        ...(spec.icon ? { icon: spec.icon } : {}),
      });
      button.setDepth(depth.hud);
      if (spec.state === "disabled") button.setEnabled(false);
      else button.showState(spec.state);
      if (spec.focused) button.setFocused(true);
    });
    y = gridY + Math.ceil(GALLERY_BUTTONS.length / 2) * rowStep + GRID.sectionGap - 6;

    // Static replicas of the DOM mute toast (src/ui/SoundToast.ts) for side-by-side review.
    y = this.section(x, y, uiKitCopy.sections2.toast);
    const onChip = this.toastChip(x, y + 4, false);
    this.toastChip(x + onChip + 16, y + 4, true);
  }

  private buildColumnB(): void {
    const x = GRID.columns[1];
    let y: number = GRID.top;

    y = this.section(x, y, uiKitCopy.sections.keycaps);
    let cursor = x;
    const rowY = y + 4;
    let heldLabelX = x;
    let keyHeight = 0;
    for (const key of GALLERY_KEYS) {
      const keycap = new Keycap(this, { x: cursor, y: rowY, label: key }).setDepth(depth.hud);
      keyHeight = keycap.keyHeight;
      // Show the held frame on one key so both keycap states are reviewable.
      if (key === GALLERY_HELD_KEY) {
        keycap.setPressed(true);
        heldLabelX = cursor + keycap.keyWidth / 2;
      }
      cursor += keycap.keyWidth + 8;
    }
    this.note(heldLabelX, rowY + keyHeight + 4, `↑ ${uiKitCopy.pressedKeyNote}`, 0.5);
    y = rowY + keyHeight + 22 + GRID.sectionGap;

    y = this.section(x, y, uiKitCopy.sections.pills);
    UI_STATES.forEach((state, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      new StatePill(this, { x: x + column * 190, y: y + 4 + row * (STATE_PILL_HEIGHT + 10), state, label: stateLabels[state] }).setDepth(depth.hud);
    });
    y += 4 + 3 * (STATE_PILL_HEIGHT + 10) + GRID.sectionGap - 4;

    y = this.section(x, y, uiKitCopy.sections.hud);
    const panel = new HudPanel(this, {
      x,
      y: y + 2,
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
    y += 2 + panel.panelHeight + GRID.sectionGap;

    y = this.section(x, y, uiKitCopy.sections.ticker);
    const ticker = new DashboardTicker(this, { x, y: y + 2, width: GRID.columnWidth, lines: sampleTickerLines });
    ticker.setDepth(depth.hud).finishReveal();
    y += 2 + 34 + GRID.sectionGap + 4;

    // Parchment-surface variants: the same kit sitting on a light card.
    y = this.section(x, y, uiKitCopy.sections2.surfaces);
    const card = new ParchmentCard(this, { x, y: y + 2, width: GRID.columnWidth, height: 84 });
    card.setDepth(depth.hud);
    const pad = card.padding;
    const done = new Button(this, { x: pad, y: pad, label: uiKitCopy.surfaceLabels.done, width: 132, height: 42, variant: "secondary" });
    const esc = new Keycap(this, { x: pad + 132 + 24, y: pad + 5, label: "esc" });
    const enter = new Keycap(this, { x: esc.x + esc.keyWidth + 8, y: pad + 5, label: "enter" });
    card.addContent(
      done,
      esc,
      enter,
      this.add.text(enter.x + enter.keyWidth + 10, pad + 5 + enter.keyHeight / 2, uiKitCopy.surfaceLabels.close, monoStyle({ size: typeScale.sm, color: colors.inkSoft })).setOrigin(0, 0.5),
    );
  }

  /** Draws a toast replica; returns its width. */
  private toastChip(x: number, y: number, muted: boolean): number {
    const label = this.add.text(0, 0, muted ? soundToastCopy.off : soundToastCopy.on, monoStyle({ size: 15, bold: true, color: colors.ink })).setOrigin(0, 0.5);
    const icon = addUiIcon(this, 0, 0, muted ? "soundOff" : "soundOn", { originX: 0 });
    const key = new Keycap(this, { x: 0, y: 0, label: soundToastCopy.hint });
    const padX = 10;
    const height = 46;
    const width = Math.ceil(padX + ICON_DISPLAY_SIZE + 10 + label.width + 10 + key.keyWidth + padX);
    const g = this.add.graphics();
    g.fillStyle(colorNumber(colors.ink), 1);
    fillSteppedRect(g, 3, 3, width, height, STEPPED_CORNER.soft);
    fillSteppedRect(g, 0, 0, width, height, STEPPED_CORNER.soft);
    g.fillStyle(colorNumber(muted ? colors.parchmentDeep : colors.parchmentWarm), 1);
    fillSteppedRect(g, 2, 2, width - 4, height - 4, STEPPED_CORNER.notch);
    icon.setPosition(padX, height / 2);
    label.setPosition(padX + ICON_DISPLAY_SIZE + 10, height / 2);
    key.setPosition(width - padX - key.keyWidth, Math.round((height - key.keyHeight) / 2));
    this.add.container(x, y, [g, icon, label, key]).setDepth(depth.hud);
    return width;
  }

  private buildColumnC(): void {
    const x = GRID.columns[2];
    let y: number = GRID.top;

    y = this.section(x, y, uiKitCopy.sections.meters);
    GALLERY_METERS.forEach((spec, index) => {
      const rowY = y + 4 + index * 24;
      this.add.text(x, rowY + 6, spec.accent, monoStyle({ size: typeScale.sm, color: colors.plaster })).setOrigin(0, 0.5).setAlpha(0.7).setDepth(depth.hud);
      new Meter(this, { x: x + 72, y: rowY, width: 236, height: 12, accent: spec.accent, value: spec.value }).setDepth(depth.hud);
      this.add
        .text(x + GRID.columnWidth, rowY + 6, formatReadout(spec.value * 100, { width: 3, unit: "%" }), monoStyle({ size: typeScale.sm, bold: true, color: colors.plaster }))
        .setOrigin(1, 0.5)
        .setDepth(depth.hud);
    });
    y += 4 + GALLERY_METERS.length * 24 + GRID.sectionGap - 6;

    y = this.section(x, y, uiKitCopy.sections.card);
    const cardHeight = 128;
    const card = new ParchmentCard(this, { x, y: y + 2, width: GRID.columnWidth, height: cardHeight, title: uiKitCopy.sampleCardTitle });
    card.setDepth(depth.hud);
    card.addContent(
      addUiIcon(this, card.padding + ICON_DISPLAY_SIZE / 2, card.contentTop + ICON_DISPLAY_SIZE / 2, "moon"),
      this.add.text(card.padding + ICON_DISPLAY_SIZE + 12, card.contentTop - 2, uiKitCopy.sampleCardBody, bodyStyle({ size: 15, color: colors.inkSoft, wrapWidth: GRID.columnWidth - card.padding * 2 - ICON_DISPLAY_SIZE - 12 })),
    );
    y += 2 + cardHeight + GRID.sectionGap + 2;

    y = this.section(x, y, uiKitCopy.sections.icons);
    const names = Object.keys(UI_ICON_FRAME) as UiIconName[];
    const perRow = 8;
    const step = Math.floor((GRID.columnWidth - ICON_DISPLAY_SIZE) / (perRow - 1));
    names.forEach((name, index) => {
      const cx = x + ICON_DISPLAY_SIZE / 2 + (index % perRow) * step;
      const cy = y + ICON_DISPLAY_SIZE / 2 + 2 + Math.floor(index / perRow) * (ICON_DISPLAY_SIZE + 10);
      addUiIcon(this, cx, cy, name).setDepth(depth.hud);
    });
    y += Math.ceil(names.length / perRow) * (ICON_DISPLAY_SIZE + 10) + GRID.sectionGap - 6;

    y = this.section(x, y, uiKitCopy.sections.touch);
    this.touchRow(x, y + 2, "ink", "thrust");
    this.touchRow(x, y + 2 + TILE.size + TILE.gap, "cream", "left");
  }

  /** One row of touch tiles (left, right, wide thrust) in a tone, with one tile shown held. */
  private touchRow(x: number, y: number, tone: TouchTone, held: string): void {
    const labels = uiKitCopy.touchLabels;
    const zones: TouchZoneDefinition[] = [
      { id: "left", shape: { kind: "rect", x, y, width: TILE.size, height: TILE.size }, label: labels.left, glyph: "left" },
      { id: "right", shape: { kind: "rect", x: x + TILE.size + TILE.gap, y, width: TILE.size, height: TILE.size }, label: labels.right, glyph: "right" },
      tone === "ink"
        ? { id: "thrust", shape: { kind: "rect", x: x + (TILE.size + TILE.gap) * 2, y, width: GRID.columnWidth - (TILE.size + TILE.gap) * 2, height: TILE.size }, label: labels.thrust, icon: "thrust" }
        : { id: "steady", shape: { kind: "rect", x: x + (TILE.size + TILE.gap) * 2, y, width: GRID.columnWidth - (TILE.size + TILE.gap) * 2, height: TILE.size }, label: labels.steady, glyph: "steady" },
    ];
    const touch = new TouchControls(this, { visibility: "always", tone, zones });
    touch.previewDown(held, true);
  }
}
