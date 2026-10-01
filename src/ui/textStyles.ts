import type Phaser from "phaser";
import { colors, fontStacks, typeScale } from "../game/designTokens";
import { essentialTextSize } from "./layout";

export type UiTextStyle = Phaser.Types.GameObjects.Text.TextStyle;

export type TextStyleOptions = {
  readonly size?: number;
  readonly color?: string;
  readonly align?: "left" | "center" | "right";
  readonly wrapWidth?: number;
};

/** Silkscreen is drawn on an 8px grid; 16px keeps each font pixel at 2 screen px (artScale). */
export const PIXEL_LABEL_SIZE = 16;

function withWrap(style: UiTextStyle, options: TextStyleOptions): UiTextStyle {
  if (options.wrapWidth === undefined) return style;
  return { ...style, wordWrap: { width: options.wrapWidth, useAdvancedWrap: true } };
}

/** Hero title (Bricolage 800). Title screens may exceed the type scale. */
export function displayTitleStyle(options: TextStyleOptions = {}): UiTextStyle {
  return withWrap(
    {
      fontFamily: fontStacks.display,
      fontStyle: "800",
      fontSize: `${options.size ?? 96}px`,
      color: options.color ?? colors.plaster,
      align: options.align ?? "left",
    },
    options,
  );
}

/** Screen and card headings (Bricolage 600). */
export function headingStyle(options: TextStyleOptions = {}): UiTextStyle {
  return withWrap(
    {
      fontFamily: fontStacks.display,
      fontStyle: "600",
      fontSize: `${essentialTextSize(options.size ?? typeScale.lg)}px`,
      color: options.color ?? colors.ink,
      align: options.align ?? "left",
    },
    options,
  );
}

/** Body copy (Geist). */
export function bodyStyle(options: TextStyleOptions = {}): UiTextStyle {
  return withWrap(
    {
      fontFamily: fontStacks.ui,
      fontSize: `${essentialTextSize(options.size ?? typeScale.md)}px`,
      color: options.color ?? colors.inkSoft,
      align: options.align ?? "left",
      lineSpacing: 4,
    },
    options,
  );
}

/** Emphasised body copy (Geist 600). */
export function bodyStrongStyle(options: TextStyleOptions = {}): UiTextStyle {
  return { ...bodyStyle(options), fontStyle: "600" };
}

/** Instrument readouts, keycaps, dashboard chatter (JetBrains Mono). */
export function monoStyle(options: TextStyleOptions & { readonly bold?: boolean } = {}): UiTextStyle {
  return withWrap(
    {
      fontFamily: fontStacks.mono,
      fontStyle: options.bold ? "700" : "400",
      fontSize: `${essentialTextSize(options.size ?? typeScale.base)}px`,
      color: options.color ?? colors.plaster,
      align: options.align ?? "left",
    },
    options,
  );
}

/** Small uppercase pixel labels (Silkscreen): badges, panel headers, route stamps. */
export function pixelLabelStyle(options: TextStyleOptions = {}): UiTextStyle {
  return withWrap(
    {
      fontFamily: fontStacks.pixel,
      fontSize: `${essentialTextSize(options.size ?? PIXEL_LABEL_SIZE)}px`,
      color: options.color ?? colors.amber,
      align: options.align ?? "left",
    },
    options,
  );
}
