import { describe, expect, it } from "vitest";
import { createDefaultSave } from "../src/systems/SaveSystem";

describe("createDefaultSave", () => {
  it("creates a versioned save with Tea Moon unlocked", () => {
    const save = createDefaultSave(new Date("2026-05-29T00:00:00.000Z"));

    expect(save.version).toBe(1);
    expect(save.unlockedMissions).toEqual(["tea-moon"]);
    expect(save.settings.cozyMode).toBe(true);
    expect(save.completedMissions).toEqual([]);
  });
});
