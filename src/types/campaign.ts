/**
 * Phase 3 campaign contracts (docs/implementation/phase-3-campaign-plan.md §3–§4).
 * Integrator-owned. Units: world px, px/s, px/s², ms for authored durations, radians for angles, +Y down.
 */
import type { LandingTuning } from "../data/landingTuning";
import type { FlightDestinationDefinition, FlightWorldBounds, Point, ShipKinematicState, StaticObstacleDefinition } from "./flight";
import type { LandingPadDefinition } from "./landing";
import type { MissionDefinition } from "./mission";

export type Vector2 = { readonly x: number; readonly y: number };

export type MissionId = "tea-moon" | "bento-belt" | "matcha-nebula" | "black-hole-bakery" | "im-fine" | "home-delivery";

/** Visual theme of a route / landing / result; picks scenery adapters and palette. */
export type ThemeId = "teaMoon" | "bentoBelt" | "matchaNebula" | "blackHoleBakery" | "imFine" | "home";

export type ZoneShape =
  | { readonly kind: "circle"; readonly center: Point; readonly radius: number }
  | { readonly kind: "rect"; readonly x: number; readonly y: number; readonly width: number; readonly height: number };

/** One gust cycle: warning → attack → sustain → release → calm, repeating. Warning and calm push nothing. */
export type GustCycle = {
  readonly warningMs: number;
  readonly attackMs: number;
  readonly sustainMs: number;
  readonly releaseMs: number;
  readonly calmMs: number;
  /** Shifts the cycle start: time 0 lands `phaseOffsetMs` into the cycle. */
  readonly phaseOffsetMs: number;
  /** When true, every odd cycle pushes the opposite way (the warning already shows the coming direction). */
  readonly alternate: boolean;
};

export type GustPhase = "calm" | "warning" | "attack" | "sustain" | "release";

export type ForceZoneDefinition =
  | {
      readonly kind: "radial-gravity";
      readonly id: string;
      readonly center: Point;
      readonly radius: number;
      /** Inside this radius the pull fades linearly to zero at the centre (no singularity). */
      readonly coreRadius: number;
      /** Pull at the core edge. `flat`: constant to the outer blend; `inverse`: peak * coreRadius / distance. */
      readonly peakAcceleration: number;
      readonly falloff: "flat" | "inverse";
      readonly edgeBlendPx: number;
      /** Oven mouth: entering `radius` swallows the ship and pops it out at `exit` (a funny relocation, never a loss). */
      readonly warp: GravityWarpDefinition | null;
    }
  | {
      readonly kind: "directional-current";
      readonly id: string;
      readonly area: ZoneShape;
      readonly acceleration: Vector2;
      readonly edgeBlendPx: number;
      /**
       * River model: when set, the push fades as the ship's speed along the flow approaches `flowSpeed` and
       * reverses (up to the same strength) when the ship outruns it, so the current carries rather than launches.
       */
      readonly flowSpeed: number | null;
    }
  | {
      readonly kind: "gust";
      readonly id: string;
      readonly area: ZoneShape;
      readonly peakAcceleration: Vector2;
      readonly edgeBlendPx: number;
      readonly cycle: GustCycle;
      readonly telegraph: "windsock-and-arrows";
    };

export type GravityWarpDefinition = {
  readonly radius: number;
  /** Where the white-hole "toaster" pops the ship back out, with its exit velocity. */
  readonly exit: ShipKinematicState;
};

/**
 * Tea-koi (cozy anglerfish): sleep at `home`, wake when a leaky noise meter (fills while the ship thrusts within
 * `hearingRadius`, drains `wakeThrustMs` per `listenWindowMs`) reaches `wakeThrustMs`, glide toward the ship,
 * lose interest after `giveUpMs` of quiet.
 * A touch is a "curious nibble": the ship returns to the last checkpoint.
 */
export type SeekerDefinition = {
  readonly id: string;
  readonly label: string;
  readonly home: Point;
  readonly radius: number;
  readonly hearingRadius: number;
  readonly wakeThrustMs: number;
  readonly listenWindowMs: number;
  /** Warning beat between waking and chasing (lure flares, eye opens). */
  readonly alertMs: number;
  readonly chaseSpeed: number;
  readonly chaseAcceleration: number;
  readonly giveUpMs: number;
  readonly returnSpeed: number;
  /** Never follows farther than this from home (a leash keeps every pool escapable). */
  readonly leashRadius: number;
};

export type MotionPathDefinition =
  | {
      readonly kind: "ping-pong";
      readonly from: Point;
      readonly to: Point;
      readonly periodMs: number;
      readonly phaseOffsetMs: number;
    }
  | {
      readonly kind: "orbit";
      readonly center: Point;
      readonly radiusX: number;
      readonly radiusY: number;
      readonly periodMs: number;
      readonly phaseRadians: number;
      readonly clockwise: boolean;
    };

export type MovingObstacleDefinition = {
  readonly id: string;
  readonly label: string;
  readonly radius: number;
  readonly textureKey: string;
  readonly path: MotionPathDefinition;
};

export type CollectibleDefinition = {
  readonly id: string;
  readonly kind: "postcard" | "star-crumb";
  readonly position: Point;
  readonly radius: number;
  /** Stored in save `collectedMemories` (distinct from mission memory rewards). */
  readonly memoryId: string;
  readonly textureKey: string;
  readonly frame: number;
};

export type VisibilityDefinition =
  | { readonly kind: "clear" }
  | {
      readonly kind: "fog";
      readonly area: ZoneShape;
      readonly textureKey: string;
      readonly maxAlpha: number;
      readonly driftPixelsPerSecond: Vector2;
      /** Dense fog: inside `area` only a lantern circle around the ship (and each lantern buoy) stays clear. */
      readonly dense: { readonly shipRadius: number; readonly lanternRadius: number; readonly alpha: number; readonly lanterns: readonly Point[] } | null;
    };

/** Silent checkpoint: crossing `activation` records `respawn` as the safe restart. */
export type CheckpointDefinition = {
  readonly id: string;
  readonly activation: Extract<ZoneShape, { kind: "rect" }>;
  readonly respawn: ShipKinematicState;
};

/** Proximity note (home route thank-you beacons); never stops the ship. */
export type RouteBeaconDefinition = {
  readonly id: string;
  readonly position: Point;
  readonly radius: number;
  readonly message: string;
};

export type CameraFramingDefinition = {
  readonly point: Point;
  readonly radius: number;
  readonly maxBlendX: number;
  readonly maxBlendY: number;
};

export type RouteId =
  | "phase-1-tea-moon-test-route"
  | "bento-belt-route"
  | "matcha-nebula-route"
  | "black-hole-bakery-route"
  | "im-fine-route"
  | "home-delivery-route";

/** Generalised flight route. Empty mechanics use empty arrays / `clear` variants, never undefined. */
export type FlightRouteDefinition = {
  readonly id: RouteId;
  readonly label: string;
  readonly themeId: ThemeId;
  readonly world: FlightWorldBounds;
  readonly start: ShipKinematicState;
  readonly checkpoint: ShipKinematicState;
  readonly destination: FlightDestinationDefinition;
  readonly obstacles: readonly StaticObstacleDefinition[];
  readonly movingObstacles: readonly MovingObstacleDefinition[];
  readonly forceZones: readonly ForceZoneDefinition[];
  readonly seekers: readonly SeekerDefinition[];
  readonly collectibles: readonly CollectibleDefinition[];
  readonly visibility: VisibilityDefinition;
  readonly checkpoints: readonly CheckpointDefinition[];
  readonly beacons: readonly RouteBeaconDefinition[];
  readonly cameraFraming: CameraFramingDefinition;
  /** Hard cap on summed environmental acceleration (px/s²). */
  readonly maxEnvironmentAcceleration: number;
};

export type PadMotionDefinition = { readonly kind: "fixed" } | { readonly kind: "path"; readonly path: MotionPathDefinition };

export type LandingWindDefinition =
  | { readonly kind: "none" }
  | { readonly kind: "steady"; readonly acceleration: Vector2 }
  | {
      readonly kind: "gust";
      readonly peakAcceleration: Vector2;
      readonly cycle: GustCycle;
      /** Wind fades from full at `fullyExposedAltitude` to zero at `calmBelowAltitude` (px above the pad). */
      readonly shelter: { readonly calmBelowAltitude: number; readonly fullyExposedAltitude: number } | null;
    }
  | {
      /** Layered mist: `upper` blows above `splitAltitude`, `lower` below, blended over `blendPx`. */
      readonly kind: "bands";
      readonly splitAltitude: number;
      readonly blendPx: number;
      readonly upper: Vector2;
      readonly lower: Vector2;
    };

export type LandingId =
  | "tea-moon-landing"
  | "bento-belt-landing"
  | "matcha-nebula-landing"
  | "black-hole-bakery-landing"
  | "im-fine-landing"
  | "home-delivery-landing";

export type LandingDefinition = {
  readonly id: LandingId;
  readonly themeId: ThemeId;
  /** Full tuning: per-landing gravity / start / surfaceY / padWidth live here. */
  readonly tuning: LandingTuning;
  /** Pad at time 0 (for a moving pad: centre of motion is irrelevant, the path owns centerX). */
  readonly pad: LandingPadDefinition;
  readonly padMotion: PadMotionDefinition;
  /** All shipped surfaces are level; non-zero tilt is rejected by validation (cut list item 6). */
  readonly surfaceTiltRadians: 0;
  readonly wind: LandingWindDefinition;
  /** Tea Moon keeps its legacy path; new landings measure drift relative to the (moving) pad. */
  readonly collisionModel: "legacy-horizontal" | "relative-pad";
};

export type PilotWaypoint = {
  readonly position: Point;
  readonly radius: number;
  readonly targetSpeed: number;
  /** Stop here and wait until the straight crossing to the next waypoint is clear of moving rocks. */
  readonly hold?: boolean;
  /** Keep thrust short (tea-koi listen for engines) on the way to this waypoint. */
  readonly quiet?: boolean;
};

export type MissionPilotHints = {
  readonly waypoints: readonly PilotWaypoint[];
  readonly arrivalSpeed: number;
  readonly obstacleLookaheadSeconds: number;
  readonly landing: {
    readonly targetRelativeDescent: number;
    readonly targetTangentOffset: number;
    readonly maximumTiltRadians: number;
  };
};

/** Teaching / flavour dashboard lines for a route + landing (one actionable sentence each). */
export type MissionDashboardCopy = {
  /** Shown once at route start. */
  readonly routeStart: string;
  /** Shown once when the ship first feels the route's mechanic (force zone / moving rock nearby). */
  readonly mechanicIntro: string;
  /** Repeated hint while the mechanic is strongly affecting the ship (throttled). */
  readonly mechanicActive: string;
  readonly checkpoint: string;
  readonly bump: string;
  readonly collectible: string;
  /** Landing intro / first descent line. */
  readonly landingIntro: string;
  /** Landing hint while the landing twist is active (pad moving, wind, gust warning). */
  readonly landingTwist: string;
  /** Gust warning line (gust missions only; otherwise reuse `landingTwist`). */
  readonly gustWarning: string;
  /** Sheltered / calm final approach line. */
  readonly landingCalm: string;
  readonly afterTouchdown: string;
};

/** Authored campaign mission: the slice's MissionDefinition plus campaign wiring. */
export type MissionDefinitionV2 = MissionDefinition & {
  readonly id: MissionId;
  readonly order: number;
  readonly shortTitle: string;
  readonly senderId: string;
  readonly routeId: RouteId;
  readonly landingId: LandingId;
  readonly themeId: ThemeId;
  readonly unlocksMissionIds: readonly MissionId[];
  readonly dashboard: MissionDashboardCopy;
  readonly pilotHints: MissionPilotHints;
  /** Optional closing line on the result card (I'm Fine, Home). */
  readonly closingLine: string | null;
};

/** Init data for MissionSelectScene (delivery board). */
export type MissionSelectSceneData = {
  /** Node to pre-select; defaults to the next suggested mission. */
  readonly focusMissionId?: MissionId;
};
