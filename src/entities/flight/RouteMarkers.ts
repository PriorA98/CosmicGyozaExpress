import type Phaser from "phaser";
import type { CampaignThemeDefinition } from "../../data/campaign/themes";
import { FLIGHT_ART_SCALE, campaignFlightStyle } from "../../data/flightScenery";
import { colorNumber, depth } from "../../game/designTokens";
import type { CollectibleDefinition, RouteBeaconDefinition } from "../../types/campaign";
import { ensurePixelHalo } from "./pixelArt";

const TAU = Math.PI * 2;
const PICKUP_DEPTH = depth.world + 0.6;
const LANTERN_DEPTH = depth.world - 0.4;

type Pickup = { readonly definition: CollectibleDefinition; readonly image: Phaser.GameObjects.Image; readonly halo: Phaser.GameObjects.Image; readonly phase: number };

/** Optional postcard pickups: a softly glowing card that bobs in whole art pixels. Collection rules live in CollectibleSystem. */
export class RoutePickups {
  private readonly pickups = new Map<string, Pickup>();

  constructor(
    scene: Phaser.Scene,
    definitions: readonly CollectibleDefinition[],
    alreadyCollected: ReadonlySet<string>,
    theme: CampaignThemeDefinition,
    private readonly reducedMotion: boolean,
  ) {
    const style = campaignFlightStyle.pickup;
    const haloKey = ensurePixelHalo(scene, {
      key: `flight-pickup-halo-${theme.id}`,
      radius: style.haloRadiusArt,
      steps: style.haloSteps,
      color: theme.palette.light,
      alphaPerStep: style.haloAlpha,
    });
    definitions.forEach((definition, index) => {
      if (alreadyCollected.has(definition.id)) return;
      const { x, y } = definition.position;
      const halo = scene.add.image(x, y, haloKey).setScale(FLIGHT_ART_SCALE).setDepth(PICKUP_DEPTH - 0.01);
      const image = scene.add.image(x, y, definition.textureKey, definition.frame).setScale(FLIGHT_ART_SCALE).setDepth(PICKUP_DEPTH);
      this.pickups.set(definition.id, { definition, image, halo, phase: (index * 0.41) % 1 });
    });
  }

  update(simTimeMs: number): void {
    if (this.reducedMotion) return;
    const style = campaignFlightStyle.pickup;
    for (const pickup of this.pickups.values()) {
      const bob = Math.round(Math.sin((simTimeMs / style.bobPeriodMs + pickup.phase) * TAU) * style.bobArtPx) * FLIGHT_ART_SCALE;
      pickup.image.setY(pickup.definition.position.y + bob);
    }
  }

  collect(id: string): void {
    const pickup = this.pickups.get(id);
    if (!pickup) return;
    pickup.image.destroy();
    pickup.halo.destroy();
    this.pickups.delete(id);
  }

  destroy(): void {
    for (const pickup of this.pickups.values()) {
      pickup.image.destroy();
      pickup.halo.destroy();
    }
    this.pickups.clear();
  }
}

/** Small glowing lanterns at the home route's thank-you beacons; a beacon brightens once its note was shown. */
export class RouteLanterns {
  private readonly lanterns = new Map<string, { readonly glow: Phaser.GameObjects.Image; readonly body: Phaser.GameObjects.Graphics }>();

  constructor(scene: Phaser.Scene, beacons: readonly RouteBeaconDefinition[], theme: CampaignThemeDefinition) {
    const style = campaignFlightStyle.lantern;
    const glowKey = ensurePixelHalo(scene, {
      key: `flight-lantern-glow-${theme.id}`,
      radius: style.glowRadiusArt,
      steps: style.glowSteps,
      color: theme.palette.light,
      alphaPerStep: style.glowAlpha,
    });
    const P = FLIGHT_ART_SCALE;
    for (const beacon of beacons) {
      const x = Math.round(beacon.position.x / P) * P;
      const y = Math.round(beacon.position.y / P) * P;
      const glow = scene.add.image(x, y, glowKey).setScale(P).setDepth(LANTERN_DEPTH).setAlpha(style.idleAlpha);
      // Paper lantern in art pixels: cap, warm body with a lit core, little tassel.
      const body = scene.add.graphics().setDepth(LANTERN_DEPTH + 0.01).setAlpha(style.idleAlpha);
      body.fillStyle(colorNumber(style.bodyColor), 1);
      body.fillRect(x - 3 * P, y - 6 * P, 6 * P, P);
      body.fillRect(x - 3 * P, y + 5 * P, 6 * P, P);
      body.fillStyle(colorNumber(theme.palette.accent), 1);
      body.fillRect(x - 4 * P, y - 5 * P, 8 * P, 10 * P);
      body.fillStyle(colorNumber(theme.palette.light), 1);
      body.fillRect(x - 2 * P, y - 3 * P, 4 * P, 6 * P);
      body.fillStyle(colorNumber(style.bodyColor), 1);
      body.fillRect(x - P, y + 6 * P, 2 * P, 3 * P);
      this.lanterns.set(beacon.id, { glow, body });
    }
  }

  markShown(id: string): void {
    const lantern = this.lanterns.get(id);
    lantern?.glow.setAlpha(1);
    lantern?.body.setAlpha(1);
  }

  destroy(): void {
    for (const lantern of this.lanterns.values()) {
      lantern.glow.destroy();
      lantern.body.destroy();
    }
    this.lanterns.clear();
  }
}
