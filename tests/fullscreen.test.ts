import { describe, expect, it } from "vitest";
import { canOfferFullscreen } from "../src/game/fullscreen";

function fakeWindow(options: { coarse: boolean; enabled: boolean | undefined; standalone?: boolean; webkit?: boolean }): Window {
  const doc = options.webkit ? { webkitFullscreenEnabled: options.enabled } : { fullscreenEnabled: options.enabled };
  return {
    document: doc,
    matchMedia: (query: string) => ({
      matches: query.includes("pointer: coarse") ? options.coarse : Boolean(options.standalone),
    }),
  } as unknown as Window;
}

describe("phone fullscreen affordance", () => {
  it("is offered only on touch phones whose browser supports the Fullscreen API", () => {
    expect(canOfferFullscreen(fakeWindow({ coarse: true, enabled: true }))).toBe(true);
    expect(canOfferFullscreen(fakeWindow({ coarse: true, enabled: true, webkit: true }))).toBe(true);
    expect(canOfferFullscreen(fakeWindow({ coarse: false, enabled: true }))).toBe(false); // desktop mouse
    expect(canOfferFullscreen(fakeWindow({ coarse: true, enabled: false }))).toBe(false); // iPhone Safari
    expect(canOfferFullscreen(fakeWindow({ coarse: true, enabled: undefined }))).toBe(false);
  });

  it("is not offered when already launched from the home screen", () => {
    expect(canOfferFullscreen(fakeWindow({ coarse: true, enabled: true, standalone: true }))).toBe(false);
  });
});
