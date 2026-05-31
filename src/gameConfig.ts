import Phaser from "phaser";
import { DeliveryResultScene } from "./scenes/DeliveryResultScene";
import { BootScene } from "./scenes/BootScene";
import { FlightScene } from "./scenes/FlightScene";
import { LandingScene } from "./scenes/LandingScene";
import { PreloadScene } from "./scenes/PreloadScene";
import { TitleScene } from "./scenes/TitleScene";

export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game-root",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: "#1A1B2E",
  pixelArt: true,
  roundPixels: true,
  render: {
    antialias: false,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, PreloadScene, TitleScene, FlightScene, LandingScene, DeliveryResultScene],
};
