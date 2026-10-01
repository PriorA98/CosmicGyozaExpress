import Phaser from "phaser";
import { ASSET, NINE_SLICE } from "../data/assetManifest";
import { colorNumber, colors, typeScale } from "../game/designTokens";
import { addNineSlicePanel } from "./surfaces";
import { monoStyle } from "./textStyles";

export type KeycapOptions = {
  readonly x: number;
  readonly y: number;
  readonly label: string;
  readonly minWidth?: number;
  readonly fixed?: boolean;
};

/** Keycap height in screen px (the 16 art px keycap frame at artScale 2). */
export const KEYCAP_HEIGHT = 32;
const KEYCAP_PADDING_X = 10;
const BORDER = 2;
const BASE = 4;
const KEYCAP_FRAME = { up: 0, down: 1 } as const;
/** Label centre for the authored keycap frames (face sits above a 3 art px base). */
const ART_LABEL_Y = { up: 13, down: 16 } as const;

/** Light mono keycap with a heavier bottom border. Origin: top-left. */
export class Keycap extends Phaser.GameObjects.Container {
  readonly keyWidth: number;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly art: Phaser.GameObjects.NineSlice | undefined;
  private readonly labelText: Phaser.GameObjects.Text;
  private pressed = false;

  constructor(scene: Phaser.Scene, options: KeycapOptions) {
    super(scene, options.x, options.y);
    this.labelText = scene.add
      .text(0, 0, options.label, monoStyle({ size: typeScale.sm, bold: true, color: colors.ink }))
      .setOrigin(0.5, 0.5);
    this.keyWidth = Math.max(options.minWidth ?? KEYCAP_HEIGHT, Math.ceil(this.labelText.width + KEYCAP_PADDING_X * 2));
    this.graphics = scene.add.graphics();
    this.art = addNineSlicePanel(scene, ASSET.uiKeycap, this.keyWidth, KEYCAP_HEIGHT, NINE_SLICE.keycap, KEYCAP_FRAME.up);
    this.add([this.art ?? this.graphics, this.labelText]);
    this.setSize(this.keyWidth, KEYCAP_HEIGHT);
    if (options.fixed) this.setScrollFactor(0, 0, true);
    this.redraw();
    scene.add.existing(this);
  }

  setPressed(pressed: boolean): this {
    if (this.pressed === pressed) return this;
    this.pressed = pressed;
    this.redraw();
    return this;
  }

  private redraw(): void {
    const sink = this.pressed ? BASE - BORDER : 0;
    this.labelText.setPosition(Math.round(this.keyWidth / 2), Math.round((KEYCAP_HEIGHT - BASE) / 2) + sink + 1);

    if (this.art) {
      this.art.setFrame(this.pressed ? KEYCAP_FRAME.down : KEYCAP_FRAME.up);
      this.labelText.setY(this.pressed ? ART_LABEL_Y.down : ART_LABEL_Y.up);
      return;
    }

    const g = this.graphics;
    const width = this.keyWidth;
    g.clear();
    g.fillStyle(colorNumber(colors.ink), 1);
    g.fillRect(BORDER, sink, width - BORDER * 2, KEYCAP_HEIGHT - sink);
    g.fillRect(0, sink + BORDER, width, KEYCAP_HEIGHT - sink - BORDER * 2);
    g.fillStyle(colorNumber(this.pressed ? colors.parchmentDeep : colors.plaster), 1);
    g.fillRect(BORDER, sink + BORDER, width - BORDER * 2, KEYCAP_HEIGHT - sink - BORDER - BASE);
    // Soft inner shade along the bottom of the face.
    g.fillStyle(colorNumber(colors.border), 1);
    g.fillRect(BORDER, KEYCAP_HEIGHT - BASE - 2, width - BORDER * 2, 2);
  }
}
