// Shared helpers for the Cosmic Gyoza Express e2e harness (dev-only tooling, not shipped).
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export const DEFAULT_URL = process.env.CGE_URL ?? "http://127.0.0.1:5173/";

export const VIEWPORTS = {
  desktop: { width: 1280, height: 720 },
  wide: { width: 1920, height: 1080 },
  laptop: { width: 1366, height: 768 },
  tablet: { width: 1024, height: 768 },
  phoneLandscape: { width: 844, height: 390 },
  phonePortrait: { width: 390, height: 844 },
};

/**
 * Viewports that emulate a touch phone (hasTouch + isMobile), so Phaser's device.input.touch is
 * true and touch-pad HUD layouts render. Plain `phoneLandscape` stays keyboard-first.
 */
export const TOUCH_VIEWPORTS = new Set(["phoneLandscapeTouch", "phoneSmallTouch", "phoneLargeTouch", "phonePortraitTouch", "phoneBrowserBarTouch", "phoneSmallBrowserTouch"]);
VIEWPORTS.phoneLandscapeTouch = { width: 844, height: 390 };
/** Real-device-like touch phones with their device pixel ratio (iPhone SE / iPhone 14 Pro Max / portrait). */
VIEWPORTS.phoneSmallTouch = { width: 667, height: 375, dpr: 2 };
VIEWPORTS.phoneLargeTouch = { width: 932, height: 430, dpr: 3 };
VIEWPORTS.phonePortraitTouch = { width: 390, height: 844, dpr: 3 };
/** Landscape phones with the browser toolbar/address bar visible (shorter than the screen). */
VIEWPORTS.phoneBrowserBarTouch = { width: 844, height: 340, dpr: 3 };
VIEWPORTS.phoneSmallBrowserTouch = { width: 667, height: 320, dpr: 2 };

/** Playwright context options for a named viewport. */
export function contextOptions(viewportName) {
  const { width, height, dpr = 1 } = VIEWPORTS[viewportName];
  const touch = TOUCH_VIEWPORTS.has(viewportName);
  return { viewport: { width, height }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch };
}

/**
 * True when a failure came from the page navigating/reloading under the harness (e.g. Vite HMR
 * full reload while files are being edited), not from the game itself. Such runs are retried once.
 */
export function isReloadInterruption(message) {
  return /Execution context was destroyed|__CGE__|Target (page, context or browser )?closed|frame was detached|because of a navigation/i.test(
    String(message ?? ""),
  );
}

export function parseArgs(argv) {
  const args = {};
  for (const raw of argv.slice(2)) {
    const match = /^--([^=]+)(?:=(.*))?$/.exec(raw);
    if (match) args[match[1]] = match[2] ?? "true";
  }
  return args;
}

export function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

export function writeJson(path, value) {
  ensureDir(dirname(path));
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function timestampLabel() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

export async function launchBrowser() {
  return chromium.launch({
    headless: true,
    args: ["--use-angle=d3d11", "--enable-gpu-rasterization", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"],
  });
}

/** Deterministic Math.random so generated starfields and particles are reproducible. */
export function seededRandomInitScript(seed) {
  return `(() => {
    let a = ${Number(seed) >>> 0} || 1;
    Math.random = function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  })();`;
}

/** Attaches console/network listeners and returns the live log object. */
export function attachPageLogs(page) {
  const log = { consoleErrors: [], consoleWarnings: [], pageErrors: [], failedRequests: [], badResponses: [] };
  page.on("console", (message) => {
    const entry = { type: message.type(), text: message.text() };
    if (message.type() === "error") log.consoleErrors.push(entry);
    else if (message.type() === "warning") log.consoleWarnings.push(entry);
  });
  page.on("pageerror", (error) => log.pageErrors.push({ message: error.message, stack: error.stack }));
  page.on("requestfailed", (request) =>
    log.failedRequests.push({ url: request.url(), failure: request.failure()?.errorText ?? "unknown" }),
  );
  page.on("response", (response) => {
    if (response.status() >= 400) log.badResponses.push({ url: response.url(), status: response.status() });
  });
  return log;
}

export async function waitForProbe(page, timeoutMs = 20000) {
  await page.waitForFunction(() => Boolean(window.__CGE__), null, { timeout: timeoutMs });
}

export async function waitForScene(page, sceneKey, timeoutMs = 20000, minFrames = 3) {
  await page.waitForFunction(
    ([key, frames]) => Boolean(window.__CGE__?.isSceneReady(key, frames)),
    [sceneKey, minFrames],
    { timeout: timeoutMs, polling: 50 },
  );
}

export async function probeSnapshot(page) {
  return page.evaluate(() => {
    const probe = window.__CGE__;
    if (!probe) return null;
    return {
      activeShowcase: probe.activeShowcase,
      activeScenes: probe.activeScenes(),
      assetFailures: [...probe.assetFailures],
      fontFailures: [...probe.fontFailures],
      actualFps: probe.actualFps(),
      eventCount: probe.events.length,
      recentEvents: probe.events.slice(-40).map((entry) => entry.event),
      // Save diagnostics (registered at boot) and the result reveal state (DeliveryResultScene only).
      save: probe.getState("save") ?? null,
      result: probe.getState("result") ?? null,
    };
  });
}

export async function sampleFrames(page, durationMs = 2000) {
  return page.evaluate((ms) => window.__CGE__.sampleFrames(ms), durationMs);
}

export function summarizeErrors(log, probe) {
  // Phaser prints a version banner via console.log; only errors/page errors/failed loads count.
  const ignorable = (text) => /favicon\.ico/.test(text);
  const isAssetLoadMessage = (text) => /Failed to process file|Failed to load resource/.test(text);
  const consoleErrors = log.consoleErrors.filter((entry) => !ignorable(entry.text) && !isAssetLoadMessage(entry.text));
  const badResponses = log.badResponses.filter((entry) => !ignorable(entry.url));
  return {
    runtimeErrorCount: consoleErrors.length + log.pageErrors.length,
    failedAssetCount: (probe?.assetFailures.length ?? 0) + log.failedRequests.length + badResponses.length,
    fontFailureCount: probe?.fontFailures.length ?? 0,
  };
}
