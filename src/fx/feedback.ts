import Phaser from "phaser";
import { colors, depth as depthBands } from "../game/designTokens";
import {
  allowedBurstCount,
  emissionStep,
  exhaustAngleDegrees,
  inRange,
  nozzlePoint,
  thrustRate,
  type EmissionStep,
  type MutablePoint,
} from "./fxMath";
import {
  BURST_TUNING,
  FLASH_TUNING,
  FX_BUDGET,
  PARTICLE_SHEETS,
  SHAKE_TUNING,
  STEAM_TUNING,
  THRUST_TUNING,
  type BurstKind,
} from "./fxPresets";
import { particleAnimKey, particleTextureKey } from "./fxTextures";

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

type Emitter = Phaser.GameObjects.Particles.ParticleEmitter;

// ---------------------------------------------------------------------------------------------
// Reduced motion
// ---------------------------------------------------------------------------------------------

let reducedMotionOverride: boolean | null = null;

/**
 * Scenes/settings call this with `save.settings.reducedMotion` (see `installFxSettings`).
 * `null` clears the explicit setting and follows the OS preference again.
 */
export function setReducedMotion(value: boolean | null): void {
  reducedMotionOverride = value;
}

/** Explicit setting wins; otherwise follows the OS `prefers-reduced-motion` preference. */
export function isReducedMotion(): boolean {
  if (reducedMotionOverride !== null) return reducedMotionOverride;
  try {
    return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  } catch {
    return false;
  }
}

function reducedFactor(): number | null {
  return isReducedMotion() ? FX_BUDGET.reducedMotionFactor : null;
}

// ---------------------------------------------------------------------------------------------
// Per-scene emitter registry (budget + reuse)
// ---------------------------------------------------------------------------------------------

type SceneFx = {
  readonly bursts: Map<string, Emitter>;
  readonly tracked: Set<Emitter>;
};

const sceneFx = new WeakMap<Phaser.Scene, SceneFx>();

function fxFor(scene: Phaser.Scene): SceneFx {
  let fx = sceneFx.get(scene);
  if (!fx) {
    const created: SceneFx = { bursts: new Map(), tracked: new Set() };
    fx = created;
    sceneFx.set(scene, created);
    const forget = (): void => {
      created.bursts.clear();
      created.tracked.clear();
      sceneFx.delete(scene);
    };
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, forget);
    scene.events.once(Phaser.Scenes.Events.DESTROY, forget);
  }
  return fx;
}

function track(scene: Phaser.Scene, emitter: Emitter): void {
  const fx = fxFor(scene);
  fx.tracked.add(emitter);
  emitter.once(Phaser.GameObjects.Events.DESTROY, () => fx.tracked.delete(emitter));
}

/** Live particles across every fx emitter in the scene. */
export function liveParticleCount(scene: Phaser.Scene): number {
  const fx = sceneFx.get(scene);
  if (!fx) return 0;
  let alive = 0;
  for (const emitter of fx.tracked) alive += emitter.getAliveParticleCount();
  return alive;
}

function roomInBudget(scene: Phaser.Scene): number {
  return Math.max(0, FX_BUDGET.maxLiveParticlesPerScene - liveParticleCount(scene));
}

// ---------------------------------------------------------------------------------------------
// Camera feedback
// ---------------------------------------------------------------------------------------------

export function shakeCamera(scene: Phaser.Scene, strength: ShakeStrength): void {
  if (isReducedMotion()) return;
  try {
    const tuning = SHAKE_TUNING[strength];
    scene.cameras.main.shake(tuning.durationMs, tuning.intensity);
  } catch {
    // camera unavailable during shutdown
  }
}

/** Brief white-warm screen flash for big moments (skipped under reduced motion). */
export function flashScreen(scene: Phaser.Scene, color: string = colors.plaster, durationMs: number = FLASH_TUNING.defaultDurationMs): void {
  if (isReducedMotion()) return;
  try {
    const rgb = Phaser.Display.Color.HexStringToColor(color);
    scene.cameras.main.flash(durationMs, rgb.red, rgb.green, rgb.blue);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------------------------
// Thrust trail
// ---------------------------------------------------------------------------------------------

export function createThrustTrail(scene: Phaser.Scene, options: { readonly depth?: number; readonly offset?: number } = {}): ThrustTrail {
  const tuning = THRUST_TUNING;
  const sheet = PARTICLE_SHEETS.thrust;
  const offset = options.offset ?? tuning.defaultOffset;
  let emitter: Emitter | null = null;

  try {
    const textureKey = particleTextureKey(scene, "thrust");
    const anim = particleAnimKey(scene, textureKey, sheet.frameCount, tuning.animMs, false);
    emitter = scene.add.particles(0, 0, textureKey, {
      emitting: false,
      anim,
      lifespan: { min: tuning.lifespanMs.min, max: tuning.lifespanMs.max },
      speed: 0,
      scale: sheet.artScale,
      alpha: { start: tuning.alpha.start, end: tuning.alpha.end, ease: "Cubic.easeIn" },
      color: [...tuning.color],
      colorEase: "Linear",
      maxAliveParticles: FX_BUDGET.thrustMaxAlive,
    });
    emitter.setDepth(options.depth ?? depthBands.shipFx);
    track(scene, emitter);
  } catch {
    emitter = null;
  }

  const nozzle: MutablePoint = { x: 0, y: 0 };
  const previous: MutablePoint = { x: 0, y: 0 };
  const step: EmissionStep = { count: 0, carry: 0 };
  let carry = 0;
  let wasActive = false;

  return {
    update(x, y, rotation, active, intensity) {
      if (!emitter || !emitter.active) return;
      nozzlePoint(x, y, rotation, offset, nozzle);
      if (!active) {
        wasActive = false;
        carry = 0;
        return;
      }
      if (!wasActive) {
        previous.x = nozzle.x;
        previous.y = nozzle.y;
        // Kick off with one puff so a tap of thrust still reads.
        carry = 1;
        wasActive = true;
      }

      const factor = reducedFactor() ?? 1;
      const rate = thrustRate(intensity, tuning.ratePerSecond, tuning.minRateFactor) * factor;
      emissionStep(carry, scene.game.loop.delta, rate, step);
      carry = step.carry;
      const count = Math.min(step.count, roomInBudget(scene));
      if (count > 0) {
        const baseAngle = exhaustAngleDegrees(rotation);
        const spriteAngle = Phaser.Math.RadToDeg(rotation);
        const clampedIntensity = Number.isFinite(intensity) ? Math.min(1, Math.max(0, intensity)) : 0;
        const perpX = Math.cos(rotation);
        const perpY = Math.sin(rotation);
        for (let i = 0; i < count; i += 1) {
          // Spread spawns along the nozzle's path this frame so fast turns stay continuous.
          const along = (i + 1) / count;
          const jitter = (Math.random() * 2 - 1) * tuning.nozzleJitter;
          const px = previous.x + (nozzle.x - previous.x) * along + perpX * jitter;
          const py = previous.y + (nozzle.y - previous.y) * along + perpY * jitter;
          const particle = emitter.emitParticleAt(px, py, 1);
          if (!particle) break;
          const angle = Phaser.Math.DegToRad(baseAngle + (Math.random() * 2 - 1) * tuning.spreadDegrees);
          const speed = inRange(tuning.speed, Math.random()) + tuning.intensitySpeed * clampedIntensity;
          const lifeSeconds = particle.life / 1000;
          particle.velocityX = Math.cos(angle) * speed;
          particle.velocityY = Math.sin(angle) * speed;
          particle.accelerationX = lifeSeconds > 0 ? (-particle.velocityX * tuning.drag) / lifeSeconds : 0;
          particle.accelerationY = lifeSeconds > 0 ? (-particle.velocityY * tuning.drag) / lifeSeconds : 0;
          particle.angle = spriteAngle;
          particle.rotation = rotation;
        }
      }
      previous.x = nozzle.x;
      previous.y = nozzle.y;
    },
    setDepth(value) {
      emitter?.setDepth(value);
    },
    destroy() {
      emitter?.destroy();
      emitter = null;
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Bursts
// ---------------------------------------------------------------------------------------------

const DEFAULT_SPREAD = 80;

const BURST_ANGLES: Readonly<Record<BurstKind, { readonly min: number; readonly max: number }>> = {
  dust: { min: 0, max: 360 },
  sparkle: { min: 200, max: 340 },
  incidentFlour: { min: 0, max: 360 },
  incidentConfetti: { min: 215, max: 325 },
  star: { min: 0, max: 360 },
};

function burstEmitter(scene: Phaser.Scene, kind: BurstKind, layer: number): Emitter | null {
  const fx = fxFor(scene);
  const id = `${kind}@${layer}`;
  const existing = fx.bursts.get(id);
  if (existing && existing.active) return existing;

  const tuning = BURST_TUNING[kind];
  const sheet = PARTICLE_SHEETS[tuning.sheet];
  const textureKey = particleTextureKey(scene, tuning.sheet);
  const anim = particleAnimKey(scene, textureKey, sheet.frameCount, tuning.anim.durationMs, tuning.anim.loop);
  const emitter = scene.add.particles(0, 0, textureKey, {
    emitting: false,
    // Looping twinkles start on a random frame so one burst never blinks in lockstep.
    anim: tuning.anim.loop ? { anims: [{ key: anim, randomFrame: true }] } : anim,
    lifespan: { min: tuning.lifespanMs.min, max: tuning.lifespanMs.max },
    speed: { min: tuning.speed.min, max: tuning.speed.max },
    angle: BURST_ANGLES[kind],
    gravityY: tuning.gravityY,
    scale: sheet.artScale,
    // The art already fades in its last frames, so hold opacity and only drop it late.
    alpha: { start: tuning.alpha.start, end: tuning.alpha.end, ease: "Cubic.easeIn" },
    tint: [...tuning.tints],
    maxAliveParticles: FX_BUDGET.burstMaxCount * 2,
  });
  emitter.setDepth(layer);
  fx.bursts.set(id, emitter);
  track(scene, emitter);
  return emitter;
}

function burst(scene: Phaser.Scene, kind: BurstKind, x: number, y: number, options: BurstOptions): void {
  try {
    const tuning = BURST_TUNING[kind];
    const count = allowedBurstCount(options.count ?? tuning.count, liveParticleCount(scene), FX_BUDGET.maxLiveParticlesPerScene, FX_BUDGET.burstMaxCount, reducedFactor());
    if (count <= 0 || !Number.isFinite(x) || !Number.isFinite(y)) return;
    const emitter = burstEmitter(scene, kind, options.depth ?? depthBands.worldFx);
    if (!emitter) return;
    const scale = Math.max(0.2, (options.spread ?? DEFAULT_SPREAD) / DEFAULT_SPREAD);
    emitter.speed = { min: tuning.speed.min * scale, max: tuning.speed.max * scale };
    emitter.setParticleTint(options.tint !== undefined ? options.tint : [...tuning.tints]);
    // Emit one by one so each particle gets an upward lift: bursts bloom instead of spraying flat.
    const lift = tuning.lift * scale;
    for (let i = 0; i < count; i += 1) {
      const particle = emitter.emitParticleAt(x, y, 1);
      if (!particle) break;
      particle.velocityY -= lift * (0.6 + Math.random() * 0.4);
    }
  } catch {
    // Feedback is optional.
  }
}

export function burstDust(scene: Phaser.Scene, x: number, y: number, options: BurstOptions = {}): void {
  burst(scene, "dust", x, y, options);
}

export function burstSparkles(scene: Phaser.Scene, x: number, y: number, options: BurstOptions = {}): void {
  burst(scene, "sparkle", x, y, options);
}

/** Comedic gyoza mishap: a flour poof plus a little confetti of fillings. */
export function burstIncident(scene: Phaser.Scene, x: number, y: number, options: BurstOptions = {}): void {
  const flourCount = options.count !== undefined ? Math.ceil(options.count * 0.45) : undefined;
  const confettiCount = options.count !== undefined ? Math.max(1, options.count - (flourCount ?? 0)) : undefined;
  burst(scene, "incidentFlour", x, y, { ...options, count: flourCount, tint: undefined, spread: (options.spread ?? 110) * 0.8 });
  burst(scene, "incidentConfetti", x, y, { ...options, count: confettiCount, spread: options.spread ?? 110 });
}

/** Twinkling stars (arrival, delivery celebration). */
export function burstStars(scene: Phaser.Scene, x: number, y: number, options: BurstOptions = {}): void {
  burst(scene, "star", x, y, options);
}

// ---------------------------------------------------------------------------------------------
// Steam
// ---------------------------------------------------------------------------------------------

/** Rising steam wisps (tea, landing vents). Returns a stop function. */
export function createSteam(scene: Phaser.Scene, x: number, y: number, options: { readonly depth?: number } = {}): () => void {
  const tuning = STEAM_TUNING;
  const sheet = PARTICLE_SHEETS.steam;
  try {
    const textureKey = particleTextureKey(scene, "steam");
    const anim = particleAnimKey(scene, textureKey, sheet.frameCount, tuning.animMs, false);
    const reduced = isReducedMotion();
    const emitter = scene.add.particles(x, y, textureKey, {
      anim,
      frequency: reduced ? tuning.intervalMs * 2 : tuning.intervalMs,
      quantity: 1,
      // Pre-warm so a teapot is already steaming when the scene opens.
      advance: tuning.lifespanMs.max,
      lifespan: { min: tuning.lifespanMs.min, max: tuning.lifespanMs.max },
      speedX: { min: tuning.sway.min, max: tuning.sway.max },
      speedY: { min: -tuning.riseSpeed.max, max: -tuning.riseSpeed.min },
      radial: false,
      scale: sheet.artScale,
      alpha: { start: tuning.alpha.start, end: tuning.alpha.end, ease: "Sine.easeIn" },
      tint: [...tuning.tints],
      maxAliveParticles: FX_BUDGET.steamMaxAlivePerSource,
    });
    emitter.setDepth(options.depth ?? depthBands.worldFx);
    track(scene, emitter);
    let stopped = false;
    return () => {
      if (stopped || !emitter.active) return;
      stopped = true;
      emitter.stop();
      scene.time.delayedCall(tuning.lifespanMs.max + 50, () => emitter.destroy());
    };
  } catch {
    return () => undefined;
  }
}

// ---------------------------------------------------------------------------------------------
// Tween recipes
// ---------------------------------------------------------------------------------------------

type Scalable = Phaser.GameObjects.GameObject & { scaleX: number; scaleY: number };

/**
 * Tactile squash-and-stretch on landing/bumps. Restores the original scale afterwards, so it is
 * safe on gameplay-scaled sprites. Reduced motion skips it.
 */
export function squash(scene: Phaser.Scene, target: Scalable, amount = 0.12, durationMs = 220): void {
  if (isReducedMotion()) return;
  const baseX = target.scaleX;
  const baseY = target.scaleY;
  scene.tweens.add({
    targets: target,
    scaleX: baseX * (1 + amount),
    scaleY: baseY * (1 - amount),
    duration: durationMs / 2,
    ease: "Quad.easeOut",
    yoyo: true,
    onComplete: () => {
      target.scaleX = baseX;
      target.scaleY = baseY;
    },
  });
}
