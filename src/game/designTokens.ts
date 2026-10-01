export const colors = {
  ink: "#1D1F33",
  inkSoft: "#2F3149",
  cosmos: "#1A1B2E",
  cosmosDeep: "#0E0F1C",
  cosmosPanel: "#14162B",
  slate700: "#3D3E4D",
  parchment: "#F4ECDC",
  parchmentDeep: "#ECDFC5",
  parchmentWarm: "#F9F3E5",
  plaster: "#FBF7EC",
  wallpaper: "#E8D9BD",
  border: "#D7CDB5",
  borderStrong: "#B9AB8B",
  terracotta: "#C97B5A",
  terracottaDeep: "#A6614A",
  ember: "#E08A4B",
  amber: "#D4A055",
  sage: "#8DA17A",
  sageDeep: "#6B7E5A",
  duskBlue: "#9EB6C4",
  plum: "#9B8FB8",
  teal: "#6FA39A",
  brick: "#C26954",
} as const;

export type ColorToken = keyof typeof colors;

/** Font family names as registered by src/game/fonts.ts. */
export const fonts = {
  display: "Bricolage Grotesque",
  ui: "Geist",
  mono: "JetBrains Mono",
  pixel: "Silkscreen",
} as const;

/** Full CSS stacks for Phaser text styles (fallbacks keep text readable if a font fails). */
export const fontStacks = {
  display: '"Bricolage Grotesque", ui-rounded, system-ui, sans-serif',
  ui: '"Geist", ui-sans-serif, system-ui, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, monospace',
  pixel: '"Silkscreen", ui-monospace, monospace',
} as const;

/** Type scale in px (design-system.md section 4). */
export const typeScale = {
  xs: 11,
  sm: 13,
  base: 14,
  md: 16,
  lg: 20,
  xl: 26,
  "2xl": 34,
  "3xl": 48,
} as const;

/** Motion timing in ms (design-system.md section 8). */
export const motion = {
  fast: 120,
  base: 200,
  slow: 320,
  breath: 2400,
} as const;

/** Depth bands shared by every scene so HUD, world, and fx layer predictably. */
export const depth = {
  backdrop: 0,
  parallax: 5,
  world: 10,
  worldFx: 18,
  ship: 20,
  shipFx: 22,
  foreground: 30,
  hud: 40,
  hudFx: 45,
  touch: 50,
  overlay: 80,
  dev: 90,
} as const;

export function colorNumber(value: string): number {
  const hex = value.startsWith("#") ? value.slice(1) : value;
  return Number.parseInt(hex.slice(0, 6), 16);
}
