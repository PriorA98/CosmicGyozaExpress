import { describe, expect, it } from "vitest";
import { routeForMission } from "../src/data/campaign";
import { shipTuning } from "../src/data/tuning";
import { naiveDefeated, runHintedPilot, runNaivePilot } from "../src/dev/routeChallenge";
import { gravityProfile, riverShare, sampleForceZone, sampleGustCycle, warpAt } from "../src/systems/ForceFieldSystem";
import { createSeekerStates, seekerContact, seekerNoiseShare, stepSeeker, type SeekerState } from "../src/systems/SeekerSystem";
import type { ForceZoneDefinition, GustCycle, MissionId, SeekerDefinition } from "../src/types/campaign";

describe("phase 4 force additions", () => {
  it("inverse gravity peaks at the core edge, stays continuous, and never beats thrust", () => {
    expect(gravityProfile(300, 200, "inverse", 200)).toBe(300);
    expect(gravityProfile(300, 200, "inverse", 400)).toBe(150);
    expect(gravityProfile(300, 200, "inverse", 100)).toBe(150);
    expect(gravityProfile(300, 200, "inverse", 0)).toBe(0);
    expect(gravityProfile(70, 180, "flat", 500)).toBe(70);
    for (let d = 1; d < 1200; d += 13) expect(gravityProfile(300, 200, "inverse", d)).toBeLessThan(shipTuning.thrustAcceleration);
  });

  it("the oven mouth swallows only inside its radius", () => {
    const route = routeForMission("black-hole-bakery");
    const well = route.forceZones.find((zone) => zone.kind === "radial-gravity");
    if (!well || well.kind !== "radial-gravity" || !well.warp) throw new Error("bakery well with warp expected");
    expect(warpAt(route.forceZones, well.center)?.warp.exit).toEqual(well.warp.exit);
    expect(warpAt(route.forceZones, { x: well.center.x + well.warp.radius + 1, y: well.center.y })).toBeNull();
    // The toaster pops you out somewhere calm-ish, never back into the oven.
    expect(Math.hypot(well.warp.exit.x - well.center.x, well.warp.exit.y - well.center.y)).toBeGreaterThan(well.radius * 0.9);
  });

  it("alternating gusts flip each cycle and the warning already shows the coming direction", () => {
    const cycle: GustCycle = { warningMs: 1000, attackMs: 500, sustainMs: 1000, releaseMs: 500, calmMs: 1000, phaseOffsetMs: 0, alternate: true };
    expect(sampleGustCycle(cycle, 0)).toMatchObject({ phase: "warning", direction: 1 });
    expect(sampleGustCycle(cycle, 2000)).toMatchObject({ phase: "sustain", direction: 1 });
    expect(sampleGustCycle(cycle, 3500)).toMatchObject({ phase: "calm", direction: -1 });
    expect(sampleGustCycle(cycle, 4000)).toMatchObject({ phase: "warning", direction: -1 });
    expect(sampleGustCycle(cycle, 6000)).toMatchObject({ phase: "sustain", direction: -1 });
    expect(sampleGustCycle({ ...cycle, alternate: false }, 6000).direction).toBe(1);
    const gust: ForceZoneDefinition = { kind: "gust", id: "g", area: { kind: "rect", x: 0, y: 0, width: 1000, height: 1000 }, peakAcceleration: { x: 0, y: -100 }, edgeBlendPx: 10, cycle, telegraph: "windsock-and-arrows" };
    expect(sampleForceZone(gust, { x: 500, y: 500 }, 2000).acceleration.y).toBeCloseTo(-100);
    expect(sampleForceZone(gust, { x: 500, y: 500 }, 6000).acceleration.y).toBeCloseTo(100);
  });

  it("river currents carry toward their flow speed instead of launching", () => {
    expect(riverShare({ x: 100, y: 0 }, 200, { velocityX: 0, velocityY: 0 })).toBe(1);
    expect(riverShare({ x: 100, y: 0 }, 200, { velocityX: 200, velocityY: 0 })).toBe(0);
    expect(riverShare({ x: 100, y: 0 }, 200, { velocityX: 300, velocityY: 0 })).toBeCloseTo(-0.5);
    expect(riverShare({ x: 100, y: 0 }, null, { velocityX: 300, velocityY: 0 })).toBe(1);
  });
});

describe("tea-koi", () => {
  const koi: SeekerDefinition = {
    id: "k", label: "koi", home: { x: 0, y: 0 }, radius: 40, hearingRadius: 400, wakeThrustMs: 450, listenWindowMs: 1500,
    alertMs: 900, chaseSpeed: 175, chaseAcceleration: 260, giveUpMs: 1700, returnSpeed: 80, leashRadius: 700,
  };
  const run = (thrusting: (t: number) => boolean, ms: number, ship = { x: 200, y: 0 }) => {
    let state = createSeekerStates([koi])[0]!;
    for (let t = 0; t < ms; t += 10) state = stepSeeker(koi, state, { ship, thrusting: thrusting(t), dtMs: 10 });
    return state;
  };

  it("short taps never wake it; a sustained burn always does", () => {
    // 100 ms of thrust every 500 ms (20% duty) for 20 s.
    expect(run((t) => t % 500 < 100, 20000).mode).toBe("sleeping");
    expect(run(() => true, 460).mode).toBe("alert");
    // Far away it hears nothing.
    expect(run(() => true, 5000, { x: 900, y: 0 }).mode).toBe("sleeping");
  });

  it("wakes, warns, chases, gives up after quiet, and swims home", () => {
    let state = run(() => true, 460);
    expect(seekerNoiseShare(koi, state)).toBe(1);
    const ship = { x: 300, y: 0 };
    for (let t = 0; t < 1000; t += 10) state = stepSeeker(koi, state, { ship, thrusting: false, dtMs: 10 });
    expect(state.mode).toBe("chasing");
    for (let t = 0; t < 1800; t += 10) state = stepSeeker(koi, state, { ship, thrusting: false, dtMs: 10 });
    expect(state.mode).toBe("returning");
    for (let t = 0; t < 10000; t += 10) state = stepSeeker(koi, state, { ship, thrusting: false, dtMs: 10 });
    expect(state.mode).toBe("sleeping");
    expect(state.position).toEqual(koi.home);
  });

  it("stays on its leash and only nibbles when touching", () => {
    let state: SeekerState = { ...createSeekerStates([koi])[0]!, mode: "chasing" };
    const far = { x: 3000, y: 0 };
    for (let t = 0; t < 30000; t += 10) state = stepSeeker(koi, state, { ship: far, thrusting: true, dtMs: 10 });
    expect(Math.hypot(state.position.x, state.position.y)).toBeLessThanOrEqual(koi.leashRadius + 1e-6);
    const sleeping = createSeekerStates([koi]);
    expect(seekerContact([koi], sleeping, { x: 70, y: 0 }, 42)).toBe(koi);
    expect(seekerContact([koi], sleeping, { x: 90, y: 0 }, 42)).toBeNull();
  });
});

describe("challenge redesign: every mechanic is solvable and none is ignorable (rule R7)", () => {
  const redesigned: readonly MissionId[] = ["bento-belt", "matcha-nebula", "black-hole-bakery", "im-fine"];
  for (const id of redesigned) {
    it(`${id}: the hinted autopilot arrives cleanly; a mechanic-blind pilot does not`, () => {
      const hinted = runHintedPilot(id);
      expect(hinted.arrived).toBe(true);
      expect(hinted.incidents).toBe(0);
      expect(hinted.warps).toBe(0);
      expect(hinted.bumps).toBeLessThanOrEqual(1);
      expect(hinted.peakKoiNoise).toBeLessThan(1);
      expect(naiveDefeated(runNaivePilot(id))).toBe(true);
    });
  }

  it("home stays a gentle victory lap: even the blind pilot gets home without trouble", () => {
    const naive = runNaivePilot("home-delivery");
    expect(naive.arrived).toBe(true);
    expect(naive.incidents + naive.bumps + naive.warps).toBe(0);
  });

  it("signature forces are felt: at least 25% of thrust somewhere on every redesigned route", () => {
    for (const id of ["matcha-nebula", "black-hole-bakery", "im-fine"] as const) {
      expect(runHintedPilot(id).peakEnvironment).toBeGreaterThan(shipTuning.thrustAcceleration * 0.25);
    }
  });
});
