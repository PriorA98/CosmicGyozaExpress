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
  context.clearRect(0, 0, width, height);
  draw(context);
  texture.refresh();
  return key;
}

/** Koi body, facing right, 36x22 art px: cream body, orange patches, fan tail, lure stalk; frame 0 eye shut, 1 open. */
function koiTexture(scene: Phaser.Scene, open: boolean): string {
  const style = challengeCueStyle.koi;
  return paintTexture(scene, `flight-tea-koi-${open ? "open" : "shut"}`, 36, 22, (c) => {
    const px = (x: number, y: number, w: number, h: number, color: string): void => {
      c.fillStyle = color;
      c.fillRect(x, y, w, h);
    };
    // Outline + body (an ellipse drawn as rows).
    for (let y = 0; y < 12; y += 1) {
      const half = Math.round(Math.sqrt(Math.max(0, 1 - ((y - 5.5) / 6) ** 2)) * 12);
      px(17 - half, 7 + y, half * 2, 1, style.outline);
      if (half > 1) px(18 - half, 7 + y, half * 2 - 2, 1, style.body);
    }
    // Patches.
    px(12, 9, 6, 3, style.patch); px(20, 13, 5, 3, style.patch); px(9, 14, 3, 2, style.patch);
    // Tail fan.
    for (let t = 0; t < 7; t += 1) { px(4 - Math.floor(t / 2), 9 + t, 2 + Math.floor(t / 3), 1, style.outline); px(5 - Math.floor(t / 2), 9 + t, 1, 1, style.patch); }
    // Fin.
    px(15, 18, 4, 2, style.outline);
    // Lure stalk curling forward over the head, bulb at the tip.
    px(24, 4, 1, 4, style.outline); px(25, 2, 3, 1, style.outline); px(28, 3, 1, 2, style.outline);
    px(28, 4, 3, 3, style.lure);
    // Eye.
    if (open) { px(25, 10, 3, 3, style.outline); px(26, 10, 1, 1, style.body); }
    else px(25, 11, 3, 1, style.outline);
    // Mouth.
    px(29, 13, 2, 1, style.outline);
  });
}

type KoiSprite = {
  readonly definition: SeekerDefinition;
  readonly body: Phaser.GameObjects.Image;
  readonly lure: Phaser.GameObjects.Image;
  readonly hearing: Phaser.GameObjects.Graphics;
  readonly ripple: Phaser.GameObjects.Graphics;
  mode: SeekerState["mode"];
  facing: 1 | -1;
};

export class TeaKoiSchool {
  private readonly koi: KoiSprite[] = [];

  constructor(private readonly scene: Phaser.Scene, definitions: readonly SeekerDefinition[], theme: CampaignThemeDefinition, private readonly reducedMotion: boolean) {
    const style = challengeCueStyle.koi;
    const shut = koiTexture(scene, false);
    koiTexture(scene, true);
    const lureKey = ensurePixelHalo(scene, { key: "flight-koi-lure", radius: 3, steps: [1, 4, 8, 13], color: style.lure, alphaPerStep: 0.22 });
    for (const definition of definitions) {
      const hearing = scene.add.graphics().setDepth(ABOVE_FOG_DEPTH - 0.1);
      hearing.fillStyle(colorNumber(theme.palette.light), 1);
      const steps = Math.round((Math.PI * 2 * definition.hearingRadius) / 26);
      for (let i = 0; i < steps; i += 1) {
        const angle = (i / steps) * Math.PI * 2;
        hearing.fillRect(snap(definition.home.x + Math.cos(angle) * definition.hearingRadius) - 2, snap(definition.home.y + Math.sin(angle) * definition.hearingRadius) - 2, 4, 4);
      }
      hearing.setAlpha(style.hearingIdleAlpha);
      const body = scene.add.image(snap(definition.home.x), snap(definition.home.y), shut).setScale(FLIGHT_ART_SCALE * style.scale).setDepth(ABOVE_FOG_DEPTH);
      const lure = scene.add.image(body.x, body.y, lureKey).setScale(FLIGHT_ART_SCALE).setDepth(ABOVE_FOG_DEPTH + 0.01).setBlendMode(Phaser.BlendModes.ADD);
      const ripple = scene.add.graphics().setDepth(ABOVE_FOG_DEPTH - 0.05).setVisible(false);
      this.koi.push({ definition, body, lure, hearing, ripple, mode: "sleeping", facing: 1 });
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
        koi.body.setTexture(state.mode === "sleeping" || state.mode === "returning" ? "flight-tea-koi-shut" : "flight-tea-koi-open");
        if (state.mode === "alert") this.playRipple(koi);
      }
      if (Math.abs(state.velocity.x) > 8) koi.facing = state.velocity.x >= 0 ? 1 : -1;
      const bob = this.reducedMotion ? 0 : Math.sin(simTimeMs / style.bobPeriodMs * Math.PI * 2 + index) * style.bobPx;
      const x = snap(state.position.x);
      const y = snap(state.position.y + (state.mode === "sleeping" ? bob : 0));
      const wiggle = state.mode === "chasing" && !this.reducedMotion ? 1 + Math.sin(simTimeMs / 90) * 0.08 : 1;
      koi.body.setPosition(x, y).setFlipX(koi.facing < 0).setScale(FLIGHT_ART_SCALE * style.scale, FLIGHT_ART_SCALE * style.scale * wiggle);
      koi.body.setAlpha(state.mode === "returning" ? 0.7 : 1);
      // Lure sits at the bulb (art px 29,5 of a 36x22 body centred at 18,11).
      const lx = x + koi.facing * (29 - 18) * FLIGHT_ART_SCALE * style.scale;
      const ly = y + (5 - 11) * FLIGHT_ART_SCALE * style.scale;
      const pulse = state.mode === "alert" && !this.reducedMotion ? 0.75 + 0.25 * Math.sin(simTimeMs / 70) : 1;
      const glow = state.mode === "sleeping" ? style.lureSleepAlpha + (1 - style.lureSleepAlpha) * noise : state.mode === "returning" ? style.lureSleepAlpha : pulse;
      koi.lure.setPosition(snap(lx), snap(ly)).setAlpha(glow).setScale(FLIGHT_ART_SCALE * (1 + (state.mode === "chasing" ? 0.35 : noise * 0.3)));
      koi.hearing.setAlpha(state.mode === "sleeping" ? style.hearingIdleAlpha + noise * style.hearingNoiseAlpha : state.mode === "returning" ? 0 : style.hearingIdleAlpha + style.hearingNoiseAlpha);
      koi.ripple.setPosition(x, y);
    });
  }

  private playRipple(koi: KoiSprite): void {
    const style = challengeCueStyle.koi;
    koi.ripple.clear().setVisible(true).setScale(0.4).setAlpha(1);
    koi.ripple.lineStyle(4, colorNumber(style.lure), 1).strokeCircle(0, 0, koi.definition.radius + 14);
    if (this.reducedMotion) return;
    this.scene.tweens.add({ targets: koi.ripple, scale: 1.8, alpha: 0, duration: koi.definition.alertMs, ease: "Sine.easeOut", onComplete: () => koi.ripple.setVisible(false) });
  }

  destroy(): void {
    for (const koi of this.koi) {
      koi.body.destroy();
      koi.lure.destroy();
      koi.hearing.destroy();
      koi.ripple.destroy();
    }
  }
}

/**
 * Dense fog: one screen-space vignette (fog everywhere but a soft circle around the ship) whose strength fades
 * in with depth into the fog area, plus warm lantern buoys that glow through it.
 */
export class DenseFog {
  private readonly veil: Phaser.GameObjects.Image;
  private readonly lanterns: Phaser.GameObjects.GameObject[] = [];
  private readonly area: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };

  constructor(private readonly scene: Phaser.Scene, private readonly visibility: Extract<VisibilityDefinition, { kind: "fog" }>, theme: CampaignThemeDefinition, reducedMotion: boolean) {
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
    const lampKey = ensurePixelHalo(scene, { key: "flight-fog-lantern-halo", radius: Math.round((dense?.lanternRadius ?? 200) / FLIGHT_ART_SCALE / 3), steps: [4, 10, 18, 28], color: theme.palette.light, alphaPerStep: style.lanternHaloAlpha });
    for (const point of dense?.lanterns ?? []) {
      const halo = scene.add.image(snap(point.x), snap(point.y), lampKey).setScale(FLIGHT_ART_SCALE).setDepth(ABOVE_FOG_DEPTH - 0.2).setBlendMode(Phaser.BlendModes.ADD);
      const lamp = scene.add.graphics().setPosition(snap(point.x), snap(point.y)).setDepth(ABOVE_FOG_DEPTH);
      lamp.fillStyle(colorNumber(theme.palette.skyTop), 1).fillRect(-8, -14, 16, 26);
      lamp.fillStyle(colorNumber(theme.palette.light), 1).fillRect(-6, -10, 12, 16);
      lamp.fillStyle(colorNumber(theme.palette.accent), 1).fillRect(-10, 12, 20, 4).fillRect(-2, -20, 4, 6);
      this.lanterns.push(halo, lamp);
      if (!reducedMotion) scene.tweens.add({ targets: halo, alpha: 0.7, duration: 1800, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
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
  }

  destroy(): void {
    this.veil.destroy();
    for (const object of this.lanterns) object.destroy();
  }
}

/** Oven mouth (pulsing ring at the warp radius) and the white-hole toaster at its exit. */
export function drawWarpCues(scene: Phaser.Scene, zones: readonly ForceZoneDefinition[], theme: CampaignThemeDefinition, reducedMotion: boolean): Phaser.GameObjects.GameObject[] {
  const objects: Phaser.GameObjects.GameObject[] = [];
  const style = challengeCueStyle.warp;
  for (const zone of zones) {
    if (zone.kind !== "radial-gravity" || zone.warp === null) continue;
    const mouth = scene.add.graphics().setPosition(snap(zone.center.x), snap(zone.center.y)).setDepth(depth.world - 0.35);
    mouth.fillStyle(colorNumber(style.mouthColor), 1);
    const steps = Math.round((Math.PI * 2 * zone.warp.radius) / 18);
    for (let i = 0; i < steps; i += 1) {
      const angle = (i / steps) * Math.PI * 2;
      mouth.fillRect(snap(Math.cos(angle) * zone.warp.radius) - 3, snap(Math.sin(angle) * zone.warp.radius) - 3, 6, 6);
    }
    objects.push(mouth);
    if (!reducedMotion) scene.tweens.add({ targets: mouth, alpha: 0.35, duration: style.pulseMs, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    // Toaster: a little warm box with two glowing slots, where the oven sends you back out.
    const { x, y } = zone.warp.exit;
    const halo = scene.add.image(snap(x), snap(y), ensurePixelHalo(scene, { key: `flight-toaster-halo-${theme.id}`, radius: 10, steps: [4, 10, 18], color: style.mouthColor, alphaPerStep: 0.08 }))
      .setScale(FLIGHT_ART_SCALE).setDepth(depth.world - 0.36);
    const toaster = scene.add.graphics().setPosition(snap(x), snap(y + 70)).setDepth(depth.world - 0.34);
    toaster.fillStyle(colorNumber(theme.palette.skyTop), 1).fillRect(-30, -22, 60, 44);
    toaster.fillStyle(colorNumber(theme.palette.light), 1).fillRect(-26, -18, 52, 36);
    toaster.fillStyle(colorNumber(theme.palette.ground), 1).fillRect(-26, 10, 52, 8);
    toaster.fillStyle(colorNumber(style.mouthColor), 1).fillRect(-18, -18, 12, 4).fillRect(6, -18, 12, 4);
    toaster.fillStyle(colorNumber(theme.palette.skyTop), 1).fillRect(28, -4, 8, 4);
    objects.push(halo, toaster);
  }
  return objects;
}
