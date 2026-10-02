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
 * Compact-display scaling (see `compactUiScale` in src/game/displayScale.ts). Components accept
 * an optional `uiScale` (1 on desktop, up to ~1.6 on phones). Text scales smoothly; pixel art
 * and pixel fonts snap to whole multiples of their grid so they stay crisp.
 */
export const COMPACT_UI_THRESHOLD = 1.25;
/** Silkscreen is drawn on an 8px grid: 16px = 2 screen px per font pixel, 24px = 3. */
const PIXEL_FONT_GRID = 8;

function safeScale(uiScale: number): number {
  return Number.isFinite(uiScale) && uiScale > 0 ? uiScale : 1;
}

/** Scales a geometry length (px) by `uiScale`, rounded to whole pixels. */
export function uiScaled(px: number, uiScale = 1): number {
  return Math.round(px * safeScale(uiScale));
}

/** Scales a font size by `uiScale`, never below the essential-text floor. */
export function uiTextSize(px: number, uiScale = 1): number {
  return essentialTextSize(px * safeScale(uiScale));
}

/**
 * Secondary text (footnotes, stat labels, notices) never drops below this size *before* the
 * compact multiplier, so on a phone it still renders at ~12 CSS px (critic floor: >= 10 px).
 */
export const COMPACT_SECONDARY_MIN_PX = 15;

/** Like `uiTextSize`, but compact displays lift secondary text to `COMPACT_SECONDARY_MIN_PX`. */
export function uiSecondaryTextSize(px: number, uiScale = 1): number {
  const compact = safeScale(uiScale) >= COMPACT_UI_THRESHOLD;
  return uiTextSize(compact ? Math.max(px, COMPACT_SECONDARY_MIN_PX) : px, uiScale);
}

/** Silkscreen label size snapped to its 8px grid: 16 at desktop, 24 once the UI is compact. */
export function uiPixelLabelSize(uiScale = 1, base = 16): number {
  const scale = safeScale(uiScale);
  if (scale < COMPACT_UI_THRESHOLD) return base;
  const snapped = Math.round((base * scale) / PIXEL_FONT_GRID) * PIXEL_FONT_GRID;
  return Math.max(base + PIXEL_FONT_GRID, snapped);
}

/** Integer display scale for 16px ui icons: 2 at desktop, 3 once the UI is compact. */
export function uiIconScale(uiScale = 1, base = 2): number {
  return safeScale(uiScale) >= COMPACT_UI_THRESHOLD ? base + 1 : base;
}

/** Segment fills are snapped to this many steps per segment. */
const SEGMENT_FILL_RESOLUTION = 1000;
/** Partial fills closer than this to empty/full snap to 0/1 (no hairline segments). */
export const SEGMENT_FILL_EPSILON = 0.01;

/**
 * Fill amount (0..1) for each segment of a segmented meter. Full segments come first, then at
 * most one partial segment, then empty ones. Values outside 0..1 are clamped.
 */
export function segmentFills(value: number, segments: number): number[] {
  const count = Math.max(1, Math.floor(segments));
  // Snap to 1/1000 of a segment first so float noise (0.7 -> 0.7000000000000001) never lights a
  // phantom partial segment; slivers below SEGMENT_FILL_EPSILON read as empty.
  const filled = Math.round(clamp01(value) * count * SEGMENT_FILL_RESOLUTION) / SEGMENT_FILL_RESOLUTION;
  const fills: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const fill = clamp01(filled - index);
    fills.push(fill < SEGMENT_FILL_EPSILON ? 0 : fill > 1 - SEGMENT_FILL_EPSILON ? 1 : fill);
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

/**
 * Greedy word wrap for monospaced text: at most `maxLines` lines of `maxChars` characters. Words
 * longer than a line are hard-split. Text that still does not fit ends the last line with an
 * ellipsis (via `truncateToChars`). Whitespace runs collapse to single spaces.
 */
export function wrapMonoLines(text: string, maxChars: number, maxLines: number): string[] {
  const limit = Number.isFinite(maxChars) ? Math.floor(maxChars) : Number.MAX_SAFE_INTEGER;
  const linesAllowed = Math.max(1, Number.isFinite(maxLines) ? Math.floor(maxLines) : 1);
  if (limit <= 0) return [];
  const words = text.trim().split(/\s+/).filter((word) => word.length > 0);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    let rest = word;
    while (rest.length > 0) {
      const candidate = current.length === 0 ? rest : `${current} ${rest}`;
      if (candidate.length <= limit) {
        current = candidate;
        rest = "";
      } else if (current.length > 0) {
        lines.push(current);
        current = "";
      } else {
        // A single word wider than the line: split it hard.
        lines.push(rest.slice(0, limit));
        rest = rest.slice(limit);
      }
    }
  }
  if (current.length > 0) lines.push(current);
  if (lines.length <= linesAllowed) return lines;
  const kept = lines.slice(0, linesAllowed - 1);
  const overflow = lines.slice(linesAllowed - 1).join(" ");
  kept.push(truncateToChars(overflow, limit));
  return kept;
}

/**
 * Dashboard ticker text metrics (DashboardTicker uses these; pure so copy-length tests can check
 * scene chatter against a ticker width without Phaser). JetBrains Mono advances 0.6 em per glyph.
 */
export const TICKER_METRICS = {
  fontPx: 14,
  monoAdvanceEm: 0.6,
  /** Prompt column (padding + "›" + gap) before the text. */
  textInsetLeft: 28,
  /** Right padding + caret gap + caret width after the text. */
  textInsetRight: 23,
} as const;

/** Characters that fit on one ticker line of a given width (screen px at ticker scale 1). */
export function tickerCharsPerLine(width: number, charWidth: number = TICKER_METRICS.fontPx * TICKER_METRICS.monoAdvanceEm): number {
  return monoCharsThatFit(width - TICKER_METRICS.textInsetLeft - TICKER_METRICS.textInsetRight, charWidth);
}

/** True when a chatter line fits a ticker of `width` in `maxLines` lines without an ellipsis. */
export function fitsTicker(line: string, width: number, maxLines = 1): boolean {
  const wrapped = wrapMonoLines(line, tickerCharsPerLine(width), maxLines);
  return !wrapped.some((wrappedLine) => wrappedLine.endsWith(ELLIPSIS));
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

export type Point = { readonly x: number; readonly y: number };

/** Point on a quadratic Bezier curve at `t` (clamped to 0..1). */
export function quadraticPoint(p0: Point, p1: Point, p2: Point, t: number): Point {
  const u = clamp01(t);
  const a = (1 - u) * (1 - u);
  const b = 2 * u * (1 - u);
  const c = u * u;
  return { x: a * p0.x + b * p1.x + c * p2.x, y: a * p0.y + b * p1.y + c * p2.y };
}

export type RouteDot = Point & { readonly t: number };

/**
 * Evenly spaced dots (by arc length, whole-pixel positions) along a quadratic route, for dotted
 * route lines. `samples` controls the arc-length approximation.
 */
export function dotsAlongQuadratic(p0: Point, p1: Point, p2: Point, spacing: number, samples = 160): RouteDot[] {
  if (!Number.isFinite(spacing) || spacing <= 0) return [];
  const steps = Math.max(2, Math.floor(samples));
  const dots: RouteDot[] = [];
  let previous = quadraticPoint(p0, p1, p2, 0);
  let carried = 0;
  dots.push({ x: Math.round(previous.x), y: Math.round(previous.y), t: 0 });
  for (let index = 1; index <= steps; index += 1) {
    const t = index / steps;
    const point = quadraticPoint(p0, p1, p2, t);
    carried += Math.hypot(point.x - previous.x, point.y - previous.y);
    if (carried >= spacing) {
      dots.push({ x: Math.round(point.x), y: Math.round(point.y), t });
      carried -= spacing;
    }
    previous = point;
  }
  return dots;
}
