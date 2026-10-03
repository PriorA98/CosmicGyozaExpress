import { describe, expect, it } from "vitest";
import { ButtonPress } from "../src/ui/buttonPress";

describe("button press gestures", () => {
  it("accepts a release even when touch hover ends first, exactly once", () => {
    const press = new ButtonPress();
    press.down({ id: 1, isDown: true });
    press.out({ id: 1, isDown: false });
    expect(press.up({ id: 1, isDown: false })).toBe(true);
    expect(press.up({ id: 1, isDown: false })).toBe(false);
  });

  it("cancels dragging off and back onto the button", () => {
    const press = new ButtonPress();
    press.down({ id: 0, isDown: true });
    press.out({ id: 0, isDown: true });
    expect(press.up({ id: 0, isDown: false })).toBe(false);
  });

  it("only lets the pressing finger release or cancel the gesture", () => {
    const press = new ButtonPress();
    press.down({ id: 1, isDown: true });
    press.down({ id: 2, isDown: true });
    press.out({ id: 2, isDown: true });
    press.reset({ id: 2, isDown: false });
    expect(press.up({ id: 2, isDown: false })).toBe(false);
    expect(press.up({ id: 1, isDown: false })).toBe(true);
  });

  it("clears disabled or outside releases before the next gesture", () => {
    const press = new ButtonPress();
    press.down({ id: 1, isDown: true });
    press.reset();
    expect(press.up({ id: 1, isDown: false })).toBe(false);
    press.down({ id: 2, isDown: true });
    press.reset({ id: 2, isDown: false });
    expect(press.up({ id: 2, isDown: false })).toBe(false);
    press.down({ id: 1, isDown: true });
    expect(press.up({ id: 1, isDown: false })).toBe(true);
  });
});
