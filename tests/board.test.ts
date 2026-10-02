import { describe, expect, it } from "vitest";
import { boardCopy, routeLogCopy, titleCopy } from "../src/data/uiCopy";
import { MISSION_IDS } from "../src/data/campaign";
import { missionBoard, normalizeCampaignProgress } from "../src/systems/CampaignSystem";
import {
  BOARD_GRID,
  boardLegDots,
  boardNodeCentres,
  boardRouteLegs,
  initialBoardSelection,
  navigateBoard,
  pixelRingRects,
  touchTargetPx,
  type BoardNodeState,
} from "../src/ui/boardLayout";

const states = (completed: readonly string[], unlocked: readonly string[] = []): BoardNodeState[] =>
  missionBoard(normalizeCampaignProgress(completed, unlocked)).map((node) => node.state);

describe("board layout", () => {
  it("places six nodes in a U: top row left→right, bottom row right→left", () => {
    const centres = boardNodeCentres("desktop");
    expect(centres).toHaveLength(6);
    expect(centres.slice(0, 3).map((p) => p.x)).toEqual([280, 640, 1000]);
    expect(centres.slice(3).map((p) => p.x)).toEqual([1000, 640, 280]);
    const [topY, bottomY] = [centres[0]?.y ?? 0, centres[3]?.y ?? 0];
    expect(bottomY - topY).toBeGreaterThanOrEqual(200);
    for (const kind of ["desktop", "compact"] as const) {
      for (const point of boardNodeCentres(kind)) {
        expect(Number.isInteger(point.x) && Number.isInteger(point.y)).toBe(true);
        expect(point.y + 90).toBeLessThan(520);
      }
    }
  });

  it("route legs connect consecutive nodes and the corner bulges outward without touching nodes", () => {
    const centres = boardNodeCentres("desktop");
    const legs = boardRouteLegs(centres, 220);
    expect(legs).toHaveLength(5);
    expect(legs[2]?.control.x).toBe(1220);
    for (const leg of legs) {
      const dots = boardLegDots(leg, 16, 104);
      expect(dots.length).toBeGreaterThan(3);
      for (const dot of dots) {
        for (const centre of centres) expect(Math.hypot(dot.x - centre.x, dot.y - centre.y)).toBeGreaterThan(100);
        expect(dot.x).toBeLessThan(1240);
      }
    }
  });

  it("pixel rings are whole-band rows inside the radius", () => {
    const rects = pixelRingRects(86, 4, 4);
    expect(rects.length).toBeGreaterThan(40);
    for (const rect of rects) {
      expect(rect.height).toBe(4);
      expect(Math.abs(rect.y % 4)).toBe(0);
      expect(Math.abs(rect.x)).toBeLessThanOrEqual(88);
    }
    expect(pixelRingRects(0, 4, 4)).toEqual([]);
  });

  it("touch targets reach 44 CSS px but stay capped", () => {
    expect(touchTargetPx(44, 0.54, 100)).toBe(82);
    expect(touchTargetPx(44, 0.3, 90)).toBe(90);
    expect(touchTargetPx(44, 0, 90)).toBe(90);
    expect(touchTargetPx(44, 1, 90)).toBe(44);
  });
});

describe("board navigation", () => {
  it("fresh save: only Tea Moon is selectable, every arrow stays put", () => {
    const fresh = states([]);
    expect(fresh).toEqual(["available", "locked", "locked", "locked", "locked", "locked"]);
    expect(initialBoardSelection(fresh, 3)).toBe(0);
    for (const move of ["left", "right", "up", "down", "next", "previous"] as const) expect(navigateBoard(fresh, 0, move)).toBe(0);
  });

  it("walks the route across the corner and skips locked stops", () => {
    const midway = states(["tea-moon", "bento-belt", "matcha-nebula"]);
    expect(midway).toEqual(["completed", "completed", "completed", "available", "locked", "locked"]);
    expect(navigateBoard(midway, 0, "right")).toBe(1);
    expect(navigateBoard(midway, 1, "right")).toBe(2);
    // Past the top row's right end the route turns the corner to the bakery.
    expect(navigateBoard(midway, 2, "right")).toBe(3);
    expect(navigateBoard(midway, 2, "down")).toBe(3);
    // Bottom row: I'm Fine and Home are locked, so left stays; right goes back up the corner.
    expect(navigateBoard(midway, 3, "left")).toBe(3);
    expect(navigateBoard(midway, 3, "right")).toBe(2);
    expect(navigateBoard(midway, 3, "up")).toBe(2);
    expect(navigateBoard(midway, 0, "down")).toBe(3);
    expect(navigateBoard(midway, 3, "next")).toBe(0);
    expect(navigateBoard(midway, 0, "previous")).toBe(3);
    expect(navigateBoard(midway, 0, "left")).toBe(0);
  });

  it("all complete: up/down pairs columns and left on the bottom row heads home", () => {
    const done = states([...MISSION_IDS]);
    expect(done.every((state) => state === "completed")).toBe(true);
    expect(navigateBoard(done, 0, "down")).toBe(5);
    expect(navigateBoard(done, 1, "down")).toBe(4);
    expect(navigateBoard(done, 3, "left")).toBe(4);
    expect(navigateBoard(done, 4, "left")).toBe(5);
    expect(navigateBoard(done, 5, "left")).toBe(5);
    expect(navigateBoard(done, 5, "next")).toBe(0);
    expect(navigateBoard(done, 99, "right")).toBe(99);
  });

  it("explicit unlocks without completion are selectable; focus on a locked node falls forward", () => {
    const unlockedOnly = states([], [...MISSION_IDS]);
    expect(unlockedOnly.every((state) => state === "available")).toBe(true);
    const partial = states(["tea-moon"]);
    expect(initialBoardSelection(partial, 4)).toBe(0);
    expect(initialBoardSelection(partial, 1)).toBe(1);
    expect(initialBoardSelection(partial, -1)).toBe(0);
    expect(BOARD_GRID).toHaveLength(6);
  });
});

describe("board and title copy", () => {
  it("stays short, warm and score-free", () => {
    for (const line of [boardCopy.title, boardCopy.subtitle, boardCopy.launch, boardCopy.replay, boardCopy.back, titleCopy.boardButton, titleCopy.boardPrimaryButton]) {
      expect(line.length).toBeLessThanOrEqual(36);
      expect(line).not.toMatch(/%|score|rank/i);
    }
    expect(boardCopy.lockedAfter("Bento Belt")).toBe("After Bento Belt");
    expect(titleCopy.nextDeliveryButton("Bento Belt")).toBe("next: bento belt");
    expect(titleCopy.hintsReturning.some((hint) => hint.key === "M")).toBe(true);
    for (const id of MISSION_IDS) expect(routeLogCopy.captions[id].length).toBeGreaterThan(0);
  });
});
