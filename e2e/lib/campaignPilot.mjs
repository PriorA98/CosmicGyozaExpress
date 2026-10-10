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

/** The shared campaign autopilot (src/dev/routePilot.ts): same controller as the route simulation tests. */
export function routePilot() {
  return loadData(resolve("src/dev/routePilot.ts"));
}

/** Probe flight state -> routePilot input. */
export function pilotInput(s) {
  return { ship: s.ship, simTimeMs: s.simTimeMs, environment: s.environment ?? null,
    movingObstacles: s.movingObstacles ?? [], seekers: s.seekers ?? [], destination: s.destination };
}

export const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
export const wrapAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));

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
