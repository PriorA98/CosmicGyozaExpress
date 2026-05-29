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

type TouchControlKey = keyof ShipControls;

type TouchControlPad = {
  control: TouchControlKey;
  hitArea: Phaser.Geom.Rectangle;
  active: boolean;
  bg: Phaser.GameObjects.Arc;
  ring: Phaser.GameObjects.Arc;
  group: Phaser.GameObjects.Container;
};

export class FlightScene extends Phaser.Scene {
  private ship!: GyozaShip;
  private keys!: FlightKeys;
  private debugText!: Phaser.GameObjects.Text;
  private touchControls: ShipControls = {
    thrust: false,
    brake: false,
    rotateLeft: false,
    rotateRight: false,
  };
  private touchPads: TouchControlPad[] = [];

  constructor() {
    super("FlightScene");
  }

  create(): void {
    const { width, height } = this.scale;

    this.createStarfield(width, height);
    this.input.addPointer(5);
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
      .text(width / 2, height - 28, "keyboard: W/S/A/D · touch: hold pads to fly · refresh to reset", {
        color: "rgba(251,247,236,0.72)",
        fontFamily: "monospace",
        fontSize: "13px",
      })
      .setOrigin(0.5);

    this.createTouchControls(width, height);
  }

  override update(_time: number, delta: number): void {
    this.updateTouchControlState();
    const controls = this.readControls();
    this.ship.updateShip(delta, controls);
    this.keepShipInBounds();
    this.updateDebugText();
  }

  private readControls(): ShipControls {
    return {
      thrust: this.keys.W.isDown || this.keys.UP.isDown || this.touchControls.thrust,
      brake: this.keys.S.isDown || this.keys.DOWN.isDown || this.touchControls.brake,
      rotateLeft: this.keys.A.isDown || this.keys.LEFT.isDown || this.touchControls.rotateLeft,
      rotateRight: this.keys.D.isDown || this.keys.RIGHT.isDown || this.touchControls.rotateRight,
    };
  }

  private createTouchControls(width: number, height: number): void {
    this.touchPads = [];

    const panelWidth = Math.min(430, width * 0.42);
    const panelGap = 16;
    const zoneWidth = (panelWidth - panelGap) / 2;
    const zoneHeight = 250;
    const zoneTop = height - zoneHeight;
    const rightPanelX = width - panelWidth;

    this.createTouchButton(
      new Phaser.Geom.Rectangle(0, zoneTop, zoneWidth, zoneHeight),
      "◀",
      "rotate left",
      "rotateLeft",
    );
    this.createTouchButton(
      new Phaser.Geom.Rectangle(zoneWidth + panelGap, zoneTop, zoneWidth, zoneHeight),
      "▶",
      "rotate right",
      "rotateRight",
    );
    this.createTouchButton(
      new Phaser.Geom.Rectangle(rightPanelX, zoneTop, zoneWidth, zoneHeight),
      "S",
      "brake",
      "brake",
      colors.duskBlue,
    );
    this.createTouchButton(
      new Phaser.Geom.Rectangle(rightPanelX + zoneWidth + panelGap, zoneTop, zoneWidth, zoneHeight),
      "▲",
      "thrust",
      "thrust",
      colors.terracotta,
    );

    this.input.on("pointerdown", () => this.updateTouchControlState());
    this.input.on("pointermove", () => this.updateTouchControlState());
    this.input.on("pointerup", () => this.updateTouchControlState());
    this.input.on("pointercancel", () => this.updateTouchControlState());
    this.input.on("gameout", () => this.clearTouchControls());
  }

  private createTouchButton(
    hitArea: Phaser.Geom.Rectangle,
    glyph: string,
    label: string,
    control: TouchControlKey,
    accent: string = colors.ember,
  ): void {
    const x = hitArea.x + hitArea.width / 2;
    const y = hitArea.y + hitArea.height / 2;
    const radius = 46;
    const group = this.add.container(x, y).setDepth(20);
    const bg = this.add.circle(0, 0, radius, Phaser.Display.Color.HexStringToColor(accent).color, 0.2);
    const ring = this.add.circle(0, 0, radius).setStrokeStyle(2, 0xfbf7ec, 0.32);
    const glyphText = this.add
      .text(0, -7, glyph, {
        color: colors.plaster,
        fontFamily: "monospace",
        fontSize: "22px",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    const labelText = this.add
      .text(0, 22, label, {
        color: "rgba(251,247,236,0.66)",
        fontFamily: "monospace",
        fontSize: "10px",
      })
      .setOrigin(0.5);

    group.add([bg, ring, glyphText, labelText]);

    this.touchPads.push({
      control,
      hitArea,
      active: false,
      bg,
      ring,
      group,
    });
  }

  private updateTouchControlState(): void {
    const next: ShipControls = {
      thrust: false,
      brake: false,
      rotateLeft: false,
      rotateRight: false,
    };

    for (const pointer of this.input.manager.pointers) {
      if (!pointer.isDown) continue;

      pointer.updateWorldPoint(this.cameras.main);
      const pad = this.findTouchedPad(pointer.worldX, pointer.worldY);
      if (pad) next[pad.control] = true;
    }

    this.touchControls = next;
    this.updateTouchPadVisuals();
  }

  private findTouchedPad(x: number, y: number): TouchControlPad | undefined {
    return this.touchPads.find((pad) => Phaser.Geom.Rectangle.Contains(pad.hitArea, x, y));
  }

  private updateTouchPadVisuals(): void {
    for (const pad of this.touchPads) {
      const active = this.touchControls[pad.control];
      if (pad.active === active) continue;

      pad.active = active;
      pad.bg.setAlpha(active ? 0.5 : 0.2);
      pad.ring.setStrokeStyle(active ? 3 : 2, 0xfbf7ec, active ? 0.76 : 0.32);
      pad.group.setScale(active ? 0.96 : 1);
    }
  }

  private clearTouchControls(): void {
    this.touchControls = {
      thrust: false,
      brake: false,
      rotateLeft: false,
      rotateRight: false,
    };
    this.updateTouchPadVisuals();
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
