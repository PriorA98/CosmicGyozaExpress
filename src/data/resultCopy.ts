import type { UiIconName } from "./assetManifest";
import type { typeScale } from "../game/designTokens";
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
  /**
   * Gentle footnote shown when this visit's progress cannot be kept by the browser.
   * Never alarming: the delivery still counts for the rest of the session.
   */
  persistenceNotice: {
    "storage-unavailable": "this browser can't keep postcards · the moon will remember anyway",
    "newer-save": "a newer scrapbook lives here · this visit stays in your pocket",
    "write-failed": "the scrapbook is a little full tonight · this visit stays in your pocket",
  },
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
  postcard: 820,
  footer: 940,
  /**
   * Reveal end: after the last tween (postcard 820 + 320) and the postcard twinkles
   * (820 + last delay 180 + 5 frames x 60 = 1300), so the settled frame has no live sparkles.
   */
  complete: 1320,
  /** Rabbit returns from the happy face to idle after this long. */
  happyHoldMs: 1800,
  blinkMinMs: 2200,
  blinkMaxMs: 3800,
  blinkHoldMs: 140,
  /** Star field drift in px per ms (at art scale). */
  starDriftPerMs: 0.006,
} as const;

/** Postcard twinkles: authored `fx-sparkle` frames stepped around the postcard edge (never over its art). */
export const resultTwinkle = {
  /** Frame sequence through the 4-frame sparkle strip: grow, peak, settle, fade. */
  frames: [0, 1, 2, 1, 3],
  frameMs: 60,
  /**
   * Spots relative to the postcard rect: `fx`/`fy` are fractions of its half size, `ox`/`oy` an
   * outward offset in screen px, so every sparkle sits on the parchment just outside the card.
   */
  spots: [
    { fx: -1, fy: -1, ox: -12, oy: -10, delayMs: 0 },
    { fx: 1, fy: -1, ox: 12, oy: -10, delayMs: 60 },
    { fx: 1, fy: 0.3, ox: 16, oy: 0, delayMs: 120 },
    { fx: -1, fy: 0.5, ox: -16, oy: 0, delayMs: 90 },
    { fx: 0.3, fy: -1, ox: 0, oy: -16, delayMs: 180 },
  ],
} as const;

type TypeToken = keyof typeof typeScale;

export type ResultLayoutTier = "full" | "compact" | "tiny";

/**
 * Below this display scale (shown canvas px per logical px) even the compact card's body text
 * drops under ~8 physical px, so the card switches to the tiny tier (phone portrait letterbox).
 */
export const RESULT_TINY_DISPLAY_SCALE = 0.42;

export type ResultCardLayout = {
  readonly cardWidth: number;
  readonly cardHeight: number;
  readonly cardCenterY: number;
  readonly pad: number;
  readonly leftColumnWidth: number;
  readonly columnGap: number;
  /** Vertical gap between copy blocks. */
  readonly blockGap: number;
  /** Integer display scale for the rabbit portrait (64 art px). */
  readonly portraitScale: number;
  readonly portraitFrame: number;
  readonly nameTagHeight: number;
  readonly showKicker: boolean;
  readonly showReport: boolean;
  readonly showItems: boolean;
  readonly showStats: boolean;
  readonly showKeycaps: boolean;
  readonly showSkipHint: boolean;
  readonly showDeliveryNote: boolean;
  /** Integer display scale for the 96x64 postcard. */
  readonly postcardScale: number;
  /** Even screen px, so pills sit on whole art pixels at 2x. */
  readonly stampHeight: number;
  /** Even screen px (whole art pixels); the bottom 4 art px are the button's hard lip. */
  readonly buttonHeight: number;
  readonly buttonMinWidth: number;
  readonly buttonGap: number;
  readonly statGap: number;
  readonly statMinGap: number;
  /** Button labels use the pixel font only where its 8px grid lands on whole screen pixels. */
  readonly buttonFont: "pixel" | "ui";
  readonly type: {
    readonly kicker: TypeToken;
    /** Largest first; the first size that fits on one line wins. */
    readonly headline: readonly TypeToken[];
    readonly reaction: TypeToken;
    readonly body: TypeToken;
    readonly caption: TypeToken;
    readonly stamp: TypeToken;
    readonly stat: TypeToken;
    readonly postcardLabel: TypeToken;
    readonly postcardTitle: TypeToken;
    readonly note: TypeToken;
    readonly notice: TypeToken;
    readonly button: TypeToken;
    readonly skipHint: TypeToken;
  };
};

/**
 * Result card layouts per display tier. `full` is the 1280x720 desktop card; `compact` fills the
 * canvas on phones in landscape so body text stays near 11 physical px; `tiny` keeps only the
 * payoff (rabbit, items, headline, quote, stamps, postcard, buttons) in large type for portrait
 * letterboxes. The postcard always sits bottom-right of the copy column, above the footer.
 */
export const resultCardLayouts = {
  full: {
    cardWidth: 1000,
    cardHeight: 600,
    cardCenterY: 370,
    pad: 30,
    leftColumnWidth: 288,
    columnGap: 38,
    blockGap: 10,
    portraitScale: 2,
    portraitFrame: 172,
    nameTagHeight: 28,
    showKicker: true,
    showReport: true,
    showItems: true,
    showStats: true,
    showKeycaps: true,
    showSkipHint: true,
    showDeliveryNote: true,
    postcardScale: 2,
    stampHeight: 36,
    buttonHeight: 56,
    buttonMinWidth: 236,
    buttonGap: 18,
    statGap: 40,
    statMinGap: 34,
    buttonFont: "pixel",
    type: {
      kicker: "md",
      headline: ["3xl", "2xl"],
      reaction: "xl",
      body: "md",
      caption: "md",
      stamp: "md",
      stat: "md",
      postcardLabel: "md",
      postcardTitle: "base",
      note: "md",
      notice: "sm",
      button: "md",
      skipHint: "base",
    },
  },
  compact: {
    cardWidth: 1240,
    cardHeight: 688,
    cardCenterY: 360,
    pad: 28,
    leftColumnWidth: 300,
    columnGap: 34,
    blockGap: 10,
    portraitScale: 2,
    portraitFrame: 172,
    nameTagHeight: 34,
    showKicker: true,
    showReport: true,
    showItems: true,
    showStats: true,
    showKeycaps: false,
    showSkipHint: false,
    showDeliveryNote: true,
    postcardScale: 2,
    stampHeight: 46,
    buttonHeight: 72,
    buttonMinWidth: 280,
    buttonGap: 20,
    statGap: 44,
    statMinGap: 38,
    buttonFont: "ui",
    type: {
      kicker: "lg",
      headline: ["3xl", "2xl"],
      reaction: "xl",
      body: "lg",
      caption: "lg",
      stamp: "lg",
      stat: "lg",
      postcardLabel: "lg",
      postcardTitle: "lg",
      note: "lg",
      notice: "lg",
      button: "xl",
      skipHint: "lg",
    },
  },
  tiny: {
    cardWidth: 1256,
    cardHeight: 704,
    cardCenterY: 360,
    pad: 26,
    leftColumnWidth: 320,
    columnGap: 30,
    blockGap: 14,
    portraitScale: 3,
    portraitFrame: 228,
    nameTagHeight: 48,
    showKicker: false,
    showReport: false,
    showItems: true,
    showStats: false,
    showKeycaps: false,
    showSkipHint: false,
    showDeliveryNote: false,
    postcardScale: 2,
    stampHeight: 60,
    buttonHeight: 96,
    buttonMinWidth: 360,
    buttonGap: 24,
    statGap: 0,
    statMinGap: 0,
    buttonFont: "ui",
    type: {
      kicker: "2xl",
      headline: ["3xl"],
      reaction: "2xl",
      body: "2xl",
      caption: "xl",
      stamp: "xl",
      stat: "2xl",
      postcardLabel: "xl",
      postcardTitle: "xl",
      note: "2xl",
      notice: "xl",
      button: "2xl",
      skipHint: "2xl",
    },
  },
} as const satisfies Record<ResultLayoutTier, ResultCardLayout>;
