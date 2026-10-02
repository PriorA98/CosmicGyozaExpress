import type { UiIconName } from "../data/assetManifest";
import { soundToastCopy } from "../data/uiCopy";

/** Pure model for the mute toast (no Phaser/DOM; unit-tested in tests/ui.test.ts). */
export const SOUND_TOAST_TIMING = {
  /** How long the toast stays fully visible (ms). */
  holdMs: 1200,
  /** CSS exit transition length (ms); keep in sync with components.css. */
  exitMs: 220,
} as const;

/** Toast sits this fraction of the canvas height below the canvas top edge. */
const TOP_FRACTION = 0.05;
/** Canvas shown narrower than this (CSS px) uses the larger phone toast. */
const COMPACT_CANVAS_WIDTH = 900;

export type SoundToastContent = {
  readonly label: string;
  readonly icon: Extract<UiIconName, "soundOn" | "soundOff">;
  readonly keyHint: string;
};

/** Pure: what the toast says for a mute state. */
export function soundToastContent(muted: boolean): SoundToastContent {
  return muted
    ? { label: soundToastCopy.off, icon: "soundOff", keyHint: soundToastCopy.hint }
    : { label: soundToastCopy.on, icon: "soundOn", keyHint: soundToastCopy.hint };
}

export type ToastAnchor = { readonly left: number; readonly top: number; readonly compact: boolean };

/** Pure: viewport position (CSS px) of the toast's top-centre for a canvas client rect. */
export function soundToastAnchor(rect: { readonly left: number; readonly top: number; readonly width: number; readonly height: number }): ToastAnchor {
  const width = Number.isFinite(rect.width) ? Math.max(0, rect.width) : 0;
  const height = Number.isFinite(rect.height) ? Math.max(0, rect.height) : 0;
  return {
    left: Math.round((Number.isFinite(rect.left) ? rect.left : 0) + width / 2),
    top: Math.round((Number.isFinite(rect.top) ? rect.top : 0) + height * TOP_FRACTION),
    compact: width > 0 && width < COMPACT_CANVAS_WIDTH,
  };
}

