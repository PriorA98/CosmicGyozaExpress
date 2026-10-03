import Phaser from "phaser";
import { ASSET } from "../../data/assetManifest";
import type { CampaignThemeDefinition } from "../../data/campaign/themes";
import { FLIGHT_ART_SCALE, campaignFlightStyle, campaignCuePalette } from "../../data/flightScenery";
import { colorNumber, depth } from "../../game/designTokens";
import type { ForceSample } from "../../systems/ForceFieldSystem";
import { motionPathTrack } from "../../systems/MotionPathSystem";
import type { ForceZoneDefinition, MovingObstacleDefinition, VisibilityDefinition } from "../../types/campaign";
import type { Point } from "../../types/flight";
import { cueIsClear, flowCueBases, fogPuffLayout, gustCueLevels, quarterTurnRotation, windsockFrame, wrap, zoneBounds, type FogPuff } from "./flightCueMath";
import { seededRandom } from "./textureFallbacks";
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
  /** Gusts only: wisps streaming along the two band edges parallel to the push. */
  readonly streaks: readonly { readonly image: Phaser.GameObjects.Image; readonly base: Point }[];
  /** Gusts only: faint band tint + dotted edges, drawn once; only its alpha changes. */
  readonly band: Phaser.GameObjects.Graphics | undefined;
  readonly direction: Point;
  readonly bounds: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly outer: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly windsock: Phaser.GameObjects.Image | undefined;
  readonly sockSilhouettes: readonly Phaser.GameObjects.Graphics[];
  readonly activeKey: string;
  readonly spacing: number;
  offset: number;
  streakOffset: number;
  lastKey: string;
};

const GUST_STREAK_KEY = "flight-gust-streak";
const GUST_OUTLINE_KEY = "flight-gust-outline";
const CURRENT_WISP_KEY = "flight-current-wisp-v2";

/**
 * Force-zone telegraphs: currents = drifting flow wisps along several lanes, radial gravity = three dotted
 * pixel rings with inward chevrons, gusts = windsock at the band entry + band tint/edges + arrows that are
 * outlined while gathering (warning) and bright, streaming and edge-wisped while pushing (the strongest state).
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
    private readonly entry?: Point,
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
    const camera = this.scene.cameras.main;
    const { width, height } = this.scene.scale;
    for (const field of this.fields) {
      const sample = samples.find((candidate) => candidate.zoneId === field.zone.id);
      let alpha: number = style.flow.alpha;
      let streakAlpha = 0;
      let speed: number = style.flow.speedPxPerSecond;
      let tint: string = campaignCuePalette.matcha;
      let outlined = false;
      if (field.zone.kind === "gust") {
        const phase = sample?.phase ?? "calm";
        const envelope = sample?.envelope ?? 0;
        // Physics and cue read the same sample: speed and brightness follow the envelope that pushes the ship.
        const levels = gustCueLevels(phase, envelope, simTimeMs, this.reducedMotion);
        alpha = levels.arrows;
        streakAlpha = levels.streaks;
        outlined = levels.outlined;
        speed = phase === "warning" ? style.gust.speedPxPerSecond * 0.12 : style.gust.speedPxPerSecond * envelope;
        tint = outlined ? this.theme.palette.light : campaignCuePalette.cream;
        field.band?.setAlpha(levels.band);
        const frame = windsockFrame(phase, envelope);
        if (field.windsock) field.windsock.setFrame(frame);
        field.sockSilhouettes.forEach((sock, index) => sock.setVisible(index === frame));
      }
      if (!this.reducedMotion) {
        field.offset = wrap(field.offset + speed * dtSeconds, field.spacing);
        field.streakOffset = wrap(field.streakOffset + speed * style.gust.streakSpeedScale * dtSeconds, style.gust.streakSpacingPx);
      }
      const key = `${alpha.toFixed(2)}:${streakAlpha.toFixed(2)}:${tint}:${outlined}`;
      const restyle = key !== field.lastKey;
      field.lastKey = key;
      const place = (image: Phaser.GameObjects.Image, base: Point, offset: number, bounds: ArrowField["bounds"], shown: boolean): void => {
        const x = base.x + field.direction.x * offset;
        const y = base.y + field.direction.y * offset;
        const inside = x >= bounds.x && x <= bounds.x + bounds.width && y >= bounds.y && y <= bounds.y + bounds.height;
        const visible = shown && inside && cueIsClear({ x, y }, ship, { x: x - camera.scrollX, y: y - camera.scrollY }, width, height, avoid);
        image.setVisible(visible);
        if (visible) image.setPosition(snap(x), snap(y));
      };
      for (const arrow of field.arrows) {
        place(arrow.image, arrow.base, field.offset, field.bounds, alpha > 0.01);
        if (restyle) arrow.image.setTexture(outlined ? GUST_OUTLINE_KEY : field.activeKey).setAlpha(alpha).setTint(colorNumber(tint));
      }
      for (const streak of field.streaks) {
        place(streak.image, streak.base, field.streakOffset, field.outer, streakAlpha > 0.01);
        if (restyle) streak.image.setAlpha(streakAlpha);
      }
    }
  }

  destroy(): void {
    for (const field of this.fields) {
      for (const arrow of field.arrows) arrow.image.destroy();
      for (const streak of field.streaks) streak.image.destroy();
      field.band?.destroy();
      field.windsock?.destroy();
      for (const sock of field.sockSilhouettes) sock.destroy();
    }
    for (const object of this.statics) object.destroy();
  }

  private createArrowField(zone: Extract<ForceZoneDefinition, { kind: "directional-current" | "gust" }>): ArrowField {
    const style = campaignFlightStyle.flow;
    const gustStyle = campaignFlightStyle.gust;
    const isGust = zone.kind === "gust";
    const push = isGust ? zone.peakAcceleration : zone.acceleration;
    const rotation = quarterTurnRotation(push.x, push.y);
    const direction = { x: Math.round(Math.cos(rotation)), y: Math.round(Math.sin(rotation)) };
    const vertical = direction.y !== 0;
    const outer = zoneBounds(zone.area);
    const inset = style.edgeInsetPx;
    const bounds = { x: outer.x + inset, y: outer.y + inset, width: Math.max(0, outer.width - inset * 2), height: Math.max(0, outer.height - inset * 2) };
    const arrows: { image: Phaser.GameObjects.Image; base: Point }[] = [];
    const spacing = isGust ? gustStyle.spacingPx : style.currentSpacingPx;
    const lanes = isGust ? gustStyle.lanes : style.currentLanes;
    this.ensureFlowTextures();
    const activeKey = isGust ? ASSET.campaignFlowArrow : CURRENT_WISP_KEY;
    for (const { x, y } of flowCueBases(bounds, vertical, spacing, lanes)) {
      const image = this.scene.add
        .image(snap(x), snap(y), activeKey)
        .setScale(FLIGHT_ART_SCALE)
        .setRotation(rotation)
        .setDepth(CUE_DEPTH)
        .setAlpha(style.alpha)
        .setVisible(false);
      arrows.push({ image, base: { x, y } });
    }
    const streaks: { image: Phaser.GameObjects.Image; base: Point }[] = [];
    let band: Phaser.GameObjects.Graphics | undefined;
    let windsock: Phaser.GameObjects.Image | undefined;
    const sockSilhouettes: Phaser.GameObjects.Graphics[] = [];
    if (isGust) {
      const light = colorNumber(this.theme.palette.light);
      band = this.scene.add.graphics().setDepth(FOG_DEPTH + 0.2).setAlpha(0);
      band.fillStyle(light, gustStyle.bandFillAlpha).fillRect(snap(outer.x), snap(outer.y), snap(outer.width), snap(outer.height));
      // Dotted edges on the two sides parallel to the push: the "walls" of the gust band.
      band.fillStyle(light, gustStyle.bandEdgeAlpha);
      const edgeLength = vertical ? outer.height : outer.width;
      for (const side of [0, 1]) {
        for (let t = 0; t < edgeLength; t += 16) {
          const ex = vertical ? outer.x + side * outer.width : outer.x + t;
          const ey = vertical ? outer.y + t : outer.y + side * outer.height;
          band.fillRect(snap(ex) - 2, snap(ey) - 2, vertical ? 4 : 8, vertical ? 8 : 4);
        }
      }
      // Streaming wisps just inside both edges (two staggered rows per edge).
      for (const [side, depthIn] of [[0, 28], [0, 70], [1, -28], [1, -70]] as const) {
        const stagger = Math.abs(depthIn) > 40 ? gustStyle.streakSpacingPx / 2 : 0;
        for (let t = -gustStyle.streakSpacingPx + stagger; t <= edgeLength + gustStyle.streakSpacingPx; t += gustStyle.streakSpacingPx) {
          const base = vertical
            ? { x: outer.x + side * outer.width + depthIn, y: outer.y + t }
            : { x: outer.x + t, y: outer.y + side * outer.height + depthIn };
          const image = this.scene.add
            .image(snap(base.x), snap(base.y), GUST_STREAK_KEY)
            .setScale(FLIGHT_ART_SCALE)
            .setRotation(rotation)
            .setTint(colorNumber(campaignCuePalette.cream))
            .setDepth(CUE_DEPTH)
            .setVisible(false);
          streaks.push({ image, base });
        }
      }
      // Windsock at the band entry (side nearest the route start), dropped below the flight line so the
      // edge indicator's label band and the ship's path stay clear.
      const centre = { x: outer.x + outer.width / 2, y: outer.y + outer.height / 2 };
      const entry = this.entry ?? centre;
      const sockX = entry.x <= centre.x ? outer.x + gustStyle.windsockInsetPx : outer.x + outer.width - gustStyle.windsockInsetPx;
      const sockY = Math.min(outer.y + outer.height - gustStyle.windsockInsetPx - 80, Math.max(outer.y + gustStyle.windsockInsetPx, entry.y + gustStyle.windsockDropPx));
      windsock = this.scene.add
        .image(snap(sockX), snap(sockY), ASSET.campaignWindsock, 0)
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
    return { zone, arrows, streaks, band, direction, bounds, outer, windsock, sockSilhouettes, activeKey, spacing, offset: 0, streakOffset: 0, lastKey: "" };
  }

  private ensureFlowTextures(): void {
    for (const key of [CURRENT_WISP_KEY, GUST_OUTLINE_KEY, GUST_STREAK_KEY]) {
      if (this.scene.textures.exists(key)) continue;
      const g = this.scene.add.graphics();
      g.fillStyle(0xffffff, 1);
      let size = { w: 44, h: 20 };
      if (key === CURRENT_WISP_KEY) {
        // Three long wavy strands with a soft head: a drifting current, not an arrow or a lane line.
        size = { w: 72, h: 28 };
        const strands = [{ y: 8, from: 6, to: 64, phase: 0 }, { y: 15, from: 0, to: 70, phase: 1.7 }, { y: 22, from: 14, to: 56, phase: 3.1 }];
        for (const strand of strands) {
          for (let x = strand.from; x < strand.to; x += 1) {
            const y = strand.y + Math.round(Math.sin(x / 9 + strand.phase) * 2);
            if (x % 12 === 11) continue; // breaks keep it wispy
            g.fillRect(x, y, 1, 1);
          }
        }
        g.fillRect(66, 13, 2, 2).fillRect(68, 15, 2, 2).fillRect(66, 17, 2, 2);
      } else if (key === GUST_OUTLINE_KEY) {
        g.fillRect(3, 6, 18, 1).fillRect(3, 10, 18, 1).fillRect(3, 6, 1, 5);
        for (let t = 0; t <= 6; t += 1) { g.fillRect(26 - t, 8 - t, 1, 1); g.fillRect(26 - t, 8 + t, 1, 1); }
      } else {
        // Gust streak: bright head, dashed fading tail (alpha steps on the art grid).
        size = { w: 40, h: 6 };
        g.fillStyle(0xffffff, 1).fillRect(26, 2, 12, 2).fillRect(36, 1, 2, 4);
        g.fillStyle(0xffffff, 0.6).fillRect(14, 2, 10, 2);
        g.fillStyle(0xffffff, 0.3).fillRect(2, 2, 9, 2);
      }
      g.generateTexture(key, size.w, size.h); g.destroy();
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

/**
 * Soft fog bank: deterministic puffs (three stepped-halo sizes) jittered over the area, thinner and fainter
 * at the fringe; slow drift wraps inside the area with an edge fade so nothing pops. Two overlapping puffs
 * stay under `maxAlpha`. Static textures; per frame only positions/alpha of ~30 images change.
 */
export class FogLayer {
  private readonly puffs: { readonly image: Phaser.GameObjects.Image; readonly puff: FogPuff; readonly baseAlpha: number }[] = [];
  private readonly outer: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };

  constructor(
    scene: Phaser.Scene,
    private readonly visibility: Extract<VisibilityDefinition, { kind: "fog" }>,
    private readonly reducedMotion: boolean,
  ) {
    const style = campaignFlightStyle.fog;
    this.outer = zoneBounds(visibility.area);
    const perStep = visibility.maxAlpha / 3 / style.puffSteps.length;
    const keys = style.puffRadiiArt.map((radius) => ensurePixelHalo(scene, {
      key: `flight-fog-puff-${radius}`,
      radius,
      steps: style.puffSteps,
      color: style.color,
      alphaPerStep: perStep,
    }));
    fogPuffLayout(this.outer, style.puffSpacingPx, seededRandom(style.seed)).forEach((puff, index) => {
      // Each puff is a lumpy cloud: a main disc plus a smaller, offset companion, so no puff reads as a circle.
      const side = index % 2 === 0 ? 1 : -1;
      const radius = (style.puffRadiiArt[puff.size] ?? style.puffRadiiArt[0]) * FLIGHT_ART_SCALE;
      const companionSize: 0 | 1 | 2 = puff.size === 2 ? 1 : 0;
      const companion: FogPuff = { ...puff, x: puff.x + side * radius * style.companionOffset[0], y: puff.y - radius * style.companionOffset[1], size: companionSize };
      for (const part of [puff, companion]) {
        const image = scene.add
          .image(snap(part.x), snap(part.y), keys[part.size] ?? keys[0] ?? "")
          .setScale(FLIGHT_ART_SCALE)
          .setAlpha(part.alpha)
          .setDepth(FOG_DEPTH + part.size * 0.01);
        this.puffs.push({ image, puff: part, baseAlpha: part.alpha });
      }
    });
  }

  update(simTimeMs: number): void {
    if (this.reducedMotion) return;
    const drift = this.visibility.driftPixelsPerSecond;
    const style = campaignFlightStyle.fog;
    const { x: ox, y: oy, width, height } = this.outer;
    for (const { image, puff, baseAlpha } of this.puffs) {
      const factor = style.driftScale * puff.drift * (simTimeMs / 1000);
      const x = ox + wrap(puff.x - ox + drift.x * factor, width);
      const y = oy + wrap(puff.y - oy + drift.y * factor, height);
      const edge = Math.min(x - ox, ox + width - x, y - oy, oy + height - y);
      image.setPosition(snap(x), snap(y)).setAlpha(baseAlpha * Math.max(0, Math.min(1, edge / style.edgeFadePx)));
    }
  }

  destroy(): void {
    for (const { image } of this.puffs) image.destroy();
  }
}
