import Phaser from "phaser";
import type { UiIconName } from "../data/assetManifest";
import { colorNumber, colors, depth, typeScale } from "../game/designTokens";
import { addUiIcon } from "./icons";
import { hitTestZones, isLikelyTouchDevice, uiIconScale, uiScaled, uiTextSize, type TouchZoneHitArea, type TouchZoneShape } from "./layout";
import { fillSteppedRect, STEPPED_CORNER } from "./surfaces";
import { monoStyle } from "./textStyles";
import { touchGlyphCells, type TouchGlyph } from "./touchGlyphs";

export type { TouchGlyph } from "./touchGlyphs";

export type TouchZoneDefinition = TouchZoneHitArea & {
  readonly label?: string;
  readonly icon?: UiIconName;
  /** Drawn pixel arrow/steady glyph (used when no `icon` is given). */
  readonly glyph?: TouchGlyph;
};

/**
 * auto: visible on coarse-pointer touch devices, or after the first touch anywhere.
 * always: visible and also accepts mouse input (galleries, desktop testing).
 * never: hidden until `setVisibility` changes it.
 */
export type TouchVisibility = "auto" | "always" | "never";

/** ink: dark tile for space scenes. cream: plaster keycap tile for bright scenes (landing). */
export type TouchTone = "ink" | "cream";

export type TouchControlsOptions = {
  /** Zones in screen (camera-fixed) coordinates of the 1280x720 canvas. */
  readonly zones: readonly TouchZoneDefinition[];
  readonly visibility?: TouchVisibility;
  readonly tone?: TouchTone;
  /** Compact-display multiplier (see `compactUiScale`) for labels and icons. Default 1. */
  readonly uiScale?: number;
};

export type TouchChangeListener = (zoneId: string, down: boolean) => void;

const MIN_POINTERS = 4;

/** Tile geometry (screen px). Circle zones draw a square tile inscribed in their hit circle. */
const TILE = {
  border: 2,
  innerBorder: 2,
  lip: 4,
  /** Tile side for circle zones as a fraction of the diameter (the hit area stays the circle). */
  circleSideRatio: 0.86,
  labelGap: 8,
} as const;

type TonePalette = {
  readonly face: string;
  readonly faceDown: string;
  readonly inner: string;
  readonly innerAlpha: number;
  readonly innerDown: string;
  readonly lip: string;
  readonly content: string;
  readonly contentDown: string;
  readonly glyphShadow: string;
};

const TONES: Readonly<Record<TouchTone, TonePalette>> = {
  ink: {
    face: colors.ink,
    faceDown: colors.ember,
    inner: colors.amber,
    innerAlpha: 0.55,
    innerDown: colors.plaster,
    lip: colors.cosmosDeep,
    content: colors.plaster,
    contentDown: colors.plaster,
    glyphShadow: colors.cosmosDeep,
  },
  cream: {
    face: colors.plaster,
    faceDown: colors.parchmentDeep,
    inner: colors.border,
    innerAlpha: 1,
    innerDown: colors.ember,
    lip: colors.ink,
    content: colors.ink,
    contentDown: colors.terracottaDeep,
    glyphShadow: colors.border,
  },
};

export function detectTouchDevice(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const coarse = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
  return isLikelyTouchDevice({
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    coarsePointer: coarse,
    hasTouchEvents: "ontouchstart" in window,
  });
}

type TileRect = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };

type ZoneView = {
  readonly definition: TouchZoneDefinition;
  readonly tile: TileRect;
  readonly graphics: Phaser.GameObjects.Graphics;
  readonly content: Phaser.GameObjects.Container;
  readonly glyph: Phaser.GameObjects.Graphics | undefined;
  readonly label: Phaser.GameObjects.Text | undefined;
};

/**
 * Multi-touch hold zones (thrust, rotate, stabilise...). Each touch pointer maps to at most one
 * zone; sliding a finger between zones transfers the hold. Query with `isDown(id)` every frame or
 * subscribe with `onChange`. Knows nothing about flight or landing; scenes map zone ids to controls.
 * Every zone renders as the same filled pixel tile (ink border, warm inner border, hard lip) with
 * an icon or drawn glyph; held tiles sink onto their lip and light up.
 */
export class TouchControls extends Phaser.GameObjects.Container {
  private readonly zones: readonly TouchZoneDefinition[];
  private readonly views: ZoneView[] = [];
  private readonly pointerZones = new Map<number, string>();
  private readonly downCounts = new Map<string, number>();
  private readonly changeListeners = new Set<TouchChangeListener>();
  private readonly tone: TouchTone;
  private readonly uiScale: number;
  private visibility: TouchVisibility;

  constructor(scene: Phaser.Scene, options: TouchControlsOptions) {
    super(scene, 0, 0);
    this.zones = options.zones;
    this.visibility = options.visibility ?? "auto";
    this.tone = options.tone ?? "ink";
    this.uiScale = options.uiScale ?? 1;

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
    const scene = this.scene;
    const tile = tileRect(zone.shape);
    const graphics = scene.add.graphics();
    const content = scene.add.container(Math.round(tile.x + tile.width / 2), Math.round(tile.y + tile.height / 2));
    const palette = TONES[this.tone];
    const iconScale = uiIconScale(this.uiScale);
    const hasLabel = Boolean(zone.label);
    const labelSize = uiTextSize(typeScale.sm, this.uiScale);
    // Icon sits above centre when a label shares the tile.
    const iconY = hasLabel ? -Math.round((labelSize + uiScaled(TILE.labelGap, this.uiScale)) / 2) : 0;

    let glyph: Phaser.GameObjects.Graphics | undefined;
    if (zone.icon) {
      content.add(addUiIcon(scene, 0, iconY, zone.icon, { scale: iconScale }));
    } else if (zone.glyph) {
      glyph = scene.add.graphics().setPosition(0, iconY);
      content.add(glyph);
    }

    let label: Phaser.GameObjects.Text | undefined;
    if (zone.label) {
      const iconHalf = zone.icon || zone.glyph ? 8 * iconScale : 0;
      label = scene.add
        .text(0, iconY + iconHalf + uiScaled(TILE.labelGap, this.uiScale), zone.label, monoStyle({ size: labelSize, bold: true, color: palette.content }))
        .setOrigin(0.5, 0);
      content.add(label);
    }

    const view: ZoneView = { definition: zone, tile, graphics, content, glyph, label };
    this.views.push(view);
    this.add([graphics, content]);
    this.drawZone(view, false);
  }

  private drawZone(view: ZoneView, down: boolean): void {
    const palette = TONES[this.tone];
    const { x, y, width, height } = view.tile;
    const faceHeight = height - TILE.lip;
    const sink = down ? TILE.lip - 2 : 0;
    const g = view.graphics;
    g.clear();
    // Hard lip under the face (solid, no gap), then the ink-bordered face.
    g.fillStyle(colorNumber(palette.lip), 1);
    fillSteppedRect(g, x, y + TILE.lip, width, faceHeight, STEPPED_CORNER.round);
    g.fillStyle(colorNumber(colors.ink), 1);
    fillSteppedRect(g, x, y + sink, width, faceHeight, STEPPED_CORNER.round);
    const inset = TILE.border;
    g.fillStyle(colorNumber(down ? palette.innerDown : palette.inner), down ? 1 : palette.innerAlpha);
    fillSteppedRect(g, x + inset, y + sink + inset, width - inset * 2, faceHeight - inset * 2, STEPPED_CORNER.soft);
    const face = inset + TILE.innerBorder;
    g.fillStyle(colorNumber(down ? palette.faceDown : palette.face), 1);
    fillSteppedRect(g, x + face, y + sink + face, width - face * 2, faceHeight - face * 2, STEPPED_CORNER.notch);
    // Top highlight band.
    g.fillStyle(colorNumber(colors.plaster), down ? 0.18 : this.tone === "ink" ? 0.08 : 0.9);
    g.fillRect(x + face + 2, y + sink + face, width - (face + 2) * 2, 2);

    view.content.setY(Math.round(y + faceHeight / 2) + sink);
    view.label?.setColor(down ? palette.contentDown : palette.content);
    if (view.glyph && view.definition.glyph) this.drawGlyph(view.glyph, view.definition.glyph, down);
  }

  private drawGlyph(g: Phaser.GameObjects.Graphics, glyph: TouchGlyph, down: boolean): void {
    const palette = TONES[this.tone];
    const unit = uiIconScale(this.uiScale);
    const cells = touchGlyphCells(glyph);
    const offsetX = -Math.round((cells.width * unit) / 2);
    const offsetY = -Math.round((cells.height * unit) / 2);
    g.clear();
    g.fillStyle(colorNumber(palette.glyphShadow), 1);
    for (const [cx, cy] of cells.cells) g.fillRect(offsetX + cx * unit, offsetY + (cy + 1) * unit, unit, unit);
    g.fillStyle(colorNumber(down ? palette.contentDown : palette.content), 1);
    for (const [cx, cy] of cells.cells) g.fillRect(offsetX + cx * unit, offsetY + cy * unit, unit, unit);
  }
}

function tileRect(shape: TouchZoneShape): TileRect {
  if (shape.kind === "rect") return { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
  const side = Math.round((shape.radius * 2 * TILE.circleSideRatio) / 2) * 2;
  return { x: Math.round(shape.x - side / 2), y: Math.round(shape.y - side / 2), width: side, height: side };
}
