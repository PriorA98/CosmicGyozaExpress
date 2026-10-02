import type Phaser from "phaser";
import { colorNumber, colors } from "../game/designTokens";
import { uiScaled } from "./layout";
import { fillSteppedRect, STEPPED_CORNER } from "./surfaces";

/**
 * Settings control drawing shared by SettingsPanel and the ui-kit gallery: the pixel toggle
 * switch and the -/+ stepper keys. Geometry is in screen px at uiScale 1.
 */
export const SETTINGS_CONTROL = {
  switchWidth: 84,
  switchHeight: 32,
  stepperSize: 34,
} as const;

/** Pixel toggle: ink frame, sage (on) or border (off) track, plaster knob with a 2px lip. */
export function drawToggleSwitch(g: Phaser.GameObjects.Graphics, x: number, midY: number, on: boolean, uiScale = 1): void {
  const width = uiScaled(SETTINGS_CONTROL.switchWidth, uiScale);
  const height = Math.round(uiScaled(SETTINGS_CONTROL.switchHeight, uiScale) / 2) * 2;
  const y = midY - height / 2;
  const border = 2;
  g.fillStyle(colorNumber(colors.ink), 1);
  fillSteppedRect(g, x, y, width, height, STEPPED_CORNER.round);
  g.fillStyle(colorNumber(on ? colors.sage : colors.border), 1);
  fillSteppedRect(g, x + border, y + border, width - border * 2, height - border * 2, STEPPED_CORNER.soft);
  const knob = height - border * 4;
  const knobX = on ? x + width - border * 2 - knob : x + border * 2;
  g.fillStyle(colorNumber(colors.ink), 1);
  fillSteppedRect(g, knobX - border, y + border, knob + border * 2, knob + border * 2, STEPPED_CORNER.notch);
  g.fillStyle(colorNumber(colors.plaster), 1);
  g.fillRect(knobX, y + border * 2, knob, knob - 2);
  g.fillStyle(colorNumber(colors.parchmentDeep), 1);
  g.fillRect(knobX, y + border * 2 + knob - 2, knob, 2);
}

/** Stepper key (-1 minus, +1 plus): plaster keycap with a strong lip; greyed when at its limit. */
export function drawStepperKey(g: Phaser.GameObjects.Graphics, x: number, y: number, direction: -1 | 1, disabled: boolean, uiScale = 1): void {
  const size = uiScaled(SETTINGS_CONTROL.stepperSize, uiScale);
  g.fillStyle(colorNumber(colors.ink), 1);
  fillSteppedRect(g, x, y, size, size, STEPPED_CORNER.notch);
  g.fillStyle(colorNumber(disabled ? colors.parchmentDeep : colors.plaster), 1);
  g.fillRect(x + 2, y + 2, size - 4, size - 7);
  g.fillStyle(colorNumber(colors.borderStrong), 1);
  g.fillRect(x + 2, y + size - 5, size - 4, 3);
  // Minus / plus glyph in whole pixels.
  const bar = Math.max(2, Math.round(uiScaled(3, uiScale) / 2) * 2);
  const length = Math.round((size * 0.42) / 2) * 2;
  const cx = x + Math.round(size / 2);
  const cy = y + Math.round((size - 3) / 2);
  g.fillStyle(colorNumber(disabled ? colors.borderStrong : colors.ink), 1);
  g.fillRect(cx - length / 2, cy - bar / 2, length, bar);
  if (direction > 0) g.fillRect(cx - bar / 2, cy - length / 2, bar, length);
}
