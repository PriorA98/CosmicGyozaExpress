import { colorNumber } from "../../game/designTokens";

/** Mixes two `#RRGGBB` colours (t 0 → a, 1 → b) into a Phaser colour number. Pure. */
export function mixHex(a: string, b: string, t: number): number {
  const ca = colorNumber(a);
  const cb = colorNumber(b);
  const channel = (shift: number): number => Math.round(((ca >> shift) & 255) * (1 - t) + ((cb >> shift) & 255) * t);
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}
