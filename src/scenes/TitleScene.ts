import Phaser from "phaser";
import { colors } from "../game/designTokens";

export class TitleScene extends Phaser.Scene {
  constructor() {
    super("TitleScene");
  }

  create(): void {
    const { width, height } = this.scale;

    this.add.rectangle(0, 0, width, height, 0x1a1b2e).setOrigin(0, 0);
    this.add.image(width * 0.78, height * 0.62, "planet-tea-moon").setAlpha(0.45).setScale(0.34);
    this.add.image(width * 0.26, height * 0.47, "ship-idle").setScale(1.2);

    this.add
      .text(width * 0.39, height * 0.34, "Cosmic\nGyoza\nExpress", {
        color: colors.plaster,
        fontFamily: "serif",
        fontSize: "78px",
        lineSpacing: -8,
      })
      .setOrigin(0, 0.5);

    this.add
      .text(width * 0.39, height * 0.63, "warm deliveries across a soft galaxy", {
        color: colors.ember,
        fontFamily: "monospace",
        fontSize: "18px",
      })
      .setOrigin(0, 0.5);

    this.add
      .text(width / 2, height * 0.84, "press enter or click to launch the flight prototype", {
        color: colors.plaster,
        fontFamily: "monospace",
        fontSize: "16px",
      })
      .setOrigin(0.5);

    this.input.keyboard?.once("keydown-ENTER", () => this.scene.start("FlightScene"));
    this.input.once("pointerdown", () => this.scene.start("FlightScene"));
  }
}
