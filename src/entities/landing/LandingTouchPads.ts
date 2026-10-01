import Phaser from "phaser";
import { landingCopy, landingScenery } from "../../data/landingScenery";
import { colorNumber, colors, depth, fontStacks, typeScale } from "../../game/designTokens";
import type { LandingControls } from "../../types/landing";
import { landingHudScale } from "./LandingDashboard";

type ControlKey = keyof LandingControls;

type TouchPad = {
  readonly control: ControlKey;
  readonly hitArea: Phaser.Geom.Rectangle;
  readonly bg: Phaser.GameObjects.Arc;
  readonly ring: Phaser.GameObjects.Arc;
  readonly group: Phaser.GameObjects.Container;
  active: boolean;
};

const EMPTY_CONTROLS: LandingControls = { thrust: false, rotateLeft: false, rotateRight: false, stabilizer: false };

/** Large multi-touch zones in the bottom corners. Only created on touch-capable devices. */
export class LandingTouchPads {
  private readonly scene: Phaser.Scene;
  private readonly pads: TouchPad[] = [];
  private controls: LandingControls = EMPTY_CONTROLS;
  /** Visual scale of the pad buttons (larger on phone-size displays); hit zones are already generous. */
  private readonly buttonScale: number;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.buttonScale = landingHudScale(scene);
    const { width, height } = scene.scale;
    const config = landingScenery.touch;
    const panelWidth = Math.min(config.panelMaxWidth, width * config.panelWidthRatio);
    const zoneWidth = (panelWidth - config.panelGap) / 2;
    const zoneTop = height - config.zoneHeight;
    const rightPanelX = width - panelWidth;

    this.addPad(new Phaser.Geom.Rectangle(0, zoneTop, zoneWidth, config.zoneHeight), "rotateLeft", colors.ember);
    this.addPad(new Phaser.Geom.Rectangle(zoneWidth + config.panelGap, zoneTop, zoneWidth, config.zoneHeight), "rotateRight", colors.ember);
    this.addPad(new Phaser.Geom.Rectangle(rightPanelX, zoneTop, zoneWidth, config.zoneHeight), "stabilizer", colors.duskBlue);
    this.addPad(
      new Phaser.Geom.Rectangle(rightPanelX + zoneWidth + config.panelGap, zoneTop, zoneWidth, config.zoneHeight),
      "thrust",
      colors.terracotta,
    );
    scene.input.addPointer(4);
  }

  /** Reads every active pointer and returns the held controls. */
  read(): LandingControls {
    const next: LandingControls = { ...EMPTY_CONTROLS };
    for (const pointer of this.scene.input.manager.pointers) {
      if (!pointer.isDown) continue;
      for (const pad of this.pads) {
        if (Phaser.Geom.Rectangle.Contains(pad.hitArea, pointer.x, pointer.y)) next[pad.control] = true;
      }
    }
    this.controls = next;
    this.refreshVisuals();
    return next;
  }

  get current(): LandingControls {
    return this.controls;
  }

  private refreshVisuals(): void {
    const config = landingScenery.touch;
    for (const pad of this.pads) {
      const active = this.controls[pad.control];
      if (pad.active === active) continue;
      pad.active = active;
      pad.bg.setAlpha(active ? config.activeAlpha : config.idleAlpha);
      pad.ring.setStrokeStyle(active ? 3 : 2, colorNumber(colors.plaster), active ? 0.76 : 0.32);
      pad.group.setScale(this.buttonScale * (active ? 0.95 : 1));
    }
  }

  private addPad(hitArea: Phaser.Geom.Rectangle, control: ControlKey, accent: string): void {
    const config = landingScenery.touch;
    const copy = landingCopy.touchLabels[control];
    const group = this.scene.add.container(hitArea.centerX, hitArea.centerY).setDepth(depth.touch).setScale(this.buttonScale);
    const bg = this.scene.add.circle(0, 0, config.radius, colorNumber(accent), 1).setAlpha(config.idleAlpha);
    const ring = this.scene.add.circle(0, 0, config.radius).setStrokeStyle(2, colorNumber(colors.plaster), 0.32);
    const glyph = this.scene.add
      .text(0, -8, copy.glyph, {
        color: colors.plaster,
        fontFamily: fontStacks.mono,
        fontSize: `${typeScale.xl}px`,
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    const label = this.scene.add
      .text(0, 22, copy.label, {
        color: "rgba(251,247,236,0.72)",
        fontFamily: fontStacks.mono,
        fontSize: `${typeScale.sm}px`,
      })
      .setOrigin(0.5);
    group.add([bg, ring, glyph, label]);
    this.pads.push({ control, hitArea, bg, ring, group, active: false });
  }
}
