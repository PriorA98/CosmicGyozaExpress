import type Phaser from "phaser";
import {
  AUDIO_MIX,
  LOOP_CUE_IDS,
  LOOP_TUNING,
  MELODY_SCALE,
  MUSIC_ENGINE,
  MUSIC_MOODS,
  MUSIC_TUNING,
  SFX_CUE_IDS,
  SFX_TUNING,
  createAudioMapperState,
  dbToGain,
  gainToDb,
  mapGameEventToAudio,
  midiToHz,
  sanitizeVolume,
  volumeToGain,
  type AudioAction,
  type AudioMapperState,
  type LoopCueId,
  type MusicMood,
  type SfxCueId,
} from "../data/audioCues";
import { registerDevState } from "../dev/devProbe";
import { onGameEvent, type GameEvent } from "../game/events";
import { SaveSystem } from "./SaveSystem";

/**
 * Synthesized cozy audio (owner: audio-fx package). Contract:
 * - `installAudioSystem(game)` is called exactly once from main.ts.
 * - Subscribes to GameEvents via `onGameEvent`; never required by gameplay code.
 * - Creates/resumes the AudioContext only after a user gesture; degrades silently on any failure.
 * - Reads volumes from save settings; `M` toggles mute.
 *
 * Everything is Web Audio synthesis (no audio files). The node graph is built against
 * `BaseAudioContext`, so the exact same voices render inside an OfflineAudioContext for the
 * dev-only loudness analysis (`window.__CGE__.getState("audio").analyzeCues()`).
 */

export type AudioVolumes = { readonly music: number; readonly sfx: number };

export type CueAnalysis = {
  readonly cue: string;
  readonly peak: number;
  readonly peakDb: number;
  readonly rms: number;
  readonly durationMs: number;
};

export type AudioDevState = {
  readonly contextState: AudioContextState | "uncreated" | "unsupported";
  readonly muted: boolean;
  readonly mood: MusicMood | null;
  readonly volumes: AudioVolumes;
  readonly activeLoops: readonly LoopCueId[];
  readonly lastCues: readonly { readonly cue: string; readonly atMs: number; readonly played: boolean }[];
  readonly analyzeCues: () => Promise<CueAnalysis[]>;
};

type AudioBus = {
  readonly ctx: BaseAudioContext;
  readonly master: GainNode;
  readonly musicTone: BiquadFilterNode;
  readonly musicDuck: GainNode;
  readonly musicVolume: GainNode;
  readonly musicEcho: GainNode;
  readonly sfxIn: GainNode;
  readonly sfxVolume: GainNode;
  readonly sfxEcho: GainNode;
  readonly noise: AudioBuffer;
};

type LoopVoice = { readonly gain: GainNode; readonly sources: readonly AudioScheduledSourceNode[] };

const SAMPLE_RATE = 44100;
const SILENCE = 0.0001;
const TAIL_THRESHOLD = 0.001;
const MAX_LAST_CUES = 24;
const ANALYZE_SFX_SECONDS = 3.5;
const ANALYZE_LOOP_HOLD_SECONDS = 1.2;
const ANALYZE_LOOP_SECONDS = 2;
const ANALYZE_MUSIC_SECONDS = 9;
const CUE_START_OFFSET = 0.02;

// ---------------------------------------------------------------------------------------------
// Bus construction (shared by realtime and offline contexts)
// ---------------------------------------------------------------------------------------------

function createNoiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const seconds = 2;
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let seed = 0x2545f491;
  for (let i = 0; i < data.length; i += 1) {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    data[i] = ((seed >>> 0) / 0xffffffff) * 2 - 1;
  }
  return buffer;
}

function createReverbImpulse(ctx: BaseAudioContext): AudioBuffer {
  const { seconds, decay } = AUDIO_MIX.reverb;
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    let seed = channel === 0 ? 0x9e3779b9 : 0x7f4a7c15;
    for (let i = 0; i < length; i += 1) {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      const white = ((seed >>> 0) / 0xffffffff) * 2 - 1;
      // Soft pre-delay fade-in keeps the tail from smearing transients.
      const fadeIn = Math.min(1, i / (ctx.sampleRate * 0.012));
      data[i] = white * fadeIn * (1 - i / length) ** decay;
    }
  }
  return buffer;
}

function createSoftClipCurve(): Float32Array<ArrayBuffer> {
  // Input is pre-scaled by 0.5, so the curve covers signals up to +6 dBFS before saturating.
  const ceiling = dbToGain(AUDIO_MIX.ceilingDb);
  const size = 2048;
  const curve = new Float32Array(new ArrayBuffer(size * 4));
  for (let i = 0; i < size; i += 1) {
    const x = (i / (size - 1)) * 2 - 1;
    curve[i] = ceiling * Math.tanh((2 * x) / ceiling);
  }
  return curve;
}

function createEcho(ctx: BaseAudioContext, output: AudioNode): GainNode {
  const { delaySeconds, feedback, toneHz } = AUDIO_MIX.echo;
  const send = ctx.createGain();
  const delay = ctx.createDelay(1);
  delay.delayTime.value = delaySeconds;
  const tone = ctx.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = toneHz;
  const loop = ctx.createGain();
  loop.gain.value = feedback;
  send.connect(delay);
  delay.connect(tone);
  tone.connect(loop);
  loop.connect(delay);
  tone.connect(output);
  return send;
}

function createBus(ctx: BaseAudioContext, destination: AudioNode, volumes: AudioVolumes, muted: boolean): AudioBus {
  const master = ctx.createGain();
  master.gain.value = muted ? 0 : dbToGain(AUDIO_MIX.masterTrimDb);

  const glue = ctx.createDynamicsCompressor();
  glue.threshold.value = AUDIO_MIX.compressor.thresholdDb;
  glue.knee.value = AUDIO_MIX.compressor.kneeDb;
  glue.ratio.value = AUDIO_MIX.compressor.ratio;
  glue.attack.value = AUDIO_MIX.compressor.attack;
  glue.release.value = AUDIO_MIX.compressor.release;

  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = AUDIO_MIX.limiter.thresholdDb;
  limiter.knee.value = AUDIO_MIX.limiter.kneeDb;
  limiter.ratio.value = AUDIO_MIX.limiter.ratio;
  limiter.attack.value = AUDIO_MIX.limiter.attack;
  limiter.release.value = AUDIO_MIX.limiter.release;

  const clipDrive = ctx.createGain();
  clipDrive.gain.value = 0.5;
  const clipper = ctx.createWaveShaper();
  clipper.curve = createSoftClipCurve();
  clipper.oversample = "2x";

  master.connect(glue);
  glue.connect(limiter);
  limiter.connect(clipDrive);
  clipDrive.connect(clipper);
  clipper.connect(destination);

  const reverb = ctx.createConvolver();
  reverb.buffer = createReverbImpulse(ctx);
  reverb.connect(master);

  const musicVolume = ctx.createGain();
  musicVolume.gain.value = volumeToGain(volumes.music) * dbToGain(AUDIO_MIX.musicTrimDb);
  musicVolume.connect(master);
  const musicReverb = ctx.createGain();
  musicReverb.gain.value = AUDIO_MIX.reverb.musicSend;
  musicVolume.connect(musicReverb);
  musicReverb.connect(reverb);

  const musicDuck = ctx.createGain();
  musicDuck.connect(musicVolume);
  const musicTone = ctx.createBiquadFilter();
  musicTone.type = "lowpass";
  musicTone.frequency.value = MUSIC_TUNING.title.toneHz;
  musicTone.Q.value = 0.5;
  musicTone.connect(musicDuck);
  const musicEcho = createEcho(ctx, musicTone);

  const sfxVolume = ctx.createGain();
  sfxVolume.gain.value = volumeToGain(volumes.sfx) * dbToGain(AUDIO_MIX.sfxTrimDb);
  sfxVolume.connect(master);
  const sfxReverb = ctx.createGain();
  sfxReverb.gain.value = AUDIO_MIX.reverb.sfxSend;
  sfxVolume.connect(sfxReverb);
  sfxReverb.connect(reverb);
  const sfxIn = ctx.createGain();
  sfxIn.connect(sfxVolume);
  const sfxEcho = createEcho(ctx, sfxIn);

  return { ctx, master, musicTone, musicDuck, musicVolume, musicEcho, sfxIn, sfxVolume, sfxEcho, noise: createNoiseBuffer(ctx) };
}

// ---------------------------------------------------------------------------------------------
// Voice helpers
// ---------------------------------------------------------------------------------------------

type EnvelopeShape = { readonly attack: number; readonly decay: number; readonly peak: number };

function envelope(ctx: BaseAudioContext, t0: number, shape: EnvelopeShape): GainNode {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(shape.peak, t0 + shape.attack);
  gain.gain.exponentialRampToValueAtTime(SILENCE, t0 + shape.attack + shape.decay);
  return gain;
}

function connectAll(node: AudioNode, destinations: readonly AudioNode[]): void {
  for (const destination of destinations) node.connect(destination);
}

function releaseOnEnd(source: AudioScheduledSourceNode, nodes: readonly AudioNode[]): void {
  source.onended = () => {
    for (const node of nodes) node.disconnect();
  };
}

type ToneSpec = {
  readonly type: OscillatorType;
  readonly hz: number;
  readonly toHz?: number;
  readonly glideSeconds?: number;
  readonly detune?: number;
  readonly shape: EnvelopeShape;
};

function playTone(bus: AudioBus, t0: number, spec: ToneSpec, destinations: readonly AudioNode[]): void {
  const { ctx } = bus;
  const osc = ctx.createOscillator();
  osc.type = spec.type;
  osc.frequency.setValueAtTime(spec.hz, t0);
  if (spec.toHz !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(spec.toHz, t0 + (spec.glideSeconds ?? spec.shape.decay));
  }
  if (spec.detune !== undefined) osc.detune.value = spec.detune;
  const env = envelope(ctx, t0, spec.shape);
  osc.connect(env);
  connectAll(env, destinations);
  const end = t0 + spec.shape.attack + spec.shape.decay + 0.05;
  osc.start(t0);
  osc.stop(end);
  releaseOnEnd(osc, [osc, env]);
}

type NoiseSpec = {
  readonly filter: BiquadFilterType;
  readonly fromHz: number;
  readonly toHz: number;
  readonly q: number;
  readonly shape: EnvelopeShape;
};

function playNoise(bus: AudioBus, t0: number, spec: NoiseSpec, destinations: readonly AudioNode[]): void {
  const { ctx } = bus;
  const source = ctx.createBufferSource();
  source.buffer = bus.noise;
  const filter = ctx.createBiquadFilter();
  filter.type = spec.filter;
  filter.Q.value = spec.q;
  const total = spec.shape.attack + spec.shape.decay;
  filter.frequency.setValueAtTime(spec.fromHz, t0);
  filter.frequency.exponentialRampToValueAtTime(spec.toHz, t0 + total);
  const env = envelope(ctx, t0, spec.shape);
  source.connect(filter);
  filter.connect(env);
  connectAll(env, destinations);
  // Random-ish offset into the noise loop so repeated cues do not sound identical.
  const offset = (t0 * 7.31) % 1.5;
  source.start(t0, offset);
  source.stop(t0 + total + 0.05);
  releaseOnEnd(source, [source, filter, env]);
}

/** Soft music-box tine: sine fundamental plus quick upper partials. */
function playMusicBox(bus: AudioBus, t0: number, note: number, peak: number, destinations: readonly AudioNode[]): void {
  const hz = midiToHz(note);
  const decay = MUSIC_ENGINE.melodyDecaySeconds;
  playTone(bus, t0, { type: "sine", hz, shape: { attack: 0.004, decay, peak } }, destinations);
  playTone(bus, t0, { type: "sine", hz: hz * 2, shape: { attack: 0.003, decay: decay * 0.4, peak: peak * 0.22 } }, destinations);
  playTone(bus, t0, { type: "sine", hz: hz * 3.01, shape: { attack: 0.002, decay: 0.18, peak: peak * 0.14 } }, destinations);
}

/** Warm bell with slightly inharmonic partials (chimes, touchdown, arrival). */
function playBell(bus: AudioBus, t0: number, note: number, peak: number, length: number, destinations: readonly AudioNode[]): void {
  const hz = midiToHz(note);
  const partials: readonly (readonly [number, number, number])[] = [
    [1, 1, 1],
    [2, 0.32, 0.6],
    [2.76, 0.18, 0.38],
    [5.4, 0.06, 0.16],
  ];
  for (const [ratio, gain, decayScale] of partials) {
    playTone(bus, t0, { type: "sine", hz: hz * ratio, shape: { attack: 0.003, decay: length * decayScale, peak: peak * gain } }, destinations);
  }
}

function playPluck(bus: AudioBus, t0: number, note: number, peak: number, destinations: readonly AudioNode[]): void {
  const hz = midiToHz(note);
  playTone(bus, t0, { type: "triangle", hz, shape: { attack: 0.004, decay: 0.22, peak } }, destinations);
  playTone(bus, t0, { type: "sine", hz: hz * 2, shape: { attack: 0.003, decay: 0.09, peak: peak * 0.3 } }, destinations);
}

function playThump(bus: AudioBus, t0: number, hz: number, peak: number, destinations: readonly AudioNode[]): void {
  playTone(bus, t0, { type: "sine", hz, toHz: hz * 0.52, glideSeconds: 0.18, shape: { attack: 0.004, decay: 0.32, peak } }, destinations);
  playNoise(bus, t0, { filter: "lowpass", fromHz: 520, toHz: 140, q: 0.7, shape: { attack: 0.003, decay: 0.16, peak: peak * 0.55 } }, destinations);
}

function playBonk(bus: AudioBus, t0: number, fromHz: number, toHz: number, seconds: number, peak: number, destinations: readonly AudioNode[]): void {
  // Wooden block: pitched body that drops a little, a hollow overtone, and a tiny click.
  playTone(bus, t0, { type: "sine", hz: fromHz, toHz, glideSeconds: seconds * 0.5, shape: { attack: 0.003, decay: seconds, peak } }, destinations);
  playTone(bus, t0, { type: "triangle", hz: fromHz * 2.32, toHz: toHz * 2.32, glideSeconds: seconds * 0.3, shape: { attack: 0.002, decay: seconds * 0.35, peak: peak * 0.3 } }, destinations);
  playNoise(bus, t0, { filter: "bandpass", fromHz: 2200, toHz: 1400, q: 2.2, shape: { attack: 0.001, decay: 0.03, peak: peak * 0.5 } }, destinations);
}

// ---------------------------------------------------------------------------------------------
// SFX recipes
// ---------------------------------------------------------------------------------------------

function playSfx(bus: AudioBus, cue: SfxCueId, t0: number, step = 1): void {
  const dry = [bus.sfxIn];
  const wet = [bus.sfxIn, bus.sfxEcho];

  switch (cue) {
    case "ui-hover": {
      const t = SFX_TUNING["ui-hover"];
      playTone(bus, t0, { type: "sine", hz: t.hz, shape: { attack: 0.002, decay: 0.045, peak: dbToGain(t.db) } }, dry);
      return;
    }
    case "ui-confirm": {
      const t = SFX_TUNING["ui-confirm"];
      t.notes.forEach((note, i) => playPluck(bus, t0 + i * 0.07, note, dbToGain(t.db), wet));
      return;
    }
    case "ui-back": {
      const t = SFX_TUNING["ui-back"];
      t.notes.forEach((note, i) => playPluck(bus, t0 + i * 0.08, note, dbToGain(t.db), dry));
      return;
    }
    case "brake-whoosh": {
      const t = SFX_TUNING["brake-whoosh"];
      playNoise(bus, t0, { filter: "bandpass", fromHz: t.fromHz, toHz: t.toHz, q: 1.1, shape: { attack: 0.09, decay: t.seconds, peak: dbToGain(t.db) } }, dry);
      return;
    }
    case "bump-soft": {
      const t = SFX_TUNING["bump-soft"];
      playBonk(bus, t0, t.fromHz, t.toHz, t.seconds, dbToGain(t.db), dry);
      return;
    }
    case "bump-dramatic": {
      const t = SFX_TUNING["bump-dramatic"];
      const peak = dbToGain(t.db);
      playBonk(bus, t0, t.fromHz, t.toHz, t.seconds, peak, dry);
      playBonk(bus, t0 + 0.11, t.fromHz * 1.25, t.toHz * 1.25, t.seconds * 0.6, peak * 0.5, dry);
      playThump(bus, t0, 70, peak * 0.7, dry);
      return;
    }
    case "incident": {
      const t = SFX_TUNING.incident;
      const peak = dbToGain(t.db);
      const { ctx } = bus;
      // Comedic boing: a gliding tone with a vibrato that relaxes as it falls.
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(t.fromHz, t0);
      osc.frequency.exponentialRampToValueAtTime(t.toHz, t0 + t.seconds * 0.8);
      const wobble = ctx.createOscillator();
      wobble.frequency.value = t.wobbleHz;
      const wobbleDepth = ctx.createGain();
      wobbleDepth.gain.setValueAtTime(t.fromHz * 0.18, t0);
      wobbleDepth.gain.exponentialRampToValueAtTime(1, t0 + t.seconds);
      wobble.connect(wobbleDepth);
      wobbleDepth.connect(osc.frequency);
      const env = envelope(ctx, t0, { attack: 0.01, decay: t.seconds, peak: peak * 0.8 });
      osc.connect(env);
      connectAll(env, wet);
      osc.start(t0);
      wobble.start(t0);
      osc.stop(t0 + t.seconds + 0.1);
      wobble.stop(t0 + t.seconds + 0.1);
      releaseOnEnd(osc, [osc, wobble, wobbleDepth, env]);
      // Puff of flour.
      playNoise(bus, t0 + 0.05, { filter: "lowpass", fromHz: 1600, toHz: 220, q: 0.6, shape: { attack: 0.03, decay: 0.5, peak: peak * 0.6 } }, dry);
      playThump(bus, t0, 110, peak * 0.6, dry);
      return;
    }
    case "respawn": {
      const t = SFX_TUNING.respawn;
      t.notes.forEach((note, i) => playPluck(bus, t0 + i * 0.075, note, dbToGain(t.db), wet));
      playNoise(bus, t0, { filter: "bandpass", fromHz: 600, toHz: 1800, q: 0.9, shape: { attack: 0.06, decay: 0.25, peak: dbToGain(t.db) * 0.4 } }, dry);
      return;
    }
    case "arrival-shimmer": {
      const t = SFX_TUNING["arrival-shimmer"];
      const base = Math.max(0, Math.min(MELODY_SCALE.length - 3, (step - 1) * (t.stepInterval - 1)));
      for (let i = 0; i < 3; i += 1) {
        const note = MELODY_SCALE[base + i] ?? t.baseNote;
        playBell(bus, t0 + i * 0.05, note, dbToGain(t.db) * (1 - i * 0.2), 0.7, wet);
      }
      return;
    }
    case "arrival-chime": {
      const t = SFX_TUNING["arrival-chime"];
      t.notes.forEach((note, i) => playBell(bus, t0 + i * 0.09, note, dbToGain(t.db), 1.8, wet));
      return;
    }
    case "touchdown-soft": {
      const t = SFX_TUNING["touchdown-soft"];
      playThump(bus, t0, t.thumpHz, dbToGain(t.db), dry);
      t.notes.forEach((note, i) => playBell(bus, t0 + 0.1 + i * 0.11, note, dbToGain(t.db) * 0.55, 1.6, wet));
      return;
    }
    case "touchdown-bumpy": {
      const t = SFX_TUNING["touchdown-bumpy"];
      playThump(bus, t0, t.thumpHz, dbToGain(t.db), dry);
      playThump(bus, t0 + 0.14, t.thumpHz * 1.15, dbToGain(t.db) * 0.6, dry);
      t.notes.forEach((note) => playBell(bus, t0 + 0.32, note, dbToGain(t.db) * 0.45, 1.2, wet));
      return;
    }
    case "retry-swish": {
      const t = SFX_TUNING["retry-swish"];
      playNoise(bus, t0, { filter: "bandpass", fromHz: t.fromHz, toHz: t.toHz, q: 1.3, shape: { attack: t.seconds * 0.6, decay: t.seconds * 0.6, peak: dbToGain(t.db) } }, dry);
      playTone(bus, t0 + 0.05, { type: "sine", hz: midiToHz(67), toHz: midiToHz(79), glideSeconds: t.seconds, shape: { attack: 0.05, decay: t.seconds, peak: dbToGain(t.db) * 0.35 } }, wet);
      return;
    }
    case "result-jingle": {
      const t = SFX_TUNING["result-jingle"];
      const peak = dbToGain(t.db);
      t.notes.forEach((note, i) => {
        const last = i === t.notes.length - 1;
        playMusicBox(bus, t0 + i * t.stepSeconds, note, last ? peak * 1.1 : peak, wet);
      });
      playBell(bus, t0 + t.notes.length * t.stepSeconds, 60, peak * 0.35, 2.4, wet);
      return;
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Loops (thrust, stabilizer)
// ---------------------------------------------------------------------------------------------

function createLoop(bus: AudioBus, loop: LoopCueId): LoopVoice {
  const { ctx } = bus;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.connect(bus.sfxIn);
  const sources: AudioScheduledSourceNode[] = [];

  if (loop === "thrust") {
    const t = LOOP_TUNING.thrust;
    const noise = ctx.createBufferSource();
    noise.buffer = bus.noise;
    noise.loop = true;
    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = t.noiseToneHz;
    tone.Q.value = 0.8;
    const flutter = ctx.createOscillator();
    flutter.frequency.value = t.flutterHz;
    const flutterDepth = ctx.createGain();
    flutterDepth.gain.value = t.flutterDepthHz;
    flutter.connect(flutterDepth);
    flutterDepth.connect(tone.frequency);
    const noiseLevel = ctx.createGain();
    noiseLevel.gain.value = 0.75;
    noise.connect(tone);
    tone.connect(noiseLevel);
    noiseLevel.connect(gain);

    const hum = ctx.createOscillator();
    hum.type = "sine";
    hum.frequency.value = t.humHz;
    const humLevel = ctx.createGain();
    humLevel.gain.value = 0.45;
    hum.connect(humLevel);
    humLevel.connect(gain);

    const purr = ctx.createOscillator();
    purr.type = "triangle";
    purr.frequency.value = t.humHz * 2;
    const purrLevel = ctx.createGain();
    purrLevel.gain.value = 0.1;
    purr.connect(purrLevel);
    purrLevel.connect(gain);
    sources.push(noise, flutter, hum, purr);
  } else {
    const t = LOOP_TUNING.stabilizer;
    const tremolo = ctx.createGain();
    tremolo.gain.value = 0.7;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = t.tremoloHz;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.25;
    lfo.connect(lfoDepth);
    lfoDepth.connect(tremolo.gain);
    tremolo.connect(gain);
    const partials: readonly (readonly [number, number])[] = [
      [t.hz, 0.5],
      [t.hz + t.beatHz, 0.5],
      [t.hz * 1.5, 0.18],
      [t.hz * 2, 0.08],
    ];
    for (const [hz, level] of partials) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = hz;
      const oscLevel = ctx.createGain();
      oscLevel.gain.value = level;
      osc.connect(oscLevel);
      oscLevel.connect(tremolo);
      sources.push(osc);
    }
    sources.push(lfo);
  }

  for (const source of sources) source.start();
  return { gain, sources };
}

function setLoopLevel(voice: LoopVoice, loop: LoopCueId, active: boolean, at: number): void {
  const target = active ? dbToGain(LOOP_TUNING[loop].db) : 0;
  const constant = active ? AUDIO_MIX.loopAttackSeconds : AUDIO_MIX.loopReleaseSeconds;
  voice.gain.gain.cancelScheduledValues(at);
  voice.gain.gain.setTargetAtTime(target, at, constant / 3);
}

// ---------------------------------------------------------------------------------------------
// Generative lullaby
// ---------------------------------------------------------------------------------------------

class MusicPlayer {
  private mood: MusicMood;
  private pendingMood: MusicMood | null = null;
  private step = 0;
  private bar = 0;
  private nextStepTime: number;
  private melodyIndex = 3;
  private seed: number = MUSIC_ENGINE.melodySeed;

  constructor(
    private readonly bus: AudioBus,
    mood: MusicMood,
    startAt: number,
  ) {
    this.mood = mood;
    this.nextStepTime = startAt;
    this.applyTone(startAt, true);
  }

  get currentMood(): MusicMood {
    return this.pendingMood ?? this.mood;
  }

  setMood(mood: MusicMood): void {
    if (mood === this.mood) {
      this.pendingMood = null;
      return;
    }
    this.pendingMood = mood;
  }

  /** Books every step that starts before `until` (seconds, context time). */
  scheduleUntil(until: number): void {
    const now = this.bus.ctx.currentTime;
    if (this.nextStepTime < now - 0.05) {
      // The tab was throttled; skip missed notes instead of bursting them all at once.
      this.nextStepTime = now + 0.05;
      this.step = 0;
    }
    while (this.nextStepTime < until) {
      this.scheduleStep(this.nextStepTime);
      this.nextStepTime += this.stepSeconds();
      this.step = (this.step + 1) % MUSIC_ENGINE.stepsPerBar;
    }
  }

  private stepSeconds(): number {
    return 60 / MUSIC_TUNING[this.mood].bpm / 2;
  }

  private random(): number {
    // xorshift32: deterministic, independent of Math.random seeding.
    let x = this.seed;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.seed = x >>> 0;
    return this.seed / 0xffffffff;
  }

  private applyTone(at: number, immediate = false): void {
    const hz = MUSIC_TUNING[this.mood].toneHz;
    if (immediate) this.bus.musicTone.frequency.setValueAtTime(hz, at);
    else this.bus.musicTone.frequency.setTargetAtTime(hz, at, 1.2);
  }

  private scheduleStep(t: number): void {
    if (this.step === 0) {
      if (this.pendingMood) {
        this.mood = this.pendingMood;
        this.pendingMood = null;
        this.bar = 0;
        this.applyTone(t);
      }
      this.scheduleBar(t);
    }

    const tuning = MUSIC_TUNING[this.mood];
    const bus = this.bus;
    const music = [bus.musicTone];

    if (tuning.tickDb !== null && this.step % 2 === 0) {
      const accent = this.step === 0 ? 1 : 0.6;
      playNoise(bus, t, { filter: "highpass", fromHz: 5200, toHz: 4800, q: 0.7, shape: { attack: 0.002, decay: 0.04, peak: dbToGain(tuning.tickDb) * accent } }, music);
    }

    // Breathe: the last two steps of every second bar rest.
    const phraseRest = this.bar % 2 === 1 && this.step >= MUSIC_ENGINE.stepsPerBar - 2;
    const weight = this.step % 4 === 0 ? 1.25 : this.step % 2 === 0 ? 0.95 : 0.7;
    if (!phraseRest && this.random() < tuning.melodyDensity * weight) {
      const move = Math.floor(this.random() * 5) - 2;
      this.melodyIndex = Math.max(0, Math.min(MELODY_SCALE.length - 1, this.melodyIndex + (move === 0 ? 1 : move)));
      const note = MELODY_SCALE[this.melodyIndex] ?? MELODY_SCALE[0] ?? 72;
      const velocity = 0.75 + this.random() * 0.25;
      playMusicBox(bus, t + this.random() * 0.012, note, dbToGain(tuning.melodyDb) * velocity, [bus.musicTone, bus.musicEcho]);
    }
  }

  private scheduleBar(t: number): void {
    const tuning = MUSIC_TUNING[this.mood];
    const chord = tuning.progression[this.bar % tuning.progression.length];
    this.bar += 1;
    if (!chord) return;
    const bus = this.bus;
    const { ctx } = bus;
    const barSeconds = this.stepSeconds() * MUSIC_ENGINE.stepsPerBar;
    const padPeak = dbToGain(tuning.padDb);

    for (const note of chord.pad) {
      const hz = midiToHz(note);
      const voiceTone = ctx.createBiquadFilter();
      voiceTone.type = "lowpass";
      voiceTone.frequency.value = MUSIC_ENGINE.padVoiceToneHz;
      const env = ctx.createGain();
      const holdUntil = t + barSeconds;
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(padPeak, t + MUSIC_ENGINE.padAttackSeconds);
      env.gain.setValueAtTime(padPeak, holdUntil);
      env.gain.exponentialRampToValueAtTime(SILENCE, holdUntil + MUSIC_ENGINE.padReleaseSeconds);
      voiceTone.connect(env);
      env.connect(bus.musicTone);
      const end = holdUntil + MUSIC_ENGINE.padReleaseSeconds + 0.05;
      const nodes: AudioNode[] = [voiceTone, env];
      for (const [type, cents] of [
        ["sawtooth", -MUSIC_ENGINE.padDetuneCents],
        ["triangle", MUSIC_ENGINE.padDetuneCents],
      ] as const) {
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.value = hz;
        osc.detune.value = cents;
        osc.connect(voiceTone);
        osc.start(t);
        osc.stop(end);
        nodes.push(osc);
        releaseOnEnd(osc, [osc]);
      }
      const cleanup = nodes[nodes.length - 1];
      if (cleanup instanceof OscillatorNode) releaseOnEnd(cleanup, nodes);
    }

    const bassPeak = dbToGain(tuning.bassDb);
    playTone(bus, t, { type: "sine", hz: midiToHz(chord.root), shape: { attack: 0.06, decay: MUSIC_ENGINE.bassDecaySeconds, peak: bassPeak } }, [bus.musicTone]);
    playTone(bus, t, { type: "triangle", hz: midiToHz(chord.root + 12), shape: { attack: 0.05, decay: MUSIC_ENGINE.bassDecaySeconds * 0.5, peak: bassPeak * 0.25 } }, [bus.musicTone]);
  }
}

// ---------------------------------------------------------------------------------------------
// Offline analysis (dev): render every cue and measure loudness without ears
// ---------------------------------------------------------------------------------------------

async function renderOffline(seconds: number, play: (bus: AudioBus) => void): Promise<Omit<CueAnalysis, "cue">> {
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * SAMPLE_RATE), SAMPLE_RATE);
  const bus = createBus(ctx, ctx.destination, { music: 1, sfx: 1 }, false);
  play(bus);
  const buffer = await ctx.startRendering();
  let peak = 0;
  let sumSquares = 0;
  let lastLoud = 0;
  let samples = 0;
  let invalid = false;
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i += 1) {
      const value = data[i] ?? 0;
      if (!Number.isFinite(value)) {
        invalid = true;
        continue;
      }
      const magnitude = Math.abs(value);
      if (magnitude > peak) peak = magnitude;
      if (magnitude > TAIL_THRESHOLD && i > lastLoud) lastLoud = i;
      sumSquares += value * value;
      samples += 1;
    }
  }
  const rms = samples > 0 ? Math.sqrt(sumSquares / samples) : 0;
  return {
    peak: invalid ? Number.NaN : peak,
    peakDb: invalid ? Number.NaN : gainToDb(peak),
    rms,
    durationMs: Math.round((lastLoud / SAMPLE_RATE) * 1000),
  };
}

async function analyzeAllCues(): Promise<CueAnalysis[]> {
  if (typeof OfflineAudioContext === "undefined") return [];
  const results: CueAnalysis[] = [];
  for (const cue of SFX_CUE_IDS) {
    const analysis = await renderOffline(ANALYZE_SFX_SECONDS, (bus) => playSfx(bus, cue, CUE_START_OFFSET, 4));
    results.push({ cue, ...analysis });
  }
  for (const loop of LOOP_CUE_IDS) {
    const analysis = await renderOffline(ANALYZE_LOOP_SECONDS, (bus) => {
      const voice = createLoop(bus, loop);
      setLoopLevel(voice, loop, true, CUE_START_OFFSET);
      setLoopLevel(voice, loop, false, ANALYZE_LOOP_HOLD_SECONDS);
      for (const source of voice.sources) source.stop(ANALYZE_LOOP_SECONDS);
    });
    results.push({ cue: `loop:${loop}`, ...analysis });
  }
  for (const mood of MUSIC_MOODS) {
    const analysis = await renderOffline(ANALYZE_MUSIC_SECONDS, (bus) => {
      const player = new MusicPlayer(bus, mood, CUE_START_OFFSET);
      player.scheduleUntil(ANALYZE_MUSIC_SECONDS - MUSIC_ENGINE.padReleaseSeconds);
    });
    results.push({ cue: `music:${mood}`, ...analysis });
  }
  // Worst case: everything loud at once over the result music.
  const stacked = await renderOffline(ANALYZE_SFX_SECONDS, (bus) => {
    const player = new MusicPlayer(bus, "result", CUE_START_OFFSET);
    player.scheduleUntil(ANALYZE_SFX_SECONDS);
    const thrust = createLoop(bus, "thrust");
    setLoopLevel(thrust, "thrust", true, CUE_START_OFFSET);
    for (const source of thrust.sources) source.stop(ANALYZE_SFX_SECONDS);
    playSfx(bus, "bump-dramatic", 0.1);
    playSfx(bus, "incident", 0.12);
    playSfx(bus, "touchdown-soft", 0.15);
    playSfx(bus, "arrival-chime", 0.2);
  });
  results.push({ cue: "stack:worst-case", ...stacked });
  return results;
}

// ---------------------------------------------------------------------------------------------
// Realtime engine
// ---------------------------------------------------------------------------------------------

type WindowWithWebkitAudio = Window & { readonly webkitAudioContext?: typeof AudioContext };

class AudioEngine {
  private ctx: AudioContext | null = null;
  private bus: AudioBus | null = null;
  private music: MusicPlayer | null = null;
  private schedulerId: number | null = null;
  private unsupported = false;
  private muted = false;
  private volumes: AudioVolumes = { music: AUDIO_MIX.defaultMusicVolume, sfx: AUDIO_MIX.defaultSfxVolume };
  private desiredMood: MusicMood | null = null;
  private readonly desiredLoops = new Map<LoopCueId, boolean>();
  private readonly loops = new Map<LoopCueId, LoopVoice>();
  private mapperState: AudioMapperState = createAudioMapperState();
  private readonly lastCues: { cue: string; atMs: number; played: boolean }[] = [];

  handleEvent(event: GameEvent): void {
    try {
      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      const result = mapGameEventToAudio(event, this.mapperState, now);
      this.mapperState = result.state;
      for (const action of result.actions) this.perform(action, now);
    } catch {
      // Audio must never break gameplay.
    }
  }

  /** Called on every user gesture: creates or resumes the context. */
  unlock(): void {
    try {
      if (this.unsupported) return;
      if (!this.ctx) this.createContext();
      const ctx = this.ctx;
      if (ctx && ctx.state === "suspended" && !document.hidden) void ctx.resume().catch(() => undefined);
    } catch {
      this.unsupported = true;
    }
  }

  toggleMute(): void {
    this.muted = !this.muted;
    this.applyMaster();
    if (!this.muted) this.perform({ kind: "sfx", cue: "ui-hover" }, performance.now());
  }

  onVisibilityChange(hidden: boolean): void {
    const ctx = this.ctx;
    if (!ctx) return;
    try {
      if (hidden && ctx.state === "running") void ctx.suspend().catch(() => undefined);
      else if (!hidden && ctx.state === "suspended") void ctx.resume().catch(() => undefined);
    } catch {
      // ignore
    }
  }

  devState(): AudioDevState {
    const contextState: AudioDevState["contextState"] = this.unsupported ? "unsupported" : (this.ctx?.state ?? "uncreated");
    return {
      contextState,
      muted: this.muted,
      mood: this.music?.currentMood ?? this.desiredMood,
      volumes: this.volumes,
      activeLoops: [...this.desiredLoops.entries()].filter(([, active]) => active).map(([loop]) => loop),
      lastCues: this.lastCues.slice(),
      analyzeCues: analyzeAllCues,
    };
  }

  private perform(action: AudioAction, nowMs: number): void {
    switch (action.kind) {
      case "sfx":
        this.recordCue(action.cue, nowMs, this.playSfxNow(action.cue, action.step));
        return;
      case "loop":
        if ((this.desiredLoops.get(action.loop) ?? false) !== action.active) {
          this.recordCue(`loop:${action.loop}:${action.active ? "on" : "off"}`, nowMs, this.isRunning());
        }
        this.desiredLoops.set(action.loop, action.active);
        this.applyLoop(action.loop);
        return;
      case "music":
        if (this.desiredMood !== action.mood) this.recordCue(`music:${action.mood}`, nowMs, this.isRunning());
        this.desiredMood = action.mood;
        this.applyMusic();
        return;
      case "duck-music":
        this.duckMusic(action.durationMs);
        return;
      case "reload-settings":
        this.loadVolumes();
        this.applyVolumes();
        return;
    }
  }

  private recordCue(cue: string, atMs: number, played: boolean): void {
    this.lastCues.push({ cue, atMs, played });
    if (this.lastCues.length > MAX_LAST_CUES) this.lastCues.splice(0, this.lastCues.length - MAX_LAST_CUES);
  }

  private isRunning(): boolean {
    return this.ctx?.state === "running" && this.bus !== null;
  }

  private createContext(): void {
    const scope = window as WindowWithWebkitAudio;
    const Ctor = window.AudioContext ?? scope.webkitAudioContext;
    if (!Ctor) {
      this.unsupported = true;
      return;
    }
    this.loadVolumes();
    const ctx = new Ctor({ latencyHint: "interactive" });
    this.ctx = ctx;
    this.bus = createBus(ctx, ctx.destination, this.volumes, this.muted);
    ctx.onstatechange = () => {
      if (ctx.state === "running") {
        this.applyMusic();
        for (const loop of LOOP_CUE_IDS) this.applyLoop(loop);
      }
    };
    this.schedulerId = window.setInterval(() => this.tick(), MUSIC_ENGINE.tickMs);
    this.applyMusic();
  }

  private tick(): void {
    try {
      const ctx = this.ctx;
      if (!ctx || ctx.state !== "running" || !this.music) return;
      this.music.scheduleUntil(ctx.currentTime + MUSIC_ENGINE.lookaheadSeconds);
    } catch {
      this.stopScheduler();
    }
  }

  private stopScheduler(): void {
    if (this.schedulerId !== null) window.clearInterval(this.schedulerId);
    this.schedulerId = null;
  }

  private playSfxNow(cue: SfxCueId, step: number | undefined): boolean {
    const ctx = this.ctx;
    const bus = this.bus;
    if (!ctx || !bus || ctx.state !== "running" || this.muted) return false;
    try {
      playSfx(bus, cue, ctx.currentTime + 0.005, step);
      return true;
    } catch {
      return false;
    }
  }

  private applyLoop(loop: LoopCueId): void {
    const ctx = this.ctx;
    const bus = this.bus;
    if (!ctx || !bus || ctx.state !== "running") return;
    try {
      const active = this.desiredLoops.get(loop) ?? false;
      let voice = this.loops.get(loop);
      if (!voice) {
        if (!active) return;
        voice = createLoop(bus, loop);
        this.loops.set(loop, voice);
      }
      setLoopLevel(voice, loop, active, ctx.currentTime);
    } catch {
      // ignore
    }
  }

  private applyMusic(): void {
    const ctx = this.ctx;
    const bus = this.bus;
    if (!ctx || !bus || !this.desiredMood) return;
    try {
      if (!this.music) this.music = new MusicPlayer(bus, this.desiredMood, ctx.currentTime + 0.1);
      else this.music.setMood(this.desiredMood);
    } catch {
      this.music = null;
    }
  }

  private duckMusic(durationMs: number): void {
    const ctx = this.ctx;
    const bus = this.bus;
    if (!ctx || !bus) return;
    const now = ctx.currentTime;
    const gain = bus.musicDuck.gain;
    gain.cancelScheduledValues(now);
    gain.setTargetAtTime(dbToGain(AUDIO_MIX.duckDb), now, AUDIO_MIX.duckAttackSeconds / 3);
    gain.setTargetAtTime(1, now + durationMs / 1000, AUDIO_MIX.duckReleaseSeconds / 3);
  }

  private loadVolumes(): void {
    try {
      const settings = SaveSystem.load().settings;
      this.volumes = {
        music: sanitizeVolume(settings?.musicVolume, AUDIO_MIX.defaultMusicVolume),
        sfx: sanitizeVolume(settings?.sfxVolume, AUDIO_MIX.defaultSfxVolume),
      };
    } catch {
      this.volumes = { music: AUDIO_MIX.defaultMusicVolume, sfx: AUDIO_MIX.defaultSfxVolume };
    }
  }

  private applyVolumes(): void {
    const ctx = this.ctx;
    const bus = this.bus;
    if (!ctx || !bus) return;
    const ramp = AUDIO_MIX.volumeRampSeconds / 3;
    bus.musicVolume.gain.setTargetAtTime(volumeToGain(this.volumes.music) * dbToGain(AUDIO_MIX.musicTrimDb), ctx.currentTime, ramp);
    bus.sfxVolume.gain.setTargetAtTime(volumeToGain(this.volumes.sfx) * dbToGain(AUDIO_MIX.sfxTrimDb), ctx.currentTime, ramp);
  }

  private applyMaster(): void {
    const ctx = this.ctx;
    const bus = this.bus;
    if (!ctx || !bus) return;
    const target = this.muted ? 0 : dbToGain(AUDIO_MIX.masterTrimDb);
    bus.master.gain.cancelScheduledValues(ctx.currentTime);
    bus.master.gain.setTargetAtTime(target, ctx.currentTime, AUDIO_MIX.muteRampSeconds / 3);
  }

  destroy(): void {
    this.stopScheduler();
    const ctx = this.ctx;
    this.ctx = null;
    this.bus = null;
    this.music = null;
    this.loops.clear();
    if (ctx) void ctx.close().catch(() => undefined);
  }
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";
}

const installedGames = new WeakSet<Phaser.Game>();

export function installAudioSystem(game: Phaser.Game): void {
  if (installedGames.has(game) || typeof window === "undefined") return;
  installedGames.add(game);

  const engine = new AudioEngine();
  const unsubscribe = onGameEvent(game, (event) => engine.handleEvent(event));

  const onGesture = (): void => engine.unlock();
  const onKeyDown = (event: KeyboardEvent): void => {
    engine.unlock();
    if (event.code === "KeyM" && !event.repeat && !isTypingTarget(event.target)) engine.toggleMute();
  };
  const onVisibility = (): void => engine.onVisibilityChange(document.hidden);
  const listenerOptions: AddEventListenerOptions = { capture: true, passive: true };

  try {
    window.addEventListener("pointerdown", onGesture, listenerOptions);
    window.addEventListener("touchend", onGesture, listenerOptions);
    window.addEventListener("keydown", onKeyDown, listenerOptions);
    document.addEventListener("visibilitychange", onVisibility);
  } catch {
    // No DOM events: stay silent.
  }

  game.events.once("destroy", () => {
    unsubscribe();
    window.removeEventListener("pointerdown", onGesture, listenerOptions);
    window.removeEventListener("touchend", onGesture, listenerOptions);
    window.removeEventListener("keydown", onKeyDown, listenerOptions);
    document.removeEventListener("visibilitychange", onVisibility);
    engine.destroy();
  });

  registerDevState("audio", () => engine.devState());
}
