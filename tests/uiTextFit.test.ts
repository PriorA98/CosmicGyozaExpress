import { describe, expect, it } from "vitest";
import { MISSION_IDS, resolveMission } from "../src/data/campaign";
import { clampWrappedText, quoteLinesThatFit } from "../src/ui/textFit";

const wrap = (text: string): string[] => text.match(/.{1,28}/g) ?? [];

describe("wrapped title quotes", () => {
  it("preserves short quotes and accounts for the ellipsis at a full line boundary", () => {
    expect(clampWrappedText("A warm parcel.", 2, wrap)).toBe("A warm parcel.");
    const text = "a".repeat(85);
    const clamped = clampWrappedText(text, 2, wrap);
    expect(clamped.endsWith("…")).toBe(true);
    expect(wrap(clamped)).toHaveLength(2);
    expect(clamped.length).toBeLessThanOrEqual(56);
  });

  it("fits every mission request into two lines without changing a fitting quote", () => {
    for (const id of MISSION_IDS) {
      const quote = `“${resolveMission(id).requestText}”`;
      const fitted = clampWrappedText(quote, 2, wrap);
      expect(wrap(fitted).length).toBeLessThanOrEqual(2);
      if (wrap(quote).length <= 2) expect(fitted).toBe(quote);
      else expect(fitted.endsWith("…")).toBe(true);
    }
  });

  it("ellipsizes at a word boundary when the ellipsis would add another line", () => {
    const fitted = clampWrappedText("The lunch platform keeps drifting sideways.", 1, wrap);
    expect(fitted).toBe("The lunch platform keeps…");
    expect(wrap(fitted)).toHaveLength(1);
  });
});

describe("quote lines that fit above the cargo tray", () => {
  it("counts whole lines and never drops below one", () => {
    expect(quoteLinesThatFit(60, 20)).toBe(3);
    expect(quoteLinesThatFit(59, 20)).toBe(2);
    expect(quoteLinesThatFit(5, 20)).toBe(1);
    expect(quoteLinesThatFit(-10, 20)).toBe(1);
    expect(quoteLinesThatFit(60, 0)).toBe(1);
  });

  it("allows two lines in the exact measured space without trailing line spacing", () => {
    expect(quoteLinesThatFit(52, 28, 4)).toBe(2);
    expect(quoteLinesThatFit(51, 28, 4)).toBe(1);
  });
});
