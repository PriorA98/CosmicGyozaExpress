/**
 * Self-hosted OFL fonts (see public/assets/fonts). Loaded with the FontFace API so paths stay
 * relative to the document base (works for local dev and the GitHub Pages sub-path).
 * Failures fall back to the CSS stacks in designTokens.fontStacks and never block boot.
 */
type FontFile = {
  readonly family: string;
  readonly weight: string;
  readonly file: string;
};

const FONT_FILES: readonly FontFile[] = [
  { family: "Bricolage Grotesque", weight: "600", file: "bricolage-grotesque-latin-600-normal.woff2" },
  { family: "Bricolage Grotesque", weight: "800", file: "bricolage-grotesque-latin-800-normal.woff2" },
  { family: "Geist", weight: "400", file: "geist-sans-latin-400-normal.woff2" },
  { family: "Geist", weight: "600", file: "geist-sans-latin-600-normal.woff2" },
  { family: "JetBrains Mono", weight: "400", file: "jetbrains-mono-latin-400-normal.woff2" },
  { family: "JetBrains Mono", weight: "700", file: "jetbrains-mono-latin-700-normal.woff2" },
  { family: "Silkscreen", weight: "400", file: "silkscreen-latin-400-normal.woff2" },
  { family: "Silkscreen", weight: "700", file: "silkscreen-latin-700-normal.woff2" },
];

export type FontLoadReport = {
  readonly loaded: readonly string[];
  readonly failed: readonly string[];
};

export async function loadGameFonts(timeoutMs = 3000): Promise<FontLoadReport> {
  if (typeof FontFace === "undefined" || typeof document === "undefined") {
    return { loaded: [], failed: FONT_FILES.map((font) => font.file) };
  }

  const loaded: string[] = [];
  const failed: string[] = [];

  const attempts = FONT_FILES.map(async (font) => {
    try {
      const url = new URL(`assets/fonts/${font.file}`, document.baseURI).href;
      const face = new FontFace(font.family, `url(${url}) format("woff2")`, { weight: font.weight });
      await face.load();
      document.fonts.add(face);
      loaded.push(font.file);
    } catch {
      failed.push(font.file);
    }
  });

  const timeout = new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, timeoutMs);
  });

  await Promise.race([Promise.all(attempts), timeout]);

  const settled = new Set([...loaded, ...failed]);
  for (const font of FONT_FILES) {
    if (!settled.has(font.file)) failed.push(font.file);
  }

  return { loaded, failed };
}
