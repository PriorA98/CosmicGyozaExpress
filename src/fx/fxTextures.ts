import Phaser from "phaser";
import { colors } from "../game/designTokens";
import { PARTICLE_SHEETS, type ParticleSheet, type ParticleSheetId } from "./fxPresets";

/**
 * Resolves particle textures and their life animations.
 *
 * Particle art is loaded from the asset manifest keys. While a sheet is still missing,
 * PreloadScene installs a flat same-size fallback; reading a flat block as a particle is
 * unhelpful for tuning, so this module paints a small procedural pixel stand-in under a
 * private key instead. Asset failures are still recorded by PreloadScene, and the real
 * art is used automatically as soon as the file exists.
 */

const SUBSTITUTE_SUFFIX = "~fx-substitute";

function isFallbackTexture(texture: Phaser.Textures.Texture): boolean {
  if (texture.key === "__MISSING") return true;
  const source = texture.source[0];
  return source ? source.isCanvas : true;
}

export function particleTextureKey(scene: Phaser.Scene, id: ParticleSheetId): string {
  const sheet = PARTICLE_SHEETS[id];
  const textures = scene.textures;
  if (textures.exists(sheet.key) && !isFallbackTexture(textures.get(sheet.key))) return sheet.key;
  const substituteKey = `${sheet.key}${SUBSTITUTE_SUFFIX}`;
  if (!textures.exists(substituteKey)) paintSubstitute(scene, id, sheet, substituteKey);
  return textures.exists(substituteKey) ? substituteKey : sheet.key;
}

/** Creates (once per game) an animation over every frame of a particle sheet. */
export function particleAnimKey(scene: Phaser.Scene, textureKey: string, frameCount: number, durationMs: number, loop: boolean): string {
  const key = `${textureKey}:life:${durationMs}:${loop ? "loop" : "once"}`;
  if (scene.anims.exists(key)) return key;
  const frames: Phaser.Types.Animations.AnimationFrame[] = [];
  for (let frame = 0; frame < frameCount; frame += 1) frames.push({ key: textureKey, frame });
  scene.anims.create({ key, frames, duration: durationMs, repeat: loop ? -1 : 0 });
  return key;
}

// ---------------------------------------------------------------------------------------------
// Procedural stand-ins (art pixels; displayed at artScale like the real sheets)
// ---------------------------------------------------------------------------------------------

type Painter = {
  disc(cx: number, cy: number, r: number, color: string, alpha?: number): void;
  px(x: number, y: number, color: string, alpha?: number): void;
};

function makePainter(ctx: CanvasRenderingContext2D, ox: number, w: number, h: number): Painter {
  const px = (x: number, y: number, color: string, alpha = 1): void => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(ox + Math.floor(x), Math.floor(y), 1, 1);
  };
  const disc = (cx: number, cy: number, r: number, color: string, alpha = 1): void => {
    const r2 = r * r;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y += 1) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x += 1) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        if (dx * dx + dy * dy <= r2) px(x, y, color, alpha);
      }
    }
  };
  return { disc, px };
}

function paintThrust(p: Painter, frame: number): void {
  // 0-2 flame tongue, 3-5 warm puff, 6-7 cooling smoke.
  if (frame <= 2) {
    const tail = 7 - frame * 2;
    p.disc(8, 8, 5 - frame * 0.5, colors.ember);
    for (let i = 0; i < tail; i += 1) p.disc(8, 11 + i, Math.max(1, 3.5 - i * 0.55), colors.ember);
    p.disc(8, 8, 3.2 - frame * 0.4, colors.amber);
    p.disc(8, 10, 2 - frame * 0.3, colors.amber);
    p.disc(8, 7.5, 1.6, colors.plaster);
    return;
  }
  if (frame <= 5) {
    const r = 5.5 + (frame - 3) * 0.6;
    p.disc(8, 12, r, frame === 3 ? colors.ember : colors.terracotta);
    p.disc(7, 11, r - 1.8, frame === 5 ? colors.parchmentDeep : colors.amber);
    p.disc(6, 10, 1.5, colors.plaster, 0.9);
    return;
  }
  const r = frame === 6 ? 5 : 3.5;
  p.disc(8, 13, r, colors.borderStrong, 0.85);
  p.disc(7, 12, r - 1.4, colors.wallpaper, 0.9);
}

function paintDust(p: Painter, frame: number): void {
  const grow = frame * 0.8;
  const fade = frame >= 4 ? 0.7 : 1;
  p.disc(8 - grow * 0.6, 9, 3 + grow * 0.5, colors.borderStrong, fade);
  p.disc(8 + grow * 0.7, 9.5, 2.5 + grow * 0.4, colors.borderStrong, fade);
  p.disc(8, 8, 3.2 + grow * 0.45, colors.parchmentDeep, fade);
  if (frame < 5) p.disc(7, 7, 1.5 + grow * 0.2, colors.plaster, fade);
}

function paintSparkle(p: Painter, frame: number): void {
  const arm = [1, 2, 3, 2][frame] ?? 1;
  for (let i = -arm; i <= arm; i += 1) {
    p.px(4 + i, 4, colors.plaster);
    p.px(4, 4 + i, colors.plaster);
  }
  p.px(3, 3, colors.plaster);
  p.px(4, 3, colors.plaster);
  p.px(3, 4, colors.plaster);
  if (frame === 2) {
    p.px(2, 2, colors.plaster, 0.6);
    p.px(6, 6, colors.plaster, 0.6);
    p.px(6, 2, colors.plaster, 0.6);
    p.px(2, 6, colors.plaster, 0.6);
  }
}

function paintSteam(p: Painter, frame: number): void {
  const rise = frame * 1.6;
  const sway = Math.sin(frame * 1.2) * 1.5;
  const alpha = 0.95 - frame * 0.1;
  p.disc(6 + sway * 0.4, 16 - rise, 2.6 + frame * 0.25, colors.plaster, alpha);
  p.disc(6 - sway, 12 - rise, 2 + frame * 0.2, colors.plaster, alpha * 0.85);
  p.disc(6 + sway, 8.5 - rise * 0.6, 1.4 + frame * 0.15, colors.plaster, alpha * 0.7);
}

function paintStar(p: Painter, frame: number): void {
  p.px(2, 2, colors.plaster);
  if (frame >= 1) {
    p.px(1, 2, colors.plaster);
    p.px(3, 2, colors.plaster);
    p.px(2, 1, colors.plaster);
    p.px(2, 3, colors.plaster);
  }
  if (frame === 2) {
    p.px(0, 2, colors.plaster, 0.7);
    p.px(4, 2, colors.plaster, 0.7);
    p.px(2, 0, colors.plaster, 0.7);
    p.px(2, 4, colors.plaster, 0.7);
  }
}

const PAINTERS: Readonly<Record<ParticleSheetId, (p: Painter, frame: number) => void>> = {
  thrust: paintThrust,
  dust: paintDust,
  sparkle: paintSparkle,
  steam: paintSteam,
  star: paintStar,
};

function paintSubstitute(scene: Phaser.Scene, id: ParticleSheetId, sheet: ParticleSheet, key: string): void {
  try {
    const width = sheet.frameWidth * sheet.frameCount;
    const texture = scene.textures.createCanvas(key, width, sheet.frameHeight);
    if (!texture) return;
    const ctx = texture.getContext();
    ctx.clearRect(0, 0, width, sheet.frameHeight);
    for (let frame = 0; frame < sheet.frameCount; frame += 1) {
      const ox = frame * sheet.frameWidth;
      PAINTERS[id](makePainter(ctx, ox, sheet.frameWidth, sheet.frameHeight), frame);
      texture.add(frame, 0, ox, 0, sheet.frameWidth, sheet.frameHeight);
    }
    ctx.globalAlpha = 1;
    texture.refresh();
  } catch {
    // Keep the flat fallback.
  }
}
