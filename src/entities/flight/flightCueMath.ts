/**
 * Pure helpers for campaign flight cues and the route simulation clock (no Phaser).
 * Cues read the same force / motion samples the physics used, so they never disagree with the push.
 */
import { CAMPAIGN_WINDSOCK_FRAME } from "../../data/assetManifest";
import type { GustPhase, ZoneShape } from "../../types/campaign";
import type { FlightDestinationDefinition, FlightWorldBounds, Point } from "../../types/flight";

/** Advances the route clock by the scene's own clamped delta (never negative, never a big jump). */
export function advanceSimClock(simTimeMs: number, deltaMs: number, maxStepMs: number): number {
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) return simTimeMs;
  return simTimeMs + Math.min(deltaMs, maxStepMs);
}

/** Finite bounded steps sharing the same consumed time as the scene clock. */
export function simulationSteps(deltaMs: number, maxFrameMs: number, substepMs: number): readonly number[] {
  if (!Number.isFinite(deltaMs) || deltaMs <= 0 || !(maxFrameMs > 0) || !(substepMs > 0)) return [];
  const consumed = Math.min(deltaMs, maxFrameMs);
  const count = Math.ceil(consumed / substepMs);
  return Array.from({ length: count }, (_, index) => Math.min(substepMs, consumed - index * substepMs));
}

/** Windsock strip frame for a gust sample: warning lifts the sock before any push arrives. */
export function windsockFrame(phase: GustPhase, envelope: number): number {
  if (phase === "warning") return CAMPAIGN_WINDSOCK_FRAME.warning;
  if (phase === "calm") return CAMPAIGN_WINDSOCK_FRAME.calm;
  if (envelope >= 0.66) return CAMPAIGN_WINDSOCK_FRAME.strong;
  if (envelope >= 0.2) return CAMPAIGN_WINDSOCK_FRAME.medium;
  return phase === "release" ? CAMPAIGN_WINDSOCK_FRAME.calm : CAMPAIGN_WINDSOCK_FRAME.warning;
}

/** Quarter-turn rotation (radians) closest to a direction, so pixel arrows stay on the art grid. */
export function quarterTurnRotation(x: number, y: number): number {
  if (Math.abs(x) < 1e-9 && Math.abs(y) < 1e-9) return 0;
  const quarter = Math.round(Math.atan2(y, x) / (Math.PI / 2));
  return quarter * (Math.PI / 2);
}

/** Eight-way direction index (0 = east, clockwise with +Y down) for the HUD drift arrow. */
export function octantIndex(x: number, y: number): number {
  return ((Math.round(Math.atan2(y, x) / (Math.PI / 4)) % 8) + 8) % 8;
}

/** Wraps `value` into [0, period). */
export function wrap(value: number, period: number): number {
  if (!(period > 0)) return 0;
  return ((value % period) + period) % period;
}

/** Axis-aligned bounds of a zone shape. */
export function zoneBounds(shape: ZoneShape): { readonly x: number; readonly y: number; readonly width: number; readonly height: number } {
  if (shape.kind === "rect") return { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
  return { x: shape.center.x - shape.radius, y: shape.center.y - shape.radius, width: shape.radius * 2, height: shape.radius * 2 };
}

/** Three sparse flow lanes: two edges and one central lane, rather than a wall of arrows. */
export function flowCueBases(bounds: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }, vertical: boolean, spacing: number): readonly Point[] {
  const points: Point[] = [];
  const length = vertical ? bounds.height : bounds.width;
  const cross = vertical ? bounds.width : bounds.height;
  for (const fraction of [0, 0.5, 1]) {
    for (let along = -spacing; along <= length + spacing; along += spacing) {
      const across = cross * fraction;
      points.push({ x: bounds.x + (vertical ? across : along), y: bounds.y + (vertical ? along : across) });
    }
  }
  return points;
}

/** Cues stay clear of the ship silhouette, dialog, instruments, and controls. */
export function cueIsClear(point: Point, ship: Point, screen: Point, width: number, height: number, avoid: readonly { readonly x: number; readonly y: number; readonly width: number; readonly height: number }[]): boolean {
  if (Math.hypot(point.x - ship.x, point.y - ship.y) < 100) return false;
  if (screen.x < 30 || screen.x > width - 30 || screen.y < 96 || screen.y > height - 78) return false;
  return !avoid.some((r) => screen.x >= r.x - 28 && screen.x <= r.x + r.width + 28 && screen.y >= r.y - 28 && screen.y <= r.y + r.height + 28);
}

/**
 * Centre for a destination body sprite: beyond the arrival ring in the required bottom direction (the
 * ship docks bottom-toward the station, like the Tea Moon), kept fully inside the world.
 */
export function destinationBodyCenter(
  destination: FlightDestinationDefinition,
  bottom: Point,
  halfSizePx: number,
  gapPx: number,
  world: FlightWorldBounds,
): Point {
  const offset = destination.radius + gapPx;
  const x = destination.x + bottom.x * offset;
  const y = destination.y + bottom.y * offset;
  const clampAxis = (value: number, size: number): number => Math.min(Math.max(value, halfSizePx), Math.max(halfSizePx, size - halfSizePx));
  return { x: Math.round(clampAxis(x, world.width) / 2) * 2, y: Math.round(clampAxis(y, world.height) / 2) * 2 };
}

/** Rock texture whose canvas (art px == obstacle radius contract) best fits `radius`; alternates between the two closest. */
export function pickRockTexture<T extends string>(rocks: readonly { readonly key: T; readonly canvasArtPx: number }[], radius: number, index: number): T {
  const ranked = [...rocks].sort((a, b) => Math.abs(a.canvasArtPx - radius) - Math.abs(b.canvasArtPx - radius) || a.key.localeCompare(b.key));
  const pool = ranked.slice(0, Math.min(2, ranked.length));
  const choice = pool[index % pool.length] ?? rocks[0];
  if (!choice) throw new Error("pickRockTexture needs at least one rock texture");
  return choice.key;
}
