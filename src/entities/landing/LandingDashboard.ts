import Phaser from "phaser";
import { landingCopy } from "../../data/landingCopy";
import { LANDING_ART_SCALE, landingScenery, landingZoneTextColors } from "../../data/landingScenery";
import { colorNumber, colors, depth, typeScale } from "../../game/designTokens";
import { DashboardTicker, HudPanel, KEYCAP_HEIGHT, Keycap, dashboardTickerHeight, monoStyle, type HudRow } from "../../ui";
import type { LandingReadout } from "./landingReadouts";
import { fillNotchedRect } from "./pixelShapes";

export type LandingDashboardView = {
  readonly descent: LandingReadout;
  readonly drift: LandingReadout;
  readonly tilt: LandingReadout;
  readonly altitude: LandingReadout;
  readonly pad: LandingReadout;
  readonly packageLabel: string;
  readonly note: string;
};

export type LandingDashboardOptions = {
  /** Phone-class display: only the essential rows, no chatter line. */
  readonly compact: boolean;
  /** HUD scale (compactUiScale, boosted on compact displays); HudPanel renders its text at this size. */
  readonly scale: number;
  /** Panel title; omitted = the Tea Moon title. */
  readonly title?: string;
};

type ReadoutRowId = "descent" | "drift" | "tilt" | "altitude" | "pad";
const FULL_ROWS: readonly ReadoutRowId[] = ["descent", "drift", "tilt", "altitude"];
/** Phones keep descent plus the pad status (the altitude row, which carries "find the pad", is dropped). */
const COMPACT_ROWS: readonly ReadoutRowId[] = ["descent", "pad"];

/**
 * Landing telemetry on the shared UI kit: a HudPanel (descent / drift / tilt / altitude / package) and a
 * DashboardTicker chatter line underneath. Compact displays keep descent + pad + package and drop the ticker;
 * drift and tilt are still called out by the in-world gauge chip. Values arrive pre-formatted (one shared
 * `LandingReadouts`), so the HUD and the gauge always agree. An opaque backing sits under the kit's
 * translucent surfaces so sky stars never show through between a label and its value.
 */
export class LandingDashboard {
  readonly root: Phaser.GameObjects.Container;
  private readonly panel: HudPanel;
  private readonly ticker: DashboardTicker | undefined;
  private readonly rows: readonly ReadoutRowId[];
  private shownNote = "";
  private pendingNote = "";
  private pendingSinceMs = 0;

  constructor(scene: Phaser.Scene, options: LandingDashboardOptions) {
    const config = landingScenery.hud;
    this.rows = options.compact ? COMPACT_ROWS : FULL_ROWS;
    const width = Math.round((options.compact ? config.compactWidth : config.width) * options.scale);
    const rows: HudRow[] = [
      ...this.rows.map((id) => ({ id, label: landingCopy.rows[id], value: "" })),
      { id: "package", label: landingCopy.rows.package, value: "" },
    ];

    this.panel = new HudPanel(scene, { x: 0, y: 0, width, title: options.title ?? landingCopy.dashboardTitle, icon: "moon", rows, uiScale: options.scale });
    const backing = scene.add.graphics();
    backing.fillStyle(colorNumber(colors.cosmosPanel), 1);
    const inset = config.backingInsetPx;
    backing.fillRect(inset, inset, width - inset * 2, this.panel.panelHeight - inset * 2);
    const children: Phaser.GameObjects.GameObject[] = [backing, this.panel];
    if (!options.compact) {
      const tickerY = this.panel.panelHeight + config.tickerGap;
      backing.fillRect(inset, tickerY + inset, width - inset * 2, dashboardTickerHeight(config.tickerLines) - inset * 2);
      this.ticker = new DashboardTicker(scene, { x: 0, y: tickerY, width, maxLines: config.tickerLines });
      children.push(this.ticker);
    }
    this.root = scene.add
      .container(config.x, config.y, children)
      .setDepth(depth.hud)
      .setScrollFactor(0, 0, true);
  }

  /** Height on screen, including the ticker (for laying out other overlays below it). */
  get displayHeight(): number {
    const config = landingScenery.hud;
    const height = this.panel.panelHeight + (this.ticker ? config.tickerGap + dashboardTickerHeight(config.tickerLines) : 0);
    return height;
  }

  /** `immediateNote`: phase changes (touchdown, incident) retype the chatter at once, skipping the debounce. */
  update(view: LandingDashboardView, timeMs: number, immediateNote = false): void {
    for (const id of this.rows) {
      const readout = view[id];
      this.panel.setValue(id, readout.text, landingZoneTextColors[readout.zone]);
    }
    this.panel.setValue("package", view.packageLabel);
    this.updateNote(view.note, timeMs, immediateNote);
  }

  setAlpha(alpha: number): void {
    this.root.setAlpha(alpha);
  }

  destroy(): void {
    this.root.destroy();
  }

  /** Retypes the chatter only once a new line has held for a moment, so tapping thrust never stutters it. */
  private updateNote(note: string, timeMs: number, immediate: boolean): void {
    if (!this.ticker) return;
    if (note !== this.pendingNote) {
      this.pendingNote = note;
      this.pendingSinceMs = timeMs;
    }
    const first = this.shownNote === "";
    if (note === this.shownNote) return;
    if (!first && !immediate && timeMs - this.pendingSinceMs < landingScenery.hud.noteDebounceMs) return;
    this.shownNote = note;
    this.ticker.say(note);
  }
}

/** Where the keycap hint sits: centred under the pad, or (compact displays) top-right, clear of the pad. */
export type LandingControlsHintPlacement = "bottom" | "top-right";

/** Keycap hint strip (keyboard devices only), on a pixel-notched dark backing. */
export function createLandingControlsHint(
  scene: Phaser.Scene,
  scale: number,
  placement: LandingControlsHintPlacement = "bottom",
): Phaser.GameObjects.Container {
  const config = landingScenery.controlsHint;
  const cell = LANDING_ART_SCALE;
  const container = scene.add.container(0, 0).setDepth(depth.hud);
  let x = 0;

  for (const group of landingCopy.controls) {
    for (const key of group.keys) {
      const cap = new Keycap(scene, { x, y: 0, label: key });
      container.add(cap);
      x += cap.keyWidth + config.gap;
    }
    const text = scene.add
      .text(x - config.gap + config.labelGap, KEYCAP_HEIGHT / 2, group.label, monoStyle({ size: typeScale.base, color: colors.plaster }))
      .setOrigin(0, 0.5);
    container.add(text);
    x += text.width + config.labelGap - config.gap + config.groupGap;
  }

  const totalWidth = x - config.groupGap;
  const backing = scene.add.graphics();
  const w = Math.ceil((totalWidth + config.padX * 2) / cell) * cell;
  const h = KEYCAP_HEIGHT + config.padY * 2;
  backing.fillStyle(colorNumber(colors.cosmosPanel), 0.78);
  fillNotchedRect(backing, -config.padX, -config.padY, w, h, cell);
  container.addAt(backing, 0);
  container.setScale(scale).setScrollFactor(0, 0, true);
  if (placement === "top-right") {
    container.setPosition(
      Math.round((scene.scale.width - config.topRightMargin - (totalWidth + config.padX) * scale) / cell) * cell,
      Math.round((config.topRightMargin + config.padY * scale) / cell) * cell,
    );
  } else {
    container.setPosition(
      Math.round((scene.scale.width - totalWidth * scale) / 2 / cell) * cell,
      Math.round((scene.scale.height - (config.bottomMargin + KEYCAP_HEIGHT + config.padY) * scale) / cell) * cell,
    );
  }
  return container;
}
