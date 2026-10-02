import Phaser from "phaser";
import { colorNumber, depth as depthBands } from "../game/designTokens";
import type { SceneKey } from "../game/events";
import { flashScreen, isReducedMotion } from "./feedback";
import { coverRadius, easeInOutCubic, irisHalfWidth, snapToGrid } from "./fxMath";
import { FLASH_TUNING, TRANSITION_TUNING } from "./fxPresets";

/**
 * Typed scene transition helpers (owner: audio-fx package).
 *
 * - `warm-fade`: camera fade through warm ink.
 * - `iris`: a pixel-stepped circle (hard `blockPx` staircase edge, amber/ember/terracotta rim
 *   rings) closes onto (x, y). No anti-aliased vector circle.
 * - `warp`: hard-edged warm streaks rush out from the centre over an ink veil that closes in hard
 *   steps. The camera never zooms, so pixel art and UI text stay crisp during the effect.
 * - `handoff`: the story beat between scenes (flight -> landing, landing -> result): a short
 *   warm-cream flash pop, then the pixel iris closes on the focus point. Entering, the iris
 *   opens from the focus point.
 *
 * Every helper resolves its promise even if the scene shuts down mid-transition, and reduced
 * motion collapses iris/warp/handoff into a plain warm fade.
 */
export type TransitionSpec =
  | { readonly kind: "warm-fade"; readonly durationMs?: number; readonly color?: string }
  | { readonly kind: "iris"; readonly x?: number; readonly y?: number; readonly durationMs?: number; readonly color?: string }
  | { readonly kind: "warp"; readonly durationMs?: number; readonly color?: string }
  | { readonly kind: "handoff"; readonly x?: number; readonly y?: number; readonly durationMs?: number; readonly color?: string };

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

// ---------------------------------------------------------------------------------------------
// Pixel iris
// ---------------------------------------------------------------------------------------------

type Overlay = { readonly draw: (radius: number) => void; readonly destroy: () => void };

/**
 * Screen-fixed iris drawn row by row in `blockPx` bands: each band is filled outside the hole
 * with hard-edged rim rings and ink, so the edge is an honest pixel staircase. The radius is
 * quantised to the block grid and the graphics only redraw when that quantised radius changes.
 */
function irisOverlay(scene: Phaser.Scene, focusX: number, focusY: number, color: string): Overlay {
  const block = TRANSITION_TUNING.blockPx;
  const { width, height } = scene.scale;
  const cx = snapToGrid(focusX, block);
  const cy = snapToGrid(focusY, block);
  // Overscan by a couple of blocks so a shaking or resized camera never shows an edge.
  const left = -block * 2;
  const right = width + block * 2;
  const top = -block * 2;
  const bottom = height + block * 2;
  const graphics = scene.add.graphics().setScrollFactor(0).setDepth(depthBands.overlay);
  const ink = colorNumber(color);
  const rims = TRANSITION_TUNING.rimColors.map((rim) => colorNumber(rim));
  const halfWidths: number[] = new Array<number>(rims.length + 1).fill(-1);
  let lastRadius = Number.NaN;

  const span = (x0: number, x1: number, y: number, fill: number): void => {
    const from = Math.max(left, x0);
    const to = Math.min(right, x1);
    if (to <= from) return;
    graphics.fillStyle(fill, 1);
    graphics.fillRect(from, y, to - from, block);
  };

  const draw = (radius: number): void => {
    const quantised = Math.max(0, snapToGrid(radius, block));
    if (quantised === lastRadius) return;
    lastRadius = quantised;
    graphics.clear();
    if (quantised <= 0) {
      graphics.fillStyle(ink, 1);
      graphics.fillRect(left, top, right - left, bottom - top);
      return;
    }
    for (let y = top; y < bottom; y += block) {
      const dy = y + block / 2 - cy;
      // halfWidths[0] is the hole; [k] is the outer edge of rim ring k-1.
      for (let k = 0; k < halfWidths.length; k += 1) halfWidths[k] = irisHalfWidth(dy, quantised + k * block, block);
      const outer = halfWidths[halfWidths.length - 1] ?? -1;
      if (outer < 0) {
        span(left, right, y, ink);
        continue;
      }
      span(left, cx - outer, y, ink);
      span(cx + outer, right, y, ink);
      for (let k = rims.length - 1; k >= 0; k -= 1) {
        const outerEdge = halfWidths[k + 1] ?? -1;
        const innerEdge = Math.max(0, halfWidths[k] ?? -1);
        if (outerEdge <= innerEdge) continue;
        const fill = rims[k] ?? ink;
        span(cx - outerEdge, cx - innerEdge, y, fill);
        span(cx + innerEdge, cx + outerEdge, y, fill);
      }
    }
  };
  return { draw, destroy: () => graphics.destroy() };
}

function tweenProgress(scene: Phaser.Scene, durationMs: number, onUpdate: (t: number) => void, onComplete: () => void): void {
  const state = { t: 0 };
  scene.tweens.add({
    targets: state,
    t: 1,
    duration: Math.max(1, durationMs),
    ease: "Linear",
    onUpdate: () => onUpdate(state.t),
    onComplete,
  });
}

function irisClose(scene: Phaser.Scene, cx: number, cy: number, color: string, durationMs: number, done: () => void): void {
  const overlay = irisOverlay(scene, cx, cy, color);
  const start = coverRadius(cx, cy, scene.scale.width, scene.scale.height) + TRANSITION_TUNING.blockPx * TRANSITION_TUNING.rimColors.length;
  overlay.draw(start);
  // The overlay stays fully closed; the next scene start clears it with the display list.
  tweenProgress(scene, durationMs, (t) => overlay.draw(start * (1 - easeInOutCubic(t))), done);
}

function irisOpen(scene: Phaser.Scene, cx: number, cy: number, color: string, durationMs: number, done: () => void): void {
  const overlay = irisOverlay(scene, cx, cy, color);
  const end = coverRadius(cx, cy, scene.scale.width, scene.scale.height) + TRANSITION_TUNING.blockPx * TRANSITION_TUNING.rimColors.length;
  overlay.draw(0);
  tweenProgress(
    scene,
    durationMs,
    (t) => overlay.draw(end * easeInOutCubic(t)),
    () => {
      overlay.destroy();
      done();
    },
  );
}

// ---------------------------------------------------------------------------------------------
// Warp streaks (no camera zoom)
// ---------------------------------------------------------------------------------------------

type Streak = { readonly angle: number; readonly start: number; readonly length: number; readonly color: number };

/**
 * Warp overlay: an ink veil that darkens in hard steps, with warm dashes above it that stay
 * bright while the scene sinks away. Dashes step along their ray in whole blocks. Leaving, the
 * streaks accelerate outward and the veil closes; arriving, they decelerate and the veil lifts.
 */
function warpOverlay(scene: Phaser.Scene, inkColor: string): { readonly draw: (t: number, arriving: boolean) => void; readonly destroy: () => void } {
  const tuning = TRANSITION_TUNING.warp;
  const block = tuning.thicknessPx;
  const { width, height } = scene.scale;
  const cx = snapToGrid(width / 2, block);
  const cy = snapToGrid(height / 2, block);
  const reach = coverRadius(cx, cy, width, height);
  const palette = tuning.colors.map((value) => colorNumber(value));
  const streaks: Streak[] = [];
  for (let i = 0; i < tuning.streaks; i += 1) {
    const angle = ((i + Math.random() * 0.7) / tuning.streaks) * Math.PI * 2;
    streaks.push({
      angle,
      start: 0.08 + Math.random() * 0.3,
      length: tuning.minLengthPx + Math.random() * (tuning.maxLengthPx - tuning.minLengthPx),
      color: palette[i % palette.length] ?? 0xffffff,
    });
  }
  const veil = scene.add
    .rectangle(-block * 2, -block * 2, width + block * 4, height + block * 4, colorNumber(inkColor))
    .setOrigin(0, 0)
    .setScrollFactor(0)
    .setDepth(depthBands.overlay - 2)
    .setAlpha(0);
  const graphics = scene.add.graphics().setScrollFactor(0).setDepth(depthBands.overlay - 1);
  const draw = (t: number, arriving: boolean): void => {
    const clamped = Math.min(1, Math.max(0, t));
    const cover = arriving ? 1 - clamped : clamped;
    veil.setAlpha(Math.min(1, Math.ceil(cover * tuning.veilSteps) / tuning.veilSteps));
    graphics.clear();
    if (arriving && clamped >= 1) return;
    const travel = arriving ? 1 - (1 - clamped) * (1 - clamped) : clamped * clamped;
    const stretch = arriving ? 1 - clamped : clamped;
    for (const streak of streaks) {
      const near = (streak.start + travel * (1 - streak.start)) * reach;
      const length = Math.max(block, streak.length * (0.35 + stretch * 0.65));
      const dx = Math.cos(streak.angle);
      const dy = Math.sin(streak.angle);
      graphics.fillStyle(streak.color, 1);
      let lastX = Number.NaN;
      let lastY = Number.NaN;
      for (let d = near; d < near + length; d += block / 2) {
        const x = snapToGrid(cx + dx * d, block);
        const y = snapToGrid(cy + dy * d, block);
        if (x === lastX && y === lastY) continue;
        lastX = x;
        lastY = y;
        graphics.fillRect(x, y, block, block);
      }
    }
  };
  return {
    draw,
    destroy: () => {
      veil.destroy();
      graphics.destroy();
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------------------------

/** Plays the "leaving" half of a transition on `scene`. */
export function playExitTransition(scene: Phaser.Scene, requested: TransitionSpec = DEFAULT_SPEC): Promise<void> {
  const spec = effectiveSpec(requested);
  const camera = scene.cameras.main;
  const inkColor = spec.color ?? TRANSITION_TUNING.color;
  const color = rgb(inkColor);

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
      return settleable(scene, duration, (done) => irisClose(scene, cx, cy, inkColor, duration, done));
    }
    case "warp": {
      const duration = spec.durationMs ?? TRANSITION_TUNING.warpMs;
      return settleable(scene, duration, (done) => {
        // The overlay stays closed (ink veil at full opacity); the next scene start clears it.
        const overlay = warpOverlay(scene, inkColor);
        overlay.draw(0, false);
        tweenProgress(scene, duration, (t) => overlay.draw(t, false), done);
      });
    }
    case "handoff": {
      const duration = spec.durationMs ?? TRANSITION_TUNING.handoffMs;
      const flashMs = Math.min(TRANSITION_TUNING.handoffFlashMs, duration / 3);
      const cx = spec.x ?? scene.scale.width / 2;
      const cy = spec.y ?? scene.scale.height / 2;
      return settleable(scene, duration, (done) => {
        flashScreen(scene, FLASH_TUNING.color, flashMs);
        scene.time.delayedCall(flashMs, () => irisClose(scene, cx, cy, inkColor, duration - flashMs, done));
      });
    }
  }
}

/** Plays the "arriving" half of a transition; call from the new scene's `create()`. */
export function playEnterTransition(scene: Phaser.Scene, requested: TransitionSpec = DEFAULT_SPEC): Promise<void> {
  const spec = effectiveSpec(requested);
  const camera = scene.cameras.main;
  const inkColor = spec.color ?? TRANSITION_TUNING.color;
  const color = rgb(inkColor);

  switch (spec.kind) {
    case "warm-fade": {
      const duration = spec.durationMs ?? TRANSITION_TUNING.warmFadeMs;
      return settleable(scene, duration, (done) => {
        camera.once(Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE, done);
        camera.fadeIn(duration, color.r, color.g, color.b);
      });
    }
    case "iris":
    case "handoff": {
      const fallback = spec.kind === "iris" ? TRANSITION_TUNING.irisMs : TRANSITION_TUNING.handoffMs - TRANSITION_TUNING.handoffFlashMs;
      const duration = spec.durationMs ?? fallback;
      const cx = spec.x ?? scene.scale.width / 2;
      const cy = spec.y ?? scene.scale.height / 2;
      return settleable(scene, duration, (done) => irisOpen(scene, cx, cy, inkColor, duration, done));
    }
    case "warp": {
      const duration = spec.durationMs ?? TRANSITION_TUNING.warpMs;
      return settleable(scene, duration, (done) => {
        const overlay = warpOverlay(scene, inkColor);
        overlay.draw(0, true);
        tweenProgress(
          scene,
          duration,
          (t) => overlay.draw(t, true),
          () => {
            overlay.destroy();
            done();
          },
        );
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

/**
 * Story hand-off between scenes (flight -> landing, landing -> result): warm flash pop, pixel
 * iris closes on (x, y), then `target` starts. The next scene should call
 * `playEnterTransition(this, { kind: "handoff", x, y })` to open the iris on its own focus point.
 */
export function handoffToScene(scene: Phaser.Scene, target: SceneKey, data: object | undefined, focus: { readonly x: number; readonly y: number }, durationMs?: number): void {
  transitionToScene(scene, target, data, { kind: "handoff", x: focus.x, y: focus.y, durationMs });
}

export function isTransitioning(scene: Phaser.Scene): boolean {
  return transitioning.has(scene);
}
