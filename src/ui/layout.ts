/**
 * Pure layout, formatting, and hit-test helpers for the UI kit. No Phaser imports so they can be
 * unit-tested in Node (see tests/ui.test.ts).
 */

/** Smallest font size (screen px at 1280x720) allowed for essential, readable text. */
export const MIN_ESSENTIAL_TEXT_PX = 13;

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Keeps essential text at or above the readability floor. */
export function essentialTextSize(requestedPx: number): number {
  if (!Number.isFinite(requestedPx)) return MIN_ESSENTIAL_TEXT_PX;
  return Math.max(MIN_ESSENTIAL_TEXT_PX, Math.round(requestedPx));
}

/**
 * Fill amount (0..1) for each segment of a segmented meter. Full segments come first, then at
 * most one partial segment, then empty ones. Values outside 0..1 are clamped.
 */
export function segmentFills(value: number, segments: number): number[] {
  const count = Math.max(1, Math.floor(segments));
  const filled = clamp01(value) * count;
  const fills: number[] = [];
  for (let index = 0; index < count; index += 1) {
    fills.push(clamp01(filled - index));
  }
  return fills;
}

/** Width of each segment so `count` segments plus `gap`s exactly fill `totalWidth`. */
export function segmentWidth(totalWidth: number, count: number, gap: number): number {
  const segments = Math.max(1, Math.floor(count));
  return Math.max(1, (totalWidth - gap * (segments - 1)) / segments);
}

export type ReadoutFormat = {
  readonly decimals?: number;
  /** Minimum character width; the value is left-padded with spaces so it never jitters. */
  readonly width?: number;
  readonly unit?: string;
  /** Always show a sign (+/-) so positive and negative values keep the same width. */
  readonly signed?: boolean;
};

/** Formats a numeric instrument readout with stable width (for monospaced fonts). */
export function formatReadout(value: number, format: ReadoutFormat = {}): string {
  const decimals = Math.max(0, Math.floor(format.decimals ?? 0));
  const safe = Number.isFinite(value) ? value : 0;
  const rounded = Number(safe.toFixed(decimals));
  // Avoid "-0" / "-0.0" readouts, which flicker visually around zero.
  const normalized = Object.is(rounded, -0) || rounded === 0 ? 0 : rounded;
  let body = Math.abs(normalized).toFixed(decimals);
  if (format.signed) body = `${normalized < 0 ? "-" : "+"}${body}`;
  else if (normalized < 0) body = `-${body}`;
  const padded = body.padStart(Math.max(0, format.width ?? 0), " ");
  return format.unit ? `${padded} ${format.unit}` : padded;
}

/** Number of characters visible after `elapsedMs` of a typewriter reveal. */
export function typewriterVisibleChars(elapsedMs: number, charsPerSecond: number, length: number): number {
  if (length <= 0) return 0;
  if (!Number.isFinite(charsPerSecond) || charsPerSecond <= 0) return length;
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
  return Math.min(length, Math.floor((elapsedMs / 1000) * charsPerSecond));
}

export const ELLIPSIS = "…";

/**
 * Shortens a single line so it fits `maxChars` characters (monospaced text), ending with an
 * ellipsis when cut. Trailing spaces before the ellipsis are dropped so it reads cleanly.
 */
export function truncateToChars(line: string, maxChars: number): string {
  const limit = Number.isFinite(maxChars) ? Math.floor(maxChars) : line.length;
  if (limit <= 0) return "";
  if (line.length <= limit) return line;
  if (limit === 1) return ELLIPSIS;
  return `${line.slice(0, limit - 1).trimEnd()}${ELLIPSIS}`;
}

/** How many monospaced characters of width `charWidth` fit in `availableWidth`. */
export function monoCharsThatFit(availableWidth: number, charWidth: number): number {
  if (!Number.isFinite(availableWidth) || !Number.isFinite(charWidth) || charWidth <= 0) return 0;
  return Math.max(0, Math.floor(availableWidth / charWidth));
}

/** Snaps a screen-pixel length to whole art pixels for a texture displayed at `artScale`. */
export function toArtPixels(screenPx: number, artScale: number): number {
  const scale = Math.max(1, Math.floor(artScale));
  return Math.max(1, Math.round(screenPx / scale));
}

/** Y offsets for a vertical stack of rows. */
export function stackOffsets(count: number, start: number, rowHeight: number, gap = 0): number[] {
  const offsets: number[] = [];
  for (let index = 0; index < Math.max(0, Math.floor(count)); index += 1) {
    offsets.push(start + index * (rowHeight + gap));
  }
  return offsets;
}

/** Total width of items laid out in a row with a fixed gap. */
export function rowWidth(widths: readonly number[], gap: number): number {
  if (widths.length === 0) return 0;
  return widths.reduce((sum, width) => sum + width, 0) + gap * (widths.length - 1);
}

/** Left x of each item laid out in a row starting at `startX`. */
export function rowOffsets(widths: readonly number[], gap: number, startX = 0): number[] {
  const offsets: number[] = [];
  let cursor = startX;
  for (const width of widths) {
    offsets.push(cursor);
    cursor += width + gap;
  }
  return offsets;
}

export type TouchZoneShape =
  | { readonly kind: "circle"; readonly x: number; readonly y: number; readonly radius: number }
  | { readonly kind: "rect"; readonly x: number; readonly y: number; readonly width: number; readonly height: number };

export type TouchZoneHitArea = {
  readonly id: string;
  readonly shape: TouchZoneShape;
};

export function zoneContains(shape: TouchZoneShape, x: number, y: number): boolean {
  switch (shape.kind) {
    case "circle": {
      const dx = x - shape.x;
      const dy = y - shape.y;
      return dx * dx + dy * dy <= shape.radius * shape.radius;
    }
    case "rect":
      return x >= shape.x && x <= shape.x + shape.width && y >= shape.y && y <= shape.y + shape.height;
  }
}

/** Returns the id of the last (top-most) zone containing the point, or null. */
export function hitTestZones(zones: readonly TouchZoneHitArea[], x: number, y: number): string | null {
  for (let index = zones.length - 1; index >= 0; index -= 1) {
    const zone = zones[index];
    if (zone && zoneContains(zone.shape, x, y)) return zone.id;
  }
  return null;
}

export type TouchCapabilities = {
  readonly maxTouchPoints: number;
  readonly coarsePointer: boolean;
  readonly hasTouchEvents: boolean;
};

/**
 * Touch controls are shown on devices whose primary pointer is coarse and that report touch points.
 * Laptops with touchscreens keep a fine primary pointer and stay keyboard-first until they touch.
 */
export function isLikelyTouchDevice(capabilities: TouchCapabilities): boolean {
  const hasTouch = capabilities.maxTouchPoints > 0 || capabilities.hasTouchEvents;
  return hasTouch && capabilities.coarsePointer;
}
