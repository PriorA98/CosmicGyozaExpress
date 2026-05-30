import type { FlightPrototypeRoute } from "../types/flight";

export const flightPrototypeRoute: FlightPrototypeRoute = {
  id: "phase-1-tea-moon-test-route",
  label: "Tea Moon flight-feel route",
  world: {
    width: 3200,
    height: 1800,
  },
  start: {
    x: 320,
    y: 930,
    rotation: Math.PI / 2,
    velocityX: 0,
    velocityY: 0,
  },
  checkpoint: {
    x: 320,
    y: 930,
    rotation: Math.PI / 2,
    velocityX: 0,
    velocityY: 0,
  },
  destination: {
    id: "tea-moon-dock",
    label: "Tea Moon dock",
    x: 2840,
    y: 850,
    radius: 132,
    approachRadius: 430,
    requiredFacingRadians: Math.PI / 2,
  },
  obstacles: [
    { id: "soft-asteroid-01", label: "sleepy rock", x: 780, y: 760, radius: 68 },
    { id: "soft-asteroid-02", label: "rice pebble", x: 1180, y: 1060, radius: 84 },
    { id: "soft-asteroid-03", label: "tea stone", x: 1640, y: 720, radius: 92 },
    { id: "soft-asteroid-04", label: "mochi chunk", x: 2090, y: 1030, radius: 76 },
    { id: "soft-asteroid-05", label: "tiny moon crumb", x: 2460, y: 640, radius: 58 },
  ],
  backgroundPlanets: [
    { textureKey: "planet-im-fine", x: 620, y: 360, scale: 0.16, alpha: 0.5 },
    { textureKey: "planet-tea-moon", x: 2900, y: 835, scale: 0.2, alpha: 0.78 },
  ],
} as const;
