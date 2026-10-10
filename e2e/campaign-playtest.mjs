// Real-keyboard full-route campaign playtest. Dev server must already be running.
// node e2e/campaign-playtest.mjs --mission=all --landing=soft --incident-first=true
import {
  DEFAULT_URL, attachPageLogs, contextOptions, ensureDir, isReloadInterruption, launchBrowser, parseArgs,
  probeSnapshot, seededRandomInitScript, summarizeErrors, timestampLabel,
  waitForProbe, waitForScene, writeJson,
} from "./lib/harness.mjs";
import { campaignData, cyclePeriod, keyboardPilot, pilotInput, readPilotState, routePilot } from "./lib/campaignPilot.mjs";

const args = parseArgs(process.argv);
const missions = [
  { id: "bento-belt", showcase: "bento-flight-start", timeout: 180000 },
  { id: "matcha-nebula", showcase: "matcha-flight-start", timeout: 180000 },
  { id: "black-hole-bakery", showcase: "bakery-flight-start", timeout: 210000 },
  { id: "im-fine", showcase: "im-fine-flight-start", timeout: 210000 },
  { id: "home-delivery", showcase: "home-flight-start", timeout: 120000 },
];
const profile = args.landing ?? "soft";
const incidentFirst = args["incident-first"] === "true";
const phase = Number(args.phase ?? 0);
const viewport = args.viewport ?? "desktop";
const selected = args.mission === "all" ? missions : missions.filter((m) => m.id === args.mission);
if (!selected.length || !["soft", "bumpy"].includes(profile) || !Number.isFinite(phase) || phase < 0 || phase > 1 ||
    !["desktop", "phoneLandscapeTouch"].includes(viewport) ||
    (args["incident-first"] !== undefined && !["true", "false"].includes(args["incident-first"]))) {
  console.error("Usage: --mission=<campaign-id|all> [--landing=soft|bumpy] [--incident-first=true|false] [--phase=0..1] [--viewport=desktop|phoneLandscapeTouch] [--label=name]");
  process.exit(1);
}
const label = args.label ?? `campaign-${profile}-${timestampLabel()}`;
if (!/^[a-zA-Z0-9_.-]+$/.test(label)) throw new Error("Label must be a simple directory name");
const outDir = `e2e/out/${label}`;
ensureDir(outDir);
const data = campaignData();
const autopilot = routePilot();
const browser = await launchBrowser();
const reports = [];
try {
  for (const mission of selected) {
    let report = await runMission(mission, 1);
    if (!report.passed && (isReloadInterruption(report.harnessError) || report.probe === null)) {
      writeJson(`${outDir}/campaign-${mission.id}-${profile}-interrupted-attempt.json`, report);
      console.log(`${mission.id}: retrying once after dev-page reload interruption`);
      report = await runMission(mission, 2);
    }
    reports.push(report);
  }
} finally {
  await browser.close();
  writeJson(`${outDir}/summary.json`, { label, profile, incidentFirst, phase, viewport,
    passed: reports.length === selected.length && reports.every((r) => r.passed),
    missions: reports.map((r) => ({ missionId: r.missionId, passed: r.passed,
      arrivalSeconds: r.flight?.seconds ?? null, crashes: r.flight?.crashes ?? null,
      retrySeconds: r.retry?.incidentToRetrySeconds ?? null, result: r.landing?.result ?? null,
      avgFps: r.perf.avgFps, failures: r.checks.filter((c) => !c.pass) })) });
}
process.exitCode = reports.length === selected.length && reports.every((r) => r.passed) ? 0 : 1;

async function runMission(config, attempt) {
  const context = await browser.newContext(contextOptions(viewport));
  await context.addInitScript(seededRandomInitScript(11));
  const page = await context.newPage();
  const log = attachPageLogs(page);
  const pilot = keyboardPilot(page);
  const definition = data.resolveMission(config.id);
  const route = data.routeForMission(config.id);
  const report = { missionId: config.id, label, profile, incidentFirst, phase, viewport, attempt,
    startedAt: new Date().toISOString(), checks: [], steps: [], trajectory: [], perf: {} };
  const fps = [];
  const check = (name, pass, detail = null) => {
    report.checks.push({ name, pass: Boolean(pass), detail });
    console.log(`${config.id}: ${pass ? "PASS" : "FAIL"} ${name}${detail ? ` ${JSON.stringify(detail)}` : ""}`);
  };
  const shot = async (step) => {
    const file = `campaign-${config.id}-${profile}-${step}.png`;
    await page.screenshot({ path: `${outDir}/${file}` });
    report.steps.push({ step, file });
  };
  let lastTraceAt = 0;
  const trace = (kind, snapshot, controls = null) => {
    if (Date.now() - lastTraceAt < 1000) return;
    lastTraceAt = Date.now();
    fps.push(snapshot.fps);
    report.trajectory.push({ at: Date.now(), kind, state: snapshot.state, controls });
  };
  try {
    const url = new URL(DEFAULT_URL);
    url.searchParams.set("showcase", config.showcase);
    await page.goto(url.href, { waitUntil: "domcontentloaded" });
    await waitForProbe(page);
    await waitForScene(page, "FlightScene", 20000, 5);
    check("correct mission at authored start", (await readPilotState(page, "flight")).state?.missionId === config.id);
    await shot("01-start");
    const offsetMs = phase * cyclePeriod(route);
    const initial = await readPilotState(page, "flight");
    report.phaseWait = { requestedMs: offsetMs, startSimTimeMs: initial.state.simTimeMs };
    const phaseDeadline = Date.now() + offsetMs * 3 + 5000;
    while ((await readPilotState(page, "flight")).state.simTimeMs - initial.state.simTimeMs < offsetMs) {
      if (Date.now() > phaseDeadline) throw new Error("Simulation clock did not advance during phase wait");
      await page.waitForTimeout(50);
    }
    report.phaseWait.endSimTimeMs = (await readPilotState(page, "flight")).state.simTimeMs;
    const started = Date.now();
    const progress = autopilot.createPilotProgress();
    let reached = false;
    let lastFlight = initial.state;
    let approachShot = false;
    while (Date.now() - started < config.timeout) {
      const snapshot = await readPilotState(page, "flight");
      if (snapshot.scenes.includes("LandingScene")) { reached = true; break; }
      const s = snapshot.state;
      if (!s || !snapshot.scenes.includes("FlightScene")) {
        throw new Error(`Lost FlightScene before arrival; active scenes: ${JSON.stringify(snapshot.scenes)}`);
      }
      lastFlight = s;
      if (s.mode !== "flying") progress.lastSimMs = null;
      const controls = s.mode === "flying" ? autopilot.pilotFlightControls(pilotInput(s), route, definition.pilotHints, progress) : {};
      trace("flight", snapshot, controls);
      await pilot.apply(controls);
      if (!approachShot && progress.waypoint === definition.pilotHints.waypoints.length - 1) {
        approachShot = true; await shot("02-approach");
      }
      await page.waitForTimeout(35);
    }
    await pilot.release();
    report.flight = { reachedLanding: reached, seconds: (Date.now() - started) / 1000,
      simTimeMs: lastFlight.simTimeMs, crashes: lastFlight.routeCrashes, finalState: lastFlight };
    check("route reached LandingScene within timeout", reached, { seconds: report.flight.seconds, crashes: report.flight.crashes });
    if (!reached) throw new Error(`Flight timeout at (${lastFlight.ship.x}, ${lastFlight.ship.y}), sim ${lastFlight.simTimeMs} ms`);
    await waitForScene(page, "LandingScene");
    await shot("03-landing-start");
    if (incidentFirst) {
      const dropStarted = Date.now();
      let incidentAt = null;
      let stayedInLanding = true;
      let retry = null;
      while (Date.now() - dropStarted < 15000) {
        const snapshot = await readPilotState(page, "landing");
        stayedInLanding &&= snapshot.scenes.includes("LandingScene") && !snapshot.scenes.includes("FlightScene");
        trace("incident-retry", snapshot);
        if (snapshot.state?.phase.kind === "incident" && incidentAt === null) {
          incidentAt = Date.now(); await shot("04-incident");
        }
        if (incidentAt !== null && snapshot.state?.phase.kind === "descending") {
          retry = { incidentToRetrySeconds: (Date.now() - incidentAt) / 1000,
            stayedInLanding, incidents: snapshot.state.landingIncidents, state: snapshot.state };
          break;
        }
        await page.waitForTimeout(35);
      }
      report.retry = retry ?? { incidentToRetrySeconds: null, sawIncident: incidentAt !== null, stayedInLanding };
      check("incident -> controllable landing-only retry <= 2.5 s", retry && retry.stayedInLanding && retry.incidentToRetrySeconds <= 2.5,
        { seconds: retry?.incidentToRetrySeconds ?? null, stayedInLanding });
      if (!retry) throw new Error("Incident/retry was not observed");
    }
    const landingStarted = Date.now();
    let result = null;
    let lastLanding = null;
    let sawResult = false;
    while (Date.now() - landingStarted < 45000) {
      const snapshot = await readPilotState(page, "landing");
      const s = snapshot.state;
      if (s) lastLanding = s;
      if (s?.phase.kind === "settling" && result === null) {
        result = s.phase.result; await pilot.release(); await shot("05-touchdown");
      }
      if (snapshot.scenes.includes("DeliveryResultScene")) { sawResult = true; break; }
      const controls = s?.phase.kind === "descending" ? autopilot.pilotLandingControls({ state: s.state, pad: s.pad, wind: s.wind, tuning: s.tuning, zone: s.zone }, profile, definition.pilotHints.landing) : {};
      trace("landing", snapshot, controls);
      await pilot.apply(controls);
      await page.waitForTimeout(30);
    }
    await pilot.release();
    report.landing = { result, seconds: (Date.now() - landingStarted) / 1000, finalState: lastLanding };
    check(`landing result matches ${profile}`, result === profile, { result });
    check("DeliveryResultScene shown", sawResult);
    if (sawResult) { await waitForScene(page, "DeliveryResultScene"); await page.waitForTimeout(1200); await shot("06-result"); }
    const save = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem("cosmic-gyoza-express.save.v1") ?? "null"); }
      catch { return null; }
    });
    report.save = save;
    check("save contains completed mission", save?.completedMissions?.includes(config.id));
    check("save contains next unlocked mission", definition.unlocksMissionIds.every((id) => save?.unlockedMissions?.includes(id)),
      { next: definition.unlocksMissionIds, unlockedMissions: save?.unlockedMissions });
  } catch (error) {
    report.harnessError = error instanceof Error ? error.message : String(error);
    check("playtest completed without exception", false, report.harnessError);
    await shot("99-failure").catch(() => {});
  } finally {
    await pilot.release().catch(() => {});
    report.probe = await probeSnapshot(page).catch(() => null);
    check("dev probe available at end", report.probe !== null);
    report.errors = summarizeErrors(log, report.probe);
    report.log = log;
    check("zero runtime errors and failed assets", report.errors.runtimeErrorCount === 0 && report.errors.failedAssetCount === 0 && report.errors.fontFailureCount === 0, report.errors);
    report.perf = { avgFps: fps.length ? fps.reduce((sum, value) => sum + value, 0) / fps.length : null,
      samples: fps.length, method: "actualFps sampled once per second during real-time pilot; screenshots included", browser: "headless Chromium", viewport };
    report.finishedAt = new Date().toISOString();
    report.passed = report.checks.every((c) => c.pass);
    writeJson(`${outDir}/campaign-${config.id}-${profile}.json`, report);
    await context.close();
  }
  return report;
}
