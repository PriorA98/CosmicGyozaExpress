import Phaser from "phaser";
import { TEA_MOON_MISSION_ID } from "../data/missions";
import { landingTuning } from "../data/tuning";
import { GyozaShip } from "../entities/GyozaShip";
import { colors } from "../game/designTokens";
import {
  classifyLandingTouchdown,
  createLandingState,
  createTeaMoonLandingPad,
  integrateLandingMovement,
  pinStateToLandingPad,
} from "../systems/LandingSystem";
import { applyPackageConditionEvent, packageConditionLabel } from "../systems/PackageConditionSystem";
import type {
  DeliveryResultSceneData,
  LandingControls,
  LandingKinematicState,
  LandingPadDefinition,
  LandingPhase,
  LandingResultKind,
  LandingSceneData,
} from "../types/landing";
import type { ShipKinematicState } from "../types/flight";
import { absoluteAngleDifferenceRadians, clamp, radiansToDegrees } from "../utils/math";

type LandingKeys = {
  readonly W: Phaser.Input.Keyboard.Key;
  readonly A: Phaser.Input.Keyboard.Key;
  readonly S: Phaser.Input.Keyboard.Key;
  readonly D: Phaser.Input.Keyboard.Key;
  readonly UP: Phaser.Input.Keyboard.Key;
  readonly LEFT: Phaser.Input.Keyboard.Key;
  readonly DOWN: Phaser.Input.Keyboard.Key;
  readonly RIGHT: Phaser.Input.Keyboard.Key;
  readonly R: Phaser.Input.Keyboard.Key;
};

type LandingTouchControlKey = keyof LandingControls;

type LandingTouchPad = {
  readonly control: LandingTouchControlKey;
  readonly hitArea: Phaser.Geom.Rectangle;
  active: boolean;
  readonly bg: Phaser.GameObjects.Arc;
  readonly ring: Phaser.GameObjects.Arc;
  readonly group: Phaser.GameObjects.Container;
};

export class LandingScene extends Phaser.Scene {
  private sceneData: LandingSceneData = {
    missionId: TEA_MOON_MISSION_ID,
    packageCondition: 100,
    routeCrashes: 0,
    routeDurationMs: 0,
  };
  private keys!: LandingKeys;
  private ship!: GyozaShip;
  private pad: LandingPadDefinition = createTeaMoonLandingPad();
  private landingState: LandingKinematicState = createLandingState();
  private phase: LandingPhase = { kind: "intro" };
  private dashboardPanel!: Phaser.GameObjects.Rectangle;
  private dashboardText!: Phaser.GameObjects.Text;
  private touchControls: LandingControls = {
    thrust: false,
    rotateLeft: false,
    rotateRight: false,
    stabilizer: false,
  };
  private touchPads: LandingTouchPad[] = [];
  private packageCondition = 100;
  private landingIncidents = 0;
  private delivered = false;

  constructor() {
    super("LandingScene");
  }

  init(data: Partial<LandingSceneData>): void {
    this.sceneData = {
      missionId: data.missionId ?? TEA_MOON_MISSION_ID,
      packageCondition: data.packageCondition ?? 100,
      routeCrashes: data.routeCrashes ?? 0,
      routeDurationMs: data.routeDurationMs ?? 0,
    };
  }

  create(): void {
    const { width, height } = this.scale;

    this.packageCondition = this.sceneData.packageCondition;
    this.pad = createTeaMoonLandingPad();
    this.landingState = createLandingState();
    this.phase = { kind: "descending" };
    this.delivered = false;
    this.landingIncidents = 0;

    this.createWorld(width, height);
    this.ship = new GyozaShip(this, this.toShipState(this.landingState));
    this.ship.setScale(0.72);

    this.keys = this.input.keyboard?.addKeys({
      W: Phaser.Input.Keyboard.KeyCodes.W,
      A: Phaser.Input.Keyboard.KeyCodes.A,
      S: Phaser.Input.Keyboard.KeyCodes.S,
      D: Phaser.Input.Keyboard.KeyCodes.D,
      UP: Phaser.Input.Keyboard.KeyCodes.UP,
      LEFT: Phaser.Input.Keyboard.KeyCodes.LEFT,
      DOWN: Phaser.Input.Keyboard.KeyCodes.DOWN,
      RIGHT: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      R: Phaser.Input.Keyboard.KeyCodes.R,
    }) as LandingKeys;

    this.createDashboard();
    this.createTouchControls(width, height);
    this.input.addPointer(5);
  }

  override update(time: number, delta: number): void {
    this.updateTouchControlState();

    if (Phaser.Input.Keyboard.JustDown(this.keys.R)) {
      this.restartLandingAttempt();
    }

    if (this.phase.kind === "incident") {
      this.updateIncident(time);
      this.updateShipVisual(false);
      this.updateDashboard();
      return;
    }

    if (this.phase.kind === "settling") {
      this.updateSettling(time);
      this.updateShipVisual(false);
      this.updateDashboard();
      return;
    }

    if (this.phase.kind !== "descending") {
      this.updateDashboard();
      return;
    }

    const controls = this.readControls();
    this.landingState = integrateLandingMovement(this.landingState, controls, delta / 1000);
    this.keepShipInsideView();
    this.updateShipVisual(controls.thrust);
    this.handleTouchdown(time);
    this.updateDashboard();
  }

  private createWorld(width: number, height: number): void {
    this.add.rectangle(0, 0, width, height, 0x1a1b2e).setOrigin(0, 0);
    this.add.rectangle(0, 0, width, height, 0x0e0f1c, 0.24).setOrigin(0, 0);

    for (let i = 0; i < 120; i += 1) {
      this.add.rectangle(
        Phaser.Math.Between(0, width),
        Phaser.Math.Between(0, Math.floor(height * 0.72)),
        Phaser.Math.Between(1, 2),
        Phaser.Math.Between(1, 2),
        0xfbf7ec,
        Phaser.Math.FloatBetween(0.18, 0.78),
      );
    }

    this.add.rectangle(0, this.pad.surfaceY, width, height - this.pad.surfaceY, 0x2f3149).setOrigin(0, 0);
    this.add.rectangle(this.pad.centerX, this.pad.surfaceY + 10, this.pad.width, 20, 0x8da17a, 0.82);
    this.add.rectangle(this.pad.centerX, this.pad.surfaceY + 3, this.pad.width + 30, 6, 0xf4ecdc, 0.34);
    this.add.text(this.pad.centerX, this.pad.surfaceY + 38, "tea moon landing blanket", {
      color: "rgba(251,247,236,0.68)",
      fontFamily: "monospace",
      fontSize: "13px",
    }).setOrigin(0.5);
  }

  private createDashboard(): void {
    this.dashboardPanel = this.add
      .rectangle(18, 18, 398, 176, this.colorNumber(colors.cosmosPanel), 0.82)
      .setOrigin(0, 0)
      .setDepth(40);
    this.dashboardPanel.setStrokeStyle(1, 0xfbf7ec, 0.22);

    this.dashboardText = this.add
      .text(34, 30, "", {
        color: colors.plaster,
        fontFamily: "monospace",
        fontSize: "13px",
        lineSpacing: 5,
      })
      .setDepth(41);

    this.add
      .text(this.scale.width / 2, this.scale.height - 28, "W thrust | A/D tilt | S stabilizer | R retry landing", {
        color: "rgba(251,247,236,0.72)",
        fontFamily: "monospace",
        fontSize: "13px",
      })
      .setOrigin(0.5)
      .setDepth(41);
  }

  private createTouchControls(width: number, height: number): void {
    this.touchPads = [];
    const panelWidth = Math.min(430, width * 0.42);
    const panelGap = 16;
    const zoneWidth = (panelWidth - panelGap) / 2;
    const zoneHeight = 230;
    const zoneTop = height - zoneHeight;
    const rightPanelX = width - panelWidth;

    this.createTouchButton(new Phaser.Geom.Rectangle(0, zoneTop, zoneWidth, zoneHeight), "<", "tilt left", "rotateLeft");
    this.createTouchButton(
      new Phaser.Geom.Rectangle(zoneWidth + panelGap, zoneTop, zoneWidth, zoneHeight),
      ">",
      "tilt right",
      "rotateRight",
    );
    this.createTouchButton(
      new Phaser.Geom.Rectangle(rightPanelX, zoneTop, zoneWidth, zoneHeight),
      "S",
      "stabilize",
      "stabilizer",
      colors.duskBlue,
    );
    this.createTouchButton(
      new Phaser.Geom.Rectangle(rightPanelX + zoneWidth + panelGap, zoneTop, zoneWidth, zoneHeight),
      "^",
      "bottom thrust",
      "thrust",
      colors.terracotta,
    );
  }

  private createTouchButton(
    hitArea: Phaser.Geom.Rectangle,
    glyph: string,
    label: string,
    control: LandingTouchControlKey,
    accent: string = colors.ember,
  ): void {
    const x = hitArea.x + hitArea.width / 2;
    const y = hitArea.y + hitArea.height / 2;
    const radius = 44;
    const group = this.add.container(x, y).setDepth(50);
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
    this.touchPads.push({ control, hitArea, active: false, bg, ring, group });
  }

  private readControls(): LandingControls {
    return {
      thrust: this.keys.W.isDown || this.keys.UP.isDown || this.touchControls.thrust,
      rotateLeft: this.keys.A.isDown || this.keys.LEFT.isDown || this.touchControls.rotateLeft,
      rotateRight: this.keys.D.isDown || this.keys.RIGHT.isDown || this.touchControls.rotateRight,
      stabilizer: this.keys.S.isDown || this.keys.DOWN.isDown || this.touchControls.stabilizer,
    };
  }

  private updateTouchControlState(): void {
    const next: LandingControls = {
      thrust: false,
      rotateLeft: false,
      rotateRight: false,
      stabilizer: false,
    };

    for (const pointer of this.input.manager.pointers) {
      if (!pointer.isDown) continue;

      const pad = this.touchPads.find((candidate) => Phaser.Geom.Rectangle.Contains(candidate.hitArea, pointer.x, pointer.y));
      if (pad) next[pad.control] = true;
    }

    this.touchControls = next;
    this.updateTouchPadVisuals();
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

  private handleTouchdown(time: number): void {
    const touchdown = classifyLandingTouchdown(this.landingState, this.pad);
    if (touchdown.kind === "none") return;

    if (touchdown.kind === "incident") {
      this.packageCondition = applyPackageConditionEvent(this.packageCondition, "landing-incident");
      this.landingIncidents += 1;
      this.phase = { kind: "incident", startedAtMs: time };
      this.ship.setIncidentFrame(1);
      this.createIncidentParticles(this.landingState.x, this.landingState.y);
      return;
    }

    if (touchdown.kind === "bumpy") {
      this.packageCondition = applyPackageConditionEvent(this.packageCondition, "bumpy-landing");
    }
    this.landingState = pinStateToLandingPad(this.landingState, this.pad);
    this.phase = { kind: "settling", startedAtMs: time, result: touchdown.kind };
  }

  private updateIncident(time: number): void {
    if (this.phase.kind !== "incident") return;

    const elapsed = time - this.phase.startedAtMs;
    const frame = clamp(Math.floor(elapsed / 120) + 1, 1, 5);
    this.ship.setIncidentFrame(frame);

    if (elapsed >= landingTuning.incidentRestartMs) {
      this.restartLandingAttempt();
    }
  }

  private updateSettling(time: number): void {
    if (this.phase.kind !== "settling") return;

    this.landingState = pinStateToLandingPad(this.landingState, this.pad);
    if (time - this.phase.startedAtMs < landingTuning.settleDurationMs || this.delivered) return;

    this.delivered = true;
    this.phase = { kind: "delivered", result: this.phase.result };
    this.scene.start("DeliveryResultScene", this.resultData(this.phase.result));
  }

  private restartLandingAttempt(): void {
    this.landingState = createLandingState();
    this.phase = { kind: "descending" };
    this.ship.setKinematicState(this.toShipState(this.landingState), false);
  }

  private keepShipInsideView(): void {
    const radius = landingTuning.shipRadius;
    this.landingState = {
      ...this.landingState,
      x: clamp(this.landingState.x, radius, this.scale.width - radius),
      y: clamp(this.landingState.y, radius, this.pad.surfaceY - radius + 18),
    };
  }

  private updateShipVisual(thrusting: boolean): void {
    this.ship.setKinematicState(this.toShipState(this.landingState), thrusting);
  }

  private updateDashboard(): void {
    const altitude = Math.max(0, this.pad.surfaceY - (this.landingState.y + landingTuning.shipRadius));
    const angle = radiansToDegrees(absoluteAngleDifferenceRadians(this.landingState.rotation, 0));
    const note = this.dashboardNote();

    this.dashboardText.setText([
      "tea moon landing",
      `phase     ${this.phase.kind}`,
      `v-speed   ${this.landingState.velocityY.toFixed(0).padStart(4, " ")} px/s`,
      `h-drift   ${Math.abs(this.landingState.velocityX).toFixed(0).padStart(4, " ")} px/s`,
      `angle     ${angle.toFixed(0).padStart(3, " ")} deg`,
      `altitude  ${altitude.toFixed(0).padStart(4, " ")} px`,
      `package   ${packageConditionLabel(this.packageCondition)}`,
      `note      ${note}`,
    ]);
  }

  private dashboardNote(): string {
    if (this.phase.kind === "incident") return "dumpling bottom lost the argument";
    if (this.phase.kind === "settling") return "landing blanket engaged";
    if (this.touchControls.thrust || this.keys?.W.isDown || this.keys?.UP.isDown) return "single-thruster confidence: moderate";
    if (Math.abs(this.landingState.rotation) > 0.45) return "bottom not pointed at problem";
    return "please apply soup-facing thrust";
  }

  private resultData(landingResult: LandingResultKind): DeliveryResultSceneData {
    return {
      ...this.sceneData,
      packageCondition: this.packageCondition,
      landingResult,
      landingIncidents: this.landingIncidents,
    };
  }

  private createIncidentParticles(x: number, y: number): void {
    const palette = [colors.ember, colors.plaster, colors.sage, colors.terracotta];

    for (let i = 0; i < 16; i += 1) {
      const angle = (i / 16) * Math.PI * 2;
      const distance = Phaser.Math.Between(34, 98);
      const dot = this.add
        .circle(x, y, Phaser.Math.Between(3, 7), this.colorNumber(palette[i % palette.length]), 0.86)
        .setDepth(18);

      this.tweens.add({
        targets: dot,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        scale: 0.3,
        duration: 520,
        ease: "Quad.easeOut",
        onComplete: () => dot.destroy(),
      });
    }
  }

  private toShipState(state: LandingKinematicState): ShipKinematicState {
    return {
      x: state.x,
      y: state.y,
      rotation: state.rotation,
      velocityX: state.velocityX,
      velocityY: state.velocityY,
    };
  }

  private colorNumber(value: string): number {
    return Phaser.Display.Color.HexStringToColor(value).color;
  }
}
