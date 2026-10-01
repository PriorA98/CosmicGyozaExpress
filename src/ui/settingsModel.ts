/**
 * Pure settings-panel model (no Phaser, unit-tested in tests/ui.test.ts). The panel edits the
 * player-facing subset of save settings; scenes persist the result through
 * `SaveSystem.updateSettings` and then emit `settings:changed`.
 */
export type SettingsValues = {
  readonly musicVolume: number;
  readonly sfxVolume: number;
  readonly reducedMotion: boolean;
};

/** Volumes restored when sound is switched back on. */
export type SoundRestore = {
  readonly musicVolume: number;
  readonly sfxVolume: number;
};

export type SettingsRowId = "sound" | "music" | "sfx" | "motion" | "done";

export const SETTINGS_ROWS: readonly SettingsRowId[] = ["sound", "music", "sfx", "motion", "done"];

/** Volume rows move in tenths; meters show one segment per step. */
export const VOLUME_STEPS = 10;

/** Volumes used when sound is switched on and nothing audible was remembered. */
export const DEFAULT_SOUND_RESTORE: SoundRestore = { musicVolume: 0.7, sfxVolume: 0.8 };

export type SettingsAction =
  | { readonly kind: "activate"; readonly row: SettingsRowId }
  | { readonly kind: "step"; readonly row: SettingsRowId; readonly direction: -1 | 1 };

export type SettingsState = {
  readonly values: SettingsValues;
  readonly restore: SoundRestore;
};

export function quantizeVolume(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const clamped = Math.min(1, Math.max(0, value));
  return Math.round(clamped * VOLUME_STEPS) / VOLUME_STEPS;
}

export function isSoundOn(values: SettingsValues): boolean {
  return values.musicVolume > 0 || values.sfxVolume > 0;
}

function audible(restore: SoundRestore): boolean {
  return restore.musicVolume > 0 || restore.sfxVolume > 0;
}

function setSound(state: SettingsState, on: boolean): SettingsState {
  const { values } = state;
  if (on === isSoundOn(values)) return state;
  if (!on) {
    return {
      values: { ...values, musicVolume: 0, sfxVolume: 0 },
      restore: { musicVolume: values.musicVolume, sfxVolume: values.sfxVolume },
    };
  }
  const restore = audible(state.restore) ? state.restore : DEFAULT_SOUND_RESTORE;
  return { values: { ...values, musicVolume: quantizeVolume(restore.musicVolume), sfxVolume: quantizeVolume(restore.sfxVolume) }, restore };
}

function stepVolume(value: number, direction: -1 | 1): number {
  return quantizeVolume(quantizeVolume(value) + direction / VOLUME_STEPS);
}

/** Next state after a panel action. "done" never changes values (the panel closes instead). */
export function applySettingsAction(state: SettingsState, action: SettingsAction): SettingsState {
  const { values } = state;
  switch (action.row) {
    case "sound":
      return setSound(state, action.kind === "activate" ? !isSoundOn(values) : action.direction > 0);
    case "music":
    case "sfx": {
      const key = action.row === "music" ? "musicVolume" : "sfxVolume";
      const current = values[key];
      // Activating a volume row walks up one step and wraps from full back to silent.
      const next =
        action.kind === "activate" ? (quantizeVolume(current) >= 1 ? 0 : stepVolume(current, 1)) : stepVolume(current, action.direction);
      return { ...state, values: { ...values, [key]: next } };
    }
    case "motion":
      return { ...state, values: { ...values, reducedMotion: action.kind === "activate" ? !values.reducedMotion : action.direction > 0 } };
    case "done":
      return state;
  }
}

/** Index of the next selectable row (wraps). */
export function nextSettingsRow(index: number, direction: -1 | 1, count: number = SETTINGS_ROWS.length): number {
  if (count <= 0) return 0;
  const safe = Number.isFinite(index) ? Math.floor(index) : 0;
  return (((safe + direction) % count) + count) % count;
}

export function settingsEqual(a: SettingsValues, b: SettingsValues): boolean {
  return a.musicVolume === b.musicVolume && a.sfxVolume === b.sfxVolume && a.reducedMotion === b.reducedMotion;
}
