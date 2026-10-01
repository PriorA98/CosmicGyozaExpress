import Phaser from "phaser";
import { ASSET } from "../data/assetManifest";
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

export type ShipIdleMotion = {
  readonly bobPx: number;
  readonly bobPeriodMs: number;
  readonly tiltRadians: number;
};

/**
 * The gyoza ship sprite. Physics lives in ShipMovementSystem; this entity mirrors a
 * `ShipKinematicState` and adds purely visual life on top (idle micro-bob, bump squash).
 *
 * Frames share a normalized canvas (see assetManifest) with the body centred on the origin,
 * so swapping idle / fly / incident frames never shifts the ship.
 */
export class GyozaShip extends Phaser.GameObjects.Sprite {
  private kinematicState: ShipKinematicState;
  private visualOffsetX = 0;
  private visualOffsetY = 0;
  private visualTilt = 0;
  private squashTween: Phaser.Tweens.Tween | undefined;

  constructor(scene: Phaser.Scene, state: ShipKinematicState) {
    super(scene, state.x, state.y, ASSET.shipIdle);
    scene.add.existing(this);

    this.kinematicState = state;
    this.setOrigin(0.5, 0.5);
    this.setScale(0.65);
    this.applyStateToSprite();
  }

  get kinematics(): ShipKinematicState {
    return this.kinematicState;
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
    this.visualOffsetX = 0;
    this.visualOffsetY = Math.sin(phase) * motion.bobPx * strength;
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

  /** Brief squash-and-stretch (e.g. after a bump). Restores the current scale when done. */
  playSquash(amount: number, durationMs: number): void {
    this.squashTween?.stop();
    const baseX = this.scaleX;
    const baseY = this.scaleY;
    const proxy = { t: 1 };
    this.squashTween = this.scene.tweens.add({
      targets: proxy,
      t: 0,
      duration: durationMs * 3,
      ease: "Elastic.easeOut",
      easeParams: [1.1, 0.5],
      onUpdate: () => {
        this.setScale(baseX * (1 + amount * proxy.t), baseY * (1 - amount * proxy.t));
      },
      onComplete: () => this.setScale(baseX, baseY),
      onStop: () => this.setScale(baseX, baseY),
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
