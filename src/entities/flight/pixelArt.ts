import type Phaser from "phaser";
import { ASSET_MANIFEST } from "../../data/assetManifest";

/**
 * Pixel-art helpers for the flight scene. Everything here draws at ART resolution into small
 * canvas textures that are then displayed at an integer scale, so rings, halos, badges and the
 * ghost ship share the same chunky pixel grid as the authored sprites (no smooth vector circles).
 */

const TAU = Math.PI * 2;

/** Integer display scale from the manifest when the loaded art matches its contract size, else `legacyScale`. */
export function contractScale(scene: Phaser.Scene, key: string, legacyScale: number): number {
  const entry = ASSET_MANIFEST.find((candidate) => candidate.key === key);
  if (!entry || !scene.textures.exists(key)) return legacyScale;
  const source = scene.textures.get(key).getSourceImage();
  return source.width === entry.width && source.height === entry.height ? entry.artScale : legacyScale;
}

/** True when the loaded texture has the manifest's contract size. */
export function matchesContract(scene: Phaser.Scene, key: string): boolean {
  const entry = ASSET_MANIFEST.find((candidate) => candidate.key === key);
  if (!entry || !scene.textures.exists(key)) return false;
  const source = scene.textures.get(key).getSourceImage();
  return source.width === entry.width && source.height === entry.height;
}

function createCanvasTexture(scene: Phaser.Scene, key: string, width: number, height: number): CanvasRenderingContext2D | undefined {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const texture = scene.textures.createCanvas(key, Math.max(1, width), Math.max(1, height));
  if (!texture) return undefined;
  const context = texture.getContext();
  context.clearRect(0, 0, width, height);
  return context;
}

function refresh(scene: Phaser.Scene, key: string): void {
  const texture = scene.textures.get(key) as Phaser.Textures.CanvasTexture;
  if (typeof texture.refresh === "function") texture.refresh();
}

/**
 * A copy of `sourceKey` stacked with its vertical mirror (twice as tall). Mirrored tiles repeat
 * vertically without a seam, so a horizontally tileable band (the nebula) can scroll in Y too.
 */
export function ensureVerticalMirrorTile(scene: Phaser.Scene, sourceKey: string, key: string): string {
  if (scene.textures.exists(key)) return key;
  const source = scene.textures.get(sourceKey).getSourceImage() as CanvasImageSource & { width: number; height: number };
  const { width, height } = source;
  const context = createCanvasTexture(scene, key, width, height * 2);
  if (!context) return sourceKey;
  context.imageSmoothingEnabled = false;
  context.drawImage(source, 0, 0);
  context.save();
  context.translate(0, height * 2);
  context.scale(1, -1);
  context.drawImage(source, 0, 0);
  context.restore();
  refresh(scene, key);
  return key;
}

export type PixelRingOptions = {
  readonly key: string;
  /** Ring centre radius in art px. */
  readonly radius: number;
  /** Band thickness in art px. */
  readonly thickness: number;
  readonly dashCount: number;
  /** 0..1 drawn fraction of each dash slot (1 = solid ring). */
  readonly dashFill: number;
  /** Rotates the dash pattern (radians). */
  readonly phase?: number;
  readonly color: string;
  readonly alpha?: number;
};

/** Dashed ring rasterised on the art grid. Texture is square; the ring centre is the texture centre. */
export function ensurePixelRing(scene: Phaser.Scene, options: PixelRingOptions): string {
  if (scene.textures.exists(options.key)) return options.key;
  const half = Math.ceil(options.radius + options.thickness) + 1;
  const size = half * 2;
  const context = createCanvasTexture(scene, options.key, size, size);
  if (!context) return options.key;
  context.fillStyle = options.color;
  context.globalAlpha = options.alpha ?? 1;
  const slot = TAU / Math.max(1, options.dashCount);
  const phase = options.phase ?? 0;
  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      const dx = px + 0.5 - half;
      const dy = py + 0.5 - half;
      const distance = Math.hypot(dx, dy);
      if (Math.abs(distance - options.radius) > options.thickness / 2) continue;
      if (options.dashFill < 1) {
        const angle = (((Math.atan2(dy, dx) - phase) % TAU) + TAU) % TAU;
        if ((angle % slot) / slot > options.dashFill) continue;
      }
      context.fillRect(px, py, 1, 1);
    }
  }
  refresh(scene, options.key);
  return options.key;
}

export type PixelHaloOptions = {
  readonly key: string;
  /** Body radius in art px; halo rings extend beyond it by `steps`. */
  readonly radius: number;
  readonly steps: readonly number[];
  readonly color: string;
  /** Alpha added per overlapping halo step. */
  readonly alphaPerStep: number;
};

/** Stepped halo (concentric discs) rasterised on the art grid. Centre = texture centre. */
export function ensurePixelHalo(scene: Phaser.Scene, options: PixelHaloOptions): string {
  if (scene.textures.exists(options.key)) return options.key;
  const outer = options.radius + Math.max(0, ...options.steps);
  const half = Math.ceil(outer) + 1;
  const size = half * 2;
  const context = createCanvasTexture(scene, options.key, size, size);
  if (!context) return options.key;
  context.fillStyle = options.color;
  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      const distance = Math.hypot(px + 0.5 - half, py + 0.5 - half);
      let layers = 0;
      for (const step of options.steps) if (distance <= options.radius + step) layers += 1;
      if (layers === 0) continue;
      context.globalAlpha = Math.min(1, layers * options.alphaPerStep);
      context.fillRect(px, py, 1, 1);
    }
  }
  refresh(scene, options.key);
  return options.key;
}

export type OutlineOptions = {
  readonly key: string;
  readonly sourceKey: string;
  readonly color: string;
  /** Sparse checker fill inside the silhouette (0 = outline only). */
  readonly fillAlpha: number;
};

/** 1-art-px outline of a sprite's silhouette (plus an optional dithered fill), for ghost poses. */
export function ensureOutlineTexture(scene: Phaser.Scene, options: OutlineOptions): string {
  if (scene.textures.exists(options.key)) return options.key;
  const source = scene.textures.get(options.sourceKey).getSourceImage() as CanvasImageSource & { width: number; height: number };
  const { width, height } = source;
  if (typeof document === "undefined") return options.sourceKey;
  const scratch = document.createElement("canvas");
  scratch.width = width;
  scratch.height = height;
  const scratchContext = scratch.getContext("2d");
  if (!scratchContext) return options.sourceKey;
  scratchContext.drawImage(source, 0, 0);
  const pixels = scratchContext.getImageData(0, 0, width, height).data;
  const solid = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < width && y < height && (pixels[(y * width + x) * 4 + 3] ?? 0) > 127;

  const context = createCanvasTexture(scene, options.key, width, height);
  if (!context) return options.sourceKey;
  context.fillStyle = options.color;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (solid(x, y)) {
        const edge = !solid(x - 1, y) || !solid(x + 1, y) || !solid(x, y - 1) || !solid(x, y + 1);
        if (edge) {
          context.globalAlpha = 1;
          context.fillRect(x, y, 1, 1);
        } else if (options.fillAlpha > 0 && (x + y) % 2 === 0) {
          context.globalAlpha = options.fillAlpha;
          context.fillRect(x, y, 1, 1);
        }
      }
    }
  }
  refresh(scene, options.key);
  return options.key;
}

export type PixelBadgeOptions = {
  readonly key: string;
  /** Plate radius in art px. */
  readonly radius: number;
  readonly fill: string;
  readonly fillAlpha: number;
  readonly rim: string;
  readonly rimAlpha: number;
};

/** Round dark plate with a 1-art-px rim. Centre = texture centre. */
export function ensurePixelPlate(scene: Phaser.Scene, options: PixelBadgeOptions): string {
  if (scene.textures.exists(options.key)) return options.key;
  const half = Math.ceil(options.radius) + 1;
  const size = half * 2;
  const context = createCanvasTexture(scene, options.key, size, size);
  if (!context) return options.key;
  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      const distance = Math.hypot(px + 0.5 - half, py + 0.5 - half);
      if (distance > options.radius) continue;
      const rim = distance > options.radius - 1;
      context.globalAlpha = rim ? options.rimAlpha : options.fillAlpha;
      context.fillStyle = rim ? options.rim : options.fill;
      context.fillRect(px, py, 1, 1);
    }
  }
  refresh(scene, options.key);
  return options.key;
}

export type PixelChevronOptions = {
  readonly key: string;
  /** Pointing direction in radians (0 = +x). */
  readonly angle: number;
  /** Chevron length along the direction, half width across it, and stroke thickness (art px). */
  readonly length: number;
  readonly halfWidth: number;
  readonly thickness: number;
  /** Number of nested chevrons and the spacing between their tips (art px). */
  readonly count: number;
  readonly spacing: number;
  readonly color: string;
  readonly outline: string;
  /** Alpha of each successive chevron (first = leading). */
  readonly alphas: readonly number[];
};

/**
 * Nested chevrons rasterised directly at `angle` (so they never need sprite rotation), with a
 * 1-art-px dark outline. Texture centre = the middle of the chevron group.
 */
export function ensurePixelChevrons(scene: Phaser.Scene, options: PixelChevronOptions): string {
  if (scene.textures.exists(options.key)) return options.key;
  const groupLength = options.length + options.spacing * (options.count - 1);
  const half = Math.ceil(Math.max(groupLength, options.halfWidth * 2) / 2) + 3;
  const size = half * 2;
  const context = createCanvasTexture(scene, options.key, size, size);
  if (!context) return options.key;

  const dir = { x: Math.cos(options.angle), y: Math.sin(options.angle) };
  const side = { x: -dir.y, y: dir.x };
  const shapes = Array.from({ length: options.count }, (_, index) => {
    const tip = groupLength / 2 - index * options.spacing;
    const back = tip - options.length;
    const polygon: readonly (readonly [number, number])[] = [
      [tip, 0],
      [back, options.halfWidth],
      [back - options.thickness, options.halfWidth],
      [tip - options.thickness, 0],
      [back - options.thickness, -options.halfWidth],
      [back, -options.halfWidth],
    ];
    return polygon.map(([along, across]) => ({ x: dir.x * along + side.x * across, y: dir.y * along + side.y * across }));
  });

  const inside = (x: number, y: number): number => {
    for (let index = 0; index < shapes.length; index += 1) {
      const shape = shapes[index];
      if (shape && pointInPolygon(x, y, shape)) return index;
    }
    return -1;
  };

  const owner: number[] = [];
  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) owner.push(inside(px + 0.5 - half, py + 0.5 - half));
  }
  const at = (x: number, y: number): number => (x < 0 || y < 0 || x >= size || y >= size ? -1 : (owner[y * size + x] ?? -1));

  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      const index = at(px, py);
      if (index >= 0) {
        context.globalAlpha = options.alphas[index] ?? 1;
        context.fillStyle = options.color;
        context.fillRect(px, py, 1, 1);
      } else if (at(px - 1, py) >= 0 || at(px + 1, py) >= 0 || at(px, py - 1) >= 0 || at(px, py + 1) >= 0) {
        context.globalAlpha = 0.85;
        context.fillStyle = options.outline;
        context.fillRect(px, py, 1, 1);
      }
    }
  }
  refresh(scene, options.key);
  return options.key;
}

function pointInPolygon(x: number, y: number, polygon: readonly { readonly x: number; readonly y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    if (!a || !b) continue;
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export type ArcPixel = { readonly x: number; readonly y: number; readonly t: number };

/**
 * Art-grid pixels of a ring band, sorted clockwise from the top (`t` in 0..1). Draw the first
 * `progress * length` pixels for a crisp, stepped progress arc.
 */
export function ringPixelsClockwise(radius: number, thickness: number): ArcPixel[] {
  const pixels: ArcPixel[] = [];
  const extent = Math.ceil(radius + thickness) + 1;
  for (let y = -extent; y <= extent; y += 1) {
    for (let x = -extent; x <= extent; x += 1) {
      const cx = x + 0.5;
      const cy = y + 0.5;
      if (Math.abs(Math.hypot(cx, cy) - radius) > thickness / 2) continue;
      const fromTop = (((Math.atan2(cy, cx) + Math.PI / 2) % TAU) + TAU) % TAU;
      pixels.push({ x, y, t: fromTop / TAU });
    }
  }
  return pixels.sort((a, b) => a.t - b.t);
}

/** Snaps a screen coordinate to the art grid (multiples of `scale`). */
export function snapToArtGrid(value: number, scale: number): number {
  return Math.round(value / scale) * scale;
}
