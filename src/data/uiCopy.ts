import type { MissionId } from "../types/campaign";
import type { UiState } from "../ui/statePalette";

/** Player-facing UI copy (lowercase, short, warm). Owner: ui package. */

export type KeyHintCopy = {
  readonly key: string;
  readonly label: string;
};

export const titleCopy = {
  logoTop: "Cosmic Gyoza",
  logoBottom: "Express",
  subtitle: "warm deliveries across a soft galaxy",
  startButton: "deliver tea to the moon",
  /** CTA once the Tea Moon delivery is saved as completed. */
  startAgainButton: "deliver tea again",
  settingsButton: "settings",
  routeLogButton: "route log",
  missionHeader: "today's delivery",
  awaitingPill: "awaiting tea",
  deliveredPill: "delivered",
  /** Tiny footer credit (the full font list lives in docs/assets). */
  credits: "handmade deliveries · ofl type",
  awaitingDeliveryPill: "ready to fly",
  itemsLabel: "in the hold",
  deliveredBadge: "delivered · postcard collected",
  /** Perforated stamp in the mission card header once delivered (desktop: the pill says "delivered"). */
  collectedStamp: "✓ postcard collected",
  /** Compact card header has no pill, so its stamp carries both facts. */
  collectedStampCompact: "✓ delivered",
  /** Shorter item line for the compact card (the full name lives in missions.ts). */
  itemsCompact: "tea + moon mochi",
  hints: [
    { key: "enter", label: "start" },
    { key: "M", label: "sound" },
  ] satisfies readonly KeyHintCopy[],
  touchHint: "tap the button to start",
  /** Secondary action that opens the delivery board (fresh saves: a preview of the route). */
  boardButton: "delivery board",
  /** Primary action once any delivery is saved: opens the board on the next suggested stop. */
  nextDeliveryButton: (shortTitle: string): string => `next: ${shortTitle.toLowerCase()}`,
  /** Primary action once every delivery is stamped. */
  boardPrimaryButton: "open the delivery board",
  /** Key hints once the primary action opens the board. */
  hintsReturning: [
    { key: "enter", label: "board" },
    { key: "M", label: "sound" },
  ] satisfies readonly KeyHintCopy[],
  /** Gentle one-line notes when the save could not be read as-is (never alarming). */
  saveNotice: {
    corrupt: "your old save was crumpled, so we kept a copy and started fresh",
    futureVersion: "this save is from a newer version, so today's progress stays in this tab",
    storageUnavailable: "this browser can't save right now, progress lasts until you close the tab",
  },
  /** One-line versions for the compact (phone) title. */
  saveNoticeCompact: {
    corrupt: "crumpled save set aside · fresh start",
    futureVersion: "newer save found · tab-only progress",
    storageUnavailable: "can't save here · tab-only progress",
  },
} as const;

export const settingsCopy = {
  title: "settings",
  rows: {
    sound: "sound",
    music: "music",
    sfx: "effects",
    motion: "reduced motion",
  },
  on: "on",
  off: "off",
  done: "done",
  hint: "↑↓ choose · ←→ adjust · esc close",
  saved: "saved on this device",
  unsaved: "this browser can't save, settings last until you close the tab",
} as const;

export const routeLogCopy = {
  title: "route log",
  entryTitle: "tea moon",
  entryMeta: "postcard collected",
  postcardCaption: "a postcard from the sleepy moon rabbit, mid-sip",
  bestLabel: "best delivery",
  crashesLabel: "bumps on the way",
  deliveriesLabel: "deliveries",
  empty: "no postcards yet. the moon is waiting.",
  close: "close",
  /** Heading of the delivery history list (shown once more than one stop is delivered). */
  historyTitle: "delivered so far",
  /** Per-mission headline captions for the latest delivered stop. */
  captions: {
    "tea-moon": "a postcard from the sleepy moon rabbit, mid-sip",
    "bento-belt": "mallow's lunch break, finally with lunch in it",
    "matcha-nebula": "a green hush and one listening lantern",
    "black-hole-bakery": "pip's oven window, glowing at the edge of everything",
    "im-fine": "one lit window, and a second spoon on the sill",
    "home-delivery": "the porch light, left on for you",
  } satisfies Readonly<Record<MissionId, string>>,
} as const;

/** Delivery board (MissionSelectScene) copy. */
export const boardCopy = {
  title: "delivery board",
  subtitle: "six warm stops, one little ship",
  back: "back",
  launch: "fly this delivery",
  replay: "fly it again",
  carrying: "carrying",
  deliveredStamp: "✓ delivered",
  here: "you are here",
  newIdea: {
    "tea-moon": "new: turn to aim your thruster",
    "bento-belt": "new: rocks and the pad move",
    "matcha-nebula": "new: a steady current carries you",
    "black-hole-bakery": "new: the oven pulls",
    "im-fine": "new: the wind warns before it blows",
    "home-delivery": "new: this parcel is for you",
  } satisfies Readonly<Record<MissionId, string>>,
  /** Locked node caption: "After <previous delivery>". */
  lockedAfter: (shortTitle: string): string => `After ${shortTitle}`,
  hints: [
    { key: "←→", label: "choose" },
    { key: "enter", label: "fly" },
    { key: "esc", label: "back" },
  ] satisfies readonly KeyHintCopy[],
} as const;

export const soundToastCopy = {
  on: "sound on",
  off: "sound off",
  hint: "M",
} as const;

export type SettingsPanelCopy = typeof settingsCopy;
export type RouteLogCopy = typeof routeLogCopy;

export const stateLabels: Readonly<Record<UiState, string>> = {
  idle: "idle",
  flying: "flying",
  docking: "docking",
  delivering: "delivering",
  incident: "gyoza incident",
  home: "home",
};

/** Sample dashboard chatter for the ui-kit gallery (real lines belong to their scenes). */
export const sampleTickerLines: readonly string[] = [
  "dumpling hull: crispy on one side, as intended",
  "tea temperature: politely scalding",
  "moon rabbit status: awake-ish",
];

export const uiKitCopy = {
  title: "ui kit",
  subtitle: "shared components · cozy cosmos",
  sections: {
    type: "type",
    buttons: "buttons",
    keycaps: "keycaps",
    pills: "state pills",
    hud: "hud panel",
    meters: "meters",
    card: "parchment card",
    ticker: "dashboard ticker",
    icons: "icons",
    touch: "touch controls",
  },
  sampleBody: "a tiny kettle is blinking from the moon.",
  sampleCardTitle: "request",
  sampleCardBody: "Someone needs tea before the stars get too loud.",
  hudTitle: "flight",
  hudRows: {
    speed: "speed",
    heading: "heading",
    drift: "drift",
    package: "package",
  },
  buttonLabels: {
    idle: "launch",
    hover: "hover",
    pressed: "pressed",
    focused: "focused",
    secondary: "route log",
    ink: "settings",
    disabled: "disabled",
  },
  touchLabels: {
    left: "left",
    right: "right",
    thrust: "thrust",
    steady: "steady",
  },
  touchToneLabels: {
    ink: "ink tiles · space",
    cream: "cream tiles · moon",
  },
  pressedKeyNote: "held",
  surfaceLabels: {
    done: "done",
    close: "close",
  },
  sections2: {
    surfaces: "on parchment",
    toast: "sound toast",
    notices: "notices",
    settings: "settings controls",
  },
  /** Gallery samples for the notice components (real copy lives in titleCopy). */
  noticeSamples: {
    save: "crumpled save tucked away · fresh start",
    stamp: "✓ postcard collected",
  },
  settingsSample: {
    sound: "sound",
    motion: "motion",
    music: "music",
  },
  hudGridTitle: "flight · phone grid",
  hudGridRows: {
    speed: "speed",
    moon: "moon",
    bottom: "bottom",
    package: "package",
  },
} as const;
