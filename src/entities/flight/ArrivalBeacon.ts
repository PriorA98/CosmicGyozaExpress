import Phaser from "phaser";
import { ASSET } from "../../data/assetManifest";
import { arrivalBeaconStyle, dockingStateColors, flightHudCopy, shipVisualStyle } from "../../data/flightScenery";
import { colorNumber, colors, depth, fontStacks, typeScale } from "../../game/designTokens";
import type { DockingState, DockingStateKind, FlightDestinationDefinition } from "../../types/flight";
import { directionVector } from "../../systems/ShipMovementSystem";

const TAU = Math.PI * 2;
const TOP_ANGLE = -Math.PI / 2;
/** Dashed ring turns once per this many ms (slow, calm). */
const RING_TURN_MS = 48_000;
const OUTLINE_EXTRA_PX = 3;
const OUTLINE_ALPHA = 0.55;

/**
 * Cozy landing beacon drawn around the delivery ring: dashed ring with small chase-lit lanterns,
 * a chevron (plus a faint ghost ship) showing where the ship's BOTTOM must point, colour per
 * docking state, and an arc that fills while the landing window holds.
 */
export class ArrivalBeacon {
  private readonly approach: Phaser.GameObjects.Graphics;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly ghost: Phaser.GameObjects.Image;
  private readonly label: Phaser.GameObjects.Text;
  private readonly bottomAngle: number;
  private lastKind: DockingStateKind | undefined;
  /** Reused point buffers for the two chevrons (no per-frame allocation). */
  private readonly chevronBuffers: readonly Phaser.Math.Vector2[][] = [makePoints(6), makePoints(6)];

  constructor(
    scene: Phaser.Scene,
    private readonly destination: FlightDestinationDefinition,
  ) {
    const bottom = directionVector(destination.requiredBottomFacingRadians);
    this.bottomAngle = Math.atan2(bottom.y, bottom.x);

    this.approach = scene.add.graphics().setDepth(depth.world - 1);
    this.drawApproachRing();

    this.graphics = scene.add.graphics().setDepth(depth.world + 1);

    this.ghost = scene.add
      .image(destination.x, destination.y, ASSET.shipIdle)
      .setScale(shipVisualStyle.flightScale)
      .setRotation(destination.requiredBottomFacingRadians - Math.PI)
      .setAlpha(arrivalBeaconStyle.ghostShipAlpha)
      .setTintMode(Phaser.TintModes.FILL)
      .setDepth(depth.world + 0.5);

    const plateRadius = destination.radius - arrivalBeaconStyle.chevronInset - arrivalBeaconStyle.chevronLength * 0.55;
    this.label = scene.add
      .text(
        destination.x + bottom.x * plateRadius,
        destination.y + bottom.y * plateRadius + arrivalBeaconStyle.labelOffset,
        flightHudCopy.beaconLabel,
        {
        fontFamily: fontStacks.mono,
        fontSize: `${typeScale.xs}px`,
        color: colors.plaster,
        stroke: colors.cosmosDeep,
        strokeThickness: 3,
        },
      )
      .setOrigin(0.5)
      .setDepth(depth.world + 2);
  }

  update(docking: DockingState, progress: number, timeMs: number): void {
    const style = arrivalBeaconStyle;
    const { x, y, radius } = this.destination;
    const color = colorNumber(dockingStateColors[docking.kind]);
    const ready = docking.kind === "ready";
    const active = docking.kind !== "too-far";
    const baseAlpha = active ? style.activeAlpha : style.idleAlpha;
    const g = this.graphics;

    g.clear();

    // Dashed ring with a dark underlay so it reads over the bright moon limb.
    const ringWidth = ready ? style.ringWidthReady : style.ringWidth;
    const slot = TAU / style.dashCount;
    const dashFill = ready ? 0.82 : style.dashFill;
    const spin = ((timeMs % RING_TURN_MS) / RING_TURN_MS) * TAU;
    for (let pass = 0; pass < 2; pass += 1) {
      const outline = pass === 0;
      g.lineStyle(
        outline ? ringWidth + OUTLINE_EXTRA_PX : ringWidth,
        outline ? colorNumber(colors.cosmosDeep) : color,
        outline ? OUTLINE_ALPHA * baseAlpha : baseAlpha,
      );
      for (let i = 0; i < style.dashCount; i += 1) {
        const start = spin + i * slot;
        g.beginPath();
        g.arc(x, y, radius, start, start + slot * dashFill);
        g.strokePath();
      }
    }

    // Landing-window progress arc (track + fill), clockwise from the top.
    if (ready) {
      const progressRadius = radius + style.progressGap;
      g.lineStyle(style.progressWidth + OUTLINE_EXTRA_PX, colorNumber(colors.cosmosDeep), OUTLINE_ALPHA);
      g.beginPath();
      g.arc(x, y, progressRadius, 0, TAU);
      g.strokePath();
      g.lineStyle(style.progressWidth, color, 0.22);
      g.beginPath();
      g.arc(x, y, progressRadius, 0, TAU);
      g.strokePath();
      if (progress > 0) {
        const end = TOP_ANGLE + TAU * Math.min(1, progress);
        g.lineStyle(style.progressWidth, colorNumber(colors.parchmentWarm), 0.95);
        g.beginPath();
        g.arc(x, y, progressRadius, TOP_ANGLE, end);
        g.strokePath();
        g.fillStyle(colorNumber(colors.plaster), 1);
        g.fillCircle(x + Math.cos(end) * progressRadius, y + Math.sin(end) * progressRadius, style.progressWidth * 0.7);
      }
    }

    this.drawLanterns(color, ready, active, timeMs);
    this.drawChevron(color, docking.kind, timeMs);

    if (this.lastKind !== docking.kind) {
      this.lastKind = docking.kind;
      this.ghost.setTint(colorNumber(colors.parchment)).setVisible(!ready);
      this.label.setColor(dockingStateColors[docking.kind]);
    }
    this.label.setAlpha(ready ? 0 : baseAlpha);
  }

  private drawLanterns(color: number, ready: boolean, active: boolean, timeMs: number): void {
    const style = arrivalBeaconStyle;
    const { x, y, radius } = this.destination;
    const g = this.graphics;
    const step = TAU / style.lanternCount;
    const chase = (timeMs % style.lanternChaseMs) / style.lanternChaseMs;

    for (let i = 0; i < style.lanternCount; i += 1) {
      // Offset by half a step so no lantern sits on the chevron.
      const angle = this.bottomAngle + step * (i + 0.5);
      const lx = x + Math.cos(angle) * radius;
      const ly = y + Math.sin(angle) * radius;
      const chaseDistance = (((i / style.lanternCount - chase) % 1) + 1) % 1;
      const glow = ready ? 1 : active ? 0.35 + 0.65 * (1 - chaseDistance) ** 3 : 0.3;

      g.fillStyle(color, 0.2 * glow);
      g.fillCircle(lx, ly, style.lanternGlowRadius);
      g.fillStyle(colorNumber(colors.cosmosDeep), 0.7);
      g.fillCircle(lx, ly, style.lanternRadius + 2);
      g.fillStyle(colorNumber(colors.amber), 0.55 + 0.45 * glow);
      g.fillCircle(lx, ly, style.lanternRadius);
      g.fillStyle(colorNumber(colors.plaster), 0.4 * glow);
      g.fillCircle(lx - 1, ly - 1, style.lanternRadius * 0.45);
    }
  }

  /** Double chevron just inside the ring, pointing the way the ship's bottom must face. */
  private drawChevron(color: number, kind: DockingStateKind, timeMs: number): void {
    const style = arrivalBeaconStyle;
    const { x, y, radius } = this.destination;
    const g = this.graphics;
    const dir = { x: Math.cos(this.bottomAngle), y: Math.sin(this.bottomAngle) };
    const side = { x: -dir.y, y: dir.x };
    const bob = kind === "ready" ? 0 : Math.sin((timeMs / style.chevronBobMs) * TAU) * style.chevronBobPx * 0.5;
    const tipRadius = radius - style.chevronInset + bob;

    // Dark plate behind the chevrons keeps them readable over the bright moon limb.
    const plateCentre = radius - style.chevronInset - style.chevronLength * 0.55;
    g.fillStyle(colorNumber(colors.cosmosPanel), 0.72);
    g.fillCircle(x + dir.x * plateCentre, y + dir.y * plateCentre, style.chevronPlateRadius);
    g.lineStyle(2, color, 0.5);
    g.strokeCircle(x + dir.x * plateCentre, y + dir.y * plateCentre, style.chevronPlateRadius);

    this.chevronBuffers.forEach((points, n) => {
      const tip = tipRadius - n * (style.chevronThickness + 7);
      const alpha = n === 0 ? 1 : 0.55;
      writeChevronPoints(points, x, y, dir, side, tip, style.chevronLength, style.chevronHalfWidth, style.chevronThickness);
      g.lineStyle(OUTLINE_EXTRA_PX + 1, colorNumber(colors.cosmosDeep), OUTLINE_ALPHA * alpha);
      g.strokePoints(points, true, true);
      g.fillStyle(color, alpha);
      g.fillPoints(points, true, true);
    });
  }

  private drawApproachRing(): void {
    const style = arrivalBeaconStyle;
    const { x, y, approachRadius } = this.destination;
    this.approach.fillStyle(colorNumber(colors.duskBlue), style.approachAlpha);
    for (let i = 0; i < style.approachDashCount; i += 1) {
      const angle = (i / style.approachDashCount) * TAU;
      this.approach.fillCircle(x + Math.cos(angle) * approachRadius, y + Math.sin(angle) * approachRadius, 2);
    }
  }
}

function makePoints(count: number): Phaser.Math.Vector2[] {
  return Array.from({ length: count }, () => new Phaser.Math.Vector2());
}

function writeChevronPoints(
  points: readonly Phaser.Math.Vector2[],
  cx: number,
  cy: number,
  dir: { readonly x: number; readonly y: number },
  side: { readonly x: number; readonly y: number },
  tipRadius: number,
  length: number,
  halfWidth: number,
  thickness: number,
): void {
  const back = tipRadius - length * 0.6;
  const layout: readonly (readonly [number, number])[] = [
    [tipRadius, 0],
    [back, halfWidth],
    [back - thickness, halfWidth],
    [tipRadius - thickness, 0],
    [back - thickness, -halfWidth],
    [back, -halfWidth],
  ];
  layout.forEach(([along, across], index) => {
    points[index]?.set(cx + dir.x * along + side.x * across, cy + dir.y * along + side.y * across);
  });
}
