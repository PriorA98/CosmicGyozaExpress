// Screenshot harness: captures repeatable showcase states across viewports.
//
// Usage (dev server must be running: npm run dev):
//   node e2e/capture.mjs [--states=all|id,id] [--viewports=desktop,phoneLandscape] [--label=name]
//                        [--seed=7] [--url=http://127.0.0.1:5173/] [--fps-ms=2000]
// Viewports: desktop, wide, laptop, tablet, phoneLandscape, phonePortrait, phoneLandscapeTouch (touch emulation).
// A capture interrupted by a page reload (Vite HMR) is retried once; the JSON records `attempts`.
//
// Output: e2e/out/<label>/<state>@<viewport>.png + .json, and e2e/out/<label>/summary.json
import {
  DEFAULT_URL,
  VIEWPORTS,
  attachPageLogs,
  contextOptions,
  ensureDir,
  isReloadInterruption,
  launchBrowser,
  parseArgs,
  probeSnapshot,
  sampleFrames,
  seededRandomInitScript,
  summarizeErrors,
  timestampLabel,
  waitForProbe,
  waitForScene,
  writeJson,
} from "./lib/harness.mjs";

const args = parseArgs(process.argv);
const baseUrl = args.url ?? DEFAULT_URL;
const label = args.label ?? timestampLabel();
const outDir = `e2e/out/${label}`;
const seed = Number(args.seed ?? 7);
const fpsMs = Number(args["fps-ms"] ?? 2000);
const viewportNames = (args.viewports ?? "desktop").split(",").filter(Boolean);

for (const name of viewportNames) {
  if (!VIEWPORTS[name]) {
    console.error(`unknown viewport "${name}". known: ${Object.keys(VIEWPORTS).join(", ")}`);
    process.exit(2);
  }
}

ensureDir(outDir);
const browser = await launchBrowser();
const results = [];

try {
  const showcases = await listShowcases();
  const wanted = !args.states || args.states === "all" ? showcases.map((s) => s.id) : args.states.split(",");
  const unknown = wanted.filter((id) => !showcases.some((s) => s.id === id));
  if (unknown.length > 0) throw new Error(`unknown showcase ids: ${unknown.join(", ")}`);

  for (const id of wanted) {
    const showcase = showcases.find((s) => s.id === id);
    for (const viewportName of viewportNames) {
      let record = await capture(showcase, viewportName);
      if (record.status !== "ok" && isReloadInterruption(record.error)) {
        console.log(`retry  ${showcase.id}@${viewportName} (page reloaded under the harness)`);
        record = await capture(showcase, viewportName, 2);
      }
      results.push(record);
    }
  }
} finally {
  await browser.close();
}

const summary = {
  label,
  url: baseUrl,
  seed,
  capturedAt: new Date().toISOString(),
  totals: {
    captures: results.length,
    failedCaptures: results.filter((r) => r.status !== "ok").length,
    retriedCaptures: results.filter((r) => r.attempts > 1).length,
    runtimeErrors: results.reduce((sum, r) => sum + (r.errors?.runtimeErrorCount ?? 0), 0),
    failedAssets: [...new Set(results.flatMap((r) => [...(r.probe?.assetFailures ?? []), ...(r.probeAfterPerf?.assetFailures ?? [])]))],
    minAvgFps: Math.min(...results.map((r) => r.perf?.avgFps ?? Infinity)),
    worstP95FrameMs: Math.max(...results.map((r) => r.perf?.p95FrameMs ?? 0)),
  },
  captures: results.map((r) => ({
    id: r.id,
    viewport: r.viewport,
    status: r.status,
    png: r.png,
    runtimeErrors: r.errors?.runtimeErrorCount ?? null,
    failedAssets: r.errors?.failedAssetCount ?? null,
    avgFps: r.perf?.avgFps ?? null,
    p95FrameMs: r.perf?.p95FrameMs ?? null,
    error: r.error ?? null,
  })),
};
writeJson(`${outDir}/summary.json`, summary);
console.log(JSON.stringify(summary.totals, null, 2));
console.log(`wrote ${results.length} captures to ${outDir}`);

async function listShowcases() {
  const context = await browser.newContext({ viewport: VIEWPORTS.desktop });
  const page = await context.newPage();
  try {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await waitForProbe(page);
    return await page.evaluate(() => window.__CGE__.showcases);
  } finally {
    await context.close();
  }
}

async function capture(showcase, viewportName, attempt = 1) {
  const viewport = VIEWPORTS[viewportName];
  const stem = `${showcase.id}@${viewportName}`;
  const context = await browser.newContext(contextOptions(viewportName));
  await context.addInitScript(seededRandomInitScript(seed));
  const page = await context.newPage();
  const log = attachPageLogs(page);
  const record = { id: showcase.id, viewport: viewportName, size: viewport, description: showcase.description, attempts: attempt };
  const held = showcase.hold ?? [];

  try {
    const url = new URL(baseUrl);
    url.searchParams.set("showcase", showcase.id);
    await page.goto(url.toString(), { waitUntil: "domcontentloaded" });
    await waitForProbe(page);
    await waitForScene(page, showcase.sceneKey);

    const keys = held;
    for (const key of keys) await page.keyboard.down(key);
    await page.waitForTimeout(showcase.settleMs);
    await page.evaluate(() => window.__CGE__.pauseAll());
    await page.waitForTimeout(80);

    record.png = `${stem}.png`;
    await page.screenshot({ path: `${outDir}/${record.png}` });
    // Probe while still paused so the JSON describes the frame in the PNG (events after the
    // screenshot, e.g. a ship falling once keys are released, land in probeAfterPerf instead).
    record.probe = await probeSnapshot(page);

    // `freezeDuringPerf` keeps the scene paused while frames are sampled, for states whose
    // post-screenshot motion would leave the scene (e.g. the landing window completing).
    if (!showcase.freezeDuringPerf) await page.evaluate(() => window.__CGE__.resumeAll());
    for (const key of keys) await page.keyboard.up(key);
    record.perf = await sampleFrames(page, fpsMs);
    record.probeAfterPerf = await probeSnapshot(page);
    record.status = "ok";
  } catch (error) {
    record.status = "failed";
    record.error = error instanceof Error ? error.message : String(error);
    try {
      record.png = `${stem}.failed.png`;
      await page.screenshot({ path: `${outDir}/${record.png}` });
      record.probe = await probeSnapshot(page);
    } catch {
      // page may be unusable; keep the error
    }
  } finally {
    record.log = log;
    record.errors = summarizeErrors(log, record.probe);
    writeJson(`${outDir}/${stem}.json`, record);
    await context.close();
  }

  const fps = record.perf ? `${record.perf.avgFps.toFixed(1)}fps p95 ${record.perf.p95FrameMs.toFixed(1)}ms` : "no perf";
  console.log(`${record.status.padEnd(6)} ${stem.padEnd(40)} errors=${record.errors.runtimeErrorCount} assets=${record.errors.failedAssetCount} ${fps}`);
  return record;
}
