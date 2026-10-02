import { describe, expect, it } from "vitest";
import { landingCopy } from "../src/data/landingCopy";
import { landingScenery } from "../src/data/landingScenery";
import { sampleTickerLines, titleCopy, uiKitCopy } from "../src/data/uiCopy";
import {
  COMPACT_SECONDARY_MIN_PX,
  ELLIPSIS,
  TICKER_METRICS,
  fitsTicker,
  tickerCharsPerLine,
  uiSecondaryTextSize,
  uiTextSize,
  wrapMonoLines,
} from "../src/ui/layout";
import { SOUND_TOAST_TOP_FRACTION, soundToastAnchor, soundToastTopFraction } from "../src/ui/soundToastModel";

/** Every chatter line a scene can push into its DashboardTicker. */
function landingChatter(): string[] {
  return [...Object.values(landingCopy.notes), ...Object.values(landingCopy.incidentNotes), landingCopy.retrying];
}

describe("wrapMonoLines", () => {
  it("wraps on word boundaries without exceeding the line length", () => {
    const lines = wrapMonoLines("please apply soup-facing thrust", 20, 2);
    expect(lines).toEqual(["please apply", "soup-facing thrust"]);
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(20);
  });

  it("keeps short text on one line and collapses whitespace", () => {
    expect(wrapMonoLines("  tea   is  warm ", 30, 2)).toEqual(["tea is warm"]);
    expect(wrapMonoLines("", 30, 2)).toEqual([]);
  });

  it("ends the last allowed line with an ellipsis when text still overflows", () => {
    const lines = wrapMonoLines("one two three four five six seven", 9, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1]?.endsWith(ELLIPSIS)).toBe(true);
    expect(lines[1]?.length).toBeLessThanOrEqual(9);
  });

  it("hard-splits a single word wider than the line", () => {
    expect(wrapMonoLines("supercalifragilistic", 8, 3)).toEqual(["supercal", "ifragili", "stic"]);
  });

  it("returns nothing for a non-positive width", () => {
    expect(wrapMonoLines("tea", 0, 2)).toEqual([]);
  });
});

describe("ticker capacity", () => {
  it("matches the DashboardTicker chrome around the text", () => {
    const charWidth = TICKER_METRICS.fontPx * TICKER_METRICS.monoAdvanceEm;
    const width = 300;
    expect(tickerCharsPerLine(width)).toBe(Math.floor((width - TICKER_METRICS.textInsetLeft - TICKER_METRICS.textInsetRight) / charWidth));
  });

  it("flags the one-line overflow that clipped landing punchlines", () => {
    // The round-2 bug: a 300px one-line ticker cut "...soup-facing thrust" to "...thr…".
    // Pinned to the old 300px panel so this stays a regression marker even as the HUD widens.
    const roundTwoTickerWidth = 300;
    expect(fitsTicker(landingCopy.notes.descendingIdle, roundTwoTickerWidth, 1)).toBe(false);
  });

  it("fits every landing chatter line in the two-line landing ticker", () => {
    for (const line of landingChatter()) {
      expect(fitsTicker(line, landingScenery.hud.width, 2), line).toBe(true);
    }
  });

  it("fits the gallery sample lines in the gallery ticker", () => {
    for (const line of sampleTickerLines) expect(fitsTicker(line, 376, 2), line).toBe(true);
  });
});

describe("compact secondary text", () => {
  it("lifts phone secondary text to the floor but leaves desktop sizes alone", () => {
    expect(uiSecondaryTextSize(13, 1)).toBe(uiTextSize(13, 1));
    expect(uiSecondaryTextSize(13, 1.48)).toBe(uiTextSize(COMPACT_SECONDARY_MIN_PX, 1.48));
    // ~0.54 CSS px per logical px on an 844x390 phone: secondary text clears 10 CSS px.
    expect(uiSecondaryTextSize(13, 1.48) * 0.54).toBeGreaterThanOrEqual(10);
    expect(uiSecondaryTextSize(20, 1.48)).toBe(uiTextSize(20, 1.48));
  });

  it("keeps compact title copy short enough for one line", () => {
    // 38 mono chars at compact scale end inside the CTA column, clear of the delivery card.
    for (const line of Object.values(titleCopy.saveNoticeCompact)) expect(line.length).toBeLessThanOrEqual(38);
    expect(titleCopy.itemsCompact.length).toBeLessThanOrEqual(18);
    expect(uiKitCopy.buttonLabels.disabled).toBe("disabled");
  });
});

describe("sound toast placement", () => {
  it("drops below the flight and landing HUD strips, stays high elsewhere", () => {
    expect(soundToastTopFraction(["TitleScene"])).toBe(SOUND_TOAST_TOP_FRACTION);
    expect(soundToastTopFraction([])).toBe(SOUND_TOAST_TOP_FRACTION);
    const flight = soundToastTopFraction(["FlightScene"]);
    // Flight chatter bar ends ~51 px (desktop) / ~82 px (phone) on the 720 px canvas.
    expect(flight * 720).toBeGreaterThan(82);
    expect(soundToastTopFraction(["LandingScene", "TitleScene"])).toBe(soundToastTopFraction(["LandingScene"]));
  });

  it("applies the fraction to the canvas rect and clamps bad input", () => {
    expect(soundToastAnchor({ left: 0, top: 0, width: 1280, height: 720 }, 0.14).top).toBe(101);
    expect(soundToastAnchor({ left: 0, top: 0, width: 1280, height: 720 }, Number.NaN).top).toBe(36);
    expect(soundToastAnchor({ left: 0, top: 0, width: 1280, height: 720 }, 4).top).toBe(720);
  });
});
