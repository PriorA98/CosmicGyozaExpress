import type Phaser from "phaser";

/**
 * Pixel-true shape helpers for the landing aids. Every shape is built from axis-aligned cells on an
 * art-pixel grid (`cell` screen px per art px, normally artScale 2), so nothing renders as a smooth
 * anti-aliased vector next to the pixel scenery. The span math is pure and unit-tested; the draw
 * helpers only need a Graphics instance.
 */

/** One horizontal run of cells, relative to the shape centre (screen px). */
export type PixelSpan = {
  readonly y: number;
  readonly x: number;
  readonly width: number;
  readonly height: number;
};

/** Snaps a screen coordinate onto the art-pixel grid. */
export function snapToGrid(value: number, cell: number): number {
  return Math.round(value / cell) * cell;
}

/** Half-width (in cells) of each ellipse row, top row first. Rows are `cell` tall; the ellipse is 2*rows cells tall. */
export function ellipseRowHalfWidths(radiusX: number, radiusY: number, cell: number): number[] {
  const halfRows = Math.max(1, Math.round(radiusY / cell));
  const halfCols = Math.max(1, radiusX / cell);
  const widths: number[] = [];
  for (let row = -halfRows; row < halfRows; row += 1) {
    const centre = (row + 0.5) / halfRows;
    const n = Math.round(halfCols * Math.sqrt(Math.max(0, 1 - centre * centre)));
    widths.push(Math.max(0, n));
  }
  return widths;
}

/** Filled pixel ellipse as one span per row. */
export function filledEllipseSpans(radiusX: number, radiusY: number, cell: number): PixelSpan[] {
  const widths = ellipseRowHalfWidths(radiusX, radiusY, cell);
  const halfRows = widths.length / 2;
  const spans: PixelSpan[] = [];
  widths.forEach((n, index) => {
    if (n <= 0) return;
    spans.push({ y: (index - halfRows) * cell, x: -n * cell, width: n * 2 * cell, height: cell });
  });
  return spans;
}

/** One-cell pixel ellipse outline: the filled cells that touch an empty neighbour. */
export function outlineEllipseSpans(radiusX: number, radiusY: number, cell: number): PixelSpan[] {
  const widths = ellipseRowHalfWidths(radiusX, radiusY, cell);
  const halfRows = widths.length / 2;
  const spans: PixelSpan[] = [];
  widths.forEach((n, index) => {
    if (n <= 0) return;
    const above = widths[index - 1] ?? 0;
    const below = widths[index + 1] ?? 0;
    let inner = Math.min(above, below);
    if (inner >= n) inner = n - 1;
    const y = (index - halfRows) * cell;
    if (inner <= 0) {
      spans.push({ y, x: -n * cell, width: n * 2 * cell, height: cell });
      return;
    }
    const run = (n - inner) * cell;
    spans.push({ y, x: -n * cell, width: run, height: cell });
    spans.push({ y, x: inner * cell, width: run, height: cell });
  });
  return spans;
}

/** Cells of a dotted vertical line from `top` to `bottom` (screen px), one `dot`-sized cell every `step` px. */
export function dottedLineCells(top: number, bottom: number, step: number, dot: number): number[] {
  const cells: number[] = [];
  if (step <= 0 || bottom - top < dot) return cells;
  for (let y = snapToGrid(top, dot); y + dot <= bottom; y += step) cells.push(y);
  return cells;
}

/** Draws spans around (cx, cy), snapping the centre onto the grid first. */
export function drawSpans(graphics: Phaser.GameObjects.Graphics, cx: number, cy: number, spans: readonly PixelSpan[], cell: number): void {
  const ox = snapToGrid(cx, cell);
  const oy = snapToGrid(cy, cell);
  for (const span of spans) graphics.fillRect(ox + span.x, oy + span.y, span.width, span.height);
}

/** Rectangle with one-cell notched corners: the pixel-art take on a rounded panel. */
export function fillNotchedRect(graphics: Phaser.GameObjects.Graphics, x: number, y: number, width: number, height: number, cell: number): void {
  graphics.fillRect(x + cell, y, width - cell * 2, height);
  graphics.fillRect(x, y + cell, cell, height - cell * 2);
  graphics.fillRect(x + width - cell, y + cell, cell, height - cell * 2);
}

/** One-cell outline of a notched rectangle. */
export function strokeNotchedRect(graphics: Phaser.GameObjects.Graphics, x: number, y: number, width: number, height: number, cell: number): void {
  graphics.fillRect(x + cell, y, width - cell * 2, cell);
  graphics.fillRect(x + cell, y + height - cell, width - cell * 2, cell);
  graphics.fillRect(x, y + cell, cell, height - cell * 2);
  graphics.fillRect(x + width - cell, y + cell, cell, height - cell * 2);
}

/**
 * Draws a tiny bitmap ("#" = filled, anything else = empty) with its top-left at (x, y).
 * `flipX` mirrors it, for left/right arrows from one authored pattern.
 */
export function drawBitmap(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  rows: readonly string[],
  cell: number,
  flipX = false,
): void {
  rows.forEach((row, rowIndex) => {
    const width = row.length;
    for (let col = 0; col < width; col += 1) {
      if (row[col] !== "#") continue;
      const drawCol = flipX ? width - 1 - col : col;
      graphics.fillRect(x + drawCol * cell, y + rowIndex * cell, cell, cell);
    }
  });
}

/** Width/height (screen px) of a bitmap drawn at `cell`. */
export function bitmapSize(rows: readonly string[], cell: number): { readonly width: number; readonly height: number } {
  const cols = rows.reduce((max, row) => Math.max(max, row.length), 0);
  return { width: cols * cell, height: rows.length * cell };
}

/**
 * A hard-edged pixel glow: `rings` concentric filled ellipses, each drawn at `alphaPerRing`, so the
 * centre stacks brighter in clean steps instead of a smooth radial gradient. Use with ADD blending.
 */
export function drawSteppedGlow(
  graphics: Phaser.GameObjects.Graphics,
  radiusX: number,
  radiusY: number,
  rings: number,
  color: number,
  alphaPerRing: number,
  cell: number,
): void {
  const count = Math.max(1, Math.floor(rings));
  for (let ring = 0; ring < count; ring += 1) {
    const t = 1 - ring / count;
    graphics.fillStyle(color, alphaPerRing);
    drawSpans(graphics, 0, 0, filledEllipseSpans(radiusX * t, radiusY * t, cell), cell);
  }
}
