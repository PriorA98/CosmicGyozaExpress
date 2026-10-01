import { landingCopy } from "../../data/landingCopy";
import { landingScenery } from "../../data/landingScenery";
import {
  descentZone,
  driftZone,
  tiltZone,
  type LandingZone,
  type LandingZoneReading,
} from "../../systems/LandingSystem";

/**
 * Pure formatting for every landing readout. The scene builds one `LandingReadouts` per frame and hands the
 * same object to the HUD panel and the in-world gauge, so they can never disagree. No Phaser imports.
 */
export type LandingReadout = {
  /** Friendly word ("gentle", "brisk", "too fast", "rising"...). */
  readonly word: string;
  /** Number in display units, already formatted ("1.8", "6"). */
  readonly number: string;
  readonly unit: string;
  readonly zone: LandingZone;
  /** Full HUD line: word, number, unit (and arrow where relevant). */
  readonly text: string;
};

export type LandingReadouts = {
  readonly descent: LandingReadout;
  readonly drift: LandingReadout;
  readonly tilt: LandingReadout;
  readonly altitude: LandingReadout;
  /** Overall "touch down now" zone for the gauge (off pad counts as rough). */
  readonly overallZone: LandingZone;
  /** Gauge chip label: zone word, the most limiting reading, or "find the pad". */
  readonly chip: string;
  /** Needle position 0 (hovering/rising) .. 1 (gauge max). */
  readonly gauge: number;
};

export type ReadoutUnits = {
  readonly pixelsPerMeter: number;
  /** Climbing faster than this (px/s) reads as "rising" instead of a descent word. */
  readonly risingDeadbandPxPerSecond: number;
  /** Sideways speeds below this (px/s) get no drift arrow. */
  readonly driftArrowDeadbandPxPerSecond: number;
};

const DEFAULT_UNITS: ReadoutUnits = landingScenery.readouts;

/** Screen px/s to display m/s with one decimal ("0.0" never shows a minus sign). */
export function formatSpeedNumber(pxPerSecond: number, units: ReadoutUnits = DEFAULT_UNITS): string {
  const value = Math.abs(pxPerSecond) / Math.max(1e-6, units.pixelsPerMeter);
  return (Math.round(value * 10) / 10).toFixed(1);
}

export function formatDescentReadout(velocityY: number, units: ReadoutUnits = DEFAULT_UNITS): LandingReadout {
  const number = formatSpeedNumber(velocityY, units);
  const unit = landingCopy.units.speed;
  if (velocityY < -units.risingDeadbandPxPerSecond) {
    const word = landingCopy.risingWord;
    return { word, number, unit, zone: "soft", text: `${word} ${landingCopy.risingArrow} ${number} ${unit}` };
  }
  const zone = descentZone(velocityY);
  const word = landingCopy.descentWords[zone];
  return { word, number, unit, zone, text: `${word} ${number} ${unit}` };
}

export function formatDriftReadout(velocityX: number, units: ReadoutUnits = DEFAULT_UNITS): LandingReadout {
  const zone = driftZone(velocityX);
  const word = landingCopy.driftWords[zone];
  const number = formatSpeedNumber(velocityX, units);
  const unit = landingCopy.units.speed;
  const arrow =
    velocityX > units.driftArrowDeadbandPxPerSecond
      ? ` ${landingCopy.driftArrows.right}`
      : velocityX < -units.driftArrowDeadbandPxPerSecond
        ? ` ${landingCopy.driftArrows.left}`
        : "";
  return { word, number, unit, zone, text: `${word} ${number} ${unit}${arrow}` };
}

export function formatTiltReadout(angleDegrees: number): LandingReadout {
  const zone = tiltZone(angleDegrees);
  const word = landingCopy.tiltWords[zone];
  const number = String(Math.round(Math.abs(angleDegrees)));
  const unit = landingCopy.units.degrees;
  return { word, number, unit, zone, text: `${word} ${number}${unit}` };
}

export function formatAltitudeReadout(altitudePx: number, onPad: boolean, units: ReadoutUnits = DEFAULT_UNITS): LandingReadout {
  const number = String(Math.round(Math.max(0, altitudePx) / Math.max(1e-6, units.pixelsPerMeter)));
  const unit = landingCopy.units.altitude;
  const zone: LandingZone = onPad ? "soft" : "rough";
  const word = onPad ? "" : landingCopy.offPad;
  return { word, number, unit, zone, text: onPad ? `${number} ${unit}` : `${number} ${unit} · ${word}` };
}

export function gaugeChipLabel(reading: LandingZoneReading): string {
  if (!reading.onPad) return landingCopy.offPad;
  if (reading.zone === "rough") return landingCopy.roughBecause[reading.limiting];
  return landingCopy.gaugeZone[reading.zone];
}

export function buildLandingReadouts(
  reading: LandingZoneReading,
  velocityX: number,
  velocityY: number,
  units: ReadoutUnits = DEFAULT_UNITS,
): LandingReadouts {
  return {
    descent: formatDescentReadout(velocityY, units),
    drift: formatDriftReadout(velocityX, units),
    tilt: formatTiltReadout(reading.angleDegrees),
    altitude: formatAltitudeReadout(reading.altitude, reading.onPad, units),
    overallZone: reading.onPad ? reading.zone : "rough",
    chip: gaugeChipLabel(reading),
    gauge: reading.descentGauge,
  };
}
