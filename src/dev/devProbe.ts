import Phaser from "phaser";
import { onGameEvent, type GameEvent } from "../game/events";
import { SHOWCASE_STATES, type ShowcaseStateDefinition } from "./showcaseStates";

/**
 * Development-only automation surface (`window.__CGE__`) used by the e2e screenshot harness
 * and playtests. Never installed in production builds.
 */
export type FrameSample = {
  readonly frames: number;
  readonly durationMs: number;
  readonly avgFps: number;
  readonly p95FrameMs: number;
  readonly maxFrameMs: number;
};

export type DevProbeApi = {
  readonly version: 1;
  readonly showcases: readonly Pick<ShowcaseStateDefinition, "id" | "sceneKey" | "description" | "settleMs" | "save" | "hold">[];
  activeShowcase: string | null;
  readonly sceneCreatedAt: Record<string, number>;
  readonly assetFailures: string[];
  readonly fontFailures: string[];
  readonly events: { readonly atMs: number; readonly event: GameEvent }[];
  activeScenes(): string[];
  isSceneReady(sceneKey: string, minFramesSinceCreate?: number): boolean;
  actualFps(): number;
  sampleFrames(durationMs: number): Promise<FrameSample>;
  pauseAll(): void;
  resumeAll(): void;
  startScene(sceneKey: string, data?: object): void;
  getState(name: string): unknown;
};

declare global {
  interface Window {
    __CGE__?: DevProbeApi;
  }
}

const stateGetters = new Map<string, () => unknown>();
const sceneCreateFrame = new Map<string, number>();
const MAX_EVENT_LOG = 400;

/** Scenes call this (dev only) to expose live state for playtests, e.g. landing kinematics. */
export function registerDevState(name: string, getter: () => unknown): void {
  if (!import.meta.env.DEV) return;
  stateGetters.set(name, getter);
}

export function recordAssetFailure(key: string): void {
  if (!import.meta.env.DEV) return;
  window.__CGE__?.assetFailures.push(key);
}

export function recordFontFailures(files: readonly string[]): void {
  if (!import.meta.env.DEV) return;
  window.__CGE__?.fontFailures.push(...files);
}

export function installDevProbe(game: Phaser.Game): void {
  if (!import.meta.env.DEV) return;

  const probe: DevProbeApi = {
    version: 1,
    showcases: SHOWCASE_STATES.map(({ id, sceneKey, description, settleMs, save, hold }) => ({
      id,
      sceneKey,
      description,
      settleMs,
      save,
      hold,
    })),
    activeShowcase: null,
    sceneCreatedAt: {},
    assetFailures: [],
    fontFailures: [],
    events: [],
    activeScenes: () => game.scene.getScenes(true).map((scene) => scene.scene.key),
    isSceneReady: (sceneKey, minFramesSinceCreate = 3) => {
      const createdFrame = sceneCreateFrame.get(sceneKey);
      if (createdFrame === undefined) return false;
      const active = game.scene.getScenes(true).some((scene) => scene.scene.key === sceneKey);
      return active && game.loop.frame - createdFrame >= minFramesSinceCreate;
    },
    actualFps: () => game.loop.actualFps,
    sampleFrames: (durationMs) => sampleFrames(durationMs),
    pauseAll: () => {
      for (const scene of game.scene.getScenes(true)) scene.scene.pause();
    },
    resumeAll: () => {
      for (const scene of game.scene.getScenes(false)) {
        if (scene.scene.isPaused()) scene.scene.resume();
      }
    },
    startScene: (sceneKey, data) => {
      const running = game.scene.getScenes(true);
      const host = running[running.length - 1];
      if (host) host.scene.start(sceneKey, data);
      else game.scene.start(sceneKey, data);
    },
    getState: (name) => stateGetters.get(name)?.(),
  };

  window.__CGE__ = probe;

  game.events.once(Phaser.Core.Events.READY, () => {
    for (const scene of game.scene.scenes) {
      scene.events.on(Phaser.Scenes.Events.CREATE, () => {
        sceneCreateFrame.set(scene.scene.key, game.loop.frame);
        probe.sceneCreatedAt[scene.scene.key] = performance.now();
      });
    }
  });

  onGameEvent(game, (event) => {
    probe.events.push({ atMs: performance.now(), event });
    if (probe.events.length > MAX_EVENT_LOG) probe.events.splice(0, probe.events.length - MAX_EVENT_LOG);
  });
}

function sampleFrames(durationMs: number): Promise<FrameSample> {
  return new Promise((resolve) => {
    const deltas: number[] = [];
    const start = performance.now();
    let last = start;

    const tick = (now: number): void => {
      deltas.push(now - last);
      last = now;
      if (now - start < durationMs) {
        requestAnimationFrame(tick);
        return;
      }

      const measured = deltas.slice(1);
      const sorted = [...measured].sort((a, b) => a - b);
      const total = measured.reduce((sum, value) => sum + value, 0);
      const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0;
      resolve({
        frames: measured.length,
        durationMs: total,
        avgFps: total > 0 ? (measured.length * 1000) / total : 0,
        p95FrameMs: p95,
        maxFrameMs: sorted[sorted.length - 1] ?? 0,
      });
    };

    requestAnimationFrame(tick);
  });
}
