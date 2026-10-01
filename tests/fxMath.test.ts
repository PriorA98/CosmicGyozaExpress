import { describe, expect, it } from "vitest";
import { ASSET, ASSET_MANIFEST } from "../src/data/assetManifest";
import {
  allowedBurstCount,
  coverRadius,
  easeInOutCubic,
  emissionStep,
  exhaustAngleDegrees,
  inRange,
  nozzlePoint,
  thrustRate,
  type EmissionStep,
} from "../src/fx/fxMath";
import { BURST_TUNING, FX_BUDGET, PARTICLE_SHEETS, STEAM_TUNING, THRUST_TUNING, type BurstKind } from "../src/fx/fxPresets";

describe("nozzlePoint / exhaustAngleDegrees", () => {
  it("puts the nozzle below an upright ship and exhaust pointing down", () => {
    const out = nozzlePoint(100, 100, 0, 40, { x: 0, y: 0 });
    expect(out.x).toBeCloseTo(100);
    expect(out.y).toBeCloseTo(140);
    expect(exhaustAngleDegrees(0)).toBeCloseTo(90);
  });

  it("rotates with the ship (nose right -> exhaust left)", () => {
    const out = nozzlePoint(0, 0, Math.PI / 2, 10, { x: 0, y: 0 });
    expect(out.x).toBeCloseTo(-10);
    expect(out.y).toBeCloseTo(0);
    expect(Math.abs(exhaustAngleDegrees(Math.PI / 2))).toBeCloseTo(180);
    expect(exhaustAngleDegrees(-Math.PI / 2)).toBeCloseTo(0);
  });
});

describe("emissionStep", () => {
  it("carries fractional particles across frames", () => {
    const step: EmissionStep = { count: 0, carry: 0 };
    let carry = 0;
    let total = 0;
    for (let frame = 0; frame < 60; frame += 1) {
      emissionStep(carry, 1000 / 60, 30, step);
      carry = step.carry;
      total += step.count;
    }
    expect(total).toBeGreaterThanOrEqual(29);
    expect(total).toBeLessThanOrEqual(30);
  });

  it("ignores bad input and clamps huge frame gaps", () => {
    const step: EmissionStep = { count: 0, carry: 0 };
    expect(emissionStep(0, Number.NaN, 30, step).count).toBe(0);
    expect(emissionStep(0, 16, -5, step).count).toBe(0);
    expect(emissionStep(Number.NaN, 16, 0, step).carry).toBe(0);
    // A 5 s stall emits at most 100 ms worth.
    expect(emissionStep(0, 5000, 100, step).count).toBe(10);
  });
});

describe("thrustRate", () => {
  it("scales between the idle floor and full rate", () => {
    expect(thrustRate(0, 40, 0.5)).toBe(20);
    expect(thrustRate(1, 40, 0.5)).toBe(40);
    expect(thrustRate(5, 40, 0.5)).toBe(40);
    expect(thrustRate(Number.NaN, 40, 0.5)).toBe(20);
  });
});

describe("allowedBurstCount", () => {
  it("respects the per-burst cap and the scene budget", () => {
    expect(allowedBurstCount(10, 0, 300, 48, null)).toBe(10);
    expect(allowedBurstCount(500, 0, 300, 48, null)).toBe(48);
    expect(allowedBurstCount(20, 290, 300, 48, null)).toBe(10);
    expect(allowedBurstCount(20, 300, 300, 48, null)).toBe(0);
    expect(allowedBurstCount(20, 999, 300, 48, null)).toBe(0);
  });

  it("thins bursts under reduced motion but keeps at least one", () => {
    expect(allowedBurstCount(20, 0, 300, 48, 0.5)).toBe(10);
    expect(allowedBurstCount(1, 0, 300, 48, 0.5)).toBe(1);
  });

  it("rejects non-positive or non-finite requests", () => {
    expect(allowedBurstCount(0, 0, 300, 48, null)).toBe(0);
    expect(allowedBurstCount(-3, 0, 300, 48, null)).toBe(0);
    expect(allowedBurstCount(Number.NaN, 0, 300, 48, null)).toBe(0);
  });
});

describe("transition math", () => {
  it("eases from 0 to 1 symmetrically and clamps", () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5);
    expect(easeInOutCubic(-1)).toBe(0);
    expect(easeInOutCubic(2)).toBe(1);
  });

  it("covers the farthest corner of the viewport", () => {
    expect(coverRadius(640, 360, 1280, 720)).toBeGreaterThanOrEqual(Math.hypot(640, 360));
    expect(coverRadius(0, 0, 1280, 720)).toBeGreaterThanOrEqual(Math.hypot(1280, 720));
  });

  it("interpolates ranges with a clamped roll", () => {
    expect(inRange({ min: 10, max: 20 }, 0.5)).toBe(15);
    expect(inRange({ min: 10, max: 20 }, 3)).toBe(20);
  });
});

describe("fx presets", () => {
  it("matches the particle sheet contract in the asset manifest", () => {
    const expected = {
      thrust: { key: ASSET.fxThrust, frameWidth: 16, frameHeight: 24, frameCount: 8 },
      dust: { key: ASSET.fxDust, frameWidth: 16, frameHeight: 16, frameCount: 6 },
      sparkle: { key: ASSET.fxSparkle, frameWidth: 8, frameHeight: 8, frameCount: 4 },
      steam: { key: ASSET.fxSteam, frameWidth: 12, frameHeight: 20, frameCount: 6 },
      star: { key: ASSET.fxStar, frameWidth: 5, frameHeight: 5, frameCount: 3 },
    } as const;
    for (const [id, sheet] of Object.entries(expected)) {
      const actual = PARTICLE_SHEETS[id as keyof typeof expected];
      expect(actual).toMatchObject(sheet);
      expect(actual.artScale).toBe(2);
      expect(ASSET_MANIFEST.some((entry) => entry.key === sheet.key)).toBe(true);
    }
  });

  it("keeps every emitter inside the 300 live-particle scene budget", () => {
    expect(FX_BUDGET.maxLiveParticlesPerScene).toBeLessThanOrEqual(300);
    // Two thrust trails (title/landing worst case) plus steam and a pair of capped bursts.
    const worstCase = THRUST_TUNING.ratePerSecond * (THRUST_TUNING.lifespanMs.max / 1000) * 2 + FX_BUDGET.steamMaxAlivePerSource * 2 + FX_BUDGET.burstMaxCount * 2;
    expect(worstCase).toBeLessThanOrEqual(FX_BUDGET.maxLiveParticlesPerScene);
    expect(FX_BUDGET.reducedMotionFactor).toBeGreaterThan(0);
    expect(FX_BUDGET.reducedMotionFactor).toBeLessThan(1);
  });

  it("has coherent burst, thrust, and steam ranges", () => {
    const kinds = Object.keys(BURST_TUNING) as BurstKind[];
    for (const kind of kinds) {
      const tuning = BURST_TUNING[kind];
      expect(tuning.speed.min).toBeLessThanOrEqual(tuning.speed.max);
      expect(tuning.lifespanMs.min).toBeLessThanOrEqual(tuning.lifespanMs.max);
      expect(tuning.count).toBeLessThanOrEqual(FX_BUDGET.burstMaxCount);
      expect(tuning.tints.length).toBeGreaterThan(0);
      expect(tuning.anim.durationMs).toBeGreaterThan(0);
      // Once-through puffs must outlast the particle so the grey breakup frames only show while fading.
      if (!tuning.anim.loop) expect(tuning.anim.durationMs).toBeGreaterThanOrEqual(tuning.lifespanMs.max);
    }
    expect(THRUST_TUNING.lifespanMs.min).toBeLessThanOrEqual(THRUST_TUNING.lifespanMs.max);
    expect(THRUST_TUNING.minRateFactor).toBeGreaterThan(0);
    expect(STEAM_TUNING.lifespanMs.min).toBeLessThanOrEqual(STEAM_TUNING.lifespanMs.max);
    expect(STEAM_TUNING.riseSpeed.min).toBeGreaterThan(0);
  });
});
