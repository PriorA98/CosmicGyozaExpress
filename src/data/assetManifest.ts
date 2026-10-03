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
  /** Frames per row. Omitted = one horizontal strip (frameCount columns). */
  readonly columns?: number;
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
  // Pre-rotated ship sheets (tools/art/rotsprite.py): one per frame above, SHIP_ROTATION.angles cells each
  shipIdleRot: "ship-idle-rot",
  shipFly1Rot: "ship-fly-1-rot",
  shipFly2Rot: "ship-fly-2-rot",
  shipFly3Rot: "ship-fly-3-rot",
  shipIncident1Rot: "ship-incident-1-rot",
  shipIncident2Rot: "ship-incident-2-rot",
  shipIncident3Rot: "ship-incident-3-rot",
  shipIncident4Rot: "ship-incident-4-rot",
  shipIncident5Rot: "ship-incident-5-rot",
  // Celestial
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

  // Phase 3 campaign (public/assets/campaign/; placeholder art until Wave D swaps final bytes in place).
  campaignDestinationBento: "campaign-destination-bento",
  campaignDestinationMatcha: "campaign-destination-matcha",
  campaignDestinationBakery: "campaign-destination-bakery",
  campaignDestinationImFine: "campaign-destination-im-fine",
  campaignDestinationHome: "campaign-destination-home",
  campaignPortraitMallow: "campaign-portrait-mallow",
  campaignPortraitNori: "campaign-portrait-nori",
  campaignPortraitPip: "campaign-portrait-pip",
  campaignPortraitIona: "campaign-portrait-iona",
  campaignCargo: "campaign-cargo",
  campaignPostcards: "campaign-postcards",
  campaignFlowArrow: "campaign-flow-arrow",
  campaignWindsock: "campaign-windsock",
  campaignBerthTiles: "campaign-berth-tiles",
  campaignFog: "campaign-fog",
  campaignPickups: "campaign-pickups",
  // Phase 3 final-art painted layers (landing sky / far hills per theme, flight nebula per theme).
  campaignLandingSkyBento: "campaign-landing-sky-bento",
  campaignLandingHillsBento: "campaign-landing-hills-bento",
  campaignNebulaBento: "campaign-nebula-bento",
  campaignLandingSkyMatcha: "campaign-landing-sky-matcha",
  campaignLandingHillsMatcha: "campaign-landing-hills-matcha",
  campaignNebulaMatcha: "campaign-nebula-matcha",
  campaignLandingSkyBakery: "campaign-landing-sky-bakery",
  campaignLandingHillsBakery: "campaign-landing-hills-bakery",
  campaignNebulaBakery: "campaign-nebula-bakery",
  campaignLandingSkyImFine: "campaign-landing-sky-im-fine",
  campaignLandingHillsImFine: "campaign-landing-hills-im-fine",
  campaignNebulaImFine: "campaign-nebula-im-fine",
  campaignLandingSkyHome: "campaign-landing-sky-home",
  campaignLandingHillsHome: "campaign-landing-hills-home",
  campaignNebulaHome: "campaign-nebula-home",
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

/** Campaign strip frames (horizontal strips; see docs/implementation/phase-3-campaign-plan.md §6). */
export const CAMPAIGN_PORTRAIT_FRAME = { idle: 0, welcome: 1 } as const;
export const CAMPAIGN_CARGO_FRAME = { bento: 0, flask: 1, jar: 2, soup: 3, parcel: 4 } as const;
export const CAMPAIGN_POSTCARD_FRAME = { bento: 0, matcha: 1, bakery: 2, imFine: 3, home: 4 } as const;
export const CAMPAIGN_WINDSOCK_FRAME = { calm: 0, warning: 1, medium: 2, strong: 3 } as const;
export const CAMPAIGN_BERTH_FRAME = { leftCap: 0, center: 1, rightCap: 2 } as const;
export const CAMPAIGN_PICKUP_FRAME = { postcard: 0, crumb: 1 } as const;

/** Ship frames: 64x80 art canvas, saucer centre at art (32, 34), flame room below; displayed at 2x. */
export const SHIP_ART = { width: 64, height: 80, artScale: 2, saucerCenterX: 32, saucerCenterY: 34 } as const;
const SHIP_W = SHIP_ART.width;
const SHIP_H = SHIP_ART.height;

/**
 * Ship rotation contract: every ship frame is also baked at SHIP_ROTATION.angles clockwise angles
 * (angle 0 = upright) into square cells centred on the saucer pivot, packed row-major in a grid.
 * GyozaShip shows the nearest baked angle instead of rotating pixel art at runtime.
 */
export const SHIP_ROTATION = { angles: 32, columns: 8, cell: 112 } as const;

const SHIP_ROTATED_SHEETS: readonly (readonly [string, string])[] = [
  [ASSET.shipIdleRot, "gyoza-idle"],
  [ASSET.shipFly1Rot, "gyoza-fly-01"],
  [ASSET.shipFly2Rot, "gyoza-fly-02"],
  [ASSET.shipFly3Rot, "gyoza-fly-03"],
  [ASSET.shipIncident1Rot, "gyoza-incident-01"],
  [ASSET.shipIncident2Rot, "gyoza-incident-02"],
  [ASSET.shipIncident3Rot, "gyoza-incident-03"],
  [ASSET.shipIncident4Rot, "gyoza-incident-04"],
  [ASSET.shipIncident5Rot, "gyoza-incident-05"],
];

function rotatedShipSheet(key: string, path: string): SpritesheetAssetEntry {
  const { angles, columns, cell } = SHIP_ROTATION;
  return {
    kind: "spritesheet",
    key,
    path,
    width: columns * cell,
    height: Math.ceil(angles / columns) * cell,
    frameWidth: cell,
    frameHeight: cell,
    frameCount: angles,
    columns,
    artScale: SHIP_ART.artScale,
    fallback: { color: "#D4A055", shape: "circle" },
  };
}

export const ASSET_MANIFEST: readonly AssetEntry[] = [
  image(ASSET.shipIdle, "assets/ship/gyoza-idle.png", SHIP_W, SHIP_H, 2, "#D4A055", "circle"),
  image(ASSET.shipFly1, "assets/ship/gyoza-fly-01.png", SHIP_W, SHIP_H, 2, "#D4A055", "circle"),
  image(ASSET.shipFly2, "assets/ship/gyoza-fly-02.png", SHIP_W, SHIP_H, 2, "#D4A055", "circle"),
  image(ASSET.shipFly3, "assets/ship/gyoza-fly-03.png", SHIP_W, SHIP_H, 2, "#D4A055", "circle"),
  image(ASSET.shipIncident1, "assets/ship/gyoza-incident-01.png", SHIP_W, SHIP_H, 2, "#C26954", "circle"),
  image(ASSET.shipIncident2, "assets/ship/gyoza-incident-02.png", SHIP_W, SHIP_H, 2, "#C26954", "circle"),
  image(ASSET.shipIncident3, "assets/ship/gyoza-incident-03.png", SHIP_W, SHIP_H, 2, "#C26954", "circle"),
  image(ASSET.shipIncident4, "assets/ship/gyoza-incident-04.png", SHIP_W, SHIP_H, 2, "#C26954", "circle"),
  image(ASSET.shipIncident5, "assets/ship/gyoza-incident-05.png", SHIP_W, SHIP_H, 2, "#C26954", "circle"),
  ...SHIP_ROTATED_SHEETS.map(([key, file]) => rotatedShipSheet(key, `assets/ship/rot/${file}-rot.png`)),

  image(ASSET.celestialTeaMoon, "assets/celestial/tea-moon.png", 192, 192, 2, "#C2CFAE", "circle"),
  image(ASSET.planetFarPlum, "assets/celestial/planet-far-plum.png", 96, 96, 2, "#9B8FB8", "circle"),
  image(ASSET.celestialImFine, "assets/celestial/planet-im-fine.png", 128, 128, 2, "#9B8FB8", "circle"),

  image(ASSET.spaceStarsFar, "assets/space/stars-far.png", 256, 256, 2, "#14162B"),
  image(ASSET.spaceStarsNear, "assets/space/stars-near.png", 256, 256, 2, "#2F3149"),
  image(ASSET.spaceNebula, "assets/space/nebula.png", 640, 360, 2, "#2F3149"),

  image(ASSET.asteroidSleepy, "assets/asteroids/asteroid-sleepy.png", 76, 76, 2, "#3D3E4D", "circle"),
  image(ASSET.asteroidRice, "assets/asteroids/asteroid-rice.png", 92, 92, 2, "#3D3E4D", "circle"),
  image(ASSET.asteroidTea, "assets/asteroids/asteroid-tea.png", 100, 100, 2, "#3D3E4D", "circle"),
  image(ASSET.asteroidMochi, "assets/asteroids/asteroid-mochi.png", 84, 84, 2, "#3D3E4D", "circle"),
  image(ASSET.asteroidCrumb, "assets/asteroids/asteroid-crumb.png", 66, 66, 2, "#3D3E4D", "circle"),
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

  image(ASSET.campaignDestinationBento, "assets/campaign/destination-bento.png", 160, 160, 2, "#D69A57", "circle"),
  image(ASSET.campaignDestinationMatcha, "assets/campaign/destination-matcha.png", 160, 160, 2, "#80966B", "circle"),
  image(ASSET.campaignDestinationBakery, "assets/campaign/destination-bakery.png", 160, 160, 2, "#C98557", "circle"),
  image(ASSET.campaignDestinationImFine, "assets/campaign/destination-im-fine.png", 160, 160, 2, "#657A91", "circle"),
  image(ASSET.campaignDestinationHome, "assets/campaign/destination-home.png", 160, 160, 2, "#BA8798", "circle"),
  sheet(ASSET.campaignPortraitMallow, "assets/campaign/portrait-mallow.png", 48, 48, 2, 2, "#D69A57"),
  sheet(ASSET.campaignPortraitNori, "assets/campaign/portrait-nori.png", 48, 48, 2, 2, "#B7C69A"),
  sheet(ASSET.campaignPortraitPip, "assets/campaign/portrait-pip.png", 48, 48, 2, 2, "#E5BD76"),
  sheet(ASSET.campaignPortraitIona, "assets/campaign/portrait-iona.png", 48, 48, 2, 2, "#A4B9B3"),
  sheet(ASSET.campaignCargo, "assets/campaign/cargo.png", 32, 32, 5, 2, "#C97B5A"),
  sheet(ASSET.campaignPostcards, "assets/campaign/postcards.png", 48, 32, 5, 2, "#F4E6C8"),
  image(ASSET.campaignFlowArrow, "assets/campaign/flow-arrow.png", 24, 16, 2, "#B7C69A"),
  sheet(ASSET.campaignWindsock, "assets/campaign/windsock.png", 24, 32, 4, 2, "#E6A57A"),
  sheet(ASSET.campaignBerthTiles, "assets/campaign/berth-tiles.png", 32, 24, 3, 2, "#6F8E83"),
  image(ASSET.campaignFog, "assets/campaign/fog.png", 128, 64, 2, "#80966B"),
  sheet(ASSET.campaignPickups, "assets/campaign/pickups.png", 16, 16, 2, 2, "#F4E6C8"),
  image(ASSET.campaignLandingSkyBento, "assets/campaign/landing-sky-bento.png", 640, 360, 2, "#1A1B2E"),
  image(ASSET.campaignLandingHillsBento, "assets/campaign/landing-hills-bento.png", 640, 96, 2, "#2F3149"),
  image(ASSET.campaignNebulaBento, "assets/campaign/nebula-bento.png", 640, 360, 2, "#2F3149"),
  image(ASSET.campaignLandingSkyMatcha, "assets/campaign/landing-sky-matcha.png", 640, 360, 2, "#1A1B2E"),
  image(ASSET.campaignLandingHillsMatcha, "assets/campaign/landing-hills-matcha.png", 640, 96, 2, "#2F3149"),
  image(ASSET.campaignNebulaMatcha, "assets/campaign/nebula-matcha.png", 640, 360, 2, "#2F3149"),
  image(ASSET.campaignLandingSkyBakery, "assets/campaign/landing-sky-bakery.png", 640, 360, 2, "#1A1B2E"),
  image(ASSET.campaignLandingHillsBakery, "assets/campaign/landing-hills-bakery.png", 640, 96, 2, "#2F3149"),
  image(ASSET.campaignNebulaBakery, "assets/campaign/nebula-bakery.png", 640, 360, 2, "#2F3149"),
  image(ASSET.campaignLandingSkyImFine, "assets/campaign/landing-sky-im-fine.png", 640, 360, 2, "#1A1B2E"),
  image(ASSET.campaignLandingHillsImFine, "assets/campaign/landing-hills-im-fine.png", 640, 96, 2, "#2F3149"),
  image(ASSET.campaignNebulaImFine, "assets/campaign/nebula-im-fine.png", 640, 360, 2, "#2F3149"),
  image(ASSET.campaignLandingSkyHome, "assets/campaign/landing-sky-home.png", 640, 360, 2, "#1A1B2E"),
  image(ASSET.campaignLandingHillsHome, "assets/campaign/landing-hills-home.png", 640, 96, 2, "#2F3149"),
  image(ASSET.campaignNebulaHome, "assets/campaign/nebula-home.png", 640, 360, 2, "#2F3149"),
];

/** Nine-slice insets (art pixels) for panel and button textures. */
export const NINE_SLICE = {
  panel: 8,
  button: 6,
  keycap: 4,
} as const;
