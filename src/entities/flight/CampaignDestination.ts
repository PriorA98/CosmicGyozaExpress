import type Phaser from "phaser";
import type { CampaignThemeDefinition } from "../../data/campaign/themes";
import { FLIGHT_ART_SCALE, campaignFlightStyle } from "../../data/flightScenery";
import { depth, motion } from "../../game/designTokens";
import { isReducedMotion } from "../../fx/feedback";
import type { FlightDestinationDefinition, Point } from "../../types/flight";
import { contractScale, ensurePixelHalo } from "./pixelArt";

/**
 * Generic campaign destination body (Tea Moon keeps `TeaMoon`): the theme's 160x160 art at 2x with a
 * stepped breathing halo centered on the authored arrival ring.
 */
export class CampaignDestination {
  readonly bodyCenter: Point;
  private readonly image: Phaser.GameObjects.Image;
  private readonly halo: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, destination: FlightDestinationDefinition, theme: CampaignThemeDefinition) {
    const style = campaignFlightStyle.destination;
    this.bodyCenter = { x: Math.round(destination.x / FLIGHT_ART_SCALE) * FLIGHT_ART_SCALE, y: Math.round(destination.y / FLIGHT_ART_SCALE) * FLIGHT_ART_SCALE };

    const haloKey = ensurePixelHalo(scene, {
      key: `flight-destination-halo-${theme.id}`,
      radius: style.haloRadiusArt,
      steps: style.haloSteps,
      color: theme.palette.light,
      alphaPerStep: style.haloAlpha,
    });
    this.halo = scene.add.image(this.bodyCenter.x, this.bodyCenter.y, haloKey).setScale(FLIGHT_ART_SCALE).setDepth(depth.world - 0.6);
    this.image = scene.add
      .image(this.bodyCenter.x, this.bodyCenter.y, theme.destinationTexture)
      .setScale(contractScale(scene, theme.destinationTexture, FLIGHT_ART_SCALE))
      .setDepth(depth.world - 0.5);

    if (!isReducedMotion()) {
      scene.tweens.add({ targets: this.halo, alpha: 1 - style.breathAlpha, duration: motion.breath, ease: "Sine.easeInOut", yoyo: true, repeat: -1 });
    }
  }

  destroy(): void {
    this.halo.destroy();
    this.image.destroy();
  }
}
