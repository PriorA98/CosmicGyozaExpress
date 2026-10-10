// Full-loop playtest driven through real keyboard input (closed-loop "pilot" reading dev state).
//
// title -> flight (autopilot to the Tea Moon arrival gate) -> landing -> delivery result -> reload
//
// Usage (dev server running):
//   node e2e/playtest.mjs [--landing=soft|bumpy] [--incident-first=true] [--label=name] [--viewport=desktop]
//
// Writes e2e/out/<label>/playtest-<landing>.json plus step screenshots. Exit code 1 on any failed check.
// A run killed by a page reload under the harness (Vite HMR "Execution context was destroyed") is
// re-run once in a fresh process (`--attempt=2`); the report records `attempt`.
import { campaignData, routePilot } from "./lib/campaignPilot.mjs";
import { spawnSync } from "node:child_process";
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
const landingProfile = args.landing === "bumpy" ? "bumpy" : "soft";
const incidentFirst = args["incident-first"] !== "false";
const label = args.label ?? `playtest-${timestampLabel()}`;
const outDir = `e2e/out/${label}`;
const viewportName = VIEWPORTS[args.viewport] ? args.viewport : "desktop";
const attempt = Number(args.attempt ?? 1);
const SAVE_KEY = "cosmic-gyoza-express.save.v1";
const DOCK_HOLD = { x: 2775, y: 850 };
ensureDir(outDir);

const report = {
  label,
  landingProfile,
  incidentFirst,
  attempt,
  startedAt: new Date().toISOString(),
  checks: [],
  steps: [],
  perf: {},
};
const check = (name, pass, detail = null) => {
  report.checks.push({ name, pass: Boolean(pass), detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}${detail ? `  ${JSON.stringify(detail)}` : ""}`);
};

const browser = await launchBrowser();
const context = await browser.newContext(contextOptions(viewportName));
await context.addInitScript(seededRandomInitScript(11));
const page = await context.newPage();
const log = attachPageLogs(page);
const held = new Set();

async function key(name, down) {
  if (down && !held.has(name)) {
    held.add(name);
    await page.keyboard.down(name);
  } else if (!down && held.has(name)) {
    held.delete(name);
    await page.keyboard.up(name);
  }
}
async function releaseAll() {
  for (const name of [...held]) await key(name, false);
}
async function shot(name) {
  const file = `${name}.png`;
  await page.screenshot({ path: `${outDir}/${file}` });
  report.steps.push({ name, file, at: new Date().toISOString() });
}
const state = (name) => page.evaluate((n) => window.__CGE__.getState(n), name);
const activeScenes = () => page.evaluate(() => window.__CGE__.activeScenes());
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

let harnessError = null;
try {
  // 1. Fresh boot to title
  await page.goto(DEFAULT_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate((k) => localStorage.removeItem(k), SAVE_KEY);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForProbe(page);
  await waitForScene(page, "TitleScene", 20000, 10);
  await page.waitForTimeout(900);
  await shot("01-title");

  await page.keyboard.press("Enter");
  await waitForScene(page, "FlightScene", 15000, 5);
  check("title -> flight via Enter", true);
  await page.waitForTimeout(400);
  await shot("02-flight-start");
  report.perf.flight = await sampleFrames(page, 1500);

  // 2. Fly to the arrival gate
  const flight = await flyToArrival();
  check("flight reached arrival gate and entered LandingScene", flight.reachedLanding, flight);

  // 3. Landing, optionally crashing first to verify landing-only retry
  await waitForScene(page, "LandingScene", 15000, 3);
  await page.waitForTimeout(300);
  await shot("04-landing-start");
  report.perf.landing = await sampleFrames(page, 1500);

  if (incidentFirst) {
    const retry = await crashAndRetry();
    check("landing incident triggers quick landing-only retry (no route replay)", retry.ok, retry);
  }

  const landed = await landShip(landingProfile);
  check(`landing completes as ${landingProfile}`, landed.ok, landed);

  // 4. Result + save
  await waitForScene(page, "DeliveryResultScene", 15000, 5);
  await page.waitForTimeout(1500);
  await shot("07-result");
  const save = await page.evaluate((k) => {
    try {
      return JSON.parse(localStorage.getItem(k) ?? "null");
    } catch {
      return "unparseable";
    }
  }, SAVE_KEY);
  check("save records tea-moon completion", Array.isArray(save?.completedMissions) && save.completedMissions.includes("tea-moon"), {
    completedMissions: save?.completedMissions,
    totalDeliveries: save?.stats?.totalDeliveries,
  });

  // 5. Reload and confirm persistence
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForProbe(page);
  await waitForScene(page, "TitleScene", 20000, 10);
  await page.waitForTimeout(1200);
  await shot("08-title-after-reload");
  const saveAfter = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null"), SAVE_KEY);
  check("completion persists across reload", saveAfter?.completedMissions?.includes("tea-moon"));
  const titleState = await state("title");
  report.titleStateAfterReload = titleState ?? null;
  if (titleState !== undefined && titleState !== null) {
    check("title reflects saved completion", Boolean(titleState?.teaMoonDelivered), titleState);
  } else {
    check("title reflects saved completion (title dev state not registered)", false, "TitleScene should registerDevState('title', ...)");
  }
} catch (error) {
  harnessError = error instanceof Error ? error.message : String(error);
  check("playtest ran without harness exception", false, harnessError);
  try {
    await shot("99-failure");
  } catch {
    // ignore
  }
} finally {
  await releaseAll().catch(() => {});
  const probe = await probeSnapshot(page).catch(() => null);
  report.probe = probe;
  report.log = log;
  report.errors = summarizeErrors(log, probe);
  check("zero runtime errors during playtest", report.errors.runtimeErrorCount === 0, report.errors);
  report.finishedAt = new Date().toISOString();
  report.passed = report.checks.every((c) => c.pass);
  writeJson(`${outDir}/playtest-${landingProfile}.json`, report);
  await browser.close();
  console.log(`playtest ${report.passed ? "PASSED" : "FAILED"} -> ${outDir}`);
  if (!report.passed && attempt < 2 && isReloadInterruption(harnessError)) {
    console.log("retrying once: the page reloaded under the harness");
    const rerun = spawnSync(process.execPath, [...process.argv.slice(1), "--attempt=2"], { stdio: "inherit" });
    process.exit(rerun.status ?? 1);
  }
  process.exit(report.passed ? 0 : 1);
}

// --- Pilots --------------------------------------------------------------------------------

/** Safe lane between the route asteroids (route data: src/data/flightPrototypeRoute.ts). */
function laneY(x) {
  if (x < 1000) return 920;
  if (x < 1900) return 900;
  if (x < 2300) return 870;
  return 850;
}

/** Cruise along the safe lane (clear of all route asteroids), brake inside the ring, turn bottom to the moon. */
async function flyToArrival() {
  const started = Date.now();
  let phase = "cruise";
  let tookApproachShot = false;
  while (Date.now() - started < 60000) {
    const scenes = await activeScenes();
    if (scenes.includes("LandingScene")) {
      await releaseAll();
      return { reachedLanding: true, seconds: (Date.now() - started) / 1000, finalPhase: phase };
    }
    const s = await state("flight");
    if (!s) {
      await page.waitForTimeout(50);
      continue;
    }
    if (s.mode !== "flying") {
      await releaseAll();
      await page.waitForTimeout(100);
      continue;
    }
    const ship = s.ship;
    const speed = Math.hypot(ship.velocityX, ship.velocityY);
    if (process.env.CGE_PILOT_DEBUG && Math.random() < 0.05) {
      console.log(phase, s.docking, ship.x.toFixed(0), ship.y.toFixed(0), ship.rotation.toFixed(2), speed.toFixed(0));
    }

    if (phase === "cruise") {
      // steer nose toward a point ahead on the safe lane
      const targetY = laneY(ship.x + 200);
      const heading = Math.atan2(targetY - ship.y, 260); // screen radians, 0 = +x
      const err = wrapAngle(heading + Math.PI / 2 - ship.rotation); // ship rotation 0 = nose up
      await key("KeyD", err > 0.05);
      await key("KeyA", err < -0.05);
      await key("KeyW", Math.abs(err) < 0.3 && speed < 210);
      await key("KeyS", false);
      if (!tookApproachShot && ship.x > 2350) {
        tookApproachShot = true;
        await shot("03-flight-approach");
      }
      if (ship.x > 2450) phase = "dock";
    } else {
      // go to a hold point inside the delivery ring, stop, then turn the bottom toward the moon
      const dx = DOCK_HOLD.x - ship.x;
      const dy = DOCK_HOLD.y - ship.y;
      const dist = Math.hypot(dx, dy);
      const speedLimit = Math.min(160, 12 + dist * 0.7);
      if (dist > 26) {
        const err = wrapAngle(Math.atan2(dy, dx) + Math.PI / 2 - ship.rotation);
        await key("KeyD", err > 0.05);
        await key("KeyA", err < -0.05);
        await key("KeyW", Math.abs(err) < 0.25 && speed < speedLimit);
        await key("KeyS", speed > speedLimit + 8 || (Math.abs(err) > 0.6 && speed > 12));
      } else {
        await key("KeyW", false);
        await key("KeyS", speed > 6);
        const err = wrapAngle(-Math.PI / 2 - ship.rotation);
        await key("KeyD", err > 0.06);
        await key("KeyA", err < -0.06);
      }
    }
    await page.waitForTimeout(30);
  }
  await releaseAll();
  return { reachedLanding: false, seconds: (Date.now() - started) / 1000, finalPhase: phase };
}

async function crashAndRetry() {
  await releaseAll();
  const started = Date.now();
  let sawIncident = false;
  let incidentShot = false;
  let incidentAt = 0;
  while (Date.now() - started < 15000) {
    const s = await state("landing");
    if (s?.phase?.kind === "incident") {
      if (!sawIncident) incidentAt = Date.now();
      sawIncident = true;
      if (!incidentShot) {
        incidentShot = true;
        await page.waitForTimeout(250);
        await shot("05-landing-incident");
      }
    }
    if (sawIncident && s?.phase?.kind === "descending") {
      const scenes = await activeScenes();
      // Quick retry = incident -> control again, landing-only. (retrySeconds also counts the free-fall.)
      const incidentToRetrySeconds = (Date.now() - incidentAt) / 1000;
      return {
        ok: scenes.includes("LandingScene") && !scenes.includes("FlightScene") && incidentToRetrySeconds <= 2.5,
        retrySeconds: (Date.now() - started) / 1000,
        incidentToRetrySeconds,
        incidents: s.landingIncidents,
      };
    }
    await page.waitForTimeout(40);
  }
  return { ok: false, sawIncident, seconds: (Date.now() - started) / 1000 };
}

/** Bang-bang descent controller with stabilizer assist; bumpy profile lands faster. */
async function landShip(profile) {
  const started = Date.now();
  let shotLow = false;
  const { pilotLandingControls } = routePilot();
  const hints = campaignData().resolveMission("tea-moon").pilotHints.landing;
  while (Date.now() - started < 40000) {
    const scenes = await activeScenes();
    if (scenes.includes("DeliveryResultScene")) {
      await releaseAll();
      return { ok: true, seconds: (Date.now() - started) / 1000 };
    }
    const s = await state("landing");
    if (!s) {
      await page.waitForTimeout(40);
      continue;
    }
    if (s.phase.kind === "settling") {
      await releaseAll();
      if (!shotLow) {
        shotLow = true;
        await shot("06-landing-settling");
      }
      if (s.phase.result !== profile) {
        await page.waitForTimeout(60);
        return { ok: false, reason: `landed ${s.phase.result}, wanted ${profile}` };
      }
      await page.waitForTimeout(60);
      continue;
    }
    if (s.phase.kind !== "descending") {
      await releaseAll();
      await page.waitForTimeout(60);
      continue;
    }
    const controls = pilotLandingControls(s, profile, hints);
    await key("KeyD", controls.right);
    await key("KeyA", controls.left);
    await key("KeyS", controls.brake);
    await key("KeyW", controls.thrust);
    await page.waitForTimeout(25);
  }
  await releaseAll();
  return { ok: false, reason: "timeout" };
}
