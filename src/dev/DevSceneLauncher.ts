import Phaser from "phaser";
import { colors } from "../game/designTokens";
import {
  DEV_SCENE_LAUNCHES,
  findDevSceneLaunchForKeyEvent,
  isDevToolsEnabled,
  type DevSceneLaunchDefinition,
} from "./devSceneLaunches";

type DevSceneLauncherPanelOptions = {
  readonly x?: number;
  readonly y?: number;
  readonly launches?: readonly DevSceneLaunchDefinition[];
};

export function startDevScene(scene: Phaser.Scene, launch: DevSceneLaunchDefinition): void {
  scene.scene.start(launch.sceneKey, launch.data?.());
}

export function installDevSceneHotkeys(
  scene: Phaser.Scene,
  launches: readonly DevSceneLaunchDefinition[] = DEV_SCENE_LAUNCHES,
): void {
  if (!isDevToolsEnabled()) return;

  const keyboard = scene.input.keyboard;
  if (!keyboard) return;

  const handler = (event: KeyboardEvent): void => {
    const launch = findDevSceneLaunchForKeyEvent(event, launches);
    if (!launch) return;

    event.preventDefault();
    startDevScene(scene, launch);
  };

  keyboard.on("keydown", handler);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => keyboard.off("keydown", handler));
}

export function createDevSceneLauncherPanel(
  scene: Phaser.Scene,
  options: DevSceneLauncherPanelOptions = {},
): Phaser.GameObjects.Container | undefined {
  if (!isDevToolsEnabled()) return undefined;

  const launches = options.launches ?? DEV_SCENE_LAUNCHES;
  const width = 276;
  const rowHeight = 42;
  const height = 52 + launches.length * rowHeight;
  const x = options.x ?? scene.scale.width - width - 18;
  const y = options.y ?? scene.scale.height - height - 18;
  const panel = scene.add.container(x, y).setDepth(90).setScrollFactor(0);
  const background = scene.add
    .rectangle(0, 0, width, height, Phaser.Display.Color.HexStringToColor(colors.cosmosPanel).color, 0.9)
    .setOrigin(0, 0);
  background.setStrokeStyle(1, 0xfbf7ec, 0.22);

  const title = scene.add.text(14, 12, "dev scene launch", {
    color: colors.plaster,
    fontFamily: "monospace",
    fontSize: "12px",
    fontStyle: "bold",
  });

  panel.add([background, title]);

  launches.forEach((launch, index) => {
    const rowY = 40 + index * rowHeight;
    const button = scene.add
      .rectangle(12, rowY, width - 24, 34, Phaser.Display.Color.HexStringToColor(colors.inkSoft).color, 0.82)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    button.setStrokeStyle(1, 0xfbf7ec, 0.18);

    const label = scene.add.text(24, rowY + 7, `${launch.shortcutLabel}  ${launch.label}`, {
      color: colors.plaster,
      fontFamily: "monospace",
      fontSize: "12px",
    });
    const description = scene.add.text(24, rowY + 21, launch.description, {
      color: "rgba(251,247,236,0.62)",
      fontFamily: "monospace",
      fontSize: "9px",
    });

    button.on("pointerdown", (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      startDevScene(scene, launch);
    });

    panel.add([button, label, description]);
  });

  return panel;
}
