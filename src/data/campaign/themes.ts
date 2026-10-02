/**
 * Per-theme presentation references (integrator-owned). Scenes pick textures/frames/palette from here
 * instead of branching on mission ids. Tea Moon keeps its bespoke scenery adapters (`legacy: true`).
 */
import {
  ASSET,
  CAMPAIGN_CARGO_FRAME,
  CAMPAIGN_POSTCARD_FRAME,
} from "../assetManifest";
import type { ThemeId } from "../../types/campaign";

export type CampaignThemeDefinition = {
  readonly id: ThemeId;
  /** Tea Moon: scenes use the original slice entities (TeaMoon, LunarScenery, MoonRabbit). */
  readonly legacy: boolean;
  readonly destinationTexture: string;
  readonly portraitTexture: string | null;
  readonly cargoFrame: number | null;
  readonly postcardFrame: number | null;
  /** Hex palette: sky top, sky bottom, ground, accent, warm light. */
  readonly palette: {
    readonly skyTop: string;
    readonly skyBottom: string;
    readonly ground: string;
    readonly accent: string;
    readonly light: string;
  };
};

export const campaignThemes: Readonly<Record<ThemeId, CampaignThemeDefinition>> = {
  teaMoon: {
    id: "teaMoon",
    legacy: true,
    destinationTexture: ASSET.celestialTeaMoon,
    portraitTexture: ASSET.rabbitPortrait,
    cargoFrame: null,
    postcardFrame: null,
    palette: { skyTop: "#14162B", skyBottom: "#2F3149", ground: "#3D3E4D", accent: "#8DA17A", light: "#E08A4B" },
  },
  bentoBelt: {
    id: "bentoBelt",
    legacy: false,
    destinationTexture: ASSET.campaignDestinationBento,
    portraitTexture: ASSET.campaignPortraitMallow,
    cargoFrame: CAMPAIGN_CARGO_FRAME.bento,
    postcardFrame: CAMPAIGN_POSTCARD_FRAME.bento,
    palette: { skyTop: "#171B2E", skyBottom: "#3A3346", ground: "#5A4A44", accent: "#D69A57", light: "#B96C58" },
  },
  matchaNebula: {
    id: "matchaNebula",
    legacy: false,
    destinationTexture: ASSET.campaignDestinationMatcha,
    portraitTexture: ASSET.campaignPortraitNori,
    cargoFrame: CAMPAIGN_CARGO_FRAME.flask,
    postcardFrame: CAMPAIGN_POSTCARD_FRAME.matcha,
    palette: { skyTop: "#151E22", skyBottom: "#2E4038", ground: "#3E4A3A", accent: "#80966B", light: "#D6C58C" },
  },
  blackHoleBakery: {
    id: "blackHoleBakery",
    legacy: false,
    destinationTexture: ASSET.campaignDestinationBakery,
    portraitTexture: ASSET.campaignPortraitPip,
    cargoFrame: CAMPAIGN_CARGO_FRAME.jar,
    postcardFrame: CAMPAIGN_POSTCARD_FRAME.bakery,
    palette: { skyTop: "#130F1F", skyBottom: "#2B2238", ground: "#4A3A44", accent: "#806C91", light: "#E5BD76" },
  },
  imFine: {
    id: "imFine",
    legacy: false,
    destinationTexture: ASSET.campaignDestinationImFine,
    portraitTexture: ASSET.campaignPortraitIona,
    cargoFrame: CAMPAIGN_CARGO_FRAME.soup,
    postcardFrame: CAMPAIGN_POSTCARD_FRAME.imFine,
    palette: { skyTop: "#161B26", skyBottom: "#33404F", ground: "#3E4752", accent: "#657A91", light: "#EDC477" },
  },
  home: {
    id: "home",
    legacy: false,
    destinationTexture: ASSET.campaignDestinationHome,
    portraitTexture: null,
    cargoFrame: CAMPAIGN_CARGO_FRAME.parcel,
    postcardFrame: CAMPAIGN_POSTCARD_FRAME.home,
    palette: { skyTop: "#1A1830", skyBottom: "#3F3450", ground: "#4A4152", accent: "#BA8798", light: "#E5C68F" },
  },
};

export function themeFor(themeId: ThemeId): CampaignThemeDefinition {
  return campaignThemes[themeId];
}
