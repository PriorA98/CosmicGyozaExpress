import Phaser from "phaser";
import { colorNumber, depth as depthBands } from "../game/designTokens";
import {
  allowedBurstCount,
  emissionStep,
  exhaustAngleDegrees,
  flashAlphaAt,
  inRange,
  nozzlePoint,
  shakeOffset,
  steppedFadeAlpha,
  thrustRate,
  type EmissionStep,
  type MutablePoint,
} from "./fxMath";
import {
  BURST_TUNING,
  FLASH_TUNING,
  FX_BUDGET,
  PARTICLE_SHEETS,
  PIXEL_FLAME_TUNING,
  SHAKE_TUNING,
  STEAM_TUNING,
  THRUST_TUNING,
  type BurstKind,
  type SteppedFade,
} from "./fxPresets";
import { particleAnimKey, particleTextureKey, pixelGlowTextureKey } from "./fxTextures";

/**
 * Shared visual feedback API (owner: audio-fx package). Scenes and entities call these;
 * signatures are a contract — internals may change freely. All helpers must:
 * - respect reduced motion (`isReducedMotion`) for shakes/flashes,
 * - cap live particles (≤ 300 per scene),
 * - render pixel art at its integer artScale (no random or fractional particle scales),
 * - never throw if a texture is missing.
 */
export type ShakeStrength = "soft" | "medium" | "strong";

export type BurstOptions = {
  readonly count?: number;
  readonly spread?: number;
  readonly tint?: number;
  readonly depth?: number;
  /** Caps each particle's life (ms), e.g. so a reveal burst is gone before the reveal settles. */
  readonly lifespanMs?: number;
  /** Spawn on a ring of this radius (px) around (x, y), flying outward: a halo around an object. */
  readonly spawnRadius?: number;
};

export type ShakeOptions = {
  /** Camera to shake (default: the scene's main camera). */
  readonly camera?: Phaser.Cameras.Scene2D.Camera;
};

export type ThrustTrail = {
  /** Call every frame. `rotation` uses ship convention (0 = nose up); exhaust leaves the bottom. */
  update(x: number, y: number, rotation: number, active: boolean, intensity: number): void;
  setDepth(value: number): void;
  /** Removes every puff already in flight (e.g. at touchdown) without destroying the trail. */
  clear(): void;
  destroy(): void;
};

export type PixelFlame = {
  /**
   * Call every frame with the nozzle point (screen/world px) and ship rotation (0 = nose up).
   * The tongue points out of the ship bottom, ignites with a pop and fades when `active` drops.
   */
  update(nozzleX: number, nozzleY: number, rotation: number, active: boolean, timeMs: number, deltaMs: number): void;
  /** 0..1 current flame power (eases in/out). */
  readonly power: number;
  setDepth(value: number): void;
  setVisible(value: boolean): void;
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

/** Particle alpha op that follows a stepped (hard-edged) fade over each particle's life. */
function steppedAlphaOp(fade: SteppedFade): Phaser.Types.GameObjects.Particles.EmitterOpCustomUpdateConfig {
  return {
    onEmit: () => fade.start,
    onUpdate: (particle) => steppedFadeAlpha(particle.lifeT, fade),
  };
}

// ---------------------------------------------------------------------------------------------
// Camera feedback
// ---------------------------------------------------------------------------------------------

type ShakeState = {
  readonly camera: Phaser.Cameras.Scene2D.Camera;
  startedAt: number;
  durationMs: number;
  amplitudePx: number;
  nextStepAt: number;
  offsetX: number;
  offsetY: number;
  /** Scroll before this frame's offset was added; null when no offset is applied. */
  baseX: number | null;
  baseY: number;
  followed: boolean;
  readonly detach: () => void;
};

const shakes = new WeakMap<Phaser.Scene, ShakeState>();

function startWorldShake(scene: Phaser.Scene, camera: Phaser.Cameras.Scene2D.Camera, durationMs: number, amplitudePx: number): void {
  const now = scene.time.now;
  const existing = shakes.get(scene);
  if (existing && existing.camera === camera) {
    // A new shake never weakens one already running.
    const remaining = existing.startedAt + existing.durationMs - now;
    if (remaining < durationMs || existing.amplitudePx < amplitudePx) {
      existing.startedAt = now;
      existing.durationMs = Math.max(durationMs, remaining);
      existing.amplitudePx = Math.max(amplitudePx, existing.amplitudePx);
      existing.nextStepAt = now;
    }
    return;
  }
  existing?.detach();

  const onFollow = (): void => {
    state.followed = true;
  };
  // Applied just before the cameras render, removed right after, so gameplay never sees it.
  const apply = (): void => {
    const time = scene.time.now;
    const elapsed = time - state.startedAt;
    if (elapsed >= state.durationMs || !camera.scene) {
      state.detach();
      return;
    }
    if (time >= state.nextStepAt) {
      state.offsetX = shakeOffset(elapsed, state.durationMs, state.amplitudePx, SHAKE_TUNING.gridPx, Math.random());
      state.offsetY = shakeOffset(elapsed, state.durationMs, state.amplitudePx, SHAKE_TUNING.gridPx, Math.random());
      state.nextStepAt = time + SHAKE_TUNING.stepMs;
    }
    state.baseX = camera.scrollX;
    state.baseY = camera.scrollY;
    state.followed = false;
    camera.scrollX += state.offsetX;
    camera.scrollY += state.offsetY;
  };
  const restore = (): void => {
    if (state.baseX === null) return;
    if (state.followed) {
      // The follow lerp already pulled part of the offset into its step; remove only the rest.
      camera.scrollX -= state.offsetX * (1 - camera.lerp.x);
      camera.scrollY -= state.offsetY * (1 - camera.lerp.y);
    } else {
      camera.scrollX = state.baseX;
      camera.scrollY = state.baseY;
    }
    state.baseX = null;
  };

  const state: ShakeState = {
    camera,
    startedAt: now,
    durationMs,
    amplitudePx,
    nextStepAt: now,
    offsetX: 0,
    offsetY: 0,
    baseX: null,
    baseY: 0,
    followed: false,
    detach: () => {
      restore();
      scene.events.off(Phaser.Scenes.Events.PRE_RENDER, apply);
      scene.events.off(Phaser.Scenes.Events.RENDER, restore);
      scene.events.off(Phaser.Scenes.Events.SHUTDOWN, state.detach);
      camera.off(Phaser.Cameras.Scene2D.Events.FOLLOW_UPDATE, onFollow);
      if (shakes.get(scene) === state) shakes.delete(scene);
    },
  };
  shakes.set(scene, state);
  scene.events.on(Phaser.Scenes.Events.PRE_RENDER, apply);
  scene.events.on(Phaser.Scenes.Events.RENDER, restore);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, state.detach);
  camera.on(Phaser.Cameras.Scene2D.Events.FOLLOW_UPDATE, onFollow);
}

/**
 * World shake: the camera scroll jitters by whole 2 px steps and decays, so scrollFactor-0
 * layers (HUD, gauges, cards, touch controls, screen-fixed skies) stay perfectly still.
 * World layers that scroll should overscan by `SHAKE_MAX_OFFSET_PX`. Skipped under reduced motion.
 */
export function shakeCamera(scene: Phaser.Scene, strength: ShakeStrength, options: ShakeOptions = {}): void {
  if (isReducedMotion()) return;
  try {
    const tuning = SHAKE_TUNING[strength];
    startWorldShake(scene, options.camera ?? scene.cameras.main, tuning.durationMs, tuning.amplitudePx);
  } catch {
    // camera unavailable during shutdown
  }
}

/**
 * Brief warm-cream screen flash for big moments: a screen-fixed overlay that pops to
 * `FLASH_TUNING.peakAlpha` and steps down in hard steps (skipped under reduced motion).
 */
export function flashScreen(scene: Phaser.Scene, color: string = FLASH_TUNING.color, durationMs: number = FLASH_TUNING.defaultDurationMs): void {
  if (isReducedMotion()) return;
  try {
    const { width, height } = scene.scale;
    // Oversized so camera zoom or shake never reveals an edge.
    const overlay = scene.add
      .rectangle(-width, -height, width * 3, height * 3, colorNumber(color))
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(depthBands.overlay - 1)
      .setAlpha(FLASH_TUNING.peakAlpha);
    if (FLASH_TUNING.additive) overlay.setBlendMode(Phaser.BlendModes.ADD);
    const steps = FLASH_TUNING.steps;
    const stepMs = Math.max(16, durationMs / steps);
    let index = 0;
    scene.time.addEvent({
      delay: stepMs,
      repeat: steps - 1,
      callback: () => {
        index += 1;
        const alpha = flashAlphaAt(index / steps, FLASH_TUNING.peakAlpha, steps);
        if (alpha <= 0) overlay.destroy();
        else overlay.setAlpha(alpha);
      },
    });
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
    const anim = particleAnimKey(scene, textureKey, tuning.frames, tuning.animMs, false);
    emitter = scene.add.particles(0, 0, textureKey, {
      emitting: false,
      anim,
      lifespan: { min: tuning.lifespanMs.min, max: tuning.lifespanMs.max },
      speed: 0,
      scale: sheet.artScale,
      alpha: steppedAlphaOp(tuning.fade),
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
          const px = Math.round(previous.x + (nozzle.x - previous.x) * along + perpX * jitter);
          const py = Math.round(previous.y + (nozzle.y - previous.y) * along + perpY * jitter);
          const particle = emitter.emitParticleAt(px, py, 1);
          if (!particle) break;
          const angle = Phaser.Math.DegToRad(baseAngle + (Math.random() * 2 - 1) * tuning.spreadDegrees);
          const speed = inRange(tuning.speed, Math.random()) + tuning.intensitySpeed * clampedIntensity;
          const lifeSeconds = particle.life / 1000;
          particle.velocityX = Math.cos(angle) * speed;
          particle.velocityY = Math.sin(angle) * speed;
          particle.accelerationX = lifeSeconds > 0 ? (-particle.velocityX * tuning.drag) / lifeSeconds : 0;
          particle.accelerationY = lifeSeconds > 0 ? (-particle.velocityY * tuning.drag) / lifeSeconds : 0;
          // The flame-tongue frames are directional, so puffs follow the ship's heading.
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
    clear() {
      wasActive = false;
      carry = 0;
      if (emitter?.active) emitter.killAll();
    },
    destroy() {
      emitter?.destroy();
      emitter = null;
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Pixel nozzle flame
// ---------------------------------------------------------------------------------------------

/**
 * A stepped pixel flame tongue for a visible nozzle (landing close-up, title ship): the thrust
 * sheet's flame-tongue frames at the sheet's integer artScale, anchored on the nozzle and
 * rotated with the ship, plus an opt-in hard-edged stepped glow (no gradients, no vectors).
 */
export function createPixelFlame(scene: Phaser.Scene, options: { readonly depth?: number; readonly glow?: boolean } = {}): PixelFlame {
  // The glow is opt-in: over dark space a dim additive disc reads as a muddy halo, and the
  // opaque tongue plus thrust puffs already carry the light.
  const tuning = PIXEL_FLAME_TUNING;
  const sheet = PARTICLE_SHEETS.thrust;
  let tongue: Phaser.GameObjects.Image | null = null;
  let glow: Phaser.GameObjects.Image | null = null;
  try {
    const key = particleTextureKey(scene, "thrust");
    tongue = scene.add
      .image(0, 0, key, tuning.frames[0] ?? 0)
      .setOrigin(0.5, tuning.originY)
      .setScale(sheet.artScale)
      .setVisible(false)
      .setDepth(options.depth ?? depthBands.shipFx);
    if (options.glow === true) {
      glow = scene.add
        .image(0, 0, pixelGlowTextureKey(scene))
        .setScale(sheet.artScale)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setVisible(false)
        .setDepth((options.depth ?? depthBands.shipFx) - 0.01);
    }
  } catch {
    tongue = null;
  }

  let power = 0;
  let wasActive = false;
  let igniteAt = Number.NEGATIVE_INFINITY;
  let hidden = false;

  const frameFor = (timeMs: number): number | null => {
    const thresholds = tuning.powerThresholds;
    let index = -1;
    for (let i = 0; i < thresholds.length; i += 1) if (power >= (thresholds[i] ?? 1)) index = i;
    if (index < 0) return null;
    if (timeMs - igniteAt < tuning.popMs && wasActive) return tuning.frames[tuning.frames.length - 1] ?? null;
    if (index === thresholds.length - 1 && index > 0) {
      // Flicker between the two largest tongues; a cheap hash keeps it irregular but stable.
      const tick = Math.floor(timeMs / tuning.flickerMs);
      const hash = Math.imul(tick ^ 0x5bd1e995, 0x27d4eb2d) >>> 0;
      return tuning.frames[hash % 3 === 0 ? index - 1 : index] ?? null;
    }
    return tuning.frames[index] ?? null;
  };

  return {
    get power() {
      return power;
    },
    update(nozzleX, nozzleY, rotation, active, timeMs, deltaMs) {
      if (!tongue || !tongue.active) return;
      if (active && !wasActive) igniteAt = timeMs;
      wasActive = active;
      const seconds = Number.isFinite(deltaMs) ? Math.min(0.1, Math.max(0, deltaMs / 1000)) : 0;
      power = active ? Math.min(1, power + tuning.ignitePerSecond * seconds) : Math.max(0, power - tuning.fadePerSecond * seconds);
      if (active && power < (tuning.powerThresholds[0] ?? 0)) power = tuning.powerThresholds[0] ?? 0;
      const frame = hidden ? null : frameFor(timeMs);
      if (frame === null) {
        tongue.setVisible(false);
        glow?.setVisible(false);
        return;
      }
      const x = Math.round(nozzleX);
      const y = Math.round(nozzleY);
      tongue.setFrame(frame).setPosition(x, y).setRotation(rotation).setVisible(true);
      if (glow) {
        const offset = tuning.glow.offsetArt * sheet.artScale;
        // Two hard glow levels: dim while igniting/fading, full once the tongue is long.
        const level = power >= (tuning.powerThresholds[1] ?? 0.5) ? 1 : 0.5;
        glow
          .setPosition(Math.round(x - Math.sin(rotation) * offset), Math.round(y + Math.cos(rotation) * offset))
          .setAlpha(level)
          .setVisible(true);
      }
    },
    setDepth(value) {
      tongue?.setDepth(value);
      glow?.setDepth(value - 0.01);
    },
    setVisible(value) {
      hidden = !value;
      if (hidden) {
        tongue?.setVisible(false);
        glow?.setVisible(false);
      }
    },
    destroy() {
      tongue?.destroy();
      glow?.destroy();
      tongue = null;
      glow = null;
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
  const anim = particleAnimKey(scene, textureKey, tuning.anim.frames, tuning.anim.durationMs, tuning.anim.loop);
  const emitter = scene.add.particles(0, 0, textureKey, {
    emitting: false,
    // Looping twinkles start on a random frame so one burst never blinks in lockstep.
    anim: tuning.anim.loop ? { anims: [{ key: anim, randomFrame: true }] } : anim,
    lifespan: { min: tuning.lifespanMs.min, max: tuning.lifespanMs.max },
    speed: { min: tuning.speed.min, max: tuning.speed.max },
    angle: BURST_ANGLES[kind],
    gravityY: tuning.gravityY,
    // Integer pixel contract: every particle shows at exactly the sheet's artScale.
    scale: sheet.artScale,
    alpha: steppedAlphaOp(tuning.fade),
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
    const lifeCap = options.lifespanMs !== undefined && Number.isFinite(options.lifespanMs) ? Math.max(60, options.lifespanMs) : null;
    const ring = options.spawnRadius !== undefined && Number.isFinite(options.spawnRadius) ? Math.max(0, options.spawnRadius) : 0;
    // Emit one by one so each particle gets an upward lift: bursts bloom instead of spraying flat.
    const lift = tuning.lift * scale;
    for (let i = 0; i < count; i += 1) {
      const around = ((i + Math.random() * 0.6) / count) * Math.PI * 2;
      const px = Math.round(x + Math.cos(around) * ring);
      const py = Math.round(y + Math.sin(around) * ring);
      const particle = emitter.emitParticleAt(px, py, 1);
      if (!particle) break;
      if (ring > 0) {
        // Halo: fly outward from the ring so nothing drifts across the object in the middle.
        const speed = Math.hypot(particle.velocityX, particle.velocityY);
        particle.velocityX = Math.cos(around) * speed;
        particle.velocityY = Math.sin(around) * speed;
      }
      particle.velocityY -= lift * (0.6 + Math.random() * 0.4);
      if (lifeCap !== null && particle.life > lifeCap) {
        particle.life = lifeCap;
        particle.lifeCurrent = lifeCap;
      }
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

/**
 * Fast-forwards every live burst particle in the scene to the end of its life so it fades out
 * within `withinMs` (stepped). Call when a reveal is skipped or settles so no stray sparkle or
 * dust is left floating over the final frame. Pass 0 to remove them immediately.
 */
export function settleBursts(scene: Phaser.Scene, withinMs = 140): void {
  const fx = sceneFx.get(scene);
  if (!fx) return;
  try {
    for (const emitter of fx.bursts.values()) {
      if (!emitter.active) continue;
      if (withinMs <= 0) {
        emitter.killAll();
        continue;
      }
      emitter.forEachAlive((particle) => {
        if (particle.lifeCurrent > withinMs) particle.lifeCurrent = withinMs;
      }, undefined);
    }
  } catch {
    // ignore
  }
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
    const anim = particleAnimKey(scene, textureKey, tuning.frames, tuning.animMs, false);
    const reduced = isReducedMotion();
    const emitter = scene.add.particles(Math.round(x), Math.round(y), textureKey, {
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
      alpha: steppedAlphaOp(tuning.fade),
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
 * safe on gameplay-scaled sprites. Reduced motion skips it. (Briefly non-integer by nature:
 * keep it to short beats on chunky shapes rather than fine pixel art.)
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
