import Phaser from "phaser";
import { ASSET, NINE_SLICE } from "../data/assetManifest";
import { colorNumber, colors } from "../game/designTokens";
import { uiPixelLabelSize, uiScaled } from "./layout";
import { SURFACE, STEPPED_CORNER, addNineSlicePanel, drawParchmentSurface, fillSteppedRect } from "./surfaces";
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
  /** Compact-display multiplier (see `compactUiScale`) for the header and default padding. Default 1. */
  readonly uiScale?: number;
};

/** Header band height at uiScale 1 (use `headerHeight` for the scaled value). */
export const CARD_HEADER_HEIGHT = 40;
const DEFAULT_PADDING = 20;
const HEADER_CONTENT_GAP = 12;

/**
 * Warm parchment card (requests, results, memories). Children added with `addContent` use
 * card-local coordinates; `contentTop` is the first y below the header. Origin: top-left.
 */
export class ParchmentCard extends Phaser.GameObjects.Container {
  readonly cardWidth: number;
  readonly cardHeight: number;
  readonly padding: number;
  readonly contentTop: number;
  readonly headerHeight: number;

  constructor(scene: Phaser.Scene, options: ParchmentCardOptions) {
    super(scene, options.x, options.y);
    const uiScale = options.uiScale ?? 1;
    this.cardWidth = options.width;
    this.cardHeight = options.height;
    this.padding = options.padding ?? uiScaled(DEFAULT_PADDING, uiScale);
    this.headerHeight = uiScaled(CARD_HEADER_HEIGHT, uiScale);

    const art = addNineSlicePanel(scene, ASSET.uiPanelParchment, this.cardWidth, this.cardHeight, NINE_SLICE.panel);
    if (art) {
      const shadow = scene.add.graphics();
      shadow.fillStyle(colorNumber(SURFACE.parchment.shadow), SURFACE.parchment.shadowAlpha);
      fillSteppedRect(shadow, 0, SURFACE.parchment.shadowOffset, this.cardWidth, this.cardHeight, STEPPED_CORNER.round);
      this.add([shadow, art]);
    } else {
      const g = scene.add.graphics();
      drawParchmentSurface(g, this.cardWidth, this.cardHeight);
      this.add(g);
    }

    if (options.title) {
      const title = scene.add
        .text(this.padding, Math.round(this.headerHeight / 2) + 2, options.title.toUpperCase(), pixelLabelStyle({ size: uiPixelLabelSize(uiScale), color: colors.terracottaDeep }))
        .setOrigin(0, 0.5);
      const rule = scene.add.graphics();
      rule.fillStyle(colorNumber(colors.border), 1);
      // Dotted stationery rule under the header.
      for (let x = this.padding; x < this.cardWidth - this.padding; x += 6) rule.fillRect(x, this.headerHeight, 2, 2);
      this.add([title, rule]);
      this.contentTop = this.headerHeight + uiScaled(HEADER_CONTENT_GAP, uiScale);
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
