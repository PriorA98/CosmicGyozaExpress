/**
 * Delivery board geometry and keyboard navigation (pure; docs/implementation/phase-3-campaign-plan.md §5).
 * Six fixed nodes in a U: the top row runs left → right, the bottom row right → left. Indices are
 * campaign board order (0 = Tea Moon … 5 = Home). Coordinates are logical 1280×720 px.
 */
import { dotsAlongQuadratic, quadraticPoint, type Point } from "./layout";

export type BoardNodeState = "locked" | "available" | "completed";
export type BoardMove = "left" | "right" | "up" | "down" | "next" | "previous";
export type BoardLayoutKind = "desktop" | "compact";

/** Row/column of each board-order index (bottom row reversed, so the route reads as a U). */
export const BOARD_GRID: readonly { readonly row: 0 | 1; readonly col: 0 | 1 | 2 }[] = [
  { row: 0, col: 0 },
  { row: 0, col: 1 },
  { row: 0, col: 2 },
  { row: 1, col: 2 },
  { row: 1, col: 1 },
  { row: 1, col: 0 },
];

export const BOARD_NODE_COUNT = BOARD_GRID.length;

/** Fixed bottom card footprint: leaves room for the longest row-two lock caption. */
export function boardDetailHeight(kind: BoardLayoutKind, uiScale = 1): number {
  return kind === "compact" ? Math.round(112 * uiScale) : 157;
}

const COLUMN_X: readonly number[] = [280, 640, 1000];
const ROW_Y: Readonly<Record<BoardLayoutKind, readonly [number, number]>> = {
  desktop: [184, 416],
  compact: [160, 392],
};

/** One integer-scale illustration, with a separate label and status area below it. */
export const BOARD_TOKEN = {
  artSize: 160,
  artScale: 1,
  ringRadius: 84,
  selectRadius: 88,
  labelOffset: 88,
  hitWidth: 200,
  hitHeight: 224,
} as const;

/** Measured text/chip heights keep the state below the label on every display tier. */
export function boardTokenCaption(centre: Point, labelHeight: number, chipHeight: number): { labelY: number; chipY: number; bottom: number } {
  const labelY = centre.y + BOARD_TOKEN.labelOffset;
  const chipY = Math.ceil(labelY + labelHeight + 4);
  return { labelY, chipY, bottom: chipY + chipHeight };
}

/** Compact status badges sit along the lower art edge, leaving room between rows and the card. */
export function boardStatusTop(centre: Point, labelHeight: number, chipHeight: number, kind: BoardLayoutKind): number {
  return kind === "compact"
    ? Math.floor((centre.y + BOARD_TOKEN.labelOffset - 6 - chipHeight) / 2) * 2
    : boardTokenCaption(centre, labelHeight, chipHeight).chipY;
}

/** "You are here" ship: between stops, just below the route dots (which run through node centres). */
export const BOARD_SHIP_MARKER = { dx: -164, dy: 44, captionDy: 36 } as const;

export function boardShipMarker(centre: Point): { x: number; y: number; captionDy: number } {
  return { x: centre.x + BOARD_SHIP_MARKER.dx, y: centre.y + BOARD_SHIP_MARKER.dy, captionDy: BOARD_SHIP_MARKER.captionDy };
}

/** Compensate for the lock container's 12px art offset: every pill sits below its name. */
export function boardUnlockCaptionTop(_centre: Point, chipTop: number, _kind: BoardLayoutKind, _index: number): number {
  return chipTop + 12;
}

/** Node centres in board order for a layout. */
export function boardNodeCentres(kind: BoardLayoutKind): Point[] {
  const rows = ROW_Y[kind];
  return BOARD_GRID.map(({ row, col }) => ({ x: COLUMN_X[col] ?? 0, y: rows[row] }));
}

export function isSelectable(state: BoardNodeState | undefined): boolean {
  return state === "available" || state === "completed";
}

/** First selectable index at or after the requested one (in board order, wrapping); -1 if none. */
export function initialBoardSelection(states: readonly BoardNodeState[], requested: number): number {
  const count = states.length;
  if (count === 0) return -1;
  const start = Number.isInteger(requested) && requested >= 0 && requested < count ? requested : 0;
  for (let step = 0; step < count; step += 1) {
    const index = (start + step) % count;
    if (isSelectable(states[index])) return index;
  }
  return -1;
}

function stepAlongRoute(states: readonly BoardNodeState[], current: number, direction: 1 | -1, wrap: boolean): number {
  const count = states.length;
  for (let step = 1; step < count; step += 1) {
    const raw = current + direction * step;
    if (!wrap && (raw < 0 || raw >= count)) return current;
    const index = (raw + count) % count;
    if (isSelectable(states[index])) return index;
  }
  return current;
}

/**
 * Next selection for a key press. Locked nodes are always skipped. Left/right move spatially along
 * the row; past the row's end they follow the route around the corner (top-right ↔ bottom-right).
 * Up/down jump to the closest selectable node in the other row. Next/previous walk board order
 * with wrap-around. Returns `current` when nothing selectable lies that way.
 */
export function navigateBoard(states: readonly BoardNodeState[], current: number, move: BoardMove): number {
  const here = BOARD_GRID[current];
  if (!here || states.length !== BOARD_NODE_COUNT) return current;
  if (move === "next") return stepAlongRoute(states, current, 1, true);
  if (move === "previous") return stepAlongRoute(states, current, -1, true);

  if (move === "left" || move === "right") {
    const dx = move === "right" ? 1 : -1;
    let best = -1;
    let bestDistance = Infinity;
    BOARD_GRID.forEach((cell, index) => {
      if (cell.row !== here.row || !isSelectable(states[index])) return;
      const distance = (cell.col - here.col) * dx;
      if (distance > 0 && distance < bestDistance) {
        best = index;
        bestDistance = distance;
      }
    });
    if (best >= 0) return best;
    // Past the row's end: top row → forward means right; bottom row → forward means left.
    const forward = here.row === 0 ? dx === 1 : dx === -1;
    return stepAlongRoute(states, current, forward ? 1 : -1, false);
  }

  const targetRow = move === "down" ? 1 : 0;
  if (targetRow === here.row) return current;
  let best = -1;
  let bestDistance = Infinity;
  BOARD_GRID.forEach((cell, index) => {
    if (cell.row !== targetRow || !isSelectable(states[index])) return;
    const distance = Math.abs(cell.col - here.col);
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best >= 0 ? best : current;
}

/** One quadratic leg of the dotted route between consecutive board nodes. */
export type BoardRouteLeg = { readonly from: Point; readonly control: Point; readonly to: Point };

/**
 * Route legs between consecutive nodes: straight legs within a row, and a soft bulge out to the
 * right for the corner from the top row down to the bottom row (it never crosses node labels).
 */
export function boardRouteLegs(centres: readonly Point[], cornerBulge = 150): BoardRouteLeg[] {
  const legs: BoardRouteLeg[] = [];
  for (let index = 0; index + 1 < centres.length; index += 1) {
    const from = centres[index];
    const to = centres[index + 1];
    if (!from || !to) continue;
    const corner = BOARD_GRID[index]?.row !== BOARD_GRID[index + 1]?.row;
    const control = corner
      ? { x: Math.max(from.x, to.x) + cornerBulge, y: Math.round((from.y + to.y) / 2) }
      : { x: Math.round((from.x + to.x) / 2), y: Math.round((from.y + to.y) / 2) };
    legs.push({ from, control, to });
  }
  return legs;
}

/** Dots along a leg, leaving `clearRadius` px free around both end nodes. */
export function boardLegDots(leg: BoardRouteLeg, spacing: number, clearRadius: number): Point[] {
  return dotsAlongQuadratic(leg.from, leg.control, leg.to, spacing)
    .filter((dot) => Math.hypot(dot.x - leg.from.x, dot.y - leg.from.y) > clearRadius && Math.hypot(dot.x - leg.to.x, dot.y - leg.to.y) > clearRadius)
    .map(({ x, y }) => ({ x, y }));
}

/** A small pixel chevron at the leg's midpoint, pointing in authored route order. */
export function boardLegArrow(leg: BoardRouteLeg): Point[] {
  const centre = quadraticPoint(leg.from, leg.control, leg.to, 0.5);
  const dx = leg.to.x - leg.from.x;
  const dy = leg.to.y - leg.from.y;
  const vertical = Math.abs(dy) > Math.abs(dx);
  const sign = Math.sign(vertical ? dy : dx);
  if (sign === 0) return [];
  const x = Math.round(centre.x / 2) * 2;
  const y = Math.round(centre.y / 2) * 2;
  const pixels: Point[] = [{ x: x - 2, y: y - 2 }];
  for (let step = 1; step <= 2; step += 1) {
    for (const side of [-1, 1]) {
      pixels.push(vertical
        ? { x: x - 2 + side * step * 4, y: y - 2 - sign * step * 4 }
        : { x: x - 2 - sign * step * 4, y: y - 2 + side * step * 4 });
    }
  }
  return pixels;
}

/** Axis-aligned rects (relative to the centre) of a stepped pixel ring: rows of `band` px. */
export function pixelRingRects(radius: number, thickness: number, band: number): { x: number; y: number; width: number; height: number }[] {
  if (!(radius > 0) || !(band > 0) || !(thickness > 0)) return [];
  const outer = Math.max(band, Math.round(radius / band) * band);
  const inner = Math.max(0, outer - thickness);
  const halfAt = (r: number, mid: number): number => Math.round(Math.sqrt(Math.max(0, r * r - mid * mid)) / band) * band;
  const rects: { x: number; y: number; width: number; height: number }[] = [];
  for (let dy = -outer; dy < outer; dy += band) {
    const mid = dy + band / 2;
    const outerHalf = halfAt(outer, mid);
    if (outerHalf <= 0) continue;
    const innerHalf = Math.abs(mid) < inner ? Math.min(outerHalf - band, halfAt(inner, mid)) : 0;
    if (innerHalf <= 0) {
      rects.push({ x: -outerHalf, y: dy, width: outerHalf * 2, height: band });
    } else {
      const side = outerHalf - innerHalf;
      rects.push({ x: -outerHalf, y: dy, width: side, height: band }, { x: innerHalf, y: dy, width: side, height: band });
    }
  }
  return rects;
}

/**
 * Logical px a touch target needs so it measures `cssPx` on screen at `displayScale` (CSS px per
 * logical px), capped so phone-portrait letterboxing cannot balloon it.
 */
export function touchTargetPx(cssPx: number, displayScale: number, cap: number): number {
  if (!(displayScale > 0)) return cap;
  return Math.min(cap, Math.ceil(cssPx / displayScale));
}
