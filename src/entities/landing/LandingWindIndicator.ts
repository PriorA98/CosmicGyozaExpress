import Phaser from "phaser";
import { campaignLandingCopy } from "../../data/landingCopy";
import { campaignLandingScenery, LANDING_ART_SCALE } from "../../data/landingScenery";
import { colorNumber, colors, depth, typeScale } from "../../game/designTokens";
import type { LandingWindSample } from "../../systems/LandingEnvironmentSystem";
import type { LandingWindDefinition } from "../../types/campaign";
import { monoStyle } from "../../ui";
import { fillNotchedRect } from "./pixelShapes";

const CELL = LANDING_ART_SCALE;

export type WindIndicatorWord = keyof typeof campaignLandingCopy.wind;

/** HUD word for a wind sample: steady crosswind, gust gathering / gusting, sheltered under the porch, calm. */
export function windIndicatorWord(wind: LandingWindDefinition, sample: LandingWindSample): Exclude<WindIndicatorWord, "label"> {
  if (wind.kind === "steady") return "steady";
  if (wind.kind === "none") return "calm";
  if (sample.phase === "warning") return "gathering";
  if (sample.envelope > 0 && sample.exposure <= 0) return "sheltered";
  if (sample.envelope > 0) return "gusting";
  return "calm";
}

/**
 * Screen-fixed wind chip (top centre): a pixel arrow pointing where the wind pushes, brightness following
 * the sampled strength, plus one word. Fed the same sample as the physics; the scene updates it at <= 10 Hz.
 */
export class LandingWindIndicator {
  private readonly root: Phaser.GameObjects.Container;
  private readonly arrow: Phaser.GameObjects.Graphics;
  private readonly word: Phaser.GameObjects.Text;
  private readonly wind: LandingWindDefinition;
  private readonly peak: number;
  private key = "";

  constructor(scene: Phaser.Scene, wind: LandingWindDefinition, uiScale: number) {
    this.wind = wind;
    const direction = wind.kind === "steady" ? wind.acceleration.x : wind.kind === "gust" ? wind.peakAcceleration.x : 1;
    this.peak = wind.kind === "steady" ? Math.abs(wind.acceleration.x) : wind.kind === "gust" ? Math.abs(wind.peakAcceleration.x) : 1;
    const config = campaignLandingScenery.windIndicator;
    const panel = scene.add.graphics();
    panel.fillStyle(colorNumber(colors.cosmosDeep), 0.45);
    fillNotchedRect(panel, -config.width / 2, CELL, config.width, config.height, CELL);
    panel.fillStyle(colorNumber(colors.cosmosPanel), 0.88);
    fillNotchedRect(panel, -config.width / 2, 0, config.width, config.height, CELL);
    const label = scene.add
      .text(-config.width / 2 + 10, config.height / 2, campaignLandingCopy.wind.label, monoStyle({ size: typeScale.xs, color: colors.plaster }))
      .setOrigin(0, 0.5);
    this.arrow = scene.add.graphics().setPosition(-4, config.height / 2).setScale(direction < 0 ? -1 : 1, 1);
    this.arrow.fillStyle(colorNumber(colors.amber), 1);
    this.arrow.fillRect(-12, -CELL, 18, CELL * 2);
    for (let i = 0; i < 4; i += 1) this.arrow.fillRect(6 + i * CELL - CELL, -CELL * (4 - i), CELL * 2, CELL * (4 - i) * 2);
    this.word = scene.add
      .text(config.width / 2 - 10, config.height / 2, "", monoStyle({ size: typeScale.xs, color: colors.amber, bold: true }))
      .setOrigin(1, 0.5);
    this.root = scene.add
      .container(Math.round(scene.scale.width / 2), Math.round(config.topPx * uiScale), [panel, label, this.arrow, this.word])
      .setScrollFactor(0, 0, true)
      .setScale(uiScale)
      .setDepth(depth.hud);
  }

  update(sample: LandingWindSample): void {
    const word = windIndicatorWord(this.wind, sample);
    const strength = this.peak > 0 ? Math.min(1, Math.abs(sample.acceleration.x) / this.peak) : 0;
    const alphaStep = Math.round((word === "gathering" ? 0.6 : 0.3 + strength * 0.7) * 4) / 4;
    const key = `${word}:${alphaStep}`;
    if (key === this.key) return;
    this.key = key;
    this.word.setText(campaignLandingCopy.wind[word]);
    this.arrow.setAlpha(alphaStep);
  }

  setAlpha(alpha: number): void {
    this.root.setAlpha(alpha);
  }

  destroy(): void {
    this.root.destroy();
  }
}
