import type { UiIconName } from "./assetManifest";
import type { PackageConditionLabel } from "../types/flight";
import type { LandingResultKind } from "../types/landing";

/**
 * Authored copy for the delivery result card. Tone rules (design-system.md):
 * lowercase UI labels, short warm lines, no diet/body/moral/shame language, and every
 * outcome reads as a successful delivery.
 */
export type ResultStampTone = "sage" | "teal" | "amber" | "plum" | "ember" | "dusk";

export type ResultStampCopy = {
  readonly label: string;
  readonly tone: ResultStampTone;
};

export type CountPhrase = {
  readonly zero: string;
  readonly one: string;
  /** `{n}` is replaced with the count. */
  readonly many: string;
};

export const resultCopy = {
  kicker: "delivery accepted",
  recipientCaption: "sleepy moon rabbit",
  headlines: {
    soft: "a whisper-soft delivery",
    bumpy: "a spirited delivery",
    incident: "delivered with extra steam",
  } satisfies Record<LandingResultKind, string>,
  /** Spoken by the recipient. One is picked deterministically from the delivery so screenshots repeat. */
  reactionLines: {
    soft: [
      "“Oh… it arrived like a tiny sunrise. Thank you, little gyoza.”",
      "“Still warm. You must have flown like a held breath.”",
      "“Mmm. The kettle and I both approve.”",
    ],
    bumpy: [
      "“That landing sounded like a cupboard. Very comforting, actually.”",
      "“A little hop at the end! The tea enjoyed the ride.”",
      "“Spirited! The whole moon felt you arrive. It says hello.”",
    ],
    incident: [
      "“You came back for it. That’s the warmest part.”",
      "“Reassembled with care. I’ll eat it in the order it landed.”",
      "“Extra steam! I was secretly hoping for extra steam.”",
    ],
  } satisfies Record<LandingResultKind, readonly string[]>,
  landingStamps: {
    soft: { label: "soft landing", tone: "sage" },
    bumpy: { label: "spirited landing", tone: "amber" },
    incident: { label: "reassembled landing", tone: "plum" },
  } satisfies Record<LandingResultKind, ResultStampCopy>,
  conditionTones: {
    Perfect: "sage",
    "Slightly shaken": "teal",
    "Emotionally rotated": "dusk",
    "Warm but confused": "amber",
    "Still delicious": "ember",
    "Dramatically rearranged": "plum",
    "Basically fine": "plum",
  } satisfies Record<PackageConditionLabel, ResultStampTone>,
  stats: {
    routeTime: {
      icon: "speed",
      unhurried: "a timeless little trip",
      /** `{time}` is replaced with e.g. `1m 14s`. */
      template: "{time} of scenic flying",
    },
    bumps: {
      icon: "drift",
      phrase: {
        zero: "not a single bump",
        one: "1 friendly bump along the way",
        many: "{n} friendly bumps along the way",
      },
    },
    landingTries: {
      icon: "moon",
      phrase: {
        zero: "landed on the first try",
        one: "landed on try 2 · the moon waited",
        many: "landed on try {n} · the moon waited",
      },
    },
  } satisfies Record<string, { readonly icon: UiIconName } & Record<string, unknown>>,
  postcard: {
    firstLabel: "new memory",
    repeatLabel: "memory re-stamped",
    title: "tea moon postcard",
    caption: "tucked into the glove compartment",
  },
  deliveryNote: {
    first: "first delivery to the tea moon",
    /** `{n}` is replaced with the delivery number. */
    repeat: "delivery no. {n} to the tea moon",
    warmestPage: "a new warmest page in the scrapbook",
  },
  buttons: {
    flyAgain: { label: "fly again", key: "enter" },
    backToTitle: { label: "back to title", key: "esc" },
  },
  skipHint: "any key to skip",
} as const;

/**
 * Words that must never appear in result copy. Tests scan every string above against this list.
 */
export const resultCopyBannedWords = [
  "fail",
  "bad",
  "penalty",
  "punish",
  "diet",
  "calorie",
  "guilt",
  "shame",
  "worse",
  "worst",
  "wrong",
  "lost",
  "crash",
  "dead",
  "grade",
] as const;

/** Pill colours per stamp tone, from the state-pill table in design-system.md section 3. */
export type ResultStampPalette = {
  readonly background: string;
  readonly foreground: string;
  readonly dot: string;
};

export const resultStampPalette = {
  sage: { background: "#C2CFAE", foreground: "#4F6140", dot: "#8DA17A" },
  teal: { background: "#C3DDD6", foreground: "#2F5B53", dot: "#6FA39A" },
  amber: { background: "#F0D7A6", foreground: "#6E4A12", dot: "#D4A055" },
  ember: { background: "#F2C49A", foreground: "#7A4017", dot: "#E08A4B" },
  plum: { background: "#C7BEDE", foreground: "#5E4F7A", dot: "#9B8FB8" },
  dusk: { background: "#CBD8E0", foreground: "#3C5566", dot: "#9EB6C4" },
} as const satisfies Record<ResultStampTone, ResultStampPalette>;

/**
 * Staged reveal timing for the result card (ms after create). The whole reveal must finish
 * within `complete` (<= 1600 ms) and any key or tap skips straight to the end.
 */
export const resultRevealTiming = {
  card: 0,
  portrait: 100,
  headline: 180,
  reaction: 300,
  items: 400,
  report: 460,
  landingStamp: 560,
  conditionStamp: 660,
  stats: 760,
  postcard: 860,
  footer: 980,
  /** Last step start + its tween (postcard 860 + 320, footer 980 + 200). */
  complete: 1180,
  /** Rabbit returns from the happy face to idle after this long. */
  happyHoldMs: 1800,
  blinkMinMs: 2200,
  blinkMaxMs: 3800,
  blinkHoldMs: 140,
  /** Star field drift in px per ms (at art scale). */
  starDriftPerMs: 0.006,
} as const;
