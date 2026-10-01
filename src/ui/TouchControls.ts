import Phaser from "phaser";
import type { UiIconName } from "../data/assetManifest";
import { colorNumber, colors, depth, typeScale } from "../game/designTokens";
import { addUiIcon } from "./icons";
import { hitTestZones, isLikelyTouchDevice, type TouchZoneHitArea, type TouchZoneShape } from "./layout";
import { monoStyle } from "./textStyles";

export type TouchZoneDefinition = TouchZoneHitArea & {
  readonly label?: string;
  readonly icon?: UiIconName;
};

/**
 * auto: visible on coarse-pointer touch devices, or after the first touch anywhere.
 * always: visible and also accepts mouse input (galleries, desktop testing).
 * never: hidden until `setVisibility` changes it.
 */
export type TouchVisibility = "auto" | "always" | "never";

export type TouchControlsOptions = {
  /** Zones in screen (camera-fixed) coordinates of the 1280x720 canvas. */
  readonly zones: readonly TouchZoneDefinition[];
  readonly visibility?: TouchVisibility;
};

export type TouchChangeListener = (zoneId: string, down: boolean) => void;

const MIN_POINTERS = 4;

export function detectTouchDevice(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const coarse = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
  return isLikelyTouchDevice({
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    coarsePointer: coarse,
    hasTouchEvents: "ontouchstart" in window,
  });
}

type ZoneView = {
  readonly definition: TouchZoneDefinition;
  readonly graphics: Phaser.GameObjects.Graphics;
};

/**
 * Multi-touch hold zones (thrust, rotate, stabilise...). Each touch pointer maps to at most one
 * zone; sliding a finger between zones transfers the hold. Query with `isDown(id)` every frame or
 * subscribe with `onChange`. Knows nothing about flight or landing; scenes map zone ids to controls.
 */
export class TouchControls extends Phaser.GameObjects.Container {
  private readonly zones: readonly TouchZoneDefinition[];
  private readonly views: ZoneView[] = [];
  private readonly pointerZones = new Map<number, string>();
  private readonly downCounts = new Map<string, number>();
  private readonly changeListeners = new Set<TouchChangeListener>();
  private visibility: TouchVisibility;

  constructor(scene: Phaser.Scene, options: TouchControlsOptions) {
    super(scene, 0, 0);
    this.zones = options.zones;
    this.visibility = options.visibility ?? "auto";

    for (const zone of this.zones) this.addZoneView(zone);
    this.setDepth(depth.touch).setScrollFactor(0, 0, true);
    this.setVisible(this.visibility === "always" || (this.visibility === "auto" && detectTouchDevice()));

    const input = scene.input;
    const missing = MIN_POINTERS - input.manager.pointersTotal;
    if (missing > 0) input.addPointer(missing);

    input.on(Phaser.Input.Events.POINTER_DOWN, this.handleDown, this);
    input.on(Phaser.Input.Events.POINTER_MOVE, this.handleMove, this);
    input.on(Phaser.Input.Events.POINTER_UP, this.handleUp, this);
    input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.handleUp, this);
    input.on(Phaser.Input.Events.GAME_OUT, this.releaseAll, this);
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      input.off(Phaser.Input.Events.POINTER_DOWN, this.handleDown, this);
      input.off(Phaser.Input.Events.POINTER_MOVE, this.handleMove, this);
      input.off(Phaser.Input.Events.POINTER_UP, this.handleUp, this);
      input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.handleUp, this);
      input.off(Phaser.Input.Events.GAME_OUT, this.releaseAll, this);
      this.changeListeners.clear();
    });
    scene.add.existing(this);
  }

  isDown(zoneId: string): boolean {
    return (this.downCounts.get(zoneId) ?? 0) > 0;
  }

  onChange(listener: TouchChangeListener): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  setVisibility(visibility: TouchVisibility): this {
    this.visibility = visibility;
    this.setVisible(visibility === "always" || (visibility === "auto" && (this.visible || detectTouchDevice())));
    if (!this.visible) this.releaseAll();
    return this;
  }

  /** Shows a zone as held without input (galleries/showcases). */
  previewDown(zoneId: string, down: boolean): this {
    const view = this.views.find((candidate) => candidate.definition.id === zoneId);
    if (view) this.drawZone(view, down);
    return this;
  }

  private accepts(pointer: Phaser.Input.Pointer): boolean {
    if (this.visibility === "never") return false;
    if (this.visibility === "always") return true;
    if (!pointer.wasTouch) return false;
    if (!this.visible) this.setVisible(true);
    return true;
  }

  private handleDown(pointer: Phaser.Input.Pointer): void {
    if (!this.accepts(pointer)) return;
    this.assign(pointer.id, hitTestZones(this.zones, pointer.x, pointer.y));
  }

  private handleMove(pointer: Phaser.Input.Pointer): void {
    if (!pointer.isDown || !this.pointerZones.has(pointer.id) || !this.accepts(pointer)) return;
    this.assign(pointer.id, hitTestZones(this.zones, pointer.x, pointer.y));
  }

  private handleUp(pointer: Phaser.Input.Pointer): void {
    this.assign(pointer.id, null);
  }

  private releaseAll(): void {
    for (const pointerId of [...this.pointerZones.keys()]) this.assign(pointerId, null);
  }

  private assign(pointerId: number, zoneId: string | null): void {
    const previous = this.pointerZones.get(pointerId) ?? null;
    if (previous === zoneId) return;
    if (previous !== null) {
      this.pointerZones.delete(pointerId);
      this.adjust(previous, -1);
    }
    if (zoneId !== null) {
      this.pointerZones.set(pointerId, zoneId);
      this.adjust(zoneId, 1);
    }
  }

  private adjust(zoneId: string, delta: number): void {
    const before = this.downCounts.get(zoneId) ?? 0;
    const after = Math.max(0, before + delta);
    this.downCounts.set(zoneId, after);
    if (before > 0 === after > 0) return;
    const view = this.views.find((candidate) => candidate.definition.id === zoneId);
    if (view) this.drawZone(view, after > 0);
    for (const listener of this.changeListeners) listener(zoneId, after > 0);
  }

  private addZoneView(zone: TouchZoneDefinition): void {
    const graphics = this.scene.add.graphics();
    const view: ZoneView = { definition: zone, graphics };
    this.views.push(view);
    this.add(graphics);
    this.drawZone(view, false);

    const center = zoneCenter(zone.shape);
    if (zone.icon) this.add(addUiIcon(this.scene, center.x, center.y - (zone.label ? 8 : 0), zone.icon));
    if (zone.label) {
      this.add(
        this.scene.add
          .text(center.x, center.y + (zone.icon ? 22 : 0), zone.label, monoStyle({ size: typeScale.sm, bold: true, color: colors.plaster }))
          .setOrigin(0.5, 0.5)
          .setAlpha(0.85),
      );
    }
  }

  private drawZone(view: ZoneView, down: boolean): void {
    const g = view.graphics;
    const shape = view.definition.shape;
    g.clear();
    g.fillStyle(colorNumber(down ? colors.ember : colors.cosmosPanel), down ? 0.5 : 0.42);
    g.lineStyle(2, colorNumber(colors.plaster), down ? 0.85 : 0.32);
    if (shape.kind === "circle") {
      g.fillCircle(shape.x, shape.y, shape.radius);
      g.strokeCircle(shape.x, shape.y, shape.radius - 1);
    } else {
      g.fillRoundedRect(shape.x, shape.y, shape.width, shape.height, 12);
      g.strokeRoundedRect(shape.x + 1, shape.y + 1, shape.width - 2, shape.height - 2, 11);
    }
  }
}

function zoneCenter(shape: TouchZoneShape): { x: number; y: number } {
  return shape.kind === "circle" ? { x: shape.x, y: shape.y } : { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 };
}
