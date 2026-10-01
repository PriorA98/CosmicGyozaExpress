import Phaser from "phaser";
import { ASSET } from "../data/assetManifest";
import { landingCopy, landingScenery, landingZoneColors } from "../data/landingScenery";
import { landingTuning } from "../data/landingTuning";
import { TEA_MOON_MISSION_ID } from "../data/missions";
import { installDevSceneHotkeys } from "../dev/DevSceneLauncher";
import { registerDevState } from "../dev/devProbe";
import { GyozaShip } from "../entities/GyozaShip";
import { LandingAids } from "../entities/landing/LandingAids";
import { showLandingCaption } from "../entities/landing/LandingCaption";
import { createLandingControlsHint, LandingDashboard, type LandingDashboardView } from "../entities/landing/LandingDashboard";
import { LandingPadSite } from "../entities/landing/LandingPadSite";
import { LandingTouchPads } from "../entities/landing/LandingTouchPads";
import { LunarScenery } from "../entities/landing/LunarScenery";
import { MoonRabbit } from "../entities/landing/MoonRabbit";
import { measureFootOffset } from "../entities/landing/shipFootprint";
import {
  burstDust,
  burstIncident,
  burstSparkles,
  createThrustTrail,
  shakeCamera,
  type ThrustTrail,
} from "../fx/feedback";
import { colorNumber, colors, depth, motion } from "../game/designTokens";
import { emitGameEvent } from "../game/events";
import {
  classifyLandingIncident,
  classifyLandingTouchdown,
  createLandingState,
  createTeaMoonLandingPad,
  descentZone,
  driftZone,
  integrateLandingMovement,
  padAlignment,
  pinStateToLandingPad,
  readLandingZone,
  tiltZone,
  type LandingPadAlignment,
  type LandingZoneReading,
} from "../systems/LandingSystem";
import { applyPackageConditionEvent, packageConditionLabel } from "../systems/PackageConditionSystem";
import { bottomVector } from "../systems/ShipMovementSystem";
import type { ShipKinematicState } from "../types/flight";
import type {
  DeliveryResultSceneData,
  LandingControls,
  LandingIncidentKind,
  LandingKinematicState,
  LandingPadDefinition,
  LandingPhase,
  LandingResultKind,
  LandingSceneData,
  LandingSceneInit,
} from "../types/landing";
import { clamp } from "../utils/math";

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

type Tweenable = { value: number };

const NO_CONTROLS: LandingControls = { thrust: false, rotateLeft: false, rotateRight: false, stabilizer: false };
/** How long after a retry the dashboard keeps its "fresh attempt" note. */
const RETRY_NOTE_MS = 1600;
/** Share of the soft tilt limit at which the dashboard starts nagging about tilt. */
const TILT_NOTE_RATIO = 0.75;

export class LandingScene extends Phaser.Scene {
  private sceneData: LandingSceneData = {
    missionId: TEA_MOON_MISSION_ID,
    packageCondition: 100,
    routeCrashes: 0,
    routeDurationMs: 0,
  };
  private keys: LandingKeys | undefined;
  private ship!: GyozaShip;
  private scenery!: LunarScenery;
  private padSite!: LandingPadSite;
  private rabbit!: MoonRabbit;
  private aids!: LandingAids;
  private dashboard!: LandingDashboard;
  private touchPads: LandingTouchPads | undefined;
  private thrustTrail!: ThrustTrail;
  private caption: Phaser.GameObjects.Container | undefined;
  private pad: LandingPadDefinition = createTeaMoonLandingPad();
  private landingState: LandingKinematicState = createLandingState();
  private phase: LandingPhase = { kind: "intro" };
  private reading!: LandingZoneReading;
  private alignment!: LandingPadAlignment;
  private controls: LandingControls = NO_CONTROLS;
  private footOffset = 0;
  private readonly squash: Tweenable = { value: 0 };
  private readonly settleTilt: Tweenable = { value: 0 };
  private thrustHeld = false;
  private stabilizerHeld = false;
  private retryAtMs = Number.NEGATIVE_INFINITY;
  private packageCondition = 100;
  private landingIncidents = 0;
  private delivered = false;
  private startOverride: LandingKinematicState | undefined;

  constructor() {
    super("LandingScene");
  }

  init(data: Partial<LandingSceneInit>): void {
    this.startOverride = data.start;
    this.sceneData = {
      missionId: data.missionId ?? TEA_MOON_MISSION_ID,
      packageCondition: data.packageCondition ?? 100,
      routeCrashes: data.routeCrashes ?? 0,
      routeDurationMs: data.routeDurationMs ?? 0,
    };
  }

  create(): void {
    emitGameEvent(this, { type: "scene:enter", scene: "LandingScene" });

    this.packageCondition = this.sceneData.packageCondition;
    this.pad = createTeaMoonLandingPad();
    this.landingState = this.startOverride ?? createLandingState();
    this.phase = { kind: "descending" };
    this.delivered = false;
    this.landingIncidents = 0;
    this.thrustHeld = false;
    this.stabilizerHeld = false;
    this.retryAtMs = Number.NEGATIVE_INFINITY;
    this.squash.value = 0;
    this.settleTilt.value = 0;
    this.caption = undefined;
    this.controls = NO_CONTROLS;
    this.refreshReadings();

    this.scenery = new LunarScenery(this, this.pad.surfaceY);
    this.padSite = new LandingPadSite(this, this.pad);
    this.rabbit = new MoonRabbit(this, this.pad.surfaceY);
    this.aids = new LandingAids(this, this.pad);

    this.ship = new GyozaShip(this, this.toShipState(this.landingState));
    this.ship.setDepth(depth.ship);
    this.footOffset = measureFootOffset(this, ASSET.shipIdle, landingScenery.ship.fallbackFootRatio);
    this.thrustTrail = createThrustTrail(this, {
      depth: depth.ship - 1,
      offset: this.footOffset * landingScenery.ship.scale - landingScenery.ship.nozzleInsetPx,
    });
    this.updateShipVisual(false);
    this.ship.setAlpha(0);
    this.tweens.add({ targets: this.ship, alpha: 1, duration: motion.base, ease: "Sine.easeOut" });

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
    }) as LandingKeys | undefined;
    installDevSceneHotkeys(this);

    this.dashboard = new LandingDashboard(this);
    if (this.sys.game.device.input.touch) {
      this.touchPads = new LandingTouchPads(this);
    } else {
      this.touchPads = undefined;
      createLandingControlsHint(this);
    }
    this.updateDashboard();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.thrustTrail.destroy();
      this.scenery.destroy();
    });

    registerDevState("landing", () => ({
      state: this.landingState,
      phase: this.phase,
      pad: this.pad,
      packageCondition: this.packageCondition,
      landingIncidents: this.landingIncidents,
      zone: this.reading,
      alignment: this.alignment,
      footOffset: this.footOffset,
    }));
  }

  override update(time: number, delta: number): void {
    const deltaSeconds = clamp(delta / 1000, 0, landingTuning.maxDeltaSeconds);
    this.controls = this.readControls();

    if (this.keys && Phaser.Input.Keyboard.JustDown(this.keys.R) && this.phase.kind !== "settling" && this.phase.kind !== "delivered") {
      this.restartLandingAttempt();
    }

    const descending = this.phase.kind === "descending";
    this.emitHeldEdges(descending && this.controls.thrust, descending && this.controls.stabilizer);

    switch (this.phase.kind) {
      case "descending":
        this.updateDescent(time, deltaSeconds);
        break;
      case "settling":
        this.updateSettling(time);
        break;
      case "incident":
        this.updateIncident(time);
        break;
      case "intro":
      case "delivered":
        break;
    }

    const thrusting = this.phase.kind === "descending" && this.controls.thrust;
    this.thrustTrail.update(this.ship.x, this.ship.y, this.ship.rotation, thrusting, 1);
    this.scenery.update(this.ship.x);
    this.updateDashboard();
  }

  // --- Phases -------------------------------------------------------------------------------

  private updateDescent(time: number, deltaSeconds: number): void {
    this.landingState = integrateLandingMovement(this.landingState, this.controls, deltaSeconds);
    this.keepShipInsideView();
    this.refreshReadings();
    this.updateShipVisual(this.controls.thrust);
    this.padSite.setAligned(this.alignment.onPad);
    this.aids.update({
      shipX: this.ship.x,
      shipY: this.ship.y,
      feetY: this.landingState.y + landingTuning.shipRadius,
      rotation: this.ship.rotation,
      reading: this.reading,
      alignment: this.alignment,
      thrusting: this.controls.thrust,
      stabilizing: this.controls.stabilizer,
      deltaSeconds,
      timeMs: time,
    });
    this.handleTouchdown(time);
  }

  private handleTouchdown(time: number): void {
    const touchdown = classifyLandingTouchdown(this.landingState, this.pad);
    if (touchdown.kind === "none") return;

    if (touchdown.kind === "incident") {
      const incidentKind = classifyLandingIncident(touchdown);
      this.packageCondition = applyPackageConditionEvent(this.packageCondition, "landing-incident");
      this.landingIncidents += 1;
      this.phase = { kind: "incident", startedAtMs: time, incidentKind };
      emitGameEvent(this, { type: "landing:incident", incident: incidentKind, x: this.landingState.x, y: this.pad.surfaceY });
      this.beginIncident(incidentKind);
      return;
    }

    if (touchdown.kind === "bumpy") {
      this.packageCondition = applyPackageConditionEvent(this.packageCondition, "bumpy-landing");
    }
    this.settleTilt.value = this.landingState.rotation;
    this.landingState = pinStateToLandingPad(this.landingState, this.pad);
    this.refreshReadings();
    this.phase = { kind: "settling", startedAtMs: time, result: touchdown.kind };
    emitGameEvent(this, { type: "landing:touchdown", result: touchdown.kind, x: this.landingState.x, y: this.pad.surfaceY });
    this.beginTouchdown(touchdown.kind);
  }

  private updateSettling(time: number): void {
    if (this.phase.kind !== "settling") return;

    this.updateShipVisual(false);
    this.aids.updateShadowOnly(this.landingState.x, this.landingState.y + landingTuning.shipRadius);
    if (time - this.phase.startedAtMs < landingTuning.settleDurationMs || this.delivered) return;

    this.delivered = true;
    this.phase = { kind: "delivered", result: this.phase.result };
    this.scene.start("DeliveryResultScene", this.resultData(this.phase.result));
  }

  private updateIncident(time: number): void {
    if (this.phase.kind !== "incident") return;

    const elapsed = time - this.phase.startedAtMs;
    const incident = landingScenery.incident;
    const frameStartMs = incident.frameStartMs[this.phase.incidentKind];
    if (elapsed >= frameStartMs) {
      const frame = clamp(Math.floor((elapsed - frameStartMs) / incident.frameStepMs) + 1, 1, incident.frameCount);
      this.ship.setIncidentFrame(frame);
    }
    this.aids.updateShadowOnly(this.ship.x, this.ship.y + this.footOffset * landingScenery.ship.scale);

    if (elapsed >= landingTuning.incidentRestartMs) {
      this.restartLandingAttempt();
    }
  }

  private restartLandingAttempt(): void {
    this.tweens.killTweensOf(this.ship);
    this.tweens.killTweensOf(this.squash);
    this.tweens.killTweensOf(this.settleTilt);
    this.caption?.destroy();
    this.caption = undefined;

    this.landingState = createLandingState();
    this.phase = { kind: "descending" };
    this.squash.value = 0;
    this.settleTilt.value = 0;
    this.retryAtMs = this.time.now;
    this.refreshReadings();

    this.padSite.reset();
    this.rabbit.idle();
    this.aids.show();
    this.updateShipVisual(false);
    this.ship.setVisible(true).setAlpha(0);
    this.tweens.add({ targets: this.ship, alpha: 1, duration: motion.slow, ease: "Sine.easeOut" });

    emitGameEvent(this, { type: "landing:retry" });
  }

  // --- Touchdown + incident presentation ----------------------------------------------------

  private beginTouchdown(result: Exclude<LandingResultKind, "incident">): void {
    const shipConfig = landingScenery.ship;
    const dustConfig = landingScenery.touchdownDust;
    const x = this.landingState.x;
    const surfaceY = this.pad.surfaceY;

    this.aids.hide();
    for (const side of [-1, 1] as const) {
      burstDust(this, x + side * dustConfig.footSpreadPx, surfaceY - 2, {
        count: dustConfig[result].count / 2,
        spread: dustConfig[result].spread,
        depth: depth.ship + 1,
      });
    }
    if (result === "bumpy") shakeCamera(this, "soft");

    const amount = shipConfig.squashAmount * (result === "bumpy" ? 1.5 : 1);
    this.tweens.add({
      targets: this.squash,
      value: amount,
      duration: shipConfig.squashInMs,
      ease: "Quad.easeOut",
      onComplete: () => {
        this.tweens.add({ targets: this.squash, value: 0, duration: shipConfig.squashOutMs, ease: "Back.easeOut" });
      },
    });
    this.tweens.add({ targets: this.settleTilt, value: 0, duration: motion.slow, ease: "Back.easeOut" });

    this.padSite.lightLanterns();
    this.rabbit.wave();
    this.time.delayedCall(motion.base, () => {
      if (this.phase.kind !== "settling") return;
      burstSparkles(this, x, surfaceY - landingScenery.caption.offsetY / 2, { count: 10, spread: 70, depth: depth.hudFx });
    });

    this.caption = showLandingCaption(this, {
      x: clamp(x, 220, this.scale.width - 220),
      y: surfaceY - landingScenery.caption.offsetY - this.footOffset,
      title: landingCopy.touchdown[result],
      subtitle: `${landingCopy.rows.package}: ${packageConditionLabel(this.packageCondition)}`,
      accent: landingZoneColors[result],
    });
  }

  private beginIncident(kind: LandingIncidentKind): void {
    this.aids.hide();
    this.rabbit.startle();
    this.tweens.killTweensOf(this.ship);
    this.ship.setVisible(true).setAlpha(1);
    this.applyShipScale(1, 1);
    this.ship.setKinematicState(this.toShipState(this.landingState), false);

    const impactX = clamp(this.landingState.x, landingTuning.shipRadius, this.scale.width - landingTuning.shipRadius);
    burstIncident(this, impactX, this.pad.surfaceY - 10, { depth: depth.worldFx });
    shakeCamera(this, kind === "hard-drop" ? "strong" : "medium");

    this.caption = showLandingCaption(this, {
      x: clamp(impactX, 260, this.scale.width - 260),
      y: this.pad.surfaceY - landingScenery.caption.offsetY - this.footOffset,
      title: landingCopy.incidentTitle,
      subtitle: landingCopy.incidentNotes[kind],
      accent: colors.brick,
      progressMs: landingTuning.incidentRestartMs,
    });

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

  /** Ship centre y when its feet rest on the surface line. */
  private restingCenterY(): number {
    return this.pad.surfaceY - this.footOffset * landingScenery.ship.scale;
  }

  private animateHardDropIncident(): void {
    const scale = landingScenery.ship.scale;
    const impactX = this.landingState.x;
    const impactY = this.restingCenterY() + 6;
    const direction = this.incidentTiltDirection();

    this.ship.setPosition(impactX, impactY);
    burstDust(this, impactX, this.pad.surfaceY - 4, { count: 22, spread: 126, depth: depth.ship + 1 });
    this.createShockRing(impactX, this.pad.surfaceY - 4, colors.ember);

    this.tweens.add({
      targets: this.ship,
      y: impactY + 14,
      scaleX: scale * 1.28,
      scaleY: scale * 0.7,
      duration: 92,
      ease: "Quad.easeIn",
      onComplete: () => {
        burstDust(this, impactX, this.pad.surfaceY - 4, { count: 14, spread: 90, depth: depth.ship + 1 });
        this.createThrusterMisfire(impactX, impactY, this.landingState.rotation);
        this.tweens.add({
          targets: this.ship,
          y: impactY - 26,
          rotation: this.landingState.rotation + direction * 0.34,
          scaleX: scale * 1.03,
          scaleY: scale * 1.08,
          duration: 230,
          ease: "Back.easeOut",
          onComplete: () => {
            this.tweens.add({ targets: this.ship, y: impactY, duration: 260, ease: "Bounce.easeOut" });
          },
        });
      },
    });
  }

  private animateSkidIncident(): void {
    const scale = landingScenery.ship.scale;
    const direction = this.incidentHorizontalDirection();
    const radius = landingTuning.shipRadius;
    const startX = this.landingState.x;
    const startY = this.restingCenterY() + 4;
    const endX = clamp(startX + direction * 170, radius, this.scale.width - radius);

    this.ship.setPosition(startX, startY);
    burstDust(this, startX, this.pad.surfaceY - 4, { count: 14, spread: 82, depth: depth.ship + 1 });
    this.createShockRing(startX, this.pad.surfaceY - 3, colors.terracotta);

    this.time.addEvent({
      delay: 62,
      repeat: 6,
      callback: () => this.createSkidDust(this.ship.x - direction * 40, this.pad.surfaceY - 5, direction),
    });

    this.tweens.add({
      targets: this.ship,
      x: endX,
      y: startY + 10,
      rotation: this.landingState.rotation + direction * 1.18,
      scaleX: scale * 1.11,
      scaleY: scale * 0.86,
      duration: 470,
      ease: "Cubic.easeOut",
      onComplete: () => {
        this.createThrusterMisfire(this.ship.x, this.ship.y, this.ship.rotation);
      },
    });
  }

  private animateTiltTipIncident(): void {
    const direction = this.incidentTiltDirection();
    const radius = landingTuning.shipRadius;
    const startX = this.landingState.x;
    const startY = this.restingCenterY();

    this.ship.setPosition(startX, startY);
    burstDust(this, startX, this.pad.surfaceY - 4, { count: 12, spread: 78, depth: depth.ship + 1 });

    // Wobble on one leg first, then topple over: reads as "geometry won".
    this.tweens.chain({
      targets: this.ship,
      tweens: [
        { rotation: direction * 0.62, duration: 160, ease: "Quad.easeOut" },
        { rotation: direction * 0.42, duration: 120, ease: "Sine.easeInOut" },
        {
          x: clamp(startX + direction * 62, radius, this.scale.width - radius),
          y: startY + 22,
          rotation: direction * 1.42,
          duration: 300,
          ease: "Back.easeOut",
          onComplete: () => {
            this.createShockRing(this.ship.x, this.pad.surfaceY - 4, colors.plum);
            this.createThrusterMisfire(this.ship.x, this.ship.y, this.ship.rotation);
          },
        },
      ],
    });
  }

  private animateOffPadIncident(): void {
    const scale = landingScenery.ship.scale;
    const direction = this.incidentHorizontalDirection();
    const radius = landingTuning.shipRadius;
    const startX = clamp(this.landingState.x, radius, this.scale.width - radius);
    const startY = this.restingCenterY() + 6;

    this.ship.setPosition(startX, startY);
    burstDust(this, startX, this.pad.surfaceY - 4, { count: 26, spread: 118, depth: depth.ship + 1 });
    this.createShockRing(startX, this.pad.surfaceY - 4, colors.duskBlue);

    // Plops into soft moon dust and half sinks: wrong blanket.
    this.tweens.add({
      targets: this.ship,
      x: clamp(startX + direction * 28, radius, this.scale.width - radius),
      y: startY + 40,
      rotation: this.landingState.rotation + direction * 0.72,
      scaleX: scale * 0.9,
      scaleY: scale * 0.8,
      duration: 520,
      ease: "Quad.easeIn",
      onComplete: () => {
        burstDust(this, this.ship.x, this.pad.surfaceY, { count: 12, spread: 76, depth: depth.foreground + 1 });
      },
    });
  }

  private createSkidDust(x: number, y: number, direction: number): void {
    for (let i = 0; i < 5; i += 1) {
      const dust = this.add
        .circle(x, y + Phaser.Math.Between(-4, 6), Phaser.Math.Between(2, 5), colorNumber(colors.parchment), 0.58)
        .setDepth(depth.worldFx);

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
    const ring = this.add
      .ellipse(x, y, 24, 8)
      .setStrokeStyle(3, colorNumber(color), 0.75)
      .setDepth(depth.worldFx);

    this.tweens.add({
      targets: ring,
      scale: 6,
      alpha: 0,
      duration: 420,
      ease: "Quad.easeOut",
      onComplete: () => ring.destroy(),
    });
  }

  private createThrusterMisfire(x: number, y: number, rotation: number): void {
    const bottom = bottomVector(rotation);
    const nozzle = this.footOffset * landingScenery.ship.scale - landingScenery.ship.nozzleInsetPx;
    const startX = x + bottom.x * nozzle;
    const startY = y + bottom.y * nozzle;
    const baseAngle = Math.atan2(bottom.y, bottom.x);
    const palette = [colors.ember, colors.amber, colors.plaster];

    for (let i = 0; i < 11; i += 1) {
      const angle = baseAngle + Phaser.Math.FloatBetween(-0.58, 0.58);
      const distance = Phaser.Math.Between(28, 88);
      const spark = this.add
        .rectangle(startX, startY, 4, Phaser.Math.Between(8, 14), colorNumber(palette[i % palette.length] ?? colors.ember), 0.9)
        .setRotation(angle + Math.PI / 2)
        .setDepth(depth.shipFx);

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

  // --- Input, readings, visuals ---------------------------------------------------------------

  private readControls(): LandingControls {
    const touch = this.touchPads?.read() ?? NO_CONTROLS;
    const keys = this.keys;
    return {
      thrust: Boolean(keys?.W.isDown || keys?.UP.isDown) || touch.thrust,
      rotateLeft: Boolean(keys?.A.isDown || keys?.LEFT.isDown) || touch.rotateLeft,
      rotateRight: Boolean(keys?.D.isDown || keys?.RIGHT.isDown) || touch.rotateRight,
      stabilizer: Boolean(keys?.S.isDown || keys?.DOWN.isDown) || touch.stabilizer,
    };
  }

  /** Emits landing:thrust / landing:stabilizer only when the held state changes. */
  private emitHeldEdges(thrust: boolean, stabilizer: boolean): void {
    if (thrust !== this.thrustHeld) {
      this.thrustHeld = thrust;
      emitGameEvent(this, { type: "landing:thrust", active: thrust });
    }
    if (stabilizer !== this.stabilizerHeld) {
      this.stabilizerHeld = stabilizer;
      emitGameEvent(this, { type: "landing:stabilizer", active: stabilizer });
    }
  }

  private refreshReadings(): void {
    this.reading = readLandingZone(this.landingState, this.pad);
    this.alignment = padAlignment(this.landingState, this.pad);
  }

  private keepShipInsideView(): void {
    const radius = landingTuning.shipRadius;
    const state = this.landingState;
    const x = clamp(state.x, radius, this.scale.width - radius);
    const y = clamp(state.y, radius, this.pad.surfaceY - radius + 18);
    if (x === state.x && y === state.y) return;

    this.landingState = {
      ...state,
      x,
      y,
      velocityX: x === state.x ? state.velocityX : 0,
      velocityY: y < state.y ? state.velocityY : Math.max(0, state.velocityY),
    };
  }

  /**
   * Places the sprite so its measured feet sit on the physics contact line (y + shipRadius along the
   * ship's down axis), then applies the touchdown squash with the feet kept planted.
   */
  private updateShipVisual(thrusting: boolean): void {
    const scale = landingScenery.ship.scale;
    const squash = this.squash.value;
    const footPx = this.footOffset * scale;
    const rotation = this.landingState.rotation + this.settleTilt.value;
    const bottom = bottomVector(rotation);
    const centerOffset = landingTuning.shipRadius - footPx;

    this.ship.setKinematicState(
      {
        x: this.landingState.x + bottom.x * centerOffset,
        y: this.landingState.y + bottom.y * centerOffset + footPx * squash,
        rotation,
        velocityX: this.landingState.velocityX,
        velocityY: this.landingState.velocityY,
      },
      thrusting,
    );
    this.applyShipScale(1 + squash * landingScenery.ship.squashStretchRatio, 1 - squash);
  }

  private applyShipScale(xFactor: number, yFactor: number): void {
    const scale = landingScenery.ship.scale;
    this.ship.setScale(scale * xFactor, scale * yFactor);
  }

  private updateDashboard(): void {
    const reading = this.reading;
    const state = this.landingState;
    const driftArrow = state.velocityX > 2 ? " →" : state.velocityX < -2 ? " ←" : "";
    const view: LandingDashboardView = {
      descent: {
        value: `${Math.round(state.velocityY)} ${landingCopy.units.speed}`,
        zone: descentZone(state.velocityY),
      },
      drift: {
        value: `${Math.round(reading.horizontalSpeed)} ${landingCopy.units.speed}${driftArrow}`,
        zone: driftZone(reading.horizontalSpeed),
      },
      tilt: {
        value: `${Math.round(reading.angleDegrees)}${landingCopy.units.degrees}`,
        zone: tiltZone(reading.angleDegrees),
      },
      altitude: {
        value: `${Math.round(reading.altitude)} ${landingCopy.units.altitude}`,
        zone: reading.onPad ? undefined : "rough",
      },
      package: { value: packageConditionLabel(this.packageCondition) },
      note: this.dashboardNote(),
    };
    this.dashboard.update(view);
  }

  private dashboardNote(): string {
    const notes = landingCopy.notes;
    switch (this.phase.kind) {
      case "incident":
        return landingCopy.incidentNotes[this.phase.incidentKind];
      case "settling":
      case "delivered":
        return notes.settling;
      case "intro":
      case "descending":
        break;
    }
    if (this.time.now - this.retryAtMs < RETRY_NOTE_MS) return notes.retry;
    if (!this.alignment.onPad) return notes.offPad;
    if (this.controls.stabilizer) return notes.stabilizing;
    if (this.controls.thrust) return notes.thrusting;
    if (this.reading.angleDegrees > landingTuning.safeAngleDegrees * TILT_NOTE_RATIO) return notes.tilted;
    return notes.descendingIdle;
  }

  private resultData(landingResult: LandingResultKind): DeliveryResultSceneData {
    return {
      ...this.sceneData,
      packageCondition: this.packageCondition,
      landingResult,
      landingIncidents: this.landingIncidents,
    };
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
}
