import Phaser from "phaser";
import { ASSET, ASSET_MANIFEST, SHIP_ART } from "../data/assetManifest";
import { shipSpeed } from "../systems/ShipMovementSystem";
import type { ShipKinematicState } from "../types/flight";

const INCIDENT_FRAMES = [
  ASSET.shipIncident1,
  ASSET.shipIncident2,
  ASSET.shipIncident3,
  ASSET.shipIncident4,
  ASSET.shipIncident5,
] as const;

/** Thrust frame thresholds (px/s): slower speeds show the smaller flame frames. */
const FLY_FRAME_SPEEDS = { small: 90, medium: 210 } as const;

const TAU = Math.PI * 2;

/** Squash timing as shares of the caller's duration: hold at full squash, then spring back. */
const SQUASH_HOLD_SHARE = 0.6;
const SQUASH_RELEASE_SHARE = 2.4;
const SQUASH_OVERSHOOT = 2.2;

export type HullFlashMode = "fill" | "screen";

export type ShipIdleMotion = {
  readonly bobPx: number;
  readonly bobPeriodMs: number;
  readonly tiltRadians: number;
};

/**
 * How the ship art is placed on screen. `contract` art (SHIP_ART: 64x80 canvas) pivots on the
 * saucer centre at an integer scale; legacy art (older canvases) keeps a centred origin and a
 * caller-supplied scale until the redraw lands.
 */
export type ShipArtLayout = {
  readonly contract: boolean;
  readonly scale: number;
  readonly originX: number;
  readonly originY: number;
};

/** Resolves the ship art layout for the loaded idle frame (pure apart from the texture lookup). */
export function resolveShipArtLayout(scene: Phaser.Scene, legacyScale: number): ShipArtLayout {
  const entry = ASSET_MANIFEST.find((candidate) => candidate.key === ASSET.shipIdle);
  const source = scene.textures.exists(ASSET.shipIdle) ? scene.textures.get(ASSET.shipIdle).getSourceImage() : undefined;
  const contract = source !== undefined && source.width === SHIP_ART.width && source.height === SHIP_ART.height;
  if (!contract) return { contract: false, scale: legacyScale, originX: 0.5, originY: 0.5 };
  return {
    contract: true,
    scale: entry?.artScale ?? SHIP_ART.artScale,
    originX: SHIP_ART.saucerCenterX / SHIP_ART.width,
    originY: SHIP_ART.saucerCenterY / SHIP_ART.height,
  };
}

/**
 * The gyoza ship sprite. Physics lives in ShipMovementSystem; this entity mirrors a
 * `ShipKinematicState` and adds purely visual life on top (idle micro-bob, bump squash, hull flash).
 *
 * Frames share a normalized canvas (see assetManifest SHIP_ART), so swapping idle / fly / incident
 * frames never shifts the ship. The constructor keeps a centred origin for backward compatibility;
 * call `applyArtLayout` to pivot on the saucer centre at the contract's integer scale.
 */
export class GyozaShip extends Phaser.GameObjects.Sprite {
  private kinematicState: ShipKinematicState;
  private visualOffsetX = 0;
  private visualOffsetY = 0;
  private visualTilt = 0;
  private squashTween: Phaser.Tweens.Tween | undefined;
  private flashTimer: Phaser.Time.TimerEvent | undefined;
  private baseScale = 1;

  constructor(scene: Phaser.Scene, state: ShipKinematicState) {
    super(scene, state.x, state.y, ASSET.shipIdle);
    scene.add.existing(this);

    this.kinematicState = state;
    this.setOrigin(0.5, 0.5);
    this.applyStateToSprite();
  }

  get kinematics(): ShipKinematicState {
    return this.kinematicState;
  }

  /** Resting display scale (screen px per art px for contract art). */
  get restingScale(): number {
    return this.baseScale;
  }

  setKinematicState(state: ShipKinematicState, thrusting: boolean): void {
    this.kinematicState = state;
    this.applyStateToSprite();
    this.setTexture(this.pickTextureKey(thrusting));
  }

  /** Incident frames are 1-based (1..5); out-of-range values clamp to the nearest frame. */
  setIncidentFrame(frame: number): void {
    const index = Phaser.Math.Clamp(Math.round(frame), 1, INCIDENT_FRAMES.length) - 1;
    this.setTexture(INCIDENT_FRAMES[index] ?? ASSET.shipIncident1);
  }

  speed(): number {
    return shipSpeed(this.kinematicState);
  }

  /**
   * Gentle floating bob and tilt on the sprite only. The kinematic position (and anything that
   * follows it, like the camera target) is untouched. Pass `strength` 0 to settle.
   */
  animateIdle(timeMs: number, motion: ShipIdleMotion, strength: number): void {
    const phase = (timeMs / motion.bobPeriodMs) * TAU;
    const step = Math.max(1, Math.round(this.baseScale));
    this.visualOffsetX = 0;
    // Bob in whole art pixels so the hull never sits between pixel-grid steps.
    this.visualOffsetY = Math.round((Math.sin(phase) * motion.bobPx * strength) / step) * step;
    this.visualTilt = Math.sin(phase * 0.5) * motion.tiltRadians * strength;
    this.applyStateToSprite();
  }

  /** Visible screen-space position of the ship body (kinematics + visual offset). */
  get visualX(): number {
    return this.kinematicState.x + this.visualOffsetX;
  }

  get visualY(): number {
    return this.kinematicState.y + this.visualOffsetY;
  }

  /** Resting display scale; squash always returns here, even if interrupted mid-tween. */
  setBaseScale(scale: number): this {
    this.baseScale = scale;
    this.setScale(scale);
    return this;
  }

  /** Applies a resolved art layout: saucer-centre pivot and integer scale for contract art. */
  applyArtLayout(layout: ShipArtLayout): this {
    this.setOrigin(layout.originX, layout.originY);
    return this.setBaseScale(layout.scale);
  }

  /**
   * Brief squash-and-stretch (e.g. after a bump): snaps to the full squash, holds a beat so it reads,
   * then springs back past rest and settles. Always returns to the base scale, even if interrupted.
   */
  playSquash(amount: number, durationMs: number): void {
    this.squashTween?.stop();
    const base = this.baseScale;
    const proxy = { t: 1 };
    const apply = (): void => {
      this.setScale(base * (1 + amount * proxy.t), base * (1 - amount * proxy.t));
    };
    apply();
    this.squashTween = this.scene.tweens.add({
      targets: proxy,
      t: 0,
      delay: durationMs * SQUASH_HOLD_SHARE,
      duration: durationMs * SQUASH_RELEASE_SHARE,
      ease: "Back.easeOut",
      easeParams: [SQUASH_OVERSHOOT],
      onUpdate: apply,
      onComplete: () => this.setScale(base, base),
      onStop: () => this.setScale(base, base),
    });
  }

  /**
   * Brief hull flash (bump feedback). `fill` paints a solid silhouette; `screen` brightens toward
   * the colour while keeping the pixel detail readable. Restores normal tinting afterwards.
   */
  flashHull(color: number, durationMs: number, mode: HullFlashMode = "fill"): void {
    this.flashTimer?.remove(false);
    this.setTint(color).setTintMode(mode === "screen" ? Phaser.TintModes.SCREEN : Phaser.TintModes.FILL);
    this.flashTimer = this.scene.time.delayedCall(durationMs, () => {
      this.clearTint();
      this.setTintMode(Phaser.TintModes.MULTIPLY);
      this.flashTimer = undefined;
    });
  }

  private pickTextureKey(thrusting: boolean): string {
    if (!thrusting) return ASSET.shipIdle;

    const speed = this.speed();
    if (speed < FLY_FRAME_SPEEDS.small) return ASSET.shipFly1;
    if (speed < FLY_FRAME_SPEEDS.medium) return ASSET.shipFly2;
    return ASSET.shipFly3;
  }

  private applyStateToSprite(): void {
    this.setPosition(this.kinematicState.x + this.visualOffsetX, this.kinematicState.y + this.visualOffsetY);
    this.rotation = this.kinematicState.rotation + this.visualTilt;
  }
}
