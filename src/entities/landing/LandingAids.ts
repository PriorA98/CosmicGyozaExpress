import Phaser from "phaser";
import { landingTuning } from "../../data/landingTuning";
import { LANDING_ART_SCALE, landingScenery, landingZoneColors } from "../../data/landingScenery";
import { burstDust } from "../../fx/feedback";
import { colorNumber, colors, depth, fontStacks, typeScale } from "../../game/designTokens";
import type { LandingPadAlignment, LandingZone, LandingZoneReading } from "../../systems/LandingSystem";
import type { LandingPadDefinition } from "../../types/landing";
import type { LandingReadouts } from "./landingReadouts";
import {
  bitmapSize,
  dottedLineCells,
  drawBitmap,
  drawSpans,
  drawSteppedGlow,
  fillNotchedRect,
  filledEllipseSpans,
  outlineEllipseSpans,
  snapToGrid,
  strokeNotchedRect,
} from "./pixelShapes";

/** Everything the in-world landing aids need for one frame. Positions are screen px. */
export type LandingAidsFrame = {
  /** Ship sprite position (its pivot). */
  readonly shipX: number;
  readonly shipY: number;
  /** Physics contact line (ship feet) while upright. */
  readonly feetY: number;
  readonly rotation: number;
  readonly reading: LandingZoneReading;
  readonly readouts: LandingReadouts;
  readonly alignment: LandingPadAlignment;
  readonly thrusting: boolean;
  readonly stabilizing: boolean;
  readonly deltaSeconds: number;
  readonly timeMs: number;
};

const CELL = LANDING_ART_SCALE;
/** Shadow width is quantised to this many px so the pixel ellipse only redraws when it visibly changes. */
const SHADOW_STEP_PX = CELL * 2;

/**
 * In-world landing aids, all coloured by the live touchdown zone (sage soft / amber bumpy / brick too fast)
 * and all drawn as pixel cells on the art grid: a ground shadow with a touchdown ring (altitude), a dotted
 * drop line, a descent gauge riding beside the ship, a pixel arrow back to the pad when off it, warm stepped
 * flame light on the ground when thrusting low, and orbiting gyro dots while the stabilizer is held.
 */
export class LandingAids {
  private readonly scene: Phaser.Scene;
  private readonly pad: LandingPadDefinition;
  /** Where feet and the contact shadow visually rest on the blanket's top face. */
  private readonly contactY: number;
  private readonly shadow: Phaser.GameObjects.Graphics;
  private readonly ring: Phaser.GameObjects.Graphics;
  private readonly dropLine: Phaser.GameObjects.Graphics;
  private readonly wash: Phaser.GameObjects.Graphics;
  private readonly arrow: Phaser.GameObjects.Graphics;
  private readonly gyro: Phaser.GameObjects.Graphics;
  private readonly instrument: Phaser.GameObjects.Container;
  private readonly needle: Phaser.GameObjects.Graphics;
  private readonly speedText: Phaser.GameObjects.Text;
  private readonly zoneText: Phaser.GameObjects.Text;
  private readonly zoneChip: Phaser.GameObjects.Graphics;
  /** Instrument extent below its origin (local px, unscaled): bar + chip. */
  private instrumentBottom = 0;
  private instrumentScale = 1;
  private zoneKey = "";
  private shownSpeed = "";
  private shadowKey = "";
  private ringKey = "";
  private washKey = "";
  private gaugeValue = 0;
  private gyroAlpha = 0;
  private gyroPhase = 0;
  private lastDustMs = 0;
  private visible = true;

  constructor(scene: Phaser.Scene, pad: LandingPadDefinition, contactY: number) {
    this.scene = scene;
    this.pad = pad;
    this.contactY = contactY;

    this.shadow = scene.add.graphics().setDepth(depth.world + 5);
    this.ring = scene.add.graphics().setDepth(depth.world + 5);
    this.dropLine = scene.add.graphics().setDepth(depth.world + 5);
    this.wash = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(depth.world + 6);
    this.arrow = this.createArrow();
    this.gyro = scene.add.graphics().setDepth(depth.shipFx + 1);

    const parts = this.createInstrument();
    this.instrument = parts.container;
    this.needle = parts.needle;
    this.speedText = parts.speedText;
    this.zoneText = parts.zoneText;
    this.zoneChip = parts.zoneChip;
  }

  /** The gauge scales with the compact HUD so its readout stays legible on phones. */
  setUiScale(scale: number): void {
    this.instrumentScale = scale;
    this.instrument.setScale(scale);
  }

  update(frame: LandingAidsFrame): void {
    if (!this.visible) return;
    this.updateShadow(frame);
    this.updateWash(frame);
    this.updateArrow(frame);
    this.updateGyro(frame);
    this.updateInstrument(frame);
  }

  /** Hides every aid instantly (touchdown, incident); the ground shadow keeps following via `updateShadowOnly`. */
  hide(): void {
    this.visible = false;
    for (const object of [this.ring, this.dropLine, this.wash, this.arrow, this.gyro, this.instrument]) {
      this.scene.tweens.killTweensOf(object);
      object.setVisible(false);
    }
    this.gyroAlpha = 0;
  }

  /** Brings the aids back for a retry. */
  show(): void {
    this.visible = true;
    for (const object of [this.ring, this.dropLine, this.gyro, this.instrument]) object.setVisible(true);
    this.wash.setVisible(true).setAlpha(0);
    this.instrument.setAlpha(landingScenery.instrument.alpha);
    this.gyroAlpha = 0;
    this.zoneKey = "";
    this.shownSpeed = "";
    this.ringKey = "";
    this.gaugeValue = 0;
  }

  /** Keeps the ground shadow under a ship that is resting or tumbling, without the other aids. */
  updateShadowOnly(shipX: number, feetY: number): void {
    const config = landingScenery.shadow;
    const proximity = this.proximity(feetY);
    const width = snapToGrid(Phaser.Math.Linear(config.minWidth, config.maxWidth, proximity), SHADOW_STEP_PX);
    const x = snapToGrid(shipX, CELL);
    const key = `${width}`;
    if (key !== this.shadowKey) {
      this.shadowKey = key;
      this.shadow.clear();
      this.shadow.fillStyle(colorNumber(colors.cosmosDeep), 1);
      drawSpans(this.shadow, 0, 0, filledEllipseSpans(width / 2, Math.max(CELL, (width * config.heightRatio) / 2), CELL), CELL);
    }
    this.shadow.setPosition(x, snapToGrid(this.contactY, CELL)).setAlpha(Phaser.Math.Linear(config.minAlpha, config.maxAlpha, proximity));
  }

  private proximity(feetY: number): number {
    const altitude = Math.max(0, this.pad.surfaceY - feetY);
    return 1 - Phaser.Math.Clamp(altitude / landingScenery.shadow.fadeAltitude, 0, 1);
  }

  private updateShadow(frame: LandingAidsFrame): void {
    const config = landingScenery.shadow;
    this.updateShadowOnly(frame.shipX, frame.feetY);
    const zone = frame.readouts.overallZone;
    const color = colorNumber(landingZoneColors[zone]);
    const proximity = this.proximity(frame.feetY);
    const width = snapToGrid(Phaser.Math.Linear(config.minWidth, config.maxWidth, proximity) * config.ringScale, SHADOW_STEP_PX);
    const ringKey = `${width}:${zone}`;
    if (ringKey !== this.ringKey) {
      this.ringKey = ringKey;
      this.ring.clear();
      this.ring.fillStyle(color, config.ringAlpha);
      drawSpans(this.ring, 0, 0, outlineEllipseSpans(width / 2, Math.max(CELL * 2, (width * config.heightRatio) / 2), CELL), CELL);
    }
    this.ring.setPosition(this.shadow.x, this.shadow.y);

    this.dropLine.clear();
    const top = frame.feetY + config.dropLineGapPx;
    const bottom = this.contactY - config.dropLineGapPx;
    const x = snapToGrid(frame.shipX, CELL) - CELL / 2;
    this.dropLine.fillStyle(color, config.dropLineAlpha);
    for (const y of dottedLineCells(top, bottom, config.dropLineStepPx, CELL)) this.dropLine.fillRect(x, y, CELL, CELL);
  }

  private updateWash(frame: LandingAidsFrame): void {
    const config = landingScenery.thrustWash;
    const proximity = 1 - Phaser.Math.Clamp(frame.reading.altitude / config.maxAltitude, 0, 1);
    const target = frame.thrusting ? proximity : 0;
    const eased = Phaser.Math.Linear(this.wash.alpha / config.maxAlpha, target, Math.min(1, frame.deltaSeconds * 10)) * config.maxAlpha;
    const width = snapToGrid(config.width * (0.7 + proximity * 0.5), SHADOW_STEP_PX);
    const key = `${width}`;
    if (key !== this.washKey) {
      this.washKey = key;
      this.wash.clear();
      drawSteppedGlow(this.wash, width / 2, config.height / 2, config.rings, colorNumber(colors.ember), 1 / config.rings, CELL);
    }
    this.wash.setPosition(snapToGrid(frame.shipX, CELL), snapToGrid(this.contactY, CELL)).setAlpha(eased);

    if (frame.thrusting && proximity > 0.2 && frame.timeMs - this.lastDustMs > config.dustIntervalMs) {
      this.lastDustMs = frame.timeMs;
      burstDust(this.scene, frame.shipX, this.contactY - 4, {
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

    const bob = Math.round(Math.sin((frame.timeMs / config.bobMs) * Math.PI * 2) * (config.bobPx / CELL)) * CELL;
    this.arrow
      .setVisible(true)
      .setPosition(snapToGrid(frame.shipX + direction * (config.distanceFromShip + bob), CELL), snapToGrid(frame.shipY, CELL))
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

    const color = colorNumber(config.dotColor);
    const cos = Math.cos(frame.rotation);
    const sin = Math.sin(frame.rotation);
    const cx = frame.shipX;
    const cy = frame.shipY;
    const dot = config.dotPx;
    for (let i = 0; i < config.dotCount; i += 1) {
      const t = this.gyroPhase + (i / config.dotCount) * Math.PI * 2;
      // Dots on the far side of the ring (upper half) are dimmer so it wraps around the dumpling.
      const front = Math.sin(t) > 0;
      const lx = Math.cos(t) * config.radiusX;
      const ly = Math.sin(t) * config.radiusY + config.offsetY;
      const px = snapToGrid(cx + lx * cos - ly * sin, CELL);
      const py = snapToGrid(cy + lx * sin + ly * cos, CELL);
      this.gyro.fillStyle(color, config.alpha * this.gyroAlpha * (front ? 1 : config.backAlpha));
      this.gyro.fillRect(px - dot / 2, py - dot / 2, dot, dot);
    }

    // True-level reference ticks either side: show how far the ship is from upright.
    const levelY = snapToGrid(cy + config.offsetY, CELL);
    const inner = config.radiusX + 8;
    const length = config.levelLineHalfWidth;
    this.gyro.fillStyle(colorNumber(config.levelColor), config.alpha * this.gyroAlpha);
    this.gyro.fillRect(snapToGrid(cx - inner - length, CELL), levelY - CELL / 2, length, CELL);
    this.gyro.fillRect(snapToGrid(cx + inner, CELL), levelY - CELL / 2, length, CELL);
  }

  private updateInstrument(frame: LandingAidsFrame): void {
    const config = landingScenery.instrument;
    const { width } = this.scene.scale;
    const scale = this.instrumentScale;
    const offsetX = config.offsetX * scale;
    const side = frame.shipX > width - offsetX - config.edgeMarginX ? -1 : 1;
    // Never let the gauge or its chip sink into the pad or the control hints.
    const maxY = this.pad.surfaceY - config.surfaceMarginPx - this.instrumentBottom * scale;
    const y = Math.min(frame.shipY + config.offsetY, maxY);
    this.instrument.setPosition(snapToGrid(frame.shipX + side * offsetX, CELL), snapToGrid(y, CELL));

    this.gaugeValue = Phaser.Math.Linear(this.gaugeValue, frame.readouts.gauge, config.smoothing);
    this.needle.setY(snapToGrid(-config.barHeight / 2 + this.gaugeValue * config.barHeight, CELL));

    const speed = frame.readouts.descent.number;
    if (speed !== this.shownSpeed) {
      this.shownSpeed = speed;
      this.speedText.setText(speed);
    }

    const zone = frame.readouts.overallZone;
    const label = frame.readouts.chip;
    const key = `${zone}:${label}`;
    if (key !== this.zoneKey) {
      this.zoneKey = key;
      this.zoneText.setText(label);
      this.drawZoneChip(zone);
    }
  }

  private drawZoneChip(zone: LandingZone): void {
    const config = landingScenery.instrument;
    const w = snapToGrid(this.zoneText.width + config.chipPadX * 2, CELL);
    const h = snapToGrid(this.zoneText.height + config.chipPadY * 2, CELL);
    const y = config.barHeight / 2 + config.panelPadY + config.labelGap;
    this.zoneChip.clear();
    this.zoneChip.fillStyle(colorNumber(colors.cosmosDeep), 0.45);
    fillNotchedRect(this.zoneChip, -w / 2, y + CELL, w, h, CELL);
    this.zoneChip.fillStyle(colorNumber(landingZoneColors[zone]), 1);
    fillNotchedRect(this.zoneChip, -w / 2, y, w, h, CELL);
    this.zoneText.setPosition(0, y + h / 2);
    this.instrumentBottom = y + h + CELL;
  }

  private createArrow(): Phaser.GameObjects.Graphics {
    const config = landingScenery.padArrow;
    const size = bitmapSize(config.bitmap, CELL);
    const left = -size.width / 2;
    const top = -snapToGrid(size.height / 2, CELL);
    const arrow = this.scene.add.graphics().setDepth(depth.shipFx + 1).setVisible(false);
    arrow.fillStyle(colorNumber(colors.cosmosDeep), 0.55);
    drawBitmap(arrow, left + config.shadowOffsetPx, top + config.shadowOffsetPx, config.bitmap, CELL);
    arrow.fillStyle(colorNumber(colors.amber), 1);
    drawBitmap(arrow, left, top, config.bitmap, CELL);
    // A second, smaller trailing chevron for a "this way" double arrow.
    drawBitmap(arrow, left - size.width + CELL * 2, top + CELL * 2, config.bitmap.slice(2, -2), CELL);
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
    const panelW = snapToGrid(config.barWidth + config.panelPadX * 2 + 22, CELL);
    const panelTop = snapToGrid(-halfBar - config.panelPadY - config.headerPx, CELL);
    const panelH = snapToGrid(config.barHeight + config.panelPadY * 2 + config.headerPx, CELL);
    panel.fillStyle(colorNumber(colors.cosmosDeep), 0.4);
    fillNotchedRect(panel, -panelW / 2, panelTop + CELL, panelW, panelH, CELL);
    panel.fillStyle(colorNumber(colors.cosmosPanel), 0.86);
    fillNotchedRect(panel, -panelW / 2, panelTop, panelW, panelH, CELL);
    panel.fillStyle(colorNumber(colors.plaster), 0.2);
    strokeNotchedRect(panel, -panelW / 2, panelTop, panelW, panelH, CELL);

    // Bands top -> bottom: soft (slow) -> bumpy -> too fast, proportional to the real thresholds.
    const bands = this.scene.add.graphics();
    const max = landingTuning.descentGaugeMaxSpeed;
    const softEnd = snapToGrid((landingTuning.safeVerticalSpeed / max) * config.barHeight, CELL);
    const bumpyEnd = snapToGrid((landingTuning.bumpyVerticalSpeed / max) * config.barHeight, CELL);
    const barX = -config.barWidth / 2 - 6;
    const segments: readonly [number, number, LandingZone][] = [
      [0, softEnd, "soft"],
      [softEnd, bumpyEnd, "bumpy"],
      [bumpyEnd, config.barHeight, "rough"],
    ];
    bands.fillStyle(colorNumber(colors.cosmosDeep), 1);
    bands.fillRect(barX - CELL, -halfBar - CELL, config.barWidth + CELL * 2, config.barHeight + CELL * 2);
    for (const [from, to, zone] of segments) {
      bands.fillStyle(colorNumber(landingZoneColors[zone]), 1);
      bands.fillRect(barX, -halfBar + from, config.barWidth, to - from - CELL);
    }

    const needle = this.scene.add.graphics();
    const n = config.needleSize;
    const needleX = barX + config.barWidth + CELL * 2;
    needle.fillStyle(colorNumber(colors.plaster), 1);
    needle.fillRect(barX - CELL, -CELL, config.barWidth + CELL * 2, CELL * 2);
    // Stepped pixel pointer aimed at the bar.
    for (let i = 0; i < n / CELL; i += 1) needle.fillRect(needleX + i * CELL, -CELL - i * CELL, CELL, CELL * 2 + i * CELL * 2);
    needle.setY(-halfBar);

    const speedText = this.scene.add
      .text(0, panelTop + 5, "0.0", {
        color: colors.plaster,
        fontFamily: fontStacks.mono,
        fontSize: `${typeScale.md}px`,
        fontStyle: "bold",
      })
      .setOrigin(0.5, 0);

    const zoneChip = this.scene.add.graphics();
    const zoneText = this.scene.add
      .text(0, 0, "", {
        color: colors.ink,
        fontFamily: fontStacks.mono,
        fontSize: `${typeScale.base}px`,
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
