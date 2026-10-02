/** Optional pickups (postcards). Pure swept pickup so fast ships never tunnel past a card. */
import type { CheckpointDefinition, CollectibleDefinition, RouteBeaconDefinition } from "../types/campaign";
import type { Point } from "../types/flight";

export type CollectionResult = {
  readonly newlyCollected: readonly CollectibleDefinition[];
  readonly collectedIds: ReadonlySet<string>;
};

/** Shortest distance from `point` to segment a→b. */
export function distanceToSegment(point: Point, a: Point, b: Point): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lengthSq = abx * abx + aby * aby;
  const t = lengthSq > 0 ? Math.max(0, Math.min(1, ((point.x - a.x) * abx + (point.y - a.y) * aby) / lengthSq)) : 0;
  return Math.hypot(a.x + abx * t - point.x, a.y + aby * t - point.y);
}

export function collectAlongSegment(
  previous: Point,
  current: Point,
  shipRadius: number,
  definitions: readonly CollectibleDefinition[],
  collectedIds: ReadonlySet<string>,
): CollectionResult {
  const newlyCollected: CollectibleDefinition[] = [];
  for (const definition of definitions) {
    if (collectedIds.has(definition.id)) continue;
    if (distanceToSegment(definition.position, previous, current) <= definition.radius + shipRadius) newlyCollected.push(definition);
  }
  if (newlyCollected.length === 0) return { newlyCollected, collectedIds };
  const next = new Set(collectedIds);
  for (const definition of newlyCollected) next.add(definition.id);
  return { newlyCollected, collectedIds: next };
}

/** The checkpoint whose activation rect contains `position` (last one wins), or null. */
export function checkpointAt(checkpoints: readonly CheckpointDefinition[], position: Point): CheckpointDefinition | null {
  let found: CheckpointDefinition | null = null;
  for (const checkpoint of checkpoints) {
    const { x, y, width, height } = checkpoint.activation;
    if (position.x >= x && position.x <= x + width && position.y >= y && position.y <= y + height) found = checkpoint;
  }
  return found;
}

/** Beacons within reach of `position` that have not been shown yet. */
export function beaconsInReach(
  beacons: readonly RouteBeaconDefinition[],
  position: Point,
  shownIds: ReadonlySet<string>,
): readonly RouteBeaconDefinition[] {
  return beacons.filter((beacon) => !shownIds.has(beacon.id) && Math.hypot(beacon.position.x - position.x, beacon.position.y - position.y) <= beacon.radius);
}
