import { describe, expect, it } from "vitest";
import { titleCopy, stateLabels, uiKitCopy } from "../src/data/uiCopy";
import {
  ELLIPSIS,
  MIN_ESSENTIAL_TEXT_PX,
  clamp01,
  essentialTextSize,
  formatReadout,
  hitTestZones,
  isLikelyTouchDevice,
  monoCharsThatFit,
  rowOffsets,
  rowWidth,
  segmentFills,
  segmentWidth,
  stackOffsets,
  toArtPixels,
  truncateToChars,
  typewriterVisibleChars,
  zoneContains,
  type TouchZoneHitArea,
} from "../src/ui/layout";
import { METER_ACCENT_COLOR, STATE_SWATCHES, UI_STATES, meterAccentColor, stateSwatch } from "../src/ui/statePalette";

describe("ui layout helpers", () => {
  it("clamps to 0..1 and treats non-finite values as empty", () => {
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(0.4)).toBe(0.4);
    expect(clamp01(3)).toBe(1);
    expect(clamp01(Number.NaN)).toBe(0);
    expect(clamp01(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("keeps essential text at or above the readability floor", () => {
    expect(MIN_ESSENTIAL_TEXT_PX).toBe(13);
    expect(essentialTextSize(9)).toBe(13);
    expect(essentialTextSize(15.4)).toBe(15);
    expect(essentialTextSize(Number.NaN)).toBe(13);
  });

  it("fills meter segments full-first with at most one partial", () => {
    expect(segmentFills(0.5, 4)).toEqual([1, 1, 0, 0]);
    const partial = segmentFills(0.3, 4);
    expect(partial[0]).toBe(1);
    expect(partial[1]).toBeCloseTo(0.2);
    expect(partial.slice(2)).toEqual([0, 0]);
    expect(segmentFills(2, 3)).toEqual([1, 1, 1]);
    expect(segmentFills(-1, 3)).toEqual([0, 0, 0]);
    expect(segmentFills(0.5, 0)).toHaveLength(1);
  });

  it("never lights a phantom partial segment from float noise", () => {
    const cases: readonly [number, number][] = [
      [0.7, 7],
      [0.3, 3],
      [0.1, 1],
      [0.8, 8],
      [Math.round(0.7 / 0.005) * 0.005, 7],
      [0.1 + 0.2, 3],
    ];
    for (const [value, lit] of cases) {
      const fills = segmentFills(value, 10);
      expect(fills.filter((fill) => fill === 1)).toHaveLength(lit);
      expect(fills.slice(lit).every((fill) => fill === 0)).toBe(true);
    }
    // Real partials survive, slivers snap.
    expect(segmentFills(0.75, 10)[7]).toBeCloseTo(0.5);
    expect(segmentFills(0.7004, 10)[7]).toBe(0);
    expect(segmentFills(0.6996, 10)[6]).toBe(1);
  });

  it("sizes segments so segments plus gaps fill the bar exactly", () => {
    const width = segmentWidth(236, 10, 2);
    expect(width * 10 + 2 * 9).toBeCloseTo(236);
    expect(segmentWidth(4, 10, 2)).toBe(1);
  });

  it("formats readouts with stable width and no negative zero", () => {
    expect(formatReadout(42.5, { decimals: 1, width: 6, unit: "px/s" })).toBe("  42.5 px/s");
    expect(formatReadout(-0.04, { decimals: 1 })).toBe("0.0");
    expect(formatReadout(-12, { width: 4, unit: "deg", signed: true })).toBe(" -12 deg");
    expect(formatReadout(12, { width: 4, signed: true })).toBe(" +12");
    expect(formatReadout(0, { signed: true })).toBe("+0");
    expect(formatReadout(Number.NaN, { decimals: 2 })).toBe("0.00");
    // Same width for every value in range keeps HUD columns from jittering.
    const widths = [0, 9.9, 99.9, 128.4].map((value) => formatReadout(value, { decimals: 1, width: 6 }).length);
    expect(new Set(widths).size).toBe(1);
  });

  it("reveals typewriter characters over time", () => {
    expect(typewriterVisibleChars(0, 30, 10)).toBe(0);
    expect(typewriterVisibleChars(100, 30, 10)).toBe(3);
    expect(typewriterVisibleChars(10_000, 30, 10)).toBe(10);
    expect(typewriterVisibleChars(100, 0, 10)).toBe(10);
    expect(typewriterVisibleChars(100, 30, 0)).toBe(0);
  });

  it("truncates single lines with an ellipsis", () => {
    expect(truncateToChars("tea", 10)).toBe("tea");
    expect(truncateToChars("tea moon", 8)).toBe("tea moon");
    expect(truncateToChars("tea moon rabbit", 9)).toBe(`tea moon${ELLIPSIS}`);
    expect(truncateToChars("tea moon rabbit", 5)).toBe(`tea${ELLIPSIS}`);
    expect(truncateToChars("tea", 1)).toBe(ELLIPSIS);
    expect(truncateToChars("tea", 0)).toBe("");
    expect(truncateToChars("tea", Number.NaN)).toBe("tea");
    expect(truncateToChars("a long line", 6).length).toBeLessThanOrEqual(6);
  });

  it("counts monospaced characters that fit", () => {
    expect(monoCharsThatFit(100, 8.4)).toBe(11);
    expect(monoCharsThatFit(-5, 8)).toBe(0);
    expect(monoCharsThatFit(100, 0)).toBe(0);
  });

  it("snaps screen lengths to whole art pixels", () => {
    expect(toArtPixels(48, 2)).toBe(24);
    expect(toArtPixels(49, 2)).toBe(25);
    expect(toArtPixels(1, 2)).toBe(1);
    expect(toArtPixels(30, 0)).toBe(30);
  });

  it("lays out stacks and rows", () => {
    expect(stackOffsets(3, 10, 20, 4)).toEqual([10, 34, 58]);
    expect(stackOffsets(-1, 0, 10)).toEqual([]);
    expect(rowWidth([10, 20, 30], 5)).toBe(70);
    expect(rowWidth([], 5)).toBe(0);
    expect(rowOffsets([10, 20, 30], 5, 100)).toEqual([100, 115, 140]);
  });
});

describe("touch zones", () => {
  const zones: readonly TouchZoneHitArea[] = [
    { id: "left", shape: { kind: "circle", x: 100, y: 600, radius: 50 } },
    { id: "thrust", shape: { kind: "rect", x: 1000, y: 560, width: 200, height: 120 } },
    { id: "overlay", shape: { kind: "rect", x: 1150, y: 560, width: 100, height: 60 } },
  ];

  it("hit-tests circles and rects inclusively", () => {
    expect(zoneContains({ kind: "circle", x: 0, y: 0, radius: 10 }, 10, 0)).toBe(true);
    expect(zoneContains({ kind: "circle", x: 0, y: 0, radius: 10 }, 8, 8)).toBe(false);
    expect(zoneContains({ kind: "rect", x: 0, y: 0, width: 10, height: 10 }, 10, 10)).toBe(true);
    expect(zoneContains({ kind: "rect", x: 0, y: 0, width: 10, height: 10 }, 11, 5)).toBe(false);
  });

  it("returns the top-most zone or null", () => {
    expect(hitTestZones(zones, 110, 610)).toBe("left");
    expect(hitTestZones(zones, 1020, 600)).toBe("thrust");
    expect(hitTestZones(zones, 1160, 570)).toBe("overlay");
    expect(hitTestZones(zones, 640, 360)).toBeNull();
  });

  it("only treats coarse-pointer touch devices as touch-first", () => {
    expect(isLikelyTouchDevice({ maxTouchPoints: 5, coarsePointer: true, hasTouchEvents: true })).toBe(true);
    expect(isLikelyTouchDevice({ maxTouchPoints: 0, coarsePointer: true, hasTouchEvents: true })).toBe(true);
    expect(isLikelyTouchDevice({ maxTouchPoints: 10, coarsePointer: false, hasTouchEvents: true })).toBe(false);
    expect(isLikelyTouchDevice({ maxTouchPoints: 0, coarsePointer: false, hasTouchEvents: false })).toBe(false);
  });
});

describe("state palette", () => {
  const hex = /^#[0-9A-Fa-f]{6}$/;

  it("defines a swatch and label for every gentle state", () => {
    for (const state of UI_STATES) {
      const swatch = stateSwatch(state);
      expect(swatch).toBe(STATE_SWATCHES[state]);
      expect(swatch.background).toMatch(hex);
      expect(swatch.foreground).toMatch(hex);
      expect(swatch.dot).toMatch(hex);
      expect(swatch.foreground).not.toBe(swatch.background);
      expect(stateLabels[state].length).toBeGreaterThan(0);
    }
    expect(Object.keys(STATE_SWATCHES).sort()).toEqual([...UI_STATES].sort());
  });

  it("uses the design-system state colours", () => {
    expect(stateSwatch("incident").dot.toUpperCase()).toBe("#C26954");
    expect(stateSwatch("docking").dot.toUpperCase()).toBe("#E08A4B");
    expect(stateSwatch("delivering").dot.toUpperCase()).toBe("#9B8FB8");
  });

  it("maps meter accents to tokens", () => {
    for (const accent of ["ember", "sage", "dusk", "amber"] as const) {
      expect(meterAccentColor(accent)).toBe(METER_ACCENT_COLOR[accent]);
      expect(meterAccentColor(accent)).toMatch(hex);
    }
  });
});

describe("ui copy", () => {
  it("keeps the title copy short, lowercase, and complete", () => {
    expect(titleCopy.startButton).toBe("deliver tea to the moon");
    expect(titleCopy.startButton).toBe(titleCopy.startButton.toLowerCase());
    expect(titleCopy.deliveredBadge).toContain("postcard");
    expect(titleCopy.hints.some((hint) => hint.key === "M" && hint.label === "sound")).toBe(true);
    expect(titleCopy.subtitle.length).toBeLessThanOrEqual(48);
  });

  it("labels every ui-kit touch zone and button state", () => {
    expect(Object.values(uiKitCopy.touchLabels).every((label) => label.length > 0)).toBe(true);
    expect(Object.values(uiKitCopy.buttonLabels).every((label) => label.length > 0)).toBe(true);
  });
});
