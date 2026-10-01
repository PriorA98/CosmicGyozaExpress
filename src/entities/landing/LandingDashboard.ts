import Phaser from "phaser";
import { landingCopy, landingScenery, landingZoneColors } from "../../data/landingScenery";
import { colorNumber, colors, depth, fontStacks, typeScale } from "../../game/designTokens";
import type { LandingZone } from "../../systems/LandingSystem";

export type LandingDashboardRowView = {
  readonly value: string;
  /** Omit for rows without a zone dot. */
  readonly zone?: LandingZone;
};

export type LandingDashboardView = {
  readonly descent: LandingDashboardRowView;
  readonly drift: LandingDashboardRowView;
  readonly tilt: LandingDashboardRowView;
  readonly altitude: LandingDashboardRowView;
  readonly package: LandingDashboardRowView;
  readonly note: string;
};

type RowKey = keyof typeof landingCopy.rows;

type Row = {
  readonly value: Phaser.GameObjects.Text;
  readonly dot: Phaser.GameObjects.Arc;
  shownValue: string;
  shownZone: LandingZone | undefined;
};

const ROW_ORDER: readonly RowKey[] = ["descent", "drift", "tilt", "altitude", "package"];

/**
 * Compact dark HUD panel with the landing readouts. Interim wave-1 styling with design tokens;
 * the shared UI kit replaces the panel chrome later.
 */
export class LandingDashboard {
  private readonly rows = new Map<RowKey, Row>();
  private readonly note: Phaser.GameObjects.Text;
  private shownNote = "";

  constructor(scene: Phaser.Scene) {
    const config = landingScenery.dashboard;
    const contentWidth = config.width - config.padX * 2;
    const noteTop = config.padY + config.titleGap + ROW_ORDER.length * config.rowHeight + config.noteGap;
    const height = noteTop + typeScale.base + 10 + config.padY;
    const panel = scene.add.graphics().setDepth(depth.hud);
    panel.fillStyle(colorNumber(colors.cosmosPanel), config.alpha);
    panel.fillRoundedRect(config.x, config.y, config.width, height, config.radius);
    panel.lineStyle(1, colorNumber(colors.plaster), 0.18);
    panel.strokeRoundedRect(config.x + 0.5, config.y + 0.5, config.width - 1, height - 1, config.radius);
    panel.lineStyle(1, colorNumber(colors.plaster), 0.12);
    panel.lineBetween(config.x + config.padX, config.y + noteTop - config.noteGap / 2, config.x + config.padX + contentWidth, config.y + noteTop - config.noteGap / 2);

    const left = config.x + config.padX;
    scene.add
      .text(left, config.y + config.padY, landingCopy.dashboardTitle, {
        color: colors.ember,
        fontFamily: fontStacks.pixel,
        fontSize: `${typeScale.sm}px`,
      })
      .setDepth(depth.hud + 1);

    ROW_ORDER.forEach((key, index) => {
      const y = config.y + config.padY + config.titleGap + index * config.rowHeight;
      scene.add
        .text(left, y, landingCopy.rows[key], {
          color: "rgba(251,247,236,0.62)",
          fontFamily: fontStacks.mono,
          fontSize: `${typeScale.base}px`,
        })
        .setDepth(depth.hud + 1);
      const value = scene.add
        .text(left + config.labelWidth, y - 1, "", {
          color: colors.plaster,
          fontFamily: fontStacks.mono,
          fontSize: `${typeScale.md}px`,
          fontStyle: "bold",
        })
        .setDepth(depth.hud + 1);
      const dot = scene.add
        .circle(left + contentWidth - config.dotRadius, y + typeScale.md / 2 + 1, config.dotRadius, colorNumber(colors.sage))
        .setDepth(depth.hud + 1)
        .setVisible(false);
      this.rows.set(key, { value, dot, shownValue: "", shownZone: undefined });
    });

    this.note = scene.add
      .text(left, config.y + noteTop, "", {
        color: colors.parchmentDeep,
        fontFamily: fontStacks.mono,
        fontSize: `${typeScale.sm}px`,
        fontStyle: "italic",
        wordWrap: { width: contentWidth },
      })
      .setDepth(depth.hud + 1);
  }

  update(view: LandingDashboardView): void {
    for (const key of ROW_ORDER) {
      const row = this.rows.get(key);
      if (!row) continue;
      const next = view[key];
      if (next.value !== row.shownValue) {
        row.shownValue = next.value;
        row.value.setText(next.value);
      }
      if (next.zone !== row.shownZone) {
        row.shownZone = next.zone;
        row.dot.setVisible(next.zone !== undefined);
        if (next.zone) {
          row.dot.setFillStyle(colorNumber(landingZoneColors[next.zone]));
          row.value.setColor(next.zone === "soft" ? colors.plaster : landingZoneColors[next.zone]);
        }
      }
    }

    const note = `› ${view.note}`;
    if (note !== this.shownNote) {
      this.shownNote = note;
      this.note.setText(note);
    }
  }
}

/** Keycap hint strip along the bottom edge (keyboard devices only). */
export function createLandingControlsHint(scene: Phaser.Scene): Phaser.GameObjects.Container {
  const config = landingScenery.controlsHint;
  const container = scene.add.container(0, 0).setDepth(depth.hud).setAlpha(config.alpha);
  let x = 0;

  for (const group of landingCopy.controls) {
    for (const key of group.keys) {
      const cap = scene.add.graphics();
      cap.fillStyle(colorNumber(colors.borderStrong), 1);
      cap.fillRoundedRect(x, 2, config.keySize, config.keySize, 5);
      cap.fillStyle(colorNumber(colors.parchmentWarm), 1);
      cap.fillRoundedRect(x, 0, config.keySize, config.keySize - 2, 5);
      const label = scene.add
        .text(x + config.keySize / 2, (config.keySize - 2) / 2, key, {
          color: colors.ink,
          fontFamily: fontStacks.mono,
          fontSize: `${typeScale.sm}px`,
          fontStyle: "bold",
        })
        .setOrigin(0.5);
      container.add([cap, label]);
      x += config.keySize + config.gap;
    }
    const text = scene.add
      .text(x + 2, config.keySize / 2, group.label, {
        color: colors.plaster,
        fontFamily: fontStacks.mono,
        fontSize: `${typeScale.base}px`,
      })
      .setOrigin(0, 0.5);
    container.add(text);
    x += text.width + config.groupGap;
  }

  const totalWidth = x - config.groupGap;
  const backing = scene.add.graphics();
  const padX = 14;
  const padY = 8;
  backing.fillStyle(colorNumber(colors.cosmosPanel), 0.72);
  backing.fillRoundedRect(-padX, -padY, totalWidth + padX * 2, config.keySize + padY * 2, 8);
  container.addAt(backing, 0);
  container.setPosition(
    Math.round((scene.scale.width - totalWidth) / 2),
    scene.scale.height - config.bottomMargin - config.keySize,
  );
  return container;
}
