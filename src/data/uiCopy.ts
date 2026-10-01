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
  credits: "handmade slice · type: bricolage, geist, jetbrains mono, silkscreen (ofl)",
  itemsLabel: "in the hold",
  deliveredBadge: "delivered · postcard collected",
  hints: [
    { key: "enter", label: "start" },
    { key: "M", label: "sound" },
  ] satisfies readonly KeyHintCopy[],
  touchHint: "tap the button to start",
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
  postcardCaption: "a postcard from the sleepy moon rabbit, mid-sip",
  bestLabel: "best delivery",
  crashesLabel: "bumps on the way",
  empty: "no postcards yet. the moon is waiting.",
  close: "close",
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
    disabled: "resting",
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
  sections2: {
    surfaces: "on parchment",
    toast: "sound toast",
  },
} as const;
