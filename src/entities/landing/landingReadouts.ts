import { landingCopy } from "../../data/landingCopy";
import { landingScenery } from "../../data/landingScenery";
import {
  descentZone,
  driftZone,
  tiltZone,
  type LandingZone,
  type LandingZoneReading,
} from "../../systems/LandingSystem";
import type { LandingTuning } from "../../data/landingTuning";
import type { LandingIncidentKind } from "../../types/landing";

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
  /** Compact-HUD pad status ("lined up" / "find the pad" / "off blanket"). */
  readonly pad: LandingReadout;
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

export function formatDescentReadout(velocityY: number, units: ReadoutUnits = DEFAULT_UNITS, tuning?: LandingTuning): LandingReadout {
  const number = formatSpeedNumber(velocityY, units);
  const unit = landingCopy.units.speed;
  if (velocityY < -units.risingDeadbandPxPerSecond) {
    const word = landingCopy.risingWord;
    return { word, number, unit, zone: "soft", text: `${word} ${landingCopy.risingArrow} ${number} ${unit}` };
  }
  const zone = descentZone(velocityY, tuning);
  const word = landingCopy.descentWords[zone];
  return { word, number, unit, zone, text: `${word} ${number} ${unit}` };
}

export function formatDriftReadout(velocityX: number, units: ReadoutUnits = DEFAULT_UNITS, tuning?: LandingTuning): LandingReadout {
  const zone = driftZone(velocityX, tuning);
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

export function formatPadReadout(onPad: boolean): LandingReadout {
  const word = onPad ? landingCopy.padStatus.onPad : landingCopy.padStatus.offPad;
  return { word, number: "", unit: "", zone: onPad ? "soft" : "rough", text: word };
}

function statusReadout(word: string, zone: LandingZone): LandingReadout {
  return { word, number: "", unit: "", zone, text: word };
}

/** The touchdown descent reading, re-labelled with a resting prefix ("hit at 14.1 m/s"). */
function touchdownDescent(descent: LandingReadout, prefix: string): LandingReadout {
  return { ...descent, word: prefix, text: `${prefix} ${descent.number} ${descent.unit}` };
}

/**
 * Readouts frozen at an incident: the descent row keeps the touchdown speed (the cause), while drift,
 * tilt, altitude and pad switch to what the tumbling dumpling actually does, so the HUD never claims
 * "level" while it lies on its side.
 */
export function buildIncidentReadouts(touchdown: LandingReadouts, kind: LandingIncidentKind, driftArrow: string = ""): LandingReadouts {
  const rows = landingCopy.restingRows.incident;
  const onBlanket = kind !== "off-pad";
  const blanket = onBlanket ? landingCopy.padStatus.onBlanket : landingCopy.padStatus.offBlanket;
  const driftWord = rows.drift[kind];
  const driftText = kind === "skid" && driftArrow !== "" ? `${driftWord} ${driftArrow}` : driftWord;
  return {
    descent: touchdownDescent(touchdown.descent, rows.descentPrefix),
    drift: { ...statusReadout(driftWord, kind === "skid" ? "rough" : "soft"), text: driftText },
    tilt: statusReadout(rows.tilt[kind], "rough"),
    altitude: { word: blanket, number: "0", unit: landingCopy.units.altitude, zone: onBlanket ? "soft" : "rough", text: `0 ${landingCopy.units.altitude} · ${blanket}` },
    pad: statusReadout(blanket, onBlanket ? "soft" : "rough"),
    overallZone: "rough",
    chip: touchdown.chip,
    gauge: touchdown.gauge,
  };
}

/** Readouts frozen at a soft or bumpy touchdown while the ship settles on the blanket. */
export function buildSettledReadouts(touchdown: LandingReadouts): LandingReadouts {
  const rows = landingCopy.restingRows.settled;
  const blanket = landingCopy.padStatus.onBlanket;
  return {
    descent: touchdownDescent(touchdown.descent, rows.descentPrefix),
    drift: statusReadout(rows.drift, "soft"),
    tilt: statusReadout(rows.tilt, "soft"),
    altitude: { word: blanket, number: "0", unit: landingCopy.units.altitude, zone: "soft", text: `0 ${landingCopy.units.altitude} · ${blanket}` },
    pad: statusReadout(blanket, "soft"),
    overallZone: touchdown.overallZone,
    chip: touchdown.chip,
    gauge: touchdown.gauge,
  };
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
  /** The landing's own tuning (zones use its limits); omitted = Tea Moon tuning. */
  tuning?: LandingTuning,
): LandingReadouts {
  return {
    descent: formatDescentReadout(velocityY, units, tuning),
    drift: formatDriftReadout(velocityX, units, tuning),
    tilt: formatTiltReadout(reading.angleDegrees),
    altitude: formatAltitudeReadout(reading.altitude, reading.onPad, units),
    pad: formatPadReadout(reading.onPad),
    overallZone: reading.onPad ? reading.zone : "rough",
    chip: gaugeChipLabel(reading),
    gauge: reading.descentGauge,
  };
}
