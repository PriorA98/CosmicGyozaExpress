/** Clamp using the renderer's wrapping, including the space needed for the ellipsis. */
export function clampWrappedText(text: string, maxLines: number, wrap: (text: string) => readonly string[]): string {
  if (wrap(text).length <= maxLines) return text;
  let shortened = wrap(text).slice(0, maxLines).join(" ").trimEnd();
  while (shortened.length > 0) {
    const candidate = `${shortened}…`;
    if (wrap(candidate).length <= maxLines) return candidate;
    const lastSpace = shortened.search(/\s+\S+$/u);
    shortened = lastSpace >= 0 ? shortened.slice(0, lastSpace).trimEnd() : shortened.slice(0, -1);
  }
  return "…";
}

/** Whole lines of `lineHeight` that fit in `available` px (at least one, so a quote never vanishes). */
export function quoteLinesThatFit(available: number, lineHeight: number, lineSpacing = 0): number {
  if (!(lineHeight > 0) || !Number.isFinite(available)) return 1;
  return Math.max(1, Math.floor((available + lineSpacing) / lineHeight));
}

/** Fit a pixel-font heading on whole font-grid steps; measure with the renderer's actual font. */
export function fittedPixelTextSize(size: number, minSize: number, grid: number, width: number, measure: (size: number) => number): number {
  let fitted = size;
  while (fitted > minSize && measure(fitted) > width) fitted = Math.max(minSize, fitted - grid);
  return fitted;
}
