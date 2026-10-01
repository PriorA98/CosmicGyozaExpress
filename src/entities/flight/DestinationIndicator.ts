import Phaser from "phaser";
import { destinationIndicatorStyle, dockingStateColors, flightHudCopy } from "../../data/flightScenery";
import { colorNumber, colors, depth, fontStacks, typeScale } from "../../game/designTokens";
import type { DockingState, Point } from "../../types/flight";
import { clamp } from "../../utils/math";

const TAU = Math.PI * 2;

/**
 * Screen-edge beacon pointing to the destination while it is off screen: a pin-shaped marker with
 * a tea-moon glyph, a drawn chevron, and a compact distance readout. Hidden when in view.
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

  /**
   * Map-pin beacon: a dark disc that tapers to a point toward the destination, a tiny tea-moon
   * glyph inside, and a small chevron just beyond the tip that breathes outward.
   */
  private drawBeacon(color: number, angle: number, pulse: number): void {
    const style = destinationIndicatorStyle;
    const g = this.graphics;
    const r = style.discRadius;
    const tipDistance = r + style.pinTipLength;
    const spread = Math.acos(r / tipDistance);
    const dir = { x: Math.cos(angle), y: Math.sin(angle) };
    const side = { x: -dir.y, y: dir.x };

    g.clear();

    // Soft breathing glow behind the pin.
    g.fillStyle(color, 0.1 + pulse * 0.1);
    g.fillCircle(0, 0, r + 7 + pulse * 2);

    // Pin body (disc + tangent point).
    g.fillStyle(colorNumber(colors.cosmosPanel), 0.92);
    g.lineStyle(2, color, 0.95);
    g.beginPath();
    g.moveTo(dir.x * tipDistance, dir.y * tipDistance);
    g.arc(0, 0, r, angle + spread, angle - spread + TAU, false);
    g.closePath();
    g.fillPath();
    g.strokePath();

    // Tea-moon glyph: lit disc, two craters, warm rim highlight.
    const moonR = style.moonGlyphRadius;
    g.fillStyle(colorNumber(colors.sage), 1);
    g.fillCircle(0, 0, moonR);
    g.fillStyle(colorNumber(colors.sageDeep), 1);
    g.fillCircle(moonR * 0.35, moonR * 0.25, moonR * 0.3);
    g.fillCircle(-moonR * 0.3, -moonR * 0.4, moonR * 0.18);
    g.lineStyle(2, colorNumber(colors.parchment), 0.7);
    g.beginPath();
    g.arc(0, 0, moonR - 1, Math.PI * 1.05, Math.PI * 1.45, false);
    g.strokePath();

    // Chevron beyond the tip, nudging outward with the pulse.
    const base = tipDistance + style.chevronGap + pulse * style.chevronTravel;
    const half = style.chevronHalfWidth;
    const len = style.chevronLength;
    g.lineStyle(style.chevronThickness + 3, colorNumber(colors.cosmosDeep), 0.6);
    this.strokeChevron(base, len, half, dir, side);
    g.lineStyle(style.chevronThickness, color, 0.6 + pulse * 0.4);
    this.strokeChevron(base, len, half, dir, side);
  }

  private strokeChevron(
    base: number,
    length: number,
    half: number,
    dir: { readonly x: number; readonly y: number },
    side: { readonly x: number; readonly y: number },
  ): void {
    const g = this.graphics;
    g.beginPath();
    g.moveTo(dir.x * base + side.x * half, dir.y * base + side.y * half);
    g.lineTo(dir.x * (base + length), dir.y * (base + length));
    g.lineTo(dir.x * base - side.x * half, dir.y * base - side.y * half);
    g.strokePath();
  }
}
