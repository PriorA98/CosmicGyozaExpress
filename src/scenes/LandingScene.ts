import Phaser from "phaser";
import { ASSET, CAMPAIGN_PORTRAIT_FRAME } from "../data/assetManifest";
import { landingForMission, resolveMission } from "../data/campaign";
import { themeFor } from "../data/campaign/themes";
import { campaignLandingCopy } from "../data/landingCopy";
import { LANDING_ART_SCALE, campaignLandingScenery, landingCopy, landingScenery, landingZoneColors } from "../data/landingScenery";
import { TEA_MOON_MISSION_ID } from "../data/missions";
import { installDevSceneHotkeys } from "../dev/DevSceneLauncher";
import { registerDevState } from "../dev/devProbe";
import { GyozaShip, rotationCellIndex } from "../entities/GyozaShip";
import { LandingAids } from "../entities/landing/LandingAids";
import { CampaignBerth } from "../entities/landing/CampaignBerth";
import { CampaignLandingScenery, type LandingGreeter } from "../entities/landing/CampaignLandingScenery";
import { LandingWindIndicator } from "../entities/landing/LandingWindIndicator";
import { showLandingCaption } from "../entities/landing/LandingCaption";
import { createLandingControlsHint, LandingDashboard } from "../entities/landing/LandingDashboard";
import { LandingIntroCard } from "../entities/landing/LandingIntroCard";
import { LandingPadSite } from "../entities/landing/LandingPadSite";
import { LandingTouchPads } from "../entities/landing/LandingTouchPads";
import { landingTouchTiles } from "../entities/landing/landingTouchLayout";
import { LunarScenery } from "../entities/landing/LunarScenery";
import { MoonRabbit } from "../entities/landing/MoonRabbit";
import {
  buildIncidentReadouts,
  buildLandingReadouts,
  buildSettledReadouts,
  type LandingReadouts,
} from "../entities/landing/landingReadouts";
import { outlineEllipseSpans, drawSpans, snapToGrid } from "../entities/landing/pixelShapes";
import { resolveShipLayout, type ShipDisplayLayout } from "../entities/landing/shipFootprint";
import { stepThrustPower, thrustFlameFrame, type ThrustFlameFrame } from "../entities/landing/thrustFlame";
import {
  burstDust,
  burstIncident,
  burstSparkles,
  createThrustTrail,
  isReducedMotion,
  shakeCamera,
  type ThrustTrail,
} from "../fx/feedback";
import { playEnterTransition, transitionToScene } from "../fx/transitions";
import { compactUiScale, isCompactDisplay } from "../game/displayScale";
import { colorNumber, colors, depth, motion } from "../game/designTokens";
import { emitGameEvent } from "../game/events";
import { Button } from "../ui";
import {
  classifyLandingIncident,
  createLandingState,
  integrateLandingMovement,
  padAlignment,
  pinStateToLandingPad,
  type LandingPadAlignment,
  type LandingZoneReading,
} from "../systems/LandingSystem";
import {
  acceptedPadOffset,
  campaignLandingNote,
  classifyPadTouchdown,
  landingContactState,
  readPadLandingZone,
  rideLandingPad,
  sampleLandingEnvironment,
} from "../systems/LandingEnvironmentSystem";
import type { GustPhase } from "../types/campaign";
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

/** Screen-fixed HUD layer, rebuilt when the display size class changes. */
type HudLayer = {
  readonly dashboard: LandingDashboard;
  readonly hint: Phaser.GameObjects.Container | undefined;
  readonly touchPads: LandingTouchPads | undefined;
  /** Touch layouts only: the parchment retry chip (keyboard players have R). */
  readonly retryChip: Button | undefined;
  readonly uiScale: number;
  readonly wind: LandingWindIndicator | undefined;
};

const NO_CONTROLS: LandingControls = { thrust: false, rotateLeft: false, rotateRight: false, stabilizer: false };
const CELL = LANDING_ART_SCALE;
const FLY_FRAMES = [ASSET.shipFly1, ASSET.shipFly2, ASSET.shipFly3] as const;
/** Pre-rotated (RotSprite) sheets of the fly frames: the flame never rotates at runtime either. */
const FLY_ROT_FRAMES = [ASSET.shipFly1Rot, ASSET.shipFly2Rot, ASSET.shipFly3Rot] as const;
/** Thrust puffs sit just behind the ship so the baked flame stays in front of them. */
const TRAIL_DEPTH = depth.ship - 1;

export class LandingScene extends Phaser.Scene {
  private mission = resolveMission(TEA_MOON_MISSION_ID);
  private definition = landingForMission(TEA_MOON_MISSION_ID);
  private theme = themeFor(this.definition.themeId);
  private environment = sampleLandingEnvironment(this.definition, createLandingState(this.definition.tuning), 0);
  private landingClockMs = 0;
  private gustPhase: GustPhase | undefined;
  private acceptedOffsetX = 0;
  private lastCampaignHudMs = Number.NEGATIVE_INFINITY;
  private sceneData: LandingSceneData = {
    missionId: TEA_MOON_MISSION_ID,
    packageCondition: 100,
    routeCrashes: 0,
    routeDurationMs: 0,
  };
  private keys: LandingKeys | undefined;
  private ship!: GyozaShip;
  private shipLayout!: ShipDisplayLayout;
  private scenery!: LunarScenery | CampaignLandingScenery;
  private padSite!: LandingPadSite | CampaignBerth;
  private rabbit!: LandingGreeter;
  private aids!: LandingAids;
  private hud: HudLayer | undefined;
  private touchLayout = false;
  /** Horizontal range the ship centre may use: the canvas, minus the touch tile columns on touch layouts. */
  private playMinX = 0;
  private playMaxX = 0;
  private thrustTrail!: ThrustTrail;
  private caption: Phaser.GameObjects.Container | undefined;
  private introCard: LandingIntroCard | undefined;
  private pad: LandingPadDefinition = this.definition.pad;
  /** Where feet and the contact shadow visually rest on the blanket's top face. */
  private contactY = 0;
  private landingState: LandingKinematicState = createLandingState(this.definition.tuning);
  private phase: LandingPhase = { kind: "intro" };
  private reading!: LandingZoneReading;
  private alignment!: LandingPadAlignment;
  private readouts!: LandingReadouts;
  private controls: LandingControls = NO_CONTROLS;
  private thrustPower = 0;
  private flameFrame: ThrustFlameFrame = 0;
  private readonly dip: Tweenable = { value: 0 };
  private readonly settleTilt: Tweenable = { value: 0 };
  /** Arrival cinematic proxies: ship offset from its hand-off position and the intro's braking flame. */
  private readonly introShip = { offsetX: 0, offsetY: 0, power: 0 };
  private introEnding = false;
  private thrustHeld = false;
  private stabilizerHeld = false;
  private retryAtMs = Number.NEGATIVE_INFINITY;
  private packageCondition = 100;
  private landingIncidents = 0;
  private delivered = false;
  private startOverride: LandingKinematicState | undefined;
  /** |vy| at the last touchdown (px/s): scales the touchdown dust. */
  private touchdownSpeed = 0;

  constructor() {
    super("LandingScene");
  }

  init(data: Partial<LandingSceneInit>): void {
    this.mission = resolveMission(data.missionId);
    this.definition = landingForMission(data.missionId);
    this.theme = themeFor(this.definition.themeId);
    this.startOverride = data.start;
    this.sceneData = {
      missionId: this.mission.id,
      packageCondition: data.packageCondition ?? 100,
      routeCrashes: data.routeCrashes ?? 0,
      routeDurationMs: data.routeDurationMs ?? 0,
    };
  }

  create(): void {
    emitGameEvent(this, { type: "scene:enter", scene: "LandingScene" });

    this.packageCondition = this.sceneData.packageCondition;
    this.landingClockMs = 0;
    this.gustPhase = undefined;
    this.acceptedOffsetX = 0;
    this.lastCampaignHudMs = Number.NEGATIVE_INFINITY;
    this.landingState = this.startOverride ?? createLandingState(this.definition.tuning);
    this.environment = sampleLandingEnvironment(this.definition, this.landingState, this.landingClockMs);
    this.pad = this.environment.pad.pad;
    const padArt = this.theme.legacy ? landingScenery.pad : campaignLandingScenery.berth;
    this.contactY = this.pad.surfaceY + (padArt.contactRowArtPx - padArt.surfaceRowArtPx) * CELL;
    this.delivered = false;
    this.landingIncidents = 0;
    this.thrustHeld = false;
    this.stabilizerHeld = false;
    this.thrustPower = 0;
    this.flameFrame = 0;
    this.retryAtMs = Number.NEGATIVE_INFINITY;
    this.dip.value = 0;
    this.settleTilt.value = 0;
    this.introShip.offsetX = 0;
    this.introShip.offsetY = 0;
    this.introShip.power = 0;
    this.introEnding = false;
    this.caption = undefined;
    this.introCard = undefined;
    this.hud = undefined;
    this.controls = NO_CONTROLS;
    // Showcase / dev starts (with a `start` override) skip the arrival cinematic so captures stay deterministic.
    this.phase = this.startOverride ? { kind: "descending" } : { kind: "intro" };
    this.touchLayout = this.sys.game.device.input.touch;
    this.computePlayBounds();
    this.refreshReadings();

    if (this.theme.legacy) {
      this.scenery = new LunarScenery(this, { surfaceY: this.pad.surfaceY, touchLayout: this.touchLayout });
      this.padSite = new LandingPadSite(this, this.pad);
      const rabbitConfig = landingScenery.rabbit;
      this.rabbit = new MoonRabbit(this, this.pad.surfaceY, this.touchLayout ? rabbitConfig.touchX : rabbitConfig.x);
    } else {
      const scenery = new CampaignLandingScenery(this, {
        definition: this.definition, theme: this.theme, touchLayout: this.touchLayout, riseAbovePx: landingScenery.intro.risePx,
      });
      this.scenery = scenery;
      this.rabbit = scenery;
      this.padSite = new CampaignBerth(this, this.pad, this.theme);
    }
    this.aids = new LandingAids(this, this.pad, this.contactY, this.definition.tuning);

    this.shipLayout = resolveShipLayout(this, landingScenery.ship.fallbackFootRatio);
    this.ship = new GyozaShip(this, this.toShipState(this.landingState));
    this.ship
      .applyArtLayout({ contract: true, scale: this.shipLayout.scale, originX: this.shipLayout.originX, originY: this.shipLayout.originY })
      .setDepth(depth.ship);
    // Puffs are placed at the live flame tip each frame, so the trail itself needs no offset.
    this.thrustTrail = createThrustTrail(this, { depth: TRAIL_DEPTH, offset: 0 });

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

    this.buildHud();
    const onResize = (): void => this.rebuildHudIfNeeded();
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, onResize);
      this.thrustTrail.destroy();
      this.scenery.destroy();
    });

    registerDevState("landing", () => ({
      state: this.landingState,
      phase: this.phase,
      missionId: this.mission.id,
      pad: { ...this.pad, velocityX: this.environment.pad.velocity.x },
      wind: { ax: this.environment.wind.acceleration.x, ay: this.environment.wind.acceleration.y, phase: this.environment.wind.phase, exposure: this.environment.wind.exposure },
      tuning: {
        gravity: this.definition.tuning.gravityAcceleration, thruster: this.definition.tuning.thrusterAcceleration,
        safeVerticalSpeed: this.definition.tuning.safeVerticalSpeed, safeHorizontalSpeed: this.definition.tuning.safeHorizontalSpeed,
        safeAngleDegrees: this.definition.tuning.safeAngleDegrees, shipRadius: this.definition.tuning.shipRadius,
      },
      packageCondition: this.packageCondition,
      landingIncidents: this.landingIncidents,
      zone: this.reading,
      alignment: this.alignment,
      readouts: this.readouts,
      thrustPower: this.thrustPower,
      flameFrame: this.flameFrame,
      footOffset: this.shipLayout.footPx,
      contactY: this.contactY,
      shipScale: this.ship.scaleX,
      cameraScrollY: this.cameras.main.scrollY,
    }));

    if (this.phase.kind === "intro") this.startArrivalIntro();
    else this.updateShipVisual();
    this.sampleEnvironment();
    this.updateDashboard();
    if (!this.theme.legacy) this.rabbit.wave();
  }

  override update(time: number, delta: number): void {
    const deltaSeconds = clamp(delta / 1000, 0, this.definition.tuning.maxDeltaSeconds);
    this.controls = this.readControls();

    if (this.keys && Phaser.Input.Keyboard.JustDown(this.keys.R)) this.requestRetry();

    const descending = this.phase.kind === "descending";
    // The arrival glide burns a visible braking flame, so it drives the thrust loop too.
    const introBraking = this.phase.kind === "intro" && this.introShip.power >= landingScenery.thrust.litPower;
    this.emitHeldEdges((descending && this.controls.thrust) || introBraking, descending && this.controls.stabilizer);

    switch (this.phase.kind) {
      case "intro":
        this.updateIntro(time);
        break;
      case "descending":
        this.updateDescent(time, deltaSeconds);
        break;
      case "settling":
        this.landingClockMs += deltaSeconds * 1000;
        this.updateSettling(time);
        break;
      case "incident":
        this.updateIncident(time);
        break;
      case "delivered":
        break;
    }

    this.updateThrustTrail();
    if (this.scenery instanceof LunarScenery) this.scenery.update(this.ship.x);
    else this.scenery.update(time, this.landingClockMs, this.environment.wind);
    this.updateDashboard();
  }

  // --- Arrival intro ---------------------------------------------------------------------------

  /**
   * Arrival cinematic (<= `intro.totalMs`, any key or tap skips): fades in from FlightScene's ink iris,
   * the camera eases down from the high lunar sky while the ship glides in from above on a small braking
   * flame, a title card with the waving rabbit pops in, then control hands over.
   */
  private startArrivalIntro(): void {
    const intro = landingScenery.intro;
    const camera = this.cameras.main;
    const calm = isReducedMotion();
    const rise = calm ? 0 : intro.risePx;
    this.phase = { kind: "intro" };
    this.aids.hide();
    this.setHudAlpha(0);

    void playEnterTransition(this, { kind: "warm-fade", durationMs: intro.fadeInMs, color: intro.fadeColor });

    // Ship starts above the raised view: its world y is `rise + shipStartAbovePx` above the top edge.
    const startOffsetY = calm ? 0 : -(rise + intro.shipStartAbovePx + this.landingState.y);
    this.introShip.offsetX = calm ? 0 : intro.shipStartOffsetX;
    this.introShip.offsetY = startOffsetY;
    this.introShip.power = calm ? 0 : intro.shipBrakePower;
    camera.setScroll(0, -rise);

    if (!calm) {
      this.tweens.add({ targets: camera, scrollY: 0, duration: intro.panMs, ease: "Sine.easeInOut" });
      this.tweens.add({ targets: this.introShip, offsetY: 0, duration: intro.shipMs, ease: "Cubic.easeOut" });
      this.tweens.add({ targets: this.introShip, offsetX: 0, duration: intro.shipMs, ease: "Sine.easeInOut" });
      this.tweens.add({ targets: this.introShip, power: 0, delay: intro.shipMs * 0.55, duration: intro.shipMs * 0.45, ease: "Quad.easeIn" });
    }
    this.updateShipVisual();

    const card = new LandingIntroCard(this, this.hudScale(), this.theme.legacy ? undefined : {
      title: this.mission.title + campaignLandingCopy.titleSuffix,
      subtitle: this.theme.portraitTexture === null ? campaignLandingCopy.homeSubtitle : this.mission.recipientName + campaignLandingCopy.wavingSuffix,
      portrait: this.theme.portraitTexture === null ? null : { key: this.theme.portraitTexture, frame: CAMPAIGN_PORTRAIT_FRAME.welcome },
    });
    this.introCard = card;
    this.time.delayedCall(intro.cardDelayMs, () => {
      if (this.introCard === card) card.playIn();
    });
    this.time.delayedCall(intro.cardDelayMs + intro.cardHoldMs, () => {
      if (this.introCard === card) {
        this.introCard = undefined;
        card.playOut();
      }
    });
    this.time.delayedCall(intro.totalMs, () => this.finishArrivalIntro());

    this.input.keyboard?.once(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, this.skipArrivalIntro, this);
    this.input.once(Phaser.Input.Events.POINTER_DOWN, this.skipArrivalIntro, this);
  }

  private skipArrivalIntro(): void {
    this.finishArrivalIntro();
  }

  /** Hands control over: snaps every intro tween to its end and fades the HUD in. Idempotent. */
  private finishArrivalIntro(): void {
    if (this.phase.kind !== "intro" || this.introEnding) return;
    this.introEnding = true;
    this.input.keyboard?.off(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, this.skipArrivalIntro, this);
    this.input.off(Phaser.Input.Events.POINTER_DOWN, this.skipArrivalIntro, this);

    const camera = this.cameras.main;
    this.tweens.killTweensOf(camera);
    this.tweens.killTweensOf(this.introShip);
    camera.setScroll(0, 0);
    this.introShip.offsetX = 0;
    this.introShip.offsetY = 0;
    this.introShip.power = 0;
    if (this.introCard) {
      this.introCard.playOut();
      this.introCard = undefined;
    }

    this.phase = { kind: "descending" };
    this.aids.show();
    this.fadeHudIn(landingScenery.intro.hudFadeMs);
    this.updateShipVisual();
  }

  private updateIntro(time: number): void {
    // The landing state stays at its hand-off values; only the sprite glides in on the intro proxies.
    this.thrustPower = this.introShip.power;
    this.flameFrame = thrustFlameFrame(this.thrustPower, time, landingScenery.thrust);
    this.updateShipVisual();
    this.aids.updateShadowOnly(this.ship.x, this.ship.y + this.shipLayout.footPx);
  }

  // --- Phases -------------------------------------------------------------------------------

  /** One environment sample drives contact, berth position, wind physics, and the visible cues. */
  private sampleEnvironment(): void {
    this.environment = sampleLandingEnvironment(this.definition, this.landingState, this.landingClockMs);
    this.pad = this.environment.pad.pad;
    this.aids.setPad(this.pad);
    if (this.padSite instanceof CampaignBerth) this.padSite.setCenterX(this.pad.centerX);
    if (this.definition.wind.kind === "gust" && this.gustPhase !== this.environment.wind.phase) {
      this.gustPhase = this.environment.wind.phase;
      emitGameEvent(this, { type: "landing:gust-phase", phase: this.gustPhase });
    }
  }

  private updateDescent(time: number, deltaSeconds: number): void {
    this.landingClockMs += deltaSeconds * 1000;
    this.sampleEnvironment();
    this.landingState = integrateLandingMovement(this.landingState, this.controls, deltaSeconds, this.definition.tuning,
      this.definition.collisionModel === "legacy-horizontal" ? undefined : this.environment.wind.acceleration);
    this.keepShipInsideView();
    this.refreshReadings();
    this.thrustPower = stepThrustPower(this.thrustPower, this.controls.thrust, deltaSeconds, landingScenery.thrust);
    this.flameFrame = thrustFlameFrame(this.thrustPower, time, landingScenery.thrust);
    this.updateShipVisual();
    this.padSite.setAligned(this.alignment.onPad);
    this.aids.update({
      shipX: this.ship.x,
      shipY: this.ship.y,
      feetY: this.landingState.y + this.definition.tuning.shipRadius,
      rotation: this.ship.visualRotation,
      reading: this.reading,
      readouts: this.readouts,
      alignment: this.alignment,
      thrusting: this.controls.thrust,
      stabilizing: this.controls.stabilizer,
      deltaSeconds,
      timeMs: time,
    });
    this.handleTouchdown(time);
  }

  private handleTouchdown(time: number): void {
    const touchdown = classifyPadTouchdown(this.definition.collisionModel, this.landingState, this.environment.pad, this.definition.tuning);
    if (touchdown.kind === "none") return;

    // Freeze the readouts at the touchdown speed so the HUD and the caption agree with what happened.
    const contact = landingContactState(this.definition.collisionModel, this.landingState, this.environment.pad);
    const snapshot = buildLandingReadouts(this.reading, contact.velocityX, contact.velocityY, undefined, this.definition.tuning);
    this.readouts = snapshot;
    this.touchdownSpeed = Math.abs(contact.velocityY);
    this.cutThrust();

    if (touchdown.kind === "incident") {
      const incidentKind = classifyLandingIncident(touchdown, this.definition.tuning);
      this.packageCondition = applyPackageConditionEvent(this.packageCondition, "landing-incident");
      this.landingIncidents += 1;
      this.phase = { kind: "incident", startedAtMs: time, incidentKind };
      this.readouts = buildIncidentReadouts(snapshot, incidentKind, this.driftArrow());
      emitGameEvent(this, { type: "landing:incident", incident: incidentKind, x: this.landingState.x, y: this.pad.surfaceY });
      this.beginIncident(incidentKind);
      return;
    }

    if (touchdown.kind === "bumpy") {
      this.packageCondition = applyPackageConditionEvent(this.packageCondition, "bumpy-landing");
    }
    this.settleTilt.value = this.landingState.rotation;
    this.acceptedOffsetX = acceptedPadOffset(this.landingState, this.pad);
    this.landingState = pinStateToLandingPad(this.landingState, this.pad, this.definition.tuning);
    this.reading = readPadLandingZone(this.definition.collisionModel, this.landingState, this.environment.pad, this.definition.tuning);
    this.alignment = padAlignment(this.landingState, this.pad);
    this.phase = { kind: "settling", startedAtMs: time, result: touchdown.kind };
    this.readouts = buildSettledReadouts(snapshot);
    emitGameEvent(this, { type: "landing:touchdown", result: touchdown.kind, x: this.landingState.x, y: this.pad.surfaceY });
    this.beginTouchdown(touchdown.kind);
  }

  private updateSettling(time: number): void {
    if (this.phase.kind !== "settling") return;

    if (!this.theme.legacy) this.sampleEnvironment();
    if (this.definition.padMotion.kind === "path") {
      this.landingState = rideLandingPad(this.acceptedOffsetX, this.pad, this.definition.tuning);
    }
    this.updateShipVisual();
    this.aids.updateShadowOnly(this.landingState.x, this.landingState.y + this.definition.tuning.shipRadius);
    if (time - this.phase.startedAtMs < this.definition.tuning.settleDurationMs || this.delivered) return;

    this.delivered = true;
    const result = this.phase.result;
    this.phase = { kind: "delivered", result };
    const exit = landingScenery.exit;
    transitionToScene(this, "DeliveryResultScene", this.resultData(result), { kind: "warm-fade", durationMs: exit.fadeMs, color: exit.color });
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
    this.aids.updateShadowOnly(this.ship.x, this.ship.y + this.shipLayout.footPx);

    if (elapsed >= this.definition.tuning.incidentRestartMs) {
      this.restartLandingAttempt();
    }
  }

  /** R key / touch retry chip: a fresh landing-only attempt while descending or after an incident. */
  private requestRetry(): void {
    if (this.phase.kind === "descending" || this.phase.kind === "incident") this.restartLandingAttempt();
  }

  private restartLandingAttempt(): void {
    this.tweens.killTweensOf(this.ship);
    this.tweens.killTweensOf(this.dip);
    this.tweens.killTweensOf(this.settleTilt);
    this.caption?.destroy();
    this.caption = undefined;

    this.landingState = createLandingState(this.definition.tuning);
    this.landingClockMs = 0;
    this.gustPhase = undefined;
    this.sampleEnvironment();
    this.phase = { kind: "descending" };
    this.dip.value = 0;
    this.settleTilt.value = 0;
    this.thrustPower = 0;
    this.flameFrame = 0;
    this.thrustTrail.setDepth(TRAIL_DEPTH);
    this.retryAtMs = this.time.now;
    this.refreshReadings();

    this.padSite.reset();
    this.rabbit.idle();
    if (!this.theme.legacy) this.rabbit.wave();
    this.aids.show();
    this.updateShipVisual();
    this.ship.setVisible(true).setAlpha(0);
    this.tweens.add({ targets: this.ship, alpha: 1, duration: motion.slow, ease: "Sine.easeOut" });

    emitGameEvent(this, { type: "landing:retry" });
    if (!this.theme.legacy) {
      this.lastCampaignHudMs = Number.NEGATIVE_INFINITY;
      this.updateDashboard(true);
    }
  }

  // --- Touchdown + incident presentation ----------------------------------------------------

  /** Everything thrust-related goes out at once: flame frame, puffs, gauge, wash, gyro. */
  private cutThrust(): void {
    this.thrustPower = 0;
    this.flameFrame = 0;
    this.aids.hide();
    this.thrustTrail.update(this.ship.x, this.ship.y, this.ship.visualRotation, false, 0);
    // Puffs already in flight would drift down over the blanket and the hint bar: remove them at once.
    this.thrustTrail.clear();
  }

  private beginTouchdown(result: Exclude<LandingResultKind, "incident">): void {
    const shipConfig = landingScenery.ship;
    const dustConfig = landingScenery.touchdownDust;
    const x = this.landingState.x;

    // Dust puffs out sideways from under the feet, behind the hull, so the hero pose stays clear; the
    // gentler the touchdown, the smaller the puff. Only a bumpy landing kicks a few puffs in front.
    const dust = dustConfig[result];
    const speedShare = clamp(this.touchdownSpeed / this.definition.tuning.bumpyVerticalSpeed, 0, 1);
    const perSide = Math.round(Phaser.Math.Linear(dust.minCountPerSide, dust.maxCountPerSide, speedShare));
    for (const side of [-1, 1] as const) {
      burstDust(this, x + side * dust.footSpreadPx, this.contactY - CELL, {
        count: perSide,
        spread: dust.spread,
        lifespanMs: dust.lifespanMs,
        fan: side < 0 ? "left" : "right",
        depth: depth.ship - 1,
      });
    }
    if (result === "bumpy") {
      const front = dustConfig.bumpyFront;
      for (const side of [-1, 1] as const) {
        burstDust(this, x + side * front.footSpreadPx, this.contactY, {
          count: front.countPerSide,
          spread: front.spread,
          lifespanMs: front.lifespanMs,
          fan: side < 0 ? "left" : "right",
          depth: depth.ship + 1,
        });
      }
      shakeCamera(this, "soft");
    }

    // Touchdown "squash" is a dip in whole art px: integer-scale pixel art never stretches.
    this.tweens.add({
      targets: this.dip,
      value: shipConfig.touchdownDipPx[result],
      duration: shipConfig.dipInMs,
      ease: "Quad.easeOut",
      onComplete: () => {
        this.tweens.add({ targets: this.dip, value: 0, duration: shipConfig.dipOutMs, ease: "Back.easeOut" });
      },
    });
    this.tweens.add({ targets: this.settleTilt, value: 0, duration: motion.slow, ease: "Back.easeOut" });
    this.updateShipVisual();

    this.padSite.lightLanterns();
    this.rabbit.wave();
    this.time.delayedCall(motion.base, () => {
      if (this.phase.kind !== "settling") return;
      burstSparkles(this, x, this.contactY - landingScenery.caption.offsetY / 2, { count: 10, spread: 70, depth: depth.hudFx });
    });

    const descent = this.readouts.descent;
    this.caption = showLandingCaption(this, {
      x,
      y: this.captionY(),
      title: this.theme.legacy ? landingCopy.touchdown[result] : this.mission.landingLines[result],
      subtitle: `${landingCopy.touchdownSpeedLabel} ${descent.number} ${descent.unit} · ${landingCopy.rows.package} ${this.packageWord()}`,
      accent: landingZoneColors[result],
      scale: this.hudScale(),
    });
  }

  private captionY(): number {
    return this.pad.surfaceY - landingScenery.caption.offsetY - this.shipLayout.footPx;
  }

  private beginIncident(kind: LandingIncidentKind): void {
    this.rabbit.startle();
    this.tweens.killTweensOf(this.ship);
    this.ship.setVisible(true).setAlpha(1);
    this.ship.setKinematicState(this.toShipState(this.landingState), false);
    this.ship.setScale(this.shipLayout.scale);

    const impactX = clamp(this.landingState.x, this.playMinX, this.playMaxX);
    this.burstIncidentPoof(impactX);
    shakeCamera(this, kind === "hard-drop" ? "strong" : "medium");

    this.caption = showLandingCaption(this, {
      x: impactX,
      y: this.captionY(),
      title: landingCopy.incidentTitle,
      subtitle: this.theme.legacy ? landingCopy.incidentNotes[kind] : campaignLandingCopy.incidentNotes[kind],
      accent: colors.brick,
      progressMs: this.definition.tuning.incidentRestartMs,
      scale: this.hudScale(),
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

  /**
   * The comedic poof, layered so the dumpling stays readable: flour blooms behind the hull at the contact
   * point, while the confetti (plus a little flour) fans up from a ring around the ship, in front of it.
   */
  private burstIncidentPoof(impactX: number): void {
    const poof = landingScenery.incidentPoof;
    burstDust(this, impactX, this.contactY - CELL, {
      count: poof.flourCount,
      spread: poof.flourSpread,
      spawnRadius: poof.flourSpawnRadiusPx,
      depth: depth.ship - 1,
    });
    burstIncident(this, impactX, this.restingCenterY(), {
      count: poof.confettiCount,
      spread: poof.confettiSpread,
      spawnRadius: poof.confettiSpawnRadiusPx,
      depth: depth.worldFx,
      confettiOrigin: { x: this.ship.x, y: this.ship.y },
      confettiDepth: depth.shipFx,
    });
  }

  /** One incident dust puff from `landingScenery.incidentDust`, at the contact row. */
  private incidentDust(x: number, id: keyof typeof landingScenery.incidentDust): void {
    const puff = landingScenery.incidentDust[id];
    burstDust(this, x, this.contactY - CELL * 2, {
      count: puff.count,
      spread: puff.spread,
      spawnRadius: puff.spawnRadiusPx,
      depth: puff.front ? depth.foreground + 1 : depth.ship - 1,
    });
  }

  /** Ship pivot y when its feet rest on the blanket's contact row. */
  private restingCenterY(): number {
    return this.contactY - this.shipLayout.footPx;
  }

  /** Incident motion is position + rotation only (integer-scale pixel art never squashes). */
  private animateHardDropIncident(): void {
    const config = landingScenery.incident;
    const impactX = snapToGrid(this.landingState.x, CELL);
    const impactY = snapToGrid(this.restingCenterY(), CELL);
    const direction = this.incidentTiltDirection();

    this.ship.setPosition(impactX, impactY - config.hardDropImpactPx);
    this.incidentDust(impactX, "hardDropImpact");
    this.createShockRing(impactX, this.contactY, colors.ember);

    this.tweens.chain({
      targets: this.ship,
      tweens: [
        { y: impactY + config.hardDropImpactPx, duration: 92, ease: "Quad.easeIn" },
        {
          y: impactY - config.hardDropBouncePx,
          visualRotation: this.landingState.rotation + direction * 0.34,
          duration: 230,
          ease: "Back.easeOut",
          onStart: () => {
            this.incidentDust(impactX, "hardDropBounce");
            this.createThrusterMisfire();
          },
        },
        { y: impactY, duration: 260, ease: "Bounce.easeOut" },
      ],
    });
  }

  private animateSkidIncident(): void {
    const config = landingScenery.incident;
    const direction = this.incidentHorizontalDirection();
    const startX = this.landingState.x;
    const startY = this.restingCenterY();
    const endX = clamp(startX + direction * config.skidDistancePx, this.playMinX, this.playMaxX);

    this.ship.setPosition(startX, startY);
    this.incidentDust(startX, "skid");
    this.createShockRing(startX, this.contactY, colors.terracotta);

    this.time.addEvent({
      delay: 62,
      repeat: 6,
      callback: () => this.incidentDust(this.ship.x - direction * landingScenery.incident.skidTrailBehindPx, "skidTrail"),
    });

    this.tweens.add({
      targets: this.ship,
      x: endX,
      y: startY + 8,
      visualRotation: this.landingState.rotation + direction * 1.18,
      duration: 470,
      ease: "Cubic.easeOut",
      onComplete: () => this.createThrusterMisfire(),
    });
  }

  private animateTiltTipIncident(): void {
    const config = landingScenery.incident;
    const direction = this.incidentTiltDirection();
    const startX = this.landingState.x;
    const startY = this.restingCenterY();

    this.ship.setPosition(startX, startY);
    this.incidentDust(startX, "tiltTip");

    // Wobble on one leg first, then topple over: reads as "geometry won".
    this.tweens.chain({
      targets: this.ship,
      tweens: [
        { visualRotation: direction * 0.62, duration: 160, ease: "Quad.easeOut" },
        { visualRotation: direction * 0.42, duration: 120, ease: "Sine.easeInOut" },
        {
          x: clamp(startX + direction * config.tipShiftPx, this.playMinX, this.playMaxX),
          y: startY + 18,
          visualRotation: direction * 1.42,
          duration: 300,
          ease: "Back.easeOut",
          onComplete: () => {
            this.createShockRing(this.ship.x, this.contactY, colors.plum);
            this.createThrusterMisfire();
          },
        },
      ],
    });
  }

  private animateOffPadIncident(): void {
    const config = landingScenery.incident;
    const direction = this.incidentHorizontalDirection();
    const startX = clamp(this.landingState.x, this.playMinX, this.playMaxX);
    const startY = this.restingCenterY();

    this.ship.setPosition(startX, startY);
    this.incidentDust(startX, "offPad");
    this.createShockRing(startX, this.contactY, colors.duskBlue);

    // Plops into soft moon dust and tips over: wrong blanket.
    this.tweens.add({
      targets: this.ship,
      x: clamp(startX + direction * config.offPadShiftPx, this.playMinX, this.playMaxX),
      y: startY + 14,
      visualRotation: this.landingState.rotation + direction * 0.72,
      duration: 520,
      ease: "Quad.easeIn",
      onComplete: () => {
        this.incidentDust(this.ship.x, "offPadPlop");
      },
    });
  }

  /** A pixel ellipse outline (art-grid cells) that grows and steps down in alpha: the impact shock ring. */
  private createShockRing(x: number, y: number, color: string): void {
    const config = landingScenery.incident;
    const ring = this.add.graphics().setDepth(depth.worldFx).setPosition(snapToGrid(x, CELL), snapToGrid(y, CELL));
    const fill = colorNumber(color);
    const state = { t: 0 };
    let lastRadius = -1;
    const draw = (): void => {
      const eased = 1 - (1 - state.t) * (1 - state.t);
      const radius = snapToGrid(Phaser.Math.Linear(config.shockRingRadiusPx * 0.2, config.shockRingRadiusPx, eased), CELL * 2);
      ring.setAlpha(0.8 * (1 - Math.floor(state.t * 4) / 4));
      if (radius === lastRadius) return;
      lastRadius = radius;
      ring.clear();
      ring.fillStyle(fill, 1);
      drawSpans(ring, 0, 0, outlineEllipseSpans(radius, Math.max(CELL * 2, radius * 0.28), CELL), CELL);
    };
    draw();
    this.tweens.add({
      targets: state,
      t: 1,
      duration: config.shockRingMs,
      ease: "Linear",
      onUpdate: draw,
      onComplete: () => ring.destroy(),
    });
  }

  /** The bottom thruster coughs a few pixel sparks out of the nozzle (shared fx burst, no vectors). */
  private createThrusterMisfire(): void {
    const bottom = bottomVector(this.ship.visualRotation);
    const nozzle = this.shipLayout.footPx;
    // Behind the hull: the sparks cough out from under the dumpling instead of over its face.
    burstIncident(this, this.ship.x + bottom.x * nozzle, this.ship.y + bottom.y * nozzle, { count: 8, spread: 60, depth: depth.ship - 1 });
  }

  /** Drift arrow for the frozen incident readout (a skid slides the way the ship was drifting). */
  private driftArrow(): string {
    const deadband = landingScenery.readouts.driftArrowDeadbandPxPerSecond;
    const vx = this.landingState.velocityX;
    if (vx > deadband) return landingCopy.driftArrows.right;
    if (vx < -deadband) return landingCopy.driftArrows.left;
    return "";
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

  // --- HUD ------------------------------------------------------------------------------------

  /** HUD scale: compactUiScale, boosted a little more on phone-class displays for ~12 CSS px labels. */
  private hudScale(): number {
    const base = compactUiScale(this);
    return isCompactDisplay(this) ? base * landingScenery.hud.compactBoost : base;
  }

  private buildHud(): void {
    const uiScale = this.hudScale();
    const dashboard = new LandingDashboard(this, {
      compact: isCompactDisplay(this), scale: uiScale,
      title: this.theme.legacy ? undefined : this.mission.shortTitle.toLowerCase() + campaignLandingCopy.titleSuffix,
      showNote: !this.theme.legacy,
    });
    const touchPads = this.touchLayout ? new LandingTouchPads(this, compactUiScale(this)) : undefined;
    const hint = this.touchLayout ? undefined : createLandingControlsHint(this, uiScale, isCompactDisplay(this) ? "top-right" : "bottom");
    const retryChip = this.touchLayout ? this.createRetryChip(compactUiScale(this)) : undefined;
    const wind = this.theme.legacy || this.definition.wind.kind === "none" ? undefined : new LandingWindIndicator(this, this.definition.wind, uiScale, isCompactDisplay(this));
    this.hud = { dashboard, hint, touchPads, retryChip, uiScale, wind };
    this.aids.setUiScale(compactUiScale(this));
    if (this.phase.kind === "intro") this.setHudAlpha(0);
  }

  /** Small parchment "retry" chip pinned to the top-right corner (touch layouts have no R key). */
  private createRetryChip(uiScale: number): Button {
    const config = landingScenery.retryChip;
    const chip = new Button(this, {
      x: 0,
      y: 0,
      label: landingCopy.touchRetry,
      variant: "secondary",
      fixed: true,
      uiScale,
      onActivate: () => this.requestRetry(),
    });
    chip
      .setPosition(
        snapToGrid(this.scale.width - config.marginX - chip.buttonWidth, CELL),
        snapToGrid(config.marginY, CELL),
      )
      .setDepth(depth.hud);
    return chip;
  }

  private rebuildHudIfNeeded(): void {
    const hud = this.hud;
    if (!hud || Math.abs(hud.uiScale - this.hudScale()) < 0.01) return;
    hud.dashboard.destroy();
    hud.hint?.destroy();
    hud.touchPads?.destroy();
    hud.retryChip?.destroy();
    hud.wind?.destroy();
    this.hud = undefined;
    this.buildHud();
    this.updateDashboard();
  }

  private setHudAlpha(alpha: number): void {
    const hud = this.hud;
    if (!hud) return;
    hud.dashboard.setAlpha(alpha);
    hud.hint?.setAlpha(alpha);
    hud.touchPads?.setAlpha(alpha);
    hud.retryChip?.setAlpha(alpha);
    hud.wind?.setAlpha(alpha);
  }

  private fadeHudIn(durationMs: number): void {
    const fade = { value: 0 };
    this.tweens.add({
      targets: fade,
      value: 1,
      duration: durationMs,
      ease: "Sine.easeOut",
      onUpdate: () => this.setHudAlpha(fade.value),
      onComplete: () => this.setHudAlpha(1),
    });
  }

  private updateDashboard(immediateNote = false): void {
    const hud = this.hud;
    if (!hud) return;
    if (!this.theme.legacy) {
      if (this.time.now - this.lastCampaignHudMs < 100) return;
      this.lastCampaignHudMs = this.time.now;
      hud.wind?.update(this.environment.wind);
    }
    const readouts = this.readouts;
    hud.dashboard.update(
      {
        descent: readouts.descent,
        drift: readouts.drift,
        tilt: readouts.tilt,
        altitude: readouts.altitude,
        pad: readouts.pad,
        packageLabel: this.packageWord(),
        note: this.dashboardNote(),
      },
      this.time.now,
      immediateNote || this.phase.kind !== "descending",
    );
  }

  /** Package condition in the dashboard's lowercase voice. */
  private packageWord(): string {
    return packageConditionLabel(this.packageCondition).toLowerCase();
  }

  private dashboardNote(): string {
    if (!this.theme.legacy) {
      if (this.phase.kind === "incident") return campaignLandingCopy.incidentNotes[this.phase.incidentKind];
      if (this.phase.kind === "settling" || this.phase.kind === "delivered") return this.mission.dashboard.afterTouchdown;
      if (this.phase.kind === "intro") return this.mission.dashboard.landingIntro;
      const note = campaignLandingNote({
        definition: this.definition, clockMs: this.landingClockMs, wind: this.environment.wind, altitude: this.reading.altitude,
        introNoteMs: campaignLandingScenery.introNoteMs, calmAltitude: campaignLandingScenery.calmNoteAltitude,
      });
      if (note !== null) return this.mission.dashboard[note];
      return this.alignment.onPad ? this.mission.dashboard.landingCalm : campaignLandingCopy.notes.offPad;
    }
    const notes = landingCopy.notes;
    const hud = landingScenery.hud;
    switch (this.phase.kind) {
      case "incident":
        return landingCopy.incidentNotes[this.phase.incidentKind];
      case "settling":
      case "delivered":
        return notes.settling;
      case "intro":
        return notes.descendingIdle;
      case "descending":
        break;
    }
    if (this.time.now - this.retryAtMs < hud.retryNoteMs) return notes.retry;
    if (!this.alignment.onPad) return notes.offPad;
    if (this.controls.stabilizer) return notes.stabilizing;
    if (this.controls.thrust) return notes.thrusting;
    if (this.reading.angleDegrees > this.definition.tuning.safeAngleDegrees * hud.tiltNoteRatio) return notes.tilted;
    return notes.descendingIdle;
  }

  // --- Input, readings, visuals ---------------------------------------------------------------

  private readControls(): LandingControls {
    const touch = this.hud?.touchPads?.read() ?? NO_CONTROLS;
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

  /** One reading per frame; the HUD and the in-world gauge both format from this same object. */
  private refreshReadings(): void {
    const contact = landingContactState(this.definition.collisionModel, this.landingState, this.environment.pad);
    this.reading = readPadLandingZone(this.definition.collisionModel, this.landingState, this.environment.pad, this.definition.tuning);
    this.alignment = padAlignment(this.landingState, this.pad);
    this.readouts = buildLandingReadouts(this.reading, contact.velocityX, contact.velocityY, undefined, this.definition.tuning);
  }

  /** On touch layouts the ship never flies (or crashes) underneath the tile columns. */
  private computePlayBounds(): void {
    const radius = this.definition.tuning.shipRadius;
    this.playMinX = radius;
    this.playMaxX = this.scale.width - radius;
    if (!this.touchLayout) return;
    const tiles = landingTouchTiles(this.scale.width, this.scale.height);
    this.playMinX = Math.max(this.playMinX, tiles.rotateRight.x + tiles.rotateRight.width + radius);
    this.playMaxX = Math.min(this.playMaxX, tiles.thrust.x - radius);
  }

  private keepShipInsideView(): void {
    const radius = this.definition.tuning.shipRadius;
    const state = this.landingState;
    const x = clamp(state.x, this.playMinX, this.playMaxX);
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
   * Places the integer-scale sprite so its measured feet sit on the visual contact line (the physics
   * contact line y + shipRadius, dropped onto the blanket's top face), along the ship's down axis, in
   * whole art px. The flame is the baked ship-fly frame for the current thrust power.
   */
  private updateShipVisual(): void {
    const footPx = this.shipLayout.footPx;
    const rotation = this.landingState.rotation + this.settleTilt.value;
    const bottom = bottomVector(rotation);
    const centerOffset = this.definition.tuning.shipRadius + (this.contactY - this.pad.surfaceY) - footPx;
    const dip = Math.round(this.dip.value / CELL) * CELL;

    this.ship.setKinematicState(
      {
        x: snapToGrid(this.landingState.x + bottom.x * centerOffset + this.introShip.offsetX, CELL),
        y: snapToGrid(this.landingState.y + bottom.y * centerOffset + this.introShip.offsetY, CELL) + dip,
        rotation,
        velocityX: this.landingState.velocityX,
        velocityY: this.landingState.velocityY,
      },
      false,
    );
    this.showFlameFrame(rotation);
  }

  /**
   * Swaps in the baked flame frame for the current thrust power, at the same RotSprite angle cell the
   * ship entity picked (falls back to the upright frame if the rotated sheet is missing).
   */
  private showFlameFrame(rotation: number): void {
    const frame = this.flameFrame;
    if (frame <= 0) return;
    const rotatedKey = FLY_ROT_FRAMES[frame - 1] ?? ASSET.shipFly1Rot;
    if (this.textures.exists(rotatedKey)) {
      this.ship.setTexture(rotatedKey, rotationCellIndex(rotation)).setOrigin(0.5, 0.5);
      return;
    }
    this.ship.setTexture(FLY_FRAMES[frame - 1] ?? ASSET.shipFly1).setOrigin(this.shipLayout.originX, this.shipLayout.originY);
  }

  /** Puffs leave the tip of whichever baked flame is showing, at the sheet's integer art scale. */
  private updateThrustTrail(): void {
    const frame = this.flameFrame;
    // The intro glide relies on the baked flame alone: puffs left behind a tweened sprite read as smoke.
    const active = frame > 0 && this.phase.kind === "descending";
    const tip = frame > 0 ? (this.shipLayout.flameTipsPx[frame - 1] ?? this.shipLayout.flameTipPx) : this.shipLayout.footPx;
    const distance = Math.max(this.shipLayout.footPx, tip - landingScenery.thrust.trailInsetPx);
    const bottom = bottomVector(this.ship.visualRotation);
    this.thrustTrail.update(
      this.ship.x + bottom.x * distance,
      this.ship.y + bottom.y * distance,
      this.ship.visualRotation,
      active,
      this.thrustPower * landingScenery.thrust.trailIntensity,
    );
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
