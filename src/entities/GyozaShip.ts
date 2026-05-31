import Phaser from "phaser";
import { shipSpeed } from "../systems/ShipMovementSystem";
import type { ShipKinematicState } from "../types/flight";

export class GyozaShip extends Phaser.GameObjects.Sprite {
  private kinematicState: ShipKinematicState;

  constructor(scene: Phaser.Scene, state: ShipKinematicState) {
    super(scene, state.x, state.y, "ship-idle");
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

  setIncidentFrame(frame: number): void {
    this.setTexture(`ship-incident-${frame}`);
  }

  speed(): number {
    return shipSpeed(this.kinematicState);
  }

  private pickTextureKey(thrusting: boolean): string {
    if (!thrusting) return "ship-idle";

    const speed = this.speed();
    if (speed < 90) return "ship-fly-1";
    if (speed < 210) return "ship-fly-2";
    return "ship-fly-3";
  }

  private applyStateToSprite(): void {
    this.setPosition(this.kinematicState.x, this.kinematicState.y);
    this.rotation = this.kinematicState.rotation;
  }
}
