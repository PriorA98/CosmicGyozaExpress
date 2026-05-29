import Phaser from "phaser";
import { SaveSystem } from "../systems/SaveSystem";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  create(): void {
    SaveSystem.load();
    this.scene.start("PreloadScene");
  }
}
