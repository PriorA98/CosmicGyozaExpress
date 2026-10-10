import { campaignLandingScenery, type LandingDecorProp } from "../../data/landingScenery";
import { mixHex } from "./colorMix";

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

/** The final windsock frames move their pole within the frame. Keep its world anchor fixed on every swap. */
export function windsockPlacement(frame: number, direction: number, topY: number, groundY: number): { originX: number; originY: number; cropRows: number } {
  const config = campaignLandingScenery.windsock;
  const x = config.poleArtX[frame] ?? config.poleArtX[0];
  const y = config.poleTopArtY[frame] ?? config.poleTopArtY[0];
  return {
    originX: direction < 0 ? 1 - x / config.frameArtWidth : x / config.frameArtWidth,
    originY: y / config.frameArtHeight,
    cropRows: Math.max(0, Math.min(config.frameArtHeight, y + Math.floor((groundY - topY) / config.sockScale))),
  };
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

/** Sky band colours top → bottom: sky top → sky bottom (upper 60 %), then sky bottom → the theme's horizon glow. */
export function campaignSkyBandColors(skyTop: string, skyBottom: string, horizon: string, bands: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < bands; i += 1) {
    const t = bands <= 1 ? 0 : i / (bands - 1);
    result.push(t < 0.6 ? mixHex(skyTop, skyBottom, t / 0.6) : mixHex(skyBottom, horizon, (t - 0.6) / 0.4));
  }
  return result;
}

/**
 * Where a decor prop stands: touch layouts use the authored `touchX` / `touchY` (null hides it) so props stay
 * clear of the slide / thrust pads; otherwise right-side pieces follow the recipient's touch shift.
 */
export function resolvePropPosition(prop: LandingDecorProp, touchLayout: boolean, recipientX: number): { x: number; y: number } | null {
  if (touchLayout && prop.touchX !== undefined) return prop.touchX === null ? null : { x: prop.touchX, y: prop.touchY ?? prop.y };
  const x = prop.x > 850 ? prop.x + recipientX - campaignLandingScenery.recipient.x : prop.x;
  return { x, y: prop.y };
}

export type AmbientMote = { readonly x: number; readonly phase: number; readonly speed: number };

/**
 * Ambient mote position at `timeMs`. Drift: dust sliding sideways through the apron air. Firefly: slow wander
 * near the ground with a blink. Rain: falls and slants with the sampled wind (`windX`, px/s²), so it never
 * contradicts the force the ship feels. Pure.
 */
export function ambientMotePosition(
  kind: "drift" | "firefly" | "rain", mote: AmbientMote, timeMs: number, windX: number,
): { x: number; y: number; alpha: number } {
  const ground = campaignLandingScenery.groundTopY;
  const s = timeMs / 1000;
  const turn = mote.phase * Math.PI * 2;
  if (kind === "drift") {
    const x = ((mote.x + s * 10 * mote.speed) % 1320 + 1320) % 1320 - 20;
    return { x, y: 180 + mote.phase * (ground - 220) + Math.sin(s * 0.6 * mote.speed + turn) * 10, alpha: 0.5 };
  }
  if (kind === "firefly") {
    const blink = Math.max(0, Math.sin(s * 1.4 * mote.speed + mote.phase * 21));
    return {
      x: mote.x + Math.sin(s * 0.7 * mote.speed + turn) * 26,
      y: ground - 24 - mote.phase * 150 + Math.cos(s * 0.5 * mote.speed + mote.phase * 9.4) * 12,
      alpha: 0.2 + 0.8 * blink,
    };
  }
  const span = ground + 40;
  const fall = (mote.phase * span + s * 380 * mote.speed) % span;
  const slant = Math.max(-0.7, Math.min(0.7, windX * 0.025));
  return { x: ((mote.x + fall * slant) % 1280 + 1280) % 1280, y: fall - 40, alpha: 0.3 };
}
