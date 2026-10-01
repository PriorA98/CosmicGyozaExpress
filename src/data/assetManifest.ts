/**
 * Runtime texture manifest. PreloadScene loads every entry from `public/assets/`.
 *
 * Pixel contract: `artScale` is the integer display scale the art was authored for
 * (1 art pixel = artScale screen pixels at the 1280x720 logical resolution).
 * Sizes below are in art pixels. Spritesheets are horizontal strips of equal frames.
 *
 * Missing or failed files are replaced at runtime by a generated fallback texture of the
 * same size, so the game stays loadable while art is in production. The e2e harness
 * reports every failure; the final slice must ship with zero fallbacks in use.
 */
export type AssetFallback = {
  readonly color: string;
  readonly shape: "rect" | "circle";
};

type AssetBase = {
  readonly key: string;
  readonly path: string;
  readonly width: number;
  readonly height: number;
  readonly artScale: number;
  readonly fallback: AssetFallback;
};

export type ImageAssetEntry = AssetBase & { readonly kind: "image" };

export type SpritesheetAssetEntry = AssetBase & {
  readonly kind: "spritesheet";
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly frameCount: number;
};

export type AssetEntry = ImageAssetEntry | SpritesheetAssetEntry;

function image(
  key: string,
  path: string,
  width: number,
  height: number,
  artScale: number,
  color: string,
  shape: AssetFallback["shape"] = "rect",
): ImageAssetEntry {
  return { kind: "image", key, path, width, height, artScale, fallback: { color, shape } };
}

function sheet(
  key: string,
  path: string,
  frameWidth: number,
  frameHeight: number,
  frameCount: number,
  artScale: number,
  color: string,
  shape: AssetFallback["shape"] = "rect",
): SpritesheetAssetEntry {
  return {
    kind: "spritesheet",
    key,
    path,
    width: frameWidth * frameCount,
    height: frameHeight,
    frameWidth,
    frameHeight,
    frameCount,
    artScale,
    fallback: { color, shape },
  };
}

export const ASSET = {
  // Ship (existing art, normalized canvas; see docs/assets/asset-inventory.md)
  shipIdle: "ship-idle",
  shipFly1: "ship-fly-1",
  shipFly2: "ship-fly-2",
  shipFly3: "ship-fly-3",
  shipIncident1: "ship-incident-1",
  shipIncident2: "ship-incident-2",
  shipIncident3: "ship-incident-3",
  shipIncident4: "ship-incident-4",
  shipIncident5: "ship-incident-5",
  // Celestial
  planetTeaMoon: "planet-tea-moon",
  planetImFine: "planet-im-fine",
  celestialTeaMoon: "celestial-tea-moon",
  planetFarPlum: "planet-far-plum",
  celestialImFine: "celestial-im-fine",
  // Space layers
  spaceStarsFar: "space-stars-far",
  spaceStarsNear: "space-stars-near",
  spaceNebula: "space-nebula",
  // Asteroids
  asteroidSleepy: "asteroid-sleepy",
  asteroidRice: "asteroid-rice",
  asteroidTea: "asteroid-tea",
  asteroidMochi: "asteroid-mochi",
  asteroidCrumb: "asteroid-crumb",
  asteroidDebris: "asteroid-debris",
  // Lunar
  lunarSky: "lunar-sky",
  lunarHillsFar: "lunar-hills-far",
  lunarGround: "lunar-ground",
  lunarPad: "lunar-pad",
  lunarLantern: "lunar-lantern",
  lunarTeahouse: "lunar-teahouse",
  lunarRocks: "lunar-rocks",
  // Characters
  rabbitPortrait: "rabbit-portrait",
  rabbitSprite: "rabbit-sprite",
  // Items
  itemTea: "item-tea",
  itemMochi: "item-mochi",
  itemPackage: "item-package",
  itemSteam: "item-steam",
  memoryPostcard: "memory-postcard",
  // Particles
  fxThrust: "fx-thrust",
  fxDust: "fx-dust",
  fxSparkle: "fx-sparkle",
  fxSteam: "fx-steam",
  fxStar: "fx-star",
  // UI
  uiIcons: "ui-icons",
  uiPanelParchment: "ui-panel-parchment",
  uiPanelDark: "ui-panel-dark",
  uiButton: "ui-button",
  uiKeycap: "ui-keycap",
} as const;

export type AssetKey = (typeof ASSET)[keyof typeof ASSET];

/** Frame indices inside the `ui-icons` strip. */
export const UI_ICON_FRAME = {
  thrust: 0,
  package: 1,
  radar: 2,
  speed: 3,
  drift: 4,
  incident: 5,
  memory: 6,
  moon: 7,
  tea: 8,
  pause: 9,
  settings: 10,
  home: 11,
  soundOn: 12,
  soundOff: 13,
  keyboard: 14,
  touch: 15,
} as const;

export type UiIconName = keyof typeof UI_ICON_FRAME;

/** Frame indices inside the `rabbit-portrait` strip. */
export const RABBIT_PORTRAIT_FRAME = { idle: 0, blink: 1, happy: 2 } as const;

const SHIP_W = 144;
const SHIP_H = 160;

export const ASSET_MANIFEST: readonly AssetEntry[] = [
  image(ASSET.shipIdle, "assets/ship/gyoza-idle.png", SHIP_W, SHIP_H, 1, "#D4A055", "circle"),
  image(ASSET.shipFly1, "assets/ship/gyoza-fly-01.png", SHIP_W, SHIP_H, 1, "#D4A055", "circle"),
  image(ASSET.shipFly2, "assets/ship/gyoza-fly-02.png", SHIP_W, SHIP_H, 1, "#D4A055", "circle"),
  image(ASSET.shipFly3, "assets/ship/gyoza-fly-03.png", SHIP_W, SHIP_H, 1, "#D4A055", "circle"),
  image(ASSET.shipIncident1, "assets/ship/gyoza-incident-01.png", SHIP_W, SHIP_H, 1, "#C26954", "circle"),
  image(ASSET.shipIncident2, "assets/ship/gyoza-incident-02.png", SHIP_W, SHIP_H, 1, "#C26954", "circle"),
  image(ASSET.shipIncident3, "assets/ship/gyoza-incident-03.png", SHIP_W, SHIP_H, 1, "#C26954", "circle"),
  image(ASSET.shipIncident4, "assets/ship/gyoza-incident-04.png", SHIP_W, SHIP_H, 1, "#C26954", "circle"),
  image(ASSET.shipIncident5, "assets/ship/gyoza-incident-05.png", SHIP_W, SHIP_H, 1, "#C26954", "circle"),

  image(ASSET.planetTeaMoon, "assets/planets/planet00.png", 1280, 1280, 1, "#6FA39A", "circle"),
  image(ASSET.planetImFine, "assets/planets/planet04.png", 1280, 1280, 1, "#9B8FB8", "circle"),
  image(ASSET.celestialTeaMoon, "assets/celestial/tea-moon.png", 192, 192, 2, "#C2CFAE", "circle"),
  image(ASSET.planetFarPlum, "assets/celestial/planet-far-plum.png", 96, 96, 2, "#9B8FB8", "circle"),
  image(ASSET.celestialImFine, "assets/celestial/planet-im-fine.png", 128, 128, 2, "#9B8FB8", "circle"),

  image(ASSET.spaceStarsFar, "assets/space/stars-far.png", 256, 256, 2, "#14162B"),
  image(ASSET.spaceStarsNear, "assets/space/stars-near.png", 256, 256, 2, "#2F3149"),
  image(ASSET.spaceNebula, "assets/space/nebula.png", 640, 360, 2, "#2F3149"),

  image(ASSET.asteroidSleepy, "assets/asteroids/asteroid-sleepy.png", 72, 72, 2, "#3D3E4D", "circle"),
  image(ASSET.asteroidRice, "assets/asteroids/asteroid-rice.png", 72, 72, 2, "#3D3E4D", "circle"),
  image(ASSET.asteroidTea, "assets/asteroids/asteroid-tea.png", 72, 72, 2, "#3D3E4D", "circle"),
  image(ASSET.asteroidMochi, "assets/asteroids/asteroid-mochi.png", 72, 72, 2, "#3D3E4D", "circle"),
  image(ASSET.asteroidCrumb, "assets/asteroids/asteroid-crumb.png", 72, 72, 2, "#3D3E4D", "circle"),
  sheet(ASSET.asteroidDebris, "assets/asteroids/asteroid-debris.png", 24, 24, 4, 2, "#3D3E4D", "circle"),

  image(ASSET.lunarSky, "assets/lunar/lunar-sky.png", 640, 360, 2, "#1A1B2E"),
  image(ASSET.lunarHillsFar, "assets/lunar/lunar-hills-far.png", 640, 96, 2, "#2F3149"),
  image(ASSET.lunarGround, "assets/lunar/lunar-ground.png", 640, 64, 2, "#3D3E4D"),
  image(ASSET.lunarPad, "assets/lunar/lunar-pad.png", 176, 24, 2, "#8DA17A"),
  sheet(ASSET.lunarLantern, "assets/lunar/lunar-lantern.png", 12, 28, 2, 2, "#E08A4B"),
  image(ASSET.lunarTeahouse, "assets/lunar/lunar-teahouse.png", 96, 80, 2, "#C97B5A"),
  sheet(ASSET.lunarRocks, "assets/lunar/lunar-rocks.png", 32, 16, 3, 2, "#3D3E4D"),

  sheet(ASSET.rabbitPortrait, "assets/characters/rabbit-portrait.png", 64, 64, 3, 2, "#ECDFC5"),
  sheet(ASSET.rabbitSprite, "assets/characters/rabbit-sprite.png", 24, 32, 4, 2, "#F4ECDC"),

  image(ASSET.itemTea, "assets/items/tea.png", 32, 32, 2, "#6FA39A"),
  image(ASSET.itemMochi, "assets/items/mochi.png", 32, 24, 2, "#F4ECDC"),
  image(ASSET.itemPackage, "assets/items/package.png", 32, 32, 2, "#C97B5A"),
  sheet(ASSET.itemSteam, "assets/items/steam.png", 16, 24, 4, 2, "#FBF7EC"),
  image(ASSET.memoryPostcard, "assets/items/memory-postcard.png", 96, 64, 2, "#F9F3E5"),

  sheet(ASSET.fxThrust, "assets/particles/thrust.png", 16, 24, 8, 2, "#E08A4B"),
  sheet(ASSET.fxDust, "assets/particles/dust.png", 16, 16, 6, 2, "#ECDFC5", "circle"),
  sheet(ASSET.fxSparkle, "assets/particles/sparkle.png", 8, 8, 4, 2, "#D4A055"),
  sheet(ASSET.fxSteam, "assets/particles/steam.png", 12, 20, 6, 2, "#FBF7EC"),
  sheet(ASSET.fxStar, "assets/particles/star.png", 5, 5, 3, 2, "#FBF7EC"),

  sheet(ASSET.uiIcons, "assets/ui/icons.png", 16, 16, 16, 2, "#C97B5A"),
  image(ASSET.uiPanelParchment, "assets/ui/panel-parchment.png", 48, 48, 2, "#F9F3E5"),
  image(ASSET.uiPanelDark, "assets/ui/panel-dark.png", 48, 48, 2, "#14162B"),
  sheet(ASSET.uiButton, "assets/ui/button.png", 48, 24, 3, 2, "#C97B5A"),
  sheet(ASSET.uiKeycap, "assets/ui/keycap.png", 16, 16, 2, 2, "#FBF7EC"),
];

/** Nine-slice insets (art pixels) for panel and button textures. */
export const NINE_SLICE = {
  panel: 8,
  button: 6,
  keycap: 4,
} as const;
