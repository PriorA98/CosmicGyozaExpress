import { describe, expect, it } from "vitest";
import { AUDIO_MIX, LOOP_TUNING, MUSIC_ENGINE, MUSIC_TUNING, SFX_TUNING, mapGameEventToAudio, createAudioMapperState } from "../src/data/audioCues";

describe("wave-2 mix balance", () => {
  it("keeps the thrust loop trimmed under the music bed and soft bumps audible", () => {
    expect(LOOP_TUNING.thrust.db).toBeLessThanOrEqual(-18);
    // Round 3: the scrape sits a clear step under the dramatic bump but stays above the bed
    // (analyzeCues peak -12.5 dBFS vs music peaks -10 to -14 dBFS).
    expect(SFX_TUNING["bump-soft"].db).toBeGreaterThanOrEqual(-6);
    expect(AUDIO_MIX.loopDuck.db).toBeLessThan(0);
  });

  it("keeps rewards within ~12 dB of feedback cues", () => {
    expect(SFX_TUNING["result-jingle"].db - SFX_TUNING["bump-soft"].db).toBeGreaterThanOrEqual(-12);
    expect(SFX_TUNING["arrival-chime"].db).toBeLessThan(-12);
  });

  it("switches moods within half a second instead of waiting for the bar line", () => {
    const slowestStep = 60 / Math.min(...Object.values(MUSIC_TUNING).map((mood) => mood.bpm)) / 2;
    const worstLatency = MUSIC_ENGINE.lookaheadSeconds + MUSIC_ENGINE.tickMs / 1000 + slowestStep;
    expect(MUSIC_ENGINE.lookaheadSeconds + MUSIC_ENGINE.tickMs / 1000).toBeLessThanOrEqual(0.5);
    expect(worstLatency).toBeLessThan(1);
    expect(MUSIC_ENGINE.moodCrossfade.releaseSeconds).toBeLessThanOrEqual(0.6);
    expect(MUSIC_ENGINE.moodCrossfade.attackSeconds).toBeLessThan(MUSIC_ENGINE.padAttackSeconds);
  });

  it("never echoes audio:mute back as an action (AudioSystem plays the cue itself)", () => {
    const result = mapGameEventToAudio({ type: "audio:mute", muted: true }, createAudioMapperState(), 0);
    expect(result.actions).toEqual([]);
  });
});
