import { describe, expect, it } from "vitest";
import { resolveMovingCollision, sweptMovingContact } from "../src/systems/CollisionSystem";
import type { CollisionContact, ShipKinematicState } from "../src/types/flight";

const contact: CollisionContact = { obstacleId: "rock", normalX: -1, normalY: 0, overlap: 4, distance: 90 };
const ship: ShipKinematicState = { x: 0, y: 0, rotation: 0, velocityX: 0, velocityY: 0 };

describe("collisions in a moving rock's frame", () => {
  it("classifies a slow rock meeting a stationary ship as a soft bump", () => {
    const resolved = resolveMovingCollision(ship, contact, { x: -40, y: 0 });
    expect(resolved.severity).toBe("soft-bump");
    expect(resolved.relativeSpeed).toBe(40);
    expect(resolved.state.velocityX).toBeLessThan(-40);
    expect(resolved.state.x).toBeLessThan(-4);
  });

  it("ignores high shared world speed and separates without inventing relative velocity", () => {
    const resolved = resolveMovingCollision({ ...ship, velocityX: 400 }, contact, { x: 400, y: 0 });
    expect(resolved.severity).toBe("none");
    expect(resolved.relativeSpeed).toBe(0);
    expect(resolved.state.velocityX).toBe(400);
    expect(resolved.state.velocityY).toBe(0);
    expect(resolved.state.x).toBeLessThan(-4);
  });

  it("detects a head-on incident even at a modest ship world speed", () => {
    const resolved = resolveMovingCollision({ ...ship, velocityX: 120 }, contact, { x: -300, y: 0 });
    expect(resolved.severity).toBe("gyoza-incident");
    expect(resolved.relativeSpeed).toBe(420);
    expect(resolved.state.velocityX).toBeLessThan(-300);
  });
});

describe("relative contact sweep", () => {
  const rock = { id: "rock", label: "moving rock", x: 0, y: 0, radius: 10 };
  it("finds a full crossing whose endpoints do not overlap", () => {
    const swept = sweptMovingContact({ x: -80, y: 0 }, { x: 80, y: 0 }, 10, rock, rock);
    expect(swept?.normalX).toBe(-1);
    expect(swept?.overlap).toBe(100);
    if (!swept) throw new Error("expected swept contact");
    const resolved = resolveMovingCollision({ ...ship, x: 80, velocityX: 100 }, swept, { x: 0, y: 0 });
    expect(resolved.state.x).toBeLessThan(-20);
    expect(resolved.state.velocityX).toBeLessThan(0);
  });

  it("detects rock motion against a parked ship and allows an existing overlap to exit", () => {
    expect(sweptMovingContact(ship, ship, 10, { x: 80, y: 0 }, { ...rock, x: -80 })?.normalX).toBe(-1);
    expect(sweptMovingContact({ x: 5, y: 0 }, { x: 80, y: 0 }, 10, rock, rock)).toBeUndefined();
    expect(sweptMovingContact({ x: -80, y: 40 }, { x: 80, y: 40 }, 10, rock, rock)).toBeUndefined();
    expect(sweptMovingContact({ x: -80, y: 20 }, { x: 80, y: 20 }, 10, rock, rock)).toBeUndefined();
  });
});
