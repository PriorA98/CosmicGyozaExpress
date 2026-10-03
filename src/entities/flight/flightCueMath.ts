/**
 * Pure helpers for campaign flight cues and the route simulation clock (no Phaser).
 * Cues read the same force / motion samples the physics used, so they never disagree with the push.
 */
import { CAMPAIGN_WINDSOCK_FRAME } from "../../data/assetManifest";
import type { FlightRouteDefinition, GustPhase, ZoneShape } from "../../types/campaign";
import { motionPathTrack } from "../../systems/MotionPathSystem";
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
export function flowCueBases(bounds: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }, vertical: boolean, spacing: number, lanes = 3): readonly Point[] {
  const points: Point[] = [];
  const length = vertical ? bounds.height : bounds.width;
  const cross = vertical ? bounds.width : bounds.height;
  const laneCount = Math.max(2, Math.round(lanes));
  for (let lane = 0; lane < laneCount; lane += 1) {
    const fraction = lane / (laneCount - 1);
    // Alternate lanes start half a spacing apart so the field reads as a flow, not a grid.
    const stagger = lane % 2 === 1 ? spacing / 2 : 0;
    for (let along = -spacing + stagger; along <= length + spacing; along += spacing) {
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

/** Per-phase visibility for a gust telegraph. Active (attack/sustain/release) is always the strongest. */
export type GustCueLevels = {
  /** Lane arrows (outlined in warning, solid while pushing). */
  readonly arrows: number;
  /** Streaming wisps along the band edges (only while pushing). */
  readonly streaks: number;
  /** Faint band tint + dotted edges. */
  readonly band: number;
  readonly outlined: boolean;
};

export function gustCueLevels(phase: GustPhase, envelope: number, timeMs: number, reducedMotion: boolean): GustCueLevels {
  const e = Math.max(0, Math.min(1, envelope));
  if (phase === "calm") return { arrows: 0, streaks: 0, band: 0.12, outlined: true };
  if (phase === "warning") {
    const pulse = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(timeMs / 260);
    return { arrows: 0.34 + 0.2 * pulse, streaks: 0, band: 0.3 + 0.15 * pulse, outlined: true };
  }
  // Any pushing phase stays above the warning ceiling (0.54 arrows / 0.45 band) even as it fades.
  return { arrows: 0.62 + 0.38 * e, streaks: 0.35 + 0.65 * e, band: 0.5 + 0.5 * e, outlined: false };
}

export type KeepOut = { readonly x: number; readonly y: number; readonly radius: number };
type Viewport = { readonly width: number; readonly height: number };

/** Clear far bodies locally as the camera reveals a track; the body vanishes before any overlap. */
export function parallaxBodyOpacity(anchor: Point, scrollFactor: number, camera: Point, keepOuts: readonly KeepOut[], radius: number): number {
  const x = anchor.x + (1 - scrollFactor) * camera.x;
  const y = anchor.y + (1 - scrollFactor) * camera.y;
  let alpha = 1;
  for (const k of keepOuts) alpha = Math.min(alpha, Math.max(0, Math.min(1, (Math.hypot(x - k.x, y - k.y) - radius - k.radius) / 30)));
  return alpha;
}

export type ScreenRect = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };

/** Slide a complete pin/label footprint along its clamped edge, preferring the closest clear spot. */
export function clearIndicatorPosition(preferred: Point, vertical: boolean, min: number, max: number, footprint: ScreenRect, obstacles: readonly KeepOut[], hud: readonly ScreenRect[]): Point {
  const position = (along: number): Point => vertical ? { x: preferred.x, y: along } : { x: along, y: preferred.y };
  const clear = (p: Point): boolean => {
    const r = { x: p.x + footprint.x, y: p.y + footprint.y, width: footprint.width, height: footprint.height };
    if (hud.some((h) => r.x < h.x + h.width && r.x + r.width > h.x && r.y < h.y + h.height && r.y + r.height > h.y)) return false;
    return obstacles.every((o) => Math.hypot(o.x - Math.max(r.x, Math.min(r.x + r.width, o.x)), o.y - Math.max(r.y, Math.min(r.y + r.height, o.y))) > o.radius + 8);
  };
  if (clear(preferred)) return preferred;
  const along = vertical ? preferred.y : preferred.x;
  for (let distance = 8; distance <= max - min + 8; distance += 8) {
    for (const direction of [-1, 1]) {
      const candidate = position(Math.max(min, Math.min(max, along + direction * distance)));
      if (clear(candidate)) return candidate;
    }
  }
  return preferred;
}

/** Camera scroll samples while the ship flies start -> waypoints -> destination (camera centred, clamped to the world). */
export function routeCameraPath(stops: readonly Point[], world: FlightWorldBounds, viewport: Viewport, stepPx = 60): Point[] {
  const scroll = (p: Point): Point => ({
    x: Math.max(0, Math.min(Math.max(0, world.width - viewport.width), p.x - viewport.width / 2)),
    y: Math.max(0, Math.min(Math.max(0, world.height - viewport.height), p.y - viewport.height / 2)),
  });
  const samples: Point[] = [];
  for (let i = 0; i < stops.length; i += 1) {
    const a = stops[i];
    if (!a) continue;
    const b = stops[i + 1];
    if (!b) { samples.push(scroll(a)); continue; }
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / stepPx));
    for (let s = 0; s < steps; s += 1) samples.push(scroll({ x: a.x + ((b.x - a.x) * s) / steps, y: a.y + ((b.y - a.y) * s) / steps }));
  }
  return samples;
}

/**
 * Parallax prop anchors (scroll factor `scrollFactor`, positions in screen px at scroll 0). A prop drawn at
 * P shows at screen P - f * scroll and covers world point P + (1 - f) * scroll. A candidate is kept only if,
 * for every camera sample where the prop is on screen, that world point stays clear of every keep-out, and
 * it is on screen somewhere along the route. Returns at most `count` anchors, in candidate order, at least
 * `minSpacing` apart (in world-sweep terms: their screen anchors).
 */
export function placeParallaxProps(
  candidates: readonly Point[],
  count: number,
  scrollFactor: number,
  cameraPath: readonly Point[],
  keepOuts: readonly KeepOut[],
  propRadius: number,
  viewport: Viewport,
  minSpacing = 360,
): Point[] {
  const travel = 1 - scrollFactor;
  const chosen: Point[] = [];
  for (const candidate of candidates) {
    if (chosen.length >= count) break;
    if (chosen.some((p) => Math.hypot(p.x - candidate.x, p.y - candidate.y) < minSpacing)) continue;
    let seen = false;
    const clear = cameraPath.every((camera) => {
      const sx = candidate.x - scrollFactor * camera.x;
      const sy = candidate.y - scrollFactor * camera.y;
      if (sx < -propRadius || sx > viewport.width + propRadius || sy < -propRadius || sy > viewport.height + propRadius) return true;
      seen = true;
      const wx = candidate.x + travel * camera.x;
      const wy = candidate.y + travel * camera.y;
      return keepOuts.every((k) => Math.hypot(wx - k.x, wy - k.y) >= k.radius + propRadius);
    });
    if (clear && seen) chosen.push(candidate);
  }
  return chosen;
}

export type FogPuff = { readonly x: number; readonly y: number; readonly size: 0 | 1 | 2; readonly alpha: number; readonly drift: number };

/**
 * Deterministic broken-up fog: jittered grid of soft puffs of three sizes, smaller and fainter toward the
 * area edge so the bank has a ragged, soft fringe instead of a hard tiled rectangle.
 */
export function fogPuffLayout(area: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }, spacing: number, random: () => number): FogPuff[] {
  const puffs: FogPuff[] = [];
  const cols = Math.max(1, Math.round(area.width / spacing));
  const rows = Math.max(1, Math.round(area.height / spacing));
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const fx = (col + 0.5 + (random() - 0.5) * 0.8) / cols;
      const fy = (row + 0.5 + (random() - 0.5) * 0.8) / rows;
      const edge = Math.min(fx, 1 - fx, fy, 1 - fy) * 2; // 0 at the edge, 1 in the middle
      const roll = random();
      if (edge < 0.25 && roll < 0.35) continue; // gaps in the fringe
      const size: 0 | 1 | 2 = edge < 0.3 ? 0 : roll < 0.45 ? 1 : 2;
      const alpha = Math.min(1, 0.45 + 0.55 * Math.min(1, edge * 1.6)) * (0.7 + 0.3 * random());
      puffs.push({ x: area.x + fx * area.width, y: area.y + fy * area.height, size, alpha, drift: 0.7 + 0.6 * random() });
    }
  }
  return puffs;
}

/** Linear mix of two #RRGGBB colours, as a Phaser colour number. */
export function mixHexColor(a: string, b: string, t: number): number {
  const pa = Number.parseInt(a.slice(1), 16);
  const pb = Number.parseInt(b.slice(1), 16);
  const k = Math.max(0, Math.min(1, t));
  const channel = (shift: number): number => Math.round(((pa >> shift) & 255) * (1 - k) + ((pb >> shift) & 255) * k);
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

/** Everything a backdrop prop must never sit on: rocks, motion tracks, pickups, notes, checkpoints, dock. */
export function routeKeepOuts(route: FlightRouteDefinition, pad: number): KeepOut[] {
  const keepOuts: KeepOut[] = [];
  for (const rock of route.obstacles) keepOuts.push({ x: rock.x, y: rock.y, radius: rock.radius + pad });
  for (const moving of route.movingObstacles) {
    for (const point of motionPathTrack(moving.path, 24)) keepOuts.push({ x: point.x, y: point.y, radius: moving.radius + pad });
  }
  for (const pickup of route.collectibles) keepOuts.push({ x: pickup.position.x, y: pickup.position.y, radius: pickup.radius + pad });
  for (const beacon of route.beacons) keepOuts.push({ x: beacon.position.x, y: beacon.position.y, radius: 40 + pad });
  for (const checkpoint of route.checkpoints) {
    const a = checkpoint.activation;
    keepOuts.push({ x: a.x + a.width / 2, y: a.y + a.height / 2, radius: Math.max(a.width, a.height) / 2 + pad });
  }
  keepOuts.push({ x: route.destination.x, y: route.destination.y, radius: route.destination.approachRadius + 160 + pad });
  return keepOuts;
}

/** Camera stops for a route: start, checkpoints (authored order), destination. */
export function routeCameraStops(route: FlightRouteDefinition): Point[] {
  return [
    { x: route.start.x, y: route.start.y },
    ...route.checkpoints.map((checkpoint) => ({ x: checkpoint.respawn.x, y: checkpoint.respawn.y })),
    { x: route.destination.x, y: route.destination.y },
  ];
}

/**
 * Candidate far-prop anchors (screen px at scroll 0) covering everything the parallax layer shows along the
 * route, kept out of the HUD bands (top 150 px, bottom 110 px), interleaved so chosen props spread out.
 */
export function parallaxPropCandidates(viewport: Viewport, step: number, scrollFactor: number, cameraPath: readonly Point[]): Point[] {
  const xs = cameraPath.map((camera) => camera.x * scrollFactor);
  const ys = cameraPath.map((camera) => camera.y * scrollFactor);
  const minX = Math.min(0, ...xs), maxX = Math.max(0, ...xs);
  const minY = Math.min(0, ...ys), maxY = Math.max(0, ...ys);
  const candidates: Point[] = [];
  for (let y = 150 + minY; y <= viewport.height - 110 + maxY; y += step) {
    for (let x = 160 + minX; x <= viewport.width - 160 + maxX; x += step) candidates.push({ x: Math.round(x), y: Math.round(y) });
  }
  return candidates.sort((p, q) => ((p.x * 7 + p.y * 13) % 11) - ((q.x * 7 + q.y * 13) % 11) || p.x - q.x || p.y - q.y);
}
