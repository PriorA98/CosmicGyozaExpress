import { ASSET } from "../data/assetManifest";
import { resolveMission } from "../data/campaign";
import { themeFor } from "../data/campaign/themes";
import { routeLogCopy, titleCopy } from "../data/uiCopy";
import { isCampaignComplete, nextSuggestedMission } from "../systems/CampaignSystem";
import type { CampaignProgress } from "../systems/CampaignSystem";
import type { MissionId } from "../types/campaign";
import type { RouteLogPanelOptions } from "./RouteLogPanel";

export type TitleDeliveryAction =
  | { readonly kind: "launch-tea"; readonly missionId: "tea-moon"; readonly label: string }
  | { readonly kind: "board"; readonly focusMissionId: MissionId; readonly label: string };

/** The first delivery keeps its original CTA; saved completions suggest the next board stop. */
export function titleDeliveryAction(progress: CampaignProgress): TitleDeliveryAction {
  if (progress.completedMissions.length === 0) {
    return { kind: "launch-tea", missionId: "tea-moon", label: titleCopy.startButton };
  }
  const next = nextSuggestedMission(progress);
  return {
    kind: "board",
    focusMissionId: next.id,
    label: isCampaignComplete(progress) ? titleCopy.boardPrimaryButton : titleCopy.nextDeliveryButton(next.shortTitle),
  };
}

/** Card and launch share the same suggested stop; the fresh Tea card keeps its slice copy. */
export function titleMissionPresentation(progress: CampaignProgress) {
  const mission = nextSuggestedMission(progress);
  const theme = themeFor(mission.themeId);
  const delivered = progress.completedMissions.includes(mission.id);
  return {
    mission,
    theme,
    delivered,
    pillLabel: delivered ? titleCopy.deliveredPill : theme.legacy ? titleCopy.awaitingPill : titleCopy.awaitingDeliveryPill,
  };
}

type RouteLogPresentation = Omit<RouteLogPanelOptions, "stats" | "uiScale" | "onClose"> & {
  readonly missionId: MissionId;
};

/** Preserve the Tea Moon postcard and present delivered campaign stops in their authored order. */
export function campaignRouteLog(progress: CampaignProgress): RouteLogPresentation {
  const delivered = progress.completedMissions.map((id) => resolveMission(id));
  const headline = delivered[delivered.length - 1] ?? resolveMission("tea-moon");
  const theme = themeFor(headline.themeId);
  const campaignCard = !theme.legacy && theme.postcardFrame !== null;
  return {
    missionId: headline.id,
    copy: {
      ...routeLogCopy,
      entryTitle: theme.legacy ? routeLogCopy.entryTitle : headline.shortTitle.toLowerCase(),
      postcardCaption: routeLogCopy.captions[headline.id],
    },
    postcardKey: campaignCard ? ASSET.campaignPostcards : ASSET.memoryPostcard,
    ...(campaignCard && theme.postcardFrame !== null ? { postcardFrame: theme.postcardFrame } : {}),
    ...(delivered.length < 2 ? {} : {
      history: {
        title: routeLogCopy.historyTitle,
        entries: delivered.map((mission) => ({
          title: mission.shortTitle,
          detail: mission.recipientName.split(",")[0] ?? mission.recipientName,
        })),
      },
    }),
  };
}
