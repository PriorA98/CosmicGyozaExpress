import type { LandingTuning } from "../landingTuning";
import { landingTuning } from "../landingTuning";
import type { MissionPilotHints, PilotWaypoint } from "../../types/campaign";
import type { PackageConditionLabel, Point } from "../../types/flight";

/**
 * Plan §2 mapping: three authored result lines expand into the seven package-condition labels.
 * Careful → Perfect/Slightly shaken; Tumbled → Emotionally rotated/Warm but confused/Still delicious;
 * Rearranged → Dramatically rearranged/Basically fine.
 */
export function expandResultLines(careful: string, tumbled: string, rearranged: string): Record<PackageConditionLabel, string> {
  return {
    Perfect: careful,
    "Slightly shaken": careful,
    "Emotionally rotated": tumbled,
    "Warm but confused": tumbled,
    "Still delicious": tumbled,
    "Dramatically rearranged": rearranged,
    "Basically fine": rearranged,
  };
}

/** Landing tuning for a campaign landing: the Tea Moon feel with authored overrides. */
export function campaignLandingTuning(overrides: Partial<LandingTuning>): LandingTuning {
  return { ...landingTuning, ...overrides };
}

export const PILOT_DEFAULTS = {
  waypointRadius: 140,
  cruiseSpeed: 180,
  crossingSpeed: 110,
  arrivalSpeed: 40,
  obstacleLookaheadSeconds: 1.5,
  landing: { targetRelativeDescent: 38, targetTangentOffset: 0 },
} as const;

export function waypoint(position: Point, targetSpeed: number = PILOT_DEFAULTS.cruiseSpeed, flags: { readonly hold?: boolean; readonly quiet?: boolean; readonly radius?: number } = {}): PilotWaypoint {
  return {
    position,
    radius: flags.radius ?? PILOT_DEFAULTS.waypointRadius,
    targetSpeed,
    ...(flags.hold ? { hold: true } : {}),
    ...(flags.quiet ? { quiet: true } : {}),
  };
}

export function pilotHints(waypoints: readonly PilotWaypoint[], landing: Partial<MissionPilotHints["landing"]> = {}): MissionPilotHints {
  return {
    waypoints,
    arrivalSpeed: PILOT_DEFAULTS.arrivalSpeed,
    obstacleLookaheadSeconds: PILOT_DEFAULTS.obstacleLookaheadSeconds,
    landing: { ...PILOT_DEFAULTS.landing, ...landing },
  };
}

/** Default destination framing: blend the camera toward a point just before the dock. */
export function framingNear(destination: Point) {
  return { point: { x: destination.x - 200, y: destination.y }, radius: 1000, maxBlendX: 0.85, maxBlendY: 0.6 } as const;
}

export const CAMPAIGN_MAX_ENVIRONMENT_ACCELERATION = 110;

/** Every new destination's landing-gate geometry (plan §1 common rules). */
export const CAMPAIGN_DESTINATION = { radius: 150, approachRadius: 430, requiredBottomFacingRadians: Math.PI / 2 } as const;

export function rest(x: number, y: number) {
  return { x, y, rotation: Math.PI / 2, velocityX: 0, velocityY: 0 } as const;
}

/** Per-route caps (phase 4): the cap stays below brake (520) and thrust (420) so escape is always possible. */
export const ROUTE_ENVIRONMENT_CAP = { gentle: CAMPAIGN_MAX_ENVIRONMENT_ACCELERATION, river: 160, well: 320, storm: 340 } as const;

type WallRock = { readonly id: string; readonly label: string; readonly x: number; readonly y: number; readonly radius: number };

/**
 * A chain of static rocks from `from` to `to`, `spacing` px apart (centre to centre). Rocks whose centre falls
 * inside any `gaps` interval (distance along the chain, px) are left out, opening a passage there.
 */
export function rockWall(prefix: string, label: string, from: Point, to: Point, radius: number, spacing: number, gaps: readonly (readonly [number, number])[] = []): WallRock[] {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const count = Math.max(1, Math.round(length / spacing));
  const rocks: WallRock[] = [];
  for (let i = 0; i <= count; i += 1) {
    const along = (length * i) / count;
    if (gaps.some(([start, end]) => along >= start && along <= end)) continue;
    rocks.push({ id: `${prefix}-${String(i).padStart(2, "0")}`, label, x: Math.round(from.x + ((to.x - from.x) * i) / count), y: Math.round(from.y + ((to.y - from.y) * i) / count), radius });
  }
  return rocks;
}

/** Rock chain following a polyline (each segment via `rockWall`, shared corners kept once). */
export function rockBank(prefix: string, label: string, points: readonly Point[], radius: number, spacing: number): WallRock[] {
  const rocks: WallRock[] = [];
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    if (!a || !b) continue;
    rocks.push(...rockWall(`${prefix}-${i}`, label, a, b, radius, spacing).slice(i === 1 ? 0 : 1));
  }
  return rocks;
}

type ConveyorRock = {
  readonly id: string;
  readonly label: string;
  readonly radius: number;
  readonly textureKey: string;
  readonly path: { readonly kind: "orbit"; readonly center: Point; readonly radiusX: number; readonly radiusY: number; readonly periodMs: number; readonly phaseRadians: number; readonly clockwise: boolean };
};

/**
 * Sushi-conveyor loop: `slots` evenly spaced positions on one elliptical orbit; slots listed in `skip` stay
 * empty (wider gaps). Every rock shares the period, so the gaps travel with the stream.
 */
export function conveyorLoop(options: {
  readonly prefix: string;
  readonly label: string;
  readonly center: Point;
  readonly radiusX: number;
  readonly radiusY: number;
  readonly periodMs: number;
  readonly slots: number;
  readonly skip?: readonly number[];
  readonly radius: number;
  readonly textureKeys: readonly string[];
  readonly clockwise: boolean;
  readonly phaseRadians?: number;
}): ConveyorRock[] {
  const rocks: ConveyorRock[] = [];
  for (let slot = 0; slot < options.slots; slot += 1) {
    if (options.skip?.includes(slot)) continue;
    rocks.push({
      id: `${options.prefix}-${String(slot).padStart(2, "0")}`,
      label: options.label,
      radius: options.radius,
      textureKey: options.textureKeys[slot % options.textureKeys.length] ?? "",
      path: {
        kind: "orbit",
        center: options.center,
        radiusX: options.radiusX,
        radiusY: options.radiusY,
        periodMs: options.periodMs,
        phaseRadians: (options.phaseRadians ?? 0) + (slot / options.slots) * Math.PI * 2,
        clockwise: options.clockwise,
      },
    });
  }
  return rocks;
}

/** Checkpoint helper: a vertical activation strip (optionally limited to a y range) and its respawn point. */
export function checkpointStrip(id: string, x: number, width: number, respawn: Point, yRange: readonly [number, number] = [0, 4000]) {
  return { id, activation: { kind: "rect", x, y: yRange[0], width, height: yRange[1] - yRange[0] }, respawn: rest(respawn.x, respawn.y) } as const;
}

/**
 * Both banks of a channel: rock centres `offset` px either side of the centreline (mitred at corners), every
 * `spacing` px. Returns plain positions; the route names and sizes them.
 */
export function riverBanks(centerline: readonly Point[], offset: number, radius: number, spacing: number): Point[] {
  const sides: Point[][] = [[], []];
  for (let i = 0; i < centerline.length; i += 1) {
    const point = centerline[i];
    if (!point) continue;
    const before = centerline[Math.max(0, i - 1)] ?? point;
    const after = centerline[Math.min(centerline.length - 1, i + 1)] ?? point;
    const normal = (a: Point, b: Point): Point => {
      const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      return { x: -(b.y - a.y) / length, y: (b.x - a.x) / length };
    };
    const n1 = i > 0 ? normal(before, point) : normal(point, after);
    const n2 = i < centerline.length - 1 ? normal(point, after) : n1;
    const mx = n1.x + n2.x;
    const my = n1.y + n2.y;
    const ml = Math.hypot(mx, my) || 1;
    const miter = offset / Math.max(0.5, (mx / ml) * n1.x + (my / ml) * n1.y);
    sides[0]?.push({ x: point.x + (mx / ml) * miter, y: point.y + (my / ml) * miter });
    sides[1]?.push({ x: point.x - (mx / ml) * miter, y: point.y - (my / ml) * miter });
  }
  return sides.flatMap((side) => rockBank("bank", "bank", side, radius, spacing).map(({ x, y }) => ({ x, y })));
}
