/**
 * Phone fullscreen affordance (page shell, outside the canvas).
 *
 * On touch phones the browser's address/tool bars eat a third of a landscape screen. Where the
 * Fullscreen API exists (Android browsers; not iPhone Safari, which uses "Add to Home Screen" via the
 * web app manifest instead), the title screen shows a small "full screen" button in the top-right
 * corner. Tapping it enters fullscreen and asks for a landscape orientation lock. The button only
 * appears on the title screen (other scenes keep their own top-right controls), hides while already in
 * fullscreen, and every browser call is guarded so unsupported browsers simply never show it.
 */
import type Phaser from "phaser";
import { onGameEvent } from "./events";

type FullscreenDocument = Document & {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
};

type FullscreenElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

type LockableOrientation = ScreenOrientation & { lock?: (orientation: "landscape") => Promise<void> };

export function canOfferFullscreen(win: Window = window): boolean {
  const doc = win.document as FullscreenDocument;
  const coarse = typeof win.matchMedia === "function" && win.matchMedia("(pointer: coarse)").matches;
  const enabled = Boolean(doc.fullscreenEnabled ?? doc.webkitFullscreenEnabled);
  const standalone = typeof win.matchMedia === "function" && win.matchMedia("(display-mode: fullscreen), (display-mode: standalone)").matches;
  return coarse && enabled && !standalone;
}

function isFullscreen(doc: FullscreenDocument): boolean {
  return Boolean(doc.fullscreenElement ?? doc.webkitFullscreenElement);
}

async function enterFullscreen(): Promise<void> {
  const root = document.documentElement as FullscreenElement;
  try {
    if (root.requestFullscreen) await root.requestFullscreen({ navigationUI: "hide" });
    else await root.webkitRequestFullscreen?.();
  } catch {
    return; // denied or unsupported: the game keeps running in the page
  }
  try {
    await (screen.orientation as LockableOrientation | undefined)?.lock?.("landscape");
  } catch {
    // orientation lock is optional (not all browsers allow it)
  }
}

export function installFullscreenButton(game: Phaser.Game): () => void {
  if (typeof window === "undefined" || !canOfferFullscreen()) return () => undefined;
  const doc = document as FullscreenDocument;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "fullscreen-button";
  button.setAttribute("aria-label", "Play in full screen");
  button.innerHTML = '<span class="fullscreen-button__icon" aria-hidden="true"></span><span>full screen</span>';
  button.hidden = true;
  document.querySelector(".app-shell")?.appendChild(button);

  let onTitle = false;
  const sync = (): void => {
    button.hidden = !onTitle || isFullscreen(doc);
  };
  const off = onGameEvent(game, (event) => {
    if (event.type !== "scene:enter") return;
    onTitle = event.scene === "TitleScene";
    sync();
  });
  const onClick = (event: Event): void => {
    event.preventDefault();
    event.stopPropagation();
    void enterFullscreen().then(sync);
  };
  button.addEventListener("click", onClick);
  document.addEventListener("fullscreenchange", sync);
  document.addEventListener("webkitfullscreenchange", sync);
  return () => {
    off();
    button.removeEventListener("click", onClick);
    document.removeEventListener("fullscreenchange", sync);
    document.removeEventListener("webkitfullscreenchange", sync);
    button.remove();
  };
}
