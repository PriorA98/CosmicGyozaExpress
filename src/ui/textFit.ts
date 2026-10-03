/** Clamp using the renderer's wrapping, including the space needed for the ellipsis. */
export function clampWrappedText(text: string, maxLines: number, wrap: (text: string) => readonly string[]): string {
  if (wrap(text).length <= maxLines) return text;
  let shortened = wrap(text).slice(0, maxLines).join(" ").trimEnd();
  while (shortened.length > 0) {
    shortened = shortened.slice(0, -1).trimEnd();
    const candidate = `${shortened}…`;
    if (wrap(candidate).length <= maxLines) return candidate;
  }
  return "…";
}

/** Whole lines of `lineHeight` that fit in `available` px (at least one, so a quote never vanishes). */
export function quoteLinesThatFit(available: number, lineHeight: number): number {
  if (!(lineHeight > 0) || !Number.isFinite(available)) return 1;
  return Math.max(1, Math.floor(available / lineHeight));
}
