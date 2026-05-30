import Phaser from "phaser";
import { TEA_MOON_MISSION_ID } from "../data/missions";
import { colors } from "../game/designTokens";
import { createDeliveryResultContent, createMissionResultSummary } from "../systems/MissionResultSystem";
import { SaveSystem } from "../systems/SaveSystem";
import type { DeliveryResultSceneData } from "../types/landing";

export class DeliveryResultScene extends Phaser.Scene {
  private resultData: DeliveryResultSceneData = {
    missionId: TEA_MOON_MISSION_ID,
    packageCondition: 100,
    routeCrashes: 0,
    routeDurationMs: 0,
    landingResult: "soft",
    landingIncidents: 0,
  };

  constructor() {
    super("DeliveryResultScene");
  }

  init(data: Partial<DeliveryResultSceneData>): void {
    this.resultData = {
      missionId: data.missionId ?? TEA_MOON_MISSION_ID,
      packageCondition: data.packageCondition ?? 100,
      routeCrashes: data.routeCrashes ?? 0,
      routeDurationMs: data.routeDurationMs ?? 0,
      landingResult: data.landingResult ?? "soft",
      landingIncidents: data.landingIncidents ?? 0,
    };
  }

  create(): void {
    const { width, height } = this.scale;
    const content = createDeliveryResultContent(this.resultData);

    SaveSystem.completeMission(
      content.missionId,
      createMissionResultSummary(content),
      content.memoryRewardId,
    );

    this.add.rectangle(0, 0, width, height, 0x1a1b2e).setOrigin(0, 0);
    this.add.image(width * 0.82, height * 0.48, "planet-tea-moon").setScale(0.23).setAlpha(0.5);

    const panel = this.add.rectangle(width / 2, height / 2, 760, 470, this.colorNumber(colors.parchmentWarm), 0.96);
    panel.setStrokeStyle(2, this.colorNumber(colors.terracottaDeep), 0.7);

    this.add
      .text(width / 2, height * 0.22, content.headline, {
        color: colors.ink,
        fontFamily: "serif",
        fontSize: "48px",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.32, `${content.deliveryItemName} -> ${content.recipientName}`, {
        color: colors.terracottaDeep,
        fontFamily: "monospace",
        fontSize: "16px",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.43, content.reactionLine, {
        color: colors.ink,
        fontFamily: "serif",
        fontSize: "24px",
        align: "center",
        wordWrap: { width: 620 },
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.56, content.reportLine, {
        color: colors.inkSoft,
        fontFamily: "monospace",
        fontSize: "15px",
        align: "center",
        wordWrap: { width: 620 },
      })
      .setOrigin(0.5);

    this.add
      .text(
        width / 2,
        height * 0.67,
        [
          `landing   ${content.landingLabel}`,
          `package   ${content.conditionLabel}`,
          `memory    Tea Moon postcard tucked into the glove compartment`,
        ],
        {
          color: colors.ink,
          fontFamily: "monospace",
          fontSize: "15px",
          lineSpacing: 8,
          align: "center",
        },
      )
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.84, "press enter to replay Tea Moon | click to return to title", {
        color: colors.plaster,
        fontFamily: "monospace",
        fontSize: "15px",
      })
      .setOrigin(0.5);

    this.input.keyboard?.once("keydown-ENTER", () => this.scene.start("FlightScene"));
    this.input.once("pointerdown", () => this.scene.start("TitleScene"));
  }

  private colorNumber(value: string): number {
    return Phaser.Display.Color.HexStringToColor(value).color;
  }
}
