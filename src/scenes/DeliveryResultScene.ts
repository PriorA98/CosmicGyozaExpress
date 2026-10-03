import Phaser from "phaser";
import { ASSET, CAMPAIGN_PORTRAIT_FRAME, RABBIT_PORTRAIT_FRAME } from "../data/assetManifest";
import { themeFor, type CampaignThemeDefinition } from "../data/campaign/themes";
import {
  campaignResultCopy,
  endingCardLayout,
  endingRevealTiming,
  resultCardLayouts,
  resultCopy,
  resultRevealTiming,
  resultStampPalette,
  resultTwinkle,
  type ResultCardLayout,
  type ResultLayoutTier,
  type ResultStampPalette,
} from "../data/resultCopy";
import { installDevSceneHotkeys } from "../dev/DevSceneLauncher";
import { registerDevState } from "../dev/devProbe";
import { burstDust, isReducedMotion, settleBursts } from "../fx/feedback";
import { playEnterTransition, transitionToScene } from "../fx/transitions";
import { colorNumber, colors, depth, fontStacks, motion, typeScale } from "../game/designTokens";
import { displayScale, isCompactDisplay } from "../game/displayScale";
import { emitGameEvent } from "../game/events";
import {
  createDeliveryResultContent,
  createDeliveryResultPresentation,
  createMissionResultSummary,
  normalizeDeliveryResultData,
  persistenceNotice,
  pickResultLayoutTier,
  type DeliveryResultPresentation,
  type ResultAction,
  type ResultStamp,
} from "../systems/MissionResultSystem";
import { SaveSystem, type SavePersistenceStatus } from "../systems/SaveSystem";
import type { MissionSelectSceneData } from "../types/campaign";
import type { SceneKey } from "../game/events";
import type { DeliveryResultSceneData } from "../types/landing";
import { KEYCAP_HEIGHT, Keycap, addUiIcon } from "../ui";

type TypeToken = keyof typeof typeScale;

/** Logical canvas centre x (1280x720). */
const CANVAS_CENTER_X = 640;
/** Display scale for pixel art (manifest artScale). Every pixel asset here uses an integer multiple. */
const ART_SCALE = 2;
/** The pixel display face is drawn on an 8px grid; other sizes fall back to the mono face. */
const PIXEL_FONT_GRID = 8;
const STEAM_ANIM_KEY = "result-item-steam";
const STEAM_FRAME_RATE = 6;
/** Art sizes in art pixels (assetManifest). */
const ART = {
  postcard: { width: 96, height: 64 },
  portrait: 64,
  /** item-tea is 32 art px; steam rises from the lid knob and the spout tip (art px from top-left). */
  teaSize: 32,
  teaLid: { x: 15, y: 8 },
  teaSpout: { x: 2, y: 14 },
} as const;

/** Shared spacing (screen px) that does not change between tiers. */
const SPACING = {
  bandInset: 8,
  portraitTop: 6,
  tagPadX: 18,
  trayHeight: 62,
  trayInsetX: 26,
  /** Leaves room above the teapot for its 24 art px steam wisps to clear the name tag. */
  trayGap: 56,
  captionGap: 12,
  kickerGap: 6,
  reportGap: 14,
  stampGapX: 14,
  stampGapY: 10,
  stampPadLeft: 26,
  stampPadRight: 18,
  statsDividerGap: 16,
  statIconX: 16,
  statTextX: 44,
  postcardSlotPad: 28,
  postcardClearance: 14,
  postcardLabelGap: 10,
  postcardTitleGap: 4,
  footerGap: 16,
  noteGap: 6,
  notePadX: 4,
  buttonLabelPad: 18,
  keycapPadRight: 10,
  skipHintBottom: 22,
} as const;

/** Moon glow and placement of the backdrop moon (celestial-tea-moon is 192x192 art px). */
const MOON = {
  x: 1150,
  /** Low enough that the teahouse on its crown clears the top edge. */
  y: 168,
  bob: 8,
  artRadius: 96,
  rings: [
    { radius: 260, alpha: 0.05 },
    { radius: 228, alpha: 0.07 },
    { radius: 204, alpha: 0.09 },
  ],
  fallbackAlpha: 0.55,
  craters: [
    { x: -0.42, y: 0.18, r: 0.16 },
    { x: 0.12, y: 0.46, r: 0.11 },
    { x: -0.05, y: -0.4, r: 0.09 },
    { x: 0.38, y: 0.02, r: 0.07 },
  ],
} as const;
const PLUM = { x: 92, y: 640, alpha: 0.9 } as const;
const BACKDROP_ALPHA = { nebula: 0.55, nebulaFallback: 0.18, wash: 0.35 } as const;

/** Card surface: hard pixel drop shadow and recessed left band. */
const CARD_SURFACE = { shadowX: 6, shadowY: 10, shadowAlpha: 0.5, bandAlpha: 0.75, panelInset: 8 } as const;

/**
 * Pixel button geometry in art px, matching the authored `ui-button` strip: 1 px notched corners,
 * 2 px ink border, and a 4 px hard ink lip under the face that the face sinks onto when pressed.
 */
const BUTTON_ART = { notch: 1, border: 2, lip: 4, pressSink: 2 } as const;
type ButtonState = "idle" | "hover" | "pressed";
const BUTTON_PALETTE = {
  primary: {
    fill: colors.terracotta,
    hover: colors.ember,
    pressed: colors.terracottaDeep,
    bevel: colors.terracottaDeep,
    label: colors.plaster,
    labelShadow: colors.terracottaDeep,
    highlightAlpha: 0.3,
  },
  secondary: {
    fill: colors.parchmentWarm,
    hover: colors.plaster,
    pressed: colors.parchmentDeep,
    bevel: colors.border,
    label: colors.ink,
    labelShadow: colors.border,
    highlightAlpha: 0.7,
  },
} as const;
type ButtonVariant = keyof typeof BUTTON_PALETTE;

/** Stamp pills: 1 art px border, 1 art px lip, and a 4x4 art px pixel dot. */
const STAMP_ART = { dotSize: 4, dotLeft: 4, lip: 1 } as const;
/** Paper photo corners holding the postcard (art px leg length). */
const PHOTO_CORNER = { leg: 7, outset: 1 } as const;
/** Hard offset shadow under the postcard; leaning left hints at a hand-placed card. */
const POSTCARD_SHADOW = { x: -4, y: 6, alpha: 0.28 } as const;
/** Dust puff when a stamp lands. */
const STAMP_PUFF = { count: 5, spread: 40, offsetY: 4 } as const;
/** Entry tween "from" states (transient; everything settles at angle 0 and integer art scale). */
const ENTRY = {
  cardDy: 24,
  stampScale: 1.35,
  stampAngle: 4,
  postcardAngle: -8,
  rabbitScaleFactor: 0.75,
  hop: 8,
} as const;
const DASH = { length: 8, gap: 6, width: 2, alpha: 0.8 } as const;
/** Campaign (non-legacy) card art: recipient portraits are 48 art px, cargo 32, postcards 48x32 (half the slice postcard). */
const CAMPAIGN_ART = { portraitExtraScale: 1, postcardScaleFactor: 2, minNoteWidth: 120 } as const;
/** Thank-you notes on the final card. */
const NOTES = { titleGap: 8, lineGap: 6, bullet: "✦ " } as const;

type StageProps = {
  alpha: number;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  angle: number;
};

type Stageable = Phaser.GameObjects.GameObject & StageProps;

type StageFrom = {
  readonly alpha?: number;
  readonly dx?: number;
  readonly dy?: number;
  readonly scale?: number;
  readonly scaleX?: number;
  readonly angle?: number;
};

type StagedPart = {
  readonly target: Stageable;
  readonly rest: Readonly<StageProps>;
};

type RevealStep = {
  readonly at: number;
  readonly parts: readonly StagedPart[];
  readonly duration: number;
  readonly ease: string;
  /** Side effects (sparkles, faces). `instant` is true when the reveal was skipped or rebuilt. */
  readonly onPlay?: (instant: boolean) => void;
  played: boolean;
};

type FooterButton = { readonly action: ResultAction; readonly button: ResultButton };

type ResultButton = {
  readonly root: Phaser.GameObjects.Container;
  readonly face: Phaser.GameObjects.Container;
  readonly graphics: Phaser.GameObjects.Graphics;
  readonly variant: ButtonVariant;
  readonly width: number;
  readonly height: number;
  state: ButtonState;
};

/** Card geometry in card-local px (origin = card centre). */
type CardFrame = {
  readonly layout: ResultCardLayout;
  readonly left: number;
  readonly top: number;
  readonly innerLeft: number;
  readonly innerRight: number;
  readonly innerTop: number;
  readonly contentBottom: number;
  readonly footerY: number;
  readonly buttonTop: number;
  readonly leftCenterX: number;
  readonly rightX: number;
  readonly rightWidth: number;
};

type Rect = { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number };

export class DeliveryResultScene extends Phaser.Scene {
  private resultData: DeliveryResultSceneData = normalizeDeliveryResultData(undefined);
  private view?: DeliveryResultPresentation;
  private persistence: SavePersistenceStatus = { kind: "persistent" };
  private tier: ResultLayoutTier = "full";
  private saved = false;
  private revealComplete = false;
  private leaving = false;
  private reducedMotion = false;
  private steps: RevealStep[] = [];
  private stepTimers: Phaser.Time.TimerEvent[] = [];
  private card?: Phaser.GameObjects.Container;
  private stars?: Phaser.GameObjects.TileSprite;
  private rabbit?: Phaser.GameObjects.Sprite;
  private rabbitRestY = 0;
  private rabbitHappy = false;
  private blinkTimer?: Phaser.Time.TimerEvent;
  private happyTimer?: Phaser.Time.TimerEvent;
  private twinkles: Phaser.GameObjects.Sprite[] = [];
  private buttons: FooterButton[] = [];
  /** Identity of this delivery attempt (the init data object) so completion is committed once. */
  private attempt: object = {};
  private theme: CampaignThemeDefinition = themeFor("teaMoon");
  /** Campaign recipient portrait (non-legacy themes); switches to its welcome frame with the postcard. */
  private recipient?: Phaser.GameObjects.Sprite;
  private endingMarked = false;
  private skipHint?: Phaser.GameObjects.Text;
  /** Wall-clock start of the reveal, so a stalled tab still settles within the reveal budget. */
  private revealStartedAt = 0;

  constructor() {
    super("DeliveryResultScene");
  }

  init(data: Partial<DeliveryResultSceneData> | undefined): void {
    this.resultData = normalizeDeliveryResultData(data);
    this.attempt = data ?? {};
    this.endingMarked = false;
    this.recipient = undefined;
    this.view = undefined;
    this.persistence = { kind: "persistent" };
    this.saved = false;
    this.revealComplete = false;
    this.leaving = false;
    this.steps = [];
    this.stepTimers = [];
    this.buttons = [];
    this.twinkles = [];
    this.rabbitHappy = false;
    this.blinkTimer = undefined;
    this.happyTimer = undefined;
    this.card = undefined;
    this.stars = undefined;
    this.rabbit = undefined;
    this.skipHint = undefined;
  }

  create(): void {
    emitGameEvent(this, { type: "scene:enter", scene: "DeliveryResultScene" });
    // Arrive through the same warm ink the landing hands off with; the card reveal runs underneath.
    void playEnterTransition(this, { kind: "warm-fade" });

    this.view = this.recordDelivery();
    this.theme = themeFor(this.view.themeId);
    this.persistence = SaveSystem.persistenceStatus();
    this.reducedMotion = isReducedMotion() || SaveSystem.load().settings.reducedMotion;
    this.tier = this.pickTier();

    this.createBackdrop();
    this.buildCard(this.view);
    this.revealStartedAt = performance.now();
    this.scheduleReveal();
    this.bindInput();

    const onResize = (): void => this.relayoutIfNeeded();
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);

    installDevSceneHotkeys(this);
    registerDevState("result", () => ({
      saved: this.saved,
      landingResult: this.resultData.landingResult,
      conditionLabel: this.view?.content.conditionLabel,
      revealComplete: this.revealComplete,
      layoutTier: this.tier,
      persistence: this.persistence,
      liveTwinkles: this.twinkles.length,
      missionId: this.view?.missionId,
      isEnding: this.view?.isEnding,
      actions: this.view?.actions.map((action) => action.kind),
      endingMarked: this.endingMarked,
    }));
    registerDevState("save", () => SaveSystem.diagnostics());

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, onResize);
      this.clearCardTimers();
    });
  }

  update(_time: number, delta: number): void {
    // The scene clock smooths over long frames (tab stalls, busy devices); the reveal promise is
    // in real time, so settle it once the wall-clock budget is spent.
    if (!this.revealComplete && performance.now() - this.revealStartedAt >= (this.view?.isEnding ? endingRevealTiming.maxRealMs : resultRevealTiming.maxRealMs)) {
      this.finishReveal();
    }
    if (this.stars && !this.reducedMotion) {
      this.stars.tilePositionX += delta * resultRevealTiming.starDriftPerMs;
    }
  }

  // ---------------------------------------------------------------- save

  /** Saves completion exactly once per visit, then emits `mission:completed`. Never throws. */
  private recordDelivery(): DeliveryResultPresentation {
    const before = SaveSystem.load();
    const missionId = this.resultData.missionId;
    const memoryRewardId = createDeliveryResultContent(this.resultData).memoryRewardId;
    const view = createDeliveryResultPresentation(this.resultData, {
      previousDeliveries: before.completedMissions.includes(missionId) ? before.stats.totalDeliveries : 0,
      previousBest: SaveSystem.getBestResult(missionId),
      memoryAlreadyCollected: before.collectedMemories.includes(memoryRewardId),
      progress: SaveSystem.campaignProgress(),
    });

    if (!this.saved) {
      try {
        SaveSystem.completeMission(missionId, createMissionResultSummary(view.content), view.content.memoryRewardId, this.attempt);
      } catch {
        // SaveSystem already degrades to memory; this guard keeps the celebration on screen regardless.
      }
      this.saved = true;
      emitGameEvent(this, { type: "mission:completed", missionId });
    }

    return view;
  }

  // ---------------------------------------------------------------- layout tier

  private pickTier(): ResultLayoutTier {
    return pickResultLayoutTier(isCompactDisplay(this), displayScale(this.game));
  }

  /** Rebuilds the card (already settled) when the display moves between phone and desktop sizes. */
  private relayoutIfNeeded(): void {
    const tier = this.pickTier();
    if (tier === this.tier || !this.view || this.leaving) return;
    this.tier = tier;
    const wasComplete = this.revealComplete;
    this.clearCardTimers();
    for (const step of this.steps) for (const { target } of step.parts) this.tweens.killTweensOf(target);
    if (this.rabbit) this.tweens.killTweensOf(this.rabbit);
    this.clearTwinkles();
    this.card?.destroy();
    this.skipHint?.destroy();
    this.skipHint = undefined;
    this.steps = [];
    this.buildCard(this.view);
    this.settleSteps();
    if (!wasComplete) this.completeReveal();
    else this.scheduleBlink();
  }

  // ---------------------------------------------------------------- backdrop

  private createBackdrop(): void {
    const { width, height } = this.scale;

    this.add.rectangle(0, 0, width, height, colorNumber(colors.cosmosDeep)).setOrigin(0, 0).setDepth(depth.backdrop);

    this.stars = this.add
      .tileSprite(0, 0, width, height, ASSET.spaceStarsFar)
      .setOrigin(0, 0)
      .setTileScale(ART_SCALE, ART_SCALE)
      .setDepth(depth.backdrop);

    this.add
      .image(width / 2, height / 2, ASSET.spaceNebula)
      .setScale(ART_SCALE)
      .setAlpha(this.isFallback(ASSET.spaceNebula) ? BACKDROP_ALPHA.nebulaFallback : BACKDROP_ALPHA.nebula)
      .setDepth(depth.parallax);

    this.add
      .image(PLUM.x, PLUM.y, ASSET.planetFarPlum)
      .setScale(ART_SCALE)
      .setAlpha(this.isFallback(ASSET.planetFarPlum) ? MOON.fallbackAlpha : PLUM.alpha)
      .setDepth(depth.parallax);

    // Warm halo so the destination glows into the dusk, with or without its final art.
    const legacy = this.theme.legacy;
    const halo = this.add.graphics().setDepth(depth.parallax);
    MOON.rings.forEach(({ radius, alpha }) => {
      halo.fillStyle(legacy ? colorNumber(colors.amber) : colorNumber(this.theme.palette.light), alpha);
      halo.fillCircle(MOON.x, MOON.y, radius);
    });

    // Tea Moon keeps its moon; campaign deliveries show their destination vignette in the same spot.
    const moon = !legacy
      ? this.add.image(MOON.x, MOON.y, this.theme.destinationTexture).setScale(ART_SCALE).setDepth(depth.parallax)
      : this.isFallback(ASSET.celestialTeaMoon)
        ? this.createPlaceholderMoon()
        : this.add.image(MOON.x, MOON.y, ASSET.celestialTeaMoon).setScale(ART_SCALE).setDepth(depth.parallax);
    if (!this.reducedMotion) {
      this.tweens.add({
        targets: moon,
        y: MOON.y + MOON.bob,
        duration: motion.breath * 2,
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1,
      });
    }

    // Soft dusk wash so the parchment card glows against the sky.
    const wash = this.add.graphics().setDepth(depth.parallax);
    wash.fillStyle(colorNumber(colors.cosmos), BACKDROP_ALPHA.wash);
    wash.fillRect(0, 0, width, height);
  }

  /** Stand-in while `celestial-tea-moon` art is missing: a shaded sage disc with soft craters. */
  private createPlaceholderMoon(): Phaser.GameObjects.Graphics {
    const radius = MOON.artRadius * ART_SCALE;
    const moon = this.add.graphics({ x: MOON.x, y: MOON.y }).setDepth(depth.parallax);
    moon.fillStyle(colorNumber(colors.sageDeep), 1);
    moon.fillCircle(0, 0, radius);
    moon.fillStyle(colorNumber(colors.sage), 1);
    moon.fillCircle(-radius * 0.08, -radius * 0.06, radius * 0.9);
    MOON.craters.forEach(({ x, y, r }) => {
      moon.fillStyle(colorNumber(colors.sageDeep), 0.45);
      moon.fillCircle(x * radius, y * radius, r * radius);
    });
    return moon;
  }

  // ---------------------------------------------------------------- card

  private cardFrame(layout: ResultCardLayout): CardFrame {
    const left = -layout.cardWidth / 2;
    const top = -layout.cardHeight / 2;
    const innerLeft = left + layout.pad;
    const innerRight = -left - layout.pad;
    const innerBottom = -top - layout.pad;
    const buttonTop = innerBottom - layout.buttonHeight;
    const footerY = buttonTop - SPACING.footerGap;
    const rightX = innerLeft + layout.leftColumnWidth + layout.columnGap;
    return {
      layout,
      left,
      top,
      innerLeft,
      innerRight,
      innerTop: top + layout.pad,
      contentBottom: footerY - SPACING.footerGap,
      footerY,
      buttonTop,
      leftCenterX: Math.round(innerLeft + layout.leftColumnWidth / 2),
      rightX,
      rightWidth: innerRight - rightX,
    };
  }

  private buildCard(view: DeliveryResultPresentation): void {
    const baseLayout = resultCardLayouts[this.tier];
    const layout: ResultCardLayout = view.isEnding
      ? { ...baseLayout, ...endingCardLayout, type: { ...baseLayout.type, caption: "md" } }
      : baseLayout;
    const frame = this.cardFrame(layout);
    const card = this.add.container(CANVAS_CENTER_X, layout.cardCenterY).setDepth(depth.hud);
    this.card = card;

    card.add(this.createCardSurface(frame));
    this.stage(resultRevealTiming.card, motion.slow, "Cubic.easeOut", [this.part(card, { alpha: 0, dy: ENTRY.cardDy })]);

    this.createLeftColumn(card, frame, view);
    const postcard = this.createPostcard(card, frame, view);
    const copyBottom = this.createHeadline(card, frame, view);
    if (view.isEnding) {
      this.createThankYouNotes(card, frame, view, copyBottom, postcard);
    } else {
      const stampsBottom = this.createStamps(card, frame, view, copyBottom, postcard);
      if (layout.showStats) this.createStats(card, frame, view, stampsBottom, postcard);
    }
    this.createFooter(card, frame, view);
    if (layout.showSkipHint && !this.revealComplete) this.createSkipHint();
  }

  private createCardSurface(frame: CardFrame): Phaser.GameObjects.GameObject[] {
    const { cardWidth: w, cardHeight: h } = frame.layout;
    const { left, top } = frame;
    const parts: Phaser.GameObjects.GameObject[] = [];

    // Hard pixel drop shadow (no soft blur), offset down-right like the rest of the kit.
    const shadow = this.add.graphics();
    shadow.fillStyle(colorNumber(colors.cosmosDeep), CARD_SURFACE.shadowAlpha);
    fillStepped(shadow, left + CARD_SURFACE.shadowX, top + CARD_SURFACE.shadowY, w, h, [4, 2]);
    parts.push(shadow);

    if (this.isFallback(ASSET.uiPanelParchment)) {
      const surface = this.add.graphics();
      surface.fillStyle(colorNumber(colors.borderStrong), 1);
      fillStepped(surface, left, top, w, h, [4, 2]);
      surface.fillStyle(colorNumber(colors.parchmentWarm), 1);
      fillStepped(surface, left + 2, top + 2, w - 4, h - 4, [2]);
      parts.push(surface);
    } else {
      const inset = CARD_SURFACE.panelInset;
      parts.push(
        this.add
          .nineslice(0, 0, ASSET.uiPanelParchment, undefined, w / ART_SCALE, h / ART_SCALE, inset, inset, inset, inset)
          .setScale(ART_SCALE),
      );
    }

    // Left column wash: a recessed band that holds the recipient and the delivered items.
    const band = this.add.graphics();
    const bandLeft = frame.innerLeft - SPACING.bandInset;
    const bandTop = frame.innerTop - SPACING.bandInset;
    band.fillStyle(colorNumber(colors.parchmentDeep), CARD_SURFACE.bandAlpha);
    fillStepped(
      band,
      bandLeft,
      bandTop,
      frame.layout.leftColumnWidth + SPACING.bandInset * 2,
      frame.contentBottom + SPACING.bandInset - bandTop,
      [4, 2],
    );
    parts.push(band);

    return parts;
  }

  /** Portrait, name tag and the item tray, stacked and centred in the left band. */
  private createLeftColumn(card: Phaser.GameObjects.Container, frame: CardFrame, view: DeliveryResultPresentation): void {
    const layout = frame.layout;
    const x = frame.leftCenterX;
    const size = layout.portraitFrame;
    const tagH = layout.nameTagHeight;
    const captionSize = typeScale[layout.type.caption];
    const stackHeight =
      size +
      tagH / 2 +
      (layout.showItems ? SPACING.trayGap + SPACING.trayHeight + SPACING.captionGap + captionSize * 1.4 : 0);
    const available = frame.contentBottom - frame.innerTop;
    const top = Math.round(frame.innerTop + Math.max(SPACING.portraitTop, (available - stackHeight) / 2));

    if (view.legacy) this.createPortrait(card, layout, x, top);
    else this.createCampaignPortrait(card, layout, view, x, top);
    if (!layout.showItems) return;
    const trayTop = top + size + tagH / 2 + SPACING.trayGap;
    if (view.legacy) this.createItems(card, layout, view, x, trayTop);
    else this.createCargo(card, layout, view, x, trayTop);
  }

  private createPortrait(card: Phaser.GameObjects.Container, layout: ResultCardLayout, x: number, top: number): void {
    const size = layout.portraitFrame;
    const centerY = top + size / 2;
    const frame = this.drawPortraitFrame(x, top, size);

    this.rabbitRestY = Math.round(centerY + layout.portraitScale * 2);
    const rabbit = this.add
      .sprite(x, this.rabbitRestY, ASSET.rabbitPortrait, RABBIT_PORTRAIT_FRAME.idle)
      .setScale(layout.portraitScale);
    this.rabbit = rabbit;

    const { tag, name } = this.createNameTag(layout, x, top + size, resultCopy.recipientCaption);

    card.add([frame, rabbit, tag, name]);
    this.stage(resultRevealTiming.portrait, motion.slow, "Back.easeOut", [
      this.part(frame, { alpha: 0 }),
      this.part(rabbit, { alpha: 0, scale: layout.portraitScale * ENTRY.rabbitScaleFactor }),
      this.part(tag, { alpha: 0, dy: 8 }),
      this.part(name, { alpha: 0, dy: 8 }),
    ], (instant) => {
      if (!instant) this.time.delayedCall(motion.slow + motion.base, () => this.blinkOnce());
    });
  }

  /**
   * Campaign recipient: the theme portrait (idle, then its welcome frame with the postcard). Home has no
   * recipient portrait, so the frame holds the gyoza ship itself at the largest whole-pixel scale that fits.
   */
  private createCampaignPortrait(
    card: Phaser.GameObjects.Container,
    layout: ResultCardLayout,
    view: DeliveryResultPresentation,
    x: number,
    top: number,
  ): void {
    const size = layout.portraitFrame;
    const centerY = Math.round(top + size / 2);
    const frame = this.drawPortraitFrame(x, top, size);
    const portraitKey = this.theme.portraitTexture;
    let figure: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
    let scale: number;
    if (portraitKey !== null) {
      scale = layout.portraitScale + CAMPAIGN_ART.portraitExtraScale;
      const sprite = this.add.sprite(x, centerY, portraitKey, CAMPAIGN_PORTRAIT_FRAME.idle).setScale(scale);
      this.recipient = sprite;
      figure = sprite;
    } else {
      const ship = this.add.image(x, centerY, ASSET.shipIdle);
      scale = ART_SCALE;
      figure = ship.setScale(scale);
    }

    const { tag, name } = this.createNameTag(layout, x, top + size, view.recipientCaption);
    card.add([frame, figure, tag, name]);
    this.stage(resultRevealTiming.portrait, motion.slow, "Back.easeOut", [
      this.part(frame, { alpha: 0 }),
      this.part(figure, { alpha: 0, scale: scale * ENTRY.rabbitScaleFactor }),
      this.part(tag, { alpha: 0, dy: 8 }),
      this.part(name, { alpha: 0, dy: 8 }),
    ]);
  }

  private createNameTag(
    layout: ResultCardLayout,
    x: number,
    y: number,
    caption: string,
  ): { readonly tag: Phaser.GameObjects.Graphics; readonly name: Phaser.GameObjects.Text } {
    const name = this.add
      .text(x, y, caption, {
        color: colors.plaster,
        fontFamily: fontStacks.mono,
        fontSize: `${typeScale[layout.type.caption]}px`,
        fontStyle: "700",
      })
      .setOrigin(0.5);
    const tagW = evenCeil(name.width + SPACING.tagPadX * 2);
    const tagH = layout.nameTagHeight;
    const tag = this.add.graphics();
    tag.fillStyle(colorNumber(colors.ink), 1);
    fillStepped(tag, Math.round(x - tagW / 2), Math.round(y - tagH / 2), tagW, tagH, [6, 4, 2]);
    return { tag, name };
  }

  private drawPortraitFrame(x: number, top: number, size: number): Phaser.GameObjects.Graphics {
    const left = Math.round(x - size / 2);
    const frame = this.add.graphics();
    frame.fillStyle(colorNumber(colors.ink), 1);
    fillStepped(frame, left + 4, top + 4, size, size, [4, 2]);
    fillStepped(frame, left - 2, top - 2, size + 4, size + 4, [4, 2]);
    frame.fillStyle(colorNumber(colors.cosmosPanel), 1);
    fillStepped(frame, left, top, size, size, [2]);
    // A little moon glow behind the rabbit, built from stepped bands rather than smooth discs.
    frame.fillStyle(colorNumber(colors.duskBlue), 0.2);
    fillStepped(frame, left + size * 0.12, top + size * 0.14, size * 0.76, size * 0.76, [16, 10, 6, 4, 2, 2]);
    frame.fillStyle(colorNumber(colors.plaster), 0.07);
    fillStepped(frame, left + size * 0.22, top + size * 0.24, size * 0.56, size * 0.56, [12, 8, 4, 2, 2]);
    return frame;
  }

  private createItems(
    card: Phaser.GameObjects.Container,
    layout: ResultCardLayout,
    view: DeliveryResultPresentation,
    x: number,
    trayTop: number,
  ): void {
    // A low wooden serving tray: items rest on its top third so they read as "set down", not floating.
    const trayWidth = layout.leftColumnWidth - SPACING.trayInsetX * 2;
    const trayLeft = Math.round(x - trayWidth / 2);
    const trayH = SPACING.trayHeight;
    const restLine = Math.round(trayTop + trayH * 0.62);
    const itemOffset = Math.round(trayWidth * 0.2);
    const tray = this.drawTray(trayLeft, trayTop, trayWidth, restLine, [[x - itemOffset, 60], [x + itemOffset, 56]]);

    const tea = this.add.image(x - itemOffset, restLine + 2, ASSET.itemTea).setOrigin(0.5, 1).setScale(ART_SCALE);
    const mochi = this.add.image(x + itemOffset, restLine + 2, ASSET.itemMochi).setOrigin(0.5, 1).setScale(ART_SCALE);
    // Wisps sit on whole art pixels of the teapot: one over the lid knob, one off the spout tip.
    const teaLeft = x - itemOffset - (ART.teaSize * ART_SCALE) / 2;
    const teaTop = restLine + 2 - ART.teaSize * ART_SCALE;
    const wisp = (art: { readonly x: number; readonly y: number }, frame: number): Phaser.GameObjects.Sprite =>
      this.add
        .sprite(teaLeft + art.x * ART_SCALE, teaTop + art.y * ART_SCALE, ASSET.itemSteam, frame)
        .setOrigin(0.5, 1)
        .setScale(ART_SCALE)
        .setAlpha(0);
    const steamA = wisp(ART.teaLid, 0);
    const steamB = wisp(ART.teaSpout, 2);

    const caption = this.add
      .text(x, trayTop + trayH + SPACING.captionGap, view.content.deliveryItemName, {
        color: colors.inkSoft,
        fontFamily: fontStacks.ui,
        fontSize: `${typeScale[layout.type.caption]}px`,
        fontStyle: "600",
      })
      .setOrigin(0.5, 0);

    card.add([tray, steamA, steamB, tea, mochi, caption]);
    this.stage(resultRevealTiming.items, motion.slow, "Back.easeOut", [
      this.part(tray, { alpha: 0 }),
      this.part(tea, { alpha: 0, dy: -14 }),
      this.part(mochi, { alpha: 0, dy: -20 }),
      this.part(caption, { alpha: 0 }),
    ], () => this.startSteam([steamA, steamB]));
  }

  /** Campaign cargo: the theme's cargo icon set down on the same wooden tray. */
  private createCargo(
    card: Phaser.GameObjects.Container,
    layout: ResultCardLayout,
    view: DeliveryResultPresentation,
    x: number,
    trayTop: number,
  ): void {
    const trayWidth = layout.leftColumnWidth - SPACING.trayInsetX * 2;
    const trayLeft = Math.round(x - trayWidth / 2);
    const restLine = Math.round(trayTop + SPACING.trayHeight * 0.62);
    const tray = this.drawTray(trayLeft, trayTop, trayWidth, restLine, [[x, 60]]);
    const cargo = this.add
      .image(x, restLine + 2, ASSET.campaignCargo, this.theme.cargoFrame ?? 0)
      .setOrigin(0.5, 1)
      .setScale(ART_SCALE);
    const caption = this.add
      .text(x, trayTop + SPACING.trayHeight + SPACING.captionGap, view.content.deliveryItemName, {
        color: colors.inkSoft,
        fontFamily: fontStacks.ui,
        fontSize: `${typeScale[layout.type.caption]}px`,
        fontStyle: "600",
        align: "center",
        wordWrap: { width: trayWidth },
      })
      .setOrigin(0.5, 0);

    card.add([tray, cargo, caption]);
    this.stage(resultRevealTiming.items, motion.slow, "Back.easeOut", [
      this.part(tray, { alpha: 0 }),
      this.part(cargo, { alpha: 0, dy: -16 }),
      this.part(caption, { alpha: 0 }),
    ]);
  }

  /** A low wooden serving tray plus flat pixel contact shadows at `[centerX, width]` spots. */
  private drawTray(
    trayLeft: number,
    trayTop: number,
    trayWidth: number,
    restLine: number,
    shadows: readonly (readonly [number, number])[],
  ): Phaser.GameObjects.Graphics {
    const trayH = SPACING.trayHeight;
    const tray = this.add.graphics();
    tray.fillStyle(colorNumber(colors.borderStrong), 1);
    fillStepped(tray, trayLeft, trayTop + 4, trayWidth, trayH, [4, 2]);
    tray.fillStyle(colorNumber(colors.borderStrong), 1);
    fillStepped(tray, trayLeft - 2, trayTop - 2, trayWidth + 4, trayH + 4, [4, 2]);
    tray.fillStyle(colorNumber(colors.wallpaper), 1);
    fillStepped(tray, trayLeft, trayTop, trayWidth, trayH, [2]);
    tray.fillStyle(colorNumber(colors.plaster), 0.45);
    tray.fillRect(trayLeft + 4, trayTop + 2, trayWidth - 8, 2);
    // Contact shadows under each item: flat pixel bands, not soft ellipses.
    tray.fillStyle(colorNumber(colors.borderStrong), 0.55);
    for (const [cx, w] of shadows) {
      tray.fillRect(cx - w / 2 + 4, restLine - 2, w - 8, 2);
      tray.fillRect(cx - w / 2, restLine, w, 4);
      tray.fillRect(cx - w / 2 + 4, restLine + 4, w - 8, 2);
    }
    return tray;
  }

  private startSteam(wisps: readonly Phaser.GameObjects.Sprite[]): void {
    if (!this.anims.exists(STEAM_ANIM_KEY)) {
      this.anims.create({
        key: STEAM_ANIM_KEY,
        frames: this.anims.generateFrameNumbers(ASSET.itemSteam, { start: 0, end: 3 }),
        frameRate: STEAM_FRAME_RATE,
        repeat: -1,
      });
    }
    const fallback = this.isFallback(ASSET.itemSteam);
    wisps.forEach((wisp, index) => {
      if (!wisp.active) return;
      wisp.setAlpha(fallback ? 0 : 0.85);
      if (fallback) return;
      wisp.play({ key: STEAM_ANIM_KEY, startFrame: index * 2 });
    });
  }

  /** Returns the local y of the bottom of the copy block. */
  private createHeadline(card: Phaser.GameObjects.Container, frame: CardFrame, view: DeliveryResultPresentation): number {
    const layout = frame.layout;
    const x = frame.rightX;
    const width = frame.rightWidth;
    let cursor = frame.innerTop;
    const parts: Phaser.GameObjects.Text[] = [];

    let kicker: Phaser.GameObjects.Text | undefined;
    if (layout.showKicker) {
      const kickerSize = view.legacy ? typeScale[layout.type.kicker] : this.tier === "full" ? 16 : 24;
      const onGrid = kickerSize % PIXEL_FONT_GRID === 0;
      kicker = this.add
        .text(x, cursor, `${view.kicker}  ·  ${view.kickerPlace}`, {
          color: colors.terracottaDeep,
          fontFamily: onGrid ? fontStacks.pixel : fontStacks.mono,
          fontSize: `${kickerSize}px`,
          fontStyle: onGrid ? "400" : "700",
        })
        .setLetterSpacing(1);
      cursor += Math.round(kicker.height) + SPACING.kickerGap;
      parts.push(kicker);
    }

    const headline = this.add.text(x, cursor, view.content.headline, {
      color: colors.ink,
      fontFamily: fontStacks.display,
      fontSize: `${typeScale[layout.type.headline[0] ?? "2xl"]}px`,
      fontStyle: "800",
    });
    fitFontSize(headline, layout.type.headline, width);
    cursor += Math.round(headline.height) + layout.blockGap;

    if (view.isEnding) {
      card.add([...parts, headline]);
      this.stage(resultRevealTiming.headline, motion.slow, "Cubic.easeOut", [
        ...parts.map((part) => this.part(part, { alpha: 0, dx: -10 })),
        this.part(headline, { alpha: 0, dy: 10 }),
      ]);
      return cursor + SPACING.reportGap;
    }

    const reaction = this.add.text(x, cursor, view.content.reactionLine, {
      color: colors.ink,
      fontFamily: fontStacks.display,
      fontSize: `${typeScale[layout.type.reaction]}px`,
      fontStyle: "600",
      lineSpacing: 4,
      wordWrap: { width },
    });
    cursor += Math.round(reaction.height) + layout.blockGap;

    let report: Phaser.GameObjects.Text | undefined;
    if (view.closingLine !== null) {
      // Authored closing line (I'm Fine, Home) always shows, in place of the condition report.
      report = this.add.text(x, cursor, view.closingLine, {
        color: colors.terracottaDeep,
        fontFamily: fontStacks.ui,
        fontSize: `${typeScale[layout.type.body]}px`,
        fontStyle: "italic 600",
        lineSpacing: 2,
        wordWrap: { width },
      });
      cursor += Math.round(report.height);
    } else if (layout.showReport) {
      report = this.add.text(x, cursor, view.content.reportLine, {
        color: colors.inkSoft,
        fontFamily: fontStacks.ui,
        fontSize: `${typeScale[layout.type.body]}px`,
        wordWrap: { width },
      });
      cursor += Math.round(report.height);
    }

    card.add([...parts, headline, reaction, ...(report ? [report] : [])]);
    this.stage(resultRevealTiming.headline, motion.slow, "Cubic.easeOut", [
      ...(kicker ? [this.part(kicker, { alpha: 0, dx: -10 })] : []),
      this.part(headline, { alpha: 0, dy: 10 }),
    ]);
    this.stage(resultRevealTiming.reaction, motion.slow, "Cubic.easeOut", [this.part(reaction, { alpha: 0, dy: 8 })]);
    if (report) this.stage(resultRevealTiming.report, motion.slow, "Cubic.easeOut", [this.part(report, { alpha: 0 })]);
    return cursor + SPACING.reportGap;
  }

  /**
   * Lays the stamps out left to right beneath the copy, wrapping to a new row when a stamp would
   * run into the postcard (or the card edge). Returns the local y of the bottom of the last row.
   */
  private createStamps(
    card: Phaser.GameObjects.Container,
    frame: CardFrame,
    view: DeliveryResultPresentation,
    top: number,
    postcard: Rect,
  ): number {
    const layout = frame.layout;
    const landing = this.createStamp(view.landingStamp, layout);
    const condition = this.createStamp({ label: `package · ${view.conditionStamp.label}`, tone: view.conditionStamp.tone }, layout);
    const height = layout.stampHeight;
    const rowLimit = (rowTop: number): number =>
      rowTop + height > postcard.top - SPACING.postcardClearance ? postcard.left - SPACING.postcardClearance : frame.innerRight;

    let rowTop = Math.round(top);
    let cursor = frame.rightX;
    [landing, condition].forEach((stamp, index) => {
      const width = stampWidth(stamp);
      if (index > 0 && cursor + width > rowLimit(rowTop)) {
        rowTop += height + SPACING.stampGapY;
        cursor = frame.rightX;
      }
      stamp.setPosition(Math.round(cursor + width / 2), Math.round(rowTop + height / 2));
      cursor += width + SPACING.stampGapX;
    });

    card.add([landing, condition]);
    const thump = (stamp: Phaser.GameObjects.Container) => (instant: boolean) => {
      if (instant || this.reducedMotion) return;
      // A small puff from under the stamp's lower edge, so it never smudges the label.
      const puffY = layout.cardCenterY + stamp.y + height / 2 + STAMP_PUFF.offsetY;
      burstDust(this, CANVAS_CENTER_X + stamp.x, puffY, { count: STAMP_PUFF.count, spread: STAMP_PUFF.spread, depth: depth.hudFx });
    };
    // Stamps press in with a little twist, then rest perfectly square on the pixel grid.
    this.stage(resultRevealTiming.landingStamp, motion.base, "Back.easeOut", [
      this.part(landing, { alpha: 0, scale: ENTRY.stampScale, angle: -ENTRY.stampAngle }),
    ], thump(landing));
    this.stage(resultRevealTiming.conditionStamp, motion.base, "Back.easeOut", [
      this.part(condition, { alpha: 0, scale: ENTRY.stampScale, angle: ENTRY.stampAngle }),
    ], thump(condition));

    return rowTop + height;
  }

  private createStamp(stamp: ResultStamp, layout: ResultCardLayout): Phaser.GameObjects.Container {
    const palette = resultStampPalette[stamp.tone];
    const height = layout.stampHeight;
    const dotSpan = (STAMP_ART.dotLeft + STAMP_ART.dotSize) * ART_SCALE;
    const label = this.add
      .text(0, 0, stamp.label, {
        color: palette.foreground,
        fontFamily: fontStacks.mono,
        fontSize: `${typeScale[layout.type.stamp]}px`,
        fontStyle: "700",
      })
      .setOrigin(0, 0.5);
    const width = evenCeil(label.width + dotSpan + SPACING.stampPadLeft - ART_SCALE * 2 + SPACING.stampPadRight);
    const left = -width / 2;
    const top = -height / 2;
    label.setPosition(Math.round(left + dotSpan + SPACING.stampPadLeft - ART_SCALE * 2 - 4), -1);

    const pill = this.add.graphics();
    drawStampPill(pill, left, top, width, height, palette);

    const container = this.add.container(0, 0, [pill, label]);
    container.setData("stampWidth", width);
    return container;
  }

  private createStats(
    card: Phaser.GameObjects.Container,
    frame: CardFrame,
    view: DeliveryResultPresentation,
    stampsBottom: number,
    postcard: Rect,
  ): void {
    const layout = frame.layout;
    const x = frame.rightX;
    const dividerY = Math.round(stampsBottom + SPACING.statsDividerGap);
    const half = Math.round(layout.statGap / 2);
    const firstY = dividerY + half + 4;
    // Rows tighten (never below statMinGap) when wrapped stamps push the list toward the footer,
    // and trailing rows drop rather than collide with it.
    const lastAllowedY = frame.contentBottom - half;
    const fitRows = Math.max(1, Math.floor((lastAllowedY - firstY) / layout.statMinGap) + 1);
    const stats = view.stats.slice(0, Math.min(view.stats.length, fitRows));
    const room = stats.length > 1 ? (lastAllowedY - firstY) / (stats.length - 1) : layout.statGap;
    const gap = Math.round(Math.max(layout.statMinGap, Math.min(layout.statGap, room)));

    const divider = this.add.graphics();
    const rowsBottom = firstY + (stats.length - 1) * gap + half;
    const dividerEnd = rowsBottom > postcard.top - SPACING.postcardClearance ? postcard.left - SPACING.postcardClearance : frame.innerRight;
    drawDashedLine(divider, x, dividerY, dividerEnd, colors.borderStrong);

    const parts: StagedPart[] = [this.part(divider, { alpha: 0 })];
    stats.forEach((stat, index) => {
      const y = firstY + index * gap;
      // 16 art px icons at the same integer 2x as every other pixel asset on the card.
      const icon = addUiIcon(this, x + SPACING.statIconX, y, stat.icon, { scale: ART_SCALE });
      const text = this.add
        .text(x + SPACING.statTextX, y, stat.text, {
          color: colors.inkSoft,
          fontFamily: fontStacks.mono,
          fontSize: `${typeScale[layout.type.stat]}px`,
        })
        .setOrigin(0, 0.5);
      card.add([icon, text]);
      parts.push(this.part(icon, { alpha: 0, dx: -6 }), this.part(text, { alpha: 0, dx: -6 }));
    });
    card.add(divider);

    this.stage(resultRevealTiming.stats, motion.slow, "Cubic.easeOut", parts);
  }

  /** Postcard pinned bottom-right of the copy column; returns its rect (card-local) for flow layout. */
  /**
   * Final card: one thank-you line per completed delivery (never collectible counts or quality), beside
   * the postcard. Lines that would run into the footer are left out rather than shrunk.
   */
  private createThankYouNotes(
    card: Phaser.GameObjects.Container,
    frame: CardFrame,
    view: DeliveryResultPresentation,
    top: number,
    postcard: Rect,
  ): void {
    const x = frame.rightX;
    const width = Math.max(CAMPAIGN_ART.minNoteWidth, postcard.left - SPACING.postcardClearance - x);
    const title = this.add.text(x, Math.round(top), campaignResultCopy.notesTitle, {
      color: colors.terracottaDeep,
      fontFamily: fontStacks.mono,
      fontSize: "16px",
      fontStyle: "700",
    });
    let cursor = Math.round(top + title.height + NOTES.titleGap);
    const notes = view.thankYouNotes.length > 0 ? view.thankYouNotes : [campaignResultCopy.noNotes];
    const lines: Phaser.GameObjects.Text[] = [];
    for (const note of notes) {
      const line = this.add.text(x, cursor, `${NOTES.bullet}${note}`, {
        color: colors.ink,
        fontFamily: fontStacks.ui,
        fontSize: `${this.tier === "full" ? 20 : 26}px`,
        wordWrap: { width },
      });
      cursor += Math.round(line.height) + NOTES.lineGap;
      lines.push(line);
    }

    card.add([title, ...lines]);
    this.stage(endingRevealTiming.notesTitle, motion.slow, "Cubic.easeOut", [this.part(title, { alpha: 0, dy: 6 })]);
    lines.forEach((line, index) => {
      const at = endingRevealTiming.firstNote + index * endingRevealTiming.noteGap;
      this.stage(at, motion.slow, "Cubic.easeOut", [this.part(line, { alpha: 0, dx: -8 })]);
    });
    if (view.closingLine) {
      const closing = this.add.text(x, cursor + 12, view.closingLine, {
        color: colors.terracottaDeep,
        fontFamily: fontStacks.display,
        fontSize: `${this.tier === "full" ? 24 : 26}px`,
        fontStyle: "600",
        wordWrap: { width },
      });
      card.add(closing);
      this.stage(endingRevealTiming.closing, motion.slow, "Cubic.easeOut", [this.part(closing, { alpha: 0, dy: 8 })]);
    }
  }

  private createPostcard(card: Phaser.GameObjects.Container, frame: CardFrame, view: DeliveryResultPresentation): Rect {
    const layout = frame.layout;
    const scale = layout.postcardScale;
    const w = ART.postcard.width * scale;
    const h = ART.postcard.height * scale;

    const title = this.add
      .text(0, 0, view.postcardTitle, {
        color: colors.inkSoft,
        fontFamily: fontStacks.ui,
        fontSize: `${typeScale[layout.type.postcardTitle]}px`,
      })
      .setOrigin(0.5, 1);
    const label = this.add
      .text(0, 0, `✦ ${view.postcardLabel} ✦`, {
        color: colors.terracottaDeep,
        fontFamily: fontStacks.mono,
        fontSize: `${typeScale[layout.type.postcardLabel]}px`,
        fontStyle: "700",
      })
      .setOrigin(0.5, 1);

    const x = Math.round(frame.innerRight - SPACING.postcardSlotPad - w / 2);
    const titleBottom = Math.round(frame.contentBottom);
    const labelBottom = Math.round(titleBottom - title.height - SPACING.postcardTitleGap);
    const bottom = Math.round(labelBottom - label.height - SPACING.postcardLabelGap);
    const y = Math.round(bottom - h / 2);
    title.setPosition(x, titleBottom);
    label.setPosition(x, labelBottom);

    // Axis-aligned card on the pixel grid; the hand-placed feel comes from a leaning hard shadow
    // and paper photo corners rather than rotating the art.
    const holder = this.add.container(x, y);
    const shadow = this.add.graphics();
    shadow.fillStyle(colorNumber(colors.ink), POSTCARD_SHADOW.alpha);
    shadow.fillRect(-w / 2 + POSTCARD_SHADOW.x, -h / 2 + POSTCARD_SHADOW.y, w, h);
    const postcard = view.legacy
      ? this.add.image(0, 0, ASSET.memoryPostcard).setScale(scale)
      : this.add
          .image(0, 0, ASSET.campaignPostcards, this.theme.postcardFrame ?? 0)
          .setScale(scale * CAMPAIGN_ART.postcardScaleFactor);
    const corners = this.add.graphics();
    drawPhotoCorners(corners, -w / 2, -h / 2, w, h);
    holder.add([shadow, postcard, corners]);

    const rect: Rect = { left: x - w / 2, top: y - h / 2, right: x + w / 2, bottom: y + h / 2 };

    card.add([holder, label, title]);
    this.stage(resultRevealTiming.postcard, motion.slow, "Back.easeOut", [
      this.part(holder, { alpha: 0, scaleX: 0, angle: ENTRY.postcardAngle }),
      this.part(label, { alpha: 0, dy: 6 }),
      this.part(title, { alpha: 0, dy: 6 }),
    ], (instant) => {
      if (!instant) this.playTwinkles(card, rect);
      this.cheerRabbit(instant);
      this.welcomeRecipient();
    });

    return rect;
  }

  /**
   * A few authored sparkle sprites twinkle on the parchment just outside the postcard, stepping
   * through their frames at integer 2x. They are gone before the reveal completes.
   */
  private playTwinkles(card: Phaser.GameObjects.Container, rect: Rect): void {
    if (this.reducedMotion || this.isFallback(ASSET.fxSparkle)) return;
    const cx = (rect.left + rect.right) / 2;
    const cy = (rect.top + rect.bottom) / 2;
    const halfW = (rect.right - rect.left) / 2;
    const halfH = (rect.bottom - rect.top) / 2;
    const { frames, frameMs } = resultTwinkle;

    for (const spot of resultTwinkle.spots) {
      const sprite = this.add
        .sprite(Math.round(cx + spot.fx * halfW + spot.ox), Math.round(cy + spot.fy * halfH + spot.oy), ASSET.fxSparkle, frames[0])
        .setScale(ART_SCALE)
        .setVisible(false);
      card.add(sprite);
      this.twinkles.push(sprite);
      frames.forEach((frameIndex, step) => {
        this.time.delayedCall(spot.delayMs + step * frameMs, () => {
          if (sprite.active) sprite.setVisible(true).setFrame(frameIndex);
        });
      });
      this.time.delayedCall(spot.delayMs + frames.length * frameMs, () => this.removeTwinkle(sprite));
    }
  }

  private removeTwinkle(sprite: Phaser.GameObjects.Sprite): void {
    this.twinkles = this.twinkles.filter((candidate) => candidate !== sprite);
    sprite.destroy();
  }

  private clearTwinkles(): void {
    for (const sprite of this.twinkles) sprite.destroy();
    this.twinkles = [];
  }

  private createFooter(card: Phaser.GameObjects.Container, frame: CardFrame, view: DeliveryResultPresentation): void {
    const layout = frame.layout;
    const divider = this.add.graphics();
    drawDashedLine(divider, frame.innerLeft, frame.footerY, frame.innerRight, colors.borderStrong);

    // Actions read left to right; they are laid out from the right edge so the primary keeps its slot.
    const minWidth = view.actions.length > 2 ? layout.campaignButtonMinWidth : layout.buttonMinWidth;
    const footer: FooterButton[] = view.actions.map((action) => {
      const button = this.createButton(layout, action.variant, action, () => this.activate(action), minWidth);
      return { action, button };
    });
    let right = frame.innerRight;
    for (const { button } of [...footer].reverse()) {
      button.root.setPosition(right - button.width, frame.buttonTop);
      right -= button.width + layout.buttonGap;
    }
    this.buttons = footer;
    const leftmost = Math.min(...footer.map(({ button }) => button.root.x));

    // Note column: the delivery note plus, when progress can't be kept, a kind footnote.
    const noteX = frame.innerLeft + SPACING.notePadX;
    const noteWidth = view.isEnding ? frame.rightX - noteX + frame.rightWidth - 240 : leftmost - layout.buttonGap - noteX;
    const roomForNotes = view.isEnding || noteWidth >= CAMPAIGN_ART.minNoteWidth;
    const lines: Phaser.GameObjects.Text[] = [];
    if (layout.showDeliveryNote && roomForNotes) {
      lines.push(
        this.add.text(noteX, 0, view.deliveryNote, {
          color: view.isNewWarmest ? colors.terracottaDeep : colors.inkSoft,
          fontFamily: fontStacks.ui,
          fontSize: `${typeScale[layout.type.note]}px`,
          fontStyle: view.isNewWarmest ? "600" : "400",
          wordWrap: { width: noteWidth },
        }),
      );
    }
    const notice = persistenceNotice(this.persistence);
    if (notice && roomForNotes) {
      lines.push(
        this.add.text(noteX, 0, notice, {
          color: colors.inkSoft,
          fontFamily: fontStacks.ui,
          fontSize: `${typeScale[layout.type.notice]}px`,
          fontStyle: "italic",
          lineSpacing: 2,
          wordWrap: { width: noteWidth },
        }),
      );
    }
    const faceCenter = frame.buttonTop + ((layout.buttonHeight / ART_SCALE - BUTTON_ART.lip) / 2) * ART_SCALE;
    const blockHeight = lines.reduce((sum, line) => sum + line.height, 0) + Math.max(0, lines.length - 1) * SPACING.noteGap;
    let y = view.isEnding ? Math.round(frame.footerY - blockHeight - 8) : Math.round(faceCenter - blockHeight / 2);
    for (const line of lines) {
      line.setY(y);
      y += Math.round(line.height) + SPACING.noteGap;
    }

    card.add([divider, ...lines, ...footer.map(({ button }) => button.root)]);
    this.stage(view.isEnding ? endingRevealTiming.footer : resultRevealTiming.footer, motion.base, "Cubic.easeOut", [
      this.part(divider, { alpha: 0 }),
      ...lines.map((line) => this.part(line, { alpha: 0 })),
      ...footer.map(({ button }) => this.part(button.root, { alpha: 0, dy: 12 })),
    ]);
  }

  /** Pixel button matching the UI kit's stamped look. Origin: top-left; the lip is inside `height`. */
  private createButton(
    layout: ResultCardLayout,
    variant: ButtonVariant,
    copy: { readonly label: string; readonly key: string },
    onActivate: () => void,
    minWidth: number = layout.buttonMinWidth,
  ): ResultButton {
    const palette = BUTTON_PALETTE[variant];
    const height = layout.buttonHeight;
    const legacy = this.view?.legacy ?? true;
    const pixel = !legacy || layout.buttonFont === "pixel";
    const labelSize = legacy ? typeScale[layout.type.button] : this.view?.isEnding || this.tier === "full" ? 16 : 24;
    const label = this.add
      .text(0, 0, copy.label, {
        color: palette.label,
        fontFamily: pixel ? fontStacks.pixel : fontStacks.ui,
        fontSize: `${labelSize}px`,
        fontStyle: pixel ? "400" : "600",
      })
      .setOrigin(0, 0.5);
    label.setShadow(0, ART_SCALE, palette.labelShadow, 0, false, true);
    const keycap = !legacy || layout.showKeycaps ? new Keycap(this, { x: 0, y: 0, label: copy.key }) : undefined;
    const border = BUTTON_ART.border * ART_SCALE;
    const keycapSpace = keycap ? keycap.keyWidth + SPACING.keycapPadRight + SPACING.buttonLabelPad : 0;
    const width = evenCeil(Math.max(minWidth, label.width + keycapSpace + (border + SPACING.buttonLabelPad) * 2));
    const centerY = ((height / ART_SCALE - BUTTON_ART.lip) / 2) * ART_SCALE;

    label.setPosition(keycap ? border + SPACING.buttonLabelPad : Math.round((width - label.width) / 2), centerY);
    const face = this.add.container(0, 0, [label]);
    if (keycap) {
      keycap.setPosition(width - border - SPACING.keycapPadRight - keycap.keyWidth, Math.round(centerY - KEYCAP_HEIGHT / 2));
      face.add(keycap);
    }

    // Both variants share one drawn silhouette (ink border + solid ink lip) so the pair reads as a set.
    const graphics = this.add.graphics();
    const zone = this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    const root = this.add.container(0, 0, [graphics, face, zone]);
    const button: ResultButton = { root, face, graphics, variant, width, height, state: "idle" };
    this.drawButton(button);

    zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => {
      if (!this.revealComplete || this.leaving) return;
      this.setButtonState(button, "hover");
      emitGameEvent(this, { type: "ui:hover" });
    });
    zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => {
      if (this.leaving) return;
      this.setButtonState(button, "idle");
    });
    zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      if (!this.revealComplete || this.leaving) return;
      this.setButtonState(button, "pressed");
    });
    zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
      if (!this.revealComplete || this.leaving || button.state !== "pressed") return;
      onActivate();
    });

    return button;
  }

  private setButtonState(button: ResultButton, state: ButtonState): void {
    if (button.state === state) return;
    button.state = state;
    this.drawButton(button);
  }

  private drawButton(button: ResultButton): void {
    const pressed = button.state === "pressed";
    const sink = pressed ? BUTTON_ART.pressSink : 0;
    button.face.setY(sink * ART_SCALE);

    const palette = BUTTON_PALETTE[button.variant];
    const fill = button.state === "hover" ? palette.hover : pressed ? palette.pressed : palette.fill;
    const g = button.graphics;
    const u = ART_SCALE;
    const w = button.width / u;
    const h = button.height / u;
    const { notch, border, lip } = BUTTON_ART;
    const px = (x: number, y: number, cw: number, ch: number): void => {
      g.fillRect(x * u, y * u, cw * u, ch * u);
    };
    g.clear();
    // Ink silhouette: notched top row, full-width body, then the notched hard lip below the face.
    g.fillStyle(colorNumber(colors.ink), 1);
    px(notch, sink, w - notch * 2, 1);
    px(0, sink + 1, w, h - lip - 1);
    px(notch, h - lip + sink, w - notch * 2, lip - sink);
    // Face fill, top highlight and bottom bevel (2 px border top/sides, 1 px above the lip).
    const faceTop = sink + border;
    const faceBottom = h - lip - 2 + sink;
    g.fillStyle(colorNumber(fill), 1);
    px(border, faceTop, w - border * 2, faceBottom - faceTop + 1);
    g.fillStyle(colorNumber(colors.plaster), pressed ? 0 : palette.highlightAlpha);
    px(border, faceTop, w - border * 2, 1);
    g.fillStyle(colorNumber(palette.bevel), 1);
    px(border, faceBottom, w - border * 2, 1);
  }

  private createSkipHint(): void {
    const { width, height } = this.scale;
    this.skipHint = this.add
      .text(width / 2, height - SPACING.skipHintBottom, resultCopy.skipHint, {
        color: colors.plaster,
        fontFamily: fontStacks.mono,
        fontSize: `${typeScale[resultCardLayouts[this.tier].type.skipHint]}px`,
      })
      .setOrigin(0.5)
      .setAlpha(0.6)
      .setDepth(depth.hud);
  }

  // ---------------------------------------------------------------- reveal

  /** Captures the object's resting state, moves it to its "from" state, and returns the part. */
  private part(target: Stageable, from: StageFrom): StagedPart {
    const rest: StageProps = {
      alpha: target.alpha,
      x: target.x,
      y: target.y,
      scaleX: target.scaleX,
      scaleY: target.scaleY,
      angle: target.angle,
    };
    target.alpha = from.alpha ?? target.alpha;
    if (this.reducedMotion) return { target, rest };
    target.x += from.dx ?? 0;
    target.y += from.dy ?? 0;
    if (from.scale !== undefined) {
      target.scaleX = from.scale;
      target.scaleY = from.scale;
    }
    if (from.scaleX !== undefined) target.scaleX = from.scaleX;
    if (from.angle !== undefined) target.angle = from.angle;
    return { target, rest };
  }

  private stage(
    at: number,
    duration: number,
    ease: string,
    parts: readonly StagedPart[],
    onPlay?: (instant: boolean) => void,
  ): void {
    this.steps.push({ at, parts, duration, ease, onPlay, played: false });
  }

  private scheduleReveal(): void {
    for (const step of this.steps) {
      this.stepTimers.push(this.time.delayedCall(step.at, () => this.playStep(step)));
    }
    this.stepTimers.push(this.time.delayedCall(this.view?.isEnding ? endingRevealTiming.complete : resultRevealTiming.complete, () => this.finishReveal()));
  }

  private playStep(step: RevealStep): void {
    if (step.played) return;
    step.played = true;
    const duration = this.reducedMotion ? motion.base : step.duration;
    const ease = this.reducedMotion ? "Linear" : step.ease;
    for (const { target, rest } of step.parts) {
      // Snap exactly onto the rest pose at the end, so nothing lingers at a fractional angle/scale.
      this.tweens.add({ targets: target, ...rest, duration, ease, onComplete: () => Object.assign(target, rest) });
    }
    step.onPlay?.(false);
  }

  /** Jumps every staged element to its resting state and plays any skipped side effects instantly. */
  private settleSteps(): void {
    for (const timer of this.stepTimers) timer.remove();
    this.stepTimers = [];
    for (const step of this.steps) {
      for (const { target, rest } of step.parts) {
        this.tweens.killTweensOf(target);
        Object.assign(target, rest);
      }
      if (!step.played) {
        step.played = true;
        step.onPlay?.(true);
      }
    }
  }

  /** Skips or ends the reveal. Safe to call more than once. */
  private finishReveal(): void {
    if (this.revealComplete) return;
    this.settleSteps();
    this.clearTwinkles();
    // Stamp dust is gone the moment the card settles, so the resting frame is always clean.
    settleBursts(this, 0);
    this.completeReveal();
  }

  private completeReveal(): void {
    if (this.revealComplete) return;
    this.revealComplete = true;
    if (this.skipHint) {
      const hint = this.skipHint;
      this.tweens.add({ targets: hint, alpha: 0, duration: motion.fast, onComplete: () => hint.destroy() });
      this.skipHint = undefined;
    }
    emitGameEvent(this, { type: "result:shown", landingResult: this.resultData.landingResult });
    if (this.view?.isEnding && !this.endingMarked) {
      // Only once the final card has actually been shown.
      this.endingMarked = true;
      try {
        SaveSystem.markEndingSeen();
      } catch {
        // SaveSystem degrades to memory; the ending stays on screen regardless.
      }
    }
  }

  private clearCardTimers(): void {
    for (const timer of this.stepTimers) timer.remove();
    this.stepTimers = [];
    this.blinkTimer?.remove();
    this.blinkTimer = undefined;
    this.happyTimer?.remove();
    this.happyTimer = undefined;
  }

  // ---------------------------------------------------------------- rabbit

  private blinkOnce(): void {
    const rabbit = this.rabbit;
    if (!rabbit?.active || this.rabbitHappy || this.reducedMotion) {
      this.scheduleBlink();
      return;
    }
    rabbit.setFrame(RABBIT_PORTRAIT_FRAME.blink);
    this.time.delayedCall(resultRevealTiming.blinkHoldMs, () => {
      if (rabbit.active && !this.rabbitHappy) rabbit.setFrame(RABBIT_PORTRAIT_FRAME.idle);
    });
    this.scheduleBlink();
  }

  private scheduleBlink(): void {
    this.blinkTimer?.remove();
    const delay = Phaser.Math.Between(resultRevealTiming.blinkMinMs, resultRevealTiming.blinkMaxMs);
    this.blinkTimer = this.time.delayedCall(delay, () => this.blinkOnce());
  }

  private welcomeRecipient(): void {
    if (this.recipient?.active) this.recipient.setFrame(CAMPAIGN_PORTRAIT_FRAME.welcome);
  }

  private cheerRabbit(instant: boolean): void {
    const rabbit = this.rabbit;
    if (!rabbit) return;
    this.rabbitHappy = true;
    rabbit.setFrame(RABBIT_PORTRAIT_FRAME.happy);
    if (!instant && !this.reducedMotion) {
      const restY = this.rabbitRestY;
      this.tweens.add({
        targets: rabbit,
        y: restY - ENTRY.hop,
        duration: motion.base,
        ease: "Quad.easeOut",
        yoyo: true,
        repeat: 1,
        onComplete: () => rabbit.setY(restY),
      });
    }
    this.happyTimer?.remove();
    this.happyTimer = this.time.delayedCall(resultRevealTiming.happyHoldMs, () => {
      this.rabbitHappy = false;
      if (rabbit.active) rabbit.setFrame(RABBIT_PORTRAIT_FRAME.idle);
      this.scheduleBlink();
    });
  }

  // ---------------------------------------------------------------- input + navigation

  private bindInput(): void {
    const keyboard = this.input.keyboard;
    if (keyboard) {
      const onKey = (event: KeyboardEvent): void => {
        if (event.repeat || this.leaving) return;
        if (!this.revealComplete) {
          this.finishReveal();
          return;
        }
        const action = this.view?.actions.find((candidate) => candidate.codes.includes(event.code));
        if (action) this.activate(action);
      };
      keyboard.on("keydown", onKey);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => keyboard.off("keydown", onKey));
    }

    // Taps only skip the reveal; navigation always needs a button or key.
    const onPointer = (): void => {
      if (!this.revealComplete) this.finishReveal();
    };
    this.input.on(Phaser.Input.Events.POINTER_DOWN, onPointer);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.off(Phaser.Input.Events.POINTER_DOWN, onPointer));
  }

  private activate(action: ResultAction): void {
    if (this.leaving) return;
    const button = this.buttons.find((candidate) => candidate.action === action)?.button;
    switch (action.kind) {
      case "fly-again":
      case "next-delivery":
        this.leave(button, "ui:confirm", "FlightScene", { missionId: action.missionId });
        return;
      case "delivery-board": {
        const data: MissionSelectSceneData = { focusMissionId: action.missionId };
        this.leave(button, action.variant === "primary" ? "ui:confirm" : "ui:back", "MissionSelectScene", data);
        return;
      }
      case "back-to-title":
        this.leave(button, "ui:back", "TitleScene");
        return;
      case "read-notes":
        this.replayNotes();
        return;
    }
  }

  /** Final card: plays the reveal again in place (no save writes; the delivery is already kept). */
  private replayNotes(): void {
    if (!this.view || this.leaving || !this.revealComplete) return;
    emitGameEvent(this, { type: "ui:confirm" });
    this.clearCardTimers();
    for (const step of this.steps) for (const { target } of step.parts) this.tweens.killTweensOf(target);
    this.clearTwinkles();
    this.card?.destroy();
    this.steps = [];
    this.recipient = undefined;
    this.revealComplete = false;
    this.buildCard(this.view);
    this.revealStartedAt = performance.now();
    this.scheduleReveal();
  }

  private leave(button: ResultButton | undefined, eventType: "ui:confirm" | "ui:back", target: SceneKey, data?: object): void {
    if (this.leaving) return;
    this.leaving = true;
    emitGameEvent(this, { type: eventType });
    if (button) this.setButtonState(button, "pressed");
    transitionToScene(this, target, data, { kind: "warm-fade" });
  }

  // ---------------------------------------------------------------- helpers

  /** PreloadScene replaces missing art with a generated CanvasTexture of the same size. */
  private isFallback(key: string): boolean {
    return this.textures.get(key) instanceof Phaser.Textures.CanvasTexture;
  }
}

function stampWidth(stamp: Phaser.GameObjects.Container): number {
  const value: unknown = stamp.getData("stampWidth");
  return typeof value === "number" ? value : 0;
}

/** Rounds up to an even number of screen px (whole art pixels at 2x). */
function evenCeil(value: number): number {
  return Math.ceil(value / ART_SCALE) * ART_SCALE;
}

/** Steps through the candidate tokens (largest first) until the text fits on one line. */
function fitFontSize(text: Phaser.GameObjects.Text, tokens: readonly TypeToken[], maxWidth: number): void {
  for (const token of tokens) {
    text.setFontSize(typeScale[token]);
    if (text.width <= maxWidth) return;
  }
}

/**
 * Pixel-stepped rounded rectangle from axis-aligned 2px bands (no anti-aliased curves).
 * `steps[i]` is the horizontal inset of the i-th band from the top, mirrored at the bottom.
 */
function fillStepped(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  steps: readonly number[],
): void {
  const band = ART_SCALE;
  const left = Math.round(x);
  const top = Math.round(y);
  const w = evenCeil(width);
  const h = evenCeil(height);
  if (w <= 0 || h <= 0) return;
  const bands = Math.min(steps.length, Math.floor(h / (band * 2)));
  for (let index = 0; index < bands; index += 1) {
    const inset = Math.min(steps[index] ?? 0, Math.floor(w / 2));
    graphics.fillRect(left + inset, top + index * band, w - inset * 2, band);
    graphics.fillRect(left + inset, top + h - (index + 1) * band, w - inset * 2, band);
  }
  graphics.fillRect(left, top + bands * band, w, h - bands * band * 2);
}

/** Rubber-stamp pill on the 2x art grid: lip, 1 art px border, tinted face, and a pixel dot. */
function drawStampPill(
  g: Phaser.GameObjects.Graphics,
  left: number,
  top: number,
  width: number,
  height: number,
  palette: ResultStampPalette,
): void {
  const u = ART_SCALE;
  const corner = [6, 4, 2];
  g.fillStyle(colorNumber(palette.dot), 0.45);
  fillStepped(g, left, top + STAMP_ART.lip * u, width, height, corner);
  g.fillStyle(colorNumber(palette.foreground), 0.6);
  fillStepped(g, left, top, width, height, corner);
  g.fillStyle(colorNumber(palette.background), 1);
  fillStepped(g, left + u, top + u, width - u * 2, height - u * 2, [4, 2]);
  g.fillStyle(colorNumber(colors.plaster), 0.35);
  g.fillRect(left + u * 4, top + u, width - u * 8, u);

  const dot = STAMP_ART.dotSize * u;
  const dotX = left + STAMP_ART.dotLeft * u;
  const dotY = Math.round(top + height / 2 - dot / 2);
  g.fillStyle(colorNumber(palette.foreground), 0.6);
  fillStepped(g, dotX - u, dotY - u, dot + u * 2, dot + u * 2, [2]);
  g.fillStyle(colorNumber(palette.dot), 1);
  fillStepped(g, dotX, dotY, dot, dot, [2]);
}

/** Kraft-paper photo corners (stair-stepped triangles on the 2x art grid) over each postcard corner. */
function drawPhotoCorners(g: Phaser.GameObjects.Graphics, left: number, top: number, width: number, height: number): void {
  const u = ART_SCALE;
  const leg = PHOTO_CORNER.leg;
  const out = PHOTO_CORNER.outset * u;
  const right = left + width;
  const bottom = top + height;
  for (let row = 0; row < leg; row += 1) {
    const run = (leg - row) * u;
    const edge = u;
    const rows: readonly [number, boolean, boolean][] = [
      [top - out + row * u, false, false],
      [top - out + row * u, true, false],
      [bottom + out - (row + 1) * u, false, true],
      [bottom + out - (row + 1) * u, true, true],
    ];
    for (const [y, onRight] of rows) {
      const x = onRight ? right + out - run : left - out;
      g.fillStyle(colorNumber(colors.amber), 1);
      g.fillRect(x, y, run, u);
      // Darker hypotenuse pixel so each corner reads as folded paper.
      g.fillStyle(colorNumber(colors.terracottaDeep), 1);
      g.fillRect(onRight ? x : x + run - edge, y, edge, u);
    }
  }
}

function drawDashedLine(graphics: Phaser.GameObjects.Graphics, x1: number, y: number, x2: number, color: string): void {
  graphics.fillStyle(colorNumber(color), DASH.alpha);
  const top = Math.round(y - DASH.width / 2);
  for (let x = Math.round(x1); x < x2; x += DASH.length + DASH.gap) {
    graphics.fillRect(x, top, Math.min(DASH.length, x2 - x), DASH.width);
  }
}
