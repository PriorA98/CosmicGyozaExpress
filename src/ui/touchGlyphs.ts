/**
 * Pixel glyphs for touch tiles (pure, no Phaser): arrow and steady marks generated on a small
 * cell grid so every direction shares the exact same silhouette. Cells are [x, y] in glyph units.
 */
export type TouchGlyph = "left" | "right" | "up" | "down" | "steady";

export type GlyphCells = {
  readonly width: number;
  readonly height: number;
  readonly cells: readonly (readonly [number, number])[];
};

/** Arrow silhouette: a triangle head `HEAD` cells long and a 3-cell-thick shaft. */
const ARROW = { length: 11, height: 9, head: 5, shaftHalf: 1 } as const;

const STEADY_ROWS: readonly string[] = [
  "pp.....pp",
  "p.......p",
  "...ppp...",
  "..ppppp..",
  "...ppp...",
  "p.......p",
  "pp.....pp",
];

/** Cells of a left-pointing arrow (other directions are mirrors/transposes of it). */
function leftArrow(): [number, number][] {
  const cells: [number, number][] = [];
  const mid = (ARROW.height - 1) / 2;
  for (let y = 0; y < ARROW.height; y += 1) {
    const distance = Math.abs(y - mid);
    for (let x = 0; x < ARROW.length; x += 1) {
      const inHead = x < ARROW.head && x >= distance;
      const inShaft = x >= ARROW.head - 1 && distance <= ARROW.shaftHalf;
      if (inHead || inShaft) cells.push([x, y]);
    }
  }
  return cells;
}

export function touchGlyphCells(glyph: TouchGlyph): GlyphCells {
  switch (glyph) {
    case "left":
      return { width: ARROW.length, height: ARROW.height, cells: leftArrow() };
    case "right":
      return { width: ARROW.length, height: ARROW.height, cells: leftArrow().map(([x, y]) => [ARROW.length - 1 - x, y] as const) };
    case "up":
      return { width: ARROW.height, height: ARROW.length, cells: leftArrow().map(([x, y]) => [y, x] as const) };
    case "down":
      return { width: ARROW.height, height: ARROW.length, cells: leftArrow().map(([x, y]) => [y, ARROW.length - 1 - x] as const) };
    case "steady": {
      const cells: [number, number][] = [];
      STEADY_ROWS.forEach((row, y) => {
        for (let x = 0; x < row.length; x += 1) if (row.charAt(x) === "p") cells.push([x, y]);
      });
      return { width: STEADY_ROWS[0]?.length ?? 0, height: STEADY_ROWS.length, cells };
    }
  }
}
