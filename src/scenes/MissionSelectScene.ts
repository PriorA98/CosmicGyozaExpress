import Phaser from "phaser";
import { emitGameEvent } from "../game/events";

/**
 * Delivery board (plan §5). Stub created by the integrator so showcase states and routing resolve;
 * the UI builder owns and implements this file.
 */
export class MissionSelectScene extends Phaser.Scene {
  constructor() {
    super("MissionSelectScene");
  }

  create(): void {
    this.add.text(640, 360, "Delivery board", { fontFamily: "monospace", fontSize: "32px", color: "#F4E6C8" }).setOrigin(0.5);
    emitGameEvent(this, { type: "scene:enter", scene: "MissionSelectScene" });
  }
}
