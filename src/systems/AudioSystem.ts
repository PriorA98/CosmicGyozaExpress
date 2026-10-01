import type Phaser from "phaser";

/**
 * Synthesized cozy audio (owner: audio-fx package). Contract:
 * - `installAudioSystem(game)` is called exactly once from main.ts.
 * - Subscribes to GameEvents via `onGameEvent`; never required by gameplay code.
 * - Creates/resumes the AudioContext only after a user gesture; degrades silently on any failure.
 * - Reads volumes from save settings; `M` toggles mute.
 */
export function installAudioSystem(_game: Phaser.Game): void {
  // stub: implemented by the audio-fx package
}
