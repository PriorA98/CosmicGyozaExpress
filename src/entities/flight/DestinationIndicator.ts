import Phaser from "phaser";
import { destinationIndicatorStyle, dockingStateColors, flightHudCopy } from "../../data/flightScenery";
import { colorNumber, colors, depth, fontStacks, typeScale } from "../../game/designTokens";
import type { DockingState, Point } from "../../types/flight";
import { clamp } from "../../utils/math";

const TAU = Math.PI * 2;

/**
 * Screen-edge beacon pointing to the destination while it is off screen: a small dark disc with
 * a drawn chevron and a compact distance readout. Hidden when the destination is in view.
 */
export class DestinationIndicator {
  private readonly container: Phaser.GameObjects.Container;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly readout: Phaser.GameObjects.Text;
  private readonly name: Phaser.GameObjects.Text;
  private lastReadout = "";

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly destination: Point,
  ) {
    const style = destinationIndicatorStyle;
    this.graphics = scene.add.graphics();
    this.name = scene.add
      .text(0, 0, flightHudCopy.indicatorLabel, {
        fontFamily: fontStacks.mono,
        fontSize: `${typeScale.xs}px`,
        color: colors.parchment,
      })
      .setOrigin(0.5, 0)
      .setAlpha(0.7);
    this.readout = scene.add
      .text(0, 0, "", {
        fontFamily: fontStacks.mono,
        fontSize: `${typeScale.sm}px`,
        fontStyle: "bold",
        color: colors.plaster,
      })
      .setOrigin(0.5, 0);
    this.container = scene.add
      .container(0, 0, [this.graphics, this.name, this.readout])
      .setScrollFactor(0)
      .setDepth(depth.hudFx);
    this.container.setSize(style.discRadius * 2, style.discRadius * 2);
  }

  update(docking: DockingState, timeMs: number): void {
    const style = destinationIndicatorStyle;
    const { width, height } = this.scene.scale;
    const camera = this.scene.cameras.main;
    const screenX = this.destination.x - camera.scrollX;
    const screenY = this.destination.y - camera.scrollY;
    const maxY = height - style.bottomReserve;
    const onScreen =
      screenX >= style.margin && screenX <= width - style.margin && screenY >= style.margin && screenY <= maxY;

    this.container.setVisible(!onScreen);
    if (onScreen) return;

    const x = clamp(screenX, style.margin, width - style.margin);
    const y = clamp(screenY, style.margin, maxY);
    const angle = Math.atan2(screenY - y, screenX - x) || Math.atan2(screenY - height / 2, screenX - width / 2);
    const pulse = 0.5 + 0.5 * Math.sin((timeMs / style.pulseMs) * TAU);
    const color = colorNumber(docking.kind === "too-far" ? colors.ember : dockingStateColors[docking.kind]);

    this.container.setPosition(Math.round(x), Math.round(y));
    this.drawBeacon(color, angle, pulse);

    // Keep the text block on the inward side of the disc so it never clips off screen.
    const gap = style.labelGap;
    const inwardX = Math.round(clamp(-Math.cos(angle) * gap, -gap, gap));
    const nameY = y < height / 2 ? gap : -gap - style.textBlockHeight;
    this.name.setPosition(inwardX, nameY);
    this.readout.setPosition(inwardX, nameY + style.readoutOffset);

    const units = docking.distance / style.pxPerUnit;
    const text = `${units >= 10 ? units.toFixed(0) : units.toFixed(1)} ${style.unitLabel}`;
    if (text !== this.lastReadout) {
      this.lastReadout = text;
      this.readout.setText(text);
    }
  }

  private drawBeacon(color: number, angle: number, pulse: number): void {
    const style = destinationIndicatorStyle;
    const g = this.graphics;
    const dir = { x: Math.cos(angle), y: Math.sin(angle) };
    const side = { x: -dir.y, y: dir.x };
    const tip = style.chevronLength * 0.75 + pulse * 2;
    const back = tip - style.chevronLength;
    const thick = style.chevronThickness;

    g.clear();
    g.fillStyle(color, 0.12 + pulse * 0.1);
    g.fillCircle(0, 0, style.discRadius + 6);
    g.fillStyle(colorNumber(colors.cosmosPanel), 0.88);
    g.fillCircle(0, 0, style.discRadius);
    g.lineStyle(2, color, 0.9);
    g.strokeCircle(0, 0, style.discRadius);

    g.fillStyle(color, 1);
    g.beginPath();
    g.moveTo(dir.x * tip, dir.y * tip);
    g.lineTo(dir.x * back + side.x * style.chevronHalfWidth, dir.y * back + side.y * style.chevronHalfWidth);
    g.lineTo(dir.x * (back + thick) + side.x * (style.chevronHalfWidth - thick * 0.4), dir.y * (back + thick) + side.y * (style.chevronHalfWidth - thick * 0.4));
    g.lineTo(dir.x * (tip - thick * 1.6), dir.y * (tip - thick * 1.6));
    g.lineTo(dir.x * (back + thick) - side.x * (style.chevronHalfWidth - thick * 0.4), dir.y * (back + thick) - side.y * (style.chevronHalfWidth - thick * 0.4));
    g.lineTo(dir.x * back - side.x * style.chevronHalfWidth, dir.y * back - side.y * style.chevronHalfWidth);
    g.closePath();
    g.fillPath();
  }
}
