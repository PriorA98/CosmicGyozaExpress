import Phaser from "phaser";
import {
  FLIGHT_ART_SCALE,
  debrisStyle,
  debrisTextureKey,
  fallbackStarfield,
  flightCelestialBodies,
  flightDebris,
  flightParallaxLayers,
  campaignBackdropMoods,
  campaignPropStyle,
  type CampaignBackdropMood,
  type CelestialBodyDefinition,
  type ParallaxLayerDefinition,
} from "../../data/flightScenery";
import { colorNumber, colors, depth } from "../../game/designTokens";
import type { CampaignThemeDefinition } from "../../data/campaign/themes";
import type { Point } from "../../types/flight";
import { isReducedMotion } from "../../fx/feedback";
import { ensureVerticalMirrorTile } from "./pixelArt";
import { ensureStandInStarTile, isFallbackTexture, planetTextureOrStandIn } from "./textureFallbacks";
import { mixHexColor, parallaxPropCandidates, placeParallaxProps, type KeepOut } from "./flightCueMath";

/** Route geometry the campaign backdrop uses to keep its far props off gameplay. */
export type BackdropRouteLayout = { readonly cameraPath: readonly Point[]; readonly keepOuts: readonly KeepOut[] };

type ParallaxLayer = {
  readonly definition: ParallaxLayerDefinition;
  readonly sprite: Phaser.GameObjects.TileSprite;
};

const QUARTER_TURN_DEGREES = 90;

/**
 * Layered, calm space backdrop for route flight: tiling star/nebula layers that follow the
 * camera at fractional speeds, distant celestial bodies, and slow non-colliding debris.
 * Everything here is visual only and sits below the world depth band.
 *
 * Every layer is a viewport-sized TileSprite that repeats in both axes (the nebula via a
 * vertically mirrored copy), so no camera position can expose an uncovered strip.
 */
export class SpaceBackdrop {
  private readonly layers: ParallaxLayer[] = [];

  private readonly mood: CampaignBackdropMood | null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly worldHeight: number,
    private readonly theme?: CampaignThemeDefinition,
    layout?: BackdropRouteLayout,
  ) {
    this.mood = theme ? campaignBackdropMoods[theme.id] : null;
    scene.cameras.main.setBackgroundColor(this.mood?.cosmos ?? colors.cosmos);
    flightParallaxLayers.forEach((definition, index) => this.createLayer(definition, index));
    if (!this.mood) {
      this.createCelestialBodies(flightCelestialBodies);
      this.createDebris();
      return;
    }
    // Campaign: the same layered depth as Tea Moon, re-coloured per route mood.
    const mood = this.mood;
    const bodies = mood.bodies.flatMap((placed) => {
      const body = flightCelestialBodies.find((candidate) => candidate.id === placed.id);
      return body ? [{ ...body, x: placed.x, y: placed.y, tint: placed.tint }] : [];
    });
    this.createCelestialBodies(bodies);
    this.createDebris();
    if (layout) this.createCampaignProps(layout);
  }

  /** Call every frame after the camera has moved. */
  update(timeMs: number): void {
    const camera = this.scene.cameras.main;
    const centredScrollY = (this.worldHeight - this.scene.scale.height) / 2;

    for (const { definition, sprite } of this.layers) {
      const driftX = (definition.driftX * timeMs) / 1000;
      sprite.tilePositionX = snapToScreenPixel((camera.scrollX * definition.scrollFactorX) / FLIGHT_ART_SCALE + driftX);
      // Mirror layers are anchored so the authored (unflipped) half is framed at the centred scroll.
      const scrollY = definition.mode === "mirror" ? camera.scrollY - centredScrollY : camera.scrollY;
      sprite.tilePositionY = snapToScreenPixel((scrollY * definition.scrollFactorY) / FLIGHT_ART_SCALE);
    }
  }

  private createLayer(definition: ParallaxLayerDefinition, index: number): void {
    const { width, height } = this.scene.scale;
    const painted = this.mood?.layerTextureKeys?.[definition.id];
    const usePainted = painted !== undefined && this.scene.textures.exists(painted) && !isFallbackTexture(this.scene, painted);
    let textureKey: string = usePainted ? painted : definition.textureKey;

    if (usePainted) {
      if (definition.mode === "mirror") textureKey = ensureVerticalMirrorTile(this.scene, painted, `${painted}--mirror`);
    } else if (isFallbackTexture(this.scene, definition.textureKey)) {
      if (definition.fallbackStars <= 0) return;
      const source = this.scene.textures.get(definition.textureKey).getSourceImage();
      textureKey = ensureStandInStarTile(this.scene, {
        key: `${definition.textureKey}--stand-in`,
        width: source.width,
        height: source.height,
        count: definition.fallbackStars,
        seed: fallbackStarfield.seed + index,
        palette: fallbackStarfield.colors,
        alphaMin: fallbackStarfield.alphaMin,
        alphaMax: fallbackStarfield.alphaMax,
      });
    } else if (definition.mode === "mirror") {
      textureKey = ensureVerticalMirrorTile(this.scene, definition.textureKey, `${definition.textureKey}--mirror`);
    }

    const sprite = this.scene.add
      .tileSprite(0, 0, Math.ceil(width / FLIGHT_ART_SCALE) + 2, Math.ceil(height / FLIGHT_ART_SCALE) + 2, textureKey)
      .setOrigin(0, 0)
      .setScale(FLIGHT_ART_SCALE)
      .setScrollFactor(0)
      .setAlpha(definition.alpha)
      .setDepth(depth.backdrop + index * 0.1);
    const tint = this.mood && !usePainted ? this.mood.layerTints[definition.id] : undefined;
    if (tint) sprite.setTint(colorNumber(tint));

    this.layers.push({ definition, sprite });
  }

  /**
   * Far, low-alpha route props on a deep parallax layer. Anchors come from a candidate grid and are kept
   * only where the world point under them never meets a rock, track, pickup, note or checkpoint along the
   * whole route (see placeParallaxProps). Shapes avoid every cue vocabulary (no lanes, arrows, diamonds).
   */
  private createCampaignProps(layout: BackdropRouteLayout): void {
    const theme = this.theme;
    const mood = this.mood;
    if (!theme || !mood?.prop) return;
    const style = campaignPropStyle;
    const { width, height } = this.scene.scale;
    const candidates = parallaxPropCandidates({ width, height }, style.gridStepPx, style.scrollFactor, layout.cameraPath);
    const anchors = placeParallaxProps(candidates, style.count, style.scrollFactor, layout.cameraPath, layout.keepOuts, style.radiusPx, { width, height });
    const shade = mixHexColor(theme.palette.accent, mood.cosmos, 0.25);
    const pale = mixHexColor(theme.palette.light, mood.cosmos, 0.2);
    anchors.forEach((anchor, i) => {
      const x = Math.round(anchor.x / FLIGHT_ART_SCALE) * FLIGHT_ART_SCALE;
      const y = Math.round(anchor.y / FLIGHT_ART_SCALE) * FLIGHT_ART_SCALE;
      const g = this.scene.add.graphics().setPosition(x, y).setScrollFactor(style.scrollFactor).setDepth(depth.parallax + 0.5).setAlpha(style.alpha);
      drawProp(g, mood.prop ?? "rain", shade, pale);
      if (!isReducedMotion()) {
        const drift = { offset: 0 };
        this.scene.tweens.add({ targets: drift, offset: 10, duration: 5200 + i * 1300, ease: "Sine.easeInOut", yoyo: true, repeat: -1, onUpdate: () => g.setY(y + snapToArtStep(drift.offset)) });
      }
    });
  }

  private createCelestialBodies(bodies: readonly CelestialBodyDefinition[]): void {
    bodies.forEach((body, index) => {
      // Opaque, tinted toward the sky for depth; they sit above every star layer.
      const image = this.scene.add
        .image(body.x, body.y, planetTextureOrStandIn(this.scene, body.textureKey, body.standIn))
        .setScale(body.scale)
        .setScrollFactor(body.scrollFactor)
        .setTint(colorNumber(body.tint))
        .setDepth(depth.parallax + index * 0.1);

      // Drift in whole art pixels so the planet never sits between grid steps.
      const drift = { t: 0 };
      this.scene.tweens.add({
        targets: drift,
        t: 1,
        duration: body.driftPeriodMs / 2,
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1,
        onUpdate: () => image.setY(body.y + snapToArtStep(drift.t * body.driftPx)),
      });
    });
  }

  private createDebris(): void {
    for (const bit of flightDebris) {
      const image = this.scene.add
        .image(bit.x, bit.y, debrisTextureKey, bit.frame)
        .setScale(FLIGHT_ART_SCALE)
        .setScrollFactor(bit.scrollFactor)
        .setTint(colorNumber((this.mood?.debrisTints ?? debrisStyle.tints)[bit.tint % debrisStyle.tints.length] ?? colors.plum))
        .setAlpha(this.mood?.debrisAlpha ?? 1)
        .setDepth(depth.parallax + 1);

      const drift = { t: 0 };
      this.scene.tweens.add({
        targets: drift,
        t: 1,
        duration: bit.driftPeriodMs / 2,
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1,
        onUpdate: () => image.setPosition(bit.x + snapToArtStep(drift.t * bit.driftX), bit.y + snapToArtStep(drift.t * bit.driftY)),
      });

      if (bit.tumbleMs > 0) {
        this.scene.time.addEvent({
          delay: bit.tumbleMs,
          loop: true,
          callback: () => image.setAngle((image.angle + QUARTER_TURN_DEGREES) % 360),
        });
      }
    }
  }
}

/** Tile offsets are in art pixels; snap to half an art pixel (= one screen pixel at 2x). */
function snapToScreenPixel(artPx: number): number {
  return Math.round(artPx * FLIGHT_ART_SCALE) / FLIGHT_ART_SCALE;
}

/** Snaps a screen-px offset to whole art pixels (multiples of the art scale). */
function snapToArtStep(screenPx: number): number {
  return Math.round(screenPx / FLIGHT_ART_SCALE) * FLIGHT_ART_SCALE;
}

const P = FLIGHT_ART_SCALE;

/** Pixel silhouettes for far props (local px, art-grid aligned). One flat shade + one pale highlight. */
function drawProp(g: Phaser.GameObjects.Graphics, prop: NonNullable<CampaignBackdropMood["prop"]>, shade: number, pale: number): void {
  if (prop === "lunch-crate") {
    // Distant two-tier lunchbox station with a knot on top.
    g.fillStyle(shade, 1).fillRect(-36, -12, 72, 30).fillRect(-30, -26, 60, 14);
    g.fillStyle(pale, 1).fillRect(-36, -12, 72, P).fillRect(-30, -26, 60, P).fillRect(-6, -34, 12, 8);
    g.fillRect(-4 * P, -38, P, 4).fillRect(3 * P, -38, P, 4);
  } else if (prop === "tea-leaf") {
    // Large curled leaf drifting far away: tapered, curved, with a stem and vein.
    for (let x = -44; x <= 44; x += P) {
      const t = (x + 44) / 88;
      const half = Math.round((Math.sin(t * Math.PI) * 16) / P) * P;
      const bend = Math.round((Math.sin(t * Math.PI * 0.9) * 10) / P) * P;
      if (half > 0) g.fillStyle(shade, 1).fillRect(x, -half + bend, P, half * 2);
      g.fillStyle(pale, 1).fillRect(x, bend, P, P);
    }
    g.fillStyle(shade, 1).fillRect(-52, 0, 10, P).fillRect(-56, P, 6, P);
  } else if (prop === "flour-comet") {
    g.fillStyle(pale, 0.5);
    for (let t = 0; t < 7; t += 1) g.fillRect(-t * 12, t * P, 10 - t, 4);
    g.fillStyle(pale, 1).fillRect(-4, -6, 16, 12).fillRect(0, -10, 8, 20);
  } else if (prop === "rain") {
    // Soft rain cloud: stacked rounded rows, a few scattered drizzle dots underneath (never long streaks).
    const rows = [[-20, 20], [-34, 34], [-46, 44], [-48, 48], [-42, 40]] as const;
    rows.forEach(([from, to], index) => g.fillStyle(shade, 1).fillRect(from, -20 + index * 6, to - from, 6));
    g.fillStyle(pale, 1).fillRect(-18, -20, 30, P).fillRect(-32, -14, 12, P);
    for (const [dx, dy] of [[-30, 22], [-8, 30], [14, 24], [32, 34], [-20, 40]] as const) g.fillStyle(pale, 0.8).fillRect(dx, dy, P, 4);
  } else {
    // Home: a loose ribbon streamer with a bow, waving (no lantern box, so it never reads as a note beacon).
    for (let x = -50; x <= 50; x += P) {
      const y = Math.round((Math.sin(x / 14) * 8) / P) * P;
      g.fillStyle(shade, 1).fillRect(x, y - 3, P, 6);
    }
    g.fillStyle(pale, 1).fillRect(-8, -10, 6, 8).fillRect(4, -10, 6, 8).fillRect(-2, -6, 4, 4);
  }
}
