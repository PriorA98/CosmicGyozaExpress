import { describe, expect, it } from "vitest";
import { collisionTuning } from "../src/data/tuning";
import {
  classifyCollision,
  detectCircleCollision,
  resolveCircleCollision,
} from "../src/systems/CollisionSystem";
import type { ShipKinematicState, StaticObstacleDefinition } from "../src/types/flight";

const obstacle: StaticObstacleDefinition = {
  id: "rock",
  label: "rock",
  x: 0,
  y: 0,
  radius: 50,
};

describe("collision system", () => {
  it("does not report separated circles as collisions", () => {
    expect(detectCircleCollision({ x: 200, y: 0, radius: 20 }, obstacle)).toBeUndefined();
  });

  it("reports overlap with a normal pointing away from the obstacle", () => {
    const contact = detectCircleCollision({ x: 60, y: 0, radius: 20 }, obstacle);

    expect(contact?.normalX).toBeCloseTo(1);
    expect(contact?.normalY).toBeCloseTo(0);
    expect(contact?.overlap).toBeGreaterThan(0);
  });

  it("classifies collision severity by speed", () => {
    expect(classifyCollision(20)).toBe("soft-bump");
    expect(classifyCollision(collisionTuning.softBumpMaxSpeed + 10)).toBe("dramatic-bump");
    expect(classifyCollision(collisionTuning.dramaticBumpMaxSpeed + 10)).toBe("gyoza-incident");
  });

  it("separates and reflects a moving ship", () => {
    const state: ShipKinematicState = {
      x: 60,
      y: 0,
      rotation: 0,
      velocityX: -100,
      velocityY: 0,
    };
    const contact = detectCircleCollision({ x: state.x, y: state.y, radius: 20 }, obstacle);

    if (!contact) throw new Error("expected collision contact");

    const next = resolveCircleCollision(state, contact, "soft-bump");

    expect(next.x).toBeGreaterThan(state.x);
    expect(next.velocityX).toBeGreaterThan(0);
  });
});
