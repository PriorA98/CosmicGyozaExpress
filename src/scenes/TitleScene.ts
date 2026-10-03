import Phaser from "phaser";
import { ASSET, CAMPAIGN_PORTRAIT_FRAME, RABBIT_PORTRAIT_FRAME, SHIP_ART } from "../data/assetManifest";
import { TEA_MOON_MISSION_ID } from "../data/missions";
import { routeLogCopy, settingsCopy, titleCopy } from "../data/uiCopy";
import { createDevSceneLauncherPanel, installDevSceneHotkeys } from "../dev/DevSceneLauncher";
import { registerDevState } from "../dev/devProbe";
import { isReducedMotion } from "../fx/feedback";
import { playEnterTransition, transitionToScene } from "../fx/transitions";
import { compactUiScale, isCompactDisplay } from "../game/displayScale";
import { colorNumber, colors, depth, motion, typeScale } from "../game/designTokens";
import { emitGameEvent } from "../game/events";
import { nextSuggestedMission, normalizeCampaignProgress, type CampaignProgress } from "../systems/CampaignSystem";
import { SaveSystem } from "../systems/SaveSystem";
import type { MissionSelectSceneData } from "../types/campaign";
import type { FlightSceneData } from "../types/flight";
import { Button } from "../ui/Button";
import { campaignRouteLog, titleDeliveryAction, titleMissionPresentation } from "../ui/campaignMenu";
import { addUiIcon } from "../ui/icons";
import { Keycap } from "../ui/Keycap";
import { dotsAlongQuadratic, quadraticPoint, uiScaled, uiSecondaryTextSize, uiTextSize, type Point } from "../ui/layout";
import { ParchmentCard } from "../ui/ParchmentCard";
import { RouteLogPanel, type RouteLogStat } from "../ui/RouteLogPanel";
import { SettingsPanel } from "../ui/SettingsPanel";
import { installSoundToast } from "../ui/SoundToast";
import { CollectedStamp, SaveNoticeChip } from "../ui/NoticeChips";
import { StatePill } from "../ui/StatePill";
import { drawRecessedSurface, UI_ART_SCALE } from "../ui/surfaces";
import { bodyStyle, bodyStrongStyle, displayTitleStyle, headingStyle, monoStyle } from "../ui/textStyles";
import { detectTouchDevice } from "../ui/TouchControls";
import { hasAuthoredTexture } from "../ui/uiTextures";

/**
 * Title composition on the 1280x720 logical canvas (screen px at uiScale 1). Two layouts: the
 * desktop one, and a compact one for phone-class displays (`isCompactDisplay`) where every text,
 * button and keycap is multiplied by `compactUiScale` and non-essential rows are dropped.
 */
type TitleLayout = {
  readonly marginX: number;
  readonly logoTopY: number;
  readonly logoSize: number;
  readonly logoLineGap: number;
  readonly subtitleY: number;
  readonly ctaY: number;
  readonly ctaWidth: number;
  readonly ctaHeight: number;
  readonly secondaryGap: number;
  readonly secondaryHeight: number;
  readonly rowGap: number;
  readonly moon: Point;
  /** Far ringed planet the dotted route starts from (null: dropped on compact). */
  readonly farPlanet: Point | null;
  /** Dotted route: quadratic Bezier from the far planet (or off-canvas) to the tea moon. */
  readonly route: { readonly from: Point; readonly control: Point; readonly to: Point; readonly shipT: number };
  readonly card: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  /** Desktop shows the route title in the card header; compact shows the state pill there instead. */
  readonly cardMeta: boolean;
  readonly creditsY: number;
};

const DESKTOP_LAYOUT: TitleLayout = {
  marginX: 96,
  logoTopY: 76,
  logoSize: 96,
  logoLineGap: 92,
  subtitleY: 284,
  ctaY: 332,
  ctaWidth: 392,
  ctaHeight: 60,
  secondaryGap: 14,
  secondaryHeight: 44,
  rowGap: 22,
  moon: { x: 1052, y: 206 },
  farPlanet: { x: 482, y: 628 },
  route: { from: { x: 544, y: 574 }, control: { x: 604, y: 334 }, to: { x: 912, y: 318 }, shipT: 0.43 },
  card: { x: 760, y: 424, width: 456, height: 268 },
  cardMeta: true,
  creditsY: 688,
};

const COMPACT_LAYOUT: TitleLayout = {
  marginX: 64,
  logoTopY: 36,
  logoSize: 88,
  logoLineGap: 84,
  subtitleY: 228,
  ctaY: 280,
  ctaWidth: 520,
  ctaHeight: 60,
  secondaryGap: 16,
  secondaryHeight: 44,
  rowGap: 22,
  moon: { x: 1132, y: 178 },
  farPlanet: null,
  route: { from: { x: 612, y: 384 }, control: { x: 790, y: 236 }, to: { x: 986, y: 262 }, shipT: 0.55 },
  card: { x: 636, y: 392, width: 606, height: 312 },
  cardMeta: false,
  creditsY: 686,
};

/**
 * Hero ship: the 64x80 SHIP_ART at an integer 3x (about 150 px of visible saucer, the design-system
 * 140-180 px title band). No rotation, gentle bob only.
 */
const SHIP = {
  scale: 3,
  bobPx: 8,
  /** Visible art rows below the saucer centre where the baked flame ends (art px). */
  flameTipArtY: 61,
  /** Visible art box around the saucer centre, for keeping route dots off the ship (screen px). */
  clearHalfWidth: 88,
  clearAbove: 78,
  clearBelow: 104,
} as const;

/** Route dots: travelled part faint plaster, the part still ahead warm amber. */
const ROUTE = { spacing: 18, dot: 4, behindAlpha: 0.5, aheadAlpha: 0.85, endInset: 2 } as const;

/**
 * Warm additive glow (ADD blend: it only ever brightens, so nebula clouds stay visible beneath).
 * A thin cream rim just outside the moon disc (moon art radius is ~152 screen px). The hero ship
 * has no halo: low-alpha warm light over navy averages to grey, so its own flame carries the light.
 */
type WarmGlow = { readonly rings: number; readonly innerRadius: number; readonly step: number; readonly alpha: number; readonly band: number };
const MOON_GLOW: WarmGlow = { rings: 3, innerRadius: 160, step: 12, alpha: 0.035, band: 4 };

/** Warm steam puffs that leave the burner while the ship sinks through the low half of its bob. */
const PUFFS = { pool: 6, intervalMs: 340, lifeMs: 1100, travelPx: 54, bigPx: 6, smallPx: 3, sinkThreshold: 0.2, startAlpha: 0.8 } as const;

/** Left text-column vignette: solid core then `bands` stepped fades. */
const VIGNETTE = { coreWidth: 400, alpha: 0.3, bands: 8, bandWidth: 24 } as const;

/** Slow parallax drift for backdrop layers (texture px per second). */
const DRIFT = { far: 3, nebula: 1.2, near: 7 } as const;

const PORTRAIT_FRAME = 136;
/** Item tray: 64 px art (32 art px at 2x) inset `ITEM_INSET` inside a slightly taller recessed chip. */
const ITEM_TRAY_HEIGHT = 72;
const ITEM_ART = 64;
const ITEM_INSET = 8;
/** Breathing room between the two item sprites (their art runs to the cell edges). */
const ITEM_ART_GAP = 6;
const ITEM_LABEL_GAP = 8;

const RESIZE_DEBOUNCE_MS = 160;
/** Widest the save notice chip may grow (logical px); one line on both layouts. */
const SAVE_NOTICE_MAX_WIDTH = 640;

type Layer = Phaser.GameObjects.TileSprite;
type SaveNoticeKind = keyof typeof titleCopy.saveNotice;
type Puff = { readonly rect: Phaser.GameObjects.Rectangle; busy: boolean };

/** Optional TitleScene init data (dev showcases and returning flows); all fields optional. */
export type TitleSceneData = {
  /** Open a secondary panel right after the title settles (the route log needs a delivery). */
  readonly openPanel?: "settings" | "route-log";
};

const OPEN_PANEL_DELAY_MS = 120;

export class TitleScene extends Phaser.Scene {
  private starsFar: Layer | undefined;
  private nebula: Layer | undefined;
  private starsNear: Layer | undefined;
  private ship: Phaser.GameObjects.Sprite | undefined;
  private shipBase: Point = { x: 0, y: 0 };
  private routeDirection: Point = { x: -1, y: 1 };
  private puffs: Puff[] = [];
  private puffClockMs = 0;
  private focusables: Button[] = [];
  private focusIndex = 0;
  private keyboardNav = false;
  private settingsPanel: SettingsPanel | undefined;
  private routeLog: RouteLogPanel | undefined;
  private layout: TitleLayout = DESKTOP_LAYOUT;
  private uiScale = 1;
  private compact = false;
  private touch = false;
  private teaMoonDelivered = false;
  /** Campaign progress (normalized); any completion turns the primary action into the board. */
  private progress: CampaignProgress = normalizeCampaignProgress([], []);
  private saveNotice: SaveNoticeKind | null = null;
  private starting = false;
  private elapsedMs = 0;
  private layoutKey = "";
  private pendingPanel: TitleSceneData["openPanel"] | undefined;

  constructor() {
    super("TitleScene");
  }

  init(data?: Partial<TitleSceneData>): void {
    const panel = data?.openPanel;
    this.pendingPanel = panel === "settings" || panel === "route-log" ? panel : undefined;
  }

  create(): void {
    this.starting = false;
    this.elapsedMs = 0;
    this.puffClockMs = 0;
    this.puffs = [];
    this.focusables = [];
    this.focusIndex = 0;
    this.keyboardNav = false;
    this.settingsPanel = undefined;
    this.routeLog = undefined;
    this.compact = isCompactDisplay(this);
    this.uiScale = this.compact ? compactUiScale(this) : 1;
    this.layout = this.compact ? COMPACT_LAYOUT : DESKTOP_LAYOUT;
    this.layoutKey = layoutKeyFor(this.compact, this.uiScale);
    this.touch = detectTouchDevice();
    this.progress = readProgress();
    this.teaMoonDelivered = this.progress.completedMissions.includes(TEA_MOON_MISSION_ID);
    this.saveNotice = readSaveNotice();

    installSoundToast(this.game);
    this.createBackdrop();
    this.createCelestials();
    this.createRoute();
    this.createShip();
    this.createLogo();
    this.createActions();
    this.createMissionCard();
    this.createFooter();
    this.wireKeyboard();
    this.wireResize();

    installDevSceneHotkeys(this);
    createDevSceneLauncherPanel(this, { x: 18 });

    registerDevState("title", () => ({
      teaMoonDelivered: this.teaMoonDelivered,
      completedMissions: this.progress.completedMissions,
      primaryAction: this.anyDelivered ? "board" : "launch-tea",
      suggestedMissionId: nextSuggestedMission(this.progress).id,
      layout: this.compact ? "compact" : "desktop",
      uiScale: Number(this.uiScale.toFixed(2)),
      touch: this.touch,
      focus: this.focusables[this.focusIndex]?.name ?? null,
      keyboardNav: this.keyboardNav,
      buttonFocused: this.focusables[0]?.isFocused ?? false,
      ctaLabel: this.primaryLabel,
      settingsOpen: this.settingsPanel?.isOpen ?? false,
      settingsRow: this.settingsPanel?.selectedRow ?? null,
      routeLogOpen: this.routeLog?.isOpen ?? false,
      saveNotice: this.saveNotice,
      shipScale: this.ship?.scaleX ?? 0,
      shipRotation: this.ship?.rotation ?? 0,
    }));

    void playEnterTransition(this, { kind: "warm-fade", durationMs: motion.slow });
    emitGameEvent(this, { type: "scene:enter", scene: "TitleScene" });
    this.openPendingPanel();
  }

  private openPendingPanel(): void {
    const panel = this.pendingPanel;
    this.pendingPanel = undefined;
    if (!panel) return;
    this.time.delayedCall(OPEN_PANEL_DELAY_MS, () => {
      if (panel === "settings") this.openSettings();
      else if (this.anyDelivered) this.openRouteLog();
    });
  }

  update(_time: number, delta: number): void {
    const clamped = Math.min(delta, 100);
    const seconds = clamped / 1000;
    this.elapsedMs += clamped;
    if (this.starsFar) this.starsFar.tilePositionX += DRIFT.far * seconds;
    if (this.nebula) this.nebula.tilePositionX += DRIFT.nebula * seconds;
    if (this.starsNear) this.starsNear.tilePositionX += DRIFT.near * seconds;

    const ship = this.ship;
    if (!ship) return;
    const reduced = isReducedMotion();
    const phase = (this.elapsedMs / motion.breath) * Math.PI * 2;
    const bob = Math.sin(phase) * SHIP.bobPx * (reduced ? 0.25 : 1);
    ship.y = Math.round(this.shipBase.y + bob);

    // Warm puffs only while sinking through the low half of the bob: a little hop to hold altitude.
    this.puffClockMs += clamped;
    if (!reduced && Math.sin(phase) > PUFFS.sinkThreshold && this.puffClockMs >= PUFFS.intervalMs) {
      this.puffClockMs = 0;
      this.spawnPuff(ship.x, ship.y + (SHIP.flameTipArtY - SHIP_ART.saucerCenterY) * SHIP.scale);
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Backdrop and celestial bodies
  // ---------------------------------------------------------------------------------------------

  private createBackdrop(): void {
    const { width, height } = this.scale;
    this.add.rectangle(0, 0, width, height, colorNumber(colors.cosmos)).setOrigin(0, 0).setDepth(depth.backdrop);

    this.starsFar = this.addLayer(ASSET.spaceStarsFar, "title-stars-far", 0.9);
    this.nebula = hasAuthoredTexture(this, ASSET.spaceNebula) ? this.addTiled(ASSET.spaceNebula, 0.85) : undefined;
    if (!this.nebula) this.drawNebulaWash();
    this.starsNear = this.addLayer(ASSET.spaceStarsNear, "title-stars-near", 1);

    // Soft vignette so the text column reads clearly over the nebula: a solid core, then stepped
    // bands fading out (no single hard seam).
    const core = this.layout.marginX + VIGNETTE.coreWidth;
    const glow = this.add.graphics().setDepth(depth.parallax);
    glow.fillStyle(colorNumber(colors.cosmosDeep), VIGNETTE.alpha);
    glow.fillRect(0, 0, core, height);
    for (let band = 0; band < VIGNETTE.bands; band += 1) {
      glow.fillStyle(colorNumber(colors.cosmosDeep), VIGNETTE.alpha * (1 - (band + 1) / (VIGNETTE.bands + 1)));
      glow.fillRect(core + band * VIGNETTE.bandWidth, 0, VIGNETTE.bandWidth, height);
    }
  }

  private addLayer(key: string, fallbackKey: string, alpha: number): Layer {
    if (hasAuthoredTexture(this, key)) return this.addTiled(key, alpha);
    return this.addTiled(ensureStarfieldTexture(this, fallbackKey, fallbackKey.endsWith("near") ? 14 : 40), alpha);
  }

  private addTiled(key: string, alpha: number): Layer {
    const { width, height } = this.scale;
    return this.add
      .tileSprite(0, 0, width, height, key)
      .setOrigin(0, 0)
      .setTileScale(UI_ART_SCALE)
      .setAlpha(alpha)
      .setDepth(depth.backdrop);
  }

  /** Drawn stand-in for the nebula art: a few stepped plum/teal pools. */
  private drawNebulaWash(): void {
    const g = this.add.graphics().setDepth(depth.backdrop);
    const pools: readonly { x: number; y: number; r: number; color: string }[] = [
      { x: 980, y: 180, r: 360, color: colors.plum },
      { x: 360, y: 620, r: 320, color: colors.teal },
      { x: 760, y: 420, r: 220, color: colors.terracotta },
    ];
    for (const pool of pools) {
      for (let step = 0; step < 4; step += 1) {
        g.fillStyle(colorNumber(pool.color), 0.035);
        fillPixelDisc(g, pool.x, pool.y, pool.r * (1 - step * 0.2), 8);
      }
    }
  }

  private createCelestials(): void {
    const { moon, farPlanet } = this.layout;
    if (farPlanet) {
      this.add.image(farPlanet.x, farPlanet.y, ASSET.planetFarPlum).setScale(UI_ART_SCALE).setDepth(depth.parallax).setAlpha(0.92);
    }

    // Moonlight: a thin additive cream rim (never darkens the nebula behind it).
    const halo = this.addWarmGlow(moon.x, moon.y, MOON_GLOW, [colors.parchmentDeep, colors.amber, colors.amber], depth.parallax);
    if (!isReducedMotion()) {
      this.tweens.add({ targets: halo, alpha: { from: 0.7, to: 1 }, duration: motion.breath * 1.5, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
    this.add.image(moon.x, moon.y, ASSET.celestialTeaMoon).setScale(UI_ART_SCALE).setDepth(depth.world);

    this.addTwinkles();
  }

  /**
   * Stacked stepped discs on an additive blend: each ring only adds a little warm light, so the
   * glow brightens what is beneath instead of greying it. `tints[i]` colours ring i (inner first).
   */
  private addWarmGlow(x: number, y: number, glow: WarmGlow, tints: readonly string[], layer: number): Phaser.GameObjects.Graphics {
    const g = this.add.graphics().setDepth(layer).setBlendMode(Phaser.BlendModes.ADD);
    for (let ring = 0; ring < glow.rings; ring += 1) {
      g.fillStyle(colorNumber(tints[ring] ?? colors.amber), glow.alpha);
      fillPixelDisc(g, x, y, glow.innerRadius + ring * glow.step, glow.band);
    }
    return g;
  }

  /** Little plus-shaped pixel sparkles that twinkle out of phase. */
  private addTwinkles(): void {
    const spots: readonly { x: number; y: number; size: number; color: string }[] = this.compact
      ? [
          { x: 760, y: 70, size: 2, color: colors.amber },
          { x: 700, y: 330, size: 1, color: colors.plaster },
          { x: 1240, y: 370, size: 2, color: colors.amber },
          { x: 590, y: 200, size: 1, color: colors.ember },
        ]
      : [
          { x: 812, y: 96, size: 2, color: colors.amber },
          { x: 742, y: 262, size: 2, color: colors.plaster },
          { x: 1214, y: 392, size: 2, color: colors.amber },
          { x: 560, y: 60, size: 2, color: colors.plaster },
          { x: 860, y: 362, size: 1, color: colors.plaster },
          { x: 1180, y: 46, size: 1, color: colors.ember },
          { x: 356, y: 560, size: 1, color: colors.amber },
        ];
    spots.forEach((spot, index) => {
      const g = this.add.graphics().setDepth(depth.parallax).setPosition(spot.x, spot.y);
      const unit = 2 * spot.size;
      g.fillStyle(colorNumber(spot.color), 1);
      g.fillRect(-unit / 2, -unit * 2.5, unit, unit * 5);
      g.fillRect(-unit * 2.5, -unit / 2, unit * 5, unit);
      g.fillStyle(colorNumber(colors.plaster), 1);
      g.fillRect(-unit / 2, -unit / 2, unit, unit);
      if (isReducedMotion()) return;
      this.tweens.add({
        targets: g,
        alpha: { from: 1, to: 0.15 },
        duration: motion.breath * (0.6 + (index % 3) * 0.25),
        delay: index * 320,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    });
  }

  // ---------------------------------------------------------------------------------------------
  // Hero ship on its route
  // ---------------------------------------------------------------------------------------------

  private createRoute(): void {
    const { from, control, to, shipT } = this.layout.route;
    const ship = quadraticPoint(from, control, to, shipT);
    this.shipBase = { x: Math.round(ship.x), y: Math.round(ship.y) };
    const behind = quadraticPoint(from, control, to, Math.max(0, shipT - 0.08));
    const length = Math.hypot(ship.x - behind.x, ship.y - behind.y) || 1;
    this.routeDirection = { x: (behind.x - ship.x) / length, y: (behind.y - ship.y) / length };

    const g = this.add.graphics().setDepth(depth.parallax + 1);
    const dots = dotsAlongQuadratic(from, control, to, ROUTE.spacing);
    const half = ROUTE.dot / 2;
    dots.forEach((dot, index) => {
      if (index < ROUTE.endInset || index > dots.length - 1 - ROUTE.endInset) return;
      const dx = dot.x - this.shipBase.x;
      const dy = dot.y - this.shipBase.y;
      if (Math.abs(dx) < SHIP.clearHalfWidth && dy > -SHIP.clearAbove && dy < SHIP.clearBelow) return;
      const ahead = dot.t > shipT;
      g.fillStyle(colorNumber(ahead ? colors.amber : colors.plaster), ahead ? ROUTE.aheadAlpha : ROUTE.behindAlpha);
      g.fillRect(dot.x - half, dot.y - half, ROUTE.dot, ROUTE.dot);
    });
    // Destination tick: a small amber diamond where the route meets the moon.
    const end = dots[dots.length - 1 - ROUTE.endInset];
    if (end) {
      g.fillStyle(colorNumber(colors.amber), 1);
      g.fillRect(end.x - 2, end.y - 6, 4, 12);
      g.fillRect(end.x - 6, end.y - 2, 12, 4);
      g.fillStyle(colorNumber(colors.plaster), 1);
      g.fillRect(end.x - 2, end.y - 2, 4, 4);
    }
  }

  private createShip(): void {
    const cruiseKey = "title-ship-cruise";
    // Animations are global: drop a stale empty one (created before the ship frames existed).
    if ((this.anims.get(cruiseKey)?.frames.length ?? 1) === 0) this.anims.remove(cruiseKey);
    if (!this.anims.exists(cruiseKey)) {
      this.anims.create({
        key: cruiseKey,
        frames: [{ key: ASSET.shipFly1 }, { key: ASSET.shipFly2 }, { key: ASSET.shipFly3 }, { key: ASSET.shipFly2 }],
        frameRate: 7,
        repeat: -1,
      });
    }

    this.ship = this.add
      .sprite(this.shipBase.x, this.shipBase.y, ASSET.shipFly1)
      .setOrigin(SHIP_ART.saucerCenterX / SHIP_ART.width, SHIP_ART.saucerCenterY / SHIP_ART.height)
      .setScale(SHIP.scale)
      .setDepth(depth.ship);
    if ((this.anims.get(cruiseKey)?.frames.length ?? 0) > 0) this.ship.play(cruiseKey);

    for (let index = 0; index < PUFFS.pool; index += 1) {
      const rect = this.add.rectangle(0, 0, PUFFS.bigPx, PUFFS.bigPx, colorNumber(colors.amber)).setDepth(depth.ship - 1).setVisible(false);
      this.puffs.push({ rect, busy: false });
    }
  }

  private spawnPuff(x: number, y: number): void {
    const puff = this.puffs.find((candidate) => !candidate.busy);
    if (!puff) return;
    puff.busy = true;
    const jitter = Math.round((Math.random() - 0.5) * 6);
    const rect = puff.rect;
    rect.setPosition(Math.round(x + jitter), Math.round(y)).setSize(PUFFS.bigPx, PUFFS.bigPx).setFillStyle(colorNumber(colors.amber), 1).setAlpha(PUFFS.startAlpha).setVisible(true);
    let cooled = false;
    this.tweens.add({
      targets: rect,
      x: rect.x + Math.round(this.routeDirection.x * PUFFS.travelPx),
      y: rect.y + Math.round(this.routeDirection.y * PUFFS.travelPx),
      alpha: 0,
      duration: PUFFS.lifeMs,
      ease: "Sine.easeOut",
      onUpdate: (tween) => {
        // Steam cools from amber to cream and shrinks one pixel step halfway through.
        if (!cooled && tween.progress > 0.45) {
          cooled = true;
          rect.setSize(PUFFS.smallPx, PUFFS.smallPx).setFillStyle(colorNumber(colors.parchmentDeep), 1);
        }
      },
      onComplete: () => {
        rect.setVisible(false);
        puff.busy = false;
      },
    });
  }

  // ---------------------------------------------------------------------------------------------
  // Logo, actions, footer
  // ---------------------------------------------------------------------------------------------

  private createLogo(): void {
    const { marginX: x, logoTopY, logoSize, logoLineGap, subtitleY } = this.layout;
    const shadow = { x: 5, y: 6 };
    const top = this.add.text(x, logoTopY, titleCopy.logoTop, displayTitleStyle({ size: logoSize, color: colors.plaster }));
    top.setShadow(shadow.x, shadow.y, colors.terracottaDeep, 0, false, true).setDepth(depth.hud);
    const bottom = this.add.text(x, logoTopY + logoLineGap, titleCopy.logoBottom, displayTitleStyle({ size: logoSize, color: colors.ember }));
    bottom.setShadow(shadow.x, shadow.y, colors.ink, 0, false, true).setDepth(depth.hud);

    this.add
      .text(x + 4, subtitleY, titleCopy.subtitle, bodyStrongStyle({ size: uiTextSize(typeScale.lg, this.uiScale), color: colors.parchmentDeep }))
      .setAlpha(0.9)
      .setDepth(depth.hud);
  }

  /** True once any campaign delivery is saved: the primary action then opens the board. */
  private get anyDelivered(): boolean {
    return this.progress.completedMissions.length > 0;
  }

  private get primaryLabel(): string {
    return titleDeliveryAction(this.progress).label;
  }

  private createActions(): void {
    const s = this.uiScale;
    const { marginX: x, ctaY, ctaWidth, ctaHeight } = this.layout;
    const cta = new Button(this, {
      x,
      y: ctaY,
      label: this.primaryLabel,
      width: uiScaled(ctaWidth, this.compact ? 1 : s),
      height: uiScaled(ctaHeight, s),
      icon: this.anyDelivered ? "package" : "tea",
      uiScale: s,
      onActivate: () => (this.anyDelivered ? this.openBoard() : this.startMission()),
    });
    cta.setName("start").setDepth(depth.hud);
    this.focusables.push(cta);

    // Secondary row: settings, plus the delivery board (fresh) or the route log (after a delivery).
    // Both share the raised ink style so they read as one tier under the ember CTA.
    const rowY = ctaY + uiScaled(ctaHeight, s) + uiScaled(this.layout.rowGap, s);
    const secondaryHeight = uiScaled(this.layout.secondaryHeight, s);
    const ctaWidthPx = cta.buttonWidth;
    const gap = uiScaled(this.layout.secondaryGap, s);
    // With two secondary actions they split the CTA width exactly, so the column edges line up.
    const pairWidth = this.anyDelivered ? Math.floor((ctaWidthPx - gap) / 2) : undefined;
    const settings = new Button(this, {
      x,
      y: rowY,
      label: titleCopy.settingsButton,
      ...(pairWidth === undefined ? {} : { width: pairWidth }),
      height: secondaryHeight,
      variant: "ink",
      icon: "settings",
      uiScale: s,
      onActivate: () => this.openSettings(),
    });
    settings.setName("settings").setDepth(depth.hud);
    this.focusables.push(settings);

    if (!this.anyDelivered) {
      const board = new Button(this, {
        x: x + settings.buttonWidth + gap,
        y: rowY,
        label: titleCopy.boardButton,
        width: Math.max(0, ctaWidthPx - settings.buttonWidth - gap),
        height: secondaryHeight,
        variant: "ink",
        uiScale: s,
        onActivate: () => this.openBoard(),
      });
      board.setName("board").setDepth(depth.hud);
      this.focusables.push(board);
    } else {
      const routeLog = new Button(this, {
        x: x + ctaWidthPx - settings.buttonWidth,
        y: rowY,
        label: titleCopy.routeLogButton,
        width: settings.buttonWidth,
        height: secondaryHeight,
        variant: "ink",
        icon: "memory",
        uiScale: s,
        onActivate: () => this.openRouteLog(),
      });
      routeLog.setName("route-log").setDepth(depth.hud);
      this.focusables.push(routeLog);
    }

    // Keyboard hints (keycaps); touch devices have no keys to hint at.
    let nextY = rowY + secondaryHeight + uiScaled(this.layout.rowGap + 6, s);
    if (!this.touch) {
      let cursor = x;
      let keyHeight = 0;
      for (const hint of this.anyDelivered ? titleCopy.hintsReturning : titleCopy.hints) {
        const keycap = new Keycap(this, { x: cursor, y: nextY, label: hint.key, uiScale: s }).setDepth(depth.hud);
        keyHeight = keycap.keyHeight;
        const label = this.add
          .text(cursor + keycap.keyWidth + uiScaled(8, s), nextY + Math.round(keycap.keyHeight / 2) - 1, hint.label, bodyStyle({ size: uiTextSize(typeScale.base, s), color: colors.parchmentDeep }))
          .setOrigin(0, 0.5)
          .setAlpha(0.85)
          .setDepth(depth.hud);
        cursor = Math.ceil(label.x + label.width + uiScaled(24, s));
      }
      nextY += keyHeight + uiScaled(18, s);
    }

    if (this.saveNotice) {
      const copy = this.compact ? titleCopy.saveNoticeCompact : titleCopy.saveNotice;
      this.createSaveNotice(x, nextY, copy[this.saveNotice]);
    }
  }

  /** Gentle one-line save note (kit SaveNoticeChip: dark chip, sage dot, mono text). */
  private createSaveNotice(x: number, y: number, text: string): void {
    new SaveNoticeChip(this, { x, y, text, maxWidth: SAVE_NOTICE_MAX_WIDTH, uiScale: this.uiScale }).setName("save-notice").setDepth(depth.hud);
  }

  private createFooter(): void {
    // The credit is a desktop nicety; on phones it would render below a comfortable reading size.
    if (this.compact) return;
    this.add
      .text(this.layout.marginX, this.layout.creditsY, titleCopy.credits, monoStyle({ size: uiTextSize(typeScale.sm, this.uiScale), color: colors.parchmentDeep }))
      .setOrigin(0, 1)
      .setAlpha(0.55)
      .setDepth(depth.hud);
  }

  // ---------------------------------------------------------------------------------------------
  // Mission card
  // ---------------------------------------------------------------------------------------------

  private createMissionCard(): void {
    const { mission, theme, delivered, pillLabel } = titleMissionPresentation(this.progress);
    const s = this.uiScale;
    const spec = !theme.legacy && !this.compact ? { ...this.layout.card, y: 376, height: 316 } : this.layout.card;
    const card = new ParchmentCard(this, { x: spec.x, y: spec.y, width: spec.width, height: spec.height, title: titleCopy.missionHeader, uiScale: s });
    card.setDepth(depth.hud);
    const pad = card.padding;

    const pillState = delivered ? "idle" : "docking";
    if (delivered && theme.legacy) {
      // Completion lives inside the card: a perforated "collected" stamp replaces the header meta.
      this.addCollectedStamp(card, this.layout.cardMeta ? titleCopy.collectedStamp : titleCopy.collectedStampCompact);
    } else if (this.layout.cardMeta) {
      card.addContent(
        this.add
          .text(spec.width - pad, Math.round(card.headerHeight / 2) + 2, (theme.legacy ? mission.title : mission.shortTitle).toLowerCase(), monoStyle({ size: typeScale.sm, color: colors.sageDeep, bold: true }))
          .setOrigin(1, 0.5),
      );
    } else {
      // Compact: the state pill moves into the header so the portrait column stays clear.
      const pill = new StatePill(this, { x: 0, y: 0, state: pillState, label: pillLabel, uiScale: s });
      pill.setPosition(spec.width - pad - pill.pillWidth, Math.round(card.headerHeight / 2 + 2 - pill.pillHeight / 2));
      card.addContent(pill);
    }

    // Portrait in a recessed frame.
    const frameY = card.contentTop;
    const frame = this.add.graphics();
    drawRecessedSurface(frame, pad, frameY, PORTRAIT_FRAME, PORTRAIT_FRAME);
    card.addContent(frame);
    card.addContent(...this.createPortrait(pad + PORTRAIT_FRAME / 2, frameY + PORTRAIT_FRAME / 2));

    if (this.layout.cardMeta) {
      card.addContent(new StatePill(this, { x: pad, y: frameY + PORTRAIT_FRAME + uiScaled(12, s), state: pillState, label: pillLabel, uiScale: s }));
    }

    // Request copy column.
    const columnX = pad + PORTRAIT_FRAME + uiScaled(18, s);
    const columnWidth = spec.width - columnX - pad;
    const name = this.add.text(columnX, frameY - 2, mission.recipientName, headingStyle({ size: uiTextSize(theme.legacy ? 22 : 20, s), color: colors.ink, ...(!theme.legacy ? { wrapWidth: columnWidth } : {}) }));
    const request = this.add.text(columnX, name.y + name.height + uiScaled(6, s), `“${mission.requestText}”`, bodyStyle({ size: uiTextSize(15, s), color: colors.inkSoft, wrapWidth: columnWidth }));
    card.addContent(name, request);

    const itemsY = spec.height - pad - ITEM_TRAY_HEIGHT;
    card.addContent(...this.createItems(columnX, itemsY, columnWidth));
  }

  private createPortrait(x: number, y: number): Phaser.GameObjects.GameObject[] {
    const { theme, delivered } = titleMissionPresentation(this.progress);
    if (!theme.legacy) {
      return [theme.portraitTexture
        ? this.add.sprite(x, y, theme.portraitTexture, delivered ? CAMPAIGN_PORTRAIT_FRAME.welcome : CAMPAIGN_PORTRAIT_FRAME.idle).setScale(UI_ART_SCALE)
        : this.add.image(x, y, ASSET.shipIdle).setScale(UI_ART_SCALE)];
    }
    if (!hasAuthoredTexture(this, ASSET.rabbitPortrait)) {
      // Monogram portrait (design-system NPC portrait pattern) until the rabbit art lands.
      const g = this.add.graphics();
      g.fillStyle(colorNumber(colors.plum), 1);
      g.fillRect(x - 60, y - 60, 120, 120);
      const letter = this.add.text(x, y - 4, "r", headingStyle({ size: 64, color: colors.plaster })).setOrigin(0.5, 0.5);
      return [g, letter];
    }

    const portrait = this.add
      .sprite(x, y, ASSET.rabbitPortrait, this.teaMoonDelivered ? RABBIT_PORTRAIT_FRAME.happy : RABBIT_PORTRAIT_FRAME.idle)
      .setScale(UI_ART_SCALE);
    if (!this.teaMoonDelivered && !isReducedMotion()) {
      this.time.addEvent({
        delay: motion.breath * 1.6,
        loop: true,
        callback: () => {
          portrait.setFrame(RABBIT_PORTRAIT_FRAME.blink);
          this.time.delayedCall(motion.fast + 40, () => portrait.setFrame(RABBIT_PORTRAIT_FRAME.idle));
        },
      });
    }
    return [portrait];
  }

  private createItems(x: number, y: number, width: number): Phaser.GameObjects.GameObject[] {
    const { mission, theme } = titleMissionPresentation(this.progress);
    const s = this.uiScale;
    const objects: Phaser.GameObjects.GameObject[] = [];
    const tray = this.add.graphics();
    drawRecessedSurface(tray, x, y, width, ITEM_TRAY_HEIGHT);
    objects.push(tray);

    // Art sits ITEM_INSET inside the tray, side by side with an ITEM_ART_GAP breath.
    const cy = y + ITEM_TRAY_HEIGHT / 2;
    if (!theme.legacy && theme.cargoFrame !== null) {
      const labelX = x + ITEM_INSET + ITEM_ART + ITEM_LABEL_GAP;
      objects.push(
        this.add.image(x + ITEM_INSET + ITEM_ART / 2, cy, ASSET.campaignCargo, theme.cargoFrame).setScale(UI_ART_SCALE),
        this.add.text(labelX, cy, mission.deliveryItemName, monoStyle({ size: uiSecondaryTextSize(typeScale.sm, s), bold: true, color: colors.inkSoft, wrapWidth: width - (labelX - x) - ITEM_LABEL_GAP })).setOrigin(0, 0.5),
      );
      return objects;
    }
    const itemArt: readonly { key: string; icon: "tea" | "package" }[] = [
      { key: ASSET.itemTea, icon: "tea" },
      { key: ASSET.itemMochi, icon: "package" },
    ];
    itemArt.forEach((item, index) => {
      const cx = x + ITEM_INSET + ITEM_ART / 2 + index * (ITEM_ART + ITEM_ART_GAP);
      objects.push(hasAuthoredTexture(this, item.key) ? this.add.image(cx, cy, item.key).setScale(UI_ART_SCALE) : addUiIcon(this, cx, cy, item.icon));
    });

    const labelX = x + ITEM_INSET + ITEM_ART * 2 + ITEM_ART_GAP + ITEM_LABEL_GAP;
    const label = this.compact ? titleCopy.itemsCompact : mission.deliveryItemName;
    objects.push(
      this.add
        .text(labelX, cy, label, monoStyle({ size: uiSecondaryTextSize(typeScale.sm, s), bold: true, color: colors.inkSoft, wrapWidth: width - (labelX - x) - ITEM_LABEL_GAP }))
        .setOrigin(0, 0.5),
    );
    return objects;
  }

  /** Kit CollectedStamp right-aligned in the card header, flush with the inner padding. */
  private addCollectedStamp(card: ParchmentCard, label: string): void {
    const stamp = new CollectedStamp(this, { x: 0, y: 0, label, uiScale: this.uiScale });
    stamp.setPosition(card.cardWidth - card.padding - stamp.stampWidth, Math.round(card.headerHeight / 2 + 2 - stamp.stampHeight / 2)).setName("collected-stamp");
    card.addContent(stamp);
  }

  // ---------------------------------------------------------------------------------------------
  // Input, focus, panels
  // ---------------------------------------------------------------------------------------------

  private get panelOpen(): boolean {
    return (this.settingsPanel?.isOpen ?? false) || (this.routeLog?.isOpen ?? false);
  }

  private wireKeyboard(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    const handler = (event: KeyboardEvent): void => {
      if (this.starting || this.panelOpen || event.repeat) return;
      switch (event.code) {
        case "ArrowDown":
        case "ArrowRight":
        case "Tab":
          this.moveFocus(event.shiftKey && event.code === "Tab" ? -1 : 1);
          break;
        case "ArrowUp":
        case "ArrowLeft":
          this.moveFocus(-1);
          break;
        case "Enter":
        case "Space":
        case "NumpadEnter":
          this.focusables[this.focusIndex]?.activate();
          break;
        default:
          return;
      }
      event.preventDefault();
    };
    keyboard.on("keydown", handler);
    // A pointer user never needs the focus outline.
    const onPointer = (): void => this.setKeyboardNav(false);
    this.input.on(Phaser.Input.Events.POINTER_DOWN, onPointer);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      keyboard.off("keydown", handler);
      this.input.off(Phaser.Input.Events.POINTER_DOWN, onPointer);
    });
  }

  private moveFocus(direction: -1 | 1): void {
    const count = this.focusables.length;
    if (count === 0) return;
    // The first key press only reveals the outline on the current choice.
    if (this.keyboardNav) {
      this.focusIndex = (this.focusIndex + direction + count) % count;
      emitGameEvent(this, { type: "ui:hover" });
    }
    this.setKeyboardNav(true);
  }

  private setKeyboardNav(on: boolean): void {
    this.keyboardNav = on;
    this.focusables.forEach((button, index) => button.setFocused(on && index === this.focusIndex));
  }

  private wireResize(): void {
    let pending: Phaser.Time.TimerEvent | undefined;
    const onResize = (): void => {
      pending?.remove();
      pending = this.time.delayedCall(RESIZE_DEBOUNCE_MS, () => {
        const compact = isCompactDisplay(this);
        const key = layoutKeyFor(compact, compact ? compactUiScale(this) : 1);
        if (key !== this.layoutKey && !this.starting) this.scene.restart();
      });
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, onResize));
  }

  private openSettings(): void {
    if (this.panelOpen || this.starting) return;
    const settings = readSettings();
    this.settingsPanel = new SettingsPanel(this, {
      values: { musicVolume: settings.musicVolume, sfxVolume: settings.sfxVolume, reducedMotion: settings.reducedMotion },
      copy: settingsCopy,
      uiScale: this.uiScale,
      persisted: readPersistent(),
      showKeyHints: !this.touch,
      onChange: (values) => {
        try {
          SaveSystem.updateSettings({ musicVolume: values.musicVolume, sfxVolume: values.sfxVolume, reducedMotion: values.reducedMotion });
        } catch {
          // Storage failures are handled inside SaveSystem; never let settings break the title.
        }
        emitGameEvent(this, { type: "settings:changed" });
      },
      onClose: () => {
        this.settingsPanel = undefined;
      },
    });
    if (this.keyboardNav) this.settingsPanel.previewSelect("sound");
  }

  private openRouteLog(): void {
    if (this.panelOpen || this.starting) return;
    const { missionId, ...presentation } = campaignRouteLog(this.progress);
    this.routeLog = new RouteLogPanel(this, {
      ...presentation,
      stats: readRouteStats(missionId),
      uiScale: this.uiScale,
      onClose: () => {
        this.routeLog = undefined;
      },
    });
  }

  /** Opens the delivery board focused on the next suggested stop. */
  private openBoard(): void {
    if (this.starting || this.panelOpen) return;
    this.starting = true;
    this.focusables.forEach((button) => button.setEnabled(false));
    const data: MissionSelectSceneData = { focusMissionId: nextSuggestedMission(this.progress).id };
    transitionToScene(this, "MissionSelectScene", data, { kind: "warm-fade" });
  }

  private startMission(): void {
    if (this.starting) return;
    this.starting = true;
    this.focusables[0]?.setEnabled(false).showState("pressed");
    const data: FlightSceneData = { missionId: nextSuggestedMission(this.progress).id };
    transitionToScene(this, "FlightScene", data, { kind: "warm-fade" });
  }
}

function layoutKeyFor(compact: boolean, uiScale: number): string {
  return `${compact ? "compact" : "desktop"}:${uiScale.toFixed(1)}`;
}

function readProgress(): CampaignProgress {
  try {
    const save = SaveSystem.load();
    const completed: readonly unknown[] = Array.isArray(save.completedMissions) ? save.completedMissions : [];
    const unlocked: readonly unknown[] = Array.isArray(save.unlockedMissions) ? save.unlockedMissions : [];
    return normalizeCampaignProgress(completed, unlocked);
  } catch {
    // Storage may be unavailable or the save unreadable; the title still works without it.
    return normalizeCampaignProgress([], []);
  }
}

function readSettings(): { readonly musicVolume: number; readonly sfxVolume: number; readonly reducedMotion: boolean } {
  try {
    return SaveSystem.load().settings;
  } catch {
    return { musicVolume: 0.7, sfxVolume: 0.8, reducedMotion: false };
  }
}

function readPersistent(): boolean {
  try {
    return SaveSystem.persistenceStatus().kind === "persistent";
  } catch {
    return false;
  }
}

function readSaveNotice(): SaveNoticeKind | null {
  try {
    const diagnostics = SaveSystem.diagnostics();
    if (diagnostics.firstLoadOutcome.kind === "corrupt") return "corrupt";
    if (diagnostics.storageLocked) return "futureVersion";
    if (diagnostics.persistence.kind === "session-only" && diagnostics.persistence.reason === "storage-unavailable") return "storageUnavailable";
    return null;
  } catch {
    return null;
  }
}

function readRouteStats(missionId: string): RouteLogStat[] {
  try {
    const save = SaveSystem.load();
    const best = SaveSystem.getBestResult(missionId);
    const stats: RouteLogStat[] = [{ label: routeLogCopy.deliveriesLabel, value: String(save.stats.totalDeliveries) }];
    if (best) {
      stats.push({ label: routeLogCopy.bestLabel, value: best.conditionLabel.toLowerCase() });
      stats.push({ label: routeLogCopy.crashesLabel, value: String(best.crashes) });
    }
    return stats;
  } catch {
    return [];
  }
}

/** Disc built from whole `band`-px rows (a stepped pixel circle; no anti-aliased curves). */
function fillPixelDisc(g: Phaser.GameObjects.Graphics, cx: number, cy: number, radius: number, band: number): void {
  const r = Math.max(band, Math.round(radius / band) * band);
  for (let dy = -r; dy < r; dy += band) {
    const mid = dy + band / 2;
    const half = Math.round(Math.sqrt(Math.max(0, r * r - mid * mid)) / band) * band;
    if (half <= 0) continue;
    g.fillRect(Math.round(cx - half), Math.round(cy + dy), half * 2, band);
  }
}

/** Seeded-by-harness pixel starfield used while the authored star layers are missing. */
function ensureStarfieldTexture(scene: Phaser.Scene, key: string, count: number): string {
  if (scene.textures.exists(key)) return key;
  const size = 256;
  const texture = scene.textures.createCanvas(key, size, size);
  if (!texture) return key;
  const context = texture.getContext();
  const palette = [colors.plaster, colors.plaster, colors.duskBlue, colors.amber, colors.plum];
  for (let index = 0; index < count; index += 1) {
    const x = Math.floor(Math.random() * size);
    const y = Math.floor(Math.random() * size);
    context.globalAlpha = 0.35 + Math.random() * 0.65;
    context.fillStyle = palette[index % palette.length] ?? colors.plaster;
    context.fillRect(x, y, 1, 1);
    if (index % 9 === 0) {
      context.globalAlpha *= 0.5;
      context.fillRect(x - 1, y, 3, 1);
      context.fillRect(x, y - 1, 1, 3);
    }
  }
  texture.refresh();
  return key;
}
