import Phaser from "phaser";
import { ASSET, ASSET_MANIFEST, SHIP_ART, SHIP_ROTATION } from "../data/assetManifest";
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

/** Base frame -> its pre-rotated sheet (tools/art/rotsprite.py, see SHIP_ROTATION). */
const ROTATED_SHEET: Readonly<Record<string, string>> = {
  [ASSET.shipIdle]: ASSET.shipIdleRot,
  [ASSET.shipFly1]: ASSET.shipFly1Rot,
  [ASSET.shipFly2]: ASSET.shipFly2Rot,
  [ASSET.shipFly3]: ASSET.shipFly3Rot,
  [ASSET.shipIncident1]: ASSET.shipIncident1Rot,
  [ASSET.shipIncident2]: ASSET.shipIncident2Rot,
  [ASSET.shipIncident3]: ASSET.shipIncident3Rot,
  [ASSET.shipIncident4]: ASSET.shipIncident4Rot,
  [ASSET.shipIncident5]: ASSET.shipIncident5Rot,
};

/** Nearest baked angle cell (0 = upright, clockwise) for a rotation in radians. */
export function rotationCellIndex(rotation: number, angles: number = SHIP_ROTATION.angles): number {
  const step = TAU / angles;
  const index = Math.round(rotation / step) % angles;
  return (index + angles) % angles;
}

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
  private baseKey: string = ASSET.shipIdle;
  private rotationOverride: number | undefined;
  private layoutOriginX = 0.5;
  private layoutOriginY = 0.5;

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
    this.rotationOverride = undefined;
    this.baseKey = this.pickTextureKey(thrusting);
    this.applyStateToSprite();
  }

  /** Incident frames are 1-based (1..5); out-of-range values clamp to the nearest frame. */
  setIncidentFrame(frame: number): void {
    const index = Phaser.Math.Clamp(Math.round(frame), 1, INCIDENT_FRAMES.length) - 1;
    this.baseKey = INCIDENT_FRAMES[index] ?? ASSET.shipIncident1;
    this.renderFrame();
  }

  /**
   * The ship's on-screen rotation in radians (0 = nose up, clockwise). Pixel art is never rotated
   * at runtime: the nearest pre-rotated cell is shown instead, and Phaser's own `rotation` stays 0.
   * Read this (not `rotation`) for the visible heading; tween it for scripted spins. Setting it
   * overrides the kinematic heading until the next `setKinematicState`.
   */
  get visualRotation(): number {
    return this.rotationOverride ?? this.kinematicState.rotation + this.visualTilt;
  }

  set visualRotation(value: number) {
    this.rotationOverride = value;
    this.renderFrame();
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
    this.layoutOriginX = layout.originX;
    this.layoutOriginY = layout.originY;
    this.setBaseScale(layout.scale);
    this.renderFrame();
    return this;
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
    this.renderFrame();
  }

  /** Shows `baseKey` at `visualRotation`: a baked angle cell when available, runtime rotation otherwise. */
  private renderFrame(): void {
    const rotatedKey = ROTATED_SHEET[this.baseKey];
    if (rotatedKey !== undefined && this.scene.textures.exists(rotatedKey)) {
      // Rotated cells are square and centred on the saucer pivot.
      this.setTexture(rotatedKey, rotationCellIndex(this.visualRotation));
      this.setOrigin(0.5, 0.5);
      this.rotation = 0;
      return;
    }
    this.setTexture(this.baseKey);
    this.setOrigin(this.layoutOriginX, this.layoutOriginY);
    this.rotation = this.visualRotation;
  }
}
