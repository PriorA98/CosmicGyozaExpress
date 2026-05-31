import Phaser from "phaser";
import { TEA_MOON_MISSION_ID } from "../data/missions";
import { landingTuning } from "../data/tuning";
import { GyozaShip } from "../entities/GyozaShip";
import { colors } from "../game/designTokens";
import {
  classifyLandingIncident,
  classifyLandingTouchdown,
  createLandingState,
  createTeaMoonLandingPad,
  integrateLandingMovement,
  pinStateToLandingPad,
} from "../systems/LandingSystem";
import { applyPackageConditionEvent, packageConditionLabel } from "../systems/PackageConditionSystem";
import { bottomVector } from "../systems/ShipMovementSystem";
import type {
  DeliveryResultSceneData,
  LandingControls,
  LandingIncidentKind,
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
      const incidentKind = classifyLandingIncident(touchdown);
      this.packageCondition = applyPackageConditionEvent(this.packageCondition, "landing-incident");
      this.landingIncidents += 1;
      this.phase = { kind: "incident", startedAtMs: time, incidentKind };
      this.startLandingIncidentAnimation(incidentKind);
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
    const frameStartMs = this.incidentFrameStartMs(this.phase.incidentKind);

    if (elapsed >= frameStartMs) {
      const frame = clamp(Math.floor((elapsed - frameStartMs) / 115) + 1, 1, 5);
      this.ship.setIncidentFrame(frame);
    }

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
    this.tweens.killTweensOf(this.ship);
    this.landingState = createLandingState();
    this.phase = { kind: "descending" };
    this.ship.setVisible(true).setAlpha(1).setScale(0.72);
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
    const phaseLabel = this.phase.kind === "incident" ? `incident/${this.phase.incidentKind}` : this.phase.kind;

    this.dashboardText.setText([
      "tea moon landing",
      `phase     ${phaseLabel}`,
      `v-speed   ${this.landingState.velocityY.toFixed(0).padStart(4, " ")} px/s`,
      `h-drift   ${Math.abs(this.landingState.velocityX).toFixed(0).padStart(4, " ")} px/s`,
      `angle     ${angle.toFixed(0).padStart(3, " ")} deg`,
      `altitude  ${altitude.toFixed(0).padStart(4, " ")} px`,
      `package   ${packageConditionLabel(this.packageCondition)}`,
      `note      ${note}`,
    ]);
  }

  private dashboardNote(): string {
    if (this.phase.kind === "incident") return this.incidentNote(this.phase.incidentKind);
    if (this.phase.kind === "settling") return "landing blanket engaged";
    if (this.touchControls.thrust || this.keys?.W.isDown || this.keys?.UP.isDown) return "single-thruster confidence: moderate";
    if (Math.abs(this.landingState.rotation) > 0.45) return "bottom not pointed at problem";
    return "please apply soup-facing thrust";
  }

  private incidentNote(kind: LandingIncidentKind): string {
    switch (kind) {
      case "hard-drop":
        return "moon blanket says: softer, please";
      case "skid":
        return "sideways soup maneuver detected";
      case "tilt-tip":
        return "bottom thruster argued with geometry";
      case "off-pad":
        return "landing blanket missed the snack";
    }
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

  private startLandingIncidentAnimation(kind: LandingIncidentKind): void {
    this.tweens.killTweensOf(this.ship);
    this.ship.setVisible(true).setAlpha(1).setScale(0.72);
    this.ship.setKinematicState(this.toShipState(this.landingState), false);

    switch (kind) {
      case "hard-drop":
        this.animateHardDropIncident();
        return;
      case "skid":
        this.animateSkidIncident();
        return;
      case "tilt-tip":
        this.animateTiltTipIncident();
        return;
      case "off-pad":
        this.animateOffPadIncident();
        return;
    }
  }

  private animateHardDropIncident(): void {
    const impactX = this.landingState.x;
    const impactY = this.pad.surfaceY - landingTuning.shipRadius + 8;
    const direction = this.incidentTiltDirection();

    this.ship.setPosition(impactX, impactY);
    this.createImpactDust(impactX, this.pad.surfaceY, 22, 126);
    this.createShockRing(impactX, this.pad.surfaceY - 4, colors.ember);

    this.tweens.add({
      targets: this.ship,
      y: impactY + 12,
      scaleX: 0.92,
      scaleY: 0.54,
      duration: 92,
      ease: "Quad.easeIn",
      onComplete: () => {
        this.createImpactDust(impactX, this.pad.surfaceY, 16, 94);
        this.createThrusterMisfire(impactX, impactY, this.landingState.rotation);
        this.tweens.add({
          targets: this.ship,
          y: impactY - 18,
          rotation: this.landingState.rotation + direction * 0.34,
          scaleX: 0.74,
          scaleY: 0.78,
          duration: 230,
          ease: "Back.easeOut",
        });
      },
    });
  }

  private animateSkidIncident(): void {
    const direction = this.incidentHorizontalDirection();
    const startX = this.landingState.x;
    const startY = this.pad.surfaceY - landingTuning.shipRadius + 10;
    const endX = clamp(startX + direction * 164, landingTuning.shipRadius, this.scale.width - landingTuning.shipRadius);

    this.ship.setPosition(startX, startY);
    this.createImpactDust(startX, this.pad.surfaceY, 14, 82);
    this.createShockRing(startX, this.pad.surfaceY - 3, colors.terracotta);

    this.time.addEvent({
      delay: 62,
      repeat: 6,
      callback: () => this.createSkidDust(this.ship.x - direction * 34, this.pad.surfaceY - 5, direction),
    });

    this.tweens.add({
      targets: this.ship,
      x: endX,
      y: startY + 8,
      rotation: this.landingState.rotation + direction * 1.18,
      scaleX: 0.8,
      scaleY: 0.62,
      duration: 470,
      ease: "Cubic.easeOut",
      onComplete: () => {
        this.createThrusterMisfire(this.ship.x, this.ship.y, this.ship.rotation);
      },
    });
  }

  private animateTiltTipIncident(): void {
    const direction = this.incidentTiltDirection();
    const startX = this.landingState.x;
    const startY = this.pad.surfaceY - landingTuning.shipRadius + 12;

    this.ship.setPosition(startX, startY);
    this.createImpactDust(startX, this.pad.surfaceY, 12, 78);

    this.tweens.add({
      targets: this.ship,
      x: clamp(startX + direction * 62, landingTuning.shipRadius, this.scale.width - landingTuning.shipRadius),
      y: startY + 18,
      rotation: direction * 1.38,
      scaleX: 0.72,
      scaleY: 0.72,
      duration: 360,
      ease: "Back.easeOut",
      onComplete: () => {
        this.createShockRing(this.ship.x, this.pad.surfaceY - 4, colors.plum);
        this.createThrusterMisfire(this.ship.x, this.ship.y, this.ship.rotation);
      },
    });
  }

  private animateOffPadIncident(): void {
    const direction = this.incidentHorizontalDirection();
    const startX = clamp(this.landingState.x, landingTuning.shipRadius, this.scale.width - landingTuning.shipRadius);
    const startY = this.pad.surfaceY - landingTuning.shipRadius + 12;

    this.ship.setPosition(startX, startY);
    this.createImpactDust(startX, this.pad.surfaceY, 26, 118);
    this.createShockRing(startX, this.pad.surfaceY - 4, colors.duskBlue);

    this.tweens.add({
      targets: this.ship,
      x: clamp(startX + direction * 28, landingTuning.shipRadius, this.scale.width - landingTuning.shipRadius),
      y: startY + 58,
      alpha: 0.42,
      rotation: this.landingState.rotation + direction * 0.72,
      scaleX: 0.58,
      scaleY: 0.58,
      duration: 520,
      ease: "Quad.easeIn",
      onComplete: () => {
        this.createImpactDust(this.ship.x, this.pad.surfaceY + 8, 12, 76);
      },
    });
  }

  private createImpactDust(x: number, y: number, count: number, spread: number): void {
    const palette = [colors.parchment, colors.duskBlue, colors.terracotta, colors.plaster];

    for (let i = 0; i < count; i += 1) {
      const angle = Phaser.Math.FloatBetween(Math.PI * 1.05, Math.PI * 1.95);
      const distance = Phaser.Math.Between(24, spread);
      const dot = this.add
        .circle(x, y, Phaser.Math.Between(3, 8), this.colorNumber(palette[i % palette.length]), 0.76)
        .setDepth(18);

      this.tweens.add({
        targets: dot,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        scale: 0.36,
        duration: Phaser.Math.Between(360, 620),
        ease: "Quad.easeOut",
        onComplete: () => dot.destroy(),
      });
    }
  }

  private createSkidDust(x: number, y: number, direction: number): void {
    for (let i = 0; i < 5; i += 1) {
      const dust = this.add
        .circle(x, y + Phaser.Math.Between(-4, 6), Phaser.Math.Between(2, 5), this.colorNumber(colors.parchment), 0.58)
        .setDepth(17);

      this.tweens.add({
        targets: dust,
        x: x - direction * Phaser.Math.Between(18, 54),
        y: y - Phaser.Math.Between(10, 36),
        alpha: 0,
        scale: 0.42,
        duration: Phaser.Math.Between(260, 460),
        ease: "Quad.easeOut",
        onComplete: () => dust.destroy(),
      });
    }
  }

  private createShockRing(x: number, y: number, color: string): void {
    const ring = this.add.circle(x, y, 10, 0xffffff, 0).setStrokeStyle(2, this.colorNumber(color), 0.66).setDepth(17);

    this.tweens.add({
      targets: ring,
      scale: 5.4,
      alpha: 0,
      duration: 390,
      ease: "Quad.easeOut",
      onComplete: () => ring.destroy(),
    });
  }

  private createThrusterMisfire(x: number, y: number, rotation: number): void {
    const bottom = bottomVector(rotation);
    const startX = x + bottom.x * 36;
    const startY = y + bottom.y * 36;
    const baseAngle = Math.atan2(bottom.y, bottom.x);
    const palette = [colors.ember, colors.terracotta, colors.plaster];

    for (let i = 0; i < 11; i += 1) {
      const angle = baseAngle + Phaser.Math.FloatBetween(-0.58, 0.58);
      const distance = Phaser.Math.Between(28, 88);
      const spark = this.add
        .rectangle(
          startX,
          startY,
          Phaser.Math.Between(3, 6),
          Phaser.Math.Between(8, 16),
          this.colorNumber(palette[i % palette.length]),
          0.82,
        )
        .setRotation(angle)
        .setDepth(19);

      this.tweens.add({
        targets: spark,
        x: startX + Math.cos(angle) * distance,
        y: startY + Math.sin(angle) * distance,
        alpha: 0,
        scale: 0.28,
        duration: Phaser.Math.Between(260, 500),
        ease: "Quad.easeOut",
        onComplete: () => spark.destroy(),
      });
    }
  }

  private incidentFrameStartMs(kind: LandingIncidentKind): number {
    switch (kind) {
      case "hard-drop":
        return 360;
      case "skid":
        return 520;
      case "tilt-tip":
        return 470;
      case "off-pad":
        return 560;
    }
  }

  private incidentHorizontalDirection(): number {
    const velocityDirection = Math.sign(this.landingState.velocityX);
    if (velocityDirection !== 0) return velocityDirection;

    const positionDirection = Math.sign(this.landingState.x - this.pad.centerX);
    return positionDirection === 0 ? 1 : positionDirection;
  }

  private incidentTiltDirection(): number {
    const rotationDirection = Math.sign(this.landingState.rotation);
    if (rotationDirection !== 0) return rotationDirection;

    const angularDirection = Math.sign(this.landingState.angularVelocity);
    if (angularDirection !== 0) return angularDirection;

    return this.incidentHorizontalDirection();
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
