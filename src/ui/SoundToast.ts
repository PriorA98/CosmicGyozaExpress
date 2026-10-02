import type Phaser from "phaser";
import { onGameEvent } from "../game/events";
import { isReducedMotion } from "../fx/feedback";
import { ICON_OVERRIDE_PALETTE, ICON_OVERRIDES, ICON_OVERRIDE_SIZE } from "./iconBitmaps";
import { SOUND_TOAST_TIMING, soundToastAnchor, soundToastContent, type SoundToastContent } from "./soundToastModel";

export { SOUND_TOAST_TIMING, soundToastAnchor, soundToastContent, type SoundToastContent, type ToastAnchor } from "./soundToastModel";

/**
 * Mute feedback (owner: ui). A small warm DOM toast ("sound on" / "sound off" with a pixel
 * speaker) shown over whatever scene is active whenever AudioSystem emits `audio:mute`.
 * DOM keeps it crisp at device resolution and independent of scene lifecycles. Mute itself is
 * in-memory only, so the toast is never persisted. Styles: `.sound-toast` in src/styles/components.css.
 */
type ToastView = {
  readonly root: HTMLDivElement;
  readonly icon: HTMLCanvasElement;
  readonly label: HTMLSpanElement;
  readonly key: HTMLSpanElement;
};

const installed = new WeakMap<Phaser.Game, () => void>();

function paintIcon(canvas: HTMLCanvasElement, name: SoundToastContent["icon"]): void {
  const rows = ICON_OVERRIDES[name];
  const context = canvas.getContext("2d");
  if (!rows || !context) return;
  context.clearRect(0, 0, ICON_OVERRIDE_SIZE, ICON_OVERRIDE_SIZE);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x += 1) {
      const color = ICON_OVERRIDE_PALETTE[row.charAt(x)];
      if (!color) continue;
      context.fillStyle = color;
      context.fillRect(x, y, 1, 1);
    }
  });
}

function createView(doc: Document): ToastView {
  const root = doc.createElement("div");
  root.className = "sound-toast";
  root.setAttribute("role", "status");
  root.setAttribute("aria-live", "polite");
  const icon = doc.createElement("canvas");
  icon.className = "sound-toast__icon";
  icon.width = ICON_OVERRIDE_SIZE;
  icon.height = ICON_OVERRIDE_SIZE;
  icon.setAttribute("aria-hidden", "true");
  const label = doc.createElement("span");
  label.className = "sound-toast__label";
  const key = doc.createElement("span");
  key.className = "sound-toast__key";
  key.setAttribute("aria-hidden", "true");
  root.append(icon, label, key);
  doc.body.append(root);
  return { root, icon, label, key };
}

/**
 * Installs the mute toast for a game (idempotent; safe to call from any scene or main.ts).
 * Returns an uninstall function. Silently does nothing without a DOM.
 */
export function installSoundToast(game: Phaser.Game): () => void {
  const existing = installed.get(game);
  if (existing) return existing;
  if (typeof document === "undefined") return () => undefined;

  let view: ToastView | undefined;
  let hideTimer: number | undefined;
  let removeTimer: number | undefined;

  const show = (muted: boolean): void => {
    try {
      view ??= createView(document);
      const content = soundToastContent(muted);
      paintIcon(view.icon, content.icon);
      view.label.textContent = content.label;
      view.key.textContent = content.keyHint;
      const rect = game.canvas?.getBoundingClientRect();
      const anchor = soundToastAnchor(rect ?? { left: window.innerWidth / 2, top: 0, width: 0, height: 0 });
      const root = view.root;
      root.style.left = `${anchor.left}px`;
      root.style.top = `${anchor.top}px`;
      root.classList.toggle("is-compact", anchor.compact);
      root.classList.toggle("is-muted", muted);
      root.classList.toggle("is-calm", isReducedMotion());
      window.clearTimeout(hideTimer);
      window.clearTimeout(removeTimer);
      root.hidden = false;
      // Restart the entrance on rapid toggles: drop the class, force a style flush, re-add.
      root.classList.remove("is-visible");
      void root.offsetWidth;
      root.classList.add("is-visible");
      hideTimer = window.setTimeout(() => {
        root.classList.remove("is-visible");
        removeTimer = window.setTimeout(() => {
          root.hidden = true;
        }, SOUND_TOAST_TIMING.exitMs);
      }, SOUND_TOAST_TIMING.holdMs);
    } catch {
      // A missing DOM API must never break the game; feedback is optional.
    }
  };

  const unsubscribe = onGameEvent(game, (event) => {
    if (event.type === "audio:mute") show(event.muted);
  });

  const uninstall = (): void => {
    unsubscribe();
    window.clearTimeout(hideTimer);
    window.clearTimeout(removeTimer);
    view?.root.remove();
    view = undefined;
    installed.delete(game);
  };
  installed.set(game, uninstall);
  game.events.once("destroy", uninstall);
  return uninstall;
}
