import Phaser from "phaser";
import { colorNumber, colors, typeScale } from "../game/designTokens";
import { Button } from "./Button";
import { addUiIcon } from "./icons";
import { uiIconScale, uiScaled, uiSecondaryTextSize, uiTextSize } from "./layout";
import { Modal } from "./Modal";
import { CARD_HEADER_HEIGHT } from "./ParchmentCard";
import { drawRecessedSurface, UI_ART_SCALE } from "./surfaces";
import { bodyStyle, headingStyle, monoStyle } from "./textStyles";
import { hasAuthoredTexture } from "./uiTextures";

export type RouteLogStat = { readonly label: string; readonly value: string };

/** One delivered stop in the optional history list (e.g. "Bento Belt" · "Mallow"). */
export type RouteLogEntry = { readonly title: string; readonly detail: string };

export type RouteLogPanelCopy = {
  readonly title: string;
  readonly entryTitle: string;
  readonly entryMeta: string;
  readonly postcardCaption: string;
  readonly close: string;
};

export type RouteLogPanelOptions = {
  readonly copy: RouteLogPanelCopy;
  /** Texture key of the collected postcard (96x64 art, shown at 2x). Missing art draws a stamp. */
  readonly postcardKey: string;
  /** Frame inside `postcardKey` (campaign sprite-sheet postcards); keeps the authored 2x scale. */
  readonly postcardFrame?: number;
  /** Optional delivery history below the entry, two columns of short lines. Omitted: no list. */
  readonly history?: { readonly title: string; readonly entries: readonly RouteLogEntry[] };
  readonly stats: readonly RouteLogStat[];
  /** Compact-display multiplier (see `compactUiScale`). Default 1. */
  readonly uiScale?: number;
  readonly onClose?: () => void;
};

/** Geometry at uiScale 1 (screen px). The postcard keeps its integer 2x art scale. */
const PANEL = {
  width: 620,
  postcardWidth: 192,
  postcardHeight: 128,
  framePad: 8,
  columnGap: 22,
  statRowHeight: 30,
  closeWidth: 150,
  closeHeight: 46,
  footerGap: 16,
} as const;

/**
 * Route log modal: one entry per delivered route with its collected postcard and a few gentle
 * stats. Data comes in through options; the panel knows nothing about saves or missions.
 */
export class RouteLogPanel {
  readonly modal: Modal;

  constructor(scene: Phaser.Scene, options: RouteLogPanelOptions) {
    const s = options.uiScale ?? 1;
    const width = uiScaled(PANEL.width, s);
    const framePad = uiScaled(PANEL.framePad, s);
    // The postcard keeps whole-pixel art scales: 2x on desktop, 3x once the UI is compact.
    const postcardScale = uiIconScale(s, UI_ART_SCALE);
    const frameWidth = (PANEL.postcardWidth / UI_ART_SCALE) * postcardScale + framePad * 2;
    const frameHeight = (PANEL.postcardHeight / UI_ART_SCALE) * postcardScale + framePad * 2;
    const closeHeight = uiScaled(PANEL.closeHeight, s);
    const statRow = uiScaled(PANEL.statRowHeight, s);
    const pad = uiScaled(20, s);
    const columnX = pad + frameWidth + uiScaled(PANEL.columnGap, s);
    const columnWidth = width - columnX - pad;

    // Measure the entry column first so the modal is exactly as tall as its content.
    const entryTitle = scene.add.text(0, 0, options.copy.entryTitle, headingStyle({ size: uiTextSize(typeScale.xl, s), color: colors.ink }));
    const meta = scene.add.text(0, 0, options.copy.entryMeta, monoStyle({ size: uiSecondaryTextSize(typeScale.sm, s), bold: true, color: colors.sageDeep }));
    const caption = scene.add.text(0, 0, options.copy.postcardCaption, bodyStyle({ size: uiTextSize(typeScale.base, s), color: colors.inkSoft, wrapWidth: columnWidth }));
    const metaGap = uiScaled(2, s);
    const captionGap = uiScaled(10, s);
    const statsGap = uiScaled(14, s);
    const columnHeight = entryTitle.height + metaGap + meta.height + captionGap + caption.height + statsGap + options.stats.length * statRow;
    const bodyHeight = Math.ceil(Math.max(frameHeight, columnHeight));
    const history = options.history && options.history.entries.length > 0 ? options.history : undefined;
    const historyRows = history ? Math.ceil(history.entries.length / 2) : 0;
    const historyGap = uiScaled(18, s);
    const historyTitleHeight = uiScaled(26, s);
    const historyHeight = history ? historyGap + historyTitleHeight + historyRows * statRow : 0;
    const contentTop = uiScaled(CARD_HEADER_HEIGHT, s) + uiScaled(12, s);
    const footerGap = uiScaled(PANEL.footerGap, s);
    const height = contentTop + bodyHeight + historyHeight + footerGap + closeHeight + uiScaled(3, s) + pad;

    this.modal = new Modal(scene, {
      width,
      height,
      title: options.copy.title,
      uiScale: s,
      ...(options.onClose ? { onClose: options.onClose } : {}),
    });
    const card = this.modal.card;
    const top = card.contentTop;

    // Postcard in a recessed frame (integer art scale).
    const frame = scene.add.graphics();
    drawRecessedSurface(frame, pad, top, frameWidth, frameHeight);
    card.addContent(frame);
    const cx = pad + Math.round(frameWidth / 2);
    const cy = top + Math.round(frameHeight / 2);
    if (hasAuthoredTexture(scene, options.postcardKey) && options.postcardFrame !== undefined) {
      const image = scene.add.image(cx, cy, options.postcardKey, options.postcardFrame);
      card.addContent(image.setScale(UI_ART_SCALE));
    } else if (hasAuthoredTexture(scene, options.postcardKey)) {
      card.addContent(scene.add.image(cx, cy, options.postcardKey).setScale(postcardScale));
    } else {
      card.addContent(addUiIcon(scene, cx, cy, "memory", { scale: uiIconScale(s) + 1 }));
    }

    // Entry column: title + meta, caption, stats.
    entryTitle.setPosition(columnX, top - 2);
    meta.setPosition(columnX, entryTitle.y + entryTitle.height + metaGap);
    caption.setPosition(columnX, meta.y + meta.height + captionGap);
    card.addContent(entryTitle, meta, caption);

    const statsTop = Math.round(caption.y + caption.height + statsGap);
    const rule = scene.add.graphics();
    rule.fillStyle(colorNumber(colors.border), 1);
    for (let x = columnX; x < columnX + columnWidth; x += 6) rule.fillRect(x, statsTop - uiScaled(6, s), 2, 2);
    card.addContent(rule);
    options.stats.forEach((stat, index) => {
      const y = statsTop + index * statRow + Math.round(statRow / 2);
      card.addContent(
        scene.add.text(columnX, y, stat.label, monoStyle({ size: uiSecondaryTextSize(typeScale.sm, s), color: colors.inkSoft })).setOrigin(0, 0.5),
        scene.add.text(columnX + columnWidth, y, stat.value, monoStyle({ size: uiSecondaryTextSize(typeScale.sm, s), bold: true, color: colors.ink })).setOrigin(1, 0.5),
      );
    });

    if (history) {
      const historyTop = top + bodyHeight + historyGap;
      const historyRule = scene.add.graphics();
      historyRule.fillStyle(colorNumber(colors.border), 1);
      for (let x = pad; x < width - pad; x += 6) historyRule.fillRect(x, historyTop - uiScaled(8, s), 2, 2);
      card.addContent(
        historyRule,
        scene.add.text(pad, historyTop, history.title, monoStyle({ size: uiSecondaryTextSize(typeScale.sm, s), bold: true, color: colors.sageDeep })),
      );
      const cellWidth = Math.floor((width - pad * 2) / 2);
      history.entries.forEach((entry, index) => {
        const x = pad + (index % 2) * cellWidth;
        const y = historyTop + historyTitleHeight + Math.floor(index / 2) * statRow + Math.round(statRow / 2);
        const title = scene.add.text(x, y, `✓ ${entry.title}`, monoStyle({ size: uiSecondaryTextSize(typeScale.sm, s), bold: true, color: colors.ink })).setOrigin(0, 0.5);
        const detail = scene.add
          .text(Math.ceil(title.x + title.width + uiScaled(8, s)), y, `· ${entry.detail}`, monoStyle({ size: uiSecondaryTextSize(typeScale.sm, s), color: colors.inkSoft }))
          .setOrigin(0, 0.5);
        // Keep each line inside its column; the recipient is the part that gives way.
        const room = x + cellWidth - uiScaled(8, s) - detail.x;
        if (detail.width > room) detail.setVisible(room > uiScaled(40, s)).setCrop(0, 0, Math.max(0, room), detail.height);
        card.addContent(title, detail);
      });
    }

    const closeWidth = uiScaled(PANEL.closeWidth, s);
    const close = new Button(scene, {
      x: width - pad - closeWidth,
      y: top + bodyHeight + historyHeight + footerGap,
      label: options.copy.close,
      width: closeWidth,
      height: closeHeight,
      variant: "secondary",
      uiScale: s,
      onActivate: () => this.modal.close(),
    });
    card.addContent(close);

    const keyboard = scene.input.keyboard;
    if (keyboard) {
      const onConfirm = (event: KeyboardEvent): void => {
        if (event.repeat || this.modal.isClosing || !this.modal.active) return;
        if (event.code !== "Enter" && event.code !== "Space") return;
        event.preventDefault();
        close.setFocused(true);
        close.activate();
      };
      keyboard.on("keydown", onConfirm);
      this.modal.once(Phaser.GameObjects.Events.DESTROY, () => keyboard.off("keydown", onConfirm));
    }
  }

  get isOpen(): boolean {
    return this.modal.active && !this.modal.isClosing;
  }

  close(): void {
    this.modal.close();
  }
}
