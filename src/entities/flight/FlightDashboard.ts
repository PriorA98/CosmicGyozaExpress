import Phaser from "phaser";
import {
  destinationIndicatorStyle,
  flightHudCopy,
  flightHudLayout,
  packageMeterBands,
  type FlightHintGroup,
} from "../../data/flightScenery";
import { colorNumber, colors, depth, typeScale } from "../../game/designTokens";
import { compactUiScale, isCompactDisplay } from "../../game/displayScale";
import type { DockingStateKind, ShipControls } from "../../types/flight";
import {
  DashboardTicker,
  HudPanel,
  KEYCAP_HEIGHT,
  Keycap,
  SURFACE,
  StatePill,
  TouchControls,
  detectTouchDevice,
  formatReadout,
  monoStyle,
  type HudRow,
  type MeterAccent,
  type TouchZoneDefinition,
  type UiState,
} from "../../ui";

export type FlightDashboardMode = "flying" | "incident" | "arriving";

export type FlightDashboardView = {
  /** px/s */
  readonly speed: number;
  /** World px to the dock. */
  readonly distance: number;
  readonly bottomDegrees: number;
  /** 0..100 */
  readonly packageCondition: number;
  readonly dockingKind: DockingStateKind;
  readonly mode: FlightDashboardMode;
  /** Dashboard chatter line (typewriter ticker). */
  readonly note: string;
};

type TouchZoneId = keyof ShipControls;

/** Axis-aligned screen rectangle (scroll-factor-0 HUD space, top-left origin). */
export type HudScreenRect = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };

const ROW = { speed: "speed", distance: "distance", bottom: "bottom", package: "package" } as const;

const PILL_STATE: Readonly<Record<DockingStateKind, UiState>> = {
  "too-far": "flying",
  approaching: "docking",
  "slow-down": "docking",
  align: "delivering",
  ready: "idle",
};

const NO_CONTROLS: ShipControls = { thrust: false, brake: false, rotateLeft: false, rotateRight: false };

/**
 * Flight dashboard composed from the shared UI kit: instrument HudPanel (speed, moon distance,
 * bottom heading, package meter), an arrival StatePill, a typewriter DashboardTicker, a keycap hint
 * strip (keyboard devices only) and multi-touch pads (touch devices). Everything scales with
 * `compactUiScale` and re-lays out on resize; compact displays keep every instrument row and the
 * hint strip. Exposes the touch-pad rectangles so world labels can stay clear of the pads.
 * Display only: the scene passes already-computed values.
 */
export class FlightDashboard {
  private objects: Phaser.GameObjects.GameObject[] = [];
  private panel: HudPanel | undefined;
  private pill: StatePill | undefined;
  private ticker: DashboardTicker | undefined;
  private touch: TouchControls | undefined;
  private lastView: FlightDashboardView | undefined;
  private lastNote = "";
  private lastPill = "";
  private avoidRects: readonly HudScreenRect[] = [];

  constructor(private readonly scene: Phaser.Scene) {
    this.build();
    const onResize = (): void => this.rebuild();
    scene.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.scale.off(Phaser.Scale.Events.RESIZE, onResize);
      this.destroyObjects();
    });
  }

  /** Touch pad state mapped to ship controls (all false on keyboard devices). */
  get controls(): ShipControls {
    const touch = this.touch;
    if (!touch) return NO_CONTROLS;
    return {
      thrust: touch.isDown("thrust"),
      brake: touch.isDown("brake"),
      rotateLeft: touch.isDown("rotateLeft"),
      rotateRight: touch.isDown("rotateRight"),
    };
  }

  /**
   * Screen rects that world labels must stay clear of: the visible touch pads (touch devices) or
   * the keycap hint strip (keyboard devices). Rebuilt on resize.
   */
  get labelAvoidRects(): readonly HudScreenRect[] {
    return this.avoidRects;
  }

  /** Scale applied to every HUD element (1 on desktop, larger on phones). */
  get uiScale(): number {
    return compactUiScale(this.scene);
  }

  update(view: FlightDashboardView): void {
    this.lastView = view;
    const panel = this.panel;
    if (panel) {
      panel.setValue(ROW.speed, formatReadout(view.speed / destinationIndicatorStyle.pxPerUnit, { decimals: 1, unit: flightHudCopy.speedUnit }));
      panel.setValue(ROW.distance, formatReadout(view.distance / destinationIndicatorStyle.pxPerUnit, { decimals: 1, unit: destinationIndicatorStyle.unitLabel }));
      panel.setValue(ROW.bottom, `${Math.round(view.bottomDegrees).toString().padStart(3, "0")}°`);
      panel.setMeter(ROW.package, view.packageCondition / 100, packageAccent(view.packageCondition));
    }

    const pillState: UiState = view.mode === "incident" ? "incident" : view.mode === "arriving" ? "delivering" : PILL_STATE[view.dockingKind];
    const pillLabel =
      view.mode === "incident" ? flightHudCopy.incidentPill : view.mode === "arriving" ? flightHudCopy.arrivingPill : flightHudCopy.pill[view.dockingKind];
    const pillKey = `${pillState}:${pillLabel}`;
    if (pillKey !== this.lastPill) {
      this.lastPill = pillKey;
      this.pill?.setPillState(pillState, pillLabel);
    }

    if (view.note !== this.lastNote) {
      this.lastNote = view.note;
      const line = this.ticker?.say(view.note);
      // The hand-off is short (<= 1.2 s): show its line whole instead of typing it out.
      if (view.mode === "arriving") line?.finishReveal();
    }
  }

  private rebuild(): void {
    this.destroyObjects();
    this.lastPill = "";
    const note = this.lastNote;
    this.build();
    if (this.lastView) this.update(this.lastView);
    if (note) this.ticker?.say(note).finishReveal();
  }

  private build(): void {
    const scene = this.scene;
    const layout = flightHudLayout;
    const s = compactUiScale(scene);
    const compact = isCompactDisplay(scene);
    const { width, height } = scene.scale;
    const margin = Math.round(layout.margin * s);
    const touchDevice = detectTouchDevice();

    // Every row stays on phones too: the bottom heading is the docking mechanic.
    const rows: readonly HudRow[] = [
      { id: ROW.speed, label: flightHudCopy.speed, value: "" },
      { id: ROW.distance, label: flightHudCopy.distance, value: "" },
      { id: ROW.bottom, label: flightHudCopy.bottom, value: "" },
      { kind: "meter", id: ROW.package, label: flightHudCopy.package, value: 1, accent: "sage", segments: 10 },
    ];
    // Kit widgets take `uiScale` natively (crisp text sizes, pixel font snapped to its grid).
    const panelWidth = Math.round((compact ? layout.compactPanelWidth : layout.panelWidth) * s);
    const panel = new HudPanel(scene, { x: margin, y: margin, width: panelWidth, title: flightHudCopy.title, icon: "radar", rows, fixed: true, uiScale: s });
    panel.setDepth(depth.hud);
    this.panel = panel;

    const pill = new StatePill(scene, {
      x: margin,
      y: Math.round(margin + panel.panelHeight + layout.stackGap * s),
      state: "flying",
      label: flightHudCopy.pill["too-far"],
      fixed: true,
      uiScale: s,
    });
    pill.setDepth(depth.hud);
    this.pill = pill;

    // Ticker: top centre on desktop; beside the panel on compact displays.
    const panelRight = margin + panelWidth;
    const tickerX = compact ? Math.round(panelRight + margin) : Math.round((width - layout.tickerWidth * s) / 2);
    const tickerWidth = compact
      ? Math.min(layout.tickerWidth, Math.floor((width - margin - tickerX) / s))
      : layout.tickerWidth;
    const ticker = new DashboardTicker(scene, { x: Math.max(tickerX, Math.round(panelRight + margin)), y: margin, width: tickerWidth, fixed: true });
    ticker.setScale(s).setDepth(depth.hud);
    this.ticker = ticker;

    this.objects = [panel, pill, ticker];

    const avoid: HudScreenRect[] = [];
    // Keyboard devices always get the keycap strip (phones included), so keys stay discoverable.
    if (!touchDevice) {
      const hints = this.buildHints(width, height, s);
      this.objects.push(hints.container);
      avoid.push(hints.rect);
    }

    const zones = touchZones(width, height, s);
    this.touch = new TouchControls(scene, { zones, visibility: "auto", tone: "ink", uiScale: s });
    this.objects.push(this.touch);
    if (this.touch.visible) avoid.push(...zones.map(zoneRect));
    this.avoidRects = avoid;
  }

  /** Bottom-centre keycap strip: [W] thrust  [S] brake  [A][D] rotate  [R] restart. */
  private buildHints(width: number, height: number, s: number): { readonly container: Phaser.GameObjects.Container; readonly rect: HudScreenRect } {
    const layout = flightHudLayout;
    const scene = this.scene;
    const container = scene.add.container(0, 0).setScrollFactor(0, 0, true).setDepth(depth.hud);
    const background = scene.add.graphics();
    container.add(background);

    let cursor = layout.hintPaddingX;
    const groups: readonly FlightHintGroup[] = flightHudCopy.hints;
    groups.forEach((group, groupIndex) => {
      if (groupIndex > 0) cursor += layout.hintGroupGap;
      group.keys.forEach((key, keyIndex) => {
        if (keyIndex > 0) cursor += layout.hintGap / 2;
        const cap = new Keycap(scene, { x: cursor, y: layout.hintPaddingY, label: key });
        container.add(cap);
        cursor += cap.keyWidth;
      });
      cursor += layout.hintGap;
      const label = scene.add
        .text(cursor, layout.hintPaddingY + KEYCAP_HEIGHT / 2, group.label, monoStyle({ size: typeScale.sm, color: colors.plaster }))
        .setOrigin(0, 0.5)
        .setAlpha(0.86);
      container.add(label);
      cursor += label.width;
    });
    cursor += layout.hintPaddingX;

    const stripHeight = KEYCAP_HEIGHT + layout.hintPaddingY * 2;
    const spec = SURFACE.darkHud;
    background.fillStyle(colorNumber(spec.fill), spec.fillAlpha);
    background.fillRoundedRect(0, 0, cursor, stripHeight, spec.radius);
    background.lineStyle(spec.borderWidth, colorNumber(spec.border), spec.borderAlpha);
    background.strokeRoundedRect(1, 1, cursor - 2, stripHeight - 2, spec.radius - 1);

    const rect: HudScreenRect = {
      x: Math.round((width - cursor * s) / 2),
      y: Math.round(height - (layout.hintBottom + stripHeight) * s),
      width: Math.ceil(cursor * s),
      height: Math.ceil(stripHeight * s),
    };
    container.setScale(s).setAlpha(layout.hintAlpha).setPosition(rect.x, rect.y);
    return { container, rect };
  }

  private destroyObjects(): void {
    for (const object of this.objects) object.destroy();
    this.objects = [];
    this.panel = undefined;
    this.pill = undefined;
    this.ticker = undefined;
    this.touch = undefined;
  }
}

function zoneRect(zone: TouchZoneDefinition): HudScreenRect {
  const shape = zone.shape;
  if (shape.kind === "rect") return { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
  return { x: shape.x - shape.radius, y: shape.y - shape.radius, width: shape.radius * 2, height: shape.radius * 2 };
}

function packageAccent(condition: number): MeterAccent {
  for (const band of packageMeterBands) if (condition >= band.min) return band.accent;
  return "ember";
}

/** Rotate pads on the left thumb, brake/thrust on the right, anchored to the bottom corners. */
function touchZones(width: number, height: number, s: number): readonly (TouchZoneDefinition & { readonly id: TouchZoneId })[] {
  const layout = flightHudLayout;
  const radius = Math.round(layout.touchRadius * s);
  const inset = Math.round(layout.touchInset * s);
  const spacing = Math.round(layout.touchSpacing * s);
  const y = height - inset;
  const copy = flightHudCopy.touch;
  return [
    { id: "rotateLeft", shape: { kind: "circle", x: inset, y, radius }, label: copy.rotateLeft, glyph: "left" },
    { id: "rotateRight", shape: { kind: "circle", x: inset + spacing, y, radius }, label: copy.rotateRight, glyph: "right" },
    { id: "brake", shape: { kind: "circle", x: width - inset - spacing, y, radius }, label: copy.brake, glyph: "steady" },
    { id: "thrust", shape: { kind: "circle", x: width - inset, y, radius }, label: copy.thrust, icon: "thrust" },
  ];
}
