import Phaser from "phaser";
import { ASSET, RABBIT_PORTRAIT_FRAME, UI_ICON_FRAME } from "../data/assetManifest";
import { TEA_MOON_MISSION_ID } from "../data/missions";
import { resultCopy, resultRevealTiming, resultStampPalette } from "../data/resultCopy";
import { installDevSceneHotkeys } from "../dev/DevSceneLauncher";
import { registerDevState } from "../dev/devProbe";
import { burstDust, burstSparkles, isReducedMotion } from "../fx/feedback";
import { colorNumber, colors, depth, fontStacks, motion, typeScale } from "../game/designTokens";
import { emitGameEvent } from "../game/events";
import {
  createDeliveryResultContent,
  createDeliveryResultPresentation,
  createMissionResultSummary,
  normalizeDeliveryResultData,
  type DeliveryResultPresentation,
  type ResultStamp,
} from "../systems/MissionResultSystem";
import { SaveSystem } from "../systems/SaveSystem";
import type { DeliveryResultSceneData } from "../types/landing";

/** Card layout in logical pixels (1280x720 canvas). Local coordinates are relative to the card centre. */
const LAYOUT = {
  cardX: 640,
  cardY: 384,
  cardWidth: 1000,
  cardHeight: 556,
  cardRadius: 8,
  pad: 30,
  leftColumnX: -326,
  rightColumnX: -146,
  rightColumnWidth: 600,
  leftBandWidth: 304,
  portraitY: -122,
  portraitFrame: 172,
  trayY: 84,
  trayWidth: 236,
  trayHeight: 62,
  /** Space between the report line and the stamp row; stamps flow (and wrap) beneath the copy. */
  stampsGapAbove: 18,
  stampHeight: 36,
  stampGapX: 14,
  stampGapY: 10,
  /** Dashed divider sits this far below the last stamp row; the first stat this far below the divider. */
  statsDividerGap: 18,
  statsFirstGap: 30,
  statsGap: 36,
  statsMinGap: 28,
  postcardX: 346,
  postcardY: 76,
  /** Clearance kept between the stamp rows and the postcard (tape + tilt included). */
  postcardClearance: 14,
  footerY: 186,
  buttonY: 230,
  buttonHeight: 50,
  moonX: 1148,
  moonY: 118,
  plumX: 92,
  plumY: 628,
} as const;

/** Display scale for pixel art (manifest artScale). */
const ART_SCALE = 2;
const STEAM_ANIM_KEY = "result-item-steam";
/** memory-postcard art size in art pixels (assetManifest). */
const POSTCARD_SIZE = { width: 96, height: 64 } as const;
/** Stamps settle slightly askew, like they were pressed by hand. */
const STAMP_REST_ANGLE = { landing: -1.5, condition: 1 } as const;
const STEAM_FRAME_RATE = 6;
/** Dust puff when a stamp lands. */
const STAMP_PUFF = { count: 5, spread: 40, offsetY: 4 } as const;
/** Backdrop moon glow, plus the shape of the placeholder moon used until the art lands (radius-relative). */
const MOON_GLOW = {
  /** celestial-tea-moon is 192x192 art pixels. */
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

type StageProps = {
  alpha?: number;
  x?: number;
  y?: number;
  scaleX?: number;
  scaleY?: number;
  angle?: number;
};

type Stageable = Phaser.GameObjects.GameObject & {
  alpha: number;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  angle: number;
};

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
  readonly rest: Required<StageProps>;
};

type RevealStep = {
  readonly at: number;
  readonly parts: readonly StagedPart[];
  readonly duration: number;
  readonly ease: string;
  /** Side effects (sparkles, faces). `instant` is true when the reveal was skipped. */
  readonly onPlay?: (instant: boolean) => void;
  played: boolean;
};

type ResultButton = {
  readonly container: Phaser.GameObjects.Container;
  readonly body: Phaser.GameObjects.Container;
  hovered: boolean;
};

export class DeliveryResultScene extends Phaser.Scene {
  private resultData: DeliveryResultSceneData = normalizeDeliveryResultData(undefined);
  private saved = false;
  private revealComplete = false;
  private leaving = false;
  private reducedMotion = false;
  private steps: RevealStep[] = [];
  private stepTimers: Phaser.Time.TimerEvent[] = [];
  private stars?: Phaser.GameObjects.TileSprite;
  private rabbit?: Phaser.GameObjects.Sprite;
  private rabbitHappy = false;
  private blinkTimer?: Phaser.Time.TimerEvent;
  private buttons: ResultButton[] = [];
  private skipHint?: Phaser.GameObjects.Text;

  constructor() {
    super("DeliveryResultScene");
  }

  init(data: Partial<DeliveryResultSceneData> | undefined): void {
    this.resultData = normalizeDeliveryResultData(data);
    this.saved = false;
    this.revealComplete = false;
    this.leaving = false;
    this.steps = [];
    this.stepTimers = [];
    this.buttons = [];
    this.rabbitHappy = false;
    this.blinkTimer = undefined;
    this.stars = undefined;
    this.rabbit = undefined;
    this.skipHint = undefined;
  }

  create(): void {
    emitGameEvent(this, { type: "scene:enter", scene: "DeliveryResultScene" });

    const view = this.recordDelivery();
    this.reducedMotion = isReducedMotion() || SaveSystem.load().settings.reducedMotion;

    this.createBackdrop();
    this.createCard(view);
    this.createSkipHint();
    this.scheduleReveal();
    this.bindInput();

    installDevSceneHotkeys(this);
    registerDevState("result", () => ({
      saved: this.saved,
      landingResult: this.resultData.landingResult,
      conditionLabel: view.content.conditionLabel,
      revealComplete: this.revealComplete,
    }));

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.blinkTimer?.remove();
      for (const timer of this.stepTimers) timer.remove();
    });
  }

  update(_time: number, delta: number): void {
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
    });

    if (!this.saved) {
      try {
        SaveSystem.completeMission(missionId, createMissionResultSummary(view.content), view.content.memoryRewardId);
      } catch {
        // SaveSystem already degrades to memory; this guard keeps the celebration on screen regardless.
      }
      this.saved = true;
      emitGameEvent(this, { type: "mission:completed", missionId });
    }

    return view;
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
      .setAlpha(this.isFallback(ASSET.spaceNebula) ? 0.18 : 0.55)
      .setDepth(depth.parallax);

    const plumFallback = this.isFallback(ASSET.planetFarPlum);
    this.add
      .image(LAYOUT.plumX, LAYOUT.plumY, ASSET.planetFarPlum)
      .setScale(ART_SCALE)
      .setAlpha(plumFallback ? MOON_GLOW.fallbackAlpha : 0.9)
      .setDepth(depth.parallax);

    // Warm halo so the tea moon glows into the dusk, with or without its final art.
    const halo = this.add.graphics().setDepth(depth.parallax);
    MOON_GLOW.rings.forEach(({ radius, alpha }) => {
      halo.fillStyle(colorNumber(colors.amber), alpha);
      halo.fillCircle(LAYOUT.moonX, LAYOUT.moonY, radius);
    });

    const moonFallback = this.isFallback(ASSET.celestialTeaMoon);
    const moon = moonFallback
      ? this.createPlaceholderMoon()
      : this.add.image(LAYOUT.moonX, LAYOUT.moonY, ASSET.celestialTeaMoon).setScale(ART_SCALE).setDepth(depth.parallax);
    if (!this.reducedMotion) {
      this.tweens.add({
        targets: moon,
        y: LAYOUT.moonY + 8,
        duration: motion.breath * 2,
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1,
      });
    }

    // Soft dusk wash so the parchment card glows against the sky.
    const wash = this.add.graphics().setDepth(depth.parallax);
    wash.fillStyle(colorNumber(colors.cosmos), 0.35);
    wash.fillRect(0, 0, width, height);
  }

  /**
   * Stand-in while `celestial-tea-moon` art is still in production: a shaded sage disc with a few
   * soft craters instead of PreloadScene's flat circle. Same footprint as the final sprite.
   */
  private createPlaceholderMoon(): Phaser.GameObjects.Graphics {
    const radius = MOON_GLOW.artRadius * ART_SCALE;
    const moon = this.add.graphics({ x: LAYOUT.moonX, y: LAYOUT.moonY }).setDepth(depth.parallax);
    moon.fillStyle(colorNumber(colors.sageDeep), 1);
    moon.fillCircle(0, 0, radius);
    moon.fillStyle(colorNumber(colors.sage), 1);
    moon.fillCircle(-radius * 0.08, -radius * 0.06, radius * 0.9);
    moon.fillStyle(colorNumber(colors.plaster), 0.12);
    moon.fillCircle(-radius * 0.22, -radius * 0.22, radius * 0.55);
    MOON_GLOW.craters.forEach(({ x, y, r }) => {
      moon.fillStyle(colorNumber(colors.sageDeep), 0.45);
      moon.fillCircle(x * radius, y * radius, r * radius);
      moon.fillStyle(colorNumber(colors.plaster), 0.18);
      moon.fillCircle(x * radius - r * radius * 0.2, y * radius - r * radius * 0.2, r * radius * 0.55);
    });
    return moon;
  }

  // ---------------------------------------------------------------- card

  private createCard(view: DeliveryResultPresentation): void {
    const card = this.add.container(LAYOUT.cardX, LAYOUT.cardY).setDepth(depth.hud);

    card.add(this.createCardSurface());
    this.stage(resultRevealTiming.card, motion.slow, "Cubic.easeOut", [this.part(card, { alpha: 0, dy: 24 })]);

    this.createPortrait(card);
    this.createItems(card, view);
    const copyBottom = this.createHeadline(card, view);
    const stampsBottom = this.createStamps(card, view, copyBottom + LAYOUT.stampsGapAbove);
    this.createStats(card, view, stampsBottom);
    this.createPostcard(card, view);
    this.createFooter(card, view);
  }

  private createCardSurface(): Phaser.GameObjects.GameObject[] {
    const w = LAYOUT.cardWidth;
    const h = LAYOUT.cardHeight;
    const left = -w / 2;
    const top = -h / 2;
    const parts: Phaser.GameObjects.GameObject[] = [];

    const shadow = this.add.graphics();
    shadow.fillStyle(colorNumber(colors.cosmosDeep), 0.45);
    shadow.fillRoundedRect(left + 6, top + 14, w, h, LAYOUT.cardRadius + 4);
    shadow.fillStyle(colorNumber(colors.cosmosDeep), 0.25);
    shadow.fillRoundedRect(left - 6, top + 4, w + 12, h + 22, LAYOUT.cardRadius + 8);
    parts.push(shadow);

    if (this.isFallback(ASSET.uiPanelParchment)) {
      const surface = this.add.graphics();
      surface.fillStyle(colorNumber(colors.parchmentWarm), 1);
      surface.fillRoundedRect(left, top, w, h, LAYOUT.cardRadius);
      surface.lineStyle(2, colorNumber(colors.borderStrong), 1);
      surface.strokeRoundedRect(left, top, w, h, LAYOUT.cardRadius);
      surface.lineStyle(1, colorNumber(colors.border), 1);
      surface.strokeRoundedRect(left + 8, top + 8, w - 16, h - 16, LAYOUT.cardRadius - 3);
      parts.push(surface);
    } else {
      const inset = 8;
      parts.push(
        this.add
          .nineslice(0, 0, ASSET.uiPanelParchment, undefined, w / ART_SCALE, h / ART_SCALE, inset, inset, inset, inset)
          .setScale(ART_SCALE),
      );
    }

    // Left column wash: a recessed band that holds the recipient and the delivered items.
    const band = this.add.graphics();
    band.fillStyle(colorNumber(colors.parchmentDeep), 0.75);
    band.fillRoundedRect(left + LAYOUT.pad - 8, top + LAYOUT.pad - 8, LAYOUT.leftBandWidth, LAYOUT.footerY - top - LAYOUT.pad - 8, 6);
    parts.push(band);

    return parts;
  }

  private createPortrait(card: Phaser.GameObjects.Container): void {
    const x = LAYOUT.leftColumnX;
    const y = LAYOUT.portraitY;
    const size = LAYOUT.portraitFrame;

    const frame = this.add.graphics();
    frame.fillStyle(colorNumber(colors.ink), 1);
    frame.fillRoundedRect(x - size / 2 + 3, y - size / 2 + 4, size, size, 8);
    frame.fillStyle(colorNumber(colors.cosmosPanel), 1);
    frame.fillRoundedRect(x - size / 2, y - size / 2, size, size, 8);
    frame.lineStyle(2, colorNumber(colors.ink), 1);
    frame.strokeRoundedRect(x - size / 2, y - size / 2, size, size, 8);
    // A little moon glow behind the rabbit.
    frame.fillStyle(colorNumber(colors.duskBlue), 0.22);
    frame.fillCircle(x, y + 6, 70);
    frame.fillStyle(colorNumber(colors.plaster), 0.08);
    frame.fillCircle(x, y + 6, 52);

    const rabbit = this.add.sprite(x, y + 4, ASSET.rabbitPortrait, RABBIT_PORTRAIT_FRAME.idle).setScale(ART_SCALE);
    this.rabbit = rabbit;

    const tagWidth = 196;
    const tag = this.add.graphics();
    tag.fillStyle(colorNumber(colors.ink), 1);
    tag.fillRoundedRect(x - tagWidth / 2, y + size / 2 - 14, tagWidth, 28, 14);
    const name = this.add
      .text(x, y + size / 2, resultCopy.recipientCaption, {
        color: colors.plaster,
        fontFamily: fontStacks.mono,
        fontSize: `${typeScale.md}px`,
        fontStyle: "700",
      })
      .setOrigin(0.5);

    card.add([frame, rabbit, tag, name]);
    this.stage(resultRevealTiming.portrait, motion.slow, "Back.easeOut", [
      this.part(frame, { alpha: 0 }),
      this.part(rabbit, { alpha: 0, scale: ART_SCALE * 0.75 }),
      this.part(tag, { alpha: 0, dy: 8 }),
      this.part(name, { alpha: 0, dy: 8 }),
    ], (instant) => {
      if (!instant) this.time.delayedCall(motion.slow + motion.base, () => this.blinkOnce());
    });
  }

  private createItems(card: Phaser.GameObjects.Container, view: DeliveryResultPresentation): void {
    const x = LAYOUT.leftColumnX;
    const y = LAYOUT.trayY;

    // A low wooden serving tray: items rest on its top third so they read as "set down", not floating.
    const trayLeft = x - LAYOUT.trayWidth / 2;
    const trayTop = y - LAYOUT.trayHeight / 2;
    const restLine = trayTop + LAYOUT.trayHeight * 0.62;
    const tray = this.add.graphics();
    tray.fillStyle(colorNumber(colors.borderStrong), 1);
    tray.fillRoundedRect(trayLeft + 2, trayTop + 4, LAYOUT.trayWidth, LAYOUT.trayHeight, 10);
    tray.fillStyle(colorNumber(colors.wallpaper), 1);
    tray.fillRoundedRect(trayLeft, trayTop, LAYOUT.trayWidth, LAYOUT.trayHeight, 10);
    tray.lineStyle(2, colorNumber(colors.borderStrong), 1);
    tray.strokeRoundedRect(trayLeft, trayTop, LAYOUT.trayWidth, LAYOUT.trayHeight, 10);
    // Soft contact shadows under each item.
    tray.fillStyle(colorNumber(colors.borderStrong), 0.45);
    tray.fillEllipse(x - 46, restLine, 64, 10);
    tray.fillEllipse(x + 48, restLine, 60, 10);

    const tea = this.add.image(x - 46, restLine + 2, ASSET.itemTea).setOrigin(0.5, 1).setScale(ART_SCALE);
    const mochi = this.add.image(x + 48, restLine + 2, ASSET.itemMochi).setOrigin(0.5, 1).setScale(ART_SCALE);
    const steamTop = restLine - 32 * ART_SCALE + 10;
    const steamA = this.add.sprite(x - 50, steamTop, ASSET.itemSteam, 0).setOrigin(0.5, 1).setScale(ART_SCALE).setAlpha(0);
    const steamB = this.add.sprite(x - 34, steamTop + 4, ASSET.itemSteam, 2).setOrigin(0.5, 1).setScale(ART_SCALE).setAlpha(0);

    const caption = this.add
      .text(x, trayTop + LAYOUT.trayHeight + 22, view.content.deliveryItemName, {
        color: colors.inkSoft,
        fontFamily: fontStacks.ui,
        fontSize: `${typeScale.md + 1}px`,
        fontStyle: "600",
      })
      .setOrigin(0.5);

    card.add([tray, steamA, steamB, tea, mochi, caption]);
    this.stage(resultRevealTiming.items, motion.slow, "Back.easeOut", [
      this.part(tray, { alpha: 0 }),
      this.part(tea, { alpha: 0, dy: -14 }),
      this.part(mochi, { alpha: 0, dy: -20 }),
      this.part(caption, { alpha: 0 }),
    ], () => this.startSteam([steamA, steamB]));
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
      wisp.setAlpha(fallback ? 0 : 0.85);
      if (fallback) return;
      wisp.play({ key: STEAM_ANIM_KEY, startFrame: index * 2 });
    });
  }

  /** Returns the local y of the bottom of the copy block. */
  private createHeadline(card: Phaser.GameObjects.Container, view: DeliveryResultPresentation): number {
    const x = LAYOUT.rightColumnX;
    const top = -LAYOUT.cardHeight / 2 + LAYOUT.pad;

    const kicker = this.add
      .text(x, top + 2, `${view.kicker}  ·  tea moon`, {
        color: colors.terracottaDeep,
        fontFamily: fontStacks.pixel,
        fontSize: `${typeScale.md}px`,
      })
      .setLetterSpacing(1);

    const headline = this.add.text(x, top + 26, view.content.headline, {
      color: colors.ink,
      fontFamily: fontStacks.display,
      fontSize: `${typeScale["3xl"] - 6}px`,
      fontStyle: "800",
      wordWrap: { width: LAYOUT.rightColumnWidth },
    });

    const reaction = this.add.text(x, top + 98, view.content.reactionLine, {
      color: colors.ink,
      fontFamily: fontStacks.display,
      fontSize: `${typeScale.lg + 4}px`,
      fontStyle: "600",
      lineSpacing: 4,
      wordWrap: { width: LAYOUT.rightColumnWidth },
    });

    const report = this.add.text(x, reaction.y + reaction.height + 12, view.content.reportLine, {
      color: colors.inkSoft,
      fontFamily: fontStacks.ui,
      fontSize: `${typeScale.md + 1}px`,
      wordWrap: { width: LAYOUT.rightColumnWidth },
    });

    card.add([kicker, headline, reaction, report]);
    this.stage(resultRevealTiming.headline, motion.slow, "Cubic.easeOut", [
      this.part(kicker, { alpha: 0, dx: -10 }),
      this.part(headline, { alpha: 0, dy: 10 }),
    ]);
    this.stage(resultRevealTiming.reaction, motion.slow, "Cubic.easeOut", [this.part(reaction, { alpha: 0, dy: 8 })]);
    this.stage(resultRevealTiming.report, motion.slow, "Cubic.easeOut", [this.part(report, { alpha: 0 })]);
    return report.y + report.height;
  }

  /**
   * Lays the stamps out left to right beneath the copy, wrapping to a new row when a stamp would
   * run into the postcard (or the card edge). Returns the local y of the bottom of the last row.
   */
  private createStamps(card: Phaser.GameObjects.Container, view: DeliveryResultPresentation, top: number): number {
    const landing = this.createStamp(view.landingStamp);
    const condition = this.createStamp({ label: `package · ${view.conditionStamp.label}`, tone: view.conditionStamp.tone });

    const innerRight = LAYOUT.cardWidth / 2 - LAYOUT.pad;
    const postcardLeft = LAYOUT.postcardX - (POSTCARD_SIZE.width * ART_SCALE) / 2 - LAYOUT.postcardClearance;
    const postcardTop = LAYOUT.postcardY - (POSTCARD_SIZE.height * ART_SCALE) / 2 - LAYOUT.postcardClearance;
    const rowLimit = (rowTop: number): number =>
      rowTop + LAYOUT.stampHeight > postcardTop ? postcardLeft : innerRight;

    let rowTop = top;
    let cursor = LAYOUT.rightColumnX;
    const placed: [Phaser.GameObjects.Container, number][] = [
      [landing, STAMP_REST_ANGLE.landing],
      [condition, STAMP_REST_ANGLE.condition],
    ];
    placed.forEach(([stamp, angle], index) => {
      const width = stamp.getData("stampWidth") as number;
      if (index > 0 && cursor + width > rowLimit(rowTop)) {
        rowTop += LAYOUT.stampHeight + LAYOUT.stampGapY;
        cursor = LAYOUT.rightColumnX;
      }
      stamp.setPosition(cursor + width / 2, rowTop + LAYOUT.stampHeight / 2).setAngle(angle);
      cursor += width + LAYOUT.stampGapX;
    });

    card.add([landing, condition]);
    const thump = (stamp: Phaser.GameObjects.Container) => (instant: boolean) => {
      if (instant || this.reducedMotion) return;
      // A small puff from under the stamp's lower edge, so it never smudges the label.
      const puffY = LAYOUT.cardY + stamp.y + LAYOUT.stampHeight / 2 + STAMP_PUFF.offsetY;
      burstDust(this, LAYOUT.cardX + stamp.x, puffY, { count: STAMP_PUFF.count, spread: STAMP_PUFF.spread, depth: depth.hudFx });
    };
    this.stage(resultRevealTiming.landingStamp, motion.base, "Back.easeOut", [
      this.part(landing, { alpha: 0, scale: 1.35, angle: -4 }),
    ], thump(landing));
    this.stage(resultRevealTiming.conditionStamp, motion.base, "Back.easeOut", [
      this.part(condition, { alpha: 0, scale: 1.35, angle: 4 }),
    ], thump(condition));

    return rowTop + LAYOUT.stampHeight;
  }

  private createStamp(stamp: ResultStamp): Phaser.GameObjects.Container {
    const palette = resultStampPalette[stamp.tone];
    const height = LAYOUT.stampHeight;
    const label = this.add
      .text(0, 0, stamp.label, {
        color: palette.foreground,
        fontFamily: fontStacks.mono,
        fontSize: `${typeScale.md}px`,
        fontStyle: "700",
      })
      .setOrigin(0, 0.5);
    const width = Math.ceil(label.width) + 52;
    label.setX(-width / 2 + 34);

    const pill = this.add.graphics();
    pill.fillStyle(colorNumber(palette.dot), 0.35);
    pill.fillRoundedRect(-width / 2 + 2, -height / 2 + 3, width, height, height / 2);
    pill.fillStyle(colorNumber(palette.background), 1);
    pill.fillRoundedRect(-width / 2, -height / 2, width, height, height / 2);
    pill.lineStyle(2, colorNumber(palette.foreground), 0.55);
    pill.strokeRoundedRect(-width / 2, -height / 2, width, height, height / 2);
    pill.fillStyle(colorNumber(palette.dot), 1);
    pill.fillCircle(-width / 2 + 19, 0, 5);
    pill.lineStyle(1, colorNumber(palette.foreground), 0.6);
    pill.strokeCircle(-width / 2 + 19, 0, 5);

    const container = this.add.container(0, 0, [pill, label]);
    container.setData("stampWidth", width);
    return container;
  }

  private createStats(card: Phaser.GameObjects.Container, view: DeliveryResultPresentation, stampsBottom: number): void {
    const x = LAYOUT.rightColumnX;
    const dividerY = stampsBottom + LAYOUT.statsDividerGap;
    const firstY = dividerY + LAYOUT.statsFirstGap;
    // Tighten the rows (never below statsMinGap) if wrapped stamps pushed the list toward the footer.
    const lastAllowedY = LAYOUT.footerY - LAYOUT.statsFirstGap;
    const roomPerGap = view.stats.length > 1 ? (lastAllowedY - firstY) / (view.stats.length - 1) : LAYOUT.statsGap;
    const gap = Math.max(LAYOUT.statsMinGap, Math.min(LAYOUT.statsGap, roomPerGap));

    const divider = this.add.graphics();
    const dividerEnd = LAYOUT.postcardX - (POSTCARD_SIZE.width * ART_SCALE) / 2 - LAYOUT.postcardClearance;
    this.drawDashedLine(divider, x, dividerY, dividerEnd, dividerY, colors.borderStrong);

    const iconFallback = this.isFallback(ASSET.uiIcons);
    const parts: StagedPart[] = [this.part(divider, { alpha: 0 })];
    view.stats.forEach((stat, index) => {
      const y = firstY + index * gap;
      const icon: Phaser.GameObjects.GameObject & Stageable = iconFallback
        ? this.add.circle(x + 10, y, 5, colorNumber(colors.amber))
        : this.add.image(x + 12, y, ASSET.uiIcons, UI_ICON_FRAME[stat.icon]).setScale(ART_SCALE / 2 + 0.5);
      const text = this.add
        .text(x + 34, y, stat.text, {
          color: colors.inkSoft,
          fontFamily: fontStacks.mono,
          fontSize: `${typeScale.md + 1}px`,
        })
        .setOrigin(0, 0.5);
      card.add([icon, text]);
      parts.push(this.part(icon, { alpha: 0, dx: -6 }), this.part(text, { alpha: 0, dx: -6 }));
    });
    card.add(divider);

    this.stage(resultRevealTiming.stats, motion.slow, "Cubic.easeOut", parts);
  }

  private createPostcard(card: Phaser.GameObjects.Container, view: DeliveryResultPresentation): void {
    const x = LAYOUT.postcardX;
    const y = LAYOUT.postcardY;
    const w = POSTCARD_SIZE.width * ART_SCALE;
    const h = POSTCARD_SIZE.height * ART_SCALE;

    const holder = this.add.container(x, y);
    const shadow = this.add.rectangle(4, 6, w, h, colorNumber(colors.ink), 0.25);
    const postcard = this.add.image(0, 0, ASSET.memoryPostcard).setScale(ART_SCALE);
    const tapeLeft = this.add.rectangle(-w / 2 + 18, -h / 2 + 2, 34, 12, colorNumber(colors.amber), 0.55).setAngle(-28);
    const tapeRight = this.add.rectangle(w / 2 - 18, -h / 2 + 2, 34, 12, colorNumber(colors.amber), 0.55).setAngle(28);
    holder.add([shadow, postcard, tapeLeft, tapeRight]);
    holder.setAngle(-2);

    const label = this.add
      .text(x, y + h / 2 + 16, `✦ ${view.postcardLabel} ✦`, {
        color: colors.terracottaDeep,
        fontFamily: fontStacks.mono,
        fontSize: `${typeScale.md}px`,
        fontStyle: "700",
      })
      .setOrigin(0.5);
    const title = this.add
      .text(x, label.y + 18, view.postcardTitle, {
        color: colors.inkSoft,
        fontFamily: fontStacks.ui,
        fontSize: `${typeScale.base}px`,
      })
      .setOrigin(0.5);

    card.add([holder, label, title]);
    this.stage(resultRevealTiming.postcard, motion.slow, "Back.easeOut", [
      this.part(holder, { alpha: 0, scaleX: 0, angle: -10 }),
      this.part(label, { alpha: 0, dy: 6 }),
      this.part(title, { alpha: 0, dy: 6 }),
    ], () => {
      burstSparkles(this, LAYOUT.cardX + x, LAYOUT.cardY + y, { count: 18, spread: 120, depth: depth.hudFx });
      this.cheerRabbit();
    });
  }

  private createFooter(card: Phaser.GameObjects.Container, view: DeliveryResultPresentation): void {
    const inner = LAYOUT.cardWidth / 2 - LAYOUT.pad;
    const divider = this.add.graphics();
    this.drawDashedLine(divider, -inner, LAYOUT.footerY, inner, LAYOUT.footerY, colors.borderStrong);

    const note = this.add
      .text(-inner + 4, LAYOUT.buttonY, view.deliveryNote, {
        color: view.isNewWarmest ? colors.terracottaDeep : colors.inkSoft,
        fontFamily: fontStacks.ui,
        fontSize: `${typeScale.md + 1}px`,
        fontStyle: view.isNewWarmest ? "600" : "400",
      })
      .setOrigin(0, 0.5);

    const flyWidth = 236;
    const titleWidth = 236;
    const fly = this.createButton(inner - flyWidth / 2, LAYOUT.buttonY, flyWidth, "primary", resultCopy.buttons.flyAgain, () =>
      this.flyAgain(),
    );
    const back = this.createButton(
      inner - flyWidth - 16 - titleWidth / 2,
      LAYOUT.buttonY,
      titleWidth,
      "secondary",
      resultCopy.buttons.backToTitle,
      () => this.backToTitle(),
    );
    this.buttons = [fly, back];

    card.add([divider, note, back.container, fly.container]);
    this.stage(resultRevealTiming.footer, motion.base, "Cubic.easeOut", [
      this.part(divider, { alpha: 0 }),
      this.part(note, { alpha: 0 }),
      this.part(back.container, { alpha: 0, dy: 12 }),
      this.part(fly.container, { alpha: 0, dy: 12 }),
    ]);
  }

  private createButton(
    x: number,
    y: number,
    width: number,
    variant: "primary" | "secondary",
    copy: { readonly label: string; readonly key: string },
    onActivate: () => void,
  ): ResultButton {
    const height = LAYOUT.buttonHeight;
    const primary = variant === "primary";
    const fill = colorNumber(primary ? colors.terracotta : colors.parchment);
    const textColor = primary ? colors.plaster : colors.ink;

    const shadow = this.add.graphics();
    shadow.fillStyle(colorNumber(primary ? colors.terracottaDeep : colors.borderStrong), 1);
    shadow.fillRect(-width / 2, -height / 2 + 4, width, height);
    shadow.lineStyle(2, colorNumber(colors.ink), 1);
    shadow.strokeRect(-width / 2, -height / 2 + 4, width, height);

    const face = this.add.graphics();
    face.fillStyle(fill, 1);
    face.fillRect(-width / 2, -height / 2, width, height);
    face.lineStyle(2, colorNumber(colors.ink), 1);
    face.strokeRect(-width / 2, -height / 2, width, height);
    face.fillStyle(colorNumber(colors.plaster), primary ? 0.18 : 0.6);
    face.fillRect(-width / 2 + 2, -height / 2 + 2, width - 4, 4);

    const label = this.add
      .text(-width / 2 + 18, 0, copy.label, {
        color: textColor,
        fontFamily: fontStacks.ui,
        fontSize: `${typeScale.lg}px`,
        fontStyle: "600",
      })
      .setOrigin(0, 0.5);

    const keyLabel = this.add
      .text(0, 0, copy.key, {
        color: colors.ink,
        fontFamily: fontStacks.mono,
        fontSize: `${typeScale.base}px`,
        fontStyle: "700",
      })
      .setOrigin(0.5);
    const capWidth = Math.ceil(keyLabel.width) + 16;
    const capX = width / 2 - 14 - capWidth / 2;
    keyLabel.setPosition(capX, -1);
    const cap = this.add.graphics();
    cap.fillStyle(colorNumber(colors.borderStrong), 1);
    cap.fillRoundedRect(capX - capWidth / 2, -13, capWidth, 28, 4);
    cap.fillStyle(colorNumber(colors.plaster), 1);
    cap.fillRoundedRect(capX - capWidth / 2, -14, capWidth, 25, 4);
    cap.lineStyle(1, colorNumber(colors.ink), 0.7);
    cap.strokeRoundedRect(capX - capWidth / 2, -14, capWidth, 28, 4);

    const body = this.add.container(0, 0, [face, label, cap, keyLabel]);
    const container = this.add.container(x, y, [shadow, body]);
    const button: ResultButton = { container, body, hovered: false };

    const zone = this.add.zone(0, 0, width, height + 4).setInteractive({ useHandCursor: true });
    container.add(zone);
    zone.on(Phaser.Input.Events.POINTER_OVER, () => {
      if (!this.revealComplete || this.leaving) return;
      button.hovered = true;
      body.y = -2;
      emitGameEvent(this, { type: "ui:hover" });
    });
    zone.on(Phaser.Input.Events.POINTER_OUT, () => {
      button.hovered = false;
      body.y = 0;
    });
    zone.on(Phaser.Input.Events.POINTER_DOWN, () => {
      if (!this.revealComplete || this.leaving) return;
      body.y = 3;
    });
    zone.on(Phaser.Input.Events.POINTER_UP, () => {
      if (!this.revealComplete || this.leaving) return;
      onActivate();
    });

    return button;
  }

  private createSkipHint(): void {
    const { width, height } = this.scale;
    this.skipHint = this.add
      .text(width / 2, height - 18, resultCopy.skipHint, {
        color: colors.plaster,
        fontFamily: fontStacks.mono,
        fontSize: `${typeScale.base}px`,
      })
      .setOrigin(0.5)
      .setAlpha(0.6)
      .setDepth(depth.hud);
  }

  // ---------------------------------------------------------------- reveal

  /** Captures the object's resting state, moves it to its "from" state, and returns the part. */
  private part(target: Stageable, from: StageFrom): StagedPart {
    const rest: Required<StageProps> = {
      alpha: target.alpha,
      x: target.x,
      y: target.y,
      scaleX: target.scaleX,
      scaleY: target.scaleY,
      angle: target.angle,
    };
    if (this.reducedMotion) {
      target.alpha = from.alpha ?? target.alpha;
      return { target, rest };
    }
    target.alpha = from.alpha ?? target.alpha;
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
    this.stepTimers.push(this.time.delayedCall(resultRevealTiming.complete, () => this.finishReveal()));
  }

  private playStep(step: RevealStep): void {
    if (step.played) return;
    step.played = true;
    const duration = this.reducedMotion ? motion.base : step.duration;
    const ease = this.reducedMotion ? "Linear" : step.ease;
    for (const { target, rest } of step.parts) {
      this.tweens.add({ targets: target, ...rest, duration, ease });
    }
    step.onPlay?.(false);
  }

  /** Jumps every staged element to its resting state. Safe to call more than once. */
  private finishReveal(): void {
    if (this.revealComplete) return;
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

    this.revealComplete = true;
    if (this.skipHint) {
      this.tweens.add({ targets: this.skipHint, alpha: 0, duration: motion.fast });
    }
    emitGameEvent(this, { type: "result:shown", landingResult: this.resultData.landingResult });
  }

  // ---------------------------------------------------------------- rabbit

  private blinkOnce(): void {
    const rabbit = this.rabbit;
    if (!rabbit || this.rabbitHappy || this.reducedMotion) {
      this.scheduleBlink();
      return;
    }
    rabbit.setFrame(RABBIT_PORTRAIT_FRAME.blink);
    this.time.delayedCall(resultRevealTiming.blinkHoldMs, () => {
      if (!this.rabbitHappy) rabbit.setFrame(RABBIT_PORTRAIT_FRAME.idle);
    });
    this.scheduleBlink();
  }

  private scheduleBlink(): void {
    this.blinkTimer?.remove();
    const delay = Phaser.Math.Between(resultRevealTiming.blinkMinMs, resultRevealTiming.blinkMaxMs);
    this.blinkTimer = this.time.delayedCall(delay, () => this.blinkOnce());
  }

  private cheerRabbit(): void {
    const rabbit = this.rabbit;
    if (!rabbit) return;
    this.rabbitHappy = true;
    rabbit.setFrame(RABBIT_PORTRAIT_FRAME.happy);
    if (!this.reducedMotion) {
      const restY = LAYOUT.portraitY + 4;
      this.tweens.add({
        targets: rabbit,
        y: restY - 8,
        duration: motion.base,
        ease: "Quad.easeOut",
        yoyo: true,
        repeat: 1,
        onComplete: () => rabbit.setY(restY),
      });
    }
    this.time.delayedCall(resultRevealTiming.happyHoldMs, () => {
      this.rabbitHappy = false;
      rabbit.setFrame(RABBIT_PORTRAIT_FRAME.idle);
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
        if (event.code === "Enter" || event.code === "NumpadEnter") this.flyAgain();
        else if (event.code === "Escape") this.backToTitle();
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

  private flyAgain(): void {
    this.leave(0, "ui:confirm", () => this.scene.start("FlightScene", { missionId: this.resultData.missionId || TEA_MOON_MISSION_ID }));
  }

  private backToTitle(): void {
    this.leave(1, "ui:back", () => this.scene.start("TitleScene"));
  }

  private leave(buttonIndex: number, eventType: "ui:confirm" | "ui:back", go: () => void): void {
    if (this.leaving) return;
    this.leaving = true;
    emitGameEvent(this, { type: eventType });

    const button = this.buttons[buttonIndex];
    if (button) button.body.y = 3;

    const camera = this.cameras.main;
    const cosmos = Phaser.Display.Color.HexStringToColor(colors.cosmos);
    camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, go);
    camera.fadeOut(motion.slow, cosmos.red, cosmos.green, cosmos.blue);
  }

  // ---------------------------------------------------------------- helpers

  /** PreloadScene replaces missing art with a generated CanvasTexture of the same size. */
  private isFallback(key: string): boolean {
    return this.textures.get(key) instanceof Phaser.Textures.CanvasTexture;
  }

  private drawDashedLine(
    graphics: Phaser.GameObjects.Graphics,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: string,
  ): void {
    const dash = 8;
    const gap = 6;
    graphics.lineStyle(2, colorNumber(color), 0.8);
    const length = Math.hypot(x2 - x1, y2 - y1);
    const ux = (x2 - x1) / length;
    const uy = (y2 - y1) / length;
    for (let d = 0; d < length; d += dash + gap) {
      const end = Math.min(d + dash, length);
      graphics.lineBetween(x1 + ux * d, y1 + uy * d, x1 + ux * end, y1 + uy * end);
    }
  }
}
