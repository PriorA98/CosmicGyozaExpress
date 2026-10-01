import Phaser from "phaser";
import { installDevProbe } from "./dev/devProbe";
import { applyShowcaseSaveFixture } from "./dev/saveFixtures";
import { readRequestedShowcase } from "./dev/showcaseStates";
import { installFxSettings } from "./fx/fxSettings";
import { gameConfig } from "./gameConfig";
import { installAudioSystem } from "./systems/AudioSystem";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/components.css";
import "./styles/screens.css";

if (import.meta.env.DEV) {
  const showcase = readRequestedShowcase();
  if (showcase) applyShowcaseSaveFixture(showcase.save);
}

// Dev-only scenes load through a DEV-gated dynamic import so production bundles never include them.
const devScenes: Phaser.Types.Scenes.SceneType[] = import.meta.env.DEV
  ? [(await import("./dev/UiKitScene")).UiKitScene, (await import("./dev/FxGalleryScene")).FxGalleryScene]
  : [];
const baseScenes = Array.isArray(gameConfig.scene) ? gameConfig.scene : [];
const game = new Phaser.Game({ ...gameConfig, scene: [...baseScenes, ...devScenes] });
installAudioSystem(game);
// Syncs save.settings.reducedMotion (and the OS preference) into src/fx; re-syncs on settings:changed.
installFxSettings(game);

if (import.meta.env.DEV) {
  installDevProbe(game);
}
