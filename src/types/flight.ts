export type Point = {
  readonly x: number;
  readonly y: number;
};

export type ShipControls = {
  thrust: boolean;
  brake: boolean;
  rotateLeft: boolean;
  rotateRight: boolean;
};

export type ShipKinematicState = {
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
  readonly velocityX: number;
  readonly velocityY: number;
};

export type FlightWorldBounds = {
  readonly width: number;
  readonly height: number;
};

export type FlightDestinationDefinition = Point & {
  readonly id: string;
  readonly label: string;
  readonly radius: number;
  readonly approachRadius: number;
  readonly requiredBottomFacingRadians: number;
};

export type StaticObstacleDefinition = Point & {
  readonly id: string;
  readonly radius: number;
  readonly label: string;
};

export type BackgroundPlanetDefinition = Point & {
  readonly textureKey: string;
  readonly scale: number;
  readonly alpha: number;
};

export type FlightPrototypeRoute = {
  readonly id: string;
  readonly label: string;
  readonly world: FlightWorldBounds;
  readonly start: ShipKinematicState;
  readonly checkpoint: ShipKinematicState;
  readonly destination: FlightDestinationDefinition;
  readonly obstacles: readonly StaticObstacleDefinition[];
  readonly backgroundPlanets: readonly BackgroundPlanetDefinition[];
};

export type DockingStateKind = "too-far" | "approaching" | "slow-down" | "align" | "ready";

export type DockingState = {
  readonly kind: DockingStateKind;
  readonly distance: number;
  readonly speed: number;
  readonly angleDeltaRadians: number;
  readonly angleDeltaDegrees: number;
  readonly inApproachRange: boolean;
  readonly inDeliveryZone: boolean;
};

export type CollisionSeverity = "none" | "soft-bump" | "dramatic-bump" | "gyoza-incident";

export type CollisionCircle = Point & {
  readonly radius: number;
};

export type CollisionContact = {
  readonly obstacleId: string;
  readonly normalX: number;
  readonly normalY: number;
  readonly overlap: number;
  readonly distance: number;
};

export type PackageConditionEvent =
  | "soft-bump"
  | "dramatic-bump"
  | "gyoza-incident"
  | "bumpy-landing"
  | "landing-incident";

export type PackageConditionLabel =
  | "Perfect"
  | "Slightly shaken"
  | "Emotionally rotated"
  | "Warm but confused"
  | "Still delicious"
  | "Dramatically rearranged"
  | "Basically fine";
