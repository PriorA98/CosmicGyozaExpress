import Phaser from "phaser";
import { colorNumber, colors, typeScale } from "../game/designTokens";
import { uiScaled, uiSecondaryTextSize } from "./layout";
import { stateSwatch } from "./statePalette";
import { fillSteppedRect, STEPPED_CORNER } from "./surfaces";
import { monoStyle } from "./textStyles";

/** Gentle one-line notice on dark scenes (save notes): never an alarm. Geometry at uiScale 1. */
const SAVE_NOTICE = { padX: 12, padY: 14, dot: 8, maxWidth: 640 } as const;

export type SaveNoticeChipOptions = {
  readonly x: number;
  readonly y: number;
  readonly text: string;
  /** Widest the whole chip may grow (logical px); longer text wraps. */
  readonly maxWidth?: number;
  readonly uiScale?: number;
};

/** Dark chip with a soft plaster rim, sage pixel dot and mono text. Origin: top-left. */
export class SaveNoticeChip extends Phaser.GameObjects.Container {
  readonly chipWidth: number;
  readonly chipHeight: number;

  constructor(scene: Phaser.Scene, options: SaveNoticeChipOptions) {
    super(scene, options.x, options.y);
    const s = options.uiScale ?? 1;
    const padX = uiScaled(SAVE_NOTICE.padX, s);
    const dot = Math.round(uiScaled(SAVE_NOTICE.dot, s) / 2) * 2;
    const wrapWidth = (options.maxWidth ?? SAVE_NOTICE.maxWidth) - padX * 3 - dot;
    const label = scene.add
      .text(0, 0, options.text, monoStyle({ size: uiSecondaryTextSize(typeScale.sm, s), color: colors.parchmentDeep, wrapWidth }))
      .setOrigin(0, 0);
    this.chipWidth = Math.ceil(label.width) + padX * 3 + dot;
    this.chipHeight = Math.ceil(label.height) + uiScaled(SAVE_NOTICE.padY, s);
    const g = scene.add.graphics();
    g.fillStyle(colorNumber(colors.plaster), 0.2);
    fillSteppedRect(g, 0, 0, this.chipWidth, this.chipHeight, STEPPED_CORNER.soft);
    g.fillStyle(colorNumber(colors.cosmosPanel), 0.92);
    fillSteppedRect(g, 2, 2, this.chipWidth - 4, this.chipHeight - 4, STEPPED_CORNER.notch);
    g.fillStyle(colorNumber(colors.sage), 1);
    fillSteppedRect(g, padX, Math.round(this.chipHeight / 2 - dot / 2), dot, dot, STEPPED_CORNER.notch);
    label.setPosition(padX * 2 + dot, Math.round((this.chipHeight - label.height) / 2));
    this.add([g, label]);
    this.setSize(this.chipWidth, this.chipHeight);
    scene.add.existing(this);
  }
}

/** "Collected" postage stamp (screen px; perforation pitch stays 4 so dots sit on the 2px grid). */
const STAMP = { padX: 10, height: 28, perforation: 4 } as const;

export type CollectedStampOptions = {
  readonly x: number;
  readonly y: number;
  readonly label: string;
  readonly uiScale?: number;
};

/**
 * Perforated sage stamp for parchment headers (mission completion): sage paper, a dotted sage-deep
 * "torn" margin, bold mono label. Flat (no drop shadow) so it sits inside a card, not on top of it.
 * Origin: top-left; use `stampWidth`/`stampHeight` to right-align or centre it.
 */
export class CollectedStamp extends Phaser.GameObjects.Container {
  readonly stampWidth: number;
  readonly stampHeight: number;

  constructor(scene: Phaser.Scene, options: CollectedStampOptions) {
    super(scene, options.x, options.y);
    const s = options.uiScale ?? 1;
    const swatch = stateSwatch("idle");
    const text = scene.add.text(0, 0, options.label, monoStyle({ size: uiSecondaryTextSize(typeScale.sm, s), bold: true, color: colors.sageDeep })).setOrigin(0, 0.5);
    const padX = uiScaled(STAMP.padX, s);
    const pitch = STAMP.perforation;
    this.stampWidth = Math.ceil((text.width + padX * 2) / pitch) * pitch;
    this.stampHeight = Math.max(uiScaled(STAMP.height, s), Math.ceil(text.height / pitch) * pitch + pitch * 2);
    const g = scene.add.graphics();
    g.fillStyle(colorNumber(swatch.background), 1);
    g.fillRect(2, 2, this.stampWidth - 4, this.stampHeight - 4);
    g.fillStyle(colorNumber(swatch.foreground), 0.85);
    for (let x = 0; x < this.stampWidth; x += pitch) {
      g.fillRect(x, 0, 2, 2);
      g.fillRect(x, this.stampHeight - 2, 2, 2);
    }
    for (let y = pitch; y < this.stampHeight - 2; y += pitch) {
      g.fillRect(0, y, 2, 2);
      g.fillRect(this.stampWidth - 2, y, 2, 2);
    }
    text.setPosition(padX, Math.round(this.stampHeight / 2));
    this.add([g, text]);
    this.setSize(this.stampWidth, this.stampHeight);
    scene.add.existing(this);
  }
}
