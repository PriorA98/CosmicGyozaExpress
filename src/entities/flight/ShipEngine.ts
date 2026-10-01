import Phaser from "phaser";
import { shipVisualStyle } from "../../data/flightScenery";
import { colorNumber, colors, depth } from "../../game/designTokens";
import { createThrustTrail, type ThrustTrail } from "../../fx/feedback";
import { clamp } from "../../utils/math";
import { ensureRadialGlowTexture } from "./textureFallbacks";

/** Fraction per second the glow eases toward its target brightness. */
const GLOW_EASE_PER_SECOND = 10;
const GLOW_TEXTURE_KEY = "flight-engine-glow";
const GLOW_TEXTURE_SIZE = 64;

/**
 * Bottom-thruster dressing for the flight ship: the shared thrust trail (exhaust leaves the
 * bottom) plus a soft additive engine glow that warms up while thrusting and idles as a tiny
 * pilot light.
 */
export class ShipEngine {
  private readonly trail: ThrustTrail;
  private readonly glow: Phaser.GameObjects.Image;
  private readonly core: Phaser.GameObjects.Image;
  private glowLevel = 0;

  constructor(scene: Phaser.Scene) {
    this.trail = createThrustTrail(scene, { depth: depth.ship - 1, offset: shipVisualStyle.trailOffset });
    const key = ensureRadialGlowTexture(scene, GLOW_TEXTURE_KEY, GLOW_TEXTURE_SIZE);
    this.glow = scene.add
      .image(0, 0, key)
      .setTint(colorNumber(shipVisualStyle.engineGlowColor))
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(depth.ship - 0.5)
      .setAlpha(0);
    this.core = scene.add
      .image(0, 0, key)
      .setTint(colorNumber(colors.parchmentWarm))
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(depth.ship - 0.4)
      .setAlpha(0);
  }

  /**
   * @param x,y visible ship centre; `rotation` uses ship convention (0 = nose up).
   * @param visible false hides the glow and stops the trail (e.g. during an incident).
   */
  update(x: number, y: number, rotation: number, thrusting: boolean, speed: number, timeMs: number, deltaMs: number, visible: boolean): void {
    const intensity = clamp(speed / shipVisualStyle.intensitySpeed, 0.25, 1);
    const active = visible && thrusting;
    this.trail.update(x, y, rotation, active, intensity);

    const flicker = 0.85 + 0.15 * Math.sin(timeMs / shipVisualStyle.engineFlickerMs);
    const target = !visible ? 0 : thrusting ? shipVisualStyle.engineGlowThrustAlpha * flicker : shipVisualStyle.engineGlowIdleAlpha;
    const ease = clamp((deltaMs / 1000) * GLOW_EASE_PER_SECOND, 0, 1);
    this.glowLevel += (target - this.glowLevel) * ease;

    const offset = shipVisualStyle.engineOffset;
    const gx = x - Math.sin(rotation) * offset;
    const gy = y + Math.cos(rotation) * offset;
    const diameter = shipVisualStyle.engineGlowRadius * 2;
    const glowScale = ((0.7 + this.glowLevel * 1.6) * diameter) / GLOW_TEXTURE_SIZE;
    const coreScale = ((0.35 + this.glowLevel * 0.5) * diameter) / GLOW_TEXTURE_SIZE;
    this.glow.setPosition(gx, gy).setAlpha(this.glowLevel).setScale(glowScale);
    this.core.setPosition(gx, gy).setAlpha(clamp(this.glowLevel * 1.4, 0, 1)).setScale(coreScale);
  }

  destroy(): void {
    this.trail.destroy();
    this.glow.destroy();
    this.core.destroy();
  }
}
