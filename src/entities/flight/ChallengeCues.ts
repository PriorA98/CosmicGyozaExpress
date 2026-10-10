import Phaser from "phaser";
import type { CampaignThemeDefinition } from "../../data/campaign/themes";
import { FLIGHT_ART_SCALE, challengeCueStyle } from "../../data/flightScenery";
import { colorNumber, depth } from "../../game/designTokens";
import { seekerNoiseShare, type SeekerState } from "../../systems/SeekerSystem";
import type { ForceZoneDefinition, SeekerDefinition, VisibilityDefinition } from "../../types/campaign";
import type { Point } from "../../types/flight";
import { ensurePixelHalo } from "./pixelArt";

/**
 * Phase-4 telegraphs: tea-koi (lure glow = how close a koi is to waking), dense fog with lantern buoys, and the
 * oven mouth / white-hole toaster of a warping gravity well. Textures are drawn once from canvas pixels.
 * Depth: dense fog sits above the world; koi, lanterns and the toaster sit above the fog so every hazard and
 * every safe light stays readable through it.
 */
const DENSE_FOG_DEPTH = depth.worldFx - 1;
const ABOVE_FOG_DEPTH = depth.worldFx - 0.5;

const snap = (value: number): number => Math.round(value / FLIGHT_ART_SCALE) * FLIGHT_ART_SCALE;

function paintTexture(scene: Phaser.Scene, key: string, width: number, height: number, draw: (context: CanvasRenderingContext2D) => void): string {
  if (scene.textures.exists(key)) return key;
  const texture = scene.textures.createCanvas(key, width, height);
  if (!texture) return key;
  const context = texture.getContext();
  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, width, height);
  draw(context);
  texture.refresh();
  return key;
}

type PixelRect = (x: number, y: number, w: number, h: number, color: string) => void;

function pixelRect(context: CanvasRenderingContext2D): PixelRect {
  return (x, y, w, h, color) => {
    context.fillStyle = color;
    context.fillRect(x, y, w, h);
  };
}

type KoiExpression = "shut" | "open" | "nibble";
const KOI_KEYS = {
  shut: ["flight-tea-koi-shut-0", "flight-tea-koi-shut-1"],
  open: ["flight-tea-koi-open-0", "flight-tea-koi-open-1"],
  nibble: ["flight-tea-koi-nibble-0", "flight-tea-koi-nibble-1"],
} as const;

/** Authored row spans keep every curve stepped, with a one-texel ink contour. */
function koiTexture(scene: Phaser.Scene, expression: KoiExpression, tail: 0 | 1): string {
  const style = challengeCueStyle.koi;
  return paintTexture(scene, KOI_KEYS[expression][tail], style.widthArt, style.heightArt, (c) => {
    const px = pixelRect(c);
    const sway = tail;
    // A forked fan, with warm ribs; only the tail changes between the two cells.
    const tailSpans: readonly (readonly [number, number])[] = [[1, 3], [1, 5], [2, 6], [2, 7], [3, 8], [3, 8], [4, 7], [3, 8], [3, 7], [2, 6], [2, 5], [1, 4], [1, 3]];
    tailSpans.forEach(([x, width], row) => {
      px(x + sway, row + 13, width, 1, style.outline);
      if (width > 2) px(x + sway + 1, row + 13, width - 2, 1, row < 6 ? style.patch : style.patchShade);
    });
    px(3 + sway, 15, 2, 3, style.patchLight); px(5 + sway, 18, 3, 1, style.body);
    px(4 + sway, 22, 2, 2, style.patch); px(3 + sway, 25, 1, 1, style.body);
    // Dorsal and belly fins, beneath the plump body.
    px(15, 7, 3, 1, style.outline); px(13, 8, 8, 1, style.outline);
    px(12, 9, 10, 3, style.outline); px(14, 9, 5, 2, style.patchLight);
    px(15, 28, 8, 2, style.outline); px(16, 30, 5, 1, style.outline); px(17, 31, 3, 1, style.outline);
    px(16, 28, 6, 1, style.patch); px(17, 29, 3, 1, style.patchShade); px(18, 30, 2, 1, style.bodyShade);
    const bodySpans: readonly (readonly [number, number])[] = [[19, 9], [15, 17], [12, 22], [10, 26], [9, 28], [8, 30], [8, 30], [7, 31], [7, 32], [7, 32], [8, 31], [8, 31], [9, 30], [9, 29], [10, 27], [11, 25], [13, 22], [16, 17], [20, 9]];
    bodySpans.forEach(([left, width], row) => {
      const y = row + 10;
      for (let x = left; x < left + width; x += 1) {
        const above = bodySpans[row - 1];
        const below = bodySpans[row + 1];
        const edge = x === left || x === left + width - 1 || !above || !below || x < above[0] || x >= above[0] + above[1] || x < below[0] || x >= below[0] + below[1];
        let color: string = edge ? style.outline : y < 14 ? style.bodyLight : y > 24 ? style.bodyShade : style.body;
        if (!edge && ((x >= 15 && x <= 22 && y <= 15) || (x >= 11 && x <= 15 && y >= 19 && y <= 23) || (x >= 25 && x <= 30 && y >= 23))) {
          color = y < 13 ? style.patchLight : y > 25 ? style.patchShade : style.patch;
        }
        px(x, y, 1, 1, color);
      }
    });
    // Near fin and a few restrained scales, matching the rocks' detail density.
    px(21, 21, 3, 1, style.patchShade); px(20, 22, 5, 1, style.outline);
    px(21, 23, 4, 1, style.patch); px(22, 24, 2, 1, style.patchShade);
    px(17, 17, 2, 1, style.bodyShade); px(27, 12, 2, 1, style.bodyLight);
    px(30, 21, 2, 1, style.patchLight);
    // The curled stalk has its own ink border and a fixed bulb registration in every cell.
    px(27, 3, 1, 8, style.outline); px(28, 1, 5, 1, style.outline);
    px(28, 2, 1, 2, style.outline); px(29, 2, 3, 1, style.bodyShade);
    px(32, 2, 2, 1, style.outline); px(33, 3, 1, 2, style.outline);
    px(32, 4, 4, 1, style.outline); px(31, 5, 6, 3, style.outline); px(32, 8, 4, 1, style.outline);
    px(32, 5, 4, 2, style.lure); px(33, 7, 3, 1, style.patchLight); px(32, 5, 2, 1, style.bodyLight);
    if (expression === "shut") {
      px(29, 17, 1, 1, style.outline); px(30, 18, 3, 1, style.outline); px(33, 17, 1, 1, style.outline);
    } else {
      px(30, 16, 3, 4, style.outline); px(29, 17, 1, 2, style.outline); px(30, 16, 1, 1, style.bodyLight);
    }
    if (expression === "nibble") {
      px(35, 20, 4, 5, style.outline); px(35, 21, 3, 3, style.mouth); px(35, 23, 2, 1, style.tongue);
      px(34, 20, 2, 1, style.bodyLight);
    } else {
      px(37, 21, 2, 1, style.outline); px(36, 22, 1, 1, style.bodyShade);
    }
  });
}

function sleepTexture(scene: Phaser.Scene): string {
  const style = challengeCueStyle.koi;
  return paintTexture(scene, "flight-koi-sleep-bubble", 12, 12, (c) => {
    const px = pixelRect(c);
    px(3, 0, 6, 1, style.outline); px(1, 1, 10, 1, style.outline); px(0, 2, 12, 7, style.outline);
    px(1, 2, 10, 7, style.body); px(2, 1, 8, 1, style.body); px(2, 9, 8, 1, style.outline);
    px(3, 9, 2, 2, style.outline); px(3, 9, 1, 1, style.body);
    px(3, 3, 6, 1, style.mouth); px(7, 4, 1, 1, style.mouth); px(5, 5, 2, 1, style.mouth);
    px(4, 6, 1, 1, style.mouth); px(3, 7, 6, 1, style.mouth); px(2, 2, 2, 1, style.bodyLight);
  });
}

/** Soft square dots with a faint two-texel skirt; drawn once, then only alpha changes. */
function dottedRipple(graphics: Phaser.GameObjects.Graphics, x: number, y: number, radius: number, color: string, spacing: number): void {
  const count = Math.max(12, Math.round(Math.PI * 2 * radius / spacing));
  for (let i = 0; i < count; i += 1) {
    const angle = i / count * Math.PI * 2;
    const dx = snap(x + Math.cos(angle) * radius);
    const dy = snap(y + Math.sin(angle) * radius);
    graphics.fillStyle(colorNumber(color), 0.16).fillRect(dx - 4, dy - 4, 8, 8);
    graphics.fillStyle(colorNumber(color), 0.8).fillRect(dx - 1, dy - 1, 2, 2);
  }
}

type KoiSprite = {
  readonly definition: SeekerDefinition;
  readonly body: Phaser.GameObjects.Image;
  readonly lure: Phaser.GameObjects.Image;
  readonly hearing: Phaser.GameObjects.Graphics;
  readonly ripple: Phaser.GameObjects.Graphics;
  readonly sleep: Phaser.GameObjects.Image;
  textureKey: string;
  mode: SeekerState["mode"];
  facing: 1 | -1;
};

export class TeaKoiSchool {
  private readonly koi: KoiSprite[] = [];

  constructor(private readonly scene: Phaser.Scene, definitions: readonly SeekerDefinition[], theme: CampaignThemeDefinition, private readonly reducedMotion: boolean) {
    const style = challengeCueStyle.koi;
    for (const expression of ["shut", "open", "nibble"] as const) {
      koiTexture(scene, expression, 0);
      koiTexture(scene, expression, 1);
    }
    const shut = KOI_KEYS.shut[0];
    const sleepKey = sleepTexture(scene);
    const lureKey = ensurePixelHalo(scene, { key: "flight-koi-lure", radius: 3, steps: [1, 4, 8, 13], color: style.lure, alphaPerStep: 0.22 });
    for (const definition of definitions) {
      const hearing = scene.add.graphics().setDepth(ABOVE_FOG_DEPTH - 0.1);
      dottedRipple(hearing, definition.home.x, definition.home.y, definition.hearingRadius, theme.palette.light, style.hearingDotSpacingPx);
      hearing.setAlpha(style.hearingIdleAlpha);
      const body = scene.add.image(snap(definition.home.x), snap(definition.home.y), shut).setScale(FLIGHT_ART_SCALE * style.scale).setDepth(ABOVE_FOG_DEPTH);
      const lure = scene.add.image(body.x, body.y, lureKey).setScale(FLIGHT_ART_SCALE).setDepth(ABOVE_FOG_DEPTH + 0.01).setBlendMode(Phaser.BlendModes.ADD);
      const ripple = scene.add.graphics().setDepth(ABOVE_FOG_DEPTH - 0.05).setVisible(false);
      dottedRipple(ripple, 0, 0, definition.radius + 14, style.ripple, 12);
      const sleep = scene.add.image(body.x, body.y, sleepKey).setScale(FLIGHT_ART_SCALE).setDepth(ABOVE_FOG_DEPTH + 0.02);
      this.koi.push({ definition, body, lure, hearing, ripple, sleep, textureKey: shut, mode: "sleeping", facing: 1 });
    }
  }

  update(states: readonly SeekerState[], simTimeMs: number): void {
    const style = challengeCueStyle.koi;
    this.koi.forEach((koi, index) => {
      const state = states[index];
      if (!state) return;
      const noise = seekerNoiseShare(koi.definition, state);
      if (state.mode !== koi.mode) {
        koi.mode = state.mode;
        if (state.mode === "alert") this.playRipple(koi);
        else koi.ripple.setVisible(false);
      }
      const expression: KoiExpression = state.mode === "chasing" ? "nibble" : state.mode === "alert" ? "open" : "shut";
      const frameMs = state.mode === "chasing" ? style.chaseTailFrameMs : style.tailFrameMs;
      const tail: 0 | 1 = this.reducedMotion ? 0 : Math.floor(simTimeMs / frameMs + index) % 2 === 0 ? 0 : 1;
      const textureKey = KOI_KEYS[expression][tail];
      if (textureKey !== koi.textureKey) {
        koi.body.setTexture(textureKey);
        koi.textureKey = textureKey;
      }
      if (Math.abs(state.velocity.x) > 8) koi.facing = state.velocity.x >= 0 ? 1 : -1;
      const bob = this.reducedMotion ? 0 : Math.sin(simTimeMs / style.bobPeriodMs * Math.PI * 2 + index) * style.bobPx;
      const x = snap(state.position.x);
      const y = snap(state.position.y + (state.mode === "sleeping" ? bob : 0));
      koi.body.setPosition(x, y).setFlipX(koi.facing < 0);
      koi.body.setAlpha(state.mode === "returning" ? 0.7 : 1);
      const lx = x + koi.facing * (style.lureArtX - style.widthArt / 2) * FLIGHT_ART_SCALE * style.scale;
      const ly = y + (style.lureArtY - style.heightArt / 2) * FLIGHT_ART_SCALE * style.scale;
      const glow = state.mode === "returning" ? style.lureSleepAlpha : style.lureSleepAlpha + (1 - style.lureSleepAlpha) * noise;
      koi.lure.setPosition(snap(lx), snap(ly)).setAlpha(glow);
      koi.hearing.setAlpha(state.mode === "sleeping" ? style.hearingIdleAlpha + noise * style.hearingNoiseAlpha : state.mode === "returning" ? 0 : style.hearingIdleAlpha + style.hearingNoiseAlpha);
      koi.ripple.setPosition(x, y);
      koi.sleep.setVisible(state.mode === "sleeping").setPosition(snap(x - koi.facing * 52), snap(y - 2));
    });
  }

  private playRipple(koi: KoiSprite): void {
    this.scene.tweens.killTweensOf(koi.ripple);
    koi.ripple.setVisible(true).setAlpha(0.7);
    if (this.reducedMotion) return;
    this.scene.tweens.add({ targets: koi.ripple, alpha: 0, duration: koi.definition.alertMs, ease: "Sine.easeOut", onComplete: () => koi.ripple.setVisible(false) });
  }

  destroy(): void {
    for (const koi of this.koi) {
      this.scene.tweens.killTweensOf(koi.ripple);
      koi.body.destroy();
      koi.lure.destroy();
      koi.hearing.destroy();
      koi.ripple.destroy();
      koi.sleep.destroy();
    }
  }
}

function lanternTexture(scene: Phaser.Scene): string {
  const s = challengeCueStyle.fog;
  return paintTexture(scene, "flight-paper-lantern-buoy", 22, 32, (c) => {
    const px = pixelRect(c);
    // Loop and short hanging string.
    px(9, 0, 4, 1, s.outline); px(8, 1, 1, 3, s.outline); px(13, 1, 1, 3, s.outline);
    px(9, 3, 4, 1, s.outline); px(10, 4, 2, 3, s.outline); px(10, 4, 1, 2, s.paperLight);
    // A little tiled roof, brighter on its upper-left slope.
    px(8, 6, 6, 1, s.outline); px(6, 7, 10, 1, s.outline); px(4, 8, 14, 1, s.outline);
    px(3, 9, 16, 2, s.outline); px(7, 7, 8, 1, s.roofLight); px(5, 8, 12, 1, s.roof);
    px(4, 9, 14, 1, s.roofShade); px(5, 9, 5, 1, s.roofLight);
    // Stepped paper shade: no bright rectangle without an ink contour.
    px(6, 11, 10, 1, s.outline); px(5, 12, 12, 9, s.outline); px(6, 21, 10, 1, s.outline);
    px(6, 12, 10, 8, s.paper); px(7, 11, 8, 1, s.paper); px(7, 20, 8, 1, s.paperShade);
    px(6, 13, 2, 6, s.paperLight); px(8, 12, 4, 2, s.paperLight); px(14, 13, 2, 7, s.paperShade);
    px(9, 15, 1, 4, s.paperShade); px(12, 14, 1, 5, s.paperShade); px(10, 15, 2, 3, s.paperLight);
    // Tassel, stem and a little floating tea-green pontoon.
    px(9, 22, 4, 1, s.outline); px(10, 23, 2, 3, s.outline); px(10, 23, 1, 2, s.roofLight);
    px(5, 26, 12, 1, s.outline); px(3, 27, 16, 1, s.outline); px(2, 28, 18, 2, s.outline);
    px(4, 30, 14, 1, s.outline); px(6, 31, 10, 1, s.outline);
    px(4, 27, 14, 1, s.buoyLight); px(3, 28, 16, 1, s.buoy); px(5, 29, 12, 1, s.buoyShade);
    px(6, 30, 9, 1, s.buoyShade); px(5, 28, 4, 1, s.buoyLight);
  });
}

/**
 * Dense fog: one screen-space vignette (fog everywhere but a soft circle around the ship) whose strength fades
 * in with depth into the fog area, plus warm lantern buoys that glow through it.
 */
export class DenseFog {
  private readonly veil: Phaser.GameObjects.Image;
  private readonly lanterns: Phaser.GameObjects.GameObject[] = [];
  private readonly buoys: { readonly lamp: Phaser.GameObjects.Image; readonly halo: Phaser.GameObjects.Image; readonly homeY: number }[] = [];
  private readonly area: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };

  constructor(private readonly scene: Phaser.Scene, private readonly visibility: Extract<VisibilityDefinition, { kind: "fog" }>, theme: CampaignThemeDefinition, private readonly reducedMotion: boolean) {
    const dense = visibility.dense;
    const style = challengeCueStyle.fog;
    this.area = visibility.area.kind === "rect"
      ? visibility.area
      : { x: visibility.area.center.x - visibility.area.radius, y: visibility.area.center.y - visibility.area.radius, width: visibility.area.radius * 2, height: visibility.area.radius * 2 };
    const { width, height } = scene.scale;
    // Texture at half resolution (2x2 screen px per texel), twice the view in each direction.
    const tw = Math.ceil(width);
    const th = Math.ceil(height);
    const hole = (dense?.shipRadius ?? 300) / 2;
    const soft = style.edgeSoftPx / 2;
    const key = paintTexture(scene, `flight-dense-fog-${tw}x${th}-${hole}`, tw, th, (c) => {
      const gradient = c.createRadialGradient(tw / 2, th / 2, Math.max(1, hole - soft), tw / 2, th / 2, hole + soft);
      gradient.addColorStop(0, "rgba(0,0,0,0)");
      gradient.addColorStop(1, style.color);
      c.fillStyle = gradient;
      c.fillRect(0, 0, tw, th);
    });
    this.veil = scene.add.image(0, 0, key).setScrollFactor(0).setScale(2).setDepth(DENSE_FOG_DEPTH).setAlpha(0);
    const haloRadius = Math.round((dense?.lanternRadius ?? 200) / FLIGHT_ART_SCALE / 3);
    const lampKey = ensurePixelHalo(scene, { key: `flight-fog-lantern-halo-${theme.id}-${haloRadius}`, radius: haloRadius, steps: [4, 10, 18, 28], color: style.paperLight, alphaPerStep: style.lanternHaloAlpha });
    const bodyKey = lanternTexture(scene);
    for (const point of dense?.lanterns ?? []) {
      const halo = scene.add.image(snap(point.x), snap(point.y), lampKey).setScale(FLIGHT_ART_SCALE).setDepth(ABOVE_FOG_DEPTH - 0.2).setBlendMode(Phaser.BlendModes.ADD);
      const lamp = scene.add.image(snap(point.x), snap(point.y), bodyKey).setScale(FLIGHT_ART_SCALE).setDepth(ABOVE_FOG_DEPTH);
      this.lanterns.push(halo, lamp);
      this.buoys.push({ lamp, halo, homeY: point.y });
    }
  }

  /** `ship` in world px. */
  update(ship: Point): void {
    const dense = this.visibility.dense;
    if (!dense) return;
    const camera = this.scene.cameras.main;
    const inside = Math.min(ship.x - this.area.x, this.area.x + this.area.width - ship.x, ship.y - this.area.y, this.area.y + this.area.height - ship.y);
    const strength = Phaser.Math.Clamp(inside / challengeCueStyle.fog.fadeInPx, 0, 1);
    this.veil.setPosition(snap(ship.x - camera.scrollX), snap(ship.y - camera.scrollY)).setAlpha(dense.alpha * strength);
    const style = challengeCueStyle.fog;
    for (let index = 0; index < this.buoys.length; index += 1) {
      const buoy = this.buoys[index];
      if (!buoy) continue;
      const bob = this.reducedMotion ? 0 : Math.sin(this.scene.time.now / style.bobPeriodMs * Math.PI * 2 + index) * style.bobPx;
      const y = snap(buoy.homeY + bob);
      buoy.lamp.setY(y);
      buoy.halo.setY(y);
    }
  }

  destroy(): void {
    this.veil.destroy();
    for (const object of this.lanterns) object.destroy();
  }
}

function toasterTexture(scene: Phaser.Scene): string {
  const s = challengeCueStyle.warp;
  return paintTexture(scene, "flight-white-hole-toaster", 52, 36, (c) => {
    const px = pixelRect(c);
    // Rounded shoulders, with a sloped chrome lid and a warm enamel plinth.
    px(9, 5, 29, 1, s.outline); px(6, 6, 35, 1, s.outline); px(4, 7, 39, 2, s.outline);
    px(3, 9, 41, 21, s.outline); px(4, 30, 39, 2, s.outline); px(6, 32, 35, 1, s.outline);
    px(9, 6, 28, 1, s.toasterLight); px(6, 7, 34, 2, s.toasterLight);
    px(5, 9, 36, 4, s.toaster); px(4, 13, 38, 16, s.toaster);
    px(4, 13, 3, 11, s.toasterLight); px(7, 13, 27, 2, s.toasterLight);
    px(37, 10, 5, 19, s.toasterShade); px(34, 16, 3, 13, s.toasterShade);
    px(5, 28, 37, 3, s.trim); px(6, 28, 31, 1, s.trimLight); px(8, 31, 30, 1, s.slot);
    // Two luminous slots in the lid, inset with dark rims.
    px(9, 8, 11, 4, s.outline); px(24, 8, 11, 4, s.outline);
    px(10, 9, 9, 2, s.mouthColor); px(25, 9, 9, 2, s.mouthColor);
    px(11, 9, 7, 1, s.rimLight); px(26, 9, 7, 1, s.rimLight);
    // A quiet reflection, crumb drawer, dial and chunky lever.
    px(9, 17, 2, 5, s.toasterLight); px(11, 16, 1, 2, s.toasterLight); px(10, 23, 1, 1, s.toasterLight);
    px(14, 25, 14, 1, s.toasterShade); px(19, 24, 5, 1, s.toasterLight);
    px(29, 20, 4, 4, s.outline); px(30, 20, 2, 1, s.toasterLight); px(30, 21, 2, 2, s.trimLight);
    px(42, 14, 2, 12, s.outline); px(43, 15, 1, 10, s.toasterLight);
    px(44, 17, 6, 1, s.outline); px(44, 18, 7, 4, s.outline); px(45, 18, 5, 1, s.trimLight);
    px(45, 19, 5, 2, s.trim); px(7, 33, 6, 2, s.outline); px(32, 33, 6, 2, s.outline);
  });
}

/** The circular door follows the actual warp boundary; its centre leaves the existing bakery spiral visible. */
function ovenTextures(scene: Phaser.Scene, radius: number): { readonly rim: string; readonly heat: string } {
  const s = challengeCueStyle.warp;
  const half = radius + s.rimWidthArt + 15;
  const size = half * 2;
  const rim = paintTexture(scene, `flight-oven-door-${radius}`, size, size, (c) => {
    const px = pixelRect(c);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const dx = x + 0.5 - half;
        const dy = y + 0.5 - half;
        const distance = Math.hypot(dx, dy);
        const band = distance - radius;
        if (band < -1 || band > s.rimWidthArt) continue;
        let color: string = s.mouthColor;
        if (band < 0 || band > s.rimWidthArt - 1) color = s.outline;
        else if (band > s.rimWidthArt - 3) color = dx + dy < 0 ? s.rimLight : s.rimMetal;
        else if (band < 2) color = dx + dy < 0 ? s.rimLight : s.rimShade;
        px(x, y, 1, 1, color);
      }
    }
    // Four small mounts / rivets make this a physical oven door, not a navigation ring.
    for (const angle of [Math.PI / 4, Math.PI * 3 / 4, Math.PI * 5 / 4, Math.PI * 7 / 4]) {
      const x = Math.round(half + Math.cos(angle) * (radius + 4));
      const y = Math.round(half + Math.sin(angle) * (radius + 4));
      px(x - 3, y - 3, 7, 7, s.outline); px(x - 2, y - 2, 5, 5, s.rimShade);
      px(x - 2, y - 2, 4, 1, s.rimLight); px(x - 1, y - 1, 2, 2, s.rimMetal);
    }
    // A bar handle above the rim and a little bottom hinge.
    const top = half - radius - 6;
    px(half - 18, top, 36, 5, s.outline); px(half - 17, top + 1, 34, 1, s.rimLight);
    px(half - 17, top + 2, 34, 2, s.rimShade);
    px(half - 18, top + 5, 3, 4, s.outline); px(half + 15, top + 5, 3, 4, s.outline);
    px(half - 13, half + radius + 3, 26, 5, s.outline); px(half - 12, half + radius + 4, 24, 2, s.rimShade);
    px(half - 10, half + radius + 4, 20, 1, s.mouthColor);
    // Short inward ticks mark the hot threshold without teeth or a frightening face.
    for (const side of [-1, 1]) {
      const x = half + side * radius;
      px(x - 2, half - 6, 5, 12, s.outline); px(x - 1, half - 5, 3, 10, s.rimShade);
      px(x - 1, half - 4, 2, 3, s.mouthColor); px(x - 1, half + 2, 2, 3, s.rimLight);
    }
  });
  const heat = paintTexture(scene, `flight-oven-heat-${radius}`, size, size, (c) => {
    const px = pixelRect(c);
    for (const [dx, dy] of [[-38, -radius - 12], [24, -radius - 11], [-radius - 12, -19], [radius + 10, -27], [-radius - 9, 26], [radius + 10, 22]] as const) {
      px(half + dx, half + dy, 5, 1, s.rimShade);
      px(half + dx + 1, half + dy - 2, 4, 1, s.mouthColor);
      px(half + dx + 2, half + dy - 4, 3, 1, s.rimLight);
    }
  });
  return { rim, heat };
}

/** Oven mouth (steady outlined door, pulsing warmth) and the white-hole toaster at its exit. */
export function drawWarpCues(scene: Phaser.Scene, zones: readonly ForceZoneDefinition[], theme: CampaignThemeDefinition, reducedMotion: boolean): Phaser.GameObjects.GameObject[] {
  const objects: Phaser.GameObjects.GameObject[] = [];
  const style = challengeCueStyle.warp;
  for (const zone of zones) {
    if (zone.kind !== "radial-gravity" || zone.warp === null) continue;
    const radiusArt = Math.round(zone.warp.radius / FLIGHT_ART_SCALE);
    const textures = ovenTextures(scene, radiusArt);
    const mouth = scene.add.image(snap(zone.center.x), snap(zone.center.y), textures.rim).setScale(FLIGHT_ART_SCALE).setDepth(depth.world - 0.35);
    const warmth = scene.add.image(mouth.x, mouth.y, ensurePixelHalo(scene, { key: `flight-oven-halo-${radiusArt}`, radius: radiusArt, steps: [3, 7, 11], color: style.mouthColor, alphaPerStep: 0.025 }))
      .setScale(FLIGHT_ART_SCALE).setDepth(depth.world - 0.36).setBlendMode(Phaser.BlendModes.ADD);
    const heat = scene.add.image(mouth.x, mouth.y, textures.heat).setScale(FLIGHT_ART_SCALE).setDepth(depth.world - 0.34);
    objects.push(mouth, warmth, heat);
    if (!reducedMotion) scene.tweens.add({ targets: [warmth, heat], alpha: style.pulseMinAlpha, duration: style.pulseMs, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    // Toaster: a little warm box with two glowing slots, where the oven sends you back out.
    const { x, y } = zone.warp.exit;
    const toasterY = snap(y + style.toasterDropPx);
    const halo = scene.add.image(snap(x), toasterY - 16, ensurePixelHalo(scene, { key: `flight-toaster-halo-${theme.id}`, radius: 14, steps: [4, 10, 18], color: style.mouthColor, alphaPerStep: 0.06 }))
      .setScale(FLIGHT_ART_SCALE).setDepth(depth.world - 0.36).setBlendMode(Phaser.BlendModes.ADD);
    const toaster = scene.add.image(snap(x), toasterY, toasterTexture(scene)).setScale(style.toasterScale).setDepth(depth.world - 0.34);
    objects.push(halo, toaster);
  }
  return objects;
}
