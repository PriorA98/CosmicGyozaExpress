import Phaser from "phaser";
import type { CampaignThemeDefinition } from "../../data/campaign/themes";
import { campaignLandingScenery, type CampaignLandingDecor, type LandingDecorProp } from "../../data/landingScenery";
import { colorNumber, colors, depth } from "../../game/designTokens";
import { resolvePropPosition } from "./campaignPresentation";
import { mixHex } from "./colorMix";
import { drawSpans, filledEllipseSpans } from "./pixelShapes";

/** What the porch painter built: its display objects plus the roof ridge (for a ridge-mounted windsock). */
export type CampaignPorchDecor = {
  readonly objects: readonly Phaser.GameObjects.GameObject[];
  readonly ridge: { readonly x: number; readonly y: number } | null;
};

type Palette = {
  readonly ink: number; readonly light: number; readonly accent: number; readonly ground: number;
  readonly plaster: number; readonly rim: number; readonly wall: number; readonly dark: number;
};

/** Pixel painter on the 2 px grid: opaque shapes on `g`, additive glow (halos, light pools) on `glow`. */
type Painter = {
  rect(x: number, y: number, w: number, h: number, color: number, alpha?: number): void;
  ellipse(x: number, y: number, rx: number, ry: number, color: number, alpha?: number): void;
  halo(x: number, y: number, radius: number, alpha?: number): void;
  pool(x: number, y: number, rx: number, ry: number, alpha?: number): void;
};

type PorchShape = { readonly doorX: number; readonly ridge: { readonly x: number; readonly y: number } | null };

const snap = (value: number): number => Math.round(value / 2) * 2;

/**
 * Authored foreground for a campaign landing, painted once on the 2x grid: the recipient's building (one
 * silhouette per theme), its lit doorway / windows with additive halos, a warm light pool reaching the berth,
 * the theme's rocks, and the small props. Touch layouts move props clear of the touch pads.
 */
export function createCampaignPorchDecor(
  scene: Phaser.Scene, theme: CampaignThemeDefinition, decor: CampaignLandingDecor, recipientX: number, touchLayout: boolean,
): CampaignPorchDecor {
  const g = scene.add.graphics().setDepth(depth.world);
  // Above the berth (world + 2), below the recipient (world + 3): light spills over the berth's near end.
  const glow = scene.add.graphics().setDepth(depth.world + 2.5).setBlendMode(Phaser.BlendModes.ADD);
  const p = theme.palette;
  const c: Palette = {
    ink: colorNumber(colors.ink), light: decor.warmHorizon ? mixHex(p.light, colors.ember, 0.45) : colorNumber(p.light), accent: colorNumber(p.accent), ground: colorNumber(p.ground),
    plaster: colorNumber(colors.parchment), rim: colorNumber(decor.tones.rim),
    wall: mixHex(p.ground, p.light, 0.14), dark: mixHex(p.ground, colors.ink, 0.45),
  };
  const paint: Painter = {
    rect: (x, y, w, h, color, alpha = 1) => {
      g.fillStyle(color, alpha);
      g.fillRect(snap(x), snap(y), snap(w), snap(h));
    },
    ellipse: (x, y, rx, ry, color, alpha = 1) => {
      g.fillStyle(color, alpha);
      drawSpans(g, snap(x), snap(y), filledEllipseSpans(Math.max(2, snap(rx)), Math.max(2, snap(ry)), 2), 2);
    },
    halo: (x, y, radius, alpha = 1) => {
      for (const [k, a] of [[1, 0.05], [0.66, 0.07], [0.38, 0.1]] as const) {
        glow.fillStyle(c.light, a * alpha);
        const r = Math.max(2, snap(radius * k));
        drawSpans(glow, snap(x), snap(y), filledEllipseSpans(r, r, 2), 2);
      }
    },
    pool: (x, y, rx, ry, alpha = 1) => {
      for (let i = 0; i < 3; i += 1) {
        glow.fillStyle(c.light, 0.045 * alpha);
        drawSpans(glow, snap(x), snap(y), filledEllipseSpans(snap(rx * (1 - i * 0.25)), Math.max(2, snap(ry * (1 - i * 0.25))), 2), 2);
      }
    },
  };

  const base = campaignLandingScenery.groundTopY;
  const shape = paintPorch(paint, c, decor.porch, recipientX, base);
  // Warm pool from the doorway along the apron to the berth's near end.
  paint.pool(shape.doorX - 120, base - 2, 190, 16);
  paint.pool(shape.doorX, base, 70, 10, 1.4);

  for (const rock of decor.rocks) paintRock(paint, c, decor.rockShape, rock);
  for (const prop of decor.props) {
    const at = resolvePropPosition(prop, touchLayout, recipientX);
    if (at) paintProp(paint, c, prop.kind, at.x, at.y);
  }
  return { objects: [g, glow], ridge: shape.ridge };
}

function paintPorch(
  paint: Painter, c: Palette, porch: CampaignLandingDecor["porch"], cx: number, base: number,
): PorchShape {
  const { rect, ellipse, halo } = paint;
  const w = porch.width;
  const h = porch.height;
  const left = cx - w / 2;
  const right = cx + w / 2;
  const top = base - h;
  const sill = (): void => {
    rect(left - 14, base + 4, w + 28, 8, c.ink);
    rect(left - 12, base + 4, w + 24, 2, c.rim, 0.7);
  };
  switch (porch.style) {
    case "shed": {
      // Bento workshop: corrugated lean-to with a half-rolled garage door spilling light.
      rect(left - 4, top - 4, w + 8, h + 8, c.ink);
      rect(left, top, w, h, c.wall);
      for (let x = left + 6; x < right - 4; x += 8) rect(x, top + 4, 2, h - 8, c.accent, 0.16);
      rect(left, top, 4, h, c.rim, 0.45);
      for (let x = left - 14; x < right + 14; x += 8) {
        const y = top - 28 + ((x - left + 14) / (w + 28)) * 20;
        rect(x, y - 4, 8, top - y + 8, c.ink);
        rect(x, y - 2, 8, 4, c.accent);
      }
      const dl = left + 12;
      const dw = 78;
      const dh = 90;
      rect(dl - 4, base - dh - 4, dw + 8, dh + 4, c.ink);
      rect(dl, base - dh, dw, dh, c.light, 0.92);
      rect(dl + 8, base - dh + 44, dw - 16, dh - 44, c.plaster, 0.3);
      for (let y = base - dh; y < base - dh + 40; y += 8) {
        rect(dl, y, dw, 6, c.dark);
        rect(dl, y + 6, dw, 2, c.ink);
      }
      rect(dl, base - dh + 40, dw, 4, c.accent);
      halo(dl + dw / 2, base - 26, 62);
      // Hanging work lamp, pegboard of tools, and a little sign on the roof.
      rect(dl + dw / 2 - 1, top - 4, 2, 16, c.ink);
      rect(dl + dw / 2 - 8, top + 12, 16, 6, c.ink);
      rect(dl + dw / 2 - 4, top + 18, 8, 4, c.light);
      halo(dl + dw / 2, top + 22, 30);
      const px = right - 62;
      rect(px, top + 22, 48, 42, c.ink);
      rect(px + 2, top + 24, 44, 38, c.dark);
      for (let i = 0; i < 4; i += 1) rect(px + 6 + i * 10, top + 28, 4, 24 - (i % 2) * 8, c.plaster, 0.8);
      rect(px + 4, top + 56, 40, 4, c.accent);
      rect(cx + 26, top - 30, 2, 14, c.ink);
      rect(cx + 6, top - 46, 46, 16, c.ink);
      rect(cx + 8, top - 44, 42, 12, c.plaster);
      rect(cx + 12, top - 40, 34, 2, c.accent);
      sill();
      return { doorX: dl + dw / 2, ridge: null };
    }
    case "listening-post": {
      // Matcha listening post: stilted tea house, shoji door, tiered eaves, a listening horn and paper lanterns.
      const stilt = 14;
      const body = base - stilt;
      for (const sx of [left + 8, cx - 4, right - 14]) rect(sx, body, 6, stilt + 4, c.ink);
      rect(left - 4, top - 4, w + 8, h - stilt + 8, c.ink);
      rect(left, top, w, h - stilt, c.wall);
      rect(left, top, 4, h - stilt, c.rim, 0.45);
      rect(left - 10, body - 2, w + 20, 6, c.ink);
      rect(left - 8, body - 2, w + 16, 2, c.rim, 0.8);
      const dl = left + 14;
      const dw = 62;
      const dh = 84;
      rect(dl - 4, body - dh - 4, dw + 8, dh + 4, c.ink);
      rect(dl, body - dh, dw, dh, c.light, 0.92);
      for (let x = dl + 14; x < dl + dw; x += 16) rect(x, body - dh, 2, dh, c.ink, 0.7);
      for (let y = body - dh + 18; y < body; y += 20) rect(dl, y, dw, 2, c.ink, 0.7);
      halo(dl + dw / 2, body - dh / 2, 60);
      const wx = right - 40;
      const wy = top + 36;
      ellipse(wx, wy, 20, 18, c.ink);
      ellipse(wx, wy, 14, 12, c.light);
      rect(wx - 1, wy - 12, 2, 24, c.ink, 0.7);
      rect(wx - 14, wy - 1, 28, 2, c.ink, 0.7);
      halo(wx, wy, 36);
      for (let i = 0; i < 9; i += 1) {
        const rw = w + 44 - i * 20;
        const ry = top - 6 - i * 5;
        rect(cx - rw / 2, ry - 2, rw, 7, c.ink);
        rect(cx - rw / 2 + 2, ry - 2, rw - 4, 2, c.accent);
      }
      for (const s of [-1, 1]) {
        const tip = cx + s * (w / 2 + 20);
        rect(tip - 3, top - 14, 6, 8, c.ink);
        rect(tip - 2, top - 18, 4, 4, c.accent);
      }
      const roofTop = top - 6 - 8 * 5;
      rect(cx + 24, roofTop - 24, 4, 26, c.ink);
      ellipse(cx + 36, roofTop - 30, 14, 10, c.ink);
      ellipse(cx + 36, roofTop - 30, 10, 6, c.accent);
      rect(cx + 34, roofTop - 32, 4, 4, c.light);
      halo(cx + 36, roofTop - 30, 18);
      for (const s of [-1, 1]) {
        const lx = cx + s * (w / 2 + 12);
        rect(lx - 1, top - 6, 2, 12, c.ink);
        ellipse(lx, top + 16, 10, 12, c.ink);
        ellipse(lx, top + 16, 8, 10, c.light);
        rect(lx - 8, top + 14, 16, 2, c.accent, 0.6);
        halo(lx, top + 16, 30);
      }
      sill();
      return { doorX: dl + dw / 2, ridge: null };
    }
    case "dome-bakery": {
      // Bakery: a brick oven-dome with a glowing arched mouth, round window and a steaming chimney.
      const rx = w / 2;
      const chx = cx + 34;
      rect(chx - 10, top - 36, 20, 56, c.ink);
      rect(chx - 6, top - 32, 12, 50, c.accent);
      rect(chx - 12, top - 40, 24, 6, c.plaster);
      for (let i = 0; i < 3; i += 1) ellipse(chx + i * 8, top - 56 - i * 16, 14 + i * 6, 7, c.light, 0.12);
      for (let y = 0; y < h; y += 4) {
        const half = snap(rx * Math.sqrt(1 - (y / h) ** 2));
        rect(cx - half - 4, base - y - 4, half * 2 + 8, 4, c.ink);
      }
      for (let y = 0; y < h - 4; y += 4) {
        const half = snap((rx - 4) * Math.sqrt(1 - (y / (h - 4)) ** 2));
        rect(cx - half, base - y - 4, half * 2, 4, c.wall);
        if (y % 16 === 12) rect(cx - half, base - y - 4, half * 2, 2, c.dark, 0.55);
        if (y % 16 === 4) for (let bx = cx - half + ((y / 16) % 2) * 10; bx < cx + half - 2; bx += 20) rect(bx, base - y - 4, 2, 4, c.dark, 0.5);
        rect(cx - half, base - y - 4, 4, 4, c.rim, 0.55);
      }
      const dw = 52;
      const dh = 82;
      const dx = cx - 52;
      rect(dx - dw / 2 - 4, base - dh, dw + 8, dh, c.ink);
      ellipse(dx, base - dh, dw / 2 + 4, 18, c.ink);
      rect(dx - dw / 2, base - dh + 2, dw, dh - 2, c.light);
      ellipse(dx, base - dh + 2, dw / 2, 14, c.light);
      rect(dx - dw / 2 + 8, base - dh + 10, dw - 16, dh - 10, c.plaster, 0.3);
      halo(dx, base - dh / 2, 66);
      ellipse(dx, base - dh - 26, 14, 8, c.ink);
      ellipse(dx, base - dh - 27, 10, 5, c.light);
      rect(dx - 6, base - dh - 30, 2, 4, c.plaster);
      rect(dx + 2, base - dh - 30, 2, 4, c.plaster);
      const wx = cx + 46;
      const wy = base - 70;
      ellipse(wx, wy, 18, 16, c.ink);
      ellipse(wx, wy, 12, 10, c.light);
      rect(wx - 1, wy - 10, 2, 20, c.ink, 0.7);
      halo(wx, wy, 36);
      sill();
      return { doorX: dx, ridge: null };
    }
    case "cottage": {
      // Planet I'm Fine: a small clapboard cottage under a steep roof, dark door, ONE lit window.
      const roofH = 60;
      rect(left - 4, top - 4, w + 8, h + 8, c.ink);
      rect(left, top, w, h, c.wall);
      for (let y = top + 10; y < base; y += 12) rect(left + 2, y, w - 4, 2, c.dark, 0.5);
      rect(left, top, 4, h, c.rim, 0.5);
      const rows = roofH / 4;
      for (let i = 0; i < rows; i += 1) {
        const half = snap((w / 2 + 14) * (1 - i / rows));
        rect(cx - half - 2, top - i * 4 - 4, half * 2 + 4, 6, c.ink);
        rect(cx - half + 2, top - i * 4 - 4, Math.max(0, half * 2 - 4), 2, c.accent, 0.9);
      }
      const chx = cx - 36;
      rect(chx - 8, top - roofH + 14, 16, 34, c.ink);
      rect(chx - 4, top - roofH + 18, 8, 30, c.dark);
      rect(chx - 10, top - roofH + 10, 20, 6, c.plaster, 0.8);
      ellipse(chx - 6, top - roofH - 4, 10, 5, c.plaster, 0.12);
      const dl = left + 14;
      const dw = 40;
      const dh = 72;
      rect(dl - 4, base - dh - 4, dw + 8, dh + 4, c.ink);
      rect(dl, base - dh, dw, dh, c.dark);
      rect(dl + dw - 6, base - dh, 4, dh, c.light, 0.85);
      rect(dl + 6, base - dh / 2, 4, 4, c.light);
      halo(dl + dw - 4, base - dh / 2, 28);
      const wx = right - 34;
      const wy = top + 32;
      rect(wx - 24, wy - 22, 48, 44, c.ink);
      rect(wx - 20, wy - 18, 40, 36, c.light);
      rect(wx - 16, wy - 14, 14, 12, c.plaster, 0.45);
      rect(wx - 1, wy - 18, 2, 36, c.ink);
      rect(wx - 20, wy - 1, 40, 2, c.ink);
      rect(wx - 26, wy + 22, 52, 6, c.accent);
      halo(wx, wy, 64);
      halo(wx, wy, 30);
      rect(right + 4, top - 2, 4, h - 24, c.ink, 0.8);
      rect(right - 2, base - 26, 20, 26, c.ink);
      rect(right, base - 24, 16, 22, c.accent);
      sill();
      return { doorX: dl + dw / 2, ridge: { x: cx, y: top - roofH } };
    }
    case "dock": {
      // Home: the station's dock — riveted bulkhead, warm hangar mouth, portholes and a docking beacon.
      rect(left - 4, top - 4, w + 8, h + 8, c.ink);
      rect(left, top, w, h, c.wall);
      for (let x = left + 34; x < right; x += 34) rect(x, top + 4, 2, h - 8, c.dark, 0.6);
      rect(left, top + 20, w, 2, c.dark, 0.6);
      for (let x = left + 8; x < right - 4; x += 17) rect(x, top + 8, 2, 2, c.rim, 0.6);
      rect(left, top, 4, h, c.rim, 0.45);
      for (let i = 0; i < 5; i += 1) {
        rect(left - 10 + i * 8, top - 8 - i * 4, w + 20 - i * 16, 6, c.ink);
        rect(left - 8 + i * 8, top - 8 - i * 4, w + 16 - i * 16, 2, c.accent);
      }
      rect(cx - 4, top - 42, 8, 20, c.ink);
      ellipse(cx, top - 46, 8, 8, c.ink);
      ellipse(cx, top - 46, 6, 6, c.light);
      halo(cx, top - 46, 40);
      const dw = 92;
      const dh = 96;
      const dx = left + 14 + dw / 2;
      rect(dx - dw / 2 - 6, base - dh, dw + 12, dh, c.ink);
      ellipse(dx, base - dh, dw / 2 + 6, 22, c.ink);
      rect(dx - dw / 2, base - dh + 4, dw, dh - 4, c.light, 0.9);
      ellipse(dx, base - dh + 4, dw / 2, 18, c.light, 0.9);
      rect(dx - dw / 2 + 8, base - 22, 18, 18, c.accent, 0.8);
      rect(dx - dw / 2 + 28, base - 16, 14, 12, c.dark, 0.5);
      rect(dx + dw / 2 - 26, base - 40, 18, 36, c.dark, 0.35);
      for (let x = dx - dw / 2 - 6; x < dx + dw / 2 + 6; x += 12) rect(x, base - 6, 6, 6, c.accent);
      halo(dx, base - dh / 2, 70);
      for (let k = 0; k < 2; k += 1) {
        const ox = right - 52 + k * 28;
        ellipse(ox, top + 30, 10, 10, c.ink);
        ellipse(ox, top + 30, 7, 7, c.light);
        halo(ox, top + 30, 22);
      }
      sill();
      return { doorX: dx, ridge: null };
    }
  }
}

function paintRock(
  paint: Painter, c: Palette, shape: CampaignLandingDecor["rockShape"], rock: { readonly x: number; readonly y: number; readonly size: number },
): void {
  const { rect, ellipse } = paint;
  const { x, y, size } = rock;
  switch (shape) {
    case "shard": {
      // Leaning asteroid shard: stepped rows that narrow and drift right, lit facet on the left.
      ellipse(x, y + 4, size * 0.8, 6, c.ink, 0.3);
      const rows = Math.max(3, Math.round((size * 0.9) / 4));
      for (let k = 0; k < rows; k += 1) {
        const width = Math.max(4, size * (1 - k / rows) + 4);
        const x0 = x - size / 2 + k * 2;
        rect(x0 - 2, y - k * 4 - 4, width + 4, 4, c.ink);
        rect(x0, y - k * 4 - 4, width, 4, c.ground);
        rect(x0, y - k * 4 - 4, 4, 4, c.rim, 0.55);
      }
      rect(x - size / 2 + rows * 2 - 2, y - rows * 4 - 4, 6, 4, c.ink);
      break;
    }
    case "mossy":
      ellipse(x, y + 4, size + 4, 6, c.ink, 0.3);
      ellipse(x, y - size / 3, size * 0.8, size / 2.4, c.ink);
      ellipse(x, y - size / 3, size * 0.8 - 4, size / 2.4 - 4, c.ground);
      ellipse(x - 2, y - size / 2, size * 0.6, size / 5, c.accent);
      for (let i = 0; i < 3; i += 1) rect(x - size / 2 + i * 10, y - size / 2 - 6 - (i % 2) * 2, 2, 4 + (i % 2) * 2, c.rim, 0.8);
      break;
    case "crumb":
      // Crusty bread-like lumps with a toasted top line.
      ellipse(x, y + 4, size + 6, 6, c.ink, 0.3);
      ellipse(x - size / 3, y - size / 4, size / 2, size / 3, c.ink);
      ellipse(x + size / 3, y - size / 5, size / 2.4, size / 3.4, c.ink);
      ellipse(x - size / 3, y - size / 4, size / 2 - 3, size / 3 - 3, c.wall);
      ellipse(x + size / 3, y - size / 5, size / 2.4 - 3, size / 3.4 - 3, c.wall);
      rect(x - size / 2 - 2, y - size / 4 - size / 3 + 4, size / 2, 2, c.rim, 0.6);
      break;
    case "boulder":
      ellipse(x, y + 4, size + 6, 8, c.ink, 0.3);
      ellipse(x, y - size / 3, size, size / 2.2, c.ink);
      ellipse(x - 2, y - size / 3 - 2, size - 4, size / 2.2 - 4, c.ground);
      rect(x + size / 4, y - size / 2, 2, size / 3, c.ink, 0.6);
      rect(x - size / 2, y - size * 0.6, size / 3, 2, c.rim, 0.6);
      rect(x - size / 2 + 4, y - size * 0.6 + 4, 4, 2, c.plaster, 0.4);
      break;
    case "pebbles":
      for (let k = 0; k < 3; k += 1) {
        const px = x + (k - 1) * size * 0.9;
        const py = y - (k % 2) * 4;
        ellipse(px, py, size / 2 + k * 2, size / 3, c.ink);
        ellipse(px, py - 1, size / 2 + k * 2 - 2, size / 3 - 2, c.wall);
        rect(px - 4, py - size / 3 + 2, 4, 2, c.rim, 0.5);
      }
      break;
  }
}

function paintProp(paint: Painter, c: Palette, kind: LandingDecorProp["kind"], x: number, y: number): void {
  const { rect, ellipse, halo, pool } = paint;
  const { ink, light, accent, ground, plaster } = c;
  switch (kind) {
    case "crate":
      rect(x - 32, y - 48, 64, 48, ink); rect(x - 28, y - 44, 56, 40, accent);
      rect(x - 28, y - 28, 56, 4, ground); rect(x - 4, y - 44, 8, 40, ground);
      rect(x - 22, y - 40, 16, 6, plaster); rect(x + 10, y - 18, 12, 6, light);
      rect(x - 34, y - 52, 68, 6, plaster); break;
    case "bolts":
      for (let i = 0; i < 4; i += 1) { rect(x + i * 12, y - (i % 2) * 4, 8, 8, ink); rect(x + i * 12 + 2, y + 2 - (i % 2) * 4, 4, 4, plaster); } break;
    case "chair":
      rect(x - 18, y - 68, 8, 68, ink); rect(x + 16, y - 30, 6, 30, ink);
      rect(x - 16, y - 64, 34, 22, accent); rect(x - 18, y - 32, 44, 8, light); break;
    case "lamp":
      pool(x, y + 4, 46, 8); rect(x - 4, y - 92, 8, 92, ink);
      rect(x - 16, y - 102, 32, 26, ink); rect(x - 12, y - 98, 24, 18, light);
      rect(x - 18, y - 106, 36, 6, accent); rect(x - 16, y - 4, 32, 6, ink);
      halo(x, y - 89, 40); break;
    case "lantern":
      pool(x + 18, y + 2, 56, 12, 2); rect(x - 4, y - 132, 6, 132, ink); rect(x - 6, y - 132, 36, 4, accent);
      rect(x + 20, y - 128, 2, 16, plaster); ellipse(x + 22, y - 92, 18, 24, light);
      for (let ox = -10; ox <= 10; ox += 10) rect(x + 22 + ox, y - 112, 2, 40, accent, 0.8);
      rect(x + 8, y - 118, 28, 6, ink); rect(x + 10, y - 70, 24, 4, ink);
      halo(x + 22, y - 92, 46); break;
    case "bush":
      rect(x - 44, y - 4, 88, 8, ink);
      for (let i = 0; i < 4; i += 1) { ellipse(x - 30 + i * 20, y - 18 - (i % 2) * 8, 24, 20, ground); ellipse(x - 32 + i * 20, y - 26 - (i % 2) * 8, 20, 12, accent); rect(x - 40 + i * 20, y - 30 - (i % 2) * 8, 12, 2, light, 0.5); } break;
    case "mist":
      for (let i = 0; i < 3; i += 1) { ellipse(x + i * 24, y - i * 8, 68 - i * 12, 8, plaster, 0.08); rect(x + 16 + i * 24, y - 18 - i * 8, 28, 2, light, 0.16); } break;
    case "chimney":
      rect(x - 18, y - 100, 36, 100, ink); rect(x - 14, y - 96, 28, 94, accent);
      for (let i = 0; i < 7; i += 1) rect(x - 12, y - 86 + i * 12, 24, 2, ground);
      rect(x - 22, y - 104, 44, 8, plaster);
      for (let i = 0; i < 3; i += 1) ellipse(x + i * 8, y - 122 - i * 18, 18 + i * 6, 8, light, 0.12); break;
    case "bread-rack":
      rect(x - 38, y - 110, 8, 110, ink); rect(x + 30, y - 110, 8, 110, ink);
      for (let shelf = 0; shelf < 3; shelf += 1) { const sy = y - 12 - shelf * 32; rect(x - 38, sy, 76, 6, accent); for (let loaf = 0; loaf < 3; loaf += 1) { ellipse(x - 22 + loaf * 22, sy - 10, 10, 8, light); rect(x - 26 + loaf * 22, sy - 14, 2, 6, plaster); } } break;
    case "oven":
      pool(x, y + 6, 64, 10); rect(x - 38, y - 82, 76, 82, ink); rect(x - 34, y - 78, 68, 74, accent);
      ellipse(x, y - 38, 26, 28, ink); ellipse(x, y - 36, 20, 22, light); rect(x - 22, y - 12, 44, 10, ink);
      for (let i = 0; i < 3; i += 1) rect(x - 14 + i * 12, y - 28 - (i % 2) * 8, 6, 16, plaster, 0.7);
      halo(x, y - 36, 50); break;
    case "puddle":
      ellipse(x, y, 74, 10, ink, 0.7); ellipse(x, y - 2, 66, 6, accent, 0.6);
      rect(x - 44, y - 4, 40, 2, light, 0.5); rect(x + 8, y, 26, 2, plaster, 0.35); break;
    case "bunting":
      for (let i = 0; i < 12; i += 1) { const by = y + Math.round(Math.sin(i / 11 * Math.PI) * 12 / 2) * 2; rect(x + i * 20, by, 20, 2, plaster, 0.8); for (let r = 0; r < 7; r += 1) rect(x + i * 20 + r, by + 2 + r * 2, 14 - r * 2, 2, i % 2 === 0 ? accent : light); } break;
    case "mailbox":
      rect(x - 4, y - 54, 8, 54, ink); rect(x - 24, y - 82, 48, 30, ink);
      rect(x - 20, y - 78, 40, 22, accent); rect(x - 12, y - 70, 24, 4, ink);
      rect(x + 18, y - 96, 4, 36, plaster); rect(x + 22, y - 96, 14, 10, light); break;
  }
}
