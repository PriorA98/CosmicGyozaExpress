import Phaser from "phaser";
import type { SettingsPanelCopy } from "../data/uiCopy";
import { colorNumber, colors, typeScale } from "../game/designTokens";
import { emitGameEvent } from "../game/events";
import { Button } from "./Button";
import { uiScaled, uiTextSize } from "./layout";
import { Meter } from "./Meter";
import { Modal } from "./Modal";
import {
  DEFAULT_SOUND_RESTORE,
  SETTINGS_ROWS,
  applySettingsAction,
  isSoundOn,
  nextSettingsRow,
  settingsEqual,
  type SettingsAction,
  type SettingsRowId,
  type SettingsState,
  type SettingsValues,
  type SoundRestore,
} from "./settingsModel";
import { drawRecessedSurface, fillSteppedRect, STEPPED_CORNER } from "./surfaces";
import { bodyStrongStyle, monoStyle } from "./textStyles";

export type SettingsPanelOptions = {
  readonly values: SettingsValues;
  /** Volumes to restore when sound is switched back on (defaults to the save defaults). */
  readonly restore?: SoundRestore;
  readonly copy: SettingsPanelCopy;
  /** Compact-display multiplier (see `compactUiScale`). Default 1. */
  readonly uiScale?: number;
  /** False when storage is unavailable: the footnote says settings last for this tab only. */
  readonly persisted?: boolean;
  /** Show the keyboard hint line (hide on touch devices). Default true. */
  readonly showKeyHints?: boolean;
  /** Called after every change with the new values; the caller persists them. */
  readonly onChange: (values: SettingsValues) => void;
  readonly onClose?: () => void;
};

/** Panel geometry at uiScale 1 (screen px). */
const PANEL = {
  width: 600,
  rowHeight: 58,
  rowGap: 6,
  caretSize: 10,
  labelX: 44,
  switchWidth: 84,
  switchHeight: 32,
  stepperSize: 34,
  meterWidth: 168,
  meterHeight: 16,
  percentWidth: 58,
  controlGap: 10,
  footerHeight: 64,
  footnoteGap: 14,
  doneWidth: 160,
  doneHeight: 48,
  labelSize: 18,
} as const;

type StepperView = {
  readonly graphics: Phaser.GameObjects.Graphics;
  readonly direction: -1 | 1;
  readonly x: number;
  readonly y: number;
};

type RowView = {
  readonly id: SettingsRowId;
  readonly top: number;
  readonly background: Phaser.GameObjects.Graphics;
  readonly control: Phaser.GameObjects.Graphics;
  readonly valueText: Phaser.GameObjects.Text | undefined;
  readonly meter: Meter | undefined;
  readonly steppers: readonly StepperView[];
};

const VOLUME_ROWS: readonly SettingsRowId[] = ["music", "sfx"];
const TOGGLE_ROWS: readonly SettingsRowId[] = ["sound", "motion"];

/**
 * Settings modal: sound on/off, music and effects volume, reduced motion, done. Keyboard: up/down
 * (W/S) choose, left/right (A/D) adjust, enter/space toggle, esc closes. Pointer: rows toggle,
 * steppers adjust. Persisting is the caller's job (see `onChange`); the panel only edits values.
 */
export class SettingsPanel {
  readonly modal: Modal;
  private readonly copy: SettingsPanelCopy;
  private readonly onChange: (values: SettingsValues) => void;
  private readonly uiScale: number;
  private readonly rows: RowView[] = [];
  private readonly doneButton: Button;
  private readonly keyCleanup: () => void;
  private state: SettingsState;
  private selected = 0;
  private keyboardNav = false;

  constructor(private readonly scene: Phaser.Scene, options: SettingsPanelOptions) {
    this.copy = options.copy;
    this.onChange = options.onChange;
    this.uiScale = options.uiScale ?? 1;
    this.state = { values: options.values, restore: options.restore ?? DEFAULT_SOUND_RESTORE };
    const s = this.uiScale;
    const showHints = options.showKeyHints ?? true;

    const width = uiScaled(PANEL.width, s);
    const rowHeight = uiScaled(PANEL.rowHeight, s);
    const rowGap = uiScaled(PANEL.rowGap, s);
    const toggleRows = SETTINGS_ROWS.filter((row) => row !== "done");
    const footnoteSize = uiTextSize(typeScale.sm, s);
    const headerSpace = uiScaled(52, s);
    const height =
      headerSpace + toggleRows.length * (rowHeight + rowGap) + uiScaled(PANEL.footerHeight, s) + (showHints ? footnoteSize * 2 + uiScaled(8, s) : footnoteSize) + uiScaled(28, s);

    this.modal = new Modal(scene, {
      width,
      height,
      title: options.copy.title,
      uiScale: s,
      onClose: () => {
        this.keyCleanup();
        options.onClose?.();
      },
    });
    const card = this.modal.card;
    const pad = card.padding;

    toggleRows.forEach((id, index) => this.addRow(id, card.contentTop + index * (rowHeight + rowGap), width, pad));

    const footerTop = card.contentTop + toggleRows.length * (rowHeight + rowGap) + uiScaled(6, s);
    const doneHeight = uiScaled(PANEL.doneHeight, s);
    this.doneButton = new Button(scene, {
      x: width - pad - uiScaled(PANEL.doneWidth, s),
      y: footerTop + uiScaled(4, s),
      label: options.copy.done,
      width: uiScaled(PANEL.doneWidth, s),
      height: doneHeight,
      variant: "secondary",
      uiScale: s,
      onActivate: () => this.modal.close(),
    });
    card.addContent(this.doneButton);

    const footnote = scene.add
      .text(pad, footerTop + uiScaled(6, s), options.persisted === false ? options.copy.unsaved : options.copy.saved, monoStyle({ size: footnoteSize, color: colors.sageDeep, wrapWidth: width - pad * 3 - uiScaled(PANEL.doneWidth, s) }))
      .setOrigin(0, 0);
    card.addContent(footnote);
    if (showHints) {
      card.addContent(
        scene.add
          .text(pad, footerTop + doneHeight + uiScaled(PANEL.footnoteGap, s), options.copy.hint, monoStyle({ size: footnoteSize, color: colors.inkSoft }))
          .setAlpha(0.72),
      );
    }

    this.keyCleanup = this.wireKeys();
    this.refresh();
  }

  get values(): SettingsValues {
    return this.state.values;
  }

  get selectedRow(): SettingsRowId {
    return SETTINGS_ROWS[this.selected] ?? "sound";
  }

  get isOpen(): boolean {
    return this.modal.active && !this.modal.isClosing;
  }

  close(): void {
    this.modal.close();
  }

  /** Selects a row as if navigated by keyboard (galleries/showcases). */
  previewSelect(row: SettingsRowId): this {
    this.selected = Math.max(0, SETTINGS_ROWS.indexOf(row));
    this.keyboardNav = true;
    this.refresh();
    return this;
  }

  private addRow(id: SettingsRowId, top: number, width: number, pad: number): void {
    const scene = this.scene;
    const s = this.uiScale;
    const rowHeight = uiScaled(PANEL.rowHeight, s);
    const mid = top + Math.round(rowHeight / 2);
    const card = this.modal.card;

    const background = scene.add.graphics();
    const zone = scene.add.zone(pad, top, width - pad * 2, rowHeight).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => this.select(SETTINGS_ROWS.indexOf(id), false));
    zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
      if (TOGGLE_ROWS.includes(id)) this.apply({ kind: "activate", row: id });
    });
    const label = scene.add
      .text(pad + uiScaled(PANEL.labelX, s), mid, this.copy.rows[id as keyof SettingsPanelCopy["rows"]] ?? id, bodyStrongStyle({ size: uiTextSize(PANEL.labelSize, s), color: colors.ink }))
      .setOrigin(0, 0.5);
    const control = scene.add.graphics();
    card.addContent(background, zone, label, control);

    const right = width - pad - uiScaled(12, s);
    let valueText: Phaser.GameObjects.Text | undefined;
    let meter: Meter | undefined;
    const steppers: StepperView[] = [];

    if (VOLUME_ROWS.includes(id)) {
      const percentWidth = uiScaled(PANEL.percentWidth, s);
      const stepper = uiScaled(PANEL.stepperSize, s);
      const gap = uiScaled(PANEL.controlGap, s);
      const meterWidth = uiScaled(PANEL.meterWidth, s);
      const meterHeight = Math.round(uiScaled(PANEL.meterHeight, s) / 2) * 2;
      valueText = scene.add.text(right, mid, "", monoStyle({ size: uiTextSize(typeScale.md, s), bold: true, color: colors.ink })).setOrigin(1, 0.5);
      const plusX = right - percentWidth - stepper;
      const meterX = plusX - gap - meterWidth;
      const minusX = meterX - gap - stepper;
      meter = new Meter(scene, { x: meterX, y: mid - meterHeight / 2, width: meterWidth, height: meterHeight, segments: 10, accent: id === "music" ? "dusk" : "ember" });
      card.addContent(valueText, meter);
      for (const [x, direction] of [
        [minusX, -1],
        [plusX, 1],
      ] as const) {
        const graphics = scene.add.graphics();
        const hit = scene.add.zone(x, mid - stepper / 2, stepper, stepper).setOrigin(0, 0).setInteractive({ useHandCursor: true });
        hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
          this.select(SETTINGS_ROWS.indexOf(id), false);
          this.apply({ kind: "step", row: id, direction });
        });
        card.addContent(graphics, hit);
        steppers.push({ graphics, direction, x, y: mid - stepper / 2 });
      }
    } else {
      valueText = scene.add
        .text(right - uiScaled(PANEL.switchWidth, s) - uiScaled(PANEL.controlGap, s), mid, "", monoStyle({ size: uiTextSize(typeScale.md, s), bold: true, color: colors.inkSoft }))
        .setOrigin(1, 0.5);
      card.addContent(valueText);
    }

    this.rows.push({ id, top, background, control, valueText, meter, steppers });
  }

  private wireKeys(): () => void {
    const keyboard = this.scene.input.keyboard;
    if (!keyboard) return () => undefined;
    const handler = (event: KeyboardEvent): void => {
      if (!this.isOpen || event.repeat) return;
      const row = this.selectedRow;
      switch (event.code) {
        case "ArrowUp":
        case "KeyW":
          this.select(nextSettingsRow(this.selected, -1), true);
          break;
        case "ArrowDown":
        case "KeyS":
        case "Tab":
          this.select(nextSettingsRow(this.selected, 1), true);
          break;
        case "ArrowLeft":
        case "KeyA":
          this.keyboardNav = true;
          this.apply({ kind: "step", row, direction: -1 });
          break;
        case "ArrowRight":
        case "KeyD":
          this.keyboardNav = true;
          this.apply({ kind: "step", row, direction: 1 });
          break;
        case "Enter":
        case "Space":
          this.keyboardNav = true;
          if (row === "done") this.doneButton.activate();
          else this.apply({ kind: "activate", row });
          break;
        default:
          return;
      }
      event.preventDefault();
    };
    keyboard.on("keydown", handler);
    return () => keyboard.off("keydown", handler);
  }

  private select(index: number, fromKeyboard: boolean): void {
    if (index < 0) return;
    if (fromKeyboard) this.keyboardNav = true;
    if (index === this.selected && !fromKeyboard) return;
    const changed = index !== this.selected;
    this.selected = index;
    if (changed) emitGameEvent(this.scene, { type: "ui:hover" });
    this.refresh();
  }

  private apply(action: SettingsAction): void {
    if (action.row === "done") return;
    const next = applySettingsAction(this.state, action);
    if (settingsEqual(next.values, this.state.values)) {
      this.state = next;
      return;
    }
    this.state = next;
    emitGameEvent(this.scene, { type: "ui:confirm" });
    this.onChange(next.values);
    this.refresh();
  }

  private refresh(): void {
    const s = this.uiScale;
    const card = this.modal.card;
    const pad = card.padding;
    const width = card.cardWidth;
    const rowHeight = uiScaled(PANEL.rowHeight, s);
    const values = this.state.values;

    for (const row of this.rows) {
      const selected = this.selectedRow === row.id;
      const bg = row.background;
      bg.clear();
      if (selected) {
        drawRecessedSurface(bg, pad, row.top, width - pad * 2, rowHeight);
        // Pixel caret pointing at the selected row.
        const caret = uiScaled(PANEL.caretSize, s);
        const cx = pad + uiScaled(16, s);
        const cy = row.top + Math.round(rowHeight / 2);
        bg.fillStyle(colorNumber(colors.terracotta), 1);
        for (let step = 0; step < caret / 2; step += 1) {
          const half = Math.max(0, caret / 2 - step);
          bg.fillRect(cx + step * 2, cy - half, 2, half * 2);
        }
      }

      if (row.meter && (row.id === "music" || row.id === "sfx")) {
        const volume = row.id === "music" ? values.musicVolume : values.sfxVolume;
        row.meter.setValue(volume);
        row.valueText?.setText(`${Math.round(volume * 100)}%`);
        for (const stepper of row.steppers) this.drawStepper(stepper, volume);
        continue;
      }
      const on = row.id === "sound" ? isSoundOn(values) : values.reducedMotion;
      row.valueText?.setText(on ? this.copy.on : this.copy.off);
      this.drawSwitch(row.control, width - pad - uiScaled(12, s) - uiScaled(PANEL.switchWidth, s), row.top + Math.round(rowHeight / 2), on);
    }
    this.doneButton.setFocused(this.keyboardNav && this.selectedRow === "done");
  }

  private drawSwitch(g: Phaser.GameObjects.Graphics, x: number, midY: number, on: boolean): void {
    const s = this.uiScale;
    const width = uiScaled(PANEL.switchWidth, s);
    const height = Math.round(uiScaled(PANEL.switchHeight, s) / 2) * 2;
    const y = midY - height / 2;
    const border = 2;
    g.clear();
    g.fillStyle(colorNumber(colors.ink), 1);
    fillSteppedRect(g, x, y, width, height, STEPPED_CORNER.round);
    g.fillStyle(colorNumber(on ? colors.sage : colors.border), 1);
    fillSteppedRect(g, x + border, y + border, width - border * 2, height - border * 2, STEPPED_CORNER.soft);
    // Knob: plaster block with an ink outline and a 2px lip.
    const knob = height - border * 4;
    const knobX = on ? x + width - border * 2 - knob : x + border * 2;
    g.fillStyle(colorNumber(colors.ink), 1);
    fillSteppedRect(g, knobX - border, y + border, knob + border * 2, knob + border * 2, STEPPED_CORNER.notch);
    g.fillStyle(colorNumber(colors.plaster), 1);
    g.fillRect(knobX, y + border * 2, knob, knob - 2);
    g.fillStyle(colorNumber(colors.parchmentDeep), 1);
    g.fillRect(knobX, y + border * 2 + knob - 2, knob, 2);
  }

  private drawStepper(stepper: StepperView, volume: number): void {
    const s = this.uiScale;
    const size = uiScaled(PANEL.stepperSize, s);
    const g = stepper.graphics;
    const disabled = (stepper.direction < 0 && volume <= 0) || (stepper.direction > 0 && volume >= 1);
    g.clear();
    g.fillStyle(colorNumber(colors.ink), 1);
    fillSteppedRect(g, stepper.x, stepper.y, size, size, STEPPED_CORNER.notch);
    g.fillStyle(colorNumber(disabled ? colors.parchmentDeep : colors.plaster), 1);
    g.fillRect(stepper.x + 2, stepper.y + 2, size - 4, size - 7);
    g.fillStyle(colorNumber(colors.borderStrong), 1);
    g.fillRect(stepper.x + 2, stepper.y + size - 5, size - 4, 3);
    // Minus / plus glyph in whole pixels.
    const bar = Math.max(2, Math.round(uiScaled(3, s) / 2) * 2);
    const length = Math.round(size * 0.42 / 2) * 2;
    const cx = stepper.x + Math.round(size / 2);
    const cy = stepper.y + Math.round((size - 3) / 2);
    g.fillStyle(colorNumber(disabled ? colors.borderStrong : colors.ink), 1);
    g.fillRect(cx - length / 2, cy - bar / 2, length, bar);
    if (stepper.direction > 0) g.fillRect(cx - bar / 2, cy - length / 2, bar, length);
  }
}
