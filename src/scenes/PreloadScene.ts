import Phaser from "phaser";
import { colors } from "../game/designTokens";

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super("PreloadScene");
  }

  preload(): void {
    const { width, height } = this.scale;

    this.add
      .text(width / 2, height / 2, "warming the gyoza engine...", {
        color: colors.plaster,
        fontFamily: "monospace",
        fontSize: "18px",
      })
      .setOrigin(0.5);

    this.load.image("ship-idle", "assets/ship/gyoza-idle.png");
    this.load.image("ship-fly-1", "assets/ship/gyoza-fly-01.png");
    this.load.image("ship-fly-2", "assets/ship/gyoza-fly-02.png");
    this.load.image("ship-fly-3", "assets/ship/gyoza-fly-03.png");
    this.load.image("ship-incident-1", "assets/ship/gyoza-incident-01.png");
    this.load.image("ship-incident-2", "assets/ship/gyoza-incident-02.png");
    this.load.image("ship-incident-3", "assets/ship/gyoza-incident-03.png");
    this.load.image("ship-incident-4", "assets/ship/gyoza-incident-04.png");
    this.load.image("ship-incident-5", "assets/ship/gyoza-incident-05.png");
    this.load.image("planet-tea-moon", "assets/planets/planet00.png");
    this.load.image("planet-im-fine", "assets/planets/planet04.png");
  }

  create(): void {
    this.scene.start("TitleScene");
  }
}
