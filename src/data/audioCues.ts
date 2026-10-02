import type { GameEvent, SceneKey } from "../game/events";

/**
 * Typed audio content for the synthesized cozy soundtrack (owner: audio-fx package).
 *
 * This module is pure: it maps GameEvents to audio actions and holds every mix, music, and
 * cue tuning value. `src/systems/AudioSystem.ts` turns these actions into Web Audio nodes.
 */

export type SfxCueId =
  | "ui-hover"
  | "ui-confirm"
  | "ui-back"
  | "brake-whoosh"
  | "bump-soft"
  | "bump-dramatic"
  | "incident"
  | "respawn"
  | "arrival-shimmer"
  | "arrival-chime"
  | "touchdown-soft"
  | "touchdown-bumpy"
  | "retry-swish"
  | "result-jingle"
  | "sound-on"
  | "sound-off";

export type LoopCueId = "thrust" | "stabilizer";

export type MusicMood = "title" | "flight" | "landing" | "result";

export type AudioAction =
  | { readonly kind: "sfx"; readonly cue: SfxCueId; readonly step?: number }
  | { readonly kind: "loop"; readonly loop: LoopCueId; readonly active: boolean }
  | { readonly kind: "music"; readonly mood: MusicMood }
  | { readonly kind: "duck-music"; readonly durationMs: number }
  | { readonly kind: "reload-settings" };

export type AudioMapperState = {
  /** Highest arrival shimmer step already played in the current landing-window hold. */
  readonly arrivalStep: number;
  /** Timestamp (ms) of the last hover tick, for rate limiting. */
  readonly lastHoverAtMs: number;
};

export type AudioMapResult = {
  readonly actions: readonly AudioAction[];
  readonly state: AudioMapperState;
};

export const SFX_CUE_IDS: readonly SfxCueId[] = [
  "ui-hover",
  "ui-confirm",
  "ui-back",
  "brake-whoosh",
  "bump-soft",
  "bump-dramatic",
  "incident",
  "respawn",
  "arrival-shimmer",
  "arrival-chime",
  "touchdown-soft",
  "touchdown-bumpy",
  "retry-swish",
  "result-jingle",
  "sound-on",
  "sound-off",
];

export const LOOP_CUE_IDS: readonly LoopCueId[] = ["thrust", "stabilizer"];

export const MUSIC_MOODS: readonly MusicMood[] = ["title", "flight", "landing", "result"];

/** Mapping rules (timing thresholds) for the event mapper. */
export const AUDIO_MAPPING = {
  /** Arrival progress is split into this many rising shimmer steps (one per step crossed). */
  arrivalShimmerSteps: 4,
  /** Hover ticks closer together than this are dropped so sweeping a menu stays calm. */
  hoverMinIntervalMs: 70,
  /** Music dips under the result jingle for this long. */
  resultDuckMs: 2600,
} as const;

export const SCENE_MUSIC: Readonly<Partial<Record<SceneKey, MusicMood>>> = {
  TitleScene: "title",
  MissionSelectScene: "title",
  UiKitScene: "title",
  FlightScene: "flight",
  LandingScene: "landing",
  DeliveryResultScene: "result",
};

export function createAudioMapperState(): AudioMapperState {
  return { arrivalStep: 0, lastHoverAtMs: Number.NEGATIVE_INFINITY };
}

const STOP_LOOPS: readonly AudioAction[] = [
  { kind: "loop", loop: "thrust", active: false },
  { kind: "loop", loop: "stabilizer", active: false },
];

/** Converts a 0..1 arrival progress into a shimmer step (0 = none yet). Non-finite input is step 0. */
export function arrivalStepFor(progress: number, steps: number = AUDIO_MAPPING.arrivalShimmerSteps): number {
  if (!Number.isFinite(progress) || steps <= 0) return 0;
  const clamped = Math.min(1, Math.max(0, progress));
  return Math.min(steps, Math.floor(clamped * steps + 1e-9));
}

/**
 * Pure GameEvent -> audio mapping. `nowMs` is only used for hover rate limiting.
 * Returns the actions to perform and the next mapper state; the input state is never mutated.
 */
export function mapGameEventToAudio(event: GameEvent, state: AudioMapperState, nowMs: number): AudioMapResult {
  const same = (actions: readonly AudioAction[]): AudioMapResult => ({ actions, state });

  switch (event.type) {
    case "scene:enter": {
      const mood = SCENE_MUSIC[event.scene];
      const actions: AudioAction[] = [...STOP_LOOPS];
      if (mood) actions.push({ kind: "music", mood });
      return { actions, state: { ...state, arrivalStep: 0 } };
    }
    case "ui:hover": {
      if (nowMs - state.lastHoverAtMs < AUDIO_MAPPING.hoverMinIntervalMs) return same([]);
      return { actions: [{ kind: "sfx", cue: "ui-hover" }], state: { ...state, lastHoverAtMs: nowMs } };
    }
    case "ui:confirm":
      return same([{ kind: "sfx", cue: "ui-confirm" }]);
    case "ui:back":
      return same([{ kind: "sfx", cue: "ui-back" }]);
    case "flight:thrust":
    case "landing:thrust":
      return same([{ kind: "loop", loop: "thrust", active: event.active }]);
    case "landing:stabilizer":
      return same([{ kind: "loop", loop: "stabilizer", active: event.active }]);
    case "flight:brake":
      return same(event.active ? [{ kind: "sfx", cue: "brake-whoosh" }] : []);
    case "flight:bump":
      switch (event.severity) {
        case "soft-bump":
          return same([{ kind: "sfx", cue: "bump-soft" }]);
        case "dramatic-bump":
          return same([{ kind: "sfx", cue: "bump-dramatic" }]);
        case "gyoza-incident":
          return same([{ kind: "sfx", cue: "incident" }, ...STOP_LOOPS]);
      }
      return same([]);
    case "flight:respawn":
      return { actions: [{ kind: "sfx", cue: "respawn" }], state: { ...state, arrivalStep: 0 } };
    case "flight:arrival-progress": {
      const step = arrivalStepFor(event.progress);
      if (step === 0) return { actions: [], state: { ...state, arrivalStep: 0 } };
      if (step <= state.arrivalStep) return same([]);
      return { actions: [{ kind: "sfx", cue: "arrival-shimmer", step }], state: { ...state, arrivalStep: step } };
    }
    case "flight:arrival-complete":
      return { actions: [{ kind: "sfx", cue: "arrival-chime" }, ...STOP_LOOPS], state: { ...state, arrivalStep: 0 } };
    case "landing:touchdown":
      switch (event.result) {
        case "soft":
          return same([{ kind: "sfx", cue: "touchdown-soft" }, ...STOP_LOOPS]);
        case "bumpy":
          return same([{ kind: "sfx", cue: "touchdown-bumpy" }, ...STOP_LOOPS]);
        case "incident":
          return same(STOP_LOOPS);
      }
      return same([]);
    case "landing:incident":
      return same([{ kind: "sfx", cue: "incident" }, ...STOP_LOOPS]);
    case "landing:retry":
      return same([{ kind: "sfx", cue: "retry-swish" }, ...STOP_LOOPS]);
    case "result:shown":
      return same([
        { kind: "duck-music", durationMs: AUDIO_MAPPING.resultDuckMs },
        { kind: "sfx", cue: "result-jingle" },
      ]);
    case "settings:changed":
      return same([{ kind: "reload-settings" }]);
    case "flight:collectible":
      return same([{ kind: "sfx", cue: "arrival-chime" }]);
    case "flight:checkpoint":
    case "flight:beacon":
      return same([{ kind: "sfx", cue: "ui-confirm" }]);
    case "flight:gust-phase":
    case "landing:gust-phase":
      // A soft hover-tick marks the start of each gust warning (the visual telegraph carries the meaning).
      return same(event.phase === "warning" ? [{ kind: "sfx", cue: "ui-hover" }] : []);
    case "mission:start":
    case "mission:completed":
      return same([]);
    case "audio:mute":
      // AudioSystem emits this itself and plays the sound-on/off cue directly (the cue must
      // sound before the master gain closes), so the mapper never echoes it back.
      return same([]);
  }
}

// ---------------------------------------------------------------------------------------------
// Mix and engine tuning
// ---------------------------------------------------------------------------------------------

/** dBFS -> linear gain. */
export function dbToGain(db: number): number {
  return 10 ** (db / 20);
}

/** Linear amplitude -> dBFS (silence is -Infinity). */
export function gainToDb(gain: number): number {
  return gain > 0 ? 20 * Math.log10(gain) : Number.NEGATIVE_INFINITY;
}

/** Equal-tempered MIDI note -> Hz (A4 = 69 = 440 Hz). */
export function midiToHz(note: number): number {
  return 440 * 2 ** ((note - 69) / 12);
}

/** Clamps an untrusted saved volume to 0..1 (non-numbers fall back). */
export function sanitizeVolume(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(1, Math.max(0, value));
}

/** Perceptual curve so the 0..1 setting feels even (quiet half stays usable). */
export function volumeToGain(volume: number): number {
  const v = Math.min(1, Math.max(0, volume));
  return v * v;
}

export const AUDIO_MIX = {
  defaultMusicVolume: 0.7,
  defaultSfxVolume: 0.8,
  /** Final ceiling enforced by the soft clipper: -1 dBFS. */
  ceilingDb: -1,
  /** Pre-bus trims so music sits under effects. */
  musicTrimDb: -9,
  sfxTrimDb: -4,
  masterTrimDb: -2,
  muteRampSeconds: 0.12,
  volumeRampSeconds: 0.08,
  duckDb: -8,
  duckAttackSeconds: 0.25,
  duckReleaseSeconds: 1.4,
  compressor: { thresholdDb: -20, kneeDb: 14, ratio: 3.5, attack: 0.006, release: 0.24 },
  limiter: { thresholdDb: -4, kneeDb: 0, ratio: 20, attack: 0.002, release: 0.12 },
  reverb: { seconds: 2.6, decay: 2.8, musicSend: 0.32, sfxSend: 0.14 },
  echo: { delaySeconds: 0.36, feedback: 0.3, toneHz: 2600, musicSend: 0.24, sfxSend: 0.18 },
  /** Loop voices follow held states with these smooth time constants. */
  loopAttackSeconds: 0.07,
  loopReleaseSeconds: 0.16,
  /** Held loops dip under one-shot feedback so bumps and chimes always cut through. */
  loopDuck: { db: -6, holdSeconds: 0.24, attackSeconds: 0.02, releaseSeconds: 0.2 },
  /** Muting waits this long so the sound-off cue is heard before the master gain closes. */
  muteCueLeadSeconds: 0.16,
} as const;

export type MoodTuning = {
  readonly bpm: number;
  /** Lowpass cutoff for the whole music bus (lower = sleepier). */
  readonly toneHz: number;
  /** Probability (0..1) that an eighth-note step plays a music-box note. */
  readonly melodyDensity: number;
  readonly padDb: number;
  readonly bassDb: number;
  readonly melodyDb: number;
  /** Soft brushed tick on quarter notes (0 = off). */
  readonly tickDb: number | null;
  readonly progression: readonly ChordVoicing[];
};

export type ChordVoicing = {
  /** Bass root MIDI note. */
  readonly root: number;
  /** Pad voicing MIDI notes. */
  readonly pad: readonly number[];
};

const CHORD = {
  fmaj9: { root: 41, pad: [57, 60, 64, 67] },
  em7: { root: 40, pad: [55, 59, 62, 67] },
  dm9: { root: 38, pad: [53, 57, 60, 64] },
  cmaj9: { root: 36, pad: [52, 55, 59, 62] },
  am9: { root: 45, pad: [55, 59, 60, 64] },
  g6: { root: 43, pad: [55, 59, 62, 64] },
  g7sus: { root: 43, pad: [53, 60, 62, 65] },
  cmaj7hi: { root: 48, pad: [55, 59, 64, 67] },
} as const satisfies Record<string, ChordVoicing>;

export const MUSIC_TUNING: Readonly<Record<MusicMood, MoodTuning>> = {
  title: {
    bpm: 62,
    toneHz: 1500,
    melodyDensity: 0.32,
    padDb: -25,
    bassDb: -22,
    melodyDb: -19,
    tickDb: null,
    progression: [CHORD.fmaj9, CHORD.em7, CHORD.dm9, CHORD.cmaj9],
  },
  flight: {
    bpm: 58,
    toneHz: 1250,
    melodyDensity: 0.26,
    padDb: -26,
    bassDb: -23,
    melodyDb: -20,
    tickDb: null,
    progression: [CHORD.fmaj9, CHORD.em7, CHORD.am9, CHORD.cmaj9],
  },
  landing: {
    bpm: 70,
    toneHz: 1900,
    melodyDensity: 0.4,
    padDb: -27,
    bassDb: -22,
    melodyDb: -21,
    tickDb: -32,
    progression: [CHORD.am9, CHORD.fmaj9, CHORD.cmaj9, CHORD.g6],
  },
  result: {
    bpm: 66,
    toneHz: 2100,
    melodyDensity: 0.5,
    padDb: -24,
    bassDb: -22,
    melodyDb: -18,
    tickDb: null,
    progression: [CHORD.fmaj9, CHORD.g6, CHORD.em7, CHORD.am9, CHORD.dm9, CHORD.g7sus, CHORD.cmaj7hi, CHORD.cmaj7hi],
  },
};

/** Music-box melody notes (C major pentatonic, upper register). */
export const MELODY_SCALE: readonly number[] = [72, 74, 76, 79, 81, 84, 86, 88];

export const MUSIC_ENGINE = {
  /**
   * Scheduler wakes this often (ms) and books notes this far ahead (s). A short lookahead keeps
   * mood changes responsive: a new mood starts at the first step that is not booked yet.
   */
  tickMs: 100,
  lookaheadSeconds: 0.28,
  stepsPerBar: 8,
  padAttackSeconds: 1.5,
  padReleaseSeconds: 1.8,
  padDetuneCents: 7,
  padVoiceToneHz: 950,
  melodyDecaySeconds: 1.4,
  bassDecaySeconds: 2.2,
  melodySeed: 0x51eed,
  /**
   * Mood change (scene:enter): the new mood starts `leadSeconds` after the request, but never
   * sooner than `minGapSeconds` after the last booked old-mood step (so at most
   * `lookaheadSeconds` + one tick away, well under 0.5 s). Outgoing pads release over
   * `releaseSeconds`, incoming pads swell over `attackSeconds`, and the bus tone glides with
   * `toneGlideSeconds`.
   */
  moodCrossfade: { leadSeconds: 0.05, minGapSeconds: 0.12, releaseSeconds: 0.6, attackSeconds: 0.45, toneGlideSeconds: 0.12 },
} as const;

/** Every cue declares a peak trim (dB, before the bus); extra fields are recipe-specific. */
type CueTrim = { readonly db: number; readonly [param: string]: number | readonly number[] };

/** Per-cue peak trims (dB, before the bus) and key pitches. */
export const SFX_TUNING = {
  "ui-hover": { db: -7, hz: 1760 },
  "ui-confirm": { db: -12, notes: [76, 83] },
  "ui-back": { db: -14, notes: [79, 72] },
  "brake-whoosh": { db: -8, fromHz: 1900, toHz: 380, seconds: 0.42 },
  "bump-soft": { db: -5, fromHz: 260, toHz: 170, seconds: 0.34, bodyHz: 120 },
  "bump-dramatic": { db: -2.5, fromHz: 190, toHz: 105, seconds: 0.5 },
  incident: { db: -2.5, fromHz: 330, toHz: 150, wobbleHz: 13, seconds: 0.95 },
  respawn: { db: -12, notes: [67, 72, 79] },
  "arrival-shimmer": { db: -14, baseNote: 79, stepInterval: 2 },
  "arrival-chime": { db: -13.5, notes: [72, 76, 79, 84, 88] },
  "touchdown-soft": { db: -7, thumpHz: 92, notes: [79, 84] },
  "touchdown-bumpy": { db: -7, thumpHz: 82, notes: [74] },
  "retry-swish": { db: -8, fromHz: 420, toHz: 2400, seconds: 0.38 },
  "result-jingle": { db: -12, notes: [72, 76, 79, 81, 79, 84, 88], stepSeconds: 0.16 },
  "sound-on": { db: -13, notes: [72, 79] },
  "sound-off": { db: -15, notes: [79, 72] },
} as const satisfies Record<SfxCueId, CueTrim>;

export const LOOP_TUNING = {
  thrust: { db: -19, humHz: 55, noiseToneHz: 520, flutterHz: 6.5, flutterDepthHz: 90 },
  stabilizer: { db: -20, hz: 220, beatHz: 0.9, tremoloHz: 3.2 },
} as const satisfies Record<LoopCueId, CueTrim>;
