import Phaser from "phaser";
import { colorNumber, colors, fontStacks } from "../game/designTokens";

/**
 * Dev-only gallery of the src/fx effects and audio cues (owner: audio-fx package). Opened with
 * `?showcase=fx-gallery`. Never registered in production builds.
 */
export class FxGalleryScene extends Phaser.Scene {
  constructor() {
    super("FxGalleryScene");
  }

  create(): void {
    const { width, height } = this.scale;
    this.add.rectangle(0, 0, width, height, colorNumber(colors.cosmos)).setOrigin(0, 0);
    this.add
      .text(width / 2, height / 2, "fx gallery (pending)", {
        color: colors.plaster,
        fontFamily: fontStacks.mono,
        fontSize: "16px",
      })
      .setOrigin(0.5);
  }
}
