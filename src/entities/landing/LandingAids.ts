import Phaser from "phaser";
import { landingTuning } from "../../data/landingTuning";
import { landingCopy, landingScenery, landingZoneColors } from "../../data/landingScenery";
import { burstDust } from "../../fx/feedback";
import { colorNumber, colors, depth, fontStacks } from "../../game/designTokens";
import { landingHudScale } from "./LandingDashboard";
import type { LandingPadAlignment, LandingZone, LandingZoneReading } from "../../systems/LandingSystem";
import type { LandingPadDefinition } from "../../types/landing";

/** Everything the in-world landing aids need for one frame. Positions are screen px. */
export type LandingAidsFrame = {
  /** Ship sprite centre. */
  readonly shipX: number;
  readonly shipY: number;
  /** Physics contact line (ship feet) while upright. */
  readonly feetY: number;
  readonly rotation: number;
  readonly reading: LandingZoneReading;
  readonly alignment: LandingPadAlignment;
  readonly thrusting: boolean;
  readonly stabilizing: boolean;
  readonly deltaSeconds: number;
  readonly timeMs: number;
};

/**
 * In-world landing aids, all coloured by the live touchdown zone (sage soft / amber bumpy / brick too fast):
 * a ground shadow with a touchdown ring (altitude), a dashed drop line, a descent gauge riding beside the ship,
 * an arrow back to the pad when off it, warm flame light on the ground when thrusting low, and a gyro ring
 * while the stabilizer is held.
 */
export class LandingAids {
  private readonly scene: Phaser.Scene;
  private readonly pad: LandingPadDefinition;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly ring: Phaser.GameObjects.Ellipse;
  private readonly dropLine: Phaser.GameObjects.Graphics;
  private readonly wash: Phaser.GameObjects.Ellipse;
  private readonly arrow: Phaser.GameObjects.Graphics;
  private readonly gyro: Phaser.GameObjects.Graphics;
  private readonly instrument: Phaser.GameObjects.Container;
  private readonly needle: Phaser.GameObjects.Graphics;
  private readonly speedText: Phaser.GameObjects.Text;
  private readonly zoneText: Phaser.GameObjects.Text;
  private readonly zoneChip: Phaser.GameObjects.Graphics;
  private zoneKey = "";
  private shownSpeed = -1;
  private gaugeValue = 0;
  private gyroAlpha = 0;
  private gyroPhase = 0;
  private lastDustMs = 0;
  private visible = true;
  private readonly instrumentScale: number;

  constructor(scene: Phaser.Scene, pad: LandingPadDefinition) {
    this.scene = scene;
    this.pad = pad;
    const shadowConfig = landingScenery.shadow;
    const washConfig = landingScenery.thrustWash;

    this.shadow = scene.add
      .ellipse(pad.centerX, pad.surfaceY, shadowConfig.maxWidth, shadowConfig.maxWidth * shadowConfig.heightRatio, colorNumber(colors.cosmosDeep), 1)
      .setDepth(depth.world + 5);
    this.ring = scene.add
      .ellipse(pad.centerX, pad.surfaceY, shadowConfig.maxWidth, shadowConfig.maxWidth * shadowConfig.heightRatio)
      .setDepth(depth.world + 5);
    this.dropLine = scene.add.graphics().setDepth(depth.world + 5);
    this.wash = scene.add
      .ellipse(pad.centerX, pad.surfaceY, washConfig.width, washConfig.height, colorNumber(colors.ember), 1)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0)
      .setDepth(depth.world + 6);

    this.arrow = this.createArrow();
    this.gyro = scene.add.graphics().setDepth(depth.shipFx + 1);

    this.instrumentScale = landingHudScale(scene) > 1 ? landingScenery.compactHud.instrumentScale : 1;
    const parts = this.createInstrument();
    this.instrument = parts.container.setScale(this.instrumentScale);
    this.needle = parts.needle;
    this.speedText = parts.speedText;
    this.zoneText = parts.zoneText;
    this.zoneChip = parts.zoneChip;
  }

  update(frame: LandingAidsFrame): void {
    if (!this.visible) return;
    this.updateShadow(frame);
    this.updateWash(frame);
    this.updateArrow(frame);
    this.updateGyro(frame);
    this.updateInstrument(frame);
  }

  /** Hide every aid (touchdown, incident); `show` brings them back for a retry. */
  hide(): void {
    this.visible = false;
    for (const object of [this.shadow, this.ring, this.dropLine, this.wash, this.arrow, this.gyro, this.instrument]) {
      this.scene.tweens.killTweensOf(object);
    }
    this.scene.tweens.add({
      targets: [this.ring, this.dropLine, this.arrow, this.gyro, this.instrument, this.wash],
      alpha: 0,
      duration: 160,
      ease: "Sine.easeOut",
    });
  }

  show(): void {
    this.visible = true;
    for (const object of [this.ring, this.dropLine, this.arrow, this.gyro, this.instrument, this.wash]) {
      this.scene.tweens.killTweensOf(object);
    }
    this.ring.setAlpha(landingScenery.shadow.ringAlpha);
    this.dropLine.setAlpha(1);
    this.instrument.setAlpha(landingScenery.instrument.alpha);
    this.gyro.setAlpha(1);
    this.arrow.setAlpha(1);
    this.gyroAlpha = 0;
    this.zoneKey = "";
  }

  /** Keeps the ground shadow under a ship that is resting or tumbling, without the other aids. */
  updateShadowOnly(shipX: number, feetY: number): void {
    const config = landingScenery.shadow;
    const altitude = Math.max(0, this.pad.surfaceY - feetY);
    const proximity = 1 - Phaser.Math.Clamp(altitude / config.fadeAltitude, 0, 1);
    const width = Phaser.Math.Linear(config.minWidth, config.maxWidth, proximity);
    this.shadow
      .setPosition(shipX, this.pad.surfaceY)
      .setScale(width / config.maxWidth)
      .setAlpha(Phaser.Math.Linear(config.minAlpha, config.maxAlpha, proximity));
  }

  private updateShadow(frame: LandingAidsFrame): void {
    const config = landingScenery.shadow;
    this.updateShadowOnly(frame.shipX, frame.feetY);
    const zone = zoneFor(frame.reading);
    const color = colorNumber(landingZoneColors[zone]);
    const scale = this.shadow.scaleX;

    this.ring.setPosition(frame.shipX, this.pad.surfaceY).setScale(scale * 1.08);
    this.ring.setStrokeStyle(config.ringLineWidth / Math.max(scale, 0.3), color, 1);

    this.dropLine.clear();
    const top = frame.feetY + config.dropLineGapPx;
    const bottom = this.pad.surfaceY - config.dropLineGapPx;
    if (bottom - top < config.dropLineDashPx) return;

    this.dropLine.lineStyle(2, color, config.dropLineAlpha);
    this.dropLine.beginPath();
    const step = config.dropLineDashPx + config.dropLineGapPx;
    for (let y = top; y < bottom; y += step) {
      this.dropLine.moveTo(frame.shipX, y);
      this.dropLine.lineTo(frame.shipX, Math.min(bottom, y + config.dropLineDashPx));
    }
    this.dropLine.strokePath();
  }

  private updateWash(frame: LandingAidsFrame): void {
    const config = landingScenery.thrustWash;
    const altitude = frame.reading.altitude;
    const proximity = 1 - Phaser.Math.Clamp(altitude / config.maxAltitude, 0, 1);
    const target = frame.thrusting ? proximity * config.maxAlpha : 0;
    const eased = Phaser.Math.Linear(this.wash.alpha, target, Math.min(1, frame.deltaSeconds * 10));
    this.wash.setPosition(frame.shipX, this.pad.surfaceY).setAlpha(eased).setScale(0.7 + proximity * 0.5, 1);

    if (frame.thrusting && proximity > 0.2 && frame.timeMs - this.lastDustMs > config.dustIntervalMs) {
      this.lastDustMs = frame.timeMs;
      burstDust(this.scene, frame.shipX, this.pad.surfaceY - 4, {
        count: config.dustCount,
        spread: config.dustSpread * (0.6 + proximity),
        depth: depth.world + 6,
      });
    }
  }

  private updateArrow(frame: LandingAidsFrame): void {
    const config = landingScenery.padArrow;
    const direction = frame.alignment.directionToPad;
    if (direction === 0) {
      this.arrow.setVisible(false);
      return;
    }

    const bob = Math.sin((frame.timeMs / config.bobMs) * Math.PI * 2) * config.bobPx;
    this.arrow
      .setVisible(true)
      .setPosition(frame.shipX + direction * (config.distanceFromShip + bob), frame.shipY)
      .setScale(direction, 1);
  }

  private updateGyro(frame: LandingAidsFrame): void {
    const config = landingScenery.gyro;
    const target = frame.stabilizing ? 1 : 0;
    const step = config.fadePerSecond * frame.deltaSeconds;
    this.gyroAlpha = target > this.gyroAlpha ? Math.min(target, this.gyroAlpha + step) : Math.max(target, this.gyroAlpha - step);
    this.gyroPhase += config.spinRadPerSecond * frame.deltaSeconds;

    this.gyro.clear();
    if (this.gyroAlpha <= 0.01) return;

    const color = colorNumber(colors.duskBlue);
    const cos = Math.cos(frame.rotation);
    const sin = Math.sin(frame.rotation);
    const cx = frame.shipX;
    const cy = frame.shipY;
    for (let i = 0; i < config.dashCount; i += 1) {
      const start = this.gyroPhase + (i / config.dashCount) * Math.PI * 2;
      // Dashes on the far side of the ring (upper half) are dimmer so it wraps around the dumpling.
      const front = Math.sin(start + config.dashArc / 2) > 0;
      this.gyro.lineStyle(config.lineWidth, color, config.alpha * this.gyroAlpha * (front ? 1 : 0.4));
      this.gyro.beginPath();
      for (let s = 0; s <= GYRO_DASH_SEGMENTS; s += 1) {
        const t = start + (config.dashArc * s) / GYRO_DASH_SEGMENTS;
        const lx = Math.cos(t) * config.radiusX;
        const ly = Math.sin(t) * config.radiusY + config.offsetY;
        const px = cx + lx * cos - ly * sin;
        const py = cy + lx * sin + ly * cos;
        if (s === 0) this.gyro.moveTo(px, py);
        else this.gyro.lineTo(px, py);
      }
      this.gyro.strokePath();
    }

    // True-level reference line: shows how far the ship is from upright.
    this.gyro.lineStyle(2, colorNumber(colors.plaster), 0.5 * this.gyroAlpha);
    this.gyro.beginPath();
    this.gyro.moveTo(cx - config.radiusX - config.levelLineHalfWidth, cy + config.offsetY);
    this.gyro.lineTo(cx - config.radiusX - 6, cy + config.offsetY);
    this.gyro.moveTo(cx + config.radiusX + 6, cy + config.offsetY);
    this.gyro.lineTo(cx + config.radiusX + config.levelLineHalfWidth, cy + config.offsetY);
    this.gyro.strokePath();
  }

  private updateInstrument(frame: LandingAidsFrame): void {
    const config = landingScenery.instrument;
    const { width } = this.scene.scale;
    const offsetX = config.offsetX * this.instrumentScale;
    const side = frame.shipX > width - offsetX - config.edgeMarginX ? -1 : 1;
    this.instrument.setPosition(Math.round(frame.shipX + side * offsetX), Math.round(frame.shipY + config.offsetY));

    this.gaugeValue = Phaser.Math.Linear(this.gaugeValue, frame.reading.descentGauge, config.smoothing);
    this.needle.setY(-config.barHeight / 2 + this.gaugeValue * config.barHeight);

    const descending = Math.round(frame.reading.descentGauge * landingTuning.descentGaugeMaxSpeed);
    if (descending !== this.shownSpeed) {
      this.shownSpeed = descending;
      this.speedText.setText(String(descending));
    }

    const zone = zoneFor(frame.reading);
    const label = !frame.reading.onPad
      ? landingCopy.offPad
      : zone === "rough"
        ? landingCopy.roughBecause[frame.reading.limiting]
        : landingCopy.zone[zone];
    const key = `${zone}:${label}`;
    if (key !== this.zoneKey) {
      this.zoneKey = key;
      this.zoneText.setText(label);
      this.drawZoneChip(landingZoneColors[zone]);
    }
  }

  private drawZoneChip(color: string): void {
    const config = landingScenery.instrument;
    const padX = 8;
    const padY = 4;
    const w = this.zoneText.width + padX * 2;
    const h = this.zoneText.height + padY * 2;
    const y = config.barHeight / 2 + config.panelPadY + config.labelGap;
    this.zoneChip.clear();
    this.zoneChip.fillStyle(colorNumber(color), 1);
    this.zoneChip.fillRoundedRect(-w / 2, y, w, h, 6);
    this.zoneText.setPosition(0, y + h / 2);
  }

  private createArrow(): Phaser.GameObjects.Graphics {
    const size = landingScenery.padArrow.size;
    const arrow = this.scene.add.graphics().setDepth(depth.shipFx + 1).setVisible(false);
    arrow.fillStyle(colorNumber(colors.cosmosDeep), 0.55);
    arrow.fillTriangle(-size + 2, -size - 2, -size + 2, size + 2, size + 4, 0);
    arrow.fillStyle(colorNumber(colors.amber), 1);
    arrow.fillTriangle(-size, -size, -size, size, size, 0);
    arrow.fillTriangle(-size * 2.2, -size, -size * 2.2, size, -size * 1.2, 0);
    return arrow;
  }

  private createInstrument(): {
    container: Phaser.GameObjects.Container;
    needle: Phaser.GameObjects.Graphics;
    speedText: Phaser.GameObjects.Text;
    zoneText: Phaser.GameObjects.Text;
    zoneChip: Phaser.GameObjects.Graphics;
  } {
    const config = landingScenery.instrument;
    const halfBar = config.barHeight / 2;
    const panel = this.scene.add.graphics();
    const panelW = config.barWidth + config.panelPadX * 2 + 22;
    const panelTop = -halfBar - config.panelPadY - 22;
    const panelH = config.barHeight + config.panelPadY * 2 + 22;
    panel.fillStyle(colorNumber(colors.cosmosPanel), 0.78);
    panel.fillRoundedRect(-panelW / 2, panelTop, panelW, panelH, 8);
    panel.lineStyle(1, colorNumber(colors.plaster), 0.22);
    panel.strokeRoundedRect(-panelW / 2, panelTop, panelW, panelH, 8);

    // Bands top→bottom: soft (slow) → bumpy → too fast, proportional to the real thresholds.
    const bands = this.scene.add.graphics();
    const max = landingTuning.descentGaugeMaxSpeed;
    const softEnd = (landingTuning.safeVerticalSpeed / max) * config.barHeight;
    const bumpyEnd = (landingTuning.bumpyVerticalSpeed / max) * config.barHeight;
    const barX = -config.barWidth / 2 - 6;
    const segments: readonly [number, number, LandingZone][] = [
      [0, softEnd, "soft"],
      [softEnd, bumpyEnd, "bumpy"],
      [bumpyEnd, config.barHeight, "rough"],
    ];
    for (const [from, to, zone] of segments) {
      bands.fillStyle(colorNumber(landingZoneColors[zone]), 0.95);
      bands.fillRect(barX, -halfBar + from, config.barWidth, to - from - 1);
    }
    bands.lineStyle(1, colorNumber(colors.plaster), 0.35);
    bands.strokeRect(barX - 0.5, -halfBar - 0.5, config.barWidth + 1, config.barHeight + 1);

    const needle = this.scene.add.graphics();
    const n = config.needleSize;
    const needleX = barX + config.barWidth + 2;
    needle.fillStyle(colorNumber(colors.plaster), 1);
    needle.fillTriangle(needleX, 0, needleX + n * 1.6, -n, needleX + n * 1.6, n);
    needle.fillRect(barX - 2, -1, config.barWidth + 4, 3);
    needle.setY(-halfBar);

    const speedText = this.scene.add
      .text(0, panelTop + 6, "0", {
        color: colors.plaster,
        fontFamily: fontStacks.mono,
        fontSize: "15px",
        fontStyle: "bold",
      })
      .setOrigin(0.5, 0);

    const zoneChip = this.scene.add.graphics();
    const zoneText = this.scene.add
      .text(0, 0, "", {
        color: colors.ink,
        fontFamily: fontStacks.mono,
        fontSize: "15px",
        fontStyle: "bold",
      })
      .setOrigin(0.5, 0.5);

    const container = this.scene.add
      .container(0, 0, [panel, bands, needle, speedText, zoneChip, zoneText])
      .setDepth(depth.shipFx + 2)
      .setAlpha(config.alpha);
    return { container, needle, speedText, zoneText, zoneChip };
  }
}

const GYRO_DASH_SEGMENTS = 4;

function zoneFor(reading: LandingZoneReading): LandingZone {
  return reading.onPad ? reading.zone : "rough";
}
