import Phaser from "phaser";
import { ASSET, SHIP_ROTATION } from "../../data/assetManifest";
import { FLIGHT_ART_SCALE, arrivalBeaconStyle, dockingStateColors, flightHudCopy } from "../../data/flightScenery";
import { colorNumber, colors, depth } from "../../game/designTokens";
import { directionVector } from "../../systems/ShipMovementSystem";
import type { DockingState, DockingStateKind, FlightDestinationDefinition } from "../../types/flight";
import { StatePill, type UiState } from "../../ui";
import { rotationCellIndex, type ShipArtLayout } from "../GyozaShip";
import type { HudScreenRect } from "./FlightDashboard";
import {
  ensureOutlineTexture,
  ensurePixelChevrons,
  ensurePixelPlate,
  ensurePixelRing,
  ringPixelsClockwise,
  type ArcPixel,
} from "./pixelArt";

const TAU = Math.PI * 2;
const ART = FLIGHT_ART_SCALE;
const KEY_PREFIX = "flight-beacon";

/** Gentle pill state per docking kind (StatePill swatches from the UI kit). */
const PILL_STATE: Readonly<Record<DockingStateKind, UiState>> = {
  "too-far": "idle",
  approaching: "docking",
  "slow-down": "docking",
  align: "delivering",
  ready: "flying",
};

/**
 * Cozy landing beacon drawn around the delivery ring, entirely on the 2x pixel grid: a dashed ring
 * with chase-lit pixel lanterns, a chevron badge (inside the ring) pointing where the ship's BOTTOM
 * must face, a cream outline ghost of the target pose, a stepped progress arc while the landing
 * window holds, and a label pill below the ring so nothing overlaps the dashes. When the label
 * would land on a HUD control (touch pads, hint strip) or off screen, it moves above the ring.
 */
export class ArrivalBeacon {
  private readonly ring: Phaser.GameObjects.Image;
  private readonly ringShadow: Phaser.GameObjects.Image;
  private readonly progressTrack: Phaser.GameObjects.Image;
  private readonly progressShadow: Phaser.GameObjects.Image;
  private readonly progress: Phaser.GameObjects.Graphics;
  private readonly lanterns: Phaser.GameObjects.Graphics;
  private readonly plate: Phaser.GameObjects.Image;
  private readonly chevrons: Phaser.GameObjects.Image;
  private readonly ghost: Phaser.GameObjects.Image;
  private label: StatePill;
  private uiScale = 1;
  private readonly ringKeys: { readonly idle: string; readonly ready: string; readonly idleShadow: string; readonly readyShadow: string };
  private readonly progressPixels: readonly ArcPixel[];
  private readonly bottomAngle: number;
  private readonly badgeX: number;
  private readonly badgeY: number;
  private readonly labelBelowY: number;
  private readonly labelAboveBaseY: number;
  private labelAbove = false;
  private avoidRects: readonly HudScreenRect[] = [];
  private lastKind: DockingStateKind | undefined;
  private lastProgressCount = -1;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly destination: FlightDestinationDefinition,
    shipLayout: ShipArtLayout,
    private readonly beaconLabel: string = flightHudCopy.beaconLabel,
  ) {
    const style = arrivalBeaconStyle;
    const bottom = directionVector(destination.requiredBottomFacingRadians);
    this.bottomAngle = Math.atan2(bottom.y, bottom.x);
    const { x, y } = destination;
    const radiusArt = Math.round(destination.radius / ART);
    const progressRadiusArt = radiusArt + style.progressGap;

    // Faint dotted approach circle.
    const approachKey = ensurePixelRing(scene, {
      key: `${KEY_PREFIX}-approach`,
      radius: Math.round(destination.approachRadius / ART),
      thickness: 1,
      dashCount: style.approachDashCount,
      dashFill: style.approachDashFill,
      color: colors.duskBlue,
      alpha: style.approachAlpha,
    });
    scene.add.image(x, y, approachKey).setScale(ART).setDepth(depth.world - 1);

    const ringTexture = (suffix: string, fill: number, thickness: number, color: string): string =>
      ensurePixelRing(scene, {
        key: `${KEY_PREFIX}-${suffix}`,
        radius: radiusArt,
        thickness,
        dashCount: style.dashCount,
        dashFill: fill,
        phase: -Math.PI / style.dashCount,
        color,
      });
    this.ringKeys = {
      idle: ringTexture("ring", style.dashFill, style.ringThickness, colors.plaster),
      ready: ringTexture("ring-ready", style.dashFillReady, style.ringThickness, colors.plaster),
      idleShadow: ringTexture("ring-shadow", style.dashFill, style.ringShadowThickness, colors.cosmosDeep),
      readyShadow: ringTexture("ring-ready-shadow", style.dashFillReady, style.ringShadowThickness, colors.cosmosDeep),
    };
    this.ringShadow = scene.add.image(x, y, this.ringKeys.idleShadow).setScale(ART).setDepth(depth.world + 0.9);
    this.ring = scene.add.image(x, y, this.ringKeys.idle).setScale(ART).setDepth(depth.world + 1);

    const trackKey = ensurePixelRing(scene, {
      key: `${KEY_PREFIX}-progress-track`,
      radius: progressRadiusArt,
      thickness: style.progressThickness,
      dashCount: 1,
      dashFill: 1,
      color: colors.plaster,
    });
    const trackShadowKey = ensurePixelRing(scene, {
      key: `${KEY_PREFIX}-progress-shadow`,
      radius: progressRadiusArt,
      thickness: style.progressThickness + 2,
      dashCount: 1,
      dashFill: 1,
      color: colors.cosmosDeep,
    });
    this.progressShadow = scene.add.image(x, y, trackShadowKey).setScale(ART).setAlpha(style.ringShadowAlpha).setDepth(depth.world + 0.9).setVisible(false);
    this.progressTrack = scene.add.image(x, y, trackKey).setScale(ART).setAlpha(0.22).setDepth(depth.world + 1).setVisible(false);
    this.progressPixels = ringPixelsClockwise(progressRadiusArt, style.progressThickness);
    this.progress = scene.add.graphics().setDepth(depth.world + 1.1);
    this.lanterns = scene.add.graphics().setDepth(depth.world + 1.2);

    // Ghost of the target pose, traced from the ship's own pre-rotated idle cell (never a runtime
    // rotation): cream 1-art-px outline + checker fill, bottom toward the moon. It sits a little
    // back from the centre so the chevron badge fits between it and the moon limb.
    const ghostRotation = destination.requiredBottomFacingRadians - Math.PI;
    const rotated = scene.textures.exists(ASSET.shipIdleRot);
    const cell = rotationCellIndex(ghostRotation, SHIP_ROTATION.angles);
    const ghostKey = ensureOutlineTexture(scene, {
      key: rotated ? `${KEY_PREFIX}-ghost-rot-${cell}` : `${KEY_PREFIX}-ghost-${shipLayout.contract ? "contract" : "legacy"}`,
      sourceKey: rotated ? ASSET.shipIdleRot : ASSET.shipIdle,
      ...(rotated ? { frame: cell } : {}),
      color: style.ghostColor,
      fillAlpha: style.ghostFillAlpha,
      detailAlpha: style.ghostDetailAlpha,
    });
    const ghostX = x - Math.round(bottom.x * style.ghostBackArt) * ART;
    const ghostY = y - Math.round(bottom.y * style.ghostBackArt) * ART;
    this.ghost = scene.add.image(ghostX, ghostY, ghostKey).setScale(shipLayout.scale).setDepth(depth.world + 0.5);
    if (rotated) this.ghost.setOrigin(0.5, 0.5);
    else this.ghost.setOrigin(shipLayout.originX, shipLayout.originY).setRotation(ghostRotation);

    // Chevron badge between the ghost and the moon limb (clear of the moon art).
    this.badgeX = x + Math.round(bottom.x * style.badgeDistance) * ART;
    this.badgeY = y + Math.round(bottom.y * style.badgeDistance) * ART;
    const plateKey = ensurePixelPlate(scene, {
      key: `${KEY_PREFIX}-plate`,
      radius: style.plateRadius,
      fill: colors.cosmosPanel,
      fillAlpha: style.plateAlpha,
      rim: colors.plaster,
      rimAlpha: style.plateRimAlpha,
    });
    this.plate = scene.add.image(this.badgeX, this.badgeY, plateKey).setScale(ART).setDepth(depth.world + 1.3);
    const chevronKey = ensurePixelChevrons(scene, {
      key: `${KEY_PREFIX}-chevrons-${this.bottomAngle.toFixed(3)}`,
      angle: this.bottomAngle,
      length: style.chevronLength,
      halfWidth: style.chevronHalfWidth,
      thickness: style.chevronThickness,
      count: 2,
      spacing: style.chevronSpacing,
      color: colors.plaster,
      outline: colors.cosmosDeep,
      alphas: [1, 0.55],
    });
    this.chevrons = scene.add.image(this.badgeX, this.badgeY, chevronKey).setScale(ART).setDepth(depth.world + 1.4);

    // Label pill below the ring (never on the dashes or the bright moon); the above slot mirrors it.
    const ringOuter = destination.radius + style.ringShadowThickness * ART + style.labelGap;
    this.labelBelowY = y + ringOuter;
    this.labelAboveBaseY = y - ringOuter;
    this.label = this.createLabel("idle", this.beaconLabel);
    this.centreLabel();
  }

  /** Screen rects (HUD space) the label must avoid, e.g. touch pads; see FlightDashboard.labelAvoidRects. */
  setAvoidRects(rects: readonly HudScreenRect[]): void {
    this.avoidRects = rects;
  }

  /** Compact (phone) displays get a larger label pill so it stays legible after FIT scaling. */
  setUiScale(scale: number): void {
    if (scale === this.uiScale) return;
    this.uiScale = scale;
    const kind = this.lastKind ?? "too-far";
    this.label.destroy();
    this.label = this.createLabel(PILL_STATE[kind], kind === "ready" ? flightHudCopy.ready : this.beaconLabel);
    this.centreLabel();
  }

  update(docking: DockingState, progress: number, timeMs: number): void {
    const style = arrivalBeaconStyle;
    const ready = docking.kind === "ready";
    const active = docking.kind !== "too-far";
    const baseAlpha = active ? style.activeAlpha : style.idleAlpha;

    if (this.lastKind !== docking.kind) {
      this.lastKind = docking.kind;
      const color = colorNumber(dockingStateColors[docking.kind]);
      this.ring.setTexture(ready ? this.ringKeys.ready : this.ringKeys.idle).setTint(color);
      this.ringShadow.setTexture(ready ? this.ringKeys.readyShadow : this.ringKeys.idleShadow);
      this.chevrons.setTint(color);
      this.progressTrack.setTint(color).setVisible(ready);
      this.progressShadow.setVisible(ready);
      this.label.setPillState(PILL_STATE[docking.kind], ready ? flightHudCopy.ready : this.beaconLabel);
      this.centreLabel();
      this.lastProgressCount = -1;
    }

    this.ring.setAlpha(baseAlpha);
    this.ringShadow.setAlpha(style.ringShadowAlpha * baseAlpha);
    this.label.setAlpha(active ? 1 : 0.8);

    const pulse = 0.5 + 0.5 * Math.sin((timeMs / style.ghostPulseMs) * TAU);
    this.ghost.setVisible(!ready).setAlpha(style.ghostAlphaMin + (style.ghostAlphaMax - style.ghostAlphaMin) * pulse);

    const bob = ready ? 0 : Math.round(Math.sin((timeMs / style.chevronBobMs) * TAU) * style.chevronBobArtPx);
    const dir = { x: Math.cos(this.bottomAngle), y: Math.sin(this.bottomAngle) };
    this.chevrons.setPosition(this.badgeX + Math.round(dir.x * bob) * ART, this.badgeY + Math.round(dir.y * bob) * ART);

    this.drawProgress(ready ? progress : 0);
    this.drawLanterns(colorNumber(dockingStateColors[docking.kind]), ready, active, timeMs);
    this.placeLabel();
  }

  private createLabel(state: UiState, text: string): StatePill {
    const pill = new StatePill(this.scene, { x: this.destination.x, y: this.labelBelowY, state, label: text, uiScale: this.uiScale });
    return pill.setDepth(depth.world + 2);
  }

  private labelWorldY(above: boolean): number {
    return Math.round(above ? this.labelAboveBaseY - this.label.pillHeight : this.labelBelowY);
  }

  private centreLabel(): void {
    this.label.setPosition(Math.round(this.destination.x - this.label.pillWidth / 2), this.labelWorldY(this.labelAbove));
  }

  /**
   * Keeps the label below the ring unless that slot (in screen space, padded) hits an avoid rect or
   * leaves the screen; then it sits above. Coming back needs twice the clearance, so it never flickers.
   */
  private placeLabel(): void {
    const clearance = arrivalBeaconStyle.labelClearancePx;
    const camera = this.scene.cameras.main;
    const width = this.label.pillWidth;
    const height = this.label.pillHeight;
    const left = Math.round(this.destination.x - width / 2) - camera.scrollX;
    const top = this.labelWorldY(false) - camera.scrollY;
    const blocked = (padding: number): boolean =>
      top + height + padding > this.scene.scale.height ||
      this.avoidRects.some(
        (rect) =>
          left - padding < rect.x + rect.width &&
          left + width + padding > rect.x &&
          top - padding < rect.y + rect.height &&
          top + height + padding > rect.y,
      );
    const above = blocked(this.labelAbove ? clearance * 2 : clearance);
    if (above === this.labelAbove) return;
    this.labelAbove = above;
    this.centreLabel();
  }

  /** Stepped arc: the first `progress` share of the ring's art pixels, clockwise from the top. */
  private drawProgress(progress: number): void {
    const count = Math.round(Math.min(1, Math.max(0, progress)) * this.progressPixels.length);
    if (count === this.lastProgressCount) return;
    this.lastProgressCount = count;
    const g = this.progress;
    g.clear();
    if (count === 0) return;
    const { x, y } = this.destination;
    g.fillStyle(colorNumber(colors.parchmentWarm), 1);
    for (let index = 0; index < count; index += 1) {
      const pixel = this.progressPixels[index];
      if (pixel) g.fillRect(x + pixel.x * ART, y + pixel.y * ART, ART, ART);
    }
    const head = this.progressPixels[count - 1];
    if (head) {
      g.fillStyle(colorNumber(colors.plaster), 1);
      g.fillRect(x + (head.x - 1) * ART, y + (head.y - 1) * ART, ART * 3, ART * 3);
    }
  }

  /** Small pixel lanterns on the ring, lit in a slow chase (fully lit when ready). */
  private drawLanterns(color: number, ready: boolean, active: boolean, timeMs: number): void {
    const style = arrivalBeaconStyle;
    const { x, y, radius } = this.destination;
    const g = this.lanterns;
    const step = TAU / style.lanternCount;
    const chase = (timeMs % style.lanternChaseMs) / style.lanternChaseMs;
    const radiusArt = Math.round(radius / ART);
    g.clear();

    for (let i = 0; i < style.lanternCount; i += 1) {
      // Offset by half a step so no lantern sits beside the chevron badge.
      const angle = this.bottomAngle + step * (i + 0.5);
      const lx = x + Math.round(Math.cos(angle) * radiusArt) * ART;
      const ly = y + Math.round(Math.sin(angle) * radiusArt) * ART;
      const chaseDistance = (((i / style.lanternCount - chase) % 1) + 1) % 1;
      const glow = ready ? 1 : active ? 0.35 + 0.65 * (1 - chaseDistance) ** 3 : 0.3;

      // Soft plus-shaped glow, dark rounded backing, amber core, cream highlight.
      g.fillStyle(color, 0.3 * glow);
      g.fillRect(lx - 4 * ART, ly - 1 * ART, 8 * ART, 2 * ART);
      g.fillRect(lx - 1 * ART, ly - 4 * ART, 2 * ART, 8 * ART);
      g.fillStyle(colorNumber(colors.cosmosDeep), 0.8);
      g.fillRect(lx - 2 * ART, ly - 1 * ART, 4 * ART, 2 * ART);
      g.fillRect(lx - 1 * ART, ly - 2 * ART, 2 * ART, 4 * ART);
      g.fillStyle(colorNumber(colors.amber), 0.55 + 0.45 * glow);
      g.fillRect(lx - 1 * ART, ly - 1 * ART, 2 * ART, 2 * ART);
      g.fillStyle(colorNumber(colors.plaster), 0.25 + 0.6 * glow);
      g.fillRect(lx - 1 * ART, ly - 1 * ART, ART, ART);
    }
  }
}
