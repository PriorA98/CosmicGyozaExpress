import Phaser from "phaser";
import { shipTuning } from "../data/tuning";
import { applyDamping, clamp } from "../utils/math";

export type ShipControls = {
  thrust: boolean;
  brake: boolean;
  rotateLeft: boolean;
  rotateRight: boolean;
};

export class GyozaShip extends Phaser.GameObjects.Sprite {
  readonly velocity = new Phaser.Math.Vector2(0, 0);

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "ship-idle");
    scene.add.existing(this);

    this.setOrigin(0.5, 0.5);
    this.setScale(0.65);
  }

  updateShip(deltaMs: number, controls: ShipControls): void {
    const dt = deltaMs / 1000;
    const rotateDirection = Number(controls.rotateRight) - Number(controls.rotateLeft);

    this.rotation += rotateDirection * shipTuning.rotationSpeed * dt;

    const facing = new Phaser.Math.Vector2(Math.sin(this.rotation), -Math.cos(this.rotation));

    if (controls.thrust) {
      this.velocity.x += facing.x * shipTuning.thrustAcceleration * dt;
      this.velocity.y += facing.y * shipTuning.thrustAcceleration * dt;
    }

    if (controls.brake && this.velocity.lengthSq() > 0.001) {
      const brake = this.velocity.clone().normalize().scale(-shipTuning.brakeAcceleration * dt);
      this.velocity.add(brake);
    }

    this.velocity.x = applyDamping(this.velocity.x, shipTuning.linearDamping, dt);
    this.velocity.y = applyDamping(this.velocity.y, shipTuning.linearDamping, dt);

    const speed = this.velocity.length();
    if (speed > shipTuning.maxSoftSpeed) {
      const overspeed = clamp((speed - shipTuning.maxSoftSpeed) / shipTuning.maxSoftSpeed, 0, 1);
      this.velocity.scale(1 - overspeed * shipTuning.overspeedDrag * dt);
    }

    this.x += this.velocity.x * dt;
    this.y += this.velocity.y * dt;

    this.setTexture(this.pickTextureKey(controls.thrust));
  }

  speed(): number {
    return this.velocity.length();
  }

  private pickTextureKey(thrusting: boolean): string {
    if (!thrusting) return "ship-idle";

    const speed = this.speed();
    if (speed < 90) return "ship-fly-1";
    if (speed < 210) return "ship-fly-2";
    return "ship-fly-3";
  }
}
