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
  missionHeader: "today's delivery",
  itemsLabel: "in the hold",
  deliveredBadge: "delivered · postcard collected",
  hints: [
    { key: "enter", label: "start" },
    { key: "M", label: "sound" },
  ] satisfies readonly KeyHintCopy[],
  touchHint: "tap the button to start",
} as const;

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
  },
} as const;
