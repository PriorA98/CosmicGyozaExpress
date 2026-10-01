import { colors } from "../game/designTokens";

/** Gentle game states shown in state pills (design-system.md section 3, "State Colors"). */
export type UiState = "idle" | "flying" | "docking" | "delivering" | "incident" | "home";

export type StateSwatch = {
  readonly background: string;
  readonly foreground: string;
  readonly dot: string;
};

export const STATE_SWATCHES: Readonly<Record<UiState, StateSwatch>> = {
  idle: { background: "#C2CFAE", foreground: "#6B7E5A", dot: colors.sage },
  flying: { background: "#C6DCC2", foreground: "#2E5232", dot: "#5A8B5E" },
  docking: { background: "#F2C49A", foreground: "#7A4017", dot: colors.ember },
  delivering: { background: "#C7BEDE", foreground: "#5E4F7A", dot: colors.plum },
  incident: { background: "#E5B0A2", foreground: "#7A2E1F", dot: colors.brick },
  home: { background: "#DDDCE2", foreground: "#5A5C70", dot: "#76747F" },
};

export const UI_STATES: readonly UiState[] = ["idle", "flying", "docking", "delivering", "incident", "home"];

export function stateSwatch(state: UiState): StateSwatch {
  return STATE_SWATCHES[state];
}

export type MeterAccent = "ember" | "sage" | "dusk" | "amber";

export const METER_ACCENT_COLOR: Readonly<Record<MeterAccent, string>> = {
  ember: colors.ember,
  sage: colors.sage,
  dusk: colors.duskBlue,
  amber: colors.amber,
};

export function meterAccentColor(accent: MeterAccent): string {
  return METER_ACCENT_COLOR[accent];
}
