import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({ default: { GameObjects: { Sprite: class {} }, Math: { Clamp: (v: number) => v } } }));

const { rotationCellIndex } = await import("../src/entities/GyozaShip");

describe("rotationCellIndex", () => {
  it("maps upright to cell 0", () => {
    expect(rotationCellIndex(0, 32)).toBe(0);
  });

  it("picks the nearest clockwise cell", () => {
    const step = (Math.PI * 2) / 32;
    expect(rotationCellIndex(step * 3, 32)).toBe(3);
    expect(rotationCellIndex(step * 3.4, 32)).toBe(3);
    expect(rotationCellIndex(step * 3.6, 32)).toBe(4);
  });

  it("wraps negative and multi-turn angles", () => {
    const step = (Math.PI * 2) / 32;
    expect(rotationCellIndex(-step, 32)).toBe(31);
    expect(rotationCellIndex(Math.PI * 2, 32)).toBe(0);
    expect(rotationCellIndex(-Math.PI / 2, 32)).toBe(24);
    expect(rotationCellIndex(Math.PI * 4 + step * 2, 32)).toBe(2);
  });
});
