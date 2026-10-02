import Phaser from "phaser";
import { ASSET, UI_ICON_FRAME, type UiIconName } from "../data/assetManifest";
import { sampleTickerLines, soundToastCopy, stateLabels, uiKitCopy } from "../data/uiCopy";
import { colorNumber, colors, depth, typeScale } from "../game/designTokens";
import { emitGameEvent } from "../game/events";
import { Button, type ButtonOptions, type ButtonVisualState } from "../ui/Button";
import { DashboardTicker, dashboardTickerHeight } from "../ui/DashboardTicker";
import { HudPanel } from "../ui/HudPanel";
import { addUiIcon, ICON_DISPLAY_SIZE } from "../ui/icons";
import { Keycap } from "../ui/Keycap";
import { formatReadout } from "../ui/layout";
import { Meter } from "../ui/Meter";
import { CollectedStamp, SaveNoticeChip } from "../ui/NoticeChips";
import { ParchmentCard } from "../ui/ParchmentCard";
import { drawStepperKey, drawToggleSwitch, SETTINGS_CONTROL } from "../ui/settingsControls";
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
  /** Wells span y wellTop..(height - wellTop); content keeps `bottomPad` clear above the edge. */
  wellTop: 14,
  bottomPad: 16,
  sectionGap: 14,
  labelHeight: 26,
  buttonGap: 16,
  buttonHeight: 42,
  buttonRowGap: 14,
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

/** DOM mute toast replica height (matches .sound-toast at 15px text + keycap). */
const TOAST_HEIGHT = 46;

const GALLERY_KEYS: readonly string[] = ["W", "A", "S", "D", "space", "enter", "M", "esc"];
const GALLERY_HELD_KEY = "W";

/** Touch tile size in the gallery (square tiles + one wide thrust tile). */
const TILE = { size: 84, wide: 168, gap: 12 } as const;

/** Mini settings card in the gallery (screen px). */
const SETTINGS_SAMPLE = { height: 112, padding: 14, labelWidth: 64, controlGap: 8, percentWidth: 44, meterHeight: 16, volume: 0.7 } as const;

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
      fillSteppedRect(g, x - GRID.wellPad, GRID.wellTop, GRID.columnWidth + GRID.wellPad * 2, height - GRID.wellTop * 2, STEPPED_CORNER.round);
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

  /** Dev guard: every column keeps `GRID.bottomPad` clear above its well edge. */
  private assertFits(bottom: number): void {
    const limit = this.scale.height - GRID.wellTop - GRID.bottomPad;
    if (bottom > limit) console.warn(`[ui-kit] column content ends at ${Math.round(bottom)}, past ${limit}`);
  }

  private buildColumnA(): void {
    const x = GRID.columns[0];
    let y: number = GRID.top - 6;
    this.add.text(x, y, uiKitCopy.title, displayTitleStyle({ size: 40, color: colors.plaster })).setShadow(3, 3, colors.terracottaDeep, 0, false, true).setDepth(depth.hud);
    y += 50;
    this.note(x, y, uiKitCopy.subtitle);
    y += 26;

    y = this.section(x, y, uiKitCopy.sections.type);
    const specimens: readonly Phaser.GameObjects.Text[] = [
      this.add.text(x, y, "Bricolage 800 display", displayTitleStyle({ size: typeScale.xl, color: colors.ember })),
      this.add.text(x, y + 34, "Heading · Bricolage 600", headingStyle({ size: typeScale.lg, color: colors.plaster })),
      this.add.text(x, y + 62, uiKitCopy.sampleBody, bodyStyle({ size: typeScale.md, color: colors.parchmentDeep })),
      this.add.text(x, y + 88, `speed ${formatReadout(42.5, { decimals: 1, width: 6, unit: "px/s" })}`, monoStyle({ size: 15, bold: true, color: colors.plaster })),
      this.add.text(x, y + 112, "pixel label · silkscreen", pixelLabelStyle({ color: colors.amber })),
    ];
    for (const text of specimens) text.setDepth(depth.hud);
    y += 130 + GRID.sectionGap;

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
    y = gridY + Math.ceil(GALLERY_BUTTONS.length / 2) * rowStep + GRID.sectionGap - 10;

    // Notices: static replicas of the DOM mute toast (src/ui/SoundToast.ts) and the title's save note.
    y = this.section(x, y, uiKitCopy.sections2.notices);
    const onChip = this.toastChip(x, y + 2, false);
    this.toastChip(x + onChip + 16, y + 2, true);
    y += 2 + TOAST_HEIGHT + 3 + 12;
    const notice = new SaveNoticeChip(this, { x, y, text: uiKitCopy.noticeSamples.save, maxWidth: GRID.columnWidth });
    notice.setDepth(depth.hud);
    this.assertFits(y + notice.chipHeight);
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

    // The phone grid: every flight row kept in two columns (HudPanel `columns: 2`).
    y = this.section(x, y, uiKitCopy.sections.hud);
    const rows = uiKitCopy.hudGridRows;
    const panel = new HudPanel(this, {
      x,
      y: y + 2,
      width: GRID.columnWidth,
      title: uiKitCopy.hudGridTitle,
      icon: "radar",
      columns: 2,
      rows: [
        { id: "speed", label: rows.speed, value: formatReadout(1.7, { decimals: 1, unit: "km/s" }) },
        { id: "moon", label: rows.moon, value: formatReadout(14, { decimals: 1, unit: "km" }) },
        { id: "bottom", label: rows.bottom, value: "269°" },
        { id: "package", label: rows.package, kind: "meter", value: 0.82, accent: "sage" },
      ],
    });
    panel.setDepth(depth.hud);
    y += 2 + panel.panelHeight + GRID.sectionGap;

    // Two-line ticker: long chatter wraps instead of losing its punchline to an ellipsis.
    y = this.section(x, y, uiKitCopy.sections.ticker);
    const ticker = new DashboardTicker(this, { x, y: y + 2, width: GRID.columnWidth, lines: sampleTickerLines, maxLines: 2 });
    ticker.setDepth(depth.hud).finishReveal();
    y += 2 + dashboardTickerHeight(2) + GRID.sectionGap;

    // Settings controls on parchment: toggles on/off, the volume stepper row.
    y = this.section(x, y, uiKitCopy.sections2.settings);
    this.settingsControls(x, y + 2);
  }

  /** Mini settings card: two toggles side by side, then a -/meter/+ volume row. */
  private settingsControls(x: number, y: number): void {
    const spec = SETTINGS_SAMPLE;
    const card = new ParchmentCard(this, { x, y, width: GRID.columnWidth, height: spec.height, padding: spec.padding });
    card.setDepth(depth.hud);
    const pad = card.padding;
    const labels = uiKitCopy.settingsSample;
    const label = (lx: number, ly: number, text: string): Phaser.GameObjects.Text =>
      this.add.text(lx, ly, text, monoStyle({ size: typeScale.base, bold: true, color: colors.ink })).setOrigin(0, 0.5);
    const g = this.add.graphics();
    const half = Math.floor((GRID.columnWidth - pad * 2) / 2);
    const rowA = pad + SETTINGS_CONTROL.switchHeight / 2 + 2;
    drawToggleSwitch(g, pad + half - SETTINGS_CONTROL.switchWidth - spec.controlGap * 2, rowA, true);
    drawToggleSwitch(g, pad + half * 2 - SETTINGS_CONTROL.switchWidth, rowA, false);

    const stepper = SETTINGS_CONTROL.stepperSize;
    const rowB = spec.height - pad - stepper / 2 - 4;
    const minusX = pad + spec.labelWidth;
    const plusX = GRID.columnWidth - pad - spec.percentWidth - stepper;
    const meterX = minusX + stepper + spec.controlGap;
    drawStepperKey(g, minusX, rowB - stepper / 2, -1, false);
    drawStepperKey(g, plusX, rowB - stepper / 2, 1, false);
    const meter = new Meter(this, {
      x: meterX,
      y: rowB - spec.meterHeight / 2,
      width: plusX - spec.controlGap - meterX,
      height: spec.meterHeight,
      segments: 10,
      accent: "dusk",
      value: spec.volume,
    });
    card.addContent(
      g,
      meter,
      label(pad, rowA, labels.sound),
      label(pad + half + spec.controlGap, rowA, labels.motion),
      label(pad, rowB, labels.music),
      this.add.text(GRID.columnWidth - pad, rowB, `${Math.round(spec.volume * 100)}%`, monoStyle({ size: typeScale.md, bold: true, color: colors.ink })).setOrigin(1, 0.5),
    );
    this.assertFits(y + spec.height + 3);
  }

  /** Draws a toast replica; returns its width. */
  private toastChip(x: number, y: number, muted: boolean): number {
    const label = this.add.text(0, 0, muted ? soundToastCopy.off : soundToastCopy.on, monoStyle({ size: 15, bold: true, color: colors.ink })).setOrigin(0, 0.5);
    const icon = addUiIcon(this, 0, 0, muted ? "soundOff" : "soundOn", { originX: 0 });
    const key = new Keycap(this, { x: 0, y: 0, label: soundToastCopy.hint });
    const padX = 10;
    const height = TOAST_HEIGHT;
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
    const cardHeight = 118;
    const card = new ParchmentCard(this, { x, y: y + 2, width: GRID.columnWidth, height: cardHeight, title: uiKitCopy.sampleCardTitle });
    card.setDepth(depth.hud);
    // Completion stamp lives inside the header, flush with the inner padding (as on the title card).
    const stamp = new CollectedStamp(this, { x: 0, y: 0, label: uiKitCopy.noticeSamples.stamp });
    stamp.setPosition(GRID.columnWidth - card.padding - stamp.stampWidth, Math.round(card.headerHeight / 2 + 2 - stamp.stampHeight / 2));
    card.addContent(
      stamp,
      addUiIcon(this, card.padding + ICON_DISPLAY_SIZE / 2, card.contentTop + ICON_DISPLAY_SIZE / 2, "moon"),
      this.add.text(card.padding + ICON_DISPLAY_SIZE + 12, card.contentTop - 2, uiKitCopy.sampleCardBody, bodyStyle({ size: 15, color: colors.inkSoft, wrapWidth: GRID.columnWidth - card.padding * 2 - ICON_DISPLAY_SIZE - 12 })),
    );
    y += 2 + cardHeight + GRID.sectionGap;

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
    this.assertFits(y + 2 + TILE.size * 2 + TILE.gap + 4);
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
