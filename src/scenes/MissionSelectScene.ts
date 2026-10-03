import Phaser from "phaser";
import { ASSET, CAMPAIGN_PORTRAIT_FRAME, RABBIT_PORTRAIT_FRAME } from "../data/assetManifest";
import { isMissionId } from "../data/campaign";
import { themeFor } from "../data/campaign/themes";
import { boardCopy } from "../data/uiCopy";
import { installDevSceneHotkeys } from "../dev/DevSceneLauncher";
import { registerDevState } from "../dev/devProbe";
import { isReducedMotion } from "../fx/feedback";
import { playEnterTransition, transitionToScene } from "../fx/transitions";
import { compactUiScale, displayScale, isCompactDisplay } from "../game/displayScale";
import { colorNumber, colors, depth, motion, typeScale } from "../game/designTokens";
import { emitGameEvent } from "../game/events";
import { missionBoard, nextSuggestedMission, normalizeCampaignProgress, type CampaignProgress, type MissionBoardNode } from "../systems/CampaignSystem";
import { SaveSystem } from "../systems/SaveSystem";
import type { MissionId, MissionSelectSceneData } from "../types/campaign";
import type { FlightSceneData } from "../types/flight";
import {
  boardLegDots,
  boardLegArrow,
  BOARD_TOKEN,
  boardNodeCentres,
  boardRouteLegs,
  boardTokenCaption,
  boardUnlockCaptionTop,
  initialBoardSelection,
  isSelectable,
  navigateBoard,
  pixelRingRects,
  touchTargetPx,
  type BoardMove,
  boardShipMarker,
} from "../ui/boardLayout";
import { Button } from "../ui/Button";
import { Keycap } from "../ui/Keycap";
import { uiScaled, uiSecondaryTextSize, uiTextSize, type Point } from "../ui/layout";
import { CollectedStamp } from "../ui/NoticeChips";
import { CARD_HEADER_HEIGHT, ParchmentCard } from "../ui/ParchmentCard";
import { installSoundToast } from "../ui/SoundToast";
import { fillSteppedRect, STEPPED_CORNER } from "../ui/surfaces";
import { bodyStyle, displayTitleStyle, headingStyle, monoStyle } from "../ui/textStyles";
import { detectTouchDevice } from "../ui/TouchControls";
import { hasAuthoredTexture } from "../ui/uiTextures";

/** Board illustrations are 1x tokens; scenery elsewhere retains its authored 2x scale. */
const NODE = {
  ringRadius: BOARD_TOKEN.ringRadius,
  selectRadius: BOARD_TOKEN.selectRadius,
  ringBand: 4,
  clearRadius: 100,
  artScale: BOARD_TOKEN.artScale,
  lockedAlpha: 0.38,
} as const;
const ROUTE = { spacing: 16, dot: 4, openAlpha: 0.85, closedAlpha: 0.32 } as const;
const MARGIN_X = 64;
const RESIZE_DEBOUNCE_MS = 160;
/** 44 CSS px minimum touch target (plan §5), capped so letterboxed portrait phones stay sane. */
const TOUCH_TARGET_CSS = 44;

type NodeView = {
  readonly node: MissionBoardNode;
  readonly centre: Point;
  readonly selectRing: Phaser.GameObjects.Graphics;
  readonly label: Phaser.GameObjects.Text;
  readonly hit: Phaser.GameObjects.Zone;
  readonly lock: Phaser.GameObjects.Container | null;
};

/**
 * Delivery board (plan §5): a small illustrated board of six fixed stops joined by a dotted route.
 * Composition only — progress rules live in CampaignSystem, geometry/navigation in ui/boardLayout.
 */
export class MissionSelectScene extends Phaser.Scene {
  private focusMissionId: MissionId | undefined;
  private progress: CampaignProgress = { completedMissions: [], unlockedMissions: ["tea-moon"] };
  private nodes: NodeView[] = [];
  private selected = 0;
  private compact = false;
  private uiScale = 1;
  private touch = false;
  private leaving = false;
  private layoutKey = "";
  private panel: ParchmentCard | undefined;
  private launchButton: Button | undefined;
  private backButton: Button | undefined;
  private pulse: Phaser.Tweens.Tween | undefined;
  private starsFar: Phaser.GameObjects.TileSprite | undefined;
  private starsNear: Phaser.GameObjects.TileSprite | undefined;
  private shipMarker: Phaser.GameObjects.Container | undefined;

  constructor() {
    super("MissionSelectScene");
  }

  init(data?: Partial<MissionSelectSceneData>): void {
    this.focusMissionId = isMissionId(data?.focusMissionId) ? data.focusMissionId : undefined;
  }

  create(): void {
    this.leaving = false;
    this.nodes = [];
    this.panel = undefined;
    this.launchButton = undefined;
    this.pulse = undefined;
    this.shipMarker = undefined;
    this.compact = isCompactDisplay(this);
    this.uiScale = this.compact ? compactUiScale(this) : 1;
    this.layoutKey = layoutKeyFor(this.compact, this.uiScale);
    this.touch = detectTouchDevice();
    this.progress = readProgress();

    const board = missionBoard(this.progress);
    const states = board.map((node) => node.state);
    const focusId = this.focusMissionId ?? nextSuggestedMission(this.progress).id;
    this.selected = Math.max(0, initialBoardSelection(states, board.findIndex((node) => node.mission.id === focusId)));

    installSoundToast(this.game);
    this.createBackdrop();
    this.createHeader();
    this.createRoute(board);
    board.forEach((node, index) => this.createNode(node, index));
    this.applySelection(false);
    this.wireKeyboard();
    this.wireResize();
    installDevSceneHotkeys(this);

    registerDevState("board", () => ({
      layout: this.compact ? "compact" : "desktop",
      uiScale: Number(this.uiScale.toFixed(2)),
      touch: this.touch,
      selected: this.nodes[this.selected]?.node.mission.id ?? null,
      artScale: NODE.artScale,
      panelTop: this.panel?.y ?? null,
      launchLabel: this.selectedNode?.state === "completed" ? boardCopy.replay : boardCopy.launch,
      leaving: this.leaving,
      nodes: this.nodes.map((view) => ({
        id: view.node.mission.id,
        state: view.node.state,
        x: view.centre.x,
        y: view.centre.y,
        label: view.label.text,
        hitCss: Math.round(view.hit.width * displayScale(this.game)),
        hitHeightCss: Math.round(view.hit.height * displayScale(this.game)),
      })),
      launchButtonCss: this.launchButton
        ? { width: Math.round(this.launchButton.buttonWidth * displayScale(this.game)), height: Math.round(this.launchButton.buttonHeight * displayScale(this.game)) }
        : null,
      backButtonCss: this.backButton ? { height: Math.round(this.backButton.buttonHeight * displayScale(this.game)) } : null,
    }));

    void playEnterTransition(this, { kind: "warm-fade", durationMs: motion.slow });
    emitGameEvent(this, { type: "scene:enter", scene: "MissionSelectScene" });
  }

  update(_time: number, delta: number): void {
    const seconds = Math.min(delta, 100) / 1000;
    if (this.starsFar) this.starsFar.tilePositionX += 3 * seconds;
    if (this.starsNear) this.starsNear.tilePositionX += 7 * seconds;
  }

  private get selectedNode(): MissionBoardNode | undefined {
    return this.nodes[this.selected]?.node;
  }

  // ---------------------------------------------------------------------------------------------
  // Composition
  // ---------------------------------------------------------------------------------------------

  private createBackdrop(): void {
    const { width, height } = this.scale;
    this.add.rectangle(0, 0, width, height, colorNumber(colors.cosmos)).setOrigin(0, 0).setDepth(depth.backdrop);
    const tiled = (key: string, alpha: number): Phaser.GameObjects.TileSprite | undefined =>
      hasAuthoredTexture(this, key) ? this.add.tileSprite(0, 0, width, height, key).setOrigin(0, 0).setTileScale(2).setAlpha(alpha).setDepth(depth.backdrop) : undefined;
    this.starsFar = tiled(ASSET.spaceStarsFar, 0.7);
    if (hasAuthoredTexture(this, ASSET.spaceNebula)) tiled(ASSET.spaceNebula, 0.45);
    this.starsNear = tiled(ASSET.spaceStarsNear, 0.8);

    // The board itself: a soft stepped dark plate the stops sit on.
    const plate = this.add.graphics().setDepth(depth.parallax);
    plate.fillStyle(colorNumber(colors.cosmosDeep), 0.42);
    const top = this.compact ? 72 : 108;
    fillSteppedRect(plate, 40, top, width - 80, height - top - 16, STEPPED_CORNER.round, 4);
  }

  private createHeader(): void {
    const s = this.uiScale;
    const titleY = this.compact ? 14 : 30;
    this.add
      .text(MARGIN_X, titleY, boardCopy.title, displayTitleStyle({ size: this.compact ? uiTextSize(28, s) : 44, color: colors.plaster }))
      .setShadow(3, 4, colors.terracottaDeep, 0, false, true)
      .setDepth(depth.hud);
    if (!this.compact) {
      this.add
        .text(MARGIN_X + 2, titleY + 52, boardCopy.subtitle, bodyStyle({ size: uiTextSize(typeScale.base, s), color: colors.parchmentDeep }))
        .setAlpha(0.85)
        .setDepth(depth.hud);
    }

    const backHeight = Math.max(uiScaled(44, s), this.compact ? touchTargetPx(TOUCH_TARGET_CSS, displayScale(this.game), uiScaled(60, s)) : 0);
    const backWidth = uiScaled(132, s);
    const back = new Button(this, {
      x: this.scale.width - MARGIN_X - backWidth,
      y: this.compact ? 6 : 30,
      label: boardCopy.back,
      width: backWidth,
      height: backHeight,
      variant: "ink",
      icon: "home",
      uiScale: s,
      onActivate: () => this.goBack(),
    });
    back.setName("back").setDepth(depth.hud);
    back.setX(this.scale.width - MARGIN_X - back.buttonWidth);
    this.backButton = back;

    if (this.touch || this.compact) return;
    // Keycap hints, right-aligned before the back button.
    const pieces = boardCopy.hints.map((hint) => {
      const keycap = new Keycap(this, { x: 0, y: 0, label: hint.key, uiScale: s }).setDepth(depth.hud);
      const label = this.add
        .text(0, 0, hint.label, bodyStyle({ size: uiTextSize(typeScale.base, s), color: colors.parchmentDeep }))
        .setOrigin(0, 0.5)
        .setAlpha(0.85)
        .setDepth(depth.hud);
      return { keycap, label };
    });
    const gap = 8;
    const spacing = 22;
    const total = pieces.reduce((sum, piece) => sum + piece.keycap.keyWidth + gap + Math.ceil(piece.label.width) + spacing, -spacing);
    let cursor = Math.round(back.x - 28 - total);
    const y = Math.round(back.y + back.buttonHeight / 2);
    for (const piece of pieces) {
      piece.keycap.setPosition(cursor, Math.round(y - piece.keycap.keyHeight / 2));
      piece.label.setPosition(cursor + piece.keycap.keyWidth + gap, y - 1);
      cursor += piece.keycap.keyWidth + gap + Math.ceil(piece.label.width) + spacing;
    }
  }

  private createRoute(board: readonly MissionBoardNode[]): void {
    const centres = boardNodeCentres(this.compact ? "compact" : "desktop");
    const g = this.add.graphics().setDepth(depth.world);
    boardRouteLegs(centres, this.compact ? 230 : 220).forEach((leg, index) => {
      const open = isSelectable(board[index + 1]?.state);
      g.fillStyle(colorNumber(open ? colors.amber : colors.duskBlue), open ? ROUTE.openAlpha : ROUTE.closedAlpha);
      for (const dot of boardLegDots(leg, ROUTE.spacing, NODE.clearRadius)) {
        g.fillRect(dot.x - ROUTE.dot / 2, dot.y - ROUTE.dot / 2, ROUTE.dot, ROUTE.dot);
      }
      for (const pixel of boardLegArrow(leg)) g.fillRect(pixel.x, pixel.y, 4, 4);
    });
  }

  private createNode(node: MissionBoardNode, index: number): void {
    const s = this.uiScale;
    const centre = boardNodeCentres(this.compact ? "compact" : "desktop")[index] ?? { x: 0, y: 0 };
    const locked = node.state === "locked";

    // Warm outline (available), faint sage (completed); locked stops have none.
    if (!locked) {
      const ring = this.add.graphics().setDepth(depth.world);
      ring.fillStyle(colorNumber(node.state === "available" ? colors.ember : colors.sage), node.state === "available" ? 0.9 : 0.5);
      drawRing(ring, centre, NODE.ringRadius, NODE.ringBand, NODE.ringBand);
    }
    const selectRing = this.add.graphics().setDepth(depth.world).setVisible(false);
    selectRing.fillStyle(colorNumber(colors.plaster), 0.95);
    drawRing(selectRing, centre, NODE.selectRadius, NODE.ringBand, NODE.ringBand);

    const theme = themeFor(node.mission.themeId);
    const art = this.add.image(centre.x, centre.y, theme.destinationTexture)
      .setScale(NODE.artScale).setDepth(depth.world);
    // Tea's older 192px texture uses a centred 160px crop; campaign art fits at native size.
    const cropX = Math.max(0, Math.floor((art.width - BOARD_TOKEN.artSize) / 2));
    const cropY = Math.max(0, Math.floor((art.height - BOARD_TOKEN.artSize) / 2));
    art.setCrop(cropX, cropY, BOARD_TOKEN.artSize, BOARD_TOKEN.artSize);
    if (locked) art.setAlpha(NODE.lockedAlpha).setTint(colorNumber(colors.duskBlue));

    const labelY = centre.y + BOARD_TOKEN.labelOffset;
    const label = this.add
      .text(centre.x, labelY, node.mission.shortTitle, headingStyle({ size: uiTextSize(16, s), color: colors.plaster }))
      .setOrigin(0.5, 0)
      .setAlpha(locked ? 0.85 : 1)
      .setDepth(depth.hud);
    let lock: Phaser.GameObjects.Container | null = null;
    const chipY = boardTokenCaption(centre, label.height, 0).chipY;
    if (locked) lock = this.createLock(centre, boardUnlockCaptionTop(centre, chipY, this.compact ? "compact" : "desktop", index), node.unlockedBy ? boardCopy.lockedAfter(node.unlockedBy.shortTitle) : null);
    if (node.state === "completed") {
      const stamp = new CollectedStamp(this, { x: 0, y: 0, label: boardCopy.deliveredStamp, uiScale: Math.min(s, 1.3) });
      stamp.setPosition(Math.round(centre.x - stamp.stampWidth / 2), chipY).setDepth(depth.hud).setName(`stamp-${node.mission.id}`);
    }

    const hit = this.add
      .zone(centre.x, centre.y + 24, BOARD_TOKEN.hitWidth, BOARD_TOKEN.hitHeight)
      .setInteractive({ useHandCursor: !locked })
      .setDepth(depth.hud);
    hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.onNodePointer(index));
    this.nodes.push({ node, centre, selectRing, label, hit, lock });
  }

  /** Pixel padlock over the art; the "After …" chip sits below the destination label. */
  private createLock(centre: Point, chipTop: number, note: string | null): Phaser.GameObjects.Container {
    const parts: Phaser.GameObjects.GameObject[] = [];
    if (note) {
      const text = this.add
        .text(0, 0, note, monoStyle({ size: uiTextSize(typeScale.sm, this.uiScale), color: colors.parchmentDeep }))
        .setAlpha(0.7)
        .setOrigin(0.5, 0.5);
      const padX = 8;
      const chipW = Math.ceil(text.width / 2) * 2 + padX * 2;
      const chipH = Math.ceil(text.height / 2) * 2 + 2;
      const chipY = chipTop - centre.y + chipH / 2;
      const chip = this.add.graphics();
      chip.fillStyle(colorNumber(colors.cosmosDeep), 0.82);
      fillSteppedRect(chip, -chipW / 2, chipY - chipH / 2, chipW, chipH, STEPPED_CORNER.soft, 2);
      text.setPosition(0, chipY);
      parts.push(chip, text);
    }
    const g = this.add.graphics();
    g.fillStyle(colorNumber(colors.cosmosDeep), 0.7);
    for (const rect of pixelRingRects(26, 26, 4)) g.fillRect(rect.x, rect.y, rect.width, rect.height);
    g.fillStyle(colorNumber(colors.parchmentDeep), 1);
    // Shackle (2 px art scale).
    g.fillRect(-8, -16, 4, 12);
    g.fillRect(4, -16, 4, 12);
    g.fillRect(-6, -18, 12, 4);
    // Body + keyhole.
    g.fillRect(-12, -4, 24, 18);
    g.fillStyle(colorNumber(colors.ink), 1);
    g.fillRect(-2, 0, 4, 8);
    return this.add.container(centre.x, centre.y - 12, [g, ...parts]).setDepth(depth.hud);
  }

  /** Bottom detail panel for the selected stop (rebuilt only when the selection changes). */
  private createPanel(): void {
    this.panel?.destroy();
    this.launchButton?.destroy();
    const node = this.selectedNode;
    if (!node) return;
    const s = this.uiScale;
    const mission = node.mission;
    const width = this.scale.width - 80;
    const pad = uiScaled(this.compact ? 8 : 18, s);
    const buttonHeight = Math.max(uiScaled(56, s), this.compact ? touchTargetPx(TOUCH_TARGET_CSS, displayScale(this.game), uiScaled(64, s)) : 0);
    // Button can grow to fit a pixel-font label. Reserve its measured width before wrapping copy.
    const launch = new Button(this, {
      x: 0,
      y: 0,
      label: node.state === "completed" ? boardCopy.replay : boardCopy.launch,
      width: uiScaled(this.compact ? 230 : 280, s),
      height: buttonHeight,
      icon: "package",
      uiScale: s,
      onActivate: () => this.launch(),
    });
    launch.setName("launch").setDepth(depth.hud + 1);
    this.launchButton = launch;
    const buttonWidth = launch.buttonWidth;
    const artWidth = 172;
    const textWidth = width - pad * 3 - buttonWidth - artWidth;

    // Measure first so the card is exactly as tall as its copy.
    const recipient = this.add.text(0, 0, mission.recipientName, headingStyle({ size: uiTextSize(this.compact ? 19 : 22, s), color: colors.ink, wrapWidth: textWidth }));
    const item = this.add.text(0, 0, `${boardCopy.carrying} · ${mission.deliveryItemName}`, monoStyle({ size: uiSecondaryTextSize(typeScale.sm, s), bold: true, color: colors.sageDeep, wrapWidth: textWidth }));
    const request = this.add.text(0, 0, `“${mission.requestText}”`, bodyStyle({ size: uiTextSize(this.compact ? 14 : 15, s), color: colors.inkSoft, wrapWidth: textWidth }));
    const idea = this.add.text(0, 0, boardCopy.newIdea[mission.id], monoStyle({ size: uiSecondaryTextSize(typeScale.sm, s), bold: true, color: colors.terracottaDeep, wrapWidth: textWidth }));
    const gap = uiScaled(this.compact ? 2 : 4, s);
    const top = this.compact ? pad : uiScaled(CARD_HEADER_HEIGHT, s) + uiScaled(12, s);
    const textHeight = recipient.height + gap + item.height + gap * 2 + request.height + gap + idea.height;
    const height = Math.ceil(top + Math.max(textHeight, buttonHeight) + pad);

    const y = this.scale.height - 12 - height;
    const panel = new ParchmentCard(this, {
      x: 40,
      y,
      width,
      height,
      ...(!this.compact ? { title: mission.shortTitle.toLowerCase() } : {}),
      padding: pad,
      uiScale: s,
    });
    panel.setDepth(depth.hud).setName("detail-panel");
    const contentTop = panel.contentTop;
    recipient.setPosition(pad + artWidth, contentTop - 2);
    item.setPosition(pad + artWidth, recipient.y + recipient.height + gap);
    request.setPosition(pad + artWidth, item.y + item.height + gap * 2);
    idea.setPosition(pad + artWidth, request.y + request.height + gap);
    const theme = themeFor(mission.themeId);
    const artY = Math.round(contentTop + Math.max(textHeight, 96) / 2);
    const portrait = theme.portraitTexture
      ? this.add.image(pad + 48, artY, theme.portraitTexture, theme.legacy ? RABBIT_PORTRAIT_FRAME.idle : CAMPAIGN_PORTRAIT_FRAME.idle).setScale(2)
      : this.add.image(pad + 48, artY, ASSET.shipIdle).setScale(2);
    // Tea's 64px portrait is cropped to the same 48px art window as campaign portraits.
    if (theme.legacy) portrait.setCrop(8, 8, 48, 48);
    const cargo = theme.cargoFrame === null
      ? this.add.image(pad + 132, artY, ASSET.itemTea).setScale(2)
      : this.add.image(pad + 132, artY, ASSET.campaignCargo, theme.cargoFrame).setScale(2);
    panel.addContent(portrait, cargo, recipient, item, request, idea);
    this.panel = panel;

    launch.setPosition(40 + width - pad - buttonWidth, Math.round(y + contentTop + (height - contentTop - pad - buttonHeight) / 2));
  }

  // ---------------------------------------------------------------------------------------------
  // Selection, input, flow
  // ---------------------------------------------------------------------------------------------

  private applySelection(announce: boolean): void {
    this.pulse?.remove();
    this.pulse = undefined;
    this.nodes.forEach((view, index) => {
      const on = index === this.selected;
      view.selectRing.setVisible(on).setAlpha(1);
      if (view.node.state !== "locked") view.label.setColor(on ? colors.amber : colors.plaster);
    });
    this.shipMarker?.destroy();
    const selected = this.nodes[this.selected];
    if (selected) {
      const ship = this.add.image(0, 0, ASSET.shipIdle).setScale(2);
      // Ship rides just below the route dots; the caption sits under it (omitted on compact, where the ring says enough).
      const marker = boardShipMarker(selected.centre);
      const caption = this.add.text(0, marker.captionDy, boardCopy.here, monoStyle({ size: typeScale.sm, color: colors.amber, bold: true })).setOrigin(0.5, 0).setVisible(!this.compact);
      this.shipMarker = this.add.container(marker.x, marker.y, [ship, caption]).setDepth(depth.worldFx);
    }
    const ring = this.nodes[this.selected]?.selectRing;
    if (ring && !isReducedMotion()) {
      this.pulse = this.tweens.add({ targets: ring, alpha: 0.45, duration: motion.breath / 2, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
    this.createPanel();
    if (announce) emitGameEvent(this, { type: "ui:hover" });
  }

  private select(index: number): void {
    if (index === this.selected || !isSelectable(this.nodes[index]?.node.state)) return;
    this.selected = index;
    this.applySelection(true);
  }

  private onNodePointer(index: number): void {
    if (this.leaving) return;
    const view = this.nodes[index];
    if (!view) return;
    if (view.node.state === "locked") {
      // A tiny "not yet" wiggle of the padlock; locked stops are never selected.
      if (view.lock && !isReducedMotion()) {
        this.tweens.add({ targets: view.lock, x: view.centre.x + 4, duration: 50, yoyo: true, repeat: 2, onComplete: () => view.lock?.setX(view.centre.x) });
      }
      return;
    }
    emitGameEvent(this, { type: "ui:confirm" });
    this.select(index);
  }

  private wireKeyboard(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    const moves: Readonly<Record<string, BoardMove>> = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" };
    const handler = (event: KeyboardEvent): void => {
      if (this.leaving || event.repeat) return;
      const move = event.code === "Tab" ? (event.shiftKey ? "previous" : "next") : moves[event.code];
      if (move) {
        this.select(navigateBoard(this.nodes.map((view) => view.node.state), this.selected, move));
      } else if (event.code === "Enter" || event.code === "NumpadEnter" || event.code === "Space") {
        this.launchButton?.setFocused(true);
        this.launchButton?.activate();
      } else if (event.code === "Escape" || event.code === "Backspace") {
        this.goBack();
      } else {
        return;
      }
      event.preventDefault();
    };
    keyboard.on("keydown", handler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => keyboard.off("keydown", handler));
  }

  private wireResize(): void {
    let pending: Phaser.Time.TimerEvent | undefined;
    const onResize = (): void => {
      pending?.remove();
      pending = this.time.delayedCall(RESIZE_DEBOUNCE_MS, () => {
        const compact = isCompactDisplay(this);
        const key = layoutKeyFor(compact, compact ? compactUiScale(this) : 1);
        const focus = this.selectedNode?.mission.id;
        if (key !== this.layoutKey && !this.leaving) this.scene.restart(focus ? { focusMissionId: focus } : {});
      });
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, onResize));
  }

  private launch(): void {
    const node = this.selectedNode;
    if (this.leaving || !node || !isSelectable(node.state)) return;
    this.leaving = true;
    this.launchButton?.setEnabled(false).showState("pressed");
    const data: FlightSceneData = { missionId: node.mission.id };
    transitionToScene(this, "FlightScene", data, { kind: "warm-fade" });
  }

  private goBack(): void {
    if (this.leaving) return;
    this.leaving = true;
    emitGameEvent(this, { type: "ui:back" });
    transitionToScene(this, "TitleScene", {}, { kind: "warm-fade" });
  }
}

function drawRing(g: Phaser.GameObjects.Graphics, centre: Point, radius: number, thickness: number, band: number): void {
  for (const rect of pixelRingRects(radius, thickness, band)) g.fillRect(centre.x + rect.x, centre.y + rect.y, rect.width, rect.height);
}

function layoutKeyFor(compact: boolean, uiScale: number): string {
  return `${compact ? "compact" : "desktop"}:${uiScale.toFixed(1)}`;
}

function readProgress(): CampaignProgress {
  try {
    const save = SaveSystem.load();
    return normalizeCampaignProgress(save.completedMissions, save.unlockedMissions);
  } catch {
    // Storage may be unavailable; the board still opens with Tea Moon.
    return normalizeCampaignProgress([], []);
  }
}
