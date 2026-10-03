import { campaignLandingScenery } from "../../data/landingScenery";

/** Same slow warning rhythm for the wind chip and socks. Reduced motion holds a bright cue. */
export function gustWarningAlpha(clockMs: number, reducedMotion: boolean): number {
  return reducedMotion ? 1 : 0.78 + 0.22 * (0.5 + 0.5 * Math.cos(clockMs * Math.PI / 600));
}

/** Campaign gauge stays inside the screen and above the contact surface, at any compact UI scale. */
export function campaignGaugeY(shipY: number, scale: number, surfaceY: number, bottom: number): number {
  const minY = 18 + 80 * scale;
  const maxY = surfaceY - 8 - bottom * scale;
  return Math.max(minY, Math.min(shipY - 6, maxY));
}

/** Flour is clustered in the apron air, rising through a short band with a slow sideways drift. */
export function flourPosition(x: number, phase: number, speed: number, timeMs: number): { x: number; y: number } {
  const config = campaignLandingScenery.flour;
  const span = campaignLandingScenery.groundTopY - config.topY;
  const seconds = timeMs / 1000;
  const travel = (phase * span + seconds * config.riseSpeedPx * speed) % span;
  return {
    x: x + Math.sin(seconds * 0.5 * speed + phase * Math.PI * 2) * config.swayPx,
    y: campaignLandingScenery.groundTopY - travel,
  };
}
