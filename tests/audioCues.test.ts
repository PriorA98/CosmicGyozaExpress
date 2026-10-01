import { describe, expect, it } from "vitest";
import {
  AUDIO_MAPPING,
  AUDIO_MIX,
  LOOP_CUE_IDS,
  LOOP_TUNING,
  MELODY_SCALE,
  MUSIC_MOODS,
  MUSIC_TUNING,
  SFX_CUE_IDS,
  SFX_TUNING,
  arrivalStepFor,
  createAudioMapperState,
  dbToGain,
  gainToDb,
  mapGameEventToAudio,
  midiToHz,
  sanitizeVolume,
  volumeToGain,
  type AudioAction,
  type AudioMapperState,
} from "../src/data/audioCues";
import type { GameEvent } from "../src/game/events";

const fresh = (): AudioMapperState => createAudioMapperState();

function actionsFor(event: GameEvent, state: AudioMapperState = fresh(), nowMs = 1000): readonly AudioAction[] {
  return mapGameEventToAudio(event, state, nowMs).actions;
}

function sfxCues(actions: readonly AudioAction[]): string[] {
  return actions.flatMap((action) => (action.kind === "sfx" ? [action.cue] : []));
}

function loopStates(actions: readonly AudioAction[]): Record<string, boolean> {
  const states: Record<string, boolean> = {};
  for (const action of actions) if (action.kind === "loop") states[action.loop] = action.active;
  return states;
}

const EVERY_EVENT: readonly GameEvent[] = [
  { type: "scene:enter", scene: "TitleScene" },
  { type: "ui:confirm" },
  { type: "ui:hover" },
  { type: "ui:back" },
  { type: "flight:thrust", active: true },
  { type: "flight:brake", active: true },
  { type: "flight:bump", severity: "soft-bump", x: 0, y: 0 },
  { type: "flight:respawn" },
  { type: "flight:arrival-progress", progress: 0.5 },
  { type: "flight:arrival-complete" },
  { type: "landing:thrust", active: true },
  { type: "landing:stabilizer", active: true },
  { type: "landing:touchdown", result: "soft", x: 0, y: 0 },
  { type: "landing:incident", incident: "hard-drop", x: 0, y: 0 },
  { type: "landing:retry" },
  { type: "result:shown", landingResult: "soft" },
  { type: "settings:changed" },
  { type: "mission:start", missionId: "tea-moon" },
  { type: "mission:completed", missionId: "tea-moon" },
];

describe("mapGameEventToAudio", () => {
  it("handles every GameEvent without mutating the input state", () => {
    const state = fresh();
    const snapshot = { ...state };
    for (const event of EVERY_EVENT) {
      const result = mapGameEventToAudio(event, state, 5000);
      expect(Array.isArray(result.actions)).toBe(true);
    }
    expect(state).toEqual(snapshot);
  });

  it("sets the music mood per scene and silences held loops on scene change", () => {
    const title = actionsFor({ type: "scene:enter", scene: "TitleScene" });
    expect(title).toContainEqual({ kind: "music", mood: "title" });
    expect(loopStates(title)).toEqual({ thrust: false, stabilizer: false });
    expect(actionsFor({ type: "scene:enter", scene: "FlightScene" })).toContainEqual({ kind: "music", mood: "flight" });
    expect(actionsFor({ type: "scene:enter", scene: "LandingScene" })).toContainEqual({ kind: "music", mood: "landing" });
    expect(actionsFor({ type: "scene:enter", scene: "DeliveryResultScene" })).toContainEqual({ kind: "music", mood: "result" });
  });

  it("follows held thrust and stabilizer states for both flight and landing", () => {
    expect(loopStates(actionsFor({ type: "flight:thrust", active: true }))).toEqual({ thrust: true });
    expect(loopStates(actionsFor({ type: "flight:thrust", active: false }))).toEqual({ thrust: false });
    expect(loopStates(actionsFor({ type: "landing:thrust", active: true }))).toEqual({ thrust: true });
    expect(loopStates(actionsFor({ type: "landing:stabilizer", active: true }))).toEqual({ stabilizer: true });
    expect(loopStates(actionsFor({ type: "landing:stabilizer", active: false }))).toEqual({ stabilizer: false });
  });

  it("plays the brake whoosh only when braking starts", () => {
    expect(sfxCues(actionsFor({ type: "flight:brake", active: true }))).toEqual(["brake-whoosh"]);
    expect(actionsFor({ type: "flight:brake", active: false })).toEqual([]);
  });

  it("maps bump severities to soft, dramatic, and incident cues", () => {
    expect(sfxCues(actionsFor({ type: "flight:bump", severity: "soft-bump", x: 0, y: 0 }))).toEqual(["bump-soft"]);
    expect(sfxCues(actionsFor({ type: "flight:bump", severity: "dramatic-bump", x: 0, y: 0 }))).toEqual(["bump-dramatic"]);
    const incident = actionsFor({ type: "flight:bump", severity: "gyoza-incident", x: 0, y: 0 });
    expect(sfxCues(incident)).toEqual(["incident"]);
    expect(loopStates(incident)).toEqual({ thrust: false, stabilizer: false });
  });

  it("maps touchdown results and stops loops", () => {
    const soft = actionsFor({ type: "landing:touchdown", result: "soft", x: 0, y: 0 });
    expect(sfxCues(soft)).toEqual(["touchdown-soft"]);
    expect(loopStates(soft)).toEqual({ thrust: false, stabilizer: false });
    expect(sfxCues(actionsFor({ type: "landing:touchdown", result: "bumpy", x: 0, y: 0 }))).toEqual(["touchdown-bumpy"]);
    // The incident cue comes from landing:incident, so touchdown "incident" never doubles it.
    expect(sfxCues(actionsFor({ type: "landing:touchdown", result: "incident", x: 0, y: 0 }))).toEqual([]);
    expect(sfxCues(actionsFor({ type: "landing:incident", incident: "hard-drop", x: 0, y: 0 }))).toEqual(["incident"]);
  });

  it("plays retry, arrival, and result cues", () => {
    expect(sfxCues(actionsFor({ type: "landing:retry" }))).toEqual(["retry-swish"]);
    expect(sfxCues(actionsFor({ type: "flight:respawn" }))).toEqual(["respawn"]);
    expect(sfxCues(actionsFor({ type: "flight:arrival-complete" }))).toEqual(["arrival-chime"]);
    const result = actionsFor({ type: "result:shown", landingResult: "soft" });
    expect(result).toContainEqual({ kind: "duck-music", durationMs: AUDIO_MAPPING.resultDuckMs });
    expect(sfxCues(result)).toEqual(["result-jingle"]);
    expect(actionsFor({ type: "settings:changed" })).toEqual([{ kind: "reload-settings" }]);
  });

  it("rises one shimmer step per arrival quarter and never repeats a step", () => {
    let state = fresh();
    const played: number[] = [];
    for (const progress of [0, 0.1, 0.26, 0.3, 0.55, 0.5, 0.8, 1, 1]) {
      const result = mapGameEventToAudio({ type: "flight:arrival-progress", progress }, state, 0);
      state = result.state;
      for (const action of result.actions) if (action.kind === "sfx" && action.cue === "arrival-shimmer") played.push(action.step ?? 0);
    }
    expect(played).toEqual([1, 2, 3, 4]);
  });

  it("resets arrival shimmer when progress leaves the window or the ship respawns", () => {
    let state = mapGameEventToAudio({ type: "flight:arrival-progress", progress: 0.6 }, fresh(), 0).state;
    expect(state.arrivalStep).toBe(2);
    state = mapGameEventToAudio({ type: "flight:arrival-progress", progress: 0 }, state, 0).state;
    expect(state.arrivalStep).toBe(0);
    state = mapGameEventToAudio({ type: "flight:arrival-progress", progress: 0.3 }, state, 0).state;
    state = mapGameEventToAudio({ type: "flight:respawn" }, state, 0).state;
    expect(state.arrivalStep).toBe(0);
  });

  it("rate-limits hover ticks", () => {
    const first = mapGameEventToAudio({ type: "ui:hover" }, fresh(), 1000);
    expect(sfxCues(first.actions)).toEqual(["ui-hover"]);
    const tooSoon = mapGameEventToAudio({ type: "ui:hover" }, first.state, 1000 + AUDIO_MAPPING.hoverMinIntervalMs - 1);
    expect(tooSoon.actions).toEqual([]);
    const later = mapGameEventToAudio({ type: "ui:hover" }, first.state, 1000 + AUDIO_MAPPING.hoverMinIntervalMs);
    expect(sfxCues(later.actions)).toEqual(["ui-hover"]);
  });
});

describe("arrivalStepFor", () => {
  it("clamps and handles non-finite progress", () => {
    expect(arrivalStepFor(Number.NaN)).toBe(0);
    expect(arrivalStepFor(Number.POSITIVE_INFINITY)).toBe(0);
    expect(arrivalStepFor(-1)).toBe(0);
    expect(arrivalStepFor(0.25)).toBe(1);
    expect(arrivalStepFor(5)).toBe(AUDIO_MAPPING.arrivalShimmerSteps);
    expect(arrivalStepFor(0.5, 0)).toBe(0);
  });
});

describe("audio math helpers", () => {
  it("converts between dB and gain", () => {
    expect(dbToGain(0)).toBe(1);
    expect(dbToGain(-6)).toBeCloseTo(0.501, 3);
    expect(gainToDb(dbToGain(-13))).toBeCloseTo(-13, 9);
    expect(gainToDb(0)).toBe(Number.NEGATIVE_INFINITY);
  });

  it("maps MIDI notes to Hz", () => {
    expect(midiToHz(69)).toBe(440);
    expect(midiToHz(81)).toBeCloseTo(880, 9);
    expect(midiToHz(60)).toBeCloseTo(261.626, 2);
  });

  it("sanitizes untrusted saved volumes", () => {
    expect(sanitizeVolume(0.4, 0.7)).toBe(0.4);
    expect(sanitizeVolume(3, 0.7)).toBe(1);
    expect(sanitizeVolume(-2, 0.7)).toBe(0);
    expect(sanitizeVolume(Number.NaN, 0.7)).toBe(0.7);
    expect(sanitizeVolume("loud", 0.7)).toBe(0.7);
    expect(sanitizeVolume(undefined, 0.8)).toBe(0.8);
  });

  it("uses a monotonic perceptual volume curve", () => {
    expect(volumeToGain(0)).toBe(0);
    expect(volumeToGain(1)).toBe(1);
    expect(volumeToGain(0.5)).toBeLessThan(0.5);
    expect(volumeToGain(2)).toBe(1);
    expect(volumeToGain(-1)).toBe(0);
  });
});

describe("audio tuning data", () => {
  it("keeps the mix ceiling at or below -1 dBFS and every trim below unity", () => {
    expect(AUDIO_MIX.ceilingDb).toBeLessThanOrEqual(-1);
    for (const cue of SFX_CUE_IDS) expect(SFX_TUNING[cue].db).toBeLessThan(0);
    for (const loop of LOOP_CUE_IDS) expect(LOOP_TUNING[loop].db).toBeLessThan(0);
    expect(AUDIO_MIX.musicTrimDb).toBeLessThan(0);
    expect(AUDIO_MIX.sfxTrimDb).toBeLessThan(0);
  });

  it("defines a playable lullaby for every mood", () => {
    for (const mood of MUSIC_MOODS) {
      const tuning = MUSIC_TUNING[mood];
      expect(tuning.progression.length).toBeGreaterThan(0);
      expect(tuning.bpm).toBeGreaterThanOrEqual(50);
      expect(tuning.bpm).toBeLessThanOrEqual(80);
      expect(tuning.melodyDensity).toBeGreaterThan(0);
      expect(tuning.melodyDensity).toBeLessThanOrEqual(1);
      for (const chord of tuning.progression) expect(chord.pad.length).toBeGreaterThan(0);
    }
    // Result is the warm resolution: brightest and fullest; flight is the sleepiest.
    expect(MUSIC_TUNING.result.toneHz).toBeGreaterThan(MUSIC_TUNING.flight.toneHz);
    expect(MUSIC_TUNING.flight.bpm).toBeLessThanOrEqual(MUSIC_TUNING.landing.bpm);
    expect(MELODY_SCALE.length).toBeGreaterThan(3);
  });
});
