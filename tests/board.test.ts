import { describe, expect, it } from "vitest";
import { boardCopy, routeLogCopy, titleCopy } from "../src/data/uiCopy";
import { MISSION_IDS } from "../src/data/campaign";
import { missionBoard, normalizeCampaignProgress } from "../src/systems/CampaignSystem";
import {
  BOARD_GRID,
  BOARD_TOKEN,
  boardDetailHeight,
  boardLegDots,
  boardLegArrow,
  boardNodeCentres,
  boardRouteLegs,
  boardShipMarker,
  boardTokenCaption,
  boardUnlockCaptionTop,
  initialBoardSelection,
  navigateBoard,
  pixelRingRects,
  touchTargetPx,
  type BoardNodeState,
} from "../src/ui/boardLayout";

const states = (completed: readonly string[], unlocked: readonly string[] = []): BoardNodeState[] =>
  missionBoard(normalizeCampaignProgress(completed, unlocked)).map((node) => node.state);

describe("board direction cues", () => {
  it("keeps every unlock pill below its name and clear of the detail panel", () => {
    for (const kind of ["desktop", "compact"] as const) {
      boardNodeCentres(kind).forEach((centre, index) => {
        // Name and lock-pill heights measured on phoneLandscape / desktop captures (pill = text + 2 px).
        const nameHeight = kind === "compact" ? 28 : 22;
        const pillHeight = kind === "compact" ? 24 : 20;
        const caption = boardTokenCaption(centre, nameHeight, 0);
        const top = boardUnlockCaptionTop(centre, caption.chipY, kind, index) - 12;
        expect(top).toBeGreaterThan(caption.labelY + nameHeight);
        const panelTop = 720 - 12 - boardDetailHeight(kind, kind === "compact" ? 1.48 : 1);
        if (index >= 3) expect(top + pillHeight).toBeLessThan(panelTop);
      });
    }
  });
  it("keeps the you-are-here ship off the route dots that run through node centres", () => {
    for (const kind of ["desktop", "compact"] as const) {
      for (const centre of boardNodeCentres(kind)) {
        const marker = boardShipMarker(centre);
        expect(marker.y - 28).toBeGreaterThan(centre.y);
        expect(Math.abs(marker.x - centre.x)).toBeGreaterThan(BOARD_TOKEN.ringRadius + 40);
      }
    }
  });
  it("points right, down around the bend, then left on an integer pixel grid", () => {
    const legs = boardRouteLegs(boardNodeCentres("desktop"), 220);
    for (const [index, leg] of legs.entries()) {
      const [tip, ...wings] = boardLegArrow(leg);
      expect(tip).toBeDefined();
      if (!tip) continue;
      expect(wings.every((point) => index < 2 ? point.x < tip.x : index === 2 ? point.y < tip.y : point.x > tip.x)).toBe(true);
      expect([tip, ...wings].every((point) => point.x % 2 === 0 && point.y % 2 === 0)).toBe(true);
    }
  });

  it("authors one new-idea hint for every stop", () => {
    for (const id of MISSION_IDS) expect(boardCopy.newIdea[id]).toMatch(/^new: /);
  });
});

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

  it("keeps integer-scale tokens, labels and chips separate from adjacent rows and the details", () => {
    const centres = boardNodeCentres("compact");
    expect(BOARD_TOKEN.artScale).toBe(1);
    expect(BOARD_TOKEN.artSize).toBe(160);
    for (const kind of ["desktop", "compact"] as const) {
      const points = boardNodeCentres(kind);
      // Measured on phoneLandscape / desktop captures (names ~28 / 22, chips ~28 / 28 logical px).
      const labelHeight = kind === "compact" ? 28 : 22;
      const chipHeight = 28;
      for (const centre of points.slice(0, 3)) {
        const caption = boardTokenCaption(centre, labelHeight, chipHeight);
        expect(caption.labelY).toBeGreaterThanOrEqual(centre.y + BOARD_TOKEN.selectRadius);
        expect(caption.chipY).toBeGreaterThan(caption.labelY + labelHeight);
        expect(caption.bottom).toBeLessThanOrEqual((points[3]?.y ?? 0) - BOARD_TOKEN.ringRadius);
      }
      for (const centre of points.slice(3)) {
        expect(boardTokenCaption(centre, labelHeight, chipHeight).bottom).toBeLessThanOrEqual(568);
      }
    }
    for (const centre of centres.slice(0, 3)) expect(centre.y - BOARD_TOKEN.selectRadius).toBeGreaterThanOrEqual(72);
    // Node tap zones exceed 44 CSS px in landscape and portrait without crossing neighbours.
    const fit = Math.min(844 / 1280, 390 / 720);
    for (const scale of [fit, 390 / 1280]) {
      expect(BOARD_TOKEN.hitWidth * scale).toBeGreaterThanOrEqual(44);
      expect(BOARD_TOKEN.hitHeight * scale).toBeGreaterThanOrEqual(44);
    }
    expect(touchTargetPx(44, fit, 88) * fit).toBeGreaterThanOrEqual(44);
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

  it("every arrow preserves a selectable destination across every progress combination", () => {
    for (let mask = 0; mask < 64; mask += 1) {
      const currentStates = states(MISSION_IDS.filter((_id, index) => (mask & (1 << index)) !== 0));
      currentStates.forEach((state, index) => {
        if (state === "locked") return;
        for (const move of ["left", "right", "up", "down", "next", "previous"] as const) {
          expect(currentStates[navigateBoard(currentStates, index, move)]).not.toBe("locked");
        }
      });
    }
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
