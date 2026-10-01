/** Shared warm UI kit (Phaser containers). Knows nothing about missions or physics. */
export { Button, type ButtonOptions, type ButtonVariant, type ButtonVisualState } from "./Button";
export { DashboardTicker, TICKER_HEIGHT, type DashboardTickerOptions } from "./DashboardTicker";
export { HudPanel, HUD_LAYOUT, hudPanelHeight, type HudPanelOptions, type HudRow } from "./HudPanel";
export { ICON_DISPLAY_SIZE, ICON_SCALE, addUiIcon, setUiIcon } from "./icons";
export { KEYCAP_HEIGHT, Keycap, type KeycapOptions } from "./Keycap";
export * from "./layout";
export { Meter, type MeterOptions } from "./Meter";
export { CARD_HEADER_HEIGHT, ParchmentCard, type ParchmentCardOptions } from "./ParchmentCard";
export { STATE_PILL_HEIGHT, StatePill, type StatePillOptions } from "./StatePill";
export { STATE_SWATCHES, UI_STATES, meterAccentColor, stateSwatch, type MeterAccent, type UiState } from "./statePalette";
export { SURFACE, UI_ART_SCALE } from "./surfaces";
export * from "./textStyles";
export { TouchControls, detectTouchDevice, type TouchControlsOptions, type TouchZoneDefinition } from "./TouchControls";
export { hasAuthoredTexture } from "./uiTextures";
