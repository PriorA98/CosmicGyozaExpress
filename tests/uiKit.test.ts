import { describe, expect, it } from "vitest";
import { UI_ICON_FRAME, type UiIconName } from "../src/data/assetManifest";
import { routeLogCopy, settingsCopy, soundToastCopy, titleCopy } from "../src/data/uiCopy";
import { ICON_GLYPHS, ICON_GLYPH_SIZE, ICON_OVERRIDES, ICON_OVERRIDE_PALETTE, ICON_OVERRIDE_SIZE } from "../src/ui/iconBitmaps";
import {
  COMPACT_UI_THRESHOLD,
  dotsAlongQuadratic,
  quadraticPoint,
  uiIconScale,
  uiPixelLabelSize,
  uiScaled,
  uiTextSize,
  MIN_ESSENTIAL_TEXT_PX,
} from "../src/ui/layout";
import {
  DEFAULT_SOUND_RESTORE,
  SETTINGS_ROWS,
  applySettingsAction,
  isSoundOn,
  nextSettingsRow,
  quantizeVolume,
  settingsEqual,
  type SettingsState,
} from "../src/ui/settingsModel";
import { SOUND_TOAST_TIMING, soundToastAnchor, soundToastContent } from "../src/ui/soundToastModel";
import { touchGlyphCells } from "../src/ui/touchGlyphs";

describe("compact ui scaling", () => {
  it("scales geometry and text by uiScale with a readable floor", () => {
    expect(uiScaled(40, 1)).toBe(40);
    expect(uiScaled(40, 1.48)).toBe(59);
    expect(uiScaled(40, Number.NaN)).toBe(40);
    expect(uiTextSize(13, 1.48)).toBe(19);
    expect(uiTextSize(8, 1)).toBe(MIN_ESSENTIAL_TEXT_PX);
  });

  it("snaps pixel fonts and icons to whole grid steps once compact", () => {
    expect(uiPixelLabelSize(1)).toBe(16);
    expect(uiPixelLabelSize(COMPACT_UI_THRESHOLD)).toBe(24);
    expect(uiPixelLabelSize(1.6) % 8).toBe(0);
    expect(uiIconScale(1)).toBe(2);
    expect(uiIconScale(1.48)).toBe(3);
  });

  it("keeps phone-landscape essential text at about 10 physical px or more", () => {
    // 844x390 phone shows the 1280x720 canvas at ~0.54; compactUiScale is ~1.48 there.
    const displayScale = 693 / 1280;
    const compact = 0.8 / displayScale;
    expect(uiTextSize(13, compact) * displayScale).toBeGreaterThanOrEqual(10);
  });
});

describe("title route curve", () => {
  const from = { x: 0, y: 100 };
  const control = { x: 50, y: 0 };
  const to = { x: 100, y: 100 };

  it("hits the endpoints and clamps t", () => {
    expect(quadraticPoint(from, control, to, 0)).toEqual(from);
    expect(quadraticPoint(from, control, to, 1)).toEqual(to);
    expect(quadraticPoint(from, control, to, -3)).toEqual(from);
    expect(quadraticPoint(from, control, to, 0.5)).toEqual({ x: 50, y: 50 });
  });

  it("places whole-pixel dots at roughly even arc-length spacing", () => {
    const dots = dotsAlongQuadratic(from, control, to, 12);
    expect(dots.length).toBeGreaterThan(8);
    for (const dot of dots) {
      expect(Number.isInteger(dot.x)).toBe(true);
      expect(Number.isInteger(dot.y)).toBe(true);
    }
    for (let index = 1; index < dots.length; index += 1) {
      const a = dots[index - 1];
      const b = dots[index];
      if (!a || !b) continue;
      expect(b.t).toBeGreaterThan(a.t);
      expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeGreaterThan(9);
      expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeLessThan(15);
    }
    expect(dotsAlongQuadratic(from, control, to, 0)).toEqual([]);
    expect(dotsAlongQuadratic(from, control, to, Number.NaN)).toEqual([]);
  });
});

describe("sound toast model", () => {
  it("says sound on/off with the matching speaker icon", () => {
    expect(soundToastContent(true)).toEqual({ label: soundToastCopy.off, icon: "soundOff", keyHint: soundToastCopy.hint });
    expect(soundToastContent(false)).toEqual({ label: soundToastCopy.on, icon: "soundOn", keyHint: soundToastCopy.hint });
  });

  it("anchors to the canvas top-centre and flags small canvases as compact", () => {
    expect(soundToastAnchor({ left: 100, top: 20, width: 1280, height: 720 })).toEqual({ left: 740, top: 56, compact: false });
    expect(soundToastAnchor({ left: 75, top: 0, width: 693, height: 390 }).compact).toBe(true);
    expect(soundToastAnchor({ left: Number.NaN, top: Number.NaN, width: Number.NaN, height: 10 })).toEqual({ left: 0, top: 1, compact: false });
  });

  it("is brief: on screen about a second", () => {
    expect(SOUND_TOAST_TIMING.holdMs).toBeGreaterThanOrEqual(900);
    expect(SOUND_TOAST_TIMING.holdMs).toBeLessThanOrEqual(1600);
  });
});

describe("icon bitmaps", () => {
  it("has a stand-in glyph for every ui icon frame", () => {
    for (const name of Object.keys(UI_ICON_FRAME) as UiIconName[]) {
      const rows = ICON_GLYPHS[name];
      expect(rows).toHaveLength(ICON_GLYPH_SIZE);
      for (const row of rows) expect(row).toHaveLength(ICON_GLYPH_SIZE);
    }
  });

  it("keeps full-resolution overrides 16x16 with known palette keys", () => {
    const overrides = Object.entries(ICON_OVERRIDES);
    expect(overrides.map(([name]) => name).sort()).toEqual(["package", "soundOff", "soundOn"]);
    for (const [, rows] of overrides) {
      expect(rows).toHaveLength(ICON_OVERRIDE_SIZE);
      for (const row of rows ?? []) {
        expect(row).toHaveLength(ICON_OVERRIDE_SIZE);
        for (const char of row) if (char !== ".") expect(ICON_OVERRIDE_PALETTE[char]).toBeDefined();
      }
    }
  });
});

describe("touch glyphs", () => {
  it("mirrors left/right arrows exactly so tiles stay consistent", () => {
    const left = touchGlyphCells("left");
    const right = touchGlyphCells("right");
    expect(right.cells).toHaveLength(left.cells.length);
    const mirrored = new Set(left.cells.map(([x, y]) => `${left.width - 1 - x},${y}`));
    for (const [x, y] of right.cells) expect(mirrored.has(`${x},${y}`)).toBe(true);
    expect(touchGlyphCells("steady").cells.length).toBeGreaterThan(0);
  });
});

describe("settings model", () => {
  const base: SettingsState = { values: { musicVolume: 0.6, sfxVolume: 0.8, reducedMotion: false }, restore: DEFAULT_SOUND_RESTORE };

  it("toggles sound off and back on to the remembered volumes", () => {
    const off = applySettingsAction(base, { kind: "activate", row: "sound" });
    expect(isSoundOn(off.values)).toBe(false);
    const on = applySettingsAction(off, { kind: "activate", row: "sound" });
    expect(on.values.musicVolume).toBe(0.6);
    expect(on.values.sfxVolume).toBe(0.8);
  });

  it("steps volumes in tenths within 0..1 and quantizes junk", () => {
    expect(applySettingsAction(base, { kind: "step", row: "music", direction: 1 }).values.musicVolume).toBe(0.7);
    const full = { ...base, values: { ...base.values, sfxVolume: 1 } };
    expect(applySettingsAction(full, { kind: "step", row: "sfx", direction: 1 }).values.sfxVolume).toBe(1);
    expect(quantizeVolume(Number.NaN)).toBe(0);
    expect(quantizeVolume(0.34)).toBe(0.3);
  });

  it("toggles reduced motion and leaves values alone on done", () => {
    expect(applySettingsAction(base, { kind: "activate", row: "motion" }).values.reducedMotion).toBe(true);
    expect(settingsEqual(applySettingsAction(base, { kind: "activate", row: "done" }).values, base.values)).toBe(true);
  });

  it("wraps row navigation", () => {
    expect(nextSettingsRow(0, -1)).toBe(SETTINGS_ROWS.length - 1);
    expect(nextSettingsRow(SETTINGS_ROWS.length - 1, 1)).toBe(0);
    expect(nextSettingsRow(Number.NaN, 1)).toBe(1);
  });
});

describe("title, settings and route log copy", () => {
  it("switches the CTA once delivered and keeps every notice short", () => {
    expect(titleCopy.startAgainButton).not.toBe(titleCopy.startButton);
    expect(titleCopy.deliveredBadge).toContain("postcard");
    for (const notice of Object.values(titleCopy.saveNotice)) expect(notice.length).toBeLessThanOrEqual(80);
    expect(Object.keys(settingsCopy.rows)).toEqual(["sound", "music", "sfx", "motion"]);
    expect(routeLogCopy.close.length).toBeGreaterThan(0);
  });
});
