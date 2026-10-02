import Phaser from "phaser";
import { registerDevState } from "../dev/devProbe";
import { SaveSystem } from "../systems/SaveSystem";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  create(): void {
    SaveSystem.load();
    // Dev only: save diagnostics for every scene's capture JSON (no-op in production builds).
    if (import.meta.env.DEV) registerDevState("save", () => SaveSystem.diagnostics());
    this.scene.start("PreloadScene");
  }
}
