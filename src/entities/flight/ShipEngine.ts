import Phaser from "phaser";
import { FLIGHT_ART_SCALE, shipVisualStyle } from "../../data/flightScenery";
import { depth } from "../../game/designTokens";
import { createThrustTrail, type ThrustTrail } from "../../fx/feedback";
import { pixelGlowTextureKey } from "../../fx/fxTextures";
import { clamp } from "../../utils/math";
import { snapToArtGrid } from "./pixelArt";

/** Screen px from the saucer centre to the engine glow / particle trail, along the ship's down axis. */
export type ShipEngineOffsets = {
  readonly engine: number;
  readonly trail: number;
};

/** Hard brightness levels of the nozzle glow (no continuous fades or scaling). */
type GlowLevel = "off" | "pilot" | "thrust" | "thrustLow";

/**
 * Bottom-thruster dressing for the flight ship: the shared thrust trail (exhaust leaves the
 * bottom) plus the fx package's hard-edged stepped pixel glow at the nozzle. The glow sits at the
 * integer art scale and switches between a few fixed levels (pilot light, thrust, thrust flicker),
 * so it never mixes smooth gradients or resampled pixels into the pixel FX.
 */
export class ShipEngine {
  private readonly trail: ThrustTrail;
  private readonly glow: Phaser.GameObjects.Image;
  private level: GlowLevel = "off";

  constructor(
    scene: Phaser.Scene,
    private readonly offsets: ShipEngineOffsets,
  ) {
    this.trail = createThrustTrail(scene, { depth: depth.ship - 1, offset: offsets.trail });
    this.glow = scene.add
      .image(0, 0, pixelGlowTextureKey(scene))
      .setScale(FLIGHT_ART_SCALE)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(depth.ship - 0.5)
      .setVisible(false);
  }

  /**
   * @param x,y visible ship centre; `rotation` uses ship convention (0 = nose up).
   * @param visible false hides the glow and stops the trail (e.g. during an incident).
   */
  update(x: number, y: number, rotation: number, thrusting: boolean, speed: number, timeMs: number, visible: boolean): void {
    const style = shipVisualStyle;
    const intensity = clamp(speed / style.intensitySpeed, 0.25, 1);
    this.trail.update(x, y, rotation, visible && thrusting, intensity);

    const offset = this.offsets.engine;
    // On the art grid so the stepped rings line up with the ship's pixels.
    const gx = snapToArtGrid(x - Math.sin(rotation) * offset, FLIGHT_ART_SCALE);
    const gy = snapToArtGrid(y + Math.cos(rotation) * offset, FLIGHT_ART_SCALE);
    this.glow.setPosition(gx, gy);
    this.setLevel(!visible ? "off" : thrusting ? flickerLevel(timeMs) : "pilot");
  }

  destroy(): void {
    this.trail.destroy();
    this.glow.destroy();
  }

  private setLevel(level: GlowLevel): void {
    if (level === this.level) return;
    this.level = level;
    const alpha = shipVisualStyle.engineGlowLevels;
    if (level === "off") {
      this.glow.setVisible(false);
      return;
    }
    this.glow.setVisible(true).setAlpha(alpha[level]);
  }
}

/** Irregular but deterministic flicker between the two thrust levels (cheap integer hash per tick). */
function flickerLevel(timeMs: number): GlowLevel {
  const tick = Math.floor(timeMs / shipVisualStyle.engineFlickerMs);
  const hash = Math.imul(tick ^ 0x5bd1e995, 0x27d4eb2d) >>> 0;
  return hash % 4 === 0 ? "thrustLow" : "thrust";
}
