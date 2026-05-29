export type FlightHudState = {
  speed: number;
  headingDegrees: number;
  velocityX: number;
  velocityY: number;
};

export type GameEvent =
  | { type: "flight:hud-update"; hud: FlightHudState }
  | { type: "flight:pause" }
  | { type: "flight:resume" }
  | { type: "mission:start"; missionId: string }
  | { type: "mission:completed"; missionId: string };
