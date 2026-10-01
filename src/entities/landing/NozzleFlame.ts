import Phaser from "phaser";
import { landingScenery } from "../../data/landingScenery";
import { colorNumber, colors } from "../../game/designTokens";
import { bottomVector } from "../../systems/ShipMovementSystem";
import { createSoftGlow } from "./softGlow";

/**
 * The bottom thruster's flame tongue, drawn right at the nozzle so a held W reads instantly even before the
 * shared thrust trail has puffed out. Layers: soft additive glow, ember outer tongue, amber body, plaster core.
 * Ignites with a small overshoot pop and flickers while held; drawn in nozzle-local space and rotated with the ship.
 */
export class NozzleFlame {
  private readonly glow: Phaser.GameObjects.Graphics;
  private readonly tongue: Phaser.GameObjects.Graphics;
  private power = 0;
  private wasActive = false;
  private igniteMs = Number.NEGATIVE_INFINITY;

  constructor(scene: Phaser.Scene, depth: number) {
    const config = landingScenery.flame;
    this.glow = createSoftGlow(scene, config.glowRadius, colors.ember, config.glowRings).setAlpha(0).setDepth(depth);
    this.tongue = scene.add.graphics().setDepth(depth);
  }

  /**
   * @param x, y ship sprite centre; `nozzleDistance` is how far the nozzle sits from it along the ship's down axis.
   */
  update(x: number, y: number, rotation: number, nozzleDistance: number, active: boolean, timeMs: number, deltaSeconds: number): void {
    const config = landingScenery.flame;
    if (active && !this.wasActive) this.igniteMs = timeMs;
    this.wasActive = active;

    const rate = (active ? config.ignitePerSecond : config.fadePerSecond) * deltaSeconds;
    this.power = active ? Math.min(1, this.power + rate) : Math.max(0, this.power - rate);

    this.tongue.clear();
    if (this.power <= 0.01) {
      this.glow.setAlpha(0);
      return;
    }

    const sinceIgnite = timeMs - this.igniteMs;
    const pop = sinceIgnite < config.popMs ? 1 + config.popScale * Math.sin((sinceIgnite / config.popMs) * Math.PI) : 1;
    const flicker =
      Math.sin(timeMs / config.flickerSlowMs) * config.flickerSlowPx +
      Math.sin(timeMs / config.flickerFastMs) * config.flickerFastPx;
    const length = Math.max(4, (config.lengthPx + flicker) * this.power * pop);
    const halfWidth = config.halfWidthPx * (0.6 + 0.4 * this.power) * pop;

    const down = bottomVector(rotation);
    const nx = x + down.x * nozzleDistance;
    const ny = y + down.y * nozzleDistance;

    this.glow
      .setPosition(nx + down.x * length * 0.35, ny + down.y * length * 0.35)
      .setScale(0.7 + 0.3 * this.power * pop)
      .setAlpha(config.glowAlpha * this.power);

    this.tongue.setPosition(Math.round(nx), Math.round(ny)).setRotation(rotation);
    const layers = [
      { color: colors.ember, alpha: 0.95, widthRatio: 1, lengthRatio: 1 },
      { color: colors.amber, alpha: 1, widthRatio: 0.66, lengthRatio: 0.72 },
      { color: colors.plaster, alpha: 1, widthRatio: 0.32, lengthRatio: 0.42 },
    ] as const;
    for (const layer of layers) {
      const w = Math.max(1, Math.round(halfWidth * layer.widthRatio));
      const l = Math.max(2, Math.round(length * layer.lengthRatio));
      this.tongue.fillStyle(colorNumber(layer.color), layer.alpha);
      // Rounded shoulder at the nozzle, tapering to a point: a cosy teardrop flame.
      this.tongue.fillCircle(0, w * 0.6, w);
      this.tongue.fillTriangle(-w, w * 0.6, w, w * 0.6, 0, l + w * 0.6);
    }
  }

  destroy(): void {
    this.glow.destroy();
    this.tongue.destroy();
  }
}
