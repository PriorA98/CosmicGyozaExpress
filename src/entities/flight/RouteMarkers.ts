import type Phaser from "phaser";
import type { CampaignThemeDefinition } from "../../data/campaign/themes";
import { FLIGHT_ART_SCALE, campaignFlightStyle } from "../../data/flightScenery";
import { colorNumber, depth } from "../../game/designTokens";
import type { CheckpointDefinition, CollectibleDefinition, RouteBeaconDefinition } from "../../types/campaign";
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
export class RouteCheckpoints {
  private readonly markers = new Map<string, Phaser.GameObjects.Graphics>();

  constructor(scene: Phaser.Scene, checkpoints: readonly CheckpointDefinition[], theme: CampaignThemeDefinition) {
    for (const checkpoint of checkpoints) {
      const strip = checkpoint.activation;
      const x = Math.round((strip.x + strip.width / 2) / 2) * 2;
      const y = Math.round(checkpoint.respawn.y / 2) * 2;
      const g = scene.add.graphics().setDepth(depth.world - 0.2).setAlpha(0.45);
      g.fillStyle(colorNumber(theme.palette.light), 1);
      for (let dy = -120; dy <= 120; dy += 12) g.fillRect(x - 2, y + dy, 4, 4);
      for (const dy of [-136, 136]) {
        g.fillStyle(colorNumber(theme.palette.skyTop), 1).fillRect(x - 10, y + dy - 10, 20, 20);
        g.fillStyle(colorNumber(theme.palette.accent), 1).fillRect(x - 8, y + dy - 8, 16, 16);
        g.fillStyle(colorNumber(theme.palette.light), 1).fillRect(x - 4, y + dy - 4, 8, 8);
      }
      this.markers.set(checkpoint.id, g);
    }
  }

  activate(id: string): void { this.markers.get(id)?.setAlpha(1); }
  reset(): void { for (const marker of this.markers.values()) marker.setAlpha(0.45); }
  destroy(): void { for (const marker of this.markers.values()) marker.destroy(); this.markers.clear(); }
}

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
      // Paper lantern in art pixels (14x18 body): cap, ribbed warm body with a lit core, and a little
      // folded note hanging from its tassel, so the glow reads as "a note is waiting here".
      const body = scene.add.graphics().setDepth(LANTERN_DEPTH + 0.01).setAlpha(style.idleAlpha);
      const dark = colorNumber(style.bodyColor);
      const accent = colorNumber(theme.palette.accent);
      const light = colorNumber(theme.palette.light);
      body.fillStyle(dark, 1).fillRect(x - P, y - 13 * P, 2 * P, 2 * P);
      body.fillRect(x - 5 * P, y - 11 * P, 10 * P, 2 * P);
      body.fillRect(x - 5 * P, y + 7 * P, 10 * P, 2 * P);
      body.fillStyle(accent, 1).fillRect(x - 6 * P, y - 9 * P, 12 * P, 16 * P).fillRect(x - 7 * P, y - 7 * P, 14 * P, 12 * P);
      body.fillStyle(light, 1).fillRect(x - 4 * P, y - 7 * P, 8 * P, 12 * P);
      body.fillStyle(accent, 1).fillRect(x - 4 * P, y - 3 * P, 8 * P, P).fillRect(x - 4 * P, y + P, 8 * P, P);
      body.fillStyle(dark, 1).fillRect(x - P, y + 9 * P, 2 * P, 3 * P);
      // Note tag: cream card with two ink lines and a folded corner.
      const note = colorNumber(style.noteColor);
      body.fillStyle(dark, 1).fillRect(x - 5 * P, y + 12 * P, 10 * P, 7 * P);
      body.fillStyle(note, 1).fillRect(x - 4 * P, y + 13 * P, 8 * P, 5 * P);
      body.fillStyle(dark, 1).fillRect(x - 3 * P, y + 14 * P, 5 * P, P).fillRect(x - 3 * P, y + 16 * P, 4 * P, P);
      body.fillStyle(accent, 1).fillRect(x + 2 * P, y + 13 * P, 2 * P, 2 * P);
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
