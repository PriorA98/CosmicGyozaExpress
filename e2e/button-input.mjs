// Run with the dev server: node e2e/button-input.mjs
import assert from "node:assert/strict";
import { attachPageLogs, contextOptions, launchBrowser, waitForProbe, waitForScene } from "./lib/harness.mjs";

const browser = await launchBrowser();
try {
  for (const viewport of ["desktop", "phoneLandscapeTouch", "phoneSmallTouch"]) {
    const context = await browser.newContext(contextOptions(viewport));
    const page = await context.newPage();
    const logs = attachPageLogs(page);
    const touch = viewport !== "desktop";
    async function open(showcase, scene) {
      await page.goto(`http://127.0.0.1:5173/?showcase=${showcase}`);
      await waitForProbe(page);
      await waitForScene(page, scene);
      if (scene === "DeliveryResultScene") {
        await page.waitForFunction(() => window.__CGE__.getState("result").revealComplete);
      }
      // Allow the final reveal/scene transition tween to settle before hit testing.
      await page.waitForTimeout(500);
    }
    async function point(state, id) {
      const bounds = await page.evaluate(({ state, id }) => {
        const buttons = window.__CGE__.getState(state).buttons;
        return buttons.find((button) => (button.action ?? button.name) === id)?.bounds;
      }, { state, id });
      assert.ok(bounds, `missing ${state} button ${id}`);
      const canvas = await page.locator("canvas").boundingBox();
      assert.ok(canvas);
      return {
        x: canvas.x + (bounds.x + bounds.width / 2) * canvas.width / 1280,
        y: canvas.y + (bounds.y + bounds.height / 2) * canvas.height / 720,
      };
    }
    async function activate(state, id) {
      const { x, y } = await point(state, id);
      if (touch) await page.touchscreen.tap(x, y);
      else await page.mouse.click(x, y);
    }
    for (const [action, target] of [
      ["fly-again", "FlightScene"],
      ["delivery-board", "MissionSelectScene"],
      ["next-delivery", "FlightScene"],
    ]) {
      await open("result-soft", "DeliveryResultScene");
      await activate("result", action);
      await waitForScene(page, target);
      console.log(`${viewport}: ${action} passed`);
    }

    await open("result-soft", "DeliveryResultScene");
    const held = await point("result", "next-delivery");
    if (touch) {
      const session = await context.newCDPSession(page);
      await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...held, id: 1 }] });
      await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 5, y: 5, id: 1 }] });
      await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...held, id: 1 }] });
      await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await session.detach();
    } else {
      await page.mouse.move(held.x, held.y);
      await page.mouse.down();
      await page.mouse.move(5, 5);
      await page.mouse.move(held.x, held.y);
      await page.mouse.up();
    }
    await page.waitForTimeout(400);
    assert.ok(await page.evaluate(() => window.__CGE__.activeScenes().includes("DeliveryResultScene")), "dragging off must cancel");
    await activate("result", "next-delivery");
    await waitForScene(page, "FlightScene");
    console.log(`${viewport}: drag cancellation and next tap passed`);

    await open("title", "TitleScene");
    await activate("title", "settings");
    await page.waitForFunction(() => window.__CGE__.getState("title").settingsOpen);
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !window.__CGE__.getState("title").settingsOpen);
    await page.waitForTimeout(500);
    await activate("title", "board");
    await waitForScene(page, "MissionSelectScene");
    await open("title", "TitleScene");
    await activate("title", "start");
    await waitForScene(page, "FlightScene");
    await open("title-completed", "TitleScene");
    await activate("title", "route-log");
    await page.waitForFunction(() => window.__CGE__.getState("title").routeLogOpen);
    assert.deepEqual(logs.pageErrors, []);
    console.log(`${viewport}: title start, settings, board, route log passed`);
    await context.close();
  }
} finally {
  await browser.close();
}
