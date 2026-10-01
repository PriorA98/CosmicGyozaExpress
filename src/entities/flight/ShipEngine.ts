import Phaser from "phaser";
import { shipVisualStyle } from "../../data/flightScenery";
import { colorNumber, depth } from "../../game/designTokens";
import { createThrustTrail, type ThrustTrail } from "../../fx/feedback";
import { clamp } from "../../utils/math";

/** Fraction per second the glow eases toward its target brightness. */
const GLOW_EASE_PER_SECOND = 10;

/**
 * Bottom-thruster dressing for the flight ship: the shared thrust trail (exhaust leaves the
 * bottom) plus a soft additive engine glow that warms up while thrusting and idles faintly.
 */
export class ShipEngine {
  private readonly trail: ThrustTrail;
  private readonly glow: Phaser.GameObjects.Arc;
  private readonly core: Phaser.GameObjects.Arc;
  private glowLevel = 0;

  constructor(scene: Phaser.Scene) {
    this.trail = createThrustTrail(scene, { depth: depth.ship - 1, offset: shipVisualStyle.trailOffset });
    const color = colorNumber(shipVisualStyle.engineGlowColor);
    this.glow = scene.add
      .circle(0, 0, shipVisualStyle.engineGlowRadius, color, 1)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(depth.ship - 0.5)
      .setAlpha(0);
    this.core = scene.add
      .circle(0, 0, shipVisualStyle.engineGlowRadius * 0.45, color, 1)
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
    const scale = 0.8 + this.glowLevel * 0.6;
    this.glow.setPosition(gx, gy).setAlpha(this.glowLevel * 0.55).setScale(scale);
    this.core.setPosition(gx, gy).setAlpha(this.glowLevel).setScale(scale);
  }

  destroy(): void {
    this.trail.destroy();
    this.glow.destroy();
    this.core.destroy();
  }
}
