import Phaser from "phaser";
import { colorNumber, colors, depth, fontStacks, typeScale } from "../../game/designTokens";
import type { ShipControls } from "../../types/flight";

type TouchControlKey = keyof ShipControls;

type TouchPad = {
  readonly control: TouchControlKey;
  readonly hitArea: Phaser.Geom.Rectangle;
  readonly bg: Phaser.GameObjects.Arc;
  readonly ring: Phaser.GameObjects.Arc;
  readonly group: Phaser.GameObjects.Container;
  active: boolean;
};

const PAD_LAYOUT = {
  maxPanelWidth: 430,
  panelWidthRatio: 0.42,
  panelGap: 16,
  zoneHeight: 250,
  radius: 46,
  idleAlpha: 0.2,
  activeAlpha: 0.5,
  pressedScale: 0.94,
} as const;

const NO_CONTROLS: ShipControls = { thrust: false, brake: false, rotateLeft: false, rotateRight: false };

/**
 * Multi-touch flight pads (rotate left/right on the left thumb, brake/thrust on the right).
 * Only created on touch-capable devices. Temporary until the wave-2 shared UI kit lands.
 */
export class FlightTouchPads {
  private readonly pads: TouchPad[] = [];
  private current: ShipControls = NO_CONTROLS;

  constructor(private readonly scene: Phaser.Scene) {
    const { width, height } = scene.scale;
    const panelWidth = Math.min(PAD_LAYOUT.maxPanelWidth, width * PAD_LAYOUT.panelWidthRatio);
    const zoneWidth = (panelWidth - PAD_LAYOUT.panelGap) / 2;
    const zoneTop = height - PAD_LAYOUT.zoneHeight;
    const rightX = width - panelWidth;

    scene.input.addPointer(4);
    this.createPad(new Phaser.Geom.Rectangle(0, zoneTop, zoneWidth, PAD_LAYOUT.zoneHeight), "<", "rotate", "rotateLeft", colors.plum);
    this.createPad(
      new Phaser.Geom.Rectangle(zoneWidth + PAD_LAYOUT.panelGap, zoneTop, zoneWidth, PAD_LAYOUT.zoneHeight),
      ">",
      "rotate",
      "rotateRight",
      colors.plum,
    );
    this.createPad(new Phaser.Geom.Rectangle(rightX, zoneTop, zoneWidth, PAD_LAYOUT.zoneHeight), "S", "brake", "brake", colors.duskBlue);
    this.createPad(
      new Phaser.Geom.Rectangle(rightX + zoneWidth + PAD_LAYOUT.panelGap, zoneTop, zoneWidth, PAD_LAYOUT.zoneHeight),
      "^",
      "thrust",
      "thrust",
      colors.terracotta,
    );

    const refresh = (): void => this.refresh();
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, refresh);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, refresh);
    scene.input.on(Phaser.Input.Events.POINTER_UP, refresh);
    scene.input.on(Phaser.Input.Events.GAME_OUT, () => this.clear());
  }

  get controls(): ShipControls {
    return this.current;
  }

  /** Re-reads every active pointer against the pad zones. */
  refresh(): void {
    const next: ShipControls = { ...NO_CONTROLS };
    for (const pointer of this.scene.input.manager.pointers) {
      if (!pointer.isDown) continue;
      const pad = this.pads.find((candidate) => Phaser.Geom.Rectangle.Contains(candidate.hitArea, pointer.x, pointer.y));
      if (pad) next[pad.control] = true;
    }
    this.current = next;
    this.syncVisuals();
  }

  clear(): void {
    this.current = NO_CONTROLS;
    this.syncVisuals();
  }

  private createPad(hitArea: Phaser.Geom.Rectangle, glyph: string, label: string, control: TouchControlKey, accent: string): void {
    const x = hitArea.x + hitArea.width / 2;
    const y = hitArea.y + hitArea.height / 2;
    const group = this.scene.add.container(x, y).setDepth(depth.touch).setScrollFactor(0);
    const bg = this.scene.add.circle(0, 0, PAD_LAYOUT.radius, colorNumber(accent), PAD_LAYOUT.idleAlpha);
    const ring = this.scene.add.circle(0, 0, PAD_LAYOUT.radius).setStrokeStyle(2, colorNumber(colors.plaster), 0.32);
    const glyphText = this.scene.add
      .text(0, -7, glyph, {
        color: colors.plaster,
        fontFamily: fontStacks.mono,
        fontSize: `${typeScale.lg}px`,
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    const labelText = this.scene.add
      .text(0, 20, label, {
        color: colors.parchment,
        fontFamily: fontStacks.mono,
        fontSize: `${typeScale.xs}px`,
      })
      .setOrigin(0.5)
      .setAlpha(0.7);

    group.add([bg, ring, glyphText, labelText]);
    this.pads.push({ control, hitArea, bg, ring, group, active: false });
  }

  private syncVisuals(): void {
    for (const pad of this.pads) {
      const active = this.current[pad.control];
      if (pad.active === active) continue;
      pad.active = active;
      pad.bg.setAlpha(active ? PAD_LAYOUT.activeAlpha : PAD_LAYOUT.idleAlpha);
      pad.ring.setStrokeStyle(active ? 3 : 2, colorNumber(colors.plaster), active ? 0.76 : 0.32);
      pad.group.setScale(active ? PAD_LAYOUT.pressedScale : 1);
    }
  }
}
