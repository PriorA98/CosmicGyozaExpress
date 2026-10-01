import Phaser from "phaser";
import { installDevProbe } from "./dev/devProbe";
import { applyShowcaseSaveFixture } from "./dev/saveFixtures";
import { readRequestedShowcase } from "./dev/showcaseStates";
import { gameConfig } from "./gameConfig";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/components.css";
import "./styles/screens.css";

if (import.meta.env.DEV) {
  const showcase = readRequestedShowcase();
  if (showcase) applyShowcaseSaveFixture(showcase.save);
}

const game = new Phaser.Game(gameConfig);

if (import.meta.env.DEV) {
  installDevProbe(game);
}
