import Phaser from "phaser";
import { GyozaShip, type ShipControls } from "../entities/GyozaShip";
import { colors } from "../game/designTokens";
import { radiansToCompassDegrees } from "../utils/math";

type FlightKeys = {
  W: Phaser.Input.Keyboard.Key;
  A: Phaser.Input.Keyboard.Key;
  S: Phaser.Input.Keyboard.Key;
  D: Phaser.Input.Keyboard.Key;
  UP: Phaser.Input.Keyboard.Key;
  LEFT: Phaser.Input.Keyboard.Key;
  DOWN: Phaser.Input.Keyboard.Key;
  RIGHT: Phaser.Input.Keyboard.Key;
  ESC: Phaser.Input.Keyboard.Key;
};

export class FlightScene extends Phaser.Scene {
  private ship!: GyozaShip;
  private keys!: FlightKeys;
  private debugText!: Phaser.GameObjects.Text;

  constructor() {
    super("FlightScene");
  }

  create(): void {
    const { width, height } = this.scale;

    this.createStarfield(width, height);
    this.add.image(width * 0.78, height * 0.28, "planet-im-fine").setScale(0.13).setAlpha(0.85);

    this.ship = new GyozaShip(this, width / 2, height / 2);

    this.keys = this.input.keyboard?.addKeys({
      W: Phaser.Input.Keyboard.KeyCodes.W,
      A: Phaser.Input.Keyboard.KeyCodes.A,
      S: Phaser.Input.Keyboard.KeyCodes.S,
      D: Phaser.Input.Keyboard.KeyCodes.D,
      UP: Phaser.Input.Keyboard.KeyCodes.UP,
      LEFT: Phaser.Input.Keyboard.KeyCodes.LEFT,
      DOWN: Phaser.Input.Keyboard.KeyCodes.DOWN,
      RIGHT: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      ESC: Phaser.Input.Keyboard.KeyCodes.ESC,
    }) as FlightKeys;

    this.debugText = this.add.text(22, 22, "", {
      color: colors.plaster,
      fontFamily: "monospace",
      fontSize: "14px",
      lineSpacing: 6,
      backgroundColor: "rgba(20,22,38,0.72)",
      padding: { x: 12, y: 10 },
    });

    this.add
      .text(width / 2, height - 28, "W/UP thrust · S/DOWN brake · A/D rotate · refresh to reset", {
        color: "rgba(251,247,236,0.72)",
        fontFamily: "monospace",
        fontSize: "13px",
      })
      .setOrigin(0.5);
  }

  override update(_time: number, delta: number): void {
    const controls = this.readControls();
    this.ship.updateShip(delta, controls);
    this.keepShipInBounds();
    this.updateDebugText();
  }

  private readControls(): ShipControls {
    return {
      thrust: this.keys.W.isDown || this.keys.UP.isDown,
      brake: this.keys.S.isDown || this.keys.DOWN.isDown,
      rotateLeft: this.keys.A.isDown || this.keys.LEFT.isDown,
      rotateRight: this.keys.D.isDown || this.keys.RIGHT.isDown,
    };
  }

  private keepShipInBounds(): void {
    const margin = 42;
    const { width, height } = this.scale;

    if (this.ship.x < margin) {
      this.ship.x = margin;
      this.ship.velocity.x = Math.abs(this.ship.velocity.x) * 0.35;
    } else if (this.ship.x > width - margin) {
      this.ship.x = width - margin;
      this.ship.velocity.x = -Math.abs(this.ship.velocity.x) * 0.35;
    }

    if (this.ship.y < margin) {
      this.ship.y = margin;
      this.ship.velocity.y = Math.abs(this.ship.velocity.y) * 0.35;
    } else if (this.ship.y > height - margin) {
      this.ship.y = height - margin;
      this.ship.velocity.y = -Math.abs(this.ship.velocity.y) * 0.35;
    }
  }

  private updateDebugText(): void {
    this.debugText.setText([
      "flight prototype",
      `speed       ${this.ship.speed().toFixed(1)} px/s`,
      `heading     ${radiansToCompassDegrees(this.ship.rotation).toString().padStart(3, "0")} deg`,
      `velocity x  ${this.ship.velocity.x.toFixed(1)}`,
      `velocity y  ${this.ship.velocity.y.toFixed(1)}`,
      "dashboard   doing its best",
    ]);
  }

  private createStarfield(width: number, height: number): void {
    this.add.rectangle(0, 0, width, height, 0x1a1b2e).setOrigin(0, 0);

    for (let i = 0; i < 140; i += 1) {
      const x = Phaser.Math.Between(0, width);
      const y = Phaser.Math.Between(0, height);
      const size = Phaser.Math.Between(1, 2);
      const alpha = Phaser.Math.FloatBetween(0.25, 0.9);
      this.add.rectangle(x, y, size, size, 0xfbf7ec, alpha);
    }
  }
}
