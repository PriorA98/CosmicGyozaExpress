import type { LandingLimitingFactor, LandingZone } from "../systems/LandingSystem";
import type { LandingIncidentKind, LandingResultKind } from "../types/landing";

/**
 * Tea Moon landing copy: HUD labels, friendly readout words, dashboard chatter, captions, intro card,
 * and control hints. Lowercase, warm, lightly technical. Layout and tuning live elsewhere.
 */
export const landingCopy = {
  dashboardTitle: "tea moon · landing",
  rows: {
    descent: "descent",
    drift: "drift",
    tilt: "tilt",
    altitude: "altitude",
    package: "package",
  },
  /** Display units after converting screen px with `landingScenery.readouts.pixelsPerMeter`. */
  units: {
    speed: "m/s",
    degrees: "°",
    altitude: "m",
  },
  /** One friendly word per zone for each readout, so the HUD never needs a raw number to read. */
  descentWords: {
    soft: "gentle",
    bumpy: "brisk",
    rough: "too fast",
  } satisfies Record<LandingZone, string>,
  /** Shown instead of a descent word while the ship is climbing. */
  risingWord: "rising",
  driftWords: {
    soft: "steady",
    bumpy: "slidey",
    rough: "too slidey",
  } satisfies Record<LandingZone, string>,
  tiltWords: {
    soft: "level",
    bumpy: "leaning",
    rough: "tipping",
  } satisfies Record<LandingZone, string>,
  /** Arrows appended to the drift readout. */
  driftArrows: { left: "←", right: "→" },
  risingArrow: "↑",
  /** Chip label under the in-world gauge for a too-rough reading, naming whichever reading is furthest past its limit. */
  roughBecause: {
    descent: "too fast",
    drift: "too slidey",
    tilt: "too tilted",
    pad: "find the pad",
  } satisfies Record<LandingLimitingFactor, string>,
  /** Gauge chip label when the ship is not over the pad. */
  offPad: "find the pad",
  /** Gauge chip label for a landable overall reading. */
  gaugeZone: {
    soft: "soft",
    bumpy: "bumpy",
  } satisfies Record<Exclude<LandingZone, "rough">, string>,
  notes: {
    descendingIdle: "please apply soup-facing thrust",
    thrusting: "single-thruster confidence: moderate",
    stabilizing: "gyro humming, dumpling leveling",
    tilted: "bottom not pointed at problem",
    offPad: "the pad is the glowing blanket",
    settling: "landing blanket engaged",
    retry: "fresh attempt, same warm dumpling",
  },
  incidentNotes: {
    "hard-drop": "moon blanket says: softer, please",
    skid: "sideways soup maneuver detected",
    "tilt-tip": "bottom thruster argued with geometry",
    "off-pad": "landing blanket missed the snack",
  } satisfies Record<LandingIncidentKind, string>,
  incidentTitle: "gyoza incident",
  retrying: "re-steaming for another try",
  touchdown: {
    soft: "featherlight landing!",
    bumpy: "bumpy, but delivered",
    incident: "",
  } satisfies Record<LandingResultKind, string>,
  /** Prefix for the touchdown caption subtitle. */
  touchdownSpeedLabel: "touchdown",
  intro: {
    title: "tea moon · landing",
    subtitle: "the rabbit is waving you in",
    skipHint: "any key to skip",
  },
  controls: [
    { keys: ["W"], label: "thrust" },
    { keys: ["A", "D"], label: "tilt" },
    { keys: ["S"], label: "steady" },
    { keys: ["R"], label: "retry" },
  ],
  touchLabels: {
    rotateLeft: "tilt",
    rotateRight: "tilt",
    stabilizer: "steady",
    thrust: "thrust",
  },
} as const;
