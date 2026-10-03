// Authored data is evaluated in Node; browser feedback uses only the read-only dev probe.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import ts from "typescript";

const modules = new Map();
function loadData(path) {
  if (modules.has(path)) return modules.get(path);
  const exports = {};
  modules.set(path, exports);
  const { outputText } = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    fileName: path,
  });
  const requireData = (specifier) => {
    if (!specifier.startsWith(".")) throw new Error(`Unexpected data dependency: ${specifier}`);
    return loadData(resolve(dirname(path), `${specifier}.ts`));
  };
  new Function("require", "exports", "module", outputText)(requireData, exports, { exports });
  return exports;
}

export function campaignData() {
  return loadData(resolve("src/data/campaign/index.ts"));
}

export const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
export const wrapAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));

/** Linear closest approach, bounded to visible motion over the next 1.5 seconds. */
export function closestApproach(ship, obstacle, horizon = 1.5, shipRadius = 42) {
  const dx = obstacle.x - ship.x;
  const dy = obstacle.y - ship.y;
  const vx = obstacle.vx - ship.velocityX;
  const vy = obstacle.vy - ship.velocityY;
  const t = clamp(-(dx * vx + dy * vy) / Math.max(1, vx * vx + vy * vy), 0, horizon);
  return { t, dx: dx + vx * t, dy: dy + vy * t,
    clearance: Math.hypot(dx + vx * t, dy + vy * t) - shipRadius - obstacle.radius };
}

export function flightControls(s, hints, progress) {
  const ship = s.ship;
  const speed = Math.hypot(ship.velocityX, ship.velocityY);
  const dockDistance = Math.hypot(s.destination.x - ship.x, s.destination.y - ship.y);
  const waypoints = hints.waypoints;
  while (progress.waypoint < waypoints.length - 1 &&
    Math.hypot(waypoints[progress.waypoint].position.x - ship.x,
      waypoints[progress.waypoint].position.y - ship.y) < waypoints[progress.waypoint].radius) {
    progress.waypoint++;
  }
  if (dockDistance < s.destination.radius * 0.78) progress.dock = true;
  if (dockDistance > s.destination.radius * 0.94) progress.dock = false;
  if (progress.dock) {
    const error = wrapAngle(s.destination.requiredBottomFacingRadians - Math.PI - ship.rotation);
    return { right: error > 0.065, left: error < -0.065, thrust: false, brake: speed > 5,
      phase: "dock", waypoint: progress.waypoint };
  }
  const waypoint = waypoints[progress.waypoint];
  const dx = waypoint.position.x - ship.x;
  const dy = waypoint.position.y - ship.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  let limit = Math.min(waypoint.targetSpeed, Math.max(15, distance * 0.75));
  if (progress.waypoint === waypoints.length - 1) {
    limit = Math.min(limit, Math.max(18, (dockDistance - s.destination.radius + 40) * 0.5));
  }
  let desiredX = dx / distance * limit;
  let desiredY = dy / distance * limit;
  const obstacles = [...s.movingObstacles, ...(progress.staticObstacles ?? []).map((o) => ({ ...o, vx: 0, vy: 0 }))];
  let avoiding = null;
  for (const obstacle of obstacles) {
    const approach = closestApproach(ship, obstacle, hints.obstacleLookaheadSeconds);
    if (approach.clearance >= 32) continue;
    const length = Math.max(1, Math.hypot(approach.dx, approach.dy));
    desiredX = desiredX * 0.5 - approach.dx / length * 65;
    desiredY = desiredY * 0.5 - approach.dy / length * 65;
    avoiding = { id: obstacle.id, ...approach };
  }
  const ax = (desiredX - ship.velocityX) * 1.8 - (s.environment?.ax ?? 0);
  const ay = (desiredY - ship.velocityY) * 1.8 - (s.environment?.ay ?? 0);
  const magnitude = Math.hypot(ax, ay);
  const error = wrapAngle(Math.atan2(ax, -ay) - ship.rotation);
  const desiredSpeed = Math.hypot(desiredX, desiredY);
  const brake = speed > desiredSpeed + 10 || (Math.abs(error) > 0.65 && speed > 35);
  return { right: error > 0.065, left: error < -0.065,
    thrust: !brake && magnitude > 28 && Math.abs(error) < 0.24, brake,
    phase: avoiding ? "avoid" : "cruise", waypoint: progress.waypoint, avoiding };
}

export function landingControls(s, profile, hints) {
  const st = s.state;
  const tuning = s.tuning;
  const altitude = Math.max(0, s.zone?.altitude ?? (s.pad.surfaceY - st.y - tuning.shipRadius));
  const padVx = s.pad.velocityX ?? 0;
  const dx = s.pad.centerX + padVx * 0.4 + hints.targetTangentOffset - st.x;
  const desiredVx = padVx + clamp(dx * 0.7, -45, 45);
  const ax = (desiredVx - st.velocityX) * 1.5 - (s.wind?.ax ?? 0);
  const desiredTilt = clamp(Math.atan2(ax, tuning.gravity + (s.wind?.ay ?? 0)),
    -hints.maximumTiltRadians, hints.maximumTiltRadians);
  const error = wrapAngle(desiredTilt - st.rotation);
  const angularError = clamp(error * 3, -0.65, 0.65) - st.angularVelocity;
  const target = profile === "bumpy" ? 110 : hints.targetRelativeDescent;
  const desiredVy = Math.min(profile === "bumpy" ? 155 : 130, target + altitude * 0.16);
  return { right: angularError > 0.10, left: angularError < -0.10,
    brake: Math.abs(error) < 0.055 && Math.abs(st.angularVelocity) > 0.035,
    thrust: st.velocityY > desiredVy, altitude, desiredTilt, desiredVy };
}

export function keyboardPilot(page) {
  const held = new Set();
  async function set(name, down) {
    if (down === held.has(name)) return;
    if (down) { await page.keyboard.down(name); held.add(name); }
    else { await page.keyboard.up(name); held.delete(name); }
  }
  return {
    async apply(c = {}) {
      for (const [key, field] of [["KeyA", "left"], ["KeyD", "right"], ["KeyW", "thrust"], ["KeyS", "brake"]]) {
        await set(key, Boolean(c[field]));
      }
    },
    async release() { for (const key of [...held]) await set(key, false); },
  };
}

export async function readPilotState(page, name) {
  return page.evaluate((key) => {
    const scenes = window.__CGE__?.activeScenes() ?? [];
    const scene = key === "flight" ? "FlightScene" : "LandingScene";
    // Scene getters survive shutdown; never read destroyed scene objects during a handoff.
    return { state: scenes.includes(scene) ? window.__CGE__?.getState(key) : null,
      scenes, fps: window.__CGE__?.actualFps() ?? 0 };
  }, name);
}

export function cyclePeriod(route) {
  const gust = route.forceZones.find((zone) => zone.kind === "gust")?.cycle;
  if (gust) return gust.warningMs + gust.attackMs + gust.sustainMs + gust.releaseMs + gust.calmMs;
  return route.movingObstacles[0]?.path.periodMs ?? 0;
}
