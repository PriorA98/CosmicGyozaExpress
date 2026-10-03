import Phaser from "phaser";
import { resolveMission, routeForMission } from "../data/campaign";
import { themeFor, type CampaignThemeDefinition } from "../data/campaign/themes";
import { flightHudCopy, flightLines, shipVisualStyle, asteroidVisuals, campaignFlightCopy, campaignRockTextures, campaignAsteroidVisual } from "../data/flightScenery";
import {
  arrivalGateTuning,
  arrivalHandoffTuning,
  cameraTuning,
  campaignFlightTuning,
  collisionTuning,
  dockingTuning,
  flightNoteTuning,
  respawnTuning,
  shipTuning,
} from "../data/tuning";
import { installDevSceneHotkeys } from "../dev/DevSceneLauncher";
import { registerDevState } from "../dev/devProbe";
import { ArrivalBeacon } from "../entities/flight/ArrivalBeacon";
import { Asteroid } from "../entities/flight/Asteroid";
import { DestinationIndicator } from "../entities/flight/DestinationIndicator";
import { FlightDashboard, type FlightDashboardMode } from "../entities/flight/FlightDashboard";
import { ShipEngine } from "../entities/flight/ShipEngine";
import { SpaceBackdrop } from "../entities/flight/SpaceBackdrop";
import { TeaMoon } from "../entities/flight/TeaMoon";
import { CampaignDestination } from "../entities/flight/CampaignDestination";
import { RoutePickups, RouteLanterns, RouteCheckpoints } from "../entities/flight/RouteMarkers";
import { ForceZoneCues, FogLayer, drawMotionTracks } from "../entities/flight/RouteMechanicsCues";
import { advanceSimClock, pickRockTexture, windsockFrame, simulationSteps } from "../entities/flight/flightCueMath";
import { GyozaShip, resolveShipArtLayout } from "../entities/GyozaShip";
import { burstDust, burstIncident, burstSparkles, shakeCamera, isReducedMotion } from "../fx/feedback";
import { handoffToScene } from "../fx/transitions";
import { colorNumber, colors, depth } from "../game/designTokens";
import { emitGameEvent } from "../game/events";
import {
  createArrivalGateState,
  shouldEmitArrivalProgress,
  updateArrivalGate,
  type ArrivalGateState,
} from "../systems/ArrivalGateSystem";
import { classifyCollision, findFirstCollision, resolveCircleCollision, resolveMovingCollision, sweptMovingContact } from "../systems/CollisionSystem";
import { sampleForceField, type ForceFieldSample } from "../systems/ForceFieldSystem";
import { sampleMovingObstacles, type MovingObstacleState } from "../systems/MotionPathSystem";
import { collectAlongSegment, checkpointAt, beaconsInReach } from "../systems/CollectibleSystem";
import { SaveSystem } from "../systems/SaveSystem";
import type { FlightRouteDefinition, MissionDefinitionV2, GustPhase, CheckpointDefinition } from "../types/campaign";
import { dockingHint, evaluateDocking } from "../systems/DockingSystem";
import { applyPackageConditionEvent } from "../systems/PackageConditionSystem";
import { bottomFacingRadians, bottomVector, integrateShipMovement } from "../systems/ShipMovementSystem";
import type { LandingSceneData } from "../types/landing";
import type {
  CollisionContact,
  CollisionSeverity,
  DockingState,
  FlightSceneData,
  ShipControls,
  ShipKinematicState,
} from "../types/flight";
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

type FlightMode =
  | { readonly kind: "flying" }
  | {
      readonly kind: "incident";
      readonly startedAtMs: number;
      readonly respawnAtMs: number;
      readonly resumeAtMs: number;
      hasRespawned: boolean;
    }
  | { readonly kind: "arriving"; readonly startedAtMs: number };

type BoundsResolution = {
  readonly state: ShipKinematicState;
  readonly severity: CollisionSeverity;
};

type BumpSeverity = Exclude<CollisionSeverity, "none">;

const NO_CONTROLS: ShipControls = { thrust: false, brake: false, rotateLeft: false, rotateRight: false };

const SEVERITY_RANK: Readonly<Record<CollisionSeverity, number>> = {
  none: 0,
  "soft-bump": 1,
  "dramatic-bump": 2,
  "gyoza-incident": 3,
};

/** Idle bob fades out as speed rises (px/s at which bob is fully gone). */
const IDLE_BOB_FADE_SPEED = 160;

export class FlightScene extends Phaser.Scene {
  private ship!: GyozaShip;
  private engine!: ShipEngine;
  private keys!: FlightKeys;
  private backdrop!: SpaceBackdrop;
  private beacon!: ArrivalBeacon;
  private moon!: TeaMoon | CampaignDestination;
  private route!: FlightRouteDefinition;
  private mission!: MissionDefinitionV2;
  private theme!: CampaignThemeDefinition;
  private simTimeMs = 0;
  private environment: ForceFieldSample = { acceleration: { x: 0, y: 0 }, magnitude: 0, zones: [], dominant: null };
  private movingObstacles: readonly MovingObstacleState[] = [];
  private previousMovingObstacles: readonly MovingObstacleState[] = [];
  private movingContacts = new Set<string>();
  private collectedIds: ReadonlySet<string> = new Set();
  private shownBeaconIds = new Set<string>();
  private reachedCheckpointIds = new Set<string>();
  private checkpoint: CheckpointDefinition | null = null;
  private gustPhases = new Map<string, GustPhase>();
  private pickups: RoutePickups | undefined;
  private lanterns: RouteLanterns | undefined;
  private checkpointMarkers: RouteCheckpoints | undefined;
  private forceCues: ForceZoneCues | undefined;
  private fog: FogLayer | undefined;
  private mechanicIntroduced = false;
  private mechanicIntroPending = false;
  private nextGustNoteMs = 0;
  private nextMechanicNoteMs = 0;
  private nextHudMs = 0;
  private indicator!: DestinationIndicator;
  private hud!: FlightDashboard;
  private asteroids = new Map<string, Asteroid>();
  private debugGraphics: Phaser.GameObjects.Graphics | undefined;
  private readonly cameraTarget = new Phaser.Math.Vector2();
  private readonly lookAhead = new Phaser.Math.Vector2();
  private flightMode: FlightMode = { kind: "flying" };
  private packageCondition = 100;
  private debugVisible = false;
  private lastDashboardLine: string = flightLines.start;
  private dashboardLineUntilMs = 0;
  private badDockCooldownUntilMs = 0;
  private collisionCooldownUntilMs = 0;
  private invulnerableUntilMs = 0;
  private arrivalGate: ArrivalGateState = createArrivalGateState();
  private arrivalProgress = 0;
  private lastProgressEmitMs: number | undefined;
  private lastControls: ShipControls = NO_CONTROLS;
  private routeStartedAtMs = 0;
  private routeCrashes = 0;
  private sceneData: FlightSceneData = {};

  constructor() {
    super("FlightScene");
  }

  init(data: FlightSceneData | undefined): void {
    this.sceneData = data ?? {};
    this.mission = resolveMission(data?.missionId);
    this.route = routeForMission(this.mission.id);
    this.theme = themeFor(this.mission.themeId);
  }

  create(): void {
    emitGameEvent(this, { type: "scene:enter", scene: "FlightScene" });

    this.asteroids = new Map();
    this.lastControls = NO_CONTROLS;
    this.lastProgressEmitMs = undefined;
    this.debugVisible = false;
    this.lookAhead.set(0, 0);

    const shipLayout = resolveShipArtLayout(this, shipVisualStyle.legacyFlightScale);
    this.backdrop = new SpaceBackdrop(this, this.route.world.height, this.theme.legacy ? undefined : this.theme, this.route.start);
    this.moon = this.theme.legacy ? new TeaMoon(this) : new CampaignDestination(this, this.route.destination, this.theme);
    this.beacon = new ArrivalBeacon(this, this.route.destination, shipLayout, this.theme.legacy ? flightHudCopy.beaconLabel : campaignFlightCopy.beaconLabel, this.theme.legacy ? undefined : `flight-beacon-${this.theme.id}`, this.theme.legacy ? undefined : this.moon.bodyCenter);
    this.createAsteroids();
    this.createRouteMechanics();

    const initialStart = this.sceneData.start ?? this.route.start;
    this.engine = new ShipEngine(this, {
      engine: shipLayout.contract ? shipVisualStyle.engineOffsetArt * shipLayout.scale : shipVisualStyle.legacyEngineOffset,
      trail: shipLayout.contract ? shipVisualStyle.trailOffsetArt * shipLayout.scale : shipVisualStyle.legacyTrailOffset,
    });
    this.ship = new GyozaShip(this, initialStart);
    this.ship.applyArtLayout(shipLayout).setDepth(depth.ship);

    const camera = this.cameras.main;
    camera.setBounds(0, 0, this.route.world.width, this.route.world.height);
    this.cameraTarget.set(initialStart.x, initialStart.y);
    camera.startFollow(this.cameraTarget, true, cameraTuning.followLerpX, cameraTuning.followLerpY);
    camera.centerOn(initialStart.x, initialStart.y);

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

    this.indicator = new DestinationIndicator(this, this.route.destination, this.theme.legacy ? flightHudCopy.indicatorLabel : this.mission.shortTitle.toLowerCase(), this.theme.legacy ? 0 : campaignFlightTuning.hudCueIntervalMs);
    this.hud = this.theme.legacy ? new FlightDashboard(this) : new FlightDashboard(this, { title: this.mission.shortTitle.toLowerCase(), distance: campaignFlightCopy.distance });
    const applyUiScale = (): void => {
      this.indicator.setUiScale(this.hud.uiScale);
      this.beacon.setUiScale(this.hud.uiScale);
      // World labels stay clear of the touch pads / hint strip (re-read after the HUD re-lays out).
      this.indicator.setAvoidRects(this.hud.labelAvoidRects);
      this.beacon.setAvoidRects(this.hud.labelAvoidRects);
    };
    applyUiScale();
    const onResize = (): void => applyUiScale();
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, onResize));
    this.debugGraphics = import.meta.env.DEV ? this.add.graphics().setDepth(depth.foreground) : undefined;

    this.restartFlight(this.theme.legacy ? this.time.now : 0, initialStart);
    this.packageCondition = this.sceneData.packageCondition ?? 100;
    this.routeCrashes = this.sceneData.routeCrashes ?? 0;
    emitGameEvent(this, { type: "mission:start", missionId: this.missionId() });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.engine.destroy();
      for (const asteroid of this.asteroids.values()) asteroid.destroy();
      this.asteroids.clear();
      this.pickups?.destroy();
      this.lanterns?.destroy();
      this.checkpointMarkers?.destroy();
      this.forceCues?.destroy();
      this.fog?.destroy();
      if (this.moon instanceof CampaignDestination) this.moon.destroy();
    });

    registerDevState("flight", () => ({
      ship: this.ship.kinematics,
      mode: this.flightMode.kind,
      packageCondition: this.packageCondition,
      routeCrashes: this.routeCrashes,
      docking: evaluateDocking(this.ship.kinematics, this.route.destination).kind,
      arrivalProgress: this.arrivalProgress,
      debugVisible: this.debugVisible,
      camera: { scrollX: Math.round(this.cameras.main.scrollX), scrollY: Math.round(this.cameras.main.scrollY) },
      missionId: this.mission.id,
      simTimeMs: this.simTimeMs,
      environment: { ax: this.environment.acceleration.x, ay: this.environment.acceleration.y, phase: this.environment.dominant?.phase ?? this.environment.zones.find((zone) => this.gustPhases.has(zone.zoneId))?.phase ?? "calm" },
      movingObstacles: this.movingObstacles.map((obstacle) => ({ id: obstacle.id, x: obstacle.position.x, y: obstacle.position.y, vx: obstacle.velocity.x, vy: obstacle.velocity.y, radius: obstacle.radius })),
      collectedIds: [...this.collectedIds],
      checkpointId: this.checkpoint?.id ?? null,
      destination: this.route.destination,
      world: this.route.world,
    }));
  }

  override update(time: number, delta: number): void {
    this.handleUtilityKeys(this.theme.legacy ? time : this.simTimeMs);

    const controls = this.readControls();
    this.emitControlEdges(controls);

    if (this.theme.legacy) {
      this.simTimeMs = advanceSimClock(this.simTimeMs, delta, campaignFlightTuning.maxSimStepMs);
      if (this.flightMode.kind === "incident") this.updateIncident(time);
      else this.updateFlying(controls, time, delta);
    } else {
      for (const stepMs of simulationSteps(delta, campaignFlightTuning.maxSimStepMs, campaignFlightTuning.substepMs)) {
        this.simTimeMs += stepMs;
        this.sampleRouteEnvironment();
        if (this.flightMode.kind === "incident") this.updateIncident(this.simTimeMs);
        else this.updateFlying(controls, this.simTimeMs, stepMs);
      }
      time = this.simTimeMs;
      this.updateMechanicNotes(time);
    }

    const docking = evaluateDocking(this.ship.kinematics, this.route.destination);
    if (this.flightMode.kind === "flying") this.updateArrivalGate(docking, time);

    this.updateVisuals(docking, controls, time, delta);
  }

  // --- Simulation -----------------------------------------------------------------------

  private updateFlying(controls: ShipControls, time: number, delta: number): void {
    const previous = this.ship.kinematics;
    const moved = this.theme.legacy
      ? integrateShipMovement(previous, controls, delta / 1000)
      : integrateShipMovement(previous, controls, delta / 1000, shipTuning, this.environment.acceleration);
    const bounded = this.resolveWorldBounds(moved);
    this.ship.setKinematicState(bounded.state, controls.thrust);

    if (this.flightMode.kind !== "flying") return;
    this.handleBoundsCollision(bounded.severity, time);

    if (time >= this.invulnerableUntilMs) {
      this.handleObstacleCollision(time, controls.thrust, previous);
      this.handleBadDocking(evaluateDocking(this.ship.kinematics, this.route.destination), time);
    }
    if (!this.theme.legacy && this.flightMode.kind === "flying") this.updateRouteProgress(previous, time);
  }

  private readControls(): ShipControls {
    if (this.flightMode.kind !== "flying") return NO_CONTROLS;

    const touch = this.hud.controls;
    return {
      thrust: this.keys.W.isDown || this.keys.UP.isDown || touch.thrust,
      brake: this.keys.S.isDown || this.keys.DOWN.isDown || touch.brake,
      rotateLeft: this.keys.A.isDown || this.keys.LEFT.isDown || touch.rotateLeft,
      rotateRight: this.keys.D.isDown || this.keys.RIGHT.isDown || touch.rotateRight,
    };
  }

  /** Thrust/brake events fire only when the held state changes. */
  private emitControlEdges(controls: ShipControls): void {
    if (controls.thrust !== this.lastControls.thrust) {
      emitGameEvent(this, { type: "flight:thrust", active: controls.thrust });
    }
    if (controls.brake !== this.lastControls.brake) {
      emitGameEvent(this, { type: "flight:brake", active: controls.brake });
    }
    this.lastControls = controls;
  }

  private handleUtilityKeys(time: number): void {
    if (Phaser.Input.Keyboard.JustDown(this.keys.R) && this.flightMode.kind !== "arriving") {
      this.restartFlight(time);
      emitGameEvent(this, { type: "mission:start", missionId: this.missionId() });
    }

    const debugPressed = Phaser.Input.Keyboard.JustDown(this.keys.F1) || Phaser.Input.Keyboard.JustDown(this.keys.BACKTICK);
    if (debugPressed && this.debugGraphics) {
      this.debugVisible = !this.debugVisible;
      this.setDashboardLine(this.debugVisible ? flightLines.debugOn : flightLines.debugOff, time);
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) {
      this.setDashboardLine(flightLines.pause, time);
    }
  }

  private resolveWorldBounds(state: ShipKinematicState): BoundsResolution {
    let next = state;
    let impactSeverity: CollisionSeverity = "none";
    const radius = shipTuning.collisionRadius;

    if (next.x < radius && next.velocityX < 0) {
      impactSeverity = strongerSeverity(impactSeverity, classifyCollision(Math.abs(next.velocityX)));
      next = { ...next, x: radius, velocityX: Math.abs(next.velocityX) * collisionTuning.boundaryBounce };
    } else if (next.x > this.route.world.width - radius && next.velocityX > 0) {
      impactSeverity = strongerSeverity(impactSeverity, classifyCollision(Math.abs(next.velocityX)));
      next = {
        ...next,
        x: this.route.world.width - radius,
        velocityX: -Math.abs(next.velocityX) * collisionTuning.boundaryBounce,
      };
    }

    if (next.y < radius && next.velocityY < 0) {
      impactSeverity = strongerSeverity(impactSeverity, classifyCollision(Math.abs(next.velocityY)));
      next = { ...next, y: radius, velocityY: Math.abs(next.velocityY) * collisionTuning.boundaryBounce };
    } else if (next.y > this.route.world.height - radius && next.velocityY > 0) {
      impactSeverity = strongerSeverity(impactSeverity, classifyCollision(Math.abs(next.velocityY)));
      next = {
        ...next,
        y: this.route.world.height - radius,
        velocityY: -Math.abs(next.velocityY) * collisionTuning.boundaryBounce,
      };
    }

    return { state: next, severity: impactSeverity };
  }

  private handleBoundsCollision(severity: CollisionSeverity, time: number): void {
    if (severity === "none") return;

    if (severity === "gyoza-incident") {
      this.triggerIncident(time, flightLines.boundsIncident);
      return;
    }

    if (time < this.collisionCooldownUntilMs) return;

    this.applyBump(severity, flightLines.boundsBump, time, undefined);
    this.collisionCooldownUntilMs = time + collisionTuning.collisionCooldownMs;
  }

  private handleObstacleCollision(time: number, thrusting: boolean, previous: ShipKinematicState): void {
    if (!this.theme.legacy && this.handleMovingObstacleCollision(previous, time, thrusting)) return;
    const contact = findFirstCollision(
      { x: this.ship.kinematics.x, y: this.ship.kinematics.y, radius: shipTuning.collisionRadius },
      this.route.obstacles,
    );

    if (!contact) return;

    const severity = classifyCollision(this.ship.speed());
    const resolved = resolveCircleCollision(this.ship.kinematics, contact, severity);
    this.ship.setKinematicState(resolved, thrusting);

    if (severity === "none") return;

    if (severity === "gyoza-incident") {
      this.asteroids.get(contact.obstacleId)?.react(severity, contact.normalX, contact.normalY, time);
      this.triggerIncident(time, flightLines.incident);
      return;
    }

    if (time < this.collisionCooldownUntilMs) return;

    this.applyBump(severity, this.theme.legacy ? (severity === "soft-bump" ? flightLines.softBump : flightLines.dramaticBump) : this.mission.dashboard.bump, time, contact);
    this.collisionCooldownUntilMs = time + collisionTuning.collisionCooldownMs;
  }

  private handleBadDocking(docking: DockingState, time: number): void {
    if (!docking.inDeliveryZone || docking.kind === "ready") return;

    if (docking.kind === "align") {
      if (time >= this.badDockCooldownUntilMs) {
        this.setDashboardLine(flightLines.align, time);
        this.badDockCooldownUntilMs = time + dockingTuning.badDockCooldownMs;
      }
      return;
    }

    if (docking.kind !== "slow-down" || time < this.badDockCooldownUntilMs) return;

    const dx = this.ship.kinematics.x - this.route.destination.x;
    const dy = this.ship.kinematics.y - this.route.destination.y;
    const distance = Math.max(1, vectorLength(dx, dy));
    const normalX = dx / distance;
    const normalY = dy / distance;
    const next: ShipKinematicState = {
      ...this.ship.kinematics,
      x: this.ship.kinematics.x + normalX * dockingTuning.badDockPushPx,
      y: this.ship.kinematics.y + normalY * dockingTuning.badDockPushPx,
      velocityX: this.ship.kinematics.velocityX + normalX * dockingTuning.badDockBounceSpeed,
      velocityY: this.ship.kinematics.velocityY + normalY * dockingTuning.badDockBounceSpeed,
    };

    this.ship.setKinematicState(next, false);
    this.ship.playSquash(shipVisualStyle.squash["soft-bump"], shipVisualStyle.squashMs);
    this.badDockCooldownUntilMs = time + dockingTuning.badDockCooldownMs;
    this.setDashboardLine(flightLines.slowDown, time);
  }

  /** Soft or dramatic bump: package condition, feedback, and the `flight:bump` event. */
  private applyBump(severity: Exclude<BumpSeverity, "gyoza-incident">, line: string, time: number, contact: CollisionContact | undefined): void {
    this.packageCondition = applyPackageConditionEvent(this.packageCondition, severity);
    this.setDashboardLine(line, time);

    const { x, y } = this.ship.kinematics;
    const hitX = contact ? x - contact.normalX * shipTuning.collisionRadius : x;
    const hitY = contact ? y - contact.normalY * shipTuning.collisionRadius : y;
    emitGameEvent(this, { type: "flight:bump", severity, x: hitX, y: hitY });

    if (contact) this.asteroids.get(contact.obstacleId)?.react(severity, contact.normalX, contact.normalY, time);
    this.ship.playSquash(shipVisualStyle.squash[severity], shipVisualStyle.squashMs);
    this.ship.flashHull(colorNumber(shipVisualStyle.bumpFlashColor), shipVisualStyle.bumpFlashMs[severity], shipVisualStyle.bumpFlashMode, {
      color: colorNumber(shipVisualStyle.bumpFlashSettleColor),
      peakMs: shipVisualStyle.bumpFlashPeakMs,
    });
    burstDust(this, hitX, hitY, { count: severity === "soft-bump" ? 12 : 16, spread: severity === "soft-bump" ? 48 : 70, depth: depth.shipFx });
    if (severity === "dramatic-bump") shakeCamera(this, "soft");
  }

  private triggerIncident(time: number, line: string): void {
    if (this.flightMode.kind !== "flying") return;

    this.routeCrashes += 1;
    this.packageCondition = applyPackageConditionEvent(this.packageCondition, "gyoza-incident");
    this.setDashboardLine(line, time, respawnTuning.respawnDelayMs + flightNoteTuning.incidentExtraMs);
    this.flightMode = {
      kind: "incident",
      startedAtMs: time,
      respawnAtMs: time + respawnTuning.respawnDelayMs,
      resumeAtMs: time + respawnTuning.respawnDelayMs + respawnTuning.resumeDelayMs,
      hasRespawned: false,
    };
    this.collisionCooldownUntilMs = time + respawnTuning.respawnDelayMs + collisionTuning.collisionCooldownMs;
    this.ship.setIncidentFrame(1);

    const { x, y } = this.ship.kinematics;
    emitGameEvent(this, { type: "flight:bump", severity: "gyoza-incident", x, y });
    burstIncident(this, x, y, { depth: depth.shipFx });
    shakeCamera(this, "medium");
  }

  private updateIncident(time: number): void {
    if (this.flightMode.kind !== "incident") return;

    if (!this.flightMode.hasRespawned) {
      const elapsed = time - this.flightMode.startedAtMs;
      const frame = clamp(Math.floor(elapsed / respawnTuning.incidentFrameMs) + 1, 1, respawnTuning.incidentFrameCount);
      this.ship.setIncidentFrame(frame);
    }

    if (!this.flightMode.hasRespawned && time >= this.flightMode.respawnAtMs) {
      this.flightMode.hasRespawned = true;
      const respawn = this.theme.legacy ? this.route.checkpoint : this.checkpoint?.respawn ?? this.route.start;
      this.ship.setKinematicState(respawn, false);
      this.ship.playSquash(shipVisualStyle.squash["dramatic-bump"], shipVisualStyle.squashMs);
      this.invulnerableUntilMs = time + respawnTuning.invulnerableMs;
      this.setDashboardLine(flightLines.respawn, time);
      burstSparkles(this, respawn.x, respawn.y, { count: 12, spread: 60, depth: depth.shipFx });
      emitGameEvent(this, { type: "flight:respawn" });
    }

    if (time >= this.flightMode.resumeAtMs) {
      this.flightMode = { kind: "flying" };
    }
  }

  private restartFlight(time: number, start: ShipKinematicState = this.route.start): void {
    this.simTimeMs = 0;
    if (!this.theme.legacy) time = 0;
    this.checkpoint = null;
    this.reachedCheckpointIds.clear();
    this.checkpointMarkers?.reset();
    this.movingContacts.clear();
    this.gustPhases.clear();
    this.mechanicIntroduced = false;
    this.mechanicIntroPending = false;
    this.nextGustNoteMs = 0;
    this.nextMechanicNoteMs = 0;
    this.nextHudMs = 0;
    this.flightMode = { kind: "flying" };
    this.packageCondition = 100;
    this.routeCrashes = 0;
    this.routeStartedAtMs = time;
    this.arrivalGate = createArrivalGateState();
    this.arrivalProgress = 0;
    this.lastProgressEmitMs = undefined;
    this.badDockCooldownUntilMs = 0;
    this.collisionCooldownUntilMs = 0;
    this.invulnerableUntilMs = time + respawnTuning.restartGraceMs;
    this.setDashboardLine(this.theme.legacy ? flightLines.start : this.mission.dashboard.routeStart, time, flightNoteTuning.startMs);

    if (this.ship) {
      this.ship.setKinematicState(start, false);
      this.lookAhead.set(0, 0);
      // Start already composed (e.g. a restart near the moon frames the whole moon at once).
      this.frameCameraTarget(start.x, start.y, start.x, start.y);
      this.cameras.main.centerOn(this.cameraTarget.x, this.cameraTarget.y);
      if (!this.theme.legacy) this.sampleRouteEnvironment();
    }
  }

  private updateArrivalGate(docking: DockingState, time: number): void {
    const gate = updateArrivalGate(this.arrivalGate, docking, time);
    this.arrivalGate = gate.state;
    this.arrivalProgress = gate.progress;

    if (docking.kind === "ready") {
      if (shouldEmitArrivalProgress(this.lastProgressEmitMs, time, gate.progress, arrivalGateTuning.progressEventIntervalMs)) {
        emitGameEvent(this, { type: "flight:arrival-progress", progress: gate.progress });
        this.lastProgressEmitMs = time;
      }
    } else if (this.lastProgressEmitMs !== undefined) {
      // The window broke: tell listeners the fill dropped back to zero.
      emitGameEvent(this, { type: "flight:arrival-progress", progress: 0 });
      this.lastProgressEmitMs = undefined;
    }

    if (gate.complete) this.startArrivalHandoff(time);
  }

  /**
   * Warm hand-off (<= 1.2 s): controls lock, the ship glides toward the moon while the camera
   * eases onto it, then an iris closes on the Tea Moon and LandingScene starts.
   */
  private startArrivalHandoff(time: number): void {
    const handoff = arrivalHandoffTuning;
    this.flightMode = { kind: "arriving", startedAtMs: time };
    this.setDashboardLine(flightLines.arrival, time, handoff.noteMs);
    emitGameEvent(this, { type: "flight:arrival-complete" });

    const ship = this.ship.kinematics;
    const moon = this.moon.bodyCenter;
    burstSparkles(this, ship.x, ship.y, { count: 16, spread: 90, depth: depth.shipFx });
    const dx = moon.x - ship.x;
    const dy = moon.y - ship.y;
    const distance = Math.max(1, vectorLength(dx, dy));
    this.ship.setKinematicState(
      { ...ship, velocityX: (dx / distance) * handoff.glideSpeed, velocityY: (dy / distance) * handoff.glideSpeed },
      false,
    );

    const camera = this.cameras.main;
    camera.stopFollow();
    camera.removeBounds();
    camera.pan(moon.x, moon.y, handoff.panMs, "Sine.easeInOut");

    const payload: LandingSceneData = {
      missionId: this.missionId(),
      packageCondition: this.packageCondition,
      routeCrashes: this.routeCrashes,
      routeDurationMs: Math.max(0, time - this.routeStartedAtMs),
    };
    this.time.delayedCall(handoff.irisDelayMs, () => {
      const { width, height } = this.scale;
      // Typed story beat: warm flash pop, then the pixel iris closes on the moon (screen centre after the pan).
      handoffToScene(this, "LandingScene", payload, { x: width / 2, y: height / 2 }, handoff.irisMs);
    });
  }

  // --- Presentation ---------------------------------------------------------------------

  private updateVisuals(docking: DockingState, controls: ShipControls, time: number, delta: number): void {
    const incident = this.flightMode.kind === "incident" && !this.flightMode.hasRespawned;
    const speed = this.ship.speed();

    const bobStrength = incident ? 0 : clamp(1 - speed / IDLE_BOB_FADE_SPEED, 0, 1);
    this.ship.animateIdle(
      time,
      { bobPx: shipVisualStyle.bobPx, bobPeriodMs: shipVisualStyle.bobPeriodMs, tiltRadians: shipVisualStyle.tiltBobRadians },
      bobStrength,
    );
    this.engine.update(this.ship.visualX, this.ship.visualY, this.ship.visualRotation, controls.thrust, speed, time, !incident);

    for (const asteroid of this.asteroids.values()) asteroid.update(time);
    this.forceCues?.update(this.simTimeMs, this.environment.zones, this.ship.kinematics, this.hud.labelAvoidRects);
    this.fog?.update(this.simTimeMs);
    this.pickups?.update(this.simTimeMs);

    this.updateCameraTarget(delta);
    this.backdrop.update(time);
    this.beacon.update(docking, this.arrivalProgress, time);
    this.indicator.update(docking, time);
    this.updateHud(docking, time);
    this.updateDebugGraphics();
  }

  /**
   * Camera leads the ship gently in its direction of travel, and near the Tea Moon it blends
   * toward a framing point so the whole moon (teahouse included) stays composed with the ship.
   */
  private updateCameraTarget(delta: number): void {
    const { x, y, velocityX, velocityY } = this.ship.kinematics;
    const targetX = clamp(velocityX * cameraTuning.lookAheadSeconds, -cameraTuning.maxLookAheadX, cameraTuning.maxLookAheadX);
    const targetY = clamp(velocityY * cameraTuning.lookAheadSeconds, -cameraTuning.maxLookAheadY, cameraTuning.maxLookAheadY);
    const ease = clamp((delta / 1000) * cameraTuning.lookAheadEasePerSecond, 0, 1);
    this.lookAhead.x += (targetX - this.lookAhead.x) * ease;
    this.lookAhead.y += (targetY - this.lookAhead.y) * ease;

    this.frameCameraTarget(x, y, x + this.lookAhead.x, y + this.lookAhead.y);
  }

  /** Sets the camera target to the follow point, blended toward the moon framing point when close. */
  private frameCameraTarget(shipX: number, shipY: number, followX: number, followY: number): void {
    const dock = this.route.destination;
    const framing = this.route.cameraFraming;
    const span = Math.max(1, framing.radius - dock.approachRadius);
    const closeness = clamp((framing.radius - vectorLength(shipX - dock.x, shipY - dock.y)) / span, 0, 1);
    const blend = closeness * closeness * (3 - 2 * closeness);
    const targetX = followX + (framing.point.x - followX) * blend * framing.maxBlendX;
    const targetY = followY + (framing.point.y - followY) * blend * framing.maxBlendY;
    // Keep the ship comfortably inside the view however strong the framing pull is.
    const reachX = Math.max(0, this.scale.width / 2 - cameraTuning.framingSafeMarginPx);
    const reachY = Math.max(0, this.scale.height / 2 - cameraTuning.framingSafeMarginPx);
    this.cameraTarget.set(clamp(targetX, shipX - reachX, shipX + reachX), clamp(targetY, shipY - reachY, shipY + reachY));
  }

  private updateHud(docking: DockingState, time: number): void {
    if (!this.theme.legacy && time < this.nextHudMs) return;
    this.nextHudMs = time + campaignFlightTuning.hudCueIntervalMs;
    if (!this.theme.legacy) this.updateForceGauge();
    let note: string;
    if (time < this.dashboardLineUntilMs) note = this.lastDashboardLine;
    else if (docking.kind === "ready") note = flightHudCopy.ready;
    else note = dockingHint(docking, this.theme.legacy ? undefined : this.mission.shortTitle);

    const mode: FlightDashboardMode = this.flightMode.kind;
    this.hud.update({
      speed: this.ship.speed(),
      distance: docking.distance,
      bottomDegrees: radiansToCompassDegrees(bottomFacingRadians(this.ship.kinematics.rotation)),
      packageCondition: this.packageCondition,
      dockingKind: docking.kind,
      mode,
      note,
    });
  }

  private setDashboardLine(line: string, time: number, durationMs: number = flightNoteTuning.defaultMs): void {
    this.lastDashboardLine = line;
    this.dashboardLineUntilMs = time + durationMs;
  }

  private updateDebugGraphics(): void {
    const g = this.debugGraphics;
    if (!g) return;
    g.clear();
    if (!this.debugVisible) return;

    const state = this.ship.kinematics;
    const bottom = bottomVector(state.rotation);
    const velocityScale = 0.46;
    const bottomLength = 118;

    g.lineStyle(1, colorNumber(colors.plaster), 0.2);
    g.strokeRect(0, 0, this.route.world.width, this.route.world.height);
    g.lineStyle(2, colorNumber(colors.sage), 0.92);
    g.lineBetween(state.x, state.y, state.x + bottom.x * bottomLength, state.y + bottom.y * bottomLength);
    g.lineStyle(2, colorNumber(colors.ember), 0.92);
    g.lineBetween(state.x, state.y, state.x + state.velocityX * velocityScale, state.y + state.velocityY * velocityScale);
    g.lineStyle(1, colorNumber(colors.plum), 0.62);
    g.strokeCircle(state.x, state.y, shipTuning.collisionRadius);
    g.lineStyle(1, colorNumber(colors.duskBlue), 0.46);
    for (const obstacle of this.route.obstacles) {
      g.strokeCircle(obstacle.x, obstacle.y, obstacle.radius);
    }
  }

  private createAsteroids(): void {
    this.route.obstacles.forEach((obstacle, index) => {
      const visual = this.theme.legacy
        ? asteroidVisuals.find((candidate) => candidate.obstacleId === obstacle.id)
        : campaignAsteroidVisual(obstacle.id, obstacle.radius, index, pickRockTexture(campaignRockTextures, obstacle.radius, index));
      this.asteroids.set(obstacle.id, new Asteroid(this, obstacle, visual, index));
    });
  }

  private createRouteMechanics(): void {
    this.pickups = undefined;
    this.lanterns = undefined;
    this.checkpointMarkers = undefined;
    this.forceCues = undefined;
    this.fog = undefined;
    this.environment = { acceleration: { x: 0, y: 0 }, magnitude: 0, zones: [], dominant: null };
    this.shownBeaconIds = new Set();
    this.reachedCheckpointIds = new Set();
    this.movingContacts = new Set();
    this.gustPhases = new Map();
    this.collectedIds = new Set();
    this.movingObstacles = sampleMovingObstacles(this.route.movingObstacles, 0);
    this.previousMovingObstacles = this.movingObstacles;
    if (this.theme.legacy) return;
    this.cameras.main.setBackgroundColor(this.theme.palette.skyTop);
    const memories = new Set(SaveSystem.load().collectedMemories);
    this.collectedIds = new Set(this.route.collectibles.filter((collectible) => memories.has(collectible.memoryId)).map((collectible) => collectible.id));
    const reducedMotion = isReducedMotion();
    this.pickups = new RoutePickups(this, this.route.collectibles, this.collectedIds, this.theme, reducedMotion);
    this.lanterns = new RouteLanterns(this, this.route.beacons, this.theme);
    this.checkpointMarkers = new RouteCheckpoints(this, this.route.checkpoints, this.theme);
    this.forceCues = new ForceZoneCues(this, this.route.forceZones, this.theme, reducedMotion);
    if (this.route.visibility.kind === "fog") this.fog = new FogLayer(this, this.route.visibility, reducedMotion);
    drawMotionTracks(this, this.route.movingObstacles, this.theme);
    this.movingObstacles.forEach((obstacle, index) => {
      this.asteroids.set(obstacle.id, new Asteroid(this, { ...obstacle.position, id: obstacle.id, label: obstacle.label, radius: obstacle.radius }, undefined, this.route.obstacles.length + index, obstacle.textureKey, this.theme.palette.accent));
    });
  }

  /** Store one sample: physics, cues, and the dev probe all consume it. */
  private sampleRouteEnvironment(): void {
    this.environment = sampleForceField(this.route.forceZones, this.ship.kinematics, this.simTimeMs, this.route.maxEnvironmentAcceleration);
    this.previousMovingObstacles = this.movingObstacles;
    this.movingObstacles = sampleMovingObstacles(this.route.movingObstacles, this.simTimeMs);
    for (const obstacle of this.movingObstacles) this.asteroids.get(obstacle.id)?.moveTo(obstacle.position.x, obstacle.position.y);
    for (const zone of this.route.forceZones) {
      if (zone.kind !== "gust") continue;
      const sample = this.environment.zones.find((candidate) => candidate.zoneId === zone.id);
      if (sample && this.gustPhases.get(zone.id) !== sample.phase) {
        this.gustPhases.set(zone.id, sample.phase);
        emitGameEvent(this, { type: "flight:gust-phase", zoneId: zone.id, phase: sample.phase });
      }
    }
  }

  private handleMovingObstacleCollision(previous: ShipKinematicState, time: number, thrusting: boolean): boolean {
    const ship = this.ship.kinematics;
    for (const obstacle of this.movingObstacles) {
      const radius = shipTuning.collisionRadius + obstacle.radius;
      if (Math.hypot(ship.x - obstacle.position.x, ship.y - obstacle.position.y) > radius + campaignFlightTuning.movingContactReleasePx) this.movingContacts.delete(obstacle.id);
      const prior = this.previousMovingObstacles.find((candidate) => candidate.id === obstacle.id) ?? obstacle;
      const contact = sweptMovingContact(previous, ship, shipTuning.collisionRadius, prior.position, { ...obstacle.position, id: obstacle.id, label: obstacle.label, radius: obstacle.radius });
      if (!contact) continue;
      const resolved = resolveMovingCollision(ship, contact, obstacle.velocity);
      this.ship.setKinematicState(resolved.state, thrusting);
      const alreadyContacting = this.movingContacts.has(obstacle.id);
      this.movingContacts.add(obstacle.id);
      if (alreadyContacting || time < this.collisionCooldownUntilMs || resolved.severity === "none") return true;
      this.collisionCooldownUntilMs = time + collisionTuning.collisionCooldownMs;
      if (resolved.severity === "gyoza-incident") {
        this.asteroids.get(obstacle.id)?.react(resolved.severity, contact.normalX, contact.normalY, time);
        this.triggerIncident(time, flightLines.incident);
      } else this.applyBump(resolved.severity, this.mission.dashboard.bump, time, contact);
      return true;
    }
    return false;
  }

  private updateRouteProgress(previous: ShipKinematicState, time: number): void {
    const collected = collectAlongSegment(previous, this.ship.kinematics, shipTuning.collisionRadius, this.route.collectibles, this.collectedIds);
    this.collectedIds = collected.collectedIds;
    for (const collectible of collected.newlyCollected) {
      this.pickups?.collect(collectible.id);
      const { x, y } = collectible.position;
      emitGameEvent(this, { type: "flight:collectible", collectibleId: collectible.id, memoryId: collectible.memoryId, x, y });
      burstSparkles(this, x, y, { count: 12, spread: 60, depth: depth.shipFx });
      this.setDashboardLine(this.mission.dashboard.collectible, time, campaignFlightTuning.collectibleNoteMs);
    }
    const checkpoint = checkpointAt(this.route.checkpoints, this.ship.kinematics);
    if (checkpoint && !this.reachedCheckpointIds.has(checkpoint.id)) {
      this.reachedCheckpointIds.add(checkpoint.id);
      this.checkpoint = checkpoint;
      this.checkpointMarkers?.activate(checkpoint.id);
      emitGameEvent(this, { type: "flight:checkpoint", checkpointId: checkpoint.id });
      this.setDashboardLine(this.mission.dashboard.checkpoint, time, campaignFlightTuning.checkpointNoteMs);
    }
    for (const beacon of beaconsInReach(this.route.beacons, this.ship.kinematics, this.shownBeaconIds)) {
      this.shownBeaconIds.add(beacon.id);
      this.lanterns?.markShown(beacon.id);
      emitGameEvent(this, { type: "flight:beacon", beaconId: beacon.id });
      this.setDashboardLine(beacon.message, time, campaignFlightTuning.beaconNoteMs);
    }
  }

  private updateMechanicNotes(time: number): void {
    if (this.flightMode.kind !== "flying") return;
    const dominant = this.environment.dominant;
    const nearbyRock = this.movingObstacles.some((obstacle) => Math.hypot(obstacle.position.x - this.ship.kinematics.x, obstacle.position.y - this.ship.kinematics.y) - obstacle.radius - shipTuning.collisionRadius < campaignFlightTuning.movingIntroDistancePx);
    if ((dominant?.influence ?? 0) >= campaignFlightTuning.mechanicIntroInfluence || nearbyRock) this.mechanicIntroPending = true;
    const gust = this.route.forceZones.find((zone) => zone.id === dominant?.zoneId && zone.kind === "gust");
    if (gust && dominant?.phase === "warning" && time >= this.nextGustNoteMs) {
      this.nextGustNoteMs = time + campaignFlightTuning.gustWarningIntervalMs;
      this.setDashboardLine(this.mission.dashboard.gustWarning, time, campaignFlightTuning.mechanicNoteMs);
      return;
    }
    if (time < this.dashboardLineUntilMs) return;
    if (!this.mechanicIntroduced && this.mechanicIntroPending) {
      this.mechanicIntroduced = true;
      this.nextMechanicNoteMs = time + campaignFlightTuning.mechanicActiveIntervalMs;
      this.setDashboardLine(this.mission.dashboard.mechanicIntro, time, campaignFlightTuning.mechanicNoteMs);
    } else if (this.mechanicIntroduced && time >= this.nextMechanicNoteMs && (nearbyRock || this.environment.magnitude >= this.route.maxEnvironmentAcceleration * campaignFlightTuning.mechanicActiveFraction)) {
      this.nextMechanicNoteMs = time + campaignFlightTuning.mechanicActiveIntervalMs;
      this.setDashboardLine(this.mission.dashboard.mechanicActive, time, campaignFlightTuning.mechanicNoteMs);
    }
  }

  private updateForceGauge(): void {
    const sample = this.environment.dominant;
    const zone = this.route.forceZones.find((candidate) => candidate.id === sample?.zoneId);
    if (!zone || !sample) {
      this.hud.setForceCue(null);
      return;
    }
    const magnitude = this.environment.magnitude;
    const direction = this.environment.acceleration;
    const active = magnitude >= campaignFlightTuning.forceCueMinMagnitude;
    this.hud.setForceCue({
      label: zone.kind === "gust" && sample.phase === "warning" ? campaignFlightCopy.gustWarningLabel : campaignFlightCopy.forceLabel[zone.kind],
      directionX: active ? direction.x / magnitude : 0,
      directionY: active ? direction.y / magnitude : 0,
      strength: magnitude / this.route.maxEnvironmentAcceleration,
      windsockFrame: zone.kind === "gust" ? windsockFrame(sample.phase, sample.envelope) : null,
    });
  }

  private missionId(): string {
    return this.mission.id;
  }
}

function strongerSeverity(a: CollisionSeverity, b: CollisionSeverity): CollisionSeverity {
  return SEVERITY_RANK[b] > SEVERITY_RANK[a] ? b : a;
}
