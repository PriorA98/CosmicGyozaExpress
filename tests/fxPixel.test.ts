import { describe, expect, it } from "vitest";
import { colors } from "../src/game/designTokens";
import { flashAlphaAt, irisHalfWidth, shakeOffset, snapToGrid, steppedFadeAlpha, warmRecolor, type WarmRampStop } from "../src/fx/fxMath";
import { BURST_TUNING, FLASH_TUNING, PARTICLE_SHEETS, PIXEL_FLAME_TUNING, SHAKE_MAX_OFFSET_PX, SHAKE_TUNING, THRUST_TUNING, TRANSITION_TUNING } from "../src/fx/fxPresets";

function rgbOf(hex: string): readonly [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

describe("pixel-stepped transitions", () => {
  it("quantises the iris edge to whole blocks and closes outside the radius", () => {
    const block = TRANSITION_TUNING.blockPx;
    for (let dy = -100; dy <= 100; dy += 3) {
      const half = irisHalfWidth(dy, 100, block);
      if (Math.abs(dy) >= 100) expect(half).toBe(-1);
      else {
        expect(half % block).toBe(0);
        expect(half).toBeLessThanOrEqual(Math.sqrt(100 * 100 - dy * dy));
      }
    }
    expect(irisHalfWidth(0, 0, block)).toBe(-1);
    expect(irisHalfWidth(Number.NaN, 40, block)).toBe(-1);
  });

  it("uses hard-edged rim rings on the block grid and a warm ink", () => {
    expect(TRANSITION_TUNING.rimColors.length).toBeGreaterThanOrEqual(2);
    expect(TRANSITION_TUNING.blockPx).toBeGreaterThanOrEqual(2);
    expect(Number.isInteger(TRANSITION_TUNING.blockPx)).toBe(true);
    expect(TRANSITION_TUNING.handoffFlashMs).toBeLessThan(TRANSITION_TUNING.handoffMs);
  });

  it("snaps to the grid and tolerates bad input", () => {
    expect(snapToGrid(7, 4)).toBe(8);
    expect(snapToGrid(5, 4)).toBe(4);
    expect(snapToGrid(3.4, 0)).toBe(3);
    expect(snapToGrid(Number.NaN, 4)).toBe(0);
  });
});

describe("warm flash", () => {
  it("is warm cream (red > green > blue), not neutral grey", () => {
    const [r, g, b] = rgbOf(FLASH_TUNING.color);
    expect(r).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(b);
    expect(r - b).toBeGreaterThan(40);
    // Additive warm light, never a normal-blend veil (which turns grey-brown over navy).
    expect(FLASH_TUNING.additive).toBe(true);
    expect(FLASH_TUNING.peakAlpha).toBeLessThanOrEqual(0.9);
  });

  it("steps down in hard steps from the peak to zero", () => {
    const seen = new Set<number>();
    for (let t = 0; t < 1; t += 0.01) seen.add(Number(flashAlphaAt(t, FLASH_TUNING.peakAlpha, FLASH_TUNING.steps).toFixed(4)));
    expect(seen.size).toBe(FLASH_TUNING.steps);
    expect(flashAlphaAt(0, 0.6, 4)).toBe(0.6);
    expect(flashAlphaAt(1, 0.6, 4)).toBe(0);
  });
});

describe("stepped particle fade", () => {
  it("pops particles out instead of fading them through muddy partial alpha", () => {
    for (const tuning of Object.values(BURST_TUNING)) expect(steppedFadeAlpha(0.95, tuning.fade)).toBe(1);
    expect(steppedFadeAlpha(0.95, THRUST_TUNING.fade)).toBe(1);
  });

  it("holds, then drops in the configured number of steps, reaching 0 at the end", () => {
    const fade = { start: 1, holdUntil: 0.6, steps: 3 };
    expect(steppedFadeAlpha(0, fade)).toBe(1);
    expect(steppedFadeAlpha(0.6, fade)).toBe(1);
    expect(steppedFadeAlpha(1, fade)).toBe(0);
    const levels = new Set<number>();
    for (let t = 0.61; t < 1; t += 0.01) levels.add(Number(steppedFadeAlpha(t, fade).toFixed(4)));
    expect(levels.size).toBe(3);
  });
});

describe("pixel particle contract", () => {
  it("renders every sheet at its integer artScale of 2", () => {
    for (const sheet of Object.values(PARTICLE_SHEETS)) {
      expect(Number.isInteger(sheet.artScale)).toBe(true);
      expect(sheet.artScale).toBe(2);
    }
  });

  it("keeps dust and flour on the cream frames (no grey tail frames)", () => {
    for (const kind of ["dust", "incidentFlour"] as const) {
      const frames = BURST_TUNING[kind].anim.frames;
      expect(Math.max(...frames)).toBeLessThanOrEqual(3);
    }
    // Sparkles never land on the dim last frame, which reads as a dirt cross over navy.
    expect(BURST_TUNING.sparkle.anim.frames).not.toContain(PARTICLE_SHEETS.sparkle.frameCount - 1);
    expect(BURST_TUNING.sparkle.tints).toEqual([0xffffff]);
  });

  it("uses only the flame-tongue frames for the pixel nozzle flame", () => {
    expect(PIXEL_FLAME_TUNING.frames.length).toBe(PIXEL_FLAME_TUNING.powerThresholds.length);
    for (const frame of PIXEL_FLAME_TUNING.frames) expect(frame).toBeLessThan(3);
    const thresholds = [...PIXEL_FLAME_TUNING.powerThresholds];
    expect(thresholds).toEqual([...thresholds].sort((a, b) => a - b));
    expect(THRUST_TUNING.frames.every((frame) => frame < PARTICLE_SHEETS.thrust.frameCount)).toBe(true);
  });
});

describe("warm recolour", () => {
  const ramp: readonly WarmRampStop[] = [
    { at: 0.42, rgb: rgbOf(colors.borderStrong) },
    { at: 1, rgb: rgbOf(colors.plaster) },
  ];

  it("maps neutral greys onto the warm ramp and leaves saturated pixels alone", () => {
    const warm = warmRecolor(90, 90, 92, 30, { min: 0.42, max: 1 }, ramp);
    expect(warm).not.toBeNull();
    if (warm) expect(warm[0]).toBeGreaterThanOrEqual(warm[2]);
    expect(warmRecolor(224, 138, 75, 30, { min: 0.42, max: 1 }, ramp)).toBeNull();
  });
});

describe("world shake", () => {
  it("moves in whole grid steps within the amplitude and ends on time", () => {
    for (let roll = 0; roll <= 1; roll += 0.05) {
      const offset = shakeOffset(10, 200, 8, SHAKE_TUNING.gridPx, roll);
      expect(Math.abs(offset) % SHAKE_TUNING.gridPx).toBe(0);
      expect(Math.abs(offset)).toBeLessThanOrEqual(8);
    }
    expect(shakeOffset(200, 200, 8, 2, 1)).toBe(0);
    expect(SHAKE_MAX_OFFSET_PX).toBe(SHAKE_TUNING.strong.amplitudePx);
  });
});
