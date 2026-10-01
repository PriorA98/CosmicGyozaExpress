import Phaser from "phaser";
import { colorNumber, colors, depth as depthBands } from "../game/designTokens";

/**
 * Shared visual feedback API (owner: audio-fx package). Scenes and entities call these;
 * signatures are a contract — internals may change freely. All helpers must:
 * - respect reduced motion (`isReducedMotion`) for shakes/flashes,
 * - cap live particles (≤ 300 per scene),
 * - never throw if a texture is missing.
 */
export type ShakeStrength = "soft" | "medium" | "strong";

export type BurstOptions = {
  readonly count?: number;
  readonly spread?: number;
  readonly tint?: number;
  readonly depth?: number;
};

export type ThrustTrail = {
  /** Call every frame. `rotation` uses ship convention (0 = nose up); exhaust leaves the bottom. */
  update(x: number, y: number, rotation: number, active: boolean, intensity: number): void;
  setDepth(value: number): void;
  destroy(): void;
};

let reducedMotion = false;

export function setReducedMotion(value: boolean): void {
  reducedMotion = value;
}

export function isReducedMotion(): boolean {
  return reducedMotion;
}

export function shakeCamera(scene: Phaser.Scene, strength: ShakeStrength): void {
  if (reducedMotion) return;
  const intensity = strength === "soft" ? 0.002 : strength === "medium" ? 0.005 : 0.009;
  const duration = strength === "soft" ? 90 : strength === "medium" ? 160 : 240;
  scene.cameras.main.shake(duration, intensity);
}

export function createThrustTrail(scene: Phaser.Scene, options: { readonly depth?: number; readonly offset?: number } = {}): ThrustTrail {
  const offset = options.offset ?? 40;
  let layer = options.depth ?? depthBands.shipFx;
  let lastSpawn = 0;

  return {
    update(x, y, rotation, active, intensity) {
      if (!active) return;
      const now = scene.time.now;
      if (now - lastSpawn < 40) return;
      lastSpawn = now;
      const bx = x - Math.sin(rotation) * offset;
      const by = y + Math.cos(rotation) * offset;
      const puff = scene.add
        .circle(bx, by, 3 + intensity * 3, colorNumber(colors.ember), 0.8)
        .setDepth(layer)
        .setScrollFactor(1);
      scene.tweens.add({
        targets: puff,
        x: bx - Math.sin(rotation) * 26,
        y: by + Math.cos(rotation) * 26,
        alpha: 0,
        scale: 0.3,
        duration: 260,
        onComplete: () => puff.destroy(),
      });
    },
    setDepth(value) {
      layer = value;
    },
    destroy() {
      // stub keeps no persistent objects
    },
  };
}

function burst(scene: Phaser.Scene, x: number, y: number, palette: readonly string[], options: BurstOptions): void {
  const count = Math.min(options.count ?? 14, 40);
  const spread = options.spread ?? 80;
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    const tint = options.tint ?? colorNumber(palette[i % palette.length] ?? colors.plaster);
    const dot = scene.add.circle(x, y, 3, tint, 0.85).setDepth(options.depth ?? depthBands.worldFx);
    scene.tweens.add({
      targets: dot,
      x: x + Math.cos(angle) * spread,
      y: y + Math.sin(angle) * spread,
      alpha: 0,
      duration: 480,
      ease: "Quad.easeOut",
      onComplete: () => dot.destroy(),
    });
  }
}

export function burstDust(scene: Phaser.Scene, x: number, y: number, options: BurstOptions = {}): void {
  burst(scene, x, y, [colors.parchment, colors.parchmentDeep, colors.duskBlue], options);
}

export function burstSparkles(scene: Phaser.Scene, x: number, y: number, options: BurstOptions = {}): void {
  burst(scene, x, y, [colors.amber, colors.plaster, colors.ember], options);
}

export function burstIncident(scene: Phaser.Scene, x: number, y: number, options: BurstOptions = {}): void {
  burst(scene, x, y, [colors.ember, colors.plaster, colors.sage, colors.terracotta], { count: 18, spread: 110, ...options });
}

/** Rising steam wisps (tea, landing vents). Returns a stop function. */
export function createSteam(scene: Phaser.Scene, x: number, y: number, options: { readonly depth?: number } = {}): () => void {
  const timer = scene.time.addEvent({
    delay: 380,
    loop: true,
    callback: () => {
      const wisp = scene.add.circle(x, y, 3, colorNumber(colors.plaster), 0.5).setDepth(options.depth ?? depthBands.worldFx);
      scene.tweens.add({ targets: wisp, y: y - 30, alpha: 0, duration: 1200, onComplete: () => wisp.destroy() });
    },
  });
  return () => timer.remove();
}

/** Brief white-warm screen flash for big moments (skipped under reduced motion). */
export function flashScreen(scene: Phaser.Scene, color: string = colors.plaster, durationMs = 160): void {
  if (reducedMotion) return;
  const rgb = Phaser.Display.Color.HexStringToColor(color);
  scene.cameras.main.flash(durationMs, rgb.red, rgb.green, rgb.blue);
}
