import Phaser from "phaser";
import { TEA_MOON_MISSION_ID } from "../data/missions";
import { collisionTuning, dockingTuning, respawnTuning, shipTuning, cameraTuning } from "../data/tuning";
import { flightPrototypeRoute } from "../data/flightPrototypeRoute";
import { installDevSceneHotkeys } from "../dev/DevSceneLauncher";
import { GyozaShip } from "../entities/GyozaShip";
import { colors } from "../game/designTokens";
import {
  createArrivalGateState,
  updateArrivalGate,
  type ArrivalGateState,
} from "../systems/ArrivalGateSystem";
import {
  classifyCollision,
  findFirstCollision,
  resolveCircleCollision,
} from "../systems/CollisionSystem";
import { dockingHint, dockingStatusLabel, evaluateDocking } from "../systems/DockingSystem";
import { applyPackageConditionEvent, packageConditionLabel } from "../systems/PackageConditionSystem";
import {
  bottomFacingRadians,
  bottomVector,
  directionVector,
  integrateShipMovement,
} from "../systems/ShipMovementSystem";
import type { CollisionSeverity, DockingState, ShipControls, ShipKinematicState } from "../types/flight";
import { clamp, radiansToCompassDegrees, vectorLength } from "../utils/math";

type FlightKeys = {
  readonly W: Phaser.Input.Keyboard.Key;
  readonly A: Phaser.Input.Keyboard.Key;
  readonly S: Phaser.Input.Keyboard.Key;
  readonly D: Phaser.Input.Keyboard.Key;
  readonly UP: Phaser.Input.Keyboard.Key;
  readonly LEFT: Phaser.Input.Keyboard.Key;
  readonly DOWN: Phaser.Input.Keyboard.Key;
  readonly RIGHT: Phaser.Input.Keyboard.Key;
  readonly R: Phaser.Input.Keyboard.Key;
  readonly F1: Phaser.Input.Keyboard.Key;
  readonly BACKTICK: Phaser.Input.Keyboard.Key;
  readonly ESC: Phaser.Input.Keyboard.Key;
};

type TouchControlKey = keyof ShipControls;

type TouchControlPad = {
  readonly control: TouchControlKey;
  readonly hitArea: Phaser.Geom.Rectangle;
  active: boolean;
  readonly bg: Phaser.GameObjects.Arc;
  readonly ring: Phaser.GameObjects.Arc;
  readonly group: Phaser.GameObjects.Container;
};

type FlightMode =
  | { readonly kind: "flying" }
  | {
      readonly kind: "incident";
      readonly startedAtMs: number;
      readonly respawnAtMs: number;
      readonly resumeAtMs: number;
      hasRespawned: boolean;
    };

type BoundsResolution = {
  readonly state: ShipKinematicState;
  readonly severity: CollisionSeverity;
};

const route = flightPrototypeRoute;

export class FlightScene extends Phaser.Scene {
  private ship!: GyozaShip;
  private keys!: FlightKeys;
  private dashboardPanel!: Phaser.GameObjects.Rectangle;
  private dashboardText!: Phaser.GameObjects.Text;
  private controlsText!: Phaser.GameObjects.Text;
  private destinationGraphics!: Phaser.GameObjects.Graphics;
  private destinationGuideText!: Phaser.GameObjects.Text;
  private debugGraphics!: Phaser.GameObjects.Graphics;
  private destinationArrow!: Phaser.GameObjects.Text;
  private touchControls: ShipControls = {
    thrust: false,
    brake: false,
    rotateLeft: false,
    rotateRight: false,
  };
  private touchPads: TouchControlPad[] = [];
  private flightMode: FlightMode = { kind: "flying" };
  private packageCondition = 100;
  private debugVisible = true;
  private lastDashboardLine = "tea moon beacon is humming";
  private dashboardLineUntilMs = 0;
  private badDockCooldownUntilMs = 0;
  private collisionCooldownUntilMs = 0;
  private invulnerableUntilMs = 0;
  private arrivalGate: ArrivalGateState = createArrivalGateState();
  private hasStartedLanding = false;
  private routeStartedAtMs = 0;
  private routeCrashes = 0;

  constructor() {
    super("FlightScene");
  }

  create(): void {
    const { width, height } = this.scale;

    this.input.addPointer(5);
    this.createWorld();
    this.createDestinationGraphics();
    this.createObstacles();

    this.ship = new GyozaShip(this, route.start);

    this.cameras.main.setBounds(0, 0, route.world.width, route.world.height);
    this.cameras.main.centerOn(route.start.x, route.start.y);
    this.cameras.main.startFollow(this.ship, true, cameraTuning.followLerpX, cameraTuning.followLerpY);

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
      F1: Phaser.Input.Keyboard.KeyCodes.F1,
      BACKTICK: Phaser.Input.Keyboard.KeyCodes.BACKTICK,
      ESC: Phaser.Input.Keyboard.KeyCodes.ESC,
    }) as FlightKeys;
    installDevSceneHotkeys(this);

    this.createDashboard(width, height);
    this.createTouchControls(width, height);
    this.debugGraphics = this.add.graphics().setDepth(25);

    this.restartFlight(this.time.now);
  }

  override update(time: number, delta: number): void {
    this.updateTouchControlState();
    this.handleUtilityKeys(time);

    const docking = evaluateDocking(this.ship.kinematics, route.destination);
    this.updateDestinationGraphics(docking);
    this.updateDestinationArrow(docking);

    if (this.flightMode.kind === "incident") {
      this.updateIncident(time);
      this.updateDashboard(docking, time);
      this.updateDebugGraphics();
      return;
    }

    const controls = this.readControls();
    const moved = integrateShipMovement(this.ship.kinematics, controls, delta / 1000);
    const bounded = this.resolveWorldBounds(moved);
    this.ship.setKinematicState(bounded.state, controls.thrust);
    this.handleBoundsCollision(bounded.severity, time);

    if (time >= this.invulnerableUntilMs) {
      this.handleObstacleCollision(time, controls.thrust);
      this.handleBadDocking(evaluateDocking(this.ship.kinematics, route.destination), time);
    }

    const nextDocking = evaluateDocking(this.ship.kinematics, route.destination);
    this.updateArrivalGate(nextDocking, time);
    this.updateDestinationGraphics(nextDocking);
    this.updateDestinationArrow(nextDocking);
    this.updateDashboard(nextDocking, time);
    this.updateDebugGraphics();
  }

  private createWorld(): void {
    this.add.rectangle(0, 0, route.world.width, route.world.height, 0x1a1b2e).setOrigin(0, 0);
    this.add
      .rectangle(0, 0, route.world.width, route.world.height, 0x0e0f1c, 0.34)
      .setOrigin(0, 0);

    for (let i = 0; i < 430; i += 1) {
      const x = Phaser.Math.Between(0, route.world.width);
      const y = Phaser.Math.Between(0, route.world.height);
      const size = Phaser.Math.Between(1, 2);
      const alpha = Phaser.Math.FloatBetween(0.2, 0.88);
      this.add.rectangle(x, y, size, size, 0xfbf7ec, alpha);
    }

    for (const planet of route.backgroundPlanets) {
      this.add.image(planet.x, planet.y, planet.textureKey).setScale(planet.scale).setAlpha(planet.alpha);
    }
  }

  private createDestinationGraphics(): void {
    this.destinationGraphics = this.add.graphics().setDepth(8);
    this.destinationGuideText = this.add
      .text(0, 0, "ship bottom", {
        color: colors.ember,
        fontFamily: "monospace",
        fontSize: "12px",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(9);
    this.destinationArrow = this.add
      .text(0, 0, ">", {
        color: colors.ember,
        fontFamily: "monospace",
        fontSize: "34px",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(45)
      .setScrollFactor(0);
  }

  private createObstacles(): void {
    for (const obstacle of route.obstacles) {
      const fill = this.add.circle(obstacle.x, obstacle.y, obstacle.radius, 0x3d3e4d, 0.88);
      fill.setStrokeStyle(3, this.colorNumber(colors.duskBlue), 0.34);
      this.add.circle(
        obstacle.x - obstacle.radius * 0.22,
        obstacle.y - obstacle.radius * 0.28,
        Math.max(8, obstacle.radius * 0.18),
        0xf4ecdc,
        0.13,
      );
      this.add.circle(
        obstacle.x + obstacle.radius * 0.16,
        obstacle.y + obstacle.radius * 0.2,
        Math.max(6, obstacle.radius * 0.14),
        0x0e0f1c,
        0.18,
      );
    }
  }

  private createDashboard(width: number, height: number): void {
    this.dashboardPanel = this.add
      .rectangle(18, 18, 390, 178, this.colorNumber(colors.cosmosPanel), 0.82)
      .setOrigin(0, 0)
      .setDepth(40)
      .setScrollFactor(0);
    this.dashboardPanel.setStrokeStyle(1, 0xfbf7ec, 0.22);

    this.dashboardText = this.add
      .text(34, 30, "", {
        color: colors.plaster,
        fontFamily: "monospace",
        fontSize: "13px",
        lineSpacing: 5,
      })
      .setDepth(41)
      .setScrollFactor(0);

    this.controlsText = this.add
      .text(width / 2, height - 28, "W/S/A/D or arrows to fly | R restart | F1/backtick debug", {
        color: "rgba(251,247,236,0.72)",
        fontFamily: "monospace",
        fontSize: "13px",
      })
      .setOrigin(0.5)
      .setDepth(41)
      .setScrollFactor(0);
  }

  private createTouchControls(width: number, height: number): void {
    this.touchPads = [];

    const panelWidth = Math.min(430, width * 0.42);
    const panelGap = 16;
    const zoneWidth = (panelWidth - panelGap) / 2;
    const zoneHeight = 250;
    const zoneTop = height - zoneHeight;
    const rightPanelX = width - panelWidth;

    this.createTouchButton(new Phaser.Geom.Rectangle(0, zoneTop, zoneWidth, zoneHeight), "<", "rotate left", "rotateLeft");
    this.createTouchButton(
      new Phaser.Geom.Rectangle(zoneWidth + panelGap, zoneTop, zoneWidth, zoneHeight),
      ">",
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
      "^",
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
    const group = this.add.container(x, y).setDepth(50).setScrollFactor(0);
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

  private handleUtilityKeys(time: number): void {
    if (Phaser.Input.Keyboard.JustDown(this.keys.R)) {
      this.restartFlight(time);
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.F1) || Phaser.Input.Keyboard.JustDown(this.keys.BACKTICK)) {
      this.debugVisible = !this.debugVisible;
      this.setDashboardLine(this.debugVisible ? "debug vectors on" : "debug vectors tucked away", time);
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) {
      this.setDashboardLine("pause menu is still in the pantry", time);
    }
  }

  private readControls(): ShipControls {
    if (this.flightMode.kind !== "flying") {
      return {
        thrust: false,
        brake: false,
        rotateLeft: false,
        rotateRight: false,
      };
    }

    return {
      thrust: this.keys.W.isDown || this.keys.UP.isDown || this.touchControls.thrust,
      brake: this.keys.S.isDown || this.keys.DOWN.isDown || this.touchControls.brake,
      rotateLeft: this.keys.A.isDown || this.keys.LEFT.isDown || this.touchControls.rotateLeft,
      rotateRight: this.keys.D.isDown || this.keys.RIGHT.isDown || this.touchControls.rotateRight,
    };
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

      const pad = this.findTouchedPad(pointer.x, pointer.y);
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

  private resolveWorldBounds(state: ShipKinematicState): BoundsResolution {
    let next = state;
    let impactSeverity: CollisionSeverity = "none";
    const radius = shipTuning.collisionRadius;

    if (next.x < radius && next.velocityX < 0) {
      impactSeverity = this.strongerSeverity(impactSeverity, classifyCollision(Math.abs(next.velocityX)));
      next = { ...next, x: radius, velocityX: Math.abs(next.velocityX) * collisionTuning.boundaryBounce };
    } else if (next.x > route.world.width - radius && next.velocityX > 0) {
      impactSeverity = this.strongerSeverity(impactSeverity, classifyCollision(Math.abs(next.velocityX)));
      next = {
        ...next,
        x: route.world.width - radius,
        velocityX: -Math.abs(next.velocityX) * collisionTuning.boundaryBounce,
      };
    }

    if (next.y < radius && next.velocityY < 0) {
      impactSeverity = this.strongerSeverity(impactSeverity, classifyCollision(Math.abs(next.velocityY)));
      next = { ...next, y: radius, velocityY: Math.abs(next.velocityY) * collisionTuning.boundaryBounce };
    } else if (next.y > route.world.height - radius && next.velocityY > 0) {
      impactSeverity = this.strongerSeverity(impactSeverity, classifyCollision(Math.abs(next.velocityY)));
      next = {
        ...next,
        y: route.world.height - radius,
        velocityY: -Math.abs(next.velocityY) * collisionTuning.boundaryBounce,
      };
    }

    return {
      state: next,
      severity: impactSeverity,
    };
  }

  private handleBoundsCollision(severity: CollisionSeverity, time: number): void {
    if (severity === "none") return;

    if (severity === "gyoza-incident") {
      this.triggerIncident(time, "route wall requested a softer approach");
      return;
    }

    if (time < this.collisionCooldownUntilMs) return;

      this.applyBumpConsequence(severity, "edge bounce registered", time);
      this.collisionCooldownUntilMs = time + collisionTuning.collisionCooldownMs;
  }

  private handleObstacleCollision(time: number, thrusting: boolean): void {
    const contact = findFirstCollision(
      {
        x: this.ship.kinematics.x,
        y: this.ship.kinematics.y,
        radius: shipTuning.collisionRadius,
      },
      route.obstacles,
    );

    if (!contact) return;

    const severity = classifyCollision(this.ship.speed());
    const resolved = resolveCircleCollision(this.ship.kinematics, contact, severity);
    this.ship.setKinematicState(resolved, thrusting);

    if (severity === "gyoza-incident") {
      this.triggerIncident(time, "gyoza incident: dumpling briefly became weather");
      return;
    }

    if (time < this.collisionCooldownUntilMs) return;

    this.applyBumpConsequence(
      severity,
      severity === "soft-bump" ? "soft bump, snack morale intact" : "dramatic bump, still dinner",
      time,
    );
    this.collisionCooldownUntilMs = time + collisionTuning.collisionCooldownMs;
  }

  private handleBadDocking(docking: DockingState, time: number): void {
    if (!docking.inDeliveryZone || docking.kind === "ready") return;

    if (docking.kind === "align") {
      if (time >= this.badDockCooldownUntilMs) {
        this.setDashboardLine("point bottom at the landing guide", time);
        this.badDockCooldownUntilMs = time + dockingTuning.badDockCooldownMs;
      }
      return;
    }

    if (docking.kind !== "slow-down" || time < this.badDockCooldownUntilMs) return;

    const dx = this.ship.kinematics.x - route.destination.x;
    const dy = this.ship.kinematics.y - route.destination.y;
    const distance = Math.max(1, vectorLength(dx, dy));
    const normalX = dx / distance;
    const normalY = dy / distance;
    const next: ShipKinematicState = {
      ...this.ship.kinematics,
      x: this.ship.kinematics.x + normalX * 10,
      y: this.ship.kinematics.y + normalY * 10,
      velocityX: this.ship.kinematics.velocityX + normalX * dockingTuning.badDockBounceSpeed,
      velocityY: this.ship.kinematics.velocityY + normalY * dockingTuning.badDockBounceSpeed,
    };

    this.ship.setKinematicState(next, false);
    this.badDockCooldownUntilMs = time + dockingTuning.badDockCooldownMs;
    this.setDashboardLine("dock says: tiny brakes, please", time);
  }

  private applyBumpConsequence(severity: CollisionSeverity, line: string, time: number): void {
    if (severity === "none") return;
    if (severity === "gyoza-incident") {
      this.packageCondition = applyPackageConditionEvent(this.packageCondition, "gyoza-incident");
      this.setDashboardLine(line, time);
      return;
    }

    this.packageCondition = applyPackageConditionEvent(this.packageCondition, severity);
    this.setDashboardLine(line, time);
  }

  private triggerIncident(time: number, line: string): void {
    if (this.flightMode.kind === "incident") return;

    this.clearTouchControls();
    this.routeCrashes += 1;
    this.packageCondition = applyPackageConditionEvent(this.packageCondition, "gyoza-incident");
    this.setDashboardLine(line, time, respawnTuning.respawnDelayMs + 1200);
    this.flightMode = {
      kind: "incident",
      startedAtMs: time,
      respawnAtMs: time + respawnTuning.respawnDelayMs,
      resumeAtMs: time + respawnTuning.respawnDelayMs + 240,
      hasRespawned: false,
    };
    this.collisionCooldownUntilMs = time + respawnTuning.respawnDelayMs + collisionTuning.collisionCooldownMs;
    this.ship.setIncidentFrame(1);
    this.createIncidentParticles(this.ship.kinematics.x, this.ship.kinematics.y);
  }

  private updateIncident(time: number): void {
    if (this.flightMode.kind !== "incident") return;

    if (!this.flightMode.hasRespawned) {
      const elapsed = time - this.flightMode.startedAtMs;
      const frame = clamp(Math.floor(elapsed / respawnTuning.incidentFrameMs) + 1, 1, 5);
      this.ship.setIncidentFrame(frame);
    }

    if (!this.flightMode.hasRespawned && time >= this.flightMode.respawnAtMs) {
      this.flightMode.hasRespawned = true;
      this.ship.setKinematicState(route.checkpoint, false);
      this.invulnerableUntilMs = time + respawnTuning.invulnerableMs;
      this.setDashboardLine("gyoza reassembled. dignity optional", time);
    }

    if (time >= this.flightMode.resumeAtMs) {
      this.flightMode = { kind: "flying" };
    }
  }

  private createIncidentParticles(x: number, y: number): void {
    const palette = [colors.ember, colors.plaster, colors.sage, colors.terracotta];

    for (let i = 0; i < 18; i += 1) {
      const angle = (i / 18) * Math.PI * 2;
      const distance = Phaser.Math.Between(42, 120);
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

  private restartFlight(time: number): void {
    this.flightMode = { kind: "flying" };
    this.packageCondition = 100;
    this.routeCrashes = 0;
    this.routeStartedAtMs = time;
    this.arrivalGate = createArrivalGateState();
    this.hasStartedLanding = false;
    this.badDockCooldownUntilMs = 0;
    this.collisionCooldownUntilMs = 0;
    this.invulnerableUntilMs = time + 320;
    this.setDashboardLine("tea moon beacon is humming", time, 2200);
    this.clearTouchControls();

    if (this.ship) {
      this.ship.setKinematicState(route.start, false);
      this.cameras.main.centerOn(route.start.x, route.start.y);
    }
  }

  private updateArrivalGate(docking: DockingState, time: number): void {
    if (this.hasStartedLanding || this.flightMode.kind !== "flying") return;

    const gate = updateArrivalGate(this.arrivalGate, docking, time);
    this.arrivalGate = gate.state;

    if (docking.kind === "ready" && !gate.complete) {
      this.setDashboardLine(`bottom-side landing window ${gate.readyElapsedMs.toFixed(0)}ms`, time, 120);
    }

    if (!gate.complete) return;

    this.hasStartedLanding = true;
    this.clearTouchControls();
    this.scene.start("LandingScene", {
      missionId: TEA_MOON_MISSION_ID,
      packageCondition: this.packageCondition,
      routeCrashes: this.routeCrashes,
      routeDurationMs: Math.max(0, time - this.routeStartedAtMs),
    });
  }

  private updateDestinationGraphics(docking: DockingState): void {
    const destination = route.destination;
    const color = this.dockingColor(docking.kind);
    const textColor = this.dockingTextColor(docking.kind);
    const requiredBottom = directionVector(destination.requiredBottomFacingRadians);
    const tangent = { x: -requiredBottom.y, y: requiredBottom.x };
    const coneAngle = (dockingTuning.maxAngleDegrees * Math.PI) / 180;
    const coneLeft = directionVector(destination.requiredBottomFacingRadians - coneAngle);
    const coneRight = directionVector(destination.requiredBottomFacingRadians + coneAngle);
    const coneRadius = destination.radius * 0.95;
    const lineStartRadius = destination.radius * 0.22;
    const lineEndRadius = destination.radius + 24;
    const arrowTipRadius = destination.radius + 34;
    const arrowBaseRadius = destination.radius + 12;
    const arrowHalfWidth = 12;

    this.destinationGraphics.clear();
    this.destinationGraphics.lineStyle(1, this.colorNumber(colors.duskBlue), 0.22);
    this.destinationGraphics.strokeCircle(destination.x, destination.y, destination.approachRadius);

    this.destinationGraphics.fillStyle(color, docking.kind === "ready" ? 0.16 : 0.08);
    this.destinationGraphics.fillTriangle(
      destination.x,
      destination.y,
      destination.x + coneLeft.x * coneRadius,
      destination.y + coneLeft.y * coneRadius,
      destination.x + coneRight.x * coneRadius,
      destination.y + coneRight.y * coneRadius,
    );

    this.destinationGraphics.lineStyle(docking.kind === "ready" ? 5 : 3, color, docking.kind === "too-far" ? 0.45 : 0.9);
    this.destinationGraphics.strokeCircle(destination.x, destination.y, destination.radius);

    this.destinationGraphics.lineStyle(docking.kind === "ready" ? 5 : 4, color, 0.92);
    this.destinationGraphics.lineBetween(
      destination.x + requiredBottom.x * lineStartRadius,
      destination.y + requiredBottom.y * lineStartRadius,
      destination.x + requiredBottom.x * lineEndRadius,
      destination.y + requiredBottom.y * lineEndRadius,
    );
    this.destinationGraphics.lineStyle(2, color, 0.72);
    this.destinationGraphics.lineBetween(
      destination.x + requiredBottom.x * destination.radius - tangent.x * 18,
      destination.y + requiredBottom.y * destination.radius - tangent.y * 18,
      destination.x + requiredBottom.x * destination.radius + tangent.x * 18,
      destination.y + requiredBottom.y * destination.radius + tangent.y * 18,
    );
    this.destinationGraphics.fillStyle(color, 0.92);
    this.destinationGraphics.fillTriangle(
      destination.x + requiredBottom.x * arrowTipRadius,
      destination.y + requiredBottom.y * arrowTipRadius,
      destination.x + requiredBottom.x * arrowBaseRadius + tangent.x * arrowHalfWidth,
      destination.y + requiredBottom.y * arrowBaseRadius + tangent.y * arrowHalfWidth,
      destination.x + requiredBottom.x * arrowBaseRadius - tangent.x * arrowHalfWidth,
      destination.y + requiredBottom.y * arrowBaseRadius - tangent.y * arrowHalfWidth,
    );

    this.destinationGuideText
      .setPosition(
        destination.x + requiredBottom.x * (destination.radius + 62),
        destination.y + requiredBottom.y * (destination.radius + 62),
      )
      .setColor(textColor)
      .setAlpha(docking.kind === "too-far" ? 0.48 : 0.86);
  }

  private updateDestinationArrow(docking: DockingState): void {
    const { width, height } = this.scale;
    const camera = this.cameras.main;
    const destinationScreenX = route.destination.x - camera.scrollX;
    const destinationScreenY = route.destination.y - camera.scrollY;
    const margin = 34;
    const maxY = height - 104;
    const onScreen =
      destinationScreenX >= margin &&
      destinationScreenX <= width - margin &&
      destinationScreenY >= margin &&
      destinationScreenY <= maxY;

    this.destinationArrow.setVisible(!onScreen || docking.kind === "too-far");

    if (!this.destinationArrow.visible) return;

    const clampedX = clamp(destinationScreenX, margin, width - margin);
    const clampedY = clamp(destinationScreenY, margin, maxY);
    const angle = Math.atan2(destinationScreenY - height / 2, destinationScreenX - width / 2);

    this.destinationArrow.setPosition(clampedX, clampedY);
    this.destinationArrow.setRotation(angle);
    this.destinationArrow.setColor(docking.kind === "ready" ? colors.sage : colors.ember);
  }

  private updateDashboard(docking: DockingState, time: number): void {
    const status = dockingStatusLabel(docking);
    const condition = packageConditionLabel(this.packageCondition);
    const bottomHeading = radiansToCompassDegrees(bottomFacingRadians(this.ship.kinematics.rotation))
      .toString()
      .padStart(3, "0");
    const modeLine = this.flightMode.kind === "incident" ? "incident" : "flying";
    const note = time < this.dashboardLineUntilMs ? this.lastDashboardLine : dockingHint(docking);

    this.dashboardText.setText([
      "tea moon route",
      `mode      ${modeLine}`,
      `speed     ${this.ship.speed().toFixed(0).padStart(3, " ")} px/s`,
      `distance  ${docking.distance.toFixed(0).padStart(4, " ")} px`,
      `bottom    ${bottomHeading} deg`,
      `arrival   ${status}`,
      `package   ${condition}`,
      `note      ${note}`,
    ]);
  }

  private setDashboardLine(line: string, time: number, durationMs = 1800): void {
    this.lastDashboardLine = line;
    this.dashboardLineUntilMs = time + durationMs;
  }

  private updateDebugGraphics(): void {
    this.debugGraphics.clear();
    if (!this.debugVisible) return;

    const state = this.ship.kinematics;
    const bottom = bottomVector(state.rotation);
    const velocityScale = 0.46;

    this.debugGraphics.lineStyle(1, 0xfbf7ec, 0.2);
    this.debugGraphics.strokeRect(0, 0, route.world.width, route.world.height);

    this.debugGraphics.lineStyle(2, this.colorNumber(colors.sage), 0.92);
    this.debugGraphics.lineBetween(state.x, state.y, state.x + bottom.x * 118, state.y + bottom.y * 118);

    this.debugGraphics.lineStyle(2, this.colorNumber(colors.ember), 0.92);
    this.debugGraphics.lineBetween(
      state.x,
      state.y,
      state.x + state.velocityX * velocityScale,
      state.y + state.velocityY * velocityScale,
    );

    this.debugGraphics.lineStyle(1, this.colorNumber(colors.plum), 0.62);
    this.debugGraphics.strokeCircle(state.x, state.y, shipTuning.collisionRadius);

    this.debugGraphics.lineStyle(1, this.colorNumber(colors.duskBlue), 0.46);
    for (const obstacle of route.obstacles) {
      this.debugGraphics.strokeCircle(obstacle.x, obstacle.y, obstacle.radius);
    }
  }

  private dockingColor(kind: DockingState["kind"]): number {
    switch (kind) {
      case "too-far":
        return this.colorNumber(colors.duskBlue);
      case "approaching":
        return this.colorNumber(colors.ember);
      case "slow-down":
        return this.colorNumber(colors.brick);
      case "align":
        return this.colorNumber(colors.plum);
      case "ready":
        return this.colorNumber(colors.sage);
    }
  }

  private dockingTextColor(kind: DockingState["kind"]): string {
    switch (kind) {
      case "too-far":
        return colors.duskBlue;
      case "approaching":
        return colors.ember;
      case "slow-down":
        return colors.brick;
      case "align":
        return colors.plum;
      case "ready":
        return colors.sage;
    }
  }

  private strongerSeverity(a: CollisionSeverity, b: CollisionSeverity): CollisionSeverity {
    return this.severityRank(b) > this.severityRank(a) ? b : a;
  }

  private severityRank(severity: CollisionSeverity): number {
    switch (severity) {
      case "none":
        return 0;
      case "soft-bump":
        return 1;
      case "dramatic-bump":
        return 2;
      case "gyoza-incident":
        return 3;
    }
  }

  private colorNumber(value: string): number {
    return Phaser.Display.Color.HexStringToColor(value).color;
  }
}
