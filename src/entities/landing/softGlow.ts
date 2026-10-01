import Phaser from "phaser";
import { colorNumber } from "../../game/designTokens";

/**
 * A soft radial glow without a texture: concentric additive discs whose alphas stack toward the centre,
 * so the edge falls off gently instead of reading as a flat disc. Drawn around the local origin;
 * position, scale, and alpha it like any other game object.
 */
export function createSoftGlow(scene: Phaser.Scene, radius: number, color: string, rings: number): Phaser.GameObjects.Graphics {
  const glow = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  const count = Math.max(1, Math.floor(rings));
  for (let ring = 0; ring < count; ring += 1) {
    const t = 1 - ring / count;
    glow.fillStyle(colorNumber(color), 1 / count);
    glow.fillCircle(0, 0, radius * t);
  }
  return glow;
}
