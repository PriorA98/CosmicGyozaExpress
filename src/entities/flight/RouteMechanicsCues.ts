import Phaser from "phaser";
import { ASSET } from "../../data/assetManifest";
import type { CampaignThemeDefinition } from "../../data/campaign/themes";
import { FLIGHT_ART_SCALE, campaignFlightStyle, campaignCuePalette } from "../../data/flightScenery";
import { colorNumber, depth } from "../../game/designTokens";
import type { ForceSample } from "../../systems/ForceFieldSystem";
import { motionPathTrack } from "../../systems/MotionPathSystem";
import type { ForceZoneDefinition, MovingObstacleDefinition, VisibilityDefinition } from "../../types/campaign";
import type { Point } from "../../types/flight";
import { cueIsClear, flowCueBases, quarterTurnRotation, windsockFrame, wrap, zoneBounds } from "./flightCueMath";
import type { HudScreenRect } from "./FlightDashboard";
import { ensurePixelHalo } from "./pixelArt";

/**
 * Telegraphs for campaign route mechanics. Everything static is drawn ONCE; per-frame work only moves a
 * few arrow sprites. Cues read the scene's force samples (the same ones the physics used).
 * Depth order: fog < force cues < motion tracks < destination < rocks / ship / pickups.
 */
const FOG_DEPTH = depth.world - 1.6;
const CUE_DEPTH = depth.world - 0.95;
const TRACK_DEPTH = depth.world - 0.8;
const WINDSOCK_DEPTH = depth.world - 0.3;

const snap = (value: number): number => Math.round(value / FLIGHT_ART_SCALE) * FLIGHT_ART_SCALE;

function fillPixelDisc(g: Phaser.GameObjects.Graphics, cx: number, cy: number, radius: number): void {
  for (let dy = -radius; dy <= radius; dy += FLIGHT_ART_SCALE) {
    const half = snap(Math.sqrt(Math.max(0, radius * radius - dy * dy)));
    g.fillRect(snap(cx) - half, snap(cy) + dy, half * 2, FLIGHT_ART_SCALE);
  }
}

/** Dotted pixel polyline: square dots every `step` px, grouped into dashes of `dash` px with `gap` px holes. */
function plotDashed(g: Phaser.GameObjects.Graphics, points: readonly Point[], dotPx: number, dash: number, gap: number): void {
  let travelled = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    if (!a || !b) continue;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    for (let t = 0; t < length; t += dotPx) {
      if (wrap(travelled + t, dash + gap) < dash) {
        const x = a.x + ((b.x - a.x) * t) / length;
        const y = a.y + ((b.y - a.y) * t) / length;
        g.fillRect(snap(x) - dotPx / 2, snap(y) - dotPx / 2, dotPx, dotPx);
      }
    }
    travelled += length;
  }
}

/** Dashed tracks + endpoint bulbs (ping-pong) / faint dotted ring (orbit), drawn once. */
export function drawMotionTracks(scene: Phaser.Scene, definitions: readonly MovingObstacleDefinition[], theme: CampaignThemeDefinition): Phaser.GameObjects.Graphics {
  const style = campaignFlightStyle.track;
  const g = scene.add.graphics().setDepth(TRACK_DEPTH);
  const color = colorNumber(theme.palette.accent);
  for (const definition of definitions) {
    const path = definition.path;
    if (path.kind === "ping-pong") {
      g.fillStyle(color, style.alpha);
      plotDashed(g, [path.from, path.to], style.dotPx, style.dashPx, style.gapPx);
      for (const end of [path.from, path.to]) {
        g.fillStyle(colorNumber(theme.palette.skyTop), 0.8);
        fillPixelDisc(g, end.x, end.y, style.bulbRadiusPx + FLIGHT_ART_SCALE);
        g.fillStyle(color, style.bulbAlpha);
        fillPixelDisc(g, end.x, end.y, style.bulbRadiusPx);
      }
    } else {
      g.fillStyle(color, style.orbitAlpha);
      plotDashed(g, motionPathTrack(path, 96), style.dotPx, style.dashPx, style.gapPx);
    }
    const points = motionPathTrack(path, 24);
    g.fillStyle(colorNumber(theme.palette.light), 0.75);
    for (let i = 1; i < points.length; i += 4) {
      const a = points[i - 1]; const b = points[i];
      if (!a || !b) continue;
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      for (let t = 0; t <= 8; t += 2) for (const side of [-1, 1]) {
        g.fillRect(snap(b.x - Math.cos(angle) * t - Math.sin(angle) * side * t), snap(b.y - Math.sin(angle) * t + Math.cos(angle) * side * t), 2, 2);
      }
    }
  }
  return g;
}

type ArrowField = {
  readonly zone: Extract<ForceZoneDefinition, { kind: "directional-current" | "gust" }>;
  readonly arrows: readonly { readonly image: Phaser.GameObjects.Image; readonly base: Point }[];
  readonly direction: Point;
  readonly bounds: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly windsock: Phaser.GameObjects.Image | undefined;
  readonly sockSilhouettes: readonly Phaser.GameObjects.Graphics[];
  readonly activeKey: string;
  offset: number;
  lastKey: string;
};

/**
 * Force-zone telegraphs: currents = drifting flow arrows, radial gravity = three dotted pixel rings with
 * inward chevrons, gusts = windsock at the band edge + arrows that brighten in warning and run while active.
 */
export class ForceZoneCues {
  private readonly fields: ArrowField[] = [];
  private readonly statics: Phaser.GameObjects.GameObject[] = [];
  private lastSimMs: number | undefined;

  constructor(
    private readonly scene: Phaser.Scene,
    zones: readonly ForceZoneDefinition[],
    private readonly theme: CampaignThemeDefinition,
    private readonly reducedMotion: boolean,
  ) {
    for (const zone of zones) {
      if (zone.kind === "radial-gravity") this.drawGravity(zone);
      else this.fields.push(this.createArrowField(zone));
    }
  }

  /** `samples` are `ForceFieldSample.zones` for this frame (same order as the route's zones). */
  update(simTimeMs: number, samples: readonly ForceSample[], ship: Point, avoid: readonly HudScreenRect[]): void {
    const dtSeconds = this.lastSimMs === undefined ? 0 : Math.max(0, simTimeMs - this.lastSimMs) / 1000;
    this.lastSimMs = simTimeMs;
    const style = campaignFlightStyle;
    for (const field of this.fields) {
      const sample = samples.find((candidate) => candidate.zoneId === field.zone.id);
      let alpha: number = style.flow.alpha;
      let speed: number = style.flow.speedPxPerSecond;
      let tint: string = campaignCuePalette.matcha;
      const warning = sample?.phase === "warning" && field.zone.kind === "gust";
      if (field.zone.kind === "gust") {
        const phase = sample?.phase ?? "calm";
        const envelope = sample?.envelope ?? 0;
        speed = style.gust.speedPxPerSecond * envelope;
        if (phase === "warning") {
          alpha = this.reducedMotion ? style.gust.warningAlpha : 0.55 + 0.3 * (0.5 + 0.5 * Math.sin(simTimeMs / 260));
          tint = this.theme.palette.light;
        } else if (phase === "calm") {
          alpha = style.gust.calmAlpha;
        } else {
          alpha = style.gust.calmAlpha + (style.gust.activeAlpha - style.gust.calmAlpha + 0.2) * envelope;
          tint = this.theme.palette.light;
        }
        const frame = windsockFrame(phase, envelope);
        if (field.windsock) field.windsock.setFrame(frame);
        field.sockSilhouettes.forEach((sock, index) => sock.setVisible(index === frame));
      }
      if (!this.reducedMotion) field.offset = wrap(field.offset + speed * dtSeconds, style.flow.spacingPx);
      const key = `${alpha.toFixed(2)}:${tint}:${warning}`;
      const restyle = key !== field.lastKey;
      field.lastKey = key;
      for (const arrow of field.arrows) {
        const x = arrow.base.x + field.direction.x * field.offset;
        const y = arrow.base.y + field.direction.y * field.offset;
        const inside = x >= field.bounds.x && x <= field.bounds.x + field.bounds.width && y >= field.bounds.y && y <= field.bounds.y + field.bounds.height;
        const camera = this.scene.cameras.main;
        const clear = cueIsClear({ x, y }, ship, { x: x - camera.scrollX, y: y - camera.scrollY }, this.scene.scale.width, this.scene.scale.height, avoid);
        arrow.image.setPosition(snap(x), snap(y)).setVisible(inside && clear);
        if (restyle) arrow.image.setTexture(warning ? "flight-gust-outline" : field.activeKey).setAlpha(alpha).setTint(colorNumber(tint));
      }
    }
  }

  destroy(): void {
    for (const field of this.fields) {
      for (const arrow of field.arrows) arrow.image.destroy();
      field.windsock?.destroy();
      for (const sock of field.sockSilhouettes) sock.destroy();
    }
    for (const object of this.statics) object.destroy();
  }

  private createArrowField(zone: Extract<ForceZoneDefinition, { kind: "directional-current" | "gust" }>): ArrowField {
    const style = campaignFlightStyle.flow;
    const push = zone.kind === "gust" ? zone.peakAcceleration : zone.acceleration;
    const rotation = quarterTurnRotation(push.x, push.y);
    const direction = { x: Math.round(Math.cos(rotation)), y: Math.round(Math.sin(rotation)) };
    const outer = zoneBounds(zone.area);
    const inset = style.edgeInsetPx;
    const bounds = { x: outer.x + inset, y: outer.y + inset, width: Math.max(0, outer.width - inset * 2), height: Math.max(0, outer.height - inset * 2) };
    const arrows: { image: Phaser.GameObjects.Image; base: Point }[] = [];
    const spacing = style.spacingPx;
    this.ensureFlowTextures();
    const activeKey = zone.kind === "gust" ? ASSET.campaignFlowArrow : "flight-current-wisp";
    for (const { x, y } of flowCueBases(bounds, direction.y !== 0, spacing)) {
        const image = this.scene.add
          .image(snap(x), snap(y), activeKey)
          .setScale(FLIGHT_ART_SCALE)
          .setRotation(rotation)
          .setDepth(CUE_DEPTH)
          .setAlpha(style.alpha)
          .setVisible(false);
        arrows.push({ image, base: { x, y } });
    }
    let windsock: Phaser.GameObjects.Image | undefined;
    const sockSilhouettes: Phaser.GameObjects.Graphics[] = [];
    if (zone.kind === "gust") {
      windsock = this.scene.add
        .image(snap(outer.x + outer.width / 2), snap(outer.y + outer.height / 2), ASSET.campaignWindsock, 0)
        .setScale(FLIGHT_ART_SCALE)
        .setFlipX(push.x < 0)
        .setDepth(WINDSOCK_DEPTH);
      const post = this.scene.add.graphics().setDepth(WINDSOCK_DEPTH - 0.01);
      post.fillStyle(colorNumber(this.theme.palette.light), 1).fillRect(windsock.x - 24, windsock.y - 20, 4, 92);
      post.fillStyle(colorNumber(this.theme.palette.accent), 1).fillRect(windsock.x - 36, windsock.y + 70, 28, 6);
      this.statics.push(post);
      for (let frame = 0; frame < 4; frame += 1) {
        const sock = this.scene.add.graphics().setPosition(windsock.x - 20, windsock.y - 20).setDepth(WINDSOCK_DEPTH).setVisible(false);
        const droop = [32, 20, 8, 0][frame] ?? 0;
        for (let t = 0; t < 48; t += 2) {
          const y = snap(droop * t / 48);
          const half = snap(12 - t / 8);
          sock.fillStyle(colorNumber(this.theme.palette.light), 1).fillRect(t, y - half, 2, half * 2);
          sock.fillStyle(colorNumber(this.theme.palette.skyTop), 1).fillRect(t, y - half + 2, 2, Math.max(2, half * 2 - 4));
          if (Math.floor(t / 10) % 2 === 0) sock.fillStyle(colorNumber(this.theme.palette.light), 1).fillRect(t, y - half + 4, 2, Math.max(2, half * 2 - 8));
        }
        sockSilhouettes.push(sock);
      }
    }
    return { zone, arrows, direction, bounds, windsock, sockSilhouettes, activeKey, offset: 0, lastKey: "" };
  }

  private ensureFlowTextures(): void {
    for (const key of ["flight-current-wisp", "flight-gust-outline"]) {
      if (this.scene.textures.exists(key)) continue;
      const g = this.scene.add.graphics();
      g.fillStyle(0xffffff, 1);
      if (key === "flight-current-wisp") {
        for (let x = 2; x < 40; x += 2) {
          const y = 9 + Math.round(Math.sin(x / 7) * 2);
          g.fillRect(x, y, 2, 1);
          if (x > 10 && x < 32) g.fillRect(x - 4, y + 5, 2, 1);
        }
        g.fillRect(35, 7, 2, 2).fillRect(37, 8, 2, 2).fillRect(35, 11, 2, 2);
      } else {
        g.fillRect(3, 6, 18, 1).fillRect(3, 10, 18, 1).fillRect(3, 6, 1, 5);
        for (let t = 0; t <= 6; t += 1) { g.fillRect(26 - t, 8 - t, 1, 1); g.fillRect(26 - t, 8 + t, 1, 1); }
      }
      g.generateTexture(key, 44, 20); g.destroy();
    }
  }

  private drawGravity(zone: Extract<ForceZoneDefinition, { kind: "radial-gravity" }>): void {
    const style = campaignFlightStyle.gravity;
    const g = this.scene.add.graphics().setDepth(CUE_DEPTH);
    const color = colorNumber(this.theme.palette.accent);
    const light = colorNumber(this.theme.palette.light);
    const { x: cx, y: cy } = zone.center;
    style.ringFractions.forEach((fraction, ringIndex) => {
      const radius = zone.radius * fraction;
      const alpha = style.ringAlphas[ringIndex] ?? 0.2;
      g.fillStyle(color, alpha);
      const steps = Math.max(24, Math.round((Math.PI * 2 * radius) / style.dotSpacingPx));
      for (let i = 0; i < steps; i += 1) {
        const angle = (i / steps) * Math.PI * 2;
        g.fillRect(snap(cx + Math.cos(angle) * radius) - style.dotPx / 2, snap(cy + Math.sin(angle) * radius) - style.dotPx / 2, style.dotPx, style.dotPx);
      }
      // Inward chevrons on each ring, staggered so the three rings read as one funnel.
      g.fillStyle(light, Math.min(0.6, alpha + 0.22));
      for (let i = 0; i < style.arrowsPerRing; i += 1) {
        const angle = ((i + (ringIndex % 2) * 0.5) / style.arrowsPerRing) * Math.PI * 2;
        const inX = -Math.cos(angle);
        const inY = -Math.sin(angle);
        const tipX = cx + Math.cos(angle) * (radius - style.arrowSizePx);
        const tipY = cy + Math.sin(angle) * (radius - style.arrowSizePx);
        for (let t = 0; t <= style.arrowSizePx; t += FLIGHT_ART_SCALE) {
          for (const side of [-1, 1]) {
            const x = tipX - inX * t + -inY * side * t;
            const y = tipY - inY * t + inX * side * t;
            g.fillRect(snap(x) - 1, snap(y) - 1, 3, 3);
          }
        }
      }
    });
    this.statics.push(g);
    const coreKey = ensurePixelHalo(this.scene, {
      key: `flight-gravity-core-${this.theme.id}`,
      radius: Math.max(4, Math.round(zone.coreRadius / FLIGHT_ART_SCALE / 3)),
      steps: [4, 10, 18],
      color: this.theme.palette.accent,
      alphaPerStep: 0.07,
    });
    const core = this.scene.add.image(snap(cx), snap(cy), coreKey).setScale(FLIGHT_ART_SCALE).setDepth(CUE_DEPTH);
    this.statics.push(core);
    // The oven is decorative and non-colliding; its centre remains a safe zero-force sample.
    const oven = this.scene.add.graphics().setPosition(snap(cx), snap(cy)).setDepth(depth.world - 0.4);
    oven.fillStyle(light, 0.24); fillPixelDisc(oven, 0, 0, 62);
    oven.fillStyle(light, 1); fillPixelDisc(oven, 0, 0, 52);
    oven.fillStyle(colorNumber(this.theme.palette.skyTop), 1); fillPixelDisc(oven, 0, 0, 46);
    oven.fillStyle(light, 0.9).fillRect(-26, 16, 52, 4).fillRect(-20, 22, 40, 4);
    oven.fillStyle(light, 1).fillRect(-14, -12, 4, 4).fillRect(12, -12, 4, 4);
    this.statics.push(oven);
    if (!this.reducedMotion) {
      this.scene.tweens.add({ targets: g, alpha: 1 - style.breathAlpha, duration: style.breathMs, ease: "Sine.easeInOut", yoyo: true, repeat: -1 });
      this.scene.tweens.add({ targets: oven, alpha: 0.78, duration: style.breathMs, ease: "Sine.easeInOut", yoyo: true, repeat: -1 });
    }
  }
}

/** Stepped fog bank: nested tiled bands (soft pixel edge), total alpha ≤ maxAlpha, slow decorative drift. */
export class FogLayer {
  private readonly bands: Phaser.GameObjects.TileSprite[] = [];

  constructor(
    scene: Phaser.Scene,
    private readonly visibility: Extract<VisibilityDefinition, { kind: "fog" }>,
    private readonly reducedMotion: boolean,
  ) {
    const style = campaignFlightStyle.fog;
    const outer = zoneBounds(visibility.area);
    // n stacked bands of alpha a/n compound to 1-(1-a/n)^n < a, so the densest point never exceeds maxAlpha.
    const bandAlpha = visibility.maxAlpha / style.bands;
    for (let i = 0; i < style.bands; i += 1) {
      const inset = i * style.bandInsetPx;
      const width = outer.width - inset * 2;
      const height = outer.height - inset * 2;
      if (width <= 0 || height <= 0) break;
      const band = scene.add
        .tileSprite(snap(outer.x + inset), snap(outer.y + inset), snap(width), snap(height), visibility.textureKey)
        .setOrigin(0, 0)
        .setTileScale(FLIGHT_ART_SCALE)
        .setTint(colorNumber(i % 2 === 0 ? campaignCuePalette.fog : campaignCuePalette.matcha))
        .setTintMode(Phaser.TintModes.SCREEN)
        .setAlpha(bandAlpha)
        .setDepth(FOG_DEPTH + i * 0.01);
      band.tilePositionX = i * 37;
      band.tilePositionY = i * 19;
      const maskKey = `flight-fog-fringe-${i}-${width}-${height}`;
      if (!scene.textures.exists(maskKey)) {
        const fringe = scene.add.graphics();
        fringe.fillStyle(0xffffff, 1);
        // Static mask in art pixels; Phaser 4's internal filter maps it to the whole band.
        for (let row = 0; row < height; row += 16) {
          const edge = 30 + Math.round((1 + Math.sin(row / 45 + i)) * 20 / 2) * 2;
          const topBottom = Math.max(0, 60 - Math.min(row, height - row));
          fringe.fillRect((edge + topBottom) / FLIGHT_ART_SCALE, row / FLIGHT_ART_SCALE, (width - 2 * (edge + topBottom)) / FLIGHT_ART_SCALE, Math.min(16, height - row) / FLIGHT_ART_SCALE);
        }
        fringe.generateTexture(maskKey, width / FLIGHT_ART_SCALE, height / FLIGHT_ART_SCALE);
        fringe.destroy();
      }
      band.enableFilters();
      band.filters?.internal.addMask(maskKey);
      this.bands.push(band);
    }
  }

  update(simTimeMs: number): void {
    if (this.reducedMotion) return;
    const drift = this.visibility.driftPixelsPerSecond;
    this.bands.forEach((band, index) => {
      const factor = campaignFlightStyle.fog.driftScale * (1 + index * 0.35);
      // Whole art pixels only, so the fog texture never shimmers on sub-pixel offsets.
      band.tilePositionX = Math.round((simTimeMs / 1000) * drift.x * factor / FLIGHT_ART_SCALE) + index * 37;
      band.tilePositionY = Math.round((simTimeMs / 1000) * drift.y * factor / FLIGHT_ART_SCALE) + index * 19;
    });
  }

  destroy(): void {
    for (const band of this.bands) band.destroy();
  }
}
