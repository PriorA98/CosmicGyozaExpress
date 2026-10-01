import Phaser from "phaser";
import { colorNumber, colors, fontStacks } from "../game/designTokens";

/**
 * Dev-only gallery of the src/ui component kit (owner: ui package). Opened with
 * `?showcase=ui-kit`. Never registered in production builds.
 */
export class UiKitScene extends Phaser.Scene {
  constructor() {
    super("UiKitScene");
  }

  create(): void {
    const { width, height } = this.scale;
    this.add.rectangle(0, 0, width, height, colorNumber(colors.cosmos)).setOrigin(0, 0);
    this.add
      .text(width / 2, height / 2, "ui kit gallery (pending)", {
        color: colors.plaster,
        fontFamily: fontStacks.mono,
        fontSize: "16px",
      })
      .setOrigin(0.5);
  }
}
