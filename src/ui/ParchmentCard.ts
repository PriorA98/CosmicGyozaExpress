import Phaser from "phaser";
import { ASSET, NINE_SLICE } from "../data/assetManifest";
import { colorNumber, colors } from "../game/designTokens";
import { SURFACE, addNineSlicePanel, drawParchmentSurface } from "./surfaces";
import { pixelLabelStyle } from "./textStyles";

export type ParchmentCardOptions = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** Optional pixel header label (rendered uppercase, terracotta). */
  readonly title?: string;
  readonly padding?: number;
  readonly fixed?: boolean;
};

export const CARD_HEADER_HEIGHT = 40;

/**
 * Warm parchment card (requests, results, memories). Children added with `addContent` use
 * card-local coordinates; `contentTop` is the first y below the header. Origin: top-left.
 */
export class ParchmentCard extends Phaser.GameObjects.Container {
  readonly cardWidth: number;
  readonly cardHeight: number;
  readonly padding: number;
  readonly contentTop: number;

  constructor(scene: Phaser.Scene, options: ParchmentCardOptions) {
    super(scene, options.x, options.y);
    this.cardWidth = options.width;
    this.cardHeight = options.height;
    this.padding = options.padding ?? 20;

    const art = addNineSlicePanel(scene, ASSET.uiPanelParchment, this.cardWidth, this.cardHeight, NINE_SLICE.panel);
    if (art) {
      const shadow = scene.add.graphics();
      shadow.fillStyle(colorNumber(SURFACE.parchment.shadow), SURFACE.parchment.shadowAlpha);
      shadow.fillRoundedRect(0, SURFACE.parchment.shadowOffset, this.cardWidth, this.cardHeight, SURFACE.parchment.radius);
      this.add([shadow, art]);
    } else {
      const g = scene.add.graphics();
      drawParchmentSurface(g, this.cardWidth, this.cardHeight);
      this.add(g);
    }

    if (options.title) {
      const title = scene.add
        .text(this.padding, CARD_HEADER_HEIGHT / 2 + 2, options.title.toUpperCase(), pixelLabelStyle({ color: colors.terracottaDeep }))
        .setOrigin(0, 0.5);
      const rule = scene.add.graphics();
      rule.fillStyle(colorNumber(colors.border), 1);
      // Dotted stationery rule under the header.
      for (let x = this.padding; x < this.cardWidth - this.padding; x += 6) rule.fillRect(x, CARD_HEADER_HEIGHT, 2, 2);
      this.add([title, rule]);
      this.contentTop = CARD_HEADER_HEIGHT + 12;
    } else {
      this.contentTop = this.padding;
    }

    this.setSize(this.cardWidth, this.cardHeight);
    if (options.fixed) this.setScrollFactor(0, 0, true);
    scene.add.existing(this);
  }

  addContent(...objects: Phaser.GameObjects.GameObject[]): this {
    this.add(objects);
    if (this.scrollFactorX === 0) this.setScrollFactor(0, 0, true);
    return this;
  }
}
