import Phaser from "phaser";
import { colorNumber, depth as depthBands } from "../game/designTokens";
import type { SceneKey } from "../game/events";
import { isReducedMotion } from "./feedback";
import { coverRadius, easeInOutCubic } from "./fxMath";
import { TRANSITION_TUNING } from "./fxPresets";

/**
 * Typed scene transition helpers (owner: audio-fx package).
 *
 * - `warm-fade`: camera fade through warm ink.
 * - `iris`: a circle closes onto (x, y) with an ember rim (classic cozy cartoon wipe).
 * - `warp`: gentle zoom-and-fade for leaving/entering flight.
 *
 * Every helper resolves its promise even if the scene shuts down mid-transition, and reduced
 * motion collapses iris/warp into a plain warm fade.
 */
export type TransitionSpec =
  | { readonly kind: "warm-fade"; readonly durationMs?: number; readonly color?: string }
  | { readonly kind: "iris"; readonly x?: number; readonly y?: number; readonly durationMs?: number; readonly color?: string }
  | { readonly kind: "warp"; readonly durationMs?: number; readonly color?: string };

export type TransitionKind = TransitionSpec["kind"];

const DEFAULT_SPEC: TransitionSpec = { kind: "warm-fade" };
const transitioning = new WeakSet<Phaser.Scene>();

function effectiveSpec(spec: TransitionSpec): TransitionSpec {
  if (spec.kind !== "warm-fade" && isReducedMotion()) return { kind: "warm-fade", color: spec.color };
  return spec;
}

function rgb(color: string): { readonly r: number; readonly g: number; readonly b: number } {
  const value = colorNumber(color);
  return { r: (value >> 16) & 0xff, g: (value >> 8) & 0xff, b: value & 0xff };
}

/** Resolves once, on whichever comes first: done, scene shutdown, or the safety timer. */
function settleable(scene: Phaser.Scene, durationMs: number, run: (done: () => void) => void): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (): void => {
      if (settled) return;
      settled = true;
      scene.events.off(Phaser.Scenes.Events.SHUTDOWN, done);
      window.clearTimeout(timer);
      resolve();
    };
    const timer = window.setTimeout(done, durationMs + TRANSITION_TUNING.settleGraceMs);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, done);
    try {
      run(done);
    } catch {
      done();
    }
  });
}

function irisOverlay(scene: Phaser.Scene, cx: number, cy: number, color: string): { readonly draw: (radius: number) => void; readonly destroy: () => void } {
  const { width, height } = scene.scale;
  const cover = coverRadius(cx, cy, width, height);
  const graphics = scene.add.graphics().setScrollFactor(0).setDepth(depthBands.overlay);
  const fill = colorNumber(color);
  const rim = colorNumber(TRANSITION_TUNING.rimColor);
  const draw = (radius: number): void => {
    graphics.clear();
    const thickness = cover * 2 + TRANSITION_TUNING.rimWidth * 2;
    graphics.lineStyle(thickness, fill, 1);
    graphics.strokeCircle(cx, cy, Math.max(0, radius) + thickness / 2);
    if (radius > 1) {
      graphics.lineStyle(TRANSITION_TUNING.rimWidth, rim, TRANSITION_TUNING.rimAlpha);
      graphics.strokeCircle(cx, cy, radius + TRANSITION_TUNING.rimWidth / 2);
    }
  };
  return { draw, destroy: () => graphics.destroy() };
}

function tweenRadius(scene: Phaser.Scene, from: number, to: number, durationMs: number, onUpdate: (radius: number) => void, onComplete: () => void): void {
  const state = { t: 0 };
  scene.tweens.add({
    targets: state,
    t: 1,
    duration: durationMs,
    ease: "Linear",
    onUpdate: () => onUpdate(from + (to - from) * easeInOutCubic(state.t)),
    onComplete,
  });
}

/** Plays the "leaving" half of a transition on `scene`. */
export function playExitTransition(scene: Phaser.Scene, requested: TransitionSpec = DEFAULT_SPEC): Promise<void> {
  const spec = effectiveSpec(requested);
  const camera = scene.cameras.main;
  const color = rgb(spec.color ?? TRANSITION_TUNING.color);

  switch (spec.kind) {
    case "warm-fade": {
      const duration = spec.durationMs ?? TRANSITION_TUNING.warmFadeMs;
      return settleable(scene, duration, (done) => {
        camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, done);
        camera.fadeOut(duration, color.r, color.g, color.b);
      });
    }
    case "iris": {
      const duration = spec.durationMs ?? TRANSITION_TUNING.irisMs;
      const cx = spec.x ?? scene.scale.width / 2;
      const cy = spec.y ?? scene.scale.height / 2;
      return settleable(scene, duration, (done) => {
        const overlay = irisOverlay(scene, cx, cy, spec.color ?? TRANSITION_TUNING.color);
        const start = coverRadius(cx, cy, scene.scale.width, scene.scale.height);
        overlay.draw(start);
        // The overlay stays fully closed; the next scene start clears it with the display list.
        tweenRadius(scene, start, 0, duration, overlay.draw, done);
      });
    }
    case "warp": {
      const duration = spec.durationMs ?? TRANSITION_TUNING.warpMs;
      return settleable(scene, duration, (done) => {
        camera.zoomTo(camera.zoom * TRANSITION_TUNING.warpZoom, duration, "Sine.easeIn");
        camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, done);
        camera.fadeOut(duration, color.r, color.g, color.b);
      });
    }
  }
}

/** Plays the "arriving" half of a transition; call from the new scene's `create()`. */
export function playEnterTransition(scene: Phaser.Scene, requested: TransitionSpec = DEFAULT_SPEC): Promise<void> {
  const spec = effectiveSpec(requested);
  const camera = scene.cameras.main;
  const color = rgb(spec.color ?? TRANSITION_TUNING.color);

  switch (spec.kind) {
    case "warm-fade": {
      const duration = spec.durationMs ?? TRANSITION_TUNING.warmFadeMs;
      return settleable(scene, duration, (done) => {
        camera.once(Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE, done);
        camera.fadeIn(duration, color.r, color.g, color.b);
      });
    }
    case "iris": {
      const duration = spec.durationMs ?? TRANSITION_TUNING.irisMs;
      const cx = spec.x ?? scene.scale.width / 2;
      const cy = spec.y ?? scene.scale.height / 2;
      return settleable(scene, duration, (done) => {
        const overlay = irisOverlay(scene, cx, cy, spec.color ?? TRANSITION_TUNING.color);
        const end = coverRadius(cx, cy, scene.scale.width, scene.scale.height);
        overlay.draw(0);
        tweenRadius(scene, 0, end, duration, overlay.draw, () => {
          overlay.destroy();
          done();
        });
      });
    }
    case "warp": {
      const duration = spec.durationMs ?? TRANSITION_TUNING.warpMs;
      return settleable(scene, duration, (done) => {
        const targetZoom = camera.zoom;
        camera.setZoom(targetZoom * TRANSITION_TUNING.warpZoom);
        camera.zoomTo(targetZoom, duration, "Sine.easeOut");
        camera.once(Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE, done);
        camera.fadeIn(duration, color.r, color.g, color.b);
      });
    }
  }
}

/**
 * Exit transition, then start `target`. Repeated calls while a transition is running are
 * ignored, so double-pressing confirm cannot start a scene twice.
 */
export function transitionToScene(scene: Phaser.Scene, target: SceneKey, data?: object, spec: TransitionSpec = DEFAULT_SPEC): void {
  if (transitioning.has(scene)) return;
  transitioning.add(scene);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => transitioning.delete(scene));
  void playExitTransition(scene, spec).then(() => {
    transitioning.delete(scene);
    if (scene.sys.isActive() || scene.sys.isPaused()) scene.scene.start(target, data);
  });
}

export function isTransitioning(scene: Phaser.Scene): boolean {
  return transitioning.has(scene);
}
