import type Phaser from "phaser";
import { destinationIndicatorStyle, dockingStateColors, flightHudCopy, flightHudStyle } from "../../data/flightScenery";
import { colorNumber, colors, depth, fontStacks, typeScale } from "../../game/designTokens";
import type { DockingStateKind } from "../../types/flight";

export type FlightHudView = {
  readonly speed: number;
  readonly distance: number;
  readonly bottomDegrees: number;
  readonly dockingKind: DockingStateKind;
  readonly statusLabel: string;
  readonly packageLabel: string;
  readonly note: string;
  readonly incident: boolean;
};

type HudRowKey = "speed" | "distance" | "bottom" | "arrival" | "package";

type HudRow = {
  readonly value: Phaser.GameObjects.Text;
  last: string;
};

const NOTE_LINES = 2;
const NOTE_LINE_HEIGHT = 15;

/**
 * Wave-1 flight dashboard: a dark translucent instrument panel (design-system "Dark HUD panel")
 * with mono readouts, a coloured arrival status dot, and a short note line. Display only; the
 * scene passes already-computed values. Replaced by the shared UI kit in wave 2.
 */
export class FlightHud {
  private readonly rows: Record<HudRowKey, HudRow>;
  private readonly statusDot: Phaser.GameObjects.Arc;
  private readonly note: Phaser.GameObjects.Text;
  private lastNote = "";
  private lastKind: DockingStateKind | undefined;

  constructor(scene: Phaser.Scene, options: { readonly showKeyboardHint: boolean; readonly devHint: boolean }) {
    const style = flightHudStyle;
    const rowCount = 5;
    const height =
      style.paddingY * 2 + style.titleGap + rowCount * style.rowHeight + style.noteGap + NOTE_LINES * NOTE_LINE_HEIGHT;
    const left = style.x + style.paddingX;
    const hudDepth = depth.hud;

    const panel = scene.add.graphics().setScrollFactor(0).setDepth(hudDepth);
    panel.fillStyle(colorNumber(colors.cosmosDeep), 0.35);
    panel.fillRoundedRect(style.x + 2, style.y + 3, style.width, height, style.radius);
    panel.fillStyle(colorNumber(style.panelColor), style.panelAlpha);
    panel.fillRoundedRect(style.x, style.y, style.width, height, style.radius);
    panel.lineStyle(1, colorNumber(style.borderColor), style.borderAlpha);
    panel.strokeRoundedRect(style.x + 0.5, style.y + 0.5, style.width - 1, height - 1, style.radius);
    const dividerY = style.y + style.paddingY + style.titleGap - 9;
    panel.lineStyle(1, colorNumber(style.borderColor), style.borderAlpha * 0.8);
    panel.lineBetween(left, dividerY, style.x + style.width - style.paddingX, dividerY);

    scene.add
      .text(left, style.y + style.paddingY - 1, flightHudCopy.title, {
        fontFamily: fontStacks.mono,
        fontSize: `${typeScale.sm}px`,
        fontStyle: "bold",
        color: colors.amber,
      })
      .setScrollFactor(0)
      .setDepth(hudDepth + 1);

    const label = (text: string, rowIndex: number): void => {
      scene.add
        .text(left, this.rowY(rowIndex), text, {
          fontFamily: fontStacks.mono,
          fontSize: `${typeScale.xs}px`,
          color: colors.parchment,
        })
        .setAlpha(style.labelAlpha)
        .setScrollFactor(0)
        .setDepth(hudDepth + 1);
    };

    const value = (rowIndex: number, offsetX = 0): HudRow => ({
      value: scene.add
        .text(left + style.valueColumn + offsetX, this.rowY(rowIndex) - 2, "", {
          fontFamily: fontStacks.mono,
          fontSize: `${typeScale.sm}px`,
          color: colors.plaster,
        })
        .setScrollFactor(0)
        .setDepth(hudDepth + 1),
      last: "",
    });

    const labels = [flightHudCopy.speed, flightHudCopy.distance, flightHudCopy.bottom, flightHudCopy.arrival, flightHudCopy.package];
    labels.forEach((text, index) => label(text, index));
    const dotOffset = style.statusDotRadius * 2 + 7;
    this.rows = {
      speed: value(0),
      distance: value(1),
      bottom: value(2),
      arrival: value(3, dotOffset),
      package: value(4),
    };

    this.statusDot = scene.add
      .circle(left + style.valueColumn + style.statusDotRadius, this.rowY(3) + 6, style.statusDotRadius, colorNumber(colors.duskBlue))
      .setScrollFactor(0)
      .setDepth(hudDepth + 1);

    this.note = scene.add
      .text(left, this.rowY(rowCount) + style.noteGap - 4, "", {
        fontFamily: fontStacks.mono,
        fontSize: `${typeScale.xs}px`,
        color: colors.parchmentDeep,
        lineSpacing: NOTE_LINE_HEIGHT - typeScale.xs - 2,
        wordWrap: { width: style.noteWrap },
      })
      .setAlpha(0.86)
      .setScrollFactor(0)
      .setDepth(hudDepth + 1);

    if (options.showKeyboardHint) {
      const { width, height: viewHeight } = scene.scale;
      const hint = flightHudCopy.controlsKeyboard + (options.devHint ? flightHudCopy.controlsDevSuffix : "");
      scene.add
        .text(width / 2, viewHeight - 26, hint, {
          fontFamily: fontStacks.mono,
          fontSize: `${typeScale.xs}px`,
          color: colors.parchment,
          backgroundColor: "rgba(20,22,38,0.62)",
          padding: { x: 10, y: 5 },
        })
        .setOrigin(0.5)
        .setAlpha(0.8)
        .setScrollFactor(0)
        .setDepth(hudDepth);
    }
  }

  update(view: FlightHudView): void {
    const units = destinationIndicatorStyle.unitLabel;
    const distance = view.distance / destinationIndicatorStyle.pxPerUnit;
    this.setRow("speed", `${view.speed.toFixed(0)} px/s`);
    this.setRow("distance", `${distance.toFixed(1)} ${units}`);
    this.setRow("bottom", `${view.bottomDegrees.toString().padStart(3, "0")}°`);
    this.setRow("arrival", view.incident ? flightHudCopy.incidentMode : view.statusLabel);
    this.setRow("package", view.packageLabel.toLowerCase());

    const kind = view.dockingKind;
    if (kind !== this.lastKind) {
      this.lastKind = kind;
      const color = dockingStateColors[kind];
      this.statusDot.setFillStyle(colorNumber(color));
      this.rows.arrival.value.setColor(kind === "too-far" ? colors.plaster : color);
    }

    if (view.note !== this.lastNote) {
      this.lastNote = view.note;
      this.note.setText(view.note);
    }
  }

  private setRow(key: HudRowKey, text: string): void {
    const row = this.rows[key];
    if (row.last === text) return;
    row.last = text;
    row.value.setText(text);
  }

  private rowY(index: number): number {
    const style = flightHudStyle;
    return style.y + style.paddingY + style.titleGap + index * style.rowHeight;
  }
}
